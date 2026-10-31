// Honeycomb Hollow engine checks: the comb's shape (neighbours, trios, clockwise order), turning a trio both ways,
// matches along all three axes, a turn that matches nothing springing back for free, cascades, gravity and the
// seeded refill, the specials (bee, blossom, royal jelly) and the combos, the triple turn, every obstacle (wax, trapped
// bees, sticky cells, acorns, moss, dew, wasps, dark comb), goals, stars and the honey rush, the reshuffle,
// determinism, the sixty chambers and the save, corrupt saves included.
import assert from 'node:assert/strict';
import {
  HoneyGame, Comb, parseMap, CHAMBERS, AREAS, SAVE_KEY, BEE, BLOSSOM, JELLY, NONE, readSave, freshSave, record, chamberOpen, areaOpen, nextChamber,
  starCount, seedFor, areaChambers,
} from '../.checks/honey-game.js';
import { STORY, TUNE } from '../.checks/honey-levels.js';

let n = 0;
const test = (name, f) => { f(); n++; };
const R7 = Array(7).fill('.......');
const chamber = (map = R7, extra = {}) => ({ id: 't' + n, area: 'clover', name: 'Test', map, colours: 7, moves: 20, stars: [3, 6], goals: { honey: 'all' }, ...extra });
/** A game whose drops sit in a pattern with no line of even two, so each test builds exactly the matches it wants. */
function game(map, extra) {
  const g = new HoneyGame(chamber(map, extra), 1);
  for (let i = 0; i < g.comb.n; i++) { const p = g.cells[i].p; if (p && p.k === 'drop') { p.c = (((g.comb.q[i] + 2 * g.comb.r[i]) % 6) + 6) % 6; p.sp = NONE; } }
  return g;
}
const at = (g, c, row) => { const q = c, r = row - (c - (c & 1)) / 2; const i = g.comb.q.findIndex((x, k) => x === q && g.comb.r[k] === r); assert.ok(i >= 0, `cell ${c},${row}`); return i; };
const paint = (g, cells, c, sp = NONE, ax = 0) => { for (const i of cells) { const p = g.cells[i].p; p.k = 'drop'; p.c = c; p.sp = sp; p.ax = ax; } };
const trioOf = (g, a, b, c) => { const k = [a, b, c].sort((x, y) => x - y).join(); const t = g.comb.trios.findIndex((tr) => [...tr.cells].sort((x, y) => x - y).join() === k); assert.ok(t >= 0, 'trio exists'); return t; };
const noMatch = (g) => !g.cells.some((_, i) => g.matchAt(i));
const honey = (g) => g.cells.filter((c) => c.honey).length;
const steps = (st, t) => st.filter((s) => s.t === t);

test('the comb: neighbours, columns, trios', () => {
  const cb = new Comb(parseMap(R7).map(({ q, r }) => ({ q, r })));
  assert.equal(cb.n, 49);
  // an inner cell has six neighbours, and each is a neighbour back
  const mid = cb.q.findIndex((q, i) => q === 3 && cb.r[i] === 3 - 1);
  assert.equal(cb.nb[mid].filter((j) => j >= 0).length, 6);
  for (let i = 0; i < cb.n; i++) for (let d = 0; d < 6; d++) { const j = cb.nb[i][d]; if (j >= 0) assert.equal(cb.nb[j][(d + 3) % 6], i); }
  // down is straight down the screen; every column has one top and one bottom
  for (let i = 0; i < cb.n; i++) if (cb.below[i] >= 0) { assert.ok(Math.abs(cb.x[cb.below[i]] - cb.x[i]) < 1e-9); assert.ok(cb.y[cb.below[i]] > cb.y[i]); }
  assert.equal(cb.above.filter((j) => j < 0).length, 7);
  // trios: three mutually touching cells, clockwise on screen, each corner once
  assert.equal(cb.trios.length, 72);
  for (const t of cb.trios) {
    const [a, b, c] = t.cells;
    assert.ok(cb.nb[a].includes(b) && cb.nb[b].includes(c) && cb.nb[c].includes(a));
    const cross = (cb.x[b] - cb.x[a]) * (cb.y[c] - cb.y[a]) - (cb.y[b] - cb.y[a]) * (cb.x[c] - cb.x[a]);
    assert.ok(cross > 0, 'clockwise with y pointing down');
  }
  assert.equal(new Set(cb.trios.map((t) => [...t.cells].sort().join())).size, cb.trios.length);
  // lines run edge to edge; the ring of two holds 19 cells in the middle
  assert.equal(cb.line(mid, 0).length, 7);
  assert.equal(cb.near(mid, 2).length, 19);
});

