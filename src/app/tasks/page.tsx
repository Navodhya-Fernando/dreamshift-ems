"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CheckSquare, ChevronRight, FolderOpen, Plus, RefreshCw, Search, Sparkles, Trash2 } from 'lucide-react';
import DataStatusBanner from '@/components/ui/DataStatusBanner';
import { useCachedApi } from '@/lib/useCachedApi';
import { toastError, toastSuccess } from '@/lib/toast';
import { toDateTimeLocalInput, toIsoOrUndefined } from '@/lib/datetimeLocal';
import './tasks.css';
import './page.css';

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
  assigneeIds?: Array<{ _id?: string; name?: string; email?: string }>;
  projectId?: { _id?: string; name?: string };
};

type ProjectOption = {
  _id: string;
  name: string;
  workspaceId?: string;
  workspace_id?: string;
  taskStatuses?: Array<{ key: string; label: string }>;
};
type UserOption = { _id: string; name: string; email: string; image?: string; linkedinProfilePicUrl?: string };
type WorkspaceOption = { _id: string; name: string };

type TaskForm = {
  title: string;
  description: string;
  projectId: string;
  assigneeIds: string[];
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
  workspaces: WorkspaceOption[];
  scopeLabel: 'Assigned' | 'Workspace';
};

const DEFAULT_STATUSES = [
  { key: 'todo', label: 'To Do' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'in_review', label: 'In Review' },
  { key: 'blocked', label: 'Blocked' },
  { key: 'done', label: 'Done' },
];

function formatDate(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function toStatusLabel(status?: string) {
  const normalized = String(status || '').toLowerCase();
  if (STATUS_CONFIG[normalized]) return STATUS_CONFIG[normalized].label;
  return normalized
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase()) || 'To Do';
}

