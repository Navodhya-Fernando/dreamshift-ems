import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTaskCsv,parseTaskDate } from '../src/lib/taskCsv.ts';
import { nextOccurrence,dueOccurrences,utcDay } from '../src/lib/recurrence.ts';
import { meetingIcs } from '../src/lib/meetingIcs.ts';
import { monitored } from '../src/lib/routeTelemetry.ts';

test('CSV parses BOM, quoted commas, newlines and escaped quotes',()=>{
  const rows=parseTaskCsv('\uFEFFtitle,description,priority\r\n"Review, CV","Line one\nLine ""two""",HIGH\r\n');
  assert.deepEqual(rows,[{title:'Review, CV',description:'Line one\nLine "two"',priority:'HIGH'}]);
});
test('CSV rejects invalid quoting, wrong columns, duplicates and excess rows',()=>{
  for(const s of ['title,title\na,b','title,unknown\na,b','title,description\na','title\n"unterminated','title\n'+Array.from({length:201},(_,i)=>'Task '+i).join('\n')])assert.throws(()=>parseTaskCsv(s));
});
test('strict calendar date parsing',()=>{
  assert.equal(parseTaskDate('2028-02-29').toISOString(),'2028-02-29T00:00:00.000Z');
  assert.throws(()=>parseTaskDate('2027-02-29'));assert.throws(()=>parseTaskDate('2026-11-31'));assert.equal(parseTaskDate(''),undefined);
});
test('monthly recurrence preserves original day across short months',()=>{
  const feb=nextOccurrence(new Date('2028-01-31T00:00:00Z'),'MONTHLY',31);
  assert.equal(feb.toISOString().slice(0,10),'2028-02-29');
  assert.equal(nextOccurrence(feb,'MONTHLY',31).toISOString().slice(0,10),'2028-03-31');
});
test('daily and weekly recurrence are UTC anchored and catchup is bounded',()=>{
  const today=utcDay(new Date('2026-11-24T22:31:00Z'));
  const {dates,next}=dueOccurrences(new Date('2026-11-19T00:00:00Z'),'DAILY',19,today,3);
  assert.equal(dates.length,3);assert.equal(next.toISOString().slice(0,10),'2026-11-22');
  assert.equal(nextOccurrence(today,'WEEKLY',24).toISOString().slice(0,10),'2026-12-01');
});
test('calendar event escapes injected lines and folds UTF-8',()=>{
  const ics=meetingIcs({_id:'1',title:'Meeting\r\nBEGIN:VEVENT;,'+'é'.repeat(100),startTime:'2026-11-24T10:00:00Z',endTime:'2026-11-24T10:30:00Z',createdAt:'2026-11-23T00:00:00Z'});
  assert.equal(ics.split('\r\n').filter(l=>l==='BEGIN:VEVENT').length,1);
  assert.match(ics,/DTSTART:20261124T100000Z/);
  assert.ok(ics.split('\r\n').every(l=>Buffer.byteLength(l)<=75));
});
test('telemetry preserves HTTP status and adds server timing',async()=>{
  const handler=monitored('test',async()=>new Response('ok',{status:201}));
  const response=await handler();assert.equal(response.status,201);assert.match(response.headers.get('server-timing'),/app;dur=\d+/);
});

import { roleAllows,canAssignPlatformRole,normalizePlatformRole } from '../src/lib/roles.ts';
test('legacy role aliases normalize without granting unknown roles privileges',()=>{
  assert.equal(normalizePlatformRole('Admin'),'ADMIN');
  assert.equal(normalizePlatformRole('administrator'),'ADMIN');
  assert.equal(normalizePlatformRole('unknown'),'EMPLOYEE');
});
test('workspace administrators cannot manage company accounts or monitoring',()=>{
  assert.equal(roleAllows('WORKSPACE','ADMIN','workspace.members.manage'),true);
  assert.equal(roleAllows('WORKSPACE','OWNER','company.monitor'),false);
  assert.equal(roleAllows('PLATFORM','WORKSPACE_ADMIN','company.users.manage'),false);
  assert.equal(roleAllows('PLATFORM','ADMIN','company.users.manage'),true);
});
test('owner roles cannot be granted or modified by ordinary admins',()=>{
  assert.equal(canAssignPlatformRole('ADMIN','EMPLOYEE','OWNER'),false);
  assert.equal(canAssignPlatformRole('ADMIN','OWNER','EMPLOYEE'),false);
  assert.equal(canAssignPlatformRole('OWNER','EMPLOYEE','ADMIN'),true);
  assert.equal(canAssignPlatformRole('WORKSPACE_ADMIN','EMPLOYEE','EMPLOYEE'),false);
});

