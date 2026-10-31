// Sweep & Slide: the drawing (Canvas 2D), in the style of a linocut winter-sports poster. The millpond, the sheet
// with its painted house, the stones with their turning handles, the aim ghost and the skip's broom, the brooms and
// their strokes, ice chips when stones meet, the measuring tape for close calls, the woodland crowd on the far bank,
// and Dora, Enzo and the other team's captain on the near bank. A camera shows the whole sheet while aiming, runs
// with the stone, and settles on the house. Paintings are cut-outs and backdrops from public/art/curl/; until each
// loads, a print-style stand-in is drawn in its place.
import {
  STONE_R, HALF_W, HOG, TEE, HOUSE_R, RINGS, BACK, END, HACK, speed, dist, ghost, broomOf, type Stone, type Shot, type TeamId,
} from './curl-game.js';

export const INK = { navy: '#1d2a44', ice: '#dceef4', ice2: '#b9d8e6', blue: '#3d6f9e', cream: '#f4ecd8', red: '#c8423a', mustard: '#d9a23a', grey: '#8c96a3', snow: '#f7f4ec' };
export const TEAM_INK: Record<TeamId, string> = { 0: INK.red, 1: INK.mustard };
export type Pose = 'throw' | 'sweep' | 'cheer' | 'groan';
export type Who = 'dora' | 'enzo';
type Box = { x: number; y: number; w: number; h: number };

const IMG = new Map<string, HTMLImageElement>();
export function art(name: string): HTMLImageElement | null {
  if (typeof Image === 'undefined') return null;
  let im = IMG.get(name);
  if (!im) { im = new Image(); im.decoding = 'async'; im.src = `/art/curl/${name}.webp`; IMG.set(name, im); }
  return im.complete && im.naturalWidth > 0 ? im : null;
}
export function preload(caps: string[] = []) {
  for (const n of ['backdrop', 'crowd', 'dora-throw', 'dora-sweep', 'dora-cheer', 'dora-groan', 'enzo-throw', 'enzo-sweep', 'enzo-cheer', 'enzo-groan', ...caps.map((c) => 'cap-' + c)]) art(n);
}

// a seeded speckle for the print grain and the granite
function hash(i: number) { const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); }
let GRAIN: HTMLCanvasElement | null = null;
function grain() {
  if (GRAIN || typeof document === 'undefined') return GRAIN;
  const g = document.createElement('canvas'); g.width = g.height = 160; const c = g.getContext('2d')!;
  for (let i = 0; i < 900; i++) { c.fillStyle = hash(i) > 0.5 ? 'rgba(29,42,68,0.10)' : 'rgba(255,255,255,0.16)'; const r = 0.4 + hash(i + 7) * 1.3; c.fillRect(hash(i + 1) * 160, hash(i + 2) * 160, r, r); }
  GRAIN = g; return g;
}

/** A print-style stand-in for a chinchilla cut-out, bottom-centre at (x, y), h tall. */
export function drawStandIn(c: CanvasRenderingContext2D, who: Who, pose: Pose, x: number, y: number, h: number) {
  const fur = who === 'dora' ? INK.cream : '#8e9cad', eye = who === 'dora' ? '#a3162b' : '#111';
  const up = pose === 'cheer' ? -0.08 : pose === 'groan' ? 0.04 : 0, lean = pose === 'sweep' || pose === 'throw' ? 0.12 : 0;
  c.save(); c.translate(x, y); c.lineWidth = Math.max(2, h * 0.018); c.strokeStyle = INK.navy; c.lineJoin = 'round';
  // tail, body, head, ears, eye, scarf
  c.fillStyle = fur; c.beginPath(); c.ellipse(-h * 0.26, -h * 0.3, h * 0.13, h * 0.16, -0.4, 0, Math.PI * 2); c.fill(); c.stroke();
  c.beginPath(); c.ellipse(h * lean * 0.5, -h * 0.3, h * 0.24, h * 0.27, lean, 0, Math.PI * 2); c.fill(); c.stroke();
  const hx = h * (0.12 + lean), hy = -h * (0.62 - up);
  for (const ex of [-0.1, 0.07]) { c.fillStyle = fur; c.beginPath(); c.ellipse(hx + h * ex, hy - h * 0.17, h * 0.085, h * 0.1, ex, 0, Math.PI * 2); c.fill(); c.stroke(); c.fillStyle = '#f1b3ba'; c.beginPath(); c.ellipse(hx + h * ex, hy - h * 0.165, h * 0.05, h * 0.065, ex, 0, Math.PI * 2); c.fill(); }
  c.fillStyle = fur; c.beginPath(); c.ellipse(hx, hy, h * 0.17, h * 0.15, 0, 0, Math.PI * 2); c.fill(); c.stroke();
  c.fillStyle = eye; c.beginPath(); c.arc(hx + h * 0.08, hy - h * 0.01, h * 0.025, 0, Math.PI * 2); c.fill();
  c.fillStyle = INK.red; c.fillRect(hx - h * 0.15, hy + h * 0.11, h * 0.26, h * 0.05);
  if (pose === 'cheer') { c.beginPath(); c.moveTo(h * 0.05, -h * 0.45); c.lineTo(h * 0.0, -h * 0.85); c.moveTo(h * 0.2, -h * 0.45); c.lineTo(h * 0.32, -h * 0.82); c.stroke(); }
  if (pose === 'sweep') { c.strokeStyle = INK.red; c.lineWidth = h * 0.025; c.beginPath(); c.moveTo(h * 0.1, -h * 0.5); c.lineTo(h * 0.45, -h * 0.02); c.stroke(); c.fillStyle = INK.mustard; c.fillRect(h * 0.36, -h * 0.05, h * 0.2, h * 0.05); }
  c.restore();
}

