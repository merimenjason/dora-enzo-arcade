// Jade Street engine tests, third pass (run by tests/jade.mjs): every job's ways to fail, each shown on screen as a
// timer or meter before it bites; the chase set pieces (triggers, telegraphs, hits, checkpoints); Madame Glint's three
// phases (decoys, falling signs, the float and the leap); businesses (income maths, the till, history, buying,
// upgrading, collecting) and crow raids (won and lost); the v2 → v4 and v3 → v4 save migrations with a real v3 save;
// the new paintings; and a painted portrait for the mood of every line of dialogue.
import { BRANCHES } from '../.checks/jade-jobs.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { World, DT, NO_INPUT } from '../.checks/jade-game.js';
import { T, W } from '../.checks/jade-city.js';
import { MISSIONS, MISSION, MOODS, PEOPLE } from '../.checks/jade-story.js';
import { newSave, loadSave, SAVE_VERSION, OLD_KEYS, SAVE_KEY, chapterOf } from '../.checks/jade-save.js';
import { FRAMES } from '../.checks/jade-art.js';
import { BIZ, BIZ_OF, bizRate, accrue, closeNight, buyBiz, upgradeBiz, collect, canBuy, raidCheck, raidMission, raidLost, tillTotal, nightEvent, bizSprite } from '../.checks/jade-biz.js';
import { telegraph } from '../.checks/jade-setpiece.js';
import { leapSpot, inWindow, FLOAT_END } from '../.checks/jade-boss.js';
import { DIFF } from '../.checks/jade-diff.js';
import { missionSave } from './jade-bot.mjs';

let n = 0;
const test = (name, f) => { try { f(); n++; } catch (e) { console.error('FAILED:', name); throw e; } };
const ALL_OPEN = ['market', 'temple', 'canal', 'docks', 'arcade'];

/** a world part-way into a job: step i entered directly, as a checkpoint restore would */
function at(id, i, o = {}) {
  const s = missionSave(id, { assist: o.assist ?? false, diff: o.diff ?? 'normal' });
  const w = new World(s, o.seed ?? 9); w.quiet = true;
  w.startMission(MISSION[id]); w.talk = null;
  const run = w.run; run.snap = run.snapshot(i); run.enter(i); w.talk = null;
  // pass 8: the branch cards on a blend, trap or detective step; these tests take the first way unless told
  if (run.js && BRANCHES[run.cur.t]) run.js.pick = o.pick ?? BRANCHES[run.cur.t][0];
  return { w, run };
}
const idle = (w, sec, until = () => false) => { for (let k = 0; k < sec * 60 && !w.failed && !until(); k++) { w.step(NO_INPUT, DT); if (w.talk) w.talk = null; } };

