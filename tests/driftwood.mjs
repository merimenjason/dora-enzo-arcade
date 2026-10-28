// Driftwood Post's engine: the polar curve, sailing downwind and tacking upwind, collisions (and no tunnelling at
// speed), currents, docking, the bag, parcels, express letters, scuffs and patching, the story's order, a flood fill
// proving every jetty, shell and bottle can be reached, the chart's bitset, saves (good and bad) and determinism.
import assert from 'node:assert/strict';
import {
  DriftwoodGame, polar, idealSheet, trimFactor, wrap, idleInput, packBits, unpackBits, readSave, freshSave, storyItem, expressLimit,
  ISLANDS, ISLAND, VILLAGES, ROCKS, STORY, SHELLS, BOTTLES, RESIDENTS, CURRENTS, clearance, insidePoly, currentAt,
  NO_GO, KEEL_NO_GO, BOAT_R, MAX_SPEED, DOCK_REACH, DOCK_SPEED, AUTO_DOCK, BAG, BAG_MAX, PATCH_TICKS, SCUFFS, HZ, GRAB, PAY,
  CHART_W, CHART_H, DAY_TICKS, MIN_PER_TICK, SHELL_VALUE, SIDE_FROM, PREVAIL, PREVAIL_SWING, START_MINUTE,
} from '../.checks/driftwood-game.js';
import { Helm, lineClear } from './driftwood-bot.mjs';

const DEG = Math.PI / 180;
let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('ok', name); };
/** A game with the wind held steady (blowing toward `dir`), for repeatable sailing checks. */
function steady(dir = 0, str = 0.85, seed = 7) {
  const g = new DriftwoodGame({ seed });
  g.weather = 'breeze'; g.weatherUntil = 1e12; g.wind.nextShift = 1e12; g.wind.dir = dir; g.wind.toDir = dir; g.wind.nextDir = dir; g.wind.str = str;
  g.castOff(); g.events.length = 0;
  return g;
}
const place = (g, x, y, h, v = 0) => { Object.assign(g.boat, { x, y, h, v, vx: 0, vy: 0, bx: 0, by: 0 }); };
/** A stretch of open water: a horizontal line `len` long with plenty of room all along it, away from currents. */
function openLine(len) {
  for (let y = 300; y < 2800; y += 20) for (let x = 200; x < 3800 - len; x += 20) {
    if (!lineClear(x, y, x + len, y, 140)) continue;
    let calm = true; for (let k = 0; k <= 10; k++) { const [cx, cy] = currentAt(x + (len * k) / 10, y); if (Math.hypot(cx, cy) > 0.01) calm = false; }
    if (calm) return [x, y];
  }
  throw new Error('no open water');
}

test('the polar curve: nothing in the no-go zone, a peak on a beam reach', () => {
  for (const a of [0, 10, 30, 41]) assert.equal(polar(a * DEG), 0, `${a}° is in irons`);
  assert.ok(polar(-60 * DEG) > 0 && polar(-60 * DEG) === polar(60 * DEG), 'symmetrical about the wind');
  assert.ok(Math.abs(polar(90 * DEG) - 1) < 1e-9, 'full speed on a beam reach');
  let peak = 0, at = 0; for (let a = 0; a <= 180; a++) { const p = polar(a * DEG); if (p > peak) { peak = p; at = a; } }
  assert.equal(at, 90, 'the best angle is the beam reach');
  assert.ok(polar(55 * DEG) > 0.6 && polar(55 * DEG) < polar(75 * DEG), 'close-hauled is slower than a close reach');
  assert.ok(polar(180 * DEG) > 0.55 && polar(180 * DEG) < polar(130 * DEG), 'dead downwind is slower than a broad reach');
  assert.equal(polar(38 * DEG), 0); assert.ok(polar(38 * DEG, KEEL_NO_GO) > 0, 'the keel points higher');
  assert.ok(idealSheet(50 * DEG) < idealSheet(90 * DEG) && idealSheet(90 * DEG) < idealSheet(170 * DEG), 'ease the sheet as you bear away');
  assert.ok(trimFactor(0) > 1 && trimFactor(0.4) < 0.75, 'manual trim rewards the sweet spot');
});

