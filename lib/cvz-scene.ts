// Canvas 2D drawing for Chinchillas vs Zombies: a moonlit lawn seen in 2.5D perspective, with Dora and Enzo's burrow
// on the left, hay carts at the end of each lane, chinchilla defenders facing right (the shared Dora and Enzo drawing),
// cartoon zombies with glowing eyes shambling in from a foggy street, pellets, seed pouches to click, and effects.
import { Game, DEFENDERS, ZOMBIES, ROWS, COLS, type DefenderId, type ZombieId, type Defender, type Zombie, type Seed, type Effect } from './cvz-game';
import { COATS, coatLike, drawChinchilla, type Coat } from './chinchilla-art';

export const VIEW_W = 970, VIEW_H = 578;
/** Flat-view tile size: everything is drawn at this size, then scaled by its depth. */
const TW = 86;
// The camera: the lawn is a floor seen from above and in front. A point x tiles from the burrow edge and b rows from
// the back of the lawn sits at depth D = 9 - 0.6 b, so the back row is two thirds the width of the front one.
const F = 7380, UNIT = 0.0724, CX = 520, HORIZON = -670;
const depthAt = (b: number) => 9 - 0.6 * b;
/** Screen position and scale (1 = the flat tile size) of the lawn point (x tiles, b rows). */
export function project(x: number, b: number) {
  const d = depthAt(b);
  return { x: CX + (F * (x - COLS / 2) * UNIT) / d, y: HORIZON + F / d, s: (F * UNIT) / d / TW };
}
/** The tile under a point on the canvas (either may be out of range). */
export function toTile(px: number, py: number) {
  if (py <= HORIZON + 1) return { col: -1, row: -1 };
  const d = F / (py - HORIZON);
  return { col: Math.floor(((px - CX) * d) / (F * UNIT) + COLS / 2), row: Math.floor((9 - d) / 0.6) };
}
/** Where a tile's middle is drawn. */
export const tileCenter = (row: number, col: number) => project(col + 0.5, row + 0.5);
/** A seed pouch's centre: over its landing spot, lifted while it's still falling. */
export function seedPx(s: Seed) {
  const g = project(s.x, s.toY);
  return { x: g.x, y: g.y - (20 + (s.toY - s.y) * 100) * g.s, s: g.s };
}
// Where things stand within their lane: carts, defenders and zombies each a little nearer than the last.
const CART_B = 0.62, FEET_B = 0.7, ZOMBIE_B = 0.76;

const blackEyes = { eye: '#16121a', pupil: '#000000', earGlow: false, eyeR: 1.75 };
const KIT: Coat = coatLike('dora', { ...blackEyes, fur: '#eeeaf0', back: '#dad3df', face: '#f6f3f8', shade: '#ccc4d2', texture: '#d8d0dc', tail: '#ebe6ee', tailInner: '#cfc6d6' });
const KIT2: Coat = coatLike('enzo', { fur: '#8d8b93', back: '#66646c', face: '#a3a1aa', shade: '#75737b', texture: '#6a6870', tail: '#8a8892', tailOuter: '#67656e' });
const BEIGE: Coat = coatLike('dora', { fur: '#ecd6b3', back: '#d8bc90', face: '#f4e4cb', shade: '#caa97e', texture: '#cfb48b', tail: '#e9d2ad', tailInner: '#d0b58c' });
const PEBBLE: Coat = coatLike('enzo', { fur: '#a9a7b0', back: '#8a8891', face: '#c4c2ca', shade: '#96949d', texture: '#8f8d96', tail: '#b0aeb7', tailOuter: '#8c8a94', tailInner: '#d2d0d8', bands: false });

const ellipse = (c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill?: string, rot = 0) => {
  c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2);
  if (fill) { c.fillStyle = fill; c.fill(); }
};
const hash = (n: number) => { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); };

// ---------- The yard ----------

/** Fills the outline through the given lawn points (x tiles, b rows). */
function floor(c: CanvasRenderingContext2D, pts: [number, number][], fill: string | CanvasGradient) {
  c.beginPath();
  for (const [i, [x, b]] of pts.entries()) { const p = project(x, b); if (i) c.lineTo(p.x, p.y); else c.moveTo(p.x, p.y); }
  c.closePath(); c.fillStyle = fill; c.fill();
}
const glow = (c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, color: string, alpha: number) => {
  c.save(); c.translate(x, y); c.scale(1, ry / rx);
  const g = c.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, `rgba(${color}, ${alpha})`); g.addColorStop(1, `rgba(${color}, 0)`);
  c.fillStyle = g; c.fillRect(-rx, -rx, rx * 2, rx * 2); c.restore();
};
const STARS = Array.from({ length: 34 }, (_, i) => ({ x: hash(i + 1) * VIEW_W, y: hash(i + 50) * 120, r: 0.7 + hash(i + 99) * 0.9 }));
const ROOFS: [number, number, number][] = [[180, 68, 46], [262, 56, 36], [640, 72, 52], [726, 60, 38]];
const LAMPS = [0.7, 3.6];
/** The burrow's doorway, in screen space: where Dora sits and the lanes' warm light comes from. */
const DOOR = (() => { const p = project(-1.35, 2.7); return { x: p.x, y: p.y, u: p.s }; })();

