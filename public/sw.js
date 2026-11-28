/* TouchQR Service Worker — Background Web Push & Notification Click Handler */
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload = {};
  try {
    payload = event.data.json();
  } catch (_) {
    payload = { title: 'TouchQR Alert', body: event.data.text() };
  }

  const title = payload.title || '🛎️ TouchQR Live Alert';
  const options = {
    body: payload.body || 'New activity in your restaurant.',
    icon: payload.icon || '/favicon.svg',
    badge: payload.badge || '/favicon.svg',
    tag: payload.tag || 'touchqr-live-alert',
    renotify: true,
    requireInteraction: payload.requireInteraction !== false,
    vibrate: Array.isArray(payload.vibrate) ? payload.vibrate : [300, 100, 300, 100, 400],
    data: {
      url: payload.url || '/admin',
      type: payload.type || 'order_alert',
      orderId: payload.orderId || null
    }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification && event.notification.data && event.notification.data.url) || '/admin';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (!client.url || !('focus' in client)) continue;
        try {
          const parsedUrl = new URL(client.url);
          const isSameOrigin = parsedUrl.origin === self.location.origin;
          const isAdminRoute =
            parsedUrl.pathname === '/admin' ||
            parsedUrl.pathname.startsWith('/admin/') ||
            /^\/[^/]+\/admin(\/|$)/.test(parsedUrl.pathname);
          if (isSameOrigin && isAdminRoute) {
            try {
              client.postMessage({
                type: 'TOUCHQR_PUSH_CLICKED',
                data: event.notification.data || {}
              });
            } catch (_) {}
            return client.focus();
          }
        } catch (_) {}
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return undefined;
    })
  );
});
