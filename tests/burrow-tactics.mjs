import assert from 'node:assert/strict';
import {
  Battle, Run, MISSIONS, HEROES, HERO_IDS, PREDATORS, ABILITIES, RELIC_IDS, SIZE, CLOUD_TURNS, RUN_WARREN, RUN_STAGES, RUN_UNLOCK,
  member, missionBattle, makeField, stars, bonusMet, unlockedHeroes, rewardText,
} from '../.checks/burrow-tactics-game.js';
import { playMission, playRun, takeTurn } from './burrow-tactics-bot.mjs';

const EMPTY = Array(SIZE).fill('.'.repeat(SIZE));
/** A map of grass with single tiles swapped in: { '3,4': '~' }. */
const mapWith = (cells = {}) => EMPTY.map((row, y) => [...row].map((ch, x) => cells[`${x},${y}`] ?? ch).join(''));
/**
 * A board for one rule: chinchillas and predators exactly where they are put. Predators are placed after the battle
 * is made and cannot walk (move 0) unless given a `move`, so they stay put; give one a `dir` to telegraph an attack.
 */
function board({ cells, heroes = ['dora'], at = [[0, 0]], preds = [{ kind: 'fox', x: 7, y: 7 }], relics = [], warren = 3, turns = 4, plan = [], boss = false, squad } = {}) {
  const b = Battle.create({ name: 'test', region: 0, turns, map: mapWith(cells), heroes: at, preds: [], plan, boss, seed: 1 }, squad ?? heroes.map(member), { warren, relics });
  for (const p of preds) {
    const d = PREDATORS[p.kind], hp = d.hp + (p.alpha ? 2 : 0);
    b.units.push({ id: b.nextId++, side: 'pred', kind: p.kind, x: p.x, y: p.y, hp: p.hp ?? hp, maxHp: hp, move: p.move ?? 0, power: p.alpha ? 1 : 0, fly: d.fly, alpha: !!p.alpha, fur: false, moved: false, acted: false, fromX: -1, fromY: -1, canUndo: false, dir: p.dir ?? -1, dist: p.dist ?? 2, order: b.nextId });
  }
  return b;
}
const hero = (b, kind) => b.units.find((u) => u.kind === kind);
const pred = (b, n = 0) => b.units.filter((u) => u.side === 'pred')[n];
const N = 0, E = 1, S = 2, W = 3;
const ok = (r, why) => assert.equal(r, 'ok', why);

// ---------- Setting up ----------
{
  const b = missionBattle(0);
  assert.equal(b.state, 'player'); assert.equal(b.turn, 1); assert.equal(b.warren, 3);
  assert.deepEqual(b.heroes.map((u) => u.kind), ['dora', 'enzo']);
  assert.equal(b.preds.length, 2);
  assert(b.preds.every((u) => u.dir >= 0 && u.order > 0), 'every predator telegraphs before the first turn');
  assert.equal(b.burrows().length, 3);
  assert.equal(b.events.length, 0, 'setting up is silent');
  assert.equal(hero(b, 'dora').hp, HEROES.dora.hp);
}

// ---------- Moving ----------
{
  const b = board({ cells: { '2,0': '~', '0,2': '#', '1,1': 'B' }, at: [[0, 0], [1, 0]], heroes: ['dora', 'enzo'], preds: [{ kind: 'fox', x: 0, y: 1 }] });
  const d = hero(b, 'dora'), moves = b.moves(d.id).map(String);
  assert(!moves.includes('2,0'), 'water cannot be walked into');
  assert(!moves.includes('1,0'), 'cannot stop on a friend');
  assert(!moves.includes('0,1') && !moves.includes('1,1') && !moves.includes('0,2'), 'predators, burrows and rocks block');
  assert.equal(b.moveHero(d.id, 5, 5), 'reach');
  assert.equal(moves.length, 0, 'boxed in by a friend, a fox, a burrow and water');
  const e = hero(b, 'enzo');
  assert.equal(b.moves(e.id).length, 0, 'Enzo is boxed in as well');
}
{
  const b = board({ at: [[0, 0], [1, 0]], heroes: ['dora', 'enzo'] });
  const d = hero(b, 'dora');
  assert(b.moves(d.id).map(String).includes('4,0'), 'walks through a friend');
  assert(!b.moves(d.id).map(String).includes('5,0'), 'Dora moves 4');
  ok(b.moveHero(d.id, 2, 2));
  assert.equal(b.moveHero(d.id, 2, 3), 'done', 'one move a turn');
  ok(b.undoMove(d.id)); assert.deepEqual([d.x, d.y], [0, 0]);
  ok(b.moveHero(d.id, 2, 2)); ok(b.act(d.id, 'groom', 2, 2));
  assert.equal(b.undoMove(d.id), 'undo', 'no undo after acting');
  assert.equal(b.act(d.id, 'groom', 2, 2), 'done');
}
{
  const b = board({ cells: { '1,0': '^' }, at: [[0, 0]] });
  const d = hero(b, 'dora');
  ok(b.moveHero(d.id, 1, 0)); assert.equal(d.hp, 2, 'stopping in brambles costs 1');
  assert.equal(b.undoMove(d.id), 'undo', 'a move that hurt cannot be undone');
}

