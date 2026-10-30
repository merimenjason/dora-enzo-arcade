// Starstitch bots. A steady paw stitches every constellation through the same pointer calls the page makes (press on
// the first star, drag in small steps towards each next star, let go), with and without a wobble, and finishes each
// one in one go: so all 43 can be stitched by dragging, and the snapping never stitches a star the paw wasn't heading
// for. A tapper does the same with one tap per star. Then the difficulty from real play: a careless player (any
// start, any seam) must get stuck far more often than not, a thoughtful one (starts on an odd star or the moon,
// never cuts the loose seams in two) must still be caught out by the later nights' rules, so the ★ "in one go"
// medal is earned and not given, and a player who follows the hints always finishes. Finally the whole story is
// played through the save: every night opens in turn, the ending is reached, and hints are banked along the way.
import assert from 'node:assert/strict';
import { Stitch, PUZZLES, STORY, NIGHTS, nightPuzzles, freshSave, record, puzzleOpen, nightOpen, storyDone, nextPuzzle, rng, BANK_MAX } from '../.checks/stars-game.js';
import { solve, hint, carefulFail, randomFail, dailySky, shootSky } from '../.checks/stars-solver.js';

const quick = process.argv.includes('--quick');
const verbose = process.argv.includes('-v');
const R = 3.2; // the hit radius in sky units, about what a mouse gets on a laptop

/** Drags the needle through a solution with the pointer, in small steps, optionally with a wobbly paw. */
export function dragSolve(p, sol, { wobble = 0, seed = 1, steps = 9 } = {}) {
  const st = new Stitch(p), r = rng(seed), j = () => (r() - 0.5) * 2 * wobble;
  const A0 = p.stars[sol.start];
  st.down(A0.x + j() * 0.3, A0.y + j() * 0.3, R);
  for (const to of sol.path) {
    // after a twin's leap, pick the needle up again where it landed
    if (!st.dragging) { st.up(); st.down(p.stars[st.at].x + j() * 0.3, p.stars[st.at].y + j() * 0.3, R); }
    const A = p.stars[st.at], B = p.stars[to], before = st.moves.length;
    for (let k = 1; k <= steps && st.moves.length === before; k++) st.move(A.x + (B.x - A.x) * (k / steps) + j(), A.y + (B.y - A.y) * (k / steps) + j(), R);
    if (st.moves.length !== before + 1 || st.moves[before].to !== to) { st.up(); return { st, ok: false, at: to }; }
  }
  st.up();
  return { st, ok: st.done && st.clean };
}
/** One tap per star. */
export function tapSolve(p, sol) {
  const st = new Stitch(p);
  st.down(p.stars[sol.start].x, p.stars[sol.start].y, R); st.up();
  for (const to of sol.path) { st.down(p.stars[to].x + 0.4, p.stars[to].y - 0.4, R); st.up(); }
  return st;
}
/** A careless player: any start, any seam, no thinking. */
function careless(p, r) {
  const st = new Stitch(p), starts = p.stars.map((_, i) => i).filter((i) => !st.startRefusal(i));
  st.start(starts[Math.floor(r() * starts.length)]);
  for (;;) { const o = st.options(); if (!o.length) break; st.stitch(o[Math.floor(r() * o.length)]); }
  return st.done;
}

// ---------------------------------------------------------------- every constellation, stitched by dragging and by tapping
{
  let n = 0;
  for (const p of PUZZLES) {
    const sol = solve(p); assert.ok(sol, `${p.id} solvable`);
    const d = dragSolve(p, sol); assert.ok(d.ok, `${p.id}: dragged in one go (stopped heading for ${d.at !== undefined ? p.stars[d.at].name : '-'})`);
    for (let seed = 1; seed <= (quick ? 2 : 8); seed++) { const w = dragSolve(p, sol, { wobble: 1.2, seed, steps: 7 }); assert.ok(w.ok, `${p.id}: a wobbly paw (seed ${seed}) still stitches it in one go`); }
    const t = tapSolve(p, sol); assert.ok(t.done && t.clean, `${p.id}: tapped in one go`);
    n++;
  }
  console.log(`PASS all ${n} constellations stitched in one go by dragging (steady and wobbly) and by tapping`);
  for (const day of ['2026-10-31', '2026-12-25', '2027-02-14']) { const p = dailySky(day); assert.ok(dragSolve(p, solve(p)).ok, `the daily sky for ${day} drags through`); }
  for (const l of [1, 6, 12, 24]) { const p = shootSky(l); assert.ok(dragSolve(p, solve(p)).ok, `shooting star ${l} drags through`); }
  console.log('PASS the generated skies drag through too');
}

