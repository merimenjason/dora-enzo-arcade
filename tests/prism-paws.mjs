// Prism Paws engine checks: every piece bends light the right way, colours mix like light, lanterns, kits, burrows and
// loops behave, the solver proves every level (par, a winning arrangement through the real actions, the firefly), and
// stars and saves work.
import assert from 'node:assert/strict';
import {
  PrismGame, LEVELS, CHAPTERS, TRAY, TRAY_INFO, COLOURS, SAVE_KEY, ROSE, LEAF, SKY, HONEY, PLUM, MINT, MOONWHITE,
  MIRROR_A, MIRROR_B, SPLIT_A, SPLIT_B, GLASS_ROSE, GLASS_LEAF, GLASS_SKY, PRISM, DX, DY,
  parseLevel, trace, probe, search, solveLevel, solveFresh, reflect, kindOf, readProfile, freshProfile, record, unlocked, totalStars, allSolved, nextUnsolved, levelIndex,
} from '../.checks/prism-paws-game.js';

let checks = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); checks++; };
const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); checks++; };
/** A little test level. */
const lvl = (grid, o = {}) => ({ id: 'test', name: 'Test', chapter: 0, par: 0, tray: {}, grid, ...o });
/** What a lantern receives with these pieces on the board. */
const recv = (grid, pieces = {}, o = {}) => {
  const b = parseLevel(lvl(grid, o)), arr = Int8Array.from(b.fixed);
  for (const [xy, code] of Object.entries(pieces)) { const [x, y] = xy.split(',').map(Number); arr[y * b.w + x] = code; }
  return trace(b, arr);
};

// ---- optics: every piece, every direction
const E = 0, S = 1, W = 2, N = 3;
eq([E, S, W, N].map((d) => reflect(MIRROR_A, d)), [N, W, S, E], '/ turns east to north, south to west, west to south, north to east');
eq([E, S, W, N].map((d) => reflect(MIRROR_B, d)), [S, E, N, W], '\\ turns east to south, south to east, west to north, north to west');
eq([DX, DY], [[1, 0, -1, 0], [0, 1, 0, -1]], 'directions run east, south, west, north');
// a moon window in the middle shining each way, a mirror one step on, and lanterns round the edge
const ring = (d, code) => {
  const arrow = '>v<^'[d], g = ['wwwww', 'w...w', 'w.' + arrow + '.w', 'w...w', 'wwwww'].map((r) => r.split(''));
  const t = recv(g.map((r) => r.join('')), { [`${2 + DX[d]},${2 + DY[d]}`]: code });
  const b = parseLevel(lvl(g.map((r) => r.join(''))));
  return b.lanterns.map((L, k) => t.recv[k] ? `${L.x},${L.y}:${t.recv[k]}` : '').filter(Boolean).sort();
};
for (const d of [E, S, W, N]) {
  const m = 2 + DX[d], n = 2 + DY[d];
  for (const code of [MIRROR_A, MIRROR_B]) {
    const out = reflect(code, d), lit = ring(d, code);
    ok(lit.length === 1 && lit[0].endsWith(':7'), `a mirror sends the whole beam one way (dir ${d}, code ${code}): ${lit}`);
    // the lit lantern lies in the reflected direction from the mirror
    const [lx, ly] = lit[0].split(':')[0].split(',').map(Number);
    ok(Math.sign(lx - m) === DX[out] && Math.sign(ly - n) === DY[out], `mirror ${code} sends direction ${d} to ${out}`);
  }
  for (const code of [SPLIT_A, SPLIT_B]) {
    const lit = ring(d, code), out = reflect(code, d);
    ok(lit.length === 2, `a crystal pane passes and reflects (dir ${d}): ${lit}`);
    const dirs = lit.map((s) => { const [lx, ly] = s.split(':')[0].split(',').map(Number); return [Math.sign(lx - m), Math.sign(ly - n)].join(); });
    ok(dirs.includes([DX[d], DY[d]].join()) && dirs.includes([DX[out], DY[out]].join()), `pane ${code} goes on ${d} and turns to ${out}`);
  }
  const p = ring(d, PRISM).map((s) => s.split(':')).map(([xy, c]) => { const [lx, ly] = xy.split(',').map(Number); return [[Math.sign(lx - m), Math.sign(ly - n)].join(), Number(c)]; });
  const left = (d + 3) % 4, right = (d + 1) % 4;
  ok(p.length === 3, `a prism fans moonwhite into three (dir ${d})`);
  ok(p.some(([v, c]) => v === [DX[left], DY[left]].join() && c === ROSE), `rose turns left of ${d}`);
  ok(p.some(([v, c]) => v === [DX[d], DY[d]].join() && c === LEAF), `leaf goes straight on ${d}`);
  ok(p.some(([v, c]) => v === [DX[right], DY[right]].join() && c === SKY), `sky turns right of ${d}`);
}
// glass keeps only its colour, and stops a beam with none of it
eq(recv(['>..w'], { '1,0': GLASS_ROSE }).recv, [ROSE], 'rose glass makes moonwhite rose');
eq(recv(['>..w'], { '1,0': GLASS_LEAF, '2,0': GLASS_SKY }).recv, [0], 'leaf then sky glass leaves nothing');
eq(recv(['>..w'], { '1,0': GLASS_SKY }, { sources: [ROSE] }).recv, [0], 'sky glass stops a rose beam');
eq(recv(['>..w'], { '1,0': PRISM }, { sources: [LEAF] }).recv, [LEAF], 'a prism lets a leaf beam straight through');
eq(recv(['....w', '>..*.'], { '2,1': PRISM }, { sources: [SKY] }).recv, [0], 'a prism turns a sky beam right (south, off the board)');

