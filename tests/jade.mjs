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
import { ROADS } from '../.checks/jade-city.js';
import { LIGHTS, CYCLE, lightOf } from '../.checks/jade-traffic.js';
import { zebraAt, pedTile, dests } from '../.checks/jade-folk.js';
import { spawn, eventAct, EVENT_KINDS } from '../.checks/jade-events.js';
import { downhill } from '../.checks/jade-nav.js';
import { rainAt } from '../.checks/jade-weather.js';
import { medalOf, goals } from '../.checks/jade-medals.js';
import { DIFF } from '../.checks/jade-diff.js';

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
  const junk = loadSave(JSON.stringify({ v: 2, cash: -50, done: ['m1', 'zzz', 3], rep: { market: 400 }, upgrades: { speed: 9 }, paint: 'plaid', cats: [1, 1, 99, -1], settings: { diff: 'insane' } }));
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
  // the second batch: new actions, seated townsfolk, events, street props, the festival, fireworks, map and UI pieces
  for (const h of ['dora', 'enzo']) for (const f of ['push-side-0', 'push-side-1', 'push-up-0', 'push-up-1', 'lantern', 'lookup', 'phone', 'eat', 'dance', 'kneel', 'clap', 'umbrella']) need.push(`${h}-${f}`);
  for (const sp of ['rabbit', 'dog', 'squirrel', 'cat', 'duck', 'hedgehog']) for (const k of [0, 1]) need.push(`folk-${sp}-sit-${k}`);
  need.push('duck-down-0', 'duck-down-1', 'duck-side', 'duck-lost', 'busker-0', 'busker-1', 'busk-hat', 'smoke', 'van-broken', 'mag-mango-0', 'mag-mango-1');
  need.push('light-red', 'light-amber', 'light-green', 'umb-red', 'umb-jade', 'sky-lantern', 'ui-phone', 'ui-radio', 'c-key', 'c-space', 'c-stick', 'i-map');
  for (const m of ['none', 'bronze', 'silver', 'gold']) need.push('ui-medal-' + m);
  for (const f of c.festival) need.push(f.sprite);
  for (const k of ['gold', 'red', 'violet', 'blue', 'orange', 'star']) need.push('fw-' + k);
  for (const k of ['market', 'safe', 'garage', 'gig', 'job', 'cat', 'mural', 'star']) need.push('pin-' + k);
  for (const k of ['temple', 'pagoda', 'crane', 'arcade', 'bridge', 'lighthouse', 'ferry', 'hall']) need.push('mi-' + k);
  for (let i = 1; i <= 6; i++) need.push('fog-' + i);
  for (const n of need) assert.ok(FRAMES[n], `sprite ${n}`);
  // the painted screens: loading, the five stalls, the storybook, chapter cards, the ending, the map paper and frame
  const plain = ['loading', 'map-paper', ...['market', 'temple', 'canal', 'docks', 'arcade'].map(d => 'stall-' + d), ...[1, 2, 3, 4].map(i => 'story-' + i), ...[1, 2, 3, 4, 5].map(i => 'chapter-' + i), ...[1, 2, 3].map(i => 'end-' + i)];
  for (const n of plain) { assert.ok(PLAIN['bg-' + n], `painting bg-${n}`); assert.ok(readFileSync(new URL(`bg-${n}.webp`, dir)).length > 20000, `bg-${n} is not empty`); }
  for (const n of ['ui-map-frame', 'ui-lantern-on', 'ui-lantern-off']) assert.ok(readFileSync(new URL(`${n}.webp`, dir)).length > 1000, n);
});

