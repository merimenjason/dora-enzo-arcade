// Poof Panic, drawn. Canvas 2D only: the boards, the fluff balls, the dust and everything that flies about when
// something pops. Nothing here changes the game; the page hands over the boards and the events they produced.
import { W, VISIBLE, SPAWN_X, DUST, type Board, type Ev, type HeroId, type Rival } from './poof-panic-game';
import { COATS, drawChinchilla } from './chinchilla-art';
import { predator, tintOf, type PredKind } from './predator-art';

type C2D = CanvasRenderingContext2D;
type Look = 'rest' | 'wide' | 'worry' | 'blink';
type Rect = { x: number; y: number; cell: number };
type Box = { x: number; y: number; w: number; h: number };
export type Layout = { narrow: boolean; a: Rect; b: Rect | null; panel: Box; foot: number };
export type View = {
  a: Board; b?: Board | null; hero: HeroId; rival?: Rival | null; hard?: boolean;
  wins?: [number, number]; stats?: [string, string][]; ghost?: boolean; banner?: string; result?: [string, string] | null;
};

export const PALETTE: Record<number, { base: string; light: string; dark: string; ink: string }> = {
  1: { base: '#ff7a9c', light: '#ffc6d4', dark: '#d2436d', ink: '#7c1f3c' },
  2: { base: '#56b2ff', light: '#c0e4ff', dark: '#2a78d0', ink: '#143f7c' },
  3: { base: '#5cd699', light: '#c6f5da', dark: '#279a66', ink: '#0f5a39' },
  4: { base: '#ffc94a', light: '#ffecb0', dark: '#d8960f', ink: '#7a4f00' },
  5: { base: '#b68cff', light: '#e3d2ff', dark: '#7d50d2', ink: '#3f2380' },
  [DUST]: { base: '#aaa4b0', light: '#dcd7e0', dark: '#716b79', ink: '#3c3742' },
};
const FONT = 'ui-rounded, "Arial Rounded MT Bold", "Nunito", system-ui, sans-serif';
const TAU = Math.PI * 2;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const hash = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

/** One fluff ball, centred on (0, 0), in a cell of size s. Each colour has its own ears so they read apart at a glance. */
function paintBall(c: C2D, s: number, colour: number, look: Look) {
  const p = PALETTE[colour], r = s * 0.4, dust = colour === DUST;
  const bumps: [number, number, number][] = [[0, 0, r]];
  const n = dust ? 9 : 12;
  for (let i = 0; i < n; i++) { const a = (i / n) * TAU + (dust ? 0.3 : 0), k = dust ? 0.2 + 0.1 * hash(i + 3) : 0.2; bumps.push([Math.cos(a) * r * 0.86, Math.sin(a) * r * 0.86, r * k]); }
  // Ears and tufts.
  if (colour === 1) bumps.push([-r * 0.62, -r * 0.78, r * 0.3], [r * 0.62, -r * 0.78, r * 0.3]);
  if (colour === 2) bumps.push([0, -r * 1.02, r * 0.2], [0, -r * 1.2, r * 0.11]);
  if (colour === 3) bumps.push([-r * 0.3, -r * 1.04, r * 0.17], [r * 0.3, -r * 1.04, r * 0.17], [-r * 0.5, -r * 1.2, r * 0.1], [r * 0.5, -r * 1.2, r * 0.1]);
  if (colour === 4) bumps.push([-r * 0.5, -r * 0.95, r * 0.15], [0, -r * 1.08, r * 0.17], [r * 0.5, -r * 0.95, r * 0.15]);
  if (colour === 5) bumps.push([r * 0.15, -r * 1.05, r * 0.2], [r * 0.42, -r * 1.2, r * 0.13], [r * 0.3, -r * 1.36, r * 0.08]);
  c.fillStyle = p.ink;
  for (const [x, y, k] of bumps) { c.beginPath(); c.arc(x, y, k + Math.max(1, s * 0.035), 0, TAU); c.fill(); }
  const g = c.createRadialGradient(-r * 0.35, -r * 0.45, r * 0.1, 0, 0, r * 1.35);
  g.addColorStop(0, p.light); g.addColorStop(0.45, p.base); g.addColorStop(1, p.dark);
  c.fillStyle = g;
  for (const [x, y, k] of bumps) { c.beginPath(); c.arc(x, y, k, 0, TAU); c.fill(); }
  c.fillStyle = 'rgba(255,255,255,0.35)';
  c.beginPath(); c.ellipse(-r * 0.36, -r * 0.5, r * 0.3, r * 0.17, -0.6, 0, TAU); c.fill();
  if (s < 9) return;
  // Face.
  const ex = r * 0.36, ey = r * 0.02, ink = '#2a2030';
  c.fillStyle = ink; c.strokeStyle = ink; c.lineCap = 'round'; c.lineWidth = Math.max(1, s * 0.045);
  if (dust || look === 'blink') {
    for (const sx of [-1, 1]) { c.beginPath(); c.arc(sx * ex, ey - r * 0.02, r * 0.13, 0.15, Math.PI - 0.15); c.stroke(); }
  } else {
    const big = look === 'wide', er = r * (big ? 0.2 : 0.14);
    for (const sx of [-1, 1]) {
      if (big) { c.fillStyle = '#fff'; c.beginPath(); c.arc(sx * ex, ey, er * 1.25, 0, TAU); c.fill(); c.fillStyle = ink; c.beginPath(); c.arc(sx * ex, ey, er * 0.55, 0, TAU); c.fill(); continue; }
      c.fillStyle = ink; c.beginPath(); c.ellipse(sx * ex, ey, er, er * 1.3, 0, 0, TAU); c.fill();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(sx * ex - er * 0.3, ey - er * 0.45, er * 0.42, 0, TAU); c.fill();
    }
    if (look === 'worry') { c.strokeStyle = ink; for (const sx of [-1, 1]) { c.beginPath(); c.moveTo(sx * (ex - r * 0.2), ey - r * 0.36); c.lineTo(sx * (ex + r * 0.16), ey - r * 0.27); c.stroke(); } }
  }
  if (!dust) {
    c.fillStyle = 'rgba(255,90,120,0.3)';
    for (const sx of [-1, 1]) { c.beginPath(); c.ellipse(sx * r * 0.6, r * 0.3, r * 0.16, r * 0.1, 0, 0, TAU); c.fill(); }
  }
  c.strokeStyle = ink; c.lineWidth = Math.max(1, s * 0.035);
  c.beginPath();
  if (look === 'wide') c.ellipse(0, r * 0.38, r * 0.1, r * 0.13, 0, 0, TAU);
  else if (look === 'worry') c.arc(0, r * 0.48, r * 0.12, Math.PI + 0.3, TAU - 0.3);
  else if (dust) { c.moveTo(-r * 0.1, r * 0.34); c.lineTo(r * 0.1, r * 0.34); }
  else { c.arc(-r * 0.09, r * 0.26, r * 0.09, 0.1, Math.PI - 0.1); c.moveTo(r * 0.18, r * 0.27); c.arc(r * 0.09, r * 0.26, r * 0.09, 0.1, Math.PI - 0.1); }
  c.stroke();
}

