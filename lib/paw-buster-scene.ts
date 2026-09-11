// Canvas 2D art for Paw Buster X: flat pixel-style shapes, no image assets.
import { TILE, ROWS, VIEW_W, VIEW_H, WEAPONS, ENERGY, TAG_TIME, type PawBusterGame, type StageId, type BossKind, type HeroId, type Enemy, type Shot } from './paw-buster-game';

type Theme = { sky: [string, string]; far: string; near: string; ground: string; dark: string; top: string; spike: string; accent: string };
export const THEMES: Record<StageId, Theme> = {
  snowcap: { sky: ['#7fa9dc', '#dcecff'], far: '#b9cde6', near: '#8aa3c4', ground: '#617391', dark: '#4a5874', top: '#f4f8ff', spike: '#bfe9ff', accent: '#ffffff' },
  cloud: { sky: ['#8cc6b0', '#e6f2d8'], far: '#8cb89a', near: '#5f8c6c', ground: '#5b4a3a', dark: '#453729', top: '#7fbf5a', spike: '#3b5a2c', accent: '#f3fbe8' },
  caldera: { sky: ['#2c1420', '#c8553a'], far: '#62302c', near: '#43201f', ground: '#3b2f33', dark: '#2a2125', top: '#ff8a3d', spike: '#ffb347', accent: '#ffd08a' },
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
  if (id === 'citadel') { c.fillStyle = '#fff6'; for (let i = 0; i < 50; i++) circle(c, (i * 191) % VIEW_W, (i * 67) % 240, (i + Math.floor(time * 2)) % 7 ? 1 : 1.8); c.fillStyle = '#ffd46a'; for (let i = 0; i < 14; i++) { const x = ((i * 150 - cam * 0.35) % (VIEW_W + 150) + VIEW_W + 150) % (VIEW_W + 150) - 75; c.fillRect(x, 330 + (i % 3) * 14, 6, 9); } }
}

function tiles(c: CanvasRenderingContext2D, g: PawBusterGame) {
  const t = THEMES[g.stage.id], cam = Math.round(g.camX), c0 = Math.floor(cam / TILE), c1 = c0 + Math.ceil(VIEW_W / TILE) + 1;
  for (let col = c0; col <= c1 && col < g.map.cols; col++) {
    for (let r = 0; r < ROWS; r++) {
      const k = g.tile(col, r);
      if (!k) continue;
      const x = col * TILE - cam, y = r * TILE, open = !g.tile(col, r - 1);
      if (k === 2) {
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
      if (g.stage.id === 'caldera' && (col * 7 + r * 3) % 5 === 0) { c.fillStyle = '#ff6a2a88'; c.fillRect(x + 8, y + 12, 12, 2); c.fillRect(x + 14, y + 12, 2, 9); }
      if (open) {
        c.fillStyle = t.top;
        c.fillRect(x, y, TILE, 6);
        if (g.stage.id === 'snowcap') { c.fillRect(x + 4, y + 6, 6, 3); c.fillRect(x + 18, y + 6, 8, 2); }
        if (g.stage.id === 'cloud') { c.fillRect(x + 6, y - 3, 3, 3); c.fillRect(x + 20, y - 4, 3, 4); }
      }
    }
  }
  // The boss gate, drawn as a shutter across the arena entrance.
  const gx = g.map.arena * TILE - cam;
  if (gx > -TILE && gx < VIEW_W) {
    c.fillStyle = g.fight ? '#c9ced9' : '#c9ced955';
    for (let y = 0; y < (ROWS - 3) * TILE; y += 12) c.fillRect(gx + 2, y, TILE - 4, 8);
    c.fillStyle = '#e05a4a';
    c.fillRect(gx + 11, (ROWS - 3) * TILE - 60, 8, 8);
  }
}

/** A chinchilla in armour, drawn around its feet (0,0), facing right. Dora wears blue, Enzo red. */
export function drawHero(c: CanvasRenderingContext2D, hero: HeroId, opts: { run?: number; air?: boolean; dash?: boolean; slide?: boolean; slash?: number; charge?: number; aim?: boolean } = {}) {
  const dora = hero === 'dora', fur = dora ? '#f4efe6' : '#8d8a93', furDark = dora ? '#d8d0c3' : '#6c6972', armor = dora ? '#3b7be0' : '#d24a3c', armorDark = dora ? '#2a58a8' : '#9c2f26';
  const bob = opts.run ? Math.abs(Math.sin(opts.run * 14)) * 2 : 0, stride = opts.run ? Math.sin(opts.run * 14) * 4 : 0;
  c.save();
  if (opts.dash) c.rotate(0.14);
  // Tail: Dora's is a round puff, Enzo's a long banner like a flowing ponytail.
  c.fillStyle = fur;
  if (dora) ellipse(c, -13, -12 - bob, 8, 7);
  else { c.beginPath(); c.moveTo(-8, -24); c.quadraticCurveTo(-26, -26 + Math.sin((opts.run ?? 0) * 10) * 3, -30, -8); c.quadraticCurveTo(-20, -14, -8, -14); c.fill(); }
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
  c.fillStyle = '#111';
  circle(c, 8, hy + 1, 2);
  c.fillStyle = '#fff';
  circle(c, 8.6, hy + 0.3, 0.7);
  c.fillStyle = '#c98a8a';
  circle(c, 12, hy + 4, 1.4);
  c.strokeStyle = dora ? '#bbb4a8' : '#c7c2cc';
  c.lineWidth = 0.8;
  c.beginPath();
  c.moveTo(11, hy + 4); c.lineTo(18, hy + 2); c.moveTo(11, hy + 5); c.lineTo(18, hy + 6);
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
  } else {
    c.fillStyle = '#6d6a64'; rr(c, -13, -20, 26, 20, 3);
    c.fillStyle = '#8b877e'; rr(c, -11, -28, 22, 12, 5);
    c.fillStyle = '#fff'; circle(c, 4, -22, 4.5); c.fillStyle = '#d84a3a'; circle(c, 6, -22, 2.4);
  }
  c.restore();
}

