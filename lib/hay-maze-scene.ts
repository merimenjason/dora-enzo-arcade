// Canvas 2D drawing for Hay Maze Defence, in the warm-dusk, chunky-block look of Emberward: a meadow at nightfall,
// hay-bale blocks with a lit top and a shaded front, towers standing on the blocks (and on the rocks), the route the
// predators will take glowing like embers, the Hearthlight burning at the burrow with Dora and Enzo beside it, pools
// of firelight, floating embers and a vignette. The grid is 20 × 12 tiles of 32 px, with margins for predators
// arriving from the left and top and for the Hearthlight on the right.
import {
  Battle, TOWERS, ENEMIES, COLS, ROWS, INF, cellsAt, isPiece, PIECES,
  type TowerId, type Tower, type Enemy, type Effect, type Shot, type PieceId, type CardId, type Element,
} from './hay-maze-game';
import { COATS, coatLike, drawChinchilla, type Coat } from './chinchilla-art';

export const TILE = 32, OX = 26, OY = 24, LIFT = 7, VIEW_W = OX + COLS * TILE + 74, VIEW_H = OY + ROWS * TILE + 16;
export const toGrid = (px: number, py: number) => ({ c: Math.floor((px - OX) / TILE), r: Math.floor((py - OY) / TILE) });
const X = (x: number) => OX + x * TILE, Y = (y: number) => OY + y * TILE;

export const ELEMENT_COLOR: Record<Element, string> = { plain: '#f0dcae', ice: '#8fd8ff', fire: '#ff8a3a', spark: '#ffe45a', arcane: '#c79bff', earth: '#d0a36a', sleep: '#f2c94c', air: '#bfe3a0' };

type Look = { skyTop: string; skyBottom: string; a: string; b: string; tuft: string; rock: string; rockTop: string; rockDark: string; deco: 'clover' | 'cactus' | 'star'; dusk: string };
const LOOKS: Record<string, Look> = {
  meadow: { skyTop: '#3b2a4a', skyBottom: '#6a4a52', a: '#6f9a55', b: '#6a9450', tuft: '#4d7a3c', rock: '#8d8a86', rockTop: '#b3aea6', rockDark: '#5e5a58', deco: 'clover', dusk: 'rgba(40, 20, 60, 0.18)' },
  canyon: { skyTop: '#4a2438', skyBottom: '#8a4a3a', a: '#c79a68', b: '#bf9262', tuft: '#9a6c44', rock: '#a0644a', rockTop: '#c78461', rockDark: '#6a3e2c', deco: 'cactus', dusk: 'rgba(60, 20, 40, 0.2)' },
  summit: { skyTop: '#141a36', skyBottom: '#2c2a52', a: '#4a6e62', b: '#46685c', tuft: '#355449', rock: '#7c80a0', rockTop: '#a2a6c2', rockDark: '#4c5070', deco: 'star', dusk: 'rgba(10, 14, 40, 0.3)' },
};
export const lookOf = (id: string) => LOOKS[id] ?? LOOKS.meadow;

const blackEyes = { eye: '#16121a', pupil: '#000000', earGlow: false, eyeR: 1.75 };
const KIT: Coat = coatLike('dora', { ...blackEyes, fur: '#eeeaf0', back: '#dad3df', face: '#f6f3f8', shade: '#ccc4d2', texture: '#d8d0dc', tail: '#ebe6ee', tailInner: '#cfc6d6' });
const EMBER_KIT: Coat = coatLike('enzo', { fur: '#8d8b93', back: '#66646c', face: '#a3a1aa', shade: '#75737b', texture: '#6a6870', tail: '#8a8892', tailOuter: '#67656e' });
const PEBBLE: Coat = coatLike('enzo', { fur: '#a9a7b0', back: '#8a8891', face: '#c4c2ca', shade: '#96949d', texture: '#8f8d96', tail: '#b0aeb7', tailOuter: '#8c8a94', tailInner: '#d2d0d8', bands: false });
const VIOLET: Coat = coatLike('enzo', { fur: '#a097ae', back: '#7c7190', face: '#b6aec2', shade: '#8a809d', texture: '#776c8a', tail: '#9a90a9', tailOuter: '#72688b', tailInner: '#bab1c7', ear: '#a296ad', earIn: '#c4a9bd' });

const ellipse = (c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill?: string, rot = 0) => {
  c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2);
  if (fill) { c.fillStyle = fill; c.fill(); }
};
const hash = (n: number) => { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); };
const glow = (c: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, alpha: number) => {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color); g.addColorStop(1, 'rgba(0, 0, 0, 0)');
  c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = alpha; c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); c.restore();
};

// ---------- The meadow ----------

