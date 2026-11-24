import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasAdminAccess } from '@/lib/roles.server';
import dbConnect from '@/lib/mongoose';
import { monitored } from '@/lib/routeTelemetry';
import { utcDay } from '@/lib/recurrence';
import Task from '@/models/Task';
import Project from '@/models/Project';
import Workspace from '@/models/Workspace';
import User from '@/models/User';
import TimeEntry from '@/models/TimeEntry';
import RecurringTask from '@/models/RecurringTask';
import Meeting from '@/models/Meeting';
import SystemJobRun from '@/models/SystemJobRun';

type Counts={open:number;overdue:number;blocked:number;dueSoon:number;completed:number};
const empty=():Counts=>({open:0,overdue:0,blocked:0,dueSoon:0,completed:0});
function add(target:Counts,flags:Counts){for(const k of Object.keys(flags) as Array<keyof Counts>)target[k]+=flags[k];}
async function getMonitoring(){
  const start=performance.now();
  try{
    const session=await getServerSession(authOptions);
    if(!session?.user?.id)return NextResponse.json({success:false,error:'Unauthorized'},{status:401});
    const db=await dbConnect();
    if(!(await hasAdminAccess(session.user.id)))return NextResponse.json({success:false,error:'Admin access required'},{status:403});
    const pingStart=performance.now();await db.connection.db?.command({ping:1});const dbPingMs=Math.round(performance.now()-pingStart);
    const now=new Date(),week=new Date(now.getTime()-7*86400000),soon=new Date(now.getTime()+7*86400000);
    const [users,workspaces,projects,jobs,recurringDue,recurringActive,inviteFailures,timeTotals]=await Promise.all([
      User.find({},{_id:1,name:1,email:1,designation:1,employmentStatus:1}).lean(),
      Workspace.collection.find({},{projection:{name:1}}).toArray(),
      Project.collection.find({},{projection:{name:1,workspaceId:1,workspace_id:1,status:1}}).toArray(),
      SystemJobRun.collection.find({name:'daily-operations'}).sort({startedAt:-1}).limit(10).toArray(),
      RecurringTask.countDocuments({active:true,nextRunAt:{$lte:utcDay(now)}}),
      RecurringTask.countDocuments({active:true}),
      Meeting.countDocuments({endTime:{$gte:now},'invites.status':{$in:['FAILED','PENDING','SENDING']}}),
      TimeEntry.collection.aggregate<{_id:string;seconds:number}>([{$match:{startTime:{$gte:week,$lte:now}}},{$group:{_id:{$toString:'$userId'},seconds:{$sum:'$durationSeconds'}}}]).toArray(),
    ]);
    const totals=empty(),unassigned=empty(),personCounts=new Map<string,Counts>(),workspaceCounts=new Map<string,Counts>();
    const projectWorkspace=new Map(projects.map(p=>[String(p._id),String(p.workspaceId||p.workspace_id||'')]));
    const personIds=new Set(users.map(u=>String(u._id)));
    const legacy=new Map<string,Set<string>>();
    for(const u of users){for(const key of [u.email,u.name].filter(Boolean).map(v=>String(v).toLowerCase())){const ids=legacy.get(key)||new Set<string>();ids.add(String(u._id));legacy.set(key,ids);}}
    let ambiguousLegacy=0;
    // Stream a narrow projection, rather than loading one full task list for every person and workspace.
    const cursor=Task.collection.find({},{projection:{status:1,dueDate:1,due_date:1,assigneeId:1,assigneeIds:1,assignee:1,projectId:1,project_id:1}});
    for await(const t of cursor){
      const status=String(t.status||'TODO').trim().toUpperCase().replace(/[\s-]+/g,'_');
      const done=['DONE','COMPLETED'].includes(status),raw=t.dueDate||t.due_date,due=raw?new Date(raw):null;
      const flags:Counts={open:done?0:1,completed:done?1:0,overdue:!done&&due&&due<now?1:0,blocked:!done&&status==='BLOCKED'?1:0,dueSoon:!done&&due&&due>=now&&due<=soon?1:0};
      add(totals,flags);
      const workspaceId=projectWorkspace.get(String(t.projectId||t.project_id||''))||'unmapped';
      const wc=workspaceCounts.get(workspaceId)||empty();add(wc,flags);workspaceCounts.set(workspaceId,wc);
      const ids=new Set([t.assigneeId,...(Array.isArray(t.assigneeIds)?t.assigneeIds:[])].filter(Boolean).map(String).filter(id=>personIds.has(id)));
      if(!ids.size&&t.assignee){const matches=legacy.get(String(t.assignee).toLowerCase());if(matches?.size===1)for(const id of matches)ids.add(id);else if(matches&&matches.size>1)ambiguousLegacy++;}
      if(!ids.size)add(unassigned,flags);
      for(const id of ids){const counts=personCounts.get(id)||empty();add(counts,flags);personCounts.set(id,counts);}
    }
    const timeMap=new Map(timeTotals.map(t=>[t._id,t.seconds]));
    const people=users.filter(u=>String(u.employmentStatus||'ACTIVE').toUpperCase()!=='LEFT').map(u=>({id:String(u._id),name:String(u.name||'Team member'),designation:String(u.designation||''),...personCounts.get(String(u._id))||empty(),hours7d:Math.round((timeMap.get(String(u._id))||0)/360)/10})).sort((a,b)=>b.overdue-a.overdue||b.blocked-a.blocked||b.open-a.open);
    const workspaceRows=workspaces.map(w=>({id:String(w._id),name:String(w.name||'Workspace'),...workspaceCounts.get(String(w._id))||empty()})).sort((a,b)=>b.overdue-a.overdue||b.open-a.open);
    if(workspaceCounts.has('unmapped'))workspaceRows.push({id:'unmapped',name:'Unmapped project records',...workspaceCounts.get('unmapped')!});
    return NextResponse.json({success:true,data:{generatedAt:now.toISOString(),totals,unassigned,ambiguousLegacy,people,workspaces:workspaceRows,health:{dbPingMs,requestMs:Math.round(performance.now()-start),recurringDue,recurringActive,inviteFailures},jobs:jobs.map(j=>({id:String(j._id),name:j.name,startedAt:j.startedAt,finishedAt:j.finishedAt,status:j.status,durationMs:j.durationMs,details:j.details}))}},{headers:{'Cache-Control':'no-store'}});
  }catch(e){console.error('Operational monitoring failed',e);return NextResponse.json({success:false,error:'Monitoring is temporarily unavailable'},{status:503});}
}
export const GET=monitored('admin.monitoring',getMonitoring);
