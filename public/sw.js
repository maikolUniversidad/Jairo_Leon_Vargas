// UTL 360 · Service Worker (esqueleto PWA).
// Permite instalar la app en el dispositivo. La captura de ubicación con la
// pantalla apagada NO es posible solo con un Service Worker en la web; requiere
// una app nativa o Periodic Background Sync (soporte limitado). Este SW deja la
// base lista (instalable y con caché del shell mínimo).

const CACHE = "utl360-shell-v1";
const SHELL = ["/", "/dashboard", "/icon.svg", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

// Network-first para navegación; cae a caché si no hay red.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() => caches.match(req).then((r) => r || caches.match("/dashboard"))),
    );
  }
});
