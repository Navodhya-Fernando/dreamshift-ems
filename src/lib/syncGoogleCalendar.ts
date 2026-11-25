import mongoose from 'mongoose';
import {createHash,randomUUID} from 'node:crypto';
import Connection from '@/models/GoogleCalendarConnection';
import Project from '@/models/Project';
import Task from '@/models/Task';
import Meeting from '@/models/Meeting';
import User from '@/models/User';
import {getAccessibleWorkspaceIds} from '@/lib/tenancy';
import {googleConfig,getAccess,calendars,importEvents,managedEvents,writeEvent,type RemoteEvent} from '@/lib/googleCalendar';
import {fingerprint,syncDecision,dayAfter,type Schedule} from '@/lib/calendarSyncPolicy';
const oid=(id:string)=>new mongoose.Types.ObjectId(id);
type Entity={id:string;kind:'task'|'meeting';schedule:Schedule;pull:(s:Schedule)=>Promise<boolean>};
const dateOnly=(v:unknown)=>new Date(String(v)).toISOString().slice(0,10);
const stamp=(v:unknown)=>new Date(String(v)).toISOString();
function remoteSchedule(r:RemoteEvent):Schedule|null{
 try{const allDay=Boolean(r.start?.date);if(!r.start||!r.end)return null;const start=allDay?dateOnly(r.start.date):stamp(r.start.dateTime),end=allDay?dateOnly(r.end.date):stamp(r.end.dateTime);if(end<=start)return null;return {title:String(r.summary||''),start,end,allDay};}catch{return null;}
}
export const eventId=(uid:string,id:string)=>'ems'+createHash('sha256').update(uid+':'+id).digest('hex').slice(0,40);
async function entities(uid:string){
 const id=oid(uid),now=Date.now(),min=new Date(now-30*86400000),max=new Date(now+90*86400000);
 const workspaces=await getAccessibleWorkspaceIds(uid),keys=workspaces.flatMap(w=>mongoose.isValidObjectId(w)?[w,oid(w)]:[w]);
 const projects=await Project.collection.find({$or:[{workspaceId:{$in:keys}},{workspace_id:{$in:keys}}]},{projection:{_id:1}}).toArray();
 const pids=projects.flatMap(p=>[p._id,String(p._id)]);
 const [tasks,meetings]=await Promise.all([
 Task.collection.find({$and:[{$or:[{projectId:{$in:pids}},{project_id:{$in:pids}}]},{$or:[{assigneeId:{$in:[id,uid]}},{assigneeIds:{$in:[id,uid]}}]},{$or:[{dueDate:{$gte:min,$lte:max}},{due_date:{$gte:min,$lte:max}}]}],status:{$nin:['DONE','done','COMPLETED','Completed','completed']}},{projection:{title:1,dueDate:1,due_date:1,assigneeId:1,assigneeIds:1,updatedAt:1}}).sort({dueDate:1,_id:1}).limit(100).toArray(),
 Meeting.collection.find({organizerId:id,startTime:{$gte:min,$lte:max}},{projection:{title:1,startTime:1,endTime:1,updatedAt:1}}).sort({startTime:1,_id:1}).limit(100).toArray()
 ]);
 const list:Entity[]=[];
 for(const t of tasks){
  try{const start=dateOnly(t.dueDate||t.due_date),title=String(t.title||'Task').slice(0,200),assignees=new Set([t.assigneeId,...(Array.isArray(t.assigneeIds)?t.assigneeIds:[])].filter(Boolean).map(String));list.push({id:'task:'+t._id,kind:'task',schedule:{title,start,end:dayAfter(start),allDay:true},pull:async s=>{
   // Shared assignments, title changes and timed events are never silently applied.
   if(assignees.size!==1||!assignees.has(uid)||!s.allDay||s.end!==dayAfter(s.start)||s.title!==title)return false;
   const updated=await Task.collection.updateOne({_id:t._id,updatedAt:t.updatedAt,dueDate:t.dueDate||{$exists:false},due_date:t.due_date||{$exists:false},assigneeId:t.assigneeId||{$exists:false},assigneeIds:t.assigneeIds||{$exists:false}},{$set:{dueDate:new Date(s.start+'T00:00:00Z'),updatedAt:new Date()}});
   return Boolean(updated.matchedCount);
  }});}catch{}
 }
 for(const m of meetings){try{list.push({id:'meeting:'+m._id,kind:'meeting',schedule:{title:String(m.title||'Meeting').slice(0,200),start:stamp(m.startTime),end:stamp(m.endTime),allDay:false},pull:async s=>{
 if(s.allDay||!s.title.trim()||s.title.length>200||Date.parse(s.end)-Date.parse(s.start)>86400000)return false;
 const result=await Meeting.collection.updateOne({_id:m._id,organizerId:id,updatedAt:m.updatedAt,startTime:m.startTime,endTime:m.endTime},{$set:{title:s.title,startTime:new Date(s.start),endTime:new Date(s.end),updatedAt:new Date()}});
 return Boolean(result.matchedCount);
 }});}catch{}}
 return list;
}
export async function syncGoogle(uid:string,calendarId:string,writeEnabled:boolean,autoSync:boolean){
 const config=googleConfig();if(!config)throw Error('Google Calendar is not configured.');
 const leaseId=randomUUID(),now=new Date(),id=oid(uid);
 const connection=await Connection.findOneAndUpdate({_id:id,$or:[{syncLeaseUntil:{$exists:false}},{syncLeaseUntil:{$lt:now}}]},{$set:{syncLeaseUntil:new Date(Date.now()+360000),syncLeaseId:leaseId,lastAttemptAt:now}},{new:true}).select('+refreshToken').lean();
 if(!connection)throw Error('Calendar is disconnected or another sync is in progress.');
 const guard={_id:id,syncLeaseId:leaseId,revision:connection.revision};
 try{
 if(!await User.exists({_id:id,employmentStatus:{$ne:'LEFT'}}))throw Error('Employee account is inactive.');
 const token=await getAccess(config,uid,connection.refreshToken),available=await calendars(token),selected=available.find(a=>a.id===calendarId);
 if(!selected)throw Error('Calendar access is unavailable.');
 if(writeEnabled&&selected.accessRole!=='owner')throw Error('For two-way sync, select a work calendar you own.');
 let created=0,pushed=0,pulled=0,conflicts=0,remaining=0;
 if(writeEnabled){
  const [local,remote]=await Promise.all([entities(uid),managedEvents(token,calendarId,uid)]);
  const byId=new Map(remote.map(r=>[r.id,r]));
  let mutations=0;
  for(const item of local){
   const id=eventId(uid,item.id),r=byId.get(id),props=r?.extendedProperties?.private;
   if(r&&(!props||props.emsOwner!==uid||props.emsEntity!==item.id||r.status==='cancelled')){conflicts++;continue;}
   const rs=r?remoteSchedule(r):null;
   if(r&&!rs){conflicts++;continue;}
   const decision=r&&rs?syncDecision(props?.emsBase,item.schedule,rs):'create';
   if(decision==='unchanged')continue;
   if(decision==='conflict'){conflicts++;continue;}
   if(mutations>=12){remaining++;continue;}
   // Lease prevents simultaneous syncs. Check connection still exists before external writes.
   if(!(await Connection.exists(guard)))throw Error('Calendar connection changed during sync.');
   let target=item.schedule;
   if(decision==='pull'&&rs){if(!await item.pull(rs)){conflicts++;continue;}target=rs;pulled++;}
   const body={summary:target.title,start:target.allDay?{date:target.start}:{dateTime:target.start},end:target.allDay?{date:target.end}:{dateTime:target.end},visibility:'private',extendedProperties:{private:{emsOwner:uid,emsEntity:item.id,emsBase:fingerprint(target)}}};
   mutations++;
   const ok=await writeEvent(token,calendarId,r?'PATCH':'POST',r?body:{...body,id},r);
   if(!ok){conflicts++;continue;}if(decision==='create')created++;else if(decision==='push')pushed++;
  }
 }
 const events=await importEvents(token,calendarId);
 const updated=await Connection.updateOne(guard,{$set:{calendarId,calendarName:selected.name,events,lastSyncedAt:new Date(),revision:randomUUID(),writeEnabled,autoSync,lastSyncError:conflicts?`${conflicts} linked events need review; EMS did not overwrite conflicts.`:''},$unset:{syncLeaseUntil:1,syncLeaseId:1}});
 if(!updated.matchedCount)throw Error('Calendar connection changed. Refresh and retry.');
 return {count:events.length,calendarName:selected.name,created,pushed,pulled,conflicts,remaining};
 }catch(e){await Connection.updateOne(guard,{$set:{lastSyncError:'Synchronization failed. Check Google permissions or retry.'},$unset:{syncLeaseUntil:1,syncLeaseId:1}});throw e;}
}
export async function runGoogleSyncBatch(){
 if(!googleConfig())return {configured:false,synced:0,failed:0};
 const rows=await Connection.find({autoSync:true,calendarId:{$exists:true,$ne:''},$or:[{lastAttemptAt:{$exists:false}},{lastAttemptAt:{$lt:new Date(Date.now()-240000)}}]}).sort({lastAttemptAt:1}).limit(3).select('calendarId writeEnabled autoSync').lean();
 let synced=0,failed=0;
 await Promise.all(rows.map(async c=>{try{await syncGoogle(String(c._id),c.calendarId!,Boolean(c.writeEnabled),true);synced++;}catch{failed++;}}));
 return {configured:true,synced,failed};
}
