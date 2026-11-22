// Jade Street, the twenty-fourth pass's new job step: `mud`, a crossing of Sungei Buloh's mudflats on foot, past the
// estuarine crocodiles basking on them. The crocodiles keep a rhythm you can read on the HUD: DOZING (eyes shut: cross),
// STIRRING (an eye opens: a couple of seconds' warning to stop) and WATCHING (head up: don't move). Anyone moving within
// sight of a watching crocodile sets it lunging: you scramble back to the last marker (a few seconds lost, never the
// job). Standing still is always safe, and so is being out of its sight (farther than MUD.sight). Soft mud slows you
// (MUD.wade, and no dash); the firm patches and the boardwalk don't. `birds`: whimbrel flocks to count on the way (E at
// each, in order, through binoculars). `doze`: the dozing spell's length against the usual (a crossing at dawn, when
// they are waking, is shorter). Assist (on by default) gives longer dozes and shorter watches; Hard the other way. Only
// the hero you control counts: the partner stops dead whenever a crocodile watches. Its own hero poses: wading the mud
// (two frames), frozen stock-still, scrambling back. No DOM; deterministic.
import { dist } from './jade-rng.js';
import { T, W, G } from './jade-city.js';
import type { Run } from './jade-mission.js';
import type { Step } from './jade-story.js';
import type { Near } from './jade-game.js';

type Mud = Extract<Step, { t: 'mud' }>;
export type CrocPhase = 'doze' | 'stir' | 'watch';
export type MudState = { k: number; birds: number; back: [number, number]; t: number; snaps: number; grace: number; snap: { at: [number, number]; t: number } | null; moveT: number; seenT: number };
/** the crocodiles' rhythm (seconds dozing, stirring, watching) on Normal, Assist and Hard; how far a watching crocodile
 * sees, how near a marker or a flock counts, the speed that counts as moving, how long you have to stop once it
 * watches, the seconds a lunge costs and the wading speed in soft mud */
export const MUD = { doze: 6, stir: 2.2, watch: 3, dozeAssist: 8, stirAssist: 2.8, watchAssist: 2.5, dozeHard: 5, stirHard: 1.7, watchHard: 3.5,
  sight: 300, reach: 64, bird: 80, still: 30, stop: 0.45, lose: 4, wade: 84 } as const;
const ST = new WeakMap<Run, MudState>();
export const mudOf = (run: Run) => ST.get(run) ?? null;
/** the rhythm's three lengths for this run */
export function rhythmOf(run: Run, st: Mud): [number, number, number] {
  const hard = run.w.s.settings.diff === 'hard';
  const doze = run.assist ? MUD.dozeAssist : hard ? MUD.dozeHard : MUD.doze, stir = run.assist ? MUD.stirAssist : hard ? MUD.stirHard : MUD.stir;
  const watch = run.assist ? MUD.watchAssist : hard ? MUD.watchHard : MUD.watch;
  return [st.doze ? doze * st.doze : doze, stir, watch];
}
/** where the crocodiles are in their rhythm: the phase, the seconds until it changes, and how awake they are (0-1) */
export function crocPhase(run: Run, st: Mud, t: number): { ph: CrocPhase; left: number; v: number } {
  const [d, s, a] = rhythmOf(run, st), n = d + s + a, c = ((t % n) + n) % n;
  if (c < d) return { ph: 'doze', left: d - c, v: 0 };
  if (c < d + s) return { ph: 'stir', left: d + s - c, v: (c - d) / s };
  return { ph: 'watch', left: n - c, v: 1 };
}
/** the tile under a point is soft mud */
export const onMud = (run: Run, x: number, y: number) => run.w.c.ground[Math.floor(y / T) * W + Math.floor(x / T)] === G.MUDFLAT;
/** wading soft mud in a mud crossing (the hero's top speed drops to MUD.wade there) */
export const mudWading = (run: Run | null, x: number, y: number) => !!run && run.cur?.t === 'mud' && onMud(run, x, y);
/** the crocodiles of the step (world) */
export const crocsOf = (run: Run, st: Mud) => st.crocs.map(c => run.spot(c));
/** the nearest crocodile that can see a point (null: out of sight of all of them) */
export function inSight(run: Run, st: Mud, x: number, y: number): [number, number] | null {
  let best: [number, number] | null = null, bd: number = MUD.sight;
  for (const c of crocsOf(run, st)) { const d = dist(c[0], c[1], x, y); if (d < bd) { bd = d; best = c; } }
  return best;
}
/** is the step's crocodile rhythm on watch now (the partner keeps still) */
export function crocsWatching(run: Run | null): boolean {
  if (!run || run.cur?.t !== 'mud') return false;
  const c = ST.get(run); return !!c && crocPhase(run, run.cur, c.t).ph === 'watch';
}

