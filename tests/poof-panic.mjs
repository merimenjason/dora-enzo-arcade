import assert from 'node:assert/strict';
import {
  W, H, SPAWN_X, SPAWN_Y, TPS, DUST, TARGET, MAX_DROP, SWEEP_BONUS, MARGIN, MARGIN_STEP, MIN_TARGET, LOCK_TICKS, DAS, ARR, ENDLESS_STEP, ENDLESS_DUST_FROM,
  Bag, Board, Pad, Brain, Match, Endless, Drill, RIVALS, RIVAL, HEROES, LESSONS, PLACES, harder, endlessGravity, goalText,
  collapse, findPops, stepScore, resolve, land, gridFrom, heightOf, isEmpty, potential, reachable, solve, groupBonus,
} from '../.checks/poof-panic-game.js';

/** A board with set pieces: rows of text for the grid, a string of pairs for the bag. */
function board(rows = [], pairs = 'RB RB RB RB RB RB', cfg = {}) {
  const b = new Board(new Bag(1, 5, pairs.replace(/\s/g, '').split('').map((ch) => ({ R: 1, B: 2, G: 3, Y: 4, P: 5 })[ch])), { gravity: 1 / 30, colours: 5, style: 'sprinkle', ...cfg }, 7);
  b.grid.set(gridFrom(rows));
  return b;
}
const until = (b, ok, limit = 4000) => { let n = 0; while (!ok(b) && n++ < limit) b.step(); assert.ok(n <= limit, 'the board got there'); return b; };
const falling = (b) => until(b, (x) => x.phase === 'fall' || x.phase === 'over');
/** Put the pair in play down at a column and turn, the way a player would, and wait for the board to settle. */
function place(b, x, rot = 0) {
  falling(b);
  for (let i = 0; i < rot; i++) b.step({ rot: 1 });
  for (let i = 0; i < 6 && b.pair.x !== x; i++) b.step({ dx: x < b.pair.x ? -1 : 1 });
  assert.deepEqual([b.pair.x, b.pair.rot], [x, rot], 'the pair reached its column');
  b.step({ plunge: true });
  until(b, (k) => k.phase !== 'fall');
  return falling(b);
}
const cell = (b, x, y) => b.grid[y * W + x];
const count = (g, v) => g.filter((c) => c === v).length;

// ---------- The pairs ----------
{
  const a = new Bag(42, 4), b = new Bag(42, 4), c = new Bag(43, 4);
  const first = Array.from({ length: 40 }, (_, i) => a.at(i));
  assert.deepEqual(first, Array.from({ length: 40 }, (_, i) => b.at(i)), 'a seed deals the same pairs');
  assert.notDeepEqual(first, Array.from({ length: 40 }, (_, i) => c.at(i)));
  assert.deepEqual(a.at(7), first[7], 'asking again gives the same pair');
  for (let seed = 1; seed < 60; seed++) { const g = new Bag(seed, 5); assert.ok([...g.at(0), ...g.at(1)].every((v) => v >= 1 && v <= 3), 'the first two pairs use three colours'); }
  const all = new Set(first.flat());
  assert.deepEqual([...all].sort((x, y) => x - y), [1, 2, 3, 4], 'four colours and no others');
  const fixed = new Bag(1, 5, [1, 2, 3, 3]);
  assert.deepEqual([fixed.at(0), fixed.at(1), fixed.at(2)], [[1, 2], [3, 3], null], 'a fixed bag runs out');
}

