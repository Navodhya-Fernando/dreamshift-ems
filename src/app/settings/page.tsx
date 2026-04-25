"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Shield, User, Calendar, Link as LinkIcon, Bell, Palette, KeyRound, Save } from 'lucide-react';
import DataStatusBanner from '@/components/ui/DataStatusBanner';
import { useCachedApi } from '@/lib/useCachedApi';
import { toastError, toastSuccess } from '@/lib/toast';
import './settings.css';

type SettingsPayload = {
  user: {
    name: string;
    email: string;
    designation?: string;
    role: 'EMPLOYEE' | 'WORKSPACE_ADMIN' | 'ADMIN' | 'Admin' | 'OWNER';
    dateJoined?: string;
    linkedinProfileUrl?: string;
    linkedinProfilePicUrl?: string;
    notificationPreferences?: {
      emailNotifications?: boolean;
      taskReminders?: boolean;
      deadlineAlerts?: boolean;
      weeklyDigest?: boolean;
      dailySummaryTime?: string;
      dailySummaryTimezone?: string;
      messageNotifications?: boolean;
    };
    appearancePreferences?: {
      theme?: 'SYSTEM' | 'LIGHT' | 'DARK';
      density?: 'COMFORTABLE' | 'COMPACT';
      reduceMotion?: boolean;
    };
  };
};

