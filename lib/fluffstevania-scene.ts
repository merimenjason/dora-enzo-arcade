// Fluffstevania in Canvas 2D, in the spirit of Symphony of the Night: parallax layers of gothic scenery behind
// every room, stained glass and moonlight, carved stone, candlelight that cuts through the dark, the castle's
// creatures, Dora and Enzo with their afterimages, hit sparks and dust, and an ornate HUD.
// Everything is drawn in the 384×224 view; the page scales it up.
import { drawChinchilla, type ChinId } from './chinchilla-art';
import {
  FluffstevaniaGame, VIEW_W, VIEW_H, TILE, COLS, ROWS, ROOMS, AREAS, FOES, BOSSES, GEAR, FOOD, TAG_ARC, TAG_T, TAG_CD, FX_LIFE, BURN_T, BOSS_KILLS, CHARGE_T, DUO_MAX, DUO_T, SUBS, ROLL_T,
  isSolid, rawTile, roomRect, ghostFaded, type Enemy, type Boss, type BossId, type Shot, type Pickup, type AreaId, type HeroId, type Room, type FoeKind, type PalId, type SubId,
} from './fluffstevania-game';

type C = CanvasRenderingContext2D;
const HERO_DRAW_H = 27;
/** The gothic display face (loaded by the page), then a plain serif until it arrives. */
export const DISPLAY = '"Cinzel", Georgia, serif';
export const BOOK = '"Cormorant Garamond", Georgia, serif';

type Theme = {
  brick: string; brickHi: string; brickLo: string; mortar: string; ledge: string; ledgeHi: string; accent: string;
  /** How dark the room is away from lights, and the colour of that dark. */
  dark: [number, number, number, number]; wood: boolean; moss?: string;
};
const THEMES: Record<AreaId, Theme> = {
  approach: { brick: '#4a4458', brickHi: '#6c6480', brickLo: '#2c2838', mortar: '#1e1b28', ledge: '#6b4a32', ledgeHi: '#9a7050', accent: '#5f8a4a', dark: [10, 8, 34, 0.32], wood: true, moss: '#4f7a3e' },
  hall: { brick: '#4b3e5e', brickHi: '#6e5d86', brickLo: '#2c2340', mortar: '#1b1428', ledge: '#6a5a7e', ledgeHi: '#9888b0', accent: '#b04055', dark: [12, 4, 22, 0.46], wood: false },
  cellar: { brick: '#5e4632', brickHi: '#86664a', brickLo: '#38281a', mortar: '#1f150c', ledge: '#7a5634', ledgeHi: '#a8804e', accent: '#d8a040', dark: [18, 8, 0, 0.5], wood: true, moss: '#5a6a2e' },
  belfry: { brick: '#3e5058', brickHi: '#5e7680', brickLo: '#243238', mortar: '#131c20', ledge: '#5a4a3a', ledgeHi: '#86705a', accent: '#7fd8b8', dark: [4, 12, 22, 0.36], wood: true },
  library: { brick: '#4a2c30', brickHi: '#6e4448', brickLo: '#2a161a', mortar: '#180a0e', ledge: '#6a4028', ledgeHi: '#a06a40', accent: '#d8b060', dark: [16, 6, 12, 0.5], wood: true },
  catacombs: { brick: '#46504a', brickHi: '#66746a', brickLo: '#262e2a', mortar: '#121814', ledge: '#5e6458', ledgeHi: '#8a927e', accent: '#9fd878', dark: [4, 12, 8, 0.6], wood: false, moss: '#3e6a36' },
  clock: { brick: '#4e4640', brickHi: '#746858', brickLo: '#2a2420', mortar: '#15110e', ledge: '#9a7430', ledgeHi: '#e8c060', accent: '#e8c860', dark: [10, 8, 20, 0.44], wood: false },
};

const hash = (a: number, b: number) => { let h = (a * 374761393 + b * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const ellipse = (c: C, x: number, y: number, rx: number, ry: number, rot = 0) => { c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2); };
function shade(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}
function rgba(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
/** A pointed gothic arch standing on (x, y + h), w wide and h tall. */
function archPath(c: C, x: number, y: number, w: number, h: number) {
  c.beginPath(); c.moveTo(x, y + h); c.lineTo(x, y + w * 0.55);
  c.quadraticCurveTo(x, y + w * 0.08, x + w / 2, y - w * 0.18);
  c.quadraticCurveTo(x + w, y + w * 0.08, x + w, y + w * 0.55);
  c.lineTo(x + w, y + h); c.closePath();
}
const mod = (a: number, n: number) => ((a % n) + n) % n;

// ─── Parallax layers ──────────────────────────────────────────────────────
// Each area has three layers, far to near. Every layer is LW wide and wraps around, so its scenery repeats
// seamlessly as the camera travels; `f` is how fast it scrolls with the camera, `fy` the same vertically.

const LW = VIEW_W * 2, LH = VIEW_H + 96;
/** `windows` are the stained-glass arches painted on a layer, where rain and lightning show through. */
type Layer = { cv: HTMLCanvasElement; f: number; fy: number; windows?: { x: number; y: number; w: number; h: number }[] };
const layerCache = new Map<string, Layer[]>();
function canvas(w = LW, h = LH) { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; return cv; }
/** Draw something at x and again one layer-width either side, so it wraps across the seam. */
const wrap = (draw: (dx: number) => void) => { draw(0); draw(-LW); draw(LW); };

function layersFor(area: AreaId, roomId: string): Layer[] {
  const key = roomId === 'belfry' || roomId === 'throne' || roomId === 'study' ? `${area}:${roomId}` : area;
  const hit = layerCache.get(key);
  if (hit) return hit;
  const made = area === 'approach' ? approachLayers() : area === 'hall' ? hallLayers() : area === 'cellar' ? cellarLayers()
    : area === 'belfry' ? belfryLayers(roomId === 'belfry') : area === 'library' ? libraryLayers(roomId === 'study') : area === 'clock' ? clockLayers() : catacombLayers(roomId === 'throne');
  layerCache.set(key, made);
  return made;
}
function layer(f: number, fy: number, paint: (c: C) => void): Layer {
  const cv = canvas(), c = cv.getContext('2d')!;
  paint(c);
  return { cv, f, fy };
}
function stars(c: C, n: number, maxY: number, seed: number) {
  for (let i = 0; i < n; i++) {
    const a = 0.25 + hash(i, seed) * 0.7, x = hash(i, seed + 1) * LW, y = hash(i, seed + 2) * maxY;
    c.fillStyle = `rgba(255,250,235,${a})`; c.fillRect(x, y, hash(i, seed + 3) > 0.92 ? 2 : 1, hash(i, seed + 3) > 0.92 ? 2 : 1);
  }
}
function moon(c: C, x: number, y: number, r: number, tint: string) {
  const halo = c.createRadialGradient(x, y, r * 0.6, x, y, r * 4);
  halo.addColorStop(0, rgba(tint, 0.35)); halo.addColorStop(1, rgba(tint, 0));
  c.fillStyle = halo; c.fillRect(x - r * 4, y - r * 4, r * 8, r * 8);
  const disc = c.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  disc.addColorStop(0, '#fffaf0'); disc.addColorStop(1, shade(tint, 0.92));
  c.fillStyle = disc; ellipse(c, x, y, r, r); c.fill();
  c.fillStyle = 'rgba(150,130,120,0.22)';
  for (const [dx, dy, s] of [[-0.3, -0.2, 0.22], [0.25, 0.3, 0.16], [0.2, -0.4, 0.1], [-0.1, 0.45, 0.12]]) { ellipse(c, x + dx * r, y + dy * r, s * r, s * r * 0.85); c.fill(); }
}
function clouds(c: C, y: number, color: string, seed: number) {
  for (let i = 0; i < 9; i++) {
    const x = hash(i, seed) * LW, w = 60 + hash(seed, i) * 110, cy = y + hash(i, seed + 7) * 50;
    wrap((dx) => { c.fillStyle = color; ellipse(c, x + dx, cy, w, 5 + hash(i, 3) * 4); c.fill(); ellipse(c, x + dx + w * 0.3, cy - 4, w * 0.5, 4); c.fill(); });
  }
}
/** A ridge line that wraps: sums of sines whose periods divide the layer width. */
function ridge(c: C, base: number, amps: [number, number][], color: string) {
  c.fillStyle = color; c.beginPath(); c.moveTo(0, LH);
  for (let x = 0; x <= LW; x += 8) {
    let y = base;
    for (const [k, a] of amps) y += Math.sin((x / LW) * Math.PI * 2 * k + k) * a;
    c.lineTo(x, y);
  }
  c.lineTo(LW, LH); c.fill();
}
function branch(c: C, x: number, y: number, len: number, ang: number, depth: number, w: number, seed: number) {
  const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
  c.lineWidth = w; c.beginPath(); c.moveTo(x, y); c.lineTo(x2, y2); c.stroke();
  if (depth <= 0) return;
  branch(c, x2, y2, len * 0.72, ang - 0.4 - hash(seed, depth) * 0.35, depth - 1, w * 0.62, seed + 1);
  branch(c, x2, y2, len * 0.68, ang + 0.35 + hash(depth, seed) * 0.35, depth - 1, w * 0.62, seed + 2);
  if (depth > 2 && hash(seed, 9) > 0.5) branch(c, x2, y2, len * 0.5, ang + 0.05, depth - 2, w * 0.5, seed + 3);
}
function castleSilhouette(c: C, cx: number, base: number, color: string, window: string) {
  c.fillStyle = color;
  const tower = (x: number, w: number, h: number) => {
    c.fillStyle = color;
    c.fillRect(x - w / 2, base - h, w, h);
    c.beginPath(); c.moveTo(x - w / 2 - 4, base - h); c.lineTo(x, base - h - w * 1.6); c.lineTo(x + w / 2 + 4, base - h); c.fill();
    c.fillRect(x - 0.5, base - h - w * 1.6 - 8, 1, 8);
    c.fillStyle = window;
    for (let y = base - h + 12; y < base - 12; y += 20) if (hash(x, y) > 0.45) { c.fillRect(x - 2, y, 4, 7); c.beginPath(); c.arc(x, y, 2, Math.PI, 0); c.fill(); }
  };
  c.fillRect(cx - 120, base - 70, 270, 70);
  for (let x = cx - 120; x < cx + 150; x += 14) c.fillRect(x, base - 78, 8, 8);
  tower(cx - 110, 30, 130); tower(cx - 40, 44, 210); tower(cx + 34, 28, 160); tower(cx + 120, 36, 118); tower(cx + 70, 18, 190);
  c.fillStyle = window;
  for (let x = cx - 100; x < cx + 140; x += 26) if (hash(x, 3) > 0.5) c.fillRect(x, base - 50, 3, 6);
}

function approachLayers(): Layer[] {
  return [
    layer(0.03, 0.04, (c) => {
      const sky = c.createLinearGradient(0, 0, 0, LH);
      sky.addColorStop(0, '#080a22'); sky.addColorStop(0.5, '#231a44'); sky.addColorStop(0.85, '#55305a'); sky.addColorStop(1, '#6a3a5a');
      c.fillStyle = sky; c.fillRect(0, 0, LW, LH);
      stars(c, 260, LH * 0.7, 11);
      moon(c, 170, 78, 38, '#ffeac8');
      clouds(c, 70, 'rgba(120,90,140,0.22)', 4);
      clouds(c, 150, 'rgba(90,60,110,0.25)', 9);
    }),
    layer(0.12, 0.08, (c) => {
      ridge(c, LH * 0.62, [[1, 18], [3, 12], [7, 5]], '#2a1f48');
      ridge(c, LH * 0.7, [[2, 14], [5, 8], [11, 3]], '#1d1636');
      castleSilhouette(c, 470, LH * 0.66, '#130f26', 'rgba(255,196,110,0.85)');
      // Moonlight catching the castle's left edges.
      c.fillStyle = 'rgba(200,180,255,0.08)'; c.fillRect(470 - 162, LH * 0.66 - 212, 4, 212);
    }),
    layer(0.35, 0.18, (c) => {
      ridge(c, LH - 58, [[2, 10], [4, 6], [9, 2]], '#0b0917');
      c.strokeStyle = '#0b0917'; c.lineCap = 'round';
      for (const [x, s] of [[70, 1], [300, 1.3], [540, 0.9], [700, 1.15]] as const) wrap((dx) => branch(c, x + dx, LH - 52, 34 * s, -Math.PI / 2 - 0.05, 5, 7 * s, x));
      c.fillStyle = '#0b0917';
      for (let i = 0; i < 12; i++) {
        const x = hash(i, 40) * LW, h = 10 + hash(40, i) * 10;
        wrap((dx) => {
          if (i % 3 === 0) { c.fillRect(x + dx - 1.5, LH - 58 - h - 4, 3, h + 6); c.fillRect(x + dx - 5, LH - 58 - h + 1, 10, 3); }
          else { c.beginPath(); c.moveTo(x + dx - 5, LH - 56); c.lineTo(x + dx - 5, LH - 56 - h); c.arc(x + dx, LH - 56 - h, 5, Math.PI, 0); c.lineTo(x + dx + 5, LH - 56); c.fill(); }
        });
      }
      // An iron fence along the ridge.
      c.fillStyle = '#0b0917';
      for (let x = 0; x < LW; x += 7) { if (mod(x, 180) > 120) continue; c.fillRect(x, LH - 80, 1.5, 26); c.beginPath(); c.moveTo(x - 1.5, LH - 80); c.lineTo(x + 0.75, LH - 85); c.lineTo(x + 3, LH - 80); c.fill(); }
      for (let x = 0; x < LW; x += 180) { c.fillRect(x + 120, LH - 76, 1, 1); c.fillRect(x, LH - 74, 120, 1.5); c.fillRect(x, LH - 62, 120, 1.5); }
    }),
  ];
}

const GLASS = ['#b02a3a', '#2a4ab0', '#d8a830', '#6a2a9a', '#2a8a6a', '#c05a20'];
/** A stained-glass window of two lancets and a rose, with coloured light falling from it. */
function stainedWindow(c: C, x: number, y: number, seed: number) {
  const w = 70, h = 190;
  // Stone surround.
  c.fillStyle = '#2c2240'; archPath(c, x - 7, y - 4, w + 14, h + 10); c.fill();
  c.fillStyle = '#3e3258'; archPath(c, x - 4, y - 1, w + 8, h + 5); c.fill();
  c.fillStyle = '#0a0612'; archPath(c, x, y + 2, w, h); c.fill();
  const pane = (px: number, py: number, pw: number, ph: number, clip: () => void) => {
    c.save(); clip(); c.clip();
    for (let gy = py; gy < py + ph; gy += 9) for (let gx = px; gx < px + pw; gx += 7) {
      const k = hash(gx + seed, gy);
      c.fillStyle = GLASS[Math.floor(k * GLASS.length)];
      c.globalAlpha = 0.75 + hash(gy, gx) * 0.25;
      c.fillRect(gx, gy, 7, 9);
    }
    c.globalAlpha = 1;
    // A figure-ish motif: a golden berry in each lancet.
    c.fillStyle = '#f0c850'; ellipse(c, px + pw / 2, py + ph * 0.45, pw * 0.22, pw * 0.26); c.fill();
    c.fillStyle = '#5aa040'; ellipse(c, px + pw / 2 + 3, py + ph * 0.45 - pw * 0.28, 3, 1.5, -0.5); c.fill();
    // Lead lines.
    c.strokeStyle = '#140c18'; c.lineWidth = 1;
    for (let gy = py; gy < py + ph; gy += 9) { c.beginPath(); c.moveTo(px, gy); c.lineTo(px + pw, gy); c.stroke(); }
    for (let gx = px; gx < px + pw; gx += 7) { c.beginPath(); c.moveTo(gx, py); c.lineTo(gx, py + ph); c.stroke(); }
    c.restore();
  };
  const lw = 26;
  for (const lx of [x + 6, x + w - 6 - lw]) pane(lx, y + 70, lw, h - 74, () => archPath(c, lx, y + 76, lw, h - 78));
  const rx = x + w / 2, ry = y + 38, rr = 18;
  c.save(); c.beginPath(); c.arc(rx, ry, rr, 0, Math.PI * 2); c.clip();
  for (let i = 0; i < 12; i++) {
    c.fillStyle = GLASS[(i + seed) % GLASS.length];
    c.beginPath(); c.moveTo(rx, ry); c.arc(rx, ry, rr, (i * Math.PI) / 6, ((i + 1) * Math.PI) / 6); c.fill();
  }
  c.fillStyle = '#f0c850'; ellipse(c, rx, ry, 6, 6); c.fill();
  c.strokeStyle = '#140c18'; c.lineWidth = 1.2;
  for (let i = 0; i < 12; i++) { c.beginPath(); c.moveTo(rx, ry); c.lineTo(rx + Math.cos((i * Math.PI) / 6) * rr, ry + Math.sin((i * Math.PI) / 6) * rr); c.stroke(); }
  c.beginPath(); c.arc(rx, ry, 6, 0, Math.PI * 2); c.stroke();
  c.restore();
  c.strokeStyle = '#3e3258'; c.lineWidth = 3; c.beginPath(); c.arc(rx, ry, rr, 0, Math.PI * 2); c.stroke();
  // Light pouring down to the right in bands of colour.
  for (let i = 0; i < 3; i++) {
    const beam = c.createLinearGradient(x, y + 60, x + 150, LH);
    beam.addColorStop(0, rgba(GLASS[(i * 2 + seed) % GLASS.length], 0.16)); beam.addColorStop(1, rgba(GLASS[(i * 2 + seed) % GLASS.length], 0));
    c.fillStyle = beam;
    const x0 = x + 8 + i * 20;
    c.beginPath(); c.moveTo(x0, y + 80); c.lineTo(x0 + 20, y + 80); c.lineTo(x0 + 150, LH); c.lineTo(x0 + 110, LH); c.fill();
  }
}
function banner(c: C, x: number, y: number, h: number, cloth: string) {
  c.fillStyle = '#2a1a0e'; c.fillRect(x - 5, y - 4, 42, 4);
  c.fillStyle = '#c8a040'; ellipse(c, x - 5, y - 2, 2.5, 2.5); c.fill(); ellipse(c, x + 37, y - 2, 2.5, 2.5); c.fill();
  const g = c.createLinearGradient(x, 0, x + 32, 0);
  g.addColorStop(0, shade(cloth, 0.7)); g.addColorStop(0.5, cloth); g.addColorStop(1, shade(cloth, 0.6));
  c.fillStyle = g; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 32, y); c.lineTo(x + 32, y + h); c.lineTo(x + 16, y + h - 14); c.lineTo(x, y + h); c.fill();
  c.strokeStyle = '#d8b050'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(x + 3, y); c.lineTo(x + 3, y + h - 4); c.moveTo(x + 29, y); c.lineTo(x + 29, y + h - 4); c.stroke();
  c.fillStyle = '#e8b840'; ellipse(c, x + 16, y + h * 0.4, 7, 9); c.fill();
  c.fillStyle = '#fff0a0'; ellipse(c, x + 14, y + h * 0.37, 2, 3); c.fill();
  c.fillStyle = '#6aa040'; ellipse(c, x + 20, y + h * 0.4 - 11, 4, 2, -0.5); c.fill();
}
function column(c: C, x: number, w: number, top: number, bottom: number, stone: string) {
  const g = c.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, shade(stone, 0.55)); g.addColorStop(0.3, shade(stone, 1.15)); g.addColorStop(0.55, stone); g.addColorStop(1, shade(stone, 0.4));
  c.fillStyle = g; c.fillRect(x, top, w, bottom - top);
  c.fillStyle = 'rgba(0,0,0,0.25)'; for (let i = 1; i < 4; i++) c.fillRect(x + (w * i) / 4, top, 1, bottom - top);
  c.fillStyle = shade(stone, 0.8); c.fillRect(x - 6, top, w + 12, 10); c.fillRect(x - 4, top + 10, w + 8, 5);
  c.fillStyle = shade(stone, 1.2); c.fillRect(x - 6, top, w + 12, 2);
  c.fillStyle = shade(stone, 0.8); c.fillRect(x - 6, bottom - 12, w + 12, 12);
}
function hallLayers(): Layer[] {
  return [
    layer(0.08, 0.06, (c) => {
      const g = c.createLinearGradient(0, 0, 0, LH);
      g.addColorStop(0, '#120a1e'); g.addColorStop(1, '#221630');
      c.fillStyle = g; c.fillRect(0, 0, LW, LH);
      for (let y = 0; y < LH; y += 32) for (let x = (y / 32) % 2 ? -32 : 0; x < LW; x += 64) { c.fillStyle = `rgba(90,70,120,${0.05 + hash(x, y) * 0.05})`; c.fillRect(x + 1, y + 1, 62, 30); }
      // A far colonnade.
      for (let x = 0; x < LW; x += 96) {
        c.fillStyle = '#0b0714'; archPath(c, x + 18, 150, 60, 170); c.fill();
        c.fillStyle = 'rgba(120,100,170,0.08)'; c.fillRect(x + 4, 120, 10, LH);
      }
    }),
    {
      ...layer(0.25, 0.12, (c) => {
        for (let i = 0; i < 3; i++) stainedWindow(c, 40 + i * 256, 34, i * 2);
        for (let i = 0; i < 3; i++) banner(c, 170 + i * 256, 60, 120, '#7a1c30');
      }),
      windows: [0, 1, 2].map((i) => ({ x: 40 + i * 256, y: 36, w: 70, h: 190 })),
    },
    layer(0.5, 0.22, (c) => {
      for (const x of [110, 110 + 384]) {
        column(c, x, 34, 0, LH, '#3a2e4c');
        // An iron chandelier hanging beside it.
        const cx = x + 200, cy = 70;
        c.strokeStyle = '#1a1420'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(cx, 0); c.lineTo(cx, cy - 10); c.stroke();
        c.beginPath(); c.moveTo(cx - 30, cy); c.quadraticCurveTo(cx, cy + 16, cx + 30, cy); c.stroke();
        c.beginPath(); c.moveTo(cx - 30, cy); c.lineTo(cx, cy - 12); c.lineTo(cx + 30, cy); c.stroke();
        for (let k = -2; k <= 2; k++) {
          const px = cx + k * 14, py = cy + 6 - Math.abs(k) * 2.5;
          c.fillStyle = '#e8dcc0'; c.fillRect(px - 1.5, py - 8, 3, 7);
          const glow = c.createRadialGradient(px, py - 11, 0, px, py - 11, 16);
          glow.addColorStop(0, 'rgba(255,200,110,0.45)'); glow.addColorStop(1, 'rgba(255,200,110,0)');
          c.fillStyle = glow; c.fillRect(px - 16, py - 27, 32, 32);
          c.fillStyle = '#ffc060'; ellipse(c, px, py - 11, 1.6, 3); c.fill();
        }
      }
    }),
  ];
}

function barrel(c: C, x: number, y: number, r: number) {
  const g = c.createRadialGradient(x - r * 0.3, y - r * 0.3, 1, x, y, r);
  g.addColorStop(0, '#7a5230'); g.addColorStop(1, '#3a2412');
  c.fillStyle = g; ellipse(c, x, y, r, r); c.fill();
  c.strokeStyle = '#2a1a0c'; c.lineWidth = 1.5; ellipse(c, x, y, r * 0.72, r * 0.72); c.stroke(); ellipse(c, x, y, r, r); c.stroke();
  c.fillStyle = '#1a0e06'; ellipse(c, x, y, r * 0.15, r * 0.15); c.fill();
}
function cellarLayers(): Layer[] {
  return [
    layer(0.08, 0.06, (c) => {
      const g = c.createLinearGradient(0, 0, 0, LH);
      g.addColorStop(0, '#140c06'); g.addColorStop(1, '#2a1a0e');
      c.fillStyle = g; c.fillRect(0, 0, LW, LH);
      for (let y = 0; y < LH; y += 16) for (let x = (y / 16) % 2 ? -16 : 0; x < LW; x += 32) { c.fillStyle = `rgba(120,80,40,${0.08 + hash(x, y) * 0.08})`; c.fillRect(x + 1, y + 1, 30, 14); }
      for (let x = 0; x < LW; x += 192) {
        c.strokeStyle = 'rgba(160,110,60,0.18)'; c.lineWidth = 10; c.beginPath(); c.arc(x + 96, 150, 90, Math.PI, 0); c.stroke();
        c.fillStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.arc(x + 96, 150, 84, Math.PI, 0); c.lineTo(x + 180, LH); c.lineTo(x + 12, LH); c.fill();
      }
    }),
    layer(0.3, 0.14, (c) => {
      for (let i = 0; i < 4; i++) {
        const x = 40 + i * 192, base = LH - 40;
        if (i % 2 === 0) {
          for (let row = 0; row < 3; row++) for (let k = 0; k < 3 - row; k++) barrel(c, x + 22 + k * 36 + row * 18, base - 16 - row * 32, 16);
        } else {
          for (let row = 0; row < 3; row++) for (let k = 0; k < 2; k++) {
            const bx = x + k * 50 + row * 6, by = base - 26 - row * 26;
            c.fillStyle = shade('#c8a048', 0.8 + hash(i, row * 3 + k) * 0.3); c.fillRect(bx, by, 46, 24);
            c.strokeStyle = 'rgba(110,80,20,0.7)'; c.lineWidth = 1;
            for (let s = 0; s < 8; s++) { c.beginPath(); c.moveTo(bx + s * 6, by); c.lineTo(bx + s * 6 + 3, by + 24); c.stroke(); }
            c.fillStyle = '#6a4a18'; c.fillRect(bx + 10, by, 2, 24); c.fillRect(bx + 34, by, 2, 24);
          }
        }
      }
    }),
    layer(0.55, 0.24, (c) => {
      for (const x of [60, 60 + 384]) {
        c.fillStyle = '#24160a'; c.fillRect(x, 0, 18, LH); c.fillStyle = '#3e2814'; c.fillRect(x + 3, 0, 4, LH);
        c.fillStyle = '#24160a'; c.fillRect(x - 120, 26, 300, 14); c.fillStyle = '#3e2814'; c.fillRect(x - 120, 27, 300, 3);
        c.strokeStyle = '#24160a'; c.lineWidth = 9; c.beginPath(); c.moveTo(x + 9, 110); c.lineTo(x + 70, 36); c.moveTo(x + 9, 110); c.lineTo(x - 52, 36); c.stroke();
        // Herbs and garlic hanging from the beam.
        for (let k = 0; k < 5; k++) {
          const hx = x + 90 + k * 26, len = 20 + hash(k, x) * 20;
          c.strokeStyle = '#1a1008'; c.lineWidth = 1; c.beginPath(); c.moveTo(hx, 40); c.lineTo(hx, 40 + len); c.stroke();
          if (k % 2) { c.fillStyle = '#d8ccb0'; for (let j = 0; j < 3; j++) { ellipse(c, hx, 44 + len + j * 7 - 6, 4, 4); c.fill(); } }
          else { c.fillStyle = '#4a5a24'; c.beginPath(); c.moveTo(hx, 40 + len); c.lineTo(hx - 6, 40 + len + 16); c.lineTo(hx + 6, 40 + len + 16); c.fill(); }
        }
      }
    }),
  ];
}

function gearShape(c: C, x: number, y: number, r: number, teeth: number, rot: number, color: string) {
  c.fillStyle = color; c.beginPath();
  for (let i = 0; i < teeth; i++) {
    const a = rot + (i / teeth) * Math.PI * 2, s = Math.PI / teeth;
    c.lineTo(x + Math.cos(a - s * 0.5) * r, y + Math.sin(a - s * 0.5) * r);
    c.lineTo(x + Math.cos(a - s * 0.3) * r * 1.16, y + Math.sin(a - s * 0.3) * r * 1.16);
    c.lineTo(x + Math.cos(a + s * 0.3) * r * 1.16, y + Math.sin(a + s * 0.3) * r * 1.16);
    c.lineTo(x + Math.cos(a + s * 0.5) * r, y + Math.sin(a + s * 0.5) * r);
  }
  c.closePath();
  c.moveTo(x + r * 0.3, y); c.arc(x, y, r * 0.3, 0, Math.PI * 2, true);
  c.fill('evenodd');
  c.strokeStyle = color; c.lineWidth = r * 0.12;
  for (let i = 0; i < 4; i++) { const a = rot + (i * Math.PI) / 2; c.beginPath(); c.moveTo(x + Math.cos(a) * r * 0.3, y + Math.sin(a) * r * 0.3); c.lineTo(x + Math.cos(a) * r * 0.9, y + Math.sin(a) * r * 0.9); c.stroke(); }
}
function belfryLayers(bell: boolean): Layer[] {
  const sky = layer(0.03, 0.04, (c) => {
    const g = c.createLinearGradient(0, 0, 0, LH);
    g.addColorStop(0, '#0a1a2a'); g.addColorStop(0.6, '#1a3a52'); g.addColorStop(1, '#2e5a6e');
    c.fillStyle = g; c.fillRect(0, 0, LW, LH);
    stars(c, 240, LH, 21);
    moon(c, 250, 120, 30, '#d8f4ff');
    clouds(c, 110, 'rgba(120,170,190,0.12)', 13);
  });
  const wall = layer(0.18, 0.1, (c) => {
    c.fillStyle = '#16242c'; c.fillRect(0, 0, LW, LH);
    for (let y = 0; y < LH; y += 20) for (let x = (y / 20) % 2 ? -20 : 0; x < LW; x += 40) { c.fillStyle = `rgba(110,150,160,${0.06 + hash(x, y) * 0.06})`; c.fillRect(x + 1, y + 1, 38, 18); }
    // Great arches open onto the night sky behind.
    c.globalCompositeOperation = 'destination-out'; c.fillStyle = '#000';
    for (let x = 36; x < LW; x += 192) { archPath(c, x, 50, 110, 220); c.fill(); }
    c.globalCompositeOperation = 'source-over';
    for (let x = 36; x < LW; x += 192) {
      c.strokeStyle = '#2e4450'; c.lineWidth = 7; archPath(c, x - 3, 47, 116, 226); c.stroke();
      c.strokeStyle = '#4a6a78'; c.lineWidth = 1.5; archPath(c, x - 6, 44, 122, 230); c.stroke();
      c.fillStyle = '#243842'; c.fillRect(x - 8, 262, 126, 10);
    }
  });
  const near = layer(0.45, 0.2, (c) => {
    gearShape(c, 120, LH - 20, 70, 16, 0.2, '#0c1418');
    gearShape(c, 230, LH - 70, 36, 10, 0.5, '#0e181c');
    gearShape(c, 520, 10, 56, 14, 0.1, '#0c1418');
    gearShape(c, 610, 60, 26, 8, 0.4, '#0e181c');
    c.strokeStyle = '#0c1418'; c.lineWidth = 2;
    for (const x of [330, 380, 700]) { c.beginPath(); c.moveTo(x, 0); c.quadraticCurveTo(x + 6, LH * 0.4, x - 2, LH * 0.7); c.stroke(); }
    if (bell) {
      const bx = 400, by = 36;
      c.strokeStyle = '#2a2016'; c.lineWidth = 10; c.beginPath(); c.moveTo(bx - 110, by); c.lineTo(bx + 110, by); c.stroke();
      const g = c.createLinearGradient(bx - 70, 0, bx + 70, 0);
      g.addColorStop(0, '#3a2c16'); g.addColorStop(0.35, '#b89048'); g.addColorStop(0.5, '#e8c070'); g.addColorStop(1, '#2e2210');
      c.fillStyle = g;
      c.beginPath(); c.moveTo(bx - 32, by + 12); c.quadraticCurveTo(bx - 36, by + 96, bx - 72, by + 128); c.lineTo(bx + 72, by + 128); c.quadraticCurveTo(bx + 36, by + 96, bx + 32, by + 12); c.fill();
      c.fillStyle = '#241a0c'; ellipse(c, bx, by + 128, 72, 9); c.fill();
      c.strokeStyle = 'rgba(255,230,160,0.3)'; c.lineWidth = 2; c.beginPath(); c.moveTo(bx - 60, by + 112); c.lineTo(bx + 60, by + 112); c.stroke();
    }
  });
  return [sky, wall, near];
}

