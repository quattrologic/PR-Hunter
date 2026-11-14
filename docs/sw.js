// v4: updated light UI, cached shell and a network-first public catalog.
const CACHE = 'pr-hunter-ultimate-v6';
const SHELL = ['./', './index.html', './ultimate.css', './app.js', './ultimate-core.mjs', './participation.mjs', './manifest.webmanifest', './icon.svg'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))
  ).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  const isCatalog = new URL(req.url).pathname.endsWith('/opportunities.json');
  if (isCatalog) {
    event.respondWith(caches.open(CACHE).then(async cache => {
      try {
        const fresh = await fetch(req);
        if (!fresh.ok) throw Error('HTTP ' + fresh.status);
        await cache.put(req, fresh.clone());
        return fresh;
      } catch {
        return (await cache.match(req)) || Response.error();
      }
    }));
  } else {
    event.respondWith(caches.match(req).then(cached => cached || fetch(req)));
  }
});
