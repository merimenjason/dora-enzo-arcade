// Canvas 2D drawing for Frostpaw Frontier: a snowy Andean mountainside seen from above, tile by tile, under a sea of
// cloud that rolls back as you explore. Meadows, groves, rocks, snowfields and crags; the burrow with Dora and Enzo
// at the door; farms, lodges, nests, quarries, lanterns and watchtowers; predator dens; the summit beacon. Night
// darkens everything but the lantern light, and the raiders come in from the dens and the edge of the cloud.
import { COATS, coatLike, drawChinchilla, type Coat } from './chinchilla-art';
import { predator, TINT, type PredKind } from './predator-art';
import { fitDraw } from './art-fit';
import {
  Game, W, H, HOME, DAY, CYCLE, RAID_AT, DENS, BUILDINGS, type BuildingId, type HeroId, type DenKind, type Terrain,
} from './frontier-game';

type C2D = CanvasRenderingContext2D;
export const T = 48, PAD = 10, VIEW = W * T + PAD * 2;
/** The camera: the square of tiles in view, its top-left corner and width in tiles. */
export type Cam = { x: number; y: number; size: number };
export const FULL: Cam = { x: 0, y: 0, size: W };
const zoom = (cam: Cam) => (VIEW - PAD * 2) / (cam.size * T);
/** The tile under a point on the canvas (in view pixels). */
export const tileAt = (px: number, py: number, cam: Cam = FULL) => {
  const k = zoom(cam);
  return { x: Math.floor((px - PAD) / k / T + cam.x), y: Math.floor((py - PAD) / k / T + cam.y) };
};
/** Where the camera wants to be: the land you hold and a ring of cloud round it, at least seven tiles across. */
export function camFor(g: Game): Cam {
  let x0 = W, y0 = H, x1 = 0, y1 = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (g.tile(x, y)!.seen) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  x0 -= 1.5; y0 -= 1.5; x1 += 2.5; y1 += 2.5;
  const size = Math.min(W, Math.max(7, x1 - x0, y1 - y0)), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  return { x: Math.max(0, Math.min(W - size, cx - size / 2)), y: Math.max(0, Math.min(H - size, cy - size / 2)), size };
}
const X = (x: number) => PAD + x * T, Y = (y: number) => PAD + y * T;

export const COAT: Record<HeroId, Coat> = {
  dora: COATS.dora,
  enzo: COATS.enzo,
  pebble: coatLike('enzo', { fur: '#a9a7b0', back: '#8a8891', face: '#c4c2ca', shade: '#96949d', texture: '#8f8d96', tail: '#b0aeb7', tailOuter: '#8c8a94', tailInner: '#d2d0d8', bands: false }),
  kiki: coatLike('dora', { fur: '#ecd6b3', back: '#d8bc90', face: '#f4e4cb', shade: '#caa97e', texture: '#cfb48b', tail: '#e9d2ad', tailInner: '#d0b58c', eye: '#1a1418', pupil: '#000000', eyeR: 2 }),
  luna: coatLike('dora', { fur: '#c9b6e4', back: '#a993cf', face: '#ddd0f0', shade: '#a28dc4', texture: '#ad98d0', tail: '#c4b0e0', tailOuter: '#a28bc8', tailInner: '#e2d6f2', eye: '#2a1840', pupil: '#0e0618' }),
};
const SETTLER = coatLike('enzo', { fur: '#b8a48c', back: '#9a8670', face: '#cdbba4', shade: '#a2907a', texture: '#9a8670', tail: '#b8a48c', tailOuter: '#9a8670', tailInner: '#d8c8b2', bands: false });

/** A small fixed number for each tile, so decorations stay put. */
const hash = (x: number, y: number, k = 0) => { let h = (x * 374761393 + y * 668265263 + k * 2147483647) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const ell = (c: C2D, x: number, y: number, rx: number, ry: number, fill: string) => { c.fillStyle = fill; c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2); c.fill(); };
const rect = (c: C2D, x: number, y: number, w: number, h: number, r: number, fill: string, line?: string) => { c.beginPath(); c.roundRect(x, y, w, h, r); c.fillStyle = fill; c.fill(); if (line) { c.strokeStyle = line; c.lineWidth = 1.2; c.stroke(); } };

