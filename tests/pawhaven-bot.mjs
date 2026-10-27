// Pawhaven bot: a scripted builder plays the early meadows from a fixed build plan per meadow and checks each one can
// reach its goals in a fair number of years. The plan says what to build and in what order; a small placer finds the
// spot: streets on a grid every four tiles from the way-in road, buildings in the blocks between them, and helpers next
// to the homes that are missing them. Run with a meadow id to play just that one, and --log for a yearly line.
import assert from 'node:assert/strict';
import { PawhavenGame, BUILDINGS, YEAR, MONTH, FOODS, foodKinds } from '../.checks/pawhaven-game.js';

const mod = (a, n) => ((a % n) + n) % n;
// A step is [what, ...args]: 'main' road across, 'streets' r (the grid out to r tiles from the centre), a building kind
// with a count, 'homes' n (keep adding plots until there are n), 'trade' good mode n, 'route' id, 'tax' level.
export const PLANS = {
  clover: [
    ['main'], ['hall'], ['streets', 5], ['well', 2], ['homes', 10], ['berry', 2], ['granary'], ['market'],
    ['homes', 16], ['well'], ['berry'], ['streets', 8], ['homes', 22], ['well'], ['market'], ['berry'],
  ],
  willow: [
    ['main'], ['hall'], ['streets', 6], ['well', 2], ['homes', 10], ['berry', 2], ['granary'], ['market'], ['fireWatch'],
    ['homes', 16], ['hayFarm'], ['tower'], ['homes', 20], ['fireWatch'], ['streets', 10], ['berry'], ['market'], ['homes', 26], ['well', 2], ['oatFarm'],
    ['homes', 32], ['fireWatch'], ['berry'], ['market'], ['garden', 4],
  ],
  sandy: [
    ['main'], ['hall'], ['streets', 6], ['well', 2], ['homes', 10], ['berry', 2], ['granary'], ['market'], ['fireWatch'],
    ['homes', 16], ['sandPit'], ['storehouse'], ['dustMill'], ['bathhouse'], ['tower'], ['hayFarm'], ['homes', 22], ['fireWatch'],
    ['streets', 10], ['berry'], ['market'], ['bathhouse'], ['homes', 30], ['well', 2], ['sandPit'], ['fireWatch'], ['herb'], ['oatFarm'],
    ['homes', 36], ['market'], ['bathhouse'], ['berry'], ['tower'],
  ],
  clayfoot: [
    ['main'], ['hall'], ['streets', 6], ['well', 2], ['homes', 10], ['berry', 2], ['granary'], ['market'], ['fireWatch'],
    ['homes', 16], ['sandPit'], ['storehouse'], ['dustMill'], ['bathhouse'], ['tower'], ['hayFarm'], ['homes', 22], ['fireWatch'],
    ['streets', 10], ['berry'], ['market'], ['bathhouse'], ['homes', 30], ['well', 2], ['sandPit'], ['fireWatch'], ['herb'], ['oatFarm'],
    ['homes', 36], ['market'], ['bathhouse'], ['berry'], ['tower'], ['homes', 44],
  ],
  foxglove: [
    ['main'], ['zones', -12, 0], ['hall'], ['streets', 6], ['well', 2], ['homes', 10], ['berry', 2], ['granary'], ['market'], ['fireWatch'],
    ['homes', 16], ['sandPit'], ['storehouse'], ['dustMill'], ['bathhouse'], ['tower'], ['hayFarm'], ['homes', 22], ['fireWatch'], ['foxWatch', 2],
    ['streets', 10], ['berry'], ['market'], ['bathhouse'], ['homes', 30], ['well', 2], ['clayPit'], ['potter'], ['herb'], ['oatFarm'],
    ['homes', 36], ['market'], ['clayPit'], ['potter'], ['woodcutter'], ['toymaker'], ['story'], ['foxWatch', 2], ['gardens'], ['homes', 44],
  ],
  stormy: [
    ['main'], ['zones', -12, 0], ['statue'], ['hall'], ['streets', 6], ['well', 2], ['homes', 10], ['berry', 2], ['granary'], ['market'], ['fireWatch'],
    ['homes', 16], ['sandPit'], ['storehouse'], ['dustMill'], ['bathhouse'], ['tower'], ['hayFarm'], ['homes', 22], ['fireWatch'],
    ['streets', 10], ['berry'], ['market'], ['bathhouse'], ['homes', 30], ['well', 2], ['clayPit'], ['potter'], ['herb'], ['oatFarm'],
    ['homes', 36], ['market'], ['clayPit'], ['potter'], ['woodcutter'], ['toymaker'], ['story'], ['gardens'], ['homes', 44],
    ['hayFarm'], ['weaver'], ['music'], ['gardens'], ['homes', 52],
  ],
  pawhaven: [
    ['main'], ['zones', -12, 0], ['statue'], ['hall'], ['streets', 6], ['well', 2], ['homes', 10], ['berry', 2], ['granary'], ['market'], ['fireWatch'],
    ['homes', 16], ['sandPit'], ['storehouse'], ['dustMill'], ['bathhouse'], ['tower'], ['hayFarm'], ['homes', 22], ['fireWatch'], ['foxWatch', 2],
    ['streets', 10], ['berry'], ['market'], ['bathhouse'], ['homes', 30], ['well', 2], ['clayPit'], ['potter'], ['herb'], ['oatFarm'],
    ['homes', 36], ['market'], ['clayPit'], ['potter'], ['woodcutter'], ['toymaker'], ['story'], ['foxWatch', 2], ['gardens'], ['homes', 44],
    ['hayFarm'], ['weaver'], ['music'], ['gardens'], ['homes', 56],
    ['tradingPost'], ['route', 'mossy'], ['route', 'thistle'], ['route', 'bramble'], ['route', 'pebble'], ['trade', 'dust', 'import', 30],
    ['trade', 'pottery', 'export', 80], ['trade', 'toys', 'import', 30], ['trade', 'wood', 'import', 30], ['trade', 'hay', 'import', 40],
  ],
};

