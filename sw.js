/* Plan de Capital — service worker
   v6 · la página siempre se busca primero en la red (network-first),
   así una versión nueva entra sola sin tener que reinstalar la app. */
const CACHE = "plan-capital-v7";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable.png"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* permite forzar la actualización desde la página */
self.addEventListener("message", e => {
  if (e.data === "skipWaiting") self.skipWaiting();
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  const esPagina = req.mode === "navigate" ||
                   (req.destination === "document") ||
                   url.pathname.endsWith("/") ||
                   url.pathname.endsWith("index.html");

  if (esPagina) {
    /* RED PRIMERO: si hay internet siempre trae la última versión.
       Sin internet, usa la copia guardada. */
    e.respondWith(
      fetch(req)
        .then(res => {
          const copia = res.clone();
          caches.open(CACHE).then(c => c.put("./index.html", copia)).catch(() => {});
          return res;
        })
        .catch(() => caches.match("./index.html").then(r => r || caches.match(req)))
    );
    return;
  }

  /* Resto de archivos (iconos, manifest): caché primero, se refresca en segundo plano */
  e.respondWith(
    caches.match(req).then(cached => {
      const red = fetch(req).then(res => {
        if (res && res.status === 200 && res.type === "basic") {
          const copia = res.clone();
          caches.open(CACHE).then(c => c.put(req, copia)).catch(() => {});
        }
        return res;
      }).catch(() => cached);
      return cached || red;
    })
  );
});
