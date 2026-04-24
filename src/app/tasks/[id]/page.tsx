"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ChevronRight, Calendar, FolderOpen, User, CheckSquare, Plus, Pencil, Copy, Trash2, Check, RotateCcw, Save, X } from 'lucide-react';
import DataStatusBanner from '@/components/ui/DataStatusBanner';
import DiscussionThread from '@/components/ui/DiscussionThread';
import { useCachedApi } from '@/lib/useCachedApi';
import { toastError, toastSuccess } from '@/lib/toast';
import { toDateTimeLocalInput, toIsoOrUndefined } from '@/lib/datetimeLocal';

type Subtask = {
  id: string;
  title: string;
  isCompleted: boolean;
  dueDate?: string;
};

type TaskDetail = {
  _id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  dueDate?: string;
  startDate?: string;
  endDate?: string;
  projectId?: string | { _id?: string; name?: string };
  assigneeId?: { _id?: string; name?: string; email?: string };
  subtasks?: Subtask[];
};

type UserOption = {
  _id: string;
  name: string;
  email: string;
};

const TASK_STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  TODO: { label: 'To Do', color: '#60A5FA', bg: 'rgba(96,165,250,0.15)' },
  IN_PROGRESS: { label: 'In Progress', color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
  IN_REVIEW: { label: 'In Review', color: '#A78BFA', bg: 'rgba(167,139,250,0.15)' },
  BLOCKED: { label: 'Blocked', color: '#EF4444', bg: 'rgba(239,68,68,0.15)' },
  DONE: { label: 'Done', color: '#10B981', bg: 'rgba(16,185,129,0.15)' },
};

const DEFAULT_TASK_STATUSES = [
  { key: 'TODO', label: 'To Do' },
  { key: 'IN_PROGRESS', label: 'In Progress' },
  { key: 'IN_REVIEW', label: 'In Review' },
  { key: 'BLOCKED', label: 'Blocked' },
  { key: 'DONE', label: 'Done' },
];

