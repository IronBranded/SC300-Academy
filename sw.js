/* sw.js - SC300 Academy service worker
   The whole site is one file (index.html), so offline support is simple: cache it on
   install, serve it from cache, and refresh the cached copy in the background so the
   next visit picks up a new deployment. Navigations fall back to the cached shell
   because the site is a hash router - every route is index.html.
   Bump CACHE_VERSION when this file changes; old caches are deleted on activate. */
var CACHE_VERSION = 'sc300-v1';
var SHELL = ['./', 'index.html'];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE_VERSION).then(function (c) {
    return Promise.all(SHELL.map(function (u) { return c.add(u).catch(function () {}); }));
  }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE_VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  var key = req.mode === 'navigate' ? 'index.html' : req;
  e.respondWith(caches.open(CACHE_VERSION).then(function (c) {
    return c.match(key).then(function (hit) {
      var net = fetch(req).then(function (res) {
        if (res && res.ok) c.put(key, res.clone());
        return res;
      }).catch(function () { return hit; });
      return hit || net;
    });
  }));
});