const GROUND: Record<Terrain, [string, string]> = {
  meadow: ['#8fc06a', '#76a956'], grove: ['#6fa552', '#5a8f42'], rocks: ['#b6ad9c', '#9c9382'], snow: ['#eef4fa', '#d6e2ee'], crag: ['#7d7884', '#635e6a'],
};

function ground(c: C2D, t: Terrain, x: number, y: number) {
  const px = X(x), py = Y(y), [a, b] = GROUND[t];
  const g = c.createLinearGradient(px, py, px, py + T); g.addColorStop(0, a); g.addColorStop(1, b);
  c.fillStyle = g; c.fillRect(px, py, T, T);
  if (t === 'meadow' || t === 'grove') {
    c.strokeStyle = 'rgba(40, 80, 30, 0.35)'; c.lineWidth = 1;
    for (let i = 0; i < 4; i++) { const gx = px + 6 + hash(x, y, i) * (T - 12), gy = py + 8 + hash(x, y, i + 9) * (T - 14); c.beginPath(); c.moveTo(gx, gy); c.lineTo(gx - 2, gy - 4); c.moveTo(gx, gy); c.lineTo(gx + 2, gy - 4); c.stroke(); }
    if (t === 'meadow' && hash(x, y, 30) < 0.4) ell(c, px + 10 + hash(x, y, 31) * 28, py + 12 + hash(x, y, 32) * 26, 1.8, 1.8, hash(x, y, 33) < 0.5 ? '#fff6c8' : '#f4b6c8');
  } else if (t === 'snow') {
    ell(c, px + 14 + hash(x, y, 1) * 20, py + 30, 14, 5, 'rgba(255,255,255,0.9)');
    ell(c, px + 30, py + 14 + hash(x, y, 2) * 8, 10, 4, 'rgba(190, 210, 232, 0.55)');
  } else if (t === 'rocks') {
    for (let i = 0; i < 3; i++) { const rx = px + 10 + hash(x, y, i) * 26, ry = py + 14 + hash(x, y, i + 5) * 24, r = 5 + hash(x, y, i + 7) * 5; ell(c, rx, ry + 2, r, r * 0.6, 'rgba(60, 50, 40, 0.25)'); ell(c, rx, ry, r, r * 0.75, '#c9c1b1'); ell(c, rx - r * 0.3, ry - r * 0.3, r * 0.45, r * 0.3, '#e2dccf'); }
  } else if (t === 'crag') {
    c.fillStyle = '#58535f'; c.beginPath(); c.moveTo(px + 2, py + T - 4); c.lineTo(px + T * 0.42, py + 6); c.lineTo(px + T - 2, py + T - 4); c.fill();
    c.fillStyle = '#8d8896'; c.beginPath(); c.moveTo(px + T * 0.42, py + 6); c.lineTo(px + T * 0.6, py + T - 4); c.lineTo(px + T - 2, py + T - 4); c.fill();
    c.fillStyle = '#f4f8fc'; c.beginPath(); c.moveTo(px + T * 0.42, py + 6); c.lineTo(px + T * 0.3, py + 18); c.lineTo(px + T * 0.4, py + 15); c.lineTo(px + T * 0.48, py + 19); c.lineTo(px + T * 0.55, py + 15); c.fill();
  }
}

function trees(c: C2D, x: number, y: number, time: number) {
  const px = X(x), py = Y(y);
  const spots = [[14, 22, 10], [32, 18, 11], [24, 36, 9]];
  for (const [dx, dy, r] of spots) {
    const sway = Math.sin(time * 1.3 + x + y + dx) * 0.8;
    ell(c, px + dx, py + dy + r * 0.9, r * 0.8, r * 0.3, 'rgba(20, 40, 15, 0.3)');
    c.fillStyle = '#6b4a2a'; c.fillRect(px + dx - 1.5, py + dy, 3, r * 0.8);
    ell(c, px + dx + sway, py + dy - 2, r, r * 0.85, '#3f7a34');
    ell(c, px + dx - r * 0.3 + sway, py + dy - r * 0.4, r * 0.55, r * 0.45, '#5c9a48');
  }
}

// ---------- Buildings ----------

