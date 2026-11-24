import { monitored } from '@/lib/routeTelemetry';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import mongoose from 'mongoose';
import { createHash } from 'node:crypto';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongoose';
import { sendBrevoEmail } from '@/lib/brevo';
import Meeting from '@/models/Meeting';
import User from '@/models/User';
import Notification from '@/models/Notification';
const oid=(id:string)=>new mongoose.Types.ObjectId(id);
const derived=(key:string)=>oid(createHash('sha256').update(key).digest('hex').slice(0,24));
const fail=(error:string,status=400)=>NextResponse.json({success:false,error},{status});
const escapeHtml=(s:string)=>s.replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]||ch));
async function current(){const s=await getServerSession(authOptions);return s?.user?.id&&mongoose.isValidObjectId(s.user.id)?s.user:null;}
async function sendInvites(id:mongoose.Types.ObjectId,origin:string){
  const event=await Meeting.collection.findOne({_id:id});if(!event)return;
  const invites=(event.invites||[]) as Array<{userId:mongoose.Types.ObjectId;status:string}>;
  const pending=invites.filter(i=>i.status==='PENDING'||i.status==='FAILED');
  if(!pending.length)return;
  const users=await User.find({_id:{$in:pending.map(i=>i.userId)}},{name:1,email:1}).lean();
  const byId=new Map(users.map(u=>[String(u._id),u]));
  const link=`${origin}/calendar/meetings?meeting=${id}`;
  const now=new Date();
  await Notification.collection.bulkWrite(pending.map(i=>({updateOne:{filter:{_id:derived(`meeting-invite:${id}:${i.userId}`)},update:{$setOnInsert:{userId:i.userId,type:'system',title:'Meeting invitation',message:String(event.title),link:`/calendar/meetings?meeting=${id}`,isRead:false,createdAt:now,updatedAt:now}},upsert:true}})),{ordered:false});
  for(let offset=0;offset<pending.length;offset+=5){
    await Promise.all(pending.slice(offset,offset+5).map(async i=>{
      const claimed=await Meeting.collection.updateOne({_id:id,invites:{$elemMatch:{userId:i.userId,status:{$in:['PENDING','FAILED']}}}},{$set:{'invites.$.status':'SENDING'}});
      if(!claimed.modifiedCount)return;
      const user=byId.get(String(i.userId));
      const start=new Date(event.startTime).toISOString().replace('T',' ').slice(0,16)+' UTC';
      const end=new Date(event.endTime).toISOString().replace('T',' ').slice(0,16)+' UTC';
      const description=String(event.description||'');
      const subject=`Meeting invitation: ${String(event.title).replace(/[\r\n]/g,' ')}`;
      const sent=user?.email?await sendBrevoEmail({toEmail:String(user.email),toName:String(user.name||''),subject,htmlContent:`<h2>${escapeHtml(String(event.title))}</h2><p>${escapeHtml(start)} to ${escapeHtml(end)}</p><p>${escapeHtml(description)}</p><p><a href="${escapeHtml(link)}">Open invitation and add to calendar</a></p>`,textContent:`${subject}\n${start} to ${end}\n${description}\n${link}`}):false;
      await Meeting.collection.updateOne({_id:id,'invites.userId':i.userId},{$set:{'invites.$.status':sent?'SENT':'FAILED',...(sent?{'invites.$.sentAt':new Date()}:{}),updatedAt:new Date()}});
    }));
  }
}
async function handleGET(){
  const user=await current();if(!user?.id)return fail('Unauthorized',401);
  try{await dbConnect();const id=oid(user.id);const data=await Meeting.collection.find({$or:[{organizerId:id},{attendeeIds:id}],endTime:{$gte:new Date(Date.now()-30*86400000)}}).sort({startTime:1}).limit(100).toArray();return NextResponse.json({success:true,data:data.map(m=>({...m,invites:String(m.organizerId)===user.id?m.invites:undefined}))});}catch(e){console.error('Meeting list failed',e);return fail('Could not load meetings',500);}
}
async function handlePOST(req:Request){
  const user=await current();if(!user?.id)return fail('Unauthorized',401);
  try{
    const body=await req.json();const title=String(body.title||'').trim(),description=String(body.description||'').trim(),meetingUrl=String(body.meetingUrl||'').trim();
    const startTime=new Date(String(body.startTime||'')),endTime=new Date(String(body.endTime||''));
    if(!title||title.length>200||description.length>5000||!Number.isFinite(startTime.getTime())||!Number.isFinite(endTime.getTime())||endTime<=startTime||endTime.getTime()-startTime.getTime()>86400000)return fail('Provide a title and valid meeting times (maximum 24 hours).');
    if(meetingUrl){try{const url=new URL(meetingUrl);if(url.protocol!=='https:'||url.username||url.password||/[\r\n]/.test(meetingUrl))return fail('Use a valid HTTPS meeting link.');}catch{return fail('Use a valid HTTPS meeting link.');}}
    const attendeeIds=Array.isArray(body.attendeeIds)?Array.from(new Set<string>(body.attendeeIds.map(String))).filter(id=>id!==user.id):[];
    if(attendeeIds.length<1||attendeeIds.length>20||attendeeIds.some(id=>!mongoose.isValidObjectId(id)))return fail('Select 1 to 20 team members.');
    if(typeof body.requestId!=='string'||!/^[a-f0-9-]{36}$/i.test(body.requestId))return fail('Invalid request ID.');
    await dbConnect();const attendees=await User.find({_id:{$in:attendeeIds.map(oid)}},{_id:1}).lean();if(attendees.length!==attendeeIds.length)return fail('One or more attendees are unavailable.');
    const id=derived(`meeting:${user.id}:${body.requestId}`),now=new Date();
    await Meeting.collection.updateOne({_id:id},{$setOnInsert:{organizerId:oid(user.id),attendeeIds:attendeeIds.map(oid),title,description,meetingUrl,startTime,endTime,invites:attendeeIds.map(a=>({userId:oid(a),status:'PENDING'})),createdAt:now,updatedAt:now}},{upsert:true});
    const origin=new URL(req.url).origin;
    // Creation persists before attempting delivery. A failed email never deletes the meeting.
    try{await sendInvites(id,origin);}catch(e){console.error('Meeting invite delivery failed',e);}
    const data=await Meeting.collection.findOne({_id:id});
    return NextResponse.json({success:true,data},{status:201});
  }catch(e){console.error('Meeting create failed',e);return fail('Could not create meeting. Retry with the same details.');}
}
async function handlePATCH(req:Request){
  const user=await current();if(!user?.id)return fail('Unauthorized',401);
  try{const body=await req.json();if(!mongoose.isValidObjectId(body.id))return fail('Invalid meeting ID');await dbConnect();const id=oid(body.id);const event=await Meeting.collection.findOne({_id:id,organizerId:oid(user.id)});if(!event)return fail('Meeting not found',404);await sendInvites(id,new URL(req.url).origin);return NextResponse.json({success:true,data:await Meeting.collection.findOne({_id:id})});}catch(e){console.error('Meeting retry failed',e);return fail('Unable to retry invitations',500);}
}

export const GET=monitored('meetings.get',handleGET);

export const POST=monitored('meetings.post',handlePOST);

export const PATCH=monitored('meetings.patch',handlePATCH);