// ── item 1: every job has a fair, readable way to fail
const FAILABLE = new Set(['chase', 'tail', 'escort', 'stealth', 'race', 'heat', 'float', 'raid', 'collect', 'trade', 'fares', 'case', 'heist', 'defend', 'blend', 'detective', 'trap', 'swap']);
const failable = st => FAILABLE.has(st.t) || ((st.t === 'deliver' || st.t === 'goto' || st.t === 'track' || st.t === 'crowd' || st.t === 'torch' || st.t === 'paddle' || st.t === 'tide' || st.t === 'summit' || st.t === 'mud' || st.t === 'herd' || st.t === 'stones' || st.t === 'rounds') && (st.time || st.fragile));
/** provoke a failure at step i by doing nothing useful; returns the reason and whether a timer or meter showed first */
function provoke(id, i) {
  const { w, run } = at(id, i); const st = run.cur; let shown = false;
  const p = w.p;
  if (st.t === 'stealth' || st.t === 'case') { const a = run.actors[0]; p.b.x = a.b.x + Math.cos(a.b.h) * 70; p.b.y = a.b.y + Math.sin(a.b.h) * 70; }
  // the job steps: commit to a loud heist at the front door; a disguise on, standing beside a lookout (on its side away
  // from the goal, at the spot furthest from the crowd, so it is neither the end of the walk nor cover); nets and bait down
  if (st.t === 'heist') { idle(w, 0.2); run.heistPick('loud'); const [fx, fy] = run.spot(st.front); w.placePlayer(fx, fy); }
  if (st.t === 'blend') {
    idle(w, 0.2); run.js.ph = 1; p.disguise = true; const [gx, gy] = run.spot(st.goal), crowd = run.actors.filter(x => x.kind === 'crowd');
    const ws = run.actors.filter(x => x.kind === 'watcher'), room = ([x, y]) => Math.min(Infinity, ...crowd.map(c => Math.hypot(c.b.x - x, c.b.y - y)));
    // where the hero lands once snapped to the walkable grid must be in a lookout's face (close, or in its view cone)
    const seen = () => ws.some(a => { const d = Math.hypot(a.b.x - p.x, a.b.y - p.y), off = Math.abs(Math.atan2(Math.sin(Math.atan2(p.y - a.b.y, p.x - a.b.x) - a.b.h), Math.cos(Math.atan2(p.y - a.b.y, p.x - a.b.x) - a.b.h))); return d < 70 || (d < 240 && off < 0.8); });
    const spots = ws.flatMap(a => { const l = Math.hypot(a.b.x - gx, a.b.y - gy) || 1; return [[a.b.x + Math.cos(a.b.h) * 60, a.b.y + Math.sin(a.b.h) * 60], [a.b.x + (a.b.x - gx) / l * 40, a.b.y + (a.b.y - gy) / l * 40]]; }).sort((u, v) => room(v) - room(u));
    for (const [sx, sy] of spots) { w.placePlayer(sx, sy); if (seen() && Math.hypot(p.x - gx, p.y - gy) > 120) break; }
  }
  if (st.t === 'trap') { for (let k = 0; k < st.need; k++) run.js.set.push(k); run.js.ph = 2; run.js.queue = st.n; run.js.spawnT = 0.5; const [x, y] = run.spot(st.path[1]); w.placePlayer(x + 40, y + 40); }
  if (st.t === 'float') { const [x, y] = leapSpot(0); p.roof = true; p.b.x = x; p.b.y = y; p.lastRoof = [x, y];
    // the partner on the bunting rope, so the float swings in (and can roll away while nobody leaps)
    if (st.rope) { const [rx, ry] = run.spot(st.rope); const m = w.mate; m.seat = null; m.roof = false; m.b.x = rx; m.b.y = ry; m.ai = { ...m.ai, mode: 'hold', at: [rx, ry], story: true }; } }
  if (st.t === 'fares') { const f = run.fare; const r = w.addRide('tuktuk', f.x, f.y, 0); w.placePlayer(f.x, f.y); w.enter(r); idle(w, 0.5); r.b.x = f.x; r.b.y = f.y; }
  for (let k = 0; k < 300 * 60 && !w.failed && w.run === run && run.i === i; k++) {
    if (st.t === 'deliver' && st.fragile && !st.time && k % 30 === 0) run.onBump(400, 'car');
    w.step(NO_INPUT, DT); if (w.talk) w.talk = null;
    // the heat lanterns on the hero plaque are the meter for a heat job
    if (run.timer !== null || run.meter || run.meter2 || w.heat >= 1) shown = true;
  }
  return { why: w.failed?.reason ?? null, shown, t: st.t };
}
test('every job has at least one way to fail that shows a timer or meter first, with a reason on the card', () => {
  const kinds = new Set();
  for (const m of MISSIONS) {
    const steps = m.steps.map((st, i) => [st, i]).filter(([st]) => failable(st));
    assert.ok(steps.length, `${m.id} has a step that can fail`);
    let ok = 0;
    for (const [, i] of steps) { const r = provoke(m.id, i); if (r.why) { assert.ok(r.shown, `${m.id} step ${i} (${r.t}) showed a timer or meter before failing`); assert.ok(r.why.length > 10); ok++; kinds.add(r.t); } }
    assert.ok(ok >= 1, `${m.id}: a failure can be provoked`);
  }
  for (const k of ['chase', 'tail', 'escort', 'stealth', 'race', 'heat', 'float', 'collect', 'trade', 'deliver', 'case', 'heist', 'defend', 'blend', 'detective', 'trap', 'swap']) assert.ok(kinds.has(k), `a ${k} step can be failed`);
});
test('the fragile cargo wobble meter warns two bumps early and fails at the limit; mangoes bruise', () => {
  for (const id of ['m1', 'm9', 'm14']) {
    const i = MISSION[id].steps.findIndex(st => st.t === 'deliver' && st.fragile); const { w, run } = at(id, i); const st = run.cur;
    // knocks a second apart (one crash within a moment counts once)
    for (let k = 1; k < st.fragile; k++) { w.time += 1; run.onBump(400, 'car'); if (k === st.fragile - 2) assert.ok(run.warning, `${id} warns at ${k}`); }
    assert.equal(w.failed, null); assert.ok(run.meter.bad); run.onBump(400, 'car'); assert.equal(w.failed, null, 'a second jolt in the same crash is free'); w.time += 1; run.onBump(400, 'car'); assert.ok(w.failed, `${id} fails at ${st.fragile} bumps`);
    if (id === 'm1') assert.match(w.failed.reason, /mango/);
  }
});
test('the getaway meter fills while the thief is far ahead, drains when close, and warns before it fills', () => {
  const { w, run } = at('m2', MISSION.m2.steps.findIndex(st => st.t === 'chase'));
  const a = run.actors[0]; run.grace = 0;
  for (let k = 0; k < 60; k++) { a.b.x = w.p.x + 20 * T; a.stun = 1; w.step(NO_INPUT, DT); }
  const v = run.meter.v; assert.ok(v > 0.1, `fills (${v})`);
  for (let k = 0; k < 120; k++) { a.b.x = w.p.x + 60; a.b.y = w.p.y; a.stun = 1; w.step(NO_INPUT, DT); }
  assert.ok(run.meter.v < v, 'drains when close');
  run.meter.v = 0.59; for (let k = 0; k < 30; k++) { a.b.x = w.p.x + 20 * T; a.stun = 1; w.step(NO_INPUT, DT); } assert.ok(run.warning, 'warns');
  assert.ok(DIFF.easy.lost > DIFF.normal.lost && DIFF.normal.lost > DIFF.hard.lost, 'harder settings fill it faster');
});
test('the escort troupe meter fills when you leave the lion dance and fails with a clear reason', () => {
  const { w, run } = at('m8', MISSION.m8.steps.findIndex(st => st.t === 'escort'));
  w.placePlayer(w.p.x + 12 * T, w.p.y); const lion = run.actors[0];
  for (let k = 0; k < 60 * 20 && !w.failed; k++) { if (Math.hypot(lion.b.x - w.p.x, lion.b.y - w.p.y) < 600) w.placePlayer(lion.b.x + 10 * T, lion.b.y); w.step(NO_INPUT, DT); if (w.talk) w.talk = null; }
  assert.match(w.failed?.reason ?? '', /troupe/);
});

