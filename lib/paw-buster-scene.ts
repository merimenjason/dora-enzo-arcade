// Canvas 2D art for Paw Buster X: flat pixel-style shapes, no image assets.
import { TILE, ROWS, VIEW_W, VIEW_H, WEAPONS, ENERGY, TAG_TIME, HEROES, REVIVE, GUARDIANS, T, bossInfo, isSolid, isPartItem, KEEPSAKE, type PawBusterGame, type StageId, type BossKind, type HeroId, type Enemy, type Shot, type Player, type Boss, type ItemKind } from './paw-buster-game';

type Theme = { sky: [string, string]; far: string; near: string; ground: string; dark: string; top: string; spike: string; accent: string };
export const THEMES: Record<StageId, Theme> = {
  snowcap: { sky: ['#7fa9dc', '#dcecff'], far: '#b9cde6', near: '#8aa3c4', ground: '#617391', dark: '#4a5874', top: '#f4f8ff', spike: '#bfe9ff', accent: '#ffffff' },
  cloud: { sky: ['#8cc6b0', '#e6f2d8'], far: '#8cb89a', near: '#5f8c6c', ground: '#5b4a3a', dark: '#453729', top: '#7fbf5a', spike: '#3b5a2c', accent: '#f3fbe8' },
  caldera: { sky: ['#2c1420', '#c8553a'], far: '#62302c', near: '#43201f', ground: '#3b2f33', dark: '#2a2125', top: '#ff8a3d', spike: '#ffb347', accent: '#ffd08a' },
  mines: { sky: ['#140f24', '#3a2c52'], far: '#2a2140', near: '#221a34', ground: '#4a3d5c', dark: '#3a2f4a', top: '#b48ad8', spike: '#e3a8ff', accent: '#e3a8ff' },
  salt: { sky: ['#6fb7ff', '#fff6e0'], far: '#c9b8d8', near: '#a89cc0', ground: '#d9d2c4', dark: '#c6bdac', top: '#ffffff', spike: '#9aa3b8', accent: '#fff27a' },
  lake: { sky: ['#4a8fb8', '#cfeef0'], far: '#5f9a8c', near: '#3f7a6a', ground: '#6b5a3c', dark: '#56482f', top: '#c9b36a', spike: '#2f5a4a', accent: '#8fe0ff' },
  citadel: { sky: ['#10152b', '#46507a'], far: '#2c3456', near: '#1f2542', ground: '#5c6378', dark: '#444a5c', top: '#c9ced9', spike: '#dfe3ea', accent: '#ffd46a' },
};
const rr = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => { c.beginPath(); c.roundRect(x, y, w, h, r); c.fill(); };
const circle = (c: CanvasRenderingContext2D, x: number, y: number, r: number) => { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); };
const ellipse = (c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) => { c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill(); };

function backdrop(c: CanvasRenderingContext2D, id: StageId, cam: number, time: number) {
  const t = THEMES[id], sky = c.createLinearGradient(0, 0, 0, VIEW_H);
  sky.addColorStop(0, t.sky[0]);
  sky.addColorStop(1, t.sky[1]);
  c.fillStyle = sky;
  c.fillRect(0, 0, VIEW_W, VIEW_H);
  // Far and near silhouettes scroll at different speeds.
  for (const [layer, speed, base, amp, color] of [[0, 0.15, 300, 110, t.far], [1, 0.35, 380, 80, t.near]] as const) {
    c.fillStyle = color;
    c.beginPath();
    c.moveTo(0, VIEW_H);
    const off = cam * speed;
    for (let x = -40; x <= VIEW_W + 40; x += 40) {
      const k = (x + off) / (layer ? 90 : 160);
      const y = id === 'citadel' ? base - (Math.floor(k) % 3 === 0 ? amp : amp * 0.35) : base - Math.abs(Math.sin(k) * amp) - Math.sin(k * 2.7) * 18;
      c.lineTo(x, y);
    }
    c.lineTo(VIEW_W, VIEW_H);
    c.fill();
  }
  if (id === 'snowcap') { c.fillStyle = '#ffffffaa'; for (let i = 0; i < 40; i++) { const x = ((i * 137 + time * 30) % (VIEW_W + 40)) - 20, y = (i * 71 + time * (40 + (i % 5) * 9)) % VIEW_H; circle(c, x, y, 1.5 + (i % 3)); } }
  if (id === 'cloud') { c.fillStyle = '#ffffff55'; for (let i = 0; i < 5; i++) { const x = ((i * 260 - cam * 0.25 + time * 12) % (VIEW_W + 300)) - 150; ellipse(c, x, 90 + (i % 3) * 50, 120, 22); } }
  if (id === 'caldera') { c.fillStyle = '#ffb34799'; for (let i = 0; i < 26; i++) { const x = (i * 97 - cam * 0.5) % VIEW_W, y = VIEW_H - ((i * 53 + time * 50) % VIEW_H); circle(c, (x + VIEW_W) % VIEW_W, y, 1.5); } }
  if (id === 'mines') { for (let i = 0; i < 18; i++) { const x = ((i * 173 - cam * 0.3) % (VIEW_W + 60) + VIEW_W + 60) % (VIEW_W + 60) - 30, y = 120 + (i * 83) % 300; c.fillStyle = (i + Math.floor(time * 3)) % 5 ? '#b48ad866' : '#f3dcffcc'; c.beginPath(); c.moveTo(x, y - 12); c.lineTo(x + 6, y); c.lineTo(x, y + 12); c.lineTo(x - 6, y); c.fill(); } }
  if (id === 'salt') { c.fillStyle = '#fff8d8'; circle(c, 800, 80, 40); c.fillStyle = '#ffffff44'; for (let i = 0; i < 6; i++) c.fillRect(0, 430 + i * 14 + Math.sin(time * 3 + i) * 3, VIEW_W, 2); }
  if (id === 'lake') {
    c.fillStyle = '#ffffff55';
    for (let i = 0; i < 3; i++) { const x = ((i * 380 - cam * 0.35) % (VIEW_W + 200) + VIEW_W + 200) % (VIEW_W + 200) - 100; c.fillRect(x, 200, 26, 200); for (let j = 0; j < 6; j++) c.fillRect(x + 4, 200 + ((j * 40 + time * 120) % 200), 18, 6); }
    // The lake fills the bottom of every pit.
    c.fillStyle = '#2f7fb8cc'; c.fillRect(0, VIEW_H - 22, VIEW_W, 22);
    c.fillStyle = '#bfefff99'; for (let x = -((cam * 0.9 + time * 30) % 40); x < VIEW_W; x += 40) c.fillRect(x, VIEW_H - 22, 18, 3);
  }
  if (id === 'citadel') { c.fillStyle = '#fff6'; for (let i = 0; i < 50; i++) circle(c, (i * 191) % VIEW_W, (i * 67) % 240, (i + Math.floor(time * 2)) % 7 ? 1 : 1.8); c.fillStyle = '#ffd46a'; for (let i = 0; i < 14; i++) { const x = ((i * 150 - cam * 0.35) % (VIEW_W + 150) + VIEW_W + 150) % (VIEW_W + 150) - 75; c.fillRect(x, 330 + (i % 3) * 14, 6, 9); } }
}

// The tile grid only changes when a sector loads, a gate shuts or a wall breaks, so it is drawn once
// into an offscreen canvas the width of the whole sector and copied to the screen each frame.
const tileCache = new WeakMap<PawBusterGame, { canvas: HTMLCanvasElement; key: string }>();
function tileLayer(g: PawBusterGame) {
  const key = `${g.tilesRev}:${g.has('helmet') ? 1 : 0}`, hit = tileCache.get(g);
  if (hit && hit.key === key) return hit.canvas;
  const canvas = hit?.canvas ?? document.createElement('canvas');
  canvas.width = g.map.cols * TILE;
  canvas.height = VIEW_H;
  const c = canvas.getContext('2d');
  if (c) staticTiles(c, g);
  tileCache.set(g, { canvas, key });
  return canvas;
}

