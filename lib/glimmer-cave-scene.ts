// Glimmer Cave's drawing: the cave seen from above at the style art's 55°, the floor squashed to 0.8 of its depth and
// every block showing a front face. Canvas 2D. The page passes the dive, the view, the effects and the time; the scene
// keeps only its short-lived effects (Fx) and the frame counters (AnimState), which the page feeds from the dive's
// events. Everything here is code-drawn: the painter hooks below return false until Task 12 points them at the sheets.
import { drawChinchilla } from './chinchilla-art';
import {
  CLASS, CRITTERS, ELITE, JOBS, TINT, WYRM, WYRM_ID, tileAt,
  type Block, type CaveEvent, type Critter, type CritterId, type Dive, type Hero, type Shot, type WeaponId,
} from './glimmer-cave-game';

// ── View ───────────────────────────────────────────────────────────────────

/** The camera, in CSS pixels: the stage's size, a tile's width, the floor's squash and the centre in tiles. */
export type View = { w: number; h: number; tile: number; squash: 0.8; cx: number; cy: number };
/** The short side of the stage shows this many tiles. */
export const VIEW_TILES = 11;
/** A block's front face is FACE × tile tall, and its top is raised by as much. */
export const FACE = 0.55;

export function makeView(w: number, h: number, cx: number, cy: number): View {
  return { w, h, tile: Math.min(w, h) / VIEW_TILES, squash: 0.8, cx, cy };
}
/** A floor point in tiles to the screen. */
export function toScreen(v: View, x: number, y: number): [number, number] {
  return [(x - v.cx) * v.tile + v.w / 2, (y - v.cy) * v.tile * v.squash + v.h / 2];
}
/** The view in tiles, for `Dive.view` (the spawn window): across, and down the squashed floor. */
export function viewTiles(v: View): { w: number; h: number } { return { w: v.w / v.tile, h: v.h / (v.tile * v.squash) }; }

// ── Painter hooks (Task 12) ─────────────────────────────────────────────────

/* oxlint-disable no-unused-vars -- The painter hooks keep the signatures of lib/glimmer-cave-paint.ts's painters. */
/** A painted frame `key`, feet at (x, footY), `h` px tall, mirrored to face left. False: nothing drawn, use the code. */
const paintCaveFrame = (c: CanvasRenderingContext2D, key: string, x: number, footY: number, h: number, mirror: boolean): boolean => false;
/** A painted block at crack `stage` (0-2), its top face's top-left at (x, y), `tile` px wide. */
const paintCaveBlock = (c: CanvasRenderingContext2D, block: Block, stage: number, x: number, y: number, tile: number): boolean => false;
/** The painted floor across the whole view, tinted. */
const paintCaveFloor = (c: CanvasRenderingContext2D, v: View, tint: string): boolean => false;
/* oxlint-enable no-unused-vars */

// ── Palette (from the gameplay style test) ──────────────────────────────────

const INK = '#2a1630';
const ROCK = {
  dirt: { top: '#c48a4a', face: '#8a5530', fleck: '#a8703a' },
  gold: { top: '#c9904a', face: '#8d5a2e', fleck: '#ffd34d' },
  bedrock: { top: '#5a4660', face: '#382a40', fleck: '#6c5672' },
  crate: { top: '#a8743e', face: '#6e4626', fleck: '#6fb8ff' },
  lantern: { top: '#7a5638', face: '#4e3422', fleck: '#ffcf6a' },
};
const CRYSTAL = { fill: '#6fb8ff', light: '#d6ecff', line: '#2a4a9a' };

// ── Animation state, shared with Task 12 ────────────────────────────────────

/** A chinchilla's frame counters: `walk` counts frames by distance, `idle` seconds standing, `attack` the weapon whose
 *  attack frames play and how far in, `flinch` seconds left, and `dig` whether it digs. */
export type Anim = { walk: number; idle: number; attack: { w: WeaponId; t: number } | null; flinch: number; dig: boolean };
/** A critter's: walk frames by distance, flinch seconds left, then a bonked one's dizzy seconds left and its poof's age. */
export type CritterAnim = { walk: number; flinch: number; dizzy: number; poof: number };
/** `ghost` keeps a bonked critter to draw through its flinch, dizzy and poof; `lx`, `ly` is where it was last step. */
export type AnimState = {
  hero: Anim; buddy: Anim; critters: Map<number, CritterAnim & { ghost?: Critter; lx?: number; ly?: number }>;
  last?: { hx: number; hy: number; bx: number; by: number };
};
/** One walk frame per WALK_STEP tiles. (start) */
export const WALK_STEP = 0.18;
/** An attack plays 6 frames at 0.06 s; a flinch shows 0.15 s; a bonked critter flinches, is dizzy 0.25 s, then poofs
 *  over 6 frames at 0.05 s. */
export const ATTACK_TIME = 0.36, FLINCH = 0.15, BONK_FLINCH = 0.1, DIZZY = 0.25, POOF = 0.3;

const newAnim = (): Anim => ({ walk: 0, idle: 0, attack: null, flinch: 0, dig: false });
export function newAnimState(): AnimState { return { hero: newAnim(), buddy: newAnim(), critters: new Map() }; }

/** Advances the frame counters by one step of `dt` s with that step's events. */
export function animate(d: Dive, a: AnimState, events: CaveEvent[], dt: number) {
  const last = a.last ?? (a.last = { hx: d.hx, hy: d.hy, bx: d.buddy.x, by: d.buddy.y });
  const moved = (an: Anim, dist: number) => {
    if (dist > 1e-4) { an.walk += dist / WALK_STEP; an.idle = 0; } else an.idle += dt;
    if (an.flinch > 0) an.flinch = Math.max(0, an.flinch - dt);
    if (an.attack) { an.attack.t += dt; if (an.attack.t >= ATTACK_TIME) an.attack = null; }
  };
  // A jump of more than a tile is a teleport (a new layer, a test), not a walk.
  const hd = Math.hypot(d.hx - last.hx, d.hy - last.hy), bd = Math.hypot(d.buddy.x - last.bx, d.buddy.y - last.by);
  moved(a.hero, hd > 1 ? 0 : hd); moved(a.buddy, bd > 1 ? 0 : bd);
  a.hero.dig = d.digging !== null;
  last.hx = d.hx; last.hy = d.hy; last.bx = d.buddy.x; last.by = d.buddy.y;

  const other: Hero = d.hero === 'dora' ? 'enzo' : 'dora';
  for (const e of events) {
    if (e.k === 'fire') {
      // The owner is whichever chinchilla fired from nearer; only its class weapon has attack frames.
      const hero = Math.hypot(e.x - d.hx, e.y - d.hy) <= Math.hypot(e.x - d.buddy.x, e.y - d.buddy.y);
      const who = hero ? d.hero : other, an = hero ? a.hero : a.buddy;
      if (e.w === CLASS[who].start) an.attack = { w: e.w, t: 0 };
    } else if (e.k === 'hurt') a.hero.flinch = FLINCH;
    else if (e.k === 'hit' && e.id !== WYRM_ID) { const ca = a.critters.get(e.id); if (ca) ca.flinch = FLINCH; }
    else if (e.k === 'bonk') {
      const ca = a.critters.get(e.id) ?? { walk: 0, flinch: 0, dizzy: 0, poof: 0 };
      ca.ghost = {
        id: e.id, kind: e.kind, elite: e.elite, x: e.x, y: e.y, fluff: 0, max: 1, slow: 0, slowFor: 0, stun: 0, hit: 0, state: 'walk', t: 0, dx: 0, dy: 0,
      };
      ca.flinch = BONK_FLINCH; ca.dizzy = DIZZY; ca.poof = 0;
      a.critters.set(e.id, ca);
    }
  }

  const live = new Set<number>();
  for (const c of d.critters) {
    live.add(c.id);
    let ca = a.critters.get(c.id);
    if (!ca) { ca = { walk: 0, flinch: 0, dizzy: 0, poof: 0, lx: c.x, ly: c.y }; a.critters.set(c.id, ca); }
    const dist = Math.hypot(c.x - (ca.lx ?? c.x), c.y - (ca.ly ?? c.y));
    if (dist < 1) ca.walk += dist / WALK_STEP;
    ca.lx = c.x; ca.ly = c.y;
    if (ca.flinch > 0) ca.flinch = Math.max(0, ca.flinch - dt);
  }
  for (const [id, ca] of a.critters) {
    if (live.has(id)) continue;
    if (!ca.ghost) { a.critters.delete(id); continue; }
    if (ca.flinch > 0) ca.flinch = Math.max(0, ca.flinch - dt);
    else if (ca.dizzy > 0) ca.dizzy = Math.max(0, ca.dizzy - dt);
    else { ca.poof += dt; if (ca.poof >= POOF) a.critters.delete(id); }
  }
}