function ground(c: CanvasRenderingContext2D, b: Battle, look: Look, time: number) {
  const sky = c.createLinearGradient(0, 0, 0, VIEW_H);
  sky.addColorStop(0, look.skyTop); sky.addColorStop(1, look.skyBottom);
  c.fillStyle = sky; c.fillRect(0, 0, VIEW_W, VIEW_H);
  // Soft two-tone grass with a little shading per tile.
  for (let r = 0; r < ROWS; r++) for (let col = 0; col < COLS; col++) {
    c.fillStyle = (r + col) % 2 ? look.a : look.b;
    c.fillRect(X(col), Y(r), TILE, TILE);
    c.fillStyle = `rgba(0, 0, 0, ${0.03 + hash(col * 31 + r) * 0.05})`; c.fillRect(X(col), Y(r) + TILE - 3, TILE, 3);
  }
  c.strokeStyle = 'rgba(0, 0, 0, 0.25)'; c.lineWidth = 2; c.strokeRect(X(0) - 1, Y(0) - 1, COLS * TILE + 2, ROWS * TILE + 2);
  for (let i = 0; i < 90; i++) {
    const x = X(hash(i) * COLS), y = Y(hash(i + 99) * ROWS);
    if (look.deco === 'clover') { c.strokeStyle = look.tuft; c.lineWidth = 1.2; c.beginPath(); c.moveTo(x, y); c.lineTo(x - 2, y - 5); c.moveTo(x, y); c.lineTo(x + 2, y - 4); c.stroke(); if (i % 9 === 0) ellipse(c, x + 3, y - 4, 1.8, 1.8, i % 2 ? '#f6d86a' : '#f2a6c8'); }
    else if (look.deco === 'cactus') { c.fillStyle = look.tuft; c.fillRect(x, y, 2, 2); if (i % 11 === 0) { c.fillStyle = '#5d8f4a'; c.fillRect(x, y - 7, 3, 8); } }
    else { c.strokeStyle = look.tuft; c.lineWidth = 1; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 1, y - 4); c.stroke(); if (i % 7 === 0) { const tw = 0.5 + 0.5 * Math.sin(time * 2 + i); ellipse(c, x, y - 8, 1 + tw * 0.6, 1 + tw * 0.6, `rgba(200, 230, 255, ${0.25 + tw * 0.3})`); } }
  }
  // Ways in: trodden gaps with red markers.
  for (const [ec, er] of b.entrances) {
    const top = er === 0 && ec > 0;
    c.fillStyle = 'rgba(70, 40, 20, 0.45)';
    if (top) c.fillRect(X(ec), 0, TILE, OY); else c.fillRect(0, Y(er), OX, TILE);
  }
  for (let e = 0; e < b.entrances.length; e += 2) {
    const [ec, er] = b.entrances[e], top = er === 0 && ec > 0;
    c.save(); c.translate(top ? X(ec) + TILE : 12, top ? 11 : Y(er) + TILE); if (top) c.rotate(Math.PI / 2);
    c.fillStyle = '#e8483c'; c.beginPath(); c.moveTo(-6, -6); c.lineTo(6, 0); c.lineTo(-6, 6); c.closePath(); c.fill();
    c.restore();
  }
}

/** A chunky block: a lit top face and a shaded front, like a stack of bales or a boulder. */
function cube(c: CanvasRenderingContext2D, col: number, r: number, top: string, front: string, edge: string, joined: (dc: number, dr: number) => boolean) {
  const x = X(col), y = Y(r) - LIFT;
  if (!joined(0, 1)) { c.fillStyle = front; c.fillRect(x, y + TILE, TILE, LIFT); c.fillStyle = 'rgba(0, 0, 0, 0.18)'; c.fillRect(x, Y(r) + TILE, TILE, 3); }
  c.fillStyle = top; c.fillRect(x, y, TILE, TILE);
  c.strokeStyle = edge; c.lineWidth = 2;
  c.beginPath();
  if (!joined(0, -1)) { c.moveTo(x, y + 1); c.lineTo(x + TILE, y + 1); }
  if (!joined(0, 1)) { c.moveTo(x, y + TILE + LIFT - 1); c.lineTo(x + TILE, y + TILE + LIFT - 1); }
  if (!joined(-1, 0)) { c.moveTo(x + 1, y); c.lineTo(x + 1, y + TILE + (joined(0, 1) ? 0 : LIFT)); }
  if (!joined(1, 0)) { c.moveTo(x + TILE - 1, y); c.lineTo(x + TILE - 1, y + TILE + (joined(0, 1) ? 0 : LIFT)); }
  c.stroke();
}

const STRAW = [['#f2cf6a', '#c9982f', '#8a6418'], ['#eec060', '#c28a2a', '#825a14'], ['#f5d98a', '#cfa144', '#8c6a22'], ['#e8b85a', '#b8822a', '#7a5214']];

