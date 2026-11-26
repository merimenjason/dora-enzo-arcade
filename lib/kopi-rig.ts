// Kopi Peng Brawl: the heroes' cut-out rig and their animations. Codex painted each hero once as separate parts
// (`lib/kopi-art.ts` says where each sits in its atlas); here the parts are posed by joint angles 60 times a second.
// Angles are radians: 0 points forward, π/2 straight down. Arms and the head are given in the torso's upright frame
// (the lean is added); legs are absolute. Transforms are solved first, then drawn back to front so an upper limb
// always covers its lower limb's rounded joint cap, and the lower sole is grounded automatically.
import { KOPI_ATLAS } from './kopi-art';

export type Pt = [number, number];
interface PartDef { pivot: Pt; tip?: Pt; scale?: number }
interface TorsoDef extends PartDef { tip: Pt; sh: Pt; shF: Pt; tail: Pt; bow?: Pt; hipF?: Pt }
export interface RigDef { torso: TorsoDef; [k: string]: PartDef }

// joint points in source-sheet pixels: pivot = where the part hangs from its parent, tip = where its child attaches
export const RIGS: Record<'dora' | 'enzo', RigDef> = {
  dora: {
    head: { pivot: [235, 405] },
    torso: { pivot: [150, 330], tip: [175, 25], sh: [150, 60], shF: [190, 55], tail: [55, 330], bow: [40, 250], hipF: [165, 320] },
    ua: { pivot: [74, 50], tip: [62, 180] }, uaF: { pivot: [72, 50], tip: [60, 180] },
    fa: { pivot: [45, 100], tip: [165, 60] }, faF: { pivot: [45, 100], tip: [165, 60] },
    th: { pivot: [92, 55], tip: [82, 185] }, thF: { pivot: [82, 55], tip: [74, 185] },
    sh: { pivot: [80, 25], tip: [95, 205] }, shF: { pivot: [75, 25], tip: [95, 205] },
    tail: { pivot: [300, 400], scale: 0.85 }, bow: { pivot: [150, 70], scale: 0.5 },
  },
  enzo: {
    head: { pivot: [270, 390] },
    torso: { pivot: [160, 300], tip: [165, 25], sh: [70, 125], shF: [150, 95], tail: [40, 285], hipF: [175, 290] },
    ua: { pivot: [93, 55], tip: [78, 185] }, uaF: { pivot: [91, 55], tip: [78, 185] },
    fa: { pivot: [62, 75], tip: [205, 120], scale: 0.85 }, faF: { pivot: [62, 75], tip: [195, 120], scale: 0.85 },
    th: { pivot: [100, 55], tip: [90, 205] }, thF: { pivot: [98, 55], tip: [90, 205] },
    sh: { pivot: [98, 55], tip: [110, 255] }, shF: { pivot: [88, 55], tip: [105, 255] },
    tail: { pivot: [235, 330] },
  },
};
/** world px per source px, so both heroes stand about 230 px tall */
export const HERO_S: Record<'dora' | 'enzo', number> = { dora: 0.34, enzo: 0.33 };

export interface Pose { lean: number; head: number; ua: number; fa: number; uaF: number; faF: number; th: number; sh: number; thF: number; shF: number; tail: number; air: number; sx: number; sy: number; smear?: boolean }
type K = Exclude<keyof Pose, 'smear'>;
export const BASE: Pose = { lean: 0.12, head: -0.05, ua: 1.2, fa: -0.9, uaF: 1.0, faF: -1.0, th: 1.35, sh: 1.65, thF: 1.85, shF: 1.6, tail: 0, air: 0, sx: 1, sy: 1 };
const KEYS = Object.keys(BASE) as K[];
const P = (o: Partial<Pose>): Pose => ({ ...BASE, ...o });
const ease = (u: number) => u * u * (3 - 2 * u);
export function mix(a: Pose, b: Pose, u: number): Pose { const o = { ...a }; for (const k of KEYS) o[k] = a[k] + (b[k] - a[k]) * u; return o; }

