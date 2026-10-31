'use strict';

/* Service Worker von Steinzeitdorf.
   BUILD und ENV setzt scripts/stamp.mjs beim Deployment. Ungestempelt (lokale Entwicklung)
   geht alles direkt ans Netz, damit nichts veraltet im Cache hängt. */
const BUILD = '__BUILD__';
const ENV = '__ENV__';
const DEV = BUILD.startsWith('__');

/* Prod und Beta haben eigene Domains. Der Umgebungsname im Cache-Namen trennt sie
   trotzdem sauber, falls beide einmal auf derselben Domain laufen. */
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
  'js/cloud.js',
  'vendor/three.min.js',
  'vendor/supabase.js',
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
  if (req.mode === 'navigate') {
    /* Online zuerst das Netz fragen, damit Updates sofort greifen. Nur ohne Verbindung kommt die gespeicherte Seite. */
    event.respondWith(
      new Promise((resolve, reject) => {
        const timer = setTimeout(reject, 4000);
        fetch(req).then((res) => { clearTimeout(timer); resolve(res); }, (err) => { clearTimeout(timer); reject(err); });
      }).catch(() => caches.match('index.html', { cacheName: CACHE }).then((hit) => hit || Response.error()))
    );
    return;
  }

  event.respondWith(
    caches.match(req, { cacheName: CACHE, ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        if (res && res.ok && res.type === 'basic' && !res.redirected) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      });
    })
  );
});