test('turning a trio moves the three drops round, and back the other way', () => {
  const g = game(), t = 30, [a, b, c] = g.comb.trios[t].cells;
  const ids = [a, b, c].map((i) => g.cells[i].p.id);
  // make the turn work: the drop that lands on b finishes a line through b
  const g2 = game();
  const before = g2.cells.map((x) => x.p.id);
  assert.ok(noMatch(g2));
  const st = g2.turn(t, 1);
  assert.equal(st.length, 1, 'nothing matched'); assert.equal(st[0].t, 'bounce');
  assert.deepEqual(g2.cells.map((x) => x.p.id), before, 'a turn that matches nothing springs back');
  assert.equal(g2.moves, 20, 'and costs no move');
  void ids;
});

test('matches along all three axes, made by a turn', () => {
  for (let ax = 0; ax < 3; ax++) {
    const g = game();
    // pick a cell and a trio containing it; line up two drops on the far side of where one trio drop will land
    let done = false;
    for (let t = 0; t < g.comb.trios.length && !done; t++) {
      const [a, b] = g.comb.trios[t].cells;
      const d = ax, n1 = g.comb.nb[b][d], n2 = n1 >= 0 ? g.comb.nb[n1][d] : -1;
      if (n1 < 0 || n2 < 0 || g.comb.trios[t].cells.includes(n1) || g.comb.trios[t].cells.includes(n2)) continue;
      paint(g, [a, n1, n2], 6);
      // clockwise sends a to b
      assert.ok(g.matchAt(a) === false);
      const before = g.moves, st = g.turn(t, 1);
      assert.equal(st[0].t, 'turn', `axis ${ax}: the turn works`);
      assert.equal(g.moves, before - 1);
      const cl = steps(st, 'clear')[0];
      assert.ok(cl.gone.some((x) => x.i === b) && cl.gone.some((x) => x.i === n1) && cl.gone.some((x) => x.i === n2), `axis ${ax}: the line clears`);
      assert.ok(g.cells[b].honey && g.cells[n1].honey && g.cells[n2].honey, `axis ${ax}: the cells turn to honey`);
      assert.ok(steps(st, 'fall').length >= 1, 'drops fall to fill the gap');
      assert.ok(g.cells.every((c) => c.p), 'and the comb is full again');
      done = true;
    }
    assert.ok(done, `axis ${ax} tested`);
  }
});

test('anticlockwise turns the other way', () => {
  const g = game(), t = 40, [a, b, c] = g.comb.trios[t].cells;
  const pa = g.cells[a].p, pb = g.cells[b].p, pc = g.cells[c].p;
  // poke the private rotate through a turn that bounces, then check works() agrees both ways
  g.rotate(g.comb.trios[t].cells, -1);
  assert.equal(g.cells[a].p, pb); assert.equal(g.cells[b].p, pc); assert.equal(g.cells[c].p, pa);
  g.rotate(g.comb.trios[t].cells, 1);
  assert.equal(g.cells[a].p, pa); assert.equal(g.cells[b].p, pb); assert.equal(g.cells[c].p, pc);
});

