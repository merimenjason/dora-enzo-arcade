// Starstitch engine checks: the content (three lessons and five nights of eight, the rules arriving night by night,
// every constellation solvable, drawn cleanly and neither trivially forced nor hopeless), the rules of a stitch
// (seams once, double seams twice, one-way comets, knots, bright stars, twins and moons, unpicking, starting again,
// getting stuck and finishing), the pointer (press, drag, snap along the drag, drag back to unpick, tap to stitch),
// the hints, the generated Daily Sky and Shooting Star skies, and saving, corrupt saves included.
import assert from 'node:assert/strict';
import {
  Stitch, PUZZLES, PUZZLE, PUZZLE_IDS, STORY, TUTORIAL, NIGHTS, FINALE, nightPuzzles, parsePuzzle,
  SAVE_KEY, BANK_MAX, freshSave, readSave, puzzleOpen, nightOpen, storyDone, record, recordDaily, dayBefore, nextPuzzle, medals, solvedCount,
} from '../.checks/stars-game.js';
import { solve, solvable, countSolutions, goodStarts, randomFail, hint, dailySky, shootSky, generate } from '../.checks/stars-solver.js';

let checks = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); checks++; };
const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); checks++; };
const mk = (s, e, c) => parsePuzzle({ id: 'x', name: 'x', s, e, c, story: ['', ''] }, 1, 0);
const idx = (p, name) => p.stars.findIndex((q) => q.name === name);
/** Plays a solution through stitch() and returns the finished stitch. */
const play = (p, sol) => { const st = new Stitch(p); st.start(sol.start); for (const to of sol.path) assert.ok(st.stitch(to), `${p.id}: stitch to ${p.stars[to].name}`); return st; };

// ---- the content
{
  eq(TUTORIAL.length, 3, 'three lessons');
  eq(STORY.length, 40, 'forty constellations in the story');
  eq(NIGHTS.length, 6, 'the lessons and five nights');
  for (let n = 1; n <= 5; n++) eq(nightPuzzles(n).length, 8, `eight on night ${n}`);
  eq(new Set(PUZZLE_IDS).size, PUZZLES.length, 'ids are unique');
  eq(new Set(PUZZLES.map((p) => p.name)).size, PUZZLES.length, 'names are unique');
  eq(FINALE, 'n5-8', 'the Two Chinchillas are last');
  eq(PUZZLE[FINALE].figure, 'twochin', 'with their painting');
  const figs = PUZZLES.filter((p) => p.figure).map((p) => p.figure);
  eq(figs.length, 11, 'eleven painted figures'); eq(new Set(figs).size, 11, 'all different');
  for (let n = 1; n <= 5; n++) ok(nightPuzzles(n).filter((p) => p.figure).length >= 2, `night ${n} has two painted figures`);
  // the rules arrive one night at a time
  const allowed = { 0: [], 1: ['bright'], 2: ['bright', 'knot', 'double'], 3: ['bright', 'knot', 'double', 'oneway', 'cloud'], 4: ['bright', 'knot', 'double', 'oneway', 'cloud', 'twin', 'moon'] };
  for (const p of PUZZLES) if (p.night <= 4) for (const r of p.rules) ok(allowed[p.night].includes(r), `${p.id}: ${r} hasn't been taught yet`);
  const firstUse = {};
  for (const p of [...TUTORIAL, ...STORY]) for (const r of p.rules) if (!firstUse[r]) firstUse[r] = p;
  for (const [r, p] of Object.entries(firstUse)) ok(p.teach, `${p.id} teaches ${r}, the first time it appears`);
  eq(Object.keys(firstUse).sort(), ['bright', 'cloud', 'double', 'knot', 'moon', 'oneway', 'twin'], 'all seven rules appear');
  const last = new Set(nightPuzzles(5).flatMap((p) => p.rules));
  eq(last.size, 7, 'the last night mixes every rule');
  for (const p of PUZZLES) {
    ok(p.story[0].length > 10 && p.story[1].length > 10, `${p.id}: a two-line story`);
    ok(p.stars.length >= 4 && p.stars.length <= 21, `${p.id}: 4 to 21 stars`);
    for (const q of p.stars) ok(q.x >= 0 && q.x <= 100 && q.y >= 0 && q.y <= 80, `${p.id}: ${q.name} in the sky`);
    // drawn cleanly: stars apart, and no seam brushing past a star it doesn't join
    for (let i = 0; i < p.stars.length; i++) for (let j = i + 1; j < p.stars.length; j++) ok(Math.hypot(p.stars[i].x - p.stars[j].x, p.stars[i].y - p.stars[j].y) >= 9, `${p.id}: stars apart`);
    for (const s of p.seams) {
      const A = p.stars[s.a], B = p.stars[s.b];
      p.stars.forEach((q, k) => {
        if (k === s.a || k === s.b) return;
        const vx = B.x - A.x, vy = B.y - A.y, t = Math.max(0, Math.min(1, ((q.x - A.x) * vx + (q.y - A.y) * vy) / (vx * vx + vy * vy)));
        ok(Math.hypot(A.x + vx * t - q.x, A.y + vy * t - q.y) >= 4, `${p.id}: the ${A.name}-${B.name} seam clears ${q.name}`);
      });
    }
    for (const c of p.clouds) ok(p.seams.some((s) => s.cloud), `${p.id}: its cloud hides a seam`);
  }
}

