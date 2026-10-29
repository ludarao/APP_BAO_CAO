const CACHE = 'bao-cao-shell-v3';
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(cache => cache.add('/'))); self.skipWaiting(); });
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('message', event => {
  if (event.data?.type !== 'CACHE_ASSETS' || !Array.isArray(event.data.urls)) return;
  const urls = event.data.urls.filter(value => { try { const url = new URL(value, self.location.origin); return url.origin === self.location.origin && (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/fonts/') || url.pathname === '/icon.svg'); } catch { return false; } });
  event.waitUntil(caches.open(CACHE).then(cache => Promise.allSettled(urls.map(url => cache.add(url)))));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/') || url.searchParams.has('_rsc')) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).then(res => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(cache => cache.put('/', copy)); } return res; }).catch(() => caches.match('/')));
  } else if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/fonts/') || url.pathname === '/icon.svg') {
    event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(res => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(cache => cache.put(event.request, copy)); } return res; })));
  }
});