function skull(c: C, x: number, y: number, s: number, color: string) {
  c.fillStyle = color; ellipse(c, x, y, 5 * s, 4.4 * s); c.fill(); c.fillRect(x - 3 * s, y + 2 * s, 6 * s, 3.4 * s);
  c.fillStyle = 'rgba(0,0,0,0.75)'; ellipse(c, x - 2 * s, y + 0.5 * s, 1.4 * s, 1.6 * s); c.fill(); ellipse(c, x + 2 * s, y + 0.5 * s, 1.4 * s, 1.6 * s); c.fill();
  c.fillRect(x - 0.5 * s, y + 2.4 * s, 1 * s, 1.4 * s);
  for (let i = -1; i <= 1; i++) c.fillRect(x + i * 1.6 * s - 0.3 * s, y + 4 * s, 0.6 * s, 1.4 * s);
}
function jar(c: C, x: number, y: number, w: number, h: number, fill: string, glow: boolean) {
  if (glow) {
    const g = c.createRadialGradient(x, y - h / 2, 1, x, y - h / 2, w * 1.6);
    g.addColorStop(0, rgba(fill, 0.35)); g.addColorStop(1, rgba(fill, 0));
    c.fillStyle = g; c.fillRect(x - w * 1.6, y - h / 2 - w * 1.6, w * 3.2, w * 3.2);
  }
  c.fillStyle = 'rgba(200,230,220,0.18)'; c.fillRect(x - w / 2, y - h, w, h);
  c.fillStyle = rgba(fill, 0.85); c.fillRect(x - w / 2 + 1, y - h * 0.72, w - 2, h * 0.72 - 1);
  c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(x - w / 2 + 1.5, y - h + 2, 1.2, h - 4);
  c.fillStyle = '#5a4630'; c.fillRect(x - w / 2 - 1, y - h - 3, w + 2, 3);
}
function cobweb(c: C, x: number, y: number, r: number, sx: 1 | -1, alpha: number) {
  c.strokeStyle = `rgba(220,225,230,${alpha})`; c.lineWidth = 0.6;
  for (let i = 0; i <= 4; i++) { const a = (i / 4) * (Math.PI / 2); c.beginPath(); c.moveTo(x, y); c.lineTo(x + sx * Math.cos(a) * r, y + Math.sin(a) * r); c.stroke(); }
  for (let k = 1; k <= 3; k++) {
    const rr = (r * k) / 3.3;
    c.beginPath();
    for (let i = 0; i <= 4; i++) { const a = (i / 4) * (Math.PI / 2), px = x + sx * Math.cos(a) * rr, py = y + Math.sin(a) * rr; if (i) c.quadraticCurveTo(x + sx * Math.cos(a - 0.2) * rr * 0.85, y + Math.sin(a - 0.2) * rr * 0.85, px, py); else c.moveTo(px, py); }
    c.stroke();
  }
}
/** A bookcase from floor to ceiling, packed with spines of every height. */
function bookcase(c: C, x: number, y: number, w: number, h: number, dim: number, seed: number) {
  const spines = ['#6a1c28', '#243a6a', '#2a5a30', '#7a5a20', '#4a2a5a', '#7a3a1a', '#1e4a4a', '#5a1a3a'];
  c.fillStyle = shade('#3a2012', dim); c.fillRect(x - 4, y - 6, w + 8, h + 6);
  c.fillStyle = shade('#120808', dim); c.fillRect(x, y, w, h);
  for (let sy = y; sy < y + h - 20; sy += 30) {
    let bx = x + 1;
    while (bx < x + w - 3) {
      const n = hash(bx + seed, sy), bw = 3 + Math.floor(n * 4), bh = 17 + Math.floor(hash(sy, bx) * 9);
      if (n > 0.93) { bx += bw + 2; continue; }
      c.fillStyle = shade(spines[Math.floor(hash(bx, sy + seed) * spines.length)], dim * (0.7 + n * 0.5));
      if (n > 0.86) { c.save(); c.translate(bx, sy + 26); c.rotate(-0.25); c.fillRect(0, -bh, bw, bh); c.restore(); bx += bw + 3; continue; }
      c.fillRect(bx, sy + 26 - bh, bw, bh);
      c.fillStyle = `rgba(240,200,120,${0.25 * dim})`; c.fillRect(bx, sy + 26 - bh + 3, bw, 0.8); c.fillRect(bx, sy + 23, bw, 0.8);
      bx += bw + 0.6;
    }
    c.fillStyle = shade('#4a2a16', dim); c.fillRect(x - 2, sy + 26, w + 4, 4);
    c.fillStyle = shade('#6a4020', dim); c.fillRect(x - 2, sy + 26, w + 4, 1);
  }
}
function libraryLayers(study: boolean): Layer[] {
  const far = layer(0.08, 0.06, (c) => {
    const g = c.createLinearGradient(0, 0, 0, LH);
    g.addColorStop(0, '#12060c'); g.addColorStop(1, '#22101a');
    c.fillStyle = g; c.fillRect(0, 0, LW, LH);
    // A wall of bookcases, three storeys high, with a gallery rail between them.
    for (let x = 6; x < LW; x += 96) bookcase(c, x, 20, 84, LH - 20, 0.45, 1);
    for (const y of [104, 208]) { c.fillStyle = '#1a0c08'; c.fillRect(0, y, LW, 5); c.fillStyle = 'rgba(200,150,90,0.15)'; for (let x = 0; x < LW; x += 8) c.fillRect(x, y - 10, 1.2, 10); c.fillRect(0, y - 10, LW, 1.2); }
  });
  const mid = layer(0.25, 0.12, (c) => {
    if (study) {
      // The Count's portrait in a gilt frame, between red curtains.
      for (const x of [140, 140 + 384]) {
        c.fillStyle = '#6a1020'; c.beginPath(); c.moveTo(x - 60, 10); c.quadraticCurveTo(x - 40, 140, x - 64, 300); c.lineTo(x - 90, 300); c.lineTo(x - 90, 10); c.fill();
        c.beginPath(); c.moveTo(x + 150, 10); c.quadraticCurveTo(x + 130, 140, x + 154, 300); c.lineTo(x + 180, 300); c.lineTo(x + 180, 10); c.fill();
        c.fillStyle = '#b08a3a'; c.fillRect(x - 10, 50, 110, 140); c.fillStyle = '#e0c060'; c.fillRect(x - 6, 54, 102, 132);
        c.fillStyle = '#1a0a12'; c.fillRect(x, 60, 90, 120);
        // The fox in the painting: a black cape, a fox's head and two red eyes.
        c.fillStyle = '#2a0e18'; c.beginPath(); c.moveTo(x + 10, 180); c.lineTo(x + 45, 110); c.lineTo(x + 80, 180); c.fill();
        c.fillStyle = '#b8601e'; ellipse(c, x + 45, 100, 14, 12); c.fill();
        c.beginPath(); c.moveTo(x + 33, 94); c.lineTo(x + 30, 72); c.lineTo(x + 42, 90); c.fill(); c.beginPath(); c.moveTo(x + 57, 94); c.lineTo(x + 60, 72); c.lineTo(x + 48, 90); c.fill();
        c.fillStyle = '#f0e6d8'; ellipse(c, x + 45, 108, 7, 5); c.fill();
        c.fillStyle = '#ff3040'; ellipse(c, x + 39, 98, 2, 1.4); c.fill(); ellipse(c, x + 51, 98, 2, 1.4); c.fill();
      }
      return;
    }
    // Tall arched windows full of moonlight, with rolling ladders leaning on the shelves between.
    for (const x of [60, 316, 572]) {
      c.fillStyle = '#2a1a22'; archPath(c, x - 6, 30, 72, 200); c.fill();
      const gl = c.createLinearGradient(0, 30, 0, 230); gl.addColorStop(0, '#34507a'); gl.addColorStop(1, '#1a2438');
      c.fillStyle = gl; archPath(c, x, 36, 60, 194); c.fill();
      c.strokeStyle = '#140a10'; c.lineWidth = 2; c.beginPath(); c.moveTo(x + 30, 40); c.lineTo(x + 30, 230); for (const y of [80, 130, 180]) { c.moveTo(x, y); c.lineTo(x + 60, y); } c.stroke();
      c.fillStyle = 'rgba(220,235,255,0.5)'; ellipse(c, x + 42, 70, 8, 8); c.fill();
      c.strokeStyle = '#3a2210'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(x + 150, 40); c.lineTo(x + 176, 300); c.moveTo(x + 166, 40); c.lineTo(x + 192, 300); c.stroke();
      c.lineWidth = 1.5; for (let i = 0; i < 12; i++) { const t = 50 + i * 21; c.beginPath(); c.moveTo(x + 150 + (t - 40) * 0.1, t); c.lineTo(x + 166 + (t - 40) * 0.1, t); c.stroke(); }
    }
  });
  const near = layer(0.5, 0.22, (c) => {
    for (const x of [90, 90 + 384]) {
      column(c, x, 30, 0, LH, '#3a2430');
      if (study) {
        // A fireplace glowing in the dark.
        const fx = x + 190;
        c.fillStyle = '#2a1a1a'; c.fillRect(fx - 50, LH - 120, 100, 120); c.fillStyle = '#4a3030'; c.fillRect(fx - 58, LH - 128, 116, 10);
        c.fillStyle = '#0a0404'; archPath(c, fx - 32, LH - 100, 64, 100); c.fill();
        const fire = c.createRadialGradient(fx, LH - 10, 2, fx, LH - 20, 50); fire.addColorStop(0, 'rgba(255,200,90,0.9)'); fire.addColorStop(0.4, 'rgba(230,90,30,0.5)'); fire.addColorStop(1, 'rgba(120,20,10,0)');
        c.fillStyle = fire; c.fillRect(fx - 50, LH - 100, 100, 100);
        continue;
      }
      // A bust on a plinth and a reading lamp with a green glass shade.
      const bx = x + 130;
      c.fillStyle = '#2e2028'; c.fillRect(bx - 12, LH - 90, 24, 90); c.fillStyle = '#48343e'; c.fillRect(bx - 15, LH - 94, 30, 6);
      c.fillStyle = '#5a4a52'; ellipse(c, bx, LH - 110, 10, 12); c.fill(); c.fillRect(bx - 12, LH - 100, 24, 8);
      c.beginPath(); c.moveTo(bx - 6, LH - 118); c.lineTo(bx - 8, LH - 130); c.lineTo(bx - 1, LH - 121); c.fill(); c.beginPath(); c.moveTo(bx + 6, LH - 118); c.lineTo(bx + 8, LH - 130); c.lineTo(bx + 1, LH - 121); c.fill();
      const lx = x + 250;
      c.fillStyle = '#2a1a10'; c.fillRect(lx - 30, LH - 60, 60, 6); c.fillRect(lx - 26, LH - 54, 4, 54); c.fillRect(lx + 22, LH - 54, 4, 54);
      c.fillStyle = '#6a5020'; c.fillRect(lx - 1, LH - 80, 2, 20);
      const glow = c.createRadialGradient(lx, LH - 78, 0, lx, LH - 78, 40); glow.addColorStop(0, 'rgba(160,240,160,0.35)'); glow.addColorStop(1, 'rgba(160,240,160,0)');
      c.fillStyle = glow; c.fillRect(lx - 40, LH - 118, 80, 80);
      c.fillStyle = '#2a7a40'; c.beginPath(); c.moveTo(lx - 10, LH - 78); c.lineTo(lx - 5, LH - 88); c.lineTo(lx + 5, LH - 88); c.lineTo(lx + 10, LH - 78); c.fill();
      for (let i = 0; i < 3; i++) { c.fillStyle = ['#6a1c28', '#243a6a', '#7a5a20'][i]; c.fillRect(lx + 8 + i * 5, LH - 72 + i, 4, 12 - i); }
    }
  });
  return [far, mid, near];
}
/** The Clock Tower: the night sky high above the castle, a round-windowed brass-and-stone shaft, and great still gears. */
function clockLayers(): Layer[] {
  const sky = layer(0.03, 0.05, (c) => {
    const g = c.createLinearGradient(0, 0, 0, LH);
    g.addColorStop(0, '#05081a'); g.addColorStop(0.6, '#141c44'); g.addColorStop(1, '#343866');
    c.fillStyle = g; c.fillRect(0, 0, LW, LH);
    stars(c, 340, LH, 41);
    moon(c, 560, 84, 36, '#fff0d0');
    clouds(c, 170, 'rgba(170,176,230,0.12)', 29);
    // The rest of the castle, far below, with its windows lit.
    castleSilhouette(c, 190, LH + 60, '#0a0d22', 'rgba(255,200,110,0.55)');
  });
  const wall = layer(0.2, 0.12, (c) => {
    c.fillStyle = '#1c1612'; c.fillRect(0, 0, LW, LH);
    for (let y = 0; y < LH; y += 18) for (let x = (y / 18) % 2 ? -18 : 0; x < LW; x += 36) { c.fillStyle = `rgba(180,150,110,${0.05 + hash(x, y) * 0.06})`; c.fillRect(x + 1, y + 1, 34, 16); }
    // Round windows onto the sky, with brass frames and spokes.
    c.globalCompositeOperation = 'destination-out'; c.fillStyle = '#000';
    for (let x = 96; x < LW; x += 256) { ellipse(c, x, 110, 58, 58); c.fill(); }
    c.globalCompositeOperation = 'source-over';
    for (let x = 96; x < LW; x += 256) {
      c.strokeStyle = '#5a4424'; c.lineWidth = 9; ellipse(c, x, 110, 60, 60); c.stroke();
      c.strokeStyle = '#b08a40'; c.lineWidth = 2; ellipse(c, x, 110, 64, 64); c.stroke(); ellipse(c, x, 110, 55, 55); c.stroke();
      c.strokeStyle = '#3a2a16'; c.lineWidth = 3;
      for (let i = 0; i < 6; i++) { const a = (i * Math.PI) / 3; c.beginPath(); c.moveTo(x + Math.cos(a) * 12, 110 + Math.sin(a) * 12); c.lineTo(x + Math.cos(a) * 56, 110 + Math.sin(a) * 56); c.stroke(); }
      c.fillStyle = '#3a2a16'; ellipse(c, x, 110, 12, 12); c.fill();
    }
    // Brass pipes running up the walls.
    for (const x of [200, 230, 456, 700]) {
      const pg = c.createLinearGradient(x - 5, 0, x + 5, 0); pg.addColorStop(0, '#4a3418'); pg.addColorStop(0.45, '#b89048'); pg.addColorStop(1, '#3a2810');
      c.fillStyle = pg; c.fillRect(x - 4, 0, 8, LH);
      for (let y = 30; y < LH; y += 70) { c.fillStyle = '#6a5028'; c.fillRect(x - 6, y, 12, 5); }
    }
  });
  const near = layer(0.45, 0.22, (c) => {
    gearShape(c, 110, LH - 30, 80, 18, 0.1, '#120e0a');
    gearShape(c, 250, LH - 90, 40, 11, 0.4, '#16110c');
    gearShape(c, 520, 20, 64, 15, 0.3, '#120e0a');
    gearShape(c, 640, 90, 30, 9, 0.2, '#16110c');
    c.fillStyle = '#100c08';
    for (const y of [60, 200]) c.fillRect(300, y, 170, 8);
    for (let x = 300; x < 470; x += 17) { c.beginPath(); c.moveTo(x, 60); c.lineTo(x + 17, 200); c.lineTo(x + 20, 200); c.lineTo(x + 3, 60); c.fill(); }
  });
  return [sky, wall, near];
}
function catacombLayers(throne: boolean): Layer[] {
  const far = layer(0.08, 0.06, (c) => {
    const g = c.createLinearGradient(0, 0, 0, LH);
    g.addColorStop(0, '#0a0e0b'); g.addColorStop(1, '#161e18');
    c.fillStyle = g; c.fillRect(0, 0, LW, LH);
    // Rows of burial niches, each with a skull or an old jar.
    for (let y = 18; y < LH - 30; y += 46) for (let x = 8; x < LW; x += 38) {
      c.fillStyle = '#070a08'; archPath(c, x, y, 26, 30); c.fill();
      c.strokeStyle = 'rgba(120,150,120,0.12)'; c.lineWidth = 2; archPath(c, x - 1, y - 1, 28, 32); c.stroke();
      if (hash(x, y) > 0.35) skull(c, x + 13, y + 22, 1.3, 'rgba(170,175,150,0.28)');
      else jar(c, x + 13, y + 30, 10, 14, '#6a8a50', false);
    }
  });
  const shelves = layer(0.28, 0.14, (c) => {
    const colors = ['#7fd060', '#d04060', '#e0a030', '#80b0e0'];
    for (let i = 0; i < 4; i++) {
      const x = 20 + i * 192;
      if (throne && i === 1) continue;
      for (const y of [110, 180, 250]) {
        c.fillStyle = '#2a1e12'; c.fillRect(x, y, 150, 6); c.fillStyle = '#44301c'; c.fillRect(x, y, 150, 2);
        c.fillStyle = '#1c140c'; c.fillRect(x + 8, y + 6, 4, 12); c.fillRect(x + 138, y + 6, 4, 12);
        for (let k = 0; k < 7; k++) {
          const jx = x + 12 + k * 20 + hash(k, y) * 4;
          if (hash(k + i, y) > 0.8) { c.fillStyle = '#e0c050'; c.beginPath(); c.moveTo(jx - 8, y); c.lineTo(jx + 8, y); c.lineTo(jx + 8, y - 8); c.closePath(); c.fill(); c.fillStyle = '#b89030'; ellipse(c, jx + 3, y - 3, 1.5, 1.5); c.fill(); continue; }
          jar(c, jx, y, 10 + hash(k, i) * 4, 14 + hash(i, k) * 10, colors[Math.floor(hash(k * 3, y + i) * colors.length)], hash(y, k + i) > 0.55);
        }
      }
      cobweb(c, x, 110, 26, 1, 0.22); cobweb(c, x + 150, 180, 20, -1, 0.18);
    }
    if (throne) {
      // The Rat King's throne: a high-backed chair carved from one great wheel of cheese, with a velvet cushion.
      const tx = 260, base = LH - 40, w = 110, h = 150;
      c.fillStyle = 'rgba(0,0,0,0.35)'; ellipse(c, tx + w / 2, base, w * 0.7, 8); c.fill();
      const cheese = c.createLinearGradient(tx, 0, tx + w, 0);
      cheese.addColorStop(0, '#4a3810'); cheese.addColorStop(0.35, '#86662a'); cheese.addColorStop(1, '#3e2e0c');
      c.fillStyle = cheese; archPath(c, tx + 14, base - h, w - 28, h - 40); c.fill();
      c.fillStyle = '#2e2208';
      for (let k = 0; k < 10; k++) { ellipse(c, tx + 26 + hash(k, 1) * (w - 52), base - h + 6 + hash(1, k) * (h - 60), 2 + hash(k, 2) * 5, 2 + hash(k, 2) * 4); c.fill(); }
      c.fillStyle = cheese; c.fillRect(tx, base - 56, w, 56);
      c.fillStyle = '#6a5220'; c.fillRect(tx, base - 56, w, 4);
      c.fillStyle = '#5a1020'; c.fillRect(tx + 14, base - 66, w - 28, 14); c.fillStyle = '#7a1a2c'; c.fillRect(tx + 14, base - 66, w - 28, 4);
      c.fillStyle = '#b08a30';
      for (const k of [-1, 0, 1]) { const px = tx + w / 2 + k * 16; c.beginPath(); c.moveTo(px - 6, base - h - 14); c.lineTo(px, base - h - 30 - (k ? 0 : 8)); c.lineTo(px + 6, base - h - 14); c.fill(); }
      c.fillStyle = '#8a1a30'; ellipse(c, tx + w / 2, base - h - 16, 3, 3); c.fill();
      // Piles of cheese wheels either side.
      for (const side of [-1, 1]) for (let k = 0; k < 3; k++) {
        const wx = tx + w / 2 + side * (w / 2 + 26 + k * 24), wy = base - 10 - (k === 1 ? 16 : 0);
        c.fillStyle = '#5a4414'; ellipse(c, wx, wy, 14, 9); c.fill(); c.fillStyle = '#7a6024'; ellipse(c, wx, wy - 3, 14, 6); c.fill();
      }
    }
  });
  const near = layer(0.5, 0.22, (c) => {
    for (const x of [140, 140 + 384]) {
      column(c, x, 30, 0, LH, '#3a463e');
      skull(c, x + 15, 120, 2, '#8a8e78');
      skull(c, x + 15, 200, 1.6, '#7a7e68');
      cobweb(c, x + 30, 0, 44, 1, 0.3); cobweb(c, x, 0, 34, -1, 0.25);
    }
    // Stone coffins on the floor between the pillars.
    for (const x of [300, 300 + 384]) {
      c.fillStyle = '#1a221c'; c.beginPath(); c.moveTo(x, LH - 40); c.lineTo(x + 10, LH - 70); c.lineTo(x + 90, LH - 70); c.lineTo(x + 100, LH - 40); c.fill();
      c.fillStyle = '#26302a'; c.fillRect(x + 6, LH - 76, 88, 8);
      c.strokeStyle = 'rgba(160,180,150,0.2)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x + 50, LH - 74); c.lineTo(x + 50, LH - 48); c.moveTo(x + 42, LH - 66); c.lineTo(x + 58, LH - 66); c.stroke();
    }
  });
  return [far, shelves, near];
}

/** The storm outside: lightning flashes a couple of times every several seconds. */
const lightning = (time: number) => { const u = time % 7.3; return u < 0.07 ? 1 : u > 0.16 && u < 0.24 ? 0.7 : u < 0.6 ? Math.max(0, 0.25 - (u - 0.24)) : 0; };
function drawLayers(c: C, g: FluffstevaniaGame, time: number) {
  const rr = roomRect(g.room);
  // How far down a tall room the camera is; a one-screen room shows the lower part of each layer.
  const p = rr.h > VIEW_H ? (g.cam.y - rr.y) / (rr.h - VIEW_H) : 1;
  for (const L of layersFor(g.room.area, g.room.id)) {
    const ox = Math.round(-mod(g.cam.x * L.f, LW));
    const oy = Math.round(-(LH - VIEW_H) * (0.5 + (p - 0.5) * Math.min(1, L.fy * 5)));
    c.drawImage(L.cv, ox, oy);
    c.drawImage(L.cv, ox + LW, oy);
    for (const w of L.windows ?? []) for (const dx of [ox, ox + LW]) {
      const wx = w.x + dx, wy = w.y + oy;
      if (wx > VIEW_W || wx + w.w < 0) continue;
      // Rain streaks down the glass, and lightning lights it up from outside.
      c.save(); archPath(c, wx, wy, w.w, w.h); c.clip();
      c.strokeStyle = 'rgba(190,210,255,0.28)'; c.lineWidth = 0.6; c.beginPath();
      for (let i = 0; i < 26; i++) {
        const rx = wx + hash(i, 3) * w.w, ry = wy + ((hash(i, 9) * w.h + time * (160 + hash(i, 5) * 80)) % w.h);
        c.moveTo(rx, ry); c.lineTo(rx - 1.5, ry + 7);
      }
      c.stroke();
      const flash = lightning(time);
      if (flash > 0) { c.globalCompositeOperation = 'lighter'; c.fillStyle = `rgba(200,215,255,${0.55 * flash})`; c.fillRect(wx, wy, w.w, w.h); }
      c.restore();
    }
  }
}

// ─── Tiles ────────────────────────────────────────────────────────────────
// The room's stonework is painted once into a cache at the screen's resolution and redrawn only when a wall
// breaks, a gate shuts or a door opens.

type TileCache = { key: string; cv: HTMLCanvasElement; scale: number };
let tileCache: TileCache | null = null;
function roomTiles(g: FluffstevaniaGame, scale: number) {
  const room = g.room, rr = roomRect(room);
  const key = `${room.id}:${scale}:${g.flags.size}:${g.fight}`;
  if (tileCache?.key === key) return tileCache;
  const pad = TILE;
  const cv = tileCache && tileCache.cv.width === Math.ceil((rr.w + pad * 2) * scale) && tileCache.cv.height === Math.ceil((rr.h + pad * 2) * scale) ? tileCache.cv : canvas(Math.ceil((rr.w + pad * 2) * scale), Math.ceil((rr.h + pad * 2) * scale));
  const c = cv.getContext('2d')!;
  c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cv.width, cv.height);
  c.setTransform(scale, 0, 0, scale, (pad - rr.x) * scale, (pad - rr.y) * scale);
  paintTiles(c, g, room);
  tileCache = { key, cv, scale };
  return tileCache;
}
function paintTiles(c: C, g: FluffstevaniaGame, room: Room) {
  const t = THEMES[room.area], rr = roomRect(room);
  const c0 = rr.x / TILE - 1, c1 = (rr.x + rr.w) / TILE, r0 = rr.y / TILE - 1, r1 = (rr.y + rr.h) / TILE;
  const solid = (cc: number, r: number) => isSolid(g.tile(cc, r));
  // Soft shadows where open air meets stone.
  for (let r = r0; r <= r1; r++) for (let cc = c0; cc <= c1; cc++) {
    if (solid(cc, r)) continue;
    const x = cc * TILE, y = r * TILE;
    if (solid(cc, r - 1)) { const sh = c.createLinearGradient(0, y, 0, y + 8); sh.addColorStop(0, 'rgba(0,0,0,0.45)'); sh.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = sh; c.fillRect(x, y, TILE, 8); }
    if (solid(cc - 1, r)) { const sh = c.createLinearGradient(x, 0, x + 6, 0); sh.addColorStop(0, 'rgba(0,0,0,0.35)'); sh.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = sh; c.fillRect(x, y, 6, TILE); }
    if (solid(cc + 1, r)) { const sh = c.createLinearGradient(x + TILE, 0, x + TILE - 6, 0); sh.addColorStop(0, 'rgba(0,0,0,0.35)'); sh.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = sh; c.fillRect(x + TILE - 6, y, 6, TILE); }
  }
  for (let r = r0; r <= r1; r++) for (let cc = c0; cc <= c1; cc++) {
    const ch = g.tile(cc, r), x = cc * TILE, y = r * TILE;
    const outside = x < rr.x || x >= rr.x + rr.w || y < rr.y || y >= rr.y + rr.h;
    if (ch === '#' || ch === '%') {
      stone(c, x, y, cc, r, t, room.area, outside);
      const top = !solid(cc, r - 1), under = !solid(cc, r + 1);
      if (top) cap(c, x, y, cc, t, room.area);
      if (under && !outside) underside(c, x, y, cc, r, t, room.area);
      if (!solid(cc - 1, r)) { c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(x, y, 1, TILE); }
      if (!solid(cc + 1, r)) { c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(x + TILE - 1.5, y, 1.5, TILE); }
      if (ch === '%') {
        c.strokeStyle = 'rgba(20,10,20,0.7)'; c.lineWidth = 0.9;
        c.beginPath(); c.moveTo(x + 4, y + 1); c.lineTo(x + 8, y + 6); c.lineTo(x + 5, y + 10); c.lineTo(x + 11, y + 15); c.moveTo(x + 8, y + 6); c.lineTo(x + 13, y + 4); c.stroke();
        c.strokeStyle = 'rgba(255,240,220,0.14)'; c.beginPath(); c.moveTo(x + 5, y + 1); c.lineTo(x + 9, y + 6); c.stroke();
      }
    } else if (ch === '=') {
      ledge(c, x, y, cc, r, t, g.tile(cc - 1, r) !== '=', g.tile(cc + 1, r) !== '=');
    } else if (ch === '^') {
      stone(c, x, y + 10, cc, r, t, room.area, false, 6);
      for (let i = 0; i < 4; i++) {
        const sx = x + i * 4;
        const gr = c.createLinearGradient(sx, 0, sx + 4, 0);
        gr.addColorStop(0, '#6a7088'); gr.addColorStop(0.45, '#e8ecf4'); gr.addColorStop(1, '#4a5068');
        c.fillStyle = gr; c.beginPath(); c.moveTo(sx, y + 11); c.lineTo(sx + 2, y + 1); c.lineTo(sx + 4, y + 11); c.fill();
      }
      c.fillStyle = 'rgba(160,30,40,0.5)'; for (let i = 0; i < 4; i++) if (hash(cc, i) > 0.6) c.fillRect(x + i * 4 + 1.6, y + 2.5, 0.8, 2);
    } else if (ch === 'G') {
      for (let i = 0; i < 3; i++) {
        const gr = c.createLinearGradient(x + 2 + i * 5, 0, x + 4.4 + i * 5, 0);
        gr.addColorStop(0, '#2a2430'); gr.addColorStop(0.5, '#8a8098'); gr.addColorStop(1, '#2a2430');
        c.fillStyle = gr; c.fillRect(x + 2 + i * 5, y, 2.4, TILE);
      }
      c.fillStyle = '#3a3040'; c.fillRect(x, y + 6, TILE, 2.5);
      if (!isSolid(g.tile(cc, r + 1)) || g.tile(cc, r + 1) !== 'G') { c.fillStyle = '#8a8098'; for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(x + 2 + i * 5, y + TILE); c.lineTo(x + 3.2 + i * 5, y + TILE + 3); c.lineTo(x + 4.4 + i * 5, y + TILE); c.fill(); } }
    } else if (rawTile(cc, r) === 'D' && rawTile(cc - 1, r) !== 'D' && rawTile(cc, r - 1) !== 'D') {
      // A door is drawn once, from its top-left tile, to the size of its run of D tiles.
      let w = 1, h = 1;
      while (rawTile(cc + w, r) === 'D') w++;
      while (rawTile(cc, r + h) === 'D') h++;
      sealedDoor(c, x, y, w * TILE, h * TILE, ch !== 'D');
    } else if (ch === '|') {
      // An iron grate: square bars with rivets, crossbars at the top and bottom of the run.
      for (let i = 0; i < 3; i++) {
        const gr = c.createLinearGradient(x + 2 + i * 5, 0, x + 4.6 + i * 5, 0);
        gr.addColorStop(0, '#1e1a22'); gr.addColorStop(0.5, '#7a7488'); gr.addColorStop(1, '#1e1a22');
        c.fillStyle = gr; c.fillRect(x + 2 + i * 5, y, 2.6, TILE);
      }
      c.fillStyle = '#34303c'; c.fillRect(x, y + 7, TILE, 2);
      if (rawTile(cc, r - 1) !== '|') { c.fillStyle = '#4a4454'; c.fillRect(x - 1, y, TILE + 2, 3); }
      if (rawTile(cc, r + 1) !== '|') { c.fillStyle = '#4a4454'; c.fillRect(x - 1, y + TILE - 3, TILE + 2, 3); }
      c.fillStyle = '#9a94a8'; for (let i = 0; i < 3; i++) { ellipse(c, x + 3.3 + i * 5, y + 8, 0.7, 0.7); c.fill(); }
    } else if (ch === 'n') {
      c.fillStyle = '#3a2418'; c.fillRect(x + 7, y + 4, 2, 12);
      c.fillStyle = '#7a5438'; c.fillRect(x + 1, y + 1, 14, 8);
      c.fillStyle = '#9a7050'; c.fillRect(x + 1, y + 1, 14, 1.5);
      c.fillStyle = '#4a2e1c'; c.fillRect(x + 3, y + 3.5, 10, 0.8); c.fillRect(x + 3, y + 5.5, 7, 0.8);
    }
    if (!isSolid(ch) && ch !== '=' && !outside) decorate(c, g, x, y, cc, r, room.area);
  }
}
function block(c: C, x: number, y: number, w: number, h: number, base: string, hi: string, lo: string) {
  c.fillStyle = base; c.fillRect(x, y, w, h);
  c.fillStyle = hi; c.fillRect(x, y, w, 1); c.fillRect(x, y, 1, h);
  c.fillStyle = lo; c.fillRect(x, y + h - 1, w, 1); c.fillRect(x + w - 1, y, 1, h);
}
function stone(c: C, x: number, y: number, cc: number, r: number, t: Theme, area: AreaId, outside: boolean, h = TILE) {
  c.fillStyle = t.mortar; c.fillRect(x, y, TILE, h);
  const off = r % 2 ? 8 : 0, dim = outside ? 0.55 : 1;
  for (let row = 0; row < h; row += 8) {
    for (let bx = -off; bx < TILE; bx += 16) {
      const left = Math.max(x, x + bx + 0.5), right = Math.min(x + TILE, x + bx + 15.5);
      if (right <= left) continue;
      const bid = cc * 2 + Math.floor((bx + off) / 16), n = hash(bid, r * 2 + row / 8), bh = Math.min(7, h - row - 0.5);
      block(c, left, y + row + 0.5, right - left, bh, shade(t.brick, dim * (0.78 + n * 0.3)), shade(t.brickHi, dim * (0.85 + n * 0.2)), shade(t.brickLo, dim * 0.8));
      if (n > 0.86 && !outside) { c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(left + 2, y + row + 2); c.lineTo(left + 5, y + row + 4); c.lineTo(left + 4, y + row + 6.5); c.stroke(); }
      if (n < 0.1 && t.moss && !outside) { c.fillStyle = rgba(t.moss, 0.5); c.fillRect(left, y + row + 5, right - left, 2); }
      if (area === 'catacombs' && n > 0.965 && !outside && h === TILE) skull(c, (left + right) / 2, y + row + 3.4, 0.55, '#a8ac94');
    }
  }
}
function cap(c: C, x: number, y: number, cc: number, t: Theme, area: AreaId) {
  c.fillStyle = shade(t.brickHi, 1.1); c.fillRect(x, y, TILE, 2);
  c.fillStyle = 'rgba(255,255,255,0.18)'; c.fillRect(x, y, TILE, 0.6);
  c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(x, y + 2, TILE, 0.8);
  if (area === 'approach') {
    c.fillStyle = t.accent; c.fillRect(x, y, TILE, 2.5);
    c.fillStyle = '#7fae5e';
    for (let i = 0; i < 5; i++) { const gx = x + 1 + i * 3.2 + hash(cc, i) * 2; c.fillRect(gx, y - 1.5 - hash(i, cc) * 2.5, 0.8, 3 + hash(i, cc) * 2); }
  } else if (t.moss && hash(cc, 77) > 0.55) {
    c.fillStyle = rgba(t.moss, 0.85);
    for (let i = 0; i < 4; i++) { const w = 2 + hash(cc, i) * 4; ellipse(c, x + hash(i, cc) * TILE, y + 0.5, w, 1.3); c.fill(); }
  }
}
function underside(c: C, x: number, y: number, cc: number, r: number, t: Theme, area: AreaId) {
  c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(x, y + TILE - 2, TILE, 2);
  const n = hash(cc, r * 3 + 1);
  if ((area === 'catacombs' || area === 'cellar') && n > 0.7) {
    // Little stalactites and roots.
    c.fillStyle = shade(t.brickLo, 1.1);
    c.beginPath(); c.moveTo(x + 4, y + TILE); c.lineTo(x + 5.5, y + TILE + 3 + n * 4); c.lineTo(x + 7, y + TILE); c.fill();
  }
  if (t.moss && n < 0.25) {
    c.strokeStyle = rgba(t.moss, 0.8); c.lineWidth = 0.8;
    for (let i = 0; i < 3; i++) { const vx = x + 3 + i * 5; c.beginPath(); c.moveTo(vx, y + TILE); c.quadraticCurveTo(vx + 1.5, y + TILE + 4, vx, y + TILE + 6 + hash(i, cc) * 6); c.stroke(); }
  }
}
function ledge(c: C, x: number, y: number, cc: number, r: number, t: Theme, leftEnd: boolean, rightEnd: boolean) {
  if (t.wood) {
    const g = c.createLinearGradient(0, y, 0, y + 5);
    g.addColorStop(0, t.ledgeHi); g.addColorStop(0.3, t.ledge); g.addColorStop(1, shade(t.ledge, 0.6));
    c.fillStyle = g; c.fillRect(x, y, TILE, 5);
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(x + 3 + hash(cc, r) * 8, y + 2, 4, 0.6);
    if (cc % 2 === 0) { c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(x, y, 0.7, 5); }
    c.fillStyle = '#2a2020'; ellipse(c, x + 2, y + 2.5, 0.7, 0.7); c.fill();
    if (leftEnd || rightEnd || cc % 3 === 0) {
      // An iron bracket.
      const bx = leftEnd ? x + 3 : rightEnd ? x + 11 : x + 7;
      c.strokeStyle = '#2a262c'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(bx, y + 5); c.lineTo(bx, y + 11); c.moveTo(bx, y + 5); c.lineTo(bx + (rightEnd ? -5 : 5), y + 5); c.moveTo(bx, y + 10); c.lineTo(bx + (rightEnd ? -5 : 5), y + 5); c.stroke();
    }
  } else {
    block(c, x, y, TILE, 5, t.ledge, t.ledgeHi, shade(t.ledge, 0.55));
    c.fillStyle = 'rgba(255,255,255,0.15)'; c.fillRect(x, y, TILE, 0.6);
    // Carved corbels underneath.
    c.fillStyle = shade(t.ledge, 0.7);
    for (let i = 0; i < 4; i++) c.fillRect(x + 1 + i * 4, y + 5, 2.4, 2);
    if (leftEnd || rightEnd) { c.fillStyle = shade(t.ledge, 0.8); c.beginPath(); const bx = leftEnd ? x + 1 : x + 9; c.moveTo(bx, y + 5); c.lineTo(bx + 6, y + 5); c.lineTo(bx + 3, y + 10); c.fill(); }
  }
}
/** Chains, cobwebs, bones and hay tucked into open corners. */
function decorate(c: C, g: FluffstevaniaGame, x: number, y: number, cc: number, r: number, area: AreaId) {
  if (area === 'approach') return;
  const up = isSolid(g.tile(cc, r - 1)), left = isSolid(g.tile(cc - 1, r)), right = isSolid(g.tile(cc + 1, r)), down = isSolid(g.tile(cc, r + 1));
  const n = hash(cc * 7, r * 13);
  if (up && (left || right) && n < 0.6) cobweb(c, left ? x : x + TILE, y, 11 + n * 8, left ? 1 : -1, 0.35);
  if (up && !left && !right && n > 0.93 && !isSolid(g.tile(cc, r + 1)) && !isSolid(g.tile(cc, r + 2))) {
    const len = 18 + Math.floor(hash(cc, r) * 3) * 8;
    c.strokeStyle = '#2a2630'; c.lineWidth = 1;
    for (let i = 0; i < len; i += 4) { ellipse(c, x + 8, y + i + 2, i % 8 ? 0.8 : 1.6, 2); c.stroke(); }
    c.beginPath(); c.arc(x + 8, y + len + 3, 2.5, 0, Math.PI); c.stroke();
  }
  if (down && !up && n > 0.9) {
    if (area === 'catacombs') { skull(c, x + 6, y + 13, 0.6, '#9a9e86'); c.strokeStyle = '#8a8e76'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(x + 9, y + 15.5); c.lineTo(x + 15, y + 14); c.stroke(); }
    else if (area === 'cellar') { c.fillStyle = '#b89040'; for (let i = 0; i < 6; i++) c.fillRect(x + 2 + i * 2, y + 13 - hash(i, cc) * 3, 0.8, 3 + hash(i, cc) * 3); }
    else if (area === 'hall') { c.fillStyle = 'rgba(160,40,60,0.6)'; c.fillRect(x, y + 15, TILE, 1); }
    else if (area === 'clock') {
      // A dropped cog and a screw or two.
      gearShape(c, x + 5 + n * 6, y + 14.4, 2.4, 7, n * 6, '#8a6a2c');
      c.fillStyle = '#6a6a74'; c.fillRect(x + 12, y + 15, 2, 1);
    } else if (area === 'library') {
      // A little stack of books on the floor.
      for (let i = 0; i < 3; i++) { c.fillStyle = ['#6a1c28', '#243a6a', '#7a5a20'][(i + Math.floor(n * 10)) % 3]; c.fillRect(x + 3 + i * 0.8, y + 13 - i * 2.4, 10 - i, 2.2); }
    }
  }
}
function sealedDoor(c: C, x: number, y: number, w: number, h: number, open: boolean) {
  c.fillStyle = '#2e2436'; archPath(c, x - 6, y - 2, w + 12, h + 2); c.fill();
  c.fillStyle = '#4a3c56'; archPath(c, x - 3, y + 1, w + 6, h - 1); c.fill();
  c.fillStyle = '#0a0608'; archPath(c, x + 1, y + 5, w - 2, h - 5); c.fill();
  if (open) {
    // The doors stand open onto dark stairs.
    for (let i = 0; i < 5; i++) { c.fillStyle = `rgba(90,110,90,${0.25 - i * 0.04})`; c.fillRect(x + 10 + i * 4, y + h - 8 - i * 10, w - 20 - i * 8, 3); }
    c.fillStyle = '#4a2e1a';
    c.beginPath(); c.moveTo(x + 1, y + 30); c.lineTo(x + 9, y + 38); c.lineTo(x + 9, y + h); c.lineTo(x + 1, y + h); c.fill();
    c.beginPath(); c.moveTo(x + w - 1, y + 30); c.lineTo(x + w - 9, y + 38); c.lineTo(x + w - 9, y + h); c.lineTo(x + w - 1, y + h); c.fill();
    return;
  }
  const wood = c.createLinearGradient(x, 0, x + w, 0);
  wood.addColorStop(0, '#3e2614'); wood.addColorStop(0.5, '#6a4426'); wood.addColorStop(1, '#3e2614');
  c.fillStyle = wood; archPath(c, x + 3, y + 7, w - 6, h - 7); c.fill();
  c.strokeStyle = '#2a1a0e'; c.lineWidth = 1;
  for (let px = x + 17.5; px < x + w - 6; px += 14.5) { c.beginPath(); c.moveTo(px, y + 12); c.lineTo(px, y + h); c.stroke(); }
  const b1 = y + h * 0.38, b2 = y + h * 0.73, lock = y + h * 0.58, r = Math.min(8, w / 5);
  c.fillStyle = '#4a4450'; c.fillRect(x + 3, b1, w - 6, 5); c.fillRect(x + 3, b2, w - 6, 5);
  c.fillStyle = '#7a7480'; for (let rx = x + 8; rx < x + w - 5; rx += 10) { ellipse(c, rx, b1 + 2.5, 1.2, 1.2); c.fill(); ellipse(c, rx, b2 + 2.5, 1.2, 1.2); c.fill(); }
  c.fillStyle = '#8a7a50'; ellipse(c, x + w / 2, lock, r, r); c.fill();
  c.fillStyle = '#e8c860'; ellipse(c, x + w / 2, lock, r / 2, r * 0.62); c.fill();
  c.fillStyle = '#1a1008'; c.fillRect(x + w / 2 - 1, lock, 2, r / 2);
}

