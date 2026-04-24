import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import mongoose from 'mongoose';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongoose';
import Task from '@/models/Task';
import Project from '@/models/Project';
import User from '@/models/User';
import { hasWorkspaceAccess } from '@/lib/tenancy';
import { notifyUser } from '@/lib/notifications';
import { DEFAULT_PROJECT_TASK_STATUSES, normalizeProjectTaskStatuses, normalizeTaskStatusForProject } from '@/lib/taskStatuses';

function normalizeStatus(status?: string) {
  const upper = String(status || 'TODO').toUpperCase().replace(/\s+/g, '_');
  if (upper === 'COMPLETED') return 'DONE';
  if (upper === 'TO_DO') return 'TODO';
  if (upper === 'INPROGRESS') return 'IN_PROGRESS';
  return upper;
}

function toLegacyStatus(status?: string) {
  const normalized = normalizeStatus(status);
  if (normalized === 'DONE') return 'Completed';
  if (normalized === 'IN_PROGRESS') return 'In Progress';
  if (normalized === 'TODO') return 'To Do';
  if (normalized === 'IN_REVIEW') return 'In Review';
  return 'Blocked';
}

function toLegacyPriority(priority?: string) {
  const upper = String(priority || 'MEDIUM').toUpperCase();
  if (upper === 'LOW') return 'Low';
  if (upper === 'HIGH') return 'High';
  if (upper === 'URGENT') return 'Urgent';
  return 'Medium';
}

