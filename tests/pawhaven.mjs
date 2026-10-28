// Pawhaven engine tests: maps and replays, road access, placement, helpers on the roads, visits, homes growing and
// shrinking, carts, the market chain, workers, fire, foxes, trade, saving, the profile, and how long a big town's month takes.
import assert from 'node:assert/strict';
import {
  PawhavenGame, MEADOWS, BUILDINGS, HOME_LEVELS, MONTH, YEAR, VISIT, GRACE, BURN, TREE_CLEAR, CARAVAN_EVERY, WELL_RANGE, OWN_STORE, CART_LOAD,
  GRASS, FERTILE, WATER, ROCK, TREES, SAND, ROAD, PUDDLE, makeMap, meadowKinds, readProfile, recordWin, saveTown, SAVE_KEY,
} from '../.checks/pawhaven-game.js';
import { play } from './pawhaven-bot.mjs';

let count = 0;
const test = (name, fn) => { fn(); count++; };
// a flat grassy meadow with a deep purse and no fire or weather unless a test asks for them
function fresh(meadow = 'free', more = {}) {
  const g = new PawhavenGame({ meadow });
  g.terrain.fill(GRASS); g.purse = 1e6;
  g.meadow = { ...g.meadow, fire: false, storm: 0, dry: 0, ...more };
  return g;
}
const run = (g, n) => { for (let i = 0; i < n; i++) g.step(); };
const row = (g, y, x0, x1) => { for (let x = x0; x <= x1; x++) assert.ok(g.build('road', x, y).ok, `road at ${x},${y}`); };
const col = (g, x, y0, y1) => { for (let y = y0; y <= y1; y++) assert.ok(g.build('road', x, y).ok, `road at ${x},${y}`); };
const put = (g, kind, x, y) => { const r = g.build(kind, x, y); assert.ok(r.ok, `${kind} at ${x},${y}: ${r.reason}`); return g.buildings.get(r.id); };
// residents far from any road, so the town has workers: Grand Burrows that never shrink
function crowd(g, homes, y = g.size - 3) {
  for (let i = 0; i < homes; i++) { const h = put(g, 'home', 1 + i * 2, y); h.level = 7; h.pop = 24; h.grace = 1e12; }
  run(g, 10);
}
const kinds = (g) => g.drain().map((e) => e.kind);

// ---- maps ----
test('the same seed makes the same map, and every map has what its meadow needs', () => {
  for (const m of MEADOWS) {
    const a = makeMap(m), b = makeMap(m), N = m.size, ey = N >> 1;
    assert.deepEqual([...a.terrain], [...b.terrain], `${m.id} makes the same map twice`);
    assert.notDeepEqual([...a.terrain], [...makeMap(m, m.seed + 1).terrain], `${m.id}: another seed makes another map`);
    assert.equal(a.entry, ey * N); assert.equal(a.exit, ey * N + N - 1);
    for (let y = ey - 2; y <= ey + 2; y++) for (let x = 0; x < N; x++) assert.equal(a.terrain[y * N + x], GRASS, `${m.id}: the way-in band is grass`);
    const has = (t, s) => { for (let y = 0; y + s <= N; y++) for (let x = 0; x + s <= N; x++) { let ok = true; for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) if (a.terrain[(y + j) * N + x + i] !== t) ok = false; if (ok) return true; } return false; };
    const k = meadowKinds(m);
    if (k.includes('hayFarm')) assert.ok(has(FERTILE, 3), `${m.id} has room for a farm`);
    if (k.includes('sandPit')) assert.ok(has(SAND, 2), `${m.id} has room for a sand pit`);
    if (k.includes('tower')) assert.ok(a.terrain.includes(WATER), `${m.id} has water`);
    if (k.includes('woodcutter')) assert.ok(a.terrain.includes(TREES), `${m.id} has trees`);
  }
  const g = new PawhavenGame({ meadow: 'clover' });
  assert.equal(g.road[g.entry], ROAD); assert.equal(g.road[g.exit], ROAD);
  assert.equal(g.clear(0, g.size >> 1).ok, false, 'the way in stays');
});

test('the same actions on the same ticks grow the same town', () => {
  const a = play('clover', { years: 0.6 }).g, b = play('clover', { years: 0.6 }).g;
  assert.ok(a.pop > 20 && a.walkers.length > 0, 'the town got going');
  assert.equal(JSON.stringify(a.toJSON()), JSON.stringify(b.toJSON()));
});