function blocks(c: CanvasRenderingContext2D, b: Battle, look: Look, rows: number[]) {
  for (const r of rows) for (let col = 0; col < COLS; col++) {
    if (b.rock(col, r)) {
      cube(c, col, r, look.rockTop, look.rock, look.rockDark, (dc, dr) => b.inGrid(col + dc, r + dr) && b.rock(col + dc, r + dr));
      const x = X(col), y = Y(r) - LIFT;
      c.strokeStyle = 'rgba(0, 0, 0, 0.2)'; c.lineWidth = 1; c.beginPath(); c.moveTo(x + 8, y + 10); c.lineTo(x + 14, y + 16); c.lineTo(x + 22, y + 13); c.stroke();
      ellipse(c, x + 10, y + 8, 4, 2, 'rgba(255, 255, 255, 0.18)');
      continue;
    }
    const group = b.blocks[r * COLS + col];
    if (!group) continue;
    const [top, front, edge] = STRAW[group % STRAW.length];
    cube(c, col, r, top, front, edge, (dc, dr) => b.inGrid(col + dc, r + dr) && b.blocks[(r + dr) * COLS + col + dc] === group);
    // Straw texture on the top, and twine on the front.
    const x = X(col), y = Y(r) - LIFT;
    c.strokeStyle = 'rgba(140, 100, 30, 0.35)'; c.lineWidth = 1;
    for (let i = 0; i < 4; i++) { const sx = x + 4 + ((i * 7 + group * 3) % 24); c.beginPath(); c.moveTo(sx, y + 5); c.lineTo(sx + 3, y + TILE - 5); c.stroke(); }
    if (!(b.inGrid(col, r + 1) && b.blocks[(r + 1) * COLS + col] === group)) { c.fillStyle = '#7a4a1c'; c.fillRect(x + 9, y + TILE, 2, LIFT); c.fillRect(x + 21, y + TILE, 2, LIFT); }
  }
}

/** The glowing route each way in will take. */
function routes(c: CanvasRenderingContext2D, b: Battle, time: number, d?: Int32Array) {
  c.save();
  c.lineCap = 'round'; c.lineJoin = 'round';
  for (let e = 0; e < b.entrances.length; e += 2) {
    const path = b.route(e, d);
    const trace = () => { c.beginPath(); path.forEach(([pc, pr], i) => { const x = X(pc) + TILE / 2, y = Y(pr) + TILE / 2; if (i) c.lineTo(x, y); else c.moveTo(x, y); }); c.lineTo(X(COLS) + 10, Y(path.at(-1)![1]) + TILE / 2); };
    trace(); c.strokeStyle = 'rgba(255, 140, 60, 0.18)'; c.lineWidth = 9; c.stroke();
    trace(); c.strokeStyle = 'rgba(255, 190, 110, 0.85)'; c.lineWidth = 2.5; c.setLineDash([3, 8]); c.lineDashOffset = -time * 16; c.stroke();
    c.setLineDash([]);
  }
  c.restore();
}

