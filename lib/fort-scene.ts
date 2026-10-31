// Pillow Fort's drawing, Canvas 2D only: a miniature felt set. The room backdrop painting, a woven rug, the fort's
// pieces drawn as stitched fabric with a seeded felt texture (cushions squash under weight and on landing), the
// blanket as a patchwork quilt hanging through its links, fairy lights that glow, the height lines and the warm den
// glow under a roof, the piece in paw with its drop guide, the cat, sleepy Enzo, fluff puffs and lightning, and Dora
// and Enzo as needle-felted cut-outs either side of the rug reacting to the fort. Every painting has a drawn stand-in.
import { FortGame, PIECES, RUG, pieceExtent, type Ev, type Kind, type Piece, type RoomId } from './fort-game';
import type { Body } from './fort-physics';

export type Mood = 'watch' | 'worry' | 'cheer';
const POSES: Mood[] = ['watch', 'worry', 'cheer'];

const IMG = new Map<string, HTMLImageElement>();
export function art(name: string): HTMLImageElement | null {
  if (typeof Image === 'undefined') return null;
  let im = IMG.get(name);
  if (!im) { im = new Image(); im.decoding = 'async'; im.src = `/art/fort/${name}.webp`; IMG.set(name, im); }
  return im.complete && im.naturalWidth > 0 ? im : null;
}
export function preload() { for (const who of ['dora', 'enzo']) for (const p of POSES) art(`${who}-${p}`); for (const r of ['living', 'attic', 'library', 'treehouse']) art(`room-${r}`); }

// ---- felt: one seeded noise tile, used as a pattern over every fabric
// Mid-grey is neutral under 'overlay', so the tile only lightens and darkens: soft mottling (felted wool is never
// even), fine grain, and short curly fibres. It tiles seamlessly because every layer wraps.
const TILE = 128;
let FELT: HTMLCanvasElement | null = null;
function felt(): HTMLCanvasElement | null {
  if (FELT || typeof document === 'undefined') return FELT;
  const c = document.createElement('canvas'); c.width = c.height = TILE;
  const x = c.getContext('2d'); if (!x) return null;
  let s = 1234567;
  const r = () => { s = (s * 1103515245 + 12345) >>> 0; return (s >>> 8) / 16777216; };
  // wrapping value noise at two scales for the mottling
  const grid = (n: number) => { const g: number[] = []; for (let i = 0; i < n * n; i++) g.push(r() - 0.5); return (u: number, v: number) => {
    const fx = u * n, fy = v * n, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    const at = (i: number, j: number) => g[((j + n) % n) * n + ((i + n) % n)];
    const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * sx, b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * sx;
    return a + (b - a) * sy;
  }; };
  const big = grid(4), mid = grid(12);
  const d = x.createImageData(TILE, TILE);
  for (let j = 0; j < TILE; j++) for (let i = 0; i < TILE; i++) {
    const u = i / TILE, v = j / TILE, k = (j * TILE + i) * 4;
    const val = 128 + big(u, v) * 46 + mid(u, v) * 40 + (r() - 0.5) * 34;
    d.data[k] = d.data[k + 1] = d.data[k + 2] = Math.max(0, Math.min(255, val)); d.data[k + 3] = 255;
  }
  x.putImageData(d, 0, 0);
  // curly fibres, drawn on all four wraps so the tile stays seamless
  x.lineCap = 'round';
  for (let i = 0; i < 420; i++) {
    const px = r() * TILE, py = r() * TILE, a = r() * Math.PI * 2, l = 3 + r() * 7, bend = (r() - 0.5) * 6, light = r() < 0.55;
    x.strokeStyle = light ? `rgba(255,255,255,${0.16 + r() * 0.2})` : `rgba(0,0,0,${0.12 + r() * 0.16})`; x.lineWidth = 0.5 + r() * 0.7;
    for (const ox of [-TILE, 0, TILE]) for (const oy of [-TILE, 0, TILE]) {
      const x0 = px + ox, y0 = py + oy, x1 = x0 + Math.cos(a) * l, y1 = y0 + Math.sin(a) * l;
      x.beginPath(); x.moveTo(x0, y0); x.quadraticCurveTo((x0 + x1) / 2 + Math.sin(a) * bend, (y0 + y1) / 2 - Math.cos(a) * bend, x1, y1); x.stroke();
    }
  }
  FELT = c; return c;
}

const PAL = ['#d9604f', '#e9a23b', '#5b9bb5', '#7fae6a', '#c46e9b', '#e7c75a', '#6f7fc4', '#d98a63', '#4fa39a', '#b65a5a'];
const BOOKS = ['#a83b3b', '#2f5f8a', '#3e7a4f', '#7b4a8c', '#b5813a', '#2d6b6b', '#8a3a5c'];
const ROOM_TONES: Record<RoomId, [string, string, string]> = {
  living: ['#5a3d2e', '#2d2236', '#e7b56d'], attic: ['#4a3628', '#221b26', '#e5a85f'], library: ['#3e3226', '#1d1a24', '#e9bd70'], treehouse: ['#3d4030', '#1a1f24', '#d8b46a'],
};

/** Where each room painting's cosy corner is, as a fraction of its width: an upright phone shows a slice of the
 * painting, so the slice is centred here (the rainy window, the round window, the lamp and shelves, the lantern)
 * and the fort stands on the calm painted floor below it. */
const ROOM_FOCUS: Record<RoomId, number> = { living: 0.17, attic: 0.25, library: 0.2, treehouse: 0.3 };
/** Dora and Enzo beside the rug on wide screens: their height in world units, and where they stand. Their fur on the
 * fort side stays 0.3 past the rug's edge, so they never cover a piece or a line label. */
const CHIN = 1.9, CHIN_X = RUG + 0.3 + CHIN * 0.44;

type Puff = { x: number; y: number; vx: number; vy: number; life: number; max: number; r: number; c: string; kind: 'fluff' | 'star' | 'z' };
type Squish = { v: number; t: number };

export class FortScene {
  cv: HTMLCanvasElement; c: CanvasRenderingContext2D;
  W = 0; H = 0; dpr = 1;
  game: FortGame | null = null;
  room: RoomId = 'living';
  mood: { dora: Mood; enzo: Mood } = { dora: 'watch', enzo: 'watch' };
  /** 0..1: the hold-your-breath slow-down, for the vignette. */
  slow = 0;
  /** Space the page's overlays take on the canvas, in CSS px: the bedtime card on the right (wide) or at the top (tall). */
  reserve = { right: 0, top: 0 };
  layout = { s: 40, ox: 0, oy: 0, tall: false, dora: { x: 0, y: 0, h: 0 }, enzo: { x: 0, y: 0, h: 0 } };
  private t = 0;
  private viewH = 7; private camY = 0;
  private puffs: Puff[] = [];
  private squish = new Map<number, Squish>();
  private flash = 0;
  private catAnim: { x: number; dir: number; t: number; pounce: { x: number; y: number } | null; pt: number } | null = null;
  private hop = { dora: 0, enzo: 0 };
  private yawn = 0;
  private zT = 0;
  private pattern: CanvasPattern | null = null;