/** The four mavericks, drawn around their feet (0,0), facing right. Also used for stage-select portraits. */
export function drawBoss(c: CanvasRenderingContext2D, kind: BossKind, time: number, state: { move?: string; hidden?: boolean } = {}) {
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
    case 'frost': c.fillStyle = WEAPONS.frost.color; c.beginPath(); c.moveTo(12 * Math.sign(s.vx), 0); c.lineTo(0, -6); c.lineTo(-10 * Math.sign(s.vx), 0); c.lineTo(0, 6); c.fill(); break;
    case 'gale': c.rotate(Math.atan2(s.vy, s.vx)); c.fillStyle = WEAPONS.gale.color; ellipse(c, 0, 0, 10, 3.5); c.fillStyle = '#7aa860'; c.fillRect(-10, -0.5, 18, 1); break;
    case 'ember': c.fillStyle = '#ff5a2a88'; circle(c, -Math.sign(s.vx) * 7, 0, 7); c.fillStyle = WEAPONS.ember.color; circle(c, 0, 0, 8); c.fillStyle = '#fff2b0'; circle(c, 1, -1, 3.5); break;
    case 'pellet': c.fillStyle = '#ff5a4a'; circle(c, 0, 0, 5); c.fillStyle = '#ffd0c8'; circle(c, 1, -1, 2); break;
    case 'shard': c.rotate(Math.atan2(s.vy, s.vx)); c.fillStyle = '#dff4ff'; c.beginPath(); c.moveTo(10, 0); c.lineTo(-6, -5); c.lineTo(-6, 5); c.fill(); break;
    case 'feather': c.rotate(Math.atan2(s.vy, s.vx)); c.fillStyle = '#d4d7e2'; ellipse(c, 0, 0, 9, 3); break;
    case 'fire': c.fillStyle = '#ff7a2a'; circle(c, 0, 0, 7); c.fillStyle = '#ffe07a'; circle(c, 0, 0, 3.5); break;
    case 'wave': c.fillStyle = '#e6f3ffcc'; c.beginPath(); c.moveTo(-10, 10); c.lineTo(0, -12 + Math.sin(time * 30) * 2); c.lineTo(10, 10); c.fill(); break;
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

export function drawStage(c: CanvasRenderingContext2D, g: PawBusterGame, time: number) {
  const cam = Math.round(g.camX), p = g.player;
  c.save();
  if (g.shake > 0) c.translate(Math.sin(time * 90) * 4 * g.shake * 5, Math.cos(time * 70) * 3 * g.shake * 5);
  backdrop(c, g.stage.id, cam, time);
  tiles(c, g);
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
    else if (it.kind === 'hp') { c.fillStyle = '#fff'; rr(c, x - 7, y - 6, 14, 12, 3); c.fillStyle = '#e8465a'; c.fillRect(x - 1.5, y - 4, 3, 8); c.fillRect(x - 4, y - 1.5, 8, 3); }
    else { c.fillStyle = '#7fd6ff'; rr(c, x - 6, y - 7, 12, 14, 3); c.fillStyle = '#fff'; c.fillRect(x - 3, y - 4, 6, 2); }
  }
  for (const e of g.enemies) if (e.x + e.w > cam - 20 && e.x < cam + VIEW_W + 20) enemy(c, e, g, cam);
  const b = g.boss;
  if (b) {
    if (b.kind === 'snake' && b.hidden && b.t > 0.45) { c.fillStyle = `rgba(255,120,40,${0.35 + Math.sin(time * 30) * 0.2})`; c.fillRect(b.x - cam, (ROWS - 3) * TILE - 8, b.w, 8); }
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
  // The active hero; blinks while invulnerable.
  if (!(p.invT > 0 && p.invT < 90 && Math.floor(time * 20) % 2 === 0)) {
    c.save();
    c.translate(Math.round(p.x - cam + p.w / 2), Math.round(p.y + p.h));
    c.scale(p.face, 1);
    const charge = g.hero === 'dora' && g.weaponId === 'buster' ? g.chargeLevel : 0;
    if (charge) { c.strokeStyle = charge === 2 ? (Math.floor(time * 16) % 2 ? '#b6ff7a' : '#7fd6ff') : '#7fd6ff'; c.lineWidth = 2; c.globalAlpha = 0.7; c.beginPath(); c.ellipse(0, -17, 18 + Math.sin(time * 25) * 3, 24, 0, 0, Math.PI * 2); c.stroke(); c.globalAlpha = 1; }
    if (p.tagT > 0) { c.fillStyle = `rgba(255,212,106,${p.tagT / TAG_TIME * 0.35})`; ellipse(c, 0, -17, 22, 26); }
    drawHero(c, g.hero, { run: p.runT, air: !p.ground, dash: p.dashT > 0, slide: !!p.slide, slash: p.slashT > 0 ? p.combo : undefined, charge });
    c.restore();
  }
  for (const e of g.effects) {
    const x = e.x - cam, k = e.t / 0.5;
    c.globalAlpha = 1 - k;
    if (e.kind === 'boom') { c.fillStyle = '#ffd46a'; circle(c, x, e.y, 6 + k * 20); c.fillStyle = '#fff'; circle(c, x, e.y, 3 + k * 8); }
    if (e.kind === 'spark') { c.fillStyle = '#fff'; for (let i = 0; i < 4; i++) circle(c, x + Math.cos(i * 1.6) * k * 16, e.y + Math.sin(i * 1.6) * k * 16, 2); }
    if (e.kind === 'dust') { c.fillStyle = '#e8e0d0'; circle(c, x - k * 12, e.y - 3, 4 * (1 - k) + 2); circle(c, x + k * 12, e.y - 3, 4 * (1 - k) + 2); }
    if (e.kind === 'heal') { c.strokeStyle = '#7dffb0'; c.lineWidth = 2; c.beginPath(); c.arc(x, e.y, 6 + k * 22, 0, Math.PI * 2); c.stroke(); }
    c.globalAlpha = 1;
  }
  c.restore();
  hud(c, g, time);
}

function hud(c: CanvasRenderingContext2D, g: PawBusterGame, time: number) {
  const other = g.partner;
  bar(c, 22, 40, g.hp[g.hero], g.max, g.hero === 'dora' ? '#7fd6ff' : '#ff9a8a', 14, g.hero === 'dora' ? 'D' : 'E');
  c.globalAlpha = 0.65;
  bar(c, 46, 40, g.hp[other], g.max, other === 'dora' ? '#7fd6ff' : '#ff9a8a', 8, other === 'dora' ? 'D' : 'E');
  c.globalAlpha = 1;
  const w = g.weaponId;
  if (w !== 'buster') bar(c, 66, 40, g.energy[w], ENERGY, WEAPONS[w].color, 10);
  c.font = 'bold 12px ui-monospace, monospace';
  c.textAlign = 'left';
  c.fillStyle = '#10141ecc'; rr(c, 16, 12, 196, 20, 4);
  c.fillStyle = WEAPONS[w].color;
  c.fillText(`${w === 'buster' && g.hero === 'enzo' ? 'WHISKER SABER' : WEAPONS[w].name.toUpperCase()}`, 24, 26);
  const m = Math.floor(g.time / 60), s = Math.floor(g.time % 60);
  c.textAlign = 'right';
  c.fillStyle = '#10141ecc'; rr(c, VIEW_W - 120, 12, 104, 20, 4);
  c.fillStyle = '#fff';
  c.fillText(`${m}:${String(s).padStart(2, '0')}`, VIEW_W - 26, 26);
  if (g.player.tagT > 0) { c.textAlign = 'left'; c.fillStyle = '#ffd46a'; c.fillText('TAG STRIKE ×1.5', 222, 26); }
  const b = g.boss;
  if (b) {
    const fill = g.state === 'boss' ? b.max * Math.min(1, 1 - g.introT / 2.2) : b.hp;
    bar(c, VIEW_W - 38, 40, fill, b.max, '#ffcf5a', 14, '☠');
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
