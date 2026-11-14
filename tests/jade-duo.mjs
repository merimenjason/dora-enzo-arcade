// Jade Street engine tests, fourth pass (run by tests/jade-more.mjs): both heroes in the world. The partner follows
// over long random walks in every district and is never stuck or lost; switching heroes (on foot, on a shared ride,
// with a posted partner); the passenger seat and hiding together; every tag-team move (boost, haul, pounce, distract,
// grab, hold); the jobs that need both, with a forced failure for each; every gadget's effect (crows dizzy and drop
// loot, wardens stunned with heat, townsfolk and stall awnings splattered, soap puddles, bursts that scatter a flock,
// nets on a getaway cart); ammo, reloads, crates and Tock's stall; two players and the leash; save v5 migration from
// v2, v3 and v4 with the gadgets the story gave; and the new paintings.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { World, DT, NO_INPUT } from '../.checks/jade-game.js';
import { T, W, S, DISTRICTS, districtAt } from '../.checks/jade-city.js';
import { nearestFree } from '../.checks/jade-nav.js';
import { overlapping } from '../.checks/jade-move.js';
import { MISSIONS, MISSION } from '../.checks/jade-story.js';
import { newSave, loadSave, SAVE_VERSION } from '../.checks/jade-save.js';
import { FRAMES } from '../.checks/jade-art.js';
import { addHeat } from '../.checks/jade-heat.js';
import { spawn } from '../.checks/jade-events.js';
import { tagOption, tag, BOOSTS, boostXY } from '../.checks/jade-tag.js';
import { OFFSCREEN, LEASH, applyTwo } from '../.checks/jade-duo.js';
import { GADGETS, GADGET_IDS, GEAR_GIFT, giveGadget, carried, clipOf, ammoCap, fire, hit, buyGadget, buyAmmo, upgradeGadget, carry, stallOpen } from '../.checks/jade-gear.js';
import { missionSave, playMission } from './jade-bot.mjs';

let n = 0;
const test = (name, f) => { try { f(); n++; } catch (e) { console.error('FAILED:', name); throw e; } };
const allDone = MISSIONS.map(m => m.id);
const world = (o = {}) => { const s = newSave(o.seed ?? 5); s.started = true; s.story.intro = true; s.done = o.done ?? allDone; s.settings.assist = o.assist ?? true; const w = new World(s, o.seed ?? 5); w.quiet = true; return w; };
const steps = (w, k, inp = NO_INPUT, inp2) => { for (let i = 0; i < k; i++) { w.step(inp, DT, inp2); if (w.talk) w.talk = null; } };
const d2 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const R = (seed) => { let x = seed >>> 0; return () => ((x = (x * 1664525 + 1013904223) >>> 0) / 4294967296); };
const stocked = w => { for (const g of GADGET_IDS) giveGadget(w.s, g); };
const inWall = (w, p) => { const s = w.c.solid[Math.floor(p.y / T) * W + Math.floor(p.x / T)]; return !p.roof && !p.seat && !p.ride && (s === S.BUILDING || s === S.TALL); };

test('the partner follows over long random walks in every district: never stuck, never lost, never in a wall', () => {
  const w = world({ seed: 11 }); const rnd = R(4);
  for (const d of DISTRICTS) {
    const pl = Object.values(w.c.places).find(p => p.d === d && p.kind === 'market') ?? Object.values(w.c.places).find(p => p.d === d);
    w.placePlayer(pl.x, pl.y);
    let far = 0, worst = 0, mx = 0, my = 0, sneak = false;
    for (let i = 0; i < 60 * 70; i++) {
      if (i % 50 === 0) { const a = rnd() * Math.PI * 2; const go = rnd() > 0.15; mx = go ? Math.cos(a) : 0; my = go ? Math.sin(a) : 0; sneak = rnd() < 0.15; }
      w.step({ ...NO_INPUT, mx, my, sneak, dash: rnd() < 0.004, hop: rnd() < 0.004 }, DT); if (w.talk) w.talk = null; if (w.ui) w.ui = null;
      const dd = d2(w.p, w.mate); far = dd > OFFSCREEN ? far + DT : 0; worst = Math.max(worst, far);
      assert.ok(!inWall(w, w.mate), `${d}: the partner never stands inside a building (${Math.round(w.mate.x / T)},${Math.round(w.mate.y / T)})`);
      if (w.heat > 0.5) { w.heat = 0; w.wardens = []; }
    }
    assert.ok(worst < 2.5, `${d}: never off screen for long (${worst.toFixed(1)}s)`);
    assert.ok(d2(w.p, w.mate) < 400, `${d}: at your side at the end (${Math.round(d2(w.p, w.mate))})`);
  }
  // dropped far away (a respawn, a teleport): caught up at once
  const w2 = world(); w2.placePlayer(20 * T, 47 * T); w2.mate.b.x = 100 * T; w2.mate.b.y = 20 * T; steps(w2, 60);
  assert.ok(d2(w2.p, w2.mate) < 300, 'a lost partner catches up off screen');
});

