/* MarginPad service worker — web push + a light offline app-shell.
   Caching policy (conservative, so nothing can go stale):
   - /assets/* GETs → stale-while-revalidate (instant repeat loads; home.css/home.js carry a ?v= hash so
     new versions are new URLs; unversioned assets refresh in the background on every hit)
   - navigations → network-first, falling back to the cached copy (offline PWA opens instead of a dino)
   - /api/*, websockets, cross-origin, POSTs → never touched */
var CACHE = 'mp-shell-v1';
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(['/']).catch(function () {}); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE && k.indexOf('mp-shell') === 0; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url; try { url = new URL(req.url); } catch (_) { return; }
  if (url.origin !== self.location.origin) return;
  if (url.pathname.indexOf('/api/') === 0 || url.pathname.indexOf('/chat/') === 0) return;
  if (url.pathname.indexOf('/assets/') === 0) {
    // Versioned bundles (?v=hash) + fonts/images: stale-while-revalidate — a new version is a new URL, so
    // serving from cache can never be wrong. Unversioned JS/CSS (mp-trade.js, i18n.js, …): NETWORK-first with
    // cache fallback, so a hotfix deploy reaches every open browser on the very next load.
    var immutable = url.searchParams.has('v') || /\.(woff2?|png|jpe?g|webp|svg|ico)$/.test(url.pathname);
    if (immutable) {
      e.respondWith(caches.open(CACHE).then(function (c) {
        return c.match(req).then(function (hit) {
          var net = fetch(req).then(function (res) { if (res && res.ok) c.put(req, res.clone()); return res; }).catch(function () { return hit; });
          if (hit) { e.waitUntil(net.catch(function () {})); return hit; }
          return net;
        });
      }));
    } else {
      e.respondWith(fetch(req).then(function (res) {
        if (res && res.ok) { var copy = res.clone(); e.waitUntil(caches.open(CACHE).then(function (c) { return c.put(req, copy); })); }
        return res;
      }).catch(function () { return caches.match(req); }));
    }
    return;
  }
  if (req.mode === 'navigate') { // network-first with offline fallback
    e.respondWith(fetch(req).then(function (res) {
      if (res && res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { return c.put(req, copy); }).catch(function () {}); }
      return res;
    }).catch(function () {
      return caches.match(req).then(function (hit) { return hit || caches.match('/'); });
    }));
  }
});

self.addEventListener('push', function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { try { d = { body: e.data.text() }; } catch (e2) { d = {}; } }
  var title = d.title || 'MarginPad';
  var opts = {
    body: d.body || '',
    icon: d.icon || '/assets/favicon-32.png',
    badge: '/assets/favicon-32.png',
    tag: d.tag || 'mp-' + (d.url || ''),
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
