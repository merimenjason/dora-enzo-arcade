// Jade Street engine tests, seventh pass (run by tests/jade-island.mjs): the job steps that make a job more than a
// chase. Casing (photos from cover, intel kept to the next step and over a checkpoint), the heist (quiet with the back
// door only when cased, cameras and paint, the alarm turning it loud, the confetti diversion, the safe, the getaway's
// heat and its medal allowance), holding a stall against waves (grabs, knocking them back, tidying up), the disguise
// (the rack, a calm walk among the crowd, running and staring, the newspaper), the detective (right and wrong
// questions, no pin, the clue notebook, the Assist ring, searching), traps (nets, bait, springing early and on time,
// being seen), the crate swap (guards turning round, the partner's distraction), the safe dial, the variety rule for
// the job list, and save v8 migrating from v7 with medals kept.
import { BRANCHES } from '../.checks/jade-jobs.js';
import assert from 'node:assert/strict';
import { World, DT, NO_INPUT } from '../.checks/jade-game.js';
import { MISSIONS, MISSION, SIDE } from '../.checks/jade-story.js';
import { newSave, loadSave, SAVE_VERSION, TROPHIES, checkTrophies } from '../.checks/jade-save.js';
import { JOB_STEPS, INTEL, hiddenSpot, jobNear } from '../.checks/jade-jobs.js';
import { SafeGame, makeMini } from '../.checks/jade-mini.js';
import { heatAllowed, PAR, goals } from '../.checks/jade-medals.js';
import { FRAMES, PLAIN } from '../.checks/jade-art.js';
import { tagOption } from '../.checks/jade-tag.js';
import { playMission, missionSave } from './jade-bot.mjs';

let n = 0;
const test = (name, f) => { try { f(); n++; } catch (e) { console.error('FAILED:', name); throw e; } };
const ALL = [...MISSIONS, ...SIDE];
/** a world at step i of a job, talk skipped */
function at(id, i, o = {}) {
  const s = missionSave(id, { assist: o.assist ?? false, diff: o.diff ?? 'normal' });
  const w = new World(s, o.seed ?? 9); w.quiet = true;
  w.startMission(MISSION[id]); w.talk = null;
  const run = w.run; run.snap = run.snapshot(i); run.enter(i); w.talk = null;
  // pass 8: the branch cards on a blend, trap or detective step; these tests take the first way unless told
  if (run.js && BRANCHES[run.cur.t]) run.js.pick = o.pick ?? BRANCHES[run.cur.t][0];
  return { w, run, st: run.cur };
}
const stepOf = (id, t) => MISSION[id].steps.findIndex(s => s.t === t);
const idle = (w, sec, inp = NO_INPUT, until = () => false) => { for (let k = 0; k < sec * 60 && !w.failed && !until(); k++) { w.step(inp, DT); if (w.talk) w.talk = null; } };
const act = w => { w.findNear(); w.step({ ...NO_INPUT, act: true }, DT); };

test('seven new step kinds, each in at least two jobs, and every job keeps its giver and story', () => {
  assert.deepEqual([...JOB_STEPS], ['case', 'heist', 'defend', 'blend', 'detective', 'trap', 'swap']);
  for (const k of JOB_STEPS) assert.ok(ALL.filter(m => m.steps.some(s => s.t === k)).length >= 2, `${k} in two jobs`);
  assert.equal(SIDE.length, 13); assert.deepEqual(SIDE.slice(7, 10).map(m => m.id), ['k8', 'k9', 'k10']);
  for (const [id, k] of [['k8', 'heist'], ['k9', 'swap'], ['k10', 'trap']]) assert.ok(MISSION[id].steps.some(s => s.t === k), `${id} shows off a ${k}`);
  assert.equal(MISSION.m17.giver, 'bo'); assert.equal(MISSION.m26.giver, 'glint'); assert.equal(MISSION.k4.giver, 'hoon');
});

test('variety: chases are the climax of at most a third of the jobs, and every chapter mixes four kinds of main step', () => {
  const TRIVIAL = new Set(['talk', 'goto', 'ride', 'pickup', 'post', 'switch']);
  const main = m => m.steps.filter(s => !TRIVIAL.has(s.t));
  const chaseEnd = ALL.filter(m => { const ms = main(m); const last = ms[ms.length - 1]; return last && (last.t === 'chase' || last.t === 'bag'); });
  assert.ok(chaseEnd.length * 3 <= ALL.length, `${chaseEnd.length} of ${ALL.length} end in a chase`);
  for (let ch = 0; ch <= 7; ch++) {
    const kinds = new Set(ALL.filter(m => m.ch === ch).flatMap(m => main(m).map(s => s.t)));
    assert.ok(kinds.size >= 4, `chapter ${ch}: ${[...kinds]}`);
  }
});

