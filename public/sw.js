// FestFlow Production Service Worker
// Version: 1.0.0 (Phase 9 PWA & Offline Support)

const CACHE_NAME = 'festflow-core-v1';
const OFFLINE_URL = '/offline.html';

const STATIC_PRECACHE = [
  '/',
  '/offline.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/favicon.png',
  '/festflow-logo.png',
];

// Install: Pre-cache core shell & offline fallback
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_PRECACHE);
    })
  );
  self.skipWaiting();
});

// Activate: Purge obsolete cache versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Strategy-based request routing
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Never intercept or cache non-GET requests (e.g. POST, PUT, DELETE)
  if (request.method !== 'GET') {
    return;
  }

  // 2. Strict Security: NEVER cache auth requests, payment submissions, or live Supabase API endpoints
  if (
    url.hostname.includes('supabase.co') ||
    url.pathname.includes('/auth/v1/') ||
    url.pathname.includes('/rest/v1/payment_submissions') ||
    url.pathname.includes('/rest/v1/rpc/')
  ) {
    // Network-only for live security/payment endpoints
    return;
  }

  // 3. Navigation requests (HTML pages): Network-first with offline.html fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => {
        return caches.match(request).then((cachedResponse) => {
          return cachedResponse || caches.match(OFFLINE_URL);
        });
      })
    );
    return;
  }

  // 4. Static assets (CSS, JS, WebFonts, images in /assets/*): Stale-While-Revalidate
  if (
    url.origin === self.location.origin &&
    (url.pathname.startsWith('/assets/') ||
      url.pathname.endsWith('.js') ||
      url.pathname.endsWith('.css') ||
      url.pathname.endsWith('.png') ||
      url.pathname.endsWith('.svg') ||
      url.pathname.endsWith('.webp'))
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(request).then((cachedResponse) => {
          const fetchPromise = fetch(request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(() => cachedResponse);

          return cachedResponse || fetchPromise;
        });
      })
    );
    return;
  }

  // Default: Network with Cache Fallback
  event.respondWith(
    caches.match(request).then((cached) => {
      return (
        cached ||
        fetch(request).catch(() => {
          // If offline and requesting an image, return transparent pixel fallback
          if (request.destination === 'image') {
            return new Response('', { headers: { 'Content-Type': 'image/svg+xml' } });
          }
        })
      );
    })
  );
});

// Update Listener: Support prompt-to-reload
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

