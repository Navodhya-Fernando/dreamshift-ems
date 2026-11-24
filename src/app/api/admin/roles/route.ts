import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { BUILTIN_ROLES } from '@/lib/roles';
import { hasPlatformPermission } from '@/lib/roles.server';
import Role from '@/models/Role';
export async function GET(){
  const session=await getServerSession(authOptions);
  if(!session?.user?.id)return NextResponse.json({success:false,error:'Unauthorized'},{status:401});
  if(!(await hasPlatformPermission(session.user.id,'company.roles.assign')))return NextResponse.json({success:false,error:'Forbidden'},{status:403});
  const stored=await Role.find({}).lean();
  return NextResponse.json({success:true,data:BUILTIN_ROLES.map(r=>{const record=stored.find(s=>s.scope===r.scope&&s.code===r.code);return {...r,permissions:record?r.permissions.filter(p=>record.permissions.includes(p)):r.permissions,persisted:Boolean(record)};})});
}
export async function POST(){
  const session=await getServerSession(authOptions);
  if(!session?.user?.id)return NextResponse.json({success:false,error:'Unauthorized'},{status:401});
  if(!(await hasPlatformPermission(session.user.id,'company.roles.assign')))return NextResponse.json({success:false,error:'Forbidden'},{status:403});
  // Insert only missing definitions; never replace an existing permission restriction.
  const result=await Role.bulkWrite(BUILTIN_ROLES.map(r=>({updateOne:{filter:{scope:r.scope,code:r.code},update:{$setOnInsert:{...r,permissions:[...r.permissions]}},upsert:true}})));
  return NextResponse.json({success:true,data:{created:result.upsertedCount}});
}
