// Pawhaven's isometric town in Canvas 2D: terrain cached to its own canvas, then trees, buildings, walkers and foxes drawn
// back to front each frame. Drawing only; the page owns the game, the camera and the input.
import { drawChinchilla, coatLike, type Coat } from './chinchilla-art';
import {
  BUILDINGS, FERTILE, GRASS, MONTH, PAVED, PUDDLE, ROAD, ROCK, SAND, TREES, VISIT, WATER,
  type Building, type Good, type Kind, type PawhavenGame, type Service, type Walker,
} from './pawhaven-game';

/** World pixels: a tile is TW wide and TH tall on screen at zoom 1. */
export const TW = 64, TH = 32;
const HW = TW / 2, HH = TH / 2;
/** Room above the top row of the terrain canvas for tall things at the back. */
const PAD = 160;

export type View = { x: number; y: number; zoom: number };
export type Overlay = 'none' | 'water' | 'food' | 'dust' | 'pretty' | 'fire';
export type Ghost = { kind: Kind | 'clear'; tiles: { x: number; y: number; ok: boolean }[]; size: number } | null;

const INK = '#4a3628';
const GOOD_COLORS: Record<Good, string> = {
  berries: '#c8435a', hay: '#e7c45e', oats: '#efe2b0', wood: '#9a6a3c', clay: '#c47a4f', sand: '#ead39a', dust: '#d9cfe6',
  pottery: '#d0784a', toys: '#6fa6dc', bedding: '#f0b3c4',
};
/** What a helper carries, so a street's visitors can be told apart at a glance. */
const JOB: Record<Service, { color: string; trim: string }> = {
  water: { color: '#5aa7d8', trim: '#d9f0fb' }, dust: { color: '#c9b8e8', trim: '#f4effb' }, healer: { color: '#6db36b', trim: '#e3f5dc' },
  story: { color: '#d4574e', trim: '#fde6d8' }, music: { color: '#e09a3a', trim: '#fff0cc' }, fire: { color: '#e5603b', trim: '#ffe0c8' },
  seller: { color: '#e6b23e', trim: '#fff3c9' },
};
const COATS: Coat[] = [
  coatLike('dora', {}), coatLike('enzo', {}),
  coatLike('enzo', { fur: '#c9b49c', back: '#b39a7d', face: '#d8c5b0', shade: '#a68d72', texture: '#ad9378', tail: '#c4ad94', tailOuter: '#ad9378', tailInner: '#dccbb6' }),
  coatLike('enzo', { fur: '#3f3c44', back: '#2c2a31', face: '#55525c', shade: '#34323a', texture: '#2f2d34', tail: '#3a3840', tailOuter: '#2a282f', tailInner: '#5c5963' }),
  coatLike('dora', { fur: '#e9e3ef', back: '#d8d0e2', face: '#f2eef6', shade: '#cfc5dc', tail: '#e4dcec', tailInner: '#d0c6dc' }),
  coatLike('enzo', { fur: '#9b8d9e', back: '#7f7183', face: '#ada0b0', shade: '#857789', texture: '#7a6c7e', tail: '#988a9b', tailOuter: '#7a6c7e', tailInner: '#bcb0be' }),
];
const STONE = coatLike('enzo', { fur: '#b9b4ab', back: '#a7a198', face: '#c6c1b8', shade: '#9b958c', texture: '#a29c93', belly: '#cfcac2', tail: '#b3ada4', tailOuter: '#9f998f', tailInner: '#cbc6be', eye: '#77726b', pupil: '#5d5952', bands: false, streaks: false });

/** A small deterministic hash for per-tile variety. */
const hash = (a: number, b = 0) => { let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35); h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; return (h >>> 0) / 4294967296; };
const shade = (hex: string, k: number) => {
  const n = parseInt(hex.slice(1), 16), f = (v: number) => Math.max(0, Math.min(255, Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k))));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
};

export type PawhavenScene = ReturnType<typeof createPawhavenScene>;

export function createPawhavenScene(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')!;
  let w = 1, h = 1, dpr = 1, time = 0, drawn = 0;
  // the terrain canvas is rebuilt when terrain, roads or fences change
  const ground = document.createElement('canvas'), gctx = ground.getContext('2d')!;
  let groundFor: PawhavenGame | null = null, sig = '', water: number[] = [], trees: number[] = [], rocks: number[] = [];
  const treeSprites: HTMLCanvasElement[] = [];
  // painted building sprites, drawn in place of the shapes once they have loaded (the shapes stay as the fallback)
  const painted = new Map<string, HTMLImageElement>(), icons = new Map<string, string>();
  // homes come in three looks per level, picked by the plot so a street isn't one house over and over
  const spriteName = (b: { kind: Kind; level: number; id: number }) => {
    if (b.kind !== 'home') return b.kind;
    const v = ['', 'b', 'c'][Math.floor(hash(b.id, 13) * 3)], n = `home-${b.level}${v}`;
    return painted.has(n) ? n : `home-${b.level}`;
  };
  for (const k of Object.keys(BUILDINGS) as Kind[]) {
    if (k === 'road' || k === 'fence' || k === 'hayFarm' || k === 'oatFarm') continue;
    for (const name of k === 'home' ? [1, 2, 3, 4, 5, 6, 7].flatMap((l) => [`home-${l}`, `home-${l}b`, `home-${l}c`]) : [k]) {
      const img = new Image(); img.decoding = 'async'; img.src = `/art/pawhaven/sprites/${name}.webp`;
      img.onload = () => { painted.set(name, img); icons.clear(); };
    }
  }

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1); w = Math.max(1, canvas.clientWidth); h = Math.max(1, canvas.clientHeight);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  }
  const observer = new ResizeObserver(resize); observer.observe(canvas); resize();

  // ---------- projection ----------
  /** The top corner of tile (x, y), in world pixels relative to the map's top corner. */
  const iso = (x: number, y: number) => ({ sx: (x - y) * HW, sy: (x + y) * HH });
  function toScreen(v: View, wx: number, wy: number) { return { x: (wx - v.x) * v.zoom + w / 2, y: (wy - v.y) * v.zoom + h / 2 }; }
  /** The tile under a screen point (fractional), for picking. */
  function pick(v: View, px: number, py: number) {
    const wx = (px - w / 2) / v.zoom + v.x, wy = (py - h / 2) / v.zoom + v.y;
    return { x: (wy / HH + wx / HW) / 2, y: (wy / HH - wx / HW) / 2 };
  }
  /** The world point at the centre of the map, for starting the camera. */
  const centre = (g: PawhavenGame) => iso(g.size / 2, g.size / 2);

  // ---------- small drawing helpers ----------
  function diamond(c: CanvasRenderingContext2D, x: number, y: number, sx = 1, sy = 1) {
    const a = iso(x, y), b = iso(x + sx, y), d = iso(x + sx, y + sy), e = iso(x, y + sy);
    c.beginPath(); c.moveTo(a.sx, a.sy); c.lineTo(b.sx, b.sy); c.lineTo(d.sx, d.sy); c.lineTo(e.sx, e.sy); c.closePath();
  }
  /** An upright box on a plot: left and right walls and a flat top, `hgt` world pixels tall, inset by `pad` tiles. */
  function box(c: CanvasRenderingContext2D, x: number, y: number, s: number, hgt: number, wall: string, top: string, pad = 0.12) {
    const x0 = x + pad, y0 = y + pad, s0 = s - pad * 2;
    const L = iso(x0, y0 + s0), B = iso(x0 + s0, y0 + s0), R = iso(x0 + s0, y0), T = iso(x0, y0);
    c.lineWidth = 1.4; c.strokeStyle = INK; c.lineJoin = 'round';
    c.fillStyle = shade(wall, -0.12); c.beginPath(); c.moveTo(L.sx, L.sy); c.lineTo(B.sx, B.sy); c.lineTo(B.sx, B.sy - hgt); c.lineTo(L.sx, L.sy - hgt); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = shade(wall, -0.28); c.beginPath(); c.moveTo(B.sx, B.sy); c.lineTo(R.sx, R.sy); c.lineTo(R.sx, R.sy - hgt); c.lineTo(B.sx, B.sy - hgt); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = top; c.beginPath(); c.moveTo(T.sx, T.sy - hgt); c.lineTo(R.sx, R.sy - hgt); c.lineTo(B.sx, B.sy - hgt); c.lineTo(L.sx, L.sy - hgt); c.closePath(); c.fill(); c.stroke();
    return { L, B, R, T, hgt };
  }
  /** A pitched roof over a box: the ridge runs along the plot's x axis. */
  function roof(c: CanvasRenderingContext2D, x: number, y: number, s: number, base: number, rise: number, col: string, pad = 0.04) {
    const x0 = x + pad, y0 = y + pad, s0 = s - pad * 2, m = s0 / 2;
    const L = iso(x0, y0 + s0), B = iso(x0 + s0, y0 + s0), R = iso(x0 + s0, y0), T = iso(x0, y0), r1 = iso(x0, y0 + m), r2 = iso(x0 + s0, y0 + m);
    c.lineWidth = 1.4; c.strokeStyle = INK;
    c.fillStyle = shade(col, 0.08); c.beginPath(); c.moveTo(L.sx, L.sy - base); c.lineTo(B.sx, B.sy - base); c.lineTo(r2.sx, r2.sy - base - rise); c.lineTo(r1.sx, r1.sy - base - rise); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = shade(col, -0.25); c.beginPath(); c.moveTo(B.sx, B.sy - base); c.lineTo(R.sx, R.sy - base); c.lineTo(r2.sx, r2.sy - base - rise); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = shade(col, -0.05); c.beginPath(); c.moveTo(T.sx, T.sy - base); c.lineTo(R.sx, R.sy - base); c.lineTo(r2.sx, r2.sy - base - rise); c.lineTo(r1.sx, r1.sy - base - rise); c.closePath(); c.fill(); c.stroke();
  }
  /** A cone roof (thatch or a tower's cap) centred on a plot. */
  function cone(c: CanvasRenderingContext2D, cx: number, cy: number, rx: number, rise: number, col: string) {
    c.fillStyle = col; c.strokeStyle = INK; c.lineWidth = 1.4;
    c.beginPath(); c.moveTo(cx - rx, cy); c.quadraticCurveTo(cx - rx * 0.4, cy - rise * 0.55, cx, cy - rise); c.quadraticCurveTo(cx + rx * 0.4, cy - rise * 0.55, cx + rx, cy);
    c.ellipse(cx, cy, rx, rx * 0.45, 0, 0, Math.PI); c.closePath(); c.fill(); c.stroke();
    c.strokeStyle = shade(col, -0.25); c.lineWidth = 1; for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(cx, cy - rise + 3); c.lineTo(cx + i * rx * 0.35, cy + rx * 0.2 - Math.abs(i) * 2); c.stroke(); }
  }
  function blob(c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: string, stroke = true) {
    c.fillStyle = fill; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill(); if (stroke) { c.strokeStyle = INK; c.lineWidth = 1.2; c.stroke(); }
  }
  function sign(c: CanvasRenderingContext2D, x: number, y: number, glyph: string, color: string) {
    c.fillStyle = '#fff8e8'; c.strokeStyle = INK; c.lineWidth = 1.2; c.beginPath(); c.arc(x, y, 9, 0, Math.PI * 2); c.fill(); c.stroke();
    c.fillStyle = color; c.beginPath(); c.arc(x, y, 7, 0, Math.PI * 2); c.fill();
    c.font = '10px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(glyph, x, y + 0.5);
  }
  /** The centre of a plot's top face, at ground level. */
  const mid = (b: { x: number; y: number; size: number }) => iso(b.x + b.size / 2, b.y + b.size / 2);

  // ---------- trees ----------
  function treeSprite(v: number) {
    const cnv = document.createElement('canvas'); cnv.width = 64; cnv.height = 80; const c = cnv.getContext('2d')!;
    c.translate(32, 72);
    c.fillStyle = '#00000022'; c.beginPath(); c.ellipse(0, 0, 18, 7, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#8a5a34'; c.strokeStyle = INK; c.lineWidth = 1.4; c.beginPath(); c.moveTo(-4, 0); c.lineTo(-3, -22); c.lineTo(3, -22); c.lineTo(4, 0); c.closePath(); c.fill(); c.stroke();
    const greens = [['#5f9e48', '#7fbd5a', '#9fd46e'], ['#4f8f45', '#6aaa52', '#8cc766'], ['#6aa34a', '#8cbf55', '#b2d871']][v % 3];
    const puffs: [number, number, number][] = [[-10, -30, 13], [10, -31, 13], [0, -44, 15], [-4, -34, 12], [6, -40, 11]];
    for (const [x, y, r] of puffs) blob(c, x, y, r, r * 0.92, greens[0]);
    for (const [x, y, r] of puffs) { c.fillStyle = greens[1]; c.beginPath(); c.ellipse(x - 2, y - 2, r * 0.75, r * 0.7, 0, 0, Math.PI * 2); c.fill(); }
    c.fillStyle = greens[2]; for (const [x, y, r] of puffs.slice(2)) { c.beginPath(); c.ellipse(x - 4, y - 5, r * 0.35, r * 0.28, -0.4, 0, Math.PI * 2); c.fill(); }
    if (v % 4 === 1) { c.fillStyle = '#e8544a'; for (const [x, y] of [[-8, -30], [6, -36], [0, -46], [11, -28]]) { c.beginPath(); c.arc(x, y, 2.2, 0, Math.PI * 2); c.fill(); } }
    return cnv;
  }
  for (let i = 0; i < 4; i++) treeSprites.push(treeSprite(i));

  // ---------- the terrain canvas ----------
  const GROUND: Record<number, string> = { [GRASS]: '#a6d16c', [FERTILE]: '#86a84a', [WATER]: '#6db6d8', [ROCK]: '#b7b0a3', [TREES]: '#97c463', [SAND]: '#ecd8a0' };
  function buildGround(g: PawhavenGame) {
    const N = g.size;
    ground.width = N * TW + 2; ground.height = N * TH + PAD + 8;
    const c = gctx; c.setTransform(1, 0, 0, 1, N * HW + 1, PAD); c.clearRect(-N * HW - 1, -PAD, ground.width, ground.height);
    water = []; trees = []; rocks = [];
    for (let s = 0; s < N * 2 - 1; s++) for (let y = Math.max(0, s - N + 1); y <= Math.min(N - 1, s); y++) {
      const x = s - y, i = y * N + x, t = g.terrain[i], r = hash(i, 7);
      if (t === WATER) water.push(i); else if (t === TREES) trees.push(i); else if (t === ROCK) rocks.push(i);
      diamond(c, x, y); c.fillStyle = shade(GROUND[t], (r - 0.5) * 0.08); c.fill();
      const a = iso(x, y);
      if (t === GRASS || t === TREES) { c.strokeStyle = shade(GROUND[t], -0.18); c.lineWidth = 1; for (let k = 0; k < 3; k++) { const u = hash(i, k), v2 = hash(i, k + 9), px = a.sx + (u - v2) * HW * 0.8, py = a.sy + HH + (u + v2 - 1) * HH * 0.8; c.beginPath(); c.moveTo(px, py); c.lineTo(px - 1.5, py - 4); c.moveTo(px + 1, py); c.lineTo(px + 2.5, py - 3.5); c.stroke(); } if (r > 0.86) { c.fillStyle = ['#fff7e8', '#f6c2d4', '#fbe07a'][Math.floor(r * 100) % 3]; c.beginPath(); c.arc(a.sx + (r - 0.9) * 200, a.sy + HH + 2, 1.8, 0, Math.PI * 2); c.fill(); } }
      else if (t === FERTILE) { c.strokeStyle = '#6e8f3b'; c.lineWidth = 1; for (let k = 1; k < 4; k++) { const p = iso(x + k / 4, y), q = iso(x + k / 4, y + 1); c.beginPath(); c.moveTo(p.sx, p.sy); c.lineTo(q.sx, q.sy); c.stroke(); } }
      else if (t === SAND) { c.fillStyle = '#d8c083'; for (let k = 0; k < 5; k++) { const u = hash(i, k), v2 = hash(i, k + 3); c.fillRect(a.sx + (u - v2) * HW * 0.8, a.sy + HH + (u + v2 - 1) * HH * 0.8, 1.6, 1.2); } }
      else if (t === WATER) { c.strokeStyle = '#9fd4ea'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(a.sx - 8 + r * 6, a.sy + HH); c.quadraticCurveTo(a.sx - 2 + r * 6, a.sy + HH - 3, a.sx + 4 + r * 6, a.sy + HH); c.stroke(); }
      // water's edge: a soft sandy bank where water meets land
      if (t === WATER) for (const [dx, dy, from, to] of [[0, -1, 0, 1], [1, 0, 1, 2], [0, 1, 2, 3], [-1, 0, 3, 0]] as const) {
        const nx = x + dx, ny = y + dy; if (!g.inside(nx, ny) || g.terrain[ny * N + nx] === WATER) continue;
        const cs = [iso(x, y), iso(x + 1, y), iso(x + 1, y + 1), iso(x, y + 1)];
        c.strokeStyle = '#e9dcae'; c.lineWidth = 3; c.beginPath(); c.moveTo(cs[from].sx, cs[from].sy); c.lineTo(cs[to].sx, cs[to].sy); c.stroke();
      }
      // roads and plazas
      const rd = g.road[i];
      if (rd === ROAD || rd === PUDDLE) {
        diamond(c, x + 0.06, y + 0.06, 0.88, 0.88); c.fillStyle = shade('#d9b98a', (r - 0.5) * 0.08); c.fill(); c.strokeStyle = '#b8946a'; c.lineWidth = 1; c.stroke();
        c.fillStyle = '#c4a072'; for (let k = 0; k < 3; k++) { const u = hash(i, k + 20), v2 = hash(i, k + 30); c.beginPath(); c.ellipse(a.sx + (u - v2) * HW * 0.6, a.sy + HH + (u + v2 - 1) * HH * 0.6, 2, 1.2, 0, 0, Math.PI * 2); c.fill(); }
        if (rd === PUDDLE) { c.fillStyle = '#7fbfdd'; c.strokeStyle = '#5f9fbf'; c.beginPath(); c.ellipse(a.sx, a.sy + HH, HW * 0.45, HH * 0.45, 0, 0, Math.PI * 2); c.fill(); c.stroke(); }
      } else if (rd === PAVED) {
        diamond(c, x, y); c.fillStyle = '#d8d2c4'; c.fill(); c.strokeStyle = '#b4ab9a'; c.lineWidth = 1;
        for (let k = 1; k < 3; k++) { const p = iso(x + k / 3, y), q = iso(x + k / 3, y + 1), p2 = iso(x, y + k / 3), q2 = iso(x + 1, y + k / 3); c.beginPath(); c.moveTo(p.sx, p.sy); c.lineTo(q.sx, q.sy); c.moveTo(p2.sx, p2.sy); c.lineTo(q2.sx, q2.sy); c.stroke(); }
      }
    }
    // the ways in and out get a little signpost on the ground
    groundFor = g;
  }
  function signature(g: PawhavenGame) {
    // cheap: roads, fences and terrain only change with the player's actions or a storm
    let a = 0, b = 0;
    for (let i = 0; i < g.road.length; i++) { a = (Math.imul(a, 31) + g.road[i] * 7 + g.terrain[i]) | 0; b = (b + g.fence[i] * (i + 1)) | 0; }
    return `${g.size}:${a}:${b}`;
  }

  // ---------- buildings ----------
  function home(c: CanvasRenderingContext2D, b: Building) {
    const m = mid(b), cx = m.sx, cy = m.sy;
    switch (b.level) {
      case 1: blob(c, cx, cy + 2, 18, 9, '#00000018', false); blob(c, cx, cy - 3, 16, 10, '#e7c45e'); c.strokeStyle = '#c9a33f'; c.lineWidth = 1; for (let k = -2; k <= 2; k++) { c.beginPath(); c.moveTo(cx + k * 5, cy - 11); c.lineTo(cx + k * 6, cy + 3); c.stroke(); } blob(c, cx + 2, cy, 4, 3, '#5a4030', false); break;
      case 2: box(c, b.x, b.y, 1, 12, '#a7774a', '#b98a5a', 0.24); cone(c, cx, cy - 10, 17, 18, '#c99a5a'); blob(c, cx - 5, cy + 1, 3, 4.5, '#4a3020', false); break;
      case 3: case 4: {
        blob(c, cx, cy + 3, 22, 10, '#00000018', false); blob(c, cx, cy - 4, 20, 13, b.level === 3 ? '#8cc062' : '#9cc56b');
        c.fillStyle = '#6aa04a'; for (let k = 0; k < 6; k++) { c.beginPath(); c.arc(cx - 14 + k * 5.5, cy - 12 + Math.abs(k - 2.5) * 1.6, 2.2, 0, Math.PI * 2); c.fill(); }
        blob(c, cx - 4, cy, 6, 6.5, '#5a4030'); blob(c, cx - 4, cy + 1, 4.5, 5, '#3a281c', false);
        if (b.level === 4) { blob(c, cx + 13, cy + 5, 7, 3.5, '#d9cfe6'); blob(c, cx + 13, cy + 4.5, 5, 2.2, '#f4effb', false); }
        break;
      }
      case 5: { box(c, b.x, b.y, 1, 16, '#f2e3c4', '#f2e3c4', 0.14); cone(c, cx, cy - 15, 25, 20, '#d9b25c'); blob(c, cx - 7, cy + 2, 3, 5, '#7a5034', false); blob(c, cx + 8, cy - 2, 3, 3, '#9fd0f2'); break; }
      case 6: { box(c, b.x, b.y, 1, 20, '#f6ead2', '#f6ead2', 0.12); roof(c, b.x, b.y, 1, 20, 13, '#c95a4a', 0.06); blob(c, cx - 7, cy + 3, 3, 5.5, '#7a5034', false); c.fillStyle = '#e46d8a'; for (const k of [-11, -9, 9, 11]) { c.beginPath(); c.arc(cx + k, cy - 2 + (k > 0 ? -3 : 3), 2, 0, Math.PI * 2); c.fill(); } break; }
      default: {
        box(c, b.x, b.y, 1, 30, '#fbf3e2', '#fbf3e2', 0.1); roof(c, b.x, b.y, 1, 30, 15, '#5a7fc0', 0.04);
        c.fillStyle = '#7a5034'; c.fillRect(cx + 8, cy - 46, 4, 9); c.strokeStyle = INK; c.strokeRect(cx + 8, cy - 46, 4, 9);
        for (const [dx, dy] of [[-12, -16], [-4, -12], [6, -12]]) { c.fillStyle = '#9fd0f2'; c.fillRect(cx + dx, cy + dy, 4, 5); c.strokeStyle = INK; c.lineWidth = 1; c.strokeRect(cx + dx, cy + dy, 4, 5); }
        c.strokeStyle = INK; c.beginPath(); c.moveTo(cx - 3, cy - 44); c.lineTo(cx - 3, cy - 58); c.stroke(); c.fillStyle = '#e6b23e'; c.beginPath(); c.moveTo(cx - 3, cy - 58); c.lineTo(cx + 7, cy - 55); c.lineTo(cx - 3, cy - 52); c.closePath(); c.fill(); c.stroke();
      }
    }
    if (b.away && time % 1.2 < 0.6) { c.font = 'bold 11px system-ui'; c.fillStyle = INK; c.textAlign = 'center'; c.fillText('…', cx, cy - 30); }
  }

  function field(c: CanvasRenderingContext2D, b: Building, crop: string) {
    diamond(c, b.x + 0.05, b.y + 0.05, b.size - 0.1, b.size - 0.1); c.fillStyle = '#8a6a45'; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.2; c.stroke();
    const grown = Math.min(1, b.prog + ((b.store[BUILDINGS[b.kind].makes!] ?? 0) > 0 ? 1 : 0));
    for (let r = 0; r < 6; r++) for (let k = 0; k < 7; k++) {
      const p = iso(b.x + 0.3 + r * 0.42, b.y + 0.25 + k * 0.38), sway = Math.sin(time * 2 + r + k) * 1.2, hgt = 3 + grown * 8;
      c.strokeStyle = shade(crop, -0.25); c.lineWidth = 1.6; c.beginPath(); c.moveTo(p.sx, p.sy); c.lineTo(p.sx + sway, p.sy - hgt); c.stroke();
      if (grown > 0.6) { c.fillStyle = crop; c.beginPath(); c.ellipse(p.sx + sway, p.sy - hgt, 1.6, 2.6, 0, 0, Math.PI * 2); c.fill(); }
    }
    // a little shed at the back corner
    box(c, b.x, b.y, 1, 14, '#c9935a', '#c9935a', 0.18); roof(c, b.x, b.y, 1, 14, 9, '#b4553f', 0.12);
  }

  function building(c: CanvasRenderingContext2D, g: PawhavenGame, b: Building) {
    const m = mid(b), cx = m.sx, cy = m.sy, s = b.size;
    // a soft shadow under everything
    diamond(c, b.x + 0.08, b.y + 0.16, s - 0.08, s - 0.08); c.fillStyle = '#00000014'; c.fill();
    const art = painted.get(spriteName(b));
    if (art) {
      // the sprite's bottom centre is the front corner of the plot, and it spans the plot's width
      const front = iso(b.x + s, b.y + s), w2 = s * TW, k = w2 / art.naturalWidth, h2 = art.naturalHeight * k;
      const left = front.sx - w2 / 2, top = front.sy - h2 + 2, busy = b.workers > 0 || (b.kind === 'home' && b.pop > 0);
      // a working building breathes: a slow squash from its base, so the town never sits quite still
      const sq = busy && b.kind !== 'pond' && b.kind !== 'plaza' && b.kind !== 'garden' ? Math.sin(time * 2.2 + hash(b.id, 2) * 6) * 0.012 : 0;
      c.save(); c.translate(front.sx, front.sy); c.scale(1 - sq * 0.5, 1 + sq); c.translate(-front.sx, -front.sy);
      c.drawImage(art, left, top, w2, h2); c.restore();
      liven(c, b, spriteName(b), left, top, k, busy);
      if (b.kind === 'home' && b.away && time % 1.2 < 0.6) { c.font = 'bold 11px system-ui'; c.fillStyle = INK; c.textAlign = 'center'; c.fillText('…', cx, cy - 34); }
    } else switch (b.kind) {
      case 'home': home(c, b); break;
      case 'well': { blob(c, cx, cy, 12, 6, '#a9a39a'); blob(c, cx, cy - 1, 8, 4, '#5aa7d8', false); c.strokeStyle = INK; c.lineWidth = 2; c.beginPath(); c.moveTo(cx - 10, cy); c.lineTo(cx - 10, cy - 20); c.lineTo(cx + 10, cy - 20); c.lineTo(cx + 10, cy); c.stroke(); cone(c, cx, cy - 18, 14, 9, '#b4553f'); break; }
      case 'tower': { const t = box(c, b.x + 0.5, b.y + 0.5, 1, 34, '#c9935a', '#c9935a', 0.15); blob(c, cx, t.T.sy - 34 + HH * 0.85, 22, 11, '#5aa7d8'); cone(c, cx, cy - 46, 24, 16, '#b4553f'); sign(c, cx, cy - 22, '💧', JOB.water.color); break; }
      case 'hayFarm': field(c, b, '#e7c45e'); break;
      case 'oatFarm': field(c, b, '#efe2b0'); break;
      case 'berry': { for (let k = 0; k < 5; k++) { const p = iso(b.x + 0.5 + (k % 3) * 0.55, b.y + 0.5 + Math.floor(k / 3) * 0.9 + (k % 2) * 0.2); blob(c, p.sx, p.sy - 6, 11, 9, '#4f8f45'); c.fillStyle = '#c8435a'; for (let j = 0; j < 4; j++) { c.beginPath(); c.arc(p.sx - 6 + j * 4, p.sy - 8 + (j % 2) * 4, 2, 0, Math.PI * 2); c.fill(); } } break; }
      case 'woodcutter': { box(c, b.x, b.y, 1, 16, '#a7774a', '#a7774a', 0.2); roof(c, b.x, b.y, 1, 16, 10, '#6e8f3b', 0.12); for (let k = 0; k < 3; k++) blob(c, cx + 12, cy + 4 - k * 4, 6, 3, '#9a6a3c'); sign(c, cx - 2, cy - 30, '🪓', '#d9b98a'); break; }
      case 'clayPit': case 'sandPit': { const col = b.kind === 'clayPit' ? '#c47a4f' : '#ead39a'; diamond(c, b.x + 0.15, b.y + 0.15, s - 0.3, s - 0.3); c.fillStyle = shade(col, -0.3); c.fill(); c.strokeStyle = INK; c.lineWidth = 1.2; c.stroke(); blob(c, cx + 14, cy - 2, 12, 7, col); blob(c, cx - 12, cy + 6, 8, 4, shade(col, 0.15)); c.strokeStyle = '#7a5034'; c.lineWidth = 2; c.beginPath(); c.moveTo(cx - 4, cy - 2); c.lineTo(cx + 4, cy - 18); c.stroke(); sign(c, cx - 14, cy - 18, b.kind === 'clayPit' ? '🏺' : '⏳', col); break; }
      case 'dustMill': { box(c, b.x, b.y, s, 26, '#e8e0d0', '#e8e0d0'); roof(c, b.x, b.y, s, 26, 14, '#8f7fb2'); const hub = { x: cx + 18, y: cy - 34 }; c.save(); c.translate(hub.x, hub.y); c.rotate(time * 1.2); c.fillStyle = '#fff8e8'; c.strokeStyle = INK; for (let k = 0; k < 4; k++) { c.rotate(Math.PI / 2); c.fillRect(-2, -20, 4, 18); c.strokeRect(-2, -20, 4, 18); } c.restore(); sign(c, cx - 10, cy - 18, '✨', GOOD_COLORS.dust); break; }
      case 'potter': case 'toymaker': case 'weaver': {
        const look = { potter: ['#e8c7a8', '#b4553f', '🏺', GOOD_COLORS.pottery], toymaker: ['#cfe3f2', '#5a7fc0', '🧸', GOOD_COLORS.toys], weaver: ['#f6dfe6', '#c95a7a', '🧶', GOOD_COLORS.bedding] }[b.kind];
        box(c, b.x, b.y, s, 22, look[0], look[0]); roof(c, b.x, b.y, s, 22, 14, look[1]);
        if (b.workers && (b.store[BUILDINGS[b.kind].takes!] ?? 0) > 0) { const k = (time * 0.6) % 1; c.fillStyle = `rgba(255,255,255,${0.6 - k * 0.6})`; c.beginPath(); c.arc(cx + 16, cy - 52 - k * 14, 4 + k * 5, 0, Math.PI * 2); c.fill(); }
        sign(c, cx - 10, cy - 14, look[2], look[3]); break;
      }
      case 'granary': { box(c, b.x + 0.4, b.y + 0.4, 2.2, 30, '#e8cf94', '#e8cf94', 0.05); cone(c, cx, cy - 34, 42, 26, '#c99a5a'); sign(c, cx, cy - 12, '🌾', GOOD_COLORS.hay); break; }
      case 'storehouse': { box(c, b.x, b.y, s, 28, '#c9935a', '#c9935a'); roof(c, b.x, b.y, s, 28, 18, '#8a5a34'); sign(c, cx, cy - 14, '📦', '#d9b98a'); break; }
      case 'market': {
        box(c, b.x, b.y, s, 12, '#c9935a', '#d9b98a', 0.2);
        for (let k = 0; k < 6; k++) { const p = iso(b.x + 0.2 + k * 0.27, b.y + 0.2), q = iso(b.x + 0.2 + (k + 1) * 0.27, b.y + 0.2), p2 = iso(b.x + 0.2 + k * 0.27, b.y + 1.8), q2 = iso(b.x + 0.2 + (k + 1) * 0.27, b.y + 1.8); c.fillStyle = k % 2 ? '#fff8e8' : '#e6b23e'; c.beginPath(); c.moveTo(p.sx, p.sy - 30); c.lineTo(q.sx, q.sy - 30); c.lineTo(q2.sx, q2.sy - 26); c.lineTo(p2.sx, p2.sy - 26); c.closePath(); c.fill(); c.strokeStyle = INK; c.lineWidth = 1; c.stroke(); }
        let gx = cx - 14; for (const gd of ['berries', 'hay', 'oats', 'pottery', 'toys', 'bedding'] as Good[]) if ((b.store[gd] ?? 0) > 0) { blob(c, gx, cy - 12, 4, 3, GOOD_COLORS[gd]); gx += 7; }
        break;
      }
      case 'bathhouse': { blob(c, cx, cy + 2, 26, 13, '#a9c8e0'); blob(c, cx, cy - 1, 21, 10, '#d9cfe6'); c.fillStyle = '#f4effb'; c.beginPath(); c.ellipse(cx, cy - 2, 15, 6, 0, 0, Math.PI * 2); c.fill(); if ((b.store.dust ?? 0) > 0) for (let k = 0; k < 3; k++) { const t2 = (time * 0.5 + k / 3) % 1; c.fillStyle = `rgba(240,234,250,${0.8 - t2 * 0.8})`; c.beginPath(); c.arc(cx - 8 + k * 8, cy - 8 - t2 * 18, 4 + t2 * 4, 0, Math.PI * 2); c.fill(); } sign(c, cx + 18, cy - 18, '🛁', JOB.dust.color); break; }
      case 'herb': { box(c, b.x, b.y, 1, 16, '#e8dcc0', '#e8dcc0', 0.18); cone(c, cx, cy - 15, 20, 16, '#6db36b'); sign(c, cx, cy - 4, '🌿', JOB.healer.color); break; }
      case 'story': { for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; blob(c, cx + Math.cos(a) * 20, cy + Math.sin(a) * 9, 6, 3.5, '#9a6a3c'); } blob(c, cx, cy - 2, 7, 4, '#c9935a'); c.fillStyle = '#f2a03a'; c.beginPath(); c.moveTo(cx - 3, cy - 4); c.quadraticCurveTo(cx, cy - 16 - Math.sin(time * 6) * 2, cx + 3, cy - 4); c.fill(); sign(c, cx + 20, cy - 20, '📖', JOB.story.color); break; }
      case 'music': { blob(c, cx, cy, 14, 7, '#9a6a3c'); blob(c, cx, cy - 4, 12, 5.5, '#c9935a'); c.font = '12px system-ui'; c.fillStyle = INK; c.textAlign = 'center'; for (let k = 0; k < 2; k++) { const t2 = (time * 0.7 + k / 2) % 1; c.globalAlpha = 1 - t2; c.fillText('♪', cx - 6 + k * 12, cy - 14 - t2 * 20); } c.globalAlpha = 1; sign(c, cx + 18, cy - 14, '🎵', JOB.music.color); break; }
      case 'fireWatch': case 'foxWatch': { const t = box(c, b.x, b.y, 1, 40, b.kind === 'fireWatch' ? '#c9935a' : '#a7774a', '#d9b98a', 0.3); cone(c, cx, cy - 40, 15, 14, b.kind === 'fireWatch' ? '#e5603b' : '#6e8f3b'); void t; sign(c, cx, cy - 18, b.kind === 'fireWatch' ? '🔔' : '🦊', b.kind === 'fireWatch' ? JOB.fire.color : '#f2a03a'); break; }
      case 'garden': { diamond(c, b.x + 0.1, b.y + 0.1, 0.8, 0.8); c.fillStyle = '#7a5a3a'; c.fill(); for (let k = 0; k < 7; k++) { const u = hash(b.id, k), v2 = hash(b.id, k + 5), p = iso(b.x + 0.2 + u * 0.6, b.y + 0.2 + v2 * 0.6); c.strokeStyle = '#4f8f45'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(p.sx, p.sy); c.lineTo(p.sx, p.sy - 7); c.stroke(); blob(c, p.sx, p.sy - 8, 2.6, 2.6, ['#f6c2d4', '#fbe07a', '#e46d8a', '#c9b8e8', '#fff7e8'][k % 5], false); } break; }
      case 'pond': { blob(c, cx, cy, 34, 16, '#e9dcae'); blob(c, cx, cy, 30, 13.5, '#6db6d8', false); c.strokeStyle = '#9fd4ea'; c.lineWidth = 1.2; c.beginPath(); c.ellipse(cx - 4, cy - 2, 12 + Math.sin(time * 2) * 2, 4, 0, 0, Math.PI * 2); c.stroke(); blob(c, cx + 12, cy + 3, 5, 2.5, '#6aa04a', false); blob(c, cx - 14, cy + 1, 4, 2, '#6aa04a', false); blob(c, cx + 12, cy + 2, 1.6, 1.6, '#f6c2d4', false); break; }
      case 'statue': { box(c, b.x + 0.6, b.y + 0.6, 1.8, 16, '#d8d2c4', '#e8e2d4', 0.1); drawChinchilla(c, STONE, cx, cy - 15, { face: 1, h: 46, time: 0 }); break; }
      case 'plaza': { blob(c, cx, cy - 2, 14, 7, '#b4ab9a'); blob(c, cx, cy - 4, 10, 5, '#6db6d8', false); c.strokeStyle = '#d9f0fb'; c.lineWidth = 2; c.beginPath(); c.moveTo(cx, cy - 4); c.quadraticCurveTo(cx - 2, cy - 16 - Math.sin(time * 5) * 1.5, cx - 6, cy - 6); c.moveTo(cx, cy - 4); c.quadraticCurveTo(cx + 2, cy - 16 - Math.cos(time * 5) * 1.5, cx + 6, cy - 6); c.stroke(); break; }
      case 'tradingPost': { box(c, b.x, b.y, s, 18, '#e8cf94', '#e8cf94'); cone(c, cx, cy - 20, 48, 34, '#d4574e'); c.strokeStyle = INK; c.beginPath(); c.moveTo(cx, cy - 54); c.lineTo(cx, cy - 68); c.stroke(); c.fillStyle = '#e6b23e'; c.beginPath(); c.moveTo(cx, cy - 68); c.lineTo(cx + 12, cy - 64); c.lineTo(cx, cy - 60); c.closePath(); c.fill(); c.stroke(); sign(c, cx, cy - 8, '⚖️', '#e6b23e'); break; }
      case 'hall': {
        box(c, b.x, b.y, s, 34, '#fbf3e2', '#fbf3e2'); roof(c, b.x, b.y, s, 34, 20, '#5a7fc0');
        for (let k = 0; k < 4; k++) { const p = iso(b.x + 0.4 + k * 0.7, b.y + s - 0.12); c.fillStyle = '#e8e2d4'; c.fillRect(p.sx - 2, p.sy - 30, 4, 28); c.strokeStyle = INK; c.lineWidth = 1; c.strokeRect(p.sx - 2, p.sy - 30, 4, 28); }
        blob(c, cx, cy - 60, 8, 8, '#fff8e8'); c.strokeStyle = INK; c.lineWidth = 1.4; c.beginPath(); c.moveTo(cx, cy - 60); c.lineTo(cx, cy - 66); c.moveTo(cx, cy - 60); c.lineTo(cx + 4, cy - 58); c.stroke();
        break;
      }
      case 'rubble': { for (let k = 0; k < 5; k++) blob(c, cx - 10 + hash(b.id, k) * 20, cy - 2 + hash(b.id, k + 9) * 6, 5 + hash(b.id, k + 3) * 4, 3 + hash(b.id, k + 4) * 2, k % 2 ? '#a9a39a' : '#8a7f72'); break; }
      default: box(c, b.x, b.y, s, 18, '#d9c3a0', '#d9c3a0');
    }
    // no road beside it: a little red flag says so
    if (b.kind !== 'rubble' && BUILDINGS[b.kind].jobs + (b.kind === 'home' ? 1 : 0) > 0 && !g.hasAccess(b)) {
      c.strokeStyle = INK; c.lineWidth = 1.4; c.beginPath(); c.moveTo(cx + 10, cy - 8); c.lineTo(cx + 10, cy - 30); c.stroke();
      c.fillStyle = '#e5603b'; c.beginPath(); c.moveTo(cx + 10, cy - 30); c.lineTo(cx + 22, cy - 26); c.lineTo(cx + 10, cy - 22); c.closePath(); c.fill(); c.stroke();
    }
    if (b.burning) flames(c, cx, cy, s);
  }
  function flames(c: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
    for (let k = 0; k < 3 + s * 2; k++) {
      const x = cx + (hash(k, 3) - 0.5) * 30 * s, f = Math.sin(time * 9 + k * 2) * 3, hgt = 16 + hash(k, 5) * 14;
      c.fillStyle = '#f2a03a'; c.beginPath(); c.moveTo(x - 7, cy - 4); c.quadraticCurveTo(x - 6, cy - hgt * 0.6, x + f, cy - hgt - 6); c.quadraticCurveTo(x + 6, cy - hgt * 0.6, x + 7, cy - 4); c.fill();
      c.fillStyle = '#fbe07a'; c.beginPath(); c.moveTo(x - 3, cy - 4); c.quadraticCurveTo(x - 3, cy - hgt * 0.4, x + f * 0.6, cy - hgt * 0.7); c.quadraticCurveTo(x + 3, cy - hgt * 0.4, x + 3, cy - 4); c.fill();
    }
    for (let k = 0; k < 3; k++) { const t = (time * 0.4 + k / 3) % 1; c.fillStyle = `rgba(120,110,105,${0.45 - t * 0.45})`; c.beginPath(); c.arc(cx + Math.sin(k + time) * 6, cy - 40 - t * 40, 8 + t * 12, 0, Math.PI * 2); c.fill(); }
  }

  // ---------- fences ----------
  function fencePiece(c: CanvasRenderingContext2D, g: PawhavenGame, i: number) {
    const N = g.size, x = i % N, y = Math.floor(i / N), m = iso(x + 0.5, y + 0.5), gate = g.road[i] === ROAD || g.road[i] === PAVED;
    const post = (px: number, py: number, hh = 14) => { c.fillStyle = '#a7774a'; c.fillRect(px - 2, py - hh, 4, hh); c.strokeStyle = INK; c.lineWidth = 1; c.strokeRect(px - 2, py - hh, 4, hh); };
    c.strokeStyle = '#8a5a34'; c.lineWidth = 2.4;
    for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]] as const) {
      const nx = x + dx, ny = y + dy; if (!g.inside(nx, ny) || !g.fence[ny * N + nx]) continue;
      const e = iso(x + 0.5 + dx * 0.5, y + 0.5 + dy * 0.5);
      for (const off of [5, 10]) { c.beginPath(); c.moveTo(m.sx, m.sy - off); c.lineTo(e.sx, e.sy - off); c.stroke(); }
    }
    if (gate) { post(m.sx - 12, m.sy, 20); post(m.sx + 12, m.sy, 20); c.strokeStyle = '#8a5a34'; c.lineWidth = 3; c.beginPath(); c.moveTo(m.sx - 12, m.sy - 20); c.quadraticCurveTo(m.sx, m.sy - 28, m.sx + 12, m.sy - 20); c.stroke(); }
    else post(m.sx, m.sy);
  }

  // ---------- moving bits on the paintings ----------
  // Where each painting's chimney, sails, spout and so on sit, in the painting's own pixels (from anchors.json).
  type Anchor = { smoke?: number[][]; hub?: number[]; sails?: number; spout?: number[]; fountain?: number[]; water?: number[]; flags?: number[][]; glow?: number[][] };
  let anchors: Record<string, Anchor> = {};
  fetch('/art/pawhaven/sprites/anchors.json').then((r) => (r.ok ? r.json() : {})).then((j) => { anchors = j; }).catch(() => {});
  // painted scenery in fixed slots (trees twice as likely), so each spot keeps its look once everything has loaded
  const decorSlots: (HTMLImageElement | null)[] = [];
  let decor: HTMLImageElement[] = [];
  ['decor-tree-1', 'decor-tree-2', 'decor-pine', 'decor-tree-1', 'decor-tree-2', 'decor-bush-flowers', 'decor-rocks', 'decor-mushrooms'].forEach((d, k) => {
    decorSlots.push(null); const img = new Image(); img.src = `/art/pawhaven/sprites/${d}.webp`;
    img.onload = () => { decorSlots[k] = img; if (decorSlots.every(Boolean)) decor = decorSlots as HTMLImageElement[]; };
  });
  const sailsImg = new Image(); sailsImg.src = '/art/pawhaven/sprites/part-sails.webp';
  function liven(c: CanvasRenderingContext2D, b: Building, name: string, left: number, top: number, k: number, busy: boolean) {
    const a = anchors[name]; if (!a) return;
    const P = (p: number[]) => ({ x: left + p[0] * k, y: top + p[1] * k }), seed = hash(b.id, 5) * 10;
    // chimney smoke: soft puffs that rise, drift and fade while someone is in
    if (a.smoke && busy) for (const sp of a.smoke) {
      const o = P(sp);
      for (let j = 0; j < 4; j++) {
        const u = (time * 0.35 + j / 4 + seed) % 1, r = 2.5 + u * 6;
        c.fillStyle = `rgba(245,240,232,${(0.75 * (1 - u)).toFixed(3)})`; c.beginPath(); c.arc(o.x + Math.sin(u * 4 + seed) * 4 + u * 8, o.y - u * 30, r, 0, Math.PI * 2); c.fill();
      }
    }
    // the dust mill's sails turn while it works
    if (a.hub && sailsImg.complete && sailsImg.naturalWidth) {
      const o = P(a.hub), d = (a.sails ?? 160) * k;
      c.save(); c.translate(o.x, o.y); c.scale(1, 0.92); c.rotate(time * (b.workers ? 1.1 : 0.15) + seed); c.drawImage(sailsImg, -d / 2, -d / 2, d, d); c.restore();
    }
    // water: ripples on the pond, a trickle from the tower's spout, spray from the fountain
    if (a.water) {
      const o = P(a.water), rx = a.water[2] * k, ry = a.water[3] * k;
      c.strokeStyle = 'rgba(235,248,255,0.7)'; c.lineWidth = 1.2;
      for (let j = 0; j < 3; j++) { const u = (time * 0.4 + j / 3 + seed) % 1, px = o.x + Math.cos(seed * 7 + j * 2.1) * rx * 0.45, py = o.y + Math.sin(seed * 5 + j * 1.7) * ry * 0.45; c.globalAlpha = 1 - u; c.beginPath(); c.ellipse(px, py, 2 + u * rx * 0.3, 1 + u * ry * 0.3, 0, 0, Math.PI * 2); c.stroke(); }
      c.globalAlpha = 1;
      // now and then a fish jumps
      const fj = (time * 0.25 + seed) % 3; if (fj < 0.5) { const u = fj / 0.5, fx = o.x - rx * 0.3 + u * rx * 0.5, fy = o.y - Math.sin(u * Math.PI) * 12; c.fillStyle = '#f0a050'; c.beginPath(); c.ellipse(fx, fy, 3.5, 1.8, (u - 0.5) * 2, 0, Math.PI * 2); c.fill(); }
    }
    if (a.spout) { const o = P(a.spout); c.fillStyle = 'rgba(140,200,240,0.85)'; for (let j = 0; j < 4; j++) { const u = (time * 1.6 + j / 4) % 1; c.beginPath(); c.arc(o.x + u * 2, o.y + u * u * 14, 1.6, 0, Math.PI * 2); c.fill(); } }
    if (a.fountain) {
      const o = P(a.fountain); c.fillStyle = 'rgba(220,242,255,0.9)';
      for (let j = 0; j < 10; j++) { const u = (time * 0.9 + j / 10) % 1, ang = j * 2.4 + seed, vx = Math.cos(ang) * 9, py = o.y - (u * 16 - u * u * 16) * 1.3 - u * 2; c.beginPath(); c.arc(o.x + vx * u, py + u * 6, 1.4, 0, Math.PI * 2); c.fill(); }
    }
    // pennants and banners wave
    if (a.flags) for (const fp of a.flags) {
      const o = P(fp), w = Math.sin(time * 5 + fp[0]) * 2.5;
      c.fillStyle = '#e5603b'; c.strokeStyle = INK; c.lineWidth = 0.8; c.beginPath(); c.moveTo(o.x, o.y); c.quadraticCurveTo(o.x + 6, o.y - 2 + w, o.x + 11, o.y + 2 + w * 1.4); c.lineTo(o.x, o.y + 6); c.closePath(); c.fill(); c.stroke();
    }
    // lived-in windows glow warm, softly pulsing
    if (a.glow && busy) { const al = 0.18 + 0.1 * Math.sin(time * 1.3 + seed); for (const gp of a.glow) { const o = P(gp), gr = c.createRadialGradient(o.x, o.y, 0, o.x, o.y, 9); gr.addColorStop(0, `rgba(255,214,120,${al.toFixed(3)})`); gr.addColorStop(1, 'rgba(255,214,120,0)'); c.fillStyle = gr; c.fillRect(o.x - 9, o.y - 9, 18, 18); } }
  }

  // ---------- town life ----------
  // Residents, children and workers going about their day. Drawing only, worked out from the town's state and the
  // clock, so the rules engine never sees them.
  type Life = { x: number; y: number; d: number; face: 1 | -1; coat: Coat; h: number; moving: boolean; air: boolean; tag?: 'dust' | 'note' | 'book' | 'tool'; dizzy?: boolean };
  const lifeOut: Life[] = [];
  function townLife(g: PawhavenGame, seen: (x: number, y: number, s?: number) => boolean) {
    lifeOut.length = 0;
    const N = g.size, put = (fx: number, fy: number, k: number, o: Partial<Life> = {}) => {
      const p = iso(fx, fy); lifeOut.push({ x: p.sx, y: p.sy, d: fx + fy, face: 1, coat: COATS[k % COATS.length], h: 13, moving: false, air: false, ...o });
    };
    for (const b of g.buildings.values()) {
      if (b.burning || !seen(b.x, b.y, b.size)) continue;
      const h0 = hash(b.id, 31), cx = b.x + b.size / 2, cy = b.y + b.size / 2;
      if (b.kind === 'home') {
        const home = b.pop - b.away; if (home <= 0) continue;
        // one or two sit out front, shuffling and turning now and then
        // about one home in three has someone sitting out front
        const out = h0 < 0.35 ? 1 : 0;
        for (let k = 0; k < out; k++) {
          const t = time * 0.25 + h0 * 7 + k * 3.1, a = Math.PI * 0.25 + Math.sin(t) * 0.9 + k * 1.3, wob = Math.sin(t * 2.3);
          put(cx + Math.cos(a) * 0.62, cy + Math.sin(a) * 0.62, b.id + k, { face: wob > 0 ? 1 : -1, moving: Math.abs(Math.cos(t)) > 0.85, air: (time * 1.7 + h0 * 5 + k) % 6 < 0.35 });
        }
        // and a stroller paces the road beside the home, back and forth between two road tiles
        if (home >= 6 && hash(b.id, 44) < 0.2) {
          const doors = g.doors(b); if (!doors.length) continue;
          const d0 = doors[Math.floor(h0 * doors.length)], x0 = d0 % N, y0 = Math.floor(d0 / N);
          let d1 = d0; for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) { const n = (y0 + dy) * N + x0 + dx; if (g.inside(x0 + dx, y0 + dy) && g.walkable(n)) { d1 = n; break; } }
          const x1 = d1 % N, y1 = Math.floor(d1 / N), ph = (time * 0.18 + h0 * 9) % 2, u = ph < 1 ? ph : 2 - ph, ease = u * u * (3 - 2 * u);
          const dir = (iso(x1, y1).sx - iso(x0, y0).sx) * (ph < 1 ? 1 : -1);
          put(x0 + 0.5 + (x1 - x0) * ease, y0 + 0.5 + (y1 - y0) * ease, b.id + 7, { face: dir < 0 ? -1 : 1, moving: u > 0.04 && u < 0.96, h: 14 });
        }
        continue;
      }
      const s0 = BUILDINGS[b.kind];
      // children skip round the pretty places and the story and music circles
      if (b.kind === 'plaza' || b.kind === 'pond' || b.kind === 'statue' || b.kind === 'music' || b.kind === 'story') {
        const n = b.kind === 'story' || b.kind === 'music' ? Math.min(4, 1 + b.workers) : 2;
        for (let k = 0; k < n; k++) {
          const a = (k / n) * Math.PI * 2 + (b.kind === 'story' ? 0 : time * 0.5), r = b.size * 0.48;
          const hop = b.kind === 'music' ? (time * 3 + k) % 1 < 0.4 : b.kind !== 'story' && (time * 1.3 + k * 0.7) % 2.2 < 0.3;
          put(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.9, b.id + k, { h: b.kind === 'story' ? 12 : 11, face: Math.cos(a + Math.PI / 2) > 0 ? 1 : -1, moving: b.kind !== 'story', air: hop, tag: b.kind === 'music' && k === 0 ? 'note' : undefined });
        }
        if (b.kind === 'story' && b.workers) put(cx, cy - 0.05, b.id + 9, { h: 15, tag: 'book' });
        continue;
      }
      if (!b.workers) continue;
      // a busy dust bath: someone rolling about in a cloud of dust
      if (b.kind === 'bathhouse') { put(cx + Math.sin(time * 2) * 0.25, cy, b.id, { h: 16, dizzy: true, air: (time * 2) % 1 < 0.5, tag: 'dust', face: Math.sin(time * 2) > 0 ? 1 : -1 }); continue; }
      // farms: pickers walking the rows
      if (s0.crop || b.kind === 'berry') {
        const n = Math.min(2, Math.ceil(b.workers / 3));
        for (let k = 0; k < n; k++) { const u = (time * 0.12 + k / n + h0) % 1, row = (k * 0.3 + 0.2) * b.size; put(b.x + 0.2 + u * (b.size - 0.4), b.y + row, b.id + k, { moving: true, face: 1, tag: 'tool' }); }
        continue;
      }
      // everyone else: a worker at the door, busy at something
      if (s0.jobs && (s0.makes || s0.takes || s0.stores || s0.svc)) {
        const bob = Math.sin(time * 5 + h0 * 6);
        put(b.x + b.size + 0.15, b.y + b.size * 0.55, b.id, { face: -1, air: bob > 0.92, tag: s0.makes || s0.takes ? 'tool' : undefined });
      }
    }
    return lifeOut;
  }
  function lifeling(c: CanvasRenderingContext2D, l: Life) {
    blob(c, l.x, l.y + 1, l.h * 0.38, l.h * 0.16, '#00000020', false);
    drawChinchilla(c, l.coat, l.x, l.y + (l.air ? -4 : 0), { face: l.face, h: l.h, time: time + l.d, run: l.moving ? 1 : 0, moving: l.moving, air: l.air, dizzy: l.dizzy, blink: (time + l.d * 3) % 4 < 0.12 });
    if (l.tag === 'dust') for (let k = 0; k < 4; k++) { const a = time * 3 + k * 1.6; blob(c, l.x + Math.cos(a) * 12, l.y - 4 + Math.sin(a) * 4, 5, 3.5, 'rgba(240,232,248,0.85)', false); }
    if (l.tag === 'note' && (time % 1) < 0.7) { c.font = 'bold 12px system-ui'; c.fillStyle = INK; c.textAlign = 'center'; c.fillText('♪', l.x + 8, l.y - l.h - 4 - (time % 1) * 8); }
    if (l.tag === 'book') { c.fillStyle = '#fff8e8'; c.strokeStyle = INK; c.lineWidth = 1; c.fillRect(l.x + 3, l.y - l.h * 0.6, 9, 6); c.strokeRect(l.x + 3, l.y - l.h * 0.6, 9, 6); }
    if (l.tag === 'tool') { const sw = Math.sin(time * 6 + l.d) * 0.5; c.save(); c.translate(l.x + l.face * 6, l.y - l.h * 0.45); c.rotate(sw * l.face); c.strokeStyle = '#8a5a34'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(0, 0); c.lineTo(l.face * 7, -6); c.stroke(); c.restore(); }
  }

  // ---------- walkers and foxes ----------
  function walkerPos(o: { x: number; y: number; tx: number; ty: number; p: number }) { const fx = o.x + (o.tx - o.x) * o.p, fy = o.y + (o.ty - o.y) * o.p; return { fx, fy, ...iso(fx + 0.5, fy + 0.5) }; }
  function walker(c: CanvasRenderingContext2D, wk: Walker) {
    const p = walkerPos(wk), dir = iso(wk.tx, wk.ty).sx - iso(wk.x, wk.y).sx, face: 1 | -1 = dir < 0 ? -1 : 1;
    const coat = COATS[wk.home % COATS.length], x = p.sx + (wk.id % 3 - 1) * 4, y = p.sy + 2;
    blob(c, x, y, 7, 3, '#00000020', false);
    if (wk.kind === 'cart') {
      // a little two-wheeled cart pulled behind
      const bx = x - face * 14; c.fillStyle = '#c9935a'; c.strokeStyle = INK; c.lineWidth = 1.2; c.fillRect(bx - 8, y - 12, 16, 8); c.strokeRect(bx - 8, y - 12, 16, 8);
      const gd = Object.keys(wk.load).find((k) => (wk.load[k as Good] ?? 0) > 0) as Good | undefined;
      if (gd) blob(c, bx, y - 13, 7, 4, GOOD_COLORS[gd]);
      blob(c, bx - 4, y - 3, 3.2, 3.2, '#8a5a34'); blob(c, bx + 4, y - 3, 3.2, 3.2, '#8a5a34');
      c.strokeStyle = INK; c.beginPath(); c.moveTo(bx + face * 8, y - 8); c.lineTo(x, y - 8); c.stroke();
    }
    const opts = { face, h: 15, time: time + wk.id, run: 1, moving: true } as const;
    if (wk.kind === 'helper' && wk.job) { const j = JOB[wk.job]; drawChinchilla(c, coat, x, y, { ...opts, bib: { color: j.color, trim: j.trim } }); }
    else if (wk.kind === 'buyer') drawChinchilla(c, coat, x, y, { ...opts, decorate: (cc, bob) => { cc.fillStyle = '#c9935a'; cc.strokeStyle = INK; cc.lineWidth = 0.8; cc.fillRect(3, -11 + bob, 7, 5); cc.strokeRect(3, -11 + bob, 7, 5); } });
    else if (wk.kind === 'trader') drawChinchilla(c, coat, x, y, { ...opts, h: 17, decorate: (cc, bob) => { cc.fillStyle = '#d4574e'; cc.strokeStyle = INK; cc.lineWidth = 0.8; cc.beginPath(); cc.ellipse(-6, -14 + bob, 5, 6, 0, 0, Math.PI * 2); cc.fill(); cc.stroke(); } });
    else drawChinchilla(c, coat, x, y, opts);
  }
  function fox(c: CanvasRenderingContext2D, f: { x: number; y: number; tx: number; ty: number; p: number; flee: boolean }) {
    const p = walkerPos(f), face = iso(f.tx, f.ty).sx - iso(f.x, f.y).sx < 0 ? -1 : 1, x = p.sx, y = p.sy + 2, bob = Math.abs(Math.sin(time * 12)) * 2;
    c.save(); c.translate(x, y); c.scale(face, 1);
    blob(c, 0, 0, 10, 3.5, '#00000020', false);
    c.fillStyle = '#e9853a'; c.strokeStyle = INK; c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(-8, -8 - bob); c.quadraticCurveTo(-20, -14, -22, -6); c.quadraticCurveTo(-16, -4, -8, -6 - bob); c.fill(); c.stroke();
    c.fillStyle = '#fff3e3'; c.beginPath(); c.arc(-21, -7, 2.6, 0, Math.PI * 2); c.fill();
    blob(c, 0, -9 - bob, 10, 5.5, '#e9853a'); blob(c, 9, -14 - bob, 5.5, 4.5, '#e9853a');
    c.fillStyle = '#e9853a'; c.beginPath(); c.moveTo(6, -17 - bob); c.lineTo(7, -24 - bob); c.lineTo(10, -18 - bob); c.moveTo(10, -18 - bob); c.lineTo(12, -24 - bob); c.lineTo(13, -16 - bob); c.fill(); c.stroke();
    c.fillStyle = '#fff3e3'; c.beginPath(); c.ellipse(12, -12 - bob, 3, 2, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = INK; c.beginPath(); c.arc(15, -12.5 - bob, 1.2, 0, Math.PI * 2); c.arc(10, -15 - bob, 1, 0, Math.PI * 2); c.fill();
    for (const lx of [-5, 5]) { c.strokeStyle = '#7a3f1c'; c.lineWidth = 2; c.beginPath(); c.moveTo(lx, -5 - bob); c.lineTo(lx + Math.sin(time * 12 + lx) * 2, 0); c.stroke(); }
    if (f.flee) { c.scale(face, 1); c.font = 'bold 10px system-ui'; c.fillStyle = INK; c.textAlign = 'center'; c.fillText('!', 0, -28); }
    c.restore();
  }

  // ---------- overlays ----------
  function overlayColor(g: PawhavenGame, b: Building, o: Overlay, desir: Int8Array): string | null {
    if (o === 'fire') { if (b.kind === 'home' || BUILDINGS[b.kind].risk) { const r = Math.min(1, b.risk / 100); return `rgba(${Math.round(120 + r * 135)},${Math.round(200 - r * 150)},80,0.55)`; } return null; }
    if (b.kind !== 'home') return null;
    if (o === 'pretty') { const d = desir[b.y * g.size + b.x]; return d >= 4 ? 'rgba(90,170,90,0.6)' : d >= 2 ? 'rgba(170,200,90,0.6)' : d >= 0 ? 'rgba(230,200,110,0.55)' : 'rgba(220,120,90,0.6)'; }
    if (o === 'food') { const n = (['berries', 'hay', 'oats'] as Good[]).filter((k) => (b.store[k] ?? 0) > 0).length; return n >= 2 ? 'rgba(90,170,90,0.6)' : n === 1 ? 'rgba(200,200,90,0.6)' : 'rgba(220,120,90,0.6)'; }
    const svc: Service = o === 'water' ? 'water' : 'dust', seen = b.seen[svc];
    if (seen === undefined || seen <= g.tick - VISIT) return 'rgba(220,120,90,0.6)';
    const left = (seen + VISIT - g.tick) / VISIT; return left > 0.5 ? 'rgba(90,150,210,0.6)' : 'rgba(150,190,220,0.6)';
  }

  // ---------- the frame ----------
  function draw(g: PawhavenGame, view: View, dt: number, opts: { ghost?: Ghost; selected?: number; overlay?: Overlay; hover?: { x: number; y: number } | null } = {}) {
    time += dt; drawn++;
    const s2 = signature(g); if (groundFor !== g || s2 !== sig) { buildGround(g); sig = s2; }
    const c = ctx, N = g.size, z = view.zoom;
    c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = '#9cc7a8'; c.fillRect(0, 0, canvas.width, canvas.height);
    c.setTransform(z * dpr, 0, 0, z * dpr, (w / 2 - view.x * z) * dpr, (h / 2 - view.y * z) * dpr);
    // meadow beyond the edge
    diamond(c, -6, -6, N + 12, N + 12); c.fillStyle = '#95c262'; c.fill();
    c.imageSmoothingEnabled = true; c.drawImage(ground, -N * HW - 1, -PAD);
    // water glints
    c.fillStyle = 'rgba(255,255,255,0.7)';
    for (let k = 0; k < water.length; k += 3) { const i = water[k], t = (time * 0.6 + hash(i, 11)) % 1; if (t > 0.3) continue; const p = iso(i % N + 0.5, Math.floor(i / N) + 0.5); c.beginPath(); c.ellipse(p.sx + (hash(i, 12) - 0.5) * 20, p.sy, 3 * (1 - t / 0.3), 1, 0, 0, Math.PI * 2); c.fill(); }
    // ways in and out
    for (const [i, label] of [[g.entry, 'in'], [g.exit, 'out']] as const) { const p = iso(i % N + 0.5, Math.floor(i / N) + 0.5); c.strokeStyle = INK; c.lineWidth = 1.4; c.beginPath(); c.moveTo(p.sx - 18, p.sy); c.lineTo(p.sx - 18, p.sy - 26); c.stroke(); c.fillStyle = '#fff8e8'; c.fillRect(p.sx - 30, p.sy - 34, 24, 10); c.strokeRect(p.sx - 30, p.sy - 34, 24, 10); c.fillStyle = INK; c.font = 'bold 8px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(label, p.sx - 18, p.sy - 29); }

    // what's under the hover and the ghost of what's being placed
    if (opts.ghost) for (const t of opts.ghost.tiles) { diamond(c, t.x, t.y); c.fillStyle = opts.ghost.kind === 'clear' ? 'rgba(229,96,59,0.35)' : t.ok ? 'rgba(120,200,110,0.45)' : 'rgba(229,96,59,0.45)'; c.fill(); c.strokeStyle = t.ok ? '#3f8a3a' : '#b33f2a'; c.lineWidth = 1.5; c.stroke(); }
    else if (opts.hover && g.inside(Math.floor(opts.hover.x), Math.floor(opts.hover.y))) { diamond(c, Math.floor(opts.hover.x), Math.floor(opts.hover.y)); c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = 2; c.stroke(); }

    // everything with height, back to front: by the front corner of its plot
    type Item = { d: number; f: () => void };
    const items: Item[] = [];
    // only what the camera can see
    const tl = pick(view, -80, -120), br = pick(view, w + 80, h + 200), tr = pick(view, w + 80, -120), bl = pick(view, -80, h + 200);
    const minS = Math.floor(tl.x + tl.y) - 2, maxS = Math.ceil(br.x + br.y) + 2, minD = Math.floor(bl.x - bl.y) - 2, maxD = Math.ceil(tr.x - tr.y) + 2;
    const seen = (x: number, y: number, s = 1) => x + y + s * 2 >= minS && x + y <= maxS && x - y + s >= minD && x - y - s <= maxD;
    for (const i of trees) {
      const x = i % N, y = Math.floor(i / N); if (!seen(x, y)) continue;
      const p = iso(x + 0.5, y + 0.5), dec = decor.length ? decor[Math.floor(hash(i, 2) * decor.length)] : null;
      if (dec) {
        // painted scenery, swaying a touch in the breeze
        const w = TW * (0.8 + hash(i, 6) * 0.25), h2 = (dec.naturalHeight * w) / dec.naturalWidth, base = iso(x + 1, y + 1).sy, sway = Math.sin(time * 1.2 + i) * 0.015;
        items.push({ d: x + y + 1, f: () => { c.save(); c.translate(p.sx, base); c.transform(1, 0, sway, 1, 0, 0); c.drawImage(dec, -w / 2 + (hash(i, 4) - 0.5) * 8, -h2 + 2, w, h2); c.restore(); } });
      } else { const spr = treeSprites[Math.floor(hash(i, 2) * 4)]; items.push({ d: x + y + 1, f: () => c.drawImage(spr, p.sx - 32 + (hash(i, 4) - 0.5) * 10, p.sy - 64) }); }
    }
    for (const i of rocks) { const x = i % N, y = Math.floor(i / N); if (!seen(x, y)) continue; const p = iso(x + 0.5, y + 0.5); items.push({ d: x + y + 1, f: () => { blob(c, p.sx - 6, p.sy - 2, 12, 8, '#a29a8d'); blob(c, p.sx + 8, p.sy + 2, 8, 5.5, '#b7b0a3'); c.fillStyle = '#cfc9bd'; c.beginPath(); c.ellipse(p.sx - 9, p.sy - 6, 4, 2.4, -0.3, 0, Math.PI * 2); c.fill(); } }); }
    for (let i = 0; i < N * N; i++) if (g.fence[i]) { const x = i % N, y = Math.floor(i / N); if (seen(x, y)) items.push({ d: x + y + 1.05, f: () => fencePiece(c, g, i) }); }
    for (const b of g.buildings.values()) if (seen(b.x, b.y, b.size)) items.push({ d: b.x + b.y + b.size * 2 - 1, f: () => building(c, g, b) });
    for (const wk of g.walkers) { if (wk.gone) continue; const p = walkerPos(wk); if (seen(Math.floor(p.fx), Math.floor(p.fy))) items.push({ d: p.fx + p.fy + 1.1, f: () => walker(c, wk) }); }
    for (const f of g.foxes) { if (f.gone) continue; const p = walkerPos(f); items.push({ d: p.fx + p.fy + 1.1, f: () => fox(c, f) }); }
    for (const l of townLife(g, seen)) items.push({ d: l.d + 0.6, f: () => lifeling(c, l) });
    items.sort((a, b) => a.d - b.d);
    for (const it of items) it.f();

    // overlays and the selection ring go on top
    if (opts.overlay && opts.overlay !== 'none') {
      const desir = g.desirability();
      for (const b of g.buildings.values()) { const col = overlayColor(g, b, opts.overlay, desir); if (!col || !seen(b.x, b.y, b.size)) continue; diamond(c, b.x + 0.1, b.y + 0.1, b.size - 0.2, b.size - 0.2); c.fillStyle = col; c.fill(); }
    }
    if (opts.selected) { const b = g.buildings.get(opts.selected); if (b) { diamond(c, b.x, b.y, b.size, b.size); c.strokeStyle = '#fff8e8'; c.lineWidth = 3 / z; c.setLineDash([6 / z, 4 / z]); c.lineDashOffset = -time * 20 / z; c.stroke(); c.setLineDash([]); } }
    reachLayer(c, g, opts.ghost, opts.selected, z);
    // a walker's route: for a selected service building, where its helper is
    c.setTransform(1, 0, 0, 1, 0, 0);
  }

  // ---------- coverage ----------
  /** Road steps from the plot's road edge to every tile, up to `range` (-1 beyond). */
  function reach(g: PawhavenGame, x: number, y: number, size: number, range: number) {
    const N = g.size, f = new Int16Array(N * N).fill(-1), q: number[] = [];
    for (let j = -1; j <= size; j++) for (let i = -1; i <= size; i++) {
      if ((i === -1 || i === size) === (j === -1 || j === size)) continue;
      const tx = x + i, ty = y + j, t = ty * N + tx; if (!g.inside(tx, ty) || !g.walkable(t) || f[t] >= 0) continue; f[t] = 0; q.push(t);
    }
    for (let h = 0; h < q.length; h++) {
      const t = q[h], tx = t % N, ty = (t - tx) / N; if (f[t] >= range) continue;
      for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) { const nx = tx + dx, ny = ty + dy, n = ny * N + nx; if (g.inside(nx, ny) && f[n] < 0 && g.walkable(n)) { f[n] = f[t] + 1; q.push(n); } }
    }
    return { f, q };
  }
  const REACH_COLOR: Record<string, string> = { water: '90,160,220', seller: '230,150,70', dust: '170,140,210', healer: '110,180,110', story: '220,120,150', music: '240,190,70', fire: '230,100,70' };
  /** Where a service building's helper can walk: the roads it reaches, fading with distance, and the homes along them. */
  function reachLayer(c: CanvasRenderingContext2D, g: PawhavenGame, ghost: Ghost | undefined, selected: number | undefined, z: number) {
    const spots: { x: number; y: number; s: number; range: number; svc: string; strong: boolean }[] = [];
    const kind = ghost && ghost.kind !== 'clear' ? ghost.kind : selected ? g.buildings.get(selected)?.kind : undefined;
    const spec = kind ? BUILDINGS[kind] : undefined;
    if (!kind || !spec?.svc) return;
    const range = spec.range ?? 30;
    // the others of the same kind faintly, so gaps in the town show
    for (const b of g.buildings.values()) if (b.kind === kind) spots.push({ x: b.x, y: b.y, s: b.size, range, svc: spec.svc, strong: b.id === selected });
    if (ghost && ghost.tiles.length) { const x0 = Math.min(...ghost.tiles.map((t) => t.x)), y0 = Math.min(...ghost.tiles.map((t) => t.y)); spots.push({ x: x0, y: y0, s: ghost.size, range, svc: spec.svc, strong: true }); }
    const N = g.size, rgb = REACH_COLOR[spec.svc] ?? '120,180,120', homes = new Set<number>();
    for (const sp of spots) {
      const { f, q } = reach(g, sp.x, sp.y, sp.s, sp.range);
      for (const t of q) {
        const tx = t % N, ty = (t - tx) / N, a = (sp.strong ? 0.55 : 0.22) * (1 - (f[t] / (sp.range + 1)) * 0.6);
        diamond(c, tx + 0.06, ty + 0.06, 0.88, 0.88); c.fillStyle = `rgba(${rgb},${a.toFixed(3)})`; c.fill();
        if (sp.strong) for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) { const nx = tx + dx, ny = ty + dy; if (!g.inside(nx, ny)) continue; const id = g.occ[ny * N + nx]; if (id && g.buildings.get(id)?.kind === 'home') homes.add(id); }
      }
    }
    c.lineWidth = 2.5 / z; c.strokeStyle = `rgba(${rgb},0.95)`;
    for (const id of homes) { const b = g.buildings.get(id)!; diamond(c, b.x + 0.08, b.y + 0.08, b.size - 0.16, b.size - 0.16); c.fillStyle = `rgba(${rgb},0.28)`; c.fill(); c.stroke(); }
  }

  function metrics(g: PawhavenGame) { return { frames: drawn, walkers: g.walkers.length, buildings: g.buildings.size, months: Math.floor(g.tick / MONTH) }; }
  function dispose() { observer.disconnect(); ground.width = ground.height = 0; }
  // ---------- icons for the page ----------
  /** A building on its own patch of meadow, drawn exactly as in town, as an image for buttons and panels. Cached. */
  const anyAccess = { hasAccess: () => true } as unknown as PawhavenGame;
  function icon(kind: Kind, o: { level?: number; size?: number } = {}) {
    const px = o.size ?? 96, level = kind === 'home' ? o.level ?? 3 : 0, key = `${kind}:${level}:${px}:${painted.has(kind === 'home' ? `home-${level || 1}` : kind)}`;
    const hit = icons.get(key); if (hit) return hit;
    const s = BUILDINGS[kind].size, cv = document.createElement('canvas'), c = cv.getContext('2d')!;
    cv.width = cv.height = px * 2;
    const k = (px * 2) / Math.max(s * TW + 18, s * TH + 84);
    c.translate(px, px * 2 - 6 - s * TH * k); c.scale(k, k);
    // the patch it stands on
    diamond(c, 0, 0, s, s); c.fillStyle = kind === 'road' ? '#c9a57a' : '#9ccb6b'; c.fill(); c.strokeStyle = shade(kind === 'road' ? '#c9a57a' : '#9ccb6b', -0.3); c.lineWidth = 1.5; c.stroke();
    if (kind === 'road') { c.fillStyle = '#b48d62'; for (let j = 0; j < 4; j++) { const p = iso(0.25 + j * 0.17, 0.3 + (j % 2) * 0.4); c.beginPath(); c.ellipse(p.sx, p.sy, 3, 1.6, 0, 0, Math.PI * 2); c.fill(); } }
    else if (kind === 'fence') {
      const a = iso(0.15, 0.85), b = iso(0.85, 0.15);
      c.strokeStyle = '#8a5a34'; c.lineWidth = 2.6; for (const off of [6, 12]) { c.beginPath(); c.moveTo(a.sx, a.sy - off); c.lineTo(b.sx, b.sy - off); c.stroke(); }
      for (const p of [a, iso(0.5, 0.5), b]) { c.fillStyle = '#a7774a'; c.fillRect(p.sx - 2.5, p.sy - 17, 5, 17); c.strokeStyle = INK; c.lineWidth = 1; c.strokeRect(p.sx - 2.5, p.sy - 17, 5, 17); }
    } else {
      const b: Building = {
        id: -1, kind, x: 0, y: 0, size: s, workers: BUILDINGS[kind].jobs, store: {}, incoming: 0, prog: 1, risk: 0, burning: 0, next: 0, cart: 0, buyer: 0, walked: {},
        level: level || 1, pop: 1, room: 0, seen: {}, grace: -1, away: 0, awayUntil: 0,
      };
      building(c, anyAccess, b);
    }
    // trim to what was drawn and centre it in a square, so small buildings fill their button too
    const d = c.getImageData(0, 0, cv.width, cv.height).data, W = cv.width;
    let x0 = W, y0 = W, x1 = -1, y1 = -1;
    for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 10) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    const out = document.createElement('canvas'); out.width = out.height = W;
    if (x1 >= 0) { const bw = x1 - x0 + 1, bh = y1 - y0 + 1, f = (W * 0.94) / Math.max(bw, bh), dw = bw * f, dh = bh * f; out.getContext('2d')!.drawImage(cv, x0, y0, bw, bh, (W - dw) / 2, W - dh - W * 0.03, dw, dh); }
    const url = out.toDataURL('image/png'); icons.set(key, url); return url;
  }

  return { draw, pick, toScreen, centre, iso, metrics, dispose, icon, size: () => ({ w, h }) };
}
