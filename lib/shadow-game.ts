// Shadowplay's rules: the shadow theatre's geometry, the match and the save. No DOM, no Math.random, no clock.
//
// The paper screen is the plane z = 0, 16 units wide and 9 high, y pointing down. Each lantern hangs LAMP_D units
// behind it. A prop is a flat cut-out held parallel to the screen on a rod, so its shadow from a lantern is the prop
// itself scaled about that lantern by k = LAMP_D / (LAMP_D − z): k is 1 against the screen and grows towards the lantern.
// The game stores each prop by where its shadow's centre falls with the lanterns at home (in eighths of a unit), its
// depth notch (which fixes k), a rotation in 15° steps, a flip, and for some props a turn about the upright axis that
// thins the prop until it is edge-on. Moving a lantern leaves the props where they are, so their shadows slide the
// other way, the ones nearest the lantern furthest (parallax). With two coloured lanterns every prop casts two
// shadows; where both fall the screen is dark, where one falls it shows the other lantern's colour, and a coloured
// gel prop lets its own colour through.
//
// The match: the screen is sampled on a 128 × 72 grid. Each cell gets a key saying, for every lantern, whether its
// light reaches the cell clear, through which gels, or not at all. The score is the share of cells that agree with
// the target's key among the cells where either has any shadow (a generalised intersection over union), and a scene
// is matched at MATCH or more.
import { SHAPES, SCENES, SCENE_IDS, STORIES, type ShapeId } from './shadow-levels.js';

export { SHAPES, SCENES, SCENE_IDS, STORIES };
export type { ShapeId };
export type V2 = [number, number];
export type Poly = V2[];
export type Gel = 'ruby' | 'gold' | 'jade' | 'sky';
export type Tone = 'warm' | 'gold' | 'blue';
export type Tool = 'move' | 'rot' | 'flip' | 'depth' | 'turn' | 'lamp' | 'take';

export const SCREEN_W = 16, SCREEN_H = 9;
export const RES = 8, GW = SCREEN_W * RES, GH = SCREEN_H * RES;
export const LAMP_D = 12;
/** The shadow's scale at each depth notch: 0 is pressed against the paper, 6 is right by the lantern. */
export const KS = [1, 1.2, 1.45, 1.75, 2.1, 2.5, 3] as const;
export const ROT_STEPS = 24, TURN_STEPS = 6;
export const MATCH = 0.86;
/** Every puppet's part of the picture must be at least this well covered, give or take one cell. */
export const COVER = 0.75;
/** A released puppet within this many units of its place (with the right turn, flip and depth) clicks into it. */
export const SNAP = 0.45;
/** A turned prop is never thinner than this share of its width. */
export const EDGE = 0.12;
export const GELS: Gel[] = ['ruby', 'gold', 'jade', 'sky'];
export const MAX_SANDBOX = 12;

export interface Pose { x: number; y: number; d: number; r: number; f: 0 | 1; t: number; on: boolean }
export interface ShapeDef { name: string; blurb: string; polys: Poly[]; holes?: Poly[]; gel?: Gel; turn?: boolean; round?: boolean; /** Pieces (by index) that stay round when the prop turns, like a fan's stick. */ stiff?: number[] }
export interface PropDef {
  shape: ShapeId;
  start: Pose;
  /** Where it belongs; null for a decoy, which belongs off the rods. */
  sol: Pose | null;
  /** A set piece: it can't be moved. */
  fixed?: boolean;
  /** Slides along one line only. */
  rail?: 'x' | 'y';
  /** A flourish prop: the match ignores it. */
  extra?: boolean;
}
export interface LampDef { x: number; y: number; tone: Tone; /** How far it may slide, in quarter units either way of home. */ move?: [number, number]; sol?: number }
export type Flourish =
  | { k: 'extra'; prop: number; zone: [number, number, number, number]; text: string }
  | { k: 'perfect'; min: number; text: string }
  | { k: 'depth'; prop: number; min?: number; max?: number; text: string };
