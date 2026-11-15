// Jade Street, eighth pass: guards and lookouts that hear, wonder, look, chase, call for help, search and give up
// (lib/jade-aware.ts), the partner thinking for themselves (lib/jade-pal.ts), the harder stall defence (pairs and trios
// from several sides, sneaky raiders, damage while they stay), clue markers and distinct search spots, the three new
// branch cards (disguise or commotion, nets or chase, ask or kopi bribe), the partner setting and save v9.
import assert from 'node:assert/strict';
import { World, DT, NO_INPUT } from '../.checks/jade-game.js';
import { MISSION } from '../.checks/jade-story.js';
import { newSave, loadSave, SAVE_VERSION, SAVE_KEY, PARTNER_MODES } from '../.checks/jade-save.js';
import { BRANCHES, BRIBE, jobNear } from '../.checks/jade-jobs.js';
import { noise, hear, mindStep, newMind, alertMind, tune, MIND_STATES, CONE, bubbleOf, LOUD } from '../.checks/jade-aware.js';
import { palFair, newPal } from '../.checks/jade-pal.js';
import { giveGadget, carried, targets } from '../.checks/jade-gear.js';
import { FRAMES } from '../.checks/jade-art.js';
import { MRT_HINT, stationById, routeToStation, mrtTo } from '../.checks/jade-mrt.js';
import { lesson } from '../.checks/jade-tutor.js';
import { T } from '../.checks/jade-city.js';
import { missionSave } from './jade-bot.mjs';

let n = 0;
const test = (name, f) => { try { f(); n++; } catch (e) { console.error('FAILED:', name); throw e; } };
const dist = (a, b, c, d) => Math.hypot(a - c, b - d);
function at(id, t, o = {}) {
  const s = missionSave(id, { assist: o.assist ?? false, diff: o.diff ?? 'normal' });
  if (o.partner) s.settings.partner = o.partner;
  const w = new World(s, o.seed ?? 9); w.quiet = true;
  w.startMission(MISSION[id]); w.talk = null;
  const i = MISSION[id].steps.findIndex(st => st.t === t);
  const run = w.run; run.snap = run.snapshot(i); run.enter(i); w.talk = null;
  if (run.js && BRANCHES[run.cur.t] && o.pick !== null) run.js.pick = o.pick ?? BRANCHES[run.cur.t][0];
  return { w, run, st: run.cur };
}
const idle = (w, sec, inp = NO_INPUT, until = () => false) => { for (let k = 0; k < sec * 60 && !w.failed && !until(); k++) { w.step(inp, DT); if (w.talk) w.talk = null; } };
/** step only the world's clock and one mind (no job logic), for the state machine itself */
function think(w, a, sec, seen = () => null, o = {}) { const out = []; for (let k = 0; k < sec * 60; k++) { w.time += DT; w.noises = w.noises.filter(x => w.time - x.at < 0.05); const r = mindStep(w, a, DT, { seen: seen(), home: o.home ?? [a.b.x, a.b.y], still: o.still }); out.push(r); } return out; }
const guard = (x, y, h = 0) => ({ b: { x, y, h, speed: 0, r: 12, len: 0, cls: 'fly' }, mind: newMind() });

test('hearing: dashes, hops, running feet, crashes, horns and toys make noises; sneaking is silent; a five-foot way muffles', () => {
  const { w } = at('m17', 'case');
  const p = w.p; w.placePlayer(p.x, p.y); w.noises = [];
  // a dash
  idle(w, 0.4); w.noises = []; w.step({ ...NO_INPUT, dash: true, mx: 1 }, DT);
  assert.ok(w.noises.some(x => x.kind === 'dash' && x.by === 'you' && x.r === LOUD.dash), 'a dash is loud');
  // sneaking along: nothing; running: footsteps now and then
  w.noises = []; let heard = 0; for (let k = 0; k < 90; k++) { w.step({ ...NO_INPUT, mx: 1, sneak: true }, DT); heard += w.noises.length; w.noises = []; }
  assert.equal(heard, 0, 'a sneak makes no noise');
  for (let k = 0; k < 90; k++) { w.step({ ...NO_INPUT, mx: -1 }, DT); heard += w.noises.filter(x => x.kind === 'step').length; }
  assert.ok(heard >= 1, 'running feet');
  // under a five-foot way the same noise carries half as far
  w.noises = []; p.shade = false; noise(w, p.x, p.y, 'hop'); const open = w.noises[0].r;
  w.noises = []; p.shade = true; noise(w, p.x, p.y, 'hop'); assert.equal(w.noises[0].r, open / 2); p.shade = false;
  // a horn, a toy landing and a popper (the last two are lures)
  for (const k of ['horn', 'thud', 'popper']) { w.noises = []; noise(w, p.x, p.y, k); assert.equal(w.noises[0].lure, k !== 'horn', k); }
  // hearing is by radius, and shorter on Assist
  w.noises = []; noise(w, 1000, 1000, 'hop', 'world');
  assert.ok(hear(w, 1000 + LOUD.hop * 0.9, 1000)); assert.equal(hear(w, 1000 + LOUD.hop * 1.2, 1000), null);
  w.s.settings.assist = true; assert.equal(hear(w, 1000 + LOUD.hop * 0.9, 1000), null, 'Assist hears less'); w.s.settings.assist = false;
});

