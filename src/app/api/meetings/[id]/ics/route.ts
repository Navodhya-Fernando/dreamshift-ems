import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import mongoose from 'mongoose';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongoose';
import Meeting from '@/models/Meeting';
import { meetingIcs, type MeetingEvent } from '@/lib/meetingIcs';
export async function GET(_req:Request,{params}:{params:Promise<{id:string}>}){
  const session=await getServerSession(authOptions),userId=session?.user?.id,{id}=await params;
  if(!userId||!mongoose.isValidObjectId(userId))return new NextResponse('Unauthorized',{status:401});
  if(!mongoose.isValidObjectId(id))return new NextResponse('Not found',{status:404});
  await dbConnect();const user=new mongoose.Types.ObjectId(userId);
  const m=await Meeting.collection.findOne({_id:new mongoose.Types.ObjectId(id),$or:[{organizerId:user},{attendeeIds:user}]});
  if(!m)return new NextResponse('Not found',{status:404});
  return new NextResponse(meetingIcs(m as unknown as MeetingEvent),{headers:{'Content-Type':'text/calendar; charset=utf-8','Content-Disposition':'attachment; filename="dreamshift-meeting.ics"','Cache-Control':'no-store'}});
}