// ── Effects ────────────────────────────────────────────────────────────────

/** The scene's own short-lived effects, in tiles and seconds. `cracks` maps a tile index to its dig progress and the
 *  seconds since it last moved; `level` is the level-up ring's age (-1 for none); `shake` its strength in px. `last`
 *  is the time of the previous draw, which ages them. */
export type Fx = {
  poofs: { x: number; y: number; t: number; r: number }[];
  stars: { x: number; y: number; t: number }[];
  chips: { x: number; y: number; vx: number; vy: number; t: number; c: string }[];
  nums: { x: number; y: number; n: number; crit: boolean; t: number }[];
  cracks: Map<number, { p: number; t: number }>;
  level: number; shake: number; last: number;
};
export function newFx(): Fx { return { poofs: [], stars: [], chips: [], nums: [], cracks: new Map(), level: -1, shake: 0, last: 0 }; }
/** Caps, so a 300-critter swarm can't flood the screen with numbers and dust. */
const MAX_NUMS = 36, MAX_POOFS = 48, MAX_CHIPS = 60, MAX_STARS = 24;
const FX_LIFE = { poof: 0.4, star: 0.25, chip: 0.45, num: 0.6, level: 0.7, crack: 0.4 };

/** Turns a step's events into effects. `calm` (reduced motion) drops the shake and halves the poofs. */
export function addEvents(fx: Fx, events: CaveEvent[], calm: boolean) {
  let chipSeed = fx.chips.length;
  for (const e of events) {
    if (e.k === 'bonk') {
      if (fx.poofs.length < MAX_POOFS) fx.poofs.push({ x: e.x, y: e.y, t: 0, r: (e.elite ? 0.9 : 0.5) * (calm ? 0.5 : 1) });
      if (fx.stars.length < MAX_STARS) fx.stars.push({ x: e.x, y: e.y, t: 0 });
    } else if (e.k === 'hit') {
      if (fx.nums.length >= MAX_NUMS) fx.nums.shift();
      fx.nums.push({ x: e.x, y: e.y, n: Math.max(1, Math.round(e.dmg)), crit: e.crit, t: 0 });
    } else if (e.k === 'dig') {
      const key = e.y * 1000 + e.x;
      if (e.progress >= 1) {
        fx.cracks.delete(key);
        const col = e.block === 'gold' ? ROCK.gold.fleck : e.block === 'crate' ? ROCK.crate.top : ROCK.dirt.top;
        for (let i = 0; i < 6 && fx.chips.length < MAX_CHIPS; i++, chipSeed++) {
          const a = chipSeed * 2.39996;
          fx.chips.push({ x: e.x + 0.5, y: e.y + 0.6, vx: Math.cos(a) * 2, vy: Math.sin(a) * 1.5, t: 0, c: col });
        }
      } else {
        fx.cracks.set(key, { p: e.progress, t: 0 });
        // A chip now and then while the hero chips at it.
        if (fx.chips.length < MAX_CHIPS && Math.floor(e.progress * 8) !== Math.floor((e.progress - 0.02) * 8)) {
          const a = chipSeed++ * 2.39996;
          fx.chips.push({ x: e.x + 0.5, y: e.y + 0.9, vx: Math.cos(a) * 1.2, vy: -1, t: 0, c: ROCK.dirt.top });
        }
      }
    } else if (e.k === 'level') fx.level = 0;
    else if (calm) continue;
    else if (e.k === 'hurt') fx.shake = Math.max(fx.shake, 4);
    else if (e.k === 'burst') fx.shake = Math.max(fx.shake, 3);
    else if (e.k === 'wyrm' && e.what !== 'dive') fx.shake = Math.max(fx.shake, e.what === 'bonked' ? 10 : 6);
  }
}

function ageFx(fx: Fx, dt: number) {
  const keep = <T extends { t: number }>(list: T[], life: number) => {
    let k = 0;
    for (const p of list) { p.t += dt; if (p.t < life) list[k++] = p; }
    list.length = k;
  };
  keep(fx.poofs, FX_LIFE.poof); keep(fx.stars, FX_LIFE.star); keep(fx.nums, FX_LIFE.num); keep(fx.chips, FX_LIFE.chip);
  for (const ch of fx.chips) { ch.x += ch.vx * dt; ch.y += ch.vy * dt; ch.vy += 6 * dt; }
  for (const [k, cr] of fx.cracks) { cr.t += dt; if (cr.t > FX_LIFE.crack) fx.cracks.delete(k); }
  if (fx.level >= 0) { fx.level += dt; if (fx.level > FX_LIFE.level) fx.level = -1; }
  fx.shake = fx.shake > 0.2 ? fx.shake * Math.exp(-10 * dt) : 0;
}

// ── Small helpers ──────────────────────────────────────────────────────────

