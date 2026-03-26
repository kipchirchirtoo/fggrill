// Service Worker for Famous Gates Hotels
const CACHE_NAME = 'fg-hotels-cache-v4';
const DB_NAME = 'fg-hotels-offline-v3';
const DB_VERSION = 1;

// Resources to cache immediately
const STATIC_RESOURCES = [
  '/',
  '/manifest.json',
  '/fglogo.png',
  '/offline.html',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching static resources');
      return cache.addAll(STATIC_RESOURCES);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((name) => {
            if (name !== CACHE_NAME) {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            }
          })
        );
      })
    ])
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
 
  // Skip non-http(s) requests (e.g., chrome-extension://, about:blank, etc.)
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // BYPASS CACHE for navigation requests to ensure latest code in development
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => {
        return caches.match('/offline.html').then(response => {
           return response || new Response('Offline - please check your connection', { 
             status: 503, 
             headers: { 'Content-Type': 'text/html' } 
           });
        });
      })
    );
    return;
  }

  // API and RSC handling
  if (url.pathname.startsWith('/api/') || url.searchParams.has('_rsc')) {
    event.respondWith(fetch(request).catch(() => {
        return new Response(JSON.stringify({ error: 'Offline' }), { status: 503, headers: { 'Content-Type': 'application/json' } });
    }));
    return;
  }

  // Static assets - Cache first
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      return cachedResponse || fetch(request).then((response) => {
          if (response.ok && request.method === 'GET') {
              const resClone = response.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(request, resClone));
          }
          return response;
      }).catch(err => {
          console.warn('[SW] Fetch failed for:', request.url, err);
          // Return a generic error response for non-navigation requests
          return new Response('Network error', { status: 408 });
      });
    })
  );
});

console.log('[SW] Service Worker v3 loaded');
