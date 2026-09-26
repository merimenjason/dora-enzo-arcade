import assert from 'node:assert/strict';
import {
  Run, Battle, TOWERS, ENEMIES, RELICS, PIECES, COLS, ROWS, INF, LEVELS, WAVES_PER_LEVEL, START_FLAME, LEVEL_HAY, LEVEL_HAY_STEP,
  START_DECK, START_TOWERS, FIRST_DRAW, DRAW_PER_WAVE, HAND_MAX, SHATTER, FLARE,
  shape, cellsAt, planWaves, makeLayout, rng, hpScale, toughness, bossLevel,
} from '../.checks/hay-maze-game.js';
import { play } from './hay-maze-bot.mjs';

const run = (b, seconds, each) => { for (let i = 0; i < seconds * 60 && b.phase === 'wave'; i++) { b.update(1 / 60); each?.(b); } };
/** A battle on a fresh run with plenty of hay and every tower. */
const rich = (seed = 1) => { const r = new Run(seed); r.unlocked = Object.keys(TOWERS); r.battle.hay = 100000; return r.battle; };
/** Lays bales straight onto tiles, skipping the cards (for setting up tests). */
const bales = (b, tiles) => { for (const [c, r] of tiles) b.blocks[r * COLS + c] = 99; b.dist = b.field(null); };
/** Puts one predator on the meadow at (x, y) and starts a wave with nothing else in it. */
const drop = (b, kind, at) => {
  if (b.phase === 'build') { b.plan[b.wave] = []; b.sendWave(); }
  b.queue.push({ kind, at: 0, entrance: 0 }); b.update(1 / 600);
  const e = b.enemies.at(-1);
  if (at) { e.x = at[0]; e.y = at[1]; }
  return e;
};
const tank = (e) => { e.hp = e.maxHp = 1e9; };
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-3, `${msg} (${a} vs ${b})`);
/** Seconds for one predator to reach the Hearthlight. */
const crossing = (b, kind, tweak) => {
  const e = drop(b, kind); tweak?.(e);
  const start = b.time, flame = b.run.flame;
  for (let i = 0; i < 400 * 60 && b.run.flame === flame; i++) b.update(1 / 60);
  assert.ok(b.run.flame < flame, `the ${kind} reached the Hearthlight`);
  return b.time - start;
};
/** Clear the meadow of rocks, for measured tests. */
const flat = (b) => { b.layout.rocks.fill(false); b.dist = b.field(null); return b; };
/** A snaking wall of bales: every third column, open at alternate ends. */
const snake = (b) => {
  const tiles = []; let flip = false;
  for (let c = 2; c < COLS - 2; c += 3) { for (let r = 0; r < ROWS; r++) if (r !== (flip ? 0 : ROWS - 1) && !b.isEntrance(c, r)) tiles.push([c, r]); flip = !flip; }
  bales(b, tiles);
};

// Pieces and turning.
assert.equal(Object.keys(PIECES).length, 11);
assert.deepEqual(shape('I', 1), [[0, 0], [0, 1], [0, 2], [0, 3]], 'a quarter turn stands the long wall up');
for (const id of Object.keys(PIECES)) {
  assert.deepEqual(shape(id, 4), shape(id, 0), `${id} comes back after four turns`);
  assert.equal(shape(id, 1).length, PIECES[id].cells.length);
}
assert.deepEqual(cellsAt('mono', 0, 5, 5), [[5, 5]]);
assert.ok(cellsAt('O', 0, 5, 5).some(([c, r]) => c === 5 && r === 5), 'pieces sit on the tile you point at');
console.log('Passed pieces and turning.');

