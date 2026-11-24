import {NextRequest,NextResponse} from 'next/server';
import {getServerSession} from 'next-auth';
import mongoose from 'mongoose';
import {randomUUID} from 'node:crypto';
import {authOptions} from '@/lib/auth';
import dbConnect from '@/lib/mongoose';
import {googleConfig,unseal,seal,exchange} from '@/lib/googleCalendar';
import Connection from '@/models/GoogleCalendarConnection';
export async function GET(req:NextRequest){
 const config=googleConfig();if(!config)return new NextResponse('Integration not configured',{status:503});
 const back=(status:string)=>{const r=NextResponse.redirect(config.origin+'/settings/google-calendar?connection='+status);r.cookies.set('ems_google_oauth','',{httpOnly:true,secure:config.origin.startsWith('https:'),sameSite:'lax',path:'/api/integrations/google-calendar/callback',maxAge:0});return r;};
 try{
 const session=await getServerSession(authOptions);const uid=session?.user?.id;if(!uid||!mongoose.isValidObjectId(uid))return back('unauthorized');
 const sealed=req.cookies.get('ems_google_oauth')?.value;if(!sealed)return back('expired');
 const state=JSON.parse(unseal(sealed,uid+':oauth',config.key)) as {state:string;verifier:string;expires:number};
 if(state.expires<Date.now()||state.state!==req.nextUrl.searchParams.get('state'))return back('expired');
 const code=req.nextUrl.searchParams.get('code');if(!code)return back('denied');
 const token=await exchange(config,{code,grant_type:'authorization_code',redirect_uri:config.redirectUri,code_verifier:state.verifier});
 const granted=new Set((token.scope||'').split(' '));
 if(!token.refresh_token||!granted.has('https://www.googleapis.com/auth/calendar.calendarlist.readonly')||!granted.has('https://www.googleapis.com/auth/calendar.events.readonly'))return back('permissions');
 await dbConnect();await Connection.replaceOne({_id:new mongoose.Types.ObjectId(uid)},{_id:new mongoose.Types.ObjectId(uid),refreshToken:seal(token.refresh_token,uid+':refresh',config.key),events:[],connectedAt:new Date(),revision:randomUUID()},{upsert:true});
 return back('connected');
 }catch{console.warn('Google calendar connection did not complete');return back('failed');}
}
