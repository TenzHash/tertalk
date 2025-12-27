const CACHE_NAME = "tertalk-v2"; // CHANGED: Update this (v2, v3) every time you deploy!
const urlsToCache = [
  "/",
  "/index.html",
  "/style.css",
  "/script.js",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
  "/msg.mp3",
  "/notify.mp3",
];

// 1. Install: Cache files immediately
self.addEventListener("install", (event) => {
  // FORCE the new Service Worker to activate immediately (fixes "stuck on old version")
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    })
  );
});

// 2. Activate: Delete OLD caches (Critical for updates)
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log("Deleting old cache:", name);
            return caches.delete(name);
          }
        })
      );
    })
  );
  // Tell the SW to take control of the page immediately
  self.clients.claim();
});

// 3. Fetch: Network First, Fallback to Cache
self.addEventListener("fetch", (event) => {
  // Ignore Socket.io requests (let them go through normally)
  if (event.request.url.includes("/socket.io/")) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // If network works, return fresh data AND update the cache for next time
        if (!response || response.status !== 200 || response.type !== "basic") {
          return response;
        }

        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return response;
      })
      .catch(() => {
        // If network fails (Offline), serve from cache
        return caches.match(event.request);
      })
  );
});
