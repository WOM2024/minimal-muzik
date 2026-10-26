/* SuperYT — ortak service worker (playlist + index + Vosk model cache) */
var CACHE_CORE = "superyt-core-v2";
var CACHE_MODEL = "superyt-vosk-v1";

var PRECACHE = [
  "./",
  "./index.html",
  "./playlist.html",
  "./superyt-logo.png",
  "./superyt-logo.ico",
  "./manifest-playlist.webmanifest"
];

function isModelRequest(url) {
  try {
    var u = typeof url === "string" ? url : url.url;
    return (
      u.indexOf("/models/") !== -1 ||
      u.indexOf("vosk-model") !== -1 ||
      u.indexOf("vosk-browser") !== -1 ||
      u.indexOf("vosk.js") !== -1
    );
  } catch (e) {
    return false;
  }
}

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches
      .open(CACHE_CORE)
      .then(function (cache) {
        return cache.addAll(PRECACHE).catch(function () {});
      })
      .then(function () {
        return self.skipWaiting();
      })
  );
});

self.addEventListener("activate", function (event) {
  var keep = {};
  keep[CACHE_CORE] = true;
  keep[CACHE_MODEL] = true;
  event.waitUntil(
    caches
      .keys()
      .then(function (keys) {
        return Promise.all(
          keys.map(function (k) {
            if (!keep[k]) return caches.delete(k);
          })
        );
      })
      .then(function () {
        return self.clients.claim();
      })
  );
});

self.addEventListener("fetch", function (event) {
  var req = event.request;
  if (req.method !== "GET") return;

  // Vosk model + vosk.js → cache-first (kalıcı)
  if (isModelRequest(req.url)) {
    event.respondWith(
      caches.open(CACHE_MODEL).then(function (cache) {
        return cache.match(req).then(function (cached) {
          if (cached) return cached;
          return fetch(req)
            .then(function (res) {
              if (res && res.ok) {
                try {
                  cache.put(req, res.clone());
                } catch (e) {}
              }
              return res;
            })
            .catch(function () {
              return cached || Response.error();
            });
        });
      })
    );
    return;
  }

  // Diğerleri: network-first, offline cache yedek
  event.respondWith(
    fetch(req)
      .then(function (res) {
        try {
          var copy = res.clone();
          caches.open(CACHE_CORE).then(function (cache) {
            cache.put(req, copy).catch(function () {});
          });
        } catch (e) {}
        return res;
      })
      .catch(function () {
        return caches.match(req).then(function (cached) {
          return (
            cached ||
            caches.match("./index.html") ||
            caches.match("./playlist.html")
          );
        });
      })
  );
});
