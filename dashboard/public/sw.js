// Minimal service worker: only exists to satisfy PWA installability criteria.
// It does not cache or intercept anything, so it cannot make responses stale
// or break the live dashboard.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