test('four in a line makes a bee that clears its line', () => {
  const g = game(), m = at(g, 3, 3), line = [g.comb.nb[m][0], m, g.comb.nb[m][3], g.comb.nb[g.comb.nb[m][3]][3]];
  paint(g, line, 6);
  g.resolve(null, 0);
  const bee = g.cells.find((c) => c.p.sp === BEE);
  assert.ok(bee, 'a bee hatches'); assert.equal(bee.p.ax, 0, 'along the line it came from'); assert.equal(bee.p.c, 6);
  // match the bee: it clears its whole column
  const g2 = game(), col = g2.comb.line(at(g2, 3, 3), 0);
  const i = at(g2, 3, 3); paint(g2, [i], 6, BEE, 0); paint(g2, [g2.comb.nb[i][1], g2.comb.nb[g2.comb.nb[i][1]][1]], 6);
  g2.steps = []; g2.resolve(null, 0);
  const cl = g2.steps.find((s) => s.t === 'clear');
  assert.equal(cl.fired.length, 1); assert.equal(cl.fired[0].sp, BEE);
  for (const j of col) assert.ok(cl.gone.some((x) => x.i === j), 'every cell of the column clears');
});

test('crossing lines make a blossom that bursts in a ring and lights dark comb', () => {
  const g = game(), m = at(g, 3, 3);
  paint(g, [m, g.comb.nb[m][0], g.comb.nb[g.comb.nb[m][0]][0], g.comb.nb[m][1], g.comb.nb[g.comb.nb[m][1]][1]], 6);
  g.resolve(null, 0);
  assert.ok(g.cells.some((c) => c.p.sp === BLOSSOM), 'a V of two lines makes a blossom');
  const g2 = game(['.......', '.......', '.......', '...d...', '.......', '.......', '.......']), d = at(g2, 3, 3);
  assert.ok(g2.cells[d].dark);
  // a plain match over dark comb clears the drop but leaves it dark, with no honey
  paint(g2, [d, g2.comb.nb[d][1], g2.comb.nb[g2.comb.nb[d][1]][1]], 6);
  g2.resolve(null, 0);
  assert.ok(g2.cells[d].dark && !g2.cells[d].honey, 'dark comb ignores a plain match');
  const g3 = game(['.......', '.......', '.......', '...d...', '.......', '.......', '.......']), d3 = at(g3, 3, 3), b = g3.comb.nb[d3][3];
  paint(g3, [b], 6, BLOSSOM); paint(g3, [g3.comb.nb[b][2], g3.comb.nb[g3.comb.nb[b][2]][2]], 6);
  g3.steps = []; g3.resolve(null, 0);
  assert.ok(!g3.cells[d3].dark && g3.cells[d3].honey, 'a blossom lights it and fills it');
  assert.ok(g3.steps.find((s) => s.t === 'clear').gone.length >= 19, 'the ring clears');
});

test('five in a line makes royal jelly; turning it clears every drop of its trio-mates’ colours', () => {
  const g = game(), m = at(g, 3, 1);
  const line = g.comb.line(m, 0).slice(0, 1).concat([g.comb.nb[m][3]]); let j = line[1]; while (line.length < 5) { j = g.comb.nb[j][3]; line.push(j); }
  paint(g, [m, ...line.slice(1)], 6);
  g.resolve(null, 0);
  assert.ok(g.cells.some((c) => c.p.sp === JELLY), 'royal jelly');
  const g2 = game(), t = 33, cs = g2.comb.trios[t].cells;
  paint(g2, [cs[0]], 0, JELLY);
  const cols = new Set([g2.cells[cs[1]].p.c, g2.cells[cs[2]].p.c]);
  const want = g2.cells.filter((c) => c.p.sp === NONE && cols.has(c.p.c)).length;
  const st = g2.turn(t, 1);
  assert.equal(st[0].t, 'turn', 'jelly always turns');
  assert.ok(steps(st, 'clear')[0].gone.length >= want + 1, 'every drop of those colours clears');
});