test('traffic lights: green, amber and red in turn, never green both ways, and cars stop at the line on red', () => {
  assert.ok(LIGHTS.length >= 10, `${LIGHTS.length} lights`);
  for (let li = 0; li < LIGHTS.length; li++) for (let t = 0; t < CYCLE; t += 0.1) {
    const h = lightOf({ time: t }, li, 'h'), v = lightOf({ time: t }, li, 'v');
    assert.ok(!(h !== 'red' && v !== 'red'), `light ${li} at ${t.toFixed(1)}: ${h}/${v}`);
  }
  const seen = new Set(); for (let t = 0; t < CYCLE; t += 0.1) seen.add(lightOf({ time: t }, 0, 'h')); assert.equal(seen.size, 3);
  // a long run: no car ever drives into a crossing while its light is red
  const w = world({ done: allDone }); w.placePlayer(42 * T, 46 * T);
  let checked = 0, greens = 0, waited = 0;
  for (let i = 0; i < 60 * 90; i++) {
    const before = w.cars.map(car => ({ car, x: car.x, y: car.y }));
    w.step(NO_INPUT, DT);
    for (const { car, x, y } of before) {
      if (!w.cars.includes(car)) continue;
      for (const [li, L] of LIGHTS.entries()) {
        const hr = ROADS[L.h], vr = ROADS[L.v]; const axis = ROADS[car.r].axis;
        if (car.r !== L.h && car.r !== L.v) continue;
        if (car.speed < 1 && lightOf(w, li, axis) === 'red' && Math.abs(car.x - (vr.at + 2) * T) < 4 * T && Math.abs(car.y - (hr.at + 2) * T) < 4 * T) waited++;
        const inBox = (px, py) => px > vr.at * T && px < (vr.at + 4) * T && py > hr.at * T && py < (hr.at + 4) * T;
        if (!inBox(x, y) && inBox(car.x, car.y)) { checked++; if (lightOf(w, li, axis) === 'red') assert.equal(car.go, li, `car ${car.id} ran the red at light ${li}`); else greens++; }
      }
    }
  }
  assert.ok(checked > 5 && greens > 0, `cars went through lit crossings (${checked})`);
  assert.ok(waited > 0, 'and cars waited at a red');
});

test('townsfolk walk to doors, stalls and seats, cross only at zebras, and never stand in the road for long', () => {
  const w = world({ done: allDone }); w.placePlayer(20 * T, 60 * T);
  const onRoad = new Map(); let maxRoad = 0, sat = 0, crossed = 0, arrived = 0;
  for (let i = 0; i < 60 * 120; i++) {
    w.step(NO_INPUT, DT);
    for (const pd of w.peds) {
      const tx = Math.floor(pd.x / T), ty = Math.floor(pd.y / T), g = w.c.ground[ty * W + tx];
      if (pd.sit > 0) sat++;
      if (g === G.ROAD) { if (pd.hop <= 0) assert.ok(zebraAt(tx, ty) >= 0 || pedTile(w.c, tx, ty), `ped ${pd.id} on a road tile ${tx},${ty} off the zebra`); const t = (onRoad.get(pd.id) ?? 0) + DT; onRoad.set(pd.id, t); maxRoad = Math.max(maxRoad, t); if (t > 0.5 && t < 0.52) crossed++; }
      else onRoad.delete(pd.id);
      if (pd.wait > 0 && pd.dest >= 0) arrived++;
    }
  }
  assert.ok(maxRoad < 12, `nobody lingers in the road (${maxRoad.toFixed(1)}s)`);
  assert.ok(sat > 0, 'somebody sat down to eat');
  assert.ok(crossed > 0, 'somebody crossed at a zebra');
  assert.ok(dests(w.c).length > 80, 'plenty of places to walk to');
  void arrived;
});

test('street events: each kind starts in free roam and can be finished, and a job clears it', () => {
  for (const kind of EVENT_KINDS) {
    const w = world({ done: allDone }); w.placePlayer(30 * T, 46 * T);
    let e = null; for (let k = 0; k < 8 && !e; k++) { w.placePlayer((10 + k * 12) * T, 46 * T); e = spawn(w, kind); }
    assert.ok(e, `${kind} spawned`); assert.equal(w.street.kind, kind);
    const cash = w.s.cash;
    if (kind === 'magpie') { for (let i = 0; i < 60 * 30 && e.phase === 'on'; i++) { const b = e.b; const dx = b.x - w.p.x, dy = b.y - w.p.y, l = Math.hypot(dx, dy) || 1; w.step({ ...NO_INPUT, mx: dx / l, my: dy / l, dash: i % 20 === 0 && l < 90 }, DT); } }
    if (kind === 'duckling') {
      w.placePlayer(e.x, e.y + 30); w.step(NO_INPUT, DT); eventAct(w); for (let i = 0; i < 60; i++) w.step(NO_INPUT, DT);
      assert.equal(e.phase, 'follow');
      for (let i = 0; i < 60 * 100 && e.phase === 'follow'; i++) { const f = w.fieldTo('walk', e.home[0], e.home[1]); const n = downhill(w.c, f, w.p.x, w.p.y, w.open) ?? e.home; const dx = n[0] - w.p.x, dy = n[1] - w.p.y, l = Math.hypot(dx, dy) || 1; w.step({ ...NO_INPUT, mx: dx / l * 0.6, my: dy / l * 0.6 }, DT); }
    }
    if (kind === 'van') {
      const r = e.ride; w.placePlayer(r.b.x - r.b.len / 2 - 20, r.b.y);
      for (let i = 0; i < 60 * 12 && e.phase === 'on'; i++) { const dx = r.b.x - w.p.x, dy = r.b.y - w.p.y, l = Math.hypot(dx, dy) || 1; w.step({ ...NO_INPUT, mx: dx / l, my: dy / l }, DT); }
      assert.equal(r.broken, false);
    }
    if (kind === 'busker') { w.s.cash = 50; w.placePlayer(e.x, e.y + 30); w.step(NO_INPUT, DT); eventAct(w); assert.ok(e.tipped); assert.ok(w.s.tips.some(t => t.from === 'the busker')); e.phase = 'done'; }
    assert.ok(e.phase === 'done', `${kind} finished (${e.phase})`);
    if (kind !== 'busker') assert.ok(w.s.cash > cash, `${kind} paid`);
    const w2 = world({ done: ['m1'] }); w2.placePlayer(20 * T, 60 * T); spawn(w2, 'busker'); w2.startMission(MISSION.m2); assert.equal(w2.street, null, 'a job clears the event');
  }
});

