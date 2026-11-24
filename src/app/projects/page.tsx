"use client";

import React, { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { FolderOpen, Plus, Search, Star, X } from 'lucide-react';
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
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>New project</div>
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
                placeholder="Project name"
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
                placeholder="Workspace name"
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
  const {data:session}=useSession();
  const [search,setSearch]=useState(''),[workspace,setWorkspace]=useState(''),[status,setStatus]=useState('ACTIVE'),[view,setView]=useState<'list'|'grid'>('list'),[onlySaved,setOnlySaved]=useState(false),[saved,setSaved]=useState<string[]>([]),[savedReady,setSavedReady]=useState(false);
  const [showNewProject,setShowNewProject]=useState(false),[showNewWorkspace,setShowNewWorkspace]=useState(false);
  const userId=session?.user?.id;
  const key='ems:project-favourites:'+userId;
  useEffect(()=>{setSavedReady(false);try{const value=JSON.parse(localStorage.getItem(key)||'[]');setSaved(Array.isArray(value)?value.filter(x=>typeof x==='string'):[]);}catch{setSaved([]);}setSavedReady(Boolean(userId));},[key,userId]);
  function toggle(id:string){if(!savedReady)return;const next=saved.includes(id)?saved.filter(x=>x!==id):[...saved,id];setSaved(next);try{localStorage.setItem(key,JSON.stringify(next));}catch{}}
  const templatesApi=useCachedApi<TaskTemplateOption[]>({cacheKey:'task-templates:project-options:v1',initialData:[{key:'NO_TEMPLATE',title:'No Template'}],enabled:showNewProject,fetcher:async()=>{const res=await fetch('/api/task-templates');const j=await res.json();if(!res.ok||!j.success)throw Error(j.error||'Unable to load templates');return [{key:'NO_TEMPLATE',title:'No Template'},...(j.data||[]).filter((t:TaskTemplateOption)=>t.key!=='NO_TEMPLATE').map((t:TaskTemplateOption)=>({key:t.key,title:t.title}))];},ttlMs:30000});
  const {data:workspaces,loading,error,lastUpdated,isRefreshing,refresh}=useCachedApi<WorkspaceSummary[]>({cacheKey:'project-directory-v1',initialData:[],ttlMs:60000,fetcher:async()=>{const res=await fetch('/api/sidebar?all=1');const j=await res.json();if(!res.ok||!j.success)throw Error(j.error||'Unable to load projects');return j.data;}});
  const projects=useMemo(()=>workspaces.flatMap(w=>w.projects.map(p=>({...p,workspaceId:w.id,workspaceName:w.name}))),[workspaces]);
  const filtered=useMemo(()=>projects.filter(p=>(!workspace||p.workspaceId===workspace)&&(status==='ALL'||String(p.status||'ACTIVE').toUpperCase()===status)&&(!onlySaved||saved.includes(p.id))&&[p.name,p.description,p.workspaceName].some(v=>String(v||'').toLowerCase().includes(search.trim().toLowerCase()))).sort((a,b)=>Number(saved.includes(b.id))-Number(saved.includes(a.id))),[projects,workspace,status,onlySaved,saved,search]);
  return <div className="page-wrapper project-directory">
    {showNewProject&&<NewProjectModal workspaces={workspaces} taskTemplates={templatesApi.data} onClose={()=>setShowNewProject(false)} onCreated={refresh}/>}
    {showNewWorkspace&&<NewWorkspaceModal onClose={()=>setShowNewWorkspace(false)} onCreated={refresh}/>}
    <div className="explorer-header"><div><h1 className="page-title">Projects</h1><p className="text-muted">Find and open any project directly.</p></div><div className="explorer-actions"><Link href="/workspaces" className="btn btn-secondary">Workspaces</Link><button className="btn btn-ghost" onClick={()=>setShowNewWorkspace(true)}><Plus size={15}/> Workspace</button><button className="btn btn-primary" onClick={()=>setShowNewProject(true)} disabled={loading||!workspaces.length}><Plus size={15}/> New project</button></div></div>
    <DataStatusBanner loading={loading} error={error} lastUpdated={lastUpdated} isRefreshing={isRefreshing} onRetry={refresh} onRefresh={refresh}/>
    <div className="directory-filters"><div className="search-wrap"><Search size={16} className="search-icon"/><input className="input search-input" aria-label="Search all projects" placeholder="Search all projects..." value={search} onChange={e=>setSearch(e.target.value)}/></div>
      <select className="input" aria-label="Workspace" value={workspace} onChange={e=>setWorkspace(e.target.value)}><option value="">All workspaces</option>{workspaces.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select>
      <select className="input" aria-label="Project status" value={status} onChange={e=>setStatus(e.target.value)}><option value="ACTIVE">Active</option><option value="CLOSED">Closed</option><option value="ALL">All statuses</option></select>
      <button className={`btn ${onlySaved?'btn-primary':'btn-secondary'}`} aria-pressed={onlySaved} onClick={()=>setOnlySaved(v=>!v)}><Star size={15}/> Favourites</button>
      <div className="project-view-switch"><button className={`btn ${view==='list'?'btn-primary':'btn-ghost'}`} aria-pressed={view==='list'} onClick={()=>setView('list')}>List</button><button className={`btn ${view==='grid'?'btn-primary':'btn-ghost'}`} aria-pressed={view==='grid'} onClick={()=>setView('grid')}>Grid</button></div>
    </div>
    {!loading&&<p className="text-muted text-sm" style={{margin:'12px 0'}}>{filtered.length} of {projects.length} projects</p>}
    {!loading&&!filtered.length&&!error&&<div className="empty-center"><FolderOpen size={32}/><p>No matching projects.</p><button className="btn btn-secondary" onClick={()=>{setSearch('');setWorkspace('');setStatus('ALL');setOnlySaved(false);}}>Clear filters</button></div>}
    <div className={view==='grid'?'directory-grid':'directory-list'}>{filtered.map(p=><article key={p.id} className="directory-project card">
      <Link className="directory-project-link" href={`/projects/${p.id}`}><FolderOpen size={19}/><div className="directory-name"><strong>{p.name}</strong><span className="text-muted text-sm">{p.workspaceName}</span></div><div className="directory-progress"><span className="text-sm">{p.completionPercent}% complete</span><div className="progress-track"><div className="progress-fill" style={{width:p.completionPercent+'%',background:'var(--accent)'}}/></div></div><span className="text-muted text-sm">{p.deadline?new Date(p.deadline).toLocaleDateString():'No deadline'}</span></Link>
      <button type="button" className="btn btn-ghost directory-star" aria-label={saved.includes(p.id)?'Remove '+p.name+' from favourites':'Favourite '+p.name} aria-pressed={saved.includes(p.id)} disabled={!savedReady} onClick={()=>toggle(p.id)}><Star size={18} fill={saved.includes(p.id)?'currentColor':'none'}/></button>
    </article>)}</div>
    <p className="text-muted text-sm" style={{marginTop:16}}>Favourites are saved on this browser for your account.</p>
  </div>;
}