/** The Hearthlight: a stone brazier outside the burrow, burning as bright as the flame has left. */
function hearth(c: CanvasRenderingContext2D, b: Battle, time: number) {
  const [hx, hy] = b.hearth, x = X(hx) - 6, y = Y(hy), frac = Math.max(0, b.run.flame / b.run.maxFlame);
  const rows = b.exits.map(([, r]) => r), top = Y(Math.min(...rows)), bottom = Y(Math.max(...rows) + 1);
  // The burrow mound behind.
  c.fillStyle = '#5a3c26'; c.beginPath(); c.ellipse(X(COLS) + 44, (top + bottom) / 2, 40, (bottom - top) / 2 + 34, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#20140c'; c.beginPath(); c.ellipse(X(COLS) + 54, (top + bottom) / 2, 14, (bottom - top) / 2 - 2, 0, 0, Math.PI * 2); c.fill();
  glow(c, x, y - 14, 90 * (0.4 + frac * 0.6), 'rgba(255, 150, 60, 0.9)', 0.55);
  // Stone bowl.
  c.fillStyle = '#6b6560'; c.beginPath(); c.moveTo(x - 13, y - 6); c.lineTo(x + 13, y - 6); c.lineTo(x + 8, y + 8); c.lineTo(x - 8, y + 8); c.closePath(); c.fill();
  c.fillStyle = '#8a837c'; ellipse(c, x, y - 6, 13, 4, '#8a837c');
  // Flame: taller and brighter with more of the Hearthlight left.
  const h = 8 + 22 * frac;
  for (const [k, col] of [[1, '#ff7a2a'], [0.72, '#ffb347'], [0.42, '#fff2b0']] as [number, string][]) {
    const w = 10 * k * (0.5 + frac * 0.5), sway = Math.sin(time * 7 + k * 3) * 2 * k;
    c.fillStyle = col; c.beginPath(); c.moveTo(x - w, y - 7); c.quadraticCurveTo(x - w * 0.9 + sway, y - 7 - h * k * 0.6, x + sway * 1.5, y - 7 - h * k); c.quadraticCurveTo(x + w * 0.9 + sway, y - 7 - h * k * 0.6, x + w, y - 7); c.closePath(); c.fill();
  }
  const scared = b.effects.some((e) => e.kind === 'leak');
  drawChinchilla(c, COATS.dora, x - 18, top - 4, { face: 1, h: 20, time, dizzy: scared });
  drawChinchilla(c, COATS.enzo, x - 16, bottom + 20, { face: 1, h: 22, time: time + 2, dizzy: scared });
}

// ---------- Towers ----------

const LEVEL_TINT = ['#b88a52', '#c0c6d6', '#f2c94c'];

/** A tower standing on a block at (x, y), or on a button when drawn alone. */
export function tower(c: CanvasRenderingContext2D, kind: TowerId, x: number, y: number, o: { level: number; time: number; aim?: number; flash?: number }) {
  const t = o.time, face: 1 | -1 = Math.cos(o.aim ?? 0) >= 0 ? 1 : -1, flash = o.flash ?? 0, el = TOWERS[kind].element;
  // A small plinth in the element's colour, trimmed by level.
  ellipse(c, x, y + 9, 12, 4, 'rgba(0, 0, 0, 0.25)');
  c.fillStyle = '#4a3a30'; c.beginPath(); c.roundRect(x - 11, y + 2, 22, 8, 3); c.fill();
  c.fillStyle = ELEMENT_COLOR[el]; c.fillRect(x - 11, y + 4, 22, 2);
  for (let i = 0; i <= o.level; i++) ellipse(c, x - 6 + i * 6, y + 8, 1.5, 1.5, LEVEL_TINT[o.level]);
  const base = y + 3;
  if (kind === 'flicker') drawChinchilla(c, KIT, x, base, { face, h: 16, time: t, decorate: slingshot(flash) });
  else if (kind === 'frost') {
    c.globalAlpha = 0.45 + flash;
    for (let i = 0; i < 5; i++) { const a = t * 2 + i * 1.3; ellipse(c, x + Math.cos(a) * 12, base - 8 + Math.sin(a) * 5, 2.2, 2.2, '#d8f2ff'); }
    c.globalAlpha = 1;
    drawChinchilla(c, COATS.dora, x, base, { face, h: 18, time: t, decorate: fan(flash) });
  } else if (kind === 'roller') {
    ellipse(c, x - face * 9, base - 4, 5, 4.5, '#8f8778'); ellipse(c, x - face * 11, base - 6, 2, 1.5, '#b8b0a0');
    drawChinchilla(c, COATS.enzo, x + face * 2, base, { face, h: 19, time: t, decorate: heave(flash) });
  } else if (kind === 'brazier') {
    drawChinchilla(c, EMBER_KIT, x - 8, base, { face: 1, h: 13, time: t });
    c.fillStyle = '#3a302c'; c.beginPath(); c.moveTo(x + 1, base - 10); c.lineTo(x + 15, base - 10); c.lineTo(x + 12, base - 2); c.lineTo(x + 4, base - 2); c.closePath(); c.fill();
    c.fillStyle = '#3a302c'; c.fillRect(x + 7, base - 2, 2, 4);
    flame(c, x + 8, base - 10, 6 + flash * 10, t);
  } else if (kind === 'spark') {
    const wx = x + 2, wy = base - 12, spin = t * (4 + flash * 20);
    c.strokeStyle = '#8a7a5a'; c.lineWidth = 2; c.beginPath(); c.arc(wx, wy, 11, 0, Math.PI * 2); c.stroke();
    c.lineWidth = 1; for (let i = 0; i < 6; i++) { const a = spin + (i * Math.PI) / 3; c.beginPath(); c.moveTo(wx, wy); c.lineTo(wx + Math.cos(a) * 11, wy + Math.sin(a) * 11); c.stroke(); }
    c.fillStyle = '#5a4a3a'; c.fillRect(wx - 1, wy, 2, 13);
    drawChinchilla(c, KIT, wx, wy + 9, { face: 1, h: 11, time: t, moving: true, run: t * 30 });
    if (flash > 0 || Math.sin(t * 13) > 0.7) for (let i = 0; i < 3; i++) { const a = t * 9 + i * 2.1; c.strokeStyle = '#fff27a'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(wx + Math.cos(a) * 12, wy + Math.sin(a) * 12); c.lineTo(wx + Math.cos(a) * 16, wy + Math.sin(a) * 15); c.stroke(); }
  } else if (kind === 'lantern') {
    c.strokeStyle = '#4a3a30'; c.lineWidth = 2; c.beginPath(); c.moveTo(x + 8, base); c.lineTo(x + 8, base - 24); c.lineTo(x + 3, base - 24); c.stroke();
    glow(c, x + 3, base - 18, 16 + flash * 10, 'rgba(200, 160, 255, 0.9)', 0.6);
    c.fillStyle = '#e8dcff'; c.beginPath(); c.roundRect(x, base - 22, 6, 8, 2); c.fill();
    c.fillStyle = '#b690ff'; c.beginPath(); c.arc(x + 3, base - 18, 2, 0, Math.PI * 2); c.fill();
    drawChinchilla(c, VIOLET, x - 4, base, { face: 1, h: 16, time: t });
  } else if (kind === 'bell') {
    c.strokeStyle = '#6b4424'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(x - 9, base); c.lineTo(x - 9, base - 21); c.lineTo(x + 9, base - 21); c.lineTo(x + 9, base); c.stroke();
    const swing = Math.sin(t * 10) * flash * 1.6;
    c.save(); c.translate(x, base - 21); c.rotate(swing);
    c.fillStyle = '#e0b040'; c.strokeStyle = '#8a6010'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(-5.5, 12); c.quadraticCurveTo(-5.5, 2, 0, 2); c.quadraticCurveTo(5.5, 2, 5.5, 12); c.closePath(); c.fill(); c.stroke();
    c.restore();
    drawChinchilla(c, PEBBLE, x + 4, base + 1, { face: -1, h: 14, time: t, blink: true });
  } else {
    c.fillStyle = '#7a5230'; c.strokeStyle = '#4a3018'; c.lineWidth = 1.2;
    c.beginPath(); c.roundRect(x - 8, base - 17, 16, 18, 3); c.fill(); c.stroke();
    ellipse(c, x, base - 17, 8, 2.6, '#c89a62');
    ellipse(c, x, base - 8, 3.5, 4.5, '#2a1c12');
    glider(c, x, base - 19 - Math.sin(t * 3) * 1.5, face, t, 0.85);
  }
}

function flame(c: CanvasRenderingContext2D, x: number, y: number, h: number, t: number) {
  for (const [k, col] of [[1, '#ff6a2a'], [0.65, '#ffb347'], [0.35, '#fff2b0']] as [number, string][]) {
    const w = 6 * k, sway = Math.sin(t * 9 + k * 4) * 1.5;
    c.fillStyle = col; c.beginPath(); c.moveTo(x - w, y); c.quadraticCurveTo(x - w + sway, y - h * k * 0.6, x + sway, y - h * k - 2); c.quadraticCurveTo(x + w + sway, y - h * k * 0.6, x + w, y); c.closePath(); c.fill();
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
  d.fillStyle = '#bfe6ff'; d.strokeStyle = '#4a7aa4'; d.lineWidth = 0.6;
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
  const def = ENEMIES[e.kind], x = X(e.x), air = def.air, lift = air ? 16 + Math.sin(e.bob) * 2 : 0, y = Y(e.y) + 6 - lift;
  if (air) ellipse(c, x, Y(e.y) + 8, 9, 3, 'rgba(0, 0, 0, 0.2)');
  const chilled = e.slow > 0 && e.slowT > 0;
  if (e.hit > 0) c.filter = 'brightness(1.8)';
  else if (chilled) c.filter = 'saturate(0.5) brightness(1.15) hue-rotate(160deg)';
  critter(c, e.kind, x, y, e.face, e.stun > 0 ? 0 : e.bob, e.kind === 'lynx' ? 1.45 : 1.15);
  c.filter = 'none';
  if (chilled) { c.strokeStyle = 'rgba(190, 235, 255, 0.8)'; c.lineWidth = 1; for (let i = 0; i < 3; i++) { const a = time * 2 + i * 2.1; c.beginPath(); c.moveTo(x + Math.cos(a) * 9, y - 6 + Math.sin(a) * 4); c.lineTo(x + Math.cos(a) * 12, y - 6 + Math.sin(a) * 6); c.stroke(); } }
  if (e.burnT > 0) for (let i = 0; i < 3; i++) flame(c, x - 6 + i * 6, y - 4 - (i % 2) * 3, 5 + Math.sin(time * 12 + i) * 2, time + i);
  if (e.stun > 0) {
    c.fillStyle = '#ffffff'; c.font = 'bold 9px Arial'; c.textAlign = 'left';
    const z = (time * 1.2) % 1;
    c.globalAlpha = 1 - z; c.fillText('z', x + 6 + z * 4, y - 16 - z * 8); c.fillText('z', x + 10 + z * 3, y - 22 - z * 6); c.globalAlpha = 1;
  }
  if (e.hp < e.maxHp) {
    const w = e.kind === 'lynx' ? 32 : 22, frac = Math.max(0, e.hp / e.maxHp), by = y - (e.kind === 'lynx' ? 44 : air ? 16 : 25);
    c.fillStyle = 'rgba(20, 16, 28, 0.85)'; c.fillRect(x - w / 2 - 1, by - 1, w + 2, 5);
    c.fillStyle = frac > 0.5 ? '#ff9a4a' : frac > 0.25 ? '#f0c040' : '#f05a4a'; c.fillRect(x - w / 2, by, w * frac, 3);
  }
}

// ---------- Shots and effects ----------

function shot(c: CanvasRenderingContext2D, s: Shot, time: number) {
  const x = X(s.x), y = Y(s.y) - LIFT;
  if (s.kind === 'boulder') {
    const p = Math.min(1, s.t / s.total), lift = Math.sin(p * Math.PI) * 26;
    ellipse(c, x, y + 10, 5, 2, 'rgba(0, 0, 0, 0.2)');
    ellipse(c, x, y - lift, 5.5, 5, '#8f8778'); ellipse(c, x - 1.5, y - lift - 1.5, 2, 1.5, '#b8b0a0');
  } else if (s.kind === 'glider') glider(c, x, y - 6, s.tx > s.x ? 1 : -1, time, 0.7);
  else if (s.kind === 'moon') { glow(c, x, y - 6, 12, 'rgba(200, 160, 255, 1)', 0.8); ellipse(c, x, y - 6, 3, 3, '#f0e6ff'); }
  else ellipse(c, x, y - 6, 2.2, 2.2, '#a0703c');
}

function effect(c: CanvasRenderingContext2D, f: Effect) {
  const p = f.t / f.max, x = X(f.x), y = Y(f.y) - LIFT, r = f.r * TILE;
  if (f.kind === 'chill') {
    c.strokeStyle = `rgba(190, 235, 255, ${0.7 * (1 - p)})`; c.lineWidth = 2;
    c.beginPath(); c.arc(x, y, r * (0.3 + p * 0.7), 0, Math.PI * 2); c.stroke();
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + p; ellipse(c, x + Math.cos(a) * r * p, y + Math.sin(a) * r * p * 0.7, 1.6, 1.6, `rgba(230, 248, 255, ${1 - p})`); }
  } else if (f.kind === 'flame') {
    c.globalAlpha = 1 - p;
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; flame(c, x + Math.cos(a) * r * (0.4 + p * 0.5), y + Math.sin(a) * r * (0.3 + p * 0.4) + 6, 8 * (1 - p) + 2, f.t * 10 + i); }
    c.globalAlpha = 1;
    glow(c, x, y, r, 'rgba(255, 120, 40, 0.9)', 0.35 * (1 - p));
  } else if (f.kind === 'ring') {
    c.strokeStyle = `rgba(255, 220, 120, ${1 - p})`; c.lineWidth = 3;
    for (const k of [0.5, 1]) { c.beginPath(); c.arc(x, y - 6, r * p * k, 0, Math.PI * 2); c.stroke(); }
    c.fillStyle = `rgba(255, 240, 200, ${1 - p})`; c.font = 'bold 12px Arial'; c.textAlign = 'center'; c.fillText('♪', x + 10, y - 20 - p * 10);
  } else if (f.kind === 'zap' && f.points) {
    c.save(); c.globalCompositeOperation = 'lighter';
    for (const [w, col] of [[5, `rgba(255, 230, 90, ${0.4 * (1 - p)})`], [1.6, `rgba(255, 255, 230, ${1 - p})`]] as [number, string][]) {
      c.strokeStyle = col; c.lineWidth = w; c.beginPath();
      f.points.forEach(([px, py], i) => {
        const sx = X(px), sy = Y(py) - LIFT - 8;
        if (!i) { c.moveTo(sx, sy); return; }
        const [qx, qy] = f.points![i - 1], mx = (X(qx) + sx) / 2 + (hash(i + f.t * 50) - 0.5) * 12, my = (Y(qy) - LIFT - 8 + sy) / 2 + (hash(i * 3 + f.t * 50) - 0.5) * 12;
        c.lineTo(mx, my); c.lineTo(sx, sy);
      });
      c.stroke();
    }
    c.restore();
  } else if (f.kind === 'shatter') {
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; c.fillStyle = `rgba(210, 245, 255, ${1 - p})`; c.beginPath(); const px = x + Math.cos(a) * 14 * p, py = y - 6 + Math.sin(a) * 10 * p; c.moveTo(px, py - 3); c.lineTo(px + 2, py); c.lineTo(px, py + 3); c.lineTo(px - 2, py); c.fill(); }
  } else if (f.kind === 'flare') {
    glow(c, x, y - 6, r * (0.5 + p), 'rgba(230, 120, 255, 1)', 0.8 * (1 - p));
    glow(c, x, y - 6, r * 0.6, 'rgba(255, 170, 60, 1)', 0.7 * (1 - p));
  } else if (f.kind === 'boom' || f.kind === 'place') {
    c.globalAlpha = 1 - p;
    c.strokeStyle = '#fff4d8'; c.lineWidth = 2.5; c.beginPath(); c.arc(x, y, r * (0.3 + p * 0.7), 0, Math.PI * 2); c.stroke();
    for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; ellipse(c, x + Math.cos(a) * r * p, y + Math.sin(a) * r * p * 0.7, 3 * (1 - p) + 1, 2 * (1 - p) + 1, f.kind === 'place' ? '#e8cf8a' : '#b8a88e'); }
    c.globalAlpha = 1;
  } else if (f.kind === 'hit') {
    c.strokeStyle = `rgba(255, 246, 192, ${1 - p})`; c.lineWidth = 1.5;
    for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2; c.beginPath(); c.moveTo(x + Math.cos(a) * 2, y - 6 + Math.sin(a) * 2); c.lineTo(x + Math.cos(a) * 6, y - 6 + Math.sin(a) * 6); c.stroke(); }
  } else {
    const text = f.kind === 'coin' ? (f.value ? `+${f.value}` : '★') : `−${f.value} 🔥`;
    c.font = 'bold 11px Arial'; c.textAlign = 'center';
    c.lineWidth = 3; c.strokeStyle = `rgba(30, 20, 20, ${1 - p})`; c.strokeText(text, x, y - 14 - p * 16);
    c.fillStyle = f.kind === 'coin' ? `rgba(255, 220, 110, ${1 - p})` : `rgba(255, 140, 110, ${1 - p})`; c.fillText(text, x, y - 14 - p * 16);
  }
}

