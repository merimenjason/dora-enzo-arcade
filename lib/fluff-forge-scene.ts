// Canvas 2D drawing for Fluff Forge: the four themes, every part, the chinchillas and the HUD.
// Everything is drawn in course pixels (TILE = 16); the page scales the canvas up.
import { TILE, ROWS, VIEW_W, VIEW_H, index, HEROES, type Course, type ThemeId, type HeroId, type Power, type Enemy, type FluffForgeGame } from './fluff-forge-game';

type Palette = { sky: [string, string]; far: string; near: string; top: string; dirt: string; dirtDark: string; stone: string; stoneDark: string; ink: string; hud: string };
export const PALETTES: Record<ThemeId, Palette> = {
  meadow: { sky: ['#8fcdf0', '#e9f5df'], far: '#9db3c9', near: '#86b27a', top: '#72b653', dirt: '#b47a4b', dirtDark: '#8d5a35', stone: '#a39c92', stoneDark: '#7b746c', ink: '#3a2e2a', hud: '#2c2320' },
  salt: { sky: ['#f5b99a', '#c5e6f6'], far: '#c49aa8', near: '#e3d3c4', top: '#f7f4ec', dirt: '#d9ccb8', dirtDark: '#b7a78f', stone: '#b3a2a0', stoneDark: '#8c7b7a', ink: '#3b2d33', hud: '#3b2d33' },
  cave: { sky: ['#140f22', '#2d2345'], far: '#241c38', near: '#2f2548', top: '#6a8f62', dirt: '#5a4a6e', dirtDark: '#3e3250', stone: '#6c6384', stoneDark: '#4a4262', ink: '#0f0b18', hud: '#f3ecff' },
  snow: { sky: ['#a9c9ec', '#eef4fb'], far: '#c2d2e6', near: '#dbe6f2', top: '#fbfdff', dirt: '#8d9db3', dirtDark: '#6d7c92', stone: '#9aa6b6', stoneDark: '#737f90', ink: '#28303e', hud: '#28303e' },
};
type Coat = { fur: string; shade: string; belly: string; tail: string; texture: string; foot: string; earIn: string; vein: string; line: string; whisker: string; whiskerLight: string };
// Dora is a white chinchilla with a cream-tipped tail; Enzo is standard grey: darker back, white belly.
const COATS: Record<HeroId, Coat> = {
  dora: { fur: '#f7f2ea', shade: '#dcd1c1', belly: '#fffdf8', tail: '#e9dfd0', texture: '#d8ccbb', foot: '#f3d9d2', earIn: '#f0b4ad', vein: '#d98a88', line: '#5a4c4a', whisker: '#8d8378', whiskerLight: '#ffffff' },
  enzo: { fur: '#9896a2', shade: '#6c6a77', belly: '#e4e1e8', tail: '#55535f', texture: '#7c7a87', foot: '#cdb3b3', earIn: '#d6a09e', vein: '#b67a7c', line: '#2e2b35', whisker: '#25222b', whiskerLight: '#e8e6ec' },
};

