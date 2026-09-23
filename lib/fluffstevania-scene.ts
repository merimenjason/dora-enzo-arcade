// Fluffstevania in Canvas 2D: painted backdrops per area, stone tiles, the castle's creatures, Dora and Enzo,
// and the HUD. Everything is drawn in the 384×224 view; the page scales it up.
import { drawChinchilla, type ChinId } from './chinchilla-art';
import {
  FluffstevaniaGame, VIEW_W, VIEW_H, TILE, COLS, ROWS, ROOMS, AREAS, FOES, OWL, GEAR, TAG_ARC, TAG_T, TAG_CD,
  isSolid, rawTile, roomRect, type Enemy, type Boss, type Shot, type Pickup, type AreaId, type HeroId,
} from './fluffstevania-game';

type C = CanvasRenderingContext2D;
const HERO_DRAW_H = 27;

type Theme = { sky: [string, string]; brick: string; brickHi: string; brickLo: string; mortar: string; ledge: string; ledgeHi: string; accent: string };
const THEMES: Record<AreaId, Theme> = {
  approach: { sky: ['#0d1030', '#3a2a5a'], brick: '#4a4458', brickHi: '#6c6480', brickLo: '#2c2838', mortar: '#1e1b28', ledge: '#6b4a32', ledgeHi: '#9a7050', accent: '#5f8a4a' },
  hall: { sky: ['#140c22', '#2a1838'], brick: '#4b3e5e', brickHi: '#6e5d86', brickLo: '#2c2340', mortar: '#1b1428', ledge: '#6a5a7e', ledgeHi: '#9888b0', accent: '#b04055' },
  cellar: { sky: ['#1a1008', '#2e1e12'], brick: '#5e4632', brickHi: '#86664a', brickLo: '#38281a', mortar: '#1f150c', ledge: '#7a5634', ledgeHi: '#a8804e', accent: '#d8a040' },
  belfry: { sky: ['#0a1620', '#1c3040'], brick: '#3e5058', brickHi: '#5e7680', brickLo: '#243238', mortar: '#131c20', ledge: '#5a4a3a', ledgeHi: '#86705a', accent: '#7fd8b8' },
};

