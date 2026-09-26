// Canvas 2D drawing for Chinchilla Clash: the arena with its river and bridges, the crown towers with their
// chinchilla keepers, every troop (the shared Dora and Enzo drawing in team vests, plus a capybara, sugar gliders and a
// hay balloon), shots, spells in flight, effects and the placement ghost. The arena is 18 × 32 tiles of 20 px.
import {
  ClashGame, CARDS, W, H, RIVER_TOP, RIVER_BOTTOM, BRIDGES, BRIDGE_HALF, TOWER_SPOTS, local,
  type CardId, type Side, type Unit, type Blast, type Effect,
} from './chinchilla-clash-game';
import { COATS, coatLike, drawChinchilla, type Coat } from './chinchilla-art';

export const TILE = 20, VIEW_W = W * TILE, VIEW_H = H * TILE;
export const toTiles = (px: number, py: number) => ({ x: px / TILE, y: py / TILE });

const TEAM = [{ main: '#4f9dff', dark: '#1f5fb8', trim: '#e2f0ff' }, { main: '#ff5a64', dark: '#b3232f', trim: '#ffe3e3' }];

type Arena = { grassA: string; grassB: string; path: string; edge: string; water: string; waterLight: string; bank: string; plank: string; plankDark: string; deco: 'salt' | 'cactus' | 'moon'; sky: string };
const ARENAS: Record<string, Arena> = {
  beige: { grassA: '#8fc46a', grassB: '#86bb62', path: '#d9c79a', edge: '#e8dcc0', water: '#5fb6e8', waterLight: '#a8e0ff', bank: '#c9b07a', plank: '#b98a55', plankDark: '#7d5a33', deco: 'salt', sky: '#f3ecd9' },
  violet: { grassA: '#9cbf63', grassB: '#93b65b', path: '#e0b07a', edge: '#d49a62', water: '#4fa3cf', waterLight: '#9fd6f2', bank: '#b98452', plank: '#9c6a3c', plankDark: '#6a4524', deco: 'cactus', sky: '#e8b384' },
  ebony: { grassA: '#4f7a5a', grassB: '#497253', path: '#8d8fa8', edge: '#3c3f5c', water: '#3868a8', waterLight: '#7aa4e0', bank: '#5b5a78', plank: '#7a6352', plankDark: '#4c3b30', deco: 'moon', sky: '#232846' },
};

const blackEyes = { eye: '#16121a', pupil: '#000000', earGlow: false, eyeR: 1.75 };
/** The rival clans are chinchilla colour types: beige, violet and ebony. */
const RIVAL_COATS: Record<string, Coat[]> = {
  beige: [
    coatLike('dora', { fur: '#ecd6b3', back: '#d8bc90', face: '#f4e4cb', shade: '#caa97e', texture: '#cfb48b', tail: '#e9d2ad', tailInner: '#d0b58c', ear: '#eab9a2', earIn: '#df9c85' }),
    coatLike('dora', { fur: '#e3c9a1', back: '#cbab7c', face: '#efdcbf', shade: '#bf9d6f', texture: '#c4a67a', tail: '#dfc49b', tailInner: '#c6a87d', ear: '#e3ad94', earIn: '#d8917a' }),
  ],
  violet: [
    coatLike('enzo', { fur: '#a097ae', back: '#7c7190', face: '#b6aec2', shade: '#8a809d', texture: '#776c8a', tail: '#9a90a9', tailOuter: '#72688b', tailInner: '#bab1c7', ear: '#a296ad', earIn: '#c4a9bd' }),
    coatLike('enzo', { fur: '#968ca6', back: '#716787', face: '#aca4ba', shade: '#81779a', texture: '#6e6482', tail: '#90869f', tailOuter: '#6a6082', tailInner: '#b0a7bf', ear: '#998da6', earIn: '#bca1b6' }),
  ],
  ebony: [
    coatLike('enzo', { fur: '#403d46', back: '#222026', face: '#514e58', shade: '#2e2c33', texture: '#29272e', belly: '#5e5b66', tail: '#34323a', tailOuter: '#1e1c22', tailInner: '#56535d', ear: '#4a4650', earIn: '#6d5f6a', whiskerAlt: '#bdb8c6' }),
    coatLike('enzo', { fur: '#4a4750', back: '#2a282e', face: '#5b5862', shade: '#36343b', texture: '#302e35', belly: '#67646f', tail: '#3c3a42', tailOuter: '#242228', tailInner: '#5e5b66', ear: '#524e58', earIn: '#766872', whiskerAlt: '#bdb8c6' }),
  ],
};
const HOME_COATS: Coat[] = [
  coatLike('enzo', { fur: '#8d8b93', back: '#66646c', face: '#a3a1aa', shade: '#75737b', texture: '#6a6870', tail: '#8a8892', tailOuter: '#67656e' }),
  coatLike('dora', { ...blackEyes, fur: '#eeeaf0', back: '#dad3df', face: '#f6f3f8', shade: '#ccc4d2', texture: '#d8d0dc', tail: '#ebe6ee', tailInner: '#cfc6d6' }),
  COATS.enzo,
  coatLike('dora', { ...blackEyes, fur: '#fffdf8', back: '#f2ede4' }),
];
const PEBBLE: Coat = coatLike('enzo', { fur: '#a9a7b0', back: '#8a8891', face: '#c4c2ca', shade: '#96949d', texture: '#8f8d96', tail: '#b0aeb7', tailOuter: '#8c8a94', tailInner: '#d2d0d8', bands: false });