test('casing: E photographs a spot in view and in range, each photo is intel, and the guards fail you on sight', () => {
  const i = stepOf('m17', 'case'), { w, run, st } = at('m17', i);
  assert.equal(run.meter.name, 'Alert'); assert.match(run.progress, /Photos 0\/3/);
  // stand by the back door (well clear of the guards) and take its photo
  const [dx, dy] = run.spot(st.spots[0].at); w.placePlayer(dx, dy + 120); idle(w, 0.2);
  const near = jobNear(run, w.p.x, w.p.y); assert.ok(near && near.id === 'photo:0', JSON.stringify(near));
  act(w); assert.equal(w.p.act?.n, 'photo'); idle(w, 1);
  assert.ok(run.items[0].got && run.intel.includes('door')); assert.match(run.progress, /Photos 1\/3/);
  // too far away: no photo offered
  w.placePlayer(dx + 900, dy + 400); idle(w, 0.1); assert.ok(!jobNear(run, w.p.x, w.p.y)?.id?.startsWith('photo:0'));
  // in front of a guard's torch: the Alert meter fills, a warning, then the fail card
  const { w: w2, run: r2 } = at('m17', i), g = r2.actors[0];
  idle(w2, 2); w2.placePlayer(g.b.x + Math.cos(g.b.h) * 60, g.b.y + Math.sin(g.b.h) * 60);
  let warned = false; for (let k = 0; k < 600 && !w2.failed; k++) { w2.step(NO_INPUT, DT); if (r2.warning) warned = true; }
  assert.ok(warned && w2.failed && /spotted|caught/i.test(w2.failed.reason), String(w2.failed?.reason));
  for (const k of Object.keys(INTEL)) assert.ok(INTEL[k].gain.length > 10);
});

test('the heist: quiet or loud on a panel; the back door only when cased; the alarm turns it loud; intel survives a checkpoint', () => {
  const i = stepOf('m17', 'heist');
  let { w, run, st } = at('m17', i); idle(w, 0.1);
  assert.equal(w.ui?.kind, 'heist', 'the choice panel'); run.heistPick('quiet'); assert.equal(w.ui, null);
  assert.deepEqual(run.js.entry, run.spot(st.front), 'not cased: in by the front');
  ({ w, run, st } = at('m17', i)); run.intel = ['door', 'cam']; run.enter(i); idle(w, 0.1); run.heistPick('quiet');
  assert.deepEqual(run.js.entry, run.spot(st.back), 'cased: the back door');
  assert.ok(run.actors.filter(a => a.kind === 'cam').every(a => a.extra2 > 1e8), 'cased cameras are off');
  // in at the back, then seen: the alarm, heat and a timer; not a failure
  w.placePlayer(...run.spot(st.back)); idle(w, 0.5); assert.ok(run.js.entered);
  const g = run.actors.find(a => a.kind === 'guard'); g.extra = 0; run.grace = 0;
  for (let k = 0; k < 400 && run.js.mode === 'quiet'; k++) { w.p.b.x = g.b.x + Math.cos(g.b.h) * 50; w.p.b.y = g.b.y + Math.sin(g.b.h) * 50; w.step(NO_INPUT, DT); }
  assert.equal(run.js.mode, 'loud'); assert.ok(run.js.alarm && w.heat >= 2 && run.timer > 0 && !w.failed);
  // the safe: a mini-game, one number fewer when cased; cracking it is a checkpoint with the loot in paw
  w.placePlayer(...run.spot(st.safe)); idle(w, 1.2, NO_INPUT, () => w.ui?.kind === 'mini');
  assert.equal(w.ui?.kind, 'mini'); assert.equal(w.ui.mini, 'safe'); assert.equal(w.ui.level, st.level);
  w.miniDone(true); assert.equal(w.p.carry, st.loot); assert.equal(run.phase, 4); assert.ok(w.heat >= 3);
  // the getaway: a scooter waits by the safe, the drop clears the heat and finishes the step
  assert.ok(w.rides.some(r => r.kind === 'scooter' && Math.hypot(r.b.x - w.p.x, r.b.y - w.p.y) < 300));
  w.fail('test'); w.retry(); idle(w, 0.1);
  assert.equal(run.i, i); assert.ok(run.intel.includes('door'), 'intel survives the checkpoint'); assert.equal(run.js.ph, 3, 'back on the way out'); assert.equal(w.ui, null);
  w.placePlayer(...run.spot(st.drop)); idle(w, 0.3); assert.ok(run.i > i, 'the drop ends the heist'); assert.ok(w.heat < 1);
  assert.equal(heatAllowed(MISSION.m17), 3); assert.match(goals(MISSION.m17)[1], /3 lanterns/);
});

