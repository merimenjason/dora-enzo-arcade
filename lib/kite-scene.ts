// Kite Day's scene: Canvas 2D, painted like a watercolour picture book. The place's painting (sky and far landscape)
// sits behind; the ground, trees, buildings, water, targets, kites, lines and wind are painted in code as layered
// translucent washes with a darker pooled edge and a few opaque gouache highlights, then a paper grain over it all.
// Dora and Enzo are painted cut-outs, drawn large (picture-book scale) with their paws on the reel the line leaves.
// Drawing only: the flight itself lives in kite-game.ts.
import {
  COLOURS, SHAPES, groundAt, surfaceAt, waterAt, windAt, gustAt, treeCanopy, targetAt, dragonflyAt,
  type Flight, type Kite, type Design, type Shape, type Stencil, type Place, type Target, type Ev, type Who,
} from './kite-game';

// ---------------------------------------------------------------- colour
const hexRGB = (h: string): [number, number, number] => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const rgba = (h: string, a: number) => { const [r, g, b] = hexRGB(h); return `rgba(${r},${g},${b},${a})`; };
const mix = (a: string, b: string, t: number, al = 1) => { const x = hexRGB(a), y = hexRGB(b); return `rgba(${Math.round(x[0] + (y[0] - x[0]) * t)},${Math.round(x[1] + (y[1] - x[1]) * t)},${Math.round(x[2] + (y[2] - x[2]) * t)},${al})`; };
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const INK = '#3a3550', PAPER = '#fbf3df';
/** A tiny seeded generator for the scene's own wobbles (the engine has its own). */
const lcg = (seed: number) => { let s = (seed * 9301 + 49297) % 233280 || 1; return () => (s = (s * 9301 + 49297) % 233280) / 233280; };

// ---------------------------------------------------------------- the paintings
export const POSES = ['pull', 'run', 'cheer', 'sit'] as const;
export type Pose = (typeof POSES)[number];
/** Each cut-out's size and where its reel is (as fractions of the picture), measured when the sheets were keyed. */
export const SPRITE: Record<Who, Record<Pose, { w: number; h: number; reel: [number, number] }>> = {
  dora: { pull: { w: 587, h: 600, reel: [0.875, 0.466] }, run: { w: 670, h: 587, reel: [0.912, 0.574] }, cheer: { w: 636, h: 601, reel: [0.241, 0.127] }, sit: { w: 583, h: 587, reel: [0.824, 0.65] } },
  enzo: { pull: { w: 628, h: 600, reel: [0.881, 0.437] }, run: { w: 710, h: 592, reel: [0.911, 0.523] }, cheer: { w: 635, h: 664, reel: [0.209, 0.099] }, sit: { w: 641, h: 576, reel: [0.721, 0.673] } },
};
export const ART = '/art/kite/';
export const BACKDROPS = ['meadow', 'orchard', 'beach', 'hilltop', 'fete', 'cliffs'].map((p) => `${ART}bg-${p}.webp`);
export const SPRITES = (['dora', 'enzo'] as Who[]).flatMap((w) => POSES.map((p) => `${ART}${w}-${p}.webp`));

// ---------------------------------------------------------------- watercolour helpers
/** An irregular round blob, like a dab of wet paint. */
function blobPath(c: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, seed: number, wob = 0.14, n = 20) {
  const r = lcg(seed); c.beginPath();
  const k: number[] = []; for (let i = 0; i < n; i++) k.push(1 + (r() * 2 - 1) * wob);
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2, f = k[i % n];
    const x = cx + Math.cos(a) * rx * f, y = cy + Math.sin(a) * ry * f;
    if (i === 0) c.moveTo(x, y); else { const pa = ((i - 0.5) / n) * Math.PI * 2, pf = (k[i % n] + k[(i - 1) % n]) / 2 * 1.04; c.quadraticCurveTo(cx + Math.cos(pa) * rx * pf, cy + Math.sin(pa) * ry * pf, x, y); }
  }
  c.closePath();
}
/** A wash: a translucent fill, a second lighter dab inside it and a darker pooled edge. */
function wash(c: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, col: string, seed: number, alpha = 0.85) {
  blobPath(c, cx, cy, rx, ry, seed); c.fillStyle = rgba(col, alpha); c.fill();
  c.lineWidth = Math.max(1, rx * 0.06); c.strokeStyle = mix(col, INK, 0.35, 0.35); c.stroke();
  blobPath(c, cx - rx * 0.18, cy - ry * 0.2, rx * 0.62, ry * 0.55, seed + 7, 0.2); c.fillStyle = mix(col, '#fffbe8', 0.35, 0.35); c.fill();
}