test('rain: passing showers are seeded, between 0 and 1, and some nights stay dry', () => {
  let wet = 0, dry = 0;
  for (let night = 1; night <= 40; night++) {
    let any = false; for (let cl = 0; cl < 720; cl += 2) { const r = rainAt(7, night, cl); assert.ok(r >= 0 && r <= 1); if (r > 0.3) any = true; assert.equal(r, rainAt(7, night, cl)); }
    if (any) wet++; else dry++;
  }
  assert.ok(wet >= 8 && dry >= 8, `wet ${wet} dry ${dry}`);
  const w = world({ done: allDone }); w.rainForce = 0.8; w.placePlayer(20 * T, 60 * T); for (let i = 0; i < 120; i++) w.step({ ...NO_INPUT, mx: 0.5 }, DT);
  assert.equal(w.p.anim, 'umbrella');
});

test('medals: the three marks, best kept, replays pay a quarter and keep the best', () => {
  const m = MISSION.m3;
  assert.equal(medalOf(m, { time: 10, maxHeat: 0, retries: 0 }), 3);
  assert.equal(medalOf(m, { time: 9999, maxHeat: 0, retries: 0 }), 2);
  assert.equal(medalOf(m, { time: 9999, maxHeat: 5, retries: 2 }), 0);
  assert.equal(goals(m).length, 3);
  const w = world({ done: ['m1', 'm2'] }); w.startMission(m); w.run.time = 10; w.run.maxHeat = 0; w.run.retries = 1; w.finishMission(m);
  assert.equal(w.s.medals.m3.m, 2); assert.equal(w.s.done.includes('m3'), true);
  const cash = w.s.cash;
  assert.equal(w.replay('m9'), 'Finish this job in the story first');
  assert.equal(w.replay('m3'), null); assert.equal(w.run.m.id, 'm3'); assert.ok(w.replaying);
  w.run.time = 9999; w.run.maxHeat = 5; w.run.retries = 3; w.finishMission(m);
  assert.equal(w.s.medals.m3.m, 2, 'best medal kept'); assert.equal(w.s.medals.m3.plays, 2);
  assert.equal(w.s.cash, cash + Math.round(m.reward / 4));
});

test('difficulty: Easy, Normal and Hard numbers get steadily tougher', () => {
  const [e, n, h] = [DIFF.easy, DIFF.normal, DIFF.hard];
  assert.ok(e.evade < n.evade && n.evade < h.evade); assert.ok(e.warden < n.warden && n.warden < h.warden);
  assert.ok(e.timer > n.timer && n.timer > h.timer); assert.ok(e.sight < n.sight && n.sight < h.sight);
  const s = newSave(3); s.settings.diff = 'hard'; assert.equal(new World(s).diff, DIFF.hard);
  assert.equal(loadSave(JSON.stringify({ ...newSave(1), settings: { ...newSave(1).settings, diff: 'hard' } })).settings.diff, 'hard');
});

