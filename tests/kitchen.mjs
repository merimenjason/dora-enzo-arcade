import assert from 'node:assert/strict';
import {
  Kitchen,
  freshProfile,
  parseProfile,
  buyUpgrade,
  settle,
} from '../.checks/kitchen-game.js';
const g = new Kitchen(0, false, [0, 0, 0], 1),
  id = g.orders[0].id;
assert.equal(g.advance(id, 2), '');
assert.equal(g.jobs[0].crew, 2);
assert.notEqual(g.advance(id), '');
g.tick(3);
assert.equal(g.orders.find((o) => o.id === id).stage, 'prepared');
g.advance(id, 3);
g.tick(5);
assert.equal(g.orders.find((o) => o.id === id).stage, 'ready');
g.advance(id, 1);
g.tick(2);
assert.equal(g.served, 1);
assert.notEqual(g.advance(id), '');
assert.equal(g.served, 1);
const oven = new Kitchen();
oven.orders.forEach((o) => (o.stage = 'prepared'));
assert.equal(oven.advance(oven.orders[0].id), '');
assert.match(oven.advance(oven.orders[1].id), /oven/);
const two = new Kitchen(0, false, [0, 2, 0]);
two.orders.forEach((o) => (o.stage = 'prepared'));
two.orders.forEach((o) => assert.equal(two.advance(o.id), ''));
assert.equal(two.jobs.length, 2);
const expire = new Kitchen();
expire.orders[0].patience = 0.1;
expire.advance(expire.orders[0].id);
expire.tick(0.2);
assert.equal(expire.missed, 1);
assert.equal(expire.jobs.length, 0);
assert.equal(expire.bell(), true);
assert.equal(expire.bell(), false);
expire.tick(23);
assert.equal(expire.bell(), true);
const cozy = new Kitchen(11, true);
cozy.tick(60);
cozy.tick(60);
assert.equal(cozy.missed, 0);
assert.equal(cozy.ended, false);
cozy.finish();
assert.deepEqual(settle(freshProfile(), cozy), freshProfile());
assert.deepEqual(parseProfile('{bad'), freshProfile());
assert.equal(
  parseProfile(
    '{"version":1,"coins":1e99,"unlocked":999,"upgrades":[-3,12,1.4]}',
  ).unlocked,
  12,
);
assert.deepEqual(
  parseProfile('{"version":1,"upgrades":[-3,12,1.4]}').upgrades,
  [0, 3, 1],
);
const p = freshProfile();
assert.equal(buyUpgrade(p, 0), p);
p.coins = 100;
assert.equal(buyUpgrade(p, 0).coins, 10);
let minimum = 999;
for (let day = 0; day < 12; day++)
  for (let seed = 1; seed <= 20; seed++) {
    const k = new Kitchen(day, false, [0, 0, 0], seed);
    while (!k.ended) {
      k.bell();
      for (const o of [...k.orders].sort((a, b) => a.patience - b.patience))
        if (k.canAdvance(o)) k.advance(o.id);
      k.tick(0.1);
    }
    assert(
      k.result.won,
      `shift ${day + 1} seed ${seed}: ${k.served}/${k.goal}`,
    );
    minimum = Math.min(minimum, k.served - k.goal);
  }
const idle = new Kitchen();
idle.tick(60);
idle.tick(60);
assert.equal(idle.result.won, false);
console.log(
  'PASS kitchen stages, crew ownership, oven capacity, expiry, bell, cozy, save validation, upgrades and 240 campaign simulations; minimum goal margin ' +
    minimum,
);
