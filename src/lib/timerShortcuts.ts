export type TimerCommand = 'start' | 'pause' | 'stop';

export type TimerSnapshot = {
  activeTask: string;
  activityTitle: string;
  elapsedSeconds: number;
  isRunning: boolean;
  lastTickAt: number | null;
};

const TIMER_STORAGE_KEY = 'dreamshift:timer:v1';
const TIMER_STATE_EVENT = 'dreamshift:timer-state';
const TIMER_COMMAND_EVENT = 'dreamshift:timer-command';

const EMPTY_TIMER: TimerSnapshot = {
  activeTask: '',
  activityTitle: '',
  elapsedSeconds: 0,
  isRunning: false,
  lastTickAt: null,
};

function isClient() {
  return typeof window !== 'undefined';
}

function syncElapsed(snapshot: TimerSnapshot) {
  if (!snapshot.isRunning || !snapshot.lastTickAt) return snapshot;

  const now = Date.now();
  const diffSeconds = Math.floor((now - snapshot.lastTickAt) / 1000);
  if (diffSeconds <= 0) return snapshot;

  return {
    ...snapshot,
    elapsedSeconds: snapshot.elapsedSeconds + diffSeconds,
    lastTickAt: now,
  };
}

export function readTimerSnapshot(): TimerSnapshot {
  if (!isClient()) return { ...EMPTY_TIMER };

  try {
    const raw = window.localStorage.getItem(TIMER_STORAGE_KEY);
    if (!raw) return { ...EMPTY_TIMER };

    const parsed = JSON.parse(raw) as Partial<TimerSnapshot>;
    const snapshot: TimerSnapshot = {
      activeTask: String(parsed.activeTask || ''),
      activityTitle: String(parsed.activityTitle || ''),
      elapsedSeconds: Number(parsed.elapsedSeconds || 0),
      isRunning: Boolean(parsed.isRunning),
      lastTickAt: parsed.lastTickAt ? Number(parsed.lastTickAt) : null,
    };

    const synced = syncElapsed(snapshot);
    if (synced !== snapshot) {
      writeTimerSnapshot(synced, false);
    }

    return synced;
  } catch {
    return { ...EMPTY_TIMER };
  }
}

export function writeTimerSnapshot(snapshot: TimerSnapshot, emit = true) {
  if (!isClient()) return;

  try {
    window.localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(snapshot));
    if (emit) {
      window.dispatchEvent(new CustomEvent<TimerSnapshot>(TIMER_STATE_EVENT, { detail: snapshot }));
    }
  } catch {
    // Ignore storage errors.
  }
}

export function dispatchTimerCommand(command: TimerCommand) {
  if (!isClient()) return;
  window.dispatchEvent(new CustomEvent<TimerCommand>(TIMER_COMMAND_EVENT, { detail: command }));
}

export function subscribeTimerState(handler: (snapshot: TimerSnapshot) => void) {
  if (!isClient()) return () => undefined;

  const listener = (event: Event) => {
    const custom = event as CustomEvent<TimerSnapshot>;
    if (custom.detail) handler(custom.detail);
  };

  const storageListener = () => {
    handler(readTimerSnapshot());
  };

  window.addEventListener(TIMER_STATE_EVENT, listener as EventListener);
  window.addEventListener('storage', storageListener);

  return () => {
    window.removeEventListener(TIMER_STATE_EVENT, listener as EventListener);
    window.removeEventListener('storage', storageListener);
  };
}

export function subscribeTimerCommand(handler: (command: TimerCommand) => void) {
  if (!isClient()) return () => undefined;

  const listener = (event: Event) => {
    const custom = event as CustomEvent<TimerCommand>;
    if (custom.detail) handler(custom.detail);
  };

  window.addEventListener(TIMER_COMMAND_EVENT, listener as EventListener);
  return () => {
    window.removeEventListener(TIMER_COMMAND_EVENT, listener as EventListener);
  };
}

export async function persistElapsedToTask(snapshot: TimerSnapshot) {
  if (!snapshot.activeTask || snapshot.elapsedSeconds <= 0) return;

  const readTaskResponse = await fetch(`/api/tasks/${snapshot.activeTask}`, { cache: 'no-store' });
  const readTaskJson = await readTaskResponse.json();
  if (!readTaskResponse.ok || !readTaskJson.success) {
    throw new Error(readTaskJson.error || 'Unable to read task for timer save');
  }

  const currentSpent = Number(readTaskJson.data?.timeSpent || 0);
  const nextSpent = currentSpent + snapshot.elapsedSeconds;

  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - snapshot.elapsedSeconds * 1000);

  const response = await fetch('/api/time-entries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      taskId: snapshot.activeTask,
      source: 'TIMER',
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      note: snapshot.activityTitle || undefined,
    }),
  });

  const json = await response.json();
  if (!response.ok || !json.success) {
    throw new Error(json.error || 'Unable to save timer session');
  }

  const updateResponse = await fetch(`/api/tasks/${snapshot.activeTask}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ timeSpent: nextSpent }),
  });
  const updateJson = await updateResponse.json();
  if (!updateResponse.ok || !updateJson.success) {
    throw new Error(updateJson.error || 'Unable to update task total');
  }

  return { entry: json.data, nextSpent };
}

export const timerShortcutEvents = {
  state: TIMER_STATE_EVENT,
  command: TIMER_COMMAND_EVENT,
};