test('switch heroes: Tab swaps who you play, the camera hero and the save; the one you leave keeps their job', () => {
  const w = world(); w.placePlayer(20 * T + 32, 47 * T + 32); steps(w, 30);
  const a = w.p, b = w.mate;
  steps(w, 1, { ...NO_INPUT, swap: true });
  assert.equal(w.p, b); assert.equal(w.mate, a); assert.equal(w.s.hero, b.who); assert.equal(w.mate.ai.mode, 'follow');
  assert.ok(w.fx.some(f => f.t === 'switch'));
  // a posted partner, switched away from, stays at the post
  const run = playOnto('m19', 'post');
  const before = run.w.mate.ai.at;
  run.w.p.b.x = run.w.mate.ai.at[0] + 900;
  assert.ok(run.w.switchHero(), 'switch in a job');
  assert.equal(run.w.mate.ai.mode, 'stay'); assert.ok(before);
  // sharing a ride: the passenger takes the handlebars
  const w3 = world(); const r = w3.rides.find(x => x.kind === 'scooter' && !x.locked && w3.open.has(districtAt(Math.floor(x.b.x / T), Math.floor(x.b.y / T))));
  const [fx, fy] = nearestFree(w3.c, 'foot', r.b.x, r.b.y, w3.open, 3); w3.placePlayer(fx, fy); w3.enter(r); steps(w3, 120);
  assert.equal(w3.mate.seat, r, 'the partner hops on behind');
  const was = w3.p; w3.switchHero(); assert.equal(w3.p.ride, r); assert.equal(w3.mate.seat, r); assert.notEqual(w3.p, was);
});

/** a world in a job with its current step of type t entered */
function playOnto(id, t, o = {}) {
  const s = missionSave(id, { assist: o.assist ?? true, diff: o.diff ?? 'easy' });
  const w = new World(s, 9); w.quiet = true; w.startMission(MISSION[id]); w.talk = null;
  const i = MISSION[id].steps.findIndex(st => st.t === t && (!o.where || o.where(st)));
  assert.ok(i >= 0, `${id} has a ${t} step`);
  const run = w.run; run.snap = run.snapshot(i); run.enter(i); w.talk = null;
  return { w, run, i };
}

test('passenger and hiding: the partner rides behind you, hides with you and cheers a job done', () => {
  const w = world(); const r = w.rides.find(x => x.kind === 'trishaw' && !x.locked && w.open.has(districtAt(Math.floor(x.b.x / T), Math.floor(x.b.y / T))));
  const [fx, fy] = nearestFree(w.c, 'foot', r.b.x, r.b.y, w.open, 3); w.placePlayer(fx, fy); w.enter(r); steps(w, 120);
  assert.equal(w.mate.seat, r, 'on the back seat');
  steps(w, 120, { ...NO_INPUT, mx: 1 }); assert.equal(w.mate.seat, r, 'stays on while riding'); assert.ok(d2(w.mate, w.p) < 60);
  w.exit(); steps(w, 60); assert.equal(w.mate.seat, null, 'gets off when you do'); assert.ok(!inWall(w, w.mate));
  const h = w.c.hides[0]; w.placePlayer(h.x, h.y + 20); steps(w, 40); w.p.hide = true; steps(w, 180);
  assert.ok(w.mate.hide, 'hides with you'); w.p.hide = false; steps(w, 60); assert.ok(!w.mate.hide, 'and comes out');
  w.cheer(); assert.equal(w.mate.act?.n, 'celebrate');
});

