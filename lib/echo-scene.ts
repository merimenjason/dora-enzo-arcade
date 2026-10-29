// Echo Burrow's drawing, in Canvas 2D: one burrow room at a time, fitted whole to the screen over its chapter's
// painted back wall, with rock, ledges, crumbling slabs, glow-moss, fans and their wind, plates, sliding doors, lifts,
// seesaws, crates, the golden seed and the burrow door. Dora and Enzo are painted poses once they load (the shared
// drawn chinchillas until then); the echo is the same pose tinted teal with a trail of afterimages. The rewind plays
// the loop backwards in grey with a sweep of light. Drawing only: the rules are in echo-game.ts.
import { drawChinchilla } from './chinchilla-art';
import {
  EchoGame, T, COLS, ROWS, WORLD_W, WORLD_H, KIT, FRAME, POSES, SAW, ROCK, LEDGE, CRUMBLE, MOSS, FAN_TILE, KIT_ROCK, ROOMS,
  type Ev, type Who, type Pose, type ChapterId,
} from './echo-game';

const TAU = Math.PI * 2;
const mk = (w: number, h: number) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; };
const ctx2 = (c: HTMLCanvasElement) => c.getContext('2d')!;
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** A fixed hash in place of randomness, so the rock looks the same every time. */
const hash = (n: number) => { const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };

/** Each chapter's palette: rock and its light and shade, ledges, the back wall's fallback, and a tint. */
export const LOOK: Record<ChapterId, { rock: string; lit: string; dark: string; ledge: string; ledgeTop: string; wall: [string, string]; accent: string; tint: string }> = {
  cellar: { rock: '#5e4432', lit: '#8a6646', dark: '#3a281c', ledge: '#8a6038', ledgeTop: '#c8945a', wall: ['#4a3426', '#22160e'], accent: '#e8b86a', tint: 'rgba(255, 190, 120, 0.06)' },
  hollow: { rock: '#4c3c56', lit: '#76608a', dark: '#2a2034', ledge: '#b8483e', ledgeTop: '#f07a62', wall: ['#3c2e4a', '#1a1222'], accent: '#ffd0a8', tint: 'rgba(200, 120, 255, 0.06)' },
  brook: { rock: '#3e4c5a', lit: '#64788a', dark: '#222c36', ledge: '#6a7a86', ledgeTop: '#a4b6c2', wall: ['#2c3c4c', '#121c26'], accent: '#8ad4ff', tint: 'rgba(100, 180, 255, 0.07)' },
  gallery: { rock: '#3a345a', lit: '#625a92', dark: '#1e1a34', ledge: '#4a9ab0', ledgeTop: '#9ae8f4', wall: ['#2a2448', '#100c22'], accent: '#d4b0ff', tint: 'rgba(160, 120, 255, 0.07)' },
  home: { rock: '#6a4a32', lit: '#9a7048', dark: '#3e2a1a', ledge: '#9a6a3c', ledgeTop: '#e0a868', wall: ['#5a3e28', '#2a1a10'], accent: '#ffd27a', tint: 'rgba(255, 200, 120, 0.08)' },
};
/** Each plate group's colour (groups 1 to 4) and the mark on its doors. */
const GROUP = ['#ffffff', '#f2b33a', '#46c2b0', '#ef6a8a', '#9a7cf0'];
const MARK = ['', '●', '▲', '■', '◆'];
/** Painted poses, with the one to borrow when a pose has no painting (or hasn't loaded yet). */
const PAINTED: Record<Who, Pose[]> = { dora: ['idle', 'run', 'jump', 'squeeze', 'cheer'], enzo: ['idle', 'run', 'jump', 'push', 'cheer'] };
const STAND_IN: Record<Pose, Pose[]> = { idle: [], run: ['idle'], jump: ['run', 'idle'], fall: ['jump', 'run', 'idle'], push: ['run', 'idle'], squeeze: ['run', 'idle'], cheer: ['idle'] };
/** How tall each climber's painting is drawn, in world units (the boxes are 13 and 22). */
const SPRITE_H: Record<Who, number> = { dora: 22, enzo: 30 };
/** The sprites are 768 × 512 with the climber standing on a line 16 from the bottom, the idle pose 360 tall. */
const SPRITE_FOOT = 16 / 512, SPRITE_FIG = 360 / 512, SPRITE_BACK = 0.07;
const TEAL = 'rgba(90, 236, 222, 1)';

type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string; kind: 'dust' | 'chip' | 'spark' | 'leaf' | 'drop' };
type Juice = { squash: number; tilt: number };

