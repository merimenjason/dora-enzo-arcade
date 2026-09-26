// Canvas 2D drawing for Hay Maze Defence: the map and its rocks, the route the predators will take (redrawn as you
// build), the burrow with Dora and Enzo at the door, the towers and their chinchilla crews, the predators, shots and
// effects. The grid is 20 × 12 tiles of 32 px with a margin for predators arriving and the burrow.
import { MazeGame, TOWERS, ENEMIES, COLS, ROWS, INF, type TowerId, type Tower, type Enemy, type Effect, type Shot } from './hay-maze-game';
import { COATS, coatLike, drawChinchilla, type Coat } from './chinchilla-art';

export const TILE = 32, OX = 26, OY = 22, VIEW_W = OX + COLS * TILE + 46, VIEW_H = OY + ROWS * TILE + 14;
export const toGrid = (px: number, py: number) => ({ c: Math.floor((px - OX) / TILE), r: Math.floor((py - OY) / TILE) });
const X = (x: number) => OX + x * TILE, Y = (y: number) => OY + y * TILE;

type Look = { a: string; b: string; edge: string; rock: string; rockDark: string; route: string; deco: 'clover' | 'cactus' | 'star'; sky: string };
const LOOKS: Record<string, Look> = {
  meadow: { a: '#93c96b', b: '#8bc163', edge: '#6f9e4d', rock: '#a9a397', rockDark: '#7c776c', route: 'rgba(255, 244, 200, 0.75)', deco: 'clover', sky: '#cfe8a8' },
  canyon: { a: '#d9b98a', b: '#d2b082', edge: '#b08656', rock: '#b0714a', rockDark: '#7d4c30', route: 'rgba(255, 255, 240, 0.8)', deco: 'cactus', sky: '#f0cf9c' },
  summit: { a: '#557d68', b: '#4f7662', edge: '#34503f', rock: '#8f93a8', rockDark: '#5e6278', route: 'rgba(210, 230, 255, 0.75)', deco: 'star', sky: '#2a3150' },
};
export const lookOf = (id: string) => LOOKS[id] ?? LOOKS.meadow;

const blackEyes = { eye: '#16121a', pupil: '#000000', earGlow: false, eyeR: 1.75 };
const KIT: Coat = coatLike('dora', { ...blackEyes, fur: '#eeeaf0', back: '#dad3df', face: '#f6f3f8', shade: '#ccc4d2', texture: '#d8d0dc', tail: '#ebe6ee', tailInner: '#cfc6d6' });
const PEBBLE: Coat = coatLike('enzo', { fur: '#a9a7b0', back: '#8a8891', face: '#c4c2ca', shade: '#96949d', texture: '#8f8d96', tail: '#b0aeb7', tailOuter: '#8c8a94', tailInner: '#d2d0d8', bands: false });

const ellipse = (c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill?: string, rot = 0) => {
  c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2);
  if (fill) { c.fillStyle = fill; c.fill(); }
};
const hash = (n: number) => { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); };

// ---------- The map ----------

function ground(c: CanvasRenderingContext2D, g: MazeGame, look: Look, time: number) {
  c.fillStyle = look.edge; c.fillRect(0, 0, VIEW_W, VIEW_H);
  for (let r = 0; r < ROWS; r++) for (let col = 0; col < COLS; col++) {
    c.fillStyle = (r + col) % 2 ? look.a : look.b;
    c.fillRect(X(col), Y(r), TILE, TILE);
  }
  // Little decorations that don't get in the way.
  for (let i = 0; i < 70; i++) {
    const x = X(hash(i) * COLS), y = Y(hash(i + 99) * ROWS);
    if (look.deco === 'clover') { for (const a of [0, 2.1, 4.2]) ellipse(c, x + Math.cos(a) * 2, y + Math.sin(a) * 2, 1.8, 1.8, 'rgba(60, 120, 50, 0.45)'); }
    else if (look.deco === 'cactus') { c.fillStyle = 'rgba(140, 100, 60, 0.35)'; c.fillRect(x, y, 2, 2); }
    else { const tw = 0.5 + 0.5 * Math.sin(time * 2 + i); ellipse(c, x, y, 0.8 + tw * 0.6, 0.8 + tw * 0.6, `rgba(220, 240, 255, ${0.15 + tw * 0.2})`); }
  }
  for (let r = 0; r < ROWS; r++) for (let col = 0; col < COLS; col++) if (g.rock(col, r)) rock(c, X(col) + TILE / 2, Y(r) + TILE / 2, look, col * 7 + r);
  // Entrances: worn gaps in the hedge with arrows pointing in.
  for (const [ec, er] of g.entrances) {
    const top = er === 0 && ec > 0, x = X(ec) + TILE / 2, y = Y(er) + TILE / 2;
    c.fillStyle = 'rgba(120, 80, 40, 0.35)';
    if (top) c.fillRect(X(ec), 0, TILE, OY); else c.fillRect(0, Y(er), OX, TILE);
    c.fillStyle = '#b3232f';
    c.save(); c.translate(top ? x : 12, top ? 10 : y); if (top) c.rotate(Math.PI / 2);
    c.beginPath(); c.moveTo(-6, -5); c.lineTo(5, 0); c.lineTo(-6, 5); c.closePath(); c.fill();
    c.restore();
  }
}

