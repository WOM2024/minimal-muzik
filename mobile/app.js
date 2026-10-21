/* ============================================================
   SuperYT Head Unit — uygulama mantığı
   ------------------------------------------------------------
   Bölümler:
     0. Yardımcılar & depolama
     1. Ayarlar
     2. Kaynak yönlendirici (Invidious havuzu + devre kesici)
     3. Katalog (kategori / arama)
     4. Kuyruk & favoriler & geçmiş
     5. Oynatıcı (YouTube IFrame API + gözcü + dayanıklılık)
     6. SponsorBlock
     7. Arayüz (sekmeler, satırlar, sayfalar, ipuçları)
     8. Media Session (direksiyon tuşları)
     9. PWA
   ============================================================ */

"use strict";

(function () {

/* ───────────── 0. Yardımcılar & depolama ───────────── */

const $ = (sel, root) => (root || document).querySelector(sel);
const $$ = (sel, root) => Array.prototype.slice.call((root || document).querySelectorAll(sel));

function fmt(sec) {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return m + ":" + String(s).padStart(2, "0");
}

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch (e) { return fallback; }
}

function save(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
}

const K = {
  fav: "su_favorites_v1",
  hist: "su_history_v1",
  queue: "su_queue_v1",
  index: "su_queue_index_v1",
  set: "su_settings_v1",
  src: "su_source_health_v1",
  srch: "su_search_history_v1",
  onb: "su_onboarded_v1",
  ord: "su_queue_order_v1",
  sleep: "su_sleep_v1"
};

/* YouTube video kimliği: harf/rakam/`_`/`-`. Üçüncü taraf kaynaklardan
   gelen her kimlik bununla doğrulanır (XSS savunması). */
const VID_RE = /^[A-Za-z0-9_-]{6,20}$/;

function isSafeVideoId(v) { return typeof v === "string" && VID_RE.test(v); }

/** localStorage'dan gelen iz listelerini temizler. */
function sanitizeTracks(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter(t => t && isSafeVideoId(t.videoId))
    .map(t => ({
      videoId: t.videoId,
      title: String(t.title || "Başlıksız"),
      author: String(t.author || ""),
      dur: Number(t.dur) || 0
    }));
}

/** Gecikmeli çalıştırma: sık tetiklenen olaylarda (kaydırıcı) yazma sayısını azaltır. */
function debounce(fn, ms) {
  let t = null;
  return function () {
    const args = arguments, self = this;
    clearTimeout(t);
    t = setTimeout(() => fn.apply(self, args), ms);
  };
}

function fetchTimeout(url, ms) {
  const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = setTimeout(() => { try { ctrl && ctrl.abort(); } catch (e) {} }, ms || 9000);
  const opt = { signal: ctrl ? ctrl.signal : undefined };
  return fetch(url, opt).finally(() => clearTimeout(timer));
}

let toastTimer = null;
function toast(msg, kind) {
  const t = $("#toast");
  t.textContent = msg;
  t.className = "toast show" + (kind ? " " + kind : "");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = "toast"; }, 2600);
}

/* ───────────── 1. Ayarlar ───────────── */

const DEFAULTS = {
  autoNext: true,
  earlySkip: true,
  loopQueue: false,
  sponsor: true,
  dim: 0,
  repeat: "off",          // off | all | one
  shuffle: false,
  sponsorCats: {
    sponsor: true, selfpromo: true, interaction: true,
    intro: true, outro: true, preview: true,
    music_offtopic: false, filler: true
  }
};

const CAT_LABELS = {
  sponsor: "Sponsor (reklam)",
  selfpromo: "Kendini tanıtan",
  interaction: "Abone ol / beğen",
  intro: "Giriş",
  outro: "Çıkış",
  preview: "Ön izleme",
  music_offtopic: "Şarkı dışı sohbet",
  filler: "Doldurma"
};

const settings = Object.assign({}, DEFAULTS, load(K.set, {}));
settings.sponsorCats = Object.assign({}, DEFAULTS.sponsorCats, settings.sponsorCats || {});

function saveSettings() { save(K.set, settings); }

/* Tekrar modları — hem düğme döngüsü hem boot() bunları kullanır */
const REPEATS = ["off", "all", "one"];
const REPEAT_LABEL = { off: "Tekrar yok", all: "Tüm liste", one: "Tek şarkı" };

/* Ayarlar sayfası → localStorage: kaydırıcı gibi sürekli tetiklenen
   girişler için geciktirilmiş yazma. */
const saveSettingsSoon = debounce(saveSettings, 400);

/* ───────────── 2. Kaynak yönlendirici ─────────────
   Mevcut sistem de Invidious üzerinden arıyordu, ama tekil instance
   ölüyordu. Burada:
     • geniş instance havuzu
     • sağlama takibi + üstel geri çekilme ile devre kesici
     • en iyi puanlı kaynaktan başlayarak adaptif sıralama
     • sonuç localStorage'a yazılır → yeniden başlatma saldırıyı tekrarlamaz
   -------------------------------------------------- */

const SOURCES = [
  "https://inv.nadeko.net",
  "https://invidious.nerdvpn.de",
  "https://yewtu.be",
  "https://invidious.f5.si",
  "https://iv.melmac.space",
  "https://invidious.privacyredirect.com",
  "https://vid.puffyan.us",
  "https://invidious.slipfox.xyz",
  "https://yt.artemislena.eu",
  "https://iv.ggtyler.dev",
  "https://invidious.fdn.fr",
  "https://inv.tux.pizza",
  "https://invidious.protokolla.fi",
  "https://invidious.perennialte.ch",
  "https://iv.duti.dev"
];

const Sources = (() => {
  let health = load(K.src, {});
  const TIMEOUT = 4500;        // tek istek üst sınırı
  const MAX_TOTAL = 9000;      // tüm kaynaklar toplamında üst sınır
  const BATCH = 4;             // kaç kaynak eşzamanlı denensin
  const PROBE_TIMEOUT = 4500;  // manuel "kaynak testi" isteği
  const MAX_COOL = 5 * 60 * 1000;      // en fazla 5 dk askıya alma

  function h(host) {
    if (!health[host]) {
      health[host] = { ok: 0, fail: 0, consec: 0, lastFail: 0, cool: 0, avg: 0 };
    }
    return health[host];
  }

  function cooldown(host) {
    const rec = h(host);
    if (rec.cool && Date.now() < rec.cool) return false;   // hâlâ askıda
    return true;
  }

  function recordOk(host, ms) {
    const rec = h(host);
    rec.ok++;
    rec.consec = 0;
    rec.cool = 0;
    rec.avg = rec.avg ? Math.round(rec.avg * 0.7 + ms * 0.3) : Math.round(ms);
    persist();
  }

  function recordFail(host) {
    const rec = h(host);
    rec.fail++;
    rec.consec++;
    rec.lastFail = Date.now();
    // üstel geri çekilme: 20s → 40s → 80s → 160s → 320s (üst sınır 5 dk)
    const exp = Math.min(5, rec.consec - 1);
    rec.cool = Date.now() + Math.min(MAX_COOL, 20000 * Math.pow(2, Math.max(0, exp)));
    persist();
  }

  function persist() { save(K.src, health); }

  /** Denemeye uygun kaynakları puanlayarak sıralar. */
  function ordered() {
    return SOURCES.filter(cooldown).map(host => {
      const rec = h(host);
      // daha çok başarı, daha az hata, daha düşük gecikme → iyi puan
      const score = (rec.ok * 2) - (rec.fail * 3) - (rec.avg / 1000);
      return { host, score };
    }).sort((a, b) => b.score - a.score).map(x => x.host);
  }

  function status() {
    return SOURCES.map(host => {
      const rec = h(host);
      const askida = rec.cool && Date.now() < rec.cool;
      let state = "bilinmiyor";
      if (askida) state = "askıda " + Math.ceil((rec.cool - Date.now()) / 1000) + "s";
      else if (rec.ok && !rec.fail) state = "sağlıklı";
      else if (rec.ok) state = "kararsız";
      else if (rec.fail) state = "hata";
      return { host, state, rec };
    });
  }

  /** Arama yapar. null = tüm kaynaklar başarısız, [] = sonuç yok, [...] = sonuçlar */
  /**
   * Verilen kaynaklarda işi eşzamanlı başlatır; ilk başarılı olan
   * döndüğünde diğerleri önemsizleşir. Hepsi başarısızsa null.
   */
  function raceBatch(hosts, run) {
    return new Promise(resolve => {
      let pending = hosts.length;
      let done = false;
      if (!pending) { resolve(null); return; }
      hosts.forEach(h => {
        run(h).then(value => {
          if (done) return;
          if (value !== null && value !== undefined) { done = true; resolve(value); return; }
          if (--pending === 0) resolve(null);
        }, () => {
          if (done) return;
          if (--pending === 0) resolve(null);
        });
      });
    });
  }

  async function tryOne(host, query, page, deadline) {
    const remaining = deadline - Date.now();
    if (remaining < 800) return null;
    const url =
      host + "/api/v1/search?q=" + encodeURIComponent(query) +
      "&type=video&page=" + (page || 1) + "&region=TR";
    const t0 = performance.now();
    try {
      const res = await fetchTimeout(url, Math.min(TIMEOUT, remaining));
      if (!res.ok) { recordFail(host); return null; }
      const data = await res.json();
      if (!Array.isArray(data)) { recordFail(host); return null; }
      recordOk(host, performance.now() - t0);
      return data.filter(x => x.type === "video" && x.videoId);
    } catch (e) {
      recordFail(host);
      return null;
    }
  }

  async function search(query, page) {
    const pool = ordered();
    const deadline = Date.now() + MAX_TOTAL;
    for (let i = 0; i < pool.length; i += BATCH) {
      if (Date.now() > deadline) break;
      const res = await raceBatch(
        pool.slice(i, i + BATCH),
        h => tryOne(h, query, page, deadline)
      );
      if (res) return res;             // [] de geçerli bir cevap (sonuç yok)
    }
    return null;
  }

  /**
   * Kaynakları elle test eder. Eşzamanlı çalıştırılır: 15 kaynak × 4.5 sn
   * sıralı ≈ 67 sn boyunca donmuş bir buton demek. 5 işçiyle ≈ 15 sn.
   */
  async function probe(onProgress) {
    const out = [];
    let cursor = 0;
    const WORKERS = 5;

    async function worker() {
      while (cursor < SOURCES.length) {
        const host = SOURCES[cursor++];
        const t0 = performance.now();
        let ok = false;
        try {
          const res = await fetchTimeout(
            host + "/api/v1/search?q=test&type=video&page=1&region=TR", PROBE_TIMEOUT);
          ok = Array.isArray(res.ok ? await res.json() : null);
        } catch (e) { ok = false; }
        if (ok) recordOk(host, performance.now() - t0); else recordFail(host);
        out.push({ host, ok, ms: Math.round(performance.now() - t0) });
        if (onProgress) onProgress(out.length, SOURCES.length);
      }
    }

    await Promise.all(Array(WORKERS).fill(0).map(() => worker()));
    return out;
  }

  return { search, probe, status, persist };
})();