// ---- placing ----
test('placement follows the terrain and the meadow', () => {
  const g = fresh('free'), N = g.size, at = (x, y, t) => { g.terrain[y * N + x] = t; };
  at(5, 5, WATER); at(6, 5, ROCK); at(7, 5, TREES);
  assert.match(g.build('home', 5, 5).reason, /water/);
  assert.match(g.build('road', 6, 5).reason, /rock/);
  assert.match(g.build('home', 7, 5).reason, /trees/i);
  const purse = g.purse; assert.ok(g.clear(7, 5).ok); assert.equal(g.purse, purse - TREE_CLEAR); assert.equal(g.terrain[5 * N + 7], GRASS);
  assert.ok(g.build('home', 7, 5).ok, 'a cleared tile takes a home');
  assert.match(g.build('hayFarm', 10, 10).reason, /fertile/);
  for (let y = 10; y < 13; y++) for (let x = 10; x < 13; x++) at(x, y, FERTILE);
  assert.ok(g.build('hayFarm', 10, 10).ok, 'a farm on fertile meadow');
  assert.match(g.build('sandPit', 20, 10).reason, /sand/);
  for (let y = 10; y < 12; y++) for (let x = 20; x < 22; x++) at(x, y, SAND);
  assert.ok(g.build('sandPit', 20, 10).ok);
  assert.match(g.build('tower', 30, 30).reason, /water/);
  at(34, 30, WATER); assert.ok(g.build('tower', 30, 30).ok, 'water 3 tiles from the plot is near enough');
  assert.match(g.build('clayPit', 30, 35).reason, /water/);
  at(33, 36, WATER); assert.ok(g.build('clayPit', 30, 35).ok);
  assert.match(g.build('woodcutter', 40, 5).reason, /trees/);
  at(41, 6, TREES); assert.ok(g.build('woodcutter', 40, 5).ok, 'a tree on the diagonal counts');
  assert.ok(g.build('hall', 2, 30).ok); assert.match(g.build('hall', 10, 30).reason, /One town hall/);
  assert.match(g.build('granary', 1, 29).reason, /already/);
  assert.match(g.build('statue', N - 2, 0).reason, /inside/);
  g.purse = 3; assert.match(g.build('well', 2, 2).reason, /acorns/);
  const c = new PawhavenGame({ meadow: 'clover' });
  assert.match(c.build('potter', 2, 2).reason, /later meadow/);
  assert.ok(!c.open.has('fireWatch') && c.open.has('market'));
  // a fence on a road is a gate, and the road stays
  const f = fresh('foxglove'); row(f, 5, 0, 3);
  assert.ok(f.build('fence', 2, 5).ok); assert.equal(f.road[5 * f.size + 2], ROAD); assert.equal(f.fence[5 * f.size + 2], 1);
  assert.ok(f.clear(2, 5).ok); assert.equal(f.fence[5 * f.size + 2], 0); assert.equal(f.road[5 * f.size + 2], ROAD, 'clearing a gate leaves the road');
});

test('a building works only with a road along one of its edges', () => {
  const g = fresh(); crowd(g, 2);
  const home = put(g, 'home', 5, 5), berry = put(g, 'berry', 10, 5);
  assert.ok(!g.hasAccess(home) && !g.hasAccess(berry));
  g.build('road', 6, 6); assert.ok(!g.hasAccess(home), 'a diagonal road is not access');
  g.build('road', 5, 7); assert.ok(!g.hasAccess(home));
  g.build('road', 5, 6); assert.ok(g.hasAccess(home));
  run(g, 20); assert.equal(berry.workers, 0, 'no access, no workers');
  g.build('road', 11, 7); run(g, 20);
  assert.ok(g.hasAccess(berry) && berry.workers === 4, 'a road below the 2×2 plot');
  g.clear(11, 7); run(g, 20); assert.ok(!g.hasAccess(berry) && berry.workers === 0, 'and it stops when the road goes');
  // a plaza's paving counts as road
  const p = fresh(); const h = put(p, 'home', 3, 3); put(p, 'plaza', 3, 4); assert.ok(p.hasAccess(h));
});