  constructor(cv: HTMLCanvasElement) {
    this.cv = cv; const c = cv.getContext('2d'); if (!c) throw new Error('no 2d'); this.c = c;
    preload(); this.resize();
  }

  resize() {
    const r = this.cv.getBoundingClientRect(), W = Math.max(1, r.width), H = Math.max(1, r.height);
    const same = W === this.W && H === this.H; this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.W = W; this.H = H;
    this.cv.width = Math.round(this.W * this.dpr); this.cv.height = Math.round(this.H * this.dpr);
    // a new size snaps the framing; the same size (a card opening) lets it glide
    this.pattern = null; this.place(!same);
  }

  setGame(g: FortGame | null, room: RoomId) { this.game = g; this.room = room; this.puffs = []; this.squish.clear(); this.catAnim = null; this.flash = 0; this.yawn = 0; this.camY = 0; this.reserve = { right: 0, top: 0 }; this.viewH = this.wantView(); this.place(true); }

  /**
   * How much world height the camera wants. The night's star line plus room for a piece hanging over a fort that
   * reaches it sets the zoom for the whole night; only a fort built past that pulls the camera back.
   */
  private wantView() {
    const g = this.game; if (!g) return 6;
    const nt = g.night, top = g.top(), held = g.held ? g.hoverY(g.held.kind, g.held.rot) + pieceExtent(g.held.kind, g.held.rot).h : 0;
    return Math.max(nt ? Math.max(5.2, Math.max(nt.line, nt.high) + 2.2) : 6.2, top + 2.4, held + 0.35);
  }

  /** Fits the rug and the two of them across, and the night's lines (with headroom) up the height. */
  private place(snap = false) {
    const W = this.W, H = this.H, tall = H > W * 1.05, L = this.layout;
    // a sideways phone: the page stacks its buttons down the right edge and keeps the top clear
    const short = !tall && typeof window !== 'undefined' && window.innerHeight <= 520;
    const want = this.wantView();
    this.viewH = snap ? want : this.viewH + (want - this.viewH) * 0.06;
    let s: number, ox: number, oy: number;
    if (tall) {
      const top = Math.max(50, this.reserve.top), bottom = 64 + Math.min(140, W * 0.36);
      s = Math.max(8, Math.min(W / (2 * (RUG + 0.5)), (H - top - bottom) / this.viewH));
      ox = W / 2; oy = H - bottom;
    } else {
      const right = Math.max(this.reserve.right, short ? 118 : 0), top = short ? 10 : 16;
      const bottom = short ? Math.max(18, H * 0.06) : 66 + Math.max(8, H * 0.02);
      // at bedtime, with the card beside it, the camera frames the fort that was built rather than the whole rug,
      // and the two of them come in close to admire it
      const g = this.game, admire = this.reserve.right > 0 && g ? this.fortSpan(g) : null;
      const mid = admire ? (admire[0] + admire[1]) / 2 : 0, reach = admire ? Math.max(1.4, (admire[1] - admire[0]) / 2) + 0.3 + CHIN * 0.44 : CHIN_X;
      const vh = admire && g ? Math.max(4, g.top() + 1.3, (g.night?.high ?? 0) + 0.7) : this.viewH;
      s = Math.max(8, Math.min((W - right) / (2 * (reach + CHIN * 0.42)), (H - top - bottom) / vh));
      ox = (W - right) / 2 - mid * s; oy = H - bottom;
      // on a tall night the height sets the zoom and leaves width spare: Dora and Enzo grow into it
      const spare = (W - right) / 2 / s, kc = admire ? CHIN : Math.max(CHIN, Math.min(2.6, (spare - RUG - 0.3) / 0.86));
      this.chinAt = { mid, reach: admire ? reach : RUG + 0.3 + 0.44 * kc, k: kc };
    }
    if (snap) { L.s = s; L.ox = ox; L.oy = oy; }
    else { const k = 0.14; L.s += (s - L.s) * k; L.ox += (ox - L.ox) * k; L.oy += (oy - L.oy) * k; }
    L.tall = tall; s = L.s; ox = L.ox; oy = L.oy;
    if (tall) {
      const ch = Math.min(W * 0.34, 150);
      L.dora = { x: W * 0.2, y: H - 58, h: ch }; L.enzo = { x: W * 0.8, y: H - 58, h: ch * 1.06 };
    } else {
      const ch = Math.min(this.chinAt.k * s, H * 0.42);
      const { mid, reach } = this.chinAt;
      L.dora = { x: ox + (mid - reach) * s, y: oy + s * 0.12, h: ch }; L.enzo = { x: ox + (mid + reach) * s, y: oy + s * 0.12, h: ch };
    }
  }

  private chinAt = { mid: 0, reach: CHIN_X, k: CHIN };
  /** The world x span of the fort standing on the rug. */
  private fortSpan(g: FortGame): [number, number] {
    let a = Infinity, b = -Infinity;
    for (const p of g.pieces) { if (p.lost || !p.landed) continue; for (const q of p.bodies) { a = Math.min(a, q.minX); b = Math.max(b, q.maxX); } }
    return a <= b ? [Math.max(-RUG, a), Math.min(RUG, b)] : [-1, 1];
  }

  /** World x under a screen x (CSS px), for aiming. */
  worldX(px: number) { return (px - this.layout.ox) / this.layout.s; }
  screen(x: number, y: number) { return { x: this.layout.ox + x * this.layout.s, y: this.layout.oy - y * this.layout.s }; }