test('the loud heist: the partner’s confetti dazes the guards and turns the cameras off; the timer fails you', () => {
  const i = stepOf('k8', 'heist'); const { w, run, st } = at('k8', i); idle(w, 0.1); run.heistPick('loud');
  assert.equal(w.mate.ai.mode, 'post'); w.placePlayer(...run.spot(st.front)); w.mate.b.x = w.p.x + 30; w.mate.b.y = w.p.y; idle(w, 0.3);
  assert.ok(run.js.div); assert.ok(run.actors.filter(a => a.kind === 'guard').every(a => a.hits === 1 && a.extra2 > 0), 'dazed');
  assert.ok(w.heat >= 2 && run.timer > 0);
  // idle: the timer runs out (with the heat cleared so the wardens don't get there first)
  for (let k = 0; k < 200 * 60 && !w.failed; k++) { w.clearHeat(); w.step(NO_INPUT, DT); } assert.ok(w.failed && /time/i.test(w.failed.reason), String(w.failed?.reason));
});

test('the safe dial: the right way round, the lamp, set; a wrong set costs time; Assist widens the window', () => {
  const g = makeMini('safe', { level: 2, assist: false, seed: 4 }); assert.ok(g instanceof SafeGame); assert.equal(g.nums.length, 3);
  assert.equal(new SafeGame({ level: 1, assist: true, seed: 4 }).nums.length, 2); assert.ok(new SafeGame({ level: 1, assist: true, seed: 4 }).win > g.win);
  const t0 = g.time; g.set(); assert.equal(g.misses, 1); assert.ok(g.time < t0 - 2.9, 'a wrong set costs time');
  for (let n = 0; n < 3; n++) {
    const d = g.dirs[n]; g.hold(d); let k = 0;
    while (!g.glowing() && k++ < 4000) g.step(1 / 60);
    assert.ok(g.glowing(), `number ${n} lights the lamp`); g.hold(0); g.set();
  }
  assert.ok(g.done); assert.ok(g.ev.some(e => e.t === 'open'));
  // turning the wrong way never lights it
  const h = new SafeGame({ level: 1, assist: false, seed: 9 }); h.hold(-h.dirs[0]); for (let k = 0; k < 600; k++) { h.step(1 / 60); assert.ok(!h.glowing()); }
});

test('holding a stall: waves come, a grab dents the meter, a dash knocks them back, tidying mends between waves', () => {
  const i = stepOf('k4', 'defend'); const { w, run, st } = at('k4', i);
  assert.equal(run.meter.name, 'Stall'); assert.equal(w.mate.ai.mode, 'guard');
  idle(w, 4); assert.ok(run.actors.some(a => a.kind === 'pest'), 'the first wave'); assert.match(run.progress, /Wave 1\/2/);
  // a raider shoved by a dash flees
  const a = run.actors.find(x => x.kind === 'pest'); w.placePlayer(a.b.x - 20, a.b.y); w.p.dashT = 0.2; w.p.b.speed = 400; run.step(DT, NO_INPUT);
  assert.equal(a.extra, 2, 'knocked back');
  // stand aside: they grab, the stall meter drops, and in the end it fails with a reason
  w.placePlayer(...run.spot(st.at)); w.p.b.y += 900; w.mate.ai = { ...w.mate.ai, mode: 'stay' };
  idle(w, 40); assert.ok(run.js.hp < 1 || w.failed, 'grabbed');
  const { w: w2, run: r2 } = at('k4', i); w2.s.settings.partner = 'tag'; r2.js.hp = 0.5; r2.js.wave = 1; w2.placePlayer(...r2.spot(st.at)); r2.actors = []; idle(w2, 0.1);
  const nr = jobNear(r2, w2.p.x, w2.p.y); assert.equal(nr?.id, 'mend'); act(w2); idle(w2, 1.5); assert.ok(r2.js.hp > 0.55, 'tidied');
  const { w: w3, run: r3 } = at('k4', i); w3.placePlayer(...r3.spot(st.at)); w3.p.b.y += 2000; w3.mate.ai = { ...w3.mate.ai, mode: 'stay' }; w3.mate.b.y += 2000;
  idle(w3, 120); assert.ok(w3.failed && /stall/i.test(w3.failed.reason), String(w3.failed?.reason));
});

