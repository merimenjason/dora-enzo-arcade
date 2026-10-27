// Kit Parade's world in Canvas 2D: the painted sky of each world, the dig-able ground cut from painted textures, the
// burrows with Dora and Enzo waiting at home, lily pads, seesaws, chimney fans, dust puffs, and the parade of baby kits
// with their job bubbles, dust, hay bits, hearts and little "wheee!"s. Drawing only: the rules live in parade-game.ts.
import { drawChinchilla, coatLike, type Coat } from './chinchilla-art';
import { EARTH, HAY_L, HAY_R, STONE, BELT_L, BELT_R, BALE, TILE, KIT_H, JOB_INFO, HOME_TICKS, type Job, type Kit, type ParadeEvent, type ParadeGame } from './parade-game';

const FONT = 'ui-rounded, "Trebuchet MS", "Segoe UI", system-ui, sans-serif';
/** Texture resolution: painted ground is drawn at this many pixels per world pixel. */
const RES = 4;
const WORLD_IDS = ['meadow', 'pantry', 'cave', 'roofs'] as const;
type Look = { sky: [string, string]; earth: [string, string]; top: string; edge: string; far: string; water: string };
const LOOKS: Look[] = [
  { sky: ['#8fd3f4', '#e6f7ff'], earth: ['#9b6a43', '#7e5233'], top: '#6cbf4f', edge: 'rgba(70,40,20,.55)', far: '#a9dc8f', water: '#5fb7e0' },
  { sky: ['#f5d2a0', '#fff1dc'], earth: ['#c8904f', '#a8733b'], top: '#f3d38a', edge: 'rgba(90,50,20,.55)', far: '#e2b47c', water: '#78c0d8' },
  { sky: ['#264a5e', '#4f7f8f'], earth: ['#6f8296', '#566779'], top: '#7fd0b4', edge: 'rgba(20,30,40,.6)', far: '#355f70', water: '#3fa7c9' },
  { sky: ['#141a46', '#3d3f86'], earth: ['#a0614a', '#7f4a39'], top: '#7f9fd8', edge: 'rgba(15,10,30,.6)', far: '#232a63', water: '#4f7fd0' },
];
/** Baby coats for the parade: every kit gets its own. */
const KIT_COATS: Coat[] = [
  coatLike('dora', {}),
  coatLike('enzo', { fur: '#9c9aa4', back: '#7a7882', face: '#b4b2bc' }),
  coatLike('dora', { fur: '#f2e2cc', back: '#e2cbac', face: '#f7ecdc', tail: '#efe0c8' }),
  coatLike('enzo', {}),
  coatLike('enzo', { fur: '#c9c2bb', back: '#a59d96', face: '#d8d2cb', tail: '#bdb6ae' }),
  coatLike('dora', { fur: '#e8d2b0', back: '#d0b38a', face: '#f0dcc0', tail: '#e2c9a2' }),
  coatLike('enzo', { fur: '#5e5a57', back: '#45413e', face: '#78736f', tail: '#5a5653' }),
  coatLike('dora', { fur: '#fbf4ea', back: '#efe2d0', eye: '#2a1810', pupil: '#000' }),
];
const JOB_OF: Partial<Record<Kit['state'], Job>> = { stop: 'stopper', dig: 'digger', tunnel: 'tunneller', build: 'builder', puff: 'bouncer', hug: 'hugger', climb: 'climber', glide: 'glider' };

type Bit = { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number; kind: 'dot' | 'heart' | 'star' | 'drop' };
type Pop = { x: number; y: number; text: string; color: string; born: number };
type Lift = { x: number; y: number; born: number; coat: number };

export type View = { hover: number; job: Job | null; canHover: boolean };

export class ParadeScene {
  private c: CanvasRenderingContext2D;
  w = 0; h = 0; private dpr = 1;
  /** Camera: the world pixel at the top-left of the play area, and screen pixels per world pixel. */
  cam = { x: 0, y: 0 }; scale = 3;
  /** Screen space kept clear for the HUD above and the job bar below. */
  insets = { top: 64, bottom: 96 };
  private img = new Map<string, HTMLImageElement>();
  private fallbacks = new Map<string, HTMLCanvasElement>();
  private terr: HTMLCanvasElement | null = null;
  private small: HTMLCanvasElement | null = null;
  private layer: HTMLCanvasElement | null = null;
  private terrFor: { game: ParadeGame | null; version: number } = { game: null, version: -1 };
  private bits: Bit[] = [];
  private pops: Pop[] = [];
  private lifts: Lift[] = [];
  private cheer = -9;
  private clock = 0;
  private world = 0;

