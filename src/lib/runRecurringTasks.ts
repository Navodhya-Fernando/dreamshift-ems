import mongoose from 'mongoose';
import { createHash } from 'node:crypto';
import RecurringTask from '@/models/RecurringTask';
import Project from '@/models/Project';
import User from '@/models/User';
import Task from '@/models/Task';
import Notification from '@/models/Notification';
import { dueOccurrences, utcDay, type Cadence } from '@/lib/recurrence';
const derived = (key:string) => new mongoose.Types.ObjectId(createHash('sha256').update(key).digest('hex').slice(0,24));

/** Bounded, retry-safe runner. Cursor advances only after task and notification writes succeed. */
export async function runDueRecurringTasks(now = new Date(), ruleId?: string) {
  const today = utcDay(now);
  const filter = { active:true,nextRunAt:{$lte:today},...(ruleId?{_id:new mongoose.Types.ObjectId(ruleId)}:{}) };
  const rules = await RecurringTask.collection.find(filter).sort({nextRunAt:1}).limit(50).toArray();
  if (!rules.length) return {scanned:0,created:0,paused:0};
  const [projects,users] = await Promise.all([
    Project.collection.find({_id:{$in:rules.map(r=>r.projectId)}},{projection:{status:1}}).toArray(),
    User.collection.find({_id:{$in:rules.map(r=>r.assigneeId)}},{projection:{_id:1}}).toArray(),
  ]);
  const validProjects = new Set(projects.filter(p=>String(p.status||'ACTIVE').toUpperCase()!=='CLOSED').map(p=>String(p._id)));
  const validUsers = new Set(users.map(u=>String(u._id)));
  const invalid = rules.filter(r=>!validProjects.has(String(r.projectId))||!validUsers.has(String(r.assigneeId)));
  if (invalid.length) await RecurringTask.collection.updateMany({_id:{$in:invalid.map(r=>r._id)}},{$set:{active:false,lastError:'Project closed or assignee unavailable',updatedAt:now}});
  const valid = rules.filter(r=>validProjects.has(String(r.projectId))&&validUsers.has(String(r.assigneeId)));
  const plans = valid.map(r=>({rule:r,...dueOccurrences(new Date(r.nextRunAt),r.cadence as Cadence,Number(r.anchorDay),today)}));
  const occurrences = plans.flatMap(p=>p.dates.map(date=>{
    const id = derived(`recurring:${p.rule._id}:${date.toISOString()}`);
    const deadline = new Date(date);deadline.setUTCHours(23,59,59,999);
    const r=p.rule;
    return {_id:id,title:String(r.title),description:String(r.description||''),status:'TODO',priority:String(r.priority||'MEDIUM'),projectId:r.projectId,assigneeId:r.assigneeId,assigneeIds:[r.assigneeId],dueDate:deadline,timeSpent:0,subtasks:[],attachments:[],createdAt:now,updatedAt:now};
  }));
  let created=0;
  if (occurrences.length) {
    const result=await Task.collection.bulkWrite(occurrences.map(doc=>({updateOne:{filter:{_id:doc._id},update:{$setOnInsert:doc},upsert:true}})),{ordered:false});
    created=result.upsertedCount;
    await Notification.collection.bulkWrite(occurrences.map(doc=>({updateOne:{filter:{_id:derived(`assignment:${doc._id}:${doc.assigneeId}`)},update:{$setOnInsert:{userId:doc.assigneeId,type:'assignment',title:'Recurring task assigned',message:`You were assigned to "${doc.title}".`,link:`/tasks/${doc._id}`,isRead:false,createdAt:now,updatedAt:now}},upsert:true}})),{ordered:false});
    await RecurringTask.collection.bulkWrite(plans.map(p=>({updateOne:{filter:{_id:p.rule._id,active:true,nextRunAt:p.rule.nextRunAt},update:{$set:{nextRunAt:p.next,lastRunAt:now,updatedAt:now},$unset:{lastError:''}}}})),{ordered:false});
  }
  return {scanned:rules.length,created,paused:invalid.length};
}
