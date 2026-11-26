// Kopi Peng Brawl: every foe and boss as a paper puppet. Codex painted each creature once as separate parts on a
// sheet (`lib/kopi-art.ts` says where each sits in its atlas); here the parts are pinned at their joints and rotated,
// cut-out style. Joint points are fractions of a part's own size, so the atlas packing can move freely. Drawing is
// deterministic (posed from `t` only) and touches nothing but the context it is given.
import { KOPI_ATLAS } from './kopi-art';

export type FoeAnim = string;
export interface FoeView {
  kind: 'rat' | 'macaque' | 'mynah' | 'monitor' | 'roach' | 'python' | 'toad' | 'boar' | 'tank' | 'ssst' | 'tusker' | 'ong' | 'king';
  anim: string; t: number; face: 1 | -1; flash: number; dead: boolean; hold?: string | null;
}
type Kind = FoeView['kind'];
type Img = HTMLImageElement | ImageBitmap | null;
type Pt = [number, number];

/** drawn height in world px at S = 1 (top of the head / back above the feet) */
export const FOE_HEIGHT: Record<Kind, number> = {
  rat: 60, macaque: 190, mynah: 70, monitor: 95, roach: 40, python: 90, toad: 90, boar: 120,
  tank: 170, ssst: 260, tusker: 200, ong: 220, king: 300,
};

// ─────────────────────────────────────────────────────────────── maths
const PI = Math.PI, TAU = PI * 2;
const cl = (u: number) => u < 0 ? 0 : u > 1 ? 1 : u;
const ease = (u: number) => { u = cl(u); return u * u * (3 - 2 * u); };
const out3 = (u: number) => { u = cl(u); return 1 - (1 - u) ** 3; };
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
const rot = ([x, y]: Pt, a: number): Pt => { const c = Math.cos(a), s = Math.sin(a); return [x * c - y * s, x * s + y * c]; };
/** a punch curve over an action: 0 -> 1 by `a`, held, back to 0 from `b` to `c` */
const env = (t: number, a: number, b: number, c: number) => t < a ? out3(t / a) : t < b ? 1 : 1 - ease((t - b) / (c - b));

// ─────────────────────────────────────────────────────────────── parts and placement
/** a part: atlas, name, pivot (where it hangs from its parent) and tip (where its child pins on), as size fractions */
interface J { a: string; p: string; piv: Pt; tip?: Pt; mx?: boolean }
const J = (a: string, p: string, piv: Pt, tip?: Pt, mx?: boolean): J => ({ a, p, piv, tip, mx });
function dims(j: J): Pt { const A = KOPI_ATLAS[j.a], r = A?.parts[j.p]; return r ? [r[2] / A.scale, r[3] / A.scale] : [0, 0]; }

/** a part posed in puppet space (source-sheet px): pivot at `at`, rotated by `r`, stretched by sx/sy */
interface Pl { j: J; at: Pt; r: number; sx: number; sy: number }
/** pose a part so its pivot sits at `at` and its pivot->tip line points along `ang` (or is rotated by `ang` if no tip) */
function place(j: J, at: Pt, ang: number, sx = 1, sy = 1): Pl {
  let r = ang;
  if (j.tip) { const [w, h] = dims(j), m = j.mx ? -1 : 1; r = ang - Math.atan2((j.tip[1] - j.piv[1]) * h * sy, (j.tip[0] - j.piv[0]) * w * m * sx); }
  return { j, at, r, sx, sy };
}
/** a point given as a fraction of the part, in puppet space */
function loc(pl: Pl, f: Pt): Pt {
  const [w, h] = dims(pl.j), m = pl.j.mx ? -1 : 1;
  const v = rot([(f[0] - pl.j.piv[0]) * w * m * pl.sx, (f[1] - pl.j.piv[1]) * h * pl.sy], pl.r);
  return [pl.at[0] + v[0], pl.at[1] + v[1]];
}
const tipOf = (pl: Pl) => loc(pl, pl.j.tip ?? pl.j.piv);
function shift(ps: (Pl | null)[], dx: number, dy: number) { for (const p of ps) if (p) p.at = [p.at[0] + dx, p.at[1] + dy]; }

interface R { ctx: CanvasRenderingContext2D; img: (atlas: string) => Img }
function draw(c: R, pl: Pl | null) {
  if (!pl) return;
  const A = KOPI_ATLAS[pl.j.a], r = A?.parts[pl.j.p], im = c.img(pl.j.a); if (!A || !r || !im) return;
  const w = r[2] / A.scale, h = r[3] / A.scale, { ctx } = c;
  ctx.save(); ctx.translate(pl.at[0], pl.at[1]); ctx.rotate(pl.r); ctx.scale((pl.j.mx ? -1 : 1) * pl.sx, pl.sy);
  ctx.drawImage(im, r[0], r[1], r[2], r[3], -pl.j.piv[0] * w, -pl.j.piv[1] * h, w, h);
  ctx.restore();
}
/** a whole sprite (an item, a boss pose) centred at `at`, `w` wide in the current units */
function sprite(c: R, a: string, p: string, at: Pt, w: number, r = 0, ax = 0.5, ay = 0.5) {
  const A = KOPI_ATLAS[a], rc = A?.parts[p], im = c.img(a); if (!A || !rc || !im) return;
  const h = w * rc[3] / rc[2], { ctx } = c;
  ctx.save(); ctx.translate(at[0], at[1]); ctx.rotate(r); ctx.drawImage(im, rc[0], rc[1], rc[2], rc[3], -w * ax, -h * ay, w, h); ctx.restore();
}

/** a figure-wide transform for tumbles and lying down: rotate `rot` about `piv`, which then lands at `to` */
interface Fig { rot: number; piv: Pt; to: Pt }
function figOn(c: R, f: Fig) { c.ctx.translate(f.to[0], f.to[1]); c.ctx.rotate(f.rot); c.ctx.translate(-f.piv[0], -f.piv[1]); }
const figPt = (f: Fig, p: Pt): Pt => { const v = rot([p[0] - f.piv[0], p[1] - f.piv[1]], f.rot); return [f.to[0] + v[0], f.to[1] + v[1]]; };

/** world width of an item held in a paw */
const HOLD_W: Record<string, number> = { tray: 72, stool: 64, wok: 84, durian: 48, pole: 210, satay: 58, kopibag: 40, fish: 74, ice: 46, plate: 66, kopi: 30, basin: 66, coconut: 40, chopsticks: 52 };

// the engine's anim names folded into a few families
const ACT = (a: string) => a === 'windsweep' ? 'wind' : a === 'sweep' || a === 'swoop' ? 'strike' : a === 'charge' ? 'run' : a === 'hop' || a === 'fly' ? 'leap' : a;

