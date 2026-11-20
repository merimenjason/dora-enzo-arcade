// Jade Street, the sixteenth pass: the jobs built round the fifteenth pass's four rides. Two new steps:
// `toss` (the tandem along East Coast Park: you pedal, and F near each mark has the partner on the back saddle toss a
// parcel to the family waiting there; both of you have to be on it) and `paddle` (a delivery on the dragon boat:
// the timer is set for a boat with the partner drumming, whose surges come twice as often and hit harder, so the
// surge on Space is the point). The ice-cream motorbike's chime is a guard lure (lib/jade-aware.ts) and the luge job
// is an ordinary chase, so neither needs a step of its own. Chapter 9's crow over Jurong Lake also learns the drum:
// paddling a crewed dragon boat under it draws it down twice as often (lib/jade-team.ts bagStep).
import { dist } from './jade-rng.js';
import type { Run } from './jade-mission.js';
import type { Step } from './jade-story.js';
import type { Ride } from './jade-game.js';
import type { VehicleKind } from './jade-move.js';
import { nameOf, type TagOpt } from './jade-tag.js';

/** how near a toss mark F reaches (world units): further on Assist */
export const tossRange = (run: Run) => run.assist ? 240 : 170;
/** a paddle's timer by setting: a little longer on Assist and on Easy, but never so long the drum stops mattering (the
 * everyday job timers scale much harder with difficulty, which would make the drum pointless on Easy and the river
 * impossible on Hard) */
const paddleK = (run: Run) => (run.assist ? 1.15 : 1) * (({ easy: 1, normal: 1, hard: 0.92 } as Record<string, number>)[run.w.s.settings.diff] ?? 1);

const crewed = (run: Run, kind: VehicleKind) => { const p = run.w.p; return p.ride?.kind === kind && run.w.mate.seat === p.ride; };
/** the nearest parked ride of a kind (where the route arrow points while you are not on one) */
function nearestRide(run: Run, kind: VehicleKind): Ride | null {
  const w = run.w; let best: Ride | null = null, bd = 1e9;
  for (const r of w.rides) if (r.kind === kind && !r.broken) { const d = dist(r.b.x, r.b.y, w.p.x, w.p.y); if (d < bd) { bd = d; best = r; } }
  return best;
}

export function rideEnter(run: Run, st: Step): boolean {
  const w = run.w, k = w.diff.timer;
  switch (st.t) {
    case 'toss': {
      run.items = st.marks.map(s => { const [x, y] = run.spot(s); return { x, y, got: false, sprite: st.item }; });
      run.progress = `Parcels 0/${st.marks.length}`;
      if (st.time) run.timer = st.time * (run.assist ? 1.4 : 1) * k;
      return true;
    }
    case 'paddle': {
      run.timer = st.time * paddleK(run);
      if (!w.p.carry) w.p.carry = st.item;
      return true;
    }
  }
  return false;
}

export function rideStep(run: Run, st: Step, dt: number): boolean {
  void dt;
  const w = run.w, p = w.p, n = nameOf(w.mate.who);
  switch (st.t) {
    case 'toss': {
      if (p.ride?.kind !== 'tandem') { run.label = 'Get on the tandem (E): you pedal, ' + n + ' rides on the back'; return true; }
      if (!crewed(run, 'tandem')) { run.label = `Wait for ${n} to hop on the back saddle`; return true; }
      const it = nextMark(run);
      run.label = it && dist(it.x, it.y, p.x, p.y) < tossRange(run) ? `F: ${n} tosses the parcel!` : st.label;
      return true;
    }
    case 'paddle': {
      const [x, y] = run.spot(st.to);
      if (p.ride?.kind !== 'dragon') run.label = 'Get in the dragon boat (E)';
      else if (!crewed(run, 'dragon')) run.label = `Wait for ${n} to take the drum: alone you are too slow`;
      else run.label = p.boostCd <= 0 ? `${st.label} (Space: surge on the drum beat!)` : st.label;
      if (p.ride?.kind === 'dragon' && dist(p.x, p.y, x, y) < 130) { p.carry = null; w.fx.push({ t: 'deliver', x, y }); run.next(); }
      return true;
    }
  }
  return false;
}

