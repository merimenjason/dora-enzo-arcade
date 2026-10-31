// Paperfold engine checks: folding mirrors the lifted part and stacks it reversed and face-flipped on top (or
// underneath for a mountain crease), the paper is always shifted back to 0,0, a fold never makes the paper bigger,
// holes show the layer below, tape blocks a fold that would part it, creases fold their own way (and the other way
// once the paper is turned over), the picture and its match ignore where the paper lies, undo, reset and the fold
// count, seals, the forty pages and their chapters (the early ones small and short, the later ones up to 6 by 6 and
// eight folds, valley creases taught and then used), the solver (checked against a plain breadth-first search over
// whole paper states, on every page and on random sheets), the hints, unlocking, and saving, corrupt saves included.
import assert from 'node:assert/strict';
import {
  PUZZLES, CHAPTERS, SAVE_KEY, FoldGame, makeSheet, flatPaper, applyFold, checkFold, foldsOf, parseFold, foldText, picture, pictureKey, paperKey,
  topOf, whereIs, solve, puzzle, sealFor, freshSave, readSave, record, chapterOpen, puzzleOpen, nextPuzzle, doneIn, chapterPuzzles, sealCount, pos, rng,
} from '../.checks/fold-game.js';

let checks = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); checks++; };
const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); checks++; };
const spec = (o) => ({ id: 't', chapter: 'lanterns', piece: 'lantern', name: 'T', front: 'red', back: 'gold', sol: [], ...o });
const fold = (sheet, paper, ...ts) => ts.reduce((p, t) => applyFold(sheet, p, parseFold(t)), paper);
const stack = (paper, x, y) => paper.stacks.get(pos(x, y)).map((l) => l.c + l.up);

// ---- fold text
{
  for (const t of ['x1>', 'x3<', 'y2v', 'y1^']) eq(foldText(parseFold(t)), t, `${t} round-trips`);
  assert.throws(() => parseFold('z1>'), /bad fold/); checks++;
}

