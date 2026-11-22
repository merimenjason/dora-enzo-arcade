// Jade Street, the twenty-second pass's new job step: `summit`, the climb up Bukit Timah Hill's summit trail, marker to
// marker. The hill takes your BREATH, a meter on the HUD: walking up the trail costs a little, running a lot (a dash
// more), and standing still gives a little back. Stand still under one of the trail's rest shelters and it comes back
// fast. Let it run out and you are winded: you stop, bent double, for a few seconds (the clock keeps going), then go on
// with half a breath; the job never ends for it. `route`: the markers (a step may start part way up). `pace`: how hard
// the climb is against the usual (a night climb in a hurry is steeper going). Assist (on by default) gives an easier
// breath; Hard a harder one. Its own hero poses: stepping up the trail (two frames), winded, resting on a shelter's
// bench, arms up at the summit. On the trail the hero's run is a hill run (SUMMIT.top: slower than on the flat).
// No DOM; deterministic.
import { dist } from './jade-rng.js';
import { FOOT } from './jade-move.js';
import type { Run } from './jade-mission.js';
import type { Step } from './jade-story.js';

type Summit = Extract<Step, { t: 'summit' }>;
export type SummitState = { k: number; breath: number; winds: number; rested: number; top: boolean };
/** breath used a second walking, running and dashing up the trail, and got back a second standing still and standing
 * still under a shelter (out of 1); how near a marker counts, how near a shelter's bench is under it, how long you are
 * winded, the breath you go on with, the seconds a winding costs, the top speed on the trail; the multipliers on what the
 * climb costs with Assist and on Hard */
export const SUMMIT = { walk: 0.025, run: 0.07, dash: 0.3, still: 0.1, shelter: 0.6, reach: 66, rest: 100, winded: 2.6, after: 0.5, lose: 2,
  top: 205, assist: 0.7, hard: 1.2 } as const;
const ST = new WeakMap<Run, SummitState>();
export const summitOf = (run: Run) => ST.get(run) ?? null;
/** what the climb costs on this run (Assist, Hard, the step's own pace) */
export const costOf = (run: Run, st: Summit) => (run.assist ? SUMMIT.assist : run.w.s.settings.diff === 'hard' ? SUMMIT.hard : 1) * (st.pace ?? 1);
/** under a rest shelter (beside one of the trail's benches) */
export const underShelter = (run: Run, x: number, y: number) => (run.w.c.bukit?.shelters ?? []).some(([sx, sy]) => dist(sx, sy, x, y) < SUMMIT.rest);
/** on a summit climb (the hero's run is a hill run, and the climbing poses show) */
export const climbing = (run: Run | null) => !!run && run.cur?.t === 'summit';

export function summitEnter(run: Run, st: Step): boolean {
  if (st.t !== 'summit') return false;
  ST.set(run, { k: 0, breath: 1, winds: 0, rested: 0, top: false });
  run.progress = `Markers 0/${st.route.length}`;
  if (st.time) run.timer = st.time * (run.assist ? 1.4 : 1) * run.w.diff.timer;
  run.meter = { name: 'Breath', v: 1 };
  run.w.say('Up the hill! Walking saves your breath; running burns it. If the Breath meter runs low, stand still under a rest shelter to get it back.', 'good');
  return true;
}
export function summitStep(run: Run, st: Step, dt: number): boolean {
  if (st.t !== 'summit') return false;
  const c = ST.get(run); if (!c) return true;
  const w = run.w, p = w.p;
  if (p.ride) { run.label = 'Hop off (E): the summit trail is climbed on foot'; return true; }
  if (c.top) { run.label = 'The summit!'; return true; }
  // the breath: spent moving, got back standing still (fast under a shelter); none of it while winded
  const cost = costOf(run, st), sp = p.b.speed, still = sp < 8 && !p.air;
  const shelter = still && underShelter(run, p.x, p.y);
  if (p.act?.n === 'winded') { /* bent double: the breath comes back when it ends */ }
  else if (still) { c.breath = Math.min(1, c.breath + (shelter ? SUMMIT.shelter : SUMMIT.still) * dt); if (shelter) c.rested += dt; }
  else c.breath -= (p.dashT > 0 ? SUMMIT.dash : sp > FOOT.walk + 10 ? SUMMIT.run : SUMMIT.walk) * cost * dt;
  if (c.breath <= 0 && !p.act) {
    c.breath = 0; c.winds++; run.hits++;
    p.b.speed = 0; p.dashT = 0; p.face = 'down';
    p.act = { n: 'winded', t: 0, dur: SUMMIT.winded, then: () => { c.breath = SUMMIT.after; } };
    if (run.timer !== null) run.timer = Math.max(0.5, run.timer - SUMMIT.lose);
    w.say(c.winds === 1 ? 'Winded! Get your breath back… Next time walk when the Breath meter is low, or stop under a rest shelter.' : 'Winded again! Walk, and rest under the shelters.', 'bad');
  }
  run.meter = { name: 'Breath', v: Math.max(0, c.breath), bad: c.breath < 0.3 };
  // the markers, one at a time
  if (c.k < st.route.length) {
    const [mx, my] = run.spot(st.route[c.k]);
    if (dist(mx, my, p.x, p.y) < SUMMIT.reach) {
      c.k++; run.progress = `Markers ${c.k}/${st.route.length}`;
      w.fx.push({ t: 'checkpoint' });
    }
  }
  if (c.k >= st.route.length && !p.act) {
    c.top = true; p.b.speed = 0; p.face = 'down';
    p.act = { n: 'summit-top', t: 0, dur: 1.2, then: () => finish(run, c) };
    return true;
  }
  // the words: where to go, and what the breath says
  const pct = Math.round(Math.max(0, c.breath) * 100);
  if (p.act?.n === 'winded') run.label = 'Winded… getting your breath back';
  else if (shelter && c.breath < 1) run.label = `Resting under the shelter: breath ${pct}%`;
  else if (c.breath < 0.3) run.label = `Out of breath (${pct}%)! Walk, or stand still under a rest shelter`;
  else run.label = `${st.label} (breath ${pct}%)`;
  return true;
}
function finish(run: Run, c: SummitState) {
  const w = run.w; w.s.stats.summits++;
  w.say(c.winds === 0 ? 'The summit, and not even puffed! 163 metres: the highest ground in Singapore.' : 'The summit! 163 metres: the highest ground in Singapore.', 'good');
  run.next();
}
/** where the route arrow points: the next marker */
export function summitTarget(run: Run): [number, number] | null | undefined {
  const st = run.cur, c = ST.get(run); if (!st || st.t !== 'summit' || !c) return undefined;
  return st.route.length ? run.spot(st.route[Math.min(c.k, st.route.length - 1)]) : null;
}
