"use client";

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { CheckSquare, ChevronRight, Plus, RefreshCw, Search, Sparkles, Trash2 } from 'lucide-react';
import DataStatusBanner from '@/components/ui/DataStatusBanner';
import { useCachedApi } from '@/lib/useCachedApi';
import { toastError, toastSuccess } from '@/lib/toast';
import './tasks.css';

const STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
  todo: { label: 'To Do', badge: 'badge-todo' },
  in_progress: { label: 'In Progress', badge: 'badge-doing' },
  in_review: { label: 'In Review', badge: 'badge-low' },
  done: { label: 'Done', badge: 'badge-done' },
  blocked: { label: 'Blocked', badge: 'badge-blocked' },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  low: { label: 'Low', color: '#6B7280' },
  medium: { label: 'Medium', color: '#F59E0B' },
  high: { label: 'High', color: '#F97316' },
  urgent: { label: 'Urgent', color: '#EF4444' },
};

type AssignedTask = {
  _id: string;
  title: string;
  description?: string;
  dueDate?: string;
  status: string;
  priority: string;
  startDate?: string;
  endDate?: string;
  assigneeId?: { _id?: string; name?: string; email?: string };
  projectId?: { _id?: string; name?: string };
};

type ProjectOption = { _id: string; name: string };
type UserOption = { _id: string; name: string; email: string };

type TaskForm = {
  title: string;
  description: string;
  projectId: string;
  assigneeId: string;
  dueDate: string;
  priority: string;
  status: string;
  startDate: string;
  endDate: string;
};

type TasksPageData = {
  tasks: AssignedTask[];
  projects: ProjectOption[];
  users: UserOption[];
  scopeLabel: 'Assigned' | 'Workspace';
};