function yard(c: CanvasRenderingContext2D, g: Game, time: number) {
  // Night sky with twinkling stars, the moon, and the rooftops across the street.
  const sky = c.createLinearGradient(0, 0, 0, 160);
  sky.addColorStop(0, '#080a20'); sky.addColorStop(0.62, '#2c2a62'); sky.addColorStop(1, '#5a4a86');
  c.fillStyle = sky; c.fillRect(0, 0, VIEW_W, VIEW_H);
  for (const [i, s] of STARS.entries()) { c.globalAlpha = 0.5 + 0.5 * Math.sin(time * 1.5 + i); ellipse(c, s.x, s.y, s.r, s.r, '#ffffff'); }
  c.globalAlpha = 1;
  glow(c, 760, 58, 150, 150, '200, 210, 255', 0.22); glow(c, 760, 58, 64, 64, '255, 244, 214', 0.5);
  ellipse(c, 760, 58, 24, 24, '#fff4d6'); ellipse(c, 752, 52, 4.5, 4.5, '#efe0b8'); ellipse(c, 768, 66, 3, 3, '#efe0b8'); ellipse(c, 757, 68, 2, 2, '#efe0b8');
  // Thin cloud drifting past the moon, and far trees and rooftops with lit windows and smoking chimneys.
  for (let i = 0; i < 5; i++) { const x = ((i * 211 + time * (5 + i)) % (VIEW_W + 260)) - 130, y = 40 + i * 19; c.globalAlpha = 0.16; ellipse(c, x, y, 90, 7, '#c9c6f2'); ellipse(c, x + 40, y + 5, 60, 5, '#c9c6f2'); }
  c.globalAlpha = 1;
  c.fillStyle = '#10112c';
  for (let i = 0; i < 26; i++) { const x = i * 36 + hash(i * 3) * 20, h = 16 + hash(i + 8) * 22; c.beginPath(); c.ellipse(x, 150 - h * 0.5, 13 + hash(i) * 8, h * 0.62, 0, 0, Math.PI * 2); c.fill(); }
  for (const [x, w, h] of ROOFS) {
    c.fillStyle = '#161634'; c.beginPath(); c.moveTo(x, 150); c.lineTo(x, 150 - h * 0.5); c.lineTo(x + w / 2, 150 - h); c.lineTo(x + w, 150 - h * 0.5); c.lineTo(x + w, 150); c.fill();
    c.fillRect(x + w * 0.7, 150 - h * 0.92, 7, h * 0.3);
    c.fillStyle = 'rgba(190, 200, 255, 0.2)'; c.beginPath(); c.moveTo(x + w / 2, 150 - h); c.lineTo(x + w, 150 - h * 0.5); c.lineTo(x + w - 4, 150 - h * 0.5 + 2); c.lineTo(x + w / 2, 150 - h + 5); c.fill();
    for (let k = 0; k < 3; k++) { const p = ((time * 0.25 + k / 3 + x) % 1); c.globalAlpha = (1 - p) * 0.22; ellipse(c, x + w * 0.7 + 3.5 + Math.sin(p * 5 + x) * 4, 150 - h * 0.92 - p * 26, 3 + p * 6, 3 + p * 5, '#b9b6e0'); }
    c.globalAlpha = 1;
    glow(c, x + w / 2, 150 - h * 0.45 + 4, 16, 16, '255, 200, 110', 0.35);
    c.fillStyle = '#ffd27a'; c.fillRect(x + w / 2 - 4, 150 - h * 0.45, 8, 8);
    c.fillStyle = '#161634'; c.fillRect(x + w / 2 - 0.5, 150 - h * 0.45, 1, 8); c.fillRect(x + w / 2 - 4, 150 - h * 0.45 + 3.5, 8, 1);
  }
  // The garden around the lawn, the street on the right, and the hedge along the back.
  c.fillStyle = '#173522'; c.fillRect(0, 146, VIEW_W, VIEW_H);
  floor(c, [[9.08, 0], [9.25, 0], [9.25, 5.6], [9.08, 5.6]], '#3a3c4f');
  floor(c, [[9.25, 0], [11.4, 0], [11.4, 5.6], [9.25, 5.6]], '#1b1c29');
  for (let k = 0; k < 6; k++) floor(c, [[10.18, k * 0.95 + 0.2], [10.28, k * 0.95 + 0.2], [10.28, k * 0.95 + 0.62], [10.18, k * 0.95 + 0.62]], '#34364a');
  const h0 = project(-1.2, 0), h1 = project(10.6, 0);
  c.fillStyle = '#0f2a1c'; c.beginPath(); c.moveTo(h0.x, h0.y + 2);
  for (let i = 0; i <= 22; i++) { const x = h0.x + (i / 22) * (h1.x - h0.x); c.quadraticCurveTo(x - (h1.x - h0.x) / 44, h0.y - 22 - (i % 2) * 6, x, h0.y - 10); }
  c.lineTo(h1.x, h0.y + 2); c.fill();
  // The lawn: checked grass, with lanes not in play left as bare earth.
  for (let r = 0; r < ROWS; r++) {
    const play = g.lane(r);
    for (let col = 0; col < COLS; col++) floor(c, [[col, r], [col + 1, r], [col + 1, r + 1], [col, r + 1]], play ? ((r + col) % 2 ? '#28603d' : '#2f6c46') : ((r + col) % 2 ? '#352a24' : '#3d3029'));
    c.lineCap = 'round';
    if (play) {
      c.strokeStyle = '#1d4d31'; c.lineWidth = 1.7; c.beginPath();
      for (let col = 0; col < COLS; col++) for (let i = 0; i < 3; i++) {
        const p = project(col + 0.15 + hash(r * 9 + col * 3 + i) * 0.7, r + 0.2 + hash(col * 7 + r + i * 5) * 0.7);
        c.moveTo(p.x, p.y); c.lineTo(p.x - 3 * p.s, p.y - 8 * p.s); c.moveTo(p.x, p.y); c.lineTo(p.x + 4 * p.s, p.y - 7 * p.s);
      }
      c.stroke();
      // Lighter blades among them, and the odd night flower.
      c.strokeStyle = '#4f9a5c'; c.lineWidth = 1.2; c.beginPath();
      for (let col = 0; col < COLS; col++) for (let i = 0; i < 3; i++) {
        const p = project(col + 0.1 + hash(r * 5 + col * 11 + i * 3) * 0.8, r + 0.15 + hash(col * 13 + r * 3 + i) * 0.75);
        c.moveTo(p.x, p.y); c.lineTo(p.x + 1.5 * p.s, p.y - 7 * p.s); c.moveTo(p.x, p.y); c.lineTo(p.x - 3.5 * p.s, p.y - 5 * p.s);
        if ((r * 7 + col * 5 + i) % 11 === 0) { c.stroke(); ellipse(c, p.x + 5 * p.s, p.y - 4 * p.s, 2.2 * p.s, 2 * p.s, (r + col) % 2 ? '#d9d2ff' : '#ffe9a8'); ellipse(c, p.x + 5 * p.s, p.y - 4 * p.s, 0.9 * p.s, 0.8 * p.s, '#f2b33a'); c.beginPath(); }
      }
      c.stroke();
    } else {
      c.strokeStyle = '#2a211c'; c.lineWidth = 2; c.beginPath();
      for (const b of [0.25, 0.5, 0.75]) { const a = project(0, r + b), z = project(COLS, r + b); c.moveTo(a.x, a.y); c.lineTo(z.x, z.y); }
      c.stroke();
    }
  }
  for (let r = 1; r < ROWS; r++) floor(c, [[0, r - 0.02], [COLS, r - 0.02], [COLS, r + 0.02], [0, r + 0.02]], 'rgba(10, 26, 16, 0.35)');
  // Moonlight falls across the lawn from the street side, warm light from the burrow door on the other, and the nearest rows sit in shade.
  const far0 = project(0, 0), near0 = project(0, ROWS), far1 = project(COLS, 0);
  const across = c.createLinearGradient(near0.x, 0, far1.x + 80, 0);
  across.addColorStop(0, 'rgba(255, 190, 110, 0.16)'); across.addColorStop(0.35, 'rgba(255, 190, 110, 0)'); across.addColorStop(0.7, 'rgba(170, 190, 255, 0)'); across.addColorStop(1, 'rgba(170, 190, 255, 0.2)');
  floor(c, [[0, 0], [COLS, 0], [COLS, ROWS], [0, ROWS]], across);
  const down = c.createLinearGradient(0, far0.y, 0, near0.y);
  down.addColorStop(0, 'rgba(200, 215, 255, 0.1)'); down.addColorStop(0.5, 'rgba(0, 0, 0, 0)'); down.addColorStop(1, 'rgba(6, 6, 26, 0.22)');
  floor(c, [[0, 0], [COLS, 0], [COLS, ROWS], [0, ROWS]], down);
  const f0 = project(0, ROWS), f1 = project(COLS, ROWS);
  const soil = c.createLinearGradient(0, f0.y, 0, f0.y + 18); soil.addColorStop(0, '#4a3524'); soil.addColorStop(1, '#22160f');
  c.fillStyle = soil; c.fillRect(f0.x, f0.y, f1.x - f0.x, 18);
  c.fillStyle = '#2a633f';
  for (let x = f0.x; x < f1.x; x += 9) { const h = 3 + hash(x) * 4; c.beginPath(); c.moveTo(x, f0.y - 0.5); c.lineTo(x + 9, f0.y - 0.5); c.lineTo(x + 6.5, f0.y + h); c.lineTo(x + 4.5, f0.y + h * 0.4); c.lineTo(x + 2.5, f0.y + h); c.fill(); }
  // A gravel path for the hay carts, and the grassy mound of the burrow.
  floor(c, [[-1.05, 0], [-0.02, 0], [-0.02, 5.6], [-1.05, 5.6]], '#3a3244');
  floor(c, [[-4, 0], [-1.2, 0], [-0.9, 1.2], [-0.95, 2.6], [-0.9, 4], [-1.25, 5.6], [-4, 5.6]], '#2a5e3e');
  burrow(c, g, time);
  // Street lamps with pools of light.
  for (const b of LAMPS) {
    const p = project(9.7, b), s = p.s;
    glow(c, p.x - 20 * s, p.y, 80 * s, 22 * s, '255, 217, 138', 0.5);
    c.strokeStyle = '#0a0a12'; c.lineWidth = 4.5 * s; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x, p.y - 110 * s); c.quadraticCurveTo(p.x, p.y - 122 * s, p.x - 12 * s, p.y - 122 * s); c.stroke();
    c.shadowColor = '#ffe29a'; c.shadowBlur = 12; ellipse(c, p.x - 16 * s, p.y - 118 * s, 9 * s, 5 * s, '#ffe29a'); c.shadowBlur = 0;
  }
}