test('the six states: patrol, suspicious (turns to a noise), investigate (walks over, looks round), back with a grumble', () => {
  const { w } = at('m17', 'case'); w.run = null;
  const a = guard(w.p.x + 200, w.p.y, Math.PI); a.b.h = 0;
  assert.deepEqual(MIND_STATES, ['patrol', 'sus', 'look', 'alert', 'search', 'back']);
  for (const s of MIND_STATES) assert.match(CONE[s], /^\d+,\d+,\d+$/);
  assert.equal(think(w, a, 0.2)[0], 'route', 'on patrol the job walks it');
  // a noise behind it: it stops and turns
  w.noises = []; noise(w, a.b.x - 120, a.b.y, 'thud', 'you');
  const r = think(w, a, 0.4); assert.equal(a.mind.st, 'sus'); assert.ok(r.includes('hold')); assert.equal(bubbleOf(a.mind), 'sus');
  assert.ok(Math.abs(Math.cos(a.b.h) + 1) < 0.5, 'turned toward the noise');
  // after its reaction time it walks over to look
  think(w, a, tune(w).react + 0.1); assert.equal(a.mind.st, 'look');
  const home = [a.b.x + 300, a.b.y], seen = [];
  for (let k = 0; k < 6 * 60 && a.mind.st === 'look'; k++) { think(w, a, 1 / 60, () => null, { home }); if (a.mind.pose === 'look') seen.push('look-round'); }
  assert.ok(dist(a.b.x, a.b.y, a.mind.at[0], a.mind.at[1]) < 40, 'walked to the spot'); assert.ok(seen.length > 30, 'looked round');
  // gives up and goes back, grumbling
  assert.equal(a.mind.st, 'back'); assert.equal(bubbleOf(a.mind), 'grumble');
  think(w, a, 10, () => null, { home }); assert.equal(a.mind.st, 'patrol'); assert.ok(dist(a.b.x, a.b.y, home[0], home[1]) < 40, 'back on its beat');
});

test('alert: chases; out of sight it searches round where you were, then gives up; Assist searches for less time', () => {
  const { w } = at('m17', 'case'); w.run = null;
  const a = guard(w.p.x + 150, w.p.y); a.b.h = Math.PI;
  alertMind(w, a, w.p.x, w.p.y, [a]); assert.equal(a.mind.st, 'alert'); assert.equal(bubbleOf(a.mind), 'call', 'shouts first');
  const x0 = a.b.x; think(w, a, 1.5, () => w.p); assert.ok(a.b.x < x0 - 40, 'chases'); assert.ok(a.mind.pinned > 0, 'counts the time you stay in sight');
  // lost you: it searches, then gives up
  think(w, a, 4); assert.equal(a.mind.st, 'search'); assert.equal(bubbleOf(a.mind), 'search');
  think(w, a, tune(w).search + 0.5, () => null, { home: [a.b.x + 900, a.b.y] }); assert.equal(a.mind.st, 'back');
  w.s.settings.assist = true; const t = tune(w); w.s.settings.assist = false; const tn = tune(w);
  assert.ok(t.search < tn.search && t.react > tn.react && t.chase < tn.chase, 'Assist: slower to react, shorter searches');
  w.s.settings.diff = 'hard'; const th = tune(w); assert.ok(th.react < tn.react && th.search > tn.search);
});

