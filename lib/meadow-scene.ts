// Meadowmend's drawing, in Canvas 2D: the bare winter valley floor, the hex tiles (meadow with grass and flowers,
// woods of round trees and pines, sandy burrow-hills with holes, and streams that flow from edge to edge and pool in
// the middle), the cells a tile can go, the ghost tile with a tick or a cross on every edge, wish flags, ponds with
// ducklings, bees, butterflies, rabbits and hedgehogs in finished patches, sparkles, pops, and Dora and Enzo, who hop
// to each new tile, cheer a Perfect and sit by the ponds. They are painted poses once those load (the shared drawn
// chinchillas until then), and always drawn big enough to read. Tiles drop in with a bounce; the camera pans, zooms
// and frames the valley as it grows.
// Drawing only: the rules are in meadow-game.ts.
import { drawChinchilla } from './chinchilla-art';
import {
  MeadowGame, DIRS, key, rotate, parseEdges, opp, ANIMAL_OF, type Terrain, type Ev, type ValleyDef, type Assessment, type Wish, type Animal,
} from './meadow-game';

const TAU = Math.PI * 2, SQ3 = Math.sqrt(3);
const mk = (w: number, h: number) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; };
const ctx2 = (c: HTMLCanvasElement) => c.getContext('2d')!;
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (rate: number, dt: number) => 1 - Math.exp(-rate * dt);
/** A fixed hash in place of randomness, so the scenery looks the same every time. */
const hash = (n: number) => { const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };
const strHash = (s: string) => { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) % 100000; };
const backOut = (t: number) => { const s = 1.9; t -= 1; return t * t * ((s + 1) * t + s) + 1; };

/** World units are hex radii: centre of (q, r) on a pointy-top grid. */
export const hexX = (q: number, r: number) => SQ3 * (q + r / 2);
export const hexY = (r: number) => 1.5 * r;
/** Corner j of a pointy-top hex (0 at the top, clockwise); edge i runs from corner i to corner i + 1. */
const corner = (j: number, R: number): [number, number] => { const a = (-90 + 60 * j) * (Math.PI / 180); return [Math.cos(a) * R, Math.sin(a) * R]; };
const edgeMid = (i: number, R: number, f = 1): [number, number] => { const a = (-60 + 60 * i) * (Math.PI / 180); return [Math.cos(a) * R * 0.866 * f, Math.sin(a) * R * 0.866 * f]; };
const hexPath = (c: CanvasRenderingContext2D, x: number, y: number, R: number) => { c.beginPath(); for (let j = 0; j < 6; j++) { const [a, b] = corner(j, R); if (j) c.lineTo(x + a, y + b); else c.moveTo(x + a, y + b); } c.closePath(); };

export const COLORS: Record<Terrain, { base: string; dark: string; light: string }> = {
  meadow: { base: '#9fcf5c', dark: '#7cb146', light: '#c4e57c' },
  woods: { base: '#5f9c4a', dark: '#467f3a', light: '#7cb65a' },
  hill: { base: '#dcc28a', dark: '#bea06a', light: '#efdcae' },
  stream: { base: '#5ab4e6', dark: '#3a8cc4', light: '#b4e6ff' },
};
const EARTH = '#8a6440', EARTH_DARK = '#5e4129';
export const EMOJI: Record<Animal, string> = { bee: '🐝', hedgehog: '🦔', rabbit: '🐇', duck: '🦆' };