test('blending in: the coat from the rack (a checkpoint), calm in the crowd, running and staring, the newspaper', () => {
  const i = stepOf('m12', 'blend'); const { w, run, st } = at('m12', i);
  assert.equal(run.actors.filter(a => a.kind === 'crowd').length, st.crowd); assert.equal(w.mate.ai.mode, 'stay');
  w.placePlayer(...run.spot(st.rack)); idle(w, 0.1); assert.equal(jobNear(run, w.p.x, w.p.y)?.id, 'disguise');
  act(w); idle(w, 1.2); assert.ok(w.p.disguise && run.js.ph === 1 && run.snap.phase === 1);
  // dashing right in front of a lookout: Suspicion climbs fast and fails
  const L = run.actors.find(a => a.kind === 'watcher'); run.actors.forEach(a => { if (a.kind === 'crowd') a.b.x = -9999; });
  w.placePlayer(L.b.x + Math.cos(L.b.h) * 140, L.b.y + Math.sin(L.b.h) * 140);
  let k = 0; for (; k < 600 && !w.failed; k++) w.step({ ...NO_INPUT, dash: k % 30 === 0, mx: Math.sin(k / 20), my: Math.cos(k / 20) }, DT);
  assert.ok(w.failed && /disguise/i.test(w.failed.reason), String(w.failed?.reason));
  // the retry puts the coat back on, at the rack
  w.retry(); idle(w, 0.2); assert.ok(w.p.disguise, 'still in disguise after the checkpoint');
  // the newspaper drains Suspicion and hides you
  run.meter.v = 0.7; w.findNear(); assert.equal(w.near?.id, 'paper'); act(w); assert.equal(w.p.act?.n, 'paper'); idle(w, 1.5); assert.ok(run.meter.v < 0.5);
  // the goal takes the coat off
  w.placePlayer(...run.spot(st.goal)); idle(w, 0.2); assert.ok(run.i > i && !w.p.disguise);
  // Assist keeps you to a walk in the coat
  const { w: wa, run: ra } = at('m12', i, { assist: true }); ra.js.ph = 1; wa.p.disguise = true; idle(wa, 1, { ...NO_INPUT, mx: 1 }); assert.ok(wa.p.b.speed <= 150, `walks (${wa.p.b.speed})`);
});

test('the detective: the right question gives a clue, a wrong one costs time; nothing is pinned; search the spot that fits', () => {
  const i = stepOf('m26', 'detective'); const { w, run, st } = at('m26', i);
  const h = hiddenSpot(st); assert.ok(h >= 0); assert.equal(st.spots.filter(s => st.witnesses.every(x => s.tags.includes(x.tag))).length, 1, 'exactly one spot fits');
  assert.equal(run.target()?.length, 2, 'the arrow points at a witness'); assert.equal(run.notes.length, 0);
  const wa = run.actors.find(a => a.kind === 'witness' && a.extra === 0); w.placePlayer(wa.b.x, wa.b.y + 50); idle(w, 0.1);
  assert.equal(jobNear(run, w.p.x, w.p.y)?.id, 'ask:0'); act(w); idle(w, 0.5); assert.equal(w.ui?.kind, 'ask');
  const t0 = run.timer; run.askPick((st.witnesses[0].right + 1) % 3); assert.equal(w.ui.ok, false); assert.ok(run.timer < t0 - 7, 'a wrong question costs time');
  run.askClose(); act(w); idle(w, 0.5); run.askPick(st.witnesses[0].right); assert.equal(w.ui.ok, true); assert.equal(run.notes.length, 1); run.askClose();
  for (let k = 1; k < st.witnesses.length; k++) { run.js.clues.push(k); }
  assert.equal(run.target(), null, 'all clues in: no pin, you work it out');
  // a wrong spot: nothing there, time lost
  const wrong = h === 0 ? 1 : 0; w.placePlayer(run.items[wrong].x, run.items[wrong].y + 30); idle(w, 0.1); assert.equal(jobNear(run, w.p.x, w.p.y)?.id, `search:${wrong}`);
  act(w); idle(w, 1.5); assert.ok(run.js.searched.includes(wrong) && run.i === i);
  w.placePlayer(run.items[h].x, run.items[h].y + 30); idle(w, 0.1); act(w); idle(w, 1.5); assert.ok(run.i > i, 'found it'); assert.equal(w.p.carry, st.item);
  // Assist draws a ring that narrows with each clue, never a pin
  const { run: ra } = at('m26', i, { assist: true }); ra.js.clues = [0]; ra.step(DT, NO_INPUT); const r1 = ra.hint.r; ra.js.clues = [0, 1, 2]; ra.step(DT, NO_INPUT); assert.ok(ra.hint.r < r1 && ra.hint.r >= 150);
  // the timer is the fail state
  const { w: wt } = at('m26', i); idle(wt, 400); assert.ok(wt.failed && /time/i.test(wt.failed.reason));
});

