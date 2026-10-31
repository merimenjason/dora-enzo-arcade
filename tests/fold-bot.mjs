// Paperfold bot: every page is solved by the exhaustive solver from the flat sheet. Each page must be solvable, its
// par (the designed solution's length) must be the true minimum, so no loophole finishes it in fewer folds, and the
// number of shortest solutions is recorded in tests/fold-solutions.json and kept small, so each page feels designed.
// Then naive players: a random folder that makes par legal folds and stops wins only by luck, and never on the deep
// pages; a patient random folder with a fixed budget of folds per page (random folds, starting again when the paper
// is folded past par + 2 or can't fold any more) finishes the gentle pages now and then but almost never the deep
// ones, so they take real thought; and the hint, followed from the flat sheet or from any wrong turn, always leads
// home, its first fold always one that starts a shortest solution.
// Run with --write to refresh the recorded counts after changing a page, and --quick to skip the random players.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { PUZZLES, CHAPTERS, puzzle, flatPaper, applyFold, foldsOf, solve, picture, pictureKey, foldText, FoldGame, rng } from '../.checks/fold-game.js';

const quick = process.argv.includes('--quick'), write = process.argv.includes('--write');
const file = new URL('./fold-solutions.json', import.meta.url);
const stored = write ? {} : JSON.parse(readFileSync(file, 'utf8'));
const out = {}, firsts = {};
let total = 0;
const spread = {};
const t0 = Date.now();
for (const s of PUZZLES) {
  const p = puzzle(s.id), r = solve(p.sheet, flatPaper(p.sheet), p.target);
  assert.ok(r, `${s.id}: solvable`);
  assert.equal(r.min, p.par, `${s.id}: par ${p.par} is the minimum (the solver found ${r.min})`);
  assert.ok(r.count <= 3, `${s.id}: few shortest solutions (${r.count}), so the page feels designed`);
  out[s.id] = { par: p.par, shortest: r.count, solution: p.solution.map(foldText) };
  firsts[s.id] = new Set(r.first.map(foldText));
  if (!write) assert.deepEqual(out[s.id], stored[s.id], `${s.id}: matches tests/fold-solutions.json (run with --write after changing a page)`);
  total += r.count; spread[r.count] = (spread[r.count] ?? 0) + 1;
}
if (write) writeFileSync(file, JSON.stringify(out, null, 1) + '\n');
const pars = CHAPTERS.map((c) => `${c.name} ${PUZZLES.filter((p) => p.chapter === c.id).map((p) => puzzle(p.id).par).join(',')}`).join('; ');
console.log(`fold-bot: ${PUZZLES.length} pages solved at par in ${Date.now() - t0} ms; ${total} shortest solutions in all (${Object.entries(spread).map(([k, v]) => `${v} page${v > 1 ? 's' : ''} with ${k}`).join(', ')})`);
console.log(`  pars: ${pars}`);

// the deep pages: the back half of Cranes, and Stars and Festival Night after their teaching pages
const deep = (id) => puzzle(id).par >= 4;
assert.ok(PUZZLES.filter((s) => deep(s.id)).length === 16, 'sixteen deep pages');
assert.equal(Math.max(...PUZZLES.map((s) => puzzle(s.id).par)), 8, 'the finale takes eight folds');

// the hint from the flat sheet is a first fold of a shortest solution, and following it finishes in par
for (const s of PUZZLES) {
  const g = new FoldGame(s.id), h = g.hint();
  assert.ok(h && firsts[s.id].has(foldText(h)), `${s.id}: the first hint starts a shortest solution`);
  let steps = 0;
  for (let f = h; f && !g.solved && steps < 20; f = g.hint()) { g.fold(f); steps++; }
  assert.ok(g.solved && g.folds === g.p.par, `${s.id}: following the hints from the start finishes in par (${g.folds})`);
}
console.log('  following the hints from the flat sheet finishes every page in par');