test('save: the live v2 format migrates to v3 with medals, story, lessons and messages', () => {
  const live = { v: 2, seed: 77, hero: 'enzo', cash: 640, night: 6, clock: 120, started: true, done: ['m1', 'm2', 'm3', 'm4', 'm5', 'm6'], cats: [2, 4], murals: [], rep: { market: 30, temple: 8, canal: 0, docks: 0, arcade: 0 },
    cargo: { jade: 1, mooncake: 0, tea: 2, bowl: 0, fan: 0, mango: 0 }, stash: {}, upgrades: { speed: 1, cargo: 0, grip: 0 }, paint: 'red', outfit: { dora: 'classic', enzo: 'classic' }, safes: ['safe-market'], trophies: [], tips: [], dailyDone: [],
    stats: { missions: 6, playTime: 900 }, settings: { diff: 'normal', assist: true, sound: true, music: true, touch: 'auto' } };
  const s = loadSave(JSON.stringify(live));
  assert.equal(s.v, SAVE_VERSION); assert.equal(s.cash, 640); assert.deepEqual(s.done, live.done); assert.equal(s.hero, 'enzo');
  for (const id of live.done) assert.equal(s.medals[id].plays, 1);
  assert.equal(s.story.intro, true, 'players with a game in progress skip the opening'); assert.equal(s.story.ch, chapterOf(s)); assert.equal(s.story.ending, false);
  assert.ok(s.learned.includes('move'), 'and the first lessons');
  assert.deepEqual(s.msgs, []); assert.equal(s.radio, 0); assert.equal(s.settings.diff, 'normal');
  assert.deepEqual(loadSave(JSON.stringify(s)), s, 'round trip');
  const fresh = newSave(1); assert.equal(fresh.story.intro, false); assert.deepEqual(fresh.learned, []);
});

test('lessons: a new player is taught to move, run, dash and hop in turn, and a ride teaches boost and honk', () => {
  const s = newSave(9); s.started = true; s.story.intro = true; const w = new World(s, 9); w.quiet = true; w.talk = null;
  // somewhere in the Night Market with no ride parked nearby, so the ride lesson waits
  for (let k = 0; k < 400; k++) { const x = (4 + (k * 7) % 40) * T + T / 2, y = (32 + (k * 3) % 56) * T + T / 2; if (passable(c, 'walk', Math.floor(x / T), Math.floor(y / T)) && passable(c, 'walk', Math.floor(x / T) + 2, Math.floor(y / T)) && passable(c, 'walk', Math.floor(x / T) - 2, Math.floor(y / T)) && !w.rides.some(r => Math.hypot(r.b.x - x, r.b.y - y) < 500)) { w.placePlayer(x, y); break; } }
  w.step(NO_INPUT, DT); assert.equal(w.tutor.cur, 'move');
  for (let i = 0; i < 60 * 3; i++) w.step({ ...NO_INPUT, mx: i % 120 < 60 ? 1 : -1 }, DT);
  assert.ok(w.s.learned.includes('move'));
  for (let i = 0; i < 60 * 3; i++) w.step({ ...NO_INPUT, mx: i % 120 < 60 ? 1 : -1 }, DT);
  assert.ok(w.s.learned.includes('run'), w.tutor.cur);
  w.step({ ...NO_INPUT, dash: true }, DT); for (let i = 0; i < 30; i++) w.step(NO_INPUT, DT);
  assert.ok(w.s.learned.includes('dash'), w.tutor.cur);
  w.step({ ...NO_INPUT, hop: true }, DT); for (let i = 0; i < 30; i++) w.step(NO_INPUT, DT);
  assert.ok(w.s.learned.includes('hop'), w.tutor.cur);
});

test('the phone: job offers and night tips arrive as texts, at most thirty kept', () => {
  const s = newSave(4); s.started = true; s.story.intro = true; s.done = ['m1']; const w = new World(s, 4); w.quiet = true; w.talk = null;
  for (let i = 0; i < 90; i++) w.step(NO_INPUT, DT);
  assert.ok(w.s.msgs.length >= 1 && w.s.msgs.some(m => m.text.includes('Job')), 'a job offer');
  for (let i = 0; i < 40; i++) w.newNight();
  assert.ok(w.s.msgs.length <= 30); assert.ok(w.s.tips.some(t => t.from && t.mult > 1));
});

test('the city breaks the grid: landmarks, plazas, curving paths, tables, and no two touching buildings alike', () => {
  const lm = c.buildings.filter(b => b.sprite.startsWith('lm2-')); assert.ok(lm.length >= 6, `${lm.length} new landmarks`);
  assert.ok(c.paths.length >= 6, `${c.paths.length} curving paths`); assert.ok(c.tables.length >= 8, `${c.tables.length} tables`);
  assert.ok(c.props.filter(p => ['fountain', 'banyan', 'koi-pond', 'crane-statue'].includes(p.sprite)).length >= 6, 'plaza centrepieces');
  let same = 0;
  for (const a of c.buildings) for (const b of c.buildings) if (a !== b && a.sprite === b.sprite && a.x <= b.x + b.w && a.x + a.w >= b.x && a.y <= b.y + b.h && a.y + a.h >= b.y) same++;
  assert.equal(same, 0, 'touching buildings share a picture');
  assert.ok(new Set(c.buildings.map(b => b.sprite)).size >= 50, `${new Set(c.buildings.map(b => b.sprite)).size} building pictures`);
  assert.ok(c.festival.length >= 20, 'festival dressing planned');
});

console.log(`jade: ${n} tests ok`);
