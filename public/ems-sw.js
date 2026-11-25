/* Keep sensitive EMS pages and API data out of service worker caches. */
self.addEventListener('install',event=>{event.waitUntil(self.skipWaiting());});
self.addEventListener('activate',event=>{event.waitUntil(self.clients.claim());});
self.addEventListener('fetch',event=>{
  if(event.request.mode!=='navigate'||event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
  event.respondWith(fetch(event.request).catch(()=>new Response('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DreamShift EMS offline</title><body style="background:#101319;color:#eee;font:16px system-ui;padding:32px"><h1>You are offline</h1><p>Reconnect to load your work. No private records are stored in the offline app cache.</p><button onclick="location.reload()" style="padding:12px">Try again</button></body></html>',{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'},status:503})));
});

self.addEventListener('push',event=>{
 let data={};try{data=event.data?.json()||{};}catch{}
 event.waitUntil(self.registration.showNotification('DreamShift EMS',{body:typeof data.body==='string'?data.body:'You have a new work update.',tag:typeof data.tag==='string'?data.tag:'ems-update',icon:'/app-icons/192',data:{path:'/notifications'}}));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 event.waitUntil((async()=>{const url=new URL('/notifications',self.location.origin).href;const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});const client=windows.find(c=>new URL(c.url).origin===self.location.origin);if(client){await client.navigate(url);return client.focus();}return self.clients.openWindow(url);})());
});
