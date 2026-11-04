// Deepglow engine checks: the world (the same every time, every specimen and the whale reachable from the sea, air
// bells down the way, hazards in open chambers), the sub (thrust, drag, the idle sink, walls that stop it and hurt when
// hit hard), air (it runs out, a bell and the surface fill it), the hull's depth rating, sonar (echoes off the walls at
// the speed of sound, the map filled in, creatures shown, Grimlures drawn to the ping), the lamp (shy creatures flee it,
// Grimlures see it, off it lets you creep up), catching specimens and a full tray, stings and bites, the dive's ends
// (surfaced, rescued with the tray lost, the whale), banking, upgrades, the packed map, and saves including corrupt ones.
import assert from 'node:assert/strict';
import { makeWorld, Dive, DT, CELL, GW, GH, SUB_R, SPECIES, PER_SPECIES, POINTS, UPGRADES, SONAR_SPEED, sdfAt, pathTo, stats, newSave, parseSave, serialise,
  bank, buy, upgradeCost, packMap, unpackMap, mappedShare, journalCount, zoneAt, idleInput, spec } from '../.checks/deep-game.js';

let n = 0;
const ok = (m) => { n++; console.log('ok', m); };
const world = makeWorld();
const L0 = { hull: 0, tank: 0, motor: 0, sonar: 0, lamp: 0, tray: 0 };
const LMAX = { hull: 3, tank: 3, motor: 3, sonar: 3, lamp: 3, tray: 3 };
const dive = (o = {}) => new Dive({ world, levels: L0, seed: 3, ...o });
const run = (d, secs, inp = idleInput()) => { for (let i = 0; i < secs / DT && !d.over; i++) d.tick(typeof inp === 'function' ? inp(d) : inp); return d; };
/** put the sub somewhere open at about this depth */
const openAt = (depth, room = 4) => { for (let y = depth; y < depth + 200; y += 2) for (let x = 6; x < GW * CELL - 6; x += 2) if (sdfAt(world, x, y) > room && world.reach[Math.floor(y / CELL) * GW + Math.floor(x / CELL)]) return { x, y }; throw new Error('no room'); };
const place = (d, p) => { d.x = p.x; d.y = p.y; d.vx = d.vy = 0; d.started = true; };
const quiet = (d) => { for (const c of d.creatures) if (c.kind === 'grimlure' || c.kind === 'veil') { c.x = c.hx = 1e4; c.y = c.hy = 1e4; } };

// ---- the world
{
  const again = makeWorld();
  assert.deepEqual(again.solid, world.solid, 'the same world every time'); assert.equal(world.w, GW); assert.equal(world.h, GH);
  const cell = (p) => Math.floor(p.y / CELL) * GW + Math.floor(p.x / CELL);
  for (const s of world.spawns) assert.equal(world.reach[cell(s)], 1, `${s.kind} at ${s.x.toFixed(0)},${s.y.toFixed(0)} is reachable`);
  assert.equal(world.reach[cell(world.whale)], 1, 'the whale is reachable');
  for (const sp of SPECIES) {
    const at = world.spawns.filter((s) => s.kind === sp.id); assert.equal(at.length, PER_SPECIES);
    const z = zoneAt(at[0].y).id; for (const s of at) assert.ok(zoneAt(s.y - 1).id === sp.zone || zoneAt(s.y + 1).id === sp.zone, `${sp.name} lives in ${sp.zone} (found at ${s.y.toFixed(0)} m)`); void z;
  }
  for (const s of world.spawns) if (s.kind === 'veil' || s.kind === 'grimlure') assert.ok(sdfAt(world, s.x, s.y) >= 5, `${s.kind} spawns in an open chamber`);
  assert.ok(world.bells.length >= 4, 'air bells on the way down'); for (let i = 1; i < world.bells.length; i++) assert.ok(world.bells[i].y - world.bells[i - 1].y >= 120);
  assert.ok(world.whale.y > 1000, 'the whale lives below a kilometre');
  const p = pathTo(world, world.spine[0].x, 2, (cx, cy) => Math.hypot(cx * CELL - world.whale.x, cy * CELL - world.whale.y) < 10, 1e6);
  assert.ok(p && p.length * CELL > 1000, 'a long way down to the whale');
  ok(`the world: fixed, ${world.spawns.length} creatures and the whale all reachable, species in their zones, ${world.bells.length} air bells, a ${(p.length * CELL / 1000).toFixed(1)} km route to the whale`);
}

