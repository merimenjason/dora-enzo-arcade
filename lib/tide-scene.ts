// Tidepool's drawing, all Canvas 2D in a claymation style: chunky plasticine shapes with a fingerprint texture, a
// glossy highlight, soft contact shadows and outlines that "boil" (re-jitter twelve times a second, like stop-motion).
// The pool is a side-on cross-section: sky and shore behind, the rock rim, the water (rising over the rim at high
// tide), the sand, the rocks with their algae, the seaweed, and every creature. Dora and Enzo sit on the rim as clay
// cut-outs (painted sheets keyed out, with a drawn clay stand-in until they load), facing the pool. Drawing only: the
// rules live in tide-game.ts.
import { TideGame, W, POOL, PLANK, floorY, type Agent, type Ev, type Kind, type Weed, type Rock, type Gull, type Jelly, type Sp, type Tool } from './tide-game';

export type Pose = 'peer' | 'write' | 'bucket' | 'cheer';
export type Aim = { tool: Tool | `bring:${Sp}`; x: number; y: number; ok: boolean } | null;
type Pt = [number, number];
type Pop = { x: number; y: number; t: number; life: number; text?: string; color: string; vx: number; vy: number; r: number; kind: 'word' | 'bubble' | 'speck' | 'drop' | 'ring' | 'star' };