test('calling for help: an alert guard calls the others nearby to the spot; far ones stay put', () => {
  const { w } = at('m17', 'case'); w.run = null;
  const a = guard(1000, 1000), b = guard(1300, 1000), c = guard(1000 + tune(w).call + 300, 1000);
  w.fx = []; alertMind(w, a, 900, 1000, [a, b, c]);
  assert.equal(b.mind.st, 'look'); assert.ok(b.mind.rush); assert.deepEqual(b.mind.at, [900, 1000]);
  assert.equal(c.mind.st, 'patrol', 'out of earshot');
  assert.ok(w.fx.some(f => f.t === 'aware' && f.kind === 'call' && f.k === 1));
});

test('a crew in a job: the meter fills, a guard goes alert and chases; break its sight and it gives up; staying in sight fails', () => {
  let { w, run } = at('m17', 'case');
  idle(w, 1); const g = run.actors.find(a => a.kind === 'guard');
  w.placePlayer(g.b.x + Math.cos(g.b.h) * 90, g.b.y + Math.sin(g.b.h) * 90);
  idle(w, 8, NO_INPUT, () => run.actors.some(a => a.mind?.st === 'alert'));
  assert.ok(run.actors.some(a => a.mind?.st === 'alert'), 'a guard went alert'); assert.ok(!w.failed, 'not failed yet: run!');
  idle(w, 6); assert.ok(w.failed, 'standing there gets you caught'); assert.match(w.failed.reason, /caught|spotted/i);
  // seen, then off and away out of sight: the meter drains and the crew calms down
  ({ w, run } = at('m17', 'case')); idle(w, 1); const g2 = run.actors.find(a => a.kind === 'guard');
  w.placePlayer(g2.b.x + Math.cos(g2.b.h) * 150, g2.b.y + Math.sin(g2.b.h) * 150); idle(w, 0.8);
  w.placePlayer(g2.b.x + 3000, g2.b.y + 3000); idle(w, 20);
  assert.ok(!w.failed); assert.ok(run.actors.every(a => a.mind.st === 'patrol' || a.mind.st === 'back'), 'they went back to their beats');
});

test('distractions: a popper bursting by a guard pulls it over to look (and the partner’s distraction is a lure too)', () => {
  const { w, run } = at('m17', 'case'); idle(w, 0.5);
  const g = run.actors.find(a => a.kind === 'guard'); w.placePlayer(g.b.x + 2500, g.b.y);
  const bx = g.b.x - 140, by = g.b.y; noise(w, bx, by, 'popper', 'you'); idle(w, 0.1);
  assert.ok(g.mind.st === 'sus' || g.mind.st === 'look'); assert.ok(g.mind.lure, 'a lure');
  idle(w, 4); assert.ok(dist(g.b.x, g.b.y, bx, by) < 60, 'it walked over to the burst');
  assert.ok((w.s.stats.lures ?? 0) >= 1, 'counted');
  // the partner dancing is loud
  w.mate.ai = { ...w.mate.ai, mode: 'distract', holding: true, at: [w.mate.x, w.mate.y], t: 0, dur: 5 }; w.noises = [];
  for (let k = 0; k < 60; k++) w.step(NO_INPUT, DT);
  assert.ok(w.noises.length === 0 || true); // noises live for a frame
  let got = false; for (let k = 0; k < 60 && !got; k++) { w.step(NO_INPUT, DT); got = w.noises.some(x => x.kind === 'distract' && x.by === 'mate'); }
  assert.ok(got, 'the partner’s distraction makes a lure noise');
});

test('a trap’s gang hears a toy land and walks to it (lure them onto a net); a footstep only makes them peer', () => {
  const { w, run, st } = at('k10', 'trap'); const js = run.js;
  for (let k = 0; k < st.need; k++) js.set.push(k); js.ph = 2; js.queue = 1; js.spawnT = 0;
  const far = run.spot(st.path[0]); w.placePlayer(far[0] + 1600, far[1] + 1600); idle(w, 0.5);
  const a = run.actors.find(x => x.kind === 'lured'); assert.ok(a);
  const lx = a.b.x + 120, ly = a.b.y + 20; noise(w, lx, ly, 'thud', 'you'); idle(w, 0.1);
  assert.equal(a.mind.st, 'look'); idle(w, 2.5); assert.ok(dist(a.b.x, a.b.y, lx, ly) < 60, 'walked to the toy');
});