// ─── Things in the room ───────────────────────────────────────────────────

/** A wall sconce, or a hanging lantern when there's no wall close above. */
function candle(c: C, g: FluffstevaniaGame, k: { x: number; y: number; c: number; r: number }, time: number) {
  const x = k.x, y = k.y;
  const hanging = [1, 2, 3].some((d) => isSolid(g.tile(k.c, k.r - d)));
  if (hanging) {
    let top = k.r - 1; while (!isSolid(g.tile(k.c, top)) && top > k.r - 4) top--;
    c.strokeStyle = '#2a2630'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(x, (top + 1) * TILE); c.lineTo(x, y - 17); c.stroke();
    c.fillStyle = '#3a3440'; c.beginPath(); c.moveTo(x - 4, y - 16); c.lineTo(x + 4, y - 16); c.lineTo(x + 5, y - 3); c.lineTo(x - 5, y - 3); c.fill();
    c.fillStyle = 'rgba(255,200,110,0.5)'; c.fillRect(x - 3, y - 14, 6, 10);
    c.fillStyle = '#3a3440'; c.fillRect(x - 5.5, y - 3, 11, 2); c.fillRect(x - 0.5, y - 14, 1, 10);
    const f = Math.sin(time * 14 + x) * 0.5;
    c.fillStyle = '#ffd070'; ellipse(c, x + f * 0.4, y - 8, 1.6, 2.6); c.fill();
    return;
  }
  c.fillStyle = '#2e2a34'; c.fillRect(x - 5, y, 10, 1.5); c.fillRect(x - 1, y, 2, 5); c.fillRect(x - 3, y + 4.5, 6, 1.4);
  c.fillStyle = '#6a6070'; c.fillRect(x - 5, y, 10, 0.5);
  const wax = c.createLinearGradient(x - 2, 0, x + 2, 0);
  wax.addColorStop(0, '#c8bca8'); wax.addColorStop(0.5, '#fff8e8'); wax.addColorStop(1, '#b0a490');
  c.fillStyle = wax; c.fillRect(x - 2, y - 8, 4, 8);
  c.fillStyle = '#f4ecd8'; c.fillRect(x + 1, y - 8, 1, 3);
  const f = Math.sin(time * 14 + x) * 0.6;
  c.fillStyle = '#ff9a30'; ellipse(c, x + f * 0.4, y - 11.5, 2.4, 4); c.fill();
  c.fillStyle = '#fff2b0'; ellipse(c, x + f * 0.3, y - 11, 1, 2); c.fill();
}
/** A puzzle bookcase, numbered in gold. Each has one book standing out in its colour; the right one slides out once pulled. */
const SHELF_BOOK = ['', '#3060c0', '#c02838', '#309048'];
function drawShelf(c: C, g: FluffstevaniaGame, sh: { x: number; y: number; n: number; flash: number }) {
  const x = sh.x, y = sh.y, solved = !!g.room.opens && g.flags.has(g.room.opens) && sh.n === g.room.puzzle;
  c.save();
  c.fillStyle = '#3a2012'; c.fillRect(x - 12, y - 34, 24, 34);
  c.fillStyle = '#140808'; c.fillRect(x - 10, y - 30, 20, 29);
  for (const sy of [y - 30, y - 20, y - 10]) {
    let bx = x - 9.5;
    while (bx < x + 8) { const n = hash(Math.round(bx * 3) + sh.n, sy), bw = 1.6 + n * 1.6; c.fillStyle = shade(['#6a1c28', '#243a6a', '#2a5a30', '#7a5a20', '#4a2a5a'][Math.floor(n * 5)], 0.7); c.fillRect(bx, sy + 1.5 + n * 2, bw, 8 - n * 2); bx += bw + 0.4; }
    c.fillStyle = '#4a2a16'; c.fillRect(x - 11, sy + 9.5, 22, 1.4);
  }
  // The book that matters, sticking out (or pulled right out once the door's open).
  c.fillStyle = SHELF_BOOK[sh.n];
  if (solved) { c.save(); c.translate(x + 2, y - 11); c.rotate(-0.5); c.fillRect(0, -9, 3.4, 9); c.restore(); }
  else c.fillRect(x - 1, y - 20.5, 3.4, 9.5);
  c.fillStyle = '#e0c060'; c.fillRect(x - 1, y - 19, 3.4, 0.8);
  // A gold plaque with the shelf's number on top.
  c.fillStyle = '#b08a3a'; c.fillRect(x - 6, y - 40, 12, 6); c.fillStyle = '#f0d890';
  c.font = `700 5px ${DISPLAY}`; c.textAlign = 'center'; c.fillText(['', 'I', 'II', 'III'][sh.n], x, y - 35.4);
  if (sh.flash > 0) { c.fillStyle = `rgba(255,255,255,${sh.flash * 0.5})`; c.fillRect(x - 12, y - 34, 24, 34); }
  c.restore();
}
function shrine(c: C, x: number, y: number, time: number) {
  c.fillStyle = '#4a3a58'; c.fillRect(x - 12, y - 2, 24, 2); c.fillRect(x - 10, y - 4, 20, 2);
  const pillar = c.createLinearGradient(x - 5, 0, x + 5, 0);
  pillar.addColorStop(0, '#5a4a68'); pillar.addColorStop(0.4, '#9a8aa8'); pillar.addColorStop(1, '#4a3a58');
  c.fillStyle = pillar; c.fillRect(x - 5, y - 13, 10, 9);
  c.fillStyle = '#8a7a98'; c.fillRect(x - 8, y - 14, 16, 2);
  const bowl = c.createLinearGradient(0, y - 22, 0, y - 13);
  bowl.addColorStop(0, '#f0c850'); bowl.addColorStop(1, '#8a6020');
  c.fillStyle = bowl; c.beginPath(); c.moveTo(x - 15, y - 22); c.quadraticCurveTo(x, y - 8, x + 15, y - 22); c.closePath(); c.fill();
  c.fillStyle = '#f8dc70'; ellipse(c, x, y - 22, 15, 3); c.fill();
  c.fillStyle = '#e8dcc0'; ellipse(c, x, y - 22.5, 12, 2); c.fill();
  for (let i = 0; i < 8; i++) {
    const a = time * 1.3 + i, px = x + Math.sin(a * 1.7) * 11, py = y - 24 - ((time * 12 + i * 7) % 26);
    c.fillStyle = `rgba(255,240,200,${0.85 - ((time * 12 + i * 7) % 26) / 30})`; c.fillRect(px, py, 1.3, 1.3);
  }
}
/** Pip the hamster's stall. */
function stall(c: C, x: number, y: number, time: number) {
  c.fillStyle = '#4a2e18'; c.fillRect(x - 22, y - 30, 3, 30); c.fillRect(x + 19, y - 30, 3, 30);
  for (let i = 0; i < 6; i++) { c.fillStyle = i % 2 ? '#f0e0c0' : '#b02a3a'; c.beginPath(); c.moveTo(x - 25 + i * 8.4, y - 30); c.lineTo(x - 25 + (i + 1) * 8.4, y - 30); c.lineTo(x - 25 + (i + 1) * 8.4, y - 26); c.quadraticCurveTo(x - 25 + (i + 0.5) * 8.4, y - 23, x - 25 + i * 8.4, y - 26); c.fill(); }
  c.fillStyle = '#6a4424'; c.fillRect(x - 26, y - 33, 52, 3);
  // Pip, round and orange, bobbing behind the counter.
  const bob = Math.sin(time * 3) * 0.8;
  c.fillStyle = '#e0a060'; ellipse(c, x + 2, y - 15 + bob, 9, 8); c.fill();
  c.fillStyle = '#fff4e0'; ellipse(c, x + 2, y - 12 + bob, 6, 5); c.fill();
  c.fillStyle = '#e0a060'; ellipse(c, x - 4, y - 22 + bob, 2.6, 2.6); c.fill(); ellipse(c, x + 8, y - 22 + bob, 2.6, 2.6); c.fill();
  c.fillStyle = '#f0b0b0'; ellipse(c, x - 4, y - 22 + bob, 1.3, 1.3); c.fill(); ellipse(c, x + 8, y - 22 + bob, 1.3, 1.3); c.fill();
  c.fillStyle = '#1a1010'; ellipse(c, x - 1, y - 17 + bob, 1.1, 1.3); c.fill(); ellipse(c, x + 5, y - 17 + bob, 1.1, 1.3); c.fill();
  c.fillStyle = '#e07080'; ellipse(c, x + 2, y - 14.5 + bob, 1, 0.8); c.fill();
  c.fillStyle = '#6a3a1a'; c.fillRect(x - 24, y - 9, 48, 9); c.fillStyle = '#8a5a30'; c.fillRect(x - 24, y - 9, 48, 2);
  jar(c, x - 16, y - 9, 6, 8, '#d04060', true); jar(c, x + 16, y - 9, 6, 9, '#7fd060', true);
  c.fillStyle = '#e8c050'; ellipse(c, x - 7, y - 11, 3, 2); c.fill();
  // A lantern on the post.
  c.fillStyle = '#2a2630'; c.fillRect(x + 22, y - 26, 5, 1);
  c.fillStyle = '#ffd070'; ellipse(c, x + 27, y - 21, 2.4, 3.4); c.fill();
}

function drawPickup(c: C, p: Pickup, time: number) {
  // Everything bobs once it has settled; dropped things bob a little less.
  const bob = p.fixed ? Math.sin(time * 3 + p.x) * 2 : p.t > 0.8 ? Math.sin(time * 4 + p.x) * 1.2 - 1 : 0, x = p.x, y = p.y - 5 + bob;
  if (p.kind === 'relic' || p.kind === 'sub' || p.kind === 'leaf' || p.kind === 'spell') {
    // A halo with slowly turning rays of light behind the treasures that matter.
    const R = p.kind === 'relic' || p.kind === 'spell' ? 26 : 18, tint = p.kind === 'relic' ? '200,230,255' : p.kind === 'leaf' ? '220,255,170' : p.kind === 'spell' ? '240,190,255' : '255,230,160';
    c.save(); c.translate(x, y); c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 8; i++) {
      const a = time * 0.6 + (i * Math.PI) / 4, a2 = -time * 0.4 + (i * Math.PI) / 4 + 0.4;
      for (const [ang, len, al] of [[a, R, 0.22], [a2, R * 0.7, 0.14]] as const) {
        const gr = c.createLinearGradient(0, 0, Math.cos(ang) * len, Math.sin(ang) * len);
        gr.addColorStop(0, `rgba(${tint},${al})`); gr.addColorStop(1, `rgba(${tint},0)`);
        c.fillStyle = gr; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, len, ang - 0.09, ang + 0.09); c.fill();
      }
    }
    c.strokeStyle = `rgba(${tint},${0.35 + Math.sin(time * 3) * 0.15})`; c.lineWidth = 0.8; ellipse(c, 0, 0, R * 0.42, R * 0.42); c.stroke();
    c.restore();
  }
  if (!p.fixed && p.t > 0.8 && Math.floor(time * 3 + p.x * 0.37) % 4 === 0) {
    // A glint now and then on dropped things too.
    const tw = (time * 3 + p.x * 0.37) % 1;
    c.fillStyle = `rgba(255,255,255,${1 - tw})`; c.fillRect(x + 2, y - 5, 0.8, 3); c.fillRect(x + 1.1, y - 4.1, 2.6, 0.8);
  }
  if (p.fixed || p.kind === 'leaf' || p.kind === 'gear' || p.kind === 'relic') {
    const glow = c.createRadialGradient(x, y, 1, x, y, 16);
    glow.addColorStop(0, p.kind === 'relic' ? 'rgba(200,230,255,0.7)' : 'rgba(255,230,140,0.5)'); glow.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = glow; c.fillRect(x - 16, y - 16, 32, 32);
    if (Math.floor(time * 4 + x) % 5 === 0) { c.fillStyle = 'rgba(255,255,255,0.9)'; c.fillRect(x + 4, y - 6, 1, 3); c.fillRect(x + 3, y - 5, 3, 1); }
  }
  switch (p.kind) {
    case 'raisin':
      c.fillStyle = '#4a1c3a'; ellipse(c, x, y + 2, 3.2, 2.6); c.fill();
      c.fillStyle = '#7a3a5e'; ellipse(c, x - 1, y + 1.4, 1.2, 0.8); c.fill();
      break;
    case 'seeds':
      for (const [dx, a] of [[-2, -0.4], [2, 0.3]] as const) {
        c.fillStyle = '#2a2a2a'; ellipse(c, x + dx, y + 1, 1.8, 3.4, a); c.fill();
        c.strokeStyle = '#e8e0d0'; c.lineWidth = 0.5; c.beginPath(); c.moveTo(x + dx, y - 2); c.lineTo(x + dx, y + 4); c.stroke();
      }
      break;
    case 'food': foodIcon(c, p.id, x, y, 1); break;
    case 'gear': gearIcon(c, p.id, x, y, 1); break;
    case 'leaf':
      c.fillStyle = '#8ac048'; ellipse(c, x, y, 3.6, 6, 0.5); c.fill();
      c.fillStyle = '#e8d060'; ellipse(c, x - 0.6, y - 0.6, 1.8, 4, 0.5); c.fill();
      c.strokeStyle = '#4a7020'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(x - 3, y + 5); c.lineTo(x + 2, y - 4); c.stroke();
      break;
    case 'dust': {
      const g = c.createRadialGradient(x, y, 0, x, y, 6);
      g.addColorStop(0, '#ffffff'); g.addColorStop(0.4, '#c8a8ff'); g.addColorStop(1, 'rgba(120,80,220,0)');
      c.fillStyle = g; ellipse(c, x, y, 6, 6); c.fill();
      c.fillStyle = 'rgba(230,220,255,0.9)'; for (let i = 0; i < 3; i++) { const a = time * 5 + i * 2.1; c.fillRect(x + Math.cos(a) * 5, y + Math.sin(a) * 5, 1, 1); }
      break;
    }
    case 'sub': subIcon(c, p.id as SubId, x, y, 1.1); break;
    case 'spell': {
      // A rolled scroll tied with a ribbon, glowing with the spell inside.
      c.save(); c.translate(x, y); c.rotate(-0.35);
      const gr = c.createLinearGradient(0, -3, 0, 3); gr.addColorStop(0, '#fff6e0'); gr.addColorStop(1, '#c8b088');
      c.fillStyle = gr; c.fillRect(-6, -2.6, 12, 5.2);
      c.fillStyle = '#e8d8b8'; ellipse(c, -6, 0, 1.4, 2.6); c.fill(); ellipse(c, 6, 0, 1.4, 2.6); c.fill();
      c.fillStyle = p.id === 'petals' ? '#e05890' : '#6a5ad0'; c.fillRect(-1, -2.8, 2, 5.6);
      c.restore();
      c.fillStyle = `rgba(255,220,255,${0.5 + Math.sin(time * 6) * 0.4})`; star(c, x + 5, y - 5, 1.6);
      break;
    }
    case 'key': {
      // Nutmeg's brass pocket watch, ticking.
      c.strokeStyle = '#c8a050'; c.lineWidth = 0.7; c.beginPath(); c.moveTo(x, y - 5); c.quadraticCurveTo(x + 6, y - 9, x + 7, y - 2); c.stroke();
      c.fillStyle = '#e8c060'; ellipse(c, x, y, 4.6, 4.6); c.fill();
      c.fillStyle = '#fff8e8'; ellipse(c, x, y, 3.4, 3.4); c.fill();
      c.fillStyle = '#c8a050'; c.fillRect(x - 1, y - 6.4, 2, 1.8);
      c.strokeStyle = '#2a1a10'; c.lineWidth = 0.6; const a = Math.floor(time) * (Math.PI / 30);
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.sin(a) * 2.8, y - Math.cos(a) * 2.8); c.moveTo(x, y); c.lineTo(x + 1.6, y); c.stroke();
      break;
    }
    case 'relic': {
      if (p.id === 'climb') {
        // The Wall Cling: three silver claws on a brass cuff, glinting.
        c.fillStyle = '#b08a40'; c.beginPath(); c.roundRect(x - 4.5, y + 1, 9, 4, 1.5); c.fill();
        for (let i = -1; i <= 1; i++) {
          const gr = c.createLinearGradient(x + i * 3 - 1, 0, x + i * 3 + 2, 0); gr.addColorStop(0, '#a8b0c8'); gr.addColorStop(0.5, '#ffffff'); gr.addColorStop(1, '#8890a8');
          c.fillStyle = gr; c.beginPath(); c.moveTo(x + i * 3 - 1.3, y + 1.5); c.quadraticCurveTo(x + i * 3 - 1, y - 5, x + i * 3 + 2.4, y - 7); c.quadraticCurveTo(x + i * 3 + 0.6, y - 3, x + i * 3 + 1.3, y + 1.5); c.fill();
        }
        if (Math.floor(time * 3) % 3 === 0) { c.fillStyle = '#fff'; star(c, x + 4, y - 6, 1.8); }
        break;
      }
      if (p.id === 'mist') {
        // Mist Form: a violet wisp that curls around itself.
        for (let i = 0; i < 7; i++) {
          const a = time * 2.5 + i * 0.9, r = 2 + i * 0.9;
          c.fillStyle = `rgba(${200 - i * 10},${170 - i * 8},255,${0.8 - i * 0.09})`; ellipse(c, x + Math.cos(a) * r, y + Math.sin(a) * r * 0.8, 2.6 - i * 0.2, 2.6 - i * 0.2); c.fill();
        }
        c.fillStyle = '#ffffff'; ellipse(c, x, y, 1.6, 1.6); c.fill();
        break;
      }
      const hop = p.id === 'hop';
      c.fillStyle = hop ? '#f0f8ff' : '#e8f4ff'; ellipse(c, x, y, 5, 5); c.fill();
      for (let i = 0; i < 6; i++) {
        const a = time * 3 + (i * Math.PI) / 3;
        c.fillStyle = hop ? 'rgba(180,220,255,0.9)' : 'rgba(230,220,200,0.8)'; c.fillRect(x + Math.cos(a) * 9, y + Math.sin(a) * (hop ? 9 : 4), 1.5, 1.5);
      }
      c.fillStyle = hop ? '#80c0ff' : '#b0c8e8'; ellipse(c, x - 1.5, y - 1.5, 2, 2); c.fill();
      break;
    }
  }
}
export function foodIcon(c: C, id: string, x: number, y: number, s: number) {
  c.save(); c.translate(x, y); c.scale(s, s);
  if (id === 'cake') {
    c.fillStyle = '#d8b050'; c.fillRect(-5, -2, 10, 6);
    c.fillStyle = '#b08030'; for (let i = 0; i < 4; i++) c.fillRect(-4 + i * 2.5, -2, 0.8, 6);
    c.fillStyle = '#4a1c3a'; ellipse(c, 0, -3, 1.8, 1.4); c.fill();
  } else if (id === 'tea') {
    c.fillStyle = '#6a8a50'; c.beginPath(); c.moveTo(-3, -1); c.lineTo(3, -1); c.lineTo(4.5, 5); c.lineTo(-4.5, 5); c.fill();
    c.fillStyle = '#c8d8a8'; c.fillRect(-1.5, -5, 3, 4); c.fillStyle = '#6a4020'; c.fillRect(-2, -6, 4, 1.5);
    c.fillStyle = 'rgba(255,255,255,0.4)'; c.fillRect(-2.5, 0, 1, 4);
  } else {
    c.fillStyle = '#d0203a'; ellipse(c, 0, 1, 2.6, 3.4); c.fill();
    c.fillStyle = '#ff8090'; ellipse(c, -0.8, 0, 0.8, 1); c.fill();
    c.fillStyle = '#4a8030'; c.fillRect(-0.5, -4, 1, 2);
  }
  c.restore();
}
/** Each fan's silk, ribs and painted motif. */
const FANS: Record<string, { silk: string; edge: string; rib: string; motif: string; trail: string }> = {
  fan: { silk: '#f4bcd4', edge: '#d8789c', rib: '#6a4028', motif: '#ffffff', trail: '#ffd0e4' },
  moonfan: { silk: '#2e3070', edge: '#9aa8e8', rib: '#c8ccd8', motif: '#f0f0c0', trail: '#c0d0ff' },
  wolffan: { silk: '#a01830', edge: '#f0c050', rib: '#3a1a10', motif: '#f0c050', trail: '#ff8090' },
};
/** A folding fan opened `open` radians wide, pointing along +x from its pivot at (0, 0). */
function fanShape(c: C, id: string, r: number, open: number) {
  const k = FANS[id] ?? FANS.fan, a0 = -open / 2, a1 = open / 2, ribs = 7;
  c.fillStyle = k.silk;
  c.beginPath(); c.moveTo(Math.cos(a0) * r * 0.3, Math.sin(a0) * r * 0.3); c.arc(0, 0, r, a0, a1); c.lineTo(Math.cos(a1) * r * 0.3, Math.sin(a1) * r * 0.3); c.arc(0, 0, r * 0.3, a1, a0, true); c.fill();
  // Pleats: every other panel a shade darker.
  c.fillStyle = 'rgba(0,0,0,0.12)';
  for (let i = 0; i < ribs; i += 2) {
    const p0 = a0 + (open * i) / ribs, p1 = a0 + (open * (i + 1)) / ribs;
    c.beginPath(); c.arc(0, 0, r, p0, p1); c.arc(0, 0, r * 0.3, p1, p0, true); c.fill();
  }
  c.fillStyle = k.motif;
  for (let i = 0; i < 3; i++) { const a = a0 + open * (0.25 + i * 0.25); ellipse(c, Math.cos(a) * r * 0.68, Math.sin(a) * r * 0.68, r * 0.08, r * 0.08); c.fill(); }
  c.strokeStyle = k.edge; c.lineWidth = 0.9; c.beginPath(); c.arc(0, 0, r, a0, a1); c.stroke();
  c.strokeStyle = k.rib; c.lineWidth = 0.6;
  for (let i = 0; i <= ribs; i++) { const a = a0 + (open * i) / ribs; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a) * r * 0.98, Math.sin(a) * r * 0.98); c.stroke(); }
  c.fillStyle = k.rib; ellipse(c, 0, 0, 1.4, 1.4); c.fill();
  if (id === 'wolffan') { c.fillStyle = '#f0c050'; ellipse(c, 0, 0, 1, 1); c.fill(); }
}
/** A small picture of a piece of gear, for pickups and the menu. */
export function gearIcon(c: C, id: string, x: number, y: number, s: number) {
  const g = GEAR[id];
  c.save(); c.translate(x, y); c.scale(s, s);
  if (g?.style === 'fan') {
    c.translate(-1, 4); c.rotate(-Math.PI / 2);
    fanShape(c, id, 8, 2.2);
  } else if (g?.style === 'claws') {
    c.strokeStyle = id === 'ironclaws' ? '#a8b0c0' : '#e8e0d0'; c.lineWidth = id === 'ironclaws' ? 1.6 : 1.2;
    for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(-4 + i * 2, 5); c.quadraticCurveTo(i * 2, -2, 4 + i * 2, -5); c.stroke(); }
    if (id === 'ironclaws') { c.fillStyle = '#5a6070'; c.fillRect(-6, 3, 7, 3); }
  } else if (id === 'pin') {
    c.rotate(-0.6);
    c.fillStyle = '#6a4020'; c.fillRect(-8, -0.8, 3, 1.6); c.fillRect(5, -0.8, 3, 1.6);
    const gr = c.createLinearGradient(0, -2.6, 0, 2.6); gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#a8a8b8');
    c.fillStyle = gr; c.fillRect(-5, -2.6, 10, 5.2);
    c.strokeStyle = 'rgba(120,120,140,0.6)'; c.lineWidth = 0.4; c.beginPath(); c.moveTo(-3, -2); c.lineTo(1, 2); c.stroke();
  } else if (g?.style === 'club') {
    c.strokeStyle = '#6a4020'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-5, 5); c.lineTo(2, -2); c.stroke();
    c.fillStyle = '#a06a30'; ellipse(c, 3, -3, 3.6, 3.2); c.fill();
    c.fillStyle = '#5a3a1a'; c.fillRect(0, -6.5, 6, 2);
  } else if (id === 'helm') {
    const gr = c.createLinearGradient(-4, 0, 4, 0); gr.addColorStop(0, '#8a90a0'); gr.addColorStop(0.4, '#f0f4ff'); gr.addColorStop(1, '#6a7080');
    c.fillStyle = gr; c.beginPath(); c.moveTo(-5, 5); c.lineTo(-4, -2); c.quadraticCurveTo(0, -7, 4, -2); c.lineTo(5, 5); c.fill();
    c.fillStyle = 'rgba(60,60,80,0.5)'; for (let i = 0; i < 6; i++) { ellipse(c, -2.5 + (i % 3) * 2.5, -1 + Math.floor(i / 3) * 2.5, 0.5, 0.5); c.fill(); }
  } else if (g?.slot === 'armor') {
    c.fillStyle = id === 'cape' ? '#b8a8c8' : '#c04050';
    c.beginPath(); c.moveTo(-4, -5); c.lineTo(4, -5); c.lineTo(6, 5); c.lineTo(-6, 5); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.3)'; c.fillRect(-4, -5, 8, 1.5);
  } else if (id === 'bell') {
    c.fillStyle = '#d8dce8'; c.beginPath(); c.moveTo(-4, 3); c.quadraticCurveTo(-4, -5, 0, -5); c.quadraticCurveTo(4, -5, 4, 3); c.closePath(); c.fill();
    c.fillStyle = '#8a90a0'; ellipse(c, 0, 4, 1.4, 1.4); c.fill();
  } else if (id === 'shell') {
    c.fillStyle = '#2e5a6a'; ellipse(c, 0, 0, 5, 4); c.fill();
    c.strokeStyle = '#8ad0e0'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(0, -4); c.lineTo(0, 4); c.stroke();
  } else if (id === 'ring') {
    c.strokeStyle = '#d8a840'; c.lineWidth = 1.6; ellipse(c, 0, 1.5, 3.6, 3.6); c.stroke();
    c.fillStyle = '#4a1c3a'; ellipse(c, 0, -2.6, 2.4, 2); c.fill();
  } else if (FOOD[id]) {
    c.restore(); foodIcon(c, id, x, y, s); return;
  } else {
    c.fillStyle = '#e8c860'; ellipse(c, 0, 0, 4, 4); c.fill();
  }
  c.restore();
}

/** A sub-weapon's picture, for pickups, the HUD and the menu. */
export function subIcon(c: C, id: SubId, x: number, y: number, s: number) {
  c.save(); c.translate(x, y); c.scale(s, s);
  const seed = (dx: number, dy: number, a: number) => {
    c.fillStyle = '#2a2a2a'; ellipse(c, dx, dy, 1.8, 3.4, a); c.fill();
    c.strokeStyle = '#e8e0d0'; c.lineWidth = 0.5; c.beginPath(); c.moveTo(dx - Math.sin(a) * 3, dy - Math.cos(a) * 3); c.lineTo(dx + Math.sin(a) * 3, dy + Math.cos(a) * 3); c.stroke();
  };
  if (id === 'seed') seed(0, 0, 0.3);
  else if (id === 'spread') { seed(-3.5, 1, -0.5); seed(0, -1, 0); seed(3.5, 1, 0.5); }
  else if (id === 'cog') {
    gearShape(c, 0, 0, 4.4, 8, 0.2, '#c89a40');
    c.fillStyle = '#f0d890'; ellipse(c, -1, -1.2, 1, 0.7); c.fill();
  } else if (id === 'acorn') {
    c.fillStyle = '#a86a30'; ellipse(c, 0, 1.5, 3.6, 4); c.fill();
    c.fillStyle = '#6a4020'; ellipse(c, 0, -1.6, 4.4, 2.2); c.fill();
    c.fillStyle = '#4a2a10'; c.fillRect(-0.5, -5, 1, 2);
    c.strokeStyle = 'rgba(255,240,200,0.7)'; c.lineWidth = 0.6; c.beginPath(); c.arc(0, 0, 6.5, -2.4, -0.6); c.stroke();
  } else {
    c.fillStyle = '#e07a20'; ellipse(c, 0, 1.5, 4.6, 3.8); c.fill();
    c.strokeStyle = '#a04a10'; c.lineWidth = 0.5; for (const dx of [-1.8, 1.8]) { c.beginPath(); c.ellipse(dx, 1.5, 1.4, 3.6, 0, 0, Math.PI * 2); c.stroke(); }
    c.fillStyle = '#3a6a20'; c.fillRect(-0.6, -4, 1.2, 2.4);
    c.fillStyle = '#ffd060'; ellipse(c, 0, 1.8, 1.2, 1.2); c.fill();
  }
  c.restore();
}

/**
 * The familiars. (x, y) is where their feet are (or, for Zippy in flight, their middle). `act` > 0 while they're
 * doing their thing: gliding, squeaking, bonking.
 */
