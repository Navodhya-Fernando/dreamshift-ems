export function elapsedAt(seconds:number,runningSince:Date|string|null,now:Date|number=Date.now()){
return Math.max(0,Math.floor(seconds+(runningSince?Math.max(0,Number(now)-new Date(runningSince).getTime())/1000:0)));
}
