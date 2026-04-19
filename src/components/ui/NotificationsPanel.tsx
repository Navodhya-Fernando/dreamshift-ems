"use client";

import React from 'react';
import Link from 'next/link';
import { Bell, X, Check, Clock } from 'lucide-react';
import { useCachedApi } from '@/lib/useCachedApi';
import './NotificationsPanel.css';

interface Notification {
  id: string;
  type: 'assignment' | 'mention' | 'deadline' | 'system';
  title: string;
  message: string;
  link: string | null;
  createdAt: string;
  isRead: boolean;
}

type NotificationPayload = {
  items: Notification[];
  unreadCount: number;
};

function formatRelativeTime(dateValue: string) {
  const date = new Date(dateValue);
  const delta = Math.floor((Date.now() - date.getTime()) / 1000);
  if (delta < 60) return 'Just now';
  if (delta < 3600) return `${Math.floor(delta / 60)}m ago`;
  if (delta < 86400) return `${Math.floor(delta / 3600)}h ago`;
  return `${Math.floor(delta / 86400)}d ago`;
}

export default function NotificationsPanel({ onClose }: { onClose: () => void }) {
  const { data, loading, setData } = useCachedApi<NotificationPayload>({
    cacheKey: 'notifications:panel',
    initialData: { items: [], unreadCount: 0 },
    fetcher: async () => {
      const response = await fetch('/api/notifications?limit=20', { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Failed to load notifications');
      return payload.data as NotificationPayload;
    },
    ttlMs: 30_000,
  });

  const markAllRead = () => {
    void (async () => {
      const response = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAll: true }),
      });

      if (!response.ok) return;

      setData({
        unreadCount: 0,
        items: data.items.map((item) => ({ ...item, isRead: true })),
      });
    })();
  };

  const markOneRead = (id: string) => {
    void (async () => {
      const response = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId: id }),
      });

      if (!response.ok) return;

      const target = data.items.find((item) => item.id === id);
      setData({
        unreadCount: target && !target.isRead ? Math.max(0, data.unreadCount - 1) : data.unreadCount,
        items: data.items.map((item) => (item.id === id ? { ...item, isRead: true } : item)),
      });
    })();
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'mention': return <div className="notif-icon bg-blue"><Bell size={14} /></div>;
      case 'assignment': return <div className="notif-icon bg-blue"><Check size={14} /></div>;
      case 'deadline': return <div className="notif-icon bg-orange"><Clock size={14} /></div>;
      default: return <div className="notif-icon bg-gray"><Check size={14} /></div>;
    }
  };

  return (
    <div className="notifications-dropdown glass animate-fade-in">
      <div className="notifications-header">
        <h3>Notifications</h3>
        <div className="header-actions">
           <button onClick={markAllRead} className="text-xs text-primary font-medium hover:underline">Mark all read</button>
           <button onClick={onClose}><X size={16} /></button>
        </div>
      </div>
      
      <div className="notifications-list">
        {loading ? (
          <div className="p-4 text-center text-sm text-muted">Loading notifications...</div>
        ) : data.items.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted">No new notifications</div>
        ) : (
          data.items.map(n => (
            <div key={n.id} className={`notification-item ${n.isRead ? 'read' : 'unread'}`}>
               {getIcon(n.type)}
               <div className="notif-content">
                  <p className="text-sm notif-title">{n.title}</p>
                  <p className="text-sm">{n.message}</p>
                  <span className="text-xs text-muted mt-1">{formatRelativeTime(n.createdAt)}</span>
               </div>
               <div className="notif-actions">
                 {!n.isRead && <button onClick={() => markOneRead(n.id)} className="notif-mini-btn">Mark read</button>}
                 {n.link && <Link className="notif-mini-link" href={n.link} onClick={onClose}>Open</Link>}
               </div>
               {!n.isRead && <div className="unread-dot"></div>}
            </div>
          ))
        )}
      </div>

      <div className="notifications-footer">
        <Link href="/notifications" onClick={onClose}>View all notifications</Link>
      </div>
    </div>
  );
}
