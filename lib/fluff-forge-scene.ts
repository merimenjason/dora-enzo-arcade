// Canvas 2D drawing for Fluff Forge: the four themes, every part, the chinchillas and the HUD.
// Everything is drawn in course pixels (TILE = 16); the page scales the canvas up.
import { TILE, ROWS, VIEW_W, VIEW_H, index, HEROES, type Course, type ThemeId, type HeroId, type Power, type Enemy, type Fx, type FluffForgeGame } from './fluff-forge-game';

type Palette = { sky: [string, string]; far: string; near: string; top: string; dirt: string; dirtDark: string; stone: string; stoneDark: string; ink: string; hud: string };
export const PALETTES: Record<ThemeId, Palette> = {
  meadow: { sky: ['#8fcdf0', '#e9f5df'], far: '#9db3c9', near: '#86b27a', top: '#72b653', dirt: '#b47a4b', dirtDark: '#8d5a35', stone: '#a39c92', stoneDark: '#7b746c', ink: '#3a2e2a', hud: '#2c2320' },
  salt: { sky: ['#f5b99a', '#c5e6f6'], far: '#c49aa8', near: '#e3d3c4', top: '#f7f4ec', dirt: '#d9ccb8', dirtDark: '#b7a78f', stone: '#b3a2a0', stoneDark: '#8c7b7a', ink: '#3b2d33', hud: '#3b2d33' },
  cave: { sky: ['#140f22', '#2d2345'], far: '#241c38', near: '#2f2548', top: '#6a8f62', dirt: '#5a4a6e', dirtDark: '#3e3250', stone: '#6c6384', stoneDark: '#4a4262', ink: '#0f0b18', hud: '#f3ecff' },
  snow: { sky: ['#a9c9ec', '#eef4fb'], far: '#c2d2e6', near: '#dbe6f2', top: '#fbfdff', dirt: '#8d9db3', dirtDark: '#6d7c92', stone: '#9aa6b6', stoneDark: '#737f90', ink: '#28303e', hud: '#28303e' },
};

type Coat = {
  fur: string; back: string; face: string; shade: string; belly: string; line: string; texture: string;
  ear: string; earIn: string; earLine: string; vein: string; foot: string; toe: string;
  eye: string; pupil: string; nose: string; whisker: string; whiskerLight: string; blush: string;
  tail: string; tailTip: string; tailLine: string; brush: boolean;
};
// Drawn from public/art/dora.jpeg, enzo.jpeg and the-original-duo.jpg.
// Dora: white, peach-pink ears you can almost see through, ruby eyes, pink toes, a smooth tail that sweeps out and curls up.
// Enzo: standard grey with a darker wavy back, a paler face, a white chest and a big dark bottlebrush tail.
const COATS: Record<HeroId, Coat> = {
  dora: {
    fur: '#fbf8f3', back: '#f0eae0', face: '#fefcf9', shade: '#e2d8cb', belly: '#ffffff', line: '#6e5d57', texture: '#e5dccf',
    ear: '#f7cfbd', earIn: '#efab98', earLine: '#b88375', vein: '#e0907f', foot: '#f4c6bd', toe: '#c98a82',
    eye: '#8e1f33', pupil: '#3b0913', nose: '#eb9ea2', whisker: '#cfc5b9', whiskerLight: '#ffffff', blush: 'rgba(240, 150, 150, 0.3)',
    tail: '#f8f4ec', tailTip: '#e4dacb', tailLine: '#6e5d57', brush: false,
  },
  enzo: {
    fur: '#75737d', back: '#4c4a54', face: '#8f8d98', shade: '#5c5a64', belly: '#e8e4e6', line: '#232128', texture: '#4f4d57',
    ear: '#77727e', earIn: '#a8929a', earLine: '#35323b', vein: '#8b7580', foot: '#bca8aa', toe: '#7e6d71',
    eye: '#0e0c12', pupil: '#000000', nose: '#a48f96', whisker: '#1d1b21', whiskerLight: '#dddbe2', blush: 'rgba(200, 140, 150, 0.18)',
    tail: '#35333b', tailTip: '#77757f', tailLine: '#1b1a1f', brush: true,
  },
};

const ellipse = (c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, rot = 0) => { c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2); };
const rect = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string) => { c.fillStyle = fill; c.fillRect(x, y, w, h); };
const dot = (c: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string) => { c.fillStyle = fill; ellipse(c, x, y, r, r); c.fill(); };
const line = (c: CanvasRenderingContext2D, pts: number[], stroke: string, width: number) => {
  c.strokeStyle = stroke; c.lineWidth = width; c.beginPath(); c.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
  c.stroke();
};
/** A cheap per-cell hash so textures don't shimmer as the camera moves. */
const hash = (a: number, b: number) => { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
/** A four-pointed twinkle. */
function star(c: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string, rot = 0) {
  c.save(); c.translate(x, y); c.rotate(rot); c.fillStyle = fill; c.beginPath();
  for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4, d = i % 2 ? r * 0.3 : r; c.lineTo(Math.cos(a) * d, Math.sin(a) * d); }
  c.fill(); c.restore();
}

// ---------- Backdrop ----------

export function drawBackdrop(c: CanvasRenderingContext2D, theme: ThemeId, cam: number, time: number) {
  const p = PALETTES[theme];
  const sky = c.createLinearGradient(0, 0, 0, VIEW_H);
  sky.addColorStop(0, p.sky[0]); sky.addColorStop(1, p.sky[1]);
  c.fillStyle = sky; c.fillRect(0, 0, VIEW_W, VIEW_H);
  if (theme === 'cave') { caveBackdrop(c, cam, time); depth(c); return; }
  // Sun with a soft glow.
  const sun = theme === 'snow' ? { x: 90, y: 40, r: 13, glow: 'rgba(255,255,255,', disc: '#fdfdf6' } : { x: 320, y: 44, r: 16, glow: theme === 'salt' ? 'rgba(255,236,200,' : 'rgba(255,248,210,', disc: theme === 'salt' ? '#fff3d6' : '#fff8d8' };
  const sx = sun.x - cam * 0.02;
  const glow = c.createRadialGradient(sx, sun.y, sun.r * 0.5, sx, sun.y, sun.r * 3.2);
  glow.addColorStop(0, sun.glow + '0.7)'); glow.addColorStop(1, sun.glow + '0)');
  c.fillStyle = glow; c.fillRect(sx - sun.r * 3.2, sun.y - sun.r * 3.2, sun.r * 6.4, sun.r * 6.4);
  dot(c, sx, sun.y, sun.r, sun.disc);
  for (let i = 0; i < 7; i++) {
    const x = ((i * 170 - cam * 0.12 + time * 4) % 1190 + 1190) % 1190 - 120, y = 22 + (i % 3) * 20 + hash(i, 4) * 8;
    cloud(c, x, y, 0.7 + hash(i, 9) * 0.5, theme);
  }
  mountains(c, cam * 0.18, 130, 95, p.far, 1, theme !== 'salt');
  if (theme === 'meadow') {
    hills(c, cam * 0.32, 182, 20, '#a9cf8e', 2, { dark: '#8fbe77', light: '#c2e2a8', every: 34, chance: 0.5, size: 0.6 });
    hills(c, cam * 0.55, 204, 14, '#8cc070', 7, { dark: '#5f9a4e', light: '#a4d584', every: 52, chance: 0.45, size: 1, flowers: true });
  } else if (theme === 'salt') {
    mesas(c, cam * 0.3, 190);
    saltFlat(c, cam, time);
  } else {
    mountains(c, cam * 0.3, 168, 50, '#cfdced', 5, true);
    pines(c, cam * 0.4, 192, '#aabfd8', 4, 0.75);
    rect(c, 0, 192, VIEW_W, VIEW_H - 192, '#dfe9f4');
    pines(c, cam * 0.6, 212, '#8ca4c2', 8, 1.05);
    rect(c, 0, 212, VIEW_W, VIEW_H - 212, '#eef4fb');
    snowfall(c, cam, time);
  }
  depth(c);
}

/** Darken the bottom of the backdrop so a pit reads as a drop, not a floor. */
function depth(c: CanvasRenderingContext2D) {
  const g = c.createLinearGradient(0, 200, 0, VIEW_H);
  g.addColorStop(0, 'rgba(20, 10, 30, 0)'); g.addColorStop(1, 'rgba(20, 10, 30, 0.45)');
  c.fillStyle = g; c.fillRect(0, 200, VIEW_W, VIEW_H - 200);
}

function cloud(c: CanvasRenderingContext2D, x: number, y: number, s: number, theme: ThemeId) {
  const top = theme === 'salt' ? '#fff5ee' : '#ffffff', under = theme === 'salt' ? '#f3d9cf' : theme === 'snow' ? '#d9e6f4' : '#dcebf5';
  c.globalAlpha = 0.9;
  c.fillStyle = under; ellipse(c, x, y + 3 * s, 24 * s, 6 * s); c.fill();
  c.fillStyle = top;
  ellipse(c, x - 12 * s, y, 10 * s, 6 * s); c.fill();
  ellipse(c, x, y - 4 * s, 13 * s, 9 * s); c.fill();
  ellipse(c, x + 13 * s, y - 1 * s, 10 * s, 7 * s); c.fill();
  ellipse(c, x + 2 * s, y + 1 * s, 20 * s, 5 * s); c.fill();
  c.globalAlpha = 1;
}

function mountains(c: CanvasRenderingContext2D, off: number, base: number, height: number, color: string, seed: number, caps = false) {
  const span = 90;
  const first = Math.floor(off / span) - 1, last = first + VIEW_W / span + 2;
  const peak = (i: number) => height * (0.55 + hash(i, seed) * 0.45);
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(0, VIEW_H);
  for (let i = first; i <= last; i++) { const x = i * span - off; c.lineTo(x, base - peak(i)); c.lineTo(x + span / 2, base - peak(i) * 0.35); }
  c.lineTo(VIEW_W, VIEW_H);
  c.fill();
  // Shadowed right-hand faces.
  c.fillStyle = 'rgba(40, 30, 70, 0.1)';
  for (let i = first; i <= last; i++) {
    const x = i * span - off;
    c.beginPath(); c.moveTo(x, base - peak(i)); c.lineTo(x + span / 2, base - peak(i) * 0.35); c.lineTo(x + span * 0.2, base); c.fill();
  }
  if (!caps) return;
  c.fillStyle = '#ffffff';
  for (let i = first; i <= last; i++) {
    const x = i * span - off, h = peak(i);
    c.beginPath(); c.moveTo(x, base - h); c.lineTo(x + 11, base - h + 12); c.lineTo(x + 5, base - h + 9); c.lineTo(x + 1, base - h + 14); c.lineTo(x - 4, base - h + 10); c.lineTo(x - 9, base - h + 12); c.fill();
  }
}

