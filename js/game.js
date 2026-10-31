(function () {
  'use strict';
  /* Prod und Beta teilen sich eine Domain, daher trennt der Umgebungsname den Spielstand. */
  const ENV = window.APP_ENV || 'dev';
  const COLS = 20, ROWS = 20, N = COLS * ROWS, MID = (COLS - 1) / 2, KEY = 'steinzeitdorf-v1:' + ENV, DPS = 8;
  const $ = (id) => document.getElementById(id);
  const nf = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 });
  const fmt = (v) => nf.format(Math.round(v * 10) / 10);
  const pl = (n, a, b) => (n === 1 ? a : b);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ic = (n, style) => '<svg class="ic" aria-hidden="true"' + (style ? ' style="' + style + '"' : '') + '><use href="#i-' + n + '"/></svg>';

  const TER = {
    wiese: { n: 'Wiese', i: 'grass' },
    wald: { n: 'Wald', i: 'tree' },
    fels: { n: 'Felsen', i: 'rock' },
    fluss: { n: 'Fluss', i: 'wave' }
  };
  const RES = [
    { k: 'food', n: 'Nahrung', i: 'meat' },
    { k: 'wood', n: 'Holz', i: 'log' },
    { k: 'stone', n: 'Stein', i: 'rock' },
    { k: 'fur', n: 'Felle', i: 'pelt' }
  ];
  const NAMES = { food: 'Nahrung', wood: 'Holz', stone: 'Stein', fur: 'Felle' };
  const ICON = { food: 'meat', wood: 'log', stone: 'rock', fur: 'pelt' };
  const SEASONS = ['Frühling', 'Sommer', 'Herbst', 'Winter'];
  const ERAS = ['Wandernde Horde', 'Sippe', 'Dorf', 'Stamm'];
  const WSM = [1, 1, 1, 0.8];

  const B = {
    feuer: { name: 'Lagerfeuer', icon: 'fire', col: 'accent', house: 6, build: false, terrain: ['wiese'], cost: {}, desc: 'Das Lagerfeuer hält Wärme und Wölfe fern. Hier schlafen die ersten sechs.' },
    sammler: { unlock: 0, name: 'Sammlerplatz', icon: 'berries', col: 'r-food', terrain: ['wiese'], cost: { wood: 3 }, out: { food: 2 }, sm: [1, 1.3, 1.2, 0.3], desc: 'Beeren, Wurzeln und Pilze. Im Sommer reich, im Winter fast leer.' },
    holz: { unlock: 0, name: 'Holzfäller', icon: 'axe', col: 'r-wood', terrain: ['wald'], cost: {}, out: { wood: 2.5 }, sm: WSM, desc: 'Steinbeil gegen Fichtenstamm. Holz ist der Anfang von allem.' },
    stein: { unlock: 1, name: 'Steinbruch', icon: 'pick', col: 'r-stone', terrain: ['fels'], cost: { wood: 6 }, out: { stone: 2 }, sm: WSM, desc: 'Brocken brechen, Kiesel schlagen. Stein braucht Geduld.' },
    fisch: { unlock: 0, name: 'Fischerplatz', icon: 'fish', col: 'r-food', terrain: ['fluss'], cost: { wood: 5 }, out: { food: 4 }, sm: [1, 1.1, 1, 0.7], desc: 'Reusen und Speere im Wasser. Die sicherste Nahrung, auch im Winter.' },
    acker: { unlock: 2, name: 'Acker', icon: 'wheat', col: 'r-food', terrain: ['wiese'], cost: { wood: 6, stone: 3 }, out: { food: 3.5 }, sm: [1, 1.4, 1.5, 0], desc: 'Saat, Hacke und Geduld. Im Herbst ist die Ernte am größten, im Winter ruht der Acker.' },
    palisade: { unlock: 0, name: 'Palisade', icon: 'shield', col: 'r-stone', terrain: ['wiese', 'wald', 'fels'], cost: { wood: 14 }, tip: 'Schutz vor Wölfen und Überfällen', desc: 'Ein Ring aus zugespitzten Stämmen. Jede Palisade schreckt Wölfe und Räuber ab, weitere helfen immer weniger.' },
    heiler: { unlock: 1, name: 'Heilerhütte', icon: 'herb', col: 'good', terrain: ['wiese', 'wald'], cost: { wood: 8, fur: 1 }, tip: 'Schutz vor Seuchen', desc: 'Die Heilerin kennt Kräuter und Umschläge. Jede Heilerhütte dämmt Seuchen ein, weitere helfen immer weniger.' },
    jagd: { unlock: 1, name: 'Jagdlager', icon: 'spear', col: 'r-food', terrain: ['wald', 'wiese'], cost: { wood: 6, stone: 2 }, out: { food: 2, fur: 0.5 }, outBy: { wald: { food: 3, fur: 0.8 } }, sm: [1, 1, 1.1, 0.9], desc: 'Speerjäger bringen Fleisch und Felle. Im Wald fällt die Beute größer aus.' },
    huette: { unlock: 1, name: 'Hütte', icon: 'hut', col: 'r-fur', house: 4, terrain: ['wiese', 'wald'], cost: { wood: 10, fur: 1 }, tip: '+4 Schlafplätze', desc: 'Fellzelt auf Stangen. Vier weitere Schlafplätze.' },
    werk: { unlock: 2, name: 'Faustkeil-Werkstatt', icon: 'flint', col: 'r-stone', terrain: ['wiese', 'wald', 'fels'], cost: { wood: 8, stone: 6 }, tip: '+25 % für Nachbarfelder', desc: 'Hier werden Faustkeile geschlagen. Steigert angrenzende Arbeitsplätze um 25 %, höchstens 50 %.' },
    lager: { unlock: 1, name: 'Vorratslager', icon: 'store', col: 'r-wood', terrain: ['wiese', 'wald'], cost: { wood: 12, stone: 3 }, tip: 'Mehr Platz für Vorräte, schützt vor Raub und Sturm', desc: 'Ein Pfahlspeicher aus Stämmen und Fell. Ohne Lager verderben Überschüsse; jedes Lager nimmt 60 Nahrung, 50 Holz, 40 Stein und 15 Felle auf und macht Diebe und Stürme harmloser.' },
    monument: { unlock: 2, name: 'Steinkreis', icon: 'henge', col: 'accent', unique: true, terrain: ['wiese'], cost: { wood: 10 }, tip: 'Großbaustelle: Bauarbeiter fehlen im Alltag', desc: 'Ein Kreis aus mächtigen Steinen, wie ihn kein Stamm der Gegend je sah. Das Werk verlangt viele Hände, Stein und Holz. Wer hier baut, fehlt bei der täglichen Arbeit.' },
    totem: { unlock: 2, name: 'Totempfahl', icon: 'totem', col: 'accent', unique: true, terrain: ['wiese'], cost: { wood: 20, stone: 20, fur: 6 }, tip: 'Das Wahrzeichen des Stammes', desc: 'Der Totempfahl hält die Geschichte des Stammes fest.' }
  };
  const ORDER = ['holz', 'fisch', 'sammler', 'acker', 'stein', 'jagd', 'huette', 'lager', 'heiler', 'palisade', 'werk', 'totem', 'monument'];
  /* Lagerraum: Grundplatz am Feuer plus je Vorratslager */
  const CAP0 = { food: 50, wood: 40, stone: 30, fur: 12 }, CAPL = { food: 60, wood: 50, stone: 40, fur: 15 };
  /* Steinkreis: Arbeitstage, Stein und Holz für das ganze Werk, sichtbare Bauschritte */
  const MON = { work: 150, stone: 100, wood: 40, steps: 19 };
  const BUILD_FOOD = 0.3;
  const unlockNames = (era) => ORDER.filter((k) => B[k].unlock === era).map((k) => B[k].name).join(', ');

  /* ---------- Karte ---------- */
  function mulberry(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function genTiles(seed) {
    const r = mulberry(seed);
    const t = Array.from({ length: N }, () => ({ t: 'wiese', b: null, n: 0 }));
    const idx = (x, y) => y * COLS + x;
    function river(x0) {
      let x = x0;
      for (let y = 0; y < ROWS; y++) {
        t[idx(x, y)].t = 'fluss';
        if (y < ROWS - 1) {
          const o = y & 1;
          const dx = r() < 0.5 ? (o ? 0 : -1) : (o ? 1 : 0);
          x = Math.max(0, Math.min(COLS - 1, x + dx));
        }
      }
    }
    river(3 + Math.floor(r() * 5));
    river(12 + Math.floor(r() * 5));
    function cluster(type, size, maxD) {
      let meadows = [];
      t.forEach((q, i) => { if (q.t === 'wiese') meadows.push(i); });
      if (maxD) {
        const near = meadows.filter((i) => { const w = wpos(i); return Math.hypot(w[0], w[1]) <= maxD; });
        if (near.length) meadows = near;
      }
      let cur = meadows[Math.floor(r() * meadows.length)];
      let placed = 0, guard = 0;
      while (placed < size && guard++ < 300) {
        if (t[cur].t === 'wiese') { t[cur].t = type; placed++; }
        const nb = adj(cur);
        cur = nb[Math.floor(r() * nb.length)];
      }
    }
    cluster('wald', 10, 3.5);
    cluster('fels', 7, 5.5);
    cluster('fels', 8);
    cluster('fels', 7);
    cluster('fels', 6);
    cluster('wald', 12);
    cluster('wald', 11);
    cluster('wald', 10);
    cluster('wald', 9);
    cluster('wald', 9);
    cluster('wald', 8);
    let best = -1, bd = 1e9;
    t.forEach((q, i) => {
      if (q.t !== 'wiese') return;
      const w = wpos(i);
      const d = w[0] * w[0] + w[1] * w[1];
      if (d < bd) { bd = d; best = i; }
    });
    t[best].b = 'feuer';
    t[best].n = 1;
    return t;
  }

  /* ---------- Zustand ---------- */
  let state, sel = null, lastSig = '', crewSig = '', timer = null, resetArm = false;

  function fresh() {
    const seed = Math.floor(Math.random() * 1e9);
    return {
      v: 1, seed: seed, day: 1, pop: 3, era: 0,
      res: { food: 24, wood: 12, stone: 0, fur: 0 },
      tiles: genTiles(seed), seq: 2,
      log: [{ d: 1, t: 'Eine kleine Gruppe erreicht ein Tal mit Fluss und Wald. Das Lagerfeuer brennt.' }],
      speed: 1, paused: false, won: false, wonSeen: false,
      crew: 0, mw: 0, mDone: false, mSeen: false
    };
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      if (s && s.v === 1 && Array.isArray(s.tiles) && s.tiles.length === N && s.res && Number.isFinite(s.pop)) return s;
    } catch (e) {}
    return null;
  }
  function say(t) {
    state.log.unshift({ d: state.day, t: t });
    if (state.log.length > 30) state.log.length = 30;
  }
  const season = () => Math.floor(((state.day - 1) % (DPS * 4)) / DPS);
  const dayIn = () => ((state.day - 1) % DPS) + 1;
  const yearOf = () => Math.floor((state.day - 1) / (DPS * 4)) + 1;

  /* Sechseckraster, spitze Ecke oben, ungerade Reihen nach rechts versetzt */
  function adj(i) {
    const x = i % COLS, y = Math.floor(i / COLS), o = y & 1, r = [];
    [[1, 0], [-1, 0], [o ? 1 : 0, -1], [o ? 0 : -1, -1], [o ? 1 : 0, 1], [o ? 0 : -1, 1]].forEach((d) => {
      const nx = x + d[0], ny = y + d[1];
      if (nx >= 0 && nx < COLS && ny >= 0 && ny < ROWS) r.push(ny * COLS + nx);
    });
    return r;
  }
  function wpos(i) {
    const x = i % COLS, y = Math.floor(i / COLS);
    return [x + 0.5 * (y & 1) - (COLS - 0.5) / 2, (y - (ROWS - 1) / 2) * 0.8660254];
  }

  /* Grundeinkommen: jeder Bewohner sammelt von sich aus etwas, auch ohne Arbeitsplatz */
  function baseIncome() {
    return { food: state.pop * 0.4 * (season() === 3 ? 0.25 : 1), wood: state.pop * 0.4 };
  }
  function compute() {
    const s = season();
    const prod = { food: 0, wood: 0, stone: 0, fur: 0 };
    let housing = 0, count = 0, lagers = 0, monI = -1;
    const prods = [];
    state.tiles.forEach((q, i) => {
      if (!q.b) return;
      const b = B[q.b];
      count++;
      if (b.house) housing += b.house;
      if (q.b === 'lager') lagers++;
      if (q.b === 'monument') monI = i;
      if (b.out) prods.push(i);
    });
    prods.sort((a, b) => state.tiles[a].n - state.tiles[b].n);
    const mon = monI >= 0 && !state.mDone;
    const builders = mon ? Math.min(state.crew, state.pop) : 0;
    const avail = state.pop - builders;
    const info = {};
    let employed = 0;
    prods.forEach((i) => {
      const q = state.tiles[i], b = B[q.b];
      const active = employed < avail;
      if (active) employed++;
      const base = (b.outBy && b.outBy[q.t]) || b.out;
      const n = adj(i).filter((j) => state.tiles[j].b === 'werk').length;
      const bonus = Math.min(n * 0.25, 0.5);
      const m = b.sm[s] * (1 + bonus);
      const out = {};
      for (const k in base) {
        out[k] = base[k] * m;
        if (active) prod[k] += out[k];
      }
      info[i] = { active: active, out: out, bonus: bonus, sm: b.sm[s] };
    });
    const base = baseIncome();
    prod.food += base.food;
    prod.wood += base.wood;
    const cap = {};
    RES.forEach((r) => { cap[r.k] = CAP0[r.k] + CAPL[r.k] * lagers; });
    return {
      prod: prod, housing: housing, count: count, employed: employed, info: info, base: base,
      cap: cap, lagers: lagers, mon: mon, monI: monI, builders: builders, avail: avail,
      stalled: prods.length - employed, eat: state.pop + builders * BUILD_FOOD,
      mw: mon ? monWork(builders, state.res) : null
    };
  }

  /* Bauleistung des Tages: begrenzt durch Bauarbeiter, Winter und das Material, das vorhanden ist */
  function monWork(n, res) {
    const winter = season() === 3 ? 0.5 : 1;
    const want = Math.max(0, Math.min(n * winter, MON.work - state.mw));
    const spare = { stone: res.stone, wood: season() >= 2 ? Math.max(0, res.wood - frostNeed(counts())) : res.wood };
    let w = want, lim = null;
    ['stone', 'wood'].forEach((r) => {
      const can = spare[r] / (MON[r] / MON.work);
      if (can < w) { w = can; lim = r; }
    });
    return { want: want, w: Math.max(0, w), lim: lim, winter: winter < 1 };
  }
  function canAfford(cost) {
    for (const k in cost) if (state.res[k] < cost[k]) return false;
    return true;
  }

  /* ---------- Ablauf ---------- */
  function tick() {
    if ((state.won && !state.wonSeen) || (state.mDone && !state.mSeen)) return;
    const c = compute();
    state.day++;
    const before = {};
    for (const k in state.res) before[k] = state.res[k];
    for (const k in c.prod) state.res[k] += c.prod[k];
    state.res.food -= c.eat;
    if (state.res.food < 0) {
      state.res.food = 0;
      if (state.pop > 1) { state.pop--; say('Hunger. Ein Bewohner zieht fort.'); }
      else say('Hunger. Der Letzte hält durch.');
    } else if (state.pop < c.housing && state.res.food >= state.pop * 3 && Math.random() < 0.4) {
      state.pop++;
      say(pick(['Ein Kind wurde geboren.', 'Ein Wanderer hat sich dem Dorf angeschlossen.']));
    }
    if (c.mon) {
      const m = monWork(c.builders, state.res);
      if (m.w > 0) {
        state.mw += m.w;
        state.res.stone -= m.w * MON.stone / MON.work;
        state.res.wood -= m.w * MON.wood / MON.work;
      }
      if (state.mw >= MON.work - 1e-6) {
        state.mw = MON.work; state.mDone = true; state.mSeen = false; state.crew = 0; state.paused = true;
        say('Der letzte Stein sitzt. Der Steinkreis ist vollendet.');
      } else if (m.lim && c.builders > 0 && state.day % 4 === 0) {
        say('Die Bauarbeiter warten auf ' + (m.lim === 'stone' ? 'Stein' : 'Holz') + '.');
      }
    }
    /* Mehr als das Lager fasst, verdirbt; Altbestände darüber bleiben unangetastet */
    RES.forEach((r) => {
      const lim = Math.max(c.cap[r.k], before[r.k]);
      if (state.res[r.k] > lim) state.res[r.k] = lim;
    });
    if (season() === 3 && dayIn() === 1) say('Der Winter beginnt. Eine Frostnacht droht, halte Brennholz bereit.');
    maybeEvent(c);
    checkEra();
    save();
    render();
    floaters(c);
    loop();
  }

  /* ---------- Gefahren und Schutz ---------- */
  const protection = (n) => 1 - Math.pow(0.6, n);
  function counts() {
    const k = { pal: 0, heal: 0, hut: 0, lag: 0 };
    state.tiles.forEach((q) => {
      if (q.b === 'palisade') k.pal++;
      else if (q.b === 'heiler') k.heal++;
      else if (q.b === 'huette') k.hut++;
      else if (q.b === 'lager') k.lag++;
    });
    return k;
  }
  const frostNeed = (k) => Math.max(0, Math.ceil(state.pop * 1.5) - 6 * k.hut);
  function lose(n) {
    const l = Math.max(0, Math.min(n, state.pop - 1));
    state.pop -= l;
    return l;
  }
  let alertTimer = null;
  function hit(msg) {
    say(msg);
    const a = $('alert');
    a.textContent = msg; a.hidden = false;
    clearTimeout(alertTimer);
    alertTimer = setTimeout(() => { a.hidden = true; }, 8000);
  }
  function disaster() {
    if (state.day < 10 || state.pop < 4) return false;
    const s = season(), k = counts();
    if (s === 3 && state.frostY !== yearOf() && Math.random() < 0.18) {
      state.frostY = yearOf();
      const need = frostNeed(k);
      if (need === 0) say('Frostnacht. Die Hütten halten die Kälte ab.');
      else if (state.res.wood >= need) {
        state.res.wood -= need;
        say('Frostnacht. Ihr verbrennt ' + need + ' Holz, alle überstehen die Nacht.');
      } else {
        const miss = need - state.res.wood;
        state.res.wood = 0;
        const dead = lose(Math.min(Math.ceil(miss / 1.5), Math.ceil(state.pop * 0.4)));
        hit('Frostnacht. Das Brennholz reicht nicht: ' + dead + ' ' + (dead === 1 ? 'Bewohner erfriert.' : 'Bewohner erfrieren.'));
      }
      return true;
    }
    if (Math.random() > 0.07) return false;
    const opts = [['wolf', s === 3 ? 2 : s === 2 ? 1.5 : 1]];
    if (state.era >= 1) opts.push(['seuche', s === 1 ? 2 : s === 2 ? 1.3 : 1]);
    if (state.era >= 2) opts.push(['raid', 1]);
    let x = Math.random() * opts.reduce((a, o) => a + o[1], 0), e = opts[0][0];
    for (let i = 0; i < opts.length; i++) {
      if (x < opts[i][1]) { e = opts[i][0]; break; }
      x -= opts[i][1];
    }
    const d = {
      wolf: { n: k.pal, frac: 0.12, ok: 'Ein Wolfsrudel schleicht ums Dorf. Die Palisade schreckt es ab.', bad: 'Ein Wolfsrudel greift an', hint: 'Eine Palisade hätte geholfen.' },
      seuche: { n: k.heal, frac: 0.2, ok: 'Eine Krankheit geht um. Die Heilerin dämmt sie rechtzeitig ein.', bad: 'Eine Seuche bricht aus', hint: 'Eine Heilerhütte hätte geholfen.' },
      raid: { n: k.pal, frac: 0.15, ok: 'Fremde Krieger nähern sich und drehen vor der Palisade ab.', bad: 'Fremde Krieger überfallen das Dorf', hint: 'Eine Palisade hätte geholfen.' }
    }[e];
    if (Math.random() < protection(d.n)) { say(d.ok); return true; }
    const dead = lose(Math.max(1, Math.round(state.pop * d.frac)));
    let extra = '';
    if (e === 'raid') {
      const keep = Math.pow(0.7, k.lag);
      const f = Math.floor(state.res.food * 0.25 * keep), w = Math.floor(state.res.wood * 0.25 * keep);
      state.res.food -= f; state.res.wood -= w;
      extra = ' Sie rauben ' + f + ' Nahrung und ' + w + ' Holz.';
    }
    hit(d.bad + ': ' + dead + ' ' + (dead === 1 ? 'Bewohner stirbt.' : 'Bewohner sterben.') + extra + (d.n === 0 ? ' ' + d.hint : ''));
    return true;
  }

  function maybeEvent(c) {
    if (disaster()) return;
    if (Math.random() > 0.09) return;
    const opts = ['pilze', 'sturm', 'mammut'];
    if (state.pop < c.housing) opts.push('wanderer');
    if (state.mDone && state.pop < c.housing) opts.push('pilger', 'pilger');
    const e = pick(opts);
    if (e === 'mammut') {
      if (state.tiles.some((q) => q.b === 'jagd')) {
        state.res.food += 14; state.res.fur += 2;
        say('Eine Mammutherde zieht durchs Tal. Die Jäger bringen 14 Nahrung und 2 Felle heim.');
      } else say('Eine Mammutherde zieht durchs Tal. Ohne Jagdlager bleibt sie unerreichbar.');
    } else if (e === 'pilze') {
      state.res.food += 8;
      say('Nach dem Regen wachsen Pilze am Waldrand. +8 Nahrung.');
    } else if (e === 'sturm') {
      const lag = counts().lag, lose = Math.min(Math.max(0, 5 - 2 * lag), Math.floor(state.res.wood));
      if (lose > 0) { state.res.wood -= lose; say('Ein Sturm weht ' + lose + ' Holz ins Tal hinaus.'); }
      else say(lag ? 'Ein Sturm zieht übers Tal. Das Vorratslager hält, nichts geht verloren.' : 'Ein Sturm zieht übers Tal. Es gibt nichts zu verlieren.');
    } else if (e === 'pilger') {
      state.pop++;
      say('Pilger ziehen zum Steinkreis. Einer von ihnen bleibt im Dorf.');
    } else if (e === 'wanderer') {
      state.pop++;
      say('Ein Wanderer sucht Schutz am Feuer und bleibt.');
    }
  }

  function checkEra() {
    const c = compute();
    const tot = state.tiles.some((q) => q.b === 'totem');
    const need = [null, () => state.pop >= 6, () => state.pop >= 9 && c.count >= 7, () => tot && state.pop >= 14];
    const msg = ['', 'Aus der Horde wird eine Sippe: sechs Menschen teilen das Feuer.', 'Aus der Sippe wird ein Dorf.', 'Der Totempfahl steht. Aus dem Dorf wird ein Stamm.'];
    const next = state.era + 1;
    if (next <= 3 && need[next]()) {
      state.era = next;
      const nu = unlockNames(next);
      say(msg[next] + (nu ? ' Neu verfügbar: ' + nu + '.' : ''));
      if (next === 3) { state.won = true; state.wonSeen = false; state.paused = true; }
    }
  }

  function loop() {
    clearTimeout(timer);
    if (state.paused) return;
    timer = setTimeout(function () {
      if (!document.hidden) tick(); else loop();
    }, 3000 / state.speed);
  }

  /* ---------- Aktionen ---------- */
  function build(key) {
    const q = state.tiles[sel];
    if (!q || q.b) return;
    const b = B[key];
    if (!b || b.build === false || b.terrain.indexOf(q.t) < 0 || b.unlock > state.era || !canAfford(b.cost)) return;
    if (b.unique && state.tiles.some((t) => t.b === key)) return;
    const cc = compute();
    if (b.out && cc.employed >= cc.avail) return;
    for (const k in b.cost) state.res[k] -= b.cost[k];
    q.b = key; q.n = state.seq++;
    if (key === 'monument') { state.crew = Math.min(2, state.pop); crewSig = ''; }
    checkEra();
    save(); lastSig = ''; render(); loop();
  }
  function demolish() {
    const q = state.tiles[sel];
    if (!q || !q.b || q.b === 'feuer' || q.b === 'totem' || q.b === 'monument') return;
    const b = B[q.b];
    ['wood', 'stone'].forEach((k) => { if (b.cost[k]) state.res[k] += Math.floor(b.cost[k] / 2); });
    q.b = null; q.n = 0;
    save(); lastSig = ''; render();
  }
  function nearest(type) {
    const f = state.tiles.findIndex((q) => q.b === 'feuer');
    let best = null, bd = 1e9;
    state.tiles.forEach((q, i) => {
      if (q.t !== type) return;
      const a = wpos(i), b = wpos(f);
      const d = Math.pow(a[0] - b[0], 2) + Math.pow(a[1] - b[1], 2);
      if (d < bd) { bd = d; best = i; }
    });
    return best;
  }
  function newGame() {
    state = fresh(); sel = nearest('wald'); lastSig = ''; crewSig = '';
    save(); render(); loop();
  }

  /* ---------- Darstellung ---------- */
  const board = $('board'), tiles = [];
  for (let i = 0; i < N; i++) {
    const b = document.createElement('button');
    b.type = 'button'; b.dataset.i = i;
    tiles.push(b); board.appendChild(b);
  }

  function costHTML(cost) {
    return Object.keys(cost).map((k) => {
      const lack = state.res[k] < cost[k];
      return '<span class="cost' + (lack ? ' lack' : '') + '">' + ic(ICON[k], 'color:var(--r-' + k + ')') + cost[k] + '</span>';
    }).join('');
  }
  function tip(key, t) {
    const b = B[key];
    if (b.out) {
      const o = (b.outBy && b.outBy[t]) || b.out;
      return Object.keys(o).map((k) => '+' + fmt(o[k]) + ' ' + NAMES[k]).join(', ') + ' pro Tag';
    }
    return b.tip;
  }

  function renderHead(c) {
    $('era').textContent = ERAS[state.era];
    const s = season(), dis = dayIn();
    const toW = s === 3 ? 9 - dis : (3 - s) * DPS - dis + 1;
    const w = s === 3 ? 'Winter noch ' + toW + pl(toW, ' Tag', ' Tage') : 'Winter in ' + toW + pl(toW, ' Tag', ' Tagen');
    $('clock').innerHTML = '<strong><span class="dot" style="--sc:var(--s' + s + ')"></span>' + SEASONS[s] + ', Tag ' + dis + '</strong>Jahr ' + yearOf() + ' · <span class="' + (s === 3 || toW <= 6 ? 'warn' : '') + '">' + w + '</span>';
    board.dataset.s = s;
  }
  function renderRes(c) {
    $('res').innerHTML = RES.map((r) => {
      const rate = r.k === 'food' ? c.prod.food - c.eat : c.prod[r.k];
      const full = state.res[r.k] >= c.cap[r.k] - 0.01;
      const cls = rate < -0.05 ? 'neg' : rate > 0.05 ? 'pos' : '';
      const sign = rate < -0.05 ? '−' : '+';
      const note = full && rate > 0.05 ? '<small class="neg">Lager voll</small>' : '<small class="' + cls + '">' + sign + fmt(Math.abs(rate)) + '/Tag</small>';
      return '<div class="rc"><span class="rl">' + ic(r.i, 'color:var(--r-' + r.k + ')') + '<span>' + r.n + '</span></span><b>' + Math.floor(state.res[r.k]) + '<i class="cap' + (full ? ' full' : '') + '" title="Lagerraum">/' + c.cap[r.k] + '</i></b>' + note + '</div>';
    }).join('');
  }
  function renderFolk(c) {
    const free = c.avail - c.employed;
    const net = c.prod.food - c.eat;
    let warn = '';
    if (net < -0.05) {
      const d = Math.floor(state.res.food / -net);
      if (d <= 8) warn = '<span class="warn">Nahrung reicht noch ' + d + pl(d, ' Tag', ' Tage') + '</span>';
    }
    let pips = '';
    const total = Math.max(c.housing, state.pop);
    for (let i = 0; i < total; i++) pips += '<span class="pip ' + (i < c.employed ? 'job' : i < c.employed + c.builders ? 'build' : i < state.pop ? 'idle' : 'free') + '"></span>';
    $('folk').innerHTML = '<div class="fh"><b>' + state.pop + ' ' + pl(state.pop, 'Bewohner', 'Bewohner') + '</b><span class="muted">' + c.employed + ' bei der Arbeit · ' + (c.builders ? c.builders + ' am Steinkreis · ' : '') + free + ' frei · ' + c.housing + ' Schlafplätze · Grundeinkommen +' + fmt(c.base.food) + ' Nahrung, +' + fmt(c.base.wood) + ' Holz</span>' + warn + '</div><div class="pips" aria-hidden="true">' + pips + '</div>';
  }
  function renderTiles(c) {
    state.tiles.forEach((q, i) => {
      const el = tiles[i], T = TER[q.t];
      el.className = 'tile t-' + q.t + (i === sel ? ' sel' : '');
      const x = (i % COLS) + 1, y = Math.floor(i / COLS) + 1;
      el.setAttribute('aria-label', T.n + (q.b ? ', ' + B[q.b].name : '') + ', Reihe ' + y + ', Spalte ' + x);
      el.setAttribute('aria-pressed', i === sel ? 'true' : 'false');
      if (scene3d) return;
      let h;
      if (q.b) {
        const b = B[q.b], f = c.info[i];
        h = '<span class="plate" style="color:var(--' + b.col + ')">' + ic(b.icon) + '</span>';
        if (f) h += '<i class="w ' + (f.active ? 'on' : 'off') + '" title="' + (f.active ? 'Arbeitet' : 'Wartet auf einen Bewohner') + '"></i>';
      } else {
        h = ic(T.i).replace('class="ic"', 'class="ic terr"');
      }
      el.innerHTML = h;
    });
  }
  function infoHTML(i, c) {
    const q = state.tiles[i], b = B[q.b], f = c.info[i];
    let h = '<p>' + b.desc + '</p>';
    if (b.out && f) {
      h += '<ul class="facts"><li>' + (f.active ? '<b class="pos">Arbeitet</b>' : '<b class="neg">Wartet auf einen freien Bewohner</b>') + '</li>';
      h += '<li>Ertrag: ' + Object.keys(f.out).map((k) => '+' + fmt(f.out[k]) + ' ' + NAMES[k]).join(', ') + ' pro Tag</li>';
      if (f.bonus) h += '<li>Werkstatt nebenan: +' + Math.round(f.bonus * 100) + ' %</li>';
      if (f.sm !== 1) h += '<li>' + SEASONS[season()] + ': ×' + fmt(f.sm) + '</li>';
      h += '</ul>';
    } else if (q.b === 'monument') {
      const pct = Math.round(100 * state.mw / MON.work), rest = MON.work - state.mw;
      h += '<div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '"><i style="width:' + pct + '%"></i></div><ul class="facts">';
      if (state.mDone) h += '<li><b class="pos">Vollendet</b></li><li>Pilger ziehen ins Tal und bleiben manchmal.</li>';
      else {
        h += '<li><b>' + pct + ' %</b> · ' + fmt(state.mw) + ' von ' + MON.work + ' Arbeitstagen</li>';
        h += '<li>Noch nötig: ' + Math.ceil(rest * MON.stone / MON.work) + ' Stein, ' + Math.ceil(rest * MON.wood / MON.work) + ' Holz</li>';
        h += '<li>' + c.builders + ' ' + pl(c.builders, 'Bauarbeiter', 'Bauarbeiter') + ', verteilt wird oben unter „Steinkreis“</li>';
      }
      h += '</ul>';
    } else if (q.b === 'lager') {
      h += '<ul class="facts"><li>Jedes Lager: +' + CAPL.food + ' Nahrung, +' + CAPL.wood + ' Holz, +' + CAPL.stone + ' Stein, +' + CAPL.fur + ' Felle</li><li>Raub und Sturm treffen weniger</li></ul>';
    } else if (b.house) {
      h += '<ul class="facts"><li>+' + b.house + ' Schlafplätze</li></ul>';
    } else if (b.tip) {
      h += '<ul class="facts"><li>' + b.tip + '</li></ul>';
    } else h += '<div style="height:12px"></div>';
    return h;
  }
  function optHTML(key, q, c) {
    const b = B[key];
    let why = '';
    const missing = Object.keys(b.cost).filter((k) => state.res[k] < b.cost[k]).map((k) => Math.ceil(b.cost[k] - state.res[k]) + ' ' + NAMES[k]);
    if (b.unlock > state.era) why = 'Frei ab Stufe ' + ERAS[b.unlock] + '.';
    else if (b.unique && state.tiles.some((t) => t.b === key)) why = 'Steht bereits.';
    else if (missing.length) why = 'Es fehlt: ' + missing.join(', ');
    else if (b.out && c.employed >= c.avail) why = c.builders ? 'Kein freier Bewohner. Zieh Bauarbeiter ab.' : 'Kein freier Bewohner.';
    return '<button type="button" class="opt" data-build="' + key + '"' + (why ? ' disabled' : '') + '>' +
      '<span style="color:var(--' + b.col + ')">' + ic(b.icon) + '</span>' +
      '<span><b>' + b.name + '</b><small>' + tip(key, q.t) + '</small><span class="costs">' + (costHTML(b.cost) || '<span class="cost">Kostenlos</span>') + '</span>' +
      (why ? '<span class="why">' + why + '</span>' : '') + '</span></button>';
  }
  function renderPanel(c) {
    const q = sel == null ? null : state.tiles[sel];
    const sig = JSON.stringify([sel, q && q.b, RES.map((r) => Math.floor(state.res[r.k])), c.employed, state.pop, c.cap.food, state.crew, Math.floor(state.mw), state.mDone, sel != null && c.info[sel] ? c.info[sel].active : 0, season(), state.era]);
    if (sig === lastSig) return;
    lastSig = sig;
    const el = $('panel');
    if (!q) {
      el.innerHTML = '<h2>Dorfplatz</h2><p class="muted">Tippe ein Feld an, um dort zu bauen.</p>';
      return;
    }
    const T = TER[q.t];
    const x = (sel % COLS) + 1, y = Math.floor(sel / COLS) + 1;
    let h = '<div class="ph"><span style="color:var(--' + (q.b ? B[q.b].col : 'muted') + ')">' + ic(q.b ? B[q.b].icon : T.i) + '</span><div><h2>' + (q.b ? B[q.b].name : T.n) + '</h2><p class="muted">' + T.n + ' · Reihe ' + y + ', Spalte ' + x + '</p></div></div>';
    if (q.b) {
      h += infoHTML(sel, c);
      if (q.b !== 'feuer' && q.b !== 'totem' && q.b !== 'monument') {
        const b = B[q.b];
        const back = ['wood', 'stone'].filter((k) => b.cost[k]).map((k) => Math.floor(b.cost[k] / 2) + ' ' + NAMES[k]).join(', ');
        h += '<button type="button" class="btn" data-demolish="1">Abreißen' + (back ? ' (+' + back + ')' : '') + '</button>';
      }
    } else {
      h += '<div class="opts">' + ORDER.filter((k) => B[k].terrain.indexOf(q.t) >= 0).sort((a, b) => (B[a].unlock > state.era) - (B[b].unlock > state.era)).map((k) => optHTML(k, q, c)).join('') + '</div>';
    }
    el.innerHTML = h;
  }
  function renderGoal(c) {
    const tot = state.tiles.some((q) => q.b === 'totem');
    const e = state.era;
    let g = null;
    if (e === 0) g = { t: 'Sippe', u: unlockNames(1), items: [['Bewohner', state.pop, 6]] };
    else if (e === 1) g = { t: 'Dorf', u: unlockNames(2), items: [['Bewohner', state.pop, 9], ['Bauten', c.count, 7]] };
    else if (e === 2) g = { t: 'Stamm', u: '', items: [['Bewohner', state.pop, 14], ['Totempfahl', tot ? 1 : 0, 1]] };
    let monHtml = '';
    if (e >= 2) {
      if (state.mDone) monHtml = '<p class="ok" style="margin-top:10px">✓ Steinkreis vollendet</p>';
      else if (c.monI >= 0) monHtml = '<p style="margin-top:10px"><b>Steinkreis ' + Math.round(100 * state.mw / MON.work) + ' %</b> <span class="muted">· Bauarbeiter verteilst du oben</span></p>';
      else monHtml = '<p class="muted" style="margin-top:10px">Großes Vorhaben: der Steinkreis. Wähle ein Wiesenfeld und baue die Baustelle.</p>';
    }
    if (!g) {
      $('goal').innerHTML = '<h3>Ziel erreicht</h3><p class="muted">Der Stamm steht. Baut weiter, solange das Feuer brennt.</p>' + monHtml;
      return;
    }
    const pct = Math.round(100 * g.items.reduce((a, it) => a + Math.min(it[1] / it[2], 1), 0) / g.items.length);
    $('goal').innerHTML = '<h3>Nächstes Ziel: ' + g.t + '</h3><div class="bar"><i style="width:' + pct + '%"></i></div><ul class="chk">' +
      g.items.map((it) => '<li class="' + (it[1] >= it[2] ? 'ok' : '') + '">' + (it[1] >= it[2] ? '✓' : '○') + ' ' + it[0] + ' ' + Math.min(it[1], it[2]) + '/' + it[2] + '</li>').join('') + '</ul>' + (g.u ? '<p class="muted" style="margin-top:10px">Schaltet frei: ' + g.u + '</p>' : '') + monHtml;
  }
  function renderCrew(c) {
    const el = $('crew');
    if (!c.mon) { el.hidden = true; crewSig = ''; return; }
    const m = c.mw;
    const sig = JSON.stringify([state.crew, c.builders, state.pop, Math.floor(state.mw), Math.round(m.w * 10), m.lim, m.winter, c.stalled, state.mw > 0]);
    if (sig === crewSig) return;
    crewSig = sig;
    el.hidden = false;
    const pct = Math.round(100 * state.mw / MON.work);
    const lines = [];
    lines.push('Bauleistung heute etwa +' + fmt(m.w) + ' von ' + MON.work + ' Arbeitstagen');
    if (m.winter) lines.push('Im Winter nur halbe Leistung');
    if (m.lim && c.builders > 0) lines.push('<span class="warn">Es fehlt ' + (m.lim === 'stone' ? 'Stein' : 'Holz') + ', die Bauarbeiter warten</span>');
    if (c.builders > 0) lines.push('Bauarbeiter essen ' + fmt(BUILD_FOOD) + ' Nahrung mehr');
    if (c.stalled > 0) lines.push('<span class="warn">' + c.stalled + ' ' + pl(c.stalled, 'Arbeitsplatz steht', 'Arbeitsplätze stehen') + ' still</span>');
    el.innerHTML = '<div class="ch"><h3>Steinkreis</h3><span><b>' + pct + ' %</b></span></div>' +
      '<div class="bar" role="progressbar" aria-label="Baufortschritt" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '"><i style="width:' + pct + '%"></i></div>' +
      '<div class="stepper"><button type="button" class="btn" data-crew="-1" aria-label="Einen Bauarbeiter abziehen"' + (state.crew <= 0 ? ' disabled' : '') + '>−</button>' +
      '<output aria-live="polite"><b>' + c.builders + '</b> von ' + state.pop + ' ' + pl(state.pop, 'Bewohner', 'Bewohnern') + ' bauen</output>' +
      '<button type="button" class="btn" data-crew="1" aria-label="Einen Bauarbeiter hinzufügen"' + (state.crew >= state.pop ? ' disabled' : '') + '>+</button></div>' +
      '<p class="muted">' + lines.join(' · ') + '</p>';
  }
  function renderShield() {
    const k = counts(), pw = Math.round(100 * protection(k.pal)), ph = Math.round(100 * protection(k.heal));
    const need = frostNeed(k), have = Math.floor(state.res.wood);
    const cls = (p) => (p >= 40 ? 'fine' : 'low');
    const pal = k.pal + ' ' + pl(k.pal, 'Palisade', 'Palisaden') + ', Schutz ' + pw + ' %';
    const rows = [
      '<li><b>Wölfe</b><span class="' + cls(pw) + '">' + pal + '</span></li>',
      state.era >= 1
        ? '<li><b>Seuche</b><span class="' + cls(ph) + '">' + k.heal + ' ' + pl(k.heal, 'Heilerhütte', 'Heilerhütten') + ', Schutz ' + ph + ' %</span></li>'
        : '<li><b>Seuche</b><span class="muted">droht ab Stufe Sippe</span></li>',
      state.era >= 2
        ? '<li><b>Überfall</b><span class="' + cls(pw) + '">' + pal + '</span></li>'
        : '<li><b>Überfall</b><span class="muted">droht ab Stufe Dorf</span></li>',
      '<li><b>Frost</b>' + (need === 0
        ? '<span class="fine">Die Hütten halten warm</span>'
        : '<span class="' + (have >= need ? 'fine' : 'low') + '">Brennholz ' + have + ' von ' + need + ' im Winter</span>') + '</li>'
    ];
    $('shield').innerHTML = '<h3>Schutz</h3><ul>' + rows.join('') + '</ul>' +
      (state.day < 10 ? '<p class="muted">Bis Tag 10 bleibt es ruhig.</p>' : '');
  }
  function renderLog() {
    $('log').innerHTML = state.log.slice(0, 5).map((l) => '<li><time>Tag ' + l.d + '</time><span>' + l.t + '</span></li>').join('');
  }
  function renderCtl() {
    document.querySelectorAll('#seg button').forEach((b) => {
      const sp = +b.dataset.sp;
      b.setAttribute('aria-pressed', (sp === 0 ? state.paused : !state.paused && state.speed === sp) ? 'true' : 'false');
    });
    $('reset').textContent = resetArm ? 'Wirklich neu starten?' : 'Neues Dorf';
  }
  function renderWin() {
    const w = $('win');
    if (state.won && !state.wonSeen) {
      w.hidden = false;
      w.innerHTML = '<h2>Der Stamm steht</h2><p>Nach ' + (state.day - 1) + ' Tagen ragt der Totempfahl über das Tal. ' + state.pop + ' Menschen leben hier.</p><div class="row"><button type="button" class="btn primary" data-win="keep">Weiterspielen</button><button type="button" class="btn" data-win="again">Neues Dorf</button></div>';
    } else if (state.mDone && !state.mSeen) {
      w.hidden = false;
      w.innerHTML = '<h2>Der Steinkreis steht</h2><p>Nach ' + (state.day - 1) + ' Tagen erhebt sich der Kreis aus Stein über dem Tal. ' + state.pop + ' Menschen haben ihn gesehen, und bald kommen Pilger aus fernen Tälern.</p><div class="row"><button type="button" class="btn primary" data-win="keep">Weiterspielen</button><button type="button" class="btn" data-win="again">Neues Dorf</button></div>';
    } else w.hidden = true;
  }
  function render() {
    const c = compute();
    renderHead(c); renderRes(c); renderFolk(c); renderTiles(c);
    if (scene3d) scene3d.sync(c);
    renderCrew(c); renderPanel(c); renderGoal(c); renderShield(); renderLog(); renderCtl(); renderWin();
  }
  function floaters(c) {
    if (reduce) return;
    Object.keys(c.info).forEach((i) => {
      const f = c.info[i];
      if (!f.active) return;
      const k = Object.keys(f.out)[0];
      const s = document.createElement('span');
      s.className = 'pop';
      s.style.color = 'var(--r-' + k + ')';
      s.textContent = '+' + fmt(f.out[k]);
      s.addEventListener('animationend', () => s.remove());
      if (scene3d) {
        const p = scene3d.project(i);
        s.style.left = p.x + 'px'; s.style.top = p.y + 'px';
        board.appendChild(s);
      } else tiles[i].appendChild(s);
    });
  }

  /* ---------- 3D-Szene ---------- */
  let scene3d = null;
  const TH = { wiese: 0.22, wald: 0.22, fels: 0.3, fluss: 0.08 };
  const PD = { wiese: '#76883f', wald: '#55743c', fels: '#857d71', fluss: '#3f86a3', dirt: '#54402e', base: '#2f2620' };
  const PL = { wiese: '#a6bd5e', wald: '#80a950', fels: '#aea69b', fluss: '#63aac6', dirt: '#8f6e48', base: '#7c644a' };
  const FOL = ['#78b34f', '#4c9a3d', '#cf8a30', '#e4edf0'];
  const SKY = {
    d: [['#241d18', '#5b4631'], ['#241d18', '#5b4631'], ['#2a1f18', '#6a4a2c'], ['#2a3038', '#5d6770']],
    l: [['#bcd6df', '#efe6d0'], ['#aacfe0', '#f3ecd6'], ['#d3cdbd', '#f1dfbf'], ['#cfdde6', '#f4f1ea']]
  };
  function isDark() {
    const t = document.documentElement.getAttribute('data-theme');
    if (t) return t === 'dark';
    return !!(window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
  }

  function makeScene(onPick) {
    if (!window.THREE) return null;
    const T3 = window.THREE;
    let renderer;
    try { renderer = new T3.WebGLRenderer({ antialias: true, alpha: true }); } catch (e) { return null; }
    if (!renderer || !renderer.getContext || !renderer.getContext()) return null;
    const el = renderer.domElement;
    el.className = 'gl';
    el.setAttribute('aria-hidden', 'true');
    board.insertBefore(el, board.firstChild);
    board.classList.add('gl');
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T3.PCFSoftShadowMap;

    const anim = !reduce;
    const now = () => performance.now() / 1000;
    const scene = new T3.Scene();
    const camera = new T3.PerspectiveCamera(36, 1, 0.1, 100);
    const hemi = new T3.HemisphereLight(0xffffff, 0x8a7050, 0.9);
    scene.add(hemi);
    const sun = new T3.DirectionalLight(0xfff0d8, 0.85);
    sun.position.set(8, 15, 7);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -8; sun.shadow.camera.right = 8;
    sun.shadow.camera.top = 8; sun.shadow.camera.bottom = -8;
    sun.shadow.camera.near = 1; sun.shadow.camera.far = 60;
    sun.shadow.bias = -0.0008;
    scene.add(sun);
    scene.add(sun.target);
    const fireLight = new T3.PointLight(0xffa24a, 1.0, 3.6, 2);
    let fireBase = 1;

    const std = (c, o) => new T3.MeshStandardMaterial(Object.assign({ color: c, roughness: 1, metalness: 0, flatShading: true }, o || {}));
    const mTop = { wiese: std('#ffffff'), wald: std('#ffffff'), fels: std('#ffffff'), fluss: std('#ffffff', { roughness: 0.45 }) };
    const mDirt = std('#ffffff'), mBase = std('#ffffff'), mFolA = std('#ffffff'), mFolB = std('#ffffff');
    const mTrunk = std('#6b4a2b'), mWood = std('#9a7242'), mRock = std('#8b857b'), mRock2 = std('#aaa49a');
    const mFur = std('#b89a6a'), mDark = std('#2b211a'), mBone = std('#e6d9bd'), mOchre = std('#d9a441');
    const mRed = std('#b5472f'), mBerry = std('#a8324a'), mBerry2 = std('#6b3b8a'), mGreen = std('#5f8f3f');
    const mFish = std('#9fb7c4'), mSkin = std('#d9a47a'), mFoam = std('#e8f3f6');
    const mSoil = std('#6b4a30'), mSoil2 = std('#8a6340');
    const mFlame = new T3.MeshBasicMaterial({ color: 0xff9a2e });
    const mFlame2 = new T3.MeshBasicMaterial({ color: 0xffd36b });
    const mFrame = new T3.MeshBasicMaterial({ color: 0xf3d28f });

    const G = {
      box: new T3.BoxGeometry(1, 1, 1),
      cone4: new T3.ConeGeometry(0.5, 1, 4),
      cone6: new T3.ConeGeometry(0.5, 1, 6),
      cone8: new T3.ConeGeometry(0.5, 1, 8),
      cyl6: new T3.CylinderGeometry(0.5, 0.5, 1, 6),
      cyl8: new T3.CylinderGeometry(0.5, 0.5, 1, 8),
      ico: new T3.IcosahedronGeometry(0.5, 0),
      sph: new T3.SphereGeometry(0.5, 8, 6),
      hex: new T3.CylinderGeometry(0.56, 0.56, 1, 6)
    };
    function M(geo, mat, sx, sy, sz, x, y, z, parent) {
      const m = new T3.Mesh(geo, mat);
      m.scale.set(sx, sy, sz);
      m.position.set(x, y, z);
      m.castShadow = true; m.receiveShadow = true;
      if (parent) parent.add(m);
      return m;
    }

    /* Palette je Theme und Jahreszeit */
    function applyPalette() {
      const dk = isDark(), s = season(), P = dk ? PD : PL;
      const col = (h) => new T3.Color(h), white = col('#ffffff');
      const wiese = col(P.wiese), wald = col(P.wald), fels = col(P.fels), fluss = col(P.fluss);
      if (s === 3) { wiese.lerp(white, 0.6); wald.lerp(white, 0.5); fels.lerp(white, 0.3); fluss.lerp(white, 0.3); }
      else if (s === 2) { wiese.lerp(col('#c79a45'), 0.28); wald.lerp(col('#b07a3a'), 0.18); }
      else if (s === 1) { wiese.lerp(col('#c9c05a'), 0.12); }
      mTop.wiese.color.copy(wiese); mTop.wald.color.copy(wald); mTop.fels.color.copy(fels); mTop.fluss.color.copy(fluss);
      mFolA.color.set(FOL[s]);
      mFolB.color.set(FOL[s]).offsetHSL(0, 0, -0.07);
      mDirt.color.set(P.dirt); mBase.color.set(P.base);
      hemi.intensity = dk ? 0.6 : 0.5;
      hemi.color.set(dk ? '#ffd9a8' : '#ffffff');
      hemi.groundColor.set(dk ? '#4a3a2c' : '#9a8466');
      sun.intensity = dk ? 0.7 : 0.6;
      fireBase = dk ? 1 : 0.35;
      fireLight.intensity = fireBase;
      sun.color.set(dk ? '#ffc98a' : '#fff2dc');
      const sk = (dk ? SKY.d : SKY.l)[s];
      board.style.background = 'linear-gradient(' + sk[0] + ',' + sk[1] + ')';
      dirty = true;
    }

    /* Szenerie */
    function tree(p, x, z, s, h, fol) {
      M(G.cyl6, mTrunk, 0.07 * s, 0.22 * s, 0.07 * s, x, h + 0.11 * s, z, p);
      M(G.cone6, fol, 0.42 * s, 0.5 * s, 0.42 * s, x, h + 0.47 * s, z, p);
      M(G.cone6, fol, 0.3 * s, 0.4 * s, 0.3 * s, x, h + 0.72 * s, z, p);
    }

    /* Gebäude */
    function bFeuer(p) {
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * 6.283;
        M(G.ico, mRock, 0.12, 0.09, 0.12, Math.cos(a) * 0.22, 0.045, Math.sin(a) * 0.22, p);
      }
      const l1 = M(G.cyl6, mTrunk, 0.05, 0.36, 0.05, 0, 0.07, 0, p); l1.rotation.z = 1.2; l1.rotation.y = 0.4;
      const l2 = M(G.cyl6, mTrunk, 0.05, 0.36, 0.05, 0, 0.07, 0, p); l2.rotation.z = 1.2; l2.rotation.y = 2.2;
      const f1 = M(G.cone6, mFlame, 0.2, 0.34, 0.2, 0, 0.26, 0, p); f1.castShadow = false;
      const f2 = M(G.cone6, mFlame2, 0.12, 0.22, 0.12, 0, 0.21, 0, p); f2.castShadow = false;
      return { flames: [f1, f2] };
    }
    function bSammler(p) {
      M(G.cyl8, mWood, 0.28, 0.12, 0.28, 0, 0.06, 0, p);
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * 6.283;
        M(G.sph, k % 2 ? mBerry : mBerry2, 0.1, 0.1, 0.1, Math.cos(a) * 0.07, 0.14 + 0.01 * (k % 3), Math.sin(a) * 0.07, p);
      }
      M(G.ico, mFolA, 0.22, 0.18, 0.22, -0.28, 0.09, -0.2, p);
      M(G.ico, mFolB, 0.18, 0.15, 0.18, 0.3, 0.08, -0.25, p);
    }
    function bHolz(p) {
      M(G.cyl8, mTrunk, 0.26, 0.15, 0.26, -0.2, 0.075, 0.15, p);
      M(G.cyl8, mWood, 0.2, 0.02, 0.2, -0.2, 0.16, 0.15, p);
      const lg = (x, y, z) => { const m = M(G.cyl6, mWood, 0.1, 0.46, 0.1, x, y, z, p); m.rotation.z = Math.PI / 2; };
      lg(0.1, 0.05, -0.22); lg(0.1, 0.05, -0.34); lg(0.1, 0.14, -0.28);
      const h = M(G.cyl6, mTrunk, 0.03, 0.3, 0.03, -0.2, 0.3, 0.15, p); h.rotation.z = 0.4;
      M(G.box, mRock2, 0.1, 0.07, 0.03, -0.13, 0.41, 0.15, p);
    }
    function bStein(p) {
      M(G.ico, mRock, 0.34, 0.26, 0.3, -0.1, 0.13, -0.05, p);
      M(G.ico, mRock2, 0.24, 0.2, 0.22, 0.2, 0.1, 0.1, p);
      M(G.ico, mRock, 0.18, 0.14, 0.16, -0.22, 0.07, 0.25, p);
      M(G.ico, mRock2, 0.2, 0.15, 0.18, 0.22, 0.08, -0.22, p);
      const h = M(G.cyl6, mTrunk, 0.03, 0.4, 0.03, 0, 0.22, 0.28, p); h.rotation.x = 0.6;
      M(G.box, mRock2, 0.2, 0.04, 0.04, 0, 0.4, 0.37, p);
    }
    function bFisch(p) {
      M(G.box, mWood, 0.55, 0.05, 0.22, 0, 0.045, 0, p);
      M(G.cyl6, mTrunk, 0.05, 0.2, 0.05, -0.22, 0.1, 0.1, p);
      M(G.cyl6, mTrunk, 0.05, 0.2, 0.05, 0.22, 0.1, 0.1, p);
      M(G.cyl6, mTrunk, 0.03, 0.4, 0.03, -0.15, 0.2, -0.15, p);
      M(G.cyl6, mTrunk, 0.03, 0.4, 0.03, 0.15, 0.2, -0.15, p);
      M(G.box, mTrunk, 0.38, 0.03, 0.03, 0, 0.4, -0.15, p);
      [-0.1, 0, 0.1].forEach((x) => M(G.sph, mFish, 0.04, 0.14, 0.07, x, 0.3, -0.15, p));
    }
    function bJagd(p) {
      for (let k = 0; k < 3; k++) {
        const a = k * 2.094;
        const m = M(G.cyl6, mTrunk, 0.03, 0.62, 0.03, Math.cos(a) * 0.12, 0.3, Math.sin(a) * 0.12, p);
        m.rotation.z = Math.cos(a) * 0.3; m.rotation.x = -Math.sin(a) * 0.3;
      }
      M(G.box, mFur, 0.26, 0.32, 0.02, 0, 0.3, 0.16, p);
      M(G.cyl6, mTrunk, 0.02, 0.7, 0.02, 0.3, 0.35, -0.15, p);
      M(G.cone4, mRock2, 0.05, 0.1, 0.05, 0.3, 0.74, -0.15, p);
    }
    function bHuette(p) {
      M(G.cone8, mFur, 0.62, 0.6, 0.62, 0, 0.3, 0, p);
      M(G.cyl8, mRed, 0.44, 0.05, 0.44, 0, 0.18, 0, p);
      M(G.box, mDark, 0.12, 0.22, 0.04, 0, 0.11, 0.25, p);
      const a = M(G.cyl6, mTrunk, 0.025, 0.3, 0.025, 0, 0.64, 0, p); a.rotation.z = 0.3;
      const b = M(G.cyl6, mTrunk, 0.025, 0.3, 0.025, 0, 0.64, 0, p); b.rotation.z = -0.3;
      const c = M(G.cyl6, mTrunk, 0.025, 0.3, 0.025, 0, 0.64, 0, p); c.rotation.x = 0.3;
    }
    function bWerk(p) {
      M(G.cyl8, mWood, 0.34, 0.16, 0.34, 0, 0.08, 0, p);
      M(G.ico, mRock2, 0.12, 0.04, 0.08, -0.06, 0.18, 0, p);
      M(G.ico, mRock2, 0.1, 0.03, 0.07, 0.07, 0.18, 0.05, p);
      M(G.ico, mRock, 0.1, 0.08, 0.1, 0.22, 0.05, -0.2, p);
      M(G.cone4, mRock2, 0.05, 0.18, 0.05, -0.25, 0.09, 0.2, p);
      M(G.cone4, mRock2, 0.05, 0.16, 0.05, -0.18, 0.08, 0.28, p);
    }
    function bTotem(p) {
      M(G.cyl8, mRock, 0.42, 0.08, 0.42, 0, 0.04, 0, p);
      const cols = [mRed, mBone, mOchre, mDark];
      cols.forEach((m, k) => {
        const y = 0.23 + k * 0.3;
        M(G.box, m, 0.3, 0.3, 0.3, 0, y, 0, p);
        const eye = k === 3 ? mBone : mDark;
        M(G.box, eye, 0.06, 0.05, 0.02, -0.07, y + 0.05, 0.16, p);
        M(G.box, eye, 0.06, 0.05, 0.02, 0.07, y + 0.05, 0.16, p);
        M(G.box, eye, 0.12, 0.03, 0.02, 0, y - 0.07, 0.16, p);
      });
      const w1 = M(G.box, mOchre, 0.28, 0.05, 0.12, -0.28, 0.58, 0, p); w1.rotation.z = 0.3;
      const w2 = M(G.box, mOchre, 0.28, 0.05, 0.12, 0.28, 0.58, 0, p); w2.rotation.z = -0.3;
      const top = M(G.cone4, mOchre, 0.2, 0.28, 0.2, 0, 1.42, 0, p); top.rotation.y = Math.PI / 4;
    }
    function bAcker(p) {
      M(G.box, mSoil, 0.7, 0.05, 0.62, 0, 0.025, 0, p);
      for (let k = 0; k < 4; k++) {
        const z = -0.2 + k * 0.133;
        M(G.box, mSoil2, 0.66, 0.03, 0.045, 0, 0.065, z, p);
        for (let j = 0; j < 5; j++) M(G.cone4, mFolA, 0.05, 0.14, 0.05, -0.26 + j * 0.13, 0.13, z, p);
      }
      M(G.cyl6, mTrunk, 0.03, 0.4, 0.03, 0.3, 0.2, -0.28, p);
      M(G.box, mTrunk, 0.26, 0.03, 0.03, 0.3, 0.3, -0.28, p);
      M(G.sph, mBone, 0.08, 0.08, 0.08, 0.3, 0.43, -0.28, p);
      M(G.cone6, mOchre, 0.12, 0.07, 0.12, 0.3, 0.5, -0.28, p);
    }
    function bPalisade(p) {
      for (let k = 1; k < 14; k++) {
        const a = (k / 14) * 6.283, x = Math.cos(a) * 0.4, z = Math.sin(a) * 0.4, hgt = 0.42 + 0.06 * ((k * 7) % 3);
        M(G.cyl6, mTrunk, 0.08, hgt, 0.08, x, hgt / 2, z, p);
        M(G.cone4, mWood, 0.08, 0.1, 0.08, x, hgt + 0.04, z, p);
      }
      M(G.box, mWood, 0.5, 0.04, 0.04, 0, 0.18, -0.4, p);
    }
    function bHeiler(p) {
      M(G.cyl8, mOchre, 0.42, 0.22, 0.42, 0, 0.11, 0, p);
      M(G.cone8, mGreen, 0.58, 0.3, 0.58, 0, 0.37, 0, p);
      M(G.box, mDark, 0.1, 0.16, 0.03, 0, 0.09, 0.22, p);
      M(G.box, mRed, 0.14, 0.04, 0.02, 0, 0.3, 0.22, p);
      M(G.box, mRed, 0.04, 0.14, 0.02, 0, 0.3, 0.22, p);
      M(G.sph, mGreen, 0.09, 0.12, 0.09, -0.3, 0.12, 0.12, p);
      M(G.sph, mBerry2, 0.07, 0.07, 0.07, 0.3, 0.1, 0.14, p);
      M(G.sph, mGreen, 0.08, 0.1, 0.08, 0.28, 0.1, -0.1, p);
    }
    function bLager(p) {
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach((d) => M(G.cyl6, mTrunk, 0.05, 0.22, 0.05, d[0] * 0.2, 0.11, d[1] * 0.16, p));
      M(G.box, mWood, 0.52, 0.04, 0.42, 0, 0.22, 0, p);
      M(G.box, mWood, 0.46, 0.22, 0.36, 0, 0.35, 0, p);
      const roof = M(G.cone4, mOchre, 0.66, 0.26, 0.66, 0, 0.59, 0, p); roof.rotation.y = Math.PI / 4;
      M(G.box, mDark, 0.1, 0.14, 0.03, 0, 0.33, 0.19, p);
      M(G.sph, mBone, 0.12, 0.09, 0.12, -0.32, 0.05, 0.3, p);
      M(G.cyl8, mWood, 0.14, 0.13, 0.14, 0.32, 0.065, 0.3, p);
      M(G.cyl8, mWood, 0.12, 0.1, 0.12, 0.34, 0.05, -0.28, p);
    }
    /* Steinkreis: Schritt für Schritt wachsende Steinsetzung, 8 Pfeiler, 8 Decksteine, Altar, zwei innere Tore */
    function bMonument(p, step) {
      const n = step || 0, done = n >= MON.steps;
      M(G.cyl8, mDirt, 0.98, 0.03, 0.98, 0, 0.015, 0, p);
      const seq = [];
      for (let i = 0; i < 8; i++) { seq.push(['u', i]); if (i >= 1) seq.push(['l', i - 1]); }
      seq.push(['l', 7], ['a', 0], ['t', 0], ['t', 1]);
      const R1 = 0.34;
      seq.forEach((it, k) => {
        if (k >= n) return;
        const i = it[1];
        if (it[0] === 'u') {
          const a = (i / 8) * 6.283, m = M(G.box, i % 2 ? mRock2 : mRock, 0.12, 0.46 + 0.04 * (i % 3), 0.08, Math.cos(a) * R1, 0.26, Math.sin(a) * R1, p);
          m.rotation.y = -a - 1.5708; m.rotation.z = 0.03 * ((i % 3) - 1);
        } else if (it[0] === 'l') {
          const a = ((i + 0.5) / 8) * 6.283, r = R1 * Math.cos(0.3927);
          const m = M(G.box, mRock2, 0.3, 0.07, 0.1, Math.cos(a) * r, 0.5, Math.sin(a) * r, p);
          m.rotation.y = -a - 1.5708;
        } else if (it[0] === 'a') {
          M(G.box, mRock, 0.2, 0.06, 0.11, 0, 0.06, 0, p);
        } else {
          const z = i ? 0.11 : -0.11;
          M(G.box, mRock, 0.07, 0.34, 0.07, -0.09, 0.2, z, p);
          M(G.box, mRock, 0.07, 0.34, 0.07, 0.09, 0.2, z, p);
          M(G.box, mRock2, 0.28, 0.06, 0.09, 0, 0.4, z, p);
        }
      });
      if (!done) {
        /* Baustelle: Steinhaufen, Schlitten auf Rollhölzern, Stangen */
        M(G.ico, mRock, 0.16, 0.1, 0.14, 0.36, 0.06, -0.12, p);
        M(G.ico, mRock2, 0.11, 0.08, 0.12, 0.42, 0.05, 0.02, p);
        for (let k = 0; k < 3; k++) { const l = M(G.cyl6, mTrunk, 0.04, 0.22, 0.04, -0.38, 0.045, 0.1 + k * 0.1, p); l.rotation.z = 1.5708; }
        M(G.box, mWood, 0.3, 0.03, 0.1, -0.38, 0.1, 0.2, p);
        M(G.box, mRock, 0.2, 0.08, 0.08, -0.38, 0.16, 0.2, p);
        const st = M(G.cyl6, mTrunk, 0.025, 0.4, 0.025, 0.05, 0.2, 0.44, p); st.rotation.z = 0.2;
      }
    }
    const BLD = { lager: bLager, monument: bMonument, palisade: bPalisade, heiler: bHeiler, acker: bAcker, feuer: bFeuer, sammler: bSammler, holz: bHolz, stein: bStein, fisch: bFisch, jagd: bJagd, huette: bHuette, werk: bWerk, totem: bTotem };

    /* Aufbau der Karte */
    const tg = [], parts = [], bases = [];
    const ground = M(G.box, mBase, COLS - 1, 0.1, (ROWS - 1) * 0.866, 0, -0.1, 0, scene);
    ground.castShadow = false;
    for (let i = 0; i < N; i++) {
      const g = new T3.Group();
      const wp = wpos(i);
      g.position.set(wp[0], 0, wp[1]);
      g.userData.i = i;
      scene.add(g);
      tg.push(g);
      parts.push({ g: g, scen: null, bld: null, key: null, t0: 0, anim: null, foam: [] });
    }
    function buildTile(i) {
      const q = state.tiles[i], p = parts[i], g = tg[i], h = TH[q.t];
      while (g.children.length) g.remove(g.children[0]);
      p.foam = []; p.key = null; p.anim = null;
      const base = new T3.Mesh(G.hex, [mDirt, mTop[q.t], mDirt]);
      base.scale.set(1, h, 1); base.position.y = h / 2;
      base.receiveShadow = true; base.castShadow = true;
      g.add(base);
      bases[i] = base;
      const ex = i % COLS, ey = Math.floor(i / COLS);
      if (ex === 0 || ey === 0 || ex === COLS - 1 || ey === ROWS - 1) {
        const col = new T3.Mesh(G.hex, mBase);
        col.scale.set(1, 0.6, 1); col.position.y = -0.3;
        g.add(col);
      }
      p.scen = new T3.Group(); g.add(p.scen);
      p.bld = new T3.Group(); p.bld.position.y = h; g.add(p.bld);
      const r = mulberry(state.seed + i * 977);
      if (q.t === 'wald') {
        const n = 3 + Math.floor(r() * 2);
        for (let k = 0; k < n; k++) tree(p.scen, (r() - 0.5) * 0.62, (r() - 0.5) * 0.62, 0.8 + r() * 0.6, h, k % 2 ? mFolB : mFolA);
      } else if (q.t === 'fels') {
        const n = 2 + Math.floor(r() * 2);
        for (let k = 0; k < n; k++) {
          const m = M(G.ico, k % 2 ? mRock2 : mRock, 0.22 + r() * 0.14, 0.16 + r() * 0.12, 0.22 + r() * 0.14, (r() - 0.5) * 0.5, h + 0.08, (r() - 0.5) * 0.5, p.scen);
          m.rotation.y = r() * 3;
        }
      } else if (q.t === 'wiese') {
        for (let k = 0; k < 2; k++) M(G.cone4, mGreen, 0.06, 0.16, 0.06, (r() - 0.5) * 0.7, h + 0.08, (r() - 0.5) * 0.7, p.scen).castShadow = false;
        if (r() < 0.5) M(G.sph, r() < 0.5 ? mOchre : mBone, 0.06, 0.06, 0.06, (r() - 0.5) * 0.6, h + 0.04, (r() - 0.5) * 0.6, p.scen).castShadow = false;
      } else {
        for (let k = 0; k < 2; k++) {
          const f = new T3.Mesh(G.box, mFoam);
          f.scale.set(0.05, 0.012, 0.26); f.position.set(k ? 0.2 : -0.2, h + 0.008, 0);
          f.userData.ph = k * 0.5 + r() * 0.3;
          p.scen.add(f); p.foam.push(f);
        }
      }
    }
    let seedSeen = null, seasonSeen = -1, fireIdx = -1, dirty = true, hoverI = null;
    function rebuildAll() { for (let i = 0; i < N; i++) buildTile(i); }

    /* Selektionsrahmen */
    const frame = new T3.Group();
    mFrame.side = T3.DoubleSide;
    const ring = new T3.Mesh(new T3.RingGeometry(0.46, 0.54, 6, 1, Math.PI / 2), mFrame);
    ring.rotation.x = -Math.PI / 2;
    frame.add(ring);
    scene.add(frame);

    /* Bewohner */
    const bodyCols = ['#8a5a35', '#6b7a4a', '#a6643c', '#7a5a7a', '#506a7a'];
    const crowd = [];
    function person(k) {
      const g = new T3.Group();
      M(G.cyl6, std(bodyCols[k % 5]), 0.1, 0.16, 0.1, 0, 0.1, 0, g);
      M(G.sph, mSkin, 0.1, 0.1, 0.1, 0, 0.23, 0, g);
      M(G.sph, mDark, 0.105, 0.06, 0.105, 0, 0.265, 0, g);
      scene.add(g);
      return g;
    }
    function syncPeople(c) {
      const want = [];
      Object.keys(c.info).forEach((k) => { if (c.info[k].active) want.push({ m: 'w', i: +k }); });
      if (c.builders && c.monI >= 0) for (let k = 0; k < c.builders; k++) want.push({ m: 'b', i: c.monI, k: k, n: c.builders });
      const idle = Math.max(0, c.avail - c.employed);
      for (let k = 0; k < idle; k++) want.push({ m: 'i', k: k, n: idle });
      const cap = Math.min(want.length, 32);
      while (crowd.length < cap) crowd.push({ g: person(crowd.length), m: 'i', i: 0, k: 0, n: 1 });
      crowd.forEach((p, j) => {
        if (j < cap) { Object.assign(p, want[j]); p.g.visible = true; } else p.g.visible = false;
      });
    }

    /* Kamera, Eingaben */
    let yaw = 0.3;
    const R = 30, CH = 27;
    const ray = new T3.Raycaster(), mouse = new T3.Vector2();
    function pickAt(cx, cy) {
      const r = el.getBoundingClientRect();
      mouse.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(mouse, camera);
      const hits = ray.intersectObjects(bases, false);
      return hits.length ? hits[0].object.parent.userData.i : null;
    }
    let zoom = 0.45, cx = 0, cz = 0;
    function setZoom(z) { zoom = Math.max(0.22, Math.min(1.1, z)); dirty = true; }
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      setZoom(zoom * Math.exp(e.deltaY * 0.0012));
    }, { passive: false });
    const ptrs = new Map();
    let pinch = null, down = null, moved = false;
    const span = () => { const a = [...ptrs.values()]; return Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) || 1; };
    el.addEventListener('pointerdown', (e) => {
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try { el.setPointerCapture(e.pointerId); } catch (_) {}
      if (ptrs.size === 2) { pinch = { d: span(), z: zoom }; down = null; moved = true; return; }
      down = { x: e.clientX, yaw: yaw }; moved = false;
    });
    el.addEventListener('pointermove', (e) => {
      if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && ptrs.size >= 2) { setZoom(pinch.z * pinch.d / span()); return; }
      if (down) {
        const dx = e.clientX - down.x;
        if (Math.abs(dx) > 5) moved = true;
        if (moved) { yaw = Math.max(-0.9, Math.min(0.9, down.yaw + dx * 0.008)); dirty = true; }
      } else if (e.pointerType === 'mouse') {
        hoverI = pickAt(e.clientX, e.clientY);
        el.style.cursor = hoverI == null ? 'grab' : 'pointer';
        dirty = true;
      }
    });
    el.addEventListener('pointerup', (e) => {
      ptrs.delete(e.pointerId);
      if (ptrs.size < 2) pinch = null;
      if (down && !moved) { const i = pickAt(e.clientX, e.clientY); if (i != null) onPick(i); }
      down = null;
    });
    el.addEventListener('pointercancel', (e) => { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null; down = null; });
    el.addEventListener('pointerleave', () => { hoverI = null; dirty = true; });

    function resize() {
      const w = Math.max(1, board.clientWidth), h = Math.max(1, board.clientHeight);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      dirty = true;
    }
    if (window.ResizeObserver) new ResizeObserver(resize).observe(board);
    window.addEventListener('resize', resize);

    const easeOutBack = (k) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); };
    function update(t) {
      const k = Math.max(0, Math.min(1, (0.85 - zoom) / 0.4));
      const tx = sel != null ? tg[sel].position.x * k : 0, tz = sel != null ? tg[sel].position.z * k : 0;
      const ease = anim ? 0.16 : 1;
      cx += (tx - cx) * ease; cz += (tz - cz) * ease;
      if (!anim && (Math.abs(tx - cx) > 0.001 || Math.abs(tz - cz) > 0.001)) dirty = true;
      camera.position.set(cx + Math.sin(yaw) * R * zoom, CH * zoom, cz + Math.cos(yaw) * R * zoom);
      camera.lookAt(cx, 0.25, cz);
      const half = 6 + 11 * zoom, sc = sun.shadow.camera;
      sc.left = -half; sc.right = half; sc.top = half; sc.bottom = -half;
      sc.updateProjectionMatrix();
      sun.position.set(cx + 8, 15, cz + 7);
      sun.target.position.set(cx, 0, cz);
      sun.target.updateMatrixWorld();
      parts.forEach((p, i) => {
        const target = (i === hoverI || i === sel) ? 0.05 : 0;
        tg[i].position.y += (target - tg[i].position.y) * (anim ? 0.2 : 1);
        if (p.key) {
          const k = Math.min(1, (t - p.t0) / 0.45);
          p.bld.scale.setScalar(Math.max(anim ? easeOutBack(k) : 1, 0.001));
        }
        p.foam.forEach((f) => { f.position.z = (((t * 0.25 + f.userData.ph) % 1) - 0.5) * 0.9; });
      });
      if (anim && fireIdx >= 0 && parts[fireIdx].anim) {
        const fl = parts[fireIdx].anim.flames;
        fl[0].scale.y = 0.34 * (1 + 0.14 * Math.sin(t * 14));
        fl[1].scale.y = 0.22 * (1 + 0.2 * Math.sin(t * 17 + 1));
        fireLight.intensity = fireBase * (1 + 0.15 * Math.sin(t * 11) + 0.1 * Math.sin(t * 23));
      }
      crowd.forEach((p, j) => {
        if (!p.g.visible) return;
        if (p.m === 'w') {
          const g = tg[p.i], h = TH[state.tiles[p.i].t];
          p.g.position.set(g.position.x + 0.3, h + g.position.y, g.position.z + 0.26);
          p.g.rotation.z = anim ? Math.sin(t * 6 + j) * 0.12 : 0;
          p.g.rotation.y = -0.6;
        } else if (p.m === 'b') {
          const g = tg[p.i], a = (p.k * 6.283) / p.n + 0.4;
          p.g.position.set(g.position.x + Math.cos(a) * 0.47, TH[state.tiles[p.i].t] + g.position.y, g.position.z + Math.sin(a) * 0.47);
          p.g.rotation.y = -a + 1.57;
          p.g.rotation.z = anim ? Math.sin(t * 5 + j) * 0.14 : 0;
        } else if (fireIdx >= 0) {
          const f = tg[fireIdx], a = t * 0.25 + (p.k * 6.283) / p.n;
          p.g.position.set(f.position.x + Math.cos(a) * 0.42, TH[state.tiles[fireIdx].t] + f.position.y + (anim ? Math.abs(Math.sin(t * 3 + j)) * 0.012 : 0), f.position.z + Math.sin(a) * 0.42);
          p.g.rotation.y = -a - 1.57;
          p.g.rotation.z = 0;
        }
      });
      if (sel != null && state.tiles[sel]) {
        const g = tg[sel];
        frame.visible = true;
        frame.position.set(g.position.x, TH[state.tiles[sel].t] + g.position.y + 0.03, g.position.z);
        const s = 1 + (anim ? 0.015 * Math.sin(t * 4) : 0);
        frame.scale.set(s, 1, s);
      } else frame.visible = false;
    }

    function sync(c) {
      if (seedSeen !== state.seed) { seedSeen = state.seed; rebuildAll(); }
      const s = season();
      if (s !== seasonSeen) { seasonSeen = s; applyPalette(); }
      state.tiles.forEach((q, i) => {
        const p = parts[i];
        const step = q.b === 'monument' ? Math.min(MON.steps, Math.floor(MON.steps * state.mw / MON.work + 1e-6)) : 0;
        const key = q.b === 'monument' ? 'monument:' + step : q.b;
        if (p.key === key) return;
        const grow = !(p.key && String(p.key).indexOf('monument') === 0 && q.b === 'monument');
        while (p.bld.children.length) p.bld.remove(p.bld.children[0]);
        p.bld.scale.setScalar(1);
        p.key = key; p.anim = null;
        p.scen.visible = !q.b || q.t === 'fluss';
        if (q.b) {
          p.anim = BLD[q.b](p.bld, step) || null;
          p.t0 = anim && grow ? now() : -100;
          if (q.b === 'feuer') { p.bld.add(fireLight); fireLight.position.set(0, 0.45, 0); }
        }
      });
      fireIdx = state.tiles.findIndex((q) => q.b === 'feuer');
      syncPeople(c);
      dirty = true;
    }
    function project(i) {
      camera.updateMatrixWorld();
      const g = tg[i];
      const v = new T3.Vector3(g.position.x, TH[state.tiles[i].t] + 0.8, g.position.z).project(camera);
      return { x: (v.x * 0.5 + 0.5) * el.clientWidth, y: (-v.y * 0.5 + 0.5) * el.clientHeight };
    }

    try {
      if (window.matchMedia) matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyPalette);
    } catch (e) {}
    try { new MutationObserver(applyPalette).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] }); } catch (e) {}

    applyPalette();
    resize();
    (function loopFrame() {
      requestAnimationFrame(loopFrame);
      if (document.hidden) return;
      if (anim || dirty) {
        update(anim ? now() : 0);
        renderer.render(scene, camera);
        dirty = false;
      }
    })();
    return { sync: sync, project: project, zoomBy: function (f) { setZoom(zoom * f); } };
  }

  /* ---------- Eingaben ---------- */
  function selectTile(i) {
    sel = i; lastSig = '';
    render();
    if (window.innerWidth < 860) {
      const p = $('panel');
      if (p.getBoundingClientRect().top > window.innerHeight - 160) p.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest' });
    }
  }
  board.addEventListener('click', (e) => {
    const t = e.target.closest('.tile');
    if (t) selectTile(+t.dataset.i);
  });
  board.addEventListener('focusin', (e) => {
    const t = e.target.closest && e.target.closest('.tile');
    if (t && scene3d && +t.dataset.i !== sel) selectTile(+t.dataset.i);
  });
  $('panel').addEventListener('click', (e) => {
    const b = e.target.closest('[data-build]');
    if (b) { build(b.dataset.build); return; }
    if (e.target.closest('[data-demolish]')) demolish();
  });
  $('crew').addEventListener('click', (e) => {
    const b = e.target.closest('[data-crew]');
    if (!b) return;
    state.crew = Math.max(0, Math.min(state.pop, state.crew + (+b.dataset.crew)));
    crewSig = ''; lastSig = '';
    save(); render();
  });
  $('seg').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const sp = +b.dataset.sp;
    if (sp === 0) state.paused = true;
    else { state.speed = sp; state.paused = false; state.wonSeen = true; state.mSeen = true; }
    save(); render(); loop();
  });
  $('reset').addEventListener('click', () => {
    if (!resetArm) {
      resetArm = true; renderCtl();
      setTimeout(() => { resetArm = false; renderCtl(); }, 3500);
      return;
    }
    resetArm = false; newGame();
  });
  $('win').addEventListener('click', (e) => {
    const b = e.target.closest('[data-win]');
    if (!b) return;
    if (b.dataset.win === 'keep') { state.wonSeen = true; state.mSeen = true; state.paused = false; save(); render(); loop(); }
    else newGame();
  });

  /* ---------- Start ---------- */
  function boot(data) {
    const ok = data && Array.isArray(data.tiles) && data.tiles.length === N && data.res && Number.isFinite(data.pop);
    state = ok ? data : (load() || fresh());
    state.era = state.era || 0;
    state.log = Array.isArray(state.log) ? state.log : [];
    state.speed = [1, 2, 4].indexOf(state.speed) >= 0 ? state.speed : 1;
    state.paused = !!state.paused;
    state.crew = state.crew | 0; state.mw = +state.mw || 0; state.mDone = !!state.mDone; state.mSeen = !!state.mSeen;
    sel = nearest('wald');
    try { scene3d = makeScene(selectTile); } catch (e) { scene3d = null; }
    if (!scene3d) {
      const H = 0.75 * ROWS + 0.25;
      board.classList.add('hex2d');
      board.style.aspectRatio = (COLS + 0.5) + ' / ' + (1.1547 * H);
      tiles.forEach((b, i) => {
        const x = i % COLS, y = Math.floor(i / COLS);
        b.style.left = ((x + 0.5 * (y & 1)) * 100 / (COLS + 0.5)) + '%';
        b.style.top = (y * 75 / H) + '%';
        b.style.width = (100 / (COLS + 0.5)) + '%';
        b.style.height = (100 / H) + '%';
      });
    }
    if (scene3d) {
      $('hint3d').hidden = false;
      $('zoomseg').hidden = false;
      $('zin').addEventListener('click', () => scene3d.zoomBy(0.75));
      $('zout').addEventListener('click', () => scene3d.zoomBy(1.33));
    }
    render(); loop();
  }
  boot();
})();
