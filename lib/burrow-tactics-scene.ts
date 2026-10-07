// Canvas 2D drawing for Burrow Tactics: an isometric meadow on a slab of earth, in the arcade's clean-line style.
// The engine resolves a whole action or predator turn at once and hands back a list of events; the Stage here keeps
// its own picture of the board and plays those events one after another (walks, shots, pushes, knock-outs), so what
// is on screen always lags the engine until the queue is empty. Chinchillas are the shared drawChinchilla.
import { Battle, SIZE, DIRS, CLOUD_TURNS, FIRE_TURNS, type Unit, type Ev, type Tile, type HeroId, type PredId, type Feature, type Forecast, type Mark, type Terrain } from './burrow-tactics-game';
import { COATS, coatLike, drawChinchilla, type Coat } from './chinchilla-art';
import { predator, shade, tintOf } from './predator-art';

export const VIEW_W = 760, VIEW_H = 520;
const TW = 44, TH = 22, OX = VIEW_W / 2, OY = 124, DEPTH = 26, RISE = 9, INK = '#2c2430';
type C2D = CanvasRenderingContext2D;
/** The middle of a tile on the canvas. */
export const tileCenter = (x: number, y: number): [number, number] => [OX + (x - y) * TW, OY + (x + y) * TH];
/** The tile under a point on the canvas, or null. */
export function tileAt(px: number, py: number): Tile | null {
  const a = (px - OX) / TW, b = (py - OY) / TH, x = Math.round((a + b) / 2), y = Math.round((b - a) / 2);
  return x >= 0 && y >= 0 && x < SIZE && y < SIZE ? [x, y] : null;
}
const idx = (x: number, y: number) => y * SIZE + x;
const hash = (n: number) => { const s = Math.sin(n * 127.1 + 11.7) * 43758.5453; return s - Math.floor(s); };
const ell = (c: C2D, x: number, y: number, rx: number, ry: number, rot = 0) => { c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2); };
const poly = (c: C2D, pts: number[]) => { c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.closePath(); };
const ink = (c: C2D, fill: string | CanvasGradient, line = INK, w = 1.3) => { c.lineJoin = 'round'; c.strokeStyle = line; c.lineWidth = w; c.stroke(); c.fillStyle = fill; c.fill(); };
const diamond = (c: C2D, x: number, y: number, k = 1) => poly(c, [x, y - TH * k, x + TW * k, y, x, y + TH * k, x - TW * k, y]);

// ---------- Regions ----------

type Palette = { sky: string[]; far: string; near: string; snow: boolean; grass: string[]; edge: string; soil: string[]; water: string[]; blade: string; dots: string[]; haze: string };
const REGION: Palette[] = [
  { sky: ['#8fc9ee', '#d9eef6', '#f6ecd0'], far: '#93a9cc', near: '#7fb48c', snow: true, grass: ['#93d06c', '#89c763'], edge: '#5f9a48', soil: ['#9a7150', '#7a563c'], water: ['#62b8ea', '#3f8fc8'], blade: '#62a646', dots: ['#ffffff', '#ffd84a', '#ff9ac0'], haze: 'rgba(255,255,255,0.3)' },
  { sky: ['#f0a868', '#fbd49a', '#fdeccb'], far: '#b78a7c', near: '#c79c5c', snow: false, grass: ['#d2c468', '#c8b95d'], edge: '#978a3d', soil: ['#a37049', '#7f5436'], water: ['#62acc9', '#4288ae'], blade: '#a0943f', dots: ['#e8703a', '#fff3c0', '#b4552a'], haze: 'rgba(255,236,200,0.3)' },
  { sky: ['#343a70', '#7a68a6', '#e7a7a0'], far: '#4d4c80', near: '#6c6ca0', snow: true, grass: ['#adc6cc', '#a1bac1'], edge: '#6f8f98', soil: ['#6c5c69', '#514452'], water: ['#5584c6', '#3b63a2'], blade: '#7ea0a9', dots: ['#ffffff', '#e2f2ff', '#ffffff'], haze: 'rgba(210,200,240,0.25)' },
];

// ---------- Creatures ----------

const black = { eye: '#16121a', pupil: '#000000', earGlow: false, eyeR: 1.75 };
const COAT: Record<HeroId, Coat> = {
  dora: COATS.dora, enzo: COATS.enzo,
  pip: coatLike('dora', { ...black, fur: '#eeeaf0', back: '#dad3df', face: '#f6f3f8', shade: '#ccc4d2', texture: '#d8d0dc', tail: '#ebe6ee', tailInner: '#cfc6d6' }),
  pebble: coatLike('enzo', { fur: '#a9a7b0', back: '#8a8891', face: '#c4c2ca', shade: '#96949d', texture: '#8f8d96', tail: '#b0aeb7', tailOuter: '#8c8a94', tailInner: '#d2d0d8', bands: false }),
  mochi: coatLike('dora', { ...black, fur: '#ecd6b3', back: '#d8bc90', face: '#f4e4cb', shade: '#caa97e', texture: '#cfb48b', tail: '#e9d2ad', tailInner: '#d0b58c' }),
  kit: coatLike('dora', { ...black, eyeR: 2 }),
  biscuit: coatLike('enzo', { fur: '#9a6a48', back: '#74492e', face: '#b58560', shade: '#80553a', texture: '#6e442b', belly: '#f1dfc8', ear: '#8a5c40', earIn: '#c79a86', tail: '#96684a', tailOuter: '#6f462d', tailInner: '#b98b68', tailLine: '#3a2418', line: '#2e1c14' }),
};
const SIZE_OF: Record<HeroId, number> = { dora: 40, enzo: 41, pip: 33, pebble: 45, mochi: 39, biscuit: 39, kit: 26 };
const SCARF: Record<HeroId, string> = { dora: '#ffcf3e', enzo: '#e5483b', pip: '#58c06a', pebble: '#c9a23f', mochi: '#ff8fb3', biscuit: '#4a8fe8', kit: '#ffffff' };
/** A scarf for everyone, plus Grandpa Pebble's straw hat and Pip's dust goggles. */
const dress = (kind: HeroId) => (c: C2D, bob: number) => {
  poly(c, [1.2, -11.5 + bob, 5.6, -7.6 + bob, 4.4, -5.6 + bob, 0.2, -9.2 + bob]); ink(c, SCARF[kind], INK, 0.8);
  poly(c, [0.6, -9.6 + bob, -3.4, -8.4 + bob, -2.4, -6.4 + bob, 1.2, -8 + bob]); ink(c, SCARF[kind], INK, 0.8);
  if (kind === 'pebble') { ell(c, 6.6, -18.6 + bob, 7.4, 1.9, -0.08); ink(c, '#e8cf7a', '#6b5320', 0.9); c.beginPath(); c.ellipse(6.4, -19 + bob, 4, 3.4, -0.08, Math.PI, 0); c.closePath(); ink(c, '#f0dc94', '#6b5320', 0.9); }
  if (kind === 'pip') { c.strokeStyle = '#3a3340'; c.lineWidth = 1.1; c.beginPath(); c.moveTo(2.6, -15.4 + bob); c.lineTo(10.4, -16.6 + bob); c.stroke(); ell(c, 8.4, -16.8 + bob, 2.1, 1.7); ink(c, '#aee6ff', '#3a3340', 0.8); }
};
// Predators are the shared art in predator-art.ts.
const PRED_H: Record<PredId, number> = { fox: 37, snake: 34, owl: 38, weasel: 34, badger: 40, hawk: 40, cougar: 54, mole: 30, skunk: 38, bear: 58 };
const FLY_LIFT = 17;
function drawPredator(c: C2D, kind: PredId, alpha: boolean, x: number, y: number, face: number, t: number, scale = 1) {
  const h = PRED_H[kind] * scale;
  c.save(); c.translate(x, y); c.scale((face * h) / 24, h / 24); c.lineJoin = 'round';
  predator(c, kind, tintOf(kind, alpha), t);
  c.restore();
}
/** A chinchilla portrait for the squad panel. */
export function drawHeroIcon(c: C2D, kind: HeroId, w: number, h: number) {
  c.clearRect(0, 0, w, h);
  drawChinchilla(c, COAT[kind], w * 0.6, h * 0.94, { face: 1, h: h * 0.6 * (SIZE_OF[kind] / 41), time: 0.4, decorate: dress(kind) });
}
export function drawPredIcon(c: C2D, kind: PredId, w: number, h: number, alpha = false) {
  c.clearRect(0, 0, w, h);
  const fly = kind === 'owl' || kind === 'hawk', k = (h * (kind === 'owl' ? 0.8 : 0.58)) / PRED_H[kind];
  drawPredator(c, kind, alpha, w * (kind === 'owl' ? 0.5 : kind === 'skunk' ? 0.64 : 0.54), h * (fly ? 1.02 : 0.9), 1, 0.6, k);
}

// ---------- The stage ----------