export const rivalCoat = (id: string, n = 0) => (RIVAL_COATS[id] ?? RIVAL_COATS.beige)[n % 2];
const coatFor = (g: ClashGame | null, side: Side, card: CardId | null, n: number): Coat => {
  if (card === 'dora') return COATS.dora;
  if (card === 'enzo') return COATS.enzo;
  if (side === 1 && g) return rivalCoat(g.rival.id, n);
  if (card === 'pebble') return PEBBLE;
  return HOME_COATS[n % HOME_COATS.length];
};

// ---------- Small helpers ----------

const ellipse = (c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill?: string) => {
  c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2);
  if (fill) { c.fillStyle = fill; c.fill(); }
};
const hash = (n: number) => { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); };

function crown(c: CanvasRenderingContext2D, x: number, y: number, s: number, fill = '#ffd24a') {
  c.save(); c.translate(x, y); c.scale(s, s);
  c.fillStyle = fill; c.strokeStyle = '#8a5a12'; c.lineWidth = 0.8 / s + 0.4; c.lineJoin = 'round';
  c.beginPath(); c.moveTo(-5, 2); c.lineTo(-5.5, -3); c.lineTo(-2.5, 0); c.lineTo(0, -4.5); c.lineTo(2.5, 0); c.lineTo(5.5, -3); c.lineTo(5, 2); c.closePath(); c.fill(); c.stroke();
  ellipse(c, 0, -4.8, 0.9, 0.9, '#ff6b8a'); ellipse(c, -5.6, -3.3, 0.7, 0.7, '#7fd0ff'); ellipse(c, 5.6, -3.3, 0.7, 0.7, '#7fd0ff');
  c.restore();
}

// ---------- The arena ----------

function arena(c: CanvasRenderingContext2D, look: Arena, time: number) {
  for (let r = 0; r < H; r++) for (let col = 0; col < W; col++) {
    c.fillStyle = (r + col) % 2 ? look.grassA : look.grassB;
    c.fillRect(col * TILE, r * TILE, TILE, TILE);
  }
  // Worn paths down each lane and in front of the king towers.
  c.fillStyle = look.path;
  for (const bx of BRIDGES) {
    c.globalAlpha = 0.45;
    c.beginPath(); c.roundRect((bx - 0.9) * TILE, 5 * TILE, 1.8 * TILE, 22 * TILE, 10); c.fill();
  }
  c.globalAlpha = 0.35;
  for (const y of [5.5, 26.5]) { c.beginPath(); c.roundRect(3.5 * TILE, (y - 0.6) * TILE, 11 * TILE, 1.2 * TILE, 10); c.fill(); }
  c.globalAlpha = 1;
  // Tufts of grass and pebbles, the same every frame.
  for (let i = 0; i < 90; i++) {
    const x = hash(i) * W * TILE, y = hash(i + 300) * H * TILE;
    if (y > RIVER_TOP * TILE - 8 && y < RIVER_BOTTOM * TILE + 8) continue;
    c.strokeStyle = 'rgba(40, 80, 30, 0.35)'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(x, y); c.lineTo(x - 2, y - 4); c.moveTo(x, y); c.lineTo(x + 1, y - 5); c.moveTo(x, y); c.lineTo(x + 3, y - 3); c.stroke();
  }
  // The river, with banks and moving ripples.
  const top = RIVER_TOP * TILE, bottom = RIVER_BOTTOM * TILE;
  c.fillStyle = look.bank; c.fillRect(0, top - 3, VIEW_W, bottom - top + 6);
  c.fillStyle = look.water; c.fillRect(0, top, VIEW_W, bottom - top);
  c.strokeStyle = look.waterLight; c.lineWidth = 1.5; c.globalAlpha = 0.7;
  for (let i = 0; i < 14; i++) {
    const y = top + 6 + (i % 3) * 10, x = ((i * 53 + time * 18) % (VIEW_W + 40)) - 20;
    c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 6, y - 3, x + 12, y); c.stroke();
  }
  c.globalAlpha = 1;
  // Wooden bridges.
  for (const bx of BRIDGES) {
    const x0 = (bx - BRIDGE_HALF) * TILE, w = BRIDGE_HALF * 2 * TILE;
    c.fillStyle = 'rgba(0, 0, 0, 0.25)'; c.fillRect(x0 + 3, top - 4, w, bottom - top + 10);
    c.fillStyle = look.plank; c.fillRect(x0, top - 6, w, bottom - top + 12);
    c.strokeStyle = look.plankDark; c.lineWidth = 1;
    for (let y = top - 6; y < bottom + 6; y += 6) { c.beginPath(); c.moveTo(x0, y); c.lineTo(x0 + w, y); c.stroke(); }
    c.fillStyle = look.plankDark; c.fillRect(x0 - 2, top - 8, 3, bottom - top + 16); c.fillRect(x0 + w - 1, top - 8, 3, bottom - top + 16);
  }
  // Scenery along the edges for each arena.
  for (let i = 0; i < 8; i++) {
    const side = i % 2 ? VIEW_W - 6 : 6, y = 40 + i * 76 + (i % 2) * 20;
    if (look.deco === 'cactus') {
      c.fillStyle = '#4f8f4a'; c.beginPath(); c.roundRect(side - 3, y - 14, 6, 16, 3); c.fill();
      c.beginPath(); c.roundRect(side + (i % 2 ? -8 : 3), y - 10, 5, 3, 1.5); c.fill();
      ellipse(c, side, y - 15, 1.8, 1.8, '#f07aa8');
    } else if (look.deco === 'salt') {
      ellipse(c, side, y, 5, 3, '#f7f3ea'); ellipse(c, side + 2, y - 2, 3, 2, '#ffffff');
    } else {
      const tw = 0.5 + 0.5 * Math.sin(time * 2 + i);
      c.fillStyle = `rgba(255, 245, 200, ${0.4 + tw * 0.5})`; c.beginPath(); c.arc(side, y, 1.5 + tw, 0, Math.PI * 2); c.fill();
    }
  }
  c.strokeStyle = look.edge; c.lineWidth = 4; c.strokeRect(2, 2, VIEW_W - 4, VIEW_H - 4);
}

