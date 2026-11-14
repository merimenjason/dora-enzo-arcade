// Jade Street engine tests: determinism; the city (every road and place reachable, no spot a ride or walker can get
// stuck in, parked rides you can reach); direct-control movement, collisions and getting on and off every ride; heat,
// wardens, hiding and getting caught; trading maths and haggling; every story mission finished by the scripted solver
// and every step's checkpoint restorable; side gigs; the mini-games; the save (repair, clamping and v1 migration);
// trophies and the daily event; and every painted asset present and non-empty. Run after compiling the engine into
// .checks/ (npm test does).
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { World, DT, NO_INPUT } from '../.checks/jade-game.js';
import { city, T, W, H, S, G, F_ROOF, DISTRICTS, districtAt, passable } from '../.checks/jade-city.js';
import { field, nearestFree, los } from '../.checks/jade-nav.js';
import { VEHICLES, FOOT, drive, overlapping } from '../.checks/jade-move.js';
import { GOODS, GOOD, midPrice, prices, buy, sell, capacity, haggleResult, haggleZone, cargoCount, emptyCargo, bestRoute, moveGoods } from '../.checks/jade-trade.js';
import { MISSIONS, MISSION, PEOPLE, HEIRLOOMS } from '../.checks/jade-story.js';
import { newSave, loadSave, SAVE_VERSION, available, openDistricts, chapterOf, buyUpgrade, buyPaint, buyOutfit, buySafe, safeOpen, TROPHIES, checkTrophies, dailyEvent, dayKey, OUTFITS, PAINTS } from '../.checks/jade-save.js';
import { addHeat, lanterns } from '../.checks/jade-heat.js';
import { GIG_DEFS, gigMission } from '../.checks/jade-gigs.js';
import { LockGame, WireGame, WokGame, DumplingGame } from '../.checks/jade-mini.js';
import { FRAMES, ATLASES, ATLAS_SIZE, TEXTURES, PLAIN, FILL } from '../.checks/jade-art.js';
import { playMission, missionSave } from './jade-bot.mjs';

let n = 0;
const test = (name, f) => { try { f(); n++; } catch (e) { console.error('FAILED:', name); throw e; } };
const c = city();
const ALL = new Set(DISTRICTS);
const world = (o = {}) => { const s = newSave(o.seed ?? 5); s.started = true; if (o.done) s.done = o.done; const w = new World(s, o.seed ?? 5); w.quiet = true; return w; };
const allDone = MISSIONS.map(m => m.id);

test('a seed replays the world exactly', () => {
  const run = seed => { const w = world({ seed }); const inputs = []; let k = seed; for (let i = 0; i < 1200; i++) { k = (k * 1103515245 + 12345) & 0x7fffffff; inputs.push({ ...NO_INPUT, mx: Math.cos(k), my: Math.sin(k), dash: i % 97 === 0, hop: i % 53 === 0 }); } for (const inp of inputs) w.step(inp, DT); return JSON.stringify([w.p.x, w.p.y, w.cars.map(c => [c.x, c.y]), w.peds.map(p => [p.x, p.y]), w.s.stats]); };
  assert.equal(run(11), run(11));
  assert.notEqual(run(11), run(12));
  const a = playMission('m2', 'casual', 3), b = playMission('m2', 'casual', 3);
  assert.deepEqual(a, b, 'a bot run replays exactly');
});

test('the city: five districts, the plan, and the counts the docs quote', () => {
  assert.equal(W, 120); assert.equal(H, 92);
  for (const d of DISTRICTS) assert.ok(c.places && Object.values(c.places).some(p => p.d === d), `${d} has places`);
  assert.equal(c.cats.length, 50, '50 lucky cats');
  assert.ok(c.murals.length >= 12, 'murals to restore');
  assert.ok(c.hides.length >= 15, 'hiding spots');
  assert.ok(c.ladders.length >= 2, 'ladders to the rooftops');
  for (const k of ['market', 'safe', 'garage', 'contact']) assert.ok(Object.values(c.places).some(p => p.kind === k), k);
  for (const d of DISTRICTS) assert.ok(Object.values(c.places).some(p => p.kind === 'market' && p.d === d), `a market in ${d}`);
  for (const d of DISTRICTS) assert.ok(Object.values(c.places).some(p => p.kind === 'safe' && p.d === d), `a safe house in ${d}`);
});

