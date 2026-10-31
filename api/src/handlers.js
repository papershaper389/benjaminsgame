/* Schnittstelle für Spielstand und Bestenliste.
   Die Anmeldung erledigt Azure Static Web Apps vor dem Aufruf (Route /api/* nur für die Rolle "spieler").
   Zur Sicherheit prüft jede Funktion den Benutzer noch einmal aus dem Header x-ms-client-principal. */
const store = require('./store');

const ENVS = ['prod', 'beta'];
const ROLE = 'spieler';
const MAX_SAVE_BYTES = 256 * 1024;
const TILES = 400;
const NO_STORE = { 'Cache-Control': 'no-store' };

const reply = (status, body) => ({ status, jsonBody: body, headers: NO_STORE });

function principal(request) {
  const h = request.headers.get('x-ms-client-principal');
  if (!h) return null;
  try {
    const p = JSON.parse(Buffer.from(h, 'base64').toString('utf8'));
    if (!p || !p.userId || !Array.isArray(p.userRoles) || p.userRoles.indexOf(ROLE) < 0) return null;
    const id = String(p.userId).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80);
    if (!id) return null;
    return { id, details: String(p.userDetails || '') };
  } catch (e) { return null; }
}

const envOf = (v) => (ENVS.indexOf(v) >= 0 ? v : null);
const int = (v, lo, hi) => (Number.isFinite(+v) ? Math.max(lo, Math.min(hi, Math.round(+v))) : lo);
const cleanName = (t) => String(t == null ? '' : t).replace(/[\u0000-\u001f\u007f<>&"']/g, '').trim().slice(0, 24);
const defaultName = (details) => cleanName(details.split('@')[0]) || 'Spieler';
const points = (s) => s.era * 500 + s.pop * 20 + s.buildings * 5 + s.monument * 5;

async function guard(request, context, fn) {
  const user = principal(request);
  if (!user) return reply(401, { error: 'Nicht angemeldet oder nicht freigeschaltet.' });
  try {
    return await fn(user);
  } catch (e) {
    if (context && context.error) context.error(e);
    if (e && e.code === 'not_configured') return reply(503, { error: 'Speicher ist nicht eingerichtet.' });
    return reply(500, { error: 'Speicher gerade nicht erreichbar.' });
  }
}

async function body(request) {
  const t = await request.text();
  if (t.length > MAX_SAVE_BYTES) return { tooBig: true };
  try { return { json: JSON.parse(t) }; } catch (e) { return { bad: true }; }
}

/* GET /api/save?env=beta  ->  { save: { state, savedAt } | null } */
function getSave(request, context) {
  return guard(request, context, async (user) => {
    const env = envOf(request.query.get('env'));
    if (!env) return reply(400, { error: 'env fehlt.' });
    const save = await store.get().get('saves/' + env + '/' + user.id + '.json');
    return reply(200, { save: save ? { state: save.state, savedAt: save.savedAt } : null });
  });
}

/* PUT /api/save  { env, state, savedAt }  ->  200, oder 409 mit dem neueren Stand */
function putSave(request, context) {
  return guard(request, context, async (user) => {
    const b = await body(request);
    if (b.tooBig) return reply(413, { error: 'Spielstand zu groß.' });
    if (b.bad) return reply(400, { error: 'Ungültige Daten.' });
    const env = envOf(b.json.env), st = b.json.state, at = Number(b.json.savedAt);
    if (!env || !st || typeof st !== 'object' || !Array.isArray(st.tiles) || st.tiles.length !== TILES || !Number.isFinite(at)) {
      return reply(400, { error: 'Ungültiger Spielstand.' });
    }
    const name = 'saves/' + env + '/' + user.id + '.json';
    const old = await store.get().get(name);
    if (old && Number(old.savedAt) > at) return reply(409, { error: 'Anderswo wurde weiter gespielt.', savedAt: old.savedAt });
    await store.get().put(name, { state: st, savedAt: at });
    return reply(200, { ok: true, savedAt: at });
  });
}

/* GET /api/scores?env=beta  ->  { scores: [{ name, era, pop, monument, points, me }] } */
function getScores(request, context) {
  return guard(request, context, async (user) => {
    const env = envOf(request.query.get('env'));
    if (!env) return reply(400, { error: 'env fehlt.' });
    const names = (await store.get().list('scores/' + env + '/')).slice(0, 200);
    const rows = (await Promise.all(names.map((n) => store.get().get(n).then((r) => (r ? Object.assign(r, { me: n === 'scores/' + env + '/' + user.id + '.json' }) : null))))).filter(Boolean);
    rows.sort((a, b) => b.points - a.points);
    return reply(200, { scores: rows.slice(0, 15).map((r) => ({ name: r.name, era: r.era, pop: r.pop, monument: r.monument, points: r.points, me: r.me })) });
  });
}

/* PUT /api/score  { env, name?, day, pop, era, buildings, monument } */
function putScore(request, context) {
  return guard(request, context, async (user) => {
    const b = await body(request);
    if (b.tooBig || b.bad) return reply(400, { error: 'Ungültige Daten.' });
    const env = envOf(b.json.env);
    if (!env) return reply(400, { error: 'env fehlt.' });
    const name = 'scores/' + env + '/' + user.id + '.json';
    const old = await store.get().get(name);
    const row = {
      name: cleanName(b.json.name) || (old && old.name) || defaultName(user.details),
      day: int(b.json.day, 1, 100000), pop: int(b.json.pop, 0, 500), era: int(b.json.era, 0, 3),
      buildings: int(b.json.buildings, 0, TILES), monument: int(b.json.monument, 0, 100),
      updatedAt: Date.now()
    };
    row.points = points(row);
    await store.get().put(name, row);
    return reply(200, { ok: true, name: row.name, points: row.points });
  });
}

module.exports = { getSave, putSave, getScores, putScore, principal, points };
