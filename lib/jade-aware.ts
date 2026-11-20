// Jade Street: what the guards, lookouts, wardens and gang members notice, shared by every stealth-like job step
// (lib/jade-jobs.ts and lib/jade-mission.ts) and the ticket wardens in the street (lib/jade-fines.ts).
//
// Noise. Dashes, hops, running footsteps, gadget impacts and bursts, crashes, knocked props and car horns make a
// noise with a radius (`noise`); sneaking makes none, and under a five-foot way a noise carries about half as far.
// Noises live for a frame or two in `w.noises`; a mind hears one if it is inside the radius (smaller on Assist).
//
// A mind (`Mind`, one per watcher) moves through six states:
//   patrol     the beat the job gave it (the caller walks it)
//   sus        suspicious: it saw something or heard a noise; it stops, turns toward it, a "?" bubble
//   look       investigate: it walks to where it last saw or heard something and looks round
//   alert      it is sure: "!", it chases (or the job raises the alarm) and calls nearby guards to the spot
//   search     it lost you: it sweeps a few spots round where you were last seen, for a while
//   back       it gives up (a grumble) and walks back to its beat
// Assist reacts more slowly, hears less and searches for less time. Everything here is cheap: a handful of noises a
// frame, a straight-line step when the way is clear and a short cached flow field when it isn't.
import { T, W, S } from './jade-city.js';
import { drive, type Body } from './jade-move.js';
import { los, downhill } from './jade-nav.js';
import { dist, angDiff } from './jade-rng.js';
import type { World, Player } from './jade-game.js';
import { bark } from './jade-sg.js';

export type MindSt = 'patrol' | 'sus' | 'look' | 'alert' | 'search' | 'back';
export const MIND_STATES: MindSt[] = ['patrol', 'sus', 'look', 'alert', 'search', 'back'];
/** `pose`: what the drawing shows (looking round, searching, calling for help, grumbling, peering at a noise) */
export type MindPose = '' | 'look' | 'search' | 'call' | 'grumble' | 'peer';
export type Mind = {
  st: MindSt; t: number; at: [number, number] | null; last: [number, number] | null; pts: [number, number][]; pi: number;
  dwell: number; pose: MindPose; poseT: number; rush: boolean; why: 'saw' | 'heard'; lure: boolean; base: number;
  /** seconds spent alert with you in sight (the job's fail when it runs too long) */
  pinned: number; seen: boolean;
  /** seconds you have been in its eye lately: a glimpse shorter than its reaction time is not enough to stop it */
  glimpse: number;
  /** the sixteenth pass: the ice-cream chime. `wantTreat`: walking over to the motorbike for a cone; `treat`: seconds
   * left eating it (it watches nothing else meanwhile); `cones`: how many it has had this job (two is enough) */
  wantTreat?: boolean; treat?: number; cones?: number;
};
export const newMind = (): Mind => ({ st: 'patrol', t: 0, at: null, last: null, pts: [], pi: 0, dwell: 0, pose: '', poseT: 0, rush: false, why: 'heard', lure: false, base: 0, pinned: 0, seen: false, glimpse: 0 });
export type Noise = { x: number; y: number; r: number; kind: string; lure: boolean; at: number; by: 'you' | 'mate' | 'world' };

/** how loud each kind of noise is (its radius in world units, before muffling) */
export const LOUD: Record<string, number> = { chime: 520, step: 110, dash: 250, hop: 170, crash: 330, prop: 360, horn: 430, popper: 470, confetti: 420, thud: 230, hit: 200, distract: 330, commotion: 900 };
/** the noises a guard walks over to look at even when they come from nowhere near you: thrown things, bursts, the
 * partner's distraction (a lure is how you pull a guard off its beat) */
