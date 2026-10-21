const CACHE_NAME = 'ewvor-runtime-v5';
const APP_SHELL = ['/', '/index.html', '/manifest.json', '/icons/logo-192.png', '/icons/logo-512.png', '/apple-touch-icon.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch((error) => {
        // A missing optional icon must not prevent the new worker from installing.
        console.warn('Some offline assets could not be cached:', error);
      })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(cacheNames.filter((name) => name.startsWith('ewvor-runtime-') && name !== CACHE_NAME).map((name) => caches.delete(name)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache API/auth/function responses or URLs carrying credentials/tokens.
  if (/\/(rest|auth|functions|storage|graphql)\//i.test(url.pathname) || url.searchParams.has('token') || url.searchParams.has('access_token')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          void caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', copy));
        }
        return response;
      }).catch(async () => (await caches.match('/index.html')) || (await caches.match('/')))
    );
    return;
  }

  // Cache only static same-origin files. Fingerprinted Vite assets are immutable,
  // while other static files use network-first to make updates visible promptly.
  const isStaticFile = /\.(?:avif|css|eot|gif|ico|jpe?g|js|json|png|svg|webp|woff2?|ttf)$/i.test(url.pathname);
  if (!isStaticFile) return;

  const isFingerprintAsset = url.pathname.startsWith('/assets/') && /-[A-Za-z0-9_-]{8,}\./.test(url.pathname);
  if (isFingerprintAsset) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((response) => {
        if (response.ok) void caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
        return response;
      }))
    );
    return;
  }

  event.respondWith(
    fetch(request).then((response) => {
      if (response.ok) void caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
      return response;
    }).catch(async () => (await caches.match(request)) || new Response('Offline', { status: 503, statusText: 'Offline' }))
  );
});

self.addEventListener('push', (event) => {
  if (!event.data) return;
  let data;
  try { data = event.data.json(); } catch { data = { body: event.data.text() }; }
  const targetUrl = typeof data.url === 'string' && data.url.startsWith('/') ? data.url : '/';
  event.waitUntil(self.registration.showNotification(data.title || 'Ewvor', {
    body: data.body || 'Nova notificação',
    icon: '/icons/logo-192.png',
    badge: '/icons/logo-192.png',
    vibrate: [100, 50, 100],
    data: { url: targetUrl },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const rawUrl = event.notification.data?.url;
  const targetUrl = typeof rawUrl === 'string' && rawUrl.startsWith('/') ? new URL(rawUrl, self.location.origin).href : self.location.origin + '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clientList) => {
      for (const client of clientList) {
        if (new URL(client.url).origin === self.location.origin && 'focus' in client) {
          await client.focus();
          if ('navigate' in client) return client.navigate(targetUrl);
          return;
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