test('downwind: the boat runs straight to a target', () => {
  const [x, y] = openLine(700), g = steady(0); place(g, x, y, 0);
  const helm = new Helm(x + 650, y), inp = idleInput();
  let t = 0; for (; t < 40 * HZ; t++) { if (helm.drive(g, inp) < 40) break; g.step(inp); }
  assert.ok(t < 15 * HZ, `downwind 650 units in under 15 s (${(t / HZ).toFixed(1)} s)`);
  assert.equal(g.stats.tacks, 0, 'no tacking needed');
});

test('upwind: pointing straight at the wind goes nowhere, tacking gets there', () => {
  const [x, y] = openLine(700);
  const naive = steady(0); place(naive, x + 650, y, Math.PI, 0.5);
  for (let t = 0; t < 20 * HZ; t++) naive.step({ steer: wrap(Math.PI - naive.boat.h) * 3, trim: null, anchor: false, dock: false });
  assert.ok(naive.boat.x > x + 600, `head to wind, the boat stalls and drifts back (${Math.round(x + 650 - naive.boat.x)} units made good)`);
  const g = steady(0); place(g, x + 650, y, Math.PI / 2);
  const helm = new Helm(x + 50, y), inp = idleInput();
  let t = 0; for (; t < 90 * HZ; t++) { if (helm.drive(g, inp) < 50) break; g.step(inp); }
  assert.ok(t < 60 * HZ, `upwind 600 units by tacking in under a minute (${(t / HZ).toFixed(1)} s)`);
  assert.ok(g.stats.tacks >= 2, `it tacked (${g.stats.tacks} tacks)`);
});

test('tacking costs speed but the boat carries its way through', () => {
  const [x, y] = openLine(600), g = steady(0); place(g, x + 300, y, Math.PI - 55 * DEG, 0);
  for (let t = 0; t < 8 * HZ; t++) g.step(idleInput());
  const v0 = g.boat.v, inp = { steer: 1, trim: null, anchor: false, dock: false };
  let low = v0, tacked = false;
  for (let t = 0; t < 4 * HZ && !tacked; t++) { g.step(inp); low = Math.min(low, g.boat.v); tacked = g.events.some((e) => e.k === 'tack'); }
  for (let t = 0; t < 2 * HZ && Math.abs(wrap(g.boat.h - (Math.PI + 55 * DEG))) > 0.05; t++) { g.step(inp); low = Math.min(low, g.boat.v); }
  assert.ok(tacked, 'the tack is noticed');
  assert.ok(low < v0 * 0.85 && low > v0 * 0.25, `speed drops through the tack but not to nothing (${v0.toFixed(2)} → ${low.toFixed(2)})`);
});

test('the rudder turns harder at speed, and steering works from a standstill', () => {
  const [x, y] = openLine(600), a = steady(0), b = steady(0);
  place(a, x + 300, y, Math.PI / 2, 0); place(b, x + 300, y, Math.PI / 2, MAX_SPEED * 0.8);
  a.step({ steer: 1, trim: null, anchor: false, dock: false }); b.step({ steer: 1, trim: null, anchor: false, dock: false });
  assert.ok(a.boat.turn > 0 && b.boat.turn > a.boat.turn * 1.8, `turn rate stopped ${a.boat.turn.toFixed(3)}, at speed ${b.boat.turn.toFixed(3)}`);
});