export function drawPal(c: C, id: PalId, x: number, y: number, face: 1 | -1, time: number, act = 0, gliding = false, size = id === 'zippy' ? 1 : 1.3) {
  c.save(); c.translate(x, y); c.scale(face * size, size);
  if (id === 'zippy') {
    const flap = Math.sin(time * 10) * 0.3;
    if (gliding || act > 0) {
      // Spread out flat, the gliding membrane stretched between its paws.
      c.fillStyle = '#9a98a8'; c.beginPath(); c.moveTo(-8, -2); c.quadraticCurveTo(0, -6 + flap * 2, 8, -2); c.quadraticCurveTo(0, 3, -8, -2); c.fill();
    }
    c.fillStyle = '#6a6878'; c.beginPath(); c.moveTo(-4, 0); c.quadraticCurveTo(-10, 2, -12, -2); c.quadraticCurveTo(-9, -1, -4, -2); c.fill();
    c.fillStyle = '#a8a6b6'; ellipse(c, 0, -1, 4.4, 3); c.fill();
    c.fillStyle = '#f0e8dc'; ellipse(c, 0.5, 0.2, 3, 1.6); c.fill();
    c.fillStyle = '#3a3440'; c.fillRect(-4, -3.6, 8, 0.9);
    c.fillStyle = '#a8a6b6'; ellipse(c, 4, -2.6, 2.6, 2.4); c.fill();
    c.fillStyle = '#e8c8c8'; ellipse(c, 2.8, -5, 1.2, 1.5); c.fill(); ellipse(c, 5, -5, 1.2, 1.5); c.fill();
    c.fillStyle = '#140a14'; ellipse(c, 5.2, -2.8, 1.1, 1.2); c.fill();
    c.fillStyle = '#fff'; c.fillRect(5.3, -3.4, 0.5, 0.5);
    c.fillStyle = '#e07080'; ellipse(c, 6.6, -2.2, 0.5, 0.5); c.fill();
  } else if (id === 'pudding') {
    const hop = act > 0 ? Math.abs(Math.sin(time * 20)) * 2 : 0;
    c.translate(0, -hop);
    // A round loaf of a guinea pig, cream with ginger and chocolate patches.
    c.fillStyle = '#f4ead8'; ellipse(c, 0, -4.5, 7, 4.8); c.fill();
    c.fillStyle = '#d88a40'; ellipse(c, -3.5, -5.5, 3.6, 3.4); c.fill();
    c.fillStyle = '#6a4028'; ellipse(c, 2.5, -7, 2.6, 1.8); c.fill();
    c.fillStyle = '#d88a40'; ellipse(c, 5, -5.5, 3, 3); c.fill();
    c.fillStyle = '#e8a0a0'; ellipse(c, 3.6, -8.4, 1.3, 1); c.fill();
    c.fillStyle = '#140a14'; ellipse(c, 6, -6, 0.9, 1); c.fill();
    c.fillStyle = '#e07080'; ellipse(c, 7.8, -4.8, 0.5, 0.5); c.fill();
    c.fillStyle = '#e8c0a0'; c.fillRect(-4, -0.6, 1.6, 0.8); c.fillRect(3, -0.6, 1.6, 0.8);
    if (act > 0) { c.scale(face, 1); c.fillStyle = '#8cf0a0'; c.font = `700 5px ${DISPLAY}`; c.fillText('wheek!', -8, -13); }
  } else if (id === 'nutmeg') {
    // Nutmeg the chipmunk: russet with black-and-cream stripes, a tail held high, and cheeks that puff when she finds something.
    const hop = act > 0 ? Math.abs(Math.sin(time * 18)) * 1.6 : Math.abs(Math.sin(time * 5)) * 0.4;
    c.translate(0, -hop);
    c.fillStyle = '#b8642a'; c.beginPath(); c.moveTo(-4, -4); c.quadraticCurveTo(-11, -8, -9, -15); c.quadraticCurveTo(-6, -17, -5, -12); c.quadraticCurveTo(-5, -8, -2, -5); c.fill();
    c.fillStyle = '#e0a060'; c.beginPath(); c.moveTo(-8.5, -13); c.quadraticCurveTo(-7, -16, -5.6, -12.5); c.quadraticCurveTo(-7, -12, -8.5, -13); c.fill();
    c.fillStyle = '#c4722e'; ellipse(c, 0, -4.5, 5.4, 4); c.fill();
    c.fillStyle = '#f4e4c8'; ellipse(c, 1.6, -3.4, 3, 2.4); c.fill();
    c.fillStyle = '#2a1a10'; c.fillRect(-4, -8.2, 6, 0.9); c.fillRect(-4.4, -6.6, 6, 0.8);
    c.fillStyle = '#f4e4c8'; c.fillRect(-4, -7.3, 6, 0.6);
    const cheek = act > 0 ? 2.8 : 2;
    c.fillStyle = '#c4722e'; ellipse(c, 4.6, -7, 3.2, 3); c.fill();
    c.fillStyle = '#f4e4c8'; ellipse(c, 5.6, -6, cheek, cheek * 0.8); c.fill();
    c.fillStyle = '#c4722e'; ellipse(c, 3, -10, 1.2, 1.4); c.fill();
    c.fillStyle = '#2a1a10'; c.fillRect(3.2, -9, 4, 0.5);
    c.fillStyle = '#140a14'; ellipse(c, 5.4, -7.8, 0.9, 1); c.fill();
    c.fillStyle = '#fff'; c.fillRect(5.6, -8.3, 0.4, 0.4);
    c.fillStyle = '#e07080'; ellipse(c, 7.6, -6.6, 0.5, 0.5); c.fill();
    c.fillStyle = '#8a4a1a'; c.fillRect(-2.4, -0.8, 1.6, 0.8); c.fillRect(2, -0.8, 1.6, 0.8);
    if (act > 0) { c.fillStyle = '#4a1c3a'; ellipse(c, 8, -3, 1.4, 1.2); c.fill(); }
  } else {
    // Mochi the capybara: a calm brown barrel with a square snout, and once she's happy, a yuzu on her head.
    const bob = Math.sin(time * 2) * 0.3;
    c.fillStyle = '#8a5e3c'; c.beginPath(); c.roundRect(-9, -11 + bob, 16, 10, 4); c.fill();
    c.fillStyle = '#6e4a2e'; c.fillRect(-7, -2, 2.4, 2); c.fillRect(2, -2, 2.4, 2);
    c.fillStyle = '#946844'; c.beginPath(); c.roundRect(3, -13 + bob, 9, 8, 2.6); c.fill();
    c.fillStyle = '#5a3a24'; ellipse(c, 11, -9 + bob, 1.4, 1.8); c.fill();
    c.fillStyle = '#6e4a2e'; ellipse(c, 4.4, -13 + bob, 1.4, 1.2); c.fill();
    c.fillStyle = '#140a14'; c.fillRect(7.6, -11 + bob, 1.3, 0.8);
    c.fillStyle = '#f0c030'; ellipse(c, 6, -15.4 + bob, 2.6, 2.3); c.fill();
    c.fillStyle = '#5a9a30'; ellipse(c, 7.4, -17.4 + bob, 1.4, 0.7, -0.4); c.fill();
    if (act > 0) { c.strokeStyle = 'rgba(255,240,200,0.8)'; c.lineWidth = 1; c.beginPath(); c.arc(14, -8, 6 + (0.4 - act) * 20, -1, 1); c.stroke(); }
  }
  c.restore();
}
function drawCage(c: C, x: number, y: number, hp: number, flash: number, time: number) {
  drawPal(c, 'zippy', x, y - 6, 1, time);
  c.strokeStyle = flash > 0 ? '#ffffff' : '#8a8090'; c.lineWidth = 1;
  for (let i = -3; i <= 3; i++) { c.beginPath(); c.moveTo(x + i * 2.6, y - 1); c.lineTo(x + i * 2.6 * 0.8, y - 17); c.stroke(); }
  c.fillStyle = '#5a5060'; c.fillRect(x - 9, y - 2, 18, 2); c.beginPath(); c.ellipse(x, y - 17, 7, 3, 0, Math.PI, 0); c.fill();
  c.strokeStyle = '#5a5060'; c.beginPath(); c.arc(x, y - 20, 2, Math.PI, 0); c.stroke();
  c.fillStyle = '#d8b050'; c.fillRect(x - 1.5, y - 9, 3, 3.4);
  for (let i = 0; i < 3 - hp; i++) { c.strokeStyle = 'rgba(20,10,20,0.8)'; c.beginPath(); c.moveTo(x - 6 + i * 4, y - 14); c.lineTo(x - 4 + i * 4, y - 6); c.stroke(); }
}

// ─── Creatures ────────────────────────────────────────────────────────────

/**
 * A defeated foe burns away like in Symphony of the Night: it flares white-hot, cools to orange, and crumbles from
 * the feet up in a pattern of cinders.
 */
let burnCv: HTMLCanvasElement | null = null;
function burnAway(c: C, g: FluffstevaniaGame, e: Enemy, time: number) {
  const k = Math.min(1, e.dead / BURN_T), S = 3, W = 64, H = 64, f = FOES[e.kind];
  burnCv ??= canvas(W * S, H * S);
  const b = burnCv.getContext('2d')!;
  b.setTransform(1, 0, 0, 1, 0, 0); b.globalCompositeOperation = 'source-over'; b.clearRect(0, 0, W * S, H * S);
  b.setTransform(S, 0, 0, S, (W / 2 - e.x) * S, (H * 0.75 - e.y) * S);
  drawEnemy(b, g, { ...e, dead: 0, flash: 0 }, time);
  b.setTransform(1, 0, 0, 1, 0, 0);
  b.globalCompositeOperation = 'source-atop';
  b.fillStyle = k < 0.25 ? `rgba(255,250,235,${0.9 - k})` : `rgba(255,${Math.round(170 - k * 90)},${Math.round(70 - k * 50)},${0.55 + k * 0.4})`;
  b.fillRect(0, 0, W * S, H * S);
  b.globalCompositeOperation = 'destination-out'; b.fillStyle = '#000';
  const top = H * 0.75 - f.h - 4, cell = 2;
  for (let y = 0; y < H; y += cell) {
    const up = Math.max(0, Math.min(1, (H * 0.75 - y) / (f.h + 6)));
    for (let x = 0; x < W; x += cell) if (y >= top - 12 && hash(x + e.id * 7, y) * 0.5 + up * 0.7 < k * 1.25) b.fillRect(x * S, y * S, cell * S, cell * S);
  }
  b.globalCompositeOperation = 'source-over';
  c.drawImage(burnCv, e.x - W / 2, e.y - H * 0.75, W, H);
}

function drawEnemy(c: C, g: FluffstevaniaGame | null, e: Enemy, time: number) {
  const f = FOES[e.kind], white = e.flash > 0, col = (s: string) => (white ? '#ffffff' : s);
  if (e.dead) c.globalAlpha = Math.max(0, 1 - e.dead * 3);
  if (e.kind === 'spider' && g) {
    // The thread runs up to the ceiling above where it hangs.
    let top = Math.floor(e.hy / TILE) - 1;
    while (top > e.hy / TILE - 14 && !isSolid(g.tile(Math.floor(e.x / TILE), top))) top--;
    c.strokeStyle = 'rgba(230,230,240,0.55)'; c.lineWidth = 0.5; c.beginPath(); c.moveTo(e.x, (top + 1) * TILE); c.lineTo(e.x, e.y - f.h); c.stroke();
  }
  c.save(); c.translate(e.x, e.y);
  switch (e.kind) {
    case 'bat': {
      const hang = e.state === 'idle', flap = Math.sin(time * 18 + e.id) * (hang ? 0.1 : 1);
      if (hang) { c.scale(1, -1); c.translate(0, f.h + 2); }
      for (const s of [-1, 1]) {
        c.fillStyle = col('#2e2040');
        c.beginPath(); c.moveTo(0, -6); c.quadraticCurveTo(s * 8, -13 - flap * 5, s * 13, -5 + flap * 3); c.lineTo(s * 10, -3.5); c.lineTo(s * 8, -4.5); c.lineTo(s * 6, -2); c.lineTo(s * 4, -3); c.closePath(); c.fill();
        c.strokeStyle = col('#5a4478'); c.lineWidth = 0.5; c.beginPath(); c.moveTo(s * 2, -6); c.lineTo(s * 10, -8 - flap * 3); c.stroke();
      }
      c.fillStyle = col('#4e3a60'); ellipse(c, 0, -5, 4, 4.5); c.fill();
      c.beginPath(); c.moveTo(-3, -8); c.lineTo(-2, -11.5); c.lineTo(-1, -8); c.moveTo(3, -8); c.lineTo(2, -11.5); c.lineTo(1, -8); c.fill();
      c.fillStyle = '#ff3040'; c.fillRect(-2, -6.5, 1.2, 1.2); c.fillRect(0.8, -6.5, 1.2, 1.2);
      c.fillStyle = '#fff'; c.fillRect(-1, -3, 0.6, 1); c.fillRect(0.4, -3, 0.6, 1);
      break;
    }
    case 'moth': {
      const w = Math.sin(time * 10 + e.id) * 0.3;
      for (const s of [-1, 1]) {
        c.fillStyle = col('#c8b8a0'); ellipse(c, s * 6, -9, 6, 4.4, s * (0.5 + w)); c.fill();
        c.fillStyle = col('#a8987e'); ellipse(c, s * 5, -4, 4, 3, s * (-0.4 - w)); c.fill();
        c.fillStyle = white ? '#fff' : '#4a3a5a'; ellipse(c, s * 7, -9.5, 1.6, 1.6); c.fill();
        c.fillStyle = white ? '#fff' : '#e8c060'; ellipse(c, s * 7, -9.5, 0.7, 0.7); c.fill();
      }
      c.fillStyle = col('#e8dcc8'); ellipse(c, 0, -7, 2.4, 5); c.fill();
      c.strokeStyle = col('#8a7a60'); c.lineWidth = 0.6;
      c.beginPath(); c.moveTo(-1, -12); c.quadraticCurveTo(-3, -16, -5, -15); c.moveTo(1, -12); c.quadraticCurveTo(3, -16, 5, -15); c.stroke();
      c.fillStyle = 'rgba(230,220,200,0.6)';
      for (let i = 0; i < 3; i++) c.fillRect(Math.sin(time * 3 + i * 2) * 8, 2 + ((time * 10 + i * 5) % 10), 1, 1);
      break;
    }
    case 'beetle': {
      c.scale(e.face, 1);
      const step = Math.sin(time * 16 + e.id) * 1.4;
      c.strokeStyle = col('#1a2228'); c.lineWidth = 1;
      for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(i * 5, -3); c.lineTo(i * 5 + step * (i % 2 ? 1 : -1), 0); c.stroke(); }
      c.fillStyle = col('#1e3a48'); c.beginPath(); c.ellipse(0, -4, 9, 8, 0, Math.PI, 0); c.fill();
      c.fillStyle = col('#3a7088'); c.beginPath(); c.ellipse(-1, -6, 5, 4, -0.3, Math.PI, 0); c.fill();
      c.fillStyle = 'rgba(200,240,255,0.5)'; ellipse(c, -3, -9, 2, 1, -0.4); c.fill();
      c.strokeStyle = col('#0e1e28'); c.beginPath(); c.moveTo(0, -12); c.lineTo(0, -4); c.stroke();
      c.fillStyle = col('#16262e'); ellipse(c, 9, -4, 3.4, 3); c.fill();
      c.beginPath(); c.moveTo(10, -6); c.quadraticCurveTo(15, -12, 12, -13); c.lineTo(11, -7); c.fill();
      c.fillStyle = '#e8c860'; c.fillRect(10, -5, 1, 1);
      break;
    }
    case 'bone': {
      c.scale(e.face, 1);
      const walk = e.state === 'throw' ? 0 : Math.sin(time * 10 + e.id) * 1.5;
      c.strokeStyle = col('#e8e2d0'); c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(-5, -6); for (let i = 0; i < 5; i++) c.lineTo(-7 - i * 2.4, -6 + Math.sin(time * 6 + i) * 1.5 - i * 0.6); c.stroke();
      c.beginPath(); c.moveTo(-3, -3); c.lineTo(-3 + walk, 0); c.moveTo(3, -3); c.lineTo(3 - walk, 0); c.stroke();
      c.fillStyle = col('#d8d0bc'); ellipse(c, 0, -7, 5.4, 4); c.fill();
      c.strokeStyle = col('#8a8270'); c.lineWidth = 0.6;
      for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(i * 1.8, -10); c.lineTo(i * 1.8, -4); c.stroke(); }
      c.fillStyle = col('#f0eadc'); ellipse(c, 5, -11, 4.2, 3.6); c.fill();
      ellipse(c, 3, -15, 2, 2.6); c.fill();
      c.fillStyle = '#2a1a20'; ellipse(c, 6, -11.5, 1.2, 1.4); c.fill();
      c.fillStyle = '#ff5050'; c.fillRect(5.8, -12, 0.8, 0.8);
      if (e.state === 'throw' && e.stateT < 0.2) { c.strokeStyle = '#f0eadc'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(2, -14); c.lineTo(6, -20); c.stroke(); }
      break;
    }
    case 'armadillo': {
      c.scale(e.face, 1);
      const crouch = e.state === 'wind' ? 2 : 0, tired = e.state === 'rest';
      c.fillStyle = col('#6a5040'); c.fillRect(-8, -3, 3, 3); c.fillRect(4, -3, 3, 3);
      c.fillStyle = col('#a88a68'); c.beginPath(); c.ellipse(-1, -6 + crouch, 11, 10, 0, Math.PI, 0); c.fill();
      c.strokeStyle = col('#7a6048'); c.lineWidth = 1;
      for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(-1 + i * 3.6, -15 + crouch + Math.abs(i)); c.lineTo(-1 + i * 4.4, -6 + crouch); c.stroke(); }
      c.fillStyle = col('#c0a07a'); ellipse(c, 11, -7 + crouch, 4, 3); c.fill();
      ellipse(c, 9, -10 + crouch, 1.5, 2.5); c.fill();
      c.fillStyle = '#1a1010'; c.fillRect(12, -8 + crouch, 1, 1);
      c.fillStyle = col('#a88a68'); c.beginPath(); c.moveTo(-11, -4); c.lineTo(-16, -2); c.lineTo(-11, -2); c.fill();
      if (!tired) {
        c.fillStyle = col('#5a3a24'); ellipse(c, 14, -9 + crouch, 3.4, 8); c.fill();
        c.fillStyle = col('#8a6a40'); ellipse(c, 14.5, -9 + crouch, 2, 6); c.fill();
        c.fillStyle = col('#d8b050'); ellipse(c, 15, -9 + crouch, 1, 1.4); c.fill();
      } else {
        c.fillStyle = 'rgba(255,255,255,0.8)'; c.font = `bold 6px ${DISPLAY}`; c.fillText('z', 6, -18 - Math.sin(time * 4) * 2);
      }
      break;
    }
    case 'rat': {
      c.scale(e.face, 1);
      const charging = e.state === 'lunge', bristle = e.state === 'wind';
      const run = Math.sin(time * (charging ? 40 : 14) + e.id) * (e.state === 'rest' ? 0 : 1.6);
      c.strokeStyle = col('#d8a0a0'); c.lineWidth = 1;
      c.beginPath(); c.moveTo(-8, -4); c.quadraticCurveTo(-16, -8 + Math.sin(time * 5) * 2, -20, -3); c.stroke();
      c.fillStyle = col('#5a4a44'); c.fillRect(-5 + run, -2, 2, 2); c.fillRect(3 - run, -2, 2, 2);
      c.fillStyle = col(charging ? '#7a6a64' : '#6e5e58'); ellipse(c, -1, -5.5, charging ? 10 : 9, 5); c.fill();
      c.fillStyle = col('#9a8a80'); ellipse(c, -1, -4, 6, 2.6); c.fill();
      if (bristle) { c.strokeStyle = col('#4a3a34'); c.lineWidth = 0.8; for (let i = -3; i <= 3; i++) { c.beginPath(); c.moveTo(i * 2, -10); c.lineTo(i * 2.3 - 0.5, -13 - Math.abs(Math.sin(time * 30 + i)) * 1.5); c.stroke(); } }
      c.fillStyle = col('#7a6a64'); ellipse(c, 8, -6, 4.6, 3.4); c.fill();
      c.beginPath(); c.moveTo(11, -7); c.lineTo(15, -5); c.lineTo(11, -4); c.fill();
      c.fillStyle = col('#e8a0b0'); ellipse(c, 15, -5, 1, 1); c.fill(); ellipse(c, 6, -9.5, 2.2, 2.4); c.fill();
      c.fillStyle = '#ff2030'; ellipse(c, 10, -7, 1, 1); c.fill();
      c.fillStyle = '#fff'; c.fillRect(12.5, -4, 0.8, 1.4);
      c.strokeStyle = 'rgba(240,240,240,0.7)'; c.lineWidth = 0.3; c.beginPath(); c.moveTo(13, -5.5); c.lineTo(18, -7); c.moveTo(13, -5); c.lineTo(18, -4); c.stroke();
      if (charging) { c.fillStyle = 'rgba(230,220,200,0.5)'; for (let i = 1; i <= 3; i++) { ellipse(c, -10 - i * 6, -3, 3, 2); c.fill(); } }
      break;
    }
    case 'ghost': {
      const faded = ghostFaded(e), cyc = e.t % 3.8;
      // Fade out and back in, rather than blinking.
      const a = faded ? 0.12 : Math.min(1, cyc * 3, (2.4 - cyc) * 3 + 0.3);
      c.globalAlpha *= Math.max(0.12, a);
      const glow = c.createRadialGradient(0, -10, 1, 0, -10, 18);
      glow.addColorStop(0, 'rgba(160,255,200,0.45)'); glow.addColorStop(1, 'rgba(160,255,200,0)');
      c.fillStyle = glow; c.fillRect(-18, -28, 36, 36);
      // A cracked jar with the ghost rising out of it.
      c.fillStyle = white ? '#fff' : 'rgba(170,210,190,0.55)'; c.fillRect(-5, -6, 10, 7);
      c.fillStyle = '#5a4630'; c.fillRect(-6, -7, 12, 1.6);
      const sway = Math.sin(time * 4 + e.id) * 2;
      c.fillStyle = white ? '#fff' : 'rgba(210,255,235,0.85)';
      c.beginPath(); c.moveTo(-4, -7); c.quadraticCurveTo(-8 + sway, -16, -4 + sway, -22); c.quadraticCurveTo(sway, -26, 4 + sway, -22); c.quadraticCurveTo(8 + sway, -16, 4, -7); c.fill();
      c.fillStyle = '#1a3028'; ellipse(c, -1.8 + sway + e.face, -18, 1.2, 1.8); c.fill(); ellipse(c, 2 + sway + e.face, -18, 1.2, 1.8); c.fill();
      ellipse(c, sway + e.face * 0.5, -14, 1.3, 1.6); c.fill();
      break;
    }
    case 'spider': {
      const legs = Math.sin(time * (e.state === 'rest' ? 16 : 6) + e.id) * 1.2;
      c.strokeStyle = col('#2a1e2a'); c.lineWidth = 0.9;
      for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {
        const ly = -9 + i * 1.6, k = (i % 2 ? 1 : -1) * legs;
        c.beginPath(); c.moveTo(0, ly); c.lineTo(s * (5 + i), ly - 3 + k); c.lineTo(s * (8 + i * 1.2), ly + 3 + k); c.stroke();
      }
      c.fillStyle = col('#3a2a3e'); ellipse(c, 0, -7, 5, 5.4); c.fill();
      c.fillStyle = col('#6a3a5a'); ellipse(c, 0, -8.5, 2.4, 2); c.fill();
      c.fillStyle = col('#2a1e2a'); ellipse(c, 0, -2.6, 3, 2.4); c.fill();
      c.fillStyle = '#ff3050'; for (const dx of [-1.6, -0.5, 0.5, 1.6]) c.fillRect(dx - 0.4, -2.8 - Math.abs(dx) * 0.3, 0.8, 0.8);
      break;
    }
    case 'book': {
      // A tome with teeth: shut and still until it wakes, then flapping its covers like wings.
      c.scale(e.face, 1); c.translate(0, -6);
      const shut = e.state === 'idle', bite = e.state === 'wind' || e.state === 'lunge';
      const open = shut ? 0.08 : bite ? 0.25 + Math.abs(Math.sin(time * 30)) * 0.2 : 0.5 + Math.sin(time * 14 + e.id) * 0.45;
      if (e.state === 'lunge') c.rotate(Math.atan2(e.vy, Math.abs(e.vx) || 1) * 0.6);
      for (const sgn of [-1, 1]) {
        c.save(); c.rotate(sgn * open);
        c.fillStyle = col('#f0e6d0'); c.fillRect(-1, sgn > 0 ? 0 : -5, 9, 5);
        c.fillStyle = col('#7a2230'); c.fillRect(-1, sgn > 0 ? 4.5 : -6.5, 10, 2);
        c.fillStyle = '#d8b060'; c.fillRect(7.5, sgn > 0 ? 4.5 : -6.5, 1.5, 2);
        c.restore();
      }
      c.fillStyle = col('#5a1420'); c.fillRect(-2.5, -3, 2.5, 6);
      if (!shut) {
        c.fillStyle = '#ffffff'; for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(3 + i * 2, -0.6); c.lineTo(4 + i * 2, 1.2); c.lineTo(5 + i * 2, -0.6); c.fill(); }
        c.fillStyle = '#ff3040'; c.fillRect(-2, -1.5, 1.2, 1.2);
        c.strokeStyle = col('#c02030'); c.lineWidth = 0.8; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(-4, 4 + Math.sin(time * 8) * 2, -7, 3); c.stroke();
      }
      break;
    }
    case 'quill': {
      // A white quill hovering nib-down, with a baleful eye and a drop of ink at the tip.
      c.scale(e.face, 1);
      const throwing = e.state === 'throw';
      c.rotate(throwing ? 0.9 * Math.min(1, e.stateT * 6) - (e.stateT > 0.25 ? 0.8 : 0) : 0.35 + Math.sin(time * 3 + e.id) * 0.1);
      c.fillStyle = col('#f4f0e8'); ellipse(c, 0, -11, 3.4, 8, 0); c.fill();
      c.strokeStyle = col('#c8c0b0'); c.lineWidth = 0.4;
      for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(0, -17 + i * 2.2); c.lineTo(-3, -15 + i * 2.2); c.moveTo(0, -17 + i * 2.2); c.lineTo(3, -15 + i * 2.2); c.stroke(); }
      c.strokeStyle = col('#8a8070'); c.lineWidth = 0.7; c.beginPath(); c.moveTo(0, -19); c.lineTo(0, -2); c.stroke();
      c.fillStyle = col('#1a1a30'); c.beginPath(); c.moveTo(-1.2, -3); c.lineTo(1.2, -3); c.lineTo(0, 1); c.fill();
      c.fillStyle = '#2a2850'; ellipse(c, 0, 1.6 + Math.abs(Math.sin(time * 2)) * 1, 0.9, 1.2); c.fill();
      c.fillStyle = '#ff3040'; ellipse(c, 0.8, -12, 1.1, 0.8); c.fill();
      break;
    }
    case 'ink': {
      // A spill of ink that gathers itself up and springs; glossy, with two white eyes.
      c.scale(e.face, 1);
      const gather = e.state === 'wind' ? 1 - Math.min(1, e.stateT / 0.35) * 0.35 : 1, air = e.state === 'lunge' && !e.ground;
      const sx = air ? 0.8 : 1 / gather, sy = air ? 1.25 : gather;
      c.scale(sx, sy);
      c.fillStyle = col('#16142a');
      c.beginPath();
      for (let i = 0; i <= 16; i++) {
        const a = Math.PI + (i / 16) * Math.PI, wob = Math.sin(time * 6 + i * 1.7 + e.id) * 0.8;
        c.lineTo(Math.cos(a) * (9 + wob), -Math.sin(-a) * (11 + wob) * 0.9);
      }
      c.closePath(); c.fill();
      c.fillRect(-10, -1.5, 20, 1.5);
      for (const dx of [-7, 2, 8]) { c.beginPath(); ellipse(c, dx, 0, 2.2, 1); c.fill(); }
      c.fillStyle = 'rgba(160,160,230,0.45)'; ellipse(c, -3, -7, 2.4, 1.2, -0.4); c.fill();
      c.fillStyle = '#ffffff'; ellipse(c, 2, -5.5, 1.8, 2); c.fill(); ellipse(c, 6, -5.2, 1.5, 1.8); c.fill();
      c.fillStyle = '#0a0a14'; ellipse(c, 2.6, -5.2, 0.8, 1); c.fill(); ellipse(c, 6.4, -5, 0.7, 0.9); c.fill();
      break;
    }
    case 'mouse': {
      // A tin mouse on little wheels, with a coiled-spring tail and a key in its back that spins as it winds up.
      c.scale(e.face, 1);
      const zoom = e.state === 'lunge', spin = e.state === 'wind' ? time * 40 : zoom ? time * 12 : time * 3;
      if (zoom) { c.strokeStyle = 'rgba(230,220,200,0.5)'; c.lineWidth = 0.8; for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(-10 - i * 3, -3 - i * 2.4); c.lineTo(-16 - i * 5, -3 - i * 2.4); c.stroke(); } }
      c.strokeStyle = col('#8a8e9a'); c.lineWidth = 0.7; c.beginPath();
      for (let i = 0; i <= 12; i++) { const t = i / 12; c.lineTo(-7 - t * 8, -3 + Math.sin(t * 14 + time * 8) * 1.4 - t * 2); }
      c.stroke();
      const body = c.createLinearGradient(0, -11, 0, -1); body.addColorStop(0, white ? '#fff' : '#c8ccd8'); body.addColorStop(1, white ? '#fff' : '#6a6e7a');
      c.fillStyle = body; c.beginPath(); c.moveTo(-7, -2); c.quadraticCurveTo(-7, -11, 1, -10); c.quadraticCurveTo(7, -8, 9, -3); c.lineTo(9, -2); c.closePath(); c.fill();
      c.strokeStyle = col('#c8a050'); c.lineWidth = 0.6; c.beginPath(); c.moveTo(-2, -10); c.lineTo(-3, -2); c.moveTo(3, -9.6); c.lineTo(3, -2); c.stroke();
      c.fillStyle = col('#9aa0ae'); ellipse(c, 3, -10.5, 2.8, 2.8); c.fill();
      c.fillStyle = col('#e8a0b0'); ellipse(c, 3, -10.5, 1.5, 1.5); c.fill();
      c.fillStyle = '#ff4050'; ellipse(c, 6, -6.6, 0.8, 0.8); c.fill();
      c.fillStyle = col('#2a2a30'); ellipse(c, 9.2, -3, 0.9, 0.9); c.fill();
      // Wheels and the turning key.
      for (const wx of [-4, 5]) { c.fillStyle = '#3a3a44'; ellipse(c, wx, -1.2, 1.8, 1.8); c.fill(); c.strokeStyle = '#c8a050'; c.lineWidth = 0.5; c.beginPath(); c.moveTo(wx, -1.2); c.lineTo(wx + Math.cos(spin) * 1.6, -1.2 + Math.sin(spin) * 1.6); c.stroke(); }
      c.fillStyle = col('#c8a050'); c.fillRect(-2.6, -14, 1.2, 4);
      const k = Math.cos(spin);
      ellipse(c, -2, -15.4, 3 * Math.abs(k) + 0.4, 1.6); c.fill();
      break;
    }
    case 'cuckoo': {
      // A carved cuckoo clock on the wall. The little doors fly open and the bird springs out to sing at you.
      const out = e.state === 'awake' ? Math.min(1, e.stateT / 0.15, Math.max(0, (1.3 - e.stateT) / 0.15)) : 0;
      c.fillStyle = '#4a2c16'; c.beginPath(); c.moveTo(-10, -18); c.lineTo(0, -26); c.lineTo(10, -18); c.closePath(); c.fill();
      c.fillStyle = '#6a4222'; c.fillRect(-8, -18, 16, 20);
      c.fillStyle = '#3a2210'; c.fillRect(-8, -18, 16, 1.5); c.fillRect(-8, 0.5, 16, 1.5);
      c.fillStyle = '#e8dcc0'; ellipse(c, 0, -4, 4.4, 4.4); c.fill();
      c.strokeStyle = '#2a1a10'; c.lineWidth = 0.5; c.beginPath(); c.moveTo(0, -4); c.lineTo(0, -7); c.moveTo(0, -4); c.lineTo(2, -4); c.stroke();
      // Pendulum and pine-cone weights hanging below.
      const sw = Math.sin(time * 4 + e.id) * 0.25;
      c.save(); c.translate(0, 2); c.rotate(sw); c.fillStyle = '#c8a050'; c.fillRect(-0.4, 0, 0.8, 9); ellipse(c, 0, 9.5, 2, 2); c.fill(); c.restore();
      c.fillStyle = '#5a3a1c'; for (const dx of [-5, 5]) { c.fillRect(dx - 0.2, 2, 0.4, 5 + (dx > 0 ? 2 : 0)); ellipse(c, dx, 8 + (dx > 0 ? 2 : 0), 1.2, 2); c.fill(); }
      c.fillStyle = '#1a0e06'; c.fillRect(-3.5, -15, 7, 6);
      if (out > 0) {
        c.save(); c.translate(0, -12); c.scale(e.face, 1);
        c.strokeStyle = '#a8a8b0'; c.lineWidth = 0.6; c.beginPath();
        for (let i = 0; i <= 6; i++) c.lineTo(i * out * 1.4, Math.sin(i * 2.2) * 1.2);
        c.stroke();
        c.translate(out * 9, 0);
        const sing = e.stateT > 0.3 && e.stateT < 0.6;
        c.fillStyle = col('#8a5a30'); ellipse(c, 0, 0, 4, 3.4); c.fill();
        c.fillStyle = col('#e8d8b0'); ellipse(c, 1, 1, 2.4, 1.8); c.fill();
        c.fillStyle = col('#6a4020'); c.beginPath(); c.moveTo(-3, -1); c.lineTo(-7, -2.5); c.lineTo(-4, 1); c.fill();
        c.fillStyle = '#e8a030'; c.beginPath(); c.moveTo(3.4, -1); c.lineTo(6.4, sing ? -2 : -0.6); c.lineTo(3.4, 0); c.moveTo(3.4, 0.3); c.lineTo(6, sing ? 1.8 : 0.4); c.lineTo(3.4, 0.8); c.fill();
        c.fillStyle = '#140a04'; ellipse(c, 1.8, -1.4, 0.7, 0.7); c.fill();
        c.restore();
      } else {
        c.fillStyle = '#7a4e28'; c.fillRect(-3.5, -15, 3.4, 6); c.fillRect(0.1, -15, 3.4, 6);
        c.fillStyle = '#c8a050'; c.fillRect(-0.8, -12.4, 0.6, 0.8); c.fillRect(0.4, -12.4, 0.6, 0.8);
      }
      break;
    }
    case 'toad': {
      // A warty green toad riding a brass spring that coils as it sits and stretches as it leaps.
      c.scale(e.face, 1);
      const air = !e.ground, rest = e.state === 'rest';
      const coil = air ? 1.7 : rest ? 0.6 : 1 + Math.sin(time * 3 + e.id) * 0.05, sh = 4 * coil;
      c.strokeStyle = '#c8a050'; c.lineWidth = 0.9; c.beginPath();
      for (let i = 0; i <= 8; i++) c.lineTo((i % 2 ? 3 : -3), -i * (sh / 8));
      c.stroke();
      c.translate(0, -sh);
      c.fillStyle = col('#4e7a34'); ellipse(c, 0, -5, 9, 5.6); c.fill();
      c.fillStyle = col('#d8c878'); ellipse(c, 2, -3, 6, 2.6); c.fill();
      c.fillStyle = col('#6a9a48'); for (const [dx, dy] of [[-5, -7], [-1, -9], [-6, -4], [3, -8]]) { ellipse(c, dx, dy, 1.2, 1); c.fill(); }
      c.fillStyle = col('#4e7a34'); for (const s2 of [-1, 1]) { ellipse(c, 4 + s2 * 2.6, -9.6, 2.4, 2.4); c.fill(); }
      c.fillStyle = '#f0d040'; for (const s2 of [-1, 1]) { ellipse(c, 4 + s2 * 2.6, -10, 1.6, 1.6); c.fill(); }
      c.fillStyle = '#140a04'; for (const s2 of [-1, 1]) c.fillRect(4 + s2 * 2.6 - 1, -10.2, 2, 0.7);
      c.strokeStyle = col('#2a4418'); c.lineWidth = 0.6; c.beginPath(); c.moveTo(4, -4.4); c.quadraticCurveTo(7, -3.4, 9, -5); c.stroke();
      if (air) { c.fillStyle = col('#4e7a34'); c.fillRect(-9, -2, 5, 1.6); c.fillRect(-7, -1, 3, 3); }
      break;
    }
  }
  c.restore();
  c.globalAlpha = 1;
}