/** One stone, drawn in world units under the current transform. */
function drawStone(c: CanvasRenderingContext2D, x: number, y: number, team: TeamId, rot: number, glow = 0) {
  const r = STONE_R;
  c.save(); c.translate(x, y);
  c.fillStyle = 'rgba(29,42,68,0.22)'; c.beginPath(); c.arc(r * 0.12, -r * 0.14, r * 1.02, 0, Math.PI * 2); c.fill();
  if (glow > 0) { c.strokeStyle = TEAM_INK[team]; c.globalAlpha = glow; c.lineWidth = r * 0.3; c.beginPath(); c.arc(0, 0, r * 1.45, 0, Math.PI * 2); c.stroke(); c.globalAlpha = 1; }
  c.fillStyle = '#9aa3ad'; c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#c3c9cf'; c.beginPath(); c.arc(0, 0, r * 0.74, 0, Math.PI * 2); c.fill();
  // misregistered team ink on the top, then the handle, turning with the stone
  c.fillStyle = TEAM_INK[team]; c.beginPath(); c.arc(r * 0.06, r * 0.05, r * 0.58, 0, Math.PI * 2); c.fill();
  c.rotate(rot);
  c.fillStyle = INK.navy; c.fillRect(-r * 0.62, -r * 0.13, r * 1.0, r * 0.26);
  c.fillStyle = TEAM_INK[team]; c.fillRect(-r * 0.58, -r * 0.09, r * 0.92, r * 0.18);
  c.rotate(-rot);
  c.strokeStyle = INK.navy; c.lineWidth = r * 0.14; c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.stroke();
  c.restore();
}

/** The painted sheet in world units: ice, lines, house, hack and boards. */
function drawSheet(c: CanvasRenderingContext2D) {
  c.fillStyle = INK.ice; c.fillRect(HACK - 0.6, -HALF_W, END - HACK + 0.6, HALF_W * 2);
  // guard zone wash
  c.fillStyle = 'rgba(61,111,158,0.06)'; c.fillRect(HOG, -HALF_W, TEE - HOUSE_R - HOG, HALF_W * 2);
  // the house, with a little misregistration between the inks
  const ringInk = [INK.blue, INK.cream, INK.red, INK.cream];
  for (let i = 0; i < RINGS.length; i++) { c.fillStyle = ringInk[i]; c.beginPath(); c.arc(TEE + 0.025, 0.02, RINGS[i], 0, Math.PI * 2); c.fill(); }
  c.strokeStyle = INK.navy; c.lineWidth = 0.035;
  for (const r of RINGS) { c.beginPath(); c.arc(TEE, 0, r, 0, Math.PI * 2); c.stroke(); }
  // lines
  const line = (x0: number, y0: number, x1: number, y1: number, w: number, col: string) => { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); };
  line(0, -HALF_W, 0, HALF_W, 0.05, 'rgba(29,42,68,0.35)');
  line(HOG, -HALF_W, HOG, HALF_W, 0.14, INK.red);
  line(TEE, -HALF_W, TEE, HALF_W, 0.04, INK.navy);
  line(BACK, -HALF_W, BACK, HALF_W, 0.06, INK.navy);
  line(HACK + 0.4, 0, END, 0, 0.035, 'rgba(29,42,68,0.55)');
  // hack
  c.fillStyle = INK.navy; c.fillRect(HACK - 0.12, -0.32, 0.24, 0.18); c.fillRect(HACK - 0.12, 0.14, 0.24, 0.18);
  // boards
  c.fillStyle = INK.navy; c.fillRect(HACK - 0.6, HALF_W, END - HACK + 0.75, 0.16); c.fillRect(HACK - 0.6, -HALF_W - 0.16, END - HACK + 0.75, 0.16); c.fillRect(END, -HALF_W - 0.16, 0.16, HALF_W * 2 + 0.32);
  c.fillStyle = INK.red; c.fillRect(HACK - 0.6, HALF_W + 0.04, END - HACK + 0.7, 0.04); c.fillRect(HACK - 0.6, -HALF_W - 0.08, END - HACK + 0.7, 0.04);
}

