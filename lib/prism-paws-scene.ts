// Prism Paws in Canvas 2D: the painted night behind each chapter, the board on a soft dark-blue panel, moonbeams drawn as
// added light (so rose and leaf really do glow honey where they cross), lanterns that bloom and sway, sleeping kits,
// the firefly, Dora and Enzo at the board's corners, and the festival when a level is won. Every painting has a drawn
// stand-in, so the game looks finished before (or without) the art. Drawing only: the rules live in prism-paws-game.ts.
import { drawChinchilla, coatLike } from './chinchilla-art';
import {
  COLOURS, EMPTY, ROCK, FLOWERS, SOURCE, LANTERN, KIT, BURROW, FIREFLY, MIRROR_A, MIRROR_B, SPLIT_A, SPLIT_B, GLASS_ROSE, GLASS_LEAF, GLASS_SKY, PRISM,
  isBack, glassColour, placeable, type PrismGame, type PrismEvent,
} from './prism-paws-game';

const TAU = Math.PI * 2;
const CHAPTER_IDS = ['meadow', 'candy', 'crystal', 'festival'] as const;
const PIECE_ART = ['moon', 'lantern-off', 'lantern-on', 'kit-sleep', 'kit-awake', 'firefly', 'rock', 'flowers', 'burrow', 'mirror', 'splitter', 'prism', 'glass'];
const ART = [...PIECE_ART, 'dora', 'enzo', 'dora-cheer', 'enzo-cheer', ...CHAPTER_IDS.map((c) => `bg-${c}`)];
const KIT_COAT = coatLike('enzo', { fur: '#b9b6c0', back: '#9c99a6', face: '#cfccd6', tail: '#b3b0bb', tailOuter: '#9c99a6', bands: false });
/** A night sky for each chapter's stand-in: top, bottom, hills and accent. */
const SKIES: [string, string, string, string][] = [
  ['#0b1640', '#2a3f7a', '#16301f', '#9fe0a0'],
  ['#1a0f38', '#4a2a66', '#2a1830', '#ff9ac0'],
  ['#0c1030', '#2b2560', '#1a1838', '#a99cff'],
  ['#0a0f2e', '#33285e', '#141026', '#ffcf6a'],
];
const BURROW_TINT = ['#b89cff', '#6fe3d0'];

type Mote = { x: number; y: number; vx: number; vy: number; life: number; max: number; rgb: [number, number, number]; size: number; kind: 'dot' | 'dust' | 'spark' | 'lantern' };
type Turn = { from: number; to: number; t0: number };
export type Ghost = { x: number; y: number; code: number; kind: 'place' | 'turn' };
export type View = {
  chapter: number;
  cursor: { x: number; y: number } | null;
  hover: { x: number; y: number } | null;
  /** The piece the player has picked from the tray (shown as a ghost on the hovered tile). */
  armed: number | null;
  hint: Ghost | null;
  /** A piece being dragged: where the pointer is (CSS pixels) and, for a placed piece, the tile it came from. */
  drag: { sx: number; sy: number; code: number; from: { x: number; y: number } | null } | null;
};

