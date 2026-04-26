import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import mongoose from 'mongoose';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongoose';
import Project from '@/models/Project';
import Task from '@/models/Task';
import { hasWorkspaceAccess } from '@/lib/tenancy';

function normalizeStatus(status?: string) {
  const value = String(status || 'TODO').toUpperCase().replace(/\s+/g, '_');
  if (value === 'COMPLETED') return 'DONE';
  if (value === 'INPROGRESS') return 'IN_PROGRESS';
  return value;
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    await dbConnect();
    const { id } = await params;

    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ success: false, error: 'Invalid project id' }, { status: 400 });
    }

    const sourceProject = await Project.collection.findOne(
      { _id: new mongoose.Types.ObjectId(id) },
      { projection: { workspaceId: 1, workspace_id: 1, name: 1, description: 1, deadline: 1, end_date: 1, taskTemplate: 1, template: 1 } }
    );

    if (!sourceProject) {
      return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });
    }

    const workspaceId = sourceProject.workspaceId || sourceProject.workspace_id;
    const userId = (session.user as { id: string }).id;
    const allowed = await hasWorkspaceAccess(userId, String(workspaceId));
    if (!allowed) {
      return NextResponse.json({ success: false, error: 'Forbidden project access' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const projectName = String(body?.name || `Copy of ${sourceProject.name || 'Project'}`);

    const duplicatedProject = await Project.create({
      name: projectName,
      description: sourceProject.description || '',
      deadline: sourceProject.deadline || sourceProject.end_date,
      taskTemplate: sourceProject.taskTemplate || sourceProject.template || 'NO_TEMPLATE',
      workspaceId: mongoose.isValidObjectId(String(workspaceId)) ? new mongoose.Types.ObjectId(String(workspaceId)) : workspaceId,
      ownerId: new mongoose.Types.ObjectId(userId),
    });

    const sourceTasks = await Task.collection
      .find({
        $or: [
          { projectId: new mongoose.Types.ObjectId(id) },
          { projectId: id },
          { project_id: id },
        ],
      })
      .toArray();

    const copiedTasks = sourceTasks.map((task) => ({
      title: task.title,
      description: task.description || '',
      status: normalizeStatus(task.status),
      priority: String(task.priority || 'MEDIUM').toUpperCase(),
      assigneeId: mongoose.isValidObjectId(String(task.assigneeId)) ? task.assigneeId : undefined,
      assigneeIds: Array.isArray(task.assigneeIds)
        ? task.assigneeIds.filter((assigneeId) => mongoose.isValidObjectId(String(assigneeId)))
        : mongoose.isValidObjectId(String(task.assigneeId))
        ? [task.assigneeId]
        : [],
      projectId: duplicatedProject._id,
      dueDate: task.dueDate || task.due_date,
      startDate: task.startDate || task.start_date,
      endDate: task.endDate || task.end_date,
      timeSpent: 0,
      subtasks: Array.isArray(task.subtasks)
        ? task.subtasks.map((subtask: { title?: string; isCompleted?: boolean; dueDate?: string | Date }) => ({
            title: subtask.title || 'Subtask',
            isCompleted: Boolean(subtask.isCompleted),
            dueDate: subtask.dueDate,
          }))
        : [],
      attachments: Array.isArray(task.attachments) ? task.attachments : [],
    }));

    if (copiedTasks.length) {
      await Task.create(copiedTasks);
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          project: duplicatedProject,
          copiedTaskCount: copiedTasks.length,
        },
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}