import dbConnect from '@/lib/mongoose';
import { normalizePlatformRole } from '@/lib/roles';
import User from '@/models/User';
import WorkspaceMember from '@/models/WorkspaceMember';

export async function isPlatformAdmin(userId: string) {
  await dbConnect();
  const user = await User.findById(userId, { role: 1 }).lean();
  return ['ADMIN', 'Admin', 'OWNER'].includes(normalizePlatformRole(user?.role));
}

export async function isWorkspaceAdminAnywhere(userId: string) {
  await dbConnect();
  const membership = await WorkspaceMember.findOne({
    userId,
    role: { $in: ['OWNER', 'ADMIN', 'WORKSPACE_ADMIN'] },
  }).lean();
  return Boolean(membership);
}

export async function hasAdminAccess(userId: string) {
  const [platformAdmin, workspaceAdmin] = await Promise.all([
    isPlatformAdmin(userId),
    isWorkspaceAdminAnywhere(userId),
  ]);

  return platformAdmin || workspaceAdmin;
}