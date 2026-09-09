import assert from 'node:assert/strict';
import { DustBathGame, SHOP } from '../.checks/dust-bath-game.js';
let checks = 0;
const test = (name, fn) => {
  fn();
  checks++;
  console.log(`PASS ${name}`);
};
const fresh = (mode = 'shift', seed = 27) => {
  const g = new DustBathGame(seed);
  g.start(mode);
  return g;
};
const seat = (g, i = 0) => {
  assert(g.select(g.queue[0].id));
  assert(g.seat(i));
};
const scrub = (g, duration = 1.3) => {
  assert(g.begin());
  g.step(duration);
  return g.release();
};
test('ready and invalid actions are safe', () => {
  const g = new DustBathGame();
  assert(!g.begin());
  assert(!g.release());
  assert(!g.select(42));
  assert(!g.seat(-1));
  assert(!g.treat());
  assert(!g.refillSupplies());
  assert(!g.buy('decor'));
  g.step(120);
  assert.equal(g.state, 'ready');
});
test('seeded arrivals and bounded queue', () => {
  const a = fresh(),
    b = fresh();
  a.step(20);
  b.step(20);
  assert.deepEqual(a, b);
  assert.equal(a.queue.length, 4);
  assert.notDeepEqual(fresh('shift', 9).queue, fresh().queue);
});
test('select then seat, occupied baths and hold lock', () => {
  const g = fresh();
  assert(!g.seat(0));
  seat(g);
  const id = g.baths[0].guest.id;
  g.select(g.queue[0].id);
  g.seat(0);
  assert.equal(g.baths[0].guest.id, id);
  g.begin();
  assert(!g.seat(1));
  assert(!g.begin());
  assert.equal(g.dust, 5);
  g.cancel();
  assert(!g.holding);
});
test('sweet spot pays once, short hold retries, full hold sneezes', () => {
  const g = fresh();
  seat(g);
  assert(!scrub(g, 0.2));
  assert(g.baths[0].guest);
  assert(scrub(g));
  assert.equal(g.coins, 12);
  assert.equal(g.served, 1);
  assert.equal(g.perfect, 1);
  assert(!g.release());
  assert.equal(g.coins, 12);
});
test('sneeze splashes only occupied neighbors and treats repair mess', () => {
  const g = fresh();
  seat(g, 0);
  seat(g, 1);
  g.seat(0);
  assert(!scrub(g, 2));
  assert.equal(g.baths[0].mess, 1);
  assert.equal(g.baths[1].mess, 1);
  assert.equal(g.baths[2].mess, 0);
  assert.match(g.message, /achoo/);
  assert(g.treat());
  assert.equal(g.baths[0].mess, 0);
  g.seat(1);
  assert(scrub(g));
  assert.equal(g.coins, 10);
  assert.equal(g.perfect, 0);
});
test('dust depletion, refill cooldown, treats restore waiting patience', () => {
  const g = fresh();
  seat(g);
  for (let n = 0; n < 6; n++) scrub(g, 0.05);
  assert.equal(g.dust, 0);
  assert(!g.begin());
  assert(g.refillSupplies());
  assert(!g.refillSupplies());
  g.step(2.9);
  assert.equal(g.dust, 0);
  g.step(0.1);
  assert.equal(g.dust, 6);
  g.select(g.queue[0].id);
  assert(g.treat());
  assert.equal(g.queue[0].patience, g.queue[0].maxPatience);
  assert.equal(g.treats, 2);
});
test('pause freezes all simulation and cancels charge', () => {
  const g = fresh();
  seat(g);
  g.begin();
  g.step(0.5);
  g.refillSupplies();
  g.pause();
  const snapshot = JSON.stringify(g);
  g.step(50);
  assert.equal(JSON.stringify(g), snapshot);
  assert(!g.holding);
  assert(!g.treat());
  assert(!g.release());
  g.pause();
  g.step(1);
  assert(g.time < 119);
});
test('patience departures clear selected and active hold', () => {
  const g = fresh();
  seat(g);
  g.baths[0].guest.patience = 0.1;
  g.select(g.queue[0].id);
  g.queue[0].patience = 0.1;
  g.begin();
  g.step(0.2);
  assert.equal(g.missed, 2);
  assert.equal(g.selected, null);
  assert.equal(g.baths[0].guest, null);
  assert(!g.holding);
});
test('exact two-minute ending freezes rewards and restart resets shift only', () => {
  const g = fresh();
  seat(g);
  scrub(g);
  g.step(118.7);
  assert.equal(g.time, 0);
  assert.equal(g.state, 'finished');
  const snapshot = JSON.stringify(g);
  g.step(5);
  assert.equal(JSON.stringify(g), snapshot);
  assert(!g.begin());
  g.start('shift');
  assert.equal(g.coins, 12);
  assert.equal(g.earned, 0);
  assert.equal(g.served, 0);
  assert.equal(g.dust, 6);
  assert.equal(g.time, 120);
  assert(!g.start('cozy'));
});
test('cozy has unlimited time and patience, manual ending', () => {
  const g = fresh('cozy');
  seat(g);
  const guest = { ...g.baths[0].guest };
  g.step(600);
  assert.equal(g.time, 120);
  assert.equal(g.state, 'playing');
  assert.deepEqual(g.baths[0].guest, guest);
  assert.equal(g.missed, 0);
  assert.equal(g.queue.length, 4);
  g.finish();
  assert.equal(g.state, 'finished');
});
test('all purchases enforce costs, phase, ownership and persist', () => {
  const g = fresh();
  g.coins = 200;
  assert(!g.buy('towels'));
  g.finish();
  for (const key of Object.keys(SHOP)) {
    const before = g.coins;
    assert(g.buy(key));
    assert.equal(g.coins, before - SHOP[key].cost);
    assert(!g.buy(key));
  }
  g.start('shift');
  assert(g.upgrades.decor);
  assert.equal(g.queue[0].maxPatience, 55);
  assert.equal(g.low, 0.52);
  assert.equal(g.high, 0.9);
  seat(g);
  seat(g, 1);
  g.seat(0);
  scrub(g, 2);
  assert.equal(g.baths[1].mess, 0.5);
  assert(g.refillSupplies());
  g.step(1);
  assert.equal(g.refill, 0);
  assert.equal(g.dust, 6);
  assert(scrub(g, 1));
});
test('invalid time and chunking remain stable', () => {
  const a = fresh(),
    b = fresh();
  for (const dt of [-1, NaN, Infinity, 0]) a.step(dt);
  assert.deepEqual(a, b);
  a.step(10);
  for (let i = 0; i < 600; i++) b.step(1 / 60);
  assert(Math.abs(a.time - b.time) < 1e-8);
  assert.deepEqual(
    a.queue.map(({ patience: _patience, ...c }) => c),
    b.queue.map(({ patience: _patience, ...c }) => c),
  );
  a.queue.forEach((c, i) =>
    assert(Math.abs(c.patience - b.queue[i].patience) < 1e-8),
  );
});
console.log(`Dust Bath Dash: ${checks} deterministic test groups passed.`);