/** The burrow's front door: a stone arch in the mound, lit from deep inside, with Dora on the step and Enzo on top. */
function burrow(c: CanvasRenderingContext2D, g: Game, time: number) {
  const { x: dx, y: dy, u } = DOOR, cx = dx - 10 * u, cy = dy - 38 * u;
  c.fillStyle = '#2f6a45'; c.strokeStyle = '#0e2418'; c.lineWidth = 3;
  c.beginPath(); c.moveTo(dx - 118 * u, dy + 12 * u); c.bezierCurveTo(dx - 118 * u, dy - 160 * u, dx + 96 * u, dy - 168 * u, dx + 76 * u, dy + 12 * u); c.closePath(); c.fill(); c.stroke();
  // The tunnel: dark at the mouth, warm light deep inside.
  const inside = c.createRadialGradient(cx, dy - 6 * u, 2, cx, dy - 6 * u, 46 * u);
  inside.addColorStop(0, '#ffc46a'); inside.addColorStop(0.45, '#9a4f1f'); inside.addColorStop(1, '#1c120c');
  c.fillStyle = inside; c.beginPath(); c.moveTo(cx - 36 * u, dy); c.lineTo(cx - 36 * u, cy); c.ellipse(cx, cy, 36 * u, 42 * u, 0, Math.PI, 0); c.lineTo(cx + 36 * u, dy); c.closePath(); c.fill();
  // The stone arch around it.
  c.strokeStyle = '#171226'; c.lineWidth = 2;
  const stone = (x: number, y: number, i: number) => { ellipse(c, x, y, 10 * u, 8 * u, i % 2 ? '#8a8494' : '#9b95a6'); c.stroke(); };
  for (let i = 0; i <= 8; i++) { const a = Math.PI + (i * Math.PI) / 8; stone(cx + Math.cos(a) * 44 * u, cy + Math.sin(a) * 50 * u, i); }
  for (const side of [-1, 1]) for (let k = 0; k < 2; k++) stone(cx + side * 44 * u, cy + (14 + k * 16) * u, 1);
  // The round wooden door, swung open against the hill, and the doorstep and mat.
  ellipse(c, cx + 62 * u, cy + 4 * u, 12 * u, 40 * u, '#7a4a26'); c.lineWidth = 2.5; c.stroke();
  ellipse(c, cx + 66 * u, cy + 6 * u, 2.6 * u, 2.6 * u, '#ffcf3a');
  ellipse(c, cx, dy + 2 * u, 44 * u, 9 * u, '#5e5160'); c.lineWidth = 2; c.stroke();
  ellipse(c, cx, dy + u, 26 * u, 5 * u, '#b98a4a');
  // A lantern on the arch and a name sign on a post.
  c.strokeStyle = '#171226'; c.beginPath(); c.moveTo(cx - 50 * u, cy - 30 * u); c.lineTo(cx - 50 * u, cy - 16 * u); c.stroke();
  c.shadowColor = '#ffd27a'; c.shadowBlur = 14; c.fillStyle = '#ffd27a'; c.fillRect(cx - 57 * u, cy - 16 * u, 14 * u, 17 * u); c.shadowBlur = 0;
  c.fillStyle = '#7a4a26'; c.fillRect(dx - 82 * u, dy - 40 * u, 4 * u, 50 * u);
  c.fillStyle = '#a8723c'; c.fillRect(dx - 104 * u, dy - 62 * u, 50 * u, 24 * u); c.strokeRect(dx - 104 * u, dy - 62 * u, 50 * u, 24 * u);
  c.font = `700 ${Math.round(12 * u)}px Georgia, serif`; c.textAlign = 'center'; c.fillStyle = '#fff1d0'; c.fillText('D & E', dx - 79 * u, dy - 45 * u);
  // Dora on the doorstep and Enzo keeping watch from the top, bigger than any defender. A rolling cart makes them dizzy.
  const scared = g.carts.some((k) => k === 'rolling'), dh = 58 * u, eh = 66 * u;
  drawChinchilla(c, COATS.enzo, dx - 26 * u + eh / 6, dy - 108 * u, { face: 1, h: eh, time: time + 2, dizzy: scared });
  drawChinchilla(c, COATS.dora, cx + 16 * u + dh / 6, dy + 4 * u, { face: 1, h: dh, time, dizzy: scared });
}

