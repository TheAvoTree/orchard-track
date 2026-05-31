import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';

// Immediately take control when a new SW is available — stops stale cache issues
self.addEventListener('install',  () => self.skipWaiting());
self.addEventListener('activate', e  => e.waitUntil(clients.claim()));

// Workbox injects the precache manifest here at build time
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// ── Push notifications ────────────────────────────────────────────────────────

self.addEventListener('push', event => {
  let data = {};
  try { data = event.data?.json() ?? {}; } catch {}

  const title   = data.title ?? 'Orchard Track';
  const options = {
    body:    data.body ?? '',
    icon:    '/icon.svg',
    badge:   '/icon.svg',
    vibrate: [200, 100, 200],
    tag:     data.tag  ?? 'orchard-track',
    renotify: true,
    data:    { url: data.data?.url ?? '/' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ── Notification click — focus or open the app ────────────────────────────────

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url ?? '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const match = list.find(c => c.url.includes(self.location.origin));
      if (match) return match.focus();
      return clients.openWindow(url);
    })
  );
});

// ── Runtime caching ───────────────────────────────────────────────────────────

import { registerRoute } from 'workbox-routing';
import { NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';

registerRoute(
  ({ url }) => url.pathname.startsWith('/api/gps/latest'),
  new NetworkFirst({ cacheName: 'api-positions', networkTimeoutSeconds: 5 })
);

registerRoute(
  ({ url }) => url.pathname.startsWith('/api/growers'),
  new StaleWhileRevalidate({ cacheName: 'api-growers' })
);