const ellipse = (c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, rot = 0) => { c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2); };
const rect = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string) => { c.fillStyle = fill; c.fillRect(x, y, w, h); };
/** A cheap per-cell hash so textures don't shimmer as the camera moves. */
const hash = (a: number, b: number) => { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

// ---------- Backdrop ----------

export function drawBackdrop(c: CanvasRenderingContext2D, theme: ThemeId, cam: number, time: number) {
  const p = PALETTES[theme];
  const sky = c.createLinearGradient(0, 0, 0, VIEW_H);
  sky.addColorStop(0, p.sky[0]); sky.addColorStop(1, p.sky[1]);
  c.fillStyle = sky; c.fillRect(0, 0, VIEW_W, VIEW_H);
  if (theme === 'cave') {
    for (let i = 0; i < 40; i++) {
      const x = ((hash(i, 3) * 1600 - cam * 0.2) % 1600 + 1600) % 1600 - 100, y = hash(i, 7) * VIEW_H;
      c.globalAlpha = 0.35 + 0.35 * Math.sin(time * 2 + i);
      rect(c, Math.round(x), Math.round(y), 1.5, 1.5, i % 3 ? '#9d8cff' : '#6fe0d0');
    }
    c.globalAlpha = 1;
    mountains(c, cam * 0.25, 150, 70, p.far, 3);
    mountains(c, cam * 0.5, 185, 50, p.near, 9);
    return;
  }
  if (theme === 'salt' || theme === 'meadow') {
    c.fillStyle = theme === 'salt' ? '#fff3d6' : '#fff8d8';
    ellipse(c, 320 - cam * 0.02, 44, 16, 16); c.fill();
  }
  for (let i = 0; i < 6; i++) {
    const x = ((i * 190 - cam * 0.15 + time * 4) % 1140 + 1140) % 1140 - 120, y = 26 + (i % 3) * 22;
    c.fillStyle = theme === 'salt' ? '#fff5ee' : '#ffffff';
    c.globalAlpha = 0.85;
    ellipse(c, x, y, 22, 7); c.fill(); ellipse(c, x + 12, y - 4, 13, 7); c.fill(); ellipse(c, x - 10, y - 2, 10, 5); c.fill();
  }
  c.globalAlpha = 1;
  mountains(c, cam * 0.2, 130, 95, p.far, 1, theme !== 'salt');
  mountains(c, cam * 0.45, 175, 55, p.near, 5);
  if (theme === 'salt') { rect(c, 0, 196, VIEW_W, 44, '#ece4d6'); c.globalAlpha = 0.5; rect(c, 0, 196, VIEW_W, 2, '#ffffff'); c.globalAlpha = 1; }
  if (theme === 'snow') {
    c.fillStyle = '#ffffff';
    for (let i = 0; i < 50; i++) {
      const x = ((hash(i, 1) * 460 + Math.sin(time + i) * 10 - cam * 0.6) % 460 + 460) % 460 - 30;
      const y = ((hash(i, 2) * 260 + time * (14 + hash(i, 5) * 16)) % 260) - 10;
      c.fillRect(Math.round(x), Math.round(y), 1.5, 1.5);
    }
  }
}

function mountains(c: CanvasRenderingContext2D, off: number, base: number, height: number, color: string, seed: number, caps = false) {
  const span = 90;
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(0, VIEW_H);
  const first = Math.floor(off / span) - 1;
  for (let i = first; i <= first + VIEW_W / span + 2; i++) {
    const x = i * span - off, h = height * (0.55 + hash(i, seed) * 0.45);
    c.lineTo(x, base - h);
    c.lineTo(x + span / 2, base - h * 0.35);
  }
  c.lineTo(VIEW_W, VIEW_H);
  c.fill();
  if (!caps) return;
  c.fillStyle = '#ffffff';
  for (let i = first; i <= first + VIEW_W / span + 2; i++) {
    const x = i * span - off, h = height * (0.55 + hash(i, seed) * 0.45);
    c.beginPath(); c.moveTo(x, base - h); c.lineTo(x + 11, base - h + 12); c.lineTo(x + 4, base - h + 10); c.lineTo(x - 2, base - h + 14); c.lineTo(x - 9, base - h + 11); c.fill();
  }
}

// ---------- Tiles ----------

type TileAt = (c: number, r: number) => string;
const EARTH = new Set(['#', 'I']);

/** One tile. `at` looks up neighbours so ground knows where its grassy top is. */
export function drawTile(c: CanvasRenderingContext2D, ch: string, col: number, row: number, theme: ThemeId, time: number, at: TileAt, opts: { editor?: boolean; bump?: number; spring?: number } = {}) {
  const p = PALETTES[theme];
  const x = col * TILE, y = row * TILE - (opts.bump ? Math.sin((opts.bump / 0.15) * Math.PI) * 4 : 0);
  switch (ch) {
    case '#': case 'I': {
      const open = !EARTH.has(at(col, row - 1)) && at(col, row - 1) !== 'H';
      rect(c, x, y, TILE, TILE, p.dirt);
      const n = hash(col, row);
      rect(c, x + 3 + n * 8, y + 7 + n * 5, 2, 2, p.dirtDark); rect(c, x + 10 - n * 6, y + 11, 2, 1.5, p.dirtDark);
      if (ch === 'I') {
        if (open) { rect(c, x, y, TILE, 6, '#bfe9f7'); rect(c, x, y, TILE, 1.5, '#f2fcff'); rect(c, x + 3, y + 2, 5, 1, '#ffffff'); }
      } else if (open) {
        rect(c, x, y, TILE, 4, p.top);
        rect(c, x, y + 4, TILE, 1, p.dirtDark);
        if (theme === 'meadow' || theme === 'cave') for (let i = 0; i < 3; i++) rect(c, x + 2 + i * 5 + n * 2, y - 2, 1, 2, p.top);
        if (theme === 'snow') { rect(c, x, y + 4, TILE, 2, p.top); rect(c, x + 4 + n * 6, y + 6, 3, 2, p.top); }
      }
      break;
    }
    case 'H': {
      rect(c, x, y, TILE, TILE, p.stone);
      rect(c, x, y + TILE - 2, TILE, 2, p.stoneDark); rect(c, x + TILE - 2, y, 2, TILE, p.stoneDark);
      rect(c, x, y, TILE, 1.5, 'rgba(255,255,255,.25)'); rect(c, x, y, 1.5, TILE, 'rgba(255,255,255,.18)');
      if (theme === 'snow' && at(col, row - 1) !== 'H') rect(c, x, y, TILE, 3, '#fbfdff');
      break;
    }
    case 'B': {
      rect(c, x, y, TILE, TILE, '#c97b4d');
      c.fillStyle = '#8f4f2c';
      c.fillRect(x, y + 7, TILE, 1.5); c.fillRect(x, y + 15, TILE, 1);
      c.fillRect(x + 7, y, 1.5, 7); c.fillRect(x + 3, y + 8, 1.5, 7); c.fillRect(x + 12, y + 8, 1.5, 7);
      rect(c, x, y, TILE, 1.5, '#e8a57a');
      break;
    }
    case '?': case 'C': case 'F': {
      const shine = 0.5 + 0.5 * Math.sin(time * 4 + col);
      rect(c, x, y, TILE, TILE, '#b7791f');
      rect(c, x + 1, y + 1, TILE - 2, TILE - 2, '#f2c14e');
      rect(c, x + 1, y + 1, TILE - 2, 2, '#ffe08f');
      c.fillStyle = `rgba(122,62,20,${0.75 + shine * 0.25})`;
      c.font = 'bold 11px ui-monospace, monospace'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('?', x + 8, y + 9);
      [[2, 2], [13, 2], [2, 13], [13, 13]].forEach(([dx, dy]) => rect(c, x + dx, y + dy, 1.2, 1.2, '#7a3e14'));
      if (opts.editor && ch !== '?') {
        c.save(); c.translate(x + 12, y + 3); c.scale(0.45, 0.45);
        (ch === 'C' ? clover : feather)(c, 0, 0);
        c.restore();
      }
      break;
    }
    case 'U': {
      rect(c, x, y, TILE, TILE, '#6b4a2f'); rect(c, x + 1, y + 1, TILE - 2, TILE - 2, '#a37a54');
      [[2, 2], [13, 2], [2, 13], [13, 13]].forEach(([dx, dy]) => rect(c, x + dx, y + dy, 1.2, 1.2, '#6b4a2f'));
      break;
    }
    case '=': cloudLedge(c, x, y, TILE, theme === 'cave'); break;
    case '^': {
      rect(c, x, y + 11, TILE, 5, '#6d8f4a');
      c.fillStyle = '#4f7a34';
      for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(x + 1 + i * 5, y + 12); c.lineTo(x + 3.5 + i * 5, y + 1); c.lineTo(x + 6 + i * 5, y + 12); c.fill(); }
      c.fillStyle = '#f4f1dc';
      for (let i = 0; i < 3; i++) c.fillRect(x + 3 + i * 5, y + 1, 1, 2);
      break;
    }
    case 'o': {
      const bob = Math.sin(time * 3 + col * 0.7) * 1.2;
      raisin(c, x + 8, y + 8 + bob);
      break;
    }
    case 'S': {
      const squash = opts.spring ? 4 : 0;
      rect(c, x + 2, y + 13, 12, 3, '#5a5f6e');
      c.strokeStyle = '#d64b3a'; c.lineWidth = 1.6;
      c.beginPath();
      for (let i = 0; i <= 4; i++) c.lineTo(x + (i % 2 ? 12 : 4), y + 13 - i * ((8 - squash) / 4));
      c.stroke();
      rect(c, x + 1, y + 3 + squash, 14, 3, '#e8e2d6'); rect(c, x + 1, y + 5 + squash, 14, 1, '#9b958a');
      break;
    }
    default: if (opts.editor) drawMarker(c, ch, x, y, time, theme);
  }
}

