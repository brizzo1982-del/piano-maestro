// Funziona anche senza internet dopo la prima visita
const CACHE = 'piano-maestro-v1';
const FILES = ['./', 'index.html', 'css/style.css', 'manifest.json', 'icon.svg', 'icon-192.png', 'icon-512.png',
  'js/songs.js', 'js/audio.js', 'js/app.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  // cancella solo le vecchie cache di questa app (sullo stesso dominio ci sono altri giochi)
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k.startsWith('piano-maestro-v')).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then(r => {
    const copy = r.clone();
    if (r.ok || r.type === 'opaque') caches.open(CACHE).then(c => c.put(e.request, copy));
    return r;
  }).catch(() => caches.match(e.request).then(m => m || caches.match('index.html'))));
});
