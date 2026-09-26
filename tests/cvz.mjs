import assert from 'node:assert/strict';
import {
  Game, DEFENDERS, DEFENDER_IDS, ZOMBIES, LEVELS, ROWS, COLS, START_SEEDS, SEED_VALUE, SEED_LIFE, FIRST_WAVE, WAVE_GAP,
  planLevel, unlockedBy,
} from '../.checks/cvz-game.js';
import { play, tend } from './cvz-bot.mjs';

const step = (g, seconds, each) => { for (let i = 0; i < seconds * 60 && g.state === 'playing'; i++) { g.update(1 / 60); each?.(g); } };
/** A quiet lawn: every defender unlocked, plenty of seeds, no recharges, and one zombie parked far in the future so the level doesn't end. */
const lawn = (level = 7) => {
  const g = new Game(level, 1);
  g.unlocked = [...DEFENDER_IDS]; g.seeds = 1e6; g.spawns = [{ kind: 'zombie', row: g.def.rows[0], at: 1e9 }];
  for (const k of DEFENDER_IDS) g.recharge[k] = 0;
  return g;
};
/** Plants without waiting for the recharge. */
const put = (g, kind, row, col) => { g.recharge[kind] = 0; assert.equal(g.plant(kind, row, col), 'ok', `plant ${kind} at ${row},${col}`); return g.at(row, col); };
/** Puts one zombie on the lawn at x in the given row. */
const drop = (g, kind, row, x) => {
  g.spawns.unshift({ kind, row, at: g.time });
  g.update(1 / 600);
  const z = g.zombies.at(-1);
  z.x = x;
  return z;
};

// ---------- Planting ----------
{
  const g = new Game(0, 1);
  assert.equal(g.seeds, START_SEEDS);
  assert.deepEqual(g.unlocked, ['gatherer', 'flicker']);
  assert.equal(g.canPlant('pebble', 1, 0), 'locked');
  assert.equal(g.canPlant('gatherer', 0, 0), 'lane', 'level 1 has only the middle three lanes');
  assert.equal(g.canPlant('gatherer', 1, COLS), 'bounds');
  assert.equal(g.canPlant('flicker', 1, 0), 'seeds', '75 seeds do not buy a 100-seed Flicker');
  assert.equal(g.plant('gatherer', 1, 0), 'ok');
  assert.equal(g.seeds, START_SEEDS - DEFENDERS.gatherer.cost);
  assert.equal(g.canPlant('gatherer', 2, 0), 'recharge');
  g.seeds = 500; g.recharge.gatherer = 0;
  assert.equal(g.canPlant('gatherer', 1, 0), 'taken');
  g.pause();
  assert.equal(g.canPlant('gatherer', 2, 0), 'state');
  g.pause();
  assert.equal(g.plant('gatherer', 2, 0), 'ok');
  assert.ok(g.shovel(2, 0), 'the shovel digs up a defender');
  assert.equal(g.at(2, 0), null);
  assert.equal(g.seeds, 450, 'no refund for digging up');
  assert.equal(g.shovel(2, 0), false, 'nothing left to dig');
  // Slow defenders start part-charged.
  const h = new Game(3, 1);
  assert.ok(h.recharge.boulder > 0 && h.recharge.boulder < DEFENDERS.boulder.recharge);
  assert.equal(h.recharge.flicker, 0);
}

// ---------- Unlocks ----------
{
  assert.deepEqual(unlockedBy(0), ['gatherer', 'flicker']);
  assert.deepEqual(unlockedBy(LEVELS.length - 1), ['gatherer', 'flicker', 'pebble', 'trap', 'boulder', 'frost', 'twins']);
  const unlocks = LEVELS.map((l) => l.unlock).filter(Boolean);
  assert.equal(new Set(unlocks).size, unlocks.length, 'each defender unlocks once');
  assert.equal(unlocks.length + LEVELS[0].starter.length, DEFENDER_IDS.length, 'every defender can be unlocked');
}

