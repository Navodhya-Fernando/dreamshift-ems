"use client";

import React, { useEffect, useState } from 'react';
import { Bell, RefreshCw, Menu } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { toastInfo, toastError } from '@/lib/toast';
import { dispatchTimerCommand, persistElapsedToTask, readTimerSnapshot, subscribeTimerState, writeTimerSnapshot } from '@/lib/timerShortcuts';
import { useCachedApi } from '@/lib/useCachedApi';
import NotificationsPanel from '@/components/ui/NotificationsPanel';

const INITIAL_TIMER_STATE = {
  activeTask: '',
  activityTitle: '',
  elapsedSeconds: 0,
  isRunning: false,
  lastTickAt: null as number | null,
};

export default function ShellTopbar({ onToggleNav, navOpen }: { onToggleNav: () => void; navOpen: boolean }) {
  const pathname = usePathname();
  const title = ({ '/': 'Home', '/tasks': 'My Tasks', '/projects': 'Projects', '/workspaces': 'Workspaces', '/time': 'Time Tracking', '/calendar': 'Calendar', '/messages': 'Messages', '/admin': 'Administration', '/analytics': 'Analytics', '/settings': 'Settings', '/profile': 'Profile', '/notifications': 'Notifications', '/task-templates': 'Templates' } as Record<string, string>)[pathname === '/' ? '/' : '/' + pathname.split('/')[1]] || 'Workspace';
  const router = useRouter();
  const [savingTimer, setSavingTimer] = useState(false);
  const [timer, setTimer] = useState(INITIAL_TIMER_STATE);
  const [showNotifications, setShowNotifications] = useState(false);
  const { data: notificationData, refresh: refreshNotifications } = useCachedApi<{ unreadCount: number; items: unknown[] }>({
    cacheKey: 'notifications:topbar',
    initialData: { unreadCount: 0, items: [] },
    fetcher: async () => {
      const response = await fetch('/api/notifications?limit=1', { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Failed to load notifications');
      return payload.data as { unreadCount: number; items: unknown[] };
    },
    ttlMs: 30_000,
  });
  useEffect(() => { const update = () => { if (!document.hidden) void refreshNotifications(); }; const id = window.setInterval(update, 30000); document.addEventListener('visibilitychange', update); return () => { window.clearInterval(id); document.removeEventListener('visibilitychange', update); }; }, [refreshNotifications]);

  useEffect(() => {
    const hydrateFrame = window.requestAnimationFrame(() => {
      setTimer(readTimerSnapshot());
    });

    const unsubscribe = subscribeTimerState((snapshot) => {
      setTimer(snapshot);
    });

    const tick = window.setInterval(() => {
      if (!document.hidden) setTimer(previous => previous.isRunning ? readTimerSnapshot() : previous);
    }, 1000);

    return () => {
      window.cancelAnimationFrame(hydrateFrame);
      unsubscribe();
      window.clearInterval(tick);
    };
  }, []);

  const refreshAll = () => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new Event('dreamshift:refresh-all'));
    toastInfo('Refreshing all live panels...');
  };

  const onStart = () => {
    if (!timer.activeTask) {
      toastInfo('Pick a task in Timesheet first, then use top shortcuts.');
      router.push('/time');
      return;
    }

    const snapshot = readTimerSnapshot();
    writeTimerSnapshot({
      ...snapshot,
      isRunning: true,
      lastTickAt: Date.now(),
    });
    dispatchTimerCommand('start');
  };

  const onPause = () => {
    const snapshot = readTimerSnapshot();
    writeTimerSnapshot({
      ...snapshot,
      isRunning: false,
      lastTickAt: null,
    });
    dispatchTimerCommand('pause');
  };

  const onStop = async () => {
    if (savingTimer) return;
    setSavingTimer(true);
    const snapshot = readTimerSnapshot();

    try {
      if (snapshot.activeTask && snapshot.elapsedSeconds > 0) {
        await persistElapsedToTask(snapshot);
      }
    } catch {
      toastError('Could not save time. Your timer has been retained.');
      setSavingTimer(false);
      return;
    }

    dispatchTimerCommand('stop');
    writeTimerSnapshot({
      ...snapshot,
      isRunning: false,
      elapsedSeconds: 0,
      lastTickAt: null,
    });
    setSavingTimer(false);
  };

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600).toString().padStart(2, '0');
    const m = Math.floor((secs % 3600) / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  return (
    <div className="shell-topbar">
      <div className="shell-topbar-leading"><button className="shell-nav-toggle" type="button" aria-label="Toggle navigation" aria-expanded={navOpen} aria-controls="ems-navigation" onClick={onToggleNav}><Menu size={20}/></button><div className="shell-topbar-title">{title}</div></div>

      <div className="shell-topbar-actions">
        <div className="shell-notifications-wrap">
          <button
            className="shell-notifications-btn"
            type="button"
            onClick={() => setShowNotifications((v) => !v)}
            aria-label="Open notifications"
          >
            <Bell size={14} />
            {notificationData.unreadCount > 0 && <span className="shell-notifications-badge">{notificationData.unreadCount > 99 ? '99+' : notificationData.unreadCount}</span>}
          </button>
          {showNotifications && <NotificationsPanel onClose={() => setShowNotifications(false)} />}
        </div>

        <div className="shell-timer-shortcuts" role="group" aria-label="Timer shortcuts">
          <span className={`shell-timer-dot ${timer.isRunning ? 'running' : 'paused'}`} />
          <span className="shell-timer-value">{formatTime(timer.elapsedSeconds)}</span>

          <button className={`shell-timer-btn ${timer.isRunning ? 'active' : ''}`} type="button" onClick={onStart} title="Start timer" disabled={timer.isRunning}>
            <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M6.5 4.5a1 1 0 0 1 1.53-.848l8 5a1 1 0 0 1 0 1.696l-8 5A1 1 0 0 1 6.5 14.5v-10z" /></svg>
          </button>
          <button className={`shell-timer-btn ${!timer.isRunning ? 'active' : ''}`} type="button" onClick={onPause} title="Pause timer" disabled={!timer.isRunning}>
            <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M6 4.75A1.25 1.25 0 0 1 7.25 3.5h1.5A1.25 1.25 0 0 1 10 4.75v10.5A1.25 1.25 0 0 1 8.75 16.5h-1.5A1.25 1.25 0 0 1 6 15.25V4.75zm4 0A1.25 1.25 0 0 1 11.25 3.5h1.5A1.25 1.25 0 0 1 14 4.75v10.5A1.25 1.25 0 0 1 12.75 16.5h-1.5A1.25 1.25 0 0 1 10 15.25V4.75z" /></svg>
          </button>
          <button className="shell-timer-btn stop" type="button" onClick={onStop} title="Stop and save timer" disabled={savingTimer || timer.elapsedSeconds <= 0}>
            <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><rect x="5" y="5" width="10" height="10" rx="1.5" /></svg>
          </button>
        </div>

        <button className="btn btn-ghost" onClick={refreshAll} aria-label="Refresh all panels">
          <RefreshCw size={15}/><span className="shell-refresh-label">Refresh</span>
        </button>
      </div>
    </div>
  );
}
