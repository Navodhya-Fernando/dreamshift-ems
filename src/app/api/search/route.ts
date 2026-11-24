import {NextResponse} from 'next/server';
import {getServerSession} from 'next-auth';
import mongoose from 'mongoose';
import {authOptions} from '@/lib/auth';
import dbConnect from '@/lib/mongoose';
import {getAccessibleWorkspaceIds} from '@/lib/tenancy';
import {parseSearchQuery,escapeSearchTerm} from '@/lib/searchQuery';
import {monitored} from '@/lib/routeTelemetry';
import Project from '@/models/Project';
import Task from '@/models/Task';
import Workspace from '@/models/Workspace';
import Meeting from '@/models/Meeting';
import User from '@/models/User';
type Result={id:string;kind:string;title:string;subtitle:string;href:string};
async function search(req:Request){
  try{
    const session=await getServerSession(authOptions);const userId=session?.user?.id;
    if(!userId||!mongoose.isValidObjectId(userId))return NextResponse.json({success:false,error:'Unauthorized'},{status:401});
    const raw=new URL(req.url).searchParams.get('q')?.trim()||'';
    if(raw.length<2)return NextResponse.json({success:true,data:[]});
    const q=parseSearchQuery(raw);
    await dbConnect();
    const uid=new mongoose.Types.ObjectId(userId);
    const ids=await getAccessibleWorkspaceIds(userId);
    const keys=ids.flatMap(id=>mongoose.isValidObjectId(id)?[id,new mongoose.Types.ObjectId(id)]:[id]);
    const [workspaces,projects,actor]=await Promise.all([
      Workspace.collection.find({_id:{$in:ids.filter(id=>mongoose.isValidObjectId(id)).map(id=>new mongoose.Types.ObjectId(id))}},{projection:{name:1}}).toArray(),
      Project.collection.find({$or:[{workspaceId:{$in:keys}},{workspace_id:{$in:keys}}]},{projection:{name:1,workspaceId:1,workspace_id:1,ownerId:1,status:1}}).toArray(),
      User.collection.findOne({_id:uid},{projection:{name:1,email:1}})
    ]);
    const ws=new Map(workspaces.map(w=>[String(w._id),String(w.name||'Workspace')]));
    const projectById=new Map(projects.map(p=>[String(p._id),p]));
    const workspaceName=(p:typeof projects[number])=>ws.get(String(p.workspaceId||p.workspace_id))||'Workspace';
    const matches=(...values:string[])=>q.terms.every(t=>values.join(' ').toLowerCase().includes(t.toLowerCase()));
    const results:Result[]=[];
    if(q.kind==='all'||q.kind==='workspaces')for(const w of workspaces.filter(w=>matches(String(w.name))).slice(0,12))results.push({id:String(w._id),kind:'Workspace',title:String(w.name),subtitle:'Workspace',href:`/projects/workspace/${w._id}`});
    if(q.kind==='all'||q.kind==='projects')for(const p of projects.filter(p=>(!q.mine||String(p.ownerId)===userId)&&matches(String(p.name),workspaceName(p))).slice(0,15))results.push({id:String(p._id),kind:'Project',title:String(p.name),subtitle:workspaceName(p),href:`/projects/${p._id}`});
    if(q.kind==='all'||q.kind==='tasks'){
      const projectKeys=projects.flatMap(p=>[p._id,String(p._id)]);
      const and:Record<string,unknown>[]=[{$or:[{projectId:{$in:projectKeys}},{project_id:{$in:projectKeys}}]}];
      const done=['DONE','done','COMPLETED','completed','Completed'];
      if(q.mine){const legacy=[actor?.name,actor?.email,actor?.email?.toLowerCase()].filter(v=>typeof v==='string'&&v.length>0);and.push({$or:[{assigneeId:{$in:[uid,userId]}},{assigneeIds:{$in:[uid,userId]}},...(legacy.length?[{assignee:{$in:legacy}}]:[])]});}
      if(q.overdue){and.push({status:{$nin:done}},{$or:[{dueDate:{$lt:new Date()}},{due_date:{$lt:new Date()}}]});}
      if(q.status)and.push({status:{$in:q.status==='DONE'?done:[q.status,q.status.toLowerCase(),q.status==='IN_PROGRESS'?'In Progress':'Blocked']}});
      if(q.priority)and.push({priority:{$in:[q.priority,q.priority.toLowerCase()]}});
      if(q.from&&q.to)and.push({$or:[{dueDate:{$gte:q.from,$lt:q.to}},{due_date:{$gte:q.from,$lt:q.to}}]});
      for(const term of q.terms){const re=new RegExp(escapeSearchTerm(term),'i');const related=projects.filter(p=>matchesTerm(term,String(p.name),workspaceName(p))).flatMap(p=>[p._id,String(p._id)]);and.push({$or:[{title:re},...(related.length?[{projectId:{$in:related}},{project_id:{$in:related}}]:[])]});}
      const tasks=await Task.collection.find({$and:and},{projection:{title:1,status:1,projectId:1,project_id:1}}).sort({updatedAt:-1,_id:-1}).limit(25).maxTimeMS(2000).toArray();
      for(const t of tasks){const p=projectById.get(String(t.projectId||t.project_id));results.push({id:String(t._id),kind:'Task',title:String(t.title||'Task'),subtitle:[p?.name,t.status].filter(Boolean).join(' · '),href:`/tasks/${t._id}`});}
    }
    if(q.kind==='all'||q.kind==='meetings'){
      const and:Record<string,unknown>[]=[{$or:[{organizerId:uid},{attendeeIds:uid}]}];
      if(q.from&&q.to)and.push({startTime:{$gte:q.from,$lt:q.to}});
      for(const term of q.terms)and.push({title:new RegExp(escapeSearchTerm(term),'i')});
      const meetings=await Meeting.collection.find({$and:and},{projection:{title:1,startTime:1}}).sort({startTime:1}).limit(12).maxTimeMS(2000).toArray();
      for(const m of meetings)results.push({id:String(m._id),kind:'Meeting',title:String(m.title),subtitle:new Date(m.startTime).toISOString().slice(0,16).replace('T',' ')+' UTC',href:`/calendar/meetings#${m._id}`});
    }
    return NextResponse.json({success:true,data:results},{headers:{'Cache-Control':'no-store'}});
  }catch(e){console.error('Search failed',e);return NextResponse.json({success:false,error:'Search temporarily unavailable'},{status:503});}
}
function matchesTerm(term:string,...values:string[]){return values.join(' ').toLowerCase().includes(term.toLowerCase());}
export const GET=monitored('search.get',search);
