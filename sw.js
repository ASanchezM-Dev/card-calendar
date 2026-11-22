// Offline support.
// The app's own files are fetched from GitHub first (so a new upload shows up on the next open),
// and the saved copy is only used when there is no internet.
// GitHub Pages tells browsers to cache files for 10 minutes; 'no-cache' / 'reload' skip that wait.
const CACHE = 'cardcal-v5';
const FILES = ['./', './index.html', './manifest.json', './logo-180.png', './logo-192.png', './logo-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c =>
    c.addAll(FILES.map(u => new Request(u, { cache: 'reload' })))));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  if (new URL(req.url).origin === self.location.origin) {
    // Network first, revalidating with GitHub; fall back to the saved copy offline.
    e.respondWith(
      fetch(new Request(req.url, { cache: 'no-cache', credentials: 'same-origin' }))
        .then(res => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('./')))
    );
    return;
  }

  // Fonts and other outside files: saved copy first, refreshed in the background.
  e.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(req);
    const network = fetch(req).then(res => {
      if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
      return res;
    }).catch(() => cached);
    return cached || network;
  }));
});
