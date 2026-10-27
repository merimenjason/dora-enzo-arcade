// Pawhaven bot: a scripted builder plays the early meadows from a fixed build plan per meadow and checks each one can
// reach its goals in a fair number of years. The plan says what to build and in what order; a small placer finds the
// spot: streets on a grid every four tiles from the way-in road, buildings in the blocks between them, and helpers next
// to the homes that are missing them. Run with a meadow id to play just that one, and --log for a yearly line.
import assert from 'node:assert/strict';
import { PawhavenGame, BUILDINGS, YEAR, MONTH, FOODS } from '../.checks/pawhaven-game.js';

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
};

export function play(id, { years = 12, log = false } = {}) {
  const g = new PawhavenGame({ meadow: id }), N = g.size, ey = g.entry / N | 0, cx = N >> 1;
  const plan = PLANS[id].map((s) => [...s]);
  const onGrid = (x, y) => mod(y - ey, 4) === 0 || mod(x - cx, 4) === 0;
  const fromEntry = () => g.field('e', [g.entry]);
  const dist = (x, y) => Math.max(Math.abs(x - cx), Math.abs(y - ey));
  let streetR = 0;

  const builtRoad = (x, y) => g.inside(x, y) && g.walkable(y * N + x);
  const touchesRoad = (x, y, s) => { for (let i = -1; i <= s; i++) for (let j = -1; j <= s; j++) { if ((i === -1 || i === s) === (j === -1 || j === s)) continue; if (builtRoad(x + i, y + j)) return true; } return false; };
  const fitsGrid = (x, y, s) => { for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) if (onGrid(x + i, y + j)) return false; return true; };
  // join a building to the roads that reach the way in, along the cheapest free tiles
  function connect(b) {
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
        if (g.occ[n] || g.road[n] || g.fence[n] || ter === 2 || ter === 3 || ter === 4) continue;
        prev[n] = c; q.push(n);
      }
    }
    return false;
  }
  // where a helper is wanted: next to the first home (nearest the middle) that hasn't seen one lately
  const svcOf = { well: 'water', tower: 'water', bathhouse: 'dust', herb: 'healer', story: 'story', music: 'music' };
  function anchor(kind) {
    const homes = g.homes().filter((h) => g.hasAccess(h)).sort((a, b) => dist(a.x, a.y) - dist(b.x, b.y) || a.id - b.id);
    const svc = svcOf[kind];
    let h;
    if (svc) h = homes.find((h) => (h.seen[svc] ?? -1e9) < g.tick - MONTH * 2);
    else if (kind === 'market') h = homes.find((h) => h.pop && !FOODS.some((k) => h.store[k]));
    else if (kind === 'fireWatch') h = [...g.buildings.values()].filter((b) => BUILDINGS[b.kind].risk && b.kind !== 'rubble').sort((a, b) => b.risk - a.risk)[0];
    else if (kind === 'garden') h = [...homes].reverse().find((h) => h.level >= 3);
    return h ? [h.x, h.y] : [cx, ey];
  }
  function place(kind) {
    const s = BUILDINGS[kind], [ax, ay] = anchor(kind), free = !!(s.on !== undefined || s.nearWater || s.nearTrees);
    let best = null, bd = Infinity;
    for (let y = 0; y + s.size <= N; y++) for (let x = 0; x + s.size <= N; x++) {
      const d = Math.hypot(x + s.size / 2 - ax, y + s.size / 2 - ay);
      if (d >= bd) continue;
      if (!free && !fitsGrid(x, y, s.size)) continue;
      if (!free && kind !== 'garden' && !touchesRoad(x, y, s.size)) continue;
      if (!g.canBuild(kind, x, y).ok) continue;
      best = [x, y]; bd = d;
    }
    if (!best) return false;
    const r = g.build(kind, best[0], best[1]);
    if (r.ok && kind !== 'garden') connect(g.buildings.get(r.id));
    return r.ok;
  }
  function streets(r) {
    const todo = [];
    for (let y = ey - r; y <= ey + r; y++) for (let x = cx - r; x <= cx + r; x++) if (g.inside(x, y) && onGrid(x, y) && !g.road[y * N + x]) todo.push([dist(x, y), x, y]);
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
    if (what === 'homes') {
      if (g.homes().length >= a) return true;
      if (free() > 10 || g.purse < 30) return false;
      for (let k = 0; k < 4 && g.homes().length < a; k++) if (!place('home')) { if (!streets(streetR + 2)) return false; }
      return g.homes().length >= a;
    }
    const n = a ?? 1;
    if (g.purse < BUILDINGS[what].cost + 10) return false;
    if (!place(what)) { if (!streets(streetR + 2)) return false; if (!place(what)) return false; }
    st[1] = n - 1;
    return n - 1 <= 0;
  }
  const rebuild = [], seen = {};
  // once the plan is done: food when the town is hungry, jobs when paws are idle, helpers for what homes miss, else homes
  let jobTurn = 0, foodTurn = 0;
  function keeper() {
    let res = 0, fed = 0;
    for (const h of g.homes()) if (h.pop) { res += h.pop; if (FOODS.some((k) => h.store[k])) fed += h.pop; }
    const idle = g.workforce ? g.unemployed / g.workforce : 0, open = (k) => g.open.has(k);
    const stalls = [...g.buildings.values()].filter((b) => b.kind === 'market').reduce((n, b) => n + FOODS.reduce((m, k) => m + (b.store[k] ?? 0), 0), 0);
    if (res && fed / res < 0.95 && FOODS.reduce((n, k) => n + g.stock(k), 0) + stalls < 40) {
      const kinds = ['berry', 'hayFarm', 'oatFarm'].filter(open);
      plan.push([kinds[foodTurn++ % kinds.length]]);
    } else if (idle > 0.2) {
      const jobs = ['market', 'berry', 'storehouse', 'woodcutter', 'granary', 'fireWatch', 'sandPit', 'dustMill', 'herb'].filter(open);
      plan.push([jobs[jobTurn++ % jobs.length]]);
    } else {
      const h = g.homes().find((h) => h.pop && g.homeTarget(h) <= h.level && ['water', 'a dust bath', 'a healer'].includes(g.nextNeed(h)));
      const k = h && { water: 'well', 'a dust bath': 'bathhouse', 'a healer': 'herb' }[g.nextNeed(h)];
      if (k && open(k)) plan.push([k]);
      else if (free() < 8) plan.push(['homes', g.homes().length + 4]);
    }
  }
  while (g.tick < years * YEAR && g.won === null) {
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
    while (plan.length && doStep(plan[0])) plan.shift();
    if (!plan.length && g.tick % MONTH < 30) keeper();
    if (log && g.tick % YEAR < 30) console.log(`  ${id} year ${g.year - 1}: ${g.pop} chinchillas, ${g.homes().length} homes, levels ${[1, 2, 3, 4, 5].map((l) => g.homesAtLeast(l)).join('/')}, cosiness ${g.cosiness}, purse ${g.purse}, jobs ${g.employed}/${g.workforce}/${g.jobs}, food ${FOODS.map((k) => g.stock(k)).join('/')}, target ${g.cosyTarget()}, next ${JSON.stringify(plan[0])}`);
  }
  return { g, seen, met: g.goalsMet.map((t) => (t === null ? null : t / YEAR)), won: g.won === null ? null : g.won / YEAR };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const only = process.argv.slice(2).filter((a) => !a.startsWith('--')), log = process.argv.includes('--log');
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
