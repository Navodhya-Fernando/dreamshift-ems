import {NextResponse} from 'next/server';
import {getServerSession} from 'next-auth';
import mongoose from 'mongoose';
import {authOptions} from '@/lib/auth';
import dbConnect from '@/lib/mongoose';
import ActiveTimer from '@/models/ActiveTimer';
import Task from '@/models/Task';
import Project from '@/models/Project';
import TimeEntry from '@/models/TimeEntry';
import {hasWorkspaceAccess} from '@/lib/tenancy';
import {elapsedAt} from '@/lib/timerMath';
import {monitored} from '@/lib/routeTelemetry';
const fail=(error:string,status=400)=>NextResponse.json({success:false,error},{status});
async function current(){const s=await getServerSession(authOptions);return s?.user?.id&&mongoose.isValidObjectId(s.user.id)?new mongoose.Types.ObjectId(s.user.id):null;}
const response=(data:unknown)=>NextResponse.json({success:true,data,serverNow:Date.now()},{headers:{'Cache-Control':'no-store'}});
async function get(){try{const id=await current();if(!id)return fail('Unauthorized',401);await dbConnect();return response(await ActiveTimer.findById(id).lean());}catch(e){console.error('Timer read failed',e);return fail('Timer unavailable',503);}}
async function post(req:Request){
try{
const id=await current();if(!id)return fail('Unauthorized',401);
const body=await req.json();const action=String(body.action||'');if(!['start','pause','resume','stop'].includes(action))return fail('Invalid timer action.');
await dbConnect();const active=await ActiveTimer.findById(id).lean();const now=new Date();
if(action==='start'){
 if(active)return fail('A timer already exists. Stop it before starting another.',409);
 if(!mongoose.isValidObjectId(body.taskId))return fail('Choose a task.');
 const task=await Task.collection.findOne({_id:new mongoose.Types.ObjectId(body.taskId)},{projection:{title:1,projectId:1,project_id:1}});if(!task)return fail('Task not found',404);
 const pid=String(task.projectId||task.project_id||'');if(!mongoose.isValidObjectId(pid))return fail('Invalid project.');
 const project=await Project.collection.findOne({_id:new mongoose.Types.ObjectId(pid)},{projection:{workspaceId:1,workspace_id:1}});if(!project||!(await hasWorkspaceAccess(String(id),String(project.workspaceId||project.workspace_id))))return fail('Forbidden task access',403);
 try{const timer=await ActiveTimer.create({_id:id,sessionId:new mongoose.Types.ObjectId(),taskId:task._id,projectId:new mongoose.Types.ObjectId(pid),taskTitle:String(task.title||'Task'),note:String(body.note||'').slice(0,1000),startedAt:now,runningSince:now,elapsedSeconds:0,revision:1});return response(timer);}catch(e){if((e as {code?:number}).code===11000)return fail('A timer is already running on another device.',409);throw e;}
}
if(!active)return action==='stop'?response(null):fail('No active timer.',409);
if(String(body.sessionId)!==String(active.sessionId)||body.revision!==active.revision)return fail('Timer changed on another device. Refresh and try again.',409);
const filter={_id:id,sessionId:active.sessionId,revision:active.revision};
if(action==='pause'||action==='resume'){
 if(action==='pause'&&!active.runningSince||action==='resume'&&active.runningSince)return response(active);
 const updated=await ActiveTimer.findOneAndUpdate(filter,{$set:{elapsedSeconds:elapsedAt(active.elapsedSeconds,active.runningSince,now.getTime()),runningSince:action==='resume'?now:null},$inc:{revision:1}},{new:true}).lean();
 return updated?response(updated):fail('Timer changed on another device.',409);
}
// A transaction commits the entry, task total, and timer removal together.
const tx=await mongoose.startSession();
try{
 await tx.withTransaction(async()=>{
   const fresh=await ActiveTimer.findOne(filter).session(tx).lean();if(!fresh)throw new Error('TIMER_CONFLICT');
   const seconds=elapsedAt(fresh.elapsedSeconds,fresh.runningSince,now.getTime());
   if(seconds>0){
     await TimeEntry.collection.insertOne({_id:fresh.sessionId,userId:id,taskId:fresh.taskId,projectId:fresh.projectId,source:'TIMER',startTime:fresh.startedAt,endTime:now,durationSeconds:seconds,note:fresh.note,createdAt:now,updatedAt:now},{session:tx});
     const updated=await Task.collection.updateOne({_id:fresh.taskId},{$inc:{timeSpent:seconds}},{session:tx});if(!updated.matchedCount)throw new Error('TASK_MISSING');
   }
   const deleted=await ActiveTimer.deleteOne(filter,{session:tx});if(!deleted.deletedCount)throw new Error('TIMER_CONFLICT');
 });
 return response(null);
}catch(e){if(e instanceof Error&&e.message==='TIMER_CONFLICT')return fail('Timer changed on another device.',409);if(e instanceof Error&&e.message==='TASK_MISSING')return fail('Original task is missing; contact an administrator. Timer retained.',409);throw e;}finally{await tx.endSession();}
}catch(e){console.error('Timer action failed',e);return fail('Could not save timer change. Your saved timer is retained.',503);}
}
export const GET=monitored('time.timer.get',get);
export const POST=monitored('time.timer.post',post);