function tiles(c: CanvasRenderingContext2D, g: PawBusterGame, time: number) {
  const cam = Math.round(g.camX), c0 = Math.floor(cam / TILE), c1 = c0 + Math.ceil(VIEW_W / TILE) + 1;
  // Waterfalls pour behind the rock.
  for (const f of g.map.falls) {
    const x = f.x - cam;
    if (x > VIEW_W || x + f.w < 0) continue;
    const col = Math.floor((f.x + f.w / 2) / TILE);
    let top = ROWS;
    for (let r = 0; r < ROWS; r++) if (isSolid(g.tile(col, r))) { top = r; break; }
    const h = top * TILE;
    c.fillStyle = '#7fc8f0aa'; c.fillRect(x, 0, f.w, h);
    c.fillStyle = '#e8f8ffcc';
    for (let i = 0; i < 9; i++) c.fillRect(x + 4 + ((i * 13) % (f.w - 8)), ((time * 260 + i * 67) % (h + 40)) - 40, 3, 26);
    c.fillStyle = '#ffffffaa'; ellipse(c, x + f.w / 2, h - 3, f.w / 2 + 8, 6);
  }
  c.drawImage(tileLayer(g), cam, 0, VIEW_W, VIEW_H, 0, 0, VIEW_W, VIEW_H);
  // Conveyor belts are animated, so they are drawn live: rollers under moving chevrons.
  for (let col = c0; col <= c1 && col < g.map.cols; col++) {
    for (let r = 0; r < ROWS; r++) {
      const k = g.tile(col, r);
      if (k !== T.beltR && k !== T.beltL) continue;
      const x = col * TILE - cam, y = r * TILE;
      c.fillStyle = '#3a3f52'; c.fillRect(x, y, TILE, TILE);
      c.fillStyle = '#6a7188'; c.fillRect(x, y, TILE, 8);
      c.fillStyle = '#ffd46a';
      const off = ((g.clock * 90 * (k === T.beltR ? 1 : -1)) % 15 + 15) % 15;
      for (let i = -1; i < 2; i++) { const cx = x + i * 15 + off; c.beginPath(); if (k === T.beltR) { c.moveTo(cx, y + 1); c.lineTo(cx + 5, y + 4); c.lineTo(cx, y + 7); } else { c.moveTo(cx + 5, y + 1); c.lineTo(cx, y + 4); c.lineTo(cx + 5, y + 7); } c.fill(); }
      c.fillStyle = '#23273a'; for (const rx of [8, 22]) circle(c, x + rx, y + 18, 5);
    }
  }
  gates(c, g, cam);
}

function staticTiles(c: CanvasRenderingContext2D, g: PawBusterGame) {
  const t = THEMES[g.stage.id], helmet = g.has('helmet');
  for (let col = 0; col < g.map.cols; col++) {
    for (let r = 0; r < ROWS; r++) {
      const k = g.tile(col, r);
      if (!k || k === T.beltR || k === T.beltL) continue;
      const x = col * TILE, y = r * TILE, open = !g.tile(col, r - 1);
      if (k === T.crystal) {
        // A crystal wall: Quartz Orbit shatters it.
        c.fillStyle = '#5a3f7a'; c.fillRect(x, y, TILE, TILE);
        c.fillStyle = '#e3a8ff';
        for (const [cx, cy, s] of [[9, 10, 7], [21, 19, 8], [10, 24, 4]]) { c.beginPath(); c.moveTo(x + cx, y + cy - s); c.lineTo(x + cx + s * 0.6, y + cy); c.lineTo(x + cx, y + cy + s); c.lineTo(x + cx - s * 0.6, y + cy); c.fill(); }
        c.fillStyle = '#f7ecff'; c.fillRect(x + 8, y + 5, 2, 5); c.fillRect(x + 20, y + 13, 2, 5);
        continue;
      }
      if (k === T.door) {
        // A dead power door: a Volt Spark brings it to life, and it opens.
        c.fillStyle = '#4a5270'; c.fillRect(x, y, TILE, TILE);
        c.fillStyle = '#2c3346'; c.fillRect(x + 3, y + 3, TILE - 6, TILE - 6);
        c.fillStyle = '#fff27a';
        c.beginPath(); c.moveTo(x + 17, y + 5); c.lineTo(x + 10, y + 16); c.lineTo(x + 15, y + 16); c.lineTo(x + 12, y + 25); c.lineTo(x + 20, y + 13); c.lineTo(x + 15, y + 13); c.fill();
        continue;
      }
      if (k === T.ice) {
        c.fillStyle = '#bfe9ff'; c.fillRect(x, y, TILE, TILE);
        c.fillStyle = '#e8f8ff'; c.fillRect(x + 4, y + 4, 10, 3); c.fillRect(x + 16, y + 16, 8, 2);
        c.fillStyle = '#9fd4f0'; c.fillRect(x, y + TILE - 3, TILE, 3);
        continue;
      }
      if (k === T.spike) {
        c.fillStyle = t.ground;
        c.fillRect(x, y + TILE / 2, TILE, TILE / 2);
        c.fillStyle = t.spike;
        for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(x + i * 10, y + TILE / 2 + 1); c.lineTo(x + i * 10 + 5, y + 3); c.lineTo(x + i * 10 + 10, y + TILE / 2 + 1); c.fill(); }
        continue;
      }
      c.fillStyle = (col + r) % 2 ? t.ground : t.dark;
      c.fillRect(x, y, TILE, TILE);
      c.fillStyle = '#0000001a';
      c.fillRect(x, y + TILE - 3, TILE, 3);
      if (g.stage.id === 'citadel') { c.fillStyle = '#ffffff22'; c.fillRect(x + 3, y + 3, 4, 4); c.fillRect(x + TILE - 7, y + 3, 4, 4); }
      if (g.stage.id === 'mines' && (col * 5 + r * 7) % 9 === 0) { c.fillStyle = '#e3a8ffaa'; c.beginPath(); c.moveTo(x + 15, y + 6); c.lineTo(x + 21, y + 15); c.lineTo(x + 15, y + 24); c.lineTo(x + 9, y + 15); c.fill(); }
      if (g.stage.id === 'caldera' && (col * 7 + r * 3) % 5 === 0) { c.fillStyle = '#ff6a2a88'; c.fillRect(x + 8, y + 12, 12, 2); c.fillRect(x + 14, y + 12, 2, 9); }
      if (open) {
        c.fillStyle = t.top;
        c.fillRect(x, y, TILE, 6);
        if (g.stage.id === 'snowcap') { c.fillRect(x + 4, y + 6, 6, 3); c.fillRect(x + 18, y + 6, 8, 2); }
        if (g.stage.id === 'cloud') { c.fillRect(x + 6, y - 3, 3, 3); c.fillRect(x + 20, y - 4, 3, 4); }
        if (g.stage.id === 'lake') { c.fillStyle = '#7a9a4a'; c.fillRect(x + 5, y - 8, 2, 8); c.fillRect(x + 12, y - 11, 2, 11); c.fillRect(x + 22, y - 7, 2, 7); }
      }
      // A hidden wall looks like rock; the Scout Helmet outlines it.
      if (k === T.hidden && helmet) { c.strokeStyle = '#7fd6ff'; c.lineWidth = 2; c.setLineDash([5, 4]); c.strokeRect(x + 2, y + 2, TILE - 4, TILE - 4); c.setLineDash([]); }
    }
  }
}

function gates(c: CanvasRenderingContext2D, g: PawBusterGame, cam: number) {
  // The sector teleporter: a glowing doorway at the end of the sector.
  if (g.map.exit > 0) {
    const ex = (g.map.exit + 3) * TILE - cam, fy = (ROWS - 3) * TILE;
    if (ex > -60 && ex < VIEW_W + 60) {
      c.fillStyle = '#c9ced9'; c.fillRect(ex - 26, fy - 96, 8, 96); c.fillRect(ex + 18, fy - 96, 8, 96); c.fillRect(ex - 26, fy - 104, 52, 10);
      c.fillStyle = `rgba(127,214,255,${0.35 + Math.sin(g.clock * 6) * 0.15})`; c.fillRect(ex - 18, fy - 94, 36, 94);
      c.fillStyle = '#e8f8ff'; for (let i = 0; i < 4; i++) c.fillRect(ex - 14 + i * 9, fy - ((g.clock * 80 + i * 23) % 90), 3, 8);
    }
  }
  // The boss gate, drawn as a shutter across the arena entrance.
  const gx = g.map.arena * TILE - cam;
  if (g.map.arena > 0 && gx > -TILE && gx < VIEW_W) {
    c.fillStyle = g.fight ? '#c9ced9' : '#c9ced955';
    for (let y = 0; y < (ROWS - 3) * TILE; y += 12) c.fillRect(gx + 2, y, TILE - 4, 8);
    c.fillStyle = '#e05a4a';
    c.fillRect(gx + 11, (ROWS - 3) * TILE - 60, 8, 8);
  }
}