/* ───────────── 3. Katalog ───────────── */

const CATEGORY_VARIANTS = {
  "turkce-pop": ["türkçe pop müzik", "türkçe pop 2025", "en popüler türkçe pop",
    "türkçe hit şarkılar", "netd müzik pop", "yeni türkçe pop"],
  "turkce-rock": ["türkçe rock", "türk rock müzik", "anadolu rock",
    "türkçe rock en iyiler", "duman mor ve ötesi"],
  "arabesk": ["arabesk müzik", "arabesk şarkılar", "türk arabesk klasikleri",
    "fasıl müzik"],
  "rap": ["türkçe rap", "türk rap müzik", "türkçe rap 2025", "rap hit"],
  "slow": ["yavaş şarkılar", "türkçe slow müzik", "slow şarkılar 2025"],
  "pop": ["pop music 2025", "pop hit songs", "en iyi pop şarkıları"],
  "lofi": ["lofi hip hop", "lofi müzik", "çalışma müziği lofi"],
  "klasik": ["klasik müzik", "piyano klasik", "beethoven müzik"],
  "arac": ["arabada dinlenen şarkılar", "yol müziği", "araba müzik listesi"]
};

const CATEGORIES = [
  { id: "turkce-pop", label: "Türkçe Pop", sub: "Hit'ler" },
  { id: "turkce-rock", label: "Türkçe Rock", sub: "Klasik + yeni" },
  { id: "arabesk", label: "Arabesk", sub: "Klasikler" },
  { id: "rap", label: "Rap", sub: "Türkçe rap" },
  { id: "slow", label: "Slow", sub: "Yavaş ritim" },
  { id: "pop", label: "Pop", sub: "Uluslararası" },
  { id: "lofi", label: "Lofi", sub: "Sakin" },
  { id: "klasik", label: "Klasik", sub: "Enstrümantal" },
  { id: "arac", label: "Yol Müziği", sub: "Sürüş listesi" }
];

const SEARCH_CHIPS = ["türkçe pop", "90lar türkçe", "arabesk", "türkçe rock",
  "rap", "slow şarkılar", "lofi", "yol müziği"];

const Catalog = (() => {
  let curCat = null;
  let curPage = 1;
  let curQuery = "";
  let seen = new Set();
  let hasMore = true;
  let seq = 0;          // yarış durdurucu

  function variantsFor(cat) { return CATEGORY_VARIANTS[cat] || [cat]; }

  function pickQuery(cat, page) {
    const list = variantsFor(cat);
    // her sayfada farklı varyasyon → aynı sorgu tekrarlanmaz
    return list[(page * 7 + seq * 3) % list.length];
  }

  /** @returns {Promise<{ok:boolean, items:Array, reason:string}>} */
  async function load(page) {
    const my = ++seq;
    const q = curQuery || pickQuery(curCat, page);
    const res = await Sources.search(q, page);
    if (my !== seq) return { ok: false, items: [], reason: "stale" };

    if (res === null) {
      hasMore = false;
      return { ok: false, items: [], reason: "all_down" };
    }
    const fresh = [];
    for (const it of res) {
      /* GÜVENLİK: videoId üçüncü taraf bir instance'tan geliyor ve HTML'e
         doğrudan yazılıyor. Biçimi doğrulanmazsa `x" onerror="…` ile
         localStorage'a (favoriler, ayarlar) erişilebilir. */
      if (!isSafeVideoId(it.videoId)) continue;
      if (seen.has(it.videoId)) continue;
      seen.add(it.videoId);
      fresh.push({
        videoId: it.videoId,
        title: it.title || "Başlıksız",
        author: it.author || "",
        dur: it.lengthSeconds || 0
      });
    }
    hasMore = fresh.length > 0;
    return { ok: true, items: fresh, reason: "" };
  }

  function openCategory(cat) {
    curCat = cat;
    curQuery = "";
    curPage = 1;
    seen = new Set();
    hasMore = true;
    return { cat, page: curPage };
  }

  function openQuery(q) {
    curCat = null;
    curQuery = q;
    curPage = 1;
    seen = new Set();
    hasMore = true;
  }

  function nextPage() { curPage++; return curPage; }
  function reset() { curPage = 1; seen = new Set(); hasMore = true; }

  return {
    get page() { return curPage; },
    get query() { return curQuery; },
    get cat() { return curCat; },
    get canLoadMore() { return hasMore; },
    load, openCategory, openQuery, nextPage, reset
  };
})();

/* ───────────── 4. Kuyruk / favoriler / geçmiş ───────────── */

let playQueue = sanitizeTracks(load(K.queue, []));
let playIndex = load(K.index, 0);
let order = sanitizeTracks(load(K.ord, null) || []);   // boşsa null
if (!order.length) order = null;
let favorites = sanitizeTracks(load(K.fav, []));
let history = sanitizeTracks(load(K.hist, []));

function persistQueue() {
  save(K.queue, playQueue);
  save(K.index, playIndex);
  save(K.ord, order);
}

function getFav(id) { return favorites.some(f => f.videoId === id); }

function toggleFav(track) {
  const i = favorites.findIndex(f => f.videoId === track.videoId);
  if (i >= 0) favorites.splice(i, 1);
  else favorites.unshift(track);
  save(K.fav, favorites);
  return i < 0;
}

function pushHistory(track) {
  history = history.filter(h => h.videoId !== track.videoId);
  history.unshift(track);
  if (history.length > 60) history.length = 60;
  save(K.hist, history);
  UI.renderHistory();     // geçmiş hep yazıldı ama hiç çizilmiyordu
}

/* ───────────── 5. Oynatıcı ───────────── */