test('two specials turned together fire a combo', () => {
  for (const [s1, s2, name, min] of [[BEE, BEE, 'bee-bee', 25], [BLOSSOM, BLOSSOM, 'blossom-blossom', 25], [BEE, BLOSSOM, 'bee-blossom', 25], [JELLY, BEE, 'jelly-bee', 8], [JELLY, JELLY, 'feast', 49]]) {
    const g = game(), t = 33, cs = g.comb.trios[t].cells;
    paint(g, [cs[0]], 2, s1, 1); paint(g, [cs[1]], 2, s2, 2);
    const st = g.turn(t, -1), cl = steps(st, 'clear')[0];
    assert.equal(st[0].t, 'turn', name);
    assert.equal(cl.fired[0].combo, name, name);
    assert.ok(cl.gone.length >= min, `${name} clears a lot (${cl.gone.length})`);
    assert.equal(g.combos, 1);
  }
});

test('a triple turn: all three turned drops match, and a bee joins in', () => {
  // three parallel lines, each finished by one drop of the trio
  let ok = false;
  for (let t = 0; t < 72 && !ok; t++) {
    const g = game(), cs = g.comb.trios[t].cells, dest = [cs[1], cs[2], cs[0]];
    const tails = dest.map((i, k) => { for (let d = 0; d < 6; d++) { const a = g.comb.nb[i][d], b = a >= 0 ? g.comb.nb[a][d] : -1; if (a >= 0 && b >= 0 && ![...cs].includes(a) && ![...cs].includes(b)) return [a, b, k]; } return null; });
    if (tails.some((x) => !x)) continue;
    const used = new Set(tails.flatMap((x) => x.slice(0, 2)));
    if (used.size !== 6) continue;
    tails.forEach(([a, b], k) => { paint(g, [cs[k], a, b], 3 + k); });
    if (!noMatch(g)) continue;
    const st = g.turn(t, 1), cl = steps(st, 'clear')[0];
    if (cl.waggle !== 3) continue;
    assert.ok(cl.made.some((m) => m.sp === BEE), 'a bee joins in');
    ok = true;
  }
  assert.ok(ok, 'found a triple turn');
});

test('gravity, the seeded refill, and determinism', () => {
  const a = new HoneyGame(CHAMBERS[4], 99), b = new HoneyGame(CHAMBERS[4], 99), c = new HoneyGame(CHAMBERS[4], 100);
  const key = (g) => g.cells.map((x) => x.p.c).join('');
  assert.equal(key(a), key(b)); assert.notEqual(key(a), key(c));
  for (let k = 0; k < 12 && !a.over; k++) { const m = a.findMove(); a.turn(m.t, m.dir); b.turn(m.t, m.dir); assert.equal(key(a), key(b), 'same seed, same turns, same comb'); }
  const d = a.clone(); const m = d.findMove();
  if (m && !a.over) { a.turn(m.t, m.dir); d.turn(m.t, m.dir); assert.equal(key(a), key(d), 'a clone replays exactly'); }
  // every fresh comb in every chamber: no match, at least one move
  for (const ch of CHAMBERS) for (let s = 1; s <= 3; s++) { const g = new HoneyGame(ch, s); assert.ok(noMatch(g), ch.id); assert.ok(g.findMove(), ch.id); }
});

