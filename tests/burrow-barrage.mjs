import assert from 'node:assert/strict';
import {
  Match, MAPS, LADDER, RIDES, RIDE_IDS, ITEMS, ITEM_IDS, AI_LEVELS, W, H, UNIT_UP, UNIT_R, CLIMB, CHARGE_FULL, DUSK_TURN, DUSK_HURT, SKIP_DELAY, HEAL, MAX_WIND,
  buildTerrain, ladderMatch, stars,
} from '../.checks/burrow-barrage-game.js';
import { play, climb } from './burrow-barrage-bot.mjs';

const FLOOR = 150;
/**
 * A match on flat ground with no wind, for one rule at a time: the ground's surface is row FLOOR, and the four units
 * stand at the given columns (team one's pair, then team two's). `shape` can then cut or add ground before they are set down.
 */
function flat({ rides = [['catapult', 'spitter'], ['digger', 'cannon']], at = [60, 100, 340, 300], shape, seed = 1 } = {}) {
  const m = Match.start({ map: 0, seed, rides });
  m.terrain.fill(0);
  for (let y = FLOOR; y < H; y++) for (let x = 0; x < W; x++) m.terrain[y * W + x] = 1;
  shape?.(m);
  m.wind = 0; m.events.length = 0;
  m.units.forEach((u, i) => { u.x = at[i]; u.y = FLOOR - 1; while (u.y + 1 < H && !m.solid(u.x, u.y + 1)) u.y++; while (m.solid(u.x, u.y)) u.y--; });
  return m;
}
const fill = (m, x0, y0, x1, y1, v) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) m.terrain[y * W + x] = v; };
/** Makes a unit the one whose turn it is. */
const turnOf = (m, id) => { m.units.forEach((u) => { u.delay = u.id === id ? 0 : 50 + u.id; }); m.activeId = id; return m.units[id]; };
/** The power that drops a shot from `id` closest to column `x` at this angle, by trying them all. `open` keeps to shots that land on the ground. */
function powerFor(m, id, angle, x, open = false) {
  let best = 1, miss = Infinity;
  for (let p = 1; p <= 100; p++) { const l = m.flight(m.units[id], angle, p); if (!l.lost && !(open && l.hit >= 0) && Math.abs(l.x - x) < miss) { miss = Math.abs(l.x - x); best = p; } }
  return best;
}
const types = (m) => m.events.map((e) => e.type);

// Every map starts with four chinchillas standing on ground, a team at each end.
for (let map = 0; map < MAPS.length; map++) {
  const m = Match.start({ map, seed: 3, rides: [['catapult', 'spitter'], ['digger', 'cannon']] });
  assert.equal(m.units.length, 4);
  for (const u of m.units) {
    assert.ok(m.solid(u.x, u.y + 1), `${MAPS[map].name}: ${u.name} has ground under it`);
    assert.ok(!m.solid(u.x, u.y), `${MAPS[map].name}: ${u.name} is not buried`);
    assert.equal(u.hp, RIDES[u.ride].hp);
    assert.deepEqual(u.items, ITEM_IDS);
  }
  assert.ok(m.units[0].x < W / 2 && m.units[1].x < W / 2 && m.units[2].x > W / 2 && m.units[3].x > W / 2, `${MAPS[map].name}: the teams start at opposite ends`);
  assert.equal(m.units[0].x + m.units[2].x, W, `${MAPS[map].name}: the starts mirror each other`);
  assert.equal(m.units[0].y, m.units[2].y, `${MAPS[map].name}: the ground mirrors too`);
  assert.equal(m.events[0].type, 'turn');
  assert.ok(Math.abs(m.wind) <= MAX_WIND);
  assert.deepEqual(buildTerrain(MAPS[map]), m.terrain);
}
assert.equal(LADDER.length, 6);
assert.equal(new Set(LADDER.map((r) => r.map)).size, MAPS.length, 'the ladder visits every map');

