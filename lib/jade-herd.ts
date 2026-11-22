// Jade Street, the twenty-fifth pass's new job step: `herd`, driving one of Coney Island's free-roaming Brahman cattle
// home along a trail, gate to gate. You never touch her: she walks AWAY from you, so you move her by where you stand.
// Behind her (within HERD.cone of straight behind) and at a comfortable distance, she ambles on along the trail; at her
// side she stops and looks at you; in front of her she backs away down the trail (never past the last gate she went
// through); too far off and she puts her head down and grazes. Come too close and her CALM (the HUD meter) drains: let it
// run out and she spins and bolts back to the last gate, and you must settle her again (time lost, never the job). Away
// from her it fills again. The HUD says at every moment which of these she is doing and what to do about it. `trail`:
// the cow's start, then each gate in turn (the last is home); `calf`: a skittish calf (it walks a little quicker and
// minds you more); `time`: the dusk left. Assist (on by default) gives a wider comfortable band and a slower drain; Hard
// a narrower one and a faster drain. Only the hero you control counts: the partner keeps back and waits where they stand
// (a second herder in her face would only spook her). Its own hero poses: arms wide walking her on (two frames), still
// and crouched with palms out while she settles, thrown back as she bolts. No DOM; deterministic.
import { dist } from './jade-rng.js';
import type { Run } from './jade-mission.js';
import type { Step } from './jade-story.js';

type Herd = Extract<Step, { t: 'herd' }>;
/** what the cow is doing: walking on, stopped and looking at you, backing off down the trail, grazing, bolting */
export type CowMode = 'walk' | 'look' | 'back' | 'graze' | 'bolt';
export type HerdState = { s: number; gate: number; k: number; calm: number; bolts: number; mode: CowMode; boltT: number; t: number; x: number; y: number; hx: number; hy: number };
/** the cow's walking speed and the calf's (world units a second), how fast she backs away and bolts; the comfortable
 * band (nearer than `near` drains her calm, farther than `far` and she grazes), the cone behind her that counts as
 * behind (cosine), the calm lost a second too close and got back a second away, the seconds a bolt costs; the
 * multipliers on the band and the drain with Assist and on Hard, and for a calf */
export const HERD = { walk: 62, calfWalk: 72, back: 24, bolt: 260, near: 92, far: 270, cone: 0.42, drain: 0.9, recover: 0.4, lose: 4,
  assist: { near: 0.8, far: 1.2, drain: 0.6 }, hard: { near: 1.12, far: 0.92, drain: 1.25 }, calf: { near: 1.1, drain: 1.2 } } as const;
const ST = new WeakMap<Run, HerdState>();
export const herdOf = (run: Run) => ST.get(run) ?? null;
/** on a herding job (the partner keeps back, and the herding poses show) */
export const herding = (run: Run | null) => !!run && run.cur?.t === 'herd' && ST.has(run);
/** the band and the drain for this run: [near, far, drain] */
export function bandOf(run: Run, st: Herd): [number, number, number] {
  const m = run.assist ? HERD.assist : run.w.s.settings.diff === 'hard' ? HERD.hard : { near: 1, far: 1, drain: 1 };
  const c = st.calf ? HERD.calf : { near: 1, drain: 1 };
  return [HERD.near * m.near * c.near, HERD.far * m.far, HERD.drain * m.drain * c.drain];
}
/** the trail in world units, and the length along it to each gate */
export function trailOf(run: Run, st: Herd): { pts: [number, number][]; len: number[] } {
  const pts = st.trail.map(s => run.spot(s)), len = [0];
  for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + dist(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]));
  return { pts, len };
}
/** the point `s` along the trail, and the way the trail runs there (a unit vector) */
export function along(pts: [number, number][], len: number[], s: number): { x: number; y: number; hx: number; hy: number } {
  let i = 1; while (i < pts.length - 1 && len[i] < s) i++;
  const [ax, ay] = pts[i - 1], [bx, by] = pts[i], seg = Math.max(1e-6, len[i] - len[i - 1]), f = Math.max(0, Math.min(1, (s - len[i - 1]) / seg));
  return { x: ax + (bx - ax) * f, y: ay + (by - ay) * f, hx: (bx - ax) / seg, hy: (by - ay) / seg };
}
/** where a hero stands against the cow: how far, and the cosine of the angle between her way and the line from the
 * hero to her (1: straight behind her; -1: straight in front) */
export function standing(c: HerdState, x: number, y: number): { d: number; cos: number } {
  const dx = c.x - x, dy = c.y - y, d = Math.hypot(dx, dy);
  return { d, cos: d < 1e-6 ? 1 : (dx * c.hx + dy * c.hy) / d };
}

