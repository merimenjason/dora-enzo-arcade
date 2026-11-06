// Into Space bots, playing like people rather than machines: every input reaches the game 12 to 15 ticks after the bot
// decides it (a human's reaction time), passes and shots are aimed with a wobble, and on the ball a bot stops to think,
// which is when time stands still. The pro leads a runner into space: a spot ahead of a teammate that he can reach just
// as the pass lands and the nearest Grumble can't, lofted over anyone in the lane, then times the run onto it and
// shoots first time from the box. The casual player is a careless human: slower to react, a bigger wobble, takes any
// pass that looks on, and gets the timing of his runs a bit wrong every time. The early bot sprints to every spot and
// waits; the to-feet bot passes along the ground to where teammates stand; the random player mashes. With Assist on
// (the default) a casual player should get through a few rounds and sometimes win the cup; with it off, into space
// should still beat to feet and timing should beat waiting. Run after `npm test` has compiled the engine into .checks/
// (or `npm run bot:space`).
import assert from 'node:assert/strict';
import { Run, noInput, PITCH, CX, CY, GOAL, SPEED, ROUNDS, ARRIVE } from '../.checks/space-game.js';

const quick = process.argv.includes('--quick');
const RUNS = quick ? 20 : 40;
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
      if (!opts.toFeet && margin < (opts.careless ? 0 : 0.15)) continue;
      if (opts.toFeet && lane) continue;
      // time to spare means the runner can be sure of getting there, as long as he doesn't arrive too soon
      const slack = Math.min(0.6, f.T - eta);
      const score = (f.tx - b.x) * 0.6 + Math.min(1, margin) * 40 + slack * 25 + (f.tx > PITCH.x1 - 90 ? 30 : 0) - f.d * 0.05;
      const cand = { x: f.tx, y: f.ty, loft, score, q };
      if (opts.list) opts.list.push(cand);
      if (!best || score > best.score) best = cand;
    }
  }
  return best;
}

/** how each bot plays: reaction delay in ticks, aim wobble in pixels, and how wrong it gets the timing of a run */
const STYLE = {
  pro: { delay: 12, wobble: 5, timing: 0.04 },
  casual: { delay: 15, wobble: 14, timing: 0.16, careless: true },
  // the early bot is a machine on purpose: it sprints the moment the ball's kicked, to show that waiting there loses
  early: { delay: 0, wobble: 5, timing: 0 },
  toFeet: { delay: 12, wobble: 5, timing: 0.04 },
  random: { delay: 12, wobble: 0, timing: 0 },
};

/** a bot's decisions, made on what it sees now and reaching the game `delay` ticks later */
function bot(kind, rnd) {
  const st = STYLE[kind], queue = [];
  const decide = mind(kind, rnd, st);
  return (r) => {
    queue.push(decide(r));
    return queue.length > st.delay ? queue.shift() : noInput();
  };
}

