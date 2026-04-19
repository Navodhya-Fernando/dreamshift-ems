"use client";

import React from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  CheckSquare, Clock, TrendingUp, AlertCircle,
  ArrowRight, Activity, BrainCircuit
} from 'lucide-react';
import Link from 'next/link';
import DataStatusBanner from '@/components/ui/DataStatusBanner';
import { useCachedApi } from '@/lib/useCachedApi';
import './home.css';

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function urgencyClass(dueDate?: string | null) {
  if (!dueDate) return '';
  const daysLeft = Math.ceil((new Date(dueDate).getTime() - Date.now()) / 86400000);
  if (daysLeft < 0) return 'urgency-critical';
  if (daysLeft <= 1) return 'urgency-critical';
  if (daysLeft <= 3) return 'urgency-high';
  if (daysLeft <= 7) return 'urgency-medium';
  return 'urgency-low';
}

function formatDate(dateValue?: string | null) {
  if (!dateValue) return '—';
  return new Date(dateValue).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

type DashboardTask = {
  _id: string;
  title: string;
  dueDate?: string;
  status: string;
  projectId?: { name?: string };
};

type ActivityItem = {
  id: string;
  msg: string;
  time: string;
  color: string;
};

type DashboardResponse = {
  kpi: { active: number; completion: number; hours: string; overdue: number };
  myTasks: DashboardTask[];
  upcoming: Array<{ id: string; title: string; dueDate?: string; projectName: string }>;
  activity: ActivityItem[];
  insights: {
    completionProbability: number;
    burnoutRiskScore: number;
    burnoutRiskLabel: string;
  };
};

const INITIAL_DASHBOARD: DashboardResponse = {
  kpi: { active: 0, completion: 0, hours: '0.0h', overdue: 0 },
  myTasks: [],
  upcoming: [],
  activity: [],
  insights: { completionProbability: 0, burnoutRiskScore: 0, burnoutRiskLabel: 'Low' },
};

export default function HomePage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const {
    data,
    loading,
    error,
    isRefreshing,
    lastUpdated,
    refresh,
  } = useCachedApi<DashboardResponse>({
    cacheKey: 'home-dashboard-v1',
    initialData: INITIAL_DASHBOARD,
    fetcher: async () => {
      const res = await fetch('/api/dashboard', { cache: 'no-store' });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to load dashboard');
      return json.data as DashboardResponse;
    },
    ttlMs: 90000,
  });

  const firstName = session?.user?.name?.split(' ')[0] || 'there';

  React.useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/auth/signin');
    }
  }, [router, status]);

  if (status !== 'authenticated') {
    return (
      <div className="page-wrapper animate-in">
        <div className="card" style={{ padding: 20, color: 'var(--text-secondary)' }}>
          Preparing your workspace...
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrapper animate-in">
      <div className="home-header">
        <div>
          <h1 className="home-greeting">{greeting()}, {firstName}.</h1>
          <p className="text-muted text-sm">Here&apos;s what&apos;s happening in your workspace today.</p>
        </div>
        <div className="home-header-actions">
          <button className="btn btn-secondary" onClick={refresh} disabled={isRefreshing}>Refresh</button>
          <Link href="/tasks" className="btn btn-primary">
            View all tasks <ArrowRight size={14} />
          </Link>
        </div>
      </div>

      <DataStatusBanner
        loading={loading}
        error={error}
        lastUpdated={lastUpdated}
        isRefreshing={isRefreshing}
        onRetry={refresh}
        onRefresh={refresh}
      />

      <div className="kpi-grid">
        {[
          { label: 'Active Tasks', value: data.kpi.active, icon: CheckSquare, color: '#5B6BF8' },
          { label: 'Completion Rate', value: `${data.kpi.completion}%`, icon: TrendingUp, color: '#10B981' },
          { label: 'Hours Logged', value: data.kpi.hours, icon: Clock, color: '#F59E0B' },
          { label: 'Overdue', value: data.kpi.overdue, icon: AlertCircle, color: '#EF4444' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div className="kpi-card" key={label}>
            <div className="kpi-icon" style={{ background: `${color}1A`, color }}>
              <Icon size={18} />
            </div>
            <div>
              <div className="kpi-value">{value}</div>
              <div className="kpi-label">{label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="home-grid">
        <div className="home-col-main">
          <div className="section-header">
            <span className="section-title">My Tasks</span>
            <Link href="/tasks" className="btn btn-ghost text-sm">View all</Link>
          </div>

          {loading ? (
            <div className="empty-state card">
              <p style={{ color: 'var(--text-secondary)' }}>Loading tasks...</p>
            </div>
          ) : data.myTasks.length === 0 ? (
            <div className="empty-state card">
              <CheckSquare size={28} color="var(--text-disabled)" />
              <p style={{ color: 'var(--text-secondary)', marginTop: 8 }}>All caught up! No pending tasks.</p>
            </div>
          ) : (
            <div className="task-table card">
              <div className="task-table-header">
                <span>Task</span><span>Project</span><span>Due</span><span>Status</span>
              </div>
              {data.myTasks.map((task) => (
                <div key={task._id} className={`task-row ${urgencyClass(task.dueDate)}`}>
                  <span className="task-row-title">{task.title}</span>
                  <span className="text-muted text-sm">{task.projectId?.name || 'General'}</span>
                  <span className="text-sm" style={{ color: task.dueDate && new Date(task.dueDate) < new Date() ? 'var(--urgency-critical)' : 'var(--text-secondary)' }}>
                    {formatDate(task.dueDate)}
                  </span>
                  <span className={`badge badge-${task.status === 'done' ? 'done' : task.status === 'in_progress' ? 'doing' : 'todo'}`}>
                    {task.status === 'in_progress' ? 'In Progress' : task.status === 'done' ? 'Done' : 'To Do'}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="insight-grid">
            <div className="insight-card card">
              <div className="insight-header">
                <div className="insight-icon" style={{ background: 'rgba(91,107,248,0.1)', color: '#5B6BF8' }}>
                  <BrainCircuit size={16} />
                </div>
                <div>
                  <div className="insight-title">Completion Probability</div>
                  <div className="insight-subtitle">Model-driven delivery confidence</div>
                </div>
                <div className="insight-score" style={{ color: '#10B981' }}>{data.insights.completionProbability}%</div>
              </div>
              <div className="insight-bar-track">
                <div className="insight-bar-fill" style={{ width: `${data.insights.completionProbability}%`, background: '#10B981' }} />
              </div>
              <p className="insight-footnote">Derived from completion rate, overdue load, and assignment velocity.</p>
            </div>

            <div className="insight-card card">
              <div className="insight-header">
                <div className="insight-icon" style={{ background: 'rgba(245,158,11,0.1)', color: '#F59E0B' }}>
                  <Activity size={16} />
                </div>
                <div>
                  <div className="insight-title">Burnout Risk</div>
                  <div className="insight-subtitle">Workload concentration score</div>
                </div>
                <div className="insight-score" style={{ color: data.insights.burnoutRiskScore > 70 ? '#EF4444' : data.insights.burnoutRiskScore > 40 ? '#F59E0B' : '#10B981' }}>
                  {data.insights.burnoutRiskLabel}
                </div>
              </div>
              <div className="insight-bar-track">
                <div className="insight-bar-fill" style={{ width: `${data.insights.burnoutRiskScore}%`, background: data.insights.burnoutRiskScore > 70 ? '#EF4444' : data.insights.burnoutRiskScore > 40 ? '#F59E0B' : '#10B981' }} />
              </div>
              <p className="insight-footnote">Scored from active and overdue assigned tasks.</p>
            </div>
          </div>
        </div>

        <div className="home-col-side">
          <div className="section-header">
            <span className="section-title">Upcoming Deadlines</span>
          </div>

          <div className="deadline-list">
            {data.upcoming.length === 0 ? (
              <div className="deadline-item card">
                <div className="deadline-title">No upcoming deadlines</div>
                <div className="deadline-meta"><span>You are clear for now</span><span>—</span></div>
              </div>
            ) : data.upcoming.map((item) => (
              <div key={item.id} className={`deadline-item card ${urgencyClass(item.dueDate)}`}>
                <div className="deadline-title">{item.title}</div>
                <div className="deadline-meta">
                  <span>{item.projectName}</span>
                  <span style={{ color: 'var(--urgency-critical)' }}>{formatDate(item.dueDate)}</span>
                </div>
              </div>
            ))}

            <Link href="/notifications" className="btn btn-secondary w-full justify-center" style={{ marginTop: 8 }}>
              Go to Notifications
            </Link>
          </div>

          <div className="section-header" style={{ marginTop: 24 }}>
            <span className="section-title">Activity</span>
          </div>

          <div className="activity-list card">
            {data.activity.length === 0 ? (
              <div className="activity-item">
                <div className="activity-dot" style={{ background: '#6B7280' }} />
                <div>
                  <div className="activity-msg">No recent activity</div>
                  <div className="activity-time">—</div>
                </div>
              </div>
            ) : data.activity.map((item) => (
              <div key={item.id} className="activity-item">
                <div className="activity-dot" style={{ background: item.color }} />
                <div>
                  <div className="activity-msg">{item.msg}</div>
                  <div className="activity-time">{item.time}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