/** How much bigger than its rule-size each creature is drawn, so it reads clearly. */
const CS: Record<Sp, number> = { anemone: 1.7, mussel: 1.6, limpet: 1.7, periwinkle: 1.7, shrimp: 1.9, hermit: 1.75, blenny: 1.9, starfish: 1.6 };
const FONT = "'Fredoka', 'Baloo 2', ui-rounded, 'Trebuchet MS', system-ui, sans-serif";
/** A small fixed hash, so the clay's wobble is the same every time for the same thing and frame. */
const hash = (a: number, b = 0) => { const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const shade = (hex: string, k: number) => {
  const n = parseInt(hex.slice(1), 16); let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (k < 0) { r *= 1 + k; g *= 1 + k; b *= 1 + k; } else { r += (255 - r) * k; g += (255 - g) * k; b += (255 - b) * k; }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
};

/** The fingerprint whorls pressed into every clay shape. */
let printTile: HTMLCanvasElement | null = null;
function prints(ctx: CanvasRenderingContext2D) {
  if (!printTile) {
    printTile = document.createElement('canvas'); printTile.width = printTile.height = 96;
    const c = printTile.getContext('2d')!;
    c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 1;
    for (const [cx, cy, n] of [[30, 34, 7], [74, 70, 6], [78, 18, 4], [16, 82, 4]] as const) for (let i = 1; i <= n; i++) { c.beginPath(); c.ellipse(cx, cy, i * 2.6, i * 2.1, 0.6, 0.3, Math.PI * 1.75); c.stroke(); }
    c.strokeStyle = 'rgba(255,255,255,0.6)';
    for (let i = 0; i < 9; i++) { c.beginPath(); c.moveTo(hash(i) * 96, hash(i, 2) * 96); c.lineTo(hash(i) * 96 + 10, hash(i, 2) * 96 + 3); c.stroke(); }
  }
  return ctx.createPattern(printTile, 'repeat');
}

export class TideScene {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private g: TideGame | null = null;
  private w = 1; private h = 1; private dpr = 1;
  /** The clear part of the screen (the HUD covers the rest). */
  inset = { top: 0, right: 0, bottom: 0, left: 0 };
  private s = 6; private ox = 0; private oy = 0;
  private time = 0; private boil = 0;
  private pops: Pop[] = [];
  private art = new Map<string, HTMLImageElement>();
  private flash = 0; private splash = 0; private storm = 0;
  private chins: { who: string; x: number; y: number; w: number; h: number }[] = [];
  /** Whether the puppets sit lower and smaller (an upright phone). */
  compact = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('no 2d');
    this.ctx = ctx;
    for (const n of ['backdrop', ...(['dora', 'enzo'] as const).flatMap((w) => (['peer', 'write', 'bucket', 'cheer'] as const).map((p) => `${w}-${p}`))]) this.load(n);
    this.resize();
  }
  private load(name: string) {
    if (this.art.has(name)) return;
    const img = new Image(); img.decoding = 'async'; img.src = `/art/tide/${name}.webp`; this.art.set(name, img);
  }
  private ready(name: string) { const i = this.art.get(name); return i && i.complete && i.naturalWidth > 0 ? i : null; }
  setGame(g: TideGame | null) { this.g = g; this.pops = []; }
  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = Math.max(1, r.width); this.h = Math.max(1, r.height);
    const W2 = Math.round(this.w * this.dpr), H2 = Math.round(this.h * this.dpr);
    if (this.canvas.width !== W2 || this.canvas.height !== H2) { this.canvas.width = W2; this.canvas.height = H2; }
  }
  /** Fits the pool (x 0–160, y 14–90) into the clear part of the screen; spare height goes to the sky. */
  private fit() {
    const i = this.inset, aw = Math.max(50, this.w - i.left - i.right), ah = Math.max(50, this.h - i.top - i.bottom);
    const top = this.compact ? 10 : 12, span = 90 - top, x0 = this.compact ? 9 : 0, x1 = this.compact ? W - 9 : W;
    this.s = Math.min(aw / (x1 - x0), ah / span);
    this.ox = i.left + (aw - (x1 - x0) * this.s) / 2 - x0 * this.s;
    this.oy = i.top + ah - 90 * this.s;
  }
  toScreen(x: number, y: number): Pt { return [this.ox + x * this.s, this.oy + y * this.s]; }
  toWorld(px: number, py: number): Pt { return [(px - this.ox) / this.s, (py - this.oy) / this.s]; }
  metrics() { return { chins: this.chins.map((c) => ({ ...c })), scale: this.s, pool: { x: this.ox + POOL.x0 * this.s, y: this.oy + POOL.high * this.s, w: (POOL.x1 - POOL.x0) * this.s, h: (88 - POOL.high) * this.s } }; }

  /** Turns game events into little clay reactions: words, bubbles, splashes. */
  feed(events: Ev[]) {
    for (const e of events) {
      switch (e.k) {
        case 'eat': this.word(e.x, e.y - 3, e.who === 'gull' ? 'snap!' : e.who === 'blenny' && e.food === 'shrimp' ? 'gulp!' : e.who === 'starfish' ? 'munch' : 'nom', e.who === 'gull' || e.food === 'shrimp' ? '#d9534f' : '#5a8a3a', 0.8); break;
        case 'born': for (let i = 0; i < 6; i++) this.pop({ kind: 'star', x: e.x, y: e.y, vx: (hash(i, e.x) - 0.5) * 6, vy: -2 - hash(e.y, i) * 4, life: 0.9, color: '#ffd76a', r: 0.8 }); if (e.how === 'brought') this.word(e.x, e.y - 4, 'plop!', '#2f7f8f', 1); else if (e.how !== 'bud') this.word(e.x, e.y - 4, 'new!', '#e07a2f', 0.8); break;
        case 'die': if (e.cause !== 'gull' && e.cause !== 'eaten') for (let i = 0; i < 5; i++) this.pop({ kind: 'bubble', x: e.x, y: e.y, vx: (hash(i) - 0.5) * 2, vy: -3 - i, life: 1.4, color: '#e8f4f4', r: 0.7 }); break;
        case 'hide': this.word(e.x, e.y - 4, 'phew!', '#3a8a5a', 0.9); break;
        case 'swap': this.word(e.x, e.y - 5, e.bigger ? 'roomy!' : 'swap', '#c0602a', 1.1); break;
        case 'nest': this.word(e.x, e.y - 8, 'a nest!', '#c0602a', 1.4); break;
        case 'spawn': for (let i = 0; i < 40; i++) this.pop({ kind: 'speck', x: e.x + (hash(i) - 0.5) * 6, y: e.y - 2, vx: (hash(i, 3) - 0.5) * 5, vy: -4 - hash(i, 4) * 6, life: 3, color: '#ffb070', r: 0.35 }); this.word(e.x, e.y - 8, 'spawning!', '#e07a2f', 1.6); break;
        case 'gull': if (e.st === 'shoo') this.word(e.x, e.y + 4, 'shoo!', '#2f6f8f', 1); else if (e.st === 'grab') { this.splash = 0.6; this.word(e.x, e.y - 2, 'snatch!', '#d9534f', 1); } else if (e.st === 'dive') this.word(e.x, e.y + 5, 'swoop', '#7a7a7a', 0.7); break;
        case 'tide': if (e.high) this.splash = 1; break;
        case 'storm': this.storm = 1; this.splash = 1.5; break;
        case 'act':
          if (e.t === 'bucket') { this.splash = 0.8; for (let i = 0; i < 18; i++) this.pop({ kind: 'drop', x: 70 + hash(i) * 20, y: 34, vx: (hash(i, 2) - 0.5) * 8, vy: -6 - hash(i, 5) * 6, life: 1, color: '#9fe0ea', r: 0.6 }); this.word(80, 36, 'sploosh!', '#2f8f9f', 1.2); }
          else if (e.t === 'rock') this.word(e.x, e.y - 3, 'thunk', '#6a6a6a', 0.8);
          else if (e.t === 'plant') this.word(e.x, e.y - 4, 'planted', '#3a8a3a', 0.8);
          else if (e.t === 'trim') this.word(e.x, e.y, 'snip', '#3a8a3a', 0.7);
          else if (e.t === 'shell') this.word(e.x, e.y - 3, 'clack', '#c0802a', 0.8);
          for (let i = 0; i < 8; i++) this.pop({ kind: 'bubble', x: e.x + (hash(i) - 0.5) * 4, y: e.y, vx: 0, vy: -4 - hash(i, 1) * 3, life: 1.1, color: '#e8f8f8', r: 0.5 + hash(i, 2) * 0.5 });
          break;
        case 'page': this.flash = 1; break;
        default: break;
      }
    }
  }
  private word(x: number, y: number, text: string, color: string, life: number) {
    // one word at a time in any spot: a crowd of anemones feeding shows a single 'nom', not a pile of them
    if (this.pops.some((p) => p.kind === 'word' && Math.abs(p.x - x) < 12 && Math.abs(p.y - y) < 7 && p.t < p.life * 0.8)) return;
    this.pops.push({ kind: 'word', x, y, vx: 0, vy: -2.5, t: 0, life, text, color, r: 1 });
  }
  private pop(p: Omit<Pop, 't'>) { if (this.pops.length < 220) this.pops.push({ ...p, t: 0 }); }

  // ---------------------------------------------------------------- one frame
  draw(g: TideGame | null, o: { dt: number; alpha: number; aim: Aim; poses: { dora: Pose; enzo: Pose }; look: { kind: Kind; id: number } | null; menu?: boolean }) {
    const c = this.ctx, d = this.dpr;
    this.time += o.dt; this.boil = Math.floor(this.time * 12);
    this.flash = Math.max(0, this.flash - o.dt); this.splash = Math.max(0, this.splash - o.dt * 0.8); this.storm = Math.max(0, this.storm - o.dt * 0.25);
    this.fit();
    c.setTransform(d, 0, 0, d, 0, 0);
    c.clearRect(0, 0, this.w, this.h);
    this.back(g);
    const s = this.s;
    c.save(); c.translate(this.ox, this.oy); c.scale(s, s);
    void s;
    const level = g ? g.level : 0.5, wy = g ? g.waterY : 36;
    this.backWater(wy, g);
    this.walls();
    this.sand();
    if (g) {
      const a = o.alpha;
      for (const r of g.rocks) this.rock(r);
      for (const sh of g.shells) this.emptyShell(sh.x, sh.y, sh.size, sh.id);
      for (const sc of g.scraps) this.scrap(sc.x, sc.y, sc.amt, sc.id);
      for (const w of g.weeds) this.weed(w, g);
      const look = o.look;
      for (const ag of g.agents) {
        const x = lerp(ag.px, ag.x, a), y = lerp(ag.py, ag.y, a);
        if (look && look.id === ag.id) this.ring(x, y - 1.5, 7.5);
        this.creature(ag, x, y);
      }
      for (const j of g.jellies) { const x = lerp(j.px, j.x, a), y = lerp(j.py, j.y, a); if (look && look.id === j.id) this.ring(x, y, 8); c.save(); c.translate(x, y); c.scale(1.6, 1.6); c.translate(-x, -y); this.jelly(x, y, j.t, 1); c.restore(); }
      if (look) for (const w of g.weeds) if (w.id === look.id) this.ring(w.x, (floorY(w.x) + g.weedTop(w)) / 2, 6);
    } else this.demoPool();
    this.frontWater(wy, level, g);
    if (g?.plank) this.plank();
    if (g) for (const gu of g.gulls) this.gull(gu, o.alpha, o.look?.id === gu.id);
    this.weatherFx(g);
    this.puppets(o.poses, wy);
    this.aim(o.aim, g);
    this.drawPops(o.dt);
    c.restore();
    if (this.flash > 0) { c.fillStyle = `rgba(255,240,200,${this.flash * 0.18})`; c.fillRect(0, 0, this.w, this.h); }
  }

  // ---------------------------------------------------------------- the shore behind
  private back(g: TideGame | null) {
    const c = this.ctx, season = g?.season ?? 1, img = this.ready('backdrop');
    const sky = c.createLinearGradient(0, 0, 0, this.h);
    const tops = ['#9fd4ee', '#86c8f0', '#f2c79a', '#b9c4d2'], lows = ['#e8f4ec', '#fdf1d6', '#fde0b8', '#e6dccb'];
    sky.addColorStop(0, tops[season]); sky.addColorStop(0.6, lows[season]); sky.addColorStop(1, '#e8d2a4');
    c.fillStyle = sky; c.fillRect(0, 0, this.w, this.h);
    if (img) {
      // cover the area above the rim with the painted shore, its horizon near the pool's top
      const [, ry] = this.toScreen(0, 40), sc = Math.max(this.w / img.naturalWidth, (ry + 20) / (img.naturalHeight * 0.62));
      const iw = img.naturalWidth * sc, ih = img.naturalHeight * sc;
      c.drawImage(img, (this.w - iw) / 2, ry + 20 - ih * 0.62, iw, ih);
      const tint = ['rgba(200,240,220,0.08)', 'rgba(255,240,200,0.06)', 'rgba(255,170,90,0.16)', 'rgba(150,120,90,0.18)'][season];
      c.fillStyle = tint; c.fillRect(0, 0, this.w, ry + 20);
    } else this.paintShore(c, season);
  }
  /** The drawn shore: clouds, the sea, the cliff and the cottage, in clay. */
  private paintShore(c: CanvasRenderingContext2D, season: number) {
    const [, hy] = this.toScreen(0, 22), s = this.s;
    c.save();
    for (let i = 0; i < 5; i++) {
      const x = ((i * 0.23 + this.time * 0.004) % 1.2 - 0.1) * this.w, y = hy * (0.2 + hash(i) * 0.4);
      this.blobScreen(c, x, y, s * (7 + hash(i, 1) * 5), s * 3, '#ffffff', i);
    }
    c.fillStyle = season === 2 ? '#3f8fa8' : season === 3 ? '#4f7f90' : '#3f9fbf';
    c.fillRect(0, hy, this.w, this.h - hy);
    c.fillStyle = 'rgba(255,255,255,0.25)';
    for (let i = 0; i < 9; i++) { const x = ((hash(i, 7) + this.time * 0.003) % 1) * this.w; c.fillRect(x, hy + 6 + (i % 3) * 8 * (s / 6), 40 * (s / 6), 2); }
    // the cliff and cottage on the right
    const [cx, cy] = this.toScreen(118, 22);
    c.fillStyle = '#7fb05a';
    c.beginPath(); c.moveTo(cx - 10 * s, this.h); c.quadraticCurveTo(cx, cy - 8 * s, cx + 30 * s, cy - 10 * s); c.lineTo(this.w + 10, cy - 10 * s); c.lineTo(this.w + 10, this.h); c.fill();
    const hx = cx + 18 * s, hb = cy - 9 * s;
    c.fillStyle = '#fbf6ea'; c.fillRect(hx, hb - 8 * s, 12 * s, 8 * s);
    c.fillStyle = '#c0503a'; c.beginPath(); c.moveTo(hx - 1.5 * s, hb - 8 * s); c.lineTo(hx + 6 * s, hb - 13 * s); c.lineTo(hx + 13.5 * s, hb - 8 * s); c.fill();
    c.fillStyle = '#b8403a'; c.fillRect(hx + 5 * s, hb - 4.5 * s, 2.4 * s, 4.5 * s);
    c.fillStyle = '#7ac0e0'; c.fillRect(hx + 1.6 * s, hb - 6 * s, 2.4 * s, 2 * s); c.fillRect(hx + 8.4 * s, hb - 6 * s, 2.4 * s, 2 * s);
    c.restore();
  }
  private blobScreen(c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, col: string, id: number) {
    c.fillStyle = col; c.beginPath();
    for (let i = 0; i < 4; i++) { const a = x - rx + (i / 3) * rx * 2; c.ellipse(a, y + Math.sin(i + id) * ry * 0.2, rx * 0.45, ry * (0.7 + hash(i, id) * 0.4), 0, 0, Math.PI * 2); }
    c.fill();
  }

  // ---------------------------------------------------------------- clay helpers (world units)
  private jit(id: number, i: number, amt = 0.18) { return (hash(id * 13 + i, this.boil % 4) - 0.5) * amt; }
  /** A clay shape through points: fill, shading, a fingerprint, a glossy highlight and a slightly wobbly outline. */
  private clay(pts: Pt[], col: string, id: number, o: { hi?: number; line?: string; noPrint?: boolean; alpha?: number } = {}) {
    const c = this.ctx, n = pts.length;
    if (n < 3) return;
    c.save();
    if (o.alpha !== undefined) c.globalAlpha = o.alpha;
    c.beginPath();
    const P = pts.map(([x, y], i) => [x + this.jit(id, i), y + this.jit(id, i + 50)] as Pt);
    c.moveTo((P[n - 1][0] + P[0][0]) / 2, (P[n - 1][1] + P[0][1]) / 2);
    for (let i = 0; i < n; i++) { const p = P[i], q = P[(i + 1) % n]; c.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2); }
    c.closePath();
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of P) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    const gr = c.createLinearGradient(x0, y0, x1 * 0.4 + x0 * 0.6, y1);
    gr.addColorStop(0, shade(col, 0.18)); gr.addColorStop(1, shade(col, -0.22));
    c.fillStyle = gr; c.fill();
    c.save(); c.clip();
    if (!o.noPrint) { const pat = prints(c); if (pat) { c.globalAlpha *= 0.13; c.fillStyle = pat; c.translate(x0 + hash(id) * 9, y0); c.scale(0.08, 0.08); c.fillRect(-200, -200, (x1 - x0) * 14 + 400, (y1 - y0) * 14 + 400); } }
    c.restore();
    c.lineWidth = 0.32; c.strokeStyle = o.line ?? shade(col, -0.45); c.stroke();
    const hi = o.hi ?? 0.42;
    if (hi > 0) {
      c.fillStyle = `rgba(255,255,255,${hi})`;
      c.beginPath(); c.ellipse(x0 + (x1 - x0) * 0.32, y0 + (y1 - y0) * 0.28, Math.max(0.25, (x1 - x0) * 0.13), Math.max(0.18, (y1 - y0) * 0.08), -0.5, 0, Math.PI * 2); c.fill();
    }
    c.restore();
  }
  private ell(x: number, y: number, rx: number, ry: number, rot = 0, n = 10): Pt[] {
    const out: Pt[] = [];
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, cx = Math.cos(a) * rx, cy = Math.sin(a) * ry; out.push([x + cx * Math.cos(rot) - cy * Math.sin(rot), y + cx * Math.sin(rot) + cy * Math.cos(rot)]); }
    return out;
  }
  private shadow(x: number, y: number, rx: number) { const c = this.ctx; c.fillStyle = 'rgba(30,40,40,0.22)'; c.beginPath(); c.ellipse(x, y, rx, rx * 0.28, 0, 0, Math.PI * 2); c.fill(); }
  private ring(x: number, y: number, r: number) {
    const c = this.ctx; c.save(); c.strokeStyle = 'rgba(255,250,220,0.95)'; c.lineWidth = 0.45; c.setLineDash([1.2, 0.9]); c.lineDashOffset = -this.time * 3;
    c.beginPath(); c.arc(x, y, r + Math.sin(this.time * 4) * 0.3, 0, Math.PI * 2); c.stroke(); c.restore();
  }

  // ---------------------------------------------------------------- the pool
  private wallPts(side: 1 | -1): Pt[] {
    const m = (p: Pt): Pt => (side < 0 ? p : [W - p[0], p[1]]);
    return ([[-90, 27], [-30, 25], [2, 25.5], [11, 26.5], [17, 29], [21, 34], [24, 41], [25.5, 52], [24.5, 64], [25, 74], [28, 84], [30, 98], [-90, 98]] as Pt[]).map(m);
  }
  private backWater(wy: number, g: TideGame | null) {
    const c = this.ctx, bloom = g?.weather === 'bloom';
    const gr = c.createLinearGradient(0, wy, 0, 88);
    gr.addColorStop(0, bloom ? '#5fae9a' : '#58b8c4'); gr.addColorStop(1, bloom ? '#2f6f5a' : '#1f6a80');
    c.fillStyle = gr; c.fillRect(-100, wy, W + 200, 100);
    // caustic light
    c.save(); c.globalAlpha = 0.12; c.strokeStyle = '#ffffff'; c.lineWidth = 0.5;
    for (let i = 0; i < 9; i++) { const x = 30 + i * 12 + Math.sin(this.boil * 0.3 + i) * 2; c.beginPath(); c.moveTo(x, wy + 1); c.lineTo(x - 6, 84); c.stroke(); }
    c.restore();
    // food drifting in the water: more of it when the tide brings it
    if (g) {
      const n = Math.min(60, Math.round(g.food * 0.5));
      c.fillStyle = bloom ? 'rgba(200,255,170,0.7)' : 'rgba(255,250,220,0.55)';
      for (let i = 0; i < n; i++) { const x = 28 + hash(i, 1) * 104 + Math.sin(this.time * 0.4 + i) * 1.5, y = Math.max(wy + 1, 42) + hash(i, 2) * 36 + Math.sin(this.time * 0.6 + i * 2) * 0.8; c.fillRect(x, y, 0.35, 0.35); }
    }
  }
  private walls() {
    const c = this.ctx;
    for (const side of [-1, 1] as const) {
      const pts = this.wallPts(side);
      this.clay(pts, '#6f747c', side < 0 ? 3 : 4, { hi: 0.1 });
      // the rim is a heap of clay boulders, lighter on top, darker in the cracks
      const B: [number, number, number, number, string][] = [[-6, 31, 13, 8, '#8a8f98'], [6, 29.5, 8, 5, '#9aa0a8'], [14.5, 33, 5.5, 4.5, '#8a8478'], [19.5, 41, 5, 6.5, '#7e848c'], [20, 54, 5.5, 7, '#868a90'], [19, 67, 6, 6.5, '#7a7f86'], [21, 79, 6.5, 5.5, '#8a8478'], [-14, 46, 14, 12, '#7a7f86'], [-4, 62, 13, 10, '#868a90'], [3, 80, 14, 9, '#7e848c'], [-8, 40, 9, 6, '#9098a0']];
      B.forEach(([x, y, rx, ry, col], i) => {
        const X = side < 0 ? x : W - x;
        this.clay(this.ell(X, y, rx, ry, (hash(i, side) - 0.5) * 0.6, 11).map(([px, py], k) => [px + (hash(i * 7 + k, side) - 0.5) * rx * 0.18, py + (hash(k, i + side) - 0.5) * ry * 0.18] as Pt), col, 30 + i + (side > 0 ? 20 : 0), { hi: 0.28 });
      });
      // barnacles, a crust of weed along the waterline, and a little periwinkle-green moss
      c.fillStyle = '#e4ddc8';
      for (let i = 0; i < 18; i++) { const t = hash(i, side), x = side < 0 ? 1 + t * 20 : W - 1 - t * 20, y = 28 + hash(i, 9) * 8; c.beginPath(); c.arc(x, y, 0.5, 0, Math.PI * 2); c.fill(); c.fillStyle = '#b8b09a'; c.beginPath(); c.arc(x, y, 0.18, 0, Math.PI * 2); c.fill(); c.fillStyle = '#e4ddc8'; }
      for (let i = 0; i < 7; i++) { const y = 41 + i * 6, x = side < 0 ? 24.5 + hash(i, 3) : W - 24.5 - hash(i, 3); this.clay(this.ell(x, y, 1.1, 2.6, 0.3 * side, 6), i % 2 ? '#4f8a3a' : '#6a9a3a', 70 + i + side, { hi: 0.2, noPrint: true }); }
    }
  }
  private sand() {
    const pts: Pt[] = [[14, 99], [16, 80]];
    for (let x = 22; x <= 138; x += 8) pts.push([x, floorY(Math.max(24, Math.min(136, x)))]);
    pts.push([144, 80], [146, 99]);
    this.clay(pts, '#e0c48a', 7, { hi: 0.15 });
    const c = this.ctx; c.fillStyle = 'rgba(150,110,60,0.35)';
    for (let i = 0; i < 40; i++) { const x = 26 + hash(i, 4) * 108; c.beginPath(); c.arc(x, floorY(x) + 1.5 + hash(i, 5) * 5, 0.3, 0, Math.PI * 2); c.fill(); }
  }
  private rock(r: Rock) {
    const pts = this.ell(r.x, r.y, r.r * 1.12, r.r, 0, 12).map(([x, y], i) => [x + (hash(r.id, i) - 0.5) * r.r * 0.25, y + (hash(i, r.id) - 0.5) * r.r * 0.2] as Pt);
    this.shadow(r.x, Math.min(floorY(r.x), r.y + r.r * 0.9), r.r * 1.2);
    this.clay(pts, r.placed ? '#9a9890' : '#7e848c', r.id, { hi: 0.3 });
    // the algae film the grazers eat: a green crust over the top
    if (r.a > 0.03) {
      const c = this.ctx; c.save(); c.globalAlpha = Math.min(0.85, r.a * 1.1);
      c.fillStyle = '#6aa848'; c.beginPath(); c.ellipse(r.x, r.y - r.r * 0.55, r.r * 0.95, r.r * 0.48, 0, Math.PI, Math.PI * 2); c.fill();
      c.fillStyle = '#86c060';
      for (let i = 0; i < 5; i++) { const a = Math.PI + 0.3 + i * 0.6; c.beginPath(); c.arc(r.x + Math.cos(a) * r.r * 0.8, r.y + Math.sin(a) * r.r * 0.8, 0.6, 0, Math.PI * 2); c.fill(); }
      c.restore();
    }
  }
  private weed(w: Weed, g: TideGame) {
    const c = this.ctx, base = floorY(w.x), top = g.weedTop(w), h = base - top, red = w.id % 3 === 0;
    const col = g.season === 3 && w.size > 0.6 ? '#9a8a3a' : red ? '#b0503f' : '#4f9a3f';
    const n = 3;
    for (let k = 0; k < n; k++) {
      const off = (k - 1) * 1.3, sway = Math.sin(this.time * 1.2 + w.id + k) * (1 + h * 0.06) * (g.connected ? 1.4 : 0.7);
      const pts: Pt[] = [], back: Pt[] = [];
      const steps = 6;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps, y = base - h * t * (0.75 + k * 0.12), x = w.x + off + sway * t * t + Math.sin(t * 5 + k + this.boil * 0.2) * 0.4;
        const wd = (1 - t * 0.6) * (0.9 + w.size * 0.6);
        pts.push([x - wd, y]); back.unshift([x + wd, y]);
      }
      this.clay([...pts, ...back], shade(col, (k - 1) * 0.08), w.id * 7 + k, { hi: 0.2, noPrint: k !== 1 });
    }
    // a little holdfast
    c.fillStyle = shade(col, -0.35); c.beginPath(); c.ellipse(w.x, base, 1.6, 0.7, 0, 0, Math.PI * 2); c.fill();
  }
  private emptyShell(x: number, y: number, size: number, id: number) {
    this.shadow(x, y + 0.8, 1.6 * size);
    this.whelk(x, y, size * 1.5, 1, id);
  }
  private whelk(x: number, y: number, s: number, dir: 1 | -1, id: number) {
    const pts: Pt[] = [[x - 1.4 * s * dir, y + 0.6 * s], [x - 0.2 * s * dir, y - 0.9 * s], [x + 1.6 * s * dir, y - 0.5 * s], [x + 1.4 * s * dir, y + 0.7 * s], [x, y + 1 * s]];
    this.clay(pts, '#ead6b0', id + 400, { hi: 0.45 });
    const c = this.ctx; c.strokeStyle = 'rgba(140,90,50,0.6)'; c.lineWidth = 0.22;
    c.beginPath(); c.arc(x + 0.2 * s * dir, y - 0.1 * s, 0.55 * s, 0, Math.PI * 1.6); c.stroke();
    c.beginPath(); c.arc(x + 0.2 * s * dir, y - 0.1 * s, 0.25 * s, 0, Math.PI * 1.6); c.stroke();
  }
  private scrap(x: number, y: number, amt: number, id: number) {
    const c = this.ctx, n = Math.max(1, Math.round(amt * 6));
    for (let i = 0; i < n; i++) { c.fillStyle = i % 2 ? '#8a6a3a' : '#6a8a3a'; c.beginPath(); c.ellipse(x + (hash(id, i) - 0.5) * 3, y + (hash(i, id) - 0.5) * 0.6, 0.45, 0.3, hash(i) * 3, 0, Math.PI * 2); c.fill(); }
  }

  // ---------------------------------------------------------------- the creatures
  private creature(a: Agent, x: number, y: number) {
    const k = 0.55 + 0.45 * a.size, wob = this.jit(a.id, 99, 0.25), c = this.ctx, Z = CS[a.sp];
    c.save(); c.translate(x, y); c.scale(Z, Z); c.translate(-x, -y);
    switch (a.sp) {
      case 'anemone': this.anemone(x, y, k * 1.1, a.ang, a.st === 'open', a.id); break;
      case 'mussel': this.mussel(x, y, k, a.ang, a.id); break;
      case 'limpet': this.limpet(x, y, k, a.ang, a.id); break;
      case 'periwinkle': this.periwinkle(x, y, k, a.ang, a.id); break;
      case 'shrimp': this.shrimp(x, y + wob, k, a.dir, a.id, a.st === 'hide'); break;
      case 'hermit': this.hermit(x, y, a.size, a.shell, a.dir, a.id, a.st); break;
      case 'blenny': this.blenny(x, y + wob, k, a.dir, a.id, a.st); break;
      case 'starfish': this.starfish(x, y, k, a.ang, a.id); break;
    }
    c.restore();
    if (a.hp < 0.45) { const c = this.ctx; c.fillStyle = 'rgba(255,255,255,0.85)'; c.font = `700 4px ${FONT}`; c.textAlign = 'center'; c.fillText('…', x, y - 4.5 * Z); }
  }
  anemone(x: number, y: number, k: number, ang: number, open: boolean, id: number) {
    const c = this.ctx, up = ang + Math.PI; // the anemone sits on the rock, its mouth facing out
    c.save(); c.translate(x, y); c.rotate(ang + Math.PI / 2);
    if (open) {
      for (let i = 0; i < 9; i++) {
        const a = -Math.PI / 2 + (i - 4) * 0.28 + Math.sin(this.time * 2 + i + id) * 0.08, L = 2.2 * k + (i % 2) * 0.5 * k;
        const tx = Math.cos(a) * L, ty = -1.4 * k + Math.sin(a) * L;
        this.clay(this.ell(tx * 0.6, (ty - 1.4 * k) * 0.6 - 0.6 * k, 0.45 * k, L * 0.42, a + Math.PI / 2, 6), '#e86a6a', id * 20 + i, { hi: 0.3, noPrint: true });
      }
    }
    const r = open ? 1.6 * k : 1.35 * k;
    this.clay(this.ell(0, -r * 0.55, r, r * (open ? 0.85 : 1), 0, 9), '#b8283a', id, { hi: 0.5 });
    if (!open) { c.fillStyle = 'rgba(80,190,230,0.75)'; for (let i = 0; i < 3; i++) { c.beginPath(); c.arc((i - 1) * r * 0.6, -r * 0.2, 0.22 * k, 0, Math.PI * 2); c.fill(); } }
    c.restore(); void up;
  }
  mussel(x: number, y: number, k: number, ang: number, id: number) {
    const rot = ang + Math.PI / 2 + (hash(id) - 0.5) * 0.8;
    this.clay(this.ell(x, y - 0.6 * k, 1.9 * k, 0.95 * k, rot, 10), '#2a3550', id, { hi: 0.55, line: '#151a28' });
    const c = this.ctx; c.strokeStyle = 'rgba(140,170,220,0.5)'; c.lineWidth = 0.18;
    c.beginPath(); c.ellipse(x, y - 0.6 * k, 1.2 * k, 0.5 * k, rot, 0, Math.PI); c.stroke();
  }
  limpet(x: number, y: number, k: number, ang: number, id: number) {
    const c = this.ctx; c.save(); c.translate(x, y); c.rotate(ang + Math.PI / 2);
    this.clay([[-1.9 * k, 0.2], [-0.4 * k, -1.6 * k], [0.4 * k, -1.6 * k], [1.9 * k, 0.2], [0, 0.5]], '#c8b08a', id, { hi: 0.45 });
    c.strokeStyle = 'rgba(110,80,50,0.55)'; c.lineWidth = 0.18;
    for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(i * 0.25 * k, -1.5 * k); c.lineTo(i * 0.85 * k, 0.1); c.stroke(); }
    c.restore();
  }
  periwinkle(x: number, y: number, k: number, ang: number, id: number) {
    const c = this.ctx; c.save(); c.translate(x, y); c.rotate(ang + Math.PI / 2);
    this.clay(this.ell(0, -1 * k, 1.25 * k, 1.1 * k, 0, 9), '#5a4a3a', id, { hi: 0.5 });
    c.strokeStyle = 'rgba(220,190,140,0.6)'; c.lineWidth = 0.2; c.beginPath(); c.arc(0.1 * k, -1.05 * k, 0.6 * k, 0.4, Math.PI * 1.8); c.stroke();
    c.fillStyle = '#3a3028'; c.beginPath(); c.ellipse(1.1 * k, -0.2 * k, 0.5 * k, 0.3 * k, 0, 0, Math.PI * 2); c.fill();
    c.restore();
  }
  shrimp(x: number, y: number, k: number, dir: 1 | -1, id: number, hiding: boolean) {
    const c = this.ctx; c.save(); c.translate(x, y); c.scale(dir * k, k);
    const flick = Math.sin(this.boil * 0.9 + id) * 0.25;
    c.globalAlpha = hiding ? 0.7 : 1;
    this.clay([[-2.6, -0.2], [-1.2, -1], [0.6, -1.1], [2, -0.6], [2.4, 0.1], [1, 0.5], [-1, 0.6], [-2.4, 0.9 + flick]], '#f0b8a0', id, { hi: 0.55, line: '#c07a6a' });
    // tail fan, legs, antennae, eye
    c.fillStyle = '#e89a86'; c.beginPath(); c.moveTo(-2.4, 0.4); c.lineTo(-3.6, -0.5 + flick); c.lineTo(-3.6, 1.3 + flick); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(160,90,70,0.8)'; c.lineWidth = 0.16;
    for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(-0.6 + i * 0.6, 0.5); c.lineTo(-0.8 + i * 0.6 + flick * 0.3, 1.3); c.stroke(); }
    c.beginPath(); c.moveTo(2.2, -0.6); c.quadraticCurveTo(4, -2.4 + flick, 5.6, -1.4); c.moveTo(2.2, -0.5); c.quadraticCurveTo(4.2, -1.2, 5.4, 0.2 + flick); c.stroke();
    c.fillStyle = '#1a1a1a'; c.beginPath(); c.arc(1.7, -0.55, 0.28, 0, Math.PI * 2); c.fill();
    c.restore();
  }
  hermit(x: number, y: number, size: number, shell: number, dir: 1 | -1, id: number, st: string) {
    const c = this.ctx, k = 0.7 + size * 0.5, s = 0.8 + shell * 0.9;
    this.shadow(x, y + 1.4, 2 * s);
    const walk = st === 'walk' ? Math.sin(this.boil * 1.3 + id) * 0.3 : 0;
    c.save(); c.translate(x, y);
    // legs and claws out the front
    c.strokeStyle = '#c8452a'; c.lineWidth = 0.42; c.lineCap = 'round';
    for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(dir * 0.9 * k, 0.2); c.lineTo(dir * (1.6 + i * 0.5) * k, 1.2 + (i % 2 ? walk : -walk)); c.stroke(); }
    this.clay(this.ell(dir * 2 * k, -0.2, 0.75 * k, 0.55 * k, 0.3 * dir, 7), '#e0583a', id + 7, { hi: 0.5, noPrint: true });
    // eyes on stalks
    c.strokeStyle = '#c8452a'; c.lineWidth = 0.22;
    for (const e of [0.9, 1.3]) { c.beginPath(); c.moveTo(dir * e * k, -0.4); c.lineTo(dir * (e + 0.2) * k, -1.6 * k); c.stroke(); c.fillStyle = '#1a1a1a'; c.beginPath(); c.arc(dir * (e + 0.2) * k, -1.7 * k, 0.24, 0, Math.PI * 2); c.fill(); }
    c.restore();
    this.whelk(x - dir * 0.5 * s, y - 0.4 * s, s, (-dir) as 1 | -1, id);
    if (size > shell - 0.02) { c.fillStyle = '#fffbe8'; c.strokeStyle = '#c0602a'; c.lineWidth = 0.2; c.beginPath(); c.arc(x, y - 4.2 * s, 1.1, 0, Math.PI * 2); c.fill(); c.stroke(); c.fillStyle = '#c0602a'; c.font = `800 1.6px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('!', x, y - 4.15 * s); }
  }
  blenny(x: number, y: number, k: number, dir: 1 | -1, id: number, st: string) {
    const c = this.ctx; c.save(); c.translate(x, y); c.scale(dir * k, k);
    const tail = Math.sin(this.boil * (st === 'hunt' ? 1.6 : 0.6) + id) * 0.5;
    c.fillStyle = '#6a5a2a'; c.beginPath(); c.moveTo(-3.6, 0); c.lineTo(-5.2, -1.2 + tail); c.lineTo(-5.2, 1.2 + tail); c.closePath(); c.fill();
    this.clay([[-3.8, 0.1], [-2, -1.3], [1, -1.6], [2.8, -1.1], [3.4, 0.2], [2.6, 1.2], [0, 1.2], [-2.4, 0.8]], '#8a7a3a', id, { hi: 0.45 });
    c.fillStyle = 'rgba(60,40,20,0.55)'; for (let i = 0; i < 5; i++) { c.beginPath(); c.arc(-2.4 + i * 1.1, -0.1 + (i % 2) * 0.4, 0.3, 0, Math.PI * 2); c.fill(); }
    c.strokeStyle = '#5a4a1a'; c.lineWidth = 0.25; c.beginPath(); c.moveTo(-3, -1); c.quadraticCurveTo(0, -2.4, 2.4, -1.4); c.stroke();
    // the grumpy face: a big eye, a heavy brow and a down-turned mouth
    c.fillStyle = '#fff'; c.beginPath(); c.arc(2.1, -0.5, 0.62, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#1a1a1a'; c.beginPath(); c.arc(2.25, -0.45, 0.34, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#4a3a10'; c.lineWidth = 0.3; c.beginPath(); c.moveTo(1.4, -1.2); c.lineTo(2.8, -0.9); c.stroke();
    c.beginPath(); c.arc(3.1, 0.75, 0.45, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
    c.restore();
    if (st === 'nest') { c.fillStyle = '#ffe8a0'; for (let i = 0; i < 6; i++) { c.beginPath(); c.arc(x + (i - 2.5) * 0.7, y + 3.2, 0.35, 0, Math.PI * 2); c.fill(); } }
  }
  starfish(x: number, y: number, k: number, ang: number, id: number) {
    const pts: Pt[] = [];
    for (let i = 0; i < 10; i++) { const a = ang + (i / 10) * Math.PI * 2 - Math.PI / 2, r = (i % 2 ? 1.1 : 3) * k; pts.push([x + Math.cos(a) * r, y - 0.6 + Math.sin(a) * r * 0.75]); }
    this.shadow(x, y + 1.2, 3 * k);
    this.clay(pts, '#f07a30', id, { hi: 0.45 });
    const c = this.ctx; c.fillStyle = '#ffd0a0';
    for (let i = 0; i < 5; i++) { const a = ang + (i / 5) * Math.PI * 2 - Math.PI / 2; for (const r of [0.9, 1.7]) { c.beginPath(); c.arc(x + Math.cos(a) * r * k, y - 0.6 + Math.sin(a) * r * k * 0.75, 0.2, 0, Math.PI * 2); c.fill(); } }
  }
  jelly(x: number, y: number, t: number, a: number) {
    const c = this.ctx; c.save(); c.globalAlpha = 0.75 * a;
    const pulse = 1 + Math.sin(t * 0.08) * 0.1;
    c.strokeStyle = 'rgba(230,230,255,0.7)'; c.lineWidth = 0.2;
    for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(x - 2 + i * 0.8, y); c.quadraticCurveTo(x - 2 + i * 0.8 + Math.sin(this.time + i) * 0.8, y + 3, x - 2 + i * 0.8, y + 5 + (i % 2)); c.stroke(); }
    this.clay([[x - 3 * pulse, y], [x - 2, y - 2.4], [x + 2, y - 2.4], [x + 3 * pulse, y], [x, y + 0.6]], '#dcdcf4', 900 + Math.round(t / 50), { hi: 0.6, noPrint: true, alpha: 0.8 });
    c.strokeStyle = 'rgba(200,140,220,0.7)'; c.lineWidth = 0.25;
    for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(x - 1.2 + (i % 2) * 2.4, y - 1 + Math.floor(i / 2) * 0.5, 0.45, 0, Math.PI * 2); c.stroke(); }
    c.restore();
  }
  gull(gu: Gull, a: number, looked: boolean) {
    const x = lerp(gu.px, gu.x, a), y = lerp(gu.py, gu.y, a), c = this.ctx;
    const flap = gu.st === 'dive' ? -0.2 : Math.sin(this.boil * 0.9 + gu.id) * 0.9, dir = gu.st === 'out' ? -gu.side : gu.side;
    if (looked) this.ring(x, y, 7);
    if (gu.st === 'eye') { c.fillStyle = 'rgba(255,90,60,0.9)'; c.font = `800 4px ${FONT}`; c.textAlign = 'center'; c.fillText('!', x, y - 6 + Math.sin(this.time * 8) * 0.4); }
    c.save(); c.translate(x, y); c.scale(dir * 1.35, 1.35);
    this.clay([[-1, -0.6], [-5.5, -2.6 - flap * 2], [-6.4, -2 - flap * 2.2], [-2, 0.4]], '#b8c0c8', gu.id + 1, { hi: 0.3, noPrint: true });
    c.fillStyle = '#2a2a2a'; c.beginPath(); c.ellipse(-6, -2.3 - flap * 2.1, 0.8, 0.45, 0.4, 0, Math.PI * 2); c.fill();
    this.clay(this.ell(0, 0, 3.4, 1.6, 0.1, 10), '#f4f4f0', gu.id, { hi: 0.4 });
    this.clay(this.ell(2.9, -1.2, 1.3, 1.2, 0, 8), '#f8f8f4', gu.id + 3, { hi: 0.4, noPrint: true });
    c.fillStyle = '#f0c040'; c.beginPath(); c.moveTo(3.9, -1.2); c.lineTo(5.6, -0.8); c.lineTo(3.9, -0.6); c.closePath(); c.fill();
    c.fillStyle = '#d03030'; c.beginPath(); c.arc(5, -0.85, 0.2, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#1a1a1a'; c.beginPath(); c.arc(3.2, -1.6, 0.26, 0, Math.PI * 2); c.fill();
    this.clay([[1, -0.4], [-3.5, -1.4 + flap], [-4.4, -0.6 + flap * 1.3], [-0.5, 0.8]], '#c8d0d8', gu.id + 2, { hi: 0.3, noPrint: true });
    c.restore();
  }
  private plank() {
    const y = POOL.low - 1.4, c = this.ctx;
    c.fillStyle = 'rgba(10,40,60,0.28)'; c.fillRect(PLANK.x0, y + 1.6, PLANK.x1 - PLANK.x0, 50);
    this.clay([[PLANK.x0 - 2, y + 0.4], [PLANK.x0, y - 1], [PLANK.x1, y - 1.3], [PLANK.x1 + 2.5, y - 0.2], [PLANK.x1, y + 1.4], [PLANK.x0, y + 1.6]], '#a8825a', 77, { hi: 0.3 });
    c.strokeStyle = 'rgba(90,60,30,0.5)'; c.lineWidth = 0.22;
    for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(PLANK.x0 + 4, y - 0.5 + i * 0.6); c.bezierCurveTo(60, y - 1 + i * 0.6, 100, y + i * 0.6, PLANK.x1 - 3, y - 0.6 + i * 0.6); c.stroke(); }
  }
  private frontWater(wy: number, level: number, g: TideGame | null) {
    const c = this.ctx;
    // a soft tint over everything under the surface, so the rim looks drowned at high tide
    c.fillStyle = 'rgba(80,170,190,0.16)'; c.fillRect(-100, wy, W + 200, 100);
    // the surface: a wobbling clay ribbon
    c.beginPath(); c.moveTo(-100, wy);
    for (let x = -100; x <= W + 100; x += 4) c.lineTo(x, wy + Math.sin(x * 0.18 + this.time * 1.6) * 0.35 + this.jit(x, 3, 0.2));
    c.strokeStyle = 'rgba(230,250,255,0.9)'; c.lineWidth = 0.6; c.stroke();
    if (this.splash > 0) {
      c.fillStyle = `rgba(255,255,255,${Math.min(0.8, this.splash)})`;
      for (let i = 0; i < 12; i++) { const x = 118 + hash(i, 1) * 30, h = this.splash * (2 + hash(i, 2) * 6); c.beginPath(); c.ellipse(x, wy - h, 0.9, 0.9, 0, 0, Math.PI * 2); c.fill(); }
    }
    // at low tide in summer, a shimmer of warm water
    if (g && !g.connected && g.temp > 22) { c.fillStyle = `rgba(255,140,60,${Math.min(0.22, (g.temp - 22) * 0.025)})`; c.fillRect(24, wy, 112, 50); }
    // short of air: bubbles stop and the water dulls
    if (g && g.o2 < 45) { c.fillStyle = `rgba(60,70,60,${Math.min(0.3, (45 - g.o2) * 0.01)})`; c.fillRect(24, wy, 112, 50); }
    else if (g) { c.fillStyle = 'rgba(255,255,255,0.6)'; for (let i = 0; i < Math.min(14, g.weedMass() * 3); i++) { const x = 30 + hash(i, 6) * 100, y = 82 - ((this.time * 3 + hash(i, 8) * 40) % (82 - wy - 2)); c.beginPath(); c.arc(x, y, 0.3, 0, Math.PI * 2); c.fill(); } }
    void level;
  }
  private weatherFx(g: TideGame | null) {
    const c = this.ctx;
    if (!g) return;
    if (g.weather === 'storm' || this.storm > 0) {
      c.fillStyle = 'rgba(40,50,70,0.25)'; c.fillRect(-100, -20, W + 200, 120);
      c.strokeStyle = 'rgba(220,230,255,0.55)'; c.lineWidth = 0.25;
      for (let i = 0; i < 50; i++) { const x = hash(i, 1) * (W + 40) - 20 + ((this.time * 30) % 10), y = ((hash(i, 2) * 100 + this.time * 60) % 100) - 10; c.beginPath(); c.moveTo(x, y); c.lineTo(x - 1.5, y + 4); c.stroke(); }
    } else if (g.weather === 'heat' && !g.connected) {
      c.fillStyle = 'rgba(255,170,60,0.12)'; c.fillRect(-100, -20, W + 200, 120);
      const sx = 140, sy = 6; c.fillStyle = 'rgba(255,220,120,0.9)'; c.beginPath(); c.arc(sx, sy, 5 + Math.sin(this.time * 2) * 0.3, 0, Math.PI * 2); c.fill();
    }
  }

  // ---------------------------------------------------------------- Dora and Enzo
  private puppets(p: { dora: Pose; enzo: Pose }, wy: number) {
    this.chins = [];
    // never taller than the sky above the rim, so a head never slips under the top bar
    const h = Math.min(this.compact ? 19 : 21, 26.6 - this.toWorld(0, this.inset.top)[1] - 1.8);
    const px = this.compact ? 15.5 : 9.5, feet = this.compact ? 28 : 26.6;
    this.puppet('dora', p.dora, px, feet, h, 1);
    this.puppet('enzo', p.enzo, W - px, feet, h * 1.06, -1);
    void wy;
  }
  /** A pose's cut-out, once its painting has loaded. */
  private pose(who: 'dora' | 'enzo', pose: Pose) { return this.ready(`${who}-${pose}`); }
  private puppet(who: 'dora' | 'enzo', pose: Pose, x: number, feet: number, h: number, face: 1 | -1) {
    const c = this.ctx, img = this.pose(who, pose);
    const bob = pose === 'cheer' ? Math.abs(Math.sin(this.boil * 0.8)) * 1.2 : (this.boil % 2) * 0.12;
    let w = h * 0.8, top = feet - h - bob;
    if (img) {
      w = (h * img.naturalWidth) / img.naturalHeight;
      if (w > h * 1.45) { w = h * 1.45; }
      const hh = (w * img.naturalHeight) / img.naturalWidth; top = feet - hh - bob;
      // a wide pose (a tail flung out, a bucket held high) slides inward so it never runs off the edge or under the panel
      const lo = this.toWorld(this.inset.left, 0)[0] + 0.6, hi = this.toWorld(this.w - this.inset.right, 0)[0] - 0.6;
      x = Math.max(lo + w / 2, Math.min(hi - w / 2, x));
      this.shadow(x, feet + 0.3, h * 0.3);
      c.drawImage(img, x - w / 2, top, w, hh);
    } else {
      this.shadow(x, feet + 0.3, h * 0.3);
      chinchilla(c, x, feet - bob, h, face, who === 'dora' ? DORA : ENZO, pose, this.boil);
    }
    const [sx, sy] = this.toScreen(x - w / 2, top), [ex, ey] = this.toScreen(x + w / 2, feet);
    this.chins.push({ who: who === 'dora' ? 'Dora' : 'Enzo', x: sx, y: sy, w: ex - sx, h: ey - sy });
  }

  // ---------------------------------------------------------------- the cursor
  private aim(a: Aim, g: TideGame | null) {
    if (!a || !g) return;
    const c = this.ctx, ok = a.ok;
    c.save(); c.globalAlpha = 0.65;
    const col = ok ? '#fff6d0' : '#ff8a7a';
    if (a.tool === 'rock') { const y = floorY(a.x) - 2.5; this.clay(this.ell(a.x, y, 5.5, 5, 0, 10), ok ? '#a0a098' : '#c08080', 5, { hi: 0.2 }); }
    else if (a.tool === 'plant') { c.strokeStyle = col; c.lineWidth = 0.6; const b = floorY(a.x); c.beginPath(); c.moveTo(a.x, b); c.quadraticCurveTo(a.x + 1.5, b - 3, a.x, b - 6); c.stroke(); }
    else if (a.tool === 'shell') this.whelk(a.x, floorY(a.x) - 1, 1.5, 1, 3);
    else if (a.tool.startsWith('bring:')) { c.fillStyle = col; c.beginPath(); c.arc(a.x, a.y, 2, 0, Math.PI * 2); c.fill(); }
    c.globalAlpha = 1; c.strokeStyle = col; c.lineWidth = 0.4; c.setLineDash([1, 0.8]);
    c.beginPath(); c.arc(a.x, a.tool === 'look' || a.tool === 'trim' || a.tool.startsWith('bring:') ? a.y : floorY(a.x) - 2, 3.4, 0, Math.PI * 2); c.stroke();
    c.restore();
  }
  private drawPops(dt: number) {
    const c = this.ctx;
    for (const p of this.pops) {
      p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.kind === 'drop' || p.kind === 'star' || p.kind === 'speck') p.vy += (p.kind === 'drop' ? 18 : 2) * dt;
      const k = 1 - p.t / p.life; if (k <= 0) continue;
      if (p.kind === 'word') {
        const sc = p.t < 0.15 ? p.t / 0.15 : 1;
        c.save(); c.translate(p.x, p.y); c.scale(sc, sc); c.globalAlpha = Math.min(1, k * 2);
        c.font = `700 3.2px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.lineWidth = 0.9; c.strokeStyle = '#fffbea'; c.strokeText(p.text!, 0, 0); c.fillStyle = p.color; c.fillText(p.text!, 0, 0);
        c.restore();
      } else {
        c.globalAlpha = Math.min(1, k * 1.5); c.fillStyle = p.color;
        c.beginPath(); c.arc(p.x, p.y, p.r, 0, Math.PI * 2); c.fill();
        if (p.kind === 'bubble') { c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = 0.12; c.stroke(); }
        c.globalAlpha = 1;
      }
    }
    this.pops = this.pops.filter((p) => p.t < p.life);
  }
  /** The menu's live pool: a few creatures pottering about when no game is running. */
  private demoPool() {
    const t = this.time;
    const rocks: [number, number, number][] = [[50, 79.5, 7], [76, 80.5, 5], [104, 79, 8]];
    rocks.forEach(([x, y, r], i) => this.rock({ id: i + 1, x, y, r, a: 0.6, placed: false }));
    this.anemone(50, 72.5, 1.1, -Math.PI / 2, true, 3);
    this.anemone(104, 71, 1, -Math.PI / 2, true, 4);
    this.starfish(88, 81.6, 1, t * 0.05, 5);
    this.shrimp(60 + Math.sin(t * 0.3) * 20, 60 + Math.sin(t * 0.7) * 3, 1, Math.cos(t * 0.3) > 0 ? 1 : -1, 6, false);
    this.hermit(70 + Math.sin(t * 0.15) * 14, floorY(70) - 1.6, 0.8, 1, Math.cos(t * 0.15) > 0 ? 1 : -1, 7, 'walk');
  }
}

