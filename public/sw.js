// College Library — minimal service worker.
//
// Deliberately does NOT cache app pages, API routes, or server-action responses:
// this app is fully dynamic and session/role-based (admin vs student see different
// data), so caching HTML would risk showing one user another's screen, or a stale
// dashboard after a book is issued/returned. All this worker does is:
//   1. Make the app installable ("Add to Home Screen" on Android/Chrome).
//   2. Pre-cache a tiny offline fallback page + the app icons.
//   3. Show that fallback page only when a page navigation fails with no network.
// Everything else always goes straight to the network, same as a normal browser tab.

const CACHE_NAME = "college-library-shell-v1";
const OFFLINE_URL = "/offline.html";
const PRECACHE_URLS = [
  OFFLINE_URL,
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only intercept top-level page navigations; let every other request
  // (API calls, server actions, static assets, images) pass straight through.
  if (request.mode !== "navigate") return;

  event.respondWith(
    fetch(request).catch(() => caches.match(OFFLINE_URL))
  );
});
