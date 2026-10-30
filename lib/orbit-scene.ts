// Moonhop: drawing only, Canvas 2D. The painted sky behind three layers of drifting stars; the moons with their
// painted surfaces (turning as they spin), little props on their rims, jelly wobbles, bean ripples, breathing rings and
// rabbit holes; the comets with their tails; the fireflies blinking in the gaps (and the gathered ones circling the
// pair until the lantern takes them); the home lantern, dim until it opens; the dotted path while they aim and the
// ring as they charge; Dora and Enzo, holding paws, as painted cut-outs in four poses (standing, crouching, flying,
// cheering) turned to the moon they stand on; and puffs, dust, sparkles and the lantern string that reels them back.
// The camera frames the pair and the moons near them and draws back during long flights. Every painting has a drawn
// stand-in until (or unless) it loads.
import { drawChinchilla } from './chinchilla-art';
import { type Hop, type Stage, type Skin, type Ev, LOST_T, FALL_IN } from './orbit-game';

export type Pose = 'stand' | 'crouch' | 'fly' | 'cheer';
export type DrawOpts = { dt: number; h: Hop; preview: [number, number][] | null; look: boolean; aim: number | null; starlight: boolean };
const PAIR = 46;                       // the pair's height in world units
const TAU = Math.PI * 2;
const SKIN_COL: Record<Skin, [string, string]> = {
  lantern: ['#ffb46b', '#c3602c'], mushroom: ['#e86a5c', '#8e2f2a'], cheese: ['#ffd76b', '#c49a2e'], garden: ['#4f8a5a', '#24452c'],
  moss: ['#7fb85a', '#3b6a2c'], ice: ['#cdeeff', '#6fa9d6'], jelly: ['#ff9ed6', '#b45fa6'], bean: ['#4b2d5c', '#160b1f'],
};
const SKY_COL: [string, string, string][] = [
  ['#2b2f6e', '#7a4f8e', '#f2a46a'], ['#16304a', '#2f4a6a', '#5e7d6a'], ['#0f2348', '#24467a', '#6fb0d8'], ['#141640', '#30306e', '#6d5aa8'], ['#0d0f2a', '#2a1f4a', '#7a4a7a'],
];
type Spark = { x: number; y: number; vx: number; vy: number; life: number; max: number; col: string; size: number; kind: 'dot' | 'puff' | 'ring' };

// paintings are shared by the scene and the little stage maps
const ART = new Map<string, HTMLImageElement>();
export function want(name: string) {
  if (ART.has(name) || typeof Image === 'undefined') return;
  const img = new Image(); img.decoding = 'async'; img.src = `/art/orbit/${name}.webp`; ART.set(name, img);
}
function img(name: string): HTMLImageElement | null { const i = ART.get(name); return i && i.complete && i.naturalWidth > 0 ? i : null; }
const hash = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

/** A moon's disc: its painting turned by `rot`, or a shaded ball in its colours; then light and shade on top. */
function disc(c: CanvasRenderingContext2D, skin: Skin, x: number, y: number, r: number, rot: number) {
  const im = img('moon-' + skin);
  c.save(); c.beginPath(); c.arc(x, y, r, 0, TAU); c.clip();
  if (im) { c.save(); c.translate(x, y); c.rotate(rot); c.drawImage(im, -r * 1.02, -r * 1.02, r * 2.04, r * 2.04); c.restore(); }
  else {
    const [a, b] = SKIN_COL[skin], g = c.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
    g.addColorStop(0, a); g.addColorStop(1, b); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
    c.fillStyle = 'rgba(0,0,0,0.12)';
    for (let i = 0; i < 5; i++) { const a2 = rot + i * 1.7, d = r * (0.25 + hash(i + r) * 0.5); c.beginPath(); c.arc(x + Math.cos(a2) * d, y + Math.sin(a2) * d, r * (0.08 + hash(i * 3 + r) * 0.1), 0, TAU); c.fill(); }
  }
  // the night side
  const sh = c.createRadialGradient(x - r * 0.45, y - r * 0.5, r * 0.3, x, y, r * 1.08);
  sh.addColorStop(0, 'rgba(255,255,255,0.08)'); sh.addColorStop(0.6, 'rgba(10,8,40,0)'); sh.addColorStop(1, 'rgba(10,8,40,0.5)');
  c.fillStyle = sh; c.fillRect(x - r, y - r, r * 2, r * 2);
  c.restore();
}

export class OrbitScene {
  readonly cv: HTMLCanvasElement; private c: CanvasRenderingContext2D;
  W = 0; H = 0; private dpr = 1;
  inset = { top: 0, right: 0, bottom: 0, left: 0 };
  private st: Stage | null = null; private sky = 1;
  // the camera, in world units: centre and pixels per unit
  cx = 0; cy = 0; s = 1; private intro = 0;
  private time = 0; private sparks: Spark[] = [];
  private stars: [number, number, number, number][] = [];
  private wob = new Map<number, number>(); private pose: Pose = 'stand'; private poseT = 0; private cheerT = 0;
  private upA = -Math.PI / 2; private squash = 0; private lastX = 0; private lastY = 0; private lostFrom: [number, number] | null = null;
  private trail: [number, number][] = []; private gathered: number[] = []; private lanternT = 0; private flash = 0;
  private pairBox: [number, number, number, number] = [0, 0, 0, 0];