export default function TaskDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const taskId = params.id;
  const [showCreateSubtask, setShowCreateSubtask] = useState(false);
  const [creatingSubtask, setCreatingSubtask] = useState(false);
  const [updatingSubtaskId, setUpdatingSubtaskId] = useState<string | null>(null);
  const [savingTaskMeta, setSavingTaskMeta] = useState(false);
  const [showEditTask, setShowEditTask] = useState(false);
  const [savingTaskEdit, setSavingTaskEdit] = useState(false);
  const [duplicatingTask, setDuplicatingTask] = useState(false);
  const [deletingTask, setDeletingTask] = useState(false);
  const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null);
  const [editingSubtaskTitle, setEditingSubtaskTitle] = useState('');
  const [editingSubtaskDueDate, setEditingSubtaskDueDate] = useState('');
  const [taskStatus, setTaskStatus] = useState('TODO');
  const [taskAssigneeId, setTaskAssigneeId] = useState('');
  const [projectStatuses, setProjectStatuses] = useState<Array<{ key: string; label: string }>>(DEFAULT_TASK_STATUSES);
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    dueDate: '',
    startDate: '',
    endDate: '',
    priority: 'MEDIUM',
    status: 'TODO',
    assigneeId: '',
  });
  const [subtaskForm, setSubtaskForm] = useState({
    title: '',
    dueDate: '',
  });

  const {
    data,
    loading,
    error,
    isRefreshing,
    lastUpdated,
    refresh,
  } = useCachedApi<TaskDetail | null>({
    cacheKey: `task-detail-${taskId}`,
    initialData: null,
    fetcher: async () => {
      const res = await fetch(`/api/tasks/${taskId}`, { cache: 'no-store' });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to load task');
      return json.data as TaskDetail;
    },
    enabled: Boolean(taskId),
    ttlMs: 45_000,
  });

  const {
    data: users,
  } = useCachedApi<UserOption[]>({
    cacheKey: 'task-detail-users-v1',
    initialData: [],
    fetcher: async () => {
      const res = await fetch('/api/users', { cache: 'no-store' });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to load users');
      return (json.data || []) as UserOption[];
    },
    ttlMs: 90_000,
  });

  const projectName = typeof data?.projectId === 'object' ? data?.projectId?.name : 'Project';
  const projectId = typeof data?.projectId === 'object' ? data?.projectId?._id : data?.projectId;

  useEffect(() => {
    if (!data) return;
    setTaskStatus(String(data.status || 'TODO').toUpperCase());
    setTaskAssigneeId(data.assigneeId?._id || '');
    setTaskForm({
      title: data.title || '',
      description: data.description || '',
      dueDate: data.dueDate ? new Date(data.dueDate).toISOString().slice(0, 10) : '',
      startDate: toDateTimeLocalInput(data.startDate),
      endDate: toDateTimeLocalInput(data.endDate),
      priority: String(data.priority || 'MEDIUM').toUpperCase(),
      status: String(data.status || 'TODO').toUpperCase(),
      assigneeId: data.assigneeId?._id || '',
    });
  }, [data]);

  useEffect(() => {
    const resolvedProjectId = typeof data?.projectId === 'object' ? data?.projectId?._id : data?.projectId;
    if (!resolvedProjectId) return;

    const loadProjectStatuses = async () => {
      try {
        const res = await fetch(`/api/projects/${resolvedProjectId}`, { cache: 'no-store' });
        const json = await res.json();
        if (!json.success) return;
        const statuses = Array.isArray(json.data?.project?.taskStatuses) ? json.data.project.taskStatuses : DEFAULT_TASK_STATUSES;
        if (!statuses.length) {
          setProjectStatuses(DEFAULT_TASK_STATUSES);
          return;
        }
        setProjectStatuses(statuses);
      } catch {
        setProjectStatuses(DEFAULT_TASK_STATUSES);
      }
    };

    void loadProjectStatuses();
  }, [data?.projectId]);

  const subtaskProgress = (() => {
    const total = data?.subtasks?.length || 0;
    const completed = (data?.subtasks || []).filter((subtask) => Boolean(subtask.isCompleted)).length;
    const percent = total ? Math.round((completed / total) * 100) : 0;
    return { total, completed, percent };
  })();

  const taskStatusMeta = TASK_STATUS_META[String(data?.status || 'TODO').toUpperCase()] || TASK_STATUS_META.TODO;

  const saveTaskEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data || !taskForm.title.trim()) return;
    setSavingTaskEdit(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: taskForm.title.trim(),
          description: taskForm.description.trim(),
          dueDate: taskForm.dueDate || undefined,
          startDate: toIsoOrUndefined(taskForm.startDate),
          endDate: toIsoOrUndefined(taskForm.endDate),
          status: taskForm.status,
          priority: taskForm.priority,
          assigneeId: taskForm.assigneeId || undefined,
          projectId: projectId || undefined,
          subtasks: (data.subtasks || []).map((subtask) => ({
            title: subtask.title,
            isCompleted: Boolean(subtask.isCompleted),
            dueDate: subtask.dueDate || undefined,
          })),
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to update task');
      toastSuccess('Task updated');
      setShowEditTask(false);
      await refresh();
    } catch (error: unknown) {
      toastError(error instanceof Error ? error.message : 'Failed to update task');
    } finally {
      setSavingTaskEdit(false);
    }
  };

  const duplicateTask = async () => {
    setDuplicatingTask(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: `${data?.title || 'Task'} (Copy)` }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to duplicate task');
      toastSuccess('Task duplicated');
      router.push(`/tasks/${json.data._id}`);
    } catch (error: unknown) {
      toastError(error instanceof Error ? error.message : 'Failed to duplicate task');
    } finally {
      setDuplicatingTask(false);
    }
  };

  const deleteTask = async () => {
    if (!window.confirm('Delete this task? This cannot be undone.')) return;
    setDeletingTask(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to delete task');
      toastSuccess('Task deleted');
      if (projectId) router.push(`/projects/${projectId}`);
      else router.push('/tasks');
    } catch (error: unknown) {
      toastError(error instanceof Error ? error.message : 'Failed to delete task');
    } finally {
      setDeletingTask(false);
    }
  };

  const saveTaskMeta = async () => {
    if (!data) return;
    setSavingTaskMeta(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: taskStatus,
          assigneeId: taskAssigneeId || undefined,
          title: data.title,
          description: data.description || '',
          dueDate: data.dueDate || undefined,
          startDate: toIsoOrUndefined(toDateTimeLocalInput(data.startDate)),
          endDate: toIsoOrUndefined(toDateTimeLocalInput(data.endDate)),
          priority: String(data.priority || 'MEDIUM').toUpperCase(),
          projectId: projectId || undefined,
          subtasks: (data.subtasks || []).map((subtask) => ({
            title: subtask.title,
            isCompleted: Boolean(subtask.isCompleted),
            dueDate: subtask.dueDate || undefined,
          })),
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to update task');
      toastSuccess('Task updated');
      await refresh();
    } catch (error: unknown) {
      toastError(error instanceof Error ? error.message : 'Failed to update task');
    } finally {
      setSavingTaskMeta(false);
    }
  };

  const persistSubtasks = async (nextSubtasks: Array<{ title: string; isCompleted: boolean; dueDate?: string }>) => {
    if (!data) return;

    const resolvedProjectId = typeof data.projectId === 'object' ? data.projectId?._id : data.projectId;
    const resolvedAssigneeId = data.assigneeId?._id;

    const res = await fetch(`/api/tasks/${taskId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: data.title,
        description: data.description || '',
        status: String(data.status || 'TODO').toUpperCase(),
        priority: String(data.priority || 'MEDIUM').toUpperCase(),
        dueDate: data.dueDate || undefined,
        startDate: toIsoOrUndefined(toDateTimeLocalInput(data.startDate)),
        endDate: toIsoOrUndefined(toDateTimeLocalInput(data.endDate)),
        projectId: resolvedProjectId,
        assigneeId: resolvedAssigneeId,
        subtasks: nextSubtasks,
      }),
    });

    const json = await res.json();
    if (!json.success) {
      throw new Error(json.error || 'Failed to update subtasks');
    }
  };

  const createSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data || !subtaskForm.title.trim()) return;

    setCreatingSubtask(true);
    try {
      const existingSubtasks = (data.subtasks || []).map((subtask) => ({
        title: subtask.title,
        isCompleted: Boolean(subtask.isCompleted),
        dueDate: subtask.dueDate || undefined,
      }));

      const nextSubtasks = [
        ...existingSubtasks,
        {
          title: subtaskForm.title.trim(),
          isCompleted: false,
          dueDate: subtaskForm.dueDate || undefined,
        },
      ];

      await persistSubtasks(nextSubtasks);

      toastSuccess('Subtask created');
      setSubtaskForm({ title: '', dueDate: '' });
      setShowCreateSubtask(false);
      await refresh();
    } catch (error: unknown) {
      toastError(error instanceof Error ? error.message : 'Failed to create subtask');
    } finally {
      setCreatingSubtask(false);
    }
  };

  const toggleSubtask = async (subtaskId: string) => {
    if (!data) return;
    setUpdatingSubtaskId(subtaskId);

    try {
      const nextSubtasks = (data.subtasks || []).map((subtask) => ({
        title: subtask.title,
        isCompleted: subtask.id === subtaskId ? !Boolean(subtask.isCompleted) : Boolean(subtask.isCompleted),
        dueDate: subtask.dueDate || undefined,
      }));

      await persistSubtasks(nextSubtasks);
      toastSuccess('Subtask updated');
      await refresh();
    } catch (error: unknown) {
      toastError(error instanceof Error ? error.message : 'Failed to update subtask');
    } finally {
      setUpdatingSubtaskId(null);
    }
  };

  const deleteSubtask = async (subtaskId: string) => {
    if (!data) return;
    setUpdatingSubtaskId(subtaskId);

    try {
      const nextSubtasks = (data.subtasks || [])
        .filter((subtask) => subtask.id !== subtaskId)
        .map((subtask) => ({
          title: subtask.title,
          isCompleted: Boolean(subtask.isCompleted),
          dueDate: subtask.dueDate || undefined,
        }));

      await persistSubtasks(nextSubtasks);
      toastSuccess('Subtask deleted');
      await refresh();
    } catch (error: unknown) {
      toastError(error instanceof Error ? error.message : 'Failed to delete subtask');
    } finally {
      setUpdatingSubtaskId(null);
    }
  };

  const beginEditSubtask = (subtask: Subtask) => {
    setEditingSubtaskId(subtask.id);
    setEditingSubtaskTitle(subtask.title);
    setEditingSubtaskDueDate(subtask.dueDate ? new Date(subtask.dueDate).toISOString().slice(0, 10) : '');
  };

  const saveSubtaskEdit = async (subtaskId: string) => {
    if (!data || !editingSubtaskTitle.trim()) return;
    setUpdatingSubtaskId(subtaskId);
    try {
      const nextSubtasks = (data.subtasks || []).map((subtask) => ({
        title: subtask.id === subtaskId ? editingSubtaskTitle.trim() : subtask.title,
        isCompleted: Boolean(subtask.isCompleted),
        dueDate: subtask.id === subtaskId ? (editingSubtaskDueDate || undefined) : (subtask.dueDate || undefined),
      }));

      await persistSubtasks(nextSubtasks);
      toastSuccess('Subtask updated');
      setEditingSubtaskId(null);
      setEditingSubtaskTitle('');
      setEditingSubtaskDueDate('');
      await refresh();
    } catch (error: unknown) {
      toastError(error instanceof Error ? error.message : 'Failed to update subtask');
    } finally {
      setUpdatingSubtaskId(null);
    }
  };

  const duplicateSubtask = async (subtaskId: string) => {
    if (!data) return;
    setUpdatingSubtaskId(subtaskId);
    try {
      const source = (data.subtasks || []).find((item) => item.id === subtaskId);
      if (!source) throw new Error('Subtask not found');

      const nextSubtasks = [
        ...(data.subtasks || []).map((subtask) => ({
          title: subtask.title,
          isCompleted: Boolean(subtask.isCompleted),
          dueDate: subtask.dueDate || undefined,
        })),
        {
          title: `${source.title} (Copy)`,
          isCompleted: false,
          dueDate: source.dueDate || undefined,
        },
      ];

      await persistSubtasks(nextSubtasks);
      toastSuccess('Subtask duplicated');
      await refresh();
    } catch (error: unknown) {
      toastError(error instanceof Error ? error.message : 'Failed to duplicate subtask');
    } finally {
      setUpdatingSubtaskId(null);
    }
  };

  return (
    <div className="page-wrapper animate-in">
      <nav className="breadcrumb" style={{ marginBottom: 14 }}>
        <span>DreamShift</span>
        <ChevronRight size={13} />
        <Link href="/tasks">My Tasks</Link>
        <ChevronRight size={13} />
        <span className="breadcrumb-active">Task Detail</span>
      </nav>

      <DataStatusBanner
        loading={loading}
        error={error}
        isRefreshing={isRefreshing}
        lastUpdated={lastUpdated}
        onRetry={refresh}
        onRefresh={refresh}
      />

      {!data ? (
        <div className="card" style={{ padding: 16, marginTop: 12 }}>
          {loading ? 'Loading task...' : 'Task not found.'}
        </div>
      ) : (
        <>
          {showEditTask && (
            <div className="modal-overlay" onClick={() => setShowEditTask(false)}>
              <form className="ws-settings-modal" onSubmit={saveTaskEdit} onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>Edit Task</div>
                </div>
                <div className="modal-body" style={{ display: 'grid', gap: 10 }}>
                  <input className="input" value={taskForm.title} onChange={(e) => setTaskForm((prev) => ({ ...prev, title: e.target.value }))} required />
                  <textarea className="input" style={{ minHeight: 90 }} value={taskForm.description} onChange={(e) => setTaskForm((prev) => ({ ...prev, description: e.target.value }))} />
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
                    <input className="input" type="date" value={taskForm.dueDate} onChange={(e) => setTaskForm((prev) => ({ ...prev, dueDate: e.target.value }))} />
                    <input className="input" type="datetime-local" value={taskForm.startDate} onChange={(e) => setTaskForm((prev) => ({ ...prev, startDate: e.target.value }))} />
                    <input className="input" type="datetime-local" value={taskForm.endDate} onChange={(e) => setTaskForm((prev) => ({ ...prev, endDate: e.target.value }))} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
                    <select className="input" value={taskForm.status} onChange={(e) => setTaskForm((prev) => ({ ...prev, status: e.target.value }))}>
                      {projectStatuses.map((status) => (
                        <option key={status.key} value={status.key}>{status.label}</option>
                      ))}
                    </select>
                    <select className="input" value={taskForm.priority} onChange={(e) => setTaskForm((prev) => ({ ...prev, priority: e.target.value }))}>
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                      <option value="URGENT">Urgent</option>
                    </select>
                    <select className="input" value={taskForm.assigneeId} onChange={(e) => setTaskForm((prev) => ({ ...prev, assigneeId: e.target.value }))}>
                      <option value="">Unassigned</option>
                      {users.map((user) => (
                        <option key={user._id} value={user._id}>{user.name} ({user.email})</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button className="btn btn-secondary" type="button" onClick={() => setShowEditTask(false)}>Cancel</button>
                    <button className="btn btn-primary" type="submit" disabled={savingTaskEdit}>{savingTaskEdit ? 'Saving...' : 'Save Changes'}</button>
                  </div>
                </div>
              </form>
            </div>
          )}

          <section className="card" style={{ padding: 18, marginTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>{data.title}</h1>
                <p className="text-sm text-muted" style={{ marginTop: 6 }}>{data.description || 'No description added yet.'}</p>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span className="badge" style={{ background: taskStatusMeta.bg, color: taskStatusMeta.color }}>{taskStatusMeta.label}</span>
                <span className="badge">{String(data.priority || 'medium')}</span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
              <button className="btn btn-secondary" type="button" onClick={() => setShowEditTask(true)}><Pencil size={13} /> Edit</button>
              <button className="btn btn-secondary" type="button" onClick={duplicateTask} disabled={duplicatingTask}><Copy size={13} /> {duplicatingTask ? 'Duplicating...' : 'Duplicate'}</button>
              <button className="btn btn-secondary" style={{ color: '#EF4444' }} type="button" onClick={deleteTask} disabled={deletingTask}><Trash2 size={13} /> {deletingTask ? 'Deleting...' : 'Delete'}</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, marginTop: 14 }}>
              <div className="card" style={{ padding: 12 }}>
                <div className="text-xs text-muted">Project</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <FolderOpen size={14} />
                  {projectId ? <Link href={`/projects/${projectId}`}>{projectName || 'Project'}</Link> : <span>{projectName || 'Project'}</span>}
                </div>
              </div>

              <div className="card" style={{ padding: 12 }}>
                <div className="text-xs text-muted">Assignee</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <User size={14} />
                  <span>{data.assigneeId?.name || data.assigneeId?.email || 'Unassigned'}</span>
                </div>
              </div>

              <div className="card" style={{ padding: 12 }}>
                <div className="text-xs text-muted">Due Date</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <Calendar size={14} />
                  <span>{data.dueDate ? new Date(data.dueDate).toLocaleDateString() : 'No due date'}</span>
                </div>
              </div>
            </div>

            <div className="card" style={{ padding: 12, marginTop: 12 }}>
              <div className="text-xs text-muted" style={{ marginBottom: 8 }}>Task Progress</div>
              <div className="progress-track" style={{ width: '100%', marginBottom: 6 }}>
                <div className="progress-fill" style={{ width: `${subtaskProgress.percent}%`, background: '#10B981' }} />
              </div>
              <div className="text-xs text-muted">
                {subtaskProgress.total === 0
                  ? 'No subtasks yet'
                  : `${subtaskProgress.completed}/${subtaskProgress.total} subtasks completed (${subtaskProgress.percent}%)`}
              </div>
            </div>

            <div className="card" style={{ padding: 12, marginTop: 12, display: 'grid', gap: 8 }}>
              <div className="text-xs text-muted">Quick Update</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
                <select className="input" value={taskStatus} onChange={(e) => setTaskStatus(e.target.value)}>
                  {projectStatuses.map((status) => (
                    <option key={status.key} value={status.key}>{status.label}</option>
                  ))}
                </select>
                <select className="input" value={taskAssigneeId} onChange={(e) => setTaskAssigneeId(e.target.value)}>
                  <option value="">Unassigned</option>
                  {users.map((user) => (
                    <option key={user._id} value={user._id}>{user.name} ({user.email})</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn btn-primary" type="button" onClick={saveTaskMeta} disabled={savingTaskMeta}>
                  {savingTaskMeta ? 'Saving...' : 'Save Task Changes'}
                </button>
              </div>
            </div>
          </section>

          <section className="card" style={{ padding: 18, marginTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 8, flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckSquare size={15} /> Subtasks
              </h2>
              <button className="btn btn-secondary" type="button" onClick={() => setShowCreateSubtask((prev) => !prev)}>
                <Plus size={13} /> {showCreateSubtask ? 'Close' : 'Create Subtask'}
              </button>
            </div>

            {showCreateSubtask && (
              <form className="card" style={{ padding: 12, marginBottom: 10, display: 'grid', gap: 8 }} onSubmit={createSubtask}>
                <input
                  className="input"
                  placeholder="Subtask title"
                  value={subtaskForm.title}
                  onChange={(e) => setSubtaskForm((prev) => ({ ...prev, title: e.target.value }))}
                  required
                />
                <input
                  className="input"
                  type="date"
                  value={subtaskForm.dueDate}
                  onChange={(e) => setSubtaskForm((prev) => ({ ...prev, dueDate: e.target.value }))}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button className="btn btn-secondary" type="button" onClick={() => setShowCreateSubtask(false)} disabled={creatingSubtask}>Cancel</button>
                  <button className="btn btn-primary" type="submit" disabled={creatingSubtask}>{creatingSubtask ? 'Creating...' : 'Create Subtask'}</button>
                </div>
              </form>
            )}

            {!data.subtasks || data.subtasks.length === 0 ? (
              <p className="text-sm text-muted">No subtasks available.</p>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                {data.subtasks.map((subtask) => (
                  <div
                    key={subtask.id}
                    className="card"
                    style={{
                      padding: 10,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                      flexWrap: 'wrap',
                      borderLeft: `3px solid ${subtask.isCompleted ? '#10B981' : '#F59E0B'}`,
                      background: subtask.isCompleted ? 'rgba(16,185,129,0.07)' : 'rgba(245,158,11,0.08)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', minWidth: 220, flex: 1 }}>
                      {editingSubtaskId === subtask.id ? (
                        <>
                          <input className="input" style={{ minWidth: 220 }} value={editingSubtaskTitle} onChange={(e) => setEditingSubtaskTitle(e.target.value)} />
                          <input className="input" type="date" value={editingSubtaskDueDate} onChange={(e) => setEditingSubtaskDueDate(e.target.value)} />
                        </>
                      ) : (
                        <>
                          <Link href={`/tasks/${data._id}/subtasks/${subtask.id}`}>{subtask.title}</Link>
                          <span
                            className="badge"
                            style={{
                              background: subtask.isCompleted ? 'rgba(16,185,129,0.18)' : 'rgba(245,158,11,0.18)',
                              color: subtask.isCompleted ? '#10B981' : '#F59E0B',
                            }}
                          >
                            {subtask.isCompleted ? 'Done' : 'Pending'}
                          </span>
                        </>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {editingSubtaskId === subtask.id ? (
                        <>
                          <button
                            className="btn btn-secondary"
                            type="button"
                            onClick={() => saveSubtaskEdit(subtask.id)}
                            disabled={updatingSubtaskId === subtask.id || !editingSubtaskTitle.trim()}
                          >
                            <Save size={13} /> Save
                          </button>
                          <button
                            className="btn btn-secondary"
                            type="button"
                            onClick={() => {
                              setEditingSubtaskId(null);
                              setEditingSubtaskTitle('');
                              setEditingSubtaskDueDate('');
                            }}
                            disabled={updatingSubtaskId === subtask.id}
                          >
                            <X size={13} /> Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            className="btn btn-secondary"
                            type="button"
                            onClick={() => beginEditSubtask(subtask)}
                            disabled={updatingSubtaskId === subtask.id}
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            className="btn btn-secondary"
                            type="button"
                            onClick={() => duplicateSubtask(subtask.id)}
                            disabled={updatingSubtaskId === subtask.id}
                          >
                            <Copy size={13} />
                          </button>
                        </>
                      )}
                      <button
                        className="btn btn-secondary"
                        type="button"
                        onClick={() => toggleSubtask(subtask.id)}
                        disabled={updatingSubtaskId === subtask.id}
                      >
                        {subtask.isCompleted ? <RotateCcw size={13} /> : <Check size={13} />}
                        {subtask.isCompleted ? 'Mark Pending' : 'Mark Done'}
                      </button>
                      <button
                        className="btn btn-secondary"
                        style={{ color: '#EF4444' }}
                        type="button"
                        onClick={() => deleteSubtask(subtask.id)}
                        disabled={updatingSubtaskId === subtask.id}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="card" style={{ padding: 18, marginTop: 12 }}>
            <DiscussionThread
              title="Task Discussion"
              endpoint={`/api/tasks/${taskId}/comments`}
              emptyMessage="No task discussion yet. Start a thread for this task."
            />
          </section>
        </>
      )}
    </div>
  );
}
