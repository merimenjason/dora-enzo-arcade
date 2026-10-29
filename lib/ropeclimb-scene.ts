// Ropeclimb's drawing, in Canvas 2D: the barn tower side-on, its beams, posts, hay, bales, lanterns, gusts and owls,
// the rope between the two climbers, Dora and Enzo themselves (painted poses once they load, the shared drawn
// chinchillas until then), dust and straw, and the camera that follows the pair. Drawing only: the rules are in
// ropeclimb-game.ts. Every painting has a drawn stand-in, and a painting is only used once it has fully loaded.
import { drawChinchilla } from './chinchilla-art';
import {
  RopeclimbGame, BODY, JUMP, G, TOWER_W, TOP_Y, FLOOR_H, OWL, sectionAt, SECTION_IDS,
  type Ev, type Who, type Climber, type Solid, type SectionId,
} from './ropeclimb-game';

const TAU = Math.PI * 2;
const mk = (w: number, h: number) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; };
const ctx2 = (c: HTMLCanvasElement) => c.getContext('2d')!;
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** A fixed hash in place of randomness, so the scenery looks the same every time. */
const hash = (n: number) => { const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };

/** Each section's look: the back wall, its boards or stones, the light, and a tint over everything. */
const LOOK: Record<SectionId, { top: string; bottom: string; board: string; seam: string; wood: string; woodTop: string; glow: string; tint: string; stone: boolean }> = {
  cellar: { top: '#4a4a5a', bottom: '#2c2c38', board: '#5a5868', seam: '#24232c', wood: '#7a5a3e', woodTop: '#a8825a', glow: 'rgba(160, 190, 255, 0.10)', tint: 'rgba(40, 50, 90, 0.10)', stone: true },
  stables: { top: '#8a6038', bottom: '#5a3a22', board: '#7c5434', seam: '#3c2614', wood: '#8a5e36', woodTop: '#c08a52', glow: 'rgba(255, 200, 120, 0.12)', tint: 'rgba(120, 60, 20, 0.06)', stone: false },
  hayloft: { top: '#b88a44', bottom: '#7a5428', board: '#a07040', seam: '#5a3a1a', wood: '#94663a', woodTop: '#d09a5a', glow: 'rgba(255, 230, 150, 0.18)', tint: 'rgba(160, 110, 20, 0.05)', stone: false },
  rafters: { top: '#6a4a3a', bottom: '#3e2a24', board: '#5e4032', seam: '#2a1a14', wood: '#7a5034', woodTop: '#b07848', glow: 'rgba(255, 170, 90, 0.14)', tint: 'rgba(90, 40, 20, 0.10)', stone: false },
  belfry: { top: '#4c4a6e', bottom: '#2e2c48', board: '#4a4664', seam: '#1e1c30', wood: '#6a5040', woodTop: '#9a7a5a', glow: 'rgba(170, 160, 255, 0.10)', tint: 'rgba(50, 40, 110, 0.10)', stone: false },
  rooftop: { top: '#f4a37a', bottom: '#8a5a9a', board: '#b06a5a', seam: '#5a3040', wood: '#8a4a3a', woodTop: '#c47a5a', glow: 'rgba(255, 190, 130, 0.20)', tint: 'rgba(255, 130, 80, 0.06)', stone: false },
};
const BG: Record<SectionId, string> = { cellar: 'bg-cellar', stables: 'bg-stables', hayloft: 'bg-hayloft', rafters: 'bg-rafters', belfry: 'bg-belfry', rooftop: 'bg-rooftop' };
export type Pose = 'idle' | 'charge' | 'leap' | 'grip' | 'swing' | 'dangle' | 'cheer';
export const POSES: Pose[] = ['idle', 'charge', 'leap', 'grip', 'swing', 'dangle', 'cheer'];
/** How tall a painted pose is drawn, in world units (the climber's box is 16). */
const SPRITE_H = 40;
/** A painted pose to borrow while one hasn't come (or never does), so the painted climbers never switch to the drawn ones mid-air. */
const STAND_IN: Partial<Record<Pose, Pose>> = { swing: 'leap', dangle: 'grip', charge: 'idle', cheer: 'idle' };

type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string; kind: 'dust' | 'straw' | 'spark' | 'feather' | 'note' };
type Juice = { squash: number; land: number; tilt: number; blink: number; cheer: number };

