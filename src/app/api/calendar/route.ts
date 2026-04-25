import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import mongoose from 'mongoose';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongoose';
import Task from '@/models/Task';
import Project from '@/models/Project';
import User from '@/models/User';
import { getAccessibleWorkspaceIds } from '@/lib/tenancy';

function getAnchorDate(task: Record<string, unknown>) {
  const raw = task.dueDate || task.due_date || task.createdAt || task.created_at || task.updatedAt || task.updated_at;
  const date = raw ? new Date(String(raw)) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function buildProjectFilter(workspaceIds: string[], workspaceObjectIds: mongoose.Types.ObjectId[]) {
  return {
    $or: [
      { workspaceId: { $in: workspaceObjectIds } },
      { workspaceId: { $in: workspaceIds } },
      { workspace_id: { $in: workspaceObjectIds } },
      { workspace_id: { $in: workspaceIds } },
    ],
  };
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    const userId = (session.user as { id: string }).id;
    const userEmail = String((session.user as { email?: string }).email || '');
    const accessibleWorkspaceIds = await getAccessibleWorkspaceIds(userId);
    const accessibleWorkspaceObjectIds = accessibleWorkspaceIds
      .filter((id) => mongoose.isValidObjectId(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    const users = await User.find({}, { _id: 1, name: 1, email: 1 }).lean();
    const currentUser = users.find((user) => String(user._id) === String(userId));

    const accessibleProjects = await Project.collection
      .find(buildProjectFilter(accessibleWorkspaceIds, accessibleWorkspaceObjectIds), { projection: { _id: 1, name: 1 } })
      .toArray();
    const accessibleProjectIds = accessibleProjects.map((project) => project._id);
    const accessibleProjectIdStrings = accessibleProjectIds.map(String);

    const assigneeMatchers: Array<Record<string, unknown>> = [
      { assigneeId: userId },
      { assigneeId: mongoose.isValidObjectId(userId) ? new mongoose.Types.ObjectId(userId) : userId },
    ];
    if (userEmail) {
      assigneeMatchers.push({ assignee: userEmail });
      assigneeMatchers.push({ assignee: userEmail.toLowerCase() });
    }
    if (currentUser?.name) {
      assigneeMatchers.push({ assignee: currentUser.name });
    }

    const tasks = await Task.collection
      .find({
        $and: [
          {
            $or: [
              { projectId: { $in: accessibleProjectIds } },
              { projectId: { $in: accessibleProjectIdStrings } },
              { project_id: { $in: accessibleProjectIds } },
              { project_id: { $in: accessibleProjectIdStrings } },
            ],
          },
          { $or: assigneeMatchers },
        ],
      })
      .sort({ dueDate: 1, due_date: 1 })
      .toArray();

    const userById = new Map(users.map((user) => [String(user._id), { name: String(user.name || 'Unassigned'), email: String(user.email || '') }]));
    const userByEmail = new Map(users.map((user) => [String(user.email || '').toLowerCase(), { name: String(user.name || 'Unassigned'), email: String(user.email || '') }]));

    const projectNameById = new Map(accessibleProjects.map((project) => [String(project._id), String(project.name || 'General')]));

    const events = tasks.map((task) => ({
      id: String(task._id),
      title: task.title,
      date: getAnchorDate(task).toISOString().slice(0, 10),
      dueDate: task.dueDate || task.due_date,
      status: String(task.status || 'TODO').toLowerCase(),
      priority: String(task.priority || 'MEDIUM').toLowerCase(),
      projectName: projectNameById.get(String(task.projectId || task.project_id)) || 'General',
      assigneeName: (task.assigneeId ? userById.get(String(task.assigneeId))?.name : undefined)
        || (task.assignee ? userByEmail.get(String(task.assignee).toLowerCase())?.name : undefined)
        || String(task.assignee || 'Unassigned'),
    }));

    const summary = {
      total: events.length,
      overdue: events.filter((event) => new Date(event.dueDate as Date).getTime() < Date.now() && event.status !== 'done').length,
      dueThisWeek: events.filter((event) => {
        const now = Date.now();
        const d = new Date(event.dueDate as Date).getTime();
        return d >= now && d <= now + 7 * 86400000;
      }).length,
    };

    return NextResponse.json({ success: true, data: { events, summary } }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
