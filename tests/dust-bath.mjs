import assert from 'node:assert/strict';
import {
  DustBathGame,
  SHOP,
  BREEDS,
  STAGES,
} from '../.checks/dust-bath-game.js';
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
/** Match the seated guest's temp/grain wishes at bath i. */
const matchWishes = (g, i = 0) => {
  const b = g.baths[i];
  while (b.temp !== b.guest.temp) g.cycleTemp(i);
  while (b.grain !== b.guest.grain) g.cycleGrain(i);
};
/** Release exactly in the current stage's sweet-spot centre. */
const perfectStage = (g) => {
  const b = g.baths[g.activeBath];
  const { center } = g.spot(b);
  assert(g.begin());
  g.step(center * 1.7);
  return g.release();
};
/** Run every stage of the active bath at its sweet-spot centre. */
const fullBath = (g) => {
  const stages = g.baths[g.activeBath].guest.stages;
  for (let s = 0; s < stages; s++) assert(perfectStage(g));
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
  assert(!g.cycleTemp(0));
  assert(!g.cycleGrain(0));
  g.step(120);
  assert.equal(g.state, 'ready');
});

test('breeds carry distinct wishes, patience, tips and VIP stage counts', () => {
  const ids = new Set(BREEDS.map((b) => b.id));
  assert.equal(ids.size, 6);
  const vips = BREEDS.filter((b) => b.vip);
  assert.equal(vips.length, 2);
  for (const b of vips) assert.equal(b.stages, 4);
  for (const b of BREEDS.filter((x) => !x.vip)) assert.equal(b.stages, 3);
  // Wishes span the full temp/grain space, not a single default.
  assert(new Set(BREEDS.map((b) => b.temp)).size >= 3);
  assert(new Set(BREEDS.map((b) => b.grain)).size >= 3);
});

test('seeded arrivals and bounded queue', () => {
  const a = fresh(),
    b = fresh();
  a.step(30);
  b.step(30);
  assert.deepEqual(a, b);
  assert.equal(a.queue.length, 5);
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
  assert(!g.cycleTemp(0));
  assert.equal(g.dust, 5);
  g.cancel();
  assert(!g.holding);
});

test('multi-stage bath advances pour to style and pays on completion', () => {
  const g = fresh();
  seat(g);
  const guest = g.baths[0].guest;
  const stages = guest.stages;
  for (let s = 0; s < stages; s++) {
    assert.equal(g.baths[0].stage, s);
    assert(perfectStage(g));
    if (s < stages - 1) assert(g.baths[0].guest, 'guest stays until final stage');
  }
  assert.equal(g.served, 1);
  assert.equal(g.baths[0].guest, null);
  assert(g.coins > 0);
});

test('short hold retries the same stage without advancing', () => {
  const g = fresh();
  seat(g);
  assert.equal(g.baths[0].stage, 0);
  assert(g.begin());
  g.step(0.2);
  assert(!g.release());
  assert.equal(g.baths[0].stage, 0);
  assert(g.baths[0].guest);
});

test('overshoot sneezes, splashes occupied neighbors and breaks streak', () => {
  const g = fresh();
  seat(g, 0);
  seat(g, 1);
  g.seat(0);
  g.streak = 3;
  assert(g.begin());
  g.step(2);
  assert(!g.release());
  assert.equal(g.baths[0].mess, 1);
  assert.equal(g.baths[1].mess, 1);
  assert.equal(g.baths[2].mess, 0);
  assert.equal(g.streak, 0);
  assert.match(g.message, /achoo/);
});

test('matching temp and grain pays a prep bonus over a mismatch', () => {
  const matched = fresh();
  seat(matched);
  matchWishes(matched);
  assert.equal(matched.matchScore(matched.baths[0]), 2);
  fullBath(matched);
  const withBonus = matched.coins;

  const plain = fresh();
  seat(plain);
  const b = plain.baths[0];
  // Force a full mismatch on both axes.
  while (b.temp === b.guest.temp) plain.cycleTemp(0);
  while (b.grain === b.guest.grain) plain.cycleGrain(0);
  assert.equal(plain.matchScore(b), 0);
  fullBath(plain);
  assert(withBonus > plain.coins, 'matched wishes earn more than a mismatch');
});

test('combo multiplier grows with flawless baths and boosts payout', () => {
  const g = fresh();
  assert.equal(g.multiplier, 1);
  for (let n = 0; n < 3; n++) {
    seat(g);
    matchWishes(g);
    fullBath(g);
    if (g.dust === 0) {
      g.refillSupplies();
      g.step(3);
    }
  }
  assert.equal(g.streak, 3);
  assert(g.multiplier > 1);
  assert(g.perfect >= 3);
  assert(g.bestStreak >= 3);
});