export type AnimKind = 'sway' | 'bob' | 'spin' | 'drift' | 'pulse' | 'flap' | 'wag';
export interface Anim { prop: number; kind: AnimKind; amp: number; per: number; px?: number; py?: number; phase?: number }
export type Ambience = 'stars' | 'waves' | 'fireflies' | 'petals' | 'snow' | 'embers';
export interface SceneDef {
  id: string; story: number; n: number; name: string;
  /** The story line before the scene is cast, and the line when it comes alive. */
  line: string; after: string;
  props: PropDef[]; lamps: LampDef[]; tools: Tool[];
  /** The fewest puppets (and lanterns) to pick up, proved by the bot. */
  par: number;
  flourish: Flourish;
  tip?: { title: string; text: string };
  alive: Anim[]; amb?: Ambience;
}
export interface StoryDef { id: number; name: string; blurb: string; scenes: string[] }
export type Op =
  | { k: 'move'; i: number; x: number; y: number }
  | { k: 'depth'; i: number; d: number }
  | { k: 'rot'; i: number; r: number }
  | { k: 'flip'; i: number }
  | { k: 'turn'; i: number; t: number }
  | { k: 'on'; i: number; on: boolean }
  | { k: 'lamp'; i: number; x: number };

// ---------------------------------------------------------------- geometry
export const pose = (x: number, y: number, d = 0, r = 0, f: 0 | 1 = 0, t = 0, on = true): Pose => ({ x: Math.round(x * 8), y: Math.round(y * 8), d, r, f, t, on });
export const clonePose = (p: Pose): Pose => ({ ...p });
export const samePose = (a: Pose, b: Pose) => a.x === b.x && a.y === b.y && a.d === b.d && a.r === b.r && a.f === b.f && a.t === b.t && a.on === b.on;
export const kOf = (d: number) => KS[Math.max(0, Math.min(KS.length - 1, d))];
/** How far a notch sits from the screen, in units. */
export const depthOf = (d: number) => LAMP_D * (1 - 1 / kOf(d));
export const lampHome = (s: { lamps: LampDef[] }): V2 => {
  let x = 0, y = 0; for (const L of s.lamps) { x += L.x; y += L.y; }
  return [x / s.lamps.length, y / s.lamps.length];
};
export const lampAt = (L: LampDef, off: number): V2 => [L.x + off / 4, L.y];