const Player = (() => {
  let yt = null;
  let apiWaiters = [];
  let curId = "";
  let playing = false;
  let duration = 0;
  let pos = 0;
  let pollTimer = null;
  let endedGuard = "";        // aynı şarkıda çift "bitti" engeli
  let loadTimer = null;       // yükleme takılırsa yeniden kur
  let loadGen = 0;
  let consecEmbedErr = 0;     // üst üste gömülemeyen video sayacı
  let started = false;        // oynatıcı gerçekten oynamaya başladı mı?
                              // (`playing` yükleme sırasında umutlu ayarlanır;
                              //  gözcünün "oynuyorsa geç" kontrolü bunu kullanmalı)

  const EARLY_SKIP = 1.2;     // sn
  const LOAD_STUCK = 12000;   // ms
  const MAX_EMBED_ERR = 3;    // bu kadar üst üste 150/101 → dur

  /* --- YouTube API yükleme --- */
  function whenReady(fn) {
    if (window.YT && YT.Player) { fn(); return; }
    apiWaiters.push(fn);
    if (apiWaiters.length > 1) return;
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    s.onerror = () => {
      console.warn("[HU] iframe_api yüklenemedi");
      apiWaiters = [];   // bekleyenleri bırak; sonraki whenReady yeniden denesin
    };
    document.head.appendChild(s);
  }

  window.onYouTubeIframeAPIReady = function () {
    while (apiWaiters.length) { try { apiWaiters.shift()(); } catch (e) { console.error(e); } }
  };

  /* --- Oynatıcı kurulumu / yeniden kurulum --- */
  function create() {
    const host = document.createElement("div");
    host.id = "ytplayer";
    const old = document.getElementById("ytplayer");
    if (yt) { try { yt.destroy(); } catch (e) {} yt = null; }
    if (old && old.parentNode) old.parentNode.replaceChild(host, old);
    else $("#videowrap").appendChild(host);

    yt = new YT.Player(host, {
      width: "100%",
      height: "100%",
      playerVars: {
        autoplay: 1, playsinline: 1, rel: 0, modestbranding: 1,
        controls: 1,           // kalite dişlisi (⚙) erişilebilir kalsın
        iv_load_policy: 3, disablekb: 1, origin: location.origin
      },
      events: {
        onReady: onReady,
        onStateChange: onState,
        onError: onError
      }
    });
  }

  function onReady() {
    hideLoading();
    if (curId) { yt.loadVideoById(curId); armLoadWatch(); }
    try { yt.setVolume(100); } catch (e) {}
    if (playing) { try { yt.playVideo(); } catch (e) {} }
  }

  function onState(e) {
    if (e.data === YT.PlayerState.PLAYING) {
      hideLoading();
      clearTimeout(loadTimer);
      consecEmbedErr = 0;      // oynama başladı → hata serisi koptu
      playing = true;
      started = true;
      setPlayIcon(true);
      try { duration = yt.getDuration() || duration; } catch (err) {}
      armPoll();
      if (curId) Sponsor.onPlay(curId);
      UI.syncRows();
      Media.update();
    } else if (e.data === YT.PlayerState.PAUSED) {
      playing = false;
      setPlayIcon(false);
      Media.update();
    } else if (e.data === YT.PlayerState.BUFFERING) {
      if (playQueue.length) showLoading("Yükleniyor…");
    } else if (e.data === YT.PlayerState.ENDED) {
      handleEnd("ended");
    } else if (e.data === YT.PlayerState.CUED) {
      hideLoading();
    }
  }

  function onError(e) {
    const code = e && e.data;
    console.warn("[HU] YT hata", code);
    hideLoading();
    // 101/150: video sahibi gömmeyi yasakladı → atla
    if (code === 101 || code === 150) {
      // Kuyruğun tamamı gömülemiyorsa sonsuz tarama yapma: dur ve bildir.
      if (++consecEmbedErr >= MAX_EMBED_ERR) {
        consecEmbedErr = 0;
        clearTimeout(loadTimer);
        playing = false;
        setPlayIcon(false);
        clearInterval(pollTimer);
        UI.showState(
          "Bu videolar gömülemiyor",
          "YouTube bu kayıtların sayfaya gömülmesine izin vermiyor (hata 150/101). " +
          "Başka bir arama sonucu deneyin.");
        toast("Üst üste " + MAX_EMBED_ERR + " video gömülemiyor — durduruldu", "warn");
        return;
      }
      toast("Bu video gömülmeye kapalı, atlanıyor", "warn");
      setTimeout(() => Queue.next(true), 1400);
      return;
    }
    consecEmbedErr = 0;
    // 2/5/100: geçici — oynatıcıyı bir kez yeniden kur, aynı videoyu dene
    if (code === 2 || code === 5 || code === 100) {
      if (loadGen > 2) { toast("Video yüklenemedi", "warn"); return; }
      loadGen++;
      /* onReady'ı ELLE ÇAĞIRMA: YT.Player kurulumu asenkordur, API zaten
         events.onReady ile çağırır. Elle çağırırsak video iki kez yüklenir. */
      setTimeout(() => create(), 700);
    }
  }

  /* --- "Bitti" gözcüsü ---
     YouTube embed'lerinde ENDED olayı güvenilmez (reklam / oynatma
     kuyruğu nedeniyle hiç gelmez veya geç gelir). Bu yüzden oynama
     konumunu 500ms'de bir yoklar, süre sonuna yaklaşınca biz geçeriz. */
  function armPoll() {
    clearInterval(pollTimer);
    pollTimer = setInterval(tick, 500);
    armLoadWatch();
  }

  function tick() {
    if (!yt || !curId) return;
    try {
      pos = yt.getCurrentTime() || 0;
      const d = yt.getDuration() || 0;
      if (d > 0) duration = d;
    } catch (e) { return; }
    UI.progress(pos, duration);
    Media.tick(pos, duration);   // kilit ekranı/uzaktan konumu da güncellensin
    if (settings.earlySkip && duration > 5 && pos >= duration - EARLY_SKIP) {
      handleEnd("early");
    }
  }

  function armLoadWatch() {
    clearTimeout(loadTimer);
    loadTimer = setTimeout(() => {
      if (started) return;     // gerçekten oynamaya başladı → takılı değil
      if (loadGen >= 3) { showLoading("Yüklenemedi — sonrakine geçiliyor"); Queue.next(true); return; }
      loadGen++;
      console.warn("[HU] yükleme takıldı, oynatıcı yeniden kuruluyor");
      showLoading("Yeniden deneniyor…");
      create();                // onReady API tarafından ayrıca çağrılır
    }, LOAD_STUCK);
  }

  function handleEnd(reason) {
    if (!curId) return;
    if (endedGuard === curId) return;
    endedGuard = curId;
    clearInterval(pollTimer);
    clearTimeout(loadTimer);
    playing = false;

    if (Sleep.due()) { Sleep.fire(); return; }

    if (settings.repeat === "one") {
      endedGuard = "";
      try { yt.seekTo(0, true); yt.playVideo(); } catch (e) {}
      armPoll();
      return;
    }
    if (!settings.autoNext) {
      setPlayIcon(false);
      UI.progress(duration, duration);
      return;
    }
    const hadNext = Queue.next(true);
    if (!hadNext) { endedGuard = ""; setPlayIcon(false); }
  }

  /* --- Genel API --- */
  function loadTrack(track) {
    curId = track.videoId;
    endedGuard = "";
    loadGen = 0;
    duration = track.dur || 0;
    pos = 0;
    playing = true;
    started = false;           // başlangıçta TAKILDI varsay; PLAYING gelince doğru olur
    setPlayIcon(true);
    UI.title(track);
    UI.progress(0, duration);
    showLoading("Yükleniyor…");
    pushHistory(track);
    Media.update();

    whenReady(() => {
      if (!yt) { create(); return; }
      if (yt && yt.loadVideoById) {
        try { yt.loadVideoById(curId); armLoadWatch(); return; }
        catch (e) { console.warn(e); }
      }
      create();
    });
  }

  function toggle() {
    if (!curId) {
      /* Uygulama yeniden başlatıldı: kuyruk geri yüklendi ama oynatıcı
         boş. Kayıtlı sıradaki şarkıyı ÇAL, bir sonrakine atlama. */
      if (playQueue.length && Queue.index >= 0 && Queue.index < playQueue.length) {
        Queue.setIndex(Queue.index);
        return;
      }
      Queue.next(true);
      return;
    }
    try {
      const st = yt.getPlayerState();
      if (st === 1) { yt.pauseVideo(); }
      else { yt.playVideo(); endedGuard = ""; }
    } catch (e) {}
  }

  function seek(sec) {
    if (!yt || !yt.seekTo) return;
    try {
      yt.seekTo(Math.max(0, sec), true);
      endedGuard = "";
      pos = sec;
      UI.progress(sec, duration);
      if (settings.earlySkip && duration > 5 && sec >= duration - EARLY_SKIP) {
        setTimeout(() => handleEnd("seek"), 400);
      }
    } catch (e) {}
  }

  function showLoading(text) {
    $("#loadingText").textContent = text || "Yükleniyor…";
    $("#loading").classList.add("show");
  }
  function hideLoading() { $("#loading").classList.remove("show"); }

  function setPlayIcon(on) {
    $("#playIcon").innerHTML = on
      ? '<path d="M6 5h4v14H6zm8 0h4v14h-4z"/>'
      : '<path d="M8 5v14l11-7z"/>';
    $("#playBtn").setAttribute("aria-label", on ? "Duraklat" : "Oynat");
  }

  function stop() {
    clearInterval(pollTimer);
    clearTimeout(loadTimer);
    playing = false;
    curId = "";
    setPlayIcon(false);
    hideLoading();
    try { if (yt && yt.stopVideo) yt.stopVideo(); } catch (e) {}
  }

  whenReady(() => create());

  return {
    loadTrack, toggle, seek, stop,
    get playing() { return playing; },
    get id() { return curId; },
    get duration() { return duration; },
    get position() { return pos; },
    get instance() { return yt; }
  };
})();

