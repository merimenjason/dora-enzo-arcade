// Clatterbox's drawing (Canvas 2D only): the inside of the cardboard box, every part in cardboard and household
// bits (corrugated edges, masking tape on the fixed parts, bottle caps, string, brass split pins, marker doodles), the
// ghost trail of the last run, impact puffs and marker-lettered clacks, the payoffs (the bell swings, the hedgehog
// yawns and waves, the sparrow pecks, the lantern glows, the train toots), and Dora, Enzo and the neighbours as
// cardboard cut-out puppets joined with split pins. Nothing here changes the game.
import { build, type Run, type Part, type Puzzle, type Place, type PartId, type Ev } from './clatter-game';
import { World } from './clatter-physics';

export type Pose = 'idle' | 'watch' | 'wince' | 'cheer' | 'point' | 'think' | 'wave';
export type Who = 'dora' | 'enzo' | 'hedgehog' | 'rabbit' | 'mouse' | 'owl' | 'badger';
type Rect = { x: number; y: number; w: number; h: number };
type Fx = { k: Ev['k']; x: number; y: number; t: number; s: number; seed: number };
export type DrawState = {
  dt: number; run: Run; P: Puzzle; running: boolean; ghost: number[][] | null;
  sel: number; bad: number; hover: Place | null; hoverBad: boolean; hint: Place | null;
  dora: Pose; enzo: Pose; look: [number, number] | null; winT: number; zones: boolean; audience: boolean; guide: [number, number] | null;
};

const TAU = Math.PI * 2;
const INK = '#3b2a1e';
const CARD = '#c89a62', CARD_D = '#9c7240', CARD_L = '#e2bd86';
const TAPE = 'rgba(246,236,200,0.78)';
const BRASS = '#d6a840';
const hash = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

