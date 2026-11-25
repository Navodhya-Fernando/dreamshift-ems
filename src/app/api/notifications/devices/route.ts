import {NextResponse} from 'next/server';
import {getServerSession} from 'next-auth';
import mongoose from 'mongoose';
import {authOptions} from '@/lib/auth';
import dbConnect from '@/lib/mongoose';
import PushDevice from '@/models/PushDevice';
import {deviceId,pushConfig,sendDevicePush} from '@/lib/devicePush';
import {validPushEndpoint,validPushKeys} from '@/lib/webPushCrypto';
const fail=(error:string,status=400)=>NextResponse.json({success:false,error},{status});
async function current(){const s=await getServerSession(authOptions);return s?.user?.id&&mongoose.isValidObjectId(s.user.id)?new mongoose.Types.ObjectId(s.user.id):null;}
export async function GET(){
 const uid=await current();if(!uid)return fail('Unauthorized',401);
 try{await dbConnect();const devices=await PushDevice.find({userId:uid}).select('label createdAt lastDeliveredAt lastError').lean();return NextResponse.json({success:true,data:{publicKey:pushConfig()?.publicKey||null,devices}},{headers:{'Cache-Control':'no-store'}});}catch{return fail('Device settings unavailable',503);}
}
export async function POST(req:Request){
 const uid=await current();if(!uid)return fail('Unauthorized',401);
 const origin=req.headers.get('origin'),configured=process.env.APP_BASE_URL||process.env.NEXTAUTH_URL||new URL(req.url).origin;
 if(!origin||origin!==new URL(configured).origin)return fail('Invalid request origin',403);
 try{
 const body=await req.json(),action=String(body.action||'');await dbConnect();
 if(action==='remove'){if(typeof body.id!=='string'||!/^[a-f0-9]{64}$/.test(body.id))return fail('Invalid device ID');await PushDevice.deleteOne({_id:body.id,userId:uid});return NextResponse.json({success:true});}
 const endpoint=String(body.endpoint||body.subscription?.endpoint||'');if(!validPushEndpoint(endpoint))return fail('Unsupported push service.');
 const id=deviceId(endpoint);
 if(action==='disable'){await PushDevice.deleteOne({_id:id,userId:uid});return NextResponse.json({success:true});}
 if(!pushConfig())return fail('Device notifications are not configured.',503);
 if(action==='enable'){
  const keys={p256dh:String(body.subscription?.keys?.p256dh||''),auth:String(body.subscription?.keys?.auth||'')};if(!validPushKeys(keys))return fail('Invalid subscription keys.');
  const old=await PushDevice.findById(id).select('+keys').lean();
  if(old&&String(old.userId)!==String(uid)&&(old.keys.auth!==keys.auth||old.keys.p256dh!==keys.p256dh))return fail('Device subscription is already registered.',409);
  const count=await PushDevice.countDocuments({userId:uid,_id:{$ne:id}});if(count>=8)return fail('Remove an unused device first (maximum eight).');
  const now=new Date();await PushDevice.replaceOne({_id:id},{_id:id,userId:uid,endpoint,keys,label:String(body.label||'Browser').slice(0,100),createdAt:now,lastDeliveredAt:now},{upsert:true});return NextResponse.json({success:true,data:{id}});
 }
 if(action==='test'){
  const now=new Date();const device=await PushDevice.findOneAndUpdate({_id:id,userId:uid,$or:[{lastTestAt:{$exists:false}},{lastTestAt:{$lt:new Date(Date.now()-60000)}}]},{$set:{lastTestAt:now}},{new:true}).select('+endpoint +keys').lean();
  if(!device)return fail('Enable notifications or wait one minute before another test.',429);
  const status=await sendDevicePush(device.endpoint,device.keys,'ems-test',true);
  if(status===410||status===404){await PushDevice.deleteOne({_id:id,userId:uid});return fail('Subscription expired; enable notifications again.',409);}
  if(status<200||status>=300)return fail('Push provider rejected the test.',503);
  return NextResponse.json({success:true});
 }
 return fail('Unknown device action');
 }catch{console.warn('Device notification request failed');return fail('Device notification request failed.',503);}
}
