const STATIC_CACHE = 'dnet-static-v3';
const TILE_CACHE = 'dnet-tiles-v1';

const CORE_ASSETS = [
  './',
  './index.html',
  './css/styles.css',
  './js/app.js',
  './family-search.html',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      const keep = new Set([STATIC_CACHE, TILE_CACHE]);
      return Promise.all(keys.map((key) => {
        if (!keep.has(key)) return caches.delete(key);
        return Promise.resolve();
      }));
    }).then(() => self.clients.claim())
  );
});

function isTileRequest(url) {
  return url.origin.includes('openstreetmap.org') && url.pathname.includes('/tile') ||
    url.hostname === 'tile.openstreetmap.org';
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const requestUrl = new URL(event.request.url);

  if (isTileRequest(requestUrl)) {
    event.respondWith(
      caches.open(TILE_CACHE).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        try {
          const network = await fetch(event.request);
          if (network && (network.ok || network.type === 'opaque')) {
            cache.put(event.request, network.clone());
          }
          return network;
        } catch (e) {
          return new Response('', { status: 503, statusText: 'Offline tile unavailable' });
        }
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(async (cached) => {
      if (cached) return cached;
      try {
        const network = await fetch(event.request);
        if (network && network.ok && requestUrl.origin === self.location.origin) {
          const cache = await caches.open(STATIC_CACHE);
          cache.put(event.request, network.clone());
        }
        return network;
      } catch (e) {
        if (event.request.mode === 'navigate') {
          const fallback = await caches.match('./index.html');
          if (fallback) return fallback;
        }
        return new Response('Offline', { status: 503, statusText: 'Offline' });
      }
    })
  );
});

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type !== 'prefetch-tiles' || !Array.isArray(data.urls)) return;

  event.waitUntil((async () => {
    const cache = await caches.open(TILE_CACHE);
    let cachedCount = 0;

    for (const url of data.urls) {
      try {
        const request = new Request(url, { mode: 'no-cors' });
        const existing = await cache.match(request);
        if (existing) {
          cachedCount += 1;
          continue;
        }
        const response = await fetch(request);
        if (response && (response.ok || response.type === 'opaque')) {
          await cache.put(request, response.clone());
          cachedCount += 1;
        }
      } catch (e) {
        // Ignore per-tile failures and continue.
      }
    }

    const clients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
    clients.forEach((client) => {
      client.postMessage({ type: 'tiles-prefetch-done', count: cachedCount });
    });
  })());
});