export class ClatterScene {
  cv: HTMLCanvasElement; ctx: CanvasRenderingContext2D;
  W = 0; H = 0; dpr = 1;
  /** Room kept clear at each edge (the bar, the tray, a result card). */
  inset = { top: 8, right: 8, bottom: 8, left: 8 };
  /** The board's place on screen, its scale (pixels a unit), the puppets' places and size, and whether they stand below the board. */
  lay = { board: { x: 0, y: 0, w: 1, h: 1 } as Rect, s: 40, dora: [0, 0] as [number, number], enzo: [0, 0] as [number, number], ps: 60, below: false };
  /** The part of the board in view (board units): all of it, or a closer window that follows the chain. */
  view = { x: 0, y: 0, w: 12, h: 7 };
  private camX = -1; private zoom = 1;
  private fx: Fx[] = [];
  private time = 0;
  private bw = 12; private bh = 7;
  private grain: CanvasPattern | null = null;
  constructor(cv: HTMLCanvasElement) {
    this.cv = cv; const c = cv.getContext('2d'); if (!c) throw new Error('no canvas'); this.ctx = c;
    this.grain = makeGrain(c);
  }
  resize() {
    const r = this.cv.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1);
    this.dpr = d; this.W = Math.max(1, r.width); this.H = Math.max(1, r.height);
    const w = Math.round(this.W * d), h = Math.round(this.H * d);
    if (this.cv.width !== w || this.cv.height !== h) { this.cv.width = w; this.cv.height = h; }
  }
  /** Fits the board (and the puppets beside or below it) into the clear area. */
  layout(P: Puzzle) {
    this.bw = P.W; this.bh = P.H;
    const I = this.inset, aw = this.W - I.left - I.right, ah = this.H - I.top - I.bottom;
    const wide = aw / Math.max(1, ah) > 1.15;
    // puppets beside the board on wide screens, a little row below it on tall ones
    const side = wide ? Math.min(aw * 0.15, ah * 0.42) : 0;
    let s = Math.min((aw - side * 2) / P.W, (wide ? ah : ah * 0.78) / P.H);
    s = Math.max(4, s);
    const bwpx = P.W * s, bhpx = P.H * s;
    const below = !wide;
    const bx = I.left + (aw - bwpx) / 2, by = I.top + (below ? Math.max(0, (ah - bhpx - Math.min(ah - bhpx, 180, bwpx * 0.46)) / 2) : (ah - bhpx) / 2);
    const board = { x: bx, y: by, w: bwpx, h: bhpx };
    let ps: number, dora: [number, number], enzo: [number, number];
    if (below) {
      const room = Math.max(40, I.top + ah - (by + bhpx));
      ps = Math.min(room * 0.92, 170, bwpx * 0.42);
      dora = [bx + ps * 0.55, by + bhpx + ps * 0.98]; enzo = [bx + bwpx - ps * 0.55, by + bhpx + ps * 0.98];
    } else {
      ps = Math.max(60, Math.min(side * 1.15, bhpx * 0.62, 300));
      dora = [bx - ps * 0.42, by + bhpx - ps * 0.04]; enzo = [bx + bwpx + ps * 0.42, by + bhpx - ps * 0.04];
    }
    this.lay = { board, s, dora, enzo, ps, below };
  }
  /** Screen point of a board point (with the current view). */
  sx(x: number) { const B = this.lay.board; return B.x + ((x - this.view.x) / this.view.w) * B.w; }
  sy(y: number) { const B = this.lay.board; return B.y + (1 - (y - this.view.y) / this.view.h) * B.h; }
  get k() { return this.lay.board.w / this.view.w; }
  /** Board point under a screen point. */
  toBoard(px: number, py: number): [number, number] { const B = this.lay.board; return [this.view.x + ((px - B.x) / B.w) * this.view.w, this.view.y + (1 - (py - B.y) / B.h) * this.view.h]; }
  inBoard(px: number, py: number) { const B = this.lay.board; return px >= B.x - 6 && px <= B.x + B.w + 6 && py >= B.y - 6 && py <= B.y + B.h + 6; }
  /** Index of the placed part under a screen point, or -1. */
  hitPlaced(run: Run, px: number, py: number): number {
    const [x, y] = this.toBoard(px, py), pad = Math.max(0.2, 18 / this.k);
    let best = -1, bd = Infinity;
    for (const q of run.B.parts) {
      if (q.role !== 'placed') continue;
      for (const b of [q.body, ...q.extra]) {
        if (x < b.minX - pad || x > b.maxX + pad || y < b.minY - pad || y > b.maxY + pad) continue;
        const d = Math.hypot(x - b.x, y - b.y); if (d < bd) { bd = d; best = q.idx; }
      }
    }
    return best;
  }
  /** Draws one part alone, filling the canvas: the tray's pictures. */
  icon(p: PartId) {
    this.resize();
    const c = this.ctx, d = this.dpr, w = new World(), q = build(w, w.add([], { isStatic: true }), { p, x: 0, y: 0, r: 0, f: 0 }, 'placed', -1);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const b of [q.body, ...q.extra]) { x0 = Math.min(x0, b.minX); y0 = Math.min(y0, b.minY); x1 = Math.max(x1, b.maxX); y1 = Math.max(y1, b.maxY); }
    if (p === 'candle') y1 += 0.5; if (p === 'fan') x1 += 0.3; if (p === 'scissors') { y0 -= 0.3; x0 -= 0.4; x1 += 0.4; }
    const pad = 0.15, bw = x1 - x0 + pad * 2, bh = y1 - y0 + pad * 2, k = Math.min(this.W / bw, this.H / bh);
    const vw = this.W / k, vh = this.H / k;
    this.lay = { ...this.lay, board: { x: 0, y: 0, w: this.W, h: this.H } };
    this.view = { x: (x0 + x1) / 2 - vw / 2, y: (y0 + y1) / 2 - vh / 2, w: vw, h: vh };
    c.setTransform(d, 0, 0, d, 0, 0); c.clearRect(0, 0, this.W, this.H);
    this.part(q, null);
  }
  /** Adds the effects for a run's events. */
  events(evs: Ev[]) { for (const e of evs) this.fx.push({ k: e.k, x: e.x, y: e.y, t: 0, s: e.s, seed: this.fx.length + e.x * 13 + e.y * 7 }); if (this.fx.length > 90) this.fx.splice(0, this.fx.length - 90); }
  clearFx() { this.fx = []; this.camX = -1; this.zoom = 1; }

  draw(st: DrawState) {
    const c = this.ctx, d = this.dpr;
    this.time += st.dt;
    c.setTransform(d, 0, 0, d, 0, 0);
    this.backdrop();
    // the camera: on a big board it closes in on the chain while it runs
    const P = st.P, big = P.W > 16;
    const wantZoom = big && st.running && st.winT < 0 ? 1.45 : 1;
    this.zoom += (wantZoom - this.zoom) * Math.min(1, st.dt * 2.2);
    const vw = P.W / this.zoom, vh = P.H / this.zoom;
    const hot = st.run.hot[0];
    if (this.camX < 0) this.camX = hot;
    this.camX += (hot - this.camX) * Math.min(1, st.dt * 2.5);
    this.view = { x: Math.max(0, Math.min(P.W - vw, this.camX - vw / 2)), y: 0, w: vw, h: vh };
    this.boardBack(P);
    const B = this.lay.board;
    c.save(); c.beginPath(); c.rect(B.x, B.y, B.w, B.h); c.clip();
    if (st.zones && !st.running) this.zones(P);
    if (st.ghost) this.trail(st.ghost, 'rgba(70,90,160,0.42)');
    if (st.running) this.trail(st.run.trails, 'rgba(200,70,40,0.22)');
    this.strings(st.run);
    if (st.run.B.token) this.token(st.run, st);
    // fixed parts first, then the placed ones on top
    for (const q of st.run.B.parts) if (q.role === 'fixed') this.part(q, st);
    for (const q of st.run.B.parts) if (q.role === 'placed') this.part(q, st);
    if (st.hover) this.ghostPart(st.hover, st.hoverBad ? 'bad' : 'ok');
    if (st.hint && !st.running) this.ghostPart(st.hint, 'hint');
    if (st.guide && !st.running) this.guide(st.guide);
    this.effects(st.dt);
    c.restore();
    this.boardFrame(P);
    if (big && this.zoom > 1.05) this.minimap(P, st.run);
    // the puppets
    const look = st.look, L = this.lay;
    const lookD: [number, number] | null = look ? [this.sx(look[0]), this.sy(look[1])] : null;
    puppet(c, 'dora', L.dora[0], L.dora[1], L.ps, 1, st.dora, this.time, lookD);
    puppet(c, 'enzo', L.enzo[0], L.enzo[1], L.ps * 1.06, -1, st.enzo, this.time + 1.7, lookD);
    if (st.audience) this.audience(st.winT);
  }

  // ---------------------------------------------------------------- the box
  private backdrop() {
    const c = this.ctx, W = this.W, H = this.H;
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#7a5232'); g.addColorStop(0.55, '#8e6038'); g.addColorStop(1, '#5e3c22');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    // the corrugated back wall of the big box
    c.globalAlpha = 0.09; c.strokeStyle = '#2a1608'; c.lineWidth = 2;
    for (let x = (this.time * 0) % 14; x < W; x += 14) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); }
    c.globalAlpha = 1;
    if (this.grain) { c.fillStyle = this.grain; c.globalAlpha = 0.5; c.fillRect(0, 0, W, H); c.globalAlpha = 1; }
    // a warm lamp from the upper left
    const lg = c.createRadialGradient(W * 0.18, -H * 0.1, 10, W * 0.18, -H * 0.1, Math.max(W, H) * 1.05);
    lg.addColorStop(0, 'rgba(255,214,150,0.38)'); lg.addColorStop(0.5, 'rgba(255,190,120,0.08)'); lg.addColorStop(1, 'rgba(0,0,0,0.28)');
    c.fillStyle = lg; c.fillRect(0, 0, W, H);
    // marker doodles in the corners of the box
    c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
    doodle(c, 'star', W * 0.04, H * 0.12, Math.min(W, H) * 0.035, '#c8463a');
    doodle(c, 'spiral', W * 0.95, H * 0.1, Math.min(W, H) * 0.03, '#3a7a8a');
    doodle(c, 'sun', W * 0.93, H * 0.9, Math.min(W, H) * 0.035, '#d8a030');
    doodle(c, 'arrow', W * 0.06, H * 0.88, Math.min(W, H) * 0.04, '#4a6ab0');
    c.restore();
  }
  private boardBack(P: Puzzle) {
    const c = this.ctx, B = this.lay.board;
    // a soft shadow under the diorama, then its back wall: lighter card, with flutes showing through
    c.save(); c.shadowColor = 'rgba(30,14,4,0.55)'; c.shadowBlur = 26; c.shadowOffsetY = 10;
    c.fillStyle = '#d8b07a'; c.fillRect(B.x, B.y, B.w, B.h); c.restore();
    const g = c.createLinearGradient(B.x, B.y, B.x + B.w * 0.4, B.y + B.h); g.addColorStop(0, '#ecca94'); g.addColorStop(1, '#d4a970');
    c.fillStyle = g; c.fillRect(B.x, B.y, B.w, B.h);
    c.save(); c.beginPath(); c.rect(B.x, B.y, B.w, B.h); c.clip();
    c.globalAlpha = 0.07; c.strokeStyle = '#5a3412'; c.lineWidth = 1.5;
    const step = Math.max(5, this.k * 0.16), off = ((-this.view.x * this.k) % step + step) % step;
    for (let x = B.x + off; x < B.x + B.w; x += step) { c.beginPath(); c.moveTo(x, B.y); c.lineTo(x, B.y + B.h); c.stroke(); }
    c.globalAlpha = 1;
    if (this.grain) { c.fillStyle = this.grain; c.globalAlpha = 0.35; c.fillRect(B.x, B.y, B.w, B.h); c.globalAlpha = 1; }
    // pencil grid marks every unit, very faint, like a cutting mat
    c.strokeStyle = 'rgba(90,60,30,0.08)'; c.lineWidth = 1;
    for (let x = Math.ceil(this.view.x); x <= this.view.x + this.view.w; x++) { const px = this.sx(x); c.beginPath(); c.moveTo(px, B.y); c.lineTo(px, B.y + B.h); c.stroke(); }
    for (let y = 1; y < P.H; y++) { const py = this.sy(y); c.beginPath(); c.moveTo(B.x, py); c.lineTo(B.x + B.w, py); c.stroke(); }
    // a few doodles on the wall itself
    c.lineCap = 'round';
    for (let i = 0; i < Math.ceil(P.W / 6); i++) {
      const x = this.sx(2.5 + i * 6 + hash(i) * 2), y = this.sy(P.H - 0.8 - hash(i + 9) * 1.2), r = this.k * 0.28;
      c.globalAlpha = 0.28; doodle(c, (['star', 'spiral', 'heart', 'sun'] as const)[i % 4], x, y, r, ['#b04a3a', '#3a6a8a', '#b04a7a', '#c08a20'][i % 4]); c.globalAlpha = 1;
    }
    // the floor of the box: the bottom flap, with its cut edge
    const fy = this.sy(0), fh = this.lay.board.y + this.lay.board.h - fy;
    if (fh > 0) { c.fillStyle = '#b8864e'; c.fillRect(B.x, fy, B.w, fh); }
    c.restore();
  }
  private boardFrame(P: Puzzle) {
    const c = this.ctx, B = this.lay.board, t = Math.max(6, this.k * 0.22);
    // the box's corrugated cut edge all round
    c.save();
    c.fillStyle = CARD_D;
    c.fillRect(B.x - t, B.y - t, B.w + t * 2, t); c.fillRect(B.x - t, B.y + B.h, B.w + t * 2, t);
    c.fillRect(B.x - t, B.y, t, B.h); c.fillRect(B.x + B.w, B.y, t, B.h);
    flutes(c, B.x - t, B.y - t, B.w + t * 2, t, true); flutes(c, B.x - t, B.y + B.h, B.w + t * 2, t, true);
    flutes(c, B.x - t, B.y, t, B.h, false); flutes(c, B.x + B.w, B.y, t, B.h, false);
    // masking tape on the corners
    tape(c, B.x - t * 0.6, B.y - t * 0.4, t * 3.4, t * 1.3, -0.6);
    tape(c, B.x + B.w + t * 0.6, B.y - t * 0.4, t * 3.4, t * 1.3, 0.6);
    c.restore();
    void P;
  }
  private minimap(P: Puzzle, run: Run) {
    const c = this.ctx, B = this.lay.board, w = Math.min(160, B.w * 0.22), h = (w * P.H) / P.W, x = B.x + B.w - w - 10, y = B.y + 10;
    c.save(); c.globalAlpha = 0.85; c.fillStyle = '#f2e2c0'; roundRect(c, x - 3, y - 3, w + 6, h + 6, 6); c.fill(); c.strokeStyle = CARD_D; c.lineWidth = 1.5; c.stroke();
    c.globalAlpha = 1;
    for (const q of run.B.parts) {
      const b = q.body; if (q.p === 'string') continue;
      c.fillStyle = q.role === 'placed' ? '#c84a3a' : b.isStatic ? '#9c7240' : '#4a6ab0';
      c.fillRect(x + (b.x / P.W) * w - 1.5, y + (1 - b.y / P.H) * h - 1.5, 3, 3);
    }
    c.strokeStyle = '#c84a3a'; c.lineWidth = 2; c.strokeRect(x + (this.view.x / P.W) * w, y + (1 - (this.view.y + this.view.h) / P.H) * h, (this.view.w / P.W) * w, (this.view.h / P.H) * h);
    c.restore();
  }
  private zones(P: Puzzle) {
    const c = this.ctx;
    c.save(); c.setLineDash([this.k * 0.18, this.k * 0.12]); c.lineWidth = Math.max(1.5, this.k * 0.035); c.strokeStyle = 'rgba(40,90,170,0.55)'; c.fillStyle = 'rgba(120,170,230,0.10)';
    for (const [x0, y0, x1, y1] of P.zones) {
      const x = this.sx(x0), y = this.sy(y1), w = this.sx(x1) - x, h = this.sy(y0) - y;
      roundRect(c, x, y, w, h, Math.min(10, this.k * 0.2)); c.fill(); c.stroke();
    }
    c.restore();
  }
  private trail(tr: number[][], col: string) {
    const c = this.ctx;
    c.save(); c.strokeStyle = col; c.lineWidth = Math.max(1.5, this.k * 0.045); c.setLineDash([this.k * 0.08, this.k * 0.1]); c.lineCap = 'round';
    for (const t of tr) {
      if (t.length < 4) continue;
      c.beginPath(); c.moveTo(this.sx(t[0]), this.sy(t[1]));
      for (let i = 2; i < t.length; i += 2) c.lineTo(this.sx(t[i]), this.sy(t[i + 1]));
      c.stroke();
    }
    c.restore();
  }
  private strings(run: Run) {
    const c = this.ctx, w = run.B.world;
    c.save(); c.lineCap = 'round';
    for (const s of run.B.strings) {
      if (s.j.off) continue;
      const [ax, ay, bx, by] = w.ends(s.j);
      const x0 = this.sx(ax), y0 = this.sy(ay), x1 = this.sx(bx), y1 = this.sy(by);
      c.strokeStyle = '#6a5034'; c.lineWidth = Math.max(2, this.k * 0.05); line(c, x0, y0, x1, y1);
      c.strokeStyle = '#e8d8b0'; c.lineWidth = Math.max(1, this.k * 0.025); line(c, x0, y0, x1, y1);
      // a scorch where a flame is at it
      if (s.burn > 0) { c.fillStyle = `rgba(255,${120 + 100 * Math.sin(this.time * 30)},40,0.8)`; const m = 0.5; c.beginPath(); c.arc(x0 + (x1 - x0) * m, y0 + (y1 - y0) * m, this.k * 0.06, 0, TAU); c.fill(); }
      // a little tape where it's tied to the box
      if (s.j.A.isStatic) tape(c, x0, y0, this.k * 0.4, this.k * 0.16, 0.3);
    }
    // pulley cords
    for (const q of run.B.parts) {
      if (q.p !== 'pulley') continue;
      const j = q.joints[0], [ax, ay, bx, by] = w.ends(j);
      c.strokeStyle = '#6a5034'; c.lineWidth = Math.max(2, this.k * 0.05);
      line(c, this.sx(ax), this.sy(ay), this.sx(j.g1x), this.sy(j.g1y)); line(c, this.sx(bx), this.sy(by), this.sx(j.g2x), this.sy(j.g2y));
      line(c, this.sx(j.g1x), this.sy(j.g1y + 0.28), this.sx(j.g2x), this.sy(j.g2y + 0.28));
    }
    c.restore();
  }
  private token(run: Run, st: DrawState) {
    const c = this.ctx, b = run.B.token!, got = run.token, k = this.k;
    const age = got ? (run.steps - run.tokenAt) / 60 : -1;
    if (got && age > 0.8) return;
    const x = this.sx(b.x), y = this.sy(b.y), r = k * 0.3 * (got ? 1 + age * 1.4 : 1 + 0.06 * Math.sin(this.time * 3));
    c.save(); c.globalAlpha = got ? Math.max(0, 1 - age / 0.8) : 1;
    c.shadowColor = 'rgba(40,20,0,0.4)'; c.shadowBlur = k * 0.12; c.shadowOffsetY = k * 0.05;
    const g = c.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r); g.addColorStop(0, '#ffe680'); g.addColorStop(1, '#e0a020');
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); c.shadowColor = 'transparent';
    c.strokeStyle = '#a86a10'; c.lineWidth = Math.max(1.5, k * 0.04); c.beginPath(); c.arc(x, y, r * 0.72, 0, TAU); c.stroke();
    c.fillStyle = '#8a5408';
    for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { c.beginPath(); c.arc(x + dx * r * 0.22, y + dy * r * 0.22, r * 0.1, 0, TAU); c.fill(); }
    c.restore();
    void st;
  }
  private guide(p: [number, number]) {
    const c = this.ctx, x = this.sx(p[0]), y = this.sy(p[1]), r = this.k * (0.5 + 0.12 * Math.sin(this.time * 4));
    c.save(); c.strokeStyle = 'rgba(220,60,40,0.85)'; c.lineWidth = Math.max(2, this.k * 0.06); c.setLineDash([this.k * 0.12, this.k * 0.08]);
    c.beginPath(); c.arc(x, y, r, 0, TAU); c.stroke(); c.restore();
  }

  // ---------------------------------------------------------------- parts
  private ghostPart(pl: Place, mode: 'ok' | 'bad' | 'hint') {
    const c = this.ctx;
    c.save(); c.globalAlpha = mode === 'hint' ? 0.35 + 0.15 * Math.sin(this.time * 4) : 0.55;
    const w = new World(), fake = build(w, w.add([], { isStatic: true }), pl, 'placed', -1);
    this.part(fake, null);
    if (mode !== 'ok') {
      c.globalAlpha = 0.5; c.strokeStyle = mode === 'bad' ? '#e03020' : '#2a8a40'; c.lineWidth = 3; c.setLineDash([6, 5]);
      c.beginPath(); c.arc(this.sx(pl.x), this.sy(pl.y), this.k * 0.75, 0, TAU); c.stroke();
    }
    c.restore();
  }
  private part(q: Part, st: DrawState | null) {
    if (q.gone && q.p === 'balloon') return;
    const c = this.ctx, k = this.k, b = q.body, x = this.sx(b.x), y = this.sy(b.y), a = -b.a, t = this.time;
    const sel = st && q.role === 'placed' && st.sel === q.idx, bad = st && q.role === 'placed' && st.bad === q.idx;
    c.save();
    if (sel || bad) { c.shadowColor = bad ? 'rgba(230,40,30,0.95)' : 'rgba(255,230,120,0.95)'; c.shadowBlur = k * 0.35; }
    switch (q.p) {
      case 'shelf': case 'ramp': case 'plank': {
        const w = q.w * k, h = q.h * k;
        c.translate(x, y); c.rotate(a); drop(c, k);
        if (q.p === 'plank') { ruler(c, w, h); }
        else { board(c, w, h); }
        c.shadowColor = 'transparent';
        if (q.role === 'fixed') {
          // a strip of masking tape across each end of the long side
          const along = w >= h, L = Math.max(w, h), S = Math.min(w, h), tw = Math.min(k * 0.34, L * 0.3), th = S + k * 0.16, e = L / 2 - tw * 0.7;
          for (const sg of [-1, 1]) along ? tape(c, sg * e, 0, tw, th, sg * 0.12) : tape(c, 0, sg * e, th, tw, sg * 0.12);
        }
        break;
      }
      case 'marble': {
        const r = 0.22 * k; drop(c, k);
        const g = c.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r); g.addColorStop(0, '#e8f6ff'); g.addColorStop(0.5, '#6fb8e0'); g.addColorStop(1, '#245a8a');
        c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); c.shadowColor = 'transparent';
        c.save(); c.translate(x, y); c.rotate(a); c.strokeStyle = 'rgba(240,120,60,0.85)'; c.lineWidth = r * 0.28; c.beginPath(); c.arc(0, 0, r * 0.55, 0.3, 2.4); c.stroke(); c.restore();
        c.fillStyle = 'rgba(255,255,255,0.85)'; c.beginPath(); c.ellipse(x - r * 0.38, y - r * 0.42, r * 0.22, r * 0.13, -0.6, 0, TAU); c.fill();
        break;
      }
      case 'acorn': {
        const r = 0.26 * k; c.translate(x, y); c.rotate(a); drop(c, k);
        c.fillStyle = '#b86a2c'; c.beginPath(); c.ellipse(0, r * 0.18, r * 0.86, r * 0.92, 0, 0, TAU); c.fill(); c.shadowColor = 'transparent';
        c.fillStyle = '#d88a44'; c.beginPath(); c.ellipse(-r * 0.25, r * 0.15, r * 0.25, r * 0.5, 0, 0, TAU); c.fill();
        c.fillStyle = '#6a4424'; c.beginPath(); c.ellipse(0, -r * 0.38, r * 1.0, r * 0.5, 0, Math.PI, TAU); c.fill(); c.fillRect(-r, -r * 0.4, r * 2, r * 0.18);
        c.strokeStyle = '#4a2c14'; c.lineWidth = r * 0.1; for (let i = -2; i <= 2; i++) line(c, i * r * 0.32, -r * 0.4, i * r * 0.28 + r * 0.08, -r * 0.75);
        c.lineWidth = r * 0.2; c.lineCap = 'round'; line(c, 0, -r * 0.85, r * 0.15, -r * 1.15);
        break;
      }
      case 'domino': {
        const w = 0.24 * k, h = 1.2 * k; c.translate(x, y); c.rotate(a); drop(c, k);
        c.fillStyle = '#f4ead2'; roundRect(c, -w / 2, -h / 2, w, h, w * 0.25); c.fill(); c.shadowColor = 'transparent';
        c.strokeStyle = INK; c.lineWidth = Math.max(1, k * 0.025); c.stroke(); line(c, -w * 0.35, 0, w * 0.35, 0);
        c.fillStyle = INK; for (const yy of [-0.3, -0.18, 0.18, 0.3]) { c.beginPath(); c.arc(0, yy * h, w * 0.14, 0, TAU); c.fill(); }
        break;
      }
      case 'block': {
        const w = 0.72 * k, h = 0.5 * k; c.translate(x, y); c.rotate(a); drop(c, k);
        c.fillStyle = '#c8402e'; c.fillRect(-w / 2, -h / 2, w, h); c.shadowColor = 'transparent';
        c.fillStyle = '#f2d890'; c.fillRect(-w * 0.32, -h * 0.3, w * 0.64, h * 0.6); c.fillStyle = '#2a4a8a'; c.beginPath(); c.arc(0, 0, h * 0.16, 0, TAU); c.fill();
        c.strokeStyle = INK; c.lineWidth = Math.max(1, k * 0.025); c.strokeRect(-w / 2, -h / 2, w, h);
        break;
      }
      case 'seesaw': {
        // the fulcrum (fixed in place), then the plank turning on its split pin
        const tri = this.sy(b.y - 0.62);
        const px = this.sx(q.x), py = this.sy(q.y);
        c.save(); drop(c, k); c.fillStyle = CARD; c.beginPath(); c.moveTo(px - 0.42 * k, tri); c.lineTo(px + 0.42 * k, tri); c.lineTo(px, py); c.closePath(); c.fill();
        c.shadowColor = 'transparent'; c.strokeStyle = CARD_D; c.lineWidth = 2; c.stroke(); c.restore();
        c.translate(px, py); c.rotate(a);
        drop(c, k); board(c, 3.2 * k, 0.16 * k); c.shadowColor = 'transparent';
        c.fillStyle = '#e04a3a'; c.beginPath(); c.arc(-1.5 * k, -0.06 * k, 0.12 * k, Math.PI, TAU); c.fill(); c.beginPath(); c.arc(1.5 * k, -0.06 * k, 0.12 * k, Math.PI, TAU); c.fill();
        splitPin(c, 0, 0, k * 0.09);
        break;
      }
      case 'spring': {
        const sq = q.t > 0 ? 0.55 + 0.45 * Math.cos(q.t * 30) * (q.t / 0.35) : 1;
        c.translate(x, y); c.rotate(a); drop(c, k);
        const w = k, h = 0.3 * k;
        c.fillStyle = '#7a8a9a'; c.fillRect(-w / 2, h * 0.2, w, h * 0.3); c.shadowColor = 'transparent';
        c.strokeStyle = '#c0c8d0'; c.lineWidth = Math.max(1.5, k * 0.05); c.beginPath();
        for (let i = 0; i <= 8; i++) { const px = -w * 0.32 + (i / 8) * w * 0.64, py = h * 0.2 - (i % 2 ? h * 0.8 : 0) * sq; i ? c.lineTo(px, py) : c.moveTo(px, py); } c.stroke();
        // the bottle-cap pad
        c.fillStyle = '#d83a2a'; roundRect(c, -w / 2, -h * 0.5 - h * 0.6 * sq + h * 0.3, w, h * 0.45, h * 0.15); c.fill();
        c.fillStyle = '#ffd0a0'; c.fillRect(-w * 0.4, -h * 0.75 * sq, w * 0.8, h * 0.08);
        break;
      }
      case 'fan': {
        c.translate(x, y); c.rotate(a); if (q.f) c.scale(-1, 1); drop(c, k);
        const s = 0.45 * k;
        c.fillStyle = CARD; roundRect(c, -s, -s, s * 1.6, s * 2, s * 0.2); c.fill(); c.shadowColor = 'transparent'; c.strokeStyle = CARD_D; c.lineWidth = 2; c.stroke();
        c.fillStyle = '#3a6ab0'; c.beginPath(); c.arc(s * 0.6, 0, s * 0.82, 0, TAU); c.fill();
        c.save(); c.translate(s * 0.6, 0); c.rotate(t * 18); c.fillStyle = '#f2e6c8';
        for (let i = 0; i < 4; i++) { c.rotate(TAU / 4); c.beginPath(); c.ellipse(0, s * 0.38, s * 0.18, s * 0.36, 0, 0, TAU); c.fill(); }
        c.restore(); splitPin(c, s * 0.6, 0, s * 0.12);
        // airflow
        c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = Math.max(1, k * 0.03); c.setLineDash([k * 0.25, k * 0.25]); c.lineDashOffset = -t * k * 3;
        for (const dy of [-0.4, 0, 0.4]) { c.beginPath(); c.moveTo(s * 1.6, dy * k); c.bezierCurveTo(s * 3, dy * k + Math.sin(t * 3 + dy) * k * 0.1, s * 5, dy * k, s * 8, dy * k * 1.3); c.stroke(); }
        break;
      }
      case 'bellows': {
        c.translate(x, y); if (q.f) c.scale(-1, 1); drop(c, k);
        const w = 1.1 * k, h = 0.55 * k, sq = q.t > 0 ? 0.6 + 0.4 * (1 - q.t / 0.6) : 1;
        c.fillStyle = '#8a4a2a'; c.fillRect(-w / 2, h * 0.3, w, h * 0.2); c.shadowColor = 'transparent';
        c.fillStyle = '#d8a060'; c.beginPath(); c.moveTo(-w / 2, h * 0.3); c.lineTo(w * 0.3, h * 0.3); c.lineTo(w * 0.3, h * 0.3 - h * 0.8 * sq); c.lineTo(-w / 2, h * 0.3 - h * 0.5 * sq); c.closePath(); c.fill();
        c.strokeStyle = '#8a5a2a'; c.lineWidth = 1.5; for (let i = 1; i < 5; i++) { const xx = -w / 2 + (i / 5) * w * 0.8; line(c, xx, h * 0.3, xx, h * 0.3 - h * (0.5 + 0.3 * (i / 5)) * sq); }
        c.fillStyle = '#7a4a2a'; c.fillRect(-w / 2, h * 0.3 - h * 0.62 * sq, w * 0.82, h * 0.12);
        c.fillStyle = BRASS; c.beginPath(); c.moveTo(w * 0.3, h * 0.05); c.lineTo(w * 0.55, h * 0.15); c.lineTo(w * 0.55, h * 0.25); c.lineTo(w * 0.3, h * 0.3); c.fill();
        break;
      }
      case 'car': {
        c.translate(x, y); c.rotate(a); if (q.f) c.scale(-1, 1); drop(c, k);
        const w = k, h = 0.34 * k;
        c.fillStyle = '#2a8a7a'; roundRect(c, -w / 2, -h / 2 - h * 0.1, w, h, h * 0.3); c.fill(); c.shadowColor = 'transparent';
        c.fillStyle = '#e8c040'; roundRect(c, -w * 0.25, -h * 1.2, w * 0.45, h * 0.75, h * 0.2); c.fill();
        c.fillStyle = '#bfe4f0'; c.fillRect(-w * 0.18, -h * 1.05, w * 0.3, h * 0.42);
        c.strokeStyle = INK; c.lineWidth = 1.5; roundRect(c, -w / 2, -h / 2 - h * 0.1, w, h, h * 0.3); c.stroke();
        // the wind-up key turns while it drives
        c.save(); c.translate(-w * 0.5, -h * 0.2); c.rotate(q.on ? t * 12 : 0); c.fillStyle = BRASS; c.fillRect(-h * 0.5, -h * 0.08, h * 0.4, h * 0.16); c.beginPath(); c.ellipse(-h * 0.55, 0, h * 0.12, h * 0.3, 0, 0, TAU); c.fill(); c.restore();
        for (const wx of [-0.32, 0.32]) { const wy = 0.2 * k; c.fillStyle = '#2a2a2a'; c.beginPath(); c.arc(wx * k, wy, 0.15 * k, 0, TAU); c.fill(); c.fillStyle = '#d8d0c0'; c.beginPath(); c.arc(wx * k, wy, 0.06 * k, 0, TAU); c.fill(); }
        break;
      }
      case 'balloon': {
        const r = 0.42 * k; drop(c, k);
        const g = c.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r * 1.1); g.addColorStop(0, '#ff8a7a'); g.addColorStop(1, '#c81e28');
        c.fillStyle = g; c.beginPath(); c.ellipse(x, y - r * 0.05, r * 0.92, r * 1.05, 0, 0, TAU); c.fill(); c.shadowColor = 'transparent';
        c.fillStyle = '#a81820'; c.beginPath(); c.moveTo(x - r * 0.12, y + r * 1.08); c.lineTo(x + r * 0.12, y + r * 1.08); c.lineTo(x, y + r * 0.95); c.fill();
        c.fillStyle = 'rgba(255,255,255,0.7)'; c.beginPath(); c.ellipse(x - r * 0.35, y - r * 0.45, r * 0.16, r * 0.28, -0.5, 0, TAU); c.fill();
        break;
      }
      case 'pin': {
        c.translate(x, y); c.rotate(a); drop(c, k);
        c.fillStyle = '#c0c4c8'; c.beginPath(); c.moveTo(-0.03 * k, 0); c.lineTo(0.03 * k, 0); c.lineTo(0, -0.26 * k); c.fill(); c.shadowColor = 'transparent';
        c.fillStyle = '#e03a3a'; c.beginPath(); c.ellipse(0, 0.08 * k, 0.16 * k, 0.12 * k, 0, 0, TAU); c.fill();
        c.fillStyle = 'rgba(255,255,255,0.6)'; c.beginPath(); c.ellipse(-0.05 * k, 0.05 * k, 0.05 * k, 0.03 * k, 0, 0, TAU); c.fill();
        break;
      }
      case 'candle': {
        const w = 0.3 * k, h = 0.8 * k; c.translate(x, y); drop(c, k);
        c.fillStyle = '#f6eedc'; c.fillRect(-w / 2, -h / 2, w, h); c.shadowColor = 'transparent';
        c.fillStyle = '#e8dcc0'; c.fillRect(w * 0.1, -h / 2, w * 0.3, h);
        c.fillStyle = '#b84a2a'; c.fillRect(-w * 0.7, h * 0.42, w * 1.4, h * 0.08);
        c.strokeStyle = INK; c.lineWidth = 1.5; line(c, 0, -h / 2, 0, -h / 2 - k * 0.08);
        const fl = 1 + 0.12 * Math.sin(t * 17) + 0.08 * Math.sin(t * 29);
        const gl = c.createRadialGradient(0, -h / 2 - k * 0.18, 1, 0, -h / 2 - k * 0.18, k * 0.7); gl.addColorStop(0, 'rgba(255,200,90,0.55)'); gl.addColorStop(1, 'rgba(255,180,60,0)');
        c.fillStyle = gl; c.beginPath(); c.arc(0, -h / 2 - k * 0.18, k * 0.7, 0, TAU); c.fill();
        c.fillStyle = '#ffb030'; c.beginPath(); c.ellipse(0, -h / 2 - k * 0.2, k * 0.08, k * 0.16 * fl, 0, 0, TAU); c.fill();
        c.fillStyle = '#fff6c0'; c.beginPath(); c.ellipse(0, -h / 2 - k * 0.16, k * 0.035, k * 0.08 * fl, 0, 0, TAU); c.fill();
        break;
      }
      case 'scissors': {
        c.translate(x, y); c.rotate(a); drop(c, k);
        c.fillStyle = CARD; c.fillRect(-0.07 * k, 0, 0.14 * k, 1.62 * k); c.shadowColor = 'transparent';
        c.strokeStyle = CARD_D; c.lineWidth = 1.5; c.strokeRect(-0.07 * k, 0, 0.14 * k, 1.62 * k);
        // the scissors at its foot, snipping as it swings
        const open = 0.25 + 0.2 * Math.sin(t * 10) * Math.min(1, Math.abs(b.w));
        c.save(); c.translate(0, 1.72 * k);
        for (const sgn of [-1, 1]) { c.save(); c.rotate(sgn * open); c.fillStyle = '#c8ccd2'; c.beginPath(); c.moveTo(0, 0); c.lineTo(0.42 * k, -0.04 * k); c.lineTo(0, 0.06 * k); c.fill(); c.strokeStyle = sgn > 0 ? '#e03a3a' : '#3a6ab0'; c.lineWidth = 0.07 * k; c.beginPath(); c.ellipse(-0.18 * k, 0, 0.13 * k, 0.08 * k, 0, 0, TAU); c.stroke(); c.restore(); }
        splitPin(c, 0, 0, 0.05 * k); c.restore();
        splitPin(c, 0, 0, 0.1 * k);
        break;
      }
      case 'funnel': {
        // a paper cone from two boards
        c.save();
        for (const bb of [b, q.extra[0]]) { if (!bb) continue; c.save(); c.translate(this.sx(bb.x), this.sy(bb.y)); c.rotate(-bb.a); drop(c, k); c.fillStyle = '#f0e2c4'; c.fillRect(-0.65 * k, -0.07 * k, 1.3 * k, 0.14 * k); c.shadowColor = 'transparent'; c.strokeStyle = '#b89a6a'; c.lineWidth = 1.5; c.strokeRect(-0.65 * k, -0.07 * k, 1.3 * k, 0.14 * k); c.restore(); }
        c.restore();
        if (q.role === 'fixed') tape(c, this.sx(q.x), this.sy(q.y + 1.0), k * 0.5, k * 0.18, 0.1);
        break;
      }
      case 'bell': {
        c.translate(x, y); c.rotate(a);
        c.strokeStyle = INK; c.lineWidth = 2; line(c, 0, 0, 0, -this.sy(this.view.y + this.view.h) + this.sy(b.y) - 0);
        drop(c, k);
        const g = c.createLinearGradient(-0.4 * k, 0, 0.4 * k, 0); g.addColorStop(0, '#a8781e'); g.addColorStop(0.4, '#f6d470'); g.addColorStop(1, '#b8862a');
        c.fillStyle = g; c.beginPath(); c.moveTo(-0.26 * k, 0.12 * k); c.quadraticCurveTo(0, -0.12 * k, 0.26 * k, 0.12 * k); c.lineTo(0.42 * k, 0.72 * k); c.lineTo(-0.42 * k, 0.72 * k); c.closePath(); c.fill(); c.shadowColor = 'transparent';
        c.fillStyle = '#8a5a14'; c.beginPath(); c.arc(0, 0.76 * k, 0.1 * k, 0, TAU); c.fill();
        c.strokeStyle = '#7a4a10'; c.lineWidth = 1.5; c.stroke();
        splitPin(c, 0, 0, 0.09 * k);
        if (q.on) { c.strokeStyle = 'rgba(255,220,100,0.8)'; c.lineWidth = 2; const ph = (this.time * 2) % 1; for (const sgn of [-1, 1]) { c.beginPath(); c.arc(0, 0.4 * k, k * (0.6 + ph * 0.5), sgn > 0 ? -0.6 : Math.PI - 0.6 + 1.2 - 1.2, sgn > 0 ? 0.6 : Math.PI + 0.6); c.stroke(); } }
        break;
      }
      case 'trapdoor': {
        c.translate(x, y); c.rotate(a); drop(c, k); board(c, q.w * k, 0.16 * k); c.shadowColor = 'transparent';
        c.restore(); c.save(); splitPin(c, this.sx(q.x), this.sy(q.y), 0.1 * k);
        break;
      }
      case 'pulley': {
        const j = q.joints[0];
        for (const [gx, gy] of [[j.g1x, j.g1y], [j.g2x, j.g2y]]) { c.fillStyle = '#d83a2a'; c.beginPath(); c.arc(this.sx(gx), this.sy(gy), 0.3 * k, 0, TAU); c.fill(); c.strokeStyle = '#8a1a14'; c.lineWidth = 2; c.stroke(); splitPin(c, this.sx(gx), this.sy(gy), 0.08 * k); }
        // the paper-cup bucket and the wooden weight
        c.save(); c.translate(x, y); c.rotate(a); drop(c, k);
        c.fillStyle = '#f2f0ea'; c.beginPath(); c.moveTo(-0.62 * k, -0.3 * k); c.lineTo(0.62 * k, -0.3 * k); c.lineTo(0.5 * k, 0.36 * k); c.lineTo(-0.5 * k, 0.36 * k); c.closePath(); c.fill(); c.shadowColor = 'transparent';
        c.fillStyle = '#d84a3a'; c.fillRect(-0.56 * k, -0.05 * k, 1.12 * k, 0.12 * k); c.strokeStyle = '#8a8070'; c.lineWidth = 1.5; c.stroke();
        c.restore();
        const wb = q.extra[0];
        if (wb) { c.save(); c.translate(this.sx(wb.x), this.sy(wb.y)); c.rotate(-wb.a); drop(c, k); c.fillStyle = '#a8784a'; c.fillRect(-0.33 * k, -0.3 * k, 0.66 * k, 0.6 * k); c.shadowColor = 'transparent'; c.strokeStyle = '#6a4424'; c.lineWidth = 2; c.strokeRect(-0.33 * k, -0.3 * k, 0.66 * k, 0.6 * k); c.restore(); }
        break;
      }
      case 'hedgehog': hedgehog(c, x, y, k, q.f ? -1 : 1, q.on ? (this.time - 0) : -1, q.hitAt, this.time); break;
      case 'bowl': {
        drop(c, k);
        c.fillStyle = '#3a7ac8'; c.beginPath(); c.moveTo(x - 0.8 * k, y - 0.62 * k); c.lineTo(x + 0.8 * k, y - 0.62 * k); c.quadraticCurveTo(x + 0.75 * k, y, x + 0.5 * k, y); c.lineTo(x - 0.5 * k, y); c.quadraticCurveTo(x - 0.75 * k, y, x - 0.8 * k, y - 0.62 * k); c.fill(); c.shadowColor = 'transparent';
        c.fillStyle = '#2a5a98'; c.beginPath(); c.ellipse(x, y - 0.62 * k, 0.8 * k, 0.12 * k, 0, 0, TAU); c.fill();
        c.fillStyle = '#ffffff55'; c.fillRect(x - 0.6 * k, y - 0.5 * k, 0.12 * k, 0.35 * k);
        sparrow(c, x + 1.0 * k, y - 0.62 * k, k, q.on, this.time);
        break;
      }
      case 'lantern': lantern(c, x, y, k, q.f ? -1 : 1, q.on, this.time); break;
      case 'train': train(c, x, y, k, q.f ? -1 : 1, q.on, this.time - 0); break;
      default: break;
    }
    c.restore();
  }

  // ---------------------------------------------------------------- effects
  private effects(dt: number) {
    const c = this.ctx, k = this.k;
    for (const f of this.fx) f.t += dt;
    this.fx = this.fx.filter((f) => f.t < 1.1);
    c.save(); c.textAlign = 'center'; c.textBaseline = 'middle';
    for (const f of this.fx) {
      const x = this.sx(f.x), y = this.sy(f.y), p = f.t / 1.1;
      if (f.k === 'thud' || f.k === 'tink' || f.k === 'clack' || f.k === 'boing' || f.k === 'puff') {
        // a dust puff
        c.fillStyle = `rgba(240,225,195,${0.7 * (1 - p)})`;
        for (let i = 0; i < 5; i++) { const an = hash(f.seed + i) * TAU, d = k * (0.15 + p * 0.5); c.beginPath(); c.arc(x + Math.cos(an) * d, y + Math.sin(an) * d * 0.6, k * 0.12 * (1 - p * 0.5), 0, TAU); c.fill(); }
      }
      const word = f.k === 'clack' ? 'clack!' : f.k === 'boing' ? 'boing!' : f.k === 'puff' ? 'pfff!' : f.k === 'pop' ? 'POP!' : f.k === 'snip' ? 'snip!' : f.k === 'burn' ? 'fizz!' : f.k === 'ring' ? 'ding!' : f.k === 'vroom' ? 'vroom!' : f.k === 'token' ? '+★' : f.k === 'tink' && f.s > 0.5 ? 'tink!' : '';
      if (!word || (f.k === 'clack' && f.s < 0.12)) continue;
      const size = Math.max(13, k * (f.k === 'ring' || f.k === 'pop' ? 0.6 : 0.42)) * (1 + 0.3 * Math.sin(Math.min(1, p * 4) * Math.PI));
      c.font = `${size}px 'Permanent Marker', 'Kalam', cursive`;
      c.globalAlpha = Math.max(0, 1 - p * p);
      const yy = y - k * 0.4 - p * k * 0.8;
      c.lineWidth = Math.max(3, size * 0.22); c.strokeStyle = '#fff6e4'; c.strokeText(word, x, yy);
      c.fillStyle = f.k === 'ring' ? '#c88a10' : f.k === 'pop' ? '#d82a2a' : f.k === 'token' ? '#d89a10' : f.k === 'snip' || f.k === 'burn' ? '#c84a2a' : '#3a4aa0';
      c.fillText(word, x, yy);
      c.globalAlpha = 1;
      if (f.k === 'pop') { c.strokeStyle = `rgba(220,40,40,${1 - p})`; c.lineWidth = 2; for (let i = 0; i < 8; i++) { const an = (i / 8) * TAU; line(c, x + Math.cos(an) * k * 0.3, y + Math.sin(an) * k * 0.3, x + Math.cos(an) * k * (0.5 + p), y + Math.sin(an) * k * (0.5 + p)); } }
      if (f.k === 'goal') { c.fillStyle = `rgba(255,220,90,${0.9 * (1 - p)})`; for (let i = 0; i < 10; i++) { const an = hash(f.seed + i) * TAU, d = k * (0.3 + p * 1.6); star(c, x + Math.cos(an) * d, y + Math.sin(an) * d - p * k * 0.5, k * 0.12); } }
    }
    c.restore();
  }

  // ---------------------------------------------------------------- the audience (the Big Show)
  private audience(winT: number) {
    const c = this.ctx, B = this.lay.board, n = 5, who: Who[] = ['hedgehog', 'rabbit', 'mouse', 'owl', 'badger'];
    // a row of neighbours in front of the box, seen from behind: their heads just reach its bottom edge
    const L = this.lay, room = this.H - (L.below ? L.dora[1] + 8 : B.y + B.h), size = Math.max(40, Math.min(B.w / 7, room * (L.below ? 0.9 : 1.15), 150));
    for (let i = 0; i < n; i++) {
      const x = B.x + B.w * (0.2 + (i / (n - 1)) * 0.6), y = L.below ? L.dora[1] + 8 + size * 0.98 : Math.min(this.H + size * 0.12, B.y + B.h + size * 0.92);
      puppet(c, who[i], x, y, size, i < 2 ? 1 : -1, winT >= 0 ? 'cheer' : 'watch', this.time + i, null, true);
    }
  }
}