type Chip = { x: number; y: number; vx: number; vy: number; t: number };
type Mark = { x: number; y: number; t: number; a: number };
export type Measure = { a: { x: number; y: number; team: TeamId }; b: { x: number; y: number; team: TeamId }; t: number };
export type View = 'aim' | 'follow' | 'house';

export class CurlScene {
  cv: HTMLCanvasElement; c: CanvasRenderingContext2D; W = 0; H = 0; dpr = 1;
  stones: Stone[] = []; current: Stone | null = null; counting: number[] = [];
  view: View = 'aim'; slow = false;
  aim: { shot: Shot; pts: { x: number; y: number }[] } | null = null;
  broom: { x: number; y: number; who: Who } | null = null;
  sweeping = false; sweeper: Who | 'opp' | null = null;
  poses: Record<Who, Pose | null> = { dora: 'sweep', enzo: 'sweep' };
  captain: string | null = null; capInk = INK.navy; capBounce = 0;
  measure: Measure | null = null;
  cheerT = 0; flash = 0;
  layout = { tall: false, band: { x: 0, y: 0, w: 0, h: 0 } as Box, crowd: { x: 0, y: 0, w: 0, h: 0 } as Box, dora: { x: 0, y: 0, h: 0 }, enzo: { x: 0, y: 0, h: 0 }, cap: { x: 0, y: 0, h: 0 } };
  bottomPad = 0;
  private cam = { cx: (HACK + END) / 2, s: 40 };
  private rot = new Map<number, number>();
  private chips: Chip[] = []; private marks: Mark[] = []; private trail: { x: number; y: number }[] = [];
  private t = 0;
  constructor(cv: HTMLCanvasElement) { this.cv = cv; this.c = cv.getContext('2d')!; preload(); this.resize(); this.snapCamera(); }

  resize() {
    const r = this.cv.getBoundingClientRect();
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.W = Math.max(1, Math.round(r.width)); this.H = Math.max(1, Math.round(r.height));
    this.cv.width = Math.round(this.W * this.dpr); this.cv.height = Math.round(this.H * this.dpr);
    const W = this.W, H = this.H - this.bottomPad, tall = H > W * 1.05, L = this.layout;
    L.tall = tall;
    if (!tall) {
      const crowdH = Math.round(H * 0.16), bandH = Math.round(H * 0.56);
      L.crowd = { x: 0, y: 0, w: W, h: crowdH };
      L.band = { x: 0, y: crowdH, w: W, h: bandH };
      const ch = Math.min(H * 0.36, W * 0.2);
      L.dora = { x: Math.max(W * 0.07, ch * 0.36), y: H - 6, h: ch * 0.92 }; L.enzo = { x: Math.max(W * 0.07, ch * 0.36) + ch * 0.74, y: H - 4, h: ch };
      L.cap = { x: W - Math.max(W * 0.09, ch * 0.42), y: H - 6, h: ch * 0.95 };
    } else {
      const crowdH = Math.round(H * 0.07), bandH = Math.round(H * 0.72);
      L.crowd = { x: 0, y: 0, w: W, h: crowdH };
      L.band = { x: 0, y: crowdH, w: W, h: bandH };
      const ch = Math.min(H * 0.2, W * 0.4);
      L.dora = { x: W * 0.15, y: H - 4, h: ch * 0.92 }; L.enzo = { x: W * 0.15 + ch * 0.6, y: H - 2, h: ch };
      L.cap = { x: W - ch * 0.42, y: H - 4, h: ch * 0.95 };
    }
  }
  /** The camera's target for the current view. */
  private target() {
    const L = this.layout, B = L.band, long = L.tall ? B.h : B.w, cross = L.tall ? B.w : B.h;
    const fit = Math.min(long / (END - HACK + 0.9), cross / (HALF_W * 2 + 0.8));
    const house = Math.min(long / 8.6, cross / (HALF_W * 2 + 0.5));
    if (this.view === 'aim') {
      // upright screens are too narrow for the whole sheet: show the far end big, with the stone at the hack as an inset
      if (L.tall) { const s = Math.min(long / 13.6, cross / (HALF_W * 2 + 0.8)); return { cx: END + 0.45 - long / (2 * s), s }; }
      return { cx: (HACK + END) / 2 - 0.15, s: fit };
    }
    if (this.view === 'house') return { cx: Math.min(END + 0.3 - long / (2 * house), TEE - 1.0), s: house };
    const cur = this.current, x = cur ? cur.x : 0;
    const s = this.slow && x > HOG - 2 ? house : Math.min(house, Math.max(fit * 1.6, house * 0.72));
    const half = long / (2 * s), lead = cur && speed(cur) > 0.3 ? 2.2 : 0.8;
    return { cx: Math.max(HACK - 0.7 + half, Math.min(END + 0.3 - half, x + lead)), s };
  }
  snapCamera() { const t = this.target(); this.cam = { ...t }; }
  /** World → screen. */
  toScreen(x: number, y: number) {
    const B = this.layout.band, ox = B.x + B.w / 2, oy = B.y + B.h / 2, s = this.cam.s;
    return this.layout.tall ? { x: ox - y * s, y: oy - (x - this.cam.cx) * s } : { x: ox + (x - this.cam.cx) * s, y: oy - y * s };
  }
  /** A screen drag (dx, dy in pixels) as a world vector. */
  dragToWorld(dx: number, dy: number) { return this.layout.tall ? { x: -dy, y: -dx } : { x: dx, y: -dy }; }
  get scale() { return this.cam.s; }
  /** The house's on-screen circle, for the tests. */
  house() { const p = this.toScreen(TEE, 0); return { x: p.x, y: p.y, r: (HOUSE_R + STONE_R) * this.cam.s }; }
  settled() { const t = this.target(); return Math.abs(t.s - this.cam.s) < 0.5 && Math.abs(t.cx - this.cam.cx) < 0.05; }

