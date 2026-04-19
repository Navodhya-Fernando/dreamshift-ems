import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongoose';
import Workspace from '@/models/Workspace';
import Project from '@/models/Project';
import Task from '@/models/Task';
import { getAccessibleWorkspaceIds } from '@/lib/tenancy';

function buildTaskFilter(projectIds: Array<string | { toString(): string }>) {
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

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    await dbConnect();
    const userId = (session.user as { id: string }).id;
    const accessibleWorkspaceIds = await getAccessibleWorkspaceIds(userId);

    const workspaces = await Workspace.find({ _id: { $in: accessibleWorkspaceIds } }).sort({ updatedAt: -1 }).lean();

    const sidebarStructure = await Promise.all(
      workspaces.map(async (ws) => {
        const wsId = String(ws._id);
        const allProjects = await Project.collection
          .find({
            $or: [
              { workspaceId: ws._id },
              { workspaceId: wsId },
              { workspace_id: ws._id },
              { workspace_id: wsId },
            ],
          })
          .sort({ updatedAt: -1, created_at: -1 })
          .toArray();

        const latestFive = allProjects.slice(0, 5);

        const projects = await Promise.all(
          latestFive.map(async (p) => {
            const tasks = (await Task.collection.find(buildTaskFilter([p._id, String(p._id)]), { projection: { status: 1 } }).toArray()) as Array<{ status?: string }>;
            const done = tasks.filter((t: { status?: string }) => t.status === 'DONE').length;
            const completionPercent = tasks.length ? Math.round((done / tasks.length) * 100) : 0;

            // Lightweight AI-like risk indicator from velocity + deadline proximity.
            const deadlineMs = p.deadline ? new Date(p.deadline).getTime() : 0;
            const daysLeft = deadlineMs ? Math.ceil((deadlineMs - Date.now()) / 86400000) : null;
            const risk =
              daysLeft !== null && daysLeft <= 5 && completionPercent < 70
                ? 'HIGH'
                : daysLeft !== null && daysLeft <= 10 && completionPercent < 70
                ? 'MEDIUM'
                : 'LOW';

            return {
              id: p._id,
              name: p.name,
              description: p.description,
              deadline: p.deadline || p.end_date,
              completionPercent,
              risk,
            };
          })
        );

        return {
          id: ws._id,
          name: ws.name,
          projects,
          projectsCount: allProjects.length,
          viewMorePath: `/projects/workspace/${ws._id}`,
        };
      })
    );

    return NextResponse.json({ 
      success: true, 
      data: sidebarStructure
    }, { status: 200 });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
