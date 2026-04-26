"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { AlertCircle, ChevronRight, Sparkles, Pencil, Copy, Trash2, Plus } from 'lucide-react';
import { toastError, toastSuccess } from '@/lib/toast';
import DiscussionThread from '@/components/ui/DiscussionThread';
import '../projects.css';

type ProjectPayload = {
  project: {
    _id: string;
    name: string;
    description?: string;
    deadline?: string;
    status?: 'ACTIVE' | 'CLOSED';
    startDate?: string;
    endDate?: string;
    taskStatuses?: Array<{ key: string; label: string }>;
    taskTemplate?: string;
  };
  tasks: Array<{
    _id: string;
    title: string;
    description?: string;
    dueDate?: string;
    startDate?: string;
    endDate?: string;
    status: string;
    priority?: string;
    assigneeId?: { _id?: string; name?: string; email?: string; image?: string; linkedinProfilePicUrl?: string };
    assigneeIds?: Array<{ _id?: string; name?: string; email?: string; image?: string; linkedinProfilePicUrl?: string }>;
  }>;
  taskStats: {
    total: number;
    todo: number;
    inProgress: number;
    done: number;
    blocked: number;
  };
};

type ProjectTaskStatus = {
  key: string;
  label: string;
};

type UserOption = {
  _id: string;
  name: string;
  email: string;
  image?: string;
  linkedinProfilePicUrl?: string;
};

type TaskTemplateOption = {
  key: string;
  title: string;
};

const DEFAULT_TASK_STATUSES: ProjectTaskStatus[] = [
  { key: 'TODO', label: 'To Do' },
  { key: 'IN_PROGRESS', label: 'In Progress' },
  { key: 'IN_REVIEW', label: 'In Review' },
  { key: 'BLOCKED', label: 'Blocked' },
  { key: 'DONE', label: 'Done' },
];

const PRIORITY_META: Record<string, { label: string; color: string }> = {
  LOW: { label: 'Low', color: '#6B7280' },
  MEDIUM: { label: 'Medium', color: '#F59E0B' },
  HIGH: { label: 'High', color: '#F97316' },
  URGENT: { label: 'Urgent', color: '#EF4444' },
};

const STATUS_TONES = ['#60A5FA', '#F59E0B', '#A78BFA', '#EF4444', '#10B981', '#2DD4BF', '#FB7185'];

function statusToneByKey(key: string) {
  const idx = Math.abs(String(key || '').split('').reduce((sum, char) => sum + char.charCodeAt(0), 0));
  const color = STATUS_TONES[idx % STATUS_TONES.length];
  return { color, bg: `${color}1C` };
}

function toDateTimeInput(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const tzOffsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - tzOffsetMs).toISOString().slice(0, 16);
}

function toIso(value?: string) {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString();
}

function normalizeStatusEntries(value: string): ProjectTaskStatus[] {
  const entries = value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const key = line.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');
      return {
        key,
        label: line,
      };
    })
    .filter((entry) => Boolean(entry.key));

  if (entries.length === 0) return DEFAULT_TASK_STATUSES;
  return entries;
}

