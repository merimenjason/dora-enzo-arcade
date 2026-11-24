// Jade Street, the twenty-sixth pass's new job step: `stones`, hopping the stepping stones across the Kallang River in
// Bishan-Ang Mo Kio Park. The park's river is built to flood: upstream rain comes down it in SURGES, every few seconds a
// rush of water over the low stones. `stones` is the bank you start from, each stone in turn, then the far bank. You
// cannot walk it (water between every stone): beside the next stone, E hops you onto it (a leap, then a wobbling landing).
// Each stone is HIGH (mossy, always dry) or LOW (flat, wet; `low` lists which, by their place in `stones`), as painted.
// The surge comes round on a clock the HUD shows: CALM (go), RISING (it is coming: stay on a high stone, or get off the
// low one), SURGE (the low stones are under). Standing on a low stone when the surge comes over it, or landing on one
// while it is under, sweeps you off: you scramble back onto the last high stone (or the bank) behind, a few seconds
// lost, never the job. So: wait on the high stones, and cross each low one (two hops) inside a calm. `surge` scales the
// clock (a faster river: under 1); `time` is how long you have. Assist (on by default) gives a slower clock and a
// longer warning; Hard a quicker one. Only the hero you control hops: the partner waits on the bank. Its own hero
// poses: the leap, the one-footed wobbling landing, and swept off sideways. No DOM; deterministic.
import { dist } from './jade-rng.js';
import type { Run } from './jade-mission.js';
import type { Step } from './jade-story.js';
import type { Near } from './jade-game.js';

type Stones = Extract<Step, { t: 'stones' }>;
export type Surge = 'calm' | 'warn' | 'surge';
export type StonesState = { k: number; t: number; hop: { from: [number, number]; to: [number, number]; i: number } | null; sweeps: number; landT: number };
/** the surge clock (seconds): a whole cycle, the warning before a surge and the surge itself; with Assist and on Hard.
 * A hop's flight and its landing wobble; how near the next stone E reaches; the seconds a sweep costs */
export const STONES = {
  period: 5.2, warn: 1.6, surge: 1.4,
  assist: { period: 6.6, warn: 2.2 }, hard: { period: 4.6, warn: 1.3 },
  hop: 0.42, land: 0.26, reach: 96, swept: 0.9, lose: 3,
} as const;
const ST = new WeakMap<Run, StonesState>();
export const stonesOf = (run: Run) => ST.get(run) ?? null;
/** on a stepping-stones job (the partner waits on the bank) */
export const stepping = (run: Run | null) => !!run && run.cur?.t === 'stones' && ST.has(run);
/** a stone is low (goes under in a surge): as the step lists them; the banks never */
export const isLow = (st: Stones, i: number) => i > 0 && i < st.stones.length - 1 && st.low.includes(i);
/** this run's surge clock: [period, warn, surge] */
export function clockOf(run: Run, st: Stones): [number, number, number] {
  const m = run.assist ? STONES.assist : run.w.s.settings.diff === 'hard' ? STONES.hard : STONES;
  const k = st.surge ?? 1;
  return [m.period * k, m.warn * Math.max(0.8, k), STONES.surge];
}
/** where the surge clock is at time `t`: the phase and the seconds left in it. A cycle opens calm, then the warning, then
 * the surge */
export function surgeAt(run: Run, st: Stones, t: number): { ph: Surge; left: number } {
  const [P, Wn, Sg] = clockOf(run, st), u = t % P, calm = P - Wn - Sg;
  if (u < calm) return { ph: 'calm', left: calm - u };
  if (u < calm + Wn) return { ph: 'warn', left: calm + Wn - u };
  return { ph: 'surge', left: P - u };
}
const spots = (run: Run, st: Stones) => st.stones.map(s => run.spot(s));
const progress = (st: Stones, k: number) => `Stones ${Math.min(k, st.stones.length - 2)}/${st.stones.length - 2}`;

