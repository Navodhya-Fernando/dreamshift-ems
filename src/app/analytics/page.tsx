"use client";

import React, { useMemo } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, BarChart2, ChevronRight, Clock3, Layers3, Radar, Sparkles, TrendingUp } from 'lucide-react';
import DataStatusBanner from '@/components/ui/DataStatusBanner';
import { useCachedApi } from '@/lib/useCachedApi';
import './analytics.css';

const WEEK_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

type PersonalAnalytics = {
  trend7: number[];
  statusBreakdown: {
    done: number;
    inProgress: number;
    todo: number;
    blocked: number;
    inReview: number;
  };
  overdue: number;
  dueNext7: number;
  completionProbability: number;
  workloadPressure: number;
  focusScore: number;
};

type DashboardTask = {
  _id: string;
  title: string;
  dueDate?: string;
  status: string;
  projectName: string;
};

type DashboardResponse = {
  kpi: { active: number; completion: number; hours: string; overdue: number };
  myTasks: DashboardTask[];
  upcoming: Array<{ id: string; title: string; dueDate?: string; status: string; projectName: string }>;
  activity: Array<{ id: string; msg: string; time: string; color: string }>;
  insights: { completionProbability: number; burnoutRiskScore: number; burnoutRiskLabel: string };
};

type ProfileResponse = {
  user: { name: string; role: 'EMPLOYEE' | 'WORKSPACE_ADMIN' | 'ADMIN' | 'Admin' | 'OWNER'; designation?: string };
  stats: { totalTasks: number; doneTasks: number; completionRate: number; trackedHours: number; workspaces: number };
  analytics: PersonalAnalytics;
  activity: Array<{ id: string; msg: string; time: string; color: string }>;
};

type WorkspaceReport = {
  workspaceId: string;
  workspaceName: string;
  projects: number;
  tasks: number;
  completionRate: number;
  members: number;
  overdueTasks: number;
};

type EmployeeReport = {
  userId: string;
  name: string;
  designation: string;
  totalAssigned: number;
  completionRate: number;
  averageTimeSpentHours: number;
};

type AdminReportsPayload = {
  generatedAt: string;
  workspaceReports: WorkspaceReport[];
  employeeReports: EmployeeReport[];
};

type AnalyticsResponse = {
  profile: ProfileResponse;
  dashboard: DashboardResponse;
  reports?: AdminReportsPayload;
};

function scoreTag(score: number) {
  if (score >= 75) return { label: 'Healthy', color: '#10B981', bg: 'rgba(16,185,129,0.14)' };
  if (score >= 50) return { label: 'Watch', color: '#F59E0B', bg: 'rgba(245,158,11,0.14)' };
  return { label: 'At Risk', color: '#EF4444', bg: 'rgba(239,68,68,0.14)' };
}

