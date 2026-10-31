const test = require('node:test');
const assert = require('node:assert');
const store = require('../src/store');
const h = require('../src/handlers');

const mem = new Map();
store.setStore({
  async get(n) { return mem.has(n) ? JSON.parse(mem.get(n)) : null; },
  async put(n, o) { mem.set(n, JSON.stringify(o)); },
  async list(p) { return [...mem.keys()].filter((k) => k.startsWith(p)); }
});

const who = (id, roles = ['anonymous', 'authenticated', 'spieler'], details = id + '@x.de') =>
  Buffer.from(JSON.stringify({ identityProvider: 'aad', userId: id, userDetails: details, userRoles: roles })).toString('base64');
const req = (method, principal, query = {}, body = null) => ({
  method,
  headers: { get: (k) => (k === 'x-ms-client-principal' ? principal : null) },
  query: { get: (k) => (k in query ? query[k] : null) },
  text: async () => (body == null ? '' : typeof body === 'string' ? body : JSON.stringify(body))
});
const state = (day) => ({ day, tiles: Array.from({ length: 400 }, () => ({ t: 'wiese' })) });

test('ohne Anmeldung oder Rolle: 401', async () => {
  assert.strictEqual((await h.getSave(req('GET', null, { env: 'beta' }))).status, 401);
  assert.strictEqual((await h.getSave(req('GET', who('a', ['anonymous', 'authenticated']), { env: 'beta' }))).status, 401);
  assert.strictEqual((await h.getScores(req('GET', 'kaputt', { env: 'beta' }))).status, 401);
});

test('Spielstand: speichern, laden, getrennt je Konto und Umgebung', async () => {
  const a = who('aaa'), b = who('bbb');
  assert.deepStrictEqual((await h.getSave(req('GET', a, { env: 'beta' }))).jsonBody, { save: null });
  assert.strictEqual((await h.putSave(req('PUT', a, {}, { env: 'beta', state: state(5), savedAt: 100 }))).status, 200);
  assert.strictEqual((await h.getSave(req('GET', a, { env: 'beta' }))).jsonBody.save.state.day, 5);
  assert.strictEqual((await h.getSave(req('GET', a, { env: 'prod' }))).jsonBody.save, null);
  assert.strictEqual((await h.getSave(req('GET', b, { env: 'beta' }))).jsonBody.save, null);
});

test('Spielstand: älterer Stand überschreibt keinen neueren (409)', async () => {
  const a = who('ccc');
  await h.putSave(req('PUT', a, {}, { env: 'beta', state: state(9), savedAt: 500 }));
  const r = await h.putSave(req('PUT', a, {}, { env: 'beta', state: state(2), savedAt: 400 }));
  assert.strictEqual(r.status, 409);
  assert.strictEqual(r.jsonBody.savedAt, 500);
  assert.strictEqual((await h.getSave(req('GET', a, { env: 'beta' }))).jsonBody.save.state.day, 9);
});

test('Spielstand: ungültige Eingaben', async () => {
  const a = who('ddd');
  assert.strictEqual((await h.putSave(req('PUT', a, {}, { env: 'x', state: state(1), savedAt: 1 }))).status, 400);
  assert.strictEqual((await h.putSave(req('PUT', a, {}, { env: 'beta', state: { tiles: [] }, savedAt: 1 }))).status, 400);
  assert.strictEqual((await h.putSave(req('PUT', a, {}, 'kein json'))).status, 400);
  assert.strictEqual((await h.putSave(req('PUT', a, {}, 'x'.repeat(300 * 1024)))).status, 413);
});

test('Bestenliste: Punkte serverseitig, Namen bereinigt, Reihenfolge, Markierung "me"', async () => {
  const a = who('eee', undefined, 'anna@x.de'), b = who('fff', undefined, 'bert@x.de');
  const base = { env: 'beta', day: 20, pop: 10, era: 1, buildings: 8, monument: 20 };
  const ra = await h.putScore(req('PUT', a, {}, Object.assign({}, base, { points: 999999, name: '<b>Anna</b>' })));
  assert.strictEqual(ra.jsonBody.points, 1 * 500 + 10 * 20 + 8 * 5 + 20 * 5);
  assert.strictEqual(ra.jsonBody.name, 'bAnna/b');
  await h.putScore(req('PUT', b, {}, Object.assign({}, base, { era: 2, pop: 14 })));
  const l = (await h.getScores(req('GET', a, { env: 'beta' }))).jsonBody.scores;
  assert.strictEqual(l[0].name, 'bert');
  assert.deepStrictEqual(l.map((r) => r.me), [false, true]);
  assert.ok(!('userId' in l[0]));
  assert.strictEqual((await h.getScores(req('GET', a, { env: 'prod' }))).jsonBody.scores.length, 0);
});

test('Bestenliste: Werte werden begrenzt, Name bleibt bei leerer Eingabe erhalten', async () => {
  const a = who('ggg', undefined, 'gina@x.de');
  await h.putScore(req('PUT', a, {}, { env: 'beta', name: 'Gina', day: 1, pop: 99999, era: 9, buildings: -4, monument: 500 }));
  const r = await h.putScore(req('PUT', a, {}, { env: 'beta', day: 2, pop: 1, era: 0, buildings: 0, monument: 0 }));
  assert.strictEqual(r.jsonBody.name, 'Gina');
  const mine = (await h.getScores(req('GET', a, { env: 'beta' }))).jsonBody.scores.find((s) => s.me);
  assert.strictEqual(mine.points, 20);
});

test('Speicher nicht eingerichtet: 503', async () => {
  store.setStore(null);
  delete process.env.STORAGE_CONNECTION;
  const r = await h.getSave(req('GET', who('hhh'), { env: 'beta' }));
  assert.strictEqual(r.status, 503);
});

test('Rollen: nur Adressen auf der Freigabeliste bekommen spieler', async () => {
  process.env.ALLOWED_EMAILS = 'Anna@X.de; bert@x.de  carl@x.de';
  const body = (email, extra = []) => ({ method: 'POST', headers: { get: () => null }, query: { get: () => null }, text: async () => JSON.stringify({ identityProvider: 'auth0', userId: 'u', userDetails: email, claims: [{ typ: 'email', val: email }].concat(extra) }) });
  assert.deepStrictEqual((await h.getRoles(body('anna@x.de'))).jsonBody, { roles: ['spieler'] });
  assert.deepStrictEqual((await h.getRoles(body('BERT@x.de'))).jsonBody, { roles: ['spieler'] });
  assert.deepStrictEqual((await h.getRoles(body('fremd@x.de'))).jsonBody, { roles: [] });
  assert.deepStrictEqual((await h.getRoles(body('anna@x.de', [{ typ: 'email_verified', val: 'false' }]))).jsonBody, { roles: [] });
  assert.deepStrictEqual((await h.getRoles({ text: async () => 'kein json' })).jsonBody, { roles: [] });
  delete process.env.ALLOWED_EMAILS;
  assert.deepStrictEqual((await h.getRoles(body('anna@x.de'))).jsonBody, { roles: [] });
});