/** Darken a #rrggbb colour by `k` (0 to 1). */
const shade = (hex: string, k: number) => '#' + [1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - k)).toString(16).padStart(2, '0')).join('');
/** A chinchilla in armour, drawn around its feet (0,0), facing right. Dora wears blue, Enzo red. */
export function drawHero(c: CanvasRenderingContext2D, hero: HeroId, opts: { run?: number; air?: boolean; dash?: boolean; slide?: boolean; slash?: number; charge?: number; aim?: boolean; tint?: string } = {}) {
  // With a special weapon equipped the armour takes on that weapon's colour.
  const dora = hero === 'dora', fur = dora ? '#f4efe6' : '#8d8a93', furDark = dora ? '#d8d0c3' : '#6c6972';
  const armor = opts.tint ? shade(opts.tint, 0.15) : dora ? '#3b7be0' : '#d24a3c', armorDark = opts.tint ? shade(opts.tint, 0.45) : dora ? '#2a58a8' : '#9c2f26';
  const bob = opts.run ? Math.abs(Math.sin(opts.run * 14)) * 2 : 0, stride = opts.run ? Math.sin(opts.run * 14) * 4 : 0;
  c.save();
  if (opts.dash) c.rotate(0.14);
  // Tail: a big plume that sweeps back and curls up over the back, as in Fluff Forge. It streams out when
  // running and lifts in the air. Circles along a curve, flat like the rest of the armour art.
  const wag = Math.sin((opts.run ?? 0) * 10) * 1.5;
  const tp = opts.run ? [[-7, -10], [-20, -9], [-30, -26], [-22, -34]] : opts.air ? [[-7, -10], [-20, -12], [-27, -36], [-17, -38]] : [[-7, -10], [-20, -8], [-26, -34], [-16, -37]];
  tp[3][0] += wag; tp[2][0] += wag * 0.6;
  const tail: [number, number, number][] = [];
  for (let i = 0; i <= 16; i++) {
    const u = i / 16, a = (1 - u) ** 3, b = 3 * u * (1 - u) ** 2, d = 3 * u * u * (1 - u), e = u ** 3;
    tail.push([a * tp[0][0] + b * tp[1][0] + d * tp[2][0] + e * tp[3][0], a * tp[0][1] + b * tp[1][1] + d * tp[2][1] + e * tp[3][1] - bob, 2.6 + 2.4 * Math.sin(Math.PI * (0.08 + 0.8 * u))]);
  }
  c.fillStyle = dora ? furDark : '#56535c';
  for (const [x, y, r] of tail) circle(c, x - 0.7, y, r + 0.8);
  c.fillStyle = fur;
  for (const [x, y, r] of tail) circle(c, x, y, r);
  c.fillStyle = dora ? '#fffdf8' : '#9d9aa4';
  for (const [x, y, r] of tail.slice(3, 14)) circle(c, x + r * 0.2, y + r * 0.15, r * 0.55);
  // Boots.
  c.fillStyle = armorDark;
  rr(c, -9 + (opts.air ? -2 : stride), -6, 9, 6, 2);
  rr(c, 1 - (opts.air ? -2 : stride), -6, 9, 6, 2);
  // Body and chest plate.
  c.fillStyle = fur;
  ellipse(c, 0, -14 - bob, 10, 10);
  c.fillStyle = armor;
  rr(c, -8, -20 - bob, 16, 10, 3);
  c.fillStyle = '#ffffff55';
  c.fillRect(-5, -18 - bob, 5, 2);
  // Head, round chinchilla ears and helmet.
  const hy = -27 - bob;
  c.fillStyle = furDark;
  circle(c, -3, hy - 10, 6);
  circle(c, 6, hy - 11, 6);
  c.fillStyle = dora ? '#f0b8c0' : '#c89aa0';
  circle(c, -3, hy - 10, 3.4);
  circle(c, 6, hy - 11, 3.4);
  c.fillStyle = fur;
  circle(c, 3, hy, 9);
  c.fillStyle = armor;
  c.beginPath();
  c.arc(3, hy, 9.6, Math.PI * 1.02, Math.PI * 1.98);
  c.lineTo(12, hy - 1);
  c.lineTo(-6, hy - 1);
  c.fill();
  c.fillStyle = dora ? '#e04a4a' : '#7dffb0';
  circle(c, 9, hy - 5, 2);
  if (!dora) { c.fillStyle = armor; c.beginPath(); c.moveTo(-2, hy - 8); c.lineTo(-12, hy - 14); c.lineTo(-4, hy - 4); c.fill(); }
  // Dora's eyes are ruby, Enzo's black.
  c.fillStyle = dora ? '#8e1f33' : '#111';
  circle(c, 8, hy + 1, 2);
  if (dora) { c.fillStyle = '#3b0913'; circle(c, 8.2, hy + 1.2, 1.1); }
  c.fillStyle = '#fff';
  circle(c, 8.6, hy + 0.3, 0.7);
  c.fillStyle = '#c98a8a';
  circle(c, 12, hy + 4, 1.4);
  // Long fine whiskers fanning from the whisker pad and drooping past the chin.
  c.strokeStyle = dora ? '#ffffff' : '#e4e1e8';
  c.lineWidth = 0.6;
  c.beginPath();
  for (const [a, len] of [[-0.2, 11], [0.1, 12], [0.4, 11], [0.7, 9], [1, 7.5]]) {
    const dx = Math.cos(a), dy = Math.sin(a);
    c.moveTo(11, hy + 4); c.quadraticCurveTo(11 + dx * len * 0.6, hy + 4 + dy * len * 0.6, 11 + dx * len, hy + 4 + dy * len + len * 0.2);
  }
  c.stroke();
  // Dora's arm cannon, or Enzo's saber hilt and swing.
  if (dora) {
    c.fillStyle = armor;
    rr(c, 4, -19 - bob, 14, 8, 3);
    c.fillStyle = '#1a2a44';
    circle(c, 18, -15 - bob, 2.6);
    if (opts.charge) { c.fillStyle = opts.charge > 1 ? '#b6ff7a' : '#7fd6ff'; circle(c, 19, -15 - bob, 3 + opts.charge); }
  } else {
    c.fillStyle = '#d8d2c0';
    c.fillRect(6, -18 - bob, 8, 3);
    if (opts.slash !== undefined) {
      c.strokeStyle = '#7dffb0';
      c.globalAlpha = 0.85;
      c.lineWidth = 7;
      c.beginPath();
      const s = opts.slash;
      c.arc(6, -18, 30, -1.5 + s * 0.4, 0.9 + s * 0.3);
      c.stroke();
      c.strokeStyle = '#ffffff';
      c.lineWidth = 2;
      c.stroke();
      c.globalAlpha = 1;
    } else { c.fillStyle = '#7dffb0'; c.fillRect(13, -19 - bob, 3, 5); }
  }
  c.restore();
}

function enemy(c: CanvasRenderingContext2D, e: Enemy, g: PawBusterGame, cam: number) {
  const x = e.x - cam + e.w / 2, y = e.y + e.h;
  c.save();
  c.translate(Math.round(x), Math.round(y));
  if (e.flash > 0) c.globalAlpha = 0.5;
  c.scale(e.face, 1);
  if (e.kind === 'beetle') {
    c.fillStyle = '#2b1d12';
    for (const lx of [-8, 0, 8]) c.fillRect(lx - 1, -5 + Math.sin(g.clock * 12 + lx) * 1.5, 3, 5);
    c.fillStyle = '#8a5a2b';
    c.beginPath(); c.arc(0, -5, 12, Math.PI, 0); c.fill();
    c.fillStyle = '#c28a4a';
    c.fillRect(-10, -9, 20, 3);
    c.fillStyle = '#fff'; circle(c, 9, -6, 2.4); c.fillStyle = '#000'; circle(c, 10, -6, 1.2);
  } else if (e.kind === 'bat') {
    const flap = Math.sin(g.clock * 16) * 7;
    c.fillStyle = '#5c3f78';
    c.beginPath(); c.moveTo(-2, -10); c.lineTo(-16, -14 - flap); c.lineTo(-10, -4); c.fill();
    c.beginPath(); c.moveTo(2, -10); c.lineTo(16, -14 - flap); c.lineTo(10, -4); c.fill();
    c.fillStyle = '#7a58a0'; ellipse(c, 0, -9, 7, 8);
    c.fillStyle = '#ffd24a'; circle(c, 3, -11, 1.8);
  } else if (e.kind === 'ceiling') {
    // A turret hanging on a chain from the top of the screen.
    c.fillStyle = '#8b877e';
    for (let y = -e.h - 4; y > -(e.y + e.h) - 8; y -= 9) c.fillRect(-2, y - 6, 4, 6);
    c.fillStyle = '#6d6a64'; rr(c, -13, -24, 26, 12, 4);
    c.fillStyle = '#8b877e'; c.beginPath(); c.arc(0, -12, 12, 0, Math.PI); c.fill();
    c.fillStyle = '#fff'; circle(c, 0, -6, 4); c.fillStyle = '#d84a3a'; circle(c, 0, -5, 2.2);
  } else if (e.kind === 'shield') {
    const step = e.ground ? Math.sin(g.clock * 10) * 1.5 : 0;
    c.fillStyle = '#3a3f52'; c.fillRect(-8, -6 + step, 5, 6); c.fillRect(2, -6 - step, 5, 6);
    c.fillStyle = '#5c6378'; rr(c, -11, -25, 18, 20, 5);
    c.fillStyle = '#ffd46a'; circle(c, 1, -19, 2.4);
    // The shield, always on the side it faces.
    c.fillStyle = '#9aa3b8'; rr(c, 7, -29, 8, 27, 3);
    c.fillStyle = '#e8ecf6'; c.fillRect(9, -25, 3, 19);
  } else if (e.kind === 'bomber') {
    const spin = Math.abs(Math.sin(g.clock * 40));
    c.fillStyle = '#c9ced9'; c.fillRect(-13 * spin, -21, 26 * spin + 1, 2); c.fillRect(-1, -20, 2, 5);
    c.fillStyle = '#7a6a8c'; ellipse(c, 0, -9, 14, 8);
    c.fillStyle = '#9a88ac'; ellipse(c, -3, -12, 7, 3);
    c.fillStyle = '#ffd24a'; circle(c, 7, -10, 2.5);
    if (e.mode === 0) { c.fillStyle = '#3a3f52'; circle(c, 0, -1, 4); }
  } else if (e.kind === 'guardian') {
    // Each stage's mid-boss, a big armoured brute in the stage's colours.
    const t = THEMES[g.stage.id], air = !e.ground;
    c.fillStyle = t.dark; rr(c, -18, -12, 13, 12, 3); rr(c, 5, -12, 13, 12, 3);
    c.fillStyle = t.ground; rr(c, -22, -41, 44, 31, 9);
    c.strokeStyle = '#10141e'; c.lineWidth = 2; c.strokeRect(-14, -34, 20, 16);
    c.fillStyle = t.top; rr(c, -22, -45, 44, 9, 4);
    c.fillStyle = t.accent; rr(c, 7, -36, 14, 8, 3);
    c.fillStyle = '#e05a4a'; circle(c, 16, -32, 2.6);
    c.fillStyle = t.dark; rr(c, -31, air ? -40 : -34, 9, 20, 3); rr(c, 21, air ? -42 : -31, 10, 17, 3);
    if (e.mode === 1) { c.fillStyle = '#ffd46a'; circle(c, 30, -24, 4 + Math.sin(g.clock * 30) * 1.5); }
  } else if (e.kind === 'hopper') {
    const air = !e.ground;
    c.fillStyle = '#3f8a4a'; ellipse(c, 0, -8, 11, air ? 9 : 7);
    c.fillStyle = '#2d6a36'; rr(c, -12, air ? -4 : -3, 7, 3, 1); rr(c, 5, air ? -4 : -3, 7, 3, 1);
    c.fillStyle = '#b8e07a'; ellipse(c, 2, -5, 7, 3);
    c.fillStyle = '#fff'; circle(c, 4, -15, 3.2); c.fillStyle = '#000'; circle(c, 5, -15, 1.6);
  } else {
    c.fillStyle = '#6d6a64'; rr(c, -13, -20, 26, 20, 3);
    c.fillStyle = '#8b877e'; rr(c, -11, -28, 22, 12, 5);
    c.fillStyle = '#fff'; circle(c, 4, -22, 4.5); c.fillStyle = '#d84a3a'; circle(c, 6, -22, 2.4);
  }
  c.restore();
}