/** A building drawn in a 48 × 48 box with its top-left at (px, py). */
export function building(c: C2D, kind: BuildingId, px: number, py: number, time: number, lit = false) {
  if (kind === 'farm') {
    for (let r = 0; r < 3; r++) { rect(c, px + 5, py + 8 + r * 12, 38, 8, 3, r % 2 ? '#e3c25a' : '#d8b04a', '#9a7a2a'); for (let i = 0; i < 5; i++) { c.strokeStyle = '#b08a2a'; c.beginPath(); c.moveTo(px + 9 + i * 8, py + 9 + r * 12); c.lineTo(px + 9 + i * 8, py + 15 + r * 12); c.stroke(); } }
    ell(c, px + 38, py + 40, 6, 5, '#e9c860'); ell(c, px + 38, py + 37, 4, 3, '#f4dc84');
  } else if (kind === 'lodge') {
    rect(c, px + 8, py + 20, 32, 22, 3, '#8a5a30', '#4a2c14');
    for (let i = 0; i < 4; i++) { c.strokeStyle = '#5e3a1c'; c.beginPath(); c.moveTo(px + 8, py + 25 + i * 5); c.lineTo(px + 40, py + 25 + i * 5); c.stroke(); }
    c.fillStyle = '#5a3418'; c.beginPath(); c.moveTo(px + 4, py + 22); c.lineTo(px + 24, py + 6); c.lineTo(px + 44, py + 22); c.closePath(); c.fill();
    c.fillStyle = '#f2f6fa'; c.beginPath(); c.moveTo(px + 10, py + 17); c.lineTo(px + 24, py + 6); c.lineTo(px + 38, py + 17); c.lineTo(px + 24, py + 11); c.closePath(); c.fill();
    rect(c, px + 20, py + 30, 8, 12, 2, '#3a2010');
    for (let i = 0; i < 3; i++) ell(c, px + 40 - i * 3, py + 42 - i * 2, 3, 2.4, '#a87a4a');
  } else if (kind === 'nest') {
    ell(c, px + 24, py + 40, 18, 5, 'rgba(40,30,10,0.3)');
    c.fillStyle = '#d8b36a'; c.beginPath(); c.ellipse(px + 24, py + 30, 18, 14, 0, Math.PI, 0); c.lineTo(px + 42, py + 38); c.lineTo(px + 6, py + 38); c.closePath(); c.fill();
    c.strokeStyle = '#a07a3a'; c.lineWidth = 1; for (let i = 0; i < 6; i++) { c.beginPath(); c.arc(px + 24, py + 38, 6 + i * 3, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); }
    ell(c, px + 24, py + 34, 6, 5, '#3a2410');
  } else if (kind === 'quarry') {
    ell(c, px + 24, py + 28, 18, 13, '#7e7466'); ell(c, px + 24, py + 30, 13, 9, '#5e554a');
    for (let i = 0; i < 4; i++) ell(c, px + 14 + i * 7, py + 14 + (i % 2) * 4, 4, 3, '#d4ccbd');
    c.strokeStyle = '#6b4a2a'; c.lineWidth = 2.4; c.beginPath(); c.moveTo(px + 34, py + 42); c.lineTo(px + 42, py + 28); c.stroke();
    c.strokeStyle = '#9aa0a8'; c.lineWidth = 2.6; c.beginPath(); c.moveTo(px + 37, py + 26); c.quadraticCurveTo(px + 43, py + 26, px + 47, py + 31); c.stroke();
  } else if (kind === 'lantern') {
    if (lit) { const g = c.createRadialGradient(px + 24, py + 14, 2, px + 24, py + 14, 22); g.addColorStop(0, 'rgba(255, 230, 140, 0.9)'); g.addColorStop(1, 'rgba(255, 200, 80, 0)'); c.fillStyle = g; c.fillRect(px, py - 8, 48, 44); }
    c.fillStyle = '#4a3020'; c.fillRect(px + 22, py + 16, 4, 28); ell(c, px + 24, py + 44, 8, 3, '#4a3020');
    rect(c, px + 16, py + 6, 16, 16, 4, lit ? '#ffe28a' : '#8a8478', '#3a2818');
    c.fillStyle = '#3a2818'; c.fillRect(px + 14, py + 4, 20, 3);
    if (lit) ell(c, px + 24, py + 14 + Math.sin(time * 8) * 0.6, 3, 4.5, '#fff8d8');
  } else if (kind === 'tower') {
    c.strokeStyle = '#6b4424'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(px + 12, py + 44); c.lineTo(px + 18, py + 14); c.moveTo(px + 36, py + 44); c.lineTo(px + 30, py + 14); c.moveTo(px + 14, py + 34); c.lineTo(px + 34, py + 24); c.moveTo(px + 34, py + 34); c.lineTo(px + 14, py + 24); c.stroke();
    rect(c, px + 12, py + 8, 24, 8, 2, '#8a5a30', '#4a2c14');
    c.fillStyle = '#b8462e'; c.beginPath(); c.moveTo(px + 10, py + 9); c.lineTo(px + 24, py + 0); c.lineTo(px + 38, py + 9); c.closePath(); c.fill();
    c.fillStyle = '#f2e6c8'; c.beginPath(); c.moveTo(px + 24, py + 0); c.lineTo(px + 24, py - 6); c.lineTo(px + 31, py - 3); c.closePath(); c.fill();
  } else {
    // The Summit Beacon.
    c.fillStyle = '#6e6878'; c.beginPath(); c.moveTo(px + 8, py + 44); c.lineTo(px + 14, py + 22); c.lineTo(px + 34, py + 22); c.lineTo(px + 40, py + 44); c.closePath(); c.fill();
    rect(c, px + 10, py + 18, 28, 6, 2, '#8d8896');
    const f = 1 + Math.sin(time * 9) * 0.08;
    ell(c, px + 24, py + 10, 12 * f, 14 * f, 'rgba(255, 150, 40, 0.85)'); ell(c, px + 24, py + 13, 7 * f, 9 * f, '#ffe680'); ell(c, px + 24, py + 15, 3.5, 4, '#fffbe8');
  }
}

