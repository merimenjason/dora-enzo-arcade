// Meadowmend's engine: how a tile's edges join up, turning tiles, where a tile may go, matching edges, Perfects
// (rocks and the valley's edge count), finished patches and ponds, wishes (at least, exactly, growing past, spoiled),
// one-step undo, exact replay from a seed, snapshots and saved runs (corrupt ones included), the end of a run, the
// tutorial's guided first moves, acorns and unlocking, and the daily seed.
// Needs the engine compiled to .checks/ (npm run test:meadow does that).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  MeadowGame, VALLEYS, VALLEY_IDS, TUTORIAL, segments, rotate, parseEdges, key, DIRS, opp, rotations, perfectSpots,
  readSave, freshSave, recordRun, valleyOpen, endlessOpen, acornCount, allMended, dailySeed, SAVE_KEY,
  MATCH, PERFECT_PTS, PERFECT_TILES, CLOSE_PTS, POND_PTS, POND_TILES, WISH_PTS, WISH_TILES, WISH_GROW, WISH_OPEN,
} from '../.checks/meadow-game.js';
import { greedy, naive, playOut } from './meadow-bot-policy.mjs';

let n = 0;
const ok = (name) => { n++; console.log('PASS', name); };
/** An open valley holding only the given cells, with the given tiles to play. */
function board(cells, tiles, radius = 0) {
  const g = new MeadowGame({ kind: 'endless', seed: 7, daily: false });
  g.cells.clear(); g.def = { ...g.def, radius };
  for (const [q, r, e, kind = 'tile'] of cells) g.cells.set(key(q, r), { q, r, kind, e: kind === 'rock' ? [] : parseEdges(e), seg: kind === 'rock' ? [] : segments(parseEdges(e)), closed: [false, false, false, false, false, false], perfect: false, turn: -1, tile: -1 });
  g.stack = tiles.map((t, i) => (typeof t === 'string' ? { id: 900 + i, e: t } : { id: 900 + i, ...t }));
  return g;
}
const evs = (g) => g.events.splice(0);
/** The turn that puts base edge `from` of a tile on side `to`. */
const turnTo = (from, to) => (to - from + 6) % 6;

// ---- how edges join up inside a tile
assert.deepEqual(segments(parseEdges('MMMMMM')), [0, 0, 0, 0, 0, 0]);
{ const s = segments(parseEdges('MSMMSM')); assert.equal(s[1], s[4], 'a stream runs through the middle'); assert.notEqual(s[2], s[0], 'and splits the meadow either side'); assert.equal(s[2], s[3]); assert.equal(s[5], s[0]); }
{ const s = segments(parseEdges('MMWWMM')); assert.equal(s[0], s[5]); assert.equal(s[0], s[4]); assert.equal(s[1], s[0], 'a run that wraps past edge 5 stays whole'); assert.notEqual(s[2], s[0]); }
{ const s = segments(parseEdges('MWMWMW')); assert.equal(new Set(s).size, 6, 'separate patches of one terrain stay apart'); }
assert.deepEqual(rotate(parseEdges('SMMMMM'), 1), parseEdges('MSMMMM'), 'turning moves edge 0 to side 1');
assert.deepEqual(rotate(parseEdges('SMMMMW'), 6), parseEdges('SMMMMW'));
for (let i = 0; i < 6; i++) { const [dq, dr] = DIRS[i], [oq, or] = DIRS[opp(i)]; assert.equal(dq + oq, 0); assert.equal(dr + or, 0); }
ok('edges, patches and turning');

// ---- the valleys deal the same tiles every time, and replay exactly
for (const id of VALLEY_IDS) {
  const a = new MeadowGame({ kind: 'valley', valley: id }), b = new MeadowGame({ kind: 'valley', valley: id });
  assert.deepEqual(a.stack, b.stack, `${id}: the same deal`);
  assert.equal(a.stack.length, VALLEYS[id].tiles);
  assert.ok(a.frontier().length > 0, `${id}: somewhere to start`);
  const [x, y, z] = VALLEYS[id].acorns; assert.ok(x > 0 && x < y && y < z, `${id}: acorn targets go up`);
  for (const t of a.stack) assert.match(t.e, /^[MWHS]{6}$/);
}
{
  const a = new MeadowGame({ kind: 'valley', valley: 'willow' }), b = new MeadowGame({ kind: 'valley', valley: 'willow' });
  for (let i = 0; i < 20; i++) { const m = greedy(a); a.place(...m); b.place(...m); }
  assert.deepEqual(a.snapshot(), b.snapshot(), 'the same placements give the same valley');
  const e1 = new MeadowGame({ kind: 'endless', seed: 5, daily: false }), e2 = new MeadowGame({ kind: 'endless', seed: 6, daily: false });
  assert.notDeepEqual(e1.stack.map((t) => t.e), e2.stack.map((t) => t.e), 'different seeds, different tiles');
  assert.ok(!/Math\.random/.test(readFileSync(new URL('../lib/meadow-game.ts', import.meta.url), 'utf8')), 'no Math.random in the rules');
}
ok('seeded deals and exact replay');