/** Turns, flips and rotates points of a prop, still at k = 1 and centred on 0,0. */
export function localPts(shape: ShapeDef, p: Pose, pts: Poly, stiff = false): Poly {
  const a = (p.r * Math.PI * 2) / ROT_STEPS, c = Math.cos(a), s = Math.sin(a);
  const sx = (p.f ? -1 : 1) * (shape.turn && !stiff ? Math.max(EDGE, Math.cos((p.t * Math.PI) / 2 / TURN_STEPS)) : 1);
  return pts.map(([x, y]) => { const u = x * sx; return [u * c - y * s, u * s + y * c]; });
}
/** The prop's pieces after its turn, flip and rotation. */
export const localPolys = (shape: ShapeDef, p: Pose): Poly[] => shape.polys.map((q, i) => localPts(shape, p, q, !!shape.stiff?.includes(i)));
/** Where the prop's shadow centre falls from one lantern. */
export function shadowCentre(home: V2, lamp: V2, p: Pose): V2 {
  const k = kOf(p.d);
  return [p.x / 8 + (home[0] - lamp[0]) * (k - 1), p.y / 8 + (home[1] - lamp[1]) * (k - 1)];
}
/** Points of a prop (already turned) carried onto the screen from one lantern. */
export function toScreen(p: Pose, home: V2, lamp: V2, local: Poly): Poly {
  const k = kOf(p.d), [cx, cy] = shadowCentre(home, lamp, p);
  return local.map(([x, y]) => [cx + x * k, cy + y * k]);
}
/** The prop's shadow pieces from one lantern, in screen units. */
export const shadowPolys = (shape: ShapeDef, p: Pose, home: V2, lamp: V2): Poly[] => localPolys(shape, p).map((q) => toScreen(p, home, lamp, q));
/** Where a prop physically hangs (its centre, x and y in units, and its distance from the screen), seen from home. */
export function propPlace(home: V2, p: Pose): [number, number, number] {
  const k = kOf(p.d);
  return [home[0] + (p.x / 8 - home[0]) / k, home[1] + (p.y / 8 - home[1]) / k, depthOf(p.d)];
}
export function polyBox(poly: Poly): [number, number, number, number] {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of poly) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
  return [x0, y0, x1, y1];
}
export function polyArea(poly: Poly) { let a = 0; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) a += (poly[j][0] + poly[i][0]) * (poly[j][1] - poly[i][1]); return Math.abs(a) / 2; }
export function inPoly(poly: Poly, x: number, y: number) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// ---------------------------------------------------------------- the raster
/** A cell's state for one lantern: 0 clear, 1 blocked, 2 + mask for light through gels. */
export const gelBit = (g: Gel) => 1 << GELS.indexOf(g);
const xs = new Float64Array(256);
/** Fills a polygon into one lantern's states (even-odd, sampled at cell centres). Returns false if it misses the screen. */
export function fillPoly(st: Uint8Array, poly: Poly, gel: number) {
  const [, by0, , by1] = polyBox(poly);
  const j0 = Math.max(0, Math.ceil(by0 * RES - 0.5)), j1 = Math.min(GH - 1, Math.floor(by1 * RES - 0.5));
  const n = poly.length;
  for (let j = j0; j <= j1; j++) {
    const y = (j + 0.5) / RES; let m = 0;
    for (let i = 0, q = n - 1; i < n; q = i++) {
      const ay = poly[q][1], by = poly[i][1];
      if ((ay <= y && by > y) || (by <= y && ay > y)) { if (m < 256) xs[m++] = poly[q][0] + ((y - ay) * (poly[i][0] - poly[q][0])) / (by - ay); }
    }
    if (m < 2) continue;
    const row = xs.subarray(0, m); row.sort();
    for (let a = 0; a + 1 < m; a += 2) {
      const c0 = Math.max(0, Math.ceil(row[a] * RES - 0.5)), c1 = Math.min(GW, Math.ceil(row[a + 1] * RES - 0.5));
      const base = j * GW;
      if (!gel) for (let c = c0; c < c1; c++) st[base + c] = 1;
      else for (let c = c0; c < c1; c++) { const v = st[base + c]; if (v !== 1) st[base + c] = 2 + ((v ? v - 2 : 0) | gel); }
    }
  }
}
export interface Stage { props: { shape: ShapeId; pose: Pose; extra?: boolean }[]; lamps: LampDef[]; offs: number[] }
/** One state array per lantern for a stage; extras are left out unless asked for. */
export function rasterStates(s: Stage, withExtras = false, skip = -1): Uint8Array[] {
  const home = lampHome(s), out: Uint8Array[] = [];
  for (let li = 0; li < s.lamps.length; li++) {
    const st = new Uint8Array(GW * GH), lamp = lampAt(s.lamps[li], s.offs[li] ?? 0);
    s.props.forEach((p, i) => {
      if (i === skip || !p.pose.on || (p.extra && !withExtras)) return;
      const sh: ShapeDef = SHAPES[p.shape];
      for (const q of shadowPolys(sh, p.pose, home, lamp)) fillPoly(st, q, sh.gel ? gelBit(sh.gel) : 0);
    });
    out.push(st);
  }
  return out;
}
/** Combines the lanterns' states into one key a cell. */
export function keysOf(states: Uint8Array[]): Uint16Array {
  const out = new Uint16Array(GW * GH);
  for (let c = 0; c < out.length; c++) { let k = 0; for (let li = states.length - 1; li >= 0; li--) k = k * 34 + states[li][c]; out[c] = k; }
  return out;
}
export const rasterKeys = (s: Stage, withExtras = false) => keysOf(rasterStates(s, withExtras));
/** The generalised intersection over union of two key rasters. */
export function scoreKeys(a: Uint16Array, t: Uint16Array) {
  let inter = 0, uni = 0;
  for (let c = 0; c < a.length; c++) { const p = a[c], q = t[c]; if (p || q) { uni++; if (p === q) inter++; } }
  return uni ? inter / uni : 1;
}