/** A predator from the shared drawings, feet at (x, y), `h` pixels tall. */
function beast(c: C2D, kind: DenKind | PredKind, x: number, y: number, h: number, time: number, face = 1) {
  c.save(); c.translate(x, y); c.scale((face * h) / 24, h / 24); predator(c, kind as PredKind, TINT[kind as PredKind], time); c.restore();
}

function den(c: C2D, kind: DenKind, x: number, y: number, time: number, power: number, squad: number) {
  const px = X(x), py = Y(y), lair = kind === 'cougar';
  ell(c, px + 24, py + 34, 20, 11, lair ? '#4a3a32' : '#5a4630'); ell(c, px + 24, py + 36, 11, 7, '#1c140e');
  beast(c, kind, px + 22, py + 38, lair ? 30 : 22, time, -1);
  // Power badge: green when the squad can win, red when it can't.
  const ok = squad >= power;
  rect(c, px + 2, py + 2, 22, 13, 6, ok ? '#3f8a3a' : '#a8382e', 'rgba(0,0,0,0.4)');
  c.fillStyle = '#fff'; c.font = 'bold 9px ui-sans-serif, system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(power), px + 13, py + 9);
}

function home(c: C2D, g: Game, time: number) {
  const px = X(HOME.x), py = Y(HOME.y);
  ell(c, px + 24, py + 40, 26, 7, 'rgba(30,20,10,0.35)');
  const lv = g.hqLevel, r = 18 + lv * 2;
  c.fillStyle = '#8a6a44'; c.beginPath(); c.ellipse(px + 24, py + 36, r, r * 0.8, 0, Math.PI, 0); c.closePath(); c.fill();
  c.fillStyle = '#6fa552'; c.beginPath(); c.ellipse(px + 24, py + 36 - r * 0.55, r * 0.8, r * 0.3, 0, Math.PI, 0); c.closePath(); c.fill();
  if (lv >= 3) { c.fillStyle = '#5a4630'; c.fillRect(px + 34, py + 10, 5, 10); ell(c, px + 36 + Math.sin(time) * 2, py + 6 - (time * 6) % 8, 3, 3, 'rgba(230,230,240,0.6)'); }
  ell(c, px + 24, py + 34, 8, 8, '#2a1a0c'); c.fillStyle = '#2a1a0c'; c.fillRect(px + 16, py + 34, 16, 4);
  if (lv >= 2) { c.strokeStyle = '#d8b36a'; c.lineWidth = 2; c.beginPath(); c.arc(px + 24, py + 34, 9, Math.PI, 0); c.stroke(); }
  if (lv >= 4) { c.fillStyle = '#c0392b'; c.fillRect(px + 10, py + 6, 2, 16); c.beginPath(); c.moveTo(px + 12, py + 6); c.lineTo(px + 20, py + 9); c.lineTo(px + 12, py + 12); c.fill(); }
  drawChinchilla(c, COATS.dora, px + 4, py + 46, { face: 1, h: 14, time });
  drawChinchilla(c, COATS.enzo, px + 44, py + 46, { face: -1, h: 15, time: time + 1.7 });
}

