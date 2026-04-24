/**
 * TrishTEAM service worker — Phase 11.9.3.
 *
 * Chiến lược:
 *   - App shell: precache các asset tĩnh (manifest, icons, offline page).
 *   - Navigation requests (HTML): network-first, fallback /offline khi offline.
 *   - Same-origin static assets (_next/static, public): stale-while-revalidate.
 *   - API + cross-origin (firestore, firebaseapp...): network-only, không cache
 *     (tránh lộ data cũ / cache user-specific).
 *
 * Bump CACHE_VERSION mỗi lần thay đổi logic để browser prune cache cũ.
 */

const CACHE_VERSION = 'trishteam-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

const APP_SHELL = [
  '/offline',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png',
  '/trishteam-logo.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(APP_SHELL).catch(() => undefined))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => !k.startsWith(CACHE_VERSION))
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

// Helper: stale-while-revalidate cho asset tĩnh.
async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  const networkPromise = fetch(request)
    .then((resp) => {
      if (resp && resp.ok && resp.type === 'basic') {
        cache.put(request, resp.clone()).catch(() => undefined);
      }
      return resp;
    })
    .catch(() => undefined);
  return cached || (await networkPromise) || Response.error();
}

// Helper: network-first cho navigation, fallback /offline.
async function networkFirstNavigation(request) {
  try {
    const resp = await fetch(request);
    return resp;
  } catch {
    const cache = await caches.open(STATIC_CACHE);
    const offline = await cache.match('/offline');
    if (offline) return offline;
    return new Response(
      '<!doctype html><meta charset="utf-8"><title>Offline</title><h1>Offline</h1><p>Không có kết nối.</p>',
      { headers: { 'content-type': 'text/html; charset=utf-8' }, status: 503 },
    );
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Chỉ xử lý same-origin.
  if (url.origin !== self.location.origin) return;

  // Bỏ qua API routes (dynamic data, có Authorization header cần fresh).
  if (url.pathname.startsWith('/api/')) return;

  // Navigation requests — HTML → network-first + offline fallback.
  if (
    request.mode === 'navigate' ||
    (request.method === 'GET' &&
      request.headers.get('accept')?.includes('text/html'))
  ) {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  // Static assets → stale-while-revalidate.
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/logos/') ||
    url.pathname.startsWith('/brands/') ||
    url.pathname === '/manifest.json' ||
    /\.(png|jpg|jpeg|svg|webp|ico|woff2?)$/.test(url.pathname)
  ) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }
});

// Nhận message skipWaiting từ client để force activate bản mới.
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
