// Snowdrift's drawing, in Canvas 2D: a sky that turns from dawn to dusk as the day goes, the valley's painting far
// behind, two layers of hazy hills, the snowy course itself (glassy ice, blue cave roofs hung with icicles, gusts,
// the gorges of the snow bridges), the sled's trail, snowflakes and cocoa mugs, the lodge, and the creeping dusk.
// Dora and Enzo on their sled are painted poses once they load (a drawn sled with the shared chinchillas until then),
// tilted to the slope with squash and stretch, and the camera runs ahead and pulls back with speed and height.
// Drawing only: the rules are in snowdrift-game.ts.
import { drawChinchilla } from './chinchilla-art';
import { SnowGame, VALLEYS, VALLEY_IDS, TOP, type Ev, type ValleyId, type Course } from './snowdrift-game';

const TAU = Math.PI * 2;
const mk = (w: number, h: number) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; };
const ctx2 = (c: HTMLCanvasElement) => c.getContext('2d')!;
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** A fixed hash in place of randomness, so the scenery looks the same every time. */
const hash = (n: number) => { const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };
const ease = (rate: number, dt: number) => 1 - Math.exp(-rate * dt);
const wrapA = (a: number) => { a %= TAU; if (a > Math.PI) a -= TAU; if (a < -Math.PI) a += TAU; return a; };

type RGB = [number, number, number];
const hex = (s: string): RGB => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
const mix = (a: RGB, b: RGB, t: number): RGB => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const css = (c: RGB, a = 1) => `rgba(${c[0] | 0}, ${c[1] | 0}, ${c[2] | 0}, ${a})`;

/** The sky through a day: [time, top, horizon]. */
const DAY: [number, string, string][] = [
  [0, '#4c5a9c', '#ffb08a'], [0.18, '#5a8ad6', '#ffd8bc'], [0.4, '#5c9ae2', '#dceeff'], [0.68, '#6a88cc', '#ffe0a8'],
  [0.86, '#4e4c90', '#ff9c6c'], [1, '#1e2048', '#b05a78'],
];
const NIGHT: [string, string] = ['#070c24', '#26305e'];
/** Each valley's look: the far hills' colours, the snow's shade, trees on the near hills, and the fallback mountains. */
/** How far past the finishing flag the lodge stands: past where a sled at full speed coasts to a stop. */
const LODGE_AT = 46;
export const LOOK: Record<ValleyId, { far: string; near: string; shade: string; trees: boolean; peaks: string; night: boolean; accent: string }> = {
  meadow: { far: '#a8bede', near: '#cbdaee', shade: '#b8cbe6', trees: true, peaks: '#93a9cc', night: false, accent: '#5aa070' },
  lake: { far: '#a2bcdc', near: '#d2e2f2', shade: '#b4cce6', trees: true, peaks: '#8ea8ca', night: false, accent: '#6ac0e8' },
  caves: { far: '#98b4da', near: '#c2d6ee', shade: '#a8c4e6', trees: false, peaks: '#7e9cc8', night: false, accent: '#5ab8f0' },
  ridge: { far: '#9cb0d4', near: '#c6d2e8', shade: '#b0c0de', trees: false, peaks: '#7a90bc', night: false, accent: '#e8f0ff' },
  bridges: { far: '#a6b4d4', near: '#cdd6ea', shade: '#b6c4e0', trees: true, peaks: '#8696be', night: false, accent: '#c89a6a' },
  aurora: { far: '#56699e', near: '#7486bc', shade: '#5a74a8', trees: true, peaks: '#1c2a52', night: true, accent: '#6af0b0' },
  summit: { far: '#a0b2d8', near: '#cad6ec', shade: '#b2c2e2', trees: false, peaks: '#7c8ec0', night: false, accent: '#ffc860' },
};
/** Painted poses, and which to borrow when one has not loaded (or never does). */
export type Pose = 'ride' | 'tuck' | 'air' | 'flip' | 'tumble' | 'cheer';
const POSES: Pose[] = ['ride', 'tuck', 'air', 'flip', 'tumble', 'cheer'];
const STAND_IN: Record<Pose, Pose[]> = { ride: ['air', 'tuck', 'cheer'], tuck: ['ride', 'air'], air: ['ride', 'tuck'], flip: ['air', 'ride'], tumble: ['air', 'ride'], cheer: ['ride', 'air'] };
/** The sprites are 768 × 512 with the sled's runners on a line 24 from the bottom and the ride pose 330 wide, 204 tall. */
const SPRITE_W = 768, SPRITE_H = 512, SPRITE_FOOT = 24, SPRITE_FIG = 330, SPRITE_TALL = 204;
/** Where the tip of Enzo's scarf is in each pose, from the runners under the sprite's middle (sprite pixels). */
const SCARF_TIP: Record<Pose, [number, number]> = { ride: [-164, -137], tuck: [-185, -112], air: [-173, -177], cheer: [-165, -137], flip: [-152, -124], tumble: [-128, -170] };
/** How long the sled is drawn, in world units. */
const SLED_LEN = 4.4;
const UNIT = SLED_LEN / SPRITE_FIG;

type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string; kind: 'snow' | 'spark' | 'star' | 'steam' | 'flake' | 'firework' | 'puff'; g: number };
type Pop = { text: string; x: number; y: number; age: number; color: string; big: boolean };