// ---- colours mix like light at a lantern
eq(Object.keys(COLOURS).map(Number), [1, 2, 3, 4, 5, 6, 7], 'seven colours');
eq([HONEY, PLUM, MINT, MOONWHITE], [ROSE | LEAF, ROSE | SKY, LEAF | SKY, ROSE | LEAF | SKY], 'honey, plum, mint and moonwhite mix from rose, leaf and sky');
eq(['Rose', 'Leaf', 'Honey', 'Sky', 'Plum', 'Mint', 'Moonwhite'], [1, 2, 3, 4, 5, 6, 7].map((c) => COLOURS[c].name), 'colour names');
{
  const t = recv(['>.y', '...', '..^'], { '1,0': GLASS_ROSE, '2,1': GLASS_LEAF }, { sources: [MOONWHITE, MOONWHITE] });
  ok(t.recv[0] === HONEY && t.lit[0] && t.won, 'rose from one side and leaf from another light a honey lantern');
  const half = recv(['>.y', '...', '..^'], { '1,0': GLASS_ROSE, '2,1': GLASS_ROSE });
  ok(half.recv[0] === ROSE && !half.lit[0], 'rose alone leaves a honey lantern unlit');
  const bright = recv(['>..r']);
  ok(bright.recv[0] === MOONWHITE && !bright.lit[0] && !bright.won, 'too bright: moonwhite does not light a rose lantern');
  const extra = recv(['>.y', '...', '..^'], { '1,0': GLASS_ROSE });
  ok(extra.recv[0] === MOONWHITE && !extra.lit[0], 'too much colour from a second beam spoils a honey lantern');
  ok(recv(['>..w']).won, 'moonwhite lights a moonwhite lantern');
}

// ---- kits, the firefly, rocks, flowers, burrows and loops
{
  const t = recv(['>.zw']);
  ok(t.woke[0] && !t.won && t.recv[0] === 0, 'a kit stops the beam, wakes up and spoils the win');
  ok(recv(['>z..', '...w'], {}).woke[0], 'a kit in the way wakes');
  ok(!recv(['>..w', '.z..']).woke[0], 'a kit out of the light keeps sleeping');
  ok(recv(['>*.w']).firefly && recv(['>*.w']).won, 'light passes the firefly and catches it');
  ok(!recv(['>..w', '.*..']).firefly, 'a firefly out of the light stays free');
  eq(recv(['>.#w']).recv, [0], 'rocks stop light');
  eq(recv(['>,,w']).recv, [MOONWHITE], 'light crosses clover');
  const b = recv(['>1..', '....', '..1w']);
  ok(b.recv[0] === MOONWHITE, 'a beam into one burrow leaves its partner going the same way');
  const pairs = recv(['>1..2w', '......', '2...1.']);
  ok(pairs.recv[0] === 0, 'a beam from burrow 1 comes out of the other 1, not a 2');
  // a crystal pane feeding a ring of mirrors that leads back into it: the light goes round once and stops
  const loop = recv(['.....', '>....', '.....', '.....', '....w'], { '1,1': SPLIT_A, '3,1': MIRROR_B, '3,3': MIRROR_A, '1,3': MIRROR_B });
  ok(loop.segs.length > 0 && loop.segs.length < 20, `a loop of light stops repeating (${loop.segs.length} segments)`);
  // the solver's step-by-step light matches the drawn light
  for (const [i, L] of LEVELS.entries()) {
    const B = parseLevel(L), sol = solveFresh(i), arr = Int8Array.from(B.fixed);
    for (const p of [...sol.turn, ...sol.place]) arr[p.y * B.w + p.x] = p.code;
    const a = trace(B, arr, false), q = probe(B, arr);
    ok(a.won === q.won && a.firefly === q.firefly && a.beamed.every((v, k) => v === q.beamed[k]), `${L.id}: both tracers agree on the solved board`);
    const z = trace(B, B.fixed, false), y = probe(B, B.fixed);
    ok(z.won === y.won && z.beamed.every((v, k) => v === y.beamed[k]), `${L.id}: both tracers agree on the starting board`);
  }
}