function raisin(c: CanvasRenderingContext2D, x: number, y: number) {
  c.fillStyle = '#4b2748'; ellipse(c, x, y, 4.5, 5.5); c.fill();
  c.fillStyle = '#6c3a66'; ellipse(c, x - 1, y - 1, 2.5, 3.5); c.fill();
  c.strokeStyle = '#2e1530'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(x - 3, y + 1); c.quadraticCurveTo(x, y + 3, x + 3, y); c.stroke();
  rect(c, x - 2, y - 3.5, 1.5, 1.5, '#c9a6d6');
}
function cloudLedge(c: CanvasRenderingContext2D, x: number, y: number, w: number, dark: boolean) {
  c.fillStyle = dark ? '#9d93c4' : '#ffffff';
  ellipse(c, x + w / 2, y + 5, w / 2 + 1, 4.5); c.fill();
  for (let i = 0; i < w / 8; i++) { ellipse(c, x + 4 + i * 8, y + 3, 4.5, 3.5); c.fill(); }
  c.fillStyle = dark ? '#6f6699' : '#d6e6f2';
  rect(c, x + 1, y + 8, w - 2, 1.5, c.fillStyle as string);
}
function clover(c: CanvasRenderingContext2D, x: number, y: number) {
  c.fillStyle = '#3f9a45';
  for (let i = 0; i < 4; i++) { const a = (i * Math.PI) / 2 + Math.PI / 4; ellipse(c, x + Math.cos(a) * 4, y + Math.sin(a) * 4, 3.6, 3.6); c.fill(); }
  c.fillStyle = '#7fd07f'; ellipse(c, x - 1.5, y - 1.5, 1.6, 1.6); c.fill();
  c.strokeStyle = '#2d6e31'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 2, y + 6, x + 1, y + 8); c.stroke();
}
function feather(c: CanvasRenderingContext2D, x: number, y: number) {
  c.save(); c.translate(x, y); c.rotate(-0.6);
  c.fillStyle = '#2b2733'; ellipse(c, 0, 0, 3.4, 8); c.fill();
  c.fillStyle = '#f4efe6'; ellipse(c, 0, -5, 2.6, 3.2); c.fill();
  c.strokeStyle = '#c9c1b4'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(0, -8); c.lineTo(0, 9); c.stroke();
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

function flag(c: CanvasRenderingContext2D, x: number, base: number, taken: boolean, time: number) {
  rect(c, x + 7, base - 30, 2, 30, '#6d6a72');
  rect(c, x + 5, base - 2, 6, 2, '#4a4750');
  const wave = Math.sin(time * 5) * 1.5;
  c.fillStyle = taken ? '#e86a4f' : '#b9b4c0';
  c.beginPath(); c.moveTo(x + 9, base - 30); c.lineTo(x + 20, base - 26 + wave); c.lineTo(x + 9, base - 21); c.fill();
}
function goal(c: CanvasRenderingContext2D, x: number, base: number, time: number) {
  const top = base - 8 * TILE;
  rect(c, x + 7, top, 2.5, base - top, '#e9e4dc');
  rect(c, x + 7, top, 1, base - top, '#ffffff');
  c.fillStyle = '#f2c14e'; ellipse(c, x + 8.2, top - 2, 3.5, 3.5); c.fill();
  rect(c, x + 3, base - 4, 10, 4, '#6d6a72');
  const wave = Math.sin(time * 4) * 2;
  c.fillStyle = '#e84f6a';
  c.beginPath(); c.moveTo(x + 9.5, top + 2); c.quadraticCurveTo(x + 18, top + 4 + wave, x + 28, top + 3 + wave); c.lineTo(x + 28, top + 17 + wave); c.quadraticCurveTo(x + 18, top + 18 + wave, x + 9.5, top + 16); c.fill();
  // A paw print on the flag.
  c.fillStyle = '#fff1e8';
  ellipse(c, x + 19, top + 11 + wave, 3, 2.5); c.fill();
  for (let i = 0; i < 3; i++) { ellipse(c, x + 16 + i * 3, top + 7 + wave, 1.2, 1.4); c.fill(); }
}

// ---------- Characters ----------

export type ChinOpts = { face: 1 | -1; h: number; time: number; run?: number; moving?: boolean; air?: boolean; power?: Power; blink?: boolean; dizzy?: boolean };

/** Dora or Enzo, feet at (x, base), `h` pixels tall. Drawn in a 24-unit-tall frame facing right. */
export function chinchilla(c: CanvasRenderingContext2D, id: HeroId, x: number, base: number, o: ChinOpts) {
  const k = COATS[id], s = o.h / 24, t = o.time;
  c.save();
  c.translate(x, base);
  c.scale(o.face * s * 1.05, s);
  const moving = !!o.moving && !o.air;
  const stride = moving && o.run !== undefined ? Math.sin(o.run * 0.45) : 0;
  const breathe = !moving && !o.air ? Math.sin(t * 3) * 0.35 : 0;
  const bob = o.air ? -1 : Math.abs(stride) * -1.2 + breathe;
  const lean = o.air ? -0.6 : moving ? 0.8 : 0;
  // One outline around several shapes: stroke them all thick, then fill them all over the top.
  const blob = (parts: (() => void)[], fill: string | CanvasGradient, width = 1.8) => {
    c.lineWidth = width; c.strokeStyle = k.line; c.lineJoin = 'round';
    for (const p of parts) { p(); c.stroke(); }
    c.fillStyle = fill;
    for (const p of parts) { p(); c.fill(); }
  };
  const oval = (ex: number, ey: number, rx: number, ry: number, rot = 0) => () => ellipse(c, ex, ey, rx, ry, rot);

  // Soft shadow on the ground.
  if (!o.air) { c.fillStyle = 'rgba(20, 12, 30, 0.22)'; ellipse(c, 0.5, -0.2, 10, 1.6); c.fill(); }

  // Tail: a bushy curl behind the back, bristly and darker along the top.
  const wag = Math.sin(t * (moving ? 9 : 2.2)) * (moving ? 1.2 : 0.6);
  const tail: [number, number, number][] = [[-7.5, -5, 3.2], [-10.6, -8.8 + bob * 0.5, 3.4], [-12 + wag * 0.4, -13 + bob, 3.3], [-10.8 + wag, -17 + bob, 2.8]];
  blob(tail.map(([tx, ty, r]) => oval(tx, ty, r, r * 1.05)), k.shade);
  c.strokeStyle = k.line; c.lineWidth = 0.45;
  c.beginPath();
  for (const [tx, ty, r] of tail.slice(1)) for (let a = -0.6; a <= 1.2; a += 0.6) {
    const ang = Math.PI + a; c.moveTo(tx + Math.cos(ang) * r * 0.8, ty + Math.sin(ang) * r * 0.8); c.lineTo(tx + Math.cos(ang) * (r + 1.3), ty + Math.sin(ang) * (r + 1.3));
  }
  c.stroke();
  c.fillStyle = k.tail; for (const [tx, ty, r] of tail.slice(1)) { ellipse(c, tx - 0.6, ty - 0.4, r * 0.55, r * 0.6); c.fill(); }

  // Far ear and far hind foot sit behind everything else.
  const sweep = o.air ? -0.45 : moving ? -0.25 : 0;
  const ears = (dx: number, rx: number, ry: number, rot: number) => oval(dx + sweep * 2, -24.3 + bob, rx, ry, rot + sweep);
  blob([ears(1.2, 3.9, 5.4, -0.45)], k.shade);
  c.fillStyle = k.earIn; ellipse(c, 1.4 + sweep * 2, -24 + bob, 2.3, 3.7, -0.45 + sweep); c.fill();
  blob([oval(-4 - stride * 3, -1.3, 3.2, 1.4)], k.shade, 1.4);

  // Body, haunch, head and cheek fluff share one outline.
  const coat = c.createLinearGradient(0, -24 + bob, 0, 0);
  coat.addColorStop(0, k.fur); coat.addColorStop(0.55, k.fur); coat.addColorStop(1, k.shade);
  const cheeks = () => {
    c.beginPath(); c.moveTo(-0.5, -14 + bob);
    const tuft = [[0.4, -9.4], [1.6, -11], [2.8, -9], [4, -10.8], [5.4, -9.2], [6.4, -10.8]];
    for (const [px, py] of tuft) c.lineTo(px, py + bob);
    c.lineTo(8, -13 + bob); c.closePath();
  };
  const crown = () => { c.beginPath(); c.moveTo(1.5, -21.5 + bob); c.lineTo(2.6, -23.6 + bob); c.lineTo(3.6, -22 + bob); c.lineTo(4.8, -23.2 + bob); c.lineTo(5.6, -21.6 + bob); c.closePath(); };
  c.save(); c.translate(0, -4); c.rotate(lean * 0.12); c.translate(0, 4);
  blob([oval(-3, -5.5 + bob, 6.2, 5.4), oval(0, -8.5 + bob, 8.2, 7.6), cheeks, crown, oval(4.8, -16 + bob, 7, 6.4)], coat);

  // Belly, muzzle, and a few strokes of fur texture.
  c.fillStyle = k.belly;
  ellipse(c, 3.8, -6.8 + bob, 4.4, 5); c.fill();
  ellipse(c, 8.8, -13.6 + bob, 3.5, 2.7); c.fill();
  c.strokeStyle = k.texture; c.lineWidth = 0.5; c.beginPath();
  for (const [fx, fy] of [[-6, -9], [-3, -12.5], [-7.5, -5], [0.5, -14], [-1.5, -7]]) { c.moveTo(fx, fy + bob); c.quadraticCurveTo(fx + 1, fy - 1.2 + bob, fx + 2.2, fy - 0.6 + bob); }
  c.stroke();

  // Near hind foot with two toe lines, and the little front paws.
  const fx = 3.6 - stride * 3;
  blob([oval(fx, -1.4, 3.7, 1.6)], k.foot, 1.4);
  c.strokeStyle = k.line; c.lineWidth = 0.4; c.beginPath(); c.moveTo(fx + 2.4, -2.4); c.lineTo(fx + 2.4, -0.6); c.moveTo(fx + 1.2, -2.6); c.lineTo(fx + 1.2, -0.4); c.stroke();
  const paw = o.air ? [10.2, -10.5] : [8 + stride * 1.5, -5.2 + bob - Math.abs(stride) * 0.6];
  blob([oval(paw[0] - 1.8, paw[1] - 0.4, 1.4, 1.2), oval(paw[0], paw[1], 1.6, 1.3)], k.foot, 1.2);

  // Near ear: big and round, with a pink inside and a fine vein.
  blob([ears(5.4, 4.3, 5.9, 0.15)], k.fur);
  c.fillStyle = k.earIn; ellipse(c, 5.6 + sweep * 2, -23.8 + bob, 2.7, 4.2, 0.15 + sweep); c.fill();
  c.strokeStyle = k.vein; c.lineWidth = 0.35; c.beginPath();
  c.moveTo(5.4 + sweep * 2, -20.5 + bob); c.quadraticCurveTo(6.3 + sweep * 3, -24 + bob, 5.2 + sweep * 4, -27 + bob); c.stroke();

  // Face: eye, blush, nose, mouth, whiskers.
  const ey = -17.2 + bob;
  if (o.dizzy) {
    c.strokeStyle = '#16121a'; c.lineWidth = 0.7; c.beginPath();
    c.moveTo(6, ey - 1.3); c.lineTo(8.6, ey + 1.3); c.moveTo(8.6, ey - 1.3); c.lineTo(6, ey + 1.3); c.stroke();
  } else if (o.blink) {
    c.strokeStyle = '#16121a'; c.lineWidth = 0.7; c.beginPath(); c.arc(7.3, ey - 0.4, 1.7, 0.3, Math.PI - 0.3); c.stroke();
  } else {
    c.fillStyle = k.line; ellipse(c, 7.3, ey, 2.2, 2.5); c.fill();
    c.fillStyle = '#120e16'; ellipse(c, 7.4, ey, 1.8, 2.1); c.fill();
    c.fillStyle = '#ffffff'; ellipse(c, 8.1, ey - 1, 0.75, 0.8); c.fill();
    ellipse(c, 6.8, ey + 1, 0.35, 0.35); c.fill();
  }
  c.fillStyle = 'rgba(236, 132, 140, 0.35)'; ellipse(c, 6.6, -13.2 + bob, 1.7, 1); c.fill();
  const twitch = moving || o.air ? 0 : Math.max(0, Math.sin(t * 7)) * 0.3;
  c.fillStyle = '#d98a8c'; ellipse(c, 11.6, -14.4 + bob - twitch, 1.15, 0.85); c.fill();
  c.strokeStyle = k.line; c.lineWidth = 0.4; c.beginPath();
  c.moveTo(11.4, -13.6 + bob); c.lineTo(11.2, -12.8 + bob); c.quadraticCurveTo(10.6, -12.2 + bob, 10, -12.7 + bob); c.stroke();
  const whisk = Math.sin(t * 5) * 0.4;
  c.lineWidth = 0.35;
  for (const [i, [wx, wy]] of ([[17.2, -16.4], [17.8, -13.8], [16.8, -11.2]] as const).entries()) {
    c.strokeStyle = i === 1 ? k.whiskerLight : k.whisker;
    c.beginPath(); c.moveTo(10.6, -13.8 + bob); c.quadraticCurveTo(14, wy + bob + 0.4 - whisk * 0.5, wx, wy + bob + whisk); c.stroke();
  }
  c.restore();

  // Power-ups ride on the head.
  if (o.power === 'clover') { c.save(); c.translate(0, -29 + bob); c.scale(0.5, 0.5); clover(c, 0, 0); c.restore(); }
  if (o.power === 'feather') { c.save(); c.translate(-1, -28 + bob); c.scale(0.6, 0.6); feather(c, 0, 0); c.restore(); }
  c.restore();
}

function enemy(c: CanvasRenderingContext2D, kind: Enemy['kind'], x: number, y: number, w: number, h: number, dir: number, time: number, squashed: boolean) {
  const cx = x + w / 2, base = y + h;
  c.save();
  c.lineWidth = 1; c.strokeStyle = '#1d1a22';
  if (kind === 'beetle') {
    if (squashed) { c.fillStyle = '#2f5c3e'; ellipse(c, cx, base - 1.5, 8, 2); c.fill(); c.restore(); return; }
    const step = Math.sin(time * 14) * 1.2;
    rect(c, cx - 5 + step, base - 2, 2, 2, '#1d1a22'); rect(c, cx + 3 - step, base - 2, 2, 2, '#1d1a22');
    c.fillStyle = '#2f7a4c'; ellipse(c, cx, base - 5, 7, 5); c.fill(); c.stroke();
    c.fillStyle = '#5fbf7a'; ellipse(c, cx - 2, base - 7, 3, 1.6); c.fill();
    c.strokeStyle = '#1d1a22'; c.beginPath(); c.moveTo(cx, base - 10); c.lineTo(cx, base - 1); c.stroke();
    c.fillStyle = '#1d1a22'; ellipse(c, cx + dir * 6, base - 4, 2.6, 2.4); c.fill();
    rect(c, cx + dir * 7 - 0.5, base - 5, 1.2, 1.2, '#ffffff');
  } else if (kind === 'frog') {
    if (squashed) { c.fillStyle = '#4f9a3a'; ellipse(c, cx, base - 1.5, 8, 2); c.fill(); c.restore(); return; }
    c.fillStyle = '#5bb04a'; ellipse(c, cx, base - 5, 7, 5); c.fill(); c.stroke();
    c.fillStyle = '#d7efb0'; ellipse(c, cx + dir * 2, base - 3, 4, 2.4); c.fill();
    for (const ex of [-3, 3]) { c.fillStyle = '#5bb04a'; ellipse(c, cx + ex, base - 10, 2.6, 2.6); c.fill(); c.stroke(); rect(c, cx + ex - 0.5 + dir * 0.6, base - 11, 1.4, 1.8, '#1d1a22'); }
    rect(c, cx - 7, base - 1.5, 4, 1.5, '#3f8a31'); rect(c, cx + 3, base - 1.5, 4, 1.5, '#3f8a31');
  } else if (kind === 'bat') {
    if (squashed) { c.globalAlpha = 0.6; }
    const flap = Math.sin(time * 16) * 4;
    c.fillStyle = '#5b3f7a';
    for (const s of [-1, 1]) { c.beginPath(); c.moveTo(cx, base - 5); c.lineTo(cx + s * 8, base - 8 - flap); c.lineTo(cx + s * 6, base - 3); c.lineTo(cx + s * 3, base - 4); c.fill(); }
    c.fillStyle = '#7a58a0'; ellipse(c, cx, base - 5, 3.8, 4); c.fill(); c.stroke();
    rect(c, cx - 2, base - 10, 1.4, 2.5, '#7a58a0'); rect(c, cx + 0.8, base - 10, 1.4, 2.5, '#7a58a0');
    rect(c, cx - 1.6 + dir * 0.6, base - 6.5, 1.2, 1.2, '#ffe16a'); rect(c, cx + 0.6 + dir * 0.6, base - 6.5, 1.2, 1.2, '#ffe16a');
  } else {
    const sway = squashed ? 0 : Math.sin(time * 8) * 0.8;
    c.fillStyle = '#4f9a58'; c.beginPath(); c.roundRect(cx - 5 + sway, base - 13, 10, 13, 4); c.fill(); c.stroke();
    c.fillStyle = '#3c7d44'; rect(c, cx - 1 + sway, base - 12, 1.2, 11, '#3c7d44');
    c.fillStyle = '#f4f1dc';
    for (const [sx, sy] of [[-6, -10], [5, -9], [-6, -5], [5, -4], [0, -14]]) { c.beginPath(); c.moveTo(cx + sx + sway, base + sy); c.lineTo(cx + sx + (sx < 0 ? -2 : sx > 0 ? 2 : 0) + sway, base + sy - (sx === 0 ? 2 : 1)); c.lineTo(cx + sx + sway, base + sy + 1.4); c.fill(); }
    c.fillStyle = '#f07aa8'; ellipse(c, cx + 2 + sway, base - 13.5, 2.4, 1.8); c.fill();
    rect(c, cx - 2 + dir * 1.5 + sway, base - 9, 1.3, 1.8, '#1d1a22'); rect(c, cx + 1 + dir * 1.5 + sway, base - 9, 1.3, 1.8, '#1d1a22');
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
    if (it.kind === 'clover') clover(c, it.x + 6, it.y + 6 + Math.sin(it.t * 8) * 0.5);
    else feather(c, it.x + 6, it.y + 6);
  }
  for (const e of g.enemies) {
    if (!e.flip) enemy(c, e.kind, e.x, e.y, e.w, e.h, e.dir, g.t, e.dead > 0);
    else { c.save(); c.translate(e.x + e.w / 2, e.y + e.h / 2); c.scale(1, -1); enemy(c, e.kind, -e.w / 2, -e.h / 2, e.w, e.h, e.dir, g.t, false); c.restore(); }
  }
  const h = g.hero;
  const blink = Math.sin(time * 1.3) > 0.97;
  const flicker = h.hurt > 0 && Math.floor(h.hurt * 16) % 2 === 0;
  if (!flicker) {
    if (g.state === 'dying') {
      c.save(); c.translate(h.x + h.w / 2, h.y + h.h / 2); c.rotate(Math.min(g.stateT * 6, Math.PI));
      chinchilla(c, g.heroId, 0, h.h / 2, { face: h.face, h: h.h, time, air: true, dizzy: true });
      c.restore();
    } else chinchilla(c, g.heroId, h.x + h.w / 2, h.y + h.h, { face: h.face, h: h.h, time, run: h.run, moving: Math.abs(h.vx) > 8, air: !h.ground, power: h.power, blink });
  }
  for (const f of g.fx) effect(c, f.kind, f.x, f.y, f.age);
  c.restore();
  hud(c, g);
}

function effect(c: CanvasRenderingContext2D, kind: string, x: number, y: number, age: number) {
  const a = Math.max(0, 1 - age / 0.7);
  c.save(); c.globalAlpha = a;
  if (kind === 'brick') {
    for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 0.2], [1, 0.2]]) {
      const px = x + dx * (6 + age * 60), py = y + dy * 10 - age * 80 + age * age * 500;
      rect(c, px - 3, py - 3, 6, 6, '#c97b4d'); rect(c, px - 3, py - 3, 6, 1.5, '#e8a57a');
    }
  } else if (kind === 'raisin') {
    raisin(c, x, y - 10 - age * 40);
  } else if (kind === 'stomp' || kind === 'poof') {
    c.fillStyle = kind === 'poof' ? '#ffd6e0' : '#ffffff';
    for (let i = 0; i < 5; i++) { const ang = (i / 5) * Math.PI * 2; ellipse(c, x + Math.cos(ang) * age * 30, y - 4 + Math.sin(ang) * age * 16, 2.5, 2.5); c.fill(); }
  } else if (kind === 'grow') {
    c.strokeStyle = '#7fd07f'; c.lineWidth = 2; ellipse(c, x, y, age * 40, age * 40); c.stroke();
  }
  c.restore();
}

