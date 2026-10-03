/* global self */
// Push reminders, imported into the Workbox service worker (vite.config.ts → importScripts).
// The payload carries only general texts ({ title, body, url }) – sent by GitHub Actions.
self.addEventListener('push', function (event) {
  var data;
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }
  var title = typeof data.title === 'string' && data.title ? data.title : 'Manager';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: typeof data.body === 'string' ? data.body : '',
      icon: 'icons/pwa-192x192.png',
      tag: typeof data.tag === 'string' ? data.tag : undefined,
      data: { url: typeof data.url === 'string' ? data.url : './' },
    }),
  );
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var url = (event.notification.data && event.notification.data.url) || './';
  var target = new URL(url, self.registration.scope);
  if (target.origin !== self.location.origin) target = new URL('./', self.registration.scope);
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (windows) {
      for (var i = 0; i < windows.length; i += 1) {
        var client = windows[i];
        if (client.url.indexOf(self.registration.scope) === 0) {
          // Open app: switch the page without reloading (a reload would lock it).
          client.postMessage({ type: 'manager:navigate', hash: target.hash });
          return client.focus();
        }
      }
      return self.clients.openWindow(target.href);
    }),
  );
});