// ── item 3: set pieces and the finale
function chaseWith(id) { const i = MISSION[id].steps.findIndex(st => st.t === 'chase' && st.sets); return at(id, i); }
function trigger(run) { const a = run.actors[0]; for (const s of run.sets) { a.wp = Math.max(a.wp, s.def.wp); } }
test('set pieces: each heirloom chase has its own, telegraphed before it is live, and a hit costs time not health', () => {
  const kinds = {};
  for (const id of ['m5', 'm10', 'm15', 'm20']) {
    const { w, run } = chaseWith(id); assert.ok(run.sets.length, `${id} has set pieces`);
    for (const s of run.sets) kinds[s.def.k] = id;
    const a = run.actors[0]; trigger(run);
    for (const s of run.sets) {
      if (s.def.k === 'crane') { assert.equal(s.ph, 'go'); continue; }
      // bring the thief to the trigger (past it for the bridge and the gate, which close behind)
      a.b.x = s.x; a.b.y = s.y + (s.def.k === 'bridge' || s.def.k === 'gate' ? 2 * T : 0); a.stun = 5;
      w.step(NO_INPUT, DT); assert.equal(s.ph, 'warn', `${id} ${s.def.k} warns first`); assert.ok(run.warning, 'with a warning on screen');
      const tg = s.t; idle(w, 0.5); assert.equal(s.ph, 'warn', `${id} ${s.def.k} stays a warning for a moment`); void tg;
      idle(w, 3, () => s.ph !== 'warn'); assert.ok(s.ph === 'go' || s.ph === 'done', `${id} ${s.def.k} goes live`);
    }
  }
  assert.deepEqual(Object.keys(kinds).sort(), ['bridge', 'crane', 'drums', 'gate', 'stall']);
  assert.ok(telegraph({ w: { assist: true, s: { settings: { diff: 'easy' } } } }, 1) > telegraph({ w: { assist: false, s: { settings: { diff: 'hard' } } } }, 1), 'longer warnings on Assist');
});
test('set pieces: rubble, drums, the container and signs knock you back; the drawbridge and gate close their tiles; a retry resets them', () => {
  // the smashed stall's rubble
  let { w, run } = chaseWith('m5'); trigger(run); let s = run.sets[0]; let a = run.actors[0];
  a.b.x = s.x; a.b.y = s.y; a.stun = 9; w.step(NO_INPUT, DT); idle(w, 2, () => s.ph === 'go');
  assert.equal(s.rubble.length, 5);
  const c = s.rubble[0]; w.placePlayer(c.x, c.y); w.step(NO_INPUT, DT); assert.ok(c.hit && w.p.stunT > 0, 'rubble knocks you');
  // a retry from the checkpoint puts the stall back
  w.fail('test'); w.retry(); assert.equal(w.run.sets[0].ph, 'wait');
  // the container swings across the road: stand in its path and it hits
  ({ w, run } = chaseWith('m20')); const cr = run.sets.find(x => x.def.k === 'crane'); let hit = false;
  w.placePlayer(cr.x, cr.y); for (let k = 0; k < 60 * 4 && !hit; k++) { w.step(NO_INPUT, DT); w.placePlayer(cr.x, cr.y); if (w.p.stunT > 0) hit = true; } assert.ok(hit, 'the container hits');
  // the gate shuts its row
  const g = run.sets.find(x => x.def.k === 'gate'); a = run.actors[0]; a.wp = g.def.wp; a.b.x = g.x; a.b.y = g.y + 2 * T; a.stun = 30;
  w.placePlayer(g.x - 6 * T, g.y - 3 * T); idle(w, 4, () => g.ph === 'go'); assert.equal(g.ph, 'go'); w.step(NO_INPUT, DT);
  assert.ok(w.gates.has(g.def.at[1] * W + g.def.at[0]), 'the gateway tile is closed');
  // the drawbridge lowers behind the boat
  ({ w, run } = chaseWith('m15')); const br = run.sets[0]; a = run.actors[0]; a.wp = br.def.wp; a.b.x = br.x; a.b.y = br.y + 2 * T; a.stun = 30;
  idle(w, 6, () => br.down > 0.7); assert.ok(br.down > 0.6); w.step(NO_INPUT, DT); assert.ok(w.gates.size >= 3, 'the lowered bridge blocks boats');
  // the drums roll and the bell-cart chase keeps going
  ({ w, run } = chaseWith('m10')); const dr = run.sets[0]; a = run.actors[0]; a.wp = dr.def.wp; a.b.x = dr.x; a.b.y = dr.y; a.stun = 30;
  idle(w, 4, () => dr.ph === 'go'); idle(w, 0.8); assert.ok(dr.drums.some(d => d.on), 'drums rolling');
  const d0 = dr.drums.find(d => d.on); w.placePlayer(d0.x, d0.y + 20); w.step(NO_INPUT, DT); w.step(NO_INPUT, DT); assert.ok(w.p.stunT > 0, 'a drum knocks you');
});
test('Madame Glint: three phases with checkpoints, decoys, falling signs, and the leap onto her float', () => {
  const m = MISSION.m25; const p1 = m.steps.findIndex(st => st.phase === 1), p2 = m.steps.findIndex(st => st.phase === 2), fl = m.steps.findIndex(st => st.t === 'float');
  assert.ok(p1 > 0 && p2 > p1 && fl > p2 && m.steps[p1].cp && m.steps[p2].cp && m.steps[fl].cp, 'each phase is a checkpoint');
  // phase 1: decoys appear, look like her, and bumping one costs a moment
  let { w, run } = at('m25', p1); run.grace = 9; idle(w, 4, () => run.actors.some(a => a.kind === 'decoy'));
  const dec = run.actors.find(a => a.kind === 'decoy'); assert.ok(dec, 'decoys thrown');
  w.p.dashT = 0.2; w.placePlayer(dec.b.x, dec.b.y); w.p.dashT = 0.2; w.step(NO_INPUT, DT);
  assert.ok(w.p.stunT > 0 || !run.actors.includes(dec), 'a decoy bursts and stuns'); assert.equal(run.actors[0].kind, 'boss');
  // phase 2: a sign flickers (warn), falls, and a hit stops you and lets her pull away
  ({ w, run } = at('m25', p2)); run.grace = 9; idle(w, 4, () => run.signs.length > 0); const sg = run.signs[0]; assert.equal(sg.ph, 'warn');
  assert.ok(sg.warn >= 0.9, 'a readable warning'); w.placePlayer(sg.x, sg.y); idle(w, 2, () => sg.ph === 'wreck'); assert.ok(sg.hit && w.p.stunT > 0, 'the sign hits a player standing in its shadow');
  // phase 3: the float rolls when you reach the ladder; a leap in the window wins the drum, a miss tumbles
  ({ w, run } = at('m25', fl)); const f = run.float; assert.ok(f && !f.moving);
  const [x0, y0] = leapSpot(0); w.p.roof = true; w.p.b.x = x0; w.p.b.y = y0; w.p.lastRoof = [x0, y0];
  // the two-hero phase: the float waits out of reach until the partner hauls the bunting rope
  w.s.settings.assist = false; w.mate.ai = { ...w.mate.ai, mode: 'follow', story: false }; w.step(NO_INPUT, DT); assert.ok(!f.moving, 'no rope, no float');
  const st = m.steps[fl]; const [rx, ry] = run.spot(st.rope); w.mate.seat = null; w.mate.roof = false; w.mate.b.x = rx; w.mate.b.y = ry; w.mate.ai = { ...w.mate.ai, mode: 'hold', at: [rx, ry], story: true };
  idle(w, 1, () => f.moving); w.s.settings.assist = true; assert.ok(f.moving, 'the float sets off');
  assert.equal(inWindow(run), -1); assert.ok(run.leap(), 'leap too soon'); idle(w, 1); assert.ok(!f.done, 'a miss'); assert.equal(w.p.roof, true, 'back on the roof');
  idle(w, 20, () => inWindow(run) === 0); assert.equal(inWindow(run), 0); w.p.b.x = x0; w.p.b.y = y0;
  assert.ok(run.leap()); idle(w, 1); assert.ok(f.done, 'landed on the float'); assert.equal(run.cur.t, 'pickup'); assert.ok(run.loot, 'the Phoenix Drum drops');
  // and if it rolls out of the Strip, it is gone
  ({ w, run } = at('m25', fl)); w.p.roof = true; w.p.b.x = x0; w.p.b.y = y0 + T; w.p.lastRoof = [x0, y0 + T]; w.mate.seat = null; w.mate.roof = false; w.mate.b.x = rx; w.mate.b.y = ry; w.mate.ai = { ...w.mate.ai, mode: 'hold', at: [rx, ry], story: true }; idle(w, 120); assert.match(w.failed?.reason ?? '', /float/); assert.ok(run.float.x <= FLOAT_END + 5);
  w.retry(); assert.ok(w.run.float && !w.run.float.moving && !w.run.float.done, 'retry resets the float');
});