// Team one goes first unless told otherwise, and the teams take turns.
{
  const m = flat();
  assert.equal(Match.start({ map: 0, seed: 1, rides: [['catapult', 'spitter'], ['digger', 'cannon']] }).activeId, 0);
  assert.equal(Match.start({ map: 0, seed: 1, rides: [['catapult', 'spitter'], ['digger', 'cannon']], first: 1 }).activeId, 2);
  assert.deepEqual(m.order(4).map((id) => m.units[id].team), [0, 1, 0, 1]);
  assert.equal(m.order(6).length, 6);
}

// Flight: more power carries further, a mirrored angle lands mirrored, and wind bends the shot.
{
  const m = flat({ at: [150, 20, 380, 390] }), u = m.units[0];
  const near = m.flight(u, 45, 40), far = m.flight(u, 45, 70);
  assert.ok(far.x > near.x + 40, 'more power carries further');
  assert.ok(Math.abs(near.y - FLOOR) < 2, 'the shot comes down on the ground');
  const back = m.flight(u, 135, 40);
  assert.ok(Math.abs(u.x - back.x - (near.x - u.x)) < 1.5, 'a mirrored angle lands the same distance the other way');
  m.wind = 8; const blown = m.flight(u, 45, 40); m.wind = -8; const held = m.flight(u, 45, 40);
  assert.ok(blown.x > near.x + 5 && held.x < near.x - 5, 'wind carries or holds a shot');
  m.wind = 0;
  assert.ok(m.flight(m.units[1], 45, 100).x > 300, 'full power crosses most of the map');
  assert.equal(m.flight(m.units[1], 135, 100).lost, true, 'a shot off the side of the map is lost');
  assert.equal(m.flight(u, 45, 40, true).path.length % 2, 0);
  assert.equal(m.flight(u, 45, 40).path.length, 0, 'the path is only kept when asked for');
  assert.ok(m.guide().length > 10 && m.guide().length <= 52);
}

// A shot digs a crater, hurts what it lands on and passes the turn.
{
  const m = flat(), u = turnOf(m, 0), foe = m.units[3], shot = RIDES.catapult.shots[0];
  m.aim(45, powerFor(m, 0, 45, foe.x));
  const land = m.flight(u, u.angle, u.power);
  assert.equal(land.hit, foe.id, 'the shot is on target');
  assert.equal(m.fire(0), 'ok');
  assert.deepEqual(types(m).slice(0, 3), ['shot', 'boom', 'hurt']);
  assert.equal(foe.hp, RIDES.cannon.hp - shot.damage, 'a direct hit does full damage');
  assert.equal(u.delay, shot.delay);
  assert.equal(u.lastPower, u.power);
  assert.equal(u.charge, 1);
  assert.equal(m.turn, 2);
  assert.notEqual(m.activeId, 0, 'the turn passes');
  assert.equal(types(m).at(-1), 'turn');
  // A shot that comes down on open ground leaves a crater, and whoever stood near drops into it.
  turnOf(m, 0); m.aim(45, powerFor(m, 0, 45, foe.x - 6, true));
  const hole = m.flight(u, u.angle, u.power);
  assert.equal(hole.hit, -1);
  m.fire(0);
  assert.ok(!m.solid(Math.round(hole.x), FLOOR + 4), 'the ground under the blast is gone');
  assert.ok(m.solid(Math.round(hole.x), FLOOR + shot.crater + 4), 'the ground well below it is not');
  assert.ok(foe.y > FLOOR - 1, 'the rival beside it drops into the crater');
}

// Blasts hurt less the further away they land, and not at all outside their reach.
{
  const m = flat(), shot = RIDES.catapult.shots[0], foe = m.units[3], cy = foe.y - UNIT_UP;
  assert.deepEqual(m.harm(shot, foe.x, cy, foe), [shot.damage, shot.push]);
  const [mid] = m.harm(shot, foe.x + UNIT_R + shot.blast / 2, cy, foe), [edge] = m.harm(shot, foe.x + UNIT_R + shot.blast - 1, cy, foe);
  assert.ok(mid < shot.damage && edge < mid && edge > 0);
  assert.deepEqual(m.harm(shot, foe.x + UNIT_R + shot.blast + 2, cy, foe), [0, 0]);
}