/** Light and air over everything: fog off the street, fireflies, haze on the far lanes, the burrow's glow, a vignette. */
function atmosphere(c: CanvasRenderingContext2D, time: number) {
  for (const [i, [b, w]] of ([[0.5, 120], [1.6, 110], [2.6, 150], [3.6, 130], [4.8, 170]] as const).entries()) {
    const p = project(9 - 0.3 * Math.sin(time * 0.3 + i), b);
    glow(c, p.x, p.y - 6 * p.s, w * p.s, 22 * p.s, '185, 196, 255', 0.24);
  }
  c.shadowColor = '#fff4a0'; c.shadowBlur = 8; c.fillStyle = '#fff4a0';
  for (let i = 0; i < 7; i++) {
    const x = 240 + hash(i + 7) * 520 + Math.sin(time * 0.7 + i * 2) * 26, y = 220 + hash(i + 17) * 300 + Math.cos(time * 0.9 + i) * 14;
    c.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(time * 1.3 + i)); ellipse(c, x, y, 2, 2); c.fill();
  }
  c.shadowBlur = 0; c.globalAlpha = 1;
  const haze = c.createLinearGradient(0, 0, 0, VIEW_H);
  haze.addColorStop(0, 'rgba(106, 112, 184, 0.38)'); haze.addColorStop(0.45, 'rgba(106, 112, 184, 0)');
  c.fillStyle = haze; c.fillRect(0, 0, VIEW_W, VIEW_H);
  const warm = c.createRadialGradient(70, 400, 0, 70, 400, 420);
  warm.addColorStop(0, 'rgba(255, 176, 74, 0.4)'); warm.addColorStop(0.5, 'rgba(255, 154, 58, 0.1)'); warm.addColorStop(1, 'rgba(255, 154, 58, 0)');
  c.fillStyle = warm; c.fillRect(0, 0, VIEW_W, VIEW_H);
  const vig = c.createRadialGradient(520, 360, 340, 520, 360, 620);
  vig.addColorStop(0, 'rgba(5, 4, 15, 0)'); vig.addColorStop(1, 'rgba(5, 4, 15, 0.65)');
  c.fillStyle = vig; c.fillRect(0, 0, VIEW_W, VIEW_H);
}

function cart(c: CanvasRenderingContext2D, x: number, y: number, t: number, rolling: boolean) {
  const spin = rolling ? t * 12 : 0;
  ellipse(c, x + 2, y + 18, 26, 6, 'rgba(0, 0, 0, 0.2)');
  c.fillStyle = '#9c6a3a'; c.strokeStyle = '#5a3a1c'; c.lineWidth = 1.5;
  c.beginPath(); c.moveTo(x - 24, y - 8); c.lineTo(x + 24, y - 8); c.lineTo(x + 18, y + 10); c.lineTo(x - 18, y + 10); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = '#f2cf6a'; c.beginPath(); c.moveTo(x - 22, y - 8); c.quadraticCurveTo(x, y - 30, x + 22, y - 8); c.fill();
  c.strokeStyle = '#c9982f'; c.lineWidth = 1; for (let i = -14; i <= 14; i += 7) { c.beginPath(); c.moveTo(x + i, y - 9); c.lineTo(x + i + 3, y - 20); c.stroke(); }
  for (const wx of [x - 14, x + 14]) {
    ellipse(c, wx, y + 12, 7, 7, '#4a3a2c');
    c.strokeStyle = '#c8b090'; c.lineWidth = 1.2; c.beginPath(); for (let i = 0; i < 3; i++) { const a = spin + (i * Math.PI) / 3; c.moveTo(wx - Math.cos(a) * 6, y + 12 - Math.sin(a) * 6); c.lineTo(wx + Math.cos(a) * 6, y + 12 + Math.sin(a) * 6); } c.stroke();
  }
  c.strokeStyle = '#5a3a1c'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(x - 24, y - 6); c.lineTo(x - 34, y - 20); c.stroke();
}

// ---------- Defenders ----------

/** A defender with its feet at (x, base), facing right. */
export function defender(c: CanvasRenderingContext2D, kind: DefenderId, x: number, base: number, o: { time: number; flash?: number; bite?: number; armed?: number; hp?: number; maxHp?: number; ghost?: boolean }) {
  const t = o.time, flash = o.flash ?? 0, wobble = o.bite ? Math.sin(t * 40) * 1.5 : 0;
  c.save(); c.translate(wobble, 0);
  if (!o.ghost) ellipse(c, x, base, 26, 6, 'rgba(2, 3, 12, 0.35)');
  if (kind === 'gatherer') {
    // A sunflower behind a kit with a basket of seeds.
    c.strokeStyle = '#4f9a3a'; c.lineWidth = 3; c.beginPath(); c.moveTo(x - 14, base); c.quadraticCurveTo(x - 18, base - 30, x - 14, base - 52); c.stroke();
    const sway = Math.sin(t * 2) * 2;
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2 + t * 0.3; ellipse(c, x - 14 + sway + Math.cos(a) * 11, base - 56 + Math.sin(a) * 11, 6, 3, '#ffd23a', a); }
    ellipse(c, x - 14 + sway, base - 56, 8, 8, '#6b3a1c');
    drawChinchilla(c, KIT, x + 4, base, { face: 1, h: 34, time: t, decorate: band('#f2c230') });
    c.fillStyle = '#b8864a'; c.strokeStyle = '#6b4a24'; c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(x + 14, base - 16); c.lineTo(x + 30, base - 16); c.lineTo(x + 27, base - 4); c.lineTo(x + 17, base - 4); c.closePath(); c.fill(); c.stroke();
    for (let i = 0; i < 3; i++) seedShape(c, x + 18 + i * 4, base - 18, 0.6);
    if (flash > 0) { c.globalAlpha = flash / 0.4; ellipse(c, x + 22, base - 30, 14, 14, 'rgba(255, 230, 120, 0.6)'); c.globalAlpha = 1; }
  } else if (kind === 'flicker') {
    drawChinchilla(c, BEIGE, x - 2, base, { face: 1, h: 40, time: t, decorate: both(band('#5bc24a'), slingshot(flash)) });
  } else if (kind === 'twins') {
    drawChinchilla(c, KIT2, x - 12, base - 6, { face: 1, h: 30, time: t + 1, decorate: both(band('#5bc24a'), slingshot(flash)) });
    drawChinchilla(c, BEIGE, x + 6, base, { face: 1, h: 32, time: t, decorate: both(band('#5bc24a'), slingshot(flash)) });
  } else if (kind === 'frost') {
    c.globalAlpha = 0.5;
    for (let i = 0; i < 4; i++) { const a = t * 2 + i * 1.6; ellipse(c, x + Math.cos(a) * 18, base - 20 + Math.sin(a) * 6, 3, 3, '#dff4ff'); }
    c.globalAlpha = 1;
    drawChinchilla(c, COATS.dora, x - 2, base, { face: 1, h: 42, time: t, decorate: both(band('#4aa3e8', true), fan(flash)) });
  } else if (kind === 'pebble') {
    // Grandpa Pebble sitting firm, looking the worse for wear as he's chewed.
    const frac = (o.hp ?? 1) / (o.maxHp ?? 1);
    drawChinchilla(c, PEBBLE, x, base, { face: 1, h: 58, time: t, blink: frac < 0.34, decorate: grandpa(frac) });
  } else if (kind === 'trap') {
    const ready = (o.armed ?? 0) <= 0;
    ellipse(c, x, base - 6, 26, 9, '#8a6a44'); ellipse(c, x, base - 8, 22, 7, '#e8d8b0');
    if (ready) { const tw = 0.5 + 0.5 * Math.sin(t * 6); c.fillStyle = `rgba(255, 255, 255, ${0.5 + tw * 0.5})`; for (let i = 0; i < 3; i++) { const sx = x - 12 + i * 12, sy = base - 16 - (i % 2) * 5; c.beginPath(); c.moveTo(sx, sy - 4); c.lineTo(sx + 1.4, sy); c.lineTo(sx, sy + 4); c.lineTo(sx - 1.4, sy); c.fill(); } }
    else { c.fillStyle = 'rgba(80, 60, 40, 0.8)'; c.font = 'bold 11px Arial'; c.textAlign = 'center'; c.fillText(`${Math.ceil(o.armed ?? 0)}`, x, base - 20); }
  } else {
    // Enzo holds a boulder over his head, about to drop it.
    drawChinchilla(c, COATS.enzo, x - 4, base, { face: 1, h: 42, time: t });
    const lift = 8 + Math.sin(t * 20) * 2;
    ellipse(c, x + 6, base - 52 - lift, 18, 16, '#8f8778'); ellipse(c, x + 1, base - 58 - lift, 6, 4, '#b8b0a0');
    c.strokeStyle = '#5e5a58'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(x - 2, base - 50 - lift); c.lineTo(x + 8, base - 44 - lift); c.stroke();
  }
  c.restore();
}