const hash = (a: number, b: number) => { let h = (a * 374761393 + b * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const ellipse = (c: C, x: number, y: number, rx: number, ry: number, rot = 0) => { c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2); };

// ─── Backdrops (cached per area, drawn with parallax) ─────────────────────

const backdrops = new Map<string, HTMLCanvasElement>();
function backdrop(area: AreaId, roomId: string): HTMLCanvasElement {
  const key = area === 'belfry' && roomId === 'belfry' ? 'belfry-bell' : area;
  const hit = backdrops.get(key);
  if (hit) return hit;
  const W = VIEW_W * 2, H = VIEW_H * 2, cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const c = cv.getContext('2d')!, t = THEMES[area];
  const sky = c.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, t.sky[0]); sky.addColorStop(1, t.sky[1]);
  c.fillStyle = sky; c.fillRect(0, 0, W, H);
  if (area === 'approach') {
    for (let i = 0; i < 160; i++) { c.fillStyle = `rgba(255,255,240,${0.3 + hash(i, 1) * 0.6})`; c.fillRect(hash(i, 2) * W, hash(i, 3) * H * 0.6, 1, 1); }
    // The moon, huge and hazy.
    const mx = W * 0.2, my = H * 0.2;
    const halo = c.createRadialGradient(mx, my, 20, mx, my, 150);
    halo.addColorStop(0, 'rgba(255,240,210,0.35)'); halo.addColorStop(1, 'rgba(255,240,210,0)');
    c.fillStyle = halo; c.fillRect(0, 0, W, H);
    c.fillStyle = '#fff4dc'; ellipse(c, mx, my, 46, 46); c.fill();
    c.fillStyle = 'rgba(210,190,160,0.35)'; ellipse(c, mx - 14, my - 8, 10, 8); c.fill(); ellipse(c, mx + 12, my + 12, 7, 6); c.fill(); ellipse(c, mx + 8, my - 18, 5, 4); c.fill();
    // Mountains, then the castle on its crag.
    c.fillStyle = '#231d3c';
    c.beginPath(); c.moveTo(0, H * 0.7);
    for (let x = 0; x <= W; x += 24) c.lineTo(x, H * 0.52 + Math.sin(x * 0.013) * 30 + Math.sin(x * 0.041) * 12);
    c.lineTo(W, H); c.lineTo(0, H); c.fill();
    c.fillStyle = '#171329';
    const cx = W * 0.38, base = H * 0.62;
    c.beginPath(); c.moveTo(cx - 170, H); c.lineTo(cx - 120, base); c.lineTo(cx + 150, base); c.lineTo(cx + 200, H); c.fill();
    const tower = (x: number, w: number, h: number) => {
      c.fillRect(x - w / 2, base - h, w, h);
      c.beginPath(); c.moveTo(x - w / 2 - 4, base - h); c.lineTo(x, base - h - w * 1.3); c.lineTo(x + w / 2 + 4, base - h); c.fill();
      c.fillStyle = 'rgba(255,200,110,0.8)';
      for (let y = base - h + 14; y < base - 10; y += 22) if (hash(x, y) > 0.4) c.fillRect(x - 2, y, 4, 7);
      c.fillStyle = '#171329';
    };
    c.fillRect(cx - 110, base - 70, 250, 70);
    for (let x = cx - 110; x < cx + 140; x += 14) c.fillRect(x, base - 78, 8, 8);
    tower(cx - 100, 30, 120); tower(cx - 30, 40, 190); tower(cx + 40, 26, 150); tower(cx + 120, 34, 110);
  } else if (area === 'hall') {
    wallBricks(c, W, H, t, 0.55);
    // Tall arched windows with moonlight pouring in.
    for (let i = 0; i < 4; i++) {
      const x = 80 + i * 190, y = 60;
      c.fillStyle = '#0c0a1a'; archPath(c, x, y, 44, 150); c.fill();
      const glass = c.createLinearGradient(x, y, x, y + 150);
      glass.addColorStop(0, '#3a4a8a'); glass.addColorStop(1, '#1a1f40');
      c.fillStyle = glass; archPath(c, x + 4, y + 4, 36, 142); c.fill();
      c.strokeStyle = '#2a2238'; c.lineWidth = 3;
      c.beginPath(); c.moveTo(x + 22, y + 10); c.lineTo(x + 22, y + 146); c.moveTo(x + 4, y + 70); c.lineTo(x + 40, y + 70); c.stroke();
      const beam = c.createLinearGradient(x, y, x + 120, H);
      beam.addColorStop(0, 'rgba(170,190,255,0.16)'); beam.addColorStop(1, 'rgba(170,190,255,0)');
      c.fillStyle = beam; c.beginPath(); c.moveTo(x + 4, y + 20); c.lineTo(x + 40, y + 20); c.lineTo(x + 150, H); c.lineTo(x + 60, H); c.fill();
      // A red banner with the golden wolfberry between windows.
      const bx = x + 118;
      c.fillStyle = '#6a1c2c'; c.beginPath(); c.moveTo(bx, 70); c.lineTo(bx + 30, 70); c.lineTo(bx + 30, 170); c.lineTo(bx + 15, 158); c.lineTo(bx, 170); c.fill();
      c.fillStyle = '#e0b040'; ellipse(c, bx + 15, 110, 7, 9); c.fill();
      c.fillStyle = '#6aa040'; ellipse(c, bx + 19, 100, 4, 2, -0.5); c.fill();
      c.fillStyle = '#3a2a1a'; c.fillRect(bx - 4, 66, 38, 4);
    }
  } else if (area === 'cellar') {
    wallBricks(c, W, H, t, 0.5);
    for (let x = 30; x < W; x += 170) {
      c.fillStyle = '#2a1a0e'; c.fillRect(x, 0, 14, H);
      c.fillStyle = '#3e2a16'; c.fillRect(x + 2, 0, 3, H);
      c.fillStyle = '#2a1a0e'; c.fillRect(x - 40, 40, 94, 10);
    }
    for (let i = 0; i < 9; i++) {
      const x = 60 + i * 86 + hash(i, 4) * 30, y = H - 70;
      if (i % 3 === 0) {
        c.fillStyle = '#b89040'; c.fillRect(x, y + 10, 50, 34);
        c.strokeStyle = '#8a6a28'; c.lineWidth = 1.5;
        for (let s = 0; s < 6; s++) { c.beginPath(); c.moveTo(x + s * 9, y + 10); c.lineTo(x + s * 9 + 4, y + 44); c.stroke(); }
      } else {
        c.fillStyle = '#4a2e18'; ellipse(c, x + 18, y + 26, 18, 24); c.fill();
        c.fillStyle = '#6a4424'; ellipse(c, x + 18, y + 26, 13, 24); c.fill();
        c.fillStyle = '#2a1a0e'; c.fillRect(x, y + 12, 36, 3); c.fillRect(x, y + 38, 36, 3);
      }
    }
    const glow = c.createRadialGradient(W / 2, H / 3, 10, W / 2, H / 3, W * 0.7);
    glow.addColorStop(0, 'rgba(255,170,80,0.12)'); glow.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = glow; c.fillRect(0, 0, W, H);
  } else {
    wallBricks(c, W, H, t, 0.5);
    for (let i = 0; i < 4; i++) {
      const x = 40 + i * 200, y = 40;
      c.fillStyle = '#081018'; archPath(c, x, y, 90, 170); c.fill();
      c.fillStyle = '#0e1e30'; archPath(c, x + 5, y + 5, 80, 165); c.fill();
      for (let s = 0; s < 14; s++) { c.fillStyle = 'rgba(255,255,230,0.7)'; c.fillRect(x + 10 + hash(i, s) * 70, y + 20 + hash(s, i) * 100, 1, 1); }
    }
    if (key === 'belfry-bell') {
      const bx = W * 0.3, by = 30;
      c.strokeStyle = '#3a2e22'; c.lineWidth = 8; c.beginPath(); c.moveTo(bx - 90, by); c.lineTo(bx + 90, by); c.stroke();
      const bell = c.createLinearGradient(bx - 60, 0, bx + 60, 0);
      bell.addColorStop(0, '#5a4a2a'); bell.addColorStop(0.4, '#a88a4a'); bell.addColorStop(1, '#4a3a1e');
      c.fillStyle = bell;
      c.beginPath(); c.moveTo(bx - 30, by + 10); c.quadraticCurveTo(bx - 34, by + 90, bx - 66, by + 120); c.lineTo(bx + 66, by + 120); c.quadraticCurveTo(bx + 34, by + 90, bx + 30, by + 10); c.fill();
      c.fillStyle = '#2e2412'; ellipse(c, bx, by + 120, 66, 8); c.fill();
    }
  }
  backdrops.set(key, cv);
  return cv;
}
function wallBricks(c: C, W: number, H: number, t: Theme, dim: number) {
  for (let y = 0; y < H; y += 20) for (let x = (y / 20) % 2 ? -20 : 0; x < W; x += 40) {
    const n = hash(x, y);
    c.fillStyle = shade(t.brick, dim * (0.8 + n * 0.3));
    c.fillRect(x + 1, y + 1, 38, 18);
  }
}
function archPath(c: C, x: number, y: number, w: number, h: number) {
  c.beginPath(); c.moveTo(x, y + h); c.lineTo(x, y + w / 2); c.quadraticCurveTo(x, y, x + w / 2, y - w * 0.15); c.quadraticCurveTo(x + w, y, x + w, y + w / 2); c.lineTo(x + w, y + h); c.closePath();
}
function shade(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

// ─── Tiles ────────────────────────────────────────────────────────────────

function drawTiles(c: C, g: FluffstevaniaGame, time: number) {
  const t = THEMES[g.room.area], rr = roomRect(g.room);
  const c0 = Math.floor(g.cam.x / TILE) - 1, c1 = Math.floor((g.cam.x + VIEW_W) / TILE) + 1;
  const r0 = Math.floor(g.cam.y / TILE) - 1, r1 = Math.floor((g.cam.y + VIEW_H) / TILE) + 1;
  for (let r = r0; r <= r1; r++) for (let cc = c0; cc <= c1; cc++) {
    const ch = g.tile(cc, r), x = cc * TILE, y = r * TILE;
    if (ch === '#' || ch === '%') {
      const outside = x < rr.x || x >= rr.x + rr.w || y < rr.y || y >= rr.y + rr.h;
      stone(c, x, y, cc, r, t, !isSolid(g.tile(cc, r - 1)), outside);
      if (ch === '%') {
        c.strokeStyle = 'rgba(20,10,20,0.55)'; c.lineWidth = 0.8;
        c.beginPath(); c.moveTo(x + 4, y + 2); c.lineTo(x + 8, y + 7); c.lineTo(x + 6, y + 11); c.lineTo(x + 11, y + 15); c.stroke();
      }
      if (g.room.area === 'approach' && !isSolid(g.tile(cc, r - 1))) {
        c.fillStyle = t.accent; c.fillRect(x, y, TILE, 3);
        c.fillStyle = '#7fae5e';
        for (let i = 0; i < 4; i++) { const gx = x + 2 + i * 4 + hash(cc, i) * 2; c.fillRect(gx, y - 2 - hash(i, cc) * 2, 1, 3); }
      }
    } else if (ch === '=') {
      c.fillStyle = t.ledge; c.fillRect(x, y, TILE, 5);
      c.fillStyle = t.ledgeHi; c.fillRect(x, y, TILE, 1.5);
      c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(x, y + 4, TILE, 1);
      if (g.tile(cc - 1, r) !== '=' || cc % 3 === 0) { c.fillStyle = t.ledge; c.fillRect(x + 6, y + 5, 3, 4); }
    } else if (ch === '^') {
      stone(c, x, y + 10, cc, r, t, false, false, 6);
      c.fillStyle = '#c8ccd8';
      for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(x + i * 4, y + 11); c.lineTo(x + i * 4 + 2, y + 1); c.lineTo(x + i * 4 + 4, y + 11); c.fill(); }
      c.fillStyle = '#8088a0';
      for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(x + i * 4 + 2, y + 1); c.lineTo(x + i * 4 + 4, y + 11); c.lineTo(x + i * 4 + 2.6, y + 11); c.fill(); }
    } else if (ch === 'G') {
      c.fillStyle = '#2a2430';
      for (let i = 0; i < 3; i++) c.fillRect(x + 2 + i * 5, y, 2.4, TILE);
      c.fillRect(x, y + 6, TILE, 2);
      c.fillStyle = '#6a6070'; for (let i = 0; i < 3; i++) c.fillRect(x + 2 + i * 5, y, 0.8, TILE);
    } else if (ch === 'D' && rawTile(cc - 1, r) !== 'D' && rawTile(cc, r - 1) !== 'D') {
      sealedDoor(c, x, y, time);
    } else if (ch === 'S') {
      shrine(c, x + 8, y + 16, time);
    } else if (ch === 'n') {
      c.fillStyle = '#4a3020'; c.fillRect(x + 7, y + 4, 2, 12);
      c.fillStyle = '#8a6040'; c.fillRect(x + 1, y + 1, 14, 8);
      c.fillStyle = '#5a3a24'; c.fillRect(x + 3, y + 3, 10, 1); c.fillRect(x + 3, y + 5.5, 8, 1);
    }
  }
}
function stone(c: C, x: number, y: number, cc: number, r: number, t: Theme, top: boolean, outside: boolean, h = TILE) {
  c.fillStyle = t.mortar; c.fillRect(x, y, TILE, h);
  const off = r % 2 ? 8 : 0;
  for (let row = 0; row < h; row += 8) {
    for (let bx = -off; bx < TILE; bx += 16) {
      const left = Math.max(x, x + bx + 0.5), right = Math.min(x + TILE, x + bx + 15.5);
      if (right <= left) continue;
      const n = hash(cc * 2 + Math.floor((bx + off) / 16), r * 2 + row / 8);
      c.fillStyle = shade(t.brick, (outside ? 0.55 : 0.85) + n * 0.25);
      c.fillRect(left, y + row + 0.5, right - left, Math.min(7, h - row - 0.5));
      c.fillStyle = shade(t.brickHi, outside ? 0.6 : 0.9);
      c.fillRect(left, y + row + 0.5, right - left, 1);
    }
  }
  if (top) { c.fillStyle = t.brickHi; c.fillRect(x, y, TILE, 2); }
}
function sealedDoor(c: C, x: number, y: number, time: number) {
  const w = 64, h = 96;
  c.fillStyle = '#1a1210'; archPath(c, x - 2, y + 2, w + 4, h - 2); c.fill();
  const wood = c.createLinearGradient(x, 0, x + w, 0);
  wood.addColorStop(0, '#4a2e1a'); wood.addColorStop(0.5, '#6a4426'); wood.addColorStop(1, '#3e2614');
  c.fillStyle = wood; archPath(c, x + 2, y + 6, w - 4, h - 6); c.fill();
  c.strokeStyle = '#2a1a0e'; c.lineWidth = 1;
  for (let i = 1; i < 4; i++) { c.beginPath(); c.moveTo(x + 2 + i * 15, y + 14); c.lineTo(x + 2 + i * 15, y + h); c.stroke(); }
  c.fillStyle = '#5a5058'; c.fillRect(x + 2, y + 40, w - 4, 4); c.fillRect(x + 2, y + 72, w - 4, 4);
  c.fillStyle = '#8a7a50'; ellipse(c, x + w / 2, y + 58, 7, 7); c.fill();
  c.fillStyle = '#e8c860'; ellipse(c, x + w / 2, y + 58, 3.5, 4.5); c.fill();
  c.fillStyle = `rgba(210,190,160,${0.25 + Math.sin(time * 1.5) * 0.08})`;
  for (let i = 0; i < 12; i++) c.fillRect(x + hash(i, 7) * w, y + 10 + hash(7, i) * (h - 10), 3, 1);
}
function shrine(c: C, x: number, y: number, time: number) {
  const glow = c.createRadialGradient(x, y - 14, 2, x, y - 14, 34);
  glow.addColorStop(0, `rgba(255,220,140,${0.4 + Math.sin(time * 2) * 0.1})`); glow.addColorStop(1, 'rgba(255,220,140,0)');
  c.fillStyle = glow; c.fillRect(x - 34, y - 48, 68, 60);
  c.fillStyle = '#6a5a70'; c.fillRect(x - 5, y - 10, 10, 10);
  c.fillStyle = '#8a7a90'; c.fillRect(x - 8, y - 2, 16, 2); c.fillRect(x - 7, y - 11, 14, 2);
  c.fillStyle = '#c8962e'; c.beginPath(); c.moveTo(x - 14, y - 20); c.quadraticCurveTo(x, y - 6, x + 14, y - 20); c.closePath(); c.fill();
  c.fillStyle = '#f0c850'; ellipse(c, x, y - 20, 14, 3); c.fill();
  c.fillStyle = '#e8dcc0'; ellipse(c, x, y - 20.5, 11, 2); c.fill();
  for (let i = 0; i < 6; i++) {
    const a = time * 1.3 + i, px = x + Math.sin(a * 1.7) * 10, py = y - 22 - ((time * 12 + i * 7) % 22);
    c.fillStyle = `rgba(255,240,200,${0.8 - ((time * 12 + i * 7) % 22) / 26})`; c.fillRect(px, py, 1.3, 1.3);
  }
}