/* ───────────── 6. SponsorBlock ───────────── */

const Sponsor = (() => {
  const BASE = "https://sponsor.ajay.app/api/skipSegments";
  let segs = [];
  let timer = null;
  let lastSkip = null;
  let seq = 0;           // bayat yanıt muhafızı: geç gelen cevabı reddet

  function activeCats() {
    return Object.keys(settings.sponsorCats).filter(k => settings.sponsorCats[k]);
  }

  async function fetchFor(videoId) {
    const vid = videoId;
    const token = ++seq;
    segs = [];
    lastSkip = null;
    clearInterval(timer);
    if (!settings.sponsor || !vid) return;
    try {
      const url = BASE + "?videoID=" + encodeURIComponent(vid) +
        "&categories=" + encodeURIComponent(JSON.stringify(activeCats()));
      const res = await fetchTimeout(url, 8000);

      /* await sonrası DURUM KONTROLÜ: bu arada şarkı değişmiş, ayar
         kapatılmış veya yeni bir istek başlamış olabilir. Bayat segmentler
         başka bir videoya uygulanırsa rastgele zıplamalar olur. */
      if (token !== seq || !settings.sponsor || Player.id !== vid) return;

      if (!res.ok) return;                 // 404 = bu videoda segment yok
      const data = await res.json();
      if (token !== seq || !settings.sponsor || Player.id !== vid) return;

      segs = Array.isArray(data) ? data : [];
      if (segs.length) {
        timer = setInterval(check, 350);
        check();
      }
    } catch (e) { if (token === seq) segs = []; }
  }

  function check() {
    if (!segs.length || !Player.instance) return;
    let t = 0;
    try { t = Player.instance.getCurrentTime() || 0; } catch (e) { return; }

    for (const s of segs) {
      if (!s || typeof s.segment !== "object") continue;
      const [a, b] = s.segment;
      /* atlanan bölümün tekrar tetiklenmesini engelle.
         DİKKAT: `a` 0 olabilir → `!lastSkip` ile kontrol EDİLMEZ,
         yalnızca katı eşitsizlik kullanılır. */
      if (t >= a - 0.15 && t < b && lastSkip !== a) {
        lastSkip = a;
        try { Player.instance.seekTo(b, true); } catch (e) {}
        UI.skipChip(CAT_LABELS[s.category] || "Bölüm");
        return;
      }
    }
  }

  function onPlay(videoId) { fetchFor(videoId); }

  function stopAll() {
    seq++;                 // bekleyen istekleri geçersiz kıl
    clearInterval(timer);
    segs = [];
    lastSkip = null;
  }

  return { onPlay, stopAll, get count() { return segs.length; } };
})();

/* ───────────── 6b. Uyku zamanlayıcı ───────────── */

const Sleep = (() => {
  let until = 0;
  let mins = 0;
  let timer = null;
  let active = false;
  let expired = false;

  /* Zamanlayıcı KALICIDIR: başlıktaki ekran bir arabada sık sık
     yeniden başlatılır (motor stop/start). 90 dk "park" zamanlayıcısı
     kaybolursa müzik tüm gece çalar. */

  function arm(delay) {
    clearTimeout(timer);
    timer = setTimeout(onExpire, Math.max(0, delay));
  }

  function onExpire() {
    expired = true;
    UI.sleep();
    toast("Uyku süresi doldu — bu şarkı bitince duracak");
    if (!Player.playing) fire();   // zaten duruyorsa beklemeden kapat
  }

  function persist() {
    if (active) save(K.sleep, { until: until, mins: mins });
    else try { localStorage.removeItem(K.sleep); } catch (e) {}
  }

  function set(minutes) {
    if (!minutes) { off(); return; }
    active = true;
    expired = false;
    mins = minutes;
    until = Date.now() + minutes * 60000;
    /* Süre dolunca şarkıyı BÖLME: şarkı bitiminde dur. */
    arm(minutes * 60000);
    persist();
    UI.sleep();
    toast("Uyku: " + minutes + " dk sonra duracak");
  }

  function off() {
    clearTimeout(timer);
    active = false;
    expired = false;
    until = 0;
    mins = 0;
    persist();
    UI.sleep();
  }

  function fire() {
    if (!active) return;
    off();
    Player.stop();
    toast("Uyku zamanlayıcı — müzik durdu");
  }

  /* Uygulama yeniden başlatıldıysa kalan süreyi geri yükle. */
  (function restore() {
    const s = load(K.sleep, null);
    if (s && s.until && s.until > Date.now()) {
      active = true;
      expired = false;
      until = s.until;
      mins = s.mins || Math.max(1, Math.round((s.until - Date.now()) / 60000));
      arm(s.until - Date.now());
    } else if (s) {
      try { localStorage.removeItem(K.sleep); } catch (e) {}
    }
  })();

  return {
    set, off, fire,
    /** Şarkı bitişinde çağrılır: süre dolduysa burası doğrudur. */
    due() { return active && expired; },
    get active() { return active; },
    get expired() { return expired; },
    get minutes() { return mins; },
    get remaining() { return active ? Math.max(0, until - Date.now()) : 0; }
  };
})();

/* ───────────── 6c. Kuyruk yönetimi ───────────── */

const Queue = (() => {
  let idx = playIndex;
  let reindexTimer = null;

  function sync() {
    playIndex = idx;
    persistQueue();
    clearTimeout(reindexTimer);
    reindexTimer = setTimeout(UI.renderQueue, 60);
    UI.syncRows();
  }

  /** Listeyi kuyruğa alıp verilen sıradan çalar. */
  function play(list, startAt) {
    // Sıra, filtrelere göre HESAPLANMADAN ÖNCE bulunmalı: liste boş
    // girişlerden arındırılırsa kayan indis yanlış şarkayı seçer.
    const startId = list[startAt] && list[startAt].videoId;
    const clean = list.filter(x => x && x.videoId);
    if (!clean.length) { toast("Çalınacak şey yok", "warn"); return; }
    playQueue = clean;
    order = null;                       // yeni liste → özgün sıra tazelensin
    const byId = startId ? clean.findIndex(x => x.videoId === startId) : -1;
    idx = Math.max(0, Math.min(clean.length - 1, byId >= 0 ? byId : (startAt | 0)));
    sync();
    Player.loadTrack(playQueue[idx]);
  }

  function at(i) { return playQueue[i] || null; }

  function next(auto) {
    if (!playQueue.length) return false;
    /* Yeniden başlatma sonrası hiçbir şey oynamıyorsa: mevcut sıradaki
       şarkıyı başlat, atlayarak başlama. */
    if (!Player.id) { sync(); Player.loadTrack(playQueue[idx]); return true; }

    if (settings.shuffle && playQueue.length > 1) {
      /* Karışık mod aktifken ileri/geri hep rastgele bir sonrakiyi seçer. */
      let n = idx, guard = 0;
      do { n = Math.floor(Math.random() * playQueue.length); } while (n === idx && ++guard < 20);
      idx = n;
    } else if (idx + 1 < playQueue.length) {
      idx++;
    } else if (settings.repeat === "all" || settings.loopQueue) {
      idx = 0;
    } else {
      toast("Kuyruk bitti");
      Player.stop();
      return false;
    }
    sync();
    Player.loadTrack(playQueue[idx]);
    return true;
  }

  function prev() {
    if (!playQueue.length) return false;
    if (!Player.id) { sync(); Player.loadTrack(playQueue[idx]); return true; }
    // şarkının başındaysak gerçekten öncekine git
    if (Player.position > 4) { Player.seek(0); return true; }
    if (settings.shuffle && playQueue.length > 1) {
      let n = idx, guard = 0;
      do { n = Math.floor(Math.random() * playQueue.length); } while (n === idx && ++guard < 20);
      idx = n;
    } else if (idx > 0) idx--;
    else if (settings.repeat === "all" || settings.loopQueue) idx = playQueue.length - 1;
    else { Player.seek(0); return true; }
    sync();
    Player.loadTrack(playQueue[idx]);
    return true;
  }

  function removeAt(i) {
    if (i < 0 || i >= playQueue.length) return;
    const removedIsCurrent = i === idx;
    playQueue.splice(i, 1);
    if (i < idx) idx--;
    if (!playQueue.length) { idx = 0; Player.stop(); }
    else if (removedIsCurrent) { idx = Math.min(idx, playQueue.length - 1); Player.loadTrack(playQueue[idx]); }
    sync();
    UI.renderQueue();
  }

  /* clear → oynatmayı da durdur: kuyruk boşken "çalan şarkı" görünmesin */
  function clear() {
    playQueue = [];
    idx = 0;
    order = null;
    Player.stop();
    sync();
    UI.renderQueue();
  }

  /* Karıştır bir GİTTİ-DÜĞME'dir, tek seferlik işlem değil.
     Orijinal sırayı saklarız ki kapatınca geri dönebilsin. */
  function shuffle() {
    if (playQueue.length < 2) return;
    if (!order) order = playQueue.slice();
    const cur = playQueue[idx];
    for (let i = playQueue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [playQueue[i], playQueue[j]] = [playQueue[j], playQueue[i]];
    }
    idx = Math.max(0, playQueue.indexOf(cur));
    sync();
    UI.renderQueue();
  }

  /** Karıştırmayı kapat → karıştırılmamış özgün sıraya dön. */
  function unshuffle() {
    if (!order) return false;
    const cur = playQueue[idx];
    const added = playQueue.filter(t => order.indexOf(t) < 0);  // sıraya sonradan eklenenler
    playQueue = order.concat(added);
    order = null;
    idx = Math.max(0, playQueue.indexOf(cur));
    if (idx < 0) idx = 0;
    sync();
    UI.renderQueue();
    return true;
  }

  function setIndex(i) {
    if (i < 0 || i >= playQueue.length) return;
    idx = i;
    sync();
    Player.loadTrack(playQueue[idx]);
  }

  /* Sıra düzenleme sürüklemeyle DEĞİL: arabada hassas jest çalıştırılamaz.
     Kuyruk satırlarına dokunarak oradan çalınır, satır X ile çıkarılır. */

  return {
    play, next, prev, removeAt, clear, shuffle, unshuffle, setIndex,
    get index() { return idx; },
    get list() { return playQueue; }
  };
})();