type Decor = (d: CanvasRenderingContext2D, bob: number) => void;
const both = (...all: Decor[]): Decor => (d, bob) => { for (const f of all) f(d, bob); };
/** A neckerchief in the defender's colour, so each role reads at a glance; the Frost Fan's is a scarf with a tail. */
const band = (color: string, tail = false): Decor => (d, bob) => {
  d.lineCap = 'round'; d.lineJoin = 'round';
  const tie = (w: number, col: string) => {
    d.strokeStyle = col; d.lineWidth = w; d.beginPath(); d.moveTo(1.6, -10.2 + bob); d.quadraticCurveTo(5.4, -6.4 + bob, 9.8, -7.8 + bob);
    if (tail) { d.moveTo(3.4, -8.4 + bob); d.quadraticCurveTo(2.2, -5 + bob, 3, -2.4 + bob); }
    d.stroke();
  };
  tie(2.3, '#171226'); tie(1.55, color);
  d.fillStyle = color; d.strokeStyle = '#171226'; d.lineWidth = 0.35;
  d.beginPath(); d.moveTo(3.2, -8.6 + bob); d.lineTo(1.8, -4.6 + bob); d.lineTo(4.8, -5.6 + bob); d.closePath(); d.fill(); d.stroke();
};
const slingshot = (flash: number) => (d: CanvasRenderingContext2D, bob: number) => {
  d.strokeStyle = '#6b4424'; d.lineWidth = 1.4; d.beginPath();
  d.moveTo(12, -4 + bob); d.lineTo(14, -9 + bob); d.lineTo(12.5, -12 + bob); d.moveTo(14, -9 + bob); d.lineTo(16, -12 + bob); d.stroke();
  if (flash > 0.05) { d.fillStyle = '#8fbf4a'; d.beginPath(); d.arc(18, -11 + bob, 1.6, 0, Math.PI * 2); d.fill(); }
};
const fan = (flash: number) => (d: CanvasRenderingContext2D, bob: number) => {
  const open = flash > 0 ? 1 : 0.6;
  d.save(); d.translate(13, -9 + bob); d.rotate(flash > 0 ? -0.6 : 0.2);
  d.fillStyle = '#bfe6ff'; d.strokeStyle = '#4a7aa4'; d.lineWidth = 0.6;
  d.beginPath(); d.moveTo(0, 0); d.arc(0, 0, 7, -Math.PI / 2 - open, -Math.PI / 2 + open); d.closePath(); d.fill(); d.stroke();
  d.restore();
};
const grandpa = (frac: number) => (d: CanvasRenderingContext2D, bob: number) => {
  d.fillStyle = '#ffffff'; ellipse(d, 9, -16 + bob, 2.6, 1, '#ffffff');
  d.strokeStyle = '#3a3040'; d.lineWidth = 0.6; d.beginPath(); d.arc(10, -13.5 + bob, 1.8, 0, Math.PI * 2); d.stroke();
  if (frac < 0.67) { d.fillStyle = '#f4e8d0'; d.fillRect(-4, -14 + bob, 6, 2); d.fillRect(-2, -16 + bob, 2, 6); }
  if (frac < 0.34) { d.strokeStyle = '#a4506e'; d.lineWidth = 0.8; d.beginPath(); d.moveTo(4, -6 + bob); d.lineTo(8, -4 + bob); d.stroke(); }
};

function seedShape(c: CanvasRenderingContext2D, x: number, y: number, k = 1) {
  c.save(); c.translate(x, y); c.scale(k, k); c.rotate(-0.4);
  c.fillStyle = '#2a2420'; c.beginPath(); c.ellipse(0, 0, 4, 8, 0, 0, Math.PI * 2); c.fill();
  c.strokeStyle = '#f4f0e6'; c.lineWidth = 1.2; for (const sx of [-1.6, 1.6]) { c.beginPath(); c.moveTo(sx, -6); c.lineTo(sx, 6); c.stroke(); }
  c.restore();
}

// ---------- Zombies ----------

