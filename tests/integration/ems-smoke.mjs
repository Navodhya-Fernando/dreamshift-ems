import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const base='http://127.0.0.1:3000';
const uri=process.env.MONGODB_URI;
if(process.env.EMS_INTEGRATION_TEST!=='1'||process.env.DB_NAME!=='ems_test'||!/^mongodb:\/\/127\.0\.0\.1:27017\/ems_test(?:\?|$)/.test(uri||''))throw Error('Refusing to run outside the isolated loopback ems_test replica set.');
if(process.env.GOOGLE_CALENDAR_CLIENT_SECRET||process.env.EMS_VAPID_PRIVATE_KEY||process.env.BREVO_API_KEY)throw Error('Integration smoke test must not use live provider credentials.');

class Browser {
  constructor(){this.cookies=new Map();}
  async fetch(path,options={}){
    const headers=new Headers(options.headers||{});
    if(this.cookies.size)headers.set('cookie',[...this.cookies].map(([k,v])=>k+'='+v).join('; '));
    if(options.method&&options.method!=='GET'){headers.set('origin',base);headers.set('referer',base+'/');}
    const r=await fetch(base+path,{...options,headers,redirect:'manual'});
    for(const cookie of r.headers.getSetCookie()){const part=cookie.split(';')[0],i=part.indexOf('=');if(i>=0)this.cookies.set(part.slice(0,i),part.slice(i+1));}
    return r;
  }
  async json(path,method='GET',body,expected=200){
    const r=await this.fetch(path,{method,...(body===undefined?{}:{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})});
    const text=await r.text();assert.equal(r.status,expected,path+' '+text.slice(0,500));return JSON.parse(text);
  }
  async signIn(email,password){
    const {csrfToken}=await this.json('/api/auth/csrf');
    const r=await this.fetch('/api/auth/callback/credentials',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrfToken,email,password,callbackUrl:base+'/',json:'true'})});
    assert.ok([200,302].includes(r.status),'Credentials callback '+r.status);
    const session=await this.json('/api/auth/session');
    assert.equal(session.user?.email,email,'Session must belong to the expected user');
    return session.user;
  }
}
const oid=()=>new mongoose.Types.ObjectId();
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let checks=0;
function check(label){console.log('PASS: '+label);checks++;}
await mongoose.connect(uri,{dbName:'ems_test'});
const db=mongoose.connection.db;
try{
  const prefix='smoke-'+randomUUID().slice(0,8),password='Ems-Test-'+randomUUID();
  const now=new Date(),owner=oid(),employee=oid(),manager=oid(),workspace=oid(),project=oid(),task=oid();
  const passwordHash=await bcrypt.hash(password,4);
  const user=(id,role)=>({_id:id,name:prefix+' '+role,email:prefix+'-'+role.toLowerCase()+'@example.test',password:passwordHash,role,employmentStatus:'ACTIVE',createdAt:now,updatedAt:now});
  const ownerUser=user(owner,'OWNER'),employeeUser=user(employee,'EMPLOYEE'),managerUser=user(manager,'WORKSPACE_ADMIN');
  await db.collection('users').insertMany([ownerUser,employeeUser,managerUser]);
  await db.collection('workspaces').insertOne({_id:workspace,name:prefix+' Workspace',ownerId:owner,createdAt:now,updatedAt:now});
  await db.collection('workspacemembers').insertOne({_id:oid(),workspaceId:workspace,userId:manager,role:'ADMIN',createdAt:now,updatedAt:now});
  await db.collection('projects').insertOne({_id:project,name:prefix+' Project',workspaceId:workspace,ownerId:owner,status:'ACTIVE',createdAt:now,updatedAt:now});
  await db.collection('tasks').insertOne({_id:task,title:prefix+' Timer task',projectId:project,assigneeId:employee,assigneeIds:[employee],status:'TODO',priority:'MEDIUM',timeSpent:0,dueDate:new Date(Date.now()-86400000),createdAt:now,updatedAt:now});
  const anon=new Browser();
  await anon.json('/api/search?q=tasks','GET',undefined,401);
  await anon.json('/api/cron/google-calendar','GET',undefined,401);
  const manifest=await anon.fetch('/manifest.webmanifest');assert.equal(manifest.status,200);assert.equal((await manifest.json()).display,'standalone');
  assert.equal((await anon.fetch('/ems-sw.js')).status,200);
  assert.equal((await anon.fetch('/app-icons/192')).status,200);
  check('Public PWA assets and protected APIs');
  const admin=new Browser(),a=new Browser(),b=new Browser(),mgr=new Browser();
  await admin.signIn(ownerUser.email,password);await a.signIn(employeeUser.email,password);await b.signIn(employeeUser.email,password);await mgr.signIn(managerUser.email,password);
  await a.json('/api/admin/roles','GET',undefined,403);await mgr.json('/api/admin/roles','GET',undefined,403);
  const roles=await admin.json('/api/admin/roles');assert.ok(roles.data.length>=4);await admin.json('/api/admin/roles','POST',{});check('Real login sessions and company role boundaries');
  const directory=await a.json('/api/sidebar?all=1');assert.ok(directory.data.some(w=>w.projects.some(p=>p.id===String(project))));
  const search=await a.json('/api/search?q='+encodeURIComponent('Show my overdue tasks'));assert.ok(search.data.some(r=>r.id===String(task)));
  check('Direct project directory and natural-language search');
  const csv='title,priority\n'+prefix+' CSV one,HIGH\n'+prefix+' CSV two,MEDIUM\n';
  const bulk={projectId:String(project),csv,requestId:randomUUID()};
  const preview=await a.json('/api/tasks/bulk','POST',{...bulk,preview:true});assert.equal(preview.data.count,2);
  const created=await a.json('/api/tasks/bulk','POST',bulk,201);assert.equal(created.data.created,2);
  const repeated=await a.json('/api/tasks/bulk','POST',bulk,201);assert.equal(repeated.data.created,0);
  check('CSV preview, batch creation and retry deduplication');
  const rule={title:prefix+' recurring',projectId:String(project),assigneeId:String(employee),cadence:'DAILY',priority:'MEDIUM',startDate:new Date().toISOString().slice(0,10),requestId:randomUUID()};
  const r=await a.json('/api/tasks/recurring','POST',rule,201);assert.ok(r.data.id);
  await a.json('/api/tasks/recurring','POST',rule,201);assert.equal(await db.collection('tasks').countDocuments({title:rule.title}),1);
  await a.json('/api/tasks/recurring','PATCH',{id:r.data.id,active:false});
  const schedules=await a.json('/api/tasks/recurring');assert.equal(schedules.data.find(x=>x._id===r.data.id).active,false);
  check('Recurring generation, retry and pause');
  const start=await a.json('/api/time/timer','POST',{action:'start',taskId:String(task),note:'Integration test'});assert.ok(start.data.sessionId);
  const other=await b.json('/api/time/timer');assert.equal(other.data.sessionId,start.data.sessionId);
  await wait(1200);
  const paused=await b.json('/api/time/timer','POST',{action:'pause',sessionId:other.data.sessionId,revision:other.data.revision});assert.equal(paused.data.runningSince,null);assert.ok(paused.data.elapsedSeconds>=1);
  await a.json('/api/time/timer','POST',{action:'stop',sessionId:start.data.sessionId,revision:start.data.revision},409);
  const stopped=await a.json('/api/time/timer','POST',{action:'stop',sessionId:paused.data.sessionId,revision:paused.data.revision});assert.equal(stopped.data,null);
  await b.json('/api/time/timer','POST',{action:'stop',sessionId:paused.data.sessionId,revision:paused.data.revision});
  assert.equal(await db.collection('timeentries').countDocuments({taskId:task}),1);
  assert.equal((await db.collection('tasks').findOne({_id:task})).timeSpent,paused.data.elapsedSeconds);
  check('Cross-session timer, stale revision rejection and atomic stop');
  const manual={taskId:String(task),source:'MANUAL',requestId:randomUUID(),startTime:new Date(Date.now()-7200000).toISOString(),endTime:new Date(Date.now()-3600000).toISOString(),note:'Manual'};
  const e=await a.json('/api/time-entries','POST',manual,201);const e2=await a.json('/api/time-entries','POST',manual,201);assert.equal(e.data._id,e2.data._id);
  assert.equal((await db.collection('tasks').findOne({_id:task})).timeSpent,paused.data.elapsedSeconds+3600);
  const edited=await a.json('/api/time-entries/'+e.data._id,'PUT',{endTime:new Date(new Date(manual.startTime).getTime()+1800000).toISOString(),note:'Edited'});
  assert.equal(edited.data.durationSeconds,1800);
  await a.json('/api/time-entries/'+e.data._id,'DELETE');assert.equal((await db.collection('tasks').findOne({_id:task})).timeSpent,paused.data.elapsedSeconds);
  check('Manual timesheet create, idempotency, edit and delete totals');
  const meeting=await admin.json('/api/meetings','POST',{title:prefix+' Team meeting',description:'Test agenda',startTime:new Date(Date.now()+3600000).toISOString(),endTime:new Date(Date.now()+5400000).toISOString(),attendeeIds:[String(employee)],requestId:randomUUID()},201);
  const meetings=await a.json('/api/meetings');assert.ok(meetings.data.some(m=>m._id===meeting.data._id));
  const ics=await a.fetch('/api/meetings/'+meeting.data._id+'/ics');assert.equal(ics.status,200);assert.match(await ics.text(),/BEGIN:VEVENT/);
  check('Meeting persistence, attendee access and calendar file');
  const health=await admin.json('/api/admin/monitoring');assert.ok(health.data.health);await a.json('/api/admin/monitoring','GET',undefined,403);
  assert.equal((await a.json('/api/integrations/google-calendar')).data.configured,false);
  assert.equal((await a.json('/api/integrations/google-tasks')).data.granted,false);
  assert.equal((await a.json('/api/notifications/devices')).data.publicKey,null);
  check('Admin monitoring and unconfigured provider states');
  console.log('Authenticated integration checks passed: '+checks);
}finally{await mongoose.disconnect();}