export type Sprite = {
  id: number; side: 'hero' | 'pred'; kind: HeroId | PredId; alpha: boolean; fly: boolean;
  x: number; y: number; hp: number; maxHp: number; face: 1 | -1;
  /** Height off the tile, pixel offsets for a lunge, a hit flash, how far through fading out, and growing in. */
  z: number; ox: number; oy: number; flash: number; fade: number; pop: number; gone: boolean; moving: boolean; run: number;
};
type Anim = { dur: number; t: number; begun: boolean; start?: () => void; tick?: (k: number) => void; end?: () => void };
type Float = { x: number; y: number; text: string; color: string; life: number };
type Dot = { x: number; y: number; vx: number; vy: number; life: number; max: number; r: number; color: string };
type Shot = { from: [number, number]; to: [number, number]; arc: number; kind: 'seed' | 'spit' | 'dust' | 'bale' | 'rope'; k: number };
/** What the page wants shown on top of the board. */
export type Overlay = {
  selected: number; moves: Tile[]; targets: Tile[]; aim: Tile | null; hover: Tile | null; cursor: Tile | null;
  /** The battle after the action being aimed, to show its result before it is confirmed. */
  preview: Battle | null; forecast: Forecast | null;
  /** Starting tiles while the squad is being placed. */
  zone?: Tile[];
  /** A suggestion to point at: who, where to move, what to aim at, and where to move afterwards. */
  hint?: { id: number; move: Tile | null; target: Tile | null; then: Tile | null } | null;
  /** A tile the guided first mission wants clicked. */
  point?: Tile | null;
};
export const NO_OVERLAY: Overlay = { selected: 0, moves: [], targets: [], aim: null, hover: null, cursor: null, preview: null, forecast: null };

export class Stage {
  sprites = new Map<number, Sprite>();
  feature: (Feature | null)[] = []; cloud: number[] = []; fire: number[] = []; terrain: Terrain[] = []; marks: Mark[] = [];
  warren = 0; turn = 1;
  queue: Anim[] = []; floats: Float[] = []; dots: Dot[] = []; shot: Shot | null = null;
  flash: Tile[] = []; banner = { text: '', t: 0 }; shake = 0; speed = 1;
  /** Called with a cue name as things happen, for the page's sounds. */
  sfx: (name: string) => void = () => {};
  private bg: HTMLCanvasElement | null = null; private bgKey = '';

