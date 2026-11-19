// Jade Street: Madame Glint, the finale, in three phases across Clarke Quay, each with its own checkpoint.
//   1 · Decoys. Glint rides her scooter round the boulevard and every few seconds throws out two decoy riders who look
//       just like her; only the real Glint sparkles gold. Bumping a decoy bursts it in a puff of feathers and paper
//       and costs you a moment. Two bumps on the real one end the phase.
//   2 · Falling signs. Neon signs drop onto the road ahead of you: a sign flickers and its red shadow grows on the road
//       before it falls, so steer out of the shadow. A sign that lands on you stops you dead and lets her pull away.
//   3 · The float. Glint jumps onto her phoenix parade float and it rolls west along the road under the rooftops.
//       Climb the fire ladder, run the roofs to a flag on the roof edge, and leap when the float passes beneath it.
//       Leap too soon or too late and you tumble back onto the roof; if the float rolls out of the Strip, it's gone.
// The getaway meter (lib/jade-mission.ts) and the float's progress are the readable ways to fail.
import { T } from './jade-city.js';
import { mvT, mvTs, mvP } from './jade-layout.js';
import { dist } from './jade-rng.js';
import { nearestFree } from './jade-nav.js';
import type { Step } from './jade-story.js';
import type { Run, Actor } from './jade-mission.js';
import type { Near } from './jade-game.js';
import { telegraph } from './jade-setpiece.js';

export type Sign = { x: number; y: number; t: number; ph: 'warn' | 'fall' | 'wreck'; warn: number; hit: boolean };
export type Float = { x: number; y: number; speed: number; moving: boolean; done: boolean; t: number };
/** the fire ladder up to the roofs beside the road, the three flags on the roof edge, and where the float runs */
/** (tiles and world units written in the old frame, moved through the layout table) */
export const LADDER: [number, number] = mvT(105, 33);
export const LEAP_SPOTS: [number, number][] = mvTs([[103, 34], [99, 34], [95, 34]]);
export const [FLOAT_START, FLOAT_Y] = mvP(118.5 * T, 32.5 * T), FLOAT_END = mvP(86 * T, 32.5 * T)[0];
export const leapSpot = (i: number): [number, number] => [LEAP_SPOTS[i][0] * T + T / 2, LEAP_SPOTS[i][1] * T + 12];

type Chase = Extract<Step, { t: 'chase' }>;
export function bossEnter(run: Run, st: Chase) {
  run.signs = []; run.spawnT = st.phase === 1 ? 2.5 : 2;
  if (st.phase === 1) run.warn('Glint throws decoys! Only the real Glint sparkles gold.');
  if (st.phase === 2) run.warn('Neon signs are falling: steer out of the red shadows!');
}
export function bossStep(run: Run, st: Chase, dt: number) {
  const w = run.w, glint = run.actors[0]; if (!glint) return;
  const p = w.p, pb = p.ride ? p.ride.b : p.b;
  const hard = w.s.settings.diff === 'hard';
  run.spawnT -= dt;
  if (st.phase === 1) {
    const alive = run.actors.filter(a => a.kind === 'decoy' && !a.gone).length;
    if (run.spawnT <= 0 && alive === 0 && glint.stun <= 0) {
      run.spawnT = w.assist ? 8 : hard ? 5 : 6.5;
      for (let i = 0; i < 2; i++) {
        // each decoy sets off round the loop from a different waypoint, so they split up at the next crossing
        const route = glint.route.slice((glint.wp + 1 + i) % glint.route.length).concat(glint.route.slice(0, (glint.wp + 1 + i) % glint.route.length));
        const d = run.actor('decoy', glint.b.x + (i ? 18 : -18), glint.b.y, 'small', route, glint.speed);
        d.b.h = glint.b.h; d.extra = 7; run.actors.push(d);
      }
      w.fx.push({ t: 'decoy', x: glint.b.x, y: glint.b.y });
    }
    for (const d of run.actors) {
      if (d.kind !== 'decoy' || d.gone) continue;
      d.t += dt; d.extra = (d.extra ?? 7) - dt;
      run.walk(d, dt, st.speed * (w.assist ? 0.84 : 1) * w.diff.chase * 0.97, true);
      const hitting = p.ride ? pb.speed > 90 : (p.dashT > 0 || p.hopT > 0);
      if (dist(d.b.x, d.b.y, pb.x, pb.y) < d.b.r + pb.r + 4 && hitting) { pop(run, d); w.knock(d.b.x, d.b.y, 0.5, 'feather', 0.35, 0.4); run.warn('A decoy! Follow the one that sparkles.'); continue; }
      if (d.extra <= 0) pop(run, d);
    }
    run.actors = run.actors.filter(a => !a.gone || a === glint);
  }
  if (st.phase === 2) {
    if (run.spawnT <= 0 && run.signs.filter(s => s.ph !== 'wreck').length < 2) {
      run.spawnT = w.assist ? 3.4 : hard ? 2.2 : 2.7;
      // ahead of where you are going, on the road
      const ahead = Math.max(140, Math.min(330, pb.speed * 0.95 + 60));
      const [x, y] = nearestFree(w.c, 'small', pb.x + Math.cos(pb.h) * ahead, pb.y + Math.sin(pb.h) * ahead, w.open, 2);
      run.signs.push({ x, y, t: 0, ph: 'warn', warn: telegraph(run, 1.15), hit: false });
      w.fx.push({ t: 'flicker', x, y });
    }
    for (const s of run.signs) {
      s.t += dt;
      if (s.ph === 'warn' && s.t >= s.warn) { s.ph = 'fall'; s.t = 0; }
      else if (s.ph === 'fall' && s.t >= 0.22) {
        s.ph = 'wreck'; s.t = 0; w.fx.push({ t: 'smash', x: s.x, y: s.y, k: 0.8, kind: 'neon' });
        if (!p.roof && dist(s.x, s.y, pb.x, pb.y) < 50 + pb.r * 0.5) { s.hit = true; w.knock(s.x, s.y, 1, 'neon', 0.75, 0); if (run.meter) run.meter.v = Math.min(0.9, run.meter.v + 0.1); run.warn('Ouch! Watch for the red shadow and steer clear.'); }
      }
    }
    run.signs = run.signs.filter(s => !(s.ph === 'wreck' && s.t > 2.4));
  }
}
function pop(run: Run, d: Actor) { d.gone = true; run.w.fx.push({ t: 'poof', x: d.b.x, y: d.b.y, kind: 'feather' }); }

