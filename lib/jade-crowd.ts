// Jade Street, the eighteenth pass's new job step: `crowd`, getting through the match-night crowds at the Sports Hub.
// Between `from` and `to` the fans stream across your way in lanes (each lane one way, the next the other, the way
// crowds part and re-form round the gates): clusters of two to four fans, then a gap. Walk into a lane while a fan is
// passing and you are shoved back to the lane's near edge (its own stumble pose) and lose a few seconds; step in as a gap
// comes by and you squeeze through (its own pose while you are in a lane). Assist (on by default) slows the fans, widens
// the gaps and says "Go!" while the gap in front of you is wide enough; Hard quickens them. `ticket`: the step ends with
// E at the turnstile (holding the ticket up, its own pose). `item`: you carry something through. No DOM; deterministic:
// a fan's place is a function of the step's clock alone.
import { dist } from './jade-rng.js';
import { T } from './jade-city.js';
import type { Run } from './jade-mission.js';
import type { Step } from './jade-story.js';
import type { Near } from './jade-game.js';

type Crowd = Extract<Step, { t: 'crowd' }>;
/** a lane: its centre along the way (world units from `from`), which way its fans walk across (+1 or -1), their speed,
 * the length of its loop, and where each fan starts on it */
export type Lane = { at: number; dir: 1 | -1; v: number; loop: number; fans: number[]; skin: number[] };
export type CrowdState = { ux: number; uy: number; nx: number; ny: number; ox: number; oy: number; len: number; span: number; lanes: Lane[];
  /** the step's own clock (fans move on it), the grace after a shove, the lanes crossed, shoves taken */
  t: number; grace: number; crossed: number; shoves: number };
/** a fan's and the hero's size (a touch within FAN_R + HERO_R shoves you), the half-depth of a lane along the way, how far
 * a shove sends you back, the time it costs, and how near the turnstile E reaches */
export const FAN_R = 16, HERO_R = 12, BAND = 26, SHOVE_S = 3, GATE_R = 70;
/** the walking pace of the fans (Normal), and the gap after each cluster (Normal, in world units) */
export const FAN_V = 78, GAP = 150, CLUSTER_GAP = 34;
const ST = new WeakMap<Run, CrowdState>();
export const crowdOf = (run: Run) => ST.get(run) ?? null;

/** a little hash for the fans' pattern: the same on every play of a step */
const h = (a: number, b: number) => { let x = (a * 374761393 + b * 668265263) | 0; x = (x ^ (x >>> 13)) * 1274126177; return ((x ^ (x >>> 16)) >>> 0) / 4294967296; };

export function crowdEnter(run: Run, st: Step): boolean {
  if (st.t !== 'crowd') return false;
  const [fx, fy] = run.spot(st.from), [tx, ty] = run.spot(st.to), len = Math.hypot(tx - fx, ty - fy) || 1;
  const ux = (tx - fx) / len, uy = (ty - fy) / len, span = (st.span ?? 3.5) * T;
  const hard = run.w.s.settings.diff === 'hard', v = FAN_V * (run.assist ? 0.75 : 1) * (hard ? 1.15 : 1), gap = GAP * (run.assist ? 1.35 : 1) * (hard ? 0.9 : 1);
  const lanes: Lane[] = [];
  for (let k = 0; k < st.lanes; k++) {
    const at = len * (k + 1) / (st.lanes + 1), loop = 2 * span + 2 * T, fans: number[] = [], skin: number[] = [], lv = v * (1 + h(k, 5) * 0.2);
    // (the gap the loop ends on is always wide enough to cross at a walk with time to spare, at this lane's own pace on
    // every difficulty: a person who waits at the edge always gets a way through)
    const wide = Math.max(gap, lv * (crossTime() + 0.8) + 2 * (FAN_R + HERO_R + 10));
    let s = h(run.i, k) * 60;
    // clusters of two to four, then a gap; the loop always ends on a wide gap so its wrap never closes one up
    while (s < loop - wide) {
      const n = 2 + Math.floor(h(k * 7 + fans.length, run.i + 3) * 3);
      for (let j = 0; j < n && s < loop - wide; j++) { fans.push(s); skin.push(Math.floor(h(fans.length, k + 11) * 3)); s += CLUSTER_GAP; }
      s += gap * (1 + h(fans.length, k) * 0.6);
    }
    lanes.push({ at, dir: k % 2 ? -1 : 1, v: lv, loop, fans, skin });
  }
  ST.set(run, { ux, uy, nx: -uy, ny: ux, ox: fx, oy: fy, len, span, lanes, t: 0, grace: 0, crossed: 0, shoves: 0 });
  run.progress = `Crowds 0/${st.lanes}`;
  if (st.time) run.timer = st.time * (run.assist ? 1.4 : 1) * run.w.diff.timer;
  if (st.item) run.w.p.carry = st.item;
  return true;
}
/** fan j of lane k at the step's time t: [world x, world y, how far across the lane (-span..span)] */
export function fanAt(c: CrowdState, k: number, j: number, t = c.t): [number, number, number] {
  const L = c.lanes[k], s = (((L.fans[j] + L.dir * L.v * t) % L.loop) + L.loop) % L.loop - L.loop / 2;
  return [c.ox + c.ux * L.at + c.nx * s, c.oy + c.uy * L.at + c.ny * s, s];
}
/** where (x, y) is: its distance along the way and across it */
const local = (c: CrowdState, x: number, y: number): [number, number] => [(x - c.ox) * c.ux + (y - c.oy) * c.uy, (x - c.ox) * c.nx + (y - c.oy) * c.ny];
/** the lane (x, y) stands in, or -1 */
export function laneAt(c: CrowdState, x: number, y: number): number { const [a, s] = local(c, x, y); if (Math.abs(s) > c.span + T) return -1; return c.lanes.findIndex(L => Math.abs(a - L.at) < BAND); }
/** in a crowd lane now (the scene's squeeze pose) */
export function crowdIn(run: Run, x: number, y: number): boolean { const c = ST.get(run); return !!c && run.cur?.t === 'crowd' && laneAt(c, x, y) >= 0; }
/** is lane k clear at the point `s` across it for the next `secs` seconds (no fan within reach of a walker crossing there) */
export function laneClear(c: CrowdState, k: number, s: number, secs: number): boolean {
  for (let q = 0; q <= secs + 1e-6; q += 0.1) for (let j = 0; j < c.lanes[k].fans.length; j++) if (Math.abs(fanAt(c, k, j, c.t + q)[2] - s) < FAN_R + HERO_R + 10) return false;
  return true;
}
/** the next lane ahead of a walker at (x, y) (the first whose far edge is still in front), or -1 */
export function nextLane(c: CrowdState, x: number, y: number): number { const [a] = local(c, x, y); return c.lanes.findIndex(L => a < L.at + BAND); }
/** the time a walker needs to cross one lane at a walk (the band and both bodies, at the walking pace) */
export const crossTime = (pace = 145) => (2 * BAND + 2 * HERO_R) / pace + 0.15;