// ---------- Seed Shot and pushing ----------
{
  const b = board({ at: [[0, 3]], preds: [{ kind: 'fox', x: 4, y: 3 }, { kind: 'fox', x: 6, y: 3 }] });
  const d = hero(b, 'dora'), f = pred(b);
  assert.deepEqual(b.targets(d.id, 'seed'), [[4, 3]], 'the first thing in each line');
  assert.deepEqual(b.aimAt(d.id, 'seed', 2, 3), [4, 3], 'any tile along the line aims the shot');
  assert.equal(b.aimAt(d.id, 'seed', 2, 4), null);
  ok(b.act(d.id, 'seed', 4, 3));
  assert.equal(f.hp, 2); assert.deepEqual([f.x, f.y], [5, 3], 'hit for 1 and pushed a tile');
  assert.deepEqual(b.events.map((e) => e.t), ['act', 'hit', 'push']);
}
{
  // Into water: drowned. Into a rock: bumped. Into another predator: both hurt. Off the board: stays.
  const water = board({ cells: { '3,0': '~' }, at: [[0, 0]], preds: [{ kind: 'fox', x: 2, y: 0 }, { kind: 'fox', x: 7, y: 7 }] });
  ok(water.act(hero(water, 'dora').id, 'seed', 2, 0));
  assert.equal(pred(water).hp, 0); assert.equal(water.stats.drowned, 1); assert.equal(water.stats.kills, 1);
  const rock = board({ cells: { '3,0': '#' }, at: [[0, 0]], preds: [{ kind: 'fox', x: 2, y: 0 }] });
  ok(rock.act(hero(rock, 'dora').id, 'seed', 2, 0));
  assert.equal(pred(rock).hp, 1, '1 for the seed and 1 for the bump'); assert.equal(pred(rock).x, 2);
  const pair = board({ at: [[0, 0]], preds: [{ kind: 'fox', x: 2, y: 0 }, { kind: 'snake', x: 3, y: 0 }] });
  ok(pair.act(hero(pair, 'dora').id, 'seed', 2, 0));
  assert.equal(pred(pair, 0).hp, 1); assert.equal(pred(pair, 1).hp, 1, 'the one behind takes the bump too');
  const edge = board({ at: [[0, 0]], preds: [{ kind: 'badger', x: 7, y: 0 }, { kind: 'fox', x: 7, y: 7 }] });
  ok(edge.act(hero(edge, 'dora').id, 'seed', 7, 0));
  assert.equal(pred(edge).hp, 4); assert.equal(pred(edge).x, 7, 'nothing is pushed off the board');
  const thorn = board({ cells: { '3,0': '^' }, at: [[0, 0]], preds: [{ kind: 'fox', x: 2, y: 0 }] });
  ok(thorn.act(hero(thorn, 'dora').id, 'seed', 2, 0));
  assert.equal(pred(thorn).hp, 1, 'brambles add 1');
  const owl = board({ cells: { '3,0': '~' }, at: [[0, 0]], preds: [{ kind: 'owl', x: 2, y: 0 }] });
  ok(owl.act(hero(owl, 'dora').id, 'seed', 2, 0));
  assert.equal(pred(owl).hp, 1, 'an owl hovers over water'); assert.equal(pred(owl).x, 3);
}
{
  // A bale breaks; pushing something into a burrow collapses it.
  const b = board({ cells: { '2,0': 'h', '3,2': 'B' }, at: [[0, 0]], preds: [{ kind: 'badger', x: 2, y: 2 }] });
  const d = hero(b, 'dora');
  ok(b.act(d.id, 'seed', 2, 0)); assert.equal(b.feature[2], null, 'the bale is gone');
  b.endTurn();
  d.x = 0; d.y = 2;
  ok(b.act(d.id, 'seed', 2, 2));
  assert.equal(b.warren, 2); assert.equal(b.feature[2 * SIZE + 3], 'rubble'); assert.equal(b.stats.lost, 1);
}