/** One foe (or boss) posed for the Bestiary, centred in a w × h box. */
export function drawFoeIcon(c: C, kind: string, w: number, h: number, time: number) {
  c.clearRect(0, 0, w, h);
  c.save();
  const bossKind = (Object.keys(BOSS_KILLS) as BossId[]).find((b) => BOSS_KILLS[b] === kind);
  if (bossKind) {
    const k = bossKind, s = Math.min(w, h) / 70;
    c.translate(w / 2, h / 2); c.scale(s, s);
    const boss = { kind: k, x: 0, y: 0, vx: 0, vy: 0, hp: 1, max: 1, move: { owl: 'hover', rat: 'idle', fox: 'float', cat: 'prowl' }[k], t: 9, face: 1, flash: 0, phase2: false, summoned: false, sx: 0, ex: 0, side: 1, last: [], hitId: -1 } as Boss;
    drawBoss(c, boss, time);
  } else {
    const f = FOES[kind as FoeKind], s = Math.min(w, h) / 30;
    c.translate(w / 2, h / 2 + (f.h * s) / 2); c.scale(s, s);
    const e = { id: 1, kind: kind as FoeKind, x: 0, y: 0, hx: 0, hy: 0, vx: 0, vy: 0, hp: 1, face: 1, t: 1, state: 'awake', stateT: 0, flash: 0, ground: true, hitId: -1, dead: 0 } as Enemy;
    drawEnemy(c, null, e, time);
  }
  c.restore();
}

function drawBoss(c: C, o: Boss, time: number) {
  if (o.kind === 'owl') drawOwl(c, o, time); else if (o.kind === 'rat') drawRatKing(c, o, time); else if (o.kind === 'fox') drawFox(c, o, time); else drawCat(c, o, time);
}
/**
 * Tick-Tock the Clockwork Cat: a sleek grey tabby with brass joints, a wind-up key turning in her back and a bell on
 * her collar. (x, y) is her middle. She turns on her side to run up walls and stretches out to dive.
 */
function drawCat(c: C, o: Boss, time: number) {
  const white = o.flash > 0 && Math.floor(time * 30) % 2 === 0, col = (s: string) => (white ? '#ffffff' : s);
  const m = o.move as string;
  if (m === 'dying') c.globalAlpha = Math.max(0, 1 - o.t / 2.2);
  const wall = m === 'climb' || m === 'cling', dash = m === 'dash', run = m === 'prowl' || dash || m === 'climb';
  const stride = run ? Math.sin(time * (dash || m === 'climb' ? 26 : 10)) : 0;
  const squash = m === 'crouch' ? 0.8 : m === 'pounce' || m === 'dive' ? 1.12 : 1;
  c.save();
  if (wall) { c.translate(o.x + o.face * 12, o.y); c.scale(o.face, 1); c.rotate(-Math.PI / 2); c.translate(0, 12); }
  else {
    c.translate(o.x + (m === 'crouch' ? Math.sin(time * 50) * 0.8 : 0), o.y + 13); c.scale(o.face, 1);
    if (m === 'dive') c.rotate(Math.atan2(o.vy, Math.abs(o.vx) || 1) * 0.8);
    else if (m === 'pounce') c.rotate(o.vy < 0 ? -0.3 : 0.25);
  }
  c.scale(1 / Math.sqrt(squash), squash);
  // Tail: a long grey curl ending in brass rings.
  const sw = Math.sin(time * (dash ? 12 : 3)) * 4;
  c.strokeStyle = col('#6e6e7c'); c.lineWidth = 3.4; c.lineCap = 'round';
  c.beginPath(); c.moveTo(-15, -12); c.bezierCurveTo(-26, -14, -24, -30 + sw, -32, -30 + sw); c.stroke();
  c.strokeStyle = col('#c8a050'); c.lineWidth = 3.8; for (const t of [0.7, 0.85]) { const px = -15 + (-32 + 15) * t, py = -12 + (-30 + sw + 12) * t; c.beginPath(); c.moveTo(px, py - 0.6); c.lineTo(px, py + 0.6); c.stroke(); }
  c.lineCap = 'butt';
  // Legs with brass joints.
  c.fillStyle = col('#55555f');
  for (const [lx, ph] of [[-11, 0], [-6, Math.PI], [8, Math.PI], [13, 0]] as const) {
    const off = Math.sin(time * (dash ? 26 : 10) + ph) * (run ? 3 : 0);
    c.fillRect(lx + off - 1.6, -8, 3.2, 8);
    c.fillStyle = col('#c8a050'); ellipse(c, lx + off, -7, 1.3, 1.3); c.fill(); c.fillStyle = col('#55555f');
  }
  // Body: a sleek grey tabby with darker stripes and a riveted brass plate on her flank.
  const bg = c.createLinearGradient(0, -20, 0, -4);
  bg.addColorStop(0, white ? '#fff' : '#a0a0ae'); bg.addColorStop(1, white ? '#fff' : '#62626e');
  c.fillStyle = bg; ellipse(c, 0, -12 + stride * 0.4, 17, 7.6); c.fill();
  c.strokeStyle = col('#4a4a56'); c.lineWidth = 1.2;
  for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(-11 + i * 5, -19); c.quadraticCurveTo(-9 + i * 5, -15, -11 + i * 5, -12); c.stroke(); }
  c.fillStyle = col('#b08a40'); c.beginPath(); c.roundRect(-5, -14, 9, 5, 1.2); c.fill();
  c.fillStyle = col('#f0d890'); for (const [rx, ry] of [[-4, -13], [3, -13], [-4, -10], [3, -10]]) c.fillRect(rx, ry, 0.8, 0.8);
  // The wind-up key in her back, always turning (faster in a fury).
  const k = Math.cos(time * (o.phase2 ? 10 : 5));
  c.fillStyle = col('#c8a050'); c.fillRect(-4.6, -24, 1.6, 5);
  ellipse(c, -3.8, -26, 4 * Math.abs(k) + 0.5, 2); c.fill();
  // Collar and bell.
  c.fillStyle = col('#a01830'); c.fillRect(10, -17, 4, 7);
  const ring = m === 'chime' ? Math.sin(time * 40) * 0.6 : 0;
  c.fillStyle = col('#f0c850'); ellipse(c, 13.5 + ring, -9.5, 2.2, 2.2); c.fill();
  c.fillStyle = '#6a4a10'; c.fillRect(12.8 + ring, -8.6, 1.4, 0.8);
  // Head.
  c.fillStyle = col('#8e8e9c'); ellipse(c, 18, -20, 7.6, 6.6); c.fill();
  for (const [ex, tip] of [[14, 12], [20, 21]] as const) {
    c.fillStyle = col('#8e8e9c'); c.beginPath(); c.moveTo(ex - 2.6, -24); c.lineTo(tip, -32); c.lineTo(ex + 3, -25); c.fill();
    c.fillStyle = col('#c8a050'); c.beginPath(); c.moveTo(ex - 1, -24.4); c.lineTo(tip, -30); c.lineTo(ex + 1.8, -25); c.fill();
  }
  c.strokeStyle = col('#4a4a56'); c.lineWidth = 0.9; for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(15 + i * 2.4, -26.4); c.lineTo(15.6 + i * 2.4, -23.4); c.stroke(); }
  c.fillStyle = col('#d8d8e0'); ellipse(c, 23, -17.5, 3.6, 2.8); c.fill();
  c.fillStyle = col('#e88090'); ellipse(c, 25.6, -18.6, 1, 0.8); c.fill();
  const dizzy = m === 'dizzy';
  if (dizzy) { c.strokeStyle = '#2a2a30'; c.lineWidth = 0.8; c.beginPath(); c.arc(20, -21, 1.6, 0, Math.PI * 1.6); c.stroke(); }
  else {
    const eye = o.phase2 ? '#ff5a4a' : '#7dff9a';
    c.fillStyle = eye; ellipse(c, 20.4, -21, 2, 1.8); c.fill();
    c.fillStyle = rgba(eye, 0.3); ellipse(c, 20.4, -21, 4, 3); c.fill();
    c.fillStyle = '#0a0a10'; c.fillRect(20, -22.6, 0.9, 3.2);
  }
  c.strokeStyle = 'rgba(240,240,250,0.8)'; c.lineWidth = 0.4;
  c.beginPath(); for (const dy of [-1.4, 0, 1.4]) { c.moveTo(24, -17 + dy); c.lineTo(31, -18 + dy * 1.8); } c.stroke();
  // A paw raised with a cog, about to bowl it.
  if (m === 'cogs' && o.t < 0.4) { c.fillStyle = col('#55555f'); c.fillRect(12, -30, 3, 12); gearShape(c, 14, -33, 4, 8, time * 4, '#8a8e9a'); }
  c.restore();
  if (dizzy) for (let i = 0; i < 3; i++) { const a = time * 6 + (i * Math.PI * 2) / 3; c.fillStyle = '#ffe070'; star(c, o.x + o.face * 18 + Math.cos(a) * 11, o.y - 16 + Math.sin(a) * 4, 2.4); }
  if (m === 'chime') {
    // Rings of sound spread from the bell.
    for (let i = 0; i < 3; i++) { const k2 = ((time * 2 + i / 3) % 1); c.strokeStyle = `rgba(255,230,140,${0.6 * (1 - k2)})`; c.lineWidth = 1; ellipse(c, o.x + o.face * 13, o.y + 3, 4 + k2 * 20, 3 + k2 * 14); c.stroke(); }
  }
  if (dash) { c.fillStyle = 'rgba(220,220,230,0.3)'; for (let i = 1; i <= 3; i++) { ellipse(c, o.x - o.face * (16 + i * 10), o.y + 8, 6, 3.4); c.fill(); } }
  c.globalAlpha = 1;
}
/** How solid Count Culpeo looks: he gathers out of bats, bursts back into them, and fades away when beaten. */
function foxAlpha(o: Boss) {
  if (o.move === 'enter') return Math.min(1, o.t / 1.2);
  if (o.move === 'vanish') return Math.max(0, 1 - o.t / 0.2);
  if (o.move === 'appear') return Math.min(1, o.t / 0.35);
  if (o.move === 'dying') return Math.max(0, 1 - o.t / 2);
  return 1;
}
/** Count Culpeo: a tall fox in a high-collared black cape lined with red, with a bushy tail and burning eyes. */
function drawFox(c: C, o: Boss, time: number) {
  const a = foxAlpha(o);
  if (a <= 0) return;
  const white = o.flash > 0 && Math.floor(time * 30) % 2 === 0, col = (s: string) => (white ? '#ffffff' : s);
  const moving = o.move === 'lunge' && o.t > 0.3 || o.move === 'swoop', cast = o.move === 'fire' || o.move === 'pillars';
  const stream = moving ? 1 : 0, flut = Math.sin(time * (moving ? 18 : 3)) * (moving ? 2 : 1);
  c.save(); c.globalAlpha = a; c.translate(o.x, o.y); c.scale(o.face, 1);
  if (o.move === 'swoop') c.rotate(0.2);
  // A red aura while he's casting.
  if (cast) { const gl = c.createRadialGradient(0, -4, 2, 0, -4, 30); gl.addColorStop(0, 'rgba(255,60,40,0.25)'); gl.addColorStop(1, 'rgba(255,60,40,0)'); c.fillStyle = gl; ellipse(c, 0, -4, 30, 30); c.fill(); }
  // The tail, curling out from under the cape.
  c.fillStyle = col('#c8601e'); c.beginPath(); c.moveTo(-4, 12); c.quadraticCurveTo(-22 - stream * 6, 14 + flut, -24 - stream * 8, 0 + flut); c.quadraticCurveTo(-16, 4, -2, 6); c.fill();
  c.fillStyle = col('#f4ece0'); ellipse(c, -23 - stream * 8, 1 + flut, 3.6, 3, 0.8); c.fill();
  // The cape: black outside, red within, streaming back when he moves.
  c.fillStyle = col('#8a1024');
  c.beginPath(); c.moveTo(-3, -12); c.quadraticCurveTo(-14 - stream * 10, 4, -18 - stream * 14, 21 + flut); c.lineTo(8, 21); c.lineTo(6, -10); c.fill();
  c.fillStyle = col('#140810');
  c.beginPath(); c.moveTo(-3, -13); c.quadraticCurveTo(-12 - stream * 10, 4, -15 - stream * 14, 22 + flut); c.lineTo(-6, 22); c.quadraticCurveTo(-4, 6, 2, -10); c.fill();
  // Legs and polished shoes.
  const step = o.move === 'lunge' && o.t > 0.3 ? Math.sin(time * 30) * 3 : 0;
  c.fillStyle = col('#1e1420'); c.fillRect(-2 + step, 8, 3.4, 13); c.fillRect(3 - step, 8, 3.4, 13);
  c.fillStyle = col('#0a0608'); ellipse(c, 0.5 + step, 21, 3.4, 1.4); c.fill(); ellipse(c, 5.5 - step, 21, 3.4, 1.4); c.fill();
  // A dark suit, a red waistcoat and a white jabot.
  c.fillStyle = col('#2a1a2a'); ellipse(c, 2, 0, 7, 11); c.fill();
  c.fillStyle = col('#7a1428'); c.fillRect(2, -6, 4, 12);
  c.fillStyle = col('#f4ece0'); c.beginPath(); c.moveTo(3, -10); c.lineTo(8, -7); c.lineTo(5, -2); c.lineTo(3, -4); c.fill();
  c.fillStyle = '#d8b060'; ellipse(c, 4, 1, 0.8, 0.8); c.fill(); ellipse(c, 4, 4, 0.8, 0.8); c.fill();
  // His arm: raised with a flame in his paw while casting, otherwise tucked in.
  c.strokeStyle = col('#2a1a2a'); c.lineWidth = 3.4; c.lineCap = 'round';
  c.beginPath(); c.moveTo(3, -7);
  if (cast) c.lineTo(12, -16); else if (o.move === 'lunge') c.lineTo(13, -2); else c.lineTo(8, 2);
  c.stroke(); c.lineCap = 'butt';
  const px = cast ? 13 : o.move === 'lunge' ? 14 : 9, py = cast ? -17.5 : o.move === 'lunge' ? -2 : 3;
  c.fillStyle = col('#c8601e'); ellipse(c, px, py, 2, 1.8); c.fill();
  if (cast) {
    const f = 1 + Math.sin(time * 20) * 0.2;
    c.fillStyle = 'rgba(255,120,40,0.9)'; ellipse(c, px + 1, py - 4, 3 * f, 4.5 * f); c.fill();
    c.fillStyle = 'rgba(255,240,170,0.95)'; ellipse(c, px + 1, py - 3, 1.4 * f, 2.4 * f); c.fill();
  }
  // The high collar, stiff points rising behind the head.
  c.fillStyle = col('#140810'); c.beginPath(); c.moveTo(-6, -8); c.lineTo(-10, -28); c.lineTo(-2, -16); c.lineTo(2, -26); c.lineTo(4, -12); c.fill();
  c.fillStyle = col('#8a1024'); c.beginPath(); c.moveTo(-5, -9); c.lineTo(-8.5, -25); c.lineTo(-2.5, -15); c.fill();
  // The fox's head.
  c.fillStyle = col('#c8601e');
  c.beginPath(); c.moveTo(-2, -18); c.lineTo(-1, -30); c.lineTo(4, -21); c.fill();
  c.beginPath(); c.moveTo(4, -20); c.lineTo(8, -31); c.lineTo(10, -19); c.fill();
  c.fillStyle = col('#2a1008'); c.beginPath(); c.moveTo(-1.4, -26); c.lineTo(-1, -30); c.lineTo(1, -26.5); c.fill(); c.beginPath(); c.moveTo(7, -27); c.lineTo(8, -31); c.lineTo(9, -26.5); c.fill();
  c.fillStyle = col('#d8702a'); ellipse(c, 4, -17, 7, 6); c.fill();
  c.beginPath(); c.moveTo(8, -20); c.quadraticCurveTo(14, -18, 17, -15); c.lineTo(9, -12); c.fill();
  c.fillStyle = col('#f4ece0'); c.beginPath(); c.moveTo(4, -14); c.quadraticCurveTo(10, -12, 16.5, -14.5); c.quadraticCurveTo(10, -9, 3, -11); c.fill();
  c.fillStyle = col('#140810'); ellipse(c, 16.8, -15.2, 1.3, 1); c.fill();
  // Burning red eyes under a sharp brow.
  c.fillStyle = '#ff2838'; c.beginPath(); c.moveTo(7, -19); c.lineTo(11, -19.6); c.lineTo(10, -17.6); c.closePath(); c.fill();
  c.fillStyle = 'rgba(255,60,60,0.35)'; ellipse(c, 9, -18.6, 4, 2.4); c.fill();
  c.strokeStyle = col('#5a2008'); c.lineWidth = 0.9; c.beginPath(); c.moveTo(6.5, -20.5); c.lineTo(11.5, -21); c.stroke();
  c.restore();
}
function drawOwl(c: C, o: Boss, time: number) {
  const white = o.flash > 0 && Math.floor(time * 30) % 2 === 0, col = (s: string) => (white ? '#ffffff' : s);
  const flying = o.move !== 'rest';
  const flap = flying ? Math.sin(time * (o.move === 'swoop' || o.move === 'drop' ? 8 : 12)) : -0.6;
  if (o.move === 'dying') c.globalAlpha = Math.max(0, 1 - o.t / 2.2);
  c.save(); c.translate(o.x, o.y); c.scale(o.face, 1);
  if (o.move === 'swoop') c.rotate(0.25);
  for (const s of [-1, 1]) {
    c.save(); c.scale(s, 1);
    c.fillStyle = col('#5a4632');
    c.beginPath(); c.moveTo(6, -6);
    c.quadraticCurveTo(22, -14 - flap * 10, 34, -2 - flap * 14);
    c.lineTo(28, 2 - flap * 8); c.lineTo(30, 6 - flap * 6); c.lineTo(22, 6 - flap * 3); c.lineTo(20, 10);
    c.quadraticCurveTo(12, 8, 6, 6); c.fill();
    c.strokeStyle = col('#3a2a1a'); c.lineWidth = 0.8;
    for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(12 + i * 5, -2 - flap * (4 + i * 3)); c.lineTo(16 + i * 5, 6 - flap * (2 + i)); c.stroke(); }
    c.restore();
  }
  c.fillStyle = col('#7a6248'); ellipse(c, 0, 2, 13, 16); c.fill();
  c.fillStyle = col('#d8c8a8'); ellipse(c, 0, 5, 8.5, 11); c.fill();
  c.strokeStyle = col('#7a6248'); c.lineWidth = 0.8;
  for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(-5, -1 + i * 4); c.quadraticCurveTo(0, 1 + i * 4, 5, -1 + i * 4); c.stroke(); }
  c.fillStyle = col('#6a5238'); ellipse(c, 0, -12, 12, 9.5); c.fill();
  for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * 5, -18); c.lineTo(s * 11, -27); c.lineTo(s * 10, -16); c.fill(); }
  c.fillStyle = col('#c8b088'); ellipse(c, -5, -12, 5.2, 5); c.fill(); ellipse(c, 5, -12, 5.2, 5); c.fill();
  const eye = o.phase2 ? '#ff5040' : '#ffb020';
  c.fillStyle = white ? '#fff' : eye; ellipse(c, -5, -12, 3.6, 3.6); c.fill(); ellipse(c, 5, -12, 3.6, 3.6); c.fill();
  c.fillStyle = '#140a04'; ellipse(c, -5, -12, 1.7, 2.2); c.fill(); ellipse(c, 5, -12, 1.7, 2.2); c.fill();
  c.fillStyle = col('#3a2a1a'); c.beginPath(); c.moveTo(-10, -17); c.lineTo(-1, -14); c.lineTo(-10, -15); c.fill(); c.beginPath(); c.moveTo(10, -17); c.lineTo(1, -14); c.lineTo(10, -15); c.fill();
  c.fillStyle = col('#e0a030'); c.beginPath(); c.moveTo(-1.6, -9); c.lineTo(1.6, -9); c.lineTo(0, -5); c.fill();
  c.fillStyle = col('#c89030');
  for (const s of [-1, 1]) for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(s * 5 + i * 1.8, 16); c.lineTo(s * 5 + i * 2.4, 20); c.lineTo(s * 5 + i * 1.8 + 0.8, 16); c.fill(); }
  c.restore();
  c.globalAlpha = 1;
}

/** Gnawdrick the Rat King: a great fat rat in a crown and a red cape. (x, y) is his middle. */
function drawRatKing(c: C, o: Boss, time: number) {
  const white = o.flash > 0 && Math.floor(time * 30) % 2 === 0, col = (s: string) => (white ? '#ffffff' : s);
  if (o.move === 'dying') c.globalAlpha = Math.max(0, 1 - o.t / 2.2);
  const squash = o.move === 'crouch' || o.move === 'wind' ? 0.86 : o.move === 'leap' ? 1.12 : 1;
  const shake = o.move === 'wind' ? Math.sin(time * 60) * 1 : 0;
  c.save(); c.translate(o.x + shake, o.y + 17); c.scale(o.face, 1); c.scale(1 / Math.sqrt(squash), squash);
  const charge = o.move === 'charge', run = Math.sin(time * (charge ? 30 : 8)) * (charge ? 4 : 1);
  // Tail.
  c.strokeStyle = col('#c89090'); c.lineWidth = 2.4; c.lineCap = 'round';
  c.beginPath(); c.moveTo(-18, -10); c.bezierCurveTo(-34, -6, -30, -28 + Math.sin(time * 3) * 4, -42, -24); c.stroke();
  // Cape behind.
  c.fillStyle = col('#7a1424'); c.beginPath(); c.moveTo(-6, -30); c.quadraticCurveTo(-30, -20, -26 - (charge ? 8 : 0), -2); c.lineTo(4, -4); c.fill();
  c.fillStyle = col('#f0ece0'); c.beginPath(); c.moveTo(-6, -30); c.quadraticCurveTo(-14, -28, -18, -24); c.lineTo(-2, -24); c.fill();
  // Legs.
  c.fillStyle = col('#4a3a34'); c.fillRect(-12 + run, -5, 6, 5); c.fillRect(6 - run, -5, 6, 5);
  // Body.
  const body = c.createRadialGradient(-4, -22, 2, 0, -16, 26);
  body.addColorStop(0, white ? '#fff' : '#9a8a80'); body.addColorStop(1, white ? '#fff' : '#584840');
  c.fillStyle = body; ellipse(c, 0, -16, 22, 15); c.fill();
  c.fillStyle = col('#b8a898'); ellipse(c, 6, -11, 11, 8); c.fill();
  // Head.
  c.fillStyle = col('#6e5e56'); ellipse(c, 18, -24, 11, 9); c.fill();
  c.beginPath(); c.moveTo(24, -28); c.lineTo(36, -21); c.lineTo(24, -17); c.fill();
  c.fillStyle = col('#e8a0b0'); ellipse(c, 36, -21, 2, 2); c.fill();
  c.fillStyle = col('#6e5e56'); ellipse(c, 12, -33, 5, 5.4); c.fill();
  c.fillStyle = col('#e8a0b0'); ellipse(c, 12, -33, 3, 3.4); c.fill();
  const stunned = o.move === 'stunned';
  c.fillStyle = stunned ? '#1a1010' : o.phase2 ? '#ff2020' : '#ffb020';
  if (stunned) { c.strokeStyle = '#1a1010'; c.lineWidth = 1; c.beginPath(); c.moveTo(20, -28); c.lineTo(24, -24); c.moveTo(24, -28); c.lineTo(20, -24); c.stroke(); }
  else { ellipse(c, 22, -26, 2, 2); c.fill(); c.fillStyle = '#140a04'; ellipse(c, 22.5, -26, 0.9, 1.3); c.fill(); }
  // Teeth and whiskers.
  c.fillStyle = '#fff8e0'; c.fillRect(30, -18, 2, 4); c.fillRect(32.5, -18, 2, 3.4);
  c.strokeStyle = 'rgba(240,240,240,0.8)'; c.lineWidth = 0.5;
  c.beginPath(); c.moveTo(32, -22); c.lineTo(44, -26); c.moveTo(32, -21); c.lineTo(45, -21); c.moveTo(32, -20); c.lineTo(43, -16); c.stroke();
  // Crown, knocked askew when he's dizzy.
  c.save(); c.translate(16, -33); c.rotate(stunned ? -0.5 : -0.12);
  c.fillStyle = col('#e8c040'); c.beginPath(); c.moveTo(-7, 0); c.lineTo(-7, -7); c.lineTo(-4, -3); c.lineTo(0, -9); c.lineTo(4, -3); c.lineTo(7, -7); c.lineTo(7, 0); c.fill();
  c.fillStyle = col('#c02040'); ellipse(c, 0, -2, 1.4, 1.4); c.fill();
  c.fillStyle = col('#40a0e0'); ellipse(c, -4.5, -1.6, 1, 1); c.fill(); ellipse(c, 4.5, -1.6, 1, 1); c.fill();
  c.restore();
  // Arm raised with a wedge of cheese.
  if (o.move === 'cheese' && o.t < 0.5) { c.fillStyle = col('#6e5e56'); c.fillRect(8, -38, 4, 14); c.fillStyle = '#f0d060'; c.beginPath(); c.moveTo(4, -40); c.lineTo(16, -40); c.lineTo(10, -48); c.fill(); }
  c.restore();
  if (o.move === 'stunned') {
    for (let i = 0; i < 3; i++) {
      const a = time * 6 + (i * Math.PI * 2) / 3;
      c.fillStyle = '#ffe070'; star(c, o.x + o.face * 16 + Math.cos(a) * 12, o.y - 26 + Math.sin(a) * 4, 2.4);
    }
  }
  if (o.move === 'charge') { c.fillStyle = 'rgba(230,220,200,0.35)'; for (let i = 1; i <= 3; i++) { ellipse(c, o.x - o.face * (18 + i * 10), o.y + 12, 6, 4); c.fill(); } }
  c.globalAlpha = 1;
}
function star(c: C, x: number, y: number, r: number) {
  c.beginPath();
  for (let i = 0; i < 10; i++) { const a = (i * Math.PI) / 5 - Math.PI / 2, rr = i % 2 ? r * 0.45 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  c.fill();
}

function drawShot(c: C, s: Shot) {
  c.save(); c.translate(s.x, s.y);
  if (s.kind === 'seed') {
    c.rotate(s.spin);
    c.fillStyle = '#2a2a2a'; ellipse(c, 0, 0, 2, 3.6); c.fill();
    c.strokeStyle = '#e8e0d0'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(0, -3); c.lineTo(0, 3); c.stroke();
  } else if (s.kind === 'bone') {
    c.rotate(s.spin);
    c.strokeStyle = '#f0eadc'; c.lineWidth = 1.8; c.beginPath(); c.moveTo(-4, 0); c.lineTo(4, 0); c.stroke();
    c.fillStyle = '#f0eadc'; for (const x of [-4.5, 4.5]) { ellipse(c, x, -1, 1.4, 1.4); c.fill(); ellipse(c, x, 1, 1.4, 1.4); c.fill(); }
  } else if (s.kind === 'feather') {
    c.rotate(s.spin);
    c.fillStyle = '#8a7050'; ellipse(c, 0, 0, 7, 2.4); c.fill();
    c.strokeStyle = '#e8d8b8'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(-7, 0); c.lineTo(7, 0); c.stroke();
  } else if (s.kind === 'cheese') {
    c.rotate(s.x / s.r);
    const g = c.createRadialGradient(-2, -2, 1, 0, 0, s.r);
    g.addColorStop(0, '#fff0a0'); g.addColorStop(1, '#d8a830');
    c.fillStyle = g; ellipse(c, 0, 0, s.r, s.r); c.fill();
    c.strokeStyle = '#a87a20'; c.lineWidth = 1; ellipse(c, 0, 0, s.r - 0.5, s.r - 0.5); c.stroke();
    c.fillStyle = '#c8962a'; for (const [x, y, r] of [[3, -2, 1.8], [-3, 3, 1.4], [-2, -4, 1], [2, 4, 1]]) { ellipse(c, x, y, r, r); c.fill(); }
  } else if (s.kind === 'gust') {
    const k = Math.min(1, s.life * 3), big = s.r > 6;
    c.scale(Math.sign(s.vx) || 1, 1);
    c.strokeStyle = `rgba(250,240,225,${0.8 * k})`; c.lineWidth = big ? 2 : 1.2;
    for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(-4 - i * 3, 0, s.r - i * 1.4, -1.1, 1.1); c.stroke(); }
    c.fillStyle = `rgba(240,225,205,${0.35 * k})`; ellipse(c, -2, 0, s.r * 1.2, s.r * 0.8); c.fill();
  } else if (s.kind === 'acorn') {
    // A glossy acorn with a cross-hatched cap, whirling inside a motion blur.
    c.strokeStyle = 'rgba(255,236,200,0.35)'; c.lineWidth = 2.4; c.beginPath(); c.arc(0, 0, 7.5, s.spin * 1.5, s.spin * 1.5 + 2.4); c.stroke();
    c.strokeStyle = 'rgba(255,236,200,0.15)'; c.lineWidth = 1.5; c.beginPath(); c.arc(0, 0, 7.5, s.spin * 1.5 + Math.PI, s.spin * 1.5 + Math.PI + 1.6); c.stroke();
    c.rotate(s.spin * 1.5);
    c.fillStyle = '#c07a34'; c.beginPath(); c.moveTo(-3.8, -1); c.quadraticCurveTo(-4, 4.2, 0, 6); c.quadraticCurveTo(4, 4.2, 3.8, -1); c.fill();
    c.fillStyle = 'rgba(255,230,190,0.75)'; ellipse(c, -1.4, 1.8, 0.9, 2, -0.2); c.fill();
    c.fillStyle = '#6a4020'; ellipse(c, 0, -1.4, 4.6, 2.4); c.fill();
    c.strokeStyle = '#8a5a30'; c.lineWidth = 0.4; c.beginPath();
    for (let i = -3; i <= 3; i += 2) { c.moveTo(i - 1, -3.2); c.lineTo(i + 1, 0.4); c.moveTo(i + 1, -3.2); c.lineTo(i - 1, 0.4); }
    c.stroke();
    c.fillStyle = '#4a2c14'; c.fillRect(-0.5, -5.2, 1, 2);
  } else if (s.kind === 'pumpkin') {
    c.rotate(s.spin * 0.5);
    subIcon(c, 'pumpkin', 0, 0, 1);
  } else if (s.kind === 'flame') {
    const f = Math.sin(s.spin * 1.4 + s.x) * 1.2, k = Math.min(1, s.life * 2);
    c.fillStyle = `rgba(255,120,40,${0.8 * k})`; ellipse(c, f * 0.3, 0, 4, 7 * k); c.fill();
    c.fillStyle = `rgba(255,220,120,${0.9 * k})`; ellipse(c, f * 0.2, 2, 2, 4 * k); c.fill();
  } else if (s.kind === 'wind') {
    // A little tornado of dust.
    for (let i = 0; i < 6; i++) {
      const yy = 10 - i * 4.5, rr = 3 + i * 1.6, a = s.spin * 2 + i;
      c.strokeStyle = `rgba(235,225,210,${0.75 - i * 0.07})`; c.lineWidth = 1.4;
      c.beginPath(); c.ellipse(Math.sin(a) * 1.5, yy, rr, rr * 0.3, 0, a % (Math.PI * 2), a % (Math.PI * 2) + 4.4); c.stroke();
    }
  } else if (s.kind === 'quake') {
    // A shockwave racing along the floor: a bright crescent of force with slabs of stone heaving up at its front.
    // Enzo's Quake spell is bigger and rimmed with violet.
    const big = !!s.spell, k = Math.min(1, s.life * (big ? 2.5 : 5)), sz = big ? 1.45 : 1;
    c.scale((Math.sign(s.vx) || 1) * sz, sz); c.translate(0, 6 / sz - 6);
    const hot = big ? '200,160,255' : '255,196,90';
    const glow = c.createRadialGradient(0, 4, 0, 0, 4, 18);
    glow.addColorStop(0, `rgba(${hot},${0.5 * k})`); glow.addColorStop(1, `rgba(${hot},0)`);
    c.fillStyle = glow; ellipse(c, -4, 4, 18, 10); c.fill();
    // A glowing crack left along the floor behind it.
    const crack = c.createLinearGradient(-40, 0, 0, 0);
    crack.addColorStop(0, `rgba(${hot},0)`); crack.addColorStop(1, `rgba(255,240,200,${0.95 * k})`);
    c.strokeStyle = crack; c.lineWidth = 1.3; c.beginPath(); c.moveTo(-40, 6);
    for (let x = -34; x <= 0; x += 6) c.lineTo(x, 6 - (Math.floor(x / 6) % 2 ? 1.2 : -0.2));
    c.stroke();
    // Slabs of floor heave up behind the wave and settle.
    for (let i = 0; i < 3; i++) {
      const h = (3.5 + i * 2) * (0.6 + 0.4 * Math.abs(Math.sin(s.spin * 0.8 + i * 1.7))) * k, x = -13 + i * 4.5;
      c.fillStyle = '#7c7a88'; c.beginPath(); c.moveTo(x - 2.4, 6); c.lineTo(x - 1.4, 6 - h); c.lineTo(x + 1.2, 5.2 - h); c.lineTo(x + 2.4, 6); c.fill();
      c.fillStyle = '#c4c2d0'; c.beginPath(); c.moveTo(x - 1.4, 6 - h); c.lineTo(x + 1.2, 5.2 - h); c.lineTo(x + 0.6, 6.4 - h); c.lineTo(x - 1, 7 - h); c.fill();
    }
    // The wave itself: a bright arc of force rolling forward, like a ripple through the stone.
    for (const [r, wdt, col] of [[13, 4.5, `rgba(${hot},${0.55 * k})`], [12, 2, `rgba(255,236,170,${0.95 * k})`], [11.2, 0.8, `rgba(255,255,255,${k})`]] as const) {
      c.strokeStyle = col; c.lineWidth = wdt; c.lineCap = 'round';
      c.beginPath(); c.arc(-6, 6, r, -1.25, -0.02); c.stroke();
    }
    c.strokeStyle = `rgba(255,236,170,${0.5 * k})`; c.lineWidth = 1;
    c.beginPath(); c.arc(-9, 6, 8, -1.1, -0.05); c.stroke();
    c.lineCap = 'butt';
  } else if (s.kind === 'fire') {
    // A fireball with a white-hot heart and a tail of flame streaming behind.
    const a = Math.atan2(s.vy, s.vx);
    c.rotate(a);
    const tail = c.createLinearGradient(-16, 0, 0, 0);
    tail.addColorStop(0, 'rgba(255,80,20,0)'); tail.addColorStop(1, 'rgba(255,120,40,0.85)');
    c.fillStyle = tail; c.beginPath(); c.moveTo(-16 + Math.sin(s.spin * 3) * 2, 0); c.quadraticCurveTo(-6, -5, 0, -4.5); c.lineTo(0, 4.5); c.quadraticCurveTo(-6, 5, -16 + Math.sin(s.spin * 3) * 2, 0); c.fill();
    c.fillStyle = '#ff6a28'; ellipse(c, 0, 0, 5, 4.6); c.fill();
    c.fillStyle = '#ffd070'; ellipse(c, 1, 0, 3, 2.8); c.fill();
    c.fillStyle = '#fffbe8'; ellipse(c, 1.5, 0, 1.4, 1.3); c.fill();
  } else if (s.kind === 'ink') {
    c.fillStyle = 'rgba(30,28,60,0.5)'; ellipse(c, -s.vx * 0.03, -s.vy * 0.03, 2.4, 2.4); c.fill();
    c.fillStyle = '#16142a'; ellipse(c, 0, 0, 3.6, 3.4); c.fill();
    c.fillStyle = 'rgba(170,170,240,0.6)'; ellipse(c, -1, -1.2, 1.2, 0.8); c.fill();
  } else if (s.kind === 'cog') {
    // A brass cog rolling along (an iron one when it's the cat's).
    c.rotate(s.x / s.r);
    gearShape(c, 0, 0, s.r * 0.86, 9, 0, s.hero ? '#d0a040' : '#7a7e8c');
    c.fillStyle = s.hero ? 'rgba(255,240,190,0.7)' : 'rgba(220,225,240,0.5)'; ellipse(c, -s.r * 0.3, -s.r * 0.3, s.r * 0.22, s.r * 0.16); c.fill();
  } else if (s.kind === 'note') {
    // A dark little note, with a glow so it reads against the stone.
    c.fillStyle = 'rgba(255,230,160,0.35)'; ellipse(c, 0, 0, 5.4, 5.4); c.fill();
    c.fillStyle = '#1a1020'; ellipse(c, -1, 2, 2.4, 1.8, -0.4); c.fill();
    c.fillRect(0.8, -5, 1, 7); c.beginPath(); c.moveTo(1.8, -5); c.quadraticCurveTo(5, -3, 3.6, 0); c.lineTo(1.8, -2.6); c.fill();
  } else if (s.kind === 'chime') {
    // A ring of sound rolling out from the cat's bell.
    const k = Math.min(1, s.life);
    for (let i = 0; i < 3; i++) { c.strokeStyle = `rgba(255,${220 - i * 20},${130 - i * 30},${(0.9 - i * 0.25) * k})`; c.lineWidth = 2 - i * 0.5; c.beginPath(); c.ellipse(-Math.sign(s.vx) * i * 3, 0, 3 + i * 1.5, s.r, 0, 0, Math.PI * 2); c.stroke(); }
  } else if (s.kind === 'petal') {
    // A petal of Petal Ward, spinning as it circles Dora.
    const k = Math.min(1, s.life * 2);
    c.rotate(s.spin * 0.8);
    c.fillStyle = `rgba(255,150,200,${0.3 * k})`; ellipse(c, 0, 0, 7, 7); c.fill();
    const gr = c.createLinearGradient(-4, 0, 4, 0); gr.addColorStop(0, `rgba(255,190,220,${k})`); gr.addColorStop(1, `rgba(230,90,150,${k})`);
    c.fillStyle = gr; c.beginPath(); c.moveTo(-5, 0); c.quadraticCurveTo(0, -4, 5, 0); c.quadraticCurveTo(0, 3, -5, 0); c.fill();
    c.strokeStyle = `rgba(255,255,255,${0.7 * k})`; c.lineWidth = 0.5; c.beginPath(); c.moveTo(-4, 0); c.lineTo(4, 0); c.stroke();
  } else if (s.kind === 'boulder') {
    // Drawn as Enzo himself, curled up and rolling.
  } else if (s.kind === 'rock') {
    c.rotate(s.spin);
    c.fillStyle = '#5a5a60'; c.beginPath(); c.moveTo(-5, -2); c.lineTo(-1, -5); c.lineTo(4, -3); c.lineTo(5, 2); c.lineTo(0, 5); c.lineTo(-4, 3); c.fill();
    c.fillStyle = '#8a8a92'; c.beginPath(); c.moveTo(-3, -2); c.lineTo(-1, -4); c.lineTo(2, -3); c.lineTo(0, -1); c.fill();
  } else {
    const d = Math.sign(s.vx);
    c.fillStyle = 'rgba(220,200,170,0.85)';
    c.beginPath(); c.moveTo(-d * 8, 6); c.quadraticCurveTo(0, -10, d * 8, 6); c.fill();
    c.fillStyle = 'rgba(255,240,220,0.6)'; c.beginPath(); c.moveTo(-d * 4, 6); c.quadraticCurveTo(d * 2, -4, d * 7, 6); c.fill();
  }
  c.restore();
}

