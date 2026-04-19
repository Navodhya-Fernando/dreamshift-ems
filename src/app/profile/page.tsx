"use client";

import React, { useMemo } from 'react';
import Image from 'next/image';
import { signOut } from 'next-auth/react';
import { Mail, Shield, Calendar, CheckSquare, Clock, TrendingUp, Activity, LogOut, ChevronRight, Building2, Link as LinkIcon, Briefcase, AlertCircle } from 'lucide-react';
import DataStatusBanner from '@/components/ui/DataStatusBanner';
import { formatDisplayDate } from '@/lib/date';
import { useCachedApi } from '@/lib/useCachedApi';
import './profile.css';

type ProfileResponse = {
  user: {
    name: string;
    email: string;
    image?: string;
    designation?: string;
    role: 'EMPLOYEE' | 'WORKSPACE_ADMIN' | 'ADMIN' | 'Admin' | 'OWNER';
    dateJoined?: string;
    contractExpiry?: string;
    linkedinProfileUrl?: string;
    linkedinProfilePicUrl?: string;
  };
  contractRemainingDays: number | null;
  stats: {
    totalTasks: number;
    doneTasks: number;
    completionRate: number;
    trackedHours: number;
    workspaces: number;
  };
  analytics?: {
    trend7?: number[];
    statusBreakdown?: {
      done: number;
      inProgress: number;
      todo: number;
      blocked: number;
      inReview: number;
    };
    overdue?: number;
    dueNext7?: number;
    completionProbability?: number;
    workloadPressure?: number;
    focusScore?: number;
  };
  employmentHistory?: Array<{
    title: string;
    startedAt: string;
    endedAt?: string | null;
    note?: string;
  }>;
  memberships: Array<{ id: string; role: string; workspace: { name?: string } }>;
  activity: Array<{ id: string; msg: string; time: string; color: string }>;
};

function formatTenure(joinedAt?: string) {
  if (!joinedAt) return 'Not available';
  const start = new Date(joinedAt);
  if (Number.isNaN(start.getTime())) return 'Not available';

  const now = new Date();
  let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (now.getDate() < start.getDate()) months -= 1;
  months = Math.max(0, months);

  const years = Math.floor(months / 12);
  const remMonths = months % 12;
  if (years === 0) return `${remMonths} month${remMonths === 1 ? '' : 's'}`;
  if (remMonths === 0) return `${years} year${years === 1 ? '' : 's'}`;
  return `${years}y ${remMonths}m`;
}

