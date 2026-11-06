// Combo Ball: the drawing. The Codex-painted village pitch at 384 by 256, the fence along the top and the hedge along
// the bottom framing the 15 by 9 board of 22-pixel cells (a faint chequer, the goal mouths in chalk). On it: the chain
// so far, a gold line through every pass of the move we're building, brighter the longer it runs; then the other
// side's plan for its next turn, always on show (a red arrow for every move, red hatching on the cells each one will
// lunge into, orange on the cells their runners screen off, the ball's route and a dotted purple arrow for a tunnelling
// mole); then our side's overlay from the page (the selected player's reachable cells, the preview of a pass, long
// ball, shot or tackle, green when it works and red when it doesn't, the keeper's covered cells in blue, and the hint).
// Then everyone, sorted by row, in their own team's sprites, and the ball. After End turn the page hands over the
// turn's events and the scene plays them back at 120 ms a cell. On an upright phone the board turns a quarter so we
// attack upward; the players stay upright. Words are the page's job, so they stay sharp; nothing is written over a face.
import { COLS, ROWS, team } from './combo-game';
import type { Run } from './combo-game';
import type { Cell, Ev, Unit } from './tactics-football';
import { line } from './tactics-football';

export const W = 384, H = 256, X0 = 27, Y0 = 29, CELL = 22;
const LEAGUE = ['rabbit', 'frog', 'mole', 'otter', 'hog', 'magpie', 'fox', 'badger', 'grumble'];
export type Preview = { kind: 'pass' | 'loft' | 'shot' | 'tackle'; ok: boolean; cells: Cell[]; to: Cell; covered?: number[]; goal?: boolean };
export type Overlay = { sel: number; reach: Cell[]; preview: Preview | null; hint: Cell[]; hover: number; intents: boolean };
type Bit = { x: number; y: number; vx: number; vy: number; t: number; life: number; c: string };
type Step = { ev: Ev; dur: number };
const key = (c: number, r: number) => c * 100 + r;

export class ComboScene {
  private ctx: CanvasRenderingContext2D;
  private img: Record<string, HTMLImageElement> = {};
  upright = false;
  /** the playback of the last turn: where everyone's drawn (in landscape pixels), and the steps still to play */
  private shown = new Map<number, { x: number; y: number; run: boolean }>();
  private ball: { x: number; y: number; h: number } | null = null;
  private holder = -1;
  private steps: Step[] = [];
  private t0 = 0;
  private cur: { from: Map<number, { x: number; y: number }>; ball: { x: number; y: number } } | null = null;
  private bits: Bit[] = [];
  private shake = 0; private last = 0; private dive: { id: number; t: number } | null = null;
  onStep: ((e: Ev) => void) | null = null;
  constructor(private canvas: HTMLCanvasElement) {
    canvas.width = W; canvas.height = H;
    this.ctx = canvas.getContext('2d')!; this.ctx.imageSmoothingEnabled = false;
  }
  load() {
    const names: [string, string][] = [['pitch', '/art/combo/pitch.png']];
    const k = (n: string) => names.push([n, `/art/kickabout/${n}.png`]);
    for (const n of ['dora', 'enzo']) for (const f of ['stand', 'run1', 'run2', 'kick']) k(`${n}-${f}`);
    for (const n of ['pip']) for (const f of ['stand', 'run']) k(`${n}-${f}`);
    for (const n of LEAGUE) {
      for (const f of ['stand', 'run1', 'run2', 'slide']) k(`${n}-${f}`);
      const kp = n === 'grumble' ? 'gkeeper' : `${n}-keeper`;
      k(`${kp}-stand`); k(`${kp}-dive`);
    }
    k('keeper-stand'); k('keeper-dive'); k('ball');
    return Promise.all(names.map(([n, src]) => new Promise<void>((res) => { const im = new Image(); im.onload = () => { this.img[n] = im; res(); }; im.onerror = () => res(); im.src = src; })));
  }
  setUpright(u: boolean) {
    if (u === this.upright) return;
    this.upright = u;
    this.canvas.width = u ? H : W; this.canvas.height = u ? W : H; this.ctx.imageSmoothingEnabled = false;
  }
  /** a cell's centre in landscape pixels */
  centre(c: number, r: number) { return { x: X0 + c * CELL + CELL / 2, y: Y0 + r * CELL + CELL / 2 }; }
  /** landscape pixels to the canvas (on an upright phone the board turns so we attack upward) */
  map(x: number, y: number) { return this.upright ? { x: y, y: W - x } : { x, y }; }
  /** a point on the canvas (in canvas pixels) to a cell; columns -1 and 15 are the goals */
  toCell(px: number, py: number): Cell | null {
    const x = this.upright ? W - py : px, y = this.upright ? px : py;
    const c = Math.floor((x - X0) / CELL), r = Math.floor((y - Y0) / CELL);
    if (c < -1 || c > COLS || r < 0 || r >= ROWS) return null;
    return { c, r };
  }
  /** a cell's centre on the canvas, for the page's labels */
  screenOf(c: number, r: number) { const p = this.centre(c, r); return this.map(p.x, p.y); }

