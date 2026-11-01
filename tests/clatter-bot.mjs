// Clatterbox bot. A searching tinkerer solves every puzzle from its starting layout, trying placements the way a
// player could: each tray part on a half-unit grid over the build areas, ramps and planks turned through every 15°
// step up to ±60°, springs and fans aimed a few ways, cars and bellows facing both ways, standing parts settled onto
// whatever is below them. It searches one part at a time (a beam: the most promising contraptions, by how close they
// get the chain to the goal, are carried on to the next part), so the fewest parts it needs is the puzzle's par (the
// second star), which must match the par in lib/clatter-levels.ts; its solutions are recorded in
// tests/clatter-solutions.json. A random tinkerer throws every tray part anywhere in the build areas, 120 times a
// puzzle: where par is three or more it never solves one, where par is two at most one throw in twenty, and where par is one (the
// teaching puzzles) at most one throw in three. The
// starting layout alone never solves a puzzle. With --quick, the recorded solutions are replayed instead of searching
// (and no random throws); `--write` searches and rewrites the recorded solutions (with a puzzle id, only that one).
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { PUZZLES, PUZZLE_IDS, PARTS, Run, simulate, placeProblem, settle, SETTLES, GOAL_PARTS } from '../.checks/clatter-game.js';

const quick = process.argv.includes('--quick'), write = process.argv.includes('--write');
const only = process.argv.find((a) => /^\d-\d$/.test(a));
const file = new URL('./clatter-solutions.json', import.meta.url);
const stored = (() => { try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return {}; } })();
const BEAM = 5;

/** Every way a part may be set down, given what is placed already. */
function candidates(P, placed, p) {
  const out = [], seen = new Set();
  const rots = PARTS[p].rot ? (p === 'ramp' || p === 'plank' ? [-4, -3, -2, -1, 0, 1, 2, 3, 4] : p === 'spring' ? [-2, -1, 0, 1, 2] : p === 'fan' ? [-1, 0, 1] : p === 'pin' ? [0, 6, 12, 18] : [0]) : [0];
  const flips = PARTS[p].flip ? [0, 1] : [0];
  for (const [x0, y0, x1, y1] of P.zones) {
    // standing parts settle, so only where along matters (in quarter units), and a few heights for the shelves they land on
    const st = SETTLES.includes(p), dx = st ? 0.25 : 0.5;
    for (let x = x0 + 0.25; x <= x1 - 0.2; x += dx) for (let y = y1 - 0.25; y >= y0 + 0.2; y -= 0.5) for (const r of rots) for (const f of flips) {
      let pl = { p, x, y, r, f };
      if (SETTLES.includes(p)) { pl = settle(P, placed, pl); if (!pl) continue; }
      else if (placeProblem(P, placed, pl)) continue;
      const key = `${pl.x.toFixed(2)},${pl.y.toFixed(2)},${r},${f}`; if (seen.has(key)) continue; seen.add(key);
      out.push(pl);
    }
  }
  return out;
}
/** Runs a contraption, scoring how near the chain got: goals met count most, then how close anything came to the next goal. */
function score(P, places) {
  const r = new Run(P, places), end = Math.round(((P.time ?? 16) + 0.5) * 60);
  const home = new Map(r.B.world.bodies.map((b) => [b, [b.x, b.y]]));
  let close = Infinity;
  while (!r.outcome && r.steps < end) {
    r.step();
    if (r.steps % 4) continue;
    r.goals.forEach((g, i) => {
      if (r.goalHit[i]) return;
      const gx = g.body.x, gy = g.p === 'bell' ? g.body.y - 0.4 : g.body.y + 0.4;
      for (const b of r.B.world.bodies) {
        if (b.isStatic || b === g.body) continue;
        const q = r.partFor(b), h = home.get(b); if (!q || (g.p === 'bowl' && q.p !== 'acorn')) continue;
        // a placed part counts once it has been set moving by the chain
        if (q.role === 'placed' && (!h || Math.hypot(b.x - h[0], b.y - h[1]) < 1)) continue;
        close = Math.min(close, Math.hypot(b.x - gx, b.y - gy));
      }
    });
  }
  const hits = r.goalHit.filter(Boolean).length;
  return { win: r.outcome === 'win', token: r.token, s: hits * 100 - Math.min(close, 30) + (r.token ? 0.5 : 0) };
}
const key = (pl) => pl.map((q) => `${q.p}@${q.x},${q.y},${q.r},${q.f}`).sort().join(';');