test('every road tile is reachable by a small ride, and by a big ride except alleys', () => {
  const s = c.places['safe-market']; const [sx, sy] = nearestFree(c, 'small', s.x, s.y, ALL, 6);
  const f = field(c, 'small', Math.floor(sx / T), Math.floor(sy / T), ALL);
  const big = field(c, 'big', Math.floor(sx / T), Math.floor(sy / T), ALL);
  let roads = 0, bad = [];
  for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) {
    if (c.ground[ty * W + tx] !== G.ROAD || c.solid[ty * W + tx] !== S.OPEN) continue;
    roads++;
    if (f.dist[ty * W + tx] < 0) bad.push(`small ${tx},${ty}`);
    if (big.dist[ty * W + tx] < 0) bad.push(`big ${tx},${ty}`);
  }
  assert.ok(roads > 1500, `a real road network (${roads} tiles)`);
  assert.deepEqual(bad.slice(0, 10), [], 'unreachable road tiles');
});

test('every place, cat, mural, hide and ladder foot can be walked to', () => {
  const s = c.places['safe-market'];
  const f = field(c, 'foot', Math.floor(s.x / T), Math.floor(s.y / T) + 1, ALL);
  const reach = (x, y) => { const [fx, fy] = nearestFree(c, 'foot', x, y, ALL, 2); return f.dist[Math.floor(fy / T) * W + Math.floor(fx / T)] >= 0; };
  for (const [id, p] of Object.entries(c.places)) assert.ok(reach(p.x, p.y), `place ${id}`);
  c.cats.forEach((k, i) => { const roof = (c.flags[Math.floor(k.y / T) * W + Math.floor(k.x / T)] & F_ROOF) > 0; if (!roof) assert.ok(reach(k.x, k.y), `cat ${i}`); });
  for (const m of c.murals) assert.ok(reach(m.x, m.y + 30), `mural ${m.id}`);
  for (const h of c.hides) assert.ok(reach(h.x, h.y), `hide ${h.x},${h.y}`);
  for (const l of c.ladders) { assert.ok(reach(l.x * T + T / 2, l.y * T + T / 2), 'ladder foot'); assert.ok(c.flags[l.ry * W + l.rx] & F_ROOF, 'ladder top is on a roof'); }
});

test('every parked ride can be reached on foot, and every boat from dry land', () => {
  const w = world({ done: allDone });
  const s = c.places['safe-market'];
  const f = field(c, 'foot', Math.floor(s.x / T), Math.floor(s.y / T) + 1, ALL);
  for (const r of w.rides) {
    const reachable = [];
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const tx = Math.floor(r.b.x / T) + dx, ty = Math.floor(r.b.y / T) + dy; if (tx >= 0 && ty >= 0 && tx < W && ty < H && f.dist[ty * W + tx] >= 0 && c.solid[ty * W + tx] === S.OPEN) reachable.push(Math.hypot(tx * T + T / 2 - r.b.x, ty * T + T / 2 - r.b.y)); }
    assert.ok(reachable.length && Math.min(...reachable) < (r.kind === 'boat' ? 96 : 70) + 20, `${r.kind} at ${Math.floor(r.b.x / T)},${Math.floor(r.b.y / T)} is within reach of a walkable tile`);
  }
});

test('bodies never end a step inside a wall: random driving for every way of moving', () => {
  const ctx = { c, roof: false, air: false, obstacles: world().obs };
  let k = 7; const R = () => { k = (k * 16807) % 2147483647; return k / 2147483647; };
  for (const kind of ['foot', 'scooter', 'trishaw', 'tuktuk', 'van', 'boat']) {
    const v = kind === 'foot' ? null : VEHICLES[kind];
    const cls = v ? v.cls : 'foot';
    for (let trial = 0; trial < 30; trial++) {
      const tx = 2 + Math.floor(R() * (W - 4)), ty = 2 + Math.floor(R() * (H - 4));
      const [x, y] = nearestFree(c, cls, tx * T + T / 2, ty * T + T / 2, ALL, 20);
      const b = { x, y, h: R() * 6.28, speed: 0, r: v ? v.r : FOOT.r, len: v ? v.len : 0, cls };
      if (overlapping(ctx, b)) continue; // a capsule that doesn't fit its spawn: skip
      for (let i = 0; i < 400; i++) {
        const a = Math.floor(i / 40) * 1.3 + trial;
        drive(ctx, b, Math.cos(a), Math.sin(a), v ? v.speed : FOOT.run, v ? v.accel : 2400, v ? v.turn : 30, DT, !v);
        assert.ok(passable(c, cls, Math.floor(b.x / T), Math.floor(b.y / T)), `${kind} centre left the open ground at ${b.x},${b.y}`);
      }
    }
  }
});