export function herdEnter(run: Run, st: Step): boolean {
  if (st.t !== 'herd') return false;
  const { pts, len } = trailOf(run, st), a = along(pts, len, 0);
  ST.set(run, { s: 0, gate: 0, k: 0, calm: 1, bolts: 0, mode: 'graze', boltT: 0, t: 0, ...a });
  run.progress = progress(st, 0);
  if (st.time) run.timer = st.time * (run.assist ? 1.4 : 1) * run.w.diff.timer;
  run.meter = { name: 'Calm', v: 1 };
  run.w.say(st.calf ? 'A calf walks away from you, like its mother, only jumpier. Get behind it, not too close, and it trots home.' : 'She walks away from you: stand behind her, not too close, and she ambles on down the trail. Get in front and she backs off.', 'good');
  return true;
}
const progress = (st: Herd, k: number) => `Gates ${k}/${st.trail.length - 1}`;
export function herdStep(run: Run, st: Step, dt: number): boolean {
  if (st.t !== 'herd') return false;
  const c = ST.get(run); if (!c) return true;
  const w = run.w, p = w.p; c.t += dt;
  const { pts, len } = trailOf(run, st), total = len[len.length - 1];
  const [near, far, drain] = bandOf(run, st);
  const who = st.calf ? 'the calf' : 'her', She = st.calf ? 'The calf' : 'She';
  const put = () => { const a = along(pts, len, c.s); c.x = a.x; c.y = a.y; c.hx = a.hx; c.hy = a.hy; };
  // bolting: she runs back to the last gate she went through, then stands, settling
  if (c.mode === 'bolt') {
    c.boltT += dt;
    c.s = Math.max(len[c.gate], c.s - HERD.bolt * dt); put();
    if (c.s <= len[c.gate] && c.boltT > 1) { c.mode = 'look'; c.calm = 1; }
    run.meter = { name: 'Calm', v: 0, bad: true };
    run.label = `${She} bolted back to the last gate! Let ${who} settle, then get behind ${who} again`;
    return true;
  }
  if (p.ride) { c.mode = 'graze'; run.label = `Hop off (E): ${st.calf ? 'a calf is' : 'cattle are'} herded on foot`; return true; }
  const { d, cos } = standing(c, p.x, p.y);
  const behind = cos > HERD.cone, front = cos < -HERD.cone;
  if (d < near) {
    // too close: she minds you, and her calm drains
    c.mode = 'look'; c.calm -= drain * dt;
    if (c.calm <= 0) {
      c.mode = 'bolt'; c.boltT = 0; c.bolts++; run.hits++;
      if (run.timer !== null) run.timer = Math.max(0.5, run.timer - HERD.lose);
      p.b.speed = 0;
      p.act = { n: 'herd-bolt', t: 0, dur: 0.8 };
      w.fx.push({ t: 'spill', x: c.x, y: c.y });
      run.meter = { name: 'Calm', v: 0, bad: true };
      run.label = `${She} bolted back to the last gate! Let ${who} settle, then get behind ${who} again`;
      w.say(c.bolts === 1 ? `Too close! ${She} spun round and bolted back to the last gate. Keep the gap: when the HUD says too close, step back.` : `${She} bolted back to the last gate, -${HERD.lose} s`, 'bad');
      return true;
    }
  } else {
    c.calm = Math.min(1, c.calm + HERD.recover * dt);
    if (d > far) c.mode = 'graze';
    else if (behind) {
      c.mode = 'walk';
      c.s = Math.min(total, c.s + (st.calf ? HERD.calfWalk : HERD.walk) * (st.pace ?? 1) * dt);
    } else if (front) { c.mode = 'back'; c.s = Math.max(len[c.gate], c.s - HERD.back * dt); }
    else c.mode = 'look';
  }
  put();
  // through a gate: it holds (she never backs past it), and the last one is home
  while (c.gate < len.length - 1 && c.s >= len[c.gate + 1] - 0.5) {
    c.gate++; c.k = c.gate; run.progress = progress(st, c.k);
    w.fx.push({ t: 'checkpoint' });
  }
  if (c.s >= total - 0.5) { finish(run, st, c); return true; }
  run.meter = { name: 'Calm', v: Math.max(0, c.calm), bad: c.calm < 0.5 };
  // the words: what she is doing, and what to do about it
  if (d < near) run.label = `Too close! ${She}’s getting jumpy: step back a little`;
  else if (c.mode === 'graze') run.label = `${She}’s grazing: walk up behind ${who} (the way the trail runs)`;
  else if (c.mode === 'walk') run.label = `${She}’s walking on: stay behind ${who}, not too close (gate ${c.k + 1} of ${st.trail.length - 1})`;
  else if (c.mode === 'back') run.label = `You’re in front of ${who}: ${she(st)} backs away. Circle round behind ${who}`;
  else run.label = `${She}’s watching you: move round behind ${who}`;
  return true;
}
const she = (st: Herd) => (st.calf ? 'it' : 'she');
function finish(run: Run, st: Herd, c: HerdState) {
  const w = run.w; w.s.stats.herds++;
  w.say(c.bolts === 0 ? `${st.calf ? 'The calf' : 'She'}’s home, and never once bolted. A born cowhand!` : `${st.calf ? 'The calf' : 'She'}’s home through the gate!`, 'good');
  run.next();
}
/** where the route arrow points: the cow herself (stand behind her), or the next gate once she walks on */
export function herdTarget(run: Run): [number, number] | null | undefined {
  const st = run.cur, c = ST.get(run); if (!st || st.t !== 'herd' || !c) return undefined;
  return [c.x, c.y];
}
/** the next gate (world: the drawn marker) */
export function nextGate(run: Run): [number, number] | null {
  const st = run.cur, c = ST.get(run); if (!st || st.t !== 'herd' || !c) return null;
  return run.spot(st.trail[Math.min(st.trail.length - 1, c.gate + 1)]);
}
/** where a herder stands to walk her on: behind her along the trail, in the middle of the comfortable band (the bots
 * and the tests use it) */
export function herdSpot(run: Run): [number, number] | null {
  const st = run.cur, c = ST.get(run); if (!st || st.t !== 'herd' || !c) return null;
  const [near, far] = bandOf(run, st), r = (near + far) / 2;
  return [c.x - c.hx * r, c.y - c.hy * r];
}
