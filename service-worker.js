const CACHE_NAME = 'atm-locator';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/manifest.json',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
];

const DATA_CACHE = 'atm-data-v2';
const TILE_CACHE = 'map-tiles-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      for (const url of STATIC_ASSETS) {
        try {
          const response = await fetch(url);
          if (response.ok) {
            await cache.put(url, response);
          }
        } catch (e) {
          console.warn(`Failed to cache: ${url}`, e);
        }
      }
      return self.skipWaiting();
    }),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter(
              (name) =>
                name !== CACHE_NAME &&
                name !== DATA_CACHE &&
                name !== TILE_CACHE,
            )
            .map((name) => caches.delete(name)),
        );
      })
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Handle JSON data files
  if (request.url.includes('data/') && request.url.endsWith('.json')) {
    event.respondWith(
      caches
        .open(DATA_CACHE)
        .then(async (cache) => {
          try {
            const response = await fetch(request);
            if (response.ok && request.method === 'GET') {
              const responseClone = response.clone();
              cache.put(request, responseClone);
            }
            return response;
          } catch (e) {
            const cached = await cache.match(request);
            if (cached) return cached;
            throw e;
          }
        })
        .catch(
          () =>
            new Response(JSON.stringify({ error: 'Offline' }), {
              headers: { 'Content-Type': 'application/json' },
            }),
        ),
    );
    return;
  }

  // Handle map tiles
  if (request.destination === 'image' && url.hostname.includes('tile')) {
    event.respondWith(
      caches.open(TILE_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;

        try {
          const response = await fetch(request);
          if (response.ok) {
            const responseClone = response.clone();
            cache.put(request, responseClone);
          }
          return response;
        } catch (e) {
          return new Response('', { status: 404 });
        }
      }),
    );
    return;
  }

  // Default: network first, then cache
  event.respondWith(fetch(request).catch(() => caches.match(request)));
});