test('collisions: the boat never ends a tick inside a coast or a rock, even sailing wildly in a squall', () => {
  for (const seed of [1, 2, 3, 4]) {
    const g = new DriftwoodGame({ seed }); g.ups.sail = 2; g.weather = 'squall'; g.wind.str = 1.4; g.castOff();
    let r = seed * 99991, steer = 0;
    const rand = () => { r = (Math.imul(r, 1103515245) + 12345) >>> 0; return r / 4294967296; };
    for (let t = 0; t < 30000; t++) {
      if (t % 40 === 0) steer = rand() < 0.3 ? 0 : rand() * 2 - 1;
      if (g.phase === 'patch') { g.step(idleInput()); continue; }
      if (g.phase === 'dock') { g.castOff(); continue; }
      g.step({ steer, trim: null, anchor: false, dock: false });
      const { x, y } = g.boat;
      assert.ok(Number.isFinite(x) && Number.isFinite(y), 'finite position');
      for (const isl of ISLANDS) assert.ok(!insidePoly(isl.poly, x, y), `seed ${seed} tick ${t}: inside ${isl.name}`);
      for (const k of ROCKS) assert.ok(Math.hypot(x - k.x, y - k.y) >= k.r + BOAT_R - 0.5, `seed ${seed} tick ${t}: inside a rock`);
      assert.ok(clearance(x, y) > BOAT_R - 1.5, `seed ${seed} tick ${t}: overlapping something (${clearance(x, y).toFixed(1)})`);
    }
    assert.ok(g.stats.bumps > 0, 'wild sailing bumps into things');
  }
});

test('no tunnelling: even absurd speed straight at a small rock bounces off it', () => {
  const rock = ROCKS.reduce((a, b) => (b.r < a.r ? b : a));
  for (const a of [0, 0.7, 1.6, 3, 4.4]) {
    const g = steady(0); g.wind.str = 1.4;
    place(g, rock.x - Math.cos(a) * 200, rock.y - Math.sin(a) * 200, a, 20);
    for (let t = 0; t < 30; t++) {
      g.boat.v = Math.max(g.boat.v, 20); g.step(idleInput());
      assert.ok(Math.hypot(g.boat.x - rock.x, g.boat.y - rock.y) >= rock.r + BOAT_R - 0.5, `through the rock at angle ${a}`);
    }
  }
});

test('currents add drift; reeds slow the boat', () => {
  const c = CURRENTS[0], [ax, ay] = c.pts[2], [bx, by] = c.pts[3], mx = (ax + bx) / 2, my = (ay + by) / 2;
  const [cx, cy] = currentAt(mx, my); assert.ok(Math.hypot(cx, cy) > 0.8, 'the Long Current runs strong mid-stream');
  // a boat stopped head to wind in the current drifts along it, far more than leeway alone would carry it
  const g = steady(Math.PI / 2, 0.5); place(g, mx, my, -Math.PI / 2, 0);
  const still = steady(Math.PI / 2, 0.5); const [ox, oy] = openLine(400); place(still, ox + 200, oy, -Math.PI / 2, 0);
  for (let t = 0; t < 60; t++) { g.step(idleInput()); still.step(idleInput()); }
  const along = ((g.boat.x - mx) * cx + (g.boat.y - my) * cy) / Math.hypot(cx, cy);
  assert.ok(along > 40, `drifted ${along.toFixed(0)} units downstream in 2 s`);
  assert.ok(Math.abs(still.boat.x - (ox + 200)) < 5, 'out of the current there is no sideways drift on a still boat pointing up');
  const reed = { x: 2390, y: 2230 }, r = steady(-Math.PI / 2), o = steady(-Math.PI / 2);
  place(r, reed.x, reed.y, 0, 0); place(o, ox + 100, oy, 0, 0);
  for (let t = 0; t < 4 * HZ; t++) { r.step(idleInput()); o.step(idleInput()); }
  assert.ok(r.boat.inReeds && r.boat.v < o.boat.v * 0.5, `reeds slow the boat (${r.boat.v.toFixed(2)} vs ${o.boat.v.toFixed(2)})`);
});

