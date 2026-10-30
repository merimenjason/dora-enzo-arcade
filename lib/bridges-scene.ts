// Twig & Twine's scene: the side-on valley drawn in Canvas 2D. The painted backdrop for the region (with a drawn
// stand-in until it loads), the banks, rocks and posts, the water or the ravine, the build grid and anchors, every
// member in its material (with the stress colours while testing), the acorn cart with Dora and Enzo painted in it on
// wheels the scene spins, the hay wagon, the boat, the wind, and the splinters, splashes and confetti. Drawing only:
// the rules and physics are in bridges-game.ts.
import { drawChinchilla } from './chinchilla-art';
import { MAT, Sim, VEHICLE, type Builder, type Ev, type LevelDef, type Mat, type Member, type RegionId, type Vehicle, mkey, lenOf } from './bridges-game';

export type Drag = { ax: number; ay: number; bx: number; by: number; m: Mat; ok: boolean; why?: string; cost: number };
export type DrawOpts = {
  dt: number;
  builder: Builder | null;
  sim: Sim | null;
  drag: Drag | null;
  /** the member under the pointer (0-based), for deleting */ hover: number;
  hoverNode: [number, number] | null;
  stress: boolean;
  tool: 'build' | 'delete';
  mirror: boolean;
  guide: { from: [number, number]; to: [number, number] } | null;
  /** the run has ended in a cheer (crossing) or a splash */ celebrate: boolean;
};
type Cam = { s: number; cx: number; cy: number };
type Bit = { x: number; y: number; vx: number; vy: number; a: number; va: number; life: number; max: number; kind: 'splinter' | 'drop' | 'leaf' | 'confetti' | 'puff' | 'half' | 'ring'; color: string; size: number; len?: number; m?: Mat };
export type Pose = 'ride' | 'cheer' | 'nervous' | 'soggy';
const POSES: Pose[] = ['ride', 'cheer', 'nervous', 'soggy'];
/** Where the wheels go in the painted cart (768 × 640): the rear and front axle points, in pixels. */
export const CART_ART = { w: 768, h: 640, rear: [209, 600] as [number, number], front: [559, 600] as [number, number] };

const SKY: Record<RegionId, [string, string, string]> = {
  brook: ['#9fd6f5', '#d8f0f4', '#cfe8b8'],
  ravine: ['#8fb8a8', '#c4dccc', '#7aa088'],
  marsh: ['#f4e2b0', '#f8efd2', '#c8c890'],
  canyon: ['#f0a070', '#f8c890', '#e8a070'],
};
const EARTH: Record<RegionId, { top: string; mid: string; deep: string; grass: string; road: string; rock: string }> = {
  brook: { top: '#8a6a3e', mid: '#6e5232', deep: '#4a3622', grass: '#7cbf4a', road: '#d8bb86', rock: '#8c8a80' },
  ravine: { top: '#5e6a4a', mid: '#46503a', deep: '#2c3426', grass: '#5aa04a', road: '#b8a67a', rock: '#6a7468' },
  marsh: { top: '#7a6a44', mid: '#5e5034', deep: '#3e3424', grass: '#a8b848', road: '#cdb684', rock: '#8a8676' },
  canyon: { top: '#c0643a', mid: '#a04c2c', deep: '#6e3220', grass: '#b89850', road: '#e0b080', rock: '#b0603c' },
};
const MAT_COL: Record<Mat, { fill: string; edge: string; w: number }> = {
  twig: { fill: '#9a6a3a', edge: '#5a3a1c', w: 0.15 },
  plank: { fill: '#d29a5a', edge: '#7a4e24', w: 0.3 },
  twine: { fill: '#e8d6a8', edge: '#8a7448', w: 0.07 },
  bamboo: { fill: '#b8c860', edge: '#5e7028', w: 0.19 },
};
/** Calm green through amber to red as a member nears its limit. */
export function stressColor(r: number) {
  const k = Math.max(0, Math.min(1, r));
  const a = [96, 196, 104], b = [242, 182, 58], c = [230, 70, 56];
  const [p, q, t] = k < 0.6 ? [a, b, k / 0.6] : [b, c, (k - 0.6) / 0.4];
  return `rgb(${Math.round(p[0] + (q[0] - p[0]) * t)},${Math.round(p[1] + (q[1] - p[1]) * t)},${Math.round(p[2] + (q[2] - p[2]) * t)})`;
}

export class BridgeScene {
  readonly cv: HTMLCanvasElement;
  private c: CanvasRenderingContext2D;
  private W = 1; private H = 1; private dpr = 1;
  inset = { top: 8, right: 8, bottom: 8, left: 8 };
  private level: LevelDef | null = null;
  private cam: Cam = { s: 30, cx: 0, cy: 0 };
  private goal: Cam = { s: 30, cx: 0, cy: 0 };
  /** the player moved the camera, so it stops following on its own */ private manual = false;
  private art = new Map<string, HTMLImageElement>();
  private bits: Bit[] = [];
  private born = new Map<string, number>();
  private known = new Set<string>();
  private time = 0;
  private wave = 0;
  /** the last place each vehicle was drawn, for the soggy bob after a splash */ private sunk: (null | { x: number; t: number })[] = [];
  private lastSim: Sim | null = null;
  private cartRect: { x: number; y: number; w: number; h: number } | null = null;
  private poseNow: Pose = 'ride';
  testing = false;