// ── phase 3: the float
export function floatEnter(run: Run) {
  // the wardens are busy holding back the parade crowd: no heat in the last act
  run.w.clearHeat(); run.w.heat = 0;
  run.float = { x: FLOAT_START, y: FLOAT_Y, speed: 112 * (run.w.assist ? 0.78 : 1) * run.w.diff.chase, moving: false, done: false, t: 0 };
  run.meter = { name: 'Float', v: 0 };
  run.label = 'Get off, climb the fire ladder by the road and wait on a rooftop flag';
}
export function floatStep(run: Run, dt: number) {
  const w = run.w, f = run.float; if (!f) return; const p = w.p;
  f.t += dt;
  const lx = LADDER[0] * T + T / 2, ly = LADDER[1] * T + T / 2;
  // with a bunting rope in the job, the float only swings in under the flags once the partner hauls on it
  if (!f.moving && !f.done && (p.roof || dist(p.x, p.y, lx, ly) < 9 * T) && roped(run)) { f.moving = true; w.fx.push({ t: 'float-go', x: f.x, y: f.y }); run.warn('Glint’s float is rolling! Leap from a flag as it passes beneath.'); }
  if (f.moving && !f.done) {
    f.x -= f.speed * dt;
    const k = (FLOAT_START - f.x) / (FLOAT_START - FLOAT_END);
    run.meter = { name: 'Float', v: Math.min(1, k), bad: k > 0.66 };
    if (f.x <= FLOAT_END) return run.fail('Glint’s float rolled out of the Strip! Wait on a flag and leap as it passes under you.');
  }
  run.label = f.done ? run.label : p.roof ? (inWindow(run) >= 0 ? 'LEAP NOW! (E or hop)' : 'Wait on a flag until the float is right below') : 'Get off, climb the fire ladder by the road and wait on a rooftop flag';
}
/** the flag whose leap window the float is in right now, or -1 */
export function inWindow(run: Run): number {
  const f = run.float; if (!f || !f.moving || f.done || !roped(run)) return -1;
  const half = run.w.assist ? 96 : 72;
  for (let i = 0; i < LEAP_SPOTS.length; i++) { const [sx] = leapSpot(i); if (Math.abs(f.x - sx) < half) return i; }
  return -1;
}
/** no rope in this job, or the partner is hauling it */
export function roped(run: Run) { const st = run.cur, m = run.w.mate; return !(st && st.t === 'float' && st.rope) || (m.ai.mode === 'hold' && m.ai.holding); }
export function floatNear(run: Run, x: number, y: number): Near | null {
  if (!run.w.p.roof || !run.float || run.float.done) return null;
  for (let i = 0; i < LEAP_SPOTS.length; i++) { const [sx, sy] = leapSpot(i); if (dist(sx, sy, x, y) < 56) return { kind: 'leap', label: inWindow(run) === i ? 'Leap onto the float!' : 'Leap (wait for the float)', x: sx, y: sy, id: String(i) }; }
  return null;
}
/** the leap from a roof flag (Action, or a hop off the roof edge near a flag); true when it was handled */
export function tryLeap(run: Run, fromHop = false): boolean {
  const w = run.w, p = w.p, f = run.float; if (!f || f.done || !p.roof) return false;
  let spot = -1;
  for (let i = 0; i < LEAP_SPOTS.length; i++) { const [sx, sy] = leapSpot(i); if (dist(sx, sy, p.b.x, p.b.y) < (fromHop ? 80 : 56)) spot = i; }
  if (spot < 0) return false;
  const ok = inWindow(run) === spot;
  const [sx, sy] = leapSpot(spot);
  p.b.x = sx; p.b.y = sy; p.face = 'side'; p.flip = f.x < sx;
  w.fx.push({ t: 'leap', x: sx, y: sy });
  p.act = { n: 'leap', t: 0, dur: 0.55, then: () => {
    if (ok) {
      f.done = true; f.moving = false; p.roof = false; p.b.x = f.x + 20; p.b.y = f.y - 6; p.b.speed = 0;
      w.fx.push({ t: 'land', x: p.b.x, y: p.b.y, k: 1 }); w.fx.push({ t: 'boss-down', x: f.x, y: f.y });
      const [lx, ly] = nearestFree(w.c, 'foot', f.x - 40, f.y + 10, w.open, 3); run.loot = { x: lx, y: ly, sprite: 'h-drum' };
      w.fx.push({ t: 'loot', x: lx, y: ly, kind: 'heirloom' });
      p.act = { n: 'land', t: 0, dur: 0.4 }; run.meter = null; run.next();
    } else { p.b.x = sx; p.b.y = sy + 6; p.lastRoof = [p.b.x, p.b.y]; p.act = { n: 'tumble', t: 0, dur: 0.6 }; w.fx.push({ t: 'land', x: p.b.x, y: p.b.y, k: 0.5 }); run.warn(f.x > sx ? 'Too soon! Wait until the float is right below the flag.' : 'Too late! Run to the next flag along.'); }
  } };
  return true;
}