export class EchoScene {
  private canvas: HTMLCanvasElement; private c: CanvasRenderingContext2D;
  private W = 1; private H = 1; private dpr = 1;
  /** The room on screen: world units to CSS pixels, and where the room's corner sits. */
  private s = 1; private ox = 0; private oy = 0;
  /** Screen pixels kept clear for touch buttons (or anything else laid over the canvas). */
  inset = { top: 0, right: 0, bottom: 0, left: 0 };
  private time = 0; private shake = 0; private shakeOn = true;
  private art = new Map<string, HTMLImageElement>();
  private tints = new Map<string, HTMLCanvasElement>();
  private parts: Particle[] = [];
  private juice: Record<Who, Juice> = { dora: { squash: 0, tilt: 0 }, enzo: { squash: 0, tilt: 0 } };
  private ghosts: { x: number; y: number; face: 1 | -1; pose: Pose; age: number }[] = [];
  private ghostClock = 0;
  private glow = new Float32Array(COLS * ROWS);
  private cache: { key: string; cv: HTMLCanvasElement } | null = null;
  private flash = 0; private sweep = 0; private lastEchoGround = true; private pushDust = 0;
  private fallback = mk(64, 64);

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas; this.c = ctx2(canvas);
    for (const w of ['dora', 'enzo'] as Who[]) for (const p of PAINTED[w]) this.load(`${w}-${p}`);
    for (const ch of ['cellar', 'hollow', 'brook', 'gallery', 'home']) this.load(`bg-${ch}`);
    this.load('stone');
    this.resize();
  }
  private load(name: string) { if (this.art.has(name)) return; const img = new Image(); img.decoding = 'async'; img.src = `/art/echo/${name}.webp`; this.art.set(name, img); }
  /** A painting, once it has fully loaded; null until then (or if it never does). */
  img(name: string) { const i = this.art.get(name); return i && i.complete && i.naturalWidth > 0 ? i : null; }
  /** The painting for a pose, or the nearest one that has loaded. */
  private poseImg(who: Who, pose: Pose) {
    for (const p of [pose, ...STAND_IN[pose]]) { if (!PAINTED[who].includes(p)) continue; const i = this.img(`${who}-${p}`); if (i) return { i, p }; }
    return null;
  }
  setShake(on: boolean) { this.shakeOn = on; }

  resize() {
    const r = this.canvas.getBoundingClientRect(); this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.W = Math.max(1, r.width); this.H = Math.max(1, r.height);
    const w = Math.round(this.W * this.dpr), h = Math.round(this.H * this.dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
  }
  /** Fits the whole room into the space left over by the insets, as large as it goes. */
  private fit() {
    const n = this.inset, aw = Math.max(40, this.W - n.left - n.right), ah = Math.max(40, this.H - n.top - n.bottom);
    this.s = Math.min(aw / WORLD_W, ah / WORLD_H);
    this.ox = n.left + (aw - WORLD_W * this.s) / 2; this.oy = n.top + (ah - WORLD_H * this.s) / 2;
  }
  /** Where the room is on screen, in CSS pixels (for the page and the tests). */
  roomRect() { this.fit(); return { x: this.ox, y: this.oy, w: WORLD_W * this.s, h: WORLD_H * this.s, scale: this.s }; }

  /** Reacts to what the game did: squash and stretch, dust, chips of rock, shakes. */
  feed(events: Ev[], g: EchoGame) {
    const p = g.p;
    for (const e of events) {
      switch (e.k) {
        case 'jump': this.juice[e.who].squash = -0.28; this.puff(p.x, p.y, e.boost ? 10 : 5, e.boost ? 1.2 : 0.7); if (e.boost) this.sparkle(p.x, p.y, '#9af8ee', 10); break;
        case 'land': { const k = clamp(e.v / 500, 0.08, 0.4); this.juice[e.who].squash = k; this.puff(p.x, p.y, Math.round(4 + k * 14), 0.6 + k); if (e.v > 380) this.kick(3); break; }
        case 'bonk': this.kick(2); this.juice[e.who].squash = 0.2; break;
        case 'push': if ((this.pushDust += 1) % 9 === 0) { const c = g.crates[e.i]; this.puff(c.x + (p.x < c.x ? -8 : 8), c.y, 2, 0.4); } break;
        case 'crate': { const c = g.crates[e.i]; this.puff(c.x, c.y, 8, 1); this.kick(2); break; }
        case 'flip': { const s = g.room.saws[e.i]; this.puff(s.c * T + SAW.w / 2, (s.r + 1) * T, 8, 0.8); this.kick(3); break; }
        case 'launch': if (e.who !== 'crate') { this.juice[e.who].squash = -0.4; this.sparkle(p.x, p.y, '#fff2c0', 12); } break;
        case 'shake': for (let i = 0; i < 3; i++) this.chip(e.c * T + hash(i + e.c) * T, (e.r + 1) * T, 0.5); break;
        case 'crumble': for (let i = 0; i < 12; i++) this.chip(e.c * T + hash(i * 3 + e.c) * T, e.r * T + hash(i * 7 + e.r) * T, 1); this.kick(2); break;
        case 'seed': { const s = g.room.seed; if (s) { this.sparkle(s.c * T + 8, s.r * T + 8, '#ffe27a', 22); this.flash = 0.25; } break; }
        case 'clear': this.juice.dora.squash = this.juice.enzo.squash = -0.3; this.sparkle(p.x, p.y - 10, '#fff6c8', 30); this.kick(2); break;
        case 'rewind': this.sweep = 1; this.ghosts = []; break;
        case 'record': case 'live': this.ghosts = []; this.flash = 0.35; this.glow.fill(0); break;
        default: break;
      }
    }
  }
  private kick(n: number) { if (this.shakeOn) this.shake = Math.min(8, Math.max(this.shake, n)); }
  private puff(x: number, y: number, n: number, k: number) {
    for (let i = 0; i < n; i++) {
      const h = hash(i * 1.7 + this.time * 11), a = Math.PI + (i / Math.max(1, n - 1)) * Math.PI;
      this.parts.push({ x, y: y - 1, vx: Math.cos(a) * (14 + h * 30) * k, vy: Math.sin(a) * (6 + h * 14) * k, life: 0.5 + h * 0.3, max: 0.8, size: 1.6 + h * 2.4, color: '#e8dcc6', kind: 'dust' });
    }
  }
  private chip(x: number, y: number, k: number) { const h = hash(x * 0.37 + y + this.time); this.parts.push({ x, y, vx: (h - 0.5) * 50 * k, vy: -20 * k - h * 30, life: 0.9, max: 0.9, size: 1 + h * 1.6, color: '#b8a088', kind: 'chip' }); }
  private sparkle(x: number, y: number, color: string, n: number) {
    for (let i = 0; i < n; i++) { const a = (i / n) * TAU, v = 30 + hash(i + this.time) * 50; this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.7, max: 0.7, size: 1.2 + hash(i * 3) * 1.2, color, kind: 'spark' }); }
  }

  // ---------------------------------------------------------------- the frame
  draw(g: EchoGame | null, o: { dt: number; alpha: number; paused: boolean }) {
    const c = this.c, dt = Math.min(0.05, o.dt);
    if (!o.paused) this.time += dt;
    this.fit();
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (!g) { this.drawIdle(); return; }
    const look = LOOK[g.room.chapter];
    // the painted back wall fills the screen, dimmed away from the room
    this.backWall(g.room.chapter);
    c.save();
    if (this.shake > 0.05) { c.translate((hash(this.time * 60) - 0.5) * this.shake, (hash(this.time * 60 + 9) - 0.5) * this.shake); this.shake *= Math.pow(0.0015, dt); }
    c.translate(this.ox, this.oy); c.scale(this.s, this.s);
    // the room's own wall, a touch brighter than the dim surround
    c.fillStyle = 'rgba(255, 240, 220, 0.04)'; c.fillRect(0, 0, WORLD_W, WORLD_H);
    const rew = g.phase === 'rewind', u = rew ? 1 - g.rewindT / Math.max(1, g.rewindLen) : 0;
    this.statics(g);
    this.mossAndCrumble(g, dt, rew);
    this.winds(g);
    this.exitDoor(g);
    this.stone(g);
    this.plates(g);
    this.doors(g);
    this.lifts(g, o.alpha);
    this.saws(g);
    this.crates(g, o.alpha);
    this.seed(g);
    // the climbers
    const a = o.alpha;
    if (rew) this.rewindBodies(g, u);
    else {
      if (g.echo.on) this.echoBody(g, a, dt, o.paused);
      this.liveBody(g, a, dt);
    }
    if (!o.paused) this.particles(dt); else this.particles(0);
    c.restore();
    // grading: the record loop is warm and framed, the live loop cool, the rewind grey with a sweep
    this.grade(g, look.tint, u, dt);
  }

  /** The chapter's painting behind everything (or a gradient until it loads), darker outside the room. */
  private backWall(ch: ChapterId) {
    const c = this.c, L = LOOK[ch], im = this.img(`bg-${ch}`);
    if (im) {
      const k = Math.max(this.W / im.naturalWidth, this.H / im.naturalHeight);
      c.drawImage(im, (this.W - im.naturalWidth * k) / 2, (this.H - im.naturalHeight * k) / 2, im.naturalWidth * k, im.naturalHeight * k);
    } else {
      const g0 = c.createLinearGradient(0, 0, 0, this.H); g0.addColorStop(0, L.wall[0]); g0.addColorStop(1, L.wall[1]);
      c.fillStyle = g0; c.fillRect(0, 0, this.W, this.H);
      c.fillStyle = 'rgba(255,255,255,0.04)';
      for (let i = 0; i < 40; i++) { c.beginPath(); c.arc(hash(i) * this.W, hash(i + 50) * this.H, 2 + hash(i + 9) * 30, 0, TAU); c.fill(); }
    }
    // set the painting back so ledges read clearly, and darken around the room
    c.fillStyle = 'rgba(12, 8, 16, 0.38)'; c.fillRect(0, 0, this.W, this.H);
    const rx = this.ox, ry = this.oy, rw = WORLD_W * this.s, rh = WORLD_H * this.s;
    c.fillStyle = 'rgba(8, 5, 10, 0.5)';
    c.fillRect(0, 0, this.W, ry); c.fillRect(0, ry + rh, this.W, this.H - ry - rh); c.fillRect(0, ry, rx, rh); c.fillRect(rx + rw, ry, this.W - rx - rw, rh);
  }

  /** Rock, kit rock and ledges never change in a room, so they are drawn once into a cache. */
  private statics(g: EchoGame) {
    const R = g.room, px = this.s * this.dpr, key = `${R.index}:${px.toFixed(3)}`;
    if (!this.cache || this.cache.key !== key) {
      const cv = mk(WORLD_W * px, WORLD_H * px), c = ctx2(cv), L = LOOK[R.chapter];
      c.scale(px, px);
      const tile = (cc: number, rr: number) => (cc < 0 || rr < 0 || cc >= COLS || rr >= ROWS ? ROCK : R.tiles[rr * COLS + cc]);
      const solid = (cc: number, rr: number) => { const k = tile(cc, rr); return k === ROCK || k === KIT_ROCK; };
      for (let r = 0; r < ROWS; r++) for (let col = 0; col < COLS; col++) {
        const k = tile(col, r), x = col * T, y = r * T, h = hash(col * 31 + r * 7);
        if (k === ROCK || k === KIT_ROCK) {
          c.fillStyle = L.rock; c.fillRect(x, y, T + 0.5, T + 0.5);
          // light on top edges, shade under bottom edges, and pebbles
          if (!solid(col, r - 1)) { c.fillStyle = L.lit; c.fillRect(x, y, T, 3); c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(x, y, T, 1); }
          if (!solid(col, r + 1)) { c.fillStyle = L.dark; c.fillRect(x, y + T - 3, T, 3); }
          if (!solid(col - 1, r)) { c.fillStyle = 'rgba(0,0,0,0.18)'; c.fillRect(x, y, 2, T); }
          if (!solid(col + 1, r)) { c.fillStyle = 'rgba(0,0,0,0.18)'; c.fillRect(x + T - 2, y, 2, T); }
          c.fillStyle = 'rgba(0,0,0,0.16)';
          for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(x + 2 + hash(h * 9 + i) * 12, y + 4 + hash(h * 5 + i) * 10, 0.8 + hash(h + i) * 1.6, 0, TAU); c.fill(); }
          if (k === KIT_ROCK) {
            // a kit tunnel's frame: smoothed, worn by little paws
            c.fillStyle = 'rgba(255, 236, 200, 0.12)'; c.fillRect(x, y, T, T);
            if (!solid(col, r + 1)) { c.fillStyle = L.accent; c.globalAlpha = 0.5; c.fillRect(x + 1, y + T - 2, T - 2, 1); c.globalAlpha = 1; }
          }
          if (R.chapter === 'hollow' && !solid(col, r - 1) && h > 0.8 && r > 1) this.mushroom(c, x + 4 + h * 8, y, h);
          if (R.chapter === 'gallery' && !solid(col, r + 1) && h > 0.75) this.crystal(c, x + 3 + h * 10, y + T, h, L.ledgeTop, true);
          if (R.chapter === 'gallery' && !solid(col, r - 1) && h < 0.12 && r > 1) this.crystal(c, x + 3 + h * 60, y, h, L.accent, false);
          if ((R.chapter === 'cellar' || R.chapter === 'home') && !solid(col, r + 1) && h > 0.82 && r < ROWS - 1) this.root(c, x + h * 12, y + T, h);
        } else if (k === LEDGE) {
          c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(x, y + 5, T, 2);
          c.fillStyle = L.ledge; c.fillRect(x, y, T + 0.5, 5);
          c.fillStyle = L.ledgeTop; c.fillRect(x, y, T + 0.5, 1.6);
          if (R.chapter === 'hollow') { c.fillStyle = 'rgba(255,240,220,0.7)'; c.beginPath(); c.arc(x + 4 + h * 8, y + 2.5, 0.9, 0, TAU); c.fill(); }
          else { c.fillStyle = 'rgba(0,0,0,0.2)'; c.fillRect(x + T - 1, y + 1, 1, 4); }
        } else if (k === FAN_TILE) {
          c.fillStyle = L.dark; c.fillRect(x + 1, y + 4, T - 2, T - 4);
          c.fillStyle = '#8a929a'; c.fillRect(x + 1, y + 3, T - 2, 2);
          c.fillStyle = '#2a2e34'; for (let i = 0; i < 4; i++) c.fillRect(x + 3 + i * 3, y + 6, 1.5, T - 8);
        }
      }
      // a gentle pool along the brook's floor
      if (R.chapter === 'brook') {
        for (let col = 1; col < COLS - 1; col++) if (tile(col, ROWS - 2) === 0 && solid(col, ROWS - 1)) { c.fillStyle = 'rgba(90, 170, 230, 0.35)'; c.fillRect(col * T, (ROWS - 1) * T - 3, T + 0.5, 3); }
      }
      this.cache = { key, cv };
    }
    this.c.drawImage(this.cache.cv, 0, 0, WORLD_W, WORLD_H);
  }
  private mushroom(c: CanvasRenderingContext2D, x: number, y: number, h: number) {
    c.fillStyle = '#e8dcc8'; c.fillRect(x - 0.6, y - 4, 1.2, 4);
    c.fillStyle = h > 0.9 ? '#e05a4a' : '#c88ae8'; c.beginPath(); c.ellipse(x, y - 4, 3, 2, 0, Math.PI, TAU); c.fill();
  }
  private crystal(c: CanvasRenderingContext2D, x: number, y: number, h: number, col: string, down: boolean) {
    const len = 4 + h * 5, d = down ? 1 : -1;
    c.fillStyle = col; c.globalAlpha = 0.85; c.beginPath(); c.moveTo(x - 2, y); c.lineTo(x, y + d * len); c.lineTo(x + 2, y); c.fill(); c.globalAlpha = 1;
  }
  private root(c: CanvasRenderingContext2D, x: number, y: number, h: number) {
    c.strokeStyle = '#3a2614'; c.lineWidth = 1; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 3, y + 4 + h * 3, x + 1, y + 7 + h * 4); c.stroke();
  }

  /** Crumbling slabs (they shiver, then fall) and glow-moss (dark, or lit by the echo). */
  private mossAndCrumble(g: EchoGame, dt: number, rew: boolean) {
    const c = this.c, R = g.room, L = LOOK[R.chapter];
    for (let r = 0; r < ROWS; r++) for (let col = 0; col < COLS; col++) {
      const i = r * COLS + col, k = R.tiles[i], x = col * T, y = r * T;
      if (k === CRUMBLE) {
        const st = rew ? 0 : g.crumble[i];
        if (st < 0) { c.strokeStyle = 'rgba(255,255,255,0.12)'; c.setLineDash([2, 2]); c.strokeRect(x + 1, y + 1, T - 2, 4); c.setLineDash([]); continue; }
        const j = st > 0 ? Math.sin(this.time * 70 + col) * (0.4 + st / 30) : 0;
        c.save(); c.translate(j, st > 20 ? (st - 20) * 0.15 : 0);
        c.fillStyle = L.lit; c.fillRect(x, y, T, T * 0.7);
        c.fillStyle = L.ledgeTop; c.globalAlpha = 0.5; c.fillRect(x, y, T, 1.6); c.globalAlpha = 1;
        c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(x, y + T * 0.7 - 2, T, 2);
        c.strokeStyle = 'rgba(30, 18, 10, 0.75)'; c.lineWidth = 0.8;
        c.beginPath(); c.moveTo(x + 3, y + 1); c.lineTo(x + 7, y + 6); c.lineTo(x + 5, y + 10); c.moveTo(x + 7, y + 6); c.lineTo(x + 12, y + 4); c.stroke();
        c.restore();
      } else if (k === MOSS) {
        const lit = !rew && g.mossLit(col, r) ? 1 : 0;
        this.glow[i] = lerp(this.glow[i], lit, 1 - Math.pow(0.0005, dt));
        const v = this.glow[i];
        // unlit: a faint dotted outline of sleeping moss; lit: a bright, solid, softly glowing pad
        c.globalAlpha = 0.35 + 0.65 * v;
        c.fillStyle = v > 0.5 ? '#3ad8a0' : '#2a5a48'; c.fillRect(x + 0.5, y + 0.5, T - 1, T * 0.55);
        c.fillStyle = '#b8ffe0'; c.globalAlpha = 0.15 + 0.7 * v; c.fillRect(x + 0.5, y + 0.5, T - 1, 1.5);
        for (let n = 0; n < 4; n++) { const h = hash(i * 7 + n); c.beginPath(); c.arc(x + 2 + h * 12, y + 3 + hash(i + n * 3) * 4, 0.9 + v * 0.6, 0, TAU); c.fill(); }
        c.globalAlpha = 1;
        if (v < 0.5) { c.strokeStyle = 'rgba(140, 255, 210, 0.35)'; c.setLineDash([1.5, 2]); c.lineWidth = 0.7; c.strokeRect(x + 0.5, y + 0.5, T - 1, T * 0.55); c.setLineDash([]); }
        if (v > 0.05) {
          const gr = c.createRadialGradient(x + 8, y + 4, 1, x + 8, y + 4, 16);
          gr.addColorStop(0, `rgba(120, 255, 200, ${0.28 * v})`); gr.addColorStop(1, 'rgba(120, 255, 200, 0)');
          c.fillStyle = gr; c.fillRect(x - 8, y - 12, 32, 30);
        }
      }
    }
  }

  /** Wind over each fan while it runs: rising streaks and motes. */
  private winds(g: EchoGame) {
    const c = this.c;
    for (const w of g.room.winds) {
      const x = w.c * T, on = g.fanOn;
      // the blades
      c.save(); c.translate(x + T / 2, w.bottom + 3);
      c.fillStyle = '#c8d0d8'; c.globalAlpha = on ? 0.9 : 0.5;
      const spin = on ? this.time * 18 : 0;
      for (let b = 0; b < 3; b++) { const a = spin + (b * TAU) / 3; c.fillRect(Math.cos(a) * 3 - 3, -0.8, 6 * Math.abs(Math.cos(a)) + 0.6, 1.6); }
      c.restore();
      if (!on) continue;
      const h = w.bottom - w.top;
      const gr = c.createLinearGradient(0, w.bottom, 0, w.top); gr.addColorStop(0, 'rgba(220, 240, 255, 0.16)'); gr.addColorStop(1, 'rgba(220, 240, 255, 0)');
      c.fillStyle = gr; c.fillRect(x + 2, w.top, T - 4, h);
      c.strokeStyle = 'rgba(235, 248, 255, 0.55)'; c.lineWidth = 0.8;
      for (let i = 0; i < 5; i++) {
        const k = (this.time * 0.9 + hash(i + w.c)) % 1, y = w.bottom - k * h, sx = x + 3 + hash(i * 3 + w.c) * 10;
        c.globalAlpha = Math.sin(k * Math.PI) * 0.8;
        c.beginPath(); c.moveTo(sx, y); c.quadraticCurveTo(sx + Math.sin(this.time * 6 + i) * 2, y - 5, sx, y - 10); c.stroke();
      }
      c.globalAlpha = 1;
    }
  }

  /** The burrow door: a round wooden door in an arch, glowing warm. */
  private exitDoor(g: EchoGame) {
    const c = this.c, e = g.room.exit, x = e.c * T + T / 2, base = (e.r + 1) * T, open = g.phase === 'clear' ? Math.min(1, g.clearT / 30) : 0;
    const gl = c.createRadialGradient(x, base - 12, 2, x, base - 12, 26);
    gl.addColorStop(0, `rgba(255, 210, 120, ${0.35 + 0.1 * Math.sin(this.time * 2)})`); gl.addColorStop(1, 'rgba(255, 210, 120, 0)');
    c.fillStyle = gl; c.fillRect(x - 28, base - 40, 56, 44);
    c.fillStyle = '#2a1a10'; c.beginPath(); c.moveTo(x - 9, base); c.lineTo(x - 9, base - 18); c.arc(x, base - 18, 9, Math.PI, 0); c.lineTo(x + 9, base); c.fill();
    c.fillStyle = '#ffd890'; c.beginPath(); c.moveTo(x - 7, base); c.lineTo(x - 7, base - 18); c.arc(x, base - 18, 7, Math.PI, 0); c.lineTo(x + 7, base); c.fill();
    // the door swings open on a clear
    c.save(); c.translate(x - 7, base);
    c.scale(1 - open * 0.85, 1);
    c.fillStyle = '#9a5a2c'; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -18); c.arc(7, -18, 7, Math.PI, 0); c.lineTo(14, 0); c.fill();
    c.strokeStyle = '#6a3a18'; c.lineWidth = 0.7; for (let i = 1; i < 4; i++) { c.beginPath(); c.moveTo(i * 3.5, -1); c.lineTo(i * 3.5, -22); c.stroke(); }
    c.fillStyle = '#ffd27a'; c.beginPath(); c.arc(10.5, -10, 1.2, 0, TAU); c.fill();
    c.restore();
    // a little welcome mat
    c.fillStyle = '#c86a4a'; c.fillRect(x - 8, base - 1, 16, 1.2);
  }

  /** The echo stone where the recording begins: it glows while the candle burns. */
  private stone(g: EchoGame) {
    const c = this.c, s = g.room.start[g.room.first], x = s.c * T + T / 2 - 9 * (s.c < COLS / 2 ? 1 : -1), base = (s.r + 1) * T;
    const on = g.phase === 'record' ? 1 : g.phase === 'live' ? 0.45 : 0.8;
    const gl = c.createRadialGradient(x, base - 6, 1, x, base - 6, 14);
    gl.addColorStop(0, `rgba(110, 255, 230, ${0.4 * on})`); gl.addColorStop(1, 'rgba(110, 255, 230, 0)');
    c.fillStyle = gl; c.fillRect(x - 16, base - 22, 32, 24);
    const im = this.img('stone');
    if (im) { const h = 12, w = (h * im.naturalWidth) / im.naturalHeight; c.drawImage(im, x - w / 2, base - h, w, h); return; }
    c.fillStyle = '#6a7486'; c.beginPath(); c.moveTo(x - 4, base); c.quadraticCurveTo(x - 5, base - 9, x, base - 10); c.quadraticCurveTo(x + 5, base - 9, x + 4, base); c.fill();
    c.fillStyle = `rgba(150, 255, 235, ${0.5 + 0.5 * on})`; c.beginPath(); c.arc(x, base - 5, 1.6, 0, TAU); c.fill();
  }

  private plates(g: EchoGame) {
    const c = this.c;
    g.room.plates.forEach((pl, i) => {
      const x = pl.c * T, base = (pl.r + 1) * T, down = g.pressed[i], col = GROUP[pl.g];
      const w = pl.heavy ? 14 : 12, h = down ? 1.2 : 3, l = x + (T - w) / 2;
      c.fillStyle = '#2a2420'; c.fillRect(l - 1, base - 1, w + 2, 1);
      c.fillStyle = col; c.fillRect(l, base - h - 0.5, w, h);
      c.fillStyle = 'rgba(255,255,255,0.45)'; c.fillRect(l, base - h - 0.5, w, 0.6);
      if (pl.heavy) { c.fillStyle = 'rgba(30, 20, 10, 0.75)'; c.fillRect(l + 2, base - h, 2, h - 0.4); c.fillRect(l + w - 4, base - h, 2, h - 0.4); }
      if (down) { c.fillStyle = col; c.globalAlpha = 0.35 + 0.15 * Math.sin(this.time * 5); c.fillRect(l - 2, base - 6, w + 4, 5); c.globalAlpha = 1; }
    });
  }
  private doors(g: EchoGame) {
    const c = this.c;
    g.room.doors.forEach((d, i) => {
      const open = g.doors[i].open, x = d.c * T, y = d.r * T, full = d.h * T, h = full * (1 - open), col = GROUP[d.g];
      // the slot it slides into
      c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(x + 2, y, T - 4, full);
      if (h < 0.5) return;
      c.fillStyle = '#7a5434'; c.fillRect(x + 1.5, y, T - 3, h);
      c.fillStyle = '#5a3a20'; for (let k = 1; k < 3; k++) c.fillRect(x + 1.5 + k * 4.3, y, 0.8, h);
      c.fillStyle = col; c.fillRect(x + 1.5, y + h - 3, T - 3, 2);
      c.fillStyle = '#3a2614'; c.fillRect(x + 1.5, y + h - 1, T - 3, 1);
      // the group's mark, so you can see which plate it answers to
      c.fillStyle = col; c.font = 'bold 7px ui-rounded, system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      if (h > 9) c.fillText(MARK[d.g], x + T / 2, y + Math.min(h - 8, full / 2));
      if (g.room.hold[d.g] > 0 && g.doors[i].hold > 0 && g.doors[i].hold < g.room.hold[d.g]) {
        // a held door shows its time running out
        const k = g.doors[i].hold / g.room.hold[d.g];
        c.strokeStyle = col; c.lineWidth = 1.2; c.beginPath(); c.arc(x + T / 2, y - 5, 3, -Math.PI / 2, -Math.PI / 2 + k * TAU); c.stroke();
      }
    });
  }
  private lifts(g: EchoGame, a: number) {
    const c = this.c;
    g.room.lifts.forEach((l, i) => {
      const L = g.lifts[i], y = lerp(L.py, L.y, a), x = l.c * T, w = l.w * T, col = GROUP[l.g];
      // rails
      c.strokeStyle = 'rgba(200, 200, 210, 0.25)'; c.lineWidth = 0.8; c.setLineDash([2, 2]);
      c.beginPath(); c.moveTo(x + 2, L.top - 4); c.lineTo(x + 2, L.base); c.moveTo(x + w - 2, L.top - 4); c.lineTo(x + w - 2, L.base); c.stroke(); c.setLineDash([]);
      // ropes up out of sight
      c.strokeStyle = '#b89a6a'; c.lineWidth = 0.7; c.beginPath(); c.moveTo(x + 3, y); c.lineTo(x + 3, L.top - 10); c.moveTo(x + w - 3, y); c.lineTo(x + w - 3, L.top - 10); c.stroke();
      c.fillStyle = '#8a6a44'; c.fillRect(x, y, w, 4);
      c.fillStyle = '#c89a62'; c.fillRect(x, y, w, 1.2);
      c.fillStyle = col; c.fillRect(x + w / 2 - 2, y + 1.6, 4, 1.6);
    });
  }
  private saws(g: EchoGame) {
    const c = this.c;
    g.room.saws.forEach((s, i) => {
      const S = g.saws[i], x0 = s.c * T, b = (s.r + 1) * T, wob = S.flip > 0 ? Math.sin(S.flip * 1.6) * 0.8 : 0;
      // the pivot
      c.fillStyle = '#5a4a3a'; c.beginPath(); c.moveTo(x0 + 26, b); c.lineTo(x0 + 32, b - SAW.mid - 1); c.lineTo(x0 + 38, b); c.fill();
      // the plank
      const y0 = S.top[0] + wob, y1 = S.top[1] - wob;
      c.strokeStyle = '#3a2a1a'; c.lineWidth = 4.2; c.lineCap = 'round'; c.beginPath(); c.moveTo(x0 + 1, y0 + 1.6); c.lineTo(x0 + SAW.w - 1, y1 + 1.6); c.stroke();
      c.strokeStyle = '#b8864e'; c.lineWidth = 3; c.beginPath(); c.moveTo(x0 + 1, y0 + 1.6); c.lineTo(x0 + SAW.w - 1, y1 + 1.6); c.stroke();
      c.lineCap = 'butt';
      // pads
      c.fillStyle = '#e8c890'; c.fillRect(x0 + 1, y0 - 0.6, SAW.pad - 2, 1.4); c.fillRect(x0 + SAW.w - SAW.pad + 1, y1 - 0.6, SAW.pad - 2, 1.4);
    });
  }
  private crates(g: EchoGame, a: number) {
    const c = this.c;
    for (const cr of g.crates) {
      const x = lerp(cr.px, cr.x, a) - T / 2, y = lerp(cr.py, cr.y, a) - T;
      c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(x + 1, y + T - 1, T, 1.5);
      c.fillStyle = '#a8743e'; c.fillRect(x, y, T, T);
      c.strokeStyle = '#6a4220'; c.lineWidth = 1.4; c.strokeRect(x + 0.7, y + 0.7, T - 1.4, T - 1.4);
      c.beginPath(); c.moveTo(x + 1.5, y + 1.5); c.lineTo(x + T - 1.5, y + T - 1.5); c.stroke();
      c.fillStyle = '#d0a060'; c.fillRect(x + 1.4, y + 1.4, T - 2.8, 1);
    }
  }
  private seed(g: EchoGame) {
    const s = g.room.seed; if (!s || g.seed) return;
    const c = this.c, x = s.c * T + T / 2, y = s.r * T + T / 2 + Math.sin(this.time * 2.4) * 1.5;
    const gl = c.createRadialGradient(x, y, 0.5, x, y, 11); gl.addColorStop(0, 'rgba(255, 226, 120, 0.6)'); gl.addColorStop(1, 'rgba(255, 226, 120, 0)');
    c.fillStyle = gl; c.fillRect(x - 12, y - 12, 24, 24);
    c.save(); c.translate(x, y); c.rotate(Math.sin(this.time * 1.7) * 0.25);
    c.fillStyle = '#c8901a'; c.beginPath(); c.ellipse(0, 0, 3.4, 4.6, 0, 0, TAU); c.fill();
    c.fillStyle = '#ffd650'; c.beginPath(); c.ellipse(-0.4, -0.3, 2.6, 3.8, 0, 0, TAU); c.fill();
    c.fillStyle = '#fff6c8'; c.beginPath(); c.ellipse(-1, -1.4, 0.9, 1.5, -0.3, 0, TAU); c.fill();
    c.restore();
    if (Math.floor(this.time * 3) % 4 === 0) { c.fillStyle = '#fff6c8'; const k = hash(Math.floor(this.time * 3)); c.fillRect(x - 6 + k * 12, y - 6 + hash(k * 9) * 12, 1, 1); }
  }

  // ---------------------------------------------------------------- the climbers
  private liveBody(g: EchoGame, a: number, dt: number) {
    const p = g.p, x = lerp(p.px, p.x, a), y = lerp(p.py, p.y, a), j = this.juice[p.who];
    j.squash *= Math.pow(0.002, dt); j.tilt = lerp(j.tilt, p.ground ? 0 : clamp(p.vx / 600, -0.15, 0.15), 1 - Math.pow(0.01, dt));
    const pose: Pose = g.phase === 'clear' ? 'cheer' : p.pose;
    this.body(p.who, x, y, p.face, pose, { squash: j.squash, tilt: j.tilt, run: Math.abs(p.vx) > 8 && !!p.ground, air: !p.ground, alpha: 1, teal: false });
    // a little arrow over whoever you steer, while recording, so it's clear who the echo will be
    if (g.phase === 'record' && g.t < 150) {
      const my = y - SPRITE_H[p.who] - 6 + Math.sin(this.time * 5) * 1.5, c = this.c;
      c.fillStyle = p.who === 'dora' ? '#ff9aa6' : '#9ab8ff'; c.strokeStyle = '#1a1010'; c.lineWidth = 0.8;
      c.beginPath(); c.moveTo(x - 3, my - 3); c.lineTo(x + 3, my - 3); c.lineTo(x, my + 1); c.closePath(); c.fill(); c.stroke();
    }
  }
  private echoBody(g: EchoGame, a: number, dt: number, paused: boolean) {
    const e = g.echo, who = g.echoWho, x = lerp(e.px, e.x, a), y = lerp(e.py, e.y, a);
    // afterimages: a few faded copies trailing behind while it moves
    if (!paused) {
      this.ghostClock += dt;
      if (this.ghostClock > 0.06) { this.ghostClock = 0; if (Math.hypot(e.x - e.px, e.y - e.py) > 0.3) this.ghosts.push({ x: e.x, y: e.y, face: e.face, pose: e.pose, age: 0 }); }
      for (const gh of this.ghosts) gh.age += dt;
      this.ghosts = this.ghosts.filter((gh) => gh.age < 0.4).slice(-6);
      // a soft landing puff when the echo touches down
      if (e.ground && !this.lastEchoGround) this.puff(e.x, e.y, 4, 0.5);
      this.lastEchoGround = e.ground;
    }
    for (const gh of this.ghosts) this.body(who, gh.x, gh.y, gh.face, gh.pose, { squash: 0, tilt: 0, run: false, air: false, alpha: 0.28 * (1 - gh.age / 0.4), teal: true });
    // the echo's light: it shows how far glow-moss wakes up
    const c = this.c, gl = c.createRadialGradient(x, y - KIT[who].h / 2, 2, x, y - KIT[who].h / 2, 30);
    gl.addColorStop(0, 'rgba(90, 236, 222, 0.22)'); gl.addColorStop(1, 'rgba(90, 236, 222, 0)');
    c.fillStyle = gl; c.fillRect(x - 32, y - 44, 64, 64);
    const flick = 0.72 + 0.08 * Math.sin(this.time * 9) + 0.05 * Math.sin(this.time * 23);
    this.body(who, x, y, e.face, e.pose, { squash: 0, tilt: 0, run: e.pose === 'run' || e.pose === 'push', air: !e.ground, alpha: flick, teal: true });
  }
  /** The rewind: both climbers run their loop backwards, faster and faster. */
  private rewindBodies(g: EchoGame, u: number) {
    const k = 1 - (1 - Math.cos(u * Math.PI)) / 2;
    const tr = g.trail, n = tr.length / FRAME;
    if (n > 0) {
      const i = Math.min(n - 1, Math.floor(k * (n - 1))) * FRAME;
      this.body(g.who, tr[i], tr[i + 1], (tr[i + 2] < 0 ? -1 : 1) as 1 | -1, POSES[tr[i + 3]] ?? 'idle', { squash: 0, tilt: 0, run: false, air: tr[i + 4] === 0, alpha: 0.9, teal: false });
    } else this.body(g.who, g.p.x, g.p.y, g.p.face, 'idle', { squash: 0, tilt: 0, run: false, air: false, alpha: 0.9, teal: false });
    if (g.echo.on && g.frameCount > 0) {
      const f = g.frameAt(Math.floor(k * g.t));
      this.body(g.echoWho, f.x, f.y, f.face, f.pose, { squash: 0, tilt: 0, run: false, air: !f.ground, alpha: 0.6, teal: true });
    }
  }
  /** One climber: the painted pose if there is one, else the shared drawn chinchilla. Teal for the echo. */
  private body(who: Who, x: number, y: number, face: 1 | -1, pose: Pose, o: { squash: number; tilt: number; run: boolean; air: boolean; alpha: number; teal: boolean }) {
    if (o.alpha <= 0.01) return;
    const c = this.c, H = SPRITE_H[who], art = this.poseImg(who, pose);
    c.save();
    c.globalAlpha = o.alpha;
    c.translate(x, y);
    c.rotate(o.tilt * face);
    const sq = clamp(o.squash, -0.45, 0.45);
    c.scale(1 + sq * 0.6, 1 - sq);
    if (!o.teal) { c.fillStyle = 'rgba(10, 6, 12, 0.25)'; c.beginPath(); c.ellipse(0, 0, KIT[who].w * 0.6, 1.4, 0, 0, TAU); c.fill(); }
    if (art) {
      const src = o.teal ? this.tinted(`${who}-${art.p}`, art.i) : art.i;
      const h = H / SPRITE_FIG, w = h * (art.i.naturalWidth / art.i.naturalHeight);
      const bob = o.run ? -Math.abs(Math.sin(this.time * 16)) * 1.2 : 0;
      c.scale(face, 1);
      // the tail trails behind, so the painting sits a little back to keep the body over the climber's box
      c.drawImage(src, -w / 2 - w * SPRITE_BACK, -h + h * SPRITE_FOOT + bob, w, h);
    } else {
      const fb = this.fallback, f = ctx2(fb), hh = who === 'dora' ? 22 : 30;
      if (o.teal) {
        // draw the chinchilla on a scratch canvas and tint it, so the echo looks like the painted one would
        const k = 2; if (fb.width !== 64 * k) { fb.width = 64 * k; fb.height = 64 * k; }
        f.setTransform(1, 0, 0, 1, 0, 0); f.clearRect(0, 0, fb.width, fb.height); f.globalCompositeOperation = 'source-over';
        f.setTransform(k, 0, 0, k, 32 * k, 56 * k);
        drawChinchilla(f, who, 0, 0, { face, h: hh, time: this.time, run: this.time * 14, moving: o.run, air: o.air });
        f.setTransform(1, 0, 0, 1, 0, 0); f.globalCompositeOperation = 'source-atop'; f.fillStyle = 'rgba(90, 236, 222, 0.62)'; f.fillRect(0, 0, fb.width, fb.height);
        f.globalCompositeOperation = 'source-over';
        c.drawImage(fb, -32, -56, 64, 64);
      } else drawChinchilla(c, who, 0, 0, { face, h: hh, time: this.time, run: this.time * 14, moving: o.run, air: o.air });
    }
    c.restore();
  }
  /** A painting tinted teal for the echo, made once per pose. */
  private tinted(key: string, img: HTMLImageElement) {
    let cv = this.tints.get(key);
    if (!cv) {
      const k = Math.min(1, 256 / img.naturalHeight);
      cv = mk(img.naturalWidth * k, img.naturalHeight * k); const t = ctx2(cv);
      t.drawImage(img, 0, 0, cv.width, cv.height);
      t.globalCompositeOperation = 'source-atop'; t.fillStyle = TEAL; t.globalAlpha = 0.58; t.fillRect(0, 0, cv.width, cv.height);
      t.globalAlpha = 0.25; t.fillStyle = '#ffffff'; t.fillRect(0, 0, cv.width, cv.height * 0.5);
      this.tints.set(key, cv);
    }
    return cv;
  }

  private particles(dt: number) {
    const c = this.c;
    for (const p of this.parts) {
      p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.kind === 'dust') { p.vx *= Math.pow(0.05, dt); p.vy *= Math.pow(0.1, dt); p.vy -= 6 * dt; p.size += dt * 3; }
      else if (p.kind === 'chip') p.vy += 500 * dt;
      else if (p.kind === 'spark') { p.vx *= Math.pow(0.03, dt); p.vy *= Math.pow(0.03, dt); }
      const a = clamp(p.life / p.max, 0, 1);
      c.globalAlpha = p.kind === 'dust' ? a * 0.55 : a;
      c.fillStyle = p.color;
      if (p.kind === 'chip') c.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      else { c.beginPath(); c.arc(p.x, p.y, p.size, 0, TAU); c.fill(); }
    }
    c.globalAlpha = 1;
    this.parts = this.parts.filter((p) => p.life > 0);
    if (this.parts.length > 400) this.parts.splice(0, this.parts.length - 400);
  }

  /** The loop's look over the room: warm while recording, cool while live, grey with a sweep while rewinding. */
  private grade(g: EchoGame, tint: string, u: number, dt: number) {
    const c = this.c, rx = this.ox, ry = this.oy, rw = WORLD_W * this.s, rh = WORLD_H * this.s;
    c.fillStyle = tint; c.fillRect(rx, ry, rw, rh);
    if (g.phase === 'record') {
      // a soft sepia edge, like an old film, while the candle burns
      const v = c.createRadialGradient(rx + rw / 2, ry + rh / 2, Math.min(rw, rh) * 0.35, rx + rw / 2, ry + rh / 2, Math.max(rw, rh) * 0.7);
      v.addColorStop(0, 'rgba(255, 190, 110, 0)'); v.addColorStop(1, 'rgba(255, 170, 80, 0.22)');
      c.fillStyle = v; c.fillRect(rx, ry, rw, rh);
      c.strokeStyle = 'rgba(255, 200, 120, 0.55)'; c.lineWidth = 2; c.strokeRect(rx + 1, ry + 1, rw - 2, rh - 2);
    } else if (g.phase === 'live' || g.phase === 'clear') {
      c.strokeStyle = 'rgba(90, 236, 222, 0.4)'; c.lineWidth = 2; c.strokeRect(rx + 1, ry + 1, rw - 2, rh - 2);
    } else if (g.phase === 'rewind') {
      // grey the room out (as far as the browser can blend), then sweep a band of light right to left
      const k = Math.sin(Math.min(1, u * 1.2) * Math.PI * 0.5) * (1 - Math.max(0, (u - 0.85) / 0.15));
      c.save(); c.globalCompositeOperation = 'saturation'; c.fillStyle = `rgba(128, 128, 128, ${0.9 * k})`; c.fillRect(rx, ry, rw, rh); c.restore();
      c.fillStyle = `rgba(40, 70, 90, ${0.25 * k})`; c.fillRect(rx, ry, rw, rh);
      const bx = rx + rw * (1 - u) * 1.2 - rw * 0.1;
      const band = c.createLinearGradient(bx - 80, 0, bx + 80, 0);
      band.addColorStop(0, 'rgba(160, 255, 240, 0)'); band.addColorStop(0.5, `rgba(200, 255, 245, ${0.35 * k})`); band.addColorStop(1, 'rgba(160, 255, 240, 0)');
      c.fillStyle = band; c.fillRect(rx, ry, rw, rh);
      // streaks racing backwards
      c.strokeStyle = `rgba(220, 255, 250, ${0.4 * k})`; c.lineWidth = 1.5;
      for (let i = 0; i < 14; i++) {
        const yy = ry + hash(i * 3.1) * rh, len = 30 + hash(i) * 90, xx = rx + rw - (((this.time * (500 + hash(i + 2) * 600)) + hash(i * 7) * rw) % (rw + len));
        c.beginPath(); c.moveTo(xx, yy); c.lineTo(xx + len, yy); c.stroke();
      }
      // a clock face winding back
      const cx = rx + rw / 2, cy = ry + rh / 2, r = Math.min(rw, rh) * 0.12;
      c.globalAlpha = 0.5 * k; c.strokeStyle = '#e8fffb'; c.lineWidth = 3;
      c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.stroke();
      c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(-u * TAU * 2 - Math.PI / 2) * r * 0.8, cy + Math.sin(-u * TAU * 2 - Math.PI / 2) * r * 0.8); c.stroke();
      c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(-u * TAU * 0.5 - Math.PI / 2) * r * 0.5, cy + Math.sin(-u * TAU * 0.5 - Math.PI / 2) * r * 0.5); c.stroke();
      c.globalAlpha = 1;
    }
    if (this.flash > 0) { c.fillStyle = `rgba(255, 250, 230, ${this.flash * 0.5})`; c.fillRect(rx, ry, rw, rh); this.flash = Math.max(0, this.flash - dt * 1.6); }
    if (this.sweep > 0) this.sweep = Math.max(0, this.sweep - dt);
  }
  /** Behind the menus: the first chapter's wall, gently. */
  private drawIdle() {
    this.backWall('cellar');
    const c = this.c;
    c.fillStyle = 'rgba(255, 200, 140, 0.05)';
    for (let i = 0; i < 18; i++) { const x = hash(i) * this.W, y = (hash(i + 4) * this.H - this.time * (6 + hash(i + 9) * 10)) % this.H; c.beginPath(); c.arc(x, y < 0 ? y + this.H : y, 1.5 + hash(i * 2) * 2.5, 0, TAU); c.fill(); }
  }
}