// ---------- The other actions ----------
{
  const b = board({ heroes: ['enzo'], at: [[3, 3]], preds: [{ kind: 'fox', x: 4, y: 3 }, { kind: 'badger', x: 3, y: 4 }] });
  const e = hero(b, 'enzo');
  assert.deepEqual(b.targets(e.id, 'whack').map(String).sort(), ['3,4', '4,3']);
  ok(b.act(e.id, 'whack', 4, 3));
  assert.equal(pred(b).hp, 1); assert.equal(pred(b).x, 5);
  assert.equal(b.targets(e.id, 'whack').length, 0, 'one action a turn');
}
{
  const b = board({ heroes: ['pip'], at: [[0, 3]], preds: [{ kind: 'fox', x: 3, y: 3, dir: W }, { kind: 'fox', x: 4, y: 3, dir: W }, { kind: 'fox', x: 3, y: 2, dir: S }] });
  const p = hero(b, 'pip'), [mid, east, north] = [pred(b, 0), pred(b, 1), pred(b, 2)];
  assert(b.targets(p.id, 'puff').map(String).includes('3,3') && !b.targets(p.id, 'puff').map(String).includes('1,3'), 'lobbed 2 to 4 tiles');
  ok(b.act(p.id, 'puff', 3, 3));
  assert.equal(b.cloud[3 * SIZE + 3], CLOUD_TURNS);
  assert.deepEqual([east.x, north.y], [5, 1], 'neighbours are pushed outward'); assert.equal(mid.hp, 3, 'a dust cloud does no damage');
  b.endTurn();
  assert.equal(b.stats.fizzled, 1, 'the fox in the cloud could not bite');
  assert.equal(b.cloud[3 * SIZE + 3], CLOUD_TURNS - 1);
  b.endTurn(); assert.equal(b.cloud[3 * SIZE + 3], 0, 'a cloud lasts two predator turns');
}
{
  const b = board({ cells: { '2,0': '~', '0,3': '#' }, heroes: ['pebble'], at: [[0, 0]], preds: [{ kind: 'fox', x: 3, y: 0 }] });
  const p = hero(b, 'pebble'), t = b.targets(p.id, 'toss').map(String);
  assert(!t.includes('2,0') && !t.includes('0,3') && t.includes('3,0') && t.includes('0,2'), 'not onto water or rock');
  ok(b.act(p.id, 'toss', 3, 0)); assert.equal(pred(b).hp, 2, 'a bale on the head does 1');
  b.endTurn(); p.x = 0; p.y = 0;
  ok(b.act(p.id, 'toss', 0, 2)); assert.equal(b.feature[2 * SIZE], 'bale');
}
{
  const b = board({ cells: { '1,0': '~' }, heroes: ['mochi'], at: [[0, 0]], preds: [{ kind: 'fox', x: 5, y: 0 }, { kind: 'snake', x: 0, y: 4 }] });
  const m = hero(b, 'mochi');
  ok(b.act(m.id, 'tug', 5, 0)); assert.equal(pred(b, 0).hp, 0, 'tugged into the water'); assert.equal(b.stats.drowned, 1);
  b.endTurn(); m.x = 0; m.y = 0; pred(b, 1).x = 0; pred(b, 1).y = 4;
  ok(b.act(m.id, 'tug', 0, 4)); assert.deepEqual([pred(b, 1).x, pred(b, 1).y], [0, 1]); assert.equal(pred(b, 1).hp, 2, 'a tug does no damage');
}
{
  const b = board({ heroes: ['biscuit'], at: [[0, 3]], preds: [{ kind: 'fox', x: 4, y: 3 }, { kind: 'fox', x: 3, y: 2 }] });
  const k = hero(b, 'biscuit');
  assert(!b.targets(k.id, 'pounce').map(String).includes('4,3'), 'cannot land on someone');
  ok(b.act(k.id, 'pounce', 3, 3));
  assert.deepEqual([k.x, k.y], [3, 3]);
  assert.deepEqual([pred(b, 0).x, pred(b, 0).hp, pred(b, 1).y, pred(b, 1).hp], [5, 2, 1, 2], 'neighbours take 1 and are thrown outward');
}
{
  const b = board({ cells: { '1,0': '~' }, at: [[0, 0]], preds: [{ kind: 'fox', x: 0, y: 1, dir: N }, { kind: 'fox', x: 5, y: 5 }] });
  const d = hero(b, 'dora');
  b.endTurn(); assert.equal(d.hp, 2);
  ok(b.act(d.id, 'groom', d.x, d.y)); assert.equal(d.hp, 3, 'grooming heals 1');
  b.endTurn(); d.x = 1; d.y = 0; d.hp = 3;
  assert(b.soaked(d)); assert.equal(b.targets(d.id, 'seed').length, 0, 'a soaked chinchilla cannot attack');
  assert.equal(b.act(d.id, 'seed', 0, 1), 'soaked'); assert.equal(b.targets(d.id, 'groom').length, 1);
  assert(b.moves(d.id).length > 0, 'but it can walk out');
  d.x = 3; d.y = 3; b.cloud[3 * SIZE + 3] = 2;
  assert.equal(b.act(d.id, 'seed', 5, 5), 'cloud');
}