// ---------------------------------------------------------------- the difficulty, from real play
{
  const tries = quick ? 60 : 300, rows = [];
  let carelessWins = 0, carelessAll = 0;
  for (let night = 0; night <= 5; night++) {
    const ps = nightPuzzles(night); let won = 0, all = 0, careful = 0;
    for (const p of ps) {
      const r = rng(1000 + p.index * 31 + night);
      for (let t = 0; t < tries; t++) { all++; if (careless(p, r)) won++; }
      careful += 1 - carefulFail(p, quick ? 60 : 200);
    }
    rows.push({ night, careless: won / all, careful: careful / ps.length });
    if (night >= 1) { carelessWins += won; carelessAll += all; }
  }
  for (const r of rows) console.log(`  ${r.night === 0 ? 'lessons ' : `night ${r.night} `} careless wins ${(r.careless * 100).toFixed(0).padStart(3)}%   thoughtful wins in one go ${(r.careful * 100).toFixed(0).padStart(3)}%`);
  const story = carelessWins / carelessAll;
  assert.ok(story < 0.3, `a careless player rarely finishes a story constellation (${(story * 100).toFixed(0)}%)`);
  assert.ok(rows[0].careful === 1, 'the lessons are fair: a thoughtful player always gets them');
  assert.ok(rows[1].careful > 0.6, 'the first night is mostly kind to a thoughtful player');
  const late = (rows[3].careful + rows[5].careful) / 2;
  assert.ok(late < 0.85, `the frosty night and the meteor shower still catch a thoughtful player out (${(late * 100).toFixed(0)}%)`);
  for (const p of STORY) {
    const s = new Stitch(p); let guard = 300;
    while (!s.done && guard--) { const h = hint(s); if (h.k === 'start') s.start(h.at); else if (h.k === 'next') s.stitch(h.to); else break; }
    assert.ok(s.done, `${p.id}: the hints lead all the way`);
  }
  console.log(`PASS careless play rarely wins (${(story * 100).toFixed(0)}%), thoughtful play is caught out late on (${(late * 100).toFixed(0)}%), and the hints always lead home`);
  if (verbose) for (const p of STORY) console.log(`  ${p.id.padEnd(5)} ${p.name.padEnd(22)} careless fails ${randomFail(p).toFixed(2)}  thoughtful fails ${carefulFail(p).toFixed(2)}`);
}

// ---------------------------------------------------------------- the whole story, through the save
{
  const s = freshSave(); let medals = 0, earned = 0, guard = 100, finale = false;
  for (let p = nextPuzzle(s); p && guard--; p = nextPuzzle(s)) {
    assert.ok(puzzleOpen(s, p.id), `${p.id} is open when it comes up`);
    const sol = solve(p), d = dragSolve(p, sol);
    // now and then a hint, as a person might
    if (p.index % 3 === 2) d.st.hints = 1;
    const r = record(s, d.st);
    if (r.medal) medals++; if (r.earned) earned++; if (r.finale) finale = true;
    if (r.nightDone && p.night < 5) assert.ok(nightOpen(s, p.night + 1), `night ${p.night + 1} opens`);
  }
  assert.ok(storyDone(s), 'every constellation stitched'); assert.ok(finale, 'the finale was reached');
  assert.equal(medals, PUZZLES.length, 'every one in one go');
  assert.ok(earned === BANK_MAX - 1 && s.bank === BANK_MAX, `hints banked along the way, up to the most you can hold (${earned} earned, ${s.bank} banked)`);
  console.log(`PASS the whole story through the save: ${NIGHTS.length - 1} nights, ${STORY.length} constellations, the ending, ${earned} hints banked`);
}
