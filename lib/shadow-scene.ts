// Shadowplay's drawing (Canvas 2D only). The little theatre: walnut wall, velvet curtains, a carved frame and a
// glowing paper screen, with the puppeteer's board below it (a view from above of the lanterns, the rods and the
// beams). Every shadow is drawn the way light makes it: each lantern lights its own layer, every puppet takes its
// shape (blurred more the nearer it hangs to the lantern) out of that light, coloured glass tints it instead, the
// lace holes let it through, and the layers add up on the paper. Dora and Enzo stand in the screen's margins as
// jointed shadow puppets with gel inlays, and point, cheer and bow.
import {
  SHAPES, KS, LAMP_D, SCREEN_W, SCREEN_H, ROT_STEPS, TURN_STEPS, EDGE, lampHome, lampAt, kOf, depthOf, localPts, toScreen, shadowCentre, polyBox,
  type Stage, type Pose, type ShapeDef, type Poly, type V2, type Gel, type Tone, type SceneDef, type Anim, type Ambience, type LampDef,
} from './shadow-game';
import { PICTURES, type Pen, type Kit } from './shadow-pictures';

export const GEL_RGB: Record<Gel, [number, number, number]> = { ruby: [236, 52, 84], gold: [255, 190, 50], jade: [60, 210, 140], sky: [80, 170, 255] };
const TONE_RGB: Record<Tone, [number, number, number]> = { warm: [255, 228, 178], gold: [255, 176, 62], blue: [96, 150, 255] };
const AMBIENT = 'rgb(46,26,22)';
const rgb = (c: [number, number, number], a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
/** A small fixed hash so nothing here needs Math.random. */
const hash = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const ease = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

export type Gesture = 'idle' | 'point' | 'cheer' | 'think' | 'bow' | 'talk';
export interface Rect { x: number; y: number; w: number; h: number }
export interface Layout { screen: Rect; board: Rect; s: number; frame: Rect; tall: boolean; /** The loft above the frame where Dora and Enzo stand on an upright phone (0 elsewhere). */ head: number }
export type Grab = { k: 'prop'; i: number } | { k: 'lamp'; i: number } | { k: 'rot'; i: number } | null;
export interface DrawState {
  dt: number;
  stage: Stage | null;
  scene: SceneDef | null;
  selected: number;
  /** The target (null in the sandbox and the show). */
  ghost: boolean;
  hint: { i: number; pose: Pose } | { lamp: number; x: number } | null;
  /** 0–1: how well the picture fits, for the glow round the target. */
  fit: number;
  guide: { from: V2; to: V2 } | null;
  dora: Gesture; enzo: Gesture;
  /** Seconds since the scene came alive, or −1. */
  alive: number;
  /** Seconds since the puppet under the pointer was dropped into place, for a sparkle; −1 for none. */
  snapAt: number; snapProp: number;
  amb: Ambience | null;
  board: boolean;
}

// ---------------------------------------------------------------- the puppets' outlines, cached
const localCache = new Map<string, { polys: Poly[]; holes: Poly[]; lace: Poly[] }>();
/** A puppet's pieces, holes and lace cut-outs, turned, flipped and rotated (cached by pose). */
function pieces(shapeId: string, p: Pose) {
  const key = `${shapeId}|${p.r}|${p.f}|${p.t}`;
  let c = localCache.get(key);
  if (!c) {
    const sh: ShapeDef = (SHAPES as Record<string, ShapeDef>)[shapeId];
    c = {
      polys: sh.polys.map((q, i) => localPts(sh, p, q, !!sh.stiff?.includes(i))),
      holes: (sh.holes ?? []).map((q) => localPts(sh, p, q)),
      lace: laceOf(shapeId).map((q) => localPts(sh, p, q)),
    };
    if (localCache.size > 4000) localCache.clear();
    localCache.set(key, c);
  }
  return c;
}
const laceCache = new Map<string, Poly[]>();
/** The lace: a ring of tiny holes just inside the outline, and a little flower in the middle when there is room. */
function laceOf(shapeId: string): Poly[] {
  let L = laceCache.get(shapeId); if (L) return L;
  const sh: ShapeDef = (SHAPES as Record<string, ShapeDef>)[shapeId]; L = [];
  if (sh.gel) { laceCache.set(shapeId, L); return L; }
  const inside = (x: number, y: number) => sh.polys.some((q) => inPolyLocal(q, x, y));
  const clear = (x: number, y: number, r: number) => { for (let a = 0; a < 8; a++) if (!inside(x + r * Math.cos(a * 0.785), y + r * Math.sin(a * 0.785))) return false; return inside(x, y); };
  const dot = (x: number, y: number, r: number): Poly => { const o: Poly = []; for (let a = 0; a < 7; a++) o.push([x + r * Math.cos((a / 7) * Math.PI * 2), y + r * Math.sin((a / 7) * Math.PI * 2)]); return o; };
  for (const q of sh.polys) {
    // walk the outline and set a hole every so often, nudged inwards
    let acc = 0;
    for (let i = 0; i < q.length; i++) {
      const a = q[i], b = q[(i + 1) % q.length], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      for (let t = 0; t < len; t += 0.05) {
        acc += 0.05; if (acc < 0.2) continue; acc = 0;
        const x = a[0] + ((b[0] - a[0]) * t) / len, y = a[1] + ((b[1] - a[1]) * t) / len, nx = -(b[1] - a[1]) / len, ny = (b[0] - a[0]) / len;
        for (const s of [1, -1]) { const px = x + nx * 0.16 * s, py = y + ny * 0.16 * s; if (clear(px, py, 0.1)) { L.push(dot(px, py, 0.035)); break; } }
      }
    }
  }
  // a flower in the widest open spot
  let best: V2 | null = null, br = 0;
  for (let gx = -2; gx <= 2; gx += 0.1) for (let gy = -2; gy <= 2; gy += 0.1) {
    if (!inside(gx, gy)) continue;
    let r = 0.05; while (r < 0.6 && clear(gx, gy, r)) r += 0.05;
    if (r > br) { br = r; best = [gx, gy]; }
  }
  if (best && br >= 0.3) {
    const [cx, cy] = best, R = Math.min(0.32, br * 0.55);
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2, px = cx + Math.cos(a) * R * 0.55, py = cy + Math.sin(a) * R * 0.55, o: Poly = [];
      for (let j = 0; j < 8; j++) { const t = (j / 8) * Math.PI * 2; o.push([px + Math.cos(t) * R * 0.32 * (Math.cos(a) * Math.cos(t) + Math.sin(a) * Math.sin(t) > 0 ? 1.4 : 0.8), py + Math.sin(t) * R * 0.22 + Math.cos(t) * 0]); }
      L.push(o);
    }
    L.push(dot(cx, cy, R * 0.18));
  }
  laceCache.set(shapeId, L); return L;
}
function inPolyLocal(poly: Poly, x: number, y: number) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// ---------------------------------------------------------------- animated poses for the coming-alive
interface Live { x: number; y: number; k: number; rot: number; sx: number; sy: number; px: number; py: number }
/** How an animation moves a puppet at time t: an offset, a turn about a pivot and a stretch. */
function animate(a: Anim, t: number, L: Live) {
  const w = Math.sin(((t + (a.phase ?? 0) * a.per) / a.per) * Math.PI * 2);
  switch (a.kind) {
    case 'bob': L.y += a.amp * w; break;
    case 'drift': L.x += a.amp * w; break;
    case 'sway': case 'wag': L.rot += (a.amp * Math.PI / 180) * w; L.px = a.px ?? 0; L.py = a.py ?? 0; break;
    case 'spin': L.rot += ((t / a.per) * Math.PI * 2) % (Math.PI * 2); break;
    case 'pulse': L.sx *= 1 + a.amp * (0.5 + 0.5 * w); L.sy *= 1 + a.amp * (0.5 + 0.5 * w); break;
    case 'flap': L.sy *= 1 - a.amp * (0.5 + 0.5 * w); break;
  }
}