// A shot fired straight up comes back down on the shooter, and a blast hurts a teammate just the same.
{
  const m = flat(), u = turnOf(m, 0);
  m.aim(90, 30); m.fire(0);
  assert.ok(u.hp < RIDES.catapult.hp, 'your own shot hurts you');
  const n = flat({ at: [60, 120, 340, 300] });
  turnOf(n, 0); n.aim(45, powerFor(n, 0, 45, 120)); n.fire(0);
  assert.ok(n.units[1].hp < RIDES.spitter.hp, 'and a teammate too');
}

// Ground dug from under a chinchilla drops it; with nothing below, it is out.
{
  // Team two stands on a thin ledge over open air.
  const m = flat({ shape: (g) => { fill(g, 280, FLOOR, W - 1, H - 1, 0); fill(g, 280, FLOOR, 360, FLOOR + 2, 1); } });
  const u = turnOf(m, 0), foe = m.units[3];
  m.units[2].alive = false;
  m.aim(45, powerFor(m, 0, 45, foe.x - 6, true)); m.fire(0);
  assert.equal(foe.alive, false);
  assert.ok(m.events.some((e) => e.type === 'out' && e.id === foe.id && e.why === 'fell'), 'the ledge is cut and the rival falls');
  assert.equal(m.state, 'over');
  assert.equal(m.winner, 0);
  assert.equal(types(m).at(-1), 'over');
  assert.equal(m.fire(0), 'no', 'nothing more happens once the match is over');
  assert.equal(m.walk(1), 'over');
  assert.equal(u.alive, true);
  assert.equal(stars(m), 3);
}

// A knock-out by damage, and a draw when the last of both teams go together.
{
  const m = flat({ at: [60, 100, 340, 300] }), foe = m.units[3];
  m.units[2].alive = false; foe.hp = 5;
  turnOf(m, 0); m.aim(45, powerFor(m, 0, 45, foe.x)); m.fire(0);
  assert.ok(m.events.some((e) => e.type === 'out' && e.id === foe.id && e.why === 'ko'));
  assert.equal(m.winner, 0);
  const d = flat({ at: [200, 100, 340, 214] });
  d.units[1].alive = false; d.units[2].alive = false; d.units[0].hp = 3; d.units[3].hp = 3;
  turnOf(d, 0); d.aim(45, powerFor(d, 0, 45, 207)); d.fire(0);
  assert.equal(d.state, 'over');
  assert.equal(d.winner, -1, 'both sides out together is a draw');
  assert.equal(stars(d), 0);
}

// The Dust Cannon shoves: along the ground, and off a ledge.
{
  const m = flat({ rides: [['cannon', 'cannon'], ['catapult', 'catapult']] }), foe = m.units[3], gale = RIDES.cannon.shots[1];
  turnOf(m, 0); m.aim(45, powerFor(m, 0, 45, foe.x - 12));
  const x = foe.x; m.fire(1);
  assert.ok(foe.x > x + gale.push / 3, 'a blast on its left shoves it right');
  assert.ok(foe.alive && foe.hp > RIDES.catapult.hp - gale.damage - 1);
  assert.ok(m.events.some((e) => e.type === 'shift' && e.id === foe.id));
  const n = flat({ rides: [['cannon', 'cannon'], ['catapult', 'catapult']], at: [60, 100, 340, 300], shape: (g) => fill(g, 310, FLOOR, W - 1, H - 1, 0) });
  // The second rival would be standing on nothing here; it is set aside so the first is the one tested.
  n.units[2].alive = false;
  turnOf(n, 0); n.aim(45, powerFor(n, 0, 45, 290)); n.fire(1);
  assert.equal(n.units[3].alive, false, 'shoved off the edge of the ground');
  assert.equal(n.winner, 0);
}