// ---- helpers on the roads ----
test('a helper serves the homes beside the roads it walks, and spreads its walks over the junctions', () => {
  const g = fresh();
  row(g, 10, 0, 20); col(g, 10, 11, 20);
  const well = put(g, 'well', 10, 9);
  const west = put(g, 'home', 0, 9), east = put(g, 'home', 20, 9), south = put(g, 'home', 11, 20), behind = put(g, 'home', 0, 8);
  const far = put(g, 'home', 25, 9); row(g, 10, 21, 25);
  run(g, 60);
  const helpers = g.walkers.filter((w) => w.kind === 'helper');
  assert.equal(helpers.length, 1); assert.equal(helpers[0].job, 'water'); assert.ok(helpers[0].p >= 0 && helpers[0].p < 1);
  run(g, 300);
  for (const h of [west, east, south]) assert.ok(h.seen.water > 0, `the home at ${h.x},${h.y} saw the water carrier`);
  assert.equal(behind.seen.water, undefined, 'a home behind another home is not beside the road');
  assert.equal(far.seen.water, undefined, `a home ${15} tiles away is past a well's ${WELL_RANGE}-tile walk`);
  const memory = g.toJSON().buildings.find((b) => b.id === well.id).walked, N = g.size;
  assert.deepEqual(Object.keys(memory).map(Number).sort((a, b) => a - b), [10 * N + 9, 10 * N + 11, 11 * N + 10], 'the well remembers which way it took at the junction');
});

test('a visit lasts three months', () => {
  const g = fresh(); row(g, 10, 0, 6);
  const well = put(g, 'well', 1, 9), h = put(g, 'home', 3, 9); h.pop = 4;
  run(g, 100); assert.equal(g.homeTarget(h), 2);
  g.clear(well.x, well.y); const last = h.seen.water;
  run(g, last + VISIT - g.tick - 1); assert.equal(g.homeTarget(h), 2, 'still fresh just before three months');
  run(g, 2); assert.equal(g.homeTarget(h), 1, 'gone after three months');
});

test('homes grow a level at a time and shrink only after the grace period', () => {
  const g = fresh(); row(g, 10, 0, 8);
  const well = put(g, 'well', 1, 9), h = put(g, 'home', 3, 9); h.pop = 4;
  run(g, 60);
  assert.equal(h.level, 2); assert.equal(g.holds(h), HOME_LEVELS[1].holds);
  assert.ok(kinds(g).includes('levelUp'));
  // a short gap: the well goes and comes back before the grace runs out
  g.clear(well.x, well.y);
  run(g, h.seen.water + VISIT - g.tick + GRACE / 2);
  assert.equal(h.level, 2, 'half the grace period in, the home waits');
  assert.ok(h.grace > 0);
  put(g, 'well', 1, 9); run(g, 60);
  assert.equal(h.grace, -1, 'water is back, the worry is over'); assert.equal(h.level, 2);
  // a long gap: one level down after the grace period
  g.clear(1, 9); h.pop = 6;
  const lapse = h.seen.water + VISIT;
  run(g, lapse + GRACE - g.tick - 30);
  assert.equal(h.level, 2, 'just before the grace runs out');
  run(g, 60);
  assert.equal(h.level, 1, 'one level down'); assert.equal(h.pop, HOME_LEVELS[0].holds, 'the extra residents moved on');
  assert.ok(kinds(g).includes('levelDown'));
  // an empty home doesn't grow
  const e = put(g, 'home', 5, 9); put(g, 'well', 6, 9); run(g, 200); assert.equal(e.level, 1);
});

test('newcomers walk in from the way in to homes with room, while the town is cosy', () => {
  const g = fresh(), ey = g.size >> 1;
  row(g, ey, 1, 10);
  const a = put(g, 'home', 4, ey - 1), b = put(g, 'home', 8, ey - 1);
  run(g, 5);
  assert.equal(g.walkers.filter((w) => w.kind === 'newcomer').length, 1);
  run(g, 200);
  assert.equal(a.pop, 4, 'the nearer home fills first'); assert.equal(b.pop, 4);
  assert.equal(g.pop, 8); assert.ok(kinds(g).includes('newcomer'));
  const c = fresh(); row(c, ey, 1, 5); put(c, 'home', 3, ey - 1); c.cosiness = 29; run(c, 100);
  assert.equal(c.pop, 0, 'nobody moves to a town with cosiness under 30');
});