function feature(c: C2D, g: Game, x: number, y: number, time: number) {
  const t = g.tile(x, y)!, px = X(x), py = Y(y);
  if (t.f === 'stray') {
    drawChinchilla(c, SETTLER, px + 24, py + 40, { face: hash(x, y) < 0.5 ? 1 : -1, h: 18, time: time + x });
    const bob = Math.sin(time * 4 + x) * 1.5;
    rect(c, px + 30, py + 2 + bob, 15, 13, 5, '#fff8e8', '#6e5d57'); c.fillStyle = '#6e5d57'; c.font = 'bold 10px ui-sans-serif, system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('?', px + 37.5, py + 9 + bob);
  } else if ((t.f === 'den' || t.f === 'lair') && t.den) den(c, t.den, x, y, time, DENS[t.den].power, g.squadPower);
  else if (t.f === 'beacon') {
    c.fillStyle = '#6e6878'; c.beginPath(); c.moveTo(px + 12, py + 42); c.lineTo(px + 16, py + 26); c.lineTo(px + 32, py + 26); c.lineTo(px + 36, py + 42); c.closePath(); c.fill();
    rect(c, px + 14, py + 22, 20, 5, 2, '#8d8896');
    for (let i = 0; i < 3; i++) { c.strokeStyle = '#6b4a2a'; c.lineWidth = 2; c.beginPath(); c.moveTo(px + 18 + i * 6, py + 22); c.lineTo(px + 22 + i * 3, py + 14); c.stroke(); }
    const pulse = 0.5 + 0.5 * Math.sin(time * 3);
    c.strokeStyle = `rgba(255, 220, 120, ${0.4 + pulse * 0.5})`; c.lineWidth = 2; c.setLineDash([4, 3]); c.strokeRect(px + 3, py + 3, T - 6, T - 6); c.setLineDash([]);
  }
}

// ---------- Fog ----------

function fog(c: C2D, x: number, y: number, time: number, frontier: boolean) {
  const px = X(x), py = Y(y);
  c.fillStyle = '#c7d2e2'; c.fillRect(px, py, T, T);
  for (let i = 0; i < 4; i++) {
    const dx = 8 + hash(x, y, i) * 32 + Math.sin(time * 0.4 + i + x) * 2, dy = 8 + hash(x, y, i + 4) * 32, r = 12 + hash(x, y, i + 8) * 8;
    ell(c, px + dx, py + dy + 2, r, r * 0.8, 'rgba(150, 165, 190, 0.5)');
    ell(c, px + dx, py + dy, r, r * 0.8, i % 2 ? '#eef2f8' : '#dfe6f0');
  }
  if (frontier) {
    c.strokeStyle = 'rgba(255, 255, 255, 0.9)'; c.lineWidth = 1.5; c.setLineDash([3, 3]); c.strokeRect(px + 3.5, py + 3.5, T - 7, T - 7); c.setLineDash([]);
    // A little paw print: you can explore here.
    const cx = px + 24, cy = py + 26;
    ell(c, cx, cy + 3, 5, 4, 'rgba(110, 120, 150, 0.55)');
    for (const [dx, dy] of [[-6, -3], [-2, -7], [3, -7], [7, -3]]) ell(c, cx + dx, cy + dy, 2, 2.4, 'rgba(110, 120, 150, 0.55)');
  }
}

// ---------- The whole view ----------