// ---------- Predator attacks ----------
{
  const b = board({ cells: { '0,2': 'B' }, at: [[1, 0], [6, 6]], heroes: ['dora', 'enzo'], preds: [{ kind: 'fox', x: 2, y: 0, dir: W }, { kind: 'fox', x: 0, y: 3, dir: N }] });
  const before = b.forecast();
  assert.deepEqual(before, { warren: 1, burrows: [[0, 2]], heroes: { [hero(b, 'dora').id]: 1 }, downs: [], kills: 0 });
  b.endTurn();
  assert.equal(hero(b, 'dora').hp, 2); assert.equal(b.warren, 2); assert.equal(b.feature[2 * SIZE], 'rubble');
}
{
  // A snake hits the first thing in its line, so a bale shields whatever is behind it.
  const b = board({ cells: { '3,0': 'h' }, at: [[1, 0]], preds: [{ kind: 'snake', x: 6, y: 0, dir: W }, { kind: 'fox', x: 7, y: 7 }] });
  assert.deepEqual(b.threat(pred(b)), { path: [[5, 0], [4, 0]], hits: [[3, 0]] });
  b.endTurn(); assert.equal(hero(b, 'dora').hp, 3); assert.equal(b.feature[3], null);
}
{
  const b = board({ at: [[1, 3]], preds: [{ kind: 'owl', x: 6, y: 3, dir: W }, { kind: 'fox', x: 7, y: 7 }] });
  b.endTurn();
  const d = hero(b, 'dora');
  assert.equal(d.hp, 1, 'a swoop does 2'); assert.equal(d.x, 0, 'and knocks back');
  assert(b.events.some((e) => e.t === 'push' && e.leap && e.to[0] === 2), 'the owl flew up to her');
}
{
  const b = board({ at: [[4, 0], [5, 0]], heroes: ['dora', 'enzo'], preds: [{ kind: 'weasel', x: 3, y: 0, dir: E }, { kind: 'fox', x: 7, y: 7 }] });
  b.endTurn(); assert.deepEqual([hero(b, 'dora').hp, hero(b, 'enzo').hp], [2, 3], 'a lunge goes through two tiles');
}
{
  const b = board({ at: [[4, 2], [4, 3], [4, 4]], heroes: ['pebble', 'enzo', 'mochi'], preds: [{ kind: 'badger', x: 3, y: 3, dir: E }] });
  assert.deepEqual(b.threat(pred(b)).hits.map(String).sort(), ['4,2', '4,3', '4,4']);
  b.endTurn(); assert.deepEqual([hero(b, 'pebble').hp, hero(b, 'enzo').hp, hero(b, 'mochi').hp], [3, 2, 1], 'a sweep hits three tiles for 2');
}
{
  const b = board({ at: [[2, 2]], heroes: ['pebble'], preds: [{ kind: 'hawk', x: 5, y: 2, dir: W, dist: 3 }, { kind: 'fox', x: 7, y: 7 }] });
  assert.deepEqual(b.threat(pred(b)).hits, [[2, 2]]);
  b.endTurn(); assert.equal(hero(b, 'pebble').hp, 3);
}
{
  const b = board({ at: [[3, 2], [4, 3]], heroes: ['pebble', 'enzo'], preds: [{ kind: 'cougar', x: 3, y: 3, dir: 0 }], turns: 9 });
  b.endTurn();
  const [p, e] = [hero(b, 'pebble'), hero(b, 'enzo')];
  assert.deepEqual([p.hp, p.y, e.hp, e.x], [3, 1, 2, 5], 'a rake hits everything around for 2 and throws it back');
}
{
  // The attack follows the attacker: push the fox and its bite lands one tile over.
  const b = board({ cells: { '1,1': 'B' }, at: [[5, 2]], preds: [{ kind: 'fox', x: 2, y: 1, dir: W }, { kind: 'fox', x: 7, y: 7 }] });
  assert.equal(b.forecast().warren, 1);
  b.units[0].x = 2; b.units[0].y = 4;
  const d = hero(b, 'dora');
  d.x = 2; d.y = 0;
  ok(b.act(d.id, 'seed', 2, 1));
  assert.deepEqual([pred(b).x, pred(b).y], [2, 2]);
  assert.deepEqual(b.threat(pred(b)).hits, [[1, 2]]); assert.equal(b.forecast().warren, 0);
  b.endTurn(); assert.equal(b.warren, 3, 'the burrow is safe');
}
{
  const b = board({ at: [[1, 0]], preds: [{ kind: 'fox', x: 2, y: 0, dir: W, alpha: true }, { kind: 'fox', x: 7, y: 7 }] });
  assert.equal(pred(b).hp, 5);
  b.endTurn(); assert.equal(hero(b, 'dora').hp, 1, 'an alpha does 1 more');
}
{
  // Predators that get in each other's way hurt each other, and it counts.
  const b = board({ at: [[0, 7]], preds: [{ kind: 'snake', x: 6, y: 0, dir: W }, { kind: 'fox', x: 3, y: 0 }] });
  b.endTurn(); assert.equal(pred(b, 1).hp, 2); assert.equal(b.stats.friendly, 1);
}