function formatDate(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

const EMPTY_FORM: TaskForm = {
  title: '',
  description: '',
  projectId: '',
  assigneeId: '',
  dueDate: '',
  priority: 'medium',
  status: 'todo',
  startDate: '',
  endDate: '',
};

export default function TasksPage() {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [form, setForm] = useState<TaskForm>(EMPTY_FORM);

  const fetchData = async (): Promise<TasksPageData> => {
    const [tasksRes, projectsRes, usersRes] = await Promise.all([
      fetch('/api/tasks?scope=assigned', { cache: 'no-store' }),
      fetch('/api/projects', { cache: 'no-store' }),
      fetch('/api/users', { cache: 'no-store' }),
    ]);

    const [tasksJson, projectsJson, usersJson] = await Promise.all([tasksRes.json(), projectsRes.json(), usersRes.json()]);

    if (!projectsJson.success || !usersJson.success || !tasksJson.success) {
      throw new Error(tasksJson.error || projectsJson.error || usersJson.error || 'Failed to load task resources');
    }

    return {
      tasks: tasksJson.data as AssignedTask[],
      projects: projectsJson.data as ProjectOption[],
      users: usersJson.data as UserOption[],
      scopeLabel: 'Assigned',
    };
  };

  const {
    data,
    loading,
    isRefreshing,
    error,
    lastUpdated,
    refresh,
    setData,
  } = useCachedApi<TasksPageData>({
    cacheKey: 'tasks-page-data-v1',
    initialData: { tasks: [], projects: [], users: [], scopeLabel: 'Assigned' },
    fetcher: fetchData,
    ttlMs: 90000,
  });

  const tasks = data.tasks;
  const projects = data.projects;
  const users = data.users;
  const scopeLabel = data.scopeLabel;

  const filtered = useMemo(() => {
    return tasks.filter((task) => {
      const matchesFilter = filter === 'all' || task.status === filter;
      const matchesSearch = !search || task.title?.toLowerCase().includes(search.toLowerCase());
      return matchesFilter && matchesSearch;
    });
  }, [filter, search, tasks]);

  const aiSummary = useMemo(() => {
    const overdue = filtered.filter((task) => task.dueDate && new Date(task.dueDate).getTime() < Date.now() && task.status !== 'done').length;
    const urgent = filtered.filter((task) => task.priority === 'urgent').length;
    return { overdue, urgent };
  }, [filtered]);

  const openCreateModal = () => {
    setEditingTaskId(null);
    setForm({
      ...EMPTY_FORM,
      projectId: projects[0]?._id || '',
      assigneeId: users[0]?._id || '',
    });
    setShowModal(true);
  };

  const openEditModal = (task: AssignedTask) => {
    setEditingTaskId(task._id);
    setForm({
      title: task.title || '',
      description: task.description || '',
      projectId: task.projectId?._id || '',
      assigneeId: task.assigneeId?._id || '',
      dueDate: task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : '',
      priority: task.priority || 'medium',
      status: task.status || 'todo',
      startDate: task.startDate ? new Date(task.startDate).toISOString().slice(0, 10) : '',
      endDate: task.endDate ? new Date(task.endDate).toISOString().slice(0, 10) : '',
    });
    setShowModal(true);
  };

  const submitTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.projectId) return;

    setSaving(true);
    const previousTasks = data.tasks;
    const selectedProject = projects.find((project) => project._id === form.projectId);
    const selectedUser = users.find((user) => user._id === form.assigneeId);

    const optimisticTask: AssignedTask = {
      _id: editingTaskId || `temp-${Date.now()}`,
      title: form.title,
      description: form.description || undefined,
      dueDate: form.dueDate || undefined,
      status: form.status,
      priority: form.priority,
      startDate: form.startDate || undefined,
      endDate: form.endDate || undefined,
      projectId: selectedProject ? { _id: selectedProject._id, name: selectedProject.name } : undefined,
      assigneeId: selectedUser ? { _id: selectedUser._id, name: selectedUser.name, email: selectedUser.email } : undefined,
    };

    setData((prev) => {
      if (editingTaskId) {
        return {
          ...prev,
          tasks: prev.tasks.map((task) => (task._id === editingTaskId ? optimisticTask : task)),
        };
      }

      return {
        ...prev,
        tasks: [optimisticTask, ...prev.tasks],
      };
    });

    try {
      const payload = {
        ...form,
        dueDate: form.dueDate || undefined,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
      };

      const res = await fetch(editingTaskId ? `/api/tasks/${editingTaskId}` : '/api/tasks', {
        method: editingTaskId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (json.success) {
        toastSuccess(editingTaskId ? 'Task updated' : 'Task created');
        setShowModal(false);
        await refresh();
      } else {
        setData((prev) => ({ ...prev, tasks: previousTasks }));
        toastError(json.error || 'Failed to save task');
      }
    } catch {
      setData((prev) => ({ ...prev, tasks: previousTasks }));
      toastError('Failed to save task');
    } finally {
      setSaving(false);
    }
  };

  const deleteTask = async () => {
    if (!editingTaskId) return;

    setSaving(true);
    const previousTasks = data.tasks;
    setData((prev) => ({
      ...prev,
      tasks: prev.tasks.filter((task) => task._id !== editingTaskId),
    }));

    try {
      const res = await fetch(`/api/tasks/${editingTaskId}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        toastSuccess('Task deleted');
        setShowModal(false);
        await refresh();
      } else {
        setData((prev) => ({ ...prev, tasks: previousTasks }));
        toastError(json.error || 'Failed to delete task');
      }
    } catch {
      setData((prev) => ({ ...prev, tasks: previousTasks }));
      toastError('Failed to delete task');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-wrapper animate-in">
      {showModal && (
        <div className="blade-overlay" onClick={() => setShowModal(false)}>
          <form
            className="card"
            style={{ position: 'absolute', inset: '10% auto auto 50%', transform: 'translateX(-50%)', width: 'min(700px, 94vw)', padding: 18, maxHeight: '80vh', overflowY: 'auto' }}
            onSubmit={submitTask}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginBottom: 12, fontSize: 18 }}>{editingTaskId ? 'Edit Task' : 'Create Task'}</h2>
            <div style={{ display: 'grid', gap: 10 }}>
              <input className="input" placeholder="Task Name" value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} required />
              <textarea className="input" placeholder="Description" value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} style={{ minHeight: 90 }} />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <select className="input" value={form.projectId} onChange={(e) => setForm((prev) => ({ ...prev, projectId: e.target.value }))} required>
                  <option value="">Select Project</option>
                  {projects.map((project) => <option key={project._id} value={project._id}>{project.name}</option>)}
                </select>
                <select className="input" value={form.assigneeId} onChange={(e) => setForm((prev) => ({ ...prev, assigneeId: e.target.value }))}>
                  <option value="">Select Assignee</option>
                  {users.map((user) => <option key={user._id} value={user._id}>{user.name} ({user.email})</option>)}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <input className="input" type="date" value={form.dueDate} onChange={(e) => setForm((prev) => ({ ...prev, dueDate: e.target.value }))} />
                <select className="input" value={form.priority} onChange={(e) => setForm((prev) => ({ ...prev, priority: e.target.value }))}>
                  {Object.entries(PRIORITY_CONFIG).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}
                </select>
                <select className="input" value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}>
                  {Object.entries(STATUS_CONFIG).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <input className="input" type="date" value={form.startDate} onChange={(e) => setForm((prev) => ({ ...prev, startDate: e.target.value }))} />
                <input className="input" type="date" value={form.endDate} onChange={(e) => setForm((prev) => ({ ...prev, endDate: e.target.value }))} />
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
                <div>
                  {editingTaskId && (
                    <button className="btn btn-danger" type="button" onClick={deleteTask} disabled={saving}>
                      <Trash2 size={13} /> Delete
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-secondary" type="button" onClick={() => setShowModal(false)}>Cancel</button>
                  <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Saving...' : (editingTaskId ? 'Update Task' : 'Create Task')}</button>
                </div>
              </div>
            </div>
          </form>
        </div>
      )}

      <div className="tasks-header">
        <div>
          <nav className="breadcrumb">
            <span>DreamShift</span>
            <ChevronRight size={13} />
            <span className="breadcrumb-active">Assigned Tasks</span>
          </nav>
          <h1 className="page-title" style={{ marginTop: 6 }}>My Assigned Tasks</h1>
        </div>
        <div className="tasks-header-actions">
          <button className="btn btn-secondary" onClick={refresh} disabled={isRefreshing}>
            <RefreshCw size={14} /> Refresh
          </button>
          <button className="btn btn-primary" onClick={openCreateModal}><Plus size={14} /> New Task</button>
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

      <div className="text-xs text-muted" style={{ marginBottom: 10 }}>
        Showing {scopeLabel.toLowerCase()} tasks loaded from database.
      </div>

      <div className="ai-suggestor" style={{ marginBottom: 14 }}>
        <div className="ai-suggestor-icon">✦</div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>Data Science Assist</div>
          <div className="text-xs text-muted">
            Predicted overload: {aiSummary.urgent} urgent and {aiSummary.overdue} overdue tasks in your queue.
          </div>
        </div>
        <span className="badge" style={{ marginLeft: 'auto' }}><Sparkles size={10} /> AI</span>
      </div>

      <div className="tasks-filters">
        <div className="search-wrap">
          <Search size={14} className="search-icon" />
          <input className="input search-input" placeholder="Search assigned tasks..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="filter-pills">
          {['all', 'todo', 'in_progress', 'in_review', 'done', 'blocked'].map((f) => (
            <button key={f} className={`filter-pill ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
              {f === 'all' ? 'All' : STATUS_CONFIG[f]?.label || f}
            </button>
          ))}
        </div>
      </div>

      <div className="task-table card">
        <div className="task-table-header">
          <span>Task</span><span>Project</span><span>Priority</span><span>Due</span><span>Status</span>
        </div>

        {loading ? (
          <div className="empty-state" style={{ padding: 40 }}>
            <p className="text-muted text-sm">Loading tasks...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state" style={{ padding: 40 }}>
            <CheckSquare size={28} color="var(--text-disabled)" />
            <p className="text-muted text-sm" style={{ marginTop: 8 }}>No assigned tasks match this filter.</p>
          </div>
        ) : filtered.map((task) => {
          const status = STATUS_CONFIG[task.status] || STATUS_CONFIG.todo;
          const priority = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
          return (
            <div key={task._id} className="task-row" onClick={() => openEditModal(task)}>
              <span className="task-row-title">
                <Link href={`/tasks/${task._id}`} onClick={(e) => e.stopPropagation()}>
                  {task.title}
                </Link>
              </span>
              <span className="text-sm text-muted">{task.projectId?.name || '—'}</span>
              <span>
                <span className="badge" style={{ background: `${priority.color}1A`, color: priority.color }}>
                  {priority.label}
                </span>
              </span>
              <span className="text-sm text-muted">{formatDate(task.dueDate)}</span>
              <span className={`badge ${status.badge}`}>{status.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
