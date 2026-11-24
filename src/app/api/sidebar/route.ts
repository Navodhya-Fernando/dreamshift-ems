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

    const workspaceKeys = workspaces.flatMap(ws => [ws._id, String(ws._id)]);
    const allProjects = workspaceKeys.length ? await Project.collection.find({
      $or: [{ workspaceId: { $in: workspaceKeys } }, { workspace_id: { $in: workspaceKeys } }],
    }, { projection: { name: 1, description: 1, deadline: 1, end_date: 1, status: 1, workspaceId: 1, workspace_id: 1 } }).sort({ updatedAt: -1, created_at: -1 }).toArray() : [];
    const grouped = new Map<string, typeof allProjects>();
    for (const p of allProjects) {
      const key = String(p.workspaceId || p.workspace_id || '');
      const group = grouped.get(key);
      if (group) group.push(p); else grouped.set(key, [p]);
    }
    const ids = Array.from(grouped.values()).flatMap(group => group.slice(0,5)).flatMap(p => [p._id, String(p._id)]);
    const totals = ids.length ? await Task.collection.aggregate<{ _id: string; total: number; done: number }>([
      { $match: buildTaskFilter(ids) },
      { $group: { _id: { $toString: { $ifNull: ['$projectId', '$project_id'] } }, total: { $sum: 1 }, done: { $sum: { $cond: [{ $in: [{ $toUpper: { $ifNull: ['$status', ''] } }, ['DONE','COMPLETED']] }, 1, 0] } } } },
    ]).toArray() : [];
    const byId = new Map(totals.map(item => [item._id, item]));
    const now = Date.now();
    const sidebarStructure = workspaces.map(ws => {
      const projects = grouped.get(String(ws._id)) || [];
      return { id: ws._id, name: ws.name, projectsCount: projects.length, viewMorePath: `/projects/workspace/${ws._id}`, projects: projects.slice(0,5).map(p => {
        const count = byId.get(String(p._id));
        const completionPercent = count?.total ? Math.round(count.done / count.total * 100) : 0;
        const deadline = p.deadline || p.end_date;
        const daysLeft = deadline ? Math.ceil((new Date(deadline).getTime() - now) / 86400000) : null;
        const risk = daysLeft !== null && completionPercent < 70 ? daysLeft <= 5 ? 'HIGH' : daysLeft <= 10 ? 'MEDIUM' : 'LOW' : 'LOW';
        return { id: p._id, name: p.name, description: p.description, deadline, status: p.status, completionPercent, risk };
      }) };
    });
    return NextResponse.json({ 
      success: true, 
      data: sidebarStructure
    }, { status: 200 });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
