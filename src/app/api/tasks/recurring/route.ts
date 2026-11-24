import { monitored } from '@/lib/routeTelemetry';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import mongoose from 'mongoose';
import { createHash } from 'node:crypto';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongoose';
import { hasWorkspaceAccess } from '@/lib/tenancy';
import { parseTaskDate } from '@/lib/taskCsv';
import { utcDay, nextOccurrence, type Cadence } from '@/lib/recurrence';
import { runDueRecurringTasks } from '@/lib/runRecurringTasks';
import RecurringTask from '@/models/RecurringTask';
import Project from '@/models/Project';
import User from '@/models/User';
const oid=(id:string)=>new mongoose.Types.ObjectId(id);
const fail=(error:string,status=400)=>NextResponse.json({success:false,error},{status});
async function currentUser(){const s=await getServerSession(authOptions);return s?.user?.id && mongoose.isValidObjectId(s.user.id)?s.user.id:null;}
async function handleGET(){
  const userId=await currentUser();if(!userId)return fail('Unauthorized',401);
  try{await dbConnect();const data=await RecurringTask.collection.find({ownerId:oid(userId)}).sort({createdAt:-1}).limit(200).toArray();return NextResponse.json({success:true,data});}catch(e){console.error('Recurring list failed',e);return fail('Unable to load recurring tasks',500);}
}
async function handlePOST(req:Request){
  const userId=await currentUser();if(!userId)return fail('Unauthorized',401);
  try{
    const body=await req.json();
    const title=String(body.title||'').trim(),description=String(body.description||'').trim(),cadence=String(body.cadence||'').toUpperCase() as Cadence,priority=String(body.priority||'MEDIUM').toUpperCase();
    if(!title||title.length>200||description.length>10000||!['DAILY','WEEKDAYS','WEEKLY','MONTHLY'].includes(cadence)||!['LOW','MEDIUM','HIGH','URGENT'].includes(priority))return fail('Check title, frequency and priority.');
    if(!mongoose.isValidObjectId(body.projectId)||!mongoose.isValidObjectId(body.assigneeId||userId))return fail('Select a project and assignee.');
    if(typeof body.requestId!=='string'||!/^[a-f0-9-]{36}$/i.test(body.requestId))return fail('Invalid request ID.');
    const start=parseTaskDate(String(body.startDate||''));
    if(!start||start<utcDay(new Date()))return fail('Choose today or a future UTC date.');
    if(cadence==='WEEKDAYS'&&[0,6].includes(start.getUTCDay()))return fail('Choose a weekday for the first due date.');
    await dbConnect();
    const [project,assignee]=await Promise.all([Project.collection.findOne({_id:oid(body.projectId)}),User.collection.findOne({_id:oid(body.assigneeId||userId)},{projection:{_id:1}})]);
    if(!project||!(await hasWorkspaceAccess(userId,String(project.workspaceId||project.workspace_id))))return fail('Project unavailable',403);
    if(String(project.status||'ACTIVE').toUpperCase()==='CLOSED'||!assignee)return fail('Choose an active project and valid assignee.');
    const id=oid(createHash('sha256').update(`recurring-rule:${userId}:${body.requestId}`).digest('hex').slice(0,24));
    const now=new Date();
    await RecurringTask.collection.updateOne({_id:id},{$setOnInsert:{ownerId:oid(userId),projectId:oid(body.projectId),assigneeId:assignee._id,title,description,priority,cadence,anchorDay:start.getUTCDate(),nextRunAt:start,active:true,createdAt:now,updatedAt:now}},{upsert:true});
    let warning:string|undefined;
    try{await runDueRecurringTasks(now,String(id));}catch(e){console.error('Initial recurring run failed',e);warning='Schedule saved. The daily scheduler will retry task creation.';}
    return NextResponse.json({success:true,data:{id:String(id),warning}},{status:201});
  }catch(e){console.error('Recurring creation failed',e);return fail('Unable to create schedule. Check inputs or retry.');}
}
async function handlePATCH(req:Request){
  const userId=await currentUser();if(!userId)return fail('Unauthorized',401);
  try{
    const body=await req.json();if(!mongoose.isValidObjectId(body.id)||typeof body.active!=='boolean')return fail('Invalid schedule update.');
    await dbConnect();const filter={_id:oid(body.id),ownerId:oid(userId)};
    const rule=await RecurringTask.collection.findOne(filter);if(!rule)return fail('Schedule not found',404);
    const now=new Date();let next=new Date(rule.nextRunAt);
    if(body.active && !rule.active){
      const today=utcDay(now);
      // Resuming skips dates while paused instead of flooding the task queue.
      while(next<today)next=nextOccurrence(next,rule.cadence as Cadence,Number(rule.anchorDay));
    }
    await RecurringTask.collection.updateOne(filter,{$set:{active:body.active,nextRunAt:next,updatedAt:now},$unset:{lastError:''}});
    return NextResponse.json({success:true});
  }catch(e){console.error('Recurring update failed',e);return fail('Unable to update schedule',500);}
}

export const GET=monitored('tasks/recurring.get',handleGET);

export const POST=monitored('tasks/recurring.post',handlePOST);

export const PATCH=monitored('tasks/recurring.patch',handlePATCH);