/** Tiles where the selected card can't go, shaded red. */
function forbidden(c: CanvasRenderingContext2D, g: ClashGame, card: CardId) {
  c.fillStyle = 'rgba(220, 40, 60, 0.22)';
  for (let r = 0; r < H; r++) for (let col = 0; col < W; col++) if (!g.canPlace(0, card, col + 0.5, r + 0.5)) c.fillRect(col * TILE, r * TILE, TILE, TILE);
  c.strokeStyle = 'rgba(255, 255, 255, 0.6)'; c.setLineDash([6, 5]); c.lineWidth = 1.5;
  c.beginPath(); c.moveTo(0, (RIVER_BOTTOM + 0.5) * TILE); c.lineTo(VIEW_W, (RIVER_BOTTOM + 0.5) * TILE); c.stroke();
  c.setLineDash([]);
}

// ---------- Towers ----------

function tower(c: CanvasRenderingContext2D, g: ClashGame, u: Unit, time: number) {
  const x = u.x * TILE, y = u.y * TILE, king = u.role === 'king', r = u.r * TILE, team = TEAM[u.side];
  const flash = u.hit > 0 ? 0.35 : 0;
  // Stone drum with crenellations and a coloured band.
  ellipse(c, x + 4, y + r * 0.4, r * 1.05, r * 0.42, 'rgba(0, 0, 0, 0.16)');
  const h = king ? 22 : 18;
  const stone = c.createLinearGradient(x - r, 0, x + r, 0);
  stone.addColorStop(0, '#9c9587'); stone.addColorStop(0.5, '#d8d0bf'); stone.addColorStop(1, '#8a8376');
  c.fillStyle = stone; c.fillRect(x - r * 0.9, y - h, r * 1.8, h);
  c.beginPath(); c.ellipse(x, y, r * 0.9, r * 0.4, 0, 0, Math.PI); c.fill();
  c.fillStyle = team.main; c.fillRect(x - r * 0.9, y - h * 0.45, r * 1.8, 5);
  c.strokeStyle = 'rgba(60, 50, 40, 0.35)'; c.lineWidth = 1;
  for (let i = 0; i < 3; i++) { const yy = y - h + 6 + i * 7; c.beginPath(); c.moveTo(x - r * 0.9, yy); c.lineTo(x + r * 0.9, yy); c.stroke(); }
  ellipse(c, x, y - h, r * 0.95, r * 0.45, '#e9e2d3');
  ellipse(c, x, y - h, r * 0.72, r * 0.32, '#cbbfa7');
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2, bx = x + Math.cos(a) * r * 0.85, by = y - h + Math.sin(a) * r * 0.4;
    c.fillStyle = '#d8d0bf'; c.fillRect(bx - 3, by - 6, 6, 6); c.strokeStyle = '#8a8376'; c.strokeRect(bx - 3, by - 6, 6, 6);
  }
  // A pennant.
  const fx = x + r * 0.7, fy = y - h - 14, wave = Math.sin(time * 4 + u.id) * 2;
  c.strokeStyle = '#5b4632'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(fx, y - h); c.lineTo(fx, fy - 6); c.stroke();
  c.fillStyle = team.main; c.beginPath(); c.moveTo(fx, fy - 6); c.lineTo(fx + 11, fy - 3 + wave); c.lineTo(fx, fy); c.fill();
  // Keepers: a pellet flicker on each princess tower, and on the king tower Dora and Enzo or the rival leader.
  const faceIn: 1 | -1 = u.x < W / 2 ? 1 : -1, base = y - h + 3;
  const asleep = king && !u.active;
  if (king && u.side === 0) {
    drawChinchilla(c, COATS.dora, x - 7, base, { face: 1, h: 22, time: time + 1, blink: asleep, decorate: (d, bob) => crownOn(d, bob) });
    drawChinchilla(c, COATS.enzo, x + 7, base, { face: -1, h: 22, time: time + 2.5, blink: asleep, decorate: (d, bob) => crownOn(d, bob) });
  } else if (king) {
    drawChinchilla(c, rivalCoat(g.rival.id, 0), x, base, { face: -1, h: 26, time: time + 1, blink: asleep, decorate: (d, bob) => crownOn(d, bob) });
  } else {
    drawChinchilla(c, u.side === 0 ? HOME_COATS[u.variant * 2 + 1] : rivalCoat(g.rival.id, u.variant), x, base, { face: faceIn, h: 18, time: time + u.id, blink: false, decorate: slingshot });
  }
  if (asleep) {
    c.fillStyle = '#ffffff'; c.font = 'bold 9px Arial'; c.textAlign = 'left';
    const z = (time * 0.8) % 1;
    c.globalAlpha = 1 - z; c.fillText('z', x + 14 + z * 6, base - 22 - z * 10); c.globalAlpha = 1;
  }
  if (flash) { c.fillStyle = `rgba(255, 255, 255, ${flash})`; c.fillRect(x - r * 0.9, y - h, r * 1.8, h); }
  // Health bar with the number.
  const bw = king ? 58 : 46, by = y - h - (king ? 44 : 38), frac = Math.max(0, u.hp / u.maxHp);
  c.fillStyle = 'rgba(20, 16, 28, 0.8)'; c.beginPath(); c.roundRect(x - bw / 2 - 2, by - 2, bw + 4, 11, 4); c.fill();
  c.fillStyle = team.main; c.fillRect(x - bw / 2, by, bw * frac, 7);
  c.fillStyle = '#ffffff'; c.font = 'bold 8px Arial'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(String(Math.ceil(u.hp)), x, by + 3.8);
  c.textBaseline = 'alphabetic';
}

