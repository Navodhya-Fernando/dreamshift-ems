import { monitored } from '@/lib/routeTelemetry';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import mongoose from 'mongoose';
import { createHash } from 'node:crypto';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongoose';
import { hasWorkspaceAccess } from '@/lib/tenancy';
import { normalizeProjectTaskStatuses } from '@/lib/taskStatuses';
import { parseTaskCsv, parseTaskDate } from '@/lib/taskCsv';
import Project from '@/models/Project';
import Task from '@/models/Task';
import User from '@/models/User';
import Notification from '@/models/Notification';

const oid = (id: string) => new mongoose.Types.ObjectId(id);
const derivedId = (key: string) => oid(createHash('sha256').update(key).digest('hex').slice(0,24));
const fail = (error: string, status = 400) => NextResponse.json({ success:false, error }, { status });
async function handlePOST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    if (!userId || !mongoose.isValidObjectId(userId)) return fail('Unauthorized',401);
    const body = await req.json();
    if (typeof body.csv !== 'string' || !mongoose.isValidObjectId(body.projectId)) return fail('Select a project and upload a CSV.');
    const rows = parseTaskCsv(body.csv);
    await dbConnect();
    const project = await Project.collection.findOne({_id:oid(String(body.projectId))});
    if (!project || !(await hasWorkspaceAccess(userId, String(project.workspaceId || project.workspace_id)))) return fail('Project unavailable',403);
    if (String(project.status || '').toUpperCase() === 'CLOSED') return fail('Choose an active project.');
    const users = await User.find({}, {_id:1,email:1,name:1}).lean();
    const emailMap = new Map(users.map(u => [String(u.email || '').toLowerCase(),String(u._id)]));
    const statuses = normalizeProjectTaskStatuses(project.taskStatuses);
    const now = new Date();
    const errors: string[] = [];
    const tasks = rows.flatMap((row,i) => {
      try {
        if (!row.title || row.title.length > 200) throw new Error('Title must contain 1–200 characters.');
        if ((row.description || '').length > 10000) throw new Error('Description is too long.');
        const priority = (row.priority || 'MEDIUM').toUpperCase();
        if (!['LOW','MEDIUM','HIGH','URGENT'].includes(priority)) throw new Error('Invalid priority.');
        const rawStatus = (row.status || 'TODO').trim().toUpperCase().replace(/\s+/g,'_');
        const status = statuses.find(s => s.key === rawStatus || s.label.toUpperCase().replace(/\s+/g,'_') === rawStatus)?.key;
        if (!status) throw new Error('Status not available in the selected project.');
        const email = (row.assignee_email || '').toLowerCase();
        const assignee = email ? emailMap.get(email) : userId;
        if (!assignee) throw new Error('Assignee email not found.');
        const date = parseTaskDate(row.due_date || '');
        return [{ title:row.title, description:row.description || '', priority,status, projectId:oid(String(project._id)), assigneeId:oid(assignee), assigneeIds:[oid(assignee)], ...(date ? {dueDate:date} : {}), ...(status==='IN_PROGRESS'?{startDate:now}:{}), ...(status==='DONE'?{endDate:now}:{}), timeSpent:0, subtasks:[],attachments:[],createdAt:now,updatedAt:now }];
      } catch (e) { errors.push(`Data row ${i+1}: ${e instanceof Error ? e.message : 'Invalid row'}`); return []; }
    });
    if (errors.length) return NextResponse.json({success:false,error:'Correct the CSV before importing.',errors},{status:400});
    if (body.preview === true) return NextResponse.json({success:true,data:{count:tasks.length,rows:tasks.map(t=>({title:t.title,priority:t.priority,status:t.status,dueDate:'dueDate' in t?t.dueDate:null,assignee:users.find(u=>String(u._id)===String(t.assigneeId))?.name || String(t.assigneeId)}))}});
    if (typeof body.requestId !== 'string' || !/^[a-f0-9-]{36}$/i.test(body.requestId)) return fail('Missing valid import request ID.');
    const digest = createHash('sha256').update(JSON.stringify([body.projectId,body.csv])).digest('hex');
    const docs = tasks.map((task,i)=>({_id:derivedId(`csv:${userId}:${body.requestId}:${digest}:${i}`),...task}));
    const result = await Task.collection.bulkWrite(docs.map(doc=>({updateOne:{filter:{_id:doc._id},update:{$setOnInsert:doc},upsert:true}})),{ordered:false});
    // Stable notification IDs make retries safe without per-task lookup round trips.
    await Notification.collection.bulkWrite(docs.map(doc=>({updateOne:{filter:{_id:derivedId(`assignment:${doc._id}:${doc.assigneeId}`)},update:{$setOnInsert:{userId:doc.assigneeId,type:'assignment',title:'New task assigned',message:`You were assigned to "${doc.title}".`,link:`/tasks/${doc._id}`,isRead:false,createdAt:now,updatedAt:now}},upsert:true}})),{ordered:false});
    return NextResponse.json({success:true,data:{count:docs.length,created:result.upsertedCount}},{status:201});
  } catch(e) { console.error('Bulk task import failed',e); return fail('Import failed. Check your CSV or retry the same import.'); }
}

export const POST=monitored('tasks/bulk.post',handlePOST);