// Maps and waves are made from the seed.
for (let level = 0; level < LEVELS; level++) {
  const a = makeLayout(rng(9), level), b2 = makeLayout(rng(9), level);
  assert.deepEqual(a, b2, 'the same seed makes the same meadow');
  assert.equal(a.exits.length, 2); assert.ok(a.exits.every(([c]) => c === COLS - 1));
  assert.ok(a.entrances.length === 2 || a.entrances.length === 4);
  if (level >= 4) assert.equal(a.entrances.length, 4, 'the summit always has a way down the mountain');
  assert.ok(a.rocks.filter(Boolean).length >= 5, 'rocks to build on');
  const waves = planWaves(rng(9), level);
  assert.equal(waves.length, WAVES_PER_LEVEL);
  assert.ok(waves[0].every(([k]) => k !== 'hawk' && k !== 'badger'), 'each level opens with light predators');
  assert.equal(waves.at(-1).some(([k]) => k === 'lynx'), bossLevel(level), 'every second level ends with a lynx');
}
assert.ok(toughness(1, 0) < toughness(0, 4), 'a new level starts gentler than the last one ended');
assert.ok(hpScale(toughness(5, 4)) > 5, 'but the end of the run is much tougher');
console.log('Passed maps and waves.');

// A run begins.
const r0 = new Run(3), b0 = r0.battle;
assert.equal(r0.flame, START_FLAME); assert.deepEqual(r0.unlocked, START_TOWERS); assert.deepEqual([...r0.deck].sort(), [...START_DECK].sort());
assert.equal(b0.hay, LEVEL_HAY); assert.equal(b0.phase, 'build'); assert.equal(b0.hand.length, FIRST_DRAW); assert.equal(b0.drawPile.length, START_DECK.length - FIRST_DRAW);
assert.ok(b0.walk > 0 && b0.walk < INF);
assert.deepEqual(new Run(3).battle.hand, b0.hand, 'the same seed deals the same hand');
console.log('Passed starting a run.');

// Laying bales.
const lay = flat(rich());
lay.hand = ['I', 'I', 'mono', 'O'];
const walk0 = lay.walk;
const [rc, rr] = [8, lay.exits[0][1]];
assert.equal(lay.play(0, rc, rr, 1), 'ok', 'a long wall stood up across the way');
assert.equal(lay.hand.length, 3); assert.equal(lay.discard.at(-1), 'I');
assert.ok(lay.walk >= walk0, 'bales bend the route');
assert.ok(lay.route(0).every(([c, r]) => !lay.block(c, r)), 'the route goes round bales');
assert.equal(lay.play(0, rc, rr, 1), 'taken', 'not on top of another bale');
assert.equal(lay.play(1, 0, lay.entrances[0][1], 0), 'taken', 'not on a way in');
assert.equal(lay.play(0, COLS - 1, 0, 0), 'bounds', 'not off the edge');
const seal = flat(rich()); seal.hand = ['mono'];
bales(seal, [...Array(ROWS).keys()].filter((r) => r !== 5).map((r) => [10, r]));
assert.equal(seal.play(0, 10, 5, 0), 'blocked', 'the last gap stays open');
const waiting = flat(rich()); waiting.hand = ['O', 'O']; drop(waiting, 'fox', [3.5, 3.5]);
assert.equal(waiting.play(0, 12, 3, 0), 'phase', 'bales wait until the wave is over');
console.log('Passed laying bales.');

