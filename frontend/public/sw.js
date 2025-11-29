// Service Worker for Famous Gate Housekeeping PWA
const CACHE_NAME = 'fg-housekeeping-v1';
const OFFLINE_URL = '/offline.html';

// Resources to cache immediately
const STATIC_RESOURCES = [
  '/',
  '/dashboard/housekeeping',
  '/offline.html',
  '/manifest.json',
];

// API endpoints to cache for offline use
const API_CACHE_NAME = 'fg-housekeeping-api-v1';
const CACHEABLE_API_ROUTES = [
  '/api/housekeeping/dashboard',
  '/api/housekeeping/tasks',
  '/api/housekeeping/rooms',
  '/api/housekeeping/staff',
];

// Install event - cache static resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching static resources');
      return cache.addAll(STATIC_RESOURCES);
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== API_CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Handle API requests
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(request));
    return;
  }

  // Handle navigation requests
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigationRequest(request));
    return;
  }

  // Handle static resources - cache first, then network
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(request).then((response) => {
        // Don't cache non-successful responses
        if (!response || response.status !== 200) {
          return response;
        }
        // Cache successful responses
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseToCache);
        });
        return response;
      });
    })
  );
});

// Handle API requests with network-first strategy
async function handleApiRequest(request) {
  const url = new URL(request.url);
  
  // For GET requests, try network first, then cache
  if (request.method === 'GET') {
    try {
      const networkResponse = await fetch(request);
      
      // Cache successful responses
      if (networkResponse.ok) {
        const cache = await caches.open(API_CACHE_NAME);
        cache.put(request, networkResponse.clone());
      }
      
      return networkResponse;
    } catch (error) {
      // Network failed, try cache
      const cachedResponse = await caches.match(request);
      if (cachedResponse) {
        console.log('[SW] Serving API from cache:', url.pathname);
        return cachedResponse;
      }
      
      // Return offline response
      return new Response(
        JSON.stringify({ error: 'Offline', cached: false }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }
  
  // For POST/PUT/DELETE requests, queue if offline
  if (['POST', 'PUT', 'DELETE'].includes(request.method)) {
    try {
      return await fetch(request);
    } catch (error) {
      // Queue the request for later sync
      await queueRequest(request);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          queued: true, 
          message: 'Request queued for sync when online' 
        }),
        { status: 202, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }
  
  return fetch(request);
}

// Handle navigation requests
async function handleNavigationRequest(request) {
  try {
    const networkResponse = await fetch(request);
    return networkResponse;
  } catch (error) {
    // Try to serve from cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Serve offline page
    const offlineResponse = await caches.match(OFFLINE_URL);
    if (offlineResponse) {
      return offlineResponse;
    }
    
    // Fallback offline response
    return new Response(
      '<html><body><h1>Offline</h1><p>Please check your connection.</p></body></html>',
      { headers: { 'Content-Type': 'text/html' } }
    );
  }
}

// Queue requests for background sync
async function queueRequest(request) {
  const db = await openIndexedDB();
  const requestData = {
    url: request.url,
    method: request.method,
    headers: Object.fromEntries(request.headers.entries()),
    body: await request.text(),
    timestamp: Date.now()
  };
  
  const tx = db.transaction('pending-requests', 'readwrite');
  const store = tx.objectStore('pending-requests');
  await store.add(requestData);
  
  // Register for background sync
  if ('sync' in self.registration) {
    await self.registration.sync.register('sync-pending-requests');
  }
}

// Open IndexedDB for offline storage
function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('fg-housekeeping-offline', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Store for pending requests
      if (!db.objectStoreNames.contains('pending-requests')) {
        db.createObjectStore('pending-requests', { keyPath: 'timestamp' });
      }
      
      // Store for offline data
      if (!db.objectStoreNames.contains('offline-data')) {
        const store = db.createObjectStore('offline-data', { keyPath: 'key' });
        store.createIndex('type', 'type');
      }
    };
  });
}

// Background sync event
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-pending-requests') {
    event.waitUntil(syncPendingRequests());
  }
});

// Sync pending requests when back online
async function syncPendingRequests() {
  const db = await openIndexedDB();
  const tx = db.transaction('pending-requests', 'readwrite');
  const store = tx.objectStore('pending-requests');
  const requests = await store.getAll();
  
  for (const requestData of requests) {
    try {
      const response = await fetch(requestData.url, {
        method: requestData.method,
        headers: requestData.headers,
        body: requestData.body
      });
      
      if (response.ok) {
        // Remove from queue on success
        await store.delete(requestData.timestamp);
        
        // Notify the app
        self.clients.matchAll().then((clients) => {
          clients.forEach((client) => {
            client.postMessage({
              type: 'SYNC_COMPLETE',
              url: requestData.url
            });
          });
        });
      }
    } catch (error) {
      console.log('[SW] Sync failed, will retry:', requestData.url);
    }
  }
}

// Push notification event
self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  
  const options = {
    body: data.message || 'New notification',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    vibrate: [100, 50, 100],
    data: data,
    actions: data.actions || [
      { action: 'view', title: 'View' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'Housekeeping Alert', options)
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'view' || !event.action) {
    const url = event.notification.data?.url || '/dashboard/housekeeping';
    
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then((windowClients) => {
        // Check if there is already a window/tab open
        for (const client of windowClients) {
          if (client.url.includes('/dashboard/housekeeping') && 'focus' in client) {
            return client.focus();
          }
        }
        // If not, open a new window
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
    );
  }
});

// Message from main app
self.addEventListener('message', (event) => {
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data.type === 'CACHE_RESOURCES') {
    caches.open(CACHE_NAME).then((cache) => {
      cache.addAll(event.data.resources);
    });
  }
});

console.log('[SW] Service Worker loaded');