  onEvent(e: Ev) {
    const s = this.screen.bind(this);
    if (e.kind === 'thump') {
      const p = this.game?.pieces[e.n]; const soft = e.soft;
      if (p) for (const b of p.bodies) this.squish.set(b.id, { v: Math.min(0.28, 0.04 + e.v * 0.025) * (0.25 + soft), t: 0 });
      const n = Math.min(10, 3 + Math.floor(e.v));
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI, sp = 0.4 + (i % 3) * 0.25;
        this.puffs.push({ x: e.x + Math.cos(a) * 0.3, y: e.y + 0.02, vx: Math.cos(a) * sp * (i % 2 ? 1 : -1), vy: Math.sin(a) * sp * 0.6, life: 0, max: 0.5 + (i % 4) * 0.12, r: 0.06 + (i % 3) * 0.03, c: soft > 0.5 ? '#fff6e8' : '#e8dccb', kind: 'fluff' });
      }
    }
    if (e.kind === 'lost') for (let i = 0; i < 8; i++) this.puffs.push({ x: e.x, y: 0.2, vx: (i - 4) * 0.3, vy: 0.6 + (i % 3) * 0.3, life: 0, max: 0.8, r: 0.1, c: '#f3e6d0', kind: 'fluff' });
    if (e.kind === 'cat') this.catAnim = { x: -e.dir * (RUG + 0.35), dir: e.dir, t: 0, pounce: null, pt: 0 };
    if (e.kind === 'pounce' && this.catAnim) { this.catAnim.pounce = { x: e.x, y: e.y }; this.catAnim.pt = 0; }
    if (e.kind === 'thunder') this.flash = 1;
    if (e.kind === 'yawn') this.yawn = 1.6;
    if (e.kind === 'done' && e.result.stars > 0) {
      for (let i = 0; i < 26; i++) this.puffs.push({ x: (i % 2 ? -1 : 1) * (RUG + 1.5), y: 1.6, vx: (i % 2 ? 1 : -1) * (0.6 + (i % 5) * 0.3), vy: 2 + (i % 7) * 0.4, life: 0, max: 1.6, r: 0.12, c: ['#ffd65a', '#ff9db0', '#9be0ff', '#b8f08a'][i % 4], kind: 'star' });
      this.hop.dora = 1; this.hop.enzo = 1;
    }
    void s;
  }

  frame(dt: number) {
    this.t += dt; this.place();
    const c = this.c, W = this.W, H = this.H, d = this.dpr, L = this.layout;
    c.setTransform(d, 0, 0, d, 0, 0);
    this.drawRoom();
    this.drawFloor();
    const g = this.game;
    if (g) {
      this.drawDen(g);
      this.drawLines(g);
      // solid pieces, then ropes on top, then Enzo napping
      for (const p of g.pieces) if (!PIECES[p.kind].rope) this.drawPiece(p, g);
      for (const p of g.pieces) if (PIECES[p.kind].rope) this.drawRope(p, g);
      if (g.enzo?.body) this.drawNapper(g.enzo.body);
      this.drawCat(dt);
      if (g.held && g.phase === 'build') this.drawHeld(g);
    }
    this.drawChins(dt);
    this.drawPuffs(dt);
    for (const sq of this.squish.values()) sq.t += dt;
    if (this.flash > 0) { c.fillStyle = `rgba(235,240,255,${this.flash * 0.55})`; c.fillRect(0, 0, W, H); this.flash = Math.max(0, this.flash - dt * 2.2); }
    if (this.slow > 0.02) {
      const v = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
      v.addColorStop(0, 'rgba(20,10,30,0)'); v.addColorStop(1, `rgba(20,10,30,${this.slow * 0.55})`);
      c.fillStyle = v; c.fillRect(0, 0, W, H);
    }
    void L;
  }

  // ---- the room and the floor
  private drawRoom() {
    const c = this.c, W = this.W, H = this.H, bg = art(`room-${this.room}`), tone = ROOM_TONES[this.room];
    if (bg) {
      const L = this.layout, iw = bg.naturalWidth, ih = bg.naturalHeight;
      // upright, the painting only has to reach the rug (the floorboards take over below it), which shows more of
      // its width; the slice is centred on the room's cosy corner instead of the bare middle of the wall
      const k = Math.max(W / iw, (L.tall ? L.oy + 6 : H) / ih), dw = iw * k, dh = ih * k;
      const dx = Math.max(W - dw, Math.min(0, W / 2 - (L.tall ? ROOM_FOCUS[this.room] : 0.5) * dw));
      // the camera rises with the fort; the backdrop drifts a little with it
      const lift = Math.min(0.12, Math.max(0, (this.viewH - 7) / 40)) * H;
      const dy = dh <= H ? 0 : Math.max(H - dh, Math.min(0, (H - dh) / 2 + lift));
      c.drawImage(bg, dx, dy, dw, dh);
      c.fillStyle = 'rgba(30,18,24,0.18)'; c.fillRect(0, 0, W, H);
    } else paintRoom(c, W, H, tone);
    // warm lamp light pooled on the fort
    const L = this.layout, gl = c.createRadialGradient(L.ox, L.oy - L.s * 2, 10, L.ox, L.oy - L.s * 2, Math.max(W, H) * 0.6);
    gl.addColorStop(0, 'rgba(255,200,120,0.20)'); gl.addColorStop(1, 'rgba(255,200,120,0)');
    c.fillStyle = gl; c.fillRect(0, 0, W, H);
  }
  private drawFloor() {
    const c = this.c, L = this.layout, s = L.s, W = this.W, H = this.H;
    // boards
    c.fillStyle = '#5b3a26'; c.fillRect(0, L.oy, W, H - L.oy);
    c.strokeStyle = '#4a2e1e'; c.lineWidth = 1;
    for (let y = L.oy + 10; y < H; y += 14) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
    const fade = c.createLinearGradient(0, L.oy, 0, Math.min(H, L.oy + 60)); fade.addColorStop(0, 'rgba(40,22,14,0.45)'); fade.addColorStop(1, 'rgba(40,22,14,0)');
    c.fillStyle = fade; c.fillRect(0, L.oy, W, Math.min(60, H - L.oy));
    // the woven rug, slightly in perspective
    const x0 = L.ox - RUG * s, x1 = L.ox + RUG * s, d = Math.max(10, s * 0.32);
    c.fillStyle = '#9c3f3a'; c.beginPath(); c.moveTo(x0 - d * 0.6, L.oy + d); c.lineTo(x1 + d * 0.6, L.oy + d); c.lineTo(x1, L.oy); c.lineTo(x0, L.oy); c.closePath(); c.fill();
    c.fillStyle = '#c96b4f'; c.fillRect(x0, L.oy - 2, x1 - x0, 4);
    c.strokeStyle = '#f1d08a'; c.setLineDash([4, 4]); c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(x0 + 6, L.oy + d * 0.5); c.lineTo(x1 - 6, L.oy + d * 0.5); c.stroke(); c.setLineDash([]);
    // fringe
    c.strokeStyle = '#e9d2a0'; c.lineWidth = 1.2;
    for (const [xa, dir] of [[x0 - d * 0.6, -1], [x1 + d * 0.6, 1]] as const) for (let k = 0; k < 5; k++) { const yy = L.oy + 2 + k * (d - 2) / 4; c.beginPath(); c.moveTo(xa - dir * (k * d * 0.12), yy); c.lineTo(xa + dir * 7 - dir * (k * d * 0.12), yy + 2); c.stroke(); }
    this.texture(0.12, () => { c.beginPath(); c.moveTo(x0 - d * 0.6, L.oy + d); c.lineTo(x1 + d * 0.6, L.oy + d); c.lineTo(x1, L.oy); c.lineTo(x0, L.oy); c.closePath(); });
  }
  /**
   * Lays the felt texture over the path `path` makes. The grain is a fixed size on screen (one tile pixel to a CSS
   * pixel), whatever the zoom; it is pinned to the piece, so it turns and moves with it, and `seed` shifts it so no
   * two pieces share a patch.
   */
  private texture(alpha: number, path: () => void, seed = 0) {
    const c = this.c, f = felt(); if (!f) return;
    this.pattern ??= c.createPattern(f, 'repeat'); if (!this.pattern) return;
    const m = c.getTransform(), k = Math.hypot(m.a, m.b) / this.dpr || 1;
    this.pattern.setTransform(new DOMMatrix().scale(1 / k).translate((seed * 37) % TILE, (seed * 53) % TILE));
    c.save(); c.globalAlpha = alpha; c.globalCompositeOperation = 'overlay'; path(); c.fillStyle = this.pattern; c.fill(); c.restore();
  }

  // ---- goals: the height lines and the den
  private drawLines(g: FortGame) {
    const nt = g.night; if (!nt) return;
    // the lines span the rug and their labels sit inside its right end, clear of Enzo beside it
    const c = this.c, L = this.layout, x0 = Math.max(4, L.ox - (RUG + 0.2) * L.s), x1 = Math.min(this.W - this.reserve.right - 6, L.ox + (RUG + 0.2) * L.s), top = g.top();
    const line = (h: number, col: string, label: string, done: boolean) => {
      const y = L.oy - h * L.s;
      c.save(); c.strokeStyle = col; c.lineWidth = done ? 3 : 2; c.setLineDash(done ? [] : [8, 7]); c.globalAlpha = done ? 0.95 : 0.75;
      c.beginPath(); c.moveTo(x0, y); c.lineTo(x1, y); c.stroke(); c.setLineDash([]);
      c.font = '800 12px ui-rounded, "Trebuchet MS", system-ui, sans-serif'; c.textBaseline = 'bottom';
      const tw = c.measureText(label).width; c.fillStyle = 'rgba(40,24,30,0.72)';
      roundRect(c, x1 - tw - 14, y - 19, tw + 12, 17, 8); c.fill(); c.fillStyle = col; c.fillText(label, x1 - tw - 8, y - 4); c.restore();
    };
    line(nt.high, '#ffd36b', '★ ' + nt.high.toFixed(1), top >= nt.high);
    line(nt.line, '#fff4dc', 'LINE ' + nt.line.toFixed(1), top >= nt.line);
  }
  private drawDen(g: FortGame) {
    const d = g.den(); if (!d.cols.length) return;
    const c = this.c, L = this.layout, w = 0.1 * L.s + 0.6, pulse = 0.75 + 0.25 * Math.sin(this.t * 2.4);
    c.save();
    for (const col of d.cols) {
      const x = L.ox + col.x * L.s - w / 2, y = L.oy - col.h * L.s;
      const gr = c.createLinearGradient(0, y, 0, L.oy); gr.addColorStop(0, `rgba(255,190,90,${0.12 * pulse})`); gr.addColorStop(1, `rgba(255,210,120,${0.42 * pulse})`);
      c.fillStyle = gr; c.fillRect(x, y, w, L.oy - y);
    }
    c.restore();
  }

  // ---- the pieces
  private squashOf(b: Body, soft: number) {
    const sq = this.squish.get(b.id); let k = Math.min(0.12, b.load * 0.035) * soft;
    if (sq) { const e = Math.exp(-sq.t * 9) * Math.cos(sq.t * 26); k += sq.v * e; if (sq.t > 1) this.squish.delete(b.id); }
    return k;
  }
  private at(b: Body, sq = 0) {
    const c = this.c, L = this.layout, d = this.dpr;
    c.setTransform(d * L.s, 0, 0, -d * L.s, d * (L.ox + b.x * L.s), d * (L.oy - b.y * L.s));
    c.rotate(b.a);
    if (sq) c.scale(1 + sq * 0.6, 1 - sq);
  }
  private drawPiece(p: Piece, g: FortGame) {
    const c = this.c, def = PIECES[p.kind], b = p.bodies[0];
    let fade = 1; if (p.lost) { fade = Math.max(0, 1 - (g.tick - p.goneT) / 40); if (fade <= 0) return; }
    c.save(); c.globalAlpha = fade;
    this.at(b, this.squashOf(b, def.soft));
    drawKind(c, p.kind, p.n, this.t, (a, path) => this.texture(a, path, p.n + 1));
    c.restore();
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }
  private drawRope(p: Piece, g: FortGame) {
    const c = this.c, L = this.layout, pts = p.bodies.map((b) => this.screen(b.x, b.y));
    let fade = 1; if (p.lost) { fade = Math.max(0, 1 - (g.tick - p.goneT) / 40); if (fade <= 0) return; }
    c.save(); c.globalAlpha = fade; c.lineJoin = 'round'; c.lineCap = 'round';
    if (p.kind === 'blanket') {
      const w = 0.2 * L.s;
      c.strokeStyle = '#6b3f5a'; c.lineWidth = w + 3; strokePts(c, pts);
      for (let i = 0; i + 1 < pts.length; i++) { c.strokeStyle = ['#c9576b', '#e8b04c', '#5f93b8', '#8db36a'][(i + p.n) % 4]; c.lineWidth = w; c.beginPath(); c.moveTo(pts[i].x, pts[i].y); c.lineTo(pts[i + 1].x, pts[i + 1].y); c.stroke(); }
      c.strokeStyle = '#fff3dc'; c.lineWidth = 1.2; c.setLineDash([3, 3]); strokePts(c, pts, -w * 0.28); c.setLineDash([]);
      // tassels on the ends
      for (const q of [pts[0], pts[pts.length - 1]]) { c.strokeStyle = '#f2d27a'; c.lineWidth = 2; c.beginPath(); c.moveTo(q.x, q.y); c.lineTo(q.x, q.y + w * 0.9); c.stroke(); }
    } else {
      c.strokeStyle = '#3c4a3a'; c.lineWidth = 1.6; strokePts(c, pts);
      for (let i = 1; i < pts.length; i += 2) {
        const q = pts[i], hue = ['#ffd36b', '#ff9a8a', '#a8e0ff', '#c8f59a'][(i >> 1) % 4], tw = 0.75 + 0.25 * Math.sin(this.t * 3 + i);
        const gl = c.createRadialGradient(q.x, q.y + 3, 0, q.x, q.y + 3, L.s * 0.3);
        gl.addColorStop(0, hue); gl.addColorStop(1, 'rgba(255,220,140,0)');
        c.globalAlpha = fade * tw * 0.55; c.fillStyle = gl; c.beginPath(); c.arc(q.x, q.y + 3, L.s * 0.3, 0, Math.PI * 2); c.fill();
        c.globalAlpha = fade; c.fillStyle = hue; c.beginPath(); c.ellipse(q.x, q.y + 3, 2.6, 3.6, 0, 0, Math.PI * 2); c.fill();
      }
    }
    c.restore();
  }
  private drawNapper(b: Body) {
    const c = this.c, im = art('enzo-watch');
    c.save(); this.at(b);
    const w = 1.9, h = 1.9;
    c.scale(1, -1);
    if (im) { c.rotate(-Math.PI / 2 * 0.9); c.drawImage(im, -w / 2, -h * 0.62, w, h); }
    else { c.fillStyle = '#7d8a9e'; c.beginPath(); c.ellipse(0, 0, 0.75, 0.4, 0, 0, Math.PI * 2); c.fill(); }
    c.restore(); c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (this.t - this.zT > 0.9) { this.zT = this.t; this.puffs.push({ x: b.x + 0.4, y: b.maxY + 0.1, vx: 0.25, vy: 0.5, life: 0, max: 1.8, r: 0.25, c: '#e8eefc', kind: 'z' }); }
  }
  private drawCat(dt: number) {
    const a = this.catAnim; if (!a) return;
    a.t += dt; if (a.pounce) a.pt += dt;
    const c = this.c, L = this.layout;
    let x = a.x, y = 0, sc = 1;
    if (a.t < 1) x = a.x + (1 - Math.min(1, a.t)) * -a.dir * 2.5;
    if (a.pounce) {
      const k = Math.min(1, a.pt / 0.35);
      if (a.pt < 0.35) { x = a.x + (a.pounce.x - a.x) * k; y = a.pounce.y * k + Math.sin(k * Math.PI) * 1.4; }
      else if (a.pt < 0.6) { x = a.pounce.x; y = a.pounce.y; sc = 1.05; }
      else { const k2 = Math.min(1, (a.pt - 0.6) / 0.5); x = a.pounce.x + (a.x + a.dir * -3 - a.pounce.x) * k2; y = a.pounce.y * (1 - k2) + Math.sin(k2 * Math.PI) * 1.2; }
      if (a.pt > 1.3) { this.catAnim = null; return; }
    }
    const p = this.screen(x, y), s = L.s * 0.55 * sc;
    c.save(); c.translate(p.x, p.y); c.scale(a.dir, 1);
    drawCatShape(c, s, this.t);
    c.restore();
  }
  private drawHeld(g: FortGame) {
    const h = g.held!, c = this.c, L = this.layout, y = g.hoverY(h.kind, h.rot), e = pieceExtent(h.kind, h.rot);
    const ready = g.canDrop(), bob = Math.sin(this.t * 3) * 0.03;
    // drop guide down to whatever is below
    let below = 0; for (const dx of [-e.w * 0.8, 0, e.w * 0.8]) below = Math.max(below, g.colTop(h.x + dx));
    const p = this.screen(h.x, y - e.h), q = this.screen(h.x, below);
    c.save(); c.strokeStyle = 'rgba(255,240,210,0.55)'; c.setLineDash([3, 6]); c.lineWidth = 2;
    for (const dx of [-e.w, e.w]) { const a = this.screen(h.x + dx, y - e.h), b = this.screen(h.x + dx, below); c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); }
    c.setLineDash([]); c.fillStyle = 'rgba(255,240,210,0.35)'; c.beginPath(); c.ellipse(q.x, q.y, e.w * L.s, 4, 0, 0, Math.PI * 2); c.fill(); c.restore();
    void p;
    const def = PIECES[h.kind];
    c.save(); c.globalAlpha = ready ? 0.95 : 0.55;
    if (def.rope) {
      const n = def.rope.links, gap = def.rope.gap, pts = [];
      for (let i = 0; i < n; i++) { const xx = h.x - (n - 1) * gap / 2 + i * gap; pts.push(this.screen(xx, y + bob + Math.sin(this.t * 2 + i * 0.5) * 0.04)); }
      const fake = { n: g.pieces.length, kind: h.kind, bodies: [], rot: 0, dropT: 0, lost: false, goneT: -1, landed: false } as Piece;
      void fake; c.lineCap = 'round';
      if (h.kind === 'blanket') { for (let i = 0; i + 1 < pts.length; i++) { c.strokeStyle = ['#c9576b', '#e8b04c', '#5f93b8', '#8db36a'][(i + g.pieces.length) % 4]; c.lineWidth = 0.2 * L.s; c.beginPath(); c.moveTo(pts[i].x, pts[i].y); c.lineTo(pts[i + 1].x, pts[i + 1].y); c.stroke(); } }
      else { c.strokeStyle = '#3c4a3a'; c.lineWidth = 1.6; strokePts(c, pts); for (let i = 1; i < pts.length; i += 2) { c.fillStyle = ['#ffd36b', '#ff9a8a', '#a8e0ff', '#c8f59a'][(i >> 1) % 4]; c.beginPath(); c.arc(pts[i].x, pts[i].y + 3, 3, 0, Math.PI * 2); c.fill(); } }
    } else {
      const d = this.dpr;
      c.setTransform(d * L.s, 0, 0, -d * L.s, d * (L.ox + h.x * L.s), d * (L.oy - (y + bob) * L.s)); c.rotate(h.rot);
      drawKind(c, h.kind, g.pieces.length, this.t, (a, path) => this.texture(a, path, g.pieces.length + 1));
    }
    c.restore(); c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  // ---- Dora and Enzo
  private drawChins(dt: number) {
    const L = this.layout, g = this.game;
    this.hop.dora = Math.max(0, this.hop.dora - dt * 0.7); this.hop.enzo = Math.max(0, this.hop.enzo - dt * 0.7);
    this.yawn = Math.max(0, this.yawn - dt);
    const napping = !!g?.enzo?.body;
    this.drawChin('dora', this.mood.dora, L.dora.x, L.dora.y, L.dora.h, this.hop.dora);
    if (!napping) this.drawChin('enzo', this.yawn > 0 ? 'watch' : this.mood.enzo, L.enzo.x, L.enzo.y, L.enzo.h, this.hop.enzo);
  }
  private drawChin(who: 'dora' | 'enzo', mood: Mood, x: number, y: number, h: number, hop: number) {
    const c = this.c, im = art(`${who}-${mood}`) ?? art(`${who}-watch`);
    const bounce = mood === 'cheer' ? Math.abs(Math.sin(this.t * 7 + (who === 'enzo' ? 1 : 0))) * h * 0.05 + hop * h * 0.08 : mood === 'worry' ? Math.sin(this.t * 22) * h * 0.006 : Math.sin(this.t * 1.6 + (who === 'enzo' ? 2 : 0)) * h * 0.006;
    const breathe = 1 + Math.sin(this.t * 2.1 + (who === 'enzo' ? 1.3 : 0)) * 0.012;
    c.save(); c.translate(x, y - bounce);
    // soft contact shadow
    c.fillStyle = 'rgba(20,10,10,0.35)'; c.beginPath(); c.ellipse(0, bounce - 2, h * 0.32, h * 0.05, 0, 0, Math.PI * 2); c.fill();
    c.scale(breathe, 1 / breathe);
    if (im) c.drawImage(im, -h / 2, -h, h, h);
    else drawFeltChin(c, who, mood, h, this.t);
    c.restore();
  }

  private drawPuffs(dt: number) {
    const c = this.c, L = this.layout;
    this.puffs = this.puffs.filter((p) => (p.life += dt) < p.max);
    for (const p of this.puffs) {
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.kind === 'star') p.vy -= 5 * dt; else p.vy *= 1 - dt * 1.5;
      const k = 1 - p.life / p.max, s = this.screen(p.x, p.y);
      c.globalAlpha = Math.max(0, k);
      if (p.kind === 'z') { c.fillStyle = p.c; c.font = `800 ${Math.round(L.s * p.r * (1 + p.life * 0.4))}px ui-rounded, system-ui, sans-serif`; c.fillText('z', s.x, s.y); }
      else if (p.kind === 'star') { c.fillStyle = p.c; star(c, s.x, s.y, L.s * p.r * 1.3, this.t * 3 + p.vx); }
      else { c.fillStyle = p.c; c.beginPath(); c.arc(s.x, s.y, L.s * p.r * (1 + p.life), 0, Math.PI * 2); c.fill(); }
    }
    c.globalAlpha = 1;
  }

  /** For the browser checks: where things are on screen. */
  boxes() {
    const L = this.layout, d = L.dora, e = L.enzo;
    return { W: this.W, H: this.H, s: L.s, tall: L.tall, rug: { x0: L.ox - RUG * L.s, x1: L.ox + RUG * L.s, y: L.oy },
      dora: { x: d.x - d.h / 2, y: d.y - d.h, w: d.h, h: d.h }, enzo: { x: e.x - e.h / 2, y: e.y - e.h, w: e.h, h: e.h } };
  }
}

