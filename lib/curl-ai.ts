// Sweep & Slide: the woodland teams and the shot-caller. A thrower looks over the sheet, lists the sensible shots
// (draws to the open ice and behind guards, guards, taps and raises, hits and peels, each with either curl), plays
// each one out on a copy of the ice, scores where the stones end up, and picks the best; the better teams also try
// their favourites a few times with their own release error and keep the one that holds up. Each team has a release
// error, a sweeping judgement, a depth of thought and a taste for some shots. The same caller (thinking hard and
// with no taste) suggests Dora and Enzo's shot. Deterministic: all chance comes from a seeded generator.
import {
  DRILLS, drillStones, drillStars, type Drill,
  TEE, HOG, HOUSE_R, STONE_R, HALF_W, BACK, cloneStones, newStone, launch, settle, scoreEnd, dist, inHouse, inGuardZone, judgeSweep, drawTo, lineThrough, broomOf, rng,
  type Match, type Shot, type Stone, type TeamId, type Curl, type SweepPlan, type Rng,
} from './curl-game.js';

export type Kind = 'draw' | 'come' | 'guard' | 'tap' | 'hit' | 'peel' | 'through';
export type Brain = { think: number; sweep: number; hit: number; guard: number; draw: number };
export type Team = {
  id: string; name: string; animal: string; captain: string; blurb: string; ends: number;
  noise: { v: number; a: number }; brain: Brain; toss?: boolean; hello: string; win: string; lose: string; ink: string;
};
export const TEAMS: Team[] = [
  { id: 'hedgehog', name: 'The Hedgehog Twins', animal: 'hedgehogs', captain: 'Prickle', ends: 4, ink: '#8a5a3c', noise: { v: 0.015, a: 0.0045 },
    brain: { think: 0.15, sweep: 0.2, hit: -0.1, guard: 0, draw: 0.1 }, blurb: 'Two young hedgehogs at their first Pebble Cup. They just like to draw to the rings.',
    hello: 'We’ve only practised drawing. Is that all right?', win: 'We won? We WON!', lose: 'That was lovely. Good luck in the next round!' },
  { id: 'duck', name: 'The Duck Pond Paddlers', animal: 'ducks', captain: 'Mallory', ends: 4, ink: '#3f7a4a', noise: { v: 0.016, a: 0.0048 },
    brain: { think: 0.35, sweep: 0.35, hit: 0.12, guard: 0.05, draw: 0 }, blurb: 'The pond’s own team. Their weight wobbles, but they know every bump in the ice.',
    hello: 'Quack! Home ice, you know. Mind the wobbly bit.', win: 'Home pond advantage!', lose: 'Well swept, chinchillas!' },
  { id: 'badger', name: 'The Badger Brothers', animal: 'badgers', captain: 'Brock', ends: 4, ink: '#2b2d3a', noise: { v: 0.018, a: 0.0054 },
    brain: { think: 0.4, sweep: 0.4, hit: 0.35, guard: -0.1, draw: 0 }, blurb: 'Big, strong and fond of hitting. If it’s in the house, they’ll try to knock it out.',
    hello: 'We throw hard. Hope your stones are tough!', win: 'Bonk! Ha!', lose: 'Fair play. You’re tougher than you look.' },
  { id: 'beaver', name: 'The Beaver Builders', animal: 'beavers', captain: 'Timber', ends: 4, ink: '#6a4a2a', noise: { v: 0.0095, a: 0.0028 },
    brain: { think: 0.9, sweep: 0.7, hit: 0.1, guard: 0.3, draw: 0.05 }, blurb: 'They build walls of guards and hide behind them. Bring your come-arounds.',
    hello: 'We’ll build a nice wall out there. You’ll see.', win: 'Built to last!', lose: 'You got round our wall. Clever.' },
  { id: 'squirrel', name: 'The Squirrel Scramblers', animal: 'squirrels', captain: 'Hazel', ends: 4, ink: '#b4552a', noise: { v: 0.011, a: 0.0033 },
    brain: { think: 0.5, sweep: 0.55, hit: 0.15, guard: 0.2, draw: 0 }, blurb: 'Quick and busy. Stones everywhere, guards in front of everything.',
    hello: 'Ooh ooh! Let’s go let’s go let’s go!', win: 'Scramble scramble, we win!', lose: 'Aww, nuts.' },
  { id: 'otter', name: 'The Otter Swimmers', animal: 'otters', captain: 'Ripple', ends: 4, ink: '#5c4433', noise: { v: 0.015, a: 0.0045 },
    brain: { think: 0.6, sweep: 0.65, hit: 0.45, guard: -0.15, draw: 0 }, blurb: 'Slick and sporty. They love a takeout and a stone that rolls behind cover.',
    hello: 'Splash! Clean sheet by the end, that’s our style.', win: 'Clean sweep!', lose: 'You slid that well. Respect.' },
  { id: 'owl', name: 'The Owl Tacticians', animal: 'owls', captain: 'Professor Hoot', ends: 4, ink: '#4a3a5a', noise: { v: 0.0085, a: 0.0025 },
    brain: { think: 1, sweep: 0.85, hit: 0.6, guard: 0.05, draw: 0.05 }, blurb: 'They think three stones ahead and rarely miss the shot they call.',
    hello: 'Hoo. A fine evening for geometry.', win: 'As calculated.', lose: 'Hoo! Most unexpected. Well played.' },
  { id: 'stoat', name: 'The Stoat Champions', animal: 'stoats', captain: 'Ermine', ends: 6, ink: '#1e2a4a', noise: { v: 0.0095, a: 0.0026 }, toss: true,
    brain: { think: 1, sweep: 0.95, hit: 0.1, guard: 0.1, draw: 0 }, blurb: 'Holders of the Pebble Cup three winters running. Six ends, and they miss almost nothing.',
    hello: 'The Cup stays with us. It always does.', win: 'Champions again.', lose: 'The Cup is yours. You earned every end of it.' },
];
export const teamById = (id: string) => TEAMS.find((t) => t.id === id) ?? null;
/**
 * Who has the hammer in the first end: Dora and Enzo, as the visitors, except in the final, where a coin toss
 * decides it (drawn from the match's seed, so a match replays exactly).
 */