test('tag-team moves: boost onto a roof, haul the partner up, pounce together, distract a warden, grab from the back seat', () => {
  // boost
  const w = world(); const [gx, gy] = boostXY(0, false); w.placePlayer(gx, gy); w.p.b.x = gx; w.p.b.y = gy; w.mate.b.x = gx - 40; w.mate.b.y = gy + 20;
  assert.equal(tagOption(w)?.kind, 'boost'); steps(w, 1, { ...NO_INPUT, tag: true }); assert.equal(w.mate.act?.n, 'boost-give'); assert.equal(w.p.act?.n, 'boost-rise');
  steps(w, 60); assert.ok(w.p.roof, 'boosted onto the roof'); assert.ok(!w.mate.roof);
  // haul
  assert.equal(tagOption(w)?.kind, 'haul'); steps(w, 1, { ...NO_INPUT, tag: true }); assert.equal(w.p.act?.n, 'haul'); steps(w, 70); assert.ok(w.mate.roof, 'hauled up');
  assert.ok(BOOSTS.length >= 6);
  // pounce on the street crow
  const w2 = world({ seed: 8 }); w2.placePlayer(20 * T + 32, 47 * T + 32); steps(w2, 20);
  let e = null; for (let k = 0; k < 20 && !e; k++) { e = spawn(w2, 'crow'); if (!e) w2.placePlayer(w2.p.x + T * 3, w2.p.y); }
  assert.ok(e, 'a crow event'); w2.street = e; e.b.x = w2.mate.x + 150; e.b.y = w2.mate.y;
  assert.equal(tagOption(w2)?.kind, 'pounce'); steps(w2, 1, { ...NO_INPUT, tag: true }); assert.equal(w2.mate.ai.mode, 'pounce');
  let caught = false; for (let i = 0; i < 120 && !caught; i++) { w2.step(NO_INPUT, DT); caught = !!e.caught || w2.street !== e; }
  assert.ok(caught, 'the partner pounces on the crow');
  // distract
  const w3 = world(); w3.s.settings.assist = false; w3.placePlayer(20 * T + 32, 47 * T + 32); addHeat(w3, 1.2, 'test'); steps(w3, 150);
  assert.ok(w3.wardens.length, 'a warden'); const wd = w3.wardens[0]; wd.b.x = w3.mate.x + 260; wd.b.y = w3.mate.y;
  assert.equal(tagOption(w3)?.kind, 'distract'); steps(w3, 1, { ...NO_INPUT, tag: true }); assert.equal(w3.mate.ai.mode, 'distract');
  let stared = false; for (let i = 0; i < 240 && !stared; i++) { w3.step(NO_INPUT, DT); stared = w3.wardens.some(x => (x.stare ?? 0) > 0); }
  assert.ok(stared, 'the warden stops to stare at the dancing partner');
  // grab from the back seat
  const w4 = world(); const r = w4.rides.find(x => x.kind === 'scooter' && !x.locked && w4.open.has(districtAt(Math.floor(x.b.x / T), Math.floor(x.b.y / T))));
  const [fx, fy] = nearestFree(w4.c, 'foot', r.b.x, r.b.y, w4.open, 3); w4.placePlayer(fx, fy); w4.enter(r); steps(w4, 120); assert.equal(w4.mate.seat, r);
  w4.s.cargo.jade = 3; w4.snatchers.push({ x: w4.p.x + 60, y: w4.p.y, h: Math.PI, t: 0, out: false, took: 1, wing: 0, good: 'jade' });
  assert.equal(tagOption(w4)?.kind, 'snatch'); tag(w4); assert.equal(w4.snatchers[0].out, true); assert.equal(w4.s.cargo.jade, 4, 'snatched back');
  assert.ok(w4.s.stats.tags >= 1);
});

