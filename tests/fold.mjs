// Paperfold engine checks: folding mirrors the lifted part and stacks it reversed and face-flipped on top (or
// underneath for a mountain crease), the paper is always shifted back to 0,0, a fold never makes the paper bigger,
// holes show the layer below, tape blocks a fold that would part it, creases fold their own way (and the other way
// once the paper is turned over), the picture and its match ignore where the paper lies, undo, reset and the fold
// count, seals, the forty pages and their chapters, the solver, unlocking, and saving, corrupt saves included.
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
    ok(p.par >= 1 && p.par <= 6, `${s.id}: par ${p.par}`);
    ok(p.sheet.cells.length >= 2 && p.sheet.cells.length <= 16, `${s.id}: a sheet of 2 to 16 squares`);
    const w = Math.max(...s.grid.map((r) => r.length)), h = s.grid.length;
    ok(w * h <= 16 && w <= 5 && h <= 4, `${s.id}: no bigger than a 4 by 4 sheet (a strip may be five long)`);
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
  ok(puzzle('n8').sheet.cells.length === 16, 'the finale is a full 4 by 4 sheet');
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
  const p = puzzle('l5'), r = solve(p.sheet, flatPaper(p.sheet), p.goal, 6);
  eq(r.min, p.par, 'the solver finds par');
  ok(r.first.some((f) => foldText(f) === foldText(p.solution[0])), 'the designed first fold is a shortest start');
  const g = new FoldGame('l5'); const h = g.hint();
  ok(h && r.first.some((f) => foldText(f) === foldText(h)), 'the hint is a shortest first fold');
  g.fold(p.solution[0]); const h2 = g.hint();
  ok(h2 && solve(p.sheet, applyFold(p.sheet, g.paper, h2), p.goal, 6).min === p.par - 2, 'the next hint moves on from there');
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