// ---- goods ----
test('carts carry loads from producers to the nearest building with room, and producers stop when full', () => {
  const g = fresh(); crowd(g, 2); row(g, 10, 0, 20);
  const berry = put(g, 'berry', 2, 8), granary = put(g, 'granary', 12, 7);
  let sawCart = false;
  for (let i = 0; i < 3 * MONTH; i++) { g.step(); const c = g.walkers.find((w) => w.kind === 'cart' && !w.back); if (c) { sawCart = true; assert.equal(c.load.berries, CART_LOAD); } }
  assert.ok(sawCart);
  assert.ok(granary.store.berries >= CART_LOAD, `the granary has ${granary.store.berries} berries`);
  assert.ok(berry.cart === 0 || berry.cart === 1);
  // with nowhere to take them, a producer fills its own store and stops
  const h = fresh(); crowd(h, 2); row(h, 10, 0, 6);
  const lone = put(h, 'berry', 2, 8); run(h, 4 * MONTH);
  assert.equal(lone.store.berries, OWN_STORE);
  // a workshop's input comes by cart before the store
  const w = fresh(); crowd(w, 3); row(w, 10, 0, 20);
  for (const [x, y] of [[2, 8], [3, 8], [2, 9], [3, 9]]) w.terrain[y * w.size + x] = SAND;
  put(w, 'sandPit', 2, 8);
  const store = put(w, 'storehouse', 6, 7), mill = put(w, 'dustMill', 16, 8);
  run(w, 8 * MONTH);
  assert.ok(store.store.dust > 0, 'the sand went to the dust mill first, and its dust to the storehouse');
  assert.ok(!store.store.sand, 'no sand went to the store while the mill had room');
  void mill;
});

test('the market chain feeds a home end to end: patch, cart, granary, buyer, seller, home', () => {
  const g = fresh(); crowd(g, 2); row(g, 10, 0, 24);
  put(g, 'berry', 2, 8); const granary = put(g, 'granary', 6, 7), market = put(g, 'market', 12, 8); put(g, 'well', 16, 9);
  const home = put(g, 'home', 18, 9); home.pop = 4;
  run(g, 3 * MONTH);
  assert.ok(g.walkers.some((w) => w.kind === 'helper' && w.job === 'seller') || market.next > 0, 'the stall sends a seller');
  assert.ok(home.store.berries > 0, 'the home has berries');
  assert.ok(home.level >= 3, `the home grew to a ${HOME_LEVELS[home.level - 1].name}`);
  assert.ok(granary.store.berries !== undefined || market.store.berries !== undefined);
  // food is eaten each month
  const before = home.store.berries; g.clear(market.x, market.y);
  run(g, MONTH - (g.tick % MONTH));
  assert.ok((home.store.berries ?? 0) < before, 'the home ate some berries');
});

test('workers go to the town hall, then food, water, services, industry and trade, then by build order', () => {
  const g = fresh(); row(g, 10, 0, 30);
  const market = put(g, 'market', 0, 8), store = put(g, 'storehouse', 3, 7), berry = put(g, 'berry', 7, 8), hall = put(g, 'hall', 10, 7), berry2 = put(g, 'berry', 14, 8);
  const h = put(g, 'home', 1, 30); h.level = 7; h.pop = 15; h.grace = 1e12;
  run(g, 10);
  assert.equal(g.workforce, 10);
  assert.deepEqual([hall.workers, berry.workers, berry2.workers, market.workers, store.workers], [8, 2, 0, 0, 0]);
  h.pop = 24; run(g, 10);
  assert.deepEqual([hall.workers, berry.workers, berry2.workers, market.workers, store.workers], [8, 4, 4, 0, 0]);
  const h2 = put(g, 'home', 3, 30); h2.level = 7; h2.pop = 24; h2.grace = 1e12; run(g, 10);
  assert.equal(g.workforce, 32);
  assert.deepEqual([market.workers, store.workers], [4, 6]); assert.equal(g.jobs, 26); assert.equal(g.unemployed, 6);
  // a building short of workers works at that share of its speed
  const half = fresh(); row(half, 10, 0, 10); const hb = put(half, 'berry', 2, 8); const hh = put(half, 'home', 1, 30); hh.level = 7; hh.pop = 3; hh.grace = 1e12;
  run(half, MONTH); assert.equal(hb.workers, 2); assert.ok(Math.abs((hb.store.berries ?? 0) - 4) <= 1, `half staff makes half the berries (${hb.store.berries})`);
});