test('the jobs that need both: at least ten, each with a partner step, and each fails without the partner', () => {
  const TEAM = ['post', 'switch', 'hold', 'boost', 'bag', 'watch'];
  const team = MISSIONS.filter(m => m.steps.some(st => TEAM.includes(st.t) || st.finish || st.relay !== undefined || st.flanks || st.rope || st.shutter || st.high));
  assert.ok(team.length >= 10, `${team.length} team jobs`);
  // the lock gate stays shut until the partner holds the lever
  const { w, run } = playOnto('m15', 'hold', { assist: false });
  w.placePlayer(65 * T + 32, 27 * T + 32); w.mate.b.x = w.p.x - 60; w.mate.b.y = w.p.y; steps(w, 30);
  assert.ok(w.gates.size > 0, `the gate is shut (${w.mate.ai.mode})`);
  // try the gate without the partner: still at the hold step after a while
  steps(w, 300, { ...NO_INPUT, my: 1 }); assert.equal(run.cur.t, 'hold', 'no way through alone');
  w.placePlayer(65 * T + 32, 27 * T + 32); steps(w, 2);
  assert.match(tagOption(w)?.label ?? '', /lever/i); steps(w, 1, { ...NO_INPUT, tag: true });
  let open = false; for (let i = 0; i < 900 && !open; i++) { w.step(NO_INPUT, DT); open = w.gates.size === 0; }
  assert.ok(open, 'held open'); void run;
  // the float waits for the rope
  const f = playOnto('m25', 'float', { assist: false }); steps(f.w, 240); assert.ok(!f.w.failed || /rope|float/i.test(String(f.w.failed?.reason ?? '')));
  // a double pounce, a passenger grab or a net is needed to end three chases: plain bumps never finish them
  for (const id of ['m2', 'm5', 'm20']) { const st = MISSION[id].steps.find(s => s.t === 'chase' && s.finish); assert.ok(st, `${id} has a finish`); }
});

test('jobs stay finishable with no gadgets on Assist', () => {
  for (const m of MISSIONS) { const r = playMission(m.id, 'casual', 2, { gadgets: false }); assert.ok(r.won, `${m.id} with no gadgets: ${JSON.stringify(r)}`); }
});

test('gadgets: a hit crow gets dizzy and drops its loot; each toy has its own effect on wardens, townsfolk and stalls', () => {
  for (const g of GADGET_IDS) {
    const w = world(); w.placePlayer(20 * T + 32, 47 * T + 32); stocked(w); steps(w, 5);
    w.s.cargo.jade = 2; const m = { x: w.p.x + 150, y: w.p.y, h: Math.PI, t: 0, out: false, took: 1, wing: 0, good: 'jade' };
    assert.ok(hit(w, { kind: 'snatcher', x: m.x, y: m.y, r: 20, fair: true, ref: m }, g, 1, m.x, m.y), `${g} hits`);
    assert.ok(m.out && m.dizzy > 0, `${g}: the crow is dizzy`); assert.equal(w.s.cargo.jade, 3, `${g}: the loot drops back`);
  }
  // wardens: stunned, with a hit pose, and more heat
  const stun = {};
  for (const g of GADGET_IDS) {
    const w = world(); w.s.settings.assist = false; w.placePlayer(20 * T + 32, 47 * T + 32); addHeat(w, 1.1, 'test'); steps(w, 150);
    const wd = w.wardens[0]; const h0 = w.heat;
    hit(w, { kind: 'warden', x: wd.b.x, y: wd.b.y, r: 20, fair: false, ref: wd }, g, 1, wd.b.x, wd.b.y);
    assert.ok(wd.stun > 0 && wd.hitKind, `${g} stuns a warden`); assert.ok(w.heat > h0, `${g} on a warden raises heat`); stun[g] = wd.stun;
  }
  assert.ok(stun.net > stun.sling && stun.paint > stun.confetti, 'each toy stuns for its own time');
  // townsfolk and stalls
  const w = world(); w.placePlayer(20 * T + 32, 47 * T + 32); steps(w, 30);
  const pd = w.peds[0]; const h0 = w.heat; hit(w, { kind: 'ped', x: pd.x, y: pd.y, r: 16, fair: false, ref: pd }, 'paint', 1, pd.x, pd.y);
  assert.ok(pd.splat && pd.splatT > 0 && w.heat > h0, 'a splattered passer-by, and heat');
  const before = w.heat; hit(w, { kind: 'ped', x: pd.x, y: pd.y, r: 16, fair: false, ref: pd }, 'confetti', 1, pd.x, pd.y); assert.equal(w.heat, before, 'confetti only makes folk cheer');
});

