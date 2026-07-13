// Minimal service worker: satisfies PWA installability criteria and backs
// Web Push. It does not cache or intercept normal fetches, so it cannot
// make responses stale or break the live dashboard.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'اليافور', body: event.data.text() };
  }

  const conversationId = payload.conversationId || null;
  event.waitUntil(
    self.registration.showNotification(payload.title || 'اليافور', {
      body: payload.body || '',
      icon: '/icons/icon.svg',
      badge: '/icons/icon.svg',
      tag: conversationId ? `ay-conv-${conversationId}` : undefined,
      data: { conversationId },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const conversationId = event.notification.data?.conversationId;
  const targetUrl = conversationId ? `/dashboard?conversation=${conversationId}` : '/dashboard';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          client.postMessage({ type: 'OPEN_CONVERSATION', conversationId });
          return;
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