  constructor(cv: HTMLCanvasElement) {
    this.cv = cv;
    const c = cv.getContext('2d'); if (!c) throw new Error('no canvas');
    this.c = c;
    let a = 4242; const r = () => { a = (a * 1103515245 + 12345) & 0x7fffffff; return a / 0x7fffffff; };
    for (let i = 0; i < 220; i++) this.stars.push([r(), r(), 0.4 + r() * 1.3, r() * TAU]);
    for (const p of ['pair-stand', 'pair-crouch', 'pair-fly', 'pair-cheer']) want(p);
    this.resize();
  }
  resize() {
    const r = this.cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = Math.max(1, Math.round(r.width)), H = Math.max(1, Math.round(r.height));
    if (W !== this.W || H !== this.H || dpr !== this.dpr) { this.W = W; this.H = H; this.dpr = dpr; this.cv.width = Math.round(W * dpr); this.cv.height = Math.round(H * dpr); }
  }
  setStage(st: Stage | null, sky: number) {
    this.st = st; this.sky = Math.max(1, Math.min(5, sky)); this.sparks = []; this.wob.clear(); this.gathered = []; this.trail = []; this.lanternT = 0; this.flash = 0; this.cheerT = 0;
    want('sky-' + this.sky);
    if (!st) return;
    for (const m of st.moons) want('moon-' + (m.skin ?? 'lantern'));
    // start on the whole field, then ease in to the pair
    const [l, t, r, b] = this.fieldBox(st);
    this.cx = (l + r) / 2; this.cy = (t + b) / 2; this.s = this.fit(r - l, b - t, 0.9); this.intro = 1.6;
  }
  /** The view's clear area (between the bars) in screen pixels. */
  private view() { const I = this.inset; return { x: I.left, y: I.top, w: Math.max(50, this.W - I.left - I.right), h: Math.max(50, this.H - I.top - I.bottom) }; }
  private fit(w: number, h: number, k = 1) { const v = this.view(); return Math.min((v.w * k) / Math.max(w, 1), (v.h * k) / Math.max(h, 1)); }
  private fieldBox(st: Stage): [number, number, number, number] {
    let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
    st.moons.forEach((m) => { const ex = m.path ? m.path.ax : 0, ey = m.path ? m.path.ay ?? m.path.ax : 0, x = m.path?.cx ?? m.x, y = m.path?.cy ?? m.y; l = Math.min(l, x - ex - m.r); r = Math.max(r, x + ex + m.r); t = Math.min(t, y - ey - m.r - 30); b = Math.max(b, y + ey + m.r); });
    st.flies.forEach((f) => { if (f.x !== undefined && f.y !== undefined) { l = Math.min(l, f.x - 20); r = Math.max(r, f.x + 20); t = Math.min(t, f.y - 20); b = Math.max(b, f.y + 20); } });
    return [l - 30, t - 30, r + 30, b + 30];
  }
  /** The most and least the camera may zoom: the pair never smaller than about 52 px nor bigger than a quarter of the view. */
  private zoomRange(): [number, number] {
    const v = this.view(), lo = Math.max(56, Math.min(70, v.h * 0.12)) / PAIR, hi = Math.max(lo, (v.h * 0.24) / PAIR);
    return [lo, hi];
  }
  toScreen(x: number, y: number): [number, number] { const v = this.view(); return [v.x + v.w / 2 + (x - this.cx) * this.s, v.y + v.h / 2 + (y - this.cy) * this.s]; }
  toWorld(sx: number, sy: number): [number, number] { const v = this.view(); return [this.cx + (sx - v.x - v.w / 2) / this.s, this.cy + (sy - v.y - v.h / 2) / this.s]; }
  metrics() { return { pair: this.pairBox, scale: this.s, view: this.view(), W: this.W, H: this.H }; }