export class SnowScene {
  private canvas: HTMLCanvasElement; private c: CanvasRenderingContext2D;
  private W = 1; private H = 1; private dpr = 1;
  /** The camera: centre in world units, and pixels per unit. */
  private cx = 0; private cy = 0; private k = 30; private camReady = false;
  /** Screen pixels kept clear at the top and bottom (for anything laid over the canvas). */
  inset = { top: 0, bottom: 0 };
  private time = 0; private shake = 0; private shakeOn = true;
  private art = new Map<string, HTMLImageElement>();
  private parts: Particle[] = []; private pops: Pop[] = [];
  private trail: number[] = []; private trailGame: SnowGame | null = null;
  private squash = 0; private visAng = 0; private flash = 0; private flashColor = '#ffffff';
  private lastPose: Pose = 'ride'; private fireworkT = 0;
  private sledBox = { x: 0, y: 0, w: 0, h: 0 };

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas; this.c = ctx2(canvas);
    for (const p of POSES) this.load(p);
    this.resize();
  }
  private load(name: string) { if (this.art.has(name)) return; const img = new Image(); img.decoding = 'async'; img.src = `/art/snowdrift/${name}.webp`; this.art.set(name, img); }
  /** A painting, once it has fully loaded; null until then (or if it never does). */
  img(name: string) { const i = this.art.get(name); return i && i.complete && i.naturalWidth > 0 ? i : null; }
  /** Starts loading a valley's backdrop (only the ones that are needed). */
  want(v: ValleyId) { this.load(`bg-${v}`); }
  private poseImg(p: Pose) { for (const q of [p, ...STAND_IN[p]]) { const i = this.img(q); if (i) return i; } return null; }
  setShake(on: boolean) { this.shakeOn = on; }
  resize() {
    const r = this.canvas.getBoundingClientRect(); this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.W = Math.max(1, r.width); this.H = Math.max(1, r.height);
    const w = Math.round(this.W * this.dpr), h = Math.round(this.H * this.dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
  }
  /** Where the sled pair is drawn on screen, in CSS pixels (for the page and the tests). */
  sledRect() { return { ...this.sledBox, screenH: this.H, screenW: this.W }; }

  private sx(x: number) { return (x - this.cx) * this.k + this.W / 2; }
  private sy(y: number) { return this.H / 2 + this.inset.top / 2 - (y - this.cy) * this.k; }

  /** Reacts to what the game did: spray, sparkles, pops of text, shakes. */
  feed(events: Ev[], g: SnowGame) {
    for (const e of events) {
      switch (e.k) {
        case 'go': this.squash = -0.2; this.spray(g.x - 1, g.y, 10, 0.8); break;
        case 'takeoff': this.squash = -0.18; this.spray(g.x - 1.2, g.y, 6, 0.6); break;
        case 'land': {
          const k = clamp(e.impact / 14, 0.1, 0.6);
          this.squash = k * 0.6; this.spray(g.x, g.y, Math.round(8 + k * 26), 0.6 + k * 1.4);
          if (e.flips > 0) { this.pop(e.flips > 1 ? `${e.flips}× Flip!` : 'Flip!', g, '#ffd86a', true); this.sparkle(g.x, g.y + 1.5, '#fff1a8', 26); this.flash = 0.35; this.flashColor = '#fff4c8'; this.kick(3); }
          if (e.smooth) { this.pop(e.chain >= 2 ? `Smooth ×${e.chain}` : 'Smooth!', g, '#bff4ff', false); this.sparkle(g.x, g.y + 0.6, '#e8fbff', 16); }
          else if (k > 0.45) this.kick(2);
          break;
        }
        case 'tumble': this.pop('Tumble!', g, '#ffb8a0', false); this.spray(g.x, g.y, 34, 1.6); this.kick(4); this.squash = 0.5; break;
        case 'flurry': if (e.on) { this.pop('Snow Flurry!', g, '#9fe8ff', true); this.flash = 0.4; this.flashColor = '#dff6ff'; this.sparkle(g.x, g.y + 1.5, '#c8f4ff', 30); } break;
        case 'bonk': this.kick(3); this.squash = 0.3; for (let i = 0; i < 10; i++) this.parts.push({ x: g.x + (hash(i + this.time) - 0.5) * 3, y: g.y + TOP + 0.4, vx: (hash(i * 3 + this.time) - 0.5) * 6, vy: -2 - hash(i) * 4, life: 0.9, max: 0.9, size: 0.18 + hash(i * 7) * 0.2, color: '#d8f0ff', kind: 'snow', g: 18 }); break;
        case 'fall': this.spray(g.x, g.y, 40, 2); this.pop('Poof!', g, '#e8f0ff', false); this.kick(2); break;
        case 'respawn': this.squash = -0.25; this.sparkle(g.x, g.y + 1.2, '#ffffff', 12); this.trailBreak(); break;
        case 'flake': this.twinkle(e.x, e.y, '#e8f8ff', 5); break;
        case 'cocoa': this.pop(`☕ +${e.push}s daylight`, g, '#ffd2a0', true); this.twinkle(e.x, e.y, '#ffcf8a', 14); for (let i = 0; i < 8; i++) this.parts.push({ x: e.x, y: e.y + 0.6, vx: (hash(i + e.x) - 0.5) * 1.5, vy: 1.5 + hash(i * 5) * 2, life: 1.4, max: 1.4, size: 0.4 + hash(i) * 0.4, color: 'rgba(255,255,255,0.5)', kind: 'steam', g: -1 }); break;
        case 'finish': this.sparkle(g.x, g.y + 2, '#fff2b0', 40); this.pop('The lodge!', g, '#ffe6a0', true); this.fireworkT = 0; break;
        case 'caught': this.pop('Nightfall…', g, '#c8d0ff', true); break;
        default: break;
      }
    }
  }
  private kick(n: number) { if (this.shakeOn) this.shake = Math.min(8, Math.max(this.shake, n)); }
  private pop(text: string, g: SnowGame, color: string, big: boolean) {
    // up and a little behind the sled, so the track ahead stays clear
    this.pops = this.pops.filter((p) => p.age < 0.9).slice(-2);
    this.pops.push({ text, x: g.x - 2.5, y: g.y + 5.5 + this.pops.length * 1.4, age: 0, color, big });
  }
  private spray(x: number, y: number, n: number, k: number) {
    for (let i = 0; i < n; i++) {
      const h = hash(i * 1.7 + this.time * 13 + x), a = Math.PI * (0.55 + 0.4 * hash(i * 3.1 + x));
      const v = (3 + h * 7) * k;
      this.parts.push({ x: x + (h - 0.5) * 1.5, y: y + 0.2, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.9, life: 0.5 + h * 0.5, max: 1, size: 0.18 + hash(i * 5.3 + x) * 0.32, color: '#ffffff', kind: 'snow', g: 16 });
    }
  }
  private sparkle(x: number, y: number, color: string, n: number) {
    for (let i = 0; i < n; i++) { const a = (i / n) * TAU + this.time, v = 3 + hash(i + this.time) * 6; this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.8, max: 0.8, size: 0.16 + hash(i * 3) * 0.16, color, kind: 'star', g: 0 }); }
  }
  private twinkle(x: number, y: number, color: string, n: number) {
    for (let i = 0; i < n; i++) { const a = (i / n) * TAU, v = 1.5 + hash(i + x) * 2.5; this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.5, max: 0.5, size: 0.14 + hash(i * 3 + x) * 0.12, color, kind: 'spark', g: 0 }); }
  }
  private trailBreak() { this.trail.push(NaN, NaN); }

  // ---------------------------------------------------------------- the frame
  draw(g: SnowGame | null, o: { dt: number; paused: boolean }) {
    const c = this.c, dt = o.paused ? 0 : Math.min(0.05, o.dt);
    this.time += dt;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (!g) { this.drawIdle(); return; }
    if (this.trailGame !== g) { this.trailGame = g; this.trail = []; this.parts = []; this.pops = []; this.camReady = false; this.visAng = g.ang; }
    const valley: ValleyId = g.valley ? g.valley.id : g.course.themeAt(g.x);
    this.want(valley);
    this.camera(g, dt);
    // a little shake, never while paused
    const sh = this.shake > 0 ? this.shake : 0; this.shake = Math.max(0, this.shake - dt * 22);
    const shx = sh ? (hash(this.time * 31) - 0.5) * sh : 0, shy = sh ? (hash(this.time * 37) - 0.5) * sh : 0;
    c.save(); c.translate(shx, shy);
    const night = !g.valley || LOOK[valley].night;
    const t = g.dayTime;
    this.sky(valley, t, night);
    const painted = this.backdrop(valley, t, night);
    this.sun(t, night, painted);
    this.hills(valley, g.course, t, night);
    this.terrain(g, valley, t);
    this.lodge(g);
    this.pickupsDraw(g);
    this.trailDraw(g, dt);
    this.windDraw(g);
    this.sled(g, dt, o.paused);
    this.particles(dt);
    this.caves(g);
    this.dusk(g);
    this.popsDraw(dt);
    if (g.phase === 'finish' && g.valley?.id === 'summit') this.fireworks(dt);
    c.restore();
    this.grade(g, dt, t, night);
  }

  /** Runs ahead of the sled and pulls back with speed and with height above the snow. */
  private camera(g: SnowGame, dt: number) {
    const W = this.W, H = Math.max(1, this.H - this.inset.top - this.inset.bottom);
    const sp = g.speed, q = g.course.ground(g.x);
    const above = q ? Math.max(0, g.y - q.y) : Math.max(0, g.y - g.course.height(g.course.start));
    const tall = W < H;
    // visible height: about 22 units at a normal pace, more when fast or high
    let vh = 20 + clamp((sp - 14) * 0.22, 0, 7) + Math.min(42, above * 1.15);
    if (g.phase === 'ready') vh = 19;
    if (g.phase === 'finish') vh = 32;
    let k = H / vh;
    // never so close that the road ahead is cut short (on an upright phone the width decides)
    const minW = tall ? 22 + clamp(sp - 14, 0, 14) * 0.4 : 30;
    k = Math.min(k, W / minW);
    const lead = clamp(sp * 0.42, 2, 14) + (W / k) * 0.12;
    const ahead = g.course.ground(g.x + lead * 1.4);
    const gy = q ? q.y : g.y, ay = ahead ? ahead.y : gy;
    // the sled sits a little below the middle; in a big flight the camera keeps the snow below in view
    let tx = g.x + lead;
    if (g.phase === 'finish' && Number.isFinite(g.course.lodge)) {
      const L = g.course.lodge + LODGE_AT, span = Math.abs(L - g.x) + 26;
      k = Math.min(k, W / span); tx = (g.x + L) / 2;
    }
    const ty = lerp(Math.min(g.y, gy + 6), ay, 0.35) + (H / k) * (g.phase === 'finish' ? 0.2 : 0.08) + Math.min(above, 30) * 0.32;
    if (!this.camReady) { this.cx = tx; this.cy = ty; this.k = k; this.camReady = true; }
    else {
      this.cx = lerp(this.cx, tx, ease(6, dt)); this.cy = lerp(this.cy, ty, ease(4, dt));
      this.k = lerp(this.k, k, ease(above > 3 ? 1.6 : 2.4, dt));
      // the sled never leaves the screen, whatever the smoothing
      const sxp = this.sx(g.x); if (sxp < W * 0.12) this.cx -= (W * 0.12 - sxp) / this.k; if (sxp > W * 0.7) this.cx += (sxp - W * 0.7) / this.k;
      const syp = this.sy(g.y); if (syp < this.inset.top + H * 0.14) this.cy += (this.inset.top + H * 0.14 - syp) / this.k; if (syp > this.H - this.inset.bottom - H * 0.12) this.cy -= (syp - (this.H - this.inset.bottom - H * 0.12)) / this.k;
    }
  }

  private skyColors(t: number, night: boolean): [RGB, RGB] {
    if (night) return [hex(NIGHT[0]), mix(hex(NIGHT[1]), hex('#3a2a5a'), t * 0.6)];
    let i = 0; while (i < DAY.length - 2 && t > DAY[i + 1][0]) i++;
    const a = DAY[i], b = DAY[i + 1], u = clamp((t - a[0]) / (b[0] - a[0]), 0, 1);
    return [mix(hex(a[1]), hex(b[1]), u), mix(hex(a[2]), hex(b[2]), u)];
  }
  private sky(v: ValleyId, t: number, night: boolean) {
    const c = this.c, [top, hor] = this.skyColors(t, night);
    const g = c.createLinearGradient(0, 0, 0, this.H); g.addColorStop(0, css(top)); g.addColorStop(0.62, css(hor)); g.addColorStop(1, css(mix(hor, [255, 255, 255], 0.3)));
    c.fillStyle = g; c.fillRect(-10, -10, this.W + 20, this.H + 20);
    if (night) {
      // stars, and on Aurora Peaks the lights themselves
      for (let i = 0; i < 90; i++) { const x = hash(i) * this.W, y = hash(i + 50) * this.H * 0.6, tw = 0.5 + 0.5 * Math.sin(this.time * (1 + hash(i + 9) * 2) + i); c.fillStyle = `rgba(255,255,255,${0.25 + tw * 0.55})`; c.fillRect(x, y, 1.6, 1.6); }
      if (v === 'aurora') this.auroraBands();
    }
    void v;
  }
  private auroraBands() {
    const c = this.c;
    c.save(); c.globalCompositeOperation = 'screen';
    for (let b = 0; b < 3; b++) {
      const col = b === 1 ? [140, 90, 255] : [70, 240, 170];
      c.beginPath();
      for (let x = -20; x <= this.W + 20; x += 16) { const y = this.H * (0.16 + b * 0.07) + Math.sin(x * 0.006 + this.time * 0.3 + b * 2) * this.H * 0.05 - this.cx * 0.2 * 0; if (x === -20) c.moveTo(x, y); else c.lineTo(x, y); }
      c.strokeStyle = `rgba(${col[0]},${col[1]},${col[2]},0.18)`; c.lineWidth = this.H * 0.07; c.stroke();
      c.strokeStyle = `rgba(${col[0]},${col[1]},${col[2]},0.25)`; c.lineWidth = this.H * 0.02; c.stroke();
    }
    c.restore();
  }
  /** The valley's painting, far away: it scrolls very slowly, mirrored so the seam never shows. */
  private backdrop(v: ValleyId, t: number, night: boolean): boolean {
    const c = this.c, im = this.img(`bg-${v}`);
    const h = this.H * 0.9, top = -this.H * 0.02;
    if (im) {
      const w = (h * im.naturalWidth) / im.naturalHeight;
      const off = -((this.cx * this.k * 0.035) % (w * 2) + w * 2) % (w * 2);
      c.save();
      c.globalAlpha = 1;
      for (let x = off - w * 2; x < this.W + w; x += w) {
        const n = Math.round((x - off) / w), flip = ((n % 2) + 2) % 2 === 1;
        if (x + w < 0 || x > this.W) continue;
        if (flip) { c.save(); c.translate(x + w, top); c.scale(-1, 1); c.drawImage(im, 0, 0, w, h); c.restore(); } else c.drawImage(im, x, top, w, h);
      }
      // the painting takes on the time of day
      const [tc, hc] = this.skyColors(t, night);
      const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, css(tc, 0.32)); g.addColorStop(1, css(hc, 0.22));
      c.fillStyle = g; c.fillRect(0, top, this.W, h);
      if (!night) { c.fillStyle = `rgba(30, 24, 70, ${clamp((t - 0.6) * 0.9, 0, 0.42)})`; c.fillRect(0, top, this.W, h); }
      // a daytime painting under the moonlit hills turns to night
      else if (!LOOK[v].night) { c.fillStyle = 'rgba(16, 22, 64, 0.58)'; c.fillRect(0, top, this.W, h); }
      // fade the bottom of the painting into the haze
      const f = c.createLinearGradient(0, h * 0.55, 0, h + top); f.addColorStop(0, css(hc, 0)); f.addColorStop(1, css(hc, 0.9));
      c.fillStyle = f; c.fillRect(0, h * 0.55, this.W, h * 0.45 + top + 2);
      c.restore();
      return true;
    }
    // until the painting loads: far peaks drawn in the valley's colours
    const L = LOOK[v], base = this.H * 0.55;
    c.fillStyle = L.peaks; c.beginPath(); c.moveTo(0, this.H);
    for (let x = 0; x <= this.W + 40; x += 40) { const wx = x / 40 + Math.floor(this.cx * this.k * 0.035 / 40); const y = base - (0.15 + hash(wx) * 0.22) * this.H; c.lineTo(x - ((this.cx * this.k * 0.035) % 40), y); }
    c.lineTo(this.W, this.H); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.55)';
    for (let x = 0; x <= this.W + 40; x += 40) { const wx = x / 40 + Math.floor(this.cx * this.k * 0.035 / 40); const y = base - (0.15 + hash(wx) * 0.22) * this.H, px = x - ((this.cx * this.k * 0.035) % 40); c.beginPath(); c.moveTo(px - 8, y + 10); c.lineTo(px, y); c.lineTo(px + 8, y + 10); c.fill(); }
    return false;
  }
  /** The sun: low behind them at dawn, high at noon, sinking ahead toward the lodge as the dusk comes on. */
  private sun(t: number, night: boolean, painted: boolean) {
    const c = this.c;
    if (night) {
      const x = this.W * 0.78, y = this.H * 0.17, r = Math.max(14, this.H * 0.04);
      const g = c.createRadialGradient(x, y, r * 0.5, x, y, r * 4); g.addColorStop(0, 'rgba(230,240,255,0.35)'); g.addColorStop(1, 'rgba(230,240,255,0)');
      c.fillStyle = g; c.fillRect(x - r * 4, y - r * 4, r * 8, r * 8);
      c.fillStyle = '#f4f6ff'; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
      c.fillStyle = 'rgba(200,210,235,0.5)'; c.beginPath(); c.arc(x - r * 0.3, y - r * 0.2, r * 0.22, 0, TAU); c.arc(x + r * 0.35, y + r * 0.25, r * 0.15, 0, TAU); c.fill();
      return;
    }
    const x = lerp(this.W * 0.1, this.W * 0.92, t), y = this.H * (0.62 - Math.sin(Math.PI * clamp(t * 0.95 + 0.04, 0, 1)) * 0.46);
    const r = Math.max(16, this.H * 0.045) * (1 + (t > 0.7 ? (t - 0.7) * 0.8 : 0));
    const warm = t < 0.2 || t > 0.65;
    c.save(); c.globalCompositeOperation = 'screen';
    const g = c.createRadialGradient(x, y, r * 0.4, x, y, r * 6);
    g.addColorStop(0, warm ? 'rgba(255,200,130,0.65)' : 'rgba(255,250,220,0.55)'); g.addColorStop(1, 'rgba(255,200,130,0)');
    c.fillStyle = g; c.fillRect(x - r * 6, y - r * 6, r * 12, r * 12);
    c.restore();
    // the paintings carry their own sky and sun, so over them only the glow shows
    if (!painted) { c.fillStyle = warm ? '#ffd28a' : '#fff6da'; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }
  }
  /** Two layers of hazy snowy hills between the painting and the course. */
  private hills(v: ValleyId, course: Course, t: number, night: boolean) {
    const c = this.c, L = LOOK[v], [, hor] = this.skyColors(t, night);
    const layers: [number, string, number, number][] = [[0.18, L.far, 0.6, 0.42], [0.42, L.near, 0.72, 0.62]];
    for (const [par, col, base, haze] of layers) {
      const off = this.cx * this.k * par, y0 = this.H * base;
      const fill = mix(hex(col), hor, haze * 0.5);
      c.fillStyle = css(night ? mix(fill, [60, 72, 124], 0.2) : fill);
      c.beginPath(); c.moveTo(-10, this.H + 10);
      for (let x = -10; x <= this.W + 20; x += 10) {
        const wx = (x + off) / (this.H * 0.5);
        const y = y0 - (Math.sin(wx * 1.3) * 0.5 + Math.sin(wx * 2.9 + par * 7) * 0.25 + Math.sin(wx * 0.6 + 2) * 0.6) * this.H * 0.05 * (1 + par);
        c.lineTo(x, y);
      }
      c.lineTo(this.W + 20, this.H + 10); c.closePath(); c.fill();
      if (L.trees) {
        // little pines along the nearer ridge
        const tc = css(mix(night ? [14, 30, 44] : [60, 96, 98], hor, haze * 0.5 + (night ? 0.1 : 0.15)));
        c.fillStyle = tc;
        const step = 26 + par * 30;
        for (let x = -step - (off % step); x < this.W + step; x += step) {
          const n = Math.round((x + off) / step); if (hash(n * 1.3 + par) < 0.45) continue;
          const wx = (x + off) / (this.H * 0.5);
          const y = y0 - (Math.sin(wx * 1.3) * 0.5 + Math.sin(wx * 2.9 + par * 7) * 0.25 + Math.sin(wx * 0.6 + 2) * 0.6) * this.H * 0.05 * (1 + par);
          const th = (10 + hash(n) * 14) * (0.6 + par);
          c.beginPath(); c.moveTo(x, y - th); c.lineTo(x - th * 0.32, y + 2); c.lineTo(x + th * 0.32, y + 2); c.fill();
        }
      }
    }
    void course;
  }

  /** The course: snow with a bright rim, ice where it's glassy, cliffs at the gaps. */
  private terrain(g: SnowGame, v: ValleyId, t: number) {
    const c = this.c, co = g.course, L = LOOK[v];
    const x0 = this.cx - this.W / 2 / this.k - 2, x1 = this.cx + this.W / 2 / this.k + 2;
    const step = Math.max(0.25, 3 / this.k);
    const bottom = this.H + 20;
    // runs of ground between gaps
    const runs: { x: number; y: number }[][] = [];
    let run: { x: number; y: number }[] = [];
    for (let x = x0; x <= x1 + step; x += step) {
      const q = co.ground(x);
      if (!q) { if (run.length) { runs.push(run); run = []; } continue; }
      run.push({ x, y: q.y });
    }
    if (run.length) runs.push(run);
    // snap the run ends exactly to the gap edges
    for (const r of runs) {
      const a = r[0], b = r[r.length - 1];
      for (const z of co.zones) if (z.kind === 'gap') {
        if (a.x > z.x1 - 0.01 && a.x - z.x1 < step * 1.5) r.unshift({ x: z.x1, y: co.height(z.x1 + 0.001) });
        if (b.x < z.x0 + 0.01 && z.x0 - b.x < step * 1.5) r.push({ x: z.x0, y: co.height(z.x0 - 0.001) });
      }
    }
    const shade = hex(L.shade), dusk = clamp((t - 0.55) * 1.6, 0, 1);
    const snowTop: RGB = L.night ? [214, 226, 250] : mix([252, 253, 255], [255, 214, 190], dusk * 0.35);
    const body: RGB = L.night ? [120, 146, 196] : mix(shade, [170, 160, 210], dusk * 0.4);
    for (const r of runs) {
      c.beginPath();
      c.moveTo(this.sx(r[0].x), bottom);
      for (const p of r) c.lineTo(this.sx(p.x), this.sy(p.y));
      c.lineTo(this.sx(r[r.length - 1].x), bottom); c.closePath();
      const top = Math.min(...r.map((p) => this.sy(p.y)));
      const gr = c.createLinearGradient(0, top, 0, top + this.k * 30);
      gr.addColorStop(0, css(snowTop)); gr.addColorStop(0.08, css(mix(snowTop, body, 0.35))); gr.addColorStop(1, css(mix(body, [60, 80, 130], 0.4)));
      c.fillStyle = gr; c.fill();
      // a soft shadow on the faces that turn away from the light
      c.save(); c.clip();
      c.lineWidth = this.k * 1.6; c.lineJoin = 'round';
      for (let i = 1; i < r.length; i++) {
        const m = (r[i].y - r[i - 1].y) / (r[i].x - r[i - 1].x);
        if (m > -0.06) continue;
        c.strokeStyle = css(body, clamp(-m * 0.6, 0, 0.35));
        c.beginPath(); c.moveTo(this.sx(r[i - 1].x), this.sy(r[i - 1].y) + this.k * 0.9); c.lineTo(this.sx(r[i].x), this.sy(r[i].y) + this.k * 0.9); c.stroke();
      }
      // sparkles in the snow
      for (let i = 0; i < r.length; i += 3) { const h = hash(Math.round(r[i].x * 2)); if (h < 0.82) continue; const tw = Math.sin(this.time * 3 + h * 40); if (tw < 0.3) continue; c.fillStyle = `rgba(255,255,255,${tw * 0.9})`; c.fillRect(this.sx(r[i].x), this.sy(r[i].y) + this.k * (0.4 + h * 1.4), 2, 2); }
      c.restore();
      // the bright rim, glassy blue over the ice
      c.lineWidth = Math.max(2, this.k * 0.22); c.lineJoin = 'round'; c.lineCap = 'round';
      c.strokeStyle = css(mix(snowTop, [255, 255, 255], 0.6));
      c.beginPath(); r.forEach((p, i) => (i ? c.lineTo(this.sx(p.x), this.sy(p.y)) : c.moveTo(this.sx(p.x), this.sy(p.y)))); c.stroke();
      this.ice(co, r);
    }
    // the gaps: snowy cornices over a deep blue gorge
    for (const z of co.zones) {
      if (z.kind !== 'gap' || z.x1 < x0 || z.x0 > x1) continue;
      const a = this.sx(z.x0), b = this.sx(z.x1), ya = this.sy(co.height(z.x0 - 0.001)), yb = this.sy(co.height(z.x1 + 0.001));
      const gr = c.createLinearGradient(0, Math.min(ya, yb), 0, bottom);
      gr.addColorStop(0, 'rgba(70, 100, 160, 0.0)'); gr.addColorStop(0.3, 'rgba(50, 70, 130, 0.35)'); gr.addColorStop(1, 'rgba(24, 30, 70, 0.6)');
      c.fillStyle = gr; c.fillRect(a, Math.min(ya, yb), b - a, bottom);
      // the broken ends of a snow bridge
      c.fillStyle = css(snowTop);
      for (const [x, y, d] of [[a, ya, 1], [b, yb, -1]] as [number, number, number][]) {
        c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + d * this.k * 1.6, y + this.k * 0.2, x + d * this.k * 1.2, y + this.k * 0.9);
        c.lineTo(x, y + this.k * 1.2); c.fill();
        c.fillStyle = 'rgba(120, 150, 200, 0.6)';
        for (let i = 0; i < 4; i++) { const ix = x + d * this.k * (0.2 + i * 0.28), il = this.k * (0.5 + hash(i + z.x0) * 0.9); c.beginPath(); c.moveTo(ix - this.k * 0.1, y + this.k * 0.8); c.lineTo(ix, y + this.k * 0.8 + il); c.lineTo(ix + this.k * 0.1, y + this.k * 0.8); c.fill(); }
        c.fillStyle = css(snowTop);
      }
      // a little warning flag on the lip
      const fx = this.sx(z.x0 - 1.2), fy = this.sy(co.height(z.x0 - 1.2));
      c.strokeStyle = '#6a4a30'; c.lineWidth = Math.max(1.5, this.k * 0.1); c.beginPath(); c.moveTo(fx, fy); c.lineTo(fx, fy - this.k * 2.6); c.stroke();
      c.fillStyle = '#e84a3a'; c.beginPath(); c.moveTo(fx, fy - this.k * 2.6); c.lineTo(fx + this.k * (1 + Math.sin(this.time * 6) * 0.1), fy - this.k * 2.25); c.lineTo(fx, fy - this.k * 1.9); c.fill();
    }
  }
  private ice(co: Course, r: { x: number; y: number }[]) {
    const c = this.c;
    let on = false;
    c.lineWidth = Math.max(3, this.k * 0.42); c.lineCap = 'round';
    c.strokeStyle = 'rgba(150, 215, 255, 0.85)';
    c.beginPath();
    for (const p of r) {
      const ice = co.isIce(p.x);
      if (ice && !on) { c.moveTo(this.sx(p.x), this.sy(p.y)); on = true; } else if (ice) c.lineTo(this.sx(p.x), this.sy(p.y)); else on = false;
    }
    c.stroke();
    // glints
    c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = Math.max(1, this.k * 0.08);
    for (const p of r) { if (!co.isIce(p.x)) continue; const h = hash(Math.round(p.x)); if (h < 0.9) continue; const x = this.sx(p.x), y = this.sy(p.y) + this.k * 0.25; c.beginPath(); c.moveTo(x - this.k * 0.8, y); c.lineTo(x + this.k * 0.8, y); c.stroke(); }
  }
  /** Cave roofs: blue ice from the roof line up, with icicles along it. Drawn over the sled, which passes under. */
  private caves(g: SnowGame) {
    const c = this.c, co = g.course;
    const x0 = this.cx - this.W / 2 / this.k - 2, x1 = this.cx + this.W / 2 / this.k + 2;
    for (const z of co.zones) {
      if (z.kind !== 'cave' || z.x1 < x0 || z.x0 > x1) continue;
      const a = Math.max(x0, z.x0), b = Math.min(x1, z.x1), step = Math.max(0.3, 3 / this.k);
      const pts: { x: number; y: number }[] = [];
      for (let x = a; x <= b + step; x += step) { const r = co.ceiling(Math.min(x, z.x1)); if (r !== null) pts.push({ x: Math.min(x, z.x1), y: r }); }
      if (pts.length < 2) continue;
      c.beginPath(); c.moveTo(this.sx(pts[0].x), -20);
      for (const p of pts) c.lineTo(this.sx(p.x), this.sy(p.y));
      c.lineTo(this.sx(pts[pts.length - 1].x), -20); c.closePath();
      const top = Math.min(...pts.map((p) => this.sy(p.y)));
      const gr = c.createLinearGradient(0, top - this.k * 12, 0, top + this.k * 6);
      gr.addColorStop(0, '#1a3058'); gr.addColorStop(0.7, '#3a64a0'); gr.addColorStop(1, '#7ab4e8');
      c.fillStyle = gr; c.fill();
      c.strokeStyle = 'rgba(200, 236, 255, 0.9)'; c.lineWidth = Math.max(2, this.k * 0.18); c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(this.sx(p.x), this.sy(p.y)) : c.moveTo(this.sx(p.x), this.sy(p.y)))); c.stroke();
      // icicles
      c.fillStyle = 'rgba(210, 240, 255, 0.92)';
      for (let x = Math.ceil(a); x < b; x += 1) {
        const h = hash(x * 1.31); if (h < 0.35) continue;
        const r = co.ceiling(x); if (r === null) continue;
        const len = (0.4 + h * 1.1) * this.k, X = this.sx(x), Y = this.sy(r) - 1, w = this.k * (0.16 + h * 0.14);
        c.beginPath(); c.moveTo(X - w, Y); c.lineTo(X, Y + len); c.lineTo(X + w, Y); c.fill();
      }
      // the mouths of the cave fade into shadow
      for (const [mx, d] of [[z.x0, 1], [z.x1, -1]] as [number, number][]) {
        const X = this.sx(mx);
        if (X < -50 || X > this.W + 50) continue;
        const fg = c.createLinearGradient(X, 0, X + d * this.k * 8, 0); fg.addColorStop(0, 'rgba(26, 48, 88, 0.85)'); fg.addColorStop(1, 'rgba(26, 48, 88, 0)');
        c.fillStyle = fg; c.fillRect(Math.min(X, X + d * this.k * 8), -20, this.k * 8, this.sy(co.height(mx)) + 20 - this.k * 2);
      }
    }
  }
  private windDraw(g: SnowGame) {
    const c = this.c, co = g.course;
    const x0 = this.cx - this.W / 2 / this.k - 2, x1 = this.cx + this.W / 2 / this.k + 2;
    for (const z of co.zones) {
      if (z.kind !== 'wind' || z.x1 < x0 || z.x0 > x1) continue;
      c.save();
      c.lineCap = 'round';
      for (let i = 0; i < 26; i++) {
        const h = hash(i * 7.7 + z.x0), span = z.x1 - z.x0;
        const u = ((h + this.time * (0.35 + hash(i) * 0.2)) % 1);
        const x = z.x0 + u * span, q = co.ground(x); if (!q) continue;
        const y = q.y + 2 + hash(i * 3.3) * 14;
        const X = this.sx(x), Y = this.sy(y), len = this.k * (2 + hash(i * 5) * 3);
        const a = Math.sin(u * Math.PI) * 0.5;
        c.strokeStyle = `rgba(255,255,255,${a})`; c.lineWidth = Math.max(1, this.k * 0.08);
        c.beginPath(); c.moveTo(X - len, Y + Math.sin(this.time * 4 + i) * 2); c.quadraticCurveTo(X - len / 2, Y - this.k * 0.4, X, Y); c.stroke();
      }
      c.restore();
    }
  }
  private lodge(g: SnowGame) {
    const co = g.course; if (!Number.isFinite(co.lodge)) return;
    const c = this.c, x = co.lodge + LODGE_AT, q = co.ground(x); if (!q) return;
    const X = this.sx(x), Y = this.sy(q.y), u = this.k * (g.valley?.id === 'summit' ? 1.25 : 1);
    if (X < -40 * u || X > this.W + 40 * u) { this.flag(g); return; }
    // the lodge: timber walls, a snowy roof, glowing windows and a curl of smoke
    c.fillStyle = '#7a4e2e'; c.fillRect(X - 7 * u, Y - 7 * u, 14 * u, 7 * u);
    c.fillStyle = '#5e3a20'; for (let i = 1; i < 7; i++) c.fillRect(X - 7 * u, Y - i * u, 14 * u, u * 0.12);
    c.fillStyle = '#fff6ea'; c.beginPath(); c.moveTo(X - 8.6 * u, Y - 6.6 * u); c.lineTo(X, Y - 12 * u); c.lineTo(X + 8.6 * u, Y - 6.6 * u); c.closePath(); c.fill();
    c.fillStyle = '#6a3e24'; c.fillRect(X + 3.6 * u, Y - 12 * u, 1.6 * u, 3.6 * u);
    const glow = 0.85 + Math.sin(this.time * 3) * 0.08;
    for (const wx of [-4.6, 1.8]) { c.fillStyle = `rgba(255, 196, 100, ${glow})`; c.fillRect(X + wx * u, Y - 5 * u, 2.8 * u, 2.2 * u); c.fillStyle = '#5e3a20'; c.fillRect(X + (wx + 1.3) * u, Y - 5 * u, 0.2 * u, 2.2 * u); }
    c.fillStyle = '#4a2c18'; c.fillRect(X - 1.2 * u, Y - 3.8 * u, 2.4 * u, 3.8 * u);
    c.fillStyle = '#8a8a9a'; c.fillRect(X - 7.3 * u, Y - 0.9 * u, 14.6 * u, 0.9 * u);
    c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(X - 9 * u, Y - 6.4 * u); c.lineTo(X + 9 * u, Y - 6.4 * u); c.lineTo(X + 8.6 * u, Y - 7.2 * u); c.lineTo(X - 8.6 * u, Y - 7.2 * u); c.fill();
    c.fillStyle = 'rgba(200, 230, 255, 0.9)'; for (let i = 0; i < 9; i++) { const ix = X + (-8 + i * 2) * u, ih = (0.5 + hash(i * 3.3) * 0.9) * u; c.beginPath(); c.moveTo(ix - 0.25 * u, Y - 6.4 * u); c.lineTo(ix, Y - 6.4 * u + ih); c.lineTo(ix + 0.25 * u, Y - 6.4 * u); c.fill(); }
    c.fillStyle = `rgba(255, 210, 120, ${glow})`; c.beginPath(); c.arc(X + 2 * u, Y - 4.2 * u, 0.45 * u, 0, TAU); c.fill();
    for (let i = 0; i < 5; i++) { const t = (this.time * 0.4 + i / 5) % 1; c.fillStyle = `rgba(240,240,250,${0.45 * (1 - t)})`; c.beginPath(); c.arc(X + 4.4 * u + Math.sin(t * 5 + i) * u, Y - 12 * u - t * 6 * u, (0.6 + t * 1.4) * u, 0, TAU); c.fill(); }
    // warm light on the snow
    const gl = c.createRadialGradient(X, Y - 3 * u, u, X, Y - 3 * u, 14 * u); gl.addColorStop(0, 'rgba(255, 190, 110, 0.35)'); gl.addColorStop(1, 'rgba(255, 190, 110, 0)');
    c.fillStyle = gl; c.fillRect(X - 14 * u, Y - 17 * u, 28 * u, 28 * u);
    this.flag(g);
  }
  private flag(g: SnowGame) {
    const co = g.course, c = this.c, x = co.lodge, q = co.ground(x); if (!q) return;
    const X = this.sx(x), Y = this.sy(q.y), k = this.k;
    if (X < -60 || X > this.W + 60) return;
    c.strokeStyle = '#5a3a22'; c.lineWidth = Math.max(2, k * 0.14); c.beginPath(); c.moveTo(X, Y); c.lineTo(X, Y - k * 5.5); c.stroke();
    const wave = Math.sin(this.time * 5) * k * 0.2;
    c.fillStyle = '#e8483a'; c.beginPath(); c.moveTo(X, Y - k * 5.5); c.quadraticCurveTo(X + k * 1.2, Y - k * 5.2 + wave, X + k * 2.4, Y - k * 4.9); c.lineTo(X, Y - k * 4.2); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(X + k * 0.9, Y - k * 4.85, k * 0.22, 0, TAU); c.fill();
  }
  private pickupsDraw(g: SnowGame) {
    const c = this.c, ps = g.course.pickups;
    const x0 = this.cx - this.W / 2 / this.k - 2, x1 = this.cx + this.W / 2 / this.k + 2;
    let lo = 0, hi = ps.length; while (lo < hi) { const m = (lo + hi) >> 1; if (ps[m].x < x0) lo = m + 1; else hi = m; }
    for (let i = lo; i < ps.length && ps[i].x <= x1; i++) {
      const p = ps[i]; if (g.has(p.id)) continue;
      const X = this.sx(p.x), Y = this.sy(p.y + Math.sin(this.time * 2.4 + p.x) * 0.12);
      if (p.kind === 'flake') this.flakeGlyph(X, Y, this.k * 0.55, this.time * 0.8 + p.x);
      else this.mug(X, Y, this.k * 0.75);
    }
  }
  private flakeGlyph(X: number, Y: number, r: number, a: number) {
    const c = this.c;
    const gl = c.createRadialGradient(X, Y, 0, X, Y, r * 1.8); gl.addColorStop(0, 'rgba(200, 240, 255, 0.55)'); gl.addColorStop(1, 'rgba(200, 240, 255, 0)');
    c.fillStyle = gl; c.fillRect(X - r * 2, Y - r * 2, r * 4, r * 4);
    c.save(); c.translate(X, Y); c.rotate(a);
    for (const [col, w] of [['#4a86c8', Math.max(2.4, r * 0.34)], ['#ffffff', Math.max(1.2, r * 0.16)]] as [string, number][]) {
      c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round';
      c.beginPath();
      for (let i = 0; i < 6; i++) { const u = (i / 6) * TAU, cx = Math.cos(u), cy = Math.sin(u); c.moveTo(0, 0); c.lineTo(cx * r, cy * r); const bx = cx * r * 0.6, by = cy * r * 0.6; c.moveTo(bx, by); c.lineTo(bx + Math.cos(u + 0.8) * r * 0.3, by + Math.sin(u + 0.8) * r * 0.3); c.moveTo(bx, by); c.lineTo(bx + Math.cos(u - 0.8) * r * 0.3, by + Math.sin(u - 0.8) * r * 0.3); }
      c.stroke();
    }
    c.restore();
  }
  private mug(X: number, Y: number, r: number) {
    const c = this.c;
    const gl = c.createRadialGradient(X, Y, 0, X, Y, r * 2.6); gl.addColorStop(0, 'rgba(255, 200, 120, 0.6)'); gl.addColorStop(1, 'rgba(255, 200, 120, 0)');
    c.fillStyle = gl; c.fillRect(X - r * 3, Y - r * 3, r * 6, r * 6);
    c.lineWidth = Math.max(1.5, r * 0.14); c.strokeStyle = '#5a2a1a';
    c.fillStyle = '#e8483a'; c.beginPath(); c.roundRect(X - r * 0.7, Y - r * 0.6, r * 1.3, r * 1.4, r * 0.25); c.fill(); c.stroke();
    c.beginPath(); c.arc(X + r * 0.68, Y + r * 0.1, r * 0.36, -1.3, 1.3); c.stroke();
    c.fillStyle = '#fff'; c.fillRect(X - r * 0.7, Y - r * 0.05, r * 1.3, r * 0.22);
    c.fillStyle = '#7a3e1e'; c.beginPath(); c.ellipse(X - r * 0.05, Y - r * 0.6, r * 0.62, r * 0.16, 0, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.75)'; c.lineWidth = Math.max(1, r * 0.1);
    for (let i = 0; i < 2; i++) { const o = Math.sin(this.time * 3 + i * 2) * r * 0.15; c.beginPath(); c.moveTo(X - r * 0.25 + i * r * 0.4, Y - r * 0.8); c.bezierCurveTo(X - r * 0.45 + i * r * 0.4 + o, Y - r * 1.2, X - r * 0.05 + i * r * 0.4 - o, Y - r * 1.4, X - r * 0.25 + i * r * 0.4, Y - r * 1.8); c.stroke(); }
  }
  /** The groove the runners leave in the snow. */
  private trailDraw(g: SnowGame, dt: number) {
    if (!g.air && g.phase !== 'fall' && dt > 0) {
      const n = this.trail.length;
      if (!n || Number.isNaN(this.trail[n - 2]) || Math.abs(this.trail[n - 2] - g.x) > 0.4) this.trail.push(g.x, g.y);
    } else if (g.air && this.trail.length && !Number.isNaN(this.trail[this.trail.length - 1])) this.trailBreak();
    if (this.trail.length > 2400) this.trail.splice(0, this.trail.length - 2000);
    const c = this.c, t = this.trail;
    c.strokeStyle = 'rgba(120, 150, 200, 0.45)'; c.lineWidth = Math.max(1.5, this.k * 0.14); c.lineJoin = 'round';
    c.beginPath(); let pen = false;
    for (let i = 0; i < t.length; i += 2) {
      if (Number.isNaN(t[i])) { pen = false; continue; }
      const X = this.sx(t[i]); if (X < -20 || X > this.W + 20) { pen = false; continue; }
      const Y = this.sy(t[i + 1]) + this.k * 0.12;
      if (pen) c.lineTo(X, Y); else { c.moveTo(X, Y); pen = true; }
    }
    c.stroke();
  }

  private poseOf(g: SnowGame): Pose {
    if (g.phase === 'finish' && g.speed < 3) return 'cheer';
    if (g.tumbling) return 'tumble';
    if (g.air) return Math.abs(g.omega) > 1.2 || Math.abs(g.spin) > 0.9 ? 'flip' : 'air';
    if (g.phase === 'ride' && g.held) return 'tuck';
    return 'ride';
  }
  /** Dora and Enzo on the sled: the painted pose (or the drawn sled), tilted to the slope, squashed and stretched. */
  private sled(g: SnowGame, dt: number, paused: boolean) {
    if (g.phase === 'fall') { this.sledBox = { x: 0, y: 0, w: 0, h: 0 }; return; }
    const c = this.c, pose = this.poseOf(g);
    this.lastPose = pose;
    // the drawn angle eases to the sled's, and a tumble rolls them over and over
    let want = g.ang;
    if (g.tumbling) want = g.ang - (1.1 - g.tumbleT) * 9;
    if (!paused) this.visAng = g.tumbling || g.air ? want : this.visAng + wrapA(want - this.visAng) * ease(18, dt);
    this.squash = lerp(this.squash, 0, ease(9, dt));
    const sq = this.squash, sp = g.speed;
    const X = this.sx(g.x), Y = this.sy(g.y);
    // a soft shadow on the snow under a flight
    if (g.air) { const q = g.course.ground(g.x); if (q) { const d = g.y - q.y, a = clamp(0.35 - d * 0.015, 0.05, 0.35); c.fillStyle = `rgba(40, 60, 110, ${a})`; c.beginPath(); c.ellipse(X, this.sy(q.y) + 2, this.k * SLED_LEN * 0.5 * (1 - Math.min(0.6, d * 0.02)), this.k * 0.3, -Math.atan(q.m), 0, TAU); c.fill(); } }
    // speed sparks of snow from the runners
    if (!g.air && !paused && sp > 12 && hash(this.time * 60) < clamp((sp - 12) / 25, 0, 0.8)) {
      this.parts.push({ x: g.x - 1.6, y: g.y + 0.1, vx: -sp * 0.15 - hash(this.time) * 3, vy: 2 + hash(this.time * 3) * 3, life: 0.45, max: 0.45, size: 0.14 + hash(this.time * 7) * 0.18, color: '#ffffff', kind: 'snow', g: 14 });
    }
    // a trail of snow behind them in a flurry
    if (g.flurry && !paused) for (let i = 0; i < 2; i++) this.parts.push({ x: g.x - 1 - hash(this.time * 9 + i) * 2, y: g.y + 0.5 + hash(this.time * 5 + i) * 2.5, vx: -4 - hash(i + this.time) * 4, vy: (hash(i * 3 + this.time) - 0.5) * 2, life: 0.9, max: 0.9, size: 0.12 + hash(this.time * 11 + i) * 0.2, color: hash(i + this.time * 3) > 0.5 ? '#dff8ff' : '#ffffff', kind: 'flake', g: -0.5 });
    c.save();
    c.translate(X, Y); c.rotate(-this.visAng);
    const sxk = 1 + sq * 0.35, syk = 1 - sq * 0.4;
    c.scale(sxk, syk);
    const im = this.poseImg(pose);
    const ppu = this.k * UNIT;
    if (im) {
      const w = SPRITE_W * ppu, h = SPRITE_H * ppu;
      c.drawImage(im, -w / 2, -h + SPRITE_FOOT * ppu, w, h);
      this.flutter(pose, sp, ppu);
      this.sledBox = { x: X - SPRITE_FIG * ppu / 2, y: Y - SPRITE_TALL * ppu, w: SPRITE_FIG * ppu, h: SPRITE_TALL * ppu };
    } else {
      this.drawnSled(pose, ppu);
      this.sledBox = { x: X - SPRITE_FIG * ppu / 2, y: Y - SPRITE_TALL * ppu, w: SPRITE_FIG * ppu, h: SPRITE_TALL * ppu };
    }
    c.restore();
  }
  /** Wind streaming off the tip of Enzo's painted scarf, faster with the speed. Sprite pixel units. */
  private flutter(pose: Pose, sp: number, ppu: number) {
    const c = this.c, tip = SCARF_TIP[pose], a = clamp((sp - 6) / 24, 0, 1);
    if (a <= 0) return;
    c.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const y = (tip[1] + (i - 1) * 9) * ppu, x = tip[0] * ppu, len = (40 + 30 * a + Math.sin(this.time * 9 + i * 2) * 10) * ppu;
      const wob = Math.sin(this.time * 16 + i * 1.7) * 6 * ppu;
      c.strokeStyle = i === 1 ? `rgba(70, 130, 220, ${0.55 * a})` : `rgba(255, 255, 255, ${0.5 * a})`;
      c.lineWidth = Math.max(1, (i === 1 ? 5 : 3) * ppu);
      c.beginPath(); c.moveTo(x - 4 * ppu, y); c.quadraticCurveTo(x - len * 0.5, y + wob, x - len, y - wob * 0.5); c.stroke();
    }
  }
  /** The stand-in until the paintings load: a wooden sled with the drawn chinchillas aboard. */
  private drawnSled(pose: Pose, ppu: number) {
    const c = this.c, L = SPRITE_FIG * ppu, foot = SPRITE_FOOT * ppu * 0;
    c.strokeStyle = '#7a4a24'; c.lineWidth = Math.max(2, L * 0.03); c.lineCap = 'round';
    c.beginPath(); c.moveTo(-L * 0.5, -foot); c.lineTo(L * 0.36, -foot); c.quadraticCurveTo(L * 0.56, -foot, L * 0.5, -L * 0.14); c.stroke();
    c.fillStyle = '#c0803e'; c.fillRect(-L * 0.46, -L * 0.12, L * 0.84, L * 0.06);
    c.fillStyle = '#8a5a2e'; for (const x of [-0.36, 0, 0.3]) c.fillRect(L * x, -L * 0.07, L * 0.03, L * 0.07);
    const h = L * (pose === 'tuck' ? 0.3 : 0.38), t = this.time;
    drawChinchilla(c, 'enzo', -L * 0.18, -L * 0.11, { face: 1, h: h * 1.15, time: t, air: pose === 'air' || pose === 'flip' });
    drawChinchilla(c, 'dora', L * 0.17, -L * 0.11, { face: 1, h, time: t, air: pose === 'air' || pose === 'flip' });
  }

  private particles(dt: number) {
    const c = this.c;
    this.parts = this.parts.filter((p) => (p.life -= dt) > 0);
    if (this.parts.length > 700) this.parts.splice(0, this.parts.length - 700);
    for (const p of this.parts) {
      p.vy -= p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      const a = clamp(p.life / p.max, 0, 1), X = this.sx(p.x), Y = this.sy(p.y), r = Math.max(1, p.size * this.k);
      if (p.kind === 'star' || p.kind === 'spark' || p.kind === 'firework') {
        c.fillStyle = p.color; c.globalAlpha = a;
        c.beginPath(); c.moveTo(X, Y - r * 1.6); c.lineTo(X + r * 0.4, Y); c.lineTo(X, Y + r * 1.6); c.lineTo(X - r * 0.4, Y); c.closePath(); c.fill();
        c.beginPath(); c.moveTo(X - r * 1.6, Y); c.lineTo(X, Y + r * 0.4); c.lineTo(X + r * 1.6, Y); c.lineTo(X, Y - r * 0.4); c.closePath(); c.fill();
      } else {
        c.fillStyle = p.color; c.globalAlpha = a * (p.kind === 'steam' ? 0.6 : 0.9);
        c.beginPath(); c.arc(X, Y, r * (p.kind === 'steam' ? 1 + (1 - a) * 1.5 : 1), 0, TAU); c.fill();
      }
    }
    c.globalAlpha = 1;
  }
  /** The dusk: a soft blue wall of night from the left, full of stars, with a glowing edge. */
  private dusk(g: SnowGame) {
    const c = this.c, X = this.sx(g.duskX);
    // still off screen but coming: the left edge darkens and fills with stars as the daylight runs short
    const near = g.phase === 'ride' || g.phase === 'fall' ? clamp((6 - g.daylight) / 5, 0, 1) : 0;
    if (near > 0 && X < this.W * 0.3) {
      const w = this.W * (0.1 + 0.3 * near), e = c.createLinearGradient(0, 0, w, 0);
      e.addColorStop(0, `rgba(10, 14, 46, ${0.6 + 0.38 * near})`); e.addColorStop(0.45, `rgba(30, 36, 104, ${0.35 + 0.35 * near})`); e.addColorStop(1, 'rgba(70, 80, 170, 0)');
      c.fillStyle = e; c.fillRect(-10, -10, w + 10, this.H + 20);
      for (let i = 0; i < 18; i++) {
        const x = hash(i * 7.3) * w * 0.6, y = hash(i * 2.9) * this.H, tw = 0.3 + 0.7 * Math.abs(Math.sin(this.time * 2.4 + i));
        c.fillStyle = `rgba(220, 230, 255, ${tw * near * 0.8})`; c.fillRect(x, y, 2, 2);
      }
    }
    if (X < -this.k * 14) return;
    const soft = this.k * 12;
    const gr = c.createLinearGradient(X - soft, 0, X + soft * 0.35, 0);
    gr.addColorStop(0, 'rgba(14, 18, 52, 0.94)'); gr.addColorStop(0.72, 'rgba(34, 40, 110, 0.7)'); gr.addColorStop(1, 'rgba(70, 80, 170, 0)');
    c.fillStyle = gr; c.fillRect(-10, -10, Math.max(0, X + soft * 0.35 + 10), this.H + 20);
    if (X - soft > 0) { c.fillStyle = 'rgba(14, 18, 52, 0.94)'; c.fillRect(-10, -10, X - soft + 10, this.H + 20); }
    for (let i = 0; i < 40; i++) {
      const x = X - soft * 0.5 - hash(i * 3.1) * Math.max(soft, X + 40), y = hash(i * 5.7) * this.H;
      if (x < -5) continue;
      const tw = 0.4 + 0.6 * Math.abs(Math.sin(this.time * 2 + i));
      c.fillStyle = `rgba(220, 230, 255, ${tw * 0.8})`; c.fillRect(x, y, 2, 2);
    }
    // the glowing edge
    c.strokeStyle = `rgba(150, 170, 255, ${0.25 + 0.1 * Math.sin(this.time * 3)})`; c.lineWidth = 3;
    c.beginPath(); for (let y = -10; y <= this.H + 10; y += 20) { const x = X + Math.sin(y * 0.03 + this.time * 2) * 6; if (y === -10) c.moveTo(x, y); else c.lineTo(x, y); } c.stroke();
  }
  private popsDraw(dt: number) {
    const c = this.c;
    this.pops = this.pops.filter((p) => (p.age += dt) < 1.4);
    for (const p of this.pops) {
      const a = p.age < 0.15 ? p.age / 0.15 : clamp((1.4 - p.age) / 0.5, 0, 1);
      const s = p.age < 0.15 ? 0.6 + (p.age / 0.15) * 0.5 : 1.1 - Math.min(0.1, (p.age - 0.15) * 0.3);
      const size = clamp(this.H * (p.big ? 0.05 : 0.04), 16, p.big ? 40 : 32) * s;
      const X = this.sx(p.x), Y = this.sy(p.y + p.age * 1.4);
      c.save(); c.globalAlpha = a;
      c.font = `900 ${size}px ui-rounded, "Trebuchet MS", system-ui, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.lineWidth = Math.max(3, size * 0.16); c.strokeStyle = 'rgba(20, 30, 70, 0.75)'; c.lineJoin = 'round';
      c.strokeText(p.text, X, Y); c.fillStyle = p.color; c.fillText(p.text, X, Y);
      c.restore();
    }
  }
  private fireworks(dt: number) {
    this.fireworkT -= dt;
    if (this.fireworkT <= 0) {
      this.fireworkT = 0.3 + hash(this.time) * 0.4;
      const x = this.cx + (hash(this.time * 3) - 0.3) * (this.W / this.k) * 0.6, y = this.cy + (this.H / this.k) * (0.2 + hash(this.time * 7) * 0.25);
      const cols = ['#ffd86a', '#ff8ab0', '#8ae0ff', '#b4ff9a', '#ffffff'], col = cols[Math.floor(hash(this.time * 11) * cols.length)];
      for (let i = 0; i < 56; i++) { const a = (i / 56) * TAU, v = 5 + hash(i + this.time) * 5; this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1.6, max: 1.6, size: 0.34, color: col, kind: 'firework', g: 3 }); }
      for (let i = 0; i < 18; i++) { const a = hash(i * 1.7 + this.time) * TAU, v = 2 + hash(i * 2.3) * 2.5; this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1.1, max: 1.1, size: 0.24, color: '#ffffff', kind: 'spark', g: 2 }); }
      this.flashColor = col; this.flash = Math.max(this.flash, 0.12);
    }
  }
  /** Over everything: night deepening toward dusk, a flash for big moments, a cold edge when the dusk is close. */
  private grade(g: SnowGame, dt: number, t: number, night: boolean) {
    const c = this.c;
    if (!night && t > 0.7) { c.fillStyle = `rgba(30, 20, 80, ${clamp((t - 0.7) * 0.6, 0, 0.18)})`; c.fillRect(0, 0, this.W, this.H); }
    if (this.flash > 0) { c.fillStyle = this.flashColor; c.globalAlpha = clamp(this.flash, 0, 0.5); c.fillRect(0, 0, this.W, this.H); c.globalAlpha = 1; this.flash = Math.max(0, this.flash - dt * 1.6); }
    // speed lines
    const sp = g.speed;
    if (sp > 28 && g.phase === 'ride') {
      const a = clamp((sp - 28) / 18, 0, 0.6);
      c.strokeStyle = `rgba(255,255,255,${a * 0.6})`; c.lineWidth = 2; c.lineCap = 'round';
      for (let i = 0; i < 14; i++) { const y = hash(i * 3.3) * this.H, x = ((hash(i) * this.W - this.time * (900 + hash(i * 2) * 600)) % (this.W + 200) + this.W + 200) % (this.W + 200) - 100, len = 60 + hash(i * 7) * 120; c.beginPath(); c.moveTo(x, y); c.lineTo(x + len, y); c.stroke(); }
    }
    // the cold creeping in at the edges when the night is close
    const near = g.phase === 'ride' ? clamp(1 - g.daylight / 4, 0, 1) : g.phase === 'caught' ? 1 : 0;
    if (near > 0) {
      const v = c.createRadialGradient(this.W / 2, this.H / 2, Math.min(this.W, this.H) * 0.3, this.W / 2, this.H / 2, Math.max(this.W, this.H) * 0.75);
      v.addColorStop(0, 'rgba(20, 24, 70, 0)'); v.addColorStop(1, `rgba(20, 24, 70, ${near * 0.55})`);
      c.fillStyle = v; c.fillRect(0, 0, this.W, this.H);
    }
  }
  private drawIdle() {
    this.sky('meadow', 0.5, false);
    const c = this.c;
    c.fillStyle = '#ffffff';
    for (let i = 0; i < 40; i++) { const x = (hash(i) * this.W + this.time * 10 * (1 + hash(i + 3))) % this.W, y = (hash(i + 4) * this.H + this.time * (20 + hash(i + 9) * 20)) % this.H; c.globalAlpha = 0.6; c.beginPath(); c.arc(x, y, 1.5 + hash(i * 2) * 2.5, 0, TAU); c.fill(); }
    c.globalAlpha = 1;
  }
}

// ---------------------------------------------------------------- stand-ins for the paintings
function snowyScene(c: CanvasRenderingContext2D, W: number, H: number, top: string, hor: string) {
  const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, top); g.addColorStop(0.7, hor); c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.fillStyle = '#8ea4cc'; c.beginPath(); c.moveTo(0, H * 0.7); for (let i = 0; i <= 10; i++) c.lineTo((W * i) / 10, H * (0.42 + hash(i) * 0.2)); c.lineTo(W, H); c.lineTo(0, H); c.fill();
  c.fillStyle = '#f4f8ff'; c.beginPath(); c.moveTo(0, H * 0.78); for (let i = 0; i <= 20; i++) c.lineTo((W * i) / 20, H * (0.76 + Math.sin(i * 0.9) * 0.03)); c.lineTo(W, H); c.lineTo(0, H); c.fill();
}
/** The title painting's stand-in: the pair on their sled over a sunset valley. */
export function paintTitle(cv: HTMLCanvasElement, t = 0.4) {
  const c = ctx2(cv), W = cv.width, H = cv.height;
  snowyScene(c, W, H, '#5a6ab0', '#ffb890');
  c.fillStyle = '#ffd28a'; c.beginPath(); c.arc(W * 0.78, H * 0.42, H * 0.07, 0, TAU); c.fill();
  c.save(); c.translate(W * 0.42, H * 0.72); c.rotate(-0.12);
  c.fillStyle = '#c0803e'; c.fillRect(-W * 0.12, -H * 0.02, W * 0.24, H * 0.025);
  drawChinchilla(c, 'enzo', -W * 0.05, -H * 0.02, { face: 1, h: H * 0.16, time: t, air: true });
  drawChinchilla(c, 'dora', W * 0.05, -H * 0.02, { face: 1, h: H * 0.13, time: t, air: true });
  c.restore();
}
/** The ending's stand-in: the grand lodge at night with fireworks. */
export function paintEnding(cv: HTMLCanvasElement, t = 0.4) {
  const c = ctx2(cv), W = cv.width, H = cv.height;
  snowyScene(c, W, H, '#0a1030', '#2a3466');
  for (let i = 0; i < 6; i++) { const x = W * (0.15 + hash(i) * 0.7), y = H * (0.12 + hash(i + 3) * 0.25), col = ['#ffd86a', '#ff8ab0', '#8ae0ff'][i % 3]; c.strokeStyle = col; c.lineWidth = 3; for (let a = 0; a < 12; a++) { const u = (a / 12) * TAU; c.beginPath(); c.moveTo(x + Math.cos(u) * H * 0.02, y + Math.sin(u) * H * 0.02); c.lineTo(x + Math.cos(u) * H * 0.07, y + Math.sin(u) * H * 0.07); c.stroke(); } }
  c.fillStyle = '#7a4e2e'; c.fillRect(W * 0.32, H * 0.5, W * 0.36, H * 0.28);
  c.fillStyle = '#f4f8ff'; c.beginPath(); c.moveTo(W * 0.28, H * 0.52); c.lineTo(W * 0.5, H * 0.34); c.lineTo(W * 0.72, H * 0.52); c.fill();
  c.fillStyle = '#ffc464'; c.fillRect(W * 0.4, H * 0.58, W * 0.2, H * 0.12);
  drawChinchilla(c, 'dora', W * 0.46, H * 0.7, { face: 1, h: H * 0.08, time: t });
  drawChinchilla(c, 'enzo', W * 0.54, H * 0.7, { face: -1, h: H * 0.1, time: t });
}
/** The lodge's stand-in: a warm room with a fire. */
export function paintLodge(cv: HTMLCanvasElement) {
  const c = ctx2(cv), W = cv.width, H = cv.height;
  const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#6a4228'); g.addColorStop(1, '#3a2214'); c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.fillStyle = '#5a3a24'; for (let y = 0; y < H; y += H / 12) c.fillRect(0, y, W, 3);
  c.fillStyle = '#8a8a90'; c.fillRect(W * 0.06, H * 0.3, W * 0.26, H * 0.6);
  c.fillStyle = '#2a1a10'; c.fillRect(W * 0.1, H * 0.55, W * 0.18, H * 0.3);
  const f = c.createRadialGradient(W * 0.19, H * 0.75, 4, W * 0.19, H * 0.75, H * 0.3); f.addColorStop(0, 'rgba(255, 180, 80, 0.95)'); f.addColorStop(1, 'rgba(255, 140, 60, 0)'); c.fillStyle = f; c.fillRect(0, H * 0.3, W * 0.5, H * 0.7);
  c.fillStyle = '#9ab8e0'; c.fillRect(W * 0.72, H * 0.2, W * 0.2, H * 0.3);
  c.fillStyle = '#b0503a'; c.beginPath(); c.ellipse(W * 0.55, H * 0.92, W * 0.3, H * 0.06, 0, 0, TAU); c.fill();
}
/** A valley's stand-in for the day list: its sky and far peaks. */
export function paintValley(cv: HTMLCanvasElement, v: ValleyId) {
  const c = ctx2(cv), W = cv.width, H = cv.height, L = LOOK[v];
  const g = c.createLinearGradient(0, 0, 0, H);
  if (L.night) { g.addColorStop(0, NIGHT[0]); g.addColorStop(1, NIGHT[1]); } else { g.addColorStop(0, '#6a9ae0'); g.addColorStop(1, '#ffe2c8'); }
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.fillStyle = L.peaks; c.beginPath(); c.moveTo(0, H); for (let i = 0; i <= 8; i++) c.lineTo((W * i) / 8, H * (0.35 + hash(i + VALLEY_IDS.indexOf(v) * 9) * 0.3)); c.lineTo(W, H); c.fill();
  c.fillStyle = '#f4f8ff'; c.beginPath(); c.moveTo(0, H * 0.8); for (let i = 0; i <= 8; i++) c.lineTo((W * i) / 8, H * (0.78 + Math.sin(i) * 0.04)); c.lineTo(W, H); c.lineTo(0, H); c.fill();
  void VALLEYS;
}
