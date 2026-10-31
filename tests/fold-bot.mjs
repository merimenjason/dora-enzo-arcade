// Paperfold bot: every page is solved by a breadth-first solver from the flat sheet. Each page must be solvable, its
// par (the designed solution's length) must be the true minimum, so no loophole finishes it in fewer folds, and the
// number of shortest solutions is recorded in tests/fold-solutions.json and kept small, so each page feels designed.
// Then naive players: a random folder that makes par legal folds and stops wins only by luck, rarely on the harder
// pages; a patient random folder (random folds with resets, the way a stuck player flails) needs far more folds than
// par, so the gold seal means real thought; and the hint, followed from any wrong turn, always leads home.
// Run with --write to refresh the recorded counts after changing a page, and --quick to skip the random players.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { PUZZLES, puzzle, flatPaper, applyFold, foldsOf, solve, picture, pictureKey, foldText, FoldGame, rng } from '../.checks/fold-game.js';

const quick = process.argv.includes('--quick'), write = process.argv.includes('--write');
const file = new URL('./fold-solutions.json', import.meta.url);
const stored = write ? {} : JSON.parse(readFileSync(file, 'utf8'));
const out = {};
let total = 0;
const t0 = Date.now();
for (const s of PUZZLES) {
  const p = puzzle(s.id), r = solve(p.sheet, flatPaper(p.sheet), p.goal, p.par + 1, 2e6);
  assert.ok(r, `${s.id}: solvable`);
  assert.equal(r.min, p.par, `${s.id}: par ${p.par} is the minimum (the solver found ${r.min})`);
  assert.ok(r.count <= 4, `${s.id}: few shortest solutions (${r.count}), so the page feels designed`);
  out[s.id] = { par: p.par, shortest: r.count, solution: p.solution.map(foldText) };
  if (!write) assert.deepEqual(out[s.id], stored[s.id], `${s.id}: matches tests/fold-solutions.json (run with --write after changing a page)`);
  total += r.count;
}
if (write) writeFileSync(file, JSON.stringify(out, null, 1) + '\n');
console.log(`fold-bot: ${PUZZLES.length} pages solved at par in ${Date.now() - t0} ms; ${total} shortest solutions in all (${(total / PUZZLES.length).toFixed(2)} a page)`);

if (!quick) {
  const r = rng(62);
  const pick = (a) => a[Math.floor(r() * a.length)];
  // a random folder: par legal folds, then stop
  let tries = 0, wins = 0, hardTries = 0, hardWins = 0;
  for (const s of PUZZLES) {
    const p = puzzle(s.id);
    for (let k = 0; k < 200; k++) {
      let paper = flatPaper(p.sheet);
      for (let i = 0; i < p.par; i++) {
        const legal = foldsOf(paper).map((f) => applyFold(p.sheet, paper, f)).filter(Boolean);
        if (!legal.length) break; paper = pick(legal);
      }
      const won = pictureKey(picture(p.sheet, paper)) === p.goal;
      tries++; wins += +won; if (p.par >= 3) { hardTries++; hardWins += +won; }
    }
  }
  const rate = wins / tries, hard = hardWins / hardTries;
  console.log(`  random folding wins ${(rate * 100).toFixed(1)}% of tries overall, ${(hard * 100).toFixed(1)}% on pages with par 3 or more`);
  assert.ok(rate < 0.2, 'random folding rarely wins');
  assert.ok(hard < 0.08, 'and almost never on the harder pages');

  // a flailing player: random folds, resetting after par + 2, until the page is done (or 5000 folds); counts every fold
  const spent = [];
  for (const s of PUZZLES) {
    const p = puzzle(s.id), g = new FoldGame(s.id); let made = 0;
    while (!g.solved && made < 5000) {
      if (g.history.length >= p.par + 2) { g.reset(); }
      const legal = foldsOf(g.paper).filter((f) => g.check(f).ok);
      if (!legal.length) { g.reset(); continue; }
      g.fold(pick(legal)); made++;
    }
    spent.push(g.solved ? made / p.par : Infinity);
  }
  spent.sort((a, b) => a - b);
  const median = spent[Math.floor(spent.length / 2)];
  const lost = spent.filter((x) => x === Infinity).length;
  console.log(`  a flailing player needs a median ${median.toFixed(1)}× par folds${lost ? ` and gives up on ${lost} page${lost > 1 ? 's' : ''} after 5000` : ''}`);
  assert.ok(median > 3, 'so a gold seal (par) or silver (par + 2) takes real thought');

  // the hint always leads home: from a few random wrong turns, follow hints to the finish
  for (const s of PUZZLES) {
    const p = puzzle(s.id), g = new FoldGame(s.id);
    for (let i = 0; i < 2; i++) { const legal = foldsOf(g.paper).filter((f) => g.check(f).ok); if (legal.length) g.fold(pick(legal)); }
    let steps = 0;
    while (!g.solved && steps < 12) {
      const h = g.hint();
      if (!h) { if (!g.undo()) g.reset(); steps++; continue; }
      g.fold(h); steps++;
    }
    assert.ok(g.solved, `${s.id}: following the hints (undoing when stuck) finishes the page`);
  }
  console.log('  following the hints finishes every page');
}