// ---- one fold: mirror, flip, stack on top, shift back to 0,0
{
  const sh = makeSheet(spec({ grid: ['##'], marks: ['1 0 b window'] })), p0 = flatPaper(sh);
  eq([p0.w, p0.h], [2, 1], 'a 2 by 1 sheet');
  const left = applyFold(sh, p0, parseFold('x1<'));
  eq([left.w, left.h], [1, 1], 'folded in half');
  eq(stack(left, 0, 0), ['0f', '1b'], 'the right square lands face down on top');
  eq(topOf(sh, left.stacks.get(pos(0, 0))), { colour: 'gold', mark: 'window' }, 'its gold back shows, window and all');
  const right = applyFold(sh, p0, parseFold('x1>'));
  eq(stack(right, 0, 0), ['1f', '0b'], 'the other way: the left square on top, back up, and the paper shifted to 0,0');
  eq(topOf(sh, right.stacks.get(pos(0, 0))), { colour: 'gold', mark: null }, 'no window this way');
}
// ---- a longer flap folds out past the short side; stacks reverse and flip as they turn over
{
  const sh = makeSheet(spec({ grid: ['###'] })), p0 = flatPaper(sh);
  const p1 = applyFold(sh, p0, parseFold('x1<'));
  eq([p1.w, p1.h], [2, 1], 'two squares fold over one: the paper is two wide');
  eq(stack(p1, 0, 0), ['2b'], 'square 2 lands past the edge');
  eq(stack(p1, 1, 0), ['0f', '1b'], 'square 1 lands on square 0');
  const p2 = applyFold(sh, p1, parseFold('x1>'));
  eq(stack(p2, 0, 0), ['0f', '1b', '2f'], 'folding a single layer back: it turns face up on top');
  const p3 = applyFold(sh, p1, parseFold('x1<'));
  eq(stack(p3, 0, 0), ['2b', '1f', '0b'], 'folding a two-layer stack: the stack reverses and every face flips');
  for (const p of PUZZLES) {
    const s = makeSheet(p), f0 = flatPaper(s);
    for (const f of foldsOf(f0)) { const q = applyFold(s, f0, f); if (q) ok(q.w <= f0.w && q.h <= f0.h, `${p.id} ${foldText(f)}: a fold never makes the paper bigger`); }
  }
}
// ---- every cell stays somewhere, exactly once
{
  const p = puzzle('n8'); let paper = flatPaper(p.sheet);
  for (const f of p.solution) { paper = applyFold(p.sheet, paper, f); eq(whereIs(paper).size, p.sheet.cells.length, 'no square is lost or doubled'); }
}
// ---- holes
{
  const sh = makeSheet(spec({ grid: ['#o'], front: 'white', back: 'pink', marks: ['0 0 b eye'] })), p0 = flatPaper(sh);
  eq(topOf(sh, p0.stacks.get(pos(1, 0))), 'hole', 'a lone punched square shows the table');
  const a = applyFold(sh, p0, parseFold('x1<'));
  eq(topOf(sh, a.stacks.get(pos(0, 0))), { colour: 'white', mark: null }, 'the hole on top shows the white square below');
  const b = applyFold(sh, p0, parseFold('x1>'));
  eq(topOf(sh, b.stacks.get(pos(0, 0))), { colour: 'pink', mark: 'eye' }, 'the eye square folded onto the hole');
}
// ---- tape
{
  const sh = makeSheet(spec({ grid: ['###'], tape: ['0 0 1 0'] })), p0 = flatPaper(sh);
  const c = checkFold(sh, p0, parseFold('x1>'));
  ok(!c.ok && /Tape/.test(c.why), 'tape blocks a fold between its squares');
  eq(applyFold(sh, p0, parseFold('x1<')), null, 'either way');
  ok(checkFold(sh, p0, parseFold('x2>')).ok, 'other lines still fold, carrying the taped pair together');
  assert.throws(() => makeSheet(spec({ grid: ['###'], tape: ['0 0 2 0'] })), /neighbours/); checks++;
}
// ---- creases: mountain folds go under; a turned-over crease becomes a valley
{
  const sh = makeSheet(spec({ grid: ['##'], creases: ['0 0 1 0 m'], marks: ['1 0 b star', '0 0 f moon'] })), p0 = flatPaper(sh);
  const c = checkFold(sh, p0, parseFold('x1<')); ok(c.ok && c.under, 'a mountain crease folds behind');
  const p1 = applyFold(sh, p0, parseFold('x1<'));
  eq(stack(p1, 0, 0), ['1b', '0f'], 'the flap tucks underneath');
  eq(topOf(sh, p1.stacks.get(pos(0, 0))), { colour: 'red', mark: 'moon' }, 'the moon stays on top');
  const sh2 = makeSheet(spec({ grid: ['###'], creases: ['1 0 2 0 m'] }));
  const flipped = applyFold(sh2, flatPaper(sh2), parseFold('x1>')); // square 0 lands face down on 1; 1 and 2 still face up
  ok(checkFold(sh2, flipped, parseFold('x1<')).under, 'the crease is still a mountain while its paper is face up');
  const sh3 = makeSheet(spec({ grid: ['####'], creases: ['2 0 3 0 m'] }));
  const over = applyFold(sh3, flatPaper(sh3), parseFold('x2<')); // the right half, crease and all, turns face down
  ok(!checkFold(sh3, over, parseFold('x1<')).under, 'turned face down, the mountain is a valley: it folds over');
  const sh4 = makeSheet(spec({ grid: ['##', '##'], creases: ['0 0 1 0 m', '0 1 1 1 v'] }));
  ok(!checkFold(sh4, flatPaper(sh4), parseFold('x1<')).ok, 'creases that disagree along one line block it');
  const plain = makeSheet(spec({ grid: ['##'] }));
  ok(!checkFold(plain, flatPaper(plain), parseFold('x1<')).under, 'without a crease every fold goes over');
}
// ---- pictures ignore where the paper lies
{
  const sh = makeSheet(spec({ grid: ['###'] }));
  const a = fold(sh, flatPaper(sh), 'x1<'), b = fold(sh, flatPaper(sh), 'x2>');
  ok(pictureKey(picture(sh, a)) !== '', 'a picture has a key');
  eq(a.w, 2, 'both are two wide'); eq(b.w, 2, 'both are two wide');
  ok(paperKey(a) !== paperKey(b), 'different stacks');
}