// ---------- Seeds ----------
{
  const g = new Game(0, 1);
  g.spawns = [{ kind: 'zombie', row: 1, at: 1e9 }];
  step(g, 6.2);
  assert.equal(g.drops.length, 1, 'a seed pouch falls from the sky');
  const s = g.drops[0];
  assert.ok(s.sky && s.value === SEED_VALUE);
  assert.ok(g.def.rows.includes(Math.floor(s.toY)), 'sky seeds land on a lane in play');
  assert.ok(g.collect(s.id));
  assert.equal(g.seeds, START_SEEDS + SEED_VALUE);
  assert.equal(g.collect(s.id), false, 'a pouch is collected once');
  // An uncollected pouch fades once it has landed.
  step(g, 20);
  const old = g.drops.find((d) => d.y >= d.toY);
  assert.ok(old, 'a pouch has landed');
  const id = old.id;
  step(g, SEED_LIFE + 1);
  assert.ok(!g.drops.some((d) => d.id === id), 'it fades after SEED_LIFE seconds');
  // A gatherer finds a pouch on its own tile, then one every `rate` seconds.
  const h = lawn(0);
  put(h, 'gatherer', 2, 3);
  h.drops = [];
  const own = () => h.drops.filter((d) => !d.sky).length;
  step(h, 12.1);
  assert.equal(own(), 1, 'the first gatherer pouch comes within 12 s');
  assert.ok(Math.floor(h.drops.find((d) => !d.sky).x) === 3);
  const before = h.seeds, n = h.drops.length;
  assert.equal(h.collectAll(), n);
  assert.equal(h.seeds, before + n * SEED_VALUE);
  step(h, DEFENDERS.gatherer.rate);
  assert.equal(own(), 1, 'and another one every 24 s');
}

// ---------- Shooting ----------
{
  const g = lawn();
  const z = drop(g, 'zombie', 1, 7.5);
  put(g, 'flicker', 2, 0);
  step(g, 5);
  assert.equal(g.pellets.length, 0, 'a Flicker does not shoot at zombies in other lanes');
  assert.equal(z.hp, 200);
  put(g, 'flicker', 1, 0);
  step(g, 1.6);
  assert.equal(z.hp, 200 - DEFENDERS.flicker.dmg, 'one pellet has landed');
  // Nothing behind it is a target.
  const h = lawn();
  put(h, 'flicker', 1, 5);
  const back = drop(h, 'zombie', 1, 4.9);
  back.hp = back.maxHp = 1e6;
  step(h, 3);
  assert.equal(h.pellets.length, 0, 'a Flicker never shoots backwards');
  // Twin Flickers fire two pellets a volley.
  const t = lawn();
  const z2 = drop(t, 'zombie', 3, 8);
  put(t, 'twins', 3, 0);
  step(t, 2.2);
  assert.equal(z2.hp, 200 - 2 * DEFENDERS.twins.dmg);
}

// ---------- Armour ----------
{
  const g = lawn();
  const cone = drop(g, 'cone', 1, 8);
  g.hurt(cone, 25);
  assert.equal(cone.armor, ZOMBIES.cone.armor - 25, 'pellets hit the cone first');
  assert.equal(cone.hp, 200);
  g.hurt(cone, ZOMBIES.cone.armor);
  assert.equal(cone.armor, 0);
  assert.equal(cone.hp, 175, 'damage past the armour carries on to the zombie');
}

// ---------- Frost ----------
{
  const g = lawn();
  const a = drop(g, 'zombie', 1, 8.5), b = drop(g, 'zombie', 3, 8.5);
  a.hp = b.hp = 1e6;
  put(g, 'frost', 1, 0);
  step(g, 2.2);
  assert.ok(a.slowT > 0, 'a frost puff chills');
  assert.equal(b.slowT, 0);
  const ax = a.x, bx = b.x;
  step(g, 4);
  const near = (x, y, msg) => assert.ok(Math.abs(x - y) <= 0.01 * Math.abs(y) + 1e-6, `${msg} (${x} vs ${y})`);
  near(ax - a.x, (bx - b.x) / 2, 'a chilled zombie walks at half speed');
  // Chilled biting is halved too.
  const h = lawn();
  const pebble = put(h, 'pebble', 2, 4), chilled = put(h, 'pebble', 3, 4);
  const z1 = drop(h, 'zombie', 2, 4.9), z2 = drop(h, 'zombie', 3, 4.9);
  z2.slowT = 100;
  step(h, 5);
  near((chilled.maxHp - chilled.hp) * 2, pebble.maxHp - pebble.hp, 'a chilled zombie bites at half speed');
  assert.equal(z1.eating, pebble.id);
}