  constructor(b: Battle) { this.sync(b); }
  get busy() { return this.queue.length > 0; }
  /** Makes the picture match the battle exactly, at once. */
  sync(b: Battle) {
    this.feature = [...b.feature]; this.cloud = [...b.cloud]; this.fire = [...b.fire]; this.terrain = b.terrain; this.marks = b.marks.map((m) => ({ ...m })); this.warren = b.warren; this.turn = b.turn;
    const keep = new Map(this.sprites);
    this.sprites.clear();
    for (const u of b.units) if (u.hp > 0) this.sprites.set(u.id, { ...this.fresh(u), face: keep.get(u.id)?.face ?? (u.side === 'hero' ? 1 : -1) });
    for (const u of b.preds) this.aimFace(b, u);
    this.shot = null; this.flash = [];
  }
  private fresh(u: Unit): Sprite {
    return { id: u.id, side: u.side, kind: u.kind, alpha: u.alpha, fly: u.fly, x: u.x, y: u.y, hp: u.hp, maxHp: u.maxHp, face: u.side === 'hero' ? 1 : -1, z: 0, ox: 0, oy: 0, flash: 0, fade: 0, pop: 1, gone: false, moving: false, run: 0 };
  }
  private aimFace(b: Battle, u: Unit) { const s = this.sprites.get(u.id); if (s && u.dir >= 0 && u.kind !== 'cougar') s.face = DIRS[u.dir][0] - DIRS[u.dir][1] >= 0 ? 1 : -1; }
  private faceTo(s: Sprite, x: number, y: number) { const d = x - s.x - (y - s.y); if (Math.abs(d) > 0.01) s.face = d > 0 ? 1 : -1; }
  /** The middle of a tile as drawn: high ground stands a little proud of the rest. */
  private center(x: number, y: number): [number, number] { const [px, py] = tileCenter(x, y); return [px, py - (this.terrain[idx(Math.round(x), Math.round(y))] === 'hill' ? RISE : 0)]; }
  private at(s: Sprite): [number, number] { const [x, y] = this.center(s.x, s.y); return [x + s.ox, y + s.oy]; }
  private puff(x: number, y: number, color: string, n: number, spread = 1) {
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = (20 + Math.random() * 50) * spread; this.dots.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.5 - 30, life: 0, max: 0.35 + Math.random() * 0.35, r: 2 + Math.random() * 4, color }); }
  }
  private say(x: number, y: number, text: string, color: string) { this.floats.push({ x, y, text, color, life: 0 }); }

  /** Queues the engine's events to be played in order, then settles on the battle as it now stands. */
  feed(events: Ev[], b: Battle) {
    for (const e of events) { const a = this.anim(e, b); if (a) this.queue.push({ t: 0, begun: false, ...a }); }
    this.queue.push({ dur: 0, t: 0, begun: false, end: () => this.sync(b) });
  }
  private anim(e: Ev, b: Battle): Omit<Anim, 't' | 'begun'> | null {
    const sp = (id: number) => this.sprites.get(id);
    switch (e.t) {
      case 'move': {
        const s = sp(e.id), n = e.path.length - 1;
        if (!s || n < 1) return null;
        return { dur: 0.085 * n + 0.03, start: () => { s.moving = true; this.sfx('step'); }, tick: (k) => {
          const f = Math.min(n - 1e-6, k * n), i = Math.floor(f), u = f - i, [ax, ay] = e.path[i], [bx, by] = e.path[i + 1];
          s.x = ax + (bx - ax) * u; s.y = ay + (by - ay) * u; s.run += 0.9; s.z = s.fly ? 0 : Math.sin(u * Math.PI) * 5;
          const d = bx - ax - (by - ay); if (d) s.face = d > 0 ? 1 : -1;
        }, end: () => { [s.x, s.y] = e.path[n]; s.moving = false; s.z = 0; } };
      }
      case 'act': {
        const s = sp(e.id);
        if (!s) return null;
        const from = this.center(s.x, s.y), to = this.center(e.x, e.y), far = Math.hypot(e.x - s.x, e.y - s.y), lift = (p: [number, number]): [number, number] => [p[0], p[1] - 18];
        const face = () => this.faceTo(s, e.x, e.y);
        if (e.ability === 'groom') return { dur: 0.3, start: () => { this.sfx('heal'); this.puff(from[0], from[1] - 16, '#f1e3c0', 10, 0.6); } };
        if (e.ability === 'pounce') return { dur: 0.04, start: () => { face(); this.sfx('leap'); } };
        if (e.ability === 'slam') return { dur: 0.24, start: () => { this.sfx('whack'); }, tick: (k) => { s.z = Math.sin(k * Math.PI) * 12; }, end: () => { s.z = 0; this.shake = 7; this.puff(from[0], from[1], '#e6d6ae', 18, 1.3); } };
        if (e.ability === 'swap') return { dur: 0.05, start: () => { face(); this.sfx('leap'); this.puff(from[0], from[1] - 14, '#cfe9ff', 10); } };
        if (e.ability === 'brace') return { dur: 0.26, start: () => { face(); this.sfx('thud'); this.say(to[0], to[1] - 46, 'Braced', '#ffe38a'); this.puff(to[0], to[1] - 10, '#f0cf6a', 10, 0.8); } };
        if (e.ability === 'lull') return { dur: 0.3, start: () => { face(); this.sfx('heal'); this.puff(from[0], from[1] - 22, '#d9c8ff', 8, 0.6); } };
        if (e.ability === 'whack' || e.ability === 'kick') return { dur: 0.2, start: () => { face(); this.sfx('whack'); }, tick: (k) => { const m = Math.sin(k * Math.PI) * 0.42; s.ox = (to[0] - from[0]) * m; s.oy = (to[1] - from[1]) * m; }, end: () => { s.ox = s.oy = 0; } };
        const kind = e.ability === 'seed' || e.ability === 'pierce' ? 'seed' : e.ability === 'puff' ? 'dust' : e.ability === 'toss' ? 'bale' : 'rope';
        const arc = kind === 'dust' || kind === 'bale' ? 46 : 0;
        return { dur: 0.1 + far * (arc ? 0.06 : 0.035), start: () => { face(); this.sfx(kind === 'seed' ? 'shoot' : 'throw'); this.shot = { from: lift(from), to: arc ? to : lift(to), arc, kind, k: 0 }; }, tick: (k) => { if (this.shot) this.shot.k = k; }, end: () => { this.shot = null; } };
      }
      case 'attack': {
        const s = sp(e.id);
        if (!s) return null;
        const last = e.tiles[e.tiles.length - 1], from = this.center(s.x, s.y);
        const start = () => { this.flash = e.tiles; if (last) this.faceTo(s, last[0], last[1]); this.sfx(e.kind === 'snake' ? 'spit' : 'bite'); };
        if (!last) return { dur: 0.25, start, end: () => { this.flash = []; } };
        const to = this.center(last[0], last[1]);
        if (e.kind === 'owl' || e.kind === 'bear') return { dur: 0.12, start, end: () => { this.flash = []; } };
        if (e.kind === 'snake') return { dur: 0.12 + e.tiles.length * 0.04, start: () => { start(); this.shot = { from: [from[0], from[1] - 20], to: [to[0], to[1] - 16], arc: 0, kind: 'spit', k: 0 }; }, tick: (k) => { if (this.shot) this.shot.k = k; }, end: () => { this.shot = null; this.flash = []; } };
        const reach = e.kind === 'hawk' ? 1 : e.kind === 'cougar' ? 0 : 0.45, first = this.center(e.tiles[0][0], e.tiles[0][1]), aim = e.kind === 'hawk' ? to : first;
        return { dur: e.kind === 'hawk' ? 0.42 : 0.26, start, tick: (k) => {
          const m = Math.sin(k * Math.PI) * reach; s.ox = (aim[0] - from[0]) * m; s.oy = (aim[1] - from[1]) * m;
          if (e.kind === 'cougar') s.z = Math.sin(k * Math.PI) * 10; if (e.kind === 'hawk') s.z = -Math.sin(k * Math.PI) * FLY_LIFT;
        }, end: () => { s.ox = s.oy = s.z = 0; this.flash = []; } };
      }
      case 'hit': return { dur: 0.16, start: () => {
        const [x, y] = this.center(e.x, e.y), s = e.id ? sp(e.id) : undefined;
        if (e.saved) { this.say(x, y - 44, e.what === 'burrow' ? 'Door held' : 'Thick fur', '#ffe38a'); this.sfx('block'); return; }
        if (s) { s.hp = Math.max(0, s.hp - e.dmg); s.flash = 0.28; this.say(x, y - 50, `-${e.dmg}`, s.side === 'hero' ? '#ff6b5a' : '#ffffff'); this.puff(x, y - 18, s.side === 'hero' ? '#ffb0a0' : '#fff2c0', 6, 0.7); if (e.dmg >= 2) this.shake = 5; this.sfx('hit'); }
        else if (e.what === 'bale') { this.feature[idx(e.x, e.y)] = null; this.puff(x, y - 10, '#f0cf6a', 14); this.sfx('break'); }
        else if (e.what === 'burrow') { this.feature[idx(e.x, e.y)] = 'rubble'; this.warren = Math.max(0, this.warren - 1); this.puff(x, y - 8, '#b08a62', 22, 1.3); this.say(x, y - 46, 'Burrow lost', '#ff6b5a'); this.shake = 9; this.sfx('collapse'); }
        else if (e.what === 'rock') this.puff(x, y - 12, '#c9c6d2', 5, 0.6);
      } };
      case 'push': {
        const s = sp(e.id);
        if (!s) return null;
        const far = Math.hypot(e.to[0] - e.from[0], e.to[1] - e.from[1]);
        return { dur: e.leap ? 0.2 + far * 0.05 : 0.15, start: () => { if (e.leap) this.faceTo(s, e.to[0], e.to[1]); this.sfx(e.leap ? 'whoosh' : 'push'); }, tick: (k) => {
          const u = e.leap ? k : 1 - (1 - k) * (1 - k); s.x = e.from[0] + (e.to[0] - e.from[0]) * u; s.y = e.from[1] + (e.to[1] - e.from[1]) * u; s.z = e.leap && !s.fly ? Math.sin(k * Math.PI) * 26 : 0;
        }, end: () => { [s.x, s.y] = e.to; s.z = 0; if (e.leap && !s.fly) { const [x, y] = this.center(s.x, s.y); this.puff(x, y, '#e6d6ae', 10); this.shake = 4; } } };
      }
      case 'bump': {
        const s = sp(e.id);
        if (!s) return null;
        const from = this.center(s.x, s.y), to = this.center(e.x, e.y);
        return { dur: 0.14, start: () => this.sfx('bump'), tick: (k) => { const m = Math.sin(k * Math.PI) * 0.3; s.ox = (to[0] - from[0]) * m; s.oy = (to[1] - from[1]) * m; }, end: () => { s.ox = s.oy = 0; this.puff((from[0] + to[0]) / 2, (from[1] + to[1]) / 2 - 14, '#ffffff', 5, 0.5); } };
      }
      case 'ko': {
        const s = sp(e.id);
        if (!s) return null;
        return { dur: 0.34, start: () => { const [x, y] = this.at(s); s.hp = 0; if (e.how === 'drown') { this.puff(x, y - 4, '#bfe6ff', 20, 1.1); this.say(x, y - 40, 'Splash!', '#bfe6ff'); this.sfx('splash'); } else { this.puff(x, y - 16, '#f1e3c0', 14); this.sfx(s.side === 'hero' ? 'down' : 'ko'); } }, tick: (k) => { s.fade = k; if (e.how === 'drown') s.z = -k * 14; }, end: () => { s.gone = true; } };
      }
      case 'cloud': return { dur: 0.2, start: () => { this.cloud[idx(e.x, e.y)] = CLOUD_TURNS; const [x, y] = this.center(e.x, e.y); this.puff(x, y - 12, '#e9d9b4', 18, 1.2); this.sfx('poof'); } };
      case 'bale': return { dur: 0.12, start: () => { this.feature[idx(e.x, e.y)] = 'bale'; const [x, y] = this.center(e.x, e.y); this.puff(x, y, '#f0cf6a', 8, 0.8); this.sfx('thud'); } };
      case 'heal': { const s = sp(e.id); return s ? { dur: 0.22, start: () => { s.hp = Math.min(s.maxHp, s.hp + 1); const [x, y] = this.at(s); this.say(x, y - 50, '+1', '#8ff08a'); } } : null; }
      case 'soak': { const s = sp(e.id); return s ? { dur: 0.16, start: () => { const [x, y] = this.at(s); this.puff(x, y - 4, '#bfe6ff', 12); this.say(x, y - 50, 'Soaked', '#bfe6ff'); this.sfx('splash'); } } : null; }
      case 'mark': return { dur: 0.14, start: () => { this.marks.push({ x: e.x, y: e.y, kind: 'fox', alpha: false }); this.sfx('rustle'); } };
      case 'emerge': return { dur: 0.3, start: () => { this.marks = this.marks.filter((m) => m.x !== e.unit.x || m.y !== e.unit.y); const s = { ...this.fresh(e.unit), pop: 0 }; this.sprites.set(s.id, s); const [x, y] = this.center(s.x, s.y); this.puff(x, y - 6, '#b08a62', 14); this.sfx('emerge'); }, tick: (k) => { const s = sp(e.unit.id); if (s) s.pop = k; } };
      case 'blocked': return { dur: 0.2, start: () => { const [x, y] = this.center(e.x, e.y); this.say(x, y - 56, 'Blocked!', '#ffe38a'); this.sfx('block'); } };
      case 'intent': return { dur: 0.05, start: () => { const u = b.unit(e.id); if (u) this.aimFace(b, u); } };
      case 'fizzle': { const s = sp(e.id); return s ? { dur: 0.32, start: () => { const [x, y] = this.at(s); this.say(x, y - 50, 'Cough!', '#e9d9b4'); this.sfx('poof'); } } : null; }
      case 'phase': return { dur: e.who === 'pred' ? 0.7 : 0.55, start: () => { this.banner = { text: e.who === 'pred' ? 'Predators’ turn' : `Turn ${e.turn}`, t: 0 }; this.turn = e.turn; if (e.who === 'player') { this.cloud = [...b.cloud]; this.marks = b.marks.map((m) => ({ ...m })); } this.sfx(e.who === 'pred' ? 'growl' : 'turn'); } };
      case 'fire': return { dur: 0.12, start: () => { this.fire[idx(e.x, e.y)] = e.on ? FIRE_TURNS : 0; const [x, y] = this.center(e.x, e.y); this.puff(x, y - 8, e.on ? '#ffb347' : '#8a8490', e.on ? 12 : 8, 0.8); if (e.on) this.sfx('poof'); } };
      case 'guard': { const s = sp(e.id); return s ? { dur: 0.22, start: () => { const [x, y] = this.at(s); this.faceTo(s, e.x, e.y); this.say(x, y - 62, 'Stood guard', '#ffe38a'); this.sfx('block'); } } : null; }
      case 'brace': return { dur: 0.05 };
      case 'lull': { const s = sp(e.id); return s ? { dur: 0.3, start: () => { const [x, y] = this.at(s); this.say(x, y - 50, 'Zzz', '#d9c8ff'); } } : null; }
      case 'place': return { dur: 0, end: () => this.sync(b) };
      case 'reset': return { dur: 0, end: () => this.sync(b) };
      case 'end': return { dur: 0.2 };
    }
  }
  /** Skips to the end of everything queued. */
  flush() { for (const a of this.queue) { if (!a.begun) a.start?.(); a.tick?.(1); a.end?.(); } this.queue = []; this.shot = null; this.flash = []; }
  update(dt: number) {
    let left = dt * this.speed;
    while (this.queue.length) {
      const a = this.queue[0];
      if (!a.begun) { a.begun = true; a.start?.(); }
      const need = a.dur - a.t;
      if (left < need) { a.t += left; a.tick?.(a.t / a.dur); break; }
      left -= Math.max(0, need); a.tick?.(1); a.end?.(); this.queue.shift();
    }
    for (const f of this.floats) { f.life += dt; f.y -= dt * 26; }
    this.floats = this.floats.filter((f) => f.life < 1.1);
    for (const d of this.dots) { d.life += dt; d.x += d.vx * dt; d.y += d.vy * dt; d.vy += 90 * dt; }
    this.dots = this.dots.filter((d) => d.life < d.max);
    for (const s of this.sprites.values()) s.flash = Math.max(0, s.flash - dt);
    this.shake = Math.max(0, this.shake - dt * 30); this.banner.t += dt;
  }
  /**
   * The tile a click should count for. A creature's body counts as its tile, even where it overlaps the tile behind;
   * but when `prefer` lists the tiles that would do something (moves or targets), one of those wins, so a tile
   * half hidden behind a hovering owl can still be clicked.
   */
  pick(px: number, py: number, prefer: Tile[] = []): Tile | null {
    const list = [...this.sprites.values()].filter((s) => !s.gone).sort((a, b) => b.x + b.y - (a.x + a.y)), raw = tileAt(px, py);
    const wanted = (t: Tile | null) => !!t && prefer.some((p) => p[0] === t[0] && p[1] === t[1]);
    let body: Tile | null = null;
    for (const s of list) { const [x, y] = this.center(s.x, s.y), lift = s.fly ? FLY_LIFT : 0; if (Math.abs(px - x) < 15 && py < y + 6 - lift && py > y - 40 - lift) { body = [Math.round(s.x), Math.round(s.y)]; break; } }
    if (wanted(body)) return body;
    if (wanted(raw)) return raw;
    return body ?? raw;
  }

  // ----- Drawing -----
  private backdrop(b: Battle) {
    const key = `${b.region}|${b.terrain.join('')}`;
    if (this.bg && this.bgKey === key) return this.bg;
    const k = 2, cv = document.createElement('canvas'); cv.width = VIEW_W * k; cv.height = VIEW_H * k;
    const c = cv.getContext('2d')!, p = REGION[b.region] ?? REGION[0];
    c.scale(k, k);
    const sky = c.createLinearGradient(0, 0, 0, VIEW_H); sky.addColorStop(0, p.sky[0]); sky.addColorStop(0.5, p.sky[1]); sky.addColorStop(1, p.sky[2]);
    c.fillStyle = sky; c.fillRect(0, 0, VIEW_W, VIEW_H);
    // The sun, or over the high pass a moon and stars, and a few clouds lit from above.
    const night = b.region === 2, sx = VIEW_W * 0.8, sy = 54;
    if (night) for (let i = 0; i < 70; i++) { c.fillStyle = `rgba(255,255,255,${0.25 + hash(i * 3) * 0.6})`; ell(c, hash(i + 11) * VIEW_W, hash(i + 47) * 150, 0.5 + hash(i + 90) * 0.8, 0.5 + hash(i + 90) * 0.8); c.fill(); }
    for (const [r, a] of [[150, 0.22], [70, 0.3], [36, 0.45]]) { const g = c.createRadialGradient(sx, sy, 0, sx, sy, r); g.addColorStop(0, `rgba(255,246,214,${a})`); g.addColorStop(1, 'rgba(255,246,214,0)'); c.fillStyle = g; c.fillRect(sx - r, sy - r, r * 2, r * 2); }
    c.fillStyle = night ? '#f3efff' : '#fffbe8'; ell(c, sx, sy, 20, 20); c.fill();
    if (night) { c.fillStyle = 'rgba(160,160,200,0.4)'; for (const [dx, dy, r] of [[-6, -4, 4.4], [6, 5, 3], [3, -9, 2]]) { ell(c, sx + dx, sy + dy, r, r); c.fill(); } }
    for (let i = 0; i < 4; i++) {
      const x = 70 + i * 210 + hash(i + b.region * 5) * 90, y = 40 + hash(i * 7 + b.region) * 60, k = 0.7 + hash(i + 3) * 0.5;
      for (const [fill, dy] of [[night ? 'rgba(60,60,110,0.35)' : 'rgba(120,140,190,0.25)', 3], [night ? 'rgba(200,196,236,0.5)' : 'rgba(255,255,255,0.85)', 0]] as const) {
        c.fillStyle = fill; c.beginPath(); for (const [dx, r] of [[-24, 8], [-9, 13], [8, 16], [25, 10], [38, 6]]) c.arc(x + dx * k, y + dy - r * k * 0.45, r * k, 0, 7); c.rect(x - 32 * k, y + dy - 5 * k, 76 * k, 5 * k); c.fill();
      }
    }
    // Two ranges of the Andes, each peak with a lit face, then nearer hills with pines, then haze so the board stands clear of them.
    const range = (base: number, amp: number, seed: number, fill: string, snow: boolean) => {
      const pts: number[] = [0, VIEW_H, 0, base];
      for (let x = 0; x <= VIEW_W; x += 38) pts.push(x, base - amp * (0.35 + hash(seed + x) * 0.65) * (0.6 + 0.4 * Math.sin(x * 0.011 + seed)));
      pts.push(VIEW_W, VIEW_H);
      const body = c.createLinearGradient(0, base - amp, 0, base + 40); body.addColorStop(0, shade(fill, 1.06)); body.addColorStop(1, shade(fill, 0.92));
      c.fillStyle = body; poly(c, pts); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.16)';
      for (let i = 6; i < pts.length - 4; i += 2) { const [x0, y0, x1, y1, x2, y2] = [pts[i - 2], pts[i - 1], pts[i], pts[i + 1], pts[i + 2], pts[i + 3]]; if (y1 < y0 && y1 < y2) { poly(c, [x1, y1, x2, y2, x1 + (x2 - x1) * 0.3, y2 + (y2 - y1) * 0.5]); c.fill(); } }
      if (snow) { c.fillStyle = 'rgba(255,255,255,0.75)'; for (let i = 4; i < pts.length - 4; i += 2) { const y = pts[i + 1]; if (y < base - amp * 0.62) { poly(c, [pts[i] - 13, y + 15, pts[i], y, pts[i] + 13, y + 15, pts[i] + 5, y + 11, pts[i], y + 17, pts[i] - 6, y + 11]); c.fill(); } } }
    };
    range(190, 130, 3 + b.region, p.far, p.snow); range(238, 70, 9 + b.region, p.near, false);
    const roll = (x: number) => 286 + 16 * Math.sin(x * 0.012 + b.region * 2) + 9 * Math.sin(x * 0.031 + b.region), hillCol = shade(p.near, 0.86);
    c.fillStyle = hillCol; c.beginPath(); c.moveTo(0, VIEW_H); for (let x = 0; x <= VIEW_W; x += 10) c.lineTo(x, roll(x)); c.lineTo(VIEW_W, VIEW_H); c.fill();
    for (let i = 0; i < 46; i++) {
      const x = hash(i * 3 + b.region * 13) * VIEW_W, y = roll(x) + 3 + hash(i) * 12, k = 0.7 + hash(i + 5) * 0.7;
      if (b.region === 1) { c.fillStyle = shade(p.near, 0.7); ell(c, x, y - 2 * k, 7 * k, 3.4 * k); c.fill(); c.fillStyle = 'rgba(255,240,210,0.25)'; ell(c, x - 1.5 * k, y - 3 * k, 4 * k, 1.6 * k); c.fill(); continue; }
      for (const [dy, r] of [[0, 5], [-5, 4], [-9.4, 2.8]]) { c.fillStyle = shade(p.near, 0.62); poly(c, [x - r * k, y + dy * k, x, y + (dy - r * 1.5) * k, x + r * k, y + dy * k]); c.fill(); c.fillStyle = b.region === 2 ? 'rgba(236,244,255,0.5)' : 'rgba(255,255,255,0.14)'; poly(c, [x - r * k, y + dy * k, x, y + (dy - r * 1.5) * k, x - r * 0.1 * k, y + dy * k]); c.fill(); }
    }
    const haze = c.createLinearGradient(0, 150, 0, VIEW_H); haze.addColorStop(0, 'rgba(255,255,255,0)'); haze.addColorStop(0.35, p.haze); haze.addColorStop(1, p.haze);
    c.fillStyle = haze; c.fillRect(0, 150, VIEW_W, VIEW_H);
    // The slab of earth, with strata.
    const L = [OX - SIZE * TW, OY + (SIZE - 1) * TH], B = [OX, OY + (2 * SIZE - 1) * TH], R = [OX + SIZE * TW, OY + (SIZE - 1) * TH];
    c.fillStyle = 'rgba(30,20,40,0.22)'; ell(c, OX, B[1] + DEPTH + 10, SIZE * TW * 0.92, 24); c.fill();
    const face = (pts: number[], col: string) => { const g = c.createLinearGradient(0, B[1] - SIZE * TH, 0, B[1] + DEPTH); g.addColorStop(0, shade(col, 1.12)); g.addColorStop(1, shade(col, 0.72)); poly(c, pts); ink(c, g, INK, 1.6); };
    face([L[0], L[1], B[0], B[1], B[0], B[1] + DEPTH, L[0], L[1] + DEPTH], p.soil[0]);
    face([B[0], B[1], R[0], R[1], R[0], R[1] + DEPTH, B[0], B[1] + DEPTH], p.soil[1]);
    c.strokeStyle = 'rgba(40,24,20,0.28)'; c.lineWidth = 1;
    for (const d of [9, 17]) { c.beginPath(); c.moveTo(L[0], L[1] + d); c.lineTo(B[0], B[1] + d); c.lineTo(R[0], R[1] + d); c.stroke(); }
    // Stones in the earth, and turf hanging over the edge.
    for (let i = 0; i < 26; i++) {
      const t = hash(i * 5 + 2), left = i % 2 === 0, x = left ? L[0] + (B[0] - L[0]) * t : B[0] + (R[0] - B[0]) * t, top = left ? L[1] + (B[1] - L[1]) * t : B[1] + (R[1] - B[1]) * t, y = top + 6 + hash(i + 9) * (DEPTH - 10), r = 1.6 + hash(i + 4) * 2.6;
      c.fillStyle = 'rgba(30,18,16,0.3)'; ell(c, x + 0.6, y + 0.8, r, r * 0.7); c.fill(); c.fillStyle = shade(p.soil[left ? 0 : 1], 1.3); ell(c, x, y, r, r * 0.7); c.fill();
    }
    c.fillStyle = p.edge;
    for (let i = 0; i <= 44; i++) { const t = i / 44, left = i % 2 === 0, x = left ? L[0] + (B[0] - L[0]) * t : B[0] + (R[0] - B[0]) * t, y = left ? L[1] + (B[1] - L[1]) * t : B[1] + (R[1] - B[1]) * t, h = 3 + hash(i * 3 + 1) * 4; poly(c, [x - 5, y - 0.5, x + 5, y - 0.5, x + 2.5, y + h, x, y + h * 0.5, x - 2.5, y + h]); c.fill(); }
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      const [px, base] = tileCenter(x, y), i = idx(x, y), n = hash(i * 7 + b.region), hill = b.terrain[i] === 'hill', py = base - (hill ? RISE : 0);
      if (hill) { poly(c, [px - TW, py, px, py + TH, px, base + TH, px - TW, base]); ink(c, p.soil[0], INK, 1); poly(c, [px, py + TH, px + TW, py, px + TW, base, px, base + TH]); ink(c, p.soil[1], INK, 1); }
      diamond(c, px, py);
      if (b.terrain[i] === 'ice') {
        ink(c, '#d9f1fb', '#8fbfd8', 1); diamond(c, px, py, 0.84); c.fillStyle = '#eefaff'; c.fill();
        c.strokeStyle = 'rgba(255,255,255,0.95)'; c.lineWidth = 1.6; c.lineCap = 'round'; c.beginPath(); c.moveTo(px - 16 + n * 8, py + 2); c.lineTo(px - 4 + n * 8, py - 5); c.moveTo(px + 4, py + 6); c.lineTo(px + 14, py); c.stroke();
        c.strokeStyle = 'rgba(120,170,200,0.55)'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(px - 8, py + 8 - n * 6); c.lineTo(px + 2, py + 3); c.lineTo(px + 6 + n * 8, py + 8); c.stroke();
        continue;
      }
      if (b.terrain[i] === 'water') {
        ink(c, p.water[1], shade(p.water[1], 0.7), 1); diamond(c, px, py + 2, 0.86); const wg = c.createLinearGradient(px - TW, py - TH, px + TW, py + TH); wg.addColorStop(0, shade(p.water[0], 1.12)); wg.addColorStop(1, p.water[1]); c.fillStyle = wg; c.fill();
        c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = 1.2; c.lineCap = 'round'; c.beginPath(); c.moveTo(px - 12 + n * 8, py - 1); c.quadraticCurveTo(px - 7 + n * 8, py - 3.4, px - 2 + n * 8, py - 1); c.moveTo(px + 4, py + 5 - n * 3); c.quadraticCurveTo(px + 8, py + 3 - n * 3, px + 12, py + 5 - n * 3); c.stroke();
        continue;
      }
      ink(c, hill ? shade(p.grass[(x + y) % 2], 1.08) : p.grass[(x + y) % 2], p.edge, 1);
      // A few blades, flowers or pebbles, the same every time for the same tile.
      c.strokeStyle = p.blade; c.lineWidth = 1.1; c.lineCap = 'round';
      for (let j = 0; j < 6; j++) { const bx = px + (hash(i * 3 + j) - 0.5) * 46, by = py + (hash(i * 5 + j) - 0.5) * 16; if (Math.abs(bx - px) / TW + Math.abs(by - py) / TH > 0.8) continue; c.strokeStyle = j % 3 ? p.blade : shade(p.grass[0], 1.18); c.beginPath(); c.moveTo(bx, by); c.lineTo(bx - 1.5, by - 4); c.moveTo(bx + 2, by); c.lineTo(bx + 3, by - 3.5); c.moveTo(bx + 1, by); c.lineTo(bx + 0.8, by - 5); c.stroke(); }
      if (n > 0.55) { c.fillStyle = p.dots[Math.floor(n * 97) % p.dots.length]; ell(c, px + (n - 0.75) * 60, py + (hash(i) - 0.5) * 14, 1.7, 1.3); c.fill(); }
      if (b.terrain[i] === 'bramble') { c.fillStyle = 'rgba(40,60,30,0.28)'; diamond(c, px, py, 0.82); c.fill(); }
    }
    // One light across the whole meadow: brighter at the back left, drawn in at the front right.
    c.save(); poly(c, [L[0], L[1], OX, OY - TH - RISE, R[0], R[1], B[0], B[1]]); c.clip();
    const lit = c.createLinearGradient(L[0], OY, R[0], B[1]); lit.addColorStop(0, 'rgba(255,248,206,0.2)'); lit.addColorStop(0.5, 'rgba(255,248,206,0)'); lit.addColorStop(1, 'rgba(30,16,60,0.16)');
    c.fillStyle = lit; c.fillRect(L[0], OY - TH - RISE, R[0] - L[0], B[1] - OY + TH + RISE);
    for (let i = 0; i < 26; i++) { const x = L[0] + hash(i * 2.3 + 5) * (R[0] - L[0]), y = OY + hash(i * 4.1 + 9) * (B[1] - OY), r = 30 + hash(i + 40) * 50, g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, i % 2 ? 'rgba(255,252,200,0.08)' : 'rgba(10,40,20,0.08)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.save(); c.translate(x, y); c.scale(1, 0.5); c.translate(-x, -y); c.fillRect(x - r, y - r, r * 2, r * 2); c.restore(); }
    c.restore();
    this.bg = cv; this.bgKey = key;
    return cv;
  }
  private drawFeature(c: C2D, f: Feature, x: number, y: number, i: number, t: number, held: boolean) {
    const block = (sw: number, sh: number, h: number, top: string, left: string, right: string) => {
      poly(c, [x - sw, y - h, x, y - h + sh, x, y + sh, x - sw, y]); ink(c, left);
      poly(c, [x, y - h + sh, x + sw, y - h, x + sw, y, x, y + sh]); ink(c, right);
      poly(c, [x, y - h - sh, x + sw, y - h, x, y - h + sh, x - sw, y - h]); ink(c, top);
    };
    c.fillStyle = 'rgba(20,12,30,0.2)'; ell(c, x + 3, y + 5, 27, 10); c.fill();
    if (f === 'rock') {
      const j = hash(i) * 6 - 3;
      poly(c, [x - 25, y + 6, x - 21, y - 12 + j, x - 8, y - 27, x + 9, y - 24 - j, x + 23, y - 9, x + 25, y + 6, x + 4, y + 13, x - 14, y + 11]); ink(c, '#9a97a6');
      c.fillStyle = '#c3c0cd'; poly(c, [x - 17, y - 10 + j, x - 7, y - 23, x + 7, y - 21 - j, x - 1, y - 9]); c.fill();
      c.fillStyle = 'rgba(30,24,44,0.22)'; poly(c, [x + 9, y - 24 - j, x + 23, y - 9, x + 25, y + 6, x + 4, y + 13, x + 2, y - 7]); c.fill();
      c.strokeStyle = 'rgba(44,36,48,0.5)'; c.lineWidth = 0.9; c.beginPath(); c.moveTo(x - 1, y - 9); c.lineTo(x + 2, y + 12); c.stroke();
    } else if (f === 'bale') {
      block(25, 12.5, 22, '#f3d572', '#d9b34a', '#c09a38');
      c.strokeStyle = '#8a6a26'; c.lineWidth = 1.3; c.beginPath(); c.moveTo(x - 13, y - 15.5); c.lineTo(x - 13, y + 6.5); c.moveTo(x + 13, y - 15.5); c.lineTo(x + 13, y + 6.5); c.moveTo(x - 13, y - 28.5); c.lineTo(x + 12, y - 16); c.stroke();
      c.strokeStyle = 'rgba(138,106,38,0.45)'; c.lineWidth = 0.8; c.beginPath(); for (let k = 0; k < 5; k++) { const sx = x - 21 + k * 4; c.moveTo(sx, y - 14 + k * 2); c.lineTo(sx + 3, y - 2 + k * 2); } c.stroke();
    } else if (f === 'burrow') {
      const g = c.createLinearGradient(x - 20, y - 30, x + 20, y + 10); g.addColorStop(0, '#c08d5e'); g.addColorStop(1, '#8d6240');
      c.beginPath(); c.ellipse(x, y + 5, 28, 31, 0, Math.PI, 0); c.ellipse(x, y + 5, 28, 10, 0, 0, Math.PI); ink(c, g);
      c.fillStyle = 'rgba(255,255,255,0.16)'; ell(c, x - 10, y - 13, 9, 5, -0.6); c.fill();
      c.strokeStyle = '#5f9a48'; c.lineWidth = 1.6; c.lineCap = 'round'; c.beginPath(); for (const gx of [-6, -1, 5]) { c.moveTo(x + gx, y - 25); c.lineTo(x + gx + (gx < 0 ? -2 : 2), y - 31); } c.stroke();
      c.beginPath(); c.ellipse(x + 6, y + 8, 9.5, 14, 0, Math.PI, 0); c.lineTo(x + 15.5, y + 11); c.lineTo(x - 3.5, y + 11); c.closePath(); ink(c, '#2e1f22', '#5a3c26', 2);
      ell(c, x - 12, y - 3, 4, 4.4); ink(c, `rgba(255,214,110,${0.75 + 0.2 * Math.sin(t * 3 + i)})`, '#5a3c26', 1.4);
      c.strokeStyle = INK; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x - 2, y - 26); c.lineTo(x - 2, y - 44); c.stroke();
      poly(c, [x - 2, y - 44, x + 11 + Math.sin(t * 4 + i) * 1.5, y - 40, x - 2, y - 36]); ink(c, held ? '#ffd23e' : '#58b4f0', INK, 1.1);
    } else {
      for (const [dx, dy, r] of [[-12, 3, 9], [6, 5, 10], [-2, -3, 8], [15, -1, 6]]) { ell(c, x + dx, y + dy, r, r * 0.55); ink(c, '#8d6a4c', '#4a3526', 1.1); }
      c.strokeStyle = INK; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x - 6, y - 4); c.lineTo(x + 6, y - 15); c.stroke();
      poly(c, [x + 6, y - 15, x + 13, y - 9, x + 3, y - 10]); ink(c, '#8fa3b0', INK, 1);
    }
  }
  private drawBramble(c: C2D, x: number, y: number, i: number) {
    c.lineCap = 'round';
    for (let j = 0; j < 5; j++) {
      const bx = x + (hash(i * 11 + j) - 0.5) * 44, by = y + (hash(i * 13 + j) - 0.5) * 14, r = 7 + hash(i + j) * 5;
      c.strokeStyle = '#2f5a2c'; c.lineWidth = 2.4; c.beginPath(); c.arc(bx, by, r, Math.PI * 1.05, Math.PI * 1.95); c.stroke();
      c.strokeStyle = '#4c8a42'; c.lineWidth = 1.1; c.stroke();
      c.strokeStyle = '#2f5a2c'; c.lineWidth = 1; c.beginPath(); c.moveTo(bx - r * 0.5, by - r * 0.85); c.lineTo(bx - r * 0.7, by - r * 1.25); c.moveTo(bx + r * 0.5, by - r * 0.85); c.lineTo(bx + r * 0.75, by - r * 1.2); c.stroke();
      if (j % 2 === 0) { ell(c, bx, by - r, 1.9, 1.9); ink(c, '#8c3fb0', '#3a1a4a', 0.7); }
    }
  }
  private drawFire(c: C2D, x: number, y: number, i: number, t: number, n: number) {
    c.fillStyle = `rgba(255,150,40,${0.22 + 0.08 * Math.sin(t * 8 + i)})`; diamond(c, x, y, 0.9); c.fill();
    for (let j = 0; j < (n > 1 ? 4 : 2); j++) {
      const fx = x + (hash(i * 17 + j) - 0.5) * 42, fy = y + (hash(i * 19 + j) - 0.5) * 12 + 3, h = (n > 1 ? 17 : 11) + 5 * Math.sin(t * 9 + j * 2 + i);
      c.beginPath(); c.moveTo(fx - 5.5, fy); c.quadraticCurveTo(fx - 7, fy - h * 0.5, fx + Math.sin(t * 7 + j) * 2, fy - h); c.quadraticCurveTo(fx + 7, fy - h * 0.5, fx + 5.5, fy); c.closePath(); ink(c, '#ff8a2a', '#a8320a', 1);
      c.beginPath(); c.moveTo(fx - 2.6, fy); c.quadraticCurveTo(fx - 3, fy - h * 0.3, fx, fy - h * 0.62); c.quadraticCurveTo(fx + 3, fy - h * 0.3, fx + 2.6, fy); c.closePath(); c.fillStyle = '#ffe066'; c.fill();
    }
  }
  /** The den an escorted kit has to reach: a little doorway with a green flag. */
  private drawDen(c: C2D, x: number, y: number, t: number) {
    c.fillStyle = `rgba(90,220,120,${0.3 + 0.12 * Math.sin(t * 4)})`; diamond(c, x, y, 0.9); c.fill(); c.strokeStyle = '#2f9a4c'; c.lineWidth = 2.5; c.stroke();
    c.strokeStyle = INK; c.lineWidth = 1.6; c.beginPath(); c.moveTo(x, y + 2); c.lineTo(x, y - 34); c.stroke();
    poly(c, [x, y - 34, x + 17 + Math.sin(t * 4) * 1.5, y - 28, x, y - 22]); ink(c, '#58d06a', INK, 1.2);
    c.fillStyle = '#ffffff'; c.font = 'bold 8px ui-sans-serif, system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('DEN', x + 7.5, y - 27.6);
  }
  private star(c: C2D, x: number, y: number, r: number, fill: string) {
    const pts: number[] = [];
    for (let j = 0; j < 10; j++) { const a = -Math.PI / 2 + (j * Math.PI) / 5, k = j % 2 ? r * 0.45 : r; pts.push(x + Math.cos(a) * k, y + Math.sin(a) * k); }
    poly(c, pts); ink(c, fill, INK, 1.2);
  }
  private drawMark(c: C2D, x: number, y: number, t: number) {
    c.fillStyle = 'rgba(90,60,40,0.4)'; diamond(c, x, y, 0.5); c.fill();
    c.lineCap = 'round';
    for (let j = 0; j < 7; j++) { const a = Math.sin(t * 13 + j * 1.7) * 0.3, bx = x - 15 + j * 5, by = y + ((j * 37) % 7) - 3; c.strokeStyle = j % 2 ? '#3f7a34' : '#5aa046'; c.lineWidth = 2; c.beginPath(); c.moveTo(bx, by); c.quadraticCurveTo(bx + a * 6, by - 8, bx + a * 16, by - 15 - (j % 3) * 2); c.stroke(); }
    const by = y - 30 + Math.sin(t * 5) * 2;
    // An amber paw-print badge, so it is not mistaken for the red warning over a burrow about to be hit.
    ell(c, x, by, 8.5, 8.5); ink(c, '#f2a63a', '#5a3a0a', 1.2);
    c.fillStyle = '#3a2408'; ell(c, x, by + 2, 3.2, 2.6); c.fill();
    for (const [dx, dy] of [[-3.6, -1.6], [-1.3, -3.6], [1.3, -3.6], [3.6, -1.6]]) { ell(c, x + dx, by + dy, 1.2, 1.5); c.fill(); }
  }
  private drawCloud(c: C2D, x: number, y: number, i: number, t: number, n: number) {
    c.save(); c.globalAlpha = n > 1 ? 0.8 : 0.5;
    for (let j = 0; j < 7; j++) { const a = j * 0.9 + t * 0.5, r = 11 + hash(i + j) * 7; ell(c, x + Math.cos(a) * 17, y - 17 + Math.sin(a * 1.3) * 7 - (j % 3) * 5, r, r * 0.8); c.fillStyle = j % 2 ? '#efe2c2' : '#e2d2ab'; c.fill(); }
    c.restore();
  }
  private drawSprite(c: C2D, s: Sprite, t: number, dim: boolean) {
    const [x, y] = this.at(s), lift = (s.fly ? FLY_LIFT + Math.sin(t * 3 + s.id) * 2 : 0) + s.z, feet = y + 5 - lift;
    c.save();
    c.globalAlpha = (1 - s.fade) * (dim ? 0.72 : 1);
    if (s.fly) { c.fillStyle = 'rgba(20,12,30,0.22)'; ell(c, x, y + 5, 13, 4.5); c.fill(); }
    c.translate(x, feet); c.scale(s.pop, s.pop); if (s.fade) c.rotate(s.fade * 0.5 * s.face); c.translate(-x, -feet);
    if (s.side === 'hero') {
      const kind = s.kind as HeroId;
      drawChinchilla(c, COAT[kind], x, feet, { face: s.face, h: SIZE_OF[kind], time: t + s.id, run: s.run, moving: s.moving, air: s.z > 8, blink: (t + s.id * 1.7) % 4 < 0.14, dizzy: s.hp <= 0, decorate: dress(kind) });
    } else drawPredator(c, s.kind as PredId, s.alpha, x, feet, s.face, t + s.id);
    if (s.flash > 0) { c.globalCompositeOperation = 'lighter'; c.globalAlpha = s.flash * 1.6; c.fillStyle = '#ffffff'; ell(c, x, feet - 16, 17, 19); c.fill(); }
    c.restore();
  }
  private pips(c: C2D, s: Sprite, x: number, y: number, hurt = 0) {
    const w = 7, gap = 2, total = s.maxHp * w + (s.maxHp - 1) * gap;
    c.beginPath(); c.roundRect(x - total / 2 - 3, y - 3, total + 6, 10, 4); c.fillStyle = 'rgba(24,18,30,0.8)'; c.fill();
    if (s.alpha) { c.strokeStyle = '#ffd23e'; c.lineWidth = 1.2; c.stroke(); }
    for (let i = 0; i < s.maxHp; i++) {
      c.beginPath(); c.roundRect(x - total / 2 + i * (w + gap), y, w, 4, 1.5);
      c.fillStyle = i >= s.hp ? '#4a4252' : i >= s.hp - hurt ? '#ffffff' : s.side === 'hero' ? '#7be07a' : '#ff6b5a'; c.fill();
    }
  }
  private arrow(c: C2D, pts: [number, number][], t: number, color: string, dark: string) {
    if (pts.length < 2) return;
    c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
    const [ax, ay] = pts[pts.length - 2], [bx, by] = pts[pts.length - 1], a = Math.atan2(by - ay, bx - ax);
    for (const [col, w, s] of [[dark, 7, 13], [color, 4, 10]] as [string, number, number][]) {
      c.strokeStyle = col; c.lineWidth = w; c.setLineDash([9, 7]); c.lineDashOffset = -t * 22;
      c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) c.lineTo(p[0], p[1]); c.stroke();
      c.setLineDash([]); c.fillStyle = col;
      c.beginPath(); c.moveTo(bx + Math.cos(a) * s, by + Math.sin(a) * s); c.lineTo(bx + Math.cos(a + 2.4) * s, by + Math.sin(a + 2.4) * s); c.lineTo(bx + Math.cos(a - 2.4) * s, by + Math.sin(a - 2.4) * s); c.closePath(); c.fill();
    }
    c.restore();
  }

  draw(c: C2D, b: Battle, t: number, o: Overlay = NO_OVERLAY) {
    const idle = !this.busy, show = idle && o.preview ? o.preview : b;
    c.save();
    if (this.shake > 0) c.translate(Math.sin(t * 90) * this.shake * 0.5, Math.cos(t * 70) * this.shake * 0.35);
    c.drawImage(this.backdrop(b), 0, 0, VIEW_W, VIEW_H);
    // Water moves.
    c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = 1.2; c.lineCap = 'round';
    b.terrain.forEach((tr, i) => {
      if (tr !== 'water') return;
      const [x, y] = this.center(i % SIZE, Math.floor(i / SIZE)), s = Math.sin(t * 2 + i) * 5;
      c.beginPath(); c.moveTo(x - 17 + s, y - 1); c.quadraticCurveTo(x - 9 + s, y - 6, x - 1 + s, y - 1); c.moveTo(x + 2 - s, y + 7); c.quadraticCurveTo(x + 9 - s, y + 2, x + 16 - s, y + 7); c.stroke();
    });
    const tiles = (list: Tile[], k: number, fill: string, line: string, w = 2) => { for (const [x, y] of list) { const [px, py] = this.center(x, y); diamond(c, px, py, k); c.fillStyle = fill; c.fill(); c.strokeStyle = line; c.lineWidth = w; c.stroke(); } };
    if (idle) {
      if (o.zone) tiles(o.zone, 0.86, 'rgba(90,210,120,0.28)', 'rgba(40,150,70,0.9)');
      tiles(o.moves, 0.86, 'rgba(70,150,255,0.3)', 'rgba(40,110,230,0.9)');
      // What each predator will hit: from the previewed battle while an action is being aimed.
      const pulse = 0.3 + 0.14 * Math.sin(t * 5);
      for (const u of show.preds) { const th = show.threat(u); tiles(th.path, 0.8, 'rgba(240,60,50,0.12)', 'rgba(224,42,32,0.45)', 1.2); tiles(th.hits, 0.9, `rgba(240,50,40,${pulse})`, '#e02a20'); }
      tiles(o.targets, 0.84, 'rgba(255,170,40,0.26)', 'rgba(255,150,20,0.95)');
      if (o.aim) tiles([o.aim], 0.94, 'rgba(255,220,90,0.45)', '#fff2b0', 3);
    } else tiles(this.flash, 0.92, 'rgba(255,70,50,0.5)', '#ff3a2a', 2.5);
    const ring = (tile: Tile | null, color: string, w: number, k: number) => { if (!tile) return; const [px, py] = this.center(tile[0], tile[1]); diamond(c, px, py, k); c.strokeStyle = color; c.lineWidth = w; c.stroke(); };
    const sel = this.sprites.get(o.selected);
    if (sel && idle) ring([sel.x, sel.y], '#ffd23e', 3.5, 0.95);
    ring(o.cursor, 'rgba(255,255,255,0.9)', 2.5, 0.98); ring(o.hover, 'rgba(255,255,255,0.75)', 2, 0.98);
    // Everything that stands up, back to front.
    type Thing = { d: number; draw: () => void };
    const things: Thing[] = [], feature = idle ? show.feature : this.feature, cloud = idle ? show.cloud : this.cloud, fire = idle ? show.fire : this.fire;
    if (b.exit >= 0) { const ex = b.exit % SIZE, ey = Math.floor(b.exit / SIZE), [px, py] = this.center(ex, ey); things.push({ d: ex + ey - 0.25, draw: () => this.drawDen(c, px, py, t) }); }
    feature.forEach((f, i) => {
      const x = i % SIZE, y = Math.floor(i / SIZE), [px, py] = this.center(x, y);
      if (b.terrain[i] === 'bramble' && !f) things.push({ d: x + y - 0.2, draw: () => this.drawBramble(c, px, py, i) });
      if (f) things.push({ d: x + y + (f === 'rubble' ? -0.3 : 0), draw: () => { if (idle && o.preview && this.feature[i] !== f) c.globalAlpha = 0.6; this.drawFeature(c, f, px, py, i, t, b.armor[i] > 0); c.globalAlpha = 1; } });
      if (fire[i] > 0) things.push({ d: x + y + 0.1, draw: () => this.drawFire(c, px, py, i, t, fire[i]) });
      if (cloud[i] > 0) things.push({ d: x + y + 0.6, draw: () => this.drawCloud(c, px, py, i, t, cloud[i]) });
    });
    for (const m of this.marks) things.push({ d: m.x + m.y - 0.1, draw: () => { const [px, py] = this.center(m.x, m.y); this.drawMark(c, px, py, t); } });
    for (const s of this.sprites.values()) {
      if (s.gone) continue;
      const u = b.unit(s.id), done = s.side === 'hero' && idle && !!u && u.acted && b.state === 'player';
      things.push({ d: s.x + s.y + 0.3, draw: () => this.drawSprite(c, s, t, done) });
    }
    things.sort((a, z) => a.d - z.d).forEach((th) => th.draw());
    if (this.shot) this.drawShot(c, this.shot);
    // Attack arrows and target outlines go over the creatures, so a threat is never hidden behind its victim.
    if (idle) for (const u of show.preds) {
      const th = show.threat(u), from = this.center(u.x, u.y);
      c.save(); c.globalAlpha = 0.85; c.setLineDash([5, 4]); c.strokeStyle = '#ff3a2a'; c.lineWidth = 2;
      for (const [hx, hy] of th.hits) { const [px, py] = this.center(hx, hy); diamond(c, px, py, 0.9); c.stroke(); }
      c.restore();
      if ((!th.hits.length && !th.path.length) || u.kind === 'cougar' || u.kind === 'badger') continue;
      const last = th.hits[0] ?? th.path[th.path.length - 1];
      c.save(); c.globalAlpha = 0.9;
      this.arrow(c, [from, this.center(last[0], last[1])].map(([x, y]): [number, number] => [x, y - 4]), t, '#ff4d3d', 'rgba(60,10,10,0.55)');
      c.restore();
    }
    // Health, attack order and what the coming turn will cost.
    for (const s of this.sprites.values()) {
      if (s.gone || s.fade > 0) continue;
      const [x, y] = this.at(s), top = y - (s.side === 'hero' ? SIZE_OF[s.kind as HeroId] : PRED_H[s.kind as PredId]) - (s.fly ? FLY_LIFT : 0) - 4 - s.z;
      const after = idle && o.preview ? o.preview.unit(s.id) : undefined, hurt = after ? Math.max(0, s.hp - after.hp) : 0;
      this.pips(c, s, x, top, hurt);
      const u = b.unit(s.id);
      const half = (s.maxHp * 9 - 2) / 2 + 3;
      if (idle && u && u.side === 'pred' && u.order > 0 && u.dir >= 0) { ell(c, x - half - 6, top + 2, 7, 7); ink(c, '#3a1210', '#ff8a7a', 1.2); c.fillStyle = '#fff'; c.font = 'bold 10px ui-sans-serif, system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(u.order), x - half - 6, top + 2.5); }
      if (u?.mark) { const mx = x + half + 6, my = top + 2; ell(c, mx, my, 6.5, 6.5); ink(c, '#ffd23e', '#5a3a0a', 1.2); c.strokeStyle = '#5a3a0a'; c.lineWidth = 1.3; ell(c, mx, my, 2.6, 2.6); c.stroke(); c.beginPath(); c.moveTo(mx - 6.5, my); c.lineTo(mx - 3, my); c.moveTo(mx + 3, my); c.lineTo(mx + 6.5, my); c.moveTo(mx, my - 6.5); c.lineTo(mx, my - 3); c.moveTo(mx, my + 3); c.lineTo(mx, my + 6.5); c.stroke(); }
      const cost = idle && o.forecast && !(u?.mark) ? o.forecast.heroes[s.id] : 0;
      if (cost) this.badge(c, x + 20, top + 2, o.forecast!.downs.includes(s.id) ? '✖' : `-${cost}`, '#e8392b');
    }
    if (idle && o.preview) for (const u of b.units) {
      const v = o.preview.unit(u.id);
      if (!v || u.hp <= 0) continue;
      const from = this.center(u.x, u.y), to = this.center(v.x, v.y);
      if (v.x !== u.x || v.y !== u.y) this.arrow(c, [[from[0], from[1] - 10], [to[0], to[1] - 10]], t, '#ffffff', 'rgba(20,16,30,0.6)');
      if (v.hp < u.hp) this.badge(c, to[0], to[1] - 62, v.hp <= 0 ? (o.preview.terrain[idx(v.x, v.y)] === 'water' && !u.fly ? 'Splash' : 'KO') : `-${u.hp - v.hp}`, v.hp <= 0 ? '#8a2be2' : '#2c2430');
    }
    if (b.key >= 0 && feature[b.key] === 'burrow') { const [px, py] = this.center(b.key % SIZE, Math.floor(b.key / SIZE)); this.star(c, px + 14, py - 40 + Math.sin(t * 3) * 1.5, 8, '#ffd23e'); }
    // A suggestion: where to go, what to aim at, and where to go afterwards.
    if (idle && o.hint) {
      const h = o.hint, who = this.sprites.get(h.id), glow = 0.55 + 0.45 * Math.sin(t * 7);
      const spot = (tile: Tile, label: string, color: string) => { const [px, py] = this.center(tile[0], tile[1]); diamond(c, px, py, 0.96); c.strokeStyle = color; c.lineWidth = 2.5 + glow * 2; c.stroke(); this.badge(c, px, py - 6, label, color); };
      let from: [number, number] | null = who ? this.center(who.x, who.y) : null;
      const go = (tile: Tile) => { const to = this.center(tile[0], tile[1]); if (from) this.arrow(c, [[from[0], from[1] - 6], [to[0], to[1] - 6]], t, '#3fe0d0', 'rgba(10,50,60,0.6)'); from = to; };
      if (h.move) { go(h.move); spot(h.move, 'move', '#19b8a8'); }
      if (h.target) spot(h.target, 'aim', '#e0409a');
      if (h.then) { go(h.then); spot(h.then, 'then move', '#19b8a8'); }
    }
    if (idle && o.point) { const [px, py] = this.center(o.point[0], o.point[1]), bob = Math.sin(t * 6) * 4; poly(c, [px - 9, py - 78 + bob, px + 9, py - 78 + bob, px, py - 62 + bob]); ink(c, '#ffd23e', INK, 1.5); }
    if (idle && o.forecast) for (const [x, y] of o.forecast.burrows) { const [px, py] = this.center(x, y); this.badge(c, px, py - 56 + Math.sin(t * 6) * 2, '!', '#e8392b'); }
    for (const d of this.dots) { c.globalAlpha = 1 - d.life / d.max; c.fillStyle = d.color; ell(c, d.x, d.y, d.r, d.r); c.fill(); }
    c.globalAlpha = 1;
    c.font = 'bold 15px ui-sans-serif, system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    for (const f of this.floats) { c.globalAlpha = Math.min(1, (1.1 - f.life) * 3); c.lineWidth = 3.5; c.strokeStyle = 'rgba(20,14,28,0.85)'; c.strokeText(f.text, f.x, f.y); c.fillStyle = f.color; c.fillText(f.text, f.x, f.y); }
    c.globalAlpha = 1;
    c.restore();
    if (this.banner.text && this.banner.t < 1) {
      const k = this.banner.t, a = Math.min(1, k * 6, (1 - k) * 4);
      c.save(); c.globalAlpha = a; c.fillStyle = 'rgba(20,14,28,0.72)'; c.fillRect(0, 206, VIEW_W, 46);
      c.fillStyle = this.banner.text.startsWith('Pred') ? '#ff8a7a' : '#ffe38a'; c.font = '900 24px ui-sans-serif, system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(this.banner.text.toUpperCase(), VIEW_W / 2 + (1 - Math.min(1, k * 5)) * 40, 230); c.restore();
    }
  }
  private badge(c: C2D, x: number, y: number, text: string, fill: string) {
    c.font = 'bold 11px ui-sans-serif, system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    const w = Math.max(16, c.measureText(text).width + 9);
    c.beginPath(); c.roundRect(x - w / 2, y - 8, w, 16, 8); ink(c, fill, '#ffffff', 1.4);
    c.fillStyle = '#ffffff'; c.fillText(text, x, y + 0.5);
  }
  private drawShot(c: C2D, s: Shot) {
    const x = s.from[0] + (s.to[0] - s.from[0]) * s.k, y = s.from[1] + (s.to[1] - s.from[1]) * s.k - Math.sin(s.k * Math.PI) * s.arc;
    if (s.kind === 'rope') { c.strokeStyle = INK; c.lineWidth = 3.4; c.lineCap = 'round'; c.beginPath(); c.moveTo(s.from[0], s.from[1]); c.lineTo(x, y); c.stroke(); c.strokeStyle = '#e8c98a'; c.lineWidth = 1.8; c.stroke(); ell(c, x, y, 4, 4); ink(c, '#e8c98a', INK, 1); return; }
    if (s.kind === 'seed') { const a = Math.atan2(s.to[1] - s.from[1], s.to[0] - s.from[0]); c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = 2; c.beginPath(); c.moveTo(x, y); c.lineTo(x - Math.cos(a) * 16, y - Math.sin(a) * 16); c.stroke(); ell(c, x, y, 5, 3, a); ink(c, '#3a332c', INK, 1); c.strokeStyle = '#f4efe2'; c.lineWidth = 1; c.beginPath(); c.moveTo(x - Math.cos(a) * 3, y - Math.sin(a) * 3); c.lineTo(x + Math.cos(a) * 3, y + Math.sin(a) * 3); c.stroke(); return; }
    if (s.kind === 'spit') { ell(c, x, y, 4.5, 4.5); ink(c, '#a6e84a', '#3c7d3a', 1.2); return; }
    if (s.kind === 'bale') { c.beginPath(); c.roundRect(x - 9, y - 8, 18, 15, 3); ink(c, '#f3d572', '#8a6a26', 1.3); return; }
    for (let j = 0; j < 3; j++) { ell(c, x + (j - 1) * 5, y + (j % 2) * 3, 6, 5); c.fillStyle = '#eadbb6'; c.fill(); }
  }
}
