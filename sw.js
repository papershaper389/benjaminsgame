'use strict';

/* Service Worker von Steinzeitdorf.
   BUILD und ENV setzt scripts/stamp.mjs beim Deployment. Ungestempelt (lokale Entwicklung)
   geht alles direkt ans Netz, damit nichts veraltet im Cache hängt. */
const BUILD = '__BUILD__';
const ENV = '__ENV__';
const DEV = BUILD.startsWith('__');

/* Prod und Beta liegen auf derselben Domain. Der Umgebungsname im Cache-Namen
   verhindert, dass die eine Version den Cache der anderen löscht. */
const PREFIX = 'steinzeitdorf-' + ENV + '-';
const CACHE = PREFIX + BUILD;

const ASSETS = [
  './',
  'index.html',
  'env.js',
  'manifest.webmanifest',
  'css/style.css',
  'js/game.js',
  'js/pwa.js',
  'vendor/three.min.js',
  'fonts/alfa-slab-one-400.woff2',
  'fonts/atkinson-400.woff2',
  'fonts/atkinson-700.woff2',
  'icons/favicon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/maskable-512.png',
  'icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  if (DEV) return;
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((n) => n.startsWith(PREFIX) && n !== CACHE).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

/* Die neue Version wartet, bis die Spielerin sie über den Hinweis im Spiel freigibt. */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (DEV || req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (!req.url.startsWith(self.registration.scope)) return;
  /* Der Prod-Worker deckt per Pfad auch /beta/ ab und überlässt es dem Beta-Worker. */
  if (ENV === 'prod' && url.pathname.startsWith(new URL('beta/', self.registration.scope).pathname)) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      caches.match('index.html', { cacheName: CACHE }).then((hit) => hit || fetch(req))
    );
    return;
  }

  event.respondWith(
    caches.match(req, { cacheName: CACHE, ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      });
    })
  );
});