// The Tunnel Digger's shot goes through a wall that stops any other.
{
  const wall = (g) => fill(g, 196, FLOOR - 50, 204, FLOOR - 1, 1);
  const m = flat({ rides: [['digger', 'catapult'], ['catapult', 'catapult']], at: [170, 100, 215, 300], shape: wall });
  const foe = m.units[2];
  turnOf(m, 0); m.aim(20, 60);
  assert.equal(m.flight(m.units[0], 20, 60).hit, -1, 'the wall is in the way');
  m.fire(0);
  const shot = m.events.find((e) => e.type === 'shot');
  assert.ok(shot.boreAt > 0, 'the shot tunnels');
  assert.ok(foe.hp < RIDES.catapult.hp, 'and reaches the rival behind the wall');
  assert.ok(!m.solid(200, Math.round(shot.path[shot.boreAt * 2 + 1])), 'leaving a tunnel through it');
  const n = flat({ rides: [['catapult', 'catapult'], ['catapult', 'catapult']], at: [170, 100, 215, 300], shape: wall });
  turnOf(n, 0); n.aim(20, 60); n.fire(1);
  assert.equal(n.units[2].hp, RIDES.catapult.hp, 'a bale stops at the wall');
}

// The big shot needs CHARGE_FULL turns, then starts charging again.
{
  const m = flat(), u = turnOf(m, 0);
  m.aim(100, 100);
  assert.equal(m.charged(u), false);
  assert.match(m.cannot(2, null), /3 more turns/);
  assert.equal(m.fire(2), 'no');
  for (let i = 0; i < CHARGE_FULL; i++) { turnOf(m, 0); assert.equal(m.fire(0), 'ok'); }
  assert.equal(u.charge, CHARGE_FULL);
  turnOf(m, 0); m.events.length = 0;
  assert.equal(m.cannot(2, null), '');
  assert.equal(m.fire(2), 'ok');
  assert.equal(m.events.filter((e) => e.type === 'shot').length, RIDES.catapult.shots[2].count);
  assert.equal(u.charge, 0);
}

// Items: one of each, once a match.
{
  const m = flat(), u = turnOf(m, 0);
  m.aim(100, 100);
  assert.equal(m.fire(0, 'dual'), 'ok');
  assert.equal(m.events.filter((e) => e.type === 'shot').length, 2, 'Double Shot fires twice');
  assert.equal(u.delay, RIDES.catapult.shots[0].delay + ITEMS.dual.delay);
  assert.ok(!u.items.includes('dual'));
  turnOf(m, 0);
  assert.match(m.cannot(0, 'dual'), /used/);
  assert.equal(m.fire(0, 'dual'), 'no');

  u.hp = 50; m.events.length = 0;
  assert.equal(m.fire(0, 'heal'), 'ok');
  assert.equal(u.hp, 50 + HEAL);
  assert.deepEqual(types(m).filter((t) => t === 'shot' || t === 'heal'), ['heal'], 'the Dandelion takes the place of the shot');
  turnOf(m, 1); m.units[1].hp = RIDES.spitter.hp - 5; m.fire(0, 'heal');
  assert.equal(m.units[1].hp, RIDES.spitter.hp, 'healing stops at full health');

  turnOf(m, 0); m.aim(45, 40);
  const land = m.flight(u, 45, 40), foes = m.units.filter((v) => v.team === 1).map((v) => v.hp);
  m.events.length = 0;
  assert.equal(m.fire(2, 'hop'), 'ok', 'a hop does not need the big shot charged');
  assert.ok(Math.abs(u.x - land.x) <= 1 && u.y === FLOOR - 1, 'Burrow Hop moves the chinchilla to where the marker lands');
  assert.ok(m.events.some((e) => e.type === 'hop') && !m.events.some((e) => e.type === 'boom'), 'and digs nothing');
  assert.deepEqual(m.units.filter((v) => v.team === 1).map((v) => v.hp), foes);
  assert.deepEqual(u.items, []);
}