// ---------------------------------------------------------------- drawing helpers
function makeGrain(c: CanvasRenderingContext2D): CanvasPattern | null {
  if (typeof document === 'undefined') return null;
  const g = document.createElement('canvas'); g.width = g.height = 96;
  const x = g.getContext('2d'); if (!x) return null;
  for (let i = 0; i < 900; i++) { const v = hash(i * 3.1); x.fillStyle = v > 0.5 ? 'rgba(255,240,210,0.08)' : 'rgba(60,30,10,0.08)'; x.fillRect(hash(i) * 96, hash(i + 0.5) * 96, 1 + hash(i * 7) * 2, 1); }
  return c.createPattern(g, 'repeat');
}
function line(c: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number) { c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); }
function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
  c.beginPath(); c.moveTo(x + rr, y); c.arcTo(x + w, y, x + w, y + h, rr); c.arcTo(x + w, y + h, x, y + h, rr); c.arcTo(x, y + h, x, y, rr); c.arcTo(x, y, x + w, y, rr); c.closePath();
}
function drop(c: CanvasRenderingContext2D, k: number) { c.shadowColor = 'rgba(50,25,8,0.38)'; c.shadowBlur = Math.max(2, k * 0.12); c.shadowOffsetX = k * 0.05; c.shadowOffsetY = k * 0.07; }
/** A strip of corrugated cardboard, its cut edges showing the flutes. */
function board(c: CanvasRenderingContext2D, w: number, h: number) {
  c.fillStyle = CARD; c.fillRect(-w / 2, -h / 2, w, h);
  c.shadowColor = 'transparent';
  c.fillStyle = CARD_L; c.fillRect(-w / 2, -h / 2, w, Math.max(1, h * 0.28));
  c.fillStyle = CARD_D; c.fillRect(-w / 2, h / 2 - Math.max(1, h * 0.22), w, Math.max(1, h * 0.22));
  // flutes on the ends
  c.strokeStyle = CARD_D; c.lineWidth = 1;
  for (const e of [-1, 1]) { c.beginPath(); for (let i = 0; i <= 4; i++) { const yy = -h / 2 + (i / 4) * h, xx = e * (w / 2 - (i % 2 ? h * 0.18 : 0)); i ? c.lineTo(xx, yy) : c.moveTo(xx, yy); } c.stroke(); }
  c.strokeStyle = 'rgba(80,45,15,0.6)'; c.lineWidth = 1; c.strokeRect(-w / 2, -h / 2, w, h);
}
/** A wooden ruler: the plank. */
function ruler(c: CanvasRenderingContext2D, w: number, h: number) {
  c.fillStyle = '#e8c88a'; c.fillRect(-w / 2, -h / 2, w, h); c.shadowColor = 'transparent';
  c.strokeStyle = '#7a5a2a'; c.lineWidth = 1;
  for (let i = 1; i < 36; i++) { const xx = -w / 2 + (i / 36) * w; line(c, xx, -h / 2, xx, -h / 2 + h * (i % 5 === 0 ? 0.55 : 0.3)); }
  c.strokeStyle = 'rgba(90,55,20,0.7)'; c.strokeRect(-w / 2, -h / 2, w, h);
}
function flutes(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, horiz: boolean) {
  c.save(); c.strokeStyle = 'rgba(60,32,10,0.5)'; c.lineWidth = 1; c.beginPath();
  if (horiz) { const n = Math.floor(w / 6); for (let i = 0; i <= n; i++) { const xx = x + (i / n) * w, yy = y + (i % 2 ? h * 0.25 : h * 0.75); i ? c.lineTo(xx, yy) : c.moveTo(xx, yy); } }
  else { const n = Math.floor(h / 6); for (let i = 0; i <= n; i++) { const yy = y + (i / n) * h, xx = x + (i % 2 ? w * 0.25 : w * 0.75); i ? c.lineTo(xx, yy) : c.moveTo(xx, yy); } }
  c.stroke(); c.restore();
}
function tape(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, a: number) {
  c.save(); c.translate(x, y); c.rotate(a); c.shadowColor = 'transparent';
  c.fillStyle = TAPE; c.beginPath();
  c.moveTo(-w / 2, -h / 2); for (let i = 0; i <= 4; i++) c.lineTo(-w / 2 + (i / 4) * w, -h / 2 + (i % 2 ? h * 0.08 : 0));
  c.lineTo(w / 2, h / 2); for (let i = 4; i >= 0; i--) c.lineTo(-w / 2 + (i / 4) * w, h / 2 - (i % 2 ? h * 0.08 : 0));
  c.closePath(); c.fill();
  c.restore();
}
function splitPin(c: CanvasRenderingContext2D, x: number, y: number, r: number) {
  c.save(); c.shadowColor = 'transparent';
  const g = c.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r); g.addColorStop(0, '#fff2b0'); g.addColorStop(1, '#a8781e');
  c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); c.strokeStyle = '#6a4a10'; c.lineWidth = Math.max(0.8, r * 0.18); c.stroke();
  c.restore();
}
function star(c: CanvasRenderingContext2D, x: number, y: number, r: number) {
  c.beginPath(); for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU - Math.PI / 2, rr = i % 2 ? r * 0.45 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } c.closePath(); c.fill();
}
function doodle(c: CanvasRenderingContext2D, k: 'star' | 'spiral' | 'sun' | 'arrow' | 'heart', x: number, y: number, r: number, col: string) {
  c.save(); c.strokeStyle = col; c.lineWidth = Math.max(1.5, r * 0.14); c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath();
  if (k === 'star') { for (let i = 0; i <= 5; i++) { const a = (i * 2 * TAU) / 5 - Math.PI / 2; i ? c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r) : c.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } }
  else if (k === 'spiral') { for (let i = 0; i < 40; i++) { const a = i * 0.45, rr = (i / 40) * r; i ? c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : c.moveTo(x, y); } }
  else if (k === 'sun') { c.arc(x, y, r * 0.45, 0, TAU); for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; c.moveTo(x + Math.cos(a) * r * 0.65, y + Math.sin(a) * r * 0.65); c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } }
  else if (k === 'arrow') { c.moveTo(x - r, y + r * 0.3); c.quadraticCurveTo(x, y - r * 0.6, x + r, y); c.moveTo(x + r * 0.6, y - r * 0.35); c.lineTo(x + r, y); c.lineTo(x + r * 0.55, y + r * 0.25); }
  else { c.moveTo(x, y + r * 0.7); c.bezierCurveTo(x - r * 1.2, y - r * 0.2, x - r * 0.4, y - r, x, y - r * 0.3); c.bezierCurveTo(x + r * 0.4, y - r, x + r * 1.2, y - r * 0.2, x, y + r * 0.7); }
  c.stroke(); c.restore();
}
function hedgehog(c: CanvasRenderingContext2D, x: number, y: number, k: number, dir: number, _on: number, hitAt: number, time: number) {
  const awake = hitAt >= 0, wave = awake ? Math.sin(time * 6) * 0.5 : 0;
  c.save(); c.translate(x, y); c.scale(dir, 1); drop(c, k);
  // spines: a marker zigzag on a dark card
  c.fillStyle = '#6a4a30'; c.beginPath(); c.moveTo(-0.65 * k, 0);
  for (let i = 0; i <= 12; i++) { const a = Math.PI - (i / 12) * Math.PI, r = (i % 2 ? 0.62 : 0.74) * k; c.lineTo(Math.cos(a) * r * 0.95, -Math.sin(a) * r * 0.85); }
  c.closePath(); c.fill(); c.shadowColor = 'transparent';
  c.fillStyle = '#e8c49a'; c.beginPath(); c.ellipse(0.42 * k, -0.22 * k, 0.32 * k, 0.24 * k, -0.2, 0, TAU); c.fill();
  c.fillStyle = INK; c.beginPath(); c.arc(0.72 * k, -0.2 * k, 0.05 * k, 0, TAU); c.fill();
  c.strokeStyle = INK; c.lineWidth = Math.max(1.2, k * 0.035); c.lineCap = 'round';
  if (awake) { c.beginPath(); c.arc(0.45 * k, -0.3 * k, 0.05 * k, 0, TAU); c.fillStyle = INK; c.fill(); c.beginPath(); c.arc(0.55 * k, -0.12 * k, 0.07 * k, 0, Math.PI); c.stroke();
    // a paw waving
    c.save(); c.translate(0.25 * k, -0.15 * k); c.rotate(-1.2 + wave); c.fillStyle = '#e8c49a'; c.fillRect(-0.05 * k, -0.35 * k, 0.1 * k, 0.35 * k); c.restore();
  } else {
    c.beginPath(); c.arc(0.45 * k, -0.3 * k, 0.05 * k, 0.2, Math.PI - 0.2); c.stroke();
    c.save(); c.scale(dir, 1); c.font = `${Math.max(10, k * 0.3)}px 'Permanent Marker', cursive`; c.fillStyle = '#4a5a9a';
    const z = (time * 0.6) % 1; c.globalAlpha = 1 - z; c.fillText('z', dir * 0.5 * k, -0.9 * k - z * k * 0.5); c.globalAlpha = 1; c.restore();
  }
  c.restore();
}
function sparrow(c: CanvasRenderingContext2D, x: number, y: number, k: number, fed: boolean, t: number) {
  const peck = fed ? Math.max(0, Math.sin(t * 9)) * 0.35 : 0;
  c.save(); c.translate(x, y); drop(c, k);
  c.fillStyle = '#9a6a3a'; c.beginPath(); c.ellipse(0, -0.25 * k, 0.28 * k, 0.22 * k, 0, 0, TAU); c.fill(); c.shadowColor = 'transparent';
  c.fillStyle = '#e8d4b0'; c.beginPath(); c.ellipse(-0.04 * k, -0.18 * k, 0.16 * k, 0.12 * k, 0, 0, TAU); c.fill();
  c.save(); c.translate(-0.18 * k, -0.42 * k); c.rotate(-peck); c.fillStyle = '#9a6a3a'; c.beginPath(); c.arc(0, 0, 0.15 * k, 0, TAU); c.fill();
  c.fillStyle = INK; c.beginPath(); c.arc(-0.06 * k, -0.03 * k, 0.03 * k, 0, TAU); c.fill(); c.fillStyle = '#e8a030'; c.beginPath(); c.moveTo(-0.14 * k, 0); c.lineTo(-0.26 * k, 0.03 * k); c.lineTo(-0.14 * k, 0.05 * k); c.fill(); c.restore();
  c.strokeStyle = '#6a4a2a'; c.lineWidth = 1.5; line(c, 0.2 * k, -0.28 * k, 0.4 * k, -0.4 * k);
  if (fed) { c.fillStyle = '#e84a6a'; const h = (t * 0.8) % 1; c.globalAlpha = 1 - h; c.font = `${Math.max(10, k * 0.3)}px sans-serif`; c.fillText('♥', -0.1 * k, -0.8 * k - h * k * 0.6); c.globalAlpha = 1; }
  c.restore();
}
function lantern(c: CanvasRenderingContext2D, x: number, y: number, k: number, dir: number, lit: boolean, t: number) {
  c.save(); c.translate(x, y);
  if (lit) { const g = c.createRadialGradient(0, -0.55 * k, 2, 0, -0.55 * k, 2.4 * k); g.addColorStop(0, 'rgba(255,214,120,0.75)'); g.addColorStop(1, 'rgba(255,190,90,0)'); c.fillStyle = g; c.beginPath(); c.arc(0, -0.55 * k, 2.4 * k, 0, TAU); c.fill(); }
  drop(c, k);
  c.fillStyle = lit ? '#ffd27a' : '#e6d6b0'; roundRect(c, -0.35 * k, -1.0 * k, 0.7 * k, 0.9 * k, 0.3 * k); c.fill(); c.shadowColor = 'transparent';
  c.strokeStyle = '#b8462a'; c.lineWidth = Math.max(1, k * 0.03); for (const yy of [-0.8, -0.55, -0.3]) line(c, -0.33 * k, yy * k, 0.33 * k, yy * k);
  c.fillStyle = '#3a2a1e'; c.fillRect(-0.3 * k, -1.08 * k, 0.6 * k, 0.1 * k); c.fillRect(-0.3 * k, -0.12 * k, 0.6 * k, 0.12 * k);
  if (lit) { c.fillStyle = `rgba(255,250,200,${0.7 + 0.3 * Math.sin(t * 13)})`; c.beginPath(); c.ellipse(0, -0.55 * k, 0.1 * k, 0.18 * k, 0, 0, TAU); c.fill(); }
  // the round switch
  c.fillStyle = lit ? '#4ac84a' : '#d83a2a'; c.beginPath(); c.arc(dir * 0.55 * k, -0.45 * k, 0.2 * k, 0, TAU); c.fill(); c.strokeStyle = INK; c.lineWidth = 1.5; c.stroke();
  c.restore();
}
function train(c: CanvasRenderingContext2D, x: number, y: number, k: number, dir: number, on: boolean, t: number) {
  c.save(); c.translate(x, y); c.scale(dir, 1); drop(c, k);
  c.fillStyle = '#2a4a8a'; roundRect(c, -0.9 * k, -0.8 * k, 1.8 * k, 0.6 * k, 0.1 * k); c.fill(); c.shadowColor = 'transparent';
  c.fillStyle = '#c8402e'; c.fillRect(-0.9 * k, -1.25 * k, 0.7 * k, 0.5 * k); c.fillStyle = '#ffe4a0'; c.fillRect(-0.78 * k, -1.15 * k, 0.4 * k, 0.28 * k);
  c.fillStyle = '#222'; c.fillRect(0.45 * k, -1.2 * k, 0.22 * k, 0.4 * k);
  for (const wx of [-0.6, 0, 0.6]) { c.fillStyle = '#1a1a1a'; c.beginPath(); c.arc(wx * k, -0.16 * k, 0.17 * k, 0, TAU); c.fill(); c.fillStyle = '#d83a2a'; c.beginPath(); c.arc(wx * k, -0.16 * k, 0.07 * k, 0, TAU); c.fill(); }
  c.fillStyle = BRASS; c.beginPath(); c.arc(0.9 * k, -0.5 * k, 0.12 * k, 0, TAU); c.fill();
  // the whistle cord's handle at its back
  c.strokeStyle = INK; c.lineWidth = 1.5; line(c, -1.08 * k, -0.75 * k, -1.08 * k, -0.6 * k); c.fillStyle = '#e8b030'; c.fillRect(-1.26 * k, -0.82 * k, 0.36 * k, 0.14 * k);
  if (on) { for (let i = 0; i < 4; i++) { const p = ((t * 0.9 + i * 0.25) % 1); c.fillStyle = `rgba(250,250,250,${0.8 * (1 - p)})`; c.beginPath(); c.arc(0.56 * k + p * k * 0.6, -1.3 * k - p * k * 1.3, k * (0.15 + p * 0.25), 0, TAU); c.fill(); } }
  c.restore();
}