export default function ProfilePage() {
  const {
    data,
    loading,
    error,
    lastUpdated,
    isRefreshing,
    refresh,
  } = useCachedApi<ProfileResponse | null>({
    cacheKey: 'profile-me-v1',
    initialData: null,
    fetcher: async () => {
      const res = await fetch('/api/users/me', { cache: 'no-store' });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Unable to load profile');
      return json.data as ProfileResponse;
    },
    ttlMs: 120000,
  });

  const initials = useMemo(() => {
    const name = data?.user?.name;
    if (!name) return 'U';
    return name.split(' ').map((part) => part[0]).join('').toUpperCase().slice(0, 2);
  }, [data?.user?.name]);

  if (loading && !data) return <div className="page-wrapper">Loading profile...</div>;
  if (!data) return <div className="page-wrapper">Unable to load profile.</div>;

  const currentRole = data.user.designation || data.user.role.replace('_', ' ');
  const tenureLabel = formatTenure(data.user.dateJoined);
  const roleHistory = (data.employmentHistory || []).slice().sort((left, right) => new Date(left.startedAt).getTime() - new Date(right.startedAt).getTime());
  const analytics = data.analytics || {};
  const remainingDays = data.contractRemainingDays;
  const profileAvatar = data.user.linkedinProfilePicUrl || data.user.image || '';

  const insightCards = [
    {
      icon: TrendingUp,
      label: 'Completion Forecast',
      value: `${Math.round(analytics.completionProbability || 0)}%`,
      hint: 'Chance of closing current work on time.',
      color: '#10B981',
    },
    {
      icon: Activity,
      label: 'Focus Score',
      value: `${Math.round(analytics.focusScore || 0)} / 100`,
      hint: 'Higher means healthier workload spread.',
      color: '#5B6BF8',
    },
    {
      icon: AlertCircle,
      label: 'Pressure Index',
      value: `${Math.round(analytics.workloadPressure || 0)} / 100`,
      hint: `${analytics.overdue || 0} overdue, ${analytics.dueNext7 || 0} due this week`,
      color: '#F59E0B',
    },
  ];

  return (
    <div className="page-wrapper animate-in">
      <nav className="breadcrumb" style={{ marginBottom: 20 }}>
        <span>DreamShift</span>
        <ChevronRight size={13} />
        <span className="breadcrumb-active">Profile</span>
      </nav>

      <div className="profile-toolbar">
        <DataStatusBanner
          loading={loading}
          error={error}
          lastUpdated={lastUpdated}
          isRefreshing={isRefreshing}
          onRetry={refresh}
          onRefresh={refresh}
        />
      </div>

      <div className="card" style={{ padding: 12, marginBottom: 14, borderColor: 'rgba(96,165,250,0.32)' }}>
        <div className="text-sm" style={{ color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Shield size={14} /> Profile details are managed by workspace admins/owners via the admin console.
        </div>
      </div>

      <div className="profile-layout">
        <div className="profile-left">
          <div className="card profile-id-card">
            <div className="profile-avatar-wrap">
              {profileAvatar ? (
                <Image
                  src={profileAvatar}
                  alt={`${data.user.name} profile`}
                  className="profile-avatar-image"
                  width={112}
                  height={112}
                  unoptimized
                />
              ) : (
                <div className="profile-avatar">{initials}</div>
              )}
              <div className="profile-status-dot" />
            </div>
            <div className="profile-name">{data.user.name}</div>
            <div className="profile-role">{currentRole}</div>
            <div className="profile-tenure">Time at DreamShift: {tenureLabel}</div>

            <div className="profile-info-rows">
              <div className="profile-info-row"><Mail size={13} /><span>{data.user.email}</span></div>
              <div className="profile-info-row"><Shield size={13} /><span>{data.user.role.replace('_', ' ')} · Access profile</span></div>
              <div className="profile-info-row"><Calendar size={13} /><span>{data.user.dateJoined ? `Joined ${formatDisplayDate(data.user.dateJoined)}` : 'Join date unavailable'}</span></div>
              {data.user.linkedinProfileUrl && (
                <a className="profile-info-row" href={data.user.linkedinProfileUrl} target="_blank" rel="noreferrer">
                  <LinkIcon size={13} /><span>LinkedIn Profile</span>
                </a>
              )}
            </div>

            <div className="profile-card-actions">
              <button className="btn btn-ghost w-full justify-center" style={{ color: '#EF4444' }} onClick={() => signOut()}>
                <LogOut size={13} /> Sign out
              </button>
            </div>
          </div>

          <div className="card contract-card">
            <div className="contract-header">
              <div className="section-title">Contract Status</div>
              <span className={`badge ${remainingDays !== null && remainingDays < 30 ? 'badge-blocked' : 'badge-done'}`}>
                {remainingDays !== null && remainingDays < 30 ? 'Expiring Soon' : 'Active'}
              </span>
            </div>
            <div className="contract-date">
              {data.user.contractExpiry ? formatDisplayDate(data.user.contractExpiry) : 'Not Set'}
            </div>
            <div className="text-xs text-muted" style={{ marginTop: 4 }}>
              {remainingDays !== null ? `${remainingDays} days remaining` : 'No contract expiry date configured'}
            </div>
            <div className="contract-bar-track" style={{ marginTop: 10 }}>
              <div className="contract-bar-fill" style={{ width: `${remainingDays !== null ? Math.min(100, Math.max(8, (remainingDays / 365) * 100)) : 20}%` }} />
            </div>
          </div>
        </div>

        <div className="profile-right">
          <div className="profile-kpi-row">
            {[
              { icon: CheckSquare, label: 'Tasks Assigned', value: data.stats.totalTasks, color: '#5B6BF8' },
              { icon: TrendingUp, label: 'Completion Rate', value: `${data.stats.completionRate}%`, color: '#10B981' },
              { icon: Clock, label: 'Hours Tracked', value: `${data.stats.trackedHours}h`, color: '#F59E0B' },
            ].map(({ icon: Icon, label, value, color }) => (
              <div key={label} className="kpi-card">
                <div className="kpi-icon" style={{ background: `${color}1A`, color }}><Icon size={16} /></div>
                <div><div className="kpi-value">{value}</div><div className="kpi-label">{label}</div></div>
              </div>
            ))}
          </div>

          <div className="card profile-panel">
            <div className="profile-panel-header" style={{ marginBottom: 16 }}>
              <div className="profile-panel-icon" style={{ background: 'rgba(16,185,129,0.12)', color: '#10B981' }}><Activity size={16} /></div>
              <div>
                <div className="profile-panel-title">Insight Summary</div>
                <div className="profile-panel-subtitle">Meaningful indicators from your current delivery workload</div>
              </div>
            </div>
            <div className="profile-insight-grid">
              {insightCards.map(({ icon: Icon, label, value, hint, color }) => (
                <div key={label} className="profile-insight-card">
                  <div className="profile-insight-top">
                    <span className="profile-insight-label">{label}</span>
                    <span className="profile-insight-icon" style={{ color }}><Icon size={14} /></span>
                  </div>
                  <div className="profile-insight-value">{value}</div>
                  <div className="text-xs text-muted">{hint}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card profile-panel">
            <div className="profile-panel-header" style={{ marginBottom: 16 }}>
              <div className="profile-panel-icon" style={{ background: 'rgba(91,107,248,0.1)', color: '#5B6BF8' }}><Briefcase size={16} /></div>
              <div>
                <div className="profile-panel-title">Employment History</div>
                <div className="profile-panel-subtitle">Role progression inside DreamShift</div>
              </div>
            </div>
            <div className="profile-history-list">
              {roleHistory.length === 0 ? (
                <div className="text-sm text-muted">No role history available yet.</div>
              ) : roleHistory.map((entry, index) => (
                <div key={`${entry.title}-${entry.startedAt}-${index}`} className="profile-history-item">
                  <div className="profile-history-dot" />
                  <div>
                    <div className="text-sm" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{entry.title}</div>
                    <div className="text-xs text-muted">
                      {`From ${formatDisplayDate(entry.startedAt)}`}
                      {entry.endedAt ? ` to ${formatDisplayDate(entry.endedAt)}` : ' to Present'}
                    </div>
                    {entry.note ? <div className="text-xs text-muted" style={{ marginTop: 4 }}>{entry.note}</div> : null}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card profile-panel">
            <div className="profile-panel-header" style={{ marginBottom: 16 }}>
              <div className="profile-panel-icon" style={{ background: 'rgba(91,107,248,0.1)', color: '#5B6BF8' }}><Building2 size={16} /></div>
              <div>
                <div className="profile-panel-title">Workspace Membership</div>
                <div className="profile-panel-subtitle">All workspaces you currently belong to</div>
              </div>
            </div>
            <div className="skill-grid">
              {(data.memberships || []).length === 0 ? (
                <div className="text-sm text-muted">No workspace memberships found.</div>
              ) : (data.memberships || []).map((membership) => (
                <div key={membership.id} className="skill-item">
                  <div className="skill-label-row">
                    <span className="text-sm" style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{membership.workspace?.name || 'Workspace'}</span>
                    <span className="badge badge-low">{membership.role.replace('_', ' ')}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card profile-panel">
            <div className="profile-panel-header" style={{ marginBottom: 14 }}>
              <div className="profile-panel-icon" style={{ background: 'rgba(59,130,246,0.12)', color: '#60A5FA' }}><Activity size={16} /></div>
              <div>
                <div className="profile-panel-title">Recent Activity</div>
                <div className="profile-panel-subtitle">Latest task and collaboration events</div>
              </div>
            </div>
            <div className="profile-activity">
              {(data.activity || []).map((item) => (
                <div key={item.id} className="profile-activity-item">
                  <div className="profile-activity-dot" style={{ background: item.color }} />
                  <div className="profile-activity-content">
                    <div className="text-sm" style={{ color: 'var(--text-primary)' }}>{item.msg}</div>
                    <div className="text-xs text-muted">{new Date(item.time).toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