// ---------------------------------------------------------------- a drawn clay chinchilla (the stand-in for the paintings)
type Coat = { fur: string; belly: string; eye: string; ear: string };
const DORA: Coat = { fur: '#f6eedc', belly: '#fffaf0', eye: '#b0102a', ear: '#f4a8b4' };
const ENZO: Coat = { fur: '#8e9aa8', belly: '#cdd5de', eye: '#111111', ear: '#f0a0ae' };
function clayEll(c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, col: string, line = true) {
  const g = c.createRadialGradient(x - rx * 0.35, y - ry * 0.4, Math.min(rx, ry) * 0.1, x, y, Math.max(rx, ry));
  g.addColorStop(0, shade(col, 0.22)); g.addColorStop(1, shade(col, -0.2));
  c.fillStyle = g; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill();
  if (line) { c.strokeStyle = shade(col, -0.4); c.lineWidth = Math.max(0.2, rx * 0.06); c.stroke(); }
}
/** Dora or Enzo in clay: a plump body, a big round head with a broad flat crown, round pink ears on the sides, a bushy tail. */
export function chinchilla(c: CanvasRenderingContext2D, x: number, feet: number, h: number, face: 1 | -1, coat: Coat, pose: Pose, boil = 0) {
  const u = h / 20;
  c.save(); c.translate(x, feet); c.scale(face * u, u);
  // tail
  clayEll(c, -6.5, -6, 3.2, 4.2, coat.fur);
  // body
  clayEll(c, 0, -6.2, 5.6, 6.2, coat.fur); clayEll(c, 1.4, -5.2, 3.2, 4.2, coat.belly, false);
  // feet
  clayEll(c, -2, -0.6, 1.8, 0.8, coat.fur); clayEll(c, 2.6, -0.6, 1.8, 0.8, coat.fur);
  const lean = pose === 'peer' ? 1.6 : 0, hy = -14.2 + (pose === 'peer' ? 1.2 : 0);
  // ears on the sides of the crown
  clayEll(c, -2.6 + lean, hy - 4.2, 2.2, 2.5, coat.fur); clayEll(c, -2.6 + lean, hy - 4.1, 1.4, 1.7, coat.ear, false);
  // head: big, round, a broad slightly flat crown
  c.save(); c.beginPath(); c.ellipse(1 + lean, hy, 5.4, 4.9, 0, 0, Math.PI * 2); c.restore();
  clayEll(c, 1 + lean, hy, 5.4, 4.8, coat.fur);
  clayEll(c, 3.8 + lean, hy - 3.9, 2.1, 2.4, coat.fur); clayEll(c, 3.8 + lean, hy - 3.8, 1.3, 1.6, coat.ear, false);
  // muzzle, nose, eye, whiskers
  clayEll(c, 5 + lean, hy + 1.2, 1.9, 1.5, coat.belly, false);
  c.fillStyle = '#e88a9a'; c.beginPath(); c.arc(6.6 + lean, hy + 0.7, 0.5, 0, Math.PI * 2); c.fill();
  c.fillStyle = coat.eye; c.beginPath(); c.arc(3.2 + lean, hy - 0.8, 0.95, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#fff'; c.beginPath(); c.arc(3.5 + lean, hy - 1.15, 0.32, 0, Math.PI * 2); c.fill();
  c.strokeStyle = 'rgba(80,80,80,0.6)'; c.lineWidth = 0.18;
  for (const d of [-0.5, 0.2, 0.9]) { c.beginPath(); c.moveTo(5.8 + lean, hy + 1.2); c.lineTo(8.6 + lean, hy + 1.2 + d * 1.4); c.stroke(); }
  // arms and props
  if (pose === 'cheer') { const w = (boil % 2) * 0.4; clayEll(c, 3.6, -13 - w, 1, 2.4, coat.fur); clayEll(c, -2.4, -13 + w, 1, 2.4, coat.fur); }
  else if (pose === 'bucket') { c.fillStyle = '#3a7ac8'; c.fillRect(3.4, -7, 3.8, 3.6); c.fillStyle = '#8ad0f0'; c.fillRect(3.6, -7, 3.4, 0.9); clayEll(c, 3.6, -6.6, 1, 1.4, coat.fur); }
  else if (pose === 'write') { c.fillStyle = '#fbf3df'; c.fillRect(2.4, -9, 4.4, 3.2); c.strokeStyle = '#9a6a3a'; c.lineWidth = 0.3; c.strokeRect(2.4, -9, 4.4, 3.2); clayEll(c, 3.4, -7.4, 1, 1.2, coat.fur); }
  else clayEll(c, 4, -6.2, 1, 1.4, coat.fur);
  c.restore();
}

// ---------------------------------------------------------------- the journal's sketches and the stand-in paintings
let sketcher: TideScene | null = null;
/** One kind's journal sketch: 0 a grey shape and a question mark, 1 a pencil outline, 2 coloured in, 3 finished. */
export function drawSketch(cv: HTMLCanvasElement, kind: Kind, level: number) {
  const c = cv.getContext('2d'); if (!c) return;
  const w = cv.width, h = cv.height;
  c.clearRect(0, 0, w, h);
  const sc = sketcher ??= new TideScene(document.createElement('canvas'));
  (sc as unknown as { ctx: CanvasRenderingContext2D }).ctx = c;
  // draw the creature into the middle of the card at a size that fits
  const s = Math.min(w, h) / 14;
  c.save(); c.translate(w / 2, h * 0.58); c.scale(s, s);
  if (level === 0) c.filter = 'grayscale(1) brightness(0.55) contrast(0.6)';
  if (level === 1) c.filter = 'grayscale(1) brightness(1.7) contrast(1.3)';
  if (level === 2) c.filter = 'saturate(0.75)';
  switch (kind) {
    case 'anemone': sc.anemone(0, 1.5, 1.6, -Math.PI / 2, true, 3); break;
    case 'limpet': sc.limpet(0, 1.5, 1.8, -Math.PI / 2, 4); break;
    case 'periwinkle': sc.periwinkle(0, 1.5, 1.9, -Math.PI / 2, 5); break;
    case 'mussel': sc.mussel(0, 1.5, 1.8, -Math.PI / 2 - 0.4, 6); break;
    case 'shrimp': sc.shrimp(-1, 0, 1.3, 1, 7, false); break;
    case 'hermit': sc.hermit(0, 1, 1, 1.1, 1, 8, 'idle'); break;
    case 'blenny': sc.blenny(-0.5, 0, 1.15, 1, 9, 'idle'); break;
    case 'starfish': sc.starfish(0, 1, 1.4, 0, 10); break;
    case 'gull': sc.gull({ id: 11, x: 0, y: -1, px: 0, py: -1, st: 'eye', t: 0, prey: -1, side: 1 }, 1, false); break;
    case 'jelly': sc.jelly(0, -1, 0, 1); break;
    case 'seaweed': {
      const fake = { id: 12, x: 0, size: 0.4, planted: true };
      const fg = { season: 0, connected: true, weedTop: () => floorY(0) - 11 } as unknown as TideGame;
      c.translate(0, 5 - floorY(0)); (sc as unknown as { weed: (w: Weed, g: TideGame) => void }).weed(fake, fg); break;
    }
  }
  c.restore();
  c.filter = 'none';
  if (level === 0) { c.fillStyle = 'rgba(70,60,50,0.75)'; c.font = `700 ${Math.round(h * 0.34)}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('?', w / 2, h * 0.52); }
}
/** The clay stand-in for the title painting. */
export function paintTitle(cv: HTMLCanvasElement) { paintCard(cv, 'title'); }
export function paintEnding(cv: HTMLCanvasElement) { paintCard(cv, 'ending'); }
function paintCard(cv: HTMLCanvasElement, which: 'title' | 'ending') {
  const c = cv.getContext('2d'); if (!c) return;
  const w = cv.width, h = cv.height;
  const sky = c.createLinearGradient(0, 0, 0, h);
  if (which === 'ending') { sky.addColorStop(0, '#f08a5a'); sky.addColorStop(0.45, '#ffd08a'); sky.addColorStop(0.46, '#e8a060'); sky.addColorStop(1, '#5a6a8a'); }
  else { sky.addColorStop(0, '#8fd0f0'); sky.addColorStop(0.42, '#e6f6f0'); sky.addColorStop(0.43, '#4aa8c0'); sky.addColorStop(1, '#2a7a90'); }
  c.fillStyle = sky; c.fillRect(0, 0, w, h);
  if (which === 'ending') { c.fillStyle = '#ffe2a0'; c.beginPath(); c.arc(w * 0.62, h * 0.44, h * 0.09, Math.PI, 0); c.fill(); }
  // rocks in front
  clayEll(c, w * 0.18, h * 0.92, w * 0.3, h * 0.2, '#7e848c'); clayEll(c, w * 0.86, h * 0.95, w * 0.25, h * 0.18, '#8a8f96');
  const u = h / 1024;
  chinchilla(c, w * 0.2, h * 0.76, 300 * u, 1, DORA, which === 'ending' ? 'cheer' : 'peer');
  chinchilla(c, w * 0.82, h * 0.8, 320 * u, -1, ENZO, which === 'ending' ? 'cheer' : 'bucket');
}
