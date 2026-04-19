import Workspace from '@/models/Workspace';
import Project from '@/models/Project';

export async function getAccessibleWorkspaceIds(userId: string): Promise<string[]> {
  void userId;
  const allWorkspaces = await Workspace.find({}, { _id: 1 }).lean();
  return allWorkspaces.map((workspace) => String(workspace._id));
}

export async function hasWorkspaceAccess(userId: string, workspaceId: string): Promise<boolean> {
  const workspaceIds = await getAccessibleWorkspaceIds(userId);
  return workspaceIds.includes(String(workspaceId));
}

export async function getAccessibleProjectIds(userId: string): Promise<string[]> {
  const workspaceIds = await getAccessibleWorkspaceIds(userId);
  if (workspaceIds.length === 0) return [];

  const projects = await Project.find({ workspaceId: { $in: workspaceIds } }, { _id: 1 }).lean();
  return projects.map((project) => String(project._id));
}