/** One tile's face, centred on (0, 0) with radius R: the land wedges, the stream, then everything that stands up. */
export function paintTile(c: CanvasRenderingContext2D, e: Terrain[], R: number, seed: number, o: { side?: boolean; oak?: boolean } = {}) {
  if (o.side !== false) {
    // the tile's earthy edge, seen a little from above
    c.save(); c.translate(0, R * 0.16); hexPath(c, 0, 0, R); c.fillStyle = EARTH; c.fill();
    c.translate(0, R * 0.05); hexPath(c, 0, 0, R * 0.99); c.fillStyle = EARTH_DARK; c.globalAlpha = 0.5; c.fill(); c.restore();
  }
  c.save(); hexPath(c, 0, 0, R); c.clip();
  // land under a stream is the bank's land: the nearest land edge
  const landAt = (i: number): Terrain => { for (let k = 1; k < 4; k++) { const a = e[(i + 6 - k) % 6], b = e[(i + k) % 6]; if (a !== 'stream') return a; if (b !== 'stream') return b; } return 'meadow'; };
  for (let i = 0; i < 6; i++) {
    const t = e[i] === 'stream' ? landAt(i) : e[i];
    const [ax, ay] = corner(i, R * 1.02), [bx, by] = corner(i + 1, R * 1.02);
    c.beginPath(); c.moveTo(0, 0); c.lineTo(ax, ay); c.lineTo(bx, by); c.closePath();
    c.fillStyle = COLORS[t].base; c.fill();
    // a soft seam where two land terrains meet inside the tile
    c.strokeStyle = COLORS[t].base; c.lineWidth = 1.2; c.stroke();
  }
  // gentle light from the top left
  const g = c.createLinearGradient(-R, -R, R, R); g.addColorStop(0, 'rgba(255,255,230,0.18)'); g.addColorStop(1, 'rgba(40,30,10,0.14)');
  c.fillStyle = g; c.fillRect(-R, -R, R * 2, R * 2);
  // ground texture: grass strokes on meadow, needles on woods, little pebbles on hills
  const s = (n: number) => hash(seed * 31.7 + n);
  for (let i = 0; i < 6; i++) {
    const t = e[i] === 'stream' ? landAt(i) : e[i];
    for (let n = 0; n < 9; n++) {
      const [x, y] = inWedge(i, R, s(i * 50 + n), s(i * 50 + n + 17));
      if (t === 'meadow') { c.strokeStyle = n % 2 ? COLORS.meadow.dark : COLORS.meadow.light; c.lineWidth = R * 0.025; c.beginPath(); c.moveTo(x, y); c.lineTo(x - R * 0.03, y - R * 0.08); c.moveTo(x, y); c.lineTo(x + R * 0.03, y - R * 0.07); c.stroke(); }
      else if (t === 'woods') { c.fillStyle = 'rgba(40,70,30,0.35)'; c.beginPath(); c.ellipse(x, y, R * 0.06, R * 0.03, 0, 0, TAU); c.fill(); }
      else if (t === 'hill') { c.fillStyle = n % 3 ? 'rgba(150,120,80,0.35)' : 'rgba(255,245,220,0.5)'; c.beginPath(); c.arc(x, y, R * 0.022, 0, TAU); c.fill(); }
    }
  }
  // the stream
  const st = e.map((t, i) => (t === 'stream' ? i : -1)).filter((i) => i >= 0);
  if (st.length) {
    const w = R * 0.3;
    const path = () => {
      c.beginPath();
      if (st.length === 2) { const [a, b] = [edgeMid(st[0], R, 1.04), edgeMid(st[1], R, 1.04)]; c.moveTo(a[0], a[1]); c.quadraticCurveTo(0, 0, b[0], b[1]); }
      else for (const i of st) { const m = edgeMid(i, R, 1.04); c.moveTo(m[0], m[1]); c.quadraticCurveTo(m[0] * 0.35, m[1] * 0.35, 0, 0); }
    };
    c.lineCap = 'round';
    path(); c.strokeStyle = 'rgba(70,90,60,0.45)'; c.lineWidth = w * 1.35; c.stroke();
    path(); c.strokeStyle = COLORS.stream.dark; c.lineWidth = w * 1.08; c.stroke();
    path(); c.strokeStyle = COLORS.stream.base; c.lineWidth = w * 0.86; c.stroke();
    path(); c.strokeStyle = 'rgba(200,240,255,0.55)'; c.lineWidth = w * 0.18; c.stroke();
    if (st.length !== 2) {
      // a spring, or where streams meet: a little pool in the middle
      const pr = st.length === 1 ? R * 0.3 : R * 0.24;
      c.fillStyle = 'rgba(70,90,60,0.45)'; c.beginPath(); c.arc(0, 0, pr * 1.18, 0, TAU); c.fill();
      c.fillStyle = COLORS.stream.dark; c.beginPath(); c.arc(0, 0, pr * 1.05, 0, TAU); c.fill();
      c.fillStyle = COLORS.stream.base; c.beginPath(); c.arc(0, 0, pr * 0.92, 0, TAU); c.fill();
      c.fillStyle = 'rgba(220,250,255,0.6)'; c.beginPath(); c.ellipse(-pr * 0.3, -pr * 0.3, pr * 0.3, pr * 0.14, -0.5, 0, TAU); c.fill();
    }
  }
  c.restore();
  // everything that stands up, back to front
  const items: { y: number; draw: () => void }[] = [];
  if (o.oak) items.push({ y: 0.1 * R, draw: () => oak(c, 0, R * 0.25, R) });
  for (let i = 0; i < 6; i++) {
    const t = e[i]; if (t === 'stream') continue;
    const n = t === 'woods' ? (o.oak ? 1 : 3) : t === 'hill' ? 2 : 4;
    for (let k = 0; k < n; k++) {
      const [x, y] = inWedge(i, R, s(i * 9 + k * 3 + 300), s(i * 9 + k * 3 + 301), st.length ? 0.25 : 0.12);
      const v = s(i * 9 + k * 3 + 302);
      if (t === 'woods') items.push({ y, draw: () => tree(c, x, y, R, v) });
      else if (t === 'hill') items.push({ y, draw: () => mound(c, x, y, R, v) });
      else items.push({ y, draw: () => flower(c, x, y, R, v) });
    }
  }
  items.sort((a, b) => a.y - b.y).forEach((it) => it.draw());
  // a fine rim
  hexPath(c, 0, 0, R); c.strokeStyle = 'rgba(60,50,20,0.28)'; c.lineWidth = Math.max(1, R * 0.025); c.stroke();
}
/** A point inside wedge i, kept off the rim and away from the middle. */
function inWedge(i: number, R: number, u: number, v: number, inner = 0.12): [number, number] {
  if (u + v > 1) { u = 1 - u; v = 1 - v; }
  const [ax, ay] = corner(i, R), [bx, by] = corner(i + 1, R);
  const f = inner + (0.8 - inner) * (u + v), w = u + v > 0 ? v / (u + v) : 0.5;
  const ex = lerp(ax, bx, 0.15 + w * 0.7), ey = lerp(ay, by, 0.15 + w * 0.7);
  return [ex * f, ey * f];
}
function tree(c: CanvasRenderingContext2D, x: number, y: number, R: number, v: number) {
  const s = R * (0.17 + v * 0.06);
  c.fillStyle = 'rgba(30,50,20,0.3)'; c.beginPath(); c.ellipse(x + s * 0.2, y + s * 0.15, s * 0.8, s * 0.35, 0, 0, TAU); c.fill();
  if (v < 0.45) {
    // a pine
    c.fillStyle = '#5a3e26'; c.fillRect(x - s * 0.1, y - s * 0.3, s * 0.2, s * 0.4);
    const layers: [number, string][] = [[0, '#2f6b3a'], [0.45, '#3a7d42'], [0.85, '#4a904c']];
    for (const [k, col] of layers) { c.fillStyle = col; c.beginPath(); c.moveTo(x, y - s * (1.6 + k * 0.55) ); c.lineTo(x + s * (0.75 - k * 0.22), y - s * (0.25 + k * 0.6)); c.lineTo(x - s * (0.75 - k * 0.22), y - s * (0.25 + k * 0.6)); c.closePath(); c.fill(); }
  } else {
    // a round birch or beech
    c.fillStyle = v > 0.8 ? '#e8e4d8' : '#6b4a2e'; c.fillRect(x - s * 0.09, y - s * 0.6, s * 0.18, s * 0.7);
    c.fillStyle = '#3f7f3f'; c.beginPath(); c.arc(x, y - s * 0.95, s * 0.68, 0, TAU); c.fill();
    c.fillStyle = '#5aa04e'; c.beginPath(); c.arc(x - s * 0.18, y - s * 1.08, s * 0.44, 0, TAU); c.fill();
    c.fillStyle = 'rgba(200,240,160,0.35)'; c.beginPath(); c.arc(x - s * 0.28, y - s * 1.2, s * 0.18, 0, TAU); c.fill();
  }
}
function oak(c: CanvasRenderingContext2D, x: number, y: number, R: number) {
  const s = R * 0.62;
  c.fillStyle = 'rgba(30,50,20,0.32)'; c.beginPath(); c.ellipse(x + s * 0.2, y + s * 0.05, s * 0.9, s * 0.3, 0, 0, TAU); c.fill();
  c.fillStyle = '#5e3f22'; c.beginPath(); c.moveTo(x - s * 0.22, y); c.lineTo(x - s * 0.12, y - s * 0.7); c.lineTo(x + s * 0.12, y - s * 0.7); c.lineTo(x + s * 0.26, y); c.closePath(); c.fill();
  for (const [dx, dy, r, col] of [[-0.45, -0.95, 0.42, '#356f35'], [0.45, -0.95, 0.42, '#356f35'], [0, -1.25, 0.55, '#3f7f3f'], [-0.25, -1.05, 0.35, '#4e9a48'], [0.3, -1.15, 0.3, '#5aa04e']] as [number, number, number, string][]) {
    c.fillStyle = col; c.beginPath(); c.arc(x + dx * s, y + dy * s, r * s, 0, TAU); c.fill();
  }
  c.fillStyle = '#e8a83a'; for (let i = 0; i < 5; i++) { c.beginPath(); c.arc(x + (hash(i) - 0.5) * s * 1.2, y - s * (0.8 + hash(i + 9) * 0.6), s * 0.05, 0, TAU); c.fill(); }
}
function mound(c: CanvasRenderingContext2D, x: number, y: number, R: number, v: number) {
  const s = R * (0.16 + v * 0.05);
  c.fillStyle = COLORS.hill.dark; c.beginPath(); c.ellipse(x, y, s * 1.1, s * 0.62, 0, Math.PI, TAU); c.fill();
  c.fillStyle = COLORS.hill.light; c.beginPath(); c.ellipse(x - s * 0.12, y - s * 0.04, s * 0.85, s * 0.5, 0, Math.PI, TAU); c.fill();
  if (v > 0.35) { c.fillStyle = '#4a3424'; c.beginPath(); c.ellipse(x + s * 0.1, y - s * 0.1, s * 0.3, s * 0.2, 0, 0, TAU); c.fill(); }
  else { c.fillStyle = '#8cb85a'; c.beginPath(); c.arc(x - s * 0.2, y - s * 0.5, s * 0.12, 0, TAU); c.arc(x + s * 0.1, y - s * 0.52, s * 0.1, 0, TAU); c.fill(); }
}
function flower(c: CanvasRenderingContext2D, x: number, y: number, R: number, v: number) {
  const s = R * 0.05, col = v < 0.3 ? '#fff6e8' : v < 0.55 ? '#ffd84a' : v < 0.8 ? '#ff9ec4' : '#b8a4ff';
  c.strokeStyle = '#5a9a3a'; c.lineWidth = s * 0.4; c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - s * 1.6); c.stroke();
  c.fillStyle = col; for (let k = 0; k < 5; k++) { const a = (k / 5) * TAU; c.beginPath(); c.arc(x + Math.cos(a) * s * 0.7, y - s * 1.8 + Math.sin(a) * s * 0.7, s * 0.55, 0, TAU); c.fill(); }
  c.fillStyle = '#f0a020'; c.beginPath(); c.arc(x, y - s * 1.8, s * 0.42, 0, TAU); c.fill();
}
function rock(c: CanvasRenderingContext2D, R: number, seed: number) {
  c.fillStyle = 'rgba(40,40,30,0.3)'; c.beginPath(); c.ellipse(R * 0.08, R * 0.32, R * 0.62, R * 0.24, 0, 0, TAU); c.fill();
  const pts: [number, number][] = []; for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU, r = R * (0.5 + hash(seed + i) * 0.14); pts.push([Math.cos(a) * r, Math.sin(a) * r * 0.72 - R * 0.08]); }
  c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath();
  const g = c.createLinearGradient(0, -R * 0.6, 0, R * 0.4); g.addColorStop(0, '#c4c2bc'); g.addColorStop(1, '#7a7872'); c.fillStyle = g; c.fill();
  c.strokeStyle = '#5a5850'; c.lineWidth = R * 0.03; c.stroke();
  c.fillStyle = 'rgba(255,255,255,0.35)'; c.beginPath(); c.ellipse(-R * 0.15, -R * 0.35, R * 0.18, R * 0.07, -0.3, 0, TAU); c.fill();
  c.fillStyle = '#7aa848'; c.beginPath(); c.ellipse(R * 0.3, R * 0.25, R * 0.14, R * 0.06, 0, 0, TAU); c.fill();
}