type Key = [number, Partial<Pose>, ('e' | 'o' | 'l')?, (1 | 0)?];
interface Act { dur: number; keys: Key[] }
const LIE: Partial<Pose> = { lean: -1.5, head: -0.1, ua: 3.4, fa: 3.2, uaF: 3.5, faF: 3.3, th: 0.38, sh: 0.55, thF: 0.52, shF: 0.72, tail: 0.9 };
const ACTS: Record<string, Act> = {
  jab: { dur: 0.26, keys: [[0, {}], [0.05, { lean: 0.05, ua: 1.4, fa: -1.4, th: 1.3 }, 'e'], [0.09, { lean: 0.32, ua: 0.05, fa: 0.0, th: 1.1, sh: 1.6, thF: 2.0 }, 'o', 1], [0.17, { lean: 0.3, ua: 0.08, fa: 0.0, th: 1.1, thF: 2.0 }], [0.26, {}, 'e']] },
  jab2: { dur: 0.28, keys: [[0, {}], [0.05, { lean: 0.0, uaF: 1.5, faF: -1.2 }, 'e'], [0.10, { lean: 0.38, uaF: 0.0, faF: -0.05, ua: 1.6, fa: -1.6, th: 1.05, thF: 2.05 }, 'o', 1], [0.19, { lean: 0.36, uaF: 0.05, faF: 0, ua: 1.6, fa: -1.6, th: 1.05, thF: 2.05 }], [0.28, {}, 'e']] },
  kick: { dur: 0.46, keys: [[0, {}], [0.09, { lean: -0.25, th: 1.9, sh: 2.6, thF: 1.6, shF: 1.55, ua: 1.7, fa: -0.6, uaF: 0.6, faF: -1.3 }, 'e'], [0.15, { lean: -0.45, th: 0.05, sh: 0.0, thF: 1.62, shF: 1.6, ua: 2.2, fa: 1.2, uaF: 0.4, faF: -1.2, tail: 0.5 }, 'o', 1], [0.30, { lean: -0.42, th: 0.1, sh: 0.05, thF: 1.62, shF: 1.6, ua: 2.2, fa: 1.2, uaF: 0.4, faF: -1.2, tail: 0.5 }], [0.46, {}, 'e']] },
  belly: { dur: 0.52, keys: [[0, {}], [0.14, { lean: -0.45, ua: 2.4, fa: 1.6, uaF: 2.5, faF: 1.7, th: 1.7, sh: 1.9, thF: 1.3, shF: 1.5, sx: 0.95, sy: 1.04 }, 'e'], [0.2, { lean: 0.05, ua: 2.6, fa: 2.0, uaF: 2.6, faF: 2.1, th: 1.0, sh: 1.5, thF: 2.1, shF: 1.9, sx: 1.18, sy: 0.92 }, 'o', 1], [0.34, { lean: 0.02, ua: 2.5, fa: 1.9, uaF: 2.5, faF: 2.0, th: 1.05, sh: 1.5, thF: 2.05, shF: 1.85, sx: 1.12, sy: 0.95 }], [0.52, {}, 'e']] },
  swing: { dur: 0.5, keys: [[0, {}], [0.12, { lean: -0.2, ua: -1.3, fa: -1.7, uaF: -1.1, faF: -1.5, th: 1.5, thF: 1.75, tail: 0.3 }, 'e'], [0.2, { lean: 0.5, ua: 0.6, fa: 0.9, uaF: 0.8, faF: 1.1, th: 1.0, sh: 1.55, thF: 2.1, shF: 1.8, sx: 1.05, sy: 0.95 }, 'o', 1], [0.34, { lean: 0.45, ua: 0.7, fa: 1.0, uaF: 0.9, faF: 1.2, th: 1.0, thF: 2.1, shF: 1.8 }], [0.5, {}, 'e']] },
  poke: { dur: 0.3, keys: [[0, {}], [0.07, { lean: -0.05, ua: 1.6, fa: -1.0, uaF: 1.5, faF: -1.0 }, 'e'], [0.11, { lean: 0.35, ua: 0.1, fa: 0.0, uaF: 0.3, faF: 0.0, th: 1.05, thF: 2.05 }, 'o', 1], [0.2, { lean: 0.32, ua: 0.12, fa: 0.0, uaF: 0.3, faF: 0.0, th: 1.05, thF: 2.05 }], [0.3, {}, 'e']] },
  slam: { dur: 0.95, keys: [[0, {}], [0.35, { lean: -0.3, ua: -1.5, fa: -1.6, uaF: -1.4, faF: -1.5, th: 1.6, sh: 1.6, thF: 1.6, shF: 1.6, sy: 1.06, sx: 0.96, air: 20 }, 'e'], [0.48, { lean: -0.35, ua: -1.7, fa: -1.9, uaF: -1.6, faF: -1.8, air: 60, th: 1.2, sh: 2.2, thF: 1.4, shF: 2.4 }, 'o'], [0.54, { lean: 0.65, ua: 0.9, fa: 1.1, uaF: 1.0, faF: 1.2, th: 1.0, sh: 1.9, thF: 2.2, shF: 1.6, sy: 0.88, sx: 1.1, air: 0 }, 'l', 1], [0.8, { lean: 0.6, ua: 0.95, fa: 1.15, uaF: 1.0, faF: 1.2, th: 1.0, sh: 1.9, thF: 2.2, shF: 1.6 }], [0.95, {}, 'e']] },
  cyclone: { dur: 0.9, keys: [[0, {}], [0.1, { lean: 0.0, ua: 0.0, fa: 0.0, uaF: -0.2, faF: 0.0, th: 1.6, sh: 1.6, thF: 1.2, shF: 2.2, tail: 0.8, air: 14 }, 'o'], [0.8, { lean: 0.0, ua: 0.05, fa: 0.0, uaF: -0.15, faF: 0.0, th: 1.6, sh: 1.6, thF: 1.25, shF: 2.2, tail: -0.8, air: 14 }, 'l'], [0.9, {}, 'e']] },
  team: { dur: 1.3, keys: [[0, {}], [0.3, { lean: 0.3, ua: 2.2, fa: 1.0, uaF: 2.3, faF: 1.1, th: 0.9, sh: 2.4, thF: 1.1, shF: 2.5, sy: 0.9, sx: 1.06 }, 'e'], [0.55, { lean: -0.1, ua: -1.5, fa: -1.5, uaF: -1.4, faF: -1.4, th: 1.3, sh: 2.2, thF: 1.5, shF: 2.4, air: 160, sy: 1.08, sx: 0.95, tail: 0.6 }, 'o'], [0.8, { lean: -0.2, ua: -1.6, fa: -1.6, uaF: -1.5, faF: -1.5, th: 1.2, sh: 2.3, thF: 1.4, shF: 2.5, air: 170 }, 'e'], [0.88, { lean: 0.6, ua: 1.0, fa: 1.2, uaF: 1.0, faF: 1.2, th: 1.0, sh: 2.0, thF: 2.1, shF: 1.6, air: 0, sy: 0.88, sx: 1.1 }, 'l', 1], [1.15, { lean: 0.5, ua: 1.0, fa: 1.2, uaF: 1.0, faF: 1.2, th: 1.0, sh: 2.0, thF: 2.1, shF: 1.6 }], [1.3, {}, 'e']] },
  hurt: { dur: 0.36, keys: [[0, {}], [0.04, { lean: -0.5, head: -0.35, ua: 2.5, fa: 2.1, uaF: 2.7, faF: 2.3, th: 1.65, sh: 1.85, thF: 1.95, shF: 1.6, tail: 0.5, sx: 1.06, sy: 0.94 }, 'o'], [0.20, { lean: -0.38, head: -0.25, ua: 2.3, fa: 1.8, uaF: 2.5, faF: 2.0, th: 1.6, sh: 1.8, thF: 1.9, shF: 1.6, tail: 0.4 }], [0.36, {}, 'e']] },
  down: { dur: 0.4, keys: [[0, {}], [0.06, { lean: -0.7, head: -0.4, ua: 2.8, fa: 2.6, uaF: 3.0, faF: 2.8, th: 1.1, sh: 1.2, thF: 1.3, shF: 1.4, air: 40, tail: 0.6 }, 'o'], [0.28, { ...LIE, lean: -1.45, head: -0.2, air: 0 }, 'e'], [0.34, { ...LIE, air: 6 }, 'o'], [0.4, LIE, 'e']] },
  getup: { dur: 0.45, keys: [[0, LIE], [0.22, { lean: 0.6, head: 0.2, ua: 2.0, fa: 1.0, uaF: 1.6, faF: 0.6, th: 0.3, sh: 2.4, thF: 1.2, shF: 2.6, tail: 0.3 }, 'e'], [0.45, {}, 'e']] },
  pick: { dur: 0.22, keys: [[0, {}], [0.1, { lean: 0.95, head: 0.3, ua: 1.5, fa: 0.3, uaF: 1.4, faF: 0.2, th: 0.85, sh: 2.3, thF: 1.6, shF: 2.4 }, 'e'], [0.22, {}, 'e']] },
  throw: { dur: 0.32, keys: [[0, {}], [0.1, { lean: -0.35, ua: -2.2, fa: -2.6, uaF: 0.8, faF: -0.4, th: 1.7, thF: 1.3, tail: 0.4 }, 'e'], [0.16, { lean: 0.45, ua: 0.1, fa: 0.1, uaF: 2.0, faF: 1.0, th: 1.0, thF: 2.1, shF: 1.8 }, 'o', 1], [0.32, {}, 'e']] },
  eat: { dur: 0.5, keys: [[0, {}], [0.1, { lean: 0.02, head: 0.15, ua: 1.7, fa: -2.5, uaF: 1.6, faF: -2.4 }, 'e'], [0.2, { lean: 0.0, head: 0.0, ua: 1.7, fa: -2.6, uaF: 1.6, faF: -2.5, sy: 1.03 }, 'e'], [0.3, { lean: 0.02, head: 0.18, ua: 1.7, fa: -2.5, uaF: 1.6, faF: -2.4 }, 'e'], [0.5, {}, 'e']] },
  airkick: { dur: 0.12, keys: [[0, { th: 1.0, sh: 2.0, thF: 1.6, shF: 2.5 }], [0.08, { lean: -0.35, ua: 2.6, fa: 1.6, uaF: 0.2, faF: -0.8, th: 0.15, sh: 0.1, thF: 2.4, shF: 3.3, tail: 0.6 }, 'o', 1], [0.12, { lean: -0.35, ua: 2.6, fa: 1.6, uaF: 0.2, faF: -0.8, th: 0.15, sh: 0.1, thF: 2.4, shF: 3.3, tail: 0.6 }]] },
  airslam: { dur: 0.14, keys: [[0, { th: 1.0, sh: 2.0, thF: 1.6, shF: 2.5 }], [0.1, { lean: 0.5, head: 0.2, ua: -1.4, fa: -1.6, uaF: -1.3, faF: -1.5, th: 0.5, sh: 2.6, thF: 0.7, shF: 2.8, sx: 1.08, sy: 0.92 }, 'o', 1], [0.14, { lean: 0.5, head: 0.2, ua: -1.4, fa: -1.6, uaF: -1.3, faF: -1.5, th: 0.5, sh: 2.6, thF: 0.7, shF: 2.8, sx: 1.08, sy: 0.92 }]] },
  dashkick: { dur: 0.42, keys: [[0, {}], [0.05, { lean: -0.55, ua: 2.5, fa: 1.5, uaF: 0.3, faF: -1.0, th: 0.1, sh: 0.05, thF: 2.2, shF: 3.0, tail: 0.7, air: 34 }, 'o', 1], [0.3, { lean: -0.5, ua: 2.5, fa: 1.5, uaF: 0.3, faF: -1.0, th: 0.12, sh: 0.06, thF: 2.2, shF: 3.0, tail: 0.7, air: 20 }], [0.42, {}, 'e']] },
  dashbump: { dur: 0.46, keys: [[0, {}], [0.05, { lean: 0.6, head: 0.3, ua: 1.9, fa: -2.2, uaF: 1.8, faF: -2.1, th: 0.9, sh: 1.5, thF: 2.2, shF: 2.0, sx: 1.06 }, 'o', 1], [0.32, { lean: 0.55, head: 0.3, ua: 1.9, fa: -2.2, uaF: 1.8, faF: -2.1, th: 1.0, sh: 1.5, thF: 2.15, shF: 2.0 }], [0.46, {}, 'e']] },
};
const HOLD_HEAVY: Partial<Pose> = { ua: 0.85, fa: -0.55, uaF: 0.95, faF: -0.5 };
const CARRY: Partial<Pose> = { ua: -1.35, fa: -1.6, uaF: -1.25, faF: -1.5, lean: 0.02, head: -0.15 };