// ─────────────────────────────────────────────────────────────── bipeds: macaque and the Macaque King
interface BipedDef {
  k: number; torso: J; sh: Pt; shF: Pt; hip: Pt; hipF: Pt; tailAt: Pt; head: J; ua: J; uaF: J; fa: J; faF: J;
  th: J; thF: J; shin: J; shinF: J; sole: Pt[]; tail: J; tailR: number; cape?: J; capeAt?: Pt;
}
const MAC: BipedDef = {
  k: 0.2, torso: J('macaque', 'torso', [0.5, 0.86], [0.62, 0.08]), sh: [0.4, 0.24], shF: [0.56, 0.2], hip: [0.5, 0.84], hipF: [0.42, 0.8], tailAt: [0.18, 0.84],
  head: J('macaque', 'head', [0.42, 0.8]),
  ua: J('macaque', 'ua', [0.62, 0.14], [0.38, 0.86]), uaF: J('macaque', 'uaF', [0.65, 0.14], [0.38, 0.86]),
  fa: J('macaque', 'fa', [0.08, 0.55], [0.9, 0.42]), faF: J('macaque', 'faF', [0.08, 0.6], [0.9, 0.4]),
  th: J('macaque', 'th', [0.26, 0.24], [0.8, 0.82]), thF: J('macaque', 'thF', [0.26, 0.24], [0.8, 0.82]),
  shin: J('macaque', 'sh', [0.3, 0.1], [0.3, 0.8]), shinF: J('macaque', 'shF', [0.3, 0.1], [0.3, 0.8]), sole: [[0.08, 0.97], [0.95, 0.97]],
  tail: J('macaque', 'tail', [0.97, 0.75]), tailR: 0.15,
};
const KING: BipedDef = {
  k: 0.29, torso: J('king', 'torso', [0.45, 0.9], [0.62, 0.1]), sh: [0.42, 0.3], shF: [0.58, 0.24], hip: [0.45, 0.86], hipF: [0.36, 0.84], tailAt: [0.12, 0.84],
  head: J('king', 'head', [0.5, 0.86]),
  ua: J('king', 'ua', [0.6, 0.12], [0.36, 0.88]), uaF: J('king', 'uaF', [0.62, 0.12], [0.36, 0.88]),
  fa: J('king', 'fa', [0.08, 0.5], [0.88, 0.42]), faF: J('king', 'faF', [0.08, 0.52], [0.88, 0.4]),
  th: J('king', 'th', [0.45, 0.12], [0.55, 0.86]), thF: J('king', 'thF', [0.45, 0.12], [0.55, 0.86]),
  shin: J('king', 'sh', [0.35, 0.08], [0.3, 0.8]), shinF: J('king', 'shF', [0.35, 0.08], [0.3, 0.8]), sole: [[0.05, 0.97], [0.97, 0.97]],
  tail: J('king', 'tail', [0.08, 0.88]), tailR: -0.2, cape: J('king', 'cape', [0.86, 0.12]), capeAt: [0.55, 0.12],
};
interface BP { lean: number; head: number; ua: number; fa: number; uaF: number; faF: number; th: number; sh: number; thF: number; shF: number; tail: number; cape: number; sx: number; sy: number; dx: number; lie: number; seat: number }
const BB: BP = { lean: 0.38, head: -0.25, ua: 1.45, fa: 0.75, uaF: 1.3, faF: 0.6, th: 1.05, sh: 1.95, thF: 1.35, shF: 1.85, tail: 0, cape: 0, sx: 1, sy: 1, dx: 0, lie: 0, seat: 0 };
type BK = keyof BP;
const BKEYS = Object.keys(BB) as BK[];
const bp = (o: Partial<BP>): BP => ({ ...BB, ...o });
const bmix = (a: BP, b: BP, u: number): BP => { const o = { ...a }; for (const k of BKEYS) o[k] = a[k] + (b[k] - a[k]) * u; return o; };
const B_WIND = bp({ lean: -0.12, head: -0.45, ua: -2.3, fa: -2.1, uaF: -2.0, faF: -1.7, th: 1.25, sh: 2.05, thF: 1.6, shF: 1.75, tail: 0.3, cape: -0.25, sy: 1.04, sx: 0.97 });
const B_STRIKE = bp({ lean: 0.8, head: -0.1, ua: 0.35, fa: 0.45, uaF: 0.55, faF: 0.65, th: 0.75, sh: 1.75, thF: 1.95, shF: 1.6, tail: -0.25, cape: 0.3, sx: 1.12, sy: 0.92, dx: 30 });
const B_LIE = bp({ lean: 0.1, head: -0.3, ua: -1.3, fa: -0.9, uaF: -1.1, faF: -0.7, th: 0.2, sh: 1.3, thF: 0.45, shF: 1.6, tail: 1.5, cape: -2.3, lie: 1 });
const B_HURT = bp({ lean: -0.45, head: -0.6, ua: 2.6, fa: 2.3, uaF: 2.8, faF: 2.5, th: 1.5, sh: 1.9, thF: 1.85, shF: 1.6, tail: 0.5, cape: 0.4, sx: 0.94, sy: 1.04, dx: -10 });

function bipedPose(anim: string, t: number, hold: boolean, king: boolean): BP {
  const a = ACT(anim);
  const hp = hold ? { ua: -0.5, fa: -1.3 } : {};
  if (a === 'walk' || a === 'run' || a === 'steal') {
    const run = a !== 'walk', T = run ? 0.38 : 0.6, ph = t / T * TAU, s = Math.sin(ph), c = Math.cos(ph), sw = run ? 0.75 : 0.45;
    const leg = (s: number, c: number) => [1.2 + sw * s, 1.2 + sw * s + 0.65 + Math.max(0, -c) * (run ? 1.1 : 0.7)];
    const [th, sh] = leg(s, c), [thF, shF] = leg(-s, -c);
    return bp({ lean: run ? 0.75 : 0.42, head: run ? -0.6 : -0.3, th, sh, thF, shF, ua: (run ? 1.0 : 1.4) - sw * 0.9 * s, fa: run ? 0.4 : 0.8 - 0.4 * s,
      uaF: (run ? 1.0 : 1.3) + sw * 0.9 * s, faF: run ? 0.3 : 0.6 + 0.4 * s, tail: 0.12 * Math.sin(ph * 2), cape: 0.15 * Math.sin(ph) + (run ? 0.35 : 0.1),
      sy: 1 + 0.025 * Math.abs(c), ...hp });
  }
  // the arms wind back over the shoulder (through the back, not the front) so the slam reads as one big arc
  if (a === 'wind') return bmix(bp(hp), { ...B_WIND, ua: B_WIND.ua + TAU, fa: B_WIND.fa + TAU, uaF: B_WIND.uaF + TAU, faF: B_WIND.faF + TAU }, ease(t / 0.32));
  if (a === 'strike' || a === 'slap') return bmix(B_WIND, B_STRIKE, out3(t / 0.09));
  if (a === 'rec') return bmix(B_STRIKE, bp(hp), ease(t / 0.45));
  if (a === 'hurt' || a === 'carried') {
    if (a === 'carried') return bp({ lean: -0.3, head: 0.5, ua: 2.0, fa: 2.1, uaF: 2.1, faF: 2.2, th: 1.9, sh: 1.7, thF: 2.0, shF: 1.8, tail: 0.6, seat: 1 });
    return bmix(bp({}), B_HURT, env(t, 0.05, 0.14, 0.34));
  }
  if (a === 'stun') { const s = Math.sin(t * 7); return bp({ lean: 0.15 + s * 0.14, head: 0.35 + s * 0.3, ua: 1.8 + s * 0.2, fa: 1.6, uaF: 1.75 - s * 0.2, faF: 1.5, th: 1.2 + s * 0.08, thF: 1.45 - s * 0.08, tail: s * 0.3, dx: s * 6 }); }
  if (a === 'cough') { const s = Math.sin(t * 38), j = Math.sin(t * 9); return bp({ lean: 0.95 + s * 0.05, head: 0.15 + j * 0.15, ua: 0.4, fa: -2.2, uaF: 1.3, faF: 1.1, th: 0.9, sh: 2.1, thF: 1.2, shF: 2.0, sy: 0.96 + s * 0.02 }); }
  if (a === 'eat') { const s = Math.sin(t * 15); return bp({ lean: 0.2, head: -0.1 + s * 0.08, ua: 0.55, fa: -2.35 + s * 0.12, uaF: 0.75, faF: -2.2 - s * 0.12, th: 0.9, sh: 2.2, thF: 1.2, shF: 2.1, sy: 0.97 + Math.abs(s) * 0.02, tail: s * 0.1 }); }
  if (a === 'air') { const s = Math.sin(t * 11); return bp({ lean: -0.7, head: -0.7, ua: 3.4 + s * 0.4, fa: 3.0 - s * 0.4, uaF: -2.4 - s * 0.3, faF: -2.6, th: 0.4 - s * 0.3, sh: 1.0, thF: 0.9 + s * 0.3, shF: 1.9, tail: 0.6, cape: 0.6, lie: 0.35 }); }
  if (a === 'down') return bmix(B_HURT, B_LIE, out3(t / 0.22));
  if (a === 'getup') return bmix(B_LIE, bp({ lean: 0.9, th: 0.5, sh: 2.5, thF: 0.8, shF: 2.4, ua: 1.2, fa: 1.3 }), ease(t / 0.25));
  if (a === 'leap') return bp({ lean: 0.45, head: -0.4, ua: -2.2, fa: -1.6, uaF: -1.9, faF: -1.2, th: 0.35, sh: 2.4, thF: 0.65, shF: 2.6, tail: 0.6, cape: 0.8, ...(hold ? { ua: -2.5, fa: -2.4 } : {}) });
  if (a === 'ride') { const b = Math.sin(t * 12); return bp({ lean: 0.15 + b * 0.05, head: -0.35, ua: 0.7 + b * 0.1, fa: 0.4, uaF: 0.9, faF: 0.5, th: 0.15, sh: 1.6, thF: 0.25, shF: 1.75, tail: 0.4 + b * 0.2, seat: 1, ...hp }); }
  if (a === 'throw') { const u = (t % 0.2) / 0.2; return bp({ lean: lerp(0.0, 0.55, out3(u)), ua: lerp(-2.6, 0.3, out3(u)), fa: lerp(-2.6, 0.2, out3(u)), uaF: 1.6, faF: 1.0, th: 0.9, thF: 1.7, shF: 1.7, cape: 0.2 }); }
  if (a === 'roar') { const s = Math.sin(t * 46) * cl(t * 3); return bp({ lean: -0.3, head: -0.75 + s * 0.05, ua: -2.5 + s * 0.06, fa: -2.0, uaF: -2.0, faF: -1.6, th: 0.9, sh: 1.9, thF: 1.9, shF: 1.6, sy: 1.06, cape: 0.5 + s * 0.1, dx: s * 4 }); }
  if (a === 'stomp') { const u = env(t, 0.06, 0.25, 0.6); return bmix(bp({ lean: 0.1, th: -0.2, sh: 1.2, ua: -1.8, fa: -1.6, uaF: -1.6, faF: -1.4 }), bp({ lean: 0.5, th: 0.85, sh: 1.6, thF: 2.1, shF: 1.6, ua: 0.9, fa: 1.2, uaF: 1.0, faF: 1.3, sx: 1.12, sy: 0.88 }), u); }
  // idle (and anything unknown)
  const b = Math.sin(t * TAU / (king ? 1.6 : 1.2));
  return bp({ lean: BB.lean + b * 0.03, head: BB.head - b * 0.04, ua: BB.ua + b * 0.05, fa: BB.fa + b * 0.06, uaF: BB.uaF - b * 0.04, tail: b * 0.12, cape: b * 0.08, sy: 1 + b * 0.015, sx: 1 - b * 0.01, ...hp });
}