/** The beam search: the fewest parts that solve the puzzle, and a solution (with the button, if one was found). */
function search(P) {
  const total = Object.values(P.tray).reduce((a, b) => a + b, 0);
  let beam = [[]], sims = 0;
  for (let depth = 1; depth <= total; depth++) {
    const next = [], seen = new Set(); let wins = [];
    for (const placed of beam) {
      const left = { ...P.tray }; for (const q of placed) left[q.p]--;
      for (const p of Object.keys(left)) {
        if (left[p] <= 0) continue;
        for (const c of candidates(P, placed, p)) {
          const pl = [...placed, c], k = key(pl); if (seen.has(k)) continue; seen.add(k);
          const r = score(P, pl); sims++;
          if (r.win) wins.push({ pl, token: r.token });
          else next.push({ pl, s: r.s });
        }
      }
      if (wins.some((w) => w.token)) break;
    }
    if (wins.length) { const best = wins.find((w) => w.token) ?? wins[0]; return { par: depth, sol: best.pl, token: best.token, sims }; }
    next.sort((a, b) => b.s - a.s);
    if (process.argv.includes('--show')) console.log('  depth', depth, next.slice(0, 3).map((n) => n.s.toFixed(2) + ' ' + JSON.stringify(n.pl)).join('\n   '));
    // keep the best few of each mix of parts, so one kind of part can't crowd out the rest
    const by = new Map();
    for (const n of next) { const k = n.pl.map((q) => q.p).sort().join('+'); const l = by.get(k) ?? []; if (l.length < BEAM) l.push(n); by.set(k, l); }
    beam = [...by.values()].flat().map((n) => n.pl);
  }
  return { par: null, sims };
}

// a small seeded generator for the random tinkerer
let seed = 7;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
function randomThrow(P) {
  const out = [];
  for (const [p, n] of Object.entries(P.tray)) for (let i = 0; i < n; i++) {
    for (let tries = 0; tries < 12; tries++) {
      const z = P.zones[Math.floor(rnd() * P.zones.length)];
      let pl = { p, x: z[0] + rnd() * (z[2] - z[0]), y: z[1] + rnd() * (z[3] - z[1]), r: PARTS[p].rot ? Math.floor(rnd() * 24) - 12 : 0, f: PARTS[p].flip && rnd() < 0.5 ? 1 : 0 };
      if (SETTLES.includes(p)) pl = settle(P, out, pl); else if (placeProblem(P, out, pl)) pl = null;
      if (pl) { out.push(pl); break; }
    }
  }
  return out;
}

const t0 = Date.now(), out = { ...stored };
let checked = 0;
for (const id of PUZZLE_IDS) {
  if (only && id !== only) continue;
  const P = PUZZLES[id], t1 = Date.now();
  { const e = simulate(P, []); assert.ok(!e.win && !e.token, `${id}: the starting layout alone neither solves it nor takes the button`); }
  if (quick) {
    const s = stored[id];
    assert.ok(s, `${id}: a recorded solution`);
    assert.equal(s.sol.length, P.par, `${id}: the recorded solution uses par (${P.par}) parts`);
    assert.ok(simulate(P, s.sol).win, `${id}: the recorded solution still solves it`);
    checked++; continue;
  }
  const r = search(P);
  if (process.argv.includes('--show')) console.log(id, 'found', r.par, r.token, JSON.stringify(r.sol));
  assert.ok(r.par !== null, `${id}: the bot finds a solution (${r.sims} runs)`);
  assert.equal(r.par, P.par, `${id}: par is the fewest parts the bot needed (${r.par})`);
  out[id] = { par: r.par, token: r.token, sol: r.sol.map((q) => ({ ...q, x: +q.x.toFixed(3), y: +q.y.toFixed(3) })) };
  let wins = 0; const throws = 120;
  seed = [...id].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) & 0x7fffffff;
  for (let i = 0; i < throws; i++) if (simulate(P, randomThrow(P)).win) wins++;
  if (P.par >= 3) assert.equal(wins, 0, `${id}: random throws never solve a puzzle that needs ${P.par} parts`);
  else if (P.par === 2) assert.ok(wins <= throws / 20, `${id}: random throws rarely solve a puzzle that needs two parts (${wins} of ${throws})`);
  else assert.ok(wins <= throws / 3, `${id}: random throws solve a one-part puzzle at most one time in three (${wins} of ${throws})`);
  console.log(`${id} ${P.name}: par ${r.par}${r.token ? ' (with the button)' : ''} after ${r.sims} runs; random ${wins}/${throws}; ${((Date.now() - t1) / 1000).toFixed(1)} s`);
  checked++;
}
if (write) writeFileSync(file, JSON.stringify(out, null, 1) + '\n');
console.log(`clatter bot: ${checked} puzzles ${quick ? 'replayed' : 'searched'} in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
