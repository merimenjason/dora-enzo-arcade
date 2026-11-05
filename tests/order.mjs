// Turn Order engine checks: every verb (the hedgehog's step, push, push into the pot, turning back and waking a mole;
// the frog's appetite and the order it looks round in; mushrooms growing and joining the queue; the beetle's blast; the
// snail's turn; the mole; the Grumble's chase and snatch), a round in order (the opening example, newborns waiting,
// twists, running out of rounds), the solver, generated boards (winnable, not by doing nothing, the right critters,
// the same from the same seed, quick to make), the run (one swap, undo, tokens, the lullaby, planting, par, retries,
// perks, winning, losing) and the save.
import assert from 'node:assert/strict';
import { act, round, solve, idle, swapped, makeBoard, tierOf, Run, BOARDS, HP, TOKENS, MAX_ACTORS, W, H, isActor, newSave, parseSave, serialise, bank } from '../.checks/order-game.js';

let n = 0;
const ok = (m) => { n++; console.log('ok', m); };
const F = { N: 0, E: 1, S: 2, W: 3 };
/** a board from a list of [kind, x, y, facing]; the queue is the critters in list order */
const mk = (pieces, o = {}) => {
  const b = { walls: (o.walls ?? []).map(([x, y]) => y * W + x), pot: o.pot ?? { x: 7, y: 7 }, pieces: [], queue: [], nextId: 1, rounds: o.rounds ?? 5, mutator: o.mutator ?? 'none', potted: false, lost: '' };
  for (const [k, x, y, f = 'N'] of pieces) { const p = { id: b.nextId++, k, x, y, f: F[f], awake: false }; b.pieces.push(p); if (isActor(k)) b.queue.push(p.id); }
  return b;
};
const piece = (b, k, i = 0) => b.pieces.filter((p) => p.k === k)[i];
const pos = (p) => p && [p.x, p.y];

// ---- the hedgehog
{
  let b = mk([['hog', 2, 2, 'E']]); act(b, b.pieces[0]);
  assert.deepEqual(pos(b.pieces[0]), [3, 2], 'a step forward on open lawn');
  b = mk([['hog', 1, 2, 'E'], ['rock', 2, 2], ['acorn', 3, 2]]); const a = act(b, b.pieces[0]);
  assert.equal(a.what, 'push'); assert.deepEqual([pos(b.pieces[0]), pos(b.pieces[1]), pos(b.pieces[2])], [[2, 2], [3, 2], [4, 2]], 'it pushes the whole line');
  b = mk([['hog', 1, 2, 'E'], ['acorn', 2, 2]], { pot: { x: 3, y: 2 } }); assert.equal(act(b, b.pieces[0]).what, 'pot');
  assert.ok(b.potted && !piece(b, 'acorn'), 'the acorn goes in the pot'); assert.deepEqual(pos(b.pieces[0]), [2, 2]);
  b = mk([['hog', 1, 2, 'E'], ['rock', 2, 2]], { pot: { x: 3, y: 2 } }); assert.equal(act(b, b.pieces[0]).what, 'turnback');
  assert.equal(b.pieces[0].f, F.W, 'only acorns go in the pot: blocked, it turns round');
  b = mk([['hog', 1, 2, 'E']], { walls: [[2, 2]] }); act(b, b.pieces[0]); assert.deepEqual([pos(b.pieces[0]), b.pieces[0].f], [[1, 2], F.W], 'a wall turns it round');
  b = mk([['hog', W - 1, 2, 'E']]); act(b, b.pieces[0]); assert.equal(b.pieces[0].f, F.W, 'so does the edge');
  b = mk([['hog', 1, 2, 'E'], ['mole', 2, 2]]); assert.equal(act(b, b.pieces[0]).what, 'wake');
  assert.ok(piece(b, 'mole').awake, 'bumping a sleeping mole wakes it'); assert.deepEqual(pos(piece(b, 'mole')), [2, 2], 'but it doesn’t budge');
  ok('the hedgehog steps, pushes a line, pots the acorn, turns round when blocked and wakes a mole');
}

