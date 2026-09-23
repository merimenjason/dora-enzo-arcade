// Fluffstevania in Canvas 2D, in the spirit of Symphony of the Night: parallax layers of gothic scenery behind
// every room, stained glass and moonlight, carved stone, candlelight that cuts through the dark, the castle's
// creatures, Dora and Enzo with their afterimages, hit sparks and dust, and an ornate HUD.
// Everything is drawn in the 384×224 view; the page scales it up.
import { drawChinchilla, type ChinId } from './chinchilla-art';
import {
  FluffstevaniaGame, VIEW_W, VIEW_H, TILE, COLS, ROWS, ROOMS, AREAS, FOES, BOSSES, GEAR, FOOD, TAG_ARC, TAG_T, TAG_CD, FX_LIFE, CHARGE_T, DUO_MAX, DUO_T, SUBS,
  isSolid, rawTile, roomRect, ghostFaded, type Enemy, type Boss, type Shot, type Pickup, type AreaId, type HeroId, type Room, type FoeKind, type PalId, type SubId,
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
  catacombs: { brick: '#46504a', brickHi: '#66746a', brickLo: '#262e2a', mortar: '#121814', ledge: '#5e6458', ledgeHi: '#8a927e', accent: '#9fd878', dark: [4, 12, 8, 0.6], wood: false, moss: '#3e6a36' },
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
type Layer = { cv: HTMLCanvasElement; f: number; fy: number };
const layerCache = new Map<string, Layer[]>();
function canvas(w = LW, h = LH) { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; return cv; }
/** Draw something at x and again one layer-width either side, so it wraps across the seam. */
const wrap = (draw: (dx: number) => void) => { draw(0); draw(-LW); draw(LW); };

function layersFor(area: AreaId, roomId: string): Layer[] {
  const key = roomId === 'belfry' || roomId === 'throne' ? `${area}:${roomId}` : area;
  const hit = layerCache.get(key);
  if (hit) return hit;
  const made = area === 'approach' ? approachLayers() : area === 'hall' ? hallLayers() : area === 'cellar' ? cellarLayers()
    : area === 'belfry' ? belfryLayers(roomId === 'belfry') : catacombLayers(roomId === 'throne');
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
    layer(0.25, 0.12, (c) => {
      for (let i = 0; i < 3; i++) stainedWindow(c, 40 + i * 256, 34, i * 2);
      for (let i = 0; i < 3; i++) banner(c, 170 + i * 256, 60, 120, '#7a1c30');
    }),
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

function drawLayers(c: C, g: FluffstevaniaGame) {
  const rr = roomRect(g.room);
  // How far down a tall room the camera is; a one-screen room shows the lower part of each layer.
  const p = rr.h > VIEW_H ? (g.cam.y - rr.y) / (rr.h - VIEW_H) : 1;
  for (const L of layersFor(g.room.area, g.room.id)) {
    const ox = Math.round(-mod(g.cam.x * L.f, LW));
    const oy = Math.round(-(LH - VIEW_H) * (0.5 + (p - 0.5) * Math.min(1, L.fy * 5)));
    c.drawImage(L.cv, ox, oy);
    c.drawImage(L.cv, ox + LW, oy);
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
    } else if (ch === 'D' && rawTile(cc - 1, r) !== 'D' && rawTile(cc, r - 1) !== 'D') {
      sealedDoor(c, x, y, false);
    } else if (rawTile(cc, r) === 'D' && rawTile(cc - 1, r) !== 'D' && rawTile(cc, r - 1) !== 'D') {
      sealedDoor(c, x, y, true);
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
  }
}
function sealedDoor(c: C, x: number, y: number, open: boolean) {
  const w = 64, h = 96;
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
  for (let i = 1; i < 4; i++) { c.beginPath(); c.moveTo(x + 3 + i * 14.5, y + 12); c.lineTo(x + 3 + i * 14.5, y + h); c.stroke(); }
  c.fillStyle = '#4a4450'; c.fillRect(x + 3, y + 36, w - 6, 5); c.fillRect(x + 3, y + 70, w - 6, 5);
  c.fillStyle = '#7a7480'; for (let i = 0; i < 6; i++) { ellipse(c, x + 8 + i * 10, y + 38.5, 1.2, 1.2); c.fill(); ellipse(c, x + 8 + i * 10, y + 72.5, 1.2, 1.2); c.fill(); }
  c.fillStyle = '#8a7a50'; ellipse(c, x + w / 2, y + 56, 8, 8); c.fill();
  c.fillStyle = '#e8c860'; ellipse(c, x + w / 2, y + 56, 4, 5); c.fill();
  c.fillStyle = '#1a1008'; c.fillRect(x + w / 2 - 1, y + 56, 2, 4);
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
  const bob = p.fixed ? Math.sin(time * 3 + p.x) * 2 : 0, x = p.x, y = p.y - 5 + bob;
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
    case 'relic': {
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
  else if (id === 'acorn') {
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
  }
  c.restore();
  c.globalAlpha = 1;
}

/** One foe (or boss) posed for the Bestiary, centred in a w × h box. */
export function drawFoeIcon(c: C, kind: string, w: number, h: number, time: number) {
  c.clearRect(0, 0, w, h);
  c.save();
  if (kind === 'owl' || kind === 'rat_king') {
    const k = kind === 'owl' ? 'owl' : 'rat', s = Math.min(w, h) / 70;
    c.translate(w / 2, h / 2); c.scale(s, s);
    const boss = { kind: k, x: 0, y: 0, vx: 0, vy: 0, hp: 1, max: 1, move: k === 'owl' ? 'hover' : 'idle', t: 0, face: 1, flash: 0, phase2: false, summoned: false, sx: 0, ex: 0, side: 1, last: [], hitId: -1 } as Boss;
    (k === 'owl' ? drawOwl : drawRatKing)(c, boss, time);
  } else {
    const f = FOES[kind as FoeKind], s = Math.min(w, h) / 30;
    c.translate(w / 2, h / 2 + (f.h * s) / 2); c.scale(s, s);
    const e = { id: 1, kind: kind as FoeKind, x: 0, y: 0, hx: 0, hy: 0, vx: 0, vy: 0, hp: 1, face: 1, t: 1, state: 'awake', stateT: 0, flash: 0, ground: true, hitId: -1, dead: 0 } as Enemy;
    drawEnemy(c, null, e, time);
  }
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
    c.rotate(s.spin * 1.5);
    c.fillStyle = '#a86a30'; ellipse(c, 0, 1.5, 3.6, 4); c.fill();
    c.fillStyle = '#6a4020'; ellipse(c, 0, -1.6, 4.4, 2.2); c.fill();
    c.strokeStyle = 'rgba(255,240,200,0.5)'; c.lineWidth = 1; c.beginPath(); c.arc(0, 0, 7, 0, 2); c.stroke();
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
    c.scale(Math.sign(s.vx) || 1, 1);
    c.fillStyle = '#6a5a48'; for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(-8 + i * 5, 6); c.lineTo(-6 + i * 5, -4 - i * 2); c.lineTo(-3 + i * 5, 6); c.fill(); }
    c.fillStyle = 'rgba(230,210,180,0.6)'; ellipse(c, 0, 5, 9, 2.5); c.fill();
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
    if (live) { c.strokeStyle = 'rgba(255,240,200,0.5)'; c.lineWidth = 5; c.beginPath(); c.arc(0, 0, w.reach * 0.8, a - 1.2, a); c.stroke(); }
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

function hero(c: C, id: HeroId, x: number, y: number, face: 1 | -1, time: number, o: { run?: number; moving?: boolean; air?: boolean; alpha?: number }) {
  c.globalAlpha = o.alpha ?? 1;
  drawChinchilla(c, id as ChinId, x, y, { face, h: HERO_DRAW_H, time, run: o.run, moving: o.moving, air: o.air, blink: Math.floor(time * 0.6 + (id === 'dora' ? 0 : 0.5)) % 7 === 0 && time % 1.7 < 0.12 });
  c.globalAlpha = 1;
}

function drawHeroes(c: C, g: FluffstevaniaGame, time: number) {
  const b = g.body, f = g.follower, partner = g.partner;
  const tp = g.tagPoint();
  const w = g.weaponOf(b.attackHero), into = w.total - b.attackT;
  const lunging = b.attackT > 0 && b.ground && Math.abs(b.vx) > 80 && into < w.windup + w.active;
  const trailing = b.dashT > 0 || lunging || !!tp;
  if (trailing && time - lastGhost > 0.035) {
    lastGhost = time;
    if (tp && g.tag) addGhost(g.tag.hero, tp.x, tp.y + 10, b.face, time, { spin: g.tag.t * 26 * b.face });
    else addGhost(g.leader, b.x, b.y, b.face, time, { run: b.run, air: !b.ground });
  }
  drawGhosts(c, time);
  if (g.pal && g.duoT < 0) {
    const p = g.palBody;
    drawPal(c, g.pal, p.x, p.y, p.face, time, p.act, g.pal === 'zippy' && p.target >= 0);
  }
  if (g.duoT >= 0) return;
  if (g.hp[partner] > 0 && !(g.tag && g.tag.t < TAG_ARC)) hero(c, partner, f.x, f.y, f.face, time + 0.7, { run: f.run, moving: f.moving, air: f.air, alpha: 0.95 });
  else if (g.hp[partner] > 0 && g.tag) hero(c, partner, b.x - b.face * 4, b.y - Math.sin((g.tag.t / TAG_ARC) * Math.PI) * 8, b.face, time, { air: true });
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
  const flicker = b.invT > 0 && Math.floor(time * 20) % 2 === 0 && !lunging;
  const moving = Math.abs(b.vx) > 1 && b.ground;
  hero(c, g.leader, b.x, b.y, b.face, time, { run: b.run, moving, air: !b.ground, alpha: flicker ? 0.35 : 1 });
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
        c.fillStyle = `rgba(255,255,255,${0.9 - k})`; ellipse(c, f.x, f.y, 5 * (1 - k) + 1, 5 * (1 - k) + 1); c.fill();
        c.strokeStyle = `rgba(255,240,180,${1 - k})`; c.lineWidth = 1.3;
        for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + 0.3, r = 3 + k * 14; c.beginPath(); c.moveTo(f.x + Math.cos(a) * r * 0.4, f.y + Math.sin(a) * r * 0.4); c.lineTo(f.x + Math.cos(a) * r, f.y + Math.sin(a) * r); c.stroke(); }
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
  c.textAlign = 'center';
  for (const p of g.pops) {
    // Numbers pop in large, settle, then fade.
    const grow = p.t < 0.08 ? 1.6 - p.t * 7.5 : 1, crit = p.color === '#ffd35a', size = (crit ? 11 : 9) * grow;
    c.globalAlpha = Math.min(1, (0.9 - p.t) * 4);
    c.font = `900 ${size.toFixed(1)}px ${DISPLAY}`;
    c.lineWidth = 3; c.strokeStyle = '#140818'; c.strokeText(p.text, p.x, p.y);
    c.fillStyle = p.color; c.fillText(p.text, p.x, p.y);
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
  for (const s of g.shots) if (s.kind === 'flame') out.push({ x: s.x, y: s.y, r: 30, a: 0.8, tint: '#ff9040' }); else if (s.kind === 'wind') out.push({ x: s.x, y: s.y, r: 34, a: 0.4 });
  if (g.pal) out.push({ x: g.palBody.x, y: g.palBody.y - 6, r: 26, a: 0.35 });
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
    frame(c, x - 10, y - 13, w + 20, 23);
    c.font = `700 7px ${DISPLAY}`; c.textAlign = 'center'; c.fillStyle = '#f0c8a0'; c.fillText(k.name.toUpperCase(), VIEW_W / 2, y - 3);
    bar(c, x, y + 1, w, 4, o.hp, o.max, o.phase2 ? '#ff7050' : '#e0a050', o.phase2 ? '#901810' : '#8a4a10');
    c.fillStyle = '#e8e0d0';
    skull(c, x - 5, y + 2, 0.55, '#e8e0d0'); skull(c, x + w + 5, y + 2, 0.55, '#e8e0d0');
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

const isSave = (room: Room) => room.rows.some((row) => row.includes('S'));
function minimap(c: C, g: FluffstevaniaGame, x0: number, y0: number, time: number) {
  const cw = 9, ch = 6, span = 7, spanY = 5;
  const bx = Math.floor(g.body.x / VIEW_W), by = Math.floor((g.body.y - 10) / VIEW_H);
  frame(c, x0 - 4, y0 - 4, cw * span + 8, ch * spanY + 8);
  for (let dy = 0; dy < spanY; dy++) for (let dx = 0; dx < span; dx++) {
    const mx = bx - 3 + dx, my = by - 2 + dy;
    const room = ROOMS.find((r) => mx >= r.mx && mx < r.mx + r.w && my >= r.my && my < r.my + r.h);
    if (!room || !g.visited.has(`${mx},${my}`)) continue;
    const px = x0 + dx * cw, py = y0 + dy * ch;
    c.fillStyle = isSave(room) ? '#b03040' : room.boss ? '#806020' : '#2a4a8a';
    c.fillRect(px, py, cw, ch);
    c.strokeStyle = '#d8e0f0'; c.lineWidth = 0.6;
    c.beginPath();
    if (mx === room.mx) { c.moveTo(px + 0.3, py); c.lineTo(px + 0.3, py + ch); }
    if (mx === room.mx + room.w - 1) { c.moveTo(px + cw - 0.3, py); c.lineTo(px + cw - 0.3, py + ch); }
    if (my === room.my) { c.moveTo(px, py + 0.3); c.lineTo(px + cw, py + 0.3); }
    if (my === room.my + room.h - 1) { c.moveTo(px, py + ch - 0.3); c.lineTo(px + cw, py + ch - 0.3); }
    c.stroke();
  }
  if (Math.floor(time * 3) % 2 === 0) { c.fillStyle = '#ffffff'; c.fillRect(x0 + 3 * cw + 3, y0 + 2 * ch + 2, 3, 2); }
}

/** The full castle map for the pause menu. */
export function drawMap(c: C, g: FluffstevaniaGame, w: number, h: number, time: number) {
  c.fillStyle = '#0c0714'; c.fillRect(0, 0, w, h);
  const minX = Math.min(...ROOMS.map((r) => r.mx)), maxX = Math.max(...ROOMS.map((r) => r.mx + r.w));
  const minY = Math.min(...ROOMS.map((r) => r.my)), maxY = Math.max(...ROOMS.map((r) => r.my + r.h));
  const cell = Math.floor(Math.min((w - 20) / (maxX - minX), (h - 20) / (maxY - minY) / 0.62)), ch = Math.round(cell * 0.62);
  const ox = (w - cell * (maxX - minX)) / 2, oy = (h - ch * (maxY - minY)) / 2;
  for (const room of ROOMS) for (let dy = 0; dy < room.h; dy++) for (let dx = 0; dx < room.w; dx++) {
    const mx = room.mx + dx, my = room.my + dy;
    if (!g.visited.has(`${mx},${my}`)) continue;
    const px = ox + (mx - minX) * cell, py = oy + (my - minY) * ch;
    const fill = isSave(room) ? '#a02838' : room.boss ? '#7a5a18' : room.rows.some((row) => row.includes('$')) ? '#2a7a50' : shade(AREAS[room.area].color, 0.45);
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
  const bx = g.body.x / VIEW_W - minX, by = (g.body.y - 10) / VIEW_H - minY;
  if (Math.floor(time * 3) % 2 === 0) { c.fillStyle = '#ffffff'; ellipse(c, ox + bx * cell, oy + by * ch, 3, 3); c.fill(); }
}

// ─── The frame ────────────────────────────────────────────────────────────

export function drawGame(c: C, g: FluffstevaniaGame, time: number) {
  const area = g.room.area, rr = roomRect(g.room);
  const scale = c.getTransform().a || 1;
  drawLayers(c, g);
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
    const ch = room.rows[r][cc], id = ch === 'P' ? 'pudding' : ch === 'Y' ? 'mochi' : null;
    if (!id || g.pals[id]) continue;
    const x = (room.mx * COLS + cc + 0.5) * TILE, y = (room.my * ROWS + r + 1) * TILE;
    if (id === 'mochi') {
      // Mochi soaks in a little tub of warm water.
      c.fillStyle = '#5a3a24'; c.beginPath(); c.roundRect(x - 13, y - 8, 26, 8, 2); c.fill();
      c.fillStyle = 'rgba(140,200,220,0.8)'; c.fillRect(x - 11, y - 7, 22, 3);
      for (let i = 0; i < 3; i++) { const t = (time * 0.6 + i / 3) % 1; c.fillStyle = `rgba(230,240,250,${0.5 - t * 0.5})`; ellipse(c, x - 6 + i * 6, y - 10 - t * 12, 2 + t * 3, 1.5 + t * 2); c.fill(); }
      drawPal(c, 'mochi', x + 1, y - 4, -1, time);
    } else drawPal(c, 'pudding', x, y, -1, time, Math.sin(time * 2) > 0.8 ? 0.2 : 0);
  }
  if (g.cage) drawCage(c, g.cage.x, g.cage.y, g.cage.hp, g.cage.flash, time);
  for (const e of g.enemies) drawEnemy(c, g, e, time);
  if (g.boss) (g.boss.kind === 'owl' ? drawOwl : drawRatKing)(c, g.boss, time);
  drawHeroes(c, g, time);
  for (const s of g.shots) drawShot(c, s);
  drawDustFx(c, g);
  c.restore();
  drawLighting(c, g, time);
  c.save(); c.translate(tx, ty); drawGlowFx(c, g); c.restore();
  if (g.duoT >= 0) drawDuo(c, g, time);
  // Air: a vignette everywhere, and drifting mist outside.
  const vig = c.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.4, VIEW_W / 2, VIEW_H / 2, VIEW_W * 0.68);
  vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, area === 'cellar' ? 'rgba(18,6,0,0.6)' : area === 'catacombs' ? 'rgba(0,8,4,0.65)' : 'rgba(6,2,14,0.6)');
  c.fillStyle = vig; c.fillRect(0, 0, VIEW_W, VIEW_H);
  if (area === 'approach' || area === 'catacombs') {
    c.fillStyle = area === 'approach' ? 'rgba(180,170,230,0.06)' : 'rgba(150,220,170,0.05)';
    for (let i = 0; i < 3; i++) { ellipse(c, ((time * (8 + i * 4) + i * 140) % (VIEW_W + 200)) - 100, VIEW_H - 26 - i * 10, 90, 6); c.fill(); }
  }
  drawHud(c, g, time);
}