  constructor(private canvas: HTMLCanvasElement) {
    const c = canvas.getContext('2d'); if (!c) throw new Error('no 2d');
    this.c = c; this.resize();
    const names = ['burrow-in', 'burrow-home', 'parent-dora', 'parent-enzo', 'mum-carry', 'lilypad', 'seesaw', 'fan', 'puff', 'stone', 'hay', 'bale', ...WORLD_IDS.map((w) => `bg-${w}`), ...WORLD_IDS.map((w) => `earth-${w}`), ...Object.keys(JOB_INFO).map((j) => `job-${j}`)];
    for (const n of names) {
      const i = new Image(); i.decoding = 'async'; i.src = `/art/parade/${n}.webp`;
      i.onload = () => { this.terrFor.version = -1; };
      this.img.set(n, i);
    }
  }
  /** A painting once it has loaded, or null so the drawn stand-in is used. */
  private art(name: string) { const i = this.img.get(name); return i && i.complete && i.naturalWidth > 0 ? i : null; }
  resize() {
    const r = this.canvas.getBoundingClientRect(); this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = Math.max(300, r.width); this.h = Math.max(300, r.height);
    this.canvas.width = Math.round(this.w * this.dpr); this.canvas.height = Math.round(this.h * this.dpr);
    // phones stack the HUD in two rows; a short sideways screen has a slimmer job bar
    this.insets = this.w < 700 ? { top: 84, bottom: 84 } : { top: 60, bottom: this.h <= 500 ? 66 : 96 };
  }

  // ---- camera
  /** Fits a level to the screen: whole height when it can, and never so small that kits are hard to tap. */
  fit(g: ParadeGame, centre = true) {
    const availH = Math.max(120, this.h - this.insets.top - this.insets.bottom);
    this.scale = Math.max(1.5, Math.min(availH / g.H, Math.max(this.w / g.W, this.w < 640 ? 2.4 : 2.8), 6));
    if (centre) { this.cam.x = g.entrance.x - this.w / this.scale / 2; this.cam.y = 0; }
    this.clamp(g);
  }
  private clamp(g: ParadeGame) {
    const vw = this.w / this.scale, vh = (this.h - this.insets.top - this.insets.bottom) / this.scale;
    this.cam.x = g.W <= vw ? (g.W - vw) / 2 : Math.max(0, Math.min(g.W - vw, this.cam.x));
    this.cam.y = g.H <= vh ? (g.H - vh) / 2 : Math.max(0, Math.min(g.H - vh, this.cam.y));
  }
  pan(g: ParadeGame, dx: number, dy: number) { this.cam.x -= dx / this.scale; this.cam.y -= dy / this.scale; this.clamp(g); }
  /** Whether the level is bigger than the screen (so dragging pans it). */
  pannable(g: ParadeGame) { return g.W * this.scale > this.w + 1 || g.H * this.scale > this.h - this.insets.top - this.insets.bottom + 1; }
  toWorld(sx: number, sy: number) { return { x: sx / this.scale + this.cam.x, y: (sy - this.insets.top) / this.scale + this.cam.y }; }