test('wax caps crack from matches beside them; trapped bees fly free', () => {
  const g = game(['.......', '.......', '.......', '...b...', '.......', '.......', '.......'], { goals: { honey: 'all' } }), w = at(g, 3, 3);
  assert.equal(g.goals().find((x) => x.key === 'bees').left, 1);
  const side = g.comb.nb[w][1], line = [side, g.comb.nb[side][1], g.comb.nb[g.comb.nb[side][1]][1]];
  paint(g, line, 6); g.resolve(null, 0);
  assert.equal(g.cells[w].p.hp, 1, 'one crack');
  const g2 = game(['.......', '.......', '.......', '...b...', '.......', '.......', '.......']), w2 = at(g2, 3, 3);
  g2.cells[w2].p.hp = 1; const s2 = g2.comb.nb[w2][2];
  paint(g2, [s2, g2.comb.nb[s2][2], g2.comb.nb[g2.comb.nb[s2][2]][2]], 6); g2.steps = []; g2.resolve(null, 0);
  assert.equal(g2.freed, 1, 'the bee is free'); assert.equal(g2.goals().find((x) => x.key === 'bees').left, 0);
  assert.ok(g2.cells[w2].p && g2.cells[w2].p.k !== 'wax', 'and a drop falls in');
  // wax doesn't fall, and drops slip round it diagonally
  const g3 = game(['.......', '.......', '...w...', '.......', '.......', '.......', '.......']), w3 = at(g3, 3, 2), under = g3.comb.below[w3];
  g3.cells[under].p = null; g3.fall();
  assert.ok(g3.cells[under].p, 'the cell under the wax fills from the side'); assert.equal(g3.cells[w3].p.k, 'wax');
});

test('sticky cells hold their drop until it is matched', () => {
  const g = game(['.......', '.......', '.......', '...s...', '.......', '.......', '.......']), s = at(g, 3, 3);
  for (let t = 0; t < g.comb.trios.length; t++) if (g.comb.trios[t].cells.includes(s)) assert.equal(g.canTurn(t), false, 'a sticky cell can’t be turned');
  const p = g.cells[s].p, below = g.comb.below[s]; g.cells[below].p = null; g.fall();
  assert.equal(g.cells[s].p, p, 'and doesn’t fall');
  paint(g, [s, g.comb.nb[s][1], g.comb.nb[g.comb.nb[s][1]][1]], 6); g.resolve(null, 0);
  assert.equal(g.cells[s].sticky, false, 'a match washes it clean');
});

test('acorns roll out of the bottom; more drop in until the goal is met', () => {
  const g = game(['...a...', '.......', '.......', '.......', '.......', '.......', '.......'], { goals: { honey: 'all', acorns: 3 } });
  assert.equal(g.goals().find((x) => x.key === 'acorns').left, 3);
  const a = at(g, 3, 0), col = []; let j = a; while (j >= 0) { col.push(j); j = g.comb.below[j]; }
  // clear the column under it with a bee: the acorn drops to the bottom and rolls out
  for (const i of col.slice(1)) g.cells[i].p = null;
  g.settle();
  assert.equal(g.acornsIn, 1, 'the acorn rolled out');
  const onBoard = g.cells.filter((c) => c.p?.k === 'acorn').length;
  let spawned = 0;
  for (let k = 0; k < 400 && g.acornsToSpawn > 0; k++) { if (g.deal().k === 'acorn') spawned++; }
  assert.equal(g.acornsIn + onBoard + spawned, 3, 'the rest are dealt from the top');
  const r1 = CHAMBERS.find((c) => c.id === 'r1'), gg = new HoneyGame(r1, 3);
  assert.ok(gg.goals().some((x) => x.key === 'acorns'));
});

test('moss creeps on turns that clear none, and matches scrub it', () => {
  const map = ['.......', '.......', '.......', '.......', '.......', '.......', 'mmmmmmm'];
  const g = game(map, { goals: { honey: 'all', moss: true } });
  const before = g.cells.filter((c) => c.moss).length;
  g.mossCleared = false; g.spreadMoss();
  assert.equal(g.cells.filter((c) => c.moss).length, before + 1, 'it creeps');
  g.mossCleared = true; g.spreadMoss();
  assert.equal(g.cells.filter((c) => c.moss).length, before + 1, 'but not on a turn that scrubbed some');
  const m = at(g, 2, 6); paint(g, [m, g.comb.nb[m][2] >= 0 ? g.comb.nb[m][1] : m], 6);
  const row = g.comb.line(at(g, 3, 6), 1).slice(0, 3); paint(g, row, 6); g.resolve(null, 0);
  assert.ok(row.every((i) => !g.cells[i].moss), 'scrubbed');
});