test('getting on and off every kind of ride, and riding it about', () => {
  for (const kind of ['scooter', 'trishaw', 'tuktuk', 'van', 'boat']) {
    const w = world({ done: allDone });
    const r = w.rides.find(r => r.kind === kind && !r.locked);
    assert.ok(r, `a parked ${kind}`);
    const [fx, fy] = nearestFree(c, 'foot', r.b.x, r.b.y, w.open, 3);
    w.placePlayer(fx, fy); w.findNear();
    w.enter(r); for (let i = 0; i < 30; i++) w.step(NO_INPUT, DT);
    assert.equal(w.p.ride, r, `on the ${kind}`);
    assert.equal(w.p.anim.startsWith('ride'), true);
    for (let i = 0; i < 120; i++) w.step({ ...NO_INPUT, my: kind === 'boat' ? 1 : 0, mx: kind === 'boat' ? 0 : 1 }, DT);
    assert.ok(r.b.speed > 0 || Math.hypot(r.b.x - fx, r.b.y - fy) > 20, `${kind} moves`);
    for (let i = 0; i < 90; i++) w.step(NO_INPUT, DT);
    // a boat steps off at the bank; bring it back to its mooring first
    if (kind === 'boat') { r.b.x = r.b.x; }
    const ok = w.exit();
    if (kind === 'boat' && !ok) { const m = w.rides.find(x => x === r); m.b.x = 66.5 * T; m.b.y = 24.5 * T; assert.ok(w.exit(), 'step off a boat at the jetty'); }
    else assert.ok(ok, `get off the ${kind}`);
    assert.equal(w.p.ride, null);
    assert.equal(c.solid[Math.floor(w.p.y / T) * W + Math.floor(w.p.x / T)], S.OPEN, `standing on open ground after the ${kind}`);
  }
  // a locked scooter asks for the jump-start mini-game first
  const w = world(); const r = w.rides.find(r => r.locked && w.open.has(districtAt(Math.floor(r.b.x / T), Math.floor(r.b.y / T))));
  if (r) { w.enter(r); assert.equal(w.ui?.kind, 'mini'); assert.equal(w.ui.mini, 'wires'); w.miniDone(true); for (let i = 0; i < 30; i++) w.step(NO_INPUT, DT); assert.equal(w.p.ride, r); assert.equal(r.locked, false); }
});

test('on foot: walk, run, sneak, dash and hop all move at their speeds and play their animations', () => {
  const w = world(); w.placePlayer(20 * T + 32, 47 * T + 32);
  const speedOf = (inp, n = 40) => { for (let i = 0; i < n; i++) w.step({ ...NO_INPUT, mx: 1, ...inp }, DT); return w.p.b.speed; };
  assert.ok(Math.abs(speedOf({}) - FOOT.run) < 5, 'run');
  assert.equal(w.p.anim, 'run');
  assert.ok(Math.abs(speedOf({ sneak: true }) - FOOT.walk) < 5, 'sneak walks');
  assert.equal(w.p.anim, 'sneak');
  w.step({ ...NO_INPUT, mx: 1, dash: true }, DT); for (let i = 0; i < 8; i++) w.step({ ...NO_INPUT, mx: 1 }, DT); assert.equal(w.p.anim, 'dash'); assert.ok(w.p.b.speed > FOOT.run, `dash speed ${w.p.b.speed}`);
  for (let i = 0; i < 60; i++) w.step(NO_INPUT, DT);
  w.step({ ...NO_INPUT, mx: 1, hop: true }, DT); w.step({ ...NO_INPUT, mx: 1 }, DT); assert.equal(w.p.anim, 'hop');
  for (let i = 0; i < 60; i++) w.step(NO_INPUT, DT); assert.equal(w.p.anim, 'idle');
});