const sprites = new Map<string, HTMLCanvasElement>();
/** A ball painted once for each colour, face and size, then stamped. */
function sprite(colour: number, look: Look, px: number) {
  const key = `${colour}|${look}|${px}`;
  let cv = sprites.get(key);
  if (!cv) {
    if (sprites.size > 400) sprites.clear();
    cv = document.createElement('canvas'); cv.width = cv.height = Math.ceil(px * 1.5);
    const c = cv.getContext('2d')!;
    c.translate(cv.width / 2, cv.height / 2); paintBall(c, px, colour, look);
    sprites.set(key, cv);
  }
  return cv;
}
function ball(c: C2D, dpr: number, x: number, y: number, cell: number, colour: number, look: Look = 'rest', sx = 1, sy = 1, alpha = 1) {
  const img = sprite(colour, look, Math.max(4, Math.round(cell * dpr))), d = cell * 1.5;
  if (alpha < 1) c.globalAlpha = alpha;
  c.drawImage(img, x - (d * sx) / 2, y - (d * sy) / 2 + (1 - sy) * cell * 0.4, d * sx, d * sy);
  if (alpha < 1) c.globalAlpha = 1;
}
/** A single fluff ball for the page's own pictures. */
export function drawPoof(c: C2D, colour: number, size: number, look: Look = 'rest') { c.save(); c.translate(size / 2, size / 2 + size * 0.04); paintBall(c, size * 0.86, colour, look); c.restore(); }
export function drawRival(c: C2D, kind: string, w: number, h: number, hard = false) {
  c.save(); c.clearRect(0, 0, w, h); c.translate(w * 0.46, h * 0.93); const k = h / 26; c.scale(k, k); c.lineJoin = 'round';
  predator(c, kind as PredKind, tintOf(kind as PredKind, hard), 0.4); c.restore();
}
export function drawHero(c: C2D, hero: HeroId, w: number, h: number) { c.clearRect(0, 0, w, h); drawChinchilla(c, COATS[hero], w * 0.58, h * 0.95, { face: 1, h: h * 0.62, time: 0.4 }); }

type Bit = { x: number; y: number; vx: number; vy: number; age: number; life: number; r: number; colour: string; wait: number; star?: boolean };
type Pop = { x: number; y: number; text: string; age: number; life: number; size: number; colour: string };
type Shot = { x0: number; y0: number; x1: number; y1: number; age: number; life: number; colour: string; n: number };

