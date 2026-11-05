// Into Space bots. The pro leads a runner into space: it looks for spots ahead of each teammate that he can reach just
// as a pass would land and the nearest Grumble can't, lofting it over anyone in the lane, then times the run so it
// arrives right on the landing, and shoots first time from the box. The early bot passes the same way but sprints
// straight to every spot and waits there. The to-feet bot passes along the ground to where teammates stand. The random
// player runs, passes and shoots at random. Into space should beat to feet, timing should beat waiting, and a random
// player should never lift the cup. Run after `npm test` has compiled the engine into .checks/ (or `npm run bot:space`).
import assert from 'node:assert/strict';
import { Run, noInput, PITCH, CX, CY, GOAL, SPEED, ROUNDS, ARRIVE } from '../.checks/space-game.js';

const quick = process.argv.includes('--quick');
const RUNS = quick ? 12 : 40;
const LIMIT = 60 * 60 * 30;

function rngOf(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
const dist = (a, b, c, d) => Math.hypot(a - c, b - d);
const PICKS = ['wide', 'carousel', 'switch', 'bender', 'backspin', 'wall', 'poacher', 'knuckle', 'decoy', 'sprinter', 'heavy', 'sweeper'];

/** the best pass the bot can see: a spot ahead of a teammate that he reaches as the ball lands, and no Grumble does */
function findPass(r, me, opts) {
  const b = r.ball, greens = r.players.filter((p) => p.side === 1 && !p.gk);
  let best = null;
  for (const q of r.players) {
    if (q.side !== 0 || q.gk || q.i === me.i) continue;
    const sp = r.speedOf(q);
    const spots = opts.toFeet ? [[0, 0]] : [[50, 0], [70, -18], [70, 18], [40, -26], [40, 26], [90, 0], [30, 0], [60, -34], [60, 34]];
    for (const [dx, dy] of spots) {
      const x = Math.min(PITCH.x1 - 10, q.x + dx), y = Math.max(PITCH.y0 + 8, Math.min(PITCH.y1 - 8, q.y + dy));
      const lane = greens.some((g) => {
        const vx = x - b.x, vy = y - b.y, l2 = vx * vx + vy * vy || 1, t = Math.max(0, Math.min(1, ((g.x - b.x) * vx + (g.y - b.y) * vy) / l2));
        return dist(g.x, g.y, b.x + vx * t, b.y + vy * t) < 10;
      });
      const loft = lane && !opts.toFeet;
      const f = r.plan(b.x, b.y, x, y, loft, false);
      const eta = dist(q.x, q.y, f.tx, f.ty) / sp;
      // a spot the runner can reach with time to spare, so it's down to him to arrive on time
      if (!opts.toFeet && eta > f.T - 0.08) continue;
      const theirs = Math.min(...greens.map((g) => dist(g.x, g.y, f.tx, f.ty) / r.speedOf(g)));
      const margin = theirs - f.T;
      if (!opts.toFeet && margin < 0.15) continue;
      if (opts.toFeet && lane) continue;
      // time to spare means the runner can be sure of getting there, as long as he doesn't arrive too soon
      const slack = Math.min(0.6, f.T - eta);
      const score = (f.tx - b.x) * 0.6 + Math.min(1, margin) * 40 + slack * 25 + (f.tx > PITCH.x1 - 90 ? 30 : 0) - f.d * 0.05;
      if (!best || score > best.score) best = { x: f.tx, y: f.ty, loft, score, q };
    }
  }
  return best;
}

function bot(kind, rnd) {
  let held = 0, shootHeld = 0;
  return (r) => {
    const inp = noInput();
    const me = r.players[r.ctrl], b = r.ball;
    if (kind === 'random') {
      inp.mx = rnd() * 2 - 1; inp.my = rnd() * 2 - 1;
      if (b.owner === me.i && rnd() < 0.02) { inp.passNow = true; inp.spot = { x: me.x + (rnd() * 2 - 1) * 120, y: me.y + (rnd() * 2 - 1) * 90 }; inp.loft = rnd() < 0.5; }
      if (rnd() < 0.03) inp.shoot = true;
      return inp;
    }
    if (b.owner === me.i) {
      held++;
      const ft = r.first && r.first.i === me.i && r.gt <= r.first.until;
      const range = PITCH.x1 - me.x, keeper = r.players.find((p) => p.side === 1 && p.gk);
      const aimY = keeper.y > CY ? GOAL.y0 + 4 : GOAL.y1 - 4;
      if (range < 70 && Math.abs(me.y - CY) < 40 && (ft || held > 8 || shootHeld > 0)) {
        inp.aimY = aimY;
        if (ft) { inp.shoot = true; return inp; }
        shootHeld++; inp.shoot = shootHeld < 14; if (!inp.shoot) shootHeld = 0;
        inp.mx = 0.3; return inp;
      }
      const greens = r.players.filter((p) => p.side === 1 && !p.gk);
      const pressed = greens.some((g) => dist(g.x, g.y, me.x, me.y) < 14);
      if (held > (ft ? 0 : 12) || pressed) {
        const p = findPass(r, me, { toFeet: kind === 'toFeet' });
        if (p && (p.score > 18 || pressed || held > 60)) { inp.passNow = true; inp.spot = { x: p.x, y: p.y }; inp.loft = p.loft; held = 0; return inp; }
      }
      // dribble at goal, edging away from the nearest Grumble
      let ty = CY; const g = greens.sort((a, c) => dist(a.x, a.y, me.x, me.y) - dist(c.x, c.y, me.x, me.y))[0];
      if (g && dist(g.x, g.y, me.x, me.y) < 24) ty = me.y + (me.y > g.y ? 30 : -30);
      const dx = PITCH.x1 - 30 - me.x, dy = ty - me.y, l = Math.hypot(dx, dy) || 1;
      inp.mx = dx / l; inp.my = dy / l;
      return inp;
    }
    held = 0; shootHeld = 0;
    const ps = r.pass;
    if (ps && ps.receiver === me.i && r.players[ps.passer].side === 0) {
      const f = r.flight;
      if (f) {
        // time the run: arrive on the spot just as it lands (the early bot just sprints there)
        const d = dist(me.x, me.y, f.tx, f.ty), left = ps.land - r.gt, sp = r.speedOf(me);
        const want = kind === 'early' ? 1 : (d < ARRIVE - 2 ? 0.5 : Math.min(1, (d - ARRIVE + 2) / Math.max(0.03, left) / sp));
        inp.mx = ((f.tx - me.x) / (d || 1)) * want; inp.my = ((f.ty - me.y) / (d || 1)) * want;
        if (kind === 'pro' && d / sp > left + 0.05) inp.sprint = true;
        return inp;
      }
    }
    // chase the ball, and tackle a Grumble who has it
    const c = b.owner >= 0 ? r.players[b.owner] : null;
    const tx = b.x, ty = b.y, d = dist(me.x, me.y, tx, ty);
    inp.mx = (tx - me.x) / (d || 1); inp.my = (ty - me.y) / (d || 1);
    if (c && c.side === 1 && !c.gk && d < 9) inp.shoot = rnd() < 0.5;
    return inp;
  };
}

function play(kind, seed) {
  const rnd = rngOf(seed * 7 + 3), r = new Run(seed), drive = bot(kind, rnd);
  let n = 0;
  while ((r.phase === 'match' || r.phase === 'pick') && n < LIMIT) {
    if (r.phase === 'pick') { const want = PICKS.find((p) => r.offer.includes(p)); r.pick(kind === 'random' ? r.offer[0] : want); continue; }
    r.tick(drive(r)); n++;
  }
  return r;
}

const out = {};
for (const kind of ['pro', 'early', 'toFeet', 'random']) {
  let rounds = 0, cups = 0, gf = 0, ga = 0, perf = 0, passes = 0, early = 0, late = 0, matches = 0;
  for (let k = 0; k < RUNS; k++) {
    const r = play(kind, 1000 + k * 37);
    rounds += r.stats.rounds; if (r.phase === 'won') cups++;
    gf += r.stats.goals; ga += r.stats.against; perf += r.stats.perfects; early += r.stats.early; late += r.stats.late; passes += r.stats.passes;
    matches += Math.min(ROUNDS, r.stats.rounds + 1);
  }
  out[kind] = { rounds: rounds / RUNS, cups, gf: gf / matches, ga: ga / matches, perfect: perf / Math.max(1, perf + early + late), passes: passes / matches };
  console.log(`${kind.padEnd(7)} rounds won ${out[kind].rounds.toFixed(2)} · cups ${cups}/${RUNS} · goals ${out[kind].gf.toFixed(2)}–${out[kind].ga.toFixed(2)} a match · perfect ${(out[kind].perfect * 100).toFixed(0)}% · ${out[kind].passes.toFixed(1)} passes a match`);
}
assert.ok(out.pro.rounds >= 3, 'the pro should get through at least three rounds on average');
assert.ok(out.toFeet.rounds < out.pro.rounds - 0.5, 'passing to feet should do clearly worse than passing into space');
assert.ok(out.early.perfect < out.pro.perfect - 0.2, 'arriving early should rarely be perfect');
assert.ok(out.early.rounds < out.pro.rounds, 'timing the run should beat sprinting there and waiting');
assert.equal(out.random.cups, 0, 'a random player should never lift the cup');
console.log('PASS Into Space bots');
void CX; void SPEED;
