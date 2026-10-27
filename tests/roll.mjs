// Fluff Roll engine tests: layout, sticking and bumping, critters, golden acorns, streaks, the next-up hint and the save.
import assert from 'node:assert/strict';
import { RollGame, LEVELS, KINDS, DT, PICK, GOLDEN_TIME, layout, readProfile, sticksAt, topSpeed } from '../.checks/roll-game.js';

const freeOf = (g, kind) => g.things.filter((t) => t.kind === kind && !t.stuck);
// park the ball right on top of a thing and step once
function rollOnto(g, t) { g.ball.x = t.x; g.ball.z = t.z - (g.ball.r + t.r) * 0.9; g.ball.vx = g.ball.vz = 0; g.setInput(0, 0); g.step(DT); }

// the same seed lays out the same level, and every level has its golden acorns
for (const spec of LEVELS) {
  const a = layout(spec), b = layout(spec);
  assert.deepEqual(a.map((t) => [t.kind, t.x, t.z]), b.map((t) => [t.kind, t.x, t.z]), `${spec.id} lays out the same way twice`);
  assert.equal(a.filter((t) => t.kind === 'golden').length, 3, `${spec.id} has three golden acorns`);
}

// the same steering replays the same game, critters included
{
  const run = () => { const g = new RollGame({ level: 'corner' }); g.skipIntro(); for (let i = 0; i < 1800; i++) { g.steer(Math.sin(i / 90), 1, DT); g.step(DT); } return [g.ball.x, g.ball.z, g.ball.r, g.stuck.length, freeOf(g, 'mouse').map((t) => t.x)]; };
  assert.deepEqual(run(), run(), 'a replay matches');
}

// things up to PICK of the radius stick; bigger ones are in the way and say how big the ball must be
{
  const g = new RollGame({ level: 'corner' }); g.skipIntro();
  const small = g.things.find((t) => g.canRoll(t) && !KINDS[t.kind].walk);
  rollOnto(g, small); assert.ok(small.stuck, 'a small thing sticks');
  const big = g.things.find((t) => t.kind === 'tub'); assert.ok(!g.canRoll(big));
  rollOnto(g, big); assert.ok(!big.stuck, 'a big thing does not stick');
  assert.ok(Math.abs(sticksAt(big.r) * PICK - big.r) < 1e-12);
}

// the next-up hint names the smallest kind the ball can't roll yet, and growing past it says so
{
  const g = new RollGame({ level: 'corner' }); g.skipIntro();
  const next = g.nextUp(); assert.ok(next && KINDS[next.kind].r > g.ball.r * PICK, 'next up is still too big');
  assert.ok(Object.values(KINDS).filter((k) => k.r > g.ball.r * PICK && k.r < KINDS[next.kind].r).every((k) => !g.things.some((t) => t.kind === k.id) || k.tags?.includes('golden')), 'nothing in the level sits between');
  const things = g.things.filter((t) => g.canRoll(t) && !KINDS[t.kind].walk).slice(0, 400);
  const seen = [];
  for (const t of things) { if (t.stuck || !g.canRoll(t)) continue; rollOnto(g, t); seen.push(...g.events.filter((e) => e.kind === 'ready').flatMap((e) => e.kinds)); g.events.length = 0; if (g.ball.r >= sticksAt(KINDS[next.kind].r)) break; }
  assert.ok(seen.includes(next.kind), `growing to ${next.kind} size calls it out`);
  assert.ok(!seen.includes('golden'), 'golden acorns are never called out');
}

// streaks: catches within a second of each other count up
{
  const g = new RollGame({ level: 'corner' }); g.skipIntro();
  const ts = g.things.filter((t) => g.canRoll(t) && !KINDS[t.kind].walk).slice(0, 3);
  for (const t of ts) rollOnto(g, t);
  assert.deepEqual(g.events.filter((e) => e.kind === 'stick').map((e) => e.streak), [1, 2, 3]);
  for (let i = 0; i < 90; i++) g.step(DT);
  g.events.length = 0;
  rollOnto(g, g.things.find((t) => !t.stuck && g.canRoll(t) && !KINDS[t.kind].walk && t.r < g.ball.r * 0.3));
  assert.equal(g.events.find((e) => e.kind === 'stick').streak, 1, 'a pause ends the streak'); assert.ok(g.bestStreak >= 3);
}

// a golden acorn adds time, counts, and is kept as the level's best
{
  const g = new RollGame({ level: 'garden' }); g.skipIntro();
  const gold = freeOf(g, 'golden')[0], before = g.left;
  rollOnto(g, gold);
  assert.ok(gold.stuck); assert.equal(g.goldens, 1);
  assert.ok(Math.abs(g.left - (before - DT + GOLDEN_TIME)) < 1e-9, 'golden time added');
  assert.ok(g.events.some((e) => e.kind === 'golden' && e.found === 1));
  g.left = DT / 2; g.step(DT); assert.equal(g.mode, 'done'); assert.equal(g.profile.golden.garden, 1);
}

// critters potter about, run from a ball that could roll them up, but the ball is always faster
{
  const g = new RollGame({ level: 'corner' }); g.skipIntro();
  const bug = freeOf(g, 'ladybird')[0], x0 = bug.x, z0 = bug.z;
  g.ball.x = g.ball.z = -6; for (let i = 0; i < 600; i++) g.step(DT);
  assert.ok(Math.hypot(bug.x - x0, bug.z - z0) > 0.02, 'a ladybird wanders');
  // put the ball just behind it: it runs, and stays inside the fence
  g.ball.x = bug.x - g.ball.r * 3; g.ball.z = bug.z; const d0 = Math.hypot(bug.x - g.ball.x, bug.z - g.ball.z);
  for (let i = 0; i < 20; i++) { g.setInput(0, 0); g.ball.vx = g.ball.vz = 0; g.step(DT); }
  assert.ok(Math.hypot(bug.x - g.ball.x, bug.z - g.ball.z) > d0, 'it runs from the ball');
  // chase it down
  for (let i = 0; i < 1200 && !bug.stuck; i++) { const a = Math.atan2(bug.z - g.ball.z, bug.x - g.ball.x); g.setInput(Math.cos(a), Math.sin(a)); g.step(DT); }
  assert.ok(bug.stuck, 'the ball catches it');
  for (const t of g.things) assert.ok(Math.abs(t.x) <= g.spec.half && Math.abs(t.z) <= g.spec.half);
  // a critter too big to roll up does not run
  const duck = new RollGame({ level: 'garden' }); duck.skipIntro();
  const d = freeOf(duck, 'duck')[0]; assert.ok(!duck.canRoll(d));
  assert.ok(Math.min(KINDS.duck.walk * 2.2, topSpeed(duck.ball.r) * 0.45) < topSpeed(duck.ball.r));
}

// the save: junk is dropped, golden counts are kept
{
  const p = readProfile(JSON.stringify({ unlocked: ['corner', 'garden', 'nope'], golden: { corner: 2, garden: -1, nope: 3 }, best: {}, stars: {}, found: ['golden', 'x'], rolled: 4 }));
  assert.deepEqual(p.unlocked, ['corner', 'garden']); assert.deepEqual(p.golden, { corner: 2 }); assert.deepEqual(p.found, ['golden']);
  assert.deepEqual(readProfile('{bad').golden, {});
}
console.log('Fluff Roll engine tests passed.');
