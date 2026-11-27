// Dragon Playground engine tests: the five courses hold together, the countdown, running and jumping, a longkang splash
// and the checkpoint it sends you back to, slides, see-saws, swings and monkey bars, crows and the swat, kaya toast and
// the roar, every playground power, the race end, stars, saves and race unlocking. Run after compiling the engine into
// .checks/ (npm test does).
import assert from 'node:assert/strict';
import {
  DragonGame, RACES, NO_DRIVE, NO_RIDE, DT, RUN, METER_MAX, COUNTDOWN, POWER_CD, parseSave, freshSave, raceOpen, powersOwned,
  parTime, starsFor, SAVE_KEY,
} from '../.checks/dragon-game.js';
import { buildCourse } from '../.checks/dragon-levels.js';

let n = 0; const ok = (name, fn) => { fn(); n++; console.log(`  ok ${name}`); };
const drive = (o = {}) => ({ ...NO_DRIVE, ...o });
const ride = (o = {}) => ({ ...NO_RIDE, ...o });
/** a game past the countdown, with no crows */
const racing = (race = 0, o = {}) => {
  const g = new DragonGame({ race, seed: 3, assist: true, power: null, ...o });
  while (g.mode === 'count') g.step(NO_DRIVE, NO_RIDE);
  g.crows = []; g.nextCrow = 1e9;
  return g;
};
/** step with the player's own rider input (no helper bot) */
const run = (g, frames, d = {}, r = {}) => { for (let k = 0; k < frames; k++) g.step(drive(d), ride(r)); };
const fxOf = (g, frames, d = {}, r = {}) => { const all = []; for (let k = 0; k < frames; k++) { g.step(drive(d), ride(r)); all.push(...g.fx.map((f) => f.k)); } return all; };
/** put the dragon on the ground just before x */
const at = (g, x) => { const d = g.dragon; d.x = x; d.y = 0; d.vy = 0; d.ground = true; d.st = 'run'; d.tier = null; d.hang = null; };