export function cycle(name: string, t: number): Pose {
  if (name === 'idle') { const b = Math.sin(t * 2 * Math.PI / 1.4); return P({ lean: 0.12 + b * 0.02, head: -0.05 - b * 0.03, ua: 1.2 + b * 0.04, fa: -0.9 + b * 0.05, uaF: 1.0 - b * 0.03, faF: -1.0, tail: b * 0.06, sy: 1 + b * 0.012, sx: 1 - b * 0.008 }); }
  if (name === 'stun') { const s = Math.sin(t * 7); return P({ lean: -0.05 + s * 0.12, head: 0.3 + s * 0.25, ua: 1.9 + s * 0.2, fa: 1.0, uaF: 1.8 - s * 0.2, faF: 1.0, th: 1.45 + s * 0.08, thF: 1.7 - s * 0.08, sh: 1.6, shF: 1.6, tail: s * 0.3 }); }
  if (name === 'wrapped') { const s = Math.sin(t * 16); return P({ lean: 0.05 + s * 0.06, head: -0.2 + s * 0.12, ua: 1.65, fa: -2.5, uaF: 1.6, faF: -2.5, th: 1.5 + s * 0.06, sh: 1.6, thF: 1.65 - s * 0.06, shF: 1.6, sx: 0.92, sy: 1.02 }); }
  if (name === 'cheer') { const s = Math.abs(Math.sin(t * 5)); return P({ lean: -0.05, head: -0.25, ua: -1.3 - s * 0.3, fa: -1.6, uaF: -1.0 - s * 0.4, faF: -1.4, th: 1.5, sh: 1.6, thF: 1.7, shF: 1.6, air: s * 26, tail: 0.4 * s }); }
  if (name === 'jump') return P({ lean: 0.05, head: -0.1, ua: -0.5, fa: -1.2, uaF: 2.3, faF: 1.3, th: 1.0, sh: 2.1, thF: 1.55, shF: 2.6, tail: 0.6 });
  if (name === 'fall') return P({ lean: 0.1, head: 0.05, ua: 0.4, fa: -0.4, uaF: 2.6, faF: 2.0, th: 1.3, sh: 1.8, thF: 1.9, shF: 2.2, tail: -0.3 });
  const run = name === 'run', T = run ? 0.42 : 0.62, ph = (t / T) * 2 * Math.PI, s = Math.sin(ph), c = Math.cos(ph);
  const sw = run ? 0.85 : 0.5;
  const leg = (s: number, c: number): [number, number] => [1.57 + sw * s, 1.57 + sw * s + Math.max(0, -c) * (run ? 1.3 : 0.75)];
  const [th, sh] = leg(s, c), [thF, shF] = leg(-s, -c);
  return P({ lean: (run ? 0.32 : 0.16) + Math.abs(c) * 0.02, head: -0.08, th, sh, thF, shF,
    ua: 1.4 - sw * 0.9 * s, fa: run ? -0.6 : -0.1 - 0.4 * s, uaF: 1.4 + sw * 0.9 * s, faF: run ? -0.7 : -0.2 + 0.4 * s,
    tail: 0.1 + 0.1 * Math.sin(ph * 2), air: (run ? 10 : 4) * Math.abs(Math.sin(ph)) });
}
/** a key-framed action at time t; `dur` stretches the keys to fit the move's length in the engine */
export function act(name: string, t: number, dur?: number): Pose {
  const A = ACTS[name]; if (!A) return cycle('idle', t);
  if (dur && dur < 5) t = t * A.dur / dur;
  t = Math.max(0, Math.min(t, A.dur));
  const k = A.keys; let i = 0; while (i < k.length - 2 && t >= k[i + 1][0]) i++;
  const [t0, a] = k[i], [t1, b, e] = k[i + 1];
  let u = t1 > t0 ? Math.min(1, (t - t0) / (t1 - t0)) : 1;
  u = e === 'o' ? 1 - (1 - u) * (1 - u) * (1 - u) : e === 'l' ? u : ease(u);
  const o = mix(P(a), P(b), u); o.smear = !!k[i][3] && u < 1; return o;
}
const CYCLES = new Set(['idle', 'walk', 'run', 'stun', 'wrapped', 'cheer', 'jump', 'fall']);
/** the pose for a hero's animation name; `ct` is a free-running clock for cycles, `at` the time into an action */
export function heroPose(anim: string, ct: number, at: number, dur?: number): Pose {
  if (anim === 'carry' || anim === 'walkhold' || anim === 'idlehold') {
    const moving = anim !== 'idlehold';
    const base = cycle(moving ? 'walk' : 'idle', ct);
    return { ...base, ...(anim === 'carry' ? CARRY : HOLD_HEAVY) };
  }
  if (CYCLES.has(anim)) return cycle(anim, ct);
  return act(anim, at, dur);
}