/** A zombie with its feet at (x, base), facing left. */
export function zombie(c: CanvasRenderingContext2D, kind: ZombieId, x: number, base: number, o: { step: number; eating?: boolean; armor?: number; maxArmor?: number; chilled?: boolean; hit?: number; jump?: number; hp?: number; maxHp?: number }) {
  const big = kind === 'brute' ? 1.45 : 1, step = o.step, sway = Math.sin(step) * 3, eat = o.eating ? Math.sin(step * 3 + performanceTime()) * 3 : 0;
  const skin = o.chilled ? '#9ed6e6' : '#86b07c', skinDark = o.chilled ? '#6ea8bc' : '#5d8657', suit = o.chilled ? '#4d5f84' : kind === 'brute' ? '#5d3a3a' : '#4a4160';
  const lift = o.jump && o.jump > 0 ? Math.sin((1 - o.jump / 0.7) * Math.PI) * 40 : 0;
  c.save(); c.translate(x, base - lift); c.scale(big, big);
  ellipse(c, 0, lift / big, 22, 6, 'rgba(2, 3, 12, 0.38)');
  if (o.hit && o.hit > 0) c.filter = 'brightness(1.5)';

  // Legs, shuffling.
  c.strokeStyle = '#2b2838'; c.lineWidth = 7; c.lineCap = 'round';
  c.beginPath(); c.moveTo(-2, -30); c.lineTo(-6 + sway, -2); c.moveTo(6, -30); c.lineTo(8 - sway, -2); c.stroke();
  ellipse(c, -9 + sway, -1, 7, 3.5, '#3a2c20'); ellipse(c, 5 - sway, -1, 7, 3.5, '#3a2c20');
  // Torn jacket, shirt and tie.
  c.fillStyle = suit; c.strokeStyle = '#171226'; c.lineWidth = 1.5;
  c.beginPath(); c.moveTo(-12, -62); c.lineTo(14, -62); c.lineTo(16, -28); c.lineTo(10, -24); c.lineTo(4, -29); c.lineTo(-2, -24); c.lineTo(-14, -28); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = '#e8e0d0'; c.beginPath(); c.moveTo(-4, -62); c.lineTo(6, -62); c.lineTo(3, -34); c.lineTo(-2, -34); c.closePath(); c.fill();
  c.fillStyle = '#b8302a'; c.beginPath(); c.moveTo(0, -60); c.lineTo(3, -52); c.lineTo(1, -40); c.lineTo(-2, -52); c.closePath(); c.fill();
  // Arms stretched out in front (to the left), bobbing while eating.
  c.strokeStyle = suit; c.lineWidth = 7;
  c.beginPath(); c.moveTo(-8, -56); c.lineTo(-30, -52 + eat); c.moveTo(4, -54); c.lineTo(-24, -46 - eat); c.stroke();
  ellipse(c, -33, -52 + eat, 5, 4, skin); ellipse(c, -27, -46 - eat, 5, 4, skin);
  // Head.
  const hy = -76 + (o.eating ? eat * 0.6 : 0);
  ellipse(c, -2, hy, 15, 16, skin); c.strokeStyle = skinDark; c.lineWidth = 1.5; c.stroke();
  // Eyes that glow in the dark.
  c.shadowColor = o.chilled ? '#e8fbff' : '#d8ff6a'; c.shadowBlur = 10;
  ellipse(c, -9, hy - 3, 5.5, 6, o.chilled ? '#e8fbff' : '#eaff80'); ellipse(c, 2, hy - 2, 4, 4.5, o.chilled ? '#e8fbff' : '#eaff80');
  c.shadowBlur = 0;
  ellipse(c, -10, hy - 2, 2, 2.2, '#1a1a1a'); ellipse(c, 1, hy - 1, 1.6, 1.8, '#1a1a1a');
  c.strokeStyle = '#3a2a2a'; c.lineWidth = 2; c.beginPath(); c.moveTo(-12, hy + 8); c.quadraticCurveTo(-4, hy + (o.eating ? 13 : 10), 4, hy + 8); c.stroke();
  c.fillStyle = '#f4f0e0'; c.fillRect(-7, hy + 8, 3, 3);
  c.strokeStyle = skinDark; c.lineWidth = 1; c.beginPath(); c.moveTo(6, hy - 12); c.lineTo(10, hy - 6); c.stroke();
  // What's on its head, while it lasts.
  const worn = (o.armor ?? 0) > 0, dented = worn && (o.armor ?? 0) < (o.maxArmor ?? 1) * 0.5;
  if (kind === 'cone' && worn) {
    c.fillStyle = '#ff8a2a'; c.strokeStyle = '#b8561a'; c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(-14, hy - 10); c.lineTo(10, hy - 10); c.lineTo(dented ? -4 : -2, hy - 40); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#ffffff'; c.fillRect(-9, hy - 22, 13, 3);
  } else if (kind === 'bucket' && worn) {
    c.fillStyle = '#a8adb6'; c.strokeStyle = '#5e626a'; c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(-16, hy - 6); c.lineTo(12, hy - 6); c.lineTo(9, hy - 28); c.lineTo(-13, hy - 28); c.closePath(); c.fill(); c.stroke();
    if (dented) { c.strokeStyle = '#6e737c'; c.beginPath(); c.moveTo(-6, hy - 22); c.lineTo(-2, hy - 16); c.lineTo(2, hy - 22); c.stroke(); }
  } else if (kind === 'flag') {
    c.strokeStyle = '#6b4424'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(12, -58); c.lineTo(12, -112); c.stroke();
    const wave = Math.sin(step * 2) * 3;
    c.fillStyle = '#c0392b'; c.beginPath(); c.moveTo(12, -112); c.quadraticCurveTo(26, -108 + wave, 38, -110); c.lineTo(38, -90); c.quadraticCurveTo(26, -88 + wave, 12, -92); c.fill();
    ellipse(c, 25, -100, 4, 4, '#f4e8d0'); ellipse(c, 22, -95, 1.4, 1.4, '#c0392b'); ellipse(c, 28, -95, 1.4, 1.4, '#c0392b');
  } else if (kind === 'brute') {
    c.fillStyle = '#6b4424'; c.strokeStyle = '#3a2410'; c.lineWidth = 1.5;
    c.save(); c.translate(-30, -52 + eat); c.rotate(-0.6 + (o.eating ? Math.sin(step * 4) * 0.6 : 0));
    c.beginPath(); c.roundRect(-5, -44, 10, 48, 4); c.fill(); c.stroke(); c.restore();
  }
  if (kind === 'pogo') {
    // The pogo stick, held out in front, with a spring at the bottom.
    c.strokeStyle = '#3a3a44'; c.lineWidth = 3.5; c.beginPath(); c.moveTo(-20, -2); c.lineTo(-20, -62); c.moveTo(-30, -50); c.lineTo(-10, -50); c.stroke();
    c.strokeStyle = '#c0392b'; c.lineWidth = 2; c.beginPath(); for (let i = 0; i < 4; i++) { c.moveTo(-24, -4 - i * 4); c.lineTo(-16, -6 - i * 4); } c.stroke();
    ellipse(c, -20, 0, 6, 2.5, '#2a2a30');
  }
  c.filter = 'none';
  c.restore();
  if ((o.hp ?? 1) < (o.maxHp ?? 1) || (o.armor ?? 0) < (o.maxArmor ?? 0)) {
    const w = 34 * big, total = (o.hp ?? 0) + (o.armor ?? 0), max = (o.maxHp ?? 1) + (o.maxArmor ?? 0), by = base - lift - 104 * big;
    c.fillStyle = 'rgba(20, 16, 28, 0.7)'; c.fillRect(x - w / 2 - 1, by - 1, w + 2, 6);
    c.fillStyle = '#e04a3a'; c.fillRect(x - w / 2, by, w * Math.max(0, total / max), 4);
  }
}
/** Zombie chewing animates off the wall clock so paused frames still look alive. */
const performanceTime = () => (typeof performance === 'undefined' ? 0 : performance.now() / 90);

