const CACHE_NAME = 'yupao-shell-v16';
const APP_SHELL = [
  '/index.html',
  '/styles.css?v=0.3.9',
  '/app.js?v=0.3.9',
  '/manifest.webmanifest?v=0.3.9',
  '/vendor/preact.mjs',
  '/vendor/preact-bootstrap.mjs?v=0.3.9',
  '/icons/favicon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/brand/brand-mark-v038.svg?v=0.3.9',
  '/brand/brand-lockup-v038.svg?v=0.3.9',
  '/brand/approved-brand-mark-v038.webp?v=0.3.9',
  '/brand/approved-brand-lockup-v038.webp?v=0.3.9',
  '/illustrations/mascots/hero-duo-v033.webp?v=0.3.9',
  '/illustrations/mascots/taro-entry-v033.webp?v=0.3.9',
  '/illustrations/mascots/duo-success-v033.webp?v=0.3.9',
  '/illustrations/mascots/tank-summary-v033.webp?v=0.3.9',
  '/illustrations/mascots/tank-safe-v033.webp?v=0.3.9',
  '/illustrations/mascots/tank-warning-v033.webp?v=0.3.9',
  '/illustrations/mascots/duo-invoice-v033.webp?v=0.3.9',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

async function networkFirst(request, fallbackUrl) {
  try {
    const response = await fetch(request, { cache: 'no-store' });
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(fallbackUrl || request, response.clone());
    }
    return response;
  } catch {
    return (await caches.match(fallbackUrl || request)) || Response.error();
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  }
  return response;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const network = fetch(request).then((response) => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => null);
  return cached || (await network) || Response.error();
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.pathname.startsWith('/api/')) return;
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, '/index.html'));
    return;
  }

  const isVersionedCore = /\.(?:css|js|mjs)$/.test(url.pathname) && url.searchParams.has('v');
  if (isVersionedCore || url.pathname.startsWith('/icons/') || url.pathname.startsWith('/illustrations/mascots/') || url.pathname.startsWith('/brand/')) {
    event.respondWith(cacheFirst(request));
    return;
  }

  event.respondWith(staleWhileRevalidate(request));
});
