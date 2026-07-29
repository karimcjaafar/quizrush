// QuizRush service worker: network-first with cache fallback, so updates land
// immediately when online while the whole app keeps working offline.
// Bump the version on breaking cache changes.
const CACHE = "quizrush-v44";
const SHELL = [
  "./", "./index.html", "./style.css", "./app.js", "./bank.js", "./bank-imported.js",
  "./bank-generated.js", "./bank-generated-sport.js", "./bank-generated-extra.js", "./shapes.js",
  "./bank-saga.js", "./bank-user.js", "./saga.html", "./saga-questions.js",
  "./music/skyline-drift.mp3", "./media/saga/App Pics/Ice World - World 1.png",
  "./manifest.json", "./icon-bolt.svg", "./icon-bolt.png",
  "./music/ambient-synth-overture.mp3", "./music/soft-neon.mp3", "./music/trance-overture.mp3",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return; // trivia APIs go straight to the network
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        // Only cache full, OK responses — audio Range requests return 206, which
        // the Cache API rejects; skip those (they still play from the network,
        // and the precached full file serves them when offline).
        if (res.ok && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(e.request).then((m) => m || caches.match("./index.html")))
  );
});
