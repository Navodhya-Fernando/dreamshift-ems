export type Schedule={title:string;start:string;end:string;allDay:boolean};
export function fingerprint(s:Schedule){return JSON.stringify([s.title,s.start,s.end,s.allDay]);}
export function syncDecision(base:string|undefined,local:Schedule,remote:Schedule){
 const a=fingerprint(local),b=fingerprint(remote);
 if(a===b)return base===a?'unchanged':'acknowledge';
 if(!base)return 'conflict';
 if(a===base)return 'pull';
 if(b===base)return 'push';
 return 'conflict';
}
export function dayAfter(day:string){return new Date(Date.parse(day+'T00:00:00Z')+86400000).toISOString().slice(0,10);}