// ─── Heroes ───────────────────────────────────────────────────────────────

function weaponArc(c: C, g: FluffstevaniaGame) {
  const b = g.body;
  if (b.attackT <= 0) return;
  const w = g.weaponOf(b.attackHero), into = w.total - b.attackT, u = into / w.total, id = g.equipped[b.attackHero].weapon ?? '';
  const live = into >= w.windup && into <= w.windup + w.active;
  const x = b.x + b.face * 4, y = b.y - 13;
  c.save(); c.translate(x, y); c.scale(b.face, 1);
  if (w.style === 'fan') {
    const k = FANS[id] ?? FANS.fan;
    if (b.spin) {
      // The whirlwind spin: the fan whirls all the way round inside a ring of dust.
      const into2 = 0.5 - b.attackT, ang = into2 * Math.PI * 5;
      c.restore(); c.save(); c.translate(b.x, b.y - 13);
      c.strokeStyle = rgba(k.trail, 0.5 * (1 - into2 * 1.6)); c.lineWidth = 4;
      c.beginPath(); c.arc(0, 0, 30, ang, ang + 4.2); c.stroke();
      c.strokeStyle = 'rgba(255,245,230,0.5)'; c.lineWidth = 1.5; c.beginPath(); c.arc(0, 0, 36, ang + 1, ang + 4); c.stroke();
      c.rotate(ang); c.translate(8, 0);
      fanShape(c, id, 13, 2.4);
    } else {
      // A wide sweep; the second hit of a combo sweeps back the other way and the third is bigger.
      const back = b.combo === 1, big = b.combo === 2, r = big ? 15 : 12;
      const from = back ? 1.1 : -1.5, to = back ? -1.3 : 0.9;
      const k2 = into < w.windup ? 0 : Math.min(1, (into - w.windup) / w.active);
      const ang = from + (to - from) * (1 - (1 - k2) * (1 - k2));
      if (into >= w.windup && u < 0.85) {
        c.fillStyle = rgba(k.trail, 0.4 * (1 - u));
        c.beginPath(); c.arc(0, 0, w.reach * (big ? 1.05 : 0.9), Math.min(from, ang), Math.max(from, ang)); c.arc(0, 0, w.reach * 0.35, Math.max(from, ang), Math.min(from, ang), true); c.fill();
        c.strokeStyle = rgba(k.edge, 0.8 * (1 - u)); c.lineWidth = 1;
        c.beginPath(); c.arc(0, 0, w.reach * (big ? 1.05 : 0.9), Math.min(from, ang), Math.max(from, ang)); c.stroke();
        // Each fan leaves its own sparkle along the rim: petals, moonlit stars, or wolfberry embers.
        for (let i = 0; i < 5; i++) {
          const a = from + (ang - from) * (i / 4), r = w.reach * (big ? 1.05 : 0.9) + Math.sin(i * 2.7) * 3, px = Math.cos(a) * r, py = Math.sin(a) * r, al = (1 - u) * (0.5 + i / 8);
          if (id === 'moonfan') { c.fillStyle = `rgba(235,242,255,${al})`; star(c, px, py, 1.6); }
          else if (id === 'wolffan') { c.fillStyle = `rgba(255,${150 + i * 15},70,${al})`; ellipse(c, px, py - (1 - u) * 3, 1.2, 1.2); c.fill(); }
          else { c.fillStyle = `rgba(255,200,225,${al})`; ellipse(c, px, py, 1.8, 1, a + i); c.fill(); }
        }
      }
      c.rotate(ang);
      fanShape(c, id, r, into < w.windup ? 1 : 2.4);
    }
  } else if (w.style === 'claws') {
    if (into >= w.windup) {
      const a = Math.min(1, (into - w.windup) / w.active), fade = Math.max(0, 1 - u * 1.1);
      // A crescent swoosh with three claw trails through it.
      c.fillStyle = `rgba(210,230,255,${0.45 * fade})`;
      c.beginPath(); c.arc(0, 0, w.reach * 0.85, -1.3, -1.3 + a * 2.5); c.arc(3, 1, w.reach * 0.6, -1.3 + a * 2.5, -1.3, true); c.fill();
      c.strokeStyle = `rgba(255,255,255,${fade})`; c.lineWidth = 1.2;
      for (let i = -1; i <= 1; i++) { c.beginPath(); c.arc(2, i * 3.4, w.reach * 0.78, -1.2 + i * 0.1, -1.2 + a * 2.3 + i * 0.1); c.stroke(); }
      if (id === 'ironclaws') { c.strokeStyle = `rgba(160,180,210,${fade})`; c.lineWidth = 0.6; c.beginPath(); c.arc(2, 0, w.reach * 0.9, -1.2, -1.2 + a * 2.3); c.stroke(); }
    }
  } else {
    const a = into < w.windup ? -2.2 : -2.2 + Math.min(1, (into - w.windup) / w.active) * 2.8;
    if (live || (into > w.windup && u < 0.7)) {
      // A heavy smear behind the club head, with speed lines.
      const fade = live ? 1 : Math.max(0, 1 - (u - 0.5) * 4), gr = c.createRadialGradient(0, 0, w.reach * 0.3, 0, 0, w.reach * 0.95);
      gr.addColorStop(0, 'rgba(255,236,200,0)'); gr.addColorStop(0.6, `rgba(255,220,150,${0.45 * fade})`); gr.addColorStop(1, `rgba(255,252,240,${0.95 * fade})`);
      c.fillStyle = gr; c.beginPath(); c.arc(0, 0, w.reach * 0.95, a - 1.3, a); c.arc(0, 0, w.reach * 0.3, a, a - 1.3, true); c.fill();
      c.strokeStyle = `rgba(255,255,255,${0.6 * fade})`; c.lineWidth = 0.6;
      for (let i = 0; i < 3; i++) { const r = w.reach * (0.55 + i * 0.16); c.beginPath(); c.arc(0, 0, r, a - 0.9 + i * 0.15, a - 0.1); c.stroke(); }
    }
    c.rotate(a);
    if (id === 'pin') {
      c.fillStyle = '#6a4020'; c.fillRect(0, -1, 8, 2); c.fillRect(w.reach * 0.8 + 6, -1, 5, 2);
      const gr = c.createLinearGradient(0, -3.5, 0, 3.5); gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#9898a8');
      c.fillStyle = gr; c.fillRect(8, -3.5, w.reach * 0.8 - 2, 7);
    } else {
      c.strokeStyle = '#6a4020'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, 0); c.lineTo(w.reach * 0.75, 0); c.stroke();
      c.fillStyle = '#a06a30'; ellipse(c, w.reach * 0.8, 0, 5, 4.4); c.fill();
      c.fillStyle = '#5a3a1a'; c.fillRect(w.reach * 0.8 - 1, -5, 6, 2.4);
    }
  }
  c.restore();
}

// Afterimages: when a hero dashes, lunges or tumbles, faded copies of them trail behind in a violet or blue tint.
type Ghost = { x: number; y: number; face: 1 | -1; born: number; cv: HTMLCanvasElement };
const ghosts: Ghost[] = [];
const ghostPool: HTMLCanvasElement[] = [];
let lastGhost = 0;
const GHOST_LIFE = 0.28, GHOST_TINT: Record<HeroId, string> = { dora: '#d090ff', enzo: '#80c0ff' };
function addGhost(id: HeroId, x: number, y: number, face: 1 | -1, now: number, o: { run?: number; air?: boolean; spin?: number }) {
  const s = 3, cv = ghostPool.pop() ?? canvas(48 * s, 48 * s), c = cv.getContext('2d')!;
  c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-over'; c.clearRect(0, 0, cv.width, cv.height);
  c.setTransform(s, 0, 0, s, 0, 0);
  if (o.spin !== undefined) { c.translate(24, 24); c.rotate(o.spin); c.translate(-24, -24); drawChinchilla(c, id as ChinId, 24, 34, { face, h: HERO_DRAW_H * 0.9, time: now, air: true }); }
  else drawChinchilla(c, id as ChinId, 24, 40, { face, h: HERO_DRAW_H, time: now, run: o.run, moving: !o.air, air: o.air });
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalCompositeOperation = 'source-atop'; c.fillStyle = GHOST_TINT[id]; c.globalAlpha = 0.8; c.fillRect(0, 0, cv.width, cv.height);
  c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  ghosts.push({ x, y: o.spin !== undefined ? y + 6 : y, face, born: now, cv });
}
function drawGhosts(c: C, now: number) {
  for (let i = ghosts.length - 1; i >= 0; i--) {
    const gh = ghosts[i], age = now - gh.born;
    if (age > GHOST_LIFE || age < 0) { ghostPool.push(gh.cv); ghosts.splice(i, 1); continue; }
    c.globalAlpha = 0.5 * (1 - age / GHOST_LIFE);
    c.drawImage(gh.cv, gh.x - 24, gh.y - 40, 48, 48);
  }
  c.globalAlpha = 1;
}

type HeroLook = { run?: number; moving?: boolean; air?: boolean; alpha?: number; armor?: string | null; sx?: number; sy?: number; vx?: number };
function hero(c: C, id: HeroId, x: number, y: number, face: 1 | -1, time: number, o: HeroLook) {
  c.globalAlpha = o.alpha ?? 1;
  const sx = o.sx ?? 1, sy = o.sy ?? 1;
  if (sx !== 1 || sy !== 1) { c.save(); c.translate(x, y); c.scale(sx, sy); c.translate(-x, -y); }
  const decorate = o.armor ? (d: C, bob: number) => wearArmor(d, o.armor!, bob, time, Math.min(1, Math.abs(o.vx ?? 0) / 120), !!o.air) : undefined;
  drawChinchilla(c, id as ChinId, x, y, { face, h: HERO_DRAW_H, time, run: o.run, moving: o.moving, air: o.air, decorate, blink: Math.floor(time * 0.6 + (id === 'dora' ? 0 : 0.5)) % 7 === 0 && time % 1.7 < 0.12 });
  if (sx !== 1 || sy !== 1) c.restore();
  c.globalAlpha = 1;
}
/**
 * Worn armour, drawn in the chinchilla's 24-unit frame (feet at 0, facing +x, head at about (7, -13)). `speed` 0–1
 * streams the Scarf's tails and the Cape back further.
 */
function wearArmor(c: C, id: string, bob: number, time: number, speed: number, air: boolean) {
  const flap = Math.sin(time * (6 + speed * 8)) * (0.6 + speed), lift = air ? -2 : 0;
  if (id === 'scarf') {
    // A knitted red scarf round the neck, its two tails flying out behind.
    for (const [dy, len] of [[0, 1], [1.4, 0.8]] as const) {
      c.fillStyle = dy ? '#a8202c' : '#c83040';
      c.beginPath(); c.moveTo(1, -8 + bob + dy);
      c.quadraticCurveTo(-4 - speed * 3, -8 + bob + dy + flap + lift, -8 * len - speed * 6, -6 + bob + dy + flap * 1.6 + lift - speed * 2);
      c.lineTo(-8 * len - speed * 6 + 0.4, -4 + bob + dy + flap * 1.6 + lift - speed * 2);
      c.quadraticCurveTo(-4 - speed * 3, -6 + bob + dy + flap + lift, 1, -6 + bob + dy); c.fill();
    }
    c.fillStyle = '#d83848'; c.beginPath(); c.roundRect(0.5, -10 + bob, 9.5, 3.4, 1.4); c.fill();
    c.strokeStyle = '#f0c8a0'; c.lineWidth = 0.35; c.beginPath();
    for (let i = 0; i < 4; i++) { c.moveTo(2 + i * 2.2, -9.8 + bob); c.lineTo(2 + i * 2.2, -6.8 + bob); }
    c.stroke();
  } else if (id === 'cape') {
    // A cape of dusty moth wings pinned at the shoulders: two soft wings fanning back over the back, with eye spots,
    // that ripple and stream out as they run.
    const sweep = speed * 0.35 + (air ? 0.25 : 0);
    for (const [rot, len, wid, tint] of [[-0.6 - sweep, 14, 6, '#a89070'], [-0.1 - sweep * 0.6, 12.5, 5, '#c0a882']] as const) {
      c.save(); c.translate(-1, -15.5 + bob); c.rotate(Math.PI + rot + flap * 0.06);
      c.fillStyle = tint; c.strokeStyle = '#5a4630'; c.lineWidth = 0.5;
      c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(len * 0.5, -wid, len, -wid * 0.3); c.quadraticCurveTo(len * 0.8, wid * 0.8, 0, 0.8); c.closePath(); c.fill(); c.stroke();
      c.strokeStyle = 'rgba(90,70,48,0.6)'; c.lineWidth = 0.3; c.beginPath(); c.moveTo(0.5, 0); c.lineTo(len * 0.8, -wid * 0.2); c.moveTo(len * 0.4, -wid * 0.5); c.lineTo(len * 0.6, wid * 0.3); c.stroke();
      c.fillStyle = '#f0e0c0'; ellipse(c, len * 0.62, -wid * 0.1, 1.5, 1.2); c.fill();
      c.fillStyle = '#3a2a1a'; ellipse(c, len * 0.62, -wid * 0.1, 0.7, 0.6); c.fill();
      c.restore();
    }
    c.fillStyle = '#d8b860'; ellipse(c, -0.8, -15.5 + bob, 1.2, 1.2); c.fill();
  } else if (id === 'helm') {
    // A silver thimble on the crown, between the ears, with a dimpled pattern.
    const gr = c.createLinearGradient(3, 0, 11, 0);
    gr.addColorStop(0, '#9898a8'); gr.addColorStop(0.45, '#f4f4fa'); gr.addColorStop(1, '#8a8a9a');
    c.fillStyle = gr; c.strokeStyle = '#4a4a58'; c.lineWidth = 0.5;
    c.beginPath(); c.moveTo(3.2, -16.4 + bob); c.lineTo(4, -21.5 + bob); c.quadraticCurveTo(7.2, -24 + bob, 10.4, -21.5 + bob); c.lineTo(11.2, -16.4 + bob); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#b8b8c8'; c.fillRect(2.8, -17.4 + bob, 8.8, 1.4);
    c.fillStyle = 'rgba(70,70,90,0.5)';
    for (let r = 0; r < 3; r++) for (let i = 0; i < 4 - (r === 0 ? 1 : 0); i++) { ellipse(c, 5 + i * 1.6 + (r % 2) * 0.8, -19.6 - r * 1.3 + bob, 0.35, 0.35); c.fill(); }
  }
}

/** A hero in Mist Form: a swirl of dust in their afterimage colour, drifting between the bars. */
function mistWisp(c: C, id: HeroId, x: number, y: number, time: number) {
  c.save(); c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 9; i++) {
    const a = time * 3 + i * 0.7, r = 3 + (i % 3) * 3;
    const px = x + Math.cos(a) * r, py = y - 10 + Math.sin(a * 1.3) * r * 0.8 - (i % 4);
    const gr = c.createRadialGradient(px, py, 0, px, py, 6);
    gr.addColorStop(0, rgba(GHOST_TINT[id], 0.35)); gr.addColorStop(1, rgba(GHOST_TINT[id], 0));
    c.fillStyle = gr; ellipse(c, px, py, 6, 6); c.fill();
  }
  c.fillStyle = 'rgba(255,250,240,0.6)'; for (let i = 0; i < 6; i++) { const a = time * 5 + i; c.fillRect(x + Math.cos(a) * 7, y - 10 + Math.sin(a * 1.4) * 8, 1, 1); }
  c.restore();
}
let landAir = false, landAt = -1;
function drawHeroes(c: C, g: FluffstevaniaGame, time: number) {
  const b = g.body, f = g.follower, partner = g.partner;
  const tp = g.tagPoint();
  const w = g.weaponOf(b.attackHero), into = w.total - b.attackT;
  const lunging = b.attackT > 0 && b.ground && Math.abs(b.vx) > 80 && into < w.windup + w.active;
  const rolling = b.rollT > 0, rollSpin = (ROLL_T - b.rollT) * 24 * b.face;
  const trailing = b.dashT > 0 || lunging || !!tp || rolling;
  if (trailing && time - lastGhost > 0.035) {
    lastGhost = time;
    if (tp && g.tag) addGhost(g.tag.hero, tp.x, tp.y + 10, b.face, time, { spin: g.tag.t * 26 * b.face });
    else if (rolling) addGhost(g.leader, b.x, b.y - 10, b.face, time, { spin: rollSpin });
    else addGhost(g.leader, b.x, b.y, b.face, time, { run: b.run, air: !b.ground });
  }
  drawGhosts(c, time);
  if (g.pal && g.duoT < 0) {
    const p = g.palBody;
    drawPal(c, g.pal, p.x, p.y, p.face, time, p.act, g.pal === 'zippy' && p.target >= 0);
  }
  if (g.duoT >= 0) return;
  const armor = (h: HeroId) => g.equipped[h].armor;
  if (g.hp[partner] > 0 && g.has('mist') && g.inGrate(f.x, f.y)) mistWisp(c, partner, f.x, f.y, time + 0.7);
  else if (g.hp[partner] > 0 && !(g.tag && g.tag.t < TAG_ARC)) hero(c, partner, f.x, f.y, f.face, time + 0.7, { run: f.run, moving: f.moving, air: f.air, alpha: 0.95, armor: armor(partner), vx: f.moving ? 100 : 0 });
  else if (g.hp[partner] > 0 && g.tag) hero(c, partner, b.x - b.face * 4, b.y - Math.sin((g.tag.t / TAG_ARC) * Math.PI) * 8, b.face, time, { air: true, armor: armor(partner) });
  if (tp && g.tag) {
    const spin = g.tag.t * 26 * b.face;
    c.save(); c.translate(tp.x, tp.y); c.rotate(spin);
    drawChinchilla(c, g.tag.hero as ChinId, 0, 10, { face: b.face, h: HERO_DRAW_H * 0.9, time, air: true });
    c.restore();
    const k = g.tag.t / TAG_T;
    c.strokeStyle = `rgba(255,240,210,${0.8 - k * 0.6})`; c.lineWidth = 2;
    ellipse(c, tp.x, tp.y, 13 + k * 6, 13 + k * 6); c.stroke();
    c.strokeStyle = `rgba(255,200,120,${0.6 - k * 0.5})`; c.lineWidth = 1;
    c.beginPath(); c.arc(tp.x, tp.y, 17 + k * 6, spin, spin + 2); c.stroke();
    c.beginPath(); c.arc(tp.x, tp.y, 17 + k * 6, spin + Math.PI, spin + Math.PI + 2); c.stroke();
    if (g.tag.t < 0.3) {
      c.font = `900 10px ${DISPLAY}`; c.textAlign = 'center';
      c.lineWidth = 3; c.strokeStyle = '#2a1030'; c.strokeText('TAG!', tp.x, tp.y - 20 - g.tag.t * 20);
      c.fillStyle = '#ffd860'; c.fillText('TAG!', tp.x, tp.y - 20 - g.tag.t * 20);
    }
    return;
  }
  if (g.misting) { mistWisp(c, g.leader, b.x, b.y, time); weaponArc(c, g); return; }
  if (rolling) {
    // Boulder Roll: curled up tight, tumbling along with a ring of dust.
    c.save(); c.translate(b.x, b.y - 10); c.rotate(rollSpin);
    drawChinchilla(c, g.leader as ChinId, 0, 10, { face: b.face, h: HERO_DRAW_H * 0.85, time, air: true });
    c.restore();
    c.strokeStyle = 'rgba(200,170,255,0.6)'; c.lineWidth = 1.6; ellipse(c, b.x, b.y - 10, 13, 13); c.stroke();
    return;
  }
  if (g.clinging) {
    // Clinging to a wall: turned to look out from it, claws dug in, with sparks where they scrape.
    const d = b.cling;
    hero(c, g.leader, b.x - d * 1, b.y, -d as 1 | -1, time, { air: true, armor: armor(g.leader), sx: 0.94, sy: 1.04 });
    if (b.vy > 20) for (let i = 0; i < 3; i++) { c.fillStyle = `rgba(255,220,140,${0.5 + Math.sin(time * 40 + i) * 0.4})`; c.fillRect(b.x + d * 6, b.y - 16 + i * 5 + ((time * 60) % 4), 1, 1); }
    c.strokeStyle = 'rgba(40,30,20,0.6)'; c.lineWidth = 0.6;
    for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(b.x + d * 6.5, b.y - 14 + i * 2); c.lineTo(b.x + d * 6.5, b.y - 22 + i * 2); c.stroke(); }
    weaponArc(c, g);
    return;
  }
  const flicker = b.invT > 0 && Math.floor(time * 20) % 2 === 0 && !lunging;
  const moving = Math.abs(b.vx) > 1 && b.ground;
  // Squash on landing, stretch on the way up.
  if (b.ground && landAir) landAt = time;
  landAir = !b.ground;
  const land = Math.max(0, 1 - (time - landAt) / 0.14), rise = !b.ground && b.vy < -120 ? Math.min(1, -b.vy / 500) : 0;
  const sq = land * 0.16 - rise * 0.1;
  hero(c, g.leader, b.x, b.y, b.face, time, { run: b.run, moving, air: !b.ground, alpha: flicker ? 0.35 : 1, armor: armor(g.leader), vx: b.vx, sx: 1 + sq, sy: 1 - sq });
  if (b.charge > 0.12 && b.attackT <= 0) {
    // Charging the fan: dust gathers, and sparkles once the spin is ready.
    const k = Math.min(1, b.charge / CHARGE_T), ready = k >= 1;
    c.strokeStyle = ready ? `rgba(255,220,240,${0.6 + Math.sin(time * 30) * 0.3})` : `rgba(240,225,205,${0.5 * k})`; c.lineWidth = ready ? 1.6 : 1;
    ellipse(c, b.x, b.y - 12, 22 - k * 8, 16 - k * 6); c.stroke();
    for (let i = 0; i < 5; i++) { const a = time * 8 + i * 1.26; c.fillStyle = 'rgba(245,230,210,0.8)'; c.fillRect(b.x + Math.cos(a) * (20 - k * 8), b.y - 12 + Math.sin(a) * (14 - k * 5), 1.2, 1.2); }
    if (ready) { c.fillStyle = '#fff'; star(c, b.x + b.face * 8, b.y - 26, 2.5); }
  }
  if (b.castT > 0) {
    c.strokeStyle = `rgba(200,170,255,${b.castT * 2})`; c.lineWidth = 1.5;
    ellipse(c, b.x, b.y - 1, 16 * (1.2 - b.castT), 4 * (1.2 - b.castT)); c.stroke();
    if (g.leader === 'enzo') {
      // Quake: a rune circle glows on the floor under Enzo.
      const a = Math.min(1, b.castT * 3), r = 22;
      c.save(); c.translate(b.x, b.y); c.scale(1, 0.28); c.rotate(time * 1.5);
      c.strokeStyle = `rgba(220,190,255,${a})`; c.lineWidth = 2.4;
      ellipse(c, 0, 0, r, r); c.stroke(); ellipse(c, 0, 0, r * 0.7, r * 0.7); c.stroke();
      c.beginPath(); for (let i = 0; i < 6; i++) { const t = (i * Math.PI * 2) / 6; c.lineTo(Math.cos(t * 2) * r * 0.7, Math.sin(t * 2) * r * 0.7); } c.closePath(); c.stroke();
      c.fillStyle = `rgba(255,236,255,${a})`;
      for (let i = 0; i < 8; i++) { const t = (i * Math.PI) / 4; c.fillRect(Math.cos(t) * r * 0.85 - 1.2, Math.sin(t) * r * 0.85 - 1.2, 2.4, 2.4); }
      c.restore();
    }
  }
  weaponArc(c, g);
}

/** The Duo Strike: the screen darkens and Dora and Enzo streak across it in opposite directions. */
function drawDuo(c: C, g: FluffstevaniaGame, time: number) {
  const t = g.duoT, k = t / DUO_T, y = g.body.y - g.cam.y;
  c.fillStyle = `rgba(10,4,20,${Math.min(0.55, t * 3, (DUO_T - t) * 3)})`; c.fillRect(0, 0, VIEW_W, VIEW_H);
  const run = Math.min(1, t / 0.6);
  for (const [id, dir, dy] of [['dora', 1, -6], ['enzo', -1, 6]] as const) {
    const x = dir > 0 ? -40 + (VIEW_W + 80) * run : VIEW_W + 40 - (VIEW_W + 80) * run;
    const streak = c.createLinearGradient(x - dir * 120, 0, x, 0);
    streak.addColorStop(0, 'rgba(255,255,255,0)'); streak.addColorStop(1, id === 'dora' ? 'rgba(230,170,255,0.7)' : 'rgba(150,200,255,0.7)');
    c.fillStyle = streak; c.fillRect(Math.min(x, x - dir * 120), y + dy - 16, 120, 12);
    if (run < 1) { addGhost(id, x + g.cam.x, y + dy + g.cam.y, dir as 1 | -1, time, { air: true }); drawChinchilla(c, id, x, y + dy, { face: dir as 1 | -1, h: HERO_DRAW_H, time, air: true }); }
  }
  if (t >= 0.55 && t < 0.8) {
    c.fillStyle = `rgba(255,255,255,${0.8 - (t - 0.55) * 3.2})`; c.fillRect(0, 0, VIEW_W, VIEW_H);
    c.strokeStyle = 'rgba(255,240,220,0.9)'; c.lineWidth = 2;
    for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(-10, y - 30 + i * 18); c.lineTo(VIEW_W + 10, y - 50 + i * 22); c.stroke(); }
  }
  c.globalAlpha = Math.min(1, t * 5, (DUO_T - t) * 4);
  c.font = `900 18px ${DISPLAY}`; c.textAlign = 'center';
  c.lineWidth = 4; c.strokeStyle = '#1a0820'; c.strokeText('DUO STRIKE!', VIEW_W / 2, 112 - k * 6);
  const gr = c.createLinearGradient(0, 94, 0, 114); gr.addColorStop(0, '#fff6d0'); gr.addColorStop(1, '#e8a840');
  c.fillStyle = gr; c.fillText('DUO STRIKE!', VIEW_W / 2, 112 - k * 6);
  c.globalAlpha = 1;
}

// ─── Effects and light ────────────────────────────────────────────────────