// ---------------------------------------------------------------- scenes as stages
export const startStage = (S: SceneDef): Stage => ({ props: S.props.map((p) => ({ shape: p.shape, pose: clonePose(p.start), extra: p.extra })), lamps: S.lamps, offs: S.lamps.map(() => 0) });
/** The authored solution, with decoys off the rods and extras where they start. */
export const solutionStage = (S: SceneDef): Stage => ({
  props: S.props.map((p) => ({ shape: p.shape, pose: p.sol ? clonePose(p.sol) : { ...clonePose(p.start), on: false }, extra: p.extra })),
  lamps: S.lamps, offs: S.lamps.map((L) => L.sol ?? 0),
});
const targets = new Map<string, Uint16Array>();
export function targetKeys(S: SceneDef) { let t = targets.get(S.id); if (!t) { t = rasterKeys(solutionStage(S)); targets.set(S.id, t); } return t; }
export const scoreStage = (S: SceneDef, st: Stage) => scoreKeys(rasterKeys(st), targetKeys(S));
const regions = new Map<string, Int32Array[]>();
/** The cells each puppet of the solution covers on its own (any lantern): the parts of the picture. */
export function partsOf(S: SceneDef): Int32Array[] {
  let r = regions.get(S.id); if (r) return r;
  const sol = solutionStage(S); r = [];
  for (let i = 0; i < S.props.length; i++) {
    const P = S.props[i]; if (!P.sol || P.extra) continue;
    const one: Stage = { props: [sol.props[i]], lamps: sol.lamps, offs: sol.offs }, st = rasterStates(one), cells: number[] = [];
    for (let c = 0; c < GW * GH; c++) if (st.some((a) => a[c])) cells.push(c);
    if (cells.length >= 4) r.push(Int32Array.from(cells));
  }
  regions.set(S.id, r); return r;
}
export interface Fit { iou: number; cover: number; fit: number; matched: boolean }
/** How well a stage casts a scene: the overlap, the worst-covered part, a 0–1 meter that reaches 1 at a match. */
export function fitStage(S: SceneDef, st: Stage): Fit {
  const k = rasterKeys(st), t = targetKeys(S), iou = scoreKeys(k, t);
  let cover = 1;
  for (const cells of partsOf(S)) {
    let ok = 0;
    for (let n = 0; n < cells.length; n++) {
      const c = cells[n], want = t[c];
      if (k[c] === want) { ok++; continue; }
      const x = c % GW, y = (c - x) / GW;
      let near = false;
      for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= GW || yy >= GH) continue;
        if (k[yy * GW + xx] === want) { near = true; break; }
      }
      if (near) ok++;
    }
    cover = Math.min(cover, ok / cells.length);
  }
  const matched = iou >= MATCH && cover >= COVER;
  return { iou, cover, matched, fit: matched ? 1 : Math.min(0.99, iou / MATCH, cover / COVER) };
}
/** Where a released puppet clicks to: its place (or a twin's) when it is close and set the same way; else null. */
export function snapPose(S: SceneDef, i: number, p: Pose): Pose | null {
  const P = S.props[i]; if (!P || P.fixed || !p.on) return null;
  const sh: ShapeDef = SHAPES[P.shape];
  let best: Pose | null = null, bd = SNAP * 8 + 1e-9;
  for (const Q of S.props) {
    const q = Q.sol; if (Q.shape !== P.shape || !q || Q.extra !== P.extra) continue;
    if (q.d !== p.d || (!sh.round && (q.r !== p.r || q.f !== p.f)) || (sh.turn && q.t !== p.t)) continue;
    const d = Math.hypot(q.x - p.x, q.y - p.y);
    if (d > 0 && d <= bd) { bd = d; best = { ...p, x: P.rail === 'y' ? p.x : q.x, y: P.rail === 'x' ? p.y : q.y }; }
  }
  return best;
}

/** What a prop may do in a scene. */
export function canDo(S: SceneDef, i: number, tool: Tool): boolean {
  const P = S.props[i]; if (!P || P.fixed) return false;
  if (!S.tools.includes(tool)) return false;
  if (P.rail) return tool === 'move';
  if (tool === 'turn') return !!SHAPES[P.shape].turn;
  return true;
}
const clampX = (x: number) => Math.max(0, Math.min(SCREEN_W * 8, Math.round(x)));
const clampY = (y: number) => Math.max(0, Math.min(SCREEN_H * 8, Math.round(y)));

