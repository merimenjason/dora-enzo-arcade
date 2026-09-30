// Chinchilla Scribble in Canvas 2D: the level's backdrop and ground (drawn once and cached), water, summoned things,
// the residents, Dora and Enzo with soft lighting, effects, and the dark storeroom's lights. Detailed-medium style:
// thin outlines, gradients, highlights, textures and a little ambient life.
import { W, H, GROUND, CHIN_H, LIGHT_REACH, type Game, type Ent, type Terrain, type Chin } from './scribble-game.js';
import { ART, INK, LW, light, dark, type Look } from './scribble-art.js';
import { COATS, coatLike, drawChinchilla, type Coat } from './chinchilla-art.js';

export const VIEW_W = W, VIEW_H = H;
type C = CanvasRenderingContext2D;

const PEBBLE: Coat = coatLike('enzo', { fur: '#9a98a3', back: '#7d7b86', face: '#b4b2bc', shade: '#85838e', texture: '#7a7883', tail: '#a09ea8', tailOuter: '#85838e', streaks: false, bands: false });

let seedN = 1;
const rand = () => { seedN = (seedN * 16807) % 2147483647; return (seedN - 1) / 2147483646; };
const ell = (c: C, x: number, y: number, rx: number, ry: number) => { c.beginPath(); c.ellipse(x, y, Math.max(0.5, rx), Math.max(0.5, ry), 0, 0, Math.PI * 2); };
const lineTo = (c: C, pts: number[], col = INK, lw = LW) => { c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.strokeStyle = col; c.lineWidth = lw; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke(); };
const vgrad = (c: C, y0: number, y1: number, stops: [number, string][]) => { const g = c.createLinearGradient(0, y0, 0, y1); for (const [o, s] of stops) g.addColorStop(o, s); return g; };
const hgrad = (c: C, x0: number, x1: number, stops: [number, string][]) => { const g = c.createLinearGradient(x0, 0, x1, 0); for (const [o, s] of stops) g.addColorStop(o, s); return g; };

// ---------- Offscreen helpers ----------

const pool: HTMLCanvasElement[] = [];
function scratch(i: number, w: number, h: number) {
  let cv = pool[i];
  if (!cv) { cv = document.createElement('canvas'); pool[i] = cv; }
  if (cv.width < w || cv.height < h) { cv.width = Math.max(cv.width, Math.ceil(w)); cv.height = Math.max(cv.height, Math.ceil(h)); }
  const x = cv.getContext('2d')!;
  x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, cv.width, cv.height);
  return { cv, x };
}
/**
 * Draws something into a scratch canvas, lets `over` paint on top of only its pixels, then stamps it back.
 * (x0, y0, w, h) is the area in world units; `k` is the device scale.
 */
function composite(c: C, k: number, x0: number, y0: number, w: number, h: number, slot: number, draw: (x: C) => void, over: (x: C) => void) {
  const { cv, x } = scratch(slot, w * k + 4, h * k + 4);
  x.setTransform(k, 0, 0, k, -x0 * k, -y0 * k);
  draw(x);
  x.globalCompositeOperation = 'source-atop';
  over(x);
  x.globalCompositeOperation = 'source-over';
  c.drawImage(cv, 0, 0, w * k, h * k, x0, y0, w, h);
}

// ---------- The backdrop, cached per level ----------

const cache = new Map<string, HTMLCanvasElement>();
function backdrop(g: Game, k: number) {
  const key = `${g.level}:${k}`;
  let cv = cache.get(key);
  if (cv) return cv;
  cv = document.createElement('canvas');
  cv.width = W * k; cv.height = H * k;
  const c = cv.getContext('2d')!;
  c.setTransform(k, 0, 0, k, 0, 0);
  seedN = 7 + Math.max(0, g.level) * 13;
  sky(c, g.def.sky);
  // Behind overhangs and burrows: the darker cave wall you walk past.
  for (const t of g.terrain) if ((t.kind === 'rock' || t.kind === 'burrow') && t.y <= 0) {
    const floor = GROUND;
    c.fillStyle = vgrad(c, t.y + t.h, floor, t.kind === 'burrow' ? [[0, '#3a2618'], [1, '#5a3c26']] : [[0, '#4a4450'], [1, '#6a6270']]);
    c.fillRect(t.x, t.y + t.h, t.w, floor - t.y - t.h);
    for (let i = 0; i < 12; i++) { ell(c, t.x + rand() * t.w, t.y + t.h + rand() * (floor - t.y - t.h), 6 + rand() * 10, 3 + rand() * 4); c.fillStyle = 'rgba(0, 0, 0, 0.12)'; c.fill(); }
  }
  for (const t of g.terrain) ground(c, t, g);
  return cv;
}

function mountains(c: C, pts: [number, number][], base: number, fill: CanvasGradient | string, snow: number, snowCol = '#f4f7fd') {
  c.beginPath(); c.moveTo(0, base);
  for (const [x, y] of pts) c.lineTo(x, y);
  c.lineTo(W, base); c.closePath(); c.fillStyle = fill; c.fill();
  for (const [x, y] of pts) if (y < snow) { c.beginPath(); c.moveTo(x - 20, y + 16); c.lineTo(x, y); c.lineTo(x + 20, y + 16); c.lineTo(x + 9, y + 11); c.lineTo(x, y + 18); c.lineTo(x - 9, y + 11); c.closePath(); c.fillStyle = snowCol; c.fill(); }
  for (let i = 1; i < pts.length; i += 2) { const [x, y] = pts[i]; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 30, y + 50); c.lineTo(x + 6, y + 50); c.closePath(); c.fillStyle = 'rgba(40, 50, 90, 0.12)'; c.fill(); }
}
function cloud(c: C, x: number, y: number, s: number, fill = '#ffffff', under = '#dbe8f5') {
  c.beginPath();
  c.moveTo(x - 60 * s, y);
  c.bezierCurveTo(x - 72 * s, y - 26 * s, x - 40 * s, y - 40 * s, x - 22 * s, y - 30 * s);
  c.bezierCurveTo(x - 14 * s, y - 58 * s, x + 30 * s, y - 60 * s, x + 36 * s, y - 32 * s);
  c.bezierCurveTo(x + 62 * s, y - 40 * s, x + 78 * s, y - 10 * s, x + 58 * s, y);
  c.closePath(); c.fillStyle = fill; c.fill();
  c.save(); c.clip(); c.fillStyle = under; c.fillRect(x - 80 * s, y - 10 * s, 160 * s, 12 * s); c.restore();
  c.strokeStyle = INK; c.lineWidth = 2; c.stroke();
}
function treeline(c: C, y: number, cols: [string, string], pine = false) {
  for (let x = -10, i = 0; x < W + 20; x += 26, i++) {
    const r = 16 + ((x * 7) % 9), yy = y - ((x * 13) % 14);
    c.fillStyle = i % 2 ? cols[0] : cols[1];
    if (pine) { c.beginPath(); c.moveTo(x - r * 0.7, yy + 8); c.lineTo(x, yy - r * 1.6); c.lineTo(x + r * 0.7, yy + 8); c.closePath(); c.fill(); }
    else { ell(c, x, yy, r, r); c.fill(); }
  }
  c.fillStyle = cols[1]; c.fillRect(0, y, W, 30);
}