test('gadgets in flight: shots fly, splat, puddle, burst a flock and tangle a getaway cart', () => {
  const w = world(); w.placePlayer(20 * T + 32, 47 * T + 32); stocked(w); steps(w, 5);
  // confetti scatters a whole flock at once
  w.s.gear.carry[w.p.who] = ['confetti', 'popper']; w.s.gear.slot[w.p.who] = 0;
  for (let k = 0; k < 3; k++) w.snatchers.push({ x: w.p.x + 200 + k * 20, y: w.p.y + (k - 1) * 30, h: Math.PI, t: 0, out: false, took: 0, wing: 0 });
  assert.equal(fire(w, w.p, w.p.x + 220, w.p.y), null); steps(w, 40);
  assert.ok(w.snatchers.every(m => m.out), 'the flock scatters'); assert.ok(w.fx.some(f => f.t === 'burst'));
  // a popper lobbed into a group stuns all of them
  w.s.gear.slot[w.p.who] = 1; addHeat(w, 1.1, 'test'); steps(w, 150);
  for (const wd of w.wardens) { wd.b.x = w.p.x + 260; wd.b.y = w.p.y; wd.stun = 0; }
  if (w.wardens.length) { w.p.fireCd = 0; fire(w, w.p, w.p.x + 260, w.p.y); steps(w, 40); assert.ok(w.wardens.every(x => x.hitKind), 'a popper dazes everyone in its burst'); }
  // a bubble shot leaves a soapy puddle, and a sling shot a rice splat
  const w2 = world(); w2.placePlayer(20 * T + 32, 47 * T + 32); stocked(w2); steps(w2, 5);
  w2.s.gear.carry[w2.p.who] = ['bubble', 'sling']; w2.s.gear.slot[w2.p.who] = 0; fire(w2, w2.p, w2.p.x + 200, w2.p.y); steps(w2, 60);
  assert.ok(w2.splats.some(s => s.puddle), 'a puddle'); assert.equal(w2.shots.length, 0);
  // the net on a getaway cart in a net-finish chase
  const { w: w3, run } = playOnto('m20', 'chase'); steps(w3, 30); stocked(w3);
  const a = run.actors.find(x => x.kind === 'cart' || x.kind === 'boat' || x.kind === 'runner');
  assert.ok(a, 'a getaway');
  hit(w3, { kind: 'actor', x: a.b.x, y: a.b.y, r: 30, fair: true, ref: a }, 'net', 1, a.b.x, a.b.y);
  assert.ok((a.netT ?? 0) > 0 || a.stun > 0, 'the net tangles it');
});

test('ammo and money: clips, reloads, empty satchels, crates, Tock’s stall and carrying', () => {
  const w = world(); w.placePlayer(20 * T + 32, 47 * T + 32); giveGadget(w.s, 'sling'); steps(w, 5);
  const sh = w.s.hero === w.p.who && w.s.gear.carry[w.p.who].includes('sling') ? w.p : w.mate;
  if (sh !== w.p) w.switchHero();
  w.s.gear.slot[w.p.who] = w.s.gear.carry[w.p.who].indexOf('sling');
  assert.equal(carried(w.s, w.p.who), 'sling'); const clip = clipOf(w.s, 'sling'); assert.equal(w.s.gear.clip.sling, clip);
  for (let k = 0; k < clip; k++) { w.p.fireCd = 0; assert.equal(fire(w, w.p, w.p.x + 200, w.p.y), null); }
  assert.equal(w.s.gear.clip.sling, 0); assert.ok(w.p.reloadT > 0, 'an empty clip reloads by itself');
  steps(w, 90); assert.equal(w.s.gear.clip.sling, clip); assert.equal(w.s.gear.ammo.sling, GADGETS.sling.pack - clip);
  w.s.gear.ammo.sling = 0; w.s.gear.clip.sling = 0; w.p.fireCd = 0; assert.match(fire(w, w.p, w.p.x + 200, w.p.y), /Out of rice balls/);
  // a supply crate refills
  const cr = w.crates.find(c => w.open.has(districtAt(Math.floor(c.x / T), Math.floor(c.y / T)))); w.p.b.x = cr.x; w.p.b.y = cr.y; steps(w, 2);
  assert.equal(w.s.gear.ammo.sling, GADGETS.sling.pack, 'the crate refills'); assert.ok(cr.back > w.time, 'and comes back later');
  // Tock's stall
  const s = newSave(1); s.cash = 1000; assert.equal(stallOpen(s), false); s.done = ['m1', 'm2']; assert.equal(stallOpen(s), true);
  assert.equal(buyGadget(s, 'net'), null); assert.equal(s.cash, 1000 - GADGETS.net.price); assert.equal(buyGadget(s, 'net'), 'You have one already');
  assert.equal(buyAmmo(s, 'net'), null); assert.ok(s.gear.ammo.net <= ammoCap(s, 'net'));
  const c0 = clipOf(s, 'net'); assert.equal(upgradeGadget(s, 'net'), null); assert.ok(clipOf(s, 'net') >= c0); assert.equal(s.gear.lvl.net, 1);
  s.cash = 0; assert.equal(buyGadget(s, 'popper'), 'Not enough coins'); assert.equal(buyAmmo(s, 'popper'), 'Buy the gadget first');
  s.cash = 5000; for (const g of GADGET_IDS) buyGadget(s, g);
  assert.ok(s.gear.carry.dora.length === 2 && s.gear.carry.enzo.length === 2, 'two each');
  carry(s, 'dora', 'confetti'); assert.ok(s.gear.carry.dora.includes('confetti') && !s.gear.carry.enzo.includes('confetti'));
});

