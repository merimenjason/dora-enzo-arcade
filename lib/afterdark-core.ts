// The Arcade After Dark: the game state and the small helpers every rule file shares (the seeded generator, sound and
// stat events, sparks, placing the heroes, where a world is entered). No DOM: sounds leave as `events`, music as `tune`.
import { makeWorlds, type Ability, type HeroName, type Plat, type Solid, type World, type WorldId } from './afterdark-worlds.js';

export const DT = 1 / 60;

export interface Input { mx: number; my: number; jumpH: boolean; jumpP: boolean; eP: boolean; jP: boolean; kP: boolean; swapP: boolean; actP: boolean; startP: boolean }
export const NO_INPUT: Input = { mx: 0, my: 0, jumpH: false, jumpP: false, eP: false, jP: false, kP: false, swapP: false, actP: false, startP: false };

export interface TrailPt { x: number; y: number; f: string; face: number; g: boolean }
export interface Hero {
  name: HeroName; x: number; y: number; vx: number; vy: number; face: number; ground: boolean; coyote: number; buf: number;
  hurtT: number; invT: number; abilT: number; gustT: number; reachT: number; winT: number; diveT: number; rollT: number; landT: number; braceT: number; aweT: number; rideT: number; blockedT: number;
  glide: boolean; inCurrent: boolean; animT: number; trail: TrailPt[]; hidden: boolean; sc: number; alpha: number; on: Plat | Solid | null; f: string;
}
export interface Particle { w: string; x: number; y: number; vx: number; vy: number; life: number; max: number; col: string; size: number; kind: string }
export interface Ring { w: string; x: number; y: number; r: number; d: number; max: number; hit: Set<object> }
export interface Arc { w: string; x: number; y: number; face: number; t: number }
export interface Cut { kind: 'ping' | 'sweep' | 'gust' | 'wake' | 'flee' | 'gather' | 'heal'; t: number; dur: number; got?: boolean; pinged?: boolean; swept?: boolean; blown?: boolean; a?: boolean; b?: boolean }
export interface Trans {
  kind: 'dive' | 'exit' | 'fade'; t: number; dur: number; cab?: import('./afterdark-worlds.js').Cab; to?: WorldId; hop?: string | null;
  /** the world shown on the cabinet screen during a dive or the way out (the scene paints it) */
  snapWorld?: WorldId; snapAtSpawn?: boolean;
  from?: { h: Hero; x: number; y: number }[]; xf?: (w: World) => number; face?: number; done?: boolean;
}
export interface Boss {
  x: number; hp: number; phase: 'intro' | 'shroud' | 'core' | 'scatter' | 'stagger' | 'reform' | 'dead'; pt: number;
  atk: { kind: 'slam' | 'roar'; t: number; tell: number; x?: number; hit?: boolean } | null; next: number; slams: number; waves: { x: number; dir: number }[];
  fr: string; ft: number; push: number; reset: boolean; unshroud?: boolean;
}
export interface Stats {
  events: [number, string][]; visits: Record<WorldId, number>; worldT: Partial<Record<WorldId, number>>; hurts: number; falls: number; pings: number; sweeps: number; gusts: number; swaps: number; knocks: number; pearls: number;
  tPing: number; tDoor: number; tCrest: number; tHub: number; tGust: number; tAnchor: number; tBoss: number; tHeal: number; castleFirst: boolean | null; bossHits: number; bossHurts: number;
}
export type Flags = { castleBlocked: boolean; conch: boolean; tunnel: boolean; door: boolean; crest: boolean; roomClear: boolean; hubSwept: boolean; anchor: boolean; boss: boolean; healed: boolean };
export interface Hint { key: 'R' | 'L' | 'E' | 'J' | 'K' | 'swap' | 'jump'; x: number; y: number; tx?: number; ty?: number }
export type GameEvent = { k: 'sfx'; id: string; v?: number };