// ---------- The forecast is exact ----------
for (let i = 0; i < MISSIONS.length; i++) {
  const b = missionBattle(i);
  for (let turn = 0; turn < 3 && b.state === 'player'; turn++) {
    if (turn) takeTurn(b);
    if (b.state !== 'player') break;
    const f = b.forecast(), hp = Object.fromEntries(b.heroes.map((u) => [u.id, u.hp])), warren = b.warren, c = b.clone();
    c.resolveAttacks();
    assert.equal(warren - c.warren, f.warren, `${MISSIONS[i].name}: forecast warren`);
    for (const u of c.units) if (u.side === 'hero' && hp[u.id]) assert.equal(hp[u.id] - u.hp, f.heroes[u.id] ?? 0, `${MISSIONS[i].name}: forecast damage`);
    b.endTurn();
  }
}
{
  // A preview is the battle after the action, and leaves the real one alone.
  const b = board({ at: [[0, 3]], preds: [{ kind: 'fox', x: 4, y: 3 }, { kind: 'fox', x: 7, y: 7 }] });
  const p = b.preview(hero(b, 'dora').id, 'seed', 4, 3);
  assert.equal(p.unit(pred(b).id).x, 5); assert.equal(pred(b).x, 4); assert.equal(b.events.length, 0);
  assert.equal(b.preview(hero(b, 'dora').id, 'seed', 1, 1), null);
}

