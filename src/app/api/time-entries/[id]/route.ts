import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import mongoose from 'mongoose';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongoose';
import TimeEntry from '@/models/TimeEntry';
import Task from '@/models/Task';
import Project from '@/models/Project';
import { hasWorkspaceAccess } from '@/lib/tenancy';

function toDate(value: unknown) {
  if (!value) return null;
  const parsed = value instanceof Date ? new Date(value.getTime()) : new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

async function resolveWorkspaceAccess(userId: string, taskId: string) {
  const task = await Task.collection.findOne({ _id: new mongoose.Types.ObjectId(taskId) }, { projection: { projectId: 1, project_id: 1 } });
  if (!task) return { error: 'Task not found', status: 404 } as const;

  const projectId = String(task.projectId || task.project_id || '');
  if (!projectId || !mongoose.isValidObjectId(projectId)) {
    return { error: 'Task has invalid project reference', status: 400 } as const;
  }

  const project = await Project.collection.findOne(
    { _id: new mongoose.Types.ObjectId(projectId) },
    { projection: { workspaceId: 1, workspace_id: 1 } }
  );
  if (!project) return { error: 'Project not found', status: 404 } as const;

  const workspaceId = String(project.workspaceId || project.workspace_id || '');
  const allowed = await hasWorkspaceAccess(userId, workspaceId);
  if (!allowed) return { error: 'Forbidden task access', status: 403 } as const;

  return { task, projectId } as const;
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    await dbConnect();
    const userId = (session.user as { id: string }).id;
    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ success: false, error: 'Invalid time entry id' }, { status: 400 });
    }

    const existing = await TimeEntry.collection.findOne({ _id: new mongoose.Types.ObjectId(id) });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Time entry not found' }, { status: 404 });
    }

    if (String(existing.userId || '') !== String(userId)) {
      return NextResponse.json({ success: false, error: 'Forbidden time entry access' }, { status: 403 });
    }

    const body = await req.json();
    const nextTaskId = String(body.taskId || existing.taskId || '');
    if (!nextTaskId || !mongoose.isValidObjectId(nextTaskId)) {
      return NextResponse.json({ success: false, error: 'Valid taskId is required' }, { status: 400 });
    }

    const startTime = toDate(body.startTime ?? existing.startTime);
    const endTime = toDate(body.endTime ?? existing.endTime);
    if (!startTime || !endTime) {
      return NextResponse.json({ success: false, error: 'Valid startTime and endTime are required' }, { status: 400 });
    }
    if (endTime.getTime() <= startTime.getTime()) {
      return NextResponse.json({ success: false, error: 'endTime must be after startTime' }, { status: 400 });
    }

    const nextTaskAccess = await resolveWorkspaceAccess(userId, nextTaskId);
    if ('error' in nextTaskAccess) {
      return NextResponse.json({ success: false, error: nextTaskAccess.error }, { status: nextTaskAccess.status });
    }

    const tx=await mongoose.startSession();
    let data:Record<string,unknown>|null=null;
    try{
      await tx.withTransaction(async()=>{
        const fresh=await TimeEntry.collection.findOne({_id:new mongoose.Types.ObjectId(id)},{session:tx});
        if(!fresh||String(fresh.userId)!==userId)throw Error('Time entry no longer available');
        // Do not overwrite edits made by another device while this request was being prepared.
        if(String(fresh.updatedAt||'')!==String(existing.updatedAt||'')||String(fresh.taskId)!==String(existing.taskId)||Number(fresh.durationSeconds)!==Number(existing.durationSeconds))throw Error('Time entry changed; reload before editing.');
        const previousDuration=Number(fresh.durationSeconds||0);
        const unchanged=startTime.getTime()===new Date(fresh.startTime).getTime()&&endTime.getTime()===new Date(fresh.endTime).getTime();
        const nextDuration=unchanged?previousDuration:Math.max(0,Math.round((endTime.getTime()-startTime.getTime())/1000));
        const previousTaskId=String(fresh.taskId||'');
        const adjust=async(taskId:string,seconds:number)=>{if(!seconds)return;const r=await Task.collection.updateOne({_id:new mongoose.Types.ObjectId(taskId)},{$inc:{timeSpent:seconds}},{session:tx});if(!r.matchedCount)throw Error('Task no longer available');};
        if(previousTaskId!==nextTaskId){await adjust(previousTaskId,-previousDuration);await adjust(nextTaskId,nextDuration);}else await adjust(nextTaskId,nextDuration-previousDuration);
        const value=await TimeEntry.collection.findOneAndUpdate({_id:new mongoose.Types.ObjectId(id)},{$set:{taskId:new mongoose.Types.ObjectId(nextTaskId),projectId:new mongoose.Types.ObjectId(nextTaskAccess.projectId!),startTime,endTime,durationSeconds:nextDuration,note:String(body.note??fresh.note??'').trim().slice(0,1000),updatedAt:new Date()}},{returnDocument:'after',session:tx});
        if(!value)throw Error('Time entry no longer available');
        data={...value,taskId:String(value.taskId),projectId:String(value.projectId),userId:String(value.userId),durationSeconds:Number(value.durationSeconds||0),note:String(value.note||'')};
      });
    }finally{await tx.endSession();}
    return NextResponse.json({ success: true, data }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    await dbConnect();
    const userId = (session.user as { id: string }).id;
    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ success: false, error: 'Invalid time entry id' }, { status: 400 });
    }

    const existing = await TimeEntry.collection.findOne({ _id: new mongoose.Types.ObjectId(id) });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Time entry not found' }, { status: 404 });
    }

    if (String(existing.userId || '') !== String(userId)) {
      return NextResponse.json({ success: false, error: 'Forbidden time entry access' }, { status: 403 });
    }

    const tx=await mongoose.startSession();
    try{
      await tx.withTransaction(async()=>{
        const removed=await TimeEntry.collection.findOneAndDelete({_id:new mongoose.Types.ObjectId(id)},{session:tx});
        if(!removed)return;
        if(String(removed.userId)!==userId)throw Error('Forbidden time entry access');
        const taskId=String(removed.taskId||''),seconds=Number(removed.durationSeconds||0);
        if(mongoose.isValidObjectId(taskId)&&seconds>0)await Task.collection.updateOne({_id:new mongoose.Types.ObjectId(taskId)},{$inc:{timeSpent:-seconds}},{session:tx});
      });
    }finally{await tx.endSession();}
    return NextResponse.json({ success: true, data: { deleted: true } }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
