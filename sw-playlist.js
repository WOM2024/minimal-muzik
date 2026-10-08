/* SuperYT Remote — minimal SW (installability) */
var CACHE = "superyt-remote-v1";
var PRECACHE = [
  "./playlist.html",
  "./superyt-logo.png",
  "./superyt-logo.ico",
  "./manifest-playlist.webmanifest"
];

self.addEventListener("install", function(event) {
  event.waitUntil(
    caches.open(CACHE).then(function(cache) {
      return cache.addAll(PRECACHE).catch(function() {});
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.map(function(k) {
        if (k !== CACHE) return caches.delete(k);
      }));
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// Network-first; offline için cache yedek
self.addEventListener("fetch", function(event) {
  var req = event.request;
  if (req.method !== "GET") return;
  event.respondWith(
    fetch(req).then(function(res) {
      try {
        var copy = res.clone();
        caches.open(CACHE).then(function(cache) {
          cache.put(req, copy).catch(function() {});
        });
      } catch (e) {}
      return res;
    }).catch(function() {
      return caches.match(req).then(function(cached) {
        return cached || caches.match("./playlist.html");
      });
    })
  );
});