export type Fx = { kind: 'text' | 'burst' | 'puff'; x: number; y: number; t: number; text?: string; color?: string };
export type View = { sel: { x: number; y: number } | null; ghost: { kind: BuildingId; x: number; y: number; ok: boolean } | null; fx: Fx[]; cam?: Cam };

export function drawWorld(c: C2D, g: Game, time: number, view: View) {
  c.fillStyle = '#2a3446'; c.fillRect(0, 0, VIEW, VIEW);
  const cam = view.cam ?? FULL, k = zoom(cam);
  c.save();
  c.beginPath(); c.rect(PAD, PAD, VIEW - PAD * 2, VIEW - PAD * 2); c.clip();
  c.translate(PAD, PAD); c.scale(k, k); c.translate(-cam.x * T - PAD, -cam.y * T - PAD);
  drawInside(c, g, time, view);
  c.restore();
}

function drawInside(c: C2D, g: Game, time: number, view: View) {
  // Tiles you hold, then features, then the cloud on top.
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const t = g.tile(x, y)!;
    if (!t.seen) continue;
    ground(c, t.t, x, y);
    if (g.lit(x, y)) { c.fillStyle = 'rgba(255, 220, 120, 0.14)'; c.fillRect(X(x), Y(y), T, T); }
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const t = g.tile(x, y)!;
    if (!t.seen) continue;
    const b = g.buildingAt(x, y);
    if (t.t === 'grove' && b?.kind !== 'lodge') trees(c, x, y, time);
    if (t.f === 'home') home(c, g, time);
    else if (b) {
      building(c, b.kind, X(x), Y(y), time, b.kind === 'lantern' && !b.damaged && g.stock.wood > 0);
      if (b.damaged) {
        c.strokeStyle = '#2a1a10'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(X(x) + 14, Y(y) + 14); c.lineTo(X(x) + 22, Y(y) + 24); c.lineTo(X(x) + 18, Y(y) + 32); c.stroke();
        for (let i = 0; i < 2; i++) ell(c, X(x) + 30 + i * 4, Y(y) + 10 - ((time * 8 + i * 6) % 12), 4, 4, 'rgba(80, 80, 90, 0.45)');
      }
      const need = BUILDINGS[b.kind].workers;
      for (let i = 0; i < need; i++) ell(c, X(x) + T - 6 - i * 7, Y(y) + T - 5, 2.6, 2.6, i < b.workers ? '#ffe28a' : 'rgba(30, 20, 10, 0.5)');
    } else feature(c, g, x, y, time);
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!g.tile(x, y)!.seen) fog(c, x, y, time, g.canExplore(x, y) === 'ok' || g.canExplore(x, y) === 'stamina');
  // Soft edges between cloud and land.
  c.strokeStyle = 'rgba(30, 40, 60, 0.18)'; c.lineWidth = 1;
  for (let i = 0; i <= W; i++) { c.beginPath(); c.moveTo(X(i), Y(0)); c.lineTo(X(i), Y(H)); c.stroke(); c.beginPath(); c.moveTo(X(0), Y(i)); c.lineTo(X(W), Y(i)); c.stroke(); }

  // Night: dark everywhere but the lanterns and the burrow door.
  const tc = g.time % CYCLE, dusk = tc < DAY - 6 ? 0 : tc < DAY ? (tc - (DAY - 6)) / 6 : tc > CYCLE - 4 ? (CYCLE - tc) / 4 : 1;
  if (dusk > 0) {
    c.save();
    c.globalAlpha = dusk;
    c.fillStyle = 'rgba(16, 22, 52, 0.62)'; c.fillRect(0, 0, VIEW, VIEW);
    c.globalCompositeOperation = 'lighter';
    const glow = (x: number, y: number, r: number, a: number) => { const gr = c.createRadialGradient(x, y, 2, x, y, r); gr.addColorStop(0, `rgba(255, 200, 110, ${a})`); gr.addColorStop(1, 'rgba(255, 200, 110, 0)'); c.fillStyle = gr; c.fillRect(x - r, y - r, r * 2, r * 2); };
    glow(X(HOME.x) + 24, Y(HOME.y) + 32, 70, 0.28);
    for (const b of g.buildings) if (b.kind === 'lantern' && !b.damaged && g.stock.wood > 0) glow(X(b.x) + 24, Y(b.y) + 14, (g.reach() + 0.5) * T, 0.22);
    for (const b of g.buildings) if (b.kind === 'beacon') glow(X(b.x) + 24, Y(b.y) + 12, 160, 0.5);
    c.restore();
  }
  for (const b of g.buildings) if (b.kind === 'beacon') { const gr = c.createRadialGradient(X(b.x) + 24, Y(b.y) + 12, 4, X(b.x) + 24, Y(b.y) + 12, 120); gr.addColorStop(0, 'rgba(255, 210, 100, 0.35)'); gr.addColorStop(1, 'rgba(255, 210, 100, 0)'); c.fillStyle = gr; c.fillRect(0, 0, VIEW, VIEW); }

  // The raid: predators creep from where they set out towards the burrow, then scatter or break in.
  const r = g.raid;
  if (r && g.night) {
    const k = Math.min(1, (tc - DAY) / RAID_AT), home = { x: X(HOME.x) + 24, y: Y(HOME.y) + 30 };
    r.from.forEach((f, i) => {
      const sx = X(f.x) + 24, sy = Y(f.y) + 34;
      let px = sx + (home.x - sx) * k * 0.85, py = sy + (home.y - sy) * k * 0.85;
      if (r.done) { const back = Math.min(1, (tc - DAY - RAID_AT) / 3); const dir = r.held ? 1 : 0.3; px += (sx - px) * back * dir; py += (sy - py) * back * dir; }
      const face = home.x >= sx ? 1 : -1;
      ell(c, px, py + 1, 8, 3, 'rgba(0,0,0,0.35)');
      beast(c, f.kind === 'cougar' ? 'cougar' : f.kind, px, py, 18, time * 2 + i, r.done && r.held ? -face : face);
      if (!r.done || !r.held) { c.fillStyle = '#ff5a3a'; ell(c, px + face * 5, py - 14, 1.3, 1.3, '#ffdf6a'); }
    });
    if (r.done) {
      const a = Math.max(0, 1 - (tc - DAY - RAID_AT) / 4);
      c.globalAlpha = a; c.font = '900 18px ui-sans-serif, system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.lineWidth = 5; c.strokeStyle = 'rgba(20, 10, 30, 0.8)';
      const msg = r.held ? `Raid held! ${r.defence} vs ${r.strength}` : `The raid broke in! ${r.defence} vs ${r.strength}`;
      c.strokeText(msg, home.x, home.y - 40); c.fillStyle = r.held ? '#bff08a' : '#ff8a6a'; c.fillText(msg, home.x, home.y - 40);
      c.globalAlpha = 1;
    }
  }

  // Selection and the building ghost.
  if (view.ghost) {
    const { x, y, ok, kind } = view.ghost;
    c.globalAlpha = 0.6; building(c, kind, X(x), Y(y), time); c.globalAlpha = 1;
    c.strokeStyle = ok ? '#7dff8a' : '#ff6a5a'; c.lineWidth = 2.5; c.strokeRect(X(x) + 1.5, Y(y) + 1.5, T - 3, T - 3);
  }
  if (view.sel) {
    const { x, y } = view.sel, pulse = 0.6 + 0.4 * Math.sin(time * 5);
    c.strokeStyle = `rgba(255, 226, 120, ${pulse})`; c.lineWidth = 3; c.strokeRect(X(x) + 1.5, Y(y) + 1.5, T - 3, T - 3);
  }
  // Floating words and bursts.
  for (const f of view.fx) {
    const a = Math.max(0, 1 - f.t / 1.6), px = X(f.x) + 24, py = Y(f.y) + 20 - f.t * 18;
    if (f.kind === 'text') {
      c.globalAlpha = a; c.font = 'bold 12px ui-sans-serif, system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.lineWidth = 3; c.strokeStyle = 'rgba(20, 20, 30, 0.75)'; c.strokeText(f.text!, px, py); c.fillStyle = f.color ?? '#fff6c8'; c.fillText(f.text!, px, py); c.globalAlpha = 1;
    } else if (f.kind === 'burst') {
      c.globalAlpha = a; c.strokeStyle = f.color ?? '#ffe28a'; c.lineWidth = 2;
      for (let i = 0; i < 8; i++) { const an = (i / 8) * Math.PI * 2, r0 = 6 + f.t * 20, r1 = r0 + 6; c.beginPath(); c.moveTo(X(f.x) + 24 + Math.cos(an) * r0, Y(f.y) + 24 + Math.sin(an) * r0); c.lineTo(X(f.x) + 24 + Math.cos(an) * r1, Y(f.y) + 24 + Math.sin(an) * r1); c.stroke(); }
      c.globalAlpha = 1;
    } else {
      for (let i = 0; i < 5; i++) ell(c, X(f.x) + 24 + Math.cos(i * 1.3) * f.t * 30, Y(f.y) + 24 + Math.sin(i * 1.3) * f.t * 30, 10 * a, 8 * a, `rgba(240, 245, 252, ${a})`);
    }
  }
}