// ---------- Rustling grass ----------
{
  const b = board({ at: [[5, 5]], plan: [{ turn: 1, kind: 'fox', x: 7, y: 7 }, { turn: 2, kind: 'snake', x: 7, y: 0 }], preds: [{ kind: 'fox', x: 0, y: 0 }], turns: 5 });
  assert.deepEqual(b.marks, [{ x: 7, y: 7, kind: 'fox', alpha: false }]);
  assert(b.pending());
  b.endTurn();
  assert.equal(b.preds.length, 2, 'the fox came up'); assert.deepEqual(b.marks.map((m) => m.kind), ['snake']);
  const d = hero(b, 'dora');
  d.x = 7; d.y = 0; d.hp = 3;
  b.endTurn();
  assert.equal(b.stats.blocks, 1); assert.equal(d.hp < 3, true, 'blocking costs 1'); assert.equal(b.marks.length, 1, 'the mark stays');
  assert.equal(b.preds.some((u) => u.kind === 'snake'), false);
}
{
  const b = board({ cells: { '7,7': 'h' }, at: [[0, 0]], plan: [{ turn: 1, kind: 'fox', x: 6, y: 6 }], preds: [{ kind: 'fox', x: 3, y: 3 }], turns: 5 });
  b.feature[6 * SIZE + 6] = 'bale';
  b.endTurn();
  assert.equal(b.feature[6 * SIZE + 6], null, 'a bale holds a mark down for a turn'); assert.equal(b.marks.length, 1);
}

// ---------- Winning and losing ----------
{
  const b = board({ at: [[0, 0]], preds: [{ kind: 'fox', x: 7, y: 7 }], turns: 2 });
  b.endTurn(); assert.equal(b.state, 'player'); assert.equal(b.turn, 2);
  b.endTurn(); assert.equal(b.state, 'won', 'held out for every turn');
  assert.equal(b.endTurn(), 'state'); assert.equal(b.moveHero(1, 1, 1), 'state');
}
{
  const b = board({ at: [[0, 0]], preds: [{ kind: 'snake', x: 1, y: 0, hp: 1 }] });
  ok(b.act(hero(b, 'dora').id, 'seed', 1, 0)); assert.equal(b.state, 'won', 'nothing left and nothing coming');
}
{
  const b = board({ at: [[0, 0]], preds: [{ kind: 'cougar', x: 1, y: 0, hp: 1 }, { kind: 'fox', x: 7, y: 7 }], boss: true });
  ok(b.act(hero(b, 'dora').id, 'seed', 1, 0)); assert.equal(b.state, 'won', 'the raid ends with the cougar');
  assert(b.stats.slain.includes('cougar'));
}
{
  const b = board({ cells: { '0,1': 'B' }, warren: 1, at: [[5, 5]], preds: [{ kind: 'fox', x: 0, y: 2, dir: N }] });
  b.endTurn(); assert.equal(b.state, 'lost'); assert.equal(b.warren, 0);
  const c = board({ at: [[0, 0]], preds: [{ kind: 'badger', x: 1, y: 0, dir: W, alpha: true }] });
  c.endTurn(); assert.equal(c.state, 'lost', 'nobody left standing'); assert.equal(c.stats.downs, 1);
}

// ---------- Reset, snapshots and seeds ----------
{
  const b = missionBattle(1), start = JSON.stringify(b.units);
  takeTurn(b);
  assert.notEqual(JSON.stringify(b.units), start);
  ok(b.resetTurn());
  assert.equal(b.resetLeft, 0); assert.equal(JSON.stringify(b.units), start, 'everyone is back where the turn began');
  assert.deepEqual([hero(b, 'dora').moved, hero(b, 'dora').acted], [false, false]);
  assert.equal(b.events.at(-1).t, 'reset');
  assert.equal(b.resetTurn(), 'undo', 'one reset a battle');
  const copy = Battle.from(b.snapshot());
  assert.deepEqual(copy.snapshot(), b.snapshot());
  takeTurn(b); takeTurn(copy); b.endTurn(); copy.endTurn();
  assert.deepEqual(copy.snapshot(), b.snapshot(), 'a restored battle plays out the same');
  assert.deepEqual(playMission(3).snapshot(), playMission(3).snapshot(), 'a mission replays exactly');
}

