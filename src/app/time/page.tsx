"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Clock as ClockIcon, Play, Square, FileText, RefreshCw, TimerReset, TrendingUp, Layers3, ArrowRight, CheckCircle2, Sparkles, Pencil, Trash2 } from 'lucide-react';
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

type TimeEntry = {
  _id: string;
  taskId: string;
  projectId: string;
  source?: 'MANUAL' | 'TIMER';
  startTime: string;
  endTime: string;
  durationSeconds: number;
  note?: string;
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

function toDateTimeInput(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const tzOffsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - tzOffsetMs).toISOString().slice(0, 16);
}

function toIsoOrUndefined(value?: string) {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString();
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

function getEntrySourceTone(source?: string) {
  const normalized = String(source || 'TIMER').toUpperCase();
  if (normalized === 'MANUAL') return { label: 'Manual', color: '#A78BFA', bg: 'rgba(167,139,250,0.14)' };
  return { label: 'Timer', color: '#2DD4BF', bg: 'rgba(45,212,191,0.14)' };
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
  const [manualSaving, setManualSaving] = useState(false);
  const [manualEntry, setManualEntry] = useState({
    taskId: '',
    startTime: '',
    endTime: '',
    note: '',
  });
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const [entrySaving, setEntrySaving] = useState(false);

  const {
    data: timeEntries,
    loading: entriesLoading,
    refresh: refreshEntries,
    setData: setTimeEntries,
  } = useCachedApi<TimeEntry[]>({
    cacheKey: 'time-entries-v1',
    initialData: [],
    fetcher: async () => {
      const res = await fetch('/api/time-entries', { cache: 'no-store' });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || 'Failed to load time entries');
      }
      return (json.data || []) as TimeEntry[];
    },
    ttlMs: 30_000,
  });

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
  const taskById = useMemo(() => new Map(tasks.map((task) => [task._id, task])), [tasks]);

  const loggedEntries = useMemo(() => {
    return [...timeEntries].sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  }, [timeEntries]);

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

  const taskTotalRows = useMemo(() => {
    return [...assignedTasks]
      .filter((task) => (task.timeSpent || 0) > 0)
      .sort((a, b) => (b.timeSpent || 0) - (a.timeSpent || 0))
      .slice(0, 5);
  }, [assignedTasks]);

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
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - elapsedSeconds * 1000);

    try {
      const res = await fetch('/api/time-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: activeTask,
          source: 'TIMER',
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          note: activityTitle || undefined,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || 'Failed to log tracked time');
      }

      setData((prev) => prev.map((task) => (
        task._id === activeTask ? { ...task, timeSpent: updatedTotal } : task
      )));
      setTimeEntries((prev) => [json.data as TimeEntry, ...prev]);
      setElapsedSeconds(0);
      toastSuccess(`Added ${formatTime(elapsedSeconds)} to ${targetTask.title}.`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save tracked time';
      setData((prev) => prev.map((task) => (task._id === activeTask ? { ...task, timeSpent: previous } : task)));
      toastError(message);
    }
  }

  const submitManualEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualEntry.taskId || !manualEntry.startTime || !manualEntry.endTime) {
      toastInfo('Select a task and both start/end time.');
      return;
    }

    setManualSaving(true);
    try {
      const res = await fetch('/api/time-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: manualEntry.taskId,
          source: 'MANUAL',
          startTime: new Date(manualEntry.startTime).toISOString(),
          endTime: new Date(manualEntry.endTime).toISOString(),
          note: manualEntry.note || undefined,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || 'Failed to create time entry');
      }

      const created = json.data as TimeEntry;
      setTimeEntries((prev) => [created, ...prev]);
      setData((prev) => prev.map((task) => (
        task._id === manualEntry.taskId
          ? { ...task, timeSpent: (task.timeSpent || 0) + Number(created.durationSeconds || 0) }
          : task
      )));
      setManualEntry({ taskId: '', startTime: '', endTime: '', note: '' });
      toastSuccess('Time entry logged');
      await refreshEntries();
    } catch (error: unknown) {
      toastError(error instanceof Error ? error.message : 'Failed to create time entry');
    } finally {
      setManualSaving(false);
    }
  };

  const openEditEntry = (entry: TimeEntry) => {
    setEditingEntry({ ...entry, startTime: toDateTimeInput(entry.startTime), endTime: toDateTimeInput(entry.endTime) });
  };

  const saveEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEntry) return;

    setEntrySaving(true);
    try {
      const res = await fetch(`/api/time-entries/${editingEntry._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: editingEntry.taskId,
          source: editingEntry.source || 'TIMER',
          startTime: toIsoOrUndefined(editingEntry.startTime),
          endTime: toIsoOrUndefined(editingEntry.endTime),
          note: editingEntry.note || undefined,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || 'Failed to update time entry');
      }

      setTimeEntries((prev) => prev.map((entry) => (entry._id === editingEntry._id ? (json.data as TimeEntry) : entry)));
      setEditingEntry(null);
      toastSuccess('Time entry updated');
      await refreshEntries();
    } catch (error: unknown) {
      toastError(error instanceof Error ? error.message : 'Failed to update time entry');
    } finally {
      setEntrySaving(false);
    }
  };

  const deleteEntry = async (entryId: string) => {
    if (!window.confirm('Delete this time entry?')) return;

    try {
      const res = await fetch(`/api/time-entries/${entryId}`, { method: 'DELETE' });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || 'Failed to delete time entry');
      }

      setTimeEntries((prev) => prev.filter((entry) => entry._id !== entryId));
      toastSuccess('Time entry deleted');
      await refreshEntries();
    } catch (error: unknown) {
      toastError(error instanceof Error ? error.message : 'Failed to delete time entry');
    }
  };

  const totalAssignedTasks = tasks.length;
  const completionCount = useMemo(() => tasks.filter((task) => normalizeStatus(task.status) === 'done').length, [tasks]);
  const completionRate = totalAssignedTasks ? Math.round((completionCount / totalAssignedTasks) * 100) : 0;
  const loggedHours = Number((totalTrackedSeconds / 3600).toFixed(1));
  const remainingFocusTasks = tasks.filter((task) => normalizeStatus(task.status) !== 'done').length;

  return (
    <div className="page-wrapper animate-fade-in time-page">
      {editingEntry && (
        <div className="modal-overlay" onClick={() => setEditingEntry(null)}>
          <form className="ws-settings-modal" onSubmit={saveEntry} onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>Edit Time Entry</div>
              </div>
            </div>
            <div className="modal-body" style={{ display: 'grid', gap: 10 }}>
              <select
                className="input"
                value={editingEntry.taskId}
                onChange={(event) => setEditingEntry((prev) => prev ? { ...prev, taskId: event.target.value } : prev)}
              >
                {assignedTasks.map((task) => <option key={`edit-${task._id}`} value={task._id}>{task.title}</option>)}
              </select>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
                <input className="input" type="datetime-local" value={editingEntry.startTime} onChange={(event) => setEditingEntry((prev) => prev ? { ...prev, startTime: event.target.value } : prev)} />
                <input className="input" type="datetime-local" value={editingEntry.endTime} onChange={(event) => setEditingEntry((prev) => prev ? { ...prev, endTime: event.target.value } : prev)} />
              </div>
              <input className="input" value={editingEntry.note || ''} onChange={(event) => setEditingEntry((prev) => prev ? { ...prev, note: event.target.value } : prev)} placeholder="Optional note" />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setEditingEntry(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={entrySaving}>{entrySaving ? 'Saving...' : 'Save Entry'}</button>
              </div>
            </div>
          </form>
        </div>
      )}
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
                <div className="card-title">Manual time entry</div>
                <div className="card-subtitle">Log start and end times manually for any assigned task</div>
              </div>
            </div>

            <form onSubmit={submitManualEntry} style={{ display: 'grid', gap: 10 }}>
              <select
                className="time-select"
                value={manualEntry.taskId}
                onChange={(e) => setManualEntry((prev) => ({ ...prev, taskId: e.target.value }))}
                required
              >
                <option value="">Select task</option>
                {assignedTasks.map((task) => (
                  <option key={`manual-${task._id}`} value={task._id}>{task.title}</option>
                ))}
              </select>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
                <input
                  className="time-input"
                  type="datetime-local"
                  value={manualEntry.startTime}
                  onChange={(e) => setManualEntry((prev) => ({ ...prev, startTime: e.target.value }))}
                  required
                />
                <input
                  className="time-input"
                  type="datetime-local"
                  value={manualEntry.endTime}
                  onChange={(e) => setManualEntry((prev) => ({ ...prev, endTime: e.target.value }))}
                  required
                />
              </div>
              <input
                className="time-input"
                placeholder="Optional note"
                value={manualEntry.note}
                onChange={(e) => setManualEntry((prev) => ({ ...prev, note: e.target.value }))}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn btn-primary" type="submit" disabled={manualSaving}>
                  {manualSaving ? 'Saving...' : 'Log Entry'}
                </button>
              </div>
            </form>
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
                <div className="card-subtitle">Manual and timer sessions recorded together</div>
              </div>
              <span className="time-panel-chip">{totalTrackedSeconds ? formatDurationLabel(totalTrackedSeconds) : 'No time logged yet'}</span>
            </div>

            {entriesLoading ? (
              <div className="time-empty">Loading entries...</div>
            ) : loggedEntries.length === 0 ? (
              <div className="time-empty">No logged entries yet.</div>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {loggedEntries.map((entry) => {
                  const task = taskById.get(entry.taskId);
                  const projectName = typeof task?.projectId === 'object' ? task.projectId?.name || 'General' : 'General';
                  const sourceTone = getEntrySourceTone(entry.source);
                  const projectTone = task ? getStatusTone(task.status) : { label: 'Task', color: '#5B6BF8', bg: 'rgba(91,107,248,0.14)' };

                  return (
                    <div key={entry._id} className="card" style={{ padding: 14, border: '1px solid var(--border-subtle)', background: 'rgba(255,255,255,0.02)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                          <div className="time-task-icon">
                            <FileText size={15} />
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div className="time-task-title" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                              <span>{task?.title || 'Task'}</span>
                              <span className="badge" style={{ background: sourceTone.bg, color: sourceTone.color }}>{sourceTone.label}</span>
                            </div>
                            <div className="time-task-subtitle" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                              <span>{projectName}</span>
                              <span>·</span>
                              <span>{getStatusTone(task?.status).label}</span>
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <button type="button" className="btn btn-secondary" aria-label="Edit time entry" title="Edit time entry" onClick={() => openEditEntry(entry)}>
                            <Pencil size={13} />
                          </button>
                          <button type="button" className="btn btn-secondary" style={{ color: '#EF4444' }} aria-label="Delete time entry" title="Delete time entry" onClick={() => deleteEntry(entry._id)}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8, marginTop: 12 }}>
                        <div>
                          <div className="text-xs text-muted">Start</div>
                          <div style={{ marginTop: 4 }}>{new Date(entry.startTime).toLocaleString()}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted">End</div>
                          <div style={{ marginTop: 4 }}>{new Date(entry.endTime).toLocaleString()}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted">Duration</div>
                          <div style={{ marginTop: 4, fontWeight: 700 }}>{formatTime(Number(entry.durationSeconds || 0))}</div>
                        </div>
                      </div>

                      <div style={{ marginTop: 10 }}>
                        <div className="time-duration-track">
                          <div
                            className="time-duration-fill"
                            style={{ width: totalTrackedSeconds ? `${Math.round((Number(entry.durationSeconds || 0) / totalTrackedSeconds) * 100)}%` : '0%', background: projectTone.color }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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

          <div className="time-panel card">
            <div className="time-panel-header">
              <div>
                <div className="card-title">Task totals</div>
                <div className="card-subtitle">Top tasks by total tracked time</div>
              </div>
              <span className="time-panel-chip">{taskTotalRows.length} rows</span>
            </div>

            {taskTotalRows.length === 0 ? (
              <div className="time-empty">No task totals yet.</div>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                {taskTotalRows.map((task) => {
                  const projectName = typeof task.projectId === 'object' ? task.projectId?.name || 'General' : 'General';
                  const progress = totalTrackedSeconds ? Math.round(((task.timeSpent || 0) / totalTrackedSeconds) * 100) : 0;

                  return (
                    <div key={`task-total-${task._id}`} className="card" style={{ padding: 12, border: '1px solid var(--border-subtle)', background: 'rgba(255,255,255,0.02)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                        <div style={{ minWidth: 0 }}>
                          <div className="time-task-title">{task.title}</div>
                          <div className="time-task-subtitle">{projectName}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 700 }}>{formatTime(task.timeSpent || 0)}</div>
                          <div className="text-xs text-muted">{progress}%</div>
                        </div>
                      </div>
                      <div style={{ marginTop: 8 }}>
                        <div className="time-duration-track">
                          <div className="time-duration-fill" style={{ width: `${progress}%`, background: '#5B6BF8' }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </aside>
      </section>
    </div>
  );
}