// Towers stand on bales and rocks.
const tw = new Run(1).battle; tw.hay = 1000; tw.hand = ['O'];
const open = [...Array(ROWS * COLS).keys()].map((i) => [i % COLS, (i / COLS) | 0]).find(([c, r]) => !tw.rock(c, r) && !tw.isEntrance(c, r) && !tw.isExit(c, r) && c > 3 && c < 15 && r > 2 && r < 9);
assert.equal(tw.build('flicker', ...open), 'foundation', 'not on bare grass');
assert.equal(tw.play(0, ...open, 0), 'ok');
assert.equal(tw.build('spark', ...open), 'locked', 'the Spark Wheel is a reward');
assert.equal(tw.build('flicker', ...open), 'ok'); assert.equal(tw.hay, 1000 - TOWERS.flicker.cost);
assert.equal(tw.build('frost', ...open), 'taken');
const rock = [...Array(ROWS * COLS).keys()].map((i) => [i % COLS, (i / COLS) | 0]).find(([c, r]) => tw.rock(c, r));
assert.equal(tw.build('roller', ...rock), 'ok', 'rocks make good foundations');
tw.hay = 5; const bare = cellsAt('O', 0, ...open).find(([c, r]) => !tw.towerAt(c, r)); assert.equal(tw.build('frost', ...bare), 'hay');
const walkBefore = tw.walk; tw.hay = 1000; tw.sell(tw.towers[0]); assert.equal(tw.walk, walkBefore, 'selling a tower leaves its bale');
const up = tw.towers[0]; assert.ok(tw.upgrade(up)); assert.ok(tw.upgrade(up)); assert.ok(!tw.upgrade(up)); assert.equal(up.level, 2);
assert.equal(tw.refund(up), Math.floor((TOWERS.roller.cost + TOWERS.roller.upgrades[0] + TOWERS.roller.upgrades[1]) * 0.7));
console.log('Passed building, upgrading and selling towers.');

// The maze hinders them, flyers ignore it, and they never walk through bales.
const tOpen = crossing(flat(rich()), 'fox'), maze = flat(rich()); snake(maze);
const tMaze = crossing(maze, 'fox');
assert.ok(tMaze > tOpen * 2.5, `a fox takes ${tMaze.toFixed(1)}s through the maze against ${tOpen.toFixed(1)}s in the open`);
const hOpen = crossing(flat(rich()), 'hawk'), hmaze = flat(rich()); snake(hmaze);
assert.ok(Math.abs(crossing(hmaze, 'hawk') - hOpen) < 0.05, 'hawks fly straight over');
const solid = flat(rich()); snake(solid); drop(solid, 'weasel');
run(solid, 30, (b) => { for (const e of b.enemies) if (b.inGrid(Math.floor(e.x), Math.floor(e.y))) assert.ok(!b.block(Math.floor(e.x), Math.floor(e.y)), 'never through a bale'); });
console.log(`Passed hindrance: the maze makes a fox walk ${(tMaze / tOpen).toFixed(1)}× longer.`);