export function firstHammer(team: Team, seed: number): TeamId { return team.toss ? (rng(seed * 2654435761 + 99).next() < 0.5 ? 0 : 1) : 0; }
/** Dora and Enzo's caller: thinks as hard as the champions, no taste for any shot. */
export const CALLER: Brain = { think: 1, sweep: 1, hit: 0, guard: 0, draw: 0 };

export type Plan = { shot: Shot; sweep: SweepPlan; kind: Kind; call: string; target: { x: number; y: number }; value: number };
type Cand = { shot: Shot; sweep: SweepPlan; kind: Kind; target: { x: number; y: number }; about?: Stone; behind?: boolean };

/** How good the stones are for team `me`, with `left` stones still to come this end. */
export function evaluate(stones: Stone[], me: TeamId, left: number, hammer: TeamId, ctx: { lead: number; endsLeft: number } = { lead: 0, endsLeft: 2 }) {
  const live = stones.filter((s) => !s.out), sc = scoreEnd(live), sgn = (t: TeamId) => (t === me ? 1 : -1);
  const pts = sc.team === null ? 0 : sgn(sc.team) * sc.points;
  if (left === 0) {
    let v = pts;
    // a blank keeps the hammer; one point with the hammer gives it away
    if (sc.blank) v += hammer === me ? 0.35 : -0.35;
    if (sc.team === me && sc.points === 1 && hammer === me && ctx.endsLeft > 1) v -= 0.3;
    return v;
  }
  let v = pts * (0.65 + 0.3 * (1 - left / 8));
  for (const s of live) {
    if (inHouse(s)) {
      const close = 1 - dist(s) / (HOUSE_R + STONE_R);
      v += sgn(s.team) * 0.3 * close;
      // covered: a stone in front of it on the line from the release
      const cover = live.some((g) => g !== s && g.x < s.x - 2 * STONE_R && g.x > HOG && Math.abs(g.y - s.y * (g.x / s.x)) < 2 * STONE_R);
      if (cover) v += sgn(s.team) * 0.3;
    } else if (inGuardZone(s)) {
      const centre = Math.abs(s.y) < 0.9;
      // centre guards help the team without the hammer; corner guards help the team with it
      v += sgn(s.team) * (centre ? (s.team !== hammer ? 0.22 : 0.06) : (s.team === hammer ? 0.14 : 0.04));
    }
  }
  // late in the game a team that is ahead wants a clear sheet, a team behind wants stones in play
  if (ctx.endsLeft <= 1 && left > 0) { const n = live.length; v += (ctx.lead > 0 ? -0.06 : ctx.lead < 0 ? 0.06 : 0) * n; }
  return v;
}

