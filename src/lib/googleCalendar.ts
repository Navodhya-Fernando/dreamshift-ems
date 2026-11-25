import {createCipheriv,createDecipheriv,randomBytes,createHash} from 'node:crypto';
const scopes=['https://www.googleapis.com/auth/calendar.calendarlist.readonly','https://www.googleapis.com/auth/calendar.events'];
export function googleConfig(){
 const clientId=process.env.GOOGLE_CALENDAR_CLIENT_ID,clientSecret=process.env.GOOGLE_CALENDAR_CLIENT_SECRET,redirectUri=process.env.GOOGLE_CALENDAR_REDIRECT_URI,key=Buffer.from(process.env.GOOGLE_CALENDAR_TOKEN_KEY||'','base64');
 if(!clientId||!clientSecret||!redirectUri||key.length!==32)return null;
 try{const u=new URL(redirectUri);if(u.pathname!=='/api/integrations/google-calendar/callback'||u.search||u.hash||!(u.protocol==='https:'||(u.protocol==='http:'&&u.hostname==='localhost')))return null;return {clientId,clientSecret,redirectUri,key,origin:u.origin};}catch{return null;}
}
export function seal(value:string,aad:string,key:Buffer){
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(Buffer.from(aad));const ciphertext=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);return [iv,cipher.getAuthTag(),ciphertext].map(v=>v.toString('base64url')).join('.');
}
export function unseal(value:string,aad:string,key:Buffer){
 const parts=value.split('.').map(v=>Buffer.from(v,'base64url'));if(parts.length!==3||parts[0].length!==12||parts[1].length!==16)throw Error('Invalid encrypted value');
 const decipher=createDecipheriv('aes-256-gcm',key,parts[0]);decipher.setAAD(Buffer.from(aad));decipher.setAuthTag(parts[1]);return Buffer.concat([decipher.update(parts[2]),decipher.final()]).toString('utf8');
}
type Config=NonNullable<ReturnType<typeof googleConfig>>;
export function oauthStart(config:Config,uid:string){
 const state=randomBytes(32).toString('base64url'),verifier=randomBytes(48).toString('base64url');
 const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');
 url.search=new URLSearchParams({client_id:config.clientId,redirect_uri:config.redirectUri,response_type:'code',scope:scopes.join(' '),access_type:'offline',prompt:'consent select_account',state,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'}).toString();
 return {url:url.toString(),cookie:seal(JSON.stringify({state,verifier,expires:Date.now()+600000}),uid+':oauth',config.key)};
}
export async function exchange(config:Config,fields:Record<string,string>){
 const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:config.clientId,client_secret:config.clientSecret,...fields}),cache:'no-store',signal:AbortSignal.timeout(12000)});
 const token=await response.json() as {access_token?:string;refresh_token?:string;scope?:string;error?:string};
 if(!response.ok||!token.access_token)throw Error(token.error==='invalid_grant'?'Google authorization expired. Reconnect your calendar.':'Google authorization failed.');
 return token;
}
export async function getAccess(config:Config,uid:string,encryptedRefresh:string){
 return (await exchange(config,{grant_type:'refresh_token',refresh_token:unseal(encryptedRefresh,uid+':refresh',config.key)})).access_token!;
}
export type GoogleCalendarChoice={id:string;name:string;primary:boolean;accessRole:string};
export type ImportedCalendarEvent={id:string;managedId?:string;title:string;date:string;end:string;allDay:boolean;url?:string;};
async function googleGet<T>(path:string,params:Record<string,string>,token:string):Promise<T>{
 const url=new URL('https://www.googleapis.com/calendar/v3/'+path);url.search=new URLSearchParams(params).toString();
 const r=await fetch(url,{headers:{Authorization:'Bearer '+token},cache:'no-store',signal:AbortSignal.timeout(12000)});
 if(!r.ok)throw Error(r.status===401||r.status===403?'Google calendar access unavailable. Check consent or reconnect.':'Google Calendar request failed.');
 return await r.json() as T;
}
export async function calendars(token:string){
 const result:GoogleCalendarChoice[]=[];let pageToken='';
 for(let i=0;i<5;i++){
  const data=await googleGet<{items?:Array<{id?:string;summary?:string;summaryOverride?:string;primary?:boolean;accessRole?:string}>;nextPageToken?:string}>('users/me/calendarList',{maxResults:'250',...(pageToken?{pageToken}:{})},token);
  for(const item of data.items||[])if(item.id&&item.accessRole!=='freeBusyReader')result.push({id:item.id,name:item.summaryOverride||item.summary||'Calendar',primary:Boolean(item.primary),accessRole:item.accessRole||'reader'});
  if(!data.nextPageToken)return result;pageToken=data.nextPageToken;
 }
 throw Error('Too many calendars. Contact an administrator.');
}
export async function importEvents(token:string,calendarId:string,now=new Date()){
 const timeMin=new Date(now.getTime()-30*86400000).toISOString(),timeMax=new Date(now.getTime()+90*86400000).toISOString();
 const items:ImportedCalendarEvent[]=[];let pageToken='';
 for(let i=0;i<4;i++){
  const page=await googleGet<{items?:Array<{id?:string;summary?:string;start?:{date?:string;dateTime?:string};end?:{date?:string;dateTime?:string};status?:string;visibility?:string;htmlLink?:string;extendedProperties?:{private?:Record<string,string>}}>;nextPageToken?:string}>('calendars/'+encodeURIComponent(calendarId)+'/events',{timeMin,timeMax,singleEvents:'true',orderBy:'startTime',showDeleted:'false',maxResults:'250',fields:'nextPageToken,items(id,summary,start,end,status,visibility,htmlLink,extendedProperties)',...(pageToken?{pageToken}:{})},token);
  for(const event of page.items||[]){
   if(event.status==='cancelled'||!event.id||!event.start||!event.end)continue;
   const date=event.start.dateTime||event.start.date,end=event.end.dateTime||event.end.date;
   if(!date||!end||!Number.isFinite(Date.parse(date))||!Number.isFinite(Date.parse(end)))continue;
   const url=event.htmlLink?.startsWith('https://calendar.google.com/')?event.htmlLink:undefined;
   items.push({managedId:event.extendedProperties?.private?.emsEntity,id:'google-'+createHash('sha256').update(calendarId+':'+event.id).digest('hex').slice(0,24),title:event.visibility==='private'||event.visibility==='confidential'?'Busy':String(event.summary||'Calendar event').slice(0,200),date,end,allDay:Boolean(event.start.date),url});
   if(items.length>500)throw Error('This calendar exceeds the 500-event sync limit. Select a dedicated work calendar.');
  }
  if(!page.nextPageToken)return items;pageToken=page.nextPageToken;
 }
 throw Error('Calendar is too large to import safely.');
}