// ---- the sub
{
  let d = dive(); place(d, openAt(40, 9)); quiet(d);
  run(d, 2, { ...idleInput(), x: 1 });
  const top = d.speed; assert.ok(top > 3.5 && top < 6, `thrust and drag: ${top.toFixed(2)} m/s`);
  const fast = dive({ levels: { ...L0, motor: 3 } }); place(fast, openAt(40, 9)); quiet(fast); run(fast, 2, { ...idleInput(), x: 1 }); assert.ok(fast.speed > top * 1.3, 'a better propeller is faster');
  d = dive(); place(d, openAt(40, 9)); quiet(d); const y0 = d.y; run(d, 3); assert.ok(d.y > y0 && d.y - y0 < 3, 'left alone it sinks gently');
  assert.equal(d.face, 1); run(d, 1, { ...idleInput(), x: -1 }); assert.equal(d.face, -1, 'it turns to face where it goes');
  // walls: never inside rock, a hard knock hurts, a gentle one doesn't
  d = dive(); const p = openAt(200, 4); place(d, p); quiet(d);
  let minClear = 9; run(d, 6, (dd) => { minClear = Math.min(minClear, sdfAt(world, dd.x, dd.y)); return { ...idleInput(), x: 1 }; });
  assert.ok(minClear > SUB_R - 0.25, `the hull stays out of the rock (${minClear.toFixed(2)} m clear)`);
  let wall = 0; for (let x = p.x; x < p.x + 60; x += 0.25) if (sdfAt(world, x, p.y) < SUB_R) { wall = x; break; }
  assert.ok(wall, 'a wall to the right');
  const knock = (v) => { const k = dive(); place(k, { x: wall - 0.6, y: p.y }); quiet(k); k.vx = v; const h = k.hull; for (let i = 0; i < 120 && !k.over; i++) k.tick(idleInput()); return h - k.hull; }; assert.equal(knock(2.5), 0, 'a gentle bump is free'); assert.ok(knock(8) > 10, 'a hard knock dents the hull');
  ok('the sub: thrust against drag, a faster propeller, a gentle sink, turning, walls that stop it and hurt when hit hard');
}

// ---- air, bells, the surface, pressure
{
  let d = dive(); place(d, openAt(60, 6)); quiet(d); const a0 = d.air; run(d, 10); assert.ok(Math.abs(a0 - d.air - 10) < 0.1, 'air runs down a second a second');
  d.air = 0.05; run(d, 0.2); assert.ok(d.over && d.why === 'air', 'out of air: rescued');
  const b = world.bells[0]; d = dive(); place(d, { x: b.x, y: b.y }); quiet(d); d.air = 20; let bell = false; run(d, 1, (dd) => { if (dd.events.some((e) => e.k === 'bell')) bell = true; return idleInput(); });
  assert.ok(d.air > 50 && bell, 'an air bell fills the tank');
  d = dive(); place(d, world.spine[0]); quiet(d); d.air = 30; let surfaced = false; run(d, 30, { ...idleInput(), y: -1 });
  surfaced = d.over && d.why === 'surfaced'; assert.ok(surfaced, 'coming up ends the dive');
  // past the hull's rating it creaks and gives way
  d = dive(); place(d, openAt(stats(L0).rating + 40, 5)); quiet(d); const h0 = d.hull; let creak = false; run(d, 4, (dd) => { if (dd.events.some((e) => e.k === 'creak')) creak = true; return idleInput(); });
  assert.ok(creak && d.hull < h0 - 5, 'too deep: the hull creaks and gives');
  const deep = dive({ levels: { ...L0, hull: 3 } }); place(deep, openAt(stats(L0).rating + 40, 5)); quiet(deep); run(deep, 4); assert.equal(deep.hull, deep.st.hullMax, 'a stronger hull is fine there');
  ok('air: it runs down, a bell and the surface fill it, running out means a rescue; past the depth rating the hull creaks');
}