type Trees = { dark: string; light: string; every: number; chance: number; size: number; flowers?: boolean };
const hillY = (sx: number, off: number, base: number, amp: number, seed: number) => {
  const u = sx + off;
  return base - amp * (0.6 + 0.4 * Math.sin(u * 0.011 + seed) + 0.25 * Math.sin(u * 0.027 + seed * 2));
};
function hills(c: CanvasRenderingContext2D, off: number, base: number, amp: number, color: string, seed: number, t: Trees) {
  c.fillStyle = color;
  c.beginPath(); c.moveTo(0, VIEW_H);
  for (let x = 0; x <= VIEW_W + 8; x += 8) c.lineTo(x, hillY(x, off, base, amp, seed));
  c.lineTo(VIEW_W, VIEW_H); c.fill();
  const first = Math.floor(off / t.every) - 1;
  for (let i = first; i <= first + VIEW_W / t.every + 2; i++) {
    const sx = i * t.every + hash(i, seed) * t.every * 0.5 - off;
    const gy = hillY(sx, off, base, amp, seed) + 2;
    if (hash(i, seed + 1) < t.chance) {
      const s = t.size * (0.75 + hash(i, seed + 2) * 0.5);
      rect(c, sx - 1 * s, gy - 9 * s, 2 * s, 9 * s, '#7a5a3c');
      c.fillStyle = t.dark;
      ellipse(c, sx, gy - 13 * s, 6.5 * s, 6 * s); c.fill();
      ellipse(c, sx - 4 * s, gy - 10 * s, 4.5 * s, 4 * s); c.fill();
      ellipse(c, sx + 4 * s, gy - 10.5 * s, 4.5 * s, 4 * s); c.fill();
      c.fillStyle = t.light; ellipse(c, sx - 2 * s, gy - 15 * s, 3 * s, 2.4 * s); c.fill();
    } else if (t.flowers) {
      for (let j = 0; j < 4; j++) dot(c, sx + j * 5 - 8, gy + 3 + hash(i, j) * 4, 0.9, ['#ffffff', '#ffd34d', '#f59ab8', '#c8a6ff'][j]);
    }
  }
}

function mesas(c: CanvasRenderingContext2D, off: number, base: number) {
  const span = 130, first = Math.floor(off / span) - 1;
  for (let i = first; i <= first + VIEW_W / span + 2; i++) {
    const x = i * span - off + hash(i, 11) * 40, w = 50 + hash(i, 12) * 60, h = 26 + hash(i, 13) * 40;
    c.fillStyle = '#d9aeb0';
    c.beginPath(); c.moveTo(x, base); c.lineTo(x + 9, base - h); c.lineTo(x + w - 7, base - h); c.lineTo(x + w, base); c.fill();
    c.fillStyle = 'rgba(150, 90, 110, 0.18)';
    for (let k = 1; k < 4; k++) c.fillRect(x + 9 - k, base - h + k * (h / 4), w - 16 + k * 2, 1.5);
    c.beginPath(); c.moveTo(x + w - 7, base - h); c.lineTo(x + w, base); c.lineTo(x + w - 14, base); c.fill();
  }
}

function saltFlat(c: CanvasRenderingContext2D, cam: number, time: number) {
  rect(c, 0, 190, VIEW_W, VIEW_H - 190, '#ece4d6');
  // The flat mirrors the sky in a thin shimmering band.
  const shine = c.createLinearGradient(0, 190, 0, 204);
  shine.addColorStop(0, 'rgba(197, 230, 246, 0.8)'); shine.addColorStop(1, 'rgba(197, 230, 246, 0)');
  c.fillStyle = shine; c.fillRect(0, 190, VIEW_W, 14);
  c.globalAlpha = 0.5;
  for (let i = 0; i < 6; i++) rect(c, ((i * 83 + time * 6 - cam * 0.7) % 480 + 480) % 480 - 40, 193 + (i % 3) * 3, 26, 0.8, '#ffffff');
  c.globalAlpha = 1;
  // Salt-crust hexagons, flattened by perspective.
  c.strokeStyle = 'rgba(180, 160, 140, 0.45)'; c.lineWidth = 0.6;
  for (let row = 0; row < 3; row++) {
    const y = 206 + row * 10, w = 22 + row * 8, off = (cam * (0.75 + row * 0.08)) % w;
    c.beginPath();
    for (let x = -off - w + (row % 2) * (w / 2); x < VIEW_W + w; x += w) {
      c.moveTo(x, y); c.lineTo(x + w * 0.25, y - 3); c.lineTo(x + w * 0.75, y - 3); c.lineTo(x + w, y); c.lineTo(x + w * 0.75, y + 3); c.lineTo(x + w * 0.25, y + 3); c.closePath();
    }
    c.stroke();
  }
}

function pines(c: CanvasRenderingContext2D, off: number, base: number, color: string, seed: number, scale: number) {
  const span = 18 * scale, first = Math.floor(off / span) - 1;
  for (let i = first; i <= first + VIEW_W / span + 2; i++) {
    if (hash(i, seed) < 0.3) continue;
    const s = scale * (0.7 + hash(i, seed + 1) * 0.6), x = i * span - off + hash(i, seed + 2) * 8;
    rect(c, x - 1 * s, base - 5 * s, 2 * s, 5 * s, '#6d6070');
    for (let k = 0; k < 3; k++) {
      const top = base - (12 + k * 7) * s, w = (9 - k * 2) * s;
      c.fillStyle = color;
      c.beginPath(); c.moveTo(x, top - 4 * s); c.lineTo(x + w, top + 8 * s); c.lineTo(x - w, top + 8 * s); c.fill();
      c.fillStyle = '#ffffff';
      c.beginPath(); c.moveTo(x, top - 4 * s); c.lineTo(x + w * 0.55, top + 3 * s); c.lineTo(x + w * 0.1, top + 2 * s); c.lineTo(x - w * 0.5, top + 3.5 * s); c.fill();
    }
  }
}

function snowfall(c: CanvasRenderingContext2D, cam: number, time: number) {
  c.fillStyle = '#ffffff';
  for (let i = 0; i < 60; i++) {
    const near = i % 4 === 0, par = near ? 0.9 : 0.5, size = near ? 2.2 : 1.3;
    const x = ((hash(i, 1) * 460 + Math.sin(time * (near ? 1.4 : 1) + i) * 10 - cam * par) % 460 + 460) % 460 - 30;
    const y = ((hash(i, 2) * 260 + time * ((near ? 26 : 14) + hash(i, 5) * 16)) % 260) - 10;
    c.globalAlpha = near ? 0.95 : 0.75;
    ellipse(c, x, y, size / 2, size / 2); c.fill();
  }
  c.globalAlpha = 1;
}

function caveBackdrop(c: CanvasRenderingContext2D, cam: number, time: number) {
  mountains(c, cam * 0.2, 160, 80, '#221a36', 3);
  // Hanging stalactites in two layers.
  for (const [par, color, len, seed] of [[0.3, '#3a2f5a', 30, 21], [0.55, '#2c2346', 46, 22]] as const) {
    const span = 26, off = cam * par, first = Math.floor(off / span) - 1;
    c.fillStyle = color;
    for (let i = first; i <= first + VIEW_W / span + 2; i++) {
      const x = i * span - off, l = len * (0.35 + hash(i, seed) * 0.65), w = 5 + hash(i, seed + 1) * 6;
      c.beginPath(); c.moveTo(x - w, 0); c.lineTo(x + w, 0); c.lineTo(x + 1, l); c.lineTo(x - 1, l * 0.9); c.fill();
    }
  }
  // Glowing crystal clusters on the mid-ground.
  const span = 90, off = cam * 0.45, first = Math.floor(off / span) - 1;
  for (let i = first; i <= first + VIEW_W / span + 2; i++) {
    if (hash(i, 31) < 0.35) continue;
    const x = i * span - off + hash(i, 32) * 40, base = 196, tint = hash(i, 33) < 0.5 ? ['#6fe0d0', 'rgba(111,224,208,'] : ['#b19cff', 'rgba(177,156,255,'];
    const pulse = 0.25 + 0.12 * Math.sin(time * 1.5 + i);
    const g = c.createRadialGradient(x, base - 8, 1, x, base - 8, 26);
    g.addColorStop(0, tint[1] + pulse + ')'); g.addColorStop(1, tint[1] + '0)');
    c.fillStyle = g; c.fillRect(x - 26, base - 34, 52, 52);
    for (const [dx, h, lean] of [[-5, 10, -0.3], [0, 17, 0.05], [5, 12, 0.35]]) {
      c.save(); c.translate(x + dx, base); c.rotate(lean);
      c.fillStyle = tint[0]; c.beginPath(); c.moveTo(-2.5, 0); c.lineTo(-2.5, -h + 3); c.lineTo(0, -h); c.lineTo(2.5, -h + 3); c.lineTo(2.5, 0); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.45)'; c.fillRect(-1.5, -h + 3, 1, h - 4);
      c.restore();
    }
  }
  mountains(c, cam * 0.6, 214, 28, '#2f2548', 9);
  // Drifting spores.
  for (let i = 0; i < 40; i++) {
    const x = ((hash(i, 3) * 1600 - cam * 0.2 + Math.sin(time * 0.5 + i) * 8) % 1600 + 1600) % 1600 - 100;
    const y = hash(i, 7) * VIEW_H + Math.sin(time * 0.8 + i * 2) * 4;
    c.globalAlpha = 0.35 + 0.35 * Math.sin(time * 2 + i);
    dot(c, x, y, 0.9, i % 3 ? '#9d8cff' : '#6fe0d0');
  }
  c.globalAlpha = 1;
}

// ---------- Tiles ----------

type TileAt = (c: number, r: number) => string;
const FILLED = new Set(['#', 'I', 'H']);