const TAU = Math.PI * 2;
function ellipse(c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) { c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, TAU); }
/** A tiny hash for per-tile speckles that don't flicker. */
const hash = (x: number, y: number) => { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
function outlined(c: CanvasRenderingContext2D, text: string, x: number, y: number, fill: string) {
  c.strokeStyle = INK; c.lineWidth = 3; c.lineJoin = 'round'; c.strokeText(text, x, y);
  c.fillStyle = fill; c.fillText(text, x, y);
}
function bar(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, f: number, col: string) {
  c.fillStyle = INK; c.fillRect(x - 1.5, y - 1.5, w + 3, h + 3);
  c.fillStyle = '#4a2a3a'; c.fillRect(x, y, w, h);
  c.fillStyle = col; c.fillRect(x, y, w * Math.max(0, Math.min(1, f)), h);
}

// ── Pieces ─────────────────────────────────────────────────────────────────

/** A block: its top face raised by FACE, and its front face only when the tile below is open. `crack` 0-1. */
function drawBlock(c: CanvasRenderingContext2D, b: Block, sx: number, sy: number, t: number, open: boolean, crack: number, lit: boolean, x: number, y: number) {
  const f = FACE * t, top = sy - f, depth = t * 0.8, col = ROCK[b as keyof typeof ROCK];
  if (!col) return;
  const stage = crack > 2 / 3 ? 2 : crack > 1 / 3 ? 1 : 0;
  if (paintCaveBlock(c, b, stage, sx, top, t)) return;
  if (open) { c.fillStyle = col.face; c.fillRect(sx, sy + depth - f, t, f); }
  c.fillStyle = col.top; c.fillRect(sx, top, t, depth);
  c.strokeStyle = INK; c.lineWidth = 1;
  c.strokeRect(sx + 0.5, top + 0.5, t - 1, depth + (open ? f : 0) - 1);
  if (b === 'dirt' || b === 'gold' || b === 'bedrock') {
    const h = hash(x, y);
    c.fillStyle = col.fleck;
    const n = b === 'gold' ? 3 : 2;
    for (let i = 0; i < n; i++) {
      const fx = sx + t * (0.2 + 0.6 * ((h * (i + 3) * 7.13) % 1)), fy = top + depth * (0.2 + 0.6 * ((h * (i + 5) * 3.71) % 1));
      if (b === 'gold') star(c, fx, fy, t * 0.09); else c.fillRect(fx, fy, t * 0.12, t * 0.08);
    }
  } else if (b === 'crate') {
    c.fillStyle = '#5a3a1e'; c.fillRect(sx + t * 0.1, top + depth * 0.15, t * 0.8, depth * 0.7);
    c.fillStyle = CRYSTAL.fill;
    for (let i = 0; i < 3; i++) diamond(c, sx + t * (0.3 + 0.2 * i), top + depth * 0.45, t * 0.09);
    if (open) { c.strokeStyle = '#4a2c14'; c.beginPath(); c.moveTo(sx + 2, sy + depth - f / 2); c.lineTo(sx + t - 2, sy + depth - f / 2); c.stroke(); }
  } else if (b === 'lantern') {
    c.fillStyle = '#3a2618'; c.fillRect(sx + t * 0.44, top - t * 0.55, t * 0.12, t * 0.6);
    c.fillStyle = lit ? '#ffd76a' : '#6a5a4a'; c.strokeStyle = INK;
    c.beginPath(); c.roundRect(sx + t * 0.32, top - t * 0.8, t * 0.36, t * 0.34, 3); c.fill(); c.stroke();
  }
  if (crack > 0) {
    c.strokeStyle = INK; c.lineWidth = 1.2; c.beginPath();
    const mx = sx + t / 2, my = top + depth / 2;
    c.moveTo(mx, my); c.lineTo(mx - t * 0.25, my - depth * 0.3);
    if (stage >= 1) { c.moveTo(mx, my); c.lineTo(mx + t * 0.3, my - depth * 0.1); c.moveTo(mx, my); c.lineTo(mx + t * 0.05, my + depth * 0.4); }
    if (stage >= 2) { c.moveTo(mx - t * 0.2, my + depth * 0.1); c.lineTo(mx - t * 0.4, my + depth * 0.35); c.moveTo(mx + t * 0.2, my - depth * 0.25); c.lineTo(mx + t * 0.4, my - depth * 0.4); }
    c.stroke();
  }
}

function star(c: CanvasRenderingContext2D, x: number, y: number, r: number) {
  c.beginPath();
  for (let i = 0; i < 10; i++) { const a = (i * Math.PI) / 5 - Math.PI / 2, rr = i % 2 ? r * 0.45 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  c.closePath(); c.fill();
}
function diamond(c: CanvasRenderingContext2D, x: number, y: number, r: number) {
  c.beginPath(); c.moveTo(x, y - r * 1.4); c.lineTo(x + r, y); c.lineTo(x, y + r * 0.9); c.lineTo(x - r, y); c.closePath(); c.fill();
}

/** A crystal of n experience, bobbing; a cache is bigger. */
function drawCrystal(c: CanvasRenderingContext2D, sx: number, sy: number, t: number, n: number, now: number) {
  const r = t * (n >= 10 ? 0.22 : n >= 4 ? 0.15 : 0.11), bob = Math.sin(now / 300 + sx * 0.05) * t * 0.04;
  c.fillStyle = CRYSTAL.line; diamond(c, sx, sy - r - bob, r + 1.2);
  c.fillStyle = CRYSTAL.fill; diamond(c, sx, sy - r - bob, r);
  c.fillStyle = CRYSTAL.light; c.fillRect(sx - r * 0.3, sy - r * 1.8 - bob, r * 0.3, r * 0.5);
}

/** A critter by kind, feet at (sx, sy), facing `face`: walking, flinching (eyes squeezed) or dizzy (a bonked one).
 *  Plain filled paths: in a software-rastered canvas they beat drawImage from a sprite cache (measured, see the
 *  Task 10 report). */
function drawCritter(c: CanvasRenderingContext2D, cr: Critter, sx: number, sy: number, t: number, ca: CritterAnim | undefined, now: number, face: 1 | -1) {
  const r = CRITTERS[cr.kind].radius * t * 1.15 * (cr.elite ? ELITE.size : 1);
  const step = Math.floor(ca?.walk ?? 0) % 4, hop = step % 2 ? r * 0.12 : 0, flinch = (ca?.flinch ?? 0) > 0, dizzy = (ca?.dizzy ?? 0) > 0 && !flinch;
  if (paintCaveFrame(c, `${cr.kind}:${step}`, sx, sy, r * 2.4, face < 0)) return;
  critterShape(c, cr.kind, cr.elite, sx, sy, r, hop, flinch, dizzy, face, now);
}

function critterShape(c: CanvasRenderingContext2D, kind: CritterId, elite: boolean, sx: number, sy: number, r: number, hop: number, flinch: boolean, dizzy: boolean, face: 1 | -1, now: number) {
  const cy = sy - r - hop;
  // Shadow.
  c.fillStyle = 'rgba(20, 8, 30, 0.35)'; ellipse(c, sx, sy, r * 0.9, r * 0.3); c.fill();
  if (elite) { c.fillStyle = '#ff9a3a'; ellipse(c, sx, cy, r + 3, r * 0.92 + 3); c.fill(); }
  if (kind === 'soot') {
    c.fillStyle = flinch ? '#5a4a5a' : '#1c1420'; c.strokeStyle = '#1c1420'; c.lineWidth = 1.5;
    c.beginPath();
    for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU, rr = i % 2 ? r * 0.8 : r * 1.12; c.lineTo(sx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.95); }
    c.closePath(); c.fill();
  } else if (kind === 'mite') {
    c.strokeStyle = '#c0404e'; c.lineWidth = 1.4; c.beginPath();
    c.moveTo(sx - r * 0.3, cy - r * 0.8); c.lineTo(sx - r * 0.5, cy - r * 1.4); c.moveTo(sx + r * 0.3, cy - r * 0.8); c.lineTo(sx + r * 0.5, cy - r * 1.4);
    c.stroke();
    c.fillStyle = flinch ? '#ffd0d4' : '#f07882'; c.strokeStyle = '#8a2a3a'; ellipse(c, sx, cy, r, r * 0.85); c.fill(); c.stroke();
  } else {
    c.fillStyle = '#3a2a18'; c.fillRect(sx - r * 0.9, sy - r * 0.35, r * 1.8, r * 0.18);
    c.fillStyle = flinch ? '#b8c870' : '#5e7a2e'; c.strokeStyle = '#2a3412'; c.lineWidth = 1.5;
    ellipse(c, sx, cy, r, r * 0.8); c.fill(); c.stroke();
    c.fillStyle = '#c8b03a'; for (let i = 0; i < 3; i++) star(c, sx + r * (i - 1) * 0.45, cy - r * 0.2 + (i % 2) * r * 0.25, r * 0.16);
    c.fillStyle = '#4a3a22'; ellipse(c, sx + face * r * 0.95, cy + r * 0.15, r * 0.35, r * 0.3); c.fill();
  }
  // Eyes: wide, then squeezed shut on a flinch, then spirals when dizzy.
  const ex = sx + face * r * 0.25, ey = cy - r * 0.1, er = Math.max(1.5, r * 0.26);
  if (flinch) {
    c.strokeStyle = '#ffffff'; c.lineWidth = 1.5; c.beginPath();
    c.moveTo(ex - er * 1.6, ey - er * 0.4); c.lineTo(ex - er * 0.6, ey); c.lineTo(ex - er * 1.6, ey + er * 0.4);
    c.moveTo(ex + er * 1.6, ey - er * 0.4); c.lineTo(ex + er * 0.6, ey); c.lineTo(ex + er * 1.6, ey + er * 0.4);
    c.stroke();
  } else {
    // Both eyes in one path, so a swarm costs two fills a critter for its eyes, not four.
    c.fillStyle = '#ffffff'; c.beginPath(); c.ellipse(ex - er, ey, er, er * 1.15, 0, 0, TAU); c.moveTo(ex + er * 2, ey); c.ellipse(ex + er, ey, er, er * 1.15, 0, 0, TAU); c.fill();
    c.fillStyle = '#120a14';
    if (dizzy) {
      c.strokeStyle = '#120a14'; c.lineWidth = 1; const a = now / 80;
      for (const ox of [-er, er]) { c.beginPath(); c.arc(ex + ox, ey, er * 0.6, a, a + 4.5); c.stroke(); }
    } else {
      const px = ex + face * er * 0.35;
      c.beginPath(); c.ellipse(px - er, ey, er * 0.5, er * 0.6, 0, 0, TAU); c.moveTo(px + er * 1.5, ey); c.ellipse(px + er, ey, er * 0.5, er * 0.6, 0, 0, TAU); c.fill();
    }
  }
}

/** A dust poof: puffs of cream that swell and fade. `p` 0-1 through the poof. */
function drawPoof(c: CanvasRenderingContext2D, sx: number, sy: number, r: number, p: number) {
  c.globalAlpha = Math.max(0, 1 - p);
  c.fillStyle = '#f4e8d8'; c.strokeStyle = '#c8b4a4'; c.lineWidth = 1;
  const rr = r * (0.5 + p * 0.7);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU + 0.4;
    ellipse(c, sx + Math.cos(a) * rr * 0.7, sy - rr * 0.6 + Math.sin(a) * rr * 0.5, rr * 0.55, rr * 0.5); c.fill(); c.stroke();
  }
  c.globalAlpha = 1;
}