export type RemoteEvent={id:string;etag?:string;summary?:string;start?:{date?:string;dateTime?:string};end?:{date?:string;dateTime?:string};status?:string;attendees?:Array<{email?:string}>;hangoutLink?:string;conferenceData?:{createRequest?:{status?:{statusCode?:string}}};extendedProperties?:{private?:Record<string,string>}};
export async function managedEvents(token:string,calendarId:string,uid:string){
 const out:RemoteEvent[]=[];let pageToken='';
 for(let i=0;i<4;i++){const p=await googleGet<{items?:RemoteEvent[];nextPageToken?:string}>('calendars/'+encodeURIComponent(calendarId)+'/events',{privateExtendedProperty:'emsOwner='+uid,maxResults:'250',showDeleted:'true',...(pageToken?{pageToken}:{})},token);out.push(...p.items||[]);if(!p.nextPageToken)return out;pageToken=p.nextPageToken;}
 throw Error('Too many linked events. Use a smaller dedicated calendar.');
}
export async function writeEvent(token:string,calendarId:string,method:'POST'|'PATCH',body:Record<string,unknown>,event?:RemoteEvent){
 const url=new URL('https://www.googleapis.com/calendar/v3/calendars/'+encodeURIComponent(calendarId)+'/events'+(event?'/'+encodeURIComponent(event.id):''));url.searchParams.set('sendUpdates',event?.attendees?.length?'all':'none');
 url.searchParams.set('conferenceDataVersion','1');
 const r=await fetch(url,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',...(event?.etag?{'If-Match':event.etag}:{})},body:JSON.stringify(body),cache:'no-store',signal:AbortSignal.timeout(10000)});
 if(r.status===409||r.status===412)return false;
 if(!r.ok)throw Error('Google event write failed. Verify calendar write permission or reconnect.');
 return true;
}

export async function getGoogleEvent(token:string,calendarId:string,id:string):Promise<RemoteEvent|null>{
 const url='https://www.googleapis.com/calendar/v3/calendars/'+encodeURIComponent(calendarId)+'/events/'+encodeURIComponent(id);
 const r=await fetch(url,{headers:{Authorization:'Bearer '+token},cache:'no-store',signal:AbortSignal.timeout(12000)});
 if(r.status===404||r.status===410)return null;
 if(!r.ok)throw Error('Could not read the linked Google event.');
 return await r.json() as RemoteEvent;
}
export async function publishGoogleEvent(token:string,calendarId:string,body:Record<string,unknown>,existing?:RemoteEvent){
 const url=new URL('https://www.googleapis.com/calendar/v3/calendars/'+encodeURIComponent(calendarId)+'/events'+(existing?'/'+encodeURIComponent(existing.id):''));
 url.searchParams.set('sendUpdates','all');url.searchParams.set('conferenceDataVersion','1');
 const r=await fetch(url,{method:existing?'PATCH':'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',...(existing?.etag?{'If-Match':existing.etag}:{})},body:JSON.stringify(body),cache:'no-store',signal:AbortSignal.timeout(15000)});
 if(r.status===409||r.status===412)throw Error('Calendar event changed. Sync and retry.');
 if(!r.ok)throw Error('Google could not publish the meeting. Verify calendar permissions and Google Meet availability.');
 return await r.json() as RemoteEvent;
}