// ---- the frog
{
  let b = mk([['frog', 3, 3, 'E'], ['acorn', 3, 2], ['shroom', 4, 3]]); act(b, b.pieces[0]);
  assert.ok(!piece(b, 'shroom') && piece(b, 'acorn'), 'it looks ahead first');
  b = mk([['frog', 3, 3, 'E'], ['acorn', 2, 3], ['snail', 3, 4]]); act(b, b.pieces[0]);
  assert.ok(!piece(b, 'snail') && piece(b, 'acorn'), 'then round to the right: south before west');
  b = mk([['frog', 3, 3, 'N'], ['acorn', 3, 2]]); act(b, b.pieces[0]); assert.equal(b.lost, 'eaten', 'an eaten acorn loses the board');
  b = mk([['frog', 3, 3, 'N'], ['hog', 3, 2], ['rock', 4, 3], ['acorn', 5, 5]]); assert.equal(act(b, b.pieces[0]).what, 'idle', 'hedgehogs and rocks are too big, diagonals too far');
  ok('the frog eats one small neighbour, ahead first and then clockwise');
}

// ---- mushrooms, the beetle, the snail, the mole and the Grumble
{
  let b = mk([['shroom', 3, 3, 'E'], ['hog', 0, 0]]); const a = act(b, b.pieces[0]);
  assert.equal(a.what, 'grow'); const kid = b.pieces.find((p) => p.id === a.born);
  assert.deepEqual([pos(kid), kid.f], [[4, 3], F.E]); assert.equal(b.queue[b.queue.length - 1], kid.id, 'the new one joins the end of the queue');
  b = mk([['shroom', 3, 3, 'E']]); const r = round(b, b.queue);
  assert.equal(r.steps.length, 1, 'a mushroom born this round waits for the next'); assert.equal(r.board.queue.length, 2);
  b = mk(Array.from({ length: MAX_ACTORS }, (_, i) => ['shroom', i % W, Math.floor(i / W)]).concat([]));
  assert.equal(act(b, b.pieces[0]).what, 'idle', `no more than ${MAX_ACTORS} critters`);
  b = mk([['beetle', 3, 3], ['hog', 2, 2], ['rock', 4, 4], ['frog', 5, 3], ['acorn', 1, 1]], { walls: [[3, 4]] });
  act(b, b.pieces[0]);
  assert.deepEqual(b.pieces.map((p) => p.k).sort(), ['acorn', 'frog'], 'the beetle clears its 3 by 3'); assert.ok(b.walls.includes(4 * W + 3), 'walls stay');
  b = mk([['beetle', 3, 3], ['acorn', 4, 4]]); act(b, b.pieces[0]); assert.equal(b.lost, 'boom');
  b = mk([['snail', 3, 3], ['hog', 3, 2, 'N'], ['frog', 4, 3, 'W'], ['hog', 4, 4, 'N'], ['acorn', 2, 3]]); act(b, b.pieces[0]);
  assert.deepEqual([b.pieces[1].f, b.pieces[2].f, b.pieces[3].f], [F.E, F.N, F.N], 'the snail turns its four neighbours, not diagonals');
  b = mk([['mole', 3, 3]]); assert.equal(act(b, b.pieces[0]).what, 'sleep');
  b.pieces[0].awake = true; assert.equal(act(b, b.pieces[0]).what, 'dig'); assert.equal(b.pieces.length, 0, 'an awake mole burrows away');
  b = mk([['grumble', 1, 1], ['acorn', 5, 2]]); act(b, b.pieces[0]); assert.deepEqual(pos(b.pieces[0]), [2, 1], 'the Grumble steps along the longer way first');
  b = mk([['grumble', 1, 1], ['acorn', 5, 2]], { walls: [[2, 1]] }); act(b, b.pieces[0]); assert.deepEqual(pos(b.pieces[0]), [1, 2], 'and the other way when that’s blocked');
  b = mk([['grumble', 4, 2], ['acorn', 5, 2]]); assert.equal(act(b, b.pieces[0]).what, 'grab'); assert.equal(b.lost, 'stolen');
  ok('mushrooms grow (and wait a round), the beetle blasts, the snail turns, the mole sleeps and digs, the Grumble chases and snatches');
}

