// Jade Street: the seventh pass's job steps, so a job is more than a chase. Each has its own rules, meter, fail state
// and prompts, and is hooked from `Run` in lib/jade-mission.ts the way lib/jade-team.ts is:
//   case       sneak round a target and photograph three or four things (E) from where you can see them; each photo
//              is intel (the back door, the guards' rota, the camera wiring, the safe's make) the next step uses
//   heist      pick quiet or loud: quiet is guards, cameras (paint blinds one), the safe and out the way you came;
//              loud is the partner's confetti diversion, a race to the safe and a getaway with heat. Spotted on a quiet
//              job, the alarm turns it loud. The safe is a mini-game (lib/jade-mini.ts SafeGame)
//   defend     hold a stall, a stage or a float for a time against waves of a gang; knock them back before they grab,
//              tidy up (E) between waves; the partner guards the far side
//   blend      put on the spy disguise, then walk with the crowd past the lookouts: running, hopping, bumping folk or
//              walking alone where they look raises Suspicion; E hides behind a newspaper
//   detective  ask witnesses (pick the right question), read the clues, search the one spot that fits them all; no pin
//   trap       lay nets (E), put the bait down, keep back, and spring a net (F) while one of the gang is on it
//   swap       slip a decoy into each crate (E, a moment crouched at it) while the guards look away
// Every step is finishable without gadgets; gadgets and the partner make them easier.
import { FOOT } from './jade-move.js';
import { dist, angDiff, clamp } from './jade-rng.js';
import { los, nearestFree } from './jade-nav.js';
import { addHeat } from './jade-heat.js';
import { newMind, mindStep, alertMind, tune, hear, goTo, noise, turnTo } from './jade-aware.js';
import type { Run, Actor } from './jade-mission.js';
import type { Step, Intel, Spot } from './jade-story.js';
import type { Player, Near } from './jade-game.js';
import { nameOf, distract, type TagOpt } from './jade-tag.js';
import { postMate, releaseMate, blind } from './jade-team.js';
import type { GadgetId } from './jade-gear.js';

type St<K extends Step['t']> = Extract<Step, { t: K }>;
export const JOB_STEPS = ['case', 'heist', 'defend', 'blend', 'detective', 'trap', 'swap'] as const;
export type JobStepKind = typeof JOB_STEPS[number];
export const INTEL: Record<Intel, { what: string; gain: string }> = {
  door: { what: 'back door', gain: 'the quiet way in is open' },
  rota: { what: 'guard rota', gain: 'you know their beats: slower to spot you' },
  cam: { what: 'camera wiring', gain: 'the cameras will be off' },
  safe: { what: 'safe', gain: 'one number fewer to crack' },
};
const GANG: Record<string, string> = { mac: 'macaques', otter: 'otters', crow: 'crows', liz: 'lizards', myna: 'mynahs', bat: 'bats' };
/** per-step scratch state (reset on entering each step) */
export type JobState = {
  ph: number; mode: '' | 'quiet' | 'loud'; entered: boolean; div: boolean; alarm: boolean; entry: [number, number] | null; warnedLock: boolean;
  left: number; wave: number; queue: number; spawnT: number; spawned: number; hp: number; mendW: number;
  cool: number; paperCd: number; asked: number[]; clues: number[]; searched: number[]; hidden: number;
  set: number[]; sprung: number[]; caught: number; escaped: number; t: number; heatCd: Record<number, number>;
  /** pass 8: a sneaky raider has been pointed out; the branch picked on a blend, trap or detective step ('' until then) */
  sneakWarned: boolean; tipped?: boolean; pick: '' | 'disguise' | 'commotion' | 'nets' | 'chase' | 'ask' | 'bribe';
};
export const freshJob = (): JobState => ({ ph: 0, mode: '', entered: false, div: false, alarm: false, entry: null, warnedLock: false, left: 0, wave: 0, queue: 0, spawnT: 0, spawned: 0, hp: 1, mendW: -1, cool: 0, paperCd: 0, asked: [], clues: [], searched: [], hidden: -1, set: [], sprung: [], caught: 0, escaped: 0, t: 0, heatCd: {}, sneakWarned: false, pick: '' });
const isJob = (st: Step): st is St<JobStepKind> => (JOB_STEPS as readonly string[]).includes(st.t);
const k = (run: Run) => (run.assist ? 1.4 : 1) * run.w.diff.timer;

// ── shared: guards that walk a beat, stop at its ends to sweep their torch, and see in a cone
function guards(run: Run, routes: Spot[][], skin?: 'liz' | 'myna' | 'bat') {
  for (const r of routes) { const pts = r.map(s => run.spot(s)); const a = run.actor('guard', pts[0][0], pts[0][1], 'fly', pts, 46); a.lookCd = 4 + run.actors.length % 3; a.skin = skin; run.actors.push(a); }
}
function guardWalk(run: Run, a: Actor, dt: number, look: boolean) {
  a.t += dt;
  if ((a.extra ?? 0) > 0) { a.extra = (a.extra ?? 0) - dt; a.b.speed = 0; a.b.h += Math.sin(a.t * 2.2) * dt * 0.9; return; }
  if ((a.stare ?? 0) > 0 || (a.hits === 1 && (a.extra2 ?? 0) > 0)) { a.b.speed = 0; return; }
  // a look over the shoulder now and then (the swap's guards): they stop and face the other way for a moment
  if (look) {
    if (a.look > 0) { a.look -= dt; a.b.speed = 0; a.b.h = a.face; return; }
    a.lookCd -= dt; if (a.lookCd <= 0) { a.look = run.assist ? 1.3 : 1.7; a.lookCd = 4.5 + (a.id % 3); a.face = a.b.h + Math.PI; run.w.fx.push({ t: 'look', x: a.b.x, y: a.b.y }); }
  }
  const wp = a.wp; run.walk(a, dt, a.speed, true); if (a.wp !== wp) a.extra = run.assist ? 1.6 : 1.3;
}
export const sightRange = (run: Run) => (run.assist ? 170 : 215) * run.w.diff.look * (run.w.dark ? 0.88 : 1);
const cone = (run: Run) => run.assist ? 0.45 : 0.55;
function sees(run: Run, a: Actor, h: Player, range: number, half: number, eyeY = 0) {
  if (h.hide || h.ride || blind(a)) return false;
  const d = dist(a.b.x, a.b.y, h.x, h.y);
  if (d < 34) return true;
  return d < range && Math.abs(angDiff(a.b.h, Math.atan2(h.y - a.b.y, h.x - a.b.x))) < half && los(run.w.c, a.b.x, a.b.y + eyeY, h.x, h.y);
}
function heroes(run: Run): Player[] { return run.w.two ? [run.w.p, run.w.mate] : [run.w.p]; }
/** the Alert meter: rises at `rate` while seen, falls when not; true when it is full */
function alert(run: Run, rate: number, dt: number, warn: string): boolean {
  const m = run.meter ?? (run.meter = { name: 'Alert', v: 0 });
  if (run.grace > 0) { run.grace -= dt; rate = 0; }
  m.v = rate > 0 ? Math.min(1, m.v + dt * rate * run.w.diff.look * run.mercy()) : Math.max(0, m.v - dt * 0.6); m.bad = m.v > 0.5;
  if (m.v > 0.5 && !run.jsWarned) { run.jsWarned = true; run.warn(warn); }
  if (m.v < 0.2) run.jsWarned = false;
  return m.v >= 1;
}

/** what a crew of watchers (a step's guards, or the stealth step's lookouts) does each frame, with lib/jade-aware.ts:
 * each one sees (its cone, wider once it is on edge), hears and thinks; the Alert meter fills while one sees you; when
 * it is full the one who saw you goes alert ("!"), calls the others to the spot and chases. You are only caught if an
 * alert one keeps you in sight too long or reaches you; break its line of sight and it searches, then gives up.
 * `loud`: no meter (the alarm is already ringing): a guard who sees you chases, and one who reaches you knocks you
 * over (a little heat) rather than ending the job. Returns true when the job failed (or `onFull` took over) */
export type CrewCfg = { kind: string; look: boolean; rate: (a: Actor, h: Player) => number; warn: string; spotted: string; caught: string;
  extra?: () => number; onFull?: () => boolean; loud?: boolean; meter?: boolean; walk?: (a: Actor, dt: number) => void; range?: number; half?: number; calm?: number };