// ---------------------------------------------------------------- the kites
type Pt = [number, number];
/** Each kite's outline in its own frame: the nose points along +x, the length nose-to-tail is about 1. */
const OUTLINE: Record<Shape, Pt[]> = {
  diamond: [[0.55, 0], [0.05, 0.4], [-0.75, 0], [0.05, -0.4]],
  sled: [[0.5, 0.33], [0.5, -0.33], [-0.12, -0.44], [-0.5, -0.3], [-0.6, 0], [-0.5, 0.3], [-0.12, 0.44]],
  delta: [[0.6, 0], [-0.45, 0.66], [-0.3, 0.12], [-0.42, 0], [-0.3, -0.12], [-0.45, -0.66]],
  box: [[0.58, 0.3], [0.58, -0.3], [-0.58, -0.3], [-0.58, 0.3]],
  bird: [[0.62, 0], [0.36, 0.09], [0.02, 0.74], [-0.2, 0.72], [-0.1, 0.13], [-0.42, 0.24], [-0.72, 0.32], [-0.5, 0], [-0.72, -0.32], [-0.42, -0.24], [-0.1, -0.13], [-0.2, -0.72], [0.02, -0.74], [0.36, -0.09]],
  dragon: [[0.55, 0], [0.25, 0.4], [-0.3, 0.34], [-0.48, 0], [-0.3, -0.34], [0.25, -0.4]],
};
const SPARS: Record<Shape, [Pt, Pt][]> = {
  diamond: [[[0.55, 0], [-0.75, 0]], [[0.05, 0.4], [0.05, -0.4]]],
  sled: [[[0.5, 0.2], [-0.52, 0.2]], [[0.5, -0.2], [-0.52, -0.2]]],
  delta: [[[0.6, 0], [-0.45, 0.66]], [[0.6, 0], [-0.45, -0.66]], [[0.6, 0], [-0.42, 0]], [[-0.1, 0.42], [-0.1, -0.42]]],
  box: [[[0.58, 0.3], [-0.58, 0.3]], [[0.58, -0.3], [-0.58, -0.3]], [[0.58, 0], [-0.58, 0]]],
  bird: [[[0.62, 0], [-0.5, 0]], [[0.3, 0.06], [0.02, 0.72]], [[0.3, -0.06], [0.02, -0.72]]],
  dragon: [[[0.55, 0], [-0.48, 0]], [[0.1, 0.38], [0.1, -0.38]]],
};
function tracePoly(c: CanvasRenderingContext2D, pts: Pt[]) { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); }
function stencil(c: CanvasRenderingContext2D, st: Stencil, col: string) {
  c.fillStyle = col; c.strokeStyle = col; c.lineCap = 'round'; c.lineJoin = 'round';
  switch (st) {
    case 'plain': break;
    case 'stripes': for (let i = -4; i <= 4; i++) c.fillRect(i * 0.26 - 0.06, -1, 0.12, 2); break;
    case 'dots': for (let x = -4; x <= 4; x++) for (let y = -4; y <= 4; y++) { c.beginPath(); c.arc(x * 0.22 + (y % 2) * 0.11, y * 0.2, 0.055, 0, 7); c.fill(); } break;
    case 'sun': c.beginPath(); c.arc(0, 0, 0.15, 0, 7); c.fill(); c.lineWidth = 0.045; for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; c.beginPath(); c.moveTo(Math.cos(a) * 0.21, Math.sin(a) * 0.21); c.lineTo(Math.cos(a) * 0.32, Math.sin(a) * 0.32); c.stroke(); } break;
    case 'leaf': c.beginPath(); c.moveTo(0.36, 0); c.quadraticCurveTo(0, 0.28, -0.36, 0); c.quadraticCurveTo(0, -0.28, 0.36, 0); c.fill(); c.lineWidth = 0.025; c.strokeStyle = 'rgba(255,255,240,.7)'; c.beginPath(); c.moveTo(0.3, 0); c.lineTo(-0.34, 0); for (let i = -2; i <= 2; i++) { c.moveTo(i * 0.1, 0); c.lineTo(i * 0.1 - 0.08, 0.1); c.moveTo(i * 0.1, 0); c.lineTo(i * 0.1 - 0.08, -0.1); } c.stroke(); break;
    case 'waves': c.lineWidth = 0.06; for (let k = -2; k <= 2; k++) { c.beginPath(); for (let y = -0.8; y <= 0.8; y += 0.05) { const x = k * 0.22 + Math.sin(y * 14) * 0.05; if (y === -0.8) c.moveTo(x, y); else c.lineTo(x, y); } c.stroke(); } break;
    case 'feather': c.lineWidth = 0.05; for (let k = -3; k <= 3; k++) { c.beginPath(); c.moveTo(k * 0.2 + 0.12, -0.7); c.lineTo(k * 0.2, 0); c.lineTo(k * 0.2 + 0.12, 0.7); c.stroke(); } break;
    case 'star': { c.beginPath(); for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2, r = i % 2 ? 0.1 : 0.26; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); c.fill(); break; }
    case 'heart': c.beginPath(); c.moveTo(-0.2, 0); c.bezierCurveTo(0.05, 0.05, 0.2, 0.3, 0.06, 0.2); c.bezierCurveTo(0.0, 0.12, -0.02, 0.06, 0, 0); c.bezierCurveTo(-0.02, -0.06, 0.0, -0.12, 0.06, -0.2); c.bezierCurveTo(0.2, -0.3, 0.05, -0.05, -0.2, 0); c.fill(); break;
  }
}
/** Paints a kite at (x, y) on the canvas, nose at screen angle `ang` (radians, canvas y down), `size` px nose to tail. */
export function paintKite(c: CanvasRenderingContext2D, design: Design, x: number, y: number, ang: number, size: number, t = 0, alpha = 1) {
  const sh = design.shape, p = design.paint, sail = COLOURS[p.sail], ink = COLOURS[p.ink];
  c.save(); c.translate(x, y); c.rotate(ang); c.scale(size, size); c.globalAlpha = alpha;
  // a soft wet shadow under it
  c.save(); c.translate(0.04, 0.06); tracePoly(c, OUTLINE[sh]); c.fillStyle = 'rgba(40,30,60,.16)'; c.fill(); c.restore();
  const cells: Pt[][] = sh === 'box' ? [[[0.58, 0.3], [0.58, -0.3], [0.18, -0.3], [0.18, 0.3]], [[-0.18, 0.3], [-0.18, -0.3], [-0.58, -0.3], [-0.58, 0.3]]] : [OUTLINE[sh]];
  for (const cell of cells) {
    tracePoly(c, cell);
    // the sail: a wash with a bloom of light where the sun catches it
    const g = c.createLinearGradient(-0.6, -0.5, 0.6, 0.5); g.addColorStop(0, mix(sail, '#fff6dc', 0.28)); g.addColorStop(0.55, sail); g.addColorStop(1, mix(sail, INK, 0.22));
    c.fillStyle = g; c.fill();
    c.save(); c.clip();
    c.globalAlpha = alpha * 0.9; stencil(c, p.stencil, ink); c.globalAlpha = alpha;
    // flutter: a soft fold that ripples along the sail
    const f = Math.sin(t * 7 + x * 0.01) * 0.06;
    c.fillStyle = 'rgba(255,255,255,.12)'; c.beginPath(); c.ellipse(0.1 + f, -0.12, 0.45, 0.16, 0.3, 0, 7); c.fill();
    c.fillStyle = 'rgba(40,30,60,.10)'; c.beginPath(); c.ellipse(-0.15, 0.2 + f, 0.5, 0.14, -0.2, 0, 7); c.fill();
    c.restore();
    // the pooled darker edge of the wash
    tracePoly(c, cell); c.lineJoin = 'round'; c.lineWidth = 0.05; c.strokeStyle = mix(sail, INK, 0.5, 0.75); c.stroke();
  }
  if (sh === 'sled') { c.beginPath(); c.ellipse(-0.28, 0, 0.1, 0.16, 0, 0, 7); c.fillStyle = 'rgba(160,200,230,.75)'; c.fill(); c.lineWidth = 0.03; c.strokeStyle = mix(sail, INK, 0.5, 0.6); c.stroke(); }
  // spars: a dark line with a crisp gouache highlight along it
  c.lineCap = 'round';
  for (const [[ax, ay], [bx, by]] of SPARS[sh]) {
    c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.lineWidth = 0.045; c.strokeStyle = 'rgba(80,52,30,.85)'; c.stroke();
    c.beginPath(); c.moveTo(ax - 0.01, ay - 0.012); c.lineTo(bx - 0.01, by - 0.012); c.lineWidth = 0.014; c.strokeStyle = 'rgba(255,248,225,.85)'; c.stroke();
  }
  if (sh === 'dragon') {
    // a friendly face
    c.fillStyle = PAPER; c.beginPath(); c.arc(0.18, 0.14, 0.09, 0, 7); c.arc(0.18, -0.14, 0.09, 0, 7); c.fill();
    c.fillStyle = INK; c.beginPath(); c.arc(0.21, 0.14, 0.045, 0, 7); c.arc(0.21, -0.14, 0.045, 0, 7); c.fill();
    c.strokeStyle = mix(ink, INK, 0.2, 0.9); c.lineWidth = 0.035; c.beginPath(); c.moveTo(0.45, 0.06); c.quadraticCurveTo(0.65, 0.3, 0.55, 0.5); c.moveTo(0.45, -0.06); c.quadraticCurveTo(0.65, -0.3, 0.55, -0.5); c.stroke();
  }
  if (sh === 'bird') { c.fillStyle = INK; c.beginPath(); c.arc(0.42, 0.04, 0.035, 0, 7); c.fill(); }
  c.restore();
}
/** The tail: a ribbon through the tail points, with bows (or, for the dragon, a long scaly streamer). */
function paintTail(c: CanvasRenderingContext2D, pts: Pt[], design: Design, w: number, t: number) {
  if (pts.length < 2) return;
  const col = COLOURS[design.paint.tail], dragon = design.shape === 'dragon';
  c.lineCap = 'round'; c.lineJoin = 'round';
  // the ribbon ripples: each point swings across the tail's direction, more toward the free end
  const n = pts.length;
  pts = pts.map(([x, y], i) => {
    if (i === 0) return [x, y] as Pt;
    const [px, py] = pts[i - 1], d = Math.hypot(x - px, y - py) || 1, a = Math.sin(t * 7 - i * 0.9) * w * 1.6 * (i / n);
    return [x + (-(y - py) / d) * a, y + ((x - px) / d) * a] as Pt;
  });
  // a smooth curve through the points
  const curve = () => { c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < n - 1; i++) { const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2; c.quadraticCurveTo(pts[i][0], pts[i][1], mx, my); } c.lineTo(pts[n - 1][0], pts[n - 1][1]); };
  curve(); c.lineWidth = (dragon ? w * 1.8 : w * 1.3) + 2; c.strokeStyle = mix(col, INK, 0.45, 0.45); c.stroke();
  curve(); c.lineWidth = dragon ? w * 1.8 : w * 1.3; c.strokeStyle = rgba(col, 0.92); c.stroke();
  c.lineWidth = Math.max(1, w * 0.4); c.strokeStyle = mix(col, '#fff6dc', 0.5, 0.55); c.stroke();
  if (dragon) {
    const alt = COLOURS[design.paint.sail];
    for (let i = 1; i < pts.length; i += 1) { const [x, y] = pts[i]; c.fillStyle = rgba(i % 2 ? alt : COLOURS[design.paint.ink], 0.85); c.beginPath(); c.arc(x, y, w * (1.1 - i / pts.length * 0.5), 0, 7); c.fill(); }
  } else {
    for (let i = 2; i < pts.length; i += 2) {
      const [x, y] = pts[i], [px, py] = pts[i - 1], a = Math.atan2(y - py, x - px) + Math.PI / 2, s = w * 1.6, wob = Math.sin(t * 6 + i) * 0.3;
      c.fillStyle = rgba(col, 0.95); c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a + 0.5 + wob) * s, y + Math.sin(a + 0.5 + wob) * s); c.lineTo(x + Math.cos(a - 0.5 + wob) * s, y + Math.sin(a - 0.5 + wob) * s); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(x, y); c.lineTo(x - Math.cos(a + 0.5 - wob) * s, y - Math.sin(a + 0.5 - wob) * s); c.lineTo(x - Math.cos(a - 0.5 - wob) * s, y - Math.sin(a - 0.5 - wob) * s); c.closePath(); c.fill();
    }
  }
}
/** A kite on its own, for the workshop: hanging in a soft sky with its tail drifting. */
export function paintKitePreview(cv: HTMLCanvasElement, design: Design, t: number) {
  const c = cv.getContext('2d'); if (!c) return;
  const w = cv.width, h = cv.height; c.clearRect(0, 0, w, h);
  const size = Math.min(w, h) * 0.5, cx = w * 0.5, cy = h * 0.4, ang = -Math.PI / 2 + Math.sin(t * 0.9) * 0.12;
  const n = 9, L = SHAPES[design.shape].tail * size * 0.17;
  const pts: Pt[] = []; for (let i = 0; i < n; i++) { const u = i / (n - 1); pts.push([cx - Math.cos(ang) * size * 0.72 + Math.sin(t * 2.2 + u * 4) * u * size * 0.12 + u * size * 0.08, cy - Math.sin(ang) * size * 0.72 + u * L]); }
  paintTail(c, pts, design, Math.max(3, size * 0.045), t);
  paintKite(c, design, cx, cy, ang, size, t);
}

