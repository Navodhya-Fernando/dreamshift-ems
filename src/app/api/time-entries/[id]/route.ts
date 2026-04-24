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
  const parsed = new Date(String(value));
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

    const previousDuration = Number(existing.durationSeconds || 0);
    const nextDuration = Math.max(0, Math.round((endTime.getTime() - startTime.getTime()) / 1000));
    const previousTaskId = String(existing.taskId || '');

    if (previousTaskId !== nextTaskId) {
      if (previousDuration > 0) {
        await Task.collection.updateOne(
          { _id: new mongoose.Types.ObjectId(previousTaskId) },
          { $inc: { timeSpent: -previousDuration } }
        );
      }
      if (nextDuration > 0) {
        await Task.collection.updateOne(
          { _id: new mongoose.Types.ObjectId(nextTaskId) },
          { $inc: { timeSpent: nextDuration } }
        );
      }
    } else if (previousDuration !== nextDuration) {
      await Task.collection.updateOne(
        { _id: new mongoose.Types.ObjectId(nextTaskId) },
        { $inc: { timeSpent: nextDuration - previousDuration } }
      );
    }

    const updated = await TimeEntry.collection.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(id) },
      {
        $set: {
          taskId: nextTaskId,
          projectId: nextTaskAccess.projectId,
          source: String(body.source || existing.source || 'TIMER').toUpperCase() === 'MANUAL' ? 'MANUAL' : 'TIMER',
          startTime,
          endTime,
          durationSeconds: nextDuration,
          note: String(body.note || '').trim(),
        },
      },
      { returnDocument: 'after' }
    );

    const value = updated?.value;
    const data = value
      ? {
          ...value,
          taskId: String(value.taskId || ''),
          projectId: String(value.projectId || ''),
          userId: String(value.userId || ''),
          source: String(value.source || 'TIMER').toUpperCase() === 'MANUAL' ? 'MANUAL' : 'TIMER',
          startTime: value.startTime,
          endTime: value.endTime,
          durationSeconds: Number(value.durationSeconds || 0),
          note: String(value.note || ''),
        }
      : null;

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

    const taskId = String(existing.taskId || '');
    const durationSeconds = Number(existing.durationSeconds || 0);
    if (taskId && durationSeconds > 0) {
      await Task.collection.updateOne(
        { _id: new mongoose.Types.ObjectId(taskId) },
        { $inc: { timeSpent: -durationSeconds } }
      );
    }

    await TimeEntry.collection.deleteOne({ _id: new mongoose.Types.ObjectId(id) });

    return NextResponse.json({ success: true, data: { deleted: true } }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