function drawBiped(c: R, d: BipedDef, v: FoeView): Pt {
  const hold = v.hold ?? null, king = d === KING;
  const p = bipedPose(v.anim, v.t, !!hold, king), L = p.lean;
  const T = place(d.torso, [0, 0], -PI / 2 + L);
  const uaF = place(d.uaF, loc(T, d.shF), p.uaF + L), faF = place(d.faF, tipOf(uaF), p.faF + L);
  const ua = place(d.ua, loc(T, d.sh), p.ua + L), fa = place(d.fa, tipOf(ua), p.fa + L);
  const thF = place(d.thF, loc(T, d.hipF), p.thF), shF = place(d.shinF, tipOf(thF), p.shF);
  const th = place(d.th, loc(T, d.hip), p.th), sh = place(d.shin, tipOf(th), p.sh);
  const head = place(d.head, loc(T, d.torso.tip!), p.head + L * 0.5);
  const tail = place(d.tail, loc(T, d.tailAt), d.tailR + p.tail + L * 0.4);
  const cape = d.cape && d.capeAt ? place(d.cape, loc(T, d.capeAt), p.cape * 0.6 + L * 0.7) : null;
  const all = [T, uaF, faF, ua, fa, thF, shF, th, sh, head, tail, cape];
  // ground the lower sole (or the seat when riding or carried)
  let low = -1e9; for (const s of [sh, shF]) for (const f of d.sole) low = Math.max(low, loc(s, f)[1]);
  if (p.seat) low = lerp(low, 0, p.seat);
  shift(all, p.dx / d.k, -low);
  // lying down: rotate the whole figure about the hip so the back lies on the floor
  const fig: Fig = { rot: -PI / 2 * p.lie, piv: [0, -1e-6], to: [0, 0] };
  const hipY = T.at[1];
  fig.piv = [T.at[0], hipY]; fig.to = [T.at[0] * (1 - p.lie), hipY];
  if (p.lie > 0) {
    // rest the lowest point of the head, torso and upper limbs (inner samples, past the cut padding) on the floor
    let lo = -1e9; for (const q of [T, head, th, thF, ua, uaF]) for (const u of [0.1, 0.5, 0.9]) for (const w of [0.1, 0.5, 0.9]) lo = Math.max(lo, figPt(fig, loc(q, [u, w]))[1]);
    fig.to[1] -= lo * p.lie;
  }
  const { ctx } = c;
  ctx.save(); ctx.scale(d.k * p.sx, d.k * p.sy); figOn(c, fig);
  for (const q of [tail, cape, faF, uaF, shF, thF, T, sh, th, head]) draw(c, q);
  const hand = tipOf(fa);
  if (hold) sprite(c, 'weapons', hold, hand, (HOLD_W[hold] ?? 60) / d.k, hold === 'pole' ? fa.r - 1.3 : fa.r * 0.35 - 0.2);
  draw(c, fa); draw(c, ua);
  ctx.restore();
  const hw = figPt(fig, hand);
  return [hw[0] * d.k * p.sx, hw[1] * d.k * p.sy];
}

// ─────────────────────────────────────────────────────────────── four-legged: rat, boar, Tusker
interface QuadDef {
  k: number; body: J; neck: Pt; sh: Pt; shF: Pt; hip: Pt; hipF: Pt; tailAt?: Pt; head: J; fl: J; flF: J; hl: J; hlF: J; foot: Pt[]; tail?: J; tailR: number; tailS?: number;
}
const RAT: QuadDef = {
  k: 0.155, body: J('rat', 'body', [0.5, 0.5]), neck: [0.9, 0.42], sh: [0.78, 0.62], shF: [0.7, 0.58], hip: [0.25, 0.6], hipF: [0.17, 0.56], tailAt: [0.04, 0.55],
  head: J('rat', 'head', [0.3, 0.62]), fl: J('rat', 'fl', [0.28, 0.15]), flF: J('rat', 'flF', [0.28, 0.15]), hl: J('rat', 'hl', [0.38, 0.12]), hlF: J('rat', 'hlF', [0.38, 0.12]),
  foot: [[0.78, 0.96]], tail: J('rat', 'tail', [0.01, 0.45], undefined, true), tailR: -0.12, tailS: 0.62,
};
const BOAR: QuadDef = {
  k: 0.2, body: J('boar', 'body', [0.5, 0.5]), neck: [0.88, 0.45], sh: [0.76, 0.72], shF: [0.68, 0.7], hip: [0.26, 0.72], hipF: [0.18, 0.7], tailAt: [0.05, 0.3],
  head: J('boar', 'head', [0.18, 0.55]), fl: J('boar', 'fl', [0.5, 0.12]), flF: J('boar', 'flF', [0.5, 0.12]), hl: J('boar', 'hl', [0.5, 0.1]), hlF: J('boar', 'hlF', [0.55, 0.1]),
  foot: [[0.65, 0.97]], tail: J('boar', 'tail', [0.9, 0.15]), tailR: 0,
};
const TUSKER: QuadDef = {
  k: 0.5, body: J('bossparts', 'tusker-body', [0.5, 0.5]), neck: [0.93, 0.5], sh: [0.76, 0.78], shF: [0.68, 0.76], hip: [0.3, 0.78], hipF: [0.22, 0.76],
  head: J('bossparts', 'tusker-head', [0.1, 0.6]), fl: J('bossparts', 'tusker-fl', [0.45, 0.12]), flF: J('bossparts', 'tusker-flF', [0.45, 0.12]),
  hl: J('bossparts', 'tusker-hl', [0.5, 0.1]), hlF: J('bossparts', 'tusker-hlF', [0.5, 0.1]), foot: [[0.7, 0.97]], tailR: 0,
};
interface QP { pitch: number; head: number; fl: number; flF: number; hl: number; hlF: number; tail: number; sx: number; sy: number; dx: number; dy: number; roll: number; hx: number; flip: number }
const QB: QP = { pitch: 0, head: 0, fl: 0, flF: 0, hl: 0, hlF: 0, tail: 0, sx: 1, sy: 1, dx: 0, dy: 0, roll: 0, hx: 0, flip: 0 };
const qp = (o: Partial<QP>): QP => ({ ...QB, ...o });
const QKEYS = Object.keys(QB) as (keyof QP)[];
const qmix = (a: QP, b: QP, u: number): QP => { const o = { ...a }; for (const k of QKEYS) o[k] = a[k] + (b[k] - a[k]) * u; return o; };