function sky(c: C, kind: string) {
  if (kind === 'store') {
    c.fillStyle = vgrad(c, 0, H, [[0, '#6a4a34'], [1, '#4a3222']]); c.fillRect(0, 0, W, H);
    for (let x = 0; x < W; x += 64) { c.fillStyle = (x / 64) % 2 ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.04)'; c.fillRect(x, 0, 64, H); lineTo(c, [x, 0, x, H], 'rgba(30, 18, 10, 0.5)', 2); }
    for (const y of [120, 250]) { c.fillStyle = vgrad(c, y, y + 24, [[0, '#8a5a3a'], [1, '#5a3a22']]); c.fillRect(0, y, W, 24); lineTo(c, [0, y, W, y], INK, 2); lineTo(c, [0, y + 24, W, y + 24], INK, 2); }
    return;
  }
  const s = kind === 'mountain'
    ? [[0, '#6fb2e8'], [0.7, '#c4e2f6'], [1, '#e6f3fa']]
    : kind === 'town' ? [[0, '#5a4a8a'], [0.45, '#c66a8a'], [0.8, '#f4a476'], [1, '#fbd49a']] : [[0, '#7cc6ef'], [0.7, '#cdeaf8'], [1, '#e8f6fb']];
  c.fillStyle = vgrad(c, 0, H * 0.8, s as [number, string][]); c.fillRect(0, 0, W, H);
  // Sun
  const sx = kind === 'town' ? 760 : 180, sy = kind === 'town' ? 330 : 130;
  const g = c.createRadialGradient(sx, sy, 0, sx, sy, 130);
  g.addColorStop(0, kind === 'town' ? 'rgba(255, 220, 150, 0.95)' : 'rgba(255, 248, 208, 0.95)'); g.addColorStop(0.35, 'rgba(255, 240, 176, 0.5)'); g.addColorStop(1, 'rgba(255, 240, 176, 0)');
  c.fillStyle = g; c.fillRect(sx - 140, sy - 140, 280, 280);
  ell(c, sx, sy, 30, 30); c.fillStyle = kind === 'town' ? '#ffd48a' : '#fff4b8'; c.fill();
  if (kind === 'meadow') {
    cloud(c, 640, 150, 0.9); cloud(c, 960, 190, 0.7);
    mountains(c, [[0, 360], [90, 300], [170, 340], [260, 286], [360, 346], [450, 300], [540, 350], [640, 292], [730, 344], [820, 304], [920, 350], [1000, 320]], 420, vgrad(c, 280, 420, [[0, '#8ea6d2'], [1, '#b3c8e6']]), 305, '#eef3fb');
    treeline(c, 396, ['#6fae7a', '#78b884']);
    c.fillStyle = '#a3d98a'; c.beginPath(); c.moveTo(0, 420); c.quadraticCurveTo(180, 380, 360, 410); c.quadraticCurveTo(540, 440, 720, 400); c.lineTo(1000, 410); c.lineTo(1000, 600); c.lineTo(0, 600); c.fill();
    c.fillStyle = '#90d174'; c.beginPath(); c.moveTo(0, 446); c.quadraticCurveTo(240, 416, 520, 436); c.quadraticCurveTo(760, 456, 1000, 428); c.lineTo(1000, 600); c.lineTo(0, 600); c.fill();
  } else if (kind === 'mountain') {
    cloud(c, 560, 120, 0.8); cloud(c, 880, 170, 0.6);
    mountains(c, [[0, 300], [80, 200], [170, 260], [280, 150], [400, 250], [500, 170], [620, 260], [730, 140], [850, 240], [940, 180], [1000, 230]], 420, vgrad(c, 140, 420, [[0, '#9fb0d8'], [1, '#c6d4ee']]), 250);
    mountains(c, [[0, 380], [120, 300], [230, 350], [340, 290], [460, 360], [580, 300], [700, 360], [820, 310], [940, 350], [1000, 330]], 440, vgrad(c, 290, 440, [[0, '#7f95be'], [1, '#a6b8d8']]), 310);
    treeline(c, 410, ['#4f8a62', '#5a9a6e'], true);
    c.fillStyle = '#9fc98a'; c.beginPath(); c.moveTo(0, 440); c.quadraticCurveTo(300, 420, 600, 440); c.quadraticCurveTo(800, 452, 1000, 436); c.lineTo(1000, 600); c.lineTo(0, 600); c.fill();
  } else {
    cloud(c, 300, 150, 0.8, '#f7c6c0', '#d8a0b0'); cloud(c, 620, 110, 0.6, '#f7c6c0', '#d8a0b0');
    // Burrow Town's rooftops far off, windows lit.
    for (let i = 0; i < 12; i++) {
      const x = i * 90 - 20 + ((i * 37) % 30), hh = 50 + ((i * 53) % 40), y = 420 - hh;
      c.fillStyle = i % 2 ? '#6a4a6a' : '#7a5476';
      c.beginPath(); c.moveTo(x, 430); c.lineTo(x, y); c.lineTo(x + 35, y - 26); c.lineTo(x + 70, y); c.lineTo(x + 70, 430); c.fill();
      c.fillStyle = 'rgba(255, 210, 120, 0.85)';
      for (let j = 0; j < 2; j++) { ell(c, x + 20 + j * 28, y + 22, 6, 7); c.fill(); }
    }
    c.fillStyle = '#8fb877'; c.beginPath(); c.moveTo(0, 440); c.quadraticCurveTo(300, 422, 600, 442); c.quadraticCurveTo(820, 456, 1000, 436); c.lineTo(1000, 600); c.lineTo(0, 600); c.fill();
    for (const x of [120, 380, 700]) { lineTo(c, [x, 442, x, 380], '#3a3040', 4); ell(c, x, 374, 9, 9); c.fillStyle = '#ffd87a'; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.6; c.stroke(); }
  }
}