/** A chinchilla: painted if the sheet is in, else `drawChinchilla`, flipped by its facing, flashing in grace. */
function drawHero(c: CanvasRenderingContext2D, who: Hero, an: Anim, sx: number, sy: number, t: number, faceX: number, now: number, flash: boolean, hat: boolean) {
  const h = t * 0.95, mirror = faceX < 0;
  c.fillStyle = 'rgba(20, 8, 30, 0.35)'; ellipse(c, sx, sy, t * 0.3, t * 0.1); c.fill();
  if (flash && Math.floor(now / 80) % 2) return;
  if (paintCaveFrame(c, who, sx, sy, h, mirror)) return;
  const moving = an.idle === 0, flinch = an.flinch > 0;
  drawChinchilla(c, who, sx, sy, {
    face: mirror ? -1 : 1, h, time: now / 1000, run: an.walk * 2.4, moving, blink: !moving && Math.floor(now / 1000 + (who === 'dora' ? 1.7 : 0)) % 4 === 0 && (now % 1000) < 140, dizzy: flinch,
    decorate: hat ? (cc) => { cc.fillStyle = '#f0b83a'; cc.strokeStyle = '#6a4210'; cc.lineWidth = 1; cc.beginPath(); cc.ellipse(7.5, -19.6, 3.6, 2, -0.2, Math.PI, 0); cc.fill(); cc.stroke(); cc.fillStyle = '#fff2a0'; cc.beginPath(); cc.arc(10.4, -20.3, 0.9, 0, TAU); cc.fill(); } : undefined,
  });
  // A code-drawn swing or throw: the class weapon's attack frames as a pickaxe or an arm flick.
  if (an.attack) {
    const p = an.attack.t / ATTACK_TIME, dir = mirror ? -1 : 1;
    c.save(); c.translate(sx + dir * t * 0.15, sy - h * 0.5);
    c.rotate(dir * (-1.2 + p * 2.4)); c.scale(dir, 1);
    if (an.attack.w === 'pickaxe') {
      c.strokeStyle = '#6a4224'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(0, 0); c.lineTo(t * 0.4, 0); c.stroke();
      c.strokeStyle = '#8a8a96'; c.lineWidth = 3; c.beginPath(); c.moveTo(t * 0.4, -t * 0.14); c.quadraticCurveTo(t * 0.46, 0, t * 0.4, t * 0.14); c.stroke();
    } else { c.fillStyle = '#8a5a2a'; ellipse(c, t * 0.3, 0, t * 0.07, t * 0.06); c.fill(); }
    c.restore();
  }
}

/** The drop pod: a round brass capsule on legs, its lamp blinking while it waits. */
function drawPod(c: CanvasRenderingContext2D, sx: number, sy: number, t: number, now: number, reached: boolean) {
  if (paintCaveFrame(c, 'pod', sx, sy, t * 1.8, false)) return;
  c.fillStyle = 'rgba(20, 8, 30, 0.4)'; ellipse(c, sx, sy, t * 0.7, t * 0.22); c.fill();
  c.strokeStyle = INK; c.lineWidth = 2;
  c.beginPath(); c.moveTo(sx - t * 0.5, sy); c.lineTo(sx - t * 0.3, sy - t * 0.5); c.moveTo(sx + t * 0.5, sy); c.lineTo(sx + t * 0.3, sy - t * 0.5); c.stroke();
  c.fillStyle = '#d89a3a'; ellipse(c, sx, sy - t * 0.9, t * 0.5, t * 0.62); c.fill(); c.stroke();
  c.fillStyle = '#7ac0d8'; ellipse(c, sx, sy - t * 1.0, t * 0.24, t * 0.2); c.fill(); c.stroke();
  c.fillStyle = reached || Math.floor(now / 300) % 2 ? '#ffe26a' : '#a06a2a';
  ellipse(c, sx, sy - t * 1.55, t * 0.08, t * 0.08); c.fill(); c.stroke();
}

