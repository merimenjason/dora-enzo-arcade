// Honeycomb Hollow's drawing, in Canvas 2D, all in stained glass: the comb is a window of leaded hex panes that
// glow gold as they fill with honey, the nectar drops are glass jewels (each colour its own shape), and the area's
// painted window stands behind. It plays back the engine's steps (a trio turning on its corner, drops shattering into
// honey, bees zooming down their lines, blossoms bursting, jelly beams, drops falling in with a little squash) and
// sits Dora and Enzo, as stained-glass cut-outs, either side of the comb (or below it on an upright screen) reacting
// to the play. Every painting has a drawn stand-in until it loads.
import { SQ3, BEE, BLOSSOM, JELLY, type HoneyGame, type Step, type Snap, type Piece, type Cell, type AreaId } from './honey-game';

export type Mood = 'think' | 'happy' | 'wow';
const IMG = new Map<string, HTMLImageElement>();
export function art(name: string): HTMLImageElement | null {
  if (typeof Image === 'undefined') return null;
  let im = IMG.get(name);
  if (!im) { im = new Image(); im.decoding = 'async'; im.src = `/art/honey/${name}.webp`; IMG.set(name, im); }
  return im.complete && im.naturalWidth > 0 ? im : null;
}

/** The seven nectar colours: light, body and deep shade, and a shape each so they read at a glance. */
export const DROPS = [
  { name: 'rose', a: '#ffb3c4', b: '#e8325f', c: '#6e0f2a', shape: 'heart' },
  { name: 'marigold', a: '#ffd29a', b: '#f57a10', c: '#7e3300', shape: 'diamond' },
  { name: 'buttercup', a: '#fff7b8', b: '#f5cc12', c: '#7e5f00', shape: 'star' },
  { name: 'leaf', a: '#c8f7a8', b: '#3cae38', c: '#124a18', shape: 'leaf' },
  { name: 'cornflower', a: '#b8dcff', b: '#2c78e0', c: '#0d2c6a', shape: 'drop' },
  { name: 'lavender', a: '#e8d0ff', b: '#9550dc', c: '#3a136c', shape: 'circle' },
  { name: 'daisy', a: '#ffffff', b: '#ebe6da', c: '#7a705e', shape: 'flower' },
] as const;
const LEAD = '#2b1a0c';
const AREA_TINT: Record<AreaId, [string, string, string]> = {
  clover: ['#f6d77a', '#9cc46a', '#4f7a2e'], rose: ['#f8c9b8', '#e07a8a', '#8a3048'], lavender: ['#e4d4f4', '#a888d0', '#5a3c84'],
  heather: ['#e6c49c', '#b0708e', '#5a3442'], queen: ['#ffe39a', '#e8a838', '#8a5212'],
};

// ---------------------------------------------------------------- shapes
function hexPath(c: CanvasRenderingContext2D, x: number, y: number, r: number) {
  c.moveTo(x + r, y); for (let k = 1; k < 6; k++) c.lineTo(x + r * Math.cos((k * Math.PI) / 3), y + r * Math.sin((k * Math.PI) / 3)); c.closePath();
}
function shapePath(c: CanvasRenderingContext2D, shape: string, r: number) {
  c.beginPath();
  if (shape === 'circle') c.arc(0, 0, r * 0.86, 0, Math.PI * 2);
  else if (shape === 'diamond') { const k = r * 0.98; c.moveTo(0, -k); c.quadraticCurveTo(k * 0.18, -k * 0.18, k, 0); c.quadraticCurveTo(k * 0.18, k * 0.18, 0, k); c.quadraticCurveTo(-k * 0.18, k * 0.18, -k, 0); c.quadraticCurveTo(-k * 0.18, -k * 0.18, 0, -k); }
  else if (shape === 'star') { for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 5, rr = k % 2 ? r * 0.5 : r * 0.98; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr + r * 0.06); } c.closePath(); }
  else if (shape === 'leaf') { c.moveTo(-r * 0.62, r * 0.72); c.bezierCurveTo(-r * 1.0, -r * 0.2, -r * 0.1, -r * 0.95, r * 0.72, -r * 0.82); c.bezierCurveTo(r * 0.95, r * 0.0, r * 0.25, r * 0.95, -r * 0.62, r * 0.72); c.closePath(); }
  else if (shape === 'drop') { c.moveTo(0, -r * 0.98); c.bezierCurveTo(r * 0.3, -r * 0.5, r * 0.82, -r * 0.05, r * 0.82, r * 0.3); c.arc(0, r * 0.3, r * 0.82, 0, Math.PI); c.bezierCurveTo(-r * 0.82, -r * 0.05, -r * 0.3, -r * 0.5, 0, -r * 0.98); c.closePath(); }
  else if (shape === 'heart') { c.moveTo(0, r * 0.88); c.bezierCurveTo(-r * 1.15, r * 0.05, -r * 0.85, -r * 0.95, 0, -r * 0.42); c.bezierCurveTo(r * 0.85, -r * 0.95, r * 1.15, r * 0.05, 0, r * 0.88); c.closePath(); }
  else { for (let k = 0; k < 6; k++) { const a = (k * Math.PI) / 3 - Math.PI / 2; c.moveTo(0, 0); c.ellipse(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5, r * 0.46, r * 0.34, a, 0, Math.PI * 2); } }
}

/** One glass jewel: lead outline, glowing body, a leaded seam and a bright highlight. */
function drawDrop(c: CanvasRenderingContext2D, col: number, r: number) {
  const d = DROPS[col % DROPS.length];
  c.save();
  shapePath(c, d.shape, r);
  c.lineJoin = 'round'; c.lineWidth = Math.max(2, r * 0.2); c.strokeStyle = LEAD; c.stroke();
  const g = c.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.05, 0, 0, r * 1.05);
  g.addColorStop(0, d.a); g.addColorStop(0.55, d.b); g.addColorStop(1, d.c);
  c.fillStyle = g; c.fill();
  if (d.shape === 'flower') { c.beginPath(); c.arc(0, 0, r * 0.3, 0, Math.PI * 2); c.fillStyle = '#ffd23a'; c.fill(); c.lineWidth = Math.max(1.5, r * 0.1); c.stroke(); }
  // a leaded seam across the pane, and the hammered glass
  c.save(); shapePath(c, d.shape, r); c.clip();
  c.strokeStyle = LEAD + 'aa'; c.lineWidth = Math.max(1, r * 0.07);
  c.beginPath(); c.moveTo(-r, r * 0.25); c.quadraticCurveTo(0, -r * 0.05, r, r * 0.4); c.stroke();
  for (let k = 0; k < 7; k++) { const a = k * 2.4, rr = r * (0.25 + (k % 3) * 0.22); c.fillStyle = k % 2 ? '#ffffff22' : '#00000018'; c.beginPath(); c.arc(Math.cos(a) * rr, Math.sin(a) * rr, r * 0.16, 0, Math.PI * 2); c.fill(); }
  c.restore();
  c.fillStyle = '#ffffffcc'; c.beginPath(); c.ellipse(-r * 0.32, -r * 0.38, r * 0.22, r * 0.11, -0.7, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#ffffff66'; c.beginPath(); c.arc(r * 0.3, r * 0.32, r * 0.07, 0, Math.PI * 2); c.fill();
  c.restore();
}

