export type PlatformRole = 'EMPLOYEE' | 'WORKSPACE_ADMIN' | 'ADMIN' | 'Admin' | 'OWNER';
export type RoleCode = Exclude<PlatformRole,'Admin'>;
export type RoleScope = 'PLATFORM' | 'WORKSPACE';
export type Permission = 'company.monitor' | 'company.users.manage' | 'company.roles.assign' | 'workspace.members.manage' | 'workspace.read';
export type RoleDefinition = {scope:RoleScope;code:RoleCode;label:string;permissions:readonly Permission[]};
export function normalizePlatformRole(value?:string|null):RoleCode {
  const role=String(value||'EMPLOYEE').trim().toUpperCase().replace(/[\s-]+/g,'_');
  if(role==='ADMINISTRATOR')return 'ADMIN';
  if(role==='ADMIN'||role==='OWNER'||role==='WORKSPACE_ADMIN')return role;
  return 'EMPLOYEE';
}
export const BUILTIN_ROLES:readonly RoleDefinition[]=[
  {scope:'PLATFORM',code:'OWNER',label:'Company owner',permissions:['company.monitor','company.users.manage','company.roles.assign','workspace.members.manage','workspace.read']},
  {scope:'PLATFORM',code:'ADMIN',label:'Company administrator',permissions:['company.monitor','company.users.manage','company.roles.assign','workspace.members.manage','workspace.read']},
  {scope:'PLATFORM',code:'WORKSPACE_ADMIN',label:'Workspace manager',permissions:['workspace.read']},
  {scope:'PLATFORM',code:'EMPLOYEE',label:'Employee',permissions:['workspace.read']},
  {scope:'WORKSPACE',code:'OWNER',label:'Workspace owner',permissions:['workspace.members.manage','workspace.read']},
  {scope:'WORKSPACE',code:'ADMIN',label:'Workspace administrator',permissions:['workspace.members.manage','workspace.read']},
  {scope:'WORKSPACE',code:'WORKSPACE_ADMIN',label:'Workspace manager',permissions:['workspace.members.manage','workspace.read']},
  {scope:'WORKSPACE',code:'EMPLOYEE',label:'Workspace member',permissions:['workspace.read']},
];
export function roleDefinition(scope:RoleScope,value?:string|null){return BUILTIN_ROLES.find(r=>r.scope===scope&&r.code===normalizePlatformRole(value))!;}
export function roleAllows(scope:RoleScope,value:string|null|undefined,permission:Permission){return roleDefinition(scope,value).permissions.includes(permission);}
export function canAssignPlatformRole(actor:string|undefined,current:string|undefined,next:string|undefined){
  const a=normalizePlatformRole(actor),old=normalizePlatformRole(current),target=normalizePlatformRole(next);
  return roleAllows('PLATFORM',a,'company.roles.assign')&&(a==='OWNER'||(old!=='OWNER'&&target!=='OWNER'));
}
