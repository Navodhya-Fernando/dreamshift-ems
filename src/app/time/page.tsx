"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Clock as ClockIcon, FileText, RefreshCw, TimerReset, TrendingUp, Layers3, ArrowRight, CheckCircle2, Sparkles, Pencil, Trash2 } from 'lucide-react';
import DataStatusBanner from '@/components/ui/DataStatusBanner';
import { useCachedApi } from '@/lib/useCachedApi';
import { toastError, toastInfo, toastSuccess } from '@/lib/toast';
import {useTimer,TimerClock} from '@/components/layout/TimerProvider';
import './time.css';

type TimeTask = {
  _id: string;
  title: string;
  timeSpent?: number;
  projectId?: { _id?: string; name?: string } | string;
  workspaceId?: { _id?: string; name?: string } | string;
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

type TimeWindowFilter = 'THIS_WEEK' | 'THIS_MONTH' | 'LAST_7_DAYS' | 'LAST_30_DAYS' | 'ALL_TIME' | 'CUSTOM';

type CustomDateRange = {
  start: string;
  end: string;
};

function startOfLocalDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfLocalDay(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function getWindowRange(filter: TimeWindowFilter, customRange: CustomDateRange) {
  const now = new Date();

  if (filter === 'ALL_TIME') return { start: null as Date | null, end: null as Date | null };

  if (filter === 'CUSTOM') {
    if (!customRange.start || !customRange.end) return { start: null as Date | null, end: null as Date | null };
    const start = startOfLocalDay(new Date(customRange.start));
    const end = endOfLocalDay(new Date(customRange.end));
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end.getTime() < start.getTime()) {
      return { start: null as Date | null, end: null as Date | null };
    }
    return { start, end };
  }

  if (filter === 'THIS_MONTH') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start, end: endOfLocalDay(now) };
  }

  if (filter === 'LAST_30_DAYS') {
    const start = startOfLocalDay(new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000));
    return { start, end: endOfLocalDay(now) };
  }

  if (filter === 'LAST_7_DAYS') {
    const start = startOfLocalDay(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000));
    return { start, end: endOfLocalDay(now) };
  }

  const weekday = now.getDay();
  const diffToMonday = (weekday + 6) % 7;
  const start = startOfLocalDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday));
  return { start, end: endOfLocalDay(now) };
}

function formatWindowLabel(filter: TimeWindowFilter, customRange: CustomDateRange) {
  if (filter === 'THIS_MONTH') return 'This Month';
  if (filter === 'LAST_7_DAYS') return 'Last 7 Days';
  if (filter === 'LAST_30_DAYS') return 'Last 30 Days';
  if (filter === 'ALL_TIME') return 'All Time';
  if (filter === 'CUSTOM' && customRange.start && customRange.end) {
    return `${customRange.start} to ${customRange.end}`;
  }
  if (filter === 'CUSTOM') return 'Custom Range';
  return "This Week";
}

type TaskPickerItem = {
  _id: string;
  title: string;
  projectId: string;
  projectName: string;
  workspaceId: string;
  workspaceName: string;
  timeSpent?: number;
  dueDate?: string;
  status?: string;
};

function getTaskRef(value: TimeTask['projectId'] | TimeTask['workspaceId']) {
  if (!value) return { id: '', name: '' };
  if (typeof value === 'object') return { id: String(value._id || ''), name: String(value.name || '') };
  return { id: String(value || ''), name: '' };
}

function buildTaskPickerItem(task: TimeTask): TaskPickerItem {
  const projectRef = getTaskRef(task.projectId);
  const workspaceRef = getTaskRef(task.workspaceId);
  return {
    _id: task._id,
    title: task.title,
    projectId: projectRef.id,
    projectName: projectRef.name || 'General',
    workspaceId: workspaceRef.id,
    workspaceName: workspaceRef.name || 'Workspace',
    timeSpent: task.timeSpent,
    dueDate: task.dueDate,
    status: task.status,
  };
}