export function crewWatch(run: Run, dt: number, c: CrewCfg): boolean {
  const w = run.w, tn = tune(w), crew = run.actors.filter(a => a.kind === c.kind);
  let rate = 0, who: Actor | null = null, whoH: Player | null = null, anyAlert = false;
  for (const a of crew) {
    const m = a.mind ?? (a.mind = newMind());
    const busy = blind(a), graced = run.grace > 0 && m.st === 'patrol';
    const edgy = m.st === 'alert' ? 1.45 : m.st === 'patrol' ? 1 : 1.2;
    let seen: Player | null = null, r = 0;
    // close up they are sure at once; at the far end of the beam it takes them a while
    const rg = (c.range ?? sightRange(run)) * (m.st === 'alert' ? 1.15 : 1);
    for (const h of heroes(run)) if (!busy && !graced && sees(run, a, h, rg, (c.half ?? cone(run)) * edgy)) { const dd = dist(a.b.x, a.b.y, h.x, h.y); const v = c.rate(a, h) * (dd < 90 ? 1.5 : dd > rg * 0.65 ? 0.55 : 1); if (v > r) { r = v; seen = h; } }
    const res = mindStep(w, a, dt, { seen, home: a.route[a.wp] ?? null, busy });
    if (res === 'route') (c.walk ?? ((x: Actor, d: number) => guardWalk(run, x, d, c.look)))(a, dt);
    else a.t += dt;
    if (r > rate) { rate = r; who = a; whoH = seen; }
    if (c.loud && seen && m.st !== 'alert') alertMind(w, a, seen.x, seen.y, crew);
    if (m.st === 'alert') anyAlert = true;
  }
  if (c.loud) {
    // a loud job: a chasing guard who reaches you bowls you over (a moment without control, a little heat)
    const p = w.p;
    for (const a of crew) if (a.mind?.st === 'alert' && !p.hide && !p.ride && p.stunT <= 0 && dist(a.b.x, a.b.y, p.x, p.y) < 34) {
      w.knock(a.b.x, a.b.y, 0.6, 'tumble', 0.7, 0.2); addHeat(w, 0.3, 'story'); a.extra = 1.6; a.mind.st = 'search'; a.mind.t = tn.search * 0.5; a.mind.pts = [];
      run.warn('A guard bowled you over! Keep moving!'); w.fx.push({ t: 'aware', kind: 'grab', x: p.x, y: p.y });
    }
    return false;
  }
  if (c.meter === false) return false;
  rate = Math.max(rate, c.extra?.() ?? 0) * (c.calm ?? 1);
  const was = run.jsAlert;
  run.jsAlert = anyAlert;
  if (was && !anyAlert && run.meter) run.meter.v = Math.min(run.meter.v, 0.6);
  const full = alert(run, rate, dt, c.warn);
  if (anyAlert && run.meter) { run.meter.v = Math.max(run.meter.v, 0.98); run.meter.bad = true; }
  if (full && !anyAlert) {
    if (c.onFull?.()) return true;
    const h = whoH ?? w.p, a = who ?? crew.slice().sort((u, v) => dist(u.b.x, u.b.y, h.x, h.y) - dist(v.b.x, v.b.y, h.x, h.y))[0];
    if (a) { alertMind(w, a, h.x, h.y, crew); run.warn('Spotted! Run and hide until they give up!'); }
  }
  for (const a of crew) {
    const m = a.mind; if (!m || m.st !== 'alert') continue;
    if (m.pinned >= tn.pin) { run.fail(c.spotted || 'They spotted you! Keep out of their sight lines, sneak, and hide when one shouts.'); return true; }
    for (const h of heroes(run)) if (!h.hide && !h.ride && dist(a.b.x, a.b.y, h.x, h.y) < 36) { run.fail(c.caught || 'Caught! When a guard shouts, run and break their line of sight.'); return true; }
  }
  return false;
}
/** the objective line while a crew is on edge */
export function crewLabel(run: Run): string | null {
  const ms = run.actors.map(a => a.mind?.st).filter(Boolean);
  if (ms.includes('alert')) return 'Spotted! Break their line of sight and hide';
  if (ms.includes('search')) return 'They’re searching for you: stay hidden until they give up';
  return null;
}

// ── entering a step
export function jobEnter(run: Run, st: Step): boolean {
  if (!isJob(st)) return false;
  const w = run.w, js = run.js = freshJob(); run.jsWarned = false;
  switch (st.t) {
    case 'case': {
      run.items = st.spots.map(s => { const [x, y] = run.spot(s.at); return { x, y, got: false, sprite: 'case-' + s.kind }; });
      guards(run, st.guards); run.meter = { name: 'Alert', v: 0 }; run.progress = `Photos 0/${st.need ?? st.spots.length}`;
      break;
    }
    case 'heist': {
      guards(run, st.guards);
      for (const [x, y, deg] of st.cams) { const [cx, cy] = run.spot([x, y]); const a = run.actor('cam', cx, cy, 'fly', [], 0); a.face = deg * Math.PI / 180; a.b.h = a.face; if (run.intel.includes('cam')) { a.extra2 = 1e9; a.hits = 2; } run.actors.push(a); }
      run.items = [{ x: run.spot(st.safe)[0], y: run.spot(st.safe)[1], got: false, sprite: 'safe-shut' }, { x: run.spot(st.back)[0], y: run.spot(st.back)[1], got: false, sprite: 'back-door' }];
      break;
    }
    case 'defend': {
      js.left = st.time * (run.assist ? 0.9 : 1); js.spawnT = 2.5; run.meter = { name: st.what, v: 1 };
      postMate(run, 'guard', run.spot(st.at)); run.progress = `Wave 0/${st.waves}`;
      break;
    }
    case 'blend': {
      const [rx, ry] = run.spot(st.rack);
      run.items = [{ x: rx, y: ry, got: false, sprite: 'disguise-rack' }];
      for (const [x, y, deg] of st.lookouts) { const [lx, ly] = run.spot([x, y]); const a = run.actor('watcher', lx, ly, 'fly', [], 0); a.face = deg * Math.PI / 180; a.b.h = a.face; run.actors.push(a); }
      const pts = st.route.map(s => run.spot(s)), R = w.R, sps = st.folk === 'intern' ? ['intern'] : ['rabbit', 'dog', 'cat', 'duck', 'goose', 'sunbear', 'tapir', 'civet', 'mousedeer', 'rooster'];
      for (let j = 0; j < st.crowd; j++) {
        const seg = Math.floor(R() * (pts.length - 1)), f = R(); const [ax, ay] = pts[seg], [bx, by] = pts[seg + 1];
        const a = run.actor('crowd', ax + (bx - ax) * f, ay + (by - ay) * f, 'fly', pts, 70 + R() * 26);
        a.wp = j % 2 ? seg : seg + 1; a.extra = (R() - 0.5) * 90; a.lookCd = j % 2 ? -1 : 1; a.skin = sps[j % sps.length] as Actor['skin']; run.actors.push(a);
      }
      postMate(run, 'stay', [rx + 40, ry + 20]);
      run.meter = { name: 'Suspicion', v: 0 };
      break;
    }
    case 'detective': {
      st.witnesses.forEach((wi, i) => { const [x, y] = run.spot(wi.at); const [sx, sy] = nearestFree(w.c, 'walk', x, y, w.open, 4); const a = run.actor('witness', sx, sy, 'foot', [], 0); a.extra = i; a.skin = wi.sp as Actor['skin']; a.b.h = Math.PI / 2; run.actors.push(a); });
      run.items = st.spots.map((s, i) => { const [x, y] = run.spot(s.at); return { x, y, got: false, sprite: spotSprite(s.what, i), marks: [] }; });
      js.hidden = hiddenSpot(st); run.timer = st.time * k(run); run.progress = `Clues 0/${st.witnesses.length}`; run.notes = [];
      break;
    }
    case 'trap': {
      run.items = st.spots.map(s => { const [x, y] = run.spot(s); return { x, y, got: false, sprite: 'trap-spot' }; });
      run.progress = `Nets 0/${st.need}`;
      break;
    }
    case 'swap': {
      run.items = st.crates.map(s => { const [x, y] = run.spot(s); return { x, y, got: false, sprite: 'crate-shut' }; });
      guards(run, st.guards, st.skin); run.timer = st.time * k(run); run.meter = { name: 'Alert', v: 0 }; run.progress = `Swapped 0/${st.crates.length}`;
      w.p.carry = st.decoy;
      break;
    }
  }
  return true;
}
/** the hiding spot is the one whose tags hold every witness's clue */
export function hiddenSpot(st: St<'detective'>) { return st.spots.findIndex(s => st.witnesses.every(wi => s.tags.includes(wi.tag))); }

// ── stepping a step
export function jobStep(run: Run, st: Step, dt: number): boolean {
  if (!isJob(st)) return false;
  switch (st.t) {
    case 'case': caseStep(run, st, dt); break;
    case 'heist': heistStep(run, st, dt); break;
    case 'defend': defendStep(run, st, dt); break;
    case 'blend': blendStep(run, st, dt); break;
    case 'detective': detectiveStep(run, st, dt); break;
    case 'trap': trapStep(run, st, dt); break;
    case 'swap': swapStep(run, st, dt); break;
  }
  return true;
}

function caseStep(run: Run, st: St<'case'>, dt: number) {
  const p = run.w.p, calm = run.intel.includes('rota') ? 0.7 : 1;
  if (crewWatch(run, dt, { kind: 'guard', look: false, rate: () => (p.sneak ? 0.4 : 1) * calm, warn: 'A guard is turning your way! Get out of the torch beam or hide!',
    spotted: 'A guard spotted you casing the joint! Keep out of the torch beams and take your photos from cover.', caught: 'A guard caught you casing the joint! When one shouts, run and hide until he gives up.' })) return;
  run.label = crewLabel(run) ?? st.label;
}
const photoRange = (run: Run) => run.assist ? 320 : 260;