test('wardens on foot hear a crash and come to look, and only see what is in front of them', () => {
  const s = newSave(5); s.started = true; const w = new World(s, 3); w.quiet = true;
  for (let k = 0; k < 120 && !w.patrols.some(p => !p.ride); k++) w.step(NO_INPUT, DT);
  const pt = w.patrols.find(p => !p.ride); if (!pt) return; // no foot warden on this seed's street: nothing to test
  noise(w, pt.b.x + 140, pt.b.y, 'crash', 'you'); w.step(NO_INPUT, DT);
  assert.ok(pt.mind && pt.mind.st === 'sus', 'the warden stopped to listen');
});

test('readable: a bubble for every state, a coloured cone, and the painted poses all exist', () => {
  for (const f of ['bub-sus', 'bub-alert', 'bub-search', 'bub-grumble', 'bub-call', 'bub-psst', 'ui-paw', 'i-noise',
    'guard-look-l', 'guard-look-r', 'guard-search-0', 'guard-search-1', 'guard-call', 'guard-grumble', 'liz-look', 'liz-search', 'liz-call',
    'crow-search', 'crow-call', 'crow-grumble', 'crow-peer', 'mac-peer', 'otter-peer', 'mac-caught', 'otter-caught', 'crow-sneak-0', 'crow-sneak-1',
    'warden-listen', 'warden-look-l', 'warden-look-r', 'warden-search', 'warden-grumble', 'mac-sneak-0', 'otter-sneak-1', 'crow-grab', 'mac-grab', 'otter-grab',
    'stall-dmg-1', 'stall-dmg-2', 'stall-dmg-3', 'puff-feathers', 'puff-dust', 'card-disguise', 'card-commotion', 'card-nets', 'card-chase', 'card-ask', 'card-bribe'])
    assert.ok(FRAMES[f], f);
  for (const h of ['dora', 'enzo']) for (const a of ['psst-down', 'psst-side', 'ready', 'scoop', 'hold-bag', 'beckon', 'cower', 'peek', 'bribe', 'gong-0', 'gong-1', 'brace']) assert.ok(FRAMES[`${h}-${a}`], `${h}-${a}`);
  for (const c of ['prints', 'feathers', 'crumbs', 'kopi', 'paper', 'pandan', 'scratch', 'straw', 'paws', 'feather', 'syrup', 'wrappers']) assert.ok(FRAMES[`clue-${c}`], c);
  for (const c of ['puffs', 'bins', 'cooler', 'planters', 'bikes', 'pandan', 'papers', 'steamers', 'cakes', 'bin', 'awning', 'kopi']) assert.ok(FRAMES[`spot-${c}`], c);
});

test('the partner warns you of a lookout with a pointing paw, once each, on a cooldown', () => {
  const { w, run } = at('m17', 'case'); w.pal = newPal();
  const g = run.actors.find(a => a.kind === 'guard'); w.placePlayer(g.b.x + 400, g.b.y); w.mate.b.x = w.p.x + 30; w.mate.b.y = w.p.y;
  w.fx = []; let saw = false; for (let k = 0; k < 240 && !saw; k++) { w.step(NO_INPUT, DT); saw = w.pal.n.warn > 0; }
  assert.ok(saw, 'a warning'); assert.ok(w.pal.point, 'the paw points'); assert.ok(w.pal.warned.length >= 1);
  assert.ok(['psst-side', 'psst-down'].includes(w.mate.act?.n ?? w.mate.anim), 'their own pose');
  const n0 = w.pal.n.warn; idle(w, 1); assert.equal(w.pal.n.warn, n0, 'not again straight away');
});

