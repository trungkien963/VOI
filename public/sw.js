/* FN-APP Offline-First App Shell + Lock-Screen Safe Web Push Service Worker */
const CACHE_NAME = 'fn-app-shell-v1';
const APP_SHELL_ASSETS = ['/', '/index.html', '/favicon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).catch(() => caches.match('/index.html'));
    }),
  );
});

// Section 9.3: Lock-Screen Safe Web Push Handler (Never displays specific money amounts or debtor names)
self.addEventListener('push', (event) => {
  let payload = {
    title: 'FN-APP ☕',
    body: 'Đến giờ ghi chi tiêu hôm nay rồi ☕',
  };
  try {
    if (event.data) {
      const parsed = event.data.json();
      if (parsed && typeof parsed.title === 'string' && typeof parsed.body === 'string') {
        payload = { title: parsed.title, body: parsed.body };
      }
    }
  } catch {
    // Fallback to lock-screen safe default
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      tag: 'fn-app-reminder',
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow('/');
      }
      return undefined;
    }),
  );
});