export class RopeclimbScene {
  private canvas: HTMLCanvasElement; private c: CanvasRenderingContext2D;
  private W = 1; private H = 1; private dpr = 1;
  cam = { x: TOWER_W / 2, y: 120, z: 1.4 };
  private time = 0; private shake = 0; private shakeOn = true;
  private art = new Map<string, HTMLImageElement>();
  private parts: Particle[] = [];
  private juice: Record<Who, Juice> = { dora: { squash: 0, land: 0, tilt: 0, blink: 0, cheer: 0 }, enzo: { squash: 0, land: 0, tilt: 0, blink: 0, cheer: 0 } };
  private twang = 0; private flash = 0; private bellRing = 0;
  private boardCache = new Map<string, HTMLCanvasElement>();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas; this.c = ctx2(canvas);
    for (const w of ['dora', 'enzo']) for (const p of POSES) this.load(`${w}-${p}`);
    this.resize();
  }
  private load(name: string) { if (this.art.has(name)) return; const img = new Image(); img.decoding = 'async'; img.src = `/art/ropeclimb/${name}.webp`; this.art.set(name, img); }
  /** A painting, once it has fully loaded; null until then (or if it never does). */
  img(name: string) { const i = this.art.get(name); return i && i.complete && i.naturalWidth > 0 ? i : null; }
  setShake(on: boolean) { this.shakeOn = on; }
  /** Screen pixels along the bottom covered by touch buttons, so the camera keeps the climbers above them. */
  padBottom = 0;

  resize() {
    const r = this.canvas.getBoundingClientRect(); this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.W = Math.max(1, r.width); this.H = Math.max(1, r.height);
    const w = Math.round(this.W * this.dpr), h = Math.round(this.H * this.dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
  }
  /** World units to a pixel: enough of the tower to see a leap ahead, the climbers big enough to read on a phone. */
  private baseZoom() { return clamp(Math.min(this.H / 420, this.W / 330), 0.7, 2.4); }
  /** Puts the camera straight on the pair (when a climb starts). */
  snap(g: RopeclimbGame) { const t = this.camTarget(g); this.cam.x = t.x; this.cam.y = t.y; this.cam.z = t.z; }
  private camTarget(g: RopeclimbGame) {
    const d = g.dora, e = g.enzo, spread = Math.abs(d.y - e.y);
    const z = Math.min(this.baseZoom(), this.H / (spread + 240));
    // the pair sits a little below the middle, so you see more of the climb ahead
    // (with touch buttons along the bottom, framed above them instead)
    const pad = this.padBottom, my = (d.y + e.y) / 2 + (this.H * 0.14 - pad * 0.75) / z;
    const halfW = this.W / 2 / z;
    const x = halfW * 2 >= TOWER_W + 40 ? TOWER_W / 2 : clamp((d.x + e.x) / 2, halfW - 20, TOWER_W + 20 - halfW);
    return { x, y: Math.max(my, (this.H / 2 - pad) / z - 44), z };
  }

  /** Reacts to what the game did: squash and stretch, dust, shakes. */
  feed(events: Ev[], g: RopeclimbGame) {
    for (const e of events) {
      switch (e.k) {
        case 'jump': { const c = g.c(e.who); this.juice[e.who].squash = -0.35 - 0.25 * e.charge; this.puff(c.x, c.y, 5 + Math.round(e.charge * 6), 0.7); break; }
        case 'land': { const c = g.c(e.who); this.juice[e.who].land = Math.min(0.5, 0.12 + e.v / 1400); this.puff(c.x, c.y, e.hard ? 14 : 6, e.hard ? 1.4 : 0.8); if (e.hard) this.kick(7); break; }
        case 'grip': this.juice[e.who].land = 0.18; break;
        case 'catch': this.twang = 1; this.kick(Math.min(6, 2 + e.v / 160)); break;
        case 'yank': this.twang = 0.7; this.kick(2); break;
        case 'drag': this.twang = 0.5; break;
        case 'crumble': { const s = g.world.solids[e.id]; for (let i = 0; i < 16; i++) this.parts.push({ x: s.x + hash(i + e.id) * s.w, y: s.y + s.h, vx: (hash(i * 3) - 0.5) * 60, vy: 20 + hash(i * 7) * 60, life: 1.4, max: 1.4, size: 3 + hash(i) * 3, color: '#e8c060', kind: 'straw' }); break; }
        case 'bonk': this.kick(5); this.flash = 0.25; for (let i = 0; i < 8; i++) this.parts.push({ x: e.x, y: e.y, vx: Math.cos(i) * 90, vy: Math.sin(i) * 90, life: 0.5, max: 0.5, size: 2.5, color: '#ffd27a', kind: 'spark' }); break;
        case 'flap': { this.kick(8); const o = g.world.owls[e.id]; for (let i = 0; i < 14; i++) this.parts.push({ x: o.x, y: o.y + 20, vx: (hash(i * 5) - 0.5) * 300, vy: hash(i * 9) * 160, life: 2, max: 2, size: 5, color: '#e9dcc8', kind: 'feather' }); break; }
        case 'bell': this.bellRing = Math.min(1.5, this.bellRing + e.v); this.kick(3 * e.v); break;
        case 'acorn': { const a = g.world.acorns[e.id]; for (let i = 0; i < 14; i++) this.parts.push({ x: a.x, y: a.y, vx: Math.cos(i / 14 * TAU) * 80, vy: Math.sin(i / 14 * TAU) * 80 + 30, life: 0.9, max: 0.9, size: 2.5, color: i % 2 ? '#ffe28a' : '#fff6d0', kind: 'spark' }); break; }
        case 'tub': { const t = g.world.tubs[e.id]; for (let i = 0; i < 30; i++) this.parts.push({ x: t.x + (hash(i) - 0.5) * 50, y: t.y + 10, vx: (hash(i * 3) - 0.5) * 80, vy: 20 + hash(i * 5) * 70, life: 2.2, max: 2.2, size: 6 + hash(i * 2) * 8, color: '#e6d6b8', kind: 'dust' }); this.juice.dora.cheer = this.juice.enzo.cheer = 2.4; break; }
        case 'won': this.juice.dora.cheer = this.juice.enzo.cheer = 999; break;
        case 'shove': this.kick(3); break;
        case 'blown': this.juice[e.who].squash = 0.3; break;
        case 'stir': { const o = g.world.owls[e.id]; this.parts.push({ x: o.x + 14, y: o.y + 40, vx: 6, vy: 14, life: 1.4, max: 1.4, size: 10, color: '#fff', kind: 'note' }); break; }
        default: break;
      }
    }
  }
  private kick(n: number) { if (this.shakeOn) this.shake = Math.min(12, Math.max(this.shake, n)); }
  private puff(x: number, y: number, n: number, k: number) {
    for (let i = 0; i < n; i++) {
      const a = (i / Math.max(1, n - 1) - 0.5) * Math.PI * 0.9 + Math.PI / 2, h = hash(i + this.time * 13);
      this.parts.push({ x: x + (h - 0.5) * 14, y: y + 1, vx: Math.cos(a + Math.PI / 2) * (40 + h * 50) * k * (i % 2 ? 1 : -1), vy: (8 + h * 25) * k, life: 0.6 + h * 0.4, max: 1, size: (4 + h * 4) * k, color: '#d8c8a8', kind: 'dust' });
    }
  }

  // ---------------------------------------------------------------- the frame
  /** Draws a frame. `alpha` is how far between the last tick and the next we are; `active` marks who the player steers. */
  draw(g: RopeclimbGame | null, o: { dt: number; alpha: number; paused: boolean; showActive: boolean; aimGuide: boolean }) {
    const c = this.c, dt = o.paused ? 0 : o.dt;
    this.time += dt;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (!g) { this.drawIdle(); return; }
    // camera
    const t = this.camTarget(g), k = 1 - Math.pow(0.0025, dt);
    this.cam.x = lerp(this.cam.x, t.x, k); this.cam.y = lerp(this.cam.y, t.y, k); this.cam.z = lerp(this.cam.z, t.z, 1 - Math.pow(0.05, dt));
    this.shake = Math.max(0, this.shake - dt * 30);
    this.twang = Math.max(0, this.twang - dt * 2.5); this.flash = Math.max(0, this.flash - dt); this.bellRing = Math.max(0, this.bellRing - dt * 0.5);
    for (const w of ['dora', 'enzo'] as Who[]) { const j = this.juice[w]; j.squash *= Math.pow(0.0008, dt); j.land = Math.max(0, j.land - dt * 2.2); j.cheer = Math.max(0, j.cheer - dt); j.blink -= dt; if (j.blink < -3.5) j.blink = 0.12; }
    const sx = this.shake ? (hash(this.time * 60) - 0.5) * this.shake : 0, sy = this.shake ? (hash(this.time * 60 + 9) - 0.5) * this.shake : 0;
    const z = this.cam.z, ox = this.W / 2 - this.cam.x * z + sx, oy = this.H / 2 + this.cam.y * z + sy;
    const view = { y0: this.cam.y - this.H / 2 / z - 60, y1: this.cam.y + this.H / 2 / z + 60 };
    const sec = sectionAt(clamp(this.cam.y, 0, TOP_Y - 1));
    this.backdrop(g, sec, z);
    c.save();
    c.translate(ox, oy); c.scale(z, -z);
    this.walls(sec, view);
    this.scenery(g, view);
    this.drawWorld(g, view);
    this.drawRope(g, o.alpha);
    for (const who of ['dora', 'enzo'] as Who[]) if (who !== g.active || !o.showActive) this.drawClimber(g, g.c(who), o.alpha, false);
    if (o.showActive) this.drawClimber(g, g.c(g.active), o.alpha, true);
    if (o.aimGuide) this.drawAim(g, g.c(g.active));
    this.drawParticles(dt);
    c.restore();
    this.grade(sec, g);
  }

  /** The back wall: the section's painting, or drawn boards and stones, scrolling slowly behind the climb. */
  private backdrop(g: RopeclimbGame, sec: SectionId, z: number) {
    const c = this.c, L = LOOK[sec], name = BG[sec];
    // paintings load as you near their section
    const i = SECTION_IDS.indexOf(sec);
    for (const j of [i, i + 1]) if (j < SECTION_IDS.length) this.load(BG[SECTION_IDS[j]]);
    const img = this.img(name), s0 = (i * 2) * FLOOR_H, span = sec === 'rooftop' ? TOP_Y + 300 - s0 : FLOOR_H * 2;
    const g0 = c.createLinearGradient(0, 0, 0, this.H); g0.addColorStop(0, L.top); g0.addColorStop(1, L.bottom);
    c.fillStyle = g0; c.fillRect(0, 0, this.W, this.H);
    if (img) {
      // cover the screen, then slide up the painting as the climb goes up the section
      const k = Math.max(this.W / img.naturalWidth, (this.H * 1.35) / img.naturalHeight), w = img.naturalWidth * k, h = img.naturalHeight * k;
      const p = clamp((this.cam.y - s0) / span, 0, 1), y = -(h - this.H) * (1 - p);
      c.globalAlpha = 0.92; c.drawImage(img, (this.W - w) / 2 + (TOWER_W / 2 - this.cam.x) * z * 0.15, y, w, h); c.globalAlpha = 1;
      // a soft veil sets the painting back so the ledges and climbers stand out in front of it
      c.fillStyle = sec === 'rooftop' ? 'rgba(40, 20, 50, 0.16)' : 'rgba(28, 16, 8, 0.32)'; c.fillRect(0, 0, this.W, this.H);
    }
    void g;
  }
  /** The tower's side walls (or the open sky beside the roof). */
  private walls(sec: SectionId, view: { y0: number; y1: number }) {
    const c = this.c, L = LOOK[sec];
    const painted = !!this.img(BG[sec]);
    // the back wall's boards, drawn when the painting hasn't come yet (and faintly over it to tie the beams in)
    const y0 = Math.floor(view.y0 / 40) * 40, y1 = view.y1;
    if (!painted) {
      c.fillStyle = L.board; c.fillRect(0, view.y0, TOWER_W, view.y1 - view.y0);
      if (L.stone && view.y0 < 1500) {
        for (let y = y0; y < Math.min(y1, 1500); y += 30) for (let x = ((y / 30) % 2) * 30 - 30; x < TOWER_W; x += 60) {
          c.fillStyle = hash(x * 7 + y) > 0.5 ? '#615e70' : '#57546a'; c.fillRect(x + 2, y + 2, 56, 26);
        }
      } else {
        for (let x = 0; x < TOWER_W; x += 40) { c.fillStyle = hash(x) > 0.5 ? L.board : L.seam + '33'; c.fillRect(x, view.y0, 38, view.y1 - view.y0); c.fillStyle = L.seam; c.fillRect(x + 38, view.y0, 2, view.y1 - view.y0); }
      }
    }
    // light falling from above
    const lg = c.createLinearGradient(0, 0, TOWER_W, 0); lg.addColorStop(0, 'rgba(0,0,0,0.18)'); lg.addColorStop(0.5, 'rgba(0,0,0,0)'); lg.addColorStop(1, 'rgba(0,0,0,0.18)');
    c.fillStyle = lg; c.fillRect(0, view.y0, TOWER_W, view.y1 - view.y0);
    // the side walls: thick timber frames (none outside on the roof)
    const outside = sec === 'rooftop' && view.y0 > 7600;
    for (const [x0, x1] of [[-400, 0], [TOWER_W, TOWER_W + 400]] as const) {
      if (outside) continue;
      c.fillStyle = L.seam; c.fillRect(x0, view.y0, x1 - x0, view.y1 - view.y0);
      c.fillStyle = L.wood; c.fillRect(x0 === -400 ? -16 : TOWER_W, view.y0, 16, view.y1 - view.y0);
      c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(x0 === -400 ? -4 : TOWER_W, view.y0, 4, view.y1 - view.y0);
    }
    if (sec === 'rooftop') {
      // the roof slopes up either side toward the ridge
      c.fillStyle = '#7a3a34';
      c.beginPath(); c.moveTo(-400, 7500); c.lineTo(0, 7500); c.lineTo(0, 7520); c.lineTo(-400, 7520); c.fill();
    }
  }

  /** Little things on the back wall: hanging tack, jars, knotholes where the gusts come in. */
  private scenery(g: RopeclimbGame, view: { y0: number; y1: number }) {
    const c = this.c;
    g.world.gusts.forEach((gu, i) => {
      if (gu.y1 < view.y0 || gu.y0 > view.y1) return;
      const st = g.gustState(i), x = gu.dir > 0 ? 6 : TOWER_W - 6, y = (gu.y0 + gu.y1) / 2;
      // the knothole
      c.fillStyle = '#1a0f08'; c.beginPath(); c.ellipse(x, y, 7, 11, 0, 0, TAU); c.fill();
      c.strokeStyle = '#5a3a1a'; c.lineWidth = 3; c.stroke();
      if (st === 'warn') { c.fillStyle = `rgba(240, 230, 210, ${0.3 + 0.3 * Math.sin(this.time * 20)})`; c.beginPath(); c.arc(x + gu.dir * 10, y, 5 + 3 * Math.sin(this.time * 14), 0, TAU); c.fill(); }
      if (st === 'on') {
        c.strokeStyle = 'rgba(255, 250, 235, 0.45)'; c.lineWidth = 2; c.lineCap = 'round';
        for (let k = 0; k < 9; k++) {
          const yy = gu.y0 + 8 + hash(k * 11 + i) * (gu.y1 - gu.y0 - 16), sp = 300 + hash(k) * 200, len = 30 + hash(k * 3) * 40;
          let xx = ((this.time * sp + hash(k * 17) * TOWER_W) % (TOWER_W + 80)) - 40; if (gu.dir < 0) xx = TOWER_W - xx;
          c.beginPath(); c.moveTo(xx, yy); c.quadraticCurveTo(xx - gu.dir * len / 2, yy + 3 * Math.sin(this.time * 6 + k), xx - gu.dir * len, yy); c.stroke();
        }
      }
    });
  }

  private drawWorld(g: RopeclimbGame, view: { y0: number; y1: number }) {
    const c = this.c, sec = (y: number) => LOOK[sectionAt(clamp(y, 0, TOP_Y - 1))];
    // tubs first (they sit on the floors)
    for (const t of g.world.tubs) if (t.y > view.y0 && t.y < view.y1) this.drawTub(t.x, t.y, t.id <= g.tub, g.hard, g.rolling === t.id);
    for (const s of g.world.solids) {
      if (s.y > view.y1 || s.y + s.h < view.y0) continue;
      this.drawSolid(g, s, sec(s.y));
    }
    for (const p of g.world.posts) {
      if (p.y0 > view.y1 || p.y1 < view.y0) continue;
      const L = sec(p.y0);
      c.fillStyle = L.wood; c.fillRect(p.x - 5, p.y0, 10, p.y1 - p.y0);
      c.fillStyle = L.woodTop; c.fillRect(p.x - 5, p.y0, 3, p.y1 - p.y0);
      c.fillStyle = 'rgba(0,0,0,0.25)'; for (let y = p.y0 + 8; y < p.y1 - 4; y += 12) c.fillRect(p.x - 4, y, 8, 1.5);
      c.fillStyle = L.seam; c.fillRect(p.x - 6, p.y1 - 4, 12, 4); c.fillRect(p.x - 6, p.y0, 12, 4);
    }
    // bales
    g.world.bales.forEach((b, i) => {
      if (b.y > view.y1 || b.y + b.h < view.y0) return;
      const x = g.baleX(i); this.hay(x, b.y, b.w, b.h, i * 13, true);
      // the runners it slides on
      c.fillStyle = 'rgba(60, 35, 15, 0.5)'; c.fillRect(b.x0, b.y - 3, b.x1 + b.w - b.x0, 3);
    });
    // acorns
    for (const a of g.world.acorns) {
      if (g.found.has(a.id) || a.y < view.y0 || a.y > view.y1) continue;
      this.acorn(a.x, a.y + 3 * Math.sin(this.time * 2.5 + a.id), 1);
    }
    // lanterns
    g.world.lanterns.forEach((l, i) => {
      if (l.y < view.y0 - 100 || l.y - l.len > view.y1) return;
      const p = g.lanternAt(i);
      c.strokeStyle = '#3a3a3a'; c.lineWidth = 1.5; c.setLineDash([3, 2]); c.beginPath(); c.moveTo(l.x, l.y); c.lineTo(p.x, p.y + 10); c.stroke(); c.setLineDash([]);
      c.fillStyle = '#5a3a1a'; c.fillRect(l.x - 6, l.y - 2, 12, 5);
      const glow = c.createRadialGradient(p.x, p.y, 2, p.x, p.y, 70); glow.addColorStop(0, 'rgba(255, 210, 120, 0.55)'); glow.addColorStop(1, 'rgba(255, 170, 60, 0)');
      c.fillStyle = glow; c.beginPath(); c.arc(p.x, p.y, 70, 0, TAU); c.fill();
      c.save(); c.translate(p.x, p.y); c.rotate(-p.a);
      c.fillStyle = '#2e2a26'; c.fillRect(-8, 8, 16, 4); c.fillRect(-7, -12, 14, 3);
      c.fillStyle = '#ffd877'; c.fillRect(-6, -9, 12, 17);
      c.fillStyle = '#fff3c4'; c.fillRect(-2.5, -5, 5, 9);
      c.strokeStyle = '#2e2a26'; c.lineWidth = 1.5; c.strokeRect(-6, -9, 12, 17);
      c.beginPath(); c.arc(0, 12, 4, 0, Math.PI); c.stroke();
      c.restore();
    });
    // owls
    g.world.owls.forEach((o, i) => { if (o.y > view.y0 - 40 && o.y < view.y1 + 40) this.owl(o.x, o.y, g.owls[i]); });
    // the weathervane above the ridge
    if (TOP_Y < view.y1 + 200) this.vane(240, TOP_Y);
  }

  private drawSolid(g: RopeclimbGame, s: Solid, L: (typeof LOOK)[SectionId]) {
    const c = this.c;
    switch (s.kind) {
      case 'beam': case 'straw': {
        if (s.kind === 'straw') {
          const v = g.straw[s.id] ?? 0;
          if (v < 0) {
            // grown back soon: a faint outline
            if (v > -60) { c.globalAlpha = 0.3 + 0.3 * Math.sin(this.time * 10); this.strawBeam(s, 0); c.globalAlpha = 1; }
            else { c.strokeStyle = 'rgba(232, 192, 96, 0.25)'; c.setLineDash([4, 4]); c.strokeRect(s.x, s.y, s.w, s.h); c.setLineDash([]); }
            return;
          }
          this.strawBeam(s, v > 0 ? Math.sin(this.time * 50) * Math.min(2, v / 15) : 0);
          return;
        }
        // a shadow on the wall behind it, then the beam with a dark edge, so it stands out from painted boards
        c.fillStyle = 'rgba(15, 8, 4, 0.32)'; c.fillRect(s.x + 3, s.y - 6, s.w, 6);
        c.fillStyle = L.wood; c.fillRect(s.x, s.y, s.w, s.h);
        c.strokeStyle = 'rgba(30, 16, 8, 0.75)'; c.lineWidth = 1; c.strokeRect(s.x + 0.5, s.y + 0.5, s.w - 1, s.h - 1);
        c.fillStyle = L.woodTop; c.fillRect(s.x, s.y + s.h - 3, s.w, 3);
        c.fillStyle = 'rgba(255, 236, 190, 0.35)'; c.fillRect(s.x + 1, s.y + s.h - 1, s.w - 2, 1);
        c.fillStyle = 'rgba(0,0,0,0.22)'; c.fillRect(s.x, s.y, s.w, 2);
        c.fillStyle = 'rgba(0,0,0,0.18)'; for (let x = s.x + 14 + hash(s.id) * 20; x < s.x + s.w - 6; x += 34 + hash(x) * 10) c.fillRect(x, s.y + 3, 10 + hash(x * 3) * 12, 1);
        c.fillStyle = '#2a1a10'; c.beginPath(); c.arc(s.x + 4, s.y + s.h / 2, 1.3, 0, TAU); c.arc(s.x + s.w - 4, s.y + s.h / 2, 1.3, 0, TAU); c.fill();
        // a bracket into the wall when the beam touches it
        if (s.x <= 1 || s.x + s.w >= TOWER_W - 1) { const bx = s.x <= 1 ? s.x : s.x + s.w - 14; c.fillStyle = L.seam; c.beginPath(); c.moveTo(bx + (s.x <= 1 ? 0 : 14), s.y); c.lineTo(bx + (s.x <= 1 ? 0 : 14), s.y - 14); c.lineTo(bx + (s.x <= 1 ? 14 : 0), s.y); c.fill(); }
        return;
      }
      case 'net': {
        if (g.hard) return;
        c.strokeStyle = 'rgba(214, 180, 120, 0.85)'; c.lineWidth = 1.2;
        c.beginPath(); for (let x = s.x; x <= s.x + s.w; x += 8) { c.moveTo(x, s.y + s.h); c.lineTo(x + 4, s.y - 4); c.lineTo(x + 8, s.y + s.h); } c.stroke();
        c.fillStyle = 'rgba(214, 180, 120, 0.9)'; c.fillRect(s.x, s.y + s.h - 1.5, s.w, 1.5);
        return;
      }
      case 'floor': {
        const pat = this.boards(L);
        c.fillStyle = L.wood; c.fillRect(s.x, s.y, s.w, s.h);
        c.save(); c.beginPath(); c.rect(s.x, s.y, s.w, s.h); c.clip(); c.drawImage(pat, s.x - (s.x % 64), s.y, Math.ceil(s.w / 64 + 1) * 64, s.h); c.restore();
        c.fillStyle = L.woodTop; c.fillRect(s.x, s.y + s.h - 3, s.w, 3);
        c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(s.x, s.y, s.w, 3);
        return;
      }
      case 'block': {
        c.fillStyle = L.stone ? '#6c6878' : L.wood; c.fillRect(s.x, s.y, s.w, s.h);
        c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = 1.5;
        if (L.stone) { for (let y = s.y + 10; y < s.y + s.h; y += 10) { c.beginPath(); c.moveTo(s.x, y); c.lineTo(s.x + s.w, y); c.stroke(); } }
        else { for (let x = s.x + 10; x < s.x + s.w; x += 10) { c.beginPath(); c.moveTo(x, s.y); c.lineTo(x, s.y + s.h); c.stroke(); } }
        c.fillStyle = 'rgba(255,255,255,0.15)'; c.fillRect(s.x, s.y + s.h - 2, s.w, 2);
        return;
      }
      case 'hay': this.hay(s.x, s.y, s.w, s.h, s.id, false); return;
      case 'chimney': {
        c.fillStyle = '#9a4a3a'; c.fillRect(s.x, s.y, s.w, s.h);
        for (let y = s.y; y < s.y + s.h; y += 8) for (let x = s.x + ((y / 8) % 2) * 8 - 8; x < s.x + s.w; x += 16) { c.fillStyle = hash(x + y * 3) > 0.5 ? '#b25a46' : '#a04e3e'; c.fillRect(Math.max(s.x, x + 1), y + 1, Math.min(14, s.x + s.w - x - 1), 6); }
        c.fillStyle = '#6a3028'; c.fillRect(s.x - 4, s.y + s.h - 6, s.w + 8, 6);
        // a curl of smoke
        for (let i = 0; i < 5; i++) { const t = (this.time * 0.4 + i / 5) % 1; c.fillStyle = `rgba(230, 220, 230, ${0.35 * (1 - t)})`; c.beginPath(); c.arc(s.x + s.w / 2 + Math.sin(t * 6 + i) * 10 + t * 30, s.y + s.h + 10 + t * 90, 6 + t * 14, 0, TAU); c.fill(); }
        return;
      }
      case 'bell': {
        const cx = s.x + s.w / 2, top = s.y + s.h, a = g.bell.swing + Math.sin(this.time * 9) * this.bellRing * 0.05;
        c.save(); c.translate(cx, top + 18); c.rotate(-a);
        c.fillStyle = '#4a3020'; c.fillRect(-40, 14, 80, 8); // the yoke
        c.fillStyle = '#3a2a1a'; c.fillRect(-3, 0, 6, 16);
        const bg = c.createLinearGradient(-s.w / 2, 0, s.w / 2, 0); bg.addColorStop(0, '#7a5422'); bg.addColorStop(0.35, '#e8b45a'); bg.addColorStop(0.6, '#c88a3a'); bg.addColorStop(1, '#5a3a18');
        c.fillStyle = bg; c.beginPath();
        c.moveTo(-16, -18); c.quadraticCurveTo(-20, -60, -s.w / 2 - 4, -s.h - 12); c.lineTo(s.w / 2 + 4, -s.h - 12); c.quadraticCurveTo(20, -60, 16, -18); c.quadraticCurveTo(0, -4, -16, -18); c.fill();
        c.strokeStyle = '#4a2e10'; c.lineWidth = 2; c.stroke();
        c.fillStyle = '#5a3a18'; c.fillRect(-s.w / 2 - 4, -s.h - 14, s.w + 8, 6);
        c.fillStyle = '#3a2410'; c.beginPath(); c.arc(Math.sin(this.time * 9) * this.bellRing * 8, -s.h - 18, 7, 0, TAU); c.fill();
        c.restore();
        if (this.bellRing > 0.05) { c.strokeStyle = `rgba(255, 230, 160, ${Math.min(0.6, this.bellRing * 0.5)})`; c.lineWidth = 2; for (let r = 1; r <= 3; r++) { c.beginPath(); c.arc(cx, s.y + s.h / 2, s.w * 0.6 + r * 14 + (this.time * 60) % 14, 0, TAU); c.stroke(); } }
        return;
      }
      case 'ridge': {
        c.fillStyle = '#7a3a34'; c.beginPath(); c.moveTo(s.x - 140, s.y - 60); c.lineTo(s.x, s.y); c.lineTo(s.x + s.w, s.y); c.lineTo(s.x + s.w + 140, s.y - 60); c.lineTo(s.x + s.w + 140, s.y - 90); c.lineTo(s.x - 140, s.y - 90); c.fill();
        c.fillStyle = '#9a4a40'; c.fillRect(s.x, s.y, s.w, s.h);
        c.fillStyle = '#c46a58'; c.fillRect(s.x, s.y + s.h - 4, s.w, 4);
        for (let x = s.x + 6; x < s.x + s.w; x += 14) { c.fillStyle = 'rgba(0,0,0,0.2)'; c.fillRect(x, s.y + 2, 1.5, s.h - 6); }
        return;
      }
    }
  }
  private strawBeam(s: Solid, shake: number) {
    const c = this.c;
    c.save(); c.translate(shake, 0);
    c.fillStyle = '#d6a848'; c.fillRect(s.x, s.y, s.w, s.h);
    c.strokeStyle = '#f2d27a'; c.lineWidth = 1.2;
    for (let x = s.x + 2; x < s.x + s.w - 2; x += 3) { c.beginPath(); c.moveTo(x, s.y + 1); c.lineTo(x + 2 * (hash(x) - 0.5) * 3, s.y + s.h + 2 * hash(x * 3)); c.stroke(); }
    c.fillStyle = '#9a6a24'; c.fillRect(s.x + s.w * 0.25, s.y, 2, s.h); c.fillRect(s.x + s.w * 0.75, s.y, 2, s.h);
    c.restore();
  }
  private hay(x: number, y: number, w: number, h: number, seed: number, twine: boolean) {
    const c = this.c;
    c.fillStyle = '#d9a843'; c.fillRect(x, y, w, h);
    c.fillStyle = '#eec66a'; c.fillRect(x, y + h - 4, w, 4);
    c.strokeStyle = 'rgba(140, 90, 20, 0.55)'; c.lineWidth = 1;
    for (let i = 0; i < w * h / 70; i++) { const px = x + hash(seed * 31 + i) * w, py = y + hash(seed * 17 + i * 3) * h, a = (hash(i * 7 + seed) - 0.5) * 1.2; c.beginPath(); c.moveTo(px, py); c.lineTo(px + Math.cos(a) * 6, py + Math.sin(a) * 6); c.stroke(); }
    c.strokeStyle = '#f7da8a'; for (let i = 0; i < w / 6; i++) { const px = x + hash(seed + i * 5) * w; c.beginPath(); c.moveTo(px, y + h); c.lineTo(px + (hash(i) - 0.5) * 6, y + h + 3); c.stroke(); }
    if (twine) { c.fillStyle = '#8a4a2a'; c.fillRect(x + w * 0.3, y, 2, h); c.fillRect(x + w * 0.7, y, 2, h); }
    c.strokeStyle = 'rgba(110, 70, 20, 0.6)'; c.lineWidth = 1.5; c.strokeRect(x, y, w, h);
  }
  private drawTub(x: number, y: number, used: boolean, hard: boolean, rolling: boolean) {
    const c = this.c;
    // dust heaped in it, a soft glow once it's your checkpoint
    if (used && !hard) { const gl = c.createRadialGradient(x, y + 14, 4, x, y + 14, 50); gl.addColorStop(0, 'rgba(255, 240, 200, 0.35)'); gl.addColorStop(1, 'rgba(255, 240, 200, 0)'); c.fillStyle = gl; c.beginPath(); c.arc(x, y + 14, 50, 0, TAU); c.fill(); }
    c.fillStyle = '#8a5a34'; c.beginPath(); c.moveTo(x - 30, y + 18); c.lineTo(x + 30, y + 18); c.lineTo(x + 24, y); c.lineTo(x - 24, y); c.fill();
    c.fillStyle = '#6a4024'; c.fillRect(x - 31, y + 15, 62, 4); c.fillRect(x - 27, y + 3, 54, 3);
    if (!hard) { c.fillStyle = '#e8dcc2'; c.beginPath(); c.ellipse(x, y + 18, 28, 4 + (rolling ? 2 * Math.sin(this.time * 12) : 0), 0, 0, TAU); c.fill(); }
    else { c.fillStyle = '#6a4024'; c.beginPath(); c.ellipse(x, y + 18, 28, 3, 0, 0, TAU); c.fill(); }
    if (used && !hard) { c.fillStyle = '#fff2c8'; c.beginPath(); c.arc(x + 22, y + 30 + 2 * Math.sin(this.time * 3), 3, 0, TAU); c.fill(); }
  }
  acorn(x: number, y: number, s: number) {
    const c = this.c;
    const gl = c.createRadialGradient(x, y, 1, x, y, 16 * s); gl.addColorStop(0, 'rgba(255, 230, 140, 0.5)'); gl.addColorStop(1, 'rgba(255, 230, 140, 0)');
    c.fillStyle = gl; c.beginPath(); c.arc(x, y, 16 * s, 0, TAU); c.fill();
    c.fillStyle = '#b8743a'; c.beginPath(); c.ellipse(x, y - 1 * s, 5 * s, 6 * s, 0, 0, TAU); c.fill();
    c.fillStyle = '#7a4a22'; c.beginPath(); c.ellipse(x, y + 4 * s, 6 * s, 3.2 * s, 0, 0, TAU); c.fill();
    c.fillRect(x - 0.8 * s, y + 6 * s, 1.6 * s, 3 * s);
    c.fillStyle = 'rgba(255,255,255,0.55)'; c.beginPath(); c.ellipse(x - 2 * s, y - 2 * s, 1.4 * s, 2.2 * s, 0, 0, TAU); c.fill();
  }
  private owl(x: number, y: number, s: { noise: number; state: string; t: number }) {
    const c = this.c, awake = s.state === 'wake' || s.state === 'flap', half = s.state === 'stir';
    const flap = s.state === 'flap' ? Math.sin(this.time * 30) : 0, puff = awake ? 1.15 : 1, breathe = Math.sin(this.time * 1.6) * 0.8;
    c.save(); c.translate(x, y);
    // wings
    c.fillStyle = '#a07a52';
    for (const d of [-1, 1]) { c.save(); c.scale(d, 1); c.rotate(-0.2 - (awake ? 0.6 + flap * 0.9 : 0)); c.beginPath(); c.ellipse(13, 20, 8, 18 * puff, 0.3, 0, TAU); c.fill(); c.restore(); }
    // body and face
    c.fillStyle = '#c49a6a'; c.beginPath(); c.ellipse(0, 22 + breathe, 16 * puff, 22 * puff, 0, 0, TAU); c.fill();
    c.fillStyle = '#f4ead8'; c.beginPath(); c.ellipse(0, 31 + breathe, 13 * puff, 12 * puff, 0, 0, TAU); c.fill();
    c.strokeStyle = '#c49a6a'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(0, 42 + breathe); c.lineTo(0, 22); c.stroke();
    // eyes: shut, half or wide
    const ey = 33 + breathe;
    for (const d of [-1, 1]) {
      if (awake) { c.fillStyle = '#1a1208'; c.beginPath(); c.arc(d * 5.5, ey, 4.2, 0, TAU); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(d * 5.5 + 1, ey + 1.5, 1.3, 0, TAU); c.fill(); }
      else if (half) { c.fillStyle = '#1a1208'; c.beginPath(); c.ellipse(d * 5.5, ey, 4, 1.8, 0, 0, TAU); c.fill(); }
      else { c.strokeStyle = '#3a2a1a'; c.lineWidth = 1.5; c.beginPath(); c.arc(d * 5.5, ey + 1, 3.2, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); }
    }
    c.fillStyle = '#e8a040'; c.beginPath(); c.moveTo(-2, 29 + breathe); c.lineTo(2, 29 + breathe); c.lineTo(0, 24 + breathe); c.fill();
    c.fillStyle = '#e8a040'; c.fillRect(-7, -1, 4, 3); c.fillRect(3, -1, 4, 3);
    c.restore();
    // sleeping z's, or how close she is to waking
    if (s.state === 'sleep') {
      c.save(); c.scale(1, -1); c.fillStyle = 'rgba(255, 255, 255, 0.7)'; c.font = 'bold 12px ui-rounded, system-ui, sans-serif';
      for (let i = 0; i < 3; i++) { const t = (this.time * 0.5 + i / 3) % 1; c.globalAlpha = (1 - t) * 0.8; c.fillText('z', x + 12 + t * 16, -(y + 46 + t * 26)); }
      c.restore(); c.globalAlpha = 1;
    }
    if (s.noise > 0.05 && s.state !== 'calm' && s.state !== 'flap') {
      const k = Math.min(1, s.noise / OWL.wake);
      c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 4; c.beginPath(); c.arc(x, y + 24, 30, Math.PI * 0.75, Math.PI * 2.25); c.stroke();
      c.strokeStyle = k > OWL.stir ? '#ff7a5a' : '#ffd36a'; c.lineWidth = 3; c.beginPath(); c.arc(x, y + 24, 30, Math.PI * 2.25 - k * Math.PI * 1.5, Math.PI * 2.25); c.stroke();
    }
  }
  private vane(x: number, y: number) {
    const c = this.c, a = Math.sin(this.time * 0.7) * 0.25;
    c.strokeStyle = '#3a3a40'; c.lineWidth = 3; c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 90); c.stroke();
    c.lineWidth = 2; c.beginPath(); c.moveTo(x - 24, y + 54); c.lineTo(x + 24, y + 54); c.moveTo(x, y + 42); c.lineTo(x, y + 66); c.stroke();
    c.save(); c.translate(x, y + 90); c.scale(Math.cos(a), 1);
    c.fillStyle = '#2e2e34';
    c.beginPath(); c.moveTo(-26, 0); c.lineTo(-14, 6); c.lineTo(-8, 22); c.lineTo(4, 14); c.lineTo(14, 26); c.lineTo(20, 16); c.lineTo(28, 14); c.lineTo(18, 6); c.lineTo(20, 0); c.closePath(); c.fill();
    c.fillStyle = '#d04030'; c.beginPath(); c.moveTo(12, 26); c.lineTo(16, 32); c.lineTo(20, 26); c.fill();
    c.restore();
    c.fillStyle = '#2e2e34'; c.beginPath(); c.arc(x, y + 90, 3, 0, TAU); c.fill();
  }
  private boards(L: (typeof LOOK)[SectionId]) {
    let b = this.boardCache.get(L.wood); if (b) return b;
    b = mk(64, 16); const c = ctx2(b);
    c.fillStyle = L.wood; c.fillRect(0, 0, 64, 16);
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(31, 0, 2, 16); c.fillRect(63, 0, 1, 16);
    c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(0, 4, 64, 1); c.fillRect(0, 10, 64, 1);
    this.boardCache.set(L.wood, b); return b;
  }

  // ---------------------------------------------------------------- the rope and the climbers
  private drawRope(g: RopeclimbGame, alpha: number) {
    const c = this.c, n = g.rx.length - 1, d = g.dora, e = g.enzo;
    const pts: [number, number][] = [];
    for (let i = 0; i <= n; i++) {
      let x = g.rx[i], y = g.ry[i];
      if (i === 0) { x = lerp(d.px, d.x, alpha); y = lerp(d.py, d.y, alpha) + BODY.waist; }
      else if (i === n) { x = lerp(e.px, e.x, alpha); y = lerp(e.py, e.y, alpha) + BODY.waist; }
      else { x = lerp(g.rpx[i], g.rx[i], alpha); y = lerp(g.rpy[i], g.ry[i], alpha); }
      pts.push([x, y]);
    }
    // a fresh catch makes the rope thrum
    if (this.twang > 0.02) {
      const dx = pts[n][0] - pts[0][0], dy = pts[n][1] - pts[0][1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
      for (let i = 1; i < n; i++) { const w = Math.sin(this.time * 70) * this.twang * 4 * Math.sin(Math.PI * i / n); pts[i][0] += nx * w; pts[i][1] += ny * w; }
    }
    const path = () => {
      c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < n; i++) { const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2; c.quadraticCurveTo(pts[i][0], pts[i][1], mx, my); }
      c.lineTo(pts[n][0], pts[n][1]);
    };
    const taut = clamp((g.tension - 0.9) * 10, 0, 1);
    c.lineCap = 'round'; c.lineJoin = 'round';
    path(); c.strokeStyle = '#5a3a1a'; c.lineWidth = 4.2; c.stroke();
    path(); c.strokeStyle = taut > 0.5 ? '#e8c890' : '#c8a064'; c.lineWidth = 2.6; c.stroke();
    // the twist of the braid
    path(); c.strokeStyle = 'rgba(90, 58, 26, 0.55)'; c.lineWidth = 2.6; c.setLineDash([2, 4]); c.lineDashOffset = 0; c.stroke(); c.setLineDash([]);
    // the knots at each belt
    for (const [x, y] of [pts[0], pts[n]]) { c.fillStyle = '#7a4a22'; c.beginPath(); c.arc(x, y, 2.6, 0, TAU); c.fill(); }
  }

  private pose(g: RopeclimbGame, c: Climber): Pose {
    const j = this.juice[c.who];
    if (g.phase === 'won' || j.cheer > 0 || c.mode === 'roll') return 'cheer';
    if (c.mode === 'grip') return 'grip';
    if (c.mode === 'stand') return c.charging && c.charge > 0.05 ? 'charge' : 'idle';
    const o = g.c(c.who === 'dora' ? 'enzo' : 'dora'), onRope = g.tension > 0.96 && o.y > c.y;
    if (onRope) return Math.abs(c.vx) > 60 ? 'swing' : 'dangle';
    return c.vy > -60 ? 'leap' : 'swing';
  }

  private drawClimber(g: RopeclimbGame, cl: Climber, alpha: number, active: boolean) {
    const c = this.c, j = this.juice[cl.who];
    let x = lerp(cl.px, cl.x, alpha), y = lerp(cl.py, cl.y, alpha);
    const pose = this.pose(g, cl);
    if (cl.mode === 'roll') { x += Math.sin(this.time * 9 + (cl.who === 'dora' ? 0 : 2)) * 8; y += Math.abs(Math.sin(this.time * 7 + (cl.who === 'dora' ? 0 : 1))) * 12 + 6; }
    // squash and stretch: crouch while charging, squash on landing, stretch through the air
    let sy = 1, sx = 1;
    if (cl.mode === 'stand' && cl.charging) { sy -= cl.charge * 0.22; sx += cl.charge * 0.12; if (cl.charge >= 1) x += Math.sin(this.time * 60) * 0.6; }
    sy -= j.land; sx += j.land * 0.7;
    if (cl.mode === 'air') { const st = clamp(Math.abs(cl.vy) / 1200, 0, 0.18); sy += st; sx -= st * 0.6; }
    sy -= j.squash * 0.4; sx += j.squash * 0.25;
    sy = clamp(sy, 0.55, 1.4); sx = clamp(sx, 0.7, 1.5);
    // lean along the rope when hanging on it, and with the flight
    let tilt = 0;
    if (pose === 'dangle' || pose === 'swing') { const o = g.c(cl.who === 'dora' ? 'enzo' : 'dora'); tilt = Math.atan2(o.x - cl.x, o.y - cl.y) * 0.8; }
    else if (cl.mode === 'air') tilt = clamp(-cl.vx / 900, -0.4, 0.4) * (cl.vy > 0 ? 1 : 0.5);
    j.tilt = lerp(j.tilt, tilt, 0.25);
    // the active climber gets a soft ring at their feet
    if (active) {
      c.fillStyle = cl.who === 'dora' ? 'rgba(255, 120, 130, 0.35)' : 'rgba(120, 170, 255, 0.35)';
      c.beginPath(); c.ellipse(x, y + 1, 14 + Math.sin(this.time * 5) * 1.5, 3.5, 0, 0, TAU); c.fill();
    }
    const face = cl.face, img = this.img(`${cl.who}-${pose}`) ?? (STAND_IN[pose] ? this.img(`${cl.who}-${STAND_IN[pose]}`) : null);
    c.save(); c.translate(x, y); c.rotate(-j.tilt); c.scale(sx, sy);
    if (img) {
      c.scale(face, -1);
      const h = SPRITE_H, w = h * img.naturalWidth / img.naturalHeight;
      // painted poses face right with their feet at the bottom middle
      const lift = pose === 'grip' ? -6 : pose === 'dangle' ? -12 : 0;
      c.drawImage(img, -w / 2 + (pose === 'grip' ? -4 : 0), -h + lift + 3, w, h);
    } else {
      c.scale(1, -1);
      this.fallbackPose(cl, pose, j);
    }
    c.restore();
    // charge ring and claw strain
    if (active && cl.charging && cl.charge > 0.02) {
      const r = 20, k = cl.charge;
      c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.arc(x, y + 10, r, 0, TAU); c.stroke();
      c.strokeStyle = k >= 1 ? `hsl(${45 + 15 * Math.sin(this.time * 20)}, 100%, 60%)` : '#ffe08a'; c.beginPath(); c.arc(x, y + 10, r, Math.PI / 2, Math.PI / 2 - k * TAU, true); c.stroke();
    }
    if (cl.strain > 0.05) {
      c.lineWidth = 2.5; c.strokeStyle = cl.strain > 0.7 ? `rgba(255, 80, 70, ${0.6 + 0.4 * Math.sin(this.time * 18)})` : 'rgba(255, 170, 80, 0.85)';
      c.beginPath(); c.arc(x, y + 10, 15, Math.PI / 2, Math.PI / 2 - (1 - cl.strain) * TAU, true); c.stroke();
    }
    // who you're steering (1 player): a little marker over their head
    if (active) {
      const my = y + 36 + Math.sin(this.time * 4) * 2;
      c.fillStyle = cl.who === 'dora' ? '#ff8a96' : '#8ab4ff'; c.strokeStyle = '#2a1a10'; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(x - 6, my + 8); c.lineTo(x + 6, my + 8); c.lineTo(x, my); c.closePath(); c.fill(); c.stroke();
    }
  }
  /** The shared drawn chinchilla, posed by squashing and turning it, until the paintings load. */
  private fallbackPose(cl: Climber, pose: Pose, j: Juice) {
    const c = this.c, blink = j.blink > 0;
    c.save();
    if (pose === 'grip') { c.rotate(cl.face * -1.2); c.translate(0, 4); }
    if (pose === 'dangle') { c.translate(0, 8); c.rotate(cl.face * 0.5); }
    if (pose === 'cheer') c.translate(0, -Math.abs(Math.sin(this.time * 8)) * 4);
    drawChinchilla(c, cl.who, 0, 2, { face: cl.face, h: 26, time: this.time, run: this.time * 14, moving: cl.mode === 'stand' && Math.abs(cl.vx) > 5, air: cl.mode === 'air' || pose === 'grip', blink });
    c.restore();
    // the belt the rope ties to
    c.fillStyle = cl.who === 'dora' ? '#d8423a' : '#3a6ad8'; c.fillRect(-7, -9, 14, 3);
  }

  /** A faint dotted arc of where a leap at this charge and aim would fly (the rope may stop it sooner). */
  private drawAim(g: RopeclimbGame, cl: Climber) {
    if (!cl.charging || cl.charge < 0.02) return;
    const c = this.c, ch = cl.charge, v = Math.sqrt(JUMP.min * JUMP.min + (JUMP.max * JUMP.max - JUMP.min * JUMP.min) * ch), th = cl.aim * JUMP.tilt;
    const vx = v * Math.sin(th), vy = v * Math.cos(th);
    c.fillStyle = 'rgba(255, 245, 210, 0.75)';
    for (let i = 2; i < 16; i++) {
      const t = i * 0.045, x = cl.x + vx * t, y = cl.y + 8 + vy * t - G * t * t / 2;
      c.globalAlpha = 0.75 * (1 - i / 16); c.beginPath(); c.arc(x, y, 2.2, 0, TAU); c.fill();
    }
    c.globalAlpha = 1;
  }

  private drawParticles(dt: number) {
    const c = this.c;
    for (const p of this.parts) {
      p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.kind === 'dust') { p.vx *= Math.pow(0.1, dt); p.vy *= Math.pow(0.3, dt); p.size += dt * 6; }
      else if (p.kind === 'feather') { p.vx *= Math.pow(0.2, dt); p.vy = p.vy * Math.pow(0.2, dt) - 30 * dt; }
      else if (p.kind === 'straw') p.vy -= 400 * dt;
      else if (p.kind === 'spark') { p.vx *= Math.pow(0.05, dt); p.vy *= Math.pow(0.05, dt); }
      const a = clamp(p.life / p.max, 0, 1);
      c.globalAlpha = p.kind === 'dust' ? a * 0.6 : a;
      c.fillStyle = p.color;
      if (p.kind === 'straw') { c.save(); c.translate(p.x, p.y); c.rotate(p.life * 6); c.fillRect(-p.size, -0.6, p.size * 2, 1.2); c.restore(); }
      else if (p.kind === 'feather') { c.save(); c.translate(p.x, p.y); c.rotate(Math.sin(p.life * 4) * 0.8); c.beginPath(); c.ellipse(0, 0, p.size, p.size * 0.35, 0, 0, TAU); c.fill(); c.restore(); }
      else if (p.kind === 'note') { c.save(); c.translate(p.x, p.y); c.scale(1, -1); c.font = 'bold 14px ui-rounded, system-ui'; c.fillText('?', 0, 0); c.restore(); }
      else { c.beginPath(); c.arc(p.x, p.y, p.size, 0, TAU); c.fill(); }
    }
    c.globalAlpha = 1;
    this.parts = this.parts.filter((p) => p.life > 0);
    if (this.parts.length > 400) this.parts.splice(0, this.parts.length - 400);
  }

  /** The section's light over everything: a warm glow, a tint, a flash after a bonk, the sunset on the roof. */
  private grade(sec: SectionId, g: RopeclimbGame) {
    const c = this.c, L = LOOK[sec];
    c.fillStyle = L.tint; c.fillRect(0, 0, this.W, this.H);
    const gl = c.createRadialGradient(this.W / 2, -this.H * 0.2, 10, this.W / 2, -this.H * 0.2, this.H * 1.2); gl.addColorStop(0, L.glow); gl.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = gl; c.fillRect(0, 0, this.W, this.H);
    const v = c.createRadialGradient(this.W / 2, this.H / 2, Math.min(this.W, this.H) * 0.45, this.W / 2, this.H / 2, Math.max(this.W, this.H) * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(20, 10, 5, 0.35)');
    c.fillStyle = v; c.fillRect(0, 0, this.W, this.H);
    if (this.flash > 0) { c.fillStyle = `rgba(255, 240, 200, ${this.flash * 0.5})`; c.fillRect(0, 0, this.W, this.H); }
    void g;
  }
  /** Behind the menu: the cellar, gently. */
  private drawIdle() {
    const c = this.c, L = LOOK.hayloft;
    const g0 = c.createLinearGradient(0, 0, 0, this.H); g0.addColorStop(0, L.top); g0.addColorStop(1, L.bottom);
    c.fillStyle = g0; c.fillRect(0, 0, this.W, this.H);
  }
}