// ---------------------------------------------------------------- the scene
export class ShadowScene {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private W = 0; private H = 0; private dpr = 1;
  inset = { top: 8, right: 8, bottom: 8, left: 8 };
  lay: Layout = { screen: { x: 0, y: 0, w: 1, h: 1 }, board: { x: 0, y: 0, w: 1, h: 1 }, s: 1, frame: { x: 0, y: 0, w: 1, h: 1 }, tall: false, head: 0 };
  /** While the scene's result card shows: the picture alone, no board, as big as the room left beside the card allows. */
  picture = false;
  // a gentle glide between layouts when the picture-only layout comes or goes
  private layFrom: Layout | null = null; private layTo: Layout | null = null; private layT = 1; private wasPicture = false;
  /** Dora and Enzo stand in the loft above the frame (an upright phone), except at the curtain call. */
  private loft() { return this.lay.head > 0 && !(this.showReel && this.reelCall() >= 0); }
  private paper: HTMLCanvasElement | null = null;
  private layers: HTMLCanvasElement[] = [];
  private mask: HTMLCanvasElement | null = null;
  private acc: HTMLCanvasElement | null = null;
  private ghostC: HTMLCanvasElement | null = null; private ghostKey = '';
  private filterOk = false;
  private time = 0;
  private aliveFrom: Stage | null = null;
  /** Light motes drifting in the beam and the ambience of a living scene. */
  private motes: { x: number; y: number; vx: number; vy: number; life: number; kind: Ambience | 'mote' | 'spark'; seed: number }[] = [];
  private moteSeed = 1;
  /** The final performance: the scenes in turn, then the curtain call. */
  showReel: { scenes: SceneDef[]; t: number } | null = null;
  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const c = canvas.getContext('2d'); if (!c) throw new Error('no 2d');
    this.ctx = c;
    this.filterOk = typeof c.filter === 'string';
    this.resize();
  }
  resize() {
    const r = this.canvas.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = Math.max(1, Math.round(r.width)), H = Math.max(1, Math.round(r.height));
    if (W !== this.W || H !== this.H || dpr !== this.dpr) {
      this.W = W; this.H = H; this.dpr = dpr;
      this.canvas.width = Math.round(W * dpr); this.canvas.height = Math.round(H * dpr);
    }
    this.layout();
  }
  /** Fits the theatre: the screen as big as it can be (16 by 9) with the board below it (none in the picture-only
   *  layout), and on an upright phone a loft above the frame for Dora and Enzo, with a deeper board. */
  layout() {
    const { top, right, bottom, left } = this.inset, aw = this.W - left - right, ah = this.H - top - bottom;
    const tall = aw < ah * 0.9, short = !tall && ah < 420, pic = this.picture;
    // the frame's margin above and below the screen and board, and the curtains at the sides
    const pad = tall ? 4 : short ? 6 : 14, curtain = tall ? 6 : Math.max(short ? 14 : 18, aw * 0.05);
    const boardRatio = pic ? 0 : tall ? 0.5 : short ? 0.17 : 0.2, boardMin = pic ? 0 : short ? 34 : 46, gap = pic ? 0 : tall ? 10 : short ? 6 : 12;
    const loft = (h: number) => (tall ? Math.min(200, h * 0.95, ah * 0.3) : 0);
    let sw = aw - curtain * 2, sh = (sw * 9) / 16;
    const need = (h: number) => loft(h) + h + Math.max(boardMin, h * boardRatio) + gap + pad * 2;
    if (need(sh) > ah) { let lo = 40, hi = sh; for (let n = 0; n < 30; n++) { const m = (lo + hi) / 2; if (need(m) > ah) hi = m; else lo = m; } sh = lo; sw = (sh * 16) / 9; }
    const head = loft(sh), bh = Math.max(boardMin, sh * boardRatio), total = sh + gap + bh;
    const x = left + (aw - sw) / 2, y = top + head + Math.max(pad, (ah - total - head) / 2);
    const next: Layout = { screen: { x, y, w: sw, h: sh }, board: { x, y: y + sh + gap, w: sw, h: bh }, s: sw / SCREEN_W, frame: { x: x - curtain, y: y - pad, w: sw + curtain * 2, h: total + pad * 2 }, tall, head };
    // the picture-only layout glides in (its buffers wait until the glide ends); everything else snaps
    if (pic && !this.wasPicture && this.layTo) { this.layFrom = this.lay; this.layT = 0; }
    else if (!pic) this.layT = 1;
    this.wasPicture = pic; this.layTo = next;
    if (this.layT < 1) return;
    this.lay = next;
    this.buffers();
  }
  /** Steps the glide between layouts. */
  private glide(dt: number) {
    if (this.layT >= 1 || !this.layFrom || !this.layTo) return;
    this.layT = Math.min(1, this.layT + dt / 0.6);
    const e = ease(this.layT), A = this.layFrom, B = this.layTo, m = (a: number, b: number) => a + (b - a) * e;
    const r = (a: Rect, b: Rect): Rect => ({ x: m(a.x, b.x), y: m(a.y, b.y), w: m(a.w, b.w), h: m(a.h, b.h) });
    this.lay = { screen: r(A.screen, B.screen), board: r(A.board, B.board), s: m(A.s, B.s), frame: r(A.frame, B.frame), tall: B.tall, head: m(A.head, B.head) };
    if (this.layT >= 1) { this.lay = B; this.buffers(); }
  }
  /** The paper and the light buffers, made for the screen's size. */
  private buffers() {
    const sw = this.lay.screen.w, sh = this.lay.screen.h;
    const pw = Math.max(1, Math.round(sw * this.dpr)), ph = Math.max(1, Math.round(sh * this.dpr));
    if (!this.paper || this.paper.width !== pw || this.paper.height !== ph) {
      this.paper = this.makePaper(pw, ph);
      this.layers = [0, 1].map(() => this.blank(pw, ph)); this.mask = this.blank(pw, ph); this.acc = this.blank(pw, ph); this.ghostC = this.blank(pw, ph); this.ghostKey = '';
    }
  }
  private blank(w: number, h: number) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  /** The paper: warm and fibrous, a little mottled, made once for each size. */
  private makePaper(w: number, h: number) {
    const c = this.blank(w, h), g = c.getContext('2d')!;
    g.fillStyle = '#f7e2b4'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) {
      const x = hash(i) * w, y = hash(i + 999) * h, r = (0.04 + hash(i + 3) * 0.12) * Math.max(w, h);
      const gr = g.createRadialGradient(x, y, 0, x, y, r); const dark = hash(i + 7) < 0.5;
      gr.addColorStop(0, dark ? 'rgba(170,120,60,0.035)' : 'rgba(255,250,235,0.05)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    g.lineCap = 'round';
    for (let i = 0; i < Math.round((w * h) / 900); i++) {
      const x = hash(i * 3 + 1) * w, y = hash(i * 7 + 2) * h, a = hash(i * 11 + 5) * Math.PI, l = (4 + hash(i * 13) * 22) * (w / 1200 + 0.4);
      g.strokeStyle = hash(i * 17) < 0.6 ? 'rgba(150,100,50,0.07)' : 'rgba(255,255,240,0.12)'; g.lineWidth = 0.6 + hash(i * 19) * 0.8;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a + 0.4) * l * 0.5, y + Math.sin(a + 0.4) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
    // the paper's seams, like a screen glued from long sheets
    for (let i = 1; i < 4; i++) { const x = (i / 4) * w; g.fillStyle = 'rgba(160,110,60,0.06)'; g.fillRect(x - 1, 0, 2, h); }
    return c;
  }
  // ---------------------------------------------------------------- coordinates
  sx(u: number) { return this.lay.screen.x + u * this.lay.s; }
  sy(v: number) { return this.lay.screen.y + v * this.lay.s; }
  toUnits(px: number, py: number): V2 { return [(px - this.lay.screen.x) / this.lay.s, (py - this.lay.screen.y) / this.lay.s]; }
  inScreen(px: number, py: number) { const r = this.lay.screen; return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h; }
  inBoard(px: number, py: number) { const r = this.lay.board; return px >= r.x - 8 && px <= r.x + r.w + 8 && py >= r.y - 6 && py <= r.y + r.h + 6; }
  /** The board's y for a distance from the screen (0 at the top edge, the lanterns at the bottom). */
  boardY(z: number) { const b = this.lay.board; return b.y + 8 + (z / LAMP_D) * (b.h - 20); }
  /** The depth notch nearest a board y. */
  notchAt(py: number) { let best = 0, bd = Infinity; KS.forEach((_, d) => { const dd = Math.abs(this.boardY(depthOf(d)) - py); if (dd < bd) { bd = dd; best = d; } }); return best; }
  /** Screen-space shadow outlines of a puppet from each lantern. */
  shadowOf(st: Stage, i: number, pose?: Pose): Poly[][] {
    const p = st.props[i], ps = pose ?? p.pose, home = lampHome(st), pc = pieces(p.shape, ps);
    return st.lamps.map((L, li) => pc.polys.map((q) => toScreen(ps, home, lampAt(L, st.offs[li] ?? 0), q)));
  }
  /** The puppet whose shadow is under a point (the selected one first), or −1. */
  hitProp(st: Stage, px: number, py: number, selected: number, scene: SceneDef | null): number {
    const [u, v] = this.toUnits(px, py), pad = 10 / this.lay.s;
    const order = st.props.map((_, i) => i).reverse(); if (selected >= 0) { order.splice(order.indexOf(selected), 1); order.unshift(selected); }
    for (const pass of [0, 1]) for (const i of order) {
      if (!st.props[i].pose.on || scene?.props[i]?.fixed) continue;
      for (const polys of this.shadowOf(st, i)) for (const q of polys) {
        if (inPolyLocal(q, u, v)) return i;
        if (pass === 1) { const b = polyBox(q); if (u > b[0] - pad && u < b[2] + pad && v > b[1] - pad && v < b[3] + pad && distToPoly(q, u, v) < pad) return i; }
      }
    }
    return -1;
  }
  /** Where the round handle for turning a puppet sits. */
  rotHandle(st: Stage, i: number): V2 | null {
    if (i < 0 || !st.props[i]?.pose.on) return null;
    const polys = this.shadowOf(st, i)[0]; let y0 = Infinity, x0 = Infinity, x1 = -Infinity;
    for (const q of polys) { const b = polyBox(q); y0 = Math.min(y0, b[1]); x0 = Math.min(x0, b[0]); x1 = Math.max(x1, b[2]); }
    const hx = this.sx((x0 + x1) / 2), hy = Math.max(this.lay.screen.y + 14, this.sy(y0) - 26);
    return [hx, hy];
  }
  /** Something on the board under a point: a lantern or a puppet's rod. */
  hitBoard(st: Stage, scene: SceneDef | null, px: number, py: number, lampsMove: boolean): Grab {
    if (!this.inBoard(px, py)) return null;
    const home = lampHome(st);
    if (lampsMove) for (let li = 0; li < st.lamps.length; li++) {
      const L = st.lamps[li]; if (!L.move && !scene?.id.startsWith('sandbox')) continue;
      const [lx] = lampAt(L, st.offs[li] ?? 0); if (Math.hypot(this.sx(lx) - px, this.boardY(LAMP_D) - py) < 26) return { k: 'lamp', i: li };
    }
    let best = -1, bd = 22;
    st.props.forEach((p, i) => {
      if (!p.pose.on || scene?.props[i]?.fixed) return;
      const [x, , z] = this.place(home, p, i, st), bx = this.sx(x), by = this.boardY(z);
      const half = Math.max(8, (this.widthOf(p.shape, p.pose) / 2) * this.lay.s);
      const d = Math.abs(py - by) < 14 && Math.abs(px - bx) < half + 6 ? Math.abs(py - by) : Infinity;
      if (d < bd) { bd = d; best = i; }
    });
    return best >= 0 ? { k: 'prop', i: best } : null;
  }
  private place(home: V2, p: { pose: Pose }, _i: number, _st: Stage): [number, number, number] {
    const k = kOf(p.pose.d);
    return [home[0] + (p.pose.x / 8 - home[0]) / k, home[1] + (p.pose.y / 8 - home[1]) / k, depthOf(p.pose.d)];
  }
  private widthOf(shape: string, p: Pose) { const pc = pieces(shape, p); let x0 = Infinity, x1 = -Infinity; for (const q of pc.polys) { const b = polyBox(q); x0 = Math.min(x0, b[0]); x1 = Math.max(x1, b[2]); } return x1 - x0; }

  // ---------------------------------------------------------------- drawing
  draw(d: DrawState) {
    this.time += d.dt;
    this.glide(d.dt);
    const c = this.ctx, { W, H, dpr } = this;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.drawTheatre(c);
    const st = this.showReel ? this.reelStage() : d.stage;
    const sc = this.showReel ? this.reelScene() : d.scene;
    // the coming-alive: each puppet glides to its place in the picture, then moves
    let shown = st;
    const aliveT = this.showReel ? this.reelAlive() : d.alive;
    if (st && sc && aliveT >= 0) shown = this.aliveStage(st, sc, aliveT);
    else this.aliveFrom = null;
    this.drawScreen(c, d, shown, sc, aliveT);
    if (d.board && st && !this.showReel && !this.picture) this.drawBoard(c, d, st, sc);
    if (this.loft()) this.drawNarrators(c, d, aliveT, true);
    this.drawMotes(c, d, aliveT, sc);
    if (this.showReel) this.drawAudience(c, aliveT);
    void W; void H;
  }

  private drawTheatre(c: CanvasRenderingContext2D) {
    const { W, H } = this, F = this.lay.frame, S = this.lay.screen;
    // the dark wooden wall
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#24130f'); g.addColorStop(0.6, '#1a0d0b'); g.addColorStop(1, '#120807'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    // the screen's light on the room
    const glow = c.createRadialGradient(S.x + S.w / 2, S.y + S.h / 2, S.h * 0.2, S.x + S.w / 2, S.y + S.h / 2, Math.max(W, H) * 0.75);
    glow.addColorStop(0, 'rgba(255,170,80,0.22)'); glow.addColorStop(1, 'rgba(255,140,60,0)'); c.fillStyle = glow; c.fillRect(0, 0, W, H);
    // planks
    c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 1;
    for (let x = (W % 46) / 2; x < W; x += 46) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); }
    // the carved frame round the screen and the board
    const fx = F.x - 8, fy = F.y - 8, fw = F.w + 16, fh = F.h + 16;
    const wood = c.createLinearGradient(fx, fy, fx, fy + fh); wood.addColorStop(0, '#6b3a1c'); wood.addColorStop(0.5, '#4a2410'); wood.addColorStop(1, '#3a1a0a');
    c.fillStyle = wood; roundRect(c, fx, fy, fw, fh, 14); c.fill();
    c.strokeStyle = '#c8913a'; c.lineWidth = 2; roundRect(c, fx + 5, fy + 5, fw - 10, fh - 10, 10); c.stroke();
    // little carved scallops along the top
    c.fillStyle = '#7a4520';
    const n = Math.max(6, Math.round(fw / 34));
    for (let i = 0; i < n; i++) { const x = fx + (i + 0.5) * (fw / n); c.beginPath(); c.arc(x, fy + 2, fw / n / 2.4, Math.PI, 0); c.fill(); }
    // velvet curtains at both sides
    if (!this.lay.tall) for (const side of [0, 1]) {
      const cw = Math.max(16, S.x - F.x + 6), x0 = side ? S.x + S.w - 6 : F.x;
      const cg = c.createLinearGradient(x0, 0, x0 + cw, 0);
      for (let k = 0; k <= 6; k++) cg.addColorStop(k / 6, k % 2 ? '#8e1c26' : '#5a0d16');
      c.fillStyle = cg; c.beginPath(); c.moveTo(x0, F.y - 6);
      c.lineTo(x0 + cw, F.y - 6);
      const tieY = S.y + S.h * 0.62;
      if (side) { c.quadraticCurveTo(x0 + cw * 0.15, tieY - S.h * 0.25, x0 + cw * 0.55, tieY); c.lineTo(x0 + cw, F.y + F.h); c.lineTo(x0, F.y + F.h); c.quadraticCurveTo(x0 + cw * 0.3, tieY + 20, x0 + cw * 0.3, tieY); c.quadraticCurveTo(x0, tieY - S.h * 0.2, x0, F.y - 6); }
      else { c.lineTo(x0 + cw, F.y - 6); c.quadraticCurveTo(x0 + cw * 0.85, tieY - S.h * 0.25, x0 + cw * 0.45, tieY); c.lineTo(x0 + cw * 0.7, F.y + F.h); c.lineTo(x0, F.y + F.h); }
      c.closePath(); c.fill();
      // the gold rope
      c.strokeStyle = '#e0b04a'; c.lineWidth = 3; c.beginPath(); const rx = side ? x0 + cw * 0.5 : x0 + cw * 0.5; c.moveTo(rx - 8, tieY - 4); c.lineTo(rx + 8, tieY + 4); c.stroke();
      c.fillStyle = '#e0b04a'; c.beginPath(); c.arc(rx, tieY, 4, 0, Math.PI * 2); c.fill();
    }
    // the valance with its fringe
    const vh = this.lay.tall ? 0 : Math.max(10, S.y - F.y - 2);
    if (vh > 4) {
      const vg = c.createLinearGradient(0, F.y - 10, 0, F.y + vh); vg.addColorStop(0, '#7a1520'); vg.addColorStop(1, '#4d0a12');
      c.fillStyle = vg; c.beginPath(); c.moveTo(F.x - 8, F.y - 10); c.lineTo(F.x + F.w + 8, F.y - 10);
      const m = Math.max(5, Math.round(F.w / 70));
      for (let i = m; i >= 0; i--) { const x = F.x + (i / m) * F.w; c.quadraticCurveTo(x + F.w / m / 2, F.y + vh + 6, x, F.y + vh - 2); }
      c.closePath(); c.fill();
      c.fillStyle = '#e8b84e';
      for (let i = 0; i <= m; i++) { const x = F.x + (i / m) * F.w; c.beginPath(); c.moveTo(x - 2, F.y + vh - 2); c.lineTo(x + 2, F.y + vh - 2); c.lineTo(x, F.y + vh + 9); c.fill(); }
    }
  }

  /** The glowing paper with its shadows, the target, the narrators and the guides. */
  private drawScreen(c: CanvasRenderingContext2D, d: DrawState, st: Stage | null, sc: SceneDef | null, aliveT: number) {
    const S = this.lay.screen, pw = this.paper!.width, ph = this.paper!.height, k = pw / S.w;
    const acc = this.acc!, a = acc.getContext('2d')!;
    const flick = 1 + 0.025 * Math.sin(this.time * 7.3) + 0.015 * Math.sin(this.time * 13.1);
    const lit = aliveT >= 0 ? 1 + 0.12 * ease(Math.min(1, aliveT / 0.8)) : 1;
    a.setTransform(1, 0, 0, 1, 0, 0); a.globalCompositeOperation = 'source-over'; a.filter = 'none';
    a.fillStyle = AMBIENT; a.fillRect(0, 0, pw, ph);
    // the coming-alive: the shadows sharpen into focus and the picture is finished by hand
    const pic = st && sc && aliveT >= 0 ? PICTURES[sc.id] : undefined;
    this.crisp = aliveT >= 0 ? 1 - 0.8 * ease((aliveT - 0.45) / 0.7) : 1;
    this.artA = pic ? ease((aliveT - 0.55) / 0.65) : 0;
    this.underAt = -1;
    if (pic?.under && st && this.artA > 0) {
      const art = this.artC && this.artC.width === pw && this.artC.height === ph ? this.artC : (this.artC = this.blank(pw, ph));
      const ag = art.getContext('2d')!; ag.setTransform(1, 0, 0, 1, 0, 0); ag.clearRect(0, 0, pw, ph);
      const s = this.lay.s * k;
      pic.under.draw(this.kit(ag, st, aliveT, (u, v) => [u * s, v * s], s));
      this.underAt = pic.under.after;
    }
    const lamps: LampDef[] = st ? st.lamps : [{ x: 8, y: 4.5, tone: 'warm' }];
    lamps.forEach((L, li) => {
      const layer = this.layers[li] ?? (this.layers[li] = this.blank(pw, ph)), g = layer.getContext('2d')!;
      const [lx, ly] = st ? lampAt(L, st.offs[li] ?? 0) : [L.x, L.y];
      this.lightLayer(g, layer, L.tone, lamps.length, lx, ly, k, flick * lit);
      if (st) this.castShadows(g, st, li, k, lamps.length);
      a.globalCompositeOperation = 'lighter'; a.drawImage(layer, 0, 0);
    });
    // the paper takes the light
    c.save();
    c.beginPath(); c.rect(S.x, S.y, S.w, S.h); c.clip();
    c.drawImage(this.paper!, S.x, S.y, S.w, S.h);
    if (d.ghost && st && sc && aliveT < 0) this.drawGhost(c, sc, d.fit);
    c.globalCompositeOperation = 'multiply'; c.drawImage(acc, S.x, S.y, S.w, S.h); c.globalCompositeOperation = 'source-over';
    if (d.ghost && st && sc && aliveT < 0) this.drawGhostEdge(c, sc, d.fit);
    if (pic?.over && st && this.artA > 0) { c.save(); c.globalAlpha = this.artA; pic.over(this.kit(c, st, aliveT, (u, v) => [this.sx(u), this.sy(v)], this.lay.s)); c.restore(); }
    // a soft vignette at the paper's edges
    const v = c.createRadialGradient(S.x + S.w / 2, S.y + S.h / 2, S.h * 0.45, S.x + S.w / 2, S.y + S.h / 2, S.w * 0.62);
    v.addColorStop(0, 'rgba(60,20,0,0)'); v.addColorStop(1, 'rgba(60,20,0,0.28)'); c.fillStyle = v; c.fillRect(S.x, S.y, S.w, S.h);
    if (st && aliveT < 0 && !this.showReel) this.drawSelection(c, d, st, sc);
    if (!this.loft()) this.drawNarrators(c, d, aliveT, false);
    if (d.guide && aliveT < 0) this.drawGuide(c, d.guide);
    c.restore();
    // the frame's inner lip
    c.strokeStyle = '#2a1408'; c.lineWidth = 4; c.strokeRect(S.x - 2, S.y - 2, S.w + 4, S.h + 4);
    c.strokeStyle = 'rgba(232,184,78,0.7)'; c.lineWidth = 1.5; c.strokeRect(S.x - 5, S.y - 5, S.w + 10, S.h + 10);
  }
  /** One lantern's light on the paper: brightest where it shines straight through, softer at the edges. */
  private lightLayer(g: CanvasRenderingContext2D, layer: HTMLCanvasElement, tone: Tone, n: number, lx: number, ly: number, k: number, gain: number) {
    const w = layer.width, h = layer.height, s = this.lay.s * k;
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.filter = 'none';
    const col = n > 1 ? TONE_RGB[tone] : TONE_RGB.warm, f = (n > 1 ? 0.72 : 1) * gain;
    const gr = g.createRadialGradient(lx * s, ly * s, 0, lx * s, ly * s, Math.max(w, h) * 0.85);
    gr.addColorStop(0, rgb([Math.min(255, col[0] * f * 1.08), Math.min(255, col[1] * f * 1.08), Math.min(255, col[2] * f * 1.08)]));
    gr.addColorStop(1, rgb([col[0] * f * 0.62, col[1] * f * 0.6, col[2] * f * 0.6]));
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }
  /** Takes every puppet's shadow out of one lantern's light (or tints it, for glass). */
  private castShadows(g: CanvasRenderingContext2D, st: Stage, li: number, k: number, n: number) {
    const under = this.underAt;
    const m = this.mask!, mg = m.getContext('2d')!, s = this.lay.s * k, home = lampHome(st), lamp = lampAt(st.lamps[li], st.offs[li] ?? 0);
    for (let i = 0; i < st.props.length; i++) {
      const p = st.props[i]; if (!p.pose.on) continue;
      const sh: ShapeDef = (SHAPES as Record<string, ShapeDef>)[p.shape], pc = this.livePieces(p.shape, p.pose, i);
      const kk = this.liveK(p.pose, i), [cx, cy] = this.liveCentre(home, lamp, p.pose, i);
      const tr = (q: Poly) => q.map(([x, y]) => [(cx + x * kk) * s, (cy + y * kk) * s] as V2);
      const blur = Math.max(0, (kk - 1) * 0.055 * s) * this.crisp;
      mg.setTransform(1, 0, 0, 1, 0, 0); mg.globalCompositeOperation = 'source-over'; mg.filter = 'none'; mg.clearRect(0, 0, m.width, m.height);
      mg.fillStyle = sh.gel ? rgb(GEL_RGB[sh.gel]) : '#000';
      mg.beginPath(); for (const q of pc.polys) path(mg, tr(q)); mg.fill('nonzero');
      if (sh.gel) {
        // glass sits in a thin leather frame
        mg.strokeStyle = '#000'; mg.lineWidth = Math.max(1, 0.025 * s * kk); mg.beginPath(); for (const q of pc.polys) path(mg, tr(q)); mg.stroke();
      }
      // the lace and the holes let the light back through
      mg.globalCompositeOperation = 'destination-out';
      mg.beginPath(); for (const q of pc.holes) path(mg, tr(q)); for (const q of pc.lace) path(mg, tr(q)); mg.fill();
      if (this.filterOk && blur > 0.6) g.filter = `blur(${blur.toFixed(1)}px)`;
      if (sh.gel) {
        g.globalCompositeOperation = 'multiply'; g.drawImage(m, 0, 0);
        // the leather frame still blocks
        mg.globalCompositeOperation = 'source-in'; mg.fillStyle = '#000'; mg.fillRect(0, 0, m.width, m.height);
        mg.globalCompositeOperation = 'destination-out'; mg.beginPath(); for (const q of pc.polys) path(mg, tr(q)); mg.lineWidth = 0; mg.fill();
        mg.globalCompositeOperation = 'source-over'; mg.strokeStyle = '#000'; mg.lineWidth = Math.max(1, 0.025 * s * kk); mg.beginPath(); for (const q of pc.polys) path(mg, tr(q)); mg.stroke();
        g.globalCompositeOperation = 'destination-out'; g.drawImage(m, 0, 0);
      } else { g.globalCompositeOperation = 'destination-out'; g.drawImage(m, 0, 0); }
      g.filter = 'none'; g.globalCompositeOperation = 'source-over';
      if (under === i && this.artC && this.artA > 0) {
        // the finished picture's painted part, lit by this lantern's share of the light
        g.save(); g.globalAlpha = this.artA; if (this.filterOk && n > 1) g.filter = `brightness(${(1 / n).toFixed(3)})`;
        g.drawImage(this.artC, 0, 0); g.restore();
      }
    }
  }
  // the living stage: its puppets with their animation applied (set by aliveStage)
  private live: (Live | null)[] = [];
  private livePieces(shape: string, p: Pose, i: number) {
    const L = this.live[i], base = pieces(shape, p);
    if (!L || (L.rot === 0 && L.sx === 1 && L.sy === 1)) return base;
    const f = (q: Poly) => q.map((v) => this.liveMove(i, v));
    return { polys: base.polys.map(f), holes: base.holes.map(f), lace: base.lace.map(f) };
  }
  /** A turned outline point carried by the puppet's living animation (its sway, pulse or flap). */
  private liveMove(i: number, [x, y]: V2): V2 {
    const L = this.live[i]; if (!L || (L.rot === 0 && L.sx === 1 && L.sy === 1)) return [x, y];
    const c = Math.cos(L.rot), s = Math.sin(L.rot), u = (x - L.px) * L.sx, v = (y - L.py) * L.sy;
    return [L.px + u * c - v * s, L.py + u * s + v * c];
  }
  // the finished picture: how much of it shows, where its painted part goes, and the canvas it is painted on
  private crisp = 1; private artA = 0; private underAt = -1; private artC: HTMLCanvasElement | null = null;
  /** The hand that finishes a picture: pens tied to each puppet, drawing in its outline units onto a canvas. */
  private kit(c: CanvasRenderingContext2D, st: Stage, aliveT: number, toPx: (u: number, v: number) => V2, unit: number): Kit {
    const home = lampHome(st);
    return {
      on: (i, draw, opts = {}) => {
        const prop = st.props[i]; if (!prop || !prop.pose.on) return;
        const sh: ShapeDef = (SHAPES as Record<string, ShapeDef>)[prop.shape], pose = prop.pose, kk = this.liveK(pose, i);
        const r0 = opts.r0 ? (-opts.r0 * Math.PI * 2) / ROT_STEPS : 0, c0 = Math.cos(r0), s0 = Math.sin(r0);
        const centres: V2[] = [];
        for (const L of opts.each ? st.lamps.map((L, li) => lampAt(L, st.offs[li] ?? 0)) : [home]) {
          const C = this.liveCentre(home, L, pose, i);
          if (!centres.some((q) => Math.hypot(q[0] - C[0], q[1] - C[1]) < 0.03)) centres.push(C);
        }
        for (const C of centres) {
          const posed = (q: V2): V2 => { const [x, y] = this.liveMove(i, q); return toPx(C[0] + x * kk, C[1] + y * kk); };
          const at = ([x, y]: V2): V2 => posed(localPts(sh, pose, [[x * c0 - y * s0, x * s0 + y * c0]])[0]);
          const trace = (pts: V2[], posedPts = false) => { c.beginPath(); pts.forEach((q, n) => { const [X, Y] = posedPts ? posed(q) : at(q); if (n) c.lineTo(X, Y); else c.moveTo(X, Y); }); };
          const ring = (x: number, y: number, rx: number, ry: number, rot: number): V2[] => { const o: V2[] = [], cr = Math.cos(rot), sr = Math.sin(rot); for (let n = 0; n < 20; n++) { const a = (n / 20) * Math.PI * 2, u = Math.cos(a) * rx, v = Math.sin(a) * ry; o.push([x + u * cr - v * sr, y + u * sr + v * cr]); } return o; };
          const pen: Pen = {
            t: Math.max(0, aliveT - 0.7),
            fill: (pts, col) => { trace(pts); c.closePath(); c.fillStyle = col; c.fill(); },
            line: (pts, w, col) => { trace(pts); c.strokeStyle = col; c.lineWidth = Math.max(0.6, w * kk * unit); c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke(); },
            dot: (x, y, r, col) => { trace(ring(x, y, r, r, 0)); c.closePath(); c.fillStyle = col; c.fill(); },
            oval: (x, y, rx, ry, rot, col) => { trace(ring(x, y, rx, ry, rot)); c.closePath(); c.fillStyle = col; c.fill(); },
            self: (col) => { c.beginPath(); for (const q of pieces(prop.shape, pose).polys) { q.forEach((v, n) => { const [X, Y] = posed(v); if (n) c.lineTo(X, Y); else c.moveTo(X, Y); }); c.closePath(); } c.fillStyle = col; c.fill('nonzero'); },
            glow: (x, y, r, stops) => {
              const [X, Y] = at([x, y]), R = Math.max(1, r * kk * unit), g = c.createRadialGradient(X, Y, 0, X, Y, R);
              for (const [o, col] of stops) g.addColorStop(o, col);
              c.fillStyle = g; c.beginPath(); c.arc(X, Y, R, 0, Math.PI * 2); c.fill();
            },
            clip: (pts) => { c.save(); trace(pts); c.closePath(); c.clip(); },
            unclip: () => c.restore(),
          };
          draw(pen);
        }
      },
    };
  }
  private liveK(p: Pose, i: number) { return this.live[i]?.k ?? kOf(p.d); }
  private liveCentre(home: V2, lamp: V2, p: Pose, i: number): V2 {
    const L = this.live[i]; if (!L) return shadowCentre(home, lamp, p);
    return [L.x + (home[0] - lamp[0]) * (L.k - 1), L.y + (home[1] - lamp[1]) * (L.k - 1)];
  }
  /** The stage as it is drawn while the scene comes alive: puppets glide to the picture's places, then move. */
  private aliveStage(st: Stage, sc: SceneDef, t: number): Stage {
    if (!this.aliveFrom) this.aliveFrom = { ...st, props: st.props.map((p) => ({ ...p, pose: { ...p.pose } })), offs: st.offs.slice() };
    const from = this.aliveFrom, glide = ease(Math.min(1, t / 0.7));
    const used = new Set<number>();
    this.live = st.props.map((p, i) => {
      const P = sc.props[i]; const f = from.props[i]?.pose ?? p.pose;
      let to: Pose | null = P?.extra ? f : null;
      if (!to && P) {
        if (P.sol === null) to = { ...f, on: false };
        else {
          // the nearest twin's place
          let bj = -1, bd = Infinity;
          sc.props.forEach((Q, j) => { if (Q.shape !== P.shape || !Q.sol || Q.extra || used.has(j)) return; const dd = Math.hypot(Q.sol.x - f.x, Q.sol.y - f.y) + Math.abs(Q.sol.d - f.d) * 4; if (dd < bd) { bd = dd; bj = j; } });
          if (bj >= 0) { used.add(bj); to = sc.props[bj].sol!; } else to = f;
        }
      }
      if (!to) return null;
      const L: Live = { x: (f.x + (to.x - f.x) * glide) / 8, y: (f.y + (to.y - f.y) * glide) / 8, k: kOf(f.d) + (kOf(to.d) - kOf(f.d)) * glide, rot: 0, sx: 1, sy: 1, px: 0, py: 0 };
      // turn the outline from where it was to where it belongs
      let dr = ((to.r - f.r) % ROT_STEPS + ROT_STEPS) % ROT_STEPS; if (dr > ROT_STEPS / 2) dr -= ROT_STEPS;
      if (to.r !== f.r || to.f !== f.f || to.t !== f.t) { if (glide < 1) L.rot = -dr * (1 - glide) * (Math.PI * 2 / ROT_STEPS); }
      if (t > 0.7) for (const A of sc.alive) if (A.prop === i) animate(A, t - 0.7, L);
      return L;
    });
    const offs = st.offs.map((o, li) => { const want = sc.lamps[li]?.sol ?? 0; return o + (want - o) * glide; });
    return {
      ...st, offs,
      props: st.props.map((p, i) => {
        const P = sc.props[i], f = from.props[i]?.pose ?? p.pose;
        const goes = P && P.sol === null && !P.extra;
        const tp = glide >= 1 && P ? (P.extra ? f : P.sol ?? { ...f, on: false }) : f;
        return { ...p, pose: { ...f, r: glide >= 1 ? tp.r : f.r, f: glide >= 1 ? tp.f : f.f, t: glide >= 1 ? tp.t : f.t, on: goes ? glide < 0.5 && f.on : f.on || (!!P?.sol && glide > 0.5) } };
      }),
    };
  }
  /** The target: a faint picture of what the shadows should make, drawn into the paper. */
  private drawGhost(c: CanvasRenderingContext2D, sc: SceneDef, fit: number) {
    const key = sc.id + '|' + this.paper!.width;
    if (key !== this.ghostKey) this.makeGhost(sc, key);
    const S = this.lay.screen;
    c.save(); c.globalAlpha = 0.34 + 0.12 * fit; c.globalCompositeOperation = 'multiply'; c.drawImage(this.ghostC!, S.x, S.y, S.w, S.h); c.restore();
  }
  private ghostEdgeC: HTMLCanvasElement | null = null;
  private drawGhostEdge(c: CanvasRenderingContext2D, sc: SceneDef, fit: number) {
    if (!this.ghostEdgeC) return;
    const S = this.lay.screen, pulse = 0.5 + 0.5 * Math.sin(this.time * 2.4);
    c.save(); c.globalAlpha = 0.7 + 0.3 * pulse; c.drawImage(this.ghostEdgeC, S.x, S.y, S.w, S.h); c.restore();
    void sc;
  }
  /** Draws the target once: its light and shadow (for the faint picture) and a glowing dotted outline. */
  private makeGhost(sc: SceneDef, key: string) {
    this.ghostKey = key;
    const g = this.ghostC!, gg = g.getContext('2d')!, pw = g.width, ph = g.height, k = pw / this.lay.screen.w, s = this.lay.s * k;
    const sol: Stage = { props: sc.props.map((P) => ({ shape: P.shape, pose: P.sol ? P.sol : { ...P.start, on: false }, extra: P.extra })), lamps: sc.lamps, offs: sc.lamps.map((L) => L.sol ?? 0) };
    // the target's light, without blur or lace, as a gentle tint
    gg.setTransform(1, 0, 0, 1, 0, 0); gg.globalCompositeOperation = 'source-over'; gg.fillStyle = '#fff'; gg.fillRect(0, 0, pw, ph);
    const home = lampHome(sol), n = sol.lamps.length;
    const layer = this.blank(pw, ph), lg = layer.getContext('2d')!;
    const accum = this.blank(pw, ph), ag = accum.getContext('2d')!; ag.fillStyle = '#3a2a24'; ag.fillRect(0, 0, pw, ph);
    sol.lamps.forEach((L, li) => {
      const lamp = lampAt(L, sol.offs[li]);
      const col = n > 1 ? TONE_RGB[L.tone] : [255, 255, 255] as [number, number, number];
      lg.globalCompositeOperation = 'source-over'; lg.fillStyle = rgb(n > 1 ? [col[0] * 0.75, col[1] * 0.75, col[2] * 0.75] : col); lg.fillRect(0, 0, pw, ph);
      sol.props.forEach((p) => {
        if (!p.pose.on || p.extra) return;
        const sh: ShapeDef = (SHAPES as Record<string, ShapeDef>)[p.shape], pc = pieces(p.shape, p.pose), kk = kOf(p.pose.d), [cx, cy] = shadowCentre(home, lamp, p.pose);
        lg.globalCompositeOperation = sh.gel ? 'multiply' : 'destination-out'; lg.fillStyle = sh.gel ? rgb(GEL_RGB[sh.gel]) : '#000';
        lg.beginPath(); for (const q of pc.polys) path(lg, q.map(([x, y]) => [(cx + x * kk) * s, (cy + y * kk) * s] as V2)); lg.fill('nonzero');
      });
      ag.globalCompositeOperation = 'lighter'; ag.drawImage(layer, 0, 0);
    });
    gg.drawImage(accum, 0, 0);
    // a dotted golden outline round the whole picture
    const mask = this.blank(pw, ph), mg = mask.getContext('2d')!;
    mg.fillStyle = '#000';
    sol.lamps.forEach((L, li) => {
      const lamp = lampAt(L, sol.offs[li]);
      sol.props.forEach((p) => {
        if (!p.pose.on || p.extra) return;
        const pc = pieces(p.shape, p.pose), kk = kOf(p.pose.d), [cx, cy] = shadowCentre(home, lamp, p.pose);
        mg.beginPath(); for (const q of pc.polys) path(mg, q.map(([x, y]) => [(cx + x * kk) * s, (cy + y * kk) * s] as V2)); mg.fill('nonzero');
      });
    });
    const edge = this.ghostEdgeC && this.ghostEdgeC.width === pw && this.ghostEdgeC.height === ph ? this.ghostEdgeC : (this.ghostEdgeC = this.blank(pw, ph));
    const eg = edge.getContext('2d')!; eg.setTransform(1, 0, 0, 1, 0, 0); eg.globalCompositeOperation = 'source-over'; eg.clearRect(0, 0, pw, ph);
    // grow the mask a little, then cut the mask itself out: a ring round the picture
    const r = Math.max(1.5, 2.2 * k);
    for (let a = 0; a < 12; a++) eg.drawImage(mask, Math.cos((a / 12) * Math.PI * 2) * r, Math.sin((a / 12) * Math.PI * 2) * r);
    eg.globalCompositeOperation = 'destination-out'; eg.drawImage(mask, 0, 0);
    eg.globalCompositeOperation = 'source-in';
    // dots along the ring
    const pat = this.blank(Math.round(8 * k), Math.round(8 * k)), pg = pat.getContext('2d')!; pg.fillStyle = 'rgba(255,214,120,1)'; pg.beginPath(); pg.arc(pat.width / 2, pat.height / 2, pat.width * 0.32, 0, Math.PI * 2); pg.fill();
    eg.fillStyle = eg.createPattern(pat, 'repeat') ?? 'rgba(255,214,120,1)'; eg.fillRect(0, 0, pw, ph);
    eg.globalCompositeOperation = 'source-over';
  }
  /** The chosen puppet: a gentle outline of its shadow, its turning handle, and the hint's ghost. */
  private drawSelection(c: CanvasRenderingContext2D, d: DrawState, st: Stage, sc: SceneDef | null) {
    const s = this.lay.s;
    const outline = (polys: Poly[], style: string, w: number, dash: number[]) => {
      c.save(); c.strokeStyle = style; c.lineWidth = w; c.setLineDash(dash); c.lineJoin = 'round'; c.beginPath();
      for (const q of polys) path(c, q.map(([x, y]) => [this.sx(x), this.sy(y)] as V2)); c.stroke(); c.restore();
    };
    if (d.hint && 'i' in d.hint && sc) {
      const pulse = 0.55 + 0.45 * Math.sin(this.time * 5);
      for (const polys of this.shadowOf(st, d.hint.i, d.hint.pose)) { outline(polys, `rgba(255,236,140,${0.5 + pulse * 0.5})`, 3.2, [7, 5]); }
      c.save(); c.globalAlpha = 0.18 + 0.12 * pulse; c.fillStyle = '#ffe58a'; c.beginPath(); for (const polys of this.shadowOf(st, d.hint.i, d.hint.pose)) for (const q of polys) path(c, q.map(([x, y]) => [this.sx(x), this.sy(y)] as V2)); c.fill(); c.restore();
    }
    const i = d.selected; if (i < 0 || !st.props[i] || !st.props[i].pose.on) return;
    const sh = this.shadowOf(st, i);
    for (const polys of sh) outline(polys, 'rgba(255,224,150,0.95)', 2, [6, 4]);
    // the turning handle
    if (sc && sc.tools.includes('rot') && !sc.props[i]?.fixed && !sc.props[i]?.rail || !sc) {
      const h = this.rotHandle(st, i); if (!h) return;
      c.save(); c.strokeStyle = 'rgba(255,224,150,0.7)'; c.lineWidth = 1.5; c.setLineDash([3, 3]);
      const pc = this.shadowOf(st, i)[0]; let yy = Infinity; for (const q of pc) yy = Math.min(yy, polyBox(q)[1]);
      c.beginPath(); c.moveTo(h[0], h[1] + 10); c.lineTo(h[0], this.sy(yy)); c.stroke(); c.setLineDash([]);
      c.fillStyle = '#ffe9b0'; c.strokeStyle = '#7a4a10'; c.lineWidth = 2; c.beginPath(); c.arc(h[0], h[1], 11, 0, Math.PI * 2); c.fill(); c.stroke();
      c.strokeStyle = '#7a4a10'; c.lineWidth = 2; c.beginPath(); c.arc(h[0], h[1], 5.5, -0.3, Math.PI * 1.35); c.stroke();
      c.beginPath(); c.moveTo(h[0] + 5.5 * Math.cos(-0.3) + 3, h[1] + 5.5 * Math.sin(-0.3) - 1); c.lineTo(h[0] + 5.5 * Math.cos(-0.3), h[1] + 5.5 * Math.sin(-0.3)); c.lineTo(h[0] + 5.5 * Math.cos(-0.3) - 1, h[1] + 5.5 * Math.sin(-0.3) - 4); c.stroke();
      c.restore();
    }
    void s;
  }
  /** The hand that shows a first-timer what to drag. */
  private drawGuide(c: CanvasRenderingContext2D, g: { from: V2; to: V2 }) {
    const t = (this.time % 2.4) / 2.4, e = ease(Math.min(1, t / 0.75));
    const x = this.sx(g.from[0] + (g.to[0] - g.from[0]) * e), y = this.sy(g.from[1] + (g.to[1] - g.from[1]) * e);
    c.save(); c.globalAlpha = t > 0.85 ? (1 - t) / 0.15 : Math.min(1, t * 6);
    c.strokeStyle = 'rgba(255,230,160,0.6)'; c.setLineDash([6, 6]); c.lineWidth = 2; c.beginPath(); c.moveTo(this.sx(g.from[0]), this.sy(g.from[1])); c.lineTo(this.sx(g.to[0]), this.sy(g.to[1])); c.stroke(); c.setLineDash([]);
    const R = Math.max(14, this.lay.s * 0.32);
    c.fillStyle = '#fff6dc'; c.strokeStyle = '#6a3a10'; c.lineWidth = 2.5;
    c.beginPath(); c.arc(x, y, R * 0.55, 0, Math.PI * 2); c.fill(); c.stroke();
    c.beginPath(); c.arc(x, y, R * (0.9 + 0.2 * Math.sin(this.time * 8)), 0, Math.PI * 2); c.strokeStyle = 'rgba(255,230,160,0.8)'; c.stroke();
    c.restore();
  }

  // ---------------------------------------------------------------- Dora and Enzo, jointed shadow puppets
  private narr = { dora: { g: 'idle' as Gesture, t: 0, arm: 0.6, elbow: -0.4, lean: 0, head: 0 }, enzo: { g: 'idle' as Gesture, t: 0, arm: 0.6, elbow: -0.4, lean: 0, head: 0 } };
  /** Dora and Enzo: in the paper's corners, or (on an upright phone) standing big on the frame's top, in the loft. */
  private drawNarrators(c: CanvasRenderingContext2D, d: DrawState, aliveT: number, loft: boolean) {
    const S = this.lay.screen, F = this.lay.frame;
    const reel = this.showReel, call = reel ? this.reelCall() : -1;
    const want = (who: 'dora' | 'enzo'): Gesture => (call >= 0 ? (call > 1.2 ? 'bow' : 'cheer') : aliveT >= 0 ? 'cheer' : who === 'dora' ? d.dora : d.enzo);
    for (const who of ['dora', 'enzo'] as const) {
      const N = this.narr[who], g = want(who);
      if (g !== N.g) { N.g = g; N.t = 0; }
      N.t += d.dt;
      // the target angles for each gesture, eased towards
      const t = N.t + (who === 'enzo' ? 0.37 : 0);
      let arm = 0.5, elbow = -0.5, lean = 0, head = 0;
      switch (g) {
        case 'idle': arm = 0.45 + 0.06 * Math.sin(t * 1.3); elbow = -0.6; head = 0.04 * Math.sin(t * 0.9); break;
        case 'talk': arm = 0.2 + 0.15 * Math.sin(t * 3); elbow = -0.9 + 0.2 * Math.sin(t * 3.4); head = 0.06 * Math.sin(t * 4.2); break;
        case 'point': arm = -0.5; elbow = 0.25; head = -0.08; lean = 0.06; break;
        case 'think': arm = -0.9; elbow = -2.0; head = 0.18; break;
        case 'cheer': arm = -0.45 + 0.3 * Math.sin(t * 8); elbow = -1.1 + 0.35 * Math.sin(t * 8 + 1); head = -0.12 + 0.06 * Math.sin(t * 6); lean = 0.04 * Math.sin(t * 4); break;
        case 'bow': lean = 0.45 * ease(Math.min(1, t / 0.8)); arm = 0.9; elbow = -0.2; head = 0.3; break;
      }
      const k = Math.min(1, d.dt * 8);
      N.arm += (arm - N.arm) * k; N.elbow += (elbow - N.elbow) * k; N.lean += (lean - N.lean) * k; N.head += (head - N.head) * k;
      const bounce = g === 'cheer' ? Math.abs(Math.sin(t * 8)) * 0.12 : 0;
      const face = who === 'dora' ? 1 : -1;
      if (loft) {
        const scale = this.lay.head / 2.9, feet = F.y - 9;
        this.drawPuppet(c, who, S.x + S.w * (who === 'dora' ? 0.29 : 0.71), feet - bounce * scale, scale, face, N, F.y + 6);
        continue;
      }
      const centre = call >= 0, scale = this.lay.s * (centre ? 1.25 : this.lay.tall ? 0.78 : 0.86);
      const x = centre ? (who === 'dora' ? 6.6 : 9.4) : who === 'dora' ? 1.45 : 14.55;
      this.drawPuppet(c, who, this.sx(x), S.y + S.h - 2 - bounce * scale, scale, face, N, S.y + S.h + 4);
    }
  }
  /** One jointed puppet in the Chinese style, and a chinchilla: translucent coloured hide (cream-white with ruby eyes for
   *  Dora, cool blue-grey with black eyes for Enzo) with carved ink lines, lace dots and a coloured gel flower. A plump
   *  round body, a big round head with a broad, smooth, gently flat crown and a short blunt muzzle, large round pink ears
   *  set at the crown's sides, a big bushy tail, short whiskers, and an arm on a rod. It stands turned three-quarters
   *  towards the play (face 1 looks right), its feet at 0,0, about 2.6 units tall. */
  private drawPuppet(c: CanvasRenderingContext2D, who: 'dora' | 'enzo', x: number, y: number, s: number, face: 1 | -1, N: { arm: number; elbow: number; lean: number; head: number }, rodTo: number) {
    const P = who === 'dora'
      ? { fill: '#fbf4e8', shade: '#eadcc5', chest: '#fffbf5', tail: '#f2e7d4', fur: 'rgba(160,120,80,0.35)', line: '#4a2a1c', eye: '#c8102e', pupil: '#5c0412', gel: 'rgba(236,52,84,0.6)', muzzle: '#fffaf3' }
      : { fill: '#a8b6c8', shade: '#8a9ab0', chest: '#dbe2eb', tail: '#97a7bc', fur: 'rgba(30,44,66,0.3)', line: '#212a37', eye: '#0b0d11', pupil: '#000000', gel: 'rgba(80,170,255,0.6)', muzzle: '#e4e9f0' };
    const lw = 0.045, PINK = '#f6b6c2', PINK_IN = '#ea8ea2';
    const shape = (draw: () => void, fill: string, stroke = true, w = lw) => { c.beginPath(); draw(); c.fillStyle = fill; c.fill(); if (stroke) { c.strokeStyle = P.line; c.lineWidth = w; c.stroke(); } };
    const dots = (pts: V2[], r: number, col: string) => { c.fillStyle = col; for (const [px, py] of pts) { c.beginPath(); c.arc(px, py, r, 0, Math.PI * 2); c.fill(); } };
    const ink = (w: number, draw: () => void, col = P.line) => { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); draw(); c.stroke(); };
    c.save(); c.translate(x, y); c.scale(face * s, s);
    c.lineJoin = 'round'; c.lineCap = 'round';
    // the rods first, so the puppet hides them where it is in front: the main rod from the body, and the hand rod hanging
    // straight down from the paw (worked out from the shoulder, the upper arm and the forearm)
    const SH: V2 = [0.34, -1.12];
    ink(0.05, () => { c.moveTo(-0.04, -0.7); c.lineTo(-0.12, (rodTo - y) / s); }, 'rgba(40,22,14,0.85)');
    {
      const ex = SH[0] + 0.36 * Math.cos(N.arm), ey = SH[1] + 0.36 * Math.sin(N.arm), hx = ex + 0.34 * Math.cos(N.arm + N.elbow), hy = ey + 0.34 * Math.sin(N.arm + N.elbow);
      const cl = Math.cos(N.lean), sl = Math.sin(N.lean), px = hx * cl - hy * sl, py = hx * sl + hy * cl;
      ink(0.03, () => { c.moveTo(px, py); c.lineTo(px - 0.1, (rodTo - y) / s); }, 'rgba(40,22,14,0.85)');
    }
    c.rotate(N.lean);
    // the big bushy tail, curling up behind: a run of fluffy puffs drawn as one outline
    const spine: V2[] = [];
    for (let i = 0; i <= 9; i++) {
      const t = i / 9, u = 1 - t;
      spine.push([u * u * u * -0.4 + 3 * u * u * t * -1.3 + 3 * u * t * t * -1.36 + t * t * t * -0.8, u * u * u * -0.4 + 3 * u * u * t * -0.42 + 3 * u * t * t * -1.4 + t * t * t * -1.78]);
    }
    const puff = (i: number) => 0.3 + 0.1 * Math.sin((i / 9) * Math.PI) - (i / 9) * 0.06;
    c.fillStyle = P.line;
    for (let i = 0; i <= 9; i++) { c.beginPath(); c.arc(spine[i][0], spine[i][1], puff(i) + lw * 0.9, 0, Math.PI * 2); c.fill(); }
    c.fillStyle = P.tail;
    for (let i = 0; i <= 9; i++) { c.beginPath(); c.arc(spine[i][0], spine[i][1], puff(i), 0, Math.PI * 2); c.fill(); }
    // its fur, carved in soft strokes along the plume, and a line of lace down the middle
    for (const off of [-0.14, 0.02, 0.16]) ink(0.022, () => { spine.slice(1, 9).forEach(([px, py], i) => { const [qx, qy] = spine[i + 2] ?? spine[i + 1], nx = -(qy - py), ny = qx - px, l = Math.hypot(nx, ny) || 1; const X = px + (nx / l) * off, Y = py + (ny / l) * off; if (i) c.lineTo(X, Y); else c.moveTo(X, Y); }); }, P.fur);
    dots(spine.slice(1, 9).map(([px, py]) => [px, py] as V2), 0.026, P.line);
    // the ears, behind the head: large and round, pink, set out at the sides of the crown
    const ear = (cx: number, cy: number, rx: number, ry: number, rot: number) => {
      shape(() => c.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2), PINK);
      shape(() => c.ellipse(cx + Math.sin(rot) * 0.02, cy + 0.04, rx * 0.66, ry * 0.7, rot, 0, Math.PI * 2), PINK_IN, false);
      ink(0.016, () => { c.moveTo(cx - Math.sin(rot) * 0.0, cy + ry * 0.45); c.quadraticCurveTo(cx + Math.sin(rot) * 0.1, cy, cx + Math.sin(rot) * 0.16, cy - ry * 0.5); }, 'rgba(160,60,80,0.45)');
    };
    // the far ear (on the side the face turns to) a little smaller
    c.save(); c.translate(0.1, -1.36); c.rotate(N.head); c.translate(-0.1, 1.36);
    ear(-0.54, -2.18, 0.34, 0.38, -0.42);
    ear(0.72, -2.16, 0.3, 0.35, 0.44);
    c.restore();
    // the body: plump and round, with a pale belly
    shape(() => c.ellipse(0, -0.8, 0.7, 0.76, 0, 0, Math.PI * 2), P.fill);
    shape(() => c.ellipse(0.2, -0.72, 0.4, 0.54, 0.08, 0, Math.PI * 2), P.chest, false);
    // the carved lace: dots along the back, a haunch line and a gel flower on the belly
    dots(Array.from({ length: 10 }, (_, i) => { const a = Math.PI * (0.62 + i * 0.085); return [Math.cos(a) * 0.56, -0.8 + Math.sin(a) * 0.62] as V2; }), 0.024, P.line);
    ink(lw * 0.55, () => c.ellipse(-0.2, -0.46, 0.34, 0.28, 0, Math.PI * 0.95, Math.PI * 2.0));
    {
      const fx = 0.2, fy = -0.66, r = 0.085;
      for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2 - Math.PI / 2; shape(() => c.ellipse(fx + Math.cos(a) * r, fy + Math.sin(a) * r, r * 0.72, r * 0.48, a, 0, Math.PI * 2), P.gel, true, lw * 0.4); }
      dots([[fx, fy]], r * 0.42, '#e0b04a');
    }
    // feet
    shape(() => c.ellipse(0.36, -0.06, 0.2, 0.085, 0, 0, Math.PI * 2), P.shade);
    shape(() => c.ellipse(-0.24, -0.06, 0.2, 0.085, 0, 0, Math.PI * 2), P.shade);
    // the arm: upper arm and forearm on riveted joints, with the rod at the paw
    c.save(); c.translate(SH[0], SH[1]); c.rotate(N.arm);
    shape(() => c.ellipse(0.18, 0, 0.22, 0.095, 0, 0, Math.PI * 2), P.fill);
    dots([[0, 0]], 0.035, '#d8a848');
    c.translate(0.36, 0); c.rotate(N.elbow);
    shape(() => c.ellipse(0.15, 0, 0.19, 0.085, 0, 0, Math.PI * 2), P.fill);
    shape(() => c.arc(0.34, 0, 0.08, 0, Math.PI * 2), P.shade);
    dots([[0, 0]], 0.03, '#d8a848');
    c.restore();
    // the head: big and round, wider than tall, the crown broad and gently flat, the cheeks full
    c.save(); c.translate(0.1, -1.36); c.rotate(N.head); c.translate(-0.1, 1.36);
    const hx = 0.1, hy = -1.78, rx = 0.72, ry = 0.55;
    shape(() => {
      for (let n = 0; n <= 48; n++) {
        const a = (n / 48) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a), e = sa < 0 ? 2.6 : 2.15;
        const X = hx + rx * Math.sign(ca) * Math.abs(ca) ** (2 / e), Y = hy + ry * Math.sign(sa) * Math.abs(sa) ** (2 / e);
        if (n) c.lineTo(X, Y); else c.moveTo(X, Y);
      }
      c.closePath();
    }, P.fill);
    // the face, turned three-quarters towards the play: blush, a short blunt muzzle, a pink nose, eyes and whiskers
    shape(() => c.ellipse(-0.24, -1.6, 0.12, 0.065, 0, 0, Math.PI * 2), 'rgba(240,140,160,0.45)', false);
    shape(() => c.ellipse(0.62, -1.6, 0.1, 0.06, 0, 0, Math.PI * 2), 'rgba(240,140,160,0.45)', false);
    shape(() => c.ellipse(0.22, -1.6, 0.21, 0.15, 0, 0, Math.PI * 2), P.muzzle, true, lw * 0.45);
    shape(() => { c.moveTo(0.15, -1.69); c.quadraticCurveTo(0.22, -1.73, 0.29, -1.69); c.quadraticCurveTo(0.26, -1.63, 0.22, -1.62); c.quadraticCurveTo(0.18, -1.63, 0.15, -1.69); c.closePath(); }, '#ea8a9e', true, lw * 0.35);
    ink(0.018, () => { c.moveTo(0.22, -1.62); c.lineTo(0.22, -1.585); c.moveTo(0.14, -1.565); c.quadraticCurveTo(0.18, -1.54, 0.22, -1.585); c.quadraticCurveTo(0.26, -1.54, 0.3, -1.565); });
    for (const [ex, er] of [[-0.06, 0.125], [0.47, 0.11]] as V2[]) {
      shape(() => c.ellipse(ex, -1.84, er * 0.9, er, 0, 0, Math.PI * 2), P.eye, true, lw * 0.5);
      if (who === 'dora') shape(() => c.ellipse(ex + 0.01, -1.83, er * 0.48, er * 0.56, 0, 0, Math.PI * 2), P.pupil, false);
      dots([[ex + er * 0.3, -1.84 - er * 0.38]], er * 0.3, '#fffaf0');
      dots([[ex - er * 0.32, -1.84 + er * 0.35]], er * 0.12, '#fffaf0');
    }
    // short whiskers from the muzzle's sides, staying on the cheeks
    ink(0.013, () => {
      for (const [a, b] of [[-0.06, -0.1], [0, 0], [0.06, 0.09]]) { c.moveTo(0.04, -1.6 + a * 0.5); c.lineTo(-0.2, -1.6 + b); c.moveTo(0.4, -1.6 + a * 0.5); c.lineTo(0.64, -1.6 + b); }
    });
    c.restore();
    c.restore();
  }

  // ---------------------------------------------------------------- the board: the lanterns, rods and beams, seen from above
  private drawBoard(c: CanvasRenderingContext2D, d: DrawState, st: Stage, sc: SceneDef | null) {
    const B = this.lay.board, s = this.lay.s;
    const wood = c.createLinearGradient(0, B.y, 0, B.y + B.h); wood.addColorStop(0, '#3a1f12'); wood.addColorStop(1, '#25130b');
    c.fillStyle = wood; roundRect(c, B.x, B.y, B.w, B.h, 10); c.fill();
    c.save(); roundRect(c, B.x, B.y, B.w, B.h, 10); c.clip();
    // grain
    c.strokeStyle = 'rgba(255,200,140,0.05)'; c.lineWidth = 1;
    for (let i = 0; i < 9; i++) { const yy = B.y + (i + 0.5) * (B.h / 9); c.beginPath(); c.moveTo(B.x, yy); c.bezierCurveTo(B.x + B.w * 0.3, yy + 3, B.x + B.w * 0.6, yy - 3, B.x + B.w, yy); c.stroke(); }
    // the screen's edge along the top
    c.fillStyle = 'rgba(255,226,170,0.9)'; c.fillRect(B.x, this.boardY(0) - 1.5, B.w, 3);
    // the depth notches
    c.fillStyle = 'rgba(255,220,160,0.28)';
    KS.forEach((_, n) => { const yy = this.boardY(depthOf(n)); c.fillRect(B.x + 4, yy - 0.5, 10, 1); c.fillRect(B.x + B.w - 14, yy - 0.5, 10, 1); });
    const home = lampHome(st);
    // beams: from each lantern past each puppet's ends to the screen
    st.lamps.forEach((L, li) => {
      const [lx] = lampAt(L, st.offs[li] ?? 0), Lx = this.sx(lx), Ly = this.boardY(LAMP_D);
      const col = st.lamps.length > 1 ? TONE_RGB[L.tone] : TONE_RGB.warm;
      const cone = c.createLinearGradient(0, Ly, 0, B.y); cone.addColorStop(0, rgb(col, 0.16)); cone.addColorStop(1, rgb(col, 0.05));
      c.fillStyle = cone; c.beginPath(); c.moveTo(Lx, Ly); c.lineTo(B.x - B.w * 0.2, B.y); c.lineTo(B.x + B.w * 1.2, B.y); c.closePath(); c.fill();
      st.props.forEach((p, i) => {
        if (!p.pose.on) return;
        const [x, , z] = this.place(home, p, i, st), half = this.widthOf(p.shape, p.pose) / 2, yy = this.boardY(z);
        c.strokeStyle = rgb(col, i === d.selected ? 0.55 : 0.2); c.lineWidth = 1;
        for (const e of [-half, half]) {
          const ex = this.sx(x + e), t = (Ly - this.boardY(0)) / Math.max(1, Ly - yy);
          c.beginPath(); c.moveTo(ex, yy); c.lineTo(Lx + (ex - Lx) * t, this.boardY(0)); c.stroke();
        }
      });
    });
    // the rods
    st.props.forEach((p, i) => {
      if (!p.pose.on) return;
      const [x, , z] = this.place(home, p, i, st), half = Math.max(4, (this.widthOf(p.shape, p.pose) / 2) * s), bx = this.sx(x), by = this.boardY(z);
      const fixed = !!sc?.props[i]?.fixed, sel = i === d.selected;
      const sh: ShapeDef = (SHAPES as Record<string, ShapeDef>)[p.shape];
      c.fillStyle = sh.gel ? rgb(GEL_RGB[sh.gel], 0.9) : fixed ? 'rgba(160,120,90,0.55)' : sel ? '#ffd27a' : '#d8a868';
      roundRect(c, bx - half, by - 3, half * 2, 6, 3); c.fill();
      if (sel) { c.strokeStyle = '#fff3c8'; c.lineWidth = 1.5; roundRect(c, bx - half - 2, by - 5, half * 2 + 4, 10, 4); c.stroke(); }
      if (!fixed) { c.fillStyle = sel ? '#fff3c8' : '#a87838'; c.beginPath(); c.arc(bx, by, sel ? 5.5 : 4, 0, Math.PI * 2); c.fill(); }
    });
    // the lanterns
    st.lamps.forEach((L, li) => {
      const [lx] = lampAt(L, st.offs[li] ?? 0), X = this.sx(lx), Y = this.boardY(LAMP_D);
      const col = st.lamps.length > 1 ? TONE_RGB[L.tone] : TONE_RGB.warm, fl = 1 + 0.12 * Math.sin(this.time * 9 + li * 2);
      const halo = c.createRadialGradient(X, Y, 0, X, Y, 34 * fl); halo.addColorStop(0, rgb(col, 0.75)); halo.addColorStop(1, rgb(col, 0)); c.fillStyle = halo; c.beginPath(); c.arc(X, Y, 34 * fl, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#2a160c'; c.strokeStyle = '#e0b04a'; c.lineWidth = 2; roundRect(c, X - 9, Y - 11, 18, 22, 5); c.fill(); c.stroke();
      c.fillStyle = rgb(col); c.beginPath(); c.ellipse(X, Y + 1, 4 * fl, 7 * fl, 0, 0, Math.PI * 2); c.fill();
      const movable = !!L.move || !!sc?.id.startsWith('sandbox');
      if (movable && sc?.tools.includes('lamp')) {
        c.fillStyle = 'rgba(255,230,170,0.85)';
        for (const dir of [-1, 1]) { c.beginPath(); c.moveTo(X + dir * 16, Y - 5); c.lineTo(X + dir * 23, Y); c.lineTo(X + dir * 16, Y + 5); c.fill(); }
        if (d.hint && 'lamp' in d.hint && d.hint.lamp === li) {
          const hx = this.sx(L.x + d.hint.x / 4), pulse = 0.5 + 0.5 * Math.sin(this.time * 5);
          c.strokeStyle = `rgba(255,236,140,${0.5 + pulse * 0.5})`; c.lineWidth = 2.5; c.setLineDash([5, 4]); roundRect(c, hx - 11, Y - 13, 22, 26, 6); c.stroke(); c.setLineDash([]);
        }
      }
    });
    c.restore();
    // labels
    c.font = `800 ${Math.max(9, Math.min(12, B.h * 0.16))}px ui-rounded, system-ui, sans-serif`; c.fillStyle = 'rgba(255,226,170,0.55)'; c.textBaseline = 'middle';
    c.textAlign = 'left'; c.fillText('SCREEN', B.x + 18, this.boardY(0) + 9);
    c.textAlign = 'right'; c.fillText('LANTERN', B.x + B.w - 18, this.boardY(LAMP_D) - 2);
  }

  // ---------------------------------------------------------------- motes, ambience and sparkles
  private drawMotes(c: CanvasRenderingContext2D, d: DrawState, aliveT: number, sc: SceneDef | null) {
    const S = this.lay.screen, s = this.lay.s, dt = Math.min(0.1, d.dt);
    const amb = sc?.amb ?? d.amb;
    const r = () => hash(this.moteSeed++);
    // dust motes always drift in the light; the scene's ambience joins in when it comes alive
    if (this.motes.filter((m) => m.kind === 'mote').length < 26 && r() < 0.4) this.motes.push({ x: r() * 16, y: r() * 9, vx: (r() - 0.5) * 0.12, vy: -0.03 - r() * 0.06, life: 4 + r() * 4, kind: 'mote', seed: r() });
    if (aliveT >= 0 && amb && r() < (amb === 'stars' ? 0.25 : 0.5)) {
      const kind = amb;
      const m = { x: r() * 16, y: kind === 'embers' || kind === 'fireflies' ? 9 - r() * 3 : kind === 'stars' ? r() * 4.5 : -0.2, vx: (r() - 0.5) * 0.4, vy: kind === 'embers' ? -0.8 - r() * 0.6 : kind === 'petals' || kind === 'snow' ? 0.5 + r() * 0.4 : kind === 'fireflies' ? -0.2 : 0, life: 2.5 + r() * 2.5, kind, seed: r() };
      if (kind !== 'waves') this.motes.push(m);
    }
    if (d.snapAt >= 0 && d.snapAt < 0.05) for (let i = 0; i < 14; i++) this.motes.push({ x: 0, y: 0, vx: Math.cos(i) * (0.8 + r()), vy: Math.sin(i * 1.7) * (0.8 + r()), life: 0.7, kind: 'spark', seed: d.snapProp + r() });
    c.save(); c.beginPath(); c.rect(S.x, S.y, S.w, S.h); c.clip();
    for (const m of this.motes) {
      m.life -= dt; m.x += m.vx * dt; m.y += m.vy * dt;
      if (m.kind === 'petals' || m.kind === 'snow') m.vx = Math.sin(this.time * 2 + m.seed * 9) * 0.4;
      if (m.kind === 'fireflies') { m.vx = Math.sin(this.time * 1.3 + m.seed * 20) * 0.5; m.vy = Math.cos(this.time * 1.1 + m.seed * 13) * 0.35; }
      const a = Math.max(0, Math.min(1, m.life, (m.kind === 'mote' ? 0.3 : 1)));
      const X = this.sx(m.x), Y = this.sy(m.y);
      switch (m.kind) {
        case 'mote': c.fillStyle = `rgba(255,236,190,${0.35 * a})`; c.beginPath(); c.arc(X, Y, 1.2, 0, Math.PI * 2); c.fill(); break;
        case 'stars': { const tw = 0.5 + 0.5 * Math.sin(this.time * 6 + m.seed * 30); c.fillStyle = `rgba(255,248,220,${a * tw})`; star4(c, X, Y, s * 0.09 * (0.6 + tw)); break; }
        case 'fireflies': { const g = c.createRadialGradient(X, Y, 0, X, Y, s * 0.22); g.addColorStop(0, `rgba(255,250,160,${0.9 * a})`); g.addColorStop(1, 'rgba(255,240,120,0)'); c.fillStyle = g; c.beginPath(); c.arc(X, Y, s * 0.22, 0, Math.PI * 2); c.fill(); break; }
        case 'embers': c.fillStyle = `rgba(255,${140 + Math.round(m.seed * 80)},60,${a})`; c.beginPath(); c.arc(X, Y, s * 0.04, 0, Math.PI * 2); c.fill(); break;
        case 'petals': c.fillStyle = `rgba(255,170,190,${a})`; c.beginPath(); c.ellipse(X, Y, s * 0.08, s * 0.045, this.time * 2 + m.seed * 6, 0, Math.PI * 2); c.fill(); break;
        case 'snow': c.fillStyle = `rgba(255,255,255,${a})`; c.beginPath(); c.arc(X, Y, s * 0.05, 0, Math.PI * 2); c.fill(); break;
        case 'spark': break;
        default: break;
      }
    }
    c.restore();
    this.motes = this.motes.filter((m) => m.life > 0 && m.kind !== 'spark' && m.y > -1 && m.y < 10.5);
  }

  // ---------------------------------------------------------------- the final performance
  startReel(scenes: SceneDef[]) { this.showReel = { scenes, t: 0 }; this.aliveFrom = null; }
  stopReel() { this.showReel = null; this.aliveFrom = null; this.live = []; }
  /** Seconds each scene of the show plays. */
  static readonly REEL = 5.5;
  reelIndex() { const R = this.showReel; return R ? Math.min(R.scenes.length, Math.floor(R.t / ShadowScene.REEL)) : -1; }
  reelDone() { const R = this.showReel; return !!R && R.t > R.scenes.length * ShadowScene.REEL + 4.5; }
  tickReel(dt: number) { if (this.showReel) { const before = this.reelIndex(); this.showReel.t += dt; if (this.reelIndex() !== before) this.aliveFrom = null; } }
  private reelScene(): SceneDef | null { const R = this.showReel!; const i = this.reelIndex(); return i < R.scenes.length ? R.scenes[i] : null; }
  private reelStage(): Stage | null {
    const sc = this.reelScene(); if (!sc) return null;
    return { props: sc.props.map((P) => ({ shape: P.shape, pose: P.sol ? { ...P.sol } : { ...P.start, on: false }, extra: P.extra })), lamps: sc.lamps, offs: sc.lamps.map((L) => L.sol ?? 0) };
  }
  private reelAlive() { const R = this.showReel!; return this.reelScene() ? 0.75 + (R.t % ShadowScene.REEL) : -1; }
  /** Seconds into the curtain call, or −1. */
  reelCall() { const R = this.showReel; if (!R) return -1; const t = R.t - R.scenes.length * ShadowScene.REEL; return t >= 0 ? t : -1; }
  /** The woodland audience in silhouette along the bottom: ears, heads and an owl, bobbing when the show is good. */
  private drawAudience(c: CanvasRenderingContext2D, aliveT: number) {
    const S = this.lay.screen, s = this.lay.s, base = S.y + S.h + this.lay.board.h * 0.5;
    c.save(); c.fillStyle = '#0d0605';
    const n = 9;
    for (let i = 0; i < n; i++) {
      const x = S.x + ((i + 0.5) / n) * S.w, bob = aliveT >= 0 || this.reelCall() >= 0 ? Math.abs(Math.sin(this.time * 5 + i)) * s * 0.12 : 0, y = base - bob, kind = i % 5;
      c.beginPath(); c.ellipse(x, y, s * 0.55, s * 0.6, 0, Math.PI, 0); c.fill();
      c.beginPath(); c.arc(x, y - s * 0.55, s * 0.32, 0, Math.PI * 2); c.fill();
      if (kind === 0) { c.beginPath(); c.ellipse(x - s * 0.12, y - s * 1.0, s * 0.08, s * 0.32, -0.15, 0, Math.PI * 2); c.ellipse(x + s * 0.12, y - s * 1.0, s * 0.08, s * 0.32, 0.15, 0, Math.PI * 2); c.fill(); }
      if (kind === 1) { c.beginPath(); c.moveTo(x - s * 0.28, y - s * 0.7); c.lineTo(x - s * 0.18, y - s * 0.98); c.lineTo(x - s * 0.06, y - s * 0.78); c.moveTo(x + s * 0.28, y - s * 0.7); c.lineTo(x + s * 0.18, y - s * 0.98); c.lineTo(x + s * 0.06, y - s * 0.78); c.fill(); }
      if (kind === 2) { c.beginPath(); c.arc(x - s * 0.22, y - s * 0.82, s * 0.13, 0, Math.PI * 2); c.arc(x + s * 0.22, y - s * 0.82, s * 0.13, 0, Math.PI * 2); c.fill(); }
      if (kind === 3) { for (let k = 0; k < 7; k++) { const a = Math.PI * (1.05 + k * 0.13); c.beginPath(); c.moveTo(x + Math.cos(a) * s * 0.5, y + Math.sin(a) * s * 0.5); c.lineTo(x + Math.cos(a) * s * 0.75, y + Math.sin(a) * s * 0.75); c.lineTo(x + Math.cos(a + 0.12) * s * 0.5, y + Math.sin(a + 0.12) * s * 0.5); c.fill(); } }
    }
    c.restore();
  }
}