// ---- where a tile can go
{
  const g = new MeadowGame({ kind: 'valley', valley: 'pebble' });
  assert.equal(g.legal(0, 0), false, 'not on a tile');
  assert.equal(g.legal(1, 0), true, 'next to a tile');
  assert.equal(g.legal(5, 5), false, 'not off on its own');
  assert.equal(g.legal(2, -1), false, 'not on a rock');
  assert.equal(g.legal(3, -1), false, 'touching only a rock is not enough');
  assert.equal(g.place(5, 5, 0), false); assert.equal(g.stack.length, VALLEYS.pebble.tiles, 'a refused placement changes nothing');
  const d = new MeadowGame({ kind: 'valley', valley: 'downs' });
  const b = board([[0, 0, 'MMMMMM']], ['MMMMMM'], 1);
  assert.equal(b.legal(2, 0), false, 'nothing past the valley\'s edge');
  assert.equal(b.legal(1, 0), true);
  assert.ok(d.inBounds(5, 0) && !d.inBounds(6, 0));
}
ok('legal cells, rocks and the valley\'s edge');

// ---- matching edges score
{
  const g = board([[0, 0, 'MMMMMM'], [1, 0, 'WWWWWW']], ['MMMMWM']);
  // (1, -1) touches (0, 0) on its side 3 and (1, 0) on its side 2
  const a = g.assess(1, -1, 0);
  assert.equal(a.edges[3], 'match'); assert.equal(a.edges[2], 'miss'); assert.equal(a.matches, 1);
  const b = g.assess(1, -1, turnTo(4, 2));
  assert.equal(b.matches, 2, 'turned so the woods meets the woods'); assert.equal(b.pts, 2 * MATCH);
  assert.ok(g.place(1, -1, turnTo(4, 2)));
  const ev = evs(g);
  assert.equal(ev.filter((e) => e.k === 'match').length, 2); assert.equal(g.score, 2 * MATCH);
  assert.equal(g.stack.length, 0); assert.ok(g.done); assert.ok(ev.some((e) => e.k === 'end'), 'the run ends with the stack');
  // every turn of every tile at a cell is weighed for the hints
  const h = board([[0, 0, 'MMMMMM']], ['WWWMMM']);
  const rs = rotations(h, 1, 0); assert.equal(rs.length, 6); assert.equal(Math.max(...rs.map((x) => x.a.matches)), 1);
}
ok('matching edges');

// ---- Perfects: all six sides filled and matching; a rock or the valley's edge counts as a match
{
  const ring = DIRS.map(([q, r]) => [q, r, 'MMMMMM']);
  const g = board(ring, ['MMMMMM', 'WWWWWW']);
  assert.deepEqual(perfectSpots(g), [[0, 0]], 'the hint finds the hole');
  const a = g.assess(0, 0, 0);
  assert.equal(a.matches, 6); assert.deepEqual(a.perfects, ['0,0']); assert.equal(a.tiles, PERFECT_TILES);
  assert.ok(g.place(0, 0, 0));
  assert.ok(evs(g).some((e) => e.k === 'perfect')); assert.equal(g.cells.get('0,0').perfect, true);
  assert.equal(g.stack.length, 1 + PERFECT_TILES, 'a Perfect adds tiles to the stack');
  assert.ok(g.score >= 6 * MATCH + PERFECT_PTS);
  const w = board(ring.map(([q, r], i) => [q, r, i === 2 ? 'WWWWWW' : 'MMMMMM']), ['MMMMMM']);
  assert.equal(w.assess(0, 0, 0).perfects.length, 0, 'one mismatch spoils it');
  const rk = board([...ring.slice(0, 5), [DIRS[5][0], DIRS[5][1], '', 'rock']], ['MMMMMM']);
  assert.equal(rk.assess(0, 0, 0).perfects.length, 1, 'a rock never spoils a Perfect');
  const edge = board([[0, 0, 'HHHHHH'], [-1, 0, 'HHHHHH'], [-1, 1, 'HHHHHH'], [0, 1, 'HHHHHH']], ['HHHHHH'], 1);
  // (0, -1)... (1, -1) sits on the rim: its outer sides face the valley's edge
  assert.ok(edge.legal(1, -1));
  const e2 = board([[0, 0, 'HHHHHH'], [0, -1, 'HHHHHH'], [1, 0, 'HHHHHH']], ['HHHHHH'], 1);
  assert.equal(e2.assess(1, -1, 0).perfects.includes('1,-1'), true, 'the valley\'s edge never spoils a Perfect');
  // filling a neighbour's last side can make that neighbour Perfect too
  const nb = board([[0, 0, 'MMMMMM'], [1, -1, 'MMMMMM'], [1, 0, 'MMMMMM'], [0, 1, 'MMMMMM'], [-1, 1, 'MMMMMM'], [-1, 0, 'MMMMMM']], ['MMMMMM']);
  const p = nb.assess(0, -1, 0); assert.ok(p.perfects.includes('0,0'), 'the middle tile becomes Perfect');
}
ok('Perfects');