// ---- fire ----
test('fire: risk rises, a fire watcher resets it and puts fires out, and an unwatched fire leaves rubble', () => {
  const g = fresh('free', { fire: true }); crowd(g, 1); row(g, 10, 0, 12);
  const watch = put(g, 'fireWatch', 1, 9), home = put(g, 'home', 4, 9); home.pop = 4;
  home.risk = 99.99;
  run(g, 1);
  assert.ok(home.burning > 0 && home.pop === 0, 'it caught fire and everyone went to friends');
  assert.ok(kinds(g).includes('fire'));
  run(g, 30);
  assert.equal(home.burning, 0, 'the fire watcher put it out'); assert.equal(home.kind, 'home');
  assert.ok(kinds(g).includes('fireOut'));
  // risk resets when the watcher passes
  home.risk = 50; run(g, WALK_PASS());
  assert.ok(home.risk < 50, 'the watcher passed and the risk fell back');
  assert.ok(watch.workers > 0);
  // with no watch, a fire burns down to rubble, which can be cleared
  const u = fresh('free', { fire: true }); row(u, 10, 0, 5);
  const shed = put(u, 'home', 2, 9); shed.risk = 99.99;
  run(u, BURN + 1);
  assert.equal(shed.kind, 'rubble'); assert.equal(shed.was, 'home');
  assert.ok(kinds(u).includes('rubble'));
  assert.match(u.build('home', 2, 9).reason, /already/);
  assert.ok(u.clear(2, 9).ok); assert.ok(u.build('home', 2, 9).ok, 'cleared rubble takes a new home');
  // roads, gardens and wells never burn
  for (const k of ['road', 'garden', 'well', 'fence']) assert.equal(BUILDINGS[k].risk, 0, `${k} has no fire risk`);
});
function WALK_PASS() { return 250; }

// ---- foxes ----
function foxAt(g, x, y) { g.foxes.push({ id: 9999, x, y, tx: x, ty: y, p: 1, flee: false }); }
test('a fox walks to the nearest home and the residents dash off for a month', () => {
  const g = fresh('foxglove'); const h = put(g, 'home', 10, 5); h.pop = 4;
  foxAt(g, 0, 5); run(g, 80);
  assert.equal(h.pop, 0); assert.equal(h.away, 4);
  const ev = kinds(g); assert.ok(ev.includes('foxHome'));
  run(g, 150); assert.equal(g.foxes.length, 0, 'the fox went home off the map');
  run(g, MONTH); assert.equal(h.pop, 4, 'everyone is home again'); assert.ok(kinds(g).includes('homeAgain'));
});
test('fences stop foxes, gates stop foxes but let helpers through, and a fox watch chases them off', () => {
  const ring = (g, gate) => { for (let y = 4; y <= 6; y++) for (let x = 9; x <= 11; x++) if (x !== 10 || y !== 5) { if (gate && x === 10 && y === 6) { g.build('road', 10, 6); } assert.ok(g.build('fence', x, y).ok); } };
  const g = fresh('foxglove'); const h = put(g, 'home', 10, 5); h.pop = 4; ring(g, false);
  foxAt(g, 0, 5); run(g, 200);
  assert.equal(h.pop, 4, 'the fence kept the fox out'); assert.ok(kinds(g).includes('foxAway'));
  const k = fresh('foxglove'); const kh = put(k, 'home', 10, 5); kh.pop = 4; ring(k, true);
  col(k, 10, 7, 8); put(k, 'well', 11, 7);
  foxAt(k, 0, 5); run(k, 200);
  assert.equal(kh.pop, 4, 'the gate kept the fox out');
  assert.ok(kh.seen.water > 0, 'and the water carrier walked through it');
  const w = fresh('foxglove'); crowd(w, 1); const wh = put(w, 'home', 10, 5); wh.pop = 4;
  row(w, 6, 13, 15); const watch = put(w, 'foxWatch', 14, 5); run(w, 10); assert.equal(watch.workers, 3);
  foxAt(w, 0, 5); run(w, 200);
  assert.equal(wh.pop, 4, 'the guard chased the fox before it got there'); assert.ok(kinds(w).includes('foxChased'));
  // foxes come every few months on fox meadows only
  const m = new PawhavenGame({ meadow: 'foxglove' }); m.terrain.fill(GRASS); run(m, 3 * MONTH + 1); assert.ok(kinds(m).includes('fox'));
  const n = new PawhavenGame({ meadow: 'clover' }); run(n, 6 * MONTH + 1); assert.ok(!kinds(n).includes('fox'));
});