function drawBeeBody(c: CanvasRenderingContext2D, r: number, wing: number, wasp = false) {
  c.save();
  c.lineWidth = Math.max(1.2, r * 0.09); c.strokeStyle = LEAD;
  // wings
  for (const s of [-1, 1]) { c.save(); c.rotate(s * (0.5 + wing * 0.35)); c.beginPath(); c.ellipse(s * r * 0.05, -r * 0.55, r * 0.26, r * 0.48, 0, 0, Math.PI * 2); c.fillStyle = '#e8f6ffcc'; c.fill(); c.stroke(); c.restore(); }
  c.beginPath(); c.ellipse(0, 0, r * (wasp ? 0.62 : 0.66), r * (wasp ? 0.38 : 0.46), 0, 0, Math.PI * 2);
  const g = c.createLinearGradient(-r, 0, r, 0); g.addColorStop(0, wasp ? '#f0c010' : '#ffd84a'); g.addColorStop(1, wasp ? '#c88a00' : '#f2a516');
  c.fillStyle = g; c.fill(); c.stroke();
  c.save(); c.clip(); c.fillStyle = wasp ? '#1a1208' : '#3a2410';
  for (const x of wasp ? [-0.34, -0.06, 0.22] : [-0.22, 0.12]) c.fillRect(x * r, -r, r * (wasp ? 0.16 : 0.18), r * 2);
  c.restore();
  c.beginPath(); c.arc(r * 0.6, -r * 0.02, r * 0.3, 0, Math.PI * 2); c.fillStyle = wasp ? '#2a1a08' : '#3a2410'; c.fill(); c.stroke();
  c.fillStyle = wasp ? '#ff5a3a' : '#ffffff'; c.beginPath(); c.arc(r * 0.68, -r * 0.1, r * 0.08, 0, Math.PI * 2); c.fill();
  if (wasp) { c.beginPath(); c.moveTo(-r * 0.6, 0); c.lineTo(-r * 0.92, r * 0.04); c.lineTo(-r * 0.6, r * 0.12); c.fillStyle = '#1a1208'; c.fill(); c.strokeStyle = '#2a1a08'; c.lineWidth = r * 0.06; c.beginPath(); c.moveTo(r * 0.5, -r * 0.24); c.lineTo(r * 0.78, -r * 0.18); c.stroke(); }
  c.restore();
}

/** The drawn stand-in for a missing cut-out: a glass chinchilla in the right colours. */
function standIn(c: CanvasRenderingContext2D, who: 'dora' | 'enzo', h: number) {
  const [body, deep, eye] = who === 'dora' ? ['#f6efe0', '#d8ccb4', '#b0102a'] : ['#9aa8b8', '#6a7a8e', '#101010'];
  c.save(); c.lineWidth = Math.max(2, h * 0.018); c.strokeStyle = LEAD;
  c.beginPath(); c.ellipse(0, -h * 0.3, h * 0.27, h * 0.3, 0, 0, Math.PI * 2); c.fillStyle = body; c.fill(); c.stroke();
  for (const s of [-1, 1]) { c.beginPath(); c.ellipse(s * h * 0.17, -h * 0.82, h * 0.1, h * 0.12, s * 0.3, 0, Math.PI * 2); c.fillStyle = '#f2b6c0'; c.fill(); c.stroke(); }
  c.beginPath(); c.ellipse(0, -h * 0.66, h * 0.22, h * 0.19, 0, 0, Math.PI * 2); c.fillStyle = body; c.fill(); c.stroke();
  c.beginPath(); c.ellipse(0, -h * 0.25, h * 0.15, h * 0.2, 0, 0, Math.PI * 2); c.fillStyle = deep; c.globalAlpha = 0.5; c.fill(); c.globalAlpha = 1;
  for (const s of [-1, 1]) { c.beginPath(); c.arc(s * h * 0.08, -h * 0.68, h * 0.035, 0, Math.PI * 2); c.fillStyle = eye; c.fill(); }
  c.restore();
}

// ---------------------------------------------------------------- the scene
interface Pos { x: number; y: number }
interface Anim { from: Pos; to: Pos; dur: number; arc?: { cx: number; cy: number; a0: number; a1: number; r: number }; squash?: boolean }
interface Bit { x: number; y: number; vx: number; vy: number; life: number; max: number; col: string; size: number; spin: number; a: number; kind: 'shard' | 'spark' | 'drip' }
interface Word { text: string; x: number; y: number; life: number; big: boolean }
interface Flyer { x0: number; y0: number; x1: number; y1: number; t: number; dur: number; kind: 'bee' | 'free' }
interface Dying { p: Piece; x: number; y: number; t: number; dur: number; kind: 'pop' | 'roll' | 'chomp' | 'crack' }

export interface Boxes { dora: { x: number; y: number; w: number; h: number }; enzo: { x: number; y: number; w: number; h: number }; board: { x0: number; y0: number; x1: number; y1: number }; s: number; tall: boolean }

export class HoneyScene {
  private cv: HTMLCanvasElement; private c: CanvasRenderingContext2D;
  W = 0; H = 0; dpr = 1;
  game: HoneyGame | null = null; area: AreaId = 'clover';
  /** The board as it is drawn right now (it trails the engine while steps play). */
  shown: Snap = [];
  private queue: Step[] = []; private cur: Step | null = null; private curT = 0; private curDur = 0;
  private pos = new Map<number, Pos>(); private anim = new Map<number, Anim>();
  private dying: Dying[] = []; private bits: Bit[] = []; private words: Word[] = []; private flyers: Flyer[] = [];
  private rings: { x: number; y: number; t: number; r: number; col: string; light: boolean }[] = [];
  private beams: { x0: number; y0: number; x1: number; y1: number; t: number }[] = [];
  private fill = new Map<number, number>(); private grow = new Map<number, number>();
  private shake = 0; private time = 0; private spin = new Map<number, number>();
  private sprites = new Map<string, HTMLCanvasElement>();
  private noise: HTMLCanvasElement | null = null;
  hover = -1; cursor = -1; speed = 1;
  mood: { dora: Mood; enzo: Mood } = { dora: 'think', enzo: 'think' };
  private moodPop = { dora: 0, enzo: 0 }; private lastMood = { dora: 'think', enzo: 'think' };
  reserve = { right: 0, top: 0 };
  layout = { tall: false, s: 30, ox: 0, oy: 0, dora: { x: 0, y: 0, h: 100 }, enzo: { x: 0, y: 0, h: 100 } };
  onStep: ((s: Step) => void) | null = null;
  private seed = 1;

  constructor(cv: HTMLCanvasElement) {
    const c = cv.getContext('2d'); if (!c) throw new Error('no 2d'); this.cv = cv; this.c = c;
    this.resize();
  }
  private rnd() { this.seed = (this.seed * 16807) % 2147483647; return this.seed / 2147483647; }

  setGame(g: HoneyGame | null, area: AreaId) {
    this.game = g; this.area = area; this.queue = []; this.cur = null; this.pos.clear(); this.anim.clear();
    this.dying = []; this.bits = []; this.words = []; this.flyers = []; this.rings = []; this.beams = []; this.fill.clear(); this.grow.clear(); this.spin.clear();
    this.hover = -1; this.cursor = -1; this.shake = 0; this.reserve = { right: 0, top: 0 };
    if (g) { this.shown = g.snap(); this.place(); }
    for (const n of ['dora-think', 'dora-happy', 'dora-wow', 'enzo-think', 'enzo-happy', 'enzo-wow', 'area-' + area]) art(n);
    this.resize();
  }
  /** Snap every piece to its cell. */
  private place() { this.pos.clear(); this.shown.forEach((cell, i) => { if (cell.p) this.pos.set(cell.p.id, this.cellXY(i)); }); }
  private cellXY(i: number): Pos { const cb = this.game!.comb; return { x: cb.x[i], y: cb.y[i] }; }

  busy() { return !!this.cur || this.queue.length > 0; }
  play(steps: Step[]) { this.queue.push(...steps); }
  /** Hurry the steps along (a tap during a long cascade). */
  hurry() { this.speed = 2.6; }

  resize() {
    const r = this.cv.getBoundingClientRect(), dpr = Math.min(2, typeof devicePixelRatio === 'number' ? devicePixelRatio : 1);
    this.W = Math.max(1, r.width); this.H = Math.max(1, r.height); this.dpr = dpr;
    const w = Math.round(this.W * dpr), h = Math.round(this.H * dpr);
    if (this.cv.width !== w || this.cv.height !== h) { this.cv.width = w; this.cv.height = h; }
    this.computeLayout();
  }