function initials(value: string) {
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

function AssigneeStack({ assignees }: { assignees: Array<{ _id?: string; name?: string; email?: string; image?: string; linkedinProfilePicUrl?: string }> }) {
  if (!assignees.length) return <span className="text-xs text-muted">Unassigned</span>;

  const shown = assignees.slice(0, 3);
  const extra = assignees.length - shown.length;

  return (
    <div className="assignee-stack" title={assignees.map((assignee) => assignee.name || assignee.email || 'User').join(', ')}>
      {shown.map((assignee, index) => {
        const label = String(assignee.name || assignee.email || 'User');
        const avatarUrl = resolveAvatarUrl(assignee);
        return (
          <span
            key={`${assignee._id || label}-${index}`}
            className="assignee-avatar"
            style={{ background: avatarTone(label), zIndex: shown.length - index }}
          >
            {avatarUrl ? <img src={avatarUrl} alt={label} /> : initials(label)}
          </span>
        );
      })}
      {extra > 0 ? <span className="assignee-avatar assignee-avatar-more">+{extra}</span> : null}
    </div>
  );
}

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const projectId = params.id;

  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<ProjectPayload | null>(null);

  const [showEditProject, setShowEditProject] = useState(false);
  const [savingProject, setSavingProject] = useState(false);
  const [projectForm, setProjectForm] = useState({
    name: '',
    description: '',
    deadline: '',
    status: 'ACTIVE',
    startDate: '',
    endDate: '',
    taskStatusesText: '',
    taskTemplate: 'NO_TEMPLATE',
  });
  const [duplicatingProject, setDuplicatingProject] = useState(false);
  const [deletingProject, setDeletingProject] = useState(false);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [templateOptions, setTemplateOptions] = useState<TaskTemplateOption[]>([{ key: 'NO_TEMPLATE', title: 'No Template' }]);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [savingTask, setSavingTask] = useState(false);
  const [showTaskAssigneePicker, setShowTaskAssigneePicker] = useState(false);
  const [taskAssigneeQuery, setTaskAssigneeQuery] = useState('');
  const [activeKanbanAssigneeTaskId, setActiveKanbanAssigneeTaskId] = useState<string | null>(null);
  const [kanbanAssigneeQuery, setKanbanAssigneeQuery] = useState('');
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    dueDate: '',
    status: 'TODO',
    priority: 'MEDIUM',
    assigneeIds: [] as string[],
  });

  const loadProject = useCallback(async () => {
    const [projectRes, usersRes, templatesRes] = await Promise.all([
      fetch(`/api/projects/${projectId}`),
      fetch('/api/users', { cache: 'no-store' }),
      fetch('/api/task-templates', { cache: 'no-store' }),
    ]);
    const [projectJson, usersJson, templatesJson] = await Promise.all([projectRes.json(), usersRes.json(), templatesRes.json()]);
    if (projectJson.success) {
      const nextStatuses = ((projectJson.data.project.taskStatuses || DEFAULT_TASK_STATUSES) as ProjectTaskStatus[]);
      setPayload({ ...projectJson.data });
      setProjectForm({
        name: projectJson.data.project.name || '',
        description: projectJson.data.project.description || '',
        deadline: projectJson.data.project.deadline ? new Date(projectJson.data.project.deadline).toISOString().slice(0, 10) : '',
        status: String(projectJson.data.project.status || 'ACTIVE').toUpperCase() === 'CLOSED' ? 'CLOSED' : 'ACTIVE',
        startDate: toDateTimeInput(projectJson.data.project.startDate),
        endDate: toDateTimeInput(projectJson.data.project.endDate),
        taskStatusesText: nextStatuses
          .map((status) => status.label)
          .join('\n'),
        taskTemplate: projectJson.data.project.taskTemplate || 'NO_TEMPLATE',
      });
      setTaskForm((prev) => ({
        ...prev,
        status: nextStatuses.some((item) => item.key === prev.status) ? prev.status : (nextStatuses[0]?.key || 'TODO'),
      }));
    }
    if (usersJson.success) {
      setUsers((usersJson.data || []).map((user: { _id: string; name?: string; email?: string; image?: string; linkedinProfilePicUrl?: string }) => ({
        _id: String(user._id),
        name: String(user.name || user.email || 'User'),
        email: String(user.email || ''),
        image: String(user.image || ''),
        linkedinProfilePicUrl: String(user.linkedinProfilePicUrl || ''),
      })));
    }
    if (templatesJson.success) {
      const options = (templatesJson.data || []).map((template: { key: string; title: string }) => ({
        key: String(template.key || ''),
        title: String(template.title || template.key || 'Template'),
      }));
      setTemplateOptions(options.length > 0 ? options : [{ key: 'NO_TEMPLATE', title: 'No Template' }]);
    }
  }, [projectId]);

  const templateTitleByKey = useMemo(() => {
    const map = new Map<string, string>();
    templateOptions.forEach((option) => {
      map.set(option.key, option.title);
    });
    return map;
  }, [templateOptions]);

  useEffect(() => {
    const run = async () => {
      try {
        await loadProject();
      } finally {
        setLoading(false);
      }
    };
    if (projectId) run();
  }, [projectId, loadProject]);

  const progress = useMemo(() => {
    if (!payload) return 0;
    const { total, done } = payload.taskStats;
    return total ? Math.round((done / total) * 100) : 0;
  }, [payload]);

  const taskAssigneeOptions = useMemo(() => {
    const query = taskAssigneeQuery.trim().toLowerCase();
    return users.filter((user) => !query || user.name.toLowerCase().includes(query) || user.email.toLowerCase().includes(query));
  }, [taskAssigneeQuery, users]);

  const kanbanAssigneeOptions = useMemo(() => {
    const query = kanbanAssigneeQuery.trim().toLowerCase();
    return users.filter((user) => !query || user.name.toLowerCase().includes(query) || user.email.toLowerCase().includes(query));
  }, [kanbanAssigneeQuery, users]);

  const selectedTaskAssignees = useMemo(() => {
    return users.filter((user) => taskForm.assigneeIds.includes(user._id));
  }, [taskForm.assigneeIds, users]);

  const resolveTaskAssigneeIds = (task: ProjectPayload['tasks'][number]) => {
    const ids = (task.assigneeIds || []).map((assignee) => String(assignee._id || '')).filter(Boolean);
    return ids.length > 0 ? ids : (task.assigneeId?._id ? [task.assigneeId._id] : []);
  };

  const toggleTaskFormAssignee = (userId: string) => {
    setTaskForm((prev) => ({
      ...prev,
      assigneeIds: prev.assigneeIds.includes(userId)
        ? prev.assigneeIds.filter((currentId) => currentId !== userId)
        : [...prev.assigneeIds, userId],
    }));
  };

  const removeTaskFormAssignee = (userId: string) => {
    setTaskForm((prev) => ({
      ...prev,
      assigneeIds: prev.assigneeIds.filter((currentId) => currentId !== userId),
    }));
  };

  const toggleKanbanAssignee = async (task: ProjectPayload['tasks'][number], userId: string) => {
    const currentIds = resolveTaskAssigneeIds(task);
    const nextIds = currentIds.includes(userId)
      ? currentIds.filter((currentId) => currentId !== userId)
      : [...currentIds, userId];
    await updateTaskField(task, { assigneeIds: nextIds });
  };

  if (loading) return <div className="page-wrapper">Loading project...</div>;
  if (!payload) return <div className="page-wrapper">Project not found.</div>;

  const projectTaskStatuses = (payload.project.taskStatuses && payload.project.taskStatuses.length > 0)
    ? payload.project.taskStatuses
    : DEFAULT_TASK_STATUSES;
  const statusLabelByKey = new Map(projectTaskStatuses.map((status) => [status.key, status.label]));

  const riskScore = payload.taskStats.total
    ? Math.min(100, Math.round((payload.taskStats.blocked / payload.taskStats.total) * 50 + (100 - progress) * 0.5))
    : 0;

  const saveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProject(true);
    const previousProject = payload.project;
    setPayload((prev) => prev ? {
      ...prev,
      project: {
        ...prev.project,
        name: projectForm.name,
        description: projectForm.description,
        deadline: projectForm.deadline || undefined,
        taskTemplate: projectForm.taskTemplate,
      },
    } : prev);

    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...projectForm,
          startDate: toIso(projectForm.startDate),
          endDate: toIso(projectForm.endDate),
          taskStatuses: normalizeStatusEntries(projectForm.taskStatusesText),
        }),
      });
      const json = await res.json();
      if (json.success) {
        toastSuccess('Project updated');
        setShowEditProject(false);
        await loadProject();
      } else {
        setPayload((prev) => prev ? { ...prev, project: previousProject } : prev);
        toastError(json.error || 'Failed to update project');
      }
    } catch {
      setPayload((prev) => prev ? { ...prev, project: previousProject } : prev);
      toastError('Failed to update project');
    } finally {
      setSavingProject(false);
    }
  };

  const duplicateProject = async () => {
    if (!payload) return;
    setDuplicatingProject(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: `${payload.project.name} (Copy)` }),
      });
      const json = await res.json();
      if (json.success) {
        toastSuccess('Project duplicated');
        router.push(`/projects/${json.data.project._id}`);
      } else {
        toastError(json.error || 'Failed to duplicate project');
      }
    } catch {
      toastError('Failed to duplicate project');
    } finally {
      setDuplicatingProject(false);
    }
  };

  const deleteProject = async () => {
    if (!payload) return;
    const confirmed = window.confirm(`Delete ${payload.project.name}? This will remove the project and its tasks.`);
    if (!confirmed) return;

    setDeletingProject(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        toastSuccess('Project deleted');
        router.push('/projects');
      } else {
        toastError(json.error || 'Failed to delete project');
      }
    } catch {
      toastError('Failed to delete project');
    } finally {
      setDeletingProject(false);
    }
  };

  const createTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskForm.title.trim()) return;

    setSavingTask(true);
    const selectedAssignees = users.filter((user) => taskForm.assigneeIds.includes(user._id));
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          title: taskForm.title.trim(),
          description: taskForm.description.trim(),
          dueDate: taskForm.dueDate || undefined,
          status: taskForm.status,
          priority: taskForm.priority,
          assigneeId: selectedAssignees[0]?._id || undefined,
          assigneeIds: taskForm.assigneeIds,
          subtasks: [],
        }),
      });

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || 'Failed to create task');
      }

      toastSuccess('Task created');
      setTaskForm({
        title: '',
        description: '',
        dueDate: '',
        status: projectTaskStatuses[0]?.key || 'TODO',
        priority: 'MEDIUM',
        assigneeIds: [],
      });
      setShowTaskAssigneePicker(false);
      setTaskAssigneeQuery('');
      setShowCreateTask(false);
      await loadProject();
    } catch (error: unknown) {
      toastError(error instanceof Error ? error.message : 'Failed to create task');
    } finally {
      setSavingTask(false);
    }
  };

  const updateTaskField = async (
    task: ProjectPayload['tasks'][number],
    updates: { status?: string; assigneeId?: string; assigneeIds?: string[] }
  ) => {
    setUpdatingTaskId(task._id);
    const nextAssigneeIds = updates.assigneeIds || resolveTaskAssigneeIds(task);
    try {
      const res = await fetch(`/api/tasks/${task._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: updates.status || task.status,
          assigneeId: updates.assigneeId ?? nextAssigneeIds[0] ?? task.assigneeId?._id,
          assigneeIds: nextAssigneeIds,
          title: task.title,
          description: task.description || '',
          dueDate: task.dueDate || undefined,
          startDate: task.startDate || undefined,
          endDate: task.endDate || undefined,
          priority: task.priority || 'MEDIUM',
          projectId,
        }),
      });

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || 'Failed to update task');
      }

      await loadProject();
      toastSuccess('Task updated');
    } catch (error: unknown) {
      toastError(error instanceof Error ? error.message : 'Failed to update task');
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const onTaskDragStart = (taskId: string) => {
    setDraggedTaskId(taskId);
  };

  const onTaskDragEnd = () => {
    setDraggedTaskId(null);
    setDragOverColumn(null);
  };

  const onColumnDragOver = (e: React.DragEvent<HTMLDivElement>, columnKey: string) => {
    e.preventDefault();
    setDragOverColumn(columnKey);
  };

  const onColumnDrop = async (columnKey: string) => {
    if (!draggedTaskId || !payload) return;
    const task = payload.tasks.find((item) => item._id === draggedTaskId);
    if (!task) return;

    const current = String(task.status || 'TODO').toUpperCase();
    if (current !== columnKey) {
      setPayload((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          tasks: prev.tasks.map((item) => item._id === draggedTaskId ? { ...item, status: columnKey } : item),
        };
      });
      await updateTaskField(task, { status: columnKey });
    }

    setDraggedTaskId(null);
    setDragOverColumn(null);
  };

  return (
    <div className="page-wrapper animate-in">
      {showEditProject && (
        <div className="modal-overlay" onClick={() => setShowEditProject(false)}>
          <form className="ws-settings-modal" onSubmit={saveProject} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div className="text-xs text-muted" style={{ marginBottom: 2 }}>Edit Project</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{payload.project.name}</div>
              </div>
            </div>
            <div className="modal-body" style={{ display: 'grid', gap: 10 }}>
              <input className="input" placeholder="Name" value={projectForm.name} onChange={(e) => setProjectForm((prev) => ({ ...prev, name: e.target.value }))} required />
              <textarea className="input" placeholder="Description" style={{ minHeight: 96 }} value={projectForm.description} onChange={(e) => setProjectForm((prev) => ({ ...prev, description: e.target.value }))} />
              <input className="input" type="date" value={projectForm.deadline} onChange={(e) => setProjectForm((prev) => ({ ...prev, deadline: e.target.value }))} />
              <select className="input" value={projectForm.status} onChange={(e) => setProjectForm((prev) => ({ ...prev, status: e.target.value }))}>
                <option value="ACTIVE">Active</option>
                <option value="CLOSED">Closed</option>
              </select>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
                <input className="input" type="datetime-local" value={projectForm.startDate} onChange={(e) => setProjectForm((prev) => ({ ...prev, startDate: e.target.value }))} />
                <input className="input" type="datetime-local" value={projectForm.endDate} onChange={(e) => setProjectForm((prev) => ({ ...prev, endDate: e.target.value }))} />
              </div>
              <textarea
                className="input"
                style={{ minHeight: 110 }}
                placeholder="Task statuses (one per line)"
                value={projectForm.taskStatusesText}
                onChange={(e) => setProjectForm((prev) => ({ ...prev, taskStatusesText: e.target.value }))}
              />
              <select className="input" value={projectForm.taskTemplate} onChange={(e) => setProjectForm((prev) => ({ ...prev, taskTemplate: e.target.value }))}>
                {templateOptions.map((template) => (
                  <option key={template.key} value={template.key}>{template.title}</option>
                ))}
              </select>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary" type="button" onClick={() => setShowEditProject(false)}>Cancel</button>
                <button className="btn btn-primary" type="submit" disabled={savingProject}>{savingProject ? 'Saving...' : 'Save Changes'}</button>
              </div>
            </div>
          </form>
        </div>
      )}

      <header className="project-header card" style={{ marginBottom: 18 }}>
        <div>
          <nav className="breadcrumb" style={{ marginBottom: 8 }}>
            <span>DreamShift</span>
            <ChevronRight size={13} />
            <span>Projects</span>
            <ChevronRight size={13} />
            <span className="breadcrumb-active">{payload.project.name}</span>
          </nav>
          <h1 className="project-title">{payload.project.name}</h1>
          <div className="text-sm text-muted" style={{ marginTop: 6 }}>
            Template: {templateTitleByKey.get(payload.project.taskTemplate || 'NO_TEMPLATE') || payload.project.taskTemplate || 'NO_TEMPLATE'}
            {' · '}
            {payload.project.deadline ? `Deadline ${new Date(payload.project.deadline).toLocaleDateString()}` : 'No deadline'}
            {' · '}
            {String(payload.project.status || 'ACTIVE').toUpperCase() === 'CLOSED' ? 'Closed' : 'Active'}
          </div>
          <div className="text-xs text-muted" style={{ marginTop: 4 }}>
            {payload.project.startDate ? `Start ${new Date(payload.project.startDate).toLocaleString()}` : 'Start not set'}
            {' · '}
            {payload.project.endDate ? `End ${new Date(payload.project.endDate).toLocaleString()}` : 'End not set'}
          </div>
        </div>

        <div>
          <button className="btn btn-secondary" style={{ marginBottom: 8 }} onClick={() => setShowEditProject(true)}>
            <Pencil size={13} /> Edit Project
          </button>
          <button className="btn btn-secondary" style={{ marginBottom: 8, marginLeft: 8 }} onClick={duplicateProject} disabled={duplicatingProject}>
            <Copy size={13} /> {duplicatingProject ? 'Duplicating...' : 'Duplicate'}
          </button>
          <button className="btn btn-secondary" style={{ marginBottom: 8, marginLeft: 8, color: '#EF4444' }} onClick={deleteProject} disabled={deletingProject}>
            <Trash2 size={13} /> {deletingProject ? 'Deleting...' : 'Delete'}
          </button>
          <div className="progress-track" style={{ width: 240, marginBottom: 8 }}>
            <div className="progress-fill" style={{ width: `${progress}%`, background: '#10B981' }} />
          </div>
          <div className="text-sm text-muted">{progress}% complete</div>
        </div>
      </header>

      <div className="project-grid">
        <section className="project-tasks-area card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 8, flexWrap: 'wrap' }}>
            <div className="section-title">Tasks</div>
            <button className="btn btn-secondary" type="button" onClick={() => setShowCreateTask((prev) => !prev)}>
              <Plus size={13} /> {showCreateTask ? 'Close' : 'Create Task'}
            </button>
          </div>

          {showCreateTask && (
            <form className="card" style={{ padding: 12, marginBottom: 10, display: 'grid', gap: 8 }} onSubmit={createTask}>
              <input
                className="input"
                placeholder="Task title"
                value={taskForm.title}
                onChange={(e) => setTaskForm((prev) => ({ ...prev, title: e.target.value }))}
                required
              />
              <textarea
                className="input"
                placeholder="Description"
                style={{ minHeight: 80 }}
                value={taskForm.description}
                onChange={(e) => setTaskForm((prev) => ({ ...prev, description: e.target.value }))}
              />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
                <input
                  className="input"
                  type="date"
                  value={taskForm.dueDate}
                  onChange={(e) => setTaskForm((prev) => ({ ...prev, dueDate: e.target.value }))}
                />
                <select className="input" value={taskForm.status} onChange={(e) => setTaskForm((prev) => ({ ...prev, status: e.target.value }))}>
                  {projectTaskStatuses.map((status) => (
                    <option key={status.key} value={status.key}>{status.label}</option>
                  ))}
                </select>
                <select className="input" value={taskForm.priority} onChange={(e) => setTaskForm((prev) => ({ ...prev, priority: e.target.value }))}>
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>

              <div className="assignee-picker-wrap">
                <div className="assignee-picker-header">
                  <div>
                    <div className="assignee-picker-label">Assignees</div>
                    <div className="text-xs text-muted">Pick one or more owners for the task.</div>
                  </div>
                  <button
                    className="btn btn-secondary assignee-picker-button"
                    type="button"
                    onClick={() => setShowTaskAssigneePicker((current) => !current)}
                  >
                    <Plus size={12} />
                    Add Assignee
                  </button>
                </div>

                {selectedTaskAssignees.length > 0 ? (
                  <div className="assignee-chip-row">
                    {selectedTaskAssignees.map((user) => {
                      const avatarUrl = resolveAvatarUrl(user);
                      const initialsText = initials(user.name || user.email || 'User');
                      return (
                        <span key={user._id} className="assignee-chip">
                          <span className="assignee-chip-avatar" style={!avatarUrl ? { background: avatarTone(user.name || user.email || user._id) } : undefined}>
                            {avatarUrl ? <img src={avatarUrl} alt={user.name} /> : initialsText}
                          </span>
                          <span className="assignee-chip-name">{user.name}</span>
                          <button type="button" className="assignee-chip-remove" onClick={() => removeTaskFormAssignee(user._id)} aria-label={`Remove ${user.name}`}>
                            ×
                          </button>
                        </span>
                      );
                    })}
                  </div>
                ) : (
                  <div className="assignee-picker-empty">No assignees selected yet.</div>
                )}

                {showTaskAssigneePicker && (
                  <div className="assignee-dropdown" onClick={(event) => event.stopPropagation()}>
                    <div className="assignee-dropdown-topbar">
                      <input
                        className="input assignee-dropdown-search"
                        placeholder="Search people..."
                        value={taskAssigneeQuery}
                        onChange={(event) => setTaskAssigneeQuery(event.target.value)}
                      />
                      <button className="btn btn-secondary assignee-dropdown-done" type="button" onClick={() => setShowTaskAssigneePicker(false)}>
                        Done
                      </button>
                    </div>
                    <div className="assignee-dropdown-list">
                      {taskAssigneeOptions.length === 0 ? (
                        <div className="assignee-dropdown-empty">No people match this search.</div>
                      ) : (
                        taskAssigneeOptions.map((user) => {
                          const selected = taskForm.assigneeIds.includes(user._id);
                          const avatarUrl = resolveAvatarUrl(user);
                          const initialsText = initials(user.name || user.email || 'User');
                          return (
                            <button
                              key={user._id}
                              type="button"
                              className={`assignee-option ${selected ? 'is-selected' : ''}`}
                              onClick={() => toggleTaskFormAssignee(user._id)}
                            >
                              <span className="assignee-option-avatar" style={!avatarUrl ? { background: avatarTone(user.name || user.email || user._id) } : undefined}>
                                {avatarUrl ? <img src={avatarUrl} alt={user.name} /> : initialsText}
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
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button className="btn btn-secondary" type="button" onClick={() => setShowCreateTask(false)} disabled={savingTask}>Cancel</button>
                <button className="btn btn-primary" type="submit" disabled={savingTask}>{savingTask ? 'Creating...' : 'Create Task'}</button>
              </div>
            </form>
          )}

          {payload.tasks.length === 0 ? (
            <div className="text-sm text-muted">No tasks yet for this project.</div>
          ) : (
            <div className="task-inline-list">
              {payload.tasks.map((task) => (
                <div key={task._id} className="task-inline-item">
                  <div>
                    <div className="task-row-title"><Link href={`/tasks/${task._id}`}>{task.title}</Link></div>
                    <div className="text-xs text-muted">
                      <AssigneeStack assignees={(task.assigneeIds && task.assigneeIds.length > 0) ? task.assigneeIds : (task.assigneeId ? [task.assigneeId] : [])} />
                      <span style={{ margin: '0 6px' }}>·</span>
                      {task.dueDate ? `Due ${new Date(task.dueDate).toLocaleDateString()}` : 'No deadline'}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="badge">{statusLabelByKey.get(String(task.status || '')) || task.status}</span>
                    <span className="badge badge-low">{task.priority || 'MEDIUM'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ marginTop: 16 }}>
            <div className="section-title" style={{ marginBottom: 10 }}>Kanban</div>
            <div className="project-kanban-board">
              {projectTaskStatuses.map((column) => {
                const columnTasks = payload.tasks.filter((task) => String(task.status || 'TODO').toUpperCase() === column.key);
                return (
                  <div key={column.key} className="project-kanban-column card">
                    <div className="project-kanban-column-header">
                      <span>{column.label}</span>
                      <span className="ws-count">{columnTasks.length}</span>
                    </div>
                    <div
                      className={`project-kanban-column-body ${dragOverColumn === column.key ? 'drop-target' : ''}`}
                      onDragOver={(e) => onColumnDragOver(e, column.key)}
                      onDrop={() => onColumnDrop(column.key)}
                      onDragLeave={() => setDragOverColumn(null)}
                    >
                      {columnTasks.length === 0 ? (
                        <div className="text-xs text-muted">No tasks</div>
                      ) : (
                        columnTasks.map((task) => (
                          <div
                            key={`kanban-${task._id}`}
                            className={`project-kanban-card ${draggedTaskId === task._id ? 'is-dragging' : ''}`}
                            data-status={String(task.status || 'TODO').toUpperCase()}
                            style={{
                              borderColor: statusToneByKey(String(task.status || 'TODO').toUpperCase()).color,
                              background: `linear-gradient(180deg, ${statusToneByKey(String(task.status || 'TODO').toUpperCase()).bg}, rgba(255,255,255,0.02))`,
                            }}
                            draggable
                            onDragStart={() => onTaskDragStart(task._id)}
                            onDragEnd={onTaskDragEnd}
                          >
                            <div className="project-kanban-card-top">
                              <Link href={`/tasks/${task._id}`} className="project-kanban-title">{task.title}</Link>
                              <span
                                className="project-priority-pill"
                                style={{ background: `${(PRIORITY_META[task.priority || 'MEDIUM'] || PRIORITY_META.MEDIUM).color}1A`, color: (PRIORITY_META[task.priority || 'MEDIUM'] || PRIORITY_META.MEDIUM).color }}
                              >
                                {(PRIORITY_META[task.priority || 'MEDIUM'] || PRIORITY_META.MEDIUM).label}
                              </span>
                            </div>
                            <div className="text-xs text-muted" style={{ marginTop: 4, marginBottom: 8 }}>
                              {task.dueDate ? `Due ${new Date(task.dueDate).toLocaleDateString()}` : 'No deadline'}
                            </div>
                            <div style={{ display: 'grid', gap: 8 }}>
                              <span
                                className="badge"
                                style={{
                                  width: 'fit-content',
                                  background: statusToneByKey(String(task.status || 'TODO').toUpperCase()).bg,
                                  color: statusToneByKey(String(task.status || 'TODO').toUpperCase()).color,
                                }}
                              >
                                {statusLabelByKey.get(String(task.status || 'TODO').toUpperCase()) || String(task.status || 'TODO')}
                              </span>
                              <div className="project-kanban-assignees">
                                <div className="project-kanban-assignee-row">
                                  <AssigneeStack assignees={(task.assigneeIds && task.assigneeIds.length > 0) ? task.assigneeIds : (task.assigneeId ? [task.assigneeId] : [])} />
                                  <button
                                    type="button"
                                    className="btn btn-secondary assignee-picker-button project-kanban-assignee-trigger"
                                    onClick={() => {
                                      const nextTaskId = activeKanbanAssigneeTaskId === task._id ? null : task._id;
                                      setActiveKanbanAssigneeTaskId(nextTaskId);
                                      setKanbanAssigneeQuery('');
                                    }}
                                    disabled={updatingTaskId === task._id}
                                  >
                                    <Plus size={11} />
                                    Edit Assignees
                                  </button>
                                </div>

                                {activeKanbanAssigneeTaskId === task._id ? (
                                  <div className="assignee-dropdown project-kanban-assignee-dropdown" onClick={(event) => event.stopPropagation()}>
                                    <div className="assignee-dropdown-topbar">
                                      <input
                                        className="input assignee-dropdown-search"
                                        placeholder="Search people..."
                                        value={kanbanAssigneeQuery}
                                        onChange={(event) => setKanbanAssigneeQuery(event.target.value)}
                                      />
                                      <button
                                        className="btn btn-secondary assignee-dropdown-done"
                                        type="button"
                                        onClick={() => setActiveKanbanAssigneeTaskId(null)}
                                      >
                                        Done
                                      </button>
                                    </div>
                                    <div className="assignee-dropdown-list">
                                      {kanbanAssigneeOptions.length === 0 ? (
                                        <div className="assignee-dropdown-empty">No people match this search.</div>
                                      ) : (
                                        kanbanAssigneeOptions.map((user) => {
                                          const selected = resolveTaskAssigneeIds(task).includes(user._id);
                                          const avatarUrl = resolveAvatarUrl(user);
                                          const initialsText = initials(user.name || user.email || 'User');
                                          return (
                                            <button
                                              key={`${task._id}-assignee-${user._id}`}
                                              type="button"
                                              className={`assignee-option ${selected ? 'is-selected' : ''}`}
                                              onClick={() => toggleKanbanAssignee(task, user._id)}
                                              disabled={updatingTaskId === task._id}
                                            >
                                              <span className="assignee-option-avatar" style={!avatarUrl ? { background: avatarTone(user.name || user.email || user._id) } : undefined}>
                                                {avatarUrl ? <img src={avatarUrl} alt={user.name} /> : initialsText}
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
                                ) : null}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <aside className="project-meta-area">
          <div className="card" style={{ padding: 16 }}>
            <h3 className="text-sm font-bold uppercase text-muted mb-2">Description</h3>
            <p className="text-sm">{payload.project.description || 'No project description yet.'}</p>
          </div>

          <div className="card" style={{ padding: 16, marginTop: 12 }}>
            <DiscussionThread
              title="Discussion"
              endpoint={`/api/projects/${projectId}/comments`}
              showTaskPicker
              emptyMessage="No project discussion yet. Start the first thread."
            />
          </div>

          <div className="card" style={{ padding: 16, marginTop: 12 }}>
            <h3 className="text-sm font-bold uppercase text-muted flex items-center gap-2 mb-3"><Sparkles size={14} /> Data Science Insights</h3>
            <div className="text-sm" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertCircle size={14} color={riskScore > 65 ? '#EF4444' : '#F59E0B'} />
              Delivery Risk Score: <strong>{riskScore}/100</strong>
            </div>
            <p className="text-xs text-muted" style={{ marginTop: 8 }}>
              Score combines completion velocity and blocked-task ratio.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
