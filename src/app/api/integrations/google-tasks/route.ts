import {NextResponse} from 'next/server';
import {getServerSession} from 'next-auth';
import mongoose from 'mongoose';
import {authOptions} from '@/lib/auth';
import dbConnect from '@/lib/mongoose';
import {googleConfig,getAccess} from '@/lib/googleCalendar';
import {taskLists,syncGoogleTasks} from '@/lib/googleTasks';
import Connection from '@/models/GoogleCalendarConnection';
const fail=(error:string,status=400)=>NextResponse.json({success:false,error},{status});
export const maxDuration=300;
async function current(){const s=await getServerSession(authOptions);return s?.user?.id&&mongoose.isValidObjectId(s.user.id)?s.user.id:null;}
export async function GET(){
 const uid=await current();if(!uid)return fail('Unauthorized',401);
 try{await dbConnect();const c=await Connection.findById(uid).select('tasksGranted taskListId taskProjectId taskAutoSync lastTasksSyncedAt tasksLastError').lean();return NextResponse.json({success:true,data:{configured:Boolean(googleConfig()),granted:Boolean(c?.tasksGranted),listId:c?.taskListId||'',projectId:c?.taskProjectId||'',auto:Boolean(c?.taskAutoSync),lastSyncedAt:c?.lastTasksSyncedAt||null,error:c?.tasksLastError||''}},{headers:{'Cache-Control':'no-store'}});}catch{return fail('Google Tasks settings unavailable.',503);}
}
export async function POST(req:Request){
 const uid=await current();if(!uid)return fail('Unauthorized',401);
 const config=googleConfig();if(!config)return fail('Google integration not configured.',503);
 if(req.headers.get('origin')!==config.origin)return fail('Invalid request origin.',403);
 try{const body=await req.json();await dbConnect();const c=await Connection.findById(uid).select('+refreshToken').lean();if(!c?.tasksGranted)return fail('Authorize Google Tasks first.',409);
 if(body.action==='pause'){const r=await Connection.updateOne({_id:c._id,revision:c.revision,$or:[{syncLeaseUntil:{$exists:false}},{syncLeaseUntil:{$lt:new Date()}}]},{$set:{taskAutoSync:false}});if(!r.matchedCount)return fail('Wait for the current sync to finish, then pause.',409);return NextResponse.json({success:true});}
 if(body.action==='lists')return NextResponse.json({success:true,data:await taskLists(await getAccess(config,uid,c.refreshToken))});
 if(body.action!=='sync'||body.confirm!==true)return fail('Confirm the task list and shared EMS project.');
 return NextResponse.json({success:true,data:await syncGoogleTasks(uid,String(body.listId||''),String(body.projectId||''),body.auto===true)});
 }catch(e){console.warn('Google Tasks action failed');return fail(e instanceof Error?e.message:'Google Tasks request failed.',503);}
}
