/** Logs contain route names, status and timings only, not user data or request bodies. */
export function monitored<T extends unknown[]>(route:string,handler:(...args:T)=>Promise<Response>){
  return async (...args:T):Promise<Response>=>{
    const start=performance.now();let status=500;
    try{const response=await handler(...args);status=response.status;const ms=Math.round(performance.now()-start);response.headers.append('Server-Timing',`app;dur=${ms}`);return response;}
    finally{console.info(JSON.stringify({event:'ems.http',route,status,durationMs:Math.round(performance.now()-start),timestamp:new Date().toISOString()}));}
  };
}