test('dust depletion, scoop capacity, refill cooldown, treats restore patience', () => {
  const g = fresh();
  // Each pour costs one dust; drain the tub via repeated short pours.
  seat(g);
  for (let n = 0; n < 6; n++) {
    assert(g.begin());
    g.step(0.05);
    g.release();
    assert.equal(g.baths[0].stage, 0);
  }
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
  assert(!g.cycleTemp(0));
  g.pause();
  g.step(1);
  assert(g.time < 119);
});

test('patience departures clear selection, active hold and streak', () => {
  const g = fresh();
  seat(g);
  g.streak = 4;
  g.baths[0].guest.patience = 0.1;
  g.select(g.queue[0].id);
  g.queue[0].patience = 0.1;
  g.begin();
  g.step(0.2);
  assert.equal(g.missed, 2);
  assert.equal(g.selected, null);
  assert.equal(g.baths[0].guest, null);
  assert.equal(g.streak, 0);
  assert(!g.holding);
});

test('exact two-minute ending freezes rewards and restart resets shift only', () => {
  const g = fresh();
  seat(g);
  fullBath(g);
  const banked = g.coins;
  assert(banked > 0);
  g.step(118.7);
  assert.equal(g.time, 0);
  assert.equal(g.state, 'finished');
  const snapshot = JSON.stringify(g);
  g.step(5);
  assert.equal(JSON.stringify(g), snapshot);
  assert(!g.begin());
  g.start('shift');
  assert.equal(g.coins, banked);
  assert.equal(g.earned, 0);
  assert.equal(g.served, 0);
  assert.equal(g.streak, 0);
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
  assert.equal(g.queue.length, 5);
  g.finish();
  assert.equal(g.state, 'finished');
});

test('all six upgrades enforce costs, phase, ownership and effects', () => {
  const g = fresh();
  g.coins = 400;
  assert(!g.buy('towels'));
  g.finish();
  for (const key of Object.keys(SHOP)) {
    const before = g.coins;
    assert(g.buy(key));
    assert.equal(g.coins, before - SHOP[key].cost);
    assert(!g.buy(key));
  }
  // Lounge adds a fourth station; scoop lifts dust capacity.
  assert.equal(g.baths.length, 4);
  assert.equal(g.maxDust, 8);
  g.start('shift');
  assert.equal(g.baths.length, 4);
  assert.equal(g.dust, 8);
  assert(g.upgrades.decor);
  // Decor grants +12 patience over each breed's base.
  const base = BREEDS.find((b) => b.id === g.queue[0].breed).patience;
  assert(g.queue[0].maxPatience >= base + 8);
  // Towels + thermo widen the pour window vs a plain game.
  const plain = fresh();
  seat(plain);
  seat(g);
  const wide = g.spot(g.baths[0]);
  const narrow = plain.spot(plain.baths[0]);
  assert(wide.hi - wide.lo > narrow.hi - narrow.lo);
});

test('restore loads saved coins and upgrades only before a shift', () => {
  const g = new DustBathGame();
  assert(g.restore(120, { lounge: true, towels: true }));
  assert.equal(g.coins, 120);
  assert(g.upgrades.lounge);
  assert.equal(g.baths.length, 4);
  g.start('shift');
  assert(!g.restore(999, { decor: true }));
  assert.equal(g.coins, 120);
  assert(!g.upgrades.decor);
});

test('VIP guests appear over time and require four stages', () => {
  const g = fresh();
  g.step(120); // let arrivals accumulate with rising VIP chance
  let sawVip = false;
  for (let i = 0; i < 400 && !sawVip; i++) {
    // Drain and reseat to sample many guests deterministically.
    if (!g.queue.length) g.step(6);
    if (!g.queue.length) continue;
    const c = g.queue[0];
    if (c.vip) {
      sawVip = true;
      assert.equal(c.stages, 4);
    }
    g.select(c.id);
    g.treat();
    g.queue = g.queue.slice(1);
  }
  assert(sawVip, 'a VIP guest should arrive within a long shift');
});

test('invalid time and chunking remain stable', () => {
  const a = fresh(),
    b = fresh();
  for (const dt of [-1, NaN, Infinity, 0]) a.step(dt);
  assert.deepEqual(a, b);
  a.step(10);
  for (let i = 0; i < 600; i++) b.step(1 / 60);
  assert(Math.abs(a.time - b.time) < 1e-6);
  assert.deepEqual(
    a.queue.map(({ patience: _p, ...c }) => c),
    b.queue.map(({ patience: _p, ...c }) => c),
  );
  a.queue.forEach((c, i) =>
    assert(Math.abs(c.patience - b.queue[i].patience) < 1e-6),
  );
  assert.deepEqual(STAGES, ['pour', 'scrub', 'fluff', 'style']);
});

console.log(`Dust Bath Dash: ${checks} deterministic test groups passed.`);
