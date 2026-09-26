import assert from 'node:assert/strict';
import {
  ClashGame, CARDS, CARD_IDS, DEFAULT_DECK, HEROES, RIVALS, STEADY, TOWER, TOWER_SPELL, REGEN, REGULATION, OVERTIME, DOUBLE_AT,
  RIVER_TOP, RIVER_BOTTOM, MAX_DUST, START_DUST, DEPLOY_TIME, validDeck, averageCost, inRiver, onBridge, local,
} from '../.checks/chinchilla-clash-game.js';

const quiet = (o = {}) => new ClashGame({ seed: 7, ai: [null, null], ...o });
const run = (g, seconds, each) => { for (let i = 0; i < seconds * 60 && g.state === 'playing'; i++) { g.step(1 / 60); each?.(g); } };
/** Puts `card` in hand slot 0 for `side` with plenty of dust. */
const give = (g, side, card) => { g.hands[side][0] = card; g.dust[side] = MAX_DUST; return 0; };
const troops = (g, side, card) => g.units.filter((u) => u.side === side && u.card === card);

// Cards, decks and rivals.
assert.equal(CARD_IDS.length, 12);
for (const id of CARD_IDS) {
  const c = CARDS[id];
  assert.ok(c.cost >= 2 && c.cost <= 5, `${id} costs 2 to 5`);
  assert.ok(c.kind === 'spell' ? c.spell : c.stats, `${id} has stats`);
}
assert.ok(validDeck(DEFAULT_DECK));
assert.equal(averageCost(DEFAULT_DECK), 3.625);
assert.ok(!validDeck(DEFAULT_DECK.slice(1)), 'seven cards');
assert.ok(!validDeck([...DEFAULT_DECK.slice(1), 'flickers']), 'a duplicate');
assert.ok(!validDeck([...DEFAULT_DECK.slice(1), 'wolf']), 'an unknown card');
assert.ok(!validDeck('kits'));
assert.equal(RIVALS.length, 3);
for (const r of RIVALS) { assert.ok(validDeck(r.deck), `${r.id} deck`); assert.ok(r.deck.every((id) => !HEROES.includes(id)), 'Dora and Enzo only fight for the player'); }
console.log('Passed cards, decks and rivals.');

// Set-up: three towers a side, a four-card hand from a shuffled deck, five dust.
const setup = quiet();
assert.equal(setup.towers(0).length, 3); assert.equal(setup.towers(1).length, 3);
assert.equal(setup.tower(0, 'left').hp, TOWER.princess.hp); assert.equal(setup.tower(1, 'king').hp, TOWER.king.hp);
assert.ok(setup.tower(1, 'left').y < RIVER_TOP && setup.tower(0, 'left').y > RIVER_BOTTOM, 'side 0 owns the bottom');
assert.ok(!setup.tower(0, 'king').active && !setup.tower(1, 'king').active, 'kings start asleep');
for (const side of [0, 1]) { assert.equal(setup.hands[side].length, 4); assert.deepEqual([...setup.hands[side], ...setup.queues[side]].sort((x, y) => x.localeCompare(y)), [...setup.decks[side]].sort((x, y) => x.localeCompare(y))); }
assert.deepEqual(setup.dust, [START_DUST, START_DUST]);
assert.deepEqual(quiet().hands, setup.hands, 'the same seed deals the same hand');
assert.equal(new ClashGame({ deck: ['kits'] }).decks[0].join(), DEFAULT_DECK.join(), 'a broken deck falls back to the starter');
console.log('Passed set-up.');

// Dust fills one every 2.8 seconds up to ten, twice as fast from the last minute.
const dust = quiet();
run(dust, REGEN);
assert.ok(Math.abs(dust.dust[0] - (START_DUST + 1)) < 0.02);
run(dust, 30);
assert.equal(dust.dust[0], MAX_DUST);
dust.time = DOUBLE_AT - 1e-6; dust.dust = [0, 0];
run(dust, REGEN / 2);
assert.ok(Math.abs(dust.dust[0] - 1) < 0.02, 'double dust');
assert.ok(dust.events.some((e) => e.type === 'double'));
console.log('Passed dust.');