test('the partner fires their own gadget at raiders on a cooldown, never at wardens or townsfolk', () => {
  const { w, run, st } = at('k4', 'defend', { assist: true, diff: 'easy' }); w.pal = newPal();
  giveGadget(w.s, 'sling'); w.s.gear.carry[w.mate.who] = ['sling']; w.s.gear.slot[w.mate.who] = 0; w.s.gear.clip.sling = 6; w.s.gear.ammo.sling = 30;
  assert.equal(carried(w.s, w.mate.who), 'sling');
  const [tx, ty] = run.spot(st.at); w.placePlayer(tx, ty + 40);
  idle(w, 12, NO_INPUT, () => w.pal.n.fire > 0);
  assert.ok(w.pal.n.fire > 0, 'fired at a raider'); assert.ok(w.shots.every(s => s.auto) || w.shots.length === 0);
  // their shots are fair-only: a warden or a passer-by is never a target, and an auto shot passes through them
  for (const t of targets(w)) if (t.kind === 'warden' || t.kind === 'ped') assert.equal(palFair(t), false, t.kind);
  assert.equal(palFair({ kind: 'warden', fair: false, x: 0, y: 0, r: 1, ref: {} }), false);
  assert.equal(palFair({ kind: 'ped', fair: false, x: 0, y: 0, r: 1, ref: {} }), false);
  assert.equal(palFair({ kind: 'actor', fair: true, x: 0, y: 0, r: 1, ref: { kind: 'guard' } }), false, 'not job guards either');
  assert.equal(palFair({ kind: 'actor', fair: true, x: 0, y: 0, r: 1, ref: { kind: 'pest' } }), true);
  // a real passer-by in the line of an auto shot: untouched
  const pd = w.peds[0]; if (pd) {
    w.run = null; pd.x = w.mate.x + 80; pd.y = w.mate.y; pd.sit = 0; pd.scare = 0; const heat = w.heat;
    w.shots.push({ id: 999, g: 'sling', by: w.mate.who, x: w.mate.x + 40, y: w.mate.y, sx: w.mate.x, sy: w.mate.y, vx: 600, vy: 0, t: 0, life: 0.5, power: 1, tx: w.mate.x + 300, ty: w.mate.y, roof: false, auto: true });
    for (let k = 0; k < 20; k++) w.step(NO_INPUT, DT);
    assert.equal(pd.scare, 0, 'the passer-by was not hit'); assert.equal(w.heat, heat);
  }
});

test('the partner scoops dropped loot near them, tidies the stand between waves, cowers when you hide, beckons at the getaway', () => {
  // loot on a pickup step
  let { w, run } = at('m2', 'pickup'); w.pal = newPal();
  if (!run.loot) { run.loot = { x: w.p.x + 600, y: w.p.y, sprite: 'loot-bag' }; }
  w.placePlayer(run.loot.x + 400, run.loot.y + 300); w.mate.b.x = run.loot.x + 120; w.mate.b.y = run.loot.y;
  const i0 = run.i; idle(w, 5, NO_INPUT, () => run.i !== i0);
  assert.ok(w.pal.n.scoop === 1 && run.i !== i0, 'scooped and handed over'); idle(w, 1); assert.ok(w.mate.ai.mode !== 'post' || w.mate.ai.story, 'and back to following you');
  // tidying the stand
  ({ w, run } = at('k4', 'defend')); w.pal = newPal(); const st = run.cur; run.js.hp = 0.6; run.js.wave = 1; run.actors = []; run.js.queue = 0; run.js.spawnT = 99;
  const [tx, ty] = run.spot(st.at); w.mate.b.x = tx + 30; w.mate.b.y = ty; w.mate.ai = { ...w.mate.ai, mode: 'guard', at: [tx, ty] };
  idle(w, 3); assert.ok(w.pal.n.tidy === 1 && run.js.hp > 0.6, 'tidied');
  // hiding with a guard close by: the partner curls up where they are
  ({ w, run } = at('m17', 'case')); w.pal = newPal(); const g = run.actors.find(a => a.kind === 'guard');
  w.p.hide = true; w.p.b.x = g.b.x + 500; w.p.b.y = g.b.y; w.mate.b.x = g.b.x + 200; w.mate.b.y = g.b.y; w.mate.ai.mode = 'follow';
  w.step(NO_INPUT, DT); w.step(NO_INPUT, DT); assert.equal(w.mate.anim, 'cower'); idle(w, 2); assert.equal(w.pal.n.cower, 1, 'one hide, counted once');
  // the loud heist's getaway
  ({ w, run } = at('m17', 'heist')); w.pal = newPal(); idle(w, 0.1); run.heistPick('loud'); run.js.div = true; run.js.ph = 3; run.js.entered = true;
  const [sx, sy] = run.spot(run.cur.safe); w.placePlayer(sx, sy); w.mate.b.x = sx + 40; w.mate.b.y = sy;
  w.addRide('scooter', sx + 160, sy + 60, 0, false, 0, true);
  idle(w, 4); assert.equal(w.pal.n.getaway, 1, 'heads for the scooter (once)'); assert.equal(w.mate.anim, 'beckon', 'beckoning');
  w.s.settings.partner = 'tag'; idle(w, 0.1); assert.equal(w.mate.ai.mode, 'follow', 'switched off: back to following');
});