// ---------------------------------------------------------------- the scene
type Seed = { x: number; y: number; vx: number; vy: number; a: number; s: number };
type Fx = { kind: 'petal' | 'spark' | 'drop' | 'leaf' | 'confetti' | 'seed'; x: number; y: number; vx: number; vy: number; life: number; max: number; col: string; r: number; spin: number };
type Pop = { text: string; x: number; y: number; life: number; col: string; big: boolean };
type Streak = { x: number; y: number; len: number; a: number };
export type DrawOpts = {
  dt: number; pose: Pose; aim: Pt | null; insets: { top: number; bottom: number; left: number; right: number };
  /** the routine's beat clock and a "get ready" for the camera */
  showAim: boolean; arrow: boolean;
};
export class KiteScene {
  readonly cv: HTMLCanvasElement; readonly c: CanvasRenderingContext2D;
  w = 800; h = 600; dpr = 1;
  imgs = new Map<string, HTMLImageElement>();
  cam = { x: 0, y: 0, s: 30, ready: false };
  private seeds: Seed[] = []; private fx: Fx[] = []; private pops: Pop[] = []; private streaks: Streak[] = [];
  private grain: CanvasPattern | null = null;
  private r = lcg(7); private time = 0; private cheerT = 0; private flight: Flight | null = null;
  /** where things were last drawn, for the page and the browser tests */
  last = { reel: [0, 0] as Pt, kite: [0, 0] as Pt, sprite: [0, 0, 0, 0] as [number, number, number, number], kiteSize: 0, ground: 0 };
  constructor(cv: HTMLCanvasElement) {
    this.cv = cv; const c = cv.getContext('2d'); if (!c) throw new Error('no 2d'); this.c = c;
    for (const src of [...BACKDROPS, ...SPRITES]) { const im = new Image(); im.decoding = 'async'; im.src = src; this.imgs.set(src, im); }
    // a paper grain to lay over everything
    const g = document.createElement('canvas'); g.width = g.height = 160; const gc = g.getContext('2d');
    if (gc) { const d = gc.createImageData(160, 160), r = lcg(3); for (let i = 0; i < d.data.length; i += 4) { const v = 200 + r() * 55; d.data[i] = v; d.data[i + 1] = v * 0.97; d.data[i + 2] = v * 0.9; d.data[i + 3] = 255; } gc.putImageData(d, 0, 0); this.grain = this.c.createPattern(g, 'repeat'); }
  }
  resize(w: number, h: number, dpr: number) {
    this.w = w; this.h = h; this.dpr = dpr;
    this.cv.width = Math.round(w * dpr); this.cv.height = Math.round(h * dpr);
  }
  img(src: string) { const im = this.imgs.get(src); return im && im.complete && im.naturalWidth > 0 ? im : null; }
  setFlight(f: Flight | null) {
    this.flight = f; this.cam.ready = false; this.fx = []; this.pops = []; this.seeds = []; this.streaks = [];
    this.cheerT = 0;
  }
  // ---------------------------------------------------------------- camera
  sx(x: number) { return (x - this.cam.x) * this.cam.s; }
  sy(y: number) { return this.h - (y - this.cam.y) * this.cam.s; }
  toWorld(px: number, py: number): Pt { return [px / this.cam.s + this.cam.x, (this.h - py) / this.cam.s + this.cam.y]; }
  /** The chinchilla's height on screen: picture-book scale, big enough to read on any screen. */
  spriteH(ins: DrawOpts['insets']) { const fh = this.h - ins.top - ins.bottom; return clamp(Math.min(fh * (this.h < 520 ? 0.4 : 0.27), this.w * (this.w < 600 ? 0.34 : 0.2)), 96, 300); }
  private frame(f: Flight, o: DrawOpts, snap: boolean) {
    const k = f.me, P = f.P, ins = o.insets;
    const fw = Math.max(200, this.w - ins.left - ins.right), fh = Math.max(160, this.h - ins.top - ins.bottom);
    const g0 = groundAt(P, k.hx);
    // what must be in view: the paws and the kite, the next thing to fly to, and the other kite
    let x1 = k.hx + 6, y1 = g0 + 6;
    const take = (x: number, y: number, pad: number) => { x1 = Math.max(x1, x + pad); y1 = Math.max(y1, y + pad); };
    take(k.x, k.y, 3.5);
    const obj = f.objective(); if (obj && f.ch?.goal.kind !== 'duel') take(obj[0], obj[1], 3);
    if (f.other) take(f.other.x, f.other.y, 3);
    const H = this.spriteH(ins), left = 0.13 * fw + H * 0.55; // room for the chinchilla on the left
    const sMax = fh / 15, sMin = Math.min(fh / 40, fw / 30);
    const s = clamp(Math.min((fw - left - fw * 0.04) / Math.max(4, x1 - k.hx), (fh * 0.9) / Math.max(4, y1 - g0)), sMin, sMax);
    // the paws sit `left` px in; the ground a little above the bottom of the frame
    const camX = k.hx - (ins.left + left) / s;
    let camY = g0 - (ins.bottom + fh * 0.06) / s;
    const top = camY + (this.h - ins.top) / s; if (y1 > top) camY += y1 - top;
    const a = snap || !this.cam.ready ? 1 : Math.min(1, o.dt * 2.2);
    this.cam.s += (s - this.cam.s) * (snap || !this.cam.ready ? 1 : Math.min(1, o.dt * 1.4));
    this.cam.x += (camX - this.cam.x) * a; this.cam.y += (camY - this.cam.y) * a; this.cam.ready = true;
    // keep the paws exactly at their spot horizontally once the zoom settles (no drift)
    this.cam.x = k.hx - (ins.left + left) / this.cam.s;
  }

  /** Effects for a batch of game events. */
  events(evs: Ev[], f: Flight) {
    const burst = (kind: Fx['kind'], x: number, y: number, n: number, cols: string[], sp = 4, r = 0.18) => {
      for (let i = 0; i < n; i++) { const a = this.r() * Math.PI * 2, v = sp * (0.4 + this.r()); this.fx.push({ kind, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v + 1, life: 0, max: 0.9 + this.r() * 0.8, col: cols[i % cols.length], r: r * (0.6 + this.r() * 0.8), spin: this.r() * 6 }); }
    };
    const pop = (text: string, x: number, y: number, col = '#3a3550', big = false) => this.pops.push({ text, x, y, life: 0, col, big });
    for (const e of evs) {
      switch (e.k) {
        case 'ring': burst('petal', e.x, e.y, 22, ['#fffbe8', '#f6cd3f', '#f4a6c0', '#ffffff'], 5); if (e.last) pop('Done!', e.x, e.y + 1.5, '#d0503e', true); break;
        case 'pop': burst(e.kind === 'bubble' ? 'spark' : e.kind === 'puff' ? 'seed' : 'confetti', e.x, e.y, e.kind === 'puff' ? 26 : 18, e.kind === 'balloon' ? ['#e8574a', '#f6cd3f', '#3a78c8'] : ['#ffffff', '#d8f0ff', '#f4d0ff'], 4); break;
        case 'deliver': burst('confetti', e.x, e.y, 26, ['#e8574a', '#f6cd3f', '#7cbf5a', '#3a78c8', '#d3609c'], 5); pop(e.left ? 'Delivered!' : 'All delivered!', e.x, e.y + 1.4, '#2f7a3a', true); this.cheerT = 1.4; break;
        case 'trick': {
          const k = f.kites[e.who]; if (!k) break;
          const name = e.name === 'eight' ? 'Figure-eight!' : e.name === 'swoop' ? 'Swoop!' : 'Loop!';
          pop(`${name} +${e.points}${e.chain > 1 ? `  ×${(1 + 0.5 * (e.chain - 1)).toFixed(1)}` : ''}`, e.x, e.y + 1.6, e.who ? '#6a5bbf' : '#d0503e', e.chain > 1);
          burst('spark', e.x, e.y, 12, ['#fff6c8', '#ffffff'], 3); if (e.who === 0) this.cheerT = 1.1; break;
        }
        case 'land': {
          const P = f.P;
          if (e.where === 'water') burst('drop', e.x, (waterAt(P, e.x) ?? e.y) + 0.1, 16, ['#cfeaff', '#ffffff', '#8fc6e8'], 3, 0.12);
          else if (e.where === 'tree') burst('leaf', e.x, e.y, 14, ['#5a8a36', '#8cc063', '#3e6e2a'], 2.5, 0.22);
          else burst('drop', e.x, e.y, 8, [P.paint.grass, P.paint.soil], 2, 0.12);
          if (e.who === 0) pop(e.where === 'tree' ? 'Caught in the leaves!' : e.where === 'water' ? 'Splash!' : e.where === 'roof' ? 'On the roof!' : 'Bump!', e.x, e.y + 1.5, '#5a6a48');
          break;
        }
        case 'touch': burst('spark', e.x, e.y, 20, e.by === 0 ? ['#f6cd3f', '#ffffff'] : ['#6a5bbf', '#ffffff'], 4); pop(e.by === 0 ? 'Touch!' : 'Touched!', e.x, e.y + 1.5, e.by === 0 ? '#d0503e' : '#6a5bbf', true); if (e.by === 0) this.cheerT = 1.2; break;
        case 'tangle': { const k = f.me; pop('Tangled!', k.x, k.y + 1.5, '#6a5bbf', true); burst('spark', k.x, k.y, 10, ['#ffffff'], 2); break; }
        case 'cue': if (e.good) { burst('petal', e.x, e.y, e.perfect ? 22 : 12, ['#f6cd3f', '#fffbe8', '#f39a3d'], 4); pop(e.perfect ? `Perfect! +${e.points}` : `Good +${e.points}`, e.x, e.y + 1.6, e.perfect ? '#d0503e' : '#3a78c8', e.perfect); } else pop('Missed', e.x, e.y + 1.2, '#8a8a8a'); break;
        case 'done': if (e.won) this.cheerT = 3; break;
        default: break;
      }
    }
  }

  // ---------------------------------------------------------------- drawing
  draw(f: Flight, o: DrawOpts) {
    const c = this.c, P = f.P, k = f.me;
    this.time += o.dt;
    this.cheerT = Math.max(0, this.cheerT - o.dt);
    if (this.flight !== f) this.setFlight(f);
    this.frame(f, o, false);
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.clearRect(0, 0, this.w, this.h);
    const x0 = this.cam.x - 2, x1 = this.cam.x + this.w / this.cam.s + 2, s = this.cam.s;
    this.backdrop(P);
    this.clouds(f, o.dt);
    this.thermals(f);
    this.ground(f, x0, x1, 'back');
    this.rotors(f);
    for (const t of P.trees) this.tree(P, t, f);
    for (const b of P.buildings) this.building(P, b);
    this.water(f, x0, x1);
    this.targets(f);
    // the other kite and its flier (behind), then yours
    const ins = o.insets, H = this.spriteH(ins);
    const gy = (x: number) => this.sy(groundAt(P, x));
    const pose: Pose = this.cheerT > 0 && k.state === 'fly' ? 'cheer' : o.pose;
    let otherReel: Pt | null = null;
    if (f.other) {
      const ok = f.other, duel = f.ch?.goal.kind === 'duel';
      otherReel = duel ? this.critter(f.ch!.goal.kind === 'duel' ? (f.ch!.goal as { rival: { name: string } }).rival.name : '', this.sx(ok.hx), gy(ok.hx), H * 0.8)
        : this.chinchilla(ok.who as Who, 'pull', this.sx(ok.hx), gy(ok.hx), H * 0.86, 0.95);
      this.lineAndKite(ok, otherReel, f, 0.92);
    }
    const reel = this.chinchilla(f.flyer, pose, this.sx(k.hx), gy(k.hx), H, 1, k);
    this.last.reel = reel; this.last.ground = gy(k.hx);
    this.lineAndKite(k, reel, f, 1);
    this.ground(f, x0, x1, 'front');
    this.wind(f, o.dt, x0, x1);
    this.effects(o.dt);
    if (o.arrow) this.arrows(f, o);
    if (o.showAim && o.aim && k.state === 'fly') this.aimMark(o.aim);
    // paper: grain and a warm edge
    if (this.grain) { c.save(); c.globalCompositeOperation = 'multiply'; c.globalAlpha = 0.16; c.fillStyle = this.grain; c.fillRect(0, 0, this.w, this.h); c.restore(); }
    const v = c.createRadialGradient(this.w / 2, this.h / 2, Math.min(this.w, this.h) * 0.45, this.w / 2, this.h / 2, Math.max(this.w, this.h) * 0.78);
    v.addColorStop(0, 'rgba(120,90,50,0)'); v.addColorStop(1, 'rgba(120,90,50,.22)'); c.fillStyle = v; c.fillRect(0, 0, this.w, this.h);
    void s;
  }

