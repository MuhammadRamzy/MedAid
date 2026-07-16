const CACHE_NAME = "kmcc-inventory-cache-v2";
const ASSETS_TO_CACHE = [
  "/",
  "/manifest.json",
  "/logo.png",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // Only cache GET requests
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  // Skip dynamic API routes, hot-reload updates, and next internal files in online mode
  if (
    url.pathname.startsWith("/api") || 
    url.pathname.startsWith("/_next") || 
    url.pathname.includes("hot-update")
  ) {
    return;
  }

  // Network-First with cache fallback strategy
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // If response is valid, update the cache copy
        if (response && response.status === 200 && response.type === "basic") {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // Network failed (offline), check cache
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Fallback to offline index for page navigation
          if (event.request.mode === "navigate") {
            return caches.match("/");
          }
          return new Response("Offline - Connection failed", {
            status: 503,
            statusText: "Service Unavailable",
            headers: new Headers({ "Content-Type": "text/plain" }),
          });
        });
      })
  );
});