/** The four mavericks, drawn around their feet (0,0), facing right. Also used for stage-select portraits. */
export function drawBoss(c: CanvasRenderingContext2D, kind: BossKind, time: number, state: { move?: string; hidden?: boolean; t?: number } = {}) {
  c.save();
  if (kind === 'fox') {
    c.fillStyle = '#e8f3ff';
    c.beginPath(); c.moveTo(-24, -20); c.quadraticCurveTo(-46, -34, -40, -8); c.quadraticCurveTo(-30, -6, -22, -12); c.fill();
    c.fillStyle = '#d9ecff'; ellipse(c, -4, -18, 20, 13);
    c.fillStyle = '#7ec8f2'; rr(c, -14, -28, 22, 10, 3);
    c.fillStyle = '#eef6ff';
    c.beginPath(); c.moveTo(8, -34); c.lineTo(28, -22); c.lineTo(8, -16); c.fill();
    c.beginPath(); c.moveTo(8, -32); c.lineTo(10, -46); c.lineTo(16, -32); c.fill();
    c.beginPath(); c.moveTo(1, -30); c.lineTo(2, -44); c.lineTo(8, -32); c.fill();
    c.fillStyle = '#1b2b3c'; circle(c, 14, -27, 2); circle(c, 28, -22, 2);
    c.fillStyle = '#a7dcf5'; for (const lx of [-16, -6, 4, 12]) c.fillRect(lx, -8, 5, 8);
  } else if (kind === 'owl') {
    const flap = Math.sin(time * (state.move === 'swoop' ? 22 : 9)) * 10;
    c.fillStyle = '#6b6f7e';
    c.beginPath(); c.moveTo(-10, -30); c.lineTo(-36, -20 - flap); c.lineTo(-12, -10); c.fill();
    c.beginPath(); c.moveTo(10, -30); c.lineTo(36, -20 - flap); c.lineTo(12, -10); c.fill();
    c.fillStyle = '#8a8fa0'; ellipse(c, 0, -22, 18, 20);
    c.fillStyle = '#c9ccd6'; ellipse(c, 0, -14, 11, 11);
    c.fillStyle = '#fff'; circle(c, -7, -30, 7); circle(c, 7, -30, 7);
    c.fillStyle = '#ffcf3a'; circle(c, -7, -30, 4.5); circle(c, 7, -30, 4.5);
    c.fillStyle = '#111'; circle(c, -6, -30, 2.2); circle(c, 8, -30, 2.2);
    c.fillStyle = '#e39b2d'; c.beginPath(); c.moveTo(-3, -24); c.lineTo(3, -24); c.lineTo(0, -19); c.fill();
    c.fillStyle = '#6b6f7e'; c.beginPath(); c.moveTo(-14, -40); c.lineTo(-8, -48); c.lineTo(-4, -38); c.fill(); c.beginPath(); c.moveTo(14, -40); c.lineTo(8, -48); c.lineTo(4, -38); c.fill();
    c.fillStyle = '#ffe36a'; c.beginPath(); c.moveTo(-2, -12); c.lineTo(4, -12); c.lineTo(0, -6); c.lineTo(4, -6); c.lineTo(-4, 2); c.lineTo(-1, -5); c.lineTo(-4, -5); c.fill();
  } else if (kind === 'snake') {
    if (state.hidden) { c.restore(); return; }
    for (let i = 7; i >= 0; i--) {
      const sx = -30 + i * 7, sy = -10 + Math.sin(time * 8 + i * 0.9) * 3;
      c.fillStyle = i % 2 ? '#d9542e' : '#b8401f'; circle(c, sx, sy, 9 - (7 - i) * 0.4);
      c.fillStyle = '#ffcf5a'; c.fillRect(sx - 3, sy + 4, 6, 3);
    }
    c.fillStyle = '#e0603a'; ellipse(c, 26, -14, 12, 9);
    c.fillStyle = '#ffe26a'; circle(c, 30, -18, 2.6); c.fillStyle = '#111'; c.fillRect(30, -20, 1.5, 4);
    c.fillStyle = '#fff'; c.beginPath(); c.moveTo(32, -8); c.lineTo(34, -2); c.lineTo(36, -8); c.fill();
    c.strokeStyle = '#ff3a5a'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(37, -12); c.lineTo(44, -12 + Math.sin(time * 20) * 2); c.stroke();
  } else if (kind === 'armadillo') {
    if (state.move === 'roll' && (state.t ?? 0) >= 0.4) {
      // Curled into a spinning ball of armour plates.
      c.translate(0, -18); c.rotate(time * 14);
      c.fillStyle = '#7a6a8c'; circle(c, 0, 0, 18);
      c.strokeStyle = '#e3a8ff'; c.lineWidth = 3; for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(0, 0, 18, i * 2.1, i * 2.1 + 1); c.stroke(); }
      c.fillStyle = '#b48ad8'; circle(c, 0, 0, 6);
    } else {
      c.fillStyle = '#6a5a78'; c.beginPath(); c.moveTo(-26, -8); c.lineTo(-38, -4); c.lineTo(-26, -2); c.fill();
      c.fillStyle = '#7a6a8c'; c.beginPath(); c.arc(-4, -8, 24, Math.PI, 0); c.fill();
      c.fillStyle = '#9a88ac'; for (const a of [-16, -6, 4, 14]) c.fillRect(-4 + a - 2, -30 + Math.abs(a) * 0.35, 4, 22 - Math.abs(a) * 0.35);
      c.fillStyle = '#e3a8ff'; for (const a of [-14, 0, 12]) { c.beginPath(); c.moveTo(-4 + a, -40); c.lineTo(-4 + a + 5, -30); c.lineTo(-4 + a - 5, -30); c.fill(); }
      c.fillStyle = '#c2a88a'; ellipse(c, 22, -12, 10, 7);
      c.fillStyle = '#9a88ac'; c.beginPath(); c.moveTo(16, -18); c.lineTo(18, -26); c.lineTo(22, -18); c.fill();
      c.fillStyle = '#111'; circle(c, 25, -14, 1.8); c.fillStyle = '#6a4a3a'; circle(c, 31, -11, 1.8);
      c.fillStyle = '#5a4a68'; for (const lx of [-20, -8, 4, 14]) c.fillRect(lx, -8, 6, 8);
    }
  } else if (kind === 'vicuna') {
    const run = state.move === 'dash' ? Math.sin(time * 30) * 4 : 0;
    c.fillStyle = '#b8864a'; for (const lx of [-14, -6, 6, 14]) c.fillRect(lx - 2 + (lx % 4 ? run : -run), -18, 4, 18);
    c.fillStyle = '#e0b070'; ellipse(c, 0, -22, 20, 10);
    c.fillStyle = '#fff4e0'; ellipse(c, 2, -18, 12, 5);
    c.fillStyle = '#e0b070'; rr(c, 12, -46, 8, 24, 4);
    c.fillStyle = '#e8bd80'; ellipse(c, 20, -46, 9, 6);
    c.fillStyle = '#b8864a'; c.beginPath(); c.moveTo(14, -50); c.lineTo(15, -58); c.lineTo(18, -51); c.fill();
    c.fillStyle = '#111'; circle(c, 22, -48, 1.8);
    c.fillStyle = '#fff27a'; c.beginPath(); c.moveTo(-4, -32); c.lineTo(2, -32); c.lineTo(-2, -26); c.lineTo(3, -26); c.lineTo(-5, -18); c.lineTo(-2, -24); c.lineTo(-7, -24); c.fill();
    c.fillStyle = '#e0b070'; c.beginPath(); c.moveTo(-18, -26); c.quadraticCurveTo(-26, -32, -24, -20); c.fill();
    if (state.move === 'storm' || state.move === 'bolt') { c.strokeStyle = '#fff27a'; c.lineWidth = 2; c.beginPath(); for (let i = 0; i < 5; i++) c.lineTo(Math.cos(time * 20 + i) * 26, -24 + Math.sin(time * 17 + i * 2) * 20); c.stroke(); }
  } else if (kind === 'toad') {
    const puff = state.move === 'bubbles' ? 3 + Math.sin(time * 20) * 2 : 0;
    c.fillStyle = '#3f7a5a'; ellipse(c, -18, -5, 12, 5); ellipse(c, 16, -4, 10, 4);
    c.fillStyle = '#4f9a6a'; ellipse(c, 0, -16, 28, 16);
    c.fillStyle = '#d8e8a0'; ellipse(c, 8, -8 + puff * 0.2, 16 + puff, 8 + puff);
    c.fillStyle = '#6ab87a'; for (const sx of [-14, -2, -20]) circle(c, sx, -24, 3);
    c.fillStyle = '#4f9a6a'; circle(c, 10, -30, 8); circle(c, 24, -28, 7);
    c.fillStyle = '#ffe26a'; circle(c, 11, -31, 5); circle(c, 25, -29, 4.5);
    c.fillStyle = '#111'; c.fillRect(8, -32, 6, 2); c.fillRect(22, -30, 6, 2);
    c.strokeStyle = '#2d5a40'; c.lineWidth = 2; c.beginPath(); c.moveTo(14, -16); c.quadraticCurveTo(24, -12, 30, -18); c.stroke();
  } else {
    c.fillStyle = '#6a4b2e';
    c.beginPath(); c.moveTo(-24, -20); c.quadraticCurveTo(-44, -18 + Math.sin(time * 4) * 6, -40, -40); c.lineTo(-36, -40); c.quadraticCurveTo(-38, -22, -22, -14); c.fill();
    c.fillStyle = '#c99a5c'; ellipse(c, -4, -20, 24, 15);
    c.fillStyle = '#4d3a6a'; rr(c, -18, -32, 28, 12, 3);
    c.fillStyle = '#b3854a'; for (const lx of [-20, -8, 4, 14]) c.fillRect(lx, -10, 7, 10);
    c.fillStyle = '#d4a868'; circle(c, 18, -30, 13);
    c.fillStyle = '#b3854a'; circle(c, 10, -42, 5); circle(c, 24, -42, 5);
    c.fillStyle = '#ffd46a'; c.beginPath(); c.moveTo(8, -44); c.lineTo(11, -54); c.lineTo(16, -47); c.lineTo(20, -56); c.lineTo(23, -47); c.lineTo(28, -54); c.lineTo(28, -42); c.lineTo(8, -42); c.fill();
    c.fillStyle = '#3a8c3a'; circle(c, 23, -31, 2.4); c.fillStyle = '#111'; c.fillRect(23, -33, 1.2, 4);
    c.fillStyle = '#e7c893'; ellipse(c, 26, -24, 6, 4);
    c.fillStyle = '#5a3a2a'; circle(c, 30, -26, 1.6);
  }
  c.restore();
}