// ── item 5: businesses
test('businesses: eleven stalls (five at the hawker centre) and fifteen more properties across the districts, prices rise with value, and income follows level, reputation and events', () => {
  assert.equal(BIZ.length, 62); assert.equal(BIZ.filter(b => ['ckt', 'chicken', 'satay', 'laksa', 'kopi'].includes(b.id)).length, 5, 'the five hawker stalls'); assert.ok(new Set(BIZ.map(b => b.d)).size >= 5, 'spread across the districts');
  for (const b of BIZ) { assert.ok(b.income[1] < b.income[2] && b.income[2] < b.income[3]); assert.ok(b.price < b.up[0] + b.up[1]); assert.ok(b.price / b.income[1] >= 3, `${b.id}: pays back in three nights or more`); }
  const s = newSave(4); s.rep = { market: 50, temple: 50, canal: 50, docks: 50, arcade: 50 }; s.cash = 99999;
  assert.match(canBuy(s, 'jade', ['market']), /fog/); s.rep.market = 0; assert.match(canBuy(s, 'noodle', ALL_OPEN), /reputation/); s.rep.market = 50;
  assert.equal(buyBiz(s, 'noodle', ALL_OPEN), null); assert.equal(s.biz.noodle.lvl, 1); assert.equal(s.cash, 99999 - BIZ_OF.noodle.price);
  // the rate: level income × (0.75 + rep/200) × weather, events, tips
  const plain = n => { s.night = n; return bizRate(s, 'noodle', ALL_OPEN).rate; };
  let found = 0;
  for (let night = 1; night < 40 && found < 3; night++) { const ev = nightEvent(s.seed, night, ALL_OPEN); const r = plain(night); const base = BIZ_OF.noodle.income[1] * (0.75 + 50 / 200);
    if (ev.kind === 'calm' && bizRate(s, 'noodle', ALL_OPEN).parts.length === 1) { assert.equal(r, Math.round(base)); found++; } }
  assert.ok(found, 'a plain night pays the base rate');
  s.rep.market = 100; const hi = bizRate(s, 'noodle', ALL_OPEN).rate; s.rep.market = 20; assert.ok(bizRate(s, 'noodle', ALL_OPEN).rate < hi, 'reputation lifts takings');
  assert.ok(bizRate(s, 'noodle', ALL_OPEN, { festival: true }).rate > bizRate(s, 'noodle', ALL_OPEN).rate, 'the festival lifts takings');
  assert.ok(bizRate(s, 'noodle', ALL_OPEN, { daily: { good: 'bowl' } }).rate > bizRate(s, 'noodle', ALL_OPEN).rate, 'the daily event for its goods lifts takings');
  assert.equal(upgradeBiz(s, 'noodle'), null); assert.equal(s.biz.noodle.lvl, 2); assert.equal(upgradeBiz(s, 'noodle'), null); assert.match(upgradeBiz(s, 'noodle'), /Fully/);
  assert.notEqual(bizSprite('noodle', 3), bizSprite('noodle', 1), 'each level has its own painting');
  for (const b of BIZ) for (let l = 0; l <= 3; l++) assert.ok(FRAMES[bizSprite(b.id, l)], `${b.id} level ${l} painted`);
});
test('businesses: a night accrues its rate, the till holds three nights, history is kept, collecting pays out', () => {
  const s = newSave(8); s.done = MISSIONS.map(m => m.id); s.rep.market = 40; s.cash = 5000; const w = new World(s, 8); w.quiet = true;
  buyBiz(s, 'noodle', [...w.open]); const r = bizRate(s, 'noodle', [...w.open], { daily: w.event, festival: w.festival }).rate;
  accrue(w, 720); assert.ok(Math.abs(s.biz.noodle.tonight - r) < 1e-6, 'a whole night earns the rate');
  closeNight(s); assert.deepEqual(s.biz.noodle.hist, [Math.round(r)]); assert.equal(s.bizLog.length, 1); assert.equal(s.biz.noodle.tonight, 0);
  for (let k = 0; k < 6; k++) accrue(w, 720); assert.ok(s.biz.noodle.bank <= r * 3 + 1, 'the till is capped at three nights');
  const before = s.cash, till = tillTotal(s); assert.equal(collect(s), till); assert.equal(s.cash, before + till); assert.equal(tillTotal(s), 0);
  // the clock drives it: playing a night through fills the till; the history keeps ten nights at most
  w.s.clock = 0; for (let k = 0; k < 60 * 30; k++) w.step(NO_INPUT, DT); assert.ok(s.biz.noodle.bank > 0);
  for (let k = 0; k < 14; k++) { accrue(w, 720); closeNight(s); } assert.equal(s.biz.noodle.hist.length, 10);
  // collecting at the stall or at a safe house
  s.biz.noodle.bank = 50; assert.equal(w.collectBiz('noodle'), 50); s.biz.noodle.bank = 30; assert.equal(w.collectBiz(), 30);
});
test('business balance: the empire is the long goal: owning everything costs a lot and pays back in days, not minutes', () => {
  const s = newSave(2); for (const d of Object.keys(s.rep)) s.rep[d] = 60;
  const spend = BIZ.reduce((a, b) => a + b.price + b.up[0] + b.up[1], 0); for (const b of BIZ) s.biz[b.id].lvl = 3;
  const nightly = BIZ.reduce((a, b) => a + bizRate(s, b.id, [...ALL_OPEN, 'heartland', 'bay', 'india', 'glam', 'resort']).rate, 0);
  assert.ok(spend > 60000, `owning everything costs ${spend}`); assert.ok(spend / nightly > 3 && spend / nightly < 8, `pays back in ${(spend / nightly).toFixed(1)} nights`);
});
test('crow raids (the old grab-and-run job, now one of the empire raids): idle and they escape, catch them and the till is safe', () => {
  const s = newSave(8); s.done = MISSIONS.map(m => m.id); s.rep.market = 40; s.cash = 5000; const w = new World(s, 8); w.quiet = true;
  buyBiz(s, 'noodle', [...w.open]); s.biz.noodle.bank = 200;
  let raids = 0; for (let night = 1; night <= 40; night++) { s.night = night; if (raidCheck(w, 230, 250) || raidCheck(w, 470, 490)) raids++; }
  assert.ok(raids > 3 && raids < 30, `raids now and then (${raids} in 40 nights)`);
  assert.equal(raidCheck(w, 100, 120), null, 'only at the raid hours');
  // lose: stand still, they get away; giving up counts as a missed raid (this night's takings go)
  w.startMission(raidMission(w, 'noodle'), { key: 'raid:noodle', reward: 40, d: 'market' }); w.talk = null;
  const run = w.run; run.enter(1); idle(w, 30); assert.match(w.failed?.reason ?? '', /crows/);
  const bank = s.biz.noodle.bank; w.quitJob(); assert.ok(s.biz.noodle.bank < bank, 'the gang took coins'); assert.equal(s.biz.noodle.raids, 1); assert.equal(s.biz.noodle.missed, 1);
  // win: dash into each one
  w.startMission(raidMission(w, 'noodle'), { key: 'raid:noodle', reward: 40, d: 'market' }); w.talk = null; const r2 = w.run; r2.enter(1);
  const cash = s.cash;
  for (let k = 0; k < 60 * 30 && w.run === r2; k++) { const a = r2.actors.find(x => !x.gone && x.stun <= 0); if (a) { w.placePlayer(a.b.x, a.b.y); w.p.dashT = 0.2; } w.step(NO_INPUT, DT); }
  assert.equal(w.run, null); assert.equal(s.biz.noodle.defended, 1); assert.equal(s.cash, cash + 40); assert.equal(raidLost(newSave(1), 'noodle'), 0);
});