function ground(c: C, t: Terrain, g: Game) {
  const { x, y, w, h } = t;
  if (t.kind === 'ground' || t.kind === 'floor') {
    if (t.kind === 'floor') {
      c.fillStyle = vgrad(c, y, y + h, [[0, '#a8744a'], [1, '#7a5030']]); c.fillRect(x, y, w, h);
      for (let yy = y + 18; yy < y + h; yy += 22) lineTo(c, [x, yy, x + w, yy], 'rgba(40, 20, 10, 0.35)', 1.6);
      for (let i = 0; i < w / 60; i++) lineTo(c, [x + i * 60 + ((i * 29) % 40), y + 18 + (i % 3) * 22, x + i * 60 + ((i * 29) % 40), y + 40 + (i % 3) * 22], 'rgba(40, 20, 10, 0.35)', 1.4);
      lineTo(c, [x, y, x + w, y], INK, LW);
      return;
    }
    c.fillStyle = vgrad(c, y, y + h, [[0, '#94613f'], [1, '#65402a']]); c.fillRect(x, y, w, h);
    c.fillStyle = vgrad(c, y, y + 16, [[0, '#86d467'], [1, '#5daa47']]); c.fillRect(x, y, w, 16);
    for (let i = 0; i < w / 44; i++) {
      const sx = x + i * 44 + rand() * 20, sy = y + 30 + rand() * (h - 40), r = 4 + rand() * 6;
      if (sy > y + h - 6) continue;
      ell(c, sx, sy, r, r * 0.7); c.fillStyle = '#7c5438'; c.fill(); c.strokeStyle = '#4e321f'; c.lineWidth = 1.5; c.stroke();
      ell(c, sx - r * 0.3, sy - r * 0.25, r * 0.35, r * 0.2); c.fillStyle = '#a57a58'; c.fill();
    }
    lineTo(c, [x, y, x + w, y], INK, LW); lineTo(c, [x, y + 16, x + w, y + 16], INK, LW);
    // Tufts and a few flowers along the edge, not under walls.
    for (let sx = x + 12; sx < x + w - 10; sx += 34) {
      if (g.terrain.some((o) => o !== t && o.kind !== 'ground' && sx > o.x - 6 && sx < o.x + o.w + 6 && o.y + o.h >= y - 1 && o.y < y)) continue;
      const hh = 9 + rand() * 8;
      c.beginPath(); c.moveTo(sx, y + 1); c.lineTo(sx + 3, y - hh); c.lineTo(sx + 6, y - 2); c.lineTo(sx + 9, y - hh + 3); c.lineTo(sx + 12, y + 1);
      c.fillStyle = '#6fc257'; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.8; c.lineJoin = 'round'; c.stroke();
      if (rand() < 0.22) flower(c, sx + 20, y + 2, 14 + rand() * 10, ['#ffffff', '#ffd84a', '#f7a1c4', '#b8a4ff'][Math.floor(rand() * 4)]);
    }
    return;
  }
  if (t.kind === 'cliff' || t.kind === 'haystack') {
    if (t.kind === 'haystack') {
      const rows = Math.round(h / 58), per = Math.max(1, Math.round(w / 100));
      for (let r = 0; r < rows; r++) for (let i = 0; i < per; i++) {
        const bw = w / per, bh = h / rows;
        c.save(); c.translate(x + bw * (i + 0.5) + (r % 2 ? 6 : -6), y + bh * (r + 1)); ART['hay bale'](c, { w: bw - 4, h: bh - 2, col: '#f0c65a', t: 0, moving: false, mood: 'calm', id: r * 10 + i }); c.restore();
      }
      return;
    }
    const face = () => { c.beginPath(); c.moveTo(x, y + h); c.lineTo(x + 2, y + 40); c.quadraticCurveTo(x + 4, y + 10, x + 40, y + 8); c.lineTo(x + w, y); c.lineTo(x + w, y + h); c.closePath(); };
    face(); c.fillStyle = hgrad(c, x, x + w, [[0, '#cfc1b6'], [0.25, '#bcaca2'], [1, '#a49389']]); c.fill();
    face(); c.fillStyle = vgrad(c, y, y + h, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(42, 26, 20, 0.22)']]); c.fill();
    for (let i = 1; i <= Math.floor(h / 55); i++) {
      const sy = y + i * (h / (Math.floor(h / 55) + 1));
      c.beginPath(); c.moveTo(x + 14, sy); c.quadraticCurveTo(x + w / 4, sy - 6, x + w / 2, sy); c.quadraticCurveTo(x + (w * 3) / 4, sy + 6, x + w - 10, sy + 2);
      c.strokeStyle = '#8a7a72'; c.lineWidth = 2; c.stroke();
      c.beginPath(); c.moveTo(x + 14, sy + 3); c.quadraticCurveTo(x + w / 4, sy - 3, x + w / 2, sy + 3); c.strokeStyle = '#ddd1c8'; c.lineWidth = 1.4; c.stroke();
    }
    for (let i = 0; i < 6; i++) { ell(c, x + 30 + rand() * (w - 50), y + 40 + rand() * (h - 60), 3 + rand() * 4, 2.5 + rand() * 3); c.fillStyle = '#d9cdc4'; c.fill(); c.strokeStyle = '#7d6d66'; c.lineWidth = 1.4; c.stroke(); }
    for (let i = 0; i < 3; i++) { const cx = x + 40 + rand() * (w - 80), cy = y + 40 + rand() * (h - 70); lineTo(c, [cx, cy, cx + 10, cy + 16, cx + 4, cy + 28], 'rgba(42, 34, 51, 0.6)', 1.6); }
    face(); c.strokeStyle = INK; c.lineWidth = LW; c.stroke();
    cap(c, x - 4, y - 4, w + 4);
    return;
  }
  if (t.kind === 'rock' || t.kind === 'burrow') {
    const earth = t.kind === 'burrow';
    // A rugged front edge: bulges and notches down the side, rounded into the underside.
    const bumps: number[] = [];
    for (let i = 0, n = Math.max(3, Math.round((h - 20) / 44)); i <= n; i++) bumps.push(x + (i % 2 ? -8 : 6) + ((i * 13) % 7) - 3, y + ((h - 20) * i) / n);
    const body = () => {
      c.beginPath(); c.moveTo(x + 6, y);
      for (let i = 0; i < bumps.length; i += 2) c.quadraticCurveTo(bumps[i] - 10, bumps[i + 1] - 18, bumps[i], bumps[i + 1]);
      c.quadraticCurveTo(x - 4, y + h, x + 24, y + h); c.lineTo(x + w, y + h); c.lineTo(x + w, y); c.closePath();
    };
    body(); c.fillStyle = earth ? vgrad(c, y, y + h, [[0, '#8a5a3a'], [1, '#6a4028']]) : vgrad(c, y, y + h, [[0, '#8f8078'], [1, '#b0a198']]); c.fill();
    for (let i = 0; i < Math.floor(h / 40); i++) {
      const sy = y + 20 + i * 40 + rand() * 10;
      c.beginPath(); c.moveTo(x + 10, sy); c.quadraticCurveTo(x + w / 3, sy - 5, x + w * 0.6, sy + 2); c.quadraticCurveTo(x + w * 0.8, sy + 6, x + w, sy);
      c.strokeStyle = earth ? 'rgba(40, 20, 10, 0.35)' : '#857670'; c.lineWidth = 2; c.stroke();
    }
    for (let i = 0; i < w / 50; i++) { const px = x + 16 + rand() * (w - 30), py = y + 10 + rand() * (h - 30); ell(c, px, py, 3 + rand() * 5, 2 + rand() * 4); c.fillStyle = earth ? '#a0704a' : '#cbbfb6'; c.fill(); }
    if (!earth) for (let i = 0; i < 4; i++) { const cx = x + 30 + rand() * (w - 60), cy = y + 20 + rand() * (h - 60); lineTo(c, [cx, cy, cx - 6, cy + 14, cx + 2, cy + 26, cx - 3, cy + 38], 'rgba(42, 34, 51, 0.45)', 1.6); }
    if (earth) for (let i = 0; i < 5; i++) { const rx = x + 40 + rand() * (w - 60); c.beginPath(); c.moveTo(rx, y + h); c.quadraticCurveTo(rx + 8, y + h + 14, rx + 2, y + h + 24); c.strokeStyle = '#5a3a22'; c.lineWidth = 2.4; c.stroke(); }
    else for (let i = 0; i < w / 60; i++) { const sx = x + 20 + rand() * (w - 30); c.beginPath(); c.moveTo(sx - 6, y + h); c.lineTo(sx, y + h + 8 + rand() * 10); c.lineTo(sx + 6, y + h); c.fillStyle = '#a49389'; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.6; c.stroke(); }
    body(); c.strokeStyle = INK; c.lineWidth = LW; c.stroke();
    if (y > 0) cap(c, x - 4, y - 4, w + 4);
    if (earth) {
      // The burrow's front door frame, round-topped, with a lantern.
      const fx = x, top = y + h;
      c.fillStyle = '#8a5a2c'; c.fillRect(fx - 10, top - 4, 14, GROUND - top + 4);
      c.strokeStyle = INK; c.lineWidth = 2; c.strokeRect(fx - 10, top - 4, 14, GROUND - top + 4);
      c.beginPath(); c.arc(fx + 50, top + 6, 62, Math.PI * 1.08, Math.PI * 1.92); c.strokeStyle = INK; c.lineWidth = 12; c.stroke(); c.strokeStyle = '#a86a3a'; c.lineWidth = 8; c.stroke();
      lineTo(c, [fx - 4, top + 12, fx - 4, top + 30], INK, 2);
      ell(c, fx - 4, top + 38, 7, 9); c.fillStyle = '#ffd86a'; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.6; c.stroke();
      const glow = c.createRadialGradient(fx - 4, top + 38, 0, fx - 4, top + 38, 60); glow.addColorStop(0, 'rgba(255, 210, 120, 0.4)'); glow.addColorStop(1, 'rgba(255, 210, 120, 0)'); c.fillStyle = glow; c.fillRect(fx - 64, top - 22, 120, 120);
    }
    return;
  }
  if (t.kind === 'house') {
    c.fillStyle = vgrad(c, y, y + h, [[0, '#f2e2c8'], [1, '#d8c2a0']]); c.fillRect(x, y, w, h);
    c.strokeStyle = '#8a5a3a'; c.lineWidth = 6;
    for (const bx of [x + 6, x + w - 6]) lineTo(c, [bx, y + 10, bx, y + h], '#8a5a3a', 8);
    lineTo(c, [x, y + h * 0.5, x + w, y + h * 0.5], '#8a5a3a', 7);
    for (const [wx, wy] of [[x + w * 0.28, y + h * 0.22], [x + w * 0.72, y + h * 0.22]]) {
      c.beginPath(); c.roundRect(wx - 20, wy - 18, 40, 36, [18, 18, 4, 4]); c.fillStyle = '#ffd87a'; c.fill(); c.strokeStyle = INK; c.lineWidth = 2; c.stroke();
      lineTo(c, [wx, wy - 18, wx, wy + 18], INK, 2); lineTo(c, [wx - 20, wy + 2, wx + 20, wy + 2], INK, 2);
    }
    c.beginPath(); c.roundRect(x + w / 2 - 22, y + h - 70, 44, 70, [22, 22, 0, 0]); c.fillStyle = '#a86a3a'; c.fill(); c.strokeStyle = INK; c.lineWidth = 2; c.stroke();
    ell(c, x + w / 2 + 12, y + h - 34, 3, 3); c.fillStyle = '#ffd84a'; c.fill();
    c.strokeStyle = INK; c.lineWidth = LW; c.strokeRect(x, y, w, h);
    // A tiled parapet on the walkable roof, and a chimney.
    c.fillStyle = vgrad(c, y - 12, y + 8, [[0, '#d8746a'], [1, '#a84a42']]); c.fillRect(x - 8, y - 2, w + 16, 12);
    c.strokeStyle = INK; c.lineWidth = 2; c.strokeRect(x - 8, y - 2, w + 16, 12);
    for (let tx = x - 4; tx < x + w + 6; tx += 16) lineTo(c, [tx, y - 2, tx, y + 10], 'rgba(60, 20, 20, 0.5)', 1.4);
    c.fillStyle = '#b0a098'; c.fillRect(x + w - 40, y - 36, 22, 34); c.strokeStyle = INK; c.lineWidth = 2; c.strokeRect(x + w - 40, y - 36, 22, 34);
    return;
  }
  if (t.kind === 'shelf') {
    c.fillStyle = vgrad(c, y, y + h, [[0, '#c98b4e'], [1, '#8a5a2c']]); c.fillRect(x, y, w, h);
    c.strokeStyle = INK; c.lineWidth = 2; c.strokeRect(x, y, w, h);
    for (const bx of [x + 20, x + w - 20]) { c.beginPath(); c.moveTo(bx, y + h); c.lineTo(bx, y + h + 24); c.lineTo(bx + (bx < x + w / 2 ? 20 : -20), y + h); c.fillStyle = '#6a4a2a'; c.fill(); c.stroke(); }
    if (x < 400) for (let i = 0; i < 4; i++) {
      const jx = x + 30 + i * 44, jh = 30 + (i % 2) * 10;
      c.beginPath(); c.roundRect(jx - 14, y - jh, 28, jh, 6); c.fillStyle = ['#e8a82a', '#8ac4ec', '#e8726a', '#b8d87a'][i]; c.globalAlpha = 0.85; c.fill(); c.globalAlpha = 1; c.strokeStyle = INK; c.lineWidth = 1.8; c.stroke();
      c.fillStyle = '#f2e2c8'; c.fillRect(jx - 15, y - jh - 6, 30, 7); c.strokeRect(jx - 15, y - jh - 6, 30, 7);
    }
  }
}
function cap(c: C, x: number, y: number, w: number) {
  c.beginPath(); c.moveTo(x, y + 20); c.quadraticCurveTo(x + 6, y + 2, x + 40, y + 2); c.lineTo(x + w, y); c.lineTo(x + w, y + 20); c.lineTo(x + 40, y + 22); c.quadraticCurveTo(x + 10, y + 26, x, y + 20); c.closePath();
  c.fillStyle = vgrad(c, y, y + 24, [[0, '#86d467'], [1, '#5daa47']]); c.fill(); c.strokeStyle = INK; c.lineWidth = LW; c.stroke();
  for (let fx = x + 18; fx < x + w - 6; fx += 18) { c.beginPath(); c.moveTo(fx, y + 20); c.lineTo(fx + 4, y + 30 + (fx % 3) * 3); c.lineTo(fx + 8, y + 20); c.fillStyle = '#6fc257'; c.fill(); c.lineWidth = 1.5; c.stroke(); }
  for (let fx = x + 30; fx < x + w - 10; fx += 40) { c.beginPath(); c.moveTo(fx, y + 2); c.lineTo(fx + 3, y - 8); c.lineTo(fx + 6, y); c.lineTo(fx + 9, y - 10); c.lineTo(fx + 12, y + 2); c.fillStyle = '#86d467'; c.fill(); c.lineWidth = 1.5; c.stroke(); }
}
function flower(c: C, x: number, base: number, h: number, col: string) {
  lineTo(c, [x, base, x - 2, base - h / 2, x, base - h], '#3f8f3e', 2);
  for (let i = 0; i < 5; i++) { c.save(); c.translate(x, base - h); c.rotate((i / 5) * Math.PI * 2); ell(c, 0, -4, 2.6, 4.2); c.fillStyle = col; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.1; c.stroke(); c.restore(); }
  ell(c, x, base - h, 2.4, 2.4); c.fillStyle = '#ffb21f'; c.fill();
}

// ---------- Moving parts ----------

function water(c: C, g: Game, t: number) {
  for (const w of g.water) {
    if (w.frozen) {
      c.fillStyle = vgrad(c, w.y, w.y + w.h, [[0, '#e0f4ff'], [1, '#9fd0f0']]); c.fillRect(w.x, w.y, w.w, w.h);
      for (let i = 0; i < 5; i++) lineTo(c, [w.x + 20 + i * w.w / 5, w.y + 6, w.x + 40 + i * w.w / 5, w.y + 26, w.x + 30 + i * w.w / 5, w.y + 50], 'rgba(255,255,255,0.8)', 1.6);
      lineTo(c, [w.x, w.y, w.x + w.w, w.y], '#4a8ac8', LW);
      continue;
    }
    c.fillStyle = vgrad(c, w.y, w.y + w.h, [[0, 'rgba(90, 176, 236, 0.92)'], [1, 'rgba(40, 100, 180, 0.95)']]); c.fillRect(w.x, w.y, w.w, w.h);
    c.beginPath(); c.moveTo(w.x, w.y);
    for (let x = w.x; x <= w.x + w.w; x += 10) c.lineTo(x, w.y + Math.sin(x / 24 + t * 2.4) * 2.2);
    c.strokeStyle = '#2a6ab0'; c.lineWidth = 2; c.stroke();
    for (let i = 0; i < 4; i++) { const x = w.x + ((i * 83 + t * 20) % w.w); lineTo(c, [x, w.y + 14 + i * 12, x + 18, w.y + 14 + i * 12], 'rgba(255,255,255,0.45)', 2); }
  }
}

function lookOf(e: Ent): string {
  if (e.look === 'golden') return '#f2c230';
  if (e.look === 'metal') return '#a9b0bc';
  if (e.look === 'wooden') return '#c7874a';
  if (e.look === 'stone') return '#9d948c';
  return e.tint ?? e.color;
}
const RAINBOW = ['#e8403a', '#f5921e', '#f5d23a', '#4ab85a', '#3a8ae8', '#9a5ae0'];

function thing(c: C, e: Ent, t: number, k: number, focus: boolean) {
  const art = ART[e.art] ?? ART.box;
  const L: Look = { w: e.w, h: e.h, col: lookOf(e), t: t + e.id * 0.37, moving: Math.abs(e.vx) > 5, mood: e.mood, id: e.id };
  const fly = e.tags.has('fly') && !e.grounded;
  const bobY = fly && !e.held ? Math.sin(t * 2.2 + e.id) * 3 : 0;
  // Contact shadow on whatever is below.
  if (!e.held) {
    const under = e.grounded || e.floating ? e.y : Math.min(GROUND, e.y + 160);
    const far = Math.min(1, Math.max(0, (under - e.y) / 160));
    ell(c, e.x, under + 2, e.w * 0.42 * (1 - far * 0.4), 5); c.fillStyle = `rgba(29, 20, 40, ${0.2 * (1 - far * 0.7)})`; c.fill();
  }
  if (e.tags.has('light') || e.look === 'glowing') {
    const r = Math.max(e.w, e.h) * 0.9;
    const gl = c.createRadialGradient(e.x, e.y - e.h / 2, 0, e.x, e.y - e.h / 2, r);
    gl.addColorStop(0, 'rgba(255, 236, 150, 0.45)'); gl.addColorStop(1, 'rgba(255, 236, 150, 0)');
    c.fillStyle = gl; c.fillRect(e.x - r, e.y - e.h / 2 - r, r * 2, r * 2);
  }
  const draw = (x: C) => {
    x.save(); x.translate(e.x, e.y + bobY);
    if (e.face < 0) x.scale(-1, 1);
    art(x, L);
    x.restore();
  };
  const winged = e.adjs.includes('flying') && !['bird', 'bigbird', 'butterfly', 'bee', 'dragon', 'plane', 'helicopter', 'owl', 'parrot'].includes(e.art);
  if (winged) wings(c, e, t, bobY);
  c.save();
  if (e.look === 'ghostly') c.globalAlpha = 0.55;
  if (e.pattern || e.look === 'frozen' || e.look === 'golden' || e.look === 'fluffy') {
    const pad = 30, x0 = e.x - e.w / 2 - pad, y0 = e.y - e.h - pad;
    composite(c, k, x0, y0, e.w + pad * 2, e.h + pad * 2 + 6, 0, draw, (x) => {
      if (e.pattern === 'stripes') { x.fillStyle = 'rgba(255, 255, 255, 0.4)'; for (let i = -e.h; i < e.w; i += 16) { x.beginPath(); x.moveTo(x0 + pad + i, y0); x.lineTo(x0 + pad + i + 8, y0); x.lineTo(x0 + pad + i + 8 + e.h + pad * 2, y0 + e.h + pad * 2); x.lineTo(x0 + pad + i + e.h + pad * 2, y0 + e.h + pad * 2); x.fill(); } }
      if (e.pattern === 'spots') { x.fillStyle = 'rgba(42, 34, 51, 0.35)'; for (let i = 0; i < 12; i++) { ell(x, e.x - e.w / 2 + ((i * 37) % 100) / 100 * e.w, e.y - e.h + ((i * 61) % 100) / 100 * e.h, 4 + (i % 3) * 2, 4 + (i % 3) * 2); x.fill(); } }
      if (e.pattern === 'rainbow') { x.globalAlpha = 0.5; for (let i = 0; i < 6; i++) { x.fillStyle = RAINBOW[i]; x.fillRect(x0, e.y - e.h + (e.h * i) / 6, e.w + pad * 2, e.h / 6 + 1); } x.globalAlpha = 1; }
      if (e.look === 'frozen') { x.fillStyle = 'rgba(170, 220, 255, 0.5)'; x.fillRect(x0, y0, e.w + pad * 2, e.h + pad * 2); x.strokeStyle = 'rgba(255, 255, 255, 0.85)'; x.lineWidth = 2; for (let i = 0; i < 3; i++) { x.beginPath(); x.moveTo(e.x - e.w * 0.3 + i * e.w * 0.25, e.y - e.h * 0.8); x.lineTo(e.x - e.w * 0.2 + i * e.w * 0.25, e.y - e.h * 0.6); x.stroke(); } }
      if (e.look === 'golden') { x.fillStyle = 'rgba(255, 210, 60, 0.35)'; x.fillRect(x0, y0, e.w + pad * 2, e.h + pad * 2); x.fillStyle = 'rgba(255, 255, 255, 0.9)'; for (let i = 0; i < 3; i++) { const sx = e.x - e.w * 0.3 + i * e.w * 0.3, sy = e.y - e.h * (0.3 + (i % 2) * 0.4), s = 3 + Math.sin(t * 4 + i) * 1.5; x.beginPath(); x.moveTo(sx, sy - s * 2); x.lineTo(sx + s * 0.6, sy); x.lineTo(sx, sy + s * 2); x.lineTo(sx - s * 0.6, sy); x.fill(); } }
      if (e.look === 'fluffy') { x.fillStyle = 'rgba(255, 255, 255, 0.28)'; x.fillRect(x0, y0, e.w + pad * 2, e.h + pad * 2); }
    });
  } else draw(c);
  c.restore();
  // Flames on things that caught fire, and a fizzing fuse.
  if (e.burning > 0 && !['fire', 'campfire', 'torch', 'candle'].includes(e.art)) {
    c.save(); c.translate(e.x, e.y - e.h * 0.55); ART.fire(c, { w: Math.min(80, e.w * 0.8), h: Math.min(90, e.h * 0.9 + 20), col: '', t: t + e.id, moving: false, mood: 'calm', id: e.id }); c.restore();
  }
  if (e.fuse > 0 && !['bomb', 'dynamite'].includes(e.art)) { ell(c, e.x, e.y - e.h - 6, 4 + Math.sin(t * 20) * 2, 4); c.fillStyle = '#ffd23a'; c.fill(); }
  if (e.fuse > 0) { c.fillStyle = INK; c.font = '800 14px ui-rounded, system-ui, sans-serif'; c.textAlign = 'center'; c.fillText(String(Math.ceil(e.fuse)), e.x, e.y - e.h - 16); }
  if (e.mood === 'sleepy' && e.tags.has('alive')) zzz(c, e.x + e.w * 0.3, e.y - e.h, t);
  if (e.mood === 'angry' && e.tags.has('alive')) { c.fillStyle = '#e8403a'; c.font = '900 18px ui-rounded, system-ui, sans-serif'; c.textAlign = 'center'; c.fillText('!', e.x, e.y - e.h - 8); }
  // Name tag for fresh summons, and a dashed outline on the one you picked.
  const age = t - e.born;
  if (!e.level && (age < 2.6 || focus)) {
    c.save(); c.globalAlpha = focus ? 1 : Math.min(1, (2.6 - age) * 2);
    tag(c, e.label, e.x, Math.max(26, e.y - e.h - (e.fuse > 0 ? 34 : 14)));
    c.restore();
  }
  if (focus) { c.save(); c.setLineDash([6, 5]); c.strokeStyle = 'rgba(42, 34, 51, 0.7)'; c.lineWidth = 2; c.strokeRect(e.x - e.w / 2 - 6, e.y - e.h - 6, e.w + 12, e.h + 12); c.restore(); }
}
/** Feathered wings on anything written as "flying", flapping behind it. */
function wings(c: C, e: Ent, t: number, bobY: number) {
  const s = Math.min(1.5, Math.max(0.35, Math.min(e.h, e.w) / 90)), flap = Math.sin(t * 9 + e.id) * 0.28;
  for (const side of [-1, 1]) {
    c.save(); c.translate(e.x + side * e.w * 0.38, e.y - e.h * 0.62 + bobY); c.scale(side * s, s); c.rotate(-flap);
    c.beginPath(); c.moveTo(0, -2); c.bezierCurveTo(40, -50, 90, -40, 100, -20); c.bezierCurveTo(80, -18, 76, -10, 90, -2); c.bezierCurveTo(70, 0, 66, 8, 76, 16); c.bezierCurveTo(50, 18, 26, 16, 0, 14); c.closePath();
    c.fillStyle = vgrad(c, -40, 16, [[0, '#ffffff'], [1, '#dbe3f1']]); c.fill(); c.strokeStyle = INK; c.lineWidth = LW / s; c.lineJoin = 'round'; c.stroke();
    for (const [y, x] of [[-8, 70], [4, 60]]) { c.beginPath(); c.moveTo(16, y + 2); c.quadraticCurveTo(40, y - 10, x, y - 6); c.strokeStyle = '#b8c4dc'; c.lineWidth = 1.6 / s; c.stroke(); }
    c.restore();
  }
}
function tag(c: C, text: string, x: number, y: number) {
  c.font = '600 15px ui-rounded, "SF Pro Rounded", system-ui, sans-serif';
  const w = c.measureText(text).width + 24;
  c.beginPath(); c.roundRect(x - w / 2, y - 26, w, 26, 13); c.fillStyle = INK; c.fill();
  c.fillStyle = '#ffffff'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, x, y - 12.5); c.textBaseline = 'alphabetic';
}
function zzz(c: C, x: number, y: number, t: number) {
  c.fillStyle = '#6a4fb3'; c.textAlign = 'center';
  for (let i = 0; i < 3; i++) { const p = (t * 0.6 + i / 3) % 1; c.globalAlpha = 1 - p; c.font = `800 ${10 + p * 10}px ui-rounded, system-ui, sans-serif`; c.fillText('z', x + p * 16, y - p * 30); }
  c.globalAlpha = 1;
}

