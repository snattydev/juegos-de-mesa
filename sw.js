// Root Service Worker for Juegos de Mesa (PWA offline support)
const CACHE_NAME = "juegos-de-mesa-v2";
const FONT_CACHE = "juegos-de-mesa-fonts-v1";

const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./shared/games.js",
  "./shared/theme.js",
  "./shared/chrome.css",
  "./shared/chrome.js",
  "./shared/icons/icon.svg",
  "./shared/icons/icon-192.png",
  "./shared/icons/icon-512.png",
  "./shared/icons/icon-maskable-512.png",
  "./shared/icons/apple-touch-icon.png",
  "./ahorcado/",
  "./ahorcado/index.html",
  "./ahorcado/assets/app.js",
  "./ahorcado/assets/rules.js",
  "./ahorcado/assets/styles.css",
  "./ahorcado/data/words.js",
  "./botella/",
  "./botella/index.html",
  "./botella/assets/app.js",
  "./botella/assets/styles.css",
  "./botella/assets/wheel.js",
  "./botella/data/questions.js",
  "./charadas/",
  "./charadas/index.html",
  "./charadas/assets/app.js",
  "./charadas/assets/styles.css",
  "./charadas/data/words.js",
  "./despues-de-las-doce/",
  "./despues-de-las-doce/index.html",
  "./despues-de-las-doce/assets/app.js",
  "./despues-de-las-doce/assets/styles.css",
  "./despues-de-las-doce/data/cards.js",
  "./en-palabras/",
  "./en-palabras/index.html",
  "./en-palabras/assets/app.js",
  "./en-palabras/assets/styles.css",
  "./en-palabras/data/decks.js",
  "./hdp/",
  "./hdp/index.html",
  "./hdp/assets/app.js",
  "./hdp/assets/engine.js",
  "./hdp/assets/local.js",
  "./hdp/assets/net.js",
  "./hdp/assets/styles.css",
  "./hdp/data/cards.js",
  "./incomodometro/",
  "./incomodometro/index.html",
  "./incomodometro/assets/app.js",
  "./incomodometro/assets/styles.css",
  "./incomodometro/data/prompts.js",
  "./mas-probable/",
  "./mas-probable/index.html",
  "./mas-probable/assets/app.js",
  "./mas-probable/assets/styles.css",
  "./mas-probable/data/prompts.js",
  "./yo-nunca/",
  "./yo-nunca/index.html",
  "./yo-nunca/assets/app.js",
  "./yo-nunca/assets/styles.css",
  "./yo-nunca/data/statements.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (
              key.startsWith("juegos-de-mesa-") &&
              key !== CACHE_NAME &&
              key !== FONT_CACHE
            ) {
              return caches.delete(key);
            }
            return undefined;
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const url = new URL(event.request.url);

  // Same-origin handling
  if (url.origin === self.location.origin) {
    if (event.request.mode === "navigate") {
      event.respondWith(
        fetch(event.request)
          .then((res) => {
            if (res && res.ok) {
              const clone = res.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
            }
            return res;
          })
          .catch(async () => {
            const cached = await caches.match(event.request);
            if (cached) return cached;

            if (url.pathname.endsWith("/")) {
              const indexPathMatch = await caches.match(url.pathname + "index.html");
              if (indexPathMatch) return indexPathMatch;
            }

            const fallback = await caches.match("./index.html");
            if (fallback) return fallback;

            return caches.match("/");
          })
      );
      return;
    }

    // Static assets: stale-while-revalidate
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.ok) {
              const clone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
            }
            return networkResponse;
          })
          .catch(() => {
            // Fail silently on network errors
          });

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // Google Fonts caching (font stylesheet & font binary files)
  if (
    url.hostname === "fonts.googleapis.com" ||
    url.hostname === "fonts.gstatic.com"
  ) {
    event.respondWith(
      caches.open(FONT_CACHE).then((cache) =>
        cache.match(event.request).then((cachedResponse) => {
          const fetchPromise = fetch(event.request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.ok) {
                cache.put(event.request, networkResponse.clone());
              }
              return networkResponse;
            })
            .catch(() => {
              // Fail silently if offline
            });

          return cachedResponse || fetchPromise;
        })
      )
    );
  }
});