// ─── Things in the room ───────────────────────────────────────────────────

function candle(c: C, x: number, y: number, time: number) {
  c.fillStyle = '#6a5438'; c.fillRect(x - 5, y - 1, 10, 2); c.fillRect(x - 1, y - 1, 2, 5); c.fillRect(x - 4, y + 3, 8, 1.5);
  c.fillStyle = '#efe6d0'; c.fillRect(x - 2, y - 9, 4, 8);
  const f = Math.sin(time * 14 + x) * 0.6;
  const glow = c.createRadialGradient(x, y - 12, 1, x, y - 12, 18);
  glow.addColorStop(0, 'rgba(255,190,90,0.35)'); glow.addColorStop(1, 'rgba(255,190,90,0)');
  c.fillStyle = glow; c.fillRect(x - 18, y - 30, 36, 36);
  c.fillStyle = '#ffb040'; ellipse(c, x + f * 0.4, y - 12, 2.2, 3.6); c.fill();
  c.fillStyle = '#fff2b0'; ellipse(c, x + f * 0.3, y - 11.5, 1, 2); c.fill();
}

function drawPickup(c: C, p: Pickup, time: number) {
  const bob = p.fixed ? Math.sin(time * 3 + p.x) * 2 : 0, x = p.x, y = p.y - 5 + bob;
  if (p.fixed || p.kind === 'leaf' || p.kind === 'gear') {
    const glow = c.createRadialGradient(x, y, 1, x, y, 14);
    glow.addColorStop(0, p.kind === 'relic' ? 'rgba(200,230,255,0.6)' : 'rgba(255,230,140,0.45)'); glow.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = glow; c.fillRect(x - 14, y - 14, 28, 28);
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
    case 'food':
      if (p.id === 'cake') {
        c.fillStyle = '#d8b050'; c.fillRect(x - 5, y - 2, 10, 6);
        c.fillStyle = '#b08030'; for (let i = 0; i < 4; i++) c.fillRect(x - 4 + i * 2.5, y - 2, 0.8, 6);
        c.fillStyle = '#4a1c3a'; ellipse(c, x, y - 3, 1.8, 1.4); c.fill();
      } else {
        c.fillStyle = '#d0203a'; ellipse(c, x, y + 1, 2.6, 3.4); c.fill();
        c.fillStyle = '#ff8090'; ellipse(c, x - 0.8, y, 0.8, 1); c.fill();
        c.fillStyle = '#4a8030'; c.fillRect(x - 0.5, y - 4, 1, 2);
      }
      break;
    case 'gear': gearIcon(c, p.id, x, y, 1); break;
    case 'leaf':
      c.fillStyle = '#8ac048'; ellipse(c, x, y, 3.6, 6, 0.5); c.fill();
      c.fillStyle = '#e8d060'; ellipse(c, x - 0.6, y - 0.6, 1.8, 4, 0.5); c.fill();
      c.strokeStyle = '#4a7020'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(x - 3, y + 5); c.lineTo(x + 2, y - 4); c.stroke();
      break;
    case 'relic': {
      c.fillStyle = '#e8f4ff'; ellipse(c, x, y, 5, 5); c.fill();
      for (let i = 0; i < 6; i++) {
        const a = time * 3 + (i * Math.PI) / 3;
        c.fillStyle = 'rgba(230,220,200,0.8)'; c.fillRect(x + Math.cos(a) * 9, y + Math.sin(a) * 4, 1.5, 1.5);
      }
      c.fillStyle = '#b0c8e8'; ellipse(c, x - 1.5, y - 1.5, 2, 2); c.fill();
      break;
    }
  }
}
/** A small picture of a piece of gear, for pickups and the menu. */
export function gearIcon(c: C, id: string, x: number, y: number, s: number) {
  const g = GEAR[id];
  c.save(); c.translate(x, y); c.scale(s, s);
  if (g?.style === 'whip') {
    c.strokeStyle = id === 'bramble' ? '#4a8030' : '#e070a0'; c.lineWidth = 1.4;
    c.beginPath(); c.moveTo(-5, 4); c.bezierCurveTo(-1, -6, 3, 6, 6, -4); c.stroke();
    c.fillStyle = '#6a4020'; c.fillRect(-6.5, 3, 3, 3);
  } else if (g?.style === 'claws') {
    c.strokeStyle = '#e8e0d0'; c.lineWidth = 1.2;
    for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(-4 + i * 2, 5); c.quadraticCurveTo(i * 2, -2, 4 + i * 2, -5); c.stroke(); }
  } else if (g?.style === 'club') {
    c.strokeStyle = '#6a4020'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-5, 5); c.lineTo(2, -2); c.stroke();
    c.fillStyle = '#a06a30'; ellipse(c, 3, -3, 3.6, 3.2); c.fill();
    c.fillStyle = '#5a3a1a'; c.fillRect(0, -6.5, 6, 2);
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
  } else {
    c.fillStyle = '#e8c860'; ellipse(c, 0, 0, 4, 4); c.fill();
  }
  c.restore();
}