// ─────────────────────────────────────────────────────────────── solve and draw
const rot = ([x, y]: Pt, a: number): Pt => { const c = Math.cos(a), s = Math.sin(a); return [x * c - y * s, x * s + y * c]; };
const restAng = (p: PartDef) => p.tip ? Math.atan2(p.tip[1] - p.pivot[1], p.tip[0] - p.pivot[0]) : 0;
export interface Solved { parts: Record<string, { at: Pt; r: number }>; hand: Pt | null; handF: Pt | null; faR: number; head: Pt }
export function solveRig(def: RigDef, p: Pose, S: number): Solved {
  const out: Record<string, { at: Pt; r: number }> = {};
  const T = def.torso, tr = -Math.PI / 2 + p.lean - restAng(T);
  const local = (pt: Pt): Pt => rot([pt[0] - T.pivot[0], pt[1] - T.pivot[1]], tr);
  out.torso = { at: [0, 0], r: tr };
  const tipOf = (k: string): Pt | null => { const d = def[k], x = out[k]; if (!d?.tip || !x) return null; const sc = d.scale ?? 1; const v = rot([(d.tip[0] - d.pivot[0]) * sc, (d.tip[1] - d.pivot[1]) * sc], x.r); return [x.at[0] + v[0], x.at[1] + v[1]]; };
  const put = (k: string, at: Pt | null, ang: number) => { const d = def[k]; if (!d || !at) return null; out[k] = { at, r: d.tip ? ang - restAng(d) : ang }; return tipOf(k); };
  const L = p.lean;
  put('faF', put('uaF', local(T.shF), p.uaF + L), p.faF + L);
  put('fa', put('ua', local(T.sh), p.ua + L), p.fa + L);
  put('shF', put('thF', local(T.hipF ?? T.pivot), p.thF), p.shF);
  put('sh', put('th', local(T.pivot), p.th), p.sh);
  put('head', local(T.tip), p.head + L);
  if (def.tail) put('tail', local(T.tail), p.tail + L);
  if (def.bow && T.bow) put('bow', local(T.bow), p.tail * 0.3 + L);
  const sole = (k: string) => tipOf(k)?.[1] ?? -1e9;
  const dy = -Math.max(sole('sh'), sole('shF')) - p.air / S;
  for (const k in out) out[k] = { at: [out[k].at[0], out[k].at[1] + dy], r: out[k].r };
  const hand = tipOf('fa'), handF = tipOf('faF'), hd = out.head.at;
  return { parts: out, hand, handF, faR: out.fa?.r ?? 0, head: [hd[0], hd[1]] };
}
const ORDER = ['faF', 'uaF', 'shF', 'thF', 'tail', 'torso', 'bow', 'sh', 'th', 'head', 'fa', 'ua'];
export type ImgGet = (atlas: string) => CanvasImageSource | null;
/**
 * Draw a hero at screen (x, y) (the feet), facing `face`. `extra` runs right after the near forearm is drawn, in rig
 * space, for a held item. Returns the near hand's screen point and the forearm's screen angle.
 */