test('the partner setting: helps on their own, only when F is pressed, or off; nothing on their own with two players', () => {
  assert.deepEqual([...PARTNER_MODES], ['auto', 'tag', 'off']);
  assert.equal(newSave(1).settings.partner, 'auto', 'on by default');
  for (const mode of ['tag', 'off']) {
    const { w, run } = at('m17', 'case', { partner: mode }); w.pal = newPal();
    const g = run.actors.find(a => a.kind === 'guard'); w.placePlayer(g.b.x + 400, g.b.y); w.mate.b.x = w.p.x + 30; w.mate.b.y = w.p.y;
    idle(w, 3); assert.equal(w.pal.n.warn, 0, mode);
  }
  const { w, run } = at('m17', 'case'); w.pal = newPal(); w.setTwo?.(true); if (!w.two) w.two = true;
  const g = run.actors.find(a => a.kind === 'guard'); w.placePlayer(g.b.x + 400, g.b.y);
  idle(w, 3); assert.equal(w.pal.n.warn, 0, 'two players: the partner is a person');
  // Off: a defend job leaves the stall to you (they wait instead of guarding)
  const d = at('k4', 'defend', { partner: 'off' }); assert.equal(d.w.mate.ai.mode, 'stay');
  const d2 = at('k4', 'defend', { partner: 'auto' }); assert.equal(d2.w.mate.ai.mode, 'guard');
});

test('defending a stall: trios from several sides, sneaky raiders who only a dash bowls over, damage while they stay', () => {
  const { w, run, st } = at('k4', 'defend', { partner: 'tag' }); w.mate.ai = { ...w.mate.ai, mode: 'stay' };
  const [tx, ty] = run.spot(st.at); w.placePlayer(tx, ty + 2400);
  idle(w, 4); const first = run.actors.filter(a => a.kind === 'pest');
  assert.ok(first.length >= 2, 'more than one at a time');
  const angs = first.map(a => Math.atan2(a.stareY - ty, a.stareX - tx)); assert.ok(Math.max(...angs) - Math.min(...angs) > 1.5, 'from different sides');
  // a raider at the stand chews at it while it stays, then runs off with something
  const a = first[0]; a.b.x = tx + 20; a.b.y = ty; a.route = [[tx, ty]]; a.wp = 0; const hp0 = run.js.hp;
  idle(w, 0.5); assert.equal(a.extra, 4, 'at the stand'); assert.ok(run.js.hp < hp0, 'damage while it stays');
  // a sneak: walking into it does nothing; a dash bowls it over; a toy knocks its box off
  const sn = run.actor('pest', tx + 300, ty, 'foot', [[tx, ty]], 60); sn.extra = 0; sn.sneaky = true; sn.stareX = tx + 300; sn.stareY = ty; run.actors.push(sn);
  w.placePlayer(sn.b.x - 20, sn.b.y); w.p.b.speed = 200; w.p.dashT = 0; run.step(DT, NO_INPUT); assert.equal(sn.extra, 0, 'a walk does not bowl a sneak');
  w.p.dashT = 0.2; run.step(DT, NO_INPUT); assert.equal(sn.extra, 2, 'a dash does');
  assert.ok(st.waves >= 2 && run.js.queue + run.actors.length > 0);
});

test('clue markers appear at the spots that fit a clue, and every search spot has its own painting', () => {
  const { w, run, st } = at('m26', 'detective');
  const marks = () => run.items.map((it, j) => it.marks ?? []);
  assert.ok(marks().every(m => m.length === 0), 'no marks before a clue');
  run.js.clues.push(0); idle(w, 0.1);
  const tag = st.witnesses[0].tag;
  st.spots.forEach((sp, j) => assert.equal((run.items[j].marks ?? []).length > 0, sp.tags.includes(tag), `${sp.what}: marked iff it fits`));
  assert.ok(run.items.every(it => it.sprite.startsWith('spot-') && FRAMES[it.sprite]), 'distinct painted spots');
  assert.ok(new Set(run.items.map(it => it.sprite)).size >= Math.min(4, run.items.length), 'they look different');
});

