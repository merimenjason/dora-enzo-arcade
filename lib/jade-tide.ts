// Jade Street, the twenty-first pass's new job step: `tide`, a crossing of the Southern Islands' reef flats on foot. The
// tide runs a cycle you can read on the HUD: OUT (the reef is dry: cross it), TURNING (a few seconds' warning) and IN (the
// water comes over the flats). While it is in, anyone on the open reef is swept off their feet and washed back to the
// last marker they reached (a few seconds lost, never the job); a coral head (the dark rocks the markers stand on) or the
// sand of an island is safe, so you hop rock to rock, wait out the high water braced on one, and go on when it falls.
// `pools`: rock pools to peer into on the way (E at each, in order). `out`: a shorter low tide (a spring tide's crossing).
// Assist (on by default) gives a longer low tide and a shorter high one; Hard the other way. Its own hero poses: wading
// (two frames), braced on a coral head, washed off your feet, peering into a pool. On the open reef in a crossing you
// wade (TIDE.wade: slower than a walk, and no dash), so a long crossing takes more than one low tide. No DOM; deterministic.
import { dist } from './jade-rng.js';
import { T, W, G } from './jade-city.js';
import type { Run } from './jade-mission.js';
import type { Step } from './jade-story.js';
import type { Near } from './jade-game.js';

type Tide = Extract<Step, { t: 'tide' }>;
export type TidePhase = 'out' | 'turning' | 'in';
export type TideState = { k: number; pools: number; back: [number, number]; t: number; wash: number; washes: number; grace: number };
/** the tide's cycle (seconds out, turning, in) on Normal, Assist and Hard; how near a coral head is safe, how near a
 * marker or a pool counts, how long you can stand in the water before it takes you, and the seconds a wash costs */
export const TIDE = { out: 8, turn: 3, in: 5, outAssist: 11, turnAssist: 4, inAssist: 4, outHard: 6.5, turnHard: 2.5, inHard: 5.5,
  rock: 62, reach: 64, pool: 72, grace: 0.9, lose: 4, wade: 88 } as const;
const ST = new WeakMap<Run, TideState>();
export const tideOf = (run: Run) => ST.get(run) ?? null;
/** the cycle's three lengths for this run */
export function cycleOf(run: Run, st: Tide): [number, number, number] {
  const hard = run.w.s.settings.diff === 'hard';
  const out = run.assist ? TIDE.outAssist : hard ? TIDE.outHard : TIDE.out, turn = run.assist ? TIDE.turnAssist : hard ? TIDE.turnHard : TIDE.turn;
  const inn = run.assist ? TIDE.inAssist : hard ? TIDE.inHard : TIDE.in;
  return [st.out ? out * st.out : out, turn, inn];
}
/** where the tide is: its phase, the seconds until it changes, and how high the water is (0 dry, 1 over the flats) */
export function phaseOf(run: Run, st: Tide, t: number): { ph: TidePhase; left: number; v: number } {
  const [o, tu, i] = cycleOf(run, st), c = ((t % (o + tu + i)) + o + tu + i) % (o + tu + i);
  if (c < o) return { ph: 'out', left: o - c, v: 0 };
  if (c < o + tu) return { ph: 'turning', left: o + tu - c, v: (c - o) / tu };
  return { ph: 'in', left: o + tu + i - c, v: 1 };
}
/** the tile under a point is the open reef */
export const onReef = (run: Run, x: number, y: number) => run.w.c.ground[Math.floor(y / T) * W + Math.floor(x / T)] === G.REEF;
/** wading the open reef in a tide crossing (the hero's top speed drops to TIDE.wade there) */
export const wading = (run: Run | null, x: number, y: number) => !!run && run.cur?.t === 'tide' && onReef(run, x, y);
/** a coral head within reach of a point (safe from the water) */
export const onRock = (run: Run, x: number, y: number) => (run.w.c.islands?.rocks ?? []).some(([rx, ry]) => dist(rx, ry, x, y) < TIDE.rock);