function quadGait(t: number, T: number, amp: number, gallop: boolean): Partial<QP> {
  const ph = t / T * TAU, s = (o: number) => Math.sin(ph + o);
  if (gallop) return { fl: amp * s(0), flF: amp * s(0.6), hl: amp * s(PI), hlF: amp * s(PI + 0.6), pitch: 0.06 * s(PI / 2), dy: -Math.abs(s(0)) * 18, tail: 0.3 * s(1) };
  return { fl: amp * s(0), hlF: amp * s(0), flF: amp * s(PI), hl: amp * s(PI), dy: -Math.abs(s(0)) * 8, head: 0.04 * s(0) * 2, tail: 0.2 * s(1) };
}
function quadPose(kind: Kind, anim: string, t: number): QP {
  const a = ACT(anim), rat = kind === 'rat';
  const W = rat ? qp({ pitch: -0.12, fl: -0.5, flF: -0.35, hl: 0.55, hlF: 0.45, sx: 0.88, sy: 1.08, hx: -20, head: -0.12, tail: 0.3 })
    : qp({ pitch: 0.12, head: 0.28, fl: -0.25, hl: 0.25, sx: 0.95, sy: 1.04 });
  const S = rat ? qp({ pitch: 0.06, fl: -0.9, flF: -0.75, hl: 0.95, hlF: 0.8, sx: 1.18, sy: 0.9, head: 0.08, hx: 30, tail: -0.2 })
    : qp({ pitch: 0.15, head: 0.35, fl: -0.7, flF: -0.5, hl: 0.7, hlF: 0.5, sx: 1.12, sy: 0.92, hx: 30 });
  if (a === 'walk') return qp(quadGait(t, rat ? 0.3 : 0.55, rat ? 0.55 : 0.4, false));
  if (a === 'run') return qp({ ...quadGait(t, rat ? 0.2 : 0.3, rat ? 0.75 : 0.65, true), head: kind === 'rat' ? 0 : 0.3, sx: 1.06 });
  if (a === 'paw') { const s = Math.sin(t * 16); return qp({ fl: 0.55 * s, flF: -0.1, hl: 0.15, hlF: 0.15, pitch: 0.1 - 0.05 * Math.abs(s), head: 0.35 + 0.05 * s, tail: 0.4 * s, dy: 4 * Math.abs(s) }); }
  if (a === 'wind') return qmix(QB, W, ease(t / 0.3));
  if (a === 'strike') return rat ? qmix(W, S, out3(t / 0.08)) : qmix(W, S, out3(t / 0.1));
  if (a === 'rec') return qmix(S, QB, ease(t / 0.45));
  if (a === 'hurt') return qmix(QB, qp({ pitch: -0.25, head: -0.45, fl: -0.5, flF: -0.3, hl: 0.4, hlF: 0.3, sx: 0.92, sy: 1.06, dx: -12, tail: 0.5 }), env(t, 0.05, 0.14, 0.34));
  if (a === 'stun') { const s = Math.sin(t * 7); return qp({ head: 0.25 + s * 0.3, pitch: s * 0.05, roll: s * 0.04, fl: s * 0.15, hl: -s * 0.15, tail: s * 0.4, dx: s * 5 }); }
  if (a === 'cough') { const s = Math.sin(t * 36); return qp({ head: 0.5 + s * 0.08, pitch: 0.1, sy: 0.95 + s * 0.025, fl: -0.2, flF: -0.2, dx: s * 2 }); }
  if (a === 'eat') { const s = Math.sin(t * 15); return qp({ head: 0.45 + s * 0.1, pitch: 0.12, fl: -0.25, flF: -0.15 }); }
  if (a === 'air') { const s = Math.sin(t * 12); return qp({ roll: -0.35, head: -0.5, fl: -1.0 + s * 0.4, flF: -0.8 - s * 0.4, hl: 1.0 - s * 0.4, hlF: 0.8 + s * 0.4, tail: 0.6, dy: -10 }); }
  if (a === 'down' || a === 'getup') {
    // knocked out the cartoon way: the paper puppet flips onto its back, legs kicking in the air
    const s = Math.sin(t * 14) * cl(1.2 - t), D = qp({ flip: 1, head: 0.15, fl: -0.5 + 0.25 * s, flF: -0.3 - 0.25 * s, hl: 0.5 - 0.25 * s, hlF: 0.3 + 0.25 * s, tail: 0.4 });
    return a === 'down' ? qmix(qp({ roll: -0.3, head: -0.4 }), D, out3(t / 0.16)) : qmix(D, QB, ease(t / 0.3));
  }
  if (a === 'leap') return qp({ pitch: -0.2, fl: -1.0, flF: -0.85, hl: 1.0, hlF: 0.85, sx: 1.1, tail: 0.4, head: -0.15 });
  if (a === 'ride') { const b = Math.sin(t * 12); return qp({ pitch: -0.35 + b * 0.05, head: 0.3, fl: -0.7, flF: -0.6, hl: -1.1, hlF: -1.0, tail: 0.4 + b * 0.3, dy: 2 * b }); }
  if (a === 'carried') return qp({ roll: 0.35, head: 0.6, fl: 0.6, flF: 0.5, hl: 0.5, hlF: 0.4, tail: 1.0 });
  if (a === 'roar') { const s = Math.sin(t * 40) * cl(t * 3); return qp({ pitch: -0.25, head: -0.45 + s * 0.05, fl: -0.5, flF: -0.3, sx: 1.04, sy: 1.06, dx: s * 4 }); }
  if (a === 'stomp') return qmix(qp({ pitch: -0.3, fl: -0.9, flF: -0.7 }), qp({ pitch: 0.1, head: 0.3, sy: 0.88, sx: 1.08 }), env(t, 0.06, 0.25, 0.6));
  const b = Math.sin(t * TAU / 1.3);
  return qp({ sy: 1 + b * 0.02, head: b * 0.04, tail: b * 0.25, dy: -b * 1.5 });
}
function drawQuad(c: R, d: QuadDef, v: FoeView) {
  const p = quadPose(v.kind, v.anim, v.t);
  const B = place(d.body, [0, 0], p.pitch);
  const [, bh] = dims(d.body);
  const fl = place(d.fl, loc(B, d.sh), p.fl), flF = place(d.flF, loc(B, d.shF), p.flF);
  const hl = place(d.hl, loc(B, d.hip), p.hl), hlF = place(d.hlF, loc(B, d.hipF), p.hlF);
  const nk = loc(B, d.neck), hd = place(d.head, [nk[0] + p.hx * Math.cos(p.pitch) / d.k, nk[1] + p.hx * Math.sin(p.pitch) / d.k], p.pitch + p.head);
  const tail = d.tail && d.tailAt ? place(d.tail, loc(B, d.tailAt), d.tailR + p.tail, d.tailS ?? 1, d.tailS ?? 1) : null;
  const all = [B, fl, flF, hl, hlF, hd, tail];
  let low = -1e9; for (const [l, f] of [[fl, d.foot], [flF, d.foot], [hl, d.foot], [hlF, d.foot]] as [Pl, Pt[]][]) for (const q of f) low = Math.max(low, loc(l, q)[1]);
  if (v.anim === 'ride') low = B.at[1] + bh * 0.42;
  shift(all, p.dx / d.k, -low + p.dy / d.k);
  const { ctx } = c;
  ctx.save(); ctx.scale(d.k * p.sx, d.k * p.sy);
  if (p.roll) { ctx.translate(B.at[0], B.at[1]); ctx.rotate(p.roll); ctx.translate(-B.at[0], -B.at[1]); }
  // the flip snaps over at halfway (a smooth y-squash passes through a paper-thin sliver)
  if (p.flip) { const cy = B.at[1]; ctx.translate(0, lerp(cy, -bh * 0.42, p.flip)); if (p.flip > 0.5) ctx.scale(1, -1); ctx.translate(0, -cy); }
  for (const q of [flF, hlF, tail, hl, B, hd, fl]) draw(c, q);
  ctx.restore();
}

