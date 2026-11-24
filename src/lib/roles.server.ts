import mongoose from 'mongoose';
import dbConnect from '@/lib/mongoose';
import { normalizePlatformRole, roleAllows, type Permission, type RoleScope } from '@/lib/roles';
import User from '@/models/User';
import WorkspaceMember from '@/models/WorkspaceMember';
import Role from '@/models/Role';

export async function getActorRole(userId:string){
  if(!mongoose.isValidObjectId(userId))return null;
  await dbConnect();
  const user=await User.findById(userId,{role:1}).lean();
  return user?normalizePlatformRole(user.role):null;
}
// Built-in permissions provide a migration-safe default. Stored role records may narrow
// permissions, but cannot silently expand a privileged role beyond its reviewed policy.
async function allows(scope:RoleScope,role:string,permission:Permission){
  if(!roleAllows(scope,role,permission))return false;
  const stored=await Role.findOne({scope,code:normalizePlatformRole(role)},{permissions:1}).lean();
  return !stored||stored.permissions.includes(permission);
}
export async function hasPlatformPermission(userId:string,permission:Permission){
  const role=await getActorRole(userId);
  return role!==null&&await allows('PLATFORM',role,permission);
}
export async function isPlatformAdmin(userId:string){return hasPlatformPermission(userId,'company.monitor');}
export async function isWorkspaceAdminAnywhere(userId:string){
  if(!mongoose.isValidObjectId(userId))return false;
  await dbConnect();
  return Boolean(await WorkspaceMember.exists({userId,role:{$in:['OWNER','ADMIN','WORKSPACE_ADMIN']}}));
}
export async function hasWorkspacePermission(userId:string,workspaceId:string,permission:Permission){
  if(!mongoose.isValidObjectId(workspaceId))return false;
  const role=await getActorRole(userId);
  if(!role)return false;
  if(await allows('PLATFORM',role,permission))return true;
  const membership=await WorkspaceMember.findOne({userId,workspaceId},{role:1}).lean();
  return Boolean(membership&&await allows('WORKSPACE',membership.role,permission));
}
// Company-wide APIs must never infer access from a single workspace membership.
export async function hasAdminAccess(userId:string){return hasPlatformPermission(userId,'company.monitor');}