  /** What the game just did. */
  feed(evs: Ev[], h: Hop) {
    for (const e of evs) {
      if (e.k === 'leap') { this.burst(h.x, h.y, 10, '#ffffffaa', 70, 'puff'); this.squash = -0.25; }
      else if (e.k === 'land') {
        const m = h.s.moons[e.moon]; this.squash = Math.min(0.35, e.speed / 900);
        this.burst(h.x, h.y, 8 + Math.min(10, e.speed / 40), SKIN_COL[m.skin ?? 'lantern'][0], 60, 'dot');
        if (e.kind === 'jelly' || e.kind === 'moss') this.wob.set(e.moon, 1);
      }
      else if (e.k === 'bounce') { this.wob.set(e.moon, 1); this.burst(h.x, h.y, 10, h.s.moons[e.moon].kind === 'bean' ? '#b48cff' : '#ffb4e6', 90, 'ring'); }
      else if (e.k === 'fly') {
        const [x, y] = h.flyAt(e.i); this.burst(x, y, e.gold ? 26 : 16, e.gold ? '#ffd84a' : '#d9ff7a', 110, 'dot');
        this.gathered.push(e.i); this.cheerT = 0.9; this.flash = e.gold ? 1 : 0.5;
      }
      else if (e.k === 'puff') { const a = e.dir + Math.PI; for (let i = 0; i < 9; i++) this.sparks.push({ x: h.x, y: h.y - 10, vx: Math.cos(a + (i - 4) * 0.18) * (60 + i * 8), vy: Math.sin(a + (i - 4) * 0.18) * (60 + i * 8), life: 0.7, max: 0.7, col: '#ffffff', size: 7 + (i % 3) * 3, kind: 'puff' }); }
      else if (e.k === 'lost') { this.lostFrom = [h.x, h.y]; }
      else if (e.k === 'back') { this.lostFrom = null; this.burst(h.x, h.y, 12, '#fff2c4', 60, 'dot'); }
      else if (e.k === 'hole') { this.burst(h.x, h.y, 14, '#c9a2ff', 80, 'ring'); this.squash = 0.3; }
      else if (e.k === 'open') { const m = h.mx[h.s.home], n = h.my[h.s.home]; this.burst(m, n - h.s.moons[h.s.home].r - 30, 30, '#ffd27a', 140, 'dot'); }
      else if (e.k === 'home') { this.cheerT = 99; this.lanternT = 0.01; }
    }
  }
  private burst(x: number, y: number, n: number, col: string, sp: number, kind: Spark['kind']) {
    if (kind === 'ring') { this.sparks.push({ x, y, vx: 0, vy: 0, life: 0.6, max: 0.6, col, size: 10, kind }); n = Math.floor(n / 2); kind = 'dot'; }
    for (let i = 0; i < n; i++) { const a = (i / n) * TAU + hash(i + this.time) * 0.6, v = sp * (0.4 + hash(i * 7 + this.time) * 0.8); this.sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.5 + hash(i) * 0.5, max: 1, col, size: kind === 'puff' ? 8 : 2.6, kind }); }
  }

  /** Where the camera wants to be. */
  private aimCamera(h: Hop, look: boolean, dt: number) {
    const st = h.s, [lo, hi] = this.zoomRange();
    let box: [number, number, number, number];
    const add = (b: [number, number, number, number], x: number, y: number, r = 0) => { b[0] = Math.min(b[0], x - r); b[1] = Math.min(b[1], y - r); b[2] = Math.max(b[2], x + r); b[3] = Math.max(b[3], y + r); };
    if (look) box = this.fieldBox(st);
    else {
      const px = h.x, py = h.y;
      box = [px, py, px, py]; add(box, px, py, PAIR * 1.4);
      const near = (i: number, reach: number) => { const m = st.moons[i]; return Math.hypot(h.mx[i] - px, h.my[i] - py) - m.r < reach; };
      if (h.mode === 'stand' || h.mode === 'done') {
        add(box, h.mx[h.moon], h.my[h.moon], st.moons[h.moon].r + 10);
        for (let i = 0; i < st.moons.length; i++) if (i !== h.moon && near(i, 330)) add(box, h.mx[i], h.my[i], st.moons[i].r * 0.9);
      } else {
        const lm = h.lastMoon; add(box, h.mx[lm], h.my[lm], st.moons[lm].r * 0.6);
        add(box, px + h.vx * 0.7, py + h.vy * 0.7, 60);
        for (let i = 0; i < st.moons.length; i++) if (near(i, 220)) add(box, h.mx[i], h.my[i], st.moons[i].r);
      }
      h.s.flies.forEach((_, i) => { if (h.got[i]) return; const [fx, fy] = h.flyAt(i); if (Math.hypot(fx - px, fy - py) < 300) add(box, fx, fy, 22); });
    }
    const w = box[2] - box[0], hh = box[3] - box[1];
    let s = this.fit(w, hh, 0.86);
    if (!look) s = Math.max(lo, Math.min(hi, s));
    else s = Math.min(s, hi);
    let tx = (box[0] + box[2]) / 2, ty = (box[1] + box[3]) / 2;
    // keep the pair well inside the view even when the box is too big to fit
    const v = this.view(), mx = (v.w / 2 - PAIR * 1.6 * s) / s, my = (v.h / 2 - PAIR * 1.6 * s) / s;
    if (!look) { tx = Math.max(h.x - mx, Math.min(h.x + mx, tx)); ty = Math.max(h.y - my, Math.min(h.y + my, ty)); }
    const k = this.intro > 0 ? 1.4 : look ? 5 : h.mode === 'fly' ? 3.2 : 2.6, a = 1 - Math.exp(-k * dt);
    this.intro = Math.max(0, this.intro - dt);
    if (this.intro > 0.8) return;
    this.cx += (tx - this.cx) * a; this.cy += (ty - this.cy) * a;
    this.s *= Math.exp((Math.log(s) - Math.log(this.s)) * Math.min(1, a * 0.9));
  }

  draw(o: DrawOpts) {
    const { c, W, H } = this, h = o.h, st = h.s, dt = o.dt;
    this.time += dt;
    this.aimCamera(h, o.look, dt);
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.background();
    // the world
    const tr = (): void => { const v = this.view(); c.setTransform(this.dpr * this.s, 0, 0, this.dpr * this.s, this.dpr * (v.x + v.w / 2 - this.cx * this.s), this.dpr * (v.y + v.h / 2 - this.cy * this.s)); };
    tr();
    this.drawOrbits(h);
    this.drawHoles(h, true);
    for (let i = 0; i < st.moons.length; i++) this.drawMoon(h, i, dt);
    this.drawHoles(h, false);
    this.drawLantern(h, dt);
    this.drawFlies(h);
    if (o.preview && o.preview.length > 1) this.drawPreview(o.preview, h);
    if (o.aim !== null && h.mode === 'stand') this.drawAim(h, o.aim);
    this.drawPair(h, o, dt);
    this.drawSparks(dt);
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.drawMarkers(h);
    if (this.flash > 0) { this.flash = Math.max(0, this.flash - dt * 2); c.fillStyle = `rgba(255,240,180,${this.flash * 0.12})`; c.fillRect(0, 0, W, H); }
  }

  private background() {
    const { c, W, H } = this, bg = img('sky-' + this.sky);
    if (bg) {
      const k = Math.max(W / bg.width, H / bg.height) * 1.08, w = bg.width * k, h = bg.height * k;
      const px = Math.max(-1, Math.min(1, this.cx / 1500)), py = Math.max(-1, Math.min(1, this.cy / 1000));
      c.drawImage(bg, (W - w) / 2 - px * (w - W) * 0.45, (H - h) / 2 - py * (h - H) * 0.45, w, h);
      c.fillStyle = 'rgba(12,10,40,0.28)'; c.fillRect(0, 0, W, H);
    } else {
      const [a, b, d] = SKY_COL[this.sky - 1], g = c.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, a); g.addColorStop(0.65, b); g.addColorStop(1, d); c.fillStyle = g; c.fillRect(0, 0, W, H);
    }
    // three layers of stars, drifting at different speeds as the camera moves
    c.save(); c.globalCompositeOperation = 'lighter';
    const layers = [0.04, 0.1, 0.2];
    this.stars.forEach(([sx, sy, size, ph], i) => {
      const L = layers[i % 3], span = W + 200, spanY = H + 200;
      const x = ((sx * span - this.cx * L * this.s) % span + span) % span - 100, y = ((sy * spanY - this.cy * L * this.s) % spanY + spanY) % spanY - 100;
      const tw = 0.45 + 0.55 * Math.sin(this.time * (0.8 + (i % 5) * 0.3) + ph);
      c.globalAlpha = 0.25 + tw * 0.5 * (0.5 + L * 2.5); c.fillStyle = i % 9 === 0 ? '#ffe9b0' : '#dfe6ff';
      c.beginPath(); c.arc(x, y, size * (0.6 + L * 2), 0, TAU); c.fill();
    });
    c.restore();
  }

  private drawOrbits(h: Hop) {
    const c = this.c, st = h.s;
    c.save(); c.setLineDash([4, 9]); c.lineWidth = 1.5;
    st.moons.forEach((m) => {
      if (!m.path || m.path.around !== undefined) return;
      c.strokeStyle = m.comet ? 'rgba(170,220,255,0.18)' : 'rgba(255,255,255,0.12)';
      c.beginPath(); c.ellipse(m.path.cx ?? 0, m.path.cy ?? 0, m.path.ax, m.path.ay ?? m.path.ax, 0, 0, TAU); c.stroke();
    });
    st.flies.forEach((f, i) => {
      if (!f.path || h.got[i]) return;
      const cx = f.path.around !== undefined ? h.mx[f.path.around] : f.path.cx ?? 0, cy = f.path.around !== undefined ? h.my[f.path.around] : f.path.cy ?? 0;
      c.strokeStyle = 'rgba(220,255,140,0.14)'; c.beginPath(); c.ellipse(cx, cy, f.path.ax, f.path.ay ?? f.path.ax, 0, 0, TAU); c.stroke();
    });
    c.restore();
  }

  private drawMoon(h: Hop, i: number, dt: number) {
    const c = this.c, m = h.s.moons[i], x = h.mx[i], y = h.my[i], kind = m.kind ?? 'plain', skin = m.skin ?? 'lantern';
    const rot = (m.spin ?? 0) * h.t + (m.comet ? h.t * 1.5 : 0);
    let w = this.wob.get(i) ?? 0;
    if (w > 0) { w = Math.max(0, w - dt * 1.6); this.wob.set(i, w); }
    const jig = kind === 'jelly' ? Math.sin(this.time * 18) * w * 0.12 : kind === 'moss' ? Math.sin(this.time * 14) * w * 0.04 : 0;
    // the pull: a soft halo, breathing with a pulsing moon
    const pulseK = m.pulse ? 1 + m.pulse.amp * Math.sin(TAU * h.t / m.pulse.period + (m.pulse.phase ?? 0)) : 1;
    const haloR = m.r * (kind === 'bean' ? 2.6 : 2.2 + (pulseK - 1) * 0.9);
    const g = c.createRadialGradient(x, y, m.r * 0.9, x, y, haloR);
    g.addColorStop(0, kind === 'bean' ? 'rgba(150,90,220,0.28)' : `rgba(200,210,255,${0.13 * pulseK})`); g.addColorStop(1, 'rgba(200,210,255,0)');
    c.fillStyle = g; c.beginPath(); c.arc(x, y, haloR, 0, TAU); c.fill();
    if (m.pulse) {
      const ph = (h.t / m.pulse.period + (m.pulse.phase ?? 0) / TAU) % 1;
      c.strokeStyle = `rgba(200,220,255,${0.35 * pulseK * (1 - ph)})`; c.lineWidth = 2; c.beginPath(); c.arc(x, y, m.r * (1.15 + ph * 1.6), 0, TAU); c.stroke();
    }
    if (kind === 'bean') for (let k = 0; k < 3; k++) {
      const ph = ((this.time * 0.6 + k / 3) % 1);
      c.strokeStyle = `rgba(190,140,255,${0.4 * (1 - ph)})`; c.lineWidth = 2; c.beginPath(); c.arc(x, y, m.r * (1.1 + ph * 1.3), 0, TAU); c.stroke();
    }
    if (m.comet) {
      const sp = Math.hypot(h.mvx[i], h.mvy[i]) || 1, ux = -h.mvx[i] / sp, uy = -h.mvy[i] / sp, len = m.r * 6;
      const tg = c.createLinearGradient(x, y, x + ux * len, y + uy * len);
      tg.addColorStop(0, 'rgba(190,235,255,0.65)'); tg.addColorStop(1, 'rgba(190,235,255,0)');
      c.fillStyle = tg; c.beginPath(); c.moveTo(x - uy * m.r * 0.95, y + ux * m.r * 0.95); c.lineTo(x + ux * len, y + uy * len); c.lineTo(x + uy * m.r * 0.95, y - ux * m.r * 0.95); c.closePath(); c.fill();
    }
    c.save(); c.translate(x, y); c.scale(1 + jig, 1 - jig); c.translate(-x, -y);
    disc(c, skin, x, y, m.r, rot);
    // the rim
    c.strokeStyle = kind === 'ice' ? 'rgba(230,250,255,0.75)' : kind === 'jelly' ? 'rgba(255,210,240,0.8)' : kind === 'bean' ? 'rgba(190,140,255,0.7)' : 'rgba(255,240,220,0.35)';
    c.lineWidth = kind === 'plain' || kind === 'moss' ? 1.5 : 2.5; c.beginPath(); c.arc(x, y, m.r, 0, TAU); c.stroke();
    this.props(m.props ?? i * 7 + 3, skin, x, y, m.r, rot, kind);
    if (m.spin) {
      // little chevrons round the rim show which way it turns
      c.fillStyle = 'rgba(255,255,255,0.55)';
      for (let k = 0; k < 3; k++) { const a = rot + (k * TAU) / 3 + 0.5, d = m.r * 0.78, s = Math.sign(m.spin); c.save(); c.translate(x + Math.cos(a) * d, y + Math.sin(a) * d); c.rotate(a + (s > 0 ? Math.PI / 2 : -Math.PI / 2)); c.beginPath(); c.moveTo(5, 0); c.lineTo(-3, -4); c.lineTo(-3, 4); c.closePath(); c.fill(); c.restore(); }
    }
    c.restore();
  }
  /** A few small things growing on a moon's rim, turning with it. */
  private props(seed: number, skin: Skin, x: number, y: number, r: number, rot: number, kind: string) {
    const c = this.c, n = skin === 'cheese' || skin === 'jelly' || skin === 'bean' ? 0 : 3 + Math.floor(hash(seed) * 3);
    for (let k = 0; k < n; k++) {
      const a = rot + hash(seed * 3 + k) * TAU, px = x + Math.cos(a) * r, py = y + Math.sin(a) * r, s = 0.7 + hash(seed + k * 5) * 0.6;
      // keep clear of the very top, where the pair usually start
      c.save(); c.translate(px, py); c.rotate(a + Math.PI / 2); c.scale(s, s);
      if (skin === 'mushroom' || (skin === 'garden' && k % 2 === 0)) {
        c.fillStyle = '#f4e6c8'; c.fillRect(-1.6, -7, 3.2, 7);
        c.fillStyle = skin === 'mushroom' ? (k % 2 ? '#e8574a' : '#f3a33c') : '#8fd6ff'; c.beginPath(); c.ellipse(0, -7, 6, 4, 0, Math.PI, 0); c.fill();
        c.fillStyle = '#fff6'; c.beginPath(); c.arc(-2, -8.5, 1.1, 0, TAU); c.fill();
      } else if (skin === 'lantern') {
        c.strokeStyle = '#5a3a2a'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -10); c.stroke();
        c.fillStyle = k % 2 ? '#ffcf6a' : '#ff8f5a'; c.beginPath(); c.ellipse(0, -13, 3.2, 4, 0, 0, TAU); c.fill();
        c.fillStyle = 'rgba(255,220,140,0.25)'; c.beginPath(); c.arc(0, -13, 8, 0, TAU); c.fill();
      } else if (skin === 'ice') {
        c.fillStyle = 'rgba(225,248,255,0.9)'; c.beginPath(); c.moveTo(-3, 0); c.lineTo(0, -11); c.lineTo(3, 0); c.closePath(); c.fill();
      } else {
        // moss and garden flowers
        c.strokeStyle = '#3f7a3a'; c.lineWidth = 1.3; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(2, -4, 0, -8); c.stroke();
        c.fillStyle = kind === 'moss' ? '#fff8e6' : k % 2 ? '#ff9ec7' : '#bfe8ff';
        for (let p = 0; p < 5; p++) { const pa = (p * TAU) / 5; c.beginPath(); c.arc(Math.cos(pa) * 2.2, -9 + Math.sin(pa) * 2.2, 1.6, 0, TAU); c.fill(); }
        c.fillStyle = '#ffd84a'; c.beginPath(); c.arc(0, -9, 1.2, 0, TAU); c.fill();
      }
      c.restore();
    }
  }
  private drawHoles(h: Hop, under: boolean) {
    const c = this.c, holes = h.s.holes; if (!holes) return;
    holes.forEach((H, n) => {
      const ends: [number, number][] = [[H.a, H.aAt], [H.b, H.bAt]];
      if (under) {
        // a faint dotted thread between the two ends
        const [a, b] = ends.map(([mi, at]) => [h.mx[mi] + Math.cos(at) * h.s.moons[mi].r, h.my[mi] + Math.sin(at) * h.s.moons[mi].r]);
        c.save(); c.setLineDash([3, 8]); c.strokeStyle = 'rgba(201,162,255,0.3)'; c.lineWidth = 2; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); c.restore();
        return;
      }
      ends.forEach(([mi, at]) => {
        const m = h.s.moons[mi], x = h.mx[mi] + Math.cos(at) * m.r, y = h.my[mi] + Math.sin(at) * m.r;
        c.save(); c.translate(x, y); c.rotate(at + Math.PI / 2);
        c.fillStyle = '#1a0f22'; c.beginPath(); c.ellipse(0, 1, 11, 5, 0, 0, TAU); c.fill();
        c.strokeStyle = '#8a6a9a'; c.lineWidth = 1.5; c.stroke();
        // two long ears peeking out, twitching now and then
        const tw = Math.sin(this.time * 3 + n * 2) > 0.92 ? 0.25 : 0;
        c.fillStyle = '#f2e6f0';
        for (const s of [-1, 1]) { c.save(); c.translate(s * 3, -1); c.rotate(s * (0.18 + tw)); c.beginPath(); c.ellipse(0, -7, 2.2, 7, 0, 0, TAU); c.fill(); c.fillStyle = '#f7a8c4'; c.beginPath(); c.ellipse(0, -7, 1, 5, 0, 0, TAU); c.fill(); c.restore(); c.fillStyle = '#f2e6f0'; }
        c.restore();
      });
    });
  }
  private drawLantern(h: Hop, dt: number) {
    const c = this.c, i = h.s.home; if (i < 0) return;
    const m = h.s.moons[i], x = h.mx[i], y = h.my[i] - m.r, open = h.open;
    if (this.lanternT > 0) this.lanternT += dt;
    const bob = Math.sin(this.time * 1.6) * 3, rise = this.lanternT > 0 ? Math.min(60, this.lanternT * this.lanternT * 30) : 0;
    const ly = y - 34 + bob - rise;
    if (open) {
      const g = c.createRadialGradient(x, ly, 4, x, ly, 90);
      g.addColorStop(0, 'rgba(255,214,120,0.55)'); g.addColorStop(1, 'rgba(255,190,90,0)');
      c.fillStyle = g; c.beginPath(); c.arc(x, ly, 90, 0, TAU); c.fill();
    }
    c.strokeStyle = '#6a4a30'; c.lineWidth = 2; c.beginPath(); c.moveTo(x, y + 2); c.lineTo(x, ly + 16); c.stroke();
    c.fillStyle = open ? '#ffcf6a' : '#8a6a5a';
    c.beginPath(); c.ellipse(x, ly, 15, 19, 0, 0, TAU); c.fill();
    c.strokeStyle = open ? '#c3602c' : '#5a4038'; c.lineWidth = 1.6;
    for (const k of [-0.5, 0, 0.5]) { c.beginPath(); c.ellipse(x, ly, 15 * Math.abs(k) + 0.5, 19, 0, -Math.PI / 2, Math.PI / 2, k < 0); c.stroke(); }
    c.fillStyle = '#5a3a2a'; c.fillRect(x - 7, ly - 21, 14, 4); c.fillRect(x - 6, ly + 17, 12, 3);
    if (!open) {
      // how many fireflies the lantern still needs, as empty dots
      const left = h.needed(), tot = h.total();
      for (let k = 0; k < tot; k++) { const a = -Math.PI / 2 + (k - (tot - 1) / 2) * 0.42; c.fillStyle = k < tot - left ? '#ffe27a' : 'rgba(255,255,255,0.25)'; c.beginPath(); c.arc(x + Math.cos(a) * 30, ly + Math.sin(a) * 30 + 6, 3.2, 0, TAU); c.fill(); }
    }
  }
  private drawFlies(h: Hop) {
    const c = this.c;
    c.save(); c.globalCompositeOperation = 'lighter';
    h.s.flies.forEach((f, i) => {
      if (h.got[i]) return;
      const [x, y] = h.flyAt(i), bl = 0.6 + 0.4 * Math.sin(this.time * 4 + i * 1.7), gold = !!f.gold, R = gold ? 26 : 18;
      const dy = Math.sin(this.time * 2.2 + i) * 3;
      const g = c.createRadialGradient(x, y + dy, 0, x, y + dy, R * (1 + bl * 0.4));
      g.addColorStop(0, gold ? `rgba(255,220,90,${0.9 * bl})` : `rgba(215,255,120,${0.85 * bl})`); g.addColorStop(1, 'rgba(200,255,120,0)');
      c.fillStyle = g; c.beginPath(); c.arc(x, y + dy, R * 1.4, 0, TAU); c.fill();
      c.fillStyle = gold ? '#fff2b0' : '#f6ffd0'; c.beginPath(); c.arc(x, y + dy, gold ? 4.5 : 3.2, 0, TAU); c.fill();
      // wings
      c.fillStyle = 'rgba(255,255,255,0.35)'; const fl = Math.sin(this.time * 30 + i) * 0.4;
      c.beginPath(); c.ellipse(x - 3, y + dy - 3, 3.4, 1.8, -0.6 + fl, 0, TAU); c.fill(); c.beginPath(); c.ellipse(x + 3, y + dy - 3, 3.4, 1.8, 0.6 - fl, 0, TAU); c.fill();
      if (gold) for (let k = 0; k < 4; k++) { const a = this.time * 1.5 + (k * TAU) / 4, d = 13 + Math.sin(this.time * 3 + k) * 3; c.fillStyle = '#ffe9a0'; c.beginPath(); c.arc(x + Math.cos(a) * d, y + dy + Math.sin(a) * d, 1.4, 0, TAU); c.fill(); }
    });
    c.restore();
  }
  private drawPreview(pts: [number, number][], h: Hop) {
    const c = this.c;
    c.save();
    pts.forEach(([x, y], k) => {
      if (k === 0) return;
      const a = 1 - k / pts.length;
      c.fillStyle = `rgba(20,16,60,${0.25 * a})`; c.beginPath(); c.arc(x, y, 3.6 + a * 2.4, 0, TAU); c.fill();
      c.fillStyle = `rgba(255,246,214,${0.35 + a * 0.6})`; c.beginPath(); c.arc(x, y, 2.4 + a * 2.2, 0, TAU); c.fill();
    });
    c.restore();
    void h;
  }

  /** Where the pointer would send them on this moon: a little glowing mark on the rim and a dashed hint outward. */
  private drawAim(h: Hop, at: number) {
    const c = this.c, m = h.s.moons[h.moon], x = h.mx[h.moon] + Math.cos(at) * m.r, y = h.my[h.moon] + Math.sin(at) * m.r;
    c.save(); c.strokeStyle = 'rgba(255,240,200,0.75)'; c.lineWidth = 2; c.setLineDash([4, 6]);
    c.beginPath(); c.moveTo(x + Math.cos(at) * 8, y + Math.sin(at) * 8); c.lineTo(x + Math.cos(at) * 40, y + Math.sin(at) * 40); c.stroke();
    c.setLineDash([]); c.fillStyle = 'rgba(255,240,200,0.9)'; c.beginPath(); c.arc(x, y, 3.5, 0, TAU); c.fill(); c.restore();
  }

  private drawPair(h: Hop, o: DrawOpts, dt: number) {
    const c = this.c;
    // which way is up for them, and which pose
    let ux: number, uy: number, x = h.x, y = h.y;
    if (h.mode === 'lost' && this.lostFrom) {
      // reeled back along the lantern string to where they leapt from
      const k = Math.min(1, h.lostT / LOST_T), e = k * k * (3 - 2 * k), m = h.s.moons[h.lastMoon];
      const tx = h.mx[h.lastMoon] + Math.cos(h.lastAt) * m.r, ty = h.my[h.lastMoon] + Math.sin(h.lastAt) * m.r;
      x = this.lostFrom[0] + (tx - this.lostFrom[0]) * e; y = this.lostFrom[1] + (ty - this.lostFrom[1]) * e - Math.sin(e * Math.PI) * 60;
      c.save(); c.setLineDash([2, 6]); c.strokeStyle = 'rgba(255,230,170,0.6)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x, y); c.lineTo(tx, ty); c.stroke(); c.restore();
      ux = Math.cos(h.lastAt); uy = Math.sin(h.lastAt);
    } else if (h.mode === 'fly') {
      // away from the pull when it is strong, drifting back towards screen-up out in the open
      const [ax, ay] = h.pull(h.x, h.y), a = Math.hypot(ax, ay), w = Math.min(1, a / 260);
      ux = a > 0 ? (-ax / a) * w : 0; uy = (a > 0 ? (-ay / a) * w : 0) - (1 - w);
    }
    else { ux = Math.cos(h.at); uy = Math.sin(h.at); }
    const want = Math.atan2(uy, ux); let d = want - this.upA; d = Math.atan2(Math.sin(d), Math.cos(d));
    this.upA += d * Math.min(1, dt * (h.mode === 'fly' ? 5 : 18));
    this.cheerT = Math.max(0, this.cheerT - dt);
    const pose: Pose = h.mode === 'done' || this.cheerT > 0.2 && h.mode !== 'fly' ? 'cheer' : h.mode === 'fly' || h.mode === 'lost' ? 'fly' : h.charge > 0 ? 'crouch' : 'stand';
    if (pose !== this.pose) { this.pose = pose; this.poseT = 0; } else this.poseT += dt;
    this.squash *= Math.exp(-dt * 7);
    // the trail in flight
    if (h.mode === 'fly') { this.trail.push([x, y]); if (this.trail.length > 26) this.trail.shift(); } else if (this.trail.length) this.trail.splice(0, 2);
    if (this.trail.length > 2) { c.save(); c.lineCap = 'round'; for (let k = 1; k < this.trail.length; k++) { const a = k / this.trail.length; c.strokeStyle = `rgba(255,255,255,${a * 0.22})`; c.lineWidth = a * 8; c.beginPath(); c.moveTo(this.trail[k - 1][0], this.trail[k - 1][1]); c.lineTo(this.trail[k][0], this.trail[k][1]); c.stroke(); } c.restore(); }
    const bx = x + Math.cos(this.upA) * PAIR * 0.4, by = y + Math.sin(this.upA) * PAIR * 0.4;
    // the charge ring
    if (h.charge > 0 && h.mode === 'stand') {
      const k = h.charge, col = k >= 1 ? '#ffd65a' : k > 0.6 ? '#ffe9a0' : '#9ff0e0';
      c.save(); c.lineWidth = 4; c.strokeStyle = 'rgba(255,255,255,0.18)'; c.beginPath(); c.arc(bx, by, PAIR * 0.78, 0, TAU); c.stroke();
      c.strokeStyle = col; c.lineCap = 'round'; c.beginPath(); c.arc(bx, by, PAIR * 0.78, -Math.PI / 2, -Math.PI / 2 + k * TAU); c.stroke();
      if (k >= 1) { c.globalAlpha = 0.4 + 0.3 * Math.sin(this.time * 12); c.lineWidth = 9; c.stroke(); }
      c.restore();
    }
    // the gathered fireflies circle them until the lantern takes them
    c.save(); c.globalCompositeOperation = 'lighter';
    this.gathered.forEach((fi, k) => {
      const gold = !!h.s.flies[fi]?.gold, a = this.time * 1.8 + (k * TAU) / Math.max(1, this.gathered.length);
      let fx = bx + Math.cos(a) * PAIR * 0.85, fy = by + Math.sin(a) * PAIR * 0.55;
      if (this.lanternT > 0) { const m = h.s.moons[h.s.home], lx = h.mx[h.s.home], ly = h.my[h.s.home] - m.r - 34, e = Math.min(1, this.lanternT * 1.2); fx += (lx - fx) * e; fy += (ly - fy) * e; }
      const g = c.createRadialGradient(fx, fy, 0, fx, fy, 9); g.addColorStop(0, gold ? 'rgba(255,220,90,0.9)' : 'rgba(215,255,120,0.8)'); g.addColorStop(1, 'rgba(200,255,120,0)');
      c.fillStyle = g; c.beginPath(); c.arc(fx, fy, 9, 0, TAU); c.fill();
    });
    c.restore();
    // Dora and Enzo
    const im = img('pair-' + pose) ?? img('pair-stand');
    const sq = pose === 'crouch' ? 0.1 + h.charge * 0.08 : this.squash, stretch = pose === 'fly' ? 0.05 : 0;
    const hop = pose === 'cheer' ? Math.abs(Math.sin(this.time * 7)) * 5 : 0;
    c.save(); c.translate(x, y); c.rotate(this.upA + Math.PI / 2);
    c.translate(0, -hop); c.scale((h.facing < 0 ? -1 : 1) * (1 + sq * 0.6), 1 - sq + stretch);
    const size = PAIR * 1.18;
    if (im) {
      // a soft shadow where they stand
      if (h.mode === 'stand' || h.mode === 'done') { c.fillStyle = 'rgba(0,0,20,0.25)'; c.beginPath(); c.ellipse(0, 0, size * 0.4, 3, 0, 0, TAU); c.fill(); }
      c.drawImage(im, -size / 2, -size, size, size);
    } else {
      drawChinchilla(c, 'dora', -9, 0, { face: 1, h: PAIR * 0.62, time: this.time, air: pose === 'fly' });
      drawChinchilla(c, 'enzo', 10, 0, { face: -1, h: PAIR * 0.7, time: this.time, air: pose === 'fly' });
    }
    c.restore();
    // where they are on screen (for the tests and the page)
    const [sx, sy] = this.toScreen(bx, by), half = (PAIR * 0.62) * this.s;
    this.pairBox = [sx - half, sy - half, half * 2, half * 2];
    this.lastX = x; this.lastY = y;
    void o;
  }

  private drawSparks(dt: number) {
    const c = this.c;
    c.save();
    this.sparks = this.sparks.filter((p) => (p.life -= dt) > 0);
    for (const p of this.sparks) {
      p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= Math.exp(-dt * 3); p.vy *= Math.exp(-dt * 3);
      const a = Math.max(0, p.life / p.max);
      if (p.kind === 'ring') { c.strokeStyle = p.col; c.globalAlpha = a; c.lineWidth = 3; c.beginPath(); c.arc(p.x, p.y, p.size + (1 - a) * 46, 0, TAU); c.stroke(); continue; }
      if (p.kind === 'puff') { c.globalAlpha = a * 0.7; c.fillStyle = '#f4f6ff'; c.beginPath(); c.arc(p.x, p.y, p.size * (1.4 - a * 0.6), 0, TAU); c.fill(); continue; }
      c.globalAlpha = a; c.fillStyle = p.col; c.beginPath(); c.arc(p.x, p.y, p.size, 0, TAU); c.fill();
    }
    c.restore();
  }
  /** Little arrows at the edge of the view pointing to fireflies (and the open lantern) that are out of sight. */
  private drawMarkers(h: Hop) {
    const c = this.c, v = this.view(), pad = 22;
    const mark = (wx: number, wy: number, col: string, big: boolean) => {
      const [sx, sy] = this.toScreen(wx, wy);
      if (sx > v.x && sx < v.x + v.w && sy > v.y && sy < v.y + v.h) return;
      const cx = v.x + v.w / 2, cy = v.y + v.h / 2, dx = sx - cx, dy = sy - cy;
      const k = Math.min((v.w / 2 - pad) / Math.abs(dx || 1e-6), (v.h / 2 - pad) / Math.abs(dy || 1e-6));
      const px = cx + dx * k, py = cy + dy * k, a = Math.atan2(dy, dx);
      c.save(); c.translate(px, py); c.rotate(a);
      c.fillStyle = col; c.globalAlpha = 0.85; c.beginPath(); c.moveTo(big ? 13 : 10, 0); c.lineTo(-6, big ? -8 : -6); c.lineTo(-6, big ? 8 : 6); c.closePath(); c.fill();
      c.restore();
    };
    h.s.flies.forEach((f, i) => { if (!h.got[i]) { const [x, y] = h.flyAt(i); mark(x, y, f.gold ? '#ffd84a' : '#d9ff7a', !!f.gold); } });
    if (h.open && h.s.home >= 0) mark(h.mx[h.s.home], h.my[h.s.home] - h.s.moons[h.s.home].r, '#ffb35a', true);
  }
}