function resident(c: C, e: Ent, t: number, k: number) {
  if (e.art === 'pebble') {
    const shiver = e.mood === 'happy' ? 0 : Math.sin(t * 40) * 1.2;
    chinchilla(c, k, PEBBLE, e.x + shiver, e.y, e.face, t, Math.abs(e.vx) > 5, false, false, 96, 3, (x) => {
      // Spectacles and, once warm, a smile of a scarf.
      x.strokeStyle = INK; x.lineWidth = 0.35; ell(x, 10.3, -12.2, 1.6, 1.4); x.stroke(); ell(x, 6.6, -12.2, 1.4, 1.3); x.stroke();
      if (e.mood === 'happy') { x.beginPath(); x.moveTo(3, -9.5); x.quadraticCurveTo(7, -7.5, 11, -9.2); x.strokeStyle = '#e25a6a'; x.lineWidth = 1.6; x.stroke(); }
    });
    if (e.mood !== 'happy') { c.fillStyle = '#8ac4ec'; c.font = '800 16px ui-rounded, system-ui, sans-serif'; c.textAlign = 'center'; c.fillText('brrr', e.x, e.y - e.h - 6 + Math.sin(t * 6) * 2); }
    return;
  }
  thing(c, e, t, k, false);
  if (e.role?.kind === 'blocker' && e.mood !== 'happy') { c.fillStyle = INK; c.font = '800 16px ui-rounded, system-ui, sans-serif'; c.textAlign = 'center'; c.fillText('?', e.x + 30 * e.face, e.y - e.h - 8 + Math.sin(t * 4) * 2); }
  if (e.mood === 'caged' || e.mood === 'sleepy') zzz(c, e.x + 20, e.y - e.h, t);
}