function heistStep(run: Run, st: St<'heist'>, dt: number) {
  const w = run.w, p = w.p, js = run.js!, n = nameOf(w.mate.who);
  // a checkpoint taken after the safe (phase 3 quiet, 4 loud) picks up on the way out
  if (run.phase >= 3 && js.ph !== 3) { js.mode = run.phase === 4 ? 'loud' : 'quiet'; js.ph = 3; js.entered = true; js.div = true; if (w.ui?.kind === 'heist') w.ui = null; js.entry = run.spot(run.intel.includes('door') ? st.back : st.front); if (js.mode === 'loud') getaway(run, st); else run.meter = { name: 'Alert', v: 0 }; }
  if (js.ph === 0) { if (!w.ui) { w.ui = { kind: 'heist' }; w.fx.push({ t: 'open' }); run.warning = null; } run.label = 'Choose how to do it: quiet or loud'; return; }
  const [sx, sy] = run.spot(st.safe);
  // cameras sweep; guards walk their beats, hear, look and chase (dazed ones sit in the confetti)
  for (const a of run.actors) {
    if (a.kind === 'cam') { a.t += dt; if (!(a.extra2 && a.extra2 > 1e8)) a.b.h = a.face + Math.sin(a.t * 0.7 + a.id) * 0.65; continue; }
    if (a.hits === 1 && (a.extra2 ?? 0) <= 0) { a.hits = 0; w.fx.push({ t: 'look', x: a.b.x, y: a.b.y }); }
  }
  if (js.mode === 'quiet') {
    const calm = run.intel.includes('rota') ? 0.7 : 1;
    const cams = () => { let r = 0; for (const a of run.actors) if (a.kind === 'cam') for (const h of heroes(run)) if (sees(run, a, h, run.assist ? 200 : 240, 0.32)) r = Math.max(r, p.sneak ? 0.7 : 1.3); return r; };
    if (crewWatch(run, dt, { kind: 'guard', look: false, rate: () => js.entered ? (p.sneak ? 0.4 : 1) * calm : 0, extra: () => js.entered ? cams() : 0, meter: js.entered,
      warn: 'Someone is looking your way! Out of the beam, or hide!', spotted: '', caught: '', onFull: () => { alarm(run, st); return true; } })) return;
    if (!js.entered) {
      const [ex, ey] = js.entry!, [bx, by] = run.spot(st.back);
      run.label = run.intel.includes('door') ? 'Sneak in at the back door' : 'Sneak in at the front (the back door is locked: you didn’t case it)';
      if (!run.intel.includes('door') && !js.warnedLock && dist(p.x, p.y, bx, by) < 80) { js.warnedLock = true; run.warn('Locked tight. You’d have to case the joint to know the way in here.'); }
      if (dist(p.x, p.y, ex, ey) < 70 && !p.ride) { js.entered = true; w.fx.push({ t: 'job-door', x: ex, y: ey }); run.grace = Math.max(run.grace, 1); }
      return;
    }
    if (js.ph === 3) {
      const [ex, ey] = js.entry!; run.label = 'Slip back out the way you came, unseen';
      if (dist(p.x, p.y, ex, ey) < 70) { w.fx.push({ t: 'win' }); if (w.s.stats) w.s.stats.quiet = (w.s.stats.quiet ?? 0) + 1; return run.next(); }
      return;
    }
    run.label = 'Reach the safe without being seen';
  } else {
    if (!js.div) {
      crewWatch(run, dt, { kind: 'guard', look: false, rate: () => 0, meter: false, warn: '', spotted: '', caught: '' });
      const [fx, fy] = run.spot(st.front);
      run.label = `Get to the front: ${n} sets off the confetti diversion`;
      const mateThere = dist(w.mate.x, w.mate.y, fx, fy) < 80, youThere = dist(p.x, p.y, fx, fy) < 120;
      if (mateThere || (youThere && dist(w.mate.x, w.mate.y, fx, fy) < 320)) diversion(run, st);
      return;
    }
    if (js.ph === 3) {
      crewWatch(run, dt, { kind: 'guard', look: false, rate: () => 0, meter: false, warn: '', spotted: '', caught: '' });
      const [dx, dy] = run.spot(st.drop); run.label = 'Getaway! Ride to the drop with the loot';
      if (dist(p.x, p.y, dx, dy) < 110) { w.clearHeat(); w.fx.push({ t: 'win' }); return run.next(); }
      return;
    }
    // a guard back on its feet who sees you blows the whistle and gives chase: more heat, not a failure
    crewWatch(run, dt, { kind: 'guard', look: false, rate: () => 1, loud: true, warn: '', spotted: '', caught: '' });
    for (const a of run.actors) if (a.kind === 'guard' && sees(run, a, p, sightRange(run), cone(run)) && w.time > (js.heatCd[a.id] ?? 0)) { js.heatCd[a.id] = w.time + 3; addHeat(w, 0.35, 'story'); run.warn('A guard blows the whistle!'); w.fx.push({ t: 'whistle', x: a.b.x, y: a.b.y }); }
    run.label = 'Go go go! Crack the safe before the crows recover';
  }
  if (js.ph === 1 && dist(p.x, p.y, sx, sy) < 70 && !p.act && !p.ride) {
    js.ph = 2; p.face = 'side'; p.flip = sx < p.x;
    p.act = { n: 'safe', t: 0, dur: 0.5, then: () => { w.ui = { kind: 'mini', mini: 'safe', level: Math.max(1, st.level - (run.intel.includes('safe') ? 1 : 0)), from: 'mission' }; w.fx.push({ t: 'mini' }); } };
  }
}
/** the partner's confetti diversion at the front of a loud heist */
function diversion(run: Run, st: St<'heist'>) {
  const w = run.w, js = run.js!, [fx, fy] = run.spot(st.front);
  js.div = true; js.entered = true;
  const daze = (run.intel.includes('rota') ? 9 : 6) * (run.assist ? 1.3 : 1);
  for (const a of run.actors) { if (a.kind === 'guard') { a.extra2 = daze; a.hits = 1; } else if (a.kind === 'cam') { a.extra2 = 1e9; a.hits = 2; } }
  w.mate.act = { n: 'fire-confetti', t: 0, dur: 0.6 }; w.fx.push({ t: 'job-diversion', x: fx, y: fy }); w.fx.push({ t: 'burst', x: fx, y: fy, kind: 'confetti' }); w.fx.push({ t: 'alarm' });
  addHeat(w, 2.2, 'story'); run.timer = st.time * k(run) / run.mercy();
  run.warn('Confetti everywhere! The guards are seeing stars: get to the safe!');
}
/** a quiet heist gone wrong: the alarm rings and it is loud from here */
function alarm(run: Run, st: St<'heist'>) {
  const w = run.w, js = run.js!;
  js.mode = 'loud'; js.alarm = true; js.div = true; run.meter = null;
  addHeat(w, 2.2, 'story'); run.timer = st.time * k(run) * 0.8;
  for (const a of run.actors) if (a.kind === 'guard') { a.stare = 1.5; a.stareX = w.p.x; a.stareY = w.p.y; }
  w.fx.push({ t: 'alarm' }); w.fx.push({ t: 'job-alarm', x: w.p.x, y: w.p.y });
  run.warn('Alarm! It’s gone loud: crack the safe and run for it!');
  if (js.ph === 3) getaway(run, st);
}
/** after the safe on a loud job: three lanterns and a getaway scooter by the safe */
function getaway(run: Run, st: St<'heist'>) {
  const w = run.w, [sx, sy] = run.spot(st.safe);
  if (w.heat < 3.2) addHeat(w, 3.2 - w.heat, 'story'); w.lastSeen = [w.p.x, w.p.y];
  run.timer = null; run.meter = null;
  if (!w.rides.some(r => r.parked && !r.locked && r.kind === 'scooter' && dist(r.b.x, r.b.y, sx, sy) < 260)) { const [rx, ry] = w.rideSpot('scooter', sx + 70, sy + 40); w.addRide('scooter', rx, ry, 0, false, 0, true); }
}
/** the branch cards on a blend, trap or detective step (pass 8): which of the two ways to do it */
export type BranchPick = 'disguise' | 'commotion' | 'nets' | 'chase' | 'ask' | 'bribe';
export const BRANCHES: Record<'blend' | 'trap' | 'detective', [BranchPick, BranchPick]> = { blend: ['disguise', 'commotion'], trap: ['nets', 'chase'], detective: ['ask', 'bribe'] };
export const BRIBE = 15;
/** open the branch cards once, at the start of the step (a checkpoint after the pick restores it) */
function branchOpen(run: Run, st: St<'blend' | 'trap' | 'detective'>): boolean {
  const js = run.js!, w = run.w; if (js.pick) return false;
  if (st.t === 'blend' && run.phase >= 1) { js.pick = 'disguise'; return false; }
  if (!w.ui) { w.ui = { kind: 'branch' }; w.fx.push({ t: 'open' }); run.warning = null; }
  run.label = 'Choose how to do it';
  return true;
}
export function branchPick(run: Run, pick: BranchPick) {
  const st = run.cur, w = run.w, js = run.js, p = w.p; if (!st || !js || js.pick || (st.t !== 'blend' && st.t !== 'trap' && st.t !== 'detective')) return;
  if (!BRANCHES[st.t].includes(pick)) return;
  js.pick = pick; if (w.ui?.kind === 'branch') w.ui = null; w.fx.push({ t: 'job-pick', kind: pick });
  if (pick === 'commotion' && st.t === 'blend') {
    // the partner bangs a wok lid by the clothes rack: every lookout turns to stare at them for a while
    js.ph = 1; p.disguise = false; js.t = run.assist ? 13 : 9;
    for (const a of run.actors) if (a.kind === 'watcher') { a.stare = js.t; a.stareAt = w.mate.who; }
    run.meter = { name: 'Suspicion', v: 0 };
    w.say(`${nameOf(w.mate.who)} starts the racket! Go while they stare!`, 'good');
  }
  if (pick === 'chase' && st.t === 'trap') {
    // no nets: the gang walks its path and you run each one down with a dash before it gets away
    js.ph = 2; js.queue = st.n; js.spawnT = 1; run.items = []; run.progress = `Caught 0/${st.catch}`;
  }
  if (pick === 'bribe' && st.t === 'detective' && w.s.cash < BRIBE) run.warn(`Kopi costs ${BRIBE} coins each: you’ll have to ask nicely when you run out.`);
}
export function heistPick(run: Run, mode: 'quiet' | 'loud') {
  const st = run.cur, w = run.w, js = run.js; if (!st || st.t !== 'heist' || !js || js.ph !== 0) return;
  js.mode = mode; js.ph = 1; w.ui = null; w.fx.push({ t: 'job-pick', kind: mode });
  if (mode === 'quiet') { js.entry = run.spot(run.intel.includes('door') ? st.back : st.front); run.meter = { name: 'Alert', v: 0 }; }
  else { js.entry = run.spot(st.front); postMate(run, 'post', run.spot(st.front)); }
  if (w.s.stats) w.s.stats.heists = (w.s.stats.heists ?? 0) + 1;
}