/** One tile. `at` looks up neighbours so ground knows where its top and edges are. */
export function drawTile(c: CanvasRenderingContext2D, ch: string, col: number, row: number, theme: ThemeId, time: number, at: TileAt, opts: { editor?: boolean; bump?: number; spring?: number } = {}) {
  const p = PALETTES[theme];
  const x = col * TILE, y = row * TILE - (opts.bump ? Math.sin((opts.bump / 0.15) * Math.PI) * 4 : 0);
  const n = hash(col, row);
  switch (ch) {
    case '#': {
      const open = !FILLED.has(at(col, row - 1));
      const leftOpen = !FILLED.has(at(col - 1, row)), rightOpen = !FILLED.has(at(col + 1, row));
      rect(c, x, y, TILE, TILE, p.dirt);
      // Strata, pebbles and the odd root.
      c.fillStyle = 'rgba(0,0,0,0.07)'; c.fillRect(x, y + 10 + n * 3, TILE, 2);
      for (let k = 0; k < 3; k++) {
        const px = x + 2 + hash(col, row * 7 + k) * 12, py = y + 3 + hash(col * 3 + k, row) * 11;
        dot(c, px, py, 1 + hash(k, col) * 0.8, p.dirtDark);
        dot(c, px - 0.4, py - 0.5, 0.45, 'rgba(255,255,255,0.3)');
      }
      if (theme === 'meadow' && n > 0.8 && !open) line(c, [x + 4, y + 4, x + 7, y + 7, x + 6, y + 11], '#7a4d2c', 0.7);
      if (leftOpen) { rect(c, x, y, 1.5, TILE, p.dirtDark); }
      if (rightOpen) { rect(c, x + TILE - 1.5, y, 1.5, TILE, p.dirtDark); }
      if (open) groundTop(c, x, y, col, theme, time, leftOpen, rightOpen);
      break;
    }
    case 'I': {
      const open = !FILLED.has(at(col, row - 1));
      rect(c, x, y, TILE, TILE, '#8fcfe8');
      rect(c, x + 1, y + 1, TILE - 2, TILE - 2, '#b5e4f4');
      c.fillStyle = 'rgba(255,255,255,0.55)';
      c.beginPath(); c.moveTo(x + 3 + n * 3, y + TILE - 1); c.lineTo(x + 9 + n * 3, y + 1); c.lineTo(x + 11 + n * 3, y + 1); c.lineTo(x + 5 + n * 3, y + TILE - 1); c.fill();
      line(c, [x + 2, y + 6 + n * 4, x + 6, y + 8 + n * 4, x + 8, y + 7 + n * 4], 'rgba(90,160,200,0.6)', 0.6);
      rect(c, x, y + TILE - 1.5, TILE, 1.5, '#6fb2cf');
      if (open) {
        rect(c, x, y, TILE, 2.5, '#f2fcff');
        star(c, x + 4 + n * 8, y + 4, 1.8 + Math.sin(time * 3 + col) * 0.6, '#ffffff');
      }
      break;
    }
    case 'H': {
      rect(c, x, y, TILE, TILE, p.stoneDark);
      rect(c, x + 0.5, y + 0.5, TILE - 2, TILE - 2, p.stone);
      rect(c, x + 0.5, y + 0.5, TILE - 2, 1.5, 'rgba(255,255,255,.3)'); rect(c, x + 0.5, y + 0.5, 1.5, TILE - 2, 'rgba(255,255,255,.2)');
      rect(c, x + 2, y + TILE - 3, TILE - 3, 1.5, 'rgba(0,0,0,.12)');
      line(c, [x + 4 + n * 6, y + 3, x + 6 + n * 6, y + 7, x + 5 + n * 6, y + 10], p.stoneDark, 0.7);
      if (n > 0.5) line(c, [x + 10, y + 10, x + 13, y + 12], p.stoneDark, 0.6);
      const top = !FILLED.has(at(col, row - 1));
      if (theme === 'snow' && top) { c.fillStyle = '#fbfdff'; c.beginPath(); c.roundRect(x - 0.5, y - 1, TILE + 1, 4, 2); c.fill(); }
      if (theme === 'meadow' && top) for (let k = 0; k < 3; k++) dot(c, x + 3 + k * 4 + n * 2, y + 1.5, 1.4, '#6fa650');
      if (theme === 'cave' && n > 0.75) star(c, x + 11, y + 5, 1.5 + Math.sin(time * 2 + col) * 0.5, '#9d8cff');
      break;
    }
    case 'B': {
      rect(c, x, y, TILE, TILE, '#7e4527');
      const brick = (bx: number, by: number, bw: number) => {
        rect(c, bx, by, bw, 6.5, '#c97b4d');
        rect(c, bx, by, bw, 1.2, '#e8a57a');
        rect(c, bx, by + 5.3, bw, 1.2, '#a55e37');
      };
      brick(x + 0.5, y + 0.5, 7); brick(x + 8.5, y + 0.5, 7);
      brick(x + 0.5, y + 8.5, 3); brick(x + 4.5, y + 8.5, 7); brick(x + 12.5, y + 8.5, 3);
      break;
    }
    case '?': case 'C': case 'F': {
      const glint = ((time * 0.45 + col * 0.13) % 1) * 3;
      rect(c, x, y, TILE, TILE, '#8a5516');
      rect(c, x + 1, y + 1, TILE - 2, TILE - 2, '#f2c14e');
      rect(c, x + 1, y + 1, TILE - 2, 2, '#ffe08f'); rect(c, x + 1, y + 1, 2, TILE - 2, '#ffd774');
      rect(c, x + 1, y + TILE - 3, TILE - 2, 2, '#c98a26'); rect(c, x + TILE - 3, y + 1, 2, TILE - 2, '#d69a33');
      if (glint < 1) {
        c.save(); c.beginPath(); c.rect(x + 1, y + 1, TILE - 2, TILE - 2); c.clip();
        c.fillStyle = 'rgba(255,255,255,0.55)';
        const gx = x - 8 + glint * 32;
        c.beginPath(); c.moveTo(gx, y + TILE); c.lineTo(gx + 6, y); c.lineTo(gx + 9, y); c.lineTo(gx + 3, y + TILE); c.fill();
        c.restore();
      }
      c.font = 'bold 11px ui-monospace, monospace'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = '#b06f1c'; c.fillText('?', x + 8.8, y + 9.8);
      c.fillStyle = '#7a3e14'; c.fillText('?', x + 8, y + 9);
      [[2.5, 2.5], [13.5, 2.5], [2.5, 13.5], [13.5, 13.5]].forEach(([dx, dy]) => { dot(c, x + dx, y + dy, 0.8, '#7a3e14'); dot(c, x + dx - 0.3, y + dy - 0.3, 0.3, '#ffe9b0'); });
      if (opts.editor && ch !== '?') {
        c.save(); c.translate(x + 12, y + 3); c.scale(0.45, 0.45);
        (ch === 'C' ? clover : feather)(c, 0, 0);
        c.restore();
      }
      break;
    }
    case 'U': {
      rect(c, x, y, TILE, TILE, '#5a3c24'); rect(c, x + 1, y + 1, TILE - 2, TILE - 2, '#a37a54');
      rect(c, x + 1, y + 1, TILE - 2, 1.5, '#b88e66'); rect(c, x + 1, y + TILE - 2.5, TILE - 2, 1.5, '#86603f');
      [[2.5, 2.5], [13.5, 2.5], [2.5, 13.5], [13.5, 13.5]].forEach(([dx, dy]) => dot(c, x + dx, y + dy, 0.8, '#5a3c24'));
      break;
    }
    case '=': cloudLedge(c, x, y, TILE, theme === 'cave'); break;
    case '^': {
      // A patch of little cacti.
      c.fillStyle = '#8a6a44'; ellipse(c, x + 8, y + 15, 8.5, 2.5); c.fill();
      for (const [dx, h, w] of [[3, 10, 2.4], [8.5, 13, 3], [13.5, 9, 2.3]]) {
        const cx = x + dx, top = y + 15 - h;
        c.fillStyle = '#4f8a3c'; c.beginPath(); c.roundRect(cx - w, top, w * 2, h, w); c.fill();
        c.fillStyle = '#6fb257'; c.fillRect(cx - w * 0.5, top + 1.5, w * 0.4, h - 3);
        c.fillStyle = '#3c6e2e'; c.fillRect(cx + w * 0.35, top + 1.5, 0.6, h - 3);
        c.strokeStyle = '#fdfbe9'; c.lineWidth = 0.6; c.beginPath();
        for (let k = 0; k < h / 3; k++) {
          const sy = top + 2 + k * 3;
          c.moveTo(cx - w, sy); c.lineTo(cx - w - 1.6, sy - 0.8); c.moveTo(cx + w, sy + 1); c.lineTo(cx + w + 1.6, sy + 0.2);
        }
        c.moveTo(cx, top); c.lineTo(cx, top - 1.8);
        c.stroke();
      }
      break;
    }
    case 'o': {
      const bob = Math.sin(time * 3 + col * 0.7) * 1.2;
      c.fillStyle = 'rgba(255, 230, 160, 0.25)'; ellipse(c, x + 8, y + 8 + bob, 7, 7); c.fill();
      raisin(c, x + 8, y + 8 + bob);
      break;
    }
    case 'S': {
      const squash = opts.spring ? 4 : 0;
      rect(c, x + 1.5, y + 12.5, 13, 3.5, '#4a4f5c'); rect(c, x + 1.5, y + 12.5, 13, 1, '#7d8392');
      dot(c, x + 3.5, y + 14.5, 0.6, '#c9ccd4'); dot(c, x + 12.5, y + 14.5, 0.6, '#c9ccd4');
      const coils = 3, top = y + 6 + squash, bottom = y + 12.5, step = (bottom - top) / coils;
      for (let k = 0; k < coils; k++) {
        const cy = bottom - step * (k + 0.5);
        c.strokeStyle = '#a8321f'; c.lineWidth = 1.8; ellipse(c, x + 8, cy + 0.4, 4.5, Math.max(0.8, step * 0.45)); c.stroke();
        c.strokeStyle = '#f07a5a'; c.lineWidth = 0.8; c.beginPath(); c.ellipse(x + 8, cy, 4.5, Math.max(0.8, step * 0.45), 0, Math.PI * 1.05, Math.PI * 1.95); c.stroke();
      }
      c.fillStyle = '#e8e2d6'; c.beginPath(); c.roundRect(x + 1, y + 2.5 + squash, 14, 4, 1.5); c.fill();
      rect(c, x + 2, y + 2.8 + squash, 12, 1, '#ffffff'); rect(c, x + 1.5, y + 5.5 + squash, 13, 1, '#9b958a');
      break;
    }
    default: if (opts.editor) drawMarker(c, ch, x, y, time, theme);
  }
}

