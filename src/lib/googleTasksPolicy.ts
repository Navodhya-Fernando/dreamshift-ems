export type TaskSnapshot={title:string;due:string|null;completed:boolean};
export const taskFingerprint=(s:TaskSnapshot)=>JSON.stringify([s.title,s.due,s.completed]);
export function taskDecision(base:string,local:TaskSnapshot,remote:TaskSnapshot){
 const a=taskFingerprint(local),b=taskFingerprint(remote);
 if(a===b)return a===base?'same':'acknowledge';
 if(a===base)return 'pull';if(b===base)return 'push';return 'conflict';
}
export function taskDate(v:unknown){if(!v)return null;const d=new Date(String(v));return Number.isFinite(d.getTime())?d.toISOString().slice(0,10):null;}
export function taskStatus(v:unknown){return String(v||'TODO').trim().toUpperCase().replace(/\s+/g,'_');}
export const doneStatus=(v:unknown)=>['DONE','COMPLETED'].includes(taskStatus(v));
