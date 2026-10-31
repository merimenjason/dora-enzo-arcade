// Starstitch: drawing only, Canvas 2D. The night painting behind, a few twinkling background stars, the
// constellation's stars (bright rays, knots, twins, moons), its faint dotted seams (doubled, one-way comets, or hidden
// under drifting clouds until the pointer comes near), the silver thread as it is stitched and the needle on the
// end of it, sparkles for each stitch, and the golden blaze with the painted figure fading in when it is done.
// Dora and Enzo lie on the hill in the corner, painted cut-outs in three moods. Every painting has a drawn stand-in
// until (or unless) it loads.
import { drawChinchilla } from './chinchilla-art';
import type { Puzzle, Stitch, Refusal } from './stars-game';
import type { Hint } from './stars-solver';

export type Mood = 'point' | 'gasp' | 'sleepy';
export type DrawOpts = {
  dt: number; st: Stitch | null; night: number; pointer: [number, number] | null; mood: Mood;
  hint: Hint | null; blaze: number; focus: number; touch: boolean;
};
const TWIN_COL = ['#7fe3d0', '#ff9ec7', '#c6a2ff', '#ffd27a'];
const GOLD = '#ffd66b', SILVER = '#eef4ff';
type Spark = { x: number; y: number; vx: number; vy: number; life: number; max: number; col: string; size: number };
type Placing = { ox: number; oy: number; s: number; pair: [number, number, number, number] };

export class StarsScene {
  readonly cv: HTMLCanvasElement; private c: CanvasRenderingContext2D;
  W = 0; H = 0; private dpr = 1;
  /** The stage's clear area; `sky`, when set, is the lowest the constellation may come (above the done card). */
  inset: { top: number; right: number; bottom: number; left: number; sky?: number } = { top: 0, right: 0, bottom: 0, left: 0 };
  tall = false;
  private p: Puzzle | null = null;
  private ox = 0; private oy = 0; private s = 1;
  private bx = 0; private by = 0; private bw = 100; private bh = 80;
  private pair: [number, number, number, number] = [0, 0, 0, 0];
  private glide: { from: Placing; to: Placing; t: number } | null = null;
  private field: [number, number, number, number] = [0, 0, 0, 0];
  private art = new Map<string, HTMLImageElement>();
  private time = 0; private sparks: Spark[] = []; private shakes = new Map<number, number>();
  private reveal: number[] = []; private bg: [number, number, number, number][] = [];
  private moodT = 0; private lastMood: Mood = 'point'; private lastStitch = -1; private stitchT = 0;