// Walking: so many cells a turn, up small steps, never up a wall or off into nothing.
{
  const m = flat({ shape: (g) => { fill(g, 70, FLOOR - CLIMB, 75, FLOOR - 1, 1); fill(g, 40, FLOOR - CLIMB - 1, 45, FLOOR - 1, 1); fill(g, 130, FLOOR, 140, H - 1, 0); }, at: [60, 120, 340, 300] });
  const u = turnOf(m, 0);
  for (let i = 0; i < 9; i++) assert.equal(m.walk(1), 'ok');
  assert.equal(u.x, 69);
  assert.equal(m.walk(1), 'ok');
  assert.equal(u.y, FLOOR - 1 - CLIMB, `a step of ${CLIMB} can be climbed`);
  for (let i = 0; i < RIDES.catapult.move - 10; i++) m.walk(1);
  assert.equal(u.moved, RIDES.catapult.move);
  assert.equal(m.walk(1), 'tired');
  const n = flat({ shape: (g) => fill(g, 40, FLOOR - CLIMB - 1, 45, FLOOR - 1, 1), at: [60, 120, 340, 300] }), v = turnOf(n, 0);
  for (let i = 0; i < 14; i++) n.walk(-1);
  assert.equal(n.walk(-1), 'blocked');
  assert.equal(v.x, 46, `a step of ${CLIMB + 1} cannot`);
  const p = turnOf(m, 1);
  for (let i = 0; i < 9; i++) assert.equal(m.walk(1), 'ok');
  assert.equal(m.walk(1), 'blocked', 'a chinchilla will not walk into a gap');
  assert.equal(p.x, 129);
  // The steps come back on the next turn.
  m.aim(100, 100); m.fire(0); turnOf(m, 1);
  assert.equal(p.moved, 0);
  // The edge of the map stops a walk as well.
  const e = flat({ at: [UNIT_R + 1, 120, 340, 300] }); turnOf(e, 0);
  assert.equal(e.walk(-1), 'ok');
  assert.equal(e.walk(-1), 'blocked');
}

// Aim is kept inside its limits; skipping costs a short wait.
{
  const m = flat(), u = turnOf(m, 0);
  m.aim(-20, 140); assert.deepEqual([u.angle, u.power], [5, 100]);
  m.aim(200, -3); assert.deepEqual([u.angle, u.power], [175, 0]);
  m.aim(62.4, 51.6); assert.deepEqual([u.angle, u.power], [62, 52]);
  assert.equal(m.skip(), 'ok');
  assert.equal(u.delay, SKIP_DELAY);
  assert.equal(u.charge, 1, 'a skipped turn still charges the big shot');
  assert.equal(m.turn, 2);
}

// The unit that has waited least goes next, so a quick shot can earn two turns before a slow one.
{
  const m = flat();
  m.units.forEach((u, i) => { u.delay = [0, 500, 60, 500][i]; });
  m.activeId = 0;
  m.aim(100, 100); m.fire(1);
  assert.equal(m.activeId, 2);
  m.units[2].delay = 30; m.skip();
  assert.equal(m.activeId, 2, 'still the least waited');
  m.units[2].delay = 200; m.aim(80, 100); m.fire(0);
  assert.equal(m.activeId, 0);
}

// Dusk: once the match has run long, everyone tires each turn, so no match can go on for ever.
{
  const m = flat(), before = m.units.map((u) => u.hp);
  m.turn = DUSK_TURN; turnOf(m, 0); m.skip();
  assert.ok(m.events.some((e) => e.type === 'dusk'));
  assert.deepEqual(m.units.map((u) => u.hp), before.map((h) => h - DUSK_HURT));
  const quiet = flat();
  for (let guard = 0; quiet.state === 'aim' && guard < 400; guard++) quiet.skip();
  assert.equal(quiet.state, 'over', 'even a match of nothing but skipped turns ends');
}

// The same seed and the same orders give the same match; the wind differs between seeds.
{
  const setup = (seed) => ({ map: 2, seed, rides: [['digger', 'cannon'], ['catapult', 'spitter']] });
  const a = play(setup(11)), b = play(setup(11));
  assert.deepEqual(a.units, b.units);
  assert.deepEqual(a.terrain, b.terrain);
  assert.equal(a.turn, b.turn);
  const winds = new Set();
  for (let s = 1; s <= 12; s++) winds.add(Match.start(setup(s)).wind);
  assert.ok(winds.size > 3, 'the wind depends on the seed');
  // A copy plays on its own.
  const m = Match.start(setup(5)), c = m.clone();
  c.aiTurn(2);
  assert.equal(m.turn, 1);
  assert.deepEqual(m.terrain, buildTerrain(MAPS[2]));
  assert.equal(m.units[0].hp, RIDES.digger.hp);
  m.aiTurn(2);
  assert.deepEqual(m.units, c.units, 'and the original then plays out the same way');
}

