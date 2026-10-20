const CACHE_NAME = 'ewvor-runtime-v4';
const STATIC_ASSETS = [
  '/manifest.json',
  '/icons/logo-192.png',
  '/icons/logo-512.png',
  '/apple-touch-icon.png'
];

// Cache only stable static assets during installation. The app shell is cached
// after a successful network response so offline fallback actually has a copy.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .catch((error) => {
        console.warn('Some static assets could not be cached:', error);
      })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name.startsWith('ewvor-runtime-') && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    )
  );
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache authentication, database, or server-function responses.
  if (
    url.pathname.includes('/rest/') ||
    url.pathname.includes('/auth/') ||
    url.pathname.includes('/functions/')
  ) return;

  // Always try the network first for the app shell and versioned Vite bundles,
  // keeping deployments fresh while allowing a real offline fallback.
  if (
    request.mode === 'navigate' ||
    url.pathname === '/index.html' ||
    url.pathname.startsWith('/assets/')
  ) {
    event.respondWith(
      fetch(request).then((response) => {
        if (response.ok && response.type === 'basic') {
          const copy = response.clone();
          event.waitUntil(
            caches.open(CACHE_NAME).then((cache) => cache.put(
              request.mode === 'navigate' ? '/index.html' : request,
              copy
            ))
          );
        }
        return response;
      }).catch(async () => {
        const cached = await caches.match(
          request.mode === 'navigate' ? '/index.html' : request
        );
        return cached || new Response('Offline', {
          status: 503,
          statusText: 'Offline',
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      })
    );
    return;
  }

  // Cache-first for small same-origin static files, network-first on a miss.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok && response.type === 'basic') {
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)));
        }
        return response;
      });
    }).catch(() => new Response('Offline', {
      status: 503,
      statusText: 'Offline',
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    }))
  );
});

self.addEventListener('push', (event) => {
  if (!event.data) return;
  let data;
  try {
    data = event.data.json();
  } catch {
    data = { body: event.data.text() };
  }
  const options = {
    body: data.body || 'Nova notificação',
    icon: '/icons/logo-192.png',
    badge: '/icons/logo-192.png',
    vibrate: [100, 50, 100],
    data: { url: data.url || '/' }
  };
  event.waitUntil(
    self.registration.showNotification(data.title || 'Ewvor', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      const existing = clientList.find((client) => client.url === targetUrl);
      if (existing && 'focus' in existing) return existing.focus();
      return clients.openWindow ? clients.openWindow(targetUrl) : undefined;
    })
  );
});
