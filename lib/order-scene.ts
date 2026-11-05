// Turn Order: the drawing. A 384 by 216 garden with the 8 by 8 board in the middle, Enzo conducting from his podium on
// the left and Dora waiting with her basket on the right. Every critter wears its place in the queue as a little
// number in the corner of its tile (never over its face), and a chevron shows which way it faces when that matters.
// Before a round the board shows a ghost of what the round will do; during it, the steps play one by one, each
// critter's number flashing as it acts. Codex-painted pixel art from public/art/order/, drawn with nearest-neighbour.
import * as G from './order-game';
import type { Board, Piece, Step } from './order-game';

export const SW = 384, SH = 216, T = 24, BX = 96, BY = 12;
const NAMES = ['garden', 'grass1', 'grass2', 'soil', 'wall', 'pot', 'acorn', 'rock', 'enzo', 'dora', ...G.ACTORS];
/** 3 by 5 pixel digits */
const DIGITS = ['111101101101111', '010110010010111', '111001111100111', '111001111001111', '101101111001001', '111100111001111', '111100111101111', '111001001001001', '111101111101111', '111101111001111'];
const COLOUR: Record<G.Actor, string> = { hog: '#c8823a', frog: '#58b848', shroom: '#e04848', beetle: '#5a5a7a', snail: '#e8a030', mole: '#8a6a50', grumble: '#8a8a9a' };
type Bit = { x: number; y: number; vx: number; vy: number; t: number; life: number; c: string; s: number };
export type View = { board: Board; order: number[]; preview: { board: Board; steps: Step[] } | null; nap: number; sel: number; reduced: boolean };

export class OrderScene {
  private ctx: CanvasRenderingContext2D;
  private img: Record<string, HTMLImageElement> = {};
  private bits: Bit[] = [];
  /** a round being played: its steps, which one is showing and how far into it */
  private anim: { from: Piece[]; steps: Step[]; i: number; t: number; done: () => void; order: number[]; onStep?: (s: Step, i: number) => void } | null = null;
  private cheer = 0; private shake = 0;
  speed = 1;
  constructor(canvas: HTMLCanvasElement) {
    canvas.width = SW; canvas.height = SH;
    this.ctx = canvas.getContext('2d')!; this.ctx.imageSmoothingEnabled = false;
  }
  load() {
    return Promise.all(NAMES.map((n) => new Promise<void>((res) => {
      const im = new Image(); im.onload = () => res(); im.onerror = () => res(); im.src = `/art/order/${n}.png`; this.img[n] = im;
    })));
  }
  private ok(n: string) { const im = this.img[n]; return im && im.complete && im.naturalWidth > 0 ? im : null; }
  private put(n: string, x: number, y: number, flip = false, alpha = 1) {
    const im = this.ok(n); if (!im) return;
    const c = this.ctx, w = im.naturalWidth, h = im.naturalHeight, dx = Math.round(x - w / 2), dy = Math.round(y - h);
    c.globalAlpha = alpha;
    if (!flip) c.drawImage(im, dx, dy); else { c.save(); c.translate(dx + w, dy); c.scale(-1, 1); c.drawImage(im, 0, 0); c.restore(); }
    c.globalAlpha = 1;
  }
  get playing() { return !!this.anim; }
  /** play a round's steps from the board as it was; done() is called at the end */
  play(from: Board, order: number[], steps: Step[], done: () => void, onStep?: (s: Step, i: number) => void) { this.anim = { from: from.pieces.map((p) => ({ ...p })), steps, i: 0, t: 0, done, order, onStep }; }
  skip() { if (this.anim) this.anim.i = this.anim.steps.length; }
  /** the tile under a point on the canvas, or null */
  tileAt(x: number, y: number) { const tx = Math.floor((x - BX) / T), ty = Math.floor((y - BY) / T); return tx >= 0 && ty >= 0 && tx < G.W && ty < G.H ? { x: tx, y: ty } : null; }
  celebrate() { this.cheer = 2; for (let i = 0; i < 30; i++) this.burst(340, 150, 1, ['#f2c14e', '#ff7a8a', '#8ad0ff', '#fff'][i % 4], 120, 1.2); }

