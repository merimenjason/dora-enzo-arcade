// Combo Ball bots. The pro dribbles at goal away from the nearest Grumble, passes to the team-mate with the most room
// and a clear lane whenever a Grumble closes in (first time when it can), and shoots once it's near the box, with
// more patience while the chain's still small. The greedy player won't shoot before eight passes; the hoofer shoots
// the moment it has the ball; the random player mashes. Runs should go deep with good passing, much less far with
// hoofing, and nowhere at random. Run after `npm test` has compiled the engine into .checks/ (or `npm run bot:combo`).
import assert from 'node:assert/strict';
import { Run, PITCH, CY, MATCHES } from '../.checks/combo-game.js';

const quick = process.argv.includes('--quick');
const RUNS = quick ? 10 : 40;

function rngOf(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
const PICKS = ['tiki', 'metronome', 'hotstreak', 'coolhead', 'piggy', 'lateshow', 'crossfield', 'routeone', 'longrange', 'backheel', 'volley', 'ricochet', 'backpass', 'nutmeg'];
const hyp = Math.hypot;

/** the open team-mate with the clearest lane, favouring ones further up the pitch */
function bestMate(r, c, forward = 0.15) {
  let best = null, bs = -1e9;
  for (const q of r.players) {
    if (q.team !== 0 || q.keeper || q.i === c.i) continue;
    const dx = q.x - c.x, dy = q.y - c.y, d = hyp(dx, dy) || 1;
    let lane = 999;
    for (const g of r.players) {
      if (g.team !== 1 || g.keeper) continue;
      const gx = g.x - c.x, gy = g.y - c.y, along = (gx * dx + gy * dy) / d;
      if (along > 0 && along < d) lane = Math.min(lane, Math.abs(gx * dy - gy * dx) / d);
    }
    const s = Math.min(lane, 30) * 1.2 + Math.min(r.openness(q), 40) + (q.x - c.x) * forward - Math.abs(d - 80) * 0.1;
    if (s > bs) { bs = s; best = q; best.lane = lane; }
  }
  return best;
}

function makeBot(kind, rnd) {
  let shootFor = 0, passTap = false, react = 0, loft = 0, loftAim = null;
  return (r) => {
    const inp = { ax: 0, ay: 0, pass: false, shoot: false, swap: false };
    const p = r.players[r.ctl], b = r.ball;
    if (kind === 'random') { inp.ax = rnd() * 2 - 1; inp.ay = rnd() * 2 - 1; inp.pass = rnd() < 0.3; inp.shoot = rnd() < 0.2; return inp; }
    if (shootFor > 0) { shootFor--; inp.shoot = shootFor > 0; return inp; }
    if (passTap) { passTap = false; return inp; }
    if (loft > 0) { loft--; if (r.ball.owner !== p.i) { loft = 0; return inp; } inp.ax = loftAim[0]; inp.ay = loftAim[1]; inp.pass = loft > 0; return inp; }
    const passTo = (m) => {
      const l = hyp(m.x - p.x, m.y - p.y) || 1, aim = [(m.x - p.x) / l, (m.y - p.y) / l];
      inp.ax = aim[0]; inp.ay = aim[1]; inp.pass = true;
      if (kind === 'pro' && m.lane < 14 && l > 40) { loftAim = aim; loft = 14; } else passTap = true;
      return inp;
    };
    const grumbles = r.players.filter((g) => g.team === 1 && !g.keeper);
    const near = grumbles.slice().sort((a, c) => hyp(a.x - p.x, a.y - p.y) - hyp(c.x - p.x, c.y - p.y))[0];
    const nd = near ? hyp(near.x - p.x, near.y - p.y) : 999;
    if (b.owner === p.i) {
      const toGoal = PITCH.x1 - p.x, wide = Math.abs(p.y - CY);
      const want = kind === 'greedy' ? r.chain.passes >= 8 : kind === 'hoofer' ? true : (r.chain.passes >= 4 || r.clock < 15 || r.chain.mult >= 4 || (r.chain.passes >= 2 && (r.points + (10 + r.chain.chips) * (r.chain.mult + 1)) >= r.target));
      if (want && toGoal < (kind === 'hoofer' ? 400 : 82) && wide < 50) { shootFor = toGoal < 50 ? 2 : 14; inp.shoot = true; return inp; }
      // the pro plays it first time while the chain's still building, unless there's room to run
      if (kind === 'pro' && p.hold < 0.2 && r.chain.passes < 6 && (nd < 45 || r.chain.passes < 4)) {
        const m = bestMate(r, p, r.chain.passes >= 3 ? 0.7 : 0.2);
        if (m) return passTo(m);
      }
      const pressed = nd < 22 || (near && near.wind > 0) || p.hold > (kind === 'greedy' ? 0.5 : 0.9);
      if (pressed && !(kind === 'hoofer')) {
        const m = bestMate(r, p, r.chain.passes >= 3 ? 0.6 : 0.15);
        if (m) return passTo(m);
      }
      // dribble at goal, edging away from the nearest Grumble
      let dx = PITCH.x1 - p.x, dy = CY - p.y; const l = hyp(dx, dy) || 1; dx /= l; dy /= l;
      if (near && nd < 34) { dy += (p.y > near.y ? 1 : -1) * 0.9; }
      inp.ax = dx; inp.ay = dy;
      return inp;
    }
    if (r.pass && r.pass.to === p.i && b.owner < 0) {
      // the ball's coming: line up a first-time pass if a Grumble is close, or a first-time shot near goal
      const d = hyp(b.x - p.x, b.y - p.y);
      if (kind === 'pro' && d < 30 && !r.queue && react++ % 2 === 0) {
        if (PITCH.x1 - p.x < 75 && Math.abs(p.y - CY) < 45 && r.chain.passes >= 3) { inp.shoot = true; shootFor = 2; return inp; }
        if (nd < 30) { const m = bestMate(r, p); if (m) { inp.ax = m.x - p.x; inp.ay = m.y - p.y; inp.pass = true; passTap = true; return inp; } }
      }
      return inp;
    }
    // defending: get to the ball and slide in when close
    if (r.poss !== 0) {
      let dx = b.x - p.x, dy = b.y - p.y; const d = hyp(dx, dy) || 1;
      inp.ax = dx / d; inp.ay = dy / d;
      if (d < 13 && b.owner >= 0 && r.players[b.owner].team === 1 && p.slide <= 0 && p.stun <= 0 && rnd() < 0.25) inp.shoot = true;
    }
    return inp;
  };
}

export function play(kind, seed) {
  const r = new Run(seed), rnd = rngOf(seed * 7 + 3);
  const bot = makeBot(kind, rnd);
  let n = 0;
  while ((r.phase === 'play' || r.phase === 'shop') && n++ < 60 * 60 * 30) {
    if (r.phase === 'shop') {
      const id = PICKS.find((k) => r.offer.includes(k));
      if (r.traits.length >= 5) r.pick(undefined); else r.pick(kind === 'random' ? undefined : id);
      continue;
    }
    r.tick(bot(r));
  }
  return r;
}

import { pathToFileURL } from 'node:url';
if (import.meta.url === pathToFileURL(process.argv[1]).href) main();

function main() {
const out = {};
for (const kind of ['pro', 'greedy', 'hoofer', 'random']) {
  let won = 0, matches = 0, goals = 0, best = 0, pts = 0;
  for (let k = 0; k < RUNS; k++) {
    const r = play(kind, 1000 + k * 17);
    if (r.phase === 'won') won++;
    matches += r.stats.won; goals += r.stats.goals; best = Math.max(best, r.stats.best); pts += r.stats.points;
  }
  out[kind] = { won, matches: matches / RUNS, goals: goals / RUNS, best };
  console.log(`${kind.padEnd(7)} ${won}/${RUNS} won · ${(matches / RUNS).toFixed(1)} matches · ${(goals / RUNS).toFixed(1)} goals · ${Math.round(pts / Math.max(1, goals))} a goal · best goal ${best}`);
}
assert.ok(out.pro.matches >= 4, 'good passing should get well into the run');
assert.ok(out.pro.matches > out.hoofer.matches + 1, 'passing should beat hoofing');
assert.equal(out.random.won, 0, 'mashing should never win');
assert.ok(out.random.matches < 1, 'mashing should not get past the first match');
console.log(`Combo Ball bots: pro clears ${out.pro.matches.toFixed(1)} of ${MATCHES} matches on average.`);
}
