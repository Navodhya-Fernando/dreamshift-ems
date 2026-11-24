"use client";
import {createContext,useCallback,useContext,useEffect,useRef,useState} from 'react';
import {useSession} from 'next-auth/react';
import {elapsedAt} from '@/lib/timerMath';
export type ActiveTimer={sessionId:string;taskId:string;taskTitle:string;note:string;startedAt:string;runningSince:string|null;elapsedSeconds:number;revision:number};
type Action='start'|'pause'|'resume'|'stop';
type Context={timer:ActiveTimer|null;ready:boolean;busy:boolean;error:string;clockOffset:number;act:(action:Action,taskId?:string,note?:string)=>Promise<boolean>;refresh:()=>Promise<void>};
const C=createContext<Context|null>(null);
export function useTimer(){const c=useContext(C);if(!c)throw Error('Timer provider missing');return c;}
export default function TimerProvider({children}:{children:React.ReactNode}){
const {data:session,status}=useSession();const uid=session?.user?.id;
const [timer,setTimer]=useState<ActiveTimer|null>(null),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[clockOffset,setClockOffset]=useState(0);
const generation=useRef(0),locked=useRef(false),owner=useRef<string|undefined>(undefined),active=useRef<ActiveTimer|null>(null);
const accept=(j:{data:ActiveTimer|null;serverNow:number})=>{active.current=j.data;setTimer(j.data);setClockOffset(j.serverNow-Date.now());setReady(true);setError('');};
const refresh=useCallback(async()=>{if(!uid||status!=='authenticated'||locked.current||document.hidden)return;const version=++generation.current;try{const r=await fetch('/api/time/timer',{cache:'no-store'});const j=await r.json();if(!r.ok||!j.success)throw Error(j.error||'Could not load timer');if(version===generation.current)accept(j);}catch(e){if(version===generation.current)setError(e instanceof Error?e.message:'Could not load timer');}},[uid,status]);
useEffect(()=>{owner.current=uid;generation.current++;locked.current=false;active.current=null;setTimer(null);setReady(false);setBusy(false);setError('');void refresh();const tick=window.setInterval(()=>void refresh(),30000);const focus=()=>void refresh();window.addEventListener('focus',focus);document.addEventListener('visibilitychange',focus);return()=>{generation.current++;window.clearInterval(tick);window.removeEventListener('focus',focus);document.removeEventListener('visibilitychange',focus);};},[uid,refresh]);
const act=useCallback(async(action:Action,taskId?:string,note?:string)=>{
if(!uid||owner.current!==uid||locked.current)return false;
locked.current=true;const version=++generation.current;setBusy(true);setError('');
let ok=false,conflict=false;
try{const current=active.current;const r=await fetch('/api/time/timer',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,taskId,note,sessionId:current?.sessionId,revision:current?.revision})});const j=await r.json();if(!r.ok||!j.success){conflict=r.status===409;throw Error(j.error||'Timer change failed');}if(version===generation.current){accept(j);ok=true;if(action==='stop')window.dispatchEvent(new Event('dreamshift:refresh-all'));}}catch(e){if(version===generation.current)setError(e instanceof Error?e.message:'Timer change failed');}finally{if(owner.current===uid){locked.current=false;setBusy(false);if(conflict)void refresh();}}
return ok;
},[uid,refresh]);
return <C.Provider value={{timer:owner.current===uid?timer:null,ready:ready&&owner.current===uid,busy,error,clockOffset,act,refresh}}>{children}</C.Provider>;
}
export function TimerClock({className}:{className?:string}){
const {timer,clockOffset}=useTimer();const [now,setNow]=useState(()=>Date.now());useEffect(()=>{setNow(Date.now());if(!timer?.runningSince)return;const id=window.setInterval(()=>{if(!document.hidden)setNow(Date.now());},1000);const wake=()=>setNow(Date.now());document.addEventListener('visibilitychange',wake);return()=>{window.clearInterval(id);document.removeEventListener('visibilitychange',wake);};},[timer?.runningSince]);
const sec=timer?elapsedAt(timer.elapsedSeconds,timer.runningSince,now+clockOffset):0;
return <span className={className} style={{fontVariantNumeric:'tabular-nums'}}>{[Math.floor(sec/3600),Math.floor(sec%3600/60),sec%60].map(n=>String(n).padStart(2,'0')).join(':')}</span>;
}