// ---- every constellation is solvable, and not trivially forced or hopeless
{
  const fails = {};
  for (const p of PUZZLES) {
    const sol = solve(p); ok(sol, `${p.id} has a solution`);
    const st = play(p, sol); ok(st.done, `${p.id}: the solution finishes it`);
    const n = countSolutions(p, 1e6); ok(n >= 1, `${p.id}: counted`);
    ok(goodStarts(p).length >= 1, `${p.id}: somewhere to start`);
    const f = randomFail(p, 300); (fails[p.night] ??= []).push(f);
    if (p.night >= 1) ok(f >= 0.2, `${p.id}: a careless thread gets stuck sometimes (${f.toFixed(2)})`);
    ok(f <= 0.995 || n >= 2, `${p.id}: not a single needle-in-a-haystack path`);
    if (p.night >= 1 && p.index >= 3) ok(n >= 2 || f >= 0.5, `${p.id}: more than one choice matters`);
  }
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  ok(mean(fails[0]) < mean(fails[3]), 'the frosty night is harder than the lessons');
  ok(mean(fails[5]) > mean(fails[0]), 'and the meteor shower too');
  ok(mean([...fails[3], ...fails[5]]) > 0.8, 'the late nights catch out careless threads most of the time');
}

// ---- the rules of a stitch
{
  // a triangle with a tail: c-d is the tail
  const p = mk('a 10 10, b 40 10, c 25 40, d 25 70', 'a-b b-c c-a c-d');
  const st = new Stitch(p), a = 0, b = 1, c = 2, d = 3;
  eq(st.at, -1, 'no needle yet'); ok(!st.stitch(b), 'no stitching before starting');
  ok(st.start(d), 'start at the tail'); eq(st.at, d); eq(st.visits[d], 1, 'the start counts as a touch');
  eq(st.seamTo(a), 'noseam', 'no seam from d to a'); ok(!st.stitch(a)); eq(st.events.at(-1).why, 'noseam');
  ok(st.stitch(c)); ok(st.stitch(a)); ok(st.stitch(b));
  eq(st.seamTo(a), 'used', 'a seam is stitched only once');
  ok(st.stitch(c), 'and back round to c'); ok(st.done, 'every seam stitched');
  ok(st.events.some((e) => e.k === 'done'), 'a done event');
  eq(st.path().map((i) => p.stars[i].name), ['d', 'c', 'a', 'b', 'c'], 'the path');
  ok(st.clean, 'in one go');
  ok(!st.stitch(d), 'nothing after done');
  // unpicking and starting again
  ok(st.undo()); ok(!st.done, 'unpicked'); eq(st.at, b); ok(!st.clean, 'no longer in one go');
  st.restart(); eq(st.at, -1); eq(st.stitched, 0); eq(st.restarts, 1);
  // stuck: go the wrong way round from c and the tail is left
  const s2 = new Stitch(p); s2.start(c); s2.stitch(d);
  eq(s2.stuckWhy(), 'nomoves', 'stranded on the tail'); ok(s2.events.some((e) => e.k === 'stuck'), 'a stuck event');
}
{
  // double seams: stitched twice
  const p = mk('a 10 10, b 40 10, c 70 10', 'a=b b-c');
  const st = new Stitch(p); st.start(1);
  ok(st.stitch(0)); eq(st.count[0], 1, 'once'); ok(st.stitch(1), 'and back'); eq(st.count[0], 2, 'twice');
  eq(st.seamTo(0), 'used', 'no third time'); ok(st.stitch(2)); ok(st.done);
}
{
  // one-way seams
  const p = mk('a 10 10, b 40 10, c 25 40', 'a>b b-c c-a');
  const st = new Stitch(p); st.start(1);
  eq(st.seamTo(0), 'oneway', 'against the comet'); ok(!st.stitch(0)); eq(st.events.at(-1).why, 'oneway');
  ok(st.stitch(2)); ok(st.stitch(0)); ok(st.stitch(1), 'with the comet'); ok(st.done);
  const st2 = new Stitch(p); eq(st2.startRefusal(1), null);
}
{
  // knot stars: touched once
  const p = mk('a 10 10, k 40 10 #, c 25 40, d 60 40', 'a-k k-c c-a k-d');
  const st = new Stitch(p); st.start(idx(p, 'd'));
  ok(st.stitch(idx(p, 'k'))); ok(st.stitch(idx(p, 'a'))); ok(st.stitch(idx(p, 'c')));
  eq(st.seamTo(idx(p, 'k')), 'knot', 'the knot is used up'); ok(!st.done);
  ok(!solve(p), 'a knot with three seams can never be finished');
}
{
  // bright stars: touched exactly that many times
  const p = mk('a 10 40 *2, b 40 10, c 70 40, d 40 70', 'a-b b-c c-d d-a');
  ok(solve(p).start === 0, 'a two-ray star on a loop must be where the thread starts and ends');
  const st = new Stitch(p); st.start(1); st.stitch(2); st.stitch(3); st.stitch(0); st.stitch(1);
  ok(!st.done, 'every seam stitched but the bright star touched once'); eq(st.stuckWhy(), 'bright');
  const p3 = mk('a 10 40 *1, b 40 10, c 70 40, d 40 70, e 90 70', 'a-b b-c c-d d-a c-e');
  const s3 = new Stitch(p3); s3.start(idx(p3, 'e')); s3.stitch(2); s3.stitch(1); s3.stitch(0);
  const s4 = new Stitch(p3); s4.start(0); s4.stitch(1); s4.stitch(2); s4.stitch(3);
  eq(s4.seamTo(0), 'full', 'a one-ray star touched already is full');
}
{
  // twin stars: the needle leaps
  const p = mk('a 10 10, t 40 10 ~u, u 70 60 ~t, v 90 40, w 90 75', 'a-t u-v v-w w-u');
  const st = new Stitch(p); st.start(0); ok(st.stitch(1));
  eq(st.at, 2, 'stitching into one twin lands the needle on the other');
  ok(st.events.some((e) => e.k === 'jump'), 'a jump event'); eq(st.visits[1], 1); eq(st.visits[2], 1);
  ok(st.stitch(3)); ok(st.stitch(4)); ok(st.stitch(2), 'back into u');
  eq(st.at, 1, 'and the needle leaps back to t'); ok(st.done);
  ok(st.undo()); eq(st.at, 4, 'unpicking undoes the leap'); eq(st.visits[1], 1);
}
{
  // moons: start at the crescent, finish at the full moon
  const p = mk('a 10 40 (, b 40 10, c 70 40 ), d 40 70', 'a-b b-c c-d d-a a-c');
  const st = new Stitch(p);
  eq(st.startRefusal(1), 'moon'); ok(!st.start(1)); eq(st.events.at(-1).why, 'moon');
  ok(st.start(0)); st.stitch(1); st.stitch(2); st.stitch(3); st.stitch(0); st.stitch(2);
  ok(st.done, 'finished on the full moon');
  const s2 = new Stitch(p); s2.start(0); s2.stitch(2); s2.stitch(1); s2.stitch(0); s2.stitch(3); s2.stitch(2);
  ok(s2.done, 'another way to the full moon');
}