/** A wyrm segment (or the head) as a mossy boulder; `under` draws a dirt ripple instead. */
function drawWyrmPiece(c: CanvasRenderingContext2D, d: Dive, i: number, sx: number, sy: number, t: number, now: number) {
  const w = d.wyrm!, head = i < 0, tail = i === w.segs.length - 1, r = (head ? WYRM.head : tail ? WYRM.body * 0.7 : WYRM.body) * t;
  if (w.under > 0) {
    c.fillStyle = 'rgba(120, 80, 50, 0.6)'; ellipse(c, sx, sy, r * 1.1, r * 0.4); c.fill();
    c.fillStyle = '#7a5434'; for (let k = 0; k < 3; k++) c.fillRect(sx + (k - 1) * r * 0.5, sy - 3 - ((now / 120 + i + k) % 3), 3, 3);
    return;
  }
  if (w.bonked) {
    c.fillStyle = '#7a6a64'; c.strokeStyle = INK; c.lineWidth = 1.5;
    for (let k = 0; k < 3; k++) { ellipse(c, sx + (k - 1) * r * 0.55, sy - r * 0.35 - (k % 2) * r * 0.3, r * 0.45, r * 0.38); c.fill(); c.stroke(); }
    return;
  }
  if (paintCaveFrame(c, head ? 'wyrm:head' : tail ? 'wyrm:tail' : 'wyrm:body', sx, sy, r * 2.2, Math.cos(w.dir) < 0)) return;
  const rear = head && w.rumble <= WYRM.telegraph && w.ring === null ? r * 0.5 : 0, cy = sy - r * 0.9 - rear;
  c.fillStyle = 'rgba(20, 8, 30, 0.35)'; ellipse(c, sx, sy, r, r * 0.35); c.fill();
  c.fillStyle = w.fast ? '#9a6a5a' : '#8a7a6e'; c.strokeStyle = INK; c.lineWidth = 2;
  ellipse(c, sx, cy, r, r * 0.9); c.fill(); c.stroke();
  c.fillStyle = '#6a8a3a'; ellipse(c, sx - r * 0.2, cy - r * 0.55, r * 0.55, r * 0.25); c.fill();
  if (!head) return;
  const fx = Math.cos(w.dir), fy = Math.sin(w.dir) * 0.8, er = r * 0.2;
  for (const side of [-1, 1]) {
    const ex = sx + fx * r * 0.45 - fy * side * r * 0.35, ey = cy - r * 0.15 + fy * r * 0.3 + fx * side * r * 0.12;
    c.fillStyle = '#ffffff'; ellipse(c, ex, ey, er, er * 1.1); c.fill(); c.stroke();
    c.fillStyle = '#120a14'; ellipse(c, ex + fx * er * 0.4, ey + fy * er * 0.3, er * 0.5, er * 0.6); c.fill();
  }
  // Grumpy brows.
  c.beginPath(); c.moveTo(sx + fx * r * 0.2 - r * 0.4, cy - r * 0.5); c.lineTo(sx + fx * r * 0.2 - r * 0.05, cy - r * 0.38);
  c.moveTo(sx + fx * r * 0.2 + r * 0.4, cy - r * 0.5); c.lineTo(sx + fx * r * 0.2 + r * 0.05, cy - r * 0.38); c.stroke();
}

/** A projectile or a weapon's short-lived shape, drawn in the row pass. */
function drawShot(c: CanvasRenderingContext2D, v: View, s: Shot, now: number) {
  const t = v.tile, [sx, sy] = toScreen(v, s.x, s.y);
  switch (s.k) {
    case 'acorn': {
      if (paintCaveFrame(c, 'acorn', sx, sy, t * 0.3, s.dx < 0)) return;
      c.save(); c.translate(sx, sy - t * 0.35); c.rotate(now / 60);
      c.fillStyle = '#9a5a26'; c.strokeStyle = INK; c.lineWidth = 1; ellipse(c, 0, 0, t * 0.1, t * 0.08); c.fill(); c.stroke();
      c.fillStyle = '#5a3a1a'; c.fillRect(-t * 0.1, -t * 0.09, t * 0.2, t * 0.05);
      c.restore(); return;
    }
    case 'swing': {
      if (s.wait > 0) return;
      const arc = (s.arc * Math.PI) / 180, a = 1 - s.t / 0.2;
      c.globalAlpha = Math.max(0, a) * 0.55; c.fillStyle = '#fff4dc';
      c.beginPath(); c.moveTo(sx, sy - t * 0.3);
      for (let i = 0; i <= 12; i++) { const ang = s.ang - arc / 2 + (arc * i) / 12; c.lineTo(sx + Math.cos(ang) * s.reach * t, sy - t * 0.3 + Math.sin(ang) * s.reach * t * v.squash); }
      c.closePath(); c.fill(); c.globalAlpha = 1; return;
    }
    case 'pebble':
      c.fillStyle = 'rgba(20, 8, 30, 0.3)'; ellipse(c, sx, sy, t * 0.1, t * 0.04); c.fill();
      c.fillStyle = '#9a8e8a'; c.strokeStyle = INK; c.lineWidth = 1; ellipse(c, sx, sy - t * (0.2 + s.h * 1.4), t * 0.1, t * 0.09); c.fill(); c.stroke(); return;
    case 'lance': {
      const a = Math.max(0, 1 - s.t / 0.25), [ex, ey] = toScreen(v, s.x + s.dx * s.len, s.y + s.dy * s.len);
      c.globalAlpha = a; c.strokeStyle = '#bfe4ff'; c.lineWidth = t * 0.16; c.lineCap = 'round';
      c.beginPath(); c.moveTo(sx, sy - t * 0.35); c.lineTo(ex, ey - t * 0.35); c.stroke();
      c.strokeStyle = '#ffffff'; c.lineWidth = t * 0.05; c.stroke(); c.lineCap = 'butt'; c.globalAlpha = 1; return;
    }
    case 'puff': {
      const a = s.cloud ? 0.35 : Math.max(0, 1 - s.t / 0.25) * 0.5, ang = Math.atan2(s.dy, s.dx), cone = (s.cone * Math.PI) / 180;
      c.globalAlpha = a; c.fillStyle = '#e8dcc4'; c.beginPath(); c.moveTo(sx, sy - t * 0.3);
      for (let i = 0; i <= 8; i++) { const q = ang - cone / 2 + (cone * i) / 8; c.lineTo(sx + Math.cos(q) * s.len * t, sy - t * 0.3 + Math.sin(q) * s.len * t * v.squash); }
      c.closePath(); c.fill(); c.globalAlpha = 1; return;
    }
    case 'twig':
      c.save(); c.translate(sx, sy - t * 0.4); c.rotate(now / 50);
      c.strokeStyle = '#7a4e26'; c.lineWidth = 3; c.beginPath(); c.moveTo(-t * 0.2, 0); c.lineTo(t * 0.2, 0); c.stroke();
      c.restore(); return;
    case 'seed':
      c.fillStyle = '#9ac85a'; c.strokeStyle = INK; c.lineWidth = 1; ellipse(c, sx, sy - t * 0.3, t * 0.11, t * 0.08); c.fill(); c.stroke(); return;
    case 'bomb':
      c.fillStyle = '#2a2230'; c.strokeStyle = INK; ellipse(c, sx, sy - t * 0.18, t * 0.18, t * 0.17); c.fill();
      c.fillStyle = Math.floor(now / 90) % 2 ? '#ffd34d' : '#ff7a3a'; ellipse(c, sx + t * 0.1, sy - t * 0.4, t * 0.06, t * 0.06); c.fill(); return;
    case 'moth':
      c.fillStyle = '#fff2b0'; ellipse(c, sx - t * 0.07, sy - t * 0.5, t * 0.08, t * 0.05 + Math.abs(Math.sin(now / 40)) * t * 0.04); c.fill();
      ellipse(c, sx + t * 0.07, sy - t * 0.5, t * 0.08, t * 0.05 + Math.abs(Math.sin(now / 40)) * t * 0.04); c.fill(); return;
    case 'drill':
      c.save(); c.translate(sx, sy - t * 0.25); c.rotate(Math.atan2(s.dy * v.squash, s.dx));
      c.fillStyle = '#a8a8b4'; c.strokeStyle = INK; c.lineWidth = 1; c.beginPath(); c.moveTo(t * 0.25, 0); c.lineTo(-t * 0.1, -t * 0.12); c.lineTo(-t * 0.1, t * 0.12); c.closePath(); c.fill(); c.stroke();
      c.restore(); return;
    default: return;
  }
}