test('docking: ask near the jetty, slowly; too fast brakes first; too far does nothing; drifting in ties up', () => {
  const g = steady(0), d = ISLAND.lighthouse.dock;
  place(g, d.x + 300, d.y - 300, 0, 2); g.step({ steer: 0, trim: null, anchor: false, dock: true });
  assert.equal(g.phase, 'sail', 'out of reach, Dock does nothing');
  place(g, d.x + Math.cos(d.a) * 60, d.y + Math.sin(d.a) * 60, d.a + Math.PI, 2.5);
  g.step({ steer: 0, trim: null, anchor: false, dock: true });
  assert.equal(g.phase, 'sail', 'too fast to tie up at once');
  assert.ok(g.boat.braking, 'asking to dock while too fast brakes');
  let t = 0; for (; t < 60 && g.phase === 'sail'; t++) { place(g, d.x + Math.cos(d.a) * 60, d.y + Math.sin(d.a) * 60, g.boat.h, g.boat.v); g.step({ steer: 0, trim: null, anchor: false, dock: true }); }
  assert.equal(g.phase, 'dock'); assert.equal(g.at, 'lighthouse'); assert.ok(t < 30, `docked after braking (${t} ticks)`);
  assert.ok(g.events.some((e) => e.k === 'dock' && e.id === 'lighthouse'));
  // drifting in slowly ties up by itself, but not straight after casting off from the same jetty
  g.castOff(); place(g, d.x, d.y, g.boat.h, 0); g.step(idleInput());
  assert.equal(g.phase, 'sail', 'casting off does not tie straight back up');
  place(g, d.x + 400, d.y, 0, 0); g.step(idleInput()); place(g, d.x + 10, d.y, 0, 0.1); g.boat.vx = 0; g.step({ steer: 0, trim: null, anchor: true, dock: false });
  assert.equal(g.phase, 'dock', 'drifting slowly onto the jetty ties up');
  assert.ok(AUTO_DOCK < DOCK_REACH && DOCK_SPEED > 0);
});

test('the bag: three slots, crates add more up to six; post for here is handed over', () => {
  const g = new DriftwoodGame({ seed: 3 });
  assert.equal(g.phase, 'dock'); assert.equal(g.at, 'home');
  const w = g.waiting('home'); assert.equal(w.length, 1); assert.equal(w[0].story, 1);
  assert.ok(g.pickUp(w[0].id)); assert.ok(g.known.has('lighthouse'), 'the destination appears on the chart');
  assert.ok(g.events.some((e) => e.k === 'unlock' && e.id === 'lighthouse'));
  assert.equal(g.pickUp(w[0].id), false, 'no picking up twice');
  g.side.home = { ...storyItem(STORY[1]), id: 'side-1', story: 0, from: 'home', to: 'bakery' };
  g.bag.push({ ...g.side.home, id: 'side-x' }, { ...g.side.home, id: 'side-y' });
  assert.equal(g.bag.length, BAG); assert.equal(g.pickUp('side-1'), false, 'a full bag takes no more');
  g.ups.crates = 3; assert.equal(g.capacity, BAG_MAX); g.ups.crates = 9; assert.equal(g.capacity, BAG_MAX);
  g.ups.crates = 0; g.bag.length = 1;
  g.castOff(); g.dockAt('lighthouse');
  assert.equal(g.forHere().length, 1); const before = g.shells, pay = g.deliver(g.forHere()[0].id);
  assert.equal(pay, PAY.letter); assert.equal(g.shells, before + pay); assert.ok(g.done.has(1));
  assert.equal(g.waiting('lighthouse')[0]?.story, 2, 'Pip writes back at once');
});