function defendStep(run: Run, st: St<'defend'>, dt: number) {
  const w = run.w, p = w.p, js = run.js!, [tx, ty] = run.spot(st.at), pb = p.ride ? p.ride.b : p.b;
  js.left -= dt; const total = st.time * (run.assist ? 0.9 : 1);
  const waveLen = total / st.waves, wave = Math.min(st.waves, Math.floor((total - js.left) / waveLen) + 1);
  if (wave > js.wave && js.left > 2) { js.wave = wave; js.queue += st.per + wave * 2 + 1; run.warn(`Wave ${wave} of ${st.waves}! Here come the ${GANG[st.gang]}!`); w.fx.push({ t: 'job-wave', k: wave }); }
  run.progress = `Wave ${js.wave}/${st.waves} · hold ${Math.max(0, Math.ceil(js.left))}s`;
  js.spawnT -= dt;
  // they come in pairs from opposite sides (so you can't guard one road); from the second wave every third one is a
  // sneak (two in three from the third wave, off Assist): slow, silent, under a box or a branch, from the side of the stand away from you
  if (js.queue > 0 && js.spawnT <= 0) {
    const pair = Math.min(js.queue, 3); js.spawnT = (run.assist ? 3 : 1.9) * (pair / 3);
    const base = js.spawned * 1.37 + 0.6;
    for (let k = 0; k < pair; k++) {
      js.queue--;
      const sneaky = js.wave >= 2 && (js.spawned % 3 === 2 || (!run.assist && js.wave >= 3 && js.spawned % 3 === 1));
      const ang = sneaky ? Math.atan2(ty - pb.y, tx - pb.x) + (k ? 0.5 : -0.5) : base + k * 2.09 + (k ? 0.3 : 0), R = sneaky ? 520 : 600;
      const cls = (st.gang === 'crow' || st.gang === 'myna' || st.gang === 'bat') && !sneaky ? 'fly' : 'foot';
      const [sx, sy] = cls === 'fly' ? [tx + Math.cos(ang) * R, ty + Math.sin(ang) * R] : nearestFree(w.c, 'walk', tx + Math.cos(ang) * R, ty + Math.sin(ang) * R, w.open, 8);
      const sp = { mac: 128, otter: 112, crow: 118, myna: 120, bat: 122 }[st.gang] * (run.assist ? 0.82 : 1) * w.diff.rival * run.mercy() * (sneaky ? 0.72 : 1);
      const a = run.actor('pest', sx, sy, cls, [cls === 'fly' ? [tx, ty] : nearestFree(w.c, 'walk', tx, ty, w.open, 3)], sp);
      a.skin = st.gang === 'crow' ? undefined : st.gang; a.extra = 0; a.stareX = sx; a.stareY = sy; a.sneaky = sneaky; run.actors.push(a); js.spawned++;
      if (!sneaky && js.spawned % 2) w.fx.push({ t: st.gang === 'crow' ? 'caw' : 'job-gang' });
    }
  }
  const hitting = p.ride ? pb.speed > 60 : (p.dashT > 0 || p.hopT > 0 || p.b.speed > 150), reach = 30 + pb.r + (run.assist ? 18 : 6);
  // a sneak only notices a dash, a hop or a ride (walking into one just nudges it)
  const bowl = p.ride ? pb.speed > 60 : (p.dashT > 0 || p.hopT > 0 || (run.assist && p.b.speed > 150));
  // how hard a raider at the stand knocks it about each second, and the bite when it runs off with something
  const hard = w.s.settings.diff === 'hard' ? 1.2 : 1, dwell = run.assist ? 2.2 : 1.6;
  const chew = (run.assist ? 0.03 : 0.16) * hard * run.mercy(), bite = (run.assist ? 0.05 : 0.21) * hard * run.mercy();
  const m = w.mate;
  for (const a of run.actors) {
    if (a.kind !== 'pest' || a.gone) continue;
    a.t += dt;
    const shoo = (by: Player | null) => { const had = a.extra === 1; a.extra = 2; a.stun = 1.1; a.b.h = Math.atan2(a.b.y - ty, a.b.x - tx); w.fx.push({ t: 'shoo', x: a.b.x, y: a.b.y }); w.fx.push({ t: 'hit', x: a.b.x, y: a.b.y, k: 0, kind: 'pest' }); if (had) { js.hp = Math.min(1, js.hp + 0.05); w.say('Got it back!', 'good'); } if (by) by.act = by.act ?? (by.ride ? null : { n: 'shoo', t: 0, dur: 0.4 }); };
    if (a.extra === 2) { a.stun -= dt; a.b.x += Math.cos(a.b.h) * 260 * dt; a.b.y += Math.sin(a.b.h) * 260 * dt; a.b.speed = 260; if (a.stun <= 0) a.gone = true; continue; }
    if (dist(a.b.x, a.b.y, pb.x, pb.y) < reach && (a.sneaky ? bowl : hitting)) { shoo(null); continue; }
    // dizzy from a toy: it sits there seeing stars (easy to bowl over)
    if (a.stun > 0) { a.stun -= dt; a.b.speed = 0; if (m.ai.mode === 'guard' && !m.seat && dist(a.b.x, a.b.y, m.x, m.y) < 46) shoo(m); continue; }
    // the partner on guard sees off the ones walking up in the open; a sneak under its box slips past them
    if (m.ai.mode === 'guard' && !m.seat && !a.sneaky && dist(a.b.x, a.b.y, m.x, m.y) < 46) { shoo(m); continue; }
    if (a.extra === 4) {
      // at the stand, knocking it about: the damage mounts while it stays; then it grabs something and runs
      a.look -= dt; a.b.speed = 0; js.hp -= chew * dt;
      if (Math.floor(a.t * 2) !== Math.floor((a.t - dt) * 2)) w.fx.push({ t: 'job-grab', x: tx, y: ty });
      if (a.look <= 0) {
        a.extra = 1; js.hp -= bite; a.route = [[a.stareX!, a.stareY!]]; a.wp = 0; w.fx.push({ t: 'snatch', x: tx, y: ty });
      }
      if (js.hp < 0.4 && !run.jsWarned) { run.jsWarned = true; run.warn(`The ${st.what.toLowerCase()} can’t take much more! Knock them back!`); }
      continue;
    }
    if (a.extra === 0) {
      if (a.b.cls === 'fly') { const dx = tx - a.b.x, dy = ty - a.b.y, l = Math.hypot(dx, dy) || 1; a.b.h = Math.atan2(dy, dx); a.b.x += dx / l * a.speed * dt; a.b.y += dy / l * a.speed * dt; a.b.speed = a.speed; }
      else run.walk(a, dt, a.speed, false);
      if (dist(a.b.x, a.b.y, tx, ty) < 58) {
        a.extra = 4; a.look = dwell; a.b.h = Math.atan2(ty - a.b.y, tx - a.b.x);
        w.fx.push({ t: 'job-grab', x: tx, y: ty });
        if (a.sneaky && !js.sneakWarned) { js.sneakWarned = true; run.warn('A sneaky one crept up the far side! Dash into it!'); }
      }
    } else {
      const [ox, oy] = [a.stareX!, a.stareY!], dx = ox - a.b.x, dy = oy - a.b.y, l = Math.hypot(dx, dy) || 1;
      a.b.h = Math.atan2(dy, dx); a.b.x += dx / l * a.speed * 1.15 * dt; a.b.y += dy / l * a.speed * 1.15 * dt; a.b.speed = a.speed;
      // one who gets away with something comes back for more (one knocked back runs home for good)
      if (l < 30) { a.gone = true; js.queue++; }
    }
  }
  run.actors = run.actors.filter(a => !a.gone);
  run.meter = { name: st.what, v: clamp(js.hp, 0, 1), bad: js.hp < 0.4 };
  if (js.hp <= 0) return run.fail(`The ${GANG[st.gang]} cleaned out the ${st.what.toLowerCase()}! Knock them back before they reach it, and tidy up (E) between waves.`);
  if (js.left <= 0) {
    for (const a of run.actors) if (a.kind === 'pest') { a.extra = 2; a.stun = 1.2; }
    w.fx.push({ t: 'win' }); releaseMate(run); if (w.s.stats) w.s.stats.defends = (w.s.stats.defends ?? 0) + 1; return run.next();
  }
  run.label = st.label;
}