// ---------- Dust Trap ----------
{
  const g = lawn();
  const trap = put(g, 'trap', 1, 4);
  assert.equal(trap.armed, DEFENDERS.trap.arm);
  drop(g, 'zombie', 1, 4.9);
  step(g, 3);
  assert.ok(trap.hp < trap.maxHp, 'an unready trap is just a snack');
  // A ready trap goes off under the first zombie to reach it.
  const h = lawn();
  const t2 = put(h, 'trap', 2, 4);
  step(h, DEFENDERS.trap.arm + 0.1);
  assert.equal(t2.armed, 0);
  const a = drop(h, 'bucket', 2, 5.6), far = drop(h, 'zombie', 2, 7.5), other = drop(h, 'zombie', 3, 4.7);
  step(h, 3);
  assert.equal(h.at(2, 4), null, 'the trap is used up');
  assert.ok(!h.zombies.includes(a), 'it takes out even a Buckethead');
  assert.ok(h.zombies.includes(far) && h.zombies.includes(other), 'only its own tile is hit');
  assert.ok(h.events.some((e) => e.type === 'boom' && e.kind === 'trap'));
}

// ---------- Enzo's Boulder ----------
{
  const g = lawn();
  const inside = [drop(g, 'bucket', 1, 3.5), drop(g, 'zombie', 2, 5.4), drop(g, 'cone', 3, 3.8)];
  const outside = [drop(g, 'zombie', 0, 4.5), drop(g, 'zombie', 4, 4.5), drop(g, 'zombie', 2, 6.8), drop(g, 'zombie', 2, 2.2)];
  const brute = drop(g, 'brute', 2, 4.5);
  put(g, 'boulder', 2, 4);
  g.update(1.01);
  for (const z of inside) assert.ok(!g.zombies.includes(z), `the boulder flattens the ${z.kind} in the 3 × 3`);
  for (const z of outside) assert.ok(g.zombies.includes(z), 'but nothing outside it');
  assert.equal(brute.hp, ZOMBIES.brute.hp - DEFENDERS.boulder.dmg, 'a Brute takes two boulders');
  assert.equal(g.at(2, 4), null, 'the boulder is used up');
}

// ---------- Pogo ----------
{
  const g = lawn();
  const wall = put(g, 'pebble', 1, 6);
  const kit = put(g, 'gatherer', 1, 2);
  const p = drop(g, 'pogo', 1, 7.5);
  p.hp = 1e6;
  let ate = false;
  step(g, 8);
  assert.ok(p.jumped && p.x < 6, 'the pogo zombie bounces over the first defender');
  assert.equal(wall.hp, wall.maxHp, 'without biting it');
  step(g, 30, () => { ate ||= p.eating === kit.id; });
  assert.ok(ate, 'then walks and eats the next one');
  // A pellet can't hit a zombie in mid-air.
  const h = lawn();
  const q = drop(h, 'pogo', 3, 5);
  q.jump = 5;
  h.pellets.push({ id: 999, row: 3, x: 4.6, dmg: 25, slow: false });
  h.update(0.05);
  assert.equal(q.hp, ZOMBIES.pogo.hp);
}

// ---------- Brute ----------
{
  const g = lawn();
  const wall = put(g, 'pebble', 2, 5);
  const b = drop(g, 'brute', 2, 6.15);
  step(g, 0.5);
  assert.equal(g.at(2, 5), null, 'a Brute flattens even Grandpa Pebble in one smash');
  assert.ok(wall.hp <= 0 && b.hp === ZOMBIES.brute.hp);
}