// ---------- The grid ----------
{
  assert.equal(findPops(gridFrom(['RRR...'])), null, 'three do not pop');
  const four = findPops(gridFrom(['R.....', 'RRR...']));
  assert.deepEqual([four.cells.length, four.groups, four.colours], [4, [4], 1]);
  assert.equal(findPops(gridFrom(['RB....', 'BR....', 'RB....', 'BR....'])), null, 'diagonals do not touch');
  const two = findPops(gridFrom(['RRRRBB', 'GGGBB.']));
  assert.deepEqual([two.cells.length, two.groups.sort((x, y) => x - y), two.colours], [8, [4, 4], 2], 'two colours pop together; three mint stay');
  const dusty = findPops(gridFrom(['D.....', 'RD....', 'RRRD.D']));
  assert.deepEqual(dusty.dust.map((k) => `${k % W},${(k / W) | 0}`).sort((x, y) => x.localeCompare(y)), ['0,2', '1,1', '3,0'], 'only the dust touching the pop goes');
  assert.equal(findPops(gridFrom(['DDDD..', 'DDDD..'])), null, 'dust never matches');
  // The thirteenth row is hidden and does not count.
  const tall = new Uint8Array(W * H);
  for (let y = 9; y < 13; y++) tall[y * W] = 1;
  for (let y = 0; y < 9; y++) tall[y * W] = y % 2 ? 2 : 3;
  assert.equal(findPops(tall), null, 'a ball in the hidden row is not part of a group');

  const g = gridFrom(['R.....', '......', 'B..G..', '.....Y']), fell = new Uint8Array(W * H);
  assert.equal(collapse(g, fell), 2);
  assert.deepEqual([g[0], g[W], g[3], g[5], fell[W], fell[3]], [2, 1, 3, 4, 2, 1], 'everything falls straight down and says how far');
  assert.equal(heightOf(g, 0), 2);

  assert.equal(stepScore(1, four), 40, 'four balls, first link: 40');
  assert.equal(stepScore(2, four), 320, 'second link: eight times');
  assert.equal(stepScore(3, four), 640);
  assert.equal(stepScore(1, two), 10 * 8 * 3, 'two colours at once: times three');
  assert.deepEqual([4, 5, 6, 10, 11, 20].map(groupBonus), [0, 2, 3, 7, 10, 10]);
  assert.equal(stepScore(1, findPops(gridFrom(['RRRRR.']))), 10 * 5 * 2, 'five in a group: times two');

  const stairs = gridFrom(['.BG...', 'RRBG..', '.RBG..', '.RBG..']);
  assert.deepEqual(resolve(stairs), { chain: 3, score: 40 + 320 + 640, popped: 12 });
  assert.ok(isEmpty(stairs));
  const t = gridFrom(['RR....']);
  assert.ok(land(t, 2, 1, 1, 1) && resolve(t).chain === 1, 'a flat pair beside two makes four');
  assert.equal(land(gridFrom([]), 5, 1, 1, 2), false, 'a pair cannot hang over the wall');
  const up = gridFrom([]); land(up, 0, 0, 1, 2); assert.deepEqual([up[0], up[W]], [1, 2], 'upright: the first ball is the lower one');
  const down = gridFrom([]); land(down, 0, 2, 1, 2); assert.deepEqual([down[0], down[W]], [2, 1], 'turned over: the second ball is the lower one');
  assert.deepEqual(potential(gridFrom(['.BG...', '.RBG..', '.RBG..', '.RBG..'])).slice(0, 1), [3], 'a rival sees the three-chain waiting');
  assert.equal(PLACES.length, 22);
  assert.equal(reachable([0, 0, 0, 0, 13, 0], 5, 0), false, 'a full column blocks the way past it');
  assert.equal(reachable([0, 0, 0, 0, 11, 0], 5, 0), true);
}