function blendStep(run: Run, st: St<'blend'>, dt: number) {
  const w = run.w, p = w.p, js = run.js!;
  if (branchOpen(run, st)) return;
  if (run.phase >= 1 && js.ph === 0) { js.ph = 1; p.disguise = true; }
  const loud = js.pick === 'commotion';
  if (loud && js.t > 0) {
    // the racket: the partner bangs the lid (its own pose), loud enough for the whole plaza
    js.t -= dt; w.mate.anim = 'gong'; w.mate.face = 'down';
    if (Math.floor(js.t * 1.5) !== Math.floor((js.t + dt) * 1.5)) noise(w, w.mate.x, w.mate.y, 'commotion', 'mate');
    if (js.t <= 0) { run.warn('The racket is over! Out of their sight, quick!'); for (const a of run.actors) if (a.kind === 'watcher') a.stare = 0; }
  }
  // the crowd strolls up and down the route; the lookouts turn their heads
  for (const a of run.actors) {
    a.t += dt;
    if (a.kind === 'watcher') {
      // a lookout hears a noise (your running feet, a toy, a bump) and turns to look straight at it for a moment
      const mi = a.mind ?? (a.mind = newMind()); mi.t += dt;
      const n = !((a.stare ?? 0) > 0) && mi.st !== 'sus' ? hear(w, a.b.x, a.b.y) : null;
      if (n && n.by !== 'world') { mi.st = 'sus'; mi.t = 0; mi.at = [n.x, n.y]; w.fx.push({ t: 'aware', kind: 'sus', x: a.b.x, y: a.b.y }); }
      if (mi.st === 'sus' && mi.t > 1.8) mi.st = 'patrol';
      if ((a.stare ?? 0) > 0) continue;
      if (mi.st === 'sus') a.b.h = turnTo(a.b.h, Math.atan2(mi.at![1] - a.b.y, mi.at![0] - a.b.x), dt * 5);
      else a.b.h = turnTo(a.b.h, a.face + Math.sin(a.t * 0.55 + a.id) * 0.9, dt * 3);
      continue;
    }
    if (a.kind !== 'crowd') continue;
    if (a.stun > 0) { a.stun -= dt; a.b.speed = 0; continue; }
    const [gx, gy] = a.route[a.wp], [px, py] = a.route[Math.max(0, Math.min(a.route.length - 1, a.wp - a.lookCd))];
    const sx = gx - px, sy = gy - py, sl = Math.hypot(sx, sy) || 1, ox = -sy / sl * (a.extra ?? 0), oy = sx / sl * (a.extra ?? 0);
    const dx = gx + ox - a.b.x, dy = gy + oy - a.b.y, l = Math.hypot(dx, dy) || 1;
    if (l < 12) { if (a.wp + a.lookCd < 0 || a.wp + a.lookCd >= a.route.length) a.lookCd = -a.lookCd; a.wp += a.lookCd; continue; }
    a.b.h = Math.atan2(dy, dx); a.b.x += dx / l * Math.min(l, a.speed * dt); a.b.y += dy / l * Math.min(l, a.speed * dt); a.b.speed = a.speed;
  }
  if (js.ph === 0) { run.label = 'Put on the disguise at the clothes rack (E)'; return; }
  js.cool = Math.max(0, js.cool - dt); js.paperCd = Math.max(0, js.paperCd - dt);
  const crowd = run.actors.filter(a => a.kind === 'crowd');
  const inCrowd = crowd.some(c => dist(c.b.x, c.b.y, p.x, p.y) < 100);
  const paper = p.act?.n === 'paper';
  const fast = p.dashT > 0 || p.air, calm = !p.ride && !fast && p.b.speed <= FOOT.walk + 15;
  let rate = 0, watched = false;
  for (const a of run.actors) {
    if (a.mind) a.mind.seen = false;
    if (a.kind !== 'watcher' || blind(a) || paper) continue;
    const d = dist(a.b.x, a.b.y, p.x, p.y);
    const look = d < (run.assist ? 260 : 300) * w.diff.look && Math.abs(angDiff(a.b.h, Math.atan2(p.y - a.b.y, p.x - a.b.x))) < 0.95 && los(w.c, a.b.x, a.b.y, p.x, p.y);
    if (!look && d >= 80) continue;
    watched = true;
    // without a disguise (the commotion), anyone they see is a stranger: being in the crowd only helps a little
    let r = loud ? (fast ? 2.4 : inCrowd ? 0.6 : 1.5) : calm ? (inCrowd ? 0 : 0.14) : fast ? 2.2 : 0.95;
    if (d < 80 && !inCrowd) r += 0.6;
    rate = Math.max(rate, r);
    if (a.mind && r > 0) { a.mind.seen = true; if (a.mind.st !== 'sus') a.mind.st = run.meter!.v > 0.7 ? 'alert' : 'look'; }
  }
  // bumping into folk turns heads anywhere near a lookout
  if (js.cool <= 0 && !paper && p.b.speed > 70) for (const c of crowd) if (dist(c.b.x, c.b.y, p.x, p.y) < 26) {
    js.cool = 1; c.stun = 0.6; w.fx.push({ t: 'bump', x: c.b.x, y: c.b.y, k: 0.3 });
    if (run.actors.some(a => a.kind === 'watcher' && dist(a.b.x, a.b.y, p.x, p.y) < 520)) { const m = run.meter!; m.v = Math.min(1, m.v + 0.16 * w.diff.look); run.warn('Paiseh! Bumping into folk draws looks.'); }
    break;
  }
  for (const a of run.actors) if (a.kind === 'watcher' && a.mind && (a.mind.st === 'look' || a.mind.st === 'alert') && !a.mind.seen) a.mind.st = 'patrol';
  const m = run.meter!;
  if (paper) m.v = Math.max(0, m.v - dt * 0.35);
  else if (rate > 0) m.v = Math.min(1, m.v + dt * rate * w.diff.look * (run.assist ? 0.7 : 1) * run.mercy());
  else m.v = Math.max(0, m.v - dt * 0.15);
  m.bad = m.v > 0.6;
  run.meter2 = { name: inCrowd ? 'In the crowd' : 'On your own', v: inCrowd ? 1 : 0.15, bad: !inCrowd && watched };
  if (m.v > 0.6 && !run.jsWarned) { run.jsWarned = true; run.warn('A lookout is staring! Slow down, get among the crowd, or read your paper (E).'); }
  if (m.v < 0.3) run.jsWarned = false;
  if (m.v >= 1) return run.fail('The crows saw through the disguise! Walk, don’t run, stay in the crowd, and read your paper when they look your way.');
  const [gx, gy] = run.spot(st.goal);
  run.label = loud ? (js.t > 0 ? `They’re all staring at ${nameOf(w.mate.who)}! Get to the goal (${Math.ceil(js.t)}s)` : 'Stay out of the lookouts’ sight and reach the goal') : paper ? 'Behind the paper… nobody here but us pigeons' : !calm && watched ? 'Walk! Running in a disguise looks shifty' : st.label;
  if (dist(p.x, p.y, gx, gy) < 80) { if (loud) for (const a of run.actors) if (a.kind === 'watcher') a.stare = 0; p.disguise = false; w.fx.push({ t: 'job-disguise', kind: 'off' }); releaseMate(run); if (w.s.stats) w.s.stats.disguises = (w.s.stats.disguises ?? 0) + 1; run.next(); }
}

function detectiveStep(run: Run, st: St<'detective'>, dt: number) {
  const js = run.js!; void dt;
  if (branchOpen(run, st)) { if (run.timer !== null) run.timer += dt; return; }
  for (const a of run.actors) { a.t += dt; if (a.kind === 'witness' && dist(a.b.x, a.b.y, run.w.p.x, run.w.p.y) < 140) a.b.h = Math.atan2(run.w.p.y - a.b.y, run.w.p.x - a.b.x); }
  // the clue markers: each clue you have shows its trace at every spot it fits
  const tags = js.clues.map(i => st.witnesses[i].tag);
  run.items.forEach((it, j) => { it.marks = tags.filter(t => st.spots[j].tags.includes(t)).map(t => CLUE_MARK[t] ?? 'clue-paws'); });
  const left = st.witnesses.length - js.clues.length;
  run.label = left > 0 ? `${st.label} (${left} to ask)` : 'Every clue points one way: search the spot that fits them all (E)';
  // Assist: a ring round where the clues point, smaller with each clue (never a pin)
  if (run.assist && js.clues.length) {
    const it = run.items[js.hidden], r = [480, 320, 190, 150][Math.min(3, js.clues.length - 1)], a = js.hidden * 2.1 + 0.7;
    run.hint = { x: it.x + Math.cos(a) * r * 0.35, y: it.y + Math.sin(a) * r * 0.35, r };
  } else run.hint = null;
}
/** each search spot is painted as what it is (crates of curry puffs, blue bins, a cooler box…) */
const SPOT_ART: [RegExp, string][] = [[/curry puff/, 'spot-puffs'], [/recycling bins/, 'spot-bins'], [/cooler/, 'spot-cooler'], [/planter/, 'spot-planters'], [/bicycle/, 'spot-bikes'],
  [/pandan/, 'spot-pandan'], [/newspaper/, 'spot-papers'], [/steamer/, 'spot-steamers'], [/shelf|kueh box|cake/, 'spot-cakes'], [/recycling bin|litter|bin/, 'spot-bin'], [/awning/, 'spot-awning'], [/kopi/, 'spot-kopi']];
const SPOT_ALL = ['spot-puffs', 'spot-bins', 'spot-cooler', 'spot-planters', 'spot-bikes', 'spot-pandan', 'spot-papers', 'spot-steamers', 'spot-cakes', 'spot-bin', 'spot-awning', 'spot-kopi'];
export function spotSprite(what: string, i: number) { const w = what.toLowerCase(); for (const [re, f] of SPOT_ART) if (re.test(w)) return f; return SPOT_ALL[i % SPOT_ALL.length]; }
/** the trace each kind of clue leaves at the spots it fits (painted): bird footprints under a roof, crumbs by food, a
 * grey feather on something blue, sticky pandan syrup by something sweet, claw scratches up high, paper scraps */
export const CLUE_MARK: Record<string, string> = { roof: 'clue-prints', food: 'clue-crumbs', blue: 'clue-feathers', sweet: 'clue-syrup', high: 'clue-scratch', paper: 'clue-paper' };
export function askPick(run: Run, q: number) {
  const w = run.w, st = run.cur, js = run.js, ui = w.ui; if (!st || st.t !== 'detective' || !js || !ui || ui.kind !== 'ask' || ui.said) return;
  const wi = st.witnesses[ui.i];
  if (q === wi.right) {
    ui.said = wi.clue; ui.ok = true;
    if (!js.clues.includes(ui.i)) { js.clues.push(ui.i); run.notes = st.witnesses.filter((_, i) => js.clues.includes(i)).map(x => `${x.name[0].toUpperCase()}${x.name.slice(1)}: ${x.clue}`); w.fx.push({ t: 'job-clue' }); if (w.s.stats) w.s.stats.clues = (w.s.stats.clues ?? 0) + 1; }
    run.progress = `Clues ${js.clues.length}/${st.witnesses.length}`;
  } else {
    ui.said = wi.junk[q]; ui.ok = false; w.fx.push({ t: 'job-wrong' });
    if (run.timer !== null) run.timer = Math.max(1, run.timer - (run.assist ? 3 : 8));
  }
}
export function askClose(run: Run) { const w = run.w; if (w.ui?.kind === 'ask') { w.ui = null; w.fx.push({ t: 'close' }); } }