// ---- the pointer
{
  const p = mk('a 10 40, b 50 40, c 90 40, d 50 75', 'a-b b-c b-d');
  const st = new Stitch(p), r = 4;
  st.down(30, 60, r); eq(st.at, -1, 'pressing on empty sky starts nothing');
  st.up(); st.down(10.5, 40.5, r); eq(st.at, 0, 'pressing on a star starts there'); ok(st.dragging);
  st.move(20, 41, r); eq(st.at, 0, 'a quarter of the way is not a stitch yet');
  st.move(36, 41, r); eq(st.at, 1, 'past halfway along the seam, it snaps to the star');
  st.move(50, 52, r); eq(st.at, 1, 'heading for d but not there yet');
  st.move(50, 62, r); eq(st.at, 3, 'snapped down to d');
  st.move(50, 45, r); eq(st.at, 1, 'dragging back along the thread unpicks it'); eq(st.unpicks, 1);
  st.up(); st.down(90, 40, r); eq(st.at, 2, 'tapping the next star stitches it');
  st.up(); st.down(50, 40, r); eq(st.at, 2, 'tapping the star you came from is refused: that seam is stitched');
  st.up(); st.down(90, 40, r); st.move(60, 40, r); st.move(52, 40, r); eq(st.at, 1, 'drag back from the needle to unpick');
  st.move(50, 75, r); eq(st.at, 3, 'and on to d');
  st.move(13, 40, r); ok(st.at !== 0, 'no seam from d to a: nothing happens');
}
{
  // a drag carries on through a twin's leap, steering the needle from where it landed, and back again
  const p = mk('a 10 10, t 40 10 ~u, u 70 60 ~t, v 90 40, w 90 75', 'a-t u-v v-w w-u');
  const st = new Stitch(p), r = 4;
  st.down(10, 10, r); st.move(25, 10, r); st.move(40, 10, r);
  eq(st.at, 2, 'dragged into t, the needle leaps to u'); ok(st.dragging, 'and the drag goes on');
  eq(st.aim(40, 10), [70, 60], 'the paw on t now steers the needle at u');
  st.move(50, 0, r); st.move(60, -10, r); eq(st.at, 3, 'on from u to v without letting go'); ok(st.dragging);
  st.move(40, 10, r); eq(st.at, 2, 'dragging back unpicks v');
  st.move(25, 10, r); st.move(10, 10, r); eq(st.at, 0, 'and dragging back the way the paw came unpicks the leap'); eq(st.visits[2], 0);
  eq(st.aim(10, 10), [10, 10], 'the leap is off the pointer too');
  st.up(); eq(st.aim(5, 5), [5, 5], 'letting go forgets any leap');
  // a tap into a twin and on: the drag that follows steers from the twin too
  const s2 = new Stitch(p); s2.down(10, 10, r); s2.up(); s2.down(40, 10, r); eq(s2.at, 2); ok(s2.dragging);
  s2.move(50, 0, r); s2.move(60, -10, r); eq(s2.at, 3, 'after a tapped leap, a drag carries on from the twin');
}