test('parcels: heavy ones slow the boat, fragile ones are jostled by bumps (unless the hull is sturdy)', () => {
  const [x, y] = openLine(700), light = steady(-Math.PI / 2), heavy = steady(-Math.PI / 2);
  place(light, x, y, 0, 0); place(heavy, x, y, 0, 0);
  const cake = storyItem(STORY.find((d) => d.n === 23)); heavy.bag.push({ ...cake }, { ...storyItem(STORY.find((d) => d.n === 5)) });
  for (let t = 0; t < 6 * HZ; t++) { light.step(idleInput()); heavy.step(idleInput()); }
  assert.ok(heavy.boat.v < light.boat.v * 0.9, `two heavy parcels slow the boat (${heavy.boat.v.toFixed(2)} vs ${light.boat.v.toFixed(2)})`);
  const rock = ROCKS[0];
  const ram = (g) => { place(g, rock.x - 120, rock.y, 0, 3); g.boat.h = 0; for (let t = 0; t < 40; t++) g.step(idleInput()); };
  const g = steady(-Math.PI / 2); g.bag.push({ ...cake }); ram(g);
  assert.ok(g.stats.bumps >= 1 && g.scuffs === 1, `a hard bump scuffs (${g.stats.bumps} bumps, ${g.scuffs} scuffs)`);
  assert.ok(g.bag[0].jostled, 'the cake is jostled');
  const s = steady(-Math.PI / 2); s.ups.hull = 1; s.bag.push({ ...cake }); ram(s);
  assert.ok(s.stats.bumps >= 1 && s.scuffs === 0 && !s.bag[0].jostled, 'the sturdy hull shrugs it off');
  // delivering: an intact fragile parcel earns its bonus, a jostled one doesn't
  const a = new DriftwoodGame(); a.castOff(); a.bag.push({ ...cake }); a.dockAt('lighthouse');
  const b = new DriftwoodGame(); b.castOff(); b.bag.push({ ...cake, jostled: true }); b.dockAt('lighthouse');
  assert.equal(a.deliver(cake.id) - b.deliver(cake.id), PAY.intact);
});

test('three scuffs and Enzo patches the boat; docking mends it too', () => {
  const g = steady(-Math.PI / 2), rock = ROCKS[0];
  for (let n = 0; n < SCUFFS && g.phase === 'sail'; n++) { place(g, rock.x - 120, rock.y, 0, 3); g.lastScuff = -999; for (let t = 0; t < 40 && g.phase === 'sail'; t++) g.step(idleInput()); }
  assert.equal(g.phase, 'patch'); assert.ok(g.events.some((e) => e.k === 'patch'));
  for (let t = 0; t < PATCH_TICKS + 2; t++) g.step({ steer: 1, trim: null, anchor: false, dock: false });
  assert.equal(g.phase, 'sail'); assert.equal(g.scuffs, 0);
  const h = steady(-Math.PI / 2); h.scuffs = 2; h.dockAt('market'); assert.equal(h.scuffs, 0);
});

test('express letters: on time earns a bonus, late does not', () => {
  const d = STORY.find((s) => s.express), lim = expressLimit(d.from, d.to);
  assert.ok(lim >= 60 && lim <= 400, `a sensible time limit (${lim} minutes)`);
  const run = (late) => {
    const g = new DriftwoodGame(); g.castOff(); g.dockAt(d.from);
    for (const n of d.need) g.done.add(n); for (const n of STORY.filter((s) => s.n < d.n).map((s) => s.n)) g.done.add(n);
    const it = g.waiting(d.from).find((i) => i.story === d.n); assert.ok(it, 'the express letter waits');
    assert.ok(g.pickUp(it.id)); assert.equal(g.bag[0].due, g.minute + lim);
    g.castOff(); g.events.length = 0;
    const ticks = Math.round((late ? lim + 5 : lim - 5) / MIN_PER_TICK);
    for (let t = 0; t < ticks; t++) g.step({ steer: 0, trim: null, anchor: true, dock: false });
    if (late) assert.ok(g.events.some((e) => e.k === 'late'), 'a late letter is noticed');
    g.dockAt(d.to); return g.deliver(it.id);
  };
  assert.equal(run(false) - run(true), PAY.express);
});

