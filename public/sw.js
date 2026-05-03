/**
 * Service Worker: cache static shell, but never return HTML for API requests.
 */
const STATIC_CACHE = 'bd-static-v7';
const PRECACHE = [
  '/',
  '/index.html',
  '/css/style.css',
  '/manifest.json',
  '/assets/favicon.svg',
  '/js/main.js',
  '/js/config.js',
  '/js/api.js',
  '/js/events.js',
  '/js/ui.js',
  '/js/storage.js',
  '/js/utils.js',
  '/public_api_data.json',
  '/public_standings_data.json',
];

function buildApiErrorResponse() {
  return new Response(
    JSON.stringify({
      ok: false,
      response: [],
      results: 0,
      paging: { current: 1, total: 1 },
      errors: {
        message: 'Khong the ket noi API',
      },
    }),
    {
      status: 503,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
    }
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => Promise.all(PRECACHE.map((url) => cache.add(url).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((key) => (key !== STATIC_CACHE ? caches.delete(key) : null))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(request).catch(() => buildApiErrorResponse()));
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && url.origin === self.location.origin && !url.pathname.endsWith('.map')) {
          const copy = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        return caches.match('/index.html');
      })
  );
});