// ---- finished patches and ponds
{
  const g = board([[0, 0, 'MMMMMM']], ['WMMMMM', 'MMMMWM']);
  assert.ok(g.place(1, 0, turnTo(0, 1)));
  const a = g.assess(2, 0, 0);
  assert.equal(a.edges[4], 'match');
  const cl = a.closes.find((c) => c.terrain === 'woods');
  assert.ok(cl, 'the two woods edges close each other'); assert.equal(cl.size, 2); assert.equal(cl.pts, 2 * CLOSE_PTS);
  g.place(2, 0, 0);
  assert.ok(evs(g).some((e) => e.k === 'close' && e.terrain === 'woods'));
  assert.ok(g.cells.get('1,0').closed[1], 'a finished patch is marked');
  assert.equal(g.stats.closes, 1);
  // two springs facing each other make a pond
  const p = board([[0, 0, 'MMMMMM']], ['SMMMMM', 'SMMMMM']);
  p.place(1, 0, turnTo(0, 1)); evs(p);
  const pa = p.assess(2, 0, turnTo(0, 4));
  const pond = pa.closes.find((c) => c.pond);
  assert.ok(pond, 'a stream with every end joined is a pond'); assert.equal(pond.pts, 2 * POND_PTS); assert.equal(pa.tiles, POND_TILES);
  p.place(2, 0, turnTo(0, 4));
  assert.ok(evs(p).some((e) => e.k === 'close' && e.pond)); assert.equal(p.regions.length, 1); assert.equal(p.stats.ponds, 1);
  // a stream that runs into a meadow is no pond
  const q = board([[0, 0, 'MMMMMM']], ['SMMMMM', 'MMMMMM']);
  q.place(1, 0, turnTo(0, 1)); const qa = q.assess(2, 0, 0);
  assert.equal(qa.closes.filter((c) => c.pond).length, 0);
}
ok('finished patches and ponds');

