// The Sunken Bellspire: drawing only. The world is drawn at about 270 lines (as wide as the screen) into a small canvas, lit by a half-resolution
// lightmap (multiplied in, with an additive glow for anything brighter than white), and the page scales the result up
// by a whole number with no smoothing.
import {
  BellspireGame, INFO, ROOMS, AREAS, TILE, COLS, ROWS, VIEW_W, VIEW_H, FOES, ABILITIES, ABILITY_ORDER, HERO_H, DOOR_CHARS,
  rawChar, groupAt, roomRect, hexRgb, surfaceY, surfaceRow,
  type Room, type GameEvent, type FoeKind, type HeroId, type Boss,
} from './bellspire-game';
import { ART } from './bellspire-art';

type Img = HTMLImageElement | HTMLCanvasElement;
/** Extra treatment for a sprite: `rim` adds a dark outline and a lit upper edge in that colour; `tell` flashes it. */
type SprFx = { rim?: string; tell?: boolean };
/** Each guardian's rim light, in the colour of its arena's light. */
const RIM: Record<string, string> = { frog: '#bfe6ff', hydra: '#eaf5a8', puma: '#ffd49a', warden: '#ffe49a', mother: '#b4fff0' };
/** A point light; `soft` lights fall off linearly (a wide, even pool), the rest fall off with the square (a hot centre). */
type Light = { x: number; y: number; r: number; c: [number, number, number]; i: number; soft?: boolean };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number; g: number; light?: boolean };

const FOE_ORDER: FoeKind[] = ['frog', 'moth', 'eel', 'reed', 'condor', 'imp', 'shell', 'vizcacha', 'jelly', 'golem'];
const TILESET = (room: Room) => AREAS[room.area].tiles;
/** Which decor sprite each map mark uses, per tile set, and the pieces sprinkled on floors, walls and ceilings. */
const DECOR: Record<string, { torch: number; candle: number; window: number; bell: number; floor: number[]; wall: number[]; ceil: number[]; back: number }> = {
  halls: { torch: 6, candle: 0, window: 1, bell: 2, floor: [4, 7], wall: [3, 5], ceil: [], back: 0.55 },
  docks: { torch: 0, candle: 6, window: -1, bell: -1, floor: [1, 3, 4, 7], wall: [5], ceil: [], back: 0 },
  towers: { torch: 4, candle: 6, window: 5, bell: 1, floor: [], wall: [2, 7], ceil: [3], back: 0.45 },
  crypt: { torch: 6, candle: 2, window: -1, bell: -1, floor: [3, 7], wall: [0, 1, 5], ceil: [4], back: 0.92 },
  throne: { torch: 2, candle: 7, window: -1, bell: 6, floor: [1, 3, 4], wall: [5], ceil: [], back: 0.6 },
};
const WATER_TINT: Record<string, [number, number, number]> = { halls: [52, 104, 176], docks: [46, 120, 104], throne: [34, 128, 140], hub: [52, 104, 176], towers: [52, 104, 176], crypt: [60, 70, 120] };
const hash = (c: number, r: number) => { let h = (c * 374761393 + r * 668265263) >>> 0; h = ((h ^ (h >>> 13)) * 1274126177) >>> 0; return (h ^ (h >>> 16)) >>> 0; };
const SOLIDISH = '#^';

// a 3×5 pixel font for the few words drawn in the world
const GLYPHS: Record<string, string> = {
  '0': '111101101101111', '1': '010110010010111', '2': '111001111100111', '3': '111001111001111', '4': '101101111001001', '5': '111100111001111',
  '6': '111100111101111', '7': '111001010010010', '8': '111101111101111', '9': '111101111001111', '+': '000010111010000', '!': '010010010000010',
  'L': '100100100100111', 'V': '101101101101010', 'U': '101101101101111', 'P': '111101111100100', ' ': '000000000000000', 'M': '101111111101101',
};

/** The camera's left (or top) edge: inside the room, or centred when the room is smaller than the view. */
function camClamp(t: number, lo: number, span: number, view: number) {
  return span <= view ? lo + (span - view) / 2 : Math.max(lo, Math.min(lo + span - view, t));
}

export class BellspireScene {
  view: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  img = new Map<string, Img>();
  white = new Map<string, HTMLCanvasElement>();
  tints = new Map<string, HTMLCanvasElement>();
  rimCanvas = document.createElement('canvas');
  ready = false;
  cam = { x: 0, y: 0 };
  roomId = '';
  roomCanvas: HTMLCanvasElement | null = null;
  edgeCanvas: HTMLCanvasElement | null = null;
  light: HTMLCanvasElement;
  lctx: CanvasRenderingContext2D;
  ldata: ImageData;
  glow: HTMLCanvasElement;
  gctx: CanvasRenderingContext2D;
  gdata: ImageData;
  particles: Particle[] = [];
  shake = 0;
  bossDim = 0;
  /** How far above the lead the camera centres (more with the touch pad, so the pad covers floor, not faces). */
  lift = 20;
  flash = { color: '#fff', n: 0 };
  pulses: { x: number; y: number; r: number; c: [number, number, number]; t: number }[] = [];
  t = 0;
  reduceFlash = false;
  shakeOn = true;
  bossName = { text: '', t: 0 };
  levelUps: { hero: HeroId; t: number }[] = [];

  /** The internal picture size; the page picks it to fit the screen (about 270 lines, as wide as the screen's shape). */
  vw = VIEW_W;
  vh = VIEW_H;

  constructor() {
    this.view = document.createElement('canvas');
    this.ctx = this.view.getContext('2d')!;
    this.light = document.createElement('canvas');
    this.lctx = this.light.getContext('2d')!;
    this.glow = document.createElement('canvas');
    this.gctx = this.glow.getContext('2d')!;
    this.ldata = this.lctx.createImageData(1, 1);
    this.gdata = this.gctx.createImageData(1, 1);
    this.resize(VIEW_W, VIEW_H);
  }

  resize(w: number, h: number) {
    w = Math.round(w / 2) * 2; h = Math.round(h / 2) * 2;
    if (w === this.view.width && h === this.view.height) return;
    this.vw = w; this.vh = h;
    this.view.width = w; this.view.height = h;
    this.ctx.imageSmoothingEnabled = false;
    this.light.width = w / 2; this.light.height = h / 2;
    this.ldata = this.lctx.createImageData(this.light.width, this.light.height);
    this.glow.width = this.light.width; this.glow.height = this.light.height;
    this.gdata = this.gctx.createImageData(this.glow.width, this.glow.height);
  }

  async load(base = '/art/bellspire/') {
    const names = Object.keys(ART).concat(['parchment']);
    await Promise.all([...new Set(names)].map((n) => new Promise<void>((res) => {
      const im = new Image();
      im.onload = () => { this.img.set(n, im); res(); };
      im.onerror = () => res();
      im.src = `${base}${n}.webp`;
    })));
    for (const n of ['dora', 'enzo', 'foes', 'boss-frog', 'boss-puma', 'boss-mother', 'boss-hydra', 'hydra-head', 'boss-warden']) {
      const im = this.img.get(n);
      if (!im) continue;
      const c = document.createElement('canvas');
      c.width = im.width; c.height = im.height;
      const x = c.getContext('2d')!;
      x.drawImage(im, 0, 0);
      x.globalCompositeOperation = 'source-in';
      x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
      this.white.set(n, c);
    }
    this.ready = true;
  }

