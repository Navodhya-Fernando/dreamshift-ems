import crypto from 'crypto';
import { getRedisPubClient, getRedisSubClient } from '@/lib/redis';

type MessageEventType = 'message' | 'read';

export type MessageEventPayload = {
  type: MessageEventType;
  userId: string;
  at: string;
  conversationId?: string;
  messageId?: string;
};

type Listener = (event: MessageEventPayload) => void;

type MessageEventEnvelope = {
  origin: string;
  targetUserIds: string[];
  event: MessageEventPayload;
};

declare global {
  var __dreamshiftMessageListeners: Map<string, Set<Listener>> | undefined;
  var __dreamshiftMessageSubInit: boolean | undefined;
}

const listeners = globalThis.__dreamshiftMessageListeners || new Map<string, Set<Listener>>();
globalThis.__dreamshiftMessageListeners = listeners;

const EVENT_CHANNEL = 'dreamshift:messages:events';
const PROCESS_ID = crypto.randomUUID();

function dispatchLocal(targetUserIds: string[], event: MessageEventPayload) {
  const uniqueIds = Array.from(new Set(targetUserIds.map(String)));
  uniqueIds.forEach((userId) => {
    const bucket = listeners.get(userId);
    if (!bucket) return;
    bucket.forEach((listener) => {
      try {
        listener(event);
      } catch {
      }
    });
  });
}

async function ensureSubscriber() {
  if (globalThis.__dreamshiftMessageSubInit) return;
  globalThis.__dreamshiftMessageSubInit = true;

  try {
    const subClient = await getRedisSubClient();
    if (!subClient) return;

    await subClient.subscribe(EVENT_CHANNEL, (rawMessage) => {
      try {
        const envelope = JSON.parse(rawMessage) as MessageEventEnvelope;
        if (envelope.origin === PROCESS_ID) return;
        dispatchLocal(envelope.targetUserIds, envelope.event);
      } catch {
      }
    });
  } catch {
    globalThis.__dreamshiftMessageSubInit = false;
  }
}

export function subscribeToMessageEvents(userId: string, listener: Listener) {
  void ensureSubscriber();

  const key = String(userId);
  const bucket = listeners.get(key) || new Set<Listener>();
  bucket.add(listener);
  listeners.set(key, bucket);

  return () => {
    const current = listeners.get(key);
    if (!current) return;
    current.delete(listener);
    if (current.size === 0) {
      listeners.delete(key);
    }
  };
}

export function publishMessageEvent(targetUserIds: string[], event: MessageEventPayload) {
  const uniqueIds = Array.from(new Set(targetUserIds.map(String)));
  dispatchLocal(uniqueIds, event);

  void (async () => {
    try {
      const pubClient = await getRedisPubClient();
      if (!pubClient) return;

      const envelope: MessageEventEnvelope = {
        origin: PROCESS_ID,
        targetUserIds: uniqueIds,
        event,
      };

      await pubClient.publish(EVENT_CHANNEL, JSON.stringify(envelope));
    } catch {
    }
  })();
}