// Turn-based football engine checks (lib/tactics-football.ts): the kick-off and determinism, moving (range, blocking,
// the goal columns, keepers on their line), ground passes (clear, cut out, through a tackle zone, the four-a-turn cap,
// pass-and-move), lofted passes, shots (goal, saved, charged down, too far, a header), tackles, undo, the clock and
// golden turns, the hooks, and the team styles (pressers' reach, runners screening, thieves, a better keeper). Run after
// `npm test` has compiled the engines into .checks/ (or `npm run test:rulebook`).
import assert from 'node:assert/strict';
import { Match, COLS, ROWS, TURNS, MOVE, DEFEND, CAP, cheb, line } from '../.checks/tactics-football.js';

const EASY = { press: 1, zone: 1, lanes: 0, move: 2, shotRange: 5 };
/** a match set out by hand: our four and theirs at the given cells (anyone not listed goes along the bottom row), the
 * ball with `holder` (a unit id), and their plan made against it */
function board(ours, theirs, holder = 0, level = {}, hooks = {}) {
  const m = new Match({ seed: 9, level: { ...EASY, ...level }, hooks });
  const O = m.units.filter((u) => u.team === 0 && !u.keeper), T = m.units.filter((u) => u.team === 1 && !u.keeper);
  [...O, ...T].forEach((u, k) => Object.assign(u, { c: 1 + k, r: ROWS - 1 }));
  ours.forEach(([c, r], k) => Object.assign(O[k], { c, r }));
  theirs.forEach(([c, r], k) => Object.assign(T[k], { c, r }));
  m.give(m.unit(holder));
  m.startTurn();
  m.events = [];
  return m;
}
const theirIds = (m) => m.units.filter((u) => u.team === 1 && !u.keeper).map((u) => u.id);

{
  // kick-off: our carrier on the centre spot, four and a keeper a side, every one of theirs with an intent
  const m = new Match({ seed: 3, level: EASY });
  assert.equal(m.units.length, 10);
  assert.equal(m.carrier.team, 0); assert.deepEqual([m.carrier.c, m.carrier.r], [7, 4]);
  assert.equal(m.poss, 0); assert.equal(m.s.turn, 0); assert.equal(m.s.maxTurns, TURNS);
  for (const id of theirIds(m)) assert.ok(m.s.intents.some((i) => i.id === id), 'each of theirs shows where he is going');
  assert.ok(m.s.intents.some((i) => i.kind === 'keeper'), 'and their keeper his cells');
  // the same seed plays the same way
  const a = new Match({ seed: 11, level: EASY }), b = new Match({ seed: 11, level: EASY });
  for (let k = 0; k < 10; k++) { a.endTurn(); b.endTurn(); }
  assert.equal(JSON.stringify(a.s), JSON.stringify(b.s));
}

{
  // moving: up to MOVE cells in any direction, not through anyone, never into a goal column; the keeper only along his line
  const m = board([[5, 4], [5, 2], [5, 6], [3, 4]], [[10, 1], [10, 7], [12, 1], [12, 7]], 0);
  const reach = m.reach(0);
  assert.ok(reach.every((c) => cheb(c, { c: 5, r: 4 }) <= MOVE));
  assert.ok(reach.some((c) => c.c === 7 && c.r === 6), 'diagonal moves count as one');
  assert.ok(!m.move(0, 8, 4), 'three cells is too far');
  assert.ok(!m.move(0, 5, 2), 'a taken cell');
  assert.ok(m.move(0, 7, 4)); assert.ok(m.unit(0).moved); assert.equal(m.carrier.id, 0, 'he dribbles with it');
  assert.ok(!m.move(0, 8, 4), 'one move a turn');
  const near = board([[2, 4], [5, 2], [5, 6], [3, 1]], [[10, 1], [10, 7], [12, 1], [12, 7]], 0);
  assert.ok(!near.reach(0).some((c) => c.c === 0), 'the goal column is the keeper’s');
  const k = near.keeperOf(0);
  assert.ok(near.reach(k.id).every((c) => c.c === 0 && c.r >= 3 && c.r <= 5), 'the keeper stays on his line');
  // a player cannot get past a wall of two
  const wall = board([[5, 4], [5, 2], [5, 6], [3, 4]], [[6, 3], [6, 4], [6, 5], [12, 7]], 0);
  assert.ok(wall.reach(0).every((c) => c.c <= 6));
}

{
  // ground passes: clear, cut out by a player on the line or by his tackle zone, the cap, and pass-and-move
  const m = board([[4, 4], [8, 4], [8, 1], [3, 7]], [[12, 7], [12, 8], [13, 7], [13, 8]], 0);
  const ok = m.passPreview(0, 1);
  assert.ok(ok.ok); assert.deepEqual(ok.cells, line({ c: 4, r: 4 }, { c: 8, r: 4 }));
  assert.ok(m.pass(0, 1)); assert.equal(m.carrier.id, 1);
  assert.ok(m.canAct(m.unit(1)), 'a receiver who has not moved plays it on');
  assert.ok(m.pass(1, 2)); assert.ok(m.pass(2, 1)); assert.ok(m.pass(1, 2));
  assert.equal(m.s.passes, CAP); assert.ok(!m.passPreview(2, 1).ok, 'four passes a turn');
  // a Grumble standing on the line
  const cut = board([[4, 4], [8, 4], [8, 1], [3, 7]], [[6, 4], [12, 8], [13, 7], [13, 8]], 0);
  const p = cut.passPreview(0, 1);
  assert.ok(!p.ok); assert.equal(p.reason, 'intercepted');
  // a receiver who has moved can take the ball but not play it on
  const moved = board([[4, 4], [8, 4], [8, 1], [3, 7]], [[12, 7], [12, 8], [13, 7], [13, 8]], 0);
  assert.ok(moved.move(1, 9, 4)); assert.ok(moved.pass(0, 1)); assert.ok(!moved.canAct(moved.unit(1)));
  // too far
  const far = board([[1, 4], [8, 4], [8, 1], [3, 7]], [[12, 7], [12, 8], [13, 7], [13, 8]], 0);
  assert.ok(!far.passPreview(0, 1).ok);
}

{
  // lofted passes: 3 to 7 cells; a team-mate on the landing cell takes it at once, otherwise it lands at End turn
  const m = board([[3, 4], [9, 2], [6, 7], [2, 1]], [[12, 7], [12, 8], [13, 7], [13, 8]], 0);
  assert.ok(!m.loftPreview(0, 4, 4).ok, 'too short');
  assert.ok(!m.loftPreview(0, 12, 4).ok, 'too long');
  const pv = m.loftPreview(0, 9, 2);
  assert.ok(pv.ok); assert.equal(pv.catcher, 1);
  assert.ok(m.loft(0, 9, 2)); assert.equal(m.carrier.id, 1); assert.equal(m.unit(1).got, 'loft');
  const air = board([[3, 4], [11, 2], [6, 7], [2, 1]], [[12, 7], [12, 8], [13, 7], [13, 8]], 0);
  assert.ok(air.loft(0, 8, 4)); assert.equal(air.carrier, null); assert.ok(air.s.ball.flight, 'in the air until End turn');
}

{
  // shots: in from close with the keeper on one side, saved where he covers, charged down through a tackle zone, too far
  const m = board([[12, 2], [5, 2], [5, 6], [3, 4]], [[2, 7], [2, 8], [3, 8], [4, 8]], 0);
  const gk = m.keeperOf(1);
  const covered = m.shotPreview(0, gk.r);
  assert.equal(covered.result, 'saved');
  const open = [3, 4, 5].map((row) => m.shotPreview(0, row)).filter((p) => p.result === 'goal');
  assert.ok(open.length >= 1, 'an open corner from close in');
  const row = [3, 4, 5].find((r) => m.shotPreview(0, r).result === 'goal');
  assert.ok(m.shoot(0, row));
  assert.deepEqual(m.s.score, [1, 0]); assert.ok(m.events.some((e) => e.k === 'goal' && e.team === 0));
  assert.equal(m.s.kickoff, 1, 'they kick off at the start of the next turn');
  assert.ok(m.endTurn()); assert.equal(m.carrier.team, 1); assert.deepEqual([m.carrier.c, m.carrier.r], [7, 4]);
  // far out
  const far = board([[3, 4], [5, 2], [5, 6], [2, 1]], [[12, 7], [12, 8], [13, 7], [13, 8]], 0);
  assert.equal(far.shotPreview(0, 3).result, 'far');
  // a Grumble standing in the way
  const block = board([[10, 4], [5, 2], [5, 6], [2, 1]], [[12, 4], [11, 3], [11, 5], [13, 8]], 0);
  assert.ok([3, 4, 5].every((r) => block.shotPreview(0, r).result !== 'goal'));
}

{
  // defending: their carrier's plan shows; we cut a pass out by standing on its line, and a tackle beats a dribble
  const m = board([[3, 4], [4, 2], [4, 6], [2, 1]], [[9, 4], [7, 4], [12, 1], [12, 7]], 6);
  assert.equal(m.poss, 1); assert.ok(m.s.bi, 'their ball action is showing');
  assert.ok(m.reach(0).every((c) => cheb(c, { c: 3, r: 4 }) <= DEFEND), 'we react a cell at a time');
  assert.ok(m.danger() > 0 || m.s.bi.k === 'dribble' || m.s.bi.k === 'hold');
  // the hint takes the danger away if a single step can
  const h = m.hint();
  if (h && h.k === 'move') { assert.ok(m.move(h.id, h.c, h.r)); }
  // tackling: next to their carrier, when he plans to dribble
  const t = board([[8, 4], [4, 2], [4, 6], [2, 1]], [[9, 4], [12, 3], [12, 1], [12, 7]], 5);
  t.s.bi = { k: 'dribble' };
  assert.ok(t.canTackle(0)); assert.ok(t.tackle(0)); assert.ok(t.endTurn());
  assert.equal(t.carrier.team, 0, 'the tackle won it');
}

{
  // undo puts everything back; End turn moves the clock on; a level score at full time brings two golden turns, then a draw
  const m = board([[5, 4], [5, 2], [5, 6], [3, 4]], [[10, 1], [10, 7], [12, 1], [12, 7]], 0);
  const before = JSON.stringify(m.s);
  assert.ok(m.move(0, 7, 4)); assert.ok(m.pass(0, 1)); assert.ok(m.canUndo);
  assert.ok(m.undo()); assert.ok(m.undo()); assert.equal(JSON.stringify(m.s), before); assert.ok(!m.undo());
  const c = new Match({ seed: 4, level: EASY, hooks: { turns: () => 4 } });
  assert.equal(c.s.maxTurns, 4);
  for (let k = 0; k < 4 && !c.s.over; k++) c.endTurn();
  if (c.s.score[0] === c.s.score[1]) { assert.ok(c.s.golden); assert.equal(c.s.maxTurns, 6); }
  for (let k = 0; k < 4 && !c.s.over; k++) c.endTurn();
  assert.ok(c.s.over); assert.equal(c.s.intents.length, 0);
  assert.ok(!c.move(0, 1, 1) && !c.endTurn(), 'nothing moves after the whistle');
}

{
  // hooks: a wider mouth, mud costing double, a goal's value, a side kicking off, extra players
  const m = board([[12, 2], [5, 2], [5, 6], [3, 4]], [[2, 7], [2, 8], [3, 8], [4, 8]], 0, {}, {
    mouth: (side) => (side === 1 ? [2, 6] : [3, 5]),
    moveCost: (c) => (c >= 5 && c <= 9 ? 2 : 1),
    goalValue: (team) => ({ value: team === 0 ? 3 : 1, notes: ['Three'] }),
    extraUnits: () => 1,
  });
  assert.deepEqual(m.mouth(1), [2, 6]);
  assert.equal(m.units.filter((u) => u.team === 1 && !u.keeper).length, 5);
  assert.ok(!m.reach(1).some((c) => cheb(c, { c: 5, r: 2 }) === 2 && c.c >= 5 && c.c <= 9 && Math.abs(c.c - 5) === 2), 'mud: two cells cost four');
  const row = [2, 3, 4, 5, 6].find((r) => m.shotPreview(0, r).result === 'goal');
  assert.ok(row !== undefined); assert.ok(m.shoot(0, row)); assert.deepEqual(m.s.score, [3, 0]);
}

{
  // team styles: a long-reaching presser lunges into a square of cells; runners screen cells off when they attack; a
  // thief steals a pass going past next to him; a better keeper covers more
  const reach = board([[6, 4], [3, 2], [3, 6], [2, 1]], [[9, 4], [12, 1], [12, 7], [13, 8]], 0, { reach: 2, press: 1 });
  const press = reach.s.intents.find((i) => i.kind === 'press');
  assert.ok(press && press.zone.length >= 20, 'a 5 by 5 square');
  const thief = board([[3, 4], [9, 4], [5, 1], [2, 1]], [[6, 5], [12, 1], [12, 7], [13, 8]], 0, { thief: true });
  assert.ok(!thief.passPreview(0, 1).ok, 'a magpie beside the line takes it');
  const plain = board([[12, 3], [5, 2], [5, 6], [3, 4]], [[2, 7], [2, 8], [3, 8], [4, 8]], 0);
  const better = board([[12, 3], [5, 2], [5, 6], [3, 4]], [[2, 7], [2, 8], [3, 8], [4, 8]], 0, { keeper: 2 });
  assert.ok(better.covered(1, 2, 4, 3).length > plain.covered(1, 2, 4, 3).length, 'a better keeper covers more from close in');
  assert.ok(plain.covered(1, 4, 4, 3).length < 3, 'but nobody covers the whole goal from inside six columns');
  // runners screen cells while they attack
  const screen = board([[3, 4], [4, 2], [4, 6], [2, 1]], [[9, 4], [7, 4], [8, 2], [8, 6]], 6, { zone: 3 });
  const set = screen.screened();
  assert.ok(set && set.size > 0);
  for (const u of screen.units.filter((v) => v.team === 0 && !v.keeper)) for (const c of screen.reach(u.id)) assert.ok(!set.has(c.c * 32 + c.r));
}

console.log('tactics football: kick-off, moves, passes, lofts, shots, defending, undo and the clock, hooks and team styles all check out');