  /** Draw frame `i` of strip `name` with its bottom-middle at (x, y). */
  spr(name: string, i: number, x: number, y: number, flip = false, alpha = 1, white = false, fx?: SprFx) {
    const im = white ? this.white.get(name) : this.img.get(name);
    const a = ART[name];
    if (!im || !a) return;
    const [cw, ch] = a;
    const ctx = this.ctx;
    const dx = Math.round(x - cw / 2), dy = Math.round(y - ch);
    const blit = (src: CanvasImageSource, ox = 0, oy = 0, sx = i * cw) => {
      if (flip) { ctx.save(); ctx.translate(dx + cw - ox, dy + oy); ctx.scale(-1, 1); ctx.drawImage(src, sx, 0, cw, ch, 0, 0, cw, ch); ctx.restore(); }
      else ctx.drawImage(src, sx, 0, cw, ch, dx + ox, dy + oy, cw, ch);
    };
    if (alpha !== 1) ctx.globalAlpha = alpha;
    // a guardian stands out: a second dark outline round its silhouette
    if (fx?.rim) { const dark = this.tint(name, '#05040a'); if (dark) for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) blit(dark, ox, oy); }
    blit(im);
    if (fx?.rim) {
      // rim light: the silhouette's upper edge, lit
      const lit = this.tint(name, fx.rim);
      if (lit) {
        const rc = this.rimCanvas, rx = rc.getContext('2d')!;
        if (rc.width < cw || rc.height < ch) { rc.width = Math.max(rc.width, cw); rc.height = Math.max(rc.height, ch); }
        rx.clearRect(0, 0, rc.width, rc.height);
        rx.globalCompositeOperation = 'source-over'; rx.drawImage(lit, i * cw, 0, cw, ch, 0, 0, cw, ch);
        rx.globalCompositeOperation = 'destination-out'; rx.drawImage(this.img.get(name)!, i * cw, 0, cw, ch, 0, 2, cw, ch);
        rx.globalCompositeOperation = 'source-over';
        const ga = ctx.globalAlpha; ctx.globalAlpha = ga * 0.9; blit(rc, 0, 0, 0); ctx.globalAlpha = ga;
      }
    }
    // a wind-up flashes bright
    if (fx?.tell) { const hot = this.tint(name, '#fff4c0'); if (hot) { const ga = ctx.globalAlpha; ctx.globalAlpha = ga * 0.5; blit(hot); ctx.globalAlpha = ga; } }
    if (alpha !== 1) ctx.globalAlpha = 1;
  }
  /** A sheet filled flat with one colour, cached. */
  tint(name: string, color: string): HTMLCanvasElement | null {
    const key = `${name}|${color}`;
    const hit = this.tints.get(key);
    if (hit) return hit;
    const im = this.img.get(name);
    if (!im) return null;
    const c = document.createElement('canvas');
    c.width = im.width; c.height = im.height;
    const x = c.getContext('2d')!;
    x.drawImage(im, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = color; x.fillRect(0, 0, c.width, c.height);
    this.tints.set(key, c);
    return c;
  }

  // ─── events from the game ────────────────────────────────────────────────
  handle(events: GameEvent[]) {
    for (const e of events) {
      if (e.k === 'hit') this.burst(e.x, e.y, e.big ? 12 : 7, e.color ?? '#fff6d0', e.big ? 2.6 : 1.8);
      else if (e.k === 'shake') this.shake = Math.max(this.shake, e.n);
      else if (e.k === 'flash') this.flash = { color: e.color, n: e.n };
      else if (e.k === 'pulse') this.pulses.push({ x: e.x, y: e.y, r: e.r, c: e.color, t: 0 });
      else if (e.k === 'bell') this.burst(e.x, e.y, 14, '#ffd870', 2.4);
      else if (e.k === 'boss') this.bossName = { text: e.id, t: 180 };
      else if (e.k === 'level') this.levelUps.push({ hero: e.hero, t: 90 });
      else if (e.k === 'sfx' && e.id === 'splash' && e.x !== undefined && e.y !== undefined) this.burst(e.x, e.y - 4, 10, '#bfe6ff', 2, -1.5);
      else if (e.k === 'sfx' && e.id === 'poof' && e.x !== undefined && e.y !== undefined) this.burst(e.x, e.y - 8, 10, '#e8e0ff', 1.6);
    }
  }
  burst(x: number, y: number, n: number, color: string, speed: number, up = 0) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random() * 0.8);
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s + up, life: 0, max: 18 + Math.random() * 14, color, size: Math.random() < 0.3 ? 2 : 1, g: 0.08, light: true });
    }
  }

  // ─── the room's still parts, drawn once ──────────────────────────────────
  buildRoom(room: Room) {
    const rr = roomRect(room);
    const c = document.createElement('canvas');
    c.width = rr.w; c.height = rr.h;
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    const set = TILESET(room), tiles = this.img.get(`tiles-${set}`), dec = DECOR[set];
    const c0 = room.gx * COLS, r0 = room.gy * ROWS, W = room.w * COLS, H = room.h * ROWS;
    const T = (i: number, x: number, y: number, a = 1) => { if (!tiles) return; if (a !== 1) ctx.globalAlpha = a; ctx.drawImage(tiles, i * 16, 0, 16, 16, x, y, 16, 16); if (a !== 1) ctx.globalAlpha = 1; };
    const solid = (x: number, y: number) => SOLIDISH.includes(rawChar(c0 + x, r0 + y)) && rawChar(c0 + x, r0 + y) !== '^';
    const air = (x: number, y: number) => !solid(x, y);
    // the back wall, with pillars every so often
    const back = room.dark ? Math.max(dec.back, 0.8) : dec.back;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!air(x, y)) continue;
      if (back > 0) T(6, x * 16, y * 16, back);
      if (back > 0 && (c0 + x) % 12 === 6) T(7, x * 16, y * 16, Math.min(1, back + 0.25));
    }
    // decor sprinkled on the back wall
    const decor = this.img.get(`decor-${set}`);
    const things = new Set(INFO.get(room.id)!.things.map((t) => `${t.c},${t.r}`));
    const D = (i: number, x: number, y: number, a = 1) => {
      const art = ART[`decor-${set}`];
      if (!decor || !art || i < 0) return;
      ctx.globalAlpha = a;
      ctx.drawImage(decor, i * art[0], 0, art[0], art[1], Math.round(x - art[0] / 2), Math.round(y - art[1]), art[0], art[1]);
      ctx.globalAlpha = 1;
    };
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      if (things.has(`${c0 + x},${r0 + y}`) || DOOR_CHARS.includes(rawChar(c0 + x, r0 + y))) continue;
      const h = hash(c0 + x, r0 + y);
      if (air(x, y) && solid(x, y + 1) && air(x - 1, y) && air(x + 1, y) && rawChar(c0 + x, r0 + y) === '.' && dec.floor.length && h % 23 === 0) D(dec.floor[h % dec.floor.length], x * 16 + 8, (y + 1) * 16);
      else if (air(x, y) && solid(x, y - 1) && air(x, y + 1) && air(x, y + 2) && dec.ceil.length && h % 29 === 0) D(dec.ceil[h % dec.ceil.length], x * 16 + 8, y * 16 + (ART[`decor-${set}`]?.[1] ?? 60));
      else if (air(x, y) && air(x, y + 1) && air(x, y - 1) && air(x - 1, y) && air(x + 1, y) && solid(x, y + 3) && dec.wall.length && h % 41 === 0) D(dec.wall[h % dec.wall.length], x * 16 + 8, (y + 2) * 16, 0.9);
    }
    // the map marks that are part of the walls
    for (const t of INFO.get(room.id)!.things) {
      const x = (t.c - c0) * 16 + 8, y = (t.r - r0 + 1) * 16;
      if (t.ch === 'T') D(dec.torch, x, y + 4);
      else if (t.ch === 'i') D(dec.candle >= 0 ? dec.candle : 0, x, y);
      else if (t.ch === 'w') { if (dec.window >= 0) D(dec.window, x, y + 16); else this.drawWindow(ctx, x, y); }
      else if (t.ch === 'h') D(dec.bell >= 0 ? dec.bell : 0, x, y + 24);
      else if (t.ch === 'v') { const p = this.img.get('props'), a = ART.props; if (p && a) ctx.drawImage(p, 6 * a[0], 0, a[0], a[1], x - a[0] / 2, y - a[1], a[0], a[1]); }
    }
    // the solid tiles
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const ch = rawChar(c0 + x, r0 + y);
      if (ch === '#') {
        const top = air(x, y - 1) && y > 0, under = air(x, y + 1) && y < H - 1;
        const h = hash(c0 + x, r0 + y);
        T(top ? 0 : under ? 8 : h % 9 === 0 ? 2 : 1, x * 16, y * 16);
        // edge shading so stone reads as solid mass
        if (!top && !under && (air(x - 1, y) || air(x + 1, y))) { ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(air(x - 1, y) ? x * 16 : x * 16 + 15, y * 16, 1, 16); }
      } else if (ch === '=') T(3, x * 16, y * 16);
      else if (ch === 'H') T(4, x * 16, y * 16);
      else if (ch === '^') this.drawSpikes(ctx, x * 16, y * 16);
    }
    this.roomCanvas = c;
    this.roomId = room.id;
    // in dark rooms, a faint line along every floor, ledge and wall edge, drawn over the light so the way is never a guess
    this.edgeCanvas = null;
    if (room.dark) {
      const e = document.createElement('canvas');
      e.width = rr.w; e.height = rr.h;
      const ex = e.getContext('2d')!;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const ch = room.rows[y][x];
        if (ch === '=') { ex.fillStyle = 'rgba(200,190,240,0.32)'; ex.fillRect(x * 16, y * 16, 16, 1); continue; }
        if (!solid(x, y)) continue;
        ex.fillStyle = 'rgba(200,190,240,0.28)';
        if (y > 0 && air(x, y - 1)) ex.fillRect(x * 16, y * 16, 16, 1);
        ex.fillStyle = 'rgba(200,190,240,0.14)';
        if (x > 0 && air(x - 1, y)) ex.fillRect(x * 16, y * 16, 1, 16);
        if (x < W - 1 && air(x + 1, y)) ex.fillRect(x * 16 + 15, y * 16, 1, 16);
        if (y < H - 1 && air(x, y + 1)) ex.fillRect(x * 16, y * 16 + 15, 16, 1);
      }
      this.edgeCanvas = e;
    }
  }
  drawWindow(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.fillStyle = '#1c2a40'; ctx.fillRect(x - 8, y - 40, 16, 32);
    ctx.fillStyle = '#4a78a8'; ctx.fillRect(x - 6, y - 38, 12, 28);
    ctx.fillStyle = '#8fc0e8'; ctx.fillRect(x - 4, y - 36, 3, 10);
  }
  drawSpikes(ctx: CanvasRenderingContext2D, x: number, y: number) {
    for (let i = 0; i < 4; i++) {
      const sx = x + i * 4;
      ctx.fillStyle = '#3a2a26'; ctx.fillRect(sx, y + 6, 4, 10);
      ctx.fillStyle = '#c9a46a'; ctx.fillRect(sx + 1, y + 8, 2, 8); ctx.fillRect(sx + 1, y + 6, 1, 2);
      ctx.fillStyle = '#f2dca0'; ctx.fillRect(sx + 1, y + 9, 1, 5);
    }
    ctx.fillStyle = '#5a4030'; ctx.fillRect(x, y + 14, 16, 2);
  }

  // ─── the frame ───────────────────────────────────────────────────────────
  draw(g: BellspireGame) {
    const ctx = this.ctx;
    this.t++;
    if (!this.ready) { ctx.fillStyle = '#0b0a12'; ctx.fillRect(0, 0, this.vw, this.vh); return; }
    const room = g.room;
    if (this.roomId !== room.id || !this.roomCanvas) { this.buildRoom(room); this.particles = []; this.snapCam(g); }
    const rr = roomRect(room);
    // the camera follows the lead, a little ahead, and never leaves the room; in a boss fight it looks at the guardian
    // while it introduces itself, then leans towards it (keeping the lead well inside the picture)
    const b = g.body, boss = g.boss;
    let fx = b.x + b.face * 24;
    if (boss && !boss.calm && boss.st === 'intro') fx = boss.x;
    else if (boss && !boss.calm && boss.st !== 'wait') fx = clamp((b.x + boss.x) / 2, b.x - this.vw / 2 + 70, b.x + this.vw / 2 - 70);
    const tx = camClamp(fx - this.vw / 2, rr.x, rr.w, this.vw);
    const ty = camClamp(b.y - this.lift - this.vh / 2, rr.y, rr.h, this.vh);
    this.cam.x += (tx - this.cam.x) * 0.14; this.cam.y += (ty - this.cam.y) * 0.14;
    let cx = Math.round(this.cam.x), cy = Math.round(this.cam.y);
    if (this.shake > 0 && this.shakeOn) { cx += Math.round((Math.random() - 0.5) * this.shake); cy += Math.round((Math.random() - 0.5) * this.shake); }
    if (this.shake > 0) this.shake = Math.max(0, this.shake - 0.6);
    const set = TILESET(room);

    // far backdrop and mid silhouettes, with parallax
    const bg = this.img.get(`bg-${set}`);
    const px = rr.w > this.vw ? (this.cam.x - rr.x) / (rr.w - this.vw) : 0.5, py = rr.h > this.vh ? (this.cam.y - rr.y) / (rr.h - this.vh) : 0.5;
    if (bg) {
      // cover the whole view, with a little room to drift for parallax
      const k = Math.max((this.vw + 32) / 480, (this.vh + 20) / 270), bw = Math.round(480 * k), bh = Math.round(270 * k);
      ctx.drawImage(bg, 0, 0, 480, 270, Math.round(-(bw - this.vw) * px), Math.round(-(bh - this.vh) * py), bw, bh);
    }
    else { ctx.fillStyle = '#16141f'; ctx.fillRect(0, 0, this.vw, this.vh); }
    const mid = this.img.get(`mid-${set}`);
    if (mid) { const ox = -(((cx * 0.35) % 480) + 480) % 480, oy = Math.round(-20 * py + 8 + (this.vh - 270) / 2); for (let x = Math.round(ox); x < this.vw; x += 480) ctx.drawImage(mid, x, oy); }

    // the room
    ctx.drawImage(this.roomCanvas!, rr.x - cx, rr.y - cy);
    // in a boss fight the room behind the action sinks into shadow, so the guardian stands out from the busy scenery
    const fighting = !!g.boss && !g.boss.calm && g.boss.st !== 'wait';
    this.bossDim += ((fighting ? 1 : 0) - this.bossDim) * 0.05;
    if (this.bossDim > 0.01) {
      // drain most of the colour, then darken
      ctx.globalCompositeOperation = 'saturation'; ctx.fillStyle = `rgba(128,128,128,${(this.bossDim * 0.7).toFixed(3)})`; ctx.fillRect(0, 0, this.vw, this.vh);
      ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = `rgba(6,8,16,${(this.bossDim * 0.5).toFixed(3)})`; ctx.fillRect(0, 0, this.vw, this.vh);
    }
    const ox = -cx, oy = -cy;
    this.drawDynamicTiles(g, ox, oy);
    this.drawThings(g, ox, oy);
    this.drawPickups(g, ox, oy);
    this.drawEnemies(g, ox, oy);
    if (g.boss) this.drawBoss(g, g.boss, ox, oy);
    this.drawHeroes(g, ox, oy);
    this.drawShots(g, ox, oy);
    this.drawWater(g, ox, oy);
    this.drawParticles(ox, oy);

    // light
    this.drawLight(g, cx, cy);
    if (this.edgeCanvas) ctx.drawImage(this.edgeCanvas, rr.x - cx, rr.y - cy);
    // beyond a room smaller than the view: the dark
    {
      const x0 = rr.x - cx, y0 = rr.y - cy, x1 = x0 + rr.w, y1 = y0 + rr.h;
      ctx.fillStyle = '#07060c';
      if (x0 > 0) ctx.fillRect(0, 0, x0, this.vh);
      if (x1 < this.vw) ctx.fillRect(x1, 0, this.vw - x1, this.vh);
      if (y0 > 0) ctx.fillRect(0, 0, this.vw, y0);
      if (y1 < this.vh) ctx.fillRect(0, y1, this.vw, this.vh - y1);
    }
    this.drawRays(g, ox, oy);

    // over the light: the wisp, rings, flashes and labels
    if (g.wisp.on) { const wx = g.wisp.x + ox, wy = g.wisp.y + oy + Math.sin(this.t * 0.1) * 2; this.spr('npcs', 4, wx, wy + 6, g.wisp.tx < g.wisp.x); }
    for (const r of g.rings) { ctx.strokeStyle = r.friendly ? 'rgba(255,220,130,0.85)' : 'rgba(230,120,255,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(Math.round(r.x + ox), Math.round(r.y + oy), r.r, 0, Math.PI * 2); ctx.stroke(); }
    for (const p of this.pulses) {
      p.t++;
      const k = p.t / 24;
      ctx.strokeStyle = `rgba(${p.c.map((v) => Math.round(v * 255)).join(',')},${Math.max(0, 0.5 * (1 - k))})`;
      ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(Math.round(p.x + ox), Math.round(p.y + oy), p.r * Math.min(1, k * 1.4) * 0.5, 0, Math.PI * 2); ctx.stroke();
    }
    this.pulses = this.pulses.filter((p) => p.t < 24);
    for (const l of this.levelUps) { l.t--; const hx = l.hero === g.lead ? b.x : g.follower.x, hy = (l.hero === g.lead ? b.y : g.follower.y) - 46 - (90 - l.t) * 0.2; this.text('LV UP!', hx + ox, hy + oy, l.t > 70 || this.t % 8 < 6 ? '#ffe27a' : '#fff'); }
    this.levelUps = this.levelUps.filter((l) => l.t > 0);
    if (this.flash.n > 0) {
      if (!this.reduceFlash) { ctx.globalAlpha = Math.min(0.6, this.flash.n / 20); ctx.fillStyle = this.flash.color; ctx.fillRect(0, 0, this.vw, this.vh); ctx.globalAlpha = 1; }
      this.flash.n--;
    }
  }
  snapCam(g: BellspireGame) {
    const rr = roomRect(g.room), b = g.body;
    this.cam.x = camClamp(b.x + b.face * 24 - this.vw / 2, rr.x, rr.w, this.vw);
    this.cam.y = camClamp(b.y - this.lift - this.vh / 2, rr.y, rr.h, this.vh);
  }
  text(s: string, x: number, y: number, color: string) {
    const ctx = this.ctx;
    const w = s.length * 4 - 1;
    let px = Math.round(x - w / 2);
    for (const ch of s) {
      const gl = GLYPHS[ch] ?? GLYPHS[' '];
      for (let i = 0; i < 15; i++) if (gl[i] === '1') {
        ctx.fillStyle = '#1a1020'; ctx.fillRect(px + (i % 3) + 1, Math.round(y) + Math.floor(i / 3) + 1, 1, 1);
        ctx.fillStyle = color; ctx.fillRect(px + (i % 3), Math.round(y) + Math.floor(i / 3), 1, 1);
      }
      px += 4;
    }
  }

  drawDynamicTiles(g: BellspireGame, ox: number, oy: number) {
    const ctx = this.ctx, room = g.room, info = INFO.get(room.id)!;
    const tiles = this.img.get(`tiles-${TILESET(room)}`);
    // breakable walls
    for (const w of info.walls) {
      if (g.wallBroken(w)) continue;
      for (const [c, r] of w.tiles) if (tiles) ctx.drawImage(tiles, 5 * 16, 0, 16, 16, c * TILE + ox, r * TILE + oy, 16, 16);
    }
    // doors and hatches
    for (const d of info.doors) {
      const open = g.doorOpen(d);
      const x = d.c * TILE + ox, y = d.r * TILE + oy, w = d.w * TILE, h = d.h * TILE;
      const ab = ({ d: 'dash', j: 'double', k: 'wallkick', l: 'lantern', c: 'chime' } as Record<string, keyof typeof ABILITIES>)[d.ch];
      const col = ab ? ABILITIES[ab].color : d.ch === 'u' ? '#c9a46a' : '#b85050';
      if (open) {
        // an open hatch over a ladder becomes ladder
        if (d.horiz && tiles) for (const [c, r] of d.tiles) if (rawChar(c, r - 1) === 'H' || rawChar(c, r + 1) === 'H') ctx.drawImage(tiles, 4 * 16, 0, 16, 16, c * TILE + ox, r * TILE + oy, 16, 16);
        // a faint frame shows where the door was
        ctx.fillStyle = col; ctx.globalAlpha = 0.35;
        if (d.horiz) { ctx.fillRect(x, y, 2, h); ctx.fillRect(x + w - 2, y, 2, h); } else { ctx.fillRect(x, y, w, 2); ctx.fillRect(x, y + h - 2, w, 2); }
        ctx.globalAlpha = 1;
        continue;
      }
      ctx.fillStyle = '#231a1e'; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#5a4436'; ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
      ctx.fillStyle = '#3a2c28';
      if (d.horiz) for (let i = 4; i < w; i += 6) ctx.fillRect(x + i, y + 1, 2, h - 2);
      else for (let i = 4; i < h; i += 6) ctx.fillRect(x + 1, y + i, w - 2, 2);
      // the rune: the colour of the ability that opens it, pulsing gently
      const cxr = x + w / 2, cyr = y + h / 2, pulse = 0.65 + 0.35 * Math.sin(this.t * 0.08 + d.c);
      ctx.fillStyle = col; ctx.globalAlpha = pulse;
      if (d.ch === 'b') { for (let i = 3; i < (d.horiz ? w : h); i += 5) d.horiz ? ctx.fillRect(x + i, y + 1, 2, h - 2) : ctx.fillRect(x + 1, y + i, w - 2, 2); }
      else if (d.ch === 'u') { ctx.fillRect(x + 1, cyr - 1, w - 2, 3); ctx.fillRect(cxr - 1, y + 1, 3, h - 2); }
      else { ctx.fillRect(Math.round(cxr) - 3, Math.round(cyr) - 3, 6, 6); ctx.fillStyle = '#fff'; ctx.fillRect(Math.round(cxr) - 1, Math.round(cyr) - 1, 2, 2); }
      ctx.globalAlpha = 1;
    }
    // ghost-glass: faint until the lantern makes it solid
    const c0 = room.gx * COLS, r0 = room.gy * ROWS;
    for (let y = 0; y < room.h * ROWS; y++) for (let x = 0; x < room.w * COLS; x++) {
      if (rawChar(c0 + x, r0 + y) !== 'g') continue;
      const lit = g.glassLit(c0 + x, r0 + y);
      const px = (c0 + x) * TILE + ox, py = (r0 + y) * TILE + oy;
      if (px < -16 || px > this.vw || py < -16 || py > this.vh) continue;
      if (lit) {
        ctx.fillStyle = 'rgba(150,200,255,0.85)'; ctx.fillRect(px, py, 16, 16);
        ctx.fillStyle = '#e8f4ff'; ctx.fillRect(px, py, 16, 1); ctx.fillRect(px + 2, py + 3, 1, 6);
        ctx.fillStyle = '#5a78c8'; ctx.fillRect(px, py + 15, 16, 1);
      } else {
        ctx.fillStyle = 'rgba(150,200,255,0.16)'; ctx.fillRect(px, py, 16, 16);
        ctx.fillStyle = `rgba(190,220,255,${0.25 + 0.15 * Math.sin(this.t * 0.05 + x)})`;
        for (let i = 0; i < 16; i += 4) { ctx.fillRect(px + i, py, 2, 1); ctx.fillRect(px + i, py + 15, 2, 1); }
      }
    }
  }

  drawThings(g: BellspireGame, ox: number, oy: number) {
    const room = g.room;
    for (const t of INFO.get(room.id)!.things) {
      const x = t.c * TILE + 8 + ox, y = (t.r + 1) * TILE + oy;
      if (x < -80 || x > this.vw + 80 || y < -40 || y > this.vh + 80) continue;
      if (t.ch === 'S') this.spr('props', g.flag(`shrine:${room.id}`) || g.save.shrine === room.id ? 1 : 0, x, y);
      else if (t.ch === 'B') this.spr('props', 2, x, y);
      else if (t.ch === 'C') this.spr('props', g.flag(`chest:${room.id}:${t.i}`) ? 4 : 3, x, y);
      else if (t.ch === 'R') {
        this.spr('props', 7, x, y);
        const n = room.murals?.[t.i] ?? 0;
        if (!g.flag(`mural:${n}`) && this.t % 60 < 40) { this.ctx.fillStyle = '#ffe27a'; this.ctx.fillRect(x - 1, y - 38, 2, 2); }
      } else if (t.ch === 'M') this.spr('npcs', Math.floor(this.t / 40) % 2, x, y + 2, g.body.x > x - ox);
      else if (t.ch === 'U') this.spr('npcs', 2 + (Math.floor(this.t / 50) % 2), x, y + Math.sin(this.t * 0.04) * 2, g.body.x < x - ox, 0.85);
      else if (t.ch === 'A') {
        const ctx = this.ctx;
        ctx.fillStyle = '#3a2c34'; ctx.fillRect(x - 10, y - 10, 20, 10);
        ctx.fillStyle = '#7a6670'; ctx.fillRect(x - 9, y - 10, 18, 2); ctx.fillRect(x - 7, y - 6, 14, 1);
        if (room.ability && !g.has(room.ability)) this.spr('npcs', 7, x, y - 16 + Math.sin(this.t * 0.06) * 3);
      }
    }
    // the coin bag after a wipe
  }

  drawPickups(g: BellspireGame, ox: number, oy: number) {
    const ctx = this.ctx;
    for (const p of g.pickups) {
      const x = Math.round(p.x + ox), y = Math.round(p.y + oy);
      if (p.kind === 'coin') {
        const w = [3, 2, 1, 2][Math.floor((this.t + p.id * 5) / 6) % 4];
        ctx.fillStyle = '#7a4a10'; ctx.fillRect(x - w, y - 3, w * 2 + 1, 7);
        ctx.fillStyle = '#ffd040'; ctx.fillRect(x - w + 1, y - 2, Math.max(1, w * 2 - 1), 5);
        ctx.fillStyle = '#fff6c0'; ctx.fillRect(x, y - 2, 1, 2);
      } else if (p.kind === 'bag') this.spr('npcs', 6, x, y + 6 + Math.sin(this.t * 0.08) * 1.5);
      else {
        ctx.fillStyle = p.kind === 'mp' ? '#4fa8ff' : '#ff5a6a';
        ctx.fillRect(x - 2, y - 2, 5, 5); ctx.fillStyle = '#fff'; ctx.fillRect(x - 1, y - 1, 1, 1);
      }
    }
  }

  drawEnemies(g: BellspireGame, ox: number, oy: number) {
    for (const e of g.enemies) {
      if (!e.alive || e.hidden) continue;
      const k = FOE_ORDER.indexOf(e.kind);
      const active = e.st === 'tell' || e.st === 'strike' || e.st === 'lunge' || e.st === 'swoop' || e.st === 'hop';
      const f = FOES[e.kind];
      let frame = k * 2 + (active ? 1 : 0);
      if (f.fly && !active) frame = k * 2 + (Math.floor((this.t + e.id * 7) / 10) % 2);
      if (e.kind === 'frog' && (e.st === 'sleep' || e.st === 'wake')) frame = k * 2;
      let x = e.x + ox, y = e.y + oy + (f.fly || f.swim ? (ART.foes[1] - f.h) / 2 - 4 : 1);
      // a tell shivers, so the warning is easy to see
      if (e.st === 'tell') x += (this.t % 4 < 2 ? 1 : -1);
      if (e.kind === 'frog' && e.st === 'sleep') { this.ctx.globalAlpha = 1; }
      this.spr('foes', frame, x, y, e.face > 0, 1, e.flash > 0 && e.flash % 4 < 2);
      if (e.st === 'tell') this.text('!', x, y - f.h - 12, '#ffe27a');
      if (e.kind === 'frog' && e.st === 'sleep' && this.t % 90 < 60) this.text('', x, y - f.h - 8, '#fff');
    }
    void ROOMS;
  }

  heroFrame(g: BellspireGame, hero: HeroId, lead: boolean): { frame: number; flip: boolean; x: number; y: number; alpha: number } {
    if (lead) {
      const b = g.body, rt = g.hero[hero], act = rt.act;
      let frame = 0;
      if (rt.hurtT > 0) frame = 6;
      else if (act && act.kind === 'swing') frame = 8 + act.n;
      else if (act && act.kind === 'thrust') frame = hero === 'dora' ? 11 : 4;
      else if (act && (act.kind === 'whirl' || act.kind === 'tagin')) frame = 8 + (Math.floor(act.t / 4) % 3);
      else if (act && act.kind === 'cast') frame = hero === 'enzo' ? 11 : 10;
      else if (b.dashT > 0) frame = 7;
      else if (b.swim) frame = hero === 'dora' ? 13 + (Math.floor(this.t / 14) % 2) : 14 + (Math.floor(this.t / 14) % 2);
      else if (b.glide) frame = hero === 'enzo' ? 13 : 5;
      else if (b.wall !== 0 && !b.ground && hero === 'dora' && g.has('wallkick')) frame = 12;
      else if (b.climb) frame = 4;
      else if (!b.ground) frame = b.vy < 0 ? 4 : 5;
      else if (Math.abs(b.vx) > 0.3) frame = 1 + (Math.floor(this.t / 6) % 3);
      else if (hero === 'enzo' && g.lanternUp) frame = 12;
      let flip = b.face < 0;
      if (frame === 12 && hero === 'dora') flip = b.wall > 0 ? true : false;
      const blink = rt.inv > 0 && rt.hurtT === 0 && rt.inv < 60 && this.t % 6 < 3;
      return { frame, flip, x: b.x, y: b.y + 1, alpha: blink ? 0.35 : 1 };
    }
    const f = g.follower;
    let frame = f.swim ? (hero === 'dora' ? 13 : 14) + (Math.floor(this.t / 14) % 2) : f.air ? 4 : f.moving ? 1 + (Math.floor(this.t / 6) % 3) : 0;
    if (f.swipeT > 0 && hero === 'dora') frame = 9;
    if (hero === 'enzo' && g.lanternUp && !f.moving && !f.air) frame = 12;
    return { frame, flip: f.face < 0, x: f.x, y: f.y + 1, alpha: 1 };
  }

  drawHeroes(g: BellspireGame, ox: number, oy: number) {
    const lead = g.lead, oth: HeroId = lead === 'dora' ? 'enzo' : 'dora';
    if (!g.save.heroes[oth].down) {
      const f = this.heroFrame(g, oth, false);
      this.spr(oth, f.frame, f.x + ox, f.y + oy, f.flip, 0.92);
    }
    const f = this.heroFrame(g, lead, true);
    this.spr(lead, f.frame, f.x + ox, f.y + oy, f.flip, f.alpha);
    // the swing's arc
    const box = g.attackBox(), act = g.leadRt.act;
    if (box && act && act.kind === 'swing') {
      const ctx = this.ctx, b = g.body;
      const cxh = b.x + ox, cyh = b.y - 15 + oy, r = box.r.w + 2;
      ctx.strokeStyle = lead === 'dora' ? 'rgba(220,250,255,0.9)' : 'rgba(255,214,140,0.9)'; ctx.lineWidth = act.n === 2 ? 3 : 2;
      ctx.beginPath();
      const a0 = act.n === 1 ? -1.6 : -1.1, a1 = act.n === 1 ? 0.3 : 0.9;
      if (b.face > 0) ctx.arc(cxh, cyh, r, a0, a1); else ctx.arc(cxh, cyh, r, Math.PI - a1, Math.PI - a0);
      ctx.stroke();
    }
    if (act && act.kind === 'whirl') { const ctx = this.ctx; ctx.strokeStyle = 'rgba(200,250,255,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(g.body.x + ox, g.body.y - 12 + oy, 26, act.t * 0.5, act.t * 0.5 + 4); ctx.stroke(); }
    if (g.embers) {
      const c = g.lead === 'enzo' ? { x: g.body.x, y: g.body.y - 12 } : { x: g.follower.x, y: g.follower.y - 12 };
      for (let i = 0; i < 8; i++) { const a = g.embers.t * 0.12 + (i * Math.PI) / 4; this.spr('foes', 23, c.x + Math.cos(a) * 34 + ox, c.y + Math.sin(a) * 34 + oy + 24); }
    }
  }

  drawBoss(g: BellspireGame, b: Boss, ox: number, oy: number) {
    const ctx = this.ctx;
    const tell = b.tellT > 0 && Math.floor(b.tellT / 3) % 2 === 0;
    const white = b.flash > 0 && b.flash % 4 < 2;
    const calmA = b.calm ? Math.max(0.25, 1 - b.t / 120) : 1;
    const st = b.st;
    const atk = /hop|tongue|pounce|dash|leap|swing|drop|sweep/.test(st) && !st.endsWith('Tell');
    const fr = st.endsWith('Tell') ? 1 : atk ? 2 : 0;
    const body = b.body;
    const fx: SprFx = { rim: b.calm ? undefined : RIM[b.id], tell: tell && !b.calm };
    if (b.id === 'frog') {
      this.spr('boss-frog', fr, b.x + ox, b.y + oy + 2, b.face > 0, calmA, white, fx);
      if (st === 'tongue') { for (const h of b.harm) { ctx.fillStyle = '#d0506a'; ctx.fillRect(Math.round(h.x + ox), Math.round(h.y + oy + 2), Math.round(h.w), 5); ctx.fillStyle = '#ff8aa0'; ctx.fillRect(Math.round(h.x + ox), Math.round(h.y + oy + 2), Math.round(h.w), 1); } }
    } else if (b.id === 'puma') {
      this.spr('boss-puma', fr, b.x + ox, b.y + oy + 2, b.face > 0, calmA * b.vis, white, fx);
    } else if (b.id === 'mother') {
      this.spr('boss-mother', fr, body.x + 120 + ox, b.y + oy + 2, false, calmA, white, fx);
      if (st === 'sweep' && b.arms[0]) {
        // a rolling wave: a curved crest, higher at the front, with a foam lip and spray
        const a = b.arms[0], x0 = Math.round(a.x - 18 + ox), y0 = Math.round(a.y + oy), dir = g.body.x < a.x ? -1 : 1;
        for (let i = 0; i < 36; i++) {
          const f = dir > 0 ? i / 35 : 1 - i / 35, h = Math.round(5 + 11 * Math.sin(f * Math.PI * 0.85));
          ctx.fillStyle = 'rgba(70,170,190,0.9)'; ctx.fillRect(x0 + i, y0 - h, 1, h);
          ctx.fillStyle = 'rgba(150,235,240,0.95)'; ctx.fillRect(x0 + i, y0 - h, 1, Math.min(3, h));
          if ((i + this.t) % 5 === 0) { ctx.fillStyle = '#f0ffff'; ctx.fillRect(x0 + i, y0 - h - 1 - ((i * 7 + this.t) % 3), 1, 1); }
        }
      }
    } else if (b.id === 'hydra') {
      // necks: thick reed ropes from the coiled body to each head
      const baseX = b.x + ox, baseY = b.y - 70 + oy;
      for (const h of b.heads) {
        const hx = h.x + ox, hy = h.y + oy;
        for (const [w, c] of [[9, '#2a2a14'], [7, '#6a7a2a'], [3, '#a8a050']] as const) {
          ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(baseX, baseY);
          ctx.quadraticCurveTo((baseX + hx) / 2 + 20, Math.min(baseY, hy) - 10, hx + 10, hy + 6); ctx.stroke();
        }
      }
      this.spr('boss-hydra', 0, b.x + ox + 20, b.y + oy + 8, false, calmA, white, { rim: fx.rim });
      for (const h of b.heads) {
        const open = h.st === 'aim' || h.st === 'lunge' || h.st === 'hold';
        const shiver = h.st === 'aim' && this.t % 4 < 2 ? 1 : 0;
        this.spr('hydra-head', open ? 1 : 0, h.x + ox + shiver, h.y + oy + 20, false, calmA, white, { rim: fx.rim, tell: h.st === 'aim' && this.t % 6 < 3 && !b.calm });
      }
    } else if (b.id === 'warden') {
      for (const a of b.arms) {
        const sx = a.x < b.x ? body.x + 14 : body.x + body.w - 14, sy = body.y + 30;
        ctx.strokeStyle = '#2a2024'; ctx.lineWidth = 3; ctx.setLineDash([3, 2]); ctx.beginPath(); ctx.moveTo(sx + ox, sy + oy); ctx.lineTo(a.x + ox, a.y + oy - 8); ctx.stroke(); ctx.setLineDash([]);
        this.spr('warden-bell', 0, a.x + ox, a.y + oy + 12, false, calmA, false, { rim: fx.rim, tell: fx.tell });
      }
      this.spr('boss-warden', st === 'rest' || st === 'drop' || st.endsWith('Tell') ? 1 : 0, b.x + ox, body.y + body.h + oy + 6, false, calmA, white, fx);
    }
    if (tell && !b.calm) this.text('!', body.x + body.w / 2 + ox, body.y - 10 + oy, '#ffe27a');
    // floor markers for falling bells and lilies
    for (const m of g.markers) {
      const k = m.t % 10 < 5;
      ctx.fillStyle = m.kind === 'bell' ? (k ? '#ffd060' : '#a07020') : m.kind === 'aim' ? (k ? '#ff6a5a' : '#902a20') : k ? '#a0ffd0' : '#408060';
      ctx.fillRect(Math.round(m.x - 10 + ox), Math.round(m.y - 2 + oy), 20, 2);
      ctx.fillRect(Math.round(m.x - 1 + ox), Math.round(m.y - 8 + oy), 2, 4);
    }
    for (const w of g.waves) {
      const x = Math.round(w.x + ox), y = Math.round(w.y + oy);
      ctx.fillStyle = 'rgba(255,214,140,0.9)'; ctx.fillRect(x - 3, y - w.h, 6, w.h);
      ctx.fillStyle = '#fff6d0'; ctx.fillRect(x - 1, y - w.h + 2, 2, w.h - 2);
    }
  }

  drawShots(g: BellspireGame, ox: number, oy: number) {
    const ctx = this.ctx;
    for (const s of g.shots) {
      const x = Math.round(s.x + ox), y = Math.round(s.y + oy);
      if (s.kind === 'bolt') this.spr('foes', 23, x, y + 24 - 6, s.vx < 0);
      else if (s.kind === 'mud') this.spr('foes', 21, x, y + 24 - 5);
      else if (s.kind === 'bell') this.spr('foes', 20, x, y + 24 - 10);
      else if (s.kind === 'bubble') { ctx.strokeStyle = 'rgba(200,250,255,0.9)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, s.r, 0, Math.PI * 2); ctx.stroke(); ctx.fillStyle = 'rgba(160,230,240,0.3)'; ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillRect(x - 3, y - 3, 2, 2); }
      else {
        const c = s.kind === 'water' ? ['#2a5aa0', '#7ac0ff'] : s.kind === 'seed' ? ['#3a5a1a', '#a8d050'] : s.kind === 'paint' ? ['#7a3010', '#ff9040'] : s.kind === 'lily' ? ['#3a7a50', '#e8fff0'] : ['#444', '#ccc'];
        ctx.fillStyle = c[0]; ctx.fillRect(x - s.r + 1, y - s.r + 1, s.r * 2 - 2, s.r * 2 - 2);
        ctx.fillStyle = c[1]; ctx.fillRect(x - s.r + 2, y - s.r + 2, s.r - 1, s.r - 1);
      }
    }
  }

  drawWater(g: BellspireGame, ox: number, oy: number) {
    const ctx = this.ctx, room = g.room;
    const surf = g.arenaWater ? surfaceY(room, g.arenaWater.row) : g.waterY.get(room.id);
    if (surf === undefined) return;
    const rr = roomRect(room);
    const y = Math.round(surf + oy);
    if (y > this.vh) return;
    const [r, gg, bb] = WATER_TINT[room.area] ?? WATER_TINT.halls;
    const top = Math.max(0, y);
    ctx.fillStyle = `rgba(${r},${gg},${bb},0.42)`; ctx.fillRect(0, top, this.vw, this.vh - top);
    ctx.fillStyle = `rgba(${r >> 1},${gg >> 1},${bb >> 1},0.25)`; ctx.fillRect(0, Math.max(top, y + 40), this.vw, this.vh);
    if (y >= 0) {
      // the surface: a light line that ripples, with glints
      for (let x = 0; x < this.vw; x += 2) {
        const w = Math.round(Math.sin((x - ox) * 0.07 + this.t * 0.06) * 1.2);
        ctx.fillStyle = 'rgba(210,240,255,0.75)'; ctx.fillRect(x, y + w, 2, 1);
        if (((x - ox) * 7 + this.t) % 97 < 3) { ctx.fillStyle = '#fff'; ctx.fillRect(x, y + w - 1, 1, 1); }
      }
    }
    void rr;
    // floats ride the water
    const tiles = this.img.get('tiles-docks');
    for (const f of g.floatCache) for (let x = f.x0; x < f.x1; x += 16) if (tiles) ctx.drawImage(tiles, 0, 0, 16, 16, Math.round(x + ox), Math.round(f.y + oy), 16, 16);
  }

  drawParticles(ox: number, oy: number) {
    const ctx = this.ctx;
    for (const p of this.particles) {
      p.life++; p.vy += p.g; p.x += p.vx; p.y += p.vy; p.vx *= 0.95;
      ctx.globalAlpha = Math.max(0, 1 - p.life / p.max);
      ctx.fillStyle = p.color; ctx.fillRect(Math.round(p.x + ox), Math.round(p.y + oy), p.size, p.size);
    }
    ctx.globalAlpha = 1;
    this.particles = this.particles.filter((p) => p.life < p.max);
  }

  // ─── lighting ────────────────────────────────────────────────────────────
  lights(g: BellspireGame): Light[] {
    const L: Light[] = [];
    const room = g.room, t = this.t;
    const flick = (k: number) => 0.88 + 0.08 * Math.sin(t * 0.21 + k * 1.7) + 0.04 * Math.sin(t * 0.53 + k * 3.1);
    for (const th of INFO.get(room.id)!.things) {
      const x = th.c * TILE + 8, y = th.r * TILE + 8;
      if (th.ch === 'T') L.push({ x, y: y - 4, r: 112, c: [1, 0.6, 0.28], i: 1.25 * flick(th.c) });
      else if (th.ch === 'i') L.push({ x, y, r: 64, c: [1, 0.7, 0.38], i: 0.95 * flick(th.c + 9) });
      else if (th.ch === 'S') { const lit = g.flag(`shrine:${room.id}`) || g.save.shrine === room.id; L.push({ x, y: y - 8, r: lit ? 110 : 60, c: [1, 0.66, 0.36], i: (lit ? 1.15 : 0.6) * flick(th.c) }); }
      else if (th.ch === 'w') { L.push({ x, y: y + 8, r: 100, c: [0.6, 0.78, 1], i: 0.8 }); L.push({ x: x + 22, y: y + 96, r: 84, c: [0.55, 0.72, 1], i: 0.45, soft: true }); L.push({ x: x + 40, y: y + 170, r: 70, c: [0.55, 0.72, 1], i: 0.3, soft: true }); }
      else if (th.ch === 'A' && room.ability && !g.has(room.ability)) L.push({ x, y: y - 10, r: 70, c: hexRgb(ABILITIES[room.ability].color), i: 1 + 0.2 * Math.sin(t * 0.08) });
      else if (th.ch === 'B') L.push({ x, y: y - 10, r: 50, c: [1, 0.85, 0.5], i: 0.55 });
      else if (th.ch === 'U') L.push({ x, y: y - 10, r: 70, c: [0.5, 0.7, 1], i: 0.8 });
      else if (th.ch === 'M') L.push({ x: x + 10, y: y - 4, r: 70, c: [1, 0.75, 0.45], i: 0.8 * flick(3) });
      else if (th.ch === 'R') L.push({ x, y: y - 6, r: 34, c: [1, 0.85, 0.55], i: 0.5 });
    }
    for (const d of INFO.get(room.id)!.doors) if (!g.doorOpen(d)) {
      const ab = ({ d: 'dash', j: 'double', k: 'wallkick', l: 'lantern', c: 'chime' } as Record<string, keyof typeof ABILITIES>)[d.ch];
      if (ab) L.push({ x: (d.c + d.w / 2) * TILE, y: (d.r + d.h / 2) * TILE, r: 40, c: hexRgb(ABILITIES[ab].color), i: 0.7 });
    }
    for (const e of g.enemies) { const f = FOES[e.kind]; if (e.alive && !e.hidden && f.light) L.push({ x: e.x, y: e.y - f.h / 2, r: f.light[3], c: [f.light[0], f.light[1], f.light[2]], i: 0.9 }); }
    for (const s of g.shots) if (s.kind === 'bolt') L.push({ x: s.x, y: s.y, r: 50, c: [1, 0.7, 0.35], i: 1.1 }); else if (s.kind === 'bell') L.push({ x: s.x, y: s.y, r: 30, c: [1, 0.8, 0.4], i: 0.6 });
    if (g.embers) { const c = g.lead === 'enzo' ? g.body : g.follower; L.push({ x: c.x, y: c.y - 12, r: 80, c: [1, 0.55, 0.25], i: 1.1 }); }
    for (const p of this.pulses) L.push({ x: p.x, y: p.y, r: p.r * (0.4 + p.t / 30), c: p.c, i: 0.9 * (1 - p.t / 24) });
    // the water glows teal along its surface
    const surf = g.arenaWater ? surfaceY(room, g.arenaWater.row) : g.waterY.get(room.id);
    if (surf !== undefined) { const rr = roomRect(room); for (let x = rr.x + 48; x < rr.x + rr.w; x += 96) L.push({ x, y: surf + 10, r: 72, c: [0.3, 0.85, 0.8], i: 0.32, soft: true }); }
    // a sword or staff swing flashes on the walls nearby
    const act = g.leadRt.act;
    if (act && (act.kind === 'swing' || act.kind === 'thrust' || act.kind === 'whirl') && act.t < 8) L.push({ x: g.body.x + g.body.face * 16, y: g.body.y - 16, r: 72, c: g.lead === 'dora' ? [0.85, 0.95, 1] : [1, 0.85, 0.6], i: 0.9 * (1 - act.t / 8) });
    // the heroes always glow a little, so they can be seen in the dark
    L.push({ x: g.body.x, y: g.body.y - 18, r: 40, c: [0.85, 0.85, 1], i: 0.3 });
    // Enzo's lantern
    if (g.lanternR > 1) { const e = g.enzoPos(); L.push({ x: e.x, y: e.y - 10, r: g.lanternR, c: [1, 0.8, 0.5], i: (g.lanternUp ? 1.15 : 0.9) * (0.96 + 0.04 * Math.sin(t * 0.3)), soft: g.lanternUp }); }
    if (g.wisp.on) L.push({ x: g.wisp.x, y: g.wisp.y, r: 44, c: [0.7, 0.95, 1], i: 0.9 });
    if (g.boss?.id === 'warden' && (g.boss.st === 'rest' || g.boss.st === 'drop')) { const bd = g.boss.body; L.push({ x: bd.x + bd.w / 2, y: bd.y + bd.h - 10, r: 120, c: [1, 0.6, 0.25], i: 1 }); }
    // a key light on a guardian in a fight, so it reads against the dimmed room
    if (g.boss && !g.boss.calm && g.boss.st !== 'wait') { const bd = g.boss.body; L.push({ x: bd.x + bd.w / 2, y: bd.y + bd.h * 0.35, r: Math.max(bd.w, bd.h) * 0.9 + 50, c: [1, 0.95, 0.85], i: 0.42, soft: true }); }
    if (g.boss?.id === 'mother') L.push({ x: g.boss.body.x + 35, y: g.boss.body.y + 30, r: 160, c: [0.4, 0.9, 0.9], i: 0.7 });
    return L;
  }

  drawLight(g: BellspireGame, cx: number, cy: number) {
    const room = g.room;
    let amb = AREAS[room.area].ambient;
    if (room.dark) amb = [Math.max(0.2, amb[0] * 0.5), Math.max(0.19, amb[1] * 0.5), Math.max(0.27, amb[2] * 0.6)]; // a floor, so walls never vanish
    else amb = [Math.min(1, amb[0] * 1.35), Math.min(1, amb[1] * 1.35), Math.min(1, amb[2] * 1.35)];
    const lights = this.lights(g);
    const W = this.light.width, H = this.light.height, d = this.ldata.data, gd = this.gdata.data;
    const surf = g.arenaWater ? surfaceY(room, g.arenaWater.row) : g.waterY.get(room.id);
    const LX = new Float32Array(lights.length), LY = new Float32Array(lights.length), LR2 = new Float32Array(lights.length), LS = lights.map((l) => !!l.soft);
    lights.forEach((l, i) => { LX[i] = (l.x - cx) / 2; LY[i] = (l.y - cy) / 2; LR2[i] = (l.r / 2) ** 2; });
    const t = this.t;
    for (let y = 0; y < H; y++) {
      const wy = cy + y * 2;
      const under = surf !== undefined && wy > surf;
      for (let x = 0; x < W; x++) {
        let r = amb[0], gg = amb[1], b = amb[2];
        for (let i = 0; i < lights.length; i++) {
          const dx = x - LX[i], dy = y - LY[i], q = dx * dx + dy * dy;
          if (q >= LR2[i]) continue;
          const f = 1 - q / LR2[i], k = (LS[i] ? Math.min(1, f * 1.6) * (0.55 + 0.45 * f) : f * f) * lights[i].i;
          r += lights[i].c[0] * k; gg += lights[i].c[1] * k; b += lights[i].c[2] * k;
        }
        if (under) {
          // caustics: soft moving bands of light under the water
          const wx = cx + x * 2;
          const c = Math.sin(wx * 0.09 + t * 0.05) * Math.sin(wy * 0.11 - t * 0.04) + Math.sin((wx + wy) * 0.05 + t * 0.03);
          const k = c > 1.15 && c < 1.4 ? 0.14 : c > 0.95 && c < 1.15 ? 0.05 : 0; // thin bright threads, not blotches
          r += k * 0.6; gg += k * 0.9; b += k;
        }
        // a soft knee above full light, so stacked lights glow without burning the sprites to white
        if (r > 1) r = 1 + (r - 1) / (1 + (r - 1) * 1.5);
        if (gg > 1) gg = 1 + (gg - 1) / (1 + (gg - 1) * 1.5);
        if (b > 1) b = 1 + (b - 1) / (1 + (b - 1) * 1.5);
        // bands: light falls off in steps, like hand-placed pixel shading
        r = Math.round(r * 10) / 10; gg = Math.round(gg * 10) / 10; b = Math.round(b * 10) / 10;
        const o = (y * W + x) * 4;
        d[o] = Math.min(255, r * 255); d[o + 1] = Math.min(255, gg * 255); d[o + 2] = Math.min(255, b * 255); d[o + 3] = 255;
        gd[o] = Math.max(0, r - 1) * 100; gd[o + 1] = Math.max(0, gg - 1) * 100; gd[o + 2] = Math.max(0, b - 1) * 100; gd[o + 3] = 255;
      }
    }
    this.lctx.putImageData(this.ldata, 0, 0);
    this.gctx.putImageData(this.gdata, 0, 0);
    const ctx = this.ctx;
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(this.light, 0, 0, W * 2, H * 2);
    ctx.globalCompositeOperation = 'lighter';
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.glow, 0, 0, W * 2, H * 2);
    ctx.imageSmoothingEnabled = false;
    ctx.globalCompositeOperation = 'source-over';
  }

  /** God rays from windows and dust motes drifting through them. */
  drawRays(g: BellspireGame, ox: number, oy: number) {
    const ctx = this.ctx;
    ctx.globalCompositeOperation = 'lighter';
    for (const th of INFO.get(g.room.id)!.things) {
      if (th.ch !== 'w') continue;
      const x = th.c * TILE + 8 + ox, y = th.r * TILE + oy;
      if (x < -200 || x > this.vw + 200) continue;
      for (let i = 0; i < 3; i++) {
        const a = 0.05 + 0.02 * Math.sin(this.t * 0.02 + i * 2);
        ctx.fillStyle = `rgba(190,215,255,${a})`;
        ctx.beginPath(); ctx.moveTo(x - 6 + i * 4, y - 10); ctx.lineTo(x + 2 + i * 4, y - 10); ctx.lineTo(x + 70 + i * 16, y + 150); ctx.lineTo(x + 40 + i * 16, y + 150); ctx.closePath(); ctx.fill();
      }
      for (let i = 0; i < 10; i++) {
        const k = hash(th.c, i), p = ((this.t * (0.3 + (k % 5) * 0.06) + (k % 200)) % 150) / 150;
        const mx = x + 10 + p * 60 + ((k >> 4) % 30) + Math.sin(this.t * 0.03 + i) * 3, my = y + p * 140;
        ctx.fillStyle = `rgba(255,250,220,${0.5 * Math.sin(p * Math.PI)})`; ctx.fillRect(Math.round(mx), Math.round(my), 1, 1);
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  }
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export { surfaceRow, HERO_H, ABILITY_ORDER, groupAt };
