// Kit Parade engine checks: the levels parse, every job and every bit of terrain behaves, falls are judged kindly,
// stars and saves work, and the same jobs on the same ticks always play out the same way.
import assert from 'node:assert/strict';
import {
  ParadeGame, LEVELS, WORLDS, JOBS, JOB_INFO, TPS, TILE, KIT_H, STEP, DROP, SAFE_FALL, BALES, HUG_R, DIZZY_TICKS, SPLASH_TICKS, PUFF_TICKS, HUG_TICKS,
  STOPPER_WEIGHT, EARTH, STONE, BALE, HAY_L, EMPTY, SAVE_KEY, expandRow, replay, readProfile, freshProfile, record, unlocked, totalStars, levelIndex,
} from '../.checks/parade-game.js';

let checks = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); checks++; };
const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); checks++; };

const ALL_JOBS = Object.fromEntries(JOBS.map((j) => [j, 5]));
/** A little test level: kits pop out of E, one every 40 ticks. */
const lvl = (map, o = {}) => ({ id: 'test', name: 'Test', world: 0, hint: '', map, kits: 1, need: 1, rate: 40, time: 120, jobs: ALL_JOBS, par: { jobs: 9, time: 120 }, solution: [], key: [], ...o });
/** Steps until the first kit has landed and is walking. */
const walking = (g, i = 0) => { for (let n = 0; n < 400 && g.kits[i]?.state !== 'walk'; n++) g.step(); assert.equal(g.kits[i].state, 'walk'); return g.kits[i]; };
const until = (g, test, max = 3000) => { for (let n = 0; n < max && !test(); n++) g.step(); return test(); };

// ---- the map format
eq(expandRow('3#2 X'), '###  X', 'a number repeats the next character');
eq(expandRow('12='), '='.repeat(12), 'two-digit runs');
eq(expandRow('a b'), 'a b', 'plain rows pass through');