// ---------- Effects ----------

/** An effect, drawn at the flat size around (0, 0) on the ground; the caller moves and scales it into place. */
function effect(c: CanvasRenderingContext2D, e: Effect) {
  const p = e.t / e.max, x = 0, y = 0, r = e.r * TW;
  if (e.kind === 'boom') {
    c.globalAlpha = 1 - p;
    ellipse(c, x, y, r * (0.4 + p * 0.7), r * 0.6 * (0.4 + p * 0.7), 'rgba(200, 170, 130, 0.6)');
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; ellipse(c, x + Math.cos(a) * r * p, y + Math.sin(a) * r * p * 0.6, 8 * (1 - p) + 2, 6 * (1 - p) + 2, '#8f8778'); }
    c.globalAlpha = 1;
  } else if (e.kind === 'dust') {
    c.globalAlpha = 0.8 * (1 - p);
    for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; ellipse(c, x + Math.cos(a) * r * p, y - 20 + Math.sin(a) * r * p * 0.5, 16 * (1 - p * 0.3), 11, '#efe3cf'); }
    c.globalAlpha = 1;
  } else if (e.kind === 'splat') {
    c.globalAlpha = 1 - p;
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + e.x; ellipse(c, x + Math.cos(a) * 16 * p, y - 20 + Math.sin(a) * 8 * p, 6, 4, '#8fbf4a'); }
    c.globalAlpha = 1;
  } else if (e.kind === 'hit' || e.kind === 'chill') {
    c.strokeStyle = e.kind === 'chill' ? `rgba(190, 235, 255, ${1 - p})` : `rgba(255, 246, 192, ${1 - p})`; c.lineWidth = 2;
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; c.beginPath(); c.moveTo(x + Math.cos(a) * 3, y - 34 + Math.sin(a) * 3); c.lineTo(x + Math.cos(a) * 9, y - 34 + Math.sin(a) * 9); c.stroke(); }
  } else if (e.kind === 'smash') {
    c.strokeStyle = `rgba(90, 60, 30, ${1 - p})`; c.lineWidth = 3; c.beginPath(); c.ellipse(x, y, r * p, r * p * 0.3, 0, 0, Math.PI * 2); c.stroke();
  } else {
    c.font = 'bold 15px Arial'; c.textAlign = 'center';
    c.lineWidth = 3; c.strokeStyle = `rgba(80, 50, 0, ${1 - p})`; c.strokeText(`+${e.value}`, x, y - 30 - p * 26);
    c.fillStyle = `rgba(255, 220, 90, ${1 - p})`; c.fillText(`+${e.value}`, x, y - 30 - p * 26);
  }
}

/** Runs `draw` with (0, 0) at the lawn point (x, b), scaled for its depth. */
function at(c: CanvasRenderingContext2D, x: number, b: number, draw: (s: number) => void, grow = 1) {
  const p = project(x, b);
  c.save(); c.translate(p.x, p.y); c.scale(p.s * grow, p.s * grow); draw(p.s); c.restore();
}

/** A burlap pouch of sunflower seeds, centred on (0, 0). */
function pouch(c: CanvasRenderingContext2D) {
  const g = c.createRadialGradient(0, 0, 2, 0, 0, 30);
  g.addColorStop(0, 'rgba(255, 217, 106, 0.7)'); g.addColorStop(1, 'rgba(255, 217, 106, 0)');
  c.fillStyle = g; c.fillRect(-30, -30, 60, 60);
  c.fillStyle = '#d8b27a'; c.strokeStyle = '#171226'; c.lineWidth = 2; c.lineJoin = 'round';
  c.beginPath(); c.moveTo(-6, -12); c.lineTo(-8, -19); c.lineTo(-3, -15); c.lineTo(0, -21); c.lineTo(3, -15); c.lineTo(8, -19); c.lineTo(6, -12); c.closePath(); c.fill(); c.stroke();
  c.beginPath(); c.moveTo(-12, -9); c.quadraticCurveTo(-16, 11, 0, 12); c.quadraticCurveTo(16, 11, 12, -9); c.quadraticCurveTo(6, -13, 0, -12); c.quadraticCurveTo(-6, -13, -12, -9); c.closePath(); c.fill(); c.stroke();
  c.strokeStyle = '#8a5a2a'; c.lineWidth = 3; c.lineCap = 'round'; c.beginPath(); c.moveTo(-7, -11); c.lineTo(7, -11); c.stroke();
  ellipse(c, 0, 2, 5.5, 5.5, '#ffc93a'); ellipse(c, 0, 2, 2.2, 2.2, '#6b3a1c');
}

// ---------- The whole scene ----------

export type Ghost = { kind: DefenderId | 'shovel'; row: number; col: number; ok: boolean } | null;

/** The tile's outline on the lawn, as a path. */
function tilePath(c: CanvasRenderingContext2D, row: number, col: number, inset = 0) {
  c.beginPath();
  for (const [i, [x, b]] of ([[col + inset, row + inset], [col + 1 - inset, row + inset], [col + 1 - inset, row + 1 - inset], [col + inset, row + 1 - inset]] as const).entries()) {
    const p = project(x, b); if (i) c.lineTo(p.x, p.y); else c.moveTo(p.x, p.y);
  }
  c.closePath();
}