// Elements.
const stage = (towers, kind, at = [6.5, 5.5]) => {
  const b = flat(rich()); bales(b, towers.map(([, c, r]) => [c, r]));
  for (const [k, c, r] of towers) assert.equal(b.build(k, c, r), 'ok');
  const e = drop(b, kind, at); tank(e); e.stun = 0;
  return { b, e };
};
{ // Ice chills.
  const { b, e } = stage([['frost', 6, 4]], 'fox'); run(b, 0.2);
  assert.ok(e.slow >= TOWERS.frost.levels[0].slow - 1e-9 && e.slowT > 0, 'the Frost Fan chills');
}
{ // Sparks chain and shatter chilled foes.
  const { b, e } = stage([['spark', 6, 4]], 'fox'); const e2 = drop(b, 'fox', [7, 5.5]); tank(e2); tank(e); e.stun = e2.stun = 9;
  e.progress = 5; b.towers[0].cool = 0;
  run(b, 0.05);
  const lv = TOWERS.spark.levels[0];
  near(1e9 - e.hp, lv.dmg, 'the first zap'); near(1e9 - e2.hp, lv.dmg * 0.8, 'then a weaker jump to the next foe');
  const { b: b2, e: cold } = stage([['spark', 6, 4]], 'fox'); tank(cold); cold.stun = 9; cold.slow = 0.4; cold.slowT = 5; b2.towers[0].cool = 0; run(b2, 0.05);
  near(1e9 - cold.hp, lv.dmg * SHATTER, 'chilled foes shatter for double');
}
{ // Fire burns through armour.
  const { b, e } = stage([['brazier', 6, 4]], 'badger'); e.stun = 99; run(b, 0.05);
  assert.ok(e.burnT > 0 && e.burn === TOWERS.brazier.levels[0].burn, 'the brazier sets it burning');
  const hp = e.hp; b.towers.length = 0; run(b, 1);
  assert.ok(Math.abs(hp - e.hp - TOWERS.brazier.levels[0].burn) < 0.5, 'a second of burning, armour or not');
}
{ // Moonlight ignores armour, and burning foes flare.
  const { b, e } = stage([['lantern', 6, 3]], 'badger'); e.stun = 99; run(b, 1.2);
  assert.equal((1e9 - e.hp) % TOWERS.lantern.levels[0].dmg, 0, 'full damage through armour');
  const { b: b2, e: hot } = stage([['lantern', 6, 3]], 'fox'); const next = drop(b2, 'fox', [7, 5.5]); tank(next);
  hot.stun = next.stun = 99; hot.burn = 0.0001; hot.burnT = 99; b2.enemies.reverse(); hot.progress = 10;
  run(b2, 1.2);
  assert.ok(1e9 - next.hp >= TOWERS.lantern.levels[0].dmg * FLARE - 1e-6, 'a burning foe flares onto its neighbour');
}
{ // The bell stops them dead; boulders splash; gliders only hit flyers.
  const { b, e } = stage([['bell', 6, 4]], 'fox'); run(b, 0.05);
  assert.ok(e.stun > 0.5); const x0 = e.x; run(b, 0.3); assert.equal(e.x, x0, 'asleep where it stands');
  const { b: b2 } = stage([['roller', 6, 3]], 'fox'); const pack = [0, 1, 2].map((i) => { const f = drop(b2, 'fox', [6.5 + i * 0.3, 5.5]); tank(f); f.stun = 9; return f; });
  run(b2, 2.5); assert.ok(pack.every((f) => f.hp < 1e9), 'a boulder hits the pack');
  const { b: b3, e: ground } = stage([['glider', 6, 4]], 'fox'); ground.stun = 99; run(b3, 1); assert.equal(ground.hp, 1e9, 'gliders ignore the ground');
  const { b: b4, e: bird } = stage([['glider', 6, 4]], 'hawk'); bird.stun = 99; run(b4, 1); assert.ok(bird.hp < 1e9);
}
console.log('Passed elements: chill, chains and shatter, burning, moonlight and flares, naps, splash and flyers.');

// Relics.
{
  const r = new Run(4); r.relics.push('lens', 'static', 'wax', 'moth', 'watch', 'mittens', 'bellows', 'tinder');
  const b = r.battle;
  assert.equal(b.stats('flicker').range, TOWERS.flicker.levels[0].range + 0.5);
  assert.equal(b.stats('spark').chains, TOWERS.spark.levels[0].chains + 2);
  assert.ok(Math.abs(b.stats('flicker').rate - TOWERS.flicker.levels[0].rate * 0.7) < 1e-9);
  assert.equal(b.stats('lantern').dmg, TOWERS.lantern.levels[0].dmg * 1.5);
  assert.ok(Math.abs(b.stats('bell').stun - (TOWERS.bell.levels[0].stun + 0.4)) < 1e-9);
  assert.ok(Math.abs(b.stats('frost').slow - (TOWERS.frost.levels[0].slow + 0.1)) < 1e-9);
  assert.ok(b.stats('brazier').burn > TOWERS.brazier.levels[0].burn * 1.9);
  const loft = new Run(4); loft.relics.push('loft'); loft.state = 'reward'; loft.rewards = [{ kind: 'heal', amount: 1 }]; loft.choose(0);
  assert.equal(loft.battle.hay, LEVEL_HAY + LEVEL_HAY_STEP + 30, 'Hay Loft');
  assert.equal(Object.keys(RELICS).length, 12);
}
console.log('Passed relics.');