// ---------------------------------------------------------------- stand-ins for the paintings
/** The title painting's stand-in: the pair in a lantern-lit burrow, Dora beside her teal echo. */
export function paintTitle(cv: HTMLCanvasElement, t = 0.4) {
  const c = ctx2(cv), W = cv.width, H = cv.height;
  const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#3a2c44'); g.addColorStop(0.6, '#4a3426'); g.addColorStop(1, '#22160e');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  const gl = c.createRadialGradient(W * 0.5, H * 0.55, 10, W * 0.5, H * 0.55, H * 0.7); gl.addColorStop(0, 'rgba(255, 200, 120, 0.4)'); gl.addColorStop(1, 'rgba(255, 200, 120, 0)');
  c.fillStyle = gl; c.fillRect(0, 0, W, H);
  c.fillStyle = '#2a1a10'; c.fillRect(0, H * 0.8, W, H * 0.2);
  c.fillStyle = '#5e4432'; c.beginPath(); c.moveTo(0, H * 0.8); for (let x = 0; x <= W; x += W / 10) c.lineTo(x, H * (0.8 - 0.02 * Math.sin(x / W * 13))); c.lineTo(W, H); c.lineTo(0, H); c.fill();
  // the teal echo, then Dora and Enzo
  c.save(); c.globalAlpha = 0.55; drawChinchilla(c, 'dora', W * 0.3, H * 0.8, { face: 1, h: H * 0.2, time: t }); c.restore();
  c.fillStyle = 'rgba(90, 236, 222, 0.25)'; c.beginPath(); c.arc(W * 0.3, H * 0.7, H * 0.14, 0, TAU); c.fill();
  drawChinchilla(c, 'dora', W * 0.46, H * 0.8, { face: 1, h: H * 0.2, time: t });
  drawChinchilla(c, 'enzo', W * 0.64, H * 0.8, { face: -1, h: H * 0.26, time: t });
  const v = c.createLinearGradient(0, H * 0.55, 0, H); v.addColorStop(0, 'rgba(20, 10, 10, 0)'); v.addColorStop(1, 'rgba(20, 10, 10, 0.55)');
  c.fillStyle = v; c.fillRect(0, 0, W, H);
}
/** The ending's stand-in: home at last, curled up by the hearth. */
export function paintEnding(cv: HTMLCanvasElement, t = 0.4) {
  const c = ctx2(cv), W = cv.width, H = cv.height;
  const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#5a3e28'); g.addColorStop(1, '#2a1a10');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  const gl = c.createRadialGradient(W * 0.72, H * 0.62, 10, W * 0.72, H * 0.62, H * 0.6); gl.addColorStop(0, 'rgba(255, 170, 80, 0.7)'); gl.addColorStop(1, 'rgba(255, 170, 80, 0)');
  c.fillStyle = gl; c.fillRect(0, 0, W, H);
  c.fillStyle = '#ff9a3a'; c.beginPath(); c.ellipse(W * 0.72, H * 0.72, W * 0.06, H * 0.08, 0, 0, TAU); c.fill();
  c.fillStyle = '#7a4a2a'; c.fillRect(0, H * 0.8, W, H * 0.2);
  c.fillStyle = '#c86a4a'; c.beginPath(); c.ellipse(W * 0.45, H * 0.82, W * 0.22, H * 0.04, 0, 0, TAU); c.fill();
  drawChinchilla(c, 'dora', W * 0.38, H * 0.8, { face: 1, h: H * 0.2, time: t });
  drawChinchilla(c, 'enzo', W * 0.54, H * 0.8, { face: -1, h: H * 0.25, time: t });
}
/** A small picture of a room's map, for the room list. */
export function paintRoomMap(cv: HTMLCanvasElement, index: number) {
  const R = ROOMS[index]; if (!R) return;
  const c = ctx2(cv), k = Math.min(cv.width / WORLD_W, cv.height / WORLD_H), L = LOOK[R.chapter];
  c.fillStyle = L.wall[1]; c.fillRect(0, 0, cv.width, cv.height);
  c.save(); c.scale(k, k);
  for (let r = 0; r < ROWS; r++) for (let col = 0; col < COLS; col++) {
    const t = R.tiles[r * COLS + col];
    if (t === ROCK || t === KIT_ROCK) { c.fillStyle = L.rock; c.fillRect(col * T, r * T, T + 0.5, T + 0.5); }
    else if (t === LEDGE) { c.fillStyle = L.ledgeTop; c.fillRect(col * T, r * T, T, 4); }
    else if (t === CRUMBLE) { c.fillStyle = L.lit; c.fillRect(col * T, r * T, T, 9); }
    else if (t === MOSS) { c.fillStyle = '#3ad8a0'; c.globalAlpha = 0.6; c.fillRect(col * T, r * T, T, 8); c.globalAlpha = 1; }
    else if (t === FAN_TILE) { c.fillStyle = '#c8d0d8'; c.fillRect(col * T, r * T + 4, T, T - 4); }
  }
  c.fillStyle = '#ffd890'; c.fillRect(R.exit.c * T + 3, (R.exit.r - 1) * T + 4, T - 6, 2 * T - 4);
  if (R.seed) { c.fillStyle = '#ffd650'; c.beginPath(); c.arc(R.seed.c * T + 8, R.seed.r * T + 8, 5, 0, TAU); c.fill(); }
  c.restore();
}