// ---------- Dora and Enzo ----------

const chinFrame = (h: number) => ({ w: h * 2.4, h: h * 1.6 });
/** The arcade's chinchilla, lit from the top left like everything else in this game. */
function chinchilla(c: C, k: number, coat: Coat, x: number, base: number, face: 1 | -1, t: number, moving: boolean, air: boolean, dizzy: boolean, h = 64, run = 0, decorate?: (x: C, bob: number) => void) {
  const f = chinFrame(h), x0 = x - f.w / 2, y0 = base - f.h;
  composite(c, k, x0, y0, f.w, f.h + 4, 1, (o) => drawChinchilla(o, coat, x, base, { face, h, time: t, moving, air, dizzy, run, decorate }), (o) => {
    const g = o.createRadialGradient(x - face * h * 0.25, base - h * 0.75, h * 0.1, x, base - h * 0.35, h * 0.9);
    g.addColorStop(0, 'rgba(255, 255, 255, 0.28)'); g.addColorStop(0.55, 'rgba(255, 255, 255, 0)'); g.addColorStop(1, 'rgba(40, 20, 60, 0.26)');
    o.fillStyle = g; o.fillRect(x0, y0, f.w, f.h + 4);
  });
}
function hero(c: C, g: Game, ch: Chin, t: number, k: number) {
  const coat = COATS[ch.id];
  const moving = Math.abs(ch.vx) > 10 && ch.grounded && ch.riding === null;
  const air = !ch.grounded && !ch.climbing && ch.riding === null;
  const hop = ch.cheer > 0 ? -Math.abs(Math.sin(t * 8)) * 14 : 0;
  const climb = ch.climbing ? Math.sin(ch.y / 8) * 2 : 0;
  ell(c, ch.x, ch.y + 2, 26, 4.5); c.fillStyle = ch.grounded ? 'rgba(29, 20, 40, 0.22)' : 'rgba(29, 20, 40, 0.08)'; c.fill();
  chinchilla(c, k, coat, ch.x + climb, ch.y + hop, ch.face, t + (ch.id === 'enzo' ? 1.7 : 0), moving, air || ch.cheer > 0, ch.stun > 0, 62, ch.run);
  if (ch.id === g.leader && g.state === 'playing') {
    const y = ch.y - CHIN_H - 34 + Math.sin(t * 4) * 3;
    c.beginPath(); c.moveTo(ch.x, y + 12); c.lineTo(ch.x - 10, y - 2); c.lineTo(ch.x + 10, y - 2); c.closePath();
    c.fillStyle = '#ff7a59'; c.fill(); c.strokeStyle = INK; c.lineWidth = 2; c.lineJoin = 'round'; c.stroke();
  }
}