// ── saves
test('save: real v2 and v3 saves migrate with every bit of progress, and businesses start empty', () => {
  assert.equal(SAVE_VERSION, 13); assert.equal(SAVE_KEY, 'jade-street-v13'); assert.ok(OLD_KEYS.includes('jade-street-v3') && OLD_KEYS.includes('jade-street-v2'));
  const v3 = JSON.parse(readFileSync(new URL('./fixtures/jade-save-v3.json', import.meta.url), 'utf8'));
  assert.equal(v3.v, 3);
  const s = loadSave(JSON.stringify(v3));
  assert.equal(s.v, SAVE_VERSION);
  for (const k of ['seed', 'hero', 'cash', 'night', 'clock', 'started', 'done', 'cats', 'murals', 'cargo', 'stash', 'upgrades', 'paint', 'outfit', 'safes', 'trophies', 'tips', 'medals', 'story', 'learned', 'msgs', 'radio', 'helped', 'best', 'daily', 'dailyDone'].filter(k => k !== 'story')) assert.deepEqual(s[k], v3[k], `v3 ${k} kept`);
  // the island added districts to the reputation book and a page to the story: every old entry is kept
  for (const k of Object.keys(v3.rep)) assert.equal(s.rep[k], v3.rep[k], `v3 rep.${k} kept`);
  for (const k of Object.keys(v3.story)) assert.deepEqual(s.story[k], v3.story[k], `v3 story.${k} kept`);
  for (const k of Object.keys(v3.stats)) assert.equal(s.stats[k], v3.stats[k], `v3 stats.${k} kept`);
  for (const k of Object.keys(v3.settings)) assert.equal(s.settings[k], v3.settings[k], `v3 settings.${k} kept`);
  assert.equal(s.settings.calm, false); assert.deepEqual(s.bizLog, []); for (const b of BIZ) assert.equal(s.biz[b.id].lvl, 0);
  assert.deepEqual(loadSave(JSON.stringify(s)), s, 'round trip');
  const live2 = { v: 2, seed: 77, hero: 'enzo', cash: 640, night: 6, clock: 120, started: true, done: ['m1', 'm2', 'm3', 'm4', 'm5', 'm6'], cats: [2, 4], murals: [], rep: { market: 30, temple: 8, canal: 0, docks: 0, arcade: 0 },
    cargo: { jade: 1, mooncake: 0, tea: 2, bowl: 0, fan: 0, mango: 0 }, stash: {}, upgrades: { speed: 1, cargo: 0, grip: 0 }, paint: 'red', outfit: { dora: 'classic', enzo: 'classic' }, safes: ['safe-market'], trophies: [], tips: [], dailyDone: [],
    stats: { missions: 6, playTime: 900 }, settings: { diff: 'normal', assist: true, sound: true, music: true, touch: 'auto' } };
  const s2 = loadSave(JSON.stringify(live2));
  assert.equal(s2.v, SAVE_VERSION); assert.equal(s2.cash, 640); assert.deepEqual(s2.done, live2.done); assert.equal(s2.story.ch, chapterOf(s2)); assert.equal(s2.settings.diff, 'normal');
  assert.equal(s2.settings.calm, false); assert.equal(s2.biz.noodle.lvl, 0); assert.equal(s2.stats.bizCoins, 0);
  // a v4 save with a business keeps it, and junk is repaired
  const own = newSave(3); own.biz.tea = { lvl: 2, bank: 55.5, tonight: 3, hist: [100, 120], raids: 1, defended: 1, dmg: 0, jaga: false, boost: 0, boostK: 1, missed: 0 }; own.bizLog = [220];
  assert.deepEqual(loadSave(JSON.stringify(own)).biz.tea, own.biz.tea);
  const junk = loadSave(JSON.stringify({ ...own, biz: { tea: { lvl: 9, bank: -4, hist: ['x', 5] } } }));
  assert.equal(junk.biz.tea.lvl, 3); assert.equal(junk.biz.tea.bank, 0); assert.deepEqual(junk.biz.tea.hist, [5]);
});