function mind(kind, rnd, st) {
  let held = 0, shootHeld = 0, fired = 0, think = 0, plan = null, bias = 0, dribble = 0;
  const wob = () => (rnd() * 2 - 1) * st.wobble;
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
      // played it: stand still until the game catches up, and try again if it didn't take
      if (fired && fired++ < st.delay + 12) return inp;
      fired = 0;
      held++;
      const ft = r.first && r.first.i === me.i && r.gt <= r.first.until;
      const range = PITCH.x1 - me.x, keeper = r.players.find((p) => p.side === 1 && p.gk);
      // a shot: stop, aim at the corner away from the keeper, hold for power, let go
      if (plan === 'shoot' || (range < 70 && Math.abs(me.y - CY) < 40 && (ft || held > 8))) {
        plan = 'shoot';
        inp.aimY = (keeper.y > CY ? GOAL.y0 + 4 : GOAL.y1 - 4) + wob() * 0.6;
        if (ft && !r.frozen) { inp.shoot = true; fired = 1; return inp; }
        if (!r.frozen) return inp; // stopping
        shootHeld++; inp.shoot = shootHeld < 14; if (!inp.shoot) { shootHeld = 0; fired = 1; }
        return inp;
      }
      const greens = r.players.filter((p) => p.side === 1 && !p.gk);
      const pressed = greens.some((g) => dist(g.x, g.y, me.x, me.y) < 14);
      if (dribble > 0) dribble--;
      else if (plan === 'pass' || held > (ft ? 0 : 12) || pressed) {
        // a first-time pass goes at once; otherwise stop on the ball, and think while time stands still
        if (!ft && !r.frozen) { plan = 'pass'; return inp; }
        if (!ft && think++ < 4) return inp;
        const list = [];
        const p = findPass(r, me, { toFeet: kind === 'toFeet', careless: st.careless, list });
        let pick = p;
        if (st.careless && list.length) { list.sort((a, c) => c.score - a.score); pick = list[Math.floor(rnd() * Math.min(3, list.length))]; }
        if (pick && (pick.score > 18 || pressed || held > 60 || plan === 'pass')) {
          inp.passNow = true; inp.spot = { x: pick.x + wob(), y: pick.y + wob() }; inp.loft = pick.loft; held = 0; fired = 1; think = 0; plan = null;
          bias = (rnd() * 2 - 1) * st.timing - (st.careless ? 0.04 : 0);
          return inp;
        }
        // nothing on: carry it on for a while before looking again
        plan = null; think = 0; dribble = 40;
      }
      // dribble at goal, edging away from the nearest Grumble
      let ty = CY; const g = greens.sort((a, c) => dist(a.x, a.y, me.x, me.y) - dist(c.x, c.y, me.x, me.y))[0];
      if (g && dist(g.x, g.y, me.x, me.y) < 24) ty = me.y + (me.y > g.y ? 30 : -30);
      const dx = PITCH.x1 - 30 - me.x, dy = ty - me.y, l = Math.hypot(dx, dy) || 1;
      inp.mx = dx / l; inp.my = dy / l;
      return inp;
    }
    held = 0; shootHeld = 0; fired = 0; think = 0; plan = null; dribble = 0;
    const ps = r.pass;
    if (ps && ps.receiver === me.i && r.players[ps.passer].side === 0 && b.owner < 0) {
      // time the run: arrive on the spot just as it lands (the early bot just sprints there); everyone gets it a bit wrong
      const d = dist(me.x, me.y, ps.x, ps.y), left = ps.land - r.gt + bias, sp = r.speedOf(me);
      if (r.flight || d > ARRIVE) {
        const want = kind === 'early' ? 1 : (d < ARRIVE - 2 ? 0.5 : Math.min(1, (d - ARRIVE + 2) / Math.max(0.03, left) / sp));
        inp.mx = ((ps.x - me.x) / (d || 1)) * want; inp.my = ((ps.y - me.y) / (d || 1)) * want;
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

function play(kind, seed, assist) {
  const rnd = rngOf(seed * 7 + 3), r = new Run(seed, assist), drive = bot(kind, rnd);
  let n = 0;
  while ((r.phase === 'match' || r.phase === 'pick') && n < LIMIT) {
    if (r.phase === 'pick') { const want = PICKS.find((p) => r.offer.includes(p)); r.pick(kind === 'random' ? r.offer[0] : want); continue; }
    r.tick(drive(r)); n++;
  }
  return r;
}

const out = {};
const report = (label, kind, assist) => {
  let rounds = 0, cups = 0, gf = 0, ga = 0, perf = 0, passes = 0, early = 0, late = 0, matches = 0;
  for (let k = 0; k < RUNS; k++) {
    const r = play(kind, 1000 + k * 37, assist);
    assert.ok(r.phase === 'won' || r.phase === 'lost', `${label} run ${k} never finished`);
    rounds += r.stats.rounds; if (r.phase === 'won') cups++;
    gf += r.stats.goals; ga += r.stats.against; perf += r.stats.perfects; early += r.stats.early; late += r.stats.late; passes += r.stats.passes;
    matches += Math.min(ROUNDS, r.stats.rounds + 1);
  }
  const o = out[label] = { rounds: rounds / RUNS, cups, cupRate: cups / RUNS, gf: gf / matches, ga: ga / matches, perfect: perf / Math.max(1, perf + early + late), passes: passes / matches };
  console.log(`${label.padEnd(12)} rounds won ${o.rounds.toFixed(2)} · cups ${cups}/${RUNS} · goals ${o.gf.toFixed(2)}–${o.ga.toFixed(2)} a match · perfect ${(o.perfect * 100).toFixed(0)}% · ${o.passes.toFixed(1)} passes a match`);
};
console.log('Assist on (the default):');
for (const kind of ['casual', 'pro', 'random']) report(kind, kind, true);
console.log('Assist off:');
for (const kind of ['pro', 'early', 'toFeet']) report(`${kind} (off)`, kind, false);
assert.ok(out.casual.rounds >= 3, 'with Assist, a casual player should get through at least three rounds on average');
assert.ok(out.casual.cupRate >= 0.1, 'and win the cup now and then');
assert.ok(out.pro.rounds > out.casual.rounds, 'playing it well should still beat playing it carelessly');
assert.equal(out.random.cups, 0, 'a random player should never lift the cup');
assert.ok(out['pro (off)'].rounds >= 1, 'with Assist off (the old, harder feel), the pro should still win a round or more on average');
assert.ok(out['toFeet (off)'].rounds < out['pro (off)'].rounds - 0.5, 'passing to feet should do clearly worse than passing into space');
assert.ok(out['early (off)'].perfect < out['pro (off)'].perfect - 0.1, 'arriving early should rarely be perfect');
console.log('PASS Into Space bots');
void CX; void SPEED;