// ---- the levels
ok(LEVELS.length === 32, 'thirty-two levels');
ok(CHAPTERS.length === 4, 'four chapters');
eq(CHAPTERS.map((_, c) => LEVELS.filter((l) => l.chapter === c).length), [8, 8, 8, 8], 'eight levels a chapter');
ok(LEVELS.every((l, i) => i === 0 || l.chapter >= LEVELS[i - 1].chapter), 'levels go chapter by chapter');
ok(new Set(LEVELS.map((l) => l.id)).size === 32 && new Set(LEVELS.map((l) => l.name)).size === 32, 'every level has its own id and name');
const rows = [];
let total = 0;
for (const [i, L] of LEVELS.entries()) {
  const b = parseLevel(L);
  ok(b.w <= 9 && b.h <= 7, `${L.id}: fits 9 × 7`);
  ok(b.lanterns.length > 0 && b.sources.length > 0, `${L.id}: has moon windows and lanterns`);
  ok(b.firefly.x >= 0 && L.grid.join('').split('*').length === 2, `${L.id}: exactly one firefly`);
  ok(!b.sources.some((s) => b.lanterns.some((l) => l.x === s.x + DX[s.d] && l.y === s.y + DY[s.d])), `${L.id}: no moon window shines straight into a lantern next to it`);
  ok(Object.keys(L.tray).every((k) => TRAY.includes(k)), `${L.id}: known tray pieces`);
  ok(levelIndex(L.id) === i, `${L.id}: found by id`);
  const g = new PrismGame(i);
  ok(!g.won, `${L.id}: not already won at the start`);
  const t0 = performance.now(), r = solveLevel(i), ms = performance.now() - t0; total += ms;
  const tray = TRAY.reduce((a, k) => a + (L.tray[k] ?? 0), 0);
  ok(r.solvable, `${L.id}: the solver solves it`);
  ok(r.par === L.par, `${L.id}: par is ${r.par} (listed ${L.par})`);
  ok(r.par <= tray, `${L.id}: par ${r.par} fits the tray of ${tray}`);
  ok(r.firefly && r.fireflyPar === r.par, `${L.id}: the firefly can be caught at par (firefly par ${r.fireflyPar})`);
  // the firefly solution, played through the public actions, wins with three stars
  for (const s of r.fireflySolution.turn) ok(g.rotate(s.x, s.y), `${L.id}: turns ${s.x},${s.y}`);
  for (const p of r.fireflySolution.place) ok(g.place(p.x, p.y, kindOf(p.code), p.code), `${L.id}: places at ${p.x},${p.y}`);
  ok(g.won && g.events.some((e) => e.kind === 'win'), `${L.id}: the solution wins through the actions`);
  eq(g.stars(), { solved: true, firefly: true, thrifty: true, stars: 3, used: r.par, par: r.par }, `${L.id}: three stars`);
  // one piece fewer never wins
  if (r.par > 0) {
    const turnable = [...b.turnable.keys()].filter((k) => b.turnable[k]);
    const less = search(b, b.fixed, TRAY.map((k) => L.tray[k] ?? 0), turnable, { maxPieces: r.par - 1 });
    ok(less.complete && !less.solvable, `${L.id}: nothing wins with ${r.par - 1} pieces`);
  }
  rows.push(`${String(i + 1).padStart(2)}  ${L.name.padEnd(20)} par ${r.par}  tray ${tray}  firefly par ${r.fireflyPar}  ${ms.toFixed(0).padStart(4)} ms`);
}
console.log(rows.join('\n'));
console.log(`all 32 levels solved in ${total.toFixed(0)} ms`);
ok(total < 4000, `the solver is quick (${total.toFixed(0)} ms for every level)`);
// each chapter brings its pieces and terrain
const uses = (c, test) => LEVELS.filter((l) => l.chapter === c).some(test);
ok(LEVELS.filter((l) => l.chapter === 0).every((l) => Object.keys(l.tray).every((k) => k === 'mirror')), 'the meadow only uses mirrors');
ok(uses(0, (l) => l.grid.join('').includes('[') && !Object.keys(l.tray).length), 'the meadow starts with mirrors to turn and no tray');
ok(uses(0, (l) => l.grid.join('').includes('z')) && uses(0, (l) => parseLevel(l).sources.length === 2), 'the meadow brings kits and two moon windows');
ok(uses(1, (l) => (l.tray.rose ?? 0) + (l.tray.leaf ?? 0) + (l.tray.sky ?? 0) > 0) && uses(1, (l) => /[ypm]/.test(l.grid.join(''))), 'candy glass and mixed lanterns in chapter two');
ok(uses(2, (l) => l.tray.splitter) && uses(2, (l) => l.tray.prism), 'panes and prisms in the grotto');
ok(uses(3, (l) => /1/.test(l.grid.join(''))) && /[rgbypmw]/.test(LEVELS[31].grid.join('')), 'burrows on festival night');
eq(new Set(parseLevel(LEVELS[31]).lanterns.map((l) => l.c)).size, 7, 'the grand finale lights a lantern of every colour');