export interface Game {
  rs: number; mode: 'play' | 'end'; time: number; playT: number; world: WorldId; W: Record<WorldId, World>;
  heroes: Record<HeroName, Hero>; lead: HeroName; abil: Record<Ability, boolean>; flags: Flags;
  assist: boolean; hearts: number; safe: { x: number; y: number } | null; ckpt: { w: WorldId; x: number; y: number } | null; hop: string | null; boss: Boss | null;
  parts: Particle[]; rings: Ring[]; arcs: Arc[]; gusts: Arc[]; trans: Trans | null; cut: Cut | null; shake: number; flash: number;
  hint: Hint | null; hintIdle: number; lastAct: number; healT: number; endT: number; roomClearT: number;
  tune: string; events: GameEvent[]; stats: Stats;
}

export function rnd(g: Game) { g.rs = (g.rs * 16807) % 2147483647; return g.rs / 2147483647; }
export const rr = (g: Game, a: number, b: number) => a + (b - a) * rnd(g);
export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const TAU = Math.PI * 2;

export function mkHero(name: HeroName): Hero {
  return { name, x: 0, y: 0, vx: 0, vy: 0, face: 1, ground: true, coyote: 0, buf: 0, hurtT: 0, invT: 0, abilT: 0, gustT: 0, reachT: 0, winT: 0, diveT: 0,
    rollT: 0, landT: 0, braceT: 0, aweT: 0, rideT: 0, blockedT: 0, glide: false, inCurrent: false, animT: 0, trail: [], hidden: false, sc: 1, alpha: 1, on: null, f: 'idle' };
}

export interface NewGameOpts { seed?: number; assist?: boolean; preset?: 'cloud' | 'anchor' | 'boss' }
export function newGame(opts: NewGameOpts = {}): Game {
  const g = { rs: opts.seed || 12345 } as Game;
  Object.assign(g, {
    mode: 'play', time: 0, playT: 0, world: 'hub', W: makeWorlds(() => rnd(g)),
    heroes: { dora: mkHero('dora'), enzo: mkHero('enzo') }, lead: 'dora',
    abil: { ping: false, sweep: false, gust: false },
    flags: { castleBlocked: false, conch: false, tunnel: false, door: false, crest: false, roomClear: false, hubSwept: false, anchor: false, boss: false, healed: false },
    assist: opts.assist !== false, hearts: 3, safe: null, ckpt: null, hop: null, boss: null,
    parts: [], rings: [], arcs: [], gusts: [], trans: null, cut: null, shake: 0, flash: 0,
    hint: null, hintIdle: 3.5, lastAct: 0, healT: -1, endT: -1, roomClearT: 0, tune: 'hub', events: [],
    stats: { events: [], visits: { hub: 1, sea: 0, castle: 0, room: 0, deep: 0, cloud: 0 }, worldT: {}, hurts: 0, falls: 0, pings: 0, sweeps: 0, gusts: 0, swaps: 0, knocks: 0, pearls: 0,
      tPing: -1, tDoor: -1, tCrest: -1, tHub: -1, tGust: -1, tAnchor: -1, tBoss: -1, tHeal: -1, castleFirst: null, bossHits: 0, bossHurts: 0 },
  } satisfies Omit<Game, 'rs'>);
  if (opts.preset) PRESET[opts.preset](g);
  placeHeroes(g, 'hub', g.W.hub.spawn, 640, 1);
  return g;
}
// test presets: jump straight to a beat (used by the tests, the bots and the screenshots)
export const PRESET = {
  cloud(g: Game) { Object.assign(g.abil, { ping: true, sweep: true }); Object.assign(g.flags, { castleBlocked: true, conch: true, tunnel: true, door: true, crest: true, roomClear: true }); applyWorldProgress(g); wakeHub(g, true); },
  anchor(g: Game) { PRESET.cloud(g); g.abil.gust = true; g.W.cloud.shrine!.taken = true; },
  boss(g: Game) { PRESET.anchor(g); g.flags.anchor = true; applyWorldProgress(g); },
};
/** set the worlds to match the abilities and flags (used by the presets and by a loaded save) */
export function applyWorldProgress(g: Game) {
  const W = g.W, f = g.flags, a = g.abil;
  if (a.ping) { W.sea.conch!.used = true; W.castle.portals[1].open = false; }
  if (f.tunnel) W.sea.pillar!.open = true;
  if (f.door) { W.castle.wall!.open = true; W.castle.wall!.t = 9; }
  if (a.sweep) W.room.pedestal!.taken = true;
  if (f.roomClear) { for (const s of W.room.statics) { s.alive = false; s.dis = 1; } for (const b of W.room.braziers!) b.lit = true; }
  if (f.hubSwept) wakeHub(g, true);
  if (a.gust) W.cloud.shrine!.taken = true;
  if (f.anchor) { const d = W.deep; d.anchor!.found = d.anchor!.bare = d.anchor!.gone = true; for (const q of d.guards!) q.alive = false; for (const s of d.statics) { s.alive = false; s.dis = 1; } d.portals[1].open = true; }
}
export function wakeHub(g: Game, instant: boolean) {
  const w = g.W.hub;
  for (const s of w.statics) { s.alive = false; if (instant) s.dis = 1; }
  w.cabs!.find((c) => c.id === 'cloud')!.live = true;
  g.flags.hubSwept = true;
}
export function ev(g: Game, e: string) { g.stats.events.push([+g.playT.toFixed(1), e]); }
export function sfx(g: Game, id: string, v?: number) { g.events.push(v === undefined ? { k: 'sfx', id } : { k: 'sfx', id, v }); }
export const W0 = (g: Game) => g.W[g.world];
export const lead = (g: Game) => g.heroes[g.lead];
export const partner = (g: Game) => g.heroes[g.lead === 'dora' ? 'enzo' : 'dora'];
export const pearlsTotal = (g: Game) => (['sea', 'castle', 'cloud', 'deep'] as const).reduce((n, k) => n + g.W[k].pearls.length, 0) + 1;   // +1: the castle chest