// Playing cards: dust, the deploy zone, spells anywhere, and the cycle.
const play = quiet();
play.hands[0][0] = 'pebble'; play.dust[0] = 4;
assert.equal(play.play(0, 0, 9, 22), 'dust');
play.dust[0] = 10;
assert.equal(play.play(0, 0, 9, 10), 'zone', 'not on the enemy half');
assert.equal(play.play(0, 0, 9, 16), 'zone', 'not in the river');
assert.equal(play.play(0, 0, 3.5, 16), 'zone', 'not on a bridge either');
assert.equal(play.play(0, 9, 9, 22), 'slot');
const next = play.queues[0][0];
assert.equal(play.play(0, 0, 9, 22), 'ok');
assert.equal(play.hands[0][0], next, 'the next card fills the slot');
assert.equal(play.queues[0].at(-1), 'pebble', 'the played card goes to the back');
assert.equal(play.dust[0], 5); assert.equal(play.spent[0], 5); assert.equal(play.played[0], 1);
give(play, 0, 'volley');
assert.equal(play.play(0, 0, 3.5, 6.5), 'ok', 'spells go anywhere');
assert.ok(play.canPlace(1, 'kits', 9, 10) && !play.canPlace(1, 'kits', 9, 22), 'side 1 plays on the top half');
give(play, 0, 'gliders'); play.play(0, 0, 9, 24);
assert.equal(troops(play, 0, 'gliders').length, 3, 'a three-card troop drops three');
play.pause(); assert.equal(play.play(0, 1, 9, 24), 'state'); assert.equal(play.state, 'paused');
const t = play.time; run(play, 1); assert.equal(play.time, t); play.pause();
console.log('Passed playing cards.');

// Troops wait a second to deploy, walk to a bridge, stay out of the water and hit the tower.
const walk = quiet();
give(walk, 0, 'mochi'); walk.play(0, 0, 8, 22);
const mochi = troops(walk, 0, 'mochi')[0], start = { x: mochi.x, y: mochi.y };
run(walk, DEPLOY_TIME * 0.9);
assert.deepEqual({ x: mochi.x, y: mochi.y }, start, 'still deploying');
let wet = 0, crossedAt = null;
run(walk, 20, () => { if (inRiver(mochi.y) && !onBridge(mochi.x)) wet++; if (inRiver(mochi.y)) crossedAt = mochi.x; });
assert.equal(wet, 0, 'never in the water');
assert.ok(Math.abs(crossedAt - 3.5) <= 1, 'crossed on the left bridge');
assert.ok(walk.tower(1, 'left').hp < TOWER.princess.hp, 'Mochi hits the left tower');
assert.ok(mochi.hp < mochi.maxHp, 'the tower shoots back');
console.log('Passed walking over a bridge.');

// The Dust Dasher leaps the river; gliders fly over it.
const leap = quiet();
give(leap, 0, 'dasher'); leap.play(0, 0, 9, 21);
give(leap, 0, 'gliders'); leap.play(0, 0, 9, 23);
const dasher = troops(leap, 0, 'dasher')[0];
let dasherX = null;
const gliderX = [];
run(leap, 8, () => { if (inRiver(dasher.y)) dasherX = dasher.x; for (const gl of troops(leap, 0, 'gliders')) if (inRiver(gl.y)) gliderX.push(gl.x); });
assert.ok(dasherX !== null && !onBridge(dasherX), 'the Dasher jumps the river away from the bridges');
assert.ok(gliderX.some((x) => !onBridge(x)), 'gliders fly straight over');
console.log('Passed jumping and flying.');

// Towers-first troops ignore troops; a building pulls them.
const stubborn = quiet();
give(stubborn, 0, 'pebble'); stubborn.play(0, 0, 3.5, 20);
give(stubborn, 1, 'mochi'); stubborn.play(1, 0, 3.5, 13);
const pebble = troops(stubborn, 0, 'pebble')[0], blocker = troops(stubborn, 1, 'mochi')[0];
let pebbleOnTroop = false, mochiOnPebble = false, passed = false;
run(stubborn, 16, (g) => { if (g.unit(pebble.target)?.role === 'troop') pebbleOnTroop = true; if (blocker.target === pebble.id) mochiOnPebble = true; if (pebble.y < blocker.y - 1) passed = true; });
assert.ok(!pebbleOnTroop, 'Pebble never targets a troop');
assert.ok(mochiOnPebble, 'Mochi fights Pebble');
assert.ok(passed, 'Pebble steps around Mochi on the bridge instead of shoving him back');
const pull = quiet();
give(pull, 1, 'cannon'); pull.play(1, 0, 9, 11);
give(pull, 0, 'pebble'); pull.play(0, 0, 13, 20);
run(pull, 14);
const cannon = troops(pull, 1, 'cannon')[0], grandpa = troops(pull, 0, 'pebble')[0];
assert.ok(!cannon || cannon.hp < cannon.maxHp - 150, 'Pebble goes for the cannon');
assert.equal(pull.tower(1, 'right').hp, TOWER.princess.hp, 'and leaves the tower alone');
assert.ok(grandpa.hp < grandpa.maxHp);
const decay = quiet();
give(decay, 0, 'cannon'); decay.play(0, 0, 9, 21);
run(decay, CARDS.cannon.stats.lifetime + DEPLOY_TIME + 0.5);
assert.equal(troops(decay, 0, 'cannon').length, 0, 'a cannon crumbles after 30 seconds');
console.log('Passed building targets, pulling and lifetimes.');