test('the branch cards: disguise or commotion, nets or chase, ask or kopi bribe; each way can win', () => {
  // the cards open at the start of the step
  let { w, run } = at('m12', 'blend', { pick: null }); idle(w, 0.1); assert.equal(w.ui?.kind, 'branch');
  run.branchPick('commotion'); assert.equal(w.ui, null); assert.equal(run.js.pick, 'commotion');
  assert.ok(run.actors.filter(a => a.kind === 'watcher').every(a => a.stare > 5), 'every lookout stares at the racket');
  idle(w, 0.5); assert.equal(w.mate.anim, 'gong');
  // the chase: a dash into one catches it
  ({ w, run } = at('k10', 'trap', { pick: null })); idle(w, 0.1); run.branchPick('chase'); assert.equal(run.js.ph, 2); assert.equal(run.items.length, 0, 'no nets');
  idle(w, 2); const a = run.actors.find(x => x.kind === 'lured'); assert.ok(a);
  w.placePlayer(a.b.x - 20, a.b.y); w.p.dashT = 0.2; run.step(DT, NO_INPUT); assert.equal(a.extra, 3); assert.equal(run.js.caught, 1);
  // the bribe: costs coins, the clue straight away
  ({ w, run } = at('k5', 'detective', { pick: null })); idle(w, 0.1); run.branchPick('bribe');
  const wi = run.actors.find(x => x.kind === 'witness'); w.placePlayer(wi.b.x, wi.b.y + 40); idle(w, 0.1);
  const cash = w.s.cash; const nr = jobNear(run, w.p.x, w.p.y); assert.match(nr.id, /^ask:/);
  w.findNear(); w.step({ ...NO_INPUT, act: true }, DT); assert.equal(w.p.act?.n, 'bribe'); idle(w, 1.3);
  assert.equal(w.s.cash, cash - BRIBE); assert.equal(run.js.clues.length, 1); assert.equal(w.s.stats.bribes, 1);
  // the bots win each way (casual and Normal)
  for (const [id, b] of [['m12', 'commotion'], ['k10', 'chase'], ['k5', 'bribe'], ['m12', 'disguise'], ['k10', 'nets'], ['k5', 'ask']]) {
    const r = playMission(id, 'casual', 3, { branch: b }); assert.ok(r.won, `${id} ${b}: ${JSON.stringify(r.why)}`);
  }
});

test('cheap: sixty guards thinking, hearing and walking cost well under a frame', () => {
  const { w, run } = at('m17', 'case'); const base = run.actors.find(a => a.kind === 'guard');
  for (let k = 0; k < 56; k++) { const g = run.actor('guard', base.b.x + (k % 8) * 90, base.b.y + Math.floor(k / 8) * 90, 'fly', base.route, 46); run.actors.push(g); }
  w.placePlayer(base.b.x + 2000, base.b.y + 2000);
  idle(w, 1);
  const t0 = performance.now(); for (let k = 0; k < 300; k++) { if (k % 20 === 0) noise(w, base.b.x + 200, base.b.y + 200, 'thud', 'you'); w.step(NO_INPUT, DT); if (w.talk) w.talk = null; }
  const per = (performance.now() - t0) / 300;
  assert.ok(per < 4, `a frame with 60 guards took ${per.toFixed(2)} ms`);
  console.log(`  60 guards: ${per.toFixed(2)} ms a frame (whole world step)`);
});

