(function () {
  'use strict';
  const env = window.APP_ENV || 'dev';
  const build = window.APP_BUILD || 'lokal';
  const $ = (id) => document.getElementById(id);

  /* Umgebung sichtbar machen, damit Beta und Prod nie verwechselt werden */
  const label = env === 'prod' ? '' : env === 'beta' ? 'Beta' : 'Dev';
  if (label) {
    const b = $('envBadge');
    b.textContent = label;
    b.hidden = false;
    document.title = 'Steinzeitdorf ' + label;
    const t = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    if (t) t.setAttribute('content', 'Steinzeitdorf ' + label);
  }
  $('foot').textContent = 'Version ' + build + (label ? ' · ' + label : '');

  /* Installieren (Chrome, Edge, Android). Safari bietet das nur über das Teilen-Menü. */
  let deferred = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    $('install').hidden = false;
  });
  $('install').addEventListener('click', async () => {
    if (!deferred) return;
    deferred.prompt();
    try { await deferred.userChoice; } catch (_) { /* abgebrochen */ }
    deferred = null;
    $('install').hidden = true;
  });
  window.addEventListener('appinstalled', () => { $('install').hidden = true; });

  /* Service Worker mit Update-Hinweis */
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;
    reloading = true;
    location.reload();
  });

  function offerUpdate(worker) {
    $('update').hidden = false;
    $('reload').onclick = () => worker.postMessage({ type: 'SKIP_WAITING' });
  }

  navigator.serviceWorker.register('sw.js').then((reg) => {
    if (reg.waiting && navigator.serviceWorker.controller) offerUpdate(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      if (!w) return;
      w.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) offerUpdate(w);
      });
    });
    const check = () => reg.update().catch(() => {});
    document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
    setInterval(check, 60 * 60 * 1000);
  }).catch(() => {});
})();