// ---------------------------------------------------------------- the puppets
const FUR: Record<Who, { body: string; belly: string; edge: string; ear: string; eye: string; nose: string }> = {
  dora: { body: '#f6eee0', belly: '#fffaf0', edge: '#d8c8a8', ear: '#f2a6b4', eye: '#b0182c', nose: '#e88a9a' },
  enzo: { body: '#8a9aac', belly: '#c4ced8', edge: '#5e6e80', ear: '#f0a0b0', eye: '#141414', nose: '#d88090' },
  hedgehog: { body: '#7a5a3a', belly: '#e8c49a', edge: '#4a3420', ear: '#e8b090', eye: '#141414', nose: '#2a1a10' },
  rabbit: { body: '#c8a888', belly: '#f2e2cc', edge: '#8a6a4a', ear: '#f0b0b8', eye: '#141414', nose: '#d07888' },
  mouse: { body: '#a8a0a0', belly: '#e0d8d0', edge: '#6a6060', ear: '#f0a8b4', eye: '#141414', nose: '#d07888' },
  owl: { body: '#9a6a3a', belly: '#e8d0a0', edge: '#5a3a1a', ear: '#7a5028', eye: '#141414', nose: '#e8a030' },
  badger: { body: '#5a5a5e', belly: '#f2f2ee', edge: '#2a2a2e', ear: '#3a3a3e', eye: '#141414', nose: '#141414' },
};
/** A piece of cut card: filled, with a lighter cut edge showing its thickness and a soft shadow. */
function piece(c: CanvasRenderingContext2D, path: () => void, fill: string, edge: string, s: number) {
  c.save(); c.translate(s * 0.012, s * 0.016); path(); c.fillStyle = edge; c.fill(); c.restore();
  path(); c.fillStyle = fill; c.fill();
  c.strokeStyle = 'rgba(70,45,25,0.32)'; c.lineWidth = Math.max(0.8, s * 0.006); c.stroke();
}
/**
 * A cardboard puppet standing at (x, y) (its feet), `size` pixels tall, facing `dir` (1 right, −1 left). Chinchillas
 * have a big round head with a broad, slightly flat crown and large round ears on its sides, a short blunt muzzle, a
 * plump body and a big bushy tail; the arms swing on split pins at the shoulders.
 */
