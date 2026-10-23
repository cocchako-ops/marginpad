/* MarginPad service worker - WEB PUSH ONLY (2026-10-15).
   There is DELIBERATELY NO fetch handler. The old one cached the app shell + bundles, and on iOS Safari it served a
   STALE app on every load after the first: the owner cleared website data, the first clean load was correct, the very
   next load reverted to an old version and stayed there - a clean-then-stuck signature that only an SW cache can make.
   Chrome (even with the SW) stayed fresh across loads; the bug was iOS-Safari-specific. Freshness is ALREADY guaranteed
   without the SW: the app shell is served `no-store` (always fresh) and every bundle carries a `?v=<hash>` so a new
   version is a new URL. An SW cache on top of that could only ever go wrong - so it is gone. Every request now goes
   straight to the network (no respondWith anywhere), which iOS cannot get stale.
   `activate` deletes every cache this SW ever created, so a device stuck under the old caching SW gets a clean slate the
   moment its browser picks up this script (fetched directly from the network on navigation; sw.js is max-age=0
   must-revalidate). If offline support is ever wanted back, add it as network-FIRST with an explicit offline page,
   never as anything that can answer a live request from cache. */
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) { return Promise.all(keys.filter(function (k) { return k.indexOf('mp-shell') === 0; }).map(function (k) { return caches.delete(k); })); })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('push', function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { try { d = { body: e.data.text() }; } catch (e2) { d = {}; } }
  var title = d.title || 'MarginPad';
  var opts = {
    body: d.body || '',
    icon: d.icon || '/assets/favicon-32.png',
    badge: '/assets/favicon-32.png',
    // A UNIQUE tag per push by default, so each event stacks like a separate chat message (a trader's OPEN and their CLOSE
    // both show, they do not collapse into one). A payload can still pass an explicit d.tag to deliberately replace an
    // earlier one. (owner 2026-10-23: "stigne mi kao sto bi mi poruka stigla pa izadje notifikacija")
    tag: d.tag || ('mp-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8)),
    data: { url: d.url || 'https://marginpad.io/' },
    renotify: true
  };
  e.waitUntil(self.registration.showNotification(title, opts));
});

self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || 'https://marginpad.io/';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) { if (list[i].url === url && 'focus' in list[i]) return list[i].focus(); }
    if (self.clients.openWindow) return self.clients.openWindow(url);
  }));
});