test('traps: lay the nets and the bait, then F springs the net with one on it; too early wastes a net; being seen scares them', () => {
  const i = stepOf('m27', 'trap'); const { w, run, st } = at('m27', i);
  for (let k = 0; k < st.need; k++) { w.placePlayer(run.items[k].x, run.items[k].y + 20); idle(w, 0.1); assert.equal(jobNear(run, w.p.x, w.p.y)?.id, `set:${k}`); act(w); idle(w, 1.1); }
  assert.equal(run.js.ph, 1); w.placePlayer(...run.spot(st.bait)); idle(w, 0.1); act(w); idle(w, 1); assert.equal(run.js.ph, 2);
  w.placePlayer(...run.spot(st.wait)); idle(w, 0.1);
  assert.match(tagOption(w)?.label ?? '', /net/i);
  // too early: a net spent, a warning
  w.step({ ...NO_INPUT, tag: true }, DT); assert.equal(run.js.sprung.length, 1); assert.equal(run.js.caught, 0);
  // wait for one on a live net, then spring
  let caught = 0;
  for (let k = 0; k < 60 * 60 && !w.failed && run.i === i; k++) {
    const on = run.js.set.some(j => !run.js.sprung.includes(j) && run.actors.some(a => a.kind === 'lured' && a.extra === 0 && Math.hypot(a.b.x - run.items[j].x, a.b.y - run.items[j].y) < 40));
    w.step({ ...NO_INPUT, tag: on }, DT); caught = run.i > i ? 99 : Math.max(caught, run.js?.caught ?? 0);
  }
  assert.ok(caught >= 1, 'netted one');
  // standing on their path: they see you and run
  const { w: w2, run: r2, st: s2 } = at('k10', stepOf('k10', 'trap')); r2.js.set = [0, 1, 2]; r2.js.ph = 2; r2.js.queue = s2.n; r2.js.spawnT = 0;
  w2.placePlayer(...r2.spot(s2.path[1])); idle(w2, 30); assert.ok(r2.js.escaped >= 1); assert.ok(w2.failed && /got away/i.test(w2.failed.reason), String(w2.failed?.reason));
});

test('the crate swap: E at a crate is a crouched moment; seen mid-swap fills Alert fast; F has the partner distract a guard', () => {
  const i = stepOf('k9', 'swap'); const { w, run, st } = at('k9', i);
  assert.equal(w.p.carry, st.decoy); assert.ok(run.timer > 0); assert.match(run.progress, /Swapped 0\/3/);
  for (const g of run.actors) { g.stare = 99; }
  w.placePlayer(run.items[0].x, run.items[0].y + 30); idle(w, 0.1); assert.equal(jobNear(run, w.p.x, w.p.y)?.id, 'swap:0');
  act(w); assert.equal(w.p.act?.n, 'crate-swap'); idle(w, 2); assert.ok(run.items[0].got); assert.match(run.progress, /1\/3/);
  // a guard staring right at you while you swap
  const { w: w2, run: r2 } = at('k9', i); const g = r2.actors[0]; idle(w2, 0.2); g.extra = 99; r2.grace = 0;
  const it = r2.items.sort((a, b) => Math.hypot(a.x - g.b.x, a.y - g.b.y) - Math.hypot(b.x - g.b.x, b.y - g.b.y))[0];
  g.b.h = Math.atan2(it.y - g.b.y, it.x - g.b.x);
  w2.placePlayer(it.x, it.y + 20); idle(w2, 0.1); act(w2); idle(w2, 3);
  assert.ok(w2.failed && /crates/i.test(w2.failed.reason), String(w2.failed?.reason));
  // the partner's distraction
  const { w: w3, run: r3 } = at('k9', i); idle(w3, 0.1); w3.placePlayer(r3.actors[0].b.x + 100, r3.actors[0].b.y); w3.mate.b.x = w3.p.x + 30; w3.mate.b.y = w3.p.y;
  assert.equal(tagOption(w3)?.kind, 'distract'); w3.step({ ...NO_INPUT, tag: true }, DT); assert.ok(r3.actors.some(a => a.stare > 0));
});