// ---------- Moving a pair ----------
{
  const b = falling(board());
  assert.deepEqual([b.pair.x, b.pair.y, b.pair.rot, b.pair.a, b.pair.b], [SPAWN_X, SPAWN_Y, 0, 1, 2], 'a pair starts upright in the third column');
  for (let i = 0; i < 9; i++) b.step({ dx: -1 });
  assert.equal(b.pair.x, 0, 'the wall stops it');
  b.step({ rot: -1 });
  assert.deepEqual([b.pair.x, b.pair.rot], [1, 3], 'turning into the wall pushes the pair off it');
  b.step({ rot: -1 });
  assert.equal(b.pair.rot, 2);
  for (let i = 0; i < 9; i++) b.step({ dx: 1 });
  b.step({ rot: -1 });
  assert.deepEqual([b.pair.x, b.pair.rot], [4, 1], 'and off the right wall too');

  // On the floor, turning the second ball underneath lifts the pair.
  const f = falling(board());
  f.step({ rot: 1 });
  until(f, (k) => k.pair.y === 0 || k.phase !== 'fall');
  const y = f.pair.y;
  f.step({ rot: 1 });
  assert.deepEqual([f.pair.rot, f.pair.y], [2, y + 1], 'the pair is lifted so the lower ball fits');

  // In a one-wide well a turn cannot happen; two quick presses swap the balls instead.
  const well = falling(board(['.B.B..', '.B.B..', '.G.G..', '.G.G..', '.B.B..', '.B.B..', '.G.G..', '.G.G..', '.B.B..', '.B.B..', '.G.G..', '.G.G..']));
  until(well, (k) => k.pair.y < 10);
  well.step({ rot: 1 });
  assert.deepEqual([well.pair.rot, well.pair.a], [0, 1], 'one press does nothing');
  well.step({ rot: 1 });
  assert.deepEqual([well.pair.rot, well.pair.a, well.pair.b], [0, 2, 1], 'the second swaps them');

  // Soft drop is quick and scores a point a row; a held pair locks after the lock delay.
  const s = falling(board());
  const before = s.tick;
  until(s, (k) => k.phase !== 'fall');
  const slow = s.tick - before;
  const q = falling(board());
  let ticks = 0;
  while (q.phase === 'fall') { q.step({ soft: true }); ticks++; }
  assert.ok(ticks < slow / 5, `soft drop is much faster (${ticks} v ${slow} ticks)`);
  assert.equal(q.score, SPAWN_Y, 'a point for every row dropped by hand');
  assert.equal(s.score, 0);
  assert.deepEqual([cell(q, 2, 0), cell(q, 2, 1)], [1, 2]);
  const rest = falling(board([], 'RB RB', { float: true }));
  for (let i = 0; i < 200; i++) rest.step();
  assert.equal(rest.pair.y, SPAWN_Y, 'in a lesson the pair waits until you drop it');
  const l = falling(board(['GGGGGG', 'BBBBBB', 'GGGGGG', 'BBBBBB', 'GGGGGG', 'BBBBBB', 'GGGGGG', 'BBBBBB', 'GGGGGG', 'BBBBBB', 'YY.YYY'].slice(1)));
  until(l, (k) => k.pair.y === 10);
  let held = 0;
  while (l.phase === 'fall') { l.step(); held++; }
  assert.ok(held >= LOCK_TICKS && held < LOCK_TICKS + 4, `a resting pair locks after the delay (${held})`);
}

// ---------- Splitting, popping and chains ----------
{
  const b = place(board(['.....G', 'BBB.GG'], 'BG RR'), 2, 1);
  assert.ok(isEmpty(b.grid), 'a flat pair splits and each ball finds its group');
  assert.deepEqual([b.best, b.popped, b.score], [1, 8, 10 * 8 * 3 + 10], "240 for the pop and ten for the rows dropped by hand");
  assert.equal(b.sweeps, 1);
  const c = board(['.BG...', '.RBG..', '.RBG..', '.RBG..'], 'RY RR');
  const evs = [];
  falling(c);
  c.step({ dx: -1 }); c.step({ dx: -1 }); c.step({ plunge: true });
  let n = 0;
  while (n++ < 2000 && !(c.phase === 'fall' && c.index === 1)) { c.step(); evs.push(...c.events.splice(0)); }
  assert.deepEqual(evs.filter((e) => e.t === 'pop').map((e) => e.chain), [1, 2, 3], 'the staircase goes off one step at a time');
  assert.deepEqual(evs.find((e) => e.t === 'chain'), { t: 'chain', chain: 3 });
  assert.equal(c.best, 3);
  assert.equal(count(c.grid, 4), 1, 'the honey ball is all that is left');
  const pop = evs.find((e) => e.t === 'pop');
  assert.ok(pop.cells.every((k) => k.c === 1) && pop.cells.length === 4, 'a pop says which balls went');
}