  constructor(cv: HTMLCanvasElement) {
    this.cv = cv;
    const c = cv.getContext('2d'); if (!c) throw new Error('no 2d');
    this.c = c;
    // there is no soggy painting: after a splash the cart borrows the eyes-covered one, with drips drawn over it
    for (const p of POSES) if (p !== 'soggy') this.load(`cart-${p}`);
    this.resize();
  }
  private load(name: string) { if (this.art.has(name)) return; const img = new Image(); img.decoding = 'async'; img.src = `/art/bridges/${name}.webp`; this.art.set(name, img); }
  private img(name: string) { const i = this.art.get(name); return i && i.complete && i.naturalWidth > 0 ? i : null; }
  resize() {
    const r = this.cv.getBoundingClientRect();
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.W = Math.max(1, r.width); this.H = Math.max(1, r.height);
    const w = Math.round(this.W * this.dpr), h = Math.round(this.H * this.dpr);
    if (this.cv.width !== w || this.cv.height !== h) { this.cv.width = w; this.cv.height = h; }
  }
  setLevel(L: LevelDef | null) {
    this.level = L; this.bits = []; this.born.clear(); this.known.clear(); this.sunk = []; this.lastSim = null; this.manual = false;
    if (L) { this.load(`bg-${L.region}`); this.frame(true); }
  }
  // ---------------------------------------------------------------- the camera
  /** What the camera frames: the level's view, widened to take in the whole painted cart at the start. */
  private box() { const L = this.level!, v = L.view; return { ...v, x0: Math.min(v.x0, L.start - 2.3) }; }
  private fitScale() {
    const L = this.level; if (!L) return 30;
    const v = this.box(), aw = this.W - this.inset.left - this.inset.right, ah = this.H - this.inset.top - this.inset.bottom;
    return Math.max(4, Math.min(aw / (v.x1 - v.x0), ah / (v.y1 - v.y0)));
  }
  /** Frames the level in the clear part of the screen. On a small screen it keeps the grid big enough to touch. */
  frame(now = false) {
    const L = this.level; if (!L) return;
    const v = this.box(), s = Math.max(this.fitScale(), this.minScale());
    const aw = this.W - this.inset.left - this.inset.right, ah = this.H - this.inset.top - this.inset.bottom;
    // the centre of the clear area, in world units relative to the canvas centre
    const ox = (this.inset.left - this.inset.right) / 2 / s, oy = (this.inset.bottom - this.inset.top) / 2 / s;
    let cx = (v.x0 + v.x1) / 2 - ox, cy = (v.y0 + v.y1) / 2 - oy;
    // if it doesn't all fit, keep the road and the gap's start in view
    if ((v.x1 - v.x0) * s > aw + 1) cx = Math.min(cx, v.x0 + aw / s / 2 + 1.5 - ox);
    if ((v.y1 - v.y0) * s > ah + 1) cy = Math.max(-1, (v.y0 + v.y1) / 2) - oy;
    this.goal = { s, cx, cy }; this.manual = false;
    if (now) this.cam = { ...this.goal };
  }
  private minScale() { return this.testing ? 24 : 17; }
  zoomAt(f: number, sx = this.W / 2, sy = this.H / 2) {
    const [wx, wy] = this.toWorld(sx, sy);
    const fit = this.fitScale(), s = Math.max(fit * 0.7, Math.min(110, this.goal.s * f));
    // keep the point under the pointer still
    this.goal = { s, cx: wx - (sx - this.W / 2) / s, cy: wy + (sy - this.H / 2) / s };
    this.cam = { ...this.goal }; this.manual = true;
  }
  pan(dx: number, dy: number) {
    this.goal = { ...this.goal, cx: this.goal.cx - dx / this.goal.s, cy: this.goal.cy + dy / this.goal.s };
    this.cam = { ...this.cam, cx: this.cam.cx - dx / this.cam.s, cy: this.cam.cy + dy / this.cam.s }; this.manual = true;
    this.clampCam();
  }
  private clampCam() {
    const L = this.level; if (!L) return;
    const v = L.view, m = 6;
    for (const k of [this.goal, this.cam]) { k.cx = Math.max(v.x0 - m, Math.min(v.x1 + m, k.cx)); k.cy = Math.max(v.y0 - m, Math.min(v.y1 + m, k.cy)); }
  }
  toScreen(x: number, y: number): [number, number] { const k = this.cam; return [this.W / 2 + (x - k.cx) * k.s, this.H / 2 - (y - k.cy) * k.s]; }
  toWorld(sx: number, sy: number): [number, number] { const k = this.cam; return [k.cx + (sx - this.W / 2) / k.s, k.cy - (sy - this.H / 2) / k.s]; }
  get scale() { return this.cam.s; }
  get settled() { const a = this.cam, b = this.goal; return Math.abs(a.s - b.s) < 0.05 && Math.abs(a.cx - b.cx) < 0.01 && Math.abs(a.cy - b.cy) < 0.01; }
  /** Where things are on screen, for the browser checks. */
  metrics() { return { scale: this.cam.s, settled: this.settled, cart: this.cartRect, pose: this.poseNow, W: this.W, H: this.H }; }