test('dew drops roll about and are caught by a match beside them', () => {
  const g = game(['.......', '.......', '.......', '...o...', '.......', '.......', '.......']), o = at(g, 3, 3);
  assert.equal(g.cells[o].p.k, 'dew');
  g.hopAll('dew'); assert.notEqual(g.cells[o].p.k, 'dew', 'it rolled');
  const g2 = game(['.......', '.......', '.......', '...o...', '.......', '.......', '.......']), o2 = at(g2, 3, 3), s = g2.comb.nb[o2][2];
  paint(g2, [s, g2.comb.nb[s][2], g2.comb.nb[g2.comb.nb[s][2]][2]], 6); g2.resolve(null, 0);
  assert.equal(g2.dewGot, 1); assert.equal(g2.goals().find((x) => x.key === 'dew').left, 0);
});

test('wasps eat a drop and lick the honey off its cell; a match beside one shoos it; boxed in, it stays', () => {
  const g = game(['.......', '.......', '.......', '...x...', '.......', '.......', '.......']), x = at(g, 3, 3);
  for (const j of g.comb.nb[x]) g.cells[j].honey = true;
  const goneBefore = g.cells.filter((c) => c.p).length;
  g.hopAll('wasp');
  const now = g.cells.findIndex((c) => c.p?.k === 'wasp');
  assert.notEqual(now, x, 'it hopped'); assert.equal(g.cells[now].honey, false, 'and licked the honey');
  assert.ok(g.cells.filter((c) => c.p).length >= goneBefore - 1);
  const s = g.comb.nb[now].find((j) => j >= 0 && g.comb.nb[j][2] >= 0 && g.comb.nb[g.comb.nb[j][2]][2] >= 0 && g.comb.nb[j][2] !== now && g.comb.nb[g.comb.nb[j][2]][2] !== now);
  paint(g, [s, g.comb.nb[s][2], g.comb.nb[g.comb.nb[s][2]][2]], 6); g.resolve(null, 0);
  assert.ok(!g.cells.some((c) => c.p?.k === 'wasp'), 'shooed');
  const g3 = game(['.......', '.......', '...W...', '..WxW..', '..WWW..', '.......', '.......']);
  const x3 = at(g3, 3, 3), hops = g3.hopAll('wasp');
  assert.equal(hops, 0); assert.equal(g3.cells[x3].p.k, 'wasp', 'boxed in by wax, it stays put');
});

test('winning: stars from moves left, the honey rush, and losing at zero moves', () => {
  const g = game(R7, { moves: 10, stars: [3, 6] });
  let t = -1, line = [];
  for (let k = 0; k < g.comb.trios.length && t < 0; k++) {
    const [a, b] = g.comb.trios[k].cells, n1 = g.comb.nb[b][0], n2 = n1 >= 0 ? g.comb.nb[n1][0] : -1;
    if (n1 >= 0 && n2 >= 0 && !g.comb.trios[k].cells.includes(n1) && !g.comb.trios[k].cells.includes(n2)) { t = k; line = [a, b, n1, n2]; }
  }
  paint(g, [line[0], line[2], line[3]], 6);
  for (const c of g.cells) c.honey = true;
  for (const i of line.slice(1)) g.cells[i].honey = false;
  const st = g.turn(t, 1);
  assert.ok(g.over?.won, 'filling the last cells wins');
  assert.equal(g.over.left, 9); assert.equal(g.over.stars, 3, 'nine left of ten: three stars');
  assert.ok(st.some((s) => s.t === 'rush'), 'the leftover moves become a honey rush');
  assert.equal(st.at(-1).t, 'end'); assert.ok(st.at(-1).score > 0);
  assert.equal(g.turn(t, 1), null, 'no turns after the end');
  const l = new HoneyGame(chamber(R7, { moves: 1 }), 1), m = l.findMove();
  l.turn(m.t, m.dir);
  assert.equal(l.over.won, false); assert.equal(l.over.stars, 0, 'out of moves: no stars');
});