/** a case step lured with the ice-cream chime (Two Scoops): the hint follows what is happening, so a first-timer is
 * told when to ring, when to hop off, and to get back on when the bats are hungry again (null: not that kind of job) */
export function lureLabel(run: Run): string | null {
  const st = run.cur; if (!st || st.t !== 'case' || !run.m.steps.some(s => s.t === 'ride' && s.kind === 'icecream')) return null;
  const w = run.w, p = w.p, guards = run.actors.filter(a => a.mind);
  const eating = guards.some(a => (a.mind!.treat ?? 0) > 0), coming = guards.some(a => a.mind!.wantTreat), hungry = guards.some(a => (a.mind!.cones ?? 0) < 2);
  const near = guards.length ? Math.min(...guards.map(a => dist(a.b.x, a.b.y, p.x, p.y))) : 1e9;
  if (p.ride?.kind === 'icecream') {
    if (eating) return 'They’re eating! Hop off (E) and photograph the hideout while they’re busy';
    if (coming) return 'Here they come for an ice cream: wait for them…';
    if (!hungry) return 'The bats are full: hop off (E) and photograph from cover';
    return near < 420 ? 'Ring the ice-cream chime (Q)!' : 'Ride up to the bats behind Ngee Ann City, then ring the chime (Q)';
  }
  if (eating) return null; // the photo prompts (E) and the step's own hint do the rest
  const bike = w.rides.find(r => r.kind === 'icecream');
  if (hungry && bike && dist(bike.b.x, bike.b.y, p.x, p.y) < 500) return 'The bats are back on guard: hop on the motorbike (E) and ring again (Q), or photograph from cover';
  return null;
}

/** the toss mark nearest you that is still waiting */
function nextMark(run: Run) {
  const p = run.w.p; let best: Run['items'][number] | null = null, bd = 1e9;
  for (const it of run.items) if (!it.got) { const d = dist(it.x, it.y, p.x, p.y); if (d < bd) { bd = d; best = it; } }
  return best;
}

/** F in a ride job: the partner on the back saddle tosses a parcel to the nearest mark in reach */
export function rideTag(run: Run): TagOpt | null {
  const st = run.cur, w = run.w, p = w.p, m = w.mate; if (!st || st.t !== 'toss' || !crewed(run, 'tandem') || m.tossT > 0) return null;
  const it = nextMark(run); if (!it || dist(it.x, it.y, p.x, p.y) > tossRange(run)) return null;
  return { kind: 'toss', label: `${nameOf(m.who)}, toss it!`, go: () => toss(run, it) };
}
export function toss(run: Run, it: Run['items'][number]) {
  const w = run.w, m = w.mate; m.tossT = 0.6; m.aimH = Math.atan2(it.y - w.p.y, it.x - w.p.x);
  it.got = true; w.fx.push({ t: 'toss', x: it.x, y: it.y, kind: m.who });
  const got = run.items.filter(i => i.got).length; run.progress = `Parcels ${got}/${run.items.length}`;
  if (got >= run.items.length) run.next();
}

/** where the route arrow points in a ride job (undefined: not one of these steps) */
export function rideTarget(run: Run): [number, number] | null | undefined {
  const st = run.cur; if (!st) return undefined;
  const p = run.w.p;
  switch (st.t) {
    case 'toss': {
      if (p.ride?.kind !== 'tandem') { const r = nearestRide(run, 'tandem'); return r ? [r.b.x, r.b.y] : null; }
      const it = nextMark(run); return it ? [it.x, it.y] : null;
    }
    case 'paddle': {
      if (p.ride?.kind !== 'dragon') { const r = nearestRide(run, 'dragon'); return r ? [r.b.x, r.b.y] : null; }
      return run.spot(st.to);
    }
  }
  return undefined;
}