  hit(x: number, y: number, v: number) {
    const n = Math.min(14, 4 + Math.round(v * 4));
    for (let i = 0; i < n; i++) { const a = hash(this.t * 100 + i) * Math.PI * 2, sp = (0.6 + hash(i + this.t) * 1.4) * Math.min(1.6, v); this.chips.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0 }); }
    this.flash = Math.min(1, 0.3 + v * 0.25);
  }
  clearTrail() { this.trail = []; this.marks = []; }
  cheer() { this.cheerT = 1.6; }

  frame(dt: number) {
    this.t += dt;
    const tg = this.target(), k = 1 - Math.exp(-dt * (this.view === 'follow' ? 4 : 2.6));
    this.cam.cx += (tg.cx - this.cam.cx) * k; this.cam.s += (tg.s - this.cam.s) * k;
    for (const s of this.stones) if (!s.out) this.rot.set(s.id, (this.rot.get(s.id) ?? s.id * 0.7) + s.w * dt);
    const cur = this.current;
    if (cur && !cur.out && cur.moving) {
      const last = this.trail[this.trail.length - 1];
      if (!last || Math.abs(last.x - cur.x) + Math.abs(last.y - cur.y) > 0.12) this.trail.push({ x: cur.x, y: cur.y });
      if (this.sweeping && this.sweeper) this.marks.push({ x: cur.x + 0.45 + hash(this.t * 50) * 0.2, y: cur.y + (hash(this.t * 70) - 0.5) * 0.3, t: 0, a: (hash(this.t * 30) - 0.5) * 0.8 });
    }
    for (const m of this.marks) m.t += dt; this.marks = this.marks.filter((m) => m.t < 1.4);
    for (const p of this.chips) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.92; p.vy *= 0.92; } this.chips = this.chips.filter((p) => p.t < 0.7);
    if (this.measure) this.measure.t = Math.min(1, this.measure.t + dt * 0.8);
    this.cheerT = Math.max(0, this.cheerT - dt); this.flash = Math.max(0, this.flash - dt * 2.5); this.capBounce = Math.max(0, this.capBounce - dt);
    this.draw();
  }

  private draw() {
    const c = this.c, W = this.W, H = this.H, L = this.layout, B = L.band;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    // the pond and its banks
    const bg = art('backdrop');
    if (bg) { const k = Math.max(W / bg.naturalWidth, H / bg.naturalHeight); c.drawImage(bg, (W - bg.naturalWidth * k) / 2, (H - bg.naturalHeight * k) / 2, bg.naturalWidth * k, bg.naturalHeight * k); }
    else { c.fillStyle = INK.snow; c.fillRect(0, 0, W, H); c.fillStyle = INK.ice2; c.fillRect(B.x, B.y, B.w, B.h); }
    this.drawCrowd();
    // the sheet, clipped to the band
    c.save(); c.beginPath(); c.rect(B.x, B.y, B.w, B.h); c.clip();
    c.fillStyle = 'rgba(220,238,244,0.35)'; c.fillRect(B.x, B.y, B.w, B.h);
    this.world(() => drawSheet(c));
    this.drawMarks();
    this.drawAim();
    this.world(() => {
      if (this.trail.length > 1) { c.strokeStyle = 'rgba(61,111,158,0.28)'; c.lineWidth = 0.05; c.setLineDash([0.12, 0.14]); c.beginPath(); this.trail.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y))); if (this.current && !this.current.out) c.lineTo(this.current.x, this.current.y); c.stroke(); c.setLineDash([]); }
      const pulse = 0.55 + 0.45 * Math.sin(this.t * 6);
      for (const s of this.stones) if (!s.out) drawStone(c, s.x, s.y, s.team, this.rot.get(s.id) ?? 0, this.counting.includes(s.id) ? pulse : 0);
      for (const p of this.chips) { c.fillStyle = `rgba(255,255,255,${1 - p.t / 0.7})`; c.fillRect(p.x - 0.03, p.y - 0.03, 0.06, 0.06); }
    });
    this.drawMeasure();
    this.drawSweeper();
    this.drawCountBadges();
    c.restore();
    // band edges like a print border
    c.fillStyle = INK.navy; c.fillRect(B.x, B.y - 2, B.w, 3); c.fillRect(B.x, B.y + B.h - 1, B.w, 3);
    this.drawBench();
    const g = grain(); if (g) { c.globalAlpha = 0.5; c.fillStyle = c.createPattern(g, 'repeat')!; c.fillRect(0, 0, W, H); c.globalAlpha = 1; }
    if (this.flash > 0) { c.fillStyle = `rgba(255,255,255,${this.flash * 0.25})`; c.fillRect(B.x, B.y, B.w, B.h); }
  }
  /** Runs a drawing in world units. */
  private world(f: () => void) {
    const c = this.c, B = this.layout.band, ox = B.x + B.w / 2, oy = B.y + B.h / 2, s = this.cam.s;
    c.save();
    if (this.layout.tall) c.transform(0, -s, -s, 0, ox, oy + this.cam.cx * s); else c.transform(s, 0, 0, -s, ox - this.cam.cx * s, oy);
    f(); c.restore();
  }
  private drawCrowd() {
    const c = this.c, C = this.layout.crowd; if (C.h < 4) return;
    const im = art('crowd'), bob = this.cheerT > 0 ? Math.abs(Math.sin(this.t * 12)) * 4 * Math.min(1, this.cheerT) : 0;
    c.save(); c.beginPath(); c.rect(C.x, C.y, C.w, C.h); c.clip();
    if (im) {
      // the middle band of the frieze, where the animals stand, tiled across if the screen is wider
      const sh = im.naturalHeight * 0.66, sy = im.naturalHeight * 0.1, k = C.h / sh, w = im.naturalWidth * k, n = Math.ceil(C.w / w);
      for (let i = 0, x = C.x + (C.w - n * w) / 2; i < n; i++, x += w) {
        const jump = bob * (i % 2 ? 1 : 0.6);
        if (i % 2) { c.save(); c.translate(x + w, 0); c.scale(-1, 1); c.drawImage(im, 0, sy, im.naturalWidth, sh, 0, C.y - jump, w, C.h + jump); c.restore(); }
        else c.drawImage(im, 0, sy, im.naturalWidth, sh, x, C.y - jump, w, C.h + jump);
      }
    } else {
      c.fillStyle = '#e9e2d0'; c.fillRect(C.x, C.y, C.w, C.h);
      for (let i = 0; i < C.w / 34; i++) { const x = i * 34 + 14, y = C.y + C.h * 0.62 - bob * (i % 2); c.fillStyle = i % 3 ? INK.navy : INK.red; c.beginPath(); c.arc(x, y, C.h * 0.16, 0, Math.PI * 2); c.fill(); c.beginPath(); c.arc(x - 5, y - C.h * 0.18, 4, 0, Math.PI * 2); c.arc(x + 5, y - C.h * 0.18, 4, 0, Math.PI * 2); c.fill(); }
      c.fillStyle = INK.snow; c.fillRect(C.x, C.y + C.h * 0.72, C.w, C.h * 0.3);
    }
    c.restore();
    c.fillStyle = INK.navy; c.fillRect(C.x, C.y + C.h - 2, C.w, 2);
  }
  private drawAim() {
    const a = this.aim, c = this.c; if (!a) return;
    const s = this.cam.s, br = broomOf(a.shot);
    // the line of delivery toward the tee line (no curl shown), and the dotted ghost of the first metres
    const B = this.layout.band, inset = this.layout.tall && this.toScreen(0, 0).y > B.y + B.h - 30;
    const p1 = this.toScreen(br.x, br.y), p0 = inset ? this.insetPoint(a.shot) : this.toScreen(0, 0);
    if (inset) this.drawInset(p0);
    else this.world(() => drawStone(c, 0, 0, 0, this.rot.get(-1) ?? 0));
    c.strokeStyle = 'rgba(29,42,68,0.32)'; c.lineWidth = 1.5; c.setLineDash([6, 8]); c.beginPath(); c.moveTo(p0.x, p0.y); c.lineTo(p1.x, p1.y); c.stroke(); c.setLineDash([]);
    c.fillStyle = INK.navy;
    a.pts.forEach((p, i) => { if (i % 2) return; const q = this.toScreen(p.x, p.y); c.globalAlpha = 1 - i / a.pts.length * 0.7; c.beginPath(); c.arc(q.x, q.y, Math.max(2, s * 0.045), 0, Math.PI * 2); c.fill(); });
    c.globalAlpha = 1;
    // the aim mark where the line meets the tee line
    c.strokeStyle = INK.navy; c.lineWidth = 2; c.beginPath(); c.arc(p1.x, p1.y, Math.max(5, s * 0.1), 0, Math.PI * 2); c.stroke();
    // the curl, as a turning arrow around the stone at the hack
    const r = inset ? 34 : Math.max(14, s * STONE_R * 2.1), dir = -a.shot.curl;
    c.strokeStyle = INK.red; c.lineWidth = 3; c.beginPath(); c.arc(p0.x, p0.y, r, -Math.PI * 0.85, -Math.PI * 0.15); c.stroke();
    const ang = dir > 0 ? -Math.PI * 0.15 : -Math.PI * 0.85, tx = p0.x + Math.cos(ang) * r, ty = p0.y + Math.sin(ang) * r, tdir = ang + (dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    c.fillStyle = INK.red; c.beginPath(); c.moveTo(tx + Math.cos(tdir) * 9, ty + Math.sin(tdir) * 9); c.lineTo(tx + Math.cos(tdir + 2.4) * 8, ty + Math.sin(tdir + 2.4) * 8); c.lineTo(tx + Math.cos(tdir - 2.4) * 8, ty + Math.sin(tdir - 2.4) * 8); c.fill();
    // the skip's broom: where the teammate asks you to aim
    if (this.broom) this.drawBroom(this.broom.x, this.broom.y);
  }
  /** Where the stone waiting at the hack is drawn (in the inset on an upright screen). */
  hackPoint() { const B = this.layout.band, p = this.toScreen(0, 0); return this.layout.tall && p.y > B.y + B.h - 30 ? this.insetPoint(this.aim?.shot ?? { angle: 0, weight: 0.5, curl: 1 }) : p; }
  /** Where the line of delivery enters the bottom of the ice on an upright screen. */
  private insetPoint(shot: Shot) {
    const B = this.layout.band, s = this.cam.s, xb = this.cam.cx - (B.h / 2 - 34) / s;
    return this.toScreen(xb, Math.tan(shot.angle) * xb);
  }
  /** The stone waiting at the hack, drawn in a round frame at the foot of the ice when the hack is off screen. */
  private drawInset(p: { x: number; y: number }) {
    const c = this.c, r = 26;
    c.save(); c.fillStyle = INK.ice; c.strokeStyle = INK.navy; c.lineWidth = 3; c.beginPath(); c.arc(p.x, p.y, r, 0, Math.PI * 2); c.fill(); c.stroke();
    c.translate(p.x, p.y); c.scale(r / (STONE_R * 1.6), -r / (STONE_R * 1.6)); drawStone(c, 0, 0, 0, Math.PI / 2); c.restore();
  }
  private drawBroom(x: number, y: number) {
    const c = this.c, p = this.toScreen(x, y), s = Math.max(16, this.cam.s * 0.5), wob = Math.sin(this.t * 3) * 0.08;
    c.save(); c.translate(p.x, p.y);
    c.strokeStyle = 'rgba(29,42,68,0.6)'; c.lineWidth = 2; c.setLineDash([3, 3]); c.beginPath(); c.arc(0, 0, s * 0.42, 0, Math.PI * 2); c.stroke(); c.setLineDash([]);
    c.rotate(-0.5 + wob);
    c.fillStyle = INK.navy; c.fillRect(-2, -s * 1.9, 4, s * 1.8);
    c.fillStyle = INK.red; c.fillRect(-s * 0.36, -s * 0.18, s * 0.72, s * 0.3); c.strokeStyle = INK.navy; c.lineWidth = 2; c.strokeRect(-s * 0.36, -s * 0.18, s * 0.72, s * 0.3);
    c.restore();
  }
  private drawMarks() {
    const c = this.c, s = this.cam.s;
    for (const m of this.marks) { const p = this.toScreen(m.x, m.y); c.strokeStyle = `rgba(255,255,255,${0.8 * (1 - m.t / 1.4)})`; c.lineWidth = Math.max(1.5, s * 0.03); c.beginPath(); c.arc(p.x, p.y, s * 0.18, m.a - 0.7, m.a + 0.7); c.stroke(); }
  }
  /** The sweeper running ahead of the thrown stone: Dora or Enzo from their cut-out, or the other team's broom. */
  private drawSweeper() {
    const cur = this.current, who = this.sweeper; if (!cur || cur.out || !cur.moving || !who) return;
    const c = this.c, s = this.cam.s, sw = this.sweeping, jig = sw ? Math.sin(this.t * 26) : 0;
    const bx = cur.x + 0.55 + jig * 0.06, side = this.layout.tall ? 0.52 : 0.5;
    if (who === 'opp') {
      const p = this.toScreen(bx, cur.y), q = this.toScreen(bx - 0.6, cur.y + side * 1.6);
      c.strokeStyle = INK.navy; c.lineWidth = Math.max(3, s * 0.05); c.beginPath(); c.moveTo(q.x, q.y); c.lineTo(p.x, p.y); c.stroke();
      c.fillStyle = INK.mustard; c.save(); c.translate(p.x, p.y); c.rotate(this.layout.tall ? 0 : Math.PI / 2); c.fillRect(-s * 0.2, -s * 0.07, s * 0.4, s * 0.14); c.strokeRect(-s * 0.2, -s * 0.07, s * 0.4, s * 0.14); c.restore();
      return;
    }
    const h = Math.max(70, Math.min(this.layout.band.h * 0.6, s * 2.1)), p = this.toScreen(cur.x + 0.2, cur.y + side);
    const im = art(`${who}-sweep`), x = p.x + (this.layout.tall ? -h * 0.15 : -h * 0.1) + jig * h * 0.03, y = p.y + h * 0.05;
    if (im) this.c.drawImage(im, x - h / 2, y - h, h, h); else drawStandIn(c, who, 'sweep', x, y, h * 0.9);
  }
  private drawMeasure() {
    const m = this.measure, c = this.c; if (!m) return;
    const o = this.toScreen(TEE, 0);
    for (const [i, s] of [m.a, m.b].entries()) {
      const p = this.toScreen(s.x, s.y), f = Math.min(1, m.t * 1.6 - i * 0.4); if (f <= 0) continue;
      const ex = o.x + (p.x - o.x) * f, ey = o.y + (p.y - o.y) * f;
      c.strokeStyle = INK.navy; c.lineWidth = 7; c.beginPath(); c.moveTo(o.x, o.y); c.lineTo(ex, ey); c.stroke();
      c.strokeStyle = INK.mustard; c.lineWidth = 4.5; c.beginPath(); c.moveTo(o.x, o.y); c.lineTo(ex, ey); c.stroke();
      if (f >= 1) {
        const d = Math.round((dist(s) - STONE_R) * 100), lx = (o.x + p.x) / 2, ly = (o.y + p.y) / 2;
        c.font = '700 14px "Alfa Slab One", Georgia, serif'; const t = `${Math.max(0, d)} cm`, w = c.measureText(t).width + 12;
        c.fillStyle = TEAM_INK[s.team]; c.fillRect(lx - w / 2, ly - 12, w, 22); c.strokeStyle = INK.navy; c.lineWidth = 2; c.strokeRect(lx - w / 2, ly - 12, w, 22);
        c.fillStyle = s.team === 0 ? INK.cream : INK.navy; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(t, lx, ly);
      }
    }
    c.fillStyle = INK.navy; c.beginPath(); c.arc(o.x, o.y, 5, 0, Math.PI * 2); c.fill();
  }
  private drawCountBadges() {
    const c = this.c; if (!this.counting.length) return;
    this.counting.forEach((id, i) => {
      const s = this.stones.find((t) => t.id === id); if (!s || s.out) return;
      const p = this.toScreen(s.x, s.y), r = Math.max(10, this.cam.s * 0.16), off = this.cam.s * STONE_R + r * 0.6;
      c.fillStyle = TEAM_INK[s.team]; c.strokeStyle = INK.navy; c.lineWidth = 2; c.beginPath(); c.arc(p.x + off, p.y - off, r, 0, Math.PI * 2); c.fill(); c.stroke();
      c.fillStyle = s.team === 0 ? INK.cream : INK.navy; c.font = `700 ${Math.round(r * 1.2)}px "Alfa Slab One", Georgia, serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(i + 1), p.x + off, p.y - off + 1);
    });
  }
  private drawBench() {
    const c = this.c, L = this.layout;
    for (const who of ['enzo', 'dora'] as Who[]) {
      const pose = this.poses[who], d = L[who]; if (!pose) continue;
      const hop = pose === 'cheer' ? Math.abs(Math.sin(this.t * 7)) * d.h * 0.05 : 0;
      const im = art(`${who}-${pose}`);
      c.fillStyle = 'rgba(29,42,68,0.18)'; c.beginPath(); c.ellipse(d.x, d.y - 4, d.h * 0.3, d.h * 0.04, 0, 0, Math.PI * 2); c.fill();
      if (im) c.drawImage(im, d.x - d.h / 2, d.y - d.h - hop, d.h, d.h); else drawStandIn(c, who, pose, d.x, d.y - hop, d.h * 0.9);
    }
    if (this.captain) {
      const d = L.cap, im = art('cap-' + this.captain), hop = this.capBounce > 0 ? Math.sin(this.capBounce * 12) * d.h * 0.03 : 0;
      c.fillStyle = 'rgba(29,42,68,0.18)'; c.beginPath(); c.ellipse(d.x, d.y - 4, d.h * 0.3, d.h * 0.04, 0, 0, Math.PI * 2); c.fill();
      if (im) c.drawImage(im, d.x - d.h / 2, d.y - d.h - hop, d.h, d.h);
      else { c.fillStyle = this.capInk; c.strokeStyle = INK.navy; c.lineWidth = 3; c.beginPath(); c.ellipse(d.x, d.y - d.h * 0.35, d.h * 0.22, d.h * 0.32, 0, 0, Math.PI * 2); c.fill(); c.stroke(); c.beginPath(); c.arc(d.x - d.h * 0.02, d.y - d.h * 0.72, d.h * 0.15, 0, Math.PI * 2); c.fill(); c.stroke(); c.fillStyle = INK.cream; c.beginPath(); c.arc(d.x - d.h * 0.08, d.y - d.h * 0.74, d.h * 0.03, 0, Math.PI * 2); c.fill(); }
    }
  }
  /** Sets the aim ghost for a shot (null hides it). */
  setAim(shot: Shot | null) { this.aim = shot ? { shot, pts: ghost(shot, 4.5) } : null; }
}

// ---- stand-ins for the title and ending paintings
function poster(c: CanvasRenderingContext2D, night: boolean) {
  const W = c.canvas.width, H = c.canvas.height;
  c.fillStyle = night ? INK.navy : '#f0c98a'; c.fillRect(0, 0, W, H * 0.55);
  c.fillStyle = night ? '#2b3d63' : '#e6a86a'; c.fillRect(0, H * 0.35, W, H * 0.2);
  for (let i = 0; i < 9; i++) { const x = (i / 8) * W, h = H * (0.18 + hash(i) * 0.12); c.fillStyle = INK.navy; c.beginPath(); c.moveTo(x - h * 0.4, H * 0.55); c.lineTo(x, H * 0.55 - h); c.lineTo(x + h * 0.4, H * 0.55); c.fill(); }
  c.fillStyle = INK.ice; c.fillRect(0, H * 0.55, W, H * 0.45);
  c.fillStyle = INK.blue; c.beginPath(); c.ellipse(W * 0.8, H * 0.72, W * 0.12, H * 0.06, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = INK.red; c.beginPath(); c.ellipse(W * 0.8, H * 0.72, W * 0.04, H * 0.02, 0, 0, Math.PI * 2); c.fill();
  if (night) for (let i = 0; i < 40; i++) { c.fillStyle = INK.cream; c.fillRect(hash(i) * W, hash(i + 50) * H * 0.4, 3, 3); }
  drawStandIn(c, 'dora', night ? 'cheer' : 'throw', W * 0.25, H * 0.88, H * 0.42);
  drawStandIn(c, 'enzo', night ? 'cheer' : 'sweep', W * 0.45, H * 0.9, H * 0.46);
}
export const paintTitle = (cv: HTMLCanvasElement) => { const c = cv.getContext('2d'); if (c) poster(c, false); };
export const paintEnding = (cv: HTMLCanvasElement) => { const c = cv.getContext('2d'); if (c) poster(c, true); };