import {parseSearchQuery,escapeSearchTerm} from '../src/lib/searchQuery.ts';
test('natural language search parses assigned overdue tasks',()=>{const q=parseSearchQuery('Show my overdue marketing tasks');assert.equal(q.kind,'tasks');assert.equal(q.mine,true);assert.equal(q.overdue,true);assert.deepEqual(q.terms,['marketing']);});
test('calendar search handles tomorrow and escapes regex literals',()=>{const q=parseSearchQuery('Show my meetings tomorrow',new Date('2026-11-24T12:00:00Z'));assert.equal(q.kind,'meetings');assert.equal(q.from.toISOString(),'2026-11-25T00:00:00.000Z');assert.equal(q.terms.length,0);assert.equal(new RegExp(escapeSearchTerm('a+b')).test('a+b'),true);assert.equal(new RegExp(escapeSearchTerm('a+b')).test('aaab'),false);});

import {elapsedAt} from '../src/lib/timerMath.ts';
test('server timer counts only running segments, ignores paused wall time',()=>{assert.equal(elapsedAt(60,null,Date.parse('2026-11-24T12:00:00Z')),60);assert.equal(elapsedAt(60,'2026-11-24T12:00:00Z',Date.parse('2026-11-24T12:01:30Z')),150);assert.equal(elapsedAt(60,'2026-11-24T12:00:00Z',Date.parse('2026-11-24T11:59:59Z')),60);});

test('weekday recurrence skips weekends',()=>{const friday=new Date('2026-11-27T00:00:00Z');assert.equal(nextOccurrence(friday,'WEEKDAYS',27).toISOString().slice(0,10),'2026-11-30');});

import {fingerprint,syncDecision,dayAfter} from '../src/lib/calendarSyncPolicy.ts';
test('calendar reconciliation distinguishes local, remote and conflicting edits',()=>{const a={title:'Task',start:'2026-11-25',end:'2026-11-26',allDay:true},b={...a,start:'2026-11-26',end:'2026-11-27'},d={...a,title:'Changed'};assert.equal(syncDecision(fingerprint(a),a,b),'pull');assert.equal(syncDecision(fingerprint(a),b,a),'push');assert.equal(syncDecision(fingerprint(a),b,d),'conflict');assert.equal(syncDecision(fingerprint(a),a,a),'unchanged');assert.equal(dayAfter('2026-12-31'),'2027-01-01');});

import {createECDH,createDecipheriv,hkdfSync,randomBytes,createPublicKey,verify} from 'node:crypto';
import {encryptPush,vapidAuthorization,validPushEndpoint} from '../src/lib/webPushCrypto.ts';
test('encrypted push payload round-trips with recipient keys',()=>{const e=createECDH('prime256v1');e.generateKeys();const receiver=e.getPublicKey(),auth=randomBytes(16);const body=encryptPush(Buffer.from('hello'),{p256dh:receiver.toString('base64url'),auth:auth.toString('base64url')});const salt=body.subarray(0,16),sender=body.subarray(21,21+body[20]),encrypted=body.subarray(21+body[20]);const hk=(s,a,i,n)=>Buffer.from(hkdfSync('sha256',s,a,i,n));const ikm=hk(e.computeSecret(sender),auth,Buffer.concat([Buffer.from('WebPush: info\0'),receiver,sender]),32);const cipher=createDecipheriv('aes-128-gcm',hk(ikm,salt,Buffer.from('Content-Encoding: aes128gcm\0'),16),hk(ikm,salt,Buffer.from('Content-Encoding: nonce\0'),12));cipher.setAuthTag(encrypted.subarray(-16));assert.deepEqual(Buffer.concat([cipher.update(encrypted.subarray(0,-16)),cipher.final()]),Buffer.from('hello\x02'));});
test('VAPID uses a verifiable P-256 signature and rejects untrusted push endpoints',()=>{const e=createECDH('prime256v1');e.generateKeys();const d=e.getPrivateKey();const padded=Buffer.concat([Buffer.alloc(32-d.length),d]);const result=vapidAuthorization('https://fcm.googleapis.com/fcm/send/test',padded.toString('base64url'),'mailto:admin@example.org');const jwt=result.authorization.split('t=')[1].split(',')[0];const [header,claims,sig]=jwt.split('.'),p=Buffer.from(result.publicKey,'base64url');const publicKey=createPublicKey({format:'jwk',key:{kty:'EC',crv:'P-256',x:p.subarray(1,33).toString('base64url'),y:p.subarray(33).toString('base64url')}});assert.equal(verify('sha256',Buffer.from(header+'.'+claims),{key:publicKey,dsaEncoding:'ieee-p1363'},Buffer.from(sig,'base64url')),true);assert.equal(validPushEndpoint('https://fcm.googleapis.com.evil.example/push'),false);assert.equal(validPushEndpoint('https://127.0.0.1/push'),false);assert.equal(validPushEndpoint('https://web.push.apple.com/push'),true);});