// ---- wishes
{
  const wish = (terrain, size, kind) => ({ e: 'WWWWWW', wish: { terrain, size, kind, edge: 0 } });
  const g = board([[0, 0, 'MMMMMM']], [wish('woods', 2, 'atleast'), 'WWWWWW', 'WWWWWW', 'MMMMMM']);
  g.place(1, 0, 0);
  assert.equal(g.wishes.length, 1); assert.equal(g.wishes[0].state, 'open'); assert.equal(g.wishes[0].animal, 'hedgehog');
  assert.ok(evs(g).some((e) => e.k === 'wish' && e.state === 'new'));
  const before = g.stack.length;
  g.place(2, 0, 0);
  assert.equal(g.wishes[0].state, 'done', 'a woods of 2 grants it');
  assert.ok(evs(g).some((e) => e.k === 'wish' && e.state === 'done'));
  assert.equal(g.stack.length, before - 1 + WISH_TILES.atleast, 'a granted wish adds tiles');
  assert.equal(g.stats.pWish, 2 * WISH_PTS.atleast);
  const s0 = g.score; g.place(3, 0, 0);
  assert.ok(evs(g).some((e) => e.k === 'grow'), 'an at-least woods keeps counting as it grows');
  assert.equal(g.score - s0, WISH_GROW + MATCH);
  // exactly: grows past, and it is spoiled
  const x = board([[0, 0, 'MMMMMM']], [wish('woods', 1, 'exact'), 'WWWWWW', 'MMMMMM']);
  x.place(1, 0, 0); assert.equal(x.wishes[0].state, 'open');
  x.place(2, 0, 0); assert.equal(x.wishes[0].state, 'failed', 'an exact wish grown past is spoiled');
  assert.equal(x.stats.wishesFailed, 1);
  // exactly: finished at just the size
  const y = board([[0, 0, 'MMMMMM']], [{ e: 'WMMMMM', wish: { terrain: 'woods', size: 2, kind: 'exact', edge: 0 } }, 'MMMMWM']);
  y.place(1, 0, turnTo(0, 1)); y.place(2, 0, 0);
  assert.equal(y.wishes[0].state, 'done', 'finished at exactly 2');
  // at least: finished too small, and it is spoiled
  const z = board([[0, 0, 'MMMMMM']], [{ e: 'WMMMMM', wish: { terrain: 'woods', size: 5, kind: 'atleast', edge: 0 } }, 'MMMMWM']);
  z.place(1, 0, turnTo(0, 1)); z.place(2, 0, 0);
  assert.equal(z.wishes[0].state, 'failed', 'a patch finished short of the wish spoils it');
  // the valleys deal wishes now and then, never more than a few open at once
  const v = new MeadowGame({ kind: 'valley', valley: 'clover' });
  let most = 0;
  while (!v.done) { v.place(...greedy(v)); most = Math.max(most, v.openWishes.length); }
  assert.ok(v.wishes.length >= 4, `wishes turn up (${v.wishes.length})`);
  assert.ok(most <= WISH_OPEN, `at most ${WISH_OPEN} open at once (${most})`);
}
ok('wishes');

// ---- undo, snapshots and saved runs
{
  const g = new MeadowGame({ kind: 'valley', valley: 'oak' });
  for (let i = 0; i < 6; i++) g.place(...greedy(g));
  evs(g);
  const snap = g.snapshot();
  assert.equal(g.undo(), true); assert.equal(g.undo(), false, 'only one step of undo');
  const m = greedy(g); g.place(...m); evs(g);
  const before = g.snapshot(); g.undo(); evs(g);
  assert.notDeepEqual(g.snapshot(), before);
  g.place(...m); assert.deepEqual(g.snapshot().cells, before.cells, 'undo then the same move is the same valley');
  void snap;
  const h = MeadowGame.load(JSON.parse(JSON.stringify(g.snapshot())));
  assert.ok(h); assert.deepEqual(h.snapshot(), g.snapshot(), 'a saved run loads back exactly');
  for (let i = 0; i < 5; i++) { const mv = greedy(g); g.place(...mv); h.place(...mv); }
  assert.deepEqual(h.snapshot(), g.snapshot(), 'and plays on the same');
  for (const bad of [null, 3, 'x', {}, { v: 2 }, { ...g.snapshot(), mode: { kind: 'valley', valley: 'moon' } }, { ...g.snapshot(), cells: [{ q: 0, r: 0, kind: 'tile', e: ['lava', 'meadow', 'meadow', 'meadow', 'meadow', 'meadow'] }] }, { ...g.snapshot(), stack: [{ id: 1, e: 'MMMXMM' }] }, { ...g.snapshot(), score: 'lots' }])
    assert.equal(MeadowGame.load(bad), null, `a broken run is refused (${JSON.stringify(bad)?.slice(0, 40)})`);
}
ok('undo, snapshots and saved runs');

// ---- the end of a run: the stack runs out, or a walled valley fills up
{
  const g = playOut(new MeadowGame({ kind: 'valley', valley: 'clover' }), naive(3));
  assert.ok(g.done && g.stack.length === 0);
  assert.equal(g.place(...(g.frontier()[0]), 0), false, 'nothing more to place');
  const small = board([[0, 0, 'MMMMMM']], Array.from({ length: 10 }, () => 'MMMMMM'), 1);
  playOut(small, greedy);
  assert.ok(small.full && small.done, 'a full valley ends the run'); assert.equal(small.cells.size, 7); assert.ok(small.stack.length > 0, 'with tiles to spare');
}
ok('the end of a run');

