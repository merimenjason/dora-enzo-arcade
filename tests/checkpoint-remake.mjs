import assert from 'node:assert/strict';
import { RemakeGame, routePose } from '../.checks/checkpoint-remake-game.js';
import {
  makeDay,
  makeTraveler,
  Rng,
  SPECIES,
  violations,
} from '../.checks/checkpoint-game.js';
const g = new RemakeGame(3);
g.next();
assert.equal(g.processed, 0);
g.begin();
assert.equal(g.decide(false), null);
g.traveler = makeTraveler(g.day, new Rng(9), true);
assert(g.decide(true).correct);
const money = g.credits;
assert.equal(g.decide(true), null);
assert.equal(g.credits, money);
g.next();
assert.equal(g.selected.length, 0);
for (const species of SPECIES)
  for (const approved of [true, false]) {
    const a = new RemakeGame();
    a.day = makeDay(7);
    a.traveler = makeTraveler(a.day, new Rng(1), true);
    a.traveler.papers.species = species;
    if (approved) a.day.bannedSpecies = [];
    else a.traveler.papers.expires = 0;
    a.begin();
    if (!approved) a.toggle('expired');
    assert(a.decide(approved).correct, `${species} ${approved}`);
  }
const bad = new RemakeGame();
bad.begin();
bad.traveler = makeTraveler(bad.day, new Rng(8), true);
bad.traveler.papers.expires = 0;
bad.toggle('name');
assert(
  !bad.decide(false).correct,
  'unsupported reason cited even on invalid file',
);
const multi = new RemakeGame();
multi.begin();
multi.traveler.papers.expires = 0;
multi.toggle('expired');
assert(multi.decide(false).correct, 'one valid reason sufficient');
const clock = new RemakeGame();
clock.begin(true);
clock.tick(-1);
clock.tick(NaN);
assert.equal(clock.remaining, 150);
clock.tick(200);
assert.equal(clock.state, 'report');
const c = clock.credits;
clock.end();
assert.equal(clock.credits, c, 'rent charged once');
clock.nextDay();
assert.equal(clock.state, 'report', 'must choose affordable supper');
assert(clock.settle('warm'));
assert(!clock.settle('warm'));
clock.nextDay();
clock.begin(true);
assert.equal(clock.remaining, 170);
const hold = new RemakeGame();
hold.begin(true);
hold.decide(true);
hold.tick(200);
assert.equal(hold.state, 'shift', 'verdict remains visible at timeout');
hold.next();
assert.equal(hold.state, 'report');
const untimed = new RemakeGame();
untimed.begin();
untimed.tick(9999);
assert.equal(untimed.remaining, 150);
const week = new RemakeGame();
for (let d = 1; d <= 7; d++) {
  week.begin();
  while (week.state === 'shift') {
    const flags = violations(week.traveler.papers, week.day);
    if (flags.length) week.toggle(flags[0]);
    assert(week.decide(!flags.length).correct);
    week.next();
  }
  assert(week.settle('basic'));
  week.nextDay();
}
assert.equal(week.state, 'ending');
assert.equal(week.accuracy, 100);
assert(week.credits > 0);
const broke = new RemakeGame();
broke.begin();
broke.credits = 0;
broke.end();
assert(!broke.settle('basic'));
broke.nextDay();
assert.equal(broke.state, 'ending');
for (const approved of [true, false]) {
  let last = routePose(approved, 0);
  for (let t = 0.01; t < 9; t += 0.01) {
    const p = routePose(approved, t);
    assert(
      Math.hypot(p.x - last.x, p.z - last.z) < 0.019,
      'continuous speed-bounded motion',
    );
    if (!p.walking) assert(Math.hypot(p.x - last.x, p.z - last.z) < 0.019);
    assert(p.z <= 0, 'never intersects booth');
    assert(p.x >= 0, 'never intersects scale at x=-2.3');
    if (p.x > 0.4)
      assert.equal(p.z, -1.5, 'approved path stays within separate lane');
    if (p.x > 4.2 && p.x < 4.8) assert(t > 2, 'gate has time to rise');
    last = p;
  }
  assert(routePose(approved, 20).done);
}
assert.equal(routePose(true, 0.3).x, 0);
assert.equal(routePose(true, 0.3).z, 0);
assert(!routePose(true, 0.3).walking);
assert.equal(routePose(false, 20).z, -6);
console.log(
  'PASS remake: all species and verdicts, evidence, idempotency, clocks, budgets, full week, bankruptcy, collision-safe routes.',
);

