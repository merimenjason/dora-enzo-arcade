// Misprint bot: a human-ish player who presses the hint most of the time (60%) and otherwise tries a random move
// (walk, switch, shift, or now and then an undo), the way someone fumbling with a new puzzle would. It must finish
// every page of the first zine inside a sane budget of presses. `--quick` plays each Burrow Gazette page with 8 seeds;
// the full run plays every page of all three zines with 20 seeds. Run after compiling the engine into .checks/.
import assert from 'node:assert/strict';
import { PAGES, Game, ACTIONS } from '../.checks/misprint-game.js';

const quick = process.argv.includes('--quick');
const seeds = quick ? 8 : 20;
const pages = quick ? PAGES.filter((p) => p.zine === 0) : PAGES;
const BUDGET = 400; // presses per page before the bot is judged lost

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

function play(id, seed, hintBias = 0.6) {
  const r = rng(seed * 7919 + id.length * 31 + id.charCodeAt(1));
  const g = new Game(id);
  let presses = 0, refused = 0, undos = 0;
  while (!g.done && presses < BUDGET) {
    presses++;
    const roll = r();
    if (roll < hintBias) { const a = g.hint(); if (a) g.do(a); else if (g.undo()) undos++; continue; } // a dead end: the hint says so, and they undo
    if (roll < hintBias + 0.04 && g.undo()) { undos++; continue; }
    const a = ACTIONS[Math.floor(r() * ACTIONS.length)];
    if (!g.do(a).ok) refused++;
  }
  return { done: g.done, presses, moves: g.moves, hints: g.hints, refused, undos, drop: g.st.drop };
}

const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
console.log('page  done   presses(med/max)  moves(med)  par  hints(med)  refused(med)');
let worst = 0, total = 0, finished = 0;
for (const def of pages) {
  const runs = Array.from({ length: seeds }, (_, i) => play(def.id, i + 1));
  const done = runs.filter((x) => x.done).length;
  finished += done; total += runs.length;
  const maxP = Math.max(...runs.map((x) => x.presses)); worst = Math.max(worst, maxP);
  console.log(`${def.id.padEnd(5)} ${String(done).padStart(2)}/${seeds}  ${String(median(runs.map((x) => x.presses))).padStart(7)} / ${String(maxP).padEnd(6)}  ${String(median(runs.map((x) => x.moves))).padStart(10)}  ${String(def.par).padStart(3)}  ${String(median(runs.map((x) => x.hints))).padStart(10)}  ${String(median(runs.map((x) => x.refused))).padStart(12)}`);
  if (def.zine === 0) assert.equal(done, seeds, `${def.id}: the hint-leaning bot finishes every time inside ${BUDGET} presses`);
}
// for the record: the same player leaning on the hint only 30% of the time, and pure random poking at page 1
const shy = pages.filter((p) => p.zine === 0).map((p) => Array.from({ length: seeds }, (_, i) => play(p.id, 50 + i, 0.3)).filter((x) => x.done).length);
console.log(`30% hints: ${shy.reduce((a, b) => a + b, 0)}/${shy.length * seeds} Burrow Gazette runs finished inside ${BUDGET} presses (${shy.join(' ')})`);
const blind = Array.from({ length: 20 }, (_, i) => play('g1', 100 + i, 0)).filter((x) => x.done).length;
console.log(`g1 with no hints at all: ${blind}/20 finished by pure random presses`);
console.log(`PASS Misprint bot: ${finished}/${total} runs finished, worst ${worst} presses`);