test('every new job step is finished by the casual bot, and quiet and loud heists both work', () => {
  for (const id of ['m12', 'm17', 'm24', 'm26', 'm27', 'm28', 'm32', 'k4', 'k5', 'k7', 'k8', 'k9', 'k10']) { const r = playMission(id, 'casual', 1); assert.ok(r.won, `${id}: ${JSON.stringify(r)}`); assert.ok(PAR[id] > 0, `${id} par`); }
  for (const h of ['quiet', 'loud']) { const r = playMission('k8', 'perfect', 1, { heist: h }); assert.ok(r.won, `${h}: ${JSON.stringify(r)}`); }
});

test('the paintings: hero poses for every new action, the disguise walk, guards, interns, props, icons, cards and the safe', () => {
  for (const h of ['dora', 'enzo']) for (const a of ['photo', 'photo-flash', 'notes', 'search-0', 'search-1', 'set-trap', 'spring', 'swap-0', 'swap-1', 'safe', 'triumph', 'whistle', 'dis-down-0', 'dis-down-1', 'dis-up-0', 'dis-up-1', 'dis-side-0', 'dis-side-1', 'dis-paper', 'dis-on']) assert.ok(FRAMES[`${h}-${a}`], `${h}-${a}`);
  for (const f of ['guard-down-0', 'guard-side-1', 'guard-alarm', 'guard-dazed', 'mac-netted', 'intern-down', 'intern-side-0', 'job-cam', 'job-cam-paint', 'job-safe', 'job-safe-open', 'job-door', 'job-rota', 'job-crate', 'job-crate-fake', 'job-net', 'job-net-sprung', 'job-bait', 'job-rack', 'job-pile', 'job-decoy', 'job-mess', 'i-camera', 'i-clue', 'i-ask', 'i-dial', 'card-quiet', 'card-loud', 'mg-dial', 'mg-notch', 'mg-lamp-on', 'mg-lamp-off', 'mg-tumbler']) assert.ok(FRAMES[f], f);
  assert.ok(PLAIN['bg-mg-safe']);
});

test('save v8: a v7 save keeps every job and medal, and the new counts start at zero; four new trophies', () => {
  assert.ok(SAVE_VERSION >= 8);
  const v7 = { ...newSave(5), v: 7 }; v7.done = ['m1', 'm2', 'm12', 'm17']; v7.medals = { m12: { m: 3, t: 50, plays: 2 }, m17: { m: 2, t: 90, plays: 1 } };
  v7.stats = { ...v7.stats }; for (const k of ['photos', 'heists', 'quiet', 'defends', 'disguises', 'clues', 'traps', 'swaps']) delete v7.stats[k];
  const s = loadSave(JSON.stringify(v7));
  assert.equal(s.v, SAVE_VERSION); assert.deepEqual(s.done, v7.done); assert.equal(s.medals.m12.m, 3, 'medals kept for reworked jobs'); assert.equal(s.medals.m17.m, 2);
  for (const k of ['photos', 'heists', 'quiet', 'defends', 'disguises', 'clues', 'traps', 'swaps']) assert.equal(s.stats[k], 0, k);
  for (const id of ['ghost', 'sleuth', 'netted', 'holdout']) assert.ok(TROPHIES.find(t => t.id === id), id);
  s.stats.quiet = 1; assert.ok(checkTrophies(s).includes('Ghost'));
});

console.log(`jade (seventh pass): ${n} tests ok`);
await import("./jade-aware.mjs");