/** The surface on top of open ground: grass, salt crust, moss or snow. */
function groundTop(c: CanvasRenderingContext2D, x: number, y: number, col: number, theme: ThemeId, time: number, leftOpen: boolean, rightOpen: boolean) {
  const p = PALETTES[theme], n = hash(col, 99);
  if (theme === 'snow') {
    c.fillStyle = '#fbfdff';
    c.beginPath(); c.roundRect(x - (leftOpen ? 1 : 0), y - 1.5, TILE + (leftOpen ? 1 : 0) + (rightOpen ? 1 : 0), 6, leftOpen || rightOpen ? 3 : 0); c.fill();
    ellipse(c, x + 4 + n * 7, y + 5, 2.5, 2); c.fill();
    rect(c, x, y + 4.5, TILE, 0.8, '#d4e2f0');
    if (leftOpen) { c.beginPath(); c.moveTo(x - 1, y + 3); c.lineTo(x + 1, y + 3); c.lineTo(x, y + 8); c.fill(); }
    if (rightOpen) { c.beginPath(); c.moveTo(x + TILE - 1, y + 3); c.lineTo(x + TILE + 1, y + 3); c.lineTo(x + TILE, y + 7); c.fill(); }
    if (n > 0.7) star(c, x + 10, y + 1, 1.2 + Math.sin(time * 4 + col) * 0.5, '#ffffff');
    return;
  }
  if (theme === 'salt') {
    rect(c, x, y, TILE, 4, p.top);
    rect(c, x, y + 4, TILE, 1, '#e7c9c1');
    for (let k = 0; k < 3; k++) { const cx = x + 2 + k * 5 + hash(col, k) * 2; c.fillStyle = '#ffffff'; c.fillRect(cx, y - 1.5, 2, 2); c.fillStyle = '#e4dcd0'; c.fillRect(cx + 1, y - 0.5, 1, 1); }
    return;
  }
  // Meadow grass and cave moss share a scalloped edge and blades.
  const top = p.top, under = theme === 'cave' ? '#4d6e48' : '#5a9a42';
  rect(c, x, y, TILE, 4, top);
  c.fillStyle = under;
  for (let k = 0; k < 4; k++) { ellipse(c, x + 2 + k * 4, y + 4, 2.2, 1.6); c.fill(); }
  c.fillStyle = top;
  for (let k = 0; k < 4; k++) { ellipse(c, x + 2 + k * 4, y + 3.2, 2.2, 1.4); c.fill(); }
  const sway = Math.sin(time * 2 + col * 0.8) * 0.6;
  c.fillStyle = theme === 'cave' ? '#86b07c' : '#86c965';
  for (let k = 0; k < 4; k++) {
    const bx = x + 1.5 + k * 4 + hash(col, k + 5) * 2, h = 2 + hash(col, k + 9) * 2.5;
    c.beginPath(); c.moveTo(bx, y + 0.5); c.lineTo(bx + 0.6 + sway, y - h); c.lineTo(bx + 1.4, y + 0.5); c.fill();
  }
  rect(c, x, y, TILE, 0.8, 'rgba(255,255,255,0.25)');
  if (theme === 'meadow' && n > 0.72) {
    const fx = x + 4 + hash(col, 3) * 8, color = ['#ffffff', '#ffd34d', '#f59ab8'][Math.floor(hash(col, 4) * 3)];
    line(c, [fx, y, fx, y - 3.5], '#4f8f38', 0.6);
    for (let k = 0; k < 4; k++) dot(c, fx + Math.cos(k * 1.57) * 1, y - 4 + Math.sin(k * 1.57) * 1, 0.8, color);
    dot(c, fx, y - 4, 0.5, '#e8a23a');
  }
  if (theme === 'cave' && n > 0.75) {
    const mx = x + 5 + hash(col, 3) * 6, pulse = 0.5 + 0.3 * Math.sin(time * 2 + col);
    c.fillStyle = `rgba(111, 224, 208, ${pulse * 0.4})`; ellipse(c, mx, y - 3, 4, 3); c.fill();
    rect(c, mx - 0.4, y - 3, 0.8, 3, '#d9f5ef');
    c.fillStyle = '#6fe0d0'; c.beginPath(); c.ellipse(mx, y - 3, 2.2, 1.6, 0, Math.PI, 0); c.fill();
  }
}

function raisin(c: CanvasRenderingContext2D, x: number, y: number) {
  c.fillStyle = '#3d1f3b'; ellipse(c, x, y, 4.7, 5.7); c.fill();
  c.fillStyle = '#5c2f58'; ellipse(c, x - 0.3, y - 0.3, 4, 5); c.fill();
  c.fillStyle = '#7a4474'; ellipse(c, x - 1.3, y - 1.5, 2.2, 2.8); c.fill();
  c.strokeStyle = '#2e1530'; c.lineWidth = 0.7;
  c.beginPath(); c.moveTo(x - 3, y + 1); c.quadraticCurveTo(x, y + 3, x + 3, y); c.moveTo(x - 2, y - 2); c.quadraticCurveTo(x + 0.5, y - 1, x + 2.5, y - 2.8); c.stroke();
  dot(c, x - 1.8, y - 3, 0.9, '#e7cdef');
  rect(c, x - 0.4, y - 6.4, 0.9, 1.5, '#6b8f3a');
}
function cloudLedge(c: CanvasRenderingContext2D, x: number, y: number, w: number, dark: boolean) {
  const top = dark ? '#a79dd0' : '#ffffff', under = dark ? '#6f6699' : '#cfe0ee', mid = dark ? '#8d83bb' : '#e8f1f8';
  c.fillStyle = under; ellipse(c, x + w / 2, y + 6, w / 2 + 1, 4); c.fill();
  c.fillStyle = mid; ellipse(c, x + w / 2, y + 4.5, w / 2 + 1, 4.2); c.fill();
  c.fillStyle = top;
  for (let i = 0; i < w / 8; i++) { ellipse(c, x + 4 + i * 8, y + 3, 4.6, 3.6); c.fill(); }
  c.fillStyle = 'rgba(255,255,255,0.8)';
  for (let i = 0; i < w / 8; i++) { ellipse(c, x + 3 + i * 8, y + 1.6, 1.8, 1); c.fill(); }
}
function clover(c: CanvasRenderingContext2D, x: number, y: number) {
  c.strokeStyle = '#2d6e31'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 2, y + 6, x + 1, y + 8); c.stroke();
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + Math.PI / 4;
    c.save(); c.translate(x + Math.cos(a) * 3.6, y + Math.sin(a) * 3.6); c.rotate(a + Math.PI / 2);
    // A heart-shaped leaf.
    c.fillStyle = '#2d7a35'; ellipse(c, -1.6, 0.4, 2.6, 3.4); c.fill(); ellipse(c, 1.6, 0.4, 2.6, 3.4); c.fill();
    c.fillStyle = '#4fb058'; ellipse(c, -1.5, 0, 2.1, 2.9); c.fill(); ellipse(c, 1.5, 0, 2.1, 2.9); c.fill();
    c.strokeStyle = '#8fdc8f'; c.lineWidth = 0.4; c.beginPath(); c.moveTo(0, 2.5); c.lineTo(0, -2); c.stroke();
    c.restore();
  }
  dot(c, x, y, 1, '#2d7a35');
  dot(c, x - 3, y - 3.4, 0.9, '#c9f2c0');
}
function feather(c: CanvasRenderingContext2D, x: number, y: number) {
  c.save(); c.translate(x, y); c.rotate(-0.6);
  c.fillStyle = '#1f1c26'; c.beginPath(); c.moveTo(0, -9); c.quadraticCurveTo(4.2, -3, 2.4, 8); c.lineTo(-2.4, 8); c.quadraticCurveTo(-4.2, -3, 0, -9); c.fill();
  c.fillStyle = '#f4efe6'; c.beginPath(); c.moveTo(0, -9); c.quadraticCurveTo(3, -6, 2.6, -2); c.lineTo(-2.6, -2); c.quadraticCurveTo(-3, -6, 0, -9); c.fill();
  c.strokeStyle = 'rgba(160,150,170,0.7)'; c.lineWidth = 0.4; c.beginPath();
  for (let k = 0; k < 6; k++) { const yy = -6 + k * 2.4; c.moveTo(0, yy); c.lineTo(-2.6, yy + 1.8); c.moveTo(0, yy); c.lineTo(2.6, yy + 1.8); }
  c.stroke();
  line(c, [0, -9, 0, 10], '#d8d0c4', 0.8);
  c.restore();
}

/** Editor-only look of parts that become moving things in play: enemies, lifts, flags, start and goal. */
export function drawMarker(c: CanvasRenderingContext2D, ch: string, x: number, y: number, time: number, theme: ThemeId) {
  switch (ch) {
    case 'b': enemy(c, 'beetle', x + 1, y + 6, 14, 10, 1, time, false); break;
    case 'f': enemy(c, 'frog', x + 1, y + 4, 14, 12, -1, time, false); break;
    case 'v': enemy(c, 'bat', x + 1, y + 3, 14, 10, -1, time, false); break;
    case 'x': enemy(c, 'prickle', x + 1, y + 2, 14, 14, -1, time, false); break;
    case 'M': c.globalAlpha = 0.9; cloudLedge(c, x - 16, y + 4, 48, theme === 'cave'); c.globalAlpha = 1;
      c.fillStyle = '#5b95f0'; c.font = 'bold 7px ui-monospace, monospace'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('⟷', x + 8, y + 15); break;
    case 'P': flag(c, x, y + TILE, false, time); break;
    case 'G': goal(c, x, y + TILE, time); break;
    case '@': chinchilla(c, 'dora', x + 8, y + TILE, { face: 1, h: 14, time }); break;
  }
}

function pawPrint(c: CanvasRenderingContext2D, x: number, y: number, s: number, fill: string) {
  c.fillStyle = fill;
  ellipse(c, x, y + 1.2 * s, 2.6 * s, 2.1 * s); c.fill();
  for (let i = 0; i < 3; i++) { ellipse(c, x - 2.6 * s + i * 2.6 * s, y - 2.2 * s + (i === 1 ? -0.6 * s : 0), 1 * s, 1.2 * s); c.fill(); }
}
function flag(c: CanvasRenderingContext2D, x: number, base: number, taken: boolean, time: number) {
  c.fillStyle = '#4a4750'; c.beginPath(); c.roundRect(x + 3.5, base - 3, 9, 3, 1); c.fill();
  rect(c, x + 7, base - 30, 2, 28, '#77737d'); rect(c, x + 7, base - 30, 0.8, 28, '#a9a5b0');
  dot(c, x + 8, base - 31, 1.8, taken ? '#ffd46a' : '#c9c4cf');
  const wave = Math.sin(time * 5) * 1.5;
  c.fillStyle = taken ? '#e86a4f' : '#b9b4c0';
  c.beginPath(); c.moveTo(x + 9, base - 29); c.quadraticCurveTo(x + 15, base - 30 + wave, x + 21, base - 27 + wave); c.lineTo(x + 20, base - 20 + wave); c.quadraticCurveTo(x + 14, base - 22 - wave, x + 9, base - 20); c.fill();
  c.fillStyle = 'rgba(0,0,0,0.12)'; c.fillRect(x + 9, base - 29, 2, 9);
  if (taken) pawPrint(c, x + 15, base - 24.5 + wave * 0.5, 0.75, '#fff1e8');
}
function goal(c: CanvasRenderingContext2D, x: number, base: number, time: number) {
  const top = base - 8 * TILE;
  // A little stone plinth.
  c.fillStyle = '#6d6a72'; c.beginPath(); c.roundRect(x + 1, base - 5, 14, 5, 1.5); c.fill();
  rect(c, x + 1, base - 5, 14, 1.2, '#9a96a0');
  // Striped pole.
  rect(c, x + 7, top, 2.5, base - top - 5, '#e9e4dc');
  for (let yy = top + 4; yy < base - 8; yy += 10) rect(c, x + 7, yy, 2.5, 4, '#e8a0a8');
  rect(c, x + 7, top, 0.8, base - top - 5, '#ffffff');
  dot(c, x + 8.2, top - 2, 3.6, '#e2a92f'); dot(c, x + 8.2, top - 2, 2.8, '#f7cf5a'); dot(c, x + 7.2, top - 3, 1, '#fff4c8');
  const wave = Math.sin(time * 4) * 2;
  c.fillStyle = '#c93c58';
  c.beginPath(); c.moveTo(x + 9.5, top + 2); c.quadraticCurveTo(x + 18, top + 4 + wave, x + 28, top + 3 + wave); c.lineTo(x + 28, top + 17 + wave); c.quadraticCurveTo(x + 18, top + 18 + wave, x + 9.5, top + 16); c.fill();
  c.fillStyle = '#e84f6a';
  c.beginPath(); c.moveTo(x + 9.5, top + 2); c.quadraticCurveTo(x + 18, top + 4 + wave, x + 28, top + 3 + wave); c.lineTo(x + 28, top + 15 + wave); c.quadraticCurveTo(x + 18, top + 16 + wave, x + 9.5, top + 14); c.fill();
  pawPrint(c, x + 19, top + 9.5 + wave, 1, '#fff1e8');
  star(c, x + 5, top - 5, 1.5 + Math.sin(time * 5) * 0.8, '#fff4c8', time);
}