// Towers shoot what's in range; kings wake when hit or when a princess tower falls.
const range = quiet();
give(range, 1, 'mochi'); range.play(1, 0, 3.5, 12);
const far = troops(range, 1, 'mochi')[0], guard = range.tower(0, 'left');
let firstShot = null;
run(range, 12, () => { if (firstShot === null && guard.target === far.id) firstShot = Math.hypot(far.x - guard.x, far.y - guard.y) - far.r; });
assert.ok(firstShot !== null && firstShot <= TOWER.princess.range + 0.05 && firstShot > TOWER.princess.range - 0.5, `the tower opens fire at its range (${firstShot?.toFixed(2)})`);
const king = quiet(), sleepy = king.tower(1, 'king');
give(king, 0, 'kits'); king.units.find((u) => u.card === null && u.side === 1 && u.role === 'princess').hp = 1;
king.hurt(king.tower(1, 'left'), 5);
run(king, 0.1);
assert.equal(king.crowns[0], 1, 'a princess tower is a crown');
assert.ok(sleepy.active, 'the king wakes');
assert.ok(king.events.some((e) => e.type === 'crown' && e.side === 0));
const poke = quiet();
poke.hurt(poke.tower(0, 'king'), 1);
assert.ok(poke.tower(0, 'king').active, 'a hit wakes the king');
assert.ok(poke.canPlace(0, 'kits', 4, 11) === false, 'no pocket while the tower stands');
poke.tower(1, 'left').hp = 0; run(poke, 0.05);
assert.ok(poke.canPlace(0, 'kits', 4, 11) && !poke.canPlace(0, 'kits', 14, 11) && !poke.canPlace(0, 'kits', 4, 8), 'a fallen tower opens its lane’s pocket');
console.log('Passed tower range, crowns and kings.');

// Spells: full damage to troops, a share to towers, and a knockback.
const bomb = quiet();
give(bomb, 1, 'mochi'); bomb.play(1, 0, 9, 10);
run(bomb, DEPLOY_TIME);
const target = troops(bomb, 1, 'mochi')[0], before = { ...target };
target.speed = 0; // hold still so the knockback is all that moves it
give(bomb, 0, 'dustbomb'); bomb.play(0, 0, target.x, target.y + 1);
give(bomb, 0, 'dustbomb'); bomb.play(0, 0, 3.5, 6.5);
run(bomb, 2.5);
assert.ok(before.hp - target.hp >= CARDS.dustbomb.spell.dmg, 'a Dust Bomb hits a troop for full damage');
assert.ok(target.y < before.y - 0.5, 'and knocks it back');
assert.equal(bomb.tower(1, 'left').hp, TOWER.princess.hp - Math.round(CARDS.dustbomb.spell.dmg * TOWER_SPELL), 'towers take a share');
const volley = quiet();
give(volley, 1, 'kits'); volley.play(1, 0, 9, 9);
give(volley, 0, 'volley'); volley.play(0, 0, 9, 9);
run(volley, 2.5);
assert.equal(troops(volley, 1, 'kits').length, 0, 'a volley clears a swarm');
console.log('Passed spells.');

