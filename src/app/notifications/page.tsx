"use client";

import React from 'react';
import Link from 'next/link';
import { Bell, CheckCheck, Clock, Inbox, Sparkles, ArrowRight } from 'lucide-react';
import { useCachedApi } from '@/lib/useCachedApi';
import './page.css';

type NotificationItem = {
  id: string;
  type: 'assignment' | 'mention' | 'deadline' | 'system';
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
};

type NotificationPayload = {
  items: NotificationItem[];
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

function typeLabel(type: NotificationItem['type']) {
  if (type === 'assignment') return 'Assignment';
  if (type === 'mention') return 'Mention';
  if (type === 'deadline') return 'Deadline';
  return 'System';
}

export default function NotificationsPage() {
  const { data, loading, refresh, setData } = useCachedApi<NotificationPayload>({
    cacheKey: 'notifications:page',
    initialData: { items: [], unreadCount: 0 },
    fetcher: async () => {
      const response = await fetch('/api/notifications?limit=100', { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Failed to load notifications');
      return payload.data as NotificationPayload;
    },
    ttlMs: 30_000,
  });

  const markAllRead = async () => {
    const response = await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markAll: true }),
    });

    if (!response.ok) return;

    setData({
      ...data,
      unreadCount: 0,
      items: data.items.map((item) => ({ ...item, isRead: true })),
    });
  };

  const markOneRead = async (id: string) => {
    const response = await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationId: id }),
    });

    if (!response.ok) return;

    setData({
      ...data,
      unreadCount: Math.max(0, data.unreadCount - 1),
      items: data.items.map((item) => (item.id === id ? { ...item, isRead: true } : item)),
    });
  };

  const unreadItems = data.items.filter((item) => !item.isRead).length;
  const mentionCount = data.items.filter((item) => item.type === 'mention').length;
  const assignmentCount = data.items.filter((item) => item.type === 'assignment').length;

  return (
    <div className="page-wrapper notifications-page">
      <div className="notifications-hero card">
        <div className="notifications-hero-copy">
          <div className="notifications-kicker">Activity feed</div>
          <h1 className="page-title notifications-title">Notifications</h1>
          <p className="text-muted notifications-subtitle">Your assignment updates, mentions, and system alerts in one place.</p>
          <div className="notifications-summary">
            <span className="notif-pill"><Bell size={14} /> {unreadItems} unread</span>
            <span className="notif-pill"><Inbox size={14} /> {data.items.length} total</span>
            <span className="notif-pill"><Sparkles size={14} /> {mentionCount} mentions</span>
            <span className="notif-pill"><ArrowRight size={14} /> {assignmentCount} assignments</span>
          </div>
        </div>
        <div className="notifications-hero-actions">
          <span className="notif-pill"><Bell size={14} /> {data.unreadCount} unread</span>
          <button className="btn btn-secondary" onClick={refresh}>Refresh</button>
          <button className="btn btn-primary" onClick={markAllRead} disabled={!data.unreadCount}>
            <CheckCheck size={14} /> Mark all read
          </button>
        </div>
      </div>

      <div className="notifications-feed card">
        {loading && <div className="notifications-empty">Loading notifications...</div>}
        {!loading && data.items.length === 0 && (
          <div className="notifications-empty-state">
            <div className="notifications-empty-icon"><Bell size={22} /></div>
            <div className="notifications-empty-title">No notifications yet</div>
            <p className="notifications-empty-copy">You’ll see assignments, mentions, and system alerts here as soon as they happen.</p>
            <div className="notifications-empty-actions">
              <Link className="btn btn-secondary" href="/tasks">Open tasks <ArrowRight size={14} /></Link>
              <Link className="btn btn-secondary" href="/calendar">Open calendar <ArrowRight size={14} /></Link>
            </div>
          </div>
        )}

        {!loading && data.items.map((item) => (
          <div key={item.id} className={`notif-row ${item.isRead ? 'is-read' : 'is-unread'}`}>
            <div className={`notif-accent type-${item.type}`} />
            <div className="notif-row-main">
              <div className="notif-row-head">
                <span className="notif-type">{typeLabel(item.type)}</span>
                <span className="notif-time"><Clock size={12} /> {formatRelativeTime(item.createdAt)}</span>
              </div>
              <div className="notif-title">{item.title}</div>
              <div className="notif-message">{item.message}</div>
            </div>

            <div className="notif-row-actions">
              {!item.isRead && (
                <button className="btn btn-secondary" onClick={() => markOneRead(item.id)}>
                  Mark read
                </button>
              )}
              {item.link && (
                <Link className="btn btn-primary" href={item.link}>
                  Open
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
