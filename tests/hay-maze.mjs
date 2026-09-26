import assert from 'node:assert/strict';
import {
  MazeGame, MAPS, TOWERS, TOWER_IDS, ENEMIES, WAVES, COLS, ROWS, INF, TOTAL_WAVES, START_HAY, START_RAISINS, BREAK, WAVE_BONUS, hpScale,
} from '../.checks/hay-maze-game.js';
import { play } from './hay-maze-bot.mjs';

const rich = (round = 0) => { const g = new MazeGame(round); g.hay = 100000; return g; };
const run = (g, seconds, each) => { for (let i = 0; i < seconds * 60 && g.state === 'playing'; i++) { g.update(1 / 60); each?.(g); } };
/** Drops one predator at the first entrance (or `at`) and returns it. */
const drop = (g, kind, at) => {
  g.queue.push({ kind, at: 0, entrance: 0 }); g.update(1 / 600);
  const e = g.enemies.at(-1);
  if (at) { e.x = at[0]; e.y = at[1]; }
  return e;
};
/** Seconds for one predator to cross the map and reach the burrow. */
const crossing = (g, kind, tweak) => {
  const e = drop(g, kind); tweak?.(e);
  const start = g.time, raisins = g.raisins;
  for (let i = 0; i < 400 * 60 && g.raisins === raisins && g.state === 'playing'; i++) g.update(1 / 60);
  assert.ok(g.raisins < raisins, `the ${kind} reached the burrow`);
  return g.time - start;
};
/** A serpentine maze of bales on Clover Meadow: walls every third column, open at alternate ends. */
const serpentine = (g) => {
  let flip = false;
  for (let c = 2; c < COLS - 2; c += 3) {
    for (let r = 0; r < ROWS; r++) if (r !== (flip ? 0 : ROWS - 1)) g.build('hay', c, r);
    flip = !flip;
  }
};

// Maps.
assert.equal(MAPS.length, 3);
for (const m of MAPS) {
  assert.equal(m.rows.length, ROWS); assert.ok(m.rows.every((row) => row.length === COLS), `${m.id} is ${COLS} × ${ROWS}`);
  const g = new MazeGame(MAPS.indexOf(m));
  assert.ok(g.entrances.length >= 1 && g.exits.length >= 1);
  assert.ok(g.entrances.every(([c, r]) => c === 0 || r === 0), 'entrances are on the left or top edge');
  assert.ok(g.exits.every(([c]) => c === COLS - 1), 'the burrow is on the right edge');
  assert.ok(g.walk > 0 && g.walk < INF);
  for (let e = 0; e < g.entrances.length; e++) {
    const path = g.route(e);
    assert.ok(g.isExit(...path.at(-1)), `${m.id} route ${e} reaches the burrow`);
    assert.equal(path.length - 1, g.dist[g.entrances[e][1] * COLS + g.entrances[e][0]]);
    assert.ok(path.every(([c, r]) => !g.rock(c, r)), 'routes go round rocks');
  }
}
assert.equal(new MazeGame(2).entrances.filter(([, r]) => r === 0).length, 2, 'the summit has a way down the mountain');
assert.deepEqual(Object.keys(TOWERS), TOWER_IDS);
console.log('Passed maps and routes.');

// Building: hay, taken tiles, and never sealing the way.
const b = new MazeGame(0);
assert.equal(b.hay, START_HAY); assert.equal(b.raisins, START_RAISINS);
assert.equal(b.build('flicker', 5, 3), 'ok'); assert.equal(b.hay, START_HAY - TOWERS.flicker.cost);
assert.equal(b.build('hay', 5, 3), 'taken', 'a tower is there');
assert.equal(b.build('hay', 8, 2), 'taken', 'a rock');
assert.equal(b.build('hay', 0, 5), 'taken', 'an entrance');
assert.equal(b.build('hay', COLS - 1, 5), 'taken', 'the burrow door');
assert.equal(b.build('hay', -1, 3), 'bounds');
b.hay = 3; assert.equal(b.build('hay', 6, 6), 'hay');
const seal = rich();
for (let r = 0; r < ROWS - 1; r++) assert.equal(seal.build('hay', 10, r), 'ok');
assert.equal(seal.build('hay', 10, ROWS - 1), 'blocked', 'the last gap stays open');
assert.equal(seal.towers.length, ROWS - 1);
const occupied = rich(); drop(occupied, 'fox', [6.5, 6.5]);
assert.equal(occupied.build('hay', 6, 6), 'occupied');
occupied.update(1 / 60);
drop(occupied, 'hawk', [9.5, 3.5]);
assert.equal(occupied.build('hay', 9, 3), 'ok', 'flyers don’t stop building');
// A predator shut in a pocket would be stranded, so that's refused too.
const pocket = rich(); const trapped = drop(pocket, 'fox', [5.5, 0.5]); trapped.progress = 0;
assert.equal(pocket.build('hay', 4, 0), 'ok'); assert.equal(pocket.build('hay', 6, 0), 'ok');
assert.equal(pocket.build('hay', 5, 1), 'blocked', 'no stranding a predator');
console.log('Passed building rules.');

