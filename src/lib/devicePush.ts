import {createHash,randomUUID} from 'node:crypto';
import mongoose from 'mongoose';
import PushDevice from '@/models/PushDevice';
import Notification from '@/models/Notification';
import User from '@/models/User';
import {encryptPush,vapidAuthorization,validPushEndpoint,validPushKeys,type PushKeys} from '@/lib/webPushCrypto';
export const deviceId=(endpoint:string)=>createHash('sha256').update(endpoint).digest('hex');
export function pushConfig(){
 const privateKey=process.env.EMS_VAPID_PRIVATE_KEY,subject=process.env.EMS_VAPID_SUBJECT;
 if(!privateKey||!subject||!/^mailto:[^\s@]+@[^\s@]+$/.test(subject))return null;
 try{return {privateKey,subject,publicKey:vapidAuthorization('https://fcm.googleapis.com',privateKey,subject).publicKey};}catch{return null;}
}
export async function sendDevicePush(endpoint:string,keys:PushKeys,tag:string,test=false){
 const config=pushConfig();if(!config||!validPushEndpoint(endpoint)||!validPushKeys(keys))throw Error('Push configuration or device unavailable.');
 const payload=Buffer.from(JSON.stringify({title:'DreamShift EMS',body:test?'Your device notifications are working.':'You have a new work update. Open EMS to view it.',tag,path:'/notifications'}));
 const r=await fetch(endpoint,{method:'POST',redirect:'error',headers:{Authorization:vapidAuthorization(endpoint,config.privateKey,config.subject).authorization,'Content-Encoding':'aes128gcm','Content-Type':'application/octet-stream',TTL:'3600',Urgency:'normal'},body:new Uint8Array(encryptPush(payload,keys)),signal:AbortSignal.timeout(10000)});
 return r.status;
}
export async function dispatchDevice(id:string){
 if(!pushConfig())return false;
 const now=new Date(),leaseId=randomUUID();
 const device=await PushDevice.findOneAndUpdate({_id:id,$or:[{leaseUntil:{$exists:false}},{leaseUntil:{$lt:now}}]},{$set:{leaseId,leaseUntil:new Date(Date.now()+30000),lastAttemptAt:now}},{new:true}).select('+endpoint +keys').lean();
 if(!device)return false;
 const guard={_id:id,userId:device.userId,leaseId};
 try{
  const user=await User.findById(device.userId,{notificationPreferences:1,employmentStatus:1}).lean();
  if(!user||String(user.employmentStatus||'ACTIVE').toUpperCase()==='LEFT'){await PushDevice.deleteOne(guard);return false;}
  const prefs=user.notificationPreferences||{};
  const types=['system',...(prefs.taskReminders!==false?['assignment']:[]),...(prefs.deadlineAlerts!==false?['deadline']:[]),...(prefs.messageNotifications!==false?['mention']:[])];
  const floor=new Date(Math.max(device.lastDeliveredAt.getTime(),Date.now()-86400000));
  const newest=await Notification.collection.find({userId:device.userId,isRead:false,type:{$in:types},createdAt:{$gt:floor}},{projection:{createdAt:1}}).sort({createdAt:-1,_id:-1}).limit(1).next();
  if(!newest)return false;
  // Verify device ownership before delivery; only generic text leaves EMS.
  if(!await PushDevice.exists(guard))return false;
  const status=await sendDevicePush(device.endpoint,device.keys,String(newest._id));
  if(status===404||status===410){await PushDevice.deleteOne(guard);return false;}
  if(status<200||status>=300)throw Error('Push provider returned '+status);
  await PushDevice.updateOne(guard,{$max:{lastDeliveredAt:new Date(newest.createdAt)},$unset:{lastError:1}});return true;
 }catch{await PushDevice.updateOne(guard,{$set:{lastError:'Delivery failed. The next scheduled run will retry.'}});return false;}
 finally{await PushDevice.updateOne(guard,{$unset:{leaseId:1,leaseUntil:1}});}
}
export async function dispatchUserPush(uid:string){
 if(!pushConfig()||!mongoose.isValidObjectId(uid))return;
 const devices=await PushDevice.find({userId:uid}).select('_id').limit(8).lean();
 await Promise.all(devices.map(d=>dispatchDevice(d._id)));
}
export async function dispatchPushBatch(){
 if(!pushConfig())return {configured:false,checked:0,accepted:0};
 const devices=await PushDevice.find({$or:[{lastAttemptAt:{$exists:false}},{lastAttemptAt:{$lt:new Date(Date.now()-60000)}}]}).sort({lastAttemptAt:1}).limit(40).select('_id').lean();
 let accepted=0;for(let i=0;i<devices.length;i+=8){const result=await Promise.all(devices.slice(i,i+8).map(d=>dispatchDevice(d._id)));accepted+=result.filter(Boolean).length;}
 return {configured:true,checked:devices.length,accepted};
}
