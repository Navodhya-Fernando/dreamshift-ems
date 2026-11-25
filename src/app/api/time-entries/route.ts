import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import mongoose from 'mongoose';
import { createHash } from 'node:crypto';
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

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    await dbConnect();
    const userId = (session.user as { id: string }).id;
    const { searchParams } = new URL(req.url);
    const taskId = searchParams.get('taskId');

    const filter: Record<string, unknown> = {
      userId: mongoose.isValidObjectId(userId) ? new mongoose.Types.ObjectId(userId) : userId,
    };

    if (taskId) {
      filter.taskId = mongoose.isValidObjectId(taskId) ? new mongoose.Types.ObjectId(taskId) : taskId;
    }

    const entries = await TimeEntry.collection.find(filter).sort({ startTime: -1, createdAt: -1 }).limit(200).toArray();

    const data = entries.map((entry) => ({
      ...entry,
      taskId: String(entry.taskId || ''),
      projectId: String(entry.projectId || ''),
      userId: String(entry.userId || ''),
      source: String(entry.source || 'TIMER').toUpperCase() === 'MANUAL' ? 'MANUAL' : 'TIMER',
      startTime: entry.startTime,
      endTime: entry.endTime,
      durationSeconds: Number(entry.durationSeconds || 0),
      note: String(entry.note || ''),
    }));

    return NextResponse.json({ success: true, count: data.length, data }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    await dbConnect();
    const userId = (session.user as { id: string }).id;
    const body = await req.json();

    const taskId = String(body.taskId || '');
    if (!taskId || !mongoose.isValidObjectId(taskId)) {
      return NextResponse.json({ success: false, error: 'Valid taskId is required' }, { status: 400 });
    }

    const startTime = toDate(body.startTime);
    const endTime = toDate(body.endTime);
    if (!startTime || !endTime) {
      return NextResponse.json({ success: false, error: 'Valid startTime and endTime are required' }, { status: 400 });
    }

    if (endTime.getTime() <= startTime.getTime()) {
      return NextResponse.json({ success: false, error: 'endTime must be after startTime' }, { status: 400 });
    }

    const task = await Task.collection.findOne({ _id: new mongoose.Types.ObjectId(taskId) }, { projection: { projectId: 1, project_id: 1 } });
    if (!task) {
      return NextResponse.json({ success: false, error: 'Task not found' }, { status: 404 });
    }

    const resolvedProjectId = String(task.projectId || task.project_id || '');
    if (!resolvedProjectId || !mongoose.isValidObjectId(resolvedProjectId)) {
      return NextResponse.json({ success: false, error: 'Task has invalid project reference' }, { status: 400 });
    }

    const project = await Project.collection.findOne(
      { _id: new mongoose.Types.ObjectId(resolvedProjectId) },
      { projection: { workspaceId: 1, workspace_id: 1 } }
    );
    if (!project) {
      return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });
    }

    const workspaceId = String(project.workspaceId || project.workspace_id || '');
    const allowed = await hasWorkspaceAccess(userId, workspaceId);
    if (!allowed) {
      return NextResponse.json({ success: false, error: 'Forbidden task access' }, { status: 403 });
    }

    const durationSeconds = Math.max(0, Math.round((endTime.getTime() - startTime.getTime()) / 1000));

    const requestId=typeof body.requestId==='string'&&/^[0-9a-f-]{36}$/i.test(body.requestId)?body.requestId:null;
    const entryId=requestId?new mongoose.Types.ObjectId(createHash('sha256').update('time-entry:'+userId+':'+requestId).digest('hex').slice(0,24)):new mongoose.Types.ObjectId();
    const now=new Date();
    const tx=await mongoose.startSession();
    let entry:unknown=null;
    try{
      await tx.withTransaction(async()=>{
        const existing=await TimeEntry.collection.findOne({_id:entryId},{session:tx});
        if(existing){if(String(existing.userId)!==userId)throw Error('Entry conflict');entry=existing;return;}
        const document={_id:entryId,userId:new mongoose.Types.ObjectId(userId),taskId:new mongoose.Types.ObjectId(taskId),projectId:new mongoose.Types.ObjectId(resolvedProjectId),source:String(body.source||'TIMER').toUpperCase()==='MANUAL'?'MANUAL':'TIMER',startTime,endTime,durationSeconds,note:String(body.note||'').trim().slice(0,1000),createdAt:now,updatedAt:now};
        await TimeEntry.collection.insertOne(document,{session:tx});
        const updated=await Task.collection.updateOne({_id:document.taskId},{$inc:{timeSpent:durationSeconds}},{session:tx});
        if(!updated.matchedCount)throw Error('Task no longer available');
        entry=document;
      });
    }finally{await tx.endSession();}
    return NextResponse.json({ success: true, data: entry }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