const LURES = new Set(['popper', 'confetti', 'thud', 'hit', 'distract', 'commotion', 'chime']);
/** the sixteenth pass: how long a guard stands eating an ice cream from the motorbike (seconds), and how many it takes */
export const treatTime = (w: World) => w.assist ? 12 : w.s.settings.diff === 'hard' ? 6.5 : w.s.settings.diff === 'easy' ? 10 : 8.5;
export const CONES = 2;
const YUM = ['Ooh! Ice cream!', 'One potong, uncle!', 'Wah, the ice-cream man!', 'Got durian flavour?'];
const SHIOK = ['Shiok!', 'Back to work lah.', 'Best part of the night.'];
const FULL = ['Already had two, cannot.', 'No more for me, lah.'];

/** make a noise. Under a five-foot way it carries about half as far; sneaking makes none (callers don't call it) */
export function noise(w: World, x: number, y: number, kind: string, by: Noise['by'] = 'you', r = LOUD[kind] ?? 200) {
  const p = by === 'you' ? w.p : by === 'mate' ? w.mate : null;
  if (p && p.shade && !p.ride) r *= 0.5;
  if (p && p.hide) r *= 0.3;
  w.noises.push({ x, y, r, kind, lure: LURES.has(kind), at: w.time, by });
  if (w.noises.length > 24) w.noises.shift();
  if (r > 160) w.fx.push({ t: 'noise', x, y, k: r, kind });
}
/** drop noises older than a couple of frames */
export function noiseStep(w: World) { if (w.noises.length) w.noises = w.noises.filter(n => w.time - n.at < 0.05); }

/** the numbers by difficulty: how long a mind stands suspicious before it acts, how far it hears, how long it
 * searches, how fast it walks to look and runs to chase, how far it calls for help, and how long it may keep you in
 * sight while alert before the job fails */
export function tune(w: World) {
  const d = w.s.settings.diff, a = w.assist;
  return {
    react: a ? 1.05 : d === 'hard' ? 0.45 : d === 'easy' ? 0.75 : 0.6,
    hear: a ? 0.75 : d === 'hard' ? 1.1 : 1,
    search: a ? 4 : d === 'hard' ? 9 : d === 'easy' ? 6 : 7,
    look: a ? 52 : 62,
    chase: a ? 140 : d === 'hard' ? 175 : 165,
    call: a ? 460 : d === 'hard' ? 700 : 620,
    pin: a ? 3 : d === 'hard' ? 1.6 : d === 'easy' ? 2.4 : 2,
    dwell: a ? 1.6 : 2.2,
  };
}

/** the loudest fresh noise this mind can hear from (x,y), if any */
export function hear(w: World, x: number, y: number, k = tune(w).hear): Noise | null {
  let best: Noise | null = null, bv = 0;
  for (const n of w.noises) { const d = dist(n.x, n.y, x, y), r = n.r * k; if (d < r && r - d > bv) { bv = r - d; best = n; } }
  return best;
}

/** step toward a point: straight when the way is clear, along a short flow field round walls otherwise */
export function goTo(w: World, b: Body, gx: number, gy: number, speed: number, dt: number): number {
  const d = dist(b.x, b.y, gx, gy); if (d < 2) { b.speed = 0; return d; }
  let nx = gx, ny = gy;
  if (d > T * 0.9 && !los(w.c, b.x, b.y, gx, gy)) { const f = w.fieldNear('walk', gx, gy, 14); const n = downhill(w.c, f, b.x, b.y, w.open); if (n) { nx = n[0]; ny = n[1]; } }
  const dx = nx - b.x, dy = ny - b.y, l = Math.hypot(dx, dy) || 1;
  if (b.cls === 'fly') { b.h = turnTo(b.h, Math.atan2(dy, dx), dt * 9); b.x += dx / l * Math.min(l, speed * dt); b.y += dy / l * Math.min(l, speed * dt); b.speed = speed; }
  else drive(w.ctx(), b, dx / l, dy / l, speed, 900, 10, dt, true);
  return d;
}
export const turnTo = (h: number, want: number, k: number) => h + Math.max(-k, Math.min(k, angDiff(h, want)));