// ---- playing: placing, turning, picking up, moving, undo and reset
{
  const g = new PrismGame(2); // Pocket Mirror: one mirror
  ok(!g.place(1, 1, 'mirror'), 'no piece on a moon window');
  ok(!g.place(0, 4, 'mirror'), 'no piece on clover');
  ok(!g.place(5, 2, 'mirror'), 'no piece on the firefly');
  ok(!g.place(3, 3, 'prism'), 'only pieces in the tray');
  ok(g.place(5, 1, 'mirror', MIRROR_A) && g.used === 1 && g.left[0] === 0, 'a mirror goes on the grass');
  ok(!g.won && !g.place(4, 1, 'mirror'), 'the tray runs out');
  ok(g.rotate(5, 1) && g.pieces[g.at(5, 1)] === MIRROR_B && g.won, 'turning it lights the lantern');
  ok(g.stars().stars === 3, 'firefly on the way and par: three stars');
  ok(g.move(5, 1, 3, 2) && !g.won && g.pieces[g.at(3, 2)] === MIRROR_B, 'moving keeps how it was turned');
  ok(g.undo() && g.won && g.pieces[g.at(5, 1)] === MIRROR_B, 'undo puts it back');
  ok(g.lift(5, 1) && g.left[0] === 1 && g.used === 0 && !g.won, 'picking it up returns it to the tray');
  ok(g.undo() && g.won, 'undo the pick-up');
  ok(g.reset() && g.used === 0 && !g.won && g.left[0] === 1, 'reset clears the board');
  ok(g.undo() && g.won, 'and undo brings the board back');
  let n = 0; while (g.undo()) n++;
  ok(n === 2 && !g.canUndo && g.used === 0, `undo goes all the way back (${n} steps)`);
  const f = new PrismGame(0); // First Light: a fixed mirror that turns
  ok(!f.lift(4, 1) && !f.canLift(4, 1), 'fixed pieces cannot be picked up');
  ok(f.canTurn(4, 1) && f.rotate(4, 1) && f.won, 'a fixed mirror with an arrow turns');
  const lock = new PrismGame(31);
  ok(!lock.canTurn(7, 2) && !lock.rotate(7, 2), 'a locked prism stays put');
  const k = new PrismGame(4); // Tiptoe Around: a kit in the beam
  ok(k.place(2, 2, 'mirror', MIRROR_A) && k.events.some((e) => e.kind === 'place'), 'placing reports itself');
  ok(!k.traced.woke[0] && k.lift(2, 2) && k.traced.woke[0] && k.events.some((e) => e.kind === 'wake'), 'lifting the mirror lets the light wake the kit');
  // stars: missing the firefly and over par
  const s = new PrismGame(4);
  for (const p of [{ x: 1, y: 2, code: MIRROR_A }, { x: 1, y: 0, code: MIRROR_A }, { x: 6, y: 0, code: MIRROR_B }]) s.place(p.x, p.y, 'mirror', p.code);
  eq(s.stars(), { solved: true, firefly: false, thrifty: true, stars: 2, used: 3, par: 3 }, 'two stars without the firefly');
  const o = new PrismGame(6); // Clover Maze: a spare mirror in the tray
  o.place(4, 0, 'mirror', MIRROR_A);
  for (const p of solveFresh(6).place) o.place(p.x, p.y, 'mirror', p.code);
  ok(o.won && o.stars().thrifty === false && o.stars().stars === 2, 'a spare piece left on the board is over par');
}

