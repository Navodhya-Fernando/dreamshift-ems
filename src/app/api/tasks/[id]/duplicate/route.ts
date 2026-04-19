import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import mongoose from 'mongoose';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongoose';
import Task from '@/models/Task';
import Project from '@/models/Project';
import { hasWorkspaceAccess } from '@/lib/tenancy';

function normalizeStatus(status?: string) {
  const upper = String(status || 'TODO').toUpperCase().replace(/\s+/g, '_');
  if (upper === 'COMPLETED') return 'DONE';
  if (upper === 'TO_DO') return 'TODO';
  if (upper === 'INPROGRESS') return 'IN_PROGRESS';
  return upper;
}

function normalizePriority(priority?: string) {
  const upper = String(priority || 'MEDIUM').toUpperCase();
  if (['LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(upper)) return upper;
  return 'MEDIUM';
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    await dbConnect();
    const { id } = await params;

    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ success: false, error: 'Invalid task id' }, { status: 400 });
    }

    const sourceTask = await Task.collection.findOne({ _id: new mongoose.Types.ObjectId(id) });
    if (!sourceTask) return NextResponse.json({ success: false, error: 'Task not found' }, { status: 404 });

    const projectId = String(sourceTask.projectId || sourceTask.project_id || '');
    if (!projectId) return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });

    let project = null;
    if (mongoose.isValidObjectId(projectId)) {
      project = await Project.collection.findOne(
        { _id: new mongoose.Types.ObjectId(projectId) },
        { projection: { workspaceId: 1, workspace_id: 1 } }
      );
    }
    if (!project) {
      project = await Project.collection.findOne(
        { project_id: projectId },
        { projection: { workspaceId: 1, workspace_id: 1 } }
      );
    }
    if (!project) return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });

    const userId = (session.user as { id: string }).id;
    const workspaceId = String(project.workspaceId || project.workspace_id || '');
    const allowed = await hasWorkspaceAccess(userId, workspaceId);
    if (!allowed) return NextResponse.json({ success: false, error: 'Forbidden task access' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const duplicatedTitle = String(body?.title || `${String(sourceTask.title || 'Task')} (Copy)`);

    const sourceSubtasks = Array.isArray(sourceTask.subtasks) ? sourceTask.subtasks : [];
    const duplicatedSubtasks = sourceSubtasks.map((subtask: { title?: string; isCompleted?: boolean; completed?: boolean; dueDate?: string | Date; due_date?: string | Date }) => ({
      title: subtask.title || 'Subtask',
      isCompleted: false,
      dueDate: subtask.dueDate || subtask.due_date,
    }));

    const duplicated = await Task.create({
      title: duplicatedTitle,
      description: sourceTask.description || '',
      status: 'TODO',
      priority: normalizePriority(sourceTask.priority),
      projectId: mongoose.isValidObjectId(projectId) ? new mongoose.Types.ObjectId(projectId) : projectId,
      assigneeId: sourceTask.assigneeId,
      dueDate: sourceTask.dueDate || sourceTask.due_date,
      startDate: undefined,
      endDate: undefined,
      timeSpent: 0,
      subtasks: duplicatedSubtasks,
      attachments: Array.isArray(sourceTask.attachments) ? sourceTask.attachments : [],
    });

    if (sourceTask.project_id || sourceTask.assignee || sourceTask.created_at) {
      await Task.collection.updateOne(
        { _id: duplicated._id },
        {
          $set: {
            project_id: sourceTask.project_id || projectId,
            assignee: sourceTask.assignee,
            due_date: sourceTask.due_date || sourceTask.dueDate,
            start_date: null,
            end_date: null,
            status: normalizeStatus('TODO'),
            created_at: new Date(),
          },
        }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        _id: String(duplicated._id),
      },
    }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