const QUIPS = ['Must be the wind lah.', 'Hmm. Nothing.', 'Aiyoh, my eyes playing tricks.', 'Probably a cat.', 'Never mind, back to work.', 'Bah. Nobody here.'];
const CALLS = ['Over here!', 'Oi! Intruder!', 'Got one! Come quick!', 'Help! This way!'];
/** another watcher within call: comes running to the spot */
export function callHelp(w: World, from: { b: Body; mind?: Mind }, x: number, y: number, crew: { b: Body; mind?: Mind; gone?: boolean }[]) {
  const tn = tune(w); let n = 0;
  for (const o of crew) {
    if (o === from || o.gone || !o.mind || o.mind.st === 'alert') continue;
    if (dist(o.b.x, o.b.y, from.b.x, from.b.y) > tn.call) continue;
    const m = o.mind; m.st = 'look'; m.at = [x, y]; m.rush = true; m.dwell = 0; m.t = 0; m.why = 'heard'; n++;
    w.fx.push({ t: 'aware', kind: 'look', x: o.b.x, y: o.b.y });
  }
  if (from.mind) { from.mind.pose = 'call'; from.mind.poseT = 0.9; }
  w.fx.push({ t: 'aware', kind: 'call', x: from.b.x, y: from.b.y, k: n });
  bark(w, from.b.x, from.b.y - 40, CALLS);
  return n;
}
/** sure now: "!", chasing, and calling the others over */
export function alertMind(w: World, a: { b: Body; mind?: Mind }, x: number, y: number, crew: { b: Body; mind?: Mind; gone?: boolean }[]) {
  const m = a.mind ?? (a.mind = newMind()); if (m.st === 'alert') { m.last = [x, y]; return; }
  m.st = 'alert'; m.t = 0; m.last = [x, y]; m.at = [x, y]; m.pinned = 0;
  w.fx.push({ t: 'aware', kind: 'alert', x: a.b.x, y: a.b.y });
  callHelp(w, a, x, y, crew);
}
function setSt(w: World, m: Mind, b: Body, st: MindSt) { m.st = st; m.t = 0; w.fx.push({ t: 'aware', kind: st, x: b.x, y: b.y }); }

export type MindOpt = {
  /** you, if this watcher sees you now (the caller checks the cone and the walls) */
  seen: Player | null;
  /** where its beat resumes (the next route point); null for watchers who never leave their post */
  home: [number, number] | null;
  /** it can't move (a lookout at a window, a lookout in a crowd): only turns its head */
  still?: boolean;
  /** it can't act at all for now: dazed, painted over, staring at a distraction */
  busy?: boolean;
  /** this watcher hears noises from you only, not the world (a lured gang member ignores other gang members) */
  noAlert?: boolean;
};
/** one step of a mind. 'route': carry on with the beat (the caller walks it); 'hold': it stands where it is (the
 * mind has set its heading); 'moved': the mind moved it */