// ---------- Hay carts and losing ----------
{
  const g = lawn(0);
  const a = drop(g, 'zombie', 2, 0.1), b = drop(g, 'zombie', 2, 3), c = drop(g, 'zombie', 1, 3);
  step(g, 1);
  assert.equal(g.carts[2], 'rolling', 'the first zombie through sets off the hay cart');
  assert.equal(g.state, 'playing');
  step(g, 4);
  assert.ok(!g.zombies.includes(a) && !g.zombies.includes(b), 'the cart clears its lane');
  assert.ok(g.zombies.includes(c), 'and only its lane');
  assert.equal(g.carts[2], 'used');
  assert.deepEqual([g.carts[0], g.carts[4]], ['used', 'used'], 'lanes not in play have no cart');
  drop(g, 'zombie', 2, 0.1);
  step(g, 1);
  assert.equal(g.state, 'lost', 'a zombie past an empty lane gets into the burrow');
  assert.ok(g.events.some((e) => e.type === 'lost'));
  const t = g.time;
  g.update(1);
  assert.equal(g.time, t, 'nothing moves once lost');
  assert.equal(g.canPlant('flicker', 1, 3), 'state');
}

// ---------- Waves ----------
for (let n = 0; n < LEVELS.length; n++) {
  const L = LEVELS[n], plan = planLevel(n, 3);
  assert.ok(plan.every((s) => L.rows.includes(s.row)), `level ${n + 1}: zombies only walk lanes in play`);
  assert.ok(plan.every((s) => s.kind === 'flag' || L.pool.includes(s.kind)), `level ${n + 1}: only zombies from its pool`);
  const wave = (s) => Math.floor((s.at - FIRST_WAVE) / WAVE_GAP);
  assert.equal(Math.max(...plan.map(wave)), L.waves - 1);
  assert.deepEqual([...new Set(plan.filter((s) => s.kind === 'flag').map(wave))], L.flags, `level ${n + 1}: a flag leads each huge wave`);
  assert.ok(plan.filter((s) => wave(s) < 2).every((s) => s.kind === 'zombie'), 'the first two waves are plain zombies');
  assert.ok(plan.some((s) => wave(s) === L.waves - 1 && s.kind === L.pool.at(-1)), 'the final wave brings the toughest zombie');
  for (const f of L.flags) {
    const size = (w) => plan.filter((s) => wave(s) === w).length;
    assert.ok(size(f) > size(f - 1), `level ${n + 1}: flag wave ${f + 1} is bigger than the one before`);
  }
  for (let i = 1; i < plan.length; i++) assert.ok(plan[i].at >= plan[i - 1].at, 'the plan is in arrival order');
}
assert.ok(planLevel(7, 1).some((s) => s.kind === 'brute') && !planLevel(5, 1).some((s) => s.kind === 'brute'));

// ---------- Winning ----------
{
  const g = play(0, 1);
  assert.equal(g.state, 'won');
  assert.equal(g.kills, g.total, 'every zombie is caught');
  assert.equal(g.progress, 1);
  assert.equal(g.wave, LEVELS[0].waves);
  assert.ok(g.events.some((e) => e.type === 'won'));
  assert.ok(g.events.filter((e) => e.type === 'flag').length === LEVELS[0].flags.length, 'the huge wave is announced');
}

// ---------- Pause ----------
{
  const g = lawn();
  const z = drop(g, 'zombie', 1, 6);
  g.pause();
  assert.equal(g.state, 'paused');
  const t = g.time, x = z.x;
  step(g, 1); g.update(1);
  assert.equal(g.time, t);
  assert.equal(z.x, x);
  g.pause();
  assert.equal(g.state, 'playing');
  g.update(1);
  assert.ok(z.x < x);
}

// ---------- Determinism ----------
{
  const run = (seed) => { const g = new Game(4, seed); for (let i = 0; i < 60 * 150; i++) { if (i % 15 === 0) tend(g); g.update(1 / 60); } return JSON.stringify([g.seeds, g.kills, g.zombies.map((z) => [z.kind, z.row, z.x.toFixed(4), z.hp]), g.defenders.map((d) => [d.kind, d.row, d.col, d.hp.toFixed(2)])]); };
  assert.equal(run(5), run(5), 'a seed replays exactly');
  assert.notEqual(run(5), run(6));
  assert.notDeepEqual(planLevel(4, 5), planLevel(4, 6));
  assert.equal(ROWS, 5);
}

console.log('Passed: planting, seeds, shooting, armour, frost, traps, boulders, pogos, brutes, hay carts, waves, winning, pause and replay.');
