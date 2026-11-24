"use client";
import { useState } from 'react';
import Link from 'next/link';
import { useCachedApi } from '@/lib/useCachedApi';
type Project = { _id:string; name:string; status?:string };
type Preview = { count:number; rows:Array<{title:string;priority:string;status:string;dueDate:string|null;assignee:string}> };
const SAMPLE = 'title,description,due_date,priority,status,assignee_email\nReview CV,Check formatting,2026-12-01,HIGH,TODO,\n';
export default function BulkTasksPage() {
  const {data:projects,loading} = useCachedApi<Project[]>({cacheKey:'bulk-projects',initialData:[],fetcher:async()=>{const res=await fetch('/api/projects');const json=await res.json();if(!res.ok||!json.success)throw Error('Could not load projects');return json.data;}});
  const [project,setProject]=useState(''),[csv,setCsv]=useState(''),[preview,setPreview]=useState<Preview|null>(null),[errors,setErrors]=useState<string[]>([]),[busy,setBusy]=useState(false),[result,setResult]=useState(''),[requestId,setRequestId]=useState('');
  const reset=()=>{setPreview(null);setErrors([]);setResult('');setRequestId('');};
  async function run(isPreview:boolean) {
    setBusy(true);setErrors([]);setResult('');
    const id=requestId||crypto.randomUUID();setRequestId(id);
    try {
      const response=await fetch('/api/tasks/bulk',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({projectId:project,csv,preview:isPreview,requestId:id})});
      const json=await response.json();
      if(!response.ok||!json.success){setErrors(json.errors||[json.error||'Import failed']);return;}
      if(isPreview)setPreview(json.data);else{setResult(`${json.data.count} tasks available in the project (${json.data.created} newly created).`);setPreview(null);setCsv('');setRequestId('');window.dispatchEvent(new Event('dreamshift:refresh-all'));}
    }catch{setErrors(['Could not complete the import. Retry without changing the input.']);}finally{setBusy(false);}
  }
  return <div className="page-wrapper"><Link href="/tasks" className="btn btn-ghost">← My Tasks</Link><h1 className="page-title" style={{margin:'14px 0 6px'}}>Import tasks</h1><p className="text-muted">Create up to 200 tasks in one project. Review the preview before saving.</p>
    <div className="card" style={{padding:20,marginTop:20,display:'grid',gap:14,maxWidth:920}}>
      <label>Project<select className="input" style={{width:'100%',marginTop:6}} value={project} disabled={busy||loading} onChange={e=>{setProject(e.target.value);reset();}}><option value="">Select a project</option>{projects.filter(p=>p.status!=='CLOSED').map(p=><option key={p._id} value={p._id}>{p.name}</option>)}</select></label>
      <label>CSV file<input className="input" type="file" accept=".csv,text/csv" disabled={busy} style={{display:'block',marginTop:6,width:'100%'}} onChange={async e=>{const file=e.target.files?.[0];reset();if(!file)return;if(file.size>250000){setCsv('');setErrors(['Maximum file size is 250 KB.']);return;}setCsv(await file.text());}}/></label>
      <button className="btn btn-ghost" type="button" onClick={()=>{const url=URL.createObjectURL(new Blob([SAMPLE],{type:'text/csv'}));const a=document.createElement('a');a.href=url;a.download='dreamshift-task-template.csv';a.click();URL.revokeObjectURL(url);}}>Download CSV template</button>
      <label>Or paste CSV<textarea className="input" rows={7} style={{display:'block',width:'100%',marginTop:6,fontFamily:'monospace'}} value={csv} disabled={busy} onChange={e=>{setCsv(e.target.value);reset();}} placeholder={SAMPLE}/></label>
      <p className="text-muted text-sm">Required: title. Optional: description, due_date (YYYY-MM-DD), priority, status, assignee_email. Blank assignee means you.</p>
      <div><button className="btn btn-primary" disabled={!csv.trim()||!project||busy} onClick={()=>void run(true)}>{busy?'Working…':'Validate and preview'}</button></div>
      {errors.length>0&&<div role="alert" style={{color:'var(--urgency-critical)'}}>{errors.map((e,i)=><p key={i}>{e}</p>)}</div>}
      {result&&<p role="status">{result} <Link href={`/projects/${project}`}>Open project →</Link></p>}
      {preview&&<><h2 className="section-title">{preview.count} tasks ready</h2><div style={{overflowX:'auto'}}><table style={{width:'100%',textAlign:'left',borderCollapse:'collapse'}}><thead><tr>{['Title','Assignee','Priority','Status','Due date'].map(h=><th key={h} style={{padding:8}}>{h}</th>)}</tr></thead><tbody>{preview.rows.map((r,i)=><tr key={i} style={{borderTop:'1px solid var(--border)'}}>{[r.title,r.assignee,r.priority,r.status,r.dueDate?.slice(0,10)||'None'].map((v,j)=><td key={j} style={{padding:8}}>{v}</td>)}</tr>)}</tbody></table></div><div><button className="btn btn-primary" disabled={busy} onClick={()=>void run(false)}>Create {preview.count} tasks</button></div></>}
    </div></div>;
}