function candidates(stones: Stone[], me: TeamId): Cand[] {
  const out: Cand[] = [], live = stones.filter((s) => !s.out), curls: Curl[] = [1, -1];
  const add = (c: Cand | null) => { if (c && Math.abs(c.shot.angle) < 0.2) out.push(c); };
  // draws to open spots in and around the house
  const spots: [number, number][] = [[TEE, 0], [TEE - 0.6, 0.5], [TEE - 0.6, -0.5], [TEE + 0.5, 0.6], [TEE + 0.5, -0.6], [TEE, 1.1], [TEE, -1.1], [TEE - 1.2, 0], [TEE + 1.1, 0]];
  for (const [x, y] of spots) for (const c of curls) add({ shot: drawTo(x, y, c), sweep: { target: Math.hypot(x, y), slack: 0.05 }, kind: 'draw', target: { x, y } });
  // come around a guard: rest on the line behind it, in the house
  for (const g of live) {
    if (!inGuardZone(g)) continue;
    for (const tx of [TEE - 0.4, TEE + 0.2]) {
      const ty = g.y * (tx / g.x); if (Math.abs(ty) > HOUSE_R) continue;
      for (const c of curls) add({ shot: drawTo(tx, ty, c), sweep: { target: Math.hypot(tx, ty), slack: 0.05 }, kind: 'come', target: { x: tx, y: ty }, about: g, behind: true });
    }
  }
  // guards: centre, corner, and in front of our best stone
  const gs: [number, number][] = [[HOG + 2.6, 0], [HOG + 3.4, 0.6], [HOG + 3.4, -0.6]];
  const mine = live.filter((s) => s.team === me && inHouse(s)).sort((a, b) => dist(a) - dist(b))[0];
  if (mine) gs.push([HOG + 3, mine.y * ((HOG + 3) / mine.x)]);
  for (const [x, y] of gs) for (const c of curls) add({ shot: drawTo(x, y, c), sweep: { target: Math.hypot(x, y), slack: 0.05 }, kind: 'guard', target: { x, y } });
  // hits on their stones in play, nearest the button first; peels on their guards
  const theirs = live.filter((s) => s.team !== me && (inHouse(s) || inGuardZone(s))).sort((a, b) => dist(a) - dist(b)).slice(0, 4);
  for (const s of theirs) {
    const guard = inGuardZone(s);
    for (const c of curls) for (const off of [0, 0.12, -0.12]) for (const w of guard ? [0.9, 1] : [0.78, 0.88, 0.97]) {
      const sh = lineThrough(s.x, s.y + off, w, c);
      if (sh) add({ shot: sh, sweep: null, kind: guard && w > 0.95 ? 'peel' : 'hit', target: { x: s.x, y: s.y }, about: s });
    }
  }
  // taps and raises: nudge our own guard or short stone back into the house
  for (const s of live.filter((t) => t.team === me && (inGuardZone(t) || (inHouse(t) && t.x < TEE - 0.8)))) {
    for (const c of curls) { const sh = lineThrough(s.x, s.y, 0.72, c); if (sh) add({ shot: sh, sweep: null, kind: 'tap', target: { x: s.x, y: s.y }, about: s }); }
  }
  // throw it through (to blank the end with the hammer)
  out.push({ shot: { angle: 0.13, weight: 0.85, curl: 1 }, sweep: null, kind: 'through', target: { x: BACK + 1, y: 2 } });
  return out;
}

/** Plays a candidate out on a copy of the ice (with a release error) and returns the resulting stones. */
function tryShot(m: Match, me: TeamId, c: Cand, dv: number, da: number, sweepSlack: number) {
  const st = cloneStones(m.stones.filter((s) => !s.out)), s = newStone(999, me, 'opp', 0, 0);
  launch(s, c.shot, dv, da); st.push(s);
  const plan = c.sweep ? { target: c.sweep.target, slack: sweepSlack } : null;
  settle(st, s, (t) => judgeSweep(t, plan));
  return st;
}