const crownOn = (d: CanvasRenderingContext2D, bob: number) => crown(d, 7, -26 + bob, 0.55);
const slingshot = (d: CanvasRenderingContext2D, bob: number) => {
  d.strokeStyle = '#6b4424'; d.lineWidth = 1.4; d.beginPath();
  d.moveTo(12, -4 + bob); d.lineTo(14, -9 + bob); d.lineTo(12.5, -12 + bob); d.moveTo(14, -9 + bob); d.lineTo(16, -12 + bob); d.stroke();
};

function rubble(c: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ellipse(c, x, y + 4, r * TILE * 0.9, r * TILE * 0.45, 'rgba(60, 50, 40, 0.35)');
  for (let i = 0; i < 9; i++) {
    const a = hash(i + x) * Math.PI * 2, d = hash(i + y) * r * TILE * 0.7;
    c.fillStyle = i % 2 ? '#b8b0a0' : '#8f8778';
    c.fillRect(x + Math.cos(a) * d - 3, y + Math.sin(a) * d * 0.5 - 3, 6 + (i % 3), 5);
  }
}

// ---------- Troops ----------

const HEIGHT: Partial<Record<CardId, number>> = { kits: 14, flickers: 18, dora: 24, enzo: 26, pebble: 34, dasher: 24 };

/** A troop in the arena, or on a card when `g` is null. */
export function troop(c: CanvasRenderingContext2D, g: ClashGame | null, card: CardId, side: Side, x: number, y: number, o: { face: 1 | -1; time: number; walk: number; moving: boolean; attack: number; variant: number; target?: { x: number; y: number } | null }) {
  const t = o.time, team = TEAM[side];
  if (card === 'mochi') { capybara(c, x, y, o.face, t, o.moving, o.walk, team.main); return; }
  if (card === 'gliders') { glider(c, x, y - 14 - Math.sin(t * 5 + o.variant) * 2, o.face, t, team.main); return; }
  if (card === 'balloon') { balloon(c, g, side, x, y - 26, t, team.main); return; }
  if (card === 'cannon') { cannon(c, x, y, o.target ? Math.atan2(o.target.y - y, o.target.x - x) : side === 0 ? -Math.PI / 2 : Math.PI / 2, o.attack, team.main); return; }
  const h = HEIGHT[card] ?? 20;
  const lunge = o.attack > 0 ? Math.sin((o.attack / 0.3) * Math.PI) * 3 * o.face : 0;
  const decorate = card === 'dora' ? fan(o.attack) : card === 'enzo' ? claws(o.attack) : card === 'pebble' ? grandpa : card === 'dasher' ? scarf(t) : card === 'flickers' ? slingshot : undefined;
  if (card === 'enzo' && o.attack > 0) {
    c.save(); c.translate(x, y - h * 0.4); c.rotate((1 - o.attack / 0.3) * Math.PI * 2 * o.face); c.translate(-x, -(y - h * 0.4));
  }
  drawChinchilla(c, coatFor(g, side, card, o.variant), x + lunge, y, {
    face: o.face, h, time: t + o.variant * 0.7, run: o.walk * 9, moving: o.moving,
    bib: card === 'dora' || card === 'enzo' ? undefined : { color: team.main, trim: team.trim },
    decorate,
  });
  if (card === 'enzo' && o.attack > 0) c.restore();
  if (card === 'dora' || card === 'enzo') {
    // Heroes wear a team sash so you can tell whose side they're on.
    c.fillStyle = team.main; c.beginPath(); c.arc(x, y - h - 4, 2.5, 0, Math.PI * 2); c.fill();
  }
}

const fan = (attack: number) => (d: CanvasRenderingContext2D, bob: number) => {
  const open = attack > 0 ? 1 : 0.6, a = attack > 0 ? -0.6 : 0.2;
  d.save(); d.translate(13, -9 + bob); d.rotate(a);
  d.fillStyle = '#f7a9c4'; d.strokeStyle = '#a4506e'; d.lineWidth = 0.6;
  d.beginPath(); d.moveTo(0, 0); d.arc(0, 0, 7, -Math.PI / 2 - open, -Math.PI / 2 + open); d.closePath(); d.fill(); d.stroke();
  ellipse(d, 0, -5, 1, 1, '#ffffff');
  d.restore();
};
const claws = (attack: number) => (d: CanvasRenderingContext2D, bob: number) => {
  if (!attack) return;
  d.strokeStyle = '#fff4d0'; d.lineWidth = 0.8;
  for (let i = 0; i < 3; i++) { d.beginPath(); d.moveTo(12, -6 + i * 1.6 + bob); d.lineTo(16, -8 + i * 1.6 + bob); d.stroke(); }
};
const grandpa = (d: CanvasRenderingContext2D, bob: number) => {
  // Bushy white eyebrows, spectacles and a walking stick.
  d.fillStyle = '#ffffff'; ellipse(d, 9, -16 + bob, 2.6, 1); d.fill();
  d.strokeStyle = '#3a3040'; d.lineWidth = 0.6; d.beginPath(); d.arc(10, -13.5 + bob, 1.8, 0, Math.PI * 2); d.stroke();
  d.strokeStyle = '#7a5230'; d.lineWidth = 1.4; d.beginPath(); d.moveTo(14, -8 + bob); d.lineTo(15.5, 0); d.moveTo(14, -8 + bob); d.quadraticCurveTo(13, -10 + bob, 11.5, -9 + bob); d.stroke();
};
const scarf = (t: number) => (d: CanvasRenderingContext2D, bob: number) => {
  d.fillStyle = '#e8483c';
  d.beginPath(); d.moveTo(3, -12 + bob); d.lineTo(-7, -13 + bob + Math.sin(t * 20) * 1.5); d.lineTo(-7, -10 + bob + Math.sin(t * 20 + 1) * 1.5); d.lineTo(3, -9 + bob); d.fill();
  d.fillStyle = '#3a3040'; d.fillRect(6, -15.5 + bob, 7, 1.4);
  ellipse(d, 10.5, -14.8 + bob, 1.8, 1.4, '#9fe3ff');
};

