"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Clock as ClockIcon, Play, Square, FileText, RefreshCw, TimerReset, TrendingUp, Layers3, ArrowRight, CheckCircle2, Sparkles } from 'lucide-react';
import DataStatusBanner from '@/components/ui/DataStatusBanner';
import { useCachedApi } from '@/lib/useCachedApi';
import { toastError, toastInfo, toastSuccess } from '@/lib/toast';
import { dispatchTimerCommand, readTimerSnapshot, subscribeTimerCommand, subscribeTimerState, writeTimerSnapshot } from '@/lib/timerShortcuts';
import './time.css';

type TimeTask = {
  _id: string;
  title: string;
  timeSpent?: number;
  projectId?: { name?: string } | string;
  dueDate?: string;
  status?: string;
};

const INITIAL_TASKS: TimeTask[] = [];

function formatTime(secs: number) {
  const hours = Math.floor(secs / 3600).toString().padStart(2, '0');
  const minutes = Math.floor((secs % 3600) / 60).toString().padStart(2, '0');
  const seconds = (secs % 60).toString().padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

function formatDurationLabel(seconds: number) {
  if (seconds <= 0) return '0m';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

function normalizeStatus(status?: string) {
  return String(status || 'TODO').toLowerCase().replace(/\s+/g, '_');
}

function getStatusTone(status?: string) {
  const normalized = normalizeStatus(status);
  if (normalized === 'done') return { label: 'Done', color: '#10B981', bg: 'rgba(16,185,129,0.14)' };
  if (normalized === 'in_progress') return { label: 'In Progress', color: '#F59E0B', bg: 'rgba(245,158,11,0.14)' };
  if (normalized === 'blocked') return { label: 'Blocked', color: '#EF4444', bg: 'rgba(239,68,68,0.14)' };
  if (normalized === 'in_review') return { label: 'In Review', color: '#A78BFA', bg: 'rgba(167,139,250,0.14)' };
  return { label: 'To Do', color: '#60A5FA', bg: 'rgba(96,165,250,0.14)' };
}

export default function TimeTrackerPage() {
  const { data: session } = useSession();
  const {
    data: tasks,
    loading,
    isRefreshing,
    error,
    lastUpdated,
    refresh,
    setData,
  } = useCachedApi<TimeTask[]>({
    cacheKey: 'time-tracker-tasks-v2',
    initialData: INITIAL_TASKS,
    fetcher: async () => {
      const res = await fetch('/api/tasks?scope=assigned', { cache: 'no-store' });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || 'Failed to load tasks');
      }
      return (json.data || []) as TimeTask[];
    },
    ttlMs: 90_000,
  });

  const [activeTask, setActiveTask] = useState('');
  const [activityTitle, setActivityTitle] = useState('');
  const [timerRunning, setTimerRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const hydrateFrame = window.requestAnimationFrame(() => {
      const snapshot = readTimerSnapshot();
      setActiveTask(snapshot.activeTask || '');
      setActivityTitle(snapshot.activityTitle || '');
      setTimerRunning(Boolean(snapshot.isRunning));
      setElapsedSeconds(Number(snapshot.elapsedSeconds || 0));
    });

    return () => {
      window.cancelAnimationFrame(hydrateFrame);
    };
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;
    if (timerRunning) {
      interval = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timerRunning]);

  useEffect(() => {
    const unsubscribeState = subscribeTimerState((snapshot) => {
      setActiveTask(snapshot.activeTask || '');
      setActivityTitle(snapshot.activityTitle || '');
      setElapsedSeconds(Number(snapshot.elapsedSeconds || 0));
      setTimerRunning(Boolean(snapshot.isRunning));
    });

    const unsubscribeCommand = subscribeTimerCommand((command) => {
      if (command === 'start') {
        if (!activeTask) {
          toastInfo('Select a task first to start timer.');
          return;
        }
        setTimerRunning(true);
      }

      if (command === 'pause') {
        setTimerRunning(false);
      }

      if (command === 'stop') {
        setTimerRunning(false);
        setElapsedSeconds(0);
      }
    });

    return () => {
      unsubscribeState();
      unsubscribeCommand();
    };
  }, [activeTask]);

  useEffect(() => {
    if (!tasks.some((task) => task._id === activeTask)) {
      setActiveTask('');
      setTimerRunning(false);
    }
  }, [tasks, activeTask]);

  useEffect(() => {
    writeTimerSnapshot({
      activeTask,
      activityTitle,
      elapsedSeconds,
      isRunning: timerRunning,
      lastTickAt: timerRunning ? Date.now() : null,
    });
  }, [activeTask, activityTitle, elapsedSeconds, timerRunning]);

  const assignedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => (b.timeSpent || 0) - (a.timeSpent || 0));
  }, [tasks]);

  const totalTrackedSeconds = useMemo(() => {
    return tasks.reduce((sum, task) => sum + (task.timeSpent || 0), 0);
  }, [tasks]);

  const activeTaskRecord = useMemo(() => assignedTasks.find((task) => task._id === activeTask), [assignedTasks, activeTask]);

  const overdueTasks = useMemo(() => {
    const now = Date.now();
    return tasks.filter((task) => {
      const due = task.dueDate ? new Date(task.dueDate).getTime() : null;
      return Boolean(due && due < now && normalizeStatus(task.status) !== 'done');
    }).length;
  }, [tasks]);

  const focusTasks = useMemo(() => {
    return tasks
      .filter((task) => normalizeStatus(task.status) !== 'done')
      .sort((a, b) => {
        const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY;
        const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY;
        return aDue - bDue;
      })
      .slice(0, 4);
  }, [tasks]);

  const topTrackedTask = useMemo(() => assignedTasks[0], [assignedTasks]);

  const quickPicks = useMemo(() => {
    return focusTasks.length > 0 ? focusTasks : assignedTasks.slice(0, 4);
  }, [assignedTasks, focusTasks]);

  const toggleTimer = () => {
    if (!activeTask) {
      toastInfo('Choose a task to track time against.');
      return;
    }

    if (timerRunning) {
      persistTrackedTime().catch(() => undefined);
      setTimerRunning(false);
      dispatchTimerCommand('pause');
    } else {
      setTimerRunning(true);
      dispatchTimerCommand('start');
    }
  };

  async function persistTrackedTime() {
    if (!activeTask || elapsedSeconds <= 0) return;

    const targetTask = tasks.find((task) => task._id === activeTask);
    if (!targetTask) return;

    const previous = targetTask.timeSpent || 0;
    const updatedTotal = previous + elapsedSeconds;

    setData((prev) => prev.map((task) => (
      task._id === activeTask ? { ...task, timeSpent: updatedTotal } : task
    )));

    try {
      const res = await fetch(`/api/tasks/${activeTask}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeSpent: updatedTotal }),
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || 'Failed to save tracked time');
      }

      setElapsedSeconds(0);
      toastSuccess(`Added ${formatTime(elapsedSeconds)} to ${targetTask.title}.`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save tracked time';
      setData((prev) => prev.map((task) => (
        task._id === activeTask ? { ...task, timeSpent: previous } : task
      )));
      toastError(message);
    }
  }

  const totalAssignedTasks = tasks.length;
  const completionCount = useMemo(() => tasks.filter((task) => normalizeStatus(task.status) === 'done').length, [tasks]);
  const completionRate = totalAssignedTasks ? Math.round((completionCount / totalAssignedTasks) * 100) : 0;
  const loggedHours = Number((totalTrackedSeconds / 3600).toFixed(1));
  const remainingFocusTasks = tasks.filter((task) => normalizeStatus(task.status) !== 'done').length;

  return (
    <div className="page-wrapper animate-fade-in time-page">
      <div className="time-hero card">
        <div className="time-hero-copy">
          <nav className="breadcrumb" style={{ marginBottom: 10 }}>
            <span>DreamShift</span>
            <ArrowRight size={13} />
            <span className="breadcrumb-active">Timesheet</span>
          </nav>
          <h1 className="page-title" style={{ marginBottom: 8 }}>Your Time</h1>
          <p className="time-hero-text">
            Track your assigned work without clutter. Start the timer, log focused sessions, and keep your timesheet easy to scan.
          </p>
          <div className="time-hero-meta">
            <span className="time-meta-pill">{session?.user?.name || 'Your workspace'}</span>
            <span className="time-meta-pill">{totalAssignedTasks} assigned tasks</span>
            <span className="time-meta-pill">{loggedHours} logged hours</span>
            <span className="time-meta-pill">{overdueTasks} overdue tasks</span>
          </div>
        </div>
        <div className="time-hero-actions">
          <button className="btn btn-secondary" onClick={refresh} disabled={isRefreshing}>
            <RefreshCw size={13} /> Refresh
          </button>
          <Link href="/tasks" className="btn btn-primary">
            Open My Tasks <ArrowRight size={13} />
          </Link>
        </div>
      </div>

      <DataStatusBanner
        loading={loading}
        error={error}
        isRefreshing={isRefreshing}
        lastUpdated={lastUpdated}
        onRetry={refresh}
        onRefresh={refresh}
      />

      <section className="time-kpi-grid">
        {[
          { label: 'Assigned Tasks', value: totalAssignedTasks, icon: Layers3, color: '#5B6BF8' },
          { label: 'Completion Rate', value: `${completionRate}%`, icon: CheckCircle2, color: '#10B981' },
          { label: 'Logged Hours', value: `${loggedHours}h`, icon: TimerReset, color: '#F59E0B' },
          { label: 'Remaining Focus', value: remainingFocusTasks, icon: TrendingUp, color: '#A78BFA' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="time-kpi card">
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

      <section className="time-layout">
        <div className="time-main-column">
          <div className="time-panel card">
            <div className="time-panel-header">
              <div>
                <div className="card-title">Timer workspace</div>
                <div className="card-subtitle">Pick a task, add context, and start tracking</div>
              </div>
              <span className={`time-chip ${timerRunning ? 'running' : 'idle'}`}>
                {timerRunning ? 'Recording' : 'Paused'}
              </span>
            </div>

            <div className="time-tracker-shell">
              <div className="time-tracker-form">
                <label className="time-field">
                  <span className="time-field-label">What are you working on?</span>
                  <input
                    type="text"
                    placeholder="Optional note for this session"
                    className="time-input"
                    value={activityTitle}
                    onChange={(e) => setActivityTitle(e.target.value)}
                  />
                </label>

                <label className="time-field">
                  <span className="time-field-label">Task</span>
                  <select
                    className="time-select"
                    value={activeTask}
                    onChange={(e) => setActiveTask(e.target.value)}
                    disabled={timerRunning}
                  >
                    <option value="">Select assigned task</option>
                    {assignedTasks.map((task) => {
                      const projectName = typeof task.projectId === 'object' ? task.projectId?.name || 'General' : 'General';
                      return <option key={task._id} value={task._id}>{task.title} · {projectName}</option>;
                    })}
                  </select>
                </label>
              </div>

              <div className="time-tracker-status">
                <div className="time-clock">{formatTime(elapsedSeconds)}</div>
                <div className="time-active-summary">
                  {activeTaskRecord ? (
                    <>
                      <div className="time-active-title">{activeTaskRecord.title}</div>
                      <div className="time-active-subtitle">{typeof activeTaskRecord.projectId === 'object' ? activeTaskRecord.projectId?.name || 'General' : 'General'}</div>
                    </>
                  ) : (
                    <div className="time-active-subtitle">Select a task to begin recording time.</div>
                  )}
                </div>
                <button
                  className={`time-action-btn ${timerRunning ? 'stop' : 'start'}`}
                  onClick={toggleTimer}
                >
                  {timerRunning ? <Square size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
                </button>
              </div>
            </div>
          </div>

          <div className="time-panel card">
            <div className="time-panel-header">
              <div>
                <div className="card-title">Quick picks</div>
                <div className="card-subtitle">A faster way to start the next work session</div>
              </div>
            </div>

            <div className="time-quick-grid">
              {quickPicks.length === 0 ? (
                <div className="time-empty">No assigned tasks available yet.</div>
              ) : quickPicks.map((task) => {
                const projectName = typeof task.projectId === 'object' ? task.projectId?.name || 'General' : 'General';
                const tone = getStatusTone(task.status);
                return (
                  <button
                    key={task._id}
                    className={`time-quick-card ${activeTask === task._id ? 'active' : ''}`}
                    type="button"
                    onClick={() => setActiveTask(task._id)}
                  >
                    <div className="time-quick-top">
                      <div className="time-quick-title">{task.title}</div>
                      <span className="time-quick-badge" style={{ background: tone.bg, color: tone.color }}>{tone.label}</span>
                    </div>
                    <div className="time-quick-subtitle">{projectName}</div>
                    <div className="time-quick-footer">
                      <span>{formatDurationLabel(task.timeSpent || 0)} logged</span>
                      <span>{task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No deadline'}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="time-panel card">
            <div className="time-panel-header">
              <div>
                <div className="card-title">My logged time</div>
                <div className="card-subtitle">Organized by the tasks you have invested the most time in</div>
              </div>
              <span className="time-panel-chip">{totalTrackedSeconds ? formatDurationLabel(totalTrackedSeconds) : 'No time logged yet'}</span>
            </div>

            <div className="time-table">
              <div className="time-table-header">
                <span>Task</span>
                <span>Project</span>
                <span>Duration</span>
              </div>

              {loading ? (
                <div className="time-empty">Loading tasks...</div>
              ) : assignedTasks.filter((task) => (task.timeSpent || 0) > 0).length === 0 ? (
                <div className="time-empty">
                  Start the tracker to see your logged sessions appear here.
                </div>
              ) : (
                assignedTasks
                  .filter((task) => (task.timeSpent || 0) > 0)
                  .map((task, index) => {
                    const projectName = typeof task.projectId === 'object' ? task.projectId?.name || 'General' : 'General';
                    const tone = index % 2 === 0
                      ? { background: 'rgba(91,107,248,0.14)', color: '#5B6BF8' }
                      : { background: 'rgba(42,157,143,0.14)', color: '#2A9D8F' };
                    const progress = totalTrackedSeconds ? Math.round(((task.timeSpent || 0) / totalTrackedSeconds) * 100) : 0;

                    return (
                      <div key={task._id} className="time-table-row">
                        <div className="time-task-cell">
                          <div className="time-task-icon">
                            <FileText size={15} />
                          </div>
                          <div>
                            <div className="time-task-title">{task.title}</div>
                            <div className="time-task-subtitle">{getStatusTone(task.status).label}</div>
                          </div>
                        </div>

                        <div className="time-project-cell">
                          <span className="time-project-badge" style={tone}>{projectName}</span>
                        </div>

                        <div className="time-duration-cell">
                          <div className="time-duration-meta">
                            <span className="time-duration-value">{formatTime(task.timeSpent || 0)}</span>
                            <span className="time-duration-percent">{progress}%</span>
                          </div>
                          <div className="time-duration-track">
                            <div className="time-duration-fill" style={{ width: `${progress}%`, background: tone.color }} />
                          </div>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        </div>

        <aside className="time-side-column">
          <div className="time-panel card">
            <div className="time-panel-header">
              <div>
                <div className="card-title">Today at a glance</div>
                <div className="card-subtitle">Small signals that matter most</div>
              </div>
            </div>

            <div className="time-signal-list">
              <div className="time-signal-row">
                <div className="time-signal-top">
                  <span className="time-signal-label">Focus tasks</span>
                  <span className="time-signal-value">{remainingFocusTasks}</span>
                </div>
                <div className="time-signal-detail">Open work that still needs attention.</div>
              </div>
              <div className="time-signal-row">
                <div className="time-signal-top">
                  <span className="time-signal-label">Most logged task</span>
                  <span className="time-signal-value">{topTrackedTask ? formatDurationLabel(topTrackedTask.timeSpent || 0) : '0m'}</span>
                </div>
                <div className="time-signal-detail">{topTrackedTask?.title || 'Nothing logged yet'}</div>
              </div>
              <div className="time-signal-row">
                <div className="time-signal-top">
                  <span className="time-signal-label">Overdue workload</span>
                  <span className="time-signal-value">{overdueTasks}</span>
                </div>
                <div className="time-signal-detail">Tasks already past due and still open.</div>
              </div>
              <div className="time-signal-row">
                <div className="time-signal-top">
                  <span className="time-signal-label">Current session</span>
                  <span className="time-signal-value">{timerRunning ? 'Running' : 'Stopped'}</span>
                </div>
                <div className="time-signal-detail">{activityTitle || 'Optional note not yet filled in.'}</div>
              </div>
            </div>
          </div>

          <div className="time-panel card">
            <div className="time-panel-header">
              <div>
                <div className="card-title">Next actions</div>
                <div className="card-subtitle">Use these to keep the page clean and focused</div>
              </div>
            </div>

            <div className="time-action-links">
              <Link href="/calendar" className="time-action-link">
                <ClockIcon size={14} /> Review calendar
              </Link>
              <Link href="/analytics" className="time-action-link">
                <Sparkles size={14} /> Open analytics
              </Link>
              <Link href="/tasks" className="time-action-link">
                <ArrowRight size={14} /> Manage tasks
              </Link>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
