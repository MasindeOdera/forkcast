/*
 * Forkcast service worker.
 *
 * Strategy overview:
 *   • Precache the app shell (offline fallback + icons + manifest) so the
 *     app can render *something* offline. Chrome also uses the presence
 *     of a fetch handler to decide the app is installable.
 *   • Runtime cache-first for static assets under /_next/static and /icons.
 *   • Network-first for HTML navigations, falling back to /offline.html
 *     when the network is unreachable.
 *   • API routes (/api/*) are ALWAYS network-only — we never want to
 *     serve stale meals, auth, or Cloudinary responses from a cache.
 *
 * Bump CACHE_VERSION to invalidate the precache on the next SW activation.
 */

const CACHE_VERSION = 'v1';
const STATIC_CACHE = `forkcast-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `forkcast-runtime-${CACHE_VERSION}`;

const APP_SHELL = [
  '/offline.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png',
  '/icons/icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== STATIC_CACHE && k !== RUNTIME_CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Allow the page to trigger an immediate update.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

function isNavigation(request) {
  return (
    request.mode === 'navigate' ||
    (request.method === 'GET' &&
      request.headers.get('accept')?.includes('text/html'))
  );
}

function isStaticAsset(url) {
  return (
    url.pathname.startsWith('/_next/static') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/favicon.ico' ||
    url.pathname === '/manifest.json'
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Never intercept anything other than GET.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Same-origin only — Cloudinary, third-party CDNs, etc. go straight to net.
  if (url.origin !== self.location.origin) return;

  // API calls: never cache. Auth + meal data must always be live.
  if (url.pathname.startsWith('/api/')) return;

  // Static assets: cache-first, then update in background.
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request)
          .then((resp) => {
            if (resp && resp.ok) {
              const clone = resp.clone();
              caches.open(RUNTIME_CACHE).then((c) => c.put(request, clone));
            }
            return resp;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
    return;
  }

  // HTML navigations: network-first with offline fallback.
  if (isNavigation(request)) {
    event.respondWith(
      fetch(request)
        .then((resp) => {
          const clone = resp.clone();
          caches.open(RUNTIME_CACHE).then((c) => c.put(request, clone));
          return resp;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          const offline = await caches.match('/offline.html');
          return (
            offline ||
            new Response('You are offline.', {
              status: 503,
              headers: { 'Content-Type': 'text/plain' },
            })
          );
        })
    );
  }
});