  // ---------------------------------------------------------------- playback
  get busy() { return this.steps.length > 0 || this.cur !== null; }
  /** play back what just happened, from where everyone stood before it */
  play(events: Ev[], before: { id: number; c: number; r: number }[], ballAt: Cell, holder: number, reduced: boolean) {
    this.shown.clear();
    for (const u of before) { const p = this.centre(u.c, u.r); this.shown.set(u.id, { ...p, run: false }); }
    const b = this.centre(ballAt.c, ballAt.r); this.ball = { ...b, h: 0 }; this.holder = holder;
    const per = reduced ? 50 : 120;
    this.steps = events.map((ev) => {
      const d = ev.k === 'move' ? per * Math.max(1, ev.path.length - 1)
        : ev.k === 'pass' ? per * 0.6 * Math.max(2, Math.hypot(ev.to.c - ev.from.c, ev.to.r - ev.from.r))
        : ev.k === 'shot' ? per * 0.45 * Math.max(3, Math.abs(ev.to.c - ev.from.c))
        : ev.k === 'goal' ? (reduced ? 400 : 1100) : ev.k === 'tackle' || ev.k === 'intercept' ? 300 : ev.k === 'kickoff' ? 350 : 0;
      return { ev, dur: d };
    }).filter((s) => s.dur > 0 || s.ev.k === 'whistle' || s.ev.k === 'full' || s.ev.k === 'turnover' || s.ev.k === 'golden');
    this.cur = null;
  }
  /** jump to the end of the playback */
  skip() { for (const s of this.steps) this.onStep?.(s.ev); this.steps = []; this.cur = null; this.ball = null; this.shown.clear(); }
  private advance(now: number) {
    while (true) {
      if (!this.cur) {
        const s = this.steps[0];
        if (!s) { this.shown.clear(); this.ball = null; return; }
        this.t0 = now;
        const from = new Map<number, { x: number; y: number }>();
        for (const [id, p] of this.shown) from.set(id, { x: p.x, y: p.y });
        this.cur = { from, ball: { x: this.ball?.x ?? 0, y: this.ball?.y ?? 0 } };
        this.onStep?.(s.ev);
        const e = s.ev;
        if (e.k === 'goal') { this.shake = 1; this.burst(e.team === 0); }
        if (e.k === 'shot' && (e.result === 'saved' || e.result === 'post')) { const kp = [...this.shown.keys()].find((id) => this.keeperIds.has(id) && this.side.get(id) !== e.team); if (kp !== undefined) this.dive = { id: kp, t: now }; }
      }
      const s = this.steps[0], k = s.dur ? Math.min(1, (now - this.t0) / s.dur) : 1, e = s.ev, cur = this.cur!;
      if (e.k === 'move') {
        const seg = (e.path.length - 1) * k, i = Math.min(e.path.length - 2, Math.floor(seg)), f = seg - i;
        const a = this.centre(e.path[Math.max(0, i)].c, e.path[Math.max(0, i)].r), b = e.path.length > 1 ? this.centre(e.path[i + 1].c, e.path[i + 1].r) : a;
        const p = { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, run: k < 1 };
        this.shown.set(e.id, p);
        if (this.holder === e.id && this.ball) { this.ball.x = p.x; this.ball.y = p.y; this.ball.h = 0; }
      } else if (e.k === 'pass' || e.k === 'shot') {
        const a = this.centre(e.from.c, e.from.r), b = this.centre(e.to.c, e.to.r);
        const lofted = e.k === 'pass' && e.lofted;
        this.ball = { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, h: lofted ? Math.sin(Math.PI * k) * 26 : 0 };
        this.holder = -1;
      } else if (e.k === 'kickoff') {
        this.shown.clear(); this.ball = null;
      }
      if (k < 1) return;
      if ('holder' in e) this.holder = e.holder;
      if (e.k === 'move' && this.shown.has(e.id)) this.shown.get(e.id)!.run = false;
      this.steps.shift(); this.cur = null;
      if (e.k === 'kickoff') { for (const r of this.steps) this.onStep?.(r.ev); this.steps = []; return; }
    }
  }
  private keeperIds = new Set<number>();
  private side = new Map<number, number>();
  private burst(ours: boolean) {
    const cs = ours ? ['#ffd23f', '#ff5a4a', '#ffffff', '#8ee070'] : ['#b48cff', '#7a5ad8', '#e8e0ff'];
    const g = this.centre(ours ? COLS : -1, 4);
    for (let i = 0; i < 46; i++) { const a = Math.random() * Math.PI * 2, v = 30 + Math.random() * 90; this.bits.push({ x: g.x, y: g.y, vx: Math.cos(a) * v * (ours ? -1 : 1) - (ours ? 30 : -30), vy: Math.sin(a) * v - 40, t: 0, life: 0.8 + Math.random() * 0.6, c: cs[i % cs.length] }); }
  }