test('the story: every letter is written from a known island, needs only earlier letters, and visits every village', () => {
  assert.equal(STORY.length, 24);
  const known = new Set(['home']), villages = new Set();
  for (const d of STORY) {
    assert.ok(d.need.every((n) => n < d.n), `story ${d.n} needs only earlier letters`);
    assert.ok(ISLAND[d.from].dock && ISLAND[d.to].dock && d.from !== d.to, `story ${d.n} runs between two villages`);
    assert.ok(known.has(d.from), `story ${d.n} starts at an island already on the chart (${d.from})`);
    assert.ok(RESIDENTS[d.sender] && RESIDENTS[d.recipient], `story ${d.n} has real people`);
    const lines = d.text.split('\n').length; assert.ok(lines >= 2 && lines <= 6 && d.text.length < 360, `story ${d.n} is short (${d.text.length} chars)`);
    known.add(d.to); villages.add(d.from); villages.add(d.to);
  }
  assert.deepEqual([...villages].sort(), [...VILLAGES].sort(), 'every village takes part');
  // and the engine agrees: carrying each letter in order, the next one is always waiting where it should be
  const g = new DriftwoodGame({ seed: 5 });
  for (const d of STORY) {
    g.castOff(); g.dockAt(d.from);
    const it = g.waiting(d.from).find((i) => i.story === d.n); assert.ok(it, `story ${d.n} waits at ${d.from}`);
    assert.ok(g.pickUp(it.id)); g.castOff(); g.dockAt(d.to); assert.ok(g.deliver(it.id) > 0);
  }
  assert.equal(g.regatta, 1, 'the last letter calls everyone to the regatta');
  assert.ok(g.clock >= 18 * 60 + 30 || g.clock < 5 * 60, 'dusk falls');
  g.castOff(); g.dockAt('lighthouse'); assert.equal(g.phase, 'ending'); assert.equal(g.regatta, 2);
  assert.ok(g.sailOn() && g.phase === 'dock', 'and the lake carries on afterwards');
});

test('side deliveries appear between story letters, between known villages', () => {
  const g = new DriftwoodGame({ seed: 11 });
  for (const d of STORY.slice(0, SIDE_FROM)) { g.castOff(); g.dockAt(d.from); const it = g.waiting(d.from).find((i) => i.story === d.n); g.pickUp(it.id); g.castOff(); g.dockAt(d.to); g.deliver(it.id); }
  let offered = 0;
  for (let k = 0; k < 20; k++) for (const id of VILLAGES) { g.castOff(); g.dockAt(id); const s = g.side[id]; if (s) { offered++; assert.ok(g.known.has(s.to) && s.to !== id && !s.text.includes('{')); delete g.side[id]; } }
  assert.ok(offered > 20, `side post turns up (${offered})`);
});

test('every jetty, hidden shell and bottle can be reached from home (flood fill)', () => {
  const C = 20, W = 4000 / C, H = 3000 / C, open = new Uint8Array(W * H), seen = new Uint8Array(W * H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) open[j * W + i] = clearance((i + 0.5) * C, (j + 0.5) * C) > BOAT_R + 1 ? 1 : 0;
  const home = ISLAND.home.dock, s = Math.floor(home.y / C) * W + Math.floor(home.x / C);
  assert.ok(open[s], 'home’s jetty is in open water');
  const q = [s]; seen[s] = 1;
  while (q.length) { const k = q.pop(), i = k % W, j = (k - i) / W; for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= W || b >= H) continue; const n = b * W + a; if (open[n] && !seen[n]) { seen[n] = 1; q.push(n); } } }
  const reachable = (x, y, r) => { for (let j = Math.floor((y - r) / C); j <= Math.floor((y + r) / C); j++) for (let i = Math.floor((x - r) / C); i <= Math.floor((x + r) / C); i++) if (i >= 0 && j >= 0 && i < W && j < H && seen[j * W + i] && Math.hypot((i + 0.5) * C - x, (j + 0.5) * C - y) < r) return true; return false; };
  for (const id of VILLAGES) { const d = ISLAND[id].dock; assert.ok(reachable(d.x, d.y, 20), `${id}’s jetty is reachable`); assert.ok(clearance(d.x, d.y) > 40, `${id}’s jetty has room`); }
  assert.equal(SHELLS.length, 20); assert.ok(BOTTLES.length >= 5);
  SHELLS.forEach(([x, y], i) => { assert.ok(clearance(x, y) > 0, `shell ${i} is in water`); assert.ok(reachable(x, y, GRAB - 6), `shell ${i} at ${x},${y} is reachable`); });
  BOTTLES.forEach((b, i) => assert.ok(reachable(b.x, b.y, GRAB - 6), `bottle ${i} is reachable`));
});

