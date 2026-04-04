/*!
 * Crawford Coaching Interval Timer – Service Worker
 * © 2026 Scott Crawford – Crawford Coaching
 * https://crawfordcoaching.ca
 */
const CACHE_NAME = 'crawford-timer-v1';
const ASSETS = [
  './crawford-timer.html',
  './timer-emom-db.js',
  './timer-manifest.json',
  './timer-brand.png',
  './timer-favicon.png',
  './timer-icon-192.png',
  './timer-icon-512.png'
];

// Install: pre-cache core assets
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS).catch(() => {
        // If any icon is missing, cache what we can
        return Promise.allSettled(ASSETS.map((url) => cache.add(url)));
      });
    })
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: network-first with cache fallback (keeps content fresh)
self.addEventListener('fetch', (e) => {
  e.respondWith(
    fetch(e.request)
      .then((response) => {
        // Cache a copy of successful responses
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(e.request))
  );
});