function drawEnemy(c: C, e: Enemy, time: number) {
  const f = FOES[e.kind], white = e.flash > 0, col = (s: string) => (white ? '#ffffff' : s);
  if (e.dead) { c.globalAlpha = Math.max(0, 1 - e.dead * 2.5); }
  c.save(); c.translate(e.x, e.y);
  switch (e.kind) {
    case 'bat': {
      const hang = e.state === 'idle', flap = Math.sin(time * 18 + e.id) * (hang ? 0.1 : 1);
      if (hang) { c.scale(1, -1); c.translate(0, f.h + 2); }
      c.fillStyle = col('#3a2a4a');
      for (const s of [-1, 1]) {
        c.beginPath(); c.moveTo(0, -6); c.quadraticCurveTo(s * 8, -12 - flap * 5, s * 12, -5 + flap * 3); c.lineTo(s * 8, -4); c.lineTo(s * 5, -2); c.closePath(); c.fill();
      }
      c.fillStyle = col('#4e3a60'); ellipse(c, 0, -5, 4, 4.5); c.fill();
      c.fillStyle = col('#4e3a60'); c.beginPath(); c.moveTo(-3, -8); c.lineTo(-2, -11); c.lineTo(-1, -8); c.moveTo(3, -8); c.lineTo(2, -11); c.lineTo(1, -8); c.fill();
      c.fillStyle = '#ff4050'; c.fillRect(-2, -6.5, 1.2, 1.2); c.fillRect(0.8, -6.5, 1.2, 1.2);
      break;
    }
    case 'moth': {
      const w = Math.sin(time * 10 + e.id) * 0.3;
      for (const s of [-1, 1]) {
        c.fillStyle = col('#c8b8a0'); ellipse(c, s * 6, -9, 6, 4.4, s * (0.5 + w)); c.fill();
        c.fillStyle = col('#a8987e'); ellipse(c, s * 5, -4, 4, 3, s * (-0.4 - w)); c.fill();
        c.fillStyle = white ? '#fff' : '#4a3a5a'; ellipse(c, s * 7, -9.5, 1.6, 1.6); c.fill();
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
      c.strokeStyle = col('#0e1e28'); c.beginPath(); c.moveTo(0, -12); c.lineTo(0, -4); c.stroke();
      c.fillStyle = col('#16262e'); ellipse(c, 9, -4, 3.4, 3); c.fill();
      c.fillStyle = col('#16262e'); c.beginPath(); c.moveTo(10, -6); c.quadraticCurveTo(15, -12, 12, -13); c.lineTo(11, -7); c.fill();
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
      c.fillStyle = col('#f0eadc'); ellipse(c, 3, -15, 2, 2.6); c.fill();
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
      c.fillStyle = col('#c0a07a'); ellipse(c, 9, -10 + crouch, 1.5, 2.5); c.fill();
      c.fillStyle = '#1a1010'; c.fillRect(12, -8 + crouch, 1, 1);
      c.fillStyle = col('#a88a68'); c.beginPath(); c.moveTo(-11, -4); c.lineTo(-16, -2); c.lineTo(-11, -2); c.fill();
      if (!tired) {
        // The shield, held up front.
        c.fillStyle = col('#5a3a24'); ellipse(c, 14, -9 + crouch, 3.4, 8); c.fill();
        c.fillStyle = col('#8a6a40'); ellipse(c, 14.5, -9 + crouch, 2, 6); c.fill();
        c.fillStyle = col('#d8b050'); ellipse(c, 15, -9 + crouch, 1, 1.4); c.fill();
      } else {
        c.fillStyle = 'rgba(255,255,255,0.8)'; c.font = 'bold 6px sans-serif'; c.fillText('z', 6, -18 - Math.sin(time * 4) * 2);
      }
      break;
    }
  }
  c.restore();
  c.globalAlpha = 1;
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
  c.fillStyle = col('#6a5238'); for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * 5, -18); c.lineTo(s * 11, -27); c.lineTo(s * 10, -16); c.fill(); }
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
  } else {
    const d = Math.sign(s.vx);
    c.fillStyle = 'rgba(220,200,170,0.85)';
    c.beginPath(); c.moveTo(-d * 8, 6); c.quadraticCurveTo(0, -10, d * 8, 6); c.fill();
    c.fillStyle = 'rgba(255,240,220,0.6)'; c.beginPath(); c.moveTo(-d * 4, 6); c.quadraticCurveTo(d * 2, -4, d * 7, 6); c.fill();
  }
  c.restore();
}