function trapStep(run: Run, st: St<'trap'>, dt: number) {
  const w = run.w, p = w.p, js = run.js!;
  if (branchOpen(run, st)) return;
  const R = run.assist ? 70 : 52, chase = js.pick === 'chase';
  const bowl = p.ride ? (p.ride.b.speed > 60) : (p.dashT > 0 || p.hopT > 0), reach = 36 + (run.assist ? 16 : 0);
  if (js.ph < 2) { run.label = js.ph === 0 ? `${st.label} (${js.set.length}/${st.need} nets laid)` : 'Now put the bait down where their path ends (E)'; return; }
  js.spawnT -= dt; js.t += dt;
  if (js.queue > 0 && js.spawnT <= 0) {
    js.queue--; js.spawnT = run.assist ? 3 : 2.3;
    const cls = st.gang === 'crow' ? 'fly' : 'foot'; const path = run.path(st.path, cls);
    const sp = { liz: 62, otter: 74, mac: 80, crow: 70, myna: 74, bat: 76 }[st.gang] * (run.assist ? 0.85 : 1) * w.diff.rival * run.mercy();
    const a = run.actor('lured', path[0][0], path[0][1], cls, path, sp); a.skin = st.gang === 'crow' ? undefined : st.gang; a.extra = 0; run.actors.push(a);
    w.fx.push({ t: st.gang === 'crow' ? 'caw' : 'job-gang' });
  }
  for (const a of run.actors) {
    if (a.kind !== 'lured' || a.gone) continue;
    a.t += dt;
    if (a.extra === 1) { a.b.speed = 0; continue; }
    // the chase: caught by a dash (sitting there with its paws up), or bolting along its path once it has seen you
    if (a.extra === 3) { a.b.speed = 0; a.netT = (a.netT ?? 0) + dt; if (a.netT > 2.2) a.gone = true; continue; }
    if (chase && dist(a.b.x, a.b.y, p.x, p.y) < reach && bowl) {
      a.extra = 3; a.netT = 0; js.caught++; if (st.gang === 'myna') w.s.stats.mynahs++; if (st.gang === 'bat') w.s.stats.bats++; w.fx.push({ t: 'job-caught', x: a.b.x, y: a.b.y }); w.say(`Caught one! ${js.caught} of ${st.catch}`, 'good'); continue;
    }
    if (chase && a.mind?.st === 'alert') { if (run.walk(a, dt, a.speed * 1.55, false)) escape(run, a, 'outran you'); continue; }
    if (a.extra === 2) { a.stun -= dt; a.b.x += Math.cos(a.b.h) * 240 * dt; a.b.y += Math.sin(a.b.h) * 240 * dt; a.b.speed = 240; if (a.stun <= 0) a.gone = true; continue; }
    if (a.look > 0) { a.look -= dt; a.b.speed = 0; if (a.look <= 0) escape(run, a, 'ate the bait and ran'); continue; }
    // seen: a gang member who spots you close by and ahead of them (or right beside them) stops, stares ("?") and,
    // if you are still there a moment later, turns tail
    const d = dist(a.b.x, a.b.y, p.x, p.y), mi = a.mind ?? (a.mind = newMind()), tn = tune(w); mi.t += dt;
    const ahead = Math.abs(Math.atan2(Math.sin(Math.atan2(p.y - a.b.y, p.x - a.b.x) - a.b.h), Math.cos(Math.atan2(p.y - a.b.y, p.x - a.b.x) - a.b.h))) < 1.1;
    const seeNow = !p.hide && (ahead || d < 70) && d < (run.assist ? 120 : 150) && los(w.c, a.b.x, a.b.y, p.x, p.y);
    if (seeNow) {
      if (mi.st !== 'sus' || mi.why !== 'saw') { mi.st = 'sus'; mi.why = 'saw'; mi.t = 0; w.fx.push({ t: 'aware', kind: 'sus', x: a.b.x, y: a.b.y }); }
      else if (mi.t >= tn.react * 0.9) {
        mi.st = 'alert';
        if (chase) { w.fx.push({ t: 'aware', kind: 'alert', x: a.b.x, y: a.b.y }); continue; }
        escape(run, a, 'spotted you'); run.warn('They spotted you! Keep further back from their path.'); continue;
      }
      a.b.speed = 0; a.b.h = turnTo(a.b.h, Math.atan2(p.y - a.b.y, p.x - a.b.x), dt * 5); mi.seen = true; continue;
    }
    mi.seen = false;
    if (mi.st === 'sus' && mi.why === 'saw') { if (mi.t > tn.react * 0.9 + 0.4) mi.st = 'patrol'; else { a.b.speed = 0; continue; } }
    // a noise: a toy landing or bursting is worth a look (they walk over to it: lure them onto a net); a footstep only
    // makes them stop and peer
    const heard = mi.st === 'patrol' || mi.st === 'back' ? hear(w, a.b.x, a.b.y) : null;
    if (heard && heard.by !== 'world') {
      mi.at = [heard.x, heard.y]; mi.t = 0; mi.dwell = 0; mi.why = 'heard'; mi.st = heard.lure ? 'look' : 'sus';
      w.fx.push({ t: 'aware', kind: mi.st, x: a.b.x, y: a.b.y }); if (heard.lure && w.s.stats) w.s.stats.lures = (w.s.stats.lures ?? 0) + 1;
    }
    if (mi.st === 'sus') { a.b.speed = 0; a.b.h = turnTo(a.b.h, Math.atan2(mi.at![1] - a.b.y, mi.at![0] - a.b.x), dt * 5); if (mi.t > 0.9) mi.st = 'patrol'; continue; }
    if (mi.st === 'look') {
      if (mi.dwell > 0) { mi.dwell -= dt; a.b.speed = 0; a.b.h = mi.base + Math.sin(mi.t * 2.4) * 1.1; if (mi.dwell <= 0) { mi.st = 'back'; mi.pose = 'grumble'; mi.poseT = 0.8; } continue; }
      if (goTo(w, a.b, mi.at![0], mi.at![1], a.speed * 1.15, dt) < 26 || mi.t > 6) { mi.dwell = 1.6; mi.base = a.b.h; }
      continue;
    }
    if (mi.st === 'back') { if (mi.poseT > 0) { mi.poseT -= dt; a.b.speed = 0; continue; } const [hx, hy] = a.route[a.wp]; if (goTo(w, a.b, hx, hy, a.speed, dt) < 24 || mi.t > 8) mi.st = 'patrol'; continue; }
    if (run.walk(a, dt, a.speed, false)) { if (chase) escape(run, a, 'got away'); else { a.look = 1.4; w.fx.push({ t: 'eat', x: a.b.x, y: a.b.y }); } }
  }
  run.actors = run.actors.filter(a => !a.gone);
  const spare = st.n - st.catch;
  run.progress = chase ? `Caught ${js.caught}/${st.catch}` : `Caught ${js.caught}/${st.catch} · nets left ${js.set.length - js.sprung.length}`;
  run.meter = { name: 'Got away', v: clamp(js.escaped / (spare + 1), 0, 1), bad: js.escaped >= spare };
  // (the chase way clears the net markers, and a net laid before a retry may outlive them: nothing to repaint then)
  for (const i of js.set) if (!js.sprung.includes(i) && run.items[i]) run.items[i].sprite = run.actors.some(a => a.kind === 'lured' && a.extra === 0 && dist(a.b.x, a.b.y, run.items[i].x, run.items[i].y) < R) ? 'trap-ready' : 'trap-set';
  if (js.caught >= st.catch) { js.t = Math.min(js.t, 0); js.ph = 3; w.fx.push({ t: 'win' }); if (w.s.stats) w.s.stats.traps = (w.s.stats.traps ?? 0) + 1; return run.next(); }
  if (js.escaped > spare) return run.fail(chase ? `The ${GANG[st.gang]} got away! Dash into each one before it reaches the end of its path.` : `The ${GANG[st.gang]} got away! Spring a net while one of them is right on it, and keep out of sight.`);
  const walking = run.actors.filter(a => a.kind === 'lured' && a.extra === 0).length + js.queue;
  if (!chase && js.set.length - js.sprung.length === 0 && walking > 0 && js.caught < st.catch) return run.fail('Out of nets! Wait until one of them is right on a net before you spring it.');
  run.label = chase ? `Run them down: dash (Space) into each of the ${GANG[st.gang]} before they get away` : `Keep back and spring a net (F) when one of the ${GANG[st.gang]} is on it`;
}
function escape(run: Run, a: Actor, why: string) { const js = run.js!; void why; a.extra = 2; a.stun = 1.4; a.b.h = a.b.h + Math.PI; js.escaped++; run.w.fx.push({ t: 'job-escape', x: a.b.x, y: a.b.y }); }
/** F in a trap step: spring the net with the most of them on it (never one with nobody on it) */
export function spring(run: Run) {
  const st = run.cur, js = run.js, w = run.w; if (!st || st.t !== 'trap' || !js || js.ph !== 2) return;
  const R = run.assist ? 70 : 52, open = js.set.filter(i => !js.sprung.includes(i)); if (!open.length) return;
  const on = (i: number) => run.actors.filter(a => a.kind === 'lured' && a.extra === 0 && dist(a.b.x, a.b.y, run.items[i].x, run.items[i].y) < R);
  let best = open[0], bn = -1;
  for (const i of open) { const n = on(i).length; if (n > bn) { bn = n; best = i; } }
  if (bn === 0) { w.say('Not yet: wait until one steps on a net.', ''); return; }
  if (bn === 0) { const ws = run.actors.filter(a => a.kind === 'lured' && a.extra === 0); best = open.slice().sort((i, j) => Math.min(...ws.map(a => dist(a.b.x, a.b.y, run.items[i].x, run.items[i].y)), 1e9) - Math.min(...ws.map(a => dist(a.b.x, a.b.y, run.items[j].x, run.items[j].y)), 1e9))[0]; }
  js.sprung.push(best); run.items[best].sprite = 'trap-sprung';
  const it = run.items[best]; w.fx.push({ t: 'job-spring', x: it.x, y: it.y });
  if (!w.p.ride && !w.p.act) { w.p.act = { n: 'spring', t: 0, dur: 0.5 }; w.p.face = 'side'; w.p.flip = it.x < w.p.x; }
  const got = on(best);
  for (const a of got) { a.extra = 1; a.netT = 1e9; js.caught++; if (a.skin === 'myna') w.s.stats.mynahs++; if (a.skin === 'bat') w.s.stats.bats++; w.fx.push({ t: 'job-caught', x: a.b.x, y: a.b.y }); }
  if (!got.length) run.warn('Too early! That net is spent.'); else w.say(got.length > 1 ? `Two in one net! ${js.caught} caught` : `Caught one! ${js.caught} of ${st.catch}`, 'good');
}

/** is a guard (not looking away, not distracted) facing this crate within sight? */
export function crateWatched(run: Run, x: number, y: number) {
  const rg = sightRange(run) * 1.1, half = cone(run) * 1.2;
  return run.actors.some(a => a.kind === 'guard' && !blind(a) && a.look <= 0 && !((a.stare ?? 0) > 0) && dist(a.b.x, a.b.y, x, y) < rg && Math.abs(angDiff(a.b.h, Math.atan2(y - a.b.y, x - a.b.x))) < half);
}
function swapStep(run: Run, st: St<'swap'>, dt: number) {
  const w = run.w, p = w.p;
  const swapping = p.act?.n === 'crate-swap';
  const nearCrate = run.items.some(it => !it.got && dist(it.x, it.y, p.x, p.y) < 200);
  // a guard only cares about someone near the crates (and very much about someone at one)
  if (crewWatch(run, dt, { kind: 'guard', look: true, rate: () => swapping ? 2.4 : nearCrate ? (p.sneak ? 0.5 : 1) * 0.8 : 0, calm: run.assist ? 0.75 : 1,
    warn: swapping ? 'A guard is looking right at you!' : 'A guard is watching the crates! Wait for them to look away.',
    spotted: 'A guard caught you at the crates! Swap while they look the other way, or have your partner distract them (F).', caught: 'A guard grabbed you by the crates! When one shouts, run for cover.' })) return;
  // a guard looking over their shoulder: how long you have
  const away = run.actors.filter(a => a.kind === 'guard' && a.look > 0).map(a => a.look);
  run.label = crewLabel(run) ?? (swapping ? 'Swapping… keep your head down' : away.length ? `Go! A guard is looking away (${Math.max(...away).toFixed(1)} s)` : st.label);
  // after a slip-up, the partner's distraction is the tip
  if (run.retries > 0 && !run.js!.tipped) { run.js!.tipped = true; run.warn('Tip: press F and your partner distracts the guards while you swap.'); }
}