function capybara(c: CanvasRenderingContext2D, x: number, y: number, face: 1 | -1, t: number, moving: boolean, walk: number, team: string) {
  const bob = moving ? Math.abs(Math.sin(walk * 5)) * -1.5 : Math.sin(t * 2) * 0.4;
  c.save(); c.translate(x, y); c.scale(face, 1);
  ellipse(c, 0, 0, 13, 3, 'rgba(20, 12, 30, 0.2)');
  c.fillStyle = '#6e4a2c';
  for (const lx of [-8, -4, 5, 9]) { const s = moving ? Math.sin(walk * 5 + lx) * 1.5 : 0; c.fillRect(lx + s - 1.5, -6, 3.5, 6); }
  c.strokeStyle = '#4a2f1a'; c.lineWidth = 1.2;
  c.fillStyle = '#a5754a'; c.beginPath(); c.roundRect(-13, -20 + bob, 24, 16, 8); c.fill(); c.stroke();
  c.fillStyle = team; c.fillRect(-4, -19 + bob, 7, 14);
  c.fillStyle = '#a5754a'; c.beginPath(); c.roundRect(5, -24 + bob, 12, 11, 4); c.fill(); c.stroke();
  c.fillStyle = '#8d6038'; c.beginPath(); c.roundRect(12, -21 + bob, 6, 7, 2.5); c.fill();
  ellipse(c, 7, -24 + bob, 2, 1.6, '#7a5334');
  ellipse(c, 11, -20.5 + bob, 1.1, 1.1, '#1d1418');
  ellipse(c, 16.5, -18.5 + bob, 0.8, 0.6, '#3a2418');
  // Mochi keeps a little orange on her head, like a proper capybara.
  ellipse(c, 9, -26.5 + bob, 3, 2.6, '#ff9c3a'); c.fillStyle = '#4f9a3a'; c.fillRect(8.5, -30 + bob, 1.2, 2.5);
  c.restore();
}

function glider(c: CanvasRenderingContext2D, x: number, y: number, face: 1 | -1, t: number, team: string) {
  ellipse(c, x, y + 16, 6, 2, 'rgba(20, 12, 30, 0.18)');
  const flap = Math.sin(t * 12) * 2;
  c.save(); c.translate(x, y); c.scale(face, 1);
  c.fillStyle = '#b9aea6'; c.strokeStyle = '#4b3f3a'; c.lineWidth = 0.8;
  c.beginPath(); c.moveTo(-7, -2 + flap); c.quadraticCurveTo(0, -6, 7, -2 + flap); c.lineTo(5, 3); c.quadraticCurveTo(0, 1, -5, 3); c.closePath(); c.fill(); c.stroke();
  ellipse(c, 0, 0, 4.5, 3, '#d8cec7'); c.stroke();
  c.fillStyle = '#4b3f3a'; c.fillRect(-1, -3, 1.4, 5);
  ellipse(c, 4.5, -1.5, 2.6, 2.2, '#d8cec7'); ellipse(c, 5.5, -2, 0.9, 0.9, '#120c10');
  ellipse(c, 3.5, -3.8, 1.2, 1.4, '#e8b0a8');
  c.strokeStyle = '#6b5f58'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(-4, 1); c.quadraticCurveTo(-9, 3, -11, 0); c.stroke();
  ellipse(c, 0, 3.5, 1.6, 1, team);
  c.restore();
}

function balloon(c: CanvasRenderingContext2D, g: ClashGame | null, side: Side, x: number, y: number, t: number, team: string) {
  ellipse(c, x, y + 28, 10, 3.5, 'rgba(20, 12, 30, 0.2)');
  const sway = Math.sin(t * 1.5) * 1.5;
  c.strokeStyle = '#6b4a2a'; c.lineWidth = 0.8;
  c.beginPath(); c.moveTo(x - 9 + sway, y - 2); c.lineTo(x - 5, y + 10); c.moveTo(x + 9 + sway, y - 2); c.lineTo(x + 5, y + 10); c.stroke();
  const grad = c.createRadialGradient(x - 4 + sway, y - 14, 2, x + sway, y - 8, 16);
  grad.addColorStop(0, '#fff0b8'); grad.addColorStop(1, team);
  c.fillStyle = grad; c.beginPath(); c.ellipse(x + sway, y - 10, 13, 14, 0, 0, Math.PI * 2); c.fill();
  c.strokeStyle = 'rgba(0, 0, 0, 0.25)'; c.beginPath(); c.ellipse(x + sway, y - 10, 5, 14, 0, 0, Math.PI * 2); c.stroke();
  drawChinchilla(c, coatFor(g, side, 'balloon', 0), x, y + 12, { face: side === 0 ? 1 : -1, h: 14, time: t });
  c.fillStyle = '#b98a55'; c.fillRect(x - 7, y + 6, 14, 8); c.strokeStyle = '#6b4a2a'; c.strokeRect(x - 7, y + 6, 14, 8);
  c.fillStyle = '#f0cd6b'; c.fillRect(x - 5, y + 13, 10, 4);
}