test('shells and bottles are picked up by sailing over them', () => {
  const g = steady(0), [x, y] = SHELLS[0]; place(g, x - 10, y, 0, 0); g.step(idleInput());
  assert.equal(g.found[0], 1); assert.equal(g.shells, SHELL_VALUE); assert.ok(g.events.some((e) => e.k === 'shell' && e.i === 0));
  g.step(idleInput()); assert.equal(g.shells, SHELL_VALUE, 'only once');
  const b = BOTTLES[0]; place(g, b.x, b.y, 0, 0); g.step(idleInput()); assert.equal(g.bottles[0], 1);
});

test('the chart: revealed around the boat, packed into a short string and back', () => {
  const g = steady(0); const before = g.chart.reduce((a, b) => a + b, 0);
  place(g, 2000, 1000, 0, 0); for (let t = 0; t < 10; t++) g.step({ steer: 0, trim: null, anchor: true, dock: false });
  assert.ok(g.chart.reduce((a, b) => a + b, 0) > before, 'sailing somewhere new reveals the chart');
  const bits = new Uint8Array(CHART_W * CHART_H); let r = 9; for (let i = 0; i < bits.length; i++) { r = (Math.imul(r, 1103515245) + 12345) >>> 0; bits[i] = r >>> 31; }
  const s = packBits(bits); assert.ok(s.length <= Math.ceil(bits.length / 6)); assert.deepEqual(unpackBits(s, bits.length), bits);
  assert.deepEqual(unpackBits('n*', 12), new Uint8Array(12)); assert.deepEqual(unpackBits(42, 12), new Uint8Array(12));
  assert.ok(g.seen.has('home'), 'home is seen from the start');
});

test('saving: a round trip keeps the voyage; bad data loads safely', () => {
  const g = new DriftwoodGame({ seed: 21 });
  g.pickUpAll(); g.castOff();
  for (let t = 0; t < 600; t++) g.step({ steer: Math.sin(t / 50), trim: null, anchor: false, dock: false });
  g.shells = 42; g.ups.sail = 1; g.found[3] = 1; g.dockAt('lighthouse'); g.deliverAll(); g.pickUpAll();
  const save = { ...freshSave(), voyage: g.toVoyage() }; save.settings.manualTrim = true;
  const back = readSave(JSON.stringify(save)), h = DriftwoodGame.fromVoyage(back.voyage);
  assert.ok(back.settings.manualTrim && h);
  assert.equal(h.at, 'lighthouse'); assert.equal(h.phase, 'dock'); assert.equal(h.shells, g.shells); assert.deepEqual(h.ups, g.ups);
  assert.deepEqual([...h.done], [...g.done]); assert.deepEqual(h.bag.map((i) => i.id), g.bag.map((i) => i.id));
  assert.deepEqual(h.chart, g.chart); assert.deepEqual(h.found, g.found); assert.equal(h.minute, g.minute); assert.equal(h.rng, g.rng);
  // and both carry on identically
  for (const x of [g, h]) { x.castOff(); for (let t = 0; t < 900; t++) x.step({ steer: 0.3, trim: null, anchor: false, dock: false }); }
  assert.equal(h.hash(), g.hash(), 'a loaded voyage replays exactly');
  // bad data
  for (const raw of [null, '', 'garbage{', '[]', '{"v":2,"voyage":{}}', '{"v":1,"voyage":"x"}', '{"v":1,"voyage":{"at":"atlantis","shells":-5,"bag":[1,{"story":999},{"id":"side-1","from":"home","to":"home"}],"done":[1,"2",99],"ups":{"sail":99},"chart":"%%%","minute":"noon","wind":{"dir":"north"}}}']) {
    const s = readSave(raw); assert.equal(s.v, 1);
    if (s.voyage) {
      const x = DriftwoodGame.fromVoyage(s.voyage); assert.ok(x);
      assert.equal(x.at, 'home'); assert.ok(x.shells >= 0 && x.ups.sail <= 2 && x.bag.length === 0); assert.deepEqual([...x.done], [1]);
      assert.ok(Number.isFinite(x.minute) && Number.isFinite(x.wind.dir));
      x.castOff(); for (let t = 0; t < 100; t++) x.step(idleInput()); assert.ok(Number.isFinite(x.boat.x));
    }
  }
  assert.equal(DriftwoodGame.fromVoyage(null), null); assert.equal(DriftwoodGame.fromVoyage([1, 2]), null);
  const nan = readSave(JSON.stringify({ v: 1, voyage: { ...g.toVoyage(), minute: null, tick: -4, shells: 1e99 } }));
  const y = DriftwoodGame.fromVoyage(nan.voyage); assert.equal(y.minute, START_MINUTE); assert.equal(y.tick, 0); assert.ok(y.shells <= 1e6);
});

