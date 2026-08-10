// ═══════════════════════════════════════════════════════════
// StockOS Service Worker — Full Offline Cache
// Deploy this file at the ROOT of your Netlify site
// alongside index.html (or stockos-fixed-3.html)
// ═══════════════════════════════════════════════════════════

const CACHE_NAME = 'stockos-v2';

// All resources to pre-cache on install
const PRECACHE_URLS = [
  '/',
  '/index.html',
];

// ── Install: pre-cache the app shell ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return Promise.allSettled(
          PRECACHE_URLS.map(url =>
            fetch(url).then(res => {
              if(res.ok) cache.put(url, res);
            }).catch(() => {})
          )
        );
      })
      .then(() => self.skipWaiting())
  );
});

// ── Activate: delete old caches ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch: Cache-First with network fallback (offline-first) ──
self.addEventListener('fetch', event => {
  if(event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Skip non-same-origin requests (UPI, WhatsApp links, etc.)
  if(url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {

      // Serve from cache instantly if available (works offline)
      if(cachedResponse) {
        // Stale-while-revalidate: update cache in background
        fetch(event.request)
          .then(networkRes => {
            if(networkRes && networkRes.ok) {
              caches.open(CACHE_NAME)
                .then(cache => cache.put(event.request, networkRes.clone()));
            }
          })
          .catch(() => {}); // Ignore network errors — we have cache
        return cachedResponse;
      }

      // Not in cache — fetch from network and cache it
      return fetch(event.request)
        .then(networkRes => {
          if(networkRes && networkRes.ok) {
            const responseToCache = networkRes.clone();
            caches.open(CACHE_NAME)
              .then(cache => cache.put(event.request, responseToCache));
          }
          return networkRes;
        })
        .catch(() => {
          // Offline + not cached: return app shell for page navigations
          if(event.request.mode === 'navigate') {
            return caches.match('/') || caches.match('/index.html');
          }
        });
    })
  );
});
