// Offline support. The app shell and everything it loads are cached on first visit, so the game opens and plays with no connection.
// Pages are fetched fresh when online (so a new version arrives), and fall back to the cached copy when offline.
// The build stamp is written in by the build, so every release is a new worker with a fresh cache.
const BUILD = '__BUILD__';
const CACHE = 'squad-number-' + BUILD;
const SHELL = ['./', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Opening the app: newest page when online, the saved one otherwise.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put('./', copy)); return res; })
        .catch(() => caches.match('./')),
    );
    return;
  }

  // Scripts, styles and fonts have a hash in their name, so a saved copy is always right. Everything else refreshes in the background.
  const hashed = /\/assets\//.test(url.pathname);
  event.respondWith(
    caches.match(req).then(hit => {
      const fresh = fetch(req).then(res => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return res; }).catch(() => hit);
      return hit && hashed ? hit : hit || fresh;
    }),
  );
});