export function play(id, { years = 0, log = false, seed } = {}) {
  const g = new PawhavenGame({ meadow: id, seed }), N = g.size, ey = g.entry / N | 0, cx = N >> 1;
  const plan = PLANS[id].map((s) => Object.assign([...s], { opening: true }));
  const onGrid = (x, y) => mod(y - ey, 4) === 0 || mod(x - cx, 4) === 0;
  const fromEntry = () => g.field('e', [g.entry]);
  // where the core goes, in blocks from the middle: the spot whose core and ring have the most open grass (the core
  // counts thrice; fertile meadow counts against, as farms want it), nearest the middle on a tie
  function site() {
    let best = [0, 0], bv = -Infinity;
    for (let oy = -3; oy <= 3; oy++) for (let ox = -3; ox <= 3; ox++) {
      const x0 = cx + 4 * (ox - 2), y0 = ey + 4 * (oy - 2);
      if (x0 < 0 || y0 < 0 || x0 + 20 > N || y0 + 20 > N) continue;
      let v = -0.01 * (Math.abs(ox) + Math.abs(oy));
      for (let y = y0; y < y0 + 20; y++) for (let x = x0; x < x0 + 20; x++) {
        const t = g.terrain[y * N + x], w = Math.max(Math.abs(bk(x, cx) - ox), Math.abs(bk(y, ey) - oy)) <= 1 ? 3 : 1;
        v += t === 0 || t === 5 ? w : t === 1 ? -w : 0;
      }
      if (v > bv) { bv = v; best = [ox, oy]; }
    }
    return best;
  }
  // the middle of the town: the crossing at the core's top-left corner (moved by 'zones')
  let mx = cx, my = ey, ob = [0, 0];
  const dist = (x, y) => Math.max(Math.abs(x - mx), Math.abs(y - my));
  let streetR = 0;

  const builtRoad = (x, y) => g.inside(x, y) && g.walkable(y * N + x);
  const touchesRoad = (x, y, s) => { for (let i = -1; i <= s; i++) for (let j = -1; j <= s; j++) { if ((i === -1 || i === s) === (j === -1 || j === s)) continue; if (builtRoad(x + i, y + j)) return true; } return false; };
  const fitsGrid = (x, y, s) => { for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) if (onGrid(x + i, y + j)) return false; return true; };
  // join a building to the roads that reach the way in, along the cheapest free tiles (with zones, round the fertile
  // meadow if it can)
  function connect(b, avoid = !!works) {
    const f = fromEntry(), prev = new Int32Array(N * N).fill(-2), q = [];
    for (let i = -1; i <= b.size; i++) for (let j = -1; j <= b.size; j++) {
      if ((i === -1 || i === b.size) === (j === -1 || j === b.size)) continue;
      const x = b.x + i, y = b.y + j; if (!g.inside(x, y)) continue;
      const t = y * N + x; if (prev[t] !== -2) continue;
      if (f[t] >= 0) return true;
      if (g.canBuild('road', x, y).ok) { prev[t] = -1; q.push(t); }
    }
    for (let h = 0; h < q.length; h++) {
      const c = q[h], x = c % N, y = (c - x) / N;
      for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
        const nx = x + dx, ny = y + dy; if (!g.inside(nx, ny)) continue;
        const n = ny * N + nx; if (prev[n] !== -2) continue;
        if (f[n] >= 0) { for (let t = c; t >= 0; t = prev[t]) g.build('road', t % N, (t / N) | 0); return true; }
        const ter = g.terrain[n];
        if (g.occ[n] || g.road[n] || g.fence[n] || ter === 2 || ter === 3 || ter === 4 || (avoid && ter === 1)) continue;
        prev[n] = c; q.push(n);
      }
    }
    return avoid ? connect(b, false) : false;
  }
  // where a helper is wanted: next to the first home (nearest the middle) that hasn't seen one lately
  const svcOf = { well: 'water', tower: 'water', bathhouse: 'dust', herb: 'healer', story: 'story', music: 'music' };
  // with zones (the later meadows): a core of 3 by 3 blocks round the middle, eight of homes round one kept for the
  // statue; a ring of blocks round that for the helpers who walk the homes' streets, and a second ring for stores, the
  // town hall and fox watches; outside them, food grows on one side and the messy works sit on the other
  const WORKS = ['sandPit', 'dustMill', 'clayPit', 'potter', 'tradingPost'];
  const DECOR = ['garden', 'pond', 'statue'];
  const STORES = ['granary', 'storehouse', 'hall', 'foxWatch'];
  const HELPERS = ['well', 'market', 'bathhouse', 'herb', 'story', 'music', 'statue'];
  let works = null;
  const bk = (v, c) => Math.floor((v - c) / 4);
  const zoneOf = (x, y) => {
    const bx = bk(x, cx) - ob[0], by = bk(y, ey) - ob[1];
    const r = Math.max(Math.abs(bx), Math.abs(by));
    if (r > 1) return r > 3 ? 'out' : r > 2 ? 'ring2' : 'ring';
    return mod(bx, 2) === 0 && mod(by, 2) === 0 ? 'kept' : 'home';
  };
  function anchor(kind) {
    const homes = g.homes().filter((h) => g.hasAccess(h)).sort((a, b) => dist(a.x, a.y) - dist(b.x, b.y) || a.id - b.id);
    const svc = svcOf[kind];
    let h;
    if (works && WORKS.includes(kind)) return works;
    if (works && (kind === 'berry' || kind === 'hayFarm' || kind === 'oatFarm')) return [2 * mx - works[0], works[1]];
    if (svc) h = homes.find((h) => (h.seen[svc] ?? -1e9) < g.tick - MONTH * 2);
    else if (kind === 'market' && works) return lonely() ?? [mx, my];
    else if (kind === 'market') h = homes.find((h) => h.pop && !FOODS.some((k) => h.store[k]));
    else if (kind === 'fireWatch') h = [...g.buildings.values()].filter((b) => BUILDINGS[b.kind].risk && b.kind !== 'rubble').sort((a, b) => b.risk - a.risk)[0];
    else if (kind === 'foxWatch') return foxSpot();
    else if (kind === 'granary' && works) { const f = fullest(); if (f) served.add(f[2]); return [mx, my]; }
    else if (kind === 'garden') h = [...homes].reverse().find((h) => h.level >= 3);
    return h ? [h.x, h.y] : [mx, my];
  }
  // the fullest farm with no granary within eight road steps (each farm gets one try)
  const served = new Set();
  function fullest() {
    const stores = [...g.buildings.values()].filter((b) => b.kind === 'granary');
    let best = null, bv = 0;
    for (const b of g.buildings.values()) {
      const s = BUILDINGS[b.kind], v = b.store[s.makes] ?? 0;
      if (!s.crop || v < 16 || v <= bv || !g.hasAccess(b) || served.has(b.id)) continue;
      const f = g.field(`d${b.id}`, g.doors(b));
      if (stores.some((t) => g.doors(t).some((d) => f[d] >= 0 && f[d] <= 8))) continue;
      bv = v; best = [b.x + 1, b.y + 1, b.id];
    }
    return best;
  }
  // the hungry home furthest from any stall
  function lonely() {
    const stalls = [...g.buildings.values()].filter((b) => b.kind === 'market');
    let best = null, bv = -1;
    for (const h of g.homes()) {
      if (!h.pop || FOODS.some((k) => h.store[k])) continue;
      let d = 99; for (const s of stalls) d = Math.min(d, Math.max(Math.abs(s.x - h.x), Math.abs(s.y - h.y)));
      if (d > bv) { bv = d; best = [h.x, h.y]; }
    }
    return best;
  }
  // a fox watch goes beside the outermost homes, round the town in turn
  let foxTurn = 0;
  function foxSpot() {
    const homes = g.homes(), d = [[-1, 0], [1, 0], [0, -1], [0, 1]][foxTurn++ % 4];
    let best = null, bv = -Infinity;
    for (const h of homes) { const v = (h.x - mx) * d[0] + (h.y - my) * d[1]; if (v > bv) { bv = v; best = [h.x, h.y]; } }
    return best ?? [mx, my];
  }
  function roomy(x, y) {
    const ox = mod(x - cx, 4), oy = mod(y - ey, 4), x0 = x - ox + 1, y0 = y - oy + 1;
    if (ox === 2 || oy === 2) return false;
    for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) { const b = g.buildingAt(x0 + i, y0 + j); if (b && b.size > 1) return true; }
    for (const [i, j] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      let ok = true;
      for (let v = 0; v < 2 && ok; v++) for (let u = 0; u < 2 && ok; u++) { const tx = x0 + i + u, ty = y0 + j + v; if ((tx === x && ty === y) || !g.canBuild('road', tx, ty).ok) ok = false; }
      if (ok) return true;
    }
    return false;
  }
  function place(kind) {
    const s = BUILDINGS[kind], [ax, ay] = anchor(kind), free = !!(s.on !== undefined || s.nearWater || s.nearTrees), decor = DECOR.includes(kind);
    // with zones, everything but farms and homes keeps off the fertile meadow where it can
    const spare = works && s.on === undefined && kind !== 'home';
    // with zones, a one-tile helper takes a block's corner and leaves room for a bigger one beside it
    const small = works && s.size === 1 && kind !== 'home' && kind !== 'garden';
    const pass = (zone) => {
      let best = null, bd = Infinity;
      for (let y = 0; y + s.size <= N; y++) for (let x = 0; x + s.size <= N; x++) {
        let d = Math.hypot(x + s.size / 2 - ax, y + s.size / 2 - ay);
        if (spare && d < bd) for (let j = 0; j < s.size; j++) for (let i = 0; i < s.size; i++) if (g.terrain[(y + j) * N + x + i] === 1) d += 20;
        if (d >= bd) continue;
        if (!free && !fitsGrid(x, y, s.size)) continue;
        if (zone !== null && !zone.includes(zoneOf(x, y))) continue;
        if (!free && !decor && !touchesRoad(x, y, s.size)) continue;
        if (!g.canBuild(kind, x, y).ok) continue;
        if (small && !roomy(x, y)) continue;
        best = [x, y]; bd = d;
      }
      return best;
    };
    // (a fire watch goes as near the building at risk as it can, wherever that is outside the homes; a stall only
    // where its seller meets homes)
    const best = !works ? pass(null) : kind === 'home' ? pass('home') ?? (g.homes().length < 60 ? pass('ring') : null)
      : kind === 'fireWatch' ? pass(['kept', 'ring', 'ring2', 'out']) : HELPERS.includes(kind) ? pass('kept') ?? pass('ring') ?? (kind === 'market' ? null : pass('ring2'))
      : STORES.includes(kind) ? pass('ring2') ?? pass('ring') : pass(['ring2', 'out']);
    if (!best) return false;
    const r = g.build(kind, best[0], best[1]);
    if (r.ok && !decor) connect(g.buildings.get(r.id));
    return r.ok;
  }
  // a garden in the middle of every block with homes round it
  function gardens() {
    for (let y = my - streetR; y <= my + streetR; y++) for (let x = mx - streetR; x <= mx + streetR; x++) {
      if (mod(x - cx, 4) !== 2 || mod(y - ey, 4) !== 2 || !g.inside(x, y)) continue;
      let n = 0;
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const b = g.buildingAt(x + i, y + j); if (b && b.kind === 'home') n++; }
      if (n >= 3 && g.canBuild('garden', x, y).ok) { if (g.purse < 25) return false; g.build('garden', x, y); }
    }
    return true;
  }
  function streets(r) {
    const todo = [];
    // with zones, the streets leave the fertile meadow whole for farms
    for (let y = my - r; y <= my + r; y++) for (let x = mx - r; x <= mx + r; x++) if (g.inside(x, y) && onGrid(x, y) && !g.road[y * N + x] && !(works && y !== ey && g.terrain[y * N + x] === 1 && zoneOf(x, y) !== 'home')) todo.push([dist(x, y), x, y]);
    todo.sort((a, b) => a[0] - b[0] || a[2] - b[2] || a[1] - b[1]);
    for (const [, x, y] of todo) { if (g.purse < 2) return false; g.build('road', x, y); }
    streetR = Math.max(streetR, r);
    return true;
  }
  const free = () => g.homes().reduce((n, h) => n + g.holds(h) - h.pop - h.away, 0);
  // try the plan's next step; true when it is done
  function doStep(st) {
    const [what, a, b, c] = st;
    if (what === 'main') { for (let x = 0; x < N; x++) g.build('road', x, ey); return true; }
    if (what === 'streets') return streets(a);
    if (what === 'trade') { g.setTrade(a, b, c); return true; }
    if (what === 'route') return g.openRoute(a).ok;
    if (what === 'tax') { g.setTax(a); return true; }
    if (what === 'zones') { works = [cx + a, ey + b]; ob = site(); mx = cx + 4 * ob[0]; my = ey + 4 * ob[1]; return true; }
    if (what === 'gardens') return gardens();
    if (what === 'homes') {
      if (g.homes().length >= a) return true;
      if (free() > 10 || g.purse < 30) return false;
      // with zones, a full core is as many homes as the town gets
      for (let k = 0; k < 4 && g.homes().length < a; k++) if (!place('home')) { if (works && streetR >= 14) return true; if (!streets(streetR + 2)) return false; }
      return g.homes().length >= a;
    }
    const n = a ?? 1;
    if (g.purse < BUILDINGS[what].cost + 10) return false;
    // with zones, a grown town waits for idle paws before it opens more jobs (food first: it is staffed first), adding
    // homes meanwhile, and gives up on the step after half a year
    if (works && g.pop > 250 && BUILDINGS[what].prio > 1 && BUILDINGS[what].jobs > g.unemployed * 2) {
      st.since ??= g.tick;
      if (g.tick - st.since > MONTH * 6) return true;
      if (free() < 8) for (let k = 0; k < 4; k++) if (!place('home')) break;
      return false;
    }
    const sp = BUILDINGS[what], picky = sp.on !== undefined || sp.nearWater || sp.nearTrees;
    // a farm, pit, tower or woodcutter with nowhere left to go is skipped: more streets won't make more meadow
    // with zones and the streets laid out to the second ring, a helper with no room left waits half a year
    if (!place(what)) { if (picky) { noRoom.add(what); return true; } if (works && streetR >= 16) { full[what] = g.tick; return true; } if (!streets(streetR + 2)) return false; if (!place(what)) { st.fails = (st.fails ?? 0) + 1; return st.fails > 3; } }
    st[1] = n - 1;
    return n - 1 <= 0;
  }
  const rebuild = [], seen = {};
  const count = (k) => { let n = 0; for (const b of g.buildings.values()) if (b.kind === k) n++; return n; };
  const stalls = (k) => { let n = 0; for (const b of g.buildings.values()) if (b.kind === 'market') n += b.store[k] ?? 0; return n; };
  const have = (k) => g.stock(k) + stalls(k);
  const open = (k) => g.open.has(k);
  // what makes each ware: the raw-goods maker, then the workshop
  const CHAIN = { pottery: ['clayPit', 'potter'], toys: ['woodcutter', 'toymaker'], bedding: ['hayFarm', 'weaver'], dust: ['sandPit', 'dustMill'] };
  function chain(good) {
    const [raw, maker] = CHAIN[good], raws = good === 'bedding' ? count(raw) + count('oatFarm') - 2 * count(maker) : count(raw) - count(maker);
    return raws <= 0 && g.stock(BUILDINGS[maker].takes) < 16 ? [[raw], [maker]] : [[maker]];
  }
  // the level each need opens, and what a meadow must have for that level
  const LEVEL_OF = { water: 2, food: 3, 'a dust bath': 4, 'a second kind of food': 5, pottery: 5, 'a healer': 5, toys: 6, stories: 6, 'a prettier street': 6,
    'a third kind of food': 7, bedding: 7, music: 7, 'an even prettier street': 7 };
  const REACH = { 5: ['potter', 'herb'], 6: ['toymaker', 'story'], 7: ['weaver', 'music', 'statue'] };
  const FOOD_OF = { berries: 'berry', hay: 'hayFarm', oats: 'oatFarm' };
  // once the plan is done: food when the town is hungry, jobs when paws are idle, helpers for what homes miss, else homes
  let jobTurn = 0, foodTurn = 0;
  const last = {};
  const popGoal = g.meadow.goals.find((q) => q.kind === 'pop'), purseGoal = g.meadow.goals.some((q) => q.kind === 'purse');
  // what a home's missing need asks for
  function fix(need) {
    if (need === 'water') return !works || count('well') * 5 < g.homes().length ? [['well']] : null;
    if (need === 'food') return works && FOODS.some((k) => g.stock(k) > 30) ? stall() : null;
    if (need === 'a dust bath') {
      const dry = [...g.buildings.values()].some((b) => b.kind === 'bathhouse' && b.workers && !b.store.dust);
      return dry ? (count('dustMill') * 3 <= count('bathhouse') ? chain('dust') : null) : [['bathhouse']];
    }
    if (need === 'a healer') return [['herb']];
    if (need === 'stories') return [['story']];
    if (need === 'music') return [['music']];
    if (need === 'pottery' || need === 'toys' || need === 'bedding') return have(need) >= 12 ? stall() : chain(need);
    if (need === 'a second kind of food' || need === 'a third kind of food') {
      const none = FOODS.filter((k) => open(FOOD_OF[k]) && !count(FOOD_OF[k]));
      if (none.length) return [[FOOD_OF[none[0]]]];
      const low = FOODS.filter((k) => have(k) < 12);
      if (!low.length) return stall();
      return [[FOOD_OF[low[foodTurn++ % low.length]]]];
    }
    if (need === 'a prettier street') return works ? [['gardens']] : [['gardens'], ['garden']];
    if (need === 'an even prettier street') return count('statue') < 2 ? [['gardens'], ['statue']] : [['gardens']];
    return null;
  }
  // a stall while there are fewer than one for every six homes (with zones; before that, always)
  const stall = () => (!works || enough('market') ? [['market']] : null);
  // food the farms and patches grow in a month, and what the homes eat (each kind a home holds is rounded up)
  const grows = (k) => { let n = 0; for (const b of g.buildings.values()) if (BUILDINGS[b.kind].makes === k && FOODS.includes(k)) n += BUILDINGS[b.kind].crop ? 13 : 8; return n; };
  const eats = () => { let n = 0; for (const h of g.homes()) if (h.pop) { const k = foodKinds(h.level); n += k * Math.ceil(Math.ceil(h.pop / 4) / k); } return n; };
  const noRoom = new Set(), full = {};
  // with zones, a helper is added only while every one of its kind is fully staffed, and up to one for so many homes
  const PER = { market: 5, bathhouse: 10, herb: 15, story: 12, music: 12 };
  const enough = (k) => {
    if (k === 'gardens' || !BUILDINGS[k].jobs) return true;
    if ([...g.buildings.values()].some((b) => b.kind === k && b.workers < BUILDINGS[k].jobs)) return false;
    return !PER[k] || count(k) * PER[k] < g.homes().length;
  };
  function keeper() {
    if (purseGoal && popGoal && g.pop >= popGoal.n) return;
    let res = 0, fed = 0;
    for (const h of g.homes()) if (h.pop) { res += h.pop; if (FOODS.some((k) => h.store[k])) fed += h.pop; }
    const idle = g.workforce ? g.unemployed / g.workforce : 0;
    const shelf = [...g.buildings.values()].filter((b) => b.kind === 'market').reduce((n, b) => n + FOODS.reduce((m, k) => m + (b.store[k] ?? 0), 0), 0);
    if (res && fed / res < 0.95 && FOODS.reduce((n, k) => n + g.stock(k), 0) + shelf < 40) {
      const kinds = ['berry', 'hayFarm', 'oatFarm'].filter(open);
      plan.push([kinds[foodTurn++ % kinds.length]]);
      return;
    }
    // the need most homes are stuck on, if the level it opens can be reached here and the keeper hasn't just seen to it;
    // with idle paws, only a fix that brings jobs
    const tally = {};
    let fixed = 0;
    for (const h of g.homes()) if (h.pop && g.homeTarget(h) <= h.level) { const n = g.nextNeed(h); tally[n] = (tally[n] ?? 0) + 1; }
    for (const [need] of Object.entries(tally).sort((a, b) => b[1] - a[1])) {
      const steps = fix(need), lv = LEVEL_OF[need];
      if (!steps || !(REACH[lv] ?? []).every(open) || !steps.every(([k]) => k === 'gardens' || open(k)) || (last[need] ?? -1e9) > g.tick - MONTH * 2) continue;
      if (idle > 0.2 && !works && !steps.some(([k]) => k !== 'gardens' && BUILDINGS[k].jobs)) continue;
      if (works && steps.some(([k]) => !enough(k) || (full[k] ?? -1e9) > g.tick - MONTH * 6)) continue;
      last[need] = g.tick; plan.push(...steps);
      // with zones, up to three needs seen to a month
      if (!works || ++fixed >= 3) return;
    }
    if (fixed) return;
    if (idle > 0.2) {
      const jobs = ['market', 'berry', 'storehouse', 'woodcutter', 'granary', 'fireWatch', 'sandPit', 'dustMill', 'herb'].filter(open);
      plan.push([jobs[jobTurn++ % jobs.length]]);
    } else if (free() < 8) plan.push(['homes', g.homes().length + 4]);
  }
  while (g.tick < (years || g.meadow.years) * YEAR && g.won === null) {
    for (let k = 0; k < 30; k++) g.step();
    for (const e of g.drain()) {
      seen[e.kind] = (seen[e.kind] ?? 0) + 1;
      if (e.kind === 'rubble') rebuild.push([e.x, e.y]);
    }
    // sweep puddles, clear rubble and build the same thing again
    for (let i = 0; i < N * N; i++) if (g.road[i] === 2) g.clear(i % N, (i / N) | 0);
    while (rebuild.length) {
      const [x, y] = rebuild.shift(), b = g.buildingAt(x, y);
      if (!b || b.kind !== 'rubble') continue;
      const was = b.was; g.clear(x, y);
      if (was === 'home') g.build('home', x, y); else plan.unshift([was]);
    }
    // with zones, a garden in every home block as soon as it has a few homes
    if (works && g.tick % MONTH < 30 && g.purse > 100) gardens();
    // a street the fire watchers miss gets one of its own
    if (g.meadow.fire && g.tick % MONTH < 30 && (last.fire ?? -1e9) < g.tick - MONTH && plan[0]?.[0] !== 'fireWatch'
      && [...g.buildings.values()].some((b) => b.risk > 75 && BUILDINGS[b.kind].risk)
      && (!works || enough('fireWatch'))) { last.fire = g.tick; plan.unshift(['fireWatch']); }
    // with zones, more food as soon as the town eats more than it grows: the kind it grows least of
    if (works && !plan.some((st) => st.opening) && g.tick % MONTH < 30 && (last.grow ?? -1e9) < g.tick - MONTH) {
      const all = FOODS.reduce((n, k) => n + grows(k), 0);
      const made = FOODS.map((k) => [k, grows(k)]).filter(([k]) => open(FOOD_OF[k]) && !noRoom.has(FOOD_OF[k]) && g.stock(k) < 60).sort((a, b) => a[1] - b[1]);
      if (made.length && all < eats() * 1.2 + count('weaver') * 6) { last.grow = g.tick; plan.unshift([FOOD_OF[made[0][0]]]); }
    }
    // with zones, too much of a food or ware lets its furthest maker go, and a farm of a food in surplus makes way for
    // the food that is short
    if (works && g.tick % MONTH < 30) {
      const furthest = (k) => [...g.buildings.values()].filter((b) => b.kind === k).sort((a, b) => dist(b.x, b.y) - dist(a.x, a.y) || b.id - a.id)[0];
      for (const [good, k] of [['berries', 'berry'], ['pottery', 'potter'], ['toys', 'toymaker'], ['bedding', 'weaver'], ['dust', 'dustMill']]) {
        const b = g.stock(good) > (good === 'berries' ? 200 : 120) && count(k) > 1 && furthest(k);
        if (b) g.clear(b.x, b.y);
      }
      for (const [rich, poor] of [['hay', 'oats'], ['oats', 'hay']]) {
        const b = g.stock(rich) > 250 && g.stock(poor) < 30 && furthest(FOOD_OF[rich]);
        if (b && plan[0]?.[0] !== FOOD_OF[poor]) { g.clear(b.x, b.y); noRoom.delete(FOOD_OF[poor]); plan.unshift([FOOD_OF[poor]]); }
      }
    }
    // a granary beside farms whose carts have far to go
    if (works && !plan.some((st) => st.opening) && g.tick % MONTH < 30 && (last.granary ?? -1e9) < g.tick - MONTH * 2 && plan[0]?.[0] !== 'granary' && count('granary') < 2 + (count('hayFarm') + count('oatFarm')) / 3 && fullest()) { last.granary = g.tick; plan.unshift(['granary']); }
    while (plan.length && doStep(plan[0])) plan.shift();
    if (!plan.length && g.tick % MONTH < 30) keeper();
    if (log && g.tick % YEAR < 30) console.log(`  ${id} year ${g.year - 1}: ${g.pop} chinchillas, ${g.homes().length} homes, levels ${[1, 2, 3, 4, 5, 6, 7].map((l) => g.homesAtLeast(l)).join('/')}, cosiness ${g.cosiness}, purse ${g.purse}, jobs ${g.employed}/${g.workforce}/${g.jobs}, food ${FOODS.map((k) => g.stock(k)).join('/')}, target ${g.cosyTarget()}, next ${JSON.stringify(plan[0])}`);
    if (log === 2 && g.tick % (MONTH * 3) < 30) { const t = {}; for (const h of g.homes()) if (h.pop) { const n = g.nextNeed(h) || 'top'; t[n] = (t[n] ?? 0) + 1; } console.log(`    ${(g.tick / YEAR).toFixed(2)} pop ${g.pop} purse ${g.purse} idle ${g.unemployed} wares ${['pottery', 'toys', 'bedding', 'dust', 'clay', 'wood', 'hay'].map((k) => k + ':' + have(k)).join(' ')} needs ${JSON.stringify(t)}`); }
  }
  return { g, seen, ob, met: g.goalsMet.map((t) => (t === null ? null : t / YEAR)), won: g.won === null ? null : g.won / YEAR };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const only = process.argv.slice(2).filter((a) => !a.startsWith('--')), log = process.argv.includes('--log') ? (process.argv.includes('--needs') ? 2 : 1) : false;
  for (const id of Object.keys(PLANS).filter((m) => !only.length || only.includes(m))) {
    const t0 = performance.now(), { g, met, won, seen } = play(id, { log });
    const labels = g.goalStatus().map((s) => s.label);
    console.log(`${g.meadow.name.padEnd(15)} ${labels.map((l, i) => `${l} in year ${met[i] === null ? '-' : met[i].toFixed(1)}`).join(', ')}; won ${won === null ? 'never' : `in year ${won.toFixed(1)}`} (${g.stars} stars, target ${g.meadow.years} years); ${g.pop} chinchillas, cosiness ${g.cosiness}, purse ${g.purse} (${Math.round(performance.now() - t0)} ms)`);
    if (log) console.log('  events', JSON.stringify(seen));
    assert.ok(won !== null, `${id}: the bot never finished`);
    // fair: not a walkover in the first months, and done within the two-star years
    assert.ok(won >= 0.5, `${id}: finished too quickly (${won.toFixed(2)} years)`);
    assert.ok(won <= g.meadow.years, `${id}: took ${won.toFixed(1)} years, more than ${g.meadow.years}`);
  }
  console.log('Pawhaven bot: every meadow it plays can be finished.');
}