const fmt = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
function hud(c: CanvasRenderingContext2D, g: FluffForgeGame) {
  const text = (s: string, x: number, y: number, align: CanvasTextAlign = 'left', color = '#ffffff') => {
    c.textAlign = align; c.fillStyle = 'rgba(20,14,24,.75)'; c.fillText(s, x + 1, y + 1); c.fillStyle = color; c.fillText(s, x, y);
  };
  c.font = 'bold 10px ui-monospace, monospace'; c.textBaseline = 'top';
  const power = g.hero.power === 'clover' ? ' · clover' : g.hero.power === 'feather' ? ' · feather' : '';
  text(`${HEROES[g.heroId].name.toUpperCase()}${power}`, 8, 7);
  raisin(c, 136, 12);
  text(`× ${g.raisins}`, 144, 7);
  text(`TIME ${Math.max(0, Math.ceil(g.clock))}`, VIEW_W - 8, 7, 'right', g.clock < 30 ? '#ffb4a0' : '#ffffff');
  if (g.deaths) text(`TRIES ${g.deaths + 1}`, VIEW_W - 80, 7, 'right');
  if (g.state === 'dying' && g.stateT > 0.2) {
    c.font = 'bold 16px ui-monospace, monospace'; c.textBaseline = 'middle';
    text(g.cause === 'Time up' ? 'TIME UP!' : 'OOPS!', VIEW_W / 2, VIEW_H / 2 - 20, 'center', '#ffe08f');
  }
  // The page shows its own results panel after 1.6 s, so the banner steps aside for it.
  if (g.state === 'clear' && g.result && g.stateT < 1.6) {
    c.font = 'bold 18px ui-monospace, monospace'; c.textBaseline = 'middle';
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
