import {NextResponse} from 'next/server';
import {getServerSession} from 'next-auth';
import mongoose from 'mongoose';
import {syncGoogle} from '@/lib/syncGoogleCalendar';
import {authOptions} from '@/lib/auth';
import dbConnect from '@/lib/mongoose';
import {googleConfig,getAccess,calendars,unseal} from '@/lib/googleCalendar';
import Connection from '@/models/GoogleCalendarConnection';
const fail=(error:string,status=400)=>NextResponse.json({success:false,error},{status});
async function current(){const s=await getServerSession(authOptions);return s?.user?.id&&mongoose.isValidObjectId(s.user.id)?s.user.id:null;}
export async function GET(){
 const uid=await current();if(!uid)return fail('Unauthorized',401);
 try{await dbConnect();const c=await Connection.findById(uid).select('calendarId calendarName lastSyncedAt connectedAt writeEnabled autoSync lastSyncError').lean();return NextResponse.json({success:true,data:{configured:Boolean(googleConfig()),connected:Boolean(c),calendarId:c?.calendarId||'',calendarName:c?.calendarName||'',lastSyncedAt:c?.lastSyncedAt||null,writeEnabled:Boolean(c?.writeEnabled),autoSync:Boolean(c?.autoSync),lastSyncError:c?.lastSyncError||''}},{headers:{'Cache-Control':'no-store'}});}catch{return fail('Calendar settings unavailable.',503);}
}
export async function POST(req:Request){
 const uid=await current();if(!uid)return fail('Unauthorized',401);
 const config=googleConfig();
 const origin=req.headers.get('origin');
 if(!origin||origin!==(config?.origin||new URL(req.url).origin))return fail('Invalid request origin',403);
 try{
 const body=await req.json();await dbConnect();
 const c=await Connection.findById(uid).select('+refreshToken').lean();
 if(body.action==='disconnect'){
   if(!c)return NextResponse.json({success:true});
   const removed=await Connection.deleteOne({_id:c._id,revision:c.revision,$or:[{syncLeaseUntil:{$exists:false}},{syncLeaseUntil:{$lt:new Date()}}]});
   if(!removed.deletedCount)return fail('Connection changed. Refresh and retry.',409);
   if(config)try{await fetch('https://oauth2.googleapis.com/revoke',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({token:unseal(c.refreshToken,uid+':refresh',config.key)}),signal:AbortSignal.timeout(8000)});}catch{}
   return NextResponse.json({success:true});
 }
 if(!config||!c)return fail('Connect Google Calendar first.',409);
 if(body.action==='list')return NextResponse.json({success:true,data:await calendars(await getAccess(config,uid,c.refreshToken))});
 if(body.action!=='sync')return fail('Unknown action');
 const calendarId=String(body.calendarId||c.calendarId||'');if(!calendarId||calendarId.length>1024)return fail('Choose your work calendar.');
 const data=await syncGoogle(uid,calendarId,body.writeEnabled===true,body.autoSync===true);
 return NextResponse.json({success:true,data});
 }catch(e){console.warn('Google calendar action failed');return fail(e instanceof Error?e.message:'Calendar request failed.',503);}
}