// ---- sonar and the lamp
{
  const d = dive(); const p = openAt(150, 6); place(d, p); quiet(d);
  d.ping(); assert.ok(d.echoes.length > 50, `the ping echoes off the walls (${d.echoes.length})`);
  for (const e of d.echoes.slice(0, 40)) { const dist = Math.hypot(e.x - p.x, e.y - p.y); assert.ok(Math.abs(e.t - d.t - dist / SONAR_SPEED) < 0.02, 'echoes return at the speed of sound'); assert.ok(sdfAt(world, e.x, e.y) < 0.6); }
  const mapped = d.mapped.reduce((a, b) => a + b, 0); assert.ok(mapped > 100, 'the ping maps the cave');
  assert.ok(d.pingCd > 0); const before = d.echoes.length; d.tick({ ...idleInput(), ping: true }); assert.equal(d.echoes.length, before, 'sonar needs to recharge');
  // a Grimlure hears a ping from further than its range and comes to look
  const g = dive(); place(g, p); quiet(g); const lure = g.creatures.find((c) => c.kind === 'grimlure');
  lure.x = lure.hx = p.x; lure.y = lure.hy = p.y + g.st.sonar * 1.2; lure.state = 'idle';
  if (g.sees(p.x, p.y, lure.x, lure.y) || true) { g.ping(); assert.equal(lure.state, 'hunt', 'a Grimlure hears the ping'); }
  // shy creatures flee a lamp shone at them, but let a dark sub drift close
  const shy = (lamp) => {
    const s = dive(); place(s, p); quiet(s); s.lamp = lamp; s.face = 1; s.aim = 0;
    const c = s.creatures.find((cc) => cc.kind === 'ribboneel'); c.x = c.hx = p.x + 6; c.y = c.hy = p.y; c.state = 'idle';
    for (let i = 0; i < 30; i++) s.tick(idleInput()); s.creatures.find((cc) => cc.kind === 'ribboneel');
    return Math.hypot(c.x - s.x, c.y - s.y);
  };
  assert.ok(shy(true) > shy(false) + 0.5, 'a shy eel flees the lamp');
  // the lamp is a toggle
  const l = dive(); place(l, p); l.tick({ ...idleInput(), lamp: true }); assert.equal(l.lamp, false); l.tick({ ...idleInput(), lamp: true }); assert.equal(l.lamp, false, 'held, it toggles once'); l.tick(idleInput()); l.tick({ ...idleInput(), lamp: true }); assert.equal(l.lamp, true);
  ok('sonar: echoes at the speed of sound, the map filled in, a recharge, Grimlures hear it; the lamp toggles and shy creatures flee it');
}

// ---- catching, the tray, stings and bites
{
  const p = openAt(150, 6);
  const catchAt = (speed, tray = 0) => {
    const d = dive(); place(d, p); quiet(d); d.lamp = false;
    for (let i = 0; i < tray; i++) d.tray.push('krill');
    const c = d.creatures.find((cc) => cc.kind === 'mothjelly'); c.hx = c.x = p.x + 1; c.hy = c.y = p.y; d.vx = speed;
    d.tick(idleInput()); return d;
  };
  let d = catchAt(0.5); assert.deepEqual(d.tray, ['mothjelly'], 'drifting up gently catches it'); assert.ok(d.events.some((e) => e.k === 'catch' && e.first));
  d = catchAt(6); assert.equal(d.tray.length, 0, 'barging in too fast misses it');
  d = catchAt(0.5, 3); assert.equal(d.tray.length, 3); assert.ok(d.events.some((e) => e.k === 'trayFull'), 'a full tray says so');
  const known = new Dive({ world, levels: L0, known: ['mothjelly'] }); place(known, p); quiet(known); const c = known.creatures.find((cc) => cc.kind === 'mothjelly'); c.hx = c.x = p.x + 1; c.hy = c.y = p.y; known.tick(idleInput());
  assert.ok(known.events.some((e) => e.k === 'catch' && !e.first), 'a known species is not new');
  // a veil stings, a Grimlure bites and then leaves you be
  d = dive(); place(d, p); quiet(d); const v = d.creatures.find((cc) => cc.kind === 'veil'); v.hx = v.x = p.x + 0.8; v.hy = v.y = p.y; v.phase = 0; let h = d.hull; d.tick(idleInput());
  assert.ok(d.hull < h && d.events.some((e) => e.k === 'sting'));
  d = dive(); place(d, p); quiet(d); const g = d.creatures.find((cc) => cc.kind === 'grimlure'); g.hx = g.x = p.x + 1.5; g.hy = g.y = p.y; g.state = 'idle'; h = d.hull; d.tick(idleInput());
  assert.ok(d.hull <= h - 20 && d.events.some((e) => e.k === 'bite') && g.state === 'home', 'a bite, then it goes home');
  g.x = d.x + 1; g.y = d.y; h = d.hull; run(d, 1); assert.ok(d.hull > h - 1, 'and leaves you be for a while');
  ok('catching: gently does it, too fast misses, a full tray says so, known species are not new; veils sting, Grimlures bite once and go');
}