// ---------- Relics ----------
{
  const fur = board({ relics: ['fur'], at: [[1, 0]], preds: [{ kind: 'fox', x: 2, y: 0, dir: W }, { kind: 'fox', x: 7, y: 7 }] });
  fur.endTurn(); assert.equal(hero(fur, 'dora').hp, 3, 'thick fur soaks the first hit'); assert.equal(hero(fur, 'dora').fur, false);
  const doors = board({ relics: ['doors'], cells: { '0,1': 'B' }, at: [[5, 5]], preds: [{ kind: 'fox', x: 0, y: 2, dir: N }, { kind: 'fox', x: 7, y: 7 }] });
  doors.endTurn(); assert.equal(doors.warren, 3); assert.equal(doors.feature[SIZE], 'burrow');
  const paws = board({ relics: ['paws'], cells: { '3,0': '#' }, at: [[0, 0]], preds: [{ kind: 'fox', x: 2, y: 0 }, { kind: 'fox', x: 7, y: 7 }] });
  ok(paws.act(hero(paws, 'dora').id, 'seed', 2, 0)); assert.equal(pred(paws).hp, 0, 'spring paws: 1 + 2');
  const burrs = board({ relics: ['burrs'], cells: { '3,0': '^' }, at: [[0, 0]], preds: [{ kind: 'fox', x: 2, y: 0 }, { kind: 'fox', x: 7, y: 7 }] });
  ok(burrs.act(hero(burrs, 'dora').id, 'seed', 2, 0)); assert.equal(pred(burrs).hp, 0, 'burr seeds: 1 + 2');
  const quick = board({ relics: ['quick'], at: [[0, 0]], preds: [{ kind: 'fox', x: 7, y: 7 }] });
  assert(quick.moves(hero(quick, 'dora').id).map(String).includes('5,0')); quick.endTurn();
  assert(!quick.moves(hero(quick, 'dora').id).map(String).includes('5,0'), 'only on the first turn');
  const roots = board({ relics: ['roots'], at: [[7, 7]], plan: [{ turn: 1, kind: 'fox', x: 7, y: 7 }], preds: [{ kind: 'fox', x: 0, y: 0 }] });
  roots.marks = [{ x: 7, y: 7, kind: 'fox', alpha: false }];
  roots.endTurn(); assert.equal(hero(roots, 'dora').hp >= 2, true); assert.equal(roots.stats.blocks, 1);
}

// ---------- The campaign ----------
{
  assert.equal(MISSIONS.length, 10);
  assert.deepEqual(unlockedHeroes(0), ['dora', 'enzo']);
  assert.deepEqual(unlockedHeroes(MISSIONS.length), HERO_IDS, 'the campaign unlocks everyone');
  MISSIONS.forEach((m, i) => {
    assert.equal(m.map.length, SIZE); assert(m.map.every((row) => row.length === SIZE), `${m.name}: an 8 × 8 map`);
    assert(m.squad.every((h) => unlockedHeroes(i).includes(h)), `${m.name}: its squad is unlocked by then`);
    const tile = (x, y) => m.map[y][x];
    for (const [x, y] of m.heroes) assert.equal(tile(x, y), '.', `${m.name}: chinchillas start on grass`);
    for (const p of [...m.preds, ...m.plan]) assert('.^'.includes(tile(p.x, p.y)), `${m.name}: predators start on open ground`);
    assert(m.plan.every((s) => s.turn < m.turns), `${m.name}: nothing arrives too late to matter`);
    assert.equal(m.map.join('').split('B').length - 1 >= m.warren, true, `${m.name}: at least as many burrows as warren`);
    const won = playMission(i);
    assert.equal(won.state, 'won', `${m.name}: the bot wins it`);
    assert(stars(won, m) >= 2, `${m.name}: the bot earns at least 2 stars`);
    assert.equal(playMission(i, true).state, 'lost', `${m.name}: doing nothing loses`);
  });
  const b = missionBattle(0);
  assert.equal(stars(b, MISSIONS[0]), 0, 'no stars before winning');
  assert.equal(bonusMet(b, { text: '', stat: 'nodown' }), true);
  assert.equal(RUN_UNLOCK < MISSIONS.length, true);
}