// ---------- Icons for the page ----------

export function drawBuildingIcon(c: C2D, kind: BuildingId, w: number, h: number) {
  c.clearRect(0, 0, w, h);
  const k = Math.min(w, h) / 52;
  c.save(); c.translate((w - 48 * k) / 2, (h - 48 * k) / 2 + 2 * k); c.scale(k, k); building(c, kind, 0, 0, 0, true); c.restore();
}
export function drawHeroIcon(c: C2D, id: HeroId, w: number, h: number, hurt = false) {
  c.clearRect(0, 0, w, h);
  fitDraw(c, `frontier-hero-${id}`, 0, 0, w, h, (d) => drawChinchilla(d, COAT[id], 0, 0, { face: 1, h: 24, time: 0, dizzy: false }));
  if (hurt) { c.fillStyle = 'rgba(200, 40, 40, 0.85)'; c.fillRect(w - 14, 2, 12, 4); c.fillRect(w - 10, -2 + 0, 4, 12); }
}
export function drawDenIcon(c: C2D, kind: DenKind, w: number, h: number) {
  c.clearRect(0, 0, w, h);
  fitDraw(c, `frontier-den-${kind}`, 2, 2, w - 4, h - 4, (d) => predator(d, kind as PredKind, TINT[kind as PredKind], 0), -1);
}
/** The title picture: Dora and Enzo on a snowy ridge with a lantern, the beacon far off. */
export function drawTitle(c: C2D, w: number, h: number, time: number) {
  const sky = c.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, '#2a3a66'); sky.addColorStop(1, '#8aa6d0');
  c.fillStyle = sky; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 18; i++) ell(c, hash(i, 1) * w, hash(i, 2) * h * 0.5, 1, 1, 'rgba(255,255,255,0.8)');
  c.fillStyle = '#c7d2e6'; c.beginPath(); c.moveTo(0, h * 0.62); c.lineTo(w * 0.28, h * 0.3); c.lineTo(w * 0.5, h * 0.55); c.lineTo(w * 0.78, h * 0.22); c.lineTo(w, h * 0.5); c.lineTo(w, h); c.lineTo(0, h); c.fill();
  c.fillStyle = '#f4f8fc'; c.beginPath(); c.moveTo(w * 0.78, h * 0.22); c.lineTo(w * 0.72, h * 0.32); c.lineTo(w * 0.84, h * 0.32); c.fill();
  const f = 1 + Math.sin(time * 6) * 0.1;
  ell(c, w * 0.78, h * 0.19, 5 * f, 6 * f, '#ffc850'); ell(c, w * 0.78, h * 0.19, 14 * f, 14 * f, 'rgba(255, 200, 80, 0.25)');
  c.fillStyle = '#eef3fa'; c.beginPath(); c.moveTo(0, h * 0.82); c.quadraticCurveTo(w * 0.5, h * 0.66, w, h * 0.84); c.lineTo(w, h); c.lineTo(0, h); c.fill();
  building(c, 'lantern', w * 0.5 - 24, h * 0.86 - 48, time, true);
  drawChinchilla(c, COATS.dora, w * 0.3, h * 0.86, { face: 1, h: h * 0.3, time });
  drawChinchilla(c, COATS.enzo, w * 0.7, h * 0.87, { face: -1, h: h * 0.33, time: time + 1.4 });
}