  // ---------------------------------------------------------------- drawing
  draw(run: Run, ov: Overlay, now: number) {
    const g = run.game, s = g.s, x = this.ctx, dt = Math.min(0.05, (now - (this.last || now)) / 1000); this.last = now;
    this.keeperIds = new Set(s.units.filter((u) => u.keeper).map((u) => u.id));
    this.side = new Map(s.units.map((u) => [u.id, u.team]));
    if (this.busy) this.advance(now);
    const playing = this.busy;
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.fillStyle = '#0d1f10'; x.fillRect(0, 0, this.canvas.width, this.canvas.height);
    const sh = this.shake > 0 ? this.shake * 3 : 0; this.shake = Math.max(0, this.shake - dt * 2.2);
    const jx = sh ? (Math.random() - 0.5) * sh : 0, jy = sh ? (Math.random() - 0.5) * sh : 0;
    // the board, drawn in landscape and turned for an upright phone
    x.save();
    if (this.upright) { x.translate(jy, W + jx); x.rotate(-Math.PI / 2); } else x.translate(jx, jy);
    if (this.img.pitch) x.drawImage(this.img.pitch, 0, 0);
    for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) if ((c + r) % 2) { x.fillStyle = 'rgba(255,255,255,0.045)'; x.fillRect(X0 + c * CELL, Y0 + r * CELL, CELL, CELL); }
    x.strokeStyle = 'rgba(255,255,240,0.55)'; x.lineWidth = 1;
    x.beginPath(); x.moveTo(X0 + (COLS * CELL) / 2 + 0.5, Y0); x.lineTo(X0 + (COLS * CELL) / 2 + 0.5, Y0 + ROWS * CELL); x.stroke();
    x.beginPath(); x.arc(X0 + (COLS * CELL) / 2 + 0.5, Y0 + (ROWS * CELL) / 2, 26, 0, Math.PI * 2); x.stroke();
    // the goal mouths: chalk posts and a net
    for (const side of [0, 1] as const) {
      const [lo, hi] = g.mouth(side), gx = side === 0 ? X0 - 9 : X0 + COLS * CELL, gy = Y0 + lo * CELL, gh = (hi - lo + 1) * CELL;
      x.fillStyle = 'rgba(255,255,255,0.18)'; x.fillRect(gx, gy, 9, gh);
      x.strokeStyle = 'rgba(255,255,255,0.35)';
      for (let yy = gy + 4; yy < gy + gh; yy += 4) { x.beginPath(); x.moveTo(gx, yy + 0.5); x.lineTo(gx + 9, yy + 0.5); x.stroke(); }
      x.fillStyle = '#fbfbf0'; x.fillRect(gx, gy - 2, 9, 2); x.fillRect(gx, gy + gh, 9, 2); x.fillRect(side === 0 ? X0 - 2 : X0 + COLS * CELL, gy - 2, 2, gh + 4);
    }
    if (!playing && !s.over) this.chain(run, now);
    if (!playing && !s.over) {
      if (ov.intents) this.intents(run);
      this.ours(run, ov, now);
    }
    // confetti
    for (const b of this.bits) { b.t += dt; b.vy += 120 * dt; b.x += b.vx * dt; b.y += b.vy * dt; x.globalAlpha = Math.max(0, 1 - b.t / b.life); x.fillStyle = b.c; x.fillRect(Math.round(b.x), Math.round(b.y), 2, 2); }
    x.globalAlpha = 1; this.bits = this.bits.filter((b) => b.t < b.life);
    x.restore();
    this.people(run, ov, now, playing, jx, jy);
  }
  private hatch(c: number, r: number, col: string, fill: string) {
    const x = this.ctx, px = X0 + c * CELL, py = Y0 + r * CELL;
    x.fillStyle = fill; x.fillRect(px, py, CELL, CELL);
    x.save(); x.beginPath(); x.rect(px, py, CELL, CELL); x.clip();
    x.strokeStyle = col; x.lineWidth = 1.5;
    for (let d = -CELL; d < CELL; d += 6) { x.beginPath(); x.moveTo(px + d, py + CELL); x.lineTo(px + d + CELL, py); x.stroke(); }
    x.restore();
  }
  private arrow(pts: { x: number; y: number }[], col: string, w: number, dash: number[] = [], head = true) {
    if (pts.length < 2) return;
    const x = this.ctx;
    x.strokeStyle = col; x.lineWidth = w; x.setLineDash(dash); x.lineCap = 'round'; x.lineJoin = 'round';
    x.beginPath(); x.moveTo(pts[0].x, pts[0].y); for (const p of pts.slice(1)) x.lineTo(p.x, p.y); x.stroke(); x.setLineDash([]);
    if (!head) return;
    const a = pts[pts.length - 2], b = pts[pts.length - 1], ang = Math.atan2(b.y - a.y, b.x - a.x);
    x.fillStyle = col; x.beginPath(); x.moveTo(b.x + Math.cos(ang) * 3, b.y + Math.sin(ang) * 3);
    x.lineTo(b.x + Math.cos(ang + 2.5) * 6, b.y + Math.sin(ang + 2.5) * 6); x.lineTo(b.x + Math.cos(ang - 2.5) * 6, b.y + Math.sin(ang - 2.5) * 6); x.fill();
  }
  /** the chain we're building: a gold line through every pass of it, brighter and thicker the longer it runs */
  private chain(run: Run, now: number) {
    const x = this.ctx, ch = run.game.s.chain.filter((p) => p.team === 0);
    if (!ch.length) return;
    const n = ch.length, glow = 0.55 + 0.25 * Math.sin(now / 220);
    x.save(); x.lineCap = 'round';
    ch.forEach((p, i) => {
      const a = this.centre(p.a.c, p.a.r), b = this.centre(p.b.c, p.b.r), fresh = i === n - 1;
      x.strokeStyle = `rgba(255,${fresh ? 225 : 190},${fresh ? 90 : 50},${Math.min(0.95, 0.35 + i * 0.12) * glow + 0.15})`;
      x.lineWidth = Math.min(4, 1.5 + n * 0.35);
      if (p.lofted) { const m = { x: (a.x + b.x) / 2, y: Math.min(a.y, b.y) - 18 }; x.beginPath(); x.moveTo(a.x, a.y); x.quadraticCurveTo(m.x, m.y, b.x, b.y); x.stroke(); }
      else { x.beginPath(); x.moveTo(a.x, a.y); x.lineTo(b.x, b.y); x.stroke(); }
      x.fillStyle = '#ffe27a'; x.beginPath(); x.arc(b.x, b.y, 2, 0, Math.PI * 2); x.fill();
    });
    x.restore();
  }
  /** the other side's plan for its next turn, played out against where we stand now */
  private intents(run: Run) {
    const g = run.game, s = g.s, x = this.ctx, res = g.resolved(), seen = new Set<number>();
    for (const r of res) {
      for (const z of r.zone) { const k = key(z.c, z.r); if (seen.has(k)) continue; seen.add(k); this.hatch(z.c, z.r, 'rgba(255,70,60,0.75)', 'rgba(255,60,50,0.16)'); }
    }
    const scr = g.screened();
    if (scr) for (const k of scr) { const c = Math.floor(k / 100), r = k % 100; if (!seen.has(k) && g.inside(c, r)) this.hatch(c, r, 'rgba(255,160,40,0.7)', 'rgba(255,150,40,0.12)'); }
    for (const r of res) {
      if (r.path.length < 2) continue;
      const i = s.intents.find((t) => t.id === r.id);
      const pts = r.path.map((p) => this.centre(p.c, p.r));
      if (i?.tunnel) this.arrow([pts[0], pts[pts.length - 1]], 'rgba(200,140,255,0.95)', 2, [2, 3]);
      else this.arrow(pts, g.unit(r.id).keeper ? 'rgba(120,190,255,0.9)' : 'rgba(255,72,60,0.95)', 2);
    }
    // the ball's route
    const car = g.carrier, bi = s.bi;
    if (car && car.team === 1 && bi) {
      const end = (id: number) => { const r = res.find((q) => q.id === id); const u = g.unit(id); return r ? r.end : { c: u.c, r: u.r }; };
      const from = end(car.id), c0 = this.centre(from.c, from.r);
      const shots = (f: Cell) => { const [lo, hi] = g.mouth(0); for (let row = lo; row <= hi; row++) this.arrow([this.centre(f.c, f.r), this.centre(-1, row)], 'rgba(255,215,60,0.6)', 1.5, [3, 2]); };
      if (bi.k === 'shot') { const [lo, hi] = g.mouth(0); for (let row = lo; row <= hi; row++) this.arrow([c0, this.centre(-1, row)], g.openRows(car).includes(row) ? 'rgba(255,215,60,0.95)' : 'rgba(255,215,60,0.3)', 1.5, [3, 2]); }
      if (bi.k === 'pass') {
        const t = end(bi.to);
        this.arrow([c0, this.centre(t.c, t.r)], 'rgba(255,215,60,0.95)', 2, [4, 2]);
        for (const a of bi.alts ?? []) { const q = end(a); this.arrow([c0, this.centre(q.c, q.r)], 'rgba(255,215,60,0.45)', 1, [2, 3]); }
        if (bi.then !== undefined) { const q = end(bi.then); this.arrow([this.centre(t.c, t.r), this.centre(q.c, q.r)], 'rgba(255,215,60,0.8)', 1.5, [4, 2]); }
        if (bi.shoot !== undefined) shots(t);
      }
      if (bi.k === 'loft') {
        const t = end(bi.to), a = c0, b = this.centre(t.c, t.r), m = { x: (a.x + b.x) / 2, y: Math.min(a.y, b.y) - 24 };
        x.strokeStyle = 'rgba(255,215,60,0.95)'; x.lineWidth = 2; x.setLineDash([4, 2]); x.beginPath(); x.moveTo(a.x, a.y); x.quadraticCurveTo(m.x, m.y, b.x, b.y); x.stroke(); x.setLineDash([]);
        x.strokeStyle = 'rgba(255,215,60,0.95)'; x.beginPath(); x.arc(b.x, b.y, 8, 0, Math.PI * 2); x.stroke();
        if (bi.shoot !== undefined) shots(t);
      }
    }
  }
  /** our side's overlay: the reachable cells, a preview and the hint */
  private ours(run: Run, ov: Overlay, now: number) {
    const x = this.ctx, g = run.game;
    for (const c of ov.reach) { x.fillStyle = 'rgba(255,255,255,0.2)'; x.fillRect(X0 + c.c * CELL + 2, Y0 + c.r * CELL + 2, CELL - 4, CELL - 4); x.strokeStyle = 'rgba(255,215,60,0.7)'; x.lineWidth = 1; x.strokeRect(X0 + c.c * CELL + 2.5, Y0 + c.r * CELL + 2.5, CELL - 5, CELL - 5); }
    const p = ov.preview;
    if (p) {
      const col = p.ok ? 'rgba(120,255,120,0.95)' : 'rgba(255,90,80,0.95)';
      const sel = g.unit(ov.sel), a = this.centre(sel.c, sel.r), b = this.centre(p.to.c, p.to.r);
      if (p.kind === 'shot') {
        const [lo, hi] = g.mouth(1);
        for (let r = lo; r <= hi; r++) { const blue = p.covered?.includes(r); x.fillStyle = blue ? 'rgba(90,160,255,0.55)' : 'rgba(120,255,120,0.3)'; x.fillRect(X0 + COLS * CELL, Y0 + r * CELL, 9, CELL); }
      }
      if (p.kind === 'loft') { const m = { x: (a.x + b.x) / 2, y: Math.min(a.y, b.y) - 26 }; x.strokeStyle = col; x.lineWidth = 2; x.setLineDash([4, 2]); x.beginPath(); x.moveTo(a.x, a.y); x.quadraticCurveTo(m.x, m.y, b.x, b.y); x.stroke(); x.setLineDash([]); x.beginPath(); x.arc(b.x, b.y, 8, 0, Math.PI * 2); x.stroke(); }
      else if (p.kind !== 'tackle') this.arrow(p.cells.length > 1 ? [a, ...p.cells.slice(1).map((c) => this.centre(c.c, c.r))] : [a, b], col, 2.5);
      else { x.strokeStyle = col; x.lineWidth = 2; x.strokeRect(X0 + p.to.c * CELL + 1, Y0 + p.to.r * CELL + 1, CELL - 2, CELL - 2); }
    }
    const pulse = 0.55 + 0.45 * Math.sin(now / 160);
    for (const c of ov.hint) { x.strokeStyle = `rgba(255,215,60,${pulse})`; x.lineWidth = 2; x.strokeRect(X0 + c.c * CELL + 1, Y0 + c.r * CELL + 1, CELL - 2, CELL - 2); }
  }
  private sprite(u: Unit, running: boolean, now: number) {
    const ours = u.team === 0, who = u.who;
    if (u.keeper) return this.img[`${who}-${this.dive && this.dive.id === u.id && now - this.dive.t < 700 ? 'dive' : 'stand'}`] ?? this.img[`${who}-stand`];
    if (running) {
      const f = Math.floor(now / 110) % 2;
      return this.img[`${who}-run${f + 1}`] ?? (f ? this.img[`${who}-run`] : this.img[`${who}-stand`]) ?? this.img[`${who}-stand`];
    }
    return this.img[`${who}-stand`] ?? this.img[ours ? 'dora-stand' : `${team(0).sprite}-stand`];
  }
  /** everyone, upright, sorted by how far down the screen they stand, and the ball */
  private people(run: Run, ov: Overlay, now: number, playing: boolean, jx: number, jy: number) {
    const x = this.ctx, g = run.game, s = g.s;
    const list = s.units.map((u) => {
      const sh = playing ? this.shown.get(u.id) : undefined;
      const lp = sh ?? this.centre(u.c, u.r);
      return { u, lp, p: this.map(lp.x, lp.y), run: !!sh?.run };
    }).sort((a, b) => a.p.y - b.p.y);
    for (const { u, p, run: running } of list) {
      const px = Math.round(p.x + jx), py = Math.round(p.y + jy);
      x.fillStyle = 'rgba(0,0,0,0.3)'; x.beginPath(); x.ellipse(px, py + 8, 6, 2.5, 0, 0, Math.PI * 2); x.fill();
      if (!playing && u.id === ov.sel) { x.strokeStyle = '#ffd23f'; x.lineWidth = 1.5; x.beginPath(); x.ellipse(px, py + 8, 9, 4, 0, 0, Math.PI * 2); x.stroke(); }
      else if (!playing && u.id === ov.hover) { x.strokeStyle = 'rgba(255,255,255,0.8)'; x.lineWidth = 1; x.beginPath(); x.ellipse(px, py + 8, 8, 3.5, 0, 0, Math.PI * 2); x.stroke(); }
      if (!playing && u.team === 0 && !s.over && g.canMove(u) && run.phase === 'play') { x.fillStyle = '#ffd23f'; x.fillRect(px - 1, py - 15, 2, 2); }
      const im = this.sprite(u, running, now);
      if (!im) continue;
      const w = im.naturalWidth, h = im.naturalHeight, flip = u.team === 1;
      x.save(); x.translate(px, py + 9 - h);
      if (flip) { x.scale(-1, 1); x.drawImage(im, -Math.round(w / 2), 0); } else x.drawImage(im, -Math.round(w / 2), 0);
      x.restore();
    }
    // the ball
    let b: { x: number; y: number; h: number } | null = null;
    if (playing && this.ball) {
      const hp = this.holder >= 0 ? this.shown.get(this.holder) : undefined;
      b = hp ? { x: hp.x, y: hp.y, h: 0 } : this.ball;
    } else {
      const c = g.ballCell(), p = this.centre(c.c, c.r); b = { ...p, h: 0 };
    }
    if (b && this.img.ball) {
      const held = !playing ? s.ball.holder >= 0 : this.holder >= 0;
      const off = held ? (this.side.get(playing ? this.holder : s.ball.holder) === 1 ? -5 : 5) : 0;
      const q = this.map(b.x + off, b.y);
      const bx = Math.round(q.x + jx), by = Math.round(q.y + jy + 6);
      x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(bx - 3, by + 2, 6, 2);
      x.drawImage(this.img.ball, bx - 3, Math.round(by - 3 - b.h));
    }
  }
  /** the shot lines used by previews: from a cell to a row of the goal we attack */
  static shotLine(from: Cell, row: number) { return line(from, { c: COLS, r: row }); }
}