// ---- the forty pages
{
  eq(PUZZLES.length, 40, 'forty pages');
  eq(CHAPTERS.length, 5, 'five chapters');
  for (const c of CHAPTERS) eq(chapterPuzzles(c.id).length, 8, `eight pages in ${c.name}`);
  eq(new Set(PUZZLES.map((p) => p.id)).size, 40, 'ids are unique');
  eq(new Set(PUZZLES.map((p) => p.name)).size, 40, 'names are unique');
  for (const c of CHAPTERS) ok(c.tip.title && c.tip.text, `${c.name} teaches its idea`);
  for (const s of PUZZLES) {
    const p = puzzle(s.id);
    ok(p.par >= 1 && p.par <= 8, `${s.id}: par ${p.par}`);
    ok(p.sheet.cells.length >= 2 && p.sheet.cells.length <= 36, `${s.id}: a sheet of 2 to 36 squares`);
    const w = Math.max(...s.grid.map((r) => r.length)), h = s.grid.length;
    ok(w <= 6 && h <= 6, `${s.id}: no bigger than a 6 by 6 sheet`);
    // the gentle chapters stay within 4 by 4 and par 3; the deep pages come later
    if (s.chapter === 'lanterns' || s.chapter === 'boats') ok(w <= 4 && h <= 4 && p.par <= 3, `${s.id}: a gentle page`);
    ok(p.target.tops.size >= 1, `${s.id}: the target has paper`);
    ok(pictureKey(picture(p.sheet, flatPaper(p.sheet))) !== p.goal, `${s.id}: the flat sheet is not already the answer`);
  }
  // each chapter's idea is in its pages: holes in Cranes, tape and creases in Stars, ribbons in Festival Night
  ok(chapterPuzzles('cranes').every((p) => p.grid.some((r) => r.includes('o'))), 'every crane page is punched');
  ok(chapterPuzzles('stars').every((p) => (p.tape?.length ?? 0) + (p.creases?.length ?? 0) > 0), 'every star page has tape or creases');
  ok(chapterPuzzles('night').every((p) => p.marks?.some((m) => m.endsWith('ribbon'))), 'every night page has a ribbon');
  for (const p of chapterPuzzles('night')) {
    const P = puzzle(p.id); ok([...P.target.tops.values()].some((t) => t !== 'hole' && t.mark === 'ribbon'), `${p.id}: the ribbon finishes on the outside`);
  }
  // the size grows through the book
  const area = (c) => chapterPuzzles(c).reduce((s, p) => s + puzzle(p.id).sheet.cells.length, 0) / 8;
  ok(area('night') > area('lanterns'), 'the sheets grow');
  ok(puzzle('n8').sheet.cells.length === 36 && puzzle('n8').par === 8, 'the finale is a full 6 by 6 sheet that takes eight folds');
  // the pars climb: the back half of Cranes, and Stars and Festival Night after their teaching pages, are deep
  const parOf = (c, i) => puzzle(chapterPuzzles(c)[i].id).par;
  for (const c of ['cranes', 'stars', 'night']) ok(parOf(c, 7) >= 6, `${c}: the showpiece takes six folds or more`);
  for (const c of ['cranes', 'stars', 'night']) for (let i = 4; i < 8; i++) ok(parOf(c, i) >= 4, `${c} page ${i + 1} is deep`);
  ok(Math.max(...chapterPuzzles('lanterns').map((p) => puzzle(p.id).par)) <= 3, 'Lanterns stays gentle');
  // valley creases: one page teaches them, and later pages use them
  const valleys = PUZZLES.filter((p) => p.creases?.some((c) => c.endsWith('v'))).map((p) => p.id);
  ok(valleys[0] === 's3' && /valley/i.test(puzzle('s3').tip ?? ''), 'Valley Fold teaches the valley crease first');
  ok(valleys.length >= 6 && valleys.filter((id) => id.startsWith('n')).length >= 3, 'and later pages use them');
  // somewhere a valley is essential: without it the page can't be made in par
  {
    const p = puzzle('n6'), plain = makeSheet({ ...p, creases: p.creases.filter((c) => !c.endsWith('v')) });
    ok(solve(plain, flatPaper(plain), p.target).min < p.par, 'Shooting Star needs its valleys: without them a shortcut opens');
    const q = puzzle('s7'), bare = makeSheet({ ...q, creases: q.creases.filter((c) => !c.endsWith('v')) });
    ok(solve(bare, flatPaper(bare), q.target) === null || solve(bare, flatPaper(bare), q.target).min !== q.par, 'Patchwork Sky needs its valley');
  }
  // the deep pages turn on the order of the folds: playing the designed folds in another order misses the target
  for (const s of PUZZLES) {
    const p = puzzle(s.id); if (p.par < 5) continue;
    const rev = p.solution.slice().reverse(); let paper = flatPaper(p.sheet);
    for (const f of rev) { paper = paper && applyFold(p.sheet, paper, f); }
    ok(!paper || pictureKey(picture(p.sheet, paper)) !== p.goal, `${s.id}: the same folds in reverse order don't make it`);
  }
}