// Towers hinder movement: they block and reroute, dust slows and the bell stops predators dead.
const open = new MazeGame(0), openWalk = open.walk;
const walled = rich(); serpentine(walled);
assert.ok(walled.walk > openWalk * 3, `a bale maze stretches the walk from ${openWalk} to ${walled.walk} tiles`);
const tOpen = crossing(new MazeGame(0), 'fox'), tMaze = crossing((() => { const g = rich(); serpentine(g); return g; })(), 'fox');
assert.ok(tMaze > tOpen * 3, `a fox takes ${tMaze.toFixed(1)}s through the maze against ${tOpen.toFixed(1)}s in the open`);
const hOpen = crossing(new MazeGame(0), 'hawk'), hMaze = crossing((() => { const g = rich(); serpentine(g); return g; })(), 'hawk');
assert.ok(Math.abs(hOpen - hMaze) < 0.05, 'hawks fly straight over the maze');
// Building in front of a predator makes it turn.
const turn = rich(); const walker = drop(turn, 'fox', [8.5, 5.5]);
turn.update(1 / 60);
const ahead = turn.step(8, 5, walker.dir);
assert.equal(turn.build('hay', 8 + ahead[0], 5 + ahead[1]), 'ok');
const beforeDist = turn.dist[5 * COLS + 8];
turn.update(1 / 60);
assert.notDeepEqual(walker.dir, ahead, 'it steps round the new bale');
assert.ok(turn.dist[5 * COLS + 8] >= beforeDist);
// Never inside a tower.
const solid = rich(); serpentine(solid); drop(solid, 'weasel');
run(solid, 40, (g) => { for (const e of g.enemies) assert.ok(!g.towerAt(Math.floor(e.x), Math.floor(e.y)), 'predators never walk through towers'); });
// Dust slows, snakes shrug half of it off, and the bell stops them where they stand.
const tank = (e) => { e.hp = e.maxHp = 1e9; };
const dusty = (kind) => { const g = rich(); for (let c = 3; c < 17; c += 2) g.build('puffer', c, 4); return crossing(g, kind, tank); };
const plain = (kind) => crossing(new MazeGame(0), kind, tank);
const foxSlow = dusty('fox') / plain('fox'), snakeSlow = dusty('snake') / plain('snake');
assert.ok(foxSlow > 1.3, `dust slows a fox (${foxSlow.toFixed(2)}× longer)`);
assert.ok(snakeSlow > 1.05 && snakeSlow < foxSlow, `a snake shrugs off some of the dust (${snakeSlow.toFixed(2)}×)`);
const nap = rich(); nap.build('bell', 6, 4); const sleeper = drop(nap, 'fox', [5.5, 5.5]); tank(sleeper);
run(nap, 0.05);
assert.ok(sleeper.stun > 0.5, 'the bell puts it to sleep');
const x0 = sleeper.x, y0 = sleeper.y; run(nap, 0.4);
assert.deepEqual([sleeper.x, sleeper.y], [x0, y0], 'asleep, it doesn’t move');
const boss = rich(); boss.build('bell', 6, 4); const lynx = drop(boss, 'lynx', [5.5, 5.5]); run(boss, 0.05);
assert.ok(Math.abs(lynx.stun - TOWERS.bell.levels[0].stun * 0.5) < 0.05, 'the lynx naps half as long');
console.log(`Passed hindrance: the maze makes a fox walk ${(tMaze / tOpen).toFixed(1)}× longer, dust ${foxSlow.toFixed(2)}×, and the bell stops them.`);

// Damage: armour, splash, and who can hit flyers.
const armour = rich(); const badger = drop(armour, 'badger'); const hp = badger.hp;
armour.hurt(badger, 10); assert.equal(hp - badger.hp, 10 - ENEMIES.badger.armor);
armour.hurt(badger, 2); assert.equal(hp - badger.hp, 10 - ENEMIES.badger.armor + 1, 'always at least 1');
const splash = rich(); splash.build('roller', 6, 3);
const pack = [0, 1, 2].map((i) => { const e = drop(splash, 'fox', [6.5 + i * 0.3, 5.5]); tank(e); e.hp = 1e6; return e; });
for (const e of pack) { e.stun = 5; }
run(splash, 2.5);
assert.ok(pack.every((e) => e.hp < 1e6), 'a boulder hits the whole pack');
const air = rich(); air.build('glider', 6, 3); air.build('roller', 6, 7);
const bird = drop(air, 'hawk', [6.5, 5.5]), dog = drop(air, 'fox', [6.2, 5.5]);
tank(bird); tank(dog); bird.stun = dog.stun = 5; run(air, 2);
assert.ok(bird.hp < 1e9 && dog.hp < 1e9, 'gliders hit the hawk and Enzo the fox');
const lower = rich(); lower.build('glider', 6, 3); const ground = drop(lower, 'fox', [6.5, 5.5]); tank(ground); ground.stun = 5; run(lower, 2);
assert.equal(ground.hp, 1e9, 'gliders ignore the ground');
const high = rich(); high.build('roller', 6, 3); const flyer = drop(high, 'hawk', [6.5, 5.5]); tank(flyer); flyer.stun = 5; run(high, 3);
assert.equal(flyer.hp, 1e9, 'boulders can’t reach flyers');
const both = rich(); both.build('flicker', 6, 3); const f2 = drop(both, 'hawk', [6.5, 4.8]); tank(f2); f2.stun = 5; run(both, 1);
assert.ok(f2.hp < 1e9, 'flickers hit flyers too');
console.log('Passed armour, splash and air.');