/** Zones and rings on the floor, under everything standing: patches, brambles, pulses, splashes, bursts and thumps. */
function drawGroundShot(c: CanvasRenderingContext2D, v: View, s: Shot) {
  const t = v.tile, [sx, sy] = toScreen(v, s.x, s.y);
  const ring = (r: number, col: string, a: number, fill: boolean) => {
    c.globalAlpha = Math.max(0, a); ellipse(c, sx, sy, r * t, r * t * v.squash);
    if (fill) { c.fillStyle = col; c.fill(); } else { c.strokeStyle = col; c.lineWidth = 3; c.stroke(); }
    c.globalAlpha = 1;
  };
  switch (s.k) {
    case 'patch': ring(s.r, '#b06ad0', 0.3, true); return;
    case 'bramble': ring(s.r, '#4a7a2a', 0.45, true); return;
    case 'ring': ring(s.r, '#ffd76a', 1 - s.r / Math.max(0.1, s.max) * 0.7, false); return;
    case 'splash': ring(s.r * (0.6 + s.t / 0.3 * 0.4), '#c8bca8', 0.6 - s.t * 2, true); return;
    case 'burst': ring(s.r * (0.5 + s.t / 0.3 * 0.5), '#ff9a3a', 0.7 - s.t * 2, true); return;
    case 'thump': if (s.wait <= 0) ring(s.r * Math.min(1, s.t / 0.2), '#e0b070', 1 - s.t / 0.4, false); return;
    default: return;
  }
}

/** The floor's flat colour: the layer's tint at 55% over the cave's dark plum, mixed once per tint. */
const floors = new Map<string, string>();
function floorColour(tint: string) {
  let f = floors.get(tint);
  if (!f) {
    const n = parseInt(tint.slice(1), 16), mixc = (sh: number, base: number) => Math.round(base + (((n >> sh) & 255) - base) * 0.55);
    f = `rgb(${mixc(16, 0x2a)}, ${mixc(8, 0x1a)}, ${mixc(0, 0x34)})`; floors.set(tint, f);
  }
  return f;
}

// ── The dive ───────────────────────────────────────────────────────────────

/** Things standing on the floor, sorted by their feet's y each frame. Reused, so a frame allocates little. */
type Item = { y: number; k: number; i: number; o: unknown };
const items: Item[] = [];
let used = 0;
const put = (y: number, k: number, i: number, o: unknown) => {
  const it = items[used] ?? (items[used] = { y: 0, k: 0, i: 0, o: null });
  it.y = y; it.k = k; it.i = i; it.o = o; used++;
};
const K = { crystal: 0, critter: 1, ghost: 2, seg: 3, head: 4, buddy: 5, hero: 6, shot: 7, pod: 8, poof: 9, star: 10, chip: 11 };
const byY = (a: Item, b: Item) => a.y - b.y;

/**
 * Draws the dive: the tinted floor; one pass over rows top to bottom (each row's blocks, then everything whose feet
 * are in it, by y); the lantern light; the rumble ring; then the pod arrow, damage numbers and Fluff bars. Ages the
 * effects by the time since the last draw. `now` is in ms.
 */