// ---------- Dust ----------
function pairUp(rowsA = [], rowsB = [], pairs = 'RR RR RR RR RR RR RR RR', cfg = {}) {
  const a = board(rowsA, pairs, cfg), b = board(rowsB, pairs, cfg);
  a.rival = b; b.rival = a;
  return [a, b];
}
{
  // Five rose balls then four sky: 100 + 320 = 420 points, which is six clumps exactly.
  const [a, b] = pairUp(['.B....', '.RB...', '.RB...', '.RB...']);
  falling(a); a.step({ dx: -1 }); a.step({ dx: -1 }); a.step({ plunge: true });
  until(a, (k) => k.phase === 'pop' && k.chain === 2);
  assert.deepEqual([b.incoming, b.pending], [6, 0], 'dust from a chain still running cannot fall yet');
  falling(a);
  assert.deepEqual([b.incoming, b.pending, a.carry, a.sent], [0, 6, 0, 6], 'when the chain ends the dust is ready');
  place(b, 5);
  assert.equal(count(b.grid, DUST), 6, 'it lands after the next pair that pops nothing');
  assert.equal(b.pending, 0);
  for (let x = 0; x < W; x++) assert.equal(cell(b, x, heightOf(b.grid, x) - 1), DUST, 'six clumps are one full row, on top of everything');
  b.pending = 5;
  place(b, 5);
  const tops = [0, 1, 2, 3, 4, 5].filter((x) => cell(b, x, heightOf(b.grid, x) - 1) === DUST && cell(b, x, heightOf(b.grid, x) - 2) === DUST);
  assert.equal(tops.length, 4, 'sprinkled dust goes one to a column');
}
{
  // Dust waits while you keep popping, and a pop cancels dust before it sends any.
  const [a] = pairUp(['.B....', '.RB...', '.RB...', '.RB...']);
  a.pending = 3; a.incoming = 1;
  const evs = [];
  falling(a); a.step({ dx: -1 }); a.step({ dx: -1 }); a.step({ plunge: true });
  let n = 0;
  while (n++ < 2000 && !(a.phase === 'fall' && a.index === 1)) { a.step(); evs.push(...a.events.splice(0)); }
  assert.deepEqual([a.pending, a.incoming, a.rival.pending, a.sent], [0, 0, 2, 2], 'six clumps: four cancelled, two sent');
  assert.equal(evs.filter((e) => e.t === 'offset').reduce((s, e) => s + e.n, 0), 4);
  assert.equal(count(a.grid, DUST), 0, 'no dust falls on a turn that popped');
}
{
  const [a] = pairUp();
  a.pending = 44;
  place(a, 0);
  assert.equal(count(a.grid, DUST), MAX_DROP, 'thirty clumps at most land at once');
  assert.equal(a.pending, 14);
  for (let x = 0; x < W; x++) assert.equal(count(a.grid.filter((_, i) => i % W === x), DUST), 5, 'five full rows');
  place(a, 5);
  assert.equal(count(a.grid, DUST), 44, 'the rest lands next time');
  // A heap lands side by side.
  for (let seed = 1; seed < 30; seed++) {
    const p = new Board(new Bag(1, 4), { gravity: 1, colours: 4, style: 'pile' }, seed);
    p.pending = 3;
    falling(p); p.step({ plunge: true }); until(p, (k) => k.phase === 'dust');
    const xs = [...p.grid].map((v, i) => (v === DUST ? i % W : -1)).filter((x) => x >= 0).sort((x, y) => x - y);
    assert.equal(xs.length, 3);
    assert.equal(xs[2] - xs[0], 2, 'a heap is three columns side by side');
  }
}
{
  // A clean sweep is worth thirty extra clumps on the next pop.
  const [a, b] = pairUp(['RRR...'], [], 'RB BB BB');
  place(a, 3, 0);
  assert.equal(a.sweeps, 0, 'the sky ball is still there');
  const [c, d] = pairUp(['RR....'], [], 'RR BB BB RR');
  place(c, 2, 1);
  assert.deepEqual([c.sweeps, c.bonus, d.pending], [1, true, 0]);
  place(c, 0, 1); place(c, 2, 1);
  assert.equal(c.sweeps, 2, 'and that pop swept the board again');
  assert.equal(d.pending, SWEEP_BONUS + 1, 'thirty for the sweep, one for 80 points with what was carried');
  assert.ok(b && a);
}
{
  // Clumps get cheaper once a round has gone on too long.
  const b = board();
  assert.equal(b.target(), TARGET);
  b.tick = TPS * MARGIN - 1; assert.equal(b.target(), TARGET);
  b.tick = TPS * MARGIN; assert.equal(b.target(), Math.floor(TARGET * 0.75));
  b.tick = TPS * (MARGIN + MARGIN_STEP * 3); assert.equal(b.target(), Math.floor(TARGET * 0.75 ** 4));
  b.tick = TPS * 3600; assert.equal(b.target(), MIN_TARGET);
}
{
  // Topping out: the third column's top visible cell.
  const rows = Array.from({ length: 11 }, (_, i) => (i % 2 ? '..G...' : '..B...'));
  const b = place(board(rows), 2);
  assert.equal(b.phase, 'over'); assert.ok(b.lost);
  const safe = place(board(rows.map((r) => r.replace(/^\.\.(.)/, '$1..'))), 0);
  assert.equal(safe.phase, 'fall', 'any other column may be full');
  const before = safe.tick; safe.phase = 'over'; safe.step(); assert.equal(safe.tick, before, 'a finished board stands still');
}

