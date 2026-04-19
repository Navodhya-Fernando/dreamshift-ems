import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import mongoose from 'mongoose';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongoose';
import Project from '@/models/Project';
import Task from '@/models/Task';
import User from '@/models/User';
import Comment from '@/models/Comment';
import { hasWorkspaceAccess } from '@/lib/tenancy';

function normalizeStatus(status?: string) {
  const value = String(status || 'TODO').toUpperCase().replace(/\s+/g, '_');
  if (value === 'COMPLETED') return 'DONE';
  if (value === 'INPROGRESS') return 'IN_PROGRESS';
  return value;
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    await dbConnect();
    const { id } = await params;

    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ success: false, error: 'Invalid project id' }, { status: 400 });
    }

    const projectObjectId = new mongoose.Types.ObjectId(id);

    const projectDoc = await Project.collection.findOne({ _id: projectObjectId });
    if (!projectDoc) return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });

    const project = {
      ...projectDoc,
      workspaceId: projectDoc.workspaceId || projectDoc.workspace_id,
    };

    const userId = (session.user as { id: string }).id;
    const allowed = await hasWorkspaceAccess(userId, String(project.workspaceId));
    if (!allowed) {
      return NextResponse.json({ success: false, error: 'Forbidden project access' }, { status: 403 });
    }

    const tasksRaw = await Task.collection
      .find({
        $or: [
          { projectId: projectObjectId },
          { projectId: id },
          { project_id: id },
        ],
      })
      .sort({ createdAt: -1, created_at: -1 })
      .toArray();

    const users = await User.find({}, { _id: 1, name: 1, email: 1 }).lean();
    const userById = new Map(users.map((user) => [String(user._id), { _id: String(user._id), name: user.name, email: user.email }]));
    const userByEmail = new Map(users.map((user) => [String(user.email || '').toLowerCase(), { _id: String(user._id), name: user.name, email: user.email }]));

    const tasks = tasksRaw.map((task) => ({
      ...task,
      description: task.description || '',
      dueDate: task.dueDate || task.due_date,
      status: normalizeStatus(task.status),
      priority: String(task.priority || 'MEDIUM').toUpperCase(),
      assigneeId: task.assigneeId
        ? userById.get(String(task.assigneeId))
        : task.assignee
        ? userByEmail.get(String(task.assignee).toLowerCase()) || { name: String(task.assignee), email: String(task.assignee) }
        : undefined,
      startDate: task.startDate || task.start_date,
      endDate: task.endDate || task.end_date,
    }));

    const taskStats = {
      total: tasks.length,
      todo: tasks.filter((t: { status?: string }) => t.status === 'TODO').length,
      inProgress: tasks.filter((t: { status?: string }) => t.status === 'IN_PROGRESS').length,
      done: tasks.filter((t: { status?: string }) => t.status === 'DONE').length,
      blocked: tasks.filter((t: { status?: string }) => t.status === 'BLOCKED').length,
    };

    return NextResponse.json({ success: true, data: { project, tasks, taskStats } }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    await dbConnect();
    const { id } = await params;
    const body = await req.json();

    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ success: false, error: 'Invalid project id' }, { status: 400 });
    }

    const projectObjectId = new mongoose.Types.ObjectId(id);

    const existingProject = await Project.collection.findOne({ _id: projectObjectId }, { projection: { workspaceId: 1, workspace_id: 1 } });
    if (!existingProject) return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });

    const workspaceId = existingProject.workspaceId || existingProject.workspace_id;

    const userId = (session.user as { id: string }).id;
    const allowed = await hasWorkspaceAccess(userId, String(workspaceId));
    if (!allowed) {
      return NextResponse.json({ success: false, error: 'Forbidden project access' }, { status: 403 });
    }

    const project = await Project.findByIdAndUpdate(
      id,
      {
        name: body.name,
        description: body.description,
        deadline: body.deadline,
        taskTemplate: body.taskTemplate,
      },
      { new: true, runValidators: true }
    );

    return NextResponse.json({ success: true, data: project }, { status: 200 });
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
    const { id } = await params;

    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ success: false, error: 'Invalid project id' }, { status: 400 });
    }

    const projectObjectId = new mongoose.Types.ObjectId(id);
    const existingProject = await Project.collection.findOne({ _id: projectObjectId }, { projection: { workspaceId: 1, workspace_id: 1 } });
    if (!existingProject) return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });

    const workspaceId = existingProject.workspaceId || existingProject.workspace_id;
    const userId = (session.user as { id: string }).id;
    const allowed = await hasWorkspaceAccess(userId, String(workspaceId));
    if (!allowed) {
      return NextResponse.json({ success: false, error: 'Forbidden project access' }, { status: 403 });
    }

    const taskIds = await Task.collection
      .find({
        $or: [
          { projectId: projectObjectId },
          { projectId: id },
          { project_id: id },
        ],
      }, { projection: { _id: 1 } })
      .toArray();

    await Comment.collection.deleteMany({
      $or: [
        { project_id: id },
        { entity_type: 'project', entity_id: id },
        { taskId: { $in: taskIds.map((task) => task._id) } },
        { task_id: { $in: taskIds.map((task) => String(task._id)) } },
      ],
    });

    await Task.collection.deleteMany({
      $or: [
        { projectId: projectObjectId },
        { projectId: id },
        { project_id: id },
      ],
    });

    await Project.collection.deleteOne({ _id: projectObjectId });

    return NextResponse.json({ success: true, data: { deleted: true } }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
