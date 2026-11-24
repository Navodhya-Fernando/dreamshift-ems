export type SearchKind='all'|'tasks'|'projects'|'workspaces'|'meetings';
export function parseSearchQuery(input:string,now=new Date()){
  let text=input.trim().slice(0,160);
  let kind:SearchKind='all';
  const types:[RegExp,SearchKind][]=[[/\b(?:tasks?|assignments?)\b/i,'tasks'],[/\bprojects?\b/i,'projects'],[/\bworkspaces?\b/i,'workspaces'],[/\b(?:meetings?|appointments?)\b/i,'meetings']];
  for(const [re,k] of types)if(re.test(text)){kind=k;break;}
  const mine=/\b(?:my|assigned to me|for me)\b/i.test(text);
  const overdue=/\boverdue\b/i.test(text);
  const status=/\bblocked\b/i.test(text)?'BLOCKED':/\b(?:completed|done)\b/i.test(text)?'DONE':/\bin progress\b/i.test(text)?'IN_PROGRESS':null;
  const priority=/\b(urgent|high|medium|low)[ -]priority\b/i.exec(text)?.[1].toUpperCase()||null;
  let from:Date|null=null,to:Date|null=null;
  const day=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()));
  if(/\btomorrow\b/i.test(text)){from=new Date(day.getTime()+86400000);to=new Date(from.getTime()+86400000);}
  else if(/\btoday\b/i.test(text)){from=day;to=new Date(day.getTime()+86400000);}
  else if(/\bthis week\b/i.test(text)){from=new Date(day.getTime()-((day.getUTCDay()+6)%7)*86400000);to=new Date(from.getTime()+7*86400000);}
  const structured=kind!=='all'||mine||overdue||status!==null||priority!==null||from!==null;
  if(structured){
    text=text.replace(/\b(?:show|find|list|search for|all|my|assigned to me|for me|overdue|blocked|completed|done|in progress|(?:urgent|high|medium|low)[ -]priority|tomorrow|today|this week|due|in|the|tasks?|assignments?|projects?|workspaces?|meetings?|appointments?)\b/gi,' ').replace(/\s+/g,' ').trim();
    if(kind==='all'&&(overdue||status||priority))kind='tasks';
  }
  return {kind,mine,overdue,status,priority,from,to,terms:text.split(/\s+/).filter(Boolean).slice(0,8)};
}
export function escapeSearchTerm(value:string){return value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}