function rock(c: CanvasRenderingContext2D, x: number, y: number, look: Look, seed: number) {
  ellipse(c, x + 2, y + 9, 13, 5, 'rgba(0, 0, 0, 0.18)');
  c.fillStyle = look.rock; c.strokeStyle = look.rockDark; c.lineWidth = 1.5;
  c.beginPath();
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2, rr = 12 + hash(seed + i) * 3; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.85); }
  c.closePath(); c.fill(); c.stroke();
  ellipse(c, x - 4, y - 5, 4, 2.5, 'rgba(255, 255, 255, 0.25)');
}

/** The burrow at the right edge, with the raisin stash and Dora and Enzo peeking out. */
function burrow(c: CanvasRenderingContext2D, g: MazeGame, time: number) {
  const rows = g.exits.map(([, r]) => r), top = Y(Math.min(...rows)), bottom = Y(Math.max(...rows) + 1), mid = (top + bottom) / 2, x = X(COLS);
  c.fillStyle = '#8a6a44'; c.beginPath(); c.ellipse(x + 26, mid, 34, (bottom - top) / 2 + 26, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#6b4e30'; c.beginPath(); c.ellipse(x + 26, mid, 26, (bottom - top) / 2 + 16, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#2a1c12'; c.beginPath(); c.ellipse(x + 20, mid + 4, 14, (bottom - top) / 2 - 2, 0, 0, Math.PI * 2); c.fill();
  // Raisins left in the stash.
  const shown = Math.min(20, g.raisins);
  for (let i = 0; i < shown; i++) ellipse(c, x + 14 + (i % 5) * 4, mid + 18 - Math.floor(i / 5) * 3.5, 2.4, 2, i % 2 ? '#5a2a4a' : '#6e3558');
  const scared = g.effects.some((e) => e.kind === 'leak');
  drawChinchilla(c, COATS.dora, x + 30, top - 2, { face: -1, h: 20, time, blink: false, dizzy: scared });
  drawChinchilla(c, COATS.enzo, x + 30, bottom + 18, { face: -1, h: 22, time: time + 2, dizzy: scared });
}

/** A dotted line along each route, with arrows showing the way. */
function routes(c: CanvasRenderingContext2D, g: MazeGame, look: Look, time: number, d?: Int32Array) {
  c.save();
  c.strokeStyle = look.route; c.lineWidth = 2.5; c.setLineDash([2, 7]); c.lineDashOffset = -time * 14; c.lineCap = 'round';
  for (let e = 0; e < g.entrances.length; e++) {
    const path = g.route(e, d);
    c.beginPath();
    path.forEach(([pc, pr], i) => { const x = X(pc) + TILE / 2, y = Y(pr) + TILE / 2; if (i) c.lineTo(x, y); else c.moveTo(x, y); });
    c.lineTo(X(COLS) + 6, Y(path.at(-1)![1]) + TILE / 2);
    c.stroke();
  }
  c.restore();
}

// ---------- Towers ----------

const LEVEL_TINT = ['#c9a26b', '#c0c6d6', '#f2c94c'];

/** A tower on its tile, or on a palette button when `g` is null. */
export function tower(c: CanvasRenderingContext2D, kind: TowerId, x: number, y: number, o: { level: number; time: number; aim?: number; flash?: number }) {
  const t = o.time, face: 1 | -1 = Math.cos(o.aim ?? 0) >= 0 ? 1 : -1, s = TILE / 32;
  if (kind === 'hay') {
    c.fillStyle = 'rgba(0, 0, 0, 0.2)'; c.fillRect(x - 13 * s, y + 6 * s, 28 * s, 6 * s);
    c.fillStyle = '#e8c35a'; c.strokeStyle = '#a07a24'; c.lineWidth = 1.3;
    c.beginPath(); c.roundRect(x - 14 * s, y - 11 * s, 28 * s, 22 * s, 4 * s); c.fill(); c.stroke();
    c.strokeStyle = '#c9a03c'; c.lineWidth = 0.9;
    for (let i = -9; i <= 9; i += 4.5) { c.beginPath(); c.moveTo(x + i * s, y - 10 * s); c.lineTo(x + (i + 1.5) * s, y + 10 * s); c.stroke(); }
    c.strokeStyle = '#7a4a1c'; c.lineWidth = 1.4;
    for (const dx of [-6, 6]) { c.beginPath(); c.moveTo(x + dx * s, y - 11 * s); c.lineTo(x + dx * s, y + 11 * s); c.stroke(); }
    return;
  }
  // A wooden platform, trimmed by level.
  ellipse(c, x + 2, y + 10 * s, 14 * s, 5 * s, 'rgba(0, 0, 0, 0.22)');
  c.fillStyle = '#8a5a30'; c.strokeStyle = '#5a3a1c'; c.lineWidth = 1.2;
  c.beginPath(); c.roundRect(x - 14 * s, y - 2 * s, 28 * s, 13 * s, 4 * s); c.fill(); c.stroke();
  c.fillStyle = LEVEL_TINT[o.level]; c.fillRect(x - 14 * s, y + 3 * s, 28 * s, 3 * s);
  for (let i = 0; i <= o.level; i++) ellipse(c, x - 6 * s + i * 6 * s, y + 8.5 * s, 1.6 * s, 1.6 * s, '#fff4c8');
  const base = y + 1 * s;
  if (kind === 'flicker') {
    drawChinchilla(c, KIT, x, base, { face, h: 17 * s, time: t, decorate: slingshot(o.flash ?? 0) });
  } else if (kind === 'puffer') {
    // Dora and a swirl of dust around her.
    c.globalAlpha = 0.35 + (o.flash ?? 0);
    for (let i = 0; i < 5; i++) { const a = t * 2 + i * 1.3; ellipse(c, x + Math.cos(a) * 12 * s, base - 8 * s + Math.sin(a) * 5 * s, 4 * s, 3 * s, '#efe0c4'); }
    c.globalAlpha = 1;
    drawChinchilla(c, COATS.dora, x, base, { face, h: 19 * s, time: t, decorate: fan(o.flash ?? 0) });
  } else if (kind === 'roller') {
    ellipse(c, x - face * 9 * s, base - 4 * s, 5 * s, 4.5 * s, '#8f8778'); ellipse(c, x - face * 11 * s, base - 6 * s, 2 * s, 1.5 * s, '#b8b0a0');
    drawChinchilla(c, COATS.enzo, x + face * 2 * s, base, { face, h: 20 * s, time: t, decorate: heave(o.flash ?? 0) });
  } else if (kind === 'bell') {
    // A little frame with a brass bell, and Grandpa Pebble with the rope.
    c.strokeStyle = '#6b4424'; c.lineWidth = 2 * s;
    c.beginPath(); c.moveTo(x - 10 * s, base); c.lineTo(x - 10 * s, base - 22 * s); c.lineTo(x + 10 * s, base - 22 * s); c.lineTo(x + 10 * s, base); c.stroke();
    const swing = Math.sin(t * 10) * (o.flash ?? 0) * 1.6;
    c.save(); c.translate(x, base - 22 * s); c.rotate(swing);
    c.fillStyle = '#e0b040'; c.strokeStyle = '#8a6010'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(-6 * s, 13 * s); c.quadraticCurveTo(-6 * s, 2 * s, 0, 2 * s); c.quadraticCurveTo(6 * s, 2 * s, 6 * s, 13 * s); c.closePath(); c.fill(); c.stroke();
    ellipse(c, 0, 13.5 * s, 1.8 * s, 1.8 * s, '#8a6010');
    c.restore();
    drawChinchilla(c, PEBBLE, x + 4 * s, base + 1 * s, { face: -1, h: 15 * s, time: t, blink: true });
  } else {
    // A hollow stump with a sugar glider peeking out.
    c.fillStyle = '#7a5230'; c.strokeStyle = '#4a3018'; c.lineWidth = 1.2;
    c.beginPath(); c.roundRect(x - 9 * s, base - 18 * s, 18 * s, 19 * s, 3 * s); c.fill(); c.stroke();
    ellipse(c, x, base - 18 * s, 9 * s, 3 * s, '#c89a62'); c.stroke();
    ellipse(c, x, base - 9 * s, 4 * s, 5 * s, '#2a1c12');
    glider(c, x, base - 20 * s - Math.sin(t * 3) * 1.5, face, t, 0.9 * s);
  }
}

const slingshot = (flash: number) => (d: CanvasRenderingContext2D, bob: number) => {
  d.strokeStyle = '#6b4424'; d.lineWidth = 1.4; d.beginPath();
  d.moveTo(12, -4 + bob); d.lineTo(14, -9 + bob); d.lineTo(12.5, -12 + bob); d.moveTo(14, -9 + bob); d.lineTo(16, -12 + bob); d.stroke();
  if (flash > 0.1) { d.fillStyle = '#a0703c'; d.beginPath(); d.arc(18, -11 + bob, 1.4, 0, Math.PI * 2); d.fill(); }
};
const fan = (flash: number) => (d: CanvasRenderingContext2D, bob: number) => {
  const open = flash > 0 ? 1 : 0.6;
  d.save(); d.translate(13, -9 + bob); d.rotate(flash > 0 ? -0.6 : 0.2);
  d.fillStyle = '#f7a9c4'; d.strokeStyle = '#a4506e'; d.lineWidth = 0.6;
  d.beginPath(); d.moveTo(0, 0); d.arc(0, 0, 7, -Math.PI / 2 - open, -Math.PI / 2 + open); d.closePath(); d.fill(); d.stroke();
  d.restore();
};
const heave = (flash: number) => (d: CanvasRenderingContext2D, bob: number) => {
  if (flash <= 0) return;
  ellipse(d, 10, -24 + bob, 4.5, 4, '#8f8778'); ellipse(d, 9, -25.5 + bob, 1.6, 1.2, '#b8b0a0');
};

// ---------- Predators ----------

/** A predator standing at (x, y) in pixels, facing right when `face` is 1. `k` scales it. */
export function critter(c: CanvasRenderingContext2D, kind: Enemy['kind'], x: number, y: number, face: 1 | -1, bob: number, k = 1) {
  const step = Math.sin(bob) * 1.6;
  c.save(); c.translate(x, y); c.scale(face * k, k);
  c.lineJoin = 'round'; c.lineWidth = 1; c.strokeStyle = '#2a1c16';
  if (kind === 'weasel') {
    ellipse(c, 0, 1, 11, 2.5, 'rgba(0, 0, 0, 0.2)');
    c.strokeStyle = '#6b4424'; c.lineWidth = 2.2; c.beginPath(); c.moveTo(-7, -4); c.quadraticCurveTo(-13, -6, -15, -2 + step * 0.5); c.stroke();
    c.lineWidth = 1; c.strokeStyle = '#2a1c16';
    for (const lx of [-5, 4]) { c.fillStyle = '#6b4424'; c.fillRect(lx + step * 0.6, -3, 2, 4); c.fillRect(lx + 2 - step * 0.6, -3, 2, 4); }
    ellipse(c, 0, -5, 9, 3.4, '#8a5a30'); c.stroke();
    ellipse(c, 1, -3.6, 6, 1.6, '#f0dcb8');
    ellipse(c, 9, -7, 3.6, 3, '#8a5a30'); c.stroke();
    ellipse(c, 12, -6.5, 1.8, 1.4, '#f0dcb8'); ellipse(c, 13.5, -7, 0.8, 0.8, '#1a1010');
    ellipse(c, 9.8, -8, 0.9, 0.9, '#1a1010'); ellipse(c, 7.5, -10, 1.3, 1.3, '#8a5a30');
  } else if (kind === 'fox') {
    ellipse(c, 0, 1, 12, 3, 'rgba(0, 0, 0, 0.2)');
    c.fillStyle = '#e07a2e'; c.beginPath(); c.moveTo(-7, -7); c.quadraticCurveTo(-16, -12 + step, -18, -4); c.quadraticCurveTo(-13, -3, -7, -5); c.fill(); c.stroke();
    ellipse(c, -17, -5, 2.4, 2, '#ffffff');
    for (const lx of [-6, 4]) { c.fillStyle = '#2a1c16'; c.fillRect(lx + step * 0.7, -4, 2, 5); c.fillRect(lx + 2 - step * 0.7, -4, 2, 5); }
    ellipse(c, -1, -7, 9, 4.5, '#e07a2e'); c.stroke();
    ellipse(c, 4, -5.5, 4, 2.5, '#fff4e4');
    ellipse(c, 8, -10, 4.2, 3.8, '#e07a2e'); c.stroke();
    c.fillStyle = '#fff4e4'; c.beginPath(); c.moveTo(9, -9); c.lineTo(15, -8.5); c.lineTo(10, -6.5); c.fill();
    ellipse(c, 15, -8.6, 1, 1, '#1a1010'); ellipse(c, 9.5, -11, 0.9, 0.9, '#1a1010');
    c.fillStyle = '#e07a2e'; for (const ex of [5, 8]) { c.beginPath(); c.moveTo(ex, -12); c.lineTo(ex + 1.5, -18); c.lineTo(ex + 3.5, -12.5); c.fill(); c.stroke(); }
  } else if (kind === 'snake') {
    c.lineCap = 'round';
    c.strokeStyle = '#2f5a24'; c.lineWidth = 6.5; c.beginPath();
    for (let i = 0; i <= 12; i++) { const px = -14 + i * 2.2, py = -3 + Math.sin(bob * 1.4 + i * 0.7) * 2.6; if (i) c.lineTo(px, py); else c.moveTo(px, py); }
    c.stroke();
    c.strokeStyle = '#5bb04a'; c.lineWidth = 4.5; c.stroke();
    c.strokeStyle = '#d7efb0'; c.lineWidth = 1; c.setLineDash([2, 3]); c.stroke(); c.setLineDash([]);
    const hy = -3 + Math.sin(bob * 1.4 + 12 * 0.7) * 2.6;
    ellipse(c, 13, hy, 4, 3, '#5bb04a'); c.strokeStyle = '#2f5a24'; c.lineWidth = 1; c.stroke();
    ellipse(c, 14, hy - 1.2, 0.9, 0.9, '#ffe16a');
    if (Math.sin(bob * 3) > 0.3) { c.strokeStyle = '#e8483c'; c.beginPath(); c.moveTo(17, hy); c.lineTo(20, hy); c.lineTo(21, hy - 1); c.moveTo(20, hy); c.lineTo(21, hy + 1); c.stroke(); }
  } else if (kind === 'badger') {
    ellipse(c, 0, 1, 13, 3.4, 'rgba(0, 0, 0, 0.22)');
    for (const lx of [-7, 4]) { c.fillStyle = '#2a2a2e'; c.fillRect(lx + step * 0.5, -4, 3, 5); c.fillRect(lx + 3 - step * 0.5, -4, 3, 5); }
    ellipse(c, -1, -8, 11, 6, '#8d8b93'); c.stroke();
    ellipse(c, -2, -11, 8, 2.5, '#6a6870');
    ellipse(c, 9, -8, 5, 4.4, '#f4f2f6'); c.stroke();
    c.fillStyle = '#1e1e22'; c.beginPath(); c.moveTo(6, -12); c.quadraticCurveTo(10, -9, 14, -7); c.lineTo(13.5, -6); c.quadraticCurveTo(9, -8, 5.5, -9); c.fill();
    ellipse(c, 14, -7, 1.3, 1, '#1a1010'); ellipse(c, 10, -9.6, 0.8, 0.8, '#ffffff');
  } else if (kind === 'hawk') {
    const flap = Math.sin(bob * 2.2) * 6;
    c.fillStyle = '#7a5230';
    for (const side of [-1, 1]) { c.beginPath(); c.moveTo(-2, -2); c.quadraticCurveTo(-4, -2 + side * (8 + flap), -12, side * (3 + flap * 0.8) - 2); c.lineTo(4, -2); c.fill(); c.stroke(); }
    ellipse(c, 0, -2, 8, 3.6, '#8a6038'); c.stroke();
    ellipse(c, 1, -1, 5, 2, '#e8d8b8');
    c.fillStyle = '#6b4424'; c.beginPath(); c.moveTo(-8, -2); c.lineTo(-14, -5); c.lineTo(-14, 1); c.closePath(); c.fill();
    ellipse(c, 8, -3.5, 3.4, 3, '#f0e6d0'); c.stroke();
    c.fillStyle = '#f2b02e'; c.beginPath(); c.moveTo(10.5, -4); c.lineTo(14, -2.5); c.lineTo(10.5, -2); c.fill();
    ellipse(c, 9, -4.4, 0.8, 0.8, '#1a1010');
  } else {
    // The lynx: a big tawny cat with tufted ears and spots.
    ellipse(c, 0, 1, 16, 4, 'rgba(0, 0, 0, 0.25)');
    for (const lx of [-9, 5]) { c.fillStyle = '#b8925e'; c.fillRect(lx + step * 0.6, -6, 3.5, 7); c.fillRect(lx + 3.5 - step * 0.6, -6, 3.5, 7); }
    ellipse(c, -1, -11, 13, 7, '#c9a46e'); c.stroke();
    for (const [sx, sy] of [[-6, -13], [-1, -15], [3, -12], [-8, -9], [-3, -10]]) ellipse(c, sx, sy, 1.2, 1, '#7a5a34');
    ellipse(c, -13, -12, 3, 2.2, '#c9a46e'); ellipse(c, -15, -12.5, 1.4, 1.4, '#1a1010');
    ellipse(c, 12, -14, 6.4, 5.8, '#c9a46e'); c.stroke();
    ellipse(c, 13.5, -11.5, 4, 2.6, '#f4e8d0');
    c.fillStyle = '#c9a46e'; for (const ex of [8, 13]) { c.beginPath(); c.moveTo(ex, -18); c.lineTo(ex + 1.5, -24); c.lineTo(ex + 4, -18.5); c.fill(); c.stroke(); c.strokeStyle = '#1a1010'; c.beginPath(); c.moveTo(ex + 1.5, -24); c.lineTo(ex + 1.5, -27); c.stroke(); c.strokeStyle = '#2a1c16'; }
    ellipse(c, 15, -15, 1.2, 1.2, '#2a8a4a'); ellipse(c, 15.3, -15, 0.5, 0.9, '#1a1010');
    ellipse(c, 17.5, -12.5, 1, 0.8, '#3a2418');
  }
  c.restore();
}

function glider(c: CanvasRenderingContext2D, x: number, y: number, face: 1 | -1, t: number, k = 1) {
  const flap = Math.sin(t * 12) * 2;
  c.save(); c.translate(x, y); c.scale(face * k, k);
  c.fillStyle = '#b9aea6'; c.strokeStyle = '#4b3f3a'; c.lineWidth = 0.8;
  c.beginPath(); c.moveTo(-7, -2 + flap); c.quadraticCurveTo(0, -6, 7, -2 + flap); c.lineTo(5, 3); c.quadraticCurveTo(0, 1, -5, 3); c.closePath(); c.fill(); c.stroke();
  ellipse(c, 0, 0, 4.5, 3, '#d8cec7'); c.stroke();
  c.fillStyle = '#4b3f3a'; c.fillRect(-1, -3, 1.4, 5);
  ellipse(c, 4.5, -1.5, 2.6, 2.2, '#d8cec7'); ellipse(c, 5.5, -2, 0.9, 0.9, '#120c10');
  ellipse(c, 3.5, -3.8, 1.2, 1.4, '#e8b0a8');
  c.restore();
}

function enemy(c: CanvasRenderingContext2D, e: Enemy, time: number) {
  const def = ENEMIES[e.kind], x = X(e.x), air = def.air, lift = air ? 14 + Math.sin(e.bob) * 2 : 0, y = Y(e.y) + 7 - lift;
  if (air) ellipse(c, x, Y(e.y) + 8, 9, 3, 'rgba(0, 0, 0, 0.18)');
  if (e.hit > 0) c.filter = 'brightness(1.8)';
  critter(c, e.kind, x, y, e.face, e.stun > 0 ? 0 : e.bob, e.kind === 'lynx' ? 1.45 : 1.15);
  c.filter = 'none';
  if (e.slow > 0 && e.slowT > 0) { c.globalAlpha = 0.45; ellipse(c, x, Y(e.y) + 5, 11, 4, '#efe0c4'); c.globalAlpha = 1; }
  if (e.stun > 0) {
    c.fillStyle = '#ffffff'; c.font = 'bold 9px Arial'; c.textAlign = 'left';
    const z = (time * 1.2) % 1;
    c.globalAlpha = 1 - z; c.fillText('z', x + 6 + z * 4, y - 16 - z * 8); c.fillText('z', x + 10 + z * 3, y - 22 - z * 6); c.globalAlpha = 1;
  }
  if (e.hp < e.maxHp) {
    const w = e.kind === 'lynx' ? 32 : 22, frac = Math.max(0, e.hp / e.maxHp), by = y - (e.kind === 'lynx' ? 44 : e.kind === 'hawk' ? 16 : 25);
    c.fillStyle = 'rgba(20, 16, 28, 0.8)'; c.fillRect(x - w / 2 - 1, by - 1, w + 2, 5);
    c.fillStyle = frac > 0.5 ? '#6fd06f' : frac > 0.25 ? '#f0c040' : '#f05a4a'; c.fillRect(x - w / 2, by, w * frac, 3);
  }
}

// ---------- Shots and effects ----------

function shot(c: CanvasRenderingContext2D, s: Shot, time: number) {
  const x = X(s.x), y = Y(s.y);
  if (s.kind === 'boulder') {
    const p = Math.min(1, s.t / s.total), lift = Math.sin(p * Math.PI) * 26;
    ellipse(c, x, y + 4, 5, 2, 'rgba(0, 0, 0, 0.2)');
    ellipse(c, x, y - lift, 5.5, 5, '#8f8778'); ellipse(c, x - 1.5, y - lift - 1.5, 2, 1.5, '#b8b0a0');
  } else if (s.kind === 'glider') glider(c, x, y - 6, s.tx > s.x ? 1 : -1, time, 0.7);
  else ellipse(c, x, y - 6, 2.2, 2.2, '#a0703c');
}

function effect(c: CanvasRenderingContext2D, f: Effect) {
  const p = f.t / f.max, x = X(f.x), y = Y(f.y), r = f.r * TILE;
  if (f.kind === 'puff') {
    c.globalAlpha = 0.4 * (1 - p);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + p; ellipse(c, x + Math.cos(a) * r * (0.4 + p * 0.6), y + Math.sin(a) * r * (0.4 + p * 0.6), r * 0.25, r * 0.18, '#f3e6cf'); }
    c.globalAlpha = 1;
  } else if (f.kind === 'ring') {
    c.strokeStyle = `rgba(255, 220, 120, ${1 - p})`; c.lineWidth = 3;
    for (const k of [0.5, 1]) { c.beginPath(); c.arc(x, y - 8, r * p * k, 0, Math.PI * 2); c.stroke(); }
    c.fillStyle = `rgba(255, 240, 200, ${1 - p})`; c.font = 'bold 12px Arial'; c.textAlign = 'center'; c.fillText('♪', x + 10, y - 20 - p * 10);
  } else if (f.kind === 'boom') {
    c.globalAlpha = 1 - p;
    c.strokeStyle = '#fff4d8'; c.lineWidth = 2.5; c.beginPath(); c.arc(x, y, r * (0.3 + p * 0.7), 0, Math.PI * 2); c.stroke();
    for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; ellipse(c, x + Math.cos(a) * r * p, y + Math.sin(a) * r * p * 0.7, 3 * (1 - p) + 1, 2 * (1 - p) + 1, '#b8a88e'); }
    c.globalAlpha = 1;
  } else if (f.kind === 'hit') {
    c.strokeStyle = `rgba(255, 246, 192, ${1 - p})`; c.lineWidth = 1.5;
    for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2; c.beginPath(); c.moveTo(x + Math.cos(a) * 2, y - 6 + Math.sin(a) * 2); c.lineTo(x + Math.cos(a) * 6, y - 6 + Math.sin(a) * 6); c.stroke(); }
  } else {
    const text = f.kind === 'coin' ? (f.value ? `+${f.value}` : '★') : `−${f.value} 🍇`;
    c.font = 'bold 11px Arial'; c.textAlign = 'center';
    c.lineWidth = 3; c.strokeStyle = `rgba(30, 20, 20, ${1 - p})`; c.strokeText(text, x, y - 14 - p * 16);
    c.fillStyle = f.kind === 'coin' ? `rgba(255, 220, 110, ${1 - p})` : `rgba(255, 140, 140, ${1 - p})`; c.fillText(text, x, y - 14 - p * 16);
  }
}