// ---- a puzzle in play
{
  const g = new FoldGame('l2');
  eq(g.folds, 0, 'no folds yet');
  ok(!g.undo(), 'nothing to undo');
  let ev = g.fold(parseFold('y1v'));
  eq(ev[0].kind, 'fold', 'a fold'); eq(g.folds, 1, 'one fold');
  ok(g.undo(), 'undo'); eq(g.folds, 1, 'undone folds still count'); eq(g.history.length, 0, 'but the paper is back');
  ok(g.reset(), 'reset'); eq(g.folds, 0, 'reset clears the count');
  for (const f of g.p.solution) ev = g.fold(f);
  eq(ev.at(-1), { kind: 'solved', seal: 3 }, 'the designed solution is a gold seal');
  ok(g.solved && g.matches(), 'solved');
  eq(g.fold(parseFold('x1<')), [], 'no folding after the finish');
  ok(!g.undo() && !g.reset(), 'no undo or reset after the finish');
  const h = new FoldGame('s1');
  const b = h.fold(parseFold('x1>'));
  eq(b[0].kind, 'blocked', 'a blocked fold'); eq(h.folds, 0, 'a blocked fold does not count');
}
// ---- seals
{
  eq([sealFor(3, 3), sealFor(4, 3), sealFor(5, 3), sealFor(6, 3), sealFor(2, 3)], [3, 2, 2, 1, 3], 'gold in par, silver within two more, then paper');
}
// ---- the solver and hints
{
  const p = puzzle('l5'), r = solve(p.sheet, flatPaper(p.sheet), p.target);
  eq(r.min, p.par, 'the solver finds par');
  ok(r.first.some((f) => foldText(f) === foldText(p.solution[0])), 'the designed first fold is a shortest start');
  const g = new FoldGame('l5'); const h = g.hint();
  ok(h && r.first.some((f) => foldText(f) === foldText(h)), 'the hint is a shortest first fold');
  g.fold(p.solution[0]); const h2 = g.hint();
  ok(h2 && solve(p.sheet, applyFold(p.sheet, g.paper, h2), p.target).min === p.par - 2, 'the next hint moves on from there');
  // a dead end: folded to a single square that isn't the target, no hint can help
  const d = new FoldGame('n8'); for (const t of ['y3^', 'y2^', 'y1^']) d.fold(parseFold(t));
  eq([d.paper.w, d.paper.h, d.hint()], [6, 1, null], 'folded flatter than the target, the hint says it is out of reach');
  const e = new FoldGame('c6'); for (const t of ['x1>', 'x1>', 'x1>']) e.fold(parseFold(t));
  ok(e.paper.w === 2 && e.hint() === null, 'and so it does when the wrong squares are already buried');
  eq(solve(p.sheet, flatPaper(p.sheet), p.target, 2), null, 'and the solver stops at its depth limit');
}
// ---- the solver against a plain breadth-first search over whole paper states (the old solver), on every page from
// the flat sheet and after one or two folds where that search is quick, and on random small sheets with holes, tape
// and creases; the counts of shortest solutions and their first folds must agree exactly
{
  const bfs = (sheet, paper, goal, maxDepth) => {
    const done = (q) => pictureKey(picture(sheet, q)) === goal;
    if (done(paper)) return { min: 0, count: 1, first: [] };
    let layer = new Map([[paperKey(paper), { paper, ways: 1, first: new Set() }]]);
    const seen = new Set(layer.keys());
    for (let depth = 1; depth <= maxDepth; depth++) {
      const next = new Map();
      for (const n of layer.values()) for (const f of foldsOf(n.paper)) {
        const q = applyFold(sheet, n.paper, f); if (!q) continue;
        const k = paperKey(q); if (seen.has(k) && !next.has(k)) continue;
        const first = depth === 1 ? new Set([foldText(f)]) : n.first, m = next.get(k);
        if (m) { m.ways += n.ways; for (const t of first) m.first.add(t); } else next.set(k, { paper: q, ways: n.ways, first: new Set(first) });
      }
      let count = 0; const firsts = new Set();
      for (const n of next.values()) if (done(n.paper)) { count += n.ways; for (const t of n.first) firsts.add(t); }
      for (const k of next.keys()) seen.add(k);
      if (count) return { min: depth, count, first: [...firsts].sort() };
      if (!next.size) return null;
      layer = next;
    }
    return null;
  };
  const same = (sheet, paper, target, label) => {
    const a = solve(sheet, paper, target), b = bfs(sheet, paper, pictureKey(target), 12);
    eq(a && { min: a.min, count: a.count, first: a.first.map(foldText) }, b, `${label}: the solver agrees with a plain search`);
  };
  for (const s of PUZZLES) {
    const p = puzzle(s.id), f0 = flatPaper(p.sheet); if (p.sheet.cells.length > 16) continue;
    same(p.sheet, f0, p.target, s.id);
    for (const f of foldsOf(f0)) { const q = applyFold(p.sheet, f0, f); if (q) same(p.sheet, q, p.target, `${s.id} after ${foldText(f)}`); }
  }
  const r = rng(9), cols = 'rgbtpv';
  for (let k = 0; k < 160; k++) {
    const w = 2 + Math.floor(r() * 3), h = 1 + Math.floor(r() * 3);
    const grid = Array.from({ length: h }, () => [...Array(w)].map(() => (r() < 0.12 ? '.' : r() < 0.15 ? 'o' : '#')).join(''));
    const fc = grid.map((row) => [...row].map(() => cols[Math.floor(r() * 3)]).join('')), bc = grid.map((row) => [...row].map(() => cols[3 + Math.floor(r() * 3)]).join(''));
    const at = []; grid.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') at.push([x, y]); }));
    const pairs = []; for (const [x, y] of at) for (const [dx, dy] of [[1, 0], [0, 1]]) if (at.some(([a, b]) => a === x + dx && b === y + dy)) pairs.push(`${x} ${y} ${x + dx} ${y + dy}`);
    const tape = pairs.filter(() => r() < 0.1), creases = pairs.filter((e) => !tape.includes(e) && r() < 0.15).map((e) => e + (r() < 0.5 ? ' m' : ' v'));
    if (at.length < 2) continue;
    let sheet; try { sheet = makeSheet(spec({ grid, fc, bc, tape, creases })); } catch { continue; }
    let paper = flatPaper(sheet);
    for (let i = 0; i < 4; i++) { const ls = foldsOf(paper).map((f) => applyFold(sheet, paper, f)).filter(Boolean); if (!ls.length) break; paper = ls[Math.floor(r() * ls.length)]; }
    same(sheet, flatPaper(sheet), picture(sheet, paper), `random sheet ${k}`);
  }
}
// ---- progress and saving
{
  const s = freshSave();
  eq(SAVE_KEY, 'paperfold-v1', 'the save key');
  ok(chapterOpen(s, 'lanterns') && !chapterOpen(s, 'boats'), 'Lanterns is open, Boats is not');
  ok(puzzleOpen(s, 'l1') && puzzleOpen(s, 'l2') && !puzzleOpen(s, 'l3'), 'two pages ahead are open');
  eq(nextPuzzle(s), 'l1', 'start at the first page');
  for (const id of ['l1', 'l2', 'l3', 'l4', 'l5', 'l6']) record(s, id, puzzle(id).par);
  ok(chapterOpen(s, 'boats'), 'six lantern pages open Boats');
  ok(puzzleOpen(s, 'l7') && !puzzleOpen(s, 'l8'), 'the showpiece waits for the other seven');
  record(s, 'l7', 9); ok(puzzleOpen(s, 'l8'), 'then opens');
  eq(s.done.l7, { seal: 1, best: 9 }, 'a paper seal');
  const r = record(s, 'l7', puzzle('l7').par); ok(r.better && !r.first, 'a better run'); eq(s.done.l7.seal, 3, 'now gold');
  record(s, 'l7', 20); eq(s.done.l7, { seal: 3, best: puzzle('l7').par }, 'a worse run keeps the best');
  eq(doneIn(s, 'lanterns'), 7, 'seven done'); eq(sealCount(s), 7, 'seven gold');
  const back = readSave(JSON.stringify(s)); eq(back, s, 'a save round-trips');
  for (const bad of [null, '', 'nope', '[]', '{"v":2}', '{"v":1,"done":{"l1":{"seal":9,"best":1},"zz":{"seal":3,"best":1},"l2":{"seal":3,"best":-4},"l3":"x"},"tips":[1,"a"],"ended":"yes","settings":{"sound":"no"}}']) {
    const r2 = readSave(bad); ok(typeof r2 === 'object' && r2.v === 1, 'a corrupt save is a fresh one');
    eq(Object.keys(r2.done).length, 0, 'and trusts nothing odd');
  }
  eq(readSave('{"v":1,"tips":[1,"a"],"settings":{"sound":false}}').tips, ['a'], 'only string tips survive');
  eq(readSave('{"v":1,"settings":{"sound":false}}').settings, { sound: false, music: true }, 'settings survive');
}
// ---- the look's generator is seeded
{
  const a = rng(5), b = rng(5); eq([a(), a(), a()], [b(), b(), b()], 'same seed, same numbers');
}
console.log(`fold: ${checks} checks passed`);