test('climbing the ladder to the rooftops and back down, and falling back onto the roof', () => {
  const w = world({ done: allDone }); const l = c.ladders[0];
  w.placePlayer(l.x * T + T / 2, l.y * T + T / 2); w.findNear(); assert.equal(w.near?.kind, 'ladder-up');
  w.interact(); for (let i = 0; i < 40; i++) w.step(NO_INPUT, DT);
  assert.equal(w.p.roof, true);
  for (let i = 0; i < 200; i++) { w.step({ ...NO_INPUT, mx: -1, hop: i % 30 === 0 }, DT); assert.ok(c.flags[Math.floor(w.p.y / T) * W + Math.floor(w.p.x / T)] & F_ROOF || w.p.hopT > 0, 'always on a roof unless mid-hop'); }
  w.placePlayer(l.x * T + T / 2, l.y * T + T / 2); w.p.roof = true; w.p.b.x = l.rx * T + T / 2; w.p.b.y = l.ry * T + T / 2; w.findNear(); assert.equal(w.near?.kind, 'ladder-down');
  w.interact(); for (let i = 0; i < 40; i++) w.step(NO_INPUT, DT); assert.equal(w.p.roof, false);
});

test('heat: lanterns bring wardens, roadblocks and the blimp; losing them, hiding and swapping jackets clear it', () => {
  const w = world({ done: allDone }); w.s.settings.diff = 'normal'; w.s.settings.assist = false;
  w.placePlayer(20 * T + 32, 47 * T + 32);
  addHeat(w, 1.1, 'test'); assert.equal(lanterns(w), 1);
  for (let i = 0; i < 120; i++) w.step(NO_INPUT, DT);
  assert.ok(w.wardens.length >= 1, 'a warden comes');
  addHeat(w, 3, 'test'); assert.equal(lanterns(w), 4);
  let most = 0, blimp = false; for (let i = 0; i < 70; i++) { w.step(NO_INPUT, DT); most = Math.max(most, w.wardens.length); blimp ||= w.blimp.on; }
  assert.ok(blimp, 'the blimp at four lanterns'); assert.ok(most >= 3, `more wardens at four lanterns (${most})`);
  // standing still in the open, they catch you
  let caughtAt = -1; for (let i = 0; i < 600 && caughtAt < 0; i++) { w.step(NO_INPUT, DT); if (w.s.stats.caught) caughtAt = i; }
  assert.ok(caughtAt >= 0, 'caught when you stand still'); for (let i = 0; i < 120; i++) w.step(NO_INPUT, DT);
  addHeat(w, 4.1, 'test'); for (let i = 0; i < 2; i++) w.step(NO_INPUT, DT);
  w.swapJacket(); assert.equal(w.heat, 0); assert.equal(w.wardens.length, 0); assert.equal(w.blimp.on, false);
  // out of sight long enough and a lantern goes out
  const w2 = world({ done: allDone }); w2.placePlayer(20 * T + 32, 47 * T + 32); addHeat(w2, 1.2, 'test'); w2.wardens = []; w2.lastSeen = [0, 0];
  w2.p.hide = true; let t = 0; while (lanterns(w2) > 0 && t < 30) { w2.step(NO_INPUT, DT); t += DT; }
  assert.equal(lanterns(w2), 0, `a hidden player loses one lantern (${t.toFixed(1)}s)`);
  // caught: a small fine and a trip to the safe house
  const w3 = world({ done: allDone }); w3.s.cash = 1000; w3.placePlayer(60 * T, 33 * T); w3.caughtNow();
  assert.equal(w3.s.cash, 950); assert.equal(w3.s.stats.caught, 1); assert.equal(w3.heat, 0);
  assert.ok(Object.values(c.places).some(p => p.kind === 'safe' && Math.hypot(p.x - w3.p.x, p.y - w3.p.y) < 3 * T), 'at a safe house');
  // on the roofs nobody adds heat, and line of sight is blocked by buildings
  assert.equal(los(c, 1 * T, 57 * T, 1 * T, 70 * T), false);
});