function shot(c: CanvasRenderingContext2D, s: Shot, cam: number, time: number) {
  const x = s.x - cam, y = s.y;
  c.save();
  c.translate(x, y);
  switch (s.kind) {
    case 'lemon': c.fillStyle = '#ffe27a'; ellipse(c, 0, 0, 6, 4); break;
    case 'mid': c.fillStyle = '#7fd6ff'; ellipse(c, 0, 0, 11, 8); c.fillStyle = '#e8f8ff'; ellipse(c, 2 * Math.sign(s.vx), 0, 5, 4); break;
    case 'full': c.fillStyle = (Math.floor(time * 20) % 2 ? '#b6ff7a' : '#7fd6ff'); c.beginPath(); c.arc(-Math.sign(s.vx) * 6, 0, 16, -1.3, 1.3); c.fill(); c.fillStyle = '#f4ffe8'; ellipse(c, 0, 0, 8, 6); break;
    case 'giga': c.rotate(time * 14); ['#e3a8ff', '#7fd6ff', '#b6ff7a'].forEach((col, i) => { c.fillStyle = col; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, 20 - i * 5, i * 2.1, i * 2.1 + 3.4); c.fill(); }); c.fillStyle = '#fff'; circle(c, 0, 0, 5); break;
    case 'bomb': c.fillStyle = '#3a3f52'; circle(c, 0, 0, 7); c.fillStyle = '#8b93ad'; c.fillRect(-1, -11, 2, 4); if (Math.floor(time * 16) % 2) { c.fillStyle = '#ff5a4a'; circle(c, 0, -12, 2.2); } break;
    case 'frost': c.fillStyle = WEAPONS.frost.color; c.beginPath(); c.moveTo(12 * Math.sign(s.vx), 0); c.lineTo(0, -6); c.lineTo(-10 * Math.sign(s.vx), 0); c.lineTo(0, 6); c.fill(); break;
    case 'gale': c.rotate(Math.atan2(s.vy, s.vx)); c.fillStyle = WEAPONS.gale.color; ellipse(c, 0, 0, 10, 3.5); c.fillStyle = '#7aa860'; c.fillRect(-10, -0.5, 18, 1); break;
    case 'ember': c.fillStyle = '#ff5a2a88'; circle(c, -Math.sign(s.vx) * 7, 0, 7); c.fillStyle = WEAPONS.ember.color; circle(c, 0, 0, 8); c.fillStyle = '#fff2b0'; circle(c, 1, -1, 3.5); break;
    case 'pellet': c.fillStyle = '#ff5a4a'; circle(c, 0, 0, 5); c.fillStyle = '#ffd0c8'; circle(c, 1, -1, 2); break;
    case 'shard': c.rotate(Math.atan2(s.vy, s.vx)); c.fillStyle = '#dff4ff'; c.beginPath(); c.moveTo(10, 0); c.lineTo(-6, -5); c.lineTo(-6, 5); c.fill(); break;
    case 'feather': c.rotate(Math.atan2(s.vy, s.vx)); c.fillStyle = '#d4d7e2'; ellipse(c, 0, 0, 9, 3); break;
    case 'fire': c.fillStyle = '#ff7a2a'; circle(c, 0, 0, 7); c.fillStyle = '#ffe07a'; circle(c, 0, 0, 3.5); break;
    case 'wave': c.fillStyle = '#e6f3ffcc'; c.beginPath(); c.moveTo(-10, 10); c.lineTo(0, -12 + Math.sin(time * 30) * 2); c.lineTo(10, 10); c.fill(); break;
    case 'quartz': c.rotate(time * 6); c.fillStyle = WEAPONS.quartz.color; c.beginPath(); c.moveTo(0, -10); c.lineTo(7, 0); c.lineTo(0, 10); c.lineTo(-7, 0); c.fill(); c.fillStyle = '#fff'; c.fillRect(-1, -6, 2, 6); break;
    case 'volt': c.strokeStyle = WEAPONS.volt.color; c.lineWidth = 3; c.beginPath(); c.moveTo(-9, 0); c.lineTo(-3, -6); c.lineTo(2, 4); c.lineTo(9, -3); c.stroke(); c.fillStyle = '#fff'; circle(c, 0, 0, 3); break;
    case 'bubble': case 'foam': c.fillStyle = s.kind === 'bubble' ? '#8fe0ff55' : '#d8f4ff55'; circle(c, 0, 0, s.r); c.strokeStyle = s.kind === 'bubble' ? WEAPONS.bubble.color : '#e8faff'; c.lineWidth = 2; c.stroke(); c.fillStyle = '#fff'; circle(c, -s.r * 0.35, -s.r * 0.35, s.r * 0.25); break;
    case 'crystal': c.rotate(time * 10); c.fillStyle = '#e3a8ff'; c.beginPath(); c.moveTo(0, -8); c.lineTo(5, 0); c.lineTo(0, 8); c.lineTo(-5, 0); c.fill(); break;
    case 'rock': c.fillStyle = '#6a5a78'; circle(c, 0, 0, 11); c.fillStyle = '#9a88ac'; circle(c, -3, -3, 4); break;
    case 'bolt': c.strokeStyle = '#fff27a'; c.lineWidth = 5; c.beginPath(); c.moveTo(0, -60); c.lineTo(-8, -40); c.lineTo(6, -24); c.lineTo(-6, -8); c.lineTo(4, 12); c.stroke(); c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke(); break;
    case 'spark': c.fillStyle = '#fff27a'; circle(c, 0, 0, 6 + Math.sin(time * 40) * 1.5); c.fillStyle = '#fff'; circle(c, 0, 0, 3); break;
    case 'tongue': c.fillStyle = '#e05a7a'; c.fillRect(-Math.sign(s.vx) * 40, -2, 40 * Math.sign(s.vx), 4); circle(c, 0, 0, 7); break;
    case 'icewall': c.fillStyle = '#bfe9ffcc'; rr(c, -14, -22, 28, 44, 4); c.fillStyle = '#e8f8ff'; c.fillRect(-9, -16, 5, 28); c.fillRect(2, -18, 3, 14); c.strokeStyle = '#7fc8f0'; c.lineWidth = 2; c.strokeRect(-14, -22, 28, 44); break;
    case 'tornado': for (let i = 0; i < 5; i++) { c.fillStyle = i % 2 ? '#cfeeb4aa' : '#e8f8dcaa'; ellipse(c, Math.sin(time * 20 + i) * 4, -16 + i * 8, 20 - i * 3, 4); } break;
    case 'pillar': c.fillStyle = '#ff7a2acc'; ellipse(c, 0, 0, 12, 14); c.fillStyle = '#ffe07a'; ellipse(c, Math.sin(time * 30 + s.y) * 2, 0, 6, 9); break;
    case 'claw': c.strokeStyle = '#ffd46a'; c.lineWidth = 3; for (const o of [-6, 0, 6]) { c.beginPath(); c.arc(-Math.sign(s.vx) * 4, o, 9, -1, 1); c.stroke(); } break;
  }
  c.restore();
}