// ---------------------------------------------------------------- helpers
function path(c: CanvasRenderingContext2D, q: Poly) { if (!q.length) return; c.moveTo(q[0][0], q[0][1]); for (let i = 1; i < q.length; i++) c.lineTo(q[i][0], q[i][1]); c.closePath(); }
function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2); c.beginPath(); c.moveTo(x + rr, y); c.arcTo(x + w, y, x + w, y + h, rr); c.arcTo(x + w, y + h, x, y + h, rr); c.arcTo(x, y + h, x, y, rr); c.arcTo(x, y, x + w, y, rr); c.closePath();
}
function star4(c: CanvasRenderingContext2D, x: number, y: number, r: number) { c.beginPath(); for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2, rr = i % 2 ? r * 0.3 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } c.closePath(); c.fill(); }
function distToPoly(q: Poly, x: number, y: number) {
  let best = Infinity;
  for (let i = 0, j = q.length - 1; i < q.length; j = i++) {
    const [ax, ay] = q[j], [bx, by] = q[i], dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy;
    const t = l ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l)) : 0;
    best = Math.min(best, Math.hypot(ax + t * dx - x, ay + t * dy - y));
  }
  return best;
}

/** A puppet drawn as the object it is (for the tray): a leather cut-out with its lace, or coloured glass. */
export function drawPropIcon(cv: HTMLCanvasElement, shapeId: string) {
  const g = cv.getContext('2d'); if (!g) return;
  const sh: ShapeDef = (SHAPES as Record<string, ShapeDef>)[shapeId], p: Pose = { x: 0, y: 0, d: 0, r: 0, f: 0, t: 0, on: true }, pc = pieces(shapeId, p);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const q of pc.polys) { const b = polyBox(q); x0 = Math.min(x0, b[0]); y0 = Math.min(y0, b[1]); x1 = Math.max(x1, b[2]); y1 = Math.max(y1, b[3]); }
  const W = cv.width, H = cv.height, s = Math.min((W * 0.82) / (x1 - x0), (H * 0.82) / (y1 - y0)), ox = W / 2 - ((x0 + x1) / 2) * s, oy = H / 2 - ((y0 + y1) / 2) * s;
  g.clearRect(0, 0, W, H);
  const tr = (q: Poly) => q.map(([x, y]) => [ox + x * s, oy + y * s] as V2);
  g.beginPath(); for (const q of pc.polys) path(g, tr(q));
  if (sh.gel) { g.fillStyle = rgb(GEL_RGB[sh.gel], 0.85); g.fill('nonzero'); g.strokeStyle = '#3a1e10'; g.lineWidth = Math.max(1.5, W * 0.03); g.stroke(); }
  else {
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#b8763a'); gr.addColorStop(1, '#7a4420'); g.fillStyle = gr; g.fill('nonzero');
    g.strokeStyle = '#4a2410'; g.lineWidth = Math.max(1, W * 0.015); g.stroke();
    g.globalCompositeOperation = 'destination-out'; g.beginPath(); for (const q of [...pc.holes, ...pc.lace]) path(g, tr(q)); g.fill(); g.globalCompositeOperation = 'source-over';
  }
  void TURN_STEPS; void EDGE; void SCREEN_H;
}