function cannon(c: CanvasRenderingContext2D, x: number, y: number, aim: number, attack: number, team: string) {
  ellipse(c, x + 2, y + 6, 17, 7, 'rgba(0, 0, 0, 0.25)');
  // A round hay bale with twine.
  c.fillStyle = '#e8c35a'; c.strokeStyle = '#a07a24'; c.lineWidth = 1.2;
  c.beginPath(); c.roundRect(x - 15, y - 12, 30, 18, 6); c.fill(); c.stroke();
  c.strokeStyle = '#c9a03c'; c.lineWidth = 0.8;
  for (let i = -10; i <= 10; i += 5) { c.beginPath(); c.moveTo(x + i, y - 11); c.lineTo(x + i + 2, y + 5); c.stroke(); }
  c.fillStyle = team; c.fillRect(x - 15, y - 4, 30, 3);
  const kick = attack > 0 ? (attack / 0.3) * 3 : 0;
  c.save(); c.translate(x, y - 12); c.rotate(aim);
  c.fillStyle = '#5a4a3e'; c.beginPath(); c.roundRect(-4 - kick, -4, 18, 8, 3); c.fill();
  ellipse(c, 14 - kick, 0, 2.2, 3.6, '#2a2220');
  c.restore();
  ellipse(c, x, y - 12, 5, 4, '#6e5c4e');
}

function health(c: CanvasRenderingContext2D, u: Unit, x: number, y: number) {
  if (u.hp >= u.maxHp - 0.5 && u.role === 'troop') return;
  const w = Math.max(16, Math.min(34, u.maxHp / 45)), frac = Math.max(0, u.hp / u.maxHp);
  c.fillStyle = 'rgba(20, 16, 28, 0.8)'; c.fillRect(x - w / 2 - 1, y - 1, w + 2, 5);
  c.fillStyle = TEAM[u.side].main; c.fillRect(x - w / 2, y, w * frac, 3);
}

// ---------- Shots, spells and effects ----------

function blast(c: CanvasRenderingContext2D, b: Blast, time: number) {
  const p = 1 - Math.max(0, b.delay) / b.total, x = (b.fromX + (b.x - b.fromX) * p) * TILE, y0 = (b.fromY + (b.y - b.fromY) * p) * TILE;
  if (b.kind === 'bale') {
    const y = b.y * TILE - (1 - p) * 26;
    ellipse(c, b.x * TILE, b.y * TILE, 8 * p + 2, 3 * p + 1, 'rgba(0, 0, 0, 0.25)');
    c.fillStyle = '#f0cd6b'; c.strokeStyle = '#a07a24'; c.lineWidth = 1; c.beginPath(); c.roundRect(b.x * TILE - 6, y - 5, 12, 9, 3); c.fill(); c.stroke();
    return;
  }
  // Target ring on the ground where it will land.
  c.strokeStyle = TEAM[b.side].main; c.lineWidth = 2; c.globalAlpha = 0.6;
  c.beginPath(); c.arc(b.x * TILE, b.y * TILE, b.radius * TILE, 0, Math.PI * 2); c.stroke(); c.globalAlpha = 1;
  const lift = Math.sin(p * Math.PI) * 90;
  if (b.kind === 'dustbomb') {
    ellipse(c, x, y0, 6, 2.5, 'rgba(0, 0, 0, 0.25)');
    ellipse(c, x, y0 - lift, 8, 8, '#8c7e70');
    ellipse(c, x - 2.5, y0 - lift - 2.5, 3, 3, '#c9bba8');
    c.fillStyle = '#ffb347'; c.beginPath(); c.arc(x + 5, y0 - lift - 8, 2 + Math.sin(time * 30), 0, Math.PI * 2); c.fill();
  } else {
    for (let i = 0; i < 9; i++) {
      const ox = (hash(i) - 0.5) * b.radius * TILE * 1.4, oy = (hash(i + 9) - 0.5) * b.radius * TILE * 1.4;
      ellipse(c, x + ox * p, y0 + oy * p - lift - i * 2, 2.4, 2.4, '#a0703c');
    }
  }
}