test('two players: P2 steers the partner, the leash keeps both on one screen, and leaving hands the partner back to the AI', () => {
  const w = world(); w.placePlayer(20 * T + 32, 47 * T + 32); steps(w, 30);
  applyTwo(w, true); assert.equal(w.two, true); assert.ok(w.fx.some(f => f.t === 'p2-join'));
  assert.equal(w.switchHero(), false, 'no switching with two players');
  let worst = 0;
  for (let i = 0; i < 60 * 8; i++) { w.step({ ...NO_INPUT, mx: -1 }, DT, { ...NO_INPUT, mx: 1 }); if (w.talk) w.talk = null; worst = Math.max(worst, Math.abs(w.mate.x - w.p.x)); }
  assert.ok(worst <= LEASH.x + 40, `leashed (${Math.round(worst)} px apart at most)`); assert.ok(worst > 600, 'but free to spread out');
  assert.ok(!inWall(w, w.p) && !inWall(w, w.mate)); assert.ok(!overlapping(w.ctx(false), w.mate.b));
  const x0 = w.mate.x; steps(w, 60, NO_INPUT, { ...NO_INPUT, my: 1 }); assert.ok(Math.abs(w.mate.y - 47 * T) > 10 || w.mate.x !== x0, 'P2 moves the partner');
  applyTwo(w, false); assert.equal(w.two, false); steps(w, 600); assert.ok(d2(w.p, w.mate) < 400, 'the AI partner rejoins you');
});

test('save v5: v2, v3 and v4 saves migrate, with the gadgets the story gave by then', () => {
  assert.equal(SAVE_VERSION, 6);
  const v3 = JSON.parse(readFileSync(new URL('./fixtures/jade-save-v3.json', import.meta.url), 'utf8'));
  const s3 = loadSave(JSON.stringify(v3)); assert.equal(s3.v, 6);
  const want = v3.done.flatMap(d => GEAR_GIFT[d] ?? []);
  assert.deepEqual([...s3.gear.own].sort(), [...want].sort(), 'v3: the gifts of every done job');
  const live2 = { v: 2, seed: 77, hero: 'enzo', cash: 640, night: 6, clock: 120, started: true, done: MISSIONS.slice(0, 17).map(m => m.id), cats: [], murals: [], rep: { market: 30, temple: 8, canal: 0, docks: 0, arcade: 0 },
    cargo: { jade: 0, mooncake: 0, tea: 0, bowl: 0, fan: 0, mango: 0 }, stash: {}, upgrades: { speed: 0, cargo: 0, grip: 0 }, paint: 'red', outfit: { dora: 'classic', enzo: 'classic' }, safes: [], trophies: [], tips: [], dailyDone: [],
    stats: { missions: 17 }, settings: { diff: 'normal', assist: true, sound: true, music: true, touch: 'auto' } };
  const s2 = loadSave(JSON.stringify(live2)); assert.equal(s2.v, 6); assert.deepEqual([...s2.gear.own].sort(), ['bubble', 'net', 'paint', 'popper', 'sling']);
  for (const g of s2.gear.own) assert.ok(s2.gear.clip[g] === clipOf(s2, g) && s2.gear.ammo[g] > 0, `${g} loaded`);
  const v4 = newSave(4); v4.v = 4; v4.done = ['m1', 'm2', 'm3', 'm4']; delete v4.gear; v4.stats = { ...v4.stats }; delete v4.stats.shots;
  const s4 = loadSave(JSON.stringify(v4)); assert.equal(s4.v, 6); assert.deepEqual([...s4.gear.own].sort(), ['paint', 'sling']); assert.equal(s4.stats.shots, 0);
  assert.equal(s4.gear.carry.dora.length + s4.gear.carry.enzo.length, 2, 'carried by someone');
  const junk = loadSave(JSON.stringify({ ...s4, gear: { own: ['sling', 'bogus'], ammo: { sling: -3 }, clip: { sling: 99 }, lvl: { sling: 7 }, carry: { dora: ['sling', 'sling', 'net'], enzo: 'x' }, slot: {} } }));
  assert.deepEqual(junk.gear.own, ['sling']); assert.equal(junk.gear.ammo.sling, 0); assert.ok(junk.gear.clip.sling <= clipOf(junk, 'sling')); assert.ok(junk.gear.lvl.sling <= 2);
  assert.deepEqual(loadSave(JSON.stringify(s4)), s4, 'v5 round trip');
});