// ---------------------------------------------------------------- stand-ins for the paintings
/** The title painting's stand-in: the pair mid-climb in a golden barn. */
export function paintTitle(cv: HTMLCanvasElement, t = 0.4) {
  const c = ctx2(cv), W = cv.width, H = cv.height;
  const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#f4b860'); g.addColorStop(0.5, '#c07a3a'); g.addColorStop(1, '#5a3420');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  // light from a high window
  c.fillStyle = 'rgba(255, 240, 200, 0.25)'; c.beginPath(); c.moveTo(W * 0.62, 0); c.lineTo(W * 0.78, 0); c.lineTo(W * 0.5, H); c.lineTo(W * 0.2, H); c.fill();
  for (let x = 0; x < W; x += W / 14) { c.fillStyle = 'rgba(60, 30, 10, 0.25)'; c.fillRect(x, 0, 3, H); }
  const beam = (x: number, y: number, w: number) => { c.fillStyle = '#7a4e2c'; c.fillRect(x, y, w, H * 0.03); c.fillStyle = '#b07a48'; c.fillRect(x, y, w, H * 0.008); };
  beam(W * 0.5, H * 0.22, W * 0.4); beam(W * 0.08, H * 0.52, W * 0.36); beam(0, H * 0.86, W);
  c.fillStyle = '#6a4024'; c.fillRect(W * 0.3, H * 0.52, W * 0.025, H * 0.34);
  // hay
  c.fillStyle = '#e0b04a'; c.fillRect(W * 0.72, H * 0.62, W * 0.2, H * 0.24); c.fillRect(W * 0.04, H * 0.7, W * 0.16, H * 0.16);
  // the rope between them
  const dx = W * 0.58, dy = H * 0.3, ex = W * 0.3, ey = H * 0.6;
  c.strokeStyle = '#5a3a1a'; c.lineWidth = W * 0.008; c.beginPath(); c.moveTo(dx, dy); c.quadraticCurveTo(W * 0.42, H * 0.6, ex + W * 0.02, ey); c.stroke();
  c.strokeStyle = '#d8b070'; c.lineWidth = W * 0.005; c.stroke();
  c.save(); c.translate(dx, dy + H * 0.05); c.rotate(-0.4); drawChinchilla(c, 'dora', 0, 0, { face: 1, h: H * 0.2, time: t, air: true }); c.restore();
  c.save(); c.translate(ex, ey + H * 0.1); c.rotate(-1.1); drawChinchilla(c, 'enzo', 0, 0, { face: 1, h: H * 0.2, time: t, air: true }); c.restore();
  const v = c.createLinearGradient(0, H * 0.6, 0, H); v.addColorStop(0, 'rgba(40, 20, 10, 0)'); v.addColorStop(1, 'rgba(40, 20, 10, 0.5)');
  c.fillStyle = v; c.fillRect(0, 0, W, H);
}
/** The ending's stand-in: the pair on the ridge under the weathervane at dawn. */
export function paintEnding(cv: HTMLCanvasElement, t = 0.4) {
  const c = ctx2(cv), W = cv.width, H = cv.height;
  const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#6a7ac8'); g.addColorStop(0.45, '#f4a8a0'); g.addColorStop(0.7, '#ffd890'); g.addColorStop(1, '#8aa070');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.fillStyle = 'rgba(255, 240, 200, 0.9)'; c.beginPath(); c.arc(W * 0.7, H * 0.66, H * 0.1, 0, TAU); c.fill();
  c.fillStyle = '#7aa068'; c.beginPath(); c.moveTo(0, H * 0.72); for (let x = 0; x <= W; x += W / 8) c.lineTo(x, H * (0.7 + 0.04 * Math.sin(x / W * 9))); c.lineTo(W, H); c.lineTo(0, H); c.fill();
  c.fillStyle = '#8a3a34'; c.beginPath(); c.moveTo(W * 0.05, H); c.lineTo(W * 0.5, H * 0.72); c.lineTo(W * 0.95, H); c.fill();
  c.strokeStyle = '#2e2e34'; c.lineWidth = W * 0.006; c.beginPath(); c.moveTo(W * 0.5, H * 0.72); c.lineTo(W * 0.5, H * 0.3); c.stroke();
  c.fillStyle = '#2e2e34'; c.beginPath(); c.moveTo(W * 0.46, H * 0.3); c.lineTo(W * 0.56, H * 0.27); c.lineTo(W * 0.53, H * 0.22); c.lineTo(W * 0.49, H * 0.25); c.fill();
  drawChinchilla(c, 'dora', W * 0.42, H * 0.77, { face: 1, h: H * 0.18, time: t });
  drawChinchilla(c, 'enzo', W * 0.58, H * 0.77, { face: -1, h: H * 0.18, time: t });
  c.strokeStyle = '#d8b070'; c.lineWidth = W * 0.004; c.beginPath(); c.moveTo(W * 0.44, H * 0.73); c.quadraticCurveTo(W * 0.5, H * 0.8, W * 0.56, H * 0.73); c.stroke();
}