function effect(c: CanvasRenderingContext2D, e: Effect) {
  const p = e.t / e.max, x = e.x * TILE, y = e.y * TILE, r = e.r * TILE;
  if (e.kind === 'deploy') {
    c.strokeStyle = TEAM[e.side].main; c.lineWidth = 2; c.globalAlpha = 1 - p;
    c.beginPath(); c.arc(x, y, r * (0.4 + p), 0, Math.PI * 2); c.stroke();
    // A countdown arc, like troops dropping in.
    c.lineWidth = 3; c.beginPath(); c.arc(x, y, r * 0.7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - p)); c.stroke();
    c.globalAlpha = 1;
  } else if (e.kind === 'poof') {
    c.globalAlpha = 0.7 * (1 - p);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; ellipse(c, x + Math.cos(a) * r * p, y + Math.sin(a) * r * p * 0.6, r * 0.45 * (1 - p * 0.3), r * 0.35, '#efe3cf'); }
    c.globalAlpha = 1;
  } else if (e.kind === 'boom') {
    c.globalAlpha = 1 - p;
    c.fillStyle = 'rgba(255, 220, 160, 0.35)'; c.beginPath(); c.arc(x, y, r * (0.5 + p * 0.5), 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#fff4d8'; c.lineWidth = 3; c.beginPath(); c.arc(x, y, r * (0.3 + p * 0.7), 0, Math.PI * 2); c.stroke();
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 + e.x; ellipse(c, x + Math.cos(a) * r * p, y + Math.sin(a) * r * p * 0.7, 4 * (1 - p) + 1, 3 * (1 - p) + 1, '#d9c6a8'); }
    c.globalAlpha = 1;
  } else if (e.kind === 'spark') {
    c.strokeStyle = '#fff6c0'; c.lineWidth = 1.5; c.globalAlpha = 1 - p;
    for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + p; c.beginPath(); c.moveTo(x + Math.cos(a) * 2, y + Math.sin(a) * 2); c.lineTo(x + Math.cos(a) * (4 + p * 6), y + Math.sin(a) * (4 + p * 6)); c.stroke(); }
    c.globalAlpha = 1;
  } else if (e.kind === 'spin') {
    c.strokeStyle = 'rgba(255, 250, 235, 0.8)'; c.lineWidth = 3; c.globalAlpha = 1 - p;
    c.beginPath(); c.ellipse(x, y - 6, r, r * 0.5, 0, p * 6, p * 6 + Math.PI * 1.3); c.stroke(); c.globalAlpha = 1;
  } else if (e.kind === 'crown') {
    c.globalAlpha = p < 0.8 ? 1 : (1 - p) * 5;
    crown(c, x, y - 20 - p * 40, 2 + p);
    c.globalAlpha = 1;
  }
}

// ---------- The whole scene ----------

export type Ghost = { card: CardId; x: number; y: number; ok: boolean } | null;

export function drawClash(c: CanvasRenderingContext2D, g: ClashGame, time: number, ghost: Ghost) {
  const look = ARENAS[g.rival.id] ?? ARENAS.beige;
  arena(c, look, time);
  if (ghost) forbidden(c, g, ghost.card);
  // Rubble where towers used to be.
  for (const side of [0, 1] as Side[]) for (const role of ['left', 'right', 'king'] as const) {
    if (g.tower(side, role)) continue;
    const s = TOWER_SPOTS[role];
    rubble(c, s.x * TILE, local(side, s.y) * TILE, role === 'king' ? 2 : 1.5);
  }
  // Ground things back to front, then flyers on top.
  const ground = g.units.filter((u) => !u.air).sort((a, b) => a.y - b.y), air = g.units.filter((u) => u.air).sort((a, b) => a.y - b.y);
  for (const u of [...ground, ...air]) {
    if (u.role === 'princess' || u.role === 'king') { tower(c, g, u, time); continue; }
    const x = u.x * TILE, y = u.y * TILE, card = u.card!;
    const jump = u.jumps && u.y > RIVER_TOP - 0.5 && u.y < RIVER_BOTTOM + 0.5 ? Math.sin(((u.y - (RIVER_TOP - 0.5)) / (RIVER_BOTTOM - RIVER_TOP + 1)) * Math.PI) * 16 : 0;
    if (!u.air) {
      ellipse(c, x, y, u.r * TILE * 0.9, u.r * TILE * 0.4, 'rgba(0, 0, 0, 0.18)');
      c.strokeStyle = TEAM[u.side].main; c.lineWidth = 1.5; c.globalAlpha = 0.8;
      c.beginPath(); c.ellipse(x, y, u.r * TILE * 0.9, u.r * TILE * 0.4, 0, 0, Math.PI * 2); c.stroke(); c.globalAlpha = 1;
    }
    if (u.deploy > 0) c.globalAlpha = 0.55;
    if (u.hit > 0) c.filter = 'brightness(1.8)';
    const target = g.unit(u.target);
    troop(c, g, card, u.side, x, y - jump, { face: u.face, time, walk: u.walk, moving: u.moving, attack: u.attack, variant: u.variant + u.id, target: target ? { x: target.x * TILE, y: target.y * TILE } : null });
    c.filter = 'none'; c.globalAlpha = 1;
    const top = card === 'balloon' ? 52 : card === 'gliders' ? 22 : card === 'cannon' ? 26 : card === 'mochi' ? 34 : (HEIGHT[card] ?? 20) + 8;
    health(c, u, x, y - top - jump);
  }
  for (const s of g.shots) {
    const x = s.x * TILE, y = s.y * TILE;
    if (s.kind === 'puff') { c.globalAlpha = 0.85; ellipse(c, x, y, 5, 4, '#efe0c4'); ellipse(c, x + 2, y - 2, 3, 3, '#fff8ea'); c.globalAlpha = 1; }
    else if (s.kind === 'hay') ellipse(c, x, y, 3.5, 3.5, '#f0cd6b');
    else ellipse(c, x, y, s.kind === 'tower' ? 2.6 : 2, s.kind === 'tower' ? 2.6 : 2, s.side === 0 ? '#7a4c24' : '#5a2a2a');
  }
  for (const b of g.blasts) blast(c, b, time);
  for (const e of g.effects) effect(c, e);
  if (ghost) {
    const card = CARDS[ghost.card], x = ghost.x * TILE, y = ghost.y * TILE;
    c.globalAlpha = 0.85;
    c.strokeStyle = ghost.ok ? '#ffffff' : '#ff6070'; c.fillStyle = ghost.ok ? 'rgba(255, 255, 255, 0.18)' : 'rgba(255, 60, 80, 0.2)'; c.lineWidth = 2;
    const radius = card.spell ? card.spell.radius : card.stats!.r + (card.count && card.count > 1 ? 0.6 : 0);
    c.beginPath(); c.arc(x, y, radius * TILE, 0, Math.PI * 2); c.fill(); c.stroke();
    if (card.stats && card.stats.range > 2) { c.setLineDash([4, 4]); c.beginPath(); c.arc(x, y, card.stats.range * TILE, 0, Math.PI * 2); c.stroke(); c.setLineDash([]); }
    if (!card.spell && ghost.ok) { c.globalAlpha = 0.5; troop(c, g, ghost.card, 0, x, y, { face: 1, time, walk: 0, moving: false, attack: 0, variant: 0 }); }
    c.globalAlpha = 1;
  }
}