/** Effects that sit in the world and are lit like it: dust, rubble, ash. */
function drawDustFx(c: C, g: FluffstevaniaGame) {
  for (const f of g.fx) {
    if (f.t < 0) continue;
    const k = f.t / FX_LIFE[f.kind];
    switch (f.kind) {
      case 'dust': c.fillStyle = `rgba(235,225,205,${0.6 - k * 0.6})`; ellipse(c, f.x, f.y, 2 + k * 4, 1.5 + k * 2.5); c.fill(); break;
      case 'rubble': c.fillStyle = `rgba(110,100,120,${1 - k})`; c.fillRect(f.x - 1.5, f.y - 1.5, 3, 3); break;
      case 'feather': c.fillStyle = `rgba(138,112,80,${1 - k})`; ellipse(c, f.x, f.y, 4, 1.5, f.t * 8); c.fill(); break;
      case 'ash': c.fillStyle = f.color ?? '#aaa'; c.globalAlpha = Math.max(0, 1 - k); c.fillRect(f.x - 1, f.y - 1, 1.6 + (1 - k), 1.6 + (1 - k)); c.globalAlpha = 1; break;
      case 'shard': {
        // An angular chip of stone tumbling back down.
        c.save(); c.translate(f.x, f.y); c.rotate(f.t * 14 * Math.sign(f.vx || 1)); c.globalAlpha = Math.min(1, (1 - k) * 2);
        c.fillStyle = '#6e6c7a'; c.beginPath(); c.moveTo(-2.2, -1); c.lineTo(0, -2.4); c.lineTo(2.4, -0.4); c.lineTo(0.6, 2); c.lineTo(-1.8, 1.4); c.fill();
        c.fillStyle = '#b8b6c6'; c.beginPath(); c.moveTo(-2.2, -1); c.lineTo(0, -2.4); c.lineTo(0.8, -0.6); c.fill();
        c.restore();
        break;
      }
      case 'fur': {
        // A tuft of loose fur, curling as it drifts.
        const pale = f.color === 'dora';
        c.save(); c.translate(f.x, f.y); c.rotate(f.t * 6); c.globalAlpha = 0.9 * (1 - k);
        c.strokeStyle = pale ? '#fbf8f3' : '#9a98a4'; c.lineWidth = 0.9; c.lineCap = 'round';
        c.beginPath(); c.moveTo(-2, 0); c.quadraticCurveTo(0, -2, 2, 0); c.moveTo(-1.5, 1); c.quadraticCurveTo(0.5, -0.5, 2.2, 1.4); c.stroke();
        c.restore();
        break;
      }
    }
  }
}
/** Bright effects drawn over the darkness: sparks, slashes, bursts, stars and damage numbers. */
function drawGlowFx(c: C, g: FluffstevaniaGame) {
  for (const f of g.fx) {
    if (f.t < 0) continue;
    const k = f.t / FX_LIFE[f.kind];
    switch (f.kind) {
      case 'spark': {
        // A white-hot core, then gold streaks spraying the way the blow travelled (all round if it had no direction).
        c.fillStyle = `rgba(255,255,255,${0.9 - k})`; ellipse(c, f.x, f.y, 5 * (1 - k) + 1, 5 * (1 - k) + 1); c.fill();
        const d = f.vx;
        c.lineCap = 'round';
        for (let i = 0; i < 7; i++) {
          const spread = d ? (hash(i, Math.round(f.x)) - 0.5) * 1.6 : i * 0.9, a = d ? (d > 0 ? 0 : Math.PI) + spread : spread;
          const len = d ? 8 + hash(Math.round(f.y), i) * 14 : 10, r0 = 2 + k * len * 0.9, r1 = 2 + k * len * 0.9 + (1 - k) * 6 + 2;
          c.strokeStyle = i % 2 ? `rgba(255,255,255,${1 - k})` : `rgba(255,214,110,${1 - k})`; c.lineWidth = 1.4 * (1 - k) + 0.4;
          c.beginPath(); c.moveTo(f.x + Math.cos(a) * r0, f.y + Math.sin(a) * r0); c.lineTo(f.x + Math.cos(a) * r1, f.y + Math.sin(a) * r1); c.stroke();
        }
        c.lineCap = 'butt';
        break;
      }
      case 'claw': {
        // Three raking claw marks hang in the air a moment; a finisher's are gold.
        c.save(); c.translate(f.x, f.y); c.scale(f.vx || 1, 1); c.rotate(-0.9);
        const gold = f.vy > 0;
        for (let i = -1; i <= 1; i++) {
          const len = 11 + (i === 0 ? 3 : 0);
          c.fillStyle = gold ? `rgba(255,220,120,${1 - k})` : `rgba(215,235,255,${1 - k})`;
          c.beginPath(); c.moveTo(-len, i * 3.6); c.quadraticCurveTo(0, i * 3.6 - 2 * (1 - k), len, i * 3.6 + 1); c.quadraticCurveTo(0, i * 3.6 + 0.6, -len, i * 3.6); c.fill();
        }
        c.restore();
        break;
      }
      case 'ember': {
        const a = Math.max(0, 1 - k);
        c.fillStyle = `rgba(255,${Math.round(200 - k * 120)},${Math.round(90 - k * 60)},${a})`; c.fillRect(f.x - 0.8, f.y - 0.8, 1.6, 1.6);
        c.fillStyle = `rgba(255,150,60,${a * 0.3})`; ellipse(c, f.x, f.y, 2.6, 2.6); c.fill();
        break;
      }
      case 'pillar': {
        // Level up: a column of light pours down on the heroes and motes stream up through it.
        const a = k < 0.15 ? k / 0.15 : Math.max(0, 1 - (k - 0.15) / 0.85), wdt = 14 + Math.sin(k * 20) * 1.5;
        const gr = c.createLinearGradient(f.x - wdt, 0, f.x + wdt, 0);
        gr.addColorStop(0, 'rgba(255,240,180,0)'); gr.addColorStop(0.5, `rgba(255,248,215,${0.5 * a})`); gr.addColorStop(1, 'rgba(255,240,180,0)');
        c.fillStyle = gr; c.fillRect(f.x - wdt, g.cam.y - 10, wdt * 2, f.y - g.cam.y + 12);
        c.strokeStyle = `rgba(255,236,160,${0.8 * a})`; c.lineWidth = 1; ellipse(c, f.x, f.y, 14 + k * 10, 3 + k * 2); c.stroke();
        for (let i = 0; i < 10; i++) {
          const u = (k * 1.6 + i / 10) % 1;
          c.fillStyle = `rgba(255,255,230,${a * (1 - u)})`; c.fillRect(f.x + Math.sin(i * 2.3 + k * 8) * 9, f.y - u * 90, 1.4, 1.4);
        }
        c.globalAlpha = a; c.font = `900 11px ${DISPLAY}`; c.textAlign = 'center';
        const ty = f.y - 40 - Math.min(1, k * 4) * 10;
        c.lineWidth = 3; c.strokeStyle = '#2a1030'; c.strokeText('LEVEL UP', f.x, ty);
        const tg = c.createLinearGradient(0, ty - 10, 0, ty); tg.addColorStop(0, '#fffbe0'); tg.addColorStop(1, '#e8b040');
        c.fillStyle = tg; c.fillText('LEVEL UP', f.x, ty);
        c.globalAlpha = 1;
        break;
      }
      case 'slash': {
        c.save(); c.translate(f.x, f.y); c.scale(f.vx || 1, 1); c.rotate(-0.5);
        c.fillStyle = `rgba(255,255,255,${1 - k})`;
        c.beginPath(); c.moveTo(-12 - k * 6, 0); c.quadraticCurveTo(0, -3 * (1 - k), 12 + k * 6, 0); c.quadraticCurveTo(0, 1.2, -12 - k * 6, 0); c.fill();
        c.restore();
        break;
      }
      case 'poof':
        for (let i = 0; i < 6; i++) { const a = i * 1.05; c.fillStyle = `rgba(220,200,240,${0.7 - k * 0.7})`; ellipse(c, f.x + Math.cos(a) * k * 16, f.y + Math.sin(a) * k * 12, 4 - k * 3, 4 - k * 3); c.fill(); }
        break;
      case 'clink': c.strokeStyle = `rgba(200,220,255,${1 - k})`; c.lineWidth = 1.5; c.beginPath(); c.arc(f.x, f.y, 3 + k * 8, -1, 1); c.stroke(); break;
      case 'flame': c.fillStyle = `rgba(255,170,60,${0.8 - k * 0.8})`; ellipse(c, f.x, f.y - k * 6, 3 - k * 2, 5 - k * 3); c.fill(); break;
      case 'boom': {
        const gr = c.createRadialGradient(f.x, f.y, 0, f.x, f.y, 6 + k * 18);
        gr.addColorStop(0, `rgba(255,240,200,${1 - k})`); gr.addColorStop(1, 'rgba(255,120,40,0)');
        c.fillStyle = gr; ellipse(c, f.x, f.y, 6 + k * 18, 6 + k * 18); c.fill();
        break;
      }
      case 'star':
        c.fillStyle = `rgba(255,220,90,${1 - k})`;
        for (let i = 0; i < 5; i++) { const a = i * 1.256 + k * 2; star(c, f.x + Math.cos(a) * k * 20, f.y + Math.sin(a) * k * 20, 2); }
        break;
      case 'hop':
        c.strokeStyle = `rgba(210,230,255,${0.9 - k})`; c.lineWidth = 1.5; ellipse(c, f.x, f.y, 4 + k * 12, 1.5 + k * 3); c.stroke();
        break;
    }
  }
  // Dust motes on their way to the lead, with little tails.
  for (const o of g.orbs) {
    const tail = Math.min(1, Math.hypot(o.vx, o.vy) / 300) * 8, d = Math.hypot(o.vx, o.vy) || 1;
    const gr = c.createLinearGradient(o.x, o.y, o.x - (o.vx / d) * tail, o.y - (o.vy / d) * tail);
    gr.addColorStop(0, 'rgba(210,190,255,0.8)'); gr.addColorStop(1, 'rgba(140,100,240,0)');
    c.strokeStyle = gr; c.lineWidth = 2; c.lineCap = 'round';
    c.beginPath(); c.moveTo(o.x, o.y); c.lineTo(o.x - (o.vx / d) * tail, o.y - (o.vy / d) * tail); c.stroke(); c.lineCap = 'butt';
    const glow = c.createRadialGradient(o.x, o.y, 0, o.x, o.y, 4);
    glow.addColorStop(0, '#ffffff'); glow.addColorStop(0.5, 'rgba(200,170,255,0.9)'); glow.addColorStop(1, 'rgba(140,100,240,0)');
    c.fillStyle = glow; ellipse(c, o.x, o.y, 4, 4); c.fill();
  }
  c.textAlign = 'center';
  for (const p of g.pops) {
    // Numbers pop in large, bounce once as they settle, then fade. Big blows show bigger and in gold.
    const grow = p.t < 0.08 ? 1.6 - p.t * 7.5 : 1, crit = p.color === '#ffd35a', size = (p.big ? 13 : crit ? 11 : 9) * grow;
    const hop = p.t < 0.4 ? Math.abs(Math.sin((p.t / 0.4) * Math.PI * 1.5)) * (1 - p.t / 0.4) * 6 : 0;
    c.globalAlpha = Math.min(1, (0.9 - p.t) * 4);
    c.font = `900 ${size.toFixed(1)}px ${DISPLAY}`;
    c.lineWidth = p.big ? 3.6 : 3; c.strokeStyle = '#140818'; c.strokeText(p.text, p.x, p.y - hop);
    if (p.big) {
      const gr = c.createLinearGradient(0, p.y - hop - size, 0, p.y - hop);
      gr.addColorStop(0, '#fffbe0'); gr.addColorStop(1, '#e8a030');
      c.fillStyle = gr;
    } else c.fillStyle = p.color;
    c.fillText(p.text, p.x, p.y - hop);
  }
  c.globalAlpha = 1;
}