// ─────────────────────────────────────────────────────────────── lizards: water monitor, Old Tank
interface LizDef { k: number; body: J; neck: Pt; sh: Pt; shF: Pt; hip: Pt; hipF: Pt; tailAt: Pt; head: J; fl: J; flF: J; hl: J; hlF: J; foot: Pt[]; tails: J[]; tailS: number }
const MON: LizDef = {
  k: 0.135, body: J('monitor', 'body', [0.5, 0.5]), neck: [0.95, 0.45], sh: [0.8, 0.66], shF: [0.74, 0.6], hip: [0.2, 0.66], hipF: [0.14, 0.6], tailAt: [0.04, 0.5],
  head: J('monitor', 'head', [0.07, 0.62]), fl: J('monitor', 'fl', [0.4, 0.12]), flF: J('monitor', 'flF', [0.4, 0.12]), hl: J('monitor', 'hl', [0.33, 0.1]), hlF: J('monitor', 'hlF', [0.3, 0.1]),
  foot: [[0.5, 0.95]], tailS: 0.8,
  tails: [J('monitor', 'tail1', [0.04, 0.5], [0.96, 0.5], true), J('monitor', 'tail2', [0.03, 0.5], [0.96, 0.5], true), J('monitor', 'tail3', [0.02, 0.4], [1, 0.62], true)],
};
const TANK: LizDef = {
  k: 0.48, body: J('bossparts', 'tank-body', [0.5, 0.5]), neck: [0.94, 0.5], sh: [0.78, 0.72], shF: [0.7, 0.66], hip: [0.22, 0.72], hipF: [0.16, 0.66], tailAt: [0.05, 0.5],
  head: J('bossparts', 'tank-head', [0.07, 0.74]), fl: J('bossparts', 'tank-fl', [0.25, 0.2]), flF: J('bossparts', 'tank-flF', [0.25, 0.2]),
  hl: J('bossparts', 'tank-hl', [0.35, 0.15]), hlF: J('bossparts', 'tank-hlF', [0.35, 0.15]), foot: [[0.6, 0.95]], tailS: 1,
  tails: [J('bossparts', 'tank-tail1', [0.06, 0.5], [0.94, 0.5], true), J('bossparts', 'tank-tail2', [0.06, 0.45], [0.94, 0.45], true), J('bossparts', 'tank-tail3', [0.06, 0.3], [1, 0.95], true)],
};
interface LP { pitch: number; head: number; hx: number; fl: number; flF: number; hl: number; hlF: number; tail: number[]; sx: number; sy: number; dx: number; dy: number; roll: number; hs: number }
const lp = (o: Partial<LP>): LP => ({ pitch: 0, head: 0, hx: 0, fl: 0, flF: 0, hl: 0, hlF: 0, tail: [0.08, 0.1, 0.12], sx: 1, sy: 1, dx: 0, dy: 0, roll: 0, hs: 1, ...o });
function lmix(a: LP, b: LP, u: number): LP {
  const o = lp({}); for (const k of ['pitch', 'head', 'hx', 'fl', 'flF', 'hl', 'hlF', 'sx', 'sy', 'dx', 'dy', 'roll', 'hs'] as const) o[k] = lerp(a[k], b[k], u);
  o.tail = a.tail.map((x, i) => lerp(x, b.tail[i], u)); return o;
}
function lizPose(anim: string, t: number): LP {
  const a = ACT(anim);
  const W = lp({ pitch: -0.08, head: -0.35, hx: -30, fl: -0.2, hl: 0.15, tail: [-0.05, 0.05, 0.1], sy: 1.03 });
  const S = lp({ pitch: 0.06, head: 0.12, hx: 55, fl: -0.5, flF: -0.35, hl: 0.35, sx: 1.06, sy: 0.96, hs: 1.12, dx: 30 });
  const WS = lp({ pitch: 0.05, head: 0.2, fl: 0.15, tail: [-0.55, -0.6, -0.6], sx: 0.94, roll: 0.04 });
  const SW = lp({ pitch: -0.05, head: -0.15, tail: [0.35, 0.5, 0.6], fl: -0.2, hl: 0.2, sx: 1.04, roll: -0.04 });
  if (a === 'walk' || a === 'run') {
    const run = a === 'run', T = run ? 0.42 : 0.8, ph = t / T * TAU, s = Math.sin(ph), amp = run ? 0.5 : 0.35;
    return lp({ fl: amp * s, hlF: amp * s, flF: -amp * s, hl: -amp * s, head: 0.06 * Math.sin(ph + 1), dy: -Math.abs(s) * 4,
      tail: [0.08 + 0.12 * Math.sin(ph), 0.1 + 0.16 * Math.sin(ph - 0.8), 0.12 + 0.22 * Math.sin(ph - 1.6)] });
  }
  if (anim === 'windsweep') return lmix(lp({}), WS, ease(t / 0.5));
  if (anim === 'sweep') return lmix(WS, SW, out3(t / 0.12));
  if (a === 'wind') return lmix(lp({}), W, ease(t / 0.45));
  if (a === 'strike') return lmix(W, S, out3(t / 0.09));
  if (a === 'rec') return lmix(S, lp({}), ease(t / 0.5));
  if (a === 'hurt') return lmix(lp({}), lp({ pitch: -0.12, head: -0.5, hx: -20, fl: -0.4, hl: 0.3, tail: [-0.3, -0.2, -0.1], sy: 1.05, sx: 0.95, dx: -10 }), env(t, 0.05, 0.14, 0.34));
  if (a === 'stun') { const s = Math.sin(t * 7); return lp({ head: 0.25 + 0.3 * s, hx: 8 * s, roll: 0.03 * s, tail: [0.1 * s, 0.2 * s, 0.3 * s], dx: 4 * s }); }
  if (a === 'cough') { const s = Math.sin(t * 34); return lp({ head: 0.45 + 0.08 * s, sy: 0.96 + 0.025 * s, dx: 2 * s }); }
  if (a === 'eat') { const s = Math.sin(t * 14); return lp({ head: 0.4 + 0.12 * s, hx: 6 * s }); }
  if (a === 'air') { const s = Math.sin(t * 10); return lp({ roll: -0.4, head: -0.5, fl: -1.0 + 0.4 * s, flF: -0.8 - 0.4 * s, hl: 1.0 - 0.4 * s, hlF: 0.8 + 0.4 * s, tail: [0.4, 0.4, 0.4], dy: -10 }); }
  if (a === 'down' || a === 'getup') {
    const D = lp({ pitch: 0, head: 0.18, fl: -1.3, flF: -1.1, hl: 1.25, hlF: 1.1, sy: 0.86, sx: 1.04, tail: [0.15, 0.1, 0.05] });
    return a === 'down' ? lmix(lp({ roll: -0.35 }), D, out3(t / 0.2)) : lmix(D, lp({}), ease(t / 0.35));
  }
  if (a === 'leap') return lp({ pitch: -0.18, fl: -0.9, flF: -0.7, hl: 0.9, hlF: 0.7, tail: [0.3, 0.3, 0.3] });
  if (a === 'roar') { const s = Math.sin(t * 40) * cl(t * 3); return lp({ pitch: -0.18, head: -0.5 + 0.05 * s, hx: 10, hs: 1.08, fl: -0.4, dx: 4 * s, tail: [-0.2, -0.2, -0.3] }); }
  if (a === 'stomp') return lmix(lp({ pitch: -0.3, fl: -0.9, flF: -0.7, head: -0.3 }), lp({ pitch: 0.08, sy: 0.88, sx: 1.08, head: 0.2 }), env(t, 0.06, 0.25, 0.6));
  if (a === 'ride' || a === 'carried') return lp({ roll: 0.3, head: 0.5, fl: 0.5, hl: 0.5 });
  const b = Math.sin(t * TAU / 1.8);
  return lp({ head: b * 0.05, sy: 1 + b * 0.015, tail: [0.08 + b * 0.05, 0.1 + b * 0.08, 0.12 + b * 0.12] });
}
function drawLiz(c: R, d: LizDef, v: FoeView) {
  const p = lizPose(v.anim, v.t);
  const B = place(d.body, [0, 0], p.pitch), [, bh] = dims(d.body);
  const fl = place(d.fl, loc(B, d.sh), p.fl), flF = place(d.flF, loc(B, d.shF), p.flF);
  const hl = place(d.hl, loc(B, d.hip), p.hl), hlF = place(d.hlF, loc(B, d.hipF), p.hlF);
  const nk = loc(B, d.neck), hx = p.hx * 0.2 / d.k, hd = place(d.head, [nk[0] + hx * Math.cos(p.pitch), nk[1] + hx * Math.sin(p.pitch)], p.pitch + p.head, p.hs, p.hs);
  const tails: Pl[] = []; let at = loc(B, d.tailAt), ang = PI + p.pitch;
  for (let i = 0; i < d.tails.length; i++) { ang += p.tail[i]; const q = place(d.tails[i], at, ang, d.tailS, d.tailS); tails.push(q); at = loc(q, [lerp(d.tails[i].piv[0], d.tails[i].tip![0], 0.92), lerp(d.tails[i].piv[1], d.tails[i].tip![1], 0.92)]); }
  const all = [B, fl, flF, hl, hlF, hd, ...tails];
  let low = -1e9; for (const l of [fl, flF, hl, hlF]) for (const q of d.foot) low = Math.max(low, loc(l, q)[1]);
  shift(all, p.dx / d.k, -low + p.dy / d.k);
  const { ctx } = c;
  ctx.save(); ctx.scale(d.k * p.sx, d.k * p.sy);
  if (p.roll) { ctx.translate(B.at[0], B.at[1] + bh * 0.5); ctx.rotate(p.roll); ctx.translate(-B.at[0], -B.at[1] - bh * 0.5); }
  for (const q of [flF, hlF, ...tails.slice().reverse(), hl, B, hd, fl]) draw(c, q);
  ctx.restore();
}