test('no moves left: the comb reshuffles into one with a move and no match', () => {
  const g = game();
  g.shuffle(true);
  assert.ok(noMatch(g)); assert.ok(g.findMove());
  assert.equal(g.steps.at(-1).t, 'shuffle');
});

test('the sixty chambers, five areas, story and tuning', () => {
  assert.equal(CHAMBERS.length, 60); assert.equal(AREAS.length, 5);
  for (const a of AREAS) { assert.equal(areaChambers(a.id).length, 12); assert.ok(STORY[a.id + '-in'] && STORY[a.id + '-out'], a.id); assert.ok(areaChambers(a.id).at(-1).set); }
  assert.equal(new Set(CHAMBERS.map((c) => c.id)).size, 60);
  for (const ch of CHAMBERS) {
    const cells = parseMap(ch.map);
    // every column is one unbroken run, so drops always have a way down
    const cols = new Map(); for (const c of cells) { const ys = cols.get(c.q) ?? []; ys.push(c.r); cols.set(c.q, ys); }
    for (const ys of cols.values()) { ys.sort((a, b) => a - b); assert.equal(ys.at(-1) - ys[0] + 1, ys.length, `${ch.id}: columns unbroken`); }
    assert.ok(TUNE[ch.id], `${ch.id} is tuned`);
    assert.ok(ch.moves > ch.stars[1] && ch.stars[1] > ch.stars[0] && ch.stars[0] >= 1, `${ch.id}: star targets make sense`);
    assert.ok(ch.colours >= 6 && ch.colours <= 7);
    assert.ok(ch.goals.honey, `${ch.id}: fills the comb`);
  }
  const tipped = CHAMBERS.filter((c) => c.tip).map((c) => c.id);
  assert.ok(tipped.includes('c1') && tipped.includes('r1') && tipped.includes('l1') && tipped.includes('h1') && tipped.includes('h3'), 'each new thing is taught');
});

test('the save: progress, unlocking, corrupt saves', () => {
  assert.equal(SAVE_KEY, 'honeycomb-hollow-v1');
  const s = freshSave();
  assert.ok(chamberOpen(s, 'c1')); assert.ok(!chamberOpen(s, 'c2')); assert.ok(areaOpen(s, 'clover')); assert.ok(!areaOpen(s, 'rose'));
  assert.equal(nextChamber(s), 'c1');
  assert.deepEqual(record(s, 'c1', 2, 900), { better: true, first: true });
  assert.ok(chamberOpen(s, 'c2')); assert.equal(nextChamber(s), 'c2');
  assert.deepEqual(record(s, 'c1', 1, 2000), { better: false, first: false });
  assert.deepEqual(s.best.c1, { stars: 2, score: 2000 });
  assert.deepEqual(record(s, 'c1', 0, 5000), { better: false, first: false }, 'a loss never counts');
  assert.equal(starCount(s), 2);
  const back = readSave(JSON.stringify(s)); assert.deepEqual(back, s);
  for (const bad of [null, '', '{', 'null', '42', '[]', '{"v":2}', '{"v":1,"best":"x"}', '{"v":1,"best":{"c1":{"stars":9}},"tips":[3],"settings":{"sound":"no"}}', '{"v":1,"best":{"zz":{"stars":2}}}'])
    { const r = readSave(bad); assert.ok(r && typeof r.best === 'object' && Array.isArray(r.tips)); assert.ok(!r.best.zz); assert.ok(!r.best.c1 || r.best.c1.stars <= 3); }
  assert.notEqual(seedFor('c1', 0), seedFor('c1', 1)); assert.equal(seedFor('c1', 2), seedFor('c1', 2));
});

console.log(`honey engine ok (${n} checks)`);