// ─── Heroes ───────────────────────────────────────────────────────────────

function weaponArc(c: C, g: FluffstevaniaGame, time: number) {
  const b = g.body;
  if (b.attackT <= 0) return;
  const w = g.weaponOf(b.attackHero), into = w.total - b.attackT, u = into / w.total;
  const x = b.x + b.face * 5, y = b.y - 15;
  c.save(); c.translate(x, y); c.scale(b.face, 1);
  if (w.style === 'whip') {
    const color = g.equipped[b.attackHero].weapon === 'bramble' ? '#5a9a38' : '#f07aa8';
    const out = into < w.windup ? -0.3 : Math.min(1, (into - w.windup) / (w.active * 0.7));
    const len = w.reach * Math.max(0.15, out), lift = into < w.windup ? -10 : -4 * (1 - out);
    c.strokeStyle = color; c.lineWidth = 1.8; c.lineCap = 'round';
    c.beginPath(); c.moveTo(0, 0); c.bezierCurveTo(len * 0.3, lift - 6, len * 0.6, lift + 4, len, lift + Math.sin(time * 40) * (out < 1 ? 2 : 0.6)); c.stroke();
    if (out >= 1 && u < 0.75) { c.fillStyle = 'rgba(255,255,255,0.85)'; ellipse(c, len, lift, 2.2, 2.2); c.fill(); }
  } else if (w.style === 'claws') {
    if (into >= w.windup) {
      const a = Math.min(1, (into - w.windup) / w.active);
      c.strokeStyle = `rgba(255,255,255,${1 - u})`; c.lineWidth = 1.2;
      for (let i = -1; i <= 1; i++) { c.beginPath(); c.arc(2, i * 3.4, w.reach * 0.75, -1.1 + i * 0.1, -1.1 + a * 2 + i * 0.1); c.stroke(); }
    }
  } else {
    const a = into < w.windup ? -2.2 : -2.2 + Math.min(1, (into - w.windup) / w.active) * 2.8;
    c.rotate(a);
    c.strokeStyle = '#6a4020'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, 0); c.lineTo(w.reach * 0.75, 0); c.stroke();
    c.fillStyle = '#a06a30'; ellipse(c, w.reach * 0.8, 0, 5, 4.4); c.fill();
    c.fillStyle = '#5a3a1a'; c.fillRect(w.reach * 0.8 - 1, -5, 6, 2.4);
    if (into >= w.windup && into < w.windup + w.active) { c.strokeStyle = 'rgba(255,240,200,0.6)'; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, w.reach * 0.8, -0.4, 0.3); c.stroke(); }
  }
  c.restore();
}