export default function SettingsPage() {
  const { data, loading, error, lastUpdated, isRefreshing, refresh } = useCachedApi<SettingsPayload | null>({
    cacheKey: 'settings-me-v1',
    initialData: null,
    fetcher: async () => {
      const res = await fetch('/api/users/me', { cache: 'no-store' });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Unable to load settings');
      return json.data as SettingsPayload;
    },
    ttlMs: 90_000,
  });

  const [contactForm, setContactForm] = useState({
    email: '',
    linkedinProfileUrl: '',
    linkedinProfilePicUrl: '',
  });
  const [notificationsForm, setNotificationsForm] = useState({
    emailNotifications: true,
    taskReminders: true,
    deadlineAlerts: true,
    weeklyDigest: false,
    dailySummaryTime: '07:45',
    dailySummaryTimezone: 'Asia/Kolkata',
    messageNotifications: true,
  });
  const [appearanceForm, setAppearanceForm] = useState({
    theme: 'SYSTEM' as 'SYSTEM' | 'LIGHT' | 'DARK',
    density: 'COMFORTABLE' as 'COMFORTABLE' | 'COMPACT',
    reduceMotion: false,
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [saving, setSaving] = useState<'none' | 'contact' | 'notifications' | 'appearance' | 'password'>('none');

  useEffect(() => {
    if (!data?.user) return;
    setContactForm({
      email: data.user.email || '',
      linkedinProfileUrl: data.user.linkedinProfileUrl || '',
      linkedinProfilePicUrl: data.user.linkedinProfilePicUrl || '',
    });
    setNotificationsForm({
      emailNotifications: Boolean(data.user.notificationPreferences?.emailNotifications ?? true),
      taskReminders: Boolean(data.user.notificationPreferences?.taskReminders ?? true),
      deadlineAlerts: Boolean(data.user.notificationPreferences?.deadlineAlerts ?? true),
      weeklyDigest: Boolean(data.user.notificationPreferences?.weeklyDigest ?? false),
      dailySummaryTime: data.user.notificationPreferences?.dailySummaryTime || '07:45',
      dailySummaryTimezone: data.user.notificationPreferences?.dailySummaryTimezone || 'Asia/Kolkata',
      messageNotifications: Boolean(data.user.notificationPreferences?.messageNotifications ?? true),
    });
    setAppearanceForm({
      theme: (data.user.appearancePreferences?.theme || 'SYSTEM') as 'SYSTEM' | 'LIGHT' | 'DARK',
      density: (data.user.appearancePreferences?.density || 'COMFORTABLE') as 'COMFORTABLE' | 'COMPACT',
      reduceMotion: Boolean(data.user.appearancePreferences?.reduceMotion ?? false),
    });
  }, [data]);

  const patchSettings = async (payload: Record<string, unknown>, bucket: 'contact' | 'notifications' | 'appearance' | 'password') => {
    setSaving(bucket);
    try {
      const res = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to save settings');
      toastSuccess('Settings updated');
      if (bucket === 'password') {
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      }
      await refresh();
    } catch (err: unknown) {
      toastError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving('none');
    }
  };

  return (
    <div className="page-wrapper animate-in settings-page">
      <nav className="breadcrumb" style={{ marginBottom: 14 }}>
        <span>DreamShift</span>
        <ChevronRight size={13} />
        <span className="breadcrumb-active">Settings</span>
      </nav>

      <div className="card settings-header">
        <div>
          <h1>Account Settings</h1>
          <p>Update account security, communication preferences, and profile links.</p>
        </div>
        <span className="badge">Self service</span>
      </div>

      <DataStatusBanner
        loading={loading}
        error={error}
        lastUpdated={lastUpdated}
        isRefreshing={isRefreshing}
        onRetry={refresh}
        onRefresh={refresh}
      />

      <div className="settings-grid">
        <section className="card settings-card">
          <div className="settings-card-title"><User size={15} /> Profile & Contact</div>
          <div className="settings-row"><span>Name</span><strong>{data?.user.name || '—'}</strong></div>
          <label className="settings-field">
            <span>Email address</span>
            <input className="input" value={contactForm.email} onChange={(e) => setContactForm((prev) => ({ ...prev, email: e.target.value }))} />
          </label>
          <label className="settings-field">
            <span>LinkedIn profile URL</span>
            <input className="input" value={contactForm.linkedinProfileUrl} onChange={(e) => setContactForm((prev) => ({ ...prev, linkedinProfileUrl: e.target.value }))} placeholder="https://www.linkedin.com/in/username" />
          </label>
          <label className="settings-field">
            <span>LinkedIn profile image URL</span>
            <input className="input" value={contactForm.linkedinProfilePicUrl} onChange={(e) => setContactForm((prev) => ({ ...prev, linkedinProfilePicUrl: e.target.value }))} placeholder="https://media.licdn.com/..." />
          </label>
          <div className="settings-actions-inline">
            <button className="btn btn-primary" disabled={saving !== 'none'} onClick={() => patchSettings(contactForm, 'contact')}>
              <Save size={13} /> {saving === 'contact' ? 'Saving...' : 'Save Contact'}
            </button>
          </div>
        </section>

        <section className="card settings-card">
          <div className="settings-card-title"><Bell size={15} /> Notification Preferences</div>
          {[
            ['emailNotifications', 'Email notifications'],
            ['taskReminders', 'Task reminders'],
            ['deadlineAlerts', 'Deadline alerts'],
            ['weeklyDigest', 'Weekly digest'],
            ['messageNotifications', 'Message notifications'],
          ].map(([key, label]) => (
            <label key={key} className="settings-toggle-row">
              <span>{label}</span>
              <input
                type="checkbox"
                checked={Boolean(notificationsForm[key as keyof typeof notificationsForm])}
                onChange={(e) => setNotificationsForm((prev) => ({ ...prev, [key]: e.target.checked }))}
              />
            </label>
          ))}
          <div className="settings-actions-inline">
            <button className="btn btn-primary" disabled={saving !== 'none'} onClick={() => patchSettings({ notificationPreferences: notificationsForm }, 'notifications')}>
              <Save size={13} /> {saving === 'notifications' ? 'Saving...' : 'Save Notifications'}
            </button>
          </div>
          <label className="settings-field" style={{ marginTop: 10 }}>
            <span>Daily task summary time</span>
            <input
              className="input"
              type="time"
              value={notificationsForm.dailySummaryTime}
              onChange={(e) => setNotificationsForm((prev) => ({ ...prev, dailySummaryTime: e.target.value }))}
            />
          </label>
          <div className="text-xs text-muted" style={{ marginTop: 8 }}>
            Sent in {notificationsForm.dailySummaryTimezone || 'Asia/Kolkata'} every morning when you have assigned tasks.
          </div>
        </section>

        <section className="card settings-card">
          <div className="settings-card-title"><Palette size={15} /> Appearance</div>
          <label className="settings-field">
            <span>Theme</span>
            <select className="input" value={appearanceForm.theme} onChange={(e) => setAppearanceForm((prev) => ({ ...prev, theme: e.target.value as 'SYSTEM' | 'LIGHT' | 'DARK' }))}>
              <option value="SYSTEM">System</option>
              <option value="LIGHT">Light</option>
              <option value="DARK">Dark</option>
            </select>
          </label>
          <label className="settings-field">
            <span>Density</span>
            <select className="input" value={appearanceForm.density} onChange={(e) => setAppearanceForm((prev) => ({ ...prev, density: e.target.value as 'COMFORTABLE' | 'COMPACT' }))}>
              <option value="COMFORTABLE">Comfortable</option>
              <option value="COMPACT">Compact</option>
            </select>
          </label>
          <label className="settings-toggle-row">
            <span>Reduce motion effects</span>
            <input type="checkbox" checked={appearanceForm.reduceMotion} onChange={(e) => setAppearanceForm((prev) => ({ ...prev, reduceMotion: e.target.checked }))} />
          </label>
          <div className="settings-actions-inline">
            <button className="btn btn-primary" disabled={saving !== 'none'} onClick={() => patchSettings({ appearancePreferences: appearanceForm }, 'appearance')}>
              <Save size={13} /> {saving === 'appearance' ? 'Saving...' : 'Save Appearance'}
            </button>
          </div>
        </section>

        <section className="card settings-card">
          <div className="settings-card-title"><KeyRound size={15} /> Security</div>
          <label className="settings-field">
            <span>Current password</span>
            <input className="input" type="password" value={passwordForm.currentPassword} onChange={(e) => setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))} />
          </label>
          <label className="settings-field">
            <span>New password</span>
            <input className="input" type="password" value={passwordForm.newPassword} onChange={(e) => setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))} />
          </label>
          <label className="settings-field">
            <span>Confirm new password</span>
            <input className="input" type="password" value={passwordForm.confirmPassword} onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))} />
          </label>
          <div className="settings-actions-inline">
            <button
              className="btn btn-primary"
              disabled={saving !== 'none'}
              onClick={() => patchSettings(passwordForm, 'password')}
            >
              <Save size={13} /> {saving === 'password' ? 'Updating...' : 'Change Password'}
            </button>
          </div>
        </section>
      </div>

      <section className="card settings-admin-note">
        <div className="settings-card-title"><Shield size={15} /> Employment Data</div>
        <p>
          Employment records like role history and join date remain managed by workspace admins and owners.
        </p>
        <div className="settings-actions">
          <Link href="/profile" className="btn btn-secondary"><Calendar size={13} /> View Profile</Link>
          <Link href={data?.user.linkedinProfileUrl || '#'} className="btn btn-ghost" target="_blank" rel="noreferrer"><LinkIcon size={13} /> LinkedIn</Link>
          <div className="settings-role-pill">{data?.user.designation || String(data?.user.role || 'EMPLOYEE').replace('_', ' ')}</div>
        </div>
      </section>
    </div>
  );
}
