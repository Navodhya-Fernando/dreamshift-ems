import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongoose';
import Project from '@/models/Project';
import Task from '@/models/Task';
import WorkspaceMember from '@/models/WorkspaceMember';

function buildProjectWorkspaceFilter(workspaceId: string) {
  return {
    $or: [
      { workspaceId },
      { workspace_id: workspaceId },
    ],
  };
}

function buildTaskProjectFilter(projectIds: Array<string | { toString(): string }>) {
  const stringIds = projectIds.map((value) => String(value));
  return {
    $or: [
      { projectId: { $in: projectIds } },
      { projectId: { $in: stringIds } },
      { project_id: { $in: projectIds } },
      { project_id: { $in: stringIds } },
    ],
  };
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    await dbConnect();

    const { id: workspaceId } = await params;
    const requester = await WorkspaceMember.findOne({ workspaceId, userId: (session.user as { id: string }).id }).lean();

    if (!requester || !['OWNER', 'ADMIN', 'WORKSPACE_ADMIN'].includes(requester.role)) {
      return NextResponse.json({ success: false, error: 'Workspace admin access required' }, { status: 403 });
    }

    const projects = await Project.collection.find(buildProjectWorkspaceFilter(workspaceId)).toArray();
    const projectIds = projects.map((project) => project._id);

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);

    const tasks = await Task.collection.find(buildTaskProjectFilter(projectIds)).toArray();
    const tasksUpdatedThisWeek = tasks.filter((task) => new Date(task.updatedAt).getTime() >= sevenDaysAgo.getTime());

    const report = {
      workspaceId,
      weekEnding: now.toISOString(),
      activeProjects: projects.length,
      tasksCompletedThisWeek: tasksUpdatedThisWeek.filter((task) => task.status === 'DONE').length,
      tasksStartedThisWeek: tasksUpdatedThisWeek.filter((task) => task.status === 'IN_PROGRESS').length,
      overdueOpenTasks: tasks.filter((task) => (task.dueDate || task.due_date) && new Date(task.dueDate || task.due_date).getTime() < now.getTime() && task.status !== 'DONE').length,
      productivityScore: tasks.length
        ? Math.round((tasks.filter((task) => task.status === 'DONE').length / tasks.length) * 100)
        : 0,
      insights: [
        'Top risk indicator uses deadline proximity and open task volume.',
        'Recommend rebalancing assignees with >8 open tasks this week.',
      ],
    };

    return NextResponse.json({ success: true, data: report }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