  private computeLayout() {
    const W = this.W, H = this.H, g = this.game, L = this.layout;
    const cw = g ? g.comb.w : 14, chh = g ? g.comb.h : 15.6;
    L.tall = H > W * 1.05;
    const top = this.reserve.top, right = this.reserve.right;
    if (L.tall) {
      const pad = 8, chinH = Math.min(W * 0.4, Math.max(120, (H - top) * 0.27));
      const availH = H - top - chinH - pad * 2, availW = W - pad * 2;
      L.s = Math.max(8, Math.min(availW / cw, availH / chh));
      L.ox = (W - cw * L.s) / 2; L.oy = top + pad + Math.max(0, (availH - chh * L.s) * 0.35);
      const by = L.oy + chh * L.s, chinRoom = H - by - 4, ch = Math.max(90, Math.min(chinRoom, W * 0.46));
      L.dora = { x: W * 0.25, y: H - 2, h: ch }; L.enzo = { x: W * 0.75, y: H - 2, h: ch };
    } else {
      const usable = W - right, side = Math.min(usable * 0.24, Math.max(130, usable * 0.2)), pad = 10;
      const availW = usable - side * 2 - pad * 2, availH = H - pad * 2;
      L.s = Math.max(8, Math.min(availW / cw, availH / chh));
      L.ox = side + pad + (availW - cw * L.s) / 2; L.oy = pad + (availH - chh * L.s) / 2;
      const ch = Math.min(H * 0.62, side * 1.18), sideW = L.ox;
      const right0 = L.ox + cw * L.s, sideR = usable - right0;
      L.dora = { x: sideW / 2, y: H - 4, h: Math.min(ch, sideW * 1.1) }; L.enzo = { x: right0 + sideR / 2, y: H - 4, h: Math.min(ch, sideR * 1.1) };
    }
  }

  /** Where things sit, in canvas pixels, for the framing checks. */
  boxes(): Boxes {
    const L = this.layout, g = this.game, b = (o: { x: number; y: number; h: number }) => ({ x: o.x - o.h / 2, y: o.y - o.h, w: o.h, h: o.h });
    const cw = g ? g.comb.w : 14, chh = g ? g.comb.h : 15.6;
    return { dora: b(L.dora), enzo: b(L.enzo), board: { x0: L.ox, y0: L.oy, x1: L.ox + cw * L.s, y1: L.oy + chh * L.s }, s: L.s, tall: L.tall };
  }
  /** Board units to canvas pixels. */
  px(x: number, y: number): Pos { const g = this.game!, L = this.layout; return { x: L.ox + (x - g.comb.x0) * L.s, y: L.oy + (y - g.comb.y0) * L.s }; }
  /** The trio whose corner is nearest a canvas point, or -1. */
  pick(x: number, y: number) {
    const g = this.game; if (!g) return -1;
    const L = this.layout, bx = (x - L.ox) / L.s + g.comb.x0, by = (y - L.oy) / L.s + g.comb.y0;
    let best = -1, bd = 1.05;
    g.comb.trios.forEach((t, k) => { const d = Math.hypot(t.x - bx, t.y - by); if (d < bd) { bd = d; best = k; } });
    return best;
  }
  trioPoint(t: number) { const tr = this.game!.comb.trios[t]; return this.px(tr.x, tr.y); }