// E2: All eight evidence reasons and exact accounting, without relying on a random fault mix.
const faultSetters = {
  permit: (p) => {
    p.hasPermit = false;
  },
  name: (p) => {
    p.permitName = 'ANOTHER NAME';
  },
  region: (p) => {
    p.permitRegion = p.region === 'SALT FLATS' ? 'HAY VALLEY' : 'SALT FLATS';
  },
  expired: (p) => {
    p.expires = 0;
  },
  weight: (p) => {
    p.statedWeight = p.weight + 16;
  },
  seal: (p) => {
    p.sealed = false;
  },
  species: (p, d) => {
    p.species = d.bannedSpecies[0];
  },
  purpose: (p) => {
    p.purpose = 'transit';
  },
};
for (const [flag, plant] of Object.entries(faultSetters)) {
  const e = new RemakeGame();
  e.day = makeDay(7);
  e.traveler = makeTraveler(e.day, new Rng(17), true);
  plant(e.traveler.papers, e.day);
  e.begin();
  e.toggle(flag);
  const initialCredits = e.credits;
  const v = e.decide(false);
  assert(v.correct, flag);
  assert.deepEqual(v.flags, [flag]);
  assert.equal(e.credits, initialCredits + 6);
  assert.equal(e.total, 1);
  assert.equal(e.correctTotal, 1);
  assert.equal(e.citations, 0);
  assert.equal(e.log.length, 1);
  assert(e.log[0].includes('returned · +6 credits'));
  const chosen = [...e.selected];
  e.toggle(flag);
  assert.deepEqual(e.selected, chosen, 'cannot edit evidence after judgment');
  assert.equal(e.decide(false), null);
  assert.equal(e.credits, initialCredits + 6);
}
const mixed = new RemakeGame();
mixed.begin();
mixed.traveler = makeTraveler(mixed.day, new Rng(17), true);
mixed.traveler.papers.expires = 0;
mixed.toggle('expired');
mixed.toggle('name');
assert(
  !mixed.decide(false).correct,
  'one invalid reason invalidates mixed submission',
);
assert.equal(mixed.credits, 21);
assert.equal(mixed.citations, 1);
assert.equal(mixed.accuracy, 0);
assert(mixed.log[0].includes('−3 credits'));
const early = new RemakeGame();
early.toggle('name');
assert.deepEqual(early.selected, []);
assert.equal(early.decide(true), null);
early.tick(200);
early.nextDay();
assert.equal(early.state, 'briefing');
assert(!early.settle('basic'));
early.begin(true);
early.tick(2);
early.begin(false);
assert(early.timed);
assert.equal(early.remaining, 148, 'repeat begin cannot reset timer');
early.toggle('name');
early.toggle('name');
assert.deepEqual(early.selected, []);
const edges = new RemakeGame();
edges.begin();
edges.end();
edges.credits = 3;
assert(!edges.settle('warm'));
assert.equal(edges.credits, 3);
assert(edges.settle('basic'));
assert.equal(edges.credits, 0);
assert.equal(edges.bonus, 0);
edges.nextDay();
assert.equal(
  edges.state,
  'briefing',
  'zero savings after paid supper may continue',
);
assert.equal(week.total, 55);
assert.equal(week.credits, 151);
assert.equal(week.ending, 'A little further north.');
assert.equal(broke.ending, 'The lights go out.');
for (const approved of [true, false])
  for (let t = 0.001; t < 8; t += 0.01) {
    const previous = routePose(approved, t - 0.001),
      pose = routePose(approved, t);
    const dx = pose.x - previous.x,
      dz = pose.z - previous.z,
      d = Math.hypot(dx, dz);
    if (pose.walking && d > 0.00001)
      assert(
        (dx * Math.sin(pose.heading) + dz * Math.cos(pose.heading)) / d > 0.99,
        'walk direction follows facing, never sideways',
      );
    if (!pose.walking && pose.heading !== previous.heading)
      assert(d < 0.00001, 'turns occur in place');
  }
console.log(
  'PASS E2: all eight fault reasons, exact +6/−3 accounting/logs, mixed-reason rejection, phase guards, meal affordability boundary, 55-case/151-credit ending, facing-aligned walks.',
);