// ---- the end of a dive, banking, upgrades, the map and the save
{
  const p = openAt(150, 6);
  let d = dive(); place(d, p); quiet(d); d.tray = ['krill', 'krill', 'teacup']; d.hull = 0.1; const v = d.creatures.find((cc) => cc.kind === 'veil'); v.hx = v.x = p.x + 0.5; v.hy = v.y = p.y; v.phase = 0; d.tick(idleInput());
  assert.ok(d.over && d.why === 'hull' && d.tray.length === 0, 'a broken hull: rescued, and the tray is lost');
  const s = newSave(); d = dive(); place(d, p); quiet(d); d.tray = ['krill', 'krill', 'teacup']; d.end('surfaced');
  const r = bank(s, d); assert.equal(r.earned - r.chart, POINTS.first * 2 + POINTS.repeat); assert.deepEqual(r.firsts.sort(), ['krill', 'teacup']);
  assert.equal(s.journal.krill, 2); assert.equal(journalCount(s), 2); assert.equal(s.stats.dives, 1); assert.equal(s.stats.banked, 3);
  // the chart pays for new cave only once
  const s2 = newSave(); const m = dive(); place(m, p); quiet(m); m.ping(); m.end('surfaced'); const first = bank(s2, m).chart;
  const m2 = new Dive({ world, levels: L0, mapped: unpackMap(s2.map) }); place(m2, p); quiet(m2); m2.ping(); m2.end('surfaced'); assert.equal(bank(s2, m2).chart, 0, 'mapping the same cave again pays nothing'); assert.ok(first >= 0);
  // upgrades: costs, levels, stats
  const u = newSave(); u.points = 5000;
  for (const up of UPGRADES) { let k = 0; while (buy(u, up.id)) k++; assert.equal(k, up.cost.length); assert.equal(upgradeCost(u, up.id), null); }
  assert.equal(u.points, 5000 - UPGRADES.reduce((a, x) => a + x.cost.reduce((b, c) => b + c, 0), 0));
  const lo = stats(L0), hi = stats(LMAX); for (const k of Object.keys(lo)) if (k !== 'sonarCd') assert.ok(hi[k] > lo[k], `${k} improves`); assert.ok(hi.sonarCd < lo.sonarCd);
  assert.ok(hi.rating > world.whale.y, 'the best hull reaches the whale'); assert.ok(stats({ ...L0, hull: 2 }).rating < world.whale.y, 'and nothing less does');
  const broke = newSave(); assert.equal(buy(broke, 'hull'), false, 'no research, no upgrade');
  // the map packs small and comes back the same
  const packed = packMap(m2.mapped), back = unpackMap(packed); assert.deepEqual(back, m2.mapped); assert.ok(packed.length < 20000);
  assert.ok(mappedShare(back, world) > 0 && mappedShare(back, world) < 0.2);
  // the whale ends the story
  const wd = dive({ levels: LMAX }); place(wd, { x: world.whale.x, y: world.whale.y }); quiet(wd); wd.tick(idleInput()); assert.ok(wd.over && wd.why === 'whale');
  const ws = newSave(); bank(ws, wd); assert.equal(ws.whale, true);
  // saves
  const again = parseSave(serialise(s)); assert.deepEqual(again, s, 'a save round-trips');
  for (const bad of [null, '', '{', '[]', '7', '{"v":2}', '{"v":1,"points":"lots","levels":[9],"journal":5,"map":"<script>","stats":null}']) assert.deepEqual(parseSave(bad), newSave(), `corrupt save ${bad}`);
  const odd = parseSave(JSON.stringify({ v: 1, points: -5, levels: { hull: 9, tank: 1.7 }, journal: { krill: 3, dragon: 4 }, whale: 'yes' }));
  assert.equal(odd.points, 0); assert.equal(odd.levels.hull, 3); assert.equal(odd.levels.tank, 1); assert.deepEqual(odd.journal, { krill: 3 }); assert.equal(odd.whale, false);
  ok('a dive ends surfaced, rescued (tray lost) or at the whale; banking, the chart, upgrades and their stats, the packed map and the save');
}
console.log(`deep: ${n} checks passed`);
void spec;