// ─────────────────────────────────────────────────────────────── toads: Asian toad, Big Frog Ong
interface ToadDef { k: number; body: J; open: J; hip: Pt; hipF: Pt; arm: Pt; armF: Pt; mouth: Pt; leg: J; legF: J; fa: J; faF: J; foot: Pt[]; tongue: number }
const TOAD: ToadDef = {
  k: 0.2, body: J('toad', 'body', [0.5, 0.97]), open: J('toad', 'bodyOpen', [0.5, 0.97]), hip: [0.3, 0.74], hipF: [0.38, 0.7], arm: [0.7, 0.82], armF: [0.76, 0.78], mouth: [0.93, 0.56],
  leg: J('toad', 'leg', [0.74, 0.16]), legF: J('toad', 'legF', [0.74, 0.16]), fa: J('toad', 'arm', [0.62, 0.15]), faF: J('toad', 'armF', [0.62, 0.15]), foot: [[0.2, 0.95], [0.9, 0.95]], tongue: 230,
};
const ONG: ToadDef = {
  k: 0.52, body: J('bossparts', 'ong-body', [0.55, 0.97]), open: J('bossparts', 'ong-bodyOpen', [0.55, 0.97]), hip: [0.25, 0.78], hipF: [0.33, 0.74], arm: [0.66, 0.62], armF: [0.74, 0.58], mouth: [0.82, 0.36],
  leg: J('bossparts', 'ong-leg', [0.42, 0.12]), legF: J('bossparts', 'ong-legF', [0.42, 0.12]), fa: J('bossparts', 'ong-arm', [0.45, 0.1]), faF: J('bossparts', 'ong-armF', [0.45, 0.1]), foot: [[0.5, 0.94], [0.95, 0.9]], tongue: 560,
};
function drawToad(c: R, d: ToadDef, v: FoeView) {
  const a = ACT(v.anim), t = v.t, ong = d === ONG;
  let pitch = 0, sx = 1, sy = 1, leg = 0, arm = 0, dy = 0, roll = 0, open = false, tongue = 0, dx = 0;
  const b = Math.sin(t * TAU / 0.9);
  if (a === 'puff' || a === 'wind') { const u = ease(t / 0.5), j = Math.sin(t * 30) * u; sx = 1 + 0.22 * u + 0.015 * j; sy = 1 + 0.26 * u - 0.015 * j; pitch = -0.08 * u; }
  else if (a === 'tongue' || a === 'strike') { open = true; tongue = t < 0.15 ? out3(t / 0.15) : t < 0.25 ? 1 : 1 - ease((t - 0.25) / 0.2); pitch = -0.06; sx = 1.04; sy = 0.97; dx = 6 * tongue; }
  else if (a === 'leap') { pitch = -0.35; leg = 1.1; arm = -0.6; sx = 0.94; sy = 1.08; }
  else if (a === 'walk' || a === 'run') { const u = (t % 0.5) / 0.5, h = Math.sin(u * PI); pitch = -0.25 * h; leg = 0.9 * h; arm = -0.5 * h; dy = -28 * h; sy = 1 - 0.08 * (1 - h); }
  else if (a === 'hurt') { const u = env(t, 0.05, 0.14, 0.34); pitch = -0.3 * u; sx = 1 - 0.08 * u; sy = 1 + 0.08 * u; leg = 0.4 * u; arm = -0.6 * u; dx = -10 * u; open = u > 0.3; }
  else if (a === 'stun') { const s = Math.sin(t * 7); roll = 0.08 * s; pitch = 0.1 + 0.08 * s; dx = 5 * s; }
  else if (a === 'cough') { const s = Math.sin(t * 34); pitch = 0.2 + 0.04 * s; sy = 0.95 + 0.03 * s; open = s > 0.3; }
  else if (a === 'eat') { const s = Math.sin(t * 14); open = s > 0; arm = -0.9; pitch = 0.08 * s; }
  else if (a === 'air') { roll = -0.5 + 0.1 * Math.sin(t * 10); leg = 1.2; arm = -1.0; open = true; }
  else if (a === 'down' || a === 'getup') { const u = a === 'down' ? out3(t / 0.2) : 1 - ease(t / 0.35); sy = 1 - 0.3 * u; sx = 1 + 0.18 * u; leg = 1.25 * u; arm = -1.1 * u; }
  else if (a === 'roar') { const s = Math.sin(t * 40) * cl(t * 3); open = true; pitch = -0.2; sy = 1.08; dx = 4 * s; }
  else if (a === 'stomp') { const u = env(t, 0.06, 0.25, 0.6); sy = 1 - 0.14 * u; sx = 1 + 0.12 * u; leg = 0.3 * u; }
  else if (a === 'ride' || a === 'carried') { roll = 0.35; leg = 0.9; arm = 0.6; }
  else { sy = 1 + 0.02 * b; sx = 1 - 0.012 * b; }
  const B = place(open ? d.open : d.body, [0, 0], pitch, sx, sy), [, bh] = dims(d.body);
  const lg = place(d.leg, loc(B, d.hip), leg), lgF = place(d.legF, loc(B, d.hipF), leg * 0.9);
  const am = place(d.fa, loc(B, d.arm), arm), amF = place(d.faF, loc(B, d.armF), arm * 0.9);
  // sit on the lower of the hind foot and the body's own bottom
  let low = B.at[1]; for (const l of [lg, lgF, am, amF]) for (const q of d.foot) low = Math.max(low, loc(l, q)[1]);
  shift([B, lg, lgF, am, amF], dx / d.k, -low + dy / d.k);
  const { ctx } = c;
  ctx.save(); ctx.scale(d.k, d.k);
  if (roll) { ctx.translate(0, -bh * 0.4); ctx.rotate(roll); ctx.translate(0, bh * 0.4); }
  for (const q of [lgF, amF, B, lg, am]) draw(c, q);
  if (tongue > 0.01) {
    const m = loc(B, d.mouth), len = d.tongue * tongue / d.k, tj = J('toad', 'tongue', [0.02, 0.45]), [tw] = dims(tj);
    draw(c, place(tj, m, pitch * 0.5 + 0.04, len / tw, ong ? 1.5 / (d.k / TOAD.k) * 0.9 : 1));
  }
  ctx.restore();
}