// ---- hints
{
  const g = new PrismGame(12); // Too Bright
  const h = g.hint();
  ok(h.kind === 'place', 'a hint from a clear board says where a piece goes');
  ok(g.place(h.x, h.y, kindOf(h.code), h.code), 'and that piece can go there');
  let n = 0; while (!g.won && n++ < 6) { const x = g.hint(); if (x.kind === 'place') g.place(x.x, x.y, kindOf(x.code), x.code); else if (x.kind === 'turn') g.rotate(x.x, x.y); }
  ok(g.won && g.used === LEVELS[12].par, 'following hints wins at par');
  ok(g.hint().kind === 'won', 'no hint once it is won');
  const t = new PrismGame(1); // turn-only level
  const th = t.hint();
  ok(th.kind === 'turn', 'a hint can say which piece to turn');
  const stuck = new PrismGame(2);
  stuck.place(2, 1, 'mirror', MIRROR_A); // the only mirror sends the light away
  const sh = stuck.hint();
  ok(sh.kind === 'stuck' && sh.fresh && sh.fresh.place.length === 1, 'a board that cannot be finished says so and offers a fresh solution');
  // every level: a hint from the start fits its own board
  for (const [i] of LEVELS.entries()) { const q = new PrismGame(i).hint(); ok(q.kind === 'place' || q.kind === 'turn', `${LEVELS[i].id}: a hint from the start`); }
}

// ---- saving
{
  ok(SAVE_KEY === 'prism-paws-v1', 'the save key is versioned');
  const p = freshProfile();
  ok(unlocked(p, 0) && !unlocked(p, 1) && !unlocked(p, 32) && totalStars(p) === 0 && nextUnsolved(p) === 0, 'a fresh save opens the first level only');
  const news = record(p, 0, { solved: true, firefly: true, thrifty: false, stars: 2, used: 0, par: 0 });
  ok(news.includes('Lanterns relit!') && news.some((n) => n.includes('Bend in the Path')), `news on a first solve (${news})`);
  ok(unlocked(p, 1) && totalStars(p) === 2 && nextUnsolved(p) === 1, 'solving opens the next level');
  record(p, 0, { solved: true, firefly: false, thrifty: false, stars: 1, used: 0, par: 0 });
  ok(p.stars.m1 === 2, 'the best stars are kept');
  eq(record(p, 0, { solved: true, firefly: true, thrifty: true, stars: 3, used: 0, par: 0 }), ['More stars!'], 'more stars are news');
  eq(record(p, 1, { solved: false, firefly: false, thrifty: false, stars: 0, used: 0, par: 0 }), [], 'an unsolved board records nothing');
  ok(record(p, 7, { solved: true, firefly: false, thrifty: false, stars: 1, used: 0, par: 0 }).includes('Candy Glass is open'), 'the last level of a chapter opens the next chapter');
  ok(unlocked(p, 8) && !unlocked(p, 9), 'and its first level');
  p.sound = false; p.level = 8;
  const back = readProfile(JSON.stringify(p));
  eq(back, p, 'a save reads back the same');
  eq(readProfile(null), freshProfile(), 'no save starts fresh');
  eq(readProfile('{bad json'), freshProfile(), 'a broken save starts fresh');
  eq(readProfile(JSON.stringify({ ...p, v: 2 })), freshProfile(), 'a save from another version is ignored');
  eq(readProfile(JSON.stringify({ v: 1, stars: { m1: 9, nope: 3, m2: 'x' }, solved: { m3: 'yes' }, sound: 'loud', level: 99 })), { v: 1, stars: { m1: 3 }, solved: { m1: true }, sound: true, level: 0 }, 'odd values are cleaned up');
  const all = freshProfile(); for (const L of LEVELS) all.solved[L.id] = true;
  ok(allSolved(all) && nextUnsolved(all) === 31, 'every level solved opens the festival');
}
ok(TRAY.every((k) => TRAY_INFO[k].name && TRAY_INFO[k].tip && TRAY_INFO[k].codes.every((c) => kindOf(c) === k)), 'every tray piece has a name, a tip and its codes');
eq([MIRROR_A, MIRROR_B, SPLIT_A, SPLIT_B, GLASS_ROSE, GLASS_LEAF, GLASS_SKY, PRISM].map(kindOf), ['mirror', 'mirror', 'splitter', 'splitter', 'rose', 'leaf', 'sky', 'prism'], 'piece kinds');

console.log(`prism-paws: ${checks} checks passed`);