  private backdrop(P: Place) {
    const c = this.c, im = this.img(`${ART}bg-${P.id}.webp`);
    const gScreen = this.sy(groundAt(P, P.start));
    if (!im) {
      const g = c.createLinearGradient(0, 0, 0, this.h); g.addColorStop(0, '#5f9fd8'); g.addColorStop(0.7, '#cfe6f2'); g.addColorStop(1, '#f6ecd0');
      c.fillStyle = g; c.fillRect(0, 0, this.w, this.h); return;
    }
    // the painting's horizon (about 70% down) sits a little above the painted-in-code ground, and drifts slowly
    const HZ = 0.7;
    let ih = Math.max(this.h * 1.05, (gScreen - this.h * 0.02) / HZ + 4), iw = ih * (im.naturalWidth / im.naturalHeight);
    if (iw < this.w * 1.12) { iw = this.w * 1.12; ih = iw * (im.naturalHeight / im.naturalWidth); }
    const top = Math.min(0, gScreen - this.h * 0.02 - ih * HZ);
    const span = iw - this.w, par = ((this.cam.x * 0.18) % 40) / 40;
    const left = -span * clamp(0.2 + par * 0.0 + (this.cam.x - P.start + 10) * 0.004, 0, 1);
    c.drawImage(im, left, top, iw, ih);
    if (top + ih < this.h) { c.fillStyle = P.paint.grass; c.fillRect(0, top + ih - 1, this.w, this.h - top - ih + 1); }
  }

