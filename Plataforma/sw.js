/**
 * AcolheBem — Service Worker
 * Cache-first for static assets, Network-first for API
 */

const CACHE_VERSION = 'acolhebem-v2';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const API_CACHE = `${CACHE_VERSION}-api`;

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/js/app.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/offline.html',
];

const EXTERNAL_ASSETS = [
  'https://d3js.org/d3.v7.min.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
];

// Install — cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('SW: Some static assets failed to cache:', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== API_CACHE)
          .map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip chrome-extension, etc.
  if (!url.protocol.startsWith('http')) return;

  // API requests — Network-first with 5min cache
  if (url.hostname.includes('supabase.co') || url.hostname.includes('supabase.in')) {
    event.respondWith(networkFirstWithCache(request, API_CACHE, 300));
    return;
  }

  // Static assets — Cache-first
  if (url.origin === location.origin || EXTERNAL_ASSETS.some((a) => request.url.startsWith(a))) {
    event.respondWith(cacheFirstWithNetwork(request, STATIC_CACHE));
    return;
  }

  // Everything else — Network with offline fallback
  event.respondWith(
    fetch(request).catch(() => caches.match('/offline.html'))
  );
});

// Cache-first: try cache, then network, update cache in background
async function cacheFirstWithNetwork(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) {
    // Update cache in background (stale-while-revalidate)
    const fetchPromise = fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(cacheName).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => {});
    // Don't await — return cached immediately
    fetchPromise;
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      const clone = response.clone();
      const cache = await caches.open(cacheName);
      cache.put(request, clone);
    }
    return response;
  } catch {
    return caches.match('/offline.html');
  }
}

// Network-first: try network with timeout, fallback to cache
async function networkFirstWithCache(request, cacheName, maxAgeSeconds) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(request, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (response.ok) {
      const clone = response.clone();
      const cache = await caches.open(cacheName);
      cache.put(request, clone);
    }
    return response;
  } catch {
    // Network failed — try cache
    const cached = await caches.match(request);
    if (cached) return cached;

    // No cache — return offline page for navigation requests
    if (request.mode === 'navigate') {
      return caches.match('/offline.html');
    }

    return new Response(JSON.stringify({ error: 'offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
