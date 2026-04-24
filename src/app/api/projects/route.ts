import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import mongoose from 'mongoose';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongoose';
import Project from '@/models/Project';
import Workspace from '@/models/Workspace';
import { getAccessibleWorkspaceIds } from '@/lib/tenancy';
import { DEFAULT_PROJECT_TASK_STATUSES, normalizeProjectTaskStatuses } from '@/lib/taskStatuses';

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    await dbConnect();
    const userId = (session.user as { id: string }).id;
    const accessibleWorkspaceIds = await getAccessibleWorkspaceIds(userId);
    const accessibleWorkspaceObjectIds = accessibleWorkspaceIds
      .filter((id) => mongoose.isValidObjectId(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspaceId');

    if (workspaceId && !accessibleWorkspaceIds.includes(workspaceId)) {
      return NextResponse.json({ success: false, error: 'Forbidden workspace access' }, { status: 403 });
    }

    const filter = workspaceId
      ? {
          $or: [
            { workspaceId },
            { workspaceId: mongoose.isValidObjectId(workspaceId) ? new mongoose.Types.ObjectId(workspaceId) : workspaceId },
            { workspace_id: workspaceId },
            { workspace_id: mongoose.isValidObjectId(workspaceId) ? new mongoose.Types.ObjectId(workspaceId) : workspaceId },
          ],
        }
      : {
          $or: [
            { workspaceId: { $in: accessibleWorkspaceObjectIds } },
            { workspaceId: { $in: accessibleWorkspaceIds } },
            { workspace_id: { $in: accessibleWorkspaceObjectIds } },
            { workspace_id: { $in: accessibleWorkspaceIds } },
          ],
        };

    const projects = await Project.collection
      .find(filter)
      .sort({ updatedAt: -1, created_at: -1 })
      .toArray();

    const normalizedProjects = projects.map((project) => ({
      ...project,
      status: String(project.status || 'ACTIVE').toUpperCase() === 'CLOSED' ? 'CLOSED' : 'ACTIVE',
      startDate: project.startDate || project.start_date,
      endDate: project.endDate || project.end_date,
      taskStatuses: normalizeProjectTaskStatuses(project.taskStatuses || DEFAULT_PROJECT_TASK_STATUSES),
    }));

    return NextResponse.json({ success: true, count: normalizedProjects.length, data: normalizedProjects }, { status: 200 });
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
    const accessibleWorkspaceIds = await getAccessibleWorkspaceIds(userId);

    const { name, description, deadline, taskTemplate, workspaceId, status, startDate, endDate, taskStatuses } = await req.json();
    if (!name?.trim()) {
      return NextResponse.json({ success: false, error: 'Project name is required' }, { status: 400 });
    }

    if (!workspaceId) {
      return NextResponse.json({ success: false, error: 'Workspace is required' }, { status: 400 });
    }

    if (!accessibleWorkspaceIds.includes(String(workspaceId))) {
      return NextResponse.json({ success: false, error: 'Forbidden workspace access' }, { status: 403 });
    }

    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      return NextResponse.json({ success: false, error: 'Workspace not found' }, { status: 404 });
    }

    const normalizedStatus = String(status || 'ACTIVE').toUpperCase() === 'CLOSED' ? 'CLOSED' : 'ACTIVE';
    const normalizedTaskStatuses = normalizeProjectTaskStatuses(taskStatuses || DEFAULT_PROJECT_TASK_STATUSES);

    const project = await Project.create({
      name: name.trim(),
      description: description?.trim() || '',
      deadline: deadline || undefined,
      status: normalizedStatus,
      startDate: startDate || (normalizedStatus === 'ACTIVE' ? new Date() : undefined),
      endDate: endDate || (normalizedStatus === 'CLOSED' ? new Date() : undefined),
      taskStatuses: normalizedTaskStatuses,
      taskTemplate: taskTemplate || 'NO_TEMPLATE',
      workspaceId,
      ownerId: userId,
    });

    return NextResponse.json({ success: true, data: project }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