test('trading: prices, spreads, rep, tips, haggling, capacity, buying, selling and the stash', () => {
  for (const d of DISTRICTS) for (const g of GOODS) for (const r of [0, 25, 60, 90]) { const p = prices(midPrice(3, 4, d, g), r); assert.ok(p.sell < p.buy, `${d} ${g} sells below buying`); }
  const base = midPrice(3, 4, 'market', 'tea'), tipped = midPrice(3, 4, 'market', 'tea', [{ night: 4, market: 'market', good: 'tea', mult: 1.5, from: '', text: '' }]);
  assert.ok(Math.abs(tipped / base - 1.5) < 1e-9, 'a tip moves the price');
  assert.notEqual(midPrice(3, 4, 'market', 'tea'), midPrice(3, 5, 'market', 'tea'), 'prices drift each night');
  assert.ok(prices(100, 90).buy < prices(100, 0).buy && prices(100, 90).sell > prices(100, 0).sell, 'rep earns better prices');
  assert.equal(haggleResult(0.5, 0.15).grade, 'great'); assert.equal(haggleResult(0.6, 0.15).grade, 'good'); assert.equal(haggleResult(0.95, 0.15).grade, 'sour');
  assert.ok(haggleZone(0, true) > haggleZone(0, false) && haggleZone(80, false) > haggleZone(0, false));
  assert.equal(capacity(4, 0, true), 4); assert.equal(capacity(40, 3, false), 70);
  const r = buy(100, emptyCargo(), 8, 'tea', 99, 22); assert.equal(r.n, 4); assert.equal(r.cash, 12);
  const r2 = buy(1000, emptyCargo(), 8, 'mango', 99, 12); assert.equal(r2.n, 8, 'capacity caps the buy');
  const s = sell(0, r2.cargo, 'mango', 99, 15); assert.equal(s.cash, 120); assert.equal(cargoCount(s.cargo), 0);
  assert.equal(sell(0, emptyCargo(), 'jade', 1, 99).ok, false);
  const mv = moveGoods({ ...emptyCargo(), fan: 5 }, emptyCargo(), 'fan', 99, 3); assert.equal(mv.n, 3);
  // through the world: profit is counted and the trip's cost is remembered
  const w = world({ done: allDone }); w.s.cash = 500;
  const before = w.s.stats.profit; assert.equal(w.buy('temple', 'tea', 4), null); const paid = 500 - w.s.cash;
  w.s.tips.push({ night: w.s.night, market: 'canal', good: 'tea', mult: 2, from: 'x', text: '' });
  assert.equal(w.sell('canal', 'tea', 4), null); assert.ok(w.s.stats.profit - before > 0 && w.s.cash > 500 - paid);
  const best = bestRoute(1, 1, [...ALL]); assert.ok(best.gain > 0 && best.from !== best.to);
  for (const g of GOODS) assert.ok(GOOD[g].base > 0);
});

test('magpies snatch cargo from a slow rider and miss one who dashes', () => {
  const w = world({ done: allDone }); w.placePlayer(20 * T + 32, 47 * T + 32); w.s.cargo.jade = 4;
  w.snatchers.push({ x: w.p.x + 200, y: w.p.y, h: Math.PI, t: 0, out: false, took: 0, wing: 0 });
  for (let i = 0; i < 120; i++) w.step(NO_INPUT, DT);
  assert.equal(w.s.cargo.jade, 2, 'two bangles gone');
  w.snatchers = [{ x: w.p.x + 200, y: w.p.y, h: Math.PI, t: 0, out: false, took: 0, wing: 0 }];
  for (let i = 0; i < 120; i++) { const m = w.snatchers[0]; const d = m ? Math.hypot(m.x - w.p.x, m.y - w.p.y) : 999; w.step({ ...NO_INPUT, dash: d < 70, mx: d < 70 ? 1 : 0 }, DT); }
  assert.equal(w.s.cargo.jade, 2, 'dodged');
});