  private burst(x: number, y: number, n: number, c: string, sp: number, life: number) {
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = sp * (0.3 + Math.random() * 0.7); this.bits.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - sp * 0.3, t: 0, life: life * (0.6 + Math.random() * 0.6), c, s: Math.random() < 0.3 ? 2 : 1 }); }
  }
  /** effects as a step starts */
  private fx(s: Step, before: Piece[]) {
    const a = s.act, p = before.find((q) => q.id === a.id), cx = (q: Piece) => BX + q.x * T + 12, cy = (q: Piece) => BY + q.y * T + 12;
    if (!p) return;
    const tgt = a.target !== undefined ? before.find((q) => q.id === a.target) : undefined;
    switch (a.what) {
      case 'boom': this.burst(cx(p), cy(p), 40, '#ffb040', 160, 0.6); this.burst(cx(p), cy(p), 20, '#5a4a40', 90, 0.8); this.shake = 4; break;
      case 'eat': if (tgt) this.burst(cx(tgt), cy(tgt), 10, '#e8f0a0', 60, 0.4); break;
      case 'grow': { const n = s.pieces.find((q) => q.id === a.born); if (n) this.burst(cx(n), cy(n), 10, '#ffffff', 50, 0.4); break; }
      case 'pot': this.burst(BX + this.potX * T + 12, BY + this.potY * T + 8, 30, '#f2c14e', 110, 0.9); this.cheer = 2; break;
      case 'turn': this.burst(cx(p), cy(p) - 6, 8, '#ffe080', 50, 0.4); break;
      case 'wake': if (tgt) this.burst(cx(tgt), cy(tgt) - 8, 6, '#ffffff', 40, 0.4); break;
      case 'dig': this.burst(cx(p), cy(p) + 6, 14, '#7a5a3a', 70, 0.5); break;
      case 'grab': if (tgt) this.burst(cx(tgt), cy(tgt), 12, '#c0c0d0', 80, 0.5); break;
      case 'push': case 'turnback': this.burst(cx(p), cy(p) + 8, 4, '#e8e0c0', 30, 0.3); break;
    }
  }
  private potX = 0; private potY = 0;

  render(v: View, time: number, dt: number) {
    const c = this.ctx, b = v.board;
    this.potX = b.pot.x; this.potY = b.pot.y;
    // the round being played
    let pieces = b.pieces, acting = -1, k = 1, order = v.order, last: Piece[] | null = null;
    const an = this.anim;
    if (an) {
      order = an.order;
      if (an.i < an.steps.length) {
        const dur = 0.36 / this.speed;
        if (an.t === 0) { this.fx(an.steps[an.i], an.i ? an.steps[an.i - 1].pieces : an.from); an.onStep?.(an.steps[an.i], an.i); }
        an.t += dt;
        last = an.i ? an.steps[an.i - 1].pieces : an.from;
        pieces = an.steps[an.i].pieces; acting = an.steps[an.i].act.id; k = Math.min(1, an.t / (dur * 0.6));
        if (an.t >= dur) { an.i++; an.t = 0; }
      } else { const done = an.done; this.anim = null; done(); }
    }
    this.shake = Math.max(0, this.shake - dt * 16);
    c.save();
    if (this.shake && !v.reduced) c.translate(Math.round((Math.random() - 0.5) * this.shake), Math.round((Math.random() - 0.5) * this.shake));
    // the garden and the board
    const bg = this.ok('garden'); if (bg) c.drawImage(bg, 0, 0); else { c.fillStyle = '#4a8a3a'; c.fillRect(0, 0, SW, SH); }
    c.fillStyle = 'rgba(30,50,20,0.55)'; c.fillRect(BX - 3, BY - 3, G.W * T + 6, G.H * T + 6);
    const g1 = this.ok('grass1'), g2 = this.ok('grass2'), wall = this.ok('wall'), soil = this.ok('soil');
    for (let y = 0; y < G.H; y++) for (let x = 0; x < G.W; x++) {
      const px = BX + x * T, py = BY + y * T;
      const im = b.walls.includes(y * G.W + x) ? wall : b.pot.x === x && b.pot.y === y ? soil : (x + y) % 2 ? g2 : g1;
      if (im) c.drawImage(im, px, py);
    }
    // soften the grass so the critters stand out
    c.fillStyle = 'rgba(20,40,10,0.18)'; c.fillRect(BX, BY, G.W * T, G.H * T);
    this.put('pot', BX + b.pot.x * T + 12, BY + b.pot.y * T + 23);
    // the selected critter's tile
    const selP = pieces.find((p) => p.id === v.sel);
    if (selP && !an) { c.strokeStyle = '#fff4a0'; c.lineWidth = 1; c.strokeRect(BX + selP.x * T + 0.5, BY + selP.y * T + 0.5, T - 1, T - 1); }
    // the ghost of the coming round
    if (v.preview && !an) this.ghost(v.board, v.preview);
    // the pieces, back to front
    const drawn = [...pieces].sort((p, q) => p.y - q.y);
    for (const p of drawn) {
      const was = last?.find((q) => q.id === p.id);
      const ix = was ? was.x + (p.x - was.x) * ease(k) : p.x, iy = was ? was.y + (p.y - was.y) * ease(k) : p.y;
      const x = BX + ix * T + 12, y = BY + iy * T + 22;
      if (p.id === acting) { c.fillStyle = 'rgba(255,240,140,0.5)'; c.fillRect(BX + ix * T + 1, BY + iy * T + 1, T - 2, T - 2); }
      const hop = p.id === acting ? -Math.round(Math.sin(Math.min(1, k) * Math.PI) * 3) : 0;
      const shiver = p.k === 'mole' && p.awake ? Math.round(Math.sin(time * 40)) : 0;
      this.put(p.k, x + shiver, y + hop, p.f === 3 && (p.k === 'hog' || p.k === 'snail' || p.k === 'grumble'), v.nap === p.id && !an ? 0.6 : 1);
      if (p.k === 'mole' && !p.awake) this.zz(x + 6, y - 14, time);
      if (G.isActor(p.k) && G.CRITTERS[p.k].faces) this.chevron(BX + ix * T, BY + iy * T, p.f, COLOUR[p.k]);
    }
    // pieces that were there before this step but aren't now fade out where they were
    if (last && an) for (const p of last) if (!pieces.some((q) => q.id === p.id)) this.put(p.k, BX + p.x * T + 12, BY + p.y * T + 22, false, Math.max(0, 1 - k));
    // the queue numbers, in the top-left corner of each tile
    order.forEach((id, i) => {
      const p = pieces.find((q) => q.id === id); if (!p) return;
      const was = last?.find((q) => q.id === p.id);
      const ix = was ? was.x + (p.x - was.x) * ease(k) : p.x, iy = was ? was.y + (p.y - was.y) * ease(k) : p.y;
      const flash = p.id === acting && Math.floor(time * 10) % 2 === 0;
      this.badge(BX + ix * T, BY + iy * T, i + 1, flash ? '#fff4a0' : v.nap === id && !an ? '#7a8ab8' : COLOUR[p.k as G.Actor] ?? '#444');
    });
    c.restore();
    // Enzo conducts, Dora waits with her basket
    const playing = !!an;
    const beat = playing ? Math.round(Math.sin(time * 9) * 2) : Math.round(Math.sin(time * 1.6));
    this.put('enzo', 46, 206 + Math.min(0, beat), playing && Math.sin(time * 4.5) < 0);
    this.cheer = Math.max(0, this.cheer - dt);
    const jump = this.cheer > 0 ? -Math.round(Math.abs(Math.sin(this.cheer * 8)) * 10) : 0;
    this.put('dora', 340, 206 + jump, true);
    // particles
    for (const p of this.bits) { p.t += dt; p.vy += 220 * dt; p.x += p.vx * dt; p.y += p.vy * dt; c.globalAlpha = Math.max(0, 1 - p.t / p.life); c.fillStyle = p.c; c.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s); }
    c.globalAlpha = 1; this.bits = this.bits.filter((p) => p.t < p.life);
  }

  /** what the coming round will do: dotted paths to where things end up, ghosts there, and crosses on what goes */
  private ghost(b: Board, pv: { board: Board; steps: Step[] }) {
    const c = this.ctx, end = pv.steps.length ? pv.steps[pv.steps.length - 1].pieces : b.pieces;
    for (const p of b.pieces) {
      const q = end.find((e) => e.id === p.id);
      const x0 = BX + p.x * T + 12, y0 = BY + p.y * T + 12;
      if (!q) {
        // a red cross: this one won't survive the round (or, for the acorn going into the pot, a gold ring)
        if (p.k === 'acorn' && pv.board.potted) continue;
        c.strokeStyle = p.k === 'acorn' ? '#ff3030' : 'rgba(230,60,60,0.85)'; c.lineWidth = 2;
        c.beginPath(); c.moveTo(x0 - 7, y0 - 7); c.lineTo(x0 + 7, y0 + 7); c.moveTo(x0 + 7, y0 - 7); c.lineTo(x0 - 7, y0 + 7); c.stroke();
        continue;
      }
      if (q.x === p.x && q.y === p.y) continue;
      const x1 = BX + q.x * T + 12, y1 = BY + q.y * T + 12;
      c.fillStyle = p.k === 'acorn' ? '#ffe060' : 'rgba(255,255,255,0.75)';
      const n = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0) / 4));
      for (let i = 1; i < n; i++) c.fillRect(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), 2, 2);
      this.put(p.k, x1, BY + q.y * T + 22, q.f === 3 && (p.k === 'hog' || p.k === 'snail' || p.k === 'grumble'), 0.4);
    }
    // the acorn's fate, round the pot or round the acorn
    if (pv.board.potted) { c.strokeStyle = '#ffe060'; c.lineWidth = 2; c.strokeRect(BX + b.pot.x * T + 1, BY + b.pot.y * T + 1, T - 2, T - 2); }
    // new mushrooms
    for (const q of end) if (!b.pieces.some((p) => p.id === q.id)) this.put(q.k, BX + q.x * T + 12, BY + q.y * T + 22, false, 0.4);
  }
  private badge(x: number, y: number, n: number, col: string) {
    const c = this.ctx, s = String(n), w = s.length * 4 + 3;
    c.fillStyle = '#1a1410'; c.fillRect(x, y, w + 1, 8);
    c.fillStyle = col; c.fillRect(x, y, w, 7);
    c.fillStyle = '#1a1410';
    for (let d = 0; d < s.length; d++) { const bits = DIGITS[+s[d]]; for (let i = 0; i < 15; i++) if (bits[i] === '1') c.fillRect(x + 2 + d * 4 + (i % 3), y + 1 + Math.floor(i / 3), 1, 1); }
  }
  /** which way a critter faces: a white arrowhead at that edge of its tile, outlined in its verb's colour */
  private chevron(x: number, y: number, f: G.Dir, col: string) {
    const c = this.ctx;
    // the arrowhead pointing up, as rows of pixels from its tip, then turned to face f
    const rows = [[0, 0], [-1, 1], [-2, 2], [-3, 3]];
    const put = (dx: number, dy: number) => { const [rx, ry] = [[dx, dy], [-dy, dx], [-dx, -dy], [dy, -dx]][f]; c.fillRect(x + 12 + rx, y + 12 + ry, 1, 1); };
    c.fillStyle = col;
    rows.forEach(([a, b], i) => { for (let d = a - 1; d <= b + 1; d++) put(d, -12 + i); });
    for (let d = -4; d <= 4; d++) put(d, -8);
    c.fillStyle = '#ffffff';
    rows.forEach(([a, b], i) => { for (let d = a; d <= b; d++) put(d, -11 + i); });
  }
  private zz(x: number, y: number, time: number) {
    const c = this.ctx, k = (time * 0.8) % 1;
    c.globalAlpha = 1 - k; c.fillStyle = '#ffffff';
    const zx = Math.round(x + k * 4), zy = Math.round(y - k * 6);
    c.fillRect(zx, zy, 3, 1); c.fillRect(zx + 1, zy + 1, 1, 1); c.fillRect(zx, zy + 2, 3, 1);
    c.globalAlpha = 1;
  }
}
const ease = (k: number) => 1 - (1 - k) * (1 - k);