function berry(c: C, g: Game, t: number) {
  const b = g.berry;
  if (!b || b.got) return;
  if (!b.lit) return;
  const x = b.x, y = b.y - 22 + Math.sin(t * 2.5) * 3;
  const glow = c.createRadialGradient(x, y, 0, x, y, 54); glow.addColorStop(0, 'rgba(255, 226, 122, 0.85)'); glow.addColorStop(1, 'rgba(255, 226, 122, 0)');
  c.fillStyle = glow; c.fillRect(x - 60, y - 60, 120, 120);
  ell(c, x, b.y + 2, 16, 3.5); c.fillStyle = 'rgba(29, 58, 26, 0.22)'; c.fill();
  lineTo(c, [x, y - 20, x - 4, y - 30, x + 2, y - 34], INK, 2.4);
  c.beginPath(); c.moveTo(x + 4, y - 26); c.quadraticCurveTo(x + 16, y - 36, x + 24, y - 27); c.quadraticCurveTo(x + 14, y - 20, x + 4, y - 26); c.fillStyle = '#6fc257'; c.fill(); c.strokeStyle = INK; c.lineWidth = 2; c.stroke();
  const bg = c.createRadialGradient(x - 5, y - 8, 1, x, y, 22); bg.addColorStop(0, '#ffe98a'); bg.addColorStop(0.45, '#ffb21f'); bg.addColorStop(1, '#d86f00');
  c.beginPath(); c.ellipse(x, y, 16, 21, 0, 0, Math.PI * 2); c.fillStyle = bg; c.fill(); c.strokeStyle = INK; c.lineWidth = LW; c.stroke();
  ell(c, x - 6, y - 9, 4, 7); c.fillStyle = '#fff6cc'; c.fill();
  for (let i = 0; i < 3; i++) {
    const a = t * 1.5 + (i * Math.PI * 2) / 3, sx = x + Math.cos(a) * 34, sy = y + Math.sin(a) * 26, s = 5 + Math.sin(t * 5 + i) * 2;
    c.beginPath(); c.moveTo(sx, sy - s); c.lineTo(sx + s * 0.35, sy - s * 0.35); c.lineTo(sx + s, sy); c.lineTo(sx + s * 0.35, sy + s * 0.35); c.lineTo(sx, sy + s); c.lineTo(sx - s * 0.35, sy + s * 0.35); c.lineTo(sx - s, sy); c.lineTo(sx - s * 0.35, sy - s * 0.35); c.closePath();
    c.fillStyle = '#fff6c8'; c.fill(); c.strokeStyle = '#e9b93a'; c.lineWidth = 1; c.stroke();
  }
}

