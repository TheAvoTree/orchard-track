// Service worker push handler — loaded by the main SW via importScripts
// Handles incoming push messages and shows notifications even when app is closed.

self.addEventListener('push', event => {
  let data = {};
  try { data = event.data?.json() ?? {}; } catch {}

  const title   = data.title ?? 'Orchard Track';
  const options = {
    body:    data.body  ?? '',
    icon:    '/icon.svg',
    badge:   '/icon.svg',
    vibrate: [200, 100, 200],
    tag:     data.tag   ?? 'orchard-track',
    data:    { url: data.data?.url ?? '/' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

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