// ── what E does in these steps (Near kind 'job'; World.interact calls jobAct with its id)
export function jobNear(run: Run, x: number, y: number): Near | null {
  const st = run.cur, w = run.w, p = w.p, js = run.js; if (!st || !isJob(st) || !js || p.ride || p.act) return null;
  const near = (label: string, id: string): Near => ({ kind: 'job', label, x: x + 40, y, id });
  switch (st.t) {
    case 'case': {
      let best = -1, bd = 1e9;
      st.spots.forEach((s, i) => { const it = run.items[i]; if (it.got) return; const d = dist(it.x, it.y, x, y); if (d < photoRange(run) && d < bd && los(w.c, x, y, it.x, it.y)) { bd = d; best = i; } });
      return best >= 0 ? near(`Take a photo of the ${INTEL[st.spots[best].kind].what}`, `photo:${best}`) : null;
    }
    case 'heist': return null;
    case 'defend': {
      const [tx, ty] = run.spot(st.at);
      if (js.hp < 0.95 && js.mendW !== js.wave && dist(tx, ty, x, y) < 100 && !run.actors.some(a => a.kind === 'pest' && a.extra === 0 && dist(a.b.x, a.b.y, tx, ty) < 240)) return near(`Tidy up the ${st.what.toLowerCase()}`, 'mend');
      return null;
    }
    case 'blend': {
      if (js.ph === 0) { const it = run.items[0]; return dist(it.x, it.y, x, y) < 80 ? near('Put on the disguise', 'disguise') : null; }
      return js.paperCd <= 0 ? near('Hide behind your newspaper', 'paper') : null;
    }
    case 'detective': {
      let best: Near | null = null, bd = 1e9;
      for (const a of run.actors) if (a.kind === 'witness' && !js.clues.includes(a.extra!)) { const d = dist(a.b.x, a.b.y, x, y); if (d < 80 && d < bd) { bd = d; best = near(js.pick === 'bribe' && run.w.s.cash >= BRIBE ? `Hand the ${st.witnesses[a.extra!].name} a kopi (${BRIBE} coins)` : `Ask the ${st.witnesses[a.extra!].name} what they saw`, `ask:${a.extra}`); } }
      run.items.forEach((it, j) => { if (js.searched.includes(j)) return; const d = dist(it.x, it.y, x, y); if (d < 90 && d < bd) { bd = d; best = near(`Search the ${st.spots[j].what}`, `search:${j}`); } });
      return best;
    }
    case 'trap': {
      if (js.ph === 0) { let best = -1, bd = 1e9; run.items.forEach((it, i) => { if (js.set.includes(i)) return; const d = dist(it.x, it.y, x, y); if (d < 90 && d < bd) { bd = d; best = i; } }); return best >= 0 ? near('Lay a net trap here', `set:${best}`) : null; }
      if (js.ph === 1) { const [bx, by] = run.spot(st.bait); return dist(bx, by, x, y) < 80 ? near('Put the bait down', 'bait') : null; }
      return null;
    }
    case 'swap': {
      let best = -1, bd = 1e9; run.items.forEach((it, i) => { if (it.got) return; const d = dist(it.x, it.y, x, y); if (d < 64 && d < bd) { bd = d; best = i; } });
      return best >= 0 ? near('Slip the decoy into the crate', `swap:${best}`) : null;
    }
  }
  return null;
}
export function jobAct(run: Run, id: string) {
  const st = run.cur, w = run.w, p = w.p, js = run.js; if (!st || !isJob(st) || !js || p.act) return;
  const [what, n] = id.split(':'), i = +n;
  const face = (x: number, y: number) => { if (Math.abs(x - p.x) > Math.abs(y - p.y) * 0.6) { p.face = 'side'; p.flip = x < p.x; } else p.face = y > p.y ? 'down' : 'up'; };
  p.b.speed = 0;
  switch (what) {
    case 'photo': {
      if (st.t !== 'case') return; const it = run.items[i]; face(it.x, it.y); p.face = 'side';
      p.act = { n: 'photo', t: 0, dur: 0.75, then: () => {
        if (it.got) return; it.got = true; const kind = st.spots[i].kind; if (!run.intel.includes(kind)) run.intel.push(kind);
        w.fx.push({ t: 'job-photo', x: p.x, y: p.y }); w.say(`Photo: the ${INTEL[kind].what} · ${INTEL[kind].gain}`, 'good');
        if (w.s.stats) w.s.stats.photos = (w.s.stats.photos ?? 0) + 1;
        // the flash: a guard close by with a clear line glances over
        if (run.actors.some(a => !blind(a) && dist(a.b.x, a.b.y, p.x, p.y) < sightRange(run) * 1.2 && los(w.c, a.b.x, a.b.y, p.x, p.y))) { run.meter!.v = Math.min(0.95, run.meter!.v + 0.25); run.warn('The flash! A guard glances over…'); }
        const got = run.items.filter(x => x.got).length, need = st.need ?? st.spots.length; run.progress = `Photos ${got}/${need}`;
        if (got >= need) run.next();
      } };
      w.fx.push({ t: 'job-aim' });
      return;
    }
    case 'mend': {
      if (st.t !== 'defend') return; js.mendW = js.wave;
      p.act = { n: 'mend', t: 0, dur: 1.2, then: () => { js.hp = Math.min(1, js.hp + 0.12); w.fx.push({ t: 'job-mend', x: p.x, y: p.y }); w.say(`The ${st.what.toLowerCase()} is tidied up a bit`, 'good'); } };
      return;
    }
    case 'disguise': {
      if (st.t !== 'blend') return;
      p.face = 'down';
      p.act = { n: 'disguise-on', t: 0, dur: 1.0, then: () => { p.disguise = true; js.ph = 1; run.phase = 1; run.snap = { ...run.snapshot(run.i), phase: 1 }; w.fx.push({ t: 'checkpoint' }); w.fx.push({ t: 'job-disguise', kind: 'on', x: p.x, y: p.y }); } };
      return;
    }
    case 'paper': {
      if (st.t !== 'blend') return; js.paperCd = 4.5; p.face = 'down';
      p.act = { n: 'paper', t: 0, dur: 2.2 }; w.fx.push({ t: 'job-paper' });
      return;
    }
    case 'ask': {
      if (st.t !== 'detective') return; const a = run.actors.find(a => a.kind === 'witness' && a.extra === i); if (a) face(a.b.x, a.b.y);
      // the kopi bribe: hand over a takeaway kopi and they tell you straight (costs coins and a moment)
      if (js.pick === 'bribe' && w.s.cash >= BRIBE) {
        w.s.cash -= BRIBE; if (w.s.stats) w.s.stats.bribes = (w.s.stats.bribes ?? 0) + 1;
        p.act = { n: 'bribe', t: 0, dur: 1.1, then: () => { w.ui = { kind: 'ask', i }; w.fx.push({ t: 'open' }); askPick(run, st.witnesses[i].right); } };
        w.fx.push({ t: 'job-bribe', x: p.x, y: p.y });
        return;
      }
      p.act = { n: 'notes', t: 0, dur: 0.35, then: () => { w.ui = { kind: 'ask', i }; w.fx.push({ t: 'open' }); } };
      return;
    }
    case 'search': {
      if (st.t !== 'detective') return; const it = run.items[i]; face(it.x, it.y);
      p.act = { n: 'search', t: 0, dur: 1.1, then: () => {
        if (i === js.hidden) { it.got = true; p.carry = st.item; w.fx.push({ t: 'job-found', x: it.x, y: it.y }); w.fx.push({ t: 'pickup', x: it.x, y: it.y }); p.act = { n: 'triumph', t: 0, dur: 0.8 }; run.hint = null; run.next(); return; }
        js.searched.push(i); w.fx.push({ t: 'job-nothing', x: it.x, y: it.y }); w.say(`Nothing in the ${st.spots[i].what}.`, 'bad');
        if (run.timer !== null && !run.assist) run.timer = Math.max(1, run.timer - 4);
      } };
      return;
    }
    case 'set': {
      if (st.t !== 'trap') return; const it = run.items[i]; p.face = 'down';
      p.act = { n: 'set-trap', t: 0, dur: 0.9, then: () => { if (js.set.includes(i)) return; js.set.push(i); it.sprite = 'trap-set'; w.fx.push({ t: 'job-trap-set', x: it.x, y: it.y }); run.progress = `Nets ${js.set.length}/${st.need}`; if (js.set.length >= st.need) js.ph = 1; } };
      return;
    }
    case 'bait': {
      if (st.t !== 'trap') return; const [bx, by] = run.spot(st.bait); p.face = 'down';
      p.act = { n: 'set-trap', t: 0, dur: 0.7, then: () => { js.ph = 2; js.queue = st.n; js.spawnT = run.assist ? 6 : 5; w.say(`Quick, into hiding before the ${GANG[st.gang]} come!`); run.items.push({ x: bx, y: by, got: false, sprite: 'bait' }); w.fx.push({ t: 'job-bait', x: bx, y: by }); } };
      return;
    }
    case 'swap': {
      if (st.t !== 'swap') return; const it = run.items[i]; face(it.x, it.y); p.face = 'side';
      p.act = { n: 'crate-swap', t: 0, dur: run.assist ? 1.1 : 1.5, then: () => {
        if (it.got) return; it.got = true; it.sprite = 'crate-fake'; w.fx.push({ t: 'job-swap', x: it.x, y: it.y });
        const got = run.items.filter(x => x.got).length; run.progress = `Swapped ${got}/${run.items.length}`;
        if (w.s.stats) w.s.stats.swaps = (w.s.stats.swaps ?? 0) + 1;
        if (got >= run.items.length) { p.carry = null; run.next(); }
      } };
      return;
    }
  }
}
/** a mini-game finished inside one of these steps (the heist's safe) */
export function jobMini(run: Run, ok: boolean): boolean {
  const st = run.cur, w = run.w, js = run.js; if (!st || st.t !== 'heist' || !js) return false;
  if (!ok) { w.say('The tumblers slipped. Have another go.', 'bad'); w.ui = { kind: 'mini', mini: 'safe', level: Math.max(1, st.level - (run.intel.includes('safe') ? 1 : 0)), from: 'mission' }; return true; }
  js.ph = 3; w.p.carry = st.loot; run.items[0].sprite = 'safe-open';
  w.fx.push({ t: 'job-safe', x: w.p.x, y: w.p.y }); w.fx.push({ t: 'loot', x: w.p.x, y: w.p.y, kind: 'loot' });
  if (js.mode === 'loud') getaway(run, st); else run.meter = { name: 'Alert', v: Math.min(0.4, run.meter?.v ?? 0) };
  run.phase = js.mode === 'loud' ? 4 : 3; run.snap = { ...run.snapshot(run.i), phase: run.phase }; w.fx.push({ t: 'checkpoint' });
  return true;
}
/** Assist keeps you to a walk while you are in disguise */
export function walkOnly(run: Run) { const st = run.cur; return !!st && st.t === 'blend' && run.js?.ph === 1 && run.assist; }

