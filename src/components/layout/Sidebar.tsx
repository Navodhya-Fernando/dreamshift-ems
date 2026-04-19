"use client";

import React, { useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  Home, FolderOpen, CheckSquare, Calendar, BarChart2,
  Clock, Bell, MessageCircle, Settings, User, LogOut,
  ChevronRight, Zap, Shield, FileStack
} from 'lucide-react';
import { useCachedApi } from '@/lib/useCachedApi';
import { normalizePlatformRole } from '@/lib/roles';
import './Sidebar.css';

const NAV_MAIN = [
  { label: 'Home',       path: '/',          icon: Home },
  { label: 'Workspaces', path: '/projects',  icon: FolderOpen },
  { label: 'My Tasks',   path: '/tasks',     icon: CheckSquare },
  { label: 'Calendar',   path: '/calendar',  icon: Calendar },
  { label: 'Analytics',  path: '/analytics', icon: BarChart2 },
  { label: 'Timesheet',  path: '/time',      icon: Clock },
  { label: 'Admin',      path: '/admin',     icon: Shield },
];

const NAV_OTHER = [
  { label: 'Notifications', path: '/notifications', icon: Bell },
  { label: 'Messages', path: '/messages', icon: MessageCircle },
  { label: 'Templates', path: '/task-templates', icon: FileStack },
  { label: 'Profile',  path: '/profile',  icon: User },
  { label: 'Settings', path: '/settings', icon: Settings },
];

export default function Sidebar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const { data: notificationSummary } = useCachedApi<{ unreadCount: number; items: unknown[] }>({
    cacheKey: 'notifications:sidebar',
    initialData: { unreadCount: 0, items: [] },
    fetcher: async () => {
      const response = await fetch('/api/notifications?limit=1', { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Failed to load notifications');
      return payload.data as { unreadCount: number; items: unknown[] };
    },
    ttlMs: 20_000,
  });
  const canAccessAdmin = !session?.user?.role || ['OWNER', 'ADMIN', 'WORKSPACE_ADMIN'].includes(normalizePlatformRole(session.user.role));

  const initials = session?.user?.name
    ? session.user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  const isActive = (path: string) =>
    path === '/' ? pathname === '/' : pathname.startsWith(path);

  return (
    <div className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <Zap size={16} color="white" strokeWidth={2.5} />
        </div>
        <div>
          <div className="sidebar-logo-text">DreamShift</div>
          <div className="sidebar-logo-sub">EMS</div>
        </div>
      </div>



      {/* Navigation */}
      <nav className="sidebar-nav">
        <div className="nav-section-label">Main</div>
        {NAV_MAIN.filter((item) => item.path !== '/admin' || canAccessAdmin).map(({ label, path, icon: Icon }) => (
          <Link key={path} href={path} className={`nav-link ${isActive(path) ? 'active' : ''}`}>
            <Icon size={16} strokeWidth={isActive(path) ? 2 : 1.75} />
            {label}
          </Link>
        ))}

        <div className="nav-section-label" style={{ marginTop: 8 }}>Other</div>
        {NAV_OTHER.map(({ label, path, icon: Icon }) => {
          const resolvedBadge = path === '/notifications' ? notificationSummary.unreadCount : undefined;
          return (
          <Link key={path} href={path} className={`nav-link ${isActive(path) ? 'active' : ''}`}>
            <Icon size={16} strokeWidth={isActive(path) ? 2 : 1.75} />
            {label}
            {resolvedBadge ? <span className="nav-badge">{resolvedBadge}</span> : null}
          </Link>
          );
        })}
      </nav>

      {/* User menu */}
      <div className="sidebar-user">
        {showUserMenu && (
          <div className="user-menu">
            <Link href="/profile" className="user-menu-item" onClick={() => setShowUserMenu(false)}>
              <User size={14} /> Profile & Stats
            </Link>
            <Link href="/settings" className="user-menu-item" onClick={() => setShowUserMenu(false)}>
              <Settings size={14} /> Settings
            </Link>
            <div className="user-menu-divider" />
            <button className="user-menu-item danger" onClick={() => signOut()}>
              <LogOut size={14} /> Sign out
            </button>
          </div>
        )}

        <button className="user-card w-full" onClick={() => setShowUserMenu(v => !v)}>
          <div className="user-avatar">{initials}</div>
          <div className="user-info">
            <div className="user-name">{session?.user?.name || 'User'}</div>
            <div className="user-email">{session?.user?.email || ''}</div>
          </div>
          <ChevronRight size={13} color="var(--text-disabled)"
            style={{ transform: showUserMenu ? 'rotate(90deg)' : 'none', transition: 'transform 150ms' }} />
        </button>
      </div>
    </div>
  );
}
