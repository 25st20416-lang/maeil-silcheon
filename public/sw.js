const CACHE='practice-shell-v5';
const SHELL=['/','/install.js?v=settings-1','/enhancements.js?v=settings-1','/refinements.css?v=settings-1','/firebase-app.js?v=settings-1','/firebase-config.js','/manifest.webmanifest','/icon.png','/icon512.png','/apple-touch-icon.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('practice-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
 if(e.request.method!=='GET'||new URL(e.request.url).origin!==self.location.origin)return;
 const path=new URL(e.request.url).pathname;
 if(e.request.mode==='navigate'){e.respondWith(fetch(e.request).then(response=>{if(response.ok){const copy=response.clone();e.waitUntil(caches.open(CACHE).then(c=>c.put('/',copy)))}return response}).catch(()=>caches.match('/')));return}
 if(SHELL.some(asset=>new URL(asset,self.location.origin).pathname===path))e.respondWith(fetch(e.request).then(response=>{if(response.ok){const copy=response.clone();e.waitUntil(caches.open(CACHE).then(c=>c.put(e.request,copy)))}return response}).catch(()=>caches.match(e.request)));
});
self.addEventListener('push',event=>{let d={body:'오늘의 실천을 확인해 주세요.'};try{d=event.data.json()}catch{}event.waitUntil(self.registration.showNotification('매일실천',{body:d.body,tag:d.tag||'practice',icon:'/icon.png',badge:'/icon.png',data:{url:'/'}}))});
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(async list=>{for(const c of list){if(new URL(c.url).origin===self.location.origin){await c.focus();return}}return clients.openWindow('/')}))});