export function puppet(c: CanvasRenderingContext2D, who: Who, x: number, y: number, size: number, dir: number, pose: Pose, t: number, look: [number, number] | null, back = false) {
  const F = FUR[who], s = size;
  const bob = pose === 'cheer' ? Math.abs(Math.sin(t * 7)) * s * 0.05 : Math.sin(t * 1.6) * s * 0.008;
  c.save(); c.translate(x, y - bob);
  c.scale(dir, 1);
  c.save(); c.shadowColor = 'rgba(30,14,4,0.45)'; c.shadowBlur = s * 0.06; c.shadowOffsetY = s * 0.02;
  // a little card stand
  c.fillStyle = CARD_D; c.fillRect(-s * 0.26, -s * 0.03, s * 0.5, s * 0.05);
  c.restore();
  const chin = who === 'dora' || who === 'enzo';
  // the tail behind
  if (chin) {
    const sw = Math.sin(t * 2.2) * 0.08;
    piece(c, () => { c.save(); c.translate(-s * 0.24, -s * 0.28); c.rotate(-0.5 + sw); c.beginPath(); for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU, r = s * (0.17 + (i % 2) * 0.035); c.lineTo(Math.cos(a) * r * 0.75, Math.sin(a) * r * 1.25 - s * 0.08); } c.closePath(); c.restore(); }, F.body, F.edge, s);
    piece(c, () => { c.save(); c.translate(-s * 0.24, -s * 0.28); c.rotate(-0.5 + sw); c.beginPath(); c.ellipse(0, -s * 0.06, s * 0.06, s * 0.16, 0, 0, TAU); c.restore(); }, F.belly, F.body, s * 0.2);
  } else if (who === 'rabbit') {
    piece(c, () => { c.beginPath(); c.arc(-s * 0.22, -s * 0.18, s * 0.07, 0, TAU); }, '#fff', F.edge, s);
  } else if (who === 'mouse') {
    c.strokeStyle = F.ear; c.lineWidth = s * 0.02; c.beginPath(); c.moveTo(-s * 0.2, -s * 0.1); c.quadraticCurveTo(-s * 0.45, -s * 0.05, -s * 0.38, -s * 0.3); c.stroke();
  }
  // the far arm (behind the body)
  const arm = armPose(pose, t);
  limb(c, s * 0.1, -s * 0.42, arm[1], F, s, true);
  // the plump body
  piece(c, () => { c.beginPath(); c.ellipse(0, -s * 0.28, s * 0.25, s * 0.28, 0, 0, TAU); }, F.body, F.edge, s);
  if (!back) piece(c, () => { c.beginPath(); c.ellipse(s * 0.06, -s * 0.24, s * 0.15, s * 0.19, 0, 0, TAU); }, F.belly, F.body, s * 0.3);
  // feet
  piece(c, () => { c.beginPath(); c.ellipse(s * 0.06, -s * 0.02, s * 0.1, s * 0.04, 0, 0, TAU); c.ellipse(-s * 0.12, -s * 0.02, s * 0.09, s * 0.04, 0, 0, TAU); }, F.belly, F.edge, s);
  // the head: turned a little toward what it watches
  let tilt = 0, ex = 0, ey = 0;
  if (look) {
    const hx = x, hy = y - s * 0.7, dx = (look[0] - hx) * dir, dy = look[1] - hy, d = Math.hypot(dx, dy) || 1;
    tilt = Math.max(-0.25, Math.min(0.25, Math.atan2(dy, Math.max(20, dx)) * 0.4)); ex = (dx / d) * s * 0.012; ey = (dy / d) * s * 0.012;
  }
  if (pose === 'wince') tilt = 0.15;
  if (pose === 'think') tilt = -0.12;
  c.save(); c.translate(0, -s * 0.62); c.rotate(tilt);
  if (chin) chinHead(c, who, F, s, pose, t, ex, ey, back);
  else critterHead(c, who, F, s, pose, back);
  c.restore();
  // the near arm, on its split pin
  limb(c, -s * 0.02, -s * 0.42, arm[0], F, s, false);
  splitPin(c, -s * 0.02, -s * 0.42, s * 0.022);
  c.restore();
}
function armPose(p: Pose, t: number): [number, number] {
  switch (p) {
    case 'cheer': return [-2.6 + Math.sin(t * 7) * 0.25, -2.4 + Math.sin(t * 7 + 1) * 0.25];
    case 'wince': return [-2.75, -2.9];
    case 'point': return [-1.45, 0.25];
    case 'wave': return [-2.5 + Math.sin(t * 8) * 0.4, 0.3];
    case 'think': return [-2.2, 0.35];
    case 'watch': return [-0.45 + Math.sin(t * 2) * 0.05, 0.35];
    default: return [0.25 + Math.sin(t * 1.5) * 0.06, 0.4];
  }
}
function limb(c: CanvasRenderingContext2D, x: number, y: number, a: number, F: (typeof FUR)['dora'], s: number, far: boolean) {
  c.save(); c.translate(x, y); c.rotate(a);
  piece(c, () => { c.beginPath(); c.ellipse(0, s * 0.11, s * 0.055, s * 0.13, 0, 0, TAU); }, far ? F.edge : F.body, F.edge, s * 0.6);
  piece(c, () => { c.beginPath(); c.arc(0, s * 0.22, s * 0.045, 0, TAU); }, F.belly, F.edge, s * 0.4);
  c.restore();
}
function chinHead(c: CanvasRenderingContext2D, who: Who, F: (typeof FUR)['dora'], s: number, pose: Pose, t: number, ex: number, ey: number, back: boolean) {
  const R = s * 0.25;
  // ears: big, round and pink-lined, on the sides of the crown
  for (const side of [-1, 1]) {
    const ax = side * R * 0.78 - R * 0.05, ay = -R * 0.62;
    piece(c, () => { c.beginPath(); c.ellipse(ax, ay, R * 0.42, R * 0.46, side * 0.35, 0, TAU); }, F.body, F.edge, s);
    piece(c, () => { c.beginPath(); c.ellipse(ax, ay + R * 0.03, R * 0.29, R * 0.33, side * 0.35, 0, TAU); }, F.ear, F.body, s * 0.2);
  }
  // the head: round, with a broad, slightly flat crown (the top of the ellipse squared off a little)
  piece(c, () => {
    c.beginPath();
    c.moveTo(-R * 1.02, R * 0.05);
    c.bezierCurveTo(-R * 1.05, -R * 0.62, -R * 0.62, -R * 0.9, 0, -R * 0.9);
    c.bezierCurveTo(R * 0.62, -R * 0.9, R * 1.05, -R * 0.62, R * 1.02, R * 0.05);
    c.bezierCurveTo(R * 1.0, R * 0.72, R * 0.55, R * 0.92, 0, R * 0.92);
    c.bezierCurveTo(-R * 0.55, R * 0.92, -R * 1.0, R * 0.72, -R * 1.02, R * 0.05);
    c.closePath();
  }, F.body, F.edge, s);
  if (back) return;
  // muzzle: short and blunt, toward the front of the face
  piece(c, () => { c.beginPath(); c.ellipse(R * 0.38, R * 0.36, R * 0.42, R * 0.3, 0, 0, TAU); }, F.belly, F.body, s * 0.25);
  const wince = pose === 'wince', happy = pose === 'cheer' || pose === 'wave';
  // eyes (marker drawn)
  for (const [exx, sc] of [[R * 0.0, 0.9], [R * 0.58, 1]] as [number, number][]) {
    if (wince) { c.strokeStyle = INK; c.lineWidth = R * 0.08; c.lineCap = 'round'; line(c, exx - R * 0.12, -R * 0.06, exx + R * 0.12, R * 0.02); line(c, exx - R * 0.12, R * 0.08, exx + R * 0.12, R * 0.0); continue; }
    if (happy) { c.strokeStyle = INK; c.lineWidth = R * 0.08; c.lineCap = 'round'; c.beginPath(); c.arc(exx, R * 0.04, R * 0.13 * sc, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); continue; }
    const blink = Math.sin(t * 0.9 + (who === 'enzo' ? 2 : 0)) > 0.985;
    if (blink) { c.strokeStyle = INK; c.lineWidth = R * 0.06; line(c, exx - R * 0.12, R * 0.0, exx + R * 0.12, R * 0.0); continue; }
    c.fillStyle = F.eye; c.beginPath(); c.ellipse(exx + ex, -R * 0.02 + ey, R * 0.16 * sc, R * 0.19 * sc, 0, 0, TAU); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(exx + ex - R * 0.05, -R * 0.09 + ey, R * 0.055 * sc, 0, TAU); c.fill();
  }
  // nose, mouth, whiskers (short), and a blush
  c.fillStyle = F.nose; c.beginPath(); c.ellipse(R * 0.72, R * 0.24, R * 0.09, R * 0.065, 0, 0, TAU); c.fill();
  c.strokeStyle = INK; c.lineWidth = R * 0.045; c.lineCap = 'round';
  c.beginPath();
  if (happy) { c.arc(R * 0.52, R * 0.38, R * 0.14, 0.1, Math.PI - 0.1); } else if (wince) { c.moveTo(R * 0.42, R * 0.5); c.lineTo(R * 0.62, R * 0.46); } else { c.moveTo(R * 0.72, R * 0.3); c.quadraticCurveTo(R * 0.62, R * 0.48, R * 0.5, R * 0.42); }
  c.stroke();
  c.strokeStyle = 'rgba(60,40,30,0.6)'; c.lineWidth = R * 0.025;
  for (const dy of [-0.06, 0.04, 0.14]) { line(c, R * 0.82, R * (0.3 + dy), R * 1.18, R * (0.24 + dy * 1.6)); line(c, R * 0.2, R * (0.32 + dy), -R * 0.1, R * (0.28 + dy * 1.6)); }
  c.fillStyle = 'rgba(240,120,140,0.28)'; c.beginPath(); c.ellipse(-R * 0.18, R * 0.3, R * 0.16, R * 0.09, 0, 0, TAU); c.fill();
  // wincing: a paw-shaped peek gap; cheering: little marker sparkles
  if (pose === 'cheer') { c.fillStyle = '#e8b030'; star(c, R * 1.3, -R * 1.1, R * 0.16); star(c, -R * 1.2, -R * 1.2, R * 0.12); }
}
function critterHead(c: CanvasRenderingContext2D, who: Who, F: (typeof FUR)['dora'], s: number, pose: Pose, back: boolean) {
  const R = s * 0.2;
  if (who === 'rabbit') for (const side of [-1, 1]) piece(c, () => { c.beginPath(); c.ellipse(side * R * 0.35, -R * 1.3, R * 0.22, R * 0.75, side * 0.15, 0, TAU); }, F.body, F.edge, s);
  if (who === 'mouse') for (const side of [-1, 1]) piece(c, () => { c.beginPath(); c.arc(side * R * 0.75, -R * 0.75, R * 0.48, 0, TAU); }, F.body, F.edge, s);
  if (who === 'owl') for (const side of [-1, 1]) piece(c, () => { c.beginPath(); c.moveTo(side * R * 0.5, -R * 0.7); c.lineTo(side * R * 0.95, -R * 1.25); c.lineTo(side * R * 0.95, -R * 0.4); c.closePath(); }, F.body, F.edge, s);
  piece(c, () => { c.beginPath(); c.ellipse(0, 0, R * 1.0, R * 0.92, 0, 0, TAU); }, F.body, F.edge, s);
  if (who === 'hedgehog') piece(c, () => { c.beginPath(); for (let i = 0; i <= 10; i++) { const a = Math.PI + (i / 10) * Math.PI, r = R * (i % 2 ? 1.05 : 1.3); c.lineTo(Math.cos(a) * r - R * 0.1, Math.sin(a) * r); } c.closePath(); }, '#5a3e24', F.edge, s);
  if (who === 'badger') { c.fillStyle = '#f2f2ee'; c.beginPath(); c.ellipse(0, -R * 0.1, R * 0.22, R * 0.85, 0, 0, TAU); c.fill(); }
  if (back) return;
  c.fillStyle = F.belly; c.beginPath(); c.ellipse(R * 0.3, R * 0.25, R * 0.45, R * 0.35, 0, 0, TAU); c.fill();
  c.fillStyle = INK;
  for (const ex of [R * 0.0, R * 0.55]) { if (pose === 'cheer') { c.strokeStyle = INK; c.lineWidth = R * 0.08; c.beginPath(); c.arc(ex, R * 0.0, R * 0.12, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); } else { c.beginPath(); c.arc(ex, -R * 0.05, R * 0.11, 0, TAU); c.fill(); } }
  c.fillStyle = F.nose; c.beginPath(); c.arc(R * 0.72, R * 0.22, R * 0.09, 0, TAU); c.fill();
}

