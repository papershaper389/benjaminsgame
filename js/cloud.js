/* Anmeldung, Cloud-Spielstand und Bestenliste über Supabase.
   Ohne APP_SUPABASE (lokal, Entwicklung) startet game.js allein und diese Datei tut nichts. */
(function () {
  'use strict';
  const ENV = window.APP_ENV || 'dev';
  const CFG = window.APP_SUPABASE;
  if (!CFG || !CFG.url || !CFG.key) return;

  const $ = (id) => document.getElementById(id);
  const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clock = (ms) => new Date(ms).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  const ERA = ['Horde', 'Sippe', 'Dorf', 'Stamm'];
  const AUTHKEY = 'steinzeitdorf-auth:' + ENV;
  const OWNER = 'steinzeitdorf-owner:' + ENV;
  const gate = $('gate');
  document.body.classList.add('locked');

  let sb = null, user = null, started = false, offlineStart = false;
  let saveTimer = null, retryTimer = null, rankTimer = null, dirty = false, syncText = '', lastPoints = -1, lastScoreAt = 0;

  /* ---------- Anmeldefenster ---------- */
  function showGate(view, msg) {
    document.body.classList.add('locked');
    gate.hidden = false;
    const m = msg ? '<p class="gmsg" role="alert">' + esc(msg) + '</p>' : '';
    if (view === 'loading') {
      gate.innerHTML = '<div class="card"><h1 id="gateH">Steinzeitdorf</h1><p class="muted">Einen Moment …</p></div>';
    } else if (view === 'login') {
      gate.innerHTML = '<form class="card" id="loginForm" novalidate><h1 id="gateH">Steinzeitdorf</h1>' +
        '<p class="muted">Nur eingeladene Spieler kommen hinein.</p>' + m +
        '<label for="lgEmail">E-Mail-Adresse</label><input class="inp" id="lgEmail" type="email" autocomplete="username" inputmode="email" required>' +
        '<label for="lgPw">Passwort</label><input class="inp" id="lgPw" type="password" autocomplete="current-password">' +
        '<div class="row"><button class="btn primary" type="submit">Anmelden</button><button class="btn" type="button" id="lgLink">Link per E-Mail</button></div>' +
        '<p class="muted">Ohne Passwort schickt „Link per E-Mail“ einen Anmeldelink an deine Adresse.</p></form>';
      const e = $('lgEmail');
      try { e.value = localStorage.getItem('steinzeitdorf-email') || ''; } catch (x) {}
      (e.value ? $('lgPw') : e).focus();
    } else if (view === 'denied') {
      gate.innerHTML = '<div class="card"><h1 id="gateH">Kein Zugang</h1><p>Dieses Konto ist für das Steinzeitdorf nicht freigeschaltet. Bitte den Betreiber, deine Adresse einzutragen.</p>' +
        '<div class="row"><button class="btn primary" type="button" id="lgOut">Mit anderem Konto anmelden</button></div></div>';
    } else if (view === 'offline') {
      gate.innerHTML = '<div class="card"><h1 id="gateH">Keine Verbindung</h1><p>Zum ersten Anmelden auf diesem Gerät braucht das Spiel Internet. Danach läuft es auch offline.</p>' +
        '<div class="row"><button class="btn primary" type="button" id="lgRetry">Erneut versuchen</button></div></div>';
    } else if (view === 'sent') {
      gate.innerHTML = '<div class="card"><h1 id="gateH">Link unterwegs</h1><p>Wenn die Adresse freigeschaltet ist, kommt gleich eine E-Mail. Öffne den Link darin auf diesem Gerät.</p>' +
        '<div class="row"><button class="btn" type="button" id="lgBack">Zurück</button></div></div>';
    }
  }
  function hideGate() { gate.hidden = true; gate.innerHTML = ''; document.body.classList.remove('locked'); }
  const authError = (e) => {
    const t = String((e && e.message) || '');
    if (/invalid login|invalid credentials/i.test(t)) return 'E-Mail oder Passwort stimmt nicht.';
    if (/rate|too many|seconds/i.test(t)) return 'Zu viele Versuche. Bitte kurz warten.';
    if (/fetch|network|failed/i.test(t)) return 'Keine Verbindung. Bitte später erneut versuchen.';
    return 'Das hat nicht geklappt. Bitte erneut versuchen.';
  };

  gate.addEventListener('submit', async (ev) => {
    if (ev.target.id !== 'loginForm') return;
    ev.preventDefault();
    const email = $('lgEmail').value.trim(), pw = $('lgPw').value;
    if (!email) return showGate('login', 'Bitte die E-Mail-Adresse eintragen.');
    if (!pw) return showGate('login', 'Bitte das Passwort eintragen oder „Link per E-Mail“ wählen.');
    try { localStorage.setItem('steinzeitdorf-email', email); } catch (x) {}
    const { error } = await sb.auth.signInWithPassword({ email: email, password: pw });
    if (error) showGate('login', authError(error));
  });
  gate.addEventListener('click', async (ev) => {
    const id = ev.target.id;
    if (id === 'lgLink') {
      const email = $('lgEmail').value.trim();
      if (!email) return showGate('login', 'Bitte die E-Mail-Adresse eintragen.');
      try { localStorage.setItem('steinzeitdorf-email', email); } catch (x) {}
      const { error } = await sb.auth.signInWithOtp({ email: email, options: { shouldCreateUser: false, emailRedirectTo: location.origin + location.pathname } });
      /* Nie verraten, ob eine Adresse existiert */
      if (error && /rate|too many|seconds|fetch|network/i.test(error.message || '')) showGate('login', authError(error));
      else showGate('sent');
    } else if (id === 'lgOut') { await sb.auth.signOut(); location.reload(); }
    else if (id === 'lgRetry') { init(); }
    else if (id === 'lgBack') showGate('login');
  });

  /* ---------- Freigabe und Spielstände ---------- */
  async function isPlayer(u) {
    const ck = 'steinzeitdorf-ok:' + ENV + ':' + u.id;
    try {
      const { data, error } = await sb.from('allowed_emails').select('email').limit(1);
      if (error) throw error;
      const ok = !!(data && data.length);
      try { if (ok) localStorage.setItem(ck, '1'); else localStorage.removeItem(ck); } catch (x) {}
      return ok;
    } catch (e) {
      /* Offline: gilt, was zuletzt bestätigt wurde */
      try { return localStorage.getItem(ck) === '1'; } catch (x) { return false; }
    }
  }
  function readLocal() {
    try {
      const s = JSON.parse(localStorage.getItem(window.Game.key));
      return s && Array.isArray(s.tiles) ? s : null;
    } catch (e) { return null; }
  }
  async function fetchCloud() {
    try {
      const { data, error } = await sb.from('saves').select('state,saved_at').eq('env', ENV).maybeSingle();
      if (error) throw error;
      return data ? { state: data.state, at: Date.parse(data.saved_at) } : null;
    } catch (e) { return undefined; } /* undefined: nicht erreichbar */
  }
  function storedUser() {
    try { const j = JSON.parse(localStorage.getItem(AUTHKEY)); return (j && j.user) || null; } catch (e) { return null; }
  }

  /* ---------- Start nach der Anmeldung ---------- */
  async function enter(u) {
    if (started) return;
    started = true;
    user = u;
    /* Fremdes Gerät: Stand eines anderen Kontos nie übernehmen */
    try {
      const owner = localStorage.getItem(OWNER);
      if (owner && owner !== u.id) localStorage.removeItem(window.Game.key);
      localStorage.setItem(OWNER, u.id);
    } catch (x) {}
    if (!(await isPlayer(u))) { started = false; showGate('denied'); return; }
    const local = readLocal();
    const cloud = await fetchCloud();
    let data;
    if (cloud && (!local || cloud.at > (local.savedAt || 0))) data = cloud.state;
    else if (local && (cloud === null || (cloud && (local.savedAt || 0) > cloud.at))) dirty = true;
    hideGate();
    window.Game.onSave = onSave;
    window.Game.start(data);
    renderRanks();
    if (cloud === undefined) setSync('Offline, wird später gesichert');
    if (dirty) schedule(1500);
    loadRanks();
    subscribeRanks();
  }

  /* ---------- Sichern ---------- */
  function setSync(t) { syncText = t; const el = $('syncState'); if (el) el.textContent = t; }
  function onSave() { dirty = true; schedule(8000); }
  function schedule(ms) {
    if (saveTimer) return;
    saveTimer = setTimeout(flush, ms);
  }
  const points = (s) => s.era * 500 + s.pop * 20 + s.buildings * 5 + s.monument * 5;
  async function flush() {
    clearTimeout(saveTimer); saveTimer = null;
    if (!dirty || !user) return true;
    if (!navigator.onLine) { setSync('Offline, wird später gesichert'); return false; }
    const st = window.Game.getState(), at = st.savedAt || Date.now();
    const { error } = await sb.from('saves').upsert({ user_id: user.id, env: ENV, state: st, saved_at: new Date(at).toISOString() });
    if (error) {
      setSync('Nicht gesichert, neuer Versuch folgt');
      clearTimeout(retryTimer); retryTimer = setTimeout(() => { dirty = true; schedule(100); }, 30000);
      return false;
    }
    dirty = false;
    setSync('Cloud gesichert um ' + clock(Date.now()));
    pushScore();
    return true;
  }
  async function pushScore() {
    const sum = window.Game.summary(), pts = points(sum), nm = playerName();
    if (pts === lastPoints && Date.now() - lastScoreAt < 600000 && nm === lastName) return;
    if (Date.now() - lastScoreAt < 30000 && nm === lastName) return;
    const { error } = await sb.from('scores').upsert({
      user_id: user.id, env: ENV, name: nm, day: sum.day, pop: sum.pop, era: sum.era,
      buildings: sum.buildings, monument: sum.monument, points: pts, updated_at: new Date().toISOString()
    });
    if (!error) { lastPoints = pts; lastScoreAt = Date.now(); lastName = nm; }
  }
  let lastName = '';
  const playerName = () => ((user && user.user_metadata && user.user_metadata.name) || 'Spieler').slice(0, 24);

  window.addEventListener('online', () => { if (dirty) schedule(500); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && dirty) flush(); });
  window.addEventListener('pagehide', () => { if (dirty) flush(); });

  /* ---------- Bestenliste und Konto ---------- */
  function renderRanks() {
    const el = $('ranks');
    el.hidden = false;
    el.innerHTML = '<h3>Bestenliste</h3><ol class="rk" id="rkList" aria-live="polite"><li class="muted">Lädt …</li></ol>' +
      '<p class="muted">Punkte: Stufe, Bewohner, Bauten und Steinkreis.</p>' +
      '<details class="acct"><summary>Konto</summary>' +
      '<p class="muted" id="acctWho"></p>' +
      '<label for="acName">Name in der Bestenliste</label><div class="row"><input class="inp" id="acName" maxlength="24" autocomplete="nickname"><button class="btn" type="button" id="acNameSave">Speichern</button></div>' +
      '<label for="acPw">Neues Passwort</label><div class="row"><input class="inp" id="acPw" type="password" autocomplete="new-password" minlength="8"><button class="btn" type="button" id="acPwSave">Setzen</button></div>' +
      '<p class="muted" id="acctMsg" role="status"></p>' +
      '<div class="row"><button class="btn" type="button" id="acOut">Abmelden</button></div></details>' +
      '<p class="muted" id="syncState" role="status">' + esc(syncText) + '</p>';
    $('acctWho').textContent = 'Angemeldet als ' + (user.email || '');
    $('acName').value = (user.user_metadata && user.user_metadata.name) || '';
  }
  async function loadRanks() {
    const list = $('rkList');
    if (!list) return;
    const { data, error } = await sb.from('scores').select('user_id,name,era,pop,monument,points').eq('env', ENV).order('points', { ascending: false }).limit(15);
    if (error) { list.innerHTML = '<li class="muted">Bestenliste gerade nicht erreichbar.</li>'; return; }
    if (!data.length) { list.innerHTML = '<li class="muted">Noch niemand in der Liste.</li>'; return; }
    list.innerHTML = data.map((r, i) =>
      '<li class="' + (r.user_id === user.id ? 'me' : '') + '"><span class="pos">' + (i + 1) + '.</span><span class="nm">' + esc(r.name) + (r.user_id === user.id ? ' (du)' : '') +
      '<small>' + ERA[r.era] + ', ' + r.pop + ' Bewohner' + (r.monument ? ', Steinkreis ' + r.monument + ' %' : '') + '</small></span><b>' + r.points + '</b></li>').join('');
  }
  function subscribeRanks() {
    try {
      sb.channel('scores-' + ENV).on('postgres_changes', { event: '*', schema: 'public', table: 'scores', filter: 'env=eq.' + ENV }, () => {
        clearTimeout(rankTimer); rankTimer = setTimeout(loadRanks, 800);
      }).subscribe();
    } catch (e) { /* ohne Live-Aktualisierung weiter */ }
  }
  $('ranks').addEventListener('click', async (ev) => {
    const id = ev.target.id, msg = (t) => { const m = $('acctMsg'); if (m) m.textContent = t; };
    if (id === 'acNameSave') {
      const nm = $('acName').value.trim().slice(0, 24);
      if (!nm) return msg('Bitte einen Namen eintragen.');
      const { data, error } = await sb.auth.updateUser({ data: { name: nm } });
      if (error) return msg(authError(error));
      user = data.user; msg('Name gespeichert.');
      lastScoreAt = 0; await pushScore(); loadRanks();
    } else if (id === 'acPwSave') {
      const pw = $('acPw').value;
      if (pw.length < 8) return msg('Das Passwort braucht mindestens 8 Zeichen.');
      const { error } = await sb.auth.updateUser({ password: pw });
      if (error) return msg(authError(error));
      $('acPw').value = ''; msg('Passwort gesetzt. Du kannst dich jetzt auch damit anmelden.');
    } else if (id === 'acOut') {
      if (dirty && !(await flush())) return msg('Der letzte Stand ist noch nicht gesichert. Bitte erst online gehen.');
      try { localStorage.removeItem(window.Game.key); localStorage.removeItem(OWNER); } catch (x) {}
      await sb.auth.signOut();
      location.reload();
    }
  });

  /* ---------- Einstieg ---------- */
  async function init() {
    showGate('loading');
    let session = null;
    try { session = (await sb.auth.getSession()).data.session; } catch (e) { session = null; }
    let u = session && session.user;
    if (!u && !navigator.onLine) { u = storedUser(); offlineStart = !!u; }
    if (u) enter(u);
    else if (!navigator.onLine) showGate('offline');
    else showGate('login');
  }

  try {
    sb = window.supabase.createClient(CFG.url, CFG.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: AUTHKEY } });
  } catch (e) {
    showGate('offline');
    return;
  }
  sb.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session && !started) enter(session.user);
    else if (event === 'SIGNED_OUT' && started) location.reload();
    else if (session && session.user && user) user = session.user;
  });
  init();
})();