// ---------- Characters ----------

export type ChinOpts = { face: 1 | -1; h: number; time: number; run?: number; moving?: boolean; air?: boolean; power?: Power; blink?: boolean; dizzy?: boolean };

/** Dora or Enzo, feet at (x, base), `h` pixels tall. Drawn side-on in a 24-unit-tall frame facing right. */
export function chinchilla(c: CanvasRenderingContext2D, id: HeroId, x: number, base: number, o: ChinOpts) {
  const k = COATS[id], s = o.h / 24, t = o.time;
  c.save();
  c.translate(x, base);
  c.scale(o.face * s * 0.95, s);
  const moving = !!o.moving && !o.air;
  // Chinchillas bound: hind feet push while the front paws reach, and the back arches with it.
  const stride = moving && o.run !== undefined ? Math.sin(o.run * 0.45) : 0;
  const breathe = !moving && !o.air ? Math.sin(t * 3) * 0.3 : 0;
  const bob = o.air ? -0.8 : -Math.abs(stride) * 1.4 + breathe;
  const lean = o.air ? -0.1 : stride * 0.05;
  // One outline around several shapes: stroke them all thick, then fill them all over the top.
  const blob = (parts: (() => void)[], fill: string | CanvasGradient, outline: string, width = 1.7) => {
    c.lineWidth = width; c.strokeStyle = outline; c.lineJoin = 'round';
    for (const p of parts) { p(); c.stroke(); }
    c.fillStyle = fill;
    for (const p of parts) { p(); c.fill(); }
  };
  const oval = (ex: number, ey: number, rx: number, ry: number, rot = 0) => () => ellipse(c, ex, ey, rx, ry, rot);

  if (!o.air) { c.fillStyle = 'rgba(20, 12, 30, 0.2)'; ellipse(c, 0, -0.2, 12, 1.6); c.fill(); }

  tail(c, k, t, bob, moving, !!o.air);

  // Far ear and far feet sit behind the body.
  const sweep = o.air ? -0.4 : moving ? -0.2 : 0;
  const ear = (dx: number, dy: number, rx: number, ry: number, rot: number) => oval(dx + sweep * 2.5, dy + bob, rx, ry, rot + sweep);
  blob([ear(2.6, -22.2, 4, 5, -0.4)], k.earIn, k.earLine, 1.3);
  const air = !!o.air;
  const hindX = air ? -7 : -3 - stride * 3.2, frontX = air ? 11 : 7.5 + stride * 2.6;
  blob([oval(hindX - 2, -1.4, 3.8, 1.4, air ? 0.5 : 0)], k.toe, k.line, 1.1);
  blob([oval(frontX - 2.5, air ? -6.5 : -1.3, 2, 1.1)], k.toe, k.line, 1);

  // Body, haunch, chest, head, muzzle and cheek fluff share one outline.
  c.save(); c.translate(0, -6); c.rotate(lean); c.translate(0, 6);
  const coat = c.createLinearGradient(0, -19 + bob, 0, 0);
  coat.addColorStop(0, k.back); coat.addColorStop(0.45, k.fur); coat.addColorStop(1, k.shade);
  const cheeks = () => {
    c.beginPath(); c.moveTo(3, -12 + bob);
    for (const [px, py] of [[3.6, -7.2], [5, -8.6], [6.2, -6.6], [7.6, -8.2], [9, -6.8], [10, -8.4]]) c.lineTo(px, py + bob);
    c.lineTo(11, -11 + bob); c.closePath();
  };
  blob([oval(-1.5, -8.5 + bob, 10, 7.8), oval(-6.5, -6.2 + bob, 6.4, 6), oval(4.5, -7.8 + bob, 5.6, 6), cheeks, oval(6.8, -12.6 + bob, 6.6, 6.3), oval(11.2, -10.6 + bob, 3.3, 3)], coat, k.line);
  // Lighter face and a white chest and belly.
  c.fillStyle = k.face; ellipse(c, 8, -12 + bob, 5.4, 5); c.fill();
  c.fillStyle = k.belly; ellipse(c, 8.4, -6.6 + bob, 3, 3.6); c.fill(); ellipse(c, 2.5, -2.8 + bob, 6, 2.4); c.fill();
  // Coat texture: Enzo's wavy darker bands, a few soft strokes on Dora.
  c.strokeStyle = k.texture; c.lineWidth = id === 'enzo' ? 0.7 : 0.5; c.beginPath();
  const bands = id === 'enzo' ? [[-9, -13], [-5.5, -15], [-2, -15.6], [1.5, -15], [-7, -8], [-3.5, -10]] : [[-7, -11], [-3, -14], [-8, -6]];
  for (const [bx, by] of bands) { c.moveTo(bx, by + bob); c.quadraticCurveTo(bx + 1.6, by + 2 + bob, bx + 0.4, by + 4 + bob); c.quadraticCurveTo(bx - 0.8, by + 5.5 + bob, bx + 0.6, by + 7 + bob); }
  c.stroke();
  if (id === 'enzo') { c.fillStyle = 'rgba(160, 158, 170, 0.35)'; for (const [mx, my] of [[-6, -11], [-1, -12], [-4, -6], [2, -9]]) { ellipse(c, mx, my + bob, 1.4, 0.8); c.fill(); } }
  c.restore();

  // Near hind foot with long toes, and a front leg and paw.
  blob([oval(hindX, -1.4, 4.2, 1.5, air ? 0.5 : 0)], k.foot, k.line, 1.2);
  c.strokeStyle = k.toe; c.lineWidth = 0.4; c.beginPath();
  for (let i = 0; i < 3; i++) { const tx = hindX + 2 + i * 0.9; c.moveTo(tx, -2.4); c.lineTo(tx + 0.6, -0.5); }
  c.stroke();
  const pawY = air ? -6 : -1.2;
  blob([oval(frontX - 0.6, pawY - 2.4 + bob * 0.5, 1.5, 2.6, air ? -1 : 0), oval(frontX, pawY, 2.1, 1.2)], id === 'enzo' ? k.belly : k.fur, k.line, 1.1);
  c.fillStyle = k.foot; ellipse(c, frontX + 0.6, pawY, 1.4, 0.9); c.fill();
  c.strokeStyle = k.toe; c.lineWidth = 0.35; c.beginPath();
  for (let i = 0; i < 3; i++) { c.moveTo(frontX + 0.6 + i * 0.6, pawY - 0.6); c.lineTo(frontX + 1 + i * 0.6, pawY + 0.8); }
  c.stroke();

  // Near ear: big and round, with a pink inside and fine veins.
  blob([ear(6.2, -22.6, 4.6, 5.6, 0.12)], k.ear, k.earLine, 1.4);
  c.fillStyle = k.earIn; ellipse(c, 6.5 + sweep * 2.5, -22.3 + bob, 3, 4.1, 0.12 + sweep); c.fill();
  c.strokeStyle = k.vein; c.lineWidth = 0.35; c.beginPath();
  const ex = 6.3 + sweep * 2.5;
  c.moveTo(ex, -18.5 + bob); c.quadraticCurveTo(ex + 1, -22 + bob, ex + sweep * 3 + 0.2, -25.5 + bob);
  c.moveTo(ex + 0.4, -21 + bob); c.lineTo(ex + 2 + sweep, -23 + bob);
  c.stroke();
  if (id === 'dora') { c.fillStyle = 'rgba(255,255,255,0.35)'; ellipse(c, ex - 2.3, -23.5 + bob, 0.9, 2.6, 0.2 + sweep); c.fill(); }

  // Face.
  const eyeX = 8.7, eyeY = -14.4 + bob;
  if (o.dizzy) {
    line(c, [eyeX - 1.4, eyeY - 1.4, eyeX + 1.4, eyeY + 1.4], '#16121a', 0.7);
    line(c, [eyeX + 1.4, eyeY - 1.4, eyeX - 1.4, eyeY + 1.4], '#16121a', 0.7);
  } else if (o.blink) {
    c.strokeStyle = k.line; c.lineWidth = 0.7; c.beginPath(); c.arc(eyeX, eyeY - 0.6, 1.6, 0.3, Math.PI - 0.3); c.stroke();
  } else {
    c.fillStyle = k.eye; ellipse(c, eyeX, eyeY, id === 'dora' ? 1.6 : 1.8, id === 'dora' ? 1.75 : 1.95); c.fill();
    c.fillStyle = k.pupil; ellipse(c, eyeX + 0.2, eyeY + 0.1, 1, 1.2); c.fill();
    dot(c, eyeX + 0.6, eyeY - 0.8, id === 'dora' ? 0.5 : 0.62, '#ffffff');
    dot(c, eyeX - 0.5, eyeY + 0.8, 0.25, 'rgba(255,255,255,0.8)');
  }
  c.fillStyle = k.blush; ellipse(c, 9.6, -11.2 + bob, 1.8, 1.1); c.fill();
  const twitch = moving || o.air ? 0 : Math.max(0, Math.sin(t * 7)) * 0.3;
  c.fillStyle = k.nose; ellipse(c, 13.7, -11.4 + bob - twitch, 1, 0.75, 0.3); c.fill();
  c.strokeStyle = k.line; c.lineWidth = 0.35; c.beginPath();
  c.moveTo(13.6, -10.6 + bob); c.lineTo(13.4, -9.8 + bob); c.quadraticCurveTo(12.8, -9.2 + bob, 12.2, -9.6 + bob); c.stroke();
  // Long whiskers, fanned and gently swaying.
  const whisk = Math.sin(t * 5) * 0.4;
  c.lineWidth = 0.3;
  for (const [i, [wx, wy]] of ([[22, -14.5], [23, -11.6], [22.4, -8.6], [20.6, -6]] as const).entries()) {
    c.strokeStyle = i % 2 ? k.whiskerLight : k.whisker;
    c.beginPath(); c.moveTo(12.4, -10.8 + bob); c.quadraticCurveTo(16.5, wy + bob + 0.3 - whisk * 0.5, wx, wy + bob + whisk); c.stroke();
  }

  if (o.power === 'clover') { c.save(); c.translate(1.5, -29 + bob); c.scale(0.5, 0.5); clover(c, 0, 0); c.restore(); }
  if (o.power === 'feather') { c.save(); c.translate(0.5, -28 + bob); c.scale(0.6, 0.6); feather(c, 0, 0); c.restore(); }
  c.restore();
}

