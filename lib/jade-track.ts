// Jade Street, the seventeenth pass's new job step: `track`, following a boar trail on Pulau Ubin. Hoof prints run
// from where the trail starts to wherever the boar went; only the next set shows (a faint glint in the red earth), and
// reading it (E: crouch over the prints, its own animation) shows the one after and says which way the trail heads
// ("north-east, towards Pekan Quarry"). Assist (on by default) also rings the next set on the map and the route arrow;
// off Assist you go by the words alone. A `time` limit is the rain coming in to wash the prints away. Some trails have
// an `old` branch: a set of old, crusted prints just off the line that leads nowhere (reading it says so, and the trail
// goes on from the last fresh set). No DOM; deterministic.
import { dist } from './jade-rng.js';
import { T, districtAt } from './jade-city.js';
import type { Run } from './jade-mission.js';
import type { Step } from './jade-story.js';
import type { Near } from './jade-game.js';

type Track = Extract<Step, { t: 'track' }>;
/** how near a set of prints E reaches (world units), and how near you must be to see the next set off Assist */
export const READ_R = 80, SEE_R = 5 * T;
const COMPASS = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];
/** "north-east" from (x0, y0) to (x1, y1) */
export const heading = (x0: number, y0: number, x1: number, y1: number) => COMPASS[((Math.round(Math.atan2(y1 - y0, x1 - x0) / (Math.PI / 4)) % 8) + 8) % 8];
/** the named place on the island nearest a point (for "towards Pekan Quarry") */
function landmark(run: Run, x: number, y: number): string {
  let best = '', bd = 1e9;
  for (const pl of Object.values(run.w.c.places)) if (pl.kind === 'spot' && pl.name && districtAt(Math.floor(pl.x / T), Math.floor(pl.y / T)) === 'pulau') { const d = dist(pl.x, pl.y, x, y); if (d < bd) { bd = d; best = pl.name; } }
  return best;
}
/** the trail's words so far ("the trail heads north-east…"), per run */
const HINT = new WeakMap<Run, string>();
/** the prints still to read (the first is the one that shows) */
const next = (run: Run) => run.items.findIndex(it => !it.got && !it.marks);

export function trackEnter(run: Run, st: Step): boolean {
  if (st.t !== 'track') return false;
  run.items = st.route.map(s => { const [x, y] = run.spot(s); return { x, y, got: false, sprite: 'hoof-prints' }; });
  // the false branch: old prints (marks: ['old']) that never count
  for (const s of st.old ?? []) { const [x, y] = run.spot(s); run.items.push({ x, y, got: false, sprite: 'hoof-prints', marks: ['old'] }); }
  run.progress = `Prints 0/${st.route.length}`;
  if (st.time) run.timer = st.time * (run.assist ? 1.4 : 1) * run.w.diff.timer;
  return true;
}
export function trackStep(run: Run, st: Step): boolean {
  if (st.t !== 'track') return false;
  const w = run.w, p = w.p, k = next(run);
  if (k < 0) return true;
  const it = run.items[k], d = dist(it.x, it.y, p.x, p.y);
  run.label = d < READ_R ? 'E: read the hoof prints' : k === 0 ? st.label : HINT.get(run) ?? st.label;
  return true;
}
export function trackNear(run: Run, x: number, y: number): Near | null {
  const st = run.cur, p = run.w.p; if (!st || st.t !== 'track' || p.ride || p.act) return null;
  const k = next(run); if (k < 0) return null;
  const it = run.items[k];
  if (dist(it.x, it.y, x, y) < READ_R) return { kind: 'job', label: 'Read the hoof prints', x: it.x, y: it.y, id: `read:${k}` };
  // the old prints of a false branch read too (that is how you learn they are old)
  for (let i = 0; i < run.items.length; i++) { const o = run.items[i]; if (o.marks && !o.got && visible(run, i) && dist(o.x, o.y, x, y) < READ_R) return { kind: 'job', label: 'Read the hoof prints', x: o.x, y: o.y, id: `read:${i}` }; }
  return null;
}
export function trackAct(run: Run, id: string): boolean {
  const st = run.cur, w = run.w, p = w.p; if (!st || st.t !== 'track' || p.act) return false;
  const i = +id.split(':')[1], it = run.items[i]; if (!it || it.got) return true;
  p.b.speed = 0; p.face = 'down';
  p.act = { n: 'read', t: 0, dur: 1.1, then: () => {
    if (it.got) return; it.got = true;
    if (it.marks) { HINT.set(run, 'Old, crusted prints: a dead end. Go back to the last fresh set and look again'); w.say(HINT.get(run)!, 'bad'); return; }
    const k = next(run), n = st.route.length, got = run.items.slice(0, n).filter(f => f.got).length;
    run.progress = `Prints ${got}/${n}`;
    w.fx.push({ t: 'job-clue', x: it.x, y: it.y });
    if (k < 0) { w.s.stats.trails++; w.say('The trail ends here!', 'good'); HINT.delete(run); run.next(); return; }
    const to = run.items[k], dir = heading(it.x, it.y, to.x, to.y), lm = landmark(run, to.x, to.y);
    HINT.set(run, `Fresh prints! The trail heads ${dir}${lm ? `, towards ${lm}` : ''}`);
    w.say(HINT.get(run)!, 'good');
  } };
  return true;
}
/** is print i showing: the first, the one after the last read, an old set beside a read fresh set; off Assist only
 * when you are near it */
export function visible(run: Run, i: number): boolean {
  const it = run.items[i], p = run.w.p, st = run.cur;
  if (!st || st.t !== 'track') return false;
  if (it.got) return true;
  const n = st.route.length;
  const shown = it.marks ? run.items.slice(0, n).some((f, j) => f.got && j >= (st.oldAt ?? 0)) : i === 0 || run.items[i - 1].got;
  return shown && (run.assist || dist(it.x, it.y, p.x, p.y) < SEE_R);
}
/** where the route arrow points (Assist only: off it, the words lead) */
export function trackTarget(run: Run): [number, number] | null | undefined {
  const st = run.cur; if (!st || st.t !== 'track') return undefined;
  const k = next(run); if (k < 0 || !run.assist) return null;
  return [run.items[k].x, run.items[k].y];
}