function avatarInitials(value: string) {
  return value
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function avatarTone(value: string) {
  const hash = Array.from(value).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const palette = ['#2563EB', '#0F766E', '#7C3AED', '#DC2626', '#EA580C'];
  return palette[hash % palette.length];
}

function resolveAvatarUrl(value?: { image?: string; linkedinProfilePicUrl?: string } | null) {
  if (!value) return '';
  return String(value.linkedinProfilePicUrl || value.image || '').trim();
}

const EMPTY_FORM: TaskForm = {
  title: '',
  description: '',
  projectId: '',
  assigneeIds: [],
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
  const [modalWorkspaceId, setModalWorkspaceId] = useState('');
  const [showAssigneeMenu, setShowAssigneeMenu] = useState(false);
  const [assigneeQuery, setAssigneeQuery] = useState('');
  const [form, setForm] = useState<TaskForm>(EMPTY_FORM);

  const fetchData = async (): Promise<TasksPageData> => {
    const [tasksRes, projectsRes, usersRes, workspacesRes] = await Promise.all([
      fetch('/api/tasks?scope=assigned', { cache: 'no-store' }),
      fetch('/api/projects', { cache: 'no-store' }),
      fetch('/api/users', { cache: 'no-store' }),
      fetch('/api/workspaces', { cache: 'no-store' }),
    ]);

    const [tasksJson, projectsJson, usersJson, workspacesJson] = await Promise.all([tasksRes.json(), projectsRes.json(), usersRes.json(), workspacesRes.json()]);

    if (!projectsJson.success || !usersJson.success || !tasksJson.success || !workspacesJson.success) {
      throw new Error(tasksJson.error || projectsJson.error || usersJson.error || workspacesJson.error || 'Failed to load task resources');
    }

    return {
      tasks: tasksJson.data as AssignedTask[],
      projects: projectsJson.data as ProjectOption[],
      users: usersJson.data as UserOption[],
      workspaces: workspacesJson.data as WorkspaceOption[],
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
    initialData: { tasks: [], projects: [], users: [], workspaces: [], scopeLabel: 'Assigned' },
    fetcher: fetchData,
    ttlMs: 90000,
  });

  const tasks = data.tasks;
  const projects = data.projects;
  const users = data.users;
  const workspaces = data.workspaces;
  const scopeLabel = data.scopeLabel;

  useEffect(() => {
    if (!showModal) {
      setShowAssigneeMenu(false);
      setAssigneeQuery('');
    }
  }, [showModal]);

  const projectsForModalWorkspace = useMemo(() => {
    if (!modalWorkspaceId) return projects;
    return projects.filter((project) => {
      const projectWorkspaceId = String(project.workspaceId || project.workspace_id || '');
      return projectWorkspaceId === modalWorkspaceId;
    });
  }, [modalWorkspaceId, projects]);

  const filtered = useMemo(() => {
    return tasks.filter((task) => {
      const matchesFilter = filter === 'all' || task.status === filter;
      const matchesSearch = !search || task.title?.toLowerCase().includes(search.toLowerCase());
      return matchesFilter && matchesSearch;
    });
  }, [filter, search, tasks]);

  const statusFilters = useMemo(() => {
    const set = new Set<string>();
    tasks.forEach((task) => set.add(String(task.status || 'todo').toLowerCase()));
    return ['all', ...Array.from(set)];
  }, [tasks]);

  const aiSummary = useMemo(() => {
    const overdue = filtered.filter((task) => task.dueDate && new Date(task.dueDate).getTime() < Date.now() && task.status !== 'done').length;
    const urgent = filtered.filter((task) => task.priority === 'urgent').length;
    return { overdue, urgent };
  }, [filtered]);

  const myProjects = useMemo(() => {
    const grouped = new Map<string, { id?: string; name: string; total: number; open: number; overdue: number }>();

    tasks.forEach((task) => {
      const projectId = String(task.projectId?._id || '');
      const projectName = String(task.projectId?.name || 'General');
      const key = projectId || projectName.toLowerCase();

      if (!grouped.has(key)) {
        grouped.set(key, { id: projectId || undefined, name: projectName, total: 0, open: 0, overdue: 0 });
      }

      const current = grouped.get(key);
      if (!current) return;

      current.total += 1;
      const isDone = String(task.status || '').toLowerCase() === 'done';
      if (!isDone) {
        current.open += 1;
        if (task.dueDate && new Date(task.dueDate).getTime() < Date.now()) {
          current.overdue += 1;
        }
      }
    });

    return Array.from(grouped.values()).sort((left, right) => {
      if (right.open !== left.open) return right.open - left.open;
      if (right.overdue !== left.overdue) return right.overdue - left.overdue;
      return left.name.localeCompare(right.name);
    });
  }, [tasks]);

  const availableStatuses = useMemo(() => {
    const selectedProject = projects.find((project) => project._id === form.projectId);
    const projectStatuses = (selectedProject as ProjectOption & { taskStatuses?: Array<{ key: string; label: string }> } | undefined)?.taskStatuses;
    if (!projectStatuses || projectStatuses.length === 0) return DEFAULT_STATUSES;
    return projectStatuses.map((status) => ({
      key: String(status.key || '').toLowerCase(),
      label: String(status.label || status.key || ''),
    }));
  }, [projects, form.projectId]);

  const selectedAssignees = useMemo(() => {
    return users.filter((user) => form.assigneeIds.includes(user._id));
  }, [form.assigneeIds, users]);

  const filteredAssignees = useMemo(() => {
    const query = assigneeQuery.trim().toLowerCase();
    return users.filter((user) => {
      const matchesQuery = !query || user.name.toLowerCase().includes(query) || user.email.toLowerCase().includes(query);
      return matchesQuery;
    });
  }, [assigneeQuery, users]);

  React.useEffect(() => {
    if (modalWorkspaceId || workspaces.length === 0) return;
    setModalWorkspaceId(String(workspaces[0]._id));
  }, [modalWorkspaceId, workspaces]);

  const openCreateModal = () => {
    setEditingTaskId(null);
    setShowAssigneeMenu(false);
    setAssigneeQuery('');
    const initialWorkspaceId = modalWorkspaceId || String(workspaces[0]?._id || '');
    const initialProjects = projects.filter((project) => String(project.workspaceId || project.workspace_id || '') === initialWorkspaceId);
    const initialProjectId = initialProjects[0]?._id || projects[0]?._id || '';
    const initialProject = projects.find((project) => project._id === initialProjectId) as (ProjectOption & { taskStatuses?: Array<{ key: string; label: string }> }) | undefined;
    const initialStatuses = initialProject?.taskStatuses?.length
      ? initialProject.taskStatuses.map((status) => ({ key: String(status.key || '').toLowerCase(), label: String(status.label || status.key || '') }))
      : DEFAULT_STATUSES;
    setForm({
      ...EMPTY_FORM,
      projectId: initialProjectId,
      assigneeIds: [],
      status: initialStatuses[0]?.key || 'todo',
    });
    if (initialWorkspaceId) setModalWorkspaceId(initialWorkspaceId);
    setShowModal(true);
  };

  const openEditModal = (task: AssignedTask) => {
    setEditingTaskId(task._id);
    setShowAssigneeMenu(false);
    setAssigneeQuery('');
    const editingProject = projects.find((project) => project._id === (task.projectId?._id || ''));
    const projectWorkspaceId = String(editingProject?.workspaceId || editingProject?.workspace_id || '');
    if (projectWorkspaceId) setModalWorkspaceId(projectWorkspaceId);
    setForm({
      title: task.title || '',
      description: task.description || '',
      projectId: task.projectId?._id || '',
      assigneeIds: (task.assigneeIds || []).map((assignee) => String(assignee._id || '')).filter(Boolean).length > 0
        ? (task.assigneeIds || []).map((assignee) => String(assignee._id || '')).filter(Boolean)
        : (task.assigneeId?._id ? [task.assigneeId._id] : []),
      dueDate: task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : '',
      priority: task.priority || 'medium',
      status: task.status || 'todo',
      startDate: toDateTimeLocalInput(task.startDate),
      endDate: toDateTimeLocalInput(task.endDate),
    });
    setShowModal(true);
  };

  const toggleAssignee = (assigneeId: string) => {
    setForm((prev) => ({
      ...prev,
      assigneeIds: prev.assigneeIds.includes(assigneeId)
        ? prev.assigneeIds.filter((currentId) => currentId !== assigneeId)
        : [...prev.assigneeIds, assigneeId],
    }));
  };

  const removeAssignee = (assigneeId: string) => {
    setForm((prev) => ({
      ...prev,
      assigneeIds: prev.assigneeIds.filter((currentId) => currentId !== assigneeId),
    }));
  };

  const submitTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.projectId) return;

    setSaving(true);
    const previousTasks = data.tasks;
    const selectedProject = projects.find((project) => project._id === form.projectId);
    const selectedUsers = users.filter((user) => form.assigneeIds.includes(user._id));

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
      assigneeId: selectedUsers[0] ? { _id: selectedUsers[0]._id, name: selectedUsers[0].name, email: selectedUsers[0].email } : undefined,
      assigneeIds: selectedUsers.map((user) => ({ _id: user._id, name: user.name, email: user.email })),
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
        startDate: toIsoOrUndefined(form.startDate),
        endDate: toIsoOrUndefined(form.endDate),
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
                <select
                  className="input"
                  value={modalWorkspaceId}
                  onChange={(e) => {
                    const nextWorkspaceId = e.target.value;
                    setModalWorkspaceId(nextWorkspaceId);
                    const nextProjects = projects.filter((project) => String(project.workspaceId || project.workspace_id || '') === nextWorkspaceId);
                    const validProject = nextProjects.some((project) => project._id === form.projectId);
                    setForm((prev) => ({ ...prev, projectId: validProject ? prev.projectId : (nextProjects[0]?._id || '') }));
                  }}
                  required
                >
                  <option value="">Select Workspace</option>
                  {workspaces.map((workspace) => <option key={workspace._id} value={workspace._id}>{workspace.name}</option>)}
                </select>
                <select className="input" value={form.projectId} onChange={(e) => setForm((prev) => ({ ...prev, projectId: e.target.value }))} required>
                  <option value="">Select Project</option>
                  {projectsForModalWorkspace.map((project) => <option key={project._id} value={project._id}>{project.name}</option>)}
                </select>
              </div>

              <div className="assignee-picker-wrap">
                <div className="assignee-picker-header">
                  <div>
                    <div className="assignee-picker-label">Assignees</div>
                    <div className="text-xs text-muted">Select one or more people for this task.</div>
                  </div>
                  <button
                    className="btn btn-secondary assignee-picker-button"
                    type="button"
                    onClick={() => setShowAssigneeMenu((current) => !current)}
                  >
                    <Plus size={12} />
                    Add Assignee
                  </button>
                </div>

                {selectedAssignees.length > 0 ? (
                  <div className="assignee-chip-row">
                    {selectedAssignees.map((user) => {
                      const avatarUrl = resolveAvatarUrl(user);
                      const initials = avatarInitials(user.name || user.email || 'A');
                      return (
                        <span key={user._id} className="assignee-chip">
                          <span className="assignee-chip-avatar" style={!avatarUrl ? { background: avatarTone(user.name || user.email || user._id) } : undefined}>
                            {avatarUrl ? <img src={avatarUrl} alt={user.name} /> : initials}
                          </span>
                          <span className="assignee-chip-name">{user.name}</span>
                          <button type="button" className="assignee-chip-remove" onClick={() => removeAssignee(user._id)} aria-label={`Remove ${user.name}`}>
                            ×
                          </button>
                        </span>
                      );
                    })}
                  </div>
                ) : (
                  <div className="assignee-picker-empty">No assignees selected yet.</div>
                )}

                {showAssigneeMenu && (
                  <div className="assignee-dropdown" onClick={(event) => event.stopPropagation()}>
                    <div className="assignee-dropdown-topbar">
                      <input
                        className="input assignee-dropdown-search"
                        placeholder="Search people..."
                        value={assigneeQuery}
                        onChange={(event) => setAssigneeQuery(event.target.value)}
                      />
                      <button className="btn btn-secondary assignee-dropdown-done" type="button" onClick={() => setShowAssigneeMenu(false)}>
                        Done
                      </button>
                    </div>
                    <div className="assignee-dropdown-list">
                      {filteredAssignees.length === 0 ? (
                        <div className="assignee-dropdown-empty">No people match this search.</div>
                      ) : (
                        filteredAssignees.map((user) => {
                          const selected = form.assigneeIds.includes(user._id);
                          const avatarUrl = resolveAvatarUrl(user);
                          const initials = avatarInitials(user.name || user.email || 'A');
                          return (
                            <button
                              key={user._id}
                              type="button"
                              className={`assignee-option ${selected ? 'is-selected' : ''}`}
                              onClick={() => toggleAssignee(user._id)}
                            >
                              <span className="assignee-option-avatar" style={!avatarUrl ? { background: avatarTone(user.name || user.email || user._id) } : undefined}>
                                {avatarUrl ? <img src={avatarUrl} alt={user.name} /> : initials}
                              </span>
                              <span className="assignee-option-meta">
                                <span className="assignee-option-name">{user.name}</span>
                                <span className="assignee-option-email">{user.email}</span>
                              </span>
                              <span className={`assignee-option-check ${selected ? 'is-visible' : ''}`}>✓</span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <input className="input" type="date" value={form.dueDate} onChange={(e) => setForm((prev) => ({ ...prev, dueDate: e.target.value }))} />
                <select className="input" value={form.priority} onChange={(e) => setForm((prev) => ({ ...prev, priority: e.target.value }))}>
                  {Object.entries(PRIORITY_CONFIG).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}
                </select>
                <select className="input" value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}>
                  {availableStatuses.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <input className="input" type="datetime-local" value={form.startDate} onChange={(e) => setForm((prev) => ({ ...prev, startDate: e.target.value }))} />
                <input className="input" type="datetime-local" value={form.endDate} onChange={(e) => setForm((prev) => ({ ...prev, endDate: e.target.value }))} />
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

      <div className="my-projects-block card">
        <div className="my-projects-header">
          <div className="my-projects-title"><FolderOpen size={14} /> My Projects</div>
          <span className="text-xs text-muted">Projects with tasks assigned to you</span>
        </div>
        {myProjects.length === 0 ? (
          <div className="my-projects-empty text-sm text-muted">No assigned projects yet.</div>
        ) : (
          <div className="my-projects-grid">
            {myProjects.map((project) => {
              const card = (
                <>
                  <div className="my-projects-name">{project.name}</div>
                  <div className="my-projects-stats">
                    <span className="my-projects-chip">{project.total} total</span>
                    <span className="my-projects-chip">{project.open} open</span>
                    {project.overdue > 0 ? <span className="my-projects-chip is-overdue">{project.overdue} overdue</span> : null}
                  </div>
                  <div className="my-projects-meta">{project.open === 0 ? 'All clear in this project' : 'Has active assigned work'}</div>
                </>
              );

              return project.id ? (
                <Link key={`${project.id}-${project.name}`} href={`/projects/${project.id}`} className="my-projects-card">
                  {card}
                </Link>
              ) : (
                <div key={project.name} className="my-projects-card">{card}</div>
              );
            })}
          </div>
        )}
      </div>

      <div className="tasks-filters">
        <div className="search-wrap">
          <Search size={14} className="search-icon" />
          <input className="input search-input" placeholder="Search assigned tasks..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="filter-pills">
          {statusFilters.map((f) => (
            <button key={f} className={`filter-pill ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
              {f === 'all' ? 'All' : toStatusLabel(f)}
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
          const status = STATUS_CONFIG[String(task.status || '').toLowerCase()] || STATUS_CONFIG.todo;
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
              <span className={`badge ${status.badge || 'badge-todo'}`}>{toStatusLabel(task.status)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