export function drawDive(c: CanvasRenderingContext2D, d: Dive, v: View, fx: Fx, now: number, calm: boolean, an?: AnimState) {
  const dt = fx.last ? Math.min(0.1, Math.max(0, (now - fx.last) / 1000)) : 0;
  fx.last = now; ageFx(fx, dt);
  const t = v.tile, m = d.map, tint = TINT[d.layer];
  c.save();
  if (fx.shake > 0 && !calm) c.translate((hash(Math.floor(now / 30), 1) - 0.5) * fx.shake, (hash(Math.floor(now / 30), 2) - 0.5) * fx.shake);

  // 1. The floor.
  if (!paintCaveFloor(c, v, tint)) {
    c.fillStyle = floorColour(tint); c.fillRect(-20, -20, v.w + 40, v.h + 40);
  }
  const x0 = Math.max(0, Math.floor(v.cx - v.w / 2 / t) - 1), x1 = Math.min(m.w - 1, Math.ceil(v.cx + v.w / 2 / t) + 1);
  const rowH = t * v.squash, y0 = Math.max(0, Math.floor(v.cy - v.h / 2 / rowH) - 1), y1 = Math.min(m.h - 1, Math.ceil(v.cy + v.h / 2 / rowH) + 2);
  // Speckles on open floor, from a hash so they hold still.
  c.fillStyle = 'rgba(255, 220, 255, 0.07)';
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (m.tiles[y * m.w + x] !== 'floor') continue;
    const h = hash(x, y), [sx, sy] = toScreen(v, x, y);
    c.fillRect(sx + h * t * 0.8, sy + ((h * 7.7) % 1) * rowH * 0.8, t * 0.08, t * 0.05);
  }
  // Lit lanterns' warm pools.
  const lit = d.job?.id === 'lanterns' ? d.job.lit ?? [] : [];
  for (const i of lit) {
    const p = m.props[i], [sx, sy] = toScreen(v, p.x + 0.5, p.y + 0.5);
    c.fillStyle = 'rgba(255, 200, 100, 0.12)'; ellipse(c, sx, sy, JOBS.lanterns.pool * t, JOBS.lanterns.pool * t * v.squash); c.fill();
  }
  for (const s of d.shots) drawGroundShot(c, v, s);

  // 2. The row pass.
  used = 0;
  const left = v.cx - v.w / 2 / t - 1, right = v.cx + v.w / 2 / t + 1, top = v.cy - v.h / 2 / rowH - 1, bottom = v.cy + v.h / 2 / rowH + 2;
  const inView = (x: number, y: number) => x > left && x < right && y > top && y < bottom;
  for (const cr of d.crystals) if (inView(cr.x, cr.y)) put(cr.y, K.crystal, 0, cr);
  for (const cr of d.critters) if (inView(cr.x, cr.y)) put(cr.y, K.critter, 0, cr);
  if (an) for (const ca of an.critters.values()) if (ca.ghost && inView(ca.ghost.x, ca.ghost.y)) put(ca.ghost.y, K.ghost, 0, ca);
  const w = d.wyrm;
  if (w) { for (let i = 0; i < w.segs.length; i++) put(w.segs[i].y, K.seg, i, null); put(w.y, K.head, -1, null); }
  put(d.buddy.y, K.buddy, 0, null);
  put(d.hy, K.hero, 0, null);
  for (const s of d.shots) if (inView(s.x, s.y) && s.k !== 'patch' && s.k !== 'bramble' && s.k !== 'ring' && s.k !== 'splash' && s.k !== 'burst' && s.k !== 'thump') put(s.y, K.shot, 0, s);
  if (d.pod) put(d.pod.y, K.pod, 0, d.pod);
  for (const p of fx.poofs) put(p.y, K.poof, 0, p);
  for (const p of fx.stars) put(p.y, K.star, 0, p);
  for (const p of fx.chips) put(p.y, K.chip, 0, p);
  const list = items.slice(0, used).sort(byY);
  const litSet = new Set(lit.map((i) => m.props[i].y * m.w + m.props[i].x));
  let n = 0;
  const drawItem = (it: Item) => {
    const [sx, sy] = toScreen(v, it.k === K.ghost ? (it.o as { ghost: Critter }).ghost.x : it.k === K.seg ? w!.segs[it.i].x : it.k === K.head ? w!.x : it.k === K.buddy ? d.buddy.x : it.k === K.hero ? d.hx : (it.o as { x: number }).x, it.y);
    switch (it.k) {
      case K.crystal: drawCrystal(c, sx, sy, t, (it.o as { n: number }).n, now); return;
      case K.critter: { const cr = it.o as Critter; drawCritter(c, cr, sx, sy, t, an?.critters.get(cr.id), now, cr.x > d.hx ? -1 : 1); return; }
      case K.ghost: {
        const ca = it.o as CritterAnim & { ghost: Critter };
        if (ca.poof > 0 || (ca.flinch <= 0 && ca.dizzy <= 0)) drawPoof(c, sx, sy, t * (ca.ghost.elite ? 0.9 : 0.5) * (calm ? 0.6 : 1), ca.poof / POOF);
        else drawCritter(c, ca.ghost, sx, sy, t, ca, now, ca.ghost.x > d.hx ? -1 : 1);
        return;
      }
      case K.seg: case K.head: drawWyrmPiece(c, d, it.i, sx, sy, t, now); return;
      case K.buddy: { const other: Hero = d.hero === 'dora' ? 'enzo' : 'dora'; drawHero(c, other, an?.buddy ?? newAnim(), sx, sy, t, d.hx - d.buddy.x || 1, now, false, other === 'enzo'); return; }
      case K.hero: drawHero(c, d.hero, an?.hero ?? newAnim(), sx, sy, t, d.face.x, now, d.grace > 0, d.hero === 'enzo'); return;
      case K.shot: drawShot(c, v, it.o as Shot, now); return;
      case K.pod: drawPod(c, sx, sy, t, now, (it.o as { reached: boolean }).reached); return;
      case K.poof: { const p = it.o as Fx['poofs'][number]; drawPoof(c, sx, sy, p.r * t, p.t / FX_LIFE.poof); return; }
      case K.star: {
        const p = it.o as Fx['stars'][number], a = 1 - p.t / FX_LIFE.star;
        c.globalAlpha = a; c.fillStyle = '#ffe26a'; star(c, sx, sy - t * 0.6 - p.t * t, t * 0.18); c.globalAlpha = 1; return;
      }
      case K.chip: { const p = it.o as Fx['chips'][number]; c.fillStyle = p.c; c.fillRect(sx - 2, sy - t * 0.3, 4, 3); return; }
    }
  };
  while (n < list.length && list[n].y < y0) drawItem(list[n++]);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const b = m.tiles[y * m.w + x];
      if (b === 'floor') continue;
      const [sx, sy] = toScreen(v, x, y), crack = fx.cracks.get(y * 1000 + x)?.p ?? (d.digging && d.digging.x === x && d.digging.y === y ? d.digging.p : 0);
      drawBlock(c, b, sx, sy, t, tileAt(m, x, y + 1) === 'floor', crack, litSet.has(y * m.w + x), x, y);
    }
    while (n < list.length && list[n].y < y + 1) drawItem(list[n++]);
  }
  while (n < list.length) drawItem(list[n++]);

  // 3. Lantern light: one gradient darkens the cave beyond the hero's lamp (squashed like the floor); lit lanterns'
  //    pools and the waiting pod glow warm on top. One full-screen pass, so 300 critters stay smooth on a phone.
  const [hx, hy] = toScreen(v, d.hx, d.hy), lamp = 4 * CLASS[d.hero].lamp * t, ly = hy - t * 0.3;
  c.save(); c.translate(hx, ly); c.scale(1, v.squash);
  const shade = c.createRadialGradient(0, 0, 0, 0, 0, lamp);
  shade.addColorStop(0, 'rgba(255, 196, 110, 0.16)'); shade.addColorStop(0.5, 'rgba(255, 196, 110, 0.06)');
  shade.addColorStop(0.75, 'rgba(10, 4, 20, 0.2)'); shade.addColorStop(1, 'rgba(10, 4, 20, 0.62)');
  // The gradient only where it changes; flat dark beyond it, which rasterises far cheaper.
  c.fillStyle = shade; c.fillRect(-lamp, -lamp, lamp * 2, lamp * 2);
  c.restore();
  const L = hx - lamp, R = hx + lamp, T = ly - lamp * v.squash, B = ly + lamp * v.squash;
  c.fillStyle = 'rgba(10, 4, 20, 0.62)';
  c.fillRect(-20, -20, v.w + 40, T + 20); c.fillRect(-20, B, v.w + 40, v.h + 20 - B);
  c.fillRect(-20, T, L + 20, B - T); c.fillRect(R, T, v.w + 20 - R, B - T);
  const glow = (x: number, y: number, r: number, a: number) => {
    const [sx, sy] = toScreen(v, x, y);
    if (sx < -r || sx > v.w + r || sy < -r || sy > v.h + r) return;
    const g = c.createRadialGradient(sx, sy, 0, sx, sy, r);
    g.addColorStop(0, `rgba(255, 200, 110, ${a})`); g.addColorStop(1, 'rgba(255, 200, 110, 0)');
    c.fillStyle = g; c.fillRect(sx - r, sy - r, r * 2, r * 2);
  };
  for (const i of lit) glow(m.props[i].x + 0.5, m.props[i].y + 0.5, JOBS.lanterns.pool * t, 0.3);
  if (d.pod && !d.pod.reached) glow(d.pod.x, d.pod.y - 0.6, t * 1.6, 0.35);

  // 4. The rumble ring: the telegraph's warning edge, then the shockwave.
  if (w && !w.bonked && w.under <= 0) {
    const [sx, sy] = toScreen(v, w.x, w.y);
    if (w.ring !== null) {
      c.strokeStyle = 'rgba(255, 150, 70, 0.85)'; c.lineWidth = WYRM.ringWidth * t;
      ellipse(c, sx, sy, w.ring * t, w.ring * t * v.squash); c.stroke();
    } else if (w.rumble <= WYRM.telegraph) {
      c.setLineDash([8, 6]); c.strokeStyle = Math.floor(now / 120) % 2 ? '#ff6a4a' : '#ffd34d'; c.lineWidth = 3;
      ellipse(c, sx, sy, WYRM.ring * t, WYRM.ring * t * v.squash); c.stroke(); c.setLineDash([]);
    }
  }

  // The level-up ring.
  if (fx.level >= 0) {
    const p = fx.level / FX_LIFE.level, r = t * (0.5 + p * 1.5);
    c.globalAlpha = 1 - p; c.strokeStyle = '#ffe26a'; c.lineWidth = 4;
    ellipse(c, hx, hy - t * 0.4, r, r * v.squash); c.stroke(); c.globalAlpha = 1;
  }

  // 5. The pod arrow, damage numbers and Fluff bars.
  c.font = `800 ${Math.round(Math.max(11, t * 0.3))}px ui-rounded, system-ui, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
  for (const p of fx.nums) {
    if (!inView(p.x, p.y)) continue;
    const [sx, sy] = toScreen(v, p.x, p.y);
    c.globalAlpha = Math.min(1, 2 - (2 * p.t) / FX_LIFE.num);
    outlined(c, String(p.n), sx, sy - t * 0.7 - p.t * t * 0.8, p.crit ? '#ffd34d' : '#ffffff');
  }
  c.globalAlpha = 1;
  for (const cr of d.critters) {
    if (!cr.elite || !inView(cr.x, cr.y)) continue;
    const [sx, sy] = toScreen(v, cr.x, cr.y), r = CRITTERS[cr.kind].radius * ELITE.size * t;
    bar(c, sx - r, sy - r * 2.6 - 6, r * 2, 4, cr.fluff / cr.max, cr.id === d.bigId ? '#ffb03a' : '#ff7a6a');
  }
  if (w && !w.bonked && w.under <= 0) {
    const [sx, sy] = toScreen(v, w.x, w.y);
    bar(c, sx - t * 0.8, sy - WYRM.head * t * 2.4 - 10, t * 1.6, 5, w.fluff / w.max, '#ff7a6a');
  }
  if (d.pod && !d.pod.reached) podArrow(c, v, d.pod.x, d.pod.y, now);
  c.restore();
}

/** An arrow at the screen's edge toward the pod while it's off screen. */
function podArrow(c: CanvasRenderingContext2D, v: View, x: number, y: number, now: number) {
  const [px, py] = toScreen(v, x, y), pad = 28;
  if (px > pad && px < v.w - pad && py > pad && py < v.h - pad) return;
  const cx = v.w / 2, cy = v.h / 2, dx = px - cx, dy = py - cy;
  const k = Math.min((v.w / 2 - pad) / Math.max(1e-6, Math.abs(dx)), (v.h / 2 - pad) / Math.max(1e-6, Math.abs(dy)));
  const ax = cx + dx * k, ay = cy + dy * k, a = Math.atan2(dy, dx), s = 14 + Math.sin(now / 150) * 2;
  c.save(); c.translate(ax, ay); c.rotate(a);
  c.fillStyle = '#ffd34d'; c.strokeStyle = INK; c.lineWidth = 2.5;
  c.beginPath(); c.moveTo(s, 0); c.lineTo(-s * 0.7, -s * 0.7); c.lineTo(-s * 0.35, 0); c.lineTo(-s * 0.7, s * 0.7); c.closePath(); c.stroke(); c.fill();
  c.restore();
}

/** The floating joystick: a ring at the touch point and the knob where the thumb is, in CSS px. */
export function drawStick(c: CanvasRenderingContext2D, ox: number, oy: number, kx: number, ky: number, r: number) {
  c.fillStyle = 'rgba(255, 244, 230, 0.12)'; c.strokeStyle = 'rgba(255, 244, 230, 0.5)'; c.lineWidth = 2;
  ellipse(c, ox, oy, r, r); c.fill(); c.stroke();
  c.fillStyle = 'rgba(255, 226, 120, 0.7)'; ellipse(c, kx, ky, r * 0.4, r * 0.4); c.fill();
}

// ── The title ──────────────────────────────────────────────────────────────

/** The title picture until the painting comes: the two of them by a lantern in a purple cave, with crystals. */
export function drawTitle(c: CanvasRenderingContext2D, w: number, h: number, now: number) {
  const g = c.createRadialGradient(w * 0.5, h * 0.55, 10, w * 0.5, h * 0.55, w * 0.7);
  g.addColorStop(0, '#8a5a9a'); g.addColorStop(0.5, TINT[1]); g.addColorStop(1, '#1c1024');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  const t = h / 5;
  for (let i = 0; i < 9; i++) {
    const x = (i / 8) * w, y = h * (i % 2 ? 0.12 : 0.9), b: Block = i % 3 === 0 ? 'gold' : 'dirt';
    drawBlock(c, b, x - t / 2, y, t, true, 0, false, i, 1);
  }
  const glow = c.createRadialGradient(w * 0.5, h * 0.42, 0, w * 0.5, h * 0.42, t * 2.2);
  glow.addColorStop(0, 'rgba(255, 210, 120, 0.55)'); glow.addColorStop(1, 'rgba(255, 210, 120, 0)');
  c.fillStyle = glow; c.fillRect(0, 0, w, h);
  drawBlock(c, 'lantern', w * 0.5 - t / 2, h * 0.36, t * 0.8, true, 0, true, 0, 0);
  for (let i = 0; i < 6; i++) drawCrystal(c, w * (0.15 + i * 0.14), h * (0.72 + (i % 2) * 0.08), t, i === 2 ? 10 : 1, now);
  const soot: Critter = { id: 0, kind: 'soot', elite: false, x: 0, y: 0, fluff: 1, max: 1, slow: 0, slowFor: 0, stun: 0, hit: 0, state: 'walk', t: 0, dx: -1, dy: 0 };
  drawCritter(c, soot, w * 0.88, h * 0.78, t, undefined, now, -1);
  drawCritter(c, { ...soot, kind: 'mite' as CritterId }, w * 0.1, h * 0.7, t, undefined, now, 1);
  drawChinchilla(c, 'dora', w * 0.32, h * 0.76, { face: 1, h: t * 1.3, time: now / 1000 });
  drawChinchilla(c, 'enzo', w * 0.68, h * 0.76, { face: -1, h: t * 1.3, time: now / 1000 + 1 });
}