// ---- the tutorial
{
  const g = new MeadowGame({ kind: 'tutorial' });
  assert.equal(g.stack.length, TUTORIAL.fixed.length); assert.equal(g.current.e, 'MMWWWM');
  assert.equal(g.assess(2, -1, 0).matches, 0, 'the first tile needs turning');
  const best = rotations(g, 2, -1).sort((a, b) => b.value - a.value)[0];
  assert.equal(best.a.matches, 2, 'turned, its meadow meets the meadow');
  g.place(2, -1, best.rot);
  assert.equal(g.assess(0, 0, 0).perfects.length, 1, 'the second tile fills the hole: a Perfect');
  g.place(0, 0, 0); evs(g);
  assert.equal(g.current.wish?.terrain, 'woods', 'the third tile carries a hedgehog\'s wish');
  g.place(...greedy(g)); g.place(...greedy(g));
  assert.equal(g.wishes[0].state, 'done', 'two woods tiles grant it');
  g.place(...greedy(g)); g.place(...greedy(g));
  assert.equal(g.stats.ponds, 1, 'the two springs make a pond');
  playOut(g, greedy);
  assert.ok(g.done); assert.equal(g.acorns(), 0, 'no acorns in the tutorial');
}
ok('the tutorial');

// ---- saves, acorns and unlocking
{
  assert.equal(SAVE_KEY, 'meadow-v1');
  assert.deepEqual(readSave(null), freshSave()); assert.deepEqual(readSave('{oops'), freshSave()); assert.deepEqual(readSave('[1,2]'), freshSave()); assert.deepEqual(readSave('{"v":2}'), freshSave());
  const junk = readSave(JSON.stringify({ v: 1, valleys: { clover: { best: -5, acorns: 9, plays: 'x' }, moon: { best: 3 } }, endless: { best: 1e99 }, daily: { date: 'today', best: 5 }, run: { v: 1, mode: { kind: 'nope' } }, settings: { sound: false } }));
  assert.deepEqual(junk.valleys, { clover: { best: 0, acorns: 3, plays: 0 } }, 'numbers are clamped and unknown valleys dropped');
  assert.equal(junk.endless.best, 1e8); assert.equal(junk.daily.date, ''); assert.equal(junk.run, null, 'a broken run is dropped'); assert.equal(junk.settings.sound, false); assert.equal(junk.settings.music, true);
  const s = freshSave();
  assert.ok(valleyOpen(s, 0) && !valleyOpen(s, 1) && !endlessOpen(s));
  const g = playOut(new MeadowGame({ kind: 'valley', valley: 'clover' }), greedy);
  const r = recordRun(s, g);
  assert.equal(r.acorns, g.acorns()); assert.ok(r.acorns >= 1, 'the greedy bot earns an acorn in Clover Hollow');
  assert.ok(valleyOpen(s, 1) && endlessOpen(s), 'an acorn opens the next valley and the endless modes');
  const low = playOut(new MeadowGame({ kind: 'valley', valley: 'clover' }), naive(1));
  const r2 = recordRun(s, low);
  assert.equal(r2.newAcorns, 0); assert.equal(s.valleys.clover.acorns, r.acorns, 'acorns only go up'); assert.equal(s.valleys.clover.best, g.score); assert.equal(s.valleys.clover.plays, 2);
  const back = readSave(JSON.stringify({ ...s, run: g.snapshot() }));
  assert.deepEqual(back.valleys, s.valleys); assert.ok(back.run, 'a sound run is kept');
  for (const id of VALLEY_IDS) s.valleys[id] = { best: 1, acorns: 1, plays: 1 };
  s.valleys.fen = undefined; delete s.valleys.fen;
  const fen = new MeadowGame({ kind: 'valley', valley: 'fen' }); fen.score = VALLEYS.fen.acorns[0];
  assert.ok(!allMended(s)); const fin = recordRun(s, fen); assert.ok(fin.firstEnding && s.ended && allMended(s), 'the last valley\'s first acorn brings the ending');
  assert.equal(recordRun(s, fen).firstEnding, false, 'only once');
  assert.equal(acornCount(s), 7);
  const d = new MeadowGame({ kind: 'endless', seed: dailySeed('2026-10-30'), daily: true }); d.score = 777;
  assert.ok(recordRun(s, d, '2026-10-30').best); assert.deepEqual(s.daily, { date: '2026-10-30', best: 777 });
  d.score = 500; assert.equal(recordRun(s, d, '2026-10-30').best, false);
  assert.equal(recordRun(s, d, '2026-10-31').best, true, 'a new day, a new daily best'); assert.equal(s.daily.date, '2026-10-31');
  const t = new MeadowGame({ kind: 'tutorial' }); recordRun(s, t); assert.equal(s.tutorial, true);
  assert.equal(dailySeed('2026-10-30'), dailySeed('2026-10-30')); assert.notEqual(dailySeed('2026-10-30'), dailySeed('2026-10-31'));
}
ok('saves, acorns and unlocking');

console.log(`meadow: ${n} groups passed`);