  // ---------------------------------------------------------------- playing steps
  private start(s: Step) {
    this.cur = s; this.curT = 0; this.anim.clear();
    const g = this.game!, prev = this.shown;
    const idsAt = new Map<number, number>(); prev.forEach((c, i) => { if (c.p) idsAt.set(c.p.id, i); });
    const toward = (board: Snap, dur: number, how: (id: number, from: number | undefined, to: number) => Anim | null) => {
      board.forEach((cell, i) => { if (!cell.p) return; const a = how(cell.p.id, idsAt.get(cell.p.id), i); if (a) this.anim.set(cell.p.id, a); });
      this.curDur = dur;
    };
    const leaving = (board: Snap, kind: Dying['kind'], dur: number) => {
      const now = new Set<number>(); board.forEach((c) => { if (c.p) now.add(c.p.id); });
      prev.forEach((c, i) => { if (c.p && !now.has(c.p.id)) { const p = this.pos.get(c.p.id) ?? this.cellXY(i); this.dying.push({ p: c.p, x: p.x, y: p.y, t: 0, dur, kind }); this.pos.delete(c.p.id); } });
    };
    this.onStep?.(s);
    if (s.t === 'turn' || s.t === 'bounce') {
      const tr = g.comb.trios[s.trio], dir = s.dir;
      const arcFor = (i: number, steps: number): Anim => {
        const p = this.cellXY(i), a0 = Math.atan2(p.y - tr.y, p.x - tr.x), r = Math.hypot(p.x - tr.x, p.y - tr.y);
        return { from: p, to: p, dur: 0, arc: { cx: tr.x, cy: tr.y, a0, a1: a0 + dir * steps * ((2 * Math.PI) / 3), r } };
      };
      if (s.t === 'turn') { for (const i of tr.cells) { const p = prev[i].p; if (p) { const a = arcFor(i, 1); a.dur = 0.15; this.anim.set(p.id, a); } } this.curDur = 0.15; }
      else { for (const i of tr.cells) { const p = prev[i].p; if (p) { const a = arcFor(i, 0.22); a.dur = 0.26; this.anim.set(p.id, a); } } this.curDur = 0.26; }
      return;
    }
    if (s.t === 'clear') {
      const fired = new Set(s.fired.map((f) => f.i));
      for (const gn of s.gone) {
        const p = this.pos.get(gn.p.id) ?? this.cellXY(gn.i); this.pos.delete(gn.p.id);
        this.dying.push({ p: gn.p, x: p.x, y: p.y, t: 0, dur: gn.p.k === 'wax' ? 0.4 : 0.24, kind: gn.p.k === 'wax' ? 'crack' : 'pop' });
        this.burst(p.x, p.y, gn.p, fired.has(gn.i) ? 14 : 7);
      }
      for (const [i, cell] of s.board.entries()) if (cell.honey && !prev[i].honey) this.fill.set(i, 0);
      for (const f of s.fired) {
        const p = this.cellXY(f.i);
        if (f.sp === BEE) { const ends = [f.cells[0], f.cells[f.cells.length - 1]]; for (const e of f.cells.slice(1)) void e; const a = this.lineEnds(f.i, f.ax); for (const q of a) this.flyers.push({ x0: p.x, y0: p.y, x1: q.x, y1: q.y, t: 0, dur: 0.32, kind: 'bee' }); void ends; this.shake = Math.max(this.shake, 0.15); }
        else if (f.sp === BLOSSOM) { this.rings.push({ x: p.x, y: p.y, t: 0, r: 2.6, col: DROPS[(this.shown[f.i]?.p?.c ?? 2) % 7].b, light: true }); this.shake = Math.max(this.shake, 0.22); }
        else { for (const j of f.cells.slice(0, 40)) { const q = this.cellXY(j); this.beams.push({ x0: p.x, y0: p.y, x1: q.x, y1: q.y, t: 0 }); } this.rings.push({ x: p.x, y: p.y, t: 0, r: f.combo ? 5 : 3, col: '#fff6c8', light: !!f.combo }); this.shake = Math.max(this.shake, f.combo ? 0.5 : 0.3); }
      }
      for (const i of s.lit) { const q = this.cellXY(i); this.rings.push({ x: q.x, y: q.y, t: 0, r: 1.1, col: '#fff2a8', light: true }); }
      for (const i of s.freed) { const q = this.cellXY(i); this.flyers.push({ x0: q.x, y0: q.y, x1: q.x + (this.rnd() - 0.5) * 6, y1: g.comb.y0 - 6, t: 0, dur: 1.4, kind: 'free' }); }
      for (const m of s.made) { const cell = s.board[m.i]; if (cell.p) { const q = this.cellXY(m.i); this.pos.set(cell.p.id, q); this.spin.set(cell.p.id, 0); this.rings.push({ x: q.x, y: q.y, t: 0, r: 1.3, col: '#ffffff', light: true }); } }
      if (s.gone.length) {
        const xs = s.gone.map((x) => this.cellXY(x.i)), cx = xs.reduce((a, b) => a + b.x, 0) / xs.length, cy = xs.reduce((a, b) => a + b.y, 0) / xs.length;
        this.words.push({ text: '+' + s.gain, x: cx, y: cy, life: 1, big: false });
      }
      const W = ['', '', 'Sweet!', 'Buzzing!', 'Honey-tastic!', 'Golden!', 'Royal!'];
      if (s.chain >= 2) this.words.push({ text: W[Math.min(6, s.chain)], x: g.comb.x0 + g.comb.w / 2, y: g.comb.y0 + g.comb.h * 0.42, life: 1.2, big: true });
      if (s.waggle >= 2) this.words.push({ text: s.waggle === 3 ? 'Triple turn!' : 'Double turn!', x: g.comb.x0 + g.comb.w / 2, y: g.comb.y0 + g.comb.h * 0.3, life: 1.3, big: true });
      if (s.fired.some((f) => f.combo)) { const f = s.fired.find((x) => x.combo)!; const names: Record<string, string> = { feast: 'Royal feast!', 'jelly-bee': 'Swarm!', 'jelly-blossom': 'Spring!', jelly: 'Royal jelly!', 'blossom-blossom': 'Great bloom!', 'bee-blossom': 'Sunburst!', 'bee-bee': 'Bee star!' }; this.words.push({ text: names[f.combo!] ?? 'Combo!', x: g.comb.x0 + g.comb.w / 2, y: g.comb.y0 + g.comb.h * 0.55, life: 1.5, big: true }); }
      if (s.chain >= 4) this.shake = Math.max(this.shake, 0.2);
      this.shown = s.board; this.curDur = 0.2 + (s.fired.length ? 0.12 : 0);
      return;
    }
    if (s.t === 'fall') {
      // new drops come in from above their column, the first one dealt landing lowest
      const order = new Map<number, number>(), fresh: { id: number; i: number }[] = [];
      s.board.forEach((c, i) => { if (c.p && !idsAt.has(c.p.id) && !this.pos.has(c.p.id)) fresh.push({ id: c.p.id, i }); });
      fresh.sort((a, b) => g.comb.y[b.i] - g.comb.y[a.i]);
      const topY = new Map<number, number>(); for (let i = 0; i < g.comb.n; i++) { const q = g.comb.q[i]; topY.set(q, Math.min(topY.get(q) ?? Infinity, g.comb.y[i])); }
      for (const f of fresh) { const q = g.comb.q[f.i], k = order.get(q) ?? 0; order.set(q, k + 1); this.pos.set(f.id, { x: g.comb.x[f.i], y: topY.get(q)! - SQ3 * (k + 1) }); }
      let longest = 0.1;
      toward(s.board, 0, (id, _from, to) => {
        const p = this.pos.get(id), q = this.cellXY(to); if (!p || (p.x === q.x && p.y === q.y)) return null;
        const d = Math.hypot(q.x - p.x, q.y - p.y), dur = 0.07 + 0.075 * Math.sqrt(d / SQ3);
        longest = Math.max(longest, dur); return { from: { ...p }, to: q, dur, squash: true };
      });
      this.shown = s.board; this.curDur = longest + 0.04;
      return;
    }
    if (s.t === 'acorn') { leaving(s.board, 'roll', 0.45); this.shown = s.board; this.curDur = 0.3; this.words.push({ text: 'Acorn!', x: this.cellXY(s.cells[0]).x, y: this.cellXY(s.cells[0]).y, life: 1, big: false }); return; }
    if (s.t === 'hop') {
      leaving(s.board, 'chomp', 0.3);
      toward(s.board, 0.26, (id, from, to) => { if (from === undefined || from === to) return null; const p = this.pos.get(id) ?? this.cellXY(from); return { from: { ...p }, to: this.cellXY(to), dur: 0.26 }; });
      for (const i of s.licked) this.fill.set(i, -1);
      this.shown = s.board; return;
    }
    if (s.t === 'moss') { this.grow.set(s.cell, 0); this.shown = s.board; this.curDur = 0.3; return; }
    if (s.t === 'shuffle') { this.shown = s.board; for (const c of s.board) if (c.p) this.spin.set(c.p.id, 0); this.curDur = 0.5; this.words.push({ text: 'All stirred up!', x: g.comb.x0 + g.comb.w / 2, y: g.comb.y0 + g.comb.h / 2, life: 1.4, big: true }); return; }
    if (s.t === 'rush') { this.words.push({ text: 'Honey rush!', x: g.comb.x0 + g.comb.w / 2, y: g.comb.y0 + g.comb.h * 0.4, life: 1.6, big: true }); this.curDur = 0.45; return; }
    this.curDur = 0.05;
  }
  private lineEnds(i: number, ax: number): Pos[] {
    const g = this.game!, out: Pos[] = [];
    for (const d of [ax, ax + 3]) { let j = i, k = 0; while (g.comb.nb[j][d] >= 0) { j = g.comb.nb[j][d]; k++; } const p = this.cellXY(j), o = this.cellXY(i); out.push({ x: p.x + (p.x - o.x) / Math.max(1, k) * 2, y: p.y + (p.y - o.y) / Math.max(1, k) * 2 }); }
    return out;
  }
  private burst(x: number, y: number, p: Piece, n: number) {
    const col = p.k === 'drop' ? DROPS[p.c % 7] : p.k === 'wax' ? { a: '#fff6dc', b: '#f0dca0' } : p.k === 'dew' ? { a: '#ffffff', b: '#bfe8ff' } : { a: '#ffe080', b: '#3a2a10' };
    for (let k = 0; k < n; k++) {
      const a = this.rnd() * Math.PI * 2, v = 2 + this.rnd() * 5;
      this.bits.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 3, life: 0, max: 0.5 + this.rnd() * 0.4, col: k % 3 ? col.b : col.a, size: 0.12 + this.rnd() * 0.16, spin: (this.rnd() - 0.5) * 14, a: this.rnd() * 6, kind: 'shard' });
    }
    for (let k = 0; k < 4; k++) this.bits.push({ x: x + (this.rnd() - 0.5) * 0.8, y, vx: (this.rnd() - 0.5) * 2, vy: -1 - this.rnd() * 2, life: 0, max: 0.7, col: '#ffe27a', size: 0.08, spin: 0, a: 0, kind: 'spark' });
  }

  // ---------------------------------------------------------------- the frame
  frame(dt: number) {
    this.time += dt;
    const sp = dt * this.speed;
    // advance the step queue
    if (this.cur) { this.curT += sp; if (this.curT >= this.curDur) { this.finishAnims(); this.cur = null; } }
    while (!this.cur && this.queue.length) { this.start(this.queue.shift()!); if (this.curDur <= 0.0001) { this.finishAnims(); this.cur = null; } }
    if (!this.cur && !this.queue.length) this.speed = 1;
    for (const [id, a] of this.anim) {
      const k = Math.min(1, this.curT / Math.max(0.001, a.dur));
      if (a.arc) { const e = this.cur?.t === 'bounce' ? Math.sin(Math.PI * k) : 1 - Math.pow(1 - k, 3); const ang = a.arc.a0 + (a.arc.a1 - a.arc.a0) * e; this.pos.set(id, { x: a.arc.cx + Math.cos(ang) * a.arc.r, y: a.arc.cy + Math.sin(ang) * a.arc.r }); }
      else { const e = a.squash ? k * k : 1 - Math.pow(1 - k, 2); this.pos.set(id, { x: a.from.x + (a.to.x - a.from.x) * e, y: a.from.y + (a.to.y - a.from.y) * e }); }
    }
    for (const d of this.dying) d.t += sp;
    this.dying = this.dying.filter((d) => d.t < d.dur);
    for (const b of this.bits) { b.life += dt; b.vy += 14 * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.a += b.spin * dt; }
    this.bits = this.bits.filter((b) => b.life < b.max);
    for (const w of this.words) w.life -= dt * (w.big ? 0.8 : 1.1);
    this.words = this.words.filter((w) => w.life > 0);
    for (const f of this.flyers) f.t += dt;
    this.flyers = this.flyers.filter((f) => f.t < f.dur);
    for (const r of this.rings) r.t += dt; this.rings = this.rings.filter((r) => r.t < 0.6);
    for (const b of this.beams) b.t += dt; this.beams = this.beams.filter((b) => b.t < 0.45);
    for (const [i, v] of this.fill) { const n = v + dt * 2.2; if (v >= 0 && n >= 1) this.fill.delete(i); else if (v < 0 && v + dt * 2 >= 0) this.fill.delete(i); else this.fill.set(i, v < 0 ? v + dt * 2 : n); }
    for (const [i, v] of this.grow) { if (v + dt * 2 >= 1) this.grow.delete(i); else this.grow.set(i, v + dt * 2); }
    for (const [id, v] of this.spin) { if (v + dt * 2.5 >= 1) this.spin.delete(id); else this.spin.set(id, v + dt * 2.5); }
    this.shake = Math.max(0, this.shake - dt * 1.4);
    for (const w of ['dora', 'enzo'] as const) { if (this.mood[w] !== this.lastMood[w]) { this.lastMood[w] = this.mood[w]; this.moodPop[w] = 1; } this.moodPop[w] = Math.max(0, this.moodPop[w] - dt * 3.5); }
    this.draw();
  }
  private finishAnims() { for (const [id, a] of this.anim) { if (a.arc) { const ang = a.arc.a1; this.pos.set(id, this.cur?.t === 'bounce' ? { x: a.arc.cx + Math.cos(a.arc.a0) * a.arc.r, y: a.arc.cy + Math.sin(a.arc.a0) * a.arc.r } : { x: a.arc.cx + Math.cos(ang) * a.arc.r, y: a.arc.cy + Math.sin(ang) * a.arc.r }); } else this.pos.set(id, a.to); } this.anim.clear(); const s = this.cur; if (s && 'board' in s && s.t !== 'clear' && s.t !== 'fall') { this.shown = s.board; } if (s && s.t === 'turn') { this.shown = s.board; this.place(); } }

  private ensureNoise() {
    if (this.noise || typeof document === 'undefined') return;
    const n = document.createElement('canvas'); n.width = n.height = 96; const x = n.getContext('2d')!;
    let s = 7; const rr = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let k = 0; k < 160; k++) { x.fillStyle = rr() < 0.5 ? `rgba(255,255,255,${0.06 + rr() * 0.12})` : `rgba(70,40,0,${0.05 + rr() * 0.1})`; x.beginPath(); x.ellipse(rr() * 96, rr() * 96, 2 + rr() * 6, 2 + rr() * 4, rr() * 3, 0, Math.PI * 2); x.fill(); }
    this.noise = n;
  }
  private sprite(key: string, r: number, draw: (c: CanvasRenderingContext2D, r: number) => void) {
    this.ensureNoise();
    const R = Math.max(4, Math.round(r * this.dpr)), k = key + '@' + R;
    let s = this.sprites.get(k);
    if (!s) {
      if (this.sprites.size > 300) this.sprites.clear();
      const size = R * 3; s = document.createElement('canvas'); s.width = s.height = size;
      const c = s.getContext('2d')!; c.translate(size / 2, size / 2); draw(c, R); this.sprites.set(k, s);
    }
    return s;
  }
  private blit(key: string, x: number, y: number, r: number, draw: (c: CanvasRenderingContext2D, r: number) => void, scale = 1) {
    const s = this.sprite(key, r, draw), d = (s.width / this.dpr) * scale;
    this.c.drawImage(s, x - d / 2, y - d / 2, d, d);
  }

  private draw() {
    const c = this.c, W = this.W, H = this.H, g = this.game, L = this.layout;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.drawBack();
    if (!g) return;
    const s = L.s, sh = this.shake > 0 ? this.shake * s * 0.25 : 0;
    c.save();
    if (sh) c.translate(Math.sin(this.time * 61) * sh, Math.cos(this.time * 53) * sh);
    const cb = g.comb, cells = this.shown, R = s * 0.98;
    // the oak frame round the window, then the glass panes
    c.fillStyle = '#4a2c12';
    c.beginPath(); for (let i = 0; i < cb.n; i++) { const p = this.px(cb.x[i], cb.y[i]); hexPath(c, p.x, p.y, s * 1.2); } c.fill();
    c.fillStyle = LEAD; c.beginPath(); for (let i = 0; i < cb.n; i++) { const p = this.px(cb.x[i], cb.y[i]); hexPath(c, p.x, p.y, s * 1.06); } c.fill();
    for (let i = 0; i < cb.n; i++) this.drawCell(i, cells[i], R);
    // the turn under the pointer
    const hv = this.hover >= 0 ? this.hover : this.cursor;
    if (hv >= 0 && !this.busy() && !g.over) this.drawTrio(hv, g.canTurn(hv));
    // pieces, clipped to the window so new drops slide in from behind the frame
    c.save(); c.beginPath(); for (let i = 0; i < cb.n; i++) { const p = this.px(cb.x[i], cb.y[i]); hexPath(c, p.x, p.y, s * 1.12); } c.clip();
    const pr = s * 0.66;
    cells.forEach((cell, i) => { if (cell.p) this.drawPiece(cell.p, this.pos.get(cell.p.id) ?? this.cellXY(i), pr, cell); });
    c.restore();
    for (const d of this.dying) this.drawDying(d, pr);
    // effects
    c.save(); c.globalCompositeOperation = 'lighter';
    for (const b of this.beams) { const p0 = this.px(b.x0, b.y0), p1 = this.px(b.x1, b.y1), a = 1 - b.t / 0.45; c.strokeStyle = `rgba(255,240,180,${a * 0.8})`; c.lineWidth = s * 0.18 * a; c.beginPath(); c.moveTo(p0.x, p0.y); c.lineTo(p1.x, p1.y); c.stroke(); }
    for (const r of this.rings) { const p = this.px(r.x, r.y), k = r.t / 0.6, rad = s * r.r * (0.3 + k * 1.1); const gr = c.createRadialGradient(p.x, p.y, rad * 0.2, p.x, p.y, rad); gr.addColorStop(0, r.light ? `rgba(255,250,210,${0.7 * (1 - k)})` : 'rgba(0,0,0,0)'); gr.addColorStop(0.7, `rgba(255,220,120,${0.45 * (1 - k)})`); gr.addColorStop(1, 'rgba(255,200,80,0)'); c.fillStyle = gr; c.beginPath(); c.arc(p.x, p.y, rad, 0, Math.PI * 2); c.fill(); }
    c.restore();
    for (const b of this.bits) {
      const p = this.px(b.x, b.y), a = 1 - b.life / b.max; c.globalAlpha = Math.max(0, a);
      if (b.kind === 'spark') { c.fillStyle = b.col; c.beginPath(); c.arc(p.x, p.y, s * b.size * (0.6 + a), 0, Math.PI * 2); c.fill(); }
      else { c.save(); c.translate(p.x, p.y); c.rotate(b.a); c.fillStyle = b.col; c.strokeStyle = LEAD; c.lineWidth = Math.max(1, s * 0.03); const z = s * b.size * 1.6; c.beginPath(); c.moveTo(-z, -z * 0.6); c.lineTo(z, -z * 0.2); c.lineTo(-z * 0.2, z); c.closePath(); c.fill(); c.stroke(); c.restore(); }
    }
    c.globalAlpha = 1;
    for (const f of this.flyers) {
      const k = f.t / f.dur, e = f.kind === 'bee' ? k : 1 - Math.pow(1 - k, 2);
      const x = f.x0 + (f.x1 - f.x0) * e + (f.kind === 'free' ? Math.sin(f.t * 9) * 0.5 : 0), y = f.y0 + (f.y1 - f.y0) * e;
      const p = this.px(x, y); c.save(); c.translate(p.x, p.y); if (f.x1 < f.x0) c.scale(-1, 1);
      if (f.kind === 'bee') c.rotate(Math.atan2(f.y1 - f.y0, Math.abs(f.x1 - f.x0)));
      c.globalAlpha = f.kind === 'free' ? Math.min(1, (1 - k) * 3) : 1;
      drawBeeBody(c, s * (f.kind === 'bee' ? 0.62 : 0.5), Math.sin(this.time * 60)); c.restore();
    }
    c.globalAlpha = 1;
    // words
    c.textAlign = 'center'; c.textBaseline = 'middle';
    for (const w of this.words) {
      const p = this.px(w.x, w.y - (1 - w.life) * (w.big ? 1.2 : 1.8)), a = Math.min(1, w.life * 2.5), pop = w.big ? 1 + Math.max(0, (w.life - 1) * 1.2) : 1;
      const fs = (w.big ? Math.max(20, s * 1.25) : Math.max(13, s * 0.62)) * pop;
      c.globalAlpha = a; c.font = `900 ${fs}px "Trebuchet MS", ui-rounded, system-ui, sans-serif`;
      c.lineWidth = fs * 0.2; c.strokeStyle = LEAD; c.lineJoin = 'round'; c.strokeText(w.text, p.x, p.y);
      const gr = c.createLinearGradient(0, p.y - fs / 2, 0, p.y + fs / 2); gr.addColorStop(0, '#fffbe0'); gr.addColorStop(1, w.big ? '#ffb21c' : '#ffd860');
      c.fillStyle = gr; c.fillText(w.text, p.x, p.y);
    }
    c.globalAlpha = 1;
    c.restore();
    this.drawPair();
    void W; void H;
  }

  private drawBack() {
    const c = this.c, W = this.W, H = this.H, L = this.layout, im = art('area-' + this.area), t = AREA_TINT[this.area];
    if (im) {
      // cover, keeping the middle (an upright screen sees the flowers at the top and bottom of the window)
      const sc = Math.max(W / im.naturalWidth, H / im.naturalHeight), w = im.naturalWidth * sc, h = im.naturalHeight * sc;
      c.drawImage(im, (W - w) / 2, (H - h) * (L.tall ? 0.5 : 0.5), w, h);
    } else {
      const g = c.createRadialGradient(W / 2, H * 0.45, 10, W / 2, H / 2, Math.max(W, H) * 0.75);
      g.addColorStop(0, t[0]); g.addColorStop(0.6, t[1]); g.addColorStop(1, t[2]); c.fillStyle = g; c.fillRect(0, 0, W, H);
      c.strokeStyle = '#2b1a0c55'; c.lineWidth = 3; const z = Math.max(60, W / 10);
      for (let y = 0; y < H + z; y += z * 0.87) for (let x = (Math.round(y / (z * 0.87)) % 2) * z * 0.75; x < W + z; x += z * 1.5) { c.beginPath(); hexPath(c, x, y, z * 0.5); c.stroke(); }
    }
    // a soft warm glow behind the comb
    if (this.game) {
      const b = this.boxes().board, cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2, r = Math.max(b.x1 - b.x0, b.y1 - b.y0) * 0.75;
      const g = c.createRadialGradient(cx, cy, r * 0.3, cx, cy, r); g.addColorStop(0, 'rgba(255,214,120,0.35)'); g.addColorStop(1, 'rgba(255,214,120,0)');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
    }
  }

  private drawCell(i: number, cell: Cell, R: number) {
    const c = this.c, cb = this.game!.comb, p = this.px(cb.x[i], cb.y[i]);
    const f = this.fill.get(i), honey = cell.honey;
    const kind = cell.dark ? 'dark' : 'glass';
    this.blit('cell-' + kind, p.x, p.y, R, (x, r) => this.paintCell(x, r, kind));
    if (honey || (f !== undefined && f < 0)) {
      const k = f === undefined ? 1 : f < 0 ? -f : f;
      if (f !== undefined && f >= 0) { c.save(); c.beginPath(); hexPath(c, p.x, p.y, R * 0.9); c.clip(); const top = p.y + R - 2 * R * k; c.beginPath(); c.rect(p.x - R, top - Math.sin(this.time * 9 + i) * R * 0.08, 2 * R, 2 * R); c.clip(); this.blit('cell-honey', p.x, p.y, R, (x, r) => this.paintCell(x, r, 'honey')); c.restore(); }
      else { c.globalAlpha = k; this.blit('cell-honey', p.x, p.y, R, (x, r) => this.paintCell(x, r, 'honey')); c.globalAlpha = 1; }
    }
    if (cell.moss) {
      const k = this.grow.get(i) ?? 1;
      this.blit('moss-' + (i % 4), p.x, p.y, R, (x, r) => { x.save(); x.beginPath(); hexPath(x, 0, 0, r * 0.9); x.clip(); let s = 3 + i; const rr = () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; for (let n = 0; n < 26; n++) { const a = rr() * 6.28, d = r * (0.45 + rr() * 0.5); x.fillStyle = ['#2f6a1e', '#4f9a2a', '#7cc24a', '#3d7f26'][n % 4]; x.beginPath(); x.arc(Math.cos(a) * d, Math.sin(a) * d, r * (0.12 + rr() * 0.16), 0, 6.28); x.fill(); } x.restore(); }, k);
    }
  }
  private paintCell(c: CanvasRenderingContext2D, r: number, kind: 'glass' | 'honey' | 'dark') {
    c.save(); c.beginPath(); hexPath(c, 0, 0, r * 0.9);
    const g = c.createRadialGradient(-r * 0.25, -r * 0.3, r * 0.1, 0, 0, r);
    if (kind === 'honey') { g.addColorStop(0, '#fff3a6'); g.addColorStop(0.5, '#ffbf2a'); g.addColorStop(1, '#d9780a'); }
    else if (kind === 'dark') { g.addColorStop(0, '#6a4a30'); g.addColorStop(1, '#2a1a10'); }
    else { g.addColorStop(0, '#fbf2dc'); g.addColorStop(0.6, '#e6d3a8'); g.addColorStop(1, '#bfa16c'); }
    c.fillStyle = g; c.fill(); c.clip();
    // hammered glass and a leaded seam from the centre to three corners
    if (this.noise) { c.globalAlpha = kind === 'dark' ? 0.5 : 0.9; c.drawImage(this.noise, -r, -r, r * 2, r * 2); c.globalAlpha = 1; }
    c.strokeStyle = kind === 'honey' ? '#a0560a88' : kind === 'dark' ? '#00000088' : '#8a6a3a55'; c.lineWidth = Math.max(1, r * 0.05);
    c.beginPath(); for (let k = 0; k < 3; k++) { const a = (k * 2 * Math.PI) / 3 + Math.PI / 3; c.moveTo(0, 0); c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.stroke();
    c.fillStyle = kind === 'honey' ? '#ffffff55' : '#ffffff40'; c.beginPath(); c.ellipse(-r * 0.35, -r * 0.42, r * 0.32, r * 0.12, -0.5, 0, Math.PI * 2); c.fill();
    if (kind === 'dark') { c.strokeStyle = '#00000066'; c.lineWidth = r * 0.08; for (let k = -2; k <= 2; k++) { c.beginPath(); c.moveTo(-r, k * r * 0.4); c.lineTo(r, k * r * 0.4 + r * 0.3); c.stroke(); } }
    c.restore();
    c.save(); c.beginPath(); hexPath(c, 0, 0, r * 0.9); c.lineWidth = Math.max(1.5, r * 0.08); c.strokeStyle = kind === 'honey' ? '#7a3e06' : LEAD; c.stroke(); c.restore();
  }

  private drawTrio(t: number, ok: boolean) {
    const c = this.c, g = this.game!, tr = g.comb.trios[t], s = this.layout.s, pulse = 0.6 + Math.sin(this.time * 6) * 0.25;
    c.save(); c.lineJoin = 'round';
    for (const i of tr.cells) { const p = this.px(g.comb.x[i], g.comb.y[i]); c.beginPath(); hexPath(c, p.x, p.y, s * 0.92); c.fillStyle = ok ? `rgba(255,248,210,${0.35 * pulse})` : 'rgba(80,40,30,0.25)'; c.fill(); c.lineWidth = Math.max(2.5, s * 0.12); c.strokeStyle = ok ? `rgba(255,236,150,${pulse})` : 'rgba(120,60,40,0.6)'; c.stroke(); }
    const p = this.px(tr.x, tr.y), r = s * 0.42;
    // a little turning arrow on the corner
    c.lineWidth = Math.max(2.5, s * 0.11); c.strokeStyle = LEAD; c.lineCap = 'round';
    c.beginPath(); c.arc(p.x, p.y, r, -Math.PI * 0.85, Math.PI * 0.55); c.stroke();
    c.strokeStyle = ok ? '#fff6c8' : '#d8b0a0'; c.lineWidth = Math.max(1.5, s * 0.06); c.beginPath(); c.arc(p.x, p.y, r, -Math.PI * 0.85, Math.PI * 0.55); c.stroke();
    const a = Math.PI * 0.55, ex = p.x + Math.cos(a) * r, ey = p.y + Math.sin(a) * r;
    c.fillStyle = ok ? '#fff6c8' : '#d8b0a0'; c.strokeStyle = LEAD; c.lineWidth = Math.max(1.2, s * 0.04);
    c.beginPath(); c.moveTo(ex - r * 0.45, ey - r * 0.05); c.lineTo(ex + r * 0.1, ey - r * 0.45); c.lineTo(ex + r * 0.15, ey + r * 0.2); c.closePath(); c.fill(); c.stroke();
    c.restore();
  }

  private drawPiece(p: Piece, at: Pos, r: number, cell: Cell | null) {
    const c = this.c, q = this.px(at.x, at.y), s = this.layout.s;
    const sp = this.spin.get(p.id), a = this.anim.get(p.id);
    let sx = 1, sy = 1;
    if (a?.squash && this.cur) { const k = Math.min(1, this.curT / a.dur); if (k > 0.85) { const e = (k - 0.85) / 0.15; sx = 1 + Math.sin(e * Math.PI) * 0.14; sy = 1 - Math.sin(e * Math.PI) * 0.14; } }
    if (sp !== undefined) { const e = sp < 0.5 ? 1 - sp * 2 : (sp - 0.5) * 2; sx *= Math.max(0.05, e); sy *= sp < 1 ? 1 + Math.sin(sp * Math.PI) * 0.15 : 1; }
    c.save(); c.translate(q.x, q.y + (sy < 1 ? r * (1 - sy) : 0)); c.scale(sx, sy);
    if (cell?.dark) c.globalAlpha = 0.72;
    if (p.k === 'drop') {
      if (p.sp === JELLY) this.drawJelly(r);
      else {
        if (p.sp === BLOSSOM) { const pu = 1 + Math.sin(this.time * 5 + p.id) * 0.06; c.save(); c.scale(pu, pu); this.blit('petals-' + p.c, 0, 0, r, (x, rr) => { for (let k = 0; k < 6; k++) { const an = (k * Math.PI) / 3 + Math.PI / 6; x.save(); x.rotate(an); x.beginPath(); x.ellipse(rr * 0.95, 0, rr * 0.42, rr * 0.3, 0, 0, Math.PI * 2); x.fillStyle = DROPS[p.c % 7].a; x.fill(); x.lineWidth = Math.max(1.5, rr * 0.08); x.strokeStyle = LEAD; x.stroke(); x.restore(); } }); c.restore(); }
        this.blit('drop-' + p.c, 0, 0, r, (x, rr) => drawDrop(x, p.c, rr), p.sp === BLOSSOM ? 0.82 : 1);
        if (p.sp === BEE) {
          const ax = [Math.PI / 2, -Math.PI / 6, Math.PI / 6][p.ax];
          c.save(); c.rotate(ax); c.strokeStyle = '#fff8d0'; c.lineWidth = Math.max(2, s * 0.08); c.lineCap = 'round';
          for (const sg of [-1, 1]) { c.beginPath(); c.moveTo(sg * r * 0.95, -r * 0.28); c.lineTo(sg * r * 1.25, 0); c.lineTo(sg * r * 0.95, r * 0.28); c.stroke(); }
          c.restore();
          c.save(); c.translate(0, -r * 0.05); c.scale(0.75, 0.75); drawBeeBody(c, r, Math.sin(this.time * 50 + p.id)); c.restore();
        }
      }
    } else if (p.k === 'acorn') this.blit('acorn', 0, 0, r, (x, rr) => {
      x.lineWidth = Math.max(2, rr * 0.14); x.strokeStyle = LEAD;
      x.beginPath(); x.ellipse(0, rr * 0.18, rr * 0.62, rr * 0.72, 0, 0, Math.PI * 2); const gr = x.createRadialGradient(-rr * 0.2, 0, 2, 0, rr * 0.2, rr); gr.addColorStop(0, '#f0b070'); gr.addColorStop(1, '#8a4a18'); x.fillStyle = gr; x.fill(); x.stroke();
      x.beginPath(); x.ellipse(0, -rr * 0.38, rr * 0.8, rr * 0.36, 0, Math.PI, 0); x.lineTo(rr * 0.8, -rr * 0.3); x.quadraticCurveTo(0, -rr * 0.12, -rr * 0.8, -rr * 0.3); x.closePath(); x.fillStyle = '#6a4220'; x.fill(); x.stroke();
      x.beginPath(); x.moveTo(0, -rr * 0.74); x.lineTo(rr * 0.1, -rr * 0.98); x.stroke();
      x.fillStyle = '#ffffff66'; x.beginPath(); x.ellipse(-rr * 0.25, rr * 0.05, rr * 0.12, rr * 0.25, 0.2, 0, Math.PI * 2); x.fill();
    });
    else if (p.k === 'wax') {
      const hs = this.layout.s * 0.9;
      this.blit('wax-' + p.hp, 0, 0, hs, (x, rr) => {
        x.beginPath(); hexPath(x, 0, 0, rr * 0.96); const gr = x.createRadialGradient(-rr * 0.2, -rr * 0.3, 2, 0, 0, rr); gr.addColorStop(0, '#fffbea'); gr.addColorStop(1, p.hp > 1 ? '#e2c47e' : '#ecd8a8'); x.fillStyle = gr; x.fill();
        x.lineWidth = Math.max(2, rr * (p.hp > 1 ? 0.16 : 0.1)); x.strokeStyle = '#7a5418'; x.stroke();
        x.beginPath(); hexPath(x, 0, 0, rr * 0.62); x.lineWidth = Math.max(1, rr * 0.05); x.strokeStyle = '#b08a40aa'; x.stroke();
        if (p.hp === 1) { x.strokeStyle = '#5a3a10'; x.lineWidth = Math.max(1.2, rr * 0.06); x.beginPath(); x.moveTo(-rr * 0.6, -rr * 0.3); x.lineTo(-rr * 0.1, 0); x.lineTo(-rr * 0.25, rr * 0.4); x.moveTo(-rr * 0.1, 0); x.lineTo(rr * 0.5, -rr * 0.2); x.stroke(); }
      });
      if (p.bee) { c.save(); c.globalAlpha = p.hp > 1 ? 0.55 : 0.85; c.translate(0, Math.sin(this.time * 2 + p.id) * r * 0.06); drawBeeBody(c, r * 0.62, 0.2); c.restore(); }
    } else if (p.k === 'wasp') { c.save(); c.translate(0, Math.sin(this.time * 7 + p.id) * r * 0.08); c.scale(-1, 1); drawBeeBody(c, r * 1.05, Math.sin(this.time * 70 + p.id), true); c.restore(); }
    else if (p.k === 'dew') {
      const w = 1 + Math.sin(this.time * 3 + p.id) * 0.05; c.scale(w, 2 - w);
      this.blit('dew', 0, 0, r, (x, rr) => { shapePath(x, 'drop', rr); x.lineWidth = Math.max(2, rr * 0.12); x.strokeStyle = '#2a4a6a'; x.stroke(); const gr = x.createRadialGradient(-rr * 0.2, -rr * 0.1, 2, 0, rr * 0.2, rr); gr.addColorStop(0, '#ffffffee'); gr.addColorStop(0.6, '#c8ecffcc'); gr.addColorStop(1, '#6ab4e8cc'); x.fillStyle = gr; x.fill(); x.fillStyle = '#ffffff'; x.beginPath(); x.ellipse(-rr * 0.25, -rr * 0.1, rr * 0.12, rr * 0.22, 0.3, 0, Math.PI * 2); x.fill(); });
      c.fillStyle = '#ffffff'; const tw = (Math.sin(this.time * 4 + p.id * 2) + 1) / 2; c.globalAlpha = tw; c.beginPath(); c.arc(r * 0.5, -r * 0.6, r * 0.12, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1;
    }
    if (cell?.sticky) {
      // a glaze of runny honey over the drop
      this.blit('sticky', 0, 0, this.layout.s * 0.9, (x, rr) => {
        x.beginPath(); hexPath(x, 0, 0, rr * 0.92); x.fillStyle = 'rgba(240,150,20,0.42)'; x.fill(); x.lineWidth = Math.max(2, rr * 0.1); x.strokeStyle = '#b8600a'; x.stroke();
        x.fillStyle = 'rgba(230,140,10,0.85)'; for (const dx of [-0.45, 0.1, 0.5]) { x.beginPath(); x.moveTo(dx * rr - rr * 0.1, -rr * 0.8); x.lineTo(dx * rr + rr * 0.1, -rr * 0.8); x.quadraticCurveTo(dx * rr + rr * 0.12, -rr * 0.3, dx * rr, -rr * 0.25); x.quadraticCurveTo(dx * rr - rr * 0.12, -rr * 0.3, dx * rr - rr * 0.1, -rr * 0.8); x.fill(); }
        x.fillStyle = '#ffffff70'; x.beginPath(); x.ellipse(-rr * 0.35, -rr * 0.45, rr * 0.3, rr * 0.1, -0.5, 0, Math.PI * 2); x.fill();
      });
    }
    c.restore();
  }
  private drawJelly(r: number) {
    const c = this.c, t = this.time;
    c.save(); c.lineWidth = Math.max(2, r * 0.18); c.strokeStyle = LEAD;
    c.beginPath(); c.arc(0, 0, r * 0.9, 0, Math.PI * 2);
    const g = c.createRadialGradient(-r * 0.3, -r * 0.35, 1, 0, 0, r);
    const h = (t * 60) % 360; g.addColorStop(0, '#ffffff'); g.addColorStop(0.45, `hsl(${h},90%,88%)`); g.addColorStop(0.8, `hsl(${(h + 60) % 360},80%,78%)`); g.addColorStop(1, '#e8b040');
    c.fillStyle = g; c.fill(); c.stroke();
    c.fillStyle = '#ffd23a'; c.lineWidth = Math.max(1.2, r * 0.08); c.beginPath(); c.moveTo(-r * 0.45, -r * 0.05); c.lineTo(-r * 0.45, -r * 0.42); c.lineTo(-r * 0.22, -r * 0.22); c.lineTo(0, -r * 0.5); c.lineTo(r * 0.22, -r * 0.22); c.lineTo(r * 0.45, -r * 0.42); c.lineTo(r * 0.45, -r * 0.05); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#ffffffcc'; c.beginPath(); c.ellipse(-r * 0.3, r * 0.25, r * 0.16, r * 0.08, -0.6, 0, Math.PI * 2); c.fill();
    c.restore();
  }
  private drawDying(d: Dying, r: number) {
    const c = this.c, k = d.t / d.dur, q = this.px(d.x, d.y + (d.kind === 'roll' ? k * 3 : 0));
    c.save(); c.globalAlpha = Math.max(0, 1 - k);
    if (d.kind === 'pop' || d.kind === 'chomp') { const s = d.kind === 'chomp' ? 1 - k : 1 + k * 0.6; c.translate(q.x, q.y); c.scale(s, s); c.translate(-q.x, -q.y); }
    this.drawPiece(d.p, { x: d.x, y: d.y + (d.kind === 'roll' ? k * 3 : 0) }, r, null);
    if (d.kind === 'pop') { c.globalCompositeOperation = 'lighter'; c.globalAlpha = (1 - k) * 0.8; c.fillStyle = '#fff2b0'; c.beginPath(); c.arc(q.x, q.y, r * (0.6 + k), 0, Math.PI * 2); c.fill(); }
    c.restore();
  }

  private drawPair() {
    const c = this.c, L = this.layout;
    for (const who of ['dora', 'enzo'] as const) {
      const o = L[who], m = this.mood[who], im = art(`${who}-${m}`) ?? art(`${who}-think`);
      const bob = Math.sin(this.time * (m === 'wow' ? 9 : m === 'happy' ? 5 : 1.6) + (who === 'enzo' ? 1.3 : 0)) * o.h * (m === 'think' ? 0.008 : 0.02);
      const pop = 1 + this.moodPop[who] * 0.08;
      c.save(); c.translate(o.x, o.y);
      // a pool of honey light under them
      const g = c.createRadialGradient(0, -o.h * 0.02, 2, 0, -o.h * 0.02, o.h * 0.42); g.addColorStop(0, 'rgba(255,210,110,0.5)'); g.addColorStop(1, 'rgba(255,210,110,0)');
      c.fillStyle = g; c.beginPath(); c.ellipse(0, -o.h * 0.02, o.h * 0.42, o.h * 0.1, 0, 0, Math.PI * 2); c.fill();
      c.translate(0, bob); c.scale(pop, 2 - pop);
      if (im) c.drawImage(im, -o.h / 2, -o.h, o.h, o.h);
      else { c.scale(who === 'enzo' ? -1 : 1, 1); standIn(c, who, o.h * 0.9); }
      c.restore();
    }
  }
}

// ---------------------------------------------------------------- stand-ins for the paintings
function paintWindow(cv: HTMLCanvasElement, tint: [string, string, string], seed: number) {
  const c = cv.getContext('2d'); if (!c) return;
  const W = cv.width, H = cv.height;
  const g = c.createRadialGradient(W * 0.4, H * 0.4, 10, W / 2, H / 2, W * 0.8); g.addColorStop(0, tint[0]); g.addColorStop(0.6, tint[1]); g.addColorStop(1, tint[2]);
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  let s = seed; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  c.strokeStyle = LEAD; c.lineWidth = 6;
  for (let k = 0; k < 40; k++) { const x = r() * W, y = r() * H; c.globalAlpha = 0.25; c.fillStyle = ['#ffd860', '#ff9a6a', '#9ad86a', '#ffffff'][k % 4]; c.beginPath(); hexPath(c, x, y, 40 + r() * 70); c.fill(); c.globalAlpha = 0.7; c.stroke(); }
  c.globalAlpha = 1;
}
export function paintTitle(cv: HTMLCanvasElement) { paintWindow(cv, AREA_TINT.queen, 11); }
export function paintEnding(cv: HTMLCanvasElement) { paintWindow(cv, ['#fff2b0', '#f2b02a', '#7a3e06'], 23); }
export function paintBack(cv: HTMLCanvasElement, area: AreaId) { paintWindow(cv, AREA_TINT[area], 5); }
export { drawDrop, drawBeeBody };
