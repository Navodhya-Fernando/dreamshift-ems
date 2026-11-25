import {NextResponse} from 'next/server';
import {getServerSession} from 'next-auth';
import mongoose from 'mongoose';
import {randomUUID} from 'node:crypto';
import {authOptions} from '@/lib/auth';
import dbConnect from '@/lib/mongoose';
import Connection from '@/models/GoogleCalendarConnection';
import Meeting from '@/models/Meeting';
import User from '@/models/User';
import {googleConfig,getAccess,calendars,getGoogleEvent,publishGoogleEvent} from '@/lib/googleCalendar';
import {eventId} from '@/lib/syncGoogleCalendar';
import {fingerprint,type Schedule} from '@/lib/calendarSyncPolicy';
const fail=(error:string,status=400)=>NextResponse.json({success:false,error},{status});
export const maxDuration=60;
export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){
 const session=await getServerSession(authOptions),uid=session?.user?.id,{id}=await params;
 if(!uid||!mongoose.isValidObjectId(uid))return fail('Unauthorized',401);
 if(!mongoose.isValidObjectId(id))return fail('Invalid meeting ID.');
 const config=googleConfig();if(!config)return fail('Google Calendar is not configured.',503);
 if(req.headers.get('origin')!==config.origin)return fail('Invalid request origin.',403);
 let guard:Record<string,unknown>|null=null;
 try{
  const body=await req.json();if(body.confirm!==true)return fail('Confirm Google Calendar publication and invitations.');
  await dbConnect();
  const userId=new mongoose.Types.ObjectId(uid),meetingId=new mongoose.Types.ObjectId(id);
  const meeting=await Meeting.collection.findOne({_id:meetingId,organizerId:userId});
  if(!meeting)return fail('Meeting not found.',404);
  if(new Date(meeting.endTime)<new Date())return fail('This meeting has ended.');
  const leaseId=randomUUID(),now=new Date();
  const conn=await Connection.findOneAndUpdate({_id:userId,writeEnabled:true,calendarId:{$exists:true,$ne:''},$or:[{syncLeaseUntil:{$exists:false}},{syncLeaseUntil:{$lt:now}}]},{$set:{syncLeaseId:leaseId,syncLeaseUntil:new Date(Date.now()+90000)}},{new:true}).select('+refreshToken').lean();
  if(!conn)return fail('Select an owned work calendar, enable write synchronization, or retry after the current sync.',409);
  guard={_id:userId,syncLeaseId:leaseId,revision:conn.revision};
  if(meeting.googleCalendarId&&meeting.googleCalendarId!==conn.calendarId)return fail('Reconnect the original calendar before publishing this meeting.',409);
  const token=await getAccess(config,uid,conn.refreshToken),list=await calendars(token);
  if(!list.some(c=>c.id===conn.calendarId&&c.accessRole==='owner'))return fail('Select a calendar you own.',403);
  const targetId=eventId(uid,'meeting:'+id),existing=await getGoogleEvent(token,conn.calendarId!,targetId);
  if(existing&&(existing.status==='cancelled'||existing.extendedProperties?.private?.emsOwner!==uid||existing.extendedProperties?.private?.emsEntity!=='meeting:'+id))return fail('Linked event is unavailable or no longer managed by EMS.',409);
  const schedule:Schedule={title:String(meeting.title),start:new Date(meeting.startTime).toISOString(),end:new Date(meeting.endTime).toISOString(),allDay:false};
  if(existing){
   const remote:Schedule={title:String(existing.summary||''),start:new Date(existing.start?.dateTime||0).toISOString(),end:new Date(existing.end?.dateTime||0).toISOString(),allDay:false};
   if(fingerprint(remote)!==fingerprint(schedule))return fail('Meeting times or title differ in Google. Synchronize the calendar before publishing.',409);
  }
  const users=await User.find({_id:{$in:meeting.attendeeIds||[]}},{email:1}).lean();
  const emails=Array.from(new Set(users.map(u=>String(u.email||'').trim().toLowerCase()).filter(e=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))));
  if(!emails.length)return fail('No valid employee email addresses.');
  const oldEmails=new Set((existing?.attendees||[]).map(a=>String(a.email||'').toLowerCase()));
  const allInvited=emails.every(e=>oldEmails.has(e));
  const needConference=body.createMeet===true&&!meeting.meetingUrl&&!existing?.hangoutLink&&!existing?.conferenceData?.createRequest;
  const fields:Record<string,unknown>={summary:schedule.title,start:{dateTime:schedule.start},end:{dateTime:schedule.end},visibility:'private',extendedProperties:{private:{emsOwner:uid,emsEntity:'meeting:'+id,emsBase:fingerprint(schedule)}}};
  if(!allInvited)fields.attendees=[...(existing?.attendees||[]),...emails.filter(e=>!oldEmails.has(e)).map(email=>({email}))];
  if(!existing&&meeting.meetingUrl)fields.location=String(meeting.meetingUrl);
  if(needConference)fields.conferenceData={createRequest:{requestId:targetId,conferenceSolutionKey:{type:'hangoutsMeet'}}};
  if(!await Connection.exists(guard))return fail('Calendar connection changed.',409);
  const event=existing&&allInvited&&!needConference?existing:await publishGoogleEvent(token,conn.calendarId!,existing?fields:{...fields,id:targetId},existing||undefined);
  const meetLink=event.hangoutLink?.startsWith('https://meet.google.com/')?event.hangoutLink:'';
  await Meeting.collection.updateOne({_id:meetingId,organizerId:userId},{$set:{googleEventPublishedAt:new Date(),googleEventId:targetId,googleCalendarId:conn.calendarId,updatedAt:new Date(),...(!meeting.meetingUrl&&meetLink?{meetingUrl:meetLink}:{})}});
  return NextResponse.json({success:true,data:{meetingUrl:meetLink,conferenceStatus:event.conferenceData?.createRequest?.status?.statusCode||'',invited:emails.length}});
 }catch(e){console.warn('Google meeting publication failed');return fail(e instanceof Error?e.message:'Google meeting publication failed.',503);}
 finally{if(guard)await Connection.updateOne(guard,{$unset:{syncLeaseUntil:1,syncLeaseId:1}}).catch(()=>undefined);}
}