// ---------- Card art ----------

/** The picture on a card, drawn into a `w` × `h` box. */
export function drawCardArt(c: CanvasRenderingContext2D, id: CardId, w: number, h: number, time = 0) {
  const card = CARDS[id];
  const bg = c.createLinearGradient(0, 0, 0, h);
  const tint = card.kind === 'spell' ? ['#7b5fb8', '#3e2c68'] : card.kind === 'building' ? ['#c58a44', '#6a4420'] : id === 'dora' || id === 'enzo' ? ['#f0b64a', '#8a5a14'] : ['#4f9dff', '#1f4f98'];
  bg.addColorStop(0, tint[0]); bg.addColorStop(1, tint[1]);
  c.fillStyle = bg; c.fillRect(0, 0, w, h);
  c.save();
  const s = Math.min(w, h) / 60;
  c.translate(w / 2, h * 0.78); c.scale(s, s);
  const o = { face: 1 as const, time, walk: 0, moving: false, attack: 0, variant: 0 };
  if (id === 'kits') { for (const [dx, dy, v] of [[-6, -6, 1], [14, -6, 2], [-2, 4, 3], [16, 4, 0]]) troop(c, null, 'kits', 0, dx, dy, { ...o, variant: v }); }
  else if (id === 'flickers') { troop(c, null, 'flickers', 0, -5, -2, { ...o, variant: 1 }); troop(c, null, 'flickers', 0, 15, 2, { ...o, variant: 3 }); }
  else if (id === 'gliders') { for (const [dx, dy] of [[-12, 0], [10, -6], [0, 8]]) troop(c, null, 'gliders', 0, dx, dy, o); }
  else if (id === 'balloon') { c.scale(1.05, 1.05); troop(c, null, 'balloon', 0, 0, 14, o); }
  else if (id === 'cannon') { c.scale(1.3, 1.3); troop(c, null, 'cannon', 0, 0, 0, { ...o, target: { x: 30, y: -20 } }); }
  else if (id === 'dustbomb') {
    ellipse(c, 0, -14, 14, 14, '#8c7e70'); ellipse(c, -4, -18, 5, 5, '#c9bba8');
    c.strokeStyle = '#3a2a20'; c.lineWidth = 2; c.beginPath(); c.moveTo(8, -26); c.quadraticCurveTo(14, -34, 18, -30); c.stroke();
    ellipse(c, 19, -31, 4, 4, '#ffb347'); ellipse(c, 19, -31, 2, 2, '#fff2b0');
    for (let i = 0; i < 5; i++) ellipse(c, -16 + i * 8, 2, 6, 3, 'rgba(240, 225, 200, 0.8)');
  } else if (id === 'volley') {
    for (let i = 0; i < 12; i++) { const x = -20 + (i % 4) * 13 + (i > 3 ? 5 : 0), y = -34 + Math.floor(i / 4) * 12; ellipse(c, x, y, 3, 3, '#a0703c'); c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 1; c.beginPath(); c.moveTo(x - 4, y - 6); c.lineTo(x - 1, y - 2); c.stroke(); }
  } else if (id === 'mochi') { c.scale(1.2, 1.2); troop(c, null, id, 0, -2, 0, o); }
  else { const scale = id === 'pebble' ? 1.1 : 1.4; c.scale(scale, scale); troop(c, null, id, 0, -2, 0, o); }
  c.restore();
}

export const rivalLeaderArt = (c: CanvasRenderingContext2D, rivalId: string, w: number, h: number, time = 0) => {
  const look = ARENAS[rivalId] ?? ARENAS.beige;
  const bg = c.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, look.sky); bg.addColorStop(1, look.grassB);
  c.fillStyle = bg; c.fillRect(0, 0, w, h);
  drawChinchilla(c, rivalCoat(rivalId, 0), w * 0.42, h * 0.9, { face: -1, h: h * 0.55, time, decorate: (d, bob) => crownOn(d, bob) });
};

export const heroesArt = (c: CanvasRenderingContext2D, w: number, h: number, time = 0) => {
  drawChinchilla(c, COATS.dora, w * 0.36, h * 0.92, { face: 1, h: h * 0.55, time, decorate: (d, bob) => crownOn(d, bob) });
  drawChinchilla(c, COATS.enzo, w * 0.68, h * 0.92, { face: -1, h: h * 0.58, time: time + 2, decorate: (d, bob) => crownOn(d, bob) });
};
