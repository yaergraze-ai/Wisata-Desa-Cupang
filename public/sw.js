/**
 * Service Worker Wisata Cirebon (PWA Shell & Offline Trail Navigator).
 * Menyediakan shell aplikasi offline, fallback halaman /offline, dan cache peta PMTiles (§6.G & §10.8).
 */

const SHELL_CACHE_NAME = "wisata-cirebon-shell-v2";
const MAP_CACHE_NAME = "wisata_cirebon_map_cache";

const PRECACHE_URLS = [
  "/offline",
  "/favicon.ico",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/maps/manifest.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch((err) => {
        console.warn("Precache service worker sebagian:", err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== SHELL_CACHE_NAME && key !== MAP_CACHE_NAME) {
            return caches.delete(key);
          }
          return Promise.resolve(true);
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (!event.data) return;

  if (event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }

  if (event.data.type === "CLEAR_USER_CACHE") {
    // Bersihkan sesi dan dompet tiket tersimpan saat logout
    event.waitUntil(
      caches.keys().then((keys) => {
        const userKeys = keys.filter((k) => k.includes("wallet") || k.includes("user"));
        return Promise.all(userKeys.map((k) => caches.delete(k)));
      })
    );
  }
});

// Penanganan Klik Notifikasi di Layar HP
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Penanganan Web Push Otomatis
self.addEventListener("push", (event) => {
  let data = {
    title: "Wisata Desa Cupang, Cirebon",
    body: "Pembaruan kuota tiket & jalur pendakian.",
    url: "/",
  };
  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    vibrate: [200, 100, 200],
    data: { url: data.url || "/" },
    tag: data.tag || "wdc-notification",
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Jangan sentuh permintaan non-GET atau API otentikasi / mutasi / webhook
  if (req.method !== "GET") return;
  if (url.pathname.startsWith("/api/auth") || url.pathname.startsWith("/api/webhooks")) return;

  // 1. Permintaan Berkas Peta (/maps/cirebon.pmtiles atau /maps/manifest.json)
  if (url.pathname.startsWith("/maps/")) {
    event.respondWith(
      caches.open(MAP_CACHE_NAME).then((mapCache) => {
        return mapCache.match(req).then((cached) => {
          if (cached) return cached;
          return fetch(req).then((res) => {
            if (res.ok) {
              mapCache.put(req, res.clone());
            }
            return res;
          }).catch(() => cached || Response.error());
        });
      })
    );
    return;
  }

  // 2. Permintaan Navigasi HTML (Navigasi halaman App Router)
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() => {
        // Jika offline, coba ambil dari cache atau arahkan ke /offline
        return caches.match(req).then((cachedPage) => {
          if (cachedPage) return cachedPage;
          const isEn = url.pathname.startsWith("/en");
          const fallbackPath = isEn ? "/en/offline" : "/offline";
          return caches.match(fallbackPath).then((cachedOffline) => {
            return cachedOffline || caches.match("/offline") || Response.error();
          });
        });
      })
    );
    return;
  }

  // 3. Aset Statis (font, ikon, stylesheet, script)
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.endsWith(".webp") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".js")
  ) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((networkRes) => {
          if (networkRes.ok) {
            const clone = networkRes.clone();
            caches.open(SHELL_CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return networkRes;
        }).catch(() => cached || Response.error());
      })
    );
  }
});