// Upgrading and selling.
const up = new MazeGame(0); up.hay = 200;
up.build('flicker', 6, 3); const t = up.towers[0];
assert.equal(up.upgradeCost(t), TOWERS.flicker.upgrades[0]);
assert.ok(up.upgrade(t)); assert.ok(up.upgrade(t)); assert.equal(t.level, 2);
assert.equal(up.upgradeCost(t), null); assert.ok(!up.upgrade(t), 'three levels at most');
assert.equal(t.spent, TOWERS.flicker.cost + TOWERS.flicker.upgrades[0] + TOWERS.flicker.upgrades[1]);
const hayBefore = up.hay; assert.ok(up.sell(t));
assert.equal(up.hay - hayBefore, Math.floor(t.spent * 0.7)); assert.equal(up.towers.length, 0);
const back = rich(); serpentine(back); const long = back.walk;
for (const x of back.towers) back.sell(x); // sell() replaces the list, so this walks the old one
assert.equal(back.walk, openWalk, 'selling opens the way again'); assert.ok(long > openWalk);
const poor = new MazeGame(0); poor.build('bell', 6, 3); poor.hay = 0; assert.ok(!poor.upgrade(poor.towers[0]), 'upgrades cost hay');
console.log('Passed upgrading and selling.');

// Waves: the first waits for you, the rest follow a countdown, and sending early pays.
const w = new MazeGame(0);
run(w, 30); assert.equal(w.wave, 0); assert.equal(w.enemies.length, 0, 'the first wave waits');
assert.ok(w.sendWave()); assert.equal(w.wave, 1); assert.ok(!w.sendWave(), 'not while a wave is still arriving');
const size = WAVES[0].reduce((s, [, n]) => s + n, 0);
let seen = 0; run(w, 20, (g) => { seen = Math.max(seen, g.enemies.length + g.kills + g.leaked); });
assert.equal(seen, size, `wave 1 is ${size} predators`);
assert.ok(w.countdown !== null && w.countdown < BREAK);
const early = new MazeGame(0); early.sendWave(); run(early, 12);
assert.equal(early.queue.length, 0); run(early, 3);
const cd = early.countdown, hay0 = early.hay; assert.ok(early.sendWave());
assert.equal(early.hay - hay0, Math.floor(cd) + WAVE_BONUS + 1, 'a hay per second saved, plus the wave bonus');
assert.equal(early.wave, 2);
const auto = new MazeGame(0); auto.sendWave(); run(auto, 12 + BREAK + 1);
assert.equal(auto.wave, 2, 'the countdown sends the next wave by itself');
const fresh = new MazeGame(0); fresh.wave = 9; const tough = drop(fresh, 'fox');
assert.equal(tough.maxHp, Math.round(ENEMIES.fox.hp * hpScale(9)), 'predators toughen each wave');
const summit = new MazeGame(2); summit.wave = 1; assert.ok(drop(summit, 'fox').maxHp > ENEMIES.fox.hp, 'the summit’s predators are tougher');
assert.equal(WAVES.length, TOTAL_WAVES);
assert.ok(WAVES.flat().some(([k]) => k === 'lynx') && WAVES[4].every(([k]) => k === 'hawk'), 'a hawk wave and a lynx boss');
console.log('Passed waves.');

// Raisins, losing and winning.
const thief = new MazeGame(0); crossing(thief, 'lynx', tank);
assert.equal(thief.raisins, START_RAISINS - ENEMIES.lynx.steal, 'a lynx steals five');
const lose = new MazeGame(0); lose.raisins = 1; crossing(lose, 'fox');
assert.equal(lose.state, 'lost'); assert.equal(lose.raisins, 0);
assert.equal(lose.build('hay', 6, 3), 'state', 'no building once it’s over');
const win = new MazeGame(0); win.wave = TOTAL_WAVES; win.update(1 / 60);
assert.equal(win.state, 'won');
const paused = new MazeGame(0); paused.sendWave(); paused.pause(); const tp = paused.time; run(paused, 2);
assert.equal(paused.time, tp); assert.equal(paused.state, 'paused'); paused.pause(); assert.equal(paused.state, 'playing');
console.log('Passed raisins, losing, winning and pausing.');

// A whole game replays exactly.
const a = play(1), c2 = play(1);
assert.deepEqual([a.state, a.raisins, a.kills, a.hay, a.walk, a.time], [c2.state, c2.raisins, c2.kills, c2.hay, c2.walk, c2.time]);
console.log(`Passed a deterministic replay (${a.state} with ${a.raisins} raisins on ${a.map.name}).`);
