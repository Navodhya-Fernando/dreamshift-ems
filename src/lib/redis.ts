import { createClient } from 'redis';

type DreamshiftRedisClient = ReturnType<typeof createClient>;

declare global {
  var __dreamshiftRedisPubClient: DreamshiftRedisClient | null | undefined;
  var __dreamshiftRedisSubClient: DreamshiftRedisClient | null | undefined;
}

function createRedisClient() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return null;

  return createClient({ url: redisUrl });
}

export async function getRedisPubClient() {
  if (globalThis.__dreamshiftRedisPubClient === undefined) {
    globalThis.__dreamshiftRedisPubClient = createRedisClient();
  }

  const client = globalThis.__dreamshiftRedisPubClient;
  if (!client) return null;

  if (!client.isOpen) {
    await client.connect();
  }

  return client;
}

export async function getRedisSubClient() {
  if (globalThis.__dreamshiftRedisSubClient === undefined) {
    globalThis.__dreamshiftRedisSubClient = createRedisClient();
  }

  const client = globalThis.__dreamshiftRedisSubClient;
  if (!client) return null;

  if (!client.isOpen) {
    await client.connect();
  }

  return client;
}