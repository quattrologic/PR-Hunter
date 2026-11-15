// Phase 7: cache only PR-Hunter's assets and use an offline-safe navigation fallback.
const CACHE_PREFIX = 'pr-hunter-ultimate-';
const CACHE = CACHE_PREFIX + 'v18';
const SHELL = [
  './', './index.html', './ultimate.css', './instagram-white.css', './app.js', './ultimate-core.mjs',
  './participation.mjs', './phase4-core.mjs', './integrations.mjs',
  './phase6-core.mjs', './phase7-core.mjs', './auto-hunter-core.mjs', './free-products.mjs', './dm-assistant.mjs', './brand-offers.mjs', './discovery-grid.mjs', './instagram-brand-core.mjs', './manifest.webmanifest', './icon.svg'
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
  if (['opportunities.json','auto-hunter.json','free-products-report.json','instagram-reels.json'].some(file => url.pathname.endsWith('/'+file))) {
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
  // Prefer fresh UI assets while online: stale cache-first CSS/JS previously
  // left iPad users with old cards and apparently non-responsive filters.
  event.respondWith(caches.open(CACHE).then(async cache => {
    try {
      const response=await fetch(req);
      if(!response.ok)throw Error('HTTP '+response.status);
      await cache.put(req,response.clone());
      return response;
    } catch {
      return (await cache.match(req)) || Response.error();
    }
  }));
});
