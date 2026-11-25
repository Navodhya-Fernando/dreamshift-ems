import mongoose from 'mongoose';
import {createHash,createHmac,randomUUID} from 'node:crypto';
import {googleConfig,getAccess} from '@/lib/googleCalendar';
import {taskFingerprint,taskDecision,taskDate,doneStatus,taskStatus,type TaskSnapshot} from '@/lib/googleTasksPolicy';
import {hasWorkspaceAccess} from '@/lib/tenancy';
import Connection from '@/models/GoogleCalendarConnection';
import Link from '@/models/GoogleTaskLink';
import Project from '@/models/Project';
import Task from '@/models/Task';
const oid=(id:string)=>new mongoose.Types.ObjectId(id);
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const linkKey=(uid:string,list:string,remote:string)=>hash(JSON.stringify([uid,list,remote]));
type Remote={id:string;title?:string;due?:string;status?:string;notes?:string;etag?:string;deleted?:boolean;hidden?:boolean;parent?:string;assignmentInfo?:unknown};
type List={id:string;title:string};
async function request<T>(token:string,path:string,params:Record<string,string>={},method='GET',body?:Record<string,unknown>,etag?:string){
 const u=new URL('https://tasks.googleapis.com/tasks/v1/'+path);u.search=new URLSearchParams(params).toString();
 const r=await fetch(u,{method,headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{}),...(etag?{'If-Match':etag}:{})},...(body?{body:JSON.stringify(body)}:{}),cache:'no-store',signal:AbortSignal.timeout(10000)});
 if(r.status===412)throw Error('Google task changed during synchronization. Retry.');
 if(!r.ok)throw Error('Google Tasks request failed. Enable the API and check your authorization.');
 return await r.json() as T;
}
export async function taskLists(token:string){const rows:List[]=[];let pageToken='';for(let i=0;i<3;i++){const p=await request<{items?:List[];nextPageToken?:string}>(token,'users/@me/lists',{maxResults:'100',...(pageToken?{pageToken}:{})});rows.push(...p.items||[]);if(!p.nextPageToken)return rows;pageToken=p.nextPageToken;}throw Error('Too many Google task lists.');}
async function remoteTasks(token:string,list:string){const rows:Remote[]=[];let pageToken='';for(let i=0;i<6;i++){const p=await request<{items?:Remote[];nextPageToken?:string}>(token,'lists/'+encodeURIComponent(list)+'/tasks',{maxResults:'100',showCompleted:'true',showHidden:'true',showDeleted:'true',...(pageToken?{pageToken}:{})});rows.push(...p.items||[]);if(!p.nextPageToken)return rows;pageToken=p.nextPageToken;}throw Error('Choose a smaller dedicated Google task list (maximum 600 entries).');}
function remoteSnapshot(t:Remote):TaskSnapshot{return {title:String(t.title||''),due:taskDate(t.due),completed:t.status==='completed'};}
function marker(key:Buffer,uid:string,list:string,id:string){return 'DreamShift EMS link: '+id+':'+createHmac('sha256',key).update(JSON.stringify([uid,list,id])).digest('hex');}
function writable(s:TaskSnapshot){return {title:s.title,status:s.completed?'completed':'needsAction',...(s.due?{due:s.due+'T00:00:00.000Z'}:{due:null}),...(!s.completed?{completed:null}:{})};}
export async function syncGoogleTasks(uid:string,listId:string,projectId:string,auto:boolean){
 const config=googleConfig();if(!config)throw Error('Google integration is not configured.');
 if(!listId||listId.length>1024||!mongoose.isValidObjectId(projectId))throw Error('Select a task list and EMS project.');
 const userId=oid(uid),pid=oid(projectId),now=new Date(),leaseId=randomUUID();
 const conn=await Connection.findOneAndUpdate({_id:userId,tasksGranted:true,$or:[{syncLeaseUntil:{$exists:false}},{syncLeaseUntil:{$lt:now}}]},{$set:{syncLeaseId:leaseId,syncLeaseUntil:new Date(Date.now()+360000),lastTasksAttemptAt:now}},{new:true}).select('+refreshToken').lean();
 if(!conn)throw Error('Connect Google Tasks or wait for the current sync.');
 const guard={_id:userId,revision:conn.revision,syncLeaseId:leaseId};
 try{
 const project=await Project.collection.findOne({_id:pid},{projection:{workspaceId:1,workspace_id:1,status:1}});
 if(!project||String(project.status||'ACTIVE').toUpperCase()==='CLOSED'||!await hasWorkspaceAccess(uid,String(project.workspaceId||project.workspace_id)))throw Error('Choose an accessible active project.');
 const token=await getAccess(config,uid,conn.refreshToken);
 if(!(await taskLists(token)).some(l=>l.id===listId))throw Error('Google task list unavailable.');
 const [remote,links,tasks]=await Promise.all([remoteTasks(token,listId),Link.find({userId,listId}).limit(1000).lean(),Task.collection.find({$and:[{$or:[{projectId:pid},{projectId},{project_id:pid},{project_id:projectId}]},{$or:[{assigneeId:{$in:[userId,uid]}},{assigneeIds:{$in:[userId,uid]}}]}]},{projection:{title:1,dueDate:1,due_date:1,status:1,assigneeId:1,assigneeIds:1,assignee:1,updatedAt:1,projectId:1,project_id:1}}).limit(501).toArray()]);
 if(tasks.length>500||links.length>=1000)throw Error('Choose a smaller project or task list.');
 // Only canonical, single-assignee records are allowed; never export another employee's work.
 const local=tasks.filter(t=>{const ids=new Set([t.assigneeId,...(Array.isArray(t.assigneeIds)?t.assigneeIds:[])].filter(Boolean).map(String));return ids.size===1&&ids.has(uid);});
 const localById=new Map(local.map(t=>[String(t._id),t])),remoteById=new Map(remote.map(t=>[t.id,t]));
 const mappedLocal=new Set(links.map(l=>String(l.localId))),mappedRemote=new Set(links.map(l=>l.remoteId));
 const remoteMarkers=new Map<string,Remote[]>();
 for(const r of remote){const match=/^DreamShift EMS link: ([a-f0-9]{24}):[a-f0-9]{64}$/m.exec(r.notes||'');if(match&&match[0]===marker(config.key,uid,listId,match[1])){const found=remoteMarkers.get(match[1])||[];found.push(r);remoteMarkers.set(match[1],found);}}
 const snapshot=(t:typeof local[number]):TaskSnapshot=>({title:String(t.title||''),due:taskDate(t.dueDate||t.due_date),completed:doneStatus(t.status)});
 let imported=0,exported=0,pulled=0,pushed=0,conflicts=0,pending=0,mutations=0;
 const allow=async()=>{if(mutations>=16){pending++;return false;}if(!await Connection.exists(guard))throw Error('Connection changed.');mutations++;return true;};
 const addLink=async(localId:mongoose.Types.ObjectId,r:Remote,base:string)=>{await Link.updateOne({_id:linkKey(uid,listId,r.id)},{$setOnInsert:{userId,listId,projectId:pid,localId,remoteId:r.id,base}},{upsert:true});mappedLocal.add(String(localId));mappedRemote.add(r.id);};
 for(const l of links){
  if(String(l.projectId)!==projectId){conflicts++;continue;}
  const t=localById.get(String(l.localId)),r=remoteById.get(l.remoteId);if(!t||!r||r.deleted||r.parent||r.assignmentInfo){conflicts++;continue;}
  const a=snapshot(t),b=remoteSnapshot(r),decision=taskDecision(l.base,a,b);
  if(decision==='same')continue;if(decision==='conflict'){conflicts++;continue;}
  if(!await allow())continue;
  if(decision==='pull'){
   if(!b.title.trim()||b.title.length>200||(a.completed!==b.completed&&!['TODO','TO_DO','IN_PROGRESS','INPROGRESS','DONE','COMPLETED'].includes(taskStatus(t.status)))){conflicts++;continue;}
   const set:Record<string,unknown>={title:b.title,updatedAt:new Date()},unset:Record<string,unknown>={};
   if(b.due!==a.due){if(b.due)set.dueDate=new Date(b.due+'T00:00:00.000Z');else unset.dueDate='';unset.due_date='';}
   if(b.completed!==a.completed){set.status=b.completed?'DONE':'TODO';if(b.completed)set.endDate=new Date();else unset.endDate='';}
   const result=await Task.collection.updateOne({_id:t._id,updatedAt:t.updatedAt,projectId:t.projectId||{$exists:false},project_id:t.project_id||{$exists:false},assigneeId:t.assigneeId||{$exists:false},assigneeIds:t.assigneeIds||{$exists:false}},{$set:set,...(Object.keys(unset).length?{$unset:unset}:{})});
   if(!result.matchedCount){conflicts++;continue;}pulled++;await Link.updateOne({_id:l._id},{$set:{base:taskFingerprint(b)}});
  }else if(decision==='push'){
   if(!r.etag){conflicts++;continue;}try{const updated=await request<Remote>(token,'lists/'+encodeURIComponent(listId)+'/tasks/'+encodeURIComponent(r.id),{},'PATCH',writable(a),r.etag);if(taskFingerprint(remoteSnapshot(updated))!==taskFingerprint(a)){conflicts++;continue;}pushed++;await Link.updateOne({_id:l._id},{$set:{base:taskFingerprint(a)}});}catch{conflicts++;}
  }else await Link.updateOne({_id:l._id},{$set:{base:taskFingerprint(a)}});
 }
 // Reconcile ambiguous insert attempts using a signed marker; never blindly repeat a POST.
 for(const t of local){
  const id=String(t._id),a=snapshot(t);if(mappedLocal.has(id)||a.completed)continue;
  const marked=remoteMarkers.get(id)||[];
  if(marked.length){if(marked.length!==1||marked[0].deleted||mappedRemote.has(marked[0].id)||taskFingerprint(remoteSnapshot(marked[0]))!==taskFingerprint(a)){conflicts++;for(const r of marked)mappedRemote.add(r.id);continue;}if(!await allow())continue;await addLink(t._id,marked[0],taskFingerprint(a));continue;}
  if(!a.title.trim()||!await allow())continue;
  const r=await request<Remote>(token,'lists/'+encodeURIComponent(listId)+'/tasks',{},'POST',{...writable(a),notes:marker(config.key,uid,listId,id)});
  await addLink(t._id,r,taskFingerprint(a));exported++;
 }
 for(const r of remote){
  if(mappedRemote.has(r.id)||r.deleted||r.hidden||r.parent||r.assignmentInfo||r.status==='completed'||/^DreamShift EMS link:/m.test(r.notes||''))continue;
  const b=remoteSnapshot(r);if(!b.title.trim()||b.title.length>200){conflicts++;continue;}
  if(!await allow())continue;
  const localId=oid(linkKey(uid,listId,r.id).slice(0,24));
  // The deterministic ID prevents a duplicate import even if the link write was interrupted.
  await Task.collection.updateOne({_id:localId},{$setOnInsert:{title:b.title,description:'Imported from Google Tasks',status:'TODO',priority:'MEDIUM',projectId:pid,assigneeId:userId,assigneeIds:[userId],...(b.due?{dueDate:new Date(b.due+'T00:00:00.000Z')}:{}),timeSpent:0,subtasks:[],attachments:[],createdAt:now,updatedAt:now}},{upsert:true});
  await addLink(localId,r,taskFingerprint(b));imported++;
 }
 const updated=await Connection.updateOne(guard,{$set:{taskListId:listId,taskProjectId:projectId,taskAutoSync:auto,lastTasksSyncedAt:new Date(),tasksLastError:conflicts?conflicts+' linked tasks need review.':''},$unset:{syncLeaseId:1,syncLeaseUntil:1}});
 if(!updated.matchedCount)throw Error('Connection changed.');
 return {imported,exported,pulled,pushed,conflicts,pending};
 }catch(e){await Connection.updateOne(guard,{$set:{tasksLastError:'Google Tasks sync failed. Retry or reconnect.'},$unset:{syncLeaseId:1,syncLeaseUntil:1}});throw e;}
}
export async function runGoogleTasksBatch(){
 if(!googleConfig())return {synced:0,failed:0};
 const rows=await Connection.find({tasksGranted:true,taskAutoSync:true,taskListId:{$exists:true,$ne:''},taskProjectId:{$exists:true,$ne:''},$or:[{lastTasksAttemptAt:{$exists:false}},{lastTasksAttemptAt:{$lt:new Date(Date.now()-300000)}}]}).sort({lastTasksAttemptAt:1}).limit(2).select('taskListId taskProjectId').lean();
 let synced=0,failed=0;await Promise.all(rows.map(async c=>{try{await syncGoogleTasks(String(c._id),c.taskListId!,c.taskProjectId!,true);synced++;}catch{failed++;}}));return {synced,failed};
}