// Cards: items, drawing after each wave, the hand limit and reshuffling.
{
  const b = new Run(5).battle; b.hand = ['bundle', 'cocoa', 'shovel']; b.run.flame = 10;
  const hay = b.hay; b.play(0); assert.equal(b.hay, hay + 25);
  b.play(0); assert.equal(b.run.flame, 13);
  bales(b, [[6, 6]]); assert.equal(b.play(0, 6, 6), 'ok'); assert.ok(!b.block(6, 6), 'the shovel digs up a bale');
  const b2 = new Run(5).battle; b2.hand = []; b2.plan[0] = [['weasel', 1, 1]]; b2.sendWave(); run(b2, 60);
  assert.equal(b2.phase, 'build'); assert.equal(b2.hand.length, DRAW_PER_WAVE, 'three new cards after the wave');
  b2.hand = Array(HAND_MAX).fill('mono'); b2.draw(3); assert.equal(b2.hand.length, HAND_MAX, 'the hand holds eight');
  const b3 = new Run(5).battle; b3.hand = []; b3.discard = [...b3.drawPile]; b3.drawPile = []; b3.draw(2);
  assert.equal(b3.hand.length, 2, 'the discards are shuffled back in');
}
console.log('Passed cards.');

// Waves, levels, rewards, losing and winning.
{
  const r = new Run(6), b = r.battle;
  b.update(1); assert.equal(b.phase, 'build', 'nothing happens until the wave starts'); assert.equal(b.time, 0);
  for (let w = 0; w < WAVES_PER_LEVEL; w++) { b.plan[w] = [['weasel', 1, 1]]; }
  const hay = b.hay; b.sendWave(); run(b, 60);
  assert.equal(b.hay - hay, 6 + b.kills * ENEMIES.weasel.bounty, 'a wave pays its bounties and a bonus');
  while (b.phase === 'build') { b.sendWave(); run(b, 60); }
  assert.equal(b.phase, 'cleared'); assert.equal(r.state, 'reward'); assert.equal(r.rewards.length, 3);
  assert.ok(r.rewards.some((x) => x.kind === 'tower') && r.rewards.some((x) => x.kind === 'relic'));
  const tower = r.rewards.findIndex((x) => x.kind === 'tower'), unlocked = r.rewards[tower].tower;
  assert.ok(r.choose(tower)); assert.ok(r.unlocked.includes(unlocked));
  assert.equal(r.level, 1); assert.equal(r.state, 'battle'); assert.equal(r.battle.level, 1); assert.equal(r.battle.hay, LEVEL_HAY + LEVEL_HAY_STEP);
  assert.equal(r.battle.hand.length, FIRST_DRAW, 'a fresh hand on a fresh meadow');
  const lose = new Run(7); lose.flame = 1; const lb = lose.battle; crossing(lb, 'fox');
  assert.equal(lb.phase, 'lost'); assert.equal(lose.state, 'lost'); assert.equal(lb.build('flicker', 1, 1), 'state');
  const last = new Run(8); last.level = LEVELS - 1; last.battle = new Battle(last, LEVELS - 1); last.battle.wave = WAVES_PER_LEVEL - 1; last.battle.plan[WAVES_PER_LEVEL - 1] = [['weasel', 1, 1]];
  last.battle.sendWave(); run(last.battle, 60);
  assert.equal(last.state, 'won', 'clearing the sixth level wins the run');
  const heal = new Run(9); heal.flame = 5; heal.state = 'reward'; heal.rewards = [{ kind: 'heal', amount: 8 }]; heal.choose(0); assert.equal(heal.flame, 13);
  const p = new Run(9).battle; p.sendWave(); p.pause(); const t = p.time; p.update(1); assert.equal(p.time, t, 'paused'); p.pause(); p.update(0.5); assert.ok(p.time > t);
}
console.log('Passed waves, levels, rewards, losing, winning and pausing.');

// A whole run replays exactly.
const a = play(2), c2 = play(2);
assert.deepEqual([a.state, a.level, a.flame, a.kills, a.relics, a.unlocked], [c2.state, c2.level, c2.flame, c2.kills, c2.relics, c2.unlocked]);
console.log(`Passed a deterministic replay (${a.state} on level ${a.level + 1} with the Hearthlight at ${a.flame}).`);