// ---------- Keys ----------
{
  const pad = new Pad(), moves = [];
  pad.hold('left', true);
  for (let i = 0; i < DAS + ARR * 3 + 1; i++) moves.push(pad.poll().dx ?? 0);
  assert.equal(moves[0], -1, 'a press moves at once');
  assert.ok(moves.slice(1, DAS).every((v) => v === 0), 'then waits');
  assert.equal(moves.filter((v) => v).length, 5, 'then repeats');
  pad.hold('right', true);
  assert.equal(pad.poll().dx, 1, 'the newer key wins');
  pad.hold('right', false); pad.hold('left', false);
  assert.equal(pad.poll().dx, undefined);
  pad.hold('left', true); pad.hold('left', false);
  assert.equal(pad.poll().dx, -1, 'a tap shorter than a tick still moves once');
  assert.equal(pad.poll().dx, undefined);
  pad.tap('cw'); pad.tap('ccw'); pad.tap('left'); pad.tap('plunge'); pad.hold('down', true);
  assert.deepEqual(pad.poll(), { soft: true, rot: 1, plunge: true, dx: -1 });
  assert.deepEqual(pad.poll(), { soft: true, rot: -1 });
  pad.clear();
  assert.deepEqual(pad.poll(), { soft: false });
}

// ---------- Rivals ----------
{
  assert.equal(RIVALS.length, 6);
  assert.equal(new Set(RIVALS.map((r) => r.id)).size, 6);
  for (let i = 1; i < RIVALS.length; i++) {
    const a = RIVALS[i - 1], b = RIVALS[i];
    assert.ok(b.think <= a.think && b.pace <= a.pace && b.slip <= a.slip && b.greed >= a.greed && b.gravity >= a.gravity, `${b.id} is quicker and tidier than ${a.id}`);
  }
  for (const r of RIVALS) { const h = harder(r); assert.ok(h.think < r.think && h.pace <= r.pace && h.slip < r.slip && h.gravity > r.gravity && RIVAL[r.id] === r); }
  assert.notEqual(HEROES.dora.style, HEROES.enzo.style);

  const play = (seed, rival = RIVAL.badger) => { const m = new Match({ seed, rival, hero: 'enzo' }), me = new Brain(RIVAL.weasel, seed); while (m.winner < 0 && m.tick < TPS * 600) m.step(me.step(m.a)); return m; };
  const one = play(11), two = play(11), other = play(12);
  assert.ok(one.winner >= 0, 'a round ends');
  assert.deepEqual([one.winner, one.tick, one.a.score, one.b.score, [...one.a.grid]], [two.winner, two.tick, two.a.score, two.b.score, [...two.a.grid]], 'a seed replays a round exactly');
  assert.notDeepEqual([one.tick, one.a.score], [other.tick, other.b.score]);
  assert.deepEqual(one.a.bag, one.b.bag, 'both boards are dealt from one bag');
  assert.equal(one.a.cfg.style, RIVAL.badger.style, 'dust lands the way its sender throws it');
  assert.equal(one.b.cfg.style, 'pile');
  const loser = one.winner === 0 ? one.b : one.a;
  assert.ok(loser.lost && loser.grid[SPAWN_Y * W + SPAWN_X], 'the loser topped out');
  const before = one.tick; one.step(); assert.equal(one.tick, before);
  // A rival walks its pair like a player: never more than one press a tick, and it gets where it meant to.
  const solo = new Board(new Bag(5, 4), { gravity: RIVAL.cougar.gravity, colours: 4, style: 'sprinkle' }, 5), head = new Brain(RIVAL.cougar, 5);
  let hits = 0, tries = 0;
  for (let i = 0; i < TPS * 90 && solo.phase !== 'over'; i++) {
    const plan = head.plan, p = solo.pair && { ...solo.pair }, input = head.step(solo);
    assert.ok(!(input.dx && input.rot), 'one press a tick');
    solo.step(input);
    if (p && plan && !solo.pair) { tries++; if (p.x === plan.x && p.rot === plan.rot) hits++; }
  }
  assert.ok(tries > 10 && hits >= tries * 0.9, `the cougar puts pairs where it planned (${hits}/${tries})`);
  assert.ok(solo.best >= 4, `and builds a real chain (${solo.best})`);
}