/** A tile in the HUD: the current tile, the peek at the next, and the wish it carries. */
export function drawTileIcon(cv: HTMLCanvasElement, edges: string, rot: number, wish?: { terrain: Terrain; size: number; kind: 'atleast' | 'exact'; edge: number } | null, spin = 0) {
  const c = ctx2(cv), W = cv.width, H = cv.height, R = Math.min(W / SQ3, H / 2.25) * 0.92;
  c.clearRect(0, 0, W, H);
  c.save(); c.translate(W / 2, H / 2 - R * 0.08); c.rotate(spin);
  paintTile(c, rotate(parseEdges(edges), rot), R, strHash(edges) + 7);
  c.restore();
  if (wish) {
    const [mx, my] = edgeMid((wish.edge + rot) % 6, R, 0.5);
    flag(c, W / 2 + Math.cos(spin) * mx - Math.sin(spin) * my, H / 2 - R * 0.08 + Math.sin(spin) * mx + Math.cos(spin) * my, R * 0.36, ANIMAL_OF[wish.terrain], `${wish.kind === 'exact' ? '=' : ''}${wish.size}${wish.kind === 'atleast' ? '+' : ''}`, 'open', 0);
  }
}
/** A wish flag: a little post with a round sign showing who wishes and for how many. */
function flag(c: CanvasRenderingContext2D, x: number, y: number, s: number, animal: Animal, label: string, state: Wish['state'], prog: number) {
  c.save();
  c.globalAlpha *= state === 'failed' ? 0.55 : 1;
  c.strokeStyle = '#6b4a2e'; c.lineWidth = s * 0.12; c.lineCap = 'round'; c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - s * 1.2); c.stroke();
  const cy = y - s * 1.55;
  c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.arc(x + s * 0.06, cy + s * 0.08, s * 0.62, 0, TAU); c.fill();
  c.fillStyle = state === 'done' ? '#e8ffd8' : state === 'failed' ? '#ddd' : '#fffaf0'; c.beginPath(); c.arc(x, cy, s * 0.6, 0, TAU); c.fill();
  c.strokeStyle = state === 'done' ? '#3aa04a' : state === 'failed' ? '#999' : '#e8a83a'; c.lineWidth = s * 0.1; c.stroke();
  if (state === 'open' && prog > 0) { c.strokeStyle = '#3aa04a'; c.lineWidth = s * 0.14; c.beginPath(); c.arc(x, cy, s * 0.6, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(prog, 0, 1)); c.stroke(); }
  c.font = `${Math.round(s * 0.66)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillStyle = '#000'; c.fillText(EMOJI[animal], x, cy + s * 0.04);
  if (label) {
    c.font = `900 ${Math.round(s * 0.42)}px ui-rounded,system-ui,sans-serif`;
    const w = c.measureText(label).width + s * 0.32;
    c.fillStyle = state === 'done' ? '#3aa04a' : state === 'failed' ? '#888' : '#e8833a';
    c.beginPath(); c.roundRect(x + s * 0.25, cy + s * 0.18, w, s * 0.5, s * 0.25); c.fill();
    c.fillStyle = '#fff'; c.fillText(label, x + s * 0.25 + w / 2, cy + s * 0.44);
  }
  c.restore();
}

type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string; kind: 'spark' | 'star' | 'puff' | 'leaf' | 'drop'; g: number };
type Pop = { text: string; x: number; y: number; age: number; color: string; big: boolean };
type Who = 'dora' | 'enzo';
export type Pose = 'walk' | 'sit' | 'cheer';
const POSES: Pose[] = ['walk', 'sit', 'cheer'];
const STAND_IN: Record<Pose, Pose[]> = { walk: ['sit', 'cheer'], sit: ['cheer', 'walk'], cheer: ['sit', 'walk'] };
/** The sprites are 768 × 512, feet on a line 16 from the bottom; Enzo's sitting figure is 360 tall (Dora's 320). */
const SPRITE_H = 512, SPRITE_FOOT = 16, SPRITE_ENZO = 360;
type Chin = { who: Who; x: number; y: number; tx: number; ty: number; face: 1 | -1; hop: number; cheer: number; delay: number; moving: boolean; box: { x: number; y: number; w: number; h: number } };

export type Ghost = { q: number; r: number; rot: number; a: Assessment; pending: boolean } | null;
export type DrawOpts = { dt: number; ghost: Ghost; hints: boolean; spots: [number, number][]; guide: [number, number] | null; showFrontier: boolean };

export class MeadowScene {
  private canvas: HTMLCanvasElement; private c: CanvasRenderingContext2D;
  private W = 1; private H = 1; private dpr = 1;
  /** The camera: centre in world units, and pixels per unit (a hex radius). */
  cx = 0; cy = 0; k = 50; private tx = 0; private ty = 0; private tk = 50; private manualUntil = 0;
  /** Screen pixels kept clear round the edges (for the HUD laid over the canvas). */
  inset = { top: 0, right: 0, bottom: 0, left: 0 };
  private time = 0;
  private art = new Map<string, HTMLImageElement>();
  private tiles = new Map<string, { cv: HTMLCanvasElement; sig: string }>();
  private ghostCache = new Map<string, HTMLCanvasElement>();
  private drops = new Map<string, number>();
  private glow = new Map<string, { t: number; color: string }>();
  private parts: Particle[] = []; private pops: Pop[] = [];
  private chins: Chin[] = [];
  private game: MeadowGame | null = null;
  private ghostAng = 0; private ghostKey = '';
  private ground: HTMLCanvasElement | null = null;
  private TEX = 80;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas; this.c = ctx2(canvas);
    for (const w of ['dora', 'enzo'] as Who[]) for (const p of POSES) this.load(`${w}-${p}`);
    this.resize();
  }
  private load(name: string) { if (this.art.has(name)) return; const img = new Image(); img.decoding = 'async'; img.src = `/art/meadow/${name}.webp`; this.art.set(name, img); }
  private img(name: string) { const i = this.art.get(name); return i && i.complete && i.naturalWidth > 0 ? i : null; }
  private pose(who: Who, p: Pose) { for (const q of [p, ...STAND_IN[p]]) { const i = this.img(`${who}-${q}`); if (i) return i; } return null; }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.W = Math.max(1, r.width); this.H = Math.max(1, r.height);
    const w = Math.round(this.W * this.dpr), h = Math.round(this.H * this.dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    if (this.game) this.frame(true);
  }
  /** A new game (or none): forgets the old valley's drawings and puts the pair on the start. */
  setGame(g: MeadowGame | null) {
    this.game = g; this.tiles.clear(); this.drops.clear(); this.glow.clear(); this.parts = []; this.pops = []; this.manualUntil = 0;
    if (!g) { this.chins = []; return; }
    // on the last tile placed, or at the start below the lowest tile, clear of the holes in the middle
    let at: [number, number] = g.last ?? [0, 0], dy = 0.5;
    if (!g.last) { let best = -Infinity; for (const c of g.cells.values()) if (c.kind !== 'rock') { const v = c.r * 10 - Math.abs(c.q + c.r / 2); if (v > best) { best = v; at = [c.q, c.r]; } } dy = 0.9; }
    const x = hexX(at[0], at[1]), y = hexY(at[1]);
    this.chins = (['dora', 'enzo'] as Who[]).map((who, i) => ({ who, x: x + (i ? 0.62 : -0.42), y: y + dy, tx: x + (i ? 0.62 : -0.42), ty: y + dy, face: (i ? -1 : 1) as 1 | -1, hop: 0, cheer: 0, delay: 0, moving: false, box: { x: 0, y: 0, w: 0, h: 0 } }));
    this.frame(true);
  }
  // ---------------------------------------------------------------- camera
  toScreen(wx: number, wy: number): [number, number] { return [(wx - this.cx) * this.k + this.W / 2, (wy - this.cy) * this.k + this.H / 2]; }
  cellToScreen(q: number, r: number): [number, number] { return this.toScreen(hexX(q, r), hexY(r)); }
  /** The cell under a point on the canvas (CSS pixels). */
  pick(sx: number, sy: number): [number, number] {
    const x = (sx - this.W / 2) / this.k + this.cx, y = (sy - this.H / 2) / this.k + this.cy;
    const fq = (SQ3 / 3) * x - y / 3, fr = (2 / 3) * y, fs = -fq - fr;
    let q = Math.round(fq), r = Math.round(fr); const s = Math.round(fs);
    const dq = Math.abs(q - fq), dr = Math.abs(r - fr), ds = Math.abs(s - fs);
    if (dq > dr && dq > ds) q = -r - s; else if (dr > ds) r = -q - s;
    return [q, r];
  }
  private kRange() { const small = Math.min(this.W, this.H); return [Math.max(10, small / 40), Math.max(60, small / 5)]; }
  pan(dx: number, dy: number) { this.tx -= dx / this.k; this.ty -= dy / this.k; this.cx = this.tx; this.cy = this.ty; this.manualUntil = this.time + 12; }
  zoomAt(f: number, sx = this.W / 2, sy = this.H / 2) {
    const [lo, hi] = this.kRange(), nk = clamp(this.k * f, lo, hi);
    const wx = (sx - this.W / 2) / this.k + this.cx, wy = (sy - this.H / 2) / this.k + this.cy;
    this.k = this.tk = nk; this.cx = this.tx = wx - (sx - this.W / 2) / nk; this.cy = this.ty = wy - (sy - this.H / 2) / nk;
    this.manualUntil = this.time + 12;
  }
  /** Frames the whole valley (and the cells round it) inside the clear part of the screen. */
  frame(instant = false) {
    const g = this.game; if (!g) return;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    const add = (q: number, r: number) => { const x = hexX(q, r), y = hexY(r); x0 = Math.min(x0, x - 1); x1 = Math.max(x1, x + 1); y0 = Math.min(y0, y - 1.2); y1 = Math.max(y1, y + 1.2); };
    for (const c of g.cells.values()) add(c.q, c.r);
    for (const [q, r] of g.frontier()) add(q, r);
    const I = this.inset, aw = Math.max(80, this.W - I.left - I.right), ah = Math.max(80, this.H - I.top - I.bottom);
    const [lo] = this.kRange(), hi = Math.min(84, Math.min(this.W, this.H) / 6);
    const k = clamp(Math.min(aw / (x1 - x0 + 0.6), ah / (y1 - y0 + 0.6)), lo, Math.max(lo, hi));
    this.tk = k;
    this.tx = (x0 + x1) / 2 - (I.left - I.right) / 2 / k;
    this.ty = (y0 + y1) / 2 - (I.top - I.bottom) / 2 / k;
    this.manualUntil = 0;
    if (instant) { this.k = this.tk; this.cx = this.tx; this.cy = this.ty; }
  }

  // ---------------------------------------------------------------- events
  feed(events: Ev[], g: MeadowGame) {
    this.game = g;
    for (const e of events) {
      if (e.k === 'place') {
        const k = key(e.q, e.r); this.drops.set(k, this.time); this.tiles.delete(k);
        const x = hexX(e.q, e.r), y = hexY(e.r);
        if (e.pts > 0) this.addPop({ text: `+${e.pts}`, x, y: y - 0.9, age: 0, color: '#fff7c8', big: e.pts >= 60 });
        this.walkTo(x, y);
        if (this.time >= this.manualUntil) this.frame();
      } else if (e.k === 'match') {
        const [mx, my] = edgeMid(e.side, 1); const x = hexX(e.q, e.r) + mx, y = hexY(e.r) + my;
        for (let i = 0; i < 6; i++) this.parts.push({ x, y, vx: (hash(this.time * 9 + i) - 0.5) * 1.6, vy: -0.6 - hash(i + this.time) * 1.2, life: 0, max: 0.6 + hash(i * 3) * 0.3, size: 0.08, color: i % 2 ? '#fff6a8' : '#ffffff', kind: 'spark', g: 1.5 });
      } else if (e.k === 'perfect') {
        const x = hexX(e.q, e.r), y = hexY(e.r);
        this.glow.set(key(e.q, e.r), { t: this.time, color: '#ffd84a' });
        for (let i = 0; i < 22; i++) { const a = (i / 22) * TAU; this.parts.push({ x, y, vx: Math.cos(a) * 2.6, vy: Math.sin(a) * 2.6 - 1, life: 0, max: 1, size: 0.13, color: i % 3 ? '#ffd84a' : '#fff', kind: 'star', g: 1.2 }); }
        this.addPop({ text: 'Perfect!', x, y: y - 1.4, age: 0, color: '#ffe46a', big: true });
        this.cheer(1.6);
      } else if (e.k === 'close') {
        const col = e.pond ? COLORS.stream.light : COLORS[e.terrain].light;
        e.cells.forEach((ck, i) => this.glow.set(ck, { t: this.time + i * 0.05, color: col }));
        const [q, r] = e.cells[0].split(',').map(Number);
        const label = e.pond ? `A pond! +${e.pts}` : `${e.terrain === 'woods' ? 'Woods' : e.terrain === 'hill' ? 'Burrow-hill' : 'Meadow'} finished +${e.pts}`;
        this.addPop({ text: label, x: hexX(q, r), y: hexY(r) - 1.1, age: -0.25, color: e.pond ? '#bff0ff' : '#e8ffd0', big: e.pond || e.pts >= 40 });
        for (const ck of e.cells) { const [cq, cr] = ck.split(',').map(Number); for (let i = 0; i < 3; i++) this.parts.push({ x: hexX(cq, cr) + (hash(cq * 7 + i) - 0.5), y: hexY(cr) + (hash(cr * 5 + i) - 0.5), vx: (hash(i + cq) - 0.5) * 0.8, vy: -0.8, life: 0, max: 1.1, size: 0.1, color: e.pond ? '#d8f6ff' : e.terrain === 'meadow' ? '#ffd84a' : e.terrain === 'woods' ? '#9ad86a' : '#fff0c8', kind: e.terrain === 'woods' ? 'leaf' : e.pond ? 'drop' : 'spark', g: 0.3 }); }
        if (e.pond) { this.walkTo(hexX(q, r) + 0.2, hexY(r) + 0.2, true); this.cheer(1.2); }
      } else if (e.k === 'wish') {
        if (e.state === 'done') { this.addPop({ text: `${EMOJI[e.animal]} Wish granted! +${e.pts}`, x: hexX(e.q, e.r), y: hexY(e.r) - 1.6, age: -0.15, color: '#d8ffc8', big: true }); this.cheer(1.6); this.glow.set(key(e.q, e.r), { t: this.time, color: '#c8ffb0' }); }
        else if (e.state === 'failed') this.addPop({ text: `${EMOJI[e.animal]} Oh dear…`, x: hexX(e.q, e.r), y: hexY(e.r) - 1.4, age: 0, color: '#e8e0f0', big: false });
      } else if (e.k === 'bonus') {
        const ch = this.chins[0]; if (ch) this.addPop({ text: `+${e.n} tile${e.n > 1 ? 's' : ''}`, x: ch.tx, y: ch.ty - 2.2, age: -0.4, color: '#ffe9b0', big: false });
      } else if (e.k === 'grow') {
        const w = g.wishes.find((v) => v.id === e.id); if (w) this.addPop({ text: `${EMOJI[w.animal]} +${e.n}`, x: hexX(w.q, w.r), y: hexY(w.r) - 1.4, age: 0, color: '#d8ffc8', big: false });
      } else if (e.k === 'undo') { this.tiles.clear(); this.drops.clear(); if (g.last) this.walkTo(hexX(g.last[0], g.last[1]), hexY(g.last[1])); }
      else if (e.k === 'end') this.cheer(3);
    }
  }
  /** A floating word, nudged up above any still rising near the same spot so they never overprint. */
  private addPop(p: Pop) {
    const near = this.pops.filter((o) => o.age < 1 && Math.abs(o.x - p.x) < 2.6 && Math.abs(o.y - o.age * 0.7 - p.y) < 0.9).length;
    p.y -= near * 0.62; this.pops.push(p);
  }
  /** Sends the pair to stand by a spot (Enzo a beat behind Dora). */
  private walkTo(x: number, y: number, sitBy = false) {
    this.chins.forEach((ch, i) => { ch.tx = x + (i ? 0.62 : -0.42); ch.ty = y + (sitBy ? 0.55 : 0.5) + (i ? 0.08 : 0); ch.delay = i ? 0.22 : 0; });
  }
  private cheer(t: number) { this.chins.forEach((ch, i) => { ch.cheer = Math.max(ch.cheer, t + i * 0.1); }); }

  // ---------------------------------------------------------------- drawing
  private tileCanvas(cellKey: string, e: Terrain[], seed: number, oak: boolean) {
    const sig = e.join('') + (oak ? 'o' : '');
    const got = this.tiles.get(cellKey); if (got && got.sig === sig) return got.cv;
    const R = this.TEX, cv = mk(SQ3 * R + 8, R * 2.9), c = ctx2(cv);
    c.translate(cv.width / 2, R * 1.55); paintTile(c, e, R, seed, { oak });
    this.tiles.set(cellKey, { cv, sig });
    return cv;
  }
  private ghostCanvas(e: Terrain[], seed: number) {
    const sig = e.join('') + seed; const got = this.ghostCache.get(sig); if (got) return got;
    const R = this.TEX, cv = mk(SQ3 * R + 8, R * 2.9), c = ctx2(cv);
    c.translate(cv.width / 2, R * 1.55); paintTile(c, e, R, seed);
    if (this.ghostCache.size > 24) this.ghostCache.clear();
    this.ghostCache.set(sig, cv); return cv;
  }
  private groundTex() {
    if (this.ground) return this.ground;
    const S = 512, cv = mk(S, S), c = ctx2(cv);
    c.fillStyle = '#b8ab84'; c.fillRect(0, 0, S, S);
    for (let i = 0; i < 70; i++) { const x = hash(i) * S, y = hash(i + 99) * S, r = 20 + hash(i + 7) * 60; c.fillStyle = i % 3 ? 'rgba(150,135,95,0.18)' : 'rgba(205,195,160,0.22)'; for (const [ox, oy] of [[0, 0], [S, 0], [-S, 0], [0, S], [0, -S]]) { c.beginPath(); c.ellipse(x + ox, y + oy, r, r * 0.6, hash(i + 3), 0, TAU); c.fill(); } }
    c.strokeStyle = 'rgba(120,110,70,0.35)'; c.lineWidth = 1.4;
    for (let i = 0; i < 160; i++) { const x = hash(i + 400) * S, y = hash(i + 800) * S; c.beginPath(); c.moveTo(x, y); c.lineTo(x - 2, y - 6); c.moveTo(x, y); c.lineTo(x + 3, y - 5); c.stroke(); }
    c.fillStyle = 'rgba(140,170,90,0.35)'; for (let i = 0; i < 40; i++) { c.beginPath(); c.arc(hash(i + 1200) * S, hash(i + 1300) * S, 2 + hash(i) * 2, 0, TAU); c.fill(); }
    this.ground = cv; return cv;
  }

  draw(g: MeadowGame | null, o: DrawOpts) {
    const c = this.c, dt = o.dt; this.time += dt; this.game = g;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    // camera
    if (g && this.time >= this.manualUntil && this.manualUntil > 0) this.frame();
    const e = ease(5, dt || 0.016); this.k = lerp(this.k, this.tk, e); this.cx = lerp(this.cx, this.tx, e); this.cy = lerp(this.cy, this.ty, e);
    // the bare valley floor
    const gt = this.groundTex(), gs = clamp(this.k / 50, 0.4, 2.5) * 0.9, pat = c.createPattern(gt, 'repeat');
    if (pat) { const ox = (-this.cx * this.k + this.W / 2) % (512 * gs), oy = (-this.cy * this.k + this.H / 2) % (512 * gs); pat.setTransform?.(new DOMMatrix([gs, 0, 0, gs, ox, oy])); c.fillStyle = pat; } else c.fillStyle = '#b8ab84';
    c.fillRect(0, 0, this.W, this.H);
    if (!g) return;
    const k = this.k, R = k, T = this.time;
    const [vx0, vy0] = [this.cx - this.W / 2 / k - 2, this.cy - this.H / 2 / k - 2], [vx1, vy1] = [this.cx + this.W / 2 / k + 2, this.cy + this.H / 2 / k + 3];
    const vis = (x: number, y: number) => x > vx0 && x < vx1 && y > vy0 && y < vy1;
    // the valley's edge, where there is one
    if (g.def.radius) {
      c.save(); c.fillStyle = 'rgba(90,110,60,0.25)';
      for (let q = -g.def.radius - 2; q <= g.def.radius + 2; q++) for (let r = -g.def.radius - 2; r <= g.def.radius + 2; r++) {
        const d = (Math.abs(q) + Math.abs(r) + Math.abs(q + r)) / 2; if (d !== g.def.radius + 1) continue;
        const [sx, sy] = this.cellToScreen(q, r); hexPath(c, sx, sy, R * 0.98); c.fill();
        c.save(); c.translate(sx, sy); mound(c, -R * 0.2, R * 0.1, R * 1.4, 0.2); mound(c, R * 0.3, R * 0.3, R * 1.1, 0.1); c.restore();
      }
      c.restore();
    }
    // the cells a tile can go
    const frontier = g.frontier();
    if (o.showFrontier) {
      c.save(); c.setLineDash([R * 0.12, R * 0.1]); c.lineWidth = Math.max(1, R * 0.04);
      for (const [q, r] of frontier) { const [sx, sy] = this.cellToScreen(q, r); hexPath(c, sx, sy, R * 0.9); c.fillStyle = 'rgba(255,250,230,0.12)'; c.fill(); c.strokeStyle = 'rgba(255,250,230,0.55)'; c.stroke(); }
      c.restore();
      if (o.hints) for (const [q, r] of o.spots) { const [sx, sy] = this.cellToScreen(q, r); hexPath(c, sx, sy, R * 0.86); c.fillStyle = `rgba(255,220,90,${0.22 + Math.sin(T * 3) * 0.1})`; c.fill(); this.twinkle(sx, sy - R * 0.1, R, T); }
      if (o.guide) { const [sx, sy] = this.cellToScreen(o.guide[0], o.guide[1]); c.save(); hexPath(c, sx, sy, R * (0.9 + Math.sin(T * 4) * 0.04)); c.strokeStyle = '#ffd84a'; c.lineWidth = Math.max(2, R * 0.09); c.setLineDash([]); c.stroke(); c.restore(); }
    }
    // the tiles, top row first so each tile's earthy edge tucks under the row in front
    const cells = [...g.cells.values()].sort((a, b) => a.r - b.r || a.q - b.q);
    const ponds = new Set<string>(); for (const rg of g.regions) if (rg.pond) for (const ck of rg.cells) ponds.add(ck);
    for (const cell of cells) {
      const x = hexX(cell.q, cell.r), y = hexY(cell.r); if (!vis(x, y)) continue;
      const ck = key(cell.q, cell.r); let [sx, sy] = this.toScreen(x, y);
      if (cell.kind === 'rock') { c.save(); c.translate(sx, sy); rock(c, R, cell.q * 13 + cell.r * 7); c.restore(); continue; }
      const t0 = this.drops.get(ck); let sc = 1;
      if (t0 !== undefined) { const u = clamp((T - t0) / 0.42, 0, 1); sy -= (1 - backOut(u)) * R * 0.9; sc = lerp(1.08, 1, u); if (u >= 1) { this.drops.delete(ck); this.puff(x, y); } }
      const cv = this.tileCanvas(ck, cell.e, strHash(ck) + cell.tile, cell.kind === 'oak'), s = (R / this.TEX) * sc;
      c.drawImage(cv, sx - (cv.width / 2) * s, sy - this.TEX * 1.55 * s, cv.width * s, cv.height * s);
      if (ponds.has(ck)) this.pondOver(sx, sy, R, cell.e, T);
      else if (cell.e.includes('stream') && R > 14) this.flow(sx, sy, R, cell.e, T);
      const gl = this.glow.get(ck);
      if (gl) { const u = (T - gl.t) / 1.2; if (u > 1) this.glow.delete(ck); else if (u > 0) { c.save(); hexPath(c, sx, sy, R * (0.98 + u * 0.08)); c.globalAlpha = (1 - u) * 0.6; c.fillStyle = gl.color; c.fill(); c.globalAlpha = 1 - u; c.strokeStyle = '#fff'; c.lineWidth = R * 0.06; c.stroke(); c.restore(); } }
      if (cell.perfect && R > 16) { c.fillStyle = 'rgba(255,215,80,0.9)'; this.star(sx, sy - R * 0.78, R * 0.1); }
    }
    // critters in the finished patches
    this.critters(g, T);
    // wish flags
    for (const w of g.wishes) {
      if (w.state === 'failed' && g.turn - w.ended > 3) continue;
      const [mx, my] = edgeMid(w.side, 1, 0.45), [sx, sy] = this.toScreen(hexX(w.q, w.r) + mx, hexY(w.r) + my);
      const s = clamp(R * 0.42, 13, 30);
      flag(c, sx, sy, s, w.animal, w.state === 'open' ? `${w.now}/${w.size}${w.kind === 'exact' ? '' : '+'}` : w.state === 'done' ? '✓' : '✗', w.state, w.size ? w.now / w.size : 0);
    }
    // the ghost tile, the pair, then the ghost's label over everything
    this.pill = null;
    if (o.ghost && g.current) this.ghost(g, o.ghost, T);
    this.drawChins(dt, o.ghost);
    this.drawPill();
    // sparkles and pops
    this.drawParts(dt);
    this.drawPops(dt);
  }
  private twinkle(x: number, y: number, R: number, T: number) { const c = this.c; for (let i = 0; i < 3; i++) { const a = T * 2 + i * 2.1, s = R * (0.06 + 0.04 * Math.sin(T * 5 + i)); c.fillStyle = 'rgba(255,250,200,0.9)'; this.star(x + Math.cos(a) * R * 0.4, y + Math.sin(a) * R * 0.3, s); } }
  private star(x: number, y: number, s: number) { const c = this.c; c.beginPath(); for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU - Math.PI / 2, r = i % 2 ? s * 0.4 : s; c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } c.closePath(); c.fill(); }
  /** Moving glints along a stream, so the water flows. */
  private flow(sx: number, sy: number, R: number, e: Terrain[], T: number) {
    const c = this.c, st = e.map((t, i) => (t === 'stream' ? i : -1)).filter((i) => i >= 0);
    c.save(); c.strokeStyle = 'rgba(235,252,255,0.75)'; c.lineWidth = Math.max(1, R * 0.045); c.lineCap = 'round';
    c.setLineDash([R * 0.08, R * 0.22]); c.lineDashOffset = -T * R * 0.5;
    c.beginPath();
    if (st.length === 2) { const a = edgeMid(st[0], R, 1), b = edgeMid(st[1], R, 1); c.moveTo(sx + a[0], sy + a[1]); c.quadraticCurveTo(sx, sy, sx + b[0], sy + b[1]); }
    else for (const i of st) { const m = edgeMid(i, R, 1); c.moveTo(sx, sy); c.quadraticCurveTo(sx + m[0] * 0.35, sy + m[1] * 0.35, sx + m[0], sy + m[1]); }
    c.stroke(); c.restore();
  }
  /** A pond: the stream widens into still water with lily pads. */
  private pondOver(sx: number, sy: number, R: number, e: Terrain[], T: number) {
    const c = this.c; void e;
    c.save(); c.translate(sx, sy);
    c.fillStyle = COLORS.stream.dark; c.beginPath(); c.ellipse(0, 0, R * 0.52, R * 0.42, 0, 0, TAU); c.fill();
    c.fillStyle = COLORS.stream.base; c.beginPath(); c.ellipse(0, 0, R * 0.47, R * 0.37, 0, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(230,250,255,0.5)'; c.lineWidth = Math.max(1, R * 0.025);
    const u = (T * 0.4) % 1; c.beginPath(); c.ellipse(R * 0.1, -R * 0.05, R * 0.3 * u, R * 0.2 * u, 0, 0, TAU); c.globalAlpha = 1 - u; c.stroke(); c.globalAlpha = 1;
    c.fillStyle = '#5aa04a'; for (const [dx, dy] of [[-0.25, 0.12], [0.22, -0.16]]) { c.beginPath(); c.arc(R * dx, R * dy, R * 0.08, 0.3, TAU - 0.3); c.lineTo(R * dx, R * dy); c.fill(); }
    c.fillStyle = '#ffb0d0'; c.beginPath(); c.arc(-R * 0.25, R * 0.1, R * 0.03, 0, TAU); c.fill();
    c.restore();
  }
  private puff(x: number, y: number) { for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; this.parts.push({ x: x + Math.cos(a) * 0.8, y: y + Math.sin(a) * 0.6 + 0.3, vx: Math.cos(a) * 0.6, vy: Math.sin(a) * 0.3 - 0.2, life: 0, max: 0.5, size: 0.16, color: 'rgba(240,225,190,0.7)', kind: 'puff', g: 0 }); } }
  private critters(g: MeadowGame, T: number) {
    const c = this.c, R = this.k; if (R < 14) return;
    g.regions.forEach((rg, n) => {
      const pick = rg.cells[Math.floor(hash(n * 7.3) * rg.cells.length)]; if (!pick) return;
      const [q, r] = pick.split(',').map(Number), [sx, sy] = this.cellToScreen(q, r);
      if (sx < -R * 2 || sy < -R * 2 || sx > this.W + R * 2 || sy > this.H + R * 2) return;
      const ph = T + n * 1.7;
      if (rg.pond) {
        // a mother duck and her ducklings paddling round
        for (let i = 0; i < 4; i++) {
          const a = ph * 0.6 - i * 0.45, x = sx + Math.cos(a) * R * 0.3, y = sy + Math.sin(a) * R * 0.22, s = R * (i ? 0.06 : 0.1), f = -Math.sin(a) > 0 ? 1 : -1;
          c.fillStyle = i ? '#ffe04a' : '#f4f0e4'; c.beginPath(); c.ellipse(x, y, s * 1.3, s * 0.9, 0, 0, TAU); c.fill();
          c.beginPath(); c.arc(x + f * s * 0.9, y - s * 0.8, s * 0.6, 0, TAU); c.fill();
          c.fillStyle = '#f08a2a'; c.beginPath(); c.moveTo(x + f * s * 1.4, y - s * 0.85); c.lineTo(x + f * s * 1.9, y - s * 0.7); c.lineTo(x + f * s * 1.4, y - s * 0.6); c.fill();
          if (!i) { c.fillStyle = '#2a7a4a'; c.beginPath(); c.arc(x + f * s * 0.9, y - s * 0.9, s * 0.45, Math.PI, TAU); c.fill(); }
        }
      } else if (rg.terrain === 'meadow') {
        // bees and a butterfly
        for (let i = 0; i < 3; i++) {
          const a = ph * (1.6 + i * 0.3) + i * 2, x = sx + Math.cos(a) * R * 0.45, y = sy - R * 0.25 + Math.sin(a * 1.3) * R * 0.25, s = R * 0.05;
          if (i < 2) { c.fillStyle = 'rgba(255,255,255,0.8)'; c.beginPath(); c.ellipse(x, y - s, s * 0.9, s * 0.5, Math.sin(T * 30) * 0.5, 0, TAU); c.fill(); c.fillStyle = '#ffcc2a'; c.beginPath(); c.ellipse(x, y, s * 1.1, s * 0.75, 0, 0, TAU); c.fill(); c.fillStyle = '#3a2a10'; c.fillRect(x - s * 0.2, y - s * 0.7, s * 0.3, s * 1.4); }
          else { const fl = Math.abs(Math.sin(T * 8)); c.fillStyle = '#ff8ac8'; c.beginPath(); c.ellipse(x - s * 0.8 * fl, y, s * 1.1 * fl + 0.5, s * 1.3, 0, 0, TAU); c.ellipse(x + s * 0.8 * fl, y, s * 1.1 * fl + 0.5, s * 1.3, 0, 0, TAU); c.fill(); }
        }
      } else if (rg.terrain === 'woods') {
        // a hedgehog snuffling about, and a bird overhead
        const wx = sx + Math.sin(ph * 0.5) * R * 0.3, wy = sy + R * 0.3, s = R * 0.09, f = Math.cos(ph * 0.5) > 0 ? 1 : -1;
        c.fillStyle = '#6b4a2e'; c.beginPath(); c.ellipse(wx, wy, s * 1.3, s * 0.85, 0, Math.PI, TAU); c.fill();
        c.strokeStyle = '#4a3020'; c.lineWidth = Math.max(1, s * 0.15); for (let i = 0; i < 6; i++) { const a = Math.PI + (i + 0.5) * (Math.PI / 6); c.beginPath(); c.moveTo(wx + Math.cos(a) * s, wy + Math.sin(a) * s * 0.7); c.lineTo(wx + Math.cos(a) * s * 1.5, wy + Math.sin(a) * s * 1.1); c.stroke(); }
        c.fillStyle = '#e8d0b0'; c.beginPath(); c.ellipse(wx + f * s * 1.2, wy - s * 0.2, s * 0.5, s * 0.35, 0, 0, TAU); c.fill();
        c.fillStyle = '#222'; c.beginPath(); c.arc(wx + f * s * 1.6, wy - s * 0.2, s * 0.12, 0, TAU); c.fill();
        const bx = sx + Math.cos(ph * 0.7) * R * 0.7, by = sy - R * 0.9 + Math.sin(ph) * R * 0.1, w = R * 0.08 * (0.6 + Math.abs(Math.sin(T * 9)) * 0.4);
        c.strokeStyle = '#3a3a4a'; c.lineWidth = Math.max(1, R * 0.025); c.beginPath(); c.moveTo(bx - w, by - w * 0.5); c.quadraticCurveTo(bx - w * 0.4, by - w, bx, by); c.quadraticCurveTo(bx + w * 0.4, by - w, bx + w, by - w * 0.5); c.stroke();
      } else if (rg.terrain === 'hill') {
        // a rabbit that pops up from its burrow now and then
        const up = Math.max(0, Math.sin(ph * 0.9)), x = sx + R * 0.15, y = sy + R * 0.1 - up * R * 0.12, s = R * 0.08;
        if (up > 0.05) {
          c.fillStyle = '#a89070'; c.beginPath(); c.ellipse(x, y, s, s * 0.9 * up + 0.5, 0, 0, TAU); c.fill();
          c.beginPath(); c.ellipse(x - s * 0.3, y - s * 1.3 * up, s * 0.22, s * 0.6 * up + 0.5, -0.2, 0, TAU); c.ellipse(x + s * 0.3, y - s * 1.3 * up, s * 0.22, s * 0.6 * up + 0.5, 0.2, 0, TAU); c.fill();
          c.fillStyle = '#222'; c.beginPath(); c.arc(x + s * 0.35, y - s * 0.2, s * 0.12, 0, TAU); c.fill();
        }
      }
    });
  }
  private ghost(g: MeadowGame, gh: NonNullable<Ghost>, T: number) {
    const c = this.c, R = this.k, tile = g.current!;
    const gk = `${gh.q},${gh.r},${tile.id}`;
    const target = gh.rot * (Math.PI / 3);
    if (gk !== this.ghostKey) { this.ghostKey = gk; this.ghostAng = target; }
    // turn the short way round
    let d = target - this.ghostAng; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU;
    this.ghostAng += d * ease(16, 0.016);
    const spin = this.ghostAng - target;
    const e = rotate(parseEdges(tile.e), gh.rot), [sx, sy0] = this.cellToScreen(gh.q, gh.r);
    const lift = R * (0.1 + Math.sin(T * 3) * 0.03), sy = sy0 - lift;
    const cv = this.ghostCanvas(e, tile.id + 3), s = R / this.TEX;
    c.save();
    hexPath(c, sx, sy0, R * 0.96); c.fillStyle = 'rgba(40,30,10,0.25)'; c.fill();
    c.globalAlpha = gh.a.legal ? 0.92 : 0.45;
    c.translate(sx, sy); c.rotate(spin);
    c.drawImage(cv, -(cv.width / 2) * s, -this.TEX * 1.55 * s, cv.width * s, cv.height * s);
    c.restore();
    if (tile.wish) { const [mx, my] = edgeMid((tile.wish.edge + gh.rot) % 6, R, 0.45); flag(c, sx + mx, sy + my, clamp(R * 0.42, 13, 30), ANIMAL_OF[tile.wish.terrain], `${tile.wish.kind === 'exact' ? '=' : ''}${tile.wish.size}${tile.wish.kind === 'atleast' ? '+' : ''}`, 'open', 0); }
    if (!gh.a.legal) return;
    // a tick or a cross on every edge that touches a tile
    if (Math.abs(spin) < 0.2) gh.a.edges.forEach((m, i) => {
      if (m !== 'match' && m !== 'miss') return;
      const [mx, my] = edgeMid(i, R, 0.74), x = sx + mx, y = sy + my, s2 = clamp(R * 0.15, 6, 13);
      c.fillStyle = m === 'match' ? '#3aa04a' : '#d8443a'; c.strokeStyle = '#fff'; c.lineWidth = Math.max(1.5, s2 * 0.22);
      c.beginPath(); c.arc(x, y, s2, 0, TAU); c.fill(); c.stroke();
      c.beginPath(); if (m === 'match') { c.moveTo(x - s2 * 0.45, y); c.lineTo(x - s2 * 0.1, y + s2 * 0.4); c.lineTo(x + s2 * 0.5, y - s2 * 0.4); } else { c.moveTo(x - s2 * 0.4, y - s2 * 0.4); c.lineTo(x + s2 * 0.4, y + s2 * 0.4); c.moveTo(x + s2 * 0.4, y - s2 * 0.4); c.lineTo(x - s2 * 0.4, y + s2 * 0.4); } c.stroke();
    });
    // what it would score
    const bits: string[] = [`+${gh.a.pts}`];
    if (gh.a.perfects.length) bits.push(gh.a.perfects.length > 1 ? `★ ${gh.a.perfects.length} Perfects` : '★ Perfect');
    if (gh.a.tiles) bits.push(`+${gh.a.tiles} tile${gh.a.tiles > 1 ? 's' : ''}`);
    for (const w of gh.a.wishes) if (w.fresh && w.state !== 'open') { const wish = g.wishes.find((v) => v.id === w.id); const an = wish ? wish.animal : tile.wish ? ANIMAL_OF[tile.wish.terrain] : 'bee'; bits.push(`${EMOJI[an]} ${w.state === 'done' ? '✓' : '✗'}`); }
    for (const cl of gh.a.closes) if (cl.pond) bits.push('a pond!');
    this.pill = { text: bits.join('  '), x: sx, y: sy - R * 1.32, gold: gh.a.perfects.length > 0, };
  }
  private pill: { text: string; x: number; y: number; gold: boolean } | null = null;
  private drawPill() {
    const p = this.pill, c = this.c; if (!p) return;
    const fs = clamp(this.k * 0.3, 12, 17);
    c.font = `900 ${fs}px ui-rounded,system-ui,sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    const w = c.measureText(p.text).width + fs * 1.2, x = clamp(p.x, w / 2 + 4, this.W - this.inset.right - w / 2 - 4), y = Math.max(fs + 4, p.y);
    c.fillStyle = p.gold ? 'rgba(120,80,0,0.9)' : 'rgba(30,50,30,0.85)';
    c.beginPath(); c.roundRect(x - w / 2, y - fs * 0.85, w, fs * 1.7, fs * 0.85); c.fill();
    c.fillStyle = p.gold ? '#ffe46a' : '#fff'; c.fillText(p.text, x, y + 1);
  }
  /** The characters' height on screen: tied to the zoom, but never too small to read. */
  chinHeight() { const small = Math.min(this.W, this.H); return clamp(this.k * 1.15, Math.min(100, small * 0.14), Math.max(90, Math.min(140, small * 0.2))); }
  private drawChins(dt: number, gh: Ghost) {
    const c = this.c, H = this.chinHeight();
    const ghostAt = gh ? this.cellToScreen(gh.q, gh.r) : null;
    // draw the one further back first
    const order = [...this.chins].sort((a, b) => a.y - b.y);
    for (const ch of order) {
      if (ch.delay > 0) ch.delay -= dt;
      else {
        const dx = ch.tx - ch.x, dy = ch.ty - ch.y, d = Math.hypot(dx, dy);
        ch.moving = d > 0.05;
        if (ch.moving) { const sp = Math.min(d, (2.6 + d * 0.8) * dt); ch.x += (dx / d) * sp; ch.y += (dy / d) * sp; ch.hop += dt * 9; if (Math.abs(dx) > 0.02) ch.face = dx > 0 ? 1 : -1; }
        else { ch.hop = 0; ch.face = ch.who === 'dora' ? 1 : -1; }
      }
      if (ch.cheer > 0) ch.cheer -= dt;
      const pose: Pose = ch.moving ? 'walk' : ch.cheer > 0 ? 'cheer' : 'sit';
      const [sx, sy0] = this.toScreen(ch.x, ch.y);
      const hopY = ch.moving ? Math.abs(Math.sin(ch.hop)) * H * 0.12 : pose === 'cheer' ? Math.abs(Math.sin(this.time * 7)) * H * 0.08 : 0, sy = sy0 - hopY;
      const art = this.pose(ch.who, pose);
      const scale = H / SPRITE_ENZO;
      let w: number, h: number;
      if (art) { h = art.naturalHeight * scale * (SPRITE_H / art.naturalHeight); w = art.naturalWidth * (h / art.naturalHeight); }
      else { h = H * 1.3; w = h * 1.5; }
      // see-through when the ghost tile is right underneath
      let alpha = 1;
      if (ghostAt && Math.abs(ghostAt[0] - sx) < Math.max(w * 0.25, this.k) && ghostAt[1] < sy0 + this.k * 0.3 && ghostAt[1] > sy0 - H * 1.1) alpha = 0.35;
      c.save(); c.globalAlpha = alpha;
      c.fillStyle = 'rgba(30,25,10,0.28)'; c.beginPath(); c.ellipse(sx, sy0, H * (ch.who === 'enzo' ? 0.36 : 0.3), H * 0.08, 0, 0, TAU); c.fill();
      if (art) { c.translate(sx, sy); c.scale(ch.face, 1); c.drawImage(art, -w / 2, -h + h * (SPRITE_FOOT / SPRITE_H), w, h); }
      else drawChinchilla(c, ch.who, sx, sy, { face: ch.face, h: H * (ch.who === 'dora' ? 0.8 : 0.95), time: this.time, run: ch.hop * 2, moving: ch.moving, air: pose === 'cheer' && hopY > 2 });
      c.restore();
      const fig = H * (ch.who === 'dora' ? 320 / 360 : 1);
      ch.box = { x: sx - fig * 0.45, y: sy - fig, w: fig * 0.9, h: fig };
    }
  }
  private drawParts(dt: number) {
    const c = this.c, k = this.k;
    this.parts = this.parts.filter((p) => (p.life += dt) < p.max);
    for (const p of this.parts) {
      p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      const [sx, sy] = this.toScreen(p.x, p.y), a = 1 - p.life / p.max, s = Math.max(1.5, p.size * k);
      c.globalAlpha = a; c.fillStyle = p.color;
      if (p.kind === 'star' || p.kind === 'spark') this.star(sx, sy, s * (p.kind === 'star' ? 1 : 0.8));
      else if (p.kind === 'leaf') { c.beginPath(); c.ellipse(sx, sy, s, s * 0.5, p.life * 4, 0, TAU); c.fill(); }
      else { c.beginPath(); c.arc(sx, sy, s * (p.kind === 'puff' ? 1 + p.life * 2 : 0.7), 0, TAU); c.fill(); }
    }
    c.globalAlpha = 1;
  }
  private drawPops(dt: number) {
    const c = this.c;
    this.pops = this.pops.filter((p) => (p.age += dt) < 1.6);
    for (const p of this.pops) {
      if (p.age < 0) continue;
      const [sx, sy] = this.toScreen(p.x, p.y - p.age * 0.7), a = p.age < 1.1 ? 1 : 1 - (p.age - 1.1) / 0.5;
      const fs = (p.big ? 24 : 17) * (p.age < 0.15 ? 0.6 + p.age / 0.15 * 0.4 : 1);
      c.globalAlpha = Math.max(0, a); c.font = `900 ${fs}px ui-rounded,system-ui,sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.lineWidth = 4; c.strokeStyle = 'rgba(30,40,20,0.85)'; c.strokeText(p.text, sx, sy); c.fillStyle = p.color; c.fillText(p.text, sx, sy);
    }
    c.globalAlpha = 1;
  }
  /** For the browser tests: the zoom and where the characters are drawn (CSS pixels). */
  metrics() { return { settled: Math.abs(this.k - this.tk) < 0.05 && Math.hypot(this.cx - this.tx, this.cy - this.ty) < 0.005, k: this.k, chinH: this.chinHeight(), chins: this.chins.map((ch) => ({ who: ch.who, ...ch.box })), W: this.W, H: this.H, painted: !!this.pose('dora', 'sit') && !!this.pose('enzo', 'sit') }; }
}

// ---------------------------------------------------------------- stand-ins for the paintings, and the valley cards
/** A little valley drawn from tiles, used for the cards and as the stand-in for the paintings. */
function miniValley(cv: HTMLCanvasElement, cells: { q: number; r: number; e: Terrain[]; kind?: 'tile' | 'rock' | 'oak' }[], R: number, ox: number, oy: number) {
  const c = ctx2(cv);
  for (const cell of [...cells].sort((a, b) => a.r - b.r || a.q - b.q)) {
    c.save(); c.translate(ox + hexX(cell.q, cell.r) * R, oy + hexY(cell.r) * R);
    if (cell.kind === 'rock') rock(c, R, cell.q * 13 + cell.r * 7); else paintTile(c, cell.e, R, strHash(`${cell.q},${cell.r}`), { oak: cell.kind === 'oak' });
    c.restore();
  }
}
const sky = (c: CanvasRenderingContext2D, W: number, H: number, top: string, bot: string) => { const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, top); g.addColorStop(1, bot); c.fillStyle = g; c.fillRect(0, 0, W, H); };
const SAMPLE = ['MMMMMM', 'MMMWWW', 'WWWWWW', 'MSMMSM', 'HHHMMM', 'MMSMMS', 'WWMMMM', 'HHHHHH', 'MMMMHH', 'SMMMMM', 'WWWWMM', 'MMWWWM'];
const patch = (n: number, rad: number) => { const out: { q: number; r: number; e: Terrain[] }[] = []; let i = 0; for (let q = -rad; q <= rad; q++) for (let r = -rad; r <= rad; r++) if ((Math.abs(q) + Math.abs(r) + Math.abs(q + r)) / 2 <= rad && hash(q * 11 + r * 7 + n) > 0.2) out.push({ q, r, e: parseEdges(SAMPLE[i++ % SAMPLE.length]) }); return out; };
export function paintTitle(cv: HTMLCanvasElement, t = 0.4) {
  const c = ctx2(cv), W = cv.width, H = cv.height;
  sky(c, W, H, '#9ad4ff', '#e8f4d0');
  c.fillStyle = '#b8ab84'; c.fillRect(0, H * 0.45, W, H);
  miniValley(cv, patch(3, 3), H * 0.075, W * 0.5, H * 0.55);
  drawChinchilla(c, 'dora', W * 0.38, H * 0.92, { face: 1, h: H * 0.2, time: t });
  drawChinchilla(c, 'enzo', W * 0.6, H * 0.92, { face: -1, h: H * 0.24, time: t });
}
export function paintEnding(cv: HTMLCanvasElement, t = 0.4) {
  const c = ctx2(cv), W = cv.width, H = cv.height;
  sky(c, W, H, '#ff9a6a', '#ffe0a0');
  c.fillStyle = '#7cb146'; c.fillRect(0, H * 0.5, W, H);
  miniValley(cv, patch(5, 4), H * 0.065, W * 0.5, H * 0.62);
  c.fillStyle = COLORS.stream.base; c.beginPath(); c.ellipse(W * 0.5, H * 0.86, W * 0.18, H * 0.06, 0, 0, TAU); c.fill();
  drawChinchilla(c, 'dora', W * 0.42, H * 0.82, { face: 1, h: H * 0.16, time: t });
  drawChinchilla(c, 'enzo', W * 0.58, H * 0.82, { face: -1, h: H * 0.19, time: t });
}
/** A valley card: the valley's starting tiles and rocks, framed. */
export function paintValley(cv: HTMLCanvasElement, def: ValleyDef) {
  const c = ctx2(cv), W = cv.width, H = cv.height;
  sky(c, W, H, '#c4b994', '#a99c78');
  const cells: { q: number; r: number; e: Terrain[]; kind?: 'tile' | 'rock' | 'oak' }[] = def.start.map((s) => ({ q: s.q, r: s.r, e: parseEdges(s.e), kind: s.kind ?? 'tile' }));
  for (const [q, r] of def.rocks) cells.push({ q, r, e: [], kind: 'rock' });
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const s of cells) { x0 = Math.min(x0, hexX(s.q, s.r) - 1); x1 = Math.max(x1, hexX(s.q, s.r) + 1); y0 = Math.min(y0, hexY(s.r) - 1); y1 = Math.max(y1, hexY(s.r) + 1); }
  x0 -= SQ3 * 0.9; x1 += SQ3 * 0.9; y0 -= 1.4; y1 += 1.4;
  if (def.radius) { const d = def.radius + 0.5; x0 = Math.min(x0, -d * SQ3); x1 = Math.max(x1, d * SQ3); y0 = Math.min(y0, -d * 1.5); y1 = Math.max(y1, d * 1.5); }
  const R = Math.min(W / (x1 - x0 + 1), H / (y1 - y0 + 1.2), H * 0.22);
  if (def.radius) {
    c.save(); c.translate(W / 2, H / 2); c.strokeStyle = 'rgba(120,90,50,0.6)'; c.lineWidth = 3; c.setLineDash([6, 5]);
    c.beginPath(); for (let j = 0; j <= 6; j++) { const a = (-90 + 60 * j + 30) * (Math.PI / 180), rr = (def.radius + 0.6) * R * SQ3; if (j) c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); else c.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); } c.stroke(); c.restore();
  }
  const ox = W / 2 - ((x0 + x1) / 2) * R, oy = H / 2 - ((y0 + y1) / 2) * R, taken = new Set(cells.map((s) => `${s.q},${s.r}`));
  // the cells a first tile could go, dashed, so a one-tile start still reads as a valley
  c.save(); c.setLineDash([R * 0.14, R * 0.12]); c.lineWidth = Math.max(1, R * 0.05); c.strokeStyle = 'rgba(255,250,230,0.6)';
  for (const s of cells) if (s.kind !== 'rock') for (const [dq, dr] of DIRS) {
    const q = s.q + dq, r = s.r + dr, k = `${q},${r}`; if (taken.has(k)) continue; taken.add(k);
    if (def.radius && (Math.abs(q) + Math.abs(r) + Math.abs(q + r)) / 2 > def.radius) continue;
    hexPath(c, ox + hexX(q, r) * R, oy + hexY(r) * R, R * 0.9); c.stroke();
  }
  c.restore();
  miniValley(cv, cells, R, ox, oy);
}
/** For the tests: does the edge on side i of (q, r) face side opp(i) of its neighbour? */
export const facing = (q: number, r: number, i: number): [number, number, number] => [q + DIRS[i][0], r + DIRS[i][1], opp(i)];