// ---- hints
{
  const p = PUZZLE['t3'], st = new Stitch(p);
  const h0 = hint(st); eq(h0.k, 'start'); ok(['tt', 'k'].includes(p.stars[h0.at].name), 'start on an odd star');
  st.start(idx(p, 'tt')); st.stitch(idx(p, 'd'));
  const h1 = hint(st); eq(h1.k, 'next'); ok(h1.to !== idx(p, 'g'), 'never heads off along the body before the shell');
  st.stitch(idx(p, 'g'));
  ok(!solvable(st), 'the shell is stranded');
  const h2 = hint(st); eq(h2.k, 'back'); eq(h2.steps, 1); eq(p.stars[h2.at].name, 'd', 'unpick back to d');
  st.undo(); ok(solvable(st), 'back on course');
  // a hint always leads to the end
  for (const q of PUZZLES) {
    const s = new Stitch(q); let guard = 200;
    while (!s.done && guard--) { const h = hint(s); if (h.k === 'start') s.start(h.at); else if (h.k === 'next') s.stitch(h.to); else break; }
    ok(s.done, `${q.id}: following the hints finishes it`);
  }
}

// ---- generated skies
{
  const days = []; for (let d = 1; d <= 30; d++) days.push(`2026-11-${String(d).padStart(2, '0')}`);
  for (const day of days) {
    const p = dailySky(day); ok(solve(p), `${day}: the daily sky is solvable`);
    ok(p.stars.length >= 6, `${day}: a decent size (${p.stars.length})`);
    eq(dailySky(day).seams, p.seams, `${day}: the same sky for everyone`);
  }
  ok(new Set(days.map((d) => JSON.stringify(dailySky(d).stars))).size === days.length, 'a different sky every day');
  let prev = 0;
  for (let l = 1; l <= 40; l++) {
    const p = shootSky(l); ok(solve(p), `shooting star ${l} is solvable`);
    if (l % 10 === 0) { ok(p.stars.length >= prev, 'the skies grow'); prev = p.stars.length; }
  }
  ok(shootSky(30).stars.length > shootSky(1).stars.length + 5, 'much bigger by sky 30');
  for (let seed = 1; seed <= 40; seed++) { const p = generate(seed, { stars: 8 + (seed % 9), rules: ['bright', 'knot', 'double', 'oneway', 'cloud', 'moon'].filter((_, i) => (seed >> i) & 1), name: 'g', id: 'g' + seed }); ok(solve(p), `generated sky ${seed} is solvable`); }
}