// ─────────────────────────────────────────────────────────────── mynah
const MY = {
  k: 0.15, body: J('mynah', 'body', [0.5, 0.5]), neck: [0.9, 0.3] as Pt, wingAt: [0.56, 0.3] as Pt, legAt: [0.5, 0.82] as Pt, legFAt: [0.58, 0.8] as Pt, tailAt: [0.1, 0.55] as Pt,
  head: J('mynah', 'head', [0.13, 0.85]), wing: J('mynah', 'wing', [0.07, 0.8]), wingF: J('mynah', 'wingF', [0.07, 0.8]), fold: J('mynah', 'fold', [0.92, 0.2]),
  leg: J('mynah', 'leg', [0.4, 0.12]), legF: J('mynah', 'legF', [0.4, 0.12]), tail: J('mynah', 'tail', [0.08, 0.27], undefined, true),
};
function drawMynah(c: R, v: FoeView) {
  const a = ACT(v.anim), t = v.t;
  let pitch = 0, head = 0, flap = Math.sin(t * TAU / 0.26), legs = 0.5, tail = 0.15, folded = false, roll = 0, dy = 0, sx = 1;
  if (v.anim === 'swoop' || a === 'strike') { pitch = 0.5; head = 0.15; flap = -0.6 + 0.15 * Math.sin(t * 30); legs = -0.6; tail = -0.2; sx = 1.08; }
  else if (a === 'wind') { pitch = -0.3; head = -0.3; flap = Math.sin(t * TAU / 0.14); legs = -0.9; }
  else if (a === 'hurt') { const u = env(t, 0.05, 0.14, 0.34); pitch = -0.4 * u; head = -0.5 * u; flap = 1 - 1.6 * u; legs = 0.8; tail = 0.5 * u; }
  else if (a === 'stun') { const s = Math.sin(t * 7); roll = 0.15 * s; head = 0.3 * s; flap = Math.sin(t * TAU / 0.4) * 0.6; }
  else if (a === 'air') { roll = -0.6 + 0.2 * Math.sin(t * 12); flap = Math.sin(t * 25); head = -0.5; legs = 1.2; }
  else if (a === 'down' || a === 'getup') { folded = true; roll = a === 'down' ? -0.25 * out3(t / 0.2) : -0.25 * (1 - ease(t / 0.35)); legs = -1.2; head = 0.25; dy = 18; }
  // wing flap: the painted raised wing swings down through the body line, squashed as it passes edge-on
  const fy = flap, wsy = Math.abs(fy) < 0.25 ? 0.25 * Math.sign(fy || 1) : fy, wr = (1 - fy) * 0.35;
  const B = place(MY.body, [0, 0], pitch, sx, 1);
  const hd = place(MY.head, loc(B, MY.neck), pitch + head);
  const tl = place(MY.tail, loc(B, MY.tailAt), pitch * 0.5 + tail);
  const lg = place(MY.leg, loc(B, MY.legAt), legs), lgF = place(MY.legF, loc(B, MY.legFAt), legs * 0.8 + 0.15);
  const wa = loc(B, MY.wingAt);
  const wN = folded ? place(MY.fold, wa, pitch) : place(MY.wing, wa, pitch + wr, 1, wsy);
  const wF = folded ? null : place(MY.wingF, [wa[0] + 20, wa[1] - 6], pitch + wr * 0.8 - 0.1, 0.92, Math.sign(wsy) * Math.max(0.3, Math.abs(Math.sin(t * TAU / 0.26 + 0.5))));
  const all = [B, hd, tl, lg, lgF, wN, wF];
  let low = -1e9; for (const l of [lg, lgF]) low = Math.max(low, loc(l, [0.5, 0.95])[1]);
  shift(all, 0, -low + dy / MY.k);
  const { ctx } = c;
  ctx.save(); ctx.scale(MY.k, MY.k);
  if (roll) { ctx.translate(B.at[0], B.at[1]); ctx.rotate(roll); ctx.translate(-B.at[0], -B.at[1]); }
  for (const q of [wF, lgF, tl, lg, B, hd, wN]) draw(c, q);
  ctx.restore();
}

// ─────────────────────────────────────────────────────────────── cockroach (painted frames)
function drawRoach(c: R, v: FoeView) {
  const a = ACT(v.anim), t = v.t, k = 0.13, { ctx } = c;
  const flying = a === 'leap' || a === 'strike' || a === 'wind' || v.anim === 'fly' || v.anim === 'swoop';
  ctx.save(); ctx.scale(k, k);
  if (a === 'down' || a === 'air') {
    // legs in the air, the cartoon way
    const rc = KOPI_ATLAS.roach?.parts.walk, w = rc ? rc[2] / KOPI_ATLAS.roach.scale : 480;
    sprite(c, 'roach', 'walk', [0, -110], w, PI + 0.15 * Math.sin(t * 30) * (a === 'air' ? 1 : cl(1 - t * 2)));
  } else if (flying) {
    const f = ['fly1', 'fly2', 'fly3', 'fly4'][Math.floor(t * 28) % 4], rc = KOPI_ATLAS.roach?.parts[f];
    const w = rc ? rc[2] / KOPI_ATLAS.roach.scale : 600;
    sprite(c, 'roach', f, [0, -Math.sin(t * 20) * 14], w, 0.05 * Math.sin(t * 9), 0.5, 0.9);
  } else {
    const rc = KOPI_ATLAS.roach?.parts.walk, w = rc ? rc[2] / KOPI_ATLAS.roach.scale : 480, j = Math.sin(t * 50);
    sprite(c, 'roach', 'walk', [j * 6, 0], w * (1 + 0.02 * j), 0.03 * j, 0.5, 0.95);
  }
  ctx.restore();
}

