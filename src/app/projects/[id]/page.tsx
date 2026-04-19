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
    assigneeId?: { _id?: string; name?: string; email?: string };
  }>;
  taskStats: {
    total: number;
    todo: number;
    inProgress: number;
    done: number;
    blocked: number;
  };
};

type UserOption = {
  _id: string;
  name: string;
  email: string;
};

type TaskTemplateOption = {
  key: string;
  title: string;
};

const KANBAN_COLUMNS: Array<{ key: string; label: string }> = [
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

const STATUS_LABELS: Record<string, string> = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  DONE: 'Done',
  BLOCKED: 'Blocked',
  IN_REVIEW: 'In Review',
};

const STATUS_META: Record<string, { color: string; bg: string }> = {
  TODO: { color: '#60A5FA', bg: 'rgba(96,165,250,0.11)' },
  IN_PROGRESS: { color: '#F59E0B', bg: 'rgba(245,158,11,0.11)' },
  IN_REVIEW: { color: '#A78BFA', bg: 'rgba(167,139,250,0.11)' },
  BLOCKED: { color: '#EF4444', bg: 'rgba(239,68,68,0.11)' },
  DONE: { color: '#10B981', bg: 'rgba(16,185,129,0.11)' },
};

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
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    dueDate: '',
    status: 'TODO',
    priority: 'MEDIUM',
    assigneeId: '',
  });

  const loadProject = useCallback(async () => {
    const [projectRes, usersRes, templatesRes] = await Promise.all([
      fetch(`/api/projects/${projectId}`),
      fetch('/api/users', { cache: 'no-store' }),
      fetch('/api/task-templates', { cache: 'no-store' }),
    ]);
    const [projectJson, usersJson, templatesJson] = await Promise.all([projectRes.json(), usersRes.json(), templatesRes.json()]);
    if (projectJson.success) {
      setPayload({ ...projectJson.data });
      setProjectForm({
        name: projectJson.data.project.name || '',
        description: projectJson.data.project.description || '',
        deadline: projectJson.data.project.deadline ? new Date(projectJson.data.project.deadline).toISOString().slice(0, 10) : '',
        taskTemplate: projectJson.data.project.taskTemplate || 'NO_TEMPLATE',
      });
    }
    if (usersJson.success) {
      setUsers((usersJson.data || []).map((user: { _id: string; name?: string; email?: string }) => ({
        _id: String(user._id),
        name: String(user.name || user.email || 'User'),
        email: String(user.email || ''),
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

  if (loading) return <div className="page-wrapper">Loading project...</div>;
  if (!payload) return <div className="page-wrapper">Project not found.</div>;

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
        body: JSON.stringify(projectForm),
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
          assigneeId: taskForm.assigneeId || undefined,
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
        status: 'TODO',
        priority: 'MEDIUM',
        assigneeId: '',
      });
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
    updates: { status?: string; assigneeId?: string }
  ) => {
    setUpdatingTaskId(task._id);
    try {
      const res = await fetch(`/api/tasks/${task._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: updates.status || task.status,
          assigneeId: updates.assigneeId ?? task.assigneeId?._id,
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
                  <option value="TODO">To Do</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="IN_REVIEW">In Review</option>
                  <option value="BLOCKED">Blocked</option>
                  <option value="DONE">Done</option>
                </select>
                <select className="input" value={taskForm.priority} onChange={(e) => setTaskForm((prev) => ({ ...prev, priority: e.target.value }))}>
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
                <select className="input" value={taskForm.assigneeId} onChange={(e) => setTaskForm((prev) => ({ ...prev, assigneeId: e.target.value }))}>
                  <option value="">Select Assignee</option>
                  {users.map((user) => (
                    <option key={user._id} value={user._id}>{user.name} ({user.email})</option>
                  ))}
                </select>
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
                      {task.assigneeId?.name || 'Unassigned'}
                      {' · '}
                      {task.dueDate ? `Due ${new Date(task.dueDate).toLocaleDateString()}` : 'No deadline'}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="badge">{STATUS_LABELS[task.status] || task.status}</span>
                    <span className="badge badge-low">{task.priority || 'MEDIUM'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ marginTop: 16 }}>
            <div className="section-title" style={{ marginBottom: 10 }}>Kanban</div>
            <div className="project-kanban-board">
              {KANBAN_COLUMNS.map((column) => {
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
                              borderColor: (STATUS_META[String(task.status || 'TODO').toUpperCase()] || STATUS_META.TODO).color,
                              background: `linear-gradient(180deg, ${(STATUS_META[String(task.status || 'TODO').toUpperCase()] || STATUS_META.TODO).bg}, rgba(255,255,255,0.02))`,
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
                                  background: (STATUS_META[String(task.status || 'TODO').toUpperCase()] || STATUS_META.TODO).bg,
                                  color: (STATUS_META[String(task.status || 'TODO').toUpperCase()] || STATUS_META.TODO).color,
                                }}
                              >
                                {STATUS_LABELS[String(task.status || 'TODO').toUpperCase()] || String(task.status || 'TODO')}
                              </span>
                              <select
                                className="input"
                                value={task.assigneeId?._id || ''}
                                onChange={(e) => updateTaskField(task, { assigneeId: e.target.value || '' })}
                                disabled={updatingTaskId === task._id}
                              >
                                <option value="">Unassigned</option>
                                {users.map((user) => (
                                  <option key={`${task._id}-assignee-${user._id}`} value={user._id}>{user.name}</option>
                                ))}
                              </select>
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