function TaskPickerSelect({
  label,
  value,
  onChange,
  tasks,
  placeholder,
  searchPlaceholder,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  tasks: TaskPickerItem[];
  placeholder: string;
  searchPlaceholder: string;
  disabled?: boolean;
}) {
  const [workspaceId, setWorkspaceId] = useState('');
  const [projectId, setProjectId] = useState('');
  const previousValueRef = useRef(value);

  const valueTask = useMemo(() => tasks.find((task) => task._id === value) || null, [tasks, value]);

  useEffect(() => {
    const previousValue = previousValueRef.current;
    previousValueRef.current = value;

    if (!valueTask) {
      if (previousValue) {
        setWorkspaceId('');
        setProjectId('');
      }
      return;
    }

    if (workspaceId !== valueTask.workspaceId) {
      setWorkspaceId(valueTask.workspaceId);
    }
    if (projectId !== valueTask.projectId) {
      setProjectId(valueTask.projectId);
    }
  }, [value, valueTask, workspaceId, projectId]);

  const workspaceOptions = useMemo(() => {
    const grouped = new Map<string, { id: string; name: string }>();
    tasks.forEach((task) => {
      if (!task.workspaceId) return;
      grouped.set(task.workspaceId, { id: task.workspaceId, name: task.workspaceName });
    });
    return Array.from(grouped.values()).sort((left, right) => left.name.localeCompare(right.name));
  }, [tasks]);

  const projectOptions = useMemo(() => {
    if (!workspaceId) return [];
    const grouped = new Map<string, { id: string; name: string }>();
    tasks.forEach((task) => {
      if (!task.workspaceId || task.workspaceId !== workspaceId || !task.projectId) return;
      grouped.set(task.projectId, { id: task.projectId, name: task.projectName });
    });
    return Array.from(grouped.values()).sort((left, right) => left.name.localeCompare(right.name));
  }, [tasks, workspaceId]);

  const taskOptions = useMemo(() => {
    if (!workspaceId || !projectId) return [];
    return tasks
      .filter((task) => task.workspaceId === workspaceId && task.projectId === projectId)
      .sort((left, right) => left.title.localeCompare(right.title));
  }, [tasks, workspaceId, projectId]);

  const selectedTask = useMemo(() => tasks.find((task) => task._id === value), [tasks, value]);

  useEffect(() => {
    if (!selectedTask) return;
    if (selectedTask.workspaceId !== workspaceId) setWorkspaceId(selectedTask.workspaceId);
    if (selectedTask.projectId !== projectId) setProjectId(selectedTask.projectId);
  }, [selectedTask, workspaceId, projectId]);

  useEffect(() => {
    if (workspaceId && projectId && !projectOptions.some((option) => option.id === projectId)) {
      setProjectId('');
      onChange('');
    }
  }, [workspaceId, projectId, projectOptions, onChange]);

  useEffect(() => {
    if (projectId && value && !taskOptions.some((task) => task._id === value)) {
      onChange('');
    }
  }, [projectId, taskOptions, value, onChange]);

  return (
    <div className="time-field">
      <span className="time-field-label">{label}</span>
      <select
        className="time-select"
        value={workspaceId}
        onChange={(event) => {
          setWorkspaceId(event.target.value);
          setProjectId('');
          onChange('');
        }}
        disabled={disabled || workspaceOptions.length === 0}
      >
        <option value="">Select workspace</option>
        {workspaceOptions.map((workspace) => (
          <option key={workspace.id} value={workspace.id}>{workspace.name}</option>
        ))}
      </select>
      <select
        className="time-select"
        value={projectId}
        onChange={(event) => {
          setProjectId(event.target.value);
          onChange('');
        }}
        disabled={disabled || !workspaceId || projectOptions.length === 0}
      >
        <option value="">Select project</option>
        {projectOptions.map((project) => (
          <option key={project.id} value={project.id}>{project.name}</option>
        ))}
      </select>
      <select
        className="time-select"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled || !workspaceId || !projectId || taskOptions.length === 0}
      >
        <option value="">{placeholder}</option>
        {taskOptions.map((task) => (
          <option key={task._id} value={task._id}>{task.title}</option>
        ))}
      </select>
    </div>
  );
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

  const {timer,ready:timerReady,busy:timerBusy,error:timerError,act:timerAct,refresh:refreshTimer}=useTimer();
  const [selectedTask,setActiveTask]=useState('');
  const [note,setActivityTitle]=useState('');
  const activeTask=timer?.taskId||selectedTask;
  const activityTitle=timer?.note??note;
  const timerRunning=Boolean(timer?.runningSince);
  const [manualSaving, setManualSaving] = useState(false);
  const manualRequest=useRef<{key:string;id:string}|null>(null);
  const [timeWindow, setTimeWindow] = useState<TimeWindowFilter>('THIS_WEEK');
  const [customDateRange, setCustomDateRange] = useState<CustomDateRange>({ start: '', end: '' });
  const [visibleEntryCount, setVisibleEntryCount] = useState(5);
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

  const assignedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => (b.timeSpent || 0) - (a.timeSpent || 0));
  }, [tasks]);

  const taskPickerItems = useMemo(() => assignedTasks.map(buildTaskPickerItem), [assignedTasks]);

  const activeTaskRecord = useMemo(() => assignedTasks.find((task) => task._id === activeTask), [assignedTasks, activeTask]);
  const taskById = useMemo(() => new Map(tasks.map((task) => [task._id, task])), [tasks]);
  const selectedWindowRange = useMemo(() => getWindowRange(timeWindow, customDateRange), [timeWindow, customDateRange]);
  const windowLabel = useMemo(() => formatWindowLabel(timeWindow, customDateRange), [timeWindow, customDateRange]);

  const loggedEntries = useMemo(() => {
    const sortedEntries = [...timeEntries].sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
    if (timeWindow === 'ALL_TIME') {
      return sortedEntries;
    }
    const { start, end } = selectedWindowRange;
    if (!start || !end) {
      return [];
    }
    return sortedEntries.filter((entry) => {
      const startedAt = new Date(entry.startTime).getTime();
      return startedAt >= start.getTime() && startedAt <= end.getTime();
    });
  }, [selectedWindowRange, timeEntries, timeWindow]);

  const filteredTaskDurations = useMemo(() => {
    const durations = new Map<string, number>();
    loggedEntries.forEach((entry) => {
      durations.set(entry.taskId, (durations.get(entry.taskId) || 0) + (entry.durationSeconds || 0));
    });
    return durations;
  }, [loggedEntries]);

  const totalTrackedSeconds = useMemo(() => {
    return loggedEntries.reduce((sum, entry) => sum + (entry.durationSeconds || 0), 0);
  }, [loggedEntries]);

  const visibleLoggedEntries = useMemo(() => loggedEntries.slice(0, visibleEntryCount), [loggedEntries, visibleEntryCount]);
  const canLoadMoreEntries = loggedEntries.length > visibleLoggedEntries.length;

  useEffect(() => {
    setVisibleEntryCount(5);
  }, [timeWindow, customDateRange.end, customDateRange.start]);

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

  const topTrackedTask = useMemo(() => {
    return [...assignedTasks]
      .map((task) => ({
        ...task,
        timeSpent: filteredTaskDurations.get(task._id) || 0,
      }))
      .filter((task) => (task.timeSpent || 0) > 0)
      .sort((a, b) => (b.timeSpent || 0) - (a.timeSpent || 0))[0];
  }, [assignedTasks, filteredTaskDurations]);

  const quickPicks = useMemo(() => {
    return focusTasks.length > 0 ? focusTasks : assignedTasks.slice(0, 4);
  }, [assignedTasks, focusTasks]);

  const taskTotalRows = useMemo(() => {
    return [...assignedTasks]
      .map((task) => ({
        ...task,
        timeSpent: filteredTaskDurations.get(task._id) || 0,
      }))
      .filter((task) => (task.timeSpent || 0) > 0)
      .sort((a, b) => (b.timeSpent || 0) - (a.timeSpent || 0))
      .slice(0, 5);
  }, [assignedTasks, filteredTaskDurations]);

  const submitManualEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualEntry.taskId || !manualEntry.startTime || !manualEntry.endTime) {
      toastInfo('Select a task and both start/end time.');
      return;
    }

    if(manualSaving)return;
    const key=JSON.stringify(manualEntry);
    if(manualRequest.current?.key!==key)manualRequest.current={key,id:crypto.randomUUID()};
    setManualSaving(true);
    try {
      const res = await fetch('/api/time-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: manualEntry.taskId,
          requestId:manualRequest.current?.id,
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

      manualRequest.current=null;
      setManualEntry({ taskId: '', startTime: '', endTime: '', note: '' });
      toastSuccess('Time entry logged');
      await Promise.all([refreshEntries(),refresh()]);
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
          startTime: editingEntry.startTime===toDateTimeInput(timeEntries.find(e=>e._id===editingEntry._id)?.startTime||'')?undefined:toIsoOrUndefined(editingEntry.startTime),
          endTime: editingEntry.endTime===toDateTimeInput(timeEntries.find(e=>e._id===editingEntry._id)?.endTime||'')?undefined:toIsoOrUndefined(editingEntry.endTime),
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
      await Promise.all([refreshEntries(),refresh()]);
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
      await Promise.all([refreshEntries(),refresh()]);
    } catch (error: unknown) {
      toastError(error instanceof Error ? error.message : 'Failed to delete time entry');
    }
  };

  const loadMoreEntries = () => {
    setVisibleEntryCount((current) => Math.min(current + 15, loggedEntries.length));
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
              <TaskPickerSelect
                label="Task"
                value={editingEntry.taskId}
                onChange={(taskId) => setEditingEntry((prev) => prev ? { ...prev, taskId } : prev)}
                tasks={taskPickerItems}
                placeholder="Select task"
                searchPlaceholder="Search workspace, project, or task"
              />
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
          <h1 className="page-title" style={{ marginBottom: 8 }}>Time tracking</h1>
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

          <div className="time-panel card">
            <div className="time-panel-header">
              <div>
                <div className="card-title">Track time</div>
                <div className="card-subtitle">Pick a task, add context, and start tracking</div>
              </div>
              <span className={`time-chip ${timerRunning ? 'running' : 'idle'}`}>
                {timerRunning ? 'Recording' : timer ? 'Paused' : 'Ready'}
              </span>
            </div>

            {timerError&&<p role="alert" className="text-sm" style={{marginBottom:10}}>{timerError} <button className="btn btn-ghost" onClick={()=>void refreshTimer()}>Refresh timer</button></p>}
            <p className="text-muted text-sm" style={{marginBottom:10}}>If you had a running timer before this upgrade, verify its duration and use the manual entry form to record any unsaved work.</p>
            <p className="text-muted text-sm" style={{marginBottom:10}}>Your timer is saved on the server and can be resumed on another device. An internet connection is required to change its state.</p>
            <div className="time-tracker-shell">
              <div className="time-tracker-form">
                <label className="time-field">
                  <span className="time-field-label">What are you working on?</span>
                  <input
                    type="text"
                    placeholder="Optional note for this session"
                    className="time-input"
                    value={activityTitle}
                    disabled={Boolean(timer)||timerBusy}
                    onChange={(e) => setActivityTitle(e.target.value)}
                  />
                </label>

                <TaskPickerSelect
                  label="Task"
                  value={activeTask}
                  onChange={setActiveTask}
                  tasks={taskPickerItems}
                  placeholder="Select assigned task"
                  searchPlaceholder="Search workspace, project, or task"
                  disabled={Boolean(timer)||timerBusy}
                />
              </div>

              <div className="time-tracker-status">
                <TimerClock className="time-clock"/>
                <div className="time-active-summary">
                  {activeTaskRecord ? (
                    <>
                      <div className="time-active-title">{activeTaskRecord.title}</div>
                      <div className="time-active-subtitle">{typeof activeTaskRecord.projectId === 'object' ? activeTaskRecord.projectId?.name || 'General' : 'General'}</div>
                    </>
                  ) : (
                    <div className="time-active-subtitle">{timer?.taskTitle||'Select a task to begin recording time.'}</div>
                  )}
                </div>
                <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                  {!timer?<button className="btn btn-primary" disabled={!timerReady||timerBusy||!activeTask} onClick={()=>void timerAct('start',activeTask,activityTitle)}>Start</button>:<>
                    <button className="btn btn-secondary" disabled={timerBusy} onClick={()=>void timerAct(timerRunning?'pause':'resume')}>{timerRunning?'Pause':'Resume'}</button>
                    <button className="btn btn-primary" disabled={timerBusy} onClick={()=>void timerAct('stop')}>Stop &amp; save</button>
                  </>}
                </div>
              </div>
            </div>
          </div>

      <div className="time-panel card time-filter-panel">
        <div className="time-panel-header" style={{ marginBottom: 10 }}>
          <div>
            <div className="card-title">Time window</div>
            <div className="card-subtitle">Filter the timesheet summaries and log list</div>
          </div>
          <span className="time-panel-chip">Showing {windowLabel}</span>
        </div>
        <div className="time-filter-grid">
          <label className="time-field">
            <span className="time-field-label">Preset</span>
            <select className="time-select" value={timeWindow} onChange={(event) => setTimeWindow(event.target.value as TimeWindowFilter)}>
              <option value="THIS_WEEK">This Week</option>
              <option value="THIS_MONTH">This Month</option>
              <option value="LAST_7_DAYS">Last 7 Days</option>
              <option value="LAST_30_DAYS">Last 30 Days</option>
              <option value="ALL_TIME">All Time</option>
              <option value="CUSTOM">Custom Range</option>
            </select>
          </label>
          {timeWindow === 'CUSTOM' ? (
            <>
              <label className="time-field">
                <span className="time-field-label">Start date</span>
                <input
                  className="time-input"
                  type="date"
                  value={customDateRange.start}
                  onChange={(event) => setCustomDateRange((prev) => ({ ...prev, start: event.target.value }))}
                />
              </label>
              <label className="time-field">
                <span className="time-field-label">End date</span>
                <input
                  className="time-input"
                  type="date"
                  value={customDateRange.end}
                  onChange={(event) => setCustomDateRange((prev) => ({ ...prev, end: event.target.value }))}
                />
              </label>
            </>
          ) : null}
        </div>
        <div className="time-filter-note">
          {timeWindow === 'CUSTOM' && (!customDateRange.start || !customDateRange.end)
            ? 'Pick both dates to apply the custom range.'
            : 'This affects logged hours, task totals, and the entries list below.'}
        </div>
      </div>

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
                <div className="card-title">Manual time entry</div>
                <div className="card-subtitle">Log start and end times manually for any assigned task</div>
              </div>
            </div>

            <form onSubmit={submitManualEntry} style={{ display: 'grid', gap: 10 }}>
              <TaskPickerSelect
                label="Task"
                value={manualEntry.taskId}
                onChange={(taskId) => setManualEntry((prev) => ({ ...prev, taskId }))}
                tasks={taskPickerItems}
                placeholder="Select task"
                searchPlaceholder="Search workspace, project, or task"
              />
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
                    disabled={Boolean(timer)||timerBusy}
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
              <div className="time-empty">No logged entries for {windowLabel.toLowerCase()}.</div>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {visibleLoggedEntries.map((entry) => {
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
                {canLoadMoreEntries ? (
                  <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 4 }}>
                    <button type="button" className="btn btn-secondary" onClick={loadMoreEntries}>
                      View more
                    </button>
                  </div>
                ) : null}
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
                <div className="card-subtitle">Top tasks by total tracked time in {windowLabel.toLowerCase()}</div>
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