function strokePts(c: CanvasRenderingContext2D, pts: { x: number; y: number }[], dy = 0) { c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p.x, p.y + dy) : c.moveTo(p.x, p.y + dy))); c.stroke(); }
function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const k = Math.min(r, w / 2, h / 2); c.beginPath(); c.moveTo(x + k, y); c.arcTo(x + w, y, x + w, y + h, k); c.arcTo(x + w, y + h, x, y + h, k); c.arcTo(x, y + h, x, y, k); c.arcTo(x, y, x + w, y, k); c.closePath();
}
function star(c: CanvasRenderingContext2D, x: number, y: number, r: number, a: number) {
  c.beginPath(); for (let i = 0; i < 10; i++) { const rr = i % 2 ? r * 0.45 : r, t = a + (i * Math.PI) / 5; c.lineTo(x + Math.cos(t) * rr, y + Math.sin(t) * rr); } c.closePath(); c.fill();
}

/**
 * Draws one piece in its own frame (world units, y up, centred on its centre of mass as the physics has it).
 * `tex` lays felt over a path.
 */
export function drawKind(c: CanvasRenderingContext2D, kind: Kind, n: number, t: number, tex: (alpha: number, path: () => void) => void) {
  // running stitches: a thread with a faint shadow below it, so it sits in the fabric rather than on top
  const seam = (col: string, path: () => void) => {
    c.save(); c.lineCap = 'round'; c.setLineDash([0.075, 0.06]); c.lineWidth = 0.04;
    c.save(); c.translate(0.012, -0.016); path(); c.restore(); c.strokeStyle = 'rgba(45,20,20,0.38)'; c.stroke();
    path(); c.strokeStyle = col; c.stroke(); c.restore();
  };
  // stuffed pieces: lit from above, shadowed where they curve under, darker in at the edges
  const puff = (path: () => void, h: number) => {
    c.save(); path(); c.clip();
    const g = c.createLinearGradient(0, h / 2, 0, -h / 2);
    g.addColorStop(0, 'rgba(255,247,232,0.32)'); g.addColorStop(0.4, 'rgba(255,247,232,0)'); g.addColorStop(0.62, 'rgba(50,20,24,0)'); g.addColorStop(1, 'rgba(50,20,24,0.34)');
    c.fillStyle = g; c.fillRect(-3, -h, 6, h * 2);
    path(); c.strokeStyle = 'rgba(50,20,24,0.2)'; c.lineWidth = 0.16; c.stroke();
    c.restore();
  };
  /** One fabric panel: the colour, its pattern, the stuffing's shading, the felt, a firm edge and a stitched seam. */
  const fabric = (path: () => void, fill: string, edge: string, stitch: string | null, inset = 0.07, o: { decor?: () => void; h?: number } = {}) => {
    path(); c.fillStyle = fill; c.fill();
    if (o.decor) { c.save(); path(); c.clip(); o.decor(); c.restore(); }
    if (o.h) puff(path, o.h);
    tex(o.h ? 0.62 : 0.45, path);
    path(); c.strokeStyle = edge; c.lineWidth = 0.04; c.stroke();
    if (stitch) seam(stitch, () => { c.save(); c.scale(1 - inset, 1 - inset * 1.6); path(); c.restore(); });
  };
  const rr = (w: number, h: number, r: number, cx = 0, cy = 0) => () => {
    const x = cx - w / 2, y = cy - h / 2, k = Math.min(r, w / 2, h / 2);
    c.beginPath(); c.moveTo(x + k, y); c.arcTo(x + w, y, x + w, y + h, k); c.arcTo(x + w, y + h, x, y + h, k); c.arcTo(x, y + h, x, y, k); c.arcTo(x, y, x + w, y, k); c.closePath();
  };
  const col = PAL[n % PAL.length], dark = shade(col, -0.28), light = shade(col, 0.35);
  if (kind === 'cushion' || kind === 'pillow' || kind === 'floor') {
    const [w, h, r] = kind === 'cushion' ? [1.62, 0.64, 0.3] : kind === 'pillow' ? [0.94, 0.94, 0.32] : [2.52, 0.72, 0.34];
    // pattern: stripes, dots or a plain cushion with piping, felted in with the rest
    const pat = n % 3;
    fabric(rr(w, h, r), col, dark, light, 0.07, { h, decor: () => {
      if (pat === 0) { c.fillStyle = shade(col, 0.18); for (let x = -w / 2; x < w / 2; x += 0.22) c.fillRect(x, -h / 2, 0.08, h); }
      else if (pat === 1) { c.fillStyle = light; for (let x = -w / 2 + 0.12; x < w / 2; x += 0.24) for (let y = -h / 2 + 0.12; y < h / 2; y += 0.24) { c.beginPath(); c.arc(x + ((y * 10) % 2 ? 0.12 : 0), y, 0.035, 0, Math.PI * 2); c.fill(); } }
    } });
    // buttons
    const bs = kind === 'floor' ? [-0.7, 0, 0.7] : [0];
    for (const bx of bs) { c.fillStyle = dark; c.beginPath(); c.arc(bx, 0, 0.065, 0, Math.PI * 2); c.fill(); c.fillStyle = light; c.beginPath(); c.arc(bx - 0.015, 0.015, 0.02, 0, Math.PI * 2); c.fill(); }
    if (kind === 'pillow') for (const [x, y] of [[-0.42, -0.42], [0.42, -0.42], [0.42, 0.42], [-0.42, 0.42]]) { c.fillStyle = '#f2d27a'; c.beginPath(); c.arc(x, y, 0.06, 0, Math.PI * 2); c.fill(); }
  } else if (kind === 'bolster') {
    fabric(rr(2.3, 0.48, 0.22), col, dark, null, 0, { h: 0.48, decor: () => { c.fillStyle = shade(col, 0.2); for (let x = -0.9; x <= 0.9; x += 0.3) c.fillRect(x, -0.24, 0.1, 0.48); } });
    for (const x of [-1.03, 1.03]) { c.fillStyle = dark; c.beginPath(); c.ellipse(x, 0, 0.08, 0.2, 0, 0, Math.PI * 2); c.fill(); c.fillStyle = '#f2d27a'; c.beginPath(); c.arc(x, 0, 0.05, 0, Math.PI * 2); c.fill(); }
    seam(light, rr(2.18, 0.38, 0.18));
  } else if (kind === 'book' || kind === 'atlas') {
    const [w, h] = kind === 'book' ? [1.25, 0.25] : [1.9, 0.32], bc = BOOKS[n % BOOKS.length];
    fabric(rr(w, h, 0.03), bc, shade(bc, -0.35), null);
    c.fillStyle = '#f4ecd8'; c.fillRect(-w / 2 + 0.06, -h / 2 + 0.04, w - 0.16, h - 0.08);
    c.strokeStyle = '#d8ccb0'; c.lineWidth = 0.012; for (let y = -h / 2 + 0.07; y < h / 2 - 0.05; y += 0.035) { c.beginPath(); c.moveTo(-w / 2 + 0.08, y); c.lineTo(w / 2 - 0.12, y); c.stroke(); }
    c.fillStyle = bc; c.fillRect(w / 2 - 0.12, -h / 2, 0.12, h);
    c.fillStyle = '#e9c45a'; c.fillRect(w / 2 - 0.1, -h * 0.25, 0.08, 0.04); c.fillRect(w / 2 - 0.1, h * 0.15, 0.08, 0.04);
    if (kind === 'atlas') { c.fillStyle = '#e9c45a'; c.fillRect(-w / 2, -h / 2, 0.06, h); }
  } else if (kind === 'stool') {
    const wood = '#9b6a3f', dk = '#6d4628';
    fabric(rr(1.5, 0.2, 0.06, 0, 0.5), wood, dk, null);
    fabric(rr(0.16, 0.92, 0.04, -0.56, -0.06), wood, dk, null);
    fabric(rr(0.16, 0.86, 0.04, 0.56, -0.03), wood, dk, null);
    c.strokeStyle = dk; c.lineWidth = 0.05; c.beginPath(); c.moveTo(-0.5, 0.0); c.lineTo(0.5, 0.0); c.stroke();
    // a felt seat pad
    fabric(rr(1.3, 0.1, 0.05, 0, 0.64), '#c95e57', '#8e3a35', '#f7c6b9', 0.03);
  } else if (kind === 'teacup') {
    c.beginPath(); c.moveTo(-0.36, -0.2); c.lineTo(0.36, -0.2); c.stroke();
    fabric(rr(0.74, 0.08, 0.04, 0, -0.2), '#f7f1e8', '#b9ab98', null);
    fabric(() => { c.beginPath(); c.moveTo(-0.24, -0.165); c.lineTo(0.24, -0.165); c.lineTo(0.32, 0.2); c.lineTo(-0.32, 0.2); c.closePath(); }, '#f7f1e8', '#b9ab98', null);
    c.fillStyle = '#5b8fc4'; c.fillRect(-0.3, 0.12, 0.6, 0.04); c.fillRect(-0.27, -0.02, 0.54, 0.03);
    c.strokeStyle = '#f7f1e8'; c.lineWidth = 0.07; c.beginPath(); c.arc(0.36, 0.02, 0.1, -1.4, 1.4); c.stroke();
    c.fillStyle = '#7a4a2a'; c.beginPath(); c.ellipse(0, 0.2, 0.28, 0.035, 0, 0, Math.PI * 2); c.fill();
  } else if (kind === 'teapot') {
    const pc = '#5d8f9c';
    fabric(() => { c.beginPath(); c.moveTo(0.36, -0.06); c.lineTo(0.68, 0.22); c.lineTo(0.62, 0.28); c.lineTo(0.3, 0.12); c.closePath(); }, pc, shade(pc, -0.3), null);
    fabric(() => { c.beginPath(); c.arc(0, 0.02, 0.42, 0, Math.PI * 2); }, pc, shade(pc, -0.3), null);
    fabric(rr(0.56, 0.1, 0.04, 0, -0.38), shade(pc, -0.15), shade(pc, -0.35), null);
    fabric(rr(0.3, 0.12, 0.05, 0, 0.47), shade(pc, 0.15), shade(pc, -0.3), null);
    c.fillStyle = '#f2d27a'; c.beginPath(); c.arc(0, 0.56, 0.05, 0, Math.PI * 2); c.fill();
    c.strokeStyle = shade(pc, -0.3); c.lineWidth = 0.08; c.beginPath(); c.arc(-0.44, 0.04, 0.16, Math.PI * 0.55, Math.PI * 1.45); c.stroke();
    c.fillStyle = '#f7f1e8'; for (const a of [0.3, 1.2, 2.1]) { c.beginPath(); c.arc(Math.cos(a) * 0.22 - 0.05, Math.sin(a) * 0.12 - 0.05, 0.05, 0, Math.PI * 2); c.fill(); }
  } else if (kind === 'duck') {
    const y = '#f5cf3b', dk = '#c79a1c';
    fabric(() => { c.beginPath(); c.arc(0, 0, 0.32, 0, Math.PI * 2); }, y, dk, null);
    fabric(() => { c.beginPath(); c.arc(0.2, 0.34, 0.2, 0, Math.PI * 2); }, y, dk, null);
    c.fillStyle = '#ef7d2d'; c.beginPath(); c.ellipse(0.42, 0.31, 0.1, 0.05, -0.1, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#1b1414'; c.beginPath(); c.arc(0.25, 0.39, 0.035, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(0.26, 0.4, 0.012, 0, Math.PI * 2); c.fill();
    c.strokeStyle = dk; c.lineWidth = 0.04; c.beginPath(); c.arc(-0.05, 0.02, 0.17, Math.PI * 0.9, Math.PI * 1.9); c.stroke();
  } else if (kind === 'box') {
    fabric(rr(1.1, 0.9, 0.04), '#c99a62', '#8a6236', null);
    c.fillStyle = '#e6cf9a'; c.fillRect(-0.08, -0.45, 0.16, 0.9);
    c.strokeStyle = '#8a6236'; c.lineWidth = 0.025; c.beginPath(); c.moveTo(-0.55, 0.3); c.lineTo(0.55, 0.3); c.stroke();
    c.save(); c.scale(1, -1); c.fillStyle = '#8a6236'; c.font = '700 0.16px ui-rounded, system-ui, sans-serif'; c.textAlign = 'center'; c.fillText('↑↑', -0.3, 0.1); c.restore();
  }
  void t;
}

function drawCatShape(c: CanvasRenderingContext2D, s: number, t: number) {
  // a felt tabby: body, head, ears, tail, all soft and round; faces +x
  const fur = '#6b5a52', dk = '#4a3d38';
  c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(0, 2, s * 0.8, s * 0.12, 0, 0, Math.PI * 2); c.fill();
  c.strokeStyle = fur; c.lineWidth = s * 0.16; c.lineCap = 'round';
  c.beginPath(); c.moveTo(-s * 0.7, -s * 0.4); c.quadraticCurveTo(-s * 1.2, -s * (0.9 + Math.sin(t * 4) * 0.15), -s * 0.95, -s * 1.3); c.stroke();
  c.fillStyle = fur; c.beginPath(); c.ellipse(0, -s * 0.42, s * 0.78, s * 0.42, 0, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.arc(s * 0.62, -s * 0.85, s * 0.36, 0, Math.PI * 2); c.fill();
  for (const ex of [0.42, 0.8]) { c.beginPath(); c.moveTo(s * (ex - 0.13), -s * 1.1); c.lineTo(s * ex, -s * 1.38); c.lineTo(s * (ex + 0.13), -s * 1.08); c.closePath(); c.fill(); }
  c.strokeStyle = dk; c.lineWidth = s * 0.05; for (const x of [-0.3, 0, 0.3]) { c.beginPath(); c.moveTo(s * x, -s * 0.8); c.lineTo(s * (x + 0.08), -s * 0.55); c.stroke(); }
  c.fillStyle = '#c9e05a'; for (const ex of [0.55, 0.78]) { c.beginPath(); c.arc(s * ex, -s * 0.9, s * 0.06, 0, Math.PI * 2); c.fill(); }
  c.fillStyle = '#111'; for (const ex of [0.55, 0.78]) { c.beginPath(); c.ellipse(s * ex, -s * 0.9, s * 0.02, s * 0.05, 0, 0, Math.PI * 2); c.fill(); }
  c.fillStyle = '#e48a9a'; c.beginPath(); c.arc(s * 0.7, -s * 0.78, s * 0.035, 0, Math.PI * 2); c.fill();
  c.fillStyle = fur; for (const x of [-0.45, 0.35]) { c.beginPath(); c.ellipse(s * x, -s * 0.06, s * 0.14, s * 0.09, 0, 0, Math.PI * 2); c.fill(); }
}

/** A felt-coloured stand-in for a missing cut-out. */
export function drawFeltChin(c: CanvasRenderingContext2D, who: 'dora' | 'enzo', mood: Mood, h: number, t: number) {
  const fur = who === 'dora' ? '#f3eadb' : '#7f8c9e', dk = who === 'dora' ? '#d9ccb5' : '#5f6b7c', eye = who === 'dora' ? '#b3122a' : '#111', face = who === 'dora' ? 1 : -1;
  c.save(); c.scale(face, 1);
  c.fillStyle = dk; c.beginPath(); c.ellipse(-h * 0.24, -h * 0.25, h * 0.14, h * 0.2, -0.5, 0, Math.PI * 2); c.fill();
  c.fillStyle = fur; c.beginPath(); c.ellipse(0, -h * 0.3, h * 0.27, h * 0.3, 0, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.ellipse(h * 0.04, -h * 0.66, h * 0.24, h * 0.21, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#f2a9b4'; for (const ex of [-0.13, 0.17]) { c.beginPath(); c.ellipse(h * ex, -h * 0.87, h * 0.09, h * 0.1, 0, 0, Math.PI * 2); c.fill(); }
  if (mood === 'cheer') { c.strokeStyle = '#2a1a1a'; c.lineWidth = h * 0.012; for (const ex of [-0.04, 0.14]) { c.beginPath(); c.arc(h * ex, -h * 0.67, h * 0.03, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); } }
  else { c.fillStyle = eye; for (const ex of [-0.04, 0.14]) { c.beginPath(); c.arc(h * ex, -h * 0.68, h * (mood === 'worry' ? 0.04 : 0.033), 0, Math.PI * 2); c.fill(); } c.fillStyle = '#fff'; for (const ex of [-0.05, 0.13]) { c.beginPath(); c.arc(h * ex, -h * 0.69, h * 0.011, 0, Math.PI * 2); c.fill(); } }
  c.fillStyle = '#e7909c'; c.beginPath(); c.arc(h * 0.24, -h * 0.62, h * 0.02, 0, Math.PI * 2); c.fill();
  c.restore(); void t;
}

function shade(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const f = (v: number) => Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

function paintRoom(c: CanvasRenderingContext2D, W: number, H: number, tone: [string, string, string]) {
  const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, tone[1]); g.addColorStop(1, tone[0]);
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  // a rainy window
  const wx = W * 0.08, wy = H * 0.1, ww = W * 0.2, wh = H * 0.36;
  c.fillStyle = '#1d2a44'; c.fillRect(wx, wy, ww, wh);
  c.strokeStyle = '#8fa7c9'; c.lineWidth = 1;
  for (let i = 0; i < 26; i++) { const x = wx + ((i * 37) % 100) / 100 * ww, y = wy + ((i * 53) % 100) / 100 * wh; c.globalAlpha = 0.5; c.beginPath(); c.moveTo(x, y); c.lineTo(x - 3, y + 12); c.stroke(); }
  c.globalAlpha = 1; c.strokeStyle = '#6b4a32'; c.lineWidth = 8; c.strokeRect(wx, wy, ww, wh); c.beginPath(); c.moveTo(wx + ww / 2, wy); c.lineTo(wx + ww / 2, wy + wh); c.moveTo(wx, wy + wh / 2); c.lineTo(wx + ww, wy + wh / 2); c.stroke();
  const lamp = c.createRadialGradient(W * 0.85, H * 0.35, 4, W * 0.85, H * 0.35, H * 0.5); lamp.addColorStop(0, tone[2] + 'aa'); lamp.addColorStop(1, tone[2] + '00');
  c.fillStyle = lamp; c.fillRect(0, 0, W, H);
}

/** Drawn stand-ins for the title and ending paintings. */
export function paintTitle(cv: HTMLCanvasElement) {
  const c = cv.getContext('2d'); if (!c) return; const W = cv.width, H = cv.height;
  paintRoom(c, W, H, ROOM_TONES.living);
  const t = (a: number, p: () => void) => { void a; void p; };
  c.save(); c.translate(W * 0.36, H * 0.82); c.scale(H / 9, -H / 9);
  for (const [k, x, y, n] of [['floor', 0, 0.36, 0], ['cushion', -0.9, 1.04, 1], ['cushion', 0.9, 1.04, 2], ['book', 0, 1.5, 3]] as [Kind, number, number, number][]) { c.save(); c.translate(x, y); drawKind(c, k, n, 0, t); c.restore(); }
  c.restore();
  c.save(); c.translate(W * 0.16, H * 0.9); drawFeltChin(c, 'dora', 'cheer', H * 0.32, 0); c.restore();
  c.save(); c.translate(W * 0.56, H * 0.9); drawFeltChin(c, 'enzo', 'watch', H * 0.34, 0); c.restore();
}
export function paintEnding(cv: HTMLCanvasElement) {
  const c = cv.getContext('2d'); if (!c) return; const W = cv.width, H = cv.height;
  paintRoom(c, W, H, ROOM_TONES.treehouse);
  c.fillStyle = '#f4f0dc'; c.beginPath(); c.arc(W * 0.18, H * 0.2, H * 0.06, 0, Math.PI * 2); c.fill();
  c.strokeStyle = '#c9576b'; c.lineWidth = H * 0.05; c.beginPath(); c.moveTo(W * 0.25, H * 0.55); c.quadraticCurveTo(W * 0.5, H * 0.45, W * 0.75, H * 0.55); c.stroke();
  for (let i = 0; i < 12; i++) { c.fillStyle = ['#ffd36b', '#ff9a8a', '#a8e0ff'][i % 3]; c.beginPath(); c.arc(W * (0.27 + i * 0.04), H * (0.5 - Math.sin(i / 11 * Math.PI) * 0.05), H * 0.012, 0, Math.PI * 2); c.fill(); }
  c.save(); c.translate(W * 0.43, H * 0.86); drawFeltChin(c, 'dora', 'cheer', H * 0.3, 0); c.restore();
  c.save(); c.translate(W * 0.57, H * 0.86); drawFeltChin(c, 'enzo', 'cheer', H * 0.32, 0); c.restore();
}