type Light = { x: number; y: number; r: number; a: number; tint?: string };
let lightCv: HTMLCanvasElement | null = null;
function gatherLights(g: FluffstevaniaGame, time: number): Light[] {
  const out: Light[] = [];
  for (const k of g.candles) if (k.alive) out.push({ x: k.x, y: k.y - 11, r: 54 + Math.sin(time * 9 + k.x) * 3, a: 1, tint: '#ffb050' });
  const room = g.room;
  for (let r = 0; r < room.rows.length; r++) for (let cc = 0; cc < room.rows[r].length; cc++) {
    const ch = room.rows[r][cc], x = (room.mx * COLS + cc + 0.5) * TILE, y = (room.my * ROWS + r + 1) * TILE;
    if (ch === 'S') out.push({ x, y: y - 20, r: 76, a: 1, tint: '#ffd880' });
    else if (ch === '$') out.push({ x, y: y - 18, r: 70, a: 1, tint: '#ffc070' });
  }
  const b = g.body;
  out.push({ x: b.x, y: b.y - 12, r: 72, a: 0.55 });
  out.push({ x: g.follower.x, y: g.follower.y - 12, r: 40, a: 0.35 });
  for (const p of g.pickups) if (p.fixed || p.kind === 'relic' || p.kind === 'leaf') out.push({ x: p.x, y: p.y - 5, r: 34, a: 0.8, tint: p.kind === 'relic' ? '#a0d0ff' : '#ffe090' });
  for (const e of g.enemies) if (e.kind === 'ghost' && !e.dead && !ghostFaded(e)) out.push({ x: e.x, y: e.y - 14, r: 40, a: 0.7, tint: '#90ffc0' });
  for (const f of g.fx) if ((f.kind === 'boom' || f.kind === 'flame' || f.kind === 'spark') && f.t >= 0) out.push({ x: f.x, y: f.y, r: f.kind === 'spark' ? 26 : 40, a: 1 - f.t / FX_LIFE[f.kind], tint: '#ffc080' });
  if (g.boss) out.push({ x: g.boss.x, y: g.boss.y, r: 60, a: 0.35 });
  for (const s of g.shots) {
    if (s.kind === 'flame') out.push({ x: s.x, y: s.y, r: 30, a: 0.8, tint: '#ff9040' });
    else if (s.kind === 'fire') out.push({ x: s.x, y: s.y, r: 36, a: 0.9, tint: '#ff7030' });
    else if (s.kind === 'wind') out.push({ x: s.x, y: s.y, r: 34, a: 0.4 });
    else if (s.kind === 'quake' && s.hero) out.push({ x: s.x, y: s.y, r: s.spell ? 46 : 34, a: 0.8, tint: s.spell ? '#d0a8ff' : '#ffd070' });
    else if (s.kind === 'petal') out.push({ x: s.x, y: s.y, r: 22, a: 0.5, tint: '#ff90c8' });
    else if (s.kind === 'chime') out.push({ x: s.x, y: s.y, r: 30, a: 0.6, tint: '#ffe090' });
    else if (s.kind === 'note') out.push({ x: s.x, y: s.y, r: 18, a: 0.4, tint: '#ffe0a0' });
  }
  for (const o of g.orbs) out.push({ x: o.x, y: o.y, r: 16, a: 0.6, tint: '#b890ff' });
  for (const e of g.enemies) if (e.dead) out.push({ x: e.x, y: e.y - FOES[e.kind].h / 2, r: 34, a: 1 - e.dead / BURN_T, tint: '#ff9a40' });
  for (const f of g.fx) if (f.kind === 'pillar' && f.t >= 0) out.push({ x: f.x, y: f.y - 30, r: 90, a: 1 - f.t / FX_LIFE.pillar, tint: '#fff0b0' });
  if (g.pal) out.push({ x: g.palBody.x, y: g.palBody.y - 6, r: 26, a: 0.35 });
  if (g.body.rollT > 0) out.push({ x: g.body.x, y: g.body.y - 10, r: 40, a: 0.6, tint: '#c8a8ff' });
  return out;
}
/** Darken the view everywhere except around lights, then add a warm glow around the flames. */
function drawLighting(c: C, g: FluffstevaniaGame, time: number) {
  const t = THEMES[g.room.area], lights = gatherLights(g, time);
  lightCv ??= canvas(VIEW_W, VIEW_H);
  const l = lightCv.getContext('2d')!;
  l.globalCompositeOperation = 'source-over'; l.clearRect(0, 0, VIEW_W, VIEW_H);
  const [r, gg, bb, a] = t.dark;
  l.fillStyle = `rgba(${r},${gg},${bb},${a})`; l.fillRect(0, 0, VIEW_W, VIEW_H);
  l.globalCompositeOperation = 'destination-out';
  for (const L of lights) {
    const x = L.x - g.cam.x, y = L.y - g.cam.y;
    if (x < -L.r || x > VIEW_W + L.r || y < -L.r || y > VIEW_H + L.r) continue;
    const gr = l.createRadialGradient(x, y, 0, x, y, L.r);
    gr.addColorStop(0, `rgba(0,0,0,${L.a})`); gr.addColorStop(0.5, `rgba(0,0,0,${L.a * 0.6})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
    l.fillStyle = gr; l.fillRect(x - L.r, y - L.r, L.r * 2, L.r * 2);
  }
  c.drawImage(lightCv, 0, 0, VIEW_W, VIEW_H);
  c.save();
  c.globalCompositeOperation = 'lighter';
  for (const L of lights) {
    if (!L.tint) continue;
    const x = L.x - g.cam.x, y = L.y - g.cam.y, rr = L.r * 0.45;
    if (x < -rr || x > VIEW_W + rr || y < -rr || y > VIEW_H + rr) continue;
    const gr = c.createRadialGradient(x, y, 0, x, y, rr);
    gr.addColorStop(0, rgba(L.tint, 0.22 * L.a)); gr.addColorStop(1, rgba(L.tint, 0));
    c.fillStyle = gr; c.fillRect(x - rr, y - rr, rr * 2, rr * 2);
  }
  c.restore();
}

// ─── The HUD ──────────────────────────────────────────────────────────────

/** A dark panel with a double gold border and little diamonds at the corners. */
function frame(c: C, x: number, y: number, w: number, h: number) {
  const bg = c.createLinearGradient(0, y, 0, y + h);
  bg.addColorStop(0, 'rgba(26,12,34,0.82)'); bg.addColorStop(1, 'rgba(10,4,16,0.82)');
  c.fillStyle = bg; c.fillRect(x, y, w, h);
  c.strokeStyle = '#6a4a20'; c.lineWidth = 1; c.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  c.strokeStyle = '#e0bc68'; c.lineWidth = 0.5; c.strokeRect(x + 2, y + 2, w - 4, h - 4);
  c.fillStyle = '#f0d080';
  for (const [cx, cy] of [[x, y], [x + w, y], [x, y + h], [x + w, y + h]]) { c.beginPath(); c.moveTo(cx, cy - 2.5); c.lineTo(cx + 2.5, cy); c.lineTo(cx, cy + 2.5); c.lineTo(cx - 2.5, cy); c.fill(); }
}
function bar(c: C, x: number, y: number, w: number, h: number, v: number, max: number, from: string, to: string) {
  const k = Math.max(0, Math.min(1, v / max));
  c.fillStyle = '#6a4a20'; c.fillRect(x - 1.5, y - 1.5, w + 3, h + 3);
  c.fillStyle = '#e0bc68'; c.fillRect(x - 1, y - 1, w + 2, h + 2);
  c.fillStyle = '#12080e'; c.fillRect(x, y, w, h);
  const gr = c.createLinearGradient(0, y, 0, y + h);
  gr.addColorStop(0, from); gr.addColorStop(1, to);
  c.fillStyle = gr; c.fillRect(x, y, w * k, h);
  c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(x, y, w * k, Math.max(0.6, h * 0.25));
}
function portrait(c: C, id: HeroId, x: number, y: number, r: number, time: number, down: boolean) {
  c.save();
  // An ornate ring with little points around it.
  c.fillStyle = '#e0bc68';
  for (let i = 0; i < 12; i++) { const a = (i * Math.PI) / 6; c.beginPath(); c.moveTo(x + Math.cos(a - 0.12) * (r + 1), y + Math.sin(a - 0.12) * (r + 1)); c.lineTo(x + Math.cos(a) * (r + 3.4), y + Math.sin(a) * (r + 3.4)); c.lineTo(x + Math.cos(a + 0.12) * (r + 1), y + Math.sin(a + 0.12) * (r + 1)); c.fill(); }
  c.fillStyle = '#6a4a20'; ellipse(c, x, y, r + 1.8, r + 1.8); c.fill();
  c.fillStyle = '#e0bc68'; ellipse(c, x, y, r + 1.1, r + 1.1); c.fill();
  const bg = c.createRadialGradient(x, y - r * 0.3, 1, x, y, r);
  bg.addColorStop(0, id === 'dora' ? '#5a3a70' : '#3a4a70'); bg.addColorStop(1, '#140a1c');
  c.fillStyle = bg; ellipse(c, x, y, r, r); c.fill();
  c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.clip();
  if (down) c.globalAlpha = 0.35;
  // Frame the head: it sits at about (12, -14) in the drawing's 24-unit frame.
  const s = (r * 3.2) / 24;
  drawChinchilla(c, id as ChinId, x - 12 * s * 0.95, y + 14.5 * s, { face: 1, h: r * 3.2, time });
  c.restore();
}

let trailBoss: Boss | null = null, trailHp = 0, trailHold = 0, trailT = 0;
function drawHud(c: C, g: FluffstevaniaGame, time: number) {
  const lead = g.leader, part = g.partner, ls = g.stats(lead), ps = g.stats(part);
  frame(c, 4, 4, 150, 40);
  portrait(c, lead, 23, 24, 13, time, false);
  c.textAlign = 'left'; c.font = `700 7px ${DISPLAY}`; c.fillStyle = '#f0dca0';
  c.fillText(lead === 'dora' ? 'DORA' : 'ENZO', 42, 13);
  c.textAlign = 'right'; c.fillStyle = '#c8b8e0'; c.font = `700 6px ${DISPLAY}`; c.fillText(`LV ${g.level}`, 148, 13);
  const low = g.hp[lead] / ls.maxHp < 0.3, pulse = low ? 0.7 + Math.sin(time * 10) * 0.3 : 1;
  bar(c, 42, 16, 104, 5, g.hp[lead], ls.maxHp, low ? `rgba(255,90,90,${pulse})` : '#ff6a6a', low ? '#8a1020' : '#a01830');
  // Dust, for spells.
  bar(c, 42, 24, 60, 2.5, g.mp, g.maxMp, '#c8a8ff', '#5a38b0');
  c.textAlign = 'right'; c.font = `700 6px ${DISPLAY}`; c.lineWidth = 2; c.strokeStyle = '#140818';
  c.strokeText(`${g.hp[lead]} / ${ls.maxHp}`, 146, 28); c.fillStyle = '#f8ecd8'; c.fillText(`${g.hp[lead]} / ${ls.maxHp}`, 146, 28);
  // The partner, smaller, with the tag cooldown around their portrait.
  portrait(c, part, 47, 35, 5, time, g.hp[part] <= 0);
  bar(c, 56, 33, 44, 3, g.hp[part], ps.maxHp, '#80b0ff', '#2a4aa0');
  if (g.tagCd > 0) { c.strokeStyle = '#ffd860'; c.lineWidth = 1.2; c.beginPath(); c.arc(47, 35, 8, -Math.PI / 2, -Math.PI / 2 + (1 - g.tagCd / TAG_CD) * Math.PI * 2); c.stroke(); }
  c.textAlign = 'left'; c.fillStyle = g.hp[part] > 0 ? (g.tagCd > 0 ? '#9a90b0' : '#ffe8a0') : '#a07080'; c.font = `700 5px ${DISPLAY}`;
  c.fillText(g.hp[part] > 0 ? (g.tagCd > 0 ? 'TAG…' : 'TAG ✦ READY') : 'RESTING', 104, 37);
  // Raisins, the sub-weapon and its seeds, and the Duo meter on a plaque below.
  frame(c, 4, 47, 150, 13);
  c.fillStyle = '#6a2c50'; ellipse(c, 12, 53.5, 3, 2.4); c.fill();
  c.fillStyle = '#9a4c78'; ellipse(c, 11, 52.8, 1, 0.7); c.fill();
  c.font = `700 6px ${DISPLAY}`; c.fillStyle = '#f0e8d8'; c.fillText(`${g.raisins}`, 17, 56);
  subIcon(c, g.sub, 44, 53.5, 0.8);
  c.fillStyle = g.seeds >= SUBS[g.sub].cost ? '#f0e8d8' : '#c07070'; c.fillText(`${g.seeds}`, 50, 56);
  const ready = g.duo >= DUO_MAX;
  c.fillStyle = ready ? `rgba(255,224,120,${0.75 + Math.sin(time * 8) * 0.25})` : '#c8b8e0'; c.font = `700 5px ${DISPLAY}`; c.fillText('DUO', 70, 56);
  bar(c, 85, 52, 64, 3, g.duo, DUO_MAX, ready ? '#fff0a0' : '#f0c060', '#a06a18');
  minimap(c, g, VIEW_W - 72, 7, time);
  if (g.boss) {
    const o = g.boss, k = BOSSES[o.kind], w = 220, x = (VIEW_W - w) / 2, y = VIEW_H - 15;
    // The bar drains in two steps: the lost health lingers pale for a moment, then slides away.
    if (trailBoss !== o) { trailBoss = o; trailHp = o.hp; trailHold = 0; }
    const dt = Math.min(0.1, Math.max(0, time - trailT)); trailT = time;
    if (o.hp < trailHp) { trailHold += dt; if (trailHold > 0.5) trailHp = Math.max(o.hp, trailHp - o.max * 0.5 * dt); } else { trailHp = o.hp; trailHold = 0; }
    frame(c, x - 16, y - 13, w + 32, 24);
    c.font = `700 7px ${DISPLAY}`; c.textAlign = 'center'; c.fillStyle = '#f0c8a0'; c.fillText(k.name.toUpperCase(), VIEW_W / 2, y - 3);
    bar(c, x, y + 1, w, 5, o.hp, o.max, o.phase2 ? '#ff7050' : '#e0a050', o.phase2 ? '#901810' : '#8a4a10');
    if (trailHp > o.hp) { c.fillStyle = 'rgba(255,240,220,0.75)'; c.fillRect(x + (w * o.hp) / o.max, y + 1, (w * (trailHp - o.hp)) / o.max, 5); }
    // Notches every tenth, and a diamond at half where the second phase begins.
    c.fillStyle = 'rgba(20,8,14,0.6)'; for (let i = 1; i < 10; i++) c.fillRect(x + (w * i) / 10 - 0.3, y + 1, 0.6, 5);
    c.fillStyle = o.phase2 ? '#ff9070' : '#f0d080'; c.beginPath(); c.moveTo(x + w / 2, y - 1.5); c.lineTo(x + w / 2 + 2.5, y + 1); c.lineTo(x + w / 2, y + 3.5); c.lineTo(x + w / 2 - 2.5, y + 1); c.fill();
    // Spiked end caps with a skull at each end.
    c.fillStyle = '#e0bc68';
    for (const [ex, d] of [[x - 2, -1], [x + w + 2, 1]] as const) { c.beginPath(); c.moveTo(ex, y - 0.5); c.lineTo(ex + d * 5, y + 3.5); c.lineTo(ex, y + 7.5); c.fill(); }
    skull(c, x - 10, y + 3.5, 0.55, '#e8e0d0'); skull(c, x + w + 10, y + 3.5, 0.55, '#e8e0d0');
  }
  if (g.banner) {
    const a = Math.min(1, g.banner.t * 1.5, (2.4 - g.banner.t) * 3);
    c.globalAlpha = a;
    const cx = VIEW_W / 2, y = 72;
    const bg = c.createLinearGradient(cx - 110, 0, cx + 110, 0);
    bg.addColorStop(0, 'rgba(10,4,16,0)'); bg.addColorStop(0.2, 'rgba(10,4,16,0.75)'); bg.addColorStop(0.8, 'rgba(10,4,16,0.75)'); bg.addColorStop(1, 'rgba(10,4,16,0)');
    c.fillStyle = bg; c.fillRect(cx - 110, y - 16, 220, 26);
    c.strokeStyle = '#d8b060'; c.lineWidth = 0.6;
    for (const dy of [-13, 7]) {
      c.beginPath(); c.moveTo(cx - 90, y + dy); c.lineTo(cx - 8, y + dy); c.moveTo(cx + 8, y + dy); c.lineTo(cx + 90, y + dy); c.stroke();
      c.fillStyle = '#f0d080'; c.beginPath(); c.moveTo(cx, y + dy - 2.5); c.lineTo(cx + 3, y + dy); c.lineTo(cx, y + dy + 2.5); c.lineTo(cx - 3, y + dy); c.fill();
      for (const s of [-1, 1]) { c.beginPath(); c.arc(cx + s * 94, y + dy, 3, 0, Math.PI * 2); c.stroke(); }
    }
    c.font = `700 12px ${DISPLAY}`; c.textAlign = 'center'; c.fillStyle = '#f4e0a8'; c.fillText(g.banner.text, cx, y + 2);
    c.globalAlpha = 1;
  }
  if (g.toast) {
    c.font = `700 8px ${BOOK}`; c.textAlign = 'center';
    const w = Math.min(VIEW_W - 20, c.measureText(g.toast.text).width + 18), y = g.boss ? VIEW_H - 40 : VIEW_H - 20;
    c.globalAlpha = Math.min(1, g.toast.t * 3);
    frame(c, (VIEW_W - w) / 2, y - 10, w, 15);
    c.fillStyle = '#f8ecd0'; c.fillText(g.toast.text, VIEW_W / 2, y);
    c.globalAlpha = 1;
  }
  const prompt = g.prompt;
  if (prompt && !g.dialog && !g.shop) {
    const b = g.body, x = b.x - g.cam.x, y = b.y - g.cam.y - 34 + Math.sin(time * 5) * 1.5;
    c.font = `700 6px ${DISPLAY}`; c.textAlign = 'center';
    frame(c, x - 19, y - 8, 38, 11);
    c.fillStyle = '#ffe0a0'; c.fillText(`↑ ${prompt}`, x, y);
  }
}

/** Everything the maps mark. */
export type MapMark = 'you' | 'shrine' | 'shop' | 'boss' | 'bossDown' | 'relic' | 'item' | 'sub' | 'leaf' | 'pal' | 'lock';
export const MAP_LEGEND: [MapMark, string][] = [
  ['you', 'You are here'], ['shrine', 'Dust-bath shrine'], ['shop', "Pip's stall"], ['boss', 'Guardian'], ['bossDown', 'Guardian beaten'],
  ['relic', 'Relic'], ['item', 'Treasure'], ['sub', 'Sub-weapon'], ['leaf', 'Wolfberry Leaf'], ['pal', 'Familiar'], ['lock', 'Sealed door'],
];
/** A map icon centred on (x, y), about 10·s pixels across. */
export function mapIcon(c: C, kind: MapMark, x: number, y: number, s: number, time = 0) {
  c.save(); c.translate(x, y); c.scale(s, s);
  const outline = () => { c.lineWidth = 1.6; c.strokeStyle = '#0c0714'; c.stroke(); };
  switch (kind) {
    case 'you': {
      const k = (time * 1.5) % 1;
      c.strokeStyle = `rgba(255,255,255,${1 - k})`; c.lineWidth = 1; ellipse(c, 0, 0, 3 + k * 4, 3 + k * 4); c.stroke();
      ellipse(c, 0, 0, 3, 3); outline(); c.fillStyle = '#ffffff'; c.fill();
      c.fillStyle = '#e04860'; ellipse(c, 0, 0, 1.3, 1.3); c.fill();
      break;
    }
    case 'shrine':
      // A steaming dust-bath bowl.
      c.beginPath(); c.moveTo(-4.5, -0.5); c.quadraticCurveTo(0, 6, 4.5, -0.5); c.closePath(); outline(); c.fillStyle = '#f0c860'; c.fill();
      c.fillStyle = '#fff4d0'; c.fillRect(-4.5, -1.4, 9, 1.4);
      c.fillStyle = 'rgba(255,248,230,0.9)'; ellipse(c, -1.5, -3.2, 1.4, 1.1); c.fill(); ellipse(c, 1.4, -4.4, 1.2, 1); c.fill();
      break;
    case 'shop':
      // Pip's coin bag.
      c.beginPath(); c.moveTo(-2, -3); c.quadraticCurveTo(-5, 1, -3.6, 4); c.lineTo(3.6, 4); c.quadraticCurveTo(5, 1, 2, -3); c.closePath(); outline(); c.fillStyle = '#b08050'; c.fill();
      c.fillStyle = '#7a5030'; c.fillRect(-2.4, -3.6, 4.8, 1.2);
      c.fillStyle = '#ffd860'; ellipse(c, 0, 1.2, 1.8, 1.8); c.fill(); c.fillStyle = '#b08020'; c.fillRect(-0.3, 0, 0.6, 2.4);
      break;
    case 'boss': case 'bossDown': {
      ellipse(c, 0, -0.5, 4.6, 4.2); outline();
      skull(c, 0, -1, 0.85, kind === 'boss' ? '#f4ead8' : '#8a8494');
      if (kind === 'bossDown') { c.strokeStyle = '#e03040'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(-4, -4.5); c.lineTo(4, 3.5); c.moveTo(4, -4.5); c.lineTo(-4, 3.5); c.stroke(); }
      break;
    }
    case 'relic': {
      c.strokeStyle = 'rgba(200,230,255,0.9)'; c.lineWidth = 0.7;
      for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4 + time * 0.8; c.beginPath(); c.moveTo(Math.cos(a) * 3.2, Math.sin(a) * 3.2); c.lineTo(Math.cos(a) * 5, Math.sin(a) * 5); c.stroke(); }
      ellipse(c, 0, 0, 2.8, 2.8); outline(); c.fillStyle = '#e8f4ff'; c.fill();
      c.fillStyle = '#80b8f0'; ellipse(c, -0.8, -0.8, 1.2, 1.2); c.fill();
      break;
    }
    case 'item':
      // A little treasure chest.
      c.beginPath(); c.rect(-4, -2, 8, 5.5); outline(); c.fillStyle = '#9a6030'; c.fill();
      c.beginPath(); c.moveTo(-4, -2); c.quadraticCurveTo(0, -5.5, 4, -2); c.closePath(); outline(); c.fillStyle = '#b87838'; c.fill();
      c.fillStyle = '#f0c850'; c.fillRect(-4, -1.6, 8, 1); c.fillRect(-0.8, -1.2, 1.6, 2);
      break;
    case 'sub':
      // An acorn, for the sub-weapons.
      c.beginPath(); c.moveTo(-3, -0.5); c.quadraticCurveTo(-3, 3.4, 0, 4.6); c.quadraticCurveTo(3, 3.4, 3, -0.5); c.closePath(); outline(); c.fillStyle = '#d08a40'; c.fill();
      ellipse(c, 0, -1, 3.8, 2); outline(); c.fillStyle = '#6a4020'; c.fill();
      c.fillStyle = '#4a2c14'; c.fillRect(-0.4, -4.4, 0.8, 1.8);
      break;
    case 'leaf':
      ellipse(c, 0, 0, 2.8, 4.6, 0.5); outline(); c.fillStyle = '#8ac048'; c.fill();
      c.fillStyle = '#e8d060'; ellipse(c, -0.4, -0.4, 1.2, 3, 0.5); c.fill();
      break;
    case 'pal':
      // A paw print.
      ellipse(c, 0, 1.5, 2.6, 2.2); outline(); c.fillStyle = '#f0b0c8'; c.fill();
      for (const [px, py] of [[-2.8, -1.6], [-1, -3.4], [1, -3.4], [2.8, -1.6]]) { ellipse(c, px, py, 1.1, 1.3); outline(); c.fillStyle = '#f0b0c8'; c.fill(); }
      break;
    case 'lock':
      c.beginPath(); c.arc(0, -1.4, 2.2, Math.PI, 0); c.lineWidth = 2.6; c.strokeStyle = '#0c0714'; c.stroke(); c.lineWidth = 1.1; c.strokeStyle = '#c8c8d8'; c.stroke();
      c.beginPath(); c.rect(-3.2, -1.4, 6.4, 5); outline(); c.fillStyle = '#e0b040'; c.fill();
      c.fillStyle = '#3a2410'; ellipse(c, 0, 0.6, 0.8, 0.8); c.fill(); c.fillRect(-0.3, 0.8, 0.6, 1.6);
      break;
  }
  c.restore();
}

/**
 * The marks in a room for the map, each at its place in map cells (fractional), only where the cell it sits in has
 * been visited. Treasure disappears once taken, familiars once befriended, seals once broken.
 */
function roomMarks(g: FluffstevaniaGame, room: Room) {
  const out: { kind: MapMark; mx: number; my: number }[] = [];
  let item = 0, lockDone = false;
  for (let r = 0; r < room.rows.length; r++) for (let cc = 0; cc < room.rows[r].length; cc++) {
    const ch = room.rows[r][cc], mx = room.mx + cc / COLS, my = room.my + (r + 0.5) / ROWS;
    if (!g.visited.has(`${Math.floor(mx)},${Math.floor(my)}`)) { if (ch === 'I') item++; continue; }
    let kind: MapMark | null = null;
    if (ch === 'S') kind = 'shrine';
    else if (ch === '$') kind = 'shop';
    else if (ch === 'O' && room.boss) kind = g.flags.has(`boss:${room.boss}`) ? 'bossDown' : 'boss';
    else if (ch === 'R' && room.relic && !g.relics.has(room.relic)) kind = 'relic';
    else if (ch === 'I') { if (room.items?.[item] && !g.flags.has(`item:${room.id}:${item}`)) kind = 'item'; item++; }
    else if (ch === 'U' && room.sub && !g.subs.has(room.sub)) kind = 'sub';
    else if (ch === 'H' && !g.flags.has(`leaf:${room.id}`)) kind = 'leaf';
    else if ((ch === 'P' && !g.pals.pudding) || (ch === 'Z' && !g.pals.zippy) || (ch === 'Y' && !g.pals.mochi) || (ch === 'C' && !g.pals.nutmeg)) kind = 'pal';
    else if ((ch === 'W' && !g.flags.has('watch')) || (ch === 'T' && room.spell && !g.flags.has(`spell:${room.spell}`))) kind = 'item';
    else if (ch === 'D' && !lockDone && !(room.opens && g.flags.has(room.opens))) { kind = 'lock'; lockDone = true; }
    if (kind) out.push({ kind, mx, my });
  }
  return out;
}

function minimap(c: C, g: FluffstevaniaGame, x0: number, y0: number, time: number) {
  const cw = 9, ch = 6, span = 7, spanY = 5;
  const bx = Math.floor(g.body.x / VIEW_W), by = Math.floor((g.body.y - 10) / VIEW_H);
  frame(c, x0 - 4, y0 - 4, cw * span + 8, ch * spanY + 8);
  const seen = new Set<Room>();
  for (let dy = 0; dy < spanY; dy++) for (let dx = 0; dx < span; dx++) {
    const mx = bx - 3 + dx, my = by - 2 + dy;
    const room = ROOMS.find((r) => mx >= r.mx && mx < r.mx + r.w && my >= r.my && my < r.my + r.h);
    if (!room || !g.visited.has(`${mx},${my}`)) continue;
    seen.add(room);
    const px = x0 + dx * cw, py = y0 + dy * ch;
    c.fillStyle = room === g.room ? shade(AREAS[room.area].color, 0.75) : shade(AREAS[room.area].color, 0.5);
    c.fillRect(px, py, cw, ch);
    c.strokeStyle = '#d8e0f0'; c.lineWidth = 0.6;
    c.beginPath();
    if (mx === room.mx) { c.moveTo(px + 0.3, py); c.lineTo(px + 0.3, py + ch); }
    if (mx === room.mx + room.w - 1) { c.moveTo(px + cw - 0.3, py); c.lineTo(px + cw - 0.3, py + ch); }
    if (my === room.my) { c.moveTo(px, py + 0.3); c.lineTo(px + cw, py + 0.3); }
    if (my === room.my + room.h - 1) { c.moveTo(px, py + ch - 0.3); c.lineTo(px + cw, py + ch - 0.3); }
    c.stroke();
  }
  // Tiny icons for what's nearby, clipped to the frame.
  c.save(); c.beginPath(); c.rect(x0, y0, cw * span, ch * spanY); c.clip();
  for (const room of seen) for (const m of roomMarks(g, room)) {
    const px = x0 + (m.mx - (bx - 3)) * cw, py = y0 + (m.my - (by - 2)) * ch;
    mapIcon(c, m.kind, Math.min(Math.max(px, x0 + (Math.floor(m.mx) - bx + 3) * cw + 2.5), x0 + (Math.floor(m.mx) - bx + 4) * cw - 2.5), py, 0.42);
  }
  c.restore();
  if (Math.floor(time * 3) % 2 === 0) { c.fillStyle = '#ffffff'; c.fillRect(x0 + 3 * cw + 3, y0 + 2 * ch + 2, 3, 2); }
}

/** The map's size in CSS pixels at a readable 40 px per screen, and how far across it (0–1) the heroes are. */
export function mapLayout(g: FluffstevaniaGame) {
  const minX = Math.min(...ROOMS.map((r) => r.mx)), maxX = Math.max(...ROOMS.map((r) => r.mx + r.w));
  const minY = Math.min(...ROOMS.map((r) => r.my)), maxY = Math.max(...ROOMS.map((r) => r.my + r.h));
  const cell = 40;
  return { w: (maxX - minX) * cell + 24, h: Math.round((maxY - minY) * cell * 0.66) + 40, focus: (g.body.x / VIEW_W - minX) / (maxX - minX) };
}
/** The full castle map for the pause menu: rooms in their area's colour, area names, and icons for what's where. */
export function drawMap(c: C, g: FluffstevaniaGame, w: number, h: number, time: number) {
  c.fillStyle = '#0c0714'; c.fillRect(0, 0, w, h);
  const minX = Math.min(...ROOMS.map((r) => r.mx)), maxX = Math.max(...ROOMS.map((r) => r.mx + r.w));
  const minY = Math.min(...ROOMS.map((r) => r.my)), maxY = Math.max(...ROOMS.map((r) => r.my + r.h));
  const cell = Math.floor(Math.min((w - 20) / (maxX - minX), (h - 20) / (maxY - minY) / 0.66)), ch = Math.round(cell * 0.66);
  const ox = (w - cell * (maxX - minX)) / 2, oy = (h - ch * (maxY - minY)) / 2;
  const at = (mx: number, my: number) => [ox + (mx - minX) * cell, oy + (my - minY) * ch] as const;
  const areaCells = new Map<AreaId, [number, number][]>();
  for (const room of ROOMS) for (let dy = 0; dy < room.h; dy++) for (let dx = 0; dx < room.w; dx++) {
    const mx = room.mx + dx, my = room.my + dy;
    if (!g.visited.has(`${mx},${my}`)) continue;
    const list = areaCells.get(room.area) ?? []; list.push([mx, my]); areaCells.set(room.area, list);
    const [px, py] = at(mx, my);
    const fill = shade(AREAS[room.area].color, room === g.room ? 0.62 : 0.42);
    c.fillStyle = fill;
    c.fillRect(px, py, cell, ch);
    c.strokeStyle = '#e8ecf8'; c.lineWidth = 2;
    c.beginPath();
    if (dx === 0) { c.moveTo(px + 1, py); c.lineTo(px + 1, py + ch); }
    if (dx === room.w - 1) { c.moveTo(px + cell - 1, py); c.lineTo(px + cell - 1, py + ch); }
    if (dy === 0) { c.moveTo(px, py + 1); c.lineTo(px + cell, py + 1); }
    if (dy === room.h - 1) { c.moveTo(px, py + ch - 1); c.lineTo(px + cell, py + ch - 1); }
    c.stroke();
    // Doorways: gaps where the room opens into a neighbour.
    c.fillStyle = fill;
    const tc = mx * COLS, tr = my * ROWS;
    if (dx === 0 && !isSolid(rawTile(tc, tr + 10))) c.fillRect(px, py + ch * 0.35, 3, ch * 0.3);
    if (dx === room.w - 1 && !isSolid(rawTile(tc + COLS - 1, tr + 10))) c.fillRect(px + cell - 3, py + ch * 0.35, 3, ch * 0.3);
  }
  // Area names in the middle of each explored region, nudged apart where they'd overlap.
  c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `700 ${Math.max(8, Math.round(cell * 0.26))}px ${DISPLAY}`;
  const placed: { x: number; y: number; w: number }[] = [];
  for (const [area, cells] of areaCells) {
    const cx = cells.reduce((s, [x]) => s + x + 0.5, 0) / cells.length, cy = cells.reduce((s, [, y]) => s + y + 0.5, 0) / cells.length;
    const name = AREAS[area].name.toUpperCase(), tw = c.measureText(name).width + 6;
    const [px, py0] = at(cx, cy);
    let py = py0;
    for (let tries = 0; tries < 8 && placed.some((p) => Math.abs(p.x - px) < (p.w + tw) / 2 && Math.abs(p.y - py) < 11); tries++) py += tries % 2 ? 12 * (tries + 1) : -12 * (tries + 1);
    placed.push({ x: px, y: py, w: tw });
    c.lineWidth = 3; c.strokeStyle = 'rgba(12,7,20,0.95)'; c.strokeText(name, px, py);
    c.fillStyle = shade(AREAS[area].color, 1.3); c.fillText(name, px, py);
  }
  c.textBaseline = 'alphabetic';
  const s = Math.max(0.9, cell / 30);
  for (const room of ROOMS) for (const m of roomMarks(g, room)) {
    const [px, py] = at(m.mx, m.my), left = at(Math.floor(m.mx), 0)[0];
    mapIcon(c, m.kind, Math.min(Math.max(px, left + 6 * s), left + cell - 6 * s), py, s, time);
  }
  const [yx, yy] = at(g.body.x / VIEW_W, (g.body.y - 10) / VIEW_H);
  mapIcon(c, 'you', yx, yy, s, time);
}

// ─── Atmosphere ───────────────────────────────────────────────────────────

/**
 * The foreground: dark silhouettes (pillars, chains, roots, cobwebs, stalactites) that slide past in front of the
 * camera faster than the room does, for depth. They stay thin and sparse so they never hide a fight for long.
 */
const FW = VIEW_W * 3;
const fgCache = new Map<AreaId, HTMLCanvasElement>();
function foreground(area: AreaId) {
  const hit = fgCache.get(area);
  if (hit) return hit;
  const cv = canvas(FW, VIEW_H), c = cv.getContext('2d')!, ink = '#06030a';
  c.fillStyle = ink; c.strokeStyle = ink;
  const chain = (x: number, len: number) => {
    c.lineWidth = 1.2;
    for (let y = 0; y < len; y += 5) { ellipse(c, x, y + 2.5, y % 10 ? 1.2 : 2, 2.6); c.stroke(); }
  };
  const web = (x: number, flip: 1 | -1) => {
    c.lineWidth = 0.6;
    for (let i = 0; i < 5; i++) { const a = (i / 4) * (Math.PI / 2); c.beginPath(); c.moveTo(x, 0); c.lineTo(x + flip * Math.cos(a) * 34, Math.sin(a) * 34); c.stroke(); }
    for (let r = 8; r <= 32; r += 8) { c.beginPath(); for (let i = 0; i <= 4; i++) { const a = (i / 4) * (Math.PI / 2); const px = x + flip * Math.cos(a) * r, py = Math.sin(a) * r; if (i) c.quadraticCurveTo(x + flip * Math.cos(a - 0.2) * r * 0.85, Math.sin(a - 0.2) * r * 0.85, px, py); else c.moveTo(px, py); } c.stroke(); }
  };
  const tufts = (x0: number, x1: number) => {
    for (let x = x0; x < x1; x += 3) { const h = 6 + hash(x, 1) * 10; c.beginPath(); c.moveTo(x - 2, VIEW_H); c.quadraticCurveTo(x + 1, VIEW_H - h * 0.6, x + (hash(x, 2) - 0.5) * 6, VIEW_H - h); c.lineTo(x + 2, VIEW_H); c.fill(); }
  };
  if (area === 'approach') {
    // A gnarled tree trunk with a branch, hanging ivy and tall grass.
    c.beginPath(); c.moveTo(250, 0); c.lineTo(268, 0); c.quadraticCurveTo(262, 120, 272, VIEW_H); c.lineTo(244, VIEW_H); c.quadraticCurveTo(256, 120, 250, 0); c.fill();
    c.lineWidth = 5; c.beginPath(); c.moveTo(262, 40); c.quadraticCurveTo(300, 30, 340, 10); c.stroke();
    for (const x of [620, 660, 940]) { c.lineWidth = 1; c.beginPath(); c.moveTo(x, 0); c.quadraticCurveTo(x + 6, 30, x - 2, 44 + hash(x, 0) * 20); c.stroke(); for (let y = 8; y < 44; y += 7) { ellipse(c, x + 2, y, 2.4, 1.4, 0.6); c.fill(); } }
    tufts(40, 180); tufts(520, 700); tufts(880, 1100);
  } else if (area === 'hall') {
    // A carved column, a chandelier chain and a web in the corner of an arch.
    c.fillRect(420, 0, 20, VIEW_H); c.fillRect(414, 0, 32, 10); c.fillRect(414, VIEW_H - 12, 32, 12);
    chain(880, 56); c.beginPath(); c.moveTo(866, 60); c.quadraticCurveTo(880, 70, 894, 60); c.lineTo(880, 54); c.closePath(); c.fill();
    web(40, 1); web(1110, -1);
  } else if (area === 'cellar') {
    // A beam overhead, a meat hook, and barrels along the bottom.
    c.fillRect(640, 0, 300, 9);
    chain(300, 44); c.lineWidth = 1.6; c.beginPath(); c.arc(300, 50, 4, 0, Math.PI); c.stroke();
    for (const x of [120, 760, 1020]) { ellipse(c, x, VIEW_H + 4, 18, 16); c.fill(); }
    web(660, 1);
  } else if (area === 'belfry') {
    // Bell ropes and a great cog turning at the bottom corner (it's still, but reads as machinery).
    for (const x of [200, 760]) { c.lineWidth = 2; c.beginPath(); c.moveTo(x, 0); c.quadraticCurveTo(x + 4, VIEW_H * 0.5, x - 2, VIEW_H); c.stroke(); }
    const cx = 520, cy = VIEW_H + 10;
    c.beginPath(); for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2, r = i % 2 ? 40 : 46; c.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } c.closePath(); c.fill();
    c.fillRect(980, 0, 172, 8);
  } else if (area === 'clock') {
    // A great cog rising from the bottom, chains from above, and a girder across a corner.
    const cx = 300, cy = VIEW_H + 20;
    c.beginPath(); for (let i = 0; i < 28; i++) { const a = (i / 28) * Math.PI * 2, r = i % 2 ? 52 : 60; c.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } c.closePath(); c.fill();
    chain(760, 40); chain(1020, 70);
    c.lineWidth = 6; c.beginPath(); c.moveTo(0, 30); c.lineTo(90, 0); c.stroke(); c.fillRect(0, 26, 110, 6);
  } else if (area === 'library') {
    // The end of a bookcase, a lamp on a long chain, a ladder and a toppled pile of books.
    c.fillRect(380, 0, 22, VIEW_H); for (let y = 20; y < VIEW_H; y += 36) c.fillRect(372, y, 38, 4);
    chain(760, 50); c.beginPath(); c.moveTo(752, 52); c.lineTo(768, 52); c.lineTo(764, 64); c.lineTo(756, 64); c.closePath(); c.fill();
    c.lineWidth = 3; c.beginPath(); c.moveTo(980, VIEW_H); c.lineTo(1010, 60); c.moveTo(996, VIEW_H); c.lineTo(1026, 60); c.stroke();
    c.lineWidth = 2; for (let i = 0; i < 8; i++) { const t = VIEW_H - 16 - i * 20; const off = (VIEW_H - t) * 0.18; c.beginPath(); c.moveTo(980 + off, t); c.lineTo(996 + off, t); c.stroke(); }
    for (let i = 0; i < 5; i++) c.fillRect(120 + i * 3, VIEW_H - 6 - i * 5, 30 - i * 3, 5);
    web(40, 1);
  } else {
    // Stalactites drip from the top, bones heap at the bottom, and webs hang in the corners.
    for (let x = 10; x < FW - 20; x += 24) { if (hash(x, 4) < 0.45) continue; const h = 8 + hash(x, 6) * 22; c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 5 + hash(x, 7) * 4, h); c.lineTo(x + 12, 0); c.fill(); }
    for (const x of [300, 820]) { for (let i = 0; i < 7; i++) { ellipse(c, x + i * 7 - 20, VIEW_H - 2 - (i % 3) * 3, 6, 2.2, (i - 3) * 0.3); c.fill(); } skull(c, x, VIEW_H - 8, 1.1, ink); }
    web(560, 1); web(1080, -1);
  }
  fgCache.set(area, cv);
  return cv;
}
function drawForeground(c: C, g: FluffstevaniaGame) {
  const cv = foreground(g.room.area), ox = Math.round(-mod(g.cam.x * 1.35, FW));
  c.globalAlpha = 0.92;
  c.drawImage(cv, ox, 0, FW, VIEW_H); c.drawImage(cv, ox + FW, 0, FW, VIEW_H);
  c.globalAlpha = 1;
}

/** Water dripping from the ceiling in the cellar and catacombs, splashing where it lands. World coordinates. */
function drawDrips(c: C, g: FluffstevaniaGame, time: number) {
  const first = Math.floor(g.cam.x / 70);
  for (let col = first; col < first + 7; col++) {
    if (hash(col, 11) < 0.45) continue;
    const x = col * 70 + 10 + hash(col, 12) * 50, tc = Math.floor(x / TILE);
    let r = Math.floor(g.cam.y / TILE);
    const last = r + ROWS;
    while (r < last && !isSolid(g.tile(tc, r))) r++;
    while (r < last && isSolid(g.tile(tc, r))) r++;
    const top = r * TILE;
    while (r < last && !isSolid(g.tile(tc, r))) r++;
    if (r >= last) continue;
    const floor = r * TILE, period = 2 + hash(col, 13) * 2.5, u = ((time + hash(col, 14) * 9) % period) / period;
    const fall = Math.min(1, u / 0.6), y = top + 1 + (floor - top) * fall * fall;
    if (u < 0.6) {
      c.fillStyle = 'rgba(170,210,230,0.75)'; ellipse(c, x, y + 2, 0.9, fall > 0.05 ? 2 : 1.2); c.fill();
    } else if (u < 0.8) {
      const k = (u - 0.6) / 0.2;
      c.strokeStyle = `rgba(170,210,230,${0.7 * (1 - k)})`; c.lineWidth = 0.6; ellipse(c, x, floor - 0.5, 1 + k * 6, 0.6 + k * 1.2); c.stroke();
      c.fillStyle = `rgba(190,225,240,${0.8 * (1 - k)})`; c.fillRect(x - 2 - k * 3, floor - 2 - k * 4 + k * k * 5, 1, 1); c.fillRect(x + 1 + k * 3, floor - 2 - k * 4 + k * k * 5, 1, 1);
    }
  }
}

/** Slanted shafts of light through high windows, with dust drifting in them (the hall and the belfry). */
function drawShafts(c: C, g: FluffstevaniaGame, time: number) {
  c.save(); c.globalCompositeOperation = 'lighter';
  const span = VIEW_W + 240;
  for (let i = 0; i < 2; i++) {
    const x0 = mod(-g.cam.x * 0.8 + i * 260 + 60, span) - 120, tint = g.room.area === 'belfry' || g.room.area === 'library' || g.room.area === 'clock' ? '190,215,255' : '255,225,170';
    const gr = c.createLinearGradient(0, 0, 0, VIEW_H);
    gr.addColorStop(0, `rgba(${tint},0.13)`); gr.addColorStop(1, `rgba(${tint},0)`);
    c.fillStyle = gr; c.beginPath(); c.moveTo(x0, 0); c.lineTo(x0 + 30, 0); c.lineTo(x0 + 120, VIEW_H); c.lineTo(x0 + 70, VIEW_H); c.closePath(); c.fill();
    for (let m = 0; m < 12; m++) {
      const v = (hash(m, i) + time * (0.02 + hash(i, m) * 0.03)) % 1, along = hash(m + 5, i);
      const y = v * VIEW_H, x = x0 + 15 + along * 30 + (y / VIEW_H) * 72 + Math.sin(time + m) * 3;
      c.fillStyle = `rgba(${tint},${0.5 * (1 - v)})`; c.fillRect(x, y, 1, 1);
    }
  }
  c.restore();
}

/** Colour grading: each area gets its own cast over everything but the HUD. */
const GRADE: Record<AreaId, [string, number]> = {
  approach: ['#3050b8', 0.32], hall: ['#e0a060', 0.22], cellar: ['#d08030', 0.22], belfry: ['#60a0c8', 0.2], catacombs: ['#58b868', 0.3], library: ['#c86070', 0.2],
  clock: ['#d8b050', 0.2],
};

/** A curtain wipe between rooms: it sweeps off the way the heroes are heading, trimmed with gold. */
let wipeRoom = '', wipeAt = -9, wipeDir: [number, number] = [1, 0];
function drawWipe(c: C, g: FluffstevaniaGame, time: number) {
  if (g.room.id !== wipeRoom) {
    const prev = ROOMS.find((r) => r.id === wipeRoom);
    if (prev) {
      wipeAt = time;
      const dx = g.room.mx + g.room.w / 2 - (prev.mx + prev.w / 2), dy = g.room.my + g.room.h / 2 - (prev.my + prev.h / 2);
      wipeDir = Math.abs(dx) >= Math.abs(dy) ? [Math.sign(dx) || 1, 0] : [0, Math.sign(dy) || 1];
    }
    wipeRoom = g.room.id;
  }
  const t = (time - wipeAt) / 0.34;
  if (t >= 1 || t < 0) return;
  const e = 1 - (1 - t) * (1 - t) * (1 - t), [dx, dy] = wipeDir;
  c.save();
  if (dx) {
    // Heading right, the curtain draws away to the left, revealing the new room from the right.
    const w = VIEW_W * (1 - e), x = dx > 0 ? 0 : VIEW_W - w, edge = dx > 0 ? x + w : x;
    c.fillStyle = '#07030c'; c.fillRect(x, 0, w, VIEW_H);
    const gr = c.createLinearGradient(edge, 0, edge + (dx > 0 ? 18 : -18), 0);
    gr.addColorStop(0, 'rgba(7,3,12,0.8)'); gr.addColorStop(1, 'rgba(7,3,12,0)');
    c.fillStyle = gr; c.fillRect(dx > 0 ? edge : edge - 18, 0, 18, VIEW_H);
    c.fillStyle = '#e0bc68'; c.fillRect(edge - 0.5, 0, 1, VIEW_H);
  } else {
    const h = VIEW_H * (1 - e), y = dy > 0 ? 0 : VIEW_H - h, edge = dy > 0 ? y + h : y;
    c.fillStyle = '#07030c'; c.fillRect(0, y, VIEW_W, h);
    c.fillStyle = '#e0bc68'; c.fillRect(0, edge - 0.5, VIEW_W, 1);
  }
  c.restore();
}

/** Boss titles for the intro card. */
const BOSS_TITLE: Record<string, string> = { owl: 'Warden of the Belfry', rat: 'Tyrant of the Larder', fox: 'Master of the Castle', cat: 'Keeper of the Clock' };
let introBoss: Boss | null = null, introAt = 0;
/** The boss's name slams onto a black band across the screen as the fight begins. */
function drawBossIntro(c: C, g: FluffstevaniaGame, time: number) {
  if (!g.boss || g.boss.move === 'dying') { if (!g.boss) introBoss = null; return; }
  if (g.boss !== introBoss) { introBoss = g.boss; introAt = time; }
  const t = time - introAt, T = 2.8;
  if (t > T) return;
  const cy = 96, fade = Math.min(1, t * 5, (T - t) * 2.5), slam = Math.min(1, Math.max(0, (t - 0.25) / 0.16));
  c.save(); c.globalAlpha = fade;
  const band = c.createLinearGradient(0, cy - 26, 0, cy + 22);
  band.addColorStop(0, 'rgba(6,2,10,0)'); band.addColorStop(0.25, 'rgba(6,2,10,0.85)'); band.addColorStop(0.75, 'rgba(6,2,10,0.85)'); band.addColorStop(1, 'rgba(6,2,10,0)');
  const shake = t > 0.41 && t < 0.55 ? Math.sin(t * 120) * 2 : 0;
  c.translate(shake, 0);
  c.fillStyle = band; c.fillRect(0, cy - 26, VIEW_W, 48);
  c.strokeStyle = '#a07830'; c.lineWidth = 0.6;
  const reach = Math.min(1, t * 3) * 150;
  for (const y of [cy - 18, cy + 14]) { c.beginPath(); c.moveTo(VIEW_W / 2 - reach, y); c.lineTo(VIEW_W / 2 + reach, y); c.stroke(); }
  c.textAlign = 'center';
  c.font = `italic 600 8px ${BOOK}`; c.fillStyle = '#c8b0d8'; c.fillText(`— ${BOSS_TITLE[g.boss.kind] ?? ''} —`, VIEW_W / 2, cy - 8);
  if (slam > 0) {
    const sc = 1 + (1 - slam) * 1.4;
    c.save(); c.translate(VIEW_W / 2, cy + 8); c.scale(sc, sc); c.globalAlpha = fade * slam;
    const name = BOSSES[g.boss.kind].name.toUpperCase();
    c.font = `900 15px ${DISPLAY}`; c.lineWidth = 4; c.strokeStyle = '#1a0610'; c.strokeText(name, 0, 0);
    const gr = c.createLinearGradient(0, -13, 0, 1); gr.addColorStop(0, '#fff0c8'); gr.addColorStop(0.6, '#e89040'); gr.addColorStop(1, '#a02818');
    c.fillStyle = gr; c.fillText(name, 0, 0);
    c.restore();
    if (t > 0.41 && t < 0.6) {
      // A flash of light as it lands.
      const k = (t - 0.41) / 0.19;
      c.globalCompositeOperation = 'lighter'; c.fillStyle = `rgba(255,220,160,${0.5 * (1 - k)})`; c.fillRect(0, cy - 18, VIEW_W, 32);
    }
  }
  c.restore();
}

/**
 * The Clock Tower's works, drawn live behind the stonework: gears turning at their own speeds, a pendulum swinging in
 * the pendulum hall, and in Tick-Tock's room the back of the great clock face, lit by the moon, its hands creeping round.
 */
function drawClockwork(c: C, g: FluffstevaniaGame, time: number) {
  const rr = roomRect(g.room), px = (g.cam.x - rr.x) * 0.3, py = (g.cam.y - rr.y) * 0.3;
  if (g.room.id === 'clockface') {
    const x = VIEW_W / 2 - px * 0.5, y = 96 - py * 0.5, R = 92;
    const glass = c.createRadialGradient(x - 20, y - 20, 10, x, y, R);
    glass.addColorStop(0, 'rgba(240,236,210,0.5)'); glass.addColorStop(0.7, 'rgba(200,196,170,0.3)'); glass.addColorStop(1, 'rgba(120,110,80,0.35)');
    c.fillStyle = glass; ellipse(c, x, y, R, R); c.fill();
    c.strokeStyle = '#6a5020'; c.lineWidth = 8; ellipse(c, x, y, R + 4, R + 4); c.stroke();
    c.strokeStyle = '#c89a40'; c.lineWidth = 2; ellipse(c, x, y, R + 8, R + 8); c.stroke(); ellipse(c, x, y, R - 2, R - 2); c.stroke();
    // Roman numerals and the hours' ticks.
    c.save(); c.translate(x, y);
    c.fillStyle = 'rgba(40,30,20,0.75)'; c.font = `700 11px ${DISPLAY}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    const NUM = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2 - Math.PI / 2; c.fillText(NUM[i], Math.cos(a) * (R - 16), Math.sin(a) * (R - 16)); c.fillRect(Math.cos(a) * (R - 5) - 1, Math.sin(a) * (R - 5) - 1, 2, 2); }
    c.textBaseline = 'alphabetic';
    const hour = time * 0.02, minute = time * 0.24;
    c.strokeStyle = 'rgba(30,20,10,0.85)'; c.lineCap = 'round';
    c.lineWidth = 5; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(hour) * R * 0.5, Math.sin(hour) * R * 0.5); c.stroke();
    c.lineWidth = 3; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(minute) * R * 0.78, Math.sin(minute) * R * 0.78); c.stroke();
    c.lineCap = 'butt';
    c.restore();
    gearShape(c, x, y, 12, 10, time * 0.5, '#3a2a14');
  }
  // Gears turning behind the stone, meshed in pairs.
  for (let i = 0; i < 3; i++) {
    const gx = mod(i * 190 + 80 - px, VIEW_W + 160) - 80, gy = 60 + (i % 2) * 90 - py * 0.4, r = 34 + (i % 2) * 14;
    const dir = i % 2 ? -1 : 1;
    gearShape(c, gx, gy, r, 12 + (i % 2) * 4, time * 0.6 * dir, 'rgba(70,52,24,0.55)');
    gearShape(c, gx + r * 1.55, gy + r * 0.5, r * 0.55, 8, -time * 1.1 * dir + 0.2, 'rgba(90,66,30,0.5)');
  }
  if (g.room.id === 'pendulum-hall') {
    // A great pendulum swinging slowly behind the room.
    const ax = VIEW_W / 2 - px * 0.6, ay = -10, a = Math.sin(time * 1.4) * 0.45, L = 170;
    const bx = ax + Math.sin(a) * L, by = ay + Math.cos(a) * L;
    c.strokeStyle = 'rgba(120,90,40,0.6)'; c.lineWidth = 3; c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke();
    const bob = c.createRadialGradient(bx - 5, by - 5, 2, bx, by, 18); bob.addColorStop(0, 'rgba(240,200,110,0.7)'); bob.addColorStop(1, 'rgba(110,80,30,0.6)');
    c.fillStyle = bob; ellipse(c, bx, by, 18, 18); c.fill();
  }
}

// ─── The frame ────────────────────────────────────────────────────────────

export function drawGame(c: C, g: FluffstevaniaGame, time: number) {
  const area = g.room.area, rr = roomRect(g.room);
  const scale = c.getTransform().a || 1;
  drawLayers(c, g, time);
  if (area === 'clock') drawClockwork(c, g, time);
  const sx = g.shake > 0 ? Math.sin(time * 90) * 2 : 0, sy = g.shake > 0 ? Math.cos(time * 70) * 1.5 : 0;
  const tx = Math.round(-g.cam.x + sx), ty = Math.round(-g.cam.y + sy);
  c.save();
  c.translate(tx, ty);
  const tiles = roomTiles(g, scale);
  c.drawImage(tiles.cv, rr.x - TILE, rr.y - TILE, tiles.cv.width / scale, tiles.cv.height / scale);
  const room = g.room;
  for (let r = 0; r < room.rows.length; r++) for (let cc = 0; cc < room.rows[r].length; cc++) {
    const ch = room.rows[r][cc];
    if (ch !== 'S' && ch !== '$') continue;
    const x = (room.mx * COLS + cc) * TILE, y = (room.my * ROWS + r) * TILE;
    if (ch === 'S') shrine(c, x + 8, y + 16, time); else stall(c, x + 8, y + 16, time);
  }
  for (const k of g.candles) if (k.alive) candle(c, g, k, time);
  if (room.relic) {
    // A carved pedestal under the relic, even after it's taken.
    for (let r = 0; r < room.rows.length; r++) {
      const col = room.rows[r].indexOf('R');
      if (col < 0) continue;
      const x = (room.mx * COLS + col) * TILE, y = (room.my * ROWS + r + 1) * TILE;
      c.fillStyle = '#6a5a7a'; c.fillRect(x - 13, y, 42, 3); c.fillStyle = '#a898b8'; c.fillRect(x - 13, y, 42, 1);
    }
  }
  for (const p of g.pickups) drawPickup(c, p, time);
  for (let r = 0; r < room.rows.length; r++) for (let cc = 0; cc < room.rows[r].length; cc++) {
    const ch = room.rows[r][cc], id = ch === 'P' ? 'pudding' : ch === 'Y' ? 'mochi' : ch === 'C' ? 'nutmeg' : null;
    if (!id || g.pals[id]) continue;
    const x = (room.mx * COLS + cc + 0.5) * TILE, y = (room.my * ROWS + r + 1) * TILE;
    if (id === 'nutmeg') {
      // Nutmeg, fretting, with a worried little question mark until her watch turns up.
      drawPal(c, 'nutmeg', x, y, -1, time, g.flags.has('watch') ? 0.3 : 0);
      c.fillStyle = g.flags.has('watch') ? '#ffe070' : 'rgba(255,240,210,0.85)'; c.font = `700 8px ${DISPLAY}`; c.textAlign = 'center';
      c.fillText(g.flags.has('watch') ? '!' : '?', x, y - 24 + Math.sin(time * 4) * 1.5);
    } else if (id === 'mochi') {
      // Mochi soaks in a little tub of warm water.
      c.fillStyle = '#5a3a24'; c.beginPath(); c.roundRect(x - 13, y - 8, 26, 8, 2); c.fill();
      c.fillStyle = 'rgba(140,200,220,0.8)'; c.fillRect(x - 11, y - 7, 22, 3);
      for (let i = 0; i < 3; i++) { const t = (time * 0.6 + i / 3) % 1; c.fillStyle = `rgba(230,240,250,${0.5 - t * 0.5})`; ellipse(c, x - 6 + i * 6, y - 10 - t * 12, 2 + t * 3, 1.5 + t * 2); c.fill(); }
      drawPal(c, 'mochi', x + 1, y - 4, -1, time);
    } else drawPal(c, 'pudding', x, y, -1, time, Math.sin(time * 2) > 0.8 ? 0.2 : 0);
  }
  if (g.cage) drawCage(c, g.cage.x, g.cage.y, g.cage.hp, g.cage.flash, time);
  for (const e of g.enemies) if (e.dead) burnAway(c, g, e, time); else drawEnemy(c, g, e, time);
  if (g.boss) drawBoss(c, g.boss, time);
  for (const sh of g.shelves) drawShelf(c, g, sh);
  drawHeroes(c, g, time);
  for (const s of g.shots) drawShot(c, s);
  drawDustFx(c, g);
  if (area === 'cellar' || area === 'catacombs') drawDrips(c, g, time);
  c.restore();
  drawLighting(c, g, time);
  if (area === 'hall' || area === 'belfry' || area === 'library') drawShafts(c, g, time);
  c.save(); c.translate(tx, ty); drawGlowFx(c, g); c.restore();
  drawForeground(c, g);
  if (area === 'hall' && lightning(time) > 0) { c.fillStyle = `rgba(190,205,255,${0.08 * lightning(time)})`; c.fillRect(0, 0, VIEW_W, VIEW_H); }
  if (g.duoT >= 0) drawDuo(c, g, time);
  // Air: a vignette everywhere, and drifting mist outside.
  const vig = c.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.4, VIEW_W / 2, VIEW_H / 2, VIEW_W * 0.68);
  vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, area === 'cellar' ? 'rgba(18,6,0,0.6)' : area === 'catacombs' ? 'rgba(0,8,4,0.65)' : 'rgba(6,2,14,0.6)');
  c.fillStyle = vig; c.fillRect(0, 0, VIEW_W, VIEW_H);
  if (area === 'approach' || area === 'catacombs') {
    c.fillStyle = area === 'approach' ? 'rgba(180,170,230,0.06)' : 'rgba(150,220,170,0.05)';
    for (let i = 0; i < 3; i++) { ellipse(c, ((time * (8 + i * 4) + i * 140) % (VIEW_W + 200)) - 100, VIEW_H - 26 - i * 10, 90, 6); c.fill(); }
  }
  const [grade, amount] = GRADE[area];
  c.save(); c.globalCompositeOperation = 'soft-light'; c.globalAlpha = amount; c.fillStyle = grade; c.fillRect(0, 0, VIEW_W, VIEW_H); c.restore();
  drawWipe(c, g, time);
  drawBossIntro(c, g, time);
  drawHud(c, g, time);
}