  // ---- events from the game
  feed(events: ParadeEvent[], g: ParadeGame) {
    const now = this.clock;
    for (const e of events) {
      const k = g.kits[e.kit];
      if (e.kind === 'dig') this.spray(e.x, e.y - 2, LOOKS[this.world].earth[0], 4, 50);
      else if (e.kind === 'bale') this.spray(e.x, e.y - 2, '#f1d36b', 3, 40);
      else if (e.kind === 'hug') { for (let i = 0; i < 7; i++) this.bits.push({ x: e.x + Math.sin(i * 2.4) * 8, y: e.y - 8, vx: Math.sin(i * 1.7) * 14, vy: -26 - (i % 3) * 8, life: 0, max: 1.2, color: '#ff8fb1', size: 3, kind: 'heart' }); this.spray(e.x, e.y - 4, LOOKS[this.world].earth[0], 14, 90); this.pop(e.x, e.y - 18, 'big hug!', '#ff8fb1'); }
      else if (e.kind === 'bounce') { this.spray(e.x, e.y, '#f6eefc', 6, 40); this.pop(e.x, e.y - 16, 'wheee!', '#fff3a8'); }
      else if (e.kind === 'glide') this.pop(e.x, e.y - 14, 'wheee!', '#ffffff');
      else if (e.kind === 'puff') this.spray(e.x, e.y - 2, '#f6eefc', 10, 50);
      else if (e.kind === 'home') { this.cheer = now; this.spark(e.x, e.y - 8); this.pop(e.x, e.y - 20, 'home!', '#ffe27a'); }
      else if (e.kind === 'dizzy') this.pop(e.x, e.y - 16, 'oof, dizzy…', '#d8c8ff');
      else if (e.kind === 'splash') { for (let i = 0; i < 10; i++) this.bits.push({ x: e.x, y: e.y - 2, vx: Math.sin(i * 2.1) * 30, vy: -40 - (i % 4) * 10, life: 0, max: 0.7, color: '#bfe8ff', size: 1.6, kind: 'drop' }); this.pop(e.x, e.y - 14, 'splash!', '#bfe8ff'); }
      else if (e.kind === 'carried' && k) this.lifts.push({ x: e.x, y: e.y, born: now, coat: k.i });
      else if (e.kind === 'assign') this.spark(e.x, e.y - 8);
      else if (e.kind === 'done') this.cheer = now;
    }
    if (this.bits.length > 500) this.bits.splice(0, this.bits.length - 500);
    if (this.pops.length > 30) this.pops.splice(0, this.pops.length - 30);
  }
  private spray(x: number, y: number, color: string, n: number, sp: number) {
    for (let i = 0; i < n; i++) { const a = -Math.PI * ((i + 0.5) / n) + Math.sin(i * 7.7 + x) * 0.3; this.bits.push({ x, y, vx: Math.cos(a) * sp * (0.5 + (i % 3) * 0.25), vy: Math.sin(a) * sp, life: 0, max: 0.5 + (i % 3) * 0.15, color, size: 1 + (i % 2) * 0.6, kind: 'dot' }); }
  }
  private spark(x: number, y: number) {
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; this.bits.push({ x, y, vx: Math.cos(a) * 30, vy: Math.sin(a) * 30 - 10, life: 0, max: 0.6, color: i % 2 ? '#ffe27a' : '#ffffff', size: 1.6, kind: 'star' }); }
  }
  private pop(x: number, y: number, text: string, color: string) { this.pops.push({ x, y, text, color, born: this.clock }); }

  // ---- the ground
  /** A repeating texture on the given context: the painting if it has loaded, else a drawn stand-in (made once). */
  private pattern(ctx: CanvasRenderingContext2D, name: string, fallback: () => HTMLCanvasElement) {
    const painted = this.art(name);
    let src: CanvasImageSource | undefined = painted ?? this.fallbacks.get(name);
    if (!src) { const f = fallback(); this.fallbacks.set(name, f); src = f; }
    const p = ctx.createPattern(src, 'repeat')!;
    if (painted && p.setTransform) p.setTransform(new DOMMatrix().scale(0.5));
    return p;
  }
  /** A small drawn texture: two colours and soft speckles, so unpainted ground still looks like something. */
  private fallbackTex(base: string, dark: string, kind: 'earth' | 'stone' | 'hay' | 'bale') {
    const s = document.createElement('canvas'); s.width = 64; s.height = 64; const c = s.getContext('2d')!;
    c.fillStyle = base; c.fillRect(0, 0, 64, 64);
    const h = (n: number) => { const v = Math.sin(n * 12.9898) * 43758.5453; return v - Math.floor(v); };
    if (kind === 'stone') {
      for (let i = 0; i < 14; i++) { const x = h(i) * 64, y = h(i + 50) * 64, r = 6 + h(i + 9) * 7; for (const [dx, dy] of [[0, 0], [64, 0], [0, 64], [-64, 0], [0, -64]]) { c.fillStyle = i % 3 ? '#8a8f99' : '#9fa4ad'; c.beginPath(); c.ellipse(x + dx, y + dy, r, r * 0.8, h(i + 3) * 3, 0, Math.PI * 2); c.fill(); c.strokeStyle = 'rgba(40,40,55,.45)'; c.lineWidth = 1.5; c.stroke(); c.fillStyle = 'rgba(255,255,255,.25)'; c.beginPath(); c.ellipse(x + dx - r * 0.3, y + dy - r * 0.3, r * 0.3, r * 0.2, 0, 0, Math.PI * 2); c.fill(); } }
    } else if (kind === 'hay' || kind === 'bale') {
      for (let i = 0; i < 70; i++) { c.strokeStyle = i % 3 ? dark : '#fff3b5'; c.lineWidth = 1.2; const y = h(i) * 64, x = h(i + 7) * 64; c.beginPath(); c.moveTo(x - 10, y); c.lineTo(x + 10, y + (h(i + 2) - 0.5) * 4); c.stroke(); }
      if (kind === 'bale') { c.strokeStyle = '#9a6a2c'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, 32); c.lineTo(64, 32); c.stroke(); }
    } else {
      for (let i = 0; i < 60; i++) { c.fillStyle = i % 4 ? dark : 'rgba(255,255,255,.18)'; c.beginPath(); c.arc(h(i) * 64, h(i + 99) * 64, 1 + h(i + 5) * 2.6, 0, Math.PI * 2); c.fill(); }
    }
    return s;
  }
  private buildTerrain(g: ParadeGame) {
    const W = g.W, H = g.H, look = LOOKS[this.world];
    if (!this.terr || this.terr.width !== W * RES || this.terr.height !== H * RES) { this.terr = document.createElement('canvas'); this.terr.width = W * RES; this.terr.height = H * RES; }
    const t = this.terr.getContext('2d')!; t.clearRect(0, 0, W * RES, H * RES); t.imageSmoothingEnabled = false;
    if (!this.small || this.small.width !== W || this.small.height !== H) {
      this.small = document.createElement('canvas'); this.small.width = W; this.small.height = H;
      this.layer = document.createElement('canvas'); this.layer.width = W * RES; this.layer.height = H * RES;
    }
    const small = this.small, layer = this.layer!, sc = small.getContext('2d')!, lc = layer.getContext('2d')!; lc.imageSmoothingEnabled = false;
    const groups: [number[], CanvasPattern][] = [
      [[EARTH], this.pattern(lc, `earth-${WORLD_IDS[this.world]}`, () => this.fallbackTex(look.earth[0], look.earth[1], 'earth'))],
      [[STONE, BELT_L, BELT_R], this.pattern(lc, 'stone', () => this.fallbackTex('#7a808b', '#5b616c', 'stone'))],
      [[HAY_L, HAY_R], this.pattern(lc, 'hay', () => this.fallbackTex('#e2bf5c', '#b8913a', 'hay'))],
      [[BALE], this.pattern(lc, 'bale', () => this.fallbackTex('#f4d36a', '#c99d3c', 'bale'))],
    ];
    for (const [mats, pat] of groups) {
      const d = sc.createImageData(W, H);
      let any = false;
      for (let i = 0; i < W * H; i++) if (mats.includes(g.mask[i])) { d.data[i * 4 + 3] = 255; any = true; }
      if (!any) continue;
      sc.putImageData(d, 0, 0);
      lc.globalCompositeOperation = 'source-over'; lc.clearRect(0, 0, W * RES, H * RES);
      lc.drawImage(small, 0, 0, W * RES, H * RES);
      lc.globalCompositeOperation = 'source-in'; lc.fillStyle = pat; lc.fillRect(0, 0, W * RES, H * RES);
      t.drawImage(layer, 0, 0);
    }
    // grassy tops and inked edges
    const e = sc.createImageData(W, H), top = hex(look.top), ink = [60, 36, 24];
    const solid = (x: number, y: number) => x >= 0 && x < W && y >= 0 && y < H && g.mask[y * W + x] !== 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const m = g.mask[y * W + x]; if (!m) continue;
      const i = (y * W + x) * 4;
      if (!solid(x, y - 1) && (m === EARTH || m === HAY_L || m === HAY_R)) { e.data.set([...top, 255], i); }
      else if (!solid(x, y - 2) && m === EARTH) { e.data.set([...top, 150], i); }
      else if (!solid(x - 1, y) || !solid(x + 1, y) || !solid(x, y + 1) || !solid(x, y - 1)) { e.data.set([...ink, 120], i); }
    }
    sc.putImageData(e, 0, 0); t.drawImage(small, 0, 0, W * RES, H * RES);
    // arrows on one-way hay
    t.strokeStyle = 'rgba(255,255,255,.75)'; t.lineWidth = RES * 0.9; t.lineCap = 'round'; t.lineJoin = 'round';
    for (let ty = 0; ty < g.th; ty++) for (let tx = 0; tx < g.tw; tx++) {
      const m = g.mat(tx * TILE + 4, ty * TILE + 4); if (m !== HAY_L && m !== HAY_R) continue;
      const cx = (tx * TILE + 4) * RES, cy = (ty * TILE + 4) * RES, d = (m === HAY_L ? -1 : 1) * RES * 1.6;
      t.beginPath(); t.moveTo(cx - d, cy - RES * 2); t.lineTo(cx + d, cy); t.lineTo(cx - d, cy + RES * 2); t.stroke();
    }
    this.terrFor = { game: g, version: g.terrainVersion };
  }

  // ---- drawing
  /** Draws a frame: `alpha` is how far between two ticks we are, `dt` real seconds since the last frame. */
  draw(g: ParadeGame | null, alpha: number, dt: number, view: View) {
    this.clock += dt;
    const c = this.c, { w, h } = this;
    if (g) this.world = g.level.world;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.background(g);
    if (!g) return;
    if (this.terrFor.game !== g || this.terrFor.version !== g.terrainVersion) this.buildTerrain(g);
    const s = this.scale, ox = -this.cam.x * s, oy = this.insets.top - this.cam.y * s;
    c.setTransform(this.dpr * s, 0, 0, this.dpr * s, this.dpr * ox, this.dpr * oy);
    // a soft shadow under the whole level so it sits on the painting
    c.save(); c.fillStyle = 'rgba(0,0,0,.08)'; c.fillRect(0, g.H, g.W, 2); c.restore();
    this.fans(g);
    this.water(g, false);
    c.imageSmoothingEnabled = true;
    c.drawImage(this.terr!, 0, 0, g.W, g.H);
    this.belts(g);
    this.things(g);
    this.burrows(g);
    for (const k of g.kits) this.kit(g, k, alpha, view);
    this.water(g, true);
    this.effects(dt);
    if (view.hover >= 0 && g.kits[view.hover]) this.hover(g, g.kits[view.hover], alpha, view);
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    void w; void h;
  }

  private background(g: ParadeGame | null) {
    const c = this.c, { w, h } = this, look = LOOKS[this.world], bg = this.art(`bg-${WORLD_IDS[this.world]}`);
    if (bg) {
      const k = Math.max(w / bg.naturalWidth, h / bg.naturalHeight) * 1.08, iw = bg.naturalWidth * k, ih = bg.naturalHeight * k;
      const par = g ? Math.max(0, Math.min(1, this.cam.x / Math.max(1, g.W - w / this.scale))) : 0.5;
      c.drawImage(bg, -(iw - w) * par, (h - ih) * 0.4, iw, ih);
      return;
    }
    const grad = c.createLinearGradient(0, 0, 0, h); grad.addColorStop(0, look.sky[0]); grad.addColorStop(1, look.sky[1]);
    c.fillStyle = grad; c.fillRect(0, 0, w, h);
    const t = this.clock, drift = g ? -this.cam.x * 0.15 : 0;
    if (this.world === 3) {
      c.fillStyle = '#fff8d8'; c.beginPath(); c.arc(w * 0.78, h * 0.18, Math.min(w, h) * 0.08, 0, Math.PI * 2); c.fill();
      c.fillStyle = 'rgba(255,248,216,.12)'; c.beginPath(); c.arc(w * 0.78, h * 0.18, Math.min(w, h) * 0.14, 0, Math.PI * 2); c.fill();
      for (let i = 0; i < 70; i++) { const x = ((Math.sin(i * 91.7) + 1) / 2) * w, y = ((Math.sin(i * 47.3) + 1) / 2) * h * 0.6; c.fillStyle = `rgba(255,255,240,${0.4 + 0.4 * Math.sin(t * 2 + i)})`; c.fillRect(x, y, 2, 2); }
    } else if (this.world === 0) {
      c.fillStyle = '#fffbe6'; c.beginPath(); c.arc(w * 0.15, h * 0.16, Math.min(w, h) * 0.07, 0, Math.PI * 2); c.fill();
      for (let i = 0; i < 4; i++) { const x = ((i * 0.3 + t * 0.008) % 1.3) * w - 0.15 * w, y = h * (0.12 + i * 0.07); c.fillStyle = 'rgba(255,255,255,.85)'; for (const [dx, r] of [[0, 26], [24, 34], [52, 24]]) { c.beginPath(); c.arc(x + dx, y, r, 0, Math.PI * 2); c.fill(); } }
    } else if (this.world === 2) {
      for (let i = 0; i < 16; i++) { const x = ((Math.sin(i * 17.1) + 1) / 2) * w, y = ((Math.sin(i * 5.3) + 1) / 2) * h * 0.7; c.fillStyle = `rgba(160,255,220,${0.15 + 0.1 * Math.sin(t + i)})`; c.beginPath(); c.arc(x, y, 3 + (i % 4), 0, Math.PI * 2); c.fill(); }
    } else {
      c.fillStyle = 'rgba(120,70,30,.18)'; for (let i = 0; i < 4; i++) c.fillRect(0, h * (0.18 + i * 0.2), w, 10);
    }
    // far hills, shelves, rocks or roofs
    c.fillStyle = look.far; c.beginPath(); c.moveTo(0, h);
    for (let x = 0; x <= w + 40; x += 40) {
      const k = (x - drift) / w;
      const y = this.world === 3 ? h * 0.62 - (Math.floor(k * 9) % 2) * 40 - (Math.floor(k * 13) % 3) * 18 : this.world === 1 ? h * 0.55 - (Math.floor(k * 4) % 2) * 60 : h * 0.6 - Math.sin(k * 6) * 30 - Math.sin(k * 15) * 12;
      c.lineTo(x, y);
    }
    c.lineTo(w, h); c.closePath(); c.fill();
  }

  private water(g: ParadeGame, front: boolean) {
    const c = this.c, t = this.clock, look = LOOKS[this.world];
    for (let ty = 0; ty < g.th; ty++) for (let tx = 0; tx < g.tw; tx++) {
      if (!g.water[ty * g.tw + tx]) continue;
      const surface = ty === 0 || !g.water[(ty - 1) * g.tw + tx];
      const x = tx * TILE, y = ty * TILE;
      c.fillStyle = front ? 'rgba(90,170,220,.35)' : look.water; c.fillRect(x, y + (surface ? 1 : 0), TILE + 0.05, TILE + 0.05);
      if (surface && front) {
        c.strokeStyle = 'rgba(230,248,255,.8)'; c.lineWidth = 0.5; c.beginPath();
        for (let i = 0; i <= 8; i++) c.lineTo(x + i, y + 1 + Math.sin(t * 2.5 + (x + i) * 0.5) * 0.5);
        c.stroke();
      }
    }
  }
  private belts(g: ParadeGame) {
    const c = this.c, t = this.clock;
    c.strokeStyle = 'rgba(255,230,140,.9)'; c.lineWidth = 0.8; c.lineCap = 'round';
    for (let ty = 0; ty < g.th; ty++) for (let tx = 0; tx < g.tw; tx++) {
      const m = g.mat(tx * TILE + 4, ty * TILE + 1); if (m !== BELT_L && m !== BELT_R) continue;
      if (g.mat(tx * TILE + 4, ty * TILE - 1) === BELT_L || g.mat(tx * TILE + 4, ty * TILE - 1) === BELT_R) continue;
      const x = tx * TILE, y = ty * TILE, d = m === BELT_L ? -1 : 1;
      c.fillStyle = '#c9963f'; c.fillRect(x, y, TILE + 0.05, 2.4);
      c.fillStyle = '#7a5a2a'; c.fillRect(x, y + 2.4, TILE + 0.05, 0.6);
      const off = ((t * 25 * d) % 4 + 4) % 4;
      c.save(); c.beginPath(); c.rect(x, y, TILE, 2.4); c.clip();
      for (let i = -1; i < 3; i++) { const cx = x + i * 4 + off; c.beginPath(); c.moveTo(cx - d * 0.8, y + 0.5); c.lineTo(cx + d * 0.6, y + 1.2); c.lineTo(cx - d * 0.8, y + 1.9); c.stroke(); }
      c.restore();
    }
  }
  private fans(g: ParadeGame) {
    const c = this.c, t = this.clock;
    for (const f of g.fans) {
      // the breeze: soft rising streaks
      c.save(); c.beginPath(); c.rect(f.x, f.y, f.w, f.h); c.clip();
      const grad = c.createLinearGradient(0, f.y + f.h, 0, f.y); grad.addColorStop(0, 'rgba(255,255,255,.18)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = grad; c.fillRect(f.x, f.y, f.w, f.h);
      c.strokeStyle = 'rgba(255,255,255,.45)'; c.lineWidth = 0.6;
      for (let i = 0; i < f.w / 5; i++) {
        const x = f.x + 2 + i * 5 + Math.sin(t * 2 + i) * 1.2, y = f.y + f.h - ((t * 30 + i * 17) % f.h);
        c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 1.5, y - 4, x, y - 8); c.stroke();
      }
      c.restore();
      const fan = this.art('fan'), cx = f.x + f.w / 2, by = f.y + f.h;
      if (fan) c.drawImage(fan, cx - f.w * 0.45, by - f.w * 0.45, f.w * 0.9, f.w * 0.45);
      else {
        c.fillStyle = '#9b5b45'; c.fillRect(cx - f.w * 0.35, by - 4, f.w * 0.7, 4);
        c.save(); c.translate(cx, by - 5); c.scale(1, 0.35); c.rotate(t * 12);
        c.fillStyle = '#e8e2f2'; for (let i = 0; i < 4; i++) { c.rotate(Math.PI / 2); c.beginPath(); c.ellipse(0, -f.w * 0.17, f.w * 0.07, f.w * 0.17, 0, 0, Math.PI * 2); c.fill(); }
        c.restore();
      }
    }
  }
  private things(g: ParadeGame) {
    const c = this.c, t = this.clock;
    for (const p of g.pads) {
      const pad = this.art('lilypad'), bob = Math.sin(t * 2 + p.x * 0.1) * 0.3;
      if (pad) c.drawImage(pad, p.x - 2, p.y - 3 + bob, p.w + 4, (p.w + 4) * 0.375);
      else {
        c.fillStyle = '#4f9d4a'; c.beginPath(); c.ellipse(p.x + p.w / 2, p.y + 1.2 + bob, p.w / 2 + 1, 2.2, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#76c46a'; c.beginPath(); c.ellipse(p.x + p.w / 2, p.y + 0.6 + bob, p.w / 2, 1.6, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#ff9ec4'; c.beginPath(); c.arc(p.x + p.w - 3, p.y - 0.2 + bob, 1.2, 0, Math.PI * 2); c.fill();
      }
    }
    for (const s of g.seesaws) {
      const x0 = s.cx - s.half, x1 = s.cx + s.half, y0 = g.seesawY(s, x0), y1 = g.seesawY(s, x1), ang = Math.atan2(y1 - y0, x1 - x0);
      c.fillStyle = '#8a5a3a'; c.beginPath(); c.moveTo(s.cx, s.cy + 1); c.lineTo(s.cx - 5, s.cy + 9); c.lineTo(s.cx + 5, s.cy + 9); c.closePath(); c.fill();
      const plank = this.art('seesaw');
      c.save(); c.translate(s.cx, s.cy); c.rotate(ang);
      if (plank) c.drawImage(plank, -s.half - 2, -1, s.half * 2 + 4, ((s.half * 2 + 4) * 96) / 512);
      else {
        c.fillStyle = '#c98f55'; c.fillRect(-s.half, 0, s.half * 2, 3); c.fillStyle = '#7a4f2c'; c.fillRect(-s.half, 2.4, s.half * 2, 0.6);
        c.fillStyle = '#ff9ec4'; c.fillRect(-s.half, -1, 4, 1.2); c.fillRect(s.half - 4, -1, 4, 1.2);
      }
      c.restore();
    }
    for (const p of g.puffs) {
      const puff = this.art('puff'), sq = 1 + Math.sin(t * 6 + p.x) * 0.06;
      if (puff) c.drawImage(puff, p.x - 7, p.y - 8 * sq, 14, 9 * sq);
      else for (const [dx, dy, r] of [[-4, -2, 3], [0, -3.5, 3.6], [4, -2, 3], [0, -1, 3.4]]) { c.fillStyle = dy < -3 ? '#ffffff' : '#ece2f6'; c.beginPath(); c.arc(p.x + dx, p.y + dy * sq, r, 0, Math.PI * 2); c.fill(); }
    }
  }
  private burrows(g: ParadeGame) {
    const c = this.c, t = this.clock, e = g.entrance, x = g.exit;
    const inn = this.art('burrow-in');
    if (inn) c.drawImage(inn, e.x - 12, e.y - 20, 24, 24);
    else {
      c.fillStyle = '#6b4a30'; c.beginPath(); c.ellipse(e.x, e.y - 6, 9, 7, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#2a1a12'; c.beginPath(); c.ellipse(e.x, e.y - 4.5, 6, 4.5, 0, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#8a6a3a'; c.lineWidth = 0.7; c.beginPath(); c.moveTo(e.x - 8, e.y - 10); c.quadraticCurveTo(e.x - 11, e.y - 4, e.x - 9, e.y + 1); c.stroke();
    }
    // Dora and Enzo wait either side of the home burrow and cheer as each kit gets in
    const hop = Math.max(0, 1 - (this.clock - this.cheer) / 0.5);
    for (const [id, dx, face] of [['dora', -15, 1], ['enzo', 15, -1]] as const) {
      const p = this.art(`parent-${id}`), jump = hop * 3 * Math.abs(Math.sin((this.clock - this.cheer) * 12 + (id === 'enzo' ? 1 : 0)));
      if (p) c.drawImage(p, x.x + dx - 10, x.y - 20 - jump, 20, 20);
      else drawChinchilla(c, id, x.x + dx, x.y - jump, { face, h: 15, time: t + (id === 'enzo' ? 1.3 : 0), air: jump > 0.5 });
    }
    const home = this.art('burrow-home');
    if (home) c.drawImage(home, x.x - 14, x.y - 22, 28, 22.4);
    else {
      c.fillStyle = '#5f9a48'; c.beginPath(); c.ellipse(x.x, x.y, 13, 13, 0, Math.PI, 0); c.fill();
      c.fillStyle = '#3c7a3a'; c.beginPath(); c.ellipse(x.x, x.y - 1, 13, 3, 0, Math.PI, 0); c.fill();
      c.fillStyle = '#ffd88a'; c.beginPath(); c.ellipse(x.x, x.y, 5.5, 8.5, 0, Math.PI, 0); c.fill();
      c.fillStyle = '#4fa0c0'; c.beginPath(); c.ellipse(x.x - 3.2, x.y - 3.5, 2.3, 5, -0.15, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#ffe9a8'; c.beginPath(); c.arc(x.x + 9, x.y - 9, 1.6 + Math.sin(t * 3) * 0.2, 0, Math.PI * 2); c.fill();
    }
  }

  private kit(g: ParadeGame, k: Kit, alpha: number, view: View) {
    const c = this.c, t = this.clock;
    if (k.state === 'carried') return;
    const x = k.px + (k.x - k.px) * alpha, y = k.py + (k.y - k.py) * alpha, coat = KIT_COATS[k.i % KIT_COATS.length];
    if (k.state === 'home') {
      const f = Math.min(1, k.t / HOME_TICKS); if (f >= 1) return;
      c.save(); c.globalAlpha = 1 - f; c.translate(x, y); c.scale(1 - f * 0.6, 1 - f * 0.6);
      drawChinchilla(c, coat, 0, 0, { face: k.dir, h: 13, time: t, moving: true, run: k.steps });
      c.restore(); return;
    }
    const H = 13, air = k.state === 'fall' || k.state === 'bounce' || k.state === 'float' || k.state === 'glide';
    c.save();
    if (k.state === 'climb') {
      c.translate(x, y); c.rotate(-Math.PI / 2 * k.dir); c.translate(-x + k.dir * 1, -y);
      drawChinchilla(c, coat, x, y, { face: k.dir, h: H, time: t, moving: true, run: k.t * 0.5 });
    } else if (k.state === 'glide') {
      // the fluffy tail opens like a parachute above
      const sway = Math.sin(t * 3 + k.i) * 0.15;
      c.save(); c.translate(x, y - H - 3); c.rotate(sway);
      c.fillStyle = coat.tailOuter; c.beginPath(); c.ellipse(0, 0, 8, 4.5, 0, Math.PI, 0); c.fill();
      c.fillStyle = coat.tail; c.beginPath(); c.ellipse(0, 0.3, 6, 3, 0, Math.PI, 0); c.fill();
      c.strokeStyle = coat.tailLine; c.lineWidth = 0.4; c.beginPath(); c.moveTo(-6, 0); c.lineTo(-1, 4); c.moveTo(6, 0); c.lineTo(1, 4); c.stroke();
      c.restore();
      drawChinchilla(c, coat, x, y, { face: k.dir, h: H, time: t, air: true });
    } else {
      const bob = k.state === 'dig' ? Math.abs(Math.sin(k.t * 0.5)) * -1.2 : k.state === 'hug' ? Math.sin(k.t * 0.4) * 0.6 : 0;
      const spin = k.state === 'bounce' && k.vy < 0 ? Math.sin(k.t * 0.3) * 0.2 : 0;
      c.translate(x, y + bob); c.rotate(spin); c.translate(-x, -y);
      if (k.state === 'stop') {
        // paws out: little arms either side
        c.fillStyle = coat.foot; for (const d of [-1, 1]) { c.beginPath(); c.ellipse(x + d * 5.5, y - 7, 1.6, 1.2, 0, 0, Math.PI * 2); c.fill(); }
      }
      drawChinchilla(c, coat, x, y, { face: k.dir, h: H, time: t + k.i * 0.37, moving: k.state === 'walk' || k.state === 'tunnel' && !k.dug, run: k.steps, air, dizzy: k.state === 'dizzy' || k.state === 'splash' });
      if (k.state === 'build') { c.fillStyle = '#f1d36b'; c.fillRect(x + k.dir * 3 - 2, y - 9, 4, 3); c.strokeStyle = '#a9782e'; c.lineWidth = 0.4; c.strokeRect(x + k.dir * 3 - 2, y - 9, 4, 3); }
      if (k.state === 'tunnel' && k.dug) { c.strokeStyle = '#8a6a5a'; c.lineWidth = 0.8; const sw = Math.sin(k.t * 0.6) * 0.8; c.beginPath(); c.moveTo(x + k.dir * 2, y - 5); c.lineTo(x + k.dir * 6, y - 7 + sw); c.stroke(); }
      if (k.state === 'dizzy') for (let i = 0; i < 3; i++) { const a = t * 4 + (i * Math.PI * 2) / 3; c.fillStyle = '#ffe27a'; c.font = `4px ${FONT}`; c.textAlign = 'center'; c.fillText('★', x + Math.cos(a) * 5, y - H - 1 + Math.sin(a) * 1.5); }
      if (k.state === 'float') { c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 0.5; for (const d of [-4, 4]) { c.beginPath(); c.moveTo(x + d, y + 2); c.quadraticCurveTo(x + d + 1, y + 5, x + d, y + 8); c.stroke(); } }
    }
    c.restore();
    // the job bubble over its head, and little badges for climbers and gliders
    const job = JOB_OF[k.state];
    if (job && k.state !== 'glide' && k.state !== 'climb') this.bubble(job, x, y - H - 5, 4.2);
    let bx = x - 3;
    if (k.climber && k.state !== 'climb') { this.bubble('climber', bx, y - H - 1, 2.2); bx += 6; }
    if (k.glider && k.state !== 'glide') this.bubble('glider', bx, y - H - 1, 2.2);
    void g; void view;
  }
  /** A round bubble with a job's painted icon (or its emoji). */
  private bubble(job: Job, x: number, y: number, r: number) {
    const c = this.c, icon = this.art(`job-${job}`);
    c.fillStyle = 'rgba(255,253,245,.92)'; c.strokeStyle = 'rgba(90,60,40,.6)'; c.lineWidth = 0.35;
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); c.stroke();
    if (icon) c.drawImage(icon, x - r * 0.85, y - r * 0.85, r * 1.7, r * 1.7);
    else { c.font = `${r * 1.3}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#000'; c.fillText(JOB_INFO[job].icon, x, y + r * 0.08); }
  }
  private hover(g: ParadeGame, k: Kit, alpha: number, view: View) {
    const c = this.c, x = k.px + (k.x - k.px) * alpha, y = k.py + (k.y - k.py) * alpha, can = view.job ? g.canTake(k, view.job) : false;
    c.strokeStyle = can ? '#ffe27a' : 'rgba(255,255,255,.75)'; c.lineWidth = 0.8;
    c.setLineDash([1.6, 1.2]); c.lineDashOffset = -this.clock * 6;
    c.beginPath(); c.ellipse(x, y - KIT_H / 2 - 1, 8, 9, 0, 0, Math.PI * 2); c.stroke(); c.setLineDash([]);
    if (can && view.job) this.bubble(view.job, x + 8, y - 17, 3.4);
  }
  private effects(dt: number) {
    const c = this.c;
    for (const b of this.bits) {
      b.life += dt; b.x += b.vx * dt; b.y += b.vy * dt; b.vy += (b.kind === 'heart' ? 6 : 140) * dt;
      const a = Math.max(0, 1 - b.life / b.max); if (a <= 0) continue;
      c.globalAlpha = a; c.fillStyle = b.color;
      if (b.kind === 'heart') { c.font = `${b.size + 2}px ${FONT}`; c.textAlign = 'center'; c.fillText('♥', b.x, b.y); }
      else if (b.kind === 'star') { c.font = `${b.size * 2.4}px ${FONT}`; c.textAlign = 'center'; c.fillText('✦', b.x, b.y); }
      else { c.beginPath(); c.arc(b.x, b.y, b.size, 0, Math.PI * 2); c.fill(); }
    }
    c.globalAlpha = 1;
    this.bits = this.bits.filter((b) => b.life < b.max);
    for (const p of this.pops) {
      const age = this.clock - p.born, a = Math.max(0, 1 - age / 1.1); if (a <= 0) continue;
      c.globalAlpha = a; c.font = `800 5px ${FONT}`; c.textAlign = 'center'; c.lineWidth = 1.2; c.strokeStyle = 'rgba(40,25,50,.7)';
      c.strokeText(p.text, p.x, p.y - age * 8); c.fillStyle = p.color; c.fillText(p.text, p.x, p.y - age * 8);
    }
    c.globalAlpha = 1;
    this.pops = this.pops.filter((p) => this.clock - p.born < 1.1);
    // Mum swoops in and carries dizzy and splashed kits home, rising up and away
    for (const l of this.lifts) {
      const age = this.clock - l.born, a = Math.min(1, age * 3) * Math.max(0, 1 - (age - 1.4) / 0.4);
      if (a <= 0) continue;
      const rise = age * age * 22, x = l.x + Math.sin(age * 3) * 2, y = l.y - rise, mum = this.art('mum-carry');
      c.globalAlpha = a;
      if (mum) c.drawImage(mum, x - 10, y - 20, 20, 20);
      else {
        drawChinchilla(c, 'dora', x, y, { face: 1, h: 15, time: this.clock, air: true });
        c.fillStyle = '#7fbf6a'; c.beginPath(); c.ellipse(x + 4, y - 7, 5, 3, 0.3, 0, Math.PI * 2); c.fill();
        drawChinchilla(c, KIT_COATS[l.coat % KIT_COATS.length], x + 4, y - 6, { face: 1, h: 8, time: this.clock, dizzy: true });
      }
      c.globalAlpha = 1;
    }
    this.lifts = this.lifts.filter((l) => this.clock - l.born < 1.8);
  }
  /** A level thumbnail for the menu: the ground only, small. */
  preview(g: ParadeGame, out: HTMLCanvasElement) {
    this.world = g.level.world; this.buildTerrain(g);
    const c = out.getContext('2d')!; c.clearRect(0, 0, out.width, out.height); c.drawImage(this.terr!, 0, 0, out.width, out.height);
    this.terrFor.game = null;
  }
}

function hex(h: string): number[] {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
