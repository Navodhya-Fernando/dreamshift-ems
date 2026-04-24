"use client";

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, FolderOpen, Plus, RefreshCw, Search, Sparkles, X } from 'lucide-react';
import DataStatusBanner from '@/components/ui/DataStatusBanner';
import { useCachedApi } from '@/lib/useCachedApi';
import { toastError, toastSuccess } from '@/lib/toast';
import './projects.css';

type WorkspaceProject = {
  id: string;
  name: string;
  description?: string;
  deadline?: string;
  status?: 'ACTIVE' | 'CLOSED';
  completionPercent: number;
  risk: 'LOW' | 'MEDIUM' | 'HIGH';
};

type WorkspaceSummary = {
  id: string;
  name: string;
  projects: WorkspaceProject[];
  projectsCount: number;
  viewMorePath: string;
};

type TaskTemplateOption = {
  key: string;
  title: string;
};

const RISK_COLORS: Record<string, string> = {
  LOW: '#10B981',
  MEDIUM: '#F59E0B',
  HIGH: '#EF4444',
};

function NewProjectModal({
  workspaces,
  taskTemplates,
  onClose,
  onCreated,
}: {
  workspaces: WorkspaceSummary[];
  taskTemplates: TaskTemplateOption[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    workspaceId: workspaces[0]?.id || '',
    name: '',
    description: '',
    deadline: '',
    taskTemplate: 'NO_TEMPLATE',
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.workspaceId) return;

    setLoading(true);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (json.success) {
        toastSuccess('Project created');
        onCreated();
        onClose();
      } else {
        toastError(json.error || 'Failed to create project');
      }
    } catch {
      toastError('Failed to create project');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <form className="ws-settings-modal" onSubmit={submit} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="text-xs text-muted" style={{ marginBottom: 2 }}>Create New Project</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>Premium Project Setup</div>
          </div>
          <button type="button" className="btn btn-ghost p-1" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="modal-body">
          <div className="modal-section-list">
            <div className="modal-field">
              <label className="field-label">Workspace</label>
              <select
                className="input"
                value={form.workspaceId}
                onChange={(e) => setForm((prev) => ({ ...prev, workspaceId: e.target.value }))}
                required
              >
                {workspaces.map((ws) => (
                  <option key={ws.id} value={ws.id}>{ws.name}</option>
                ))}
              </select>
            </div>

            <div className="modal-field">
              <label className="field-label">Name</label>
              <input
                className="input"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Fraud Forecasting Initiative"
                required
              />
            </div>

            <div className="modal-field">
              <label className="field-label">Description</label>
              <textarea
                className="input"
                style={{ minHeight: 96, resize: 'vertical' }}
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Project objective, scope, and stakeholders"
              />
            </div>

            <div className="modal-field">
              <label className="field-label">Deadline</label>
              <input
                className="input"
                type="date"
                value={form.deadline}
                onChange={(e) => setForm((prev) => ({ ...prev, deadline: e.target.value }))}
              />
            </div>

            <div className="modal-field">
              <label className="field-label">Task Template</label>
              <select
                className="input"
                value={form.taskTemplate}
                onChange={(e) => setForm((prev) => ({ ...prev, taskTemplate: e.target.value }))}
              >
                {taskTemplates.map((template) => (
                  <option key={template.key} value={template.key}>{template.title}</option>
                ))}
              </select>
            </div>

            <button className="btn btn-primary" type="submit" disabled={loading}>
              <Plus size={14} /> {loading ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function NewWorkspaceModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    try {
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });

      const json = await res.json();
      if (json.success) {
        toastSuccess('Workspace created');
        onCreated();
        onClose();
      } else {
        toastError(json.error || 'Failed to create workspace');
      }
    } catch {
      toastError('Failed to create workspace');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <form className="ws-settings-modal" onSubmit={submit} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="text-xs text-muted" style={{ marginBottom: 2 }}>Create Workspace</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>New Team Space</div>
          </div>
          <button type="button" className="btn btn-ghost p-1" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="modal-body">
          <div className="modal-section-list">
            <div className="modal-field">
              <label className="field-label">Workspace Name</label>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="AI Delivery Hub"
                required
              />
            </div>

            <button className="btn btn-primary" type="submit" disabled={loading}>
              <Plus size={14} /> {loading ? 'Creating...' : 'Create Workspace'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

export default function WorkspacesPage() {
  const [search, setSearch] = useState('');
  const [showNewProject, setShowNewProject] = useState(false);
  const [showNewWorkspace, setShowNewWorkspace] = useState(false);

  const templatesApi = useCachedApi<TaskTemplateOption[]>({
    cacheKey: 'task-templates:project-options:v1',
    initialData: [{ key: 'NO_TEMPLATE', title: 'No Template' }],
    fetcher: async () => {
      const res = await fetch('/api/task-templates', { cache: 'no-store' });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to load templates');
      return (json.data || []).map((template: { key: string; title: string }) => ({
        key: String(template.key || ''),
        title: String(template.title || template.key || 'Template'),
      }));
    },
    ttlMs: 30_000,
  });

  const fetchWorkspaceSummary = async (): Promise<WorkspaceSummary[]> => {
    const res = await fetch('/api/sidebar', { cache: 'no-store' });
    const json = await res.json();
    if (json.success && Array.isArray(json.data) && json.data.length > 0) {
      return json.data as WorkspaceSummary[];
    }

    // Fallback path: compose from direct workspace/project APIs.
    const wsRes = await fetch('/api/workspaces', { cache: 'no-store' });
    const wsJson = await wsRes.json();
    if (!wsJson.success) {
      throw new Error(wsJson.error || 'Unable to load workspaces');
    }

    const fallback: WorkspaceSummary[] = await Promise.all(
      (wsJson.data || []).map(async (ws: { _id: string; name: string }) => {
        const projectsRes = await fetch(`/api/projects?workspaceId=${ws._id}`, { cache: 'no-store' });
        const projectsJson = await projectsRes.json();
        const projects = (projectsJson.success ? projectsJson.data : []).slice(0, 5).map((project: { _id: string; name: string; description?: string; deadline?: string; status?: 'ACTIVE' | 'CLOSED' }) => ({
          id: project._id,
          name: project.name,
          description: project.description,
          deadline: project.deadline,
          status: String(project.status || 'ACTIVE').toUpperCase() === 'CLOSED' ? 'CLOSED' : 'ACTIVE',
          completionPercent: 0,
          risk: 'LOW' as const,
        }));

        return {
          id: ws._id,
          name: ws.name,
          projects,
          projectsCount: projectsJson.success ? projectsJson.count || projects.length : projects.length,
          viewMorePath: `/projects/workspace/${ws._id}`,
        };
      })
    );

    return fallback;
  };

  const {
    data: workspaces,
    loading,
    isRefreshing,
    error,
    lastUpdated,
    refresh,
  } = useCachedApi<WorkspaceSummary[]>({
    cacheKey: 'workspace-summary-v1',
    initialData: [],
    fetcher: fetchWorkspaceSummary,
    ttlMs: 120000,
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return workspaces;

    return workspaces
      .map((ws) => ({
        ...ws,
        projects: ws.projects.filter((p) => p.name.toLowerCase().includes(search.toLowerCase())),
      }))
      .filter((ws) => ws.projects.length > 0 || ws.name.toLowerCase().includes(search.toLowerCase()));
  }, [search, workspaces]);

  return (
    <div className="page-wrapper animate-in">
      {showNewProject && (
        <NewProjectModal
          workspaces={workspaces}
          taskTemplates={templatesApi.data}
          onClose={() => setShowNewProject(false)}
          onCreated={refresh}
        />
      )}
      {showNewWorkspace && (
        <NewWorkspaceModal
          onClose={() => setShowNewWorkspace(false)}
          onCreated={refresh}
        />
      )}

      <div className="explorer-header">
        <div>
          <nav className="breadcrumb">
            <span>DreamShift</span>
            <ChevronRight size={13} />
            <span className="breadcrumb-active">Workspaces</span>
          </nav>
          <h1 className="page-title" style={{ marginTop: 6 }}>Workspace Explorer</h1>
        </div>
        <div className="explorer-actions">
          <div className="search-wrap">
            <Search size={14} className="search-icon" />
            <input
              className="input search-input"
              placeholder="Search projects..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button className="btn btn-secondary" onClick={refresh} disabled={isRefreshing}>
            <RefreshCw size={14} /> Refresh
          </button>
          <button className="btn btn-secondary" onClick={() => setShowNewWorkspace(true)}>
            <Plus size={15} /> New Workspace
          </button>
          <button className="btn btn-primary" onClick={() => setShowNewProject(true)}>
            <Plus size={15} /> New Project
          </button>
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

      {loading ? (
        <div className="skeleton-grid">
          {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton-card" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-center">
          <FolderOpen size={40} color="var(--text-disabled)" />
          <p>No workspaces or projects found.</p>
        </div>
      ) : (
        filtered.map((ws) => (
          <section key={ws.id} className="workspace-section">
            <div className="workspace-section-header">
              <div className="ws-dot" />
              <span className="ws-name">{ws.name}</span>
              <span className="ws-count">Showing {ws.projects.length} / {ws.projectsCount} projects</span>
              <Link className="btn btn-secondary" style={{ marginLeft: 'auto', fontSize: 12 }} href={ws.viewMorePath}>
                View More
              </Link>
            </div>

            <div className="projects-grid">
              {ws.projects.map((p) => (
                <Link href={`/projects/${p.id}`} key={p.id} className="project-card card">
                  <div className="project-card-top">
                    <div className="project-icon"><FolderOpen size={16} /></div>
                    <span className="badge" style={{
                      background: `${RISK_COLORS[p.risk]}1A`,
                      color: RISK_COLORS[p.risk],
                      fontSize: 10,
                    }}>
                      <Sparkles size={10} /> {p.risk} RISK
                    </span>
                  </div>

                  <div className="project-card-body">
                    <div className="project-name">{p.name}</div>
                    <div className="project-meta text-sm text-muted">
                      {p.deadline ? `Deadline ${new Date(p.deadline).toLocaleDateString()}` : 'No deadline'}
                    </div>
                  </div>

                  <div className="project-card-footer">
                    <div className="progress-row">
                      <span className="text-xs text-muted">{p.completionPercent}% complete</span>
                      <span className={`badge ${String(p.status || 'ACTIVE').toUpperCase() === 'CLOSED' ? 'badge-blocked' : 'badge-done'}`}>
                        {String(p.status || 'ACTIVE').toUpperCase() === 'CLOSED' ? 'Closed' : 'Active'}
                      </span>
                    </div>
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width: `${p.completionPercent}%`, background: '#5B6BF8' }} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