  constructor(cv: HTMLCanvasElement) {
    this.cv = cv;
    const c = cv.getContext('2d'); if (!c) throw new Error('no canvas');
    this.c = c;
    // the background stars, the same every time
    let a = 12345; const r = () => { a = (a * 1103515245 + 12345) & 0x7fffffff; return a / 0x7fffffff; };
    for (let i = 0; i < 140; i++) this.bg.push([r(), r() * 0.8, 0.3 + r() * 1.2, r() * 6.28]);
    for (const n of ['pair-point', 'pair-gasp', 'pair-sleepy']) this.load(n);
    this.resize();
  }
  private load(name: string) { if (this.art.has(name)) return; const img = new Image(); img.decoding = 'async'; img.src = `/art/stars/${name}.webp`; this.art.set(name, img); }
  want(name: string) { this.load(name); }
  img(name: string): HTMLImageElement | null { const i = this.art.get(name); return i && i.complete && i.naturalWidth > 0 ? i : null; }
  resize() {
    const r = this.cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = Math.max(1, Math.round(r.width)), H = Math.max(1, Math.round(r.height));
    if (W !== this.W || H !== this.H || dpr !== this.dpr) { this.W = W; this.H = H; this.dpr = dpr; this.cv.width = Math.round(W * dpr); this.cv.height = Math.round(H * dpr); }
    this.layout();
  }
  setPuzzle(p: Puzzle | null) {
    this.p = p; this.sparks = []; this.shakes.clear(); this.lastStitch = -1;
    this.reveal = p ? p.seams.map(() => 0) : [];
    if (p?.figure) this.load('fig-' + p.figure);
    this.layout();
  }
  /** Where things go: Dora and Enzo in the corner, the constellation in the biggest clear space left. With `glide`,
   *  the sky and the pair drift over to their new places (when the done card makes room for itself) instead of jumping. */
  layout(glide = false) {
    const from = glide && this.p ? { ox: this.ox, oy: this.oy, s: this.s, pair: [...this.pair] as [number, number, number, number] } : null;
    this.glide = null;
    this.place();
    if (from && (Math.abs(from.s - this.s) > 1e-3 || Math.abs(from.ox - this.ox) > 0.5 || Math.abs(from.oy - this.oy) > 0.5 || from.pair.some((v, i) => Math.abs(v - this.pair[i]) > 0.5))) {
      this.glide = { from, to: { ox: this.ox, oy: this.oy, s: this.s, pair: [...this.pair] as [number, number, number, number] }, t: 0 };
      this.ox = from.ox; this.oy = from.oy; this.s = from.s; this.pair = from.pair;
    }
  }
  /** Eases the sky and the pair along a glide. */
  private glideOn(dt: number) {
    const g = this.glide; if (!g) return;
    g.t = Math.min(1, g.t + dt / 0.6);
    const k = g.t * g.t * (3 - 2 * g.t), mix = (a: number, b: number) => a + (b - a) * k;
    this.ox = mix(g.from.ox, g.to.ox); this.oy = mix(g.from.oy, g.to.oy); this.s = mix(g.from.s, g.to.s);
    this.pair = g.from.pair.map((v, i) => mix(v, g.to.pair[i])) as [number, number, number, number];
    if (g.t >= 1) this.glide = null;
  }
  private place() {
    const { W, H } = this, I = this.inset;
    this.tall = H > W * 1.05;
    if (this.tall) {
      this.pair = this.tallPair(); const ph = this.pair[3];
      this.field = [12, I.top + 8, W - 12, Math.min(this.pair[1] + ph * 0.12, I.sky || Infinity)];
    } else {
      const ph = Math.max(80, Math.min(H * 0.32, 380, W * 0.19)), pw = ph * 2;
      this.pair = [6, H - ph - 2, pw, ph];
      // beside them, or above them: whichever leaves the sky bigger
      const a: [number, number, number, number] = [pw + 4, I.top + 10, W - 16 - I.right, Math.min(H - I.bottom - 8, H * 0.8)];
      const b: [number, number, number, number] = [16 + I.left, I.top + 10, W - 16 - I.right, Math.min(H - ph - 4, H * 0.8)];
      const sc = (f: number[]) => Math.min((f[2] - f[0]) / 100, (f[3] - f[1]) / 80);
      this.field = sc(a) >= sc(b) ? a : b;
    }
    const p = this.p; if (!p) return;
    const xs = p.stars.map((q) => q.x), ys = p.stars.map((q) => q.y);
    this.bx = Math.min(...xs); this.by = Math.min(...ys); this.bw = Math.max(20, Math.max(...xs) - this.bx); this.bh = Math.max(20, Math.max(...ys) - this.by);
    const [l, t, r, b] = this.field, pad = 26;
    this.s = Math.max(0.5, Math.min((r - l - pad * 2) / this.bw, (b - t - pad * 2) / this.bh, 9));
    this.ox = (l + r) / 2 - (this.bx + this.bw / 2) * this.s;
    this.oy = (t + b) / 2 - (this.by + this.bh / 2) * this.s;
  }
  /** Where Dora and Enzo lie on a tall screen for the current inset: centred, just above the bottom. */
  tallPair(): [number, number, number, number] {
    const { W, H } = this, I = this.inset, pw = Math.min(W * 0.78, (H - I.top - I.bottom) * 0.26 * 2), ph = pw / 2;
    return [(W - pw) / 2, H - I.bottom - ph - 2, pw, ph];
  }
  toSky(px: number, py: number): [number, number] { return [(px - this.ox) / this.s, (py - this.oy) / this.s]; }
  toScreen(x: number, y: number): [number, number] { return [this.ox + x * this.s, this.oy + y * this.s]; }
  /** How close (in sky units) a press must be to count as on a star. */
  hitRadius(touch: boolean) {
    const p = this.p; let near = 30;
    if (p) for (let i = 0; i < p.stars.length; i++) for (let j = i + 1; j < p.stars.length; j++) near = Math.min(near, Math.hypot(p.stars[i].x - p.stars[j].x, p.stars[i].y - p.stars[j].y));
    return Math.min((touch ? 30 : 22) / this.s, near * 0.48);
  }
  metrics() { return { pair: this.pair, field: this.field, scale: this.s, W: this.W, H: this.H, tall: this.tall }; }
  refuse(i: number) { this.shakes.set(i, 0.45); }
  /** Sparkles for what just happened. */
  feed(evs: { k: string; to?: number; at?: number }[]) {
    const p = this.p; if (!p) return;
    for (const e of evs) {
      if (e.k === 'stitch' || e.k === 'jump') { const q = p.stars[e.to!]; this.burst(q.x, q.y, e.k === 'jump' ? 10 : 7, e.k === 'jump' ? TWIN_COL[0] : SILVER); }
      else if (e.k === 'start') { const q = p.stars[e.at!]; this.burst(q.x, q.y, 8, SILVER); }
      else if (e.k === 'done') for (const q of p.stars) this.burst(q.x, q.y, 9, GOLD);
    }
  }
  private burst(x: number, y: number, n: number, col: string) {
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + Math.random() * 0.5, v = 0.08 + Math.random() * 0.14; this.sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: 0.5 + Math.random() * 0.5, col, size: 1 + Math.random() * 1.6 }); }
  }

  draw(o: DrawOpts) {
    const c = this.c, { W, H } = this;
    this.time += o.dt;
    this.glideOn(o.dt);
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.sky(o.night);
    const st = o.st, p = this.p;
    if (st && p) this.constellation(st, p, o);
    this.chinchillas(o.mood, o.dt);
    // sparkles
    for (const sp of this.sparks) { sp.life += o.dt; sp.x += sp.vx * o.dt * 60 / 6; sp.y += sp.vy * o.dt * 60 / 6; }
    this.sparks = this.sparks.filter((sp) => sp.life < sp.max);
    c.save(); c.globalCompositeOperation = 'lighter';
    for (const sp of this.sparks) { const [x, y] = this.toScreen(sp.x, sp.y), k = 1 - sp.life / sp.max; c.globalAlpha = k; c.fillStyle = sp.col; c.beginPath(); c.arc(x, y, sp.size * (0.6 + k), 0, Math.PI * 2); c.fill(); }
    c.restore();
    void W; void H;
  }
  private sky(night: number) {
    const c = this.c, { W, H } = this, img = this.img(`night-${Math.max(1, Math.min(5, night))}`);
    if (img) {
      const sc = Math.max(W / img.naturalWidth, H / img.naturalHeight), w = img.naturalWidth * sc, h = img.naturalHeight * sc;
      c.drawImage(img, (W - w) / 2, H - h, w, h);
      // hush the middle of the sky so the stars stand out
      const g = c.createRadialGradient(W / 2, H * 0.42, 0, W / 2, H * 0.42, Math.max(W, H) * 0.7);
      g.addColorStop(0, 'rgba(6,8,28,0.5)'); g.addColorStop(1, 'rgba(6,8,28,0.12)');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
    } else {
      const tops = ['#1a2350', '#1c1d4a', '#12233f', '#101a3a', '#1b1340', '#1d1650'], bots = ['#5b4a7a', '#4a2f45', '#2c4a5a', '#1f3a55', '#4a2a5a', '#40306a'];
      const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, tops[night] ?? tops[0]); g.addColorStop(1, bots[night] ?? bots[0]);
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      c.fillStyle = '#16231f'; c.beginPath(); c.moveTo(0, H); c.lineTo(0, H * 0.86);
      c.quadraticCurveTo(W * 0.3, H * 0.76, W * 0.6, H * 0.84); c.quadraticCurveTo(W * 0.85, H * 0.9, W, H * 0.82); c.lineTo(W, H); c.fill();
      c.fillStyle = '#e7b45a'; c.beginPath(); c.arc(W * 0.78, H * 0.9, Math.min(W, H) * 0.025, Math.PI, 0); c.fill();
    }
    c.save(); c.globalCompositeOperation = 'lighter';
    for (const [x, y, r, ph] of this.bg) { c.globalAlpha = 0.25 + 0.25 * Math.sin(this.time * 1.3 + ph); c.fillStyle = '#dfe6ff'; c.beginPath(); c.arc(x * W, y * H, r, 0, Math.PI * 2); c.fill(); }
    c.restore();
  }
  private constellation(st: Stitch, p: Puzzle, o: DrawOpts) {
    const c = this.c, s = this.s, t = this.time, R = Math.max(4, Math.min(9, s * 1.7));
    const at = st.at, opts = new Set(st.options()), blaze = o.blaze;
    // the painted figure, fading in behind a finished constellation
    const fig = p.figure ? this.img('fig-' + p.figure) : null;
    if (fig && blaze > 0.2) {
      const k = Math.min(1, (blaze - 0.2) / 0.8), size = Math.max(this.bw, this.bh) * s * 1.25, [cx, cy] = this.toScreen(this.bx + this.bw / 2, this.by + this.bh / 2);
      c.save(); c.globalCompositeOperation = 'screen'; c.globalAlpha = 0.85 * k; c.drawImage(fig, cx - size / 2, cy - size / 2, size, size); c.restore();
    }
    // clouds drift over part of the sky
    for (const [i, cl] of p.clouds.entries()) {
      const [cx, cy] = this.toScreen(cl.x + Math.sin(t * 0.3 + i) * 1.5, cl.y + Math.cos(t * 0.25 + i) * 0.8), r = cl.r * s;
      c.save();
      for (let k = 0; k < 6; k++) {
        const a = k * 1.05 + i, px = cx + Math.cos(a) * r * 0.45, py = cy + Math.sin(a) * r * 0.3, pr = r * (0.55 + 0.1 * Math.sin(k * 2.1));
        const g = c.createRadialGradient(px, py, 0, px, py, pr); g.addColorStop(0, 'rgba(170,170,205,0.5)'); g.addColorStop(1, 'rgba(170,170,205,0)');
        c.fillStyle = g; c.beginPath(); c.arc(px, py, pr, 0, Math.PI * 2); c.fill();
      }
      c.restore();
    }
    // what the clouds let through: seams near the pointer or the needle glimmer, then fade
    const eyes: [number, number][] = [];
    if (o.pointer) eyes.push(o.pointer);
    if (at >= 0) eyes.push([p.stars[at].x, p.stars[at].y]);
    p.seams.forEach((sm, i) => {
      if (!sm.cloud) return;
      const mx = (p.stars[sm.a].x + p.stars[sm.b].x) / 2, my = (p.stars[sm.a].y + p.stars[sm.b].y) / 2;
      const near = eyes.some(([x, y]) => Math.hypot(x - mx, y - my) < 15);
      this.reveal[i] = near ? Math.min(1, (this.reveal[i] ?? 0) + o.dt * 5) : Math.max(0, (this.reveal[i] ?? 0) - o.dt * 0.8);
    });
    // the seams still to stitch
    c.save(); c.lineCap = 'round';
    p.seams.forEach((sm, i) => {
      const left = sm.need - st.count[i]; if (left <= 0) return;
      const vis = sm.cloud ? this.reveal[i] ?? 0 : 1; if (vis <= 0.01) return;
      const A = p.stars[sm.a], B = p.stars[sm.b], [ax, ay] = this.toScreen(A.x, A.y), [bx, by] = this.toScreen(B.x, B.y);
      const L = Math.hypot(bx - ax, by - ay) || 1, nx = -(by - ay) / L, ny = (bx - ax) / L;
      const hintIt = o.hint?.k === 'next' && ((sm.a === at && sm.b === o.hint.to) || (sm.b === at && sm.a === o.hint.to));
      c.globalAlpha = vis * (hintIt ? 0.9 + 0.1 * Math.sin(t * 6) : 0.55);
      c.strokeStyle = hintIt ? GOLD : '#c9d6ff'; c.lineWidth = hintIt ? 3 : 2; c.setLineDash([0.1, 7]);
      const lines = left === 2 ? [-2.5, 2.5] : sm.need === 2 ? [2.5] : [0];
      for (const off of lines) { c.beginPath(); c.moveTo(ax + nx * off, ay + ny * off); c.lineTo(bx + nx * off, by + ny * off); c.stroke(); }
      if (sm.need === 2 && left === 2) { c.setLineDash([]); c.globalAlpha = vis * 0.18; c.lineWidth = 7; c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke(); }
      if (sm.oneway) {
        // a little comet flying the right way, and a chevron in the middle
        c.setLineDash([]);
        const u = (t * 0.4 + i * 0.37) % 1, hx = ax + (bx - ax) * u, hy = ay + (by - ay) * u, dx = (bx - ax) / L, dy = (by - ay) / L;
        const g = c.createLinearGradient(hx - dx * 26, hy - dy * 26, hx, hy); g.addColorStop(0, 'rgba(140,220,255,0)'); g.addColorStop(1, 'rgba(160,230,255,0.9)');
        c.globalAlpha = vis; c.strokeStyle = g; c.lineWidth = 3; c.beginPath(); c.moveTo(hx - dx * 26, hy - dy * 26); c.lineTo(hx, hy); c.stroke();
        c.fillStyle = '#d8f4ff'; c.beginPath(); c.arc(hx, hy, 2.6, 0, Math.PI * 2); c.fill();
        const mx = (ax + bx) / 2, my = (ay + by) / 2, k = 7;
        c.strokeStyle = '#9fe0ff'; c.lineWidth = 2.4; c.beginPath(); c.moveTo(mx - dx * k + nx * k, my - dy * k + ny * k); c.lineTo(mx + dx * k * 0.4, my + dy * k * 0.4); c.lineTo(mx - dx * k - nx * k, my - dy * k - ny * k); c.stroke();
      }
    });
    c.restore();
    // the thread
    const moves = st.moves, nMoves = moves.length;
    if (moves.length && moves[moves.length - 1].seam !== this.lastStitch) { this.lastStitch = moves[moves.length - 1].seam; this.stitchT = 0; }
    this.stitchT += o.dt;
    const drawn = new Map<number, number>();
    c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
    moves.forEach((m, k) => {
      const sm = p.seams[m.seam], n = (drawn.get(m.seam) ?? 0) + 1; drawn.set(m.seam, n);
      const A = p.stars[m.from], B = p.stars[m.to], [ax, ay] = this.toScreen(A.x, A.y), [bx, by] = this.toScreen(B.x, B.y);
      const L = Math.hypot(bx - ax, by - ay) || 1, nx = -(by - ay) / L, ny = (bx - ax) / L, off = sm.need === 2 ? (n === 1 ? -2.5 : 2.5) : 0;
      const gold = blaze > 0 && blaze * 1.3 > k / Math.max(1, nMoves);
      const fresh = k === nMoves - 1 ? Math.max(0, 1 - this.stitchT * 2) : 0;
      // draw the newest stitch growing out from its star
      const grow = k === nMoves - 1 ? Math.min(1, this.stitchT * 7) : 1;
      c.shadowColor = gold ? '#ffb83a' : '#a9c4ff'; c.shadowBlur = gold ? 16 : 9 + fresh * 10;
      c.strokeStyle = gold ? GOLD : SILVER; c.lineWidth = gold ? 3.6 : 2.6 + fresh * 1.5;
      c.beginPath(); c.moveTo(ax + nx * off, ay + ny * off); c.lineTo(ax + nx * off + (bx - ax) * grow, ay + ny * off + (by - ay) * grow); c.stroke();
      if (m.land !== m.to) {
        // the needle's leap between twins: a dotted arc
        const C = p.stars[m.land], [cx2, cy2] = this.toScreen(C.x, C.y), mx = (bx + cx2) / 2, my = (by + cy2) / 2 - Math.hypot(cx2 - bx, cy2 - by) * 0.25;
        c.shadowBlur = 6; c.strokeStyle = TWIN_COL[this.twinIdx(p, m.to)]; c.lineWidth = 1.6; c.setLineDash([3, 6]);
        c.beginPath(); c.moveTo(bx, by); c.quadraticCurveTo(mx, my, cx2, cy2); c.stroke(); c.setLineDash([]);
      }
    });
    // the loose end, from the needle to the pointer
    if (at >= 0 && o.pointer && st.dragging && !st.done) {
      const [ax, ay] = this.toScreen(p.stars[at].x, p.stars[at].y), [px, py] = this.toScreen(o.pointer[0], o.pointer[1]);
      c.shadowBlur = 6; c.shadowColor = '#a9c4ff'; c.strokeStyle = 'rgba(238,244,255,0.75)'; c.lineWidth = 1.6;
      c.beginPath(); c.moveTo(ax, ay); c.quadraticCurveTo((ax + px) / 2, (ay + py) / 2 + 10, px, py); c.stroke();
    }
    c.restore();
    // the stars
    p.stars.forEach((q, i) => {
      let [x, y] = this.toScreen(q.x, q.y);
      const sh = this.shakes.get(i) ?? 0; if (sh > 0) { x += Math.sin(t * 60) * 4 * (sh / 0.45); this.shakes.set(i, sh - o.dt); }
      const v = st.visits[i], isAt = i === at, isOpt = opts.has(i), done = st.done;
      const swell = done ? 1 + 0.35 * Math.max(0, Math.sin(Math.min(1, blaze * 2) * Math.PI)) : 1, r = R * swell * (isAt ? 1.15 : 1);
      // moons sit behind their stars
      if (q.moon) {
        c.save(); c.fillStyle = 'rgba(255,240,190,0.9)'; c.shadowColor = '#ffe9a8'; c.shadowBlur = 14;
        c.beginPath(); c.arc(x, y, r + 9, 0, Math.PI * 2); c.fill();
        if (q.moon === 'start') { c.globalCompositeOperation = 'destination-out'; c.shadowBlur = 0; c.beginPath(); c.arc(x + (r + 9) * 0.5, y - (r + 9) * 0.25, r + 8, 0, Math.PI * 2); c.fill(); }
        c.restore();
      }
      c.save();
      const glow = c.createRadialGradient(x, y, 0, x, y, r * 3.4);
      const core = done ? GOLD : v ? '#fff6e0' : '#e8efff';
      glow.addColorStop(0, done ? 'rgba(255,214,107,0.55)' : v ? 'rgba(255,240,210,0.45)' : 'rgba(200,215,255,0.35)'); glow.addColorStop(1, 'rgba(200,215,255,0)');
      c.fillStyle = glow; c.beginPath(); c.arc(x, y, r * 3.4, 0, Math.PI * 2); c.fill();
      c.fillStyle = core; c.beginPath(); c.arc(x, y, r * 0.62, 0, Math.PI * 2); c.fill();
      // a four-point twinkle
      const tw = 0.6 + 0.4 * Math.sin(t * 2.2 + i * 1.7);
      c.strokeStyle = core; c.globalAlpha = 0.65 * tw; c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(x - r * 1.6, y); c.lineTo(x + r * 1.6, y); c.moveTo(x, y - r * 1.6); c.lineTo(x, y + r * 1.6); c.stroke();
      c.globalAlpha = 1;
      if (q.bright) {
        for (let k = 0; k < q.bright; k++) {
          const a = -Math.PI / 2 + (k - (q.bright - 1) / 2) * 0.55, r0 = r + 4, r1 = r + 11;
          c.strokeStyle = k < v ? GOLD : 'rgba(255,255,255,0.85)'; c.lineWidth = 3; c.lineCap = 'round';
          c.beginPath(); c.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0); c.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1); c.stroke();
        }
      }
      if (q.knot) {
        // a little looped knot around the star; pulled tight (and dim) once it has been used
        c.strokeStyle = v ? 'rgba(255,170,150,0.9)' : 'rgba(255,205,180,0.95)'; c.lineWidth = 2;
        c.beginPath(); c.ellipse(x, y, r + 5, r + 2, 0.6, 0, Math.PI * 2); c.stroke();
        c.beginPath(); c.ellipse(x, y, r + 2, r + 5, 0.6, 0, Math.PI * 2); c.stroke();
      }
      if (q.twin >= 0) {
        c.strokeStyle = TWIN_COL[this.twinIdx(p, i)]; c.lineWidth = 2.4; c.setLineDash([4, 3]);
        c.beginPath(); c.arc(x, y, r + 6, t * 0.8, t * 0.8 + Math.PI * 2); c.stroke(); c.setLineDash([]);
      }
      if (isOpt && st.dragging) { c.strokeStyle = 'rgba(220,235,255,0.5)'; c.lineWidth = 1.5; c.beginPath(); c.arc(x, y, r + 8 + Math.sin(t * 5) * 1.5, 0, Math.PI * 2); c.stroke(); }
      if (i === o.focus) { c.strokeStyle = '#ffffff'; c.lineWidth = 2; c.setLineDash([3, 3]); c.beginPath(); c.arc(x, y, r + 13, 0, Math.PI * 2); c.stroke(); c.setLineDash([]); }
      const hinted = (o.hint?.k === 'start' || o.hint?.k === 'back') && o.hint.at === i;
      if (hinted) { c.strokeStyle = o.hint!.k === 'back' ? '#ff9ec7' : GOLD; c.lineWidth = 3; c.beginPath(); c.arc(x, y, r + 10 + Math.sin(t * 6) * 3, 0, Math.PI * 2); c.stroke(); }
      if (isAt && !st.done) {
        // the needle, resting on the end of the thread
        c.strokeStyle = SILVER; c.lineWidth = 2; c.shadowColor = '#cfe0ff'; c.shadowBlur = 8;
        c.beginPath(); c.arc(x, y, r + 4 + Math.sin(t * 4) * 1.2, 0, Math.PI * 2); c.stroke();
        c.lineWidth = 2.2; c.beginPath(); c.moveTo(x + r * 0.9, y - r * 0.9); c.lineTo(x + r * 2.8, y - r * 2.8); c.stroke();
        c.lineWidth = 1.2; c.beginPath(); c.ellipse(x + r * 2.6, y - r * 2.6, 2.5, 1.3, -Math.PI / 4, 0, Math.PI * 2); c.stroke();
      }
      c.restore();
    });
  }
  private twinIdx(p: Puzzle, i: number) {
    const firsts = p.stars.map((q, k) => (q.twin > k ? k : -1)).filter((k) => k >= 0);
    const j = Math.min(i, p.stars[i].twin); return Math.max(0, firsts.indexOf(j)) % TWIN_COL.length;
  }
  private chinchillas(mood: Mood, dt: number) {
    const c = this.c, [x, y, w, h] = this.pair;
    if (mood !== this.lastMood) { this.lastMood = mood; this.moodT = 0; } else this.moodT += dt;
    // a soft mound of grass to lie on
    c.save();
    const g = c.createRadialGradient(x + w / 2, y + h * 1.05, 0, x + w / 2, y + h * 1.05, w * 0.62);
    g.addColorStop(0, 'rgba(20,40,30,0.85)'); g.addColorStop(1, 'rgba(20,40,30,0)');
    c.fillStyle = g; c.fillRect(x - w * 0.15, y + h * 0.3, w * 1.3, h * 0.8);
    c.restore();
    const img = this.img(`pair-${mood}`) ?? this.img('pair-point');
    const hop = mood === 'gasp' ? Math.abs(Math.sin(this.moodT * 6)) * h * 0.025 * Math.max(0, 1 - this.moodT / 1.6) : 0;
    const breathe = 1 + Math.sin(this.time * (mood === 'sleepy' ? 1.2 : 2)) * 0.01;
    if (img) {
      c.save(); c.translate(x + w / 2, y + h); c.scale(breathe, breathe); c.drawImage(img, -w / 2, -h - hop, w, h); c.restore();
    } else {
      drawChinchilla(c, 'dora', x + w * 0.32, y + h * 0.95 - hop, { face: 1, h: h * 0.62, time: this.time });
      drawChinchilla(c, 'enzo', x + w * 0.68, y + h * 0.95 - hop, { face: -1, h: h * 0.72, time: this.time });
    }
  }
}