export class Stage {
  lay: Layout = { narrow: false, a: { x: 0, y: 0, cell: 20 }, b: null, panel: { x: 0, y: 0, w: 0, h: 0 }, foot: 0 };
  private bits: Bit[] = [];
  private pops: Pop[] = [];
  private shots: Shot[] = [];
  private shake = [0, 0];
  private joy = [0, 0];
  private sweep = [0, 0];
  private overAt = [-1, -1];
  private last: [number, number][] = [[0, 0], [0, 0]];
  private t = 0;

  reset() { this.bits = []; this.pops = []; this.shots = []; this.shake = [0, 0]; this.joy = [0, 0]; this.sweep = [0, 0]; this.overAt = [-1, -1]; }
  private rect(side: number) { return side === 1 && this.lay.b ? this.lay.b : this.lay.a; }
  private at(side: number, x: number, y: number): [number, number] { const r = this.rect(side); return [r.x + (x + 0.5) * r.cell, r.y + (VISIBLE - 0.5 - y) * r.cell]; }
  private tray(side: number): [number, number] { const r = this.rect(side); return [r.x + r.cell * 3, r.y - r.cell * 0.6]; }

  /** Turn what a board just did into things to look at. */
  feed(side: number, events: Ev[]) {
    const r = this.rect(side), cell = r.cell, small = side === 1 && this.lay.narrow;
    for (const e of events) {
      if (e.t === 'pop') {
        let mx = 0, my = 0;
        for (const k of e.cells) {
          const [x, y] = this.at(side, k.x, k.y), p = PALETTE[k.c];
          mx += x / e.cells.length; my += y / e.cells.length;
          if (small) continue;
          for (let i = 0; i < 7; i++) { const a = Math.random() * TAU, v = cell * (2 + Math.random() * 5); this.bits.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - cell * 2, age: 0, life: 0.45 + Math.random() * 0.3, r: cell * (0.07 + Math.random() * 0.1), colour: i % 3 ? p.base : p.light, wait: 0.26, star: i === 0 }); }
        }
        this.last[side] = [mx, my];
        this.joy[side] = 1;
        if (e.chain >= 2) this.pops.push({ x: clamp(mx, r.x + cell * 1.6, r.x + cell * 4.4), y: my, text: `${e.chain} chain!`, age: 0, life: 1.1, size: cell * Math.min(1.25, 0.55 + e.chain * 0.12), colour: ['#fff', '#fff', '#ffe27a', '#ffb347', '#ff7a9c', '#d7a6ff'][Math.min(5, e.chain)] });
        else if (!small) this.pops.push({ x: mx, y: my, text: `+${e.score}`, age: 0, life: 0.7, size: cell * 0.36, colour: '#fff' });
      } else if (e.t === 'send' && this.lay.b) {
        const [x1, y1] = this.tray(1 - side);
        this.shots.push({ x0: this.last[side][0], y0: this.last[side][1], x1, y1, age: 0, life: 0.5, colour: '#ffd27a', n: e.n });
      } else if (e.t === 'offset') {
        const [x1, y1] = this.tray(side);
        this.shots.push({ x0: this.last[side][0], y0: this.last[side][1], x1, y1, age: 0, life: 0.35, colour: '#9fe8ff', n: e.n });
      } else if (e.t === 'dust') this.shake[side] = Math.min(1, 0.25 + e.n / 24);
      else if (e.t === 'sweep') this.sweep[side] = 1.8;
      else if (e.t === 'over') this.overAt[side] = this.t;
    }
  }
  update(dt: number) {
    this.t += dt;
    for (const b of this.bits) { if (b.wait > 0) { b.wait -= dt; continue; } b.age += dt; b.x += b.vx * dt; b.y += b.vy * dt; b.vy += 900 * dt; b.vx *= 0.97; }
    this.bits = this.bits.filter((b) => b.age < b.life);
    for (const p of this.pops) p.age += dt;
    this.pops = this.pops.filter((p) => p.age < p.life);
    for (const s of this.shots) s.age += dt;
    for (const s of this.shots) if (s.age >= s.life) for (let i = 0; i < 8; i++) { const a = Math.random() * TAU, v = 60 + Math.random() * 120; this.bits.push({ x: s.x1, y: s.y1, vx: Math.cos(a) * v, vy: Math.sin(a) * v, age: 0, life: 0.35, r: 2 + Math.random() * 2, colour: s.colour, wait: 0 }); }
    this.shots = this.shots.filter((s) => s.age < s.life);
    for (let i = 0; i < 2; i++) { this.shake[i] = Math.max(0, this.shake[i] - dt * 2.4); this.joy[i] = Math.max(0, this.joy[i] - dt * 1.1); this.sweep[i] = Math.max(0, this.sweep[i] - dt); }
  }

  /** Where everything goes for a canvas of this size. */
  layout(w: number, h: number, versus: boolean): Layout {
    const narrow = w < 640 || w < h * 0.92;
    if (narrow) {
      const side = clamp(w * 0.27, 92, 170), cell = Math.floor(Math.min((h - 16) / 13.3, (w - side - 26) / W));
      // Spare height under the board becomes a strip for the chinchilla and the rival to stand in.
      const spare = h - cell * 13.3 - 16, foot = versus && spare > cell * 1.5 ? Math.min(spare, cell * 2.6) : 0;
      const ax = Math.max(8, Math.round((w - side - 14 - cell * W) / 2)), ay = Math.round((h - foot - cell * 13.25) / 2 + cell * 1.25), px = ax + cell * W + 12, pw = w - px - 8;
      const mini = Math.floor(Math.min(pw - 8, (cell * 6.2) * 0.5) / W);
      return { narrow, foot, a: { x: ax, y: ay, cell }, b: versus ? { x: px + Math.round((pw - mini * W) / 2), y: ay + cell * 5.4, cell: mini } : null, panel: { x: px, y: ay, w: pw, h: cell * VISIBLE } };
    }
    const mid = versus ? 5.4 : 5, cols = versus ? W * 2 + mid : W + mid, cell = Math.floor(Math.min((h - 28) / 13.5, (w - 40) / (cols + 0.4)));
    const ax = Math.round((w - cell * cols) / 2), ay = Math.round((h - cell * VISIBLE) / 2 + cell * 0.55);
    return { narrow, foot: 0, a: { x: ax, y: ay, cell }, b: versus ? { x: ax + cell * (W + mid), y: ay, cell } : null, panel: { x: ax + cell * W, y: ay, w: cell * mid, h: cell * VISIBLE } };
  }

  draw(c: C2D, w: number, h: number, dpr: number, v: View, t: number) {
    const lay = (this.lay = this.layout(w, h, !!v.b));
    this.backdrop(c, w, h, t);
    this.board(c, dpr, lay.a, v.a, 0, t, v, false);
    if (v.b && lay.b) this.board(c, dpr, lay.b, v.b, 1, t, v, lay.narrow);
    if (lay.narrow) this.sidePanel(c, dpr, v, t); else this.midPanel(c, dpr, v, t);
    this.effects(c);
    if (v.result) { this.verdict(c, lay.a, v.result[0], true); if (lay.b && !lay.narrow) this.verdict(c, lay.b, v.result[1], false); }
    else if (v.banner) this.title(c, lay.a.x + lay.a.cell * 3, lay.a.y + lay.a.cell * 5, v.banner, lay.a.cell * 1.3, '#fff');
  }

  private backdrop(c: C2D, w: number, h: number, t: number) {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#2a2342'); g.addColorStop(0.6, '#4a2f55'); g.addColorStop(1, '#6b3f55');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    // Hills of bath dust along the bottom, and motes drifting up through the lamplight.
    for (let k = 0; k < 2; k++) {
      c.fillStyle = k ? 'rgba(255,214,170,0.10)' : 'rgba(255,214,170,0.06)';
      c.beginPath(); c.moveTo(0, h);
      for (let x = 0; x <= w; x += 24) c.lineTo(x, h - (k ? 26 : 58) - Math.sin(x * (k ? 0.011 : 0.006) + k * 2) * (k ? 14 : 30));
      c.lineTo(w, h); c.fill();
    }
    for (let i = 0; i < 36; i++) {
      const x = (hash(i) * w + Math.sin(t * 0.3 + i) * 18) % w, y = h - ((hash(i + 50) * h + t * (8 + hash(i + 9) * 16)) % h), r = 1 + hash(i + 20) * 2.4;
      c.fillStyle = `rgba(255,236,200,${0.06 + hash(i + 70) * 0.16})`;
      c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
    }
  }

  private board(c: C2D, dpr: number, r: Rect, b: Board, side: number, t: number, v: View, mini: boolean) {
    const cell = r.cell, bw = cell * W, bh = cell * VISIBLE, sh = this.shake[side], ox = sh ? Math.sin(t * 70) * sh * cell * 0.22 : 0, oy = sh ? Math.cos(t * 55) * sh * cell * 0.16 : 0;
    const top = b.grid[(VISIBLE - 4) * W + SPAWN_X] !== 0, danger = top && b.phase !== 'over';
    c.save(); c.translate(ox, oy);
    // The tray: a wooden box of bath dust.
    const pad = Math.max(3, cell * 0.22);
    c.fillStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.roundRect(r.x - pad, r.y - pad + 5, bw + pad * 2, bh + pad * 2, pad * 1.6); c.fill();
    const wood = c.createLinearGradient(r.x, r.y, r.x + bw, r.y + bh);
    wood.addColorStop(0, side ? '#8a5a6e' : '#b0773f'); wood.addColorStop(1, side ? '#5c3550' : '#7c4c25');
    c.fillStyle = wood; c.beginPath(); c.roundRect(r.x - pad, r.y - pad, bw + pad * 2, bh + pad * 2, pad * 1.6); c.fill();
    const well = c.createLinearGradient(0, r.y, 0, r.y + bh);
    well.addColorStop(0, '#221a30'); well.addColorStop(1, '#33243c');
    c.fillStyle = well; c.beginPath(); c.roundRect(r.x, r.y, bw, bh, pad * 0.7); c.fill();
    c.save(); c.beginPath(); c.roundRect(r.x, r.y, bw, bh, pad * 0.7); c.clip();
    c.fillStyle = 'rgba(255,255,255,0.028)';
    for (let x = 0; x < W; x += 2) c.fillRect(r.x + x * cell, r.y, cell, bh);
    if (danger) { const g = c.createLinearGradient(0, r.y, 0, r.y + cell * 5); g.addColorStop(0, `rgba(255,70,90,${0.26 + Math.sin(t * 9) * 0.12})`); g.addColorStop(1, 'rgba(255,70,90,0)'); c.fillStyle = g; c.fillRect(r.x, r.y, bw, cell * 5); }
    // The cell that ends the round when it fills.
    const [mx, my] = [r.x + (SPAWN_X + 0.5) * cell, r.y + cell * 0.5];
    c.strokeStyle = danger ? 'rgba(255,120,130,0.9)' : 'rgba(255,255,255,0.16)'; c.lineWidth = Math.max(1.5, cell * 0.09); c.lineCap = 'round';
    c.beginPath(); c.moveTo(mx - cell * 0.22, my - cell * 0.22); c.lineTo(mx + cell * 0.22, my + cell * 0.22); c.moveTo(mx + cell * 0.22, my - cell * 0.22); c.lineTo(mx - cell * 0.22, my + cell * 0.22); c.stroke();

    const moving = b.phase === 'drop' || b.phase === 'settle' || b.phase === 'dust', gone = b.span - b.timer;
    const over = this.overAt[side] >= 0 ? this.t - this.overAt[side] : -1, popT = b.phase === 'pop' ? 1 - b.timer / b.span : 0;
    const popping = b.popping.length ? new Set(b.popping) : null, won = !!v.result && !b.lost;
    const offs = (k: number) => (moving && b.fell[k] ? Math.max(0, b.fell[k] - gone * b.speed) : 0);
    const px = (x: number) => r.x + (x + 0.5) * cell, py = (y: number) => r.y + (VISIBLE - 0.5 - y) * cell;
    // Balls of one colour that touch are joined by a bead of fluff, so a group reads as one lump.
    if (cell >= 12 && over < 0 && !won) {
      const calm = (k: number) => !offs(k) && !popping?.has(k), e = Math.max(1, cell * 0.035), rr = cell * 0.27;
      for (let i = 0; i < W * VISIBLE; i++) {
        const col = b.grid[i];
        if (!col || col === DUST || !calm(i)) continue;
        const x = i % W, y = (i / W) | 0, q = PALETTE[col];
        for (const [ok, bx, by] of [[x < W - 1 && b.grid[i + 1] === col && calm(i + 1), px(x) + cell / 2, py(y)], [y < VISIBLE - 1 && b.grid[i + W] === col && calm(i + W), px(x), py(y) - cell / 2]] as [boolean, number, number][]) {
          if (!ok) continue;
          c.fillStyle = q.ink; c.beginPath(); c.arc(bx, by, rr + e, 0, TAU); c.fill();
          c.fillStyle = q.base; c.beginPath(); c.arc(bx, by, rr, 0, TAU); c.fill();
        }
      }
    }
    for (let i = 0; i < b.grid.length; i++) {
      const col = b.grid[i];
      if (!col) continue;
      const x = i % W, y = (i / W) | 0, off = offs(i);
      let cx = px(x), cy = py(y + off), sx = 1, sy = 1, alpha = 1, look: Look = 'rest';
      if (over >= 0) { const d = Math.max(0, over - 0.25 - hash(x + 3) * 0.3 - (VISIBLE - y) * 0.012); cy += d * d * cell * 30; cx += Math.sin(i) * d * cell * 2; look = 'wide'; if (cy > r.y + bh + cell) continue; }
      else if (popping?.has(i)) {
        look = 'wide';
        if (popT < 0.6) { if (Math.floor(popT * 14) % 2) alpha = 0.55; sx = sy = 1 + Math.sin(popT * 30) * 0.04; }
        else { const k = (popT - 0.6) / 0.4; sx = sy = 1 + k * 0.5; alpha = 1 - k; }
      } else if (moving && b.fell[i]) {
        const since = gone - b.fell[i] / b.speed;
        if (since >= 0 && since < 7) { const k = Math.sin((since / 7) * Math.PI) * 0.18; sx = 1 + k; sy = 1 - k; }
      } else if (won) cy -= Math.abs(Math.sin(t * 6 + x * 0.9)) * cell * 0.18;
      else if (col !== DUST) { if (danger && y >= VISIBLE - 5) look = 'worry'; else if (hash(i + Math.floor(t * 1.3 + hash(i) * 9)) > 0.93) look = 'blink'; }
      ball(c, dpr, cx, cy, cell, col, look, sx, sy, alpha);
    }
    c.restore();
    // The pair in play is drawn over the rim, so the ball still above the well can be seen.
    const p = b.pair;
    if (p && b.phase === 'fall') {
      const dx = [0, 1, 0, -1][p.rot], dy = [1, 0, -1, 0][p.rot];
      if (v.ghost && side === 0) for (const gst of b.ghost()) { c.strokeStyle = PALETTE[gst.c].base; c.globalAlpha = 0.75; c.lineWidth = Math.max(1.5, cell * 0.08); c.setLineDash([cell * 0.16, cell * 0.12]); c.beginPath(); c.arc(px(gst.x), py(gst.y), cell * 0.3, 0, TAU); c.stroke(); c.setLineDash([]); c.globalAlpha = 1; }
      const ay = py(p.y - p.sub);
      if (side === 0) { c.strokeStyle = `rgba(255,255,255,${0.5 + Math.sin(t * 8) * 0.25})`; c.lineWidth = Math.max(1.5, cell * 0.07); c.beginPath(); c.arc(px(p.x), ay, cell * 0.47, 0, TAU); c.stroke(); }
      ball(c, dpr, px(p.x + dx), ay - dy * cell, cell, p.b);
      ball(c, dpr, px(p.x), ay, cell, p.a);
    }
    if (this.sweep[side] > 0 && !mini) this.title(c, r.x + bw / 2, r.y + cell * 3.2 - (1.8 - this.sweep[side]) * cell * 0.4, 'Clean sweep!', cell * 0.62, '#aef5ff', Math.min(1, this.sweep[side] * 2));
    // Dust on its way: small clumps are one each, big ones six, boulders thirty.
    const n = b.pending + b.incoming;
    if (n > 0) {
      const icons: number[] = [];
      let left = n;
      while (left >= 30 && icons.length < 6) { icons.push(1.05); left -= 30; }
      while (left >= 6 && icons.length < 6) { icons.push(0.78); left -= 6; }
      while (left >= 1 && icons.length < 6) { icons.push(0.5); left -= 1; }
      let x = r.x + cell * 0.45;
      const y = r.y - cell * 0.72, wob = b.incoming ? Math.sin(t * 14) * cell * 0.04 : 0;
      for (const k of icons) { if (k > 1) { c.fillStyle = `rgba(255,120,90,${0.45 + Math.sin(t * 6) * 0.15})`; c.beginPath(); c.arc(x + (cell * k) / 2, y - cell * 0.02 + wob, cell * 0.56, 0, TAU); c.fill(); } ball(c, dpr, x + (cell * k) / 2, y + cell * (0.5 - k / 2) * 0.6 + wob, cell * k, DUST, 'rest', 1, 1, b.pending ? 1 : 0.6); x += cell * k * 0.92; }
      c.font = `900 ${Math.max(9, cell * 0.46)}px ${FONT}`; c.textAlign = 'right'; c.textBaseline = 'middle';
      c.lineWidth = Math.max(2, cell * 0.12); c.strokeStyle = '#2a1830'; c.fillStyle = n >= 18 ? '#ff8a8a' : '#ffe9c4';
      c.strokeText(`${n}`, r.x + bw - 2, y); c.fillText(`${n}`, r.x + bw - 2, y);
    }
    c.restore();
  }

  private title(c: C2D, x: number, y: number, text: string, size: number, colour: string, alpha = 1) {
    c.save(); c.globalAlpha = alpha; c.font = `900 ${size}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
    c.lineWidth = Math.max(3, size * 0.22); c.strokeStyle = '#2a1830'; c.strokeText(text, x, y); c.fillStyle = colour; c.fillText(text, x, y); c.restore();
  }
  private verdict(c: C2D, r: Rect, text: string, big: boolean) {
    const good = text === 'Win!';
    this.title(c, r.x + r.cell * 3, r.y + r.cell * (big ? 4.6 : 4.6), text, r.cell * (text.length > 5 ? 1.05 : 1.5), good ? '#ffe27a' : '#cfc6da');
  }
  private effects(c: C2D) {
    for (const b of this.bits) {
      if (b.wait > 0) continue;
      const k = 1 - b.age / b.life;
      c.globalAlpha = k; c.fillStyle = b.colour;
      c.beginPath();
      if (b.star) { for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + b.age * 6, rr = i % 2 ? b.r * 0.8 : b.r * 2; c.lineTo(b.x + Math.cos(a) * rr, b.y + Math.sin(a) * rr); } }
      else c.arc(b.x, b.y, b.r * (0.5 + k * 0.6), 0, TAU);
      c.fill();
    }
    c.globalAlpha = 1;
    for (const s of this.shots) {
      const k = s.age / s.life, e = k * k * (3 - 2 * k), x = s.x0 + (s.x1 - s.x0) * e, y = s.y0 + (s.y1 - s.y0) * e - Math.sin(k * Math.PI) * 60, r = 5 + Math.min(10, s.n * 0.5);
      const g = c.createRadialGradient(x, y, 0, x, y, r * 2.2);
      g.addColorStop(0, '#fff'); g.addColorStop(0.35, s.colour); g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.beginPath(); c.arc(x, y, r * 2.2, 0, TAU); c.fill();
    }
    for (const p of this.pops) {
      const k = p.age / p.life, grow = k < 0.15 ? 0.6 + (k / 0.15) * 0.55 : 1.15 - Math.min(0.15, (k - 0.15) * 0.6);
      this.title(c, p.x, p.y - k * p.size * 1.1, p.text, p.size * grow, p.colour, k > 0.75 ? (1 - k) / 0.25 : 1);
    }
  }

  private pairs(c: C2D, dpr: number, b: Board, x: number, y: number, s: number, label = 'NEXT') {
    c.fillStyle = 'rgba(20,12,30,0.55)'; c.beginPath(); c.roundRect(x, y, s * 2.5, s * 2.9, s * 0.3); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.14)'; c.lineWidth = 1; c.stroke();
    c.fillStyle = '#e9d8ff'; c.font = `800 ${Math.max(8, s * 0.3)}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(label, x + s * 1.25, y + s * 0.34);
    const one = b.peek(1), two = b.peek(2);
    if (one) { ball(c, dpr, x + s * 0.8, y + s * 1.15, s * 0.95, one[1]); ball(c, dpr, x + s * 0.8, y + s * 2.05, s * 0.95, one[0]); }
    if (two) { ball(c, dpr, x + s * 1.85, y + s * 1.45, s * 0.66, two[1]); ball(c, dpr, x + s * 1.85, y + s * 2.1, s * 0.66, two[0]); }
  }
  private text(c: C2D, s: string, x: number, y: number, px: number, colour: string, align: CanvasTextAlign = 'center', weight = 800) { c.font = `${weight} ${px}px ${FONT}`; c.textAlign = align; c.textBaseline = 'middle'; c.fillStyle = colour; c.fillText(s, x, y); }
  private pips(c: C2D, x: number, y: number, n: number, r: number, colour: string, dir: number) {
    for (let i = 0; i < 2; i++) { c.beginPath(); c.arc(x + dir * i * r * 2.7, y, r, 0, TAU); c.fillStyle = i < n ? colour : 'rgba(255,255,255,0.14)'; c.fill(); c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 1; c.stroke(); }
  }
  private mood(side: number, b: Board) { return { glad: this.joy[side] > 0, scared: b.grid[(VISIBLE - 4) * W + SPAWN_X] !== 0 || b.pending >= 12 }; }
  private hero(c: C2D, v: View, x: number, base: number, px: number, t: number) {
    const m = this.mood(0, v.a), hop = m.glad ? Math.abs(Math.sin(this.joy[0] * 9)) * px * 0.16 : 0;
    drawChinchilla(c, COATS[v.hero], x, base - hop, { face: 1, h: px, time: t, dizzy: v.a.lost || (m.scared && !m.glad), air: hop > px * 0.05 });
  }
  private foe(c: C2D, v: View, x: number, base: number, px: number, t: number) {
    if (!v.rival || !v.b) return;
    const m = this.mood(1, v.b), hop = m.glad ? Math.abs(Math.sin(this.joy[1] * 9)) * px * 0.14 : 0, lost = v.b.lost;
    c.save(); c.translate(x + (m.scared && !lost ? Math.sin(t * 40) * px * 0.012 : 0), base - hop); c.scale(-px / 24, px / 24); c.lineJoin = 'round';
    if (lost) { c.translate(0, -2); c.rotate(-0.5); }
    predator(c, v.rival.kind as PredKind, tintOf(v.rival.kind as PredKind, !!v.hard), t); c.restore();
  }

  /** Wide screens: everything that is not a board lives between the two of them (or beside the one). */
  private midPanel(c: C2D, dpr: number, v: View, t: number) {
    const { panel: p, a } = this.lay, cell = a.cell, cx = p.x + p.w / 2, name = v.hero === 'dora' ? 'Dora' : 'Enzo';
    if (v.b && v.rival) {
      this.pairs(c, dpr, v.a, p.x + cell * 0.25, p.y, cell * 0.92);
      this.pairs(c, dpr, v.b, p.x + p.w - cell * 0.25 - cell * 2.3, p.y, cell * 0.92);
      const y = p.y + cell * 3.5;
      this.pips(c, cx - cell * 0.5, y, v.wins?.[0] ?? 0, cell * 0.2, '#ffd75a', -1);
      this.pips(c, cx + cell * 0.5, y, v.wins?.[1] ?? 0, cell * 0.2, '#ff8a9c', 1);
      this.text(c, 'SCORE', cx, y + cell * 0.95, cell * 0.3, '#cbb9e6');
      this.text(c, `${v.a.score}`, cx - cell * 0.3, y + cell * 1.5, cell * 0.5, '#fff', 'right', 900);
      this.text(c, `${v.b.score}`, cx + cell * 0.3, y + cell * 1.5, cell * 0.5, '#ffc9d2', 'left', 900);
      const secs = Math.floor(v.a.tick / 60);
      this.text(c, `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`, cx, y + cell * 2.3, cell * 0.4, secs >= 96 ? '#ff9a8a' : '#e9d8ff');
      if (secs >= 96) this.text(c, 'dust is getting cheaper', cx, y + cell * 2.75, cell * 0.24, '#ff9a8a', 'center', 700);
      const base = p.y + p.h - cell * 0.5;
      this.hero(c, v, p.x + cell * 1.45, base, cell * 1.75, t);
      this.foe(c, v, p.x + p.w - cell * 1.3, base, cell * 1.9, t);
      this.text(c, name, p.x + cell * 1.3, base + cell * 0.32, cell * 0.36, '#fff');
      this.text(c, v.rival.name, p.x + p.w - cell * 1.3, base + cell * 0.32, cell * 0.36, '#ffc9d2');
      return;
    }
    this.pairs(c, dpr, v.a, p.x + cell * 0.6, p.y, cell * 1.05);
    let y = p.y + cell * 3.8;
    for (const [label, value] of v.stats ?? []) { this.text(c, label, p.x + cell * 0.7, y, cell * 0.3, '#cbb9e6', 'left'); this.text(c, value, p.x + cell * 0.7, y + cell * 0.55, cell * 0.56, '#fff', 'left', 900); y += cell * 1.35; }
    this.hero(c, v, p.x + cell * 2.9, p.y + p.h - cell * 0.2, cell * 2.2, t);
  }
  /** Phones: a column down the right with the next pairs, the rival's board in small, and the scores. */
  private sidePanel(c: C2D, dpr: number, v: View, t: number) {
    const { panel: p, a, b } = this.lay, cell = a.cell, s = Math.min(cell * 0.95, (p.w - 4) / 2.5), cx = p.x + p.w / 2;
    this.pairs(c, dpr, v.a, cx - s * 1.25, p.y, s);
    this.text(c, `${v.a.score}`, cx, p.y + s * 3.45, Math.min(cell * 0.6, p.w * 0.2), '#fff', 'center', 900);
    if (v.b && b && v.rival) {
      const top = b.y - b.cell * 2.6;
      const pr = Math.max(3, b.cell * 0.42);
      this.pips(c, cx - pr * 2.2, top, v.wins?.[0] ?? 0, pr, '#ffd75a', -1);
      this.pips(c, cx + pr * 2.2, top, v.wins?.[1] ?? 0, pr, '#ff8a9c', 1);
      this.text(c, v.rival.name, cx, b.y + b.cell * VISIBLE + Math.max(11, b.cell * 1.2), Math.max(10, Math.min(13, p.w * 0.11)), '#ffc9d2');
      if (v.result) this.title(c, cx, b.y + b.cell * 5, v.result[1], Math.max(12, b.cell * 1.5), v.result[1] === 'Win!' ? '#ffe27a' : '#cfc6da');
      const foot = this.lay.foot, base = a.y + cell * VISIBLE + foot + cell * 0.1;
      if (foot) { this.hero(c, v, a.x + cell * 2.2, base, foot * 0.62, t); this.foe(c, v, a.x + cell * 4.6, base, foot * 0.66, t); }
      return;
    }
    let y = p.y + s * 4.6;
    for (const [label, value] of v.stats ?? []) { this.text(c, label, cx, y, Math.max(9, cell * 0.3), '#cbb9e6'); this.text(c, value, cx, y + cell * 0.55, Math.min(cell * 0.56, p.w * 0.2), '#fff', 'center', 900); y += cell * 1.4; }
    this.hero(c, v, cx, p.y + p.h, Math.min(p.w * 0.8, cell * 3), t);
  }
}