/* ───────────── 7. Arayüz ───────────── */

const UI = (() => {

  /* --- sekmeler --- */
  function setTab(name) {
    $$(".tab").forEach(b => {
      const on = b.dataset.tab === name;
      b.classList.toggle("on", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });
    $$(".view").forEach(v => v.classList.toggle("on", v.id === "view-" + name));
    if (name === "queue") renderQueue();
    if (name === "fav") renderFav();
    /* "search" sekmesine geçince input'a OTOMATİK ODAK VERİLMEZ:
       klavye sürüşte kendiliğinden açılmasın. Kullanıcı kendi dokunur. */
  }

  /* --- satır üretici --- */
  function thumbUrl(id) { return "https://i.ytimg.com/vi/" + id + "/default.jpg"; }

  function rowHtml(t, opts) {
    opts = opts || {};
    /* Doğrulanmamış kimlik ÇİZİLMEZ — buraya gelen her şey bir üçüncü
       taraf instance'ından geliyor. Ayrıca özniteliklerde kaçırma uygula. */
    if (!t || !isSafeVideoId(t.videoId)) return "";
    const vid = esc(t.videoId);
    const playing = Player.id === t.videoId;
    const fav = getFav(t.videoId);
    const sub = [];
    if (t.author) sub.push(t.author);
    if (t.dur) sub.push(fmt(t.dur));
    if (opts.showIndex) sub.unshift(opts.showIndex);
    return (
      '<div class="row' + (playing ? " playing" : "") + '" data-id="' + vid + '"' +
        (opts.index != null ? ' data-i="' + opts.index + '"' : "") + '>' +
      '<img class="r-thumb" src="' + esc(thumbUrl(t.videoId)) + '" alt="" loading="lazy"' +
        ' onerror="this.style.visibility=\'hidden\'">' +
      '<div class="r-main">' +
        '<div class="r-title">' + esc(t.title) + "</div>" +
        '<div class="r-sub">' + esc(sub.join(" · ")) + "</div>" +
      "</div>" +
      (opts.removable
        ? '<button class="r-act" data-act="remove" aria-label="Kuyruktan çıkar">' +
          '<svg viewBox="0 0 24 24"><path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg></button>'
        : '<button class="r-act' + (fav ? " on" : "") + '" data-act="fav" aria-label="Favori">' +
          '<svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg></button>') +
      "</div>"
    );
  }

  function esc(s) { return escHtml(s); }

  /** Satır tıklamalarını tek dinleyiciyle ele alır. */
  function delegate(container, getTracks, opts) {
    container.addEventListener("click", e => {
      const btn = e.target.closest("[data-act]");
      const row = e.target.closest(".row");
      if (!row) return;
      const list = getTracks();
      const i = list.findIndex(x => x.videoId === row.dataset.id);

      if (btn && btn.dataset.act === "fav") {
        e.stopPropagation();
        const t = list[i];
        if (!t) return;
        const added = toggleFav(t);
        toast(added ? "Favorilere eklendi" : "Favoriden çıkarıldı");
        btn.classList.toggle("on", added);
        renderQueue(); renderFav();
        return;
      }
      if (btn && btn.dataset.act === "remove") {
        e.stopPropagation();
        const ri = parseInt(row.dataset.i, 10);
        Queue.removeAt(isNaN(ri) ? i : ri);
        return;
      }
      if (i >= 0) Queue.play(list, i);
    });
  }

  /* --- listeler --- */
  let homeTracks = [];
  let searchTracks = [];

  function skeleton(n) {
    return Array(n).fill('<div class="skel"></div>').join("");
  }

  function emptyState(title, sub, btnLabel, btnId) {
    return '<div class="state"><b>' + esc(title) + "</b>" + esc(sub || "") +
      (btnLabel ? '<button id="' + btnId + '">' + esc(btnLabel) + "</button>" : "") + "</div>";
  }

  /** Oynatıcıdan gelen kritik durumu görünür listeye basar. */
  function showState(title, sub) {
    setTab("home");
    $("#homeList").innerHTML = emptyState(title, sub, "Listeyi yenile", "stateRetryBtn");
    $("#loadMoreBtn").hidden = true;
    const b = $("#stateRetryBtn");
    if (b) b.onclick = () => openCategory(Catalog.cat || CATEGORIES[0].id);
  }

  function renderTiles() {
    $("#tiles").innerHTML = CATEGORIES.map(c =>
      '<button class="tile" data-cat="' + c.id + '"><b>' + esc(c.label) +
      "</b><span>" + esc(c.sub) + "</span></button>").join("");
  }

  async function openCategory(catId) {
    const meta = CATEGORIES.find(c => c.id === catId);
    Catalog.openCategory(catId);
    $$("#tiles .tile").forEach(t => t.classList.toggle("on", t.dataset.cat === catId));
    $("#listHead").textContent = meta ? meta.label : "Sonuçlar";
    $("#shuffleStationBtn").hidden = false;
    $("#loadMoreBtn").hidden = true;
    $("#homeList").innerHTML = skeleton(5);
    $("#homeScroll").scrollTop = 0;

    const res = await Catalog.load(1);
    if (Catalog.cat !== catId) return;
    if (!res.ok) {
      $("#homeList").innerHTML = emptyState(
        "Arama kaynağına ulaşılamadı",
        "Tüm Invidious instance'ları yanıt vermedi. Ayarlar → 'Kaynakları test et' ile kontrol edin.",
        "Tekrar dene", "homeRetryBtn");
      const b = $("#homeRetryBtn");
      if (b) b.onclick = () => openCategory(catId);
      return;
    }
    homeTracks = res.items;
    paintHome();
  }

  function paintHome() {
    if (!homeTracks.length) {
      $("#homeList").innerHTML = emptyState("Sonuç yok", "Başka bir kategori deneyin.");
    } else {
      $("#homeList").innerHTML = homeTracks.map(t => rowHtml(t)).join("");
    }
    $("#loadMoreBtn").hidden = !Catalog.canLoadMore;
    syncRows();
  }

  async function loadMoreHome() {
    const cat = Catalog.cat;
    if (!cat) return;
    $("#loadMoreBtn").disabled = true;
    const page = Catalog.nextPage();
    const res = await Catalog.load(page);
    $("#loadMoreBtn").disabled = false;
    if (Catalog.cat !== cat) return;
    if (res.ok) { homeTracks = homeTracks.concat(res.items); paintHome(); }
    else if (res.reason === "stale") {
      /* Bu yükleme başkası tarafından geçersiz kılındı: "Daha fazla"
         düğmesini GİZLEME, kullanıcı tekrar deneyebilsin. */
      toast("Yeni sonuç geldi, liste yenilendi");
    }
    else if (res.reason === "all_down") toast("Kaynaklara ulaşılamadı", "warn");
    else $("#loadMoreBtn").hidden = true;
  }

  function renderQueue() {
    const n = playQueue.length;
    $("#queueCount").textContent = n ? "Kuyruk · " + n : "Kuyruk";
    if (!n) {
      $("#queueList").innerHTML = emptyState("Kuyruk boş", "Keşfet sekmesinden şarkı seçin.");
      return;
    }
    $("#queueList").innerHTML = playQueue.map((t, i) =>
      rowHtml(t, { removable: true, showIndex: (i + 1) + ".", index: i })).join("");
  }

  function renderFav() {
    if (!favorites.length) {
      $("#favList").innerHTML = emptyState(
        "Henüz favori yok", "Satırlardaki ♥ düğmesiyle ekleyebilirsin.");
      return;
    }
    $("#favList").innerHTML = favorites.map(t => rowHtml(t)).join("");
    syncRows();
  }

  /* Son çalanlar: başlangıçta "neyi dinliyordum" sorusunu yanıtlar.
     Araba ekranında uzun liste değil, en fazla 6 satır. */
  function renderHistory() {
    const head = $("#histHead"), list = $("#histList");
    if (!head || !list) return;
    const items = history.slice(0, 6);
    head.hidden = !items.length;
    list.innerHTML = items.map(t => rowHtml(t)).join("");
    if (items.length) syncRows();
  }

  function renderSearch() {
    if (!searchTracks.length) {
      $("#searchList").innerHTML = emptyState(
        "Ara", "Bir sanatçı veya şarkı yazın.", null, null);
      return;
    }
    $("#searchList").innerHTML = searchTracks.map(t => rowHtml(t)).join("");
    syncRows();
  }

  async function doSearch(q) {
    q = (q || "").trim();
    if (!q) return;
    let hist = load(K.srch, []);
    hist = [q].concat(hist.filter(x => x !== q)).slice(0, 8);
    save(K.srch, hist);
    renderChips();

    Catalog.openQuery(q);
    $("#searchList").innerHTML = skeleton(5);
    $("#searchScroll").scrollTop = 0;
    searchTracks = [];

    const res = await Catalog.load(1);
    if (Catalog.query !== q) return;
    if (!res.ok) {
      $("#searchList").innerHTML = emptyState(
        "Kaynaklara ulaşılamadı",
        "Tüm arama instance'ları başarısız. Bağlantınızı kontrol edip tekrar deneyin.",
        "Tekrar dene", "searchRetryBtn");
      const b = $("#searchRetryBtn");
      if (b) b.onclick = () => doSearch(q);
      return;
    }
    searchTracks = res.items;
    renderSearch();
  }

  function renderChips() {
    const hist = load(K.srch, []);
    const all = hist.concat(SEARCH_CHIPS.filter(c => hist.indexOf(c) < 0));
    $("#searchChips").innerHTML = all.map(c =>
      '<button class="chip" data-q="' + esc(c) + '">' + esc(c) + "</button>").join("");
  }

  /* --- oynatma durumu --- */
  function title(track) {
    $("#npTitle").textContent = track.title || "Şarkı seçilmedi";
    $("#npMeta").textContent = [track.author, track.dur ? fmt(track.dur) : ""]
      .filter(Boolean).join(" · ");
    document.title = (track.title || "SuperYT") + " — SuperYT";
    syncRows();
  }

  function progress(pos, dur) {
    const pct = dur > 0 ? Math.min(100, (pos / dur) * 100) : 0;
    $("#pFill").style.width = pct + "%";
    $("#pKnob").style.left = pct + "%";
    $("#tCur").textContent = fmt(pos);
    $("#tRem").textContent = "-" + fmt(Math.max(0, dur - pos));
  }

  function syncRows() {
    $$(".row").forEach(r => r.classList.toggle("playing", r.dataset.id === Player.id));
  }

  let chipTimer = null;
  function skipChip(label) {
    const c = $("#skipChip");
    c.textContent = "Atlandı: " + label;
    c.classList.add("show");
    clearTimeout(chipTimer);
    chipTimer = setTimeout(() => c.classList.remove("show"), 1800);
  }

  /* --- parlaklık --- */
  function applyDim(v) {
    settings.dim = Math.max(0, Math.min(85, v | 0));
    $("#dimOverlay").style.opacity = String(settings.dim / 100);
    $("#dimVal").textContent = settings.dim + "%";
    const big = $("#dimBigVal");
    if (big) big.textContent = settings.dim + "%";
    ["#dimRange", "#dimRangeBig"].forEach(id => {
      const n = $(id);
      if (n && n.value !== String(settings.dim)) n.value = String(settings.dim);
    });
    $$("#dimPills .pill").forEach(p =>
      p.classList.toggle("on", parseInt(p.dataset.v, 10) === settings.dim));
    $("#brightLabel").textContent = settings.dim ? settings.dim + "%" : "Parlaklık";
    $("#brightBtn").classList.toggle("on", settings.dim > 0);
    /* Kaydırıcı her pikselde tetiklenir; yavaş webview'lerde
       localStorage yazımı takılır. Görsel anında, yazma gecikmeli. */
    saveSettingsSoon();
  }

  /* --- uyku rozeti --- */
  function sleep() {
    const b = $("#sleepBtn");
    if (Sleep.active) {
      b.classList.add("on");
      if (Sleep.expired) $("#sleepLabel").textContent = "Bitiyor";
      else $("#sleepLabel").textContent =
        Math.max(1, Math.round(Sleep.remaining / 60000)) + " dk";
    } else {
      $("#sleepLabel").textContent = "Uyku";
      b.classList.remove("on");
    }
    /* Hap durumu her zaman GERÇEK zamanlayıcıdan türetilir — süre kendi
       kendine dolduğunda hap seçili kalmaz. */
    $$("#sleepPills .pill").forEach(p =>
      p.classList.toggle("on", Sleep.active && parseInt(p.dataset.m, 10) === Sleep.minutes));
  }

  /* Rozeti dakikada bir tazele ki kalan süre donmuş görünmesin. */
  setInterval(() => { if (Sleep.active) sleep(); }, 20000);

  /* --- sayfalar (sheet) --- */
  function openSheet(id) {
    closeSheets();
    $("#" + id).classList.add("on");
    $("#sheetScrim").classList.add("on");
  }
  function closeSheets() {
    $$(".sheet").forEach(s => s.classList.remove("on"));
    $("#sheetScrim").classList.remove("on");
  }

  /* --- ipuçları --- */
  const TIPS = [
    { icon: "⚙", t: "Kalite ayarı",
      d: "Çözünürlüğü videonun kendi <b>⚙ dişlisinden</b> seçin. Önce video alanına dokunup kontrolleri gösterin, sonra sağ alttaki dişli → <b>Kalite</b>." },
    { icon: "🎧", t: "Kuyruk ve keşfet yan yana",
      d: "Ekran <b>sol: video</b>, <b>sağ: liste</b> olacak şekilde tasarlandı. Şarkı seçerken video kesintisiz devam eder — sürüşte ekran gezmenize gerek yok." },
    { icon: "⏰", t: "Uyku zamanlayıcı",
      d: "Park ettiğinizde müziği <b>otomatik kapatır</b>. Alt bardaki <b>Uyku</b> düğmesinden süre seçin." },
    { icon: "☀", t: "Gece parlaklığı",
      d: "<b>Parlaklık</b> düğmesi ekranı karartır, ses etkilenmez. Gece sürüşünde gözünüzü yormaz." },
    { icon: "⏭", t: "SponsorBlock",
      d: "Şarkılardaki <b>reklam, giriş ve outro</b> bölümleri kendiliğinden atlanır. Ayarlar'dan kategori bazında kapatabilirsiniz." }
  ];
  let tipIdx = 0;

  function renderTips() {
    const t = TIPS[tipIdx];
    $("#tipsIcon").textContent = t.icon;
    $("#tipsTitle").textContent = t.t;
    $("#tipsText").innerHTML = t.d;
    $("#tipsDots").innerHTML = TIPS.map((_, i) =>
      '<i class="' + (i === tipIdx ? "on" : "") + '"></i>').join("");
    $("#tipsNext").textContent = tipIdx === TIPS.length - 1 ? "Başla" : "İleri";
  }
  function showTips() { tipIdx = 0; renderTips(); $("#tipsModal").classList.add("on"); }
  function tipsNext() {
    if (tipIdx >= TIPS.length - 1) { closeTips(); return; }
    tipIdx++;
    renderTips();
  }
  function closeTips() {
    $("#tipsModal").classList.remove("on");
    try { localStorage.setItem(K.onb, "1"); } catch (e) {}
  }

  /* --- kaynak durumu --- */
  function renderSources() {
    const rows = Sources.status();
    $("#sourceList").innerHTML = rows.map(r =>
      '<div class="srow"><div class="srow-main">' +
      '<div class="srow-label" style="font-size:12.5px">' + esc(r.host.replace("https://", "")) + "</div>" +
      '<div class="srow-sub">başarı ' + r.rec.ok + " · hata " + r.rec.fail +
      (r.rec.avg ? " · " + r.rec.avg + "ms" : "") + "</div></div>" +
      '<span class="rangeval" style="font-size:11px;' +
      (r.state.indexOf("sağlıklı") >= 0 ? "color:var(--good)" :
       r.state.indexOf("askıda") >= 0 ? "color:var(--bad)" : "") + '">' +
      esc(r.state) + "</span></div>").join("");
  }

  return {
    setTab, rowHtml, delegate, skeleton, emptyState,
    renderTiles, openCategory, loadMoreHome,
    renderQueue, renderFav, renderHistory, renderSearch, doSearch, renderChips,
    title, progress, syncRows, skipChip,
    applyDim, sleep,
    openSheet, closeSheets, showTips, tipsNext, tipsSkip: closeTips, renderSources, showState,
    get homeTracks() { return homeTracks; },
    get searchTracks() { return searchTracks; }
  };
})();

/* ───────────── 8. Media Session (direksiyon tuşları) ───────────── */

const Media = (() => {
  /* Eski webview'lerde mediaSession olmayabilir — arayüz yine çalışmalı. */
  if (!("mediaSession" in navigator)) return { update() {}, tick() {} };

  function currentTrack() {
    const i = Queue.index;
    return playQueue[i] || null;
  }

  function update() {
    const t = currentTrack();
    try {
      if (t) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: t.title,
          artist: t.author || "Bilinmeyen",
          album: "SuperYT",
          artwork: [
            { src: "https://i.ytimg.com/vi/" + t.videoId + "/hqdefault.jpg", sizes: "480x360", type: "image/jpeg" },
            { src: "https://i.ytimg.com/vi/" + t.videoId + "/maxresdefault.jpg", sizes: "1280x720", type: "image/jpeg" }
          ]
        });
        try {
          navigator.mediaSession.setPositionState({
            duration: Player.duration || 0,
            position: Math.min(Player.position, Player.duration || 0),
            playbackRate: Player.playing ? 1 : 0
          });
        } catch (e) {}
        navigator.mediaSession.playbackState = Player.playing ? "playing" : "paused";
      }
    } catch (e) {}
  }

  function bind() {
    const safe = (name, fn) => {
      try { navigator.mediaSession.setActionHandler(name, fn); } catch (e) {}
    };
    safe("play", () => { if (!Player.playing) Player.toggle(); });
    /* DİKKAT: "pause" geldiğinde toggle YAPMA — zaten duruyorsa bu
       komut oynatmayı BAŞLATIR. Ayrı eylemler kullan. */
    safe("pause", () => { if (Player.playing) Player.toggle(); });
    safe("previoustrack", () => Queue.prev());
    safe("nexttrack", () => Queue.next(false));
    safe("seekbackward", () => Player.seek(Math.max(0, Player.position - 10)));
    safe("seekforward", () => Player.seek(Player.position + 10));
    safe("stop", () => Player.stop());
  }

  bind();

  /* Oynama sırasında konum ÇOK SEKME'DE BİR güncellensin: sistem
     uzaktan kumanda çubuğu donmuş görünmesin, ama 500ms'de bir
     MediaMetadata nesnesi kurup GC yükü çıkarmasın. */
  let lastTick = 0;
  function tick(pos, dur) {
    const now = Date.now();
    if (now - lastTick < 4000) return;
    lastTick = now;
    update();
  }

  return { update, tick };
})();

