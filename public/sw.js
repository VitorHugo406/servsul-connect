const CACHE_NAME = 'ewvor-runtime-v9';
const STATIC_ASSETS = [
  '/manifest.json',
  '/icons/logo-192.png',
  '/icons/logo-512.png',
  '/icons/badge-96.png',
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

  // Development modules must never be cached: React and its renderer must
  // always come from the same Vite dependency generation.
  if (
    url.pathname.startsWith('/node_modules/') ||
    url.pathname.startsWith('/src/') ||
    url.pathname.startsWith('/@') ||
    url.pathname.startsWith('/__') ||
    url.pathname === '/sw.js'
  ) return;

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
        // Standalone pages (e.g. /teste-gratuito.html) must never overwrite the cached app shell.
        const standalonePage = url.pathname.endsWith('.html') && url.pathname !== '/index.html';
        if (response.ok && response.type === 'basic' && !standalonePage) {
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

  // Only explicitly listed static files are safe for cache-first delivery.
  if (!STATIC_ASSETS.includes(url.pathname)) return;

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

// Web Push (sent by the send-push edge function even when the app is closed).
// Messages look like WhatsApp: title = person / group / sector, body = the message,
// photo as the icon; several messages of the same chat stack in one notification.
self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { d = { body: event.data ? event.data.text() : '' }; }
  event.waitUntil((async () => {
    const wins = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    // The app is open on screen: it shows its own in-app banner instead.
    if (d.kind === 'message' && wins.some((c) => c.visibilityState === 'visible' && c.focused)) {
      wins.forEach((c) => c.postMessage({ type: 'ewvon-push', data: d }));
      return;
    }
    // Incoming ewvon call: rings (sound + long vibration), stays on screen, Atender / Recusar, gone after ~35 s.
    if (d.kind === 'call') {
      if (wins.some((c) => c.visibilityState === 'visible' && c.focused)) return;   // the open app shows its own ringing banner
      await self.registration.showNotification(d.title || 'Chamada do ewvon', {
        body: d.body || 'Toque para atender', icon: d.icon || '/icons/notify-person.png?v=3', badge: d.badge || '/icons/badge-96.png',
        tag: d.tag || 'call', renotify: true, requireInteraction: true, silent: false, timestamp: d.at || Date.now(),
        vibrate: [900, 400, 900, 400, 900, 400, 900],
        data: { url: d.url || '/', kind: 'call', callId: d.callId },
        actions: [{ action: 'answer', title: 'Atender' }, { action: 'decline', title: 'Recusar' }],
      });
      // The server repeats this push every few seconds while the call is still ringing, so it rings non-stop.
      // When the pushes stop (answered, refused, hung up or ~60 s) the last one clears itself.
      await new Promise((ok) => setTimeout(ok, 7500));
      const stillMine = (await self.registration.getNotifications({ tag: d.tag })).filter((n) => n.timestamp === (d.at || 0));
      stillMine.forEach((n) => n.close());
      return;
    }
    const tag = d.tag || 'ewvon';
    const prev = (await self.registration.getNotifications({ tag }))[0];
    const count = (prev && prev.data && prev.data.count ? prev.data.count : 0) + 1;
    const lines = [...((prev && prev.data && prev.data.lines) || []), d.body || ''].slice(-6);
    const isNotice = d.kind === 'notice' || d.kind === 'birthday';
    const title = isNotice ? (d.title || 'Novo aviso') : count > 1 ? `${d.title} · ${count} mensagens` : (d.title || 'ewvon');
    await self.registration.showNotification(title, {
      body: isNotice ? `${d.body || ''}${d.company ? `\n${d.company} · Avisos` : ''}` : count > 1 ? lines.join('\n') : (d.body || 'Nova mensagem'),
      icon: d.icon || '/icons/notify-person.png?v=3',
      badge: d.badge || '/icons/badge-96.png',
      tag,
      renotify: true,
      timestamp: d.at || Date.now(),
      vibrate: isNotice ? [200, 100, 200, 100, 300] : [90, 40, 90],
      requireInteraction: !!(isNotice && d.urgent),
      data: { url: d.url || '/', lines, count, kind: d.kind || 'message' },
      actions: d.kind === 'birthday' ? [{ action: 'open', title: 'Dar parabéns' }] : isNotice ? [{ action: 'open', title: 'Ver aviso' }] : [{ action: 'open', title: 'Abrir conversa' }],
    });
  })());
});

// The browser sometimes replaces the push subscription by itself: renew it and tell the server, so notifications keep arriving
// even if the app is not opened for days.
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil((async () => {
    try {
      const old = event.oldSubscription || null;
      const key = old && old.options && old.options.applicationServerKey;
      const sub = event.newSubscription || (key ? await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }) : null);
      if (!sub || !old) return;
      const j = sub.toJSON();
      await fetch('https://scslfueixmuolkmgdslk.supabase.co/rest/v1/rpc/push_resubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: 'sb_publishable_BliZc1EBDW4h3U3eL-4qYQ_b9ivGYkV' },
        body: JSON.stringify({ _old: old.endpoint, _new: j.endpoint, _p256dh: j.keys && j.keys.p256dh, _auth: j.keys && j.keys.auth }),
      });
    } catch (e) { /* the app renews it the next time it opens */ }
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'decline') return;
  const url = (event.notification.data && event.notification.data.url) || '/';
  const targetUrl = new URL(url, self.location.origin).href;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const existing = list.find((c) => new URL(c.url).origin === self.location.origin);
      if (existing) {
        existing.postMessage({ type: 'ewvon-open', url });
        return 'focus' in existing ? existing.focus() : undefined;
      }
      return clients.openWindow ? clients.openWindow(targetUrl) : undefined;
    })
  );
});