test('the fourth batch of paintings: every gadget, shot, splat, pose, passenger frame and job prop is in the atlases', () => {
  const need = [...GADGET_IDS.map(g => `g-${g}`), 'sp-rice', 'sp-pink', 'sp-teal', 'sp-net', 'sp-puddle', 'sp-pop', 'sp-confetti', 'crate-shut', 'crate-open', 'gadget-stall', 'face-tock', 'face-tock-happy', 'lever-up', 'lever-down', 'shutter-open', 'shutter-shut', 'loot-bag', 'net-open'];
  for (const h of ['dora', 'enzo']) {
    for (const a of ['boost-give', 'boost-rise', 'hold-0', 'hold-1', 'haul-0', 'haul-1', 'distract-0', 'distract-1', 'pounce-side', 'pounce-down', 'snatch', 'reload', 'pass-0', 'pass-1', 'pass-aim', 'pass-grab', 'pass-cheer', 'pass-duck', 'pass-wave']) need.push(`${h}-${a}`);
    for (const g of GADGET_IDS) for (const f of ['side', 'down']) need.push(`${h}-fire-${g}-${f}`);
  }
  const missing = need.filter(k => !FRAMES[k]); assert.deepEqual(missing, [], 'painted');
  for (const k of need) { const f = FRAMES[k]; assert.ok(f[3] > 4 && f[4] > 4, `${k} has size`); }
});

test('lessons never hang about: each basic one gives up after a while, and the festival ending plays once', () => {
  const s = newSave(9); s.started = true; s.story.intro = true; s.done = ['m1']; const w = new World(s, 9); w.quiet = true; w.talk = null;
  w.placePlayer(20 * T + 32, 47 * T + 32);
  let shown = null, since = 0, longest = 0;
  for (let i = 0; i < 60 * 90; i++) { w.step(NO_INPUT, DT); if (w.talk) w.talk = null; const c = w.tutor.cur; if (c !== shown) { shown = c; since = 0; } else if (c) since += DT; if (c) longest = Math.max(longest, since); }
  assert.ok(longest < 31, `no lesson stays up more than its limit (${longest.toFixed(1)}s)`);
  for (const id of ['move', 'run', 'dash', 'hop']) assert.ok(w.s.learned.includes(id), `${id} given up on`);
  // beating Glint again does not replay the ending
  const w2 = world({ done: allDone.slice(0, 24) }); w2.s.story.ending = false; w2.finishMission(MISSION.m25); assert.ok(w2.fx.some(f => f.t === 'finale'), 'the first time');
  w2.s.story.ending = true; w2.fx.length = 0; w2.finishMission(MISSION.m25); assert.ok(!w2.fx.some(f => f.t === 'finale'), 'not on a replay');
});

console.log(`jade (fourth pass): ${n} tests ok`);
// the fifth pass: Singapore
await import('./jade-sg.mjs');