// ── item 4: portraits and art
test('every line of dialogue has a mood with its own painted portrait for the speaker', () => {
  let lines = 0;
  for (const m of MISSIONS) for (const st of m.steps) if (st.t === 'talk') for (const [who, text, mood] of st.lines) {
    lines++; assert.ok(MOODS.includes(mood), `${m.id} "${text.slice(0, 30)}" has a mood (${mood})`);
    const speakers = who === 'hero' || who === 'mate' ? ['dora', 'enzo'] : [who];
    for (const sp of speakers) { const base = PEOPLE[sp]?.face ?? `face-${sp}`; assert.ok(FRAMES[base], `${base} painted`); if (mood !== 'calm') assert.ok(FRAMES[`${base}-${mood}`], `${base}-${mood} painted`); }
  }
  assert.ok(lines >= 90, `${lines} lines`);
  for (const who of ['kee', 'pang', 'mo', 'heron', 'kiri', 'bo', 'gizmo', 'ren', 'glint', 'pip', 'bristle', 'lim', 'dora', 'enzo']) for (const md of ['happy', 'worried', 'cross', 'smug']) assert.ok(FRAMES[`face-${who}-${md}`], `face-${who}-${md}`);
  const moods = new Set(MISSIONS.flatMap(m => m.steps.filter(st => st.t === 'talk').flatMap(st => st.lines.map(l => l[2])))); assert.ok(moods.size === 5, 'all five moods are used');
});
test('the third batch of paintings: hero actions, Glint, set pieces, debris and stalls are all in the atlases', () => {
  for (const h of ['dora', 'enzo']) for (const a of ['leap-0', 'leap-1', 'land', 'duck', 'shoo-0', 'shoo-1', 'collect', 'pocket', 'deal', 'mend', 'skid', 'tumble']) assert.ok(FRAMES[`${h}-${a}`], `${h}-${a}`);
  for (const f of ['glint-run-0', 'glint-taunt', 'glint-leap', 'glint-dizzy', 'decoy-ride-0', 'decoy-ride-1', 'stall-smash-0', 'stall-smash-1', 'drum-roll-0', 'drum-rack', 'warn-bell', 'bridge-up', 'bridge-mid', 'bridge-down', 'crane-load', 'gate-open', 'gate-shut', 'neon-sign', 'neon-fall', 'neon-wreck', 'float', 'db-orange', 'db-feather-b', 'db-spark', 'db-paper', 'db-coin', 'db-dust']) {
    const fr = FRAMES[f]; assert.ok(fr, f); assert.ok(fr[3] > 8 && fr[4] > 8, `${f} has size`);
  }
});

console.log(`jade (third pass): ${n} tests ok`);

// the fourth pass: both heroes, tag-team moves, gadgets, two players, save v5
await import('./jade-duo.mjs');
