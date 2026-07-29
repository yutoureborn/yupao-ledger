const CACHE_NAME = 'yupao-shell-v6';
const SHELL = [
  '/index.html', '/styles.css?v=0.2.6', '/app.js?v=0.2.6', '/manifest.webmanifest?v=0.2.6',
  '/vendor/preact.mjs', '/vendor/preact-bootstrap.mjs?v=0.2.6',
  '/icons/favicon.svg', '/icons/icon-192.png', '/icons/icon-512.png',
  '/illustrations/hero-duo.webp', '/illustrations/taro-quick.webp', '/illustrations/cannon-summary.webp'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

async function networkFirst(request, fallback) {
  try {
    const response = await fetch(request, { cache: 'no-store' });
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(fallback || request, response.clone());
    }
    return response;
  } catch {
    return (await caches.match(fallback || request)) || Response.error();
  }
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

  event.respondWith(networkFirst(request));
});