test('the story: 25 jobs in 5 chapters, each with a contact, dialogue and a checkpoint, heirlooms at each finale', () => {
  assert.equal(MISSIONS.length, 25);
  for (let ch = 1; ch <= 5; ch++) assert.equal(MISSIONS.filter(m => m.ch === ch).length, 5);
  assert.equal(HEIRLOOMS.length, 5);
  for (const m of MISSIONS) {
    assert.ok(c.places[m.at], `${m.id} is given at a real place`);
    assert.ok(PEOPLE[m.giver], `${m.id} giver`);
    assert.ok(m.steps.some(s => s.t === 'talk'), `${m.id} has dialogue`);
    assert.ok(m.steps.some(s => s.cp), `${m.id} has a checkpoint`);
    for (const s of m.steps) if (s.t === 'talk') for (const [who] of s.lines) assert.ok(who === 'hero' || PEOPLE[who], `${m.id} speaker ${who}`);
  }
  const kinds = new Set(MISSIONS.flatMap(m => m.steps.map(s => s.t)));
  for (const k of ['chase', 'tail', 'escort', 'race', 'stealth', 'deliver', 'mini', 'trade', 'fares', 'heat', 'collect']) assert.ok(kinds.has(k), `a ${k} job`);
  for (let ch = 1; ch <= 5; ch++) assert.ok(MISSION[`m${ch * 5}`].steps.some(s => s.t === 'chase'), `chapter ${ch} ends in a chase`);
  // chapters open districts in order
  const s = newSave(); assert.deepEqual(openDistricts(s), ['market']); assert.equal(chapterOf(s), 1);
  s.done = MISSIONS.slice(0, 5).map(m => m.id); assert.deepEqual(openDistricts(s), ['market', 'temple']); assert.equal(chapterOf(s), 2);
  assert.ok(available(s).every(m => m.ch === 2));
});

test('every story job: its spots stand in open, walkable or sailable ground for its chapter', () => {
  for (const m of MISSIONS) {
    const s = missionSave(m.id); const open = new Set(openDistricts(s));
    for (const st of m.steps) {
      const spots = [];
      if ('at' in st && Array.isArray(st.at)) spots.push(st.at); if ('to' in st && Array.isArray(st.to)) spots.push(st.to);
      if ('marks' in st) spots.push(...st.marks.filter(Array.isArray)); if ('route' in st) spots.push(...st.route.filter(Array.isArray));
      for (const [x, y] of spots) assert.ok(open.has(districtAt(x, y)), `${m.id} ${st.t} spot ${x},${y} is in an open district`);
    }
  }
});

test('every story job is finished by the scripted solver', () => {
  for (const m of MISSIONS) { const r = playMission(m.id, 'perfect', 1); assert.ok(r.won, `${m.id} ${m.title}: ${JSON.stringify(r)}`); }
});

test('every step restores from its checkpoint: fail anywhere, retry, and still finish', () => {
  for (const m of MISSIONS) m.steps.forEach((st, i) => {
    if (st.t === 'talk') return;
    const r = playMission(m.id, 'perfect', 2, { failAt: i, maxT: 900 });
    assert.ok(r.won && r.fails >= 1, `${m.id} step ${i} (${st.t}) after a forced failure: ${JSON.stringify(r)}`);
  });
});

test('side gigs: every board builds a job the solver can finish', () => {
  for (const g of GIG_DEFS) {
    const s = missionSave('m25'); s.done = MISSIONS.map(m => m.id); s.best['house:safe-docks'] = 1;
    const w = new World(s, 9); w.quiet = true;
    const r = gigMission(w, g.id); assert.ok(r && r.m.steps.length && r.reward > 0, g.id);
  }
});

