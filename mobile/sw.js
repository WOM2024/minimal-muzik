/* SuperYT Head Unit — service worker
   Kural:
     • uygulama kabuğu (HTML/CSS/JS/ikon) önbellekten gelir → araba
       açılışında bekleme yok, çevrimdışı da arayüz çalışır
     • API ve YouTube her zaman ağdan → asla bayat veri gösterme
*/

const VERSION = "su-hu-v3";
const SHELL = [
  "./",
  "./index.html",
  "./app.css",
  "./app.js",
  "./icon.svg",
  "./manifest.webmanifest"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(VERSION)
      .then(c => c.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // API / YouTube / görsel → yalnızca ağ (bayatlık riski yok)
  const dynamic = url.origin !== location.origin ||
    /\/api\/|i\.ytimg\.com|googlevideo\.com|sponsor\.ajay\.app/.test(url.href);
  if (dynamic) return;

  // uygulama kabuğu → önce önbellek, yoksa ağ
  e.respondWith(
    caches.match(req).then(hit =>
      hit ||
      fetch(req).then(res => {
        if (res && res.ok && res.type === "basic") {
          const copy = res.clone();
          caches.open(VERSION).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => caches.match("./index.html"))
    )
  );
});