// ---------- The whole scene ----------

export type Ghost = { kind: 'piece'; piece: PieceId; rot: number; c: number; r: number; ok: boolean; d?: Int32Array } | { kind: 'tower'; tower: TowerId; c: number; r: number; ok: boolean; range: number } | { kind: 'shovel'; c: number; r: number; ok: boolean } | null;

export function drawMaze(c: CanvasRenderingContext2D, b: Battle, time: number, ghost: Ghost, selected: Tower | null) {
  const look = lookOf(b.region.id);
  ground(c, b, look, time);
  routes(c, b, time, ghost?.kind === 'piece' && ghost.ok && ghost.d && ghost.d.some((v) => v < INF) ? ghost.d : undefined);
  // Row by row, back to front: blocks, then what stands on them, then predators on that row.
  for (let r = 0; r < ROWS; r++) {
    blocks(c, b, look, [r]);
    for (const t of b.towers) if (t.r === r) tower(c, t.kind, X(t.c) + TILE / 2, Y(t.r) + TILE / 2 - LIFT, { level: t.level, time: time + t.id, aim: t.aim, flash: t.flash });
    for (const e of b.enemies) if (!ENEMIES[e.kind].air && Math.min(ROWS - 1, Math.max(0, Math.floor(e.y))) === r) enemy(c, e, time);
  }
  hearth(c, b, time);
  for (const e of b.enemies) if (ENEMIES[e.kind].air) enemy(c, e, time);
  for (const s of b.shots) shot(c, s, time);
  for (const f of b.effects) effect(c, f);
  // Dusk, pools of firelight and moonlight, drifting embers, and a vignette.
  c.fillStyle = look.dusk; c.fillRect(0, 0, VIEW_W, VIEW_H);
  for (const t of b.towers) {
    const el = TOWERS[t.kind].element;
    if (el === 'fire') glow(c, X(t.c) + TILE / 2, Y(t.r) - 4, 44, 'rgba(255, 130, 50, 0.9)', 0.35);
    else if (el === 'arcane') glow(c, X(t.c) + TILE / 2, Y(t.r) - 6, 40, 'rgba(180, 140, 255, 0.9)', 0.3);
    else if (el === 'spark' && t.flash > 0) glow(c, X(t.c) + TILE / 2, Y(t.r) - 6, 36, 'rgba(255, 230, 90, 0.9)', 0.4);
  }
  for (const e of b.enemies) if (e.burnT > 0) glow(c, X(e.x), Y(e.y), 20, 'rgba(255, 120, 40, 0.9)', 0.3);
  for (let i = 0; i < 26; i++) {
    const period = 6 + hash(i) * 6, p = ((time / period + hash(i + 7)) % 1), [hx, hy] = b.hearth;
    const x = X(hx) - 6 - p * 200 * hash(i + 3) + Math.sin(time * 1.5 + i) * 8 - (i % 3) * 180 * hash(i + 11), y = Y(hy) - 20 - p * 260 + (i % 4) * 30;
    if (x < 0 || y < 0) continue;
    ellipse(c, x, y, 1.2, 1.2, `rgba(255, ${170 + Math.floor(hash(i) * 60)}, 90, ${(1 - p) * 0.8})`);
  }
  const v = c.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.45, VIEW_W / 2, VIEW_H / 2, VIEW_W * 0.72);
  v.addColorStop(0, 'rgba(0, 0, 0, 0)'); v.addColorStop(1, 'rgba(10, 5, 20, 0.55)');
  c.fillStyle = v; c.fillRect(0, 0, VIEW_W, VIEW_H);
  // Selection and placement on top of the lighting so they stay readable.
  if (selected) rangeRing(c, selected.c, selected.r, b.stats(selected).range, 'rgba(255, 240, 210, 0.85)');
  if (ghost) {
    if (ghost.kind === 'piece') {
      for (const [gc, gr] of cellsAt(ghost.piece, ghost.rot, ghost.c, ghost.r)) {
        if (!b.inGrid(gc, gr)) continue;
        c.fillStyle = ghost.ok ? 'rgba(255, 230, 160, 0.45)' : 'rgba(230, 50, 60, 0.45)';
        c.fillRect(X(gc), Y(gr) - LIFT, TILE, TILE + LIFT);
        c.strokeStyle = ghost.ok ? '#fff2c0' : '#ff6070'; c.lineWidth = 2; c.strokeRect(X(gc) + 1, Y(gr) - LIFT + 1, TILE - 2, TILE + LIFT - 2);
      }
    } else {
      const x = X(ghost.c), y = Y(ghost.r) - LIFT;
      c.strokeStyle = ghost.ok ? '#fff2c0' : '#ff6070'; c.lineWidth = 2; c.strokeRect(x + 1, y + 1, TILE - 2, TILE - 2);
      if (ghost.kind === 'tower') {
        rangeRing(c, ghost.c, ghost.r, ghost.range, ghost.ok ? 'rgba(255, 240, 210, 0.75)' : 'rgba(255, 96, 112, 0.75)');
        if (ghost.ok) { c.globalAlpha = 0.65; tower(c, ghost.tower, x + TILE / 2, y + TILE / 2, { level: 0, time }); c.globalAlpha = 1; }
      }
    }
  }
}