// ---- rounds
{
  // Enzo's opening example: the frog first eats the seed; swap, and the hedgehog shoves it clear
  const b = mk([['frog', 2, 4, 'N'], ['hog', 1, 3, 'E'], ['acorn', 2, 3]], { pot: { x: 4, y: 3 } });
  assert.equal(round(b, b.queue).board.lost, 'eaten');
  const s = round(b, swapped(b.queue, 0));
  assert.ok(!s.board.lost); assert.deepEqual(pos(piece(s.board, 'acorn')), [3, 3]);
  assert.ok(round(s.board, s.board.queue).board.potted, 'and the next round pots it');
  assert.equal(solve(b).rounds, 2); assert.deepEqual(solve(b).firsts, [0]); assert.equal(idle(b), false);
  // twists
  const t = mk([['hog', 0, 0, 'S'], ['hog', 5, 5, 'S'], ['frog', 7, 0]], { mutator: 'reverse' });
  assert.deepEqual(round(t, t.queue).board.queue, [3, 2, 1]);
  t.mutator = 'rotate'; assert.deepEqual(round(t, t.queue).board.queue, [2, 3, 1]);
  // running out of rounds
  const o = mk([['hog', 0, 0, 'S'], ['acorn', 6, 6]], { rounds: 1 }); assert.equal(round(o, o.queue).board.lost, 'rounds');
  // the board passed in is never changed
  const before = JSON.stringify(b); round(b, b.queue); assert.equal(JSON.stringify(b), before);
  ok('a round runs in queue order: the opening example, twists, running out of rounds, and the board left untouched');
}

// ---- generated boards
{
  const t0 = Date.now(); let worst = 0;
  for (const seed of [1, 7, 42, 99, 2026]) for (let ix = 0; ix < BOARDS; ix++) {
    const s = Date.now(); const m = makeBoard(seed, ix); worst = Math.max(worst, Date.now() - s);
    const b = m.board;
    assert.ok(solve(b).rounds <= b.rounds, `seed ${seed} board ${ix} can be won`);
    assert.equal(solve(b).rounds, m.par);
    assert.equal(idle(b), false, `seed ${seed} board ${ix} isn’t won by doing nothing`);
    const cells = b.pieces.map((p) => p.y * W + p.x);
    assert.equal(new Set(cells).size, cells.length, 'one thing a tile');
    for (const c of cells) assert.ok(!b.walls.includes(c) && c !== b.pot.y * W + b.pot.x, 'nothing on a wall or the pot');
    assert.equal(b.pieces.filter((p) => p.k === 'acorn').length, 1);
    const tier = tierOf(ix);
    if (tier === 0) assert.ok(b.pieces.every((p) => ['hog', 'frog', 'acorn'].includes(p.k)), 'the lawn has only hedgehogs and frogs');
    if (tier === 3) assert.ok(b.pieces.some((p) => p.k === 'grumble') && b.mutator === 'reverse', 'the Grumble King’s bed');
    assert.deepEqual(makeBoard(seed, ix), m, 'the same board from the same seed');
  }
  assert.ok(worst < 1500, `each board is quick to make (${worst} ms at worst)`);
  console.log(`  55 boards in ${Date.now() - t0} ms`);
  ok('generated boards: winnable, never by doing nothing, tidy, the right critters for the place, and repeatable');
}