export function drawLawn(c: CanvasRenderingContext2D, g: Game, time: number, ghost: Ghost) {
  yard(c, g, time);
  if (ghost) {
    tilePath(c, ghost.row, ghost.col);
    c.fillStyle = ghost.ok ? 'rgba(255, 255, 255, 0.22)' : 'rgba(230, 50, 60, 0.3)'; c.fill();
    if (ghost.kind === 'shovel') { tilePath(c, ghost.row, ghost.col, 0.04); c.strokeStyle = ghost.ok ? '#ffffff' : '#ff6070'; c.lineWidth = 3; c.stroke(); }
  }
  // Back to front, lane by lane: carts, defenders, zombies and pellets, so nearer lanes overlap farther ones.
  for (let r = 0; r < ROWS; r++) {
    if (g.lane(r) && g.carts[r] !== 'used') at(c, g.cartX[r], r + CART_B, () => cart(c, -4, -18, time, g.carts[r] === 'rolling'));
    for (const d of g.defenders) if (d.row === r) drawDefender(c, d, time);
    if (ghost && ghost.row === r && ghost.kind !== 'shovel' && ghost.ok) { c.globalAlpha = 0.55; at(c, ghost.col + 0.5, r + FEET_B, () => defender(c, ghost.kind as DefenderId, 0, 0, { time, ghost: true }), 1.1); c.globalAlpha = 1; }
    for (const z of [...g.zombies].filter((q) => q.row === r).sort((a, b) => b.x - a.x)) drawZombie(c, z);
    for (const p of g.pellets) if (p.row === r) at(c, p.x, r + FEET_B, () => {
      const col = p.slow ? '#cdeeff' : '#a6ec6a';
      ellipse(c, 0, 0, 5, 1.8, 'rgba(2, 3, 12, 0.3)');
      ellipse(c, -12, -30, 13, 3, p.slow ? 'rgba(223, 246, 255, 0.4)' : 'rgba(184, 255, 122, 0.4)');
      c.shadowColor = col; c.shadowBlur = 10; ellipse(c, 0, -30, 6, 6, col); c.shadowBlur = 0;
      c.strokeStyle = '#171226'; c.lineWidth = 1.6; c.stroke();
      ellipse(c, -2, -32, 2, 2, 'rgba(255, 255, 255, 0.7)');
    });
  }
  for (const e of g.effects) at(c, e.x, e.y + 0.2, () => effect(c, e));
  // Seed pouches to click, glowing and bobbing; each drops a shadow where it will land.
  for (const s of g.drops) {
    const { x, y, s: k } = seedPx(s), ground = project(s.x, s.toY), bob = Math.sin(time * 3 + s.id) * 3 * k;
    ellipse(c, ground.x, ground.y, 10 * k, 3 * k, 'rgba(2, 3, 12, 0.3)');
    c.globalAlpha = s.life < 3 ? 0.4 + 0.6 * Math.abs(Math.sin(time * 8)) : 1;
    c.save(); c.translate(x, y + bob); c.scale(k * 1.1, k * 1.1); pouch(c); c.restore();
    c.globalAlpha = 1;
  }
  if (ghost?.kind === 'shovel') at(c, ghost.col + 0.5, ghost.row + 0.5, () => {
    c.strokeStyle = '#7a5230'; c.lineWidth = 4; c.lineCap = 'round'; c.beginPath(); c.moveTo(-16, -40); c.lineTo(6, -16); c.stroke();
    c.fillStyle = '#b8bcc6'; c.beginPath(); c.moveTo(2, -20); c.lineTo(18, -14); c.lineTo(12, -2); c.closePath(); c.fill();
  });
  atmosphere(c, time);
  if (g.messageTime > 0 && g.state === 'playing') {
    c.font = '900 34px ui-sans-serif, system-ui, sans-serif'; c.textAlign = 'center';
    c.lineWidth = 6; c.strokeStyle = 'rgba(20, 10, 30, 0.85)'; c.strokeText(g.message, VIEW_W / 2, 320);
    c.fillStyle = '#ffdc5a'; c.fillText(g.message, VIEW_W / 2, 320);
  }
}

function drawDefender(c: CanvasRenderingContext2D, d: Defender, time: number) {
  at(c, d.col + 0.5, d.row + FEET_B, () => {
    defender(c, d.kind, 0, 0, { time: time + d.id, flash: d.flash, bite: d.bite, armed: d.armed, hp: d.hp, maxHp: d.maxHp });
    if (d.hp < d.maxHp && DEFENDERS[d.kind].kind !== 'bomb') {
      const w = 40, x = -w / 2, y = d.kind === 'pebble' ? -76 : -62;
      c.fillStyle = 'rgba(20, 16, 28, 0.6)'; c.fillRect(x - 1, y - 1, w + 2, 5);
      c.fillStyle = '#6fd06f'; c.fillRect(x, y, w * Math.max(0, d.hp / d.maxHp), 3);
    }
  }, 1.1);
}
function drawZombie(c: CanvasRenderingContext2D, z: Zombie) {
  at(c, z.x, z.row + ZOMBIE_B, () => zombie(c, z.kind, 0, 0, { step: z.step, eating: z.eating !== null, armor: z.armor, maxArmor: z.maxArmor, chilled: z.slowT > 0, hit: z.hit, jump: z.jump, hp: z.hp, maxHp: z.maxHp }));
}

// ---------- Icons ----------

export function drawDefenderIcon(c: CanvasRenderingContext2D, kind: DefenderId, w: number, h: number, time = 0) {
  c.clearRect(0, 0, w, h);
  const k = Math.min(w / 70, h / 80);
  c.save(); c.translate(w / 2, h - 6); c.scale(k, k);
  defender(c, kind, 0, 0, { time, armed: 0, ghost: true });
  c.restore();
}
export function drawShovelIcon(c: CanvasRenderingContext2D, w: number, h: number) {
  c.clearRect(0, 0, w, h);
  const x = w / 2, y = h / 2;
  c.strokeStyle = '#7a5230'; c.lineWidth = 4; c.lineCap = 'round'; c.beginPath(); c.moveTo(x - 12, y - 14); c.lineTo(x + 3, y + 2); c.stroke();
  c.strokeStyle = '#5a3a1c'; c.lineWidth = 3; c.beginPath(); c.moveTo(x - 16, y - 12); c.lineTo(x - 9, y - 18); c.stroke();
  c.fillStyle = '#b8bcc6'; c.strokeStyle = '#6e737c'; c.lineWidth = 1;
  c.beginPath(); c.moveTo(x, y - 1); c.lineTo(x + 12, y + 4); c.lineTo(x + 9, y + 15); c.lineTo(x - 2, y + 10); c.closePath(); c.fill(); c.stroke();
}
export function drawZombieIcon(c: CanvasRenderingContext2D, kind: ZombieId, w: number, h: number) {
  c.clearRect(0, 0, w, h);
  const k = Math.min(w / 70, h / 120) * (kind === 'brute' ? 0.7 : 1);
  c.save(); c.translate(w / 2 + 6, h - 4); c.scale(k, k);
  zombie(c, kind, 0, 0, { step: 1, armor: ZOMBIES[kind].armor, maxArmor: ZOMBIES[kind].armor });
  c.restore();
}