  private clouds(f: Flight, dt: number) {
    const c = this.c, P = f.P;
    if (this.streaks.length === 0) for (let i = 0; i < 7; i++) this.streaks.push({ x: this.r() * this.w, y: this.h * (0.06 + this.r() * 0.42), len: 60 + this.r() * 140, a: 0.18 + this.r() * 0.2 });
    const g = gustAt(P, f.seed, f.me.hx, f.t), wspd = P.wind.speed * (1 + g.gust) * (1 - g.lull);
    for (const st of this.streaks) {
      st.x += wspd * dt * 9 * (0.6 + st.a);
      if (st.x - st.len > this.w) { st.x = -st.len * 2; st.y = this.h * (0.06 + this.r() * 0.42); }
      const L = st.len * (0.7 + wspd / 12);
      const gr = c.createLinearGradient(st.x - L, 0, st.x, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.7, `rgba(255,255,255,${st.a})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = gr; c.beginPath(); c.ellipse(st.x - L / 2, st.y, L / 2, 3 + st.a * 10, 0, 0, 7); c.fill();
    }
  }

  private thermals(f: Flight) {
    const c = this.c, P = f.P, s = this.cam.s;
    const col = (x: number, w: number, k: number) => {
      const cx = this.sx(x), base = this.sy(groundAt(P, x)), top = this.sy(groundAt(P, x) + 26);
      const g = c.createLinearGradient(0, base, 0, top); g.addColorStop(0, `rgba(255,236,170,${0.16 * k})`); g.addColorStop(1, 'rgba(255,236,170,0)');
      c.fillStyle = g; c.fillRect(cx - w * s, top, w * 2 * s, base - top);
      c.lineWidth = Math.max(1.2, s * 0.06); c.lineCap = 'round';
      for (let i = -2; i <= 2; i++) {
        c.strokeStyle = `rgba(255,248,220,${0.28 * k})`; c.beginPath();
        for (let y = 0; y <= 24; y += 0.6) {
          const ph = this.time * 1.4 - y * 0.35 + i;
          const px = cx + (i * w * 0.32 + Math.sin(ph) * 0.4) * s, py = this.sy(groundAt(P, x) + y + ((this.time * 1.8) % 0.6));
          if (y === 0) c.moveTo(px, py); else c.lineTo(px, py);
        }
        c.stroke();
      }
    };
    for (const th of P.thermals) {
      const on = 0.5 + 0.5 * Math.sin((f.t / th.period + th.phase) * Math.PI * 2), cx = th.x + Math.sin((f.t / th.period + th.phase) * Math.PI) * 3;
      col(cx, th.w * 0.7, 0.35 + 0.65 * on);
    }
    for (const [rx, rw] of P.ridges) col(rx, rw * 0.5, 0.7);
  }

  private ground(f: Flight, x0: number, x1: number, layer: 'back' | 'front') {
    const c = this.c, P = f.P, s = this.cam.s, pt = P.paint;
    const step = Math.max(0.25, 4 / s);
    if (layer === 'back') {
      // the land: a wash from grass down to soil, then a lighter wash and a darker pooled edge along the top
      c.beginPath(); c.moveTo(this.sx(x0), this.h + 4);
      for (let x = x0; x <= x1 + step; x += step) c.lineTo(this.sx(x), this.sy(groundAt(P, x)));
      c.lineTo(this.sx(x1 + step), this.h + 4); c.closePath();
      const top = this.sy(groundAt(P, (x0 + x1) / 2) + 1), g = c.createLinearGradient(0, top, 0, this.h);
      g.addColorStop(0, pt.grass); g.addColorStop(0.35, mix(pt.grass, pt.grassDark, 0.45)); g.addColorStop(1, mix(pt.soil, pt.grassDark, 0.3));
      c.fillStyle = g; c.fill();
      // steep faces are rock (the cliffs)
      c.save(); c.clip();
      // loose horizontal washes and dabs, like wet brush strokes over the grass
      for (let i = 0; i < 26; i++) {
        const u = ((i * 0.618) % 1), wx = this.sx(x0 + (x1 - x0) * u), wy = this.sy(groundAt(P, x0 + (x1 - x0) * u)) + 8 + ((i * 37) % 9) * Math.max(6, s * 0.35);
        c.fillStyle = i % 3 ? rgba(pt.grassDark, 0.1) : 'rgba(255,250,215,.14)';
        c.beginPath(); c.ellipse(wx, wy, Math.max(40, s * (2 + (i % 4))), Math.max(4, s * 0.18), 0, 0, 7); c.fill();
      }
      for (let x = x0; x <= x1; x += step) {
        const dy = (groundAt(P, x + step) - groundAt(P, x)) / step;
        if (Math.abs(dy) > 0.8) {
          const a = this.sx(x), y = this.sy(groundAt(P, x));
          c.fillStyle = 'rgba(150,130,120,.9)'; c.fillRect(a - 1, y, step * s + 2, this.h - y);
          c.fillStyle = 'rgba(110,95,100,.5)'; for (let k = 0; k < 6; k++) c.fillRect(a, y + k * 0.9 * s + ((x * 7) % 1) * 4, step * s + 1, Math.max(1, s * 0.08));
        }
      }
      c.restore();
      c.beginPath(); for (let x = x0; x <= x1 + step; x += step) { const X = this.sx(x), Y = this.sy(groundAt(P, x)) + 2; if (x === x0) c.moveTo(X, Y); else c.lineTo(X, Y); }
      c.lineWidth = Math.max(3, s * 0.18); c.strokeStyle = mix(pt.grass, '#fffbe0', 0.3, 0.55); c.stroke();
      c.lineWidth = Math.max(1.5, s * 0.05); c.strokeStyle = mix(pt.grassDark, INK, 0.2, 0.45); c.stroke();
      // flowers dotted through the grass
      const r = lcg(P.id.length * 17 + 3);
      for (let x = Math.floor(x0); x <= x1; x += 0.7) {
        const h = ((Math.sin(x * 12.9898) * 43758.5453) % 1 + 1) % 1; if (h > 0.35 || waterAt(P, x) !== null) continue;
        const y = this.sy(groundAt(P, x) - 0.25 - h * 0.6);
        c.fillStyle = rgba(h < 0.12 ? '#ffffff' : pt.flower, 0.85); c.beginPath(); c.arc(this.sx(x + h), y, Math.max(1.5, s * 0.07), 0, 7); c.fill();
      }
      void r;
      return;
    }
    // the front layer: tufts of grass that bend with the wind and darken where a gust is running through
    const bstep = Math.max(0.6, 24 / s), hsh = (v: number) => ((Math.sin(v * 12.9898 + 4.1) * 43758.5453) % 1 + 1) % 1;
    c.lineCap = 'round';
    for (let x0b = Math.floor(x0 / bstep) * bstep; x0b <= x1; x0b += bstep) {
      const r1 = hsh(x0b), x = x0b + r1 * bstep * 0.8;
      if (r1 < 0.4 || waterAt(P, x) !== null) continue;
      const g = groundAt(P, x); if (Math.abs((groundAt(P, x + 0.3) - g) / 0.3) > 0.8) continue;
      const w = windAt(P, f.seed, x, g + 0.8, f.t), gu = gustAt(P, f.seed, x, f.t);
      const dark = clamp(gu.gust * 3 - gu.lull, -0.4, 0.8);
      const col = dark > 0 ? mix(P.paint.grassDark, '#1f4a2a', dark, 0.8) : mix(P.paint.grassDark, '#f2f0c0', -dark, 0.75);
      const bx = this.sx(x), by = this.sy(g) + 2, n = 3 + Math.floor(hsh(x0b + 1) * 3);
      for (let j = 0; j < n; j++) {
        const rj = hsh(x0b * 3 + j), hgt = (0.25 + rj * 0.5) * Math.max(1, 10 / s);
        const lean = (j - (n - 1) / 2) * 0.22, bend = clamp(w.u / 11, -0.3, 1.1) * (0.6 + rj * 0.6) + lean + Math.sin(this.time * 3 + x * 1.7 + j) * 0.06 * (1 + gu.gust * 4);
        const tipX = bx + bend * hgt * s * 0.75, tipY = by - hgt * s * (1 - Math.min(0.6, Math.abs(bend) * 0.35));
        c.strokeStyle = col; c.lineWidth = Math.max(1.3, s * 0.05) * (0.7 + rj * 0.6);
        c.beginPath(); c.moveTo(bx + (j - n / 2) * 1.5, by); c.quadraticCurveTo(bx + bend * hgt * s * 0.15, by - hgt * s * 0.6, tipX, tipY); c.stroke();
      }
    }
  }

  private water(f: Flight, x0: number, x1: number) {
    const c = this.c, P = f.P, s = this.cam.s;
    for (const [a, b, lvl] of P.water) {
      const lo = Math.max(a, x0), hi = Math.min(b, x1); if (lo >= hi) continue;
      const step = Math.max(0.25, 4 / s);
      c.beginPath(); c.moveTo(this.sx(lo), this.sy(lvl));
      for (let x = lo; x <= hi; x += step) c.lineTo(this.sx(x), this.sy(lvl + Math.sin(x * 1.3 + this.time * 2) * 0.05));
      c.lineTo(this.sx(hi), this.h + 4); c.lineTo(this.sx(lo), this.h + 4); c.closePath();
      const g = c.createLinearGradient(0, this.sy(lvl), 0, this.h); g.addColorStop(0, 'rgba(110,175,215,.92)'); g.addColorStop(1, 'rgba(40,95,150,.95)');
      c.fillStyle = g; c.fill();
      // sparkles and wave crests that run downwind
      c.lineCap = 'round'; c.lineWidth = Math.max(1.5, s * 0.05);
      for (let x = Math.ceil(lo); x < hi; x += 1.3) {
        for (let d = 0; d < 3; d++) {
          const ph = (x * 0.7 + d * 2.1 + this.time * 0.9) % 3, yy = this.sy(lvl - 0.25 - d * 1.2 - ((x * 1.7) % 1) * 0.6);
          if (yy > this.h) continue;
          c.strokeStyle = `rgba(255,255,255,${0.55 - ph * 0.15})`;
          c.beginPath(); c.moveTo(this.sx(x + ph * 0.2), yy); c.lineTo(this.sx(x + ph * 0.2 + 0.5), yy); c.stroke();
        }
      }
      c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = Math.max(2, s * 0.08);
      c.beginPath(); c.moveTo(this.sx(lo), this.sy(lvl)); c.lineTo(this.sx(hi), this.sy(lvl)); c.stroke();
    }
  }

  private rotors(f: Flight) {
    // tumbling air behind trees and roofs: faint curling strokes that turn over
    const c = this.c, P = f.P, s = this.cam.s;
    const spots: [number, number, number][] = [];
    for (const t of P.trees) { const g = groundAt(P, t.x); spots.push([t.x + t.r * 0.8, g + t.h + t.r * 0.7, t.h + t.r]); }
    for (const b of P.buildings) { const g = groundAt(P, (b.x0 + b.x1) / 2); spots.push([b.x1, g + b.h + b.roof, b.h + b.roof]); }
    c.lineCap = 'round';
    for (const [x, top, h] of spots) {
      for (let i = 0; i < 3; i++) {
        const cx = this.sx(x + h * (0.5 + i * 0.6)), cy = this.sy(top - h * (0.35 + i * 0.12)), r = h * (0.28 - i * 0.04) * s;
        if (cx < -r * 2 || cx > this.w + r * 2) continue;
        const a0 = -this.time * (2.2 - i * 0.3) + i * 2;
        c.strokeStyle = `rgba(255,255,255,${0.2 - i * 0.04})`; c.lineWidth = Math.max(1.5, s * 0.07);
        c.beginPath(); c.arc(cx, cy, r, a0, a0 + 4.2); c.stroke();
        c.beginPath(); c.arc(cx, cy, r * 0.55, a0 + 2, a0 + 5.2); c.stroke();
      }
    }
  }

  private tree(P: Place, t: Place['trees'][number], f: Flight) {
    const c = this.c, s = this.cam.s, [cx, cy, r] = treeCanopy(P, t), g = groundAt(P, t.x);
    const X = this.sx(cx), Y = this.sy(cy), R = r * s;
    if (X + R * 1.6 < 0 || X - R * 1.6 > this.w) return;
    const sway = Math.sin(this.time * 1.3 + t.x) * 0.04 * R;
    // trunk
    c.fillStyle = '#6e4a2e'; c.beginPath();
    const tw = Math.max(4, (t.kind === 'palm' ? 0.25 : 0.42) * s);
    c.moveTo(this.sx(t.x) - tw, this.sy(g)); c.quadraticCurveTo(this.sx(t.x) - tw * 0.6, this.sy(g + t.h * 0.5), this.sx(t.x) - tw * 0.35 + sway, Y);
    c.lineTo(this.sx(t.x) + tw * 0.35 + sway, Y); c.quadraticCurveTo(this.sx(t.x) + tw * 0.6, this.sy(g + t.h * 0.5), this.sx(t.x) + tw, this.sy(g)); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(255,230,190,.35)'; c.lineWidth = Math.max(1, tw * 0.25); c.beginPath(); c.moveTo(this.sx(t.x) - tw * 0.4, this.sy(g + 0.3)); c.lineTo(this.sx(t.x) - tw * 0.2 + sway, Y + R * 0.3); c.stroke();
    const seed = Math.round(t.x * 13 + 5);
    if (t.kind === 'palm') {
      c.lineCap = 'round';
      for (let i = 0; i < 7; i++) {
        const a = -Math.PI / 2 + (i - 3) * 0.48 + Math.sin(this.time * 1.6 + i) * 0.05, L = R * 1.3;
        c.strokeStyle = rgba(i % 2 ? '#4f8a3c' : '#6fa84a', 0.92); c.lineWidth = Math.max(3, R * 0.2);
        c.beginPath(); c.moveTo(X + sway, Y); c.quadraticCurveTo(X + Math.cos(a) * L * 0.6, Y + Math.sin(a) * L * 0.4 - R * 0.2, X + Math.cos(a) * L, Y + Math.sin(a) * L * 0.5 + R * 0.4); c.stroke();
      }
      return;
    }
    if (t.kind === 'pine') {
      for (let i = 0; i < 4; i++) {
        const w = R * (1.05 - i * 0.2), y = Y + R * (0.9 - i * 0.55);
        c.fillStyle = rgba(i % 2 ? '#3e6e4a' : '#4f7f52', 0.92); c.beginPath(); c.moveTo(X - w + sway, y); c.lineTo(X + sway * 1.5, y - R * 0.95); c.lineTo(X + w + sway, y); c.closePath(); c.fill();
        c.strokeStyle = 'rgba(30,50,40,.35)'; c.lineWidth = 1.5; c.stroke();
      }
      return;
    }
    // a leafy crown: overlapping washes of green, darker underneath, with light on top
    const greens = t.kind === 'apple' ? ['#6f9e3e', '#87b44c', '#5a8a36'] : ['#5f8f3c', '#7aa64a', '#4c7a34'];
    const r2 = lcg(seed);
    for (let i = 0; i < 9; i++) {
      const a = r2() * Math.PI * 2, d = r2() * 0.55;
      wash(c, X + Math.cos(a) * R * d + sway, Y + Math.sin(a) * R * d * 0.8, R * (0.45 + r2() * 0.2), R * (0.4 + r2() * 0.18), greens[i % 3], seed + i, 0.95);
    }
    c.fillStyle = 'rgba(30,60,30,.18)'; blobPath(c, X + sway, Y + R * 0.35, R * 0.95, R * 0.45, seed + 99); c.fill();
    if (t.kind === 'apple') {
      const r3 = lcg(seed + 5);
      for (let i = 0; i < 9; i++) { const a = r3() * Math.PI * 2, d = r3() * 0.8; c.fillStyle = '#d8443a'; c.beginPath(); c.arc(X + Math.cos(a) * R * d + sway, Y + Math.sin(a) * R * d * 0.75, Math.max(2, R * 0.07), 0, 7); c.fill(); c.fillStyle = 'rgba(255,240,220,.7)'; c.beginPath(); c.arc(X + Math.cos(a) * R * d + sway - R * 0.02, Y + Math.sin(a) * R * d * 0.75 - R * 0.02, Math.max(0.8, R * 0.022), 0, 7); c.fill(); }
    }
    void f;
  }

  private building(P: Place, b: Place['buildings'][number]) {
    const c = this.c, s = this.cam.s, g = groundAt(P, (b.x0 + b.x1) / 2);
    const L = this.sx(b.x0), R = this.sx(b.x1), B = this.sy(g - 0.3), T = this.sy(g + b.h), A = this.sy(g + b.h + b.roof), M = (L + R) / 2;
    if (R < 0 || L > this.w) return;
    const walls: Record<string, string> = { cottage: '#f1e2c4', tent: '#fbf3df', barn: '#b8503e', stall: '#fbf3df', hut: '#f6efe0' };
    c.fillStyle = walls[b.kind]; c.fillRect(L, T, R - L, B - T);
    if (b.kind === 'tent' || b.kind === 'stall' || b.kind === 'hut') {
      const n = b.kind === 'hut' ? 5 : 7, col = b.kind === 'hut' ? '#5a90c8' : b.kind === 'tent' ? '#e8574a' : '#2f9a8c';
      c.fillStyle = rgba(col, 0.7); for (let i = 0; i < n; i += 2) c.fillRect(L + ((R - L) / n) * i, T, (R - L) / n, B - T);
    }
    if (b.kind === 'cottage' || b.kind === 'barn') {
      c.fillStyle = b.kind === 'barn' ? '#f1e2c4' : '#7aa0c8'; const wsz = Math.min((R - L) * 0.18, (B - T) * 0.3);
      c.fillRect(L + (R - L) * 0.18, T + (B - T) * 0.25, wsz, wsz); c.fillRect(R - (R - L) * 0.18 - wsz, T + (B - T) * 0.25, wsz, wsz);
      c.fillStyle = '#6e4a2e'; c.fillRect(M - wsz * 0.45, B - (B - T) * 0.55, wsz * 0.9, (B - T) * 0.55);
    }
    c.strokeStyle = 'rgba(60,40,40,.35)'; c.lineWidth = 2; c.strokeRect(L, T, R - L, B - T);
    // roof
    const roofs: Record<string, string> = { cottage: '#c49a52', tent: '#e8574a', barn: '#7a3a2e', stall: '#2f9a8c', hut: '#5a90c8' };
    c.beginPath(); c.moveTo(L - s * 0.3, T); c.lineTo(M, A); c.lineTo(R + s * 0.3, T); c.closePath(); c.fillStyle = roofs[b.kind]; c.fill();
    if (b.kind === 'tent' || b.kind === 'stall') { c.save(); c.clip(); c.fillStyle = 'rgba(255,250,235,.85)'; for (let i = -6; i < 6; i += 2) { c.beginPath(); c.moveTo(M, A); c.lineTo(M + i * (R - L) / 6, T); c.lineTo(M + (i + 1) * (R - L) / 6, T); c.closePath(); c.fill(); } c.restore(); }
    if (b.kind === 'cottage') { c.strokeStyle = 'rgba(120,90,40,.5)'; c.lineWidth = 1.5; for (let i = 1; i < 5; i++) { const y = T + (A - T) * i / 5; c.beginPath(); c.moveTo(L + (M - L) * i / 5, y); c.lineTo(R - (R - M) * i / 5, y); c.stroke(); } c.fillStyle = '#9a5a40'; c.fillRect(L + (R - L) * 0.68, A + (T - A) * 0.2 - s * 0.9, s * 0.6, s * 1.2); }
    c.strokeStyle = 'rgba(60,40,40,.4)'; c.lineWidth = 2; c.beginPath(); c.moveTo(L - s * 0.3, T); c.lineTo(M, A); c.lineTo(R + s * 0.3, T); c.stroke();
    // a wash of light from the upper left and shadow to the lower right, so it sits in the painting
    const lg = c.createLinearGradient(L, A, R, B); lg.addColorStop(0, 'rgba(255,248,225,.28)'); lg.addColorStop(1, 'rgba(60,50,90,.22)');
    c.fillStyle = lg; c.beginPath(); c.moveTo(L - s * 0.3, T); c.lineTo(M, A); c.lineTo(R + s * 0.3, T); c.lineTo(R, T); c.lineTo(R, B); c.lineTo(L, B); c.lineTo(L, T); c.closePath(); c.fill();
    if (b.kind === 'tent') { c.strokeStyle = '#6e4a2e'; c.lineWidth = 2; c.beginPath(); c.moveTo(M, A); c.lineTo(M, A - s * 1.1); c.stroke(); c.fillStyle = '#f6cd3f'; c.beginPath(); c.moveTo(M, A - s * 1.1); c.lineTo(M + s * (0.8 + Math.sin(this.time * 4) * 0.1), A - s * 0.9); c.lineTo(M, A - s * 0.7); c.fill(); }
  }

  private targets(f: Flight) {
    const c = this.c, goal = f.ch?.goal, s = this.cam.s; if (!goal) return;
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 4);
    const ring = (g: Target, i: number, state: 'next' | 'later' | 'done', label?: string) => {
      if (state === 'done') return;
      const X = this.sx(g.x), Y = this.sy(g.y), R = g.r * s, al = state === 'next' ? 1 : 0.42;
      if (state === 'next') { c.fillStyle = `rgba(255,246,190,${0.18 + pulse * 0.12})`; c.beginPath(); c.arc(X, Y, R * 1.12, 0, 7); c.fill(); }
      if (g.kind === 'gate') {
        // a ring of bunting
        const n = 14; for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2 + this.time * 0.2, b = a + Math.PI / n; c.fillStyle = rgba(COLOURS[k % 8], al * 0.95); c.beginPath(); c.moveTo(X + Math.cos(a) * R, Y + Math.sin(a) * R); c.lineTo(X + Math.cos(b) * R, Y + Math.sin(b) * R); c.lineTo(X + Math.cos((a + b) / 2) * R * 0.8, Y + Math.sin((a + b) / 2) * R * 0.8); c.fill(); }
        c.strokeStyle = `rgba(110,74,46,${al})`; c.lineWidth = 1.5; c.beginPath(); c.arc(X, Y, R, 0, 7); c.stroke();
      } else {
        // a daisy-chain ring
        c.lineWidth = Math.max(4, R * 0.13); c.strokeStyle = `rgba(110,170,80,${al * 0.9})`; c.beginPath(); c.arc(X, Y, R, 0, 7); c.stroke();
        const n = Math.max(8, Math.round(R / 9));
        for (let k = 0; k < n; k++) {
          const a = (k / n) * Math.PI * 2 + Math.sin(this.time + k) * 0.02, px = X + Math.cos(a) * R, py = Y + Math.sin(a) * R, pr = Math.max(3, R * 0.075);
          c.fillStyle = `rgba(255,255,250,${al})`; for (let p = 0; p < 5; p++) { const pa = (p / 5) * Math.PI * 2; c.beginPath(); c.arc(px + Math.cos(pa) * pr, py + Math.sin(pa) * pr, pr * 0.7, 0, 7); c.fill(); }
          c.fillStyle = `rgba(246,205,63,${al})`; c.beginPath(); c.arc(px, py, pr * 0.6, 0, 7); c.fill();
        }
      }
      if (label) { c.font = `700 ${Math.max(14, R * 0.38)}px "Patrick Hand", "Comic Sans MS", cursive`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = `rgba(58,53,80,${al * 0.75})`; c.fillText(label, X, Y); }
      void i;
    };
    switch (goal.kind) {
      case 'rings': case 'race': {
        const list = goal.kind === 'rings' ? goal.rings : goal.gates;
        for (let i = list.length - 1; i >= 0; i--) ring(list[i], i, i < f.next ? 'done' : i === f.next ? 'next' : 'later', String(i + 1));
        if (goal.kind === 'race') this.dragonfly(f);
        break;
      }
      case 'pop': goal.targets.forEach((g, i) => { if (!f.popped[i]) this.thing(g, f.t, i); }); break;
      case 'hold': {
        const z = goal.zone, X = this.sx(z.x), Y = this.sy(z.y), R = z.r * s, frac = clamp(f.inZone / f.ch!.marks[2], 0, 1);
        const g = c.createRadialGradient(X, Y, 0, X, Y, R); g.addColorStop(0, 'rgba(255,236,150,.45)'); g.addColorStop(1, 'rgba(255,220,120,.12)');
        c.fillStyle = g; c.beginPath(); c.arc(X, Y, R, 0, 7); c.fill();
        c.setLineDash([R * 0.12, R * 0.08]); c.lineWidth = Math.max(3, R * 0.05); c.strokeStyle = 'rgba(240,170,60,.75)'; c.beginPath(); c.arc(X, Y, R, 0, 7); c.stroke(); c.setLineDash([]);
        c.lineWidth = Math.max(5, R * 0.08); c.strokeStyle = 'rgba(232,87,74,.85)'; c.beginPath(); c.arc(X, Y, R * 1.08, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2); c.stroke();
        break;
      }
      case 'deliver': goal.baskets.forEach(([x, y], i) => this.basket(f, x, y, f.delivered[i], i)); break;
      case 'routine': {
        goal.cues.forEach((cue, i) => {
          if (f.cueHit[i] !== 0 || cue.t - f.t > 7) return;
          const lead = cue.t - f.t, X = this.sx(cue.x), Y = this.sy(cue.y), R = cue.r * s, al = clamp(1 - (lead - 3.6) / 3.4, 0.25, 1);
          ring({ x: cue.x, y: cue.y, r: cue.r, kind: 'gate' }, i, i === f.cueNext ? 'next' : 'later');
          // the beat: a ring closing in on the gate, landing on it exactly on the beat
          if (lead > -1.4 && lead < 2.2) { const rr = R * (1 + Math.max(0, lead) * 0.3); c.lineWidth = 2.5; c.strokeStyle = `rgba(232,87,74,${al * (lead < 0 ? 0.4 : 0.9)})`; c.beginPath(); c.arc(X, Y, rr, 0, 7); c.stroke(); }
          if (cue.loop) { c.font = `700 ${Math.max(14, R * 0.36)}px "Patrick Hand", cursive`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = `rgba(106,91,191,${al})`; c.fillText('loop!', X, Y); }
        });
        break;
      }
      default: break;
    }
  }
  private thing(g: Target, t: number, i: number) {
    const c = this.c, s = this.cam.s, [x, y] = targetAt(g, t), X = this.sx(x), Y = this.sy(y), R = g.r * s;
    if (g.kind === 'puff') {
      c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = Math.max(1, R * 0.04);
      for (let k = 0; k < 26; k++) { const a = (k / 26) * Math.PI * 2 + i; c.beginPath(); c.moveTo(X, Y); c.lineTo(X + Math.cos(a) * R * 0.9, Y + Math.sin(a) * R * 0.9); c.stroke(); c.fillStyle = 'rgba(255,255,255,.9)'; c.beginPath(); c.arc(X + Math.cos(a) * R * 0.9, Y + Math.sin(a) * R * 0.9, Math.max(1.5, R * 0.07), 0, 7); c.fill(); }
      c.fillStyle = 'rgba(200,190,150,.9)'; c.beginPath(); c.arc(X, Y, R * 0.14, 0, 7); c.fill();
      c.strokeStyle = 'rgba(120,150,90,.7)'; c.lineWidth = Math.max(1.5, R * 0.06); c.beginPath(); c.moveTo(X, Y + R * 0.15); c.quadraticCurveTo(X - R * 0.2, Y + R * 0.9, X - R * 0.1, Y + R * 1.5); c.stroke();
    } else if (g.kind === 'balloon') {
      const col = COLOURS[[0, 2, 5, 7, 3][i % 5]];
      c.strokeStyle = 'rgba(80,70,60,.6)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(X, Y + R); c.quadraticCurveTo(X + Math.sin(this.time * 2 + i) * R * 0.3, Y + R * 1.8, X, Y + R * 2.6); c.stroke();
      c.fillStyle = col; c.beginPath(); c.ellipse(X, Y, R * 0.82, R, 0, 0, 7); c.fill();
      c.beginPath(); c.moveTo(X - R * 0.12, Y + R * 1.08); c.lineTo(X + R * 0.12, Y + R * 1.08); c.lineTo(X, Y + R * 0.95); c.fill();
      const bg = c.createRadialGradient(X - R * 0.3, Y - R * 0.35, R * 0.1, X, Y, R); bg.addColorStop(0, 'rgba(255,250,235,.35)'); bg.addColorStop(1, 'rgba(40,30,60,.2)');
      c.fillStyle = bg; c.beginPath(); c.ellipse(X, Y, R * 0.82, R, 0, 0, 7); c.fill();
      c.strokeStyle = mix(col, INK, 0.4, 0.5); c.lineWidth = 1.5; c.stroke();
      c.fillStyle = 'rgba(255,255,255,.75)'; c.beginPath(); c.ellipse(X - R * 0.3, Y - R * 0.4, R * 0.14, R * 0.24, -0.4, 0, 7); c.fill();
    } else {
      // a soap bubble: rainbow sheen, a white window
      const g2 = c.createRadialGradient(X - R * 0.3, Y - R * 0.3, R * 0.1, X, Y, R);
      g2.addColorStop(0, 'rgba(255,255,255,.08)'); g2.addColorStop(0.75, 'rgba(200,230,255,.12)'); g2.addColorStop(0.92, `hsla(${(this.time * 60 + i * 40) % 360},80%,75%,.55)`); g2.addColorStop(1, 'rgba(255,255,255,.7)');
      c.fillStyle = g2; c.beginPath(); c.arc(X, Y, R, 0, 7); c.fill();
      c.fillStyle = 'rgba(255,255,255,.85)'; c.beginPath(); c.ellipse(X - R * 0.38, Y - R * 0.38, R * 0.16, R * 0.09, -0.8, 0, 7); c.fill();
    }
  }
  private basket(f: Flight, x: number, y: number, done: boolean, i: number) {
    const c = this.c, s = this.cam.s, X = this.sx(x), Y = this.sy(y), w = Math.max(18, 1.1 * s);
    // its rope up to the nearest branch or roof
    const P = f.P; let ax = x, ay = y + 2.5;
    for (const t of P.trees) { const [cx, cy, r] = treeCanopy(P, t); if (Math.hypot(cx - x, cy - y) < r + 3) { ax = cx + (x - cx) * 0.6; ay = cy + (y - cy) * 0.4 + r * 0.3; } }
    for (const b of P.buildings) { if (x > b.x0 - 1 && x < b.x1 + 1) { ax = x; ay = groundAt(P, x) + b.h + b.roof * 0.6; } }
    if (Math.hypot(ax - x, ay - y) > 0.3) { c.strokeStyle = 'rgba(110,74,46,.8)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(this.sx(ax), this.sy(ay)); c.lineTo(X, Y - w * 0.3); c.stroke(); }
    if (!done) { c.fillStyle = `rgba(255,246,190,${0.25 + 0.15 * Math.sin(this.time * 4 + i)})`; c.beginPath(); c.arc(X, Y, w * 1.05, 0, 7); c.fill(); }
    c.fillStyle = '#c4904e'; c.beginPath(); c.moveTo(X - w * 0.5, Y - w * 0.15); c.lineTo(X + w * 0.5, Y - w * 0.15); c.lineTo(X + w * 0.38, Y + w * 0.35); c.lineTo(X - w * 0.38, Y + w * 0.35); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(110,74,46,.85)'; c.lineWidth = 1.2; c.stroke();
    for (let k = 1; k < 4; k++) { c.beginPath(); c.moveTo(X - w * 0.45 + k * w * 0.05, Y - w * 0.15 + k * w * 0.12); c.lineTo(X + w * 0.45 - k * w * 0.05, Y - w * 0.15 + k * w * 0.12); c.stroke(); }
    c.beginPath(); c.arc(X, Y - w * 0.15, w * 0.42, Math.PI, 0); c.stroke();
    if (done) { this.parcel(X, Y - w * 0.3, w * 0.5); c.fillStyle = '#e8574a'; c.beginPath(); c.moveTo(X + w * 0.45, Y - w * 0.15); c.lineTo(X + w * 0.45, Y - w * 0.9); c.lineTo(X + w * 0.85, Y - w * 0.75); c.lineTo(X + w * 0.45, Y - w * 0.6); c.fill(); }
  }
  private parcel(X: number, Y: number, w: number) {
    const c = this.c;
    c.fillStyle = '#c99a62'; c.fillRect(X - w / 2, Y - w / 2, w, w * 0.8);
    c.strokeStyle = '#e8574a'; c.lineWidth = Math.max(1.5, w * 0.1); c.beginPath(); c.moveTo(X, Y - w / 2); c.lineTo(X, Y + w * 0.3); c.moveTo(X - w / 2, Y - w * 0.1); c.lineTo(X + w / 2, Y - w * 0.1); c.stroke();
    c.strokeStyle = 'rgba(90,60,30,.6)'; c.lineWidth = 1; c.strokeRect(X - w / 2, Y - w / 2, w, w * 0.8);
  }
  private dragonfly(f: Flight) {
    const goal = f.ch!.goal; if (goal.kind !== 'race') return;
    const d = dragonflyAt(goal.gates, f.dfStart, goal.dragonfly, f.t), c = this.c, s = this.cam.s;
    const X = this.sx(d.x), Y = this.sy(d.y + Math.sin(this.time * 9) * 0.08), L = Math.max(26, 1.2 * s), flap = Math.sin(this.time * 60) * 0.3;
    c.save(); c.translate(X, Y);
    c.fillStyle = 'rgba(220,240,255,.55)'; c.strokeStyle = 'rgba(80,120,150,.6)'; c.lineWidth = 1;
    for (const [dx, a] of [[0.1, -0.5], [0.1, 0.5], [-0.05, -0.35], [-0.05, 0.35]] as Pt[]) { c.beginPath(); c.ellipse(dx * L, 0, L * 0.38, L * 0.1, a + flap * Math.sign(a), 0, 7); c.fill(); c.stroke(); }
    c.fillStyle = '#2f9a8c'; c.beginPath(); c.ellipse(-L * 0.15, 0, L * 0.5, L * 0.07, 0, 0, 7); c.fill();
    c.fillStyle = '#3a78c8'; c.beginPath(); c.arc(L * 0.38, 0, L * 0.11, 0, 7); c.fill();
    c.restore();
  }

  /** Draws the line from the reel to the kite, the tail, the kite and anything it carries. */
  private lineAndKite(k: Kite, reel: Pt, f: Flight, alpha: number) {
    const c = this.c, s = this.cam.s, X = this.sx(k.x), Y = this.sy(k.y);
    const size = clamp(1.7 * s, Math.min(this.w, this.h) * 0.07, Math.min(this.w, this.h) * 0.13);
    if (k === f.me) { this.last.kite = [X, Y]; this.last.kiteSize = size; }
    // the line: a gentle catenary, deeper when slack
    const len = Math.hypot(X - reel[0], Y - reel[1]);
    const slack = k.state !== 'fly' ? 0.02 : k.taut ? clamp(0.06 - k.tension * 0.004, 0.012, 0.06) : 0.16;
    const mx = (X + reel[0]) / 2, my = (Y + reel[1]) / 2 + len * slack;
    c.lineCap = 'round'; c.lineWidth = Math.max(1.2, s * 0.03); c.strokeStyle = `rgba(70,55,60,${0.75 * alpha})`;
    c.beginPath(); c.moveTo(reel[0], reel[1]); c.quadraticCurveTo(mx, my, X, Y); c.stroke();
    c.lineWidth = Math.max(0.6, s * 0.012); c.strokeStyle = `rgba(255,250,235,${0.45 * alpha})`; c.stroke();
    // the tail
    const pts: Pt[] = []; for (let i = 0; i < k.tail.length; i += 2) pts.push([this.sx(k.tail[i]), this.sy(k.tail[i + 1])]);
    // scale the tail out from the kite so it matches the picture-book kite size
    const sc = size / (1.7 * s); const tp = pts.map(([x, y]) => [X + (x - X) * sc, Y + (y - Y) * sc] as Pt);
    c.globalAlpha = alpha; paintTail(c, tp, k.design, Math.max(2.5, size * 0.05), this.time); c.globalAlpha = 1;
    // parcels hang on a short string under the kite
    for (let i = 0; i < k.parcels; i++) {
      const px = X - size * (0.2 + i * 0.28), py = Y + size * (0.55 + i * 0.12);
      c.strokeStyle = 'rgba(80,60,40,.8)'; c.lineWidth = 1; c.beginPath(); c.moveTo(X, Y); c.lineTo(px, py - size * 0.12); c.stroke();
      this.parcel(px, py, size * 0.24);
    }
    const tumble = k.tumbling ? Math.sin(this.time * 20) * 0.08 : 0;
    paintKite(c, k.design, X, Y, -k.psi + tumble, size, this.time, alpha);
    if (k.tumbling && k === f.me) { c.font = `700 ${Math.max(15, size * 0.32)}px "Patrick Hand", cursive`; c.textAlign = 'center'; c.fillStyle = 'rgba(58,53,80,.8)'; c.fillText('stall! pull to tighten', X, Y - size * 0.8); }
  }

  /** A painted chinchilla cut-out with its feet on the ground at (x, ground). Returns where the reel is. */
  chinchilla(who: Who, pose: Pose, x: number, ground: number, H: number, alpha = 1, k?: Kite): Pt {
    const c = this.c, sp = SPRITE[who][pose], im = this.img(`${ART}${who}-${pose}.webp`);
    const h = H * (sp.h / 600), w = h * (sp.w / sp.h);
    // a little life: a tug when pulling, a bounce when walking
    const bob = k?.pulling ? Math.abs(Math.sin(this.time * 9)) * H * 0.012 : k && k.walking ? Math.abs(Math.sin(this.time * 10)) * H * 0.03 : Math.sin(this.time * 2) * H * 0.004;
    const left = x - w * sp.reel[0] + H * 0.12, top = ground - h * 0.985 - bob;
    c.fillStyle = 'rgba(40,50,30,.22)'; c.beginPath(); c.ellipse(left + w * 0.5, ground - 1, w * 0.4, H * 0.04, 0, 0, 7); c.fill();
    if (im) { c.globalAlpha = alpha; c.drawImage(im, left, top, w, h); c.globalAlpha = 1; }
    else { wash(c, left + w * 0.5, top + h * 0.55, w * 0.35, h * 0.42, who === 'dora' ? '#f4ecdc' : '#9aa6b8', who === 'dora' ? 3 : 5); }
    if (k) this.last.sprite = [left, top, w, h];
    return [left + w * sp.reel[0], top + h * sp.reel[1]];
  }
  /** The duel rivals, painted in code: Saffron the stoat and Old Burdock the badger. */
  critter(name: string, x: number, ground: number, H: number): Pt {
    const c = this.c, badger = name === 'Burdock', fur = badger ? '#6c6a72' : '#c47a3a', belly = badger ? '#e8e2d8' : '#f6e2c0';
    const cx = x - H * 0.15, bob = Math.sin(this.time * 2.4) * H * 0.008;
    c.fillStyle = 'rgba(40,50,30,.22)'; c.beginPath(); c.ellipse(cx, ground - 1, H * 0.3, H * 0.04, 0, 0, 7); c.fill();
    // tail, body, belly, head
    if (!badger) { c.strokeStyle = fur; c.lineWidth = H * 0.08; c.lineCap = 'round'; c.beginPath(); c.moveTo(cx - H * 0.18, ground - H * 0.18); c.quadraticCurveTo(cx - H * 0.45, ground - H * 0.25, cx - H * 0.42, ground - H * 0.5); c.stroke(); c.strokeStyle = INK; c.lineWidth = H * 0.085; c.beginPath(); c.moveTo(cx - H * 0.43, ground - H * 0.45); c.lineTo(cx - H * 0.42, ground - H * 0.52); c.stroke(); }
    wash(c, cx, ground - H * (badger ? 0.32 : 0.36) + bob, H * (badger ? 0.27 : 0.17), H * (badger ? 0.3 : 0.34), fur, badger ? 41 : 43, 0.97);
    wash(c, cx + H * 0.06, ground - H * 0.32 + bob, H * (badger ? 0.15 : 0.1), H * 0.22, belly, 47, 0.95);
    const hx = cx + H * 0.1, hy = ground - H * (badger ? 0.7 : 0.76) + bob;
    wash(c, hx, hy, H * 0.16, H * 0.14, badger ? '#f2eee6' : fur, 51, 0.98);
    if (badger) { c.fillStyle = 'rgba(40,38,44,.92)'; c.beginPath(); c.ellipse(hx - H * 0.02, hy - H * 0.02, H * 0.1, H * 0.035, -0.5, 0, 7); c.fill(); c.beginPath(); c.ellipse(hx - H * 0.02, hy + H * 0.06, H * 0.1, H * 0.035, -0.2, 0, 7); c.fill(); }
    else { c.fillStyle = belly; c.beginPath(); c.ellipse(hx + H * 0.07, hy + H * 0.05, H * 0.09, H * 0.06, 0.2, 0, 7); c.fill(); }
    c.fillStyle = badger ? '#4a484e' : '#a85e2a'; c.beginPath(); c.arc(hx - H * 0.09, hy - H * 0.11, H * 0.045, 0, 7); c.arc(hx + H * 0.03, hy - H * 0.13, H * 0.045, 0, 7); c.fill();
    c.fillStyle = INK; c.beginPath(); c.arc(hx + H * 0.06, hy - H * 0.03, H * 0.022, 0, 7); c.fill(); c.beginPath(); c.arc(hx + H * 0.16, hy + H * 0.02, H * 0.025, 0, 7); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(hx + H * 0.066, hy - H * 0.036, H * 0.007, 0, 7); c.fill();
    // arms up holding the reel
    const rx = cx + H * 0.26, ry = ground - H * 0.5 + bob;
    c.strokeStyle = fur; c.lineWidth = H * 0.06; c.lineCap = 'round'; c.beginPath(); c.moveTo(cx + H * 0.05, ground - H * 0.45); c.lineTo(rx, ry); c.stroke();
    c.fillStyle = '#9a6a3a'; c.beginPath(); c.arc(rx, ry, H * 0.06, 0, 7); c.fill(); c.fillStyle = '#c99a62'; c.beginPath(); c.arc(rx, ry, H * 0.03, 0, 7); c.fill();
    return [rx, ry];
  }

  private wind(f: Flight, dt: number, x0: number, x1: number) {
    const c = this.c, P = f.P, s = this.cam.s;
    const [wx0, wy0] = this.toWorld(0, this.h), [wx1, wy1] = this.toWorld(this.w, 0);
    if (this.seeds.length === 0) for (let i = 0; i < 64; i++) this.seeds.push({ x: wx0 + this.r() * (wx1 - wx0), y: wy0 + this.r() * (wy1 - wy0), vx: 0, vy: 0, a: this.r() * 6, s: 0.6 + this.r() * 0.6 });
    c.lineCap = 'round';
    for (const p of this.seeds) {
      const w = windAt(P, f.seed, p.x, p.y, f.t);
      p.vx += (w.u * 0.85 - p.vx) * Math.min(1, dt * 3); p.vy += (w.w + Math.sin(this.time * 1.7 + p.a) * 0.3 - 0.2 - p.vy) * Math.min(1, dt * 3);
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.x > wx1 + 1 || p.y < surfaceAt(P, p.x) || p.y > wy1 + 2 || p.x < wx0 - 6) { p.x = wx0 - this.r() * 3; p.y = Math.max(surfaceAt(P, p.x) + 0.5, wy0 + this.r() * (wy1 - wy0)); p.vx = w.u; p.vy = 0; }
      const X = this.sx(p.x), Y = this.sy(p.y), sp = Math.hypot(p.vx, p.vy), r = Math.max(2.2, s * 0.09) * p.s;
      // a streak behind it: longer in a gust
      c.strokeStyle = `rgba(255,255,255,${clamp(sp / 14, 0.08, 0.4)})`; c.lineWidth = Math.max(1, r * 0.35);
      c.beginPath(); c.moveTo(X, Y); c.lineTo(X - p.vx * 0.09 * s, Y + p.vy * 0.09 * s); c.stroke();
      c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 0.8;
      for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2 + p.a; c.beginPath(); c.moveTo(X, Y); c.lineTo(X + Math.cos(a) * r, Y + Math.sin(a) * r); c.stroke(); }
      c.strokeStyle = 'rgba(200,190,160,.8)'; c.beginPath(); c.moveTo(X, Y); c.lineTo(X - r * 0.4, Y + r * 1.3); c.stroke();
    }
    void x0; void x1;
  }

  private effects(dt: number) {
    const c = this.c, s = this.cam.s;
    this.fx = this.fx.filter((p) => (p.life += dt) < p.max);
    for (const p of this.fx) {
      p.vy -= (p.kind === 'drop' ? 9 : p.kind === 'seed' ? 0.3 : 3) * dt; p.vx *= 1 - dt * 0.8; p.x += p.vx * dt; p.y += p.vy * dt;
      const a = 1 - p.life / p.max, X = this.sx(p.x), Y = this.sy(p.y), R = Math.max(2, p.r * s);
      c.globalAlpha = a; c.fillStyle = p.col;
      if (p.kind === 'spark') { c.beginPath(); for (let k = 0; k < 8; k++) { const an = (k / 8) * Math.PI * 2 + p.spin, rr = k % 2 ? R * 0.3 : R; c.lineTo(X + Math.cos(an) * rr, Y + Math.sin(an) * rr); } c.closePath(); c.fill(); }
      else if (p.kind === 'confetti' || p.kind === 'leaf' || p.kind === 'petal') { c.save(); c.translate(X, Y); c.rotate(p.spin + p.life * 5); c.beginPath(); c.ellipse(0, 0, R, R * 0.5, 0, 0, 7); c.fill(); c.restore(); }
      else if (p.kind === 'seed') { c.strokeStyle = p.col; c.lineWidth = 0.8; for (let k = 0; k < 5; k++) { const an = (k / 5) * Math.PI * 2 + p.spin; c.beginPath(); c.moveTo(X, Y); c.lineTo(X + Math.cos(an) * R, Y + Math.sin(an) * R); c.stroke(); } }
      else { c.beginPath(); c.arc(X, Y, R * 0.6, 0, 7); c.fill(); }
    }
    c.globalAlpha = 1;
    this.pops = this.pops.filter((p) => (p.life += dt) < 1.8);
    c.textAlign = 'center'; c.textBaseline = 'middle';
    for (const p of this.pops) {
      const a = p.life < 0.15 ? p.life / 0.15 : 1 - Math.max(0, p.life - 1.1) / 0.7, X = this.sx(p.x), Y = this.sy(p.y + p.life * 0.8);
      const fs = clamp((p.big ? 0.95 : 0.75) * s, p.big ? 24 : 19, p.big ? 44 : 32);
      c.font = `700 ${fs}px "Patrick Hand", "Comic Sans MS", cursive`;
      c.globalAlpha = clamp(a, 0, 1);
      c.lineWidth = fs * 0.22; c.strokeStyle = 'rgba(255,250,235,.95)'; c.lineJoin = 'round'; c.strokeText(p.text, X, Y);
      c.fillStyle = p.col; c.fillText(p.text, X, Y);
    }
    c.globalAlpha = 1;
  }

  private arrows(f: Flight, o: DrawOpts) {
    const obj = f.objective(); if (!obj) return;
    const c = this.c, X = this.sx(obj[0]), Y = this.sy(obj[1]), ins = o.insets, m = 34;
    if (X > ins.left + m && X < this.w - ins.right - m && Y > ins.top + m && Y < this.h - ins.bottom - m) return;
    const cx = clamp(X, ins.left + m, this.w - ins.right - m), cy = clamp(Y, ins.top + m, this.h - ins.bottom - m), a = Math.atan2(Y - cy, X - cx);
    c.save(); c.translate(cx, cy); c.rotate(a);
    c.fillStyle = 'rgba(251,243,223,.95)'; c.beginPath(); c.arc(0, 0, 20, 0, 7); c.fill();
    c.fillStyle = '#d0503e'; c.beginPath(); c.moveTo(14, 0); c.lineTo(-6, -10); c.lineTo(-2, 0); c.lineTo(-6, 10); c.closePath(); c.fill();
    c.restore();
  }
  private aimMark([x, y]: Pt) {
    const c = this.c, X = this.sx(x), Y = this.sy(y), r = 12 + Math.sin(this.time * 5) * 1.5;
    c.strokeStyle = 'rgba(251,243,223,.9)'; c.lineWidth = 4; c.beginPath(); c.arc(X, Y, r, 0, 7); c.stroke();
    c.strokeStyle = 'rgba(208,80,62,.85)'; c.lineWidth = 2; c.beginPath(); c.arc(X, Y, r, 0, 7); c.stroke();
    c.beginPath(); c.arc(X, Y, 2.5, 0, 7); c.fillStyle = 'rgba(208,80,62,.9)'; c.fill();
  }
}

/** The wind coming at the paws over the next ten seconds, as a painted ribbon: upwind on the left, now on the right. */
export function paintWindStrip(cv: HTMLCanvasElement, f: Flight, dpr: number) {
  const c = cv.getContext('2d'); if (!c) return;
  const w = cv.width / dpr, h = cv.height / dpr; c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h);
  const P = f.P, n = 40, base = P.wind.speed;
  for (let i = 0; i < n; i++) {
    const ahead = (1 - i / (n - 1)) * 10, g = gustAt(P, f.seed, f.me.hx - 2, f.t + ahead), v = (1 + g.gust) * (1 - g.lull);
    const bh = clamp(v, 0.15, 1.6) / 1.6 * (h - 6), x = (i / n) * w;
    c.fillStyle = v > 1 + P.wind.gust * 0.55 ? 'rgba(42,90,170,.85)' : v < 0.8 ? 'rgba(170,190,205,.75)' : 'rgba(90,150,200,.75)';
    c.beginPath(); c.roundRect?.(x + 0.5, h - 3 - bh, w / n - 1, bh, 2); if (!c.roundRect) c.rect(x + 0.5, h - 3 - bh, w / n - 1, bh); c.fill();
  }
  c.fillStyle = 'rgba(58,53,80,.75)'; c.fillRect(w - 2, 0, 2, h);
  void base;
}