// ---------- Ambient life ----------

function ambient(c: C, g: Game, t: number) {
  const kind = g.def.sky;
  const fly = (x: number, y: number, col: string, s: number) => {
    const f = 0.55 + Math.abs(Math.sin(t * 11 + x)) * 0.45;
    c.save(); c.translate(x, y); c.scale(f * s, s);
    for (const d of [-1, 1]) { c.beginPath(); c.moveTo(0, 0); c.bezierCurveTo(d * 6, -16, d * 22, -16, d * 18, -4); c.bezierCurveTo(d * 16, 2, d * 6, 2, 0, 0); c.fillStyle = col; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.6; c.stroke(); c.beginPath(); c.moveTo(0, 1); c.bezierCurveTo(d * 4, 10, d * 14, 12, d * 12, 4); c.fillStyle = light(col, 0.3); c.fill(); c.stroke(); }
    c.restore();
    lineTo(c, [x, y - 6 * s, x, y + 8 * s], INK, 2.4);
  };
  if (kind === 'meadow') {
    fly(260 + Math.sin(t * 0.7) * 60, 240 + Math.sin(t * 1.3) * 30, '#ffa24a', 1);
    fly(560 + Math.cos(t * 0.5) * 80, 390 + Math.sin(t * 1.1) * 24, '#7fb7ff', 0.9);
    const bx = 600 + Math.sin(t * 0.9) * 120, by = 320 + Math.sin(t * 2.3) * 20;
    ell(c, bx, by, 11, 8); c.fillStyle = '#ffd23a'; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.8; c.stroke();
    lineTo(c, [bx - 3, by - 7, bx - 3, by + 7], INK, 3); lineTo(c, [bx + 4, by - 7, bx + 4, by + 7], INK, 3);
    for (const d of [-2, 6]) { ell(c, bx + d, by - 10, 5, 7); c.fillStyle = 'rgba(238, 246, 255, 0.9)'; c.fill(); c.lineWidth = 1.3; c.stroke(); }
  } else if (kind === 'mountain') {
    const cx = (t * 40) % (W + 300) - 150, cy = 120 + Math.sin(t * 0.8) * 20;
    c.save(); c.translate(cx, cy); const f = Math.sin(t * 3) * 0.3;
    c.beginPath(); c.moveTo(-40, -6 + f * 20); c.quadraticCurveTo(-18, -12, 0, 0); c.quadraticCurveTo(18, -12, 40, -6 + f * 20); c.quadraticCurveTo(18, -4, 0, 4); c.quadraticCurveTo(-18, -4, -40, -6 + f * 20); c.fillStyle = '#2e2a30'; c.fill(); c.restore();
    for (let i = 0; i < 24; i++) { const x = (i * 97 + t * 18) % W, y = (i * 61 + t * 30) % 420; ell(c, x, y, 1.8, 1.8); c.fillStyle = 'rgba(255, 255, 255, 0.8)'; c.fill(); }
  } else if (kind === 'town') {
    for (let i = 0; i < 8; i++) { const x = (i * 131 + Math.sin(t * 0.5 + i) * 40) % W, y = 300 + Math.sin(t * 0.9 + i * 2) * 60 + (i % 3) * 30; const a = 0.4 + 0.4 * Math.sin(t * 3 + i); const gl = c.createRadialGradient(x, y, 0, x, y, 10); gl.addColorStop(0, `rgba(230, 255, 140, ${a})`); gl.addColorStop(1, 'rgba(230, 255, 140, 0)'); c.fillStyle = gl; c.fillRect(x - 10, y - 10, 20, 20); }
  } else {
    for (let i = 0; i < 20; i++) { const x = (i * 71 + t * 6) % W, y = (i * 53 + Math.sin(t + i) * 20) % 460; ell(c, x, y, 1.2, 1.2); c.fillStyle = 'rgba(255, 230, 190, 0.35)'; c.fill(); }
  }
}

