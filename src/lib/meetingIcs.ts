export type MeetingEvent={_id:unknown;title:string;description?:string;meetingUrl?:string;startTime:Date|string;endTime:Date|string;createdAt?:Date|string};
const stamp=(d:Date|string)=>new Date(d).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
const escape=(s:string)=>s.replace(/\\/g,'\\\\').replace(/\r\n|\r|\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
function fold(line:string){
  const pieces:string[]=[];let part='',bytes=0;
  for(const ch of line){const size=Buffer.byteLength(ch);if(bytes+size>75){pieces.push(part);part=' ';bytes=1;}part+=ch;bytes+=size;}pieces.push(part);return pieces.join('\r\n');
}
export function meetingIcs(event:MeetingEvent){
  return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//DreamShift EMS//Meetings//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH','BEGIN:VEVENT',`UID:meeting-${event._id}@dreamshift-ems`,`DTSTAMP:${stamp(event.createdAt||new Date())}`,`DTSTART:${stamp(event.startTime)}`,`DTEND:${stamp(event.endTime)}`,`SUMMARY:${escape(event.title)}`,`DESCRIPTION:${escape([event.description,event.meetingUrl].filter(Boolean).join('\n'))}`,...(event.meetingUrl?[`URL:${event.meetingUrl}`]:[]),'STATUS:CONFIRMED','END:VEVENT','END:VCALENDAR'].map(fold).join('\r\n')+'\r\n';
}