// ---------- Endless ----------
{
  assert.ok(endlessGravity(1) < endlessGravity(5) && endlessGravity(40) === 0.5);
  const e = new Endless(3), me = new Brain(RIVAL.badger, 3);
  let level = 1, dustAt = 0;
  while (!e.over && e.board.tick < TPS * 1200) {
    e.step(me.step(e.board));
    if (e.level !== level) { level = e.level; assert.equal(level, 1 + Math.floor(e.board.placed / ENDLESS_STEP)); if (e.board.pending && !dustAt) dustAt = level; }
  }
  assert.ok(e.over, 'endless ends in the end');
  assert.ok(e.level >= 5, `the bot got some way (${e.level})`);
  assert.equal(dustAt, ENDLESS_DUST_FROM, 'dust starts blowing in at level four');
  assert.equal(e.board.rival, null);
}

// ---------- Lessons ----------
{
  assert.equal(LESSONS.length, 12);
  assert.equal(new Set(LESSONS.map((l) => l.id)).size, 12);
  for (const l of LESSONS) {
    assert.ok(l.title && l.idea && l.hint && goalText(l.goal));
    const start = gridFrom(l.rows), settled = start.slice();
    assert.equal(collapse(settled), 0, `${l.id}: nothing is floating`);
    assert.equal(findPops(start), null, `${l.id}: nothing pops before you move`);
    const ways = solve(l, 400);
    assert.ok(ways.length > 0, `${l.id}: can be done`);
    // Play the first answer through a real board, key by key.
    const d = new Drill(l);
    for (const q of ways[0]) { assert.ok(!d.done, `${l.id}: not done early`); place(d.board, q.x, q.rot); }
    until(d.board, () => d.done || d.failed);
    assert.ok(d.done && !d.failed, `${l.id}: the answer works on the board`);
    // And a pair dropped straight down every time does not happen to solve the harder ones.
    const lazy = new Drill(l);
    while (lazy.board.phase !== 'over' && !lazy.done) { falling(lazy.board); if (lazy.board.phase === 'over') break; lazy.board.step({ plunge: true }); until(lazy.board, (k) => k.phase !== 'fall'); falling(lazy.board); }
    if (l.id !== 'four') assert.ok(lazy.failed || !lazy.done, `${l.id}: needs a thought`);
  }
  const d = new Drill(LESSONS[0]);
  assert.equal(d.pairsLeft, 1);
  falling(d.board);
  assert.equal(d.pairsLeft, 1);
  for (let i = 0; i < 3; i++) d.board.step({ dx: 1 });
  d.board.step({ plunge: true });
  until(d.board, (k) => k.phase === 'over');
  assert.ok(d.failed && d.pairsLeft === 0, 'out of pairs with the goal unmet is a miss');
  const chains = LESSONS.map((l) => ('chain' in l.goal ? l.goal.chain : 0));
  assert.equal(Math.max(...chains), 5);
}

console.log('Poof Panic engine checks passed.');