export function crowdStep(run: Run, st: Step, dt: number): boolean {
  if (st.t !== 'crowd') return false;
  const c = ST.get(run); if (!c) return true;
  const w = run.w, p = w.p; c.t += dt; c.grace = Math.max(0, c.grace - dt);
  if (p.ride) { run.label = 'Hop off (E): the crowd is on foot'; return true; }
  const [a, s] = local(c, p.x, p.y);
  // a fan walks into you: shoved back out of the lane, its own stumble, a few seconds lost
  const k = laneAt(c, p.x, p.y);
  if (k >= 0 && c.grace <= 0 && !p.act) {
    const L = c.lanes[k];
    for (let j = 0; j < L.fans.length; j++) {
      const [fx, fy] = fanAt(c, k, j);
      if (dist(fx, fy, p.x, p.y) < FAN_R + HERO_R + 6) {
        const back = L.at - BAND - HERO_R - 10 - a;
        const nx = p.x + c.ux * back, ny = p.y + c.uy * back;
        p.b.x = nx; p.b.y = ny; p.b.speed = 0; p.face = 'down'; c.shoves++; c.grace = 1.1; run.hits++;
        p.act = { n: 'shoved', t: 0, dur: 0.6 };
        if (run.timer !== null) run.timer = Math.max(0.5, run.timer - SHOVE_S);
        w.fx.push({ t: 'crowd-bump', x: fx, y: fy });
        w.say(c.shoves === 1 ? 'Oof! The crowd shoves you back. Wait at the edge for a gap, then squeeze through.' : `Shoved back again! -${SHOVE_S} s`, 'bad');
        return true;
      }
    }
  }
  // lanes crossed so far
  const crossed = c.lanes.filter(L => a > L.at + BAND).length;
  if (crossed > c.crossed) { c.crossed = crossed; run.progress = `Crowds ${crossed}/${st.lanes}`; }
  const [tx, ty] = run.spot(st.to), there = dist(tx, ty, p.x, p.y) < (st.ticket ? GATE_R : 60);
  if (there && crossed >= st.lanes) {
    if (st.ticket) { run.label = 'E: show your ticket at the turnstile'; return true; }
    finish(run); return true;
  }
  // the words: in a lane, at the edge of the next one (Assist: "Go!" while the gap in front is wide enough), or on the way
  const n = nextLane(c, p.x, p.y);
  if (k >= 0) run.label = 'Squeeze through!';
  else if (n >= 0 && c.lanes[n].at - BAND - a < 70 && Math.abs(s) < c.span) {
    run.label = run.assist ? (laneClear(c, n, s, crossTime() + 0.25) ? 'Go! A gap in the crowd: squeeze through now' : 'Wait at the edge: a gap is coming') : 'Wait for a gap in the crowd, then squeeze through';
  } else run.label = st.label;
  return true;
}
function finish(run: Run) {
  const w = run.w, c = ST.get(run); const st = run.cur;
  if (st?.t === 'crowd' && st.item && w.p.carry === st.item && !st.keep) w.p.carry = null;
  w.s.stats.crowds++;
  w.say(c && c.shoves === 0 ? 'Through the crowd without a single bump!' : 'Through the crowd!', 'good');
  run.next();
}
export function crowdNear(run: Run, x: number, y: number): Near | null {
  const st = run.cur, c = ST.get(run), p = run.w.p; if (!st || st.t !== 'crowd' || !st.ticket || !c || p.ride || p.act) return null;
  const [tx, ty] = run.spot(st.to);
  if (c.lanes.every(L => local(c, x, y)[0] > L.at + BAND) && dist(tx, ty, x, y) < GATE_R) return { kind: 'job', label: 'Show your ticket at the turnstile', x: tx, y: ty, id: 'ticket' };
  return null;
}
export function crowdAct(run: Run, id: string): boolean {
  const st = run.cur, w = run.w, p = w.p; if (!st || st.t !== 'crowd' || id !== 'ticket' || p.act) return false;
  p.b.speed = 0; p.face = 'down';
  p.act = { n: 'gate-ticket', t: 0, dur: 1.0, then: () => { w.fx.push({ t: 'turnstile', x: p.x, y: p.y - 20 }); finish(run); } };
  return true;
}
/** where the route arrow points: the far side of the crowd */
export function crowdTarget(run: Run): [number, number] | null | undefined {
  const st = run.cur; if (!st || st.t !== 'crowd') return undefined;
  return run.spot(st.to);
}
