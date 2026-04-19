"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ChevronRight, FolderOpen, Users } from 'lucide-react';
import '../../projects.css';

type WorkspaceDetail = {
  id: string;
  name: string;
  stats: {
    totalProjects: number;
    totalTasks: number;
    avgCompletion: number;
    members: number;
  };
  projects: {
    id: string;
    name: string;
    description?: string;
    deadline?: string;
    taskCount: number;
    completionPercent: number;
    taskTemplate?: string;
  }[];
};

export default function WorkspaceProjectsPage() {
  const params = useParams<{ id: string }>();
  const workspaceId = params.id;

  const [loading, setLoading] = useState(true);
  const [workspace, setWorkspace] = useState<WorkspaceDetail | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        const res = await fetch(`/api/workspaces/${workspaceId}`);
        const json = await res.json();
        if (json.success) setWorkspace(json.data);
      } finally {
        setLoading(false);
      }
    };
    if (workspaceId) run();
  }, [workspaceId]);

  if (loading) return <div className="page-wrapper">Loading workspace...</div>;
  if (!workspace) return <div className="page-wrapper">Workspace not found</div>;

  return (
    <div className="page-wrapper animate-in">
      <div className="explorer-header">
        <div>
          <nav className="breadcrumb">
            <span>DreamShift</span>
            <ChevronRight size={13} />
            <Link href="/projects">Workspaces</Link>
            <ChevronRight size={13} />
            <span className="breadcrumb-active">{workspace.name}</span>
          </nav>
          <h1 className="page-title" style={{ marginTop: 6 }}>{workspace.name} Projects</h1>
        </div>
      </div>

      <div className="kpi-grid" style={{ marginBottom: 20 }}>
        <div className="kpi-card card"><div className="kpi-value">{workspace.stats.totalProjects}</div><div className="kpi-label">Projects</div></div>
        <div className="kpi-card card"><div className="kpi-value">{workspace.stats.totalTasks}</div><div className="kpi-label">Tasks</div></div>
        <div className="kpi-card card"><div className="kpi-value">{workspace.stats.avgCompletion}%</div><div className="kpi-label">Avg Completion</div></div>
        <div className="kpi-card card"><div className="kpi-value">{workspace.stats.members}</div><div className="kpi-label">Members</div></div>
      </div>

      <div className="projects-grid">
        {workspace.projects.map((project) => (
          <Link href={`/projects/${project.id}`} key={project.id} className="project-card card">
            <div className="project-card-top">
              <div className="project-icon"><FolderOpen size={16} /></div>
              <span className="badge" style={{ fontSize: 10 }}><Users size={10} /> {project.taskCount} tasks</span>
            </div>

            <div className="project-card-body">
              <div className="project-name">{project.name}</div>
              <div className="project-meta text-sm text-muted">
                {project.description || 'No description'}
              </div>
              <div className="project-meta text-sm text-muted" style={{ marginTop: 6 }}>
                Template: {project.taskTemplate || 'NO_TEMPLATE'}
              </div>
            </div>

            <div className="project-card-footer">
              <div className="progress-row">
                <span className="text-xs text-muted">{project.completionPercent}% complete</span>
                <span className="text-xs text-muted">
                  {project.deadline ? `Due ${new Date(project.deadline).toLocaleDateString()}` : 'No deadline'}
                </span>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${project.completionPercent}%`, background: '#10B981' }} />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