if (!quick) {
  const r = rng(62);
  const pick = (a) => a[Math.floor(r() * a.length)];
  // a random folder: par legal folds, then stop
  let tries = 0, wins = 0, deepTries = 0, deepWins = 0;
  for (const s of PUZZLES) {
    const p = puzzle(s.id);
    for (let k = 0; k < 200; k++) {
      let paper = flatPaper(p.sheet);
      for (let i = 0; i < p.par; i++) {
        const legal = foldsOf(paper).map((f) => applyFold(p.sheet, paper, f)).filter(Boolean);
        if (!legal.length) break; paper = pick(legal);
      }
      const won = pictureKey(picture(p.sheet, paper)) === p.goal;
      tries++; wins += +won; if (deep(s.id)) { deepTries++; deepWins += +won; }
    }
  }
  const rate = wins / tries, deepRate = deepWins / deepTries;
  console.log(`  random folding in par wins ${(rate * 100).toFixed(1)}% of tries overall, ${(deepRate * 100).toFixed(2)}% on the deep pages (par 4 or more)`);
  assert.ok(rate < 0.1, 'random folding rarely wins');
  assert.ok(deepRate < 0.002, 'and practically never on the deep pages');

  // a patient random folder with a budget of folds a try: random legal folds, starting again after par + 2 folds
  // or when the paper can't fold any more
  const BUDGET = 60, TRIES = 60;
  const won = {};
  for (const s of PUZZLES) {
    const p = puzzle(s.id); let n = 0;
    for (let k = 0; k < TRIES; k++) {
      const g = new FoldGame(s.id);
      for (let made = 0; made < BUDGET && !g.solved; made++) {
        if (g.history.length >= p.par + 2) g.reset();
        const legal = foldsOf(g.paper).filter((f) => g.check(f).ok);
        if (!legal.length) { g.reset(); continue; }
        g.fold(pick(legal));
      }
      n += +g.solved;
    }
    won[s.id] = n / TRIES;
  }
  const mean = (ids) => ids.reduce((a, id) => a + won[id], 0) / ids.length;
  const gentle = PUZZLES.filter((s) => !deep(s.id)).map((s) => s.id), deeps = PUZZLES.filter((s) => deep(s.id)).map((s) => s.id);
  const worst = deeps.reduce((a, id) => (won[id] > won[a] ? id : a), deeps[0]);
  console.log(`  a patient random folder with ${BUDGET} folds a try finishes ${(mean(gentle) * 100).toFixed(0)}% of tries on the gentle pages and ${(mean(deeps) * 100).toFixed(1)}% on the deep ones (at most ${(won[worst] * 100).toFixed(0)}%, on ${worst})`);
  for (const c of CHAPTERS) console.log(`    ${c.name}: ${PUZZLES.filter((p) => p.chapter === c.id).map((p) => `${p.id} ${(won[p.id] * 100).toFixed(0)}%`).join(', ')}`);
  assert.ok(mean(gentle) > 0.3, 'the gentle pages give way to flailing now and then');
  assert.ok(mean(deeps) < 0.01, 'the deep pages almost never do');
  assert.ok(won[worst] <= 0.05, 'not one deep page gives way to flailing more than one try in twenty');

  // the hint always leads home: from a few random wrong turns, follow hints to the finish
  let slow = 0, slowId = '';
  for (const s of PUZZLES) {
    const p = puzzle(s.id);
    for (let k = 0; k < 4; k++) {
      const g = new FoldGame(s.id);
      for (let i = 0; i < 1 + (k % 3); i++) { const legal = foldsOf(g.paper).filter((f) => g.check(f).ok); if (legal.length) g.fold(pick(legal)); }
      let steps = 0;
      while (!g.solved && steps < p.par + 12) {
        const t = Date.now(), h = g.hint(), dt = Date.now() - t;
        if (dt > slow) { slow = dt; slowId = s.id; }
        if (!h) { if (!g.undo()) g.reset(); steps++; continue; }
        g.fold(h); steps++;
      }
      assert.ok(g.solved, `${s.id}: following the hints (undoing when stuck) finishes the page`);
    }
  }
  console.log(`  following the hints from wrong turns finishes every page; the slowest hint took ${slow} ms (${slowId})`);
}