// ---------- The Long Night ----------
{
  for (let seed = 1; seed <= 30; seed++) for (let stage = 0; stage < RUN_STAGES; stage++) {
    const f = makeField(seed, stage), g = makeField(seed, stage);
    assert.deepEqual(f, g, 'the same seed gives the same battle');
    const tile = (x, y) => f.map[y][x], label = `seed ${seed} stage ${stage}`;
    assert.equal(f.heroes.length, 3, label);
    assert(f.map.join('').split('B').length - 1 >= 3, `${label}: burrows`);
    for (const [x, y] of f.heroes) assert.equal(tile(x, y), '.', `${label}: chinchillas on grass`);
    for (const p of f.preds) assert.equal(tile(p.x, p.y), '.', `${label}: predators on grass`);
    assert(f.preds.length >= 1 && f.plan.length >= 1, `${label}: someone to fight`);
    assert.equal(f.preds.some((p) => p.kind === 'cougar'), stage === RUN_STAGES - 1, `${label}: the cougar is the last battle`);
    assert(f.plan.every((s) => s.turn < f.turns), label);
  }
  assert.notDeepEqual(makeField(1, 0).map, makeField(2, 0).map);
}
{
  const run = Run.start(7, ['dora', 'enzo', 'pip', 'mochi']);
  assert.equal(run.squad.length, 3); assert.equal(run.warren, RUN_WARREN); assert.equal(run.phase, 'battle');
  const b = run.battle;
  b.units.filter((u) => u.side === 'pred').forEach((u) => { u.hp = 0; });
  b.marks = []; b.plan = []; hero(b, 'pip').hp = 0;
  b.warren = 3; b.state = 'won';
  run.finish();
  assert.equal(run.phase, 'reward'); assert.equal(run.warren, 3);
  assert.equal(run.squad.find((m) => m.id === 'pip').scars, 1, 'a knocked-out chinchilla comes back weaker');
  assert.equal(run.choices.length, 3); assert.equal(new Set(run.choices.map((w) => JSON.stringify(w))).size, 3, 'three different rewards');
  assert(run.choices.some((w) => w.type === 'repair'), 'a hurt warren is offered a repair');
  for (const w of run.choices) assert(rewardText(w).title && rewardText(w).blurb);
  const saved = Run.restore(run.snapshot());
  assert.deepEqual(saved.snapshot(), run.snapshot());
  const i = run.choices.findIndex((w) => w.type === 'repair');
  assert.equal(run.pick(i), true);
  assert.equal(run.warren, 4); assert.equal(run.stage, 1); assert.equal(run.phase, 'battle'); assert.equal(run.battle.warren, 4);
  assert.equal(run.battle.units.find((u) => u.kind === 'pip').maxHp, HEROES.pip.hp - 1);
  assert.equal(run.pick(0), false, 'no reward to pick mid-battle');
  run.battle.state = 'lost'; run.finish(); assert.equal(run.phase, 'lost');
  const perk = Run.start(3, ['dora', 'enzo', 'pip']);
  perk.battle.state = 'won'; perk.finish();
  const p = perk.choices.findIndex((w) => w.type === 'perk'), w = perk.choices[p];
  perk.pick(p);
  assert.equal(perk.squad.find((m) => m.id === w.hero)[w.perk], 1);
  const u = perk.battle.units.find((x) => x.kind === w.hero);
  if (w.perk === 'hp') assert.equal(u.maxHp, HEROES[w.hero].hp + 1); else if (w.perk === 'move') assert.equal(u.move, HEROES[w.hero].move + 1); else assert.equal(u.power, 1);
  assert.equal(RELIC_IDS.length, 6); assert.equal(Object.keys(ABILITIES).length, 7);
}
{
  // Balance: the planner should win most runs but not all of them, and a run replays exactly from its seed.
  const squads = [['dora', 'enzo', 'pip'], ['dora', 'enzo', 'pebble'], ['enzo', 'mochi', 'biscuit'], ['dora', 'mochi', 'pip']];
  let won = 0;
  for (let seed = 1; seed <= 12; seed++) if (playRun(seed, squads[seed % squads.length]).phase === 'won') won++;
  assert(won >= 6, `the planner should win at least 6 of 12 runs (won ${won})`);
  assert.deepEqual(playRun(5).snapshot(), playRun(5).snapshot());
  console.log(`Burrow Tactics: rules, campaign and run checks passed; the planner won all ${MISSIONS.length} missions and ${won} of 12 runs.`);
}