test('determinism: the same seed and inputs give the same voyage; the weather changes with the seed', () => {
  const run = (seed) => {
    const g = new DriftwoodGame({ seed }); g.pickUpAll(); g.castOff();
    const helm = new Helm(ISLAND.lighthouse.dock.x, ISLAND.lighthouse.dock.y, { dock: true }), inp = idleInput(), winds = [];
    for (let t = 0; t < 12000; t++) { if (g.phase === 'dock') { g.deliverAll(); g.pickUpAll(); g.castOff(); } if (g.phase === 'sail') helm.drive(g, inp); g.step(inp); if (t % 1000 === 0) winds.push(g.weather + Math.round(g.wind.dir * 100)); }
    return [g.hash(), winds.join(',')];
  };
  assert.deepEqual(run(4), run(4));
  assert.notEqual(run(4)[1], run(5)[1], 'a different seed brings different weather');
});

test('the weather: shifts within the prevailing swing, strength stays sensible, squalls happen', () => {
  const g = new DriftwoodGame({ seed: 8 }), [x, y] = openLine(400); g.castOff();
  const kinds = new Set(); let lo = 9, hi = 0;
  for (let t = 0; t < DAY_TICKS * 3; t++) {
    place(g, x + 200, y, g.boat.h, 0);
    g.step({ steer: 0, trim: null, anchor: true, dock: false });
    assert.equal(g.phase, 'sail');
    kinds.add(g.weather); lo = Math.min(lo, g.windStr); hi = Math.max(hi, g.windStr);
    assert.ok(Math.abs(wrap(g.wind.dir - PREVAIL)) <= PREVAIL_SWING + 0.15, 'the wind stays in its range');
  }
  assert.ok(kinds.size >= 3, `several kinds of weather over three days (${[...kinds]})`);
  assert.ok(lo > 0.35 && hi < 1.7, `wind strength ${lo.toFixed(2)} to ${hi.toFixed(2)}`);
  assert.ok(g.day >= 4 && g.day <= 4, 'three days have passed');
  assert.ok(Number.isFinite(g.sight) && g.sight > 100);
});

test('the lantern sees further at night; fog shrinks the view', () => {
  const g = steady(0); g.minute = 23 * 60; place(g, 1900, 1700, 0, 0);
  const plain = g.sight; g.ups.lantern = 1; assert.ok(g.sight > plain * 1.4, 'the lantern lights the night');
  g.minute = 12 * 60; g.ups.lantern = 0; const day = g.sight; place(g, 2720, 560, 0, 0); assert.ok(g.sight < day * 0.6, 'fog closes in');
});

test('the boatyard sells upgrades once Tamsin has her letter, for shells', () => {
  const g = new DriftwoodGame(); g.castOff(); g.dockAt('boatyard'); g.shells = 500;
  assert.equal(g.canBuy('sail'), 'closed'); g.done.add(4);
  assert.ok(g.buy('sail') && g.buy('sail')); assert.equal(g.canBuy('sail'), 'max'); assert.equal(g.shells, 500 - 90);
  g.shells = 0; assert.equal(g.canBuy('keel'), 'shells');
  g.castOff(); g.shells = 999; assert.equal(g.canBuy('keel'), 'closed', 'only at the boatyard');
});

console.log(`Passed: ${passed} Driftwood Post checks.`);