export function mudEnter(run: Run, st: Step): boolean {
  if (st.t !== 'mud') return false;
  const p = run.w.p;
  ST.set(run, { k: 0, birds: 0, back: [p.x, p.y], t: 0, snaps: 0, grace: 1, snap: null, moveT: 0, seenT: 0 });
  run.progress = progress(st, 0, 0);
  if (st.time) run.timer = st.time * (run.assist ? 1.4 : 1) * run.w.diff.timer;
  run.meter = { name: 'Croc', v: 0 };
  run.w.say('The crocodiles are dozing: cross the mud now. When the HUD says one is stirring, stop. While it watches, don’t move a whisker.', 'good');
  return true;
}
const progress = (st: Mud, k: number, birds: number) => [st.birds?.length ? `Flocks ${birds}/${st.birds.length}` : '', st.route.length ? `Markers ${k}/${st.route.length}` : ''].filter(Boolean).join(' · ');
export function mudStep(run: Run, st: Step, dt: number): boolean {
  if (st.t !== 'mud') return false;
  const c = ST.get(run); if (!c) return true;
  const w = run.w, p = w.p; c.t += dt; c.grace = Math.max(0, c.grace - dt);
  if (c.snap) { c.snap.t += dt; if (c.snap.t > 1.2) c.snap = null; }
  if (p.ride) { run.label = 'Hop off (E): the mudflats are crossed on foot'; return true; }
  const { ph, left, v } = crocPhase(run, st, c.t), secs = Math.ceil(left);
  const seen = inSight(run, st, p.x, p.y);
  run.meter = { name: 'Croc', v: ph === 'watch' ? 1 : v, bad: ph !== 'doze' };
  // moving in sight of a watching crocodile: a moment to stop, then it lunges and you scramble back to the last marker
  // (the moment to stop runs from when it began to watch, or from when you came into its sight while it watched)
  c.seenT = ph === 'watch' && seen ? c.seenT + dt : 0;
  const moving = p.b.speed > MUD.still && !p.act;
  c.moveT = c.seenT > MUD.stop && moving && c.grace <= 0 ? c.moveT + dt : 0;
  if (c.moveT > 0.12) {
    c.moveT = 0; c.snaps++; run.hits++; c.snap = { at: seen!, t: 0 };
    p.b.speed = 0; p.face = 'down';
    p.act = { n: 'mud-scramble', t: 0, dur: 0.9, then: () => { w.placePlayer(c.back[0], c.back[1]); c.grace = 1.5; } };
    if (run.timer !== null) run.timer = Math.max(0.5, run.timer - MUD.lose);
    w.fx.push({ t: 'spill', x: p.x, y: p.y });
    w.say(c.snaps === 1 ? 'SNAP! The crocodile lunged and you scrambled back to the last marker. When the HUD says one is stirring, stop, and keep still till it dozes off.' : `SNAP! Back to the last marker, -${MUD.lose} s`, 'bad');
    return true;
  }
  // the flocks first (E at each), then the markers, one at a time
  const birds = st.birds ?? [];
  if (c.birds >= birds.length && c.k < st.route.length) {
    const [mx, my] = run.spot(st.route[c.k]);
    if (dist(mx, my, p.x, p.y) < MUD.reach) {
      c.k++; c.back = [mx, my]; run.progress = progress(st, c.k, c.birds);
      w.fx.push({ t: 'checkpoint' });
    }
  }
  if (c.birds >= birds.length && c.k >= st.route.length) { finish(run, c); return true; }
  // the words: what the crocodiles are doing, and what to do about it
  const where = c.birds < birds.length ? 'the next flock' : 'the next marker';
  if (p.act?.n === 'mud-scramble') run.label = 'Scrambling back through the mud…';
  else if (ph === 'doze') run.label = `Crocs dozing (${secs} s): ${onMud(run, p.x, p.y) || seen ? `go to ${where} now` : st.label}`;
  else if (ph === 'stir') run.label = `Croc stirring! ${secs} s: stop and stand still${seen ? '' : ' (out of its sight here)'}`;
  else run.label = seen ? `FREEZE! Croc watching (${secs} s): don’t move` : `Croc watching (${secs} s): you are out of its sight here, but don’t go nearer`;
  return true;
}
function finish(run: Run, c: MudState) {
  const w = run.w; w.s.stats.mudflats++;
  w.say(c.snaps === 0 ? 'Over the mudflats without a single snap. Muddy boots, all ten toes!' : 'Over the mudflats!', 'good');
  run.next();
}
/** E at the next whimbrel flock */
export function mudNear(run: Run, x: number, y: number): Near | null {
  const st = run.cur, c = ST.get(run), p = run.w.p; if (!st || st.t !== 'mud' || !c || p.ride || p.act) return null;
  const birds = st.birds ?? []; if (c.birds >= birds.length) return null;
  const [bx, by] = run.spot(birds[c.birds]);
  return dist(bx, by, x, y) < MUD.bird ? { kind: 'job', label: `Count the whimbrels (${c.birds + 1} of ${birds.length})`, x: bx, y: by, id: `flock:${c.birds}` } : null;
}
export function mudAct(run: Run, id: string): boolean {
  const st = run.cur, c = ST.get(run), w = run.w, p = w.p; if (!st || st.t !== 'mud' || !c || !id.startsWith('flock:')) return false;
  if (p.act) return true;
  const i = +id.split(':')[1]; if (i !== c.birds) return true;
  p.b.speed = 0; p.face = 'up';
  p.act = { n: 'lookout', t: 0, dur: 1.0, then: () => {
    if (c.birds !== i) return;
    c.birds++; c.back = run.spot(st.birds![i]); run.progress = progress(st, c.k, c.birds);
    w.fx.push({ t: 'checkpoint' });
    w.say(FLOCK_SAY[i % FLOCK_SAY.length], 'good');
  } };
  return true;
}
const FLOCK_SAY = ['Thirty-one whimbrels, bills in the mud. Counted!', 'Nineteen whimbrels and a sandpiper pretending to be one. Counted!', 'Forty-two whimbrels, all facing the wind. Counted!', 'Twelve whimbrels, and one with a ring on its leg! Counted!'];
/** where the route arrow points: the next flock, or the next marker */
export function mudTarget(run: Run): [number, number] | null | undefined {
  const st = run.cur, c = ST.get(run); if (!st || st.t !== 'mud' || !c) return undefined;
  const birds = st.birds ?? [];
  if (c.birds < birds.length) return run.spot(birds[c.birds]);
  return st.route.length ? run.spot(st.route[Math.min(c.k, st.route.length - 1)]) : null;
}