function normalizeTask(task: Record<string, unknown>, assignee?: { _id: string; name?: string; email?: string } | null) {
  const rawSubtasks = Array.isArray(task.subtasks) ? task.subtasks : [];
  const subtasks = rawSubtasks.map((subtask, index) => {
    const item = subtask as { title?: string; isCompleted?: boolean; completed?: boolean; dueDate?: string; due_date?: string };
    return {
      id: String(index),
      title: item.title || `Subtask ${index + 1}`,
      isCompleted: Boolean(item.isCompleted || item.completed),
      dueDate: item.dueDate || item.due_date,
    };
  });

  return {
    ...task,
    projectId: task.projectId || task.project_id,
    dueDate: task.dueDate || task.due_date,
    startDate: task.startDate || task.start_date,
    endDate: task.endDate || task.end_date,
    status: normalizeStatus(String(task.status || 'TODO')).toLowerCase(),
    priority: String(task.priority || 'MEDIUM').toLowerCase(),
    assigneeId: assignee || undefined,
    subtasks,
  };
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    await dbConnect();

    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ success: false, error: 'Invalid task id' }, { status: 400 });
    }

    const taskObjectId = new mongoose.Types.ObjectId(id);

    const task = await Task.collection.findOne({ _id: taskObjectId });
    if (!task) return NextResponse.json({ success: false, error: 'Task not found' }, { status: 404 });

    const resolvedProjectId = String(task.projectId || task.project_id || '');
    if (!resolvedProjectId) return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });

    const projectFilter: Record<string, unknown> = {
      _id: mongoose.isValidObjectId(resolvedProjectId) ? new mongoose.Types.ObjectId(resolvedProjectId) : resolvedProjectId,
    };
    const project = await Project.collection.findOne(projectFilter, { projection: { workspaceId: 1, workspace_id: 1, taskStatuses: 1 } });
    if (!project) return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });

    const workspaceId = project.workspaceId || project.workspace_id;

    const userId = (session.user as { id: string }).id;
    const allowed = await hasWorkspaceAccess(userId, String(workspaceId));
    if (!allowed) return NextResponse.json({ success: false, error: 'Forbidden task access' }, { status: 403 });

    let assignee: { _id: string; name?: string; email?: string } | null = null;
    if (task.assigneeId) {
      const user = await User.findById(task.assigneeId, { _id: 1, name: 1, email: 1 }).lean();
      assignee = user ? { _id: String(user._id), name: user.name, email: user.email } : null;
    } else if (task.assignee) {
      const user = await User.findOne({ email: String(task.assignee).toLowerCase() }, { _id: 1, name: 1, email: 1 }).lean();
      assignee = user ? { _id: String(user._id), name: user.name, email: user.email } : null;
    }
    
    return NextResponse.json({ success: true, data: normalizeTask(task, assignee) }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    await dbConnect();
    const body = await req.json();

    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ success: false, error: 'Invalid task id' }, { status: 400 });
    }

    const taskObjectId = new mongoose.Types.ObjectId(id);

    const currentTask = await Task.collection.findOne({ _id: taskObjectId });
    if (!currentTask) return NextResponse.json({ success: false, error: 'Task not found' }, { status: 404 });

    const resolvedProjectId = String(currentTask.projectId || currentTask.project_id || '');
    if (!resolvedProjectId) return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });

    const projectFilter: Record<string, unknown> = {
      _id: mongoose.isValidObjectId(resolvedProjectId) ? new mongoose.Types.ObjectId(resolvedProjectId) : resolvedProjectId,
    };
    const project = await Project.collection.findOne(projectFilter, { projection: { workspaceId: 1, workspace_id: 1 } });
    if (!project) return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });

    const workspaceId = project.workspaceId || project.workspace_id;

    const userId = (session.user as { id: string }).id;
    const allowed = await hasWorkspaceAccess(userId, String(workspaceId));
    if (!allowed) return NextResponse.json({ success: false, error: 'Forbidden task access' }, { status: 403 });

    const projectTaskStatuses = normalizeProjectTaskStatuses(project.taskStatuses || DEFAULT_PROJECT_TASK_STATUSES);
    const nextStatus = normalizeTaskStatusForProject(normalizeStatus(body.status || String(currentTask.status || 'TODO')), projectTaskStatuses);
    const previousAssigneeId = String(currentTask.assigneeId || '');
    const nextAssigneeId = String(body.assigneeId ?? currentTask.assigneeId ?? '');
    const currentProjectId = currentTask.projectId || currentTask.project_id;
    const updatePayload: Record<string, unknown> = {
      title: body.title ?? currentTask.title,
      description: body.description ?? currentTask.description ?? '',
      dueDate: body.dueDate ?? currentTask.dueDate ?? currentTask.due_date,
      startDate: body.startDate ?? currentTask.startDate ?? currentTask.start_date,
      endDate: body.endDate ?? currentTask.endDate ?? currentTask.end_date,
      assigneeId: body.assigneeId ?? currentTask.assigneeId,
      projectId: body.projectId ?? currentProjectId,
      status: nextStatus,
      priority: body.priority ? String(body.priority).toUpperCase() : String(currentTask.priority || 'MEDIUM').toUpperCase(),
      subtasks: body.subtasks ?? currentTask.subtasks ?? [],
      timeSpent: body.timeSpent ?? currentTask.timeSpent ?? 0,
    };

    // Auto-fill lifecycle dates while still allowing manual edits from the client.
    const previousStatus = normalizeTaskStatusForProject(normalizeStatus(String(currentTask.status || 'TODO')), projectTaskStatuses);
    if (previousStatus !== 'IN_PROGRESS' && nextStatus === 'IN_PROGRESS' && !body.startDate && !currentTask.startDate && !currentTask.start_date) {
      updatePayload.startDate = new Date();
    }

    if (nextStatus === 'DONE' && !body.endDate && !currentTask.endDate && !currentTask.end_date) {
      updatePayload.endDate = new Date();
    }

    // If task is reopened, keep history but allow client to clear dates explicitly.
    if (nextStatus !== 'DONE' && body.endDate === null) {
      updatePayload.endDate = null;
    }

    if (currentTask.project_id || currentTask.assignee || currentTask.created_at) {
      const legacyPayload: Record<string, unknown> = {
        title: updatePayload.title,
        description: updatePayload.description,
        due_date: updatePayload.dueDate,
        start_date: updatePayload.startDate,
        end_date: updatePayload.endDate,
        status: toLegacyStatus(String(updatePayload.status || currentTask.status)),
        priority: toLegacyPriority(String(updatePayload.priority || currentTask.priority)),
      };

      if (body.projectId) legacyPayload.project_id = body.projectId;

      if (body.assigneeId) {
        const targetUser = await User.findById(body.assigneeId, { email: 1 }).lean();
        if (targetUser?.email) legacyPayload.assignee = targetUser.email;
      }

      await Task.collection.updateOne({ _id: taskObjectId }, { $set: legacyPayload });
    }

    await Task.collection.updateOne({ _id: taskObjectId }, { $set: updatePayload });

    const updated = await Task.collection.findOne({ _id: taskObjectId });
    const task = updated || currentTask;

    if (nextAssigneeId && nextAssigneeId !== previousAssigneeId) {
      try {
        await notifyUser({
          userId: nextAssigneeId,
          type: 'assignment',
          title: 'Task assignment updated',
          message: `You were assigned to "${String(updatePayload.title || currentTask.title || 'Untitled task')}".`,
          link: `/tasks/${id}`,
          metadata: {
            taskId: id,
            actorId: userId,
            event: 'task.reassigned',
          },
          emailSubject: `Task assignment: ${String(updatePayload.title || currentTask.title || 'Untitled task')}`,
        });
      } catch (notifyError) {
        console.warn('Failed to send assignment notification on task update:', notifyError);
      }
    }
    
    return NextResponse.json({ success: true, data: normalizeTask(task, null) }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    await dbConnect();

    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ success: false, error: 'Invalid task id' }, { status: 400 });
    }

    const taskObjectId = new mongoose.Types.ObjectId(id);

    const currentTask = await Task.collection.findOne(
      { _id: taskObjectId },
      { projection: { projectId: 1, project_id: 1 } }
    );
    if (!currentTask) return NextResponse.json({ success: false, error: 'Task not found' }, { status: 404 });

    const resolvedProjectId = String(currentTask.projectId || currentTask.project_id || '');
    if (!resolvedProjectId) return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });

    const projectFilter: Record<string, unknown> = {
      _id: mongoose.isValidObjectId(resolvedProjectId) ? new mongoose.Types.ObjectId(resolvedProjectId) : resolvedProjectId,
    };
    const project = await Project.collection.findOne(projectFilter, { projection: { workspaceId: 1, workspace_id: 1 } });
    if (!project) return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });

    const workspaceId = project.workspaceId || project.workspace_id;

    const userId = (session.user as { id: string }).id;
    const allowed = await hasWorkspaceAccess(userId, String(workspaceId));
    if (!allowed) return NextResponse.json({ success: false, error: 'Forbidden task access' }, { status: 403 });

    await Task.collection.deleteOne({ _id: taskObjectId });
    
    return NextResponse.json({ success: true, data: {} }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