  // ---------------------------------------------------------------- events
  /** Turns simulation events into splinters, splashes and confetti. */
  feed(evs: Ev[]) {
    const L = this.level; if (!L) return;
    for (const e of evs) {
      if (e.k === 'break') {
        const col = MAT_COL[e.m];
        for (const side of [-1, 1]) this.bits.push({ x: e.x + Math.cos(e.ang) * e.len * 0.25 * side, y: e.y + Math.sin(e.ang) * e.len * 0.25 * side, vx: side * 0.8, vy: 1.2, a: e.ang, va: side * 2.5, life: 0, max: 2.6, kind: 'half', color: col.fill, size: col.w, len: e.len / 2, m: e.m });
        for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2 + e.ang; this.bits.push({ x: e.x, y: e.y, vx: Math.cos(a) * (1.5 + (i % 3)), vy: Math.sin(a) * 2 + 2, a, va: 8 - (i % 5) * 3, life: 0, max: 1.1, kind: e.m === 'twine' ? 'puff' : 'splinter', color: e.m === 'twine' ? '#f4e8c8' : col.fill, size: 0.06 + (i % 3) * 0.03 }); }
      } else if (e.k === 'splash') {
        const dust = L.floor === 'canyon';
        for (let i = 0; i < 26; i++) { const a = Math.PI * (0.15 + 0.7 * (i / 25)); this.bits.push({ x: e.x + (i % 5 - 2) * 0.2, y: e.y, vx: Math.cos(a) * (2 + (i % 4)), vy: Math.sin(a) * (4 + (i % 3) * 1.5), a: 0, va: 0, life: 0, max: 1.3, kind: dust ? 'puff' : 'drop', color: dust ? '#e8c8a0' : '#cfeeff', size: dust ? 0.3 : 0.1 }); }
        for (let i = 0; i < 3; i++) this.bits.push({ x: e.x, y: e.y, vx: 0, vy: 0, a: 0, va: 0, life: -i * 0.25, max: 1.6, kind: 'ring', color: '#ffffff', size: 0.4 });
      } else if (e.k === 'cross') {
        const fx = L.finish + 1.5;
        for (let i = 0; i < 46; i++) { const a = Math.PI * (0.2 + 0.6 * ((i * 37) % 46) / 46); this.bits.push({ x: fx, y: 1.2, vx: Math.cos(a) * (2 + (i % 5)), vy: Math.sin(a) * (5 + (i % 4)), a: i, va: 6 - (i % 7) * 2, life: 0, max: 2.6, kind: 'confetti', color: ['#ffd84a', '#ff8a6a', '#8ad86a', '#7ac8f0', '#e88ad8'][i % 5], size: 0.12 }); }
      } else if (e.k === 'boat') {
        for (let i = 0; i < 8; i++) this.bits.push({ x: e.x, y: e.y, vx: (i - 4) * 0.5, vy: 2, a: 0, va: 0, life: 0, max: 0.9, kind: 'puff', color: '#ffffff', size: 0.25 });
      }
    }
  }

  // ---------------------------------------------------------------- drawing
  draw(o: DrawOpts) {
    const c = this.c, L = this.level;
    this.time += o.dt; this.wave += o.dt;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (!L) { c.fillStyle = '#cfe8d8'; c.fillRect(0, 0, this.W, this.H); return; }
    if (o.sim !== this.lastSim) { this.lastSim = o.sim; this.sunk = []; }
    this.follow(o);
    // ease the camera
    const k = 1 - Math.exp(-o.dt * 9);
    this.cam = { s: this.cam.s + (this.goal.s - this.cam.s) * k, cx: this.cam.cx + (this.goal.cx - this.cam.cx) * k, cy: this.cam.cy + (this.goal.cy - this.cam.cy) * k };
    this.backdrop(L);
    c.save();
    c.translate(this.W / 2, this.H / 2); c.scale(this.cam.s, -this.cam.s); c.translate(-this.cam.cx, -this.cam.cy);
    this.waterBack(L);
    if (o.builder && !o.sim) this.grid(L, o);
    if (L.boat) this.boat(L, o);
    this.grounds(L);
    this.flag(L);
    const members = o.sim ? null : o.builder?.members ?? [];
    if (members) this.buildMembers(members, o); else if (o.sim) this.simMembers(o.sim, o);
    this.anchors(L, o);
    this.vehicles(L, o);
    this.waterFront(L);
    this.drawBits(o.dt);
    if (o.drag) this.dragGhost(o.drag, o);
    if (o.guide && !o.drag) this.guideHand(o.guide);
    c.restore();
    if (L.wind && o.sim) this.windStreaks(o.sim, o.dt);
    this.labels(o);
  }
  /** While testing on a small screen, the camera follows the cart. */
  private follow(o: DrawOpts) {
    const L = this.level!; const was = this.testing;
    this.testing = !!o.sim;
    if (was !== this.testing && !this.manual) this.frame();
    if (!o.sim || this.manual) return;
    const fit = this.fitScale();
    if (fit >= this.minScale()) return;
    const v = o.sim.vehicles[0]; if (!v) return;
    const s = this.goal.s, half = (this.W - this.inset.left - this.inset.right) / s / 2;
    const ox = (this.inset.left - this.inset.right) / 2 / s;
    const x = Math.max(L.view.x0 + half, Math.min(L.view.x1 - half, (v.x[0] + v.x[1]) / 2 + 1.5));
    this.goal.cx = x - ox;
  }
  private backdrop(L: LevelDef) {
    const c = this.c, [a, b, g] = SKY[L.region];
    const im = this.img(`bg-${L.region}`);
    if (im) {
      // cover the canvas, drifting a little with the camera
      const k = Math.max(this.W / im.naturalWidth, this.H / im.naturalHeight) * 1.08;
      const w = im.naturalWidth * k, h = im.naturalHeight * k;
      const dx = Math.max(-1, Math.min(1, (this.cam.cx - (L.view.x0 + L.view.x1) / 2) / 20)) * (w - this.W) * 0.4;
      c.drawImage(im, (this.W - w) / 2 - dx, (this.H - h) / 2, w, h);
      c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(0, 0, this.W, this.H);
      return;
    }
    const gr = c.createLinearGradient(0, 0, 0, this.H); gr.addColorStop(0, a); gr.addColorStop(0.6, b); gr.addColorStop(1, g);
    c.fillStyle = gr; c.fillRect(0, 0, this.W, this.H);
    // soft far hills
    c.fillStyle = g; c.globalAlpha = 0.55;
    c.beginPath(); c.moveTo(0, this.H * 0.62);
    for (let x = 0; x <= this.W; x += 20) c.lineTo(x, this.H * 0.6 - Math.sin(x / 140 + 1) * 30 - Math.sin(x / 61) * 10);
    c.lineTo(this.W, this.H); c.lineTo(0, this.H); c.fill(); c.globalAlpha = 1;
  }
  private waterBack(L: LevelDef) {
    const c = this.c, v = L.view, x0 = v.x0 - 30, x1 = v.x1 + 30;
    if (L.floor === 'water') {
      const g = c.createLinearGradient(0, L.water, 0, L.water - 6);
      g.addColorStop(0, '#6ab8d8'); g.addColorStop(1, '#2a6a8a');
      c.fillStyle = g; c.fillRect(x0, L.water - 30, x1 - x0, 30);
    } else {
      // the depths: haze down to the stream or the canyon floor
      const deep = L.floor === 'canyon' ? ['#c87a50', '#7a3a2a'] : ['#4a6a5a', '#1e3028'];
      const g = c.createLinearGradient(0, L.water + 6, 0, L.water - 2);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.6, deep[0] + '88'); g.addColorStop(1, deep[1]);
      c.fillStyle = g; c.fillRect(x0, L.water - 30, x1 - x0, 36);
      if (L.floor === 'ravine') { c.fillStyle = '#5ab0c8'; c.fillRect(x0, L.water - 0.3, x1 - x0, 0.3); }
    }
  }
  private waterFront(L: LevelDef) {
    if (L.floor !== 'water') return;
    const c = this.c, v = L.view, x0 = v.x0 - 30, x1 = v.x1 + 30;
    c.fillStyle = 'rgba(120, 200, 230, 0.35)'; c.fillRect(x0, L.water - 30, x1 - x0, 30);
    // ripples
    c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 0.05; c.lineCap = 'round';
    for (let i = 0; i < 40; i++) {
      const x = v.x0 + ((i * 7.3 + this.wave * (0.3 + (i % 3) * 0.15)) % (v.x1 - v.x0 + 4)) - 2, y = L.water - 0.25 - (i % 4) * 0.45;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + 0.5 + (i % 3) * 0.3, y); c.stroke();
    }
    c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 0.06;
    c.beginPath(); for (let x = x0; x <= x1; x += 0.5) { const y = L.water + Math.sin(x * 1.3 + this.wave * 2) * 0.05; if (x === x0) c.moveTo(x, y); else c.lineTo(x, y); } c.stroke();
  }
  private grounds(L: LevelDef) {
    const c = this.c, E = EARTH[L.region];
    for (const g of L.grounds) {
      const top = Math.max(...g.poly.map((p) => p[1]));
      const gr = c.createLinearGradient(0, top, 0, top - 8);
      const isRock = g.kind === 'rock';
      gr.addColorStop(0, isRock ? E.rock : E.top); gr.addColorStop(0.35, isRock ? E.rock : E.mid); gr.addColorStop(1, E.deep);
      c.fillStyle = gr; c.strokeStyle = 'rgba(40,24,10,0.55)'; c.lineWidth = 0.06; c.lineJoin = 'round';
      c.beginPath(); g.poly.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.fill(); c.stroke();
      // strata and pebbles, the same every frame
      c.save(); c.clip();
      c.strokeStyle = 'rgba(255,255,255,0.08)'; c.lineWidth = 0.12;
      const xs = g.poly.map((p) => p[0]), lo = Math.max(Math.min(...xs), L.view.x0 - 4), hi = Math.min(Math.max(...xs), L.view.x1 + 4);
      for (let y = top - 1.2; y > top - 14; y -= L.region === 'canyon' ? 0.9 : 1.6) { c.beginPath(); c.moveTo(lo, y); for (let x = lo; x <= hi; x += 1) c.lineTo(x, y + Math.sin(x * 0.9 + y) * 0.12); c.stroke(); }
      c.fillStyle = 'rgba(0,0,0,0.12)';
      for (let i = 0; i < 40; i++) { const x = lo + ((i * 5.17) % Math.max(1, hi - lo)), y = top - 0.8 - ((i * 2.31) % 7); c.beginPath(); c.ellipse(x, y, 0.18, 0.12, 0, 0, Math.PI * 2); c.fill(); }
      c.restore();
      if (g.road) {
        // the road: a grassy lip and a dirt track along the top
        c.lineCap = 'round';
        c.strokeStyle = E.grass; c.lineWidth = 0.34;
        c.beginPath(); g.road.forEach(([x, y], i) => (i ? c.lineTo(x, y - 0.12) : c.moveTo(x, y - 0.12))); c.stroke();
        c.strokeStyle = E.road; c.lineWidth = 0.14;
        c.beginPath(); g.road.forEach(([x, y], i) => (i ? c.lineTo(x, y - 0.05) : c.moveTo(x, y - 0.05))); c.stroke();
        // tufts of grass and flowers along the road edge
        const [a, b] = [g.road[0], g.road[g.road.length - 1]];
        for (let x = Math.max(a[0], L.view.x0 - 2); x < Math.min(b[0], L.view.x1 + 2); x += 0.7) {
          const y = a[1] + ((x - a[0]) / (b[0] - a[0])) * (b[1] - a[1]), h = 0.2 + ((x * 7.7) % 0.25);
          c.strokeStyle = E.grass; c.lineWidth = 0.05;
          c.beginPath(); c.moveTo(x, y - 0.25); c.lineTo(x - 0.08, y - 0.25 + h); c.moveTo(x + 0.1, y - 0.25); c.lineTo(x + 0.16, y - 0.25 + h * 0.8); c.stroke();
          if (L.region !== 'canyon' && Math.floor(x * 3.1) % 5 === 0) { c.fillStyle = ['#ffe070', '#ffffff', '#f4a0c0'][Math.floor(x) % 3]; c.beginPath(); c.arc(x, y - 0.25 + h, 0.07, 0, Math.PI * 2); c.fill(); }
        }
      } else if (g.kind === 'rock') {
        c.fillStyle = L.region === 'canyon' ? 'rgba(255,200,150,0.25)' : 'rgba(110,170,80,0.6)';
        const p = g.poly; c.beginPath(); c.moveTo(p[0][0], p[0][1]); c.lineTo(p[1][0], p[1][1] + 0.12); c.lineTo(p[2][0], p[2][1] + 0.12); c.lineTo(p[3][0], p[3][1]); c.closePath(); c.fill();
      }
    }
    // the old posts
    for (const p of L.posts) {
      c.fillStyle = '#7a5434'; c.strokeStyle = '#3e2a16'; c.lineWidth = 0.05;
      c.beginPath(); c.roundRect(p.x - 0.18, p.y0 - 0.3, 0.36, p.y1 - p.y0 + 0.4, 0.1); c.fill(); c.stroke();
      c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 0.04;
      for (let y = p.y0 + 0.4; y < p.y1; y += 0.7) { c.beginPath(); c.moveTo(p.x - 0.12, y); c.lineTo(p.x + 0.1, y + 0.15); c.stroke(); }
      c.fillStyle = '#5aa04a'; c.beginPath(); c.ellipse(p.x + 0.1, p.y0 + (p.y1 - p.y0) * 0.45, 0.16, 0.24, 0.3, 0, Math.PI * 2); c.fill();
    }
  }
  private flag(L: LevelDef) {
    const c = this.c, x = L.finish + 0.6, y = this.roadAt(L, x);
    c.strokeStyle = '#6a4a2a'; c.lineWidth = 0.08; c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 2.4); c.stroke();
    const wv = Math.sin(this.time * 4) * 0.12;
    c.fillStyle = '#ff6a4a'; c.beginPath(); c.moveTo(x, y + 2.4); c.quadraticCurveTo(x + 0.6, y + 2.25 + wv, x + 1.1, y + 2.1 + wv * 1.5); c.quadraticCurveTo(x + 0.6, y + 1.85 + wv, x, y + 1.75); c.fill();
    c.fillStyle = '#ffd84a'; c.beginPath(); c.arc(x + 0.42, y + 2.06 + wv * 0.6, 0.11, 0, Math.PI * 2); c.fill();
  }
  private roadAt(L: LevelDef, x: number) {
    for (const g of L.grounds) if (g.road) for (let i = 0; i + 1 < g.road.length; i++) { const [a, b] = [g.road[i], g.road[i + 1]]; if (x >= a[0] && x <= b[0]) return a[1] + ((x - a[0]) / (b[0] - a[0] || 1)) * (b[1] - a[1]); }
    return 0;
  }
  private grid(L: LevelDef, o: DrawOpts) {
    const c = this.c, b = L.build, s = this.cam.s;
    if (s < 9) return;
    c.fillStyle = 'rgba(255,255,255,0.55)';
    const r = Math.max(0.035, 1.6 / s);
    for (let x = Math.ceil(b.x0); x <= b.x1; x++) for (let y = Math.ceil(b.y0); y <= b.y1; y++) {
      c.globalAlpha = (x - L.mirror) === 0 && o.mirror ? 0.9 : 0.5;
      c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
    }
    c.globalAlpha = 1;
    if (o.mirror) {
      c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 0.05; c.setLineDash([0.25, 0.2]);
      c.beginPath(); c.moveTo(L.mirror, b.y0); c.lineTo(L.mirror, b.y1); c.stroke(); c.setLineDash([]);
    }
  }
  private boat(L: LevelDef, o: DrawOpts) {
    const c = this.c, B = L.boat!;
    // the clear lane: striped, faint while testing
    c.save();
    c.globalAlpha = o.sim ? 0.25 : 0.6;
    c.fillStyle = 'rgba(80,170,230,0.25)'; c.fillRect(B.x0, B.y0, B.x1 - B.x0, B.y1 - B.y0);
    c.beginPath(); c.rect(B.x0, B.y0, B.x1 - B.x0, B.y1 - B.y0); c.clip();
    c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = 0.12;
    for (let x = B.x0 - 6; x < B.x1; x += 0.6) { c.beginPath(); c.moveTo(x, B.y0); c.lineTo(x + (B.y1 - B.y0), B.y1); c.stroke(); }
    c.restore();
    c.strokeStyle = 'rgba(40,120,190,0.8)'; c.lineWidth = 0.05; c.setLineDash([0.3, 0.2]); c.strokeRect(B.x0, B.y0, B.x1 - B.x0, B.y1 - B.y0); c.setLineDash([]);
    // the boat itself: waiting at the left edge, then sailing through while testing
    const bx = o.sim ? o.sim.boatX : B.x0 - 3.5, by = L.water + Math.sin(this.time * 2) * 0.05;
    const hit = o.sim?.outcome === 'boat';
    const tip = hit ? Math.sin(this.time * 18) * 0.1 : 0;
    c.save(); c.translate(bx, by); c.rotate(tip);
    c.fillStyle = '#a0603a'; c.strokeStyle = '#4a2a14'; c.lineWidth = 0.05;
    c.beginPath(); c.moveTo(-1.3, 0.35); c.lineTo(1.3, 0.35); c.quadraticCurveTo(1.1, -0.25, 0.6, -0.3); c.lineTo(-0.7, -0.3); c.quadraticCurveTo(-1.2, -0.2, -1.3, 0.35); c.fill(); c.stroke();
    c.strokeStyle = '#5a3a1e'; c.lineWidth = 0.07; c.beginPath(); c.moveTo(0, 0.35); c.lineTo(0, B.y1 - L.water - 0.15); c.stroke();
    c.fillStyle = '#fff4dc'; c.beginPath(); c.moveTo(0.05, B.y1 - L.water - 0.25); c.lineTo(1.0, 0.6); c.lineTo(0.05, 0.6); c.fill(); c.stroke();
    c.fillStyle = '#ff8a6a'; c.beginPath(); c.moveTo(0, B.y1 - L.water - 0.15); c.lineTo(0.35, B.y1 - L.water - 0.27); c.lineTo(0, B.y1 - L.water - 0.38); c.fill();
    // a duck as the ferry's captain
    c.fillStyle = '#ffffff'; c.beginPath(); c.ellipse(-0.6, 0.5, 0.22, 0.15, 0, 0, Math.PI * 2); c.fill(); c.beginPath(); c.arc(-0.45, 0.7, 0.1, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ffa030'; c.beginPath(); c.moveTo(-0.37, 0.7); c.lineTo(-0.25, 0.67); c.lineTo(-0.37, 0.64); c.fill();
    c.restore();
  }
  /** A member's two ends with the drop-in wobble for new ones. */
  private memberPath(m: Mat, ax: number, ay: number, bx: number, by: number, born: number) {
    const c = this.c, age = this.time - born;
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
    const wob = age < 0.6 ? Math.sin(age * 28) * Math.exp(-age * 7) * 0.25 : 0;
    c.beginPath(); c.moveTo(ax, ay);
    c.quadraticCurveTo((ax + bx) / 2 + nx * wob, (ay + by) / 2 + ny * wob, bx, by);
    void m;
  }
  private drawMember(m: Mat, ax: number, ay: number, bx: number, by: number, o: { born?: number; stress?: number | null; slack?: number; hover?: boolean; ghost?: boolean; bad?: boolean }) {
    const c = this.c, col = MAT_COL[m], born = o.born ?? -9;
    c.lineCap = 'round'; c.lineJoin = 'round';
    if (m === 'twine' && o.slack && o.slack > 0.01) {
      // slack twine droops
      const mx = (ax + bx) / 2, my = (ay + by) / 2 - o.slack;
      c.strokeStyle = col.edge; c.lineWidth = col.w + 0.04; c.beginPath(); c.moveTo(ax, ay); c.quadraticCurveTo(mx, my, bx, by); c.stroke();
      c.strokeStyle = col.fill; c.lineWidth = col.w; c.beginPath(); c.moveTo(ax, ay); c.quadraticCurveTo(mx, my, bx, by); c.stroke();
      return;
    }
    if (o.hover) { c.strokeStyle = 'rgba(255,80,60,0.6)'; c.lineWidth = col.w + 0.28; this.memberPath(m, ax, ay, bx, by, born); c.stroke(); }
    c.globalAlpha = o.ghost ? 0.75 : 1;
    c.strokeStyle = o.bad ? '#b03020' : col.edge; c.lineWidth = col.w + 0.07; this.memberPath(m, ax, ay, bx, by, born); c.stroke();
    c.strokeStyle = o.bad ? '#ff8a7a' : col.fill; c.lineWidth = col.w; this.memberPath(m, ax, ay, bx, by, born); c.stroke();
    const len = Math.hypot(bx - ax, by - ay);
    if (m === 'plank') {
      // the grain and the nail heads
      c.strokeStyle = 'rgba(255,240,200,0.45)'; c.lineWidth = 0.035; this.memberPath(m, ax, ay, bx, by, born); c.stroke();
      c.fillStyle = '#5a3a1c';
      for (const t of [0.12, 0.88]) { c.beginPath(); c.arc(ax + (bx - ax) * t, ay + (by - ay) * t, 0.035, 0, Math.PI * 2); c.fill(); }
    } else if (m === 'bamboo') {
      c.strokeStyle = col.edge; c.lineWidth = 0.035;
      const n = Math.max(1, Math.round(len / 0.8)), dx = (bx - ax) / len, dy = (by - ay) / len;
      for (let i = 1; i < n; i++) { const px = ax + (bx - ax) * (i / n), py = ay + (by - ay) * (i / n); c.beginPath(); c.moveTo(px - dy * 0.11, py + dx * 0.11); c.lineTo(px + dy * 0.11, py - dx * 0.11); c.stroke(); }
    } else if (m === 'twig') {
      // a little knot and a leaf
      const px = ax + (bx - ax) * 0.62, py = ay + (by - ay) * 0.62;
      c.fillStyle = col.edge; c.beginPath(); c.arc(px, py, 0.06, 0, Math.PI * 2); c.fill();
      if (len > 1.5) { c.fillStyle = '#7cbf4a'; c.beginPath(); c.ellipse(px + 0.12, py + 0.1, 0.12, 0.06, 0.7, 0, Math.PI * 2); c.fill(); }
    } else if (m === 'twine') {
      c.strokeStyle = 'rgba(120,90,50,0.5)'; c.lineWidth = 0.03; c.setLineDash([0.08, 0.08]); this.memberPath(m, ax, ay, bx, by, born); c.stroke(); c.setLineDash([]);
    }
    if (o.stress !== undefined && o.stress !== null) {
      c.strokeStyle = stressColor(o.stress); c.globalAlpha = 0.85; c.lineWidth = Math.max(0.06, col.w * 0.55); this.memberPath(m, ax, ay, bx, by, born); c.stroke();
    }
    c.globalAlpha = 1;
  }
  private buildMembers(ms: readonly Member[], o: DrawOpts) {
    const keys = new Set<string>();
    for (const m of ms) { const k = mkey(m.ax, m.ay, m.bx, m.by) + m.m; keys.add(k); if (!this.known.has(k)) this.born.set(k, this.known.size || this.time > 0.5 ? this.time : -9); }
    this.known = keys;
    // draw twine first, then twigs and bamboo, planks on top
    const order: Mat[] = ['twine', 'twig', 'bamboo', 'plank'];
    for (const mat of order) ms.forEach((m, i) => { if (m.m === mat) this.drawMember(m.m, m.ax, m.ay, m.bx, m.by, { born: this.born.get(mkey(m.ax, m.ay, m.bx, m.by) + m.m), hover: o.tool === 'delete' && i === o.hover || (o.hover === i && o.tool === 'build' && false) }); });
    this.joints(ms.flatMap((m) => [[m.ax, m.ay], [m.bx, m.by]] as [number, number][]), o);
  }
  private simMembers(s: Sim, o: DrawOpts) {
    const order: Mat[] = ['twine', 'twig', 'bamboo', 'plank'];
    for (const mat of order) for (const m of s.members) {
      if (m.m !== mat || !m.alive) continue;
      const ax = s.x[m.a], ay = s.y[m.a], bx = s.x[m.b], by = s.y[m.b];
      let slack = 0;
      if (m.slack) { const d = Math.hypot(bx - ax, by - ay); slack = Math.sqrt(Math.max(0, 3 * d * (m.L - d) / 8)); }
      this.drawMember(m.m, ax, ay, bx, by, { stress: o.stress ? (m.slack ? 0 : m.ratio) : null, slack });
    }
    const pts: [number, number][] = [];
    for (const m of s.members) if (m.alive) { pts.push([s.x[m.a], s.y[m.a]], [s.x[m.b], s.y[m.b]]); }
    this.joints(pts, o);
  }
  private joints(pts: [number, number][], o: DrawOpts) {
    const c = this.c, L = this.level!, seen = new Set<string>();
    for (const [x, y] of pts) {
      const k = `${x.toFixed(2)},${y.toFixed(2)}`; if (seen.has(k)) continue; seen.add(k);
      if (!o.sim && L.anchors.some(([ax, ay]) => ax === x && ay === y)) continue;
      c.fillStyle = '#e8d2a0'; c.strokeStyle = '#6a4a24'; c.lineWidth = 0.04;
      c.beginPath(); c.arc(x, y, 0.13, 0, Math.PI * 2); c.fill(); c.stroke();
      c.strokeStyle = 'rgba(106,74,36,0.7)'; c.lineWidth = 0.03; c.beginPath(); c.moveTo(x - 0.09, y - 0.05); c.lineTo(x + 0.09, y + 0.05); c.stroke();
    }
    if (o.hoverNode && !o.sim) {
      const [x, y] = o.hoverNode;
      c.strokeStyle = o.tool === 'delete' ? 'rgba(255,90,70,0.9)' : 'rgba(255,255,255,0.95)'; c.lineWidth = 0.07;
      c.beginPath(); c.arc(x, y, 0.3 + Math.sin(this.time * 6) * 0.03, 0, Math.PI * 2); c.stroke();
    }
  }
  private anchors(L: LevelDef, o: DrawOpts) {
    const c = this.c;
    for (const [x, y] of L.anchors) {
      c.fillStyle = '#4a4a52'; c.strokeStyle = '#1e1e24'; c.lineWidth = 0.05;
      c.beginPath(); c.arc(x, y, 0.2, 0, Math.PI * 2); c.fill(); c.stroke();
      c.strokeStyle = '#c8c8d0'; c.lineWidth = 0.05; c.beginPath(); c.arc(x, y, 0.1, 0, Math.PI * 2); c.stroke();
      if (!o.sim && o.builder && !o.drag) {
        // a soft pulse so the starting points are easy to find
        c.strokeStyle = `rgba(255,236,150,${0.35 + Math.sin(this.time * 3 + x) * 0.2})`; c.lineWidth = 0.06;
        c.beginPath(); c.arc(x, y, 0.34, 0, Math.PI * 2); c.stroke();
      }
    }
  }
  private dragGhost(d: Drag, o: DrawOpts) {
    const c = this.c;
    this.drawMember(d.m, d.ax, d.ay, d.bx, d.by, { ghost: true, bad: !d.ok });
    c.strokeStyle = d.ok ? 'rgba(255,255,255,0.95)' : 'rgba(255,90,70,0.95)'; c.lineWidth = 0.06;
    c.beginPath(); c.arc(d.bx, d.by, 0.22, 0, Math.PI * 2); c.stroke();
    if (o.mirror && this.level) {
      const mx = 2 * this.level.mirror;
      c.globalAlpha = 0.4; this.drawMember(d.m, mx - d.ax, d.ay, mx - d.bx, d.by, { ghost: true, bad: !d.ok }); c.globalAlpha = 1;
    }
    // the reach of this material from the start
    c.strokeStyle = 'rgba(255,255,255,0.25)'; c.lineWidth = 0.04; c.setLineDash([0.15, 0.15]);
    c.beginPath(); c.arc(d.ax, d.ay, MAT[d.m].max, 0, Math.PI * 2); c.stroke(); c.setLineDash([]);
  }
  private guideHand(g: { from: [number, number]; to: [number, number] }) {
    const c = this.c, t = (this.time % 2.2) / 1.6, k = Math.min(1, Math.max(0, t));
    const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    const x = g.from[0] + (g.to[0] - g.from[0]) * e, y = g.from[1] + (g.to[1] - g.from[1]) * e;
    c.strokeStyle = 'rgba(255,224,110,0.9)'; c.lineWidth = 0.09; c.setLineDash([0.2, 0.14]);
    c.beginPath(); c.moveTo(g.from[0], g.from[1]); c.lineTo(g.to[0], g.to[1]); c.stroke(); c.setLineDash([]);
    for (const [px, py] of [g.from, g.to]) { c.fillStyle = 'rgba(255,224,110,0.35)'; c.beginPath(); c.arc(px, py, 0.38 + Math.sin(this.time * 5) * 0.05, 0, Math.PI * 2); c.fill(); }
    // a paw pressing and dragging
    c.save(); c.translate(x + 0.15, y - 0.35); c.scale(1, -1);
    c.fillStyle = '#fff4e8'; c.strokeStyle = '#7a5a40'; c.lineWidth = 0.04;
    c.beginPath(); c.ellipse(0, 0, 0.26, 0.22, 0, 0, Math.PI * 2); c.fill(); c.stroke();
    c.fillStyle = '#f4a0b0';
    for (const [tx, ty] of [[-0.15, -0.22], [0, -0.28], [0.15, -0.22]]) { c.beginPath(); c.arc(tx, ty, 0.07, 0, Math.PI * 2); c.fill(); }
    c.beginPath(); c.ellipse(0, 0.02, 0.12, 0.09, 0, 0, Math.PI * 2); c.fill();
    c.restore();
  }
  // ---------------------------------------------------------------- vehicles
  private vehicles(L: LevelDef, o: DrawOpts) {
    this.cartRect = null;
    if (o.sim) {
      o.sim.vehicles.forEach((v, i) => this.vehicle(L, v, i, o));
    } else {
      // waiting at the start, ready to roll
      L.vehicles.forEach((kind, i) => {
        const d = VEHICLE[kind], rear = i === 0 ? L.start : L.start - d.gap - d.base, y = this.roadAt(L, rear) + d.r;
        const fake = { kind, def: d, x: [rear, rear + d.base], y: [y, this.roadAt(L, rear + d.base) + d.r], roll: [0, 0], fell: false, done: false } as unknown as Vehicle;
        this.vehicle(L, fake, i, o);
      });
    }
  }
  private vehicle(L: LevelDef, v: Vehicle, i: number, o: DrawOpts) {
    const c = this.c, d = v.def;
    let rx = v.x[0], ry = v.y[0], fx = v.x[1], fy = v.y[1];
    // fallen in: bob soggily at the surface where it went in
    if (v.fell && L.floor === 'water') {
      const sk = this.sunk[i] ?? (this.sunk[i] = { x: (rx + fx) / 2, t: this.time });
      const bob = Math.sin((this.time - sk.t) * 3) * 0.08, mx = sk.x;
      rx = mx - d.base / 2; fx = mx + d.base / 2; ry = fy = L.water - d.r * 0.6 + bob;
    }
    const ang = Math.atan2(fy - ry, fx - rx);
    const pose: Pose = v.fell ? 'soggy' : o.celebrate || v.done ? 'cheer' : o.sim && o.sim.strain > 0.82 && !o.sim.outcome ? 'nervous' : 'ride';
    if (v.kind === 'cart') {
      this.poseNow = pose;
      const im = this.img(`cart-${pose}`) ?? (pose === 'soggy' ? this.img('cart-nervous') : null) ?? this.img('cart-ride');
      const A = CART_ART, k = d.base / (A.front[0] - A.rear[0]);
      c.save(); c.translate(rx, ry); c.rotate(ang);
      if (im) {
        c.scale(k, -k);
        c.drawImage(im, -A.rear[0], -A.rear[1], A.w, A.h);
        if (pose === 'soggy') {
          // drips running off their fur
          c.fillStyle = 'rgba(170, 215, 245, 0.9)';
          for (let i = 0; i < 7; i++) {
            const px = 120 + i * 70, ph = ((this.time * 0.9 + i * 0.37) % 1), py = -A.rear[1] + 240 + (i % 3) * 30 + ph * 140;
            c.globalAlpha = 1 - ph; c.beginPath(); c.ellipse(px - A.rear[0] + 60, py, 7, 11, 0, 0, Math.PI * 2); c.fill();
          }
          c.globalAlpha = 1;
        }
        c.restore();
        // the painted cart's box on screen (for the framing checks)
        const corners = [[-A.rear[0], -A.rear[1]], [A.w - A.rear[0], -A.rear[1]], [-A.rear[0], A.h - A.rear[1]], [A.w - A.rear[0], A.h - A.rear[1]]].map(([px, py]) => {
          const wx = rx + (px * Math.cos(ang) + py * Math.sin(ang)) * k, wy = ry + (px * Math.sin(ang) - py * Math.cos(ang)) * k; return this.toScreen(wx, wy);
        });
        const xs = corners.map((p) => p[0]), ys = corners.map((p) => p[1]);
        // the figures fill roughly the middle of the painting
        const bx = Math.min(...xs), by = Math.min(...ys), bw = Math.max(...xs) - bx, bh = Math.max(...ys) - by;
        this.cartRect = { x: bx + bw * 0.12, y: by + bh * 0.08, w: bw * 0.76, h: bh * 0.84 };
      } else {
        this.drawnCart(d, pose);
        c.restore();
        const [sx, sy] = this.toScreen((rx + fx) / 2, (ry + fy) / 2 + 0.9);
        const h = 2.2 * this.cam.s; this.cartRect = { x: sx - h * 0.7, y: sy - h / 2, w: h * 1.4, h };
      }
    } else {
      c.save(); c.translate(rx, ry); c.rotate(ang);
      this.wagon(d, v.fell);
      c.restore();
    }
    // the wheels, spinning
    if (!(v.fell && L.floor === 'water')) for (let k = 0; k < 2; k++) this.wheel(k ? fx : rx, k ? fy : ry, d.r, -(v.roll[k] ?? 0) / d.r);
  }
  private wheel(x: number, y: number, r: number, a: number) {
    const c = this.c;
    c.save(); c.translate(x, y); c.rotate(a);
    c.fillStyle = '#8a5a30'; c.strokeStyle = '#3e2410'; c.lineWidth = r * 0.16;
    c.beginPath(); c.arc(0, 0, r * 0.92, 0, Math.PI * 2); c.fill(); c.stroke();
    c.strokeStyle = '#c8955a'; c.lineWidth = r * 0.12;
    for (let i = 0; i < 3; i++) { const q = (i / 3) * Math.PI; c.beginPath(); c.moveTo(Math.cos(q) * r * 0.75, Math.sin(q) * r * 0.75); c.lineTo(-Math.cos(q) * r * 0.75, -Math.sin(q) * r * 0.75); c.stroke(); }
    c.fillStyle = '#3e2410'; c.beginPath(); c.arc(0, 0, r * 0.2, 0, Math.PI * 2); c.fill();
    c.restore();
  }
  /** The stand-in cart: an acorn-cup cart with the shared drawn chinchillas in it. */
  private drawnCart(d: { base: number }, pose: Pose) {
    const c = this.c, w = d.base;
    c.save(); c.scale(1, -1);
    // the chinchillas sit low in the cup
    const h = 1.15, up = pose === 'cheer' ? -0.1 : 0;
    drawChinchilla(c, 'enzo', w * 0.3, -0.55 + up, { face: 1, h, time: this.time });
    drawChinchilla(c, 'dora', w * 0.75, -0.5 + up, { face: 1, h: h * 0.85, time: this.time + 1 });
    c.restore();
    // the acorn cup over their legs
    c.fillStyle = '#a0602a'; c.strokeStyle = '#4a2a10'; c.lineWidth = 0.05;
    c.beginPath(); c.moveTo(-0.35, 0.7); c.lineTo(w + 0.35, 0.7); c.quadraticCurveTo(w + 0.2, 0.05, w / 2, 0.08); c.quadraticCurveTo(-0.2, 0.05, -0.35, 0.7); c.fill(); c.stroke();
    c.fillStyle = '#7a4a1e'; c.fillRect(-0.3, 0.02, w + 0.6, 0.14);
  }
  private wagon(d: { base: number }, fell: boolean) {
    const c = this.c, w = d.base;
    c.fillStyle = '#8a5a30'; c.strokeStyle = '#3e2410'; c.lineWidth = 0.05;
    c.beginPath(); c.roundRect(-0.45, 0.15, w + 0.9, 0.75, 0.08); c.fill(); c.stroke();
    c.strokeStyle = 'rgba(0,0,0,0.25)'; for (let x = -0.1; x < w + 0.45; x += 0.45) { c.beginPath(); c.moveTo(x, 0.2); c.lineTo(x, 0.85); c.stroke(); }
    // the hay
    c.fillStyle = fell ? '#b8a860' : '#f0d070'; c.strokeStyle = '#a88a30';
    c.beginPath(); c.moveTo(-0.4, 0.9); c.quadraticCurveTo(-0.3, 1.9, w / 2, 2.0); c.quadraticCurveTo(w + 0.5, 1.9, w + 0.4, 0.9); c.closePath(); c.fill(); c.stroke();
    c.strokeStyle = '#d0a840'; c.lineWidth = 0.03;
    for (let i = 0; i < 9; i++) { const x = -0.2 + (i / 8) * (w + 0.4); c.beginPath(); c.moveTo(x, 1.0 + (i % 3) * 0.2); c.lineTo(x + 0.25, 1.3 + (i % 2) * 0.3); c.stroke(); }
    c.strokeStyle = '#3e2410'; c.lineWidth = 0.06; c.beginPath(); c.moveTo(w + 0.45, 0.4); c.lineTo(w + 1.0, 0.55); c.stroke();
  }
  // ---------------------------------------------------------------- bits and wind
  private drawBits(dt: number) {
    const c = this.c, L = this.level!;
    const keep: Bit[] = [];
    for (const b of this.bits) {
      b.life += dt; if (b.life < 0) { keep.push(b); continue; }
      if (b.life > b.max) continue;
      const g = b.kind === 'puff' ? 1 : b.kind === 'leaf' ? 0.6 : b.kind === 'confetti' ? 4 : b.kind === 'ring' ? 0 : 10;
      b.vy -= g * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.a += b.va * dt;
      if (b.kind === 'confetti' || b.kind === 'puff') { b.vx *= 1 - dt * 1.5; b.vy *= 1 - dt * 1.2; }
      if ((b.kind === 'drop' || b.kind === 'splinter') && L.floor === 'water' && b.y < L.water && b.vy < 0) { b.life = b.max; continue; }
      keep.push(b);
      const f = 1 - b.life / b.max;
      c.globalAlpha = Math.min(1, f * 2);
      if (b.kind === 'half' && b.m) { c.save(); c.translate(b.x, b.y); c.rotate(b.a); const hl = (b.len ?? 1) / 2; this.drawMember(b.m, -hl, 0, hl, 0, {}); c.restore(); }
      else if (b.kind === 'splinter' || b.kind === 'confetti') { c.save(); c.translate(b.x, b.y); c.rotate(b.a); c.fillStyle = b.color; c.fillRect(-b.size, -b.size * 0.35, b.size * 2, b.size * 0.7); c.restore(); }
      else if (b.kind === 'drop') { c.fillStyle = b.color; c.beginPath(); c.arc(b.x, b.y, b.size, 0, Math.PI * 2); c.fill(); }
      else if (b.kind === 'puff') { c.fillStyle = b.color; c.beginPath(); c.arc(b.x, b.y, b.size * (1 + b.life), 0, Math.PI * 2); c.fill(); }
      else if (b.kind === 'ring') { c.strokeStyle = b.color; c.lineWidth = 0.06; c.beginPath(); c.ellipse(b.x, b.y, b.size + b.life * 1.6, (b.size + b.life * 1.6) * 0.3, 0, 0, Math.PI * 2); c.stroke(); }
    }
    c.globalAlpha = 1;
    this.bits = keep;
  }
  private windStreaks(s: Sim, dt: number) {
    const c = this.c, [wx, wy] = s.wind, k = Math.hypot(wx, wy);
    if (k < 0.5) return;
    void dt;
    c.save(); c.strokeStyle = `rgba(255,255,255,${Math.min(0.55, k / 14)})`; c.lineWidth = 2; c.lineCap = 'round';
    const dir = Math.sign(wx) || -1;
    for (let i = 0; i < 22; i++) {
      const sp = 260 + (i % 5) * 60, x = ((i * 197 + dir * this.time * sp) % (this.W + 300) + this.W + 300) % (this.W + 300) - 150;
      const y = ((i * 89) % Math.max(1, this.H - 60)) + 30 + Math.sin(this.time * 2 + i) * 8;
      const l = 30 + (i % 4) * 14;
      c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x - dir * l * 0.5, y - wy * 2, x - dir * l, y); c.stroke();
    }
    c.restore();
  }
  /** On-screen words drawn in the canvas: the length and cost of the member being dragged. */
  private labels(o: DrawOpts) {
    const c = this.c, d = o.drag; if (!d) return;
    const [sx, sy] = this.toScreen((d.ax + d.bx) / 2, (d.ay + d.by) / 2);
    const txt = d.ok ? `${MAT[d.m].name} · ${lenOf({ ax: d.ax, ay: d.ay, bx: d.bx, by: d.by, m: d.m }).toFixed(1)} · 🌰 ${d.cost}` : d.why ?? 'Can’t go there';
    c.font = '800 13px ui-rounded, system-ui, sans-serif';
    const w = c.measureText(txt).width + 16;
    const x = Math.max(4, Math.min(this.W - w - 4, sx - w / 2)), y = Math.max(4, sy - 44);
    c.fillStyle = d.ok ? 'rgba(42,30,16,0.86)' : 'rgba(150,40,30,0.92)';
    c.beginPath(); c.roundRect(x, y, w, 24, 12); c.fill();
    c.fillStyle = '#fff'; c.textBaseline = 'middle'; c.fillText(txt, x + 8, y + 12);
  }
}