/** Picks a shot for team `me`. `noise` is the thrower's release error (used to test a shot before trusting it). */
export function plan(m: Match, me: TeamId, brain: Brain, noise: { v: number; a: number }, seed: number): Plan {
  const r = rng(seed), left = 7 - m.thrown, endsLeft = m.ends - m.end, lead = m.score[me] - m.score[1 - me];
  const ctx = { lead, endsLeft }, slack = 0.05 + (1 - brain.sweep) * 0.5;
  const taste = (k: Kind) => (k === 'hit' || k === 'peel' || k === 'tap' ? brain.hit : k === 'guard' ? brain.guard : k === 'through' ? 0 : brain.draw);
  const cands = candidates(m.stones, me);
  const scored = cands.map((c) => ({ c, v: evaluate(tryShot(m, me, c, 0, 0, slack), me, left, m.hammer, ctx) }));
  // a thrower who thinks less sees the values blurred, and has a taste for some shots
  for (const s of scored) s.v += taste(s.c.kind) * 0.5 + r.gauss() * (1 - brain.think) * 0.45;
  scored.sort((a, b) => b.v - a.v);
  let best = scored[0];
  const tries = Math.round(brain.think * 4);
  if (tries > 0) {
    const top = scored.slice(0, 2 + Math.round(brain.think * 4));
    let bv = -Infinity;
    for (const s of top) {
      let sum = 0;
      for (let k = 0; k < tries; k++) sum += evaluate(tryShot(m, me, s.c, r.gauss() * noise.v, r.gauss() * noise.a, slack), me, left, m.hammer, ctx);
      const v = sum / tries + taste(s.c.kind) * 0.5;
      if (v > bv) { bv = v; best = { c: s.c, v }; }
    }
  }
  const c = best.c;
  return { shot: c.shot, sweep: c.sweep ? { target: c.sweep.target, slack } : null, kind: c.kind, call: callFor(c, m, me), target: c.target, value: best.v };
}

function callFor(c: Cand, m: Match, me: TeamId) {
  const live = m.stones.filter((s) => !s.out), shot = live.filter((s) => inHouse(s)).sort((a, b) => dist(a) - dist(b))[0];
  switch (c.kind) {
    case 'draw': return dist(c.target) < 0.3 ? 'Draw to the button' : dist(c.target) < 0.8 ? 'Draw into the rings, close in' : 'Draw into the house';
    case 'come': return c.about && c.about.team === me ? 'Draw behind our guard' : 'Come around their guard';
    case 'guard': return Math.abs(c.target.y) < 0.3 ? 'Centre guard' : live.some((s) => s.team === me && inHouse(s)) ? 'Guard our stone' : 'Corner guard';
    case 'tap': return 'Tap our stone into the house';
    case 'hit': return c.about === shot ? 'Take out their shot stone' : 'Take out their stone';
    case 'peel': return 'Peel their guard away';
    case 'through': return 'Throw it through and blank the end';
  }
}

/**
 * A three-star throw for a Practice Pond drill (searched on a copy of the ice), for the teammate's broom. Falls back
 * to the best throw found.
 */
export function drillSolution(d: Drill): Shot {
  const tries: Shot[] = [], curls: Curl[] = [1, -1], set = drillStones(d);
  const add = (s: Shot | null) => { if (s && Math.abs(s.angle) < 0.2) tries.push(s); };
  if (d.id === 'draw') for (const c of curls) add(drawTo(TEE, 0, c));
  if (d.id === 'guard') for (const c of curls) add(drawTo(HOG + 3.4, set[0].y * ((HOG + 3.4) / set[0].x), c));
  if (d.id === 'come') for (const c of curls) for (const dx of [0.3, 0.1, 0.5, -0.1]) add(drawTo(TEE + dx, set[0].y * ((TEE + dx) / set[0].x), c));
  if (d.id === 'hitroll' || d.id === 'double')
    for (const c of curls) for (const w of [0.8, 0.86, 0.92, 0.98]) for (let k = 0; k <= 24; k++) { const off = (k % 2 ? -1 : 1) * Math.ceil(k / 2) * 0.025; add(lineThrough(set[0].x, set[0].y + off, w, c)); }
  let best: Shot = tries[0], bs = -1;
  for (const sh of tries) {
    const st = drillStones(d), s = newStone(0, 0, 'dora', 0, 0); launch(s, sh); st.push(s); settle(st, s);
    const n = drillStars(d, st, s);
    if (n > bs) { bs = n; best = sh; if (n === 3) break; }
  }
  return best;
}

/** Where the caller holds the broom for a plan: on the line of the throw, at the tee line. */
export const broomFor = (p: Plan) => broomOf(p.shot);
export const clampAim = (a: number) => Math.max(-0.2, Math.min(0.2, a));
export const sideOf = (y: number) => (y > 0 ? 'left' : 'right');
export { HALF_W };