/** A constellation drawn small, for the sky chart and the journal: faint when unsolved, gold (with its figure) when done. */
export function paintConstellation(cv: HTMLCanvasElement, p: Puzzle, solved: boolean, fig: HTMLImageElement | null) {
  const c = cv.getContext('2d'); if (!c) return;
  const W = cv.width, H = cv.height;
  c.fillStyle = '#070a22'; c.fillRect(0, 0, W, H);
  const xs = p.stars.map((q) => q.x), ys = p.stars.map((q) => q.y), x0 = Math.min(...xs), y0 = Math.min(...ys);
  const bw = Math.max(20, Math.max(...xs) - x0), bh = Math.max(20, Math.max(...ys) - y0), s = Math.min((W * 0.84) / bw, (H * 0.84) / bh);
  const ox = W / 2 - (x0 + bw / 2) * s, oy = H / 2 - (y0 + bh / 2) * s, R = Math.max(1.8, W / 70);
  if (solved && fig && fig.complete && fig.naturalWidth > 0) { const size = Math.max(bw, bh) * s * 1.2; c.save(); c.globalCompositeOperation = 'screen'; c.globalAlpha = 0.8; c.drawImage(fig, W / 2 - size / 2, H / 2 - size / 2, size, size); c.restore(); }
  c.lineCap = 'round';
  for (const sm of p.seams) {
    const A = p.stars[sm.a], B = p.stars[sm.b];
    c.strokeStyle = solved ? GOLD : 'rgba(200,215,255,0.45)'; c.lineWidth = solved ? Math.max(1.5, W / 110) : 1; c.setLineDash(solved ? [] : [1, 4]);
    c.shadowColor = '#ffb83a'; c.shadowBlur = solved ? 6 : 0;
    c.beginPath(); c.moveTo(ox + A.x * s, oy + A.y * s); c.lineTo(ox + B.x * s, oy + B.y * s); c.stroke();
  }
  c.setLineDash([]); c.shadowBlur = 0;
  for (const q of p.stars) { c.fillStyle = solved ? '#fff1c4' : '#dfe7ff'; c.beginPath(); c.arc(ox + q.x * s, oy + q.y * s, R, 0, Math.PI * 2); c.fill(); }
}
/** Drawn stand-ins for the title and ending paintings. */
export function paintTitle(cv: HTMLCanvasElement) { paintNight(cv, false); }
export function paintEnding(cv: HTMLCanvasElement) { paintNight(cv, true); }
function paintNight(cv: HTMLCanvasElement, ending: boolean) {
  const c = cv.getContext('2d'); if (!c) return;
  const W = cv.width, H = cv.height;
  const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0f1640'); g.addColorStop(1, '#3e3070'); c.fillStyle = g; c.fillRect(0, 0, W, H);
  let a = 99; const r = () => { a = (a * 1103515245 + 12345) & 0x7fffffff; return a / 0x7fffffff; };
  for (let i = 0; i < 220; i++) { c.fillStyle = `rgba(230,236,255,${0.3 + r() * 0.6})`; c.beginPath(); c.arc(r() * W, r() * H * 0.75, r() * 2.2, 0, Math.PI * 2); c.fill(); }
  if (ending) {
    c.strokeStyle = GOLD; c.lineWidth = 3; c.shadowColor = '#ffb83a'; c.shadowBlur = 12;
    const pts = [[0.38, 0.2], [0.33, 0.3], [0.36, 0.45], [0.46, 0.42], [0.5, 0.3], [0.54, 0.42], [0.64, 0.45], [0.67, 0.3], [0.62, 0.2]];
    c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x * W, y * H) : c.moveTo(x * W, y * H))); c.stroke(); c.shadowBlur = 0;
  }
  c.fillStyle = '#1b2d26'; c.beginPath(); c.moveTo(0, H); c.lineTo(0, H * 0.78); c.quadraticCurveTo(W * 0.5, H * 0.62, W, H * 0.8); c.lineTo(W, H); c.fill();
  drawChinchilla(c, 'dora', W * 0.42, H * 0.78, { face: 1, h: H * 0.16, time: 0 });
  drawChinchilla(c, 'enzo', W * 0.58, H * 0.78, { face: -1, h: H * 0.19, time: 0 });
}