function hero(c: C, id: HeroId, x: number, y: number, face: 1 | -1, time: number, o: { run?: number; moving?: boolean; air?: boolean; alpha?: number; attack?: boolean }) {
  c.globalAlpha = o.alpha ?? 1;
  drawChinchilla(c, id as ChinId, x, y, { face, h: HERO_DRAW_H, time, run: o.run, moving: o.moving, air: o.air, blink: Math.floor(time * 0.6 + (id === 'dora' ? 0 : 0.5)) % 7 === 0 && time % 1.7 < 0.12 });
  c.globalAlpha = 1;
}

function drawHeroes(c: C, g: FluffstevaniaGame, time: number) {
  const b = g.body, f = g.follower, partner = g.partner;
  const tp = g.tagPoint();
  // The partner, a step behind.
  if (g.hp[partner] > 0 && !(g.tag && g.tag.t < TAG_ARC)) hero(c, partner, f.x, f.y, f.face, time + 0.7, { run: f.run, moving: f.moving, air: f.air, alpha: 0.95 });
  else if (g.hp[partner] > 0 && g.tag) hero(c, partner, b.x - b.face * 4, b.y - Math.sin((g.tag.t / TAG_ARC) * Math.PI) * 8, b.face, time, { air: true });
  if (tp && g.tag) {
    // The tag tumble: a spinning ball of fur with a dust ring.
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
      c.font = 'bold 9px Georgia, serif'; c.textAlign = 'center';
      c.lineWidth = 2.5; c.strokeStyle = '#2a1030'; c.strokeText('TAG!', tp.x, tp.y - 20 - g.tag.t * 20);
      c.fillStyle = '#ffd860'; c.fillText('TAG!', tp.x, tp.y - 20 - g.tag.t * 20);
    }
    return;
  }
  const flicker = b.invT > 0 && Math.floor(time * 20) % 2 === 0;
  const moving = Math.abs(b.vx) > 1 && b.ground;
  hero(c, g.leader, b.x, b.y, b.face, time, { run: b.run, moving, air: !b.ground, alpha: flicker ? 0.35 : 1 });
  if (b.dashT > 0) {
    c.fillStyle = 'rgba(240,230,210,0.35)';
    for (let i = 1; i <= 3; i++) { ellipse(c, b.x - b.face * i * 8, b.y - 10, 7 - i, 8 - i * 1.5); c.fill(); }
  }
  weaponArc(c, g, time);
}

// ─── FX, numbers and the HUD ──────────────────────────────────────────────

function drawFx(c: C, g: FluffstevaniaGame) {
  for (const f of g.fx) {
    if (f.t < 0) continue;
    const k = f.t;
    switch (f.kind) {
      case 'dust': c.fillStyle = `rgba(235,225,205,${0.6 - k})`; ellipse(c, f.x, f.y, 2 + k * 8, 1.5 + k * 5); c.fill(); break;
      case 'spark':
        c.strokeStyle = `rgba(255,250,220,${1 - k * 3})`; c.lineWidth = 1.2;
        for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.4, r = 3 + k * 30; c.beginPath(); c.moveTo(f.x + Math.cos(a) * r * 0.4, f.y + Math.sin(a) * r * 0.4); c.lineTo(f.x + Math.cos(a) * r, f.y + Math.sin(a) * r); c.stroke(); }
        break;
      case 'poof':
        for (let i = 0; i < 6; i++) { const a = i * 1.05; c.fillStyle = `rgba(200,180,220,${0.7 - k * 1.4})`; ellipse(c, f.x + Math.cos(a) * k * 30, f.y + Math.sin(a) * k * 22, 4 - k * 4, 4 - k * 4); c.fill(); }
        break;
      case 'clink': c.strokeStyle = `rgba(200,220,255,${1 - k * 3})`; c.lineWidth = 1.5; c.beginPath(); c.arc(f.x, f.y, 3 + k * 20, -1, 1); c.stroke(); break;
      case 'flame': c.fillStyle = `rgba(255,170,60,${0.8 - k * 1.6})`; ellipse(c, f.x, f.y - k * 12, 3 - k * 4, 5 - k * 6); c.fill(); break;
      case 'rubble': c.fillStyle = `rgba(110,100,120,${1 - k})`; c.fillRect(f.x - 1.5, f.y - 1.5, 3, 3); break;
      case 'boom': {
        const gr = c.createRadialGradient(f.x, f.y, 0, f.x, f.y, 6 + k * 30);
        gr.addColorStop(0, `rgba(255,240,200,${1 - k * 1.6})`); gr.addColorStop(1, 'rgba(255,120,40,0)');
        c.fillStyle = gr; ellipse(c, f.x, f.y, 6 + k * 30, 6 + k * 30); c.fill();
        break;
      }
      case 'feather': c.fillStyle = `rgba(138,112,80,${1 - k * 1.8})`; ellipse(c, f.x, f.y, 4, 1.5, k * 8); c.fill(); break;
      case 'star':
        c.fillStyle = `rgba(255,220,90,${1 - k * 2})`;
        for (let i = 0; i < 5; i++) { const a = i * 1.256 + k * 4; c.fillRect(f.x + Math.cos(a) * k * 40 - 1, f.y + Math.sin(a) * k * 40 - 1, 2, 2); }
        break;
    }
  }
  c.textAlign = 'center';
  c.font = 'bold 8px "Trebuchet MS", sans-serif';
  for (const p of g.pops) {
    c.globalAlpha = Math.min(1, (0.9 - p.t) * 4);
    c.lineWidth = 2.4; c.strokeStyle = '#1a0e20'; c.strokeText(p.text, p.x, p.y);
    c.fillStyle = p.color; c.fillText(p.text, p.x, p.y);
  }
  c.globalAlpha = 1;
}

