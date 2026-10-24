/* Service worker. Estrategia: navegaciones network-first con respaldo /offline; estáticos de Next cache-first.
   Excepción (Fase 4.4): las pantallas de ejecución de inspecciones (/inspecciones/ejecutar/*) se guardan tras visitarlas
   en línea (o precargarlas con el encabezado x-sst-prefetch) para poder hacer inspecciones sin conexión; el envío usa la
   cola de IndexedDB de la página. Nunca se cachean /api ni otras respuestas autenticadas de datos. */
const VERSION = "v2";
const SHELL = `sst-shell-${VERSION}`;
const STATIC = `sst-static-${VERSION}`;
const PAGES = `sst-pages-${VERSION}`;
const OFFLINE_PAGE = /^\/inspecciones\/ejecutar\/[0-9a-f-]{36}$/i;

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(SHELL)
      .then((c) => c.add("/offline"))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => ![SHELL, STATIC, PAGES].includes(k)).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith("/api/"))
    return;

  if (
    OFFLINE_PAGE.test(url.pathname) &&
    (req.mode === "navigate" || req.headers.has("x-sst-prefetch"))
  ) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          // Solo respuestas finales (sin redirección a login) quedan guardadas.
          if (res.ok && !res.redirected) {
            const copy = res.clone();
            caches.open(PAGES).then((c) => c.put(url.pathname, copy));
          }
          return res;
        })
        .catch(
          async () =>
            (await caches.match(url.pathname, { cacheName: PAGES })) ?? caches.match("/offline"),
        ),
    );
    return;
  }
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).catch(() => caches.match("/offline")));
    return;
  }
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    e.respondWith(
      caches.open(STATIC).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      }),
    );
  }
});

// La página pide vaciar las pantallas guardadas (p. ej. al cerrar sesión en un dispositivo compartido).
self.addEventListener("message", (e) => {
  if (e.data === "clear-pages") e.waitUntil(caches.delete(PAGES));
});

// Notificaciones push (Fase 6.1): el servidor envía { title, body, url } con el resumen de las alertas nuevas.
self.addEventListener("push", (e) => {
  let data = { title: "SST", body: "", url: "/notificaciones" };
  try {
    data = { ...data, ...e.data.json() };
  } catch {
    /* sin carga útil: se muestra el aviso genérico */
  }
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icons/icon-192.png",
      data: { url: data.url },
    }),
  );
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = e.notification.data?.url || "/notificaciones";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      const open = list.find((c) => c.url.startsWith(url));
      return open ? open.focus() : self.clients.openWindow(url);
    }),
  );
});