// The computer: an exact plan hits, costs the seed nothing, and worse levels miss by more.
{
  const m = flat(), seed = m.seed;
  turnOf(m, 0);
  const p = m.plan(2, true);
  assert.ok(p.score > 0, 'the computer finds a shot that hits');
  assert.equal(m.seed, seed, 'an exact plan draws nothing from the seed');
  assert.deepEqual(m.plan(2, true), p);
  m.aim(p.angle, p.power); m.fire(p.shot, p.item);
  assert.ok(m.units.filter((u) => u.team === 1).some((u) => u.hp < RIDES[u.ride].hp), 'and the shot it planned does');
  assert.ok(AI_LEVELS[0].angle > AI_LEVELS[1].angle && AI_LEVELS[1].angle > AI_LEVELS[2].angle);
  // It never plans to hit its own side when there is anything else to do.
  const close = flat({ at: [60, 72, 340, 300] }); turnOf(close, 0);
  const q = close.plan(2, true), l = close.flight(close.units[0], q.angle, q.power);
  assert.equal(close.harm(RIDES.catapult.shots[q.shot], l.x, l.y, close.units[1])[0], 0);
  // Hurt, with no knock-out on offer, it eats its Dandelion.
  const hurt = flat(); turnOf(hurt, 0); hurt.units[0].hp = 20;
  assert.equal(hurt.plan(2, true).item, 'heal');
  hurt.units[3].hp = 10;
  assert.notEqual(hurt.plan(2, true).item, 'heal', 'unless it can knock a rival out instead');
  // With its rivals in a bunker nothing can reach, it digs at the bunker without giving up its turn.
  const bunker = (g) => { fill(g, 262, FLOOR - 60, 378, FLOOR - 18, 1); fill(g, 262, FLOOR - 17, 278, FLOOR - 1, 1); fill(g, 362, FLOOR - 17, 378, FLOOR - 1, 1); };
  const stuck = flat({ shape: bunker }); turnOf(stuck, 0);
  assert.ok(stuck.plan(2, true).score <= 0, 'nothing reaches');
  const before = stuck.terrain.reduce((s, v) => s + v, 0);
  stuck.aiTurn(2);
  assert.ok(stuck.terrain.reduce((s, v) => s + v, 0) < before, 'it digs');
  assert.ok(stuck.events.some((e) => e.type === 'boom' && e.x > 240), 'towards its rivals');
}

// From the start of every map, every ride has a shot that hurts a rival.
for (let map = 0; map < MAPS.length; map++) for (const ride of RIDE_IDS) {
  const m = Match.start({ map, seed: 9, rides: [[ride, ride], [ride, ride]] });
  m.wind = 0;
  assert.ok(m.plan(2, true).score > 0, `${RIDES[ride].name} can reach a rival on ${MAPS[map].name}`);
}

// Stars: one for the win, two with both still in, three with half their health as well.
{
  const m = flat();
  assert.equal(stars(m), 0, 'none while the match is on');
  m.state = 'over'; m.winner = 0;
  assert.equal(stars(m), 3);
  m.units[0].hp = 10; m.units[1].hp = 10;
  assert.equal(stars(m), 2);
  m.units[1].alive = false;
  assert.equal(stars(m), 1);
  m.winner = 1;
  assert.equal(stars(m), 0);
}

// The ladder can be climbed, and the last rivals aim better than the first.
{
  assert.ok(LADDER.at(-1).level > LADDER[0].level);
  let won = 0;
  for (let i = 0; i < LADDER.length; i++) {
    const m = ladderMatch(i, ['catapult', 'spitter'], 5);
    assert.deepEqual(m.units.map((u) => u.name), ['Dora', 'Enzo', ...LADDER[i].rivals]);
    assert.equal(m.map, LADDER[i].map);
    let best = 0;
    for (let s = 1; s <= 4; s++) best = Math.max(best, stars(climb(i, ['catapult', 'spitter'], s * 37)));
    assert.ok(best >= 1, `match ${i + 1} can be won`);
    won++;
  }
  console.log(`Burrow Barrage: rules, maps and computer checks passed; a Deadeye pair won all ${won} ladder matches.`);
}
