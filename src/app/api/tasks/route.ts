import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import mongoose from 'mongoose';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongoose';
import Task from '@/models/Task';
import Project from '@/models/Project';
import User from '@/models/User';
import { getAccessibleWorkspaceIds } from '@/lib/tenancy';
import { notifyUser } from '@/lib/notifications';
import { DEFAULT_PROJECT_TASK_STATUSES, normalizeProjectTaskStatuses, normalizeTaskStatusForProject } from '@/lib/taskStatuses';

function normalizeStatus(status?: string) {
  const upper = String(status || 'TODO').toUpperCase().replace(/\s+/g, '_');
  if (upper === 'COMPLETED') return 'done';
  if (upper === 'TO_DO') return 'todo';
  if (upper === 'INPROGRESS') return 'in_progress';
  return upper.toLowerCase();
}

function normalizePriority(priority?: string) {
  return String(priority || 'MEDIUM').toLowerCase();
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    await dbConnect();
    const userId = (session.user as { id: string }).id;
    const userEmail = String((session.user as { email?: string }).email || '').toLowerCase();
    const accessibleWorkspaceIds = await getAccessibleWorkspaceIds(userId);
    const accessibleWorkspaceObjectIds = accessibleWorkspaceIds
      .filter((id) => mongoose.isValidObjectId(id))
      .map((id) => new mongoose.Types.ObjectId(id));
    const accessibleProjects = await Project.collection
      .find(
        {
          $or: [
            { workspaceId: { $in: accessibleWorkspaceObjectIds } },
            { workspaceId: { $in: accessibleWorkspaceIds } },
            { workspace_id: { $in: accessibleWorkspaceObjectIds } },
            { workspace_id: { $in: accessibleWorkspaceIds } },
          ],
        },
        { projection: { _id: 1, name: 1 } }
      )
      .toArray();

    const accessibleProjectIds = accessibleProjects.map((project) => String(project._id));
    const accessibleProjectObjectIds = accessibleProjectIds
      .filter((id) => mongoose.isValidObjectId(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    const projectNameById = new Map(accessibleProjects.map((project) => [String(project._id), String(project.name || 'Project')]));

    const users = await User.find({}, { _id: 1, name: 1, email: 1 }).lean();
    const currentUser = users.find((user) => String(user._id) === String(userId));
    const userById = new Map(users.map((user) => [String(user._id), { _id: String(user._id), name: user.name, email: user.email }]));
    const userByEmail = new Map(users.map((user) => [String(user.email || '').toLowerCase(), { _id: String(user._id), name: user.name, email: user.email }]));

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    const scope = searchParams.get('scope'); // assigned | all
    const assigneeId = searchParams.get('assigneeId');
    const status = searchParams.get('status');

    const filter: Record<string, unknown> = { $and: [] };

    const requestedAssignee = assigneeId || userId;
    const isAssignedScope = scope === 'assigned' || Boolean(assigneeId);
    const isSelfAssignee = String(requestedAssignee) === String(userId);

    if (!(isAssignedScope && isSelfAssignee)) {
      (filter.$and as Record<string, unknown>[]).push({
        $or: [
          { projectId: { $in: accessibleProjectObjectIds } },
          { projectId: { $in: accessibleProjectIds } },
          { project_id: { $in: accessibleProjectIds } },
        ],
      });
    }

    if (projectId) {
      const allowed = accessibleProjectIds.some((id) => String(id) === String(projectId));
      if (!allowed) {
        return NextResponse.json({ success: false, error: 'Forbidden project access' }, { status: 403 });
      }

      (filter.$and as Record<string, unknown>[]).push({
        $or: [
          { projectId },
          { projectId: mongoose.isValidObjectId(projectId) ? new mongoose.Types.ObjectId(projectId) : projectId },
          { project_id: projectId },
        ],
      });
    }

    if (status) {
      const normalized = status.toUpperCase();
      const legacy = normalized === 'DONE' ? 'Completed' : normalized === 'IN_PROGRESS' ? 'In Progress' : normalized;
      (filter.$and as Record<string, unknown>[]).push({ status: { $in: [normalized, legacy] } });
    }

    if (scope === 'assigned' || assigneeId) {
      const requested = requestedAssignee;
      const requestedUser = users.find((user) => String(user._id) === String(requested));
      const requestedEmail = String(requestedUser?.email || userEmail || '');
      const requestedName = String(requestedUser?.name || currentUser?.name || '');
      (filter.$and as Record<string, unknown>[]).push({
        $or: [
          { assigneeId: requested },
          { assigneeId: mongoose.isValidObjectId(String(requested)) ? new mongoose.Types.ObjectId(String(requested)) : requested },
          { assignee: requestedEmail },
          { assignee: requestedEmail.toLowerCase() },
          { assignee: requestedName },
        ],
      });
    }

    if ((filter.$and as Record<string, unknown>[]).length === 0) {
      (filter.$and as Record<string, unknown>[]).push({ _id: { $exists: true } });
    }

    const tasks = await Task.collection
      .find(filter)
      .sort({ createdAt: -1, created_at: -1 })
      .toArray();

    const data = tasks.map((task) => {
      const normalizedProjectId = task.projectId ? String(task.projectId) : String(task.project_id || '');
      const legacyAssigneeEmail = String(task.assignee || '').toLowerCase();
      const assigneeFromId = task.assigneeId ? userById.get(String(task.assigneeId)) : undefined;
      const assigneeFromEmail = legacyAssigneeEmail ? userByEmail.get(legacyAssigneeEmail) : undefined;
      const assignee = assigneeFromId || assigneeFromEmail;

      const subtasks = Array.isArray(task.subtasks) ? task.subtasks : [];

      return {
        ...task,
        projectId: normalizedProjectId
          ? {
              _id: normalizedProjectId,
              name: projectNameById.get(normalizedProjectId) || 'Project',
            }
          : undefined,
        assigneeId: assignee,
        dueDate: task.dueDate || task.due_date,
        startDate: task.startDate || task.start_date,
        endDate: task.endDate || task.end_date,
        status: normalizeStatus(task.status),
        priority: normalizePriority(task.priority),
        subtaskTotalCount: subtasks.length,
        subtaskCompletedCount: subtasks.filter((s: { isCompleted?: boolean; completed?: boolean }) => Boolean(s.isCompleted || s.completed)).length,
      };
    });

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
    const accessibleWorkspaceIds = await getAccessibleWorkspaceIds(userId);
    const body = await req.json();
    const project = await Project.collection.findOne(
      { _id: mongoose.isValidObjectId(String(body.projectId)) ? new mongoose.Types.ObjectId(String(body.projectId)) : body.projectId },
      { projection: { workspaceId: 1, workspace_id: 1 } }
    );
    if (!project) {
      return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });
    }

    const workspaceId = project.workspaceId || project.workspace_id;
    if (!accessibleWorkspaceIds.includes(String(workspaceId))) {
      return NextResponse.json({ success: false, error: 'Forbidden project access' }, { status: 403 });
    }

    const projectTaskStatuses = normalizeProjectTaskStatuses(project.taskStatuses || DEFAULT_PROJECT_TASK_STATUSES);
    const normalizedStatus = normalizeTaskStatusForProject(body.status || 'TODO', projectTaskStatuses);
    const normalizedPriority = (body.priority || 'MEDIUM').toUpperCase();
    const nextStartDate = body.startDate || (normalizedStatus === 'IN_PROGRESS' ? new Date() : undefined);
    const nextEndDate = body.endDate || (normalizedStatus === 'DONE' ? new Date() : undefined);
    
    const task = await Task.create({
      ...body,
      status: normalizedStatus,
      priority: normalizedPriority,
      startDate: nextStartDate,
      endDate: nextEndDate,
      assigneeId: body.assigneeId || userId,
    });

    const assigneeId = String(task.assigneeId || body.assigneeId || '');
    if (assigneeId && assigneeId !== userId) {
      void notifyUser({
        userId: assigneeId,
        type: 'assignment',
        title: 'New task assigned',
        message: `You were assigned to "${String(task.title || 'Untitled task')}".`,
        link: `/tasks/${String(task._id)}`,
        metadata: {
          taskId: String(task._id),
          actorId: userId,
          event: 'task.assigned',
        },
        emailSubject: `New task assigned: ${String(task.title || 'Untitled task')}`,
      });
    }

    return NextResponse.json({ success: true, data: task }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