const rgba = (c: [number, number, number], a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const whiter = (c: [number, number, number], k: number): [number, number, number] => [c[0] + (255 - c[0]) * k, c[1] + (255 - c[1]) * k, c[2] + (255 - c[2]) * k].map(Math.round) as [number, number, number];
/** A steady pseudo-random number in 0..1 for an integer seed (stars, flowers, rocks). */
const hash = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

export class PrismScene {
  private c: CanvasRenderingContext2D;
  w = 0; h = 0; private dpr = 1;
  /** Screen space the page keeps for its header, tray and side panels (CSS pixels). */
  insets = { top: 64, bottom: 110, left: 0, right: 0 };
  /** The board on screen: top-left corner and tile size in CSS pixels. */
  board = { x: 0, y: 0, cell: 64, cols: 1, rows: 1 };
  /** Whether Dora and Enzo stand below the board (tall screens) rather than beside it. */
  private below = false;
  private img = new Map<string, HTMLImageElement>();
  private cache = new Map<string, HTMLCanvasElement>();
  private motes: Mote[] = [];
  private pops = new Map<number, number>();
  private turns = new Map<number, Turn>();
  private shown = new Map<number, number>();
  private woke = new Map<number, number>();
  private clock = 0;
  private winAt = -1;
  private fireflyAt = -1;
  private beamKey = '';
  private beamAt = 0;
  private sparkle = 0;
  private game: PrismGame | null = null;

  constructor(private canvas: HTMLCanvasElement) {
    const c = canvas.getContext('2d'); if (!c) throw new Error('no 2d');
    this.c = c; this.resize();
    for (const n of ART) {
      const i = new Image(); i.decoding = 'async'; i.src = `/art/prism/${n}.webp`;
      i.onload = () => { for (const k of [...this.cache.keys()]) if (k.startsWith(n + ':')) this.cache.delete(k); };
      this.img.set(n, i);
    }
  }
  /** A painting once it has loaded, or null so the drawn stand-in is used. */
  private art(name: string) { const i = this.img.get(name); return i && i.complete && i.naturalWidth > 0 ? i : null; }
  /** Which paintings have loaded (for the browser tests). */
  loaded() { return ART.filter((n) => this.art(n)); }

  resize() {
    const r = this.canvas.getBoundingClientRect(); this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = Math.max(280, r.width); this.h = Math.max(260, r.height);
    this.canvas.width = Math.round(this.w * this.dpr); this.canvas.height = Math.round(this.h * this.dpr);
    if (this.game) this.layout(this.game);
  }
  setInsets(i: Partial<PrismScene['insets']>) { this.insets = { ...this.insets, ...i }; if (this.game) this.layout(this.game); }

  /** Fits the board into the space between the page's panels, leaving room at the sides for Dora and Enzo when it can. */
  layout(g: PrismGame) {
    if (this.game !== g) { this.pops.clear(); this.turns.clear(); this.shown.clear(); this.woke.clear(); this.winAt = -1; this.fireflyAt = g.traced.firefly ? 0 : -1; this.motes = []; this.beamKey = ''; }
    this.game = g;
    const { top, bottom, left, right } = this.insets;
    const aw = Math.max(120, this.w - left - right - 16), ah = Math.max(120, this.h - top - bottom - 16);
    // room for the two chinchillas beside the board when the screen is wide enough
    // Dora and Enzo stand beside the board on a wide screen, and below its corners on a tall one
    const wide = aw / ah > (g.w + 3) / (g.h + 0.5);
    const cell = wide ? Math.max(22, Math.min(aw / (g.w + 3), ah / (g.h + 0.5), 96)) : Math.max(22, Math.min(aw / (g.w + 0.4), ah / (g.h + 0.5), 96));
    const spare = ah - g.h * cell;
    this.below = !wide && spare > cell * 1.6;
    const lift = this.below ? Math.min(spare / 2, cell * 1.1) : 0;
    this.board = { x: left + 8 + (aw - g.w * cell) / 2, y: top + 8 + (ah - g.h * cell) / 2 - lift, cell, cols: g.w, rows: g.h };
  }
  /** The tile under a point on the canvas (CSS pixels), or null. */
  cellAt(sx: number, sy: number) {
    const { x, y, cell, cols, rows } = this.board;
    const cx = Math.floor((sx - x) / cell), cy = Math.floor((sy - y) / cell);
    return cx >= 0 && cy >= 0 && cx < cols && cy < rows ? { x: cx, y: cy } : null;
  }
  /** The middle of a tile on the canvas (CSS pixels). */
  centre(x: number, y: number) { return { x: this.board.x + (x + 0.5) * this.board.cell, y: this.board.y + (y + 0.5) * this.board.cell }; }

  // ---- events from the game
  feed(events: PrismEvent[], g: PrismGame) {
    for (const e of events) {
      if (e.x === undefined || e.y === undefined) {
        if (e.kind === 'win') { this.winAt = this.clock; this.festival(g); }
        if (e.kind === 'undo' || e.kind === 'reset') this.winAt = g.won ? this.winAt : -1;
        continue;
      }
      const i = e.y * g.w + e.x, p = this.centre(e.x, e.y), cell = this.board.cell;
      if (e.kind === 'place') { this.pops.set(i, this.clock); this.turns.delete(i); this.puff(p.x, p.y + cell * 0.2, 10, [238, 226, 205], 'dust'); }
      else if (e.kind === 'turn') {
        // the engine turns at once; the board spins the piece a quarter turn to catch up
        const was = this.shown.get(i) ?? 0;
        this.turns.set(i, { from: was, to: was + Math.PI / 2, t0: this.clock });
        this.puff(p.x, p.y, 5, [220, 230, 255], 'spark');
      }
      else if (e.kind === 'lift') { this.puff(p.x, p.y, 8, [238, 226, 205], 'dust'); this.pops.delete(i); }
      else if (e.kind === 'lit') { this.puff(p.x, p.y - cell * 0.1, 14, COLOURS[e.c ?? 7].rgb, 'spark'); }
      else if (e.kind === 'wake') this.woke.set(i, this.clock);
      else if (e.kind === 'calm') this.woke.delete(i);
      else if (e.kind === 'firefly') { this.fireflyAt = this.clock; this.puff(p.x, p.y, 10, [255, 230, 120], 'spark'); }
      if (e.kind === 'dim' || e.kind === 'lift' || e.kind === 'place' || e.kind === 'turn') if (!g.won) this.winAt = -1;
    }
  }
  private puff(x: number, y: number, n: number, rgb: [number, number, number], kind: Mote['kind']) {
    const s = this.board.cell;
    for (let k = 0; k < n; k++) {
      const a = Math.random() * TAU, v = (kind === 'dust' ? 0.6 : 1.2) * s * (0.4 + Math.random());
      this.motes.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (kind === 'spark' ? s * 0.5 : 0), life: 0, max: 0.5 + Math.random() * 0.5, rgb, size: s * (kind === 'dust' ? 0.07 : 0.045) * (0.6 + Math.random()), kind });
    }
  }
  /** The win: paper lanterns float up off the board and light motes rain in every colour. */
  private festival(g: PrismGame) {
    const { x, y, cell } = this.board;
    for (let k = 0; k < 18; k++) {
      const rgb = COLOURS[[1, 2, 3, 4, 5, 6, 7][k % 7]].rgb;
      this.motes.push({ x: x + Math.random() * g.w * cell, y: y + g.h * cell * (0.4 + Math.random() * 0.6), vx: (Math.random() - 0.5) * cell * 0.3, vy: -cell * (0.6 + Math.random() * 0.7), life: -Math.random() * 1.5, max: 5 + Math.random() * 2, rgb, size: cell * (0.16 + Math.random() * 0.1), kind: 'lantern' });
    }
    for (let k = 0; k < 60; k++) {
      const rgb = COLOURS[1 + (k % 7)].rgb;
      this.motes.push({ x: x + Math.random() * g.w * cell, y: y - cell * Math.random(), vx: (Math.random() - 0.5) * cell, vy: cell * (0.3 + Math.random() * 0.8), life: -Math.random(), max: 2.2 + Math.random(), rgb, size: cell * 0.05, kind: 'spark' });
    }
  }

  // ---- drawing
  draw(g: PrismGame | null, dt: number, v: View) {
    this.clock += dt;
    const c = this.c;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
    this.background(v.chapter);
    if (!g) { this.menuMotes(dt); return; }
    if (g !== this.game) this.layout(g);
    const t = g.traced, key = t.segs.map((s) => `${s.x1},${s.y1},${s.x2},${s.y2},${s.c}`).join('|');
    if (key !== this.beamKey) { this.beamKey = key; this.beamAt = this.clock; }
    this.panel(g);
    this.floor(g, v);
    this.beams(g);
    this.things(g, v);
    this.chins(g);
    this.overlays(g, v);
    this.updateMotes(dt);
  }

  private cover(img: CanvasImageSource, iw: number, ih: number) {
    const k = Math.max(this.w / iw, this.h / ih), w = iw * k, h = ih * k;
    this.c.drawImage(img, (this.w - w) / 2, (this.h - h) / 2, w, h);
  }
  private background(ch: number) {
    const c = this.c, id = CHAPTER_IDS[Math.max(0, Math.min(3, ch))], a = this.art(`bg-${id}`);
    if (a) this.cover(a, a.naturalWidth, a.naturalHeight);
    else {
      const k = `bg-${id}:${Math.round(this.w)}x${Math.round(this.h)}`;
      let cv = this.cache.get(k);
      if (!cv) { cv = this.paintSky(ch); this.cache.set(k, cv); }
      c.drawImage(cv, 0, 0, this.w, this.h);
    }
    // a soft dark vignette pulls the eye to the board
    const g = c.createRadialGradient(this.w / 2, this.h * 0.5, Math.min(this.w, this.h) * 0.25, this.w / 2, this.h * 0.5, Math.max(this.w, this.h) * 0.75);
    g.addColorStop(0, 'rgba(6,8,24,0.05)'); g.addColorStop(1, 'rgba(6,8,24,0.62)');
    c.fillStyle = g; c.fillRect(0, 0, this.w, this.h);
  }
  /** The drawn night for each chapter: sky, moon, stars and a silhouette (hills, market stalls, crystals or rooftops). */
  private paintSky(ch: number) {
    const cv = document.createElement('canvas'), W = Math.round(this.w), H = Math.round(this.h);
    cv.width = W; cv.height = H;
    const c = cv.getContext('2d')!, [top, bottom, hill, accent] = SKIES[ch];
    let g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, top); g.addColorStop(1, bottom);
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    for (let k = 0; k < 140; k++) {
      const x = hash(k) * W, y = hash(k + 500) * H * 0.7, r = 0.4 + hash(k + 900) * 1.3;
      c.fillStyle = `rgba(255,255,240,${0.25 + hash(k + 1300) * 0.6})`; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
    }
    const mx = W * 0.82, my = H * 0.16, mr = Math.min(W, H) * 0.07;
    g = c.createRadialGradient(mx, my, mr * 0.5, mx, my, mr * 4); g.addColorStop(0, 'rgba(255,248,210,0.35)'); g.addColorStop(1, 'rgba(255,248,210,0)');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.fillStyle = '#fff6d6'; c.beginPath(); c.arc(mx, my, mr, 0, TAU); c.fill();
    c.fillStyle = 'rgba(220,205,160,0.5)'; for (const [dx, dy, r] of [[-0.3, -0.2, 0.18], [0.25, 0.1, 0.12], [-0.05, 0.35, 0.1]]) { c.beginPath(); c.arc(mx + dx * mr, my + dy * mr, r * mr, 0, TAU); c.fill(); }
    c.fillStyle = hill;
    if (ch === 0) {
      for (const [y0, amp, f, shade] of [[0.72, 0.06, 2.1, 0], [0.8, 0.05, 3.3, 1]]) {
        c.fillStyle = shade ? '#0f2416' : hill; c.beginPath(); c.moveTo(0, H);
        for (let x = 0; x <= W; x += 8) c.lineTo(x, H * (y0 + Math.sin(x / W * f * Math.PI + f) * amp)); c.lineTo(W, H); c.fill();
      }
      // a string of unlit paper lanterns over the meadow
      this.lanternString(c, W, H, 0.3, '#e8dcc0');
    } else if (ch === 1) {
      for (let k = 0; k < 7; k++) {
        const x = (k + 0.1) * W / 6.5, w = W / 8, y = H * (0.7 + hash(k) * 0.06);
        c.fillStyle = hill; c.fillRect(x, y, w, H - y);
        c.fillStyle = k % 2 ? '#5a2a4a' : '#3e2a5a'; c.beginPath(); c.moveTo(x - 8, y); c.lineTo(x + w / 2, y - H * 0.06); c.lineTo(x + w + 8, y); c.fill();
        for (let j = 0; j < 3; j++) { c.fillStyle = ['rgba(255,90,122,.55)', 'rgba(95,224,122,.5)', 'rgba(90,168,255,.55)'][(j + k) % 3]; c.beginPath(); c.arc(x + w * (0.25 + j * 0.25), y + H * 0.04, w * 0.08, 0, TAU); c.fill(); }
      }
      this.lanternString(c, W, H, 0.34, '#f0d8e0');
    } else if (ch === 2) {
      c.fillStyle = hill; c.beginPath(); c.moveTo(0, 0); c.lineTo(W * 0.18, 0); c.quadraticCurveTo(W * 0.05, H * 0.5, W * 0.12, H); c.lineTo(0, H); c.fill();
      c.beginPath(); c.moveTo(W, 0); c.lineTo(W * 0.84, 0); c.quadraticCurveTo(W * 0.96, H * 0.5, W * 0.86, H); c.lineTo(W, H); c.fill();
      c.fillRect(0, H * 0.84, W, H * 0.16);
      for (let k = 0; k < 16; k++) {
        const x = hash(k + 40) < 0.5 ? hash(k) * W * 0.16 : W - hash(k) * W * 0.16, y = H * (0.2 + hash(k + 70) * 0.75), s = H * (0.03 + hash(k + 90) * 0.05);
        c.fillStyle = k % 2 ? 'rgba(169,156,255,.7)' : 'rgba(111,227,208,.6)';
        c.beginPath(); c.moveTo(x, y - s * 1.8); c.lineTo(x + s * 0.5, y); c.lineTo(x - s * 0.5, y); c.fill();
      }
    } else {
      for (let k = 0; k < 12; k++) {
        const x = k * W / 11 - 20, w = W / 10, y = H * (0.72 + hash(k + 3) * 0.08);
        c.fillStyle = hill; c.fillRect(x, y, w, H - y);
        c.beginPath(); c.moveTo(x - 6, y); c.lineTo(x + w / 2, y - H * 0.05); c.lineTo(x + w + 6, y); c.fill();
        c.fillStyle = 'rgba(255,207,106,.5)'; c.fillRect(x + w * 0.35, y + H * 0.04, w * 0.18, H * 0.03);
      }
      this.lanternString(c, W, H, 0.28, '#f3e3c0'); this.lanternString(c, W, H, 0.4, '#efd9b8');
    }
    c.fillStyle = accent; c.globalAlpha = 0.5;
    for (let k = 0; k < 18; k++) { c.beginPath(); c.arc(hash(k + 200) * W, H * (0.5 + hash(k + 300) * 0.45), 1.5 + hash(k) * 1.5, 0, TAU); c.fill(); }
    c.globalAlpha = 1;
    return cv;
  }
  private lanternString(c: CanvasRenderingContext2D, W: number, H: number, y0: number, paper: string) {
    c.strokeStyle = 'rgba(30,20,20,.6)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(0, H * y0);
    c.quadraticCurveTo(W / 2, H * (y0 + 0.12), W, H * y0); c.stroke();
    for (let k = 1; k < 12; k++) {
      const t = k / 12, x = W * t, y = H * y0 + (1 - (2 * t - 1) ** 2) * H * 0.06 + 8, r = Math.min(W, H) * 0.014;
      c.fillStyle = paper; c.globalAlpha = 0.55; c.beginPath(); c.ellipse(x, y, r, r * 1.2, 0, 0, TAU); c.fill(); c.globalAlpha = 1;
    }
  }
  private menuMotes(dt: number) {
    const c = this.c;
    if (this.motes.length < 40) this.motes.push({ x: Math.random() * this.w, y: this.h + 10, vx: (Math.random() - 0.5) * 10, vy: -20 - Math.random() * 30, life: 0, max: 8 + Math.random() * 6, rgb: COLOURS[1 + Math.floor(Math.random() * 7)].rgb, size: 1.5 + Math.random() * 2.5, kind: 'dot' });
    c.globalCompositeOperation = 'lighter';
    for (const m of this.motes) {
      m.life += dt; m.x += m.vx * dt + Math.sin(this.clock + m.y * 0.02) * 0.3; m.y += m.vy * dt;
      const a = Math.sin(Math.min(1, m.life / m.max) * Math.PI) * 0.8;
      const g = c.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.size * 4); g.addColorStop(0, rgba(m.rgb, a)); g.addColorStop(1, rgba(m.rgb, 0));
      c.fillStyle = g; c.fillRect(m.x - m.size * 4, m.y - m.size * 4, m.size * 8, m.size * 8);
    }
    c.globalCompositeOperation = 'source-over';
    this.motes = this.motes.filter((m) => m.life < m.max);
  }

  private round(x: number, y: number, w: number, h: number, r: number) {
    const c = this.c; c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  private panel(g: PrismGame) {
    const c = this.c, { x, y, cell } = this.board, w = g.w * cell, h = g.h * cell, pad = cell * 0.14;
    c.save();
    c.shadowColor = 'rgba(0,0,10,0.55)'; c.shadowBlur = cell * 0.5; c.shadowOffsetY = cell * 0.08;
    this.round(x - pad, y - pad, w + pad * 2, h + pad * 2, cell * 0.28);
    c.fillStyle = 'rgba(14,22,56,0.66)'; c.fill();
    c.restore();
    this.round(x - pad, y - pad, w + pad * 2, h + pad * 2, cell * 0.28);
    c.strokeStyle = 'rgba(190,205,255,0.22)'; c.lineWidth = 1.5; c.stroke();
    c.strokeStyle = 'rgba(190,205,255,0.07)'; c.lineWidth = 1; c.beginPath();
    for (let k = 1; k < g.w; k++) { c.moveTo(x + k * cell, y + 4); c.lineTo(x + k * cell, y + h - 4); }
    for (let k = 1; k < g.h; k++) { c.moveTo(x + 4, y + k * cell); c.lineTo(x + w - 4, y + k * cell); }
    c.stroke();
  }
  /** A painting scaled to fit a tile (with a little margin), turned and tinted as asked; or null without the art. */
  private sprite(name: string, cx: number, cy: number, size: number, opts: { rot?: number; tint?: [number, number, number]; tintK?: number; alpha?: number } = {}) {
    const a = this.art(name); if (!a) return false;
    const c = this.c;
    let src: CanvasImageSource = a, iw = a.naturalWidth, ih = a.naturalHeight;
    if (opts.tint) {
      const k = `${name}:${opts.tint.join(',')}:${opts.tintK ?? 0.5}`;
      let cv = this.cache.get(k);
      if (!cv) {
        cv = document.createElement('canvas'); cv.width = iw; cv.height = ih;
        const x = cv.getContext('2d')!; x.drawImage(a, 0, 0);
        x.globalCompositeOperation = 'source-atop'; x.fillStyle = rgba(opts.tint, opts.tintK ?? 0.5); x.fillRect(0, 0, iw, ih);
        this.cache.set(k, cv);
      }
      src = cv; iw = cv.width; ih = cv.height;
    }
    const k = size / Math.max(iw, ih);
    c.save(); c.translate(cx, cy); if (opts.rot) c.rotate(opts.rot); if (opts.alpha !== undefined) c.globalAlpha *= opts.alpha;
    c.drawImage(src, -iw * k / 2, -ih * k / 2, iw * k, ih * k);
    c.restore();
    return true;
  }

  // ---- the floor: open grass, clover, rocks and burrows
  private floor(g: PrismGame, v: View) {
    const c = this.c, b = g.board, { cell } = this.board;
    const pairs = new Map<number, number>(); let pairN = 0;
    for (let i = 0; i < b.terrain.length; i++) if (b.terrain[i] === BURROW && !pairs.has(i)) { pairs.set(i, pairN); pairs.set(b.partner[i], pairN); pairN++; }
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
      const i = y * g.w + x, t = b.terrain[i], p = this.centre(x, y);
      if (t === EMPTY || t === FIREFLY) {
        this.round(p.x - cell * 0.44, p.y - cell * 0.44, cell * 0.88, cell * 0.88, cell * 0.16);
        c.fillStyle = placeable(b, i) ? 'rgba(160,190,255,0.06)' : 'rgba(160,190,255,0.03)'; c.fill();
      } else if (t === FLOWERS) { if (!this.sprite('flowers', p.x, p.y, cell * 0.98)) this.drawClover(p.x, p.y, cell, i); }
      else if (t === ROCK) { if (!this.sprite('rock', p.x, p.y, cell * 0.98)) this.drawRock(p.x, p.y, cell, i); }
      else if (t === BURROW) {
        const tint = BURROW_TINT[(pairs.get(i) ?? 0) % 2], spin = this.clock * 0.6;
        if (!this.sprite('burrow', p.x, p.y, cell * 0.98)) this.drawBurrow(p.x, p.y, cell, spin);
        // a coloured ring and a matching number of dots pair the two ends
        c.strokeStyle = tint; c.globalAlpha = 0.75 + Math.sin(this.clock * 2) * 0.2; c.lineWidth = Math.max(1.5, cell * 0.04);
        c.beginPath(); c.arc(p.x, p.y, cell * 0.46, 0, TAU); c.stroke(); c.globalAlpha = 1;
        const n = (pairs.get(i) ?? 0) + 1;
        for (let k = 0; k < n; k++) { c.fillStyle = tint; c.beginPath(); c.arc(p.x + cell * (0.34 - k * 0.12), p.y - cell * 0.36, cell * 0.05, 0, TAU); c.fill(); }
      }
    }
    // the keyboard cursor and the tile under the mouse
    for (const [cur, colour] of [[v.hover, 'rgba(255,240,200,0.35)'], [v.cursor, '#ffd36b']] as const) {
      if (!cur) continue;
      const p = this.centre(cur.x, cur.y);
      this.round(p.x - cell * 0.47, p.y - cell * 0.47, cell * 0.94, cell * 0.94, cell * 0.18);
      c.strokeStyle = colour; c.lineWidth = cur === v.cursor ? 2.5 : 1.5;
      if (cur === v.cursor) c.setLineDash([cell * 0.12, cell * 0.08]);
      c.stroke(); c.setLineDash([]);
    }
  }
  private drawClover(x: number, y: number, s: number, seed: number) {
    const c = this.c;
    c.fillStyle = 'rgba(40,90,50,0.55)'; c.beginPath(); c.ellipse(x, y + s * 0.08, s * 0.4, s * 0.3, 0, 0, TAU); c.fill();
    for (let k = 0; k < 7; k++) {
      const a = hash(seed * 7 + k) * TAU, r = s * 0.25 * hash(seed + k * 3), lx = x + Math.cos(a) * r, ly = y + Math.sin(a) * r * 0.8;
      c.fillStyle = k % 2 ? '#4f9e57' : '#62b36a';
      for (let j = 0; j < 3; j++) { const b = j * TAU / 3 + a; c.beginPath(); c.arc(lx + Math.cos(b) * s * 0.06, ly + Math.sin(b) * s * 0.06, s * 0.065, 0, TAU); c.fill(); }
    }
    for (let k = 0; k < 4; k++) {
      const a = hash(seed * 3 + k + 50) * TAU, r = s * 0.28 * hash(seed + k + 9);
      c.fillStyle = '#fff8e8'; c.beginPath(); c.arc(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.8 - s * 0.04, s * 0.05, 0, TAU); c.fill();
      c.fillStyle = '#ffd86b'; c.beginPath(); c.arc(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.8 - s * 0.04, s * 0.018, 0, TAU); c.fill();
    }
  }
  private drawRock(x: number, y: number, s: number, seed: number) {
    const c = this.c, g = c.createRadialGradient(x - s * 0.12, y - s * 0.16, s * 0.05, x, y, s * 0.46);
    g.addColorStop(0, '#a9aab4'); g.addColorStop(1, '#4e5060');
    c.fillStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.ellipse(x, y + s * 0.3, s * 0.4, s * 0.1, 0, 0, TAU); c.fill();
    c.fillStyle = g; c.beginPath();
    for (let k = 0; k <= 10; k++) { const a = k / 10 * TAU, r = s * (0.36 + hash(seed + k) * 0.07); const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r * 0.86; if (k) c.lineTo(px, py); else c.moveTo(px, py); }
    c.fill(); c.strokeStyle = 'rgba(30,25,35,0.6)'; c.lineWidth = 1.2; c.stroke();
    c.fillStyle = 'rgba(110,170,90,0.85)';
    for (let k = 0; k < 5; k++) { c.beginPath(); c.ellipse(x - s * 0.18 + k * s * 0.08, y - s * 0.24 + hash(seed + k) * s * 0.06, s * 0.08, s * 0.045, 0, 0, TAU); c.fill(); }
  }
  private drawBurrow(x: number, y: number, s: number, spin: number) {
    const c = this.c;
    c.fillStyle = '#6b5a48'; c.beginPath(); c.ellipse(x, y, s * 0.42, s * 0.36, 0, 0, TAU); c.fill();
    for (let k = 0; k < 9; k++) { const a = k / 9 * TAU; c.fillStyle = k % 2 ? '#8d8a92' : '#a3a0a8'; c.beginPath(); c.ellipse(x + Math.cos(a) * s * 0.36, y + Math.sin(a) * s * 0.3, s * 0.08, s * 0.06, a, 0, TAU); c.fill(); }
    const g = c.createRadialGradient(x, y, 0, x, y, s * 0.28); g.addColorStop(0, '#2a2060'); g.addColorStop(1, '#07061a');
    c.fillStyle = g; c.beginPath(); c.ellipse(x, y, s * 0.28, s * 0.23, 0, 0, TAU); c.fill();
    for (let k = 0; k < 6; k++) { const a = spin + k * TAU / 6, r = s * (0.06 + k * 0.03); c.fillStyle = 'rgba(220,210,255,0.8)'; c.beginPath(); c.arc(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.8, s * 0.018, 0, TAU); c.fill(); }
  }

  // ---- light
  private beams(g: PrismGame) {
    const c = this.c, { x: bx, y: by, cell } = this.board, segs = g.traced.segs, t = this.clock;
    const fade = Math.min(1, (t - this.beamAt) * 5 + 0.35);
    c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
    for (const [width, alpha, white] of [[0.55, 0.09, 0], [0.24, 0.24, 0.15], [0.075, 0.85, 0.65]] as const) {
      c.lineWidth = Math.max(1, cell * width);
      segs.forEach((s, k) => {
        const rgb = COLOURS[s.c].rgb, shimmer = 0.86 + Math.sin(t * 3.1 + k * 1.7) * 0.14;
        c.strokeStyle = rgba(whiter(rgb, white), alpha * shimmer * fade);
        c.beginPath(); c.moveTo(bx + s.x1 * cell, by + s.y1 * cell); c.lineTo(bx + s.x2 * cell, by + s.y2 * cell); c.stroke();
      });
    }
    // motes of light drifting along each beam the way it travels
    for (const [k, s] of segs.entries()) {
      const len = Math.hypot(s.x2 - s.x1, s.y2 - s.y1); if (len < 0.1) continue;
      const rgb = whiter(COLOURS[s.c].rgb, 0.5), n = Math.max(1, Math.round(len * 1.4));
      for (let j = 0; j < n; j++) {
        const f = ((t * 1.5) / len + j / n + hash(k * 13 + j) * 0.3) % 1;
        const mx = bx + (s.x1 + (s.x2 - s.x1) * f) * cell, my = by + (s.y1 + (s.y2 - s.y1) * f) * cell, r = cell * (0.05 + hash(j + k) * 0.04);
        const a = Math.sin(f * Math.PI) * 0.8 * fade;
        const gr = c.createRadialGradient(mx, my, 0, mx, my, r * 2.5); gr.addColorStop(0, rgba(rgb, a)); gr.addColorStop(1, rgba(rgb, 0));
        c.fillStyle = gr; c.fillRect(mx - r * 2.5, my - r * 2.5, r * 5, r * 5);
      }
    }
    c.restore();
  }

  // ---- everything standing on the board
  private things(g: PrismGame, v: View) {
    const c = this.c, b = g.board, tr = g.traced, { cell } = this.board, t = this.clock;
    const lanternAt = new Map(b.lanterns.map((L, k) => [L.y * g.w + L.x, k]));
    const kitAt = new Map(b.kits.map((K, k) => [K.y * g.w + K.x, k]));
    let srcK = 0;
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
      const i = y * g.w + x, p = this.centre(x, y), terr = b.terrain[i];
      if (terr === SOURCE) { const s = b.sources.find((s) => s.x === x && s.y === y)!; this.moonWindow(p.x, p.y, cell, s.d, s.c, srcK++); }
      else if (terr === LANTERN) { const k = lanternAt.get(i)!; this.lantern(p.x, p.y, cell, b.lanterns[k].c, tr.recv[k], tr.lit[k], k); }
      else if (terr === KIT) { const k = kitAt.get(i)!; this.kit(p.x, p.y, cell, tr.woke[k], i); }
      const code = g.pieces[i];
      if (code && !(v.drag?.from && v.drag.from.x === x && v.drag.from.y === y)) {
        const pop = this.pops.get(i), age = pop === undefined ? 9 : t - pop;
        const scale = age < 0.35 ? 1 + Math.sin(age / 0.35 * Math.PI) * 0.22 - (1 - age / 0.35) * 0.3 : 1;
        this.piece(p.x, p.y, cell * scale, code, this.angle(i, code));
        if (!g.placed[i]) this.fixedMark(p.x, p.y, cell, b.turnable[i] === 1);
      }
    }
    // lit lanterns bloom over everything, in their own colour
    c.save(); c.globalCompositeOperation = 'lighter';
    b.lanterns.forEach((L, k) => {
      if (!tr.lit[k]) return;
      const p = this.centre(L.x, L.y), flare = this.winAt >= 0 ? Math.max(0, 1 - (t - this.winAt) / 1.6) : 0;
      const r = cell * (1.0 + flare * 1.2 + Math.sin(t * 2 + k) * 0.06), rgb = COLOURS[L.c].rgb;
      const gr = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, r); gr.addColorStop(0, rgba(rgb, 0.42 + flare * 0.4)); gr.addColorStop(0.45, rgba(rgb, 0.14)); gr.addColorStop(1, rgba(rgb, 0));
      c.fillStyle = gr; c.fillRect(p.x - r, p.y - r, r * 2, r * 2);
      if (Math.random() < 0.06) this.motes.push({ x: p.x + (Math.random() - 0.5) * cell * 0.3, y: p.y - cell * 0.3, vx: (Math.random() - 0.5) * cell * 0.2, vy: -cell * (0.4 + Math.random() * 0.4), life: 0, max: 0.9 + Math.random() * 0.6, rgb: whiter(rgb, 0.4), size: cell * 0.03, kind: 'spark' });
    });
    c.restore();
    // the firefly floats above it all
    const f = b.firefly;
    if (f.x >= 0) {
      const p = this.centre(f.x, f.y), caught = tr.firefly, since = this.fireflyAt >= 0 ? t - this.fireflyAt : 9;
      let fx = p.x + Math.sin(t * 1.3) * cell * 0.08, fy = p.y + Math.sin(t * 2.2) * cell * 0.1;
      if (caught && since < 1.4) { const a = since / 1.4 * TAU; fx = p.x + Math.sin(a) * cell * 0.3; fy = p.y - (1 - Math.cos(a)) * cell * 0.22; }
      const glow = caught ? 1 : 0.55 + Math.sin(t * 3) * 0.15, r = cell * (caught ? 0.75 : 0.5);
      c.save(); c.globalCompositeOperation = 'lighter';
      const gr = c.createRadialGradient(fx, fy, 0, fx, fy, r); gr.addColorStop(0, `rgba(255,232,120,${0.55 * glow})`); gr.addColorStop(1, 'rgba(255,232,120,0)');
      c.fillStyle = gr; c.fillRect(fx - r, fy - r, r * 2, r * 2); c.restore();
      if (!this.sprite('firefly', fx, fy, cell * 0.5, { rot: Math.sin(t * 2) * 0.12 })) this.drawFirefly(fx, fy, cell * 0.5, t);
    }
  }
  /** The angle a mirror or pane is shown at: the engine's `\` is the `/` painting turned a quarter, tweened when it turns. */
  private angle(i: number, code: number) {
    const want = isBack(code) ? Math.PI / 2 : 0, tw = this.turns.get(i);
    let a = want;
    if (tw) {
      const k = Math.min(1, (this.clock - tw.t0) / 0.2), e = 1 - (1 - k) ** 3;
      a = tw.from + (tw.to - tw.from) * e;
      if (k >= 1) { this.turns.delete(i); a = want; }
    }
    this.shown.set(i, a % Math.PI);
    return a;
  }
  /** Draws one piece into a small canvas (the tray's buttons), with the painting when it has loaded. */
  icon(cv: HTMLCanvasElement, code: number) {
    const r = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1), w = Math.max(16, r.width), h = Math.max(16, r.height);
    if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const x = cv.getContext('2d'); if (!x) return;
    const keep = this.c; this.c = x;
    x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, w, h);
    this.piece(w / 2, h / 2, Math.min(w, h) * 1.05, code);
    this.c = keep;
  }
  piece(x: number, y: number, s: number, code: number, rot = isBack(code) ? Math.PI / 2 : 0) {
    const c = this.c;
    // a soft shadow seats every piece on the grass
    c.fillStyle = 'rgba(0,0,12,0.28)'; c.beginPath(); c.ellipse(x, y + s * 0.3, s * 0.32, s * 0.08, 0, 0, TAU); c.fill();
    if (code === MIRROR_A || code === MIRROR_B) { if (!this.sprite('mirror', x, y, s * 0.9, { rot })) this.drawMirror(x, y, s, rot, false); }
    else if (code === SPLIT_A || code === SPLIT_B) { if (!this.sprite('splitter', x, y, s * 0.9, { rot })) this.drawMirror(x, y, s, rot, true); }
    else if (code === PRISM) { if (!this.sprite('prism', x, y, s * 0.86)) this.drawPrism(x, y, s); }
    else if (code === GLASS_ROSE || code === GLASS_LEAF || code === GLASS_SKY) {
      const rgb = COLOURS[glassColour(code)].rgb;
      if (!this.sprite('glass', x, y, s * 0.82, { tint: rgb, tintK: 0.55 })) this.drawGlass(x, y, s, rgb);
      // a coloured glow so the pane's colour reads at any size
      c.save(); c.globalCompositeOperation = 'lighter';
      const gr = c.createRadialGradient(x, y, 0, x, y, s * 0.45); gr.addColorStop(0, rgba(rgb, 0.3)); gr.addColorStop(1, rgba(rgb, 0));
      c.fillStyle = gr; c.fillRect(x - s * 0.45, y - s * 0.45, s * 0.9, s * 0.9); c.restore();
    }
  }
  private drawMirror(x: number, y: number, s: number, rot: number, pane: boolean) {
    const c = this.c, L = s * 0.86, T = s * (pane ? 0.12 : 0.2);
    c.save(); c.translate(x, y); c.rotate(rot - Math.PI / 4);
    this.round(-L / 2, -T / 2, L, T, T * 0.3);
    c.fillStyle = pane ? '#d9dde8' : '#8a5a34'; c.fill();
    const g = c.createLinearGradient(0, -T / 2, 0, T / 2);
    if (pane) { g.addColorStop(0, 'rgba(230,220,255,0.85)'); g.addColorStop(1, 'rgba(170,190,255,0.5)'); }
    else { g.addColorStop(0, '#f4f8ff'); g.addColorStop(0.5, '#b8c4d8'); g.addColorStop(1, '#e8eef8'); }
    this.round(-L / 2 + T * 0.18, -T / 2 + T * 0.18, L - T * 0.36, T * 0.64, T * 0.2); c.fillStyle = g; c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineWidth = Math.max(1, T * 0.1); c.beginPath(); c.moveTo(-L * 0.3, -T * 0.08); c.lineTo(-L * 0.1, -T * 0.08); c.stroke();
    c.restore();
  }
  private drawPrism(x: number, y: number, s: number) {
    const c = this.c, r = s * 0.34;
    c.fillStyle = '#7a4c2c'; this.round(x - r * 1.1, y + r * 0.55, r * 2.2, r * 0.4, r * 0.12); c.fill();
    const g = c.createLinearGradient(x - r, y, x + r, y); g.addColorStop(0, 'rgba(210,230,255,0.85)'); g.addColorStop(1, 'rgba(160,180,240,0.7)');
    c.fillStyle = g; c.beginPath(); c.moveTo(x, y - r); c.lineTo(x + r, y + r * 0.6); c.lineTo(x - r, y + r * 0.6); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineWidth = 1.5; c.stroke();
    ['#ff5a7a', '#ffd24a', '#5fe07a', '#5aa8ff'].forEach((col, k) => { c.strokeStyle = col; c.lineWidth = r * 0.08; c.beginPath(); c.moveTo(x - r * 0.1, y + r * (0.05 + k * 0.1)); c.lineTo(x + r * 0.5, y + r * (0.2 + k * 0.08)); c.stroke(); });
  }
  private drawGlass(x: number, y: number, s: number, rgb: [number, number, number]) {
    const c = this.c, r = s * 0.32;
    this.round(x - r, y - r, r * 2, r * 2, r * 0.15); c.fillStyle = '#8a5a34'; c.fill();
    const g = c.createLinearGradient(x - r, y - r, x + r, y + r); g.addColorStop(0, rgba(whiter(rgb, 0.45), 0.95)); g.addColorStop(1, rgba(rgb, 0.85));
    this.round(x - r * 0.82, y - r * 0.82, r * 1.64, r * 1.64, r * 0.1); c.fillStyle = g; c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = r * 0.1; c.beginPath(); c.moveTo(x - r * 0.55, y - r * 0.2); c.lineTo(x - r * 0.2, y - r * 0.55); c.stroke();
  }
  /** Fixed pieces carry little brass rivets; the ones that turn wear a curved arrow too. */
  private fixedMark(x: number, y: number, s: number, turnable: boolean) {
    const c = this.c;
    if (turnable) {
      const cx = x + s * 0.3, cy = y - s * 0.3, r = s * 0.13;
      c.fillStyle = 'rgba(20,24,60,0.85)'; c.beginPath(); c.arc(cx, cy, r * 1.25, 0, TAU); c.fill();
      c.strokeStyle = '#ffd36b'; c.lineWidth = Math.max(1.4, s * 0.035); c.beginPath(); c.arc(cx, cy, r * 0.7, -2.6, 1.4); c.stroke();
      const ax = cx + Math.cos(1.4) * r * 0.7, ay = cy + Math.sin(1.4) * r * 0.7;
      c.fillStyle = '#ffd36b'; c.beginPath(); c.moveTo(ax + r * 0.4, ay - r * 0.1); c.lineTo(ax - r * 0.35, ay + r * 0.35); c.lineTo(ax - r * 0.2, ay - r * 0.45); c.fill();
    } else {
      for (const [dx, dy] of [[-0.36, -0.36], [0.36, -0.36], [-0.36, 0.36], [0.36, 0.36]]) {
        c.fillStyle = '#c9a25a'; c.beginPath(); c.arc(x + dx * s, y + dy * s, s * 0.035, 0, TAU); c.fill();
        c.fillStyle = 'rgba(255,240,200,0.8)'; c.beginPath(); c.arc(x + dx * s - s * 0.01, y + dy * s - s * 0.01, s * 0.012, 0, TAU); c.fill();
      }
    }
  }
  private moonWindow(x: number, y: number, s: number, d: number, col: number, k: number) {
    const c = this.c, rgb = COLOURS[col].rgb, pulse = 1 + Math.sin(this.clock * 2.2 + k) * 0.06;
    c.save(); c.globalCompositeOperation = 'lighter';
    const gr = c.createRadialGradient(x, y, 0, x, y, s * 0.8 * pulse); gr.addColorStop(0, rgba(rgb, 0.45)); gr.addColorStop(1, rgba(rgb, 0));
    c.fillStyle = gr; c.fillRect(x - s, y - s, s * 2, s * 2); c.restore();
    if (!this.sprite('moon', x, y, s * 0.96, col === 7 ? {} : { tint: rgb, tintK: 0.35 })) {
      c.fillStyle = '#7a4c2c'; c.beginPath(); c.arc(x, y, s * 0.4, 0, TAU); c.fill();
      c.fillStyle = '#5a3820'; c.beginPath(); c.arc(x, y, s * 0.33, 0, TAU); c.fill();
      const g = c.createRadialGradient(x - s * 0.06, y - s * 0.06, 0, x, y, s * 0.3); g.addColorStop(0, '#fffbe8'); g.addColorStop(1, rgba(whiter(rgb, 0.3), 1));
      c.fillStyle = g; c.beginPath(); c.arc(x, y, s * 0.29, 0, TAU); c.fill();
    }
    // a little bright chevron shows which way the moonlight leaves
    const a = [0, Math.PI / 2, Math.PI, -Math.PI / 2][d];
    c.save(); c.translate(x, y); c.rotate(a);
    c.fillStyle = rgba(whiter(rgb, 0.4), 0.95); c.strokeStyle = 'rgba(20,20,50,0.7)'; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(s * 0.5, 0); c.lineTo(s * 0.36, -s * 0.1); c.lineTo(s * 0.36, s * 0.1); c.closePath(); c.stroke(); c.fill();
    c.restore();
  }
  /** A paper lantern: dim with its colour on a little tag when unlit, glowing when lit, flickering the wrong tint when not right. */
  private lantern(x: number, y: number, s: number, need: number, got: number, lit: boolean, k: number) {
    const c = this.c, t = this.clock, sway = Math.sin(t * 1.4 + k * 1.3) * (lit ? 0.05 : 0.02);
    const wrong = !lit && got !== 0, bright = wrong && (got & ~need) !== 0;
    c.save(); c.translate(x, y + s * 0.4); c.rotate(sway); c.translate(-x, -(y + s * 0.4));
    if (lit || wrong) {
      const flick = wrong ? 0.45 + 0.35 * Math.abs(Math.sin(t * 9 + k) * Math.sin(t * 3.7)) : 1;
      const rgb = COLOURS[lit ? need : got].rgb;
      if (!this.sprite('lantern-on', x, y, s, { tint: rgb, tintK: 0.42, alpha: flick })) this.drawLantern(x, y, s, rgb, flick);
    } else if (!this.sprite('lantern-off', x, y, s)) this.drawLantern(x, y, s, null, 1);
    c.restore();
    // the colour it wants: a little tag below, split into the colours that mix to it
    const parts = [1, 2, 4].filter((b) => need & b), tx = x + s * 0.3, ty = y + s * 0.3, r = s * 0.12;
    c.fillStyle = 'rgba(14,18,46,0.9)'; c.beginPath(); c.arc(tx, ty, r * 1.3, 0, TAU); c.fill();
    parts.forEach((b, j) => {
      c.fillStyle = COLOURS[b].hex; c.beginPath(); c.moveTo(tx, ty);
      c.arc(tx, ty, r, -Math.PI / 2 + j * TAU / parts.length, -Math.PI / 2 + (j + 1) * TAU / parts.length); c.closePath(); c.fill();
    });
    if (need === 7) { c.fillStyle = '#f4f1ff'; c.beginPath(); c.arc(tx, ty, r * 0.45, 0, TAU); c.fill(); }
    c.strokeStyle = lit ? '#ffe9a8' : 'rgba(255,255,255,0.6)'; c.lineWidth = lit ? 2 : 1.2; c.beginPath(); c.arc(tx, ty, r * 1.3, 0, TAU); c.stroke();
    // too much colour: a little dazzle of white rays
    if (bright) {
      const bx = x - s * 0.3, by = y - s * 0.32, R = s * (0.14 + Math.sin(t * 6) * 0.02);
      c.save(); c.translate(bx, by); c.rotate(t * 1.5);
      c.strokeStyle = 'rgba(255,255,255,0.95)'; c.lineWidth = Math.max(1.3, s * 0.03); c.beginPath();
      for (let j = 0; j < 8; j++) { const a = j * TAU / 8, r0 = j % 2 ? R * 0.45 : R * 0.3; c.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); c.lineTo(Math.cos(a) * R, Math.sin(a) * R); }
      c.stroke(); c.fillStyle = '#fff'; c.beginPath(); c.arc(0, 0, R * 0.22, 0, TAU); c.fill(); c.restore();
    }
  }
  private drawLantern(x: number, y: number, s: number, rgb: [number, number, number] | null, alpha: number) {
    const c = this.c, rx = s * 0.3, ry = s * 0.32, cy = y - s * 0.04;
    c.strokeStyle = '#6a4326'; c.lineWidth = Math.max(1.2, s * 0.03);
    c.beginPath(); c.moveTo(x - rx * 0.6, y + s * 0.42); c.lineTo(x - rx * 0.3, cy + ry * 0.9); c.moveTo(x + rx * 0.6, y + s * 0.42); c.lineTo(x + rx * 0.3, cy + ry * 0.9); c.stroke();
    const g = c.createRadialGradient(x, cy, 0, x, cy, rx * 1.1);
    if (rgb) { g.addColorStop(0, `rgba(255,252,235,${alpha})`); g.addColorStop(0.6, rgba(whiter(rgb, 0.35), alpha)); g.addColorStop(1, rgba(rgb, alpha * 0.9)); }
    else { g.addColorStop(0, '#f3ead6'); g.addColorStop(1, '#bfb092'); }
    c.fillStyle = g; c.beginPath(); c.ellipse(x, cy, rx, ry, 0, 0, TAU); c.fill();
    c.strokeStyle = rgb ? 'rgba(120,70,30,0.45)' : 'rgba(110,90,60,0.55)'; c.lineWidth = 1;
    for (const k of [-0.55, 0, 0.55]) { c.beginPath(); c.ellipse(x, cy, rx * Math.abs(k || 0.02), ry, 0, 0, TAU); c.stroke(); }
    c.fillStyle = '#6a4326'; this.round(x - rx * 0.55, cy - ry - s * 0.04, rx * 1.1, s * 0.07, 2); c.fill(); this.round(x - rx * 0.45, cy + ry - s * 0.02, rx * 0.9, s * 0.06, 2); c.fill();
  }
  private kit(x: number, y: number, s: number, awake: boolean, i: number) {
    const c = this.c, t = this.clock;
    if (awake) {
      const since = t - (this.woke.get(i) ?? t - 9), shake = since < 0.7 ? Math.sin(since * 40) * s * 0.04 * (1 - since / 0.7) : 0;
      const ring = 0.5 + Math.sin(t * 5) * 0.25;
      c.strokeStyle = `rgba(255,110,120,${ring})`; c.lineWidth = Math.max(2, s * 0.05); c.beginPath(); c.arc(x, y, s * 0.46, 0, TAU); c.stroke();
      const gr = c.createRadialGradient(x, y, s * 0.2, x, y, s * 0.5); gr.addColorStop(0, 'rgba(255,90,100,0)'); gr.addColorStop(1, `rgba(255,90,100,${ring * 0.35})`);
      c.fillStyle = gr; c.beginPath(); c.arc(x, y, s * 0.5, 0, TAU); c.fill();
      if (!this.sprite('kit-awake', x + shake, y, s * 0.92)) {
        this.cushion(x, y, s);
        drawChinchilla(c, KIT_COAT, x + shake, y + s * 0.28, { face: 1, h: s * 0.55, time: t });
      }
      return;
    }
    const breathe = 1 + Math.sin(t * 1.8 + i) * 0.025;
    c.save(); c.translate(x, y + s * 0.3); c.scale(1, breathe); c.translate(-x, -(y + s * 0.3));
    if (!this.sprite('kit-sleep', x, y, s * 0.92)) {
      this.cushion(x, y, s);
      c.fillStyle = '#b9b6c0'; c.beginPath(); c.ellipse(x, y + s * 0.06, s * 0.27, s * 0.19, 0, 0, TAU); c.fill();
      c.fillStyle = '#9c99a6'; c.beginPath(); c.ellipse(x + s * 0.12, y - s * 0.02, s * 0.14, s * 0.12, 0, 0, TAU); c.fill();
      c.fillStyle = '#d9c0c8'; c.beginPath(); c.arc(x + s * 0.06, y - s * 0.12, s * 0.07, 0, TAU); c.fill(); c.beginPath(); c.arc(x + s * 0.17, y - s * 0.12, s * 0.06, 0, TAU); c.fill();
      c.strokeStyle = '#3a3440'; c.lineWidth = 1.3; c.beginPath(); c.arc(x + s * 0.16, y - s * 0.01, s * 0.03, 0.2, Math.PI - 0.2); c.stroke();
      c.fillStyle = '#d4d1da'; c.beginPath(); c.ellipse(x - s * 0.22, y + s * 0.08, s * 0.1, s * 0.07, -0.5, 0, TAU); c.fill();
    }
    c.restore();
    // soft "z" swirls drifting up
    for (let k = 0; k < 3; k++) {
      const f = (t * 0.35 + k / 3) % 1, zx = x + s * (0.18 + f * 0.22), zy = y - s * (0.2 + f * 0.4), z = s * (0.06 + f * 0.05);
      c.strokeStyle = `rgba(220,225,255,${Math.sin(f * Math.PI) * 0.85})`; c.lineWidth = Math.max(1.2, s * 0.025); c.lineJoin = 'round';
      c.beginPath(); c.moveTo(zx - z, zy - z); c.lineTo(zx + z, zy - z); c.lineTo(zx - z, zy + z); c.lineTo(zx + z, zy + z); c.stroke();
    }
  }
  private cushion(x: number, y: number, s: number) {
    const c = this.c;
    c.fillStyle = '#34407a'; c.beginPath(); c.ellipse(x, y + s * 0.2, s * 0.4, s * 0.16, 0, 0, TAU); c.fill();
    c.fillStyle = '#4656a0'; c.beginPath(); c.ellipse(x, y + s * 0.16, s * 0.36, s * 0.12, 0, 0, TAU); c.fill();
  }
  private drawFirefly(x: number, y: number, s: number, t: number) {
    const c = this.c, flap = Math.sin(t * 30) * 0.3;
    c.fillStyle = 'rgba(230,240,255,0.7)';
    c.beginPath(); c.ellipse(x - s * 0.15, y - s * 0.18, s * 0.18, s * 0.1, -0.6 + flap, 0, TAU); c.fill();
    c.beginPath(); c.ellipse(x + s * 0.15, y - s * 0.18, s * 0.18, s * 0.1, 0.6 - flap, 0, TAU); c.fill();
    c.fillStyle = '#5a4630'; c.beginPath(); c.ellipse(x, y - s * 0.05, s * 0.14, s * 0.16, 0, 0, TAU); c.fill();
    const g = c.createRadialGradient(x, y + s * 0.12, 0, x, y + s * 0.12, s * 0.2); g.addColorStop(0, '#fffbd0'); g.addColorStop(1, '#ffd24a');
    c.fillStyle = g; c.beginPath(); c.ellipse(x, y + s * 0.12, s * 0.15, s * 0.15, 0, 0, TAU); c.fill();
  }

  // ---- Dora and Enzo at the bottom corners
  private chins(g: PrismGame) {
    const c = this.c, { x, y, cell } = this.board, t = this.clock, w = g.w * cell, h = g.h * cell;
    const room = Math.min(x - this.insets.left, this.w - this.insets.right - (x + w));
    const under = this.h - this.insets.bottom - (y + h);
    const size = this.below ? Math.max(cell * 1.2, Math.min(cell * 2.4, under * 0.95, 170)) : Math.max(cell * 1.15, Math.min(cell * 2.1, room * 1.5, 170));
    const cheer = this.winAt >= 0 && g.won;
    const base = this.below ? y + h + Math.min(under - 4, size * 0.95) : y + h + cell * 0.12;
    for (const [id, side] of [['dora', -1], ['enzo', 1]] as const) {
      const cx = this.below ? (side < 0 ? x + size * 0.42 : x + w - size * 0.42) : side < 0 ? x - Math.min(room * 0.5, size * 0.32) : x + w + Math.min(room * 0.5, size * 0.32);
      const hop = cheer ? Math.abs(Math.sin((t - this.winAt) * 5 + (side > 0 ? 1 : 0))) * cell * 0.25 : 0;
      const breathe = 1 + Math.sin(t * 2 + (side > 0 ? 1.5 : 0)) * 0.015, sway = Math.sin(t * 0.9 + (side > 0 ? 2 : 0)) * 0.025;
      const name = cheer ? `${id}-cheer` : id, a = this.art(name);
      c.save(); c.translate(cx, base - hop); c.rotate(sway); c.scale(1, breathe);
      if (a) { const k = size / Math.max(a.naturalWidth, a.naturalHeight); c.drawImage(a, -a.naturalWidth * k / 2, -a.naturalHeight * k * 0.97, a.naturalWidth * k, a.naturalHeight * k); }
      else drawChinchilla(c, id, 0, 0, { face: side < 0 ? 1 : -1, h: size * 0.62, time: t, air: hop > cell * 0.05 });
      c.restore();
    }
  }

  private overlays(g: PrismGame, v: View) {
    const c = this.c, { cell } = this.board, t = this.clock;
    if (v.hint) {
      const p = this.centre(v.hint.x, v.hint.y), pulse = 0.5 + Math.sin(t * 5) * 0.5;
      c.strokeStyle = `rgba(255,224,130,${0.5 + pulse * 0.5})`; c.lineWidth = 3; c.beginPath(); c.arc(p.x, p.y, cell * (0.45 + pulse * 0.05), 0, TAU); c.stroke();
      if (v.hint.kind === 'place') { c.save(); c.globalAlpha = 0.35 + pulse * 0.3; this.piece(p.x, p.y, cell, v.hint.code); c.restore(); }
      else { c.save(); c.globalAlpha = 0.5 + pulse * 0.4; this.fixedMark(p.x - cell * 0.3, p.y + cell * 0.3, cell * 1.6, true); c.restore(); }
    }
    // a tray piece picked up: its ghost on the tile under the pointer
    if (v.armed && v.hover && !v.drag) {
      const ok = g.canPlace(v.hover.x, v.hover.y), p = this.centre(v.hover.x, v.hover.y);
      if (ok) { c.save(); c.globalAlpha = 0.5; this.piece(p.x, p.y, cell, v.armed); c.restore(); }
    }
    if (v.drag) {
      const over = this.cellAt(v.drag.sx, v.drag.sy);
      if (over) {
        const ok = g.canPlace(over.x, over.y) || (v.drag.from && v.drag.from.x === over.x && v.drag.from.y === over.y), p = this.centre(over.x, over.y);
        this.round(p.x - cell * 0.46, p.y - cell * 0.46, cell * 0.92, cell * 0.92, cell * 0.18);
        c.fillStyle = ok ? 'rgba(140,255,170,0.16)' : 'rgba(255,120,120,0.16)'; c.fill();
        c.strokeStyle = ok ? 'rgba(140,255,170,0.7)' : 'rgba(255,120,120,0.6)'; c.lineWidth = 2; c.stroke();
      }
      c.save(); c.globalAlpha = 0.92; this.piece(v.drag.sx, v.drag.sy - cell * 0.1, cell * 1.08, v.drag.code); c.restore();
    }
    void g;
  }
  private updateMotes(dt: number) {
    const c = this.c;
    c.save(); c.globalCompositeOperation = 'lighter';
    for (const m of this.motes) {
      m.life += dt; if (m.life < 0) continue;
      m.x += m.vx * dt; m.y += m.vy * dt;
      if (m.kind === 'dust') { m.vx *= 0.9; m.vy *= 0.9; }
      if (m.kind === 'lantern') m.x += Math.sin(m.life * 1.5 + m.size) * 0.4;
      const k = m.life / m.max, a = m.kind === 'lantern' ? Math.min(1, m.life * 2) * (1 - k) : 1 - k;
      if (m.kind === 'lantern') {
        c.globalCompositeOperation = 'source-over';
        const r = m.size, g = c.createRadialGradient(m.x, m.y, 0, m.x, m.y, r * 2.4); g.addColorStop(0, rgba(m.rgb, 0.5 * a)); g.addColorStop(1, rgba(m.rgb, 0));
        c.fillStyle = g; c.fillRect(m.x - r * 2.4, m.y - r * 2.4, r * 4.8, r * 4.8);
        c.fillStyle = rgba(whiter(m.rgb, 0.55), 0.95 * a); c.beginPath(); c.ellipse(m.x, m.y, r * 0.7, r * 0.85, 0, 0, TAU); c.fill();
        c.fillStyle = `rgba(90,55,30,${a})`; c.fillRect(m.x - r * 0.35, m.y - r * 0.95, r * 0.7, r * 0.18); c.fillRect(m.x - r * 0.3, m.y + r * 0.8, r * 0.6, r * 0.15);
        c.globalCompositeOperation = 'lighter';
      } else if (m.kind === 'dust') {
        c.globalCompositeOperation = 'source-over'; c.fillStyle = rgba(m.rgb, 0.6 * a); c.beginPath(); c.arc(m.x, m.y, m.size * (1 + k), 0, TAU); c.fill();
        c.globalCompositeOperation = 'lighter';
      } else {
        const r = m.size * 3, g = c.createRadialGradient(m.x, m.y, 0, m.x, m.y, r); g.addColorStop(0, rgba(m.rgb, a)); g.addColorStop(1, rgba(m.rgb, 0));
        c.fillStyle = g; c.fillRect(m.x - r, m.y - r, r * 2, r * 2);
      }
    }
    c.restore();
    this.motes = this.motes.filter((m) => m.life < m.max);
    void this.sparkle;
  }
}