export function spark(g: Game, w: string, x: number, y: number, n: number, col: string, spd = 160, life = 0.7, size = 4, kind = 'spark', up = 0) {
  for (let i = 0; i < n; i++) {
    const a = rnd(g) * TAU, s = spd * (0.3 + rnd(g) * 0.7);
    g.parts.push({ w, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - up, life: life * (0.6 + rnd(g) * 0.5), max: life, col, size: size * (0.6 + rnd(g) * 0.7), kind });
  }
}
export function updParts(g: Game, dt: number) {
  for (const p of g.parts) {
    p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.kind === 'bubble') { p.vy -= 40 * dt; p.vx *= 0.98; p.x += Math.sin(p.life * 9) * 0.4; }
    else if (p.kind === 'pix') { p.vy -= 60 * dt; p.vx *= 0.97; }
    else if (p.kind === 'mote') { p.vy *= 0.99; }
    else if (p.kind === 'streak' || p.kind === 'lift') { /* wind keeps its speed */ }
    else { p.vx *= 0.93; p.vy *= 0.93; }
  }
  g.parts = g.parts.filter((p) => p.life > 0);
}

export function placeHeroes(g: Game, wid: WorldId, x: number, y: number, face: number) {
  const w = g.W[wid];
  const L = lead(g), P = partner(g);
  for (const h of [L, P]) { h.vx = h.vy = 0; h.trail = []; h.hurtT = h.abilT = h.gustT = h.reachT = h.winT = h.diveT = h.rollT = h.braceT = h.rideT = 0; h.hidden = false; h.sc = 1; h.alpha = 1; h.face = face; h.on = null; h.glide = false; }
  L.x = x; P.x = x - 70 * face;
  if (w.kind === 'swim') { L.y = y; P.y = y + 30; }
  else { L.y = P.y = y; L.ground = P.ground = true; }
  g.safe = { x, y };
}
// where a world is entered: checkpoints skip the parts already done
export function entryOf(g: Game, wid: WorldId) {
  const w = g.W[wid], f = g.flags;
  if (wid === 'castle' && (g.hop === 'castle' || f.castleBlocked || g.abil.ping)) return { x: 3250, y: w.floor };
  if (wid === 'sea' && g.abil.gust && !f.anchor) return { x: 2860, y: 330 };
  if (wid === 'sea' && f.tunnel) return { x: 2120, y: 330 };
  if (wid === 'cloud' && g.abil.gust) return { x: 2300, y: 300 };
  return { x: w.spawn, y: w.spawnY || w.floor };
}
export const heroMid = (g: Game, h: Hero) => (W0(g).kind === 'swim' ? h.y : h.y - 85);