/** A lantern-lit stand-in for a painting, drawn until (or unless) the painting loads. */
export function paintStandIn(cv: HTMLCanvasElement, kind: 'title' | 'backdrop' | 'ending') {
  const g = cv.getContext('2d'); if (!g) return;
  const W = cv.width, H = cv.height;
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, kind === 'backdrop' ? '#2a120c' : '#1a1030'); bg.addColorStop(1, '#120806'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
  // a glowing screen with a cat on a roof and a moon
  const sx = W * 0.52, sy = H * 0.12, sw = W * 0.4, sh = sw * 0.6;
  const glow = g.createRadialGradient(sx + sw / 2, sy + sh / 2, 10, sx + sw / 2, sy + sh / 2, sw); glow.addColorStop(0, 'rgba(255,190,90,0.5)'); glow.addColorStop(1, 'rgba(255,140,60,0)'); g.fillStyle = glow; g.fillRect(0, 0, W, H);
  g.fillStyle = '#f6d898'; g.fillRect(sx, sy, sw, sh);
  g.fillStyle = '#2a160e'; g.beginPath(); g.moveTo(sx + sw * 0.2, sy + sh); g.lineTo(sx + sw * 0.2, sy + sh * 0.7); g.lineTo(sx + sw * 0.45, sy + sh * 0.45); g.lineTo(sx + sw * 0.7, sy + sh * 0.7); g.lineTo(sx + sw * 0.7, sy + sh); g.fill();
  g.beginPath(); g.ellipse(sx + sw * 0.45, sy + sh * 0.36, sw * 0.04, sh * 0.09, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(sx + sw * 0.82, sy + sh * 0.22, sw * 0.06, 0.6, Math.PI * 2 - 0.6); g.fill();
  g.strokeStyle = '#8a1c26'; g.lineWidth = W * 0.02; g.strokeRect(sx, sy, sw, sh);
  // two little puppeteers in silhouette
  for (const [x, c] of [[0.24, '#f3e6d0'], [0.34, '#93a5c0']] as [number, string][]) {
    g.fillStyle = c; g.beginPath(); g.ellipse(W * x, H * 0.72, W * 0.045, H * 0.09, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(W * x, H * 0.58, W * 0.04, H * 0.055, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#f2a0b0'; g.beginPath(); g.arc(W * (x - 0.025), H * 0.52, W * 0.016, 0, Math.PI * 2); g.arc(W * (x + 0.025), H * 0.52, W * 0.016, 0, Math.PI * 2); g.fill();
  }
}