/**
 * The tail, as circles along a curve from the rump. Dora's is smooth and even, sweeping out and curling up;
 * Enzo's is a bottlebrush that swells toward the end, with lighter hair tips.
 */
function tail(c: CanvasRenderingContext2D, k: Coat, t: number, bob: number, moving: boolean, air: boolean) {
  const wag = Math.sin(t * (moving ? 9 : 2.2)) * (moving ? 1 : 0.6);
  const p0 = [-10, -5 + bob * 0.5];
  const p1 = k.brush ? [-18, -0.5] : [-18, 0.5];
  const p2 = k.brush ? [-22 + wag * 0.4, -8 + wag] : [-21.5 + wag * 0.5, -11 + wag * 0.6];
  if (moving) { p2[0] -= 2; p2[1] += 3; }
  if (air) { p2[1] -= 3; p1[1] -= 1; }
  const n = 14, pts: [number, number, number, number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n, a = (1 - u) * (1 - u), b = 2 * u * (1 - u), d = u * u;
    const px = a * p0[0] + b * p1[0] + d * p2[0], py = a * p0[1] + b * p1[1] + d * p2[1];
    // Tangent, for the normal the hairs stick out along.
    const tx = 2 * (1 - u) * (p1[0] - p0[0]) + 2 * u * (p2[0] - p1[0]), ty = 2 * (1 - u) * (p1[1] - p0[1]) + 2 * u * (p2[1] - p1[1]);
    const len = Math.hypot(tx, ty) || 1;
    const r = k.brush ? 1.8 + 3 * Math.sin(Math.PI * (0.15 + 0.75 * u)) : 3 - 0.9 * u + 0.6 * Math.sin(Math.PI * u);
    pts.push([px, py, r, -ty / len, tx / len]);
  }
  // A soft halo of loose fur, then the outline and the fill.
  c.fillStyle = k.brush ? 'rgba(120, 118, 130, 0.35)' : 'rgba(255, 255, 255, 0.5)';
  for (const [px, py, r] of pts) { ellipse(c, px, py, r + 1.1, r + 1.1); c.fill(); }
  c.lineWidth = 1.5; c.strokeStyle = k.tailLine;
  for (const [px, py, r] of pts) { ellipse(c, px, py, r, r); c.stroke(); }
  c.fillStyle = k.tail;
  for (const [px, py, r] of pts) { ellipse(c, px, py, r, r); c.fill(); }
  if (k.brush) {
    // Bristles, dark and light, fanning out along both sides and off the end.
    c.lineWidth = 0.45;
    for (const [i, [px, py, r, nx, ny]] of pts.entries()) {
      if (i < 4 || i % 2) continue;
      for (const side of [-1, 1]) {
        c.strokeStyle = k.tailTip;
        c.beginPath(); c.moveTo(px + nx * side * r * 0.6, py + ny * side * r * 0.6); c.lineTo(px + nx * side * (r + 0.9) - ny * 0.6, py + ny * side * (r + 0.9) + nx * 0.6); c.stroke();
      }
    }
    const [ex, ey] = pts[n];
    c.strokeStyle = k.tailTip;
    c.beginPath(); for (let a = -0.6; a <= 0.6; a += 0.4) { c.moveTo(ex, ey); c.lineTo(ex - 2.2 * Math.cos(a + 0.5), ey - 2.2 * Math.sin(a + 0.5)); } c.stroke();
    c.fillStyle = 'rgba(140, 138, 150, 0.35)';
    for (const [px, py, r] of pts.slice(4)) { ellipse(c, px - 0.4, py - r * 0.35, r * 0.5, r * 0.3); c.fill(); }
  } else {
    // A cream shadow along the underside and soft wisps at the tip.
    c.fillStyle = k.tailTip;
    for (const [px, py, r, nx, ny] of pts.slice(2)) { ellipse(c, px - nx * r * 0.45, py - ny * r * 0.45, r * 0.5, r * 0.45); c.fill(); }
    // Soft wisps along the outer edge and off the tip.
    c.strokeStyle = k.tailLine; c.lineWidth = 0.4; c.beginPath();
    for (const [i, [px, py, r, nx, ny]] of pts.entries()) {
      if (i < 5 || i % 3) continue;
      c.moveTo(px + nx * r * 0.9, py + ny * r * 0.9); c.lineTo(px + nx * (r + 1) - ny * 0.8, py + ny * (r + 1) + nx * 0.8);
    }
    const [ex, ey] = pts[n];
    c.moveTo(ex - 1, ey - 2); c.lineTo(ex - 1.8, ey - 3.6); c.moveTo(ex + 0.6, ey - 2.4); c.lineTo(ex + 0.8, ey - 4); c.stroke();
  }
}

function enemy(c: CanvasRenderingContext2D, kind: Enemy['kind'], x: number, y: number, w: number, h: number, dir: number, time: number, squashed: boolean, air = false) {
  const cx = x + w / 2, base = y + h;
  c.save();
  c.lineWidth = 1; c.strokeStyle = '#1d1a22'; c.lineJoin = 'round';
  if (kind === 'beetle') {
    if (squashed) {
      c.fillStyle = '#2f5c3e'; ellipse(c, cx, base - 1.5, 8, 2); c.fill(); c.stroke();
      for (const s of [-1, 1]) line(c, [cx + s * 6, base - 1, cx + s * 9, base], '#1d1a22', 0.8);
      c.restore(); return;
    }
    // Six legs scuttling.
    for (let i = 0; i < 3; i++) {
      const lx = cx - 4 + i * 4, swing = Math.sin(time * 14 + i * 2.1) * 1.4;
      line(c, [lx, base - 3, lx - dir * 1 + swing, base - 1.5, lx - dir * 0.5 + swing, base], '#1d1a22', 0.9);
    }
    c.fillStyle = '#1d1a22'; ellipse(c, cx + dir * 6, base - 4, 2.9, 2.6); c.fill();
    c.fillStyle = '#2f7a4c'; ellipse(c, cx - dir * 0.5, base - 5.5, 7, 5); c.fill(); c.stroke();
    c.fillStyle = '#44985f'; ellipse(c, cx - dir * 1, base - 6.5, 5.6, 3.4); c.fill();
    c.fillStyle = '#7fd79a'; ellipse(c, cx - dir * 2.5, base - 8.2, 2.6, 1.2, -0.2 * dir); c.fill();
    line(c, [cx + dir * 3, base - 9.8, cx + dir * 2.5, base - 1.5], '#1d4d31', 0.7);
    for (const [sx, sy] of [[-3, -6], [0, -4], [-4.5, -3.5]]) dot(c, cx + dir * sx, base + sy, 0.9, '#1d4d31');
    // Antennae and a bright eye.
    const tw = Math.sin(time * 6) * 0.8;
    c.strokeStyle = '#1d1a22'; c.lineWidth = 0.6; c.beginPath();
    c.moveTo(cx + dir * 7, base - 6); c.quadraticCurveTo(cx + dir * 9, base - 9, cx + dir * 10.5, base - 9 + tw);
    c.moveTo(cx + dir * 6.5, base - 6.2); c.quadraticCurveTo(cx + dir * 8, base - 10, cx + dir * 8.5, base - 10.5 - tw); c.stroke();
    dot(c, cx + dir * 7.2, base - 4.8, 1, '#ffffff'); dot(c, cx + dir * 7.6, base - 4.8, 0.5, '#1d1a22');
  } else if (kind === 'frog') {
    if (squashed) { c.fillStyle = '#4f9a3a'; ellipse(c, cx, base - 1.5, 8, 2); c.fill(); c.stroke(); c.restore(); return; }
    const leap = air;
    c.save(); c.translate(cx, base - 4.5); c.rotate(leap ? -0.25 * dir : 0); c.translate(-cx, -(base - 4.5));
    // Back leg: folded when sitting, kicked out when leaping.
    c.fillStyle = '#3f8a31';
    if (leap) { ellipse(c, cx - dir * 8, base - 2, 4, 1.4, 0.3 * dir); c.fill(); c.stroke(); }
    else { ellipse(c, cx - dir * 3.5, base - 3, 3.8, 2.6); c.fill(); c.stroke(); rect(c, cx - dir * 3.5 - 3, base - 1.2, 5, 1.2, '#3f8a31'); }
    c.fillStyle = '#5bb04a'; ellipse(c, cx, base - 5, 7, 5); c.fill(); c.stroke();
    c.fillStyle = '#d7efb0'; ellipse(c, cx + dir * 2.4, base - 3, 4, 2.2); c.fill();
    for (const [sx, sy] of [[-3, -7], [-0.5, -8.5], [-4.5, -4.5]]) dot(c, cx + dir * sx, base + sy, 0.9, '#3f8a31');
    // Front leg, mouth and cheek.
    line(c, [cx + dir * 4, base - 3, cx + dir * 5, base - 0.5], '#3f8a31', 1.4);
    c.strokeStyle = '#2b5e22'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(cx + dir * 1, base - 5.2); c.quadraticCurveTo(cx + dir * 4.5, base - 4, cx + dir * 6.8, base - 5.6); c.stroke();
    dot(c, cx + dir * 4.5, base - 6, 0.9, 'rgba(240,140,150,0.6)');
    for (const ex of [-2.4, 2.4]) {
      c.fillStyle = '#5bb04a'; ellipse(c, cx + dir * 2 + ex, base - 9.5, 2.7, 2.6); c.fill(); c.stroke();
      dot(c, cx + dir * 2 + ex, base - 9.8, 1.7, '#fff7df');
      dot(c, cx + dir * 2.6 + ex, base - 9.8, 1, '#1d1a22');
      dot(c, cx + dir * 2.3 + ex, base - 10.3, 0.35, '#ffffff');
    }
    c.restore();
  } else if (kind === 'bat') {
    if (squashed) c.globalAlpha = 0.6;
    const flap = Math.sin(time * 16) * 4;
    for (const s of [-1, 1]) {
      const tipX = cx + s * 9, tipY = base - 8 - flap;
      c.fillStyle = '#4a3166';
      c.beginPath(); c.moveTo(cx + s * 2, base - 7); c.lineTo(tipX, tipY);
      c.quadraticCurveTo(cx + s * 8, base - 3 - flap * 0.3, cx + s * 6.5, base - 3.5);
      c.quadraticCurveTo(cx + s * 5.5, base - 5, cx + s * 4.5, base - 3);
      c.quadraticCurveTo(cx + s * 3.5, base - 4.5, cx + s * 2, base - 4); c.fill();
      line(c, [cx + s * 2, base - 6.5, tipX, tipY], '#2e1e42', 0.6);
      line(c, [cx + s * 4, base - 6.5 - flap * 0.4, cx + s * 6.5, base - 3.5], '#2e1e42', 0.5);
      line(c, [cx + s * 3.5, base - 6.5, cx + s * 4.5, base - 3], '#2e1e42', 0.5);
    }
    c.fillStyle = '#6b4b90'; ellipse(c, cx, base - 5.5, 3.8, 4.2); c.fill(); c.stroke();
    c.fillStyle = '#8a68b0'; ellipse(c, cx, base - 4.5, 2.2, 2.4); c.fill();
    for (const s of [-1, 1]) { c.fillStyle = '#6b4b90'; c.beginPath(); c.moveTo(cx + s * 1, base - 8.8); c.lineTo(cx + s * 2.8, base - 12); c.lineTo(cx + s * 3.2, base - 8); c.fill(); }
    dot(c, cx - 1.3 + dir * 0.5, base - 6.6, 0.9, '#ffe16a'); dot(c, cx + 1.3 + dir * 0.5, base - 6.6, 0.9, '#ffe16a');
    dot(c, cx - 1.1 + dir * 0.8, base - 6.6, 0.4, '#1d1a22'); dot(c, cx + 1.5 + dir * 0.8, base - 6.6, 0.4, '#1d1a22');
    c.fillStyle = '#ffffff';
    for (const s of [-0.7, 0.7]) { c.beginPath(); c.moveTo(cx + s - 0.35, base - 4.5); c.lineTo(cx + s + 0.35, base - 4.5); c.lineTo(cx + s, base - 3.4); c.fill(); }
  } else {
    const sway = squashed ? 0 : Math.sin(time * 8) * 0.8, step = squashed ? 0 : Math.sin(time * 10);
    // Two stubby feet under a walking cactus.
    dot(c, cx - 2.5 + step, base - 0.8, 1.4, '#3c6e2e'); dot(c, cx + 2.5 - step, base - 0.8, 1.4, '#3c6e2e');
    c.fillStyle = '#4f9a58'; c.beginPath(); c.roundRect(cx - 5 + sway, base - 13, 10, 12.5, 4.5); c.fill(); c.stroke();
    c.fillStyle = '#4f9a58'; c.beginPath(); c.roundRect(cx - dir * 8.5 + sway - 1.5, base - 10, 3, 5, 1.5); c.fill(); c.stroke();
    c.fillStyle = '#6fbf74'; c.fillRect(cx - 3 + sway, base - 11.5, 1.3, 9);
    c.fillStyle = '#3c7d44'; c.fillRect(cx + 1 + sway, base - 12, 0.8, 10); c.fillRect(cx - 1 + sway, base - 12, 0.6, 10);
    c.fillStyle = '#f4f1dc';
    for (const [sx, sy] of [[-6, -10], [5, -9], [-6, -5], [5, -4], [0, -14], [-3, -13], [3, -13]]) { c.beginPath(); c.moveTo(cx + sx + sway, base + sy); c.lineTo(cx + sx + (sx < 0 ? -2 : sx > 0 ? 2 : 0) + sway, base + sy - (sx === 0 ? 2 : 1)); c.lineTo(cx + sx + sway, base + sy + 1.4); c.fill(); }
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2 + time; c.fillStyle = '#f07aa8'; ellipse(c, cx + 1.5 + sway + Math.cos(a) * 1.6, base - 13.8 + Math.sin(a) * 1, 1.3, 0.9, a); c.fill(); }
    dot(c, cx + 1.5 + sway, base - 13.8, 0.8, '#ffd34d');
    dot(c, cx - 1.4 + dir * 1.5 + sway, base - 8.5, 1.1, '#fff7df'); dot(c, cx + 1.6 + dir * 1.5 + sway, base - 8.5, 1.1, '#fff7df');
    dot(c, cx - 1.2 + dir * 1.8 + sway, base - 8.4, 0.6, '#1d1a22'); dot(c, cx + 1.8 + dir * 1.8 + sway, base - 8.4, 0.6, '#1d1a22');
    line(c, [cx - 2.8 + dir * 1.5 + sway, base - 10.4, cx - 0.4 + dir * 1.5 + sway, base - 9.8], '#1d1a22', 0.6);
    line(c, [cx + 3.2 + dir * 1.5 + sway, base - 10.4, cx + 0.8 + dir * 1.5 + sway, base - 9.8], '#1d1a22', 0.6);
  }
  c.restore();
}