function rangeRing(c: CanvasRenderingContext2D, col: number, r: number, range: number, stroke: string) {
  c.save(); c.strokeStyle = stroke; c.fillStyle = 'rgba(255, 240, 210, 0.07)'; c.lineWidth = 1.5; c.setLineDash([5, 4]);
  c.beginPath(); c.arc(X(col) + TILE / 2, Y(r) + TILE / 2 - LIFT, range * TILE, 0, Math.PI * 2); c.fill(); c.stroke();
  c.restore();
}

// ---------- Icons for the page ----------

export function drawTowerIcon(c: CanvasRenderingContext2D, kind: TowerId, w: number, h: number, time = 0) {
  c.clearRect(0, 0, w, h);
  tower(c, kind, w / 2, h * 0.62, { level: 0, time });
}
export function drawCritterIcon(c: CanvasRenderingContext2D, kind: Enemy['kind'], w: number, h: number) {
  c.clearRect(0, 0, w, h);
  critter(c, kind, w / 2 - 1, h * 0.78, 1, 0, kind === 'lynx' ? 0.8 : 1);
}
/** A card's picture: the piece's shape in bales, or the item. */
export function drawCardIcon(c: CanvasRenderingContext2D, id: CardId, w: number, h: number, rot = 0) {
  c.clearRect(0, 0, w, h);
  if (isPiece(id)) {
    const cells = cellsAt(id, rot, 0, 0), minC = Math.min(...cells.map(([x]) => x)), minR = Math.min(...cells.map(([, y]) => y));
    const cw = Math.max(...cells.map(([x]) => x)) - minC + 1, ch = Math.max(...cells.map(([, y]) => y)) - minR + 1;
    const s = Math.min((w - 8) / cw, (h - 10) / ch, 14), ox = (w - cw * s) / 2, oy = (h - ch * s) / 2 - 1;
    const has = (x: number, y: number) => cells.some(([a, b2]) => a === x && b2 === y);
    for (const [x, y] of cells) {
      const px = ox + (x - minC) * s, py = oy + (y - minR) * s;
      if (!has(x, y + 1)) { c.fillStyle = '#c9982f'; c.fillRect(px, py + s, s, 3); }
      c.fillStyle = '#f2cf6a'; c.fillRect(px, py, s, s);
      c.strokeStyle = '#8a6418'; c.lineWidth = 1; c.strokeRect(px + 0.5, py + 0.5, s - 1, s - 1);
    }
    return;
  }
  const x = w / 2, y = h / 2;
  if (id === 'shovel') {
    c.strokeStyle = '#7a5230'; c.lineWidth = 3; c.beginPath(); c.moveTo(x - 10, y - 10); c.lineTo(x + 4, y + 4); c.stroke();
    c.fillStyle = '#b8bcc6'; c.beginPath(); c.moveTo(x + 2, y + 1); c.lineTo(x + 12, y + 5); c.lineTo(x + 8, y + 12); c.closePath(); c.fill();
  } else if (id === 'bundle') {
    c.fillStyle = '#f2cf6a'; c.beginPath(); c.moveTo(x - 10, y + 10); c.lineTo(x - 4, y - 10); c.lineTo(x + 4, y - 10); c.lineTo(x + 10, y + 10); c.closePath(); c.fill();
    c.fillStyle = '#c0392b'; c.fillRect(x - 7, y, 14, 3);
  } else {
    c.fillStyle = '#e8e0d4'; c.beginPath(); c.roundRect(x - 8, y - 6, 14, 14, 3); c.fill();
    c.strokeStyle = '#e8e0d4'; c.lineWidth = 2; c.beginPath(); c.arc(x + 7, y + 1, 4, -1.2, 1.2); c.stroke();
    ellipse(c, x - 1, y - 5, 6, 2, '#6b3a22');
    c.strokeStyle = 'rgba(255, 255, 255, 0.6)'; c.lineWidth = 1; c.beginPath(); c.moveTo(x - 3, y - 9); c.quadraticCurveTo(x - 1, y - 13, x - 3, y - 16); c.stroke();
  }
}
export const pieceName = (id: CardId) => (isPiece(id) ? PIECES[id].name : '');