// ---------------------------------------------------------------- small paintings for the menu and the sky map
/** A stage drawn small: its moons, fireflies and the home lantern, on the sky's colours. */
export function paintThumb(cv: HTMLCanvasElement, st: Stage, done: boolean) {
  const c = cv.getContext('2d'); if (!c) return;
  const W = cv.width, H = cv.height, k = Math.max(1, Math.min(5, st.sky)), bg = img('sky-' + k);
  want('sky-' + k);
  if (bg) { const z = Math.max(W / bg.width, H / bg.height); c.drawImage(bg, (W - bg.width * z) / 2, (H - bg.height * z) / 2, bg.width * z, bg.height * z); c.fillStyle = 'rgba(12,10,40,0.3)'; c.fillRect(0, 0, W, H); }
  else { const [a, b] = SKY_COL[k - 1], g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, a); g.addColorStop(1, b); c.fillStyle = g; c.fillRect(0, 0, W, H); }
  // the moons drawn half as big again as they really are, so the little islands read at this size
  const grow = 1.5;
  let l = Infinity, t = Infinity, r = -Infinity, bt = -Infinity;
  st.moons.forEach((m) => { const x = m.path?.cx ?? m.x, y = m.path?.cy ?? m.y, e = m.r * grow + (m.path ? m.path.ax * 0.3 : 0); l = Math.min(l, x - e); r = Math.max(r, x + e); t = Math.min(t, y - e); bt = Math.max(bt, y + e); });
  const s = Math.min((W * 0.9) / (r - l), (H * 0.78) / (bt - t)), ox = W / 2 - ((l + r) / 2) * s, oy = H / 2 - ((t + bt) / 2) * s + H * 0.05;
  const P = (m: { x: number; y: number; path?: { cx?: number; cy?: number } }): [number, number] => [ox + (m.path?.cx ?? m.x) * s, oy + (m.path?.cy ?? m.y) * s];
  c.save(); c.setLineDash([2, 5]); c.strokeStyle = 'rgba(255,240,200,0.35)'; c.lineWidth = 1.5; c.beginPath();
  st.moons.forEach((m, i) => { const [x, y] = P(m); if (i === 0) c.moveTo(x, y); else c.lineTo(x, y); }); c.stroke(); c.restore();
  st.moons.forEach((m) => { want('moon-' + (m.skin ?? 'lantern')); const [x, y] = P(m); disc(c, m.skin ?? 'lantern', x, y, Math.max(7, m.r * s * grow), 0); });
  const hm = st.moons[st.home];
  if (hm) { const [x, y] = P(hm), rr = Math.max(7, hm.r * s * grow); if (done) { const g = c.createRadialGradient(x, y - rr - 9, 1, x, y - rr - 9, 18); g.addColorStop(0, 'rgba(255,214,120,0.8)'); g.addColorStop(1, 'rgba(255,190,90,0)'); c.fillStyle = g; c.beginPath(); c.arc(x, y - rr - 9, 18, 0, TAU); c.fill(); } c.fillStyle = done ? '#ffcf6a' : '#a88a6a'; c.beginPath(); c.ellipse(x, y - rr - 9, 6, 7.5, 0, 0, TAU); c.fill(); }
}
/** The drawn stand-in for the title painting. */
export function paintTitle(cv: HTMLCanvasElement) {
  const c = cv.getContext('2d'); if (!c) return;
  const W = cv.width, H = cv.height, g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#1b1f55'); g.addColorStop(0.7, '#4a3a7a'); g.addColorStop(1, '#a8648a'); c.fillStyle = g; c.fillRect(0, 0, W, H);
  for (let i = 0; i < 120; i++) { c.fillStyle = `rgba(255,255,255,${0.3 + hash(i) * 0.6})`; c.beginPath(); c.arc(hash(i * 3) * W, hash(i * 7) * H * 0.8, 1 + hash(i * 11) * 2, 0, TAU); c.fill(); }
  disc(c, 'moss', W * 0.45, H * 1.05, H * 0.42, 0);
  disc(c, 'cheese', W * 0.82, H * 0.32, H * 0.09, 0);
  disc(c, 'ice', W * 0.14, H * 0.3, H * 0.06, 0);
  drawChinchilla(c, 'dora', W * 0.4, H * 0.64, { face: 1, h: H * 0.2, time: 0 });
  drawChinchilla(c, 'enzo', W * 0.5, H * 0.64, { face: -1, h: H * 0.23, time: 0 });
  c.fillStyle = '#ffcf6a'; c.beginPath(); c.ellipse(W * 0.62, H * 0.2, W * 0.05, H * 0.09, 0, 0, TAU); c.fill();
}
/** The drawn stand-in for the ending painting. */
export function paintEnding(cv: HTMLCanvasElement) {
  const c = cv.getContext('2d'); if (!c) return;
  const W = cv.width, H = cv.height, g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#141a4a'); g.addColorStop(1, '#3a4a6a'); c.fillStyle = g; c.fillRect(0, 0, W, H);
  for (let i = 0; i < 90; i++) { c.fillStyle = `rgba(220,255,140,${0.4 + hash(i) * 0.5})`; c.beginPath(); c.arc(hash(i * 5) * W, hash(i * 9) * H * 0.7, 2 + hash(i) * 2, 0, TAU); c.fill(); }
  c.fillStyle = '#2f5a3a'; c.beginPath(); c.ellipse(W * 0.5, H * 1.1, W * 0.7, H * 0.35, 0, 0, TAU); c.fill();
  c.fillStyle = '#ffcf6a'; c.beginPath(); c.ellipse(W * 0.5, H * 0.3, W * 0.08, H * 0.14, 0, 0, TAU); c.fill();
  drawChinchilla(c, 'dora', W * 0.47, H * 0.62, { face: 1, h: H * 0.14, time: 0 });
  drawChinchilla(c, 'enzo', W * 0.54, H * 0.62, { face: -1, h: H * 0.16, time: 0 });
}
void FALL_IN;