function bar(c: CanvasRenderingContext2D, x: number, y: number, value: number, max: number, color: string, width = 12, label?: string) {
  const seg = 5, h = max * seg / 2 + 6;
  c.fillStyle = '#10141ecc';
  rr(c, x - 3, y - 3, width + 6, h + 6, 4);
  c.fillStyle = '#2c3346';
  c.fillRect(x, y, width, h);
  const filled = Math.ceil(value / 2);
  c.fillStyle = color;
  for (let i = 0; i < filled; i++) c.fillRect(x + 2, y + h - 3 - (i + 1) * seg, width - 4, seg - 1.5);
  if (label) { c.fillStyle = '#10141e'; rr(c, x - 3, y + h + 4, width + 6, 16, 3); c.fillStyle = '#fff'; c.font = 'bold 11px ui-monospace, monospace'; c.textAlign = 'center'; c.fillText(label, x + width / 2, y + h + 16); }
}

/** An armour capsule's contents, drawn around (x, y). */
function partIcon(c: CanvasRenderingContext2D, kind: ItemKind, x: number, y: number) {
  if (kind === 'boots') { c.fillStyle = '#3b7be0'; rr(c, x - 8, y - 6, 7, 12, 2); rr(c, x + 1, y - 6, 7, 12, 2); c.fillStyle = '#7fd6ff'; c.fillRect(x - 9, y + 4, 18, 3); }
  else if (kind === 'saber') { c.strokeStyle = '#7dffb0'; c.lineWidth = 3; c.beginPath(); c.moveTo(x - 7, y + 7); c.lineTo(x + 7, y - 7); c.stroke(); c.fillStyle = '#d24a3c'; c.fillRect(x - 9, y + 3, 7, 4); }
  else if (kind === 'helmet') { c.fillStyle = '#3b7be0'; c.beginPath(); c.arc(x, y + 3, 9, Math.PI, 0); c.fill(); c.fillStyle = '#7fd6ff'; c.fillRect(x - 6, y + 1, 12, 3); c.fillStyle = '#e04a4a'; circle(c, x, y - 4, 2); }
  else if (kind === 'armor') { c.fillStyle = '#3b7be0'; rr(c, x - 9, y - 8, 18, 16, 4); c.fillStyle = '#ffd46a'; c.fillRect(x - 2, y - 6, 4, 12); c.fillStyle = '#ffffff66'; c.fillRect(x - 7, y - 6, 4, 3); }
  else if (kind === 'arm') { c.fillStyle = '#3b7be0'; rr(c, x - 10, y - 5, 16, 10, 3); c.fillStyle = '#1a2a44'; circle(c, x + 7, y, 4); c.fillStyle = '#e3a8ff'; circle(c, x + 7, y, 2); }
}

/** The boss's title card, which slides in over the lower part of the screen during its intro. */
function introCard(c: CanvasRenderingContext2D, g: PawBusterGame, b: Boss, time: number) {
  const info = bossInfo(b.kind), known = info.weakness && g.progress.found.includes(info.id);
  const k = Math.min(1, (g.introMax - g.introT) / 0.35), x = -VIEW_W * (1 - k) ** 2, y = 372;
  c.save();
  c.globalAlpha = Math.min(1, g.introT * 4);
  c.fillStyle = '#10141ee8'; c.fillRect(x, y, VIEW_W, 100);
  c.fillStyle = '#ffd46a'; c.fillRect(x, y, VIEW_W, 3); c.fillRect(x, y + 97, VIEW_W, 3);
  c.fillStyle = THEMES[info.id].sky[1]; circle(c, x + 150, y + 50, 42);
  c.save(); c.beginPath(); c.arc(x + 150, y + 50, 42, 0, Math.PI * 2); c.clip();
  c.translate(x + 150, y + 82); c.scale(1.2, 1.2); drawBoss(c, b.kind, time, { move: 'idle' });
  c.restore();
  c.textAlign = 'left';
  c.fillStyle = '#ffd46a'; c.font = 'bold 12px ui-monospace, monospace';
  c.fillText(g.rushing ? `REMATCH ${g.rush + 1} OF 7` : g.gallery ? 'BOSS GALLERY' : info.name.toUpperCase(), x + 220, y + 30);
  c.fillStyle = '#fff'; c.font = 'bold 34px ui-monospace, monospace';
  c.fillText(info.bossName.toUpperCase(), x + 220, y + 66);
  c.font = 'bold 12px ui-monospace, monospace';
  c.fillStyle = known ? WEAPONS[info.weakness!].color : '#a9b2c8';
  c.fillText(info.weakness ? (known ? `WEAK TO ${WEAPONS[info.weakness].name.toUpperCase()}` : 'WEAKNESS: ???') : 'NO KNOWN WEAKNESS', x + 220, y + 86);
  c.restore();
}