function bar(c: C, x: number, y: number, w: number, h: number, v: number, max: number, color: string) {
  c.fillStyle = '#1a1020'; c.fillRect(x - 1, y - 1, w + 2, h + 2);
  c.fillStyle = '#3a2a40'; c.fillRect(x, y, w, h);
  c.fillStyle = color; c.fillRect(x, y, w * Math.max(0, Math.min(1, v / max)), h);
  c.fillStyle = 'rgba(255,255,255,0.25)'; c.fillRect(x, y, w * Math.max(0, Math.min(1, v / max)), 1);
}

function portrait(c: C, id: HeroId, x: number, y: number, r: number, time: number, down: boolean) {
  c.save();
  c.fillStyle = '#1a1020'; ellipse(c, x, y, r + 1.5, r + 1.5); c.fill();
  c.fillStyle = id === 'dora' ? '#3a2a4e' : '#2a3a4e'; ellipse(c, x, y, r, r); c.fill();
  c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.clip();
  if (down) c.globalAlpha = 0.35;
  // Frame the head: it sits at about (12, -14) in the drawing's 24-unit frame.
  const s = (r * 3.2) / 24;
  drawChinchilla(c, id as ChinId, x - 12 * s * 0.95, y + 14.5 * s, { face: 1, h: r * 3.2, time });
  c.restore();
  c.strokeStyle = id === 'dora' ? '#f0a8c0' : '#a8c8f0'; c.lineWidth = 1; ellipse(c, x, y, r, r); c.stroke();
}

function drawHud(c: C, g: FluffstevaniaGame, time: number) {
  const lead = g.leader, part = g.partner, ls = g.stats(lead), ps = g.stats(part);
  c.fillStyle = 'rgba(12,6,20,0.55)'; c.fillRect(4, 4, 134, 34);
  c.strokeStyle = 'rgba(220,190,120,0.5)'; c.lineWidth = 0.6; c.strokeRect(4.5, 4.5, 133, 33);
  portrait(c, lead, 20, 21, 12, time, false);
  c.textAlign = 'left'; c.font = 'bold 7px Georgia, serif'; c.fillStyle = '#f0dca0';
  c.fillText(`${lead === 'dora' ? 'DORA' : 'ENZO'}  Lv ${g.level}`, 36, 12);
  bar(c, 36, 15, 76, 5, g.hp[lead], ls.maxHp, g.hp[lead] / ls.maxHp < 0.3 ? '#e04848' : '#58c878');
  c.font = '6px "Trebuchet MS", sans-serif'; c.fillStyle = '#e8e0f0';
  c.fillText(`${g.hp[lead]}/${ls.maxHp}`, 114, 20);
  // The partner, smaller, with the tag cooldown.
  portrait(c, part, 42, 30, 5, time, g.hp[part] <= 0);
  bar(c, 50, 28, 40, 3, g.hp[part], ps.maxHp, '#6a9ad8');
  if (g.tagCd > 0) { c.strokeStyle = '#ffd860'; c.lineWidth = 1; c.beginPath(); c.arc(42, 30, 6.5, -Math.PI / 2, -Math.PI / 2 + (1 - g.tagCd / TAG_CD) * Math.PI * 2); c.stroke(); }
  c.fillStyle = g.hp[part] > 0 ? '#b8c8e8' : '#a07080'; c.font = '5.5px "Trebuchet MS", sans-serif';
  c.fillText(g.hp[part] > 0 ? (g.tagCd > 0 ? 'TAG…' : 'C: TAG') : 'RESTING', 93, 31);
  // Seeds and raisins.
  c.fillStyle = '#2a2a2a'; ellipse(c, 118, 29, 1.6, 3); c.fill();
  c.fillStyle = '#f0e8d8'; c.font = '6px "Trebuchet MS", sans-serif'; c.fillText(`${g.seeds}`, 122, 31);
  c.fillStyle = 'rgba(12,6,20,0.55)'; c.fillRect(4, 40, 52, 11);
  c.fillStyle = '#6a2c50'; ellipse(c, 11, 45.5, 3, 2.4); c.fill();
  c.fillStyle = '#f0e8d8'; c.fillText(`${g.raisins}`, 17, 48);
  const need = g.level < 99 ? g.xp : 0;
  c.fillStyle = '#c8b8e0'; c.font = '5px "Trebuchet MS", sans-serif'; c.fillText(`XP ${need}`, 31, 48);
  minimap(c, g, VIEW_W - 70, 5, time);
  if (g.boss) {
    const o = g.boss, w = 200, x = (VIEW_W - w) / 2, y = VIEW_H - 16;
    c.fillStyle = 'rgba(12,6,20,0.65)'; c.fillRect(x - 6, y - 10, w + 12, 20);
    c.font = 'bold 7px Georgia, serif'; c.textAlign = 'center'; c.fillStyle = '#f0c8a0'; c.fillText(OWL.name.toUpperCase(), VIEW_W / 2, y - 2);
    bar(c, x, y + 2, w, 4, o.hp, o.max, o.phase2 ? '#e05040' : '#d8a040');
  }
  if (g.banner) {
    const a = Math.min(1, g.banner.t * 1.5, (2.4 - g.banner.t) * 3);
    c.globalAlpha = a;
    c.fillStyle = 'rgba(10,4,16,0.6)'; c.fillRect(VIEW_W / 2 - 90, 60, 180, 26);
    c.strokeStyle = '#c8a860'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(VIEW_W / 2 - 80, 64); c.lineTo(VIEW_W / 2 + 80, 64); c.moveTo(VIEW_W / 2 - 80, 82); c.lineTo(VIEW_W / 2 + 80, 82); c.stroke();
    c.font = 'bold 11px Georgia, serif'; c.textAlign = 'center'; c.fillStyle = '#f0dca0'; c.fillText(g.banner.text, VIEW_W / 2, 77);
    c.globalAlpha = 1;
  }
  if (g.toast) {
    c.font = '7px "Trebuchet MS", sans-serif'; c.textAlign = 'center';
    const w = Math.min(VIEW_W - 20, c.measureText(g.toast.text).width + 16), y = g.boss ? VIEW_H - 44 : VIEW_H - 22;
    c.globalAlpha = Math.min(1, g.toast.t * 3);
    c.fillStyle = 'rgba(12,6,20,0.8)'; c.fillRect((VIEW_W - w) / 2, y - 9, w, 13);
    c.fillStyle = '#f8ecd0'; c.fillText(g.toast.text, VIEW_W / 2, y);
    c.globalAlpha = 1;
  }
  if (g.atSign && !g.dialog) {
    const b = g.body, x = b.x - g.cam.x, y = b.y - g.cam.y - 34 + Math.sin(time * 5) * 1.5;
    c.font = 'bold 7px "Trebuchet MS", sans-serif'; c.textAlign = 'center';
    c.fillStyle = 'rgba(12,6,20,0.8)'; c.fillRect(x - 17, y - 8, 34, 11);
    c.fillStyle = '#ffe0a0'; c.fillText('↑ READ', x, y);
  }
}

