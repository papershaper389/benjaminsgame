/* Spielstand und Bestenliste über die Azure-API (Ordner api/).
   Die Anmeldung erledigt Azure Static Web Apps vor der Auslieferung der Dateien.
   Ohne APP_CLOUD (lokal, Entwicklung) startet game.js allein und diese Datei tut nichts. */
(function () {
  'use strict';
  if (!window.APP_CLOUD) return;
  const ENV = window.APP_ENV || 'dev';
  const $ = (id) => document.getElementById(id);
  const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clock = (ms) => new Date(ms).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  const ERA = ['Horde', 'Sippe', 'Dorf', 'Stamm'];
  const USERKEY = 'steinzeitdorf-user:' + ENV;
  const OWNER = 'steinzeitdorf-owner:' + ENV;
  const NAMEKEY = 'steinzeitdorf-name:' + ENV;

  let user = null, dirty = false, conflict = false, expired = false, syncText = '';
  let saveTimer = null, retryTimer = null, rankTimer = null, lastPoints = -1, lastName = '', lastScoreAt = 0;

  /* ---------- Aufrufe ---------- */
  async function api(path, opts, ms) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), ms || 8000);
    try {
      const r = await fetch(path, Object.assign({ credentials: 'same-origin', cache: 'no-store', redirect: 'manual', signal: ctl.signal }, opts));
      if (r.status === 401 || r.type === 'opaqueredirect') { expired = true; setSync('Sitzung abgelaufen. Bitte die Seite neu laden und anmelden.'); return { status: 401 }; }
      let body = null;
      try { body = await r.json(); } catch (e) { body = null; }
      return { status: r.status, body: body };
    } catch (e) {
      return { status: 0 };
    } finally { clearTimeout(t); }
  }
  const put = (path, data) => api(path, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });

  async function whoAmI() {
    if (navigator.onLine) {
      try {
        const r = await fetch('/.auth/me', { credentials: 'same-origin', cache: 'no-store' });
        if (r.ok) {
          const p = (await r.json()).clientPrincipal;
          if (p && p.userId) {
            const u = { id: p.userId, details: p.userDetails || '' };
            try { localStorage.setItem(USERKEY, JSON.stringify(u)); } catch (e) {}
            return u;
          }
        }
      } catch (e) { /* offline: gespeicherte Angaben */ }
    }
    try { return JSON.parse(localStorage.getItem(USERKEY)); } catch (e) { return null; }
  }
  function readLocal() {
    try {
      const s = JSON.parse(localStorage.getItem(window.Game.key));
      return s && Array.isArray(s.tiles) ? s : null;
    } catch (e) { return null; }
  }

  /* ---------- Start ---------- */
  async function init() {
    user = await whoAmI();
    /* Fremdes Konto auf demselben Gerät: Stand eines anderen nie übernehmen */
    if (user) {
      try {
        const owner = localStorage.getItem(OWNER);
        if (owner && owner !== user.id) { localStorage.removeItem(window.Game.key); localStorage.removeItem(NAMEKEY); }
        localStorage.setItem(OWNER, user.id);
      } catch (e) {}
    }
    const local = readLocal();
    let cloud; /* undefined: nicht erreichbar */
    const r = navigator.onLine ? await api('/api/save?env=' + ENV, null, 5000) : { status: 0 };
    if (r.status === 200 && r.body) cloud = r.body.save ? { state: r.body.save.state, at: Number(r.body.save.savedAt) } : null;
    let data;
    if (cloud && (!local || cloud.at > (local.savedAt || 0))) data = cloud.state;
    else if (local && (cloud === null || (cloud && (local.savedAt || 0) > cloud.at))) dirty = true;
    window.Game.onSave = onSave;
    window.Game.start(data);
    renderRanks();
    if (cloud === undefined && !expired) setSync('Offline, wird später gesichert');
    if (dirty) schedule(1500);
    loadRanks();
    setInterval(() => { if (!document.hidden && navigator.onLine) loadRanks(); }, 60000);
  }

  /* ---------- Sichern ---------- */
  function setSync(t, html) {
    syncText = t;
    const el = $('syncState');
    if (!el) return;
    if (html) el.innerHTML = html; else el.textContent = t;
  }
  function onSave() { dirty = true; schedule(8000); }
  function schedule(ms) { if (!saveTimer) saveTimer = setTimeout(flush, ms); }

  async function flush() {
    clearTimeout(saveTimer); saveTimer = null;
    if (!dirty || conflict || expired) return !dirty;
    if (!navigator.onLine) { setSync('Offline, wird später gesichert'); return false; }
    const st = window.Game.getState(), at = st.savedAt || Date.now();
    const r = await put('/api/save', { env: ENV, state: st, savedAt: at });
    if (r.status === 200) {
      dirty = false;
      setSync('Cloud gesichert um ' + clock(Date.now()));
      pushScore();
      return true;
    }
    if (r.status === 409) {
      conflict = true; dirty = false;
      setSync('', 'Auf einem anderen Gerät wurde weiter gespielt. <button type="button" class="btn" id="takeCloud">Neueren Stand laden</button>');
      return false;
    }
    if (r.status === 401) return false;
    setSync(r.status === 503 ? 'Cloud noch nicht eingerichtet, nur lokal gesichert' : 'Nicht gesichert, neuer Versuch folgt');
    if (r.status !== 503) { clearTimeout(retryTimer); retryTimer = setTimeout(() => { dirty = true; schedule(100); }, 30000); }
    return false;
  }
  async function pushScore(force) {
    const sum = window.Game.summary();
    const pts = sum.era * 500 + sum.pop * 20 + sum.buildings * 5 + sum.monument * 5;
    let nm = ''; try { nm = localStorage.getItem(NAMEKEY) || ''; } catch (e) {}
    if (!force && pts === lastPoints && nm === lastName) return;
    if (!force && Date.now() - lastScoreAt < 30000) return;
    const r = await put('/api/score', Object.assign({ env: ENV, name: nm }, sum));
    if (r.status === 200) { lastPoints = pts; lastName = nm; lastScoreAt = Date.now(); if (r.body && r.body.name) { const n = $('acName'); if (n && !n.value) n.placeholder = r.body.name; } loadRanks(); }
  }

  window.addEventListener('online', () => { if (dirty) schedule(500); loadRanks(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && dirty) flush(); });
  window.addEventListener('pagehide', () => { if (dirty) flush(); });

  /* ---------- Bestenliste und Konto ---------- */
  function renderRanks() {
    const el = $('ranks');
    el.hidden = false;
    let nm = ''; try { nm = localStorage.getItem(NAMEKEY) || ''; } catch (e) {}
    el.innerHTML = '<h3>Bestenliste</h3><ol class="rk" id="rkList" aria-live="polite"><li class="muted">Lädt …</li></ol>' +
      '<p class="muted">Punkte: Stufe, Bewohner, Bauten und Steinkreis.</p>' +
      '<details class="acct"><summary>Konto</summary>' +
      '<p class="muted" id="acctWho"></p>' +
      '<label for="acName">Name in der Bestenliste</label><div class="row"><input class="inp" id="acName" maxlength="24" autocomplete="nickname"><button class="btn" type="button" id="acNameSave">Speichern</button></div>' +
      '<p class="muted" id="acctMsg" role="status"></p>' +
      '<div class="row"><button class="btn" type="button" id="acOut">Abmelden</button></div></details>' +
      '<p class="muted" id="syncState" role="status"></p>';
    $('acctWho').textContent = 'Angemeldet als ' + ((user && user.details) || 'unbekannt');
    $('acName').value = nm;
    if (conflict) setSync('', 'Auf einem anderen Gerät wurde weiter gespielt. <button type="button" class="btn" id="takeCloud">Neueren Stand laden</button>');
    else if (syncText) setSync(syncText);
  }
  async function loadRanks() {
    const list = $('rkList');
    if (!list || !navigator.onLine) return;
    const r = await api('/api/scores?env=' + ENV, null, 6000);
    if (r.status !== 200 || !r.body) { list.innerHTML = '<li class="muted">Bestenliste gerade nicht erreichbar.</li>'; return; }
    const rows = r.body.scores || [];
    if (!rows.length) { list.innerHTML = '<li class="muted">Noch niemand in der Liste.</li>'; return; }
    list.innerHTML = rows.map((x, i) =>
      '<li class="' + (x.me ? 'me' : '') + '"><span class="pos">' + (i + 1) + '.</span><span class="nm">' + esc(x.name) + (x.me ? ' (du)' : '') +
      '<small>' + ERA[x.era] + ', ' + x.pop + ' Bewohner' + (x.monument ? ', Steinkreis ' + x.monument + ' %' : '') + '</small></span><b>' + x.points + '</b></li>').join('');
  }
  $('ranks').addEventListener('click', async (ev) => {
    const id = ev.target.id, msg = (t) => { const m = $('acctMsg'); if (m) m.textContent = t; };
    if (id === 'acNameSave') {
      const nm = $('acName').value.trim().slice(0, 24);
      if (!nm) return msg('Bitte einen Namen eintragen.');
      try { localStorage.setItem(NAMEKEY, nm); } catch (e) {}
      await pushScore(true);
      msg('Name gespeichert.');
    } else if (id === 'takeCloud') {
      try { localStorage.removeItem(window.Game.key); } catch (e) {}
      location.reload();
    } else if (id === 'acOut') {
      if (dirty && !(await flush())) return msg('Der letzte Stand ist noch nicht gesichert. Bitte erst online gehen.');
      try { localStorage.removeItem(window.Game.key); localStorage.removeItem(OWNER); localStorage.removeItem(NAMEKEY); localStorage.removeItem(USERKEY); } catch (e) {}
      /* Danach sofort die Anmeldung mit erzwungener Eingabe, damit auch ein anderes Konto möglich ist */
      location.href = '/.auth/logout?post_logout_redirect_uri=%2F.auth%2Flogin%2Fauth0%3Fprompt%3Dlogin';
    }
  });

  init();
})();