console.log('dragon playground');
ok('content: five races, each course solid and ending past its last obstacle', () => {
  assert.equal(RACES.length, 5);
  for (const r of RACES) {
    const c = buildCourse(r);
    assert.ok(c.finish > 6000, r.id);
    for (const gp of c.gaps) assert.ok(gp.x1 > gp.x0 && gp.x1 < c.finish, `${r.id} gap ${gp.x0}`);
    for (const t of c.tops) assert.ok(t.x1 > t.x0, `${r.id} top ${t.x0}`);
    assert.deepEqual([...c.checkpoints].sort((a, b) => a - b), c.checkpoints);
    assert.ok(c.toasts.length >= 20, `${r.id} has toast to eat`);
    assert.ok(r.name && r.from && r.to && r.blurb && r.tip && r.wakes, r.id);
  }
});
ok('countdown: three seconds of count fx, then go', () => {
  const g = new DragonGame({ race: 0, seed: 1 });
  const ks = []; let f = 0;
  while (g.mode === 'count') { g.step(drive({ mx: 1 }), NO_RIDE); ks.push(...g.fx.map((x) => x.k)); f++; }
  assert.ok(Math.abs(f * DT - COUNTDOWN) < 0.05);
  assert.equal(ks.filter((k) => k === 'count').length, 2); assert.ok(ks.includes('go'));
  assert.equal(g.dragon.x, 120, 'the dragon does not creep forward during the count');
});
ok('determinism: the same seed and inputs replay exactly', () => {
  const a = new DragonGame({ race: 1, seed: 9 }), b = new DragonGame({ race: 1, seed: 9 });
  for (let k = 0; k < 1500; k++) { const i = drive({ mx: 1, jmp: k % 70 === 0, jmpH: k % 70 < 12 }); a.step(i, null); b.step(i, null); }
  assert.equal(a.dragon.x, b.dragon.x); assert.deepEqual(a.otters.map((o) => o.x), b.otters.map((o) => o.x)); assert.deepEqual(a.stats, b.stats);
});
ok('running: right runs at the run speed, left walks back slower', () => {
  const g = racing(); at(g, 920); const x0 = g.dragon.x;   // open footpath, away from the otters at the start
  run(g, 30, { mx: 1 }); const fwd = g.dragon.x - x0;
  assert.ok(Math.abs(fwd - RUN * 0.5) < 25, `ran ${fwd}`);
  const x1 = g.dragon.x; run(g, 30, { mx: -1 }); const back = x1 - g.dragon.x;
  assert.ok(back > 0 && back < fwd * 0.7, `walked back ${back}`);
});
ok('jumping: a tap hops, a held jump goes higher', () => {
  const peak = (hold) => { const g = racing(); at(g, 200); let top = 0; g.step(drive({ jmp: true, jmpH: true }), NO_RIDE); for (let k = 0; k < 60; k++) { g.step(drive({ jmpH: hold }), NO_RIDE); top = Math.max(top, g.dragon.y); } return top; };
  const tap = peak(false), held = peak(true);
  assert.ok(tap > 100, `tap ${tap}`); assert.ok(held > tap + 40, `held ${held} vs tap ${tap}`);
});
ok('longkang: running into a drain splashes and returns to the last checkpoint behind it', () => {
  const g = racing(); const gap = g.course.gaps[0]; at(g, gap.x0 - 150);
  const ks = fxOf(g, 80, { mx: 1 }); ks.push(...fxOf(g, 60));   // fall in, then wait for the respawn
  assert.ok(ks.includes('splash')); assert.equal(g.stats.falls, 1);
  assert.ok(g.dragon.x < gap.x0 && g.dragon.ground, `back at ${g.dragon.x}`);
  const cp = g.course.checkpoints.filter((p) => p < gap.x0).pop(); assert.ok(Math.abs(g.dragon.x - cp) < 200);
});
ok('longkang: a held jump at the bank clears it', () => {
  const g = racing(); const gap = g.course.gaps[0]; at(g, gap.x0 - 110);
  g.step(drive({ mx: 1, jmp: true, jmpH: true }), NO_RIDE); run(g, 80, { mx: 1, jmpH: true });
  assert.equal(g.stats.falls, 0); assert.ok(g.dragon.x > gap.x1);
});
ok('slide: down on the chute gives a slide boost', () => {
  const g = racing(); const s = g.course.slides[0]; const d = g.dragon;
  d.x = s.x0 + 5; d.y = g.supports(d.x, 0)[0]; d.ground = true; d.vy = 0;
  const ks = fxOf(g, 90, { mx: 1, down: true });
  assert.ok(ks.includes('slide') || ks.includes('boost'), ks.join()); assert.ok(g.stats.boosts >= 1);
});
ok('see-saw: running up the plank springs the dragon high', () => {
  const g = racing(); const s = g.course.seesaws[0]; at(g, s.x0 - 200);
  let top = 0; const ks = []; for (let k = 0; k < 150; k++) { g.step(drive({ mx: 1, jmp: g.dragon.x > s.x0 - 120 && g.dragon.ground, jmpH: true }), NO_RIDE); ks.push(...g.fx.map((f) => f.k)); top = Math.max(top, g.dragon.y); }
  assert.ok(ks.includes('spring'), ks.join()); assert.ok(top > 300, `peak ${top}`);
});
ok('swing: the rider grabs the swing seat and the dragon is flung forward fast', () => {
  const g = racing(); const sw = g.course.grabs.find((q) => q.kind === 'swing');
  // run underneath it and grab as the seat comes past
  at(g, sw.x - 200);
  let flung = false;
  for (let k = 0; k < 90 && !flung; k++) { g.step(drive({ mx: 1 }), ride({ grab: Math.abs(g.dragon.x - sw.x) < 40 })); if (g.fx.some((f) => f.k === 'fling')) flung = true; }
  assert.ok(flung, 'flung'); assert.equal(g.dragon.tier, 'fling');
});
ok('monkey bars: a grab hangs the dragon along the bars and flings it off the end', () => {
  const g = racing(); const b = g.course.grabs.find((q) => q.kind === 'bars'); const d = g.dragon;
  d.x = b.x + 40; d.y = 0; d.ground = true;
  g.step(drive({ mx: 1, jmp: true, jmpH: true }), NO_RIDE);
  let hung = false; for (let k = 0; k < 40 && !hung; k++) { g.step(drive({ mx: 1, jmpH: true }), ride({ grab: true })); hung = !!d.hang; }
  assert.ok(hung, 'hung on the bars');
  let flung = false; for (let k = 0; k < 200 && !flung; k++) { g.step(drive({ mx: 1 }), NO_RIDE); flung = g.fx.some((f) => f.k === 'fling'); }
  assert.ok(flung); assert.equal(d.tier, 'bars'); assert.equal(g.stats.falls, 0);
});
ok('crows: a swat knocks one away; one left alone steals a toast', () => {
  const g = racing(); at(g, 300); const d = g.dragon;
  g.crows = [{ id: 1, x: d.x + 40, y: d.y + g.bodyH() + 70, vx: 0, vy: 0, st: 'swoop', t: 0, gone: false }];
  g.step(drive(), ride({ swat: true }));
  assert.equal(g.crows[0].st, 'knocked'); assert.equal(g.stats.crows, 1);
  const h = racing(); at(h, 300); h.dragon.meter = 3; h.toasts = [];
  h.crows = [{ id: 1, x: h.dragon.x + 30, y: h.dragon.y + h.bodyH() + 40, vx: -200, vy: -100, st: 'swoop', t: 0, gone: false }];
  const ks = fxOf(h, 120, {}, {});
  assert.ok(ks.includes('steal'), ks.join()); assert.equal(h.dragon.meter, 2); assert.equal(h.stats.steals, 1);
});
ok('kaya toast fills the meter; a full meter roars into the fastest run', () => {
  const g = racing(); at(g, 920); const d = g.dragon;
  g.toasts = []; const t0 = g.stats.toasts; g.toasts.push({ x: d.x + 20, y: 40, taken: false }); run(g, 10, { mx: 1 });
  assert.equal(g.stats.toasts, t0 + 1);
  d.meter = METER_MAX; const ks = fxOf(g, 2, { mx: 1, roar: true });
  assert.ok(ks.includes('roar')); assert.equal(d.meter, 0); assert.equal(d.tier, 'roar');
  const x = d.x; run(g, 30, { mx: 1 }); assert.ok(d.x - x > RUN * 0.5 * 1.4, 'roaring is fast');
  d.meter = 2; g.step(drive({ roar: true }), NO_RIDE); assert.equal(d.meter, 2, 'no roar until the meter is full');
});
ok('powers: flutter gives one extra jump in the air', () => {
  const g = racing(0, { power: 'flutter' }); at(g, 300); const d = g.dragon;
  g.step(drive({ jmp: true }), NO_RIDE); run(g, 25);
  const vy0 = d.vy; g.step(drive(), ride({ power: true })); assert.ok(d.vy > vy0 && d.flutterUsed);
  const vy1 = d.vy; run(g, 3); g.step(drive(), ride({ power: true })); assert.ok(d.vy < vy1, 'only once per jump');
});
ok('powers: gulp scoops crows and toast, then cools down', () => {
  const g = racing(0, { power: 'gulp' }); at(g, 300); const d = g.dragon;
  g.crows = [{ id: 1, x: d.x + 300, y: 400, vx: -100, vy: 0, st: 'fly', t: 0, gone: false }];
  const t0 = g.stats.toasts; g.toasts.push({ x: d.x + 200, y: 200, taken: false });
  g.step(drive(), ride({ power: true }));
  assert.ok(g.crows[0].gone); assert.ok(g.stats.toasts > t0); assert.equal(g.rider.powerCd, POWER_CD.gulp);
});
ok('powers: seed spit trips the otter ahead; twin runs fast', () => {
  const g = racing(0, { power: 'seed' }); at(g, 300); const o = g.otters[0]; o.x = 700; o.y = 0; o.st = 'run'; o.stumbleT = 0;
  g.step(drive(), ride({ power: true })); assert.equal(o.st, 'stumble');
  const h = racing(0, { power: 'twin' }); at(h, 300); h.step(drive(), ride({ power: true })); assert.equal(h.dragon.tier, 'twin');
});
ok('race end: the dragon crossing first wins and stars follow', () => {
  const g = racing(); at(g, g.course.finish - 100); for (const o of g.otters) o.x = 0;
  let k = 0; while (g.mode !== 'done' && k++ < 60 * 30) g.step(drive({ mx: 1 }), null);
  assert.equal(g.place, 1); assert.ok(g.stars >= 1);
});
ok('race end: sitting still loses', () => {
  const g = new DragonGame({ race: 0, seed: 2 }); let k = 0;
  while (g.mode !== 'done' && k++ < 60 * 200) g.step(NO_DRIVE, null);
  assert.equal(g.mode, 'done'); assert.equal(g.place, 4); assert.equal(g.stars, 0);
});
ok('stars: win, beat par, eat most of the toast', () => {
  const c = buildCourse(RACES[0]); const par = parTime(c), most = Math.ceil(c.toasts.length * 0.6);
  assert.equal(starsFor(2, 1, 999, c), 0);
  assert.equal(starsFor(1, par + 5, 0, c), 1);
  assert.equal(starsFor(1, par, 0, c), 2);
  assert.equal(starsFor(1, par, most, c), 3);
});
ok('saves: fresh, garbage rejected, races unlock in order, powers come from won races', () => {
  assert.equal(SAVE_KEY, 'dragon-playground-v1');
  const s = freshSave(); assert.equal(s.assist, true);
  assert.equal(parseSave(null), null); assert.equal(parseSave('nope'), null); assert.equal(parseSave('{"v":2}'), null);
  assert.deepEqual(parseSave(JSON.stringify(s)), s);
  assert.ok(raceOpen(s, 0)); assert.ok(!raceOpen(s, 1));
  s.won.r1 = { time: 30, stars: 2 }; assert.ok(raceOpen(s, 1)); assert.ok(!raceOpen(s, 2));
  assert.deepEqual(powersOwned(s), ['flutter']);
  s.won.r2 = s.won.r3 = s.won.r4 = { time: 40, stars: 1 }; assert.deepEqual(powersOwned(s).sort(), ['flutter', 'gulp', 'seed', 'twin']);
});
ok('co-op: swap trades seats; a null rider means the helper bot rides', () => {
  const g = racing(); assert.equal(g.driver, 'dora'); assert.equal(g.riderId, 'enzo');
  g.swap(); assert.equal(g.driver, 'enzo'); assert.equal(g.riderId, 'dora');
  g.step(drive({ mx: 1 }), null); assert.equal(g.riderBot, true);
  g.step(drive({ mx: 1 }), NO_RIDE); assert.equal(g.riderBot, false);
});
console.log(`dragon playground: ${n} ok`);