// ---------- Scenes ----------

/** The course as the maker sees it: every part in place, with a grid and a cursor. */
export function drawEditor(c: CanvasRenderingContext2D, course: Course, cam: number, time: number, cursor: { c: number; r: number; ch: string } | null, grid = true) {
  drawBackdrop(c, course.theme, cam, time);
  c.save();
  c.translate(-Math.round(cam), 0);
  const at: TileAt = (col, r) => (r < 0 || r >= ROWS || col < 0 || col >= course.cols ? '.' : course.tiles[index(col, r)]);
  const c0 = Math.max(0, Math.floor(cam / TILE) - 2), c1 = Math.min(course.cols - 1, Math.ceil((cam + VIEW_W) / TILE) + 2);
  for (let col = c0; col <= c1; col++) for (let r = 0; r < ROWS; r++) {
    const ch = course.tiles[index(col, r)];
    if (ch !== '.' && ch !== 'G') drawTile(c, ch, col, r, course.theme, time, at, { editor: true });
  }
  // The goal pole is tall, so draw it over everything else.
  for (let col = c0; col <= c1; col++) for (let r = 0; r < ROWS; r++) if (course.tiles[index(col, r)] === 'G') drawMarker(c, 'G', col * TILE, r * TILE, time, course.theme);
  if (grid) {
    c.strokeStyle = course.theme === 'cave' ? 'rgba(255,255,255,.08)' : 'rgba(40,30,60,.1)';
    c.lineWidth = 0.5;
    c.beginPath();
    for (let col = c0; col <= c1 + 1; col++) { c.moveTo(col * TILE, 0); c.lineTo(col * TILE, VIEW_H); }
    for (let r = 0; r <= ROWS; r++) { c.moveTo(c0 * TILE, r * TILE); c.lineTo((c1 + 1) * TILE, r * TILE); }
    c.stroke();
  }
  rect(c, course.cols * TILE, 0, 2, VIEW_H, '#e84f6a');
  if (cursor) {
    const x = cursor.c * TILE, y = cursor.r * TILE;
    if (cursor.ch !== '.') { c.globalAlpha = 0.55; drawTile(c, cursor.ch, cursor.c, cursor.r, course.theme, time, at, { editor: true }); c.globalAlpha = 1; }
    c.strokeStyle = cursor.ch === '.' ? '#e84f6a' : '#ffffff'; c.lineWidth = 1.2;
    c.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
  }
  c.restore();
}

/** How long the incoming chinchilla takes to dash in when you tag, and when they boop noses. */
const DASH = 0.16;

/** A running game, HUD included. */
export function drawGame(c: CanvasRenderingContext2D, g: FluffForgeGame, time: number) {
  const theme = g.course.theme, cam = Math.round(g.cam);
  drawBackdrop(c, theme, cam, time);
  c.save();
  c.translate(-cam, 0);
  const at: TileAt = (col, r) => g.tile(col, r);
  const c0 = Math.max(0, Math.floor(cam / TILE) - 1), c1 = Math.min(g.cols - 1, Math.ceil((cam + VIEW_W) / TILE) + 1);
  for (let col = c0; col <= c1; col++) for (let r = 0; r < ROWS; r++) {
    const i = index(col, r), ch = g.tiles[i];
    if (ch !== '.') drawTile(c, ch, col, r, theme, time, at, { bump: g.bumps.get(i), spring: g.springs.get(i) });
  }
  for (const l of g.lifts) cloudLedge(c, l.x, l.y - 4, l.w, theme === 'cave');
  for (const f of g.flags) flag(c, f.x, f.y, f.taken, time);
  goal(c, g.goal.x, g.goal.y, time);
  for (const it of g.items) {
    const glow = c.createRadialGradient(it.x + 6, it.y + 6, 1, it.x + 6, it.y + 6, 11);
    glow.addColorStop(0, it.kind === 'clover' ? 'rgba(160,240,150,0.5)' : 'rgba(255,255,255,0.5)'); glow.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = glow; c.fillRect(it.x - 5, it.y - 5, 22, 22);
    if (it.kind === 'clover') clover(c, it.x + 6, it.y + 6 + Math.sin(it.t * 8) * 0.5);
    else feather(c, it.x + 6, it.y + 6);
  }
  for (const e of g.enemies) {
    if (!e.flip) enemy(c, e.kind, e.x, e.y, e.w, e.h, e.dir, g.t, e.dead > 0, !e.ground && e.kind === 'frog');
    else { c.save(); c.translate(e.x + e.w / 2, e.y + e.h / 2); c.scale(1, -1); enemy(c, e.kind, -e.w / 2, -e.h / 2, e.w, e.h, e.dir, g.t, false); c.restore(); }
  }
  const h = g.hero;
  const hx = h.x + h.w / 2;
  let dash = 0;
  const tag = g.state === 'play' ? g.tag : null;
  if (tag) {
    // The partner who was playing turns to meet the newcomer nose to nose, then runs off the way they came.
    const behind = -tag.face as 1 | -1, meet = tag.x + tag.face * 11;
    const gone = Math.max(0, tag.t - DASH - 0.1);
    const ox = meet + behind * gone * 160, oy = (tag.air ? tag.y + 450 * tag.t * tag.t : tag.y) - Math.abs(Math.sin(gone * 16)) * 3;
    c.save(); c.globalAlpha = Math.max(0, Math.min(1, (1 - tag.t) / 0.3));
    chinchilla(c, tag.from, ox, oy, { face: behind, h: h.h, time, run: gone * 160, moving: gone > 0, air: tag.air });
    c.restore();
    if (tag.t < DASH) {
      const edge = behind < 0 ? cam - 20 : cam + VIEW_W + 20, e = tag.t / DASH;
      dash = (edge - hx) * (1 - e) * (1 - e);
      c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = 1;
      c.beginPath();
      for (let i = 0; i < 3; i++) { const ly = h.y + 3 + i * (h.h / 3), lx = hx + dash + behind * 8; c.moveTo(lx, ly); c.lineTo(lx + behind * (14 + i * 6), ly); }
      c.stroke();
    } else if (tag.t < DASH + 0.6) {
      // Boop: a heart floats up from where their noses met.
      const b = (tag.t - DASH) / 0.6, bx = tag.x + tag.face * 5, by = h.y + h.h * 0.35 - b * 14;
      c.save(); c.globalAlpha = 1 - b;
      heart(c, bx, by, 3 + b * 1.5);
      for (let i = 0; i < 4; i++) star(c, bx + Math.cos(i * 1.57 + 0.8) * (4 + b * 10), by + 4 + Math.sin(i * 1.57 + 0.8) * (4 + b * 10), 1.6, '#fff4c8', b * 3);
      c.restore();
    }
  }
  const blink = Math.sin(time * 1.3) > 0.97;
  const flicker = h.hurt > 0 && Math.floor(h.hurt * 16) % 2 === 0;
  if (!flicker) {
    if (g.state === 'dying') {
      c.save(); c.translate(hx, h.y + h.h / 2); c.rotate(Math.min(g.stateT * 6, Math.PI));
      chinchilla(c, g.heroId, 0, h.h / 2, { face: h.face, h: h.h, time, air: true, dizzy: true });
      c.restore();
    } else chinchilla(c, g.heroId, hx + dash, h.y + h.h, { face: h.face, h: h.h, time, run: h.run, moving: Math.abs(h.vx) > 8 || dash !== 0, air: !h.ground, power: h.power, blink });
  }
  for (const f of g.fx) effect(c, f, theme);
  c.restore();
  hud(c, g, time);
}