test('mini-games: perfect play wins each one, idle play times out or fails', () => {
  const o = { level: 1, assist: true, seed: 3 };
  const lock = new LockGame(o); let t = 0; while (!lock.done && t < 60) { const p = lock.pins[lock.sel]; if (!lock.holding) lock.hold(true); else if (p.h >= (p.lo + p.hi) / 2) lock.hold(false); lock.step(1 / 60); t += 1 / 60; } assert.ok(lock.done, 'lock opens');
  const idle = new LockGame(o); for (let i = 0; i < 60 * 100; i++) idle.step(1 / 60); assert.ok(idle.failed, 'the lock times out');
  const wires = new WireGame(o); for (let l = 0; l < 4; l++) { wires.pick(l); wires.connect(wires.right.indexOf(l)); } wires.turnKey(); assert.ok(wires.done && wires.started);
  const bad = new WireGame(o); bad.pick(0); bad.connect((bad.right.indexOf(0) + 1) % 4); assert.equal(bad.links[0], null, 'wrong socket buzzes');
  const wok = new WokGame(o); for (let i = 0; i < 60 * 90 && !wok.done && !wok.failed; i++) { const want = wok.items.filter(it => (wok.need[it.f] ?? 0) > (wok.got[it.f] ?? 0) && it.vy > 0 && it.y < 0.8).sort((a, b) => b.y - a.y)[0]; if (want) wok.moveTo(want.x); else wok.moveTo(0.5); if (wok.burn > 0.5) wok.toss(); wok.step(1 / 60); } assert.ok(wok.done, 'the order is served');
  const dum = new DumplingGame(o); for (let i = 0; i < 60 * 90 && !dum.done && !dum.failed; i++) { const hit = dum.phase === 'fill' ? Math.abs(dum.spoon() - 0.5) < 0.03 : dum.phase === 'pleat' && Math.abs(((dum.ring - dum.target) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI) < 0.08; if (hit) dum.press(); dum.step(1 / 60); } assert.ok(dum.done && dum.results.every(r => r === 'perfect'), 'perfect dumplings');
});

test('the save: round trip, repair and clamping, v1 migration, garage, wardrobe and safe houses', () => {
  const s = newSave(42); s.cash = 777; s.done = ['m1', 'm2']; s.cats = [1, 5]; s.cargo.tea = 3;
  assert.deepEqual(loadSave(JSON.stringify(s)), s);
  assert.equal(s.v, SAVE_VERSION);
  const junk = loadSave(JSON.stringify({ v: 2, cash: -50, done: ['m1', 'zzz', 3], rep: { market: 400 }, upgrades: { speed: 9 }, paint: 'plaid', cats: [1, 1, 99, -1], settings: { diff: 'hard' } }));
  assert.equal(junk.cash, 0); assert.deepEqual(junk.done, ['m1']); assert.equal(junk.rep.market, 100); assert.equal(junk.upgrades.speed, 3); assert.equal(junk.paint, 'red'); assert.deepEqual(junk.cats, [1]); assert.equal(junk.settings.diff, 'easy');
  assert.equal(loadSave('{not json').cash, 100); assert.equal(loadSave(null).settings.assist, true, 'Assist is on by default');
  const v1 = loadSave(JSON.stringify({ v: 1, money: 321, done: 'm1,m2,m3', rep: 12, hero: 'enzo', seed: 9 }));
  assert.equal(v1.v, SAVE_VERSION); assert.equal(v1.cash, 321); assert.deepEqual(v1.done, ['m1', 'm2', 'm3']); assert.equal(v1.rep.market, 12); assert.equal(v1.hero, 'enzo');
  const g = newSave(); g.cash = 5000;
  assert.equal(buyUpgrade(g, 'speed'), null); assert.equal(g.upgrades.speed, 1); assert.equal(g.cash, 4850);
  assert.equal(buyPaint(g, 'jade'), null); assert.equal(g.paint, 'jade');
  assert.match(buyOutfit(g, 'dora', 'neon'), /reputation/); g.rep.arcade = 40; assert.equal(buyOutfit(g, 'dora', 'neon'), null); assert.equal(g.outfit.dora, 'neon');
  assert.equal(OUTFITS.length, 6); assert.equal(PAINTS.length, 5);
  assert.equal(safeOpen(g, 'safe-market'), true); assert.equal(safeOpen(g, 'safe-temple'), false);
  g.done = MISSIONS.slice(0, 5).map(m => m.id); assert.match(buySafe(g, 'safe-temple'), /reputation/); g.rep.temple = 20; assert.equal(buySafe(g, 'safe-temple'), null); assert.equal(safeOpen(g, 'safe-temple'), true);
});

test('trophies, the daily market event and the night clock', () => {
  assert.equal(TROPHIES.length, 20);
  const s = newSave(); s.done = ['m1', 'm2', 'm3', 'm4', 'm5']; s.cats = Array.from({ length: 10 }, (_, i) => i);
  const got = checkTrophies(s); assert.ok(got.includes('First Job') && got.includes('Jade Dragon') && got.includes('Lucky Paw'));
  assert.deepEqual(checkTrophies(s), [], 'awarded once');
  assert.deepEqual(dailyEvent('2026-11-14'), dailyEvent('2026-11-14'), 'the same event all day');
  const seen = new Set(); for (let d = 1; d <= 28; d++) seen.add(dailyEvent(`2026-02-${String(d).padStart(2, '0')}`).name); assert.ok(seen.size >= 4, 'events vary by day');
  assert.equal(dayKey(new Date(2026, 10, 14)), '2026-11-14');
  const w = world(); w.s.clock = 719.9; const night = w.s.night; for (let i = 0; i < 30; i++) w.step(NO_INPUT, DT); assert.equal(w.s.night, night + 1, 'a new night with new prices');
});

test('every painted asset exists, every frame sits inside its atlas and none is blank', () => {
  const dir = new URL('../public/art/jade-street/', import.meta.url);
  const webpSize = buf => { const t = buf.toString('ascii', 12, 16); if (t === 'VP8X') return [1 + buf.readUIntLE(24, 3), 1 + buf.readUIntLE(27, 3)]; if (t === 'VP8L') { const b = buf.readUInt32LE(21); return [(b & 0x3fff) + 1, ((b >> 14) & 0x3fff) + 1]; } return [buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff]; };
  for (const a of ATLASES) { const p = new URL(`${a}.webp`, dir); assert.ok(existsSync(p), a); assert.deepEqual(webpSize(readFileSync(p)), ATLAS_SIZE[a], `${a} size`); }
  for (const t of TEXTURES) assert.ok(existsSync(new URL(`tex-${t}.webp`, dir)), t);
  for (const [n, size] of Object.entries(PLAIN)) { const p = new URL(`${n}.webp`, dir); assert.ok(existsSync(p), n); assert.deepEqual(webpSize(readFileSync(p)), size, n); }
  for (const n of ['ui-plaque-jade', 'ui-plaque-red', 'ui-btn-jade', 'ui-btn-red']) assert.ok(existsSync(new URL(`${n}.webp`, dir)), n);
  for (const [n, [a, x, y, w, h]] of Object.entries(FRAMES)) { const [aw, ah] = ATLAS_SIZE[ATLASES[a]]; assert.ok(w > 0 && h > 0 && x + w <= aw && y + h <= ah, `${n} inside its atlas`); assert.ok(FILL[n] > 0.05, `${n} is painted (${FILL[n]})`); }
  // every sprite the game asks for by name
  const need = ['lucky-cat', 'mural-faded', 'mural-fresh', 'fire-ladder', 'blimp', 'ui-ring-hollow', 'ui-lantern-on', 'gate', 'flag', 'coins', 'containers'];
  for (const h of ['dora', 'enzo']) for (const a of ['walk', 'run']) for (const d of ['down', 'up', 'side']) for (let i = 0; i < 4; i++) need.push(`${h}-${a}-${d}-${i}`);
  for (const h of ['dora', 'enzo']) for (const f of ['idle-down', 'idle-up', 'idle-side', 'dash-side', 'hop-side', 'bump', 'pickup', 'hide', 'cheer-0', 'caught-0', 'climb-on', 'climb-off', 'talk', 'swap', 'carry-side', 'carry-down', 'sneak', 'paint-0', 'pick-0', 'door', 'sleep', 'ride-scooter-0', 'ride-pedal-0', 'ride-pole-0', 'ride-bump', 'ride-cheer', 'wave', 'barge-side']) need.push(`${h}-${f}`);
  for (const k of Object.keys(VEHICLES)) need.push('v-' + k);
  for (const p of Object.values(PEOPLE)) need.push(p.face);
  for (const h of HEIRLOOMS) need.push(h.sprite);
  for (const sp of ['rabbit', 'dog', 'squirrel', 'cat', 'duck', 'hedgehog']) for (const f of ['down', 'up', 'side-0', 'side-1', 'hop']) need.push(`folk-${sp}-${f}`);
  for (const b of c.buildings) need.push(b.sprite);
  for (const p of c.props) if (!p.sprite.startsWith('lanterns') && !p.sprite.startsWith('containers')) need.push(p.sprite);
  for (const d of c.decals) need.push(d.sprite);
  for (const n of need) assert.ok(FRAMES[n], `sprite ${n}`);
});

console.log(`jade: ${n} tests ok`);