// ---------------------------------------------------------------- a performance in progress
interface Snap { poses: Pose[]; offs: number[]; last: string }
export class Show {
  readonly scene: SceneDef;
  stage: Stage;
  moves = 0;
  /** The object last picked up ('p2', 'l0'): picking up the same one again is not a new move. */
  last = '';
  private past: Snap[] = [];
  private cache: Fit | null = null;
  constructor(scene: SceneDef, poses?: Pose[] | null, offs?: number[] | null) {
    this.scene = scene;
    this.stage = startStage(scene);
    if (poses && poses.length === scene.props.length) poses.forEach((p, i) => { if (!scene.props[i].fixed) this.stage.props[i].pose = clonePose(p); });
    if (offs && offs.length === scene.lamps.length) offs.forEach((o, i) => { const m = scene.lamps[i].move; if (m && o >= m[0] && o <= m[1]) this.stage.offs[i] = o; });
  }
  get poses() { return this.stage.props.map((p) => p.pose); }
  get offs() { return this.stage.offs; }
  get canUndo() { return this.past.length > 0; }
  fit(): Fit { if (this.cache === null) this.cache = fitStage(this.scene, this.stage); return this.cache; }
  get matched() { return this.fit().matched; }
  /** Applies one change; false when it isn't allowed or changes nothing. */
  apply(op: Op): boolean {
    const S = this.scene;
    let key: string;
    if (op.k === 'lamp') {
      const L = S.lamps[op.i]; if (!L || !L.move || !S.tools.includes('lamp')) return false;
      const x = Math.max(L.move[0], Math.min(L.move[1], Math.round(op.x)));
      if (x === this.stage.offs[op.i]) return false;
      this.push(); this.stage.offs = this.stage.offs.slice(); this.stage.offs[op.i] = x; key = 'l' + op.i;
    } else {
      const P = S.props[op.i]; if (!P) return false;
      const cur = this.stage.props[op.i].pose, nx = clonePose(cur);
      switch (op.k) {
        case 'move': {
          if (!canDo(S, op.i, 'move') || !cur.on) return false;
          nx.x = P.rail === 'y' ? cur.x : clampX(op.x); nx.y = P.rail === 'x' ? cur.y : clampY(op.y); break;
        }
        case 'depth': if (!canDo(S, op.i, 'depth') || !cur.on) return false; nx.d = Math.max(0, Math.min(KS.length - 1, Math.round(op.d))); break;
        case 'rot': if (!canDo(S, op.i, 'rot') || !cur.on) return false; nx.r = ((Math.round(op.r) % ROT_STEPS) + ROT_STEPS) % ROT_STEPS; break;
        case 'flip': if (!canDo(S, op.i, 'flip') || !cur.on) return false; nx.f = cur.f ? 0 : 1; break;
        case 'turn': if (!canDo(S, op.i, 'turn') || !cur.on) return false; nx.t = Math.max(0, Math.min(TURN_STEPS, Math.round(op.t))); break;
        case 'on': if (!canDo(S, op.i, 'take')) return false; nx.on = op.on; break;
      }
      if (samePose(nx, cur)) return false;
      this.push(); this.stage.props = this.stage.props.slice(); this.stage.props[op.i] = { ...this.stage.props[op.i], pose: nx }; key = 'p' + op.i;
    }
    if (key !== this.last) { this.moves++; this.last = key; }
    this.cache = null;
    return true;
  }
  undo() {
    const s = this.past.pop(); if (!s) return false;
    this.stage = { ...this.stage, props: this.stage.props.map((p, i) => ({ ...p, pose: s.poses[i] })), offs: s.offs };
    this.last = s.last; this.cache = null; return true;
  }
  /** Back to the start; the move count starts again too. */
  reset() { this.stage = startStage(this.scene); this.past = []; this.moves = 0; this.last = ''; this.cache = null; }
  private grouping = false; private grouped = false;
  /** Starts a drag: every change until release() undoes in one step. */
  hold() { this.grouping = true; this.grouped = false; }
  release() { this.grouping = false; this.grouped = false; }
  private push() { if (this.grouping) { if (this.grouped) return; this.grouped = true; } this.past.push({ poses: this.stage.props.map((p) => clonePose(p.pose)), offs: this.stage.offs.slice(), last: this.last }); if (this.past.length > 200) this.past.shift(); }
  /** The puppet (or lantern) furthest from where it belongs, and where that is: what a hint shows. */
  hint(): { k: 'prop'; i: number; pose: Pose } | { k: 'lamp'; i: number; x: number } | null {
    const S = this.scene;
    for (let li = 0; li < S.lamps.length; li++) { const L = S.lamps[li]; if (L.move && (L.sol ?? 0) !== this.stage.offs[li]) return { k: 'lamp', i: li, x: L.sol ?? 0 }; }
    let best = -1, bd = 0;
    S.props.forEach((P, i) => {
      if (P.fixed || P.extra) return;
      const cur = this.stage.props[i].pose, want = P.sol;
      let d: number;
      if (!want) d = cur.on ? 50 : 0;
      else if (!cur.on) d = 60;
      else {
        // a twin (the same shape) may take its place
        d = Infinity;
        for (const Q of S.props) if (Q.shape === P.shape && Q.sol && !Q.extra) d = Math.min(d, poseGap(cur, Q.sol, SHAPES[P.shape]));
      }
      if (d > bd + 1e-9) { bd = d; best = i; }
    });
    if (best < 0 || bd < 0.6) return null;
    const P = S.props[best];
    return { k: 'prop', i: best, pose: P.sol ? clonePose(P.sol) : { ...clonePose(this.stage.props[best].pose), on: false } };
  }
}
/** How different two poses are (units of movement, plus weights for the other knobs). */
export function poseGap(a: Pose, b: Pose, sh: ShapeDef) {
  const dr = sh.round ? 0 : Math.min(Math.abs(a.r - b.r), ROT_STEPS - Math.abs(a.r - b.r));
  return Math.hypot(a.x - b.x, a.y - b.y) / 8 + Math.abs(a.d - b.d) * 0.8 + dr * 0.5 + (a.f !== b.f && !sh.round ? 1.5 : 0) + (sh.turn ? Math.abs(a.t - b.t) * 0.5 : 0);
}