/* ───────────── 9. Olay bağlama & başlangıç ───────────── */

function bindEvents() {

  /* sekmeler */
  $$(".tab").forEach(b => b.addEventListener("click", () => UI.setTab(b.dataset.tab)));

  /* taşıma */
  $("#playBtn").addEventListener("click", () => Player.toggle());
  $("#nextBtn").addEventListener("click", () => Queue.next(false));
  $("#prevBtn").addEventListener("click", () => Queue.prev());

  $("#shuffleBtn").addEventListener("click", () => applyShuffle(!settings.shuffle, true));

  /* Karıştırma MODU: düğme yalnızca görseli değil, oynatma davranışını
     da değiştirir (next/prev rastgele seçer) ve kapatılınca özgün sıraya
     döner. */
  function applyShuffle(on, announce) {
    settings.shuffle = !!on;
    saveSettings();
    $("#shuffleBtn").classList.toggle("on", settings.shuffle);
    $("#shuffleBtn").setAttribute("aria-pressed", settings.shuffle ? "true" : "false");
    if (settings.shuffle) {
      Queue.shuffle();
      if (announce) toast("Karıştırma açık");
    } else {
      const restored = Queue.unshuffle();
      if (announce) toast(restored ? "Özgün sıraya dönüldü" : "Karıştırma kapalı");
    }
  }
  $("#repeatBtn").addEventListener("click", () => {
    const i = REPEATS.indexOf(settings.repeat);
    settings.repeat = REPEATS[(i + 1) % REPEATS.length];
    saveSettings();
    const b = $("#repeatBtn");
    b.classList.toggle("on", settings.repeat !== "off");
    b.setAttribute("aria-pressed", settings.repeat);
    b.title = REPEAT_LABEL[settings.repeat];
    toast(REPEAT_LABEL[settings.repeat]);
  });

  /* ilerleme çubuğu — sürükleme */
  const bar = $("#bar");
  let scrubbing = false;
  function seekFromEvent(e) {
    const r = bar.getBoundingClientRect();
    /* PointerEvent'de `touches` YOKTUR (o TouchEvent'e özgü) — doğrudan
       clientX kullan. */
    const x = e.clientX - r.left;
    const pct = Math.max(0, Math.min(1, x / r.width));
    Player.seek(pct * Player.duration);
  }
  bar.addEventListener("pointerdown", e => {
    if (!Player.duration) return;
    scrubbing = true;
    bar.classList.add("scrub");
    bar.setPointerCapture && bar.setPointerCapture(e.pointerId);
    seekFromEvent(e);
  });
  bar.addEventListener("pointermove", e => { if (scrubbing) seekFromEvent(e); });
  bar.addEventListener("pointerup", () => { scrubbing = false; bar.classList.remove("scrub"); });
  bar.addEventListener("pointercancel", () => { scrubbing = false; bar.classList.remove("scrub"); });
  bar.addEventListener("keydown", e => {
    if (e.key === "ArrowRight") Player.seek(Player.position + 5);
    if (e.key === "ArrowLeft") Player.seek(Math.max(0, Player.position - 5));
  });

  /* Video alanına dokunma katmanı YOKTUR: YouTube iframe'i dokunmayı
     kendisi alır (oynat/duraklat + kontroller + ⚙ kalite dişlisi).
     Üstüne katman koyarsak dişliye asla ulaşılamaz. */

  /* kategori karoları */
  $("#tiles").addEventListener("click", e => {
    const t = e.target.closest(".tile");
    if (t) UI.openCategory(t.dataset.cat);
  });
  $("#loadMoreBtn").addEventListener("click", () => UI.loadMoreHome());
  $("#shuffleStationBtn").addEventListener("click", () => {
    const list = UI.homeTracks;
    if (list.length) {
      const shuffled = list.slice().sort(() => Math.random() - 0.5);
      Queue.play(shuffled, 0);
    }
  });

  /* liste delegeleri */
  UI.delegate($("#homeList"), () => UI.homeTracks);
  UI.delegate($("#histList"), () => history);
  UI.delegate($("#searchList"), () => UI.searchTracks);
  UI.delegate($("#queueList"), () => playQueue);
  UI.delegate($("#favList"), () => favorites);

  $("#clearQueueBtn").addEventListener("click", () => {
    if (!playQueue.length) return;
    Queue.clear();
    toast("Kuyruk temizlendi");
  });

  /* arama */
  $("#searchBtn").addEventListener("click", () => UI.doSearch($("#searchInput").value));
  $("#searchInput").addEventListener("keydown", e => {
    if (e.key === "Enter") { e.preventDefault(); UI.doSearch($("#searchInput").value); }
  });
  $("#searchChips").addEventListener("click", e => {
    const c = e.target.closest(".chip");
    if (c) { $("#searchInput").value = c.dataset.q; UI.doSearch(c.dataset.q); }
  });

  /* sayfaları aç/kapat */
  $("#settingsBtn").addEventListener("click", () => { UI.renderSources(); UI.openSheet("settingsSheet"); });
  $("#brightBtn").addEventListener("click", () => UI.openSheet("brightSheet"));
  $("#sleepBtn").addEventListener("click", () => UI.openSheet("sleepSheet"));
  $$("[data-close]").forEach(b => b.addEventListener("click", UI.closeSheets));
  /* Sayfanın arkasındaki karartmaya dokun → kapat (düğmeye gerek yok). */
  $("#sheetScrim").addEventListener("click", UI.closeSheets);

  /* uyku seçenekleri */
  const SLEEP_OPTS = [15, 30, 45, 60, 90, 0];
  $("#sleepPills").innerHTML = SLEEP_OPTS.map(m =>
    '<button class="pill" data-m="' + m + '">' + (m ? m + " dk" : "Kapat") + "</button>").join("");
  $("#sleepPills").addEventListener("click", e => {
    const b = e.target.closest(".pill");
    if (!b) return;
    const m = parseInt(b.dataset.m, 10);
    /* Hap durumu Sleep.set/off içinden UI.sleep() ile senkronlanır —
       burada elle kurmaya gerek yok (kendiliğinden dolan süreyle
       senkron kalır). */
    if (m) Sleep.set(m); else Sleep.off();
    UI.closeSheets();
  });
  $("#sleepOffBtn").addEventListener("click", () => {
    Sleep.off();
    UI.closeSheets();
    toast("Uyku kapatıldı");
  });

  /* ayarlar */
  const bindToggle = (id, key, after) => {
    const node = $(id);
    node.checked = !!settings[key];
    node.addEventListener("change", () => {
      settings[key] = node.checked;
      saveSettings();
      if (after) after(node.checked);
    });
  };
  bindToggle("#setAutoNext", "autoNext");
  bindToggle("#setEarlySkip", "earlySkip", on => toast(on ? "Erken geçiş açık" : "Erken geçiş kapalı"));
  bindToggle("#setLoopQueue", "loopQueue");
  bindToggle("#setSponsor", "sponsor", on => {
    if (on) Sponsor.onPlay(Player.id);
    else Sponsor.stopAll();
    $$("#sponsorCats input").forEach(i => { i.disabled = !on; });
    toast(on ? "SponsorBlock açık" : "SponsorBlock kapalı");
  });

  /* sponsor kategorileri */
  $("#sponsorCats").innerHTML = Object.keys(settings.sponsorCats).map(k =>
    '<div class="srow"><div class="srow-main"><div class="srow-label" style="font-size:13px">' +
    escHtml(CAT_LABELS[k] || k) + '</div></div>' +
    '<label class="sw"><input type="checkbox" data-cat="' + k + '"' +
    (settings.sponsorCats[k] ? " checked" : "") + '><i></i></label></div>').join("");
  $("#sponsorCats").addEventListener("change", e => {
    const c = e.target.dataset.cat;
    if (!c) return;
    settings.sponsorCats[c] = e.target.checked;
    saveSettings();
    if (settings.sponsor) Sponsor.onPlay(Player.id);
  });

  $("#dimRange").value = String(settings.dim);
  $("#dimRange").addEventListener("input", e => UI.applyDim(parseInt(e.target.value, 10)));

  /* parlaklık sayfası — sürüşte büyük hedef */
  $("#dimRangeBig").value = String(settings.dim);
  $("#dimRangeBig").addEventListener("input", e => UI.applyDim(parseInt(e.target.value, 10)));
  $("#dimResetBtn").addEventListener("click", () => UI.applyDim(0));
  $("#dimPills").innerHTML = [0, 30, 50, 70, 85].map(v =>
    '<button class="pill" data-v="' + v + '">' + (v === 0 ? "Tam parlak" : "%" + v) + "</button>").join("");
  $("#dimPills").addEventListener("click", e => {
    const b = e.target.closest(".pill");
    if (b) UI.applyDim(parseInt(b.dataset.v, 10));
  });

  $("#testSourcesBtn").addEventListener("click", async () => {
    const b = $("#testSourcesBtn");
    b.disabled = true;
    b.textContent = "Test ediliyor…";
    $("#sourceList").innerHTML = UI.skeleton(4);
    const res = await Sources.probe((done, total) => {
      b.textContent = "Test ediliyor… " + done + "/" + total;
    });
    b.disabled = false;
    b.textContent = "Kaynakları test et";
    UI.renderSources();
    const ok = res.filter(r => r.ok).length;
    toast(ok ? ok + " / " + res.length + " kaynak çalışıyor" : "Hiçbir kaynak çalışmıyor", ok ? "" : "warn");
  });

  $("#clearDataBtn").addEventListener("click", () => {
    if (!confirm("Tüm tercihler, favoriler ve kuyruk silinsin mi?")) return;
    Object.keys(localStorage).filter(k => k.indexOf("su_") === 0)
      .forEach(k => localStorage.removeItem(k));
    location.reload();
  });

  $("#showTipsBtn").addEventListener("click", () => { UI.closeSheets(); UI.showTips(); });

  /* ipuçları */
  $("#tipsNext").addEventListener("click", () => UI.tipsNext());
  $("#tipsSkip").addEventListener("click", () => UI.tipsSkip());

  /* donanım medya tuşları */
  window.addEventListener("keydown", e => {
    const k = e.key || "";
    if (k === "MediaTrackNext" || k === "AudioTrackNext" || e.keyCode === 176) {
      e.preventDefault(); Queue.next(false);
    } else if (k === "MediaTrackPrevious" || k === "AudioTrackPrevious" || e.keyCode === 177) {
      e.preventDefault(); Queue.prev();
    } else if (k === "MediaPlayPause" || k === " " || k === "MediaPlay") {
      /* Odaklanmış bir <button> varken boşluk tuşu onu zaten
         etkinleştirir — çift tetiklemeyi engelle. */
      const t = e.target;
      if (k === " " && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" ||
                        t.tagName === "BUTTON" || t.closest("button"))) return;
      e.preventDefault(); Player.toggle();
    } else if (k === "MediaStop") {
      e.preventDefault(); Player.stop();
    } else if (k === "AudioVolumeUp") {
      e.preventDefault(); UI.applyDim(Math.max(0, settings.dim - 15));
    } else if (k === "AudioVolumeDown") {
      e.preventDefault(); UI.applyDim(Math.min(85, settings.dim + 15));
    }
  });

  /* sekme gizliyken dur, görünür olunca devam et (araba ekranı uyandırmasında) */
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && Player.playing) {
      // bilinçli olarak durdurma: sadece yüklemeyi gevşet
      Sponsor.stopAll();
    } else if (!document.hidden && Player.id) {
      Sponsor.onPlay(Player.id);
      Media.update();
    }
  });

  /* çevrimdışı / çevrimiçi */
  window.addEventListener("offline", () => toast("Çevrimdışı — arama yapılamaz", "warn"));
}