// ---- the run
{
  const r = new Run(5);
  assert.equal(r.hp, HP); assert.equal(r.tokens, TOKENS); assert.equal(r.phase, 'plan');
  r.board = mk([['frog', 2, 4, 'N'], ['hog', 1, 3, 'E'], ['acorn', 2, 3]], { pot: { x: 4, y: 3 }, rounds: 3 }); r.start = structuredClone(r.board); r.par = 2; r.plan();
  assert.equal(r.swap(0), true); assert.equal(r.swap(0), false, 'one swap a round');
  r.plan(); assert.deepEqual(r.order, r.board.queue, 'undo puts the queue back');
  assert.equal(r.front(2), true); assert.equal(r.tokens, TOKENS - 1); assert.deepEqual(r.order, [2, 1]);
  r.plan(); assert.equal(r.tokens, TOKENS, 'undo gives the token back');
  assert.equal(r.setNap(1), false, 'no lullaby without the perk');
  r.swap(0); let g = r.go();
  assert.equal(r.phase, 'plan'); assert.equal(r.board.rounds, 2); assert.ok(g.steps.length >= 2);
  g = r.go();
  assert.deepEqual(g.events.map((e) => e.k), ['potted', 'par']); assert.equal(r.phase, 'pick'); assert.equal(r.tokens, TOKENS + 1, 'a token for planting within par');
  assert.equal(r.offer.length, 3); assert.equal(new Set(r.offer).size, 3);
  ok('the run: one swap a round, undo, a token to the front (refunded on undo), planting, and a token for par');
}
{
  const r = new Run(8);
  r.board = mk([['frog', 2, 4, 'N'], ['hog', 1, 3, 'E'], ['acorn', 2, 3]], { pot: { x: 4, y: 3 } }); r.start = structuredClone(r.board); r.plan();
  const g = r.go();
  assert.deepEqual(g.events.map((e) => e.k), ['fail', 'retry']); assert.equal(g.events[0].why, 'eaten');
  assert.equal(r.hp, HP - 1); assert.ok(piece(r.board, 'acorn'), 'the garden starts again'); assert.equal(r.phase, 'plan');
  r.hp = 1; const h = r.go(); assert.equal(r.phase, 'lost'); assert.ok(h.events.some((e) => e.k === 'lost'));
  ok('a lost acorn costs a try and starts the garden again; no tries left ends the run');
}
{
  const r = new Run(11); r.phase = 'pick'; r.offer = ['tokens', 'patience', 'encore'];
  const rounds = r.start.rounds;
  assert.equal(r.pick('heart'), false); r.pick('tokens'); assert.equal(r.tokens, TOKENS + 2); assert.equal(r.ix, 1);
  r.phase = 'pick'; r.offer = ['patience']; r.pick('patience');
  assert.equal(r.start.rounds, makeBoard(r.seed, 2).board.rounds + 1, 'one more round a board'); void rounds;
  r.phase = 'pick'; r.offer = ['encore']; r.pick('encore');
  assert.equal(r.swapsLeft, 2, 'two swaps in the first round'); r.swap(0); r.swap(1);
  r.phase = 'pick'; r.offer = ['nap', 'heart']; r.pick('nap');
  const id = r.order[0]; assert.equal(r.setNap(id), true); assert.equal(r.nap, id);
  r.phase = 'pick'; r.offer = ['heart']; r.pick('heart'); assert.equal(r.hpMax, HP + 1); assert.equal(r.hp, HP + 1);
  ok('perks: tokens, a longer afternoon, an encore swap, a lullaby and a spare try');
}
{
  // a perfect conductor (the solver's first choice every round) plants every acorn
  const r = new Run(2024);
  for (let guard = 0; guard < 200 && !r.over; guard++) {
    if (r.phase === 'pick') { r.pick(r.offer[0]); continue; }
    const f = solve(r.board).firsts[0]; if (f >= 0) r.swap(f);
    r.go();
  }
  assert.equal(r.phase, 'won'); assert.equal(r.stats.boards, BOARDS); assert.equal(r.hp, HP + r.perks.heart, 'without a single slip');
  ok(`the solver’s choices plant all ${BOARDS} acorns`);
}

// ---- the save
{
  const s = newSave();
  assert.deepEqual(parseSave(serialise(s)), s);
  assert.deepEqual(parseSave('{oops'), newSave()); assert.deepEqual(parseSave(JSON.stringify({ v: 2 })), newSave());
  const odd = parseSave(JSON.stringify({ v: 1, best: { board: 99, pars: -3 }, seen: ['frog', 'dragon'], settings: { fast: true } }));
  assert.equal(odd.best.board, BOARDS); assert.equal(odd.best.pars, 0); assert.deepEqual(odd.seen, ['frog']); assert.equal(odd.settings.fast, true);
  const r = new Run(3); r.ix = 4; r.phase = 'lost'; r.stats.boards = 4; r.stats.pars = 2;
  bank(s, r); assert.deepEqual(s.best, { board: 5, pars: 2 }); assert.equal(s.stats.runs, 1);
  r.phase = 'won'; bank(s, r); assert.equal(s.best.board, BOARDS); assert.equal(s.stats.wins, 1);
  ok('the save: round trip, corrupt and wrong-version saves ignored, odd values cleaned, runs banked');
}

void H;
console.log(`\n${n} Turn Order checks passed`);