// ---------------------------------------------------------------- stand-in paintings for the menus
function sky(c: CanvasRenderingContext2D, W: number, H: number, r: RegionId) {
  const [a, b, g] = SKY[r], gr = c.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, a); gr.addColorStop(0.6, b); gr.addColorStop(1, g); c.fillStyle = gr; c.fillRect(0, 0, W, H);
}
/** A little drawn picture of a region, for the level cards until (or unless) the painting loads. */
export function paintRegion(cv: HTMLCanvasElement, r: RegionId) {
  const c = cv.getContext('2d'); if (!c) return;
  const W = cv.width, H = cv.height, E = EARTH[r];
  sky(c, W, H, r);
  c.fillStyle = E.top;
  c.beginPath(); c.moveTo(0, H * 0.55); c.lineTo(W * 0.32, H * 0.55); c.lineTo(W * 0.36, H); c.lineTo(0, H); c.fill();
  c.beginPath(); c.moveTo(W, H * 0.55); c.lineTo(W * 0.68, H * 0.55); c.lineTo(W * 0.64, H); c.lineTo(W, H); c.fill();
  c.fillStyle = r === 'canyon' ? '#7a3a2a' : r === 'ravine' ? '#2c4a3a' : '#5ab0d8'; c.fillRect(W * 0.34, H * 0.85, W * 0.32, H * 0.15);
  c.strokeStyle = '#d29a5a'; c.lineWidth = H * 0.04; c.beginPath(); c.moveTo(W * 0.32, H * 0.55); c.lineTo(W * 0.68, H * 0.55); c.stroke();
  c.strokeStyle = '#7a4e24'; c.lineWidth = H * 0.015;
  for (let i = 0; i < 4; i++) { const x = W * (0.32 + i * 0.09); c.beginPath(); c.moveTo(x, H * 0.55); c.lineTo(x + W * 0.045, H * 0.68); c.lineTo(x + W * 0.09, H * 0.55); c.stroke(); }
}
export function paintTitle(cv: HTMLCanvasElement, t = 0.4) {
  const c = cv.getContext('2d'); if (!c) return;
  const W = cv.width, H = cv.height;
  paintRegion(cv, 'brook');
  drawChinchilla(c, 'enzo', W * 0.45, H * 0.55, { face: 1, h: H * 0.14, time: t });
  drawChinchilla(c, 'dora', W * 0.55, H * 0.55, { face: 1, h: H * 0.12, time: t });
}
export function paintEnding(cv: HTMLCanvasElement, t = 0.4) {
  const c = cv.getContext('2d'); if (!c) return;
  const W = cv.width, H = cv.height;
  paintRegion(cv, 'canyon');
  drawChinchilla(c, 'enzo', W * 0.18, H * 0.55, { face: 1, h: H * 0.16, time: t });
  drawChinchilla(c, 'dora', W * 0.26, H * 0.55, { face: 1, h: H * 0.14, time: t });
}