// ---- the levels
ok(LEVELS.length === 30, 'thirty levels');
ok(new Set(LEVELS.map((l) => l.id)).size === 30, 'every level has its own id');
ok(WORLDS.length === 4, 'four worlds');
eq(WORLDS.map((_, w) => LEVELS.filter((l) => l.world === w).length), [8, 8, 7, 7], 'eight, eight, seven and seven levels a world');
ok(LEVELS.every((l, i) => i === 0 || l.world >= LEVELS[i - 1].world), 'levels go world by world');
for (const [i, L] of LEVELS.entries()) {
  const rows = L.map.map(expandRow), w = rows[0].length;
  ok(rows.every((r) => r.length === w), `${L.id}: every row is ${w} tiles wide`);
  ok(rows.join('').split('E').length === 2 && rows.join('').split('X').length === 2, `${L.id}: one entrance and one home burrow`);
  ok(rows.every((r) => /^[ #=_\-/\\<>{}b~EX]*$/.test(r)), `${L.id}: only known map characters`);
  ok(L.need >= 1 && L.need <= L.kits && L.rate >= 20 && L.time >= 60, `${L.id}: sensible kits (${L.need} of ${L.kits}), rate and time`);
  ok(Object.keys(L.jobs).every((j) => JOBS.includes(j)), `${L.id}: known jobs`);
  ok(L.hint.length > 20 && L.name.length > 2, `${L.id}: a name and a kind hint`);
  ok(L.solution.every((a) => (L.jobs[a.job] ?? 0) > 0), `${L.id}: the solution only uses jobs the level gives`);
  ok(L.key.every((k) => k >= 0 && k < L.solution.length), `${L.id}: key jobs point into the solution`);
  ok(i === 0 || L.key.length > 0, `${L.id}: has at least one key job`);
  const g = new ParadeGame(i);
  ok(g.index === i && levelIndex(L.id) === i, `${L.id}: found by index and id`);
  ok(g.solid(g.exit.x, g.exit.y), `${L.id}: the home burrow sits on the ground`);
  ok(!g.solid(g.entrance.x, g.entrance.y - 1), `${L.id}: the entrance is open`);
}
// each world brings new jobs and new terrain
const usedJobs = (w) => new Set(LEVELS.filter((l) => l.world === w).flatMap((l) => l.solution.map((a) => a.job)));
ok(['digger', 'builder', 'tunneller'].every((j) => usedJobs(0).has(j)), 'the meadow teaches digging, building and tunnelling');
ok(['stopper', 'climber'].every((j) => usedJobs(1).has(j)), 'the pantry teaches stoppers and climbers');
ok(['glider', 'hugger'].every((j) => usedJobs(2).has(j)), 'the cave teaches gliders and huggers');
ok(usedJobs(3).has('bouncer'), 'the rooftops teach bouncers');
const has = (w, test) => LEVELS.filter((l) => l.world === w).some(test);
ok(has(0, (l) => l.map.join('').includes('<') || l.map.join('').includes('>')), 'one-way hay in the meadow');
ok(has(1, (l) => l.map.join('').includes('}') || l.map.join('').includes('{')), 'hay belts in the pantry');
ok(has(2, (l) => l.map.join('').includes('=')) && has(2, (l) => (l.pads ?? []).length > 0), 'pebble stone and lily pads in the cave');
ok(has(3, (l) => (l.seesaws ?? []).length > 0) && has(3, (l) => (l.fans ?? []).length > 0), 'seesaws and fans on the rooftops');
ok(JOBS.length === 8 && JOBS.every((j) => JOB_INFO[j].name && JOB_INFO[j].icon && JOB_INFO[j].tip), 'eight jobs with names, icons and tips');

// ---- walking
{
  const g = new ParadeGame(lvl(['20 ', ' E18 ', '17 =2 ', '17 =2 ', '8 _4=4 =2 ', '20#']));
  const k = walking(g);
  ok(k.x === g.entrance.x && k.y === 40 && k.dir === 1, 'a kit drops out of the burrow and lands facing right');
  until(g, () => k.x >= 64);
  ok(k.y === 36, 'it hops up a half-tile step');
  until(g, () => k.x >= 72);
  ok(k.y === 32, 'and another');
  until(g, () => k.x >= 106 && k.state === 'walk');
  ok(k.y === 40, 'a whole tile down is a little safe fall');
  until(g, () => k.dir === -1, 400);
  ok(k.dir === -1 && k.x === 135, 'it turns round at a wall taller than a step');
  const g2 = new ParadeGame(lvl(['20 ', ' E18 ', '20 ', '20 ', '6#_13 ', '20#']));
  const k2 = walking(g2);
  until(g2, () => k2.x >= 48);
  ok(k2.y === 36 && k2.state === 'walk', 'it hops down a half-tile step without falling');
  ok(STEP === 5 && DROP === 4 && KIT_H === 10, 'kit sizes');
  // the edges of the world are walls
  const g3 = new ParadeGame(lvl([' E8 ', '10 ', '10#']));
  const k3 = walking(g3);
  until(g3, () => k3.dir === -1);
  ok(k3.x === g3.W - 1 && k3.dir === -1, 'the edge of the world turns kits round');
}

// ---- falls, Mum and the home burrow
{
  const fall = (rows) => { const g = new ParadeGame(lvl([' E8 ', ...Array(rows).fill('10 '), '10#'])); until(g, () => g.kits[0] && g.kits[0].state !== 'fall'); return g; };
  ok(fall(7).kits[0].state === 'walk' && fall(7).kits[0].fall === SAFE_FALL, 'a 7-tile drop (56 px) is safe');
  const g = fall(8), k = g.kits[0];
  ok(k.state === 'dizzy' && k.fall > SAFE_FALL, 'a longer drop leaves a kit dizzy');
  g.run(DIZZY_TICKS);
  ok(k.state === 'carried' && g.lost === 1 && g.saved === 0, 'and Mum carries it home');
  ok(g.events.some((e) => e.kind === 'dizzy') && g.events.some((e) => e.kind === 'carried'), 'with events for the scene');
  const off = new ParadeGame(lvl([' E8 ', '10 ']));
  until(off, () => off.kits[0]?.state === 'carried');
  ok(off.kits[0].state === 'carried' && off.lost === 1, 'a kit falling out of the world is caught by Mum');
  const home = new ParadeGame(lvl(['10 ', ' E5 X2 ', '10#']));
  until(home, () => home.state === 'done');
  ok(home.saved === 1 && home.kits[0].state === 'home' && home.reason === 'all', 'a kit that reaches the home burrow is saved and the level ends');
  ok(home.result().cleared && home.result().stars === 3, 'one of one home with no jobs is three stars');
}

// ---- jobs: budget and who can take what
{
  const g = new ParadeGame(lvl([' E18 ', '20 ', '20#', '20#'], { jobs: { climber: 1, digger: 1 } }));
  until(g, () => g.kits[0]);
  ok(!g.canTake(g.kits[0], 'digger'), 'no digging in mid-air');
  ok(g.canTake(g.kits[0], 'climber') && g.assign(0, 'climber'), 'climber can be given mid-air');
  ok(!g.assign(0, 'climber'), 'a climber stays a climber; no need to give it twice');
  walking(g);
  ok(!g.canTake(g.kits[0], 'stopper'), 'no stoppers left in this level');
  ok(g.assign(0, 'digger') && g.left.digger === 0 && g.used === 2, 'giving a job uses one up');
  ok(!g.assign(0, 'digger'), 'not the same job twice');
  eq(g.log.map((a) => a.job), ['climber', 'digger'], 'every job given is logged with its tick');
  ok(!g.assign(5, 'digger'), 'no such kit');
}

// ---- stopper
{
  const g = new ParadeGame(lvl(['30 ', ' E28 ', '30 ', '30#'], { kits: 2, rate: 30 }));
  const k = walking(g);
  until(g, () => k.x >= 40);
  ok(g.assign(0, 'stopper') && k.state === 'stop', 'a stopper stands still');
  const before = k.x;
  until(g, () => g.kits[1] && g.kits[1].dir === -1, 400);
  ok(g.kits[1].dir === -1 && g.kits[1].x < before && k.x === before, 'and turns the others round');
  ok(g.canTake(k, 'builder') && !g.canTake(k, 'stopper'), 'a stopper is set free by any other ground job');
  g.assign(0, 'digger');
  ok(k.state === 'dig', 'a freed stopper gets to work');
  ok(STOPPER_WEIGHT === 3, 'a stopper weighs three kits on a seesaw');
  // a stopper whose ground goes falls
  const g2 = new ParadeGame(lvl(['30 ', ' E28 ', '30 ', '30#', '30 ', '30 ', '30#'], { kits: 2, rate: 30 }));
  const a = walking(g2);
  until(g2, () => a.x >= 40); g2.assign(0, 'stopper');
  until(g2, () => g2.kits[1]?.state === 'walk');
  until(g2, () => g2.kits[1].x >= 30); g2.assign(1, 'hugger');
  until(g2, () => a.state !== 'stop', 200);
  ok(a.state === 'fall' || a.state === 'walk', 'a stopper falls when the ground under it is hugged away');
}

// ---- digger
{
  const g = new ParadeGame(lvl(['20 ', ' E18 ', '20 ', '20#', '20#', '20 ', '20 ', '20=']));
  const k = walking(g);
  until(g, () => k.x >= 60);
  g.assign(0, 'digger');
  until(g, () => k.state !== 'dig');
  ok(g.mat(60, 24) === EMPTY && g.mat(56, 30) === EMPTY && g.mat(64, 30) === EMPTY && g.mat(66, 30) === EARTH, 'a digger clears a shaft nine pixels wide');
  ok(k.state === 'fall' || k.state === 'walk', 'and drops through when the earth runs out');
  until(g, () => k.state === 'walk');
  ok(k.y === 56, 'landing safely below');
  const g2 = new ParadeGame(lvl(['20 ', ' E18 ', '20 ', '20#', '20=']));
  const k2 = walking(g2); until(g2, () => k2.x >= 60); g2.assign(0, 'digger');
  until(g2, () => k2.state !== 'dig');
  ok(k2.state === 'shrug' && k2.y === 32, 'pebble stone stops a digger, who shrugs and walks on');
  until(g2, () => k2.state === 'walk');
  ok(k2.state === 'walk', 'after a shrug');
}

// ---- tunneller and one-way hay
{
  const g = new ParadeGame(lvl(['30 ', ' E28 ', '15 3#12 ', '15 3#12 ', '30#']));
  const k = walking(g);
  g.assign(0, 'tunneller');
  until(g, () => k.x >= 100 && k.state === 'walk');
  ok(k.state === 'walk' && k.x >= 136, 'a tunneller walks on until the earth, digs through it and walks on');
  ok(g.mat(130, 25) === EMPTY && g.mat(130, 31) === EMPTY && g.mat(130, 32) === EARTH && g.mat(130, 21) === EARTH, 'leaving a tunnel as tall as a kit');
  const hay = (ch) => { const h = new ParadeGame(lvl(['30 ', ' E28 ', `15 3${ch}12 `, `15 3${ch}12 `, '30#'])); const kk = walking(h); h.assign(0, 'tunneller'); until(h, () => kk.state !== 'tunnel'); return { h, kk }; };
  const against = hay('<');
  ok(against.kk.state === 'shrug' && against.h.mat(124, 28) === HAY_L, 'arrow hay pointing back stops a tunneller');
  const along = hay('>');
  ok(along.kk.state === 'walk' && along.kk.x >= 136, 'arrow hay pointing the way gives way');
}

// ---- builder
{
  const g = new ParadeGame(lvl(['40 ', ' E38 ', ...Array(4).fill('40 '), '40#']));
  const k = walking(g), x0 = k.x, y0 = k.y;
  g.assign(0, 'builder');
  until(g, () => k.state !== 'build');
  ok(k.state === 'shrug' && k.bales === 0, `a builder lays ${BALES} bales and shrugs`);
  ok(k.x === x0 + BALES * 4 && k.y === y0 - BALES * 2, 'climbing two pixels for every four along');
  ok(g.mat(x0 + 2, y0 - 1) === BALE && g.mat(x0 + 46, y0 - 23) === BALE, 'the stair is made of hay bales');
  const g2 = new ParadeGame(lvl(['20 ', ' E18 ', '20 ', '8 12#', '8 12#', '20#']));
  const k2 = walking(g2); until(g2, () => k2.x >= 40); g2.assign(0, 'builder');
  until(g2, () => k2.state !== 'build');
  ok(k2.state === 'walk' && k2.dir === -1, 'a builder that bumps its head on a wall turns round');
}

// ---- climber
{
  const g = new ParadeGame(lvl(['20 ', ' E18 ', '10 10#', '10 10#', '10 10#', '20#']));
  const k = walking(g); g.assign(0, 'climber');
  until(g, () => k.state === 'climb');
  ok(k.state === 'climb' && k.x === 79, 'a climber starts up the wall');
  until(g, () => k.state !== 'climb');
  ok(k.state === 'walk' && k.y === 16 && k.x === 80, 'and steps onto the top');
  const g2 = new ParadeGame(lvl(['20 ', ' E18 ', '8 12=', '10 10#', '10 10#', '10 10#', '20#']));
  const k2 = walking(g2); g2.assign(0, 'climber');
  until(g2, () => k2.state === 'climb'); until(g2, () => k2.state !== 'climb');
  ok(k2.state === 'fall' && k2.dir === -1, 'an overhang sends a climber back down, facing away');
}

// ---- glider
{
  const g = new ParadeGame(lvl([' E8 ', ...Array(12).fill('10 '), '10#']));
  until(g, () => g.kits[0]); g.assign(0, 'glider');
  until(g, () => g.kits[0].state === 'glide');
  ok(g.kits[0].state === 'glide', 'a glider opens its tail as it falls');
  until(g, () => g.kits[0].state !== 'glide');
  ok(g.kits[0].state === 'walk' && g.kits[0].fall > SAFE_FALL, 'and lands softly from any height');
}

// ---- bouncer
{
  const g = new ParadeGame(lvl(['40 ', ' E38 ', '40 ', '40 ', '40 ', '15 25=', '15 25=', '15 25=', '15 25=', '40=']));
  const k = walking(g);
  until(g, () => k.x >= 90); g.assign(0, 'bouncer');
  g.run(PUFF_TICKS + 1);
  ok(g.puffs.length === 1 && g.puffs[0].x === 90, 'a bouncer fluffs up a dust puff where it stands');
  until(g, () => k.state === 'bounce');
  ok(k.state === 'bounce' && g.events.some((e) => e.kind === 'bounce'), 'and it springs off it, wheee');
  until(g, () => k.state !== 'bounce');
  ok(k.state === 'walk' && k.y === 40 && k.x > 120, 'right up onto a roof four tiles high');
}

// ---- hugger
{
  const g = new ParadeGame(lvl(['20 ', ' E18 ', '20 ', '9 =10 ', '9 #10 ', '20#', '20#', '20#']));
  const k = walking(g);
  until(g, () => k.x >= 70); g.assign(0, 'hugger');
  g.run(HUG_TICKS - 1);
  ok(k.state === 'hug' && g.mat(73, 36) === EARTH, 'a hug takes a moment');
  g.step();
  ok(g.mat(73, 36) === EMPTY && g.mat(70, 45) === EMPTY && g.mat(73, 28) === STONE, `then clears a circle of earth ${HUG_R} pixels round, but never pebble stone`);
  ok(g.events.some((e) => e.kind === 'hug'), 'with a hug event');
}

// ---- water and lily pads
{
  const g = new ParadeGame(lvl([' E8 ', '10 ', '10 ', '10~', '10=']));
  until(g, () => g.kits[0]?.state === 'splash');
  ok(g.kits[0].state === 'splash', 'a kit that falls in the pond splashes');
  g.run(SPLASH_TICKS);
  ok(g.kits[0].state === 'carried' && g.lost === 1, 'and Mum fishes it out');
  const pond = { pads: [{ x: 6, y: 3, w: 2, min: 6, max: 10, every: 1 }] };
  const f = new ParadeGame(lvl([' E18 ', '20 ', '20 ', '6#6~3 X3 ', '6#6~8#', '20='], pond));
  const k = walking(f);
  until(f, () => k.x === 47 && f.pads[0].x > 48, 200);
  ok(k.x === 47 && k.state === 'walk', 'kits wait at the bank instead of stepping into the pond');
  until(f, () => f.state === 'done');
  ok(f.saved === 1 && f.lost === 0, 'then ride the lily pad across and walk home');
}

// ---- hay belts
{
  const g = new ParadeGame(lvl(['20 ', '8 E11 ', '20 ', '3#14{3#', '20=']));
  const k = walking(g);
  const x = k.x; g.step();
  ok(k.dir === -1 && k.x === x - 2, 'a belt spins a kit to face its way and carries it double quick');
}

// ---- fans
{
  const g = new ParadeGame(lvl(['20 ', ' E18 ', '20 ', '10 10=', '10 10=', '6#4 10=', '6#14 ', '20='], { fans: [{ x: 6, y: 1, w: 4, h: 7 }] }));
  const k = walking(g);
  until(g, () => k.state === 'float');
  ok(k.state === 'float', 'a kit that falls into a fan’s breeze floats');
  until(g, () => k.state === 'walk' && k.x >= 80);
  ok(k.state === 'walk' && k.y === 24 && k.x >= 80, 'up and onto the high roof');
}

// ---- seesaws
{
  const map = ['40 ', '40 ', '15 E24 ', '14=26 ', '14=26 ', '14=26 ', '14=26 ', '14=8 18=', '14=8 18=', '40='];
  const g = new ParadeGame(lvl(map, { dir: -1, seesaws: [{ x: 18, y: 8, half: 4, amp: 10, tilt: -1 }] }));
  const s = g.seesaws[0];
  ok(s.off === -10 && g.seesawY(s, s.cx - 32) === 74 && g.seesawY(s, s.cx + 32) === 54, 'a seesaw starts tipped to the left');
  ok(g.solid(s.cx, 64) && !g.solid(s.cx, 60), 'and kits can stand on it');
  const k = walking(g);
  until(g, () => k.dir === 1 && k.x > s.cx + 12);
  until(g, () => s.off === 10, 80);
  ok(s.off === 10, 'one kit walking past the middle tips it the other way');
}

// ---- the clock, stars and finishing
{
  const g = new ParadeGame(lvl(['20 ', ' E18 ', '20#'], { time: 60 }));
  until(g, () => g.state === 'done', 2000);
  ok(g.reason === 'time' && g.tick === 60 * TPS, 'the gentle timer ends the level');
  ok(!g.result().cleared && g.result().stars === 0, 'nobody home is no stars');
  const f = new ParadeGame(lvl(['20 ', ' E18 ', '20#']));
  f.run(50); f.finish();
  ok(f.state === 'done' && f.reason === 'finish', 'the player can finish early');
  f.step();
  ok(f.tick === 50, 'a finished level stays still');
  // stars from a real level
  const L = LEVELS[1], best = replay(1, L.solution).result();
  ok(best.cleared && best.stars === 3 && best.thrifty && best.speedy, 'the stored solution earns three stars');
  const extra = [...L.solution, { t: L.solution[0].t + 1, k: 1, job: 'digger' }];
  const r2 = replay(1, extra).result();
  ok(r2.cleared && !r2.thrifty && r2.stars < 3, 'a job more than par costs the thrifty star');
  ok(r2.jobsLeft === 0 && best.jobsLeft === 1, 'jobs left are counted');
}

// ---- kit picking
{
  const g = new ParadeGame(lvl(['30 ', ' E28 ', '30 ', '30#'], { kits: 2, rate: 30 }));
  walking(g); until(g, () => g.kits[1]?.state === 'walk');
  const a = g.kits[0], b = g.kits[1];
  ok(g.kitAt(a.x, a.y - 5) === 0 && g.kitAt(b.x, b.y - 5) === 1, 'a click picks the kit under it');
  ok(g.kitAt(a.x + 40, a.y - 40) === -1, 'and nobody when there is nobody near');
  g.assign(0, 'stopper');
  ok(g.kitAt((a.x + b.x) / 2, a.y - 5, 'stopper', 40) === 1, 'it prefers a kit that can take the chosen job');
}

// ---- determinism
for (const i of [7, 20, 29]) {
  const a = replay(i, LEVELS[i].solution), b = replay(i, LEVELS[i].solution);
  ok(a.tick === b.tick && a.saved === b.saved && Buffer.from(a.mask).equals(Buffer.from(b.mask)), `${LEVELS[i].id}: a replay is exact, terrain and all`);
  eq(a.kits.map((k) => [k.x, k.y, k.state]), b.kits.map((k) => [k.x, k.y, k.state]), `${LEVELS[i].id}: every kit ends in the same place`);
}

// ---- saving
{
  ok(SAVE_KEY === 'kit-parade-v1', 'versioned save key');
  eq(readProfile(null), freshProfile(), 'no save starts fresh');
  eq(readProfile('{nope'), freshProfile(), 'a broken save starts fresh');
  eq(readProfile(JSON.stringify({ v: 2, best: { m1: { stars: 3, saved: 1, used: 0, time: 1 } } })), freshProfile(), 'an old or newer version starts fresh');
  const p = readProfile(JSON.stringify({ v: 1, level: 99, muted: true, best: { m1: { stars: 7, saved: 10, used: 0, time: 600 }, m2: { stars: 'x' }, zz: { stars: 1, saved: 1, used: 1, time: 1 } } }));
  ok(p.best.m1.stars === 3 && !p.best.m2 && !p.best.zz && p.level === 0 && p.muted, 'a save is read defensively');
  const q = freshProfile();
  ok(unlocked(q, 0) && !unlocked(q, 1), 'only the first level is open at first');
  const r = replay(0, []).result(), news = record(q, r);
  ok(news.includes('Level cleared!') && unlocked(q, 1) && totalStars(q) === 3, 'clearing a level opens the next');
  const worse = { ...r, stars: 1, saved: 6, used: 2, time: 9999 };
  record(q, worse);
  eq(q.best.m1, { stars: 3, saved: 10, used: 0, time: r.time }, 'a worse run never lowers a best');
  ok(record(q, { ...r, cleared: false, stars: 0 }).length === 0, 'a run that falls short records nothing');
  eq(readProfile(JSON.stringify(q)), q, 'a profile round-trips');
}

console.log(`Kit Parade: ${checks} engine checks passed.`);