// ── F in these steps: the partner distracts a guard; spring a net
export function jobTag(run: Run): TagOpt | null {
  const st = run.cur, w = run.w, p = w.p, m = w.mate, n = nameOf(m.who), js = run.js; if (!st || !isJob(st) || !js) return null;
  if (st.t === 'trap' && js.ph === 2 && js.set.length > js.sprung.length) {
    const R = run.assist ? 70 : 52, on = js.set.some(i => !js.sprung.includes(i) && run.actors.some(a => a.kind === 'lured' && a.extra === 0 && dist(a.b.x, a.b.y, run.items[i].x, run.items[i].y) < R));
    // (F does nothing to the nets until one of them is on a net, so it is never wasted by a stray press)
    if (on) return { kind: 'spring', label: 'Spring the net!', go: () => spring(run) };
  }
  const quiet = st.t === 'case' || st.t === 'swap' || (st.t === 'heist' && js.mode === 'quiet' && js.ph >= 1);
  if (quiet && !p.ride && !m.seat) {
    const a = run.actors.filter(a => a.kind === 'guard' && !blind(a)).sort((a, b) => dist(a.b.x, a.b.y, p.x, p.y) - dist(b.b.x, b.b.y, p.x, p.y))[0];
    if (a && dist(a.b.x, a.b.y, p.x, p.y) < 520) return { kind: 'distract', label: `${n} distracts the guard`, go: () => { distract(w, a.b.x, a.b.y, 6); a.stare = 6.5; a.stareAt = m.who; } };
  }
  return null;
}
/** where a guarding partner heads in a defend step: the raider nearest the stall that isn't yours */
export function jobGuardGoal(run: Run, m: Player): [number, number] | null {
  const st = run.cur; if (!st || st.t !== 'defend') return null;
  const [tx, ty] = run.spot(st.at), p = run.w.p;
  const ps = run.actors.filter(a => a.kind === 'pest' && a.extra !== 2).sort((a, b) => dist(a.b.x, a.b.y, tx, ty) - dist(b.b.x, b.b.y, tx, ty));
  const mine = ps.find(s => dist(s.b.x, s.b.y, m.x, m.y) <= dist(s.b.x, s.b.y, p.x, p.y)) ?? ps[1];
  if (mine) return [mine.b.x, mine.b.y];
  const a = Math.atan2(ty - p.y, tx - p.x); return [tx + Math.cos(a) * 60, ty + Math.sin(a) * 60];
}
/** what the route arrow points at in these steps (null: nothing pinned, as in the detective's search) */
export function jobTarget(run: Run): [number, number] | null | undefined {
  const st = run.cur, w = run.w, p = w.p, js = run.js; if (!st || !isJob(st) || !js) return undefined;
  const nearest = (xs: { x: number; y: number }[]) => xs.sort((a, b) => dist(a.x, a.y, p.x, p.y) - dist(b.x, b.y, p.x, p.y))[0];
  switch (st.t) {
    case 'case': { const it = nearest(run.items.filter(i => !i.got)); return it ? [it.x, it.y] : null; }
    case 'heist': { if (js.ph === 0) return null; if (js.mode === 'loud' && !js.div) return run.spot(st.front); if (js.ph === 3) return js.mode === 'loud' ? run.spot(st.drop) : js.entry; if (js.mode === 'quiet' && !js.entered) return js.entry; return run.spot(st.safe); }
    case 'defend': { const [tx, ty] = run.spot(st.at); const a = run.actors.filter(a => a.kind === 'pest' && a.extra !== 2).sort((a, b) => dist(a.b.x, a.b.y, tx, ty) - dist(b.b.x, b.b.y, tx, ty))[0]; return a ? [a.b.x, a.b.y] : [tx, ty]; }
    case 'blend': return js.ph === 0 ? [run.items[0].x, run.items[0].y] : run.spot(st.goal);
    case 'detective': { const a = run.actors.filter(a => a.kind === 'witness' && !js.clues.includes(a.extra!)).sort((a, b) => dist(a.b.x, a.b.y, p.x, p.y) - dist(b.b.x, b.b.y, p.x, p.y))[0]; return a ? [a.b.x, a.b.y] : null; }
    case 'trap': { if (js.ph === 0) { const it = nearest(run.items.filter((_, i) => !js.set.includes(i))); return it ? [it.x, it.y] : null; } return js.ph === 1 ? run.spot(st.bait) : run.spot(st.wait); }
    case 'swap': {
      // a crate no guard is watching now; if every one is watched, a spot out of their sight near the nearest (wait there)
      const left = run.items.filter(i => !i.got), free = left.filter(i => !crateWatched(run, i.x, i.y));
      const it = nearest(free.length ? free : left); if (!it) return null;
      if (free.length) return [it.x, it.y];
      const g = run.actors.filter(a => a.kind === 'guard').sort((a, b) => dist(a.b.x, a.b.y, it.x, it.y) - dist(b.b.x, b.b.y, it.x, it.y))[0];
      if (!g) return [it.x, it.y];
      const a = Math.atan2(it.y - g.b.y, it.x - g.b.x); return [it.x + Math.cos(a) * 170, it.y + Math.sin(a) * 170];
    }
  }
  return undefined;
}
export function jobAim(run: Run): [number, number] | null {
  const st = run.cur, p = run.w.p; if (!st) return null;
  if (st.t === 'defend') { const a = run.actors.filter(a => a.kind === 'pest' && a.extra !== 2).sort((a, b) => dist(a.b.x, a.b.y, p.x, p.y) - dist(b.b.x, b.b.y, p.x, p.y))[0]; return a ? [a.b.x, a.b.y] : null; }
  return null;
}
/** gadgets on the people of these steps (true: handled) */
export function jobGadget(run: Run, a: Actor, g: GadgetId, pw: number, x: number, y: number): boolean {
  const w = run.w, st = run.cur;
  switch (a.kind) {
    case 'guard':
      if (g === 'paint') { a.extra2 = 8 * pw; w.fx.push({ t: 'blind', x: a.b.x, y: a.b.y }); return true; }
      if (g === 'popper' || g === 'confetti') { a.stare = 3; a.stareX = x; a.stareY = y; return true; }
      if (g === 'net') { a.extra2 = 3 * pw; a.hits = 1; return true; }
      if (run.meter && st?.t !== 'heist') { run.meter.v = Math.min(1, run.meter.v + 0.3); run.warn('The guard felt that! He’s looking round…'); }
      return true;
    case 'cam':
      if (g === 'paint') { a.extra2 = 1e9; a.hits = 2; w.fx.push({ t: 'blind', x: a.b.x, y: a.b.y }); run.warn('Splat! That camera sees nothing now.'); return true; }
      return false;
    case 'pest': if (a.extra === 2) return false;
      // a sneak's box (or branch) takes the hit: it is knocked off, and the raider is just a raider again
      if (a.sneaky) { a.sneaky = false; w.fx.push({ t: 'hit', x: a.b.x, y: a.b.y, k: 0, kind: 'pest' }); return true; }
      // a toy makes a raider dizzy for a moment (on Assist it sends them packing); you still have to bowl it over
      if (!run.assist && a.extra !== 1) { if (a.stun > 0) return false; a.stun = 1.7; w.fx.push({ t: 'hit', x: a.b.x, y: a.b.y, k: 0, kind: 'pest' }); return true; }
      { const had = a.extra === 1; a.extra = 2; a.stun = 1.1; a.b.h = Math.atan2(a.b.y - y, a.b.x - x); w.fx.push({ t: 'shoo', x: a.b.x, y: a.b.y }); if (had && run.js) run.js.hp = Math.min(1, run.js.hp + 0.05); } return true;
    case 'watcher':
      if (g === 'paint') { a.extra2 = 8 * pw; w.fx.push({ t: 'blind', x: a.b.x, y: a.b.y }); }
      if (run.meter) { run.meter.v = Math.min(1, run.meter.v + 0.3); run.warn('Shooting toys in a disguise? Very shifty.'); }
      return true;
    case 'lured':
      if (a.extra !== 0 || !run.js) return false;
      if (g === 'net') { a.extra = 1; a.netT = 1e9; run.js.caught++; if (a.skin === 'myna') w.s.stats.mynahs++; if (a.skin === 'bat') w.s.stats.bats++; w.fx.push({ t: 'job-caught', x: a.b.x, y: a.b.y }); return true; }
      escape(run, a, 'shot at'); run.warn('That scared one off! Spring the nets instead.'); return true;
  }
  return false;
}