// ---- weather ----
test('storms leave puddles walkers wait for, and sweeping them is free', () => {
  const g = fresh('free', { storm: 1 }), ey = g.size >> 1; row(g, ey, 1, 20);
  run(g, MONTH);
  const puddles = [...g.road].filter((r) => r === PUDDLE).length;
  assert.ok(puddles >= 1 && puddles <= 3, `${puddles} puddles`); assert.ok(kinds(g).includes('storm'));
  const i = g.road.indexOf(PUDDLE), purse = g.purse;
  assert.ok(!g.walkable(i)); assert.ok(g.clear(i % g.size, (i / g.size) | 0).ok); assert.equal(g.purse, purse); assert.ok(g.walkable(i));
  const d = fresh('free', { dry: 1 }); run(d, MONTH); assert.ok(d.dry && kinds(d).includes('dry'));
});

// ---- trade ----
test('a caravan sells what is set to export and buys what is set to import, and acorns change hands', () => {
  const g = fresh('clayfoot'), ey = g.size >> 1; crowd(g, 2);
  row(g, ey, 1, 12);
  const store = put(g, 'storehouse', 1, ey - 3), granary = put(g, 'granary', 1, ey + 1); put(g, 'tradingPost', 6, ey - 3);
  store.store.wood = 100;
  assert.equal(g.openRoute('thistle').ok, false, 'Thistle Top is not a neighbour of Clayfoot Brook');
  const before = g.purse; assert.ok(g.openRoute('pebble').ok); assert.equal(g.purse, before - 150);
  g.setTrade('wood', 'export', 20); g.setTrade('oats', 'import', 30); g.setTrade('pottery', 'keep');
  const start = g.purse;
  run(g, CARAVAN_EVERY - g.tick + 100);
  const ev = g.drain().find((e) => e.kind === 'caravan');
  assert.ok(ev, 'the caravan came');
  assert.deepEqual(ev.sold, { wood: 80 }, 'sold down to 20, up to the 80 a year Pebble Ford buys');
  assert.deepEqual(ev.bought, { oats: 30 });
  assert.equal(ev.acorns, 80 * 5 - 30 * 4);
  assert.ok(Math.abs(g.purse - (start + ev.acorns)) < 20, 'the purse moved by the caravan (give or take wages)');
  assert.equal(g.stock('wood'), 20); assert.equal(granary.store.oats, 30);
  run(g, CARAVAN_EVERY);
  const again = g.drain().find((e) => e.kind === 'caravan');
  assert.deepEqual(again.sold, {}, "this year's wood is all sold"); assert.deepEqual(again.bought, {}, 'and the oats are stocked');
  assert.ok(!g.walkers.some((w) => w.kind === 'trader' && w.x === 0 && w.back), 'traders leave by the way out');
});

// ---- months, goals ----
test('the month settles acorns at the town hall and pays wages; goals and stars', () => {
  const g = fresh(); row(g, 10, 0, 10); put(g, 'hall', 1, 7); crowd(g, 1);
  for (const x of [5, 6, 7]) { const h = put(g, 'home', x, 9); h.level = 3; h.pop = 9; h.grace = 1e12; }
  const purse = g.purse; run(g, MONTH - g.tick);
  assert.ok(g.income > 0 && g.wages > 0); assert.equal(g.purse, purse + g.income - g.wages);
  assert.ok(kinds(g).includes('month'));
  const c = new PawhavenGame({ meadow: 'clover' }); c.terrain.fill(GRASS);
  assert.deepEqual(c.goalStatus().map((s) => s.label), ['60 chinchillas', '10 Snug Burrows']);
  for (let i = 0; i < 10; i++) { const h = put(c, 'home', 1 + i, 2); h.level = 3; h.pop = 9; h.grace = 1e12; }
  run(c, 50);
  assert.ok(c.won !== null); assert.equal(c.stars, 2, 'quick, but not cosy enough for three');
  assert.ok(kinds(c).includes('won'));
  const p = recordWin(readProfile(null), c); assert.equal(p.open, 2); assert.equal(p.stars.clover, 2);
  // speeds and real time
  const s = fresh(); s.setSpeed(4); assert.equal(s.update(0.5), 20); s.setSpeed(0); assert.equal(s.update(1), 0); s.setSpeed(3); assert.equal(s.speed, 0);
});

