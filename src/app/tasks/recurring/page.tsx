"use client";
import { useState } from 'react';
import Link from 'next/link';
import { useCachedApi } from '@/lib/useCachedApi';
type Option={_id:string;name:string;status?:string;email?:string};
type Rule={_id:string;title:string;projectId:string;assigneeId:string;cadence:string;nextRunAt:string;active:boolean;lastError?:string};
type Data={projects:Option[];users:Option[];rules:Rule[]};
const initial={title:'',description:'',projectId:'',assigneeId:'',cadence:'WEEKLY',priority:'MEDIUM',startDate:new Date().toISOString().slice(0,10)};
export default function RecurringTasksPage(){
  const {data,loading,error,refresh}=useCachedApi<Data>({cacheKey:'recurring-tasks-v1',initialData:{projects:[],users:[],rules:[]},fetcher:async()=>{const res=await Promise.all(['/api/projects','/api/users','/api/tasks/recurring'].map(u=>fetch(u)));const j=await Promise.all(res.map(r=>r.json()));if(j.some(v=>!v.success))throw Error('Could not load schedules');return {projects:j[0].data,users:j[1].data,rules:j[2].data};},ttlMs:30000});
  const [form,setForm]=useState(initial),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[requestId,setRequestId]=useState('');
  const field=(name:keyof typeof initial,value:string)=>{setForm(p=>({...p,[name]:value}));setRequestId('');};
  async function save(e:React.FormEvent){e.preventDefault();setBusy(true);setMessage('');const id=requestId||crypto.randomUUID();setRequestId(id);try{const r=await fetch('/api/tasks/recurring',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...form,requestId:id})});const j=await r.json();if(!r.ok||!j.success)throw Error(j.error||'Save failed');setMessage(j.data.warning||'Recurring task saved.');setForm({...initial,startDate:new Date().toISOString().slice(0,10)});setRequestId('');await refresh();window.dispatchEvent(new Event('dreamshift:refresh-all'));}catch(e){setMessage(e instanceof Error?e.message:'Save failed');}finally{setBusy(false);}}
  async function toggle(rule:Rule){setBusy(true);setMessage('');try{const r=await fetch('/api/tasks/recurring',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:rule._id,active:!rule.active})});const j=await r.json();if(!r.ok||!j.success)throw Error(j.error||'Update failed');await refresh();}catch(e){setMessage(e instanceof Error?e.message:'Update failed');}finally{setBusy(false);}}
  return <div className="page-wrapper"><Link href="/tasks" className="btn btn-ghost">← My Tasks</Link><h1 className="page-title" style={{margin:'14px 0 6px'}}>Recurring tasks</h1><p className="text-muted">Automate routine work without repeatedly creating the same task.</p>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,340px),1fr))',gap:16,marginTop:20,alignItems:'start'}}>
      <form className="card" style={{padding:20,display:'grid',gap:12}} onSubmit={save}><h2 className="section-title">New schedule</h2>
        <label>Task title<input required maxLength={200} className="input" style={{width:'100%',marginTop:4}} value={form.title} onChange={e=>field('title',e.target.value)}/></label>
        <label>Description<textarea className="input" style={{width:'100%',marginTop:4}} rows={3} value={form.description} onChange={e=>field('description',e.target.value)}/></label>
        <label>Project<select required className="input" style={{width:'100%',marginTop:4}} value={form.projectId} onChange={e=>field('projectId',e.target.value)}><option value="">Select project</option>{data.projects.filter(p=>p.status!=='CLOSED').map(p=><option key={p._id} value={p._id}>{p.name}</option>)}</select></label>
        <label>Assignee<select className="input" style={{width:'100%',marginTop:4}} value={form.assigneeId} onChange={e=>field('assigneeId',e.target.value)}><option value="">Myself</option>{data.users.map(u=><option key={u._id} value={u._id}>{u.name}</option>)}</select></label>
        <label>Repeat<select className="input" style={{width:'100%',marginTop:4}} value={form.cadence} onChange={e=>field('cadence',e.target.value)}>{['DAILY','WEEKDAYS','WEEKLY','MONTHLY'].map(v=><option key={v} value={v}>{v==='WEEKDAYS'?'Monday to Friday':v.toLowerCase()}</option>)}</select></label>
        <label>Priority<select className="input" style={{width:'100%',marginTop:4}} value={form.priority} onChange={e=>field('priority',e.target.value)}>{['LOW','MEDIUM','HIGH','URGENT'].map(v=><option key={v}>{v}</option>)}</select></label>
        <label>First due date (UTC)<input required type="date" className="input" style={{width:'100%',marginTop:4}} min={new Date().toISOString().slice(0,10)} value={form.startDate} onChange={e=>field('startDate',e.target.value)}/></label>
        <p className="text-muted text-sm">Tasks are generated daily at midnight UTC and due by the end of their UTC date. Weekday schedules skip Saturday and Sunday. Monthly schedules use the last day when the original day is unavailable.</p>
        <button className="btn btn-primary" disabled={busy||loading}>Create schedule</button>
      </form>
      <div className="card" style={{padding:20,display:'grid',gap:12}}><h2 className="section-title">Your schedules</h2>{error&&<p role="alert">{error}</p>}{loading?<p>Loading schedules…</p>:data.rules.length===0?<p className="text-muted">No recurring tasks yet.</p>:data.rules.map(r=><div key={r._id} style={{padding:'12px 0',borderTop:'1px solid var(--border)',display:'flex',justifyContent:'space-between',gap:12,alignItems:'center'}}><div><strong>{r.title}</strong><p className="text-muted text-sm">{data.projects.find(p=>p._id===r.projectId)?.name||'Project'} · {r.cadence.toLowerCase()} · {r.active?'Next: '+r.nextRunAt.slice(0,10):'Paused'}</p>{r.lastError&&<p className="text-sm">{r.lastError}</p>}</div><button className="btn btn-secondary" disabled={busy} onClick={()=>void toggle(r)}>{r.active?'Pause':'Resume'}</button></div>)}</div>
    </div>{message&&<p role="status" style={{marginTop:16}}>{message}</p>}</div>;
}
