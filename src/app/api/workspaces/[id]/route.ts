import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongoose';
import Workspace from '@/models/Workspace';
import Project from '@/models/Project';
import Task from '@/models/Task';
import WorkspaceMember from '@/models/WorkspaceMember';
import { hasWorkspaceAccess } from '@/lib/tenancy';

function buildProjectWorkspaceFilter(workspaceId: string, workspaceObjectId: string) {
  return {
    $or: [
      { workspaceId: workspaceObjectId },
      { workspaceId },
      { workspace_id: workspaceObjectId },
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

    const { id } = await params;
    await dbConnect();
    const userId = (session.user as { id: string }).id;

    const allowed = await hasWorkspaceAccess(userId, id);
    if (!allowed) {
      return NextResponse.json({ success: false, error: 'Forbidden workspace access' }, { status: 403 });
    }

    const workspace = await Workspace.findById(id).lean();
    if (!workspace) {
      return NextResponse.json({ success: false, error: 'Workspace not found' }, { status: 404 });
    }

    const workspaceObjectId = String(workspace._id);

    const [projectsRaw, membersRaw] = await Promise.all([
      Project.collection.find(buildProjectWorkspaceFilter(id, workspaceObjectId)).sort({ updatedAt: -1, created_at: -1 }).toArray(),
      WorkspaceMember.find({
        $or: [
          { workspaceId: workspace._id },
          { workspaceId: id },
          { workspace_id: workspace._id },
          { workspace_id: id },
        ],
      })
        .populate('userId', 'name email image')
        .lean(),
    ]);

    const projects = await Promise.all(
      projectsRaw.map(async (project) => {
        const tasks = (await Task.collection.find(buildTaskProjectFilter([project._id, String(project._id)]), { projection: { status: 1, assigneeId: 1, assignee: 1 } }).toArray()) as Array<{ status?: string }>;
        const done = tasks.filter((t: { status?: string }) => t.status === 'DONE').length;
        const completionPercent = tasks.length ? Math.round((done / tasks.length) * 100) : 0;

        return {
          id: project._id,
          name: project.name,
          description: project.description,
          deadline: project.deadline || project.end_date,
          taskTemplate: project.taskTemplate || project.template,
          completionPercent,
          taskCount: tasks.length,
        };
      })
    );

    const workspaceStats = {
      totalProjects: projects.length,
      totalTasks: projects.reduce((sum, p) => sum + p.taskCount, 0),
      avgCompletion: projects.length
        ? Math.round(projects.reduce((sum, p) => sum + p.completionPercent, 0) / projects.length)
        : 0,
      members: membersRaw.length,
    };

    return NextResponse.json(
      {
        success: true,
        data: {
          id: workspace._id,
          name: workspace.name,
          ownerId: workspace.ownerId || workspace.created_by,
          projects,
          members: membersRaw.map((m) => ({
            id: m._id,
            role: m.role,
            user: m.userId,
          })),
          stats: workspaceStats,
        },
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
