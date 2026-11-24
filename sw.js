// Offline support. RULE: bump VERSION on every deploy that changes a file in SHELL (and bump ?v= in index.html).
// Audio clips go to a separate cache that survives app updates; bump MEDIA only if an existing clip is replaced in place.
const VERSION = 'sk-v1.0.0';
const MEDIA = 'sk-media-1';
const SHELL = ['./','index.html','css/app.css?v=1','js/app.js?v=1','js/content.js','js/grammar.js','js/session.js','js/store.js','js/audio.js',
  'js/sprites.js','manifest.webmanifest','assets/img/icon.svg','assets/img/icon-192.png','assets/audio/manifest.json','assets/audio/silence.mp3'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION && k !== MEDIA).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (/\.mp3$/.test(url.pathname) || /fonts\.(gstatic|googleapis)\.com/.test(url.host)){
    e.respondWith(caches.open(/\.mp3$/.test(url.pathname) ? MEDIA : VERSION).then(async c => { const hit = await c.match(req); if (hit) return hit;
      const res = await fetch(req); if (res.ok || res.type === 'opaque') c.put(req, res.clone()); return res; }));
    return;
  }
  if (url.origin === location.origin){ // network-first for app code so updates arrive quickly; cache when offline
    e.respondWith(fetch(req).then(res => { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); return res; })
      .catch(() => caches.match(req, { ignoreSearch: false }).then(r => r || caches.match(req, { ignoreSearch: true })).then(r => r || caches.match('index.html'))));
  }
});