/** Modül seviyesinde tek kaçırma uygulaması (UI dışındaki kullanımlar için). */
function escHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/* ───────────── Başlangıç ───────────── */

function boot() {
  UI.renderTiles();
  UI.renderChips();
  UI.renderQueue();
  UI.renderFav();
  UI.renderHistory();
  UI.applyDim(settings.dim);
  UI.sleep();
  bindEvents();

  /* düğme durumlarını ayarlardan yansıt (sadece sınıf değil, aria da) */
  $("#shuffleBtn").classList.toggle("on", settings.shuffle);
  $("#shuffleBtn").setAttribute("aria-pressed", settings.shuffle ? "true" : "false");
  $("#repeatBtn").classList.toggle("on", settings.repeat !== "off");
  $("#repeatBtn").setAttribute("aria-pressed", settings.repeat);
  $("#repeatBtn").title = REPEAT_LABEL[settings.repeat];
  $$("#sponsorCats input").forEach(i => { i.disabled = !settings.sponsor; });
  UI.renderSources();

  /* kaydetilmiş kuyruktan devam (çalmadan, sadece görünüm) */
  if (playQueue.length && playIndex >= 0 && playIndex < playQueue.length) {
    const t = playQueue[playIndex];
    UI.title(t);
    UI.progress(0, t.dur || 0);
  }

  /* ilk açılış ipuçları */
  let seen = false;
  try { seen = localStorage.getItem(K.onb) === "1"; } catch (e) {}
  if (!seen) setTimeout(() => UI.showTips(), 800);

  /* PWA — yalnızca güvenli bağlamda (https:// veya localhost).
     Başlıktaki ekran tipik olarak LAN üzerinden http:// ile servis
     edilir; orada SW çalışmaz ve çevrimdışı kabuk sözü tutulmaz.
     Sessizce yutma yerine nedenini loglayalım. */
  if ("serviceWorker" in navigator) {
    if (window.isSecureContext) {
      navigator.serviceWorker.register("sw.js").catch(e =>
        console.warn("[HU] service worker kaydı başarısız:", e && e.message));
    } else {
      console.info("[HU] Güvenli olmayan bağlam (http:// LAN): service worker " +
        "devre dışı — çevrimdışı kabuk çalışmaz. https kullanın.");
    }
  }

  console.log("[HU] hazır · kuyruk " + playQueue.length + " · kaynak " + SOURCES.length);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();

/* Sahada tanılama / konsol erişimi: HU.Player, HU.Queue, HU.Sources … */
window.HU = {
  Player, Queue, Sources, Sponsor, Sleep, Media, UI,
  settings,
  get queue() { return playQueue; },
  get favorites() { return favorites; }
};

})();