export function tideEnter(run: Run, st: Step): boolean {
  if (st.t !== 'tide') return false;
  const p = run.w.p;
  ST.set(run, { k: 0, pools: 0, back: [p.x, p.y], t: 0, wash: 0, washes: 0, grace: 1 });
  run.progress = progress(st, 0, 0);
  if (st.time) run.timer = st.time * (run.assist ? 1.4 : 1) * run.w.diff.timer;
  run.meter = { name: 'Tide', v: 0 };
  run.w.say(`The tide is out: cross the reef now. When it turns, get onto a coral head or the sand and wait it out.`, 'good');
  return true;
}
const progress = (st: Tide, k: number, pools: number) => [st.pools?.length ? `Pools ${pools}/${st.pools.length}` : '', st.route.length ? `Markers ${k}/${st.route.length}` : ''].filter(Boolean).join(' · ');
export function tideStep(run: Run, st: Step, dt: number): boolean {
  if (st.t !== 'tide') return false;
  const c = ST.get(run); if (!c) return true;
  const w = run.w, p = w.p; c.t += dt; c.grace = Math.max(0, c.grace - dt);
  if (p.ride) { run.label = 'Hop off (E): the reef is crossed on foot'; return true; }
  const { ph, left, v } = phaseOf(run, st, c.t), secs = Math.ceil(left);
  const reef = onReef(run, p.x, p.y), rock = onRock(run, p.x, p.y), wet = ph === 'in' && reef && !rock && !p.air;
  run.meter = { name: 'Tide', v: ph === 'in' ? 1 : v, bad: ph !== 'out' };
  // the water over the flats: a moment's grace, then it takes you back to the last marker
  if (wet && c.grace <= 0 && !p.act) {
    c.wash += dt;
    if (c.wash >= TIDE.grace) {
      c.wash = 0; c.washes++; run.hits++;
      p.b.speed = 0; p.face = 'down';
      p.act = { n: 'tide-washed', t: 0, dur: 0.9, then: () => { w.placePlayer(c.back[0], c.back[1]); c.grace = 1.2; } };
      if (run.timer !== null) run.timer = Math.max(0.5, run.timer - TIDE.lose);
      w.fx.push({ t: 'spill', x: p.x, y: p.y });
      w.say(c.washes === 1 ? 'The tide took you off your feet! Back to the last marker. Next time, when the HUD says the tide is turning, get onto a coral head or the sand and wait.' : `Washed off the reef! Back to the last marker, -${TIDE.lose} s`, 'bad');
      return true;
    }
  } else c.wash = Math.max(0, c.wash - dt * 2);
  // the pools first (E at each), then the markers, one at a time
  const pools = st.pools ?? [];
  if (c.pools >= pools.length && c.k < st.route.length) {
    const [mx, my] = run.spot(st.route[c.k]);
    if (dist(mx, my, p.x, p.y) < TIDE.reach) {
      c.k++; c.back = [mx, my]; run.progress = progress(st, c.k, c.pools);
      w.fx.push({ t: 'checkpoint' });
    }
  }
  if (c.pools >= pools.length && c.k >= st.route.length) { finish(run, c); return true; }
  // the words: what the water is doing, and what to do about it
  const where = c.pools < pools.length ? 'the next rock pool' : 'the next marker';
  if (p.act?.n === 'tide-washed') run.label = 'Washed off your feet…';
  else if (ph === 'out') run.label = `Tide out (${secs} s): ${reef ? `cross to ${where} now` : st.label}`;
  else if (ph === 'turning') run.label = `Tide turning! ${secs} s: get onto a coral head (the dark rocks) or the sand${rock || !reef ? ' (you are safe here)' : ''}`;
  else run.label = wet ? 'Tide in! Get onto a coral head or the sand NOW' : `Tide in (${secs} s): stay on the ${rock ? 'coral head' : 'sand'} till it goes out`;
  return true;
}
function finish(run: Run, c: TideState) {
  const w = run.w; w.s.stats.tides++;
  w.say(c.washes === 0 ? 'Over the reef with dry knees. You read the tide like a local!' : 'Over the reef!', 'good');
  run.next();
}
/** E at the next rock pool */
export function tideNear(run: Run, x: number, y: number): Near | null {
  const st = run.cur, c = ST.get(run), p = run.w.p; if (!st || st.t !== 'tide' || !c || p.ride || p.act) return null;
  const pools = st.pools ?? []; if (c.pools >= pools.length) return null;
  const [px, py] = run.spot(pools[c.pools]);
  return dist(px, py, x, y) < TIDE.pool ? { kind: 'job', label: `Peer into the rock pool (${c.pools + 1} of ${pools.length})`, x: px, y: py, id: `pool:${c.pools}` } : null;
}
export function tideAct(run: Run, id: string): boolean {
  const st = run.cur, c = ST.get(run), w = run.w, p = w.p; if (!st || st.t !== 'tide' || !c || !id.startsWith('pool:')) return false;
  if (p.act) return true;
  const i = +id.split(':')[1]; if (i !== c.pools) return true;
  p.b.speed = 0; p.face = 'down';
  p.act = { n: 'tide-peer', t: 0, dur: 1.0, then: () => {
    if (c.pools !== i) return;
    c.pools++; c.back = run.spot(st.pools![i]); run.progress = progress(st, c.k, c.pools);
    w.fx.push({ t: 'checkpoint' });
    w.say(POOL_SAY[i % POOL_SAY.length], 'good');
  } };
  return true;
}
const POOL_SAY = ['A sea star and two hermit crabs. Counted!', 'A giant clam, shut tight. Counted!', 'An anemone with a clownfish in it. Counted!', 'A tiny octopus, gone in a puff of ink. Counted!', 'A seahorse holding on to the weed. Counted!', 'A nudibranch, frilly and orange. Counted!'];
/** where the route arrow points: the next pool, or the next marker */
export function tideTarget(run: Run): [number, number] | null | undefined {
  const st = run.cur, c = ST.get(run); if (!st || st.t !== 'tide' || !c) return undefined;
  const pools = st.pools ?? [];
  if (c.pools < pools.length) return run.spot(pools[c.pools]);
  return st.route.length ? run.spot(st.route[Math.min(c.k, st.route.length - 1)]) : null;
}