// ---------- Effects ----------

function effects(c: C, g: Game) {
  for (const f of g.fx) {
    const p = f.t / 1.4;
    c.save(); c.globalAlpha = Math.max(0, 1 - p);
    if (f.kind === 'poof' || f.kind === 'steam') {
      for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; ell(c, f.x + Math.cos(a) * (10 + p * 40), f.y + Math.sin(a) * (8 + p * 30) - (f.kind === 'steam' ? p * 40 : 0), 10 + p * 8, 10 + p * 8); c.fillStyle = f.kind === 'steam' ? '#d8dce6' : '#ffffff'; c.fill(); c.strokeStyle = 'rgba(42, 34, 51, 0.35)'; c.lineWidth = 1.4; c.stroke(); }
    } else if (f.kind === 'boom') {
      const r = 30 + p * 140;
      const gr = c.createRadialGradient(f.x, f.y, 0, f.x, f.y, r); gr.addColorStop(0, 'rgba(255, 250, 200, 1)'); gr.addColorStop(0.4, 'rgba(255, 160, 50, 0.9)'); gr.addColorStop(1, 'rgba(120, 60, 40, 0)');
      c.fillStyle = gr; ell(c, f.x, f.y, r, r); c.fill();
      for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; lineTo(c, [f.x + Math.cos(a) * r * 0.6, f.y + Math.sin(a) * r * 0.6, f.x + Math.cos(a) * r, f.y + Math.sin(a) * r], '#ffd23a', 3); }
    } else if (f.kind === 'splash') {
      for (let i = 0; i < 8; i++) { const a = -Math.PI * (0.1 + (i / 8) * 0.8); ell(c, f.x + Math.cos(a) * p * 60, f.y + Math.sin(a) * p * 60 + p * p * 80, 4, 6); c.fillStyle = '#5aaaf0'; c.fill(); }
    } else if (f.kind === 'rubble') {
      for (let i = 0; i < 10; i++) { const a = -Math.PI * (i / 10); const x = f.x + Math.cos(a) * p * 120, y = f.y + Math.sin(a) * p * 90 + p * p * 200; c.beginPath(); c.roundRect(x - 8, y - 6, 16, 12, 4); c.fillStyle = '#9d948c'; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.4; c.stroke(); }
    } else if (f.kind === 'spark' || f.kind === 'bounce') {
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; lineTo(c, [f.x + Math.cos(a) * (6 + p * 20), f.y + Math.sin(a) * (6 + p * 20), f.x + Math.cos(a) * (12 + p * 30), f.y + Math.sin(a) * (12 + p * 30)], f.kind === 'spark' ? '#ffd23a' : '#ffffff', 3); }
    } else if (f.kind === 'heart') {
      for (let i = 0; i < 4; i++) { const x = f.x - 30 + i * 20, y = f.y - p * 70 - i * 6; c.fillStyle = '#ff6a8a'; c.beginPath(); c.moveTo(x, y + 6); c.bezierCurveTo(x - 10, y - 2, x - 5, y - 10, x, y - 4); c.bezierCurveTo(x + 5, y - 10, x + 10, y - 2, x, y + 6); c.fill(); c.strokeStyle = INK; c.lineWidth = 1.4; c.stroke(); }
    } else if (f.kind === 'eat') {
      for (let i = 0; i < 6; i++) { ell(c, f.x + (i - 3) * 8, f.y - p * 30 + (i % 2) * 6, 3, 3); c.fillStyle = '#d9a066'; c.fill(); }
    }
    c.restore();
  }
}

// ---------- The dark storeroom ----------

function darkness(c: C, g: Game, k: number) {
  const { cv, x } = scratch(2, W * k, H * k);
  x.setTransform(k, 0, 0, k, 0, 0);
  x.fillStyle = 'rgba(8, 6, 18, 0.86)'; x.fillRect(0, 0, W, H);
  x.globalCompositeOperation = 'destination-out';
  const hole = (px: number, py: number, r: number) => { const gr = x.createRadialGradient(px, py, 0, px, py, r); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.85)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(px - r, py - r, r * 2, r * 2); };
  for (const e of g.ents) if (e.tags.has('light') || e.burning > 0) hole(e.x, e.y - e.h / 2, LIGHT_REACH + 40);
  for (const ch of [g.chins.dora, g.chins.enzo]) hole(ch.x, ch.y - 22, 90);
  x.globalCompositeOperation = 'source-over';
  c.drawImage(cv, 0, 0, W * k, H * k, 0, 0, W, H);
}

/** One frame of the level. `k` is the device scale the canvas is drawn at. */
export function drawWorld(c: C, g: Game, t: number, k: number, focus: number | null) {
  c.drawImage(backdrop(g, k), 0, 0, W * k, H * k, 0, 0, W, H);
  ambient(c, g, t);
  const back = g.ents.filter((e) => e.level && e.art !== 'plate');
  for (const e of g.ents) if (e.art === 'plate') thing(c, e, t, k, false);
  for (const e of back) {
    const r = e.role;
    if (r?.kind === 'gate') { c.save(); c.beginPath(); c.rect(e.x - e.w, 0, e.w * 2, r.baseY); c.clip(); c.translate(0, -r.open * e.h); thing(c, e, t, k, false); c.restore(); }
    else resident(c, e, t, k);
  }
  berry(c, g, t);
  const mine = g.ents.filter((e) => !e.level);
  // Ridden things go behind their riders; the rest in the order they arrived.
  for (const e of mine) thing(c, e, t, k, focus === e.id);
  for (const ch of [g.follow, g.lead]) hero(c, g, ch, t, k);
  for (const e of mine) if (e.tags.has('hang') && e.riders.length) thing(c, e, t, k, false);
  water(c, g, t);
  effects(c, g);
  if (g.def.dark) darkness(c, g, k);
}

/** Dora and Enzo together, for the title card. */
export function drawHeroes(c: C, w: number, h: number, t: number) {
  c.clearRect(0, 0, w, h);
  drawChinchilla(c, COATS.enzo, w * 0.62, h * 0.9, { face: -1, h: h * 0.5, time: t + 1.7 });
  drawChinchilla(c, COATS.dora, w * 0.36, h * 0.94, { face: 1, h: h * 0.52, time: t });
  void dark;
}
