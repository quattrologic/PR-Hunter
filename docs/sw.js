// Phase 7: cache only PR-Hunter's assets and use an offline-safe navigation fallback.
const CACHE_PREFIX = 'pr-hunter-ultimate-';
const CACHE = CACHE_PREFIX + 'v12';
const SHELL = [
  './', './index.html', './ultimate.css', './app.js', './ultimate-core.mjs',
  './participation.mjs', './phase4-core.mjs', './integrations.mjs',
  './phase6-core.mjs', './phase7-core.mjs', './auto-hunter-core.mjs', './free-products.mjs', './manifest.webmanifest', './icon.svg'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE).map(key => caches.delete(key)))
  ).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    event.respondWith(caches.open(CACHE).then(async cache => {
      try {
        const response = await fetch(req);
        if (!response.ok) throw Error('HTTP ' + response.status);
        await cache.put('./index.html', response.clone());
        return response;
      } catch {
        return (await cache.match('./index.html')) || (await cache.match('./')) || Response.error();
      }
    }));
    return;
  }
  if (['opportunities.json','auto-hunter.json','free-products-report.json'].some(file => url.pathname.endsWith('/'+file))) {
    event.respondWith(caches.open(CACHE).then(async cache => {
      try {
        const response = await fetch(req);
        if (!response.ok) throw Error('HTTP ' + response.status);
        await cache.put(req, response.clone());
        return response;
      } catch {
        return (await cache.match(req)) || Response.error();
      }
    }));
    return;
  }
  event.respondWith(caches.match(req).then(cached => cached || fetch(req)));
});