// ---- progress and saving
{
  eq(SAVE_KEY, 'starstitch-v1');
  const s = freshSave();
  ok(puzzleOpen(s, 't1') && !puzzleOpen(s, 't2'), 'the first lesson opens first');
  ok(puzzleOpen(s, 'n1-1'), 'night 1 is open from the start (the lessons can be skipped)');
  ok(!puzzleOpen(s, 'n1-2') && !nightOpen(s, 2), 'one at a time');
  eq(nextPuzzle(s).id, 't1');
  const st = play(PUZZLE['n1-1'], solve(PUZZLE['n1-1']));
  const r = record(s, st); ok(r.first && r.medal && r.newMedal && r.earned, 'first time, one go, a hint earned');
  eq(s.bank, 2); ok(puzzleOpen(s, 'n1-2'));
  const st2 = new Stitch(PUZZLE['n1-1']); const sol = solve(PUZZLE['n1-1']); st2.start(sol.start); st2.stitch(sol.path[0]); st2.undo(); for (const to of sol.path) st2.stitch(to); st2.hints = 1;
  const r2 = record(s, st2); ok(!r2.first && !r2.medal && !r2.earned, 'again, with unpicking and a hint'); ok(s.solved['n1-1'].one, 'the medal is kept');
  for (const p of STORY) s.solved[p.id] = { one: true, hint: false };
  ok(storyDone(s)); eq(solvedCount(s), 40); eq(medals(s), 40); ok(nightOpen(s, 5));
  s.bank = BANK_MAX; const r3 = record(s, play(PUZZLE['n1-2'], solve(PUZZLE['n1-2']))); ok(!r3.earned, 'the bank is full');
  // the daily streak
  const d = freshSave();
  ok(recordDaily(d, '2026-10-31', '2026-10-30')); eq(d.daily.streak, 1);
  ok(!recordDaily(d, '2026-10-31', '2026-10-30'), 'once a day');
  ok(recordDaily(d, '2026-11-01', '2026-10-31')); eq(d.daily.streak, 2, 'two in a row');
  ok(recordDaily(d, '2026-11-05', '2026-11-04')); eq(d.daily.streak, 1, 'a missed day starts again');
  eq(dayBefore('2026-11-01'), '2026-10-31'); eq(dayBefore('2027-01-01'), '2026-12-31'); eq(dayBefore('2028-03-01'), '2028-02-29'); eq(dayBefore('2026-03-01'), '2026-02-28');
  // saving and reading back
  const back = readSave(JSON.stringify(s)); eq(back.solved, s.solved); eq(back.bank, s.bank);
  eq(readSave(null), freshSave()); eq(readSave('not json'), freshSave()); eq(readSave('[]'), freshSave()); eq(readSave('{"v":2}'), freshSave());
  const bad = readSave('{"v":1,"solved":{"n1-1":{"one":"yes"},"n1-3":{"one":true},"zz":{"one":true},"n2-1":5},"bank":99,"seen":[1,"t1",{"x":1}],"ended":true,"daily":{"last":"tomorrow","streak":-4,"done":["2026-10-31","nope"]},"shoot":{"level":"x","best":1e9},"settings":{"sound":0}}');
  eq(Object.keys(bad.solved), ['n1-1'], 'only real puzzles, in order: n1-3 without n1-2 is dropped');
  eq(bad.solved['n1-1'], { one: false, hint: false }); eq(bad.bank, BANK_MAX); eq(bad.seen, ['t1']); ok(!bad.ended, 'not ended before the story is done');
  eq(bad.daily, { last: '', streak: 0, done: ['2026-10-31'] }); eq(bad.shoot, { level: 1, best: 999 }); ok(bad.settings.sound && bad.settings.music);
}

console.log(`stars: ${checks} checks passed`);