// ---------- The whole scene ----------

export type Ghost = { kind: TowerId; c: number; r: number; ok: boolean; d?: Int32Array } | null;

export function drawMaze(c: CanvasRenderingContext2D, g: MazeGame, time: number, ghost: Ghost, selected: Tower | null) {
  const look = lookOf(g.map.id);
  ground(c, g, look, time);
  // Show where they'd walk if the ghost were built.
  routes(c, g, look, time, ghost?.ok && ghost.d && ghost.d.some((v) => v < INF) ? ghost.d : undefined);
  burrow(c, g, time);
  if (selected) rangeRing(c, selected.c, selected.r, TOWERS[selected.kind].levels[selected.level].range, 'rgba(255, 255, 255, 0.8)');
  // Draw top to bottom so things overlap properly.
  const things: { y: number; draw: () => void }[] = [];
  for (const t of g.towers) things.push({ y: t.r + 0.5, draw: () => tower(c, t.kind, X(t.c) + TILE / 2, Y(t.r) + TILE / 2 + 2, { level: t.level, time: time + t.id, aim: t.aim, flash: t.flash }) });
  for (const e of g.enemies) things.push({ y: e.y + (ENEMIES[e.kind].air ? 100 : 0), draw: () => enemy(c, e, time) });
  things.sort((a, b) => a.y - b.y).forEach((t) => t.draw());
  for (const s of g.shots) shot(c, s, time);
  for (const f of g.effects) effect(c, f);
  if (ghost) {
    const x = X(ghost.c), y = Y(ghost.r);
    c.fillStyle = ghost.ok ? 'rgba(255, 255, 255, 0.25)' : 'rgba(230, 50, 60, 0.35)';
    c.fillRect(x, y, TILE, TILE);
    c.strokeStyle = ghost.ok ? '#ffffff' : '#ff6070'; c.lineWidth = 2; c.strokeRect(x + 1, y + 1, TILE - 2, TILE - 2);
    const lv = TOWERS[ghost.kind].levels[0];
    if (lv.range) rangeRing(c, ghost.c, ghost.r, lv.range, ghost.ok ? 'rgba(255, 255, 255, 0.7)' : 'rgba(255, 96, 112, 0.7)');
    if (ghost.ok) { c.globalAlpha = 0.6; tower(c, ghost.kind, x + TILE / 2, y + TILE / 2 + 2, { level: 0, time }); c.globalAlpha = 1; }
  }
}

function rangeRing(c: CanvasRenderingContext2D, col: number, r: number, range: number, stroke: string) {
  c.save(); c.strokeStyle = stroke; c.fillStyle = 'rgba(255, 255, 255, 0.08)'; c.lineWidth = 1.5; c.setLineDash([5, 4]);
  c.beginPath(); c.arc(X(col) + TILE / 2, Y(r) + TILE / 2, range * TILE, 0, Math.PI * 2); c.fill(); c.stroke();
  c.restore();
}

/** A tower on a palette button. */
export function drawTowerIcon(c: CanvasRenderingContext2D, kind: TowerId, w: number, h: number, time = 0) {
  c.clearRect(0, 0, w, h);
  tower(c, kind, w / 2, h * 0.58, { level: 0, time });
}
/** A predator for the wave preview. */
export function drawCritterIcon(c: CanvasRenderingContext2D, kind: Enemy['kind'], w: number, h: number) {
  c.clearRect(0, 0, w, h);
  critter(c, kind, w / 2 - 1, h * 0.78, 1, 0, kind === 'lynx' ? 0.8 : 1);
}