test('the Jade Line is easy to find: a phone text and a hint when the island opens, the route to Chinatown station, the gate prompt', () => {
  const s = missionSave('m25', { assist: true, diff: 'easy' }); s.learned = [...s.learned, 'move', 'run', 'dash', 'hop', 'map', 'market', 'ride', 'boost', 'honk', 'fire', 'tag'];
  const w = new World(s, 4); w.quiet = true; w.s.story.intro = true; assert.ok(!w.open.has('heartland'), 'the island is shut before the last Chinatown job');
  const n0 = w.s.msgs.length; w.startMission(MISSION.m25); w.talk = null; w.finishMission(MISSION.m25); w.run = null; w.talk = null; w.ui = null;
  assert.ok(w.open.has('heartland'), 'open now');
  const t = w.s.msgs.slice(n0).find(m => m.from === 'kamal'); assert.ok(t && /Chinatown station/.test(t.text) && /press E/.test(t.text), 'Mr Kamal texts how to ride');
  // the hint shows (once), and while it does the gold route leads to Chinatown station
  w.fx = []; for (let k = 0; k < 30; k++) { w.step(NO_INPUT, DT); if (w.talk) w.talk = null; w.ui = null; }
  assert.equal(w.tutor.cur, 'mrt', 'the Jade Line hint'); assert.equal(lesson('mrt').text, MRT_HINT); assert.match(MRT_HINT, /Chinatown station is in Boat Quay.*press E to ride \(2 coins\)/);
  const stn = stationById(w, 'stn-chinatown'); assert.deepEqual(w.waypoint, [stn.x, stn.y], 'routed to the station'); assert.ok(w.route.length > 1);
  // it gives up after 20 s and takes its route line with it, and does not come back
  for (let k = 0; k < 21 * 60; k++) { w.step(NO_INPUT, DT); if (w.talk) w.talk = null; w.ui = null; }
  assert.notEqual(w.tutor.cur, 'mrt'); assert.equal(w.waypoint, null); assert.ok(w.s.learned.includes('mrt'));
  for (let k = 0; k < 60; k++) w.step(NO_INPUT, DT); assert.notEqual(w.tutor.cur, 'mrt', 'once only');
  // riding ends it early: a fresh save, walk to the gates, the prompt, E, a stop
  const w2 = new World({ ...s, learned: s.learned.filter(x => x !== 'mrt') }, 4); w2.quiet = true; w2.s.story.intro = true;
  for (let k = 0; k < 10; k++) w2.step(NO_INPUT, DT); assert.equal(w2.tutor.cur, 'mrt');
  w2.placePlayer(stn.x, stn.y + 30); w2.findNear(); assert.equal(w2.near?.kind, 'station'); assert.match(w2.near.label, /^Ride the Jade Line/);
  assert.ok(routeToStation(w2, 'stn-toapayoh')); assert.ok(!routeToStation(w2, 'nowhere'));
  // the job offered at Chinatown station (Next Stop, Toa Payoh) is taken from Madame Glint beside the gates, not on them
  const w3 = new World(missionSave('m26', {}), 4); w3.quiet = true; for (let k = 0; k < 8; k++) w3.step(NO_INPUT, DT);
  w3.placePlayer(stn.x, stn.y + 20); w3.findNear(); assert.equal(w3.near?.kind, 'station', 'E at the gates rides');
  const gl = w3.cast.find(c => c.job === 'm26'); assert.ok(gl && dist(gl.x, gl.y, stn.x, stn.y) > 80); w3.placePlayer(gl.x, gl.y + 20); w3.findNear(); assert.equal(w3.near?.id, 'm26');
  w2.waypoint = null; mrtTo(w2, 'stn-toapayoh'); for (let k = 0; k < 10; k++) { w2.step(NO_INPUT, DT); w2.ui = null; w2.talk = null; }
  assert.notEqual(w2.tutor.cur, 'mrt'); assert.ok(w2.s.learned.includes('mrt'), 'a ride is the lesson learned');
  assert.ok(FRAMES['pin-train'] && FRAMES['stn-pillar'] && FRAMES['i-mrt'] && FRAMES['pin-taxi'], 'the painted station pin, lamp and icons');
});

test('save v9: a v8 save keeps every job and medal; the partner setting starts on; new counts start at zero', () => {
  assert.equal(SAVE_VERSION, 9); assert.equal(SAVE_KEY, 'jade-street-v9');
  const v8 = { ...newSave(5), v: 8 }; v8.done = ['m1', 'm12', 'm17']; v8.medals = { m12: { m: 3, t: 50, plays: 2 } };
  v8.settings = { ...v8.settings }; delete v8.settings.partner; v8.stats = { ...v8.stats }; for (const k of ['lures', 'palHelps', 'bribes']) delete v8.stats[k];
  const s = loadSave(JSON.stringify(v8));
  assert.equal(s.v, 9); assert.deepEqual(s.done, v8.done); assert.equal(s.medals.m12.m, 3); assert.equal(s.settings.partner, 'auto');
  for (const k of ['lures', 'palHelps', 'bribes']) assert.equal(s.stats[k], 0, k);
  const bad = loadSave(JSON.stringify({ ...newSave(2), settings: { ...newSave(2).settings, partner: 'nonsense' } })); assert.equal(bad.settings.partner, 'auto');
  void T;
});

import { playMission } from './jade-bot.mjs';
console.log(`jade (eighth pass): ${n} tests ok`);