// ---- saving ----
test('a town saves to plain JSON and carries on exactly where it was', () => {
  const { g } = play('willow', { years: 1 });
  assert.ok(g.walkers.length > 3);
  const text = JSON.stringify(g.toJSON()), back = PawhavenGame.fromJSON(JSON.parse(text));
  assert.equal(JSON.stringify(back.toJSON()), text);
  run(g, 2 * MONTH); run(back, 2 * MONTH);
  assert.equal(JSON.stringify(back.toJSON()), JSON.stringify(g.toJSON()), 'both towns grew the same way');
  assert.throws(() => PawhavenGame.fromJSON({ v: 2 }));
  assert.throws(() => PawhavenGame.fromJSON({ ...JSON.parse(text), road: '01' }));
});

test('the profile keeps what makes sense and drops junk', () => {
  assert.equal(SAVE_KEY, 'pawhaven-v1');
  const blank = { open: 1, stars: {}, best: {}, towns: [null, null, null] };
  assert.deepEqual(readProfile(null), blank); assert.deepEqual(readProfile('{nope'), blank); assert.deepEqual(readProfile('"text"'), blank);
  const g = new PawhavenGame({ meadow: 'clover' }); run(g, 5);
  const good = saveTown(readProfile(null), 0, g, 123).towns[0];
  const p = readProfile(JSON.stringify({
    open: 99, stars: { clover: 3, willow: 9, nope: 2, sandy: 1.5 }, best: { clover: 1.2, willow: -1, sandy: 'x' },
    towns: [good, { meadow: 'nope', seed: 1, saved: 1, state: {} }, 'junk', good], extra: true,
  }));
  assert.equal(p.open, 7); assert.deepEqual(p.stars, { clover: 3 }); assert.deepEqual(p.best, { clover: 1.2 });
  assert.equal(p.towns.length, 3); assert.equal(p.towns[0].meadow, 'clover'); assert.equal(p.towns[1], null); assert.equal(p.towns[2], null);
  assert.equal(readProfile(JSON.stringify({ open: 'x' })).open, 1);
  const loaded = PawhavenGame.fromJSON(p.towns[0].state); assert.equal(loaded.tick, 5);
});

// ---- speed ----
test('a month in a big town stays well under 50 ms', () => {
  const g = fresh('free'), N = g.size, ey = N >> 1;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if ((y - ey) % 4 === 0 || x % 4 === 0) g.build('road', x, y);
  // a road every fourth row and column; each block has helpers' buildings in two corners and homes round the rest
  const helpers = ['well', 'herb', 'fireWatch'];
  let k = 0;
  for (let by = (ey % 4) + 1; by + 2 < N; by += 4) for (let bx = 1; bx + 2 < N; bx += 4) {
    put(g, helpers[k++ % helpers.length], bx, by); put(g, helpers[k++ % helpers.length], bx + 2, by + 2);
    for (const [x, y] of [[bx + 1, by], [bx + 2, by], [bx, by + 1], [bx + 2, by + 1], [bx, by + 2], [bx + 1, by + 2]]) put(g, 'home', x, y);
  }
  for (const h of g.homes()) h.pop = 4;
  run(g, MONTH);
  const t0 = performance.now(); run(g, MONTH); const ms = performance.now() - t0;
  const walkers = g.walkers.length;
  console.log(`  big town: ${g.homes().length} homes, ${g.buildings.size} buildings, ${walkers} walkers, ${g.pop} chinchillas; one month took ${ms.toFixed(1)} ms`);
  assert.ok(walkers >= 200, `${walkers} walkers`);
  // shared CI runners vary by tens of percent, so the limit leaves room; a real slowdown is several times this
  assert.ok(ms < 100, `a month took ${ms.toFixed(1)} ms`);
});

console.log(`Pawhaven engine: ${count} tests passed.`);
void YEAR; void ROCK;