// ---------------------------------------------------------------- stars
/** The flourish: the scene's optional third star. */
export function flourishDone(S: SceneDef, st: Stage): boolean {
  const F = S.flourish;
  if (F.k === 'perfect') return fitStage(S, st).iou >= F.min;
  if (F.k === 'depth') { const p = st.props[F.prop]?.pose; return !!p && p.on && (F.min === undefined || p.d >= F.min) && (F.max === undefined || p.d <= F.max); }
  // an extra puppet: on the rods, its shadow's middle in the zone, and mostly clear of the picture
  const p = st.props[F.prop]; if (!p || !p.pose.on) return false;
  const home = lampHome(st), lamp = lampAt(st.lamps[0], st.offs[0] ?? 0), [cx, cy] = shadowCentre(home, lamp, p.pose);
  const [x0, y0, x1, y1] = F.zone; if (cx < x0 || cx > x1 || cy < y0 || cy > y1) return false;
  const mine = new Uint8Array(GW * GH); for (const q of shadowPolys(SHAPES[p.shape], p.pose, home, lamp)) fillPoly(mine, q, 0);
  const t = targetKeys(S); let n = 0, over = 0;
  for (let c = 0; c < mine.length; c++) if (mine[c]) { n++; if (t[c]) over++; }
  return n > 0 && over <= n * 0.25;
}
export const MOVE_SLACK = 2;
export function starsFor(S: SceneDef, st: Stage, moves: number): [boolean, boolean, boolean] {
  const m = fitStage(S, st).matched;
  return [m, m && moves <= S.par + MOVE_SLACK, m && flourishDone(S, st)];
}