export function stonesEnter(run: Run, st: Step): boolean {
  if (st.t !== 'stones') return false;
  // the clock starts a second into its calm, so the first hop out is never a race
  ST.set(run, { k: 0, t: 0, hop: null, sweeps: 0, landT: 0 });
  run.progress = progress(st, 0);
  if (st.time) run.timer = st.time * (run.assist ? 1.4 : 1) * run.w.diff.timer;
  run.meter = { name: 'River', v: 1 };
  run.w.say('The river surges every few seconds. Wait on the high mossy stones; cross each low wet one while the water is calm.', 'good');
  return true;
}
export function stonesStep(run: Run, st: Step, dt: number): boolean {
  if (st.t !== 'stones') return false;
  const c = ST.get(run); if (!c) return true;
  const w = run.w, p = w.p; c.t += dt;
  const pts = spots(run, st), n = pts.length, sg = surgeAt(run, st, c.t);
  const [P, Wn] = clockOf(run, st);
  // the River meter: the calm left (full at the start of a calm), red while rising or under
  run.meter = sg.ph === 'calm' ? { name: 'River', v: Math.max(0.05, sg.left / (P - Wn - STONES.surge)) } : { name: sg.ph === 'warn' ? 'Rising' : 'Surge', v: sg.ph === 'warn' ? sg.left / Wn : 0, bad: true };
  // in the air: the hero flies along the hop's arc (the pose is the act's), and lands at the end
  if (c.hop) {
    const a = p.act; const f = a && a.n === 'stone-hop' ? Math.min(1, a.t / a.dur) : 1;
    p.b.x = c.hop.from[0] + (c.hop.to[0] - c.hop.from[0]) * f; p.b.y = c.hop.from[1] + (c.hop.to[1] - c.hop.from[1]) * f;
    run.label = 'Hop!';
    return true;
  }
  if (p.act) return true;
  if (p.ride) { run.label = 'Hop off (E): the stones are crossed on foot'; return true; }
  // standing on a low stone as the surge comes over it: swept off
  if (c.k > 0 && isLow(st, c.k) && sg.ph === 'surge' && dist(p.x, p.y, pts[c.k][0], pts[c.k][1]) < STONES.reach) { sweep(run, st, c, pts); return true; }
  if (c.k >= n - 1) return true;
  const next = c.k + 1, low = isLow(st, next), here = dist(p.x, p.y, pts[c.k][0], pts[c.k][1]) < STONES.reach;
  if (!here) { run.label = c.k === 0 ? `Get to the bank by the first stone: ${st.label}` : 'Back onto the stone you are on'; return true; }
  const onLow = isLow(st, c.k), on = c.k === 0 ? 'here on the bank' : 'on this high stone';
  if (sg.ph === 'surge') run.label = onLow ? 'SURGE! Off this stone, now (E)' : `The surge is over the low stones: wait here on ${c.k === 0 ? 'the bank' : 'the high stone'}`;
  else if (sg.ph === 'warn') run.label = onLow ? 'The water is RISING: hop on to the high stone, now (E)' : low ? `The water is RISING: wait ${on} for the surge to pass` : 'Rising: hop on (E) to the high stone';
  else run.label = next === n - 1 ? 'Calm: hop onto the far bank (E)' : low ? 'Calm! Hop onto the low stone (E) and straight on over it' : 'Calm: hop on (E) to the next stone';
  return true;
}
function sweep(run: Run, st: Stones, c: StonesState, pts: [number, number][]) {
  const w = run.w, p = w.p;
  let back = c.k - 1; while (back > 0 && isLow(st, back)) back--;
  c.sweeps++; run.hits++;
  if (run.timer !== null) run.timer = Math.max(0.5, run.timer - STONES.lose);
  w.s.stats.sweeps++;
  w.fx.push({ t: 'spill', x: p.x, y: p.y });
  w.say(c.sweeps === 1 ? 'Swept off! A low stone goes under in a surge: wait for CALM on the high stone, then cross the low one quickly.' : `Swept off! Back onto the high stone, -${STONES.lose} s`, 'bad');
  const to = pts[back];
  p.b.speed = 0;
  p.act = { n: 'stone-swept', t: 0, dur: STONES.swept, then: () => { p.b.x = to[0]; p.b.y = to[1]; c.k = back; run.progress = progress(st, back); } };
}
export function stonesNear(run: Run, x: number, y: number): Near | null {
  const st = run.cur, p = run.w.p; if (!st || st.t !== 'stones' || p.ride || p.act) return null;
  const c = ST.get(run); if (!c || c.hop || c.k >= st.stones.length - 1) return null;
  const pts = spots(run, st), [sx, sy] = pts[c.k];
  if (dist(sx, sy, x, y) > STONES.reach) return null;
  // anchored on the stone you stand on (the next one is two tiles off, past the prompt's reach)
  return { kind: 'job', label: c.k + 1 === pts.length - 1 ? 'Hop onto the bank' : 'Hop to the next stone', x: sx, y: sy, id: 'stone:hop' };
}
export function stonesAct(run: Run, id: string): boolean {
  const st = run.cur, w = run.w, p = w.p; if (!st || st.t !== 'stones' || id !== 'stone:hop') return false;
  const c = ST.get(run); if (!c || c.hop || p.act || c.k >= st.stones.length - 1) return true;
  const pts = spots(run, st), n = pts.length, i = c.k + 1, from: [number, number] = [p.x, p.y], to = pts[i];
  c.hop = { from, to, i };
  p.b.speed = 0; p.b.h = Math.atan2(to[1] - from[1], to[0] - from[0]);
  p.face = Math.abs(to[0] - from[0]) > Math.abs(to[1] - from[1]) ? 'side' : to[1] < from[1] ? 'up' : 'down';
  w.fx.push({ t: 'hop', x: p.x, y: p.y });
  p.act = { n: 'stone-hop', t: 0, dur: STONES.hop, then: () => {
    c.hop = null; p.b.x = to[0]; p.b.y = to[1]; c.k = i; run.progress = progress(st, i);
    w.fx.push({ t: 'land', x: to[0], y: to[1], k: 0.4 });
    if (i >= n - 1) { finish(run, st, c); return; }
    // landing on a low stone while it is under: straight off again
    if (isLow(st, i) && surgeAt(run, st, c.t).ph === 'surge') { sweep(run, st, c, pts); return; }
    p.act = { n: 'stone-land', t: 0, dur: STONES.land };
  } };
  return true;
}
function finish(run: Run, st: Stones, c: StonesState) {
  const w = run.w; w.s.stats.crossings++;
  w.say(c.sweeps === 0 ? 'Across, and dry feet all the way! You read that river like a local.' : 'Across the river!', 'good');
  run.next();
}
/** where the route arrow points: the bank to start from, then the next stone */
export function stonesTarget(run: Run): [number, number] | null | undefined {
  const st = run.cur, c = ST.get(run); if (!st || st.t !== 'stones' || !c) return undefined;
  const pts = spots(run, st);
  const p = run.w.p;
  if (dist(p.x, p.y, pts[c.k][0], pts[c.k][1]) > STONES.reach) return pts[c.k];
  return pts[Math.min(pts.length - 1, c.k + 1)];
}
/** what the failure card says when the time runs out */
export const stonesTimeUp = 'Out of time! Watch the River meter: hop while it is CALM, wait on the high mossy stones while it rises, and cross each low wet stone with two quick hops.';