export function drawHero(ctx: CanvasRenderingContext2D, img: ImgGet, who: 'dora' | 'enzo', p: Pose, x: number, y: number, face: number, k = 1,
  extra?: (ctx: CanvasRenderingContext2D, hand: Pt, ang: number) => void): { hand: Pt; ang: number } {
  const def = RIGS[who], S = HERO_S[who] * k, A = KOPI_ATLAS[who], im = img(who);
  const X = solveRig(def, p, S);
  ctx.save(); ctx.translate(x, y); ctx.scale(face * S * p.sx, S * p.sy);
  if (A && im) for (const key of ORDER) {
    const x0 = X.parts[key], d = def[key], r = A.parts[key]; if (!x0 || !d || !r) continue;
    const sc = d.scale ?? 1, inv = 1 / A.scale;
    ctx.save(); ctx.translate(x0.at[0], x0.at[1]); ctx.rotate(x0.r); ctx.scale(sc, sc);
    ctx.drawImage(im, r[0], r[1], r[2], r[3], -d.pivot[0], -d.pivot[1], r[2] * inv, r[3] * inv);
    ctx.restore();
    if (key === 'fa' && extra && X.hand) extra(ctx, X.hand, X.faR + (def.fa.tip ? restAng(def.fa) : 0));
  }
  ctx.restore();
  const h = X.hand ?? [0, 0];
  return { hand: [x + face * S * p.sx * h[0], y + S * p.sy * h[1]], ang: X.faR };
}
