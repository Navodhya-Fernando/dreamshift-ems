"use client";

import React, { useEffect, useState } from 'react';
import { Bell, RefreshCw, Menu } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { toastInfo } from '@/lib/toast';
import {useTimer,TimerClock} from './TimerProvider';
import { useCachedApi } from '@/lib/useCachedApi';
import CommandSearch from './CommandSearch';
import NotificationsPanel from '@/components/ui/NotificationsPanel';


export default function ShellTopbar({ onToggleNav, navOpen }: { onToggleNav: () => void; navOpen: boolean }) {
  const pathname = usePathname();
  const title = ({ '/': 'Home', '/tasks': 'My Tasks', '/projects': 'Projects', '/workspaces': 'Workspaces', '/time': 'Time Tracking', '/calendar': 'Calendar', '/messages': 'Messages', '/admin': 'Administration', '/analytics': 'Analytics', '/settings': 'Settings', '/profile': 'Profile', '/notifications': 'Notifications', '/task-templates': 'Templates' } as Record<string, string>)[pathname === '/' ? '/' : '/' + pathname.split('/')[1]] || 'Workspace';
  const router = useRouter();
  const {timer,ready,busy,error,act}=useTimer();
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

  const refreshAll = () => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new Event('dreamshift:refresh-all'));
    toastInfo('Refreshing all live panels...');
  };

  return (
    <div className="shell-topbar">
      <div className="shell-topbar-leading"><button className="shell-nav-toggle" type="button" aria-label="Toggle navigation" aria-expanded={navOpen} aria-controls="ems-navigation" onClick={onToggleNav}><Menu size={20}/></button><div className="shell-topbar-title">{title}</div></div>

      <div className="shell-topbar-actions"><CommandSearch/>
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

        <div className="shell-timer-shortcuts" role="group" aria-label="Timer shortcuts" title={error||timer?.taskTitle||"No active timer"}>
          <span className={`shell-timer-dot ${timer?.runningSince ? 'running' : 'paused'}`} />
          <TimerClock className="shell-timer-value"/>

          <button className={`shell-timer-btn ${timer?.runningSince ? 'active' : ''}`} type="button" onClick={()=>timer?void act('resume'):router.push('/time')} title="Start or resume timer" disabled={!ready||busy||Boolean(timer?.runningSince)}>
            <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M6.5 4.5a1 1 0 0 1 1.53-.848l8 5a1 1 0 0 1 0 1.696l-8 5A1 1 0 0 1 6.5 14.5v-10z" /></svg>
          </button>
          <button className={`shell-timer-btn ${!timer?.runningSince ? 'active' : ''}`} type="button" onClick={()=>void act('pause')} title="Pause timer" disabled={!ready||busy||!timer?.runningSince}>
            <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M6 4.75A1.25 1.25 0 0 1 7.25 3.5h1.5A1.25 1.25 0 0 1 10 4.75v10.5A1.25 1.25 0 0 1 8.75 16.5h-1.5A1.25 1.25 0 0 1 6 15.25V4.75zm4 0A1.25 1.25 0 0 1 11.25 3.5h1.5A1.25 1.25 0 0 1 14 4.75v10.5A1.25 1.25 0 0 1 12.75 16.5h-1.5A1.25 1.25 0 0 1 10 15.25V4.75z" /></svg>
          </button>
          <button className="shell-timer-btn stop" type="button" onClick={()=>void act('stop')} title="Stop and save timer" disabled={!ready||busy||!timer}>
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