// Splash: Dora's dust puff and Enzo's spin hit crowds.
const puff = quiet();
give(puff, 1, 'kits'); puff.play(1, 0, 9, 13);
give(puff, 0, 'dora'); puff.play(0, 0, 9, 19);
let kitsLeft = 4, mostAtOnce = 0;
run(puff, 6, (g) => { const now = troops(g, 1, 'kits').length; mostAtOnce = Math.max(mostAtOnce, kitsLeft - now); kitsLeft = now; });
assert.ok(mostAtOnce >= 2, `one puff knocks out ${mostAtOnce} kits`);
const spin = quiet();
give(spin, 1, 'kits'); spin.play(1, 0, 9, 12);
give(spin, 0, 'enzo'); spin.play(0, 0, 9, 18);
run(spin, 12);
assert.equal(troops(spin, 1, 'kits').length, 0, 'Enzo spins through a kit squad');
assert.ok(troops(spin, 0, 'enzo')[0].hp > 0);
const pop = quiet();
give(pop, 0, 'balloon'); pop.play(0, 0, 3.5, 19);
run(pop, DEPLOY_TIME + 0.1);
give(pop, 1, 'mochi'); pop.play(1, 0, 9, 9);
const bal = troops(pop, 0, 'balloon')[0], mo = troops(pop, 1, 'mochi')[0];
run(pop, DEPLOY_TIME);
bal.x = mo.x; bal.y = mo.y; bal.hp = 1; pop.hurt(bal, 5);
const moHp = mo.hp; run(pop, 1);
assert.ok(moHp - mo.hp >= CARDS.balloon.stats.deathDmg, 'a popped balloon drops one last bale');
console.log('Passed splash, spin and the balloon’s last bale.');

// Winning: a king tower, crowns at full time, overtime, the tie-break and a draw.
const topple = quiet(); topple.tower(1, 'king').hp = 0; run(topple, 0.05);
assert.equal(topple.state, 'over'); assert.equal(topple.winner, 0); assert.equal(topple.reason, 'king'); assert.deepEqual(topple.crowns, [3, 0]);
const full = quiet(); full.crowns = [0, 1]; full.time = REGULATION - 0.01; run(full, 0.1);
assert.equal(full.winner, 1); assert.equal(full.reason, 'crowns');
const ot = quiet(); ot.time = REGULATION - 0.01; run(ot, 0.1);
assert.equal(ot.state, 'playing'); assert.ok(ot.overtime); assert.ok(ot.events.some((e) => e.type === 'overtime'));
ot.tower(0, 'right').hp = 0; run(ot, 0.05);
assert.equal(ot.winner, 1); assert.equal(ot.reason, 'overtime');
const tie = quiet(); tie.time = REGULATION + OVERTIME - 0.01; tie.tower(1, 'left').hp = 900; run(tie, 0.1);
assert.equal(tie.winner, 0); assert.equal(tie.reason, 'tiebreak'); assert.equal(tie.crowns[0], 1, 'the tie-break takes the weakest tower');
const draw = quiet(); draw.time = REGULATION + OVERTIME - 0.01; run(draw, 0.1);
assert.equal(draw.winner, null); assert.equal(draw.reason, 'draw');
console.log('Passed kings, full time, overtime, the tie-break and draws.');

// The computer defends a push.
const defend = new ClashGame({ seed: 3, ai: [null, RIVALS[1].ai] });
defend.dust[1] = MAX_DUST;
give(defend, 0, 'pebble'); defend.play(0, 0, 14.5, 18);
const playedBefore = defend.played[1];
run(defend, 8);
assert.ok(defend.played[1] > playedBefore, 'Velvet answers Grandpa Pebble');
assert.ok(defend.units.some((u) => u.side === 1 && u.role !== 'princess' && u.role !== 'king' && local(1, u.y) > RIVER_BOTTOM), 'on her own half');

// Whole matches, computer against computer: they always finish, the same seed replays exactly, and the
// rivals get harder along the trophy road.
const replay = (rival, seed) => { const g = new ClashGame({ rival, seed, ai: [STEADY, RIVALS[rival].ai] }); run(g, REGULATION + OVERTIME + 1); return g; };
const a = replay(2, 11), b = replay(2, 11);
assert.deepEqual([a.winner, a.reason, a.crowns, a.time, a.played], [b.winner, b.reason, b.crowns, b.time, b.played], 'deterministic');
const wins = RIVALS.map((_, r) => {
  let w = 0;
  for (let seed = 1; seed <= 8; seed++) {
    const g = replay(r, seed);
    assert.equal(g.state, 'over'); assert.ok(g.played[0] > 8 && g.played[1] > 8, 'both sides keep playing');
    assert.ok(g.units.every((u) => u.hp > 0 && u.x >= 0 && u.x <= 18 && u.y >= 0 && u.y <= 32));
    if (g.winner === 0) w++;
  }
  return w;
});
assert.ok(wins[0] >= wins[1] && wins[1] >= wins[2] && wins[0] > wins[2], `each arena is harder than the last (${wins.join(', ')} of 8)`);
assert.ok(wins[0] >= 6, 'Sandy is beatable');
assert.ok(wins[2] >= 1, 'the Baron is not unbeatable');
console.log(`Passed the computer: defends, replays exactly, and a steady bot wins ${wins.join(', ')} of 8 against the three rivals.`);