// ---------------------------------------------------------------- the save
export const SAVE_KEY = 'shadowplay-v1';
export interface SceneSave { done: boolean; stars: number; best: number | null }
export interface SandboxSave { props: { shape: ShapeId; pose: Pose }[]; two: boolean; offs: [number, number] }
export interface Save {
  v: 1;
  scenes: Record<string, SceneSave>;
  sandbox: SandboxSave;
  tutorial: boolean; ended: boolean;
  settings: { sound: boolean; music: boolean };
}
export const freshSandbox = (): SandboxSave => ({ props: [], two: false, offs: [0, 0] });
export const freshSave = (): Save => ({ v: 1, scenes: {}, sandbox: freshSandbox(), tutorial: false, ended: false, settings: { sound: true, music: true } });
const isObj = (o: unknown): o is Record<string, unknown> => !!o && typeof o === 'object' && !Array.isArray(o);
const int = (v: unknown, lo: number, hi: number): number | null => (typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi ? v : null);
/** A pose from a save, or null when anything about it is off. */
export function readPose(o: unknown): Pose | null {
  if (!isObj(o)) return null;
  const x = int(o.x, 0, SCREEN_W * 8), y = int(o.y, 0, SCREEN_H * 8), d = int(o.d, 0, KS.length - 1), r = int(o.r, 0, ROT_STEPS - 1), t = int(o.t, 0, TURN_STEPS);
  if (x === null || y === null || d === null || r === null || t === null || (o.f !== 0 && o.f !== 1) || typeof o.on !== 'boolean') return null;
  return { x, y, d, r, f: o.f, t, on: o.on };
}
export function readSave(raw: string | null): Save {
  const s = freshSave(); if (!raw) return s;
  try {
    const o = JSON.parse(raw) as unknown;
    if (!isObj(o) || o.v !== 1) return s;
    if (isObj(o.scenes)) for (const id of SCENE_IDS) {
      const d = o.scenes[id]; if (!isObj(d) || d.done !== true) continue;
      const stars = int(d.stars, 0, 7) ?? 1, best = int(d.best, 0, 9999);
      s.scenes[id] = { done: true, stars: stars | 1, best };
    }
    if (isObj(o.sandbox)) {
      const sb = o.sandbox;
      if (Array.isArray(sb.props)) for (const p of sb.props.slice(0, MAX_SANDBOX)) {
        if (!isObj(p) || typeof p.shape !== 'string' || !Object.prototype.hasOwnProperty.call(SHAPES, p.shape)) continue;
        const ps = readPose(p.pose); if (ps) s.sandbox.props.push({ shape: p.shape as ShapeId, pose: ps });
      }
      s.sandbox.two = sb.two === true;
      if (Array.isArray(sb.offs)) s.sandbox.offs = [int(sb.offs[0], -24, 24) ?? 0, int(sb.offs[1], -24, 24) ?? 0];
    }
    s.tutorial = o.tutorial === true; s.ended = o.ended === true;
    if (isObj(o.settings)) { s.settings.sound = o.settings.sound !== false; s.settings.music = o.settings.music !== false; }
  } catch { return freshSave(); }
  return s;
}
export const starCount = (n: number) => (n & 1) + ((n >> 1) & 1) + ((n >> 2) & 1);
export const starBits = (st: [boolean, boolean, boolean]) => (st[0] ? 1 : 0) | (st[1] ? 2 : 0) | (st[2] ? 4 : 0);
export const done = (s: Save, id: string) => !!s.scenes[id]?.done;
export const totalStars = (s: Save) => SCENE_IDS.reduce((n, id) => n + starCount(s.scenes[id]?.stars ?? 0), 0);
export const storyOf = (id: string) => STORIES[SCENES[id].story];
export const storyDone = (s: Save, story: number) => STORIES[story].scenes.every((id) => done(s, id));
export const storyCount = (s: Save, story: number) => STORIES[story].scenes.filter((id) => done(s, id)).length;
/** A story opens when the one before is performed to the end. */
export const storyOpen = (s: Save, story: number) => story === 0 || storyDone(s, story - 1);
/** In an open story a scene opens when either of the two before it is cast; the finale waits for all five. */
export function sceneOpen(s: Save, id: string): boolean {
  const S = SCENES[id]; if (!S || !storyOpen(s, S.story)) return false;
  const ids = STORIES[S.story].scenes, i = ids.indexOf(id);
  if (i === ids.length - 1) return ids.slice(0, -1).every((x) => done(s, x));
  return i === 0 || done(s, ids[i - 1]) || (i >= 2 && done(s, ids[i - 2]));
}
export const sandboxOpen = (s: Save) => storyDone(s, 0);
export const nextScene = (s: Save) => SCENE_IDS.find((id) => sceneOpen(s, id) && !done(s, id)) ?? null;
/** Records a cast scene; stars and the fewest moves only ever get better. */
export function recordScene(s: Save, id: string, stars: [boolean, boolean, boolean], moves: number) {
  const prev = s.scenes[id], bits = starBits(stars) | 1;
  const first = !prev?.done;
  const was = prev?.stars ?? 0;
  s.scenes[id] = { done: true, stars: was | bits, best: prev?.best === null || prev?.best === undefined ? moves : Math.min(prev.best, moves) };
  const last = SCENE_IDS[SCENE_IDS.length - 1];
  const finale = id === last && !s.ended;
  if (finale) s.ended = true;
  return { first, newStars: starCount(was | bits) - starCount(was), finale };
}