function minimap(c: C, g: FluffstevaniaGame, x0: number, y0: number, time: number) {
  const cw = 9, ch = 6, span = 7, spanY = 5;
  const bx = Math.floor(g.body.x / VIEW_W), by = Math.floor((g.body.y - 10) / VIEW_H);
  c.fillStyle = 'rgba(12,6,20,0.6)'; c.fillRect(x0 - 2, y0 - 2, cw * span + 4, ch * spanY + 4);
  for (let dy = 0; dy < spanY; dy++) for (let dx = 0; dx < span; dx++) {
    const mx = bx - 3 + dx, my = by - 2 + dy;
    const room = ROOMS.find((r) => mx >= r.mx && mx < r.mx + r.w && my >= r.my && my < r.my + r.h);
    if (!room || !g.visited.has(`${mx},${my}`)) continue;
    const px = x0 + dx * cw, py = y0 + dy * ch;
    const save = room.rows.some((row) => row.includes('S'));
    c.fillStyle = save ? '#b03040' : room.boss ? '#806020' : '#2a4a8a';
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
    const save = room.rows.some((row) => row.includes('S'));
    c.fillStyle = save ? '#a02838' : room.boss ? '#7a5a18' : shade(AREAS[room.area].color, 0.45);
    c.fillRect(px, py, cell, ch);
    c.strokeStyle = '#e8ecf8'; c.lineWidth = 2;
    c.beginPath();
    if (dx === 0) { c.moveTo(px + 1, py); c.lineTo(px + 1, py + ch); }
    if (dx === room.w - 1) { c.moveTo(px + cell - 1, py); c.lineTo(px + cell - 1, py + ch); }
    if (dy === 0) { c.moveTo(px, py + 1); c.lineTo(px + cell, py + 1); }
    if (dy === room.h - 1) { c.moveTo(px, py + ch - 1); c.lineTo(px + cell, py + ch - 1); }
    c.stroke();
    // Doorways: gaps where the room opens into a neighbour.
    c.fillStyle = shade(AREAS[room.area].color, 0.45);
    const tc = mx * COLS, tr = my * ROWS;
    if (dx === 0 && !isSolid(rawTile(tc, tr + 10)) ) c.fillRect(px, py + ch * 0.35, 3, ch * 0.3);
    if (dx === room.w - 1 && !isSolid(rawTile(tc + COLS - 1, tr + 10))) c.fillRect(px + cell - 3, py + ch * 0.35, 3, ch * 0.3);
  }
  const bx = g.body.x / VIEW_W - minX, by = (g.body.y - 10) / VIEW_H - minY;
  if (Math.floor(time * 3) % 2 === 0) { c.fillStyle = '#ffffff'; ellipse(c, ox + bx * cell, oy + by * ch, 3, 3); c.fill(); }
}

// ─── The frame ────────────────────────────────────────────────────────────

export function drawGame(c: C, g: FluffstevaniaGame, time: number) {
  const area = g.room.area, rr = roomRect(g.room);
  const bg = backdrop(area, g.room.id);
  const px = area === 'approach' ? 0.25 : 0.5;
  const ox = -((g.cam.x - rr.x) * px) % (bg.width - VIEW_W), oy = -((g.cam.y - rr.y) * px) % Math.max(1, bg.height - VIEW_H);
  c.drawImage(bg, Math.round(ox), Math.round(oy));
  const sx = g.shake > 0 ? (Math.sin(time * 90) * 2) : 0, sy = g.shake > 0 ? Math.cos(time * 70) * 1.5 : 0;
  c.save();
  c.translate(Math.round(-g.cam.x + sx), Math.round(-g.cam.y + sy));
  drawTiles(c, g, time);
  for (const k of g.candles) if (k.alive) candle(c, k.x, k.y, time);
  for (const p of g.pickups) drawPickup(c, p, time);
  // A pedestal under the relic, even after it's taken.
  if (g.room.relic) {
    for (let r = 0; r < g.room.rows.length; r++) { const col = g.room.rows[r].indexOf('R'); if (col >= 0) { const x = (g.room.mx * COLS + col) * TILE, y = (g.room.my * ROWS + r + 1) * TILE; c.fillStyle = '#8a7a9a'; c.fillRect(x - 12, y, 40, 3); } }
  }
  for (const e of g.enemies) drawEnemy(c, e, time);
  if (g.boss) drawOwl(c, g.boss, time);
  drawHeroes(c, g, time);
  for (const s of g.shots) drawShot(c, s);
  drawFx(c, g);
  c.restore();
  // Light and air: moonlit haze outside, a warm vignette inside.
  const vig = c.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.35, VIEW_W / 2, VIEW_H / 2, VIEW_W * 0.7);
  vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, area === 'cellar' ? 'rgba(20,8,0,0.55)' : 'rgba(6,2,14,0.55)');
  c.fillStyle = vig; c.fillRect(0, 0, VIEW_W, VIEW_H);
  if (area === 'approach') {
    c.fillStyle = 'rgba(180,170,230,0.05)';
    for (let i = 0; i < 3; i++) { ellipse(c, ((time * (8 + i * 4) + i * 140) % (VIEW_W + 200)) - 100, VIEW_H - 26 - i * 10, 90, 6); c.fill(); }
  }
  drawHud(c, g, time);
}