export type Ghost = { hero: HeroId; body: Player; part: number };
export type DrawOptions = { shake?: boolean };
export function drawStage(c: CanvasRenderingContext2D, g: PawBusterGame, time: number, ghost: Ghost | null = null, opts: DrawOptions = {}) {
  const cam = Math.round(g.camX);
  c.save();
  if (g.shake > 0 && opts.shake !== false) c.translate(Math.sin(time * 90) * 4 * g.shake * 5, Math.cos(time * 70) * 3 * g.shake * 5);
  backdrop(c, g.stage.id, cam, time);
  tiles(c, g, time);
  for (const pl of g.platforms) {
    const x = pl.x - cam;
    if (x > VIEW_W || x + pl.w < 0) continue;
    c.fillStyle = '#8b93ad'; rr(c, x, pl.y, pl.w, pl.h, 3);
    c.fillStyle = '#ffd46a'; for (let i = 6; i < pl.w - 4; i += 14) c.fillRect(x + i, pl.y + 2, 6, 3);
    c.fillStyle = '#4a5270'; c.fillRect(x + 4, pl.y + pl.h, pl.w - 8, 3);
  }
  for (const cr of g.crushers) {
    const x = cr.x - cam;
    if (x > VIEW_W || x + cr.w < 0) continue;
    c.fillStyle = '#5c6378'; c.fillRect(x + cr.w / 2 - 6, 0, 12, cr.bottom - 40);
    c.fillStyle = '#3a3f52'; rr(c, x, cr.bottom - 44, cr.w, 44, 4);
    c.fillStyle = '#e0303088'; for (let i = 0; i < cr.w; i += 12) c.fillRect(x + i, cr.bottom - 8, 6, 8);
    c.fillStyle = '#ffd46a'; c.fillRect(x + 6, cr.bottom - 36, cr.w - 12, 4);
  }
  // Checkpoint flags.
  g.map.checkpoints.forEach((cp, i) => {
    const x = cp.x - cam;
    if (x < -20 || x > VIEW_W + 20) return;
    c.fillStyle = '#d8d2c0'; c.fillRect(x - 1, cp.y - 40, 3, 40);
    c.fillStyle = i <= g.checkpoint ? '#7dffb0' : '#e05a4a';
    c.beginPath(); c.moveTo(x + 2, cp.y - 40); c.lineTo(x + 18, cp.y - 34); c.lineTo(x + 2, cp.y - 28); c.fill();
  });
  for (const it of g.items) {
    const x = it.x - cam, y = it.y + Math.sin(time * 4 + it.x) * (it.kind === 'tank' ? 3 : 0);
    if (it.kind === 'tank') { c.fillStyle = '#ffffff55'; circle(c, x, y, 14 + Math.sin(time * 5) * 2); c.fillStyle = '#e8465a'; c.beginPath(); c.moveTo(x, y + 9); c.bezierCurveTo(x - 14, y - 2, x - 7, y - 12, x, y - 5); c.bezierCurveTo(x + 7, y - 12, x + 14, y - 2, x, y + 9); c.fill(); }
    else if (it.kind === 'sub') { c.fillStyle = '#ffffff44'; circle(c, x, y, 14 + Math.sin(time * 5) * 2); c.fillStyle = '#3b7be0'; rr(c, x - 8, y - 11, 16, 22, 4); c.fillStyle = '#7fd6ff'; c.fillRect(x - 5, y - 4, 10, 12); c.fillStyle = '#fff'; c.font = 'bold 10px ui-monospace, monospace'; c.textAlign = 'center'; c.fillText('S', x, y - 3); }
    else if (isPartItem(it.kind)) {
      // An armour capsule: a glowing pod with the part inside.
      c.fillStyle = '#ffd46a55'; circle(c, x, y, 17 + Math.sin(time * 5) * 2);
      c.fillStyle = '#c9ced9'; rr(c, x - 13, y - 14, 26, 28, 7);
      c.fillStyle = '#7fd6ff55'; rr(c, x - 10, y - 11, 20, 22, 5);
      partIcon(c, it.kind, x, y);
    }
    else if (it.kind === 'hp') { c.fillStyle = '#fff'; rr(c, x - 7, y - 6, 14, 12, 3); c.fillStyle = '#e8465a'; c.fillRect(x - 1.5, y - 4, 3, 8); c.fillRect(x - 4, y - 1.5, 8, 3); }
    else { c.fillStyle = '#7fd6ff'; rr(c, x - 6, y - 7, 12, 14, 3); c.fillStyle = '#fff'; c.fillRect(x - 3, y - 4, 6, 2); }
  }
  for (const e of g.enemies) if (e.x + e.w > cam - 20 && e.x < cam + VIEW_W + 20) enemy(c, e, g, cam);
  const b = g.boss;
  if (b) {
    if (b.kind === 'snake' && b.hidden && b.t > 0.45) { c.fillStyle = `rgba(255,120,40,${0.35 + Math.sin(time * 30) * 0.2})`; c.fillRect(b.x - cam, (ROWS - 3) * TILE - 8, b.w, 8); }
    if (b.move === 'storm' && b.fired === 1) {
      c.fillStyle = Math.floor(time * 12) % 2 ? '#fff27a55' : '#fff27a22';
      const left = (g.map.arena + 1) * TILE + 14, right = (g.map.arena + 31) * TILE - 14;
      for (const o of [-110, 0, 110]) c.fillRect(Math.max(left, Math.min(right, b.tx + o)) - cam - 12, 0, 24, (ROWS - 3) * TILE);
    }
    const blink = b.inv > 0 && Math.floor(time * 40) % 2 === 0;
    if (!(g.state === 'clearing' && Math.floor(b.deathT * 12) % 2)) {
      c.save();
      c.translate(Math.round(b.x - cam + b.w / 2), Math.round(b.y + b.h));
      c.scale(b.face, 1);
      if (blink || b.flinch > 0) c.globalAlpha = 0.55;
      const shake = (b.move === 'dash' || b.move === 'lunge') && b.t < 0.4 ? Math.sin(time * 80) * 2 : 0;
      c.translate(shake, 0);
      drawBoss(c, b.kind, time, b);
      c.restore();
    }
  }
  for (const s of g.shots) shot(c, s, cam, time);
  // The best-time ghost, a translucent copy of the recorded run.
  if (ghost && ghost.part === g.part) {
    c.save();
    c.globalAlpha = 0.35;
    c.translate(Math.round(ghost.body.x - cam + ghost.body.w / 2), Math.round(ghost.body.y + ghost.body.h));
    c.scale(ghost.body.face, 1);
    drawHero(c, ghost.hero, { run: ghost.body.runT, air: !ghost.body.ground, dash: ghost.body.dashT > 0 || ghost.body.adT > 0, tint: '#c9ced9' });
    c.restore();
  }
  // A fallen co-op hero lies where they fell, with a ring that fills as the partner revives them.
  if (g.coop) for (const h of HEROES) {
    const p = g.bodies[h];
    if (!p.down) continue;
    c.save();
    c.translate(Math.round(p.x - cam + p.w / 2), Math.round(p.y + p.h));
    c.save(); c.globalAlpha = 0.6; c.translate(-14, -4); c.rotate(-Math.PI / 2); drawHero(c, h, { tint: '#8b93ad' }); c.restore();
    c.strokeStyle = '#10141e88'; c.lineWidth = 4; c.beginPath(); c.arc(0, -34, 12, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = '#7dffb0'; c.beginPath(); c.arc(0, -34, 12, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * p.reviveT) / REVIVE); c.stroke();
    c.fillStyle = '#fff'; c.font = 'bold 10px ui-monospace, monospace'; c.textAlign = 'center'; c.fillText('HELP', 0, -52 + Math.sin(time * 5) * 2);
    c.restore();
  }
  // The heroes in play (one in single play, both in co-op); each blinks while invulnerable.
  for (const h of g.coop ? HEROES.filter((x) => !g.bodies[x].down) : [g.hero]) {
    const p = g.bodies[h];
    if (p.invT > 0 && p.invT < 90 && Math.floor(time * 20) % 2 === 0) continue;
    c.save();
    c.translate(Math.round(p.x - cam + p.w / 2), Math.round(p.y + p.h));
    c.scale(p.face, 1);
    const w = g.weaponFor(h), level = g.levelOf(p), charge = h === 'dora' && w === 'buster' ? level : w !== 'buster' ? level : 0;
    if (charge) {
      // The Arm Cannon's third level turns the charge ring violet.
      const col = g.gigaFor(h) ? '#e3a8ff' : w === 'buster' ? '#7fd6ff' : WEAPONS[w].color;
      c.strokeStyle = charge === 2 ? (Math.floor(time * 16) % 2 ? '#b6ff7a' : col) : col; c.lineWidth = g.gigaFor(h) ? 3 : 2; c.globalAlpha = 0.7;
      c.beginPath(); c.ellipse(0, -17, 18 + Math.sin(time * 25) * 3, 24, 0, 0, Math.PI * 2); c.stroke(); c.globalAlpha = 1;
    }
    if (p.tagT > 0) { c.fillStyle = `rgba(255,212,106,${p.tagT / TAG_TIME * 0.35})`; ellipse(c, 0, -17, 22, 26); }
    if (p.adT > 0) { c.fillStyle = '#7fd6ff55'; ellipse(c, -18, -15, 14, 6); }
    drawHero(c, h, { run: p.runT, air: !p.ground, dash: p.dashT > 0 || p.adT > 0, slide: !!p.slide, slash: p.slashT > 0 ? (p.dashSlash ? 2 : p.combo) : undefined, charge: h === 'dora' && w === 'buster' ? charge : 0, tint: w === 'buster' ? undefined : WEAPONS[w].color });
    c.restore();
  }
  for (const e of g.effects) {
    const x = e.x - cam, k = e.t / (e.kind === 'debris' ? 1.2 : 0.5);
    c.globalAlpha = 1 - k;
    if (e.kind === 'debris') { c.fillStyle = e.color ?? '#fff'; c.save(); c.translate(x, e.y); c.rotate(e.t * 9); c.fillRect(-3, -3, 6, 6); c.restore(); }
    if (e.kind === 'boom') { c.fillStyle = '#ffd46a'; circle(c, x, e.y, 6 + k * 20); c.fillStyle = '#fff'; circle(c, x, e.y, 3 + k * 8); }
    if (e.kind === 'spark') { c.fillStyle = '#fff'; for (let i = 0; i < 4; i++) circle(c, x + Math.cos(i * 1.6) * k * 16, e.y + Math.sin(i * 1.6) * k * 16, 2); }
    if (e.kind === 'dust') { c.fillStyle = '#e8e0d0'; circle(c, x - k * 12, e.y - 3, 4 * (1 - k) + 2); circle(c, x + k * 12, e.y - 3, 4 * (1 - k) + 2); }
    if (e.kind === 'heal') { c.strokeStyle = '#7dffb0'; c.lineWidth = 2; c.beginPath(); c.arc(x, e.y, 6 + k * 22, 0, Math.PI * 2); c.stroke(); }
    c.globalAlpha = 1;
  }
  c.restore();
  hud(c, g, time);
}

/**
 * The ending: Dora and Enzo walk home across the Andes at sunset while the story lines fade in
 * one by one, then the credits roll. `t` is seconds since it began.
 */
