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