export function mindStep(w: World, a: { b: Body; mind?: Mind }, dt: number, o: MindOpt): 'route' | 'hold' | 'moved' {
  const m = a.mind ?? (a.mind = newMind()), b = a.b, tn = tune(w);
  m.t += dt; if (m.poseT > 0) { m.poseT -= dt; if (m.poseT <= 0) m.pose = ''; }
  m.seen = !!o.seen;
  if ((m.treat ?? 0) > 0) {
    // eating an ice cream at the motorbike (the sixteenth pass): facing it, watching nothing else, then back to its beat
    m.treat = Math.max(0, m.treat! - dt); b.speed = 0; if (m.at) b.h = turnTo(b.h, Math.atan2(m.at[1] - b.y, m.at[0] - b.x), dt * 6); m.pose = ''; m.dwell = 0;
    if (m.treat <= 0) { setSt(w, m, b, 'back'); bark(w, b.x, b.y - 40, SHIOK); }
    return 'hold';
  }
  if (o.busy) { b.speed = 0; return 'hold'; }
  const you = o.seen;
  if (you) m.last = [you.x, you.y];
  m.glimpse = you ? m.glimpse + dt : Math.max(0, m.glimpse - dt * 0.5);
  // a noise: anything but an alert mind turns toward it (an alert one has better things to do)
  let n = m.st === 'alert' || (m.treat ?? 0) > 0 ? null : hear(w, b.x, b.y, tn.hear);
  // the ice-cream chime: a guard who has had its two cones only grumbles about it; one already queueing ignores repeats
  if (n?.kind === 'chime' && ((m.cones ?? 0) >= CONES || m.wantTreat)) { if ((m.cones ?? 0) >= CONES && m.st === 'patrol' && m.poseT <= 0) { m.pose = 'grumble'; m.poseT = 1; bark(w, b.x, b.y - 40, FULL); } n = null; }
  if (n && !you && (m.st === 'patrol' || m.st === 'back' || m.st === 'search' || (m.st === 'look' && dist(n.x, n.y, m.at?.[0] ?? 0, m.at?.[1] ?? 0) > 60))) {
    m.at = [n.x, n.y]; m.why = 'heard'; m.lure = n.lure && n.by !== 'world'; m.rush = false;
    if (n.kind === 'chime' && !o.still) { m.wantTreat = true; bark(w, b.x, b.y - 40, YUM); }
    if (m.st === 'look') { m.dwell = 0; } else { setSt(w, m, b, 'sus'); m.base = Math.atan2(n.y - b.y, n.x - b.x); }
    if (m.lure && w.s.stats) w.s.stats.lures = (w.s.stats.lures ?? 0) + 1;
  }
  switch (m.st) {
    case 'patrol':
      if (you && m.glimpse >= tn.react * 0.6) { setSt(w, m, b, 'sus'); m.at = [you.x, you.y]; m.why = 'saw'; m.base = Math.atan2(you.y - b.y, you.x - b.x); m.pose = 'peer'; m.poseT = tn.react; return 'hold'; }
      return 'route';
    case 'sus': {
      b.speed = 0; const [x, y] = m.at!; b.h = turnTo(b.h, Math.atan2(y - b.y, x - b.x), dt * 9);
      if (you) m.at = [you.x, you.y];
      if (m.pose === '') { m.pose = 'peer'; m.poseT = 0.3; }
      if (m.t >= tn.react * (m.why === 'heard' ? 0.8 : 1)) { setSt(w, m, b, o.still ? 'search' : 'look'); m.dwell = 0; if (o.still) m.t = tn.search * 0.6; }
      return 'hold';
    }
    case 'look': {
      // it walks to the spot where it noticed something (not after you: that is what "alert" is for)
      if (o.still) { b.h = turnTo(b.h, Math.atan2(m.at![1] - b.y, m.at![0] - b.x), dt * 4); if (m.t > 2) setSt(w, m, b, 'back'); return 'hold'; }
      if (m.dwell > 0) {
        m.dwell -= dt; b.speed = 0; b.h = m.base + Math.sin(m.t * 2.4) * 1.15; m.pose = 'look'; m.poseT = 0.2;
        if (m.dwell <= 0) { setSt(w, m, b, 'back'); m.pose = 'grumble'; m.poseT = 1.2; if (m.why === 'heard') bark(w, b.x, b.y - 40, QUIPS); }
        return 'hold';
      }
      const d = goTo(w, b, m.at![0], m.at![1], m.rush ? tn.chase * 0.85 : tn.look, dt);
      if (m.wantTreat && (d < 64 || m.t > 9)) { m.wantTreat = false; m.treat = treatTime(w); m.cones = (m.cones ?? 0) + 1; w.fx.push({ t: 'treat', x: b.x, y: b.y }); return 'hold'; }
      if (d < 30 || m.t > 9) { m.dwell = tn.dwell; m.base = b.h; }
      return 'moved';
    }
    case 'alert': {
      const tgt = you ? [you.x, you.y] : m.last!;
      // (calling for help it is busy shouting, not watching)
      if (you && m.pose !== 'call') m.pinned += dt; else if (!you) m.pinned = Math.max(0, m.pinned - dt * 0.5);
      if (o.still) { b.h = turnTo(b.h, Math.atan2(tgt[1] - b.y, tgt[0] - b.x), dt * 6); if (!you && m.t > 1.5) { setSt(w, m, b, 'search'); m.t = tn.search * 0.6; } return 'hold'; }
      if (m.pose === 'call') { b.speed = 0; b.h = turnTo(b.h, Math.atan2(tgt[1] - b.y, tgt[0] - b.x), dt * 6); return 'hold'; }
      const d = goTo(w, b, tgt[0], tgt[1], tn.chase, dt);
      if (!you && (d < 34 || m.t > 12)) { setSt(w, m, b, 'search'); m.pts = searchPts(w, tgt[0], tgt[1], b); m.pi = 0; m.dwell = 0; }
      return 'moved';
    }
    case 'search': {
      if (you) { m.at = [you.x, you.y]; setSt(w, m, b, 'sus'); m.why = 'saw'; return 'hold'; }
      if (m.t >= tn.search || (o.still && m.t >= tn.search)) { setSt(w, m, b, 'back'); m.pose = 'grumble'; m.poseT = 1.4; bark(w, b.x, b.y - 40, QUIPS); return 'hold'; }
      if (o.still) { b.h = m.base + Math.sin(m.t * 1.8) * 1.3; m.pose = 'look'; m.poseT = 0.2; return 'hold'; }
      if (m.dwell > 0) { m.dwell -= dt; b.speed = 0; b.h = m.base + Math.sin(m.t * 2.6) * 1.2; m.pose = 'search'; m.poseT = 0.2; if (m.dwell <= 0) m.pi++; return 'hold'; }
      if (!m.pts.length) m.pts = searchPts(w, m.last?.[0] ?? b.x, m.last?.[1] ?? b.y, b);
      const p = m.pts[m.pi % m.pts.length];
      const d = goTo(w, b, p[0], p[1], tn.look, dt);
      if (d < 26) { m.dwell = 1.1; m.base = b.h; }
      return 'moved';
    }
    case 'back': {
      if (you && m.glimpse >= tn.react * 0.6) { setSt(w, m, b, 'sus'); m.at = [you.x, you.y]; m.why = 'saw'; return 'hold'; }
      if (m.pose === 'grumble' && m.poseT > 0) { b.speed = 0; return 'hold'; }
      if (!o.home || o.still) { m.st = 'patrol'; m.t = 0; return 'hold'; }
      const d = goTo(w, b, o.home[0], o.home[1], tn.look, dt);
      if (d < 30 || m.t > 14) { m.st = 'patrol'; m.t = 0; m.rush = false; }
      return 'moved';
    }
  }
  return 'route';
}
/** three open spots round where you were last seen, for a search */
function searchPts(w: World, x: number, y: number, b: Body): [number, number][] {
  const out: [number, number][] = [[x, y]]; const a0 = Math.atan2(y - b.y, x - b.x);
  for (const k of [-1.3, 1.3, 0]) for (const r of [170, 120, 80]) {
    const px = x + Math.cos(a0 + k) * r, py = y + Math.sin(a0 + k) * r, i = Math.floor(py / T) * W + Math.floor(px / T);
    if (w.c.solid[i] === S.OPEN && los(w.c, x, y, px, py)) { out.push([px, py]); break; }
  }
  return out;
}
/** the colour of a sight cone in each state (patrol pale gold, suspicious amber, investigating orange, alert red,
 * searching violet, going back pale) */
export const CONE: Record<MindSt, string> = { patrol: '255,240,150', sus: '255,196,70', look: '255,150,60', alert: '255,70,60', search: '196,140,255', back: '220,230,200' };
/** the bubble over a mind's head ('' for none) */
export function bubbleOf(m: Mind | undefined): '' | 'sus' | 'alert' | 'search' | 'grumble' | 'call' {
  if (!m) return '';
  if (m.pose === 'call') return 'call';
  if (m.pose === 'grumble') return 'grumble';
  if (m.st === 'sus' || m.st === 'look') return 'sus';
  if (m.st === 'alert') return 'alert';
  if (m.st === 'search') return 'search';
  return '';
}