function heart(c: CanvasRenderingContext2D, x: number, y: number, s: number) {
  c.fillStyle = '#ff7a9a';
  c.beginPath(); c.moveTo(x, y + s * 0.9);
  c.bezierCurveTo(x - s * 1.6, y - s * 0.1, x - s * 0.8, y - s * 1.3, x, y - s * 0.4);
  c.bezierCurveTo(x + s * 0.8, y - s * 1.3, x + s * 1.6, y - s * 0.1, x, y + s * 0.9); c.fill();
  dot(c, x - s * 0.5, y - s * 0.5, s * 0.22, '#ffd1dc');
}

function effect(c: CanvasRenderingContext2D, f: Fx, theme: ThemeId) {
  const { kind, x, y, age } = f, a = Math.max(0, 1 - age / 0.7);
  c.save(); c.globalAlpha = a;
  if (kind === 'brick') {
    for (const [i, [dx, dy]] of [[-1, -1], [1, -1], [-1, 0.2], [1, 0.2]].entries()) {
      const px = x + dx * (6 + age * 60), py = y + dy * 10 - age * 80 + age * age * 500;
      c.save(); c.translate(px, py); c.rotate(age * 12 * (i % 2 ? 1 : -1));
      rect(c, -3, -2.5, 6, 5, '#c97b4d'); rect(c, -3, -2.5, 6, 1.2, '#e8a57a'); rect(c, -3, 1.3, 6, 1.2, '#a55e37');
      c.restore();
    }
  } else if (kind === 'raisin') {
    raisin(c, x, y - 10 - age * 40);
    star(c, x + 5, y - 16 - age * 40, 2 * a, '#fff4c8', age * 6);
  } else if (kind === 'sparkle') {
    for (let i = 0; i < 5; i++) { const ang = (i / 5) * Math.PI * 2 + age * 3, d = 3 + age * 22; star(c, x + Math.cos(ang) * d, y + Math.sin(ang) * d, 2.2 * a + 0.5, i % 2 ? '#ffe08f' : '#ffffff', age * 8); }
    c.globalAlpha = a * 0.6; dot(c, x, y, 6 * (1 - a) + 2, '#fff4c8');
  } else if (kind === 'dust') {
    const tint = theme === 'cave' ? 'rgba(170, 150, 200, 0.7)' : theme === 'meadow' ? 'rgba(225, 205, 175, 0.8)' : 'rgba(255, 255, 255, 0.85)';
    c.fillStyle = tint;
    for (const i of [-1, 0, 1]) { ellipse(c, x + i * (2 + age * 16), y - 1.5 - age * 7 - (i === 0 ? 1 : 0), 1.2 + age * 5, 1 + age * 4); c.fill(); }
  } else if (kind === 'stomp') {
    c.strokeStyle = '#ffffff'; c.lineWidth = 1.2; c.beginPath();
    for (let i = 0; i < 8; i++) { const ang = (i / 8) * Math.PI * 2, r0 = 3 + age * 18, r1 = r0 + 4 * a; c.moveTo(x + Math.cos(ang) * r0, y - 3 + Math.sin(ang) * r0 * 0.6); c.lineTo(x + Math.cos(ang) * r1, y - 3 + Math.sin(ang) * r1 * 0.6); }
    c.stroke();
    star(c, x, y - 4, 5 * a, '#fff4c8', age * 4);
  } else if (kind === 'poof') {
    c.fillStyle = '#ffd6e0';
    for (let i = 0; i < 7; i++) { const ang = (i / 7) * Math.PI * 2; ellipse(c, x + Math.cos(ang) * age * 30, y - 4 + Math.sin(ang) * age * 16, 3 * a + 1, 3 * a + 1); c.fill(); }
  } else if (kind === 'grow') {
    c.strokeStyle = '#7fd07f'; c.lineWidth = 2; ellipse(c, x, y, age * 40, age * 40); c.stroke();
    c.strokeStyle = '#c9f2c0'; c.lineWidth = 1; ellipse(c, x, y, age * 26, age * 26); c.stroke();
    for (let i = 0; i < 6; i++) { const ang = (i / 6) * Math.PI * 2 + age * 4; star(c, x + Math.cos(ang) * age * 34, y + Math.sin(ang) * age * 34, 2, '#e8ffd8', age * 6); }
  }
  c.restore();
}

const fmt = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
function hud(c: CanvasRenderingContext2D, g: FluffForgeGame, time: number) {
  const text = (s: string, x: number, y: number, align: CanvasTextAlign = 'left', color = '#ffffff') => {
    c.textAlign = align; c.fillStyle = 'rgba(20,14,24,.75)'; c.fillText(s, x + 1, y + 1); c.fillStyle = color; c.fillText(s, x, y);
  };
  const pill = (x: number, w: number) => {
    c.fillStyle = 'rgba(24, 16, 34, 0.55)'; c.beginPath(); c.roundRect(x, 4, w, 22, 11); c.fill();
    c.strokeStyle = 'rgba(255, 255, 255, 0.22)'; c.lineWidth = 1; c.stroke();
  };
  c.font = 'bold 10px ui-monospace, monospace'; c.textBaseline = 'middle';
  // Portrait of whoever's playing, then their name and any power-up.
  const powerW = g.hero.power === 'small' ? 0 : 14;
  pill(4, 74 + powerW);
  c.save();
  c.beginPath(); c.arc(15, 15, 9, 0, Math.PI * 2);
  c.fillStyle = g.heroId === 'dora' ? '#f6b89a' : '#8fb4e0'; c.fill();
  c.clip();
  chinchilla(c, g.heroId, 10, 25, { face: 1, h: 18, time });
  c.restore();
  c.strokeStyle = '#ffffff'; c.lineWidth = 1.2; c.beginPath(); c.arc(15, 15, 9, 0, Math.PI * 2); c.stroke();
  text(HEROES[g.heroId].name.toUpperCase(), 29, 15.5);
  if (g.hero.power !== 'small') { c.save(); c.translate(72, 15); c.scale(0.55, 0.55); (g.hero.power === 'clover' ? clover : feather)(c, 0, 0); c.restore(); }
  const rx = 84 + powerW;
  pill(rx, 50);
  raisin(c, rx + 12, 15.5);
  text(`× ${g.raisins}`, rx + 20, 15.5);
  // Clock.
  const low = g.clock < 30;
  pill(VIEW_W - 66, 62);
  dot(c, VIEW_W - 54, 15, 5.5, low ? '#ffb4a0' : '#ffffff'); dot(c, VIEW_W - 54, 15, 4.3, '#2c2330');
  line(c, [VIEW_W - 54, 15, VIEW_W - 54, 12], '#ffffff', 1);
  line(c, [VIEW_W - 54, 15, VIEW_W - 54 + Math.cos(time * 2) * 2.6, 15 + Math.sin(time * 2) * 2.6], low ? '#ffb4a0' : '#ffe08f', 0.8);
  text(String(Math.max(0, Math.ceil(g.clock))), VIEW_W - 12, 15.5, 'right', low ? '#ffb4a0' : '#ffffff');
  if (g.deaths) { pill(VIEW_W - 134, 62); text(`TRIES ${g.deaths + 1}`, VIEW_W - 103, 15.5, 'center'); }
  if (g.state === 'dying' && g.stateT > 0.2) {
    c.font = 'bold 16px ui-monospace, monospace';
    text(g.cause === 'Time up' ? 'TIME UP!' : 'OOPS!', VIEW_W / 2, VIEW_H / 2 - 20, 'center', '#ffe08f');
  }
  // The page shows its own results panel after 1.6 s, so the banner steps aside for it.
  if (g.state === 'clear' && g.result && g.stateT < 1.6) {
    for (let i = 0; i < 24; i++) {
      const fx = hash(i, 41) * VIEW_W, fy = (hash(i, 42) * -60 + g.stateT * (60 + hash(i, 43) * 50)) % (VIEW_H + 20);
      c.save(); c.translate(fx + Math.sin(g.stateT * 4 + i) * 6, fy); c.rotate(g.stateT * 5 + i);
      rect(c, -1.5, -1, 3, 2, ['#e84f6a', '#ffe08f', '#7fd07f', '#8fb4e0', '#f6b89a'][i % 5]);
      c.restore();
    }
    c.font = 'bold 18px ui-monospace, monospace';
    text('COURSE CLEAR!', VIEW_W / 2, VIEW_H / 2 - 28, 'center', '#ffe08f');
    c.font = 'bold 10px ui-monospace, monospace';
    text(`${fmt(g.result.time)} · ${g.result.raisins} raisins`, VIEW_W / 2, VIEW_H / 2 - 8, 'center');
  }
}

/** A palette icon: the part drawn on its own, centred in a TILE × TILE box. */
export function drawIcon(c: CanvasRenderingContext2D, ch: string, theme: ThemeId, time: number) {
  const at: TileAt = () => '.';
  c.save();
  if (ch === 'G') {
    rect(c, 3, 1, 1.5, 15, '#e9e4dc'); rect(c, 1, 14, 6, 2, '#6d6a72');
    c.fillStyle = '#e84f6a'; c.beginPath(); c.moveTo(4.5, 1.5); c.lineTo(15, 4.5); c.lineTo(4.5, 8); c.fill();
    c.restore(); return;
  }
  if (ch === 'M') { cloudLedge(c, -2, 4, 20, theme === 'cave'); c.restore(); return; }
  if (ch === 'P') { c.translate(0, 1); flag(c, -2, TILE - 1, true, time); c.restore(); return; }
  if (ch === '.') { c.strokeStyle = '#e84f6a'; c.lineWidth = 2; c.beginPath(); c.moveTo(3, 3); c.lineTo(13, 13); c.moveTo(13, 3); c.lineTo(3, 13); c.stroke(); c.restore(); return; }
  drawTile(c, ch, 0, 0, theme, time, at, { editor: true });
  c.restore();
}