export const ENDING_STORY = 18, ENDING_LENGTH = 40;
export function drawEnding(c: CanvasRenderingContext2D, t: number, story: string[], credits: string[]) {
  const sky = c.createLinearGradient(0, 0, 0, VIEW_H), dusk = Math.min(1, t / ENDING_LENGTH);
  sky.addColorStop(0, dusk > 0.5 ? '#1a1030' : '#2c1a4a');
  sky.addColorStop(0.55, '#e0785a');
  sky.addColorStop(1, '#ffd08a');
  c.fillStyle = sky; c.fillRect(0, 0, VIEW_W, VIEW_H);
  c.fillStyle = '#fff2c0'; circle(c, 700, 300 + dusk * 120, 58);
  c.fillStyle = '#ffffff88'; for (let i = 0; i < 40; i++) if (dusk > (i % 10) / 12) circle(c, (i * 191) % VIEW_W, (i * 67) % 200, 1.3);
  for (const [speed, base, amp, color] of [[8, 330, 120, '#5a3a5a'], [22, 400, 70, '#3a2640']] as const) {
    c.fillStyle = color; c.beginPath(); c.moveTo(0, VIEW_H);
    for (let x = -40; x <= VIEW_W + 40; x += 40) { const k = (x + t * speed) / 120; c.lineTo(x, base - Math.abs(Math.sin(k)) * amp - Math.sin(k * 2.3) * 14); }
    c.lineTo(VIEW_W, VIEW_H); c.fill();
  }
  c.fillStyle = '#2a1c30'; c.fillRect(0, 450, VIEW_W, 90);
  c.fillStyle = '#3a2840'; for (let x = -((t * 60) % 60); x < VIEW_W; x += 60) c.fillRect(x, 452, 30, 4);
  for (const [h, x] of [['dora', 400], ['enzo', 452]] as const) { c.save(); c.translate(x, 450); c.scale(1.6, 1.6); drawHero(c, h, { run: t + (h === 'enzo' ? 0.2 : 0) }); c.restore(); }
  c.textAlign = 'center';
  if (t < ENDING_STORY) {
    story.forEach((line, i) => {
      const a = Math.max(0, Math.min(1, (t - i * 3.5) / 0.8)) * Math.min(1, (ENDING_STORY - t) / 1);
      if (a <= 0) return;
      c.globalAlpha = a; c.fillStyle = '#10141e'; c.font = 'bold 22px ui-monospace, monospace'; c.fillText(line, VIEW_W / 2 + 2, 72 + i * 36);
      c.fillStyle = '#fff'; c.fillText(line, VIEW_W / 2, 70 + i * 36);
    });
  } else {
    // The credits roll up from the bottom.
    const y0 = VIEW_H - (t - ENDING_STORY) * 42;
    c.fillStyle = '#10141e99'; c.fillRect(VIEW_W / 2 - 260, 0, 520, 440);
    credits.forEach((line, i) => {
      const y = y0 + i * 34;
      if (y < -20 || y > 440) return;
      c.globalAlpha = Math.min(1, y / 60, (440 - y) / 60);
      const head = line === line.toUpperCase();
      c.fillStyle = head ? '#ffd46a' : '#fff'; c.font = `bold ${head ? 14 : 20}px ui-monospace, monospace`;
      c.fillText(line, VIEW_W / 2, y);
    });
  }
  c.globalAlpha = 1;
}

function hud(c: CanvasRenderingContext2D, g: PawBusterGame, time: number) {
  const label = (h: HeroId) => { const w = g.weaponFor(h); return w === 'buster' && h === 'enzo' ? 'WHISKER SABER' : WEAPONS[w].name.toUpperCase(); };
  // bar() centres its label, so set the text style after the bars are drawn.
  const text = () => { c.font = 'bold 12px ui-monospace, monospace'; c.textAlign = 'left'; };
  if (g.coop) {
    // Co-op: a full bar, weapon and energy for each hero.
    HEROES.forEach((h, i) => {
      const x = 22 + i * 60, w = g.weaponFor(h);
      c.globalAlpha = g.bodies[h].down ? 0.35 : 1;
      bar(c, x, 40, g.hp[h], g.max, h === 'dora' ? '#7fd6ff' : '#ff9a8a', 14, h === 'dora' ? 'D' : 'E');
      if (w !== 'buster') bar(c, x + 22, 40, g.energy[w], ENERGY, WEAPONS[w].color, 10);
      c.globalAlpha = 1;
    });
    text();
    c.fillStyle = '#10141ecc'; rr(c, 16, 12, 330, 20, 4);
    c.fillStyle = WEAPONS[g.weaponFor('dora')].color; c.fillText(`D ${label('dora')}`, 24, 26);
    c.fillStyle = WEAPONS[g.weaponFor('enzo')].color; c.fillText(`E ${label('enzo')}`, 186, 26);
  } else {
    const other = g.partner;
    bar(c, 22, 40, g.hp[g.hero], g.max, g.hero === 'dora' ? '#7fd6ff' : '#ff9a8a', 14, g.hero === 'dora' ? 'D' : 'E');
    c.globalAlpha = 0.65;
    bar(c, 46, 40, g.hp[other], g.max, other === 'dora' ? '#7fd6ff' : '#ff9a8a', 8, other === 'dora' ? 'D' : 'E');
    c.globalAlpha = 1;
    const w = g.weaponId;
    if (w !== 'buster') bar(c, 66, 40, g.energy[w], ENERGY, WEAPONS[w].color, 10);
    text();
    c.fillStyle = '#10141ecc'; rr(c, 16, 12, 196, 20, 4);
    c.fillStyle = WEAPONS[w].color;
    c.fillText(label(g.hero), 24, 26);
  }
  const m = Math.floor(g.time / 60), s = Math.floor(g.time % 60);
  c.textAlign = 'right';
  c.fillStyle = '#10141ecc'; rr(c, VIEW_W - 120, 12, 104, 20, 4);
  c.fillStyle = '#fff';
  c.fillText(`${m}:${String(s).padStart(2, '0')}`, VIEW_W - 26, 26);
  if (!g.coop && g.player.tagT > 0) { c.textAlign = 'left'; c.fillStyle = '#ffd46a'; c.fillText('TAG STRIKE ×1.5', 222, 26); }
  const b = g.boss;
  if (b) {
    const fill = g.state === 'boss' ? b.max * Math.min(1, 1 - g.introT / g.introMax) : b.hp;
    bar(c, VIEW_W - 38, 40, fill, b.max, '#ffcf5a', 14, '☠');
    // The boss's name, and its weakness once you've found it.
    const info = bossInfo(b.kind), known = info.weakness && g.progress.found.includes(info.id);
    c.textAlign = 'right';
    c.fillStyle = '#10141ecc'; rr(c, VIEW_W - 290, 40, 240, known ? 36 : 20, 4);
    c.fillStyle = '#ffcf5a'; c.fillText(info.bossName.toUpperCase(), VIEW_W - 58, 54);
    if (known) { c.fillStyle = WEAPONS[info.weakness!].color; c.fillText(`WEAK: ${WEAPONS[info.weakness!].name.toUpperCase()}`, VIEW_W - 58, 70); }
    if (g.state === 'boss') introCard(c, g, b, time);
  }
  // A mid-boss guardian on screen gets a health bar of its own.
  const guard = !b && g.enemies.find((e) => e.kind === 'guardian' && e.alive && e.x + e.w > g.camX && e.x < g.camX + VIEW_W);
  if (guard) {
    bar(c, VIEW_W - 38, 40, Math.max(0, guard.hp), g.guardianMax, '#ff9a4a', 14, '!');
    text();
    c.textAlign = 'right';
    c.fillStyle = '#10141ecc'; rr(c, VIEW_W - 250, 40, 200, 20, 4);
    c.fillStyle = '#ff9a4a'; c.fillText(GUARDIANS[g.stage.id].toUpperCase(), VIEW_W - 58, 54);
  }
  // The Scout Helmet's arrows point to collectibles off screen.
  if (g.has('helmet')) {
    for (const it of g.items) {
      if (!KEEPSAKE(it.kind) || (it.x > g.camX && it.x < g.camX + VIEW_W)) continue;
      const right = it.x > g.camX, ax = right ? VIEW_W - 12 : 12, ay = Math.max(100, Math.min(VIEW_H - 30, it.y)), pulse = Math.sin(time * 6) * 2;
      c.fillStyle = it.kind === 'tank' ? '#e8465a' : it.kind === 'sub' ? '#7fd6ff' : '#ffd46a';
      c.beginPath(); c.moveTo(ax + (right ? 6 : -6) + (right ? pulse : -pulse), ay); c.lineTo(ax - (right ? 6 : -6), ay - 9); c.lineTo(ax - (right ? 6 : -6), ay + 9); c.fill();
    }
  }
  if (g.banner.t > 0 && g.banner.text) {
    const alpha = Math.min(1, g.banner.t * 3);
    c.globalAlpha = alpha;
    c.textAlign = 'center';
    const warn = g.banner.text === 'WARNING';
    c.font = `bold ${warn ? 44 : 30}px ui-monospace, monospace`;
    if (warn) { c.fillStyle = '#e0303088'; c.fillRect(0, VIEW_H / 2 - 44, VIEW_W, 64); }
    c.fillStyle = '#10141e';
    c.fillText(g.banner.text, VIEW_W / 2 + 2, VIEW_H / 2 + 2);
    c.fillStyle = warn ? (Math.floor(time * 6) % 2 ? '#fff' : '#ffd46a') : '#fff';
    c.fillText(g.banner.text, VIEW_W / 2, VIEW_H / 2);
    c.globalAlpha = 1;
  }
}