function clampPercentage(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export default function IntelligenceSuite() {
  const {
    data,
    loading,
    error,
    lastUpdated,
    isRefreshing,
    refresh,
  } = useCachedApi<AnalyticsResponse>({
    cacheKey: 'analytics-suite-personal-v1',
    initialData: {
      profile: {
        user: { name: 'You', role: 'EMPLOYEE' },
        stats: { totalTasks: 0, doneTasks: 0, completionRate: 0, trackedHours: 0, workspaces: 0 },
        analytics: {
          trend7: [0, 0, 0, 0, 0, 0, 0],
          statusBreakdown: { done: 0, inProgress: 0, todo: 0, blocked: 0, inReview: 0 },
          overdue: 0,
          dueNext7: 0,
          completionProbability: 0,
          workloadPressure: 0,
          focusScore: 0,
        },
        activity: [],
      },
      dashboard: {
        kpi: { active: 0, completion: 0, hours: '0.0h', overdue: 0 },
        myTasks: [],
        upcoming: [],
        activity: [],
        insights: { completionProbability: 0, burnoutRiskScore: 0, burnoutRiskLabel: 'Low' },
      },
      reports: undefined,
    },
    fetcher: async () => {
      const meRes = await fetch('/api/users/me', { cache: 'no-store' });
      const meJson = await meRes.json();
      if (!meJson.success) throw new Error(meJson.error || 'Failed to load analytics profile');

      const dashboardRes = await fetch('/api/dashboard', { cache: 'no-store' });
      const dashboardJson = await dashboardRes.json();
      if (!dashboardJson.success) throw new Error(dashboardJson.error || 'Failed to load dashboard data');

      const profile = meJson.data as ProfileResponse;
      let reports: AdminReportsPayload | undefined;

      if (profile.user.role !== 'EMPLOYEE') {
        const reportsRes = await fetch('/api/admin/reports', { cache: 'no-store' });
        const reportsJson = await reportsRes.json();
        if (reportsJson.success) {
          reports = reportsJson.data as AdminReportsPayload;
        }
      }

      return {
        profile,
        dashboard: dashboardJson.data as DashboardResponse,
        reports,
      };
    },
    ttlMs: 90000,
  });

  const profile = data.profile;
  const dashboard = data.dashboard;
  const reports = data.reports;

  const firstName = profile.user.name?.split(' ')[0] || 'there';
  const trend7 = profile.analytics.trend7 || [0, 0, 0, 0, 0, 0, 0];
  const trendPeak = Math.max(1, ...trend7);

  const statusItems = [
    { label: 'Done', value: profile.analytics.statusBreakdown.done, color: '#10B981' },
    { label: 'In Progress', value: profile.analytics.statusBreakdown.inProgress, color: '#F59E0B' },
    { label: 'To Do', value: profile.analytics.statusBreakdown.todo, color: '#60A5FA' },
    { label: 'In Review', value: profile.analytics.statusBreakdown.inReview, color: '#A78BFA' },
    { label: 'Blocked', value: profile.analytics.statusBreakdown.blocked, color: '#EF4444' },
  ];

  const personalSignals = useMemo(() => {
    const signals: Array<{ title: string; value: string; tone: 'good' | 'warn' | 'bad'; detail: string }> = [];

    signals.push({
      title: 'Completion Probability',
      value: `${clampPercentage(profile.analytics.completionProbability)}%`,
      tone: profile.analytics.completionProbability >= 70 ? 'good' : profile.analytics.completionProbability >= 45 ? 'warn' : 'bad',
      detail: 'Based on your current completion rate, overdue load, and velocity.',
    });
    signals.push({
      title: 'Workload Pressure',
      value: `${clampPercentage(profile.analytics.workloadPressure)}/100`,
      tone: profile.analytics.workloadPressure < 40 ? 'good' : profile.analytics.workloadPressure < 70 ? 'warn' : 'bad',
      detail: 'Higher values mean more open work and overdue pressure.',
    });
    signals.push({
      title: 'Focus Score',
      value: `${clampPercentage(profile.analytics.focusScore)}/100`,
      tone: profile.analytics.focusScore >= 70 ? 'good' : profile.analytics.focusScore >= 45 ? 'warn' : 'bad',
      detail: 'A cleaner signal for how much room you have this week.',
    });
    signals.push({
      title: 'Due This Week',
      value: `${profile.analytics.dueNext7}`, 
      tone: profile.analytics.dueNext7 <= 3 ? 'good' : profile.analytics.dueNext7 <= 6 ? 'warn' : 'bad',
      detail: 'Tasks needing attention in the next seven days.',
    });

    return signals;
  }, [profile.analytics]);

  const adminTopWorkspaces = (reports?.workspaceReports || []).slice(0, 4);
  const adminTopPeople = (reports?.employeeReports || []).slice(0, 5);

  return (
    <div className="page-wrapper animate-in analytics-page-clean">
      <header className="analytics-hero card">
        <div className="analytics-hero-copy">
          <nav className="breadcrumb" style={{ marginBottom: 10 }}>
            <span>DreamShift</span>
            <ChevronRight size={13} />
            <span className="breadcrumb-active">Analytics</span>
          </nav>
          <h1 className="page-title" style={{ marginBottom: 8 }}>Good to see you, {firstName}</h1>
          <p className="analytics-hero-subtitle">
            Your personal delivery dashboard. Focused on what you own, what is due, and where attention is needed next.
          </p>
          <div className="analytics-hero-meta">
            <span className="badge">{profile.user.role.replace('_', ' ')}</span>
            <span className="analytics-meta-pill">{profile.stats.workspaces} workspaces</span>
            <span className="analytics-meta-pill">{profile.stats.totalTasks} assigned tasks</span>
            <span className="analytics-meta-pill">{profile.stats.trackedHours}h tracked</span>
          </div>
        </div>
        <div className="analytics-hero-actions">
          <button className="btn btn-secondary" type="button" onClick={refresh} disabled={isRefreshing}>Refresh</button>
          <Link className="btn btn-primary" href="/tasks">
            Open My Tasks <ArrowRight size={14} />
          </Link>
        </div>
      </header>

      <DataStatusBanner
        loading={loading}
        error={error}
        lastUpdated={lastUpdated}
        isRefreshing={isRefreshing}
        onRetry={refresh}
        onRefresh={refresh}
      />

      <section className="analytics-kpis">
        {[
          { label: 'Assigned', value: profile.stats.totalTasks, icon: Layers3, color: '#5B6BF8' },
          { label: 'Completion', value: `${profile.stats.completionRate}%`, icon: TrendingUp, color: '#10B981' },
          { label: 'Overdue', value: profile.analytics.overdue, icon: AlertTriangle, color: '#EF4444' },
          { label: 'Due Soon', value: profile.analytics.dueNext7, icon: Clock3, color: '#F59E0B' },
          { label: 'Focus Score', value: `${clampPercentage(profile.analytics.focusScore)}`, icon: Sparkles, color: '#A78BFA' },
          { label: 'Hours Logged', value: `${profile.stats.trackedHours}h`, icon: BarChart2, color: '#06B6D4' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="analytics-kpi card">
            <div className="kpi-icon" style={{ background: `${color}1A`, color }}>
              <Icon size={18} />
            </div>
            <div>
              <div className="kpi-value">{value}</div>
              <div className="kpi-label">{label}</div>
            </div>
          </div>
        ))}
      </section>

      <section className="analytics-layout">
        <div className="analytics-column-main">
          <div className="analytics-panel card">
            <div className="analytics-panel-header">
              <div>
                <div className="card-title">Your cadence</div>
                <div className="card-subtitle">Completed tasks over the last seven days</div>
              </div>
              <span className="analytics-panel-chip">{dashboard.insights.burnoutRiskLabel} risk</span>
            </div>
            <div className="analytics-trend">
              {trend7.map((value, index) => (
                <div key={`${index}-${value}`} className="analytics-trend-col">
                  <div className="analytics-trend-track">
                    <div className="analytics-trend-fill" style={{ height: `${(value / trendPeak) * 100}%` }} />
                  </div>
                  <div className="analytics-trend-value">{value}</div>
                  <div className="analytics-trend-label">{WEEK_LABELS[index]}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="analytics-panel card">
            <div className="analytics-panel-header">
              <div>
                <div className="card-title">Status split</div>
                <div className="card-subtitle">The shape of your current workload</div>
              </div>
              <span className="analytics-panel-chip">{profile.stats.doneTasks} done</span>
            </div>
            <div className="analytics-status-list">
              {statusItems.map((item) => (
                <div key={item.label} className="analytics-status-row">
                  <div className="analytics-status-label">{item.label}</div>
                  <div className="analytics-status-meter">
                    <div className="analytics-status-track">
                      <div
                        className="analytics-status-fill"
                        style={{ width: `${profile.stats.totalTasks ? Math.round((item.value / profile.stats.totalTasks) * 100) : 0}%`, background: item.color }}
                      />
                    </div>
                  </div>
                  <div className="analytics-status-value">{item.value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="analytics-panel card">
            <div className="analytics-panel-header">
              <div>
                <div className="card-title">My tasks</div>
                <div className="card-subtitle">A clean list of what is assigned to you right now</div>
              </div>
              <Link className="btn btn-ghost text-sm" href="/tasks">View all</Link>
            </div>
            <div className="analytics-task-list">
              {dashboard.myTasks.length === 0 ? (
                <div className="analytics-empty">No assigned tasks found.</div>
              ) : (
                dashboard.myTasks.slice(0, 6).map((task) => (
                  <Link key={task._id} href={`/tasks/${task._id}`} className="analytics-task-row">
                    <div>
                      <div className="analytics-task-title">{task.title}</div>
                      <div className="analytics-task-subtitle">{task.projectName}</div>
                    </div>
                    <div className="analytics-task-meta">
                      <span className="analytics-task-date">{task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No due date'}</span>
                      <span className={`badge badge-${task.status === 'done' ? 'done' : task.status === 'in_progress' ? 'doing' : 'todo'}`}>
                        {task.status === 'in_progress' ? 'In Progress' : task.status === 'done' ? 'Done' : 'To Do'}
                      </span>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>

        <aside className="analytics-column-side">
          <div className="analytics-panel card">
            <div className="analytics-panel-header">
              <div>
                <div className="card-title">Focus now</div>
                <div className="card-subtitle">What deserves attention first</div>
              </div>
              <Radar size={16} color="#5B6BF8" />
            </div>
            <div className="analytics-signal-list">
              {personalSignals.map((signal) => (
                <div key={signal.title} className="analytics-signal-row">
                  <div className="analytics-signal-top">
                    <div className="analytics-signal-title">{signal.title}</div>
                    <span className={`analytics-signal-pill ${signal.tone}`}>{signal.value}</span>
                  </div>
                  <div className="analytics-signal-detail">{signal.detail}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="analytics-panel card">
            <div className="analytics-panel-header">
              <div>
                <div className="card-title">Upcoming deadlines</div>
                <div className="card-subtitle">Tasks due soon on your schedule</div>
              </div>
            </div>
            <div className="analytics-deadline-list">
              {dashboard.upcoming.length === 0 ? (
                <div className="analytics-empty">You have no near-term deadlines.</div>
              ) : dashboard.upcoming.map((item) => (
                <div key={item.id} className="analytics-deadline-row">
                  <div>
                    <div className="analytics-task-title">{item.title}</div>
                    <div className="analytics-task-subtitle">{item.projectName}</div>
                  </div>
                  <div className="analytics-deadline-meta">
                    <span className="analytics-task-date">{item.dueDate ? new Date(item.dueDate).toLocaleDateString() : '—'}</span>
                    <span className="badge">{item.status === 'in_progress' ? 'In Progress' : item.status === 'done' ? 'Done' : 'To Do'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="analytics-panel card">
            <div className="analytics-panel-header">
              <div>
                <div className="card-title">Recent activity</div>
                <div className="card-subtitle">Latest events from your workspace</div>
              </div>
            </div>
            <div className="analytics-activity-list">
              {(dashboard.activity || []).length === 0 ? (
                <div className="analytics-empty">No recent activity.</div>
              ) : dashboard.activity.slice(0, 5).map((item) => (
                <div key={item.id} className="analytics-activity-row">
                  <div className="activity-dot" style={{ background: item.color }} />
                  <div>
                    <div className="analytics-activity-msg">{item.msg}</div>
                    <div className="analytics-activity-time">{item.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </section>

      {reports && (
        <section className="analytics-admin card">
          <div className="analytics-panel-header">
            <div>
              <div className="card-title">Admin comparison</div>
              <div className="card-subtitle">Workspace and team overview for deeper context</div>
            </div>
            <span className="badge">Admin view</span>
          </div>

          <div className="analytics-admin-grid">
            <div className="analytics-admin-block">
              <div className="analytics-admin-block-title">Workspace pulse</div>
              <div className="analytics-admin-table">
                <div className="analytics-admin-head"><span>Workspace</span><span>Projects</span><span>Tasks</span><span>Completion</span><span>Overdue</span></div>
                {adminTopWorkspaces.map((workspace) => (
                  <div key={workspace.workspaceId} className="analytics-admin-row">
                    <span className="analytics-admin-name">{workspace.workspaceName}</span>
                    <span>{workspace.projects}</span>
                    <span>{workspace.tasks}</span>
                    <span>{workspace.completionRate}%</span>
                    <span>{workspace.overdueTasks}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="analytics-admin-block">
              <div className="analytics-admin-block-title">Team pulse</div>
              <div className="analytics-admin-table">
                <div className="analytics-admin-head"><span>Member</span><span>Assigned</span><span>Completion</span><span>Avg Time</span></div>
                {adminTopPeople.map((person) => {
                  const tag = scoreTag(person.completionRate);
                  return (
                    <div key={person.userId} className="analytics-admin-row analytics-admin-row-4">
                      <span className="analytics-admin-name">{person.name}</span>
                      <span>{person.totalAssigned}</span>
                      <span>{person.completionRate}%</span>
                      <span>{person.averageTimeSpentHours}h</span>
                      <span className="badge" style={{ background: tag.bg, color: tag.color }}>{tag.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
