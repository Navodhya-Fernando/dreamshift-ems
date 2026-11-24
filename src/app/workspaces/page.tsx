"use client";
import Link from 'next/link';
import { useCachedApi } from '@/lib/useCachedApi';
import { FolderOpen } from 'lucide-react';
type Workspace={id:string;name:string;projectsCount:number;viewMorePath:string};
export default function WorkspaceDirectory(){
const {data,loading,error,refresh}=useCachedApi<Workspace[]>({cacheKey:'workspace-directory-v1',initialData:[],ttlMs:60000,fetcher:async()=>{const r=await fetch('/api/sidebar');const j=await r.json();if(!r.ok||!j.success)throw Error(j.error||'Unable to load workspaces');return j.data;}});
return <div className="page-wrapper"><div style={{display:'flex',justifyContent:'space-between',gap:12,flexWrap:'wrap',marginBottom:20}}><div><h1 className="page-title">Workspaces</h1><p className="text-muted">Departments and team spaces.</p></div><Link href="/projects" className="btn btn-primary">All projects</Link></div>{loading&&<p role="status">Loading workspaces…</p>}{error&&<p role="alert">{error} <button className="btn btn-secondary" onClick={()=>void refresh()}>Retry</button></p>}<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,240px),1fr))',gap:12}}>{data.map(w=><Link key={w.id} className="card" href={w.viewMorePath} style={{padding:18,display:'grid',gap:10,color:'var(--text-primary)',textDecoration:'none'}}><FolderOpen size={22}/><strong>{w.name}</strong><span className="text-muted">{w.projectsCount} projects</span></Link>)}</div></div>;
}