/** A cardboard stand-in for a painting, drawn until (or unless) the painting loads. */
export function paintStandIn(cv: HTMLCanvasElement, which: 'title' | 'ending' | 'backdrop') {
  const c = cv.getContext('2d'); if (!c) return;
  const W = cv.width, H = cv.height;
  const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#8a5c34'); g.addColorStop(1, '#5a3a20'); c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.fillStyle = '#d8b07a'; c.fillRect(W * 0.08, H * 0.08, W * 0.84, H * 0.7);
  c.strokeStyle = 'rgba(90,50,20,0.15)'; for (let x = W * 0.08; x < W * 0.92; x += 6) line(c, x, H * 0.08, x, H * 0.78);
  c.fillStyle = '#6a4424'; c.fillRect(0, H * 0.78, W, H * 0.22);
  doodle(c, 'star', W * 0.2, H * 0.25, H * 0.06, '#c8463a'); doodle(c, 'spiral', W * 0.8, H * 0.22, H * 0.05, '#3a7a8a');
  if (which !== 'backdrop') {
    puppet(c, 'dora', W * 0.2, H * 0.8, H * 0.5, 1, which === 'ending' ? 'cheer' : 'wave', 0, null);
    puppet(c, 'enzo', W * 0.8, H * 0.8, H * 0.53, -1, which === 'ending' ? 'cheer' : 'watch', 1, null);
  }
}