// ─────────────────────────────────────────────────────────────── reticulated python (a chain of scale segments)
const PY_SEG = ['seg1', 'seg2', 'seg3', 'seg4'].map((p) => J('python', p, [0.04, 0.5], [0.96, 0.5]));
const PY_TAIL = J('python', 'tail', [0.03, 0.45], [1, 0.55]);
const PY_HEAD = J('python', 'head', [0.08, 0.62], [0.97, 0.45]), PY_OPEN = J('python', 'headOpen', [0.07, 0.55], [0.75, 0.3]);
function drawPython(c: R, v: FoeView) {
  const a = v.anim, t = v.t, k = 0.4;
  // the body as a path from the head (s = 0) back along the coils, in world px
  let path: (u: number) => Pt, open = false, hdAng = 0, rope = true;
  const sway = (u: number, amp: number, sp: number) => amp * Math.sin(t * sp - u * 4) * (1 - u * 0.7);
  if (a === 'wrap') {
    open = Math.sin(t * 6) > 0;
    path = (u) => { const th = u * 2.6 * TAU + 0.6, j = Math.sin(t * 18) * 2; return [58 * Math.cos(th) + j, -170 + u * 150 + 16 * Math.sin(th)]; };
    hdAng = -0.2;
  } else if (a === 'down' || a === 'air' || a === 'getup') {
    const ground = a !== 'air'; rope = false;
    path = (u) => [60 - u * 330, ground ? -42 + 16 * Math.sin(u * 9 + 0.5) : -50 - 30 * Math.sin(u * 4 + t * 6)];
    hdAng = ground ? 0.02 : -0.4; open = !ground;
  } else if (a === 'lower' || a === 'strike' || a === 'wind') {
    const lunge = a === 'strike' ? out3(t / 0.1) : 0, drop = a === 'strike' ? 1 : ease(t / 0.45);
    const hx = 30 + 70 * lunge, hy = lerp(-50, -40, drop);
    path = (u) => { const w = 1 - u; return [hx * w * w + (-40) * 2 * u * w + sway(u, 6, 3), hy * w * w + (-170) * 2 * u * w + (-330) * u * u]; };
    open = a === 'strike' || Math.sin(t * 10) > 0.6; hdAng = lerp(0.9, 0.15, a === 'strike' ? 1 : drop * 0.6);
  } else {
    // hanging from the rail above: the head dangles and swings; 'rise' pulls it back up
    const hy = a === 'rise' ? lerp(-10, -120, ease(t / 0.8)) : a === 'hurt' ? -10 - 30 * env(t, 0.05, 0.12, 0.34) : -10 + 4 * Math.sin(t * 2.4);
    path = (u) => [sway(u, a === 'hurt' ? 30 : 16, 2.4), lerp(hy, -330, u)];
    hdAng = 1.25 + 0.2 * Math.sin(t * 2.4 + 0.6);
  }
  // sample the path into segment placements, laid tail first so the head end overlaps
  const [sw] = dims(PY_SEG[0]), segW = sw * k * 0.74;
  // every pose but the floored ones hangs from the rail: the body runs on straight up off the top of the screen
  const pts: Pt[] = []; for (let i = 0; i <= 200; i++) pts.push(path(i / 200));
  if (rope) { const [ex, ey] = pts[pts.length - 1]; for (let i = 1; i <= 20; i++) pts.push([ex, lerp(ey, -820, i / 20)]); }
  const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const at = (d: number): Pt => { let i = 1; while (i < cum.length - 1 && cum[i] < d) i++; const u = (d - cum[i - 1]) / Math.max(1e-6, cum[i] - cum[i - 1]); return [lerp(pts[i - 1][0], pts[i][0], u), lerp(pts[i - 1][1], pts[i][1], u)]; };
  const total = cum[cum.length - 1], n = Math.max(3, Math.min(rope ? 30 : 9, Math.floor(total / segW) - 1));
  const { ctx } = c;
  ctx.save(); ctx.scale(k, k);
  const P = (q: Pt): Pt => [q[0] / k, q[1] / k];
  const tailFrom = at(segW * (n + 0.2)), tailBack = at(segW * (n - 0.6));
  draw(c, place(PY_TAIL, P(tailFrom), Math.atan2(tailFrom[1] - tailBack[1], tailFrom[0] - tailBack[0]), 0.8, 0.85));
  for (let i = n; i >= 1; i--) {
    const p0 = at(segW * (i + 0.15)), p1 = at(segW * (i - 1) + 2);
    const thin = 1 - 0.18 * (i / n);
    draw(c, place(PY_SEG[i % 4], P(p0), Math.atan2(p1[1] - p0[1], p1[0] - p0[0]), 1.02, thin));
  }
  const h0 = at(segW * 0.5), hj = open ? PY_OPEN : PY_HEAD;
  draw(c, place(hj, P(h0), hdAng, 0.95, 0.95));
  ctx.restore();
}

// ─────────────────────────────────────────────────────────────── Madam Ssst (one painted pose, squashed and sheared)
function drawSsst(c: R, v: FoeView) {
  const a = ACT(v.anim), t = v.t, A = KOPI_ATLAS.bosses, r = A?.parts.ssst; if (!r) return;
  const w = r[2] / A.scale, h = r[3] / A.scale, k = 260 / h;
  let sx = 1, sy = 1, sh = 0, ro = 0, dx = 0;
  const b = Math.sin(t * TAU / 1.1);
  if (a === 'walk' || a === 'run') { const s = Math.sin(t * TAU / 0.6); sh = 0.08 * s; sx = 1 + 0.04 * s; sy = 1 - 0.03 * s; dx = 6 * s; }
  else if (a === 'wind') { const u = ease(t / 0.5); sh = -0.22 * u; sy = 1 - 0.1 * u; sx = 1 + 0.06 * u; }
  else if (a === 'strike' || a === 'wrap') { const u = a === 'wrap' ? 1 : out3(t / 0.1), s = a === 'wrap' ? Math.sin(t * 16) : 0; sh = 0.42 * u; sx = 1 + 0.28 * u + 0.03 * s; sy = 1 - 0.08 * u - 0.03 * s; dx = 30 * u; }
  else if (a === 'roar') { const s = Math.sin(t * 40) * cl(t * 3), u = out3(t / 0.25); sy = 1 + 0.2 * u; sx = 1 - 0.08 * u; dx = 8 * s; ro = 0.04 * s; sh = -0.18 * u; }
  else if (a === 'hurt') { const u = env(t, 0.05, 0.14, 0.34); sh = -0.25 * u; sy = 1 + 0.05 * u; sx = 1 - 0.05 * u; dx = -10 * u; }
  else if (a === 'stun') { const s = Math.sin(t * 7); ro = 0.08 * s; sh = 0.12 * s; }
  else if (a === 'air') ro = -0.5;
  else if (a === 'down' || a === 'getup') { const u = a === 'down' ? out3(t / 0.25) : 1 - ease(t / 0.4); sy = 1 - 0.4 * u; sx = 1 + 0.25 * u; }
  else if (a === 'puff' || a === 'throw' || a === 'stomp' || a === 'leap') { sy = 1.06 + 0.03 * Math.sin(t * 20); }
  else { sy = 1 + 0.025 * b; sx = 1 - 0.015 * b; sh = 0.03 * Math.sin(t * TAU / 2.2); }
  const im = c.img('bosses'); if (!im) return;
  const { ctx } = c;
  ctx.save(); ctx.translate(dx, 0); ctx.rotate(ro); ctx.transform(1, 0, -sh, 1, 0, 0); ctx.scale(k * sx, k * sy);
  ctx.drawImage(im, r[0], r[1], r[2], r[3], -w * 0.5, -h * 0.985, w, h);
  ctx.restore();
}

// ─────────────────────────────────────────────────────────────── entry point
function body(c: R, v: FoeView): Pt | void {
  switch (v.kind) {
    case 'macaque': return drawBiped(c, MAC, v);
    case 'king': return drawBiped(c, KING, v);
    case 'rat': return drawQuad(c, RAT, v);
    case 'boar': return drawQuad(c, BOAR, v);
    case 'tusker': return drawQuad(c, TUSKER, v);
    case 'monitor': return drawLiz(c, MON, v);
    case 'tank': return drawLiz(c, TANK, v);
    case 'toad': return drawToad(c, TOAD, v);
    case 'ong': return drawToad(c, ONG, v);
    case 'mynah': return drawMynah(c, v);
    case 'roach': return drawRoach(c, v);
    case 'python': return drawPython(c, v);
    case 'ssst': return drawSsst(c, v);
  }
}
/**
 * Draw a foe with its feet (or, for fliers, the point under its body) at screen (x, y), facing `face`, at extra scale
 * S. A hit flash redraws the puppet additively. Macaques and the King return their near hand's screen point (they
 * draw their held weapon themselves).
 */
export function drawFoe(ctx: CanvasRenderingContext2D, img: (atlas: string) => HTMLImageElement | ImageBitmap | null, v: FoeView, x: number, y: number, S: number): { hand: [number, number] } | void {
  const c: R = { ctx, img };
  ctx.save(); ctx.translate(x, y); ctx.scale(v.face * S, S);
  const hand = body(c, v);
  if (v.flash > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= Math.min(0.8, v.flash * 7); body(c, v); ctx.restore(); }
  ctx.restore();
  if (hand) return { hand: [x + v.face * S * hand[0], y + S * hand[1]] };
}
