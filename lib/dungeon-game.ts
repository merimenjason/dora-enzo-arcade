// Dust Bunny Dungeon: a turn-based grid roguelike. Dora or Enzo tidy twelve cellar floors that mischievous dust bunnies
// have taken over. Every step is one turn and the enemies move after you; each enemy shows what it will do next turn,
// and you can only ever be hurt on a tile one of them has marked. Rules only, no DOM: a seed and a log of actions
// replay a run exactly.

export const SAVE_KEY = 'dust-bunny-dungeon-v1';
/** The map: three by three room slots of nine by nine tiles, with one wall between them. */
export const W = 31, H = 31, SLOT = 10, ROOM = 9;
export const FLOORS = 12;
export type Dir = 0 | 1 | 2 | 3;
/** Up, right, down, left. */
export const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];
export const DIRS = 'URDL';
export type Char = 'dora' | 'enzo';
export type Mode = 'run' | 'daily';

// ---- tiles
export const WALL = 0, FLOOR = 1, PIT = 2, SPIKE = 3, LOWERED = 4, SWITCH = 5, BELLOWS = 6, DOOR = 7, LOCKED = 8, STAIRS = 9, CHEST = 10;
/** Tiles anyone can stand on. */
export const walkable = (t: number) => t === FLOOR || t === LOWERED || t === SWITCH || t === BELLOWS || t === DOOR || t === STAIRS;
/** Tiles that stop a push with a bonk. */
const solid = (t: number) => t === WALL || t === LOCKED || t === CHEST;

// ---- characters, tools, perks
export const CHARS: Record<Char, { name: string; hp: number; dash: number; blurb: string }> = {
  dora: { name: 'Dora', hp: 5, dash: 0, blurb: 'Five hearts. Steady and sturdy: she can take a few more bops.' },
  enzo: { name: 'Enzo', hp: 4, dash: 1, blurb: 'Four hearts and a dash: once a floor he zooms up to three tiles in one turn.' },
};
export const MAX_HP = 9;
export type Tool = 'duster' | 'sling' | 'soap' | 'lantern' | 'acorn';
export const TOOLS: Tool[] = ['duster', 'sling', 'soap', 'lantern', 'acorn'];
export const TOOL_INFO: Record<Tool, { name: string; aim: boolean; blurb: string }> = {
  duster: { name: 'Feather Duster', aim: true, blurb: 'Sweeps the three tiles in front of you: 1 bop each and a knock back.' },
  sling: { name: 'Pebble Sling', aim: true, blurb: 'Flicks a pebble up to 7 tiles: 1 bop and a knock back to the first one it meets.' },
  soap: { name: 'Bubble Soap', aim: true, blurb: 'Blows a bubble stream 5 tiles long that pushes everything in it 2 tiles.' },
  lantern: { name: 'Lantern', aim: false, blurb: 'Lights the whole floor: every room, the stairs, mimics and burrowers.' },
  acorn: { name: 'Acorn Snack', aim: false, blurb: 'Crunch! A heart back.' },
};
export const TOOL_MAX = 3;
export type Item = Tool | 'key' | 'heart';
export type Perk = 'wind' | 'long' | 'push' | 'heart' | 'pockets' | 'acorns' | 'nose' | 'sharp' | 'dash' | 'bristle' | 'tidy';
export const PERKS: Record<Perk, { name: string; blurb: string; icon: string }> = {
  wind: { name: 'Second Wind', blurb: 'Once this run, when your last heart goes, you bounce back with two.', icon: '🌬️' },
  long: { name: 'Long Broom', blurb: 'Your broom also bops whoever stands right behind your target.', icon: '🧹' },
  push: { name: 'Push Strength', blurb: 'Broom bops knock enemies back two tiles instead of one.', icon: '💪' },
  heart: { name: 'Big Heart', blurb: 'One more heart to fill.', icon: '❤️' },
  pockets: { name: 'Deep Pockets', blurb: 'Carry one more of every tool, and find a duster and a sling pebble now.', icon: '🎒' },
  acorns: { name: 'Acorn Stash', blurb: 'Acorns heal one more heart, and two acorns now.', icon: '🌰' },
  nose: { name: 'Keen Nose', blurb: 'Every floor starts lantern-lit: rooms, stairs, mimics and burrowers shown.', icon: '👃' },
  sharp: { name: 'Sharp Shot', blurb: 'Sling pebbles bop for two.', icon: '🎯' },
  dash: { name: 'Quick Paws', blurb: 'One more dash every floor (Dora learns to dash too).', icon: '💨' },
  bristle: { name: 'Prickly Fluff', blurb: 'Anything that bops you from next door gets bopped back.', icon: '🌵' },
  tidy: { name: 'Tidy Habits', blurb: 'Every second flight of stairs gives a heart back.', icon: '✨' },
};
/** Floors after which you pick a perk (the bosses are on 4 and 8, so two of these are between areas). */
export const PERK_FLOORS = [2, 4, 6, 8, 10];
/** Turns on a floor before the dust gets thick, and then how often a new dust bunny tumbles out of it. */
export const DUST_CALM = 120, DUST_EVERY = 10;

// ---- enemies
export type Kind = 'fluff' | 'hopper' | 'roller' | 'puffer' | 'sneezer' | 'mimic' | 'burrower' | 'bigbun' | 'foreman' | 'king';
export const KINDS: Record<Kind, { name: string; hp: number; heavy: boolean; boss: boolean; blurb: string }> = {
  fluff: { name: 'Dust Bunny', hp: 1, heavy: false, boss: false, blurb: 'Hops one tile toward you, then bops the tile you were on.' },
  hopper: { name: 'Hop Bunny', hp: 1, heavy: false, boss: false, blurb: 'Jumps two tiles at a time and lands on the tile it marks.' },
  roller: { name: 'Tumble Fluff', hp: 2, heavy: false, boss: false, blurb: 'Lines up with you, then rolls until it bumps into something.' },
  puffer: { name: 'Puff Bunny', hp: 2, heavy: false, boss: false, blurb: 'Puffs a dust cloud up to three tiles away. The cloud lingers for two turns.' },
  sneezer: { name: 'Sneezy Bunny', hp: 2, heavy: false, boss: false, blurb: 'Sneezes along a line, pushing everything in it one tile.' },
  mimic: { name: 'Bale Mimic', hp: 3, heavy: false, boss: false, blurb: 'Looks just like a hay bale until you come close. Slow: it rests every other turn.' },
  burrower: { name: 'Burrow Bunny', hp: 2, heavy: false, boss: false, blurb: 'Tunnels under the floor and pops up on the tile it marks.' },
  bigbun: { name: 'Great Dust Bunny', hp: 8, heavy: true, boss: true, blurb: 'So fluffy it splits off a little dust bunny every time it is bopped.' },
  foreman: { name: 'Mole Foreman', hp: 10, heavy: true, boss: true, blurb: 'Swings his shovel across three tiles, tunnels, and whistles for help.' },
  king: { name: 'Dust King', hp: 13, heavy: true, boss: true, blurb: 'Rolls, puffs, sweeps and calls his court. Ruler of every dusty corner.' },
};
export const BESTIARY: Kind[] = ['fluff', 'hopper', 'roller', 'mimic', 'puffer', 'sneezer', 'burrower', 'bigbun', 'foreman', 'king'];
export type IntentKind = 'none' | 'move' | 'hit' | 'sweep' | 'jump' | 'roll' | 'puff' | 'sneeze' | 'emerge' | 'tunnel' | 'dig' | 'rest' | 'summon';
/** What an enemy will do next turn. `tiles` are the tiles it marks (where it will bop); `to` is where it is going. */
export type Intent = { kind: IntentKind; to: number; tiles: number[]; dir: number };
export type Enemy = {
  id: number; kind: Kind; x: number; y: number; hp: number; max: number;
  awake: boolean; fresh: boolean; dizzy: boolean; under: boolean; hidden: boolean; known: boolean;
  /** Actions taken (drives each enemy's rhythm) and turns left to rest or stay up. */
  t: number; wait: number; minion: boolean; intent: Intent;
};
const NO_INTENT = (): Intent => ({ kind: 'none', to: -1, tiles: [], dir: -1 });
/** Intents that mark tiles where the player would be bopped. */
export const HARMFUL: IntentKind[] = ['hit', 'sweep', 'jump', 'roll', 'puff', 'sneeze', 'emerge'];

export const AREAS = [
  { name: 'Root Cellar', blurb: 'Tangled roots, jam jars and the softest dust.', pool: [['fluff', 6], ['hopper', 4], ['roller', 2], ['mimic', 1]] as [Kind, number][] },
  { name: 'Pantry Tunnels', blurb: 'Sacks of oats and shelves of crumbs, and something sneezing.', pool: [['fluff', 3], ['hopper', 3], ['roller', 2], ['puffer', 3], ['sneezer', 3], ['mimic', 1]] as [Kind, number][] },
  { name: 'Old Mine', blurb: 'Rails, lanterns and deep, deep dust.', pool: [['fluff', 2], ['hopper', 3], ['roller', 3], ['puffer', 2], ['sneezer', 2], ['burrower', 4], ['mimic', 1]] as [Kind, number][] },
];
export const BOSS: Record<number, Kind> = { 4: 'bigbun', 8: 'foreman', 12: 'king' };
export const areaOf = (floor: number) => Math.min(2, Math.floor((floor - 1) / 4));

// ---- seeded randomness
export class Rng {
  constructor(public s: number) {}
  next() { let t = (this.s = (this.s + 0x6d2b79f5) | 0); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  int(n: number) { return Math.floor(this.next() * n); }
  pick<T>(a: readonly T[]): T { return a[this.int(a.length)]; }
  shuffle<T>(a: T[]): T[] { for (let i = a.length - 1; i > 0; i--) { const j = this.int(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
}
export const hash = (...n: number[]) => { let h = 2166136261; for (const x of n) { h = Math.imul(h ^ (x | 0), 16777619); h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15; } return h >>> 0; };
/** The daily seed: the same for everyone on a given date (yyyy-mm-dd). */
export const dailySeed = (day: string) => hash(...[...day].map((c) => c.charCodeAt(0)), 46);

// ---- rooms: nine by nine, the outer ring always open floor so every doorway joins up. The generator turns and flips them.
// . floor  # pillar  o pit  ^ raised prickles  v lowered prickles  s switch  b bellows  c crate  e enemy spot  i item spot  h hay bale
export const ROOMS: string[][] = [
  ['.........', '.........', '..e...e..', '.........', '....i....', '.........', '..e...e..', '.........', '.........'],
  ['.........', '.#..e..#.', '.........', '...#.#...', '..e.i.e..', '...#.#...', '.........', '.#..e..#.', '.........'],
  ['.........', '....e....', '...ooo...', '.e.ooo.e.', '...ooo...', '....i....', '.........', '..c...c..', '.........'],
  ['.........', '.s.......', '..vvvvv..', '..v.e.v..', '..v.i.v..', '..v.e.v..', '..vvvvv..', '.......s.', '.........'],
  ['.........', '..c...c..', '.c.#.#.c.', '...#e#...', '.e..i..e.', '...#.#...', '.c.#.#.c.', '..c...c..', '.........'],
  ['.........', '.......e.', '..#...#..', '...e.e...', '....b....', '...e.i...', '..#...#..', '.e.......', '.........'],
  ['.........', '.o.....o.', '..e...e..', '...o.o...', '....i....', '...o.o...', '..e...e..', '.o.....o.', '.........'],
  ['.........', '.#######.', '.........', '.e.#c#.e.', '....i....', '.e.#c#.e.', '.........', '.#######.', '.........'],
  ['.........', '.e.....e.', '.........', '.^^^.^^^.', '....s....', '.^^^.^^^.', '.........', '.e..i..e.', '.........'],
  ['.........', '.h.....c.', '.........', '..#.e.#..', '....i....', '..#.e.#..', '.........', '.c.....h.', '.........'],
  ['.........', '..c...c..', '.........', '.oo.e.oo.', '.o..i..o.', '.oo.e.oo.', '.........', '..c...c..', '.........'],
  ['.........', '.e.#.#.e.', '...#.#...', '.###.###.', '....i....', '.###.###.', '...#.#...', '.e.#.#.e.', '.........'],
  ['.........', '.v.....v.', '..e.b.e..', '.........', '.b..i..b.', '.........', '..e.b.e..', '.v..s..v.', '.........'],
  ['.........', '....#....', '...#e#...', '..#...#..', '.#e.i.e#.', '..#...#..', '...#.#...', '....e....', '.........'],
  ['.........', '.h.o.o.h.', '.........', '.o.e.e.o.', '....i....', '.o.e.e.o.', '.........', '.c.o.o.c.', '.........'],
  ['.........', '.e.....e.', '..v.^.v..', '...c.c...', '..^.i.^..', '...c.c...', '..v.^.v..', '.e..s..e.', '.........'],
];
const START_ROOM = ['.........', '.........', '..c...c..', '.........', '.........', '.........', '..c...c..', '.........', '.........'];
/** Boss arenas, nineteen by nineteen over four room slots. B is where the boss waits. */
export const ARENAS: string[][] = [
  [
    '...................',
    '...................',
    '..#.....v.v.....#..',
    '...................',
    '....oo.......oo....',
    '....o.........o....',
    '..v.............v..',
    '.........c.........',
    '........#.#........',
    '..v......B......v..',
    '........#.#........',
    '...................',
    '..v.............v..',
    '....o.........o....',
    '....oo.......oo....',
    '...................',
    '..#.....v.v.....#..',
    '..s.............s..',
    '...................',
  ],
  [
    '...................',
    '...................',
    '..^^^.........^^^..',
    '..^.............^..',
    '..^...#.....#...^..',
    '...................',
    '.......c...c.......',
    '....b.........b....',
    '...................',
    '.........B.........',
    '...................',
    '....b.........b....',
    '.......c...c.......',
    '...................',
    '..^...#.....#...^..',
    '..^......s......^..',
    '..^^^.........^^^..',
    '...................',
    '...................',
  ],
  [
    '...................',
    '...................',
    '...oo.........oo...',
    '...o...........o...',
    '.......#...#.......',
    '...................',
    '.....vvv...vvv.....',
    '.......c...c.......',
    '...................',
    '...#.....B.....#...',
    '...................',
    '.......c...c.......',
    '.....vvv...vvv.....',
    '...................',
    '.......#...#.......',
    '...o.....s.....o...',
    '...oo.........oo...',
    '...................',
    '...................',
  ],
];

export function transform(t: string[], rot: number, flip: boolean): string[] {
  let g = t.map((r) => r.split(''));
  if (flip) g = g.map((r) => r.reverse());
  for (let k = 0; k < rot; k++) { const o = g; g = o[0].map((_, x) => o.map((r) => r[x]).reverse()); }
  return g.map((r) => r.join(''));
}

export type Ev = { k: string; x: number; y: number; id?: number; d?: number; n?: number; kind?: Kind; tx?: number; ty?: number; text?: string };
export type Door = { at: number; a: number; b: number };
export type Stats = { tidied: number; hurt: number; toolsUsed: number; turns: number; kinds: Partial<Record<Kind, number>> };

const ACTION = /^(?:[URDLW]|T[1-5][URDL]?|X[URDL]|P[0-2])$/;

export class DungeonGame {
  floor = 1;
  state: 'play' | 'perk' | 'won' | 'lost' = 'play';
  tiles = new Uint8Array(W * H);
  seen = new Uint8Array(W * H);
  crates = new Uint8Array(W * H);
  /** Which room each of the nine slots belongs to (a boss arena spans four). */
  roomOf: number[] = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  roomSeen: boolean[] = [];
  doors: Door[] = [];
  items = new Map<number, Item>();
  clouds = new Map<number, number>();
  enemies: Enemy[] = [];
  nextId = 1;
  px = 0; py = 0; hp: number; max: number; face: Dir = 2; side: 1 | -1 = 1;
  dashes = 0; keys = 0; lit = false;
  tools: Record<Tool, number> = { duster: 0, sling: 2, soap: 0, lantern: 0, acorn: 1 };
  perks: Perk[] = [];
  windUsed = false;
  perkChoices: Perk[] = [];
  turn = 0;
  floorTurns = 0;
  stairs = -1; startRoom = 0; stairsRoom = 0; treasure = -1; arena = -1;
  log: string[] = [];
  events: Ev[] = [];
  msgs: string[] = [];
  stats: Stats = { tidied: 0, hurt: 0, toolsUsed: 0, turns: 0, kinds: {} };
  rng = new Rng(1);
  private gusting = false;

  constructor(public seed: number, public char: Char = 'dora', public mode: Mode = 'run', public day = '') {
    this.seed = seed >>> 0;
    this.hp = this.max = CHARS[char].hp;
    this.build();
  }

  // ---------------------------------------------------------------- helpers
  idx(x: number, y: number) { return y * W + x; }
  inb(x: number, y: number) { return x >= 0 && y >= 0 && x < W && y < H; }
  tile(x: number, y: number) { return this.inb(x, y) ? this.tiles[y * W + x] : WALL; }
  get area() { return areaOf(this.floor); }
  get bossFloor() { return !!BOSS[this.floor]; }
  get pi() { return this.py * W + this.px; }
  toolMax() { return TOOL_MAX + (this.perks.includes('pockets') ? 1 : 0); }
  enemyAt(i: number) { for (const e of this.enemies) if (!e.under && e.y * W + e.x === i) return e; return undefined; }
  /** Rooms a tile belongs to: one for a room's inside, two for a doorway in the wall between them. */
  roomsAt(x: number, y: number): number[] {
    const cs = x % SLOT === 0 ? [x / SLOT - 1, x / SLOT] : [Math.floor(x / SLOT)], rs = y % SLOT === 0 ? [y / SLOT - 1, y / SLOT] : [Math.floor(y / SLOT)];
    const out: number[] = [];
    for (const r of rs) for (const c of cs) if (r >= 0 && r < 3 && c >= 0 && c < 3) { const id = this.roomOf[r * 3 + c]; if (!out.includes(id)) out.push(id); }
    return out;
  }
  private say(m: string) { this.msgs.push(m); if (this.msgs.length > 40) this.msgs.splice(0, this.msgs.length - 40); }
  private ev(e: Ev) { this.events.push(e); }
  /** Free for an enemy (or a crate) to move into. */
  private freeFor(i: number) { return walkable(this.tiles[i]) && !this.crates[i] && !this.enemyAt(i) && i !== this.pi; }
  private minions() { return this.enemies.filter((e) => e.minion).length; }

  // ---------------------------------------------------------------- floor generation
  private build(attempt = 0): void {
    const f = this.floor, r = new Rng(hash(this.seed, f, attempt, 77)), boss = BOSS[f];
    this.tiles.fill(WALL); this.seen.fill(0); this.crates.fill(0);
    this.items.clear(); this.clouds.clear(); this.enemies = []; this.doors = [];
    this.roomOf = [0, 1, 2, 3, 4, 5, 6, 7, 8]; this.arena = -1; this.treasure = -1; this.stairs = -1;
    let ac = 0, ar = 0;
    if (boss) {
      ac = r.int(2); ar = r.int(2); this.arena = ar * 3 + ac;
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) this.roomOf[(ar + dy) * 3 + ac + dx] = this.arena;
    }
    const ids = [...new Set(this.roomOf)];
    this.roomSeen = Array(9).fill(false);
    const startSlot = boss ? (ar === 0 ? 2 : 0) * 3 + (ac === 0 ? 2 : 0) : r.int(9);
    this.startRoom = this.roomOf[startSlot];
    const espots = new Map<number, number[]>(), ispots = new Map<number, number[]>(), hspots = new Map<number, number[]>();
    let bossSpot = -1;
    for (const id of ids) { espots.set(id, []); ispots.set(id, []); hspots.set(id, []); }
    const carve = (tpl: string[], ox: number, oy: number, room: number) => {
      for (let y = 0; y < tpl.length; y++) for (let x = 0; x < tpl.length; x++) {
        const ch = tpl[y][x], i = this.idx(ox + x, oy + y);
        this.tiles[i] = ch === '#' ? WALL : ch === 'o' ? PIT : ch === '^' ? SPIKE : ch === 'v' ? LOWERED : ch === 's' ? SWITCH : ch === 'b' ? BELLOWS : FLOOR;
        if (ch === 'c') this.crates[i] = 1;
        else if (ch === 'e') espots.get(room)!.push(i);
        else if (ch === 'i') ispots.get(room)!.push(i);
        else if (ch === 'h') hspots.get(room)!.push(i);
        else if (ch === 'B') bossSpot = i;
      }
    };
    for (let s = 0; s < 9; s++) {
      if (this.roomOf[s] === this.arena) continue;
      const c = s % 3, rw = Math.floor(s / 3);
      carve(s === startSlot ? START_ROOM : transform(r.pick(ROOMS), r.int(4), r.next() < 0.5), 1 + SLOT * c, 1 + SLOT * rw, this.roomOf[s]);
    }
    if (boss) carve(transform(r.pick(ARENAS), r.int(4), r.next() < 0.5), 1 + SLOT * ac, 1 + SLOT * ar, this.arena);

    // join the rooms: a random spanning tree over neighbouring slots, plus a few loops
    const pairs: [number, number][] = [];
    for (let s = 0; s < 9; s++) {
      if (s % 3 < 2 && this.roomOf[s] !== this.roomOf[s + 1]) pairs.push([s, s + 1]);
      if (s < 6 && this.roomOf[s] !== this.roomOf[s + 3]) pairs.push([s, s + 3]);
    }
    r.shuffle(pairs);
    const parent = new Map<number, number>(ids.map((id) => [id, id]));
    const find = (a: number): number => { while (parent.get(a) !== a) a = parent.get(a)!; return a; };
    const linked = new Set<string>(), edges: [number, number][] = [];
    const key = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);
    for (const [s, t] of pairs) {
      const a = this.roomOf[s], b = this.roomOf[t];
      if (find(a) !== find(b)) { parent.set(find(a), find(b)); linked.add(key(a, b)); edges.push([s, t]); }
    }
    for (const [s, t] of pairs) {
      const a = this.roomOf[s], b = this.roomOf[t];
      if (!linked.has(key(a, b)) && r.next() < 0.3) { linked.add(key(a, b)); edges.push([s, t]); }
    }
    for (const [s, t] of edges) {
      const c = s % 3, rw = Math.floor(s / 3);
      const i = t === s + 1 ? this.idx(SLOT * (c + 1), 1 + SLOT * rw + 2 + r.int(5)) : this.idx(1 + SLOT * c + 2 + r.int(5), SLOT * (rw + 1));
      this.tiles[i] = DOOR; this.doors.push({ at: i, a: this.roomOf[s], b: this.roomOf[t] });
    }
    const nbrs = (id: number) => this.doors.filter((d) => d.a === id || d.b === id).map((d) => (d.a === id ? d.b : d.a));
    // the stairs go in the room farthest from the start
    const depth = new Map<number, number>([[this.startRoom, 0]]), queue = [this.startRoom];
    while (queue.length) { const a = queue.shift()!; for (const b of nbrs(a)) if (!depth.has(b)) { depth.set(b, depth.get(a)! + 1); queue.push(b); } }
    const far = Math.max(...depth.values());
    this.stairsRoom = boss ? this.arena : r.pick(ids.filter((id) => depth.get(id) === far));
    const roomTiles = (id: number) => {
      const out: number[] = [];
      for (let s = 0; s < 9; s++) if (this.roomOf[s] === id) {
        const c = s % 3, rw = Math.floor(s / 3);
        for (let y = 1 + SLOT * rw; y <= SLOT * rw + ROOM; y++) for (let x = 1 + SLOT * c; x <= SLOT * c + ROOM; x++) out.push(this.idx(x, y));
      }
      if (id === this.arena) for (let y = 1 + SLOT * ar; y <= SLOT * ar + 19; y++) for (let x = 1 + SLOT * ac; x <= SLOT * ac + 19; x++) { const i = this.idx(x, y); if (!out.includes(i)) out.push(i); }
      return out;
    };
    const centre = (id: number) => {
      const t = roomTiles(id), cx = t.reduce((a, i) => a + (i % W), 0) / t.length, cy = t.reduce((a, i) => a + Math.floor(i / W), 0) / t.length;
      return t.filter((i) => this.tiles[i] === FLOOR && !this.crates[i]).sort((a, b) => Math.hypot(a % W - cx, Math.floor(a / W) - cy) - Math.hypot(b % W - cx, Math.floor(b / W) - cy) || a - b);
    };
    const nearDoor = (i: number) => this.doors.some((d) => Math.abs((d.at % W) - (i % W)) + Math.abs(Math.floor(d.at / W) - Math.floor(i / W)) < 3);
    const taken = new Set<number>();
    const open4 = (i: number) => [0, 1, 2, 3].every((d) => { const t = this.tiles[i + DY[d] * W + DX[d]]; return t !== SPIKE && t !== LOWERED; });
    if (!boss) { this.stairs = centre(this.stairsRoom).filter(open4)[0] ?? centre(this.stairsRoom)[0]; this.tiles[this.stairs] = STAIRS; taken.add(this.stairs); }

    // a locked treasure room on some floors: a dead end with a chest, and its key somewhere else
    if (!boss && r.next() < 0.55) {
      const leaves = ids.filter((id) => id !== this.startRoom && id !== this.stairsRoom && nbrs(id).length === 1);
      if (leaves.length) {
        this.treasure = r.pick(leaves);
        const door = this.doors.find((d) => d.a === this.treasure || d.b === this.treasure)!;
        this.tiles[door.at] = LOCKED;
        const chest = centre(this.treasure)[0]; this.tiles[chest] = CHEST; taken.add(chest);
        const rooms = ids.filter((id) => id !== this.treasure && id !== this.startRoom);
        const kr = r.pick(rooms), spots = [...ispots.get(kr)!, ...centre(kr)].filter((i) => !taken.has(i) && this.tiles[i] === FLOOR && !this.crates[i]);
        if (spots.length) { this.items.set(spots[0], 'key'); taken.add(spots[0]); }
      }
    }

    // enemies
    const a = areaOf(f), k = (f - 1) % 4;
    const pool = AREAS[a].pool.filter(([kind]) => !(kind === 'roller' && f < 2));
    const total = pool.reduce((s, [, w]) => s + w, 0);
    const pickKind = (): Kind => { let x = r.next() * total; for (const [kind, w] of pool) { x -= w; if (x < 0) return kind; } return pool[0][0]; };
    for (const id of ids) {
      if (id === this.startRoom || id === this.treasure) continue;
      if (id === this.arena) { this.spawn(BOSS[f], bossSpot >= 0 ? bossSpot : centre(id)[0], false); taken.add(bossSpot); continue; }
      for (const h of hspots.get(id)!) {
        if (pool.some(([kind]) => kind === 'mimic') && r.next() < 0.5) { this.spawn('mimic', h, false); taken.add(h); } else this.crates[h] = 1;
      }
      const n = 1 + (k >= 2 ? 1 : 0) + a + (r.next() < 0.35 + 0.1 * k ? 1 : 0);
      const spots = [...r.shuffle([...espots.get(id)!]), ...r.shuffle(roomTiles(id))].filter((i) => this.tiles[i] === FLOOR && !this.crates[i] && !nearDoor(i));
      let placed = 0;
      for (const i of spots) { if (placed >= n) break; if (taken.has(i)) continue; this.spawn(pickKind(), i, false); taken.add(i); placed++; }
    }
    // tools lying about
    const toolBag: Tool[] = ['duster', 'duster', 'sling', 'sling', 'soap', 'soap', 'acorn', 'acorn', 'acorn', 'lantern'];
    const nItems = 2 + (r.next() < 0.5 ? 1 : 0), itemRooms = ids.filter((id) => id !== this.startRoom && id !== this.treasure);
    for (let n = 0; n < nItems; n++) {
      const id = r.pick(itemRooms), spots = [...ispots.get(id)!, ...r.shuffle(roomTiles(id))].filter((i) => this.tiles[i] === FLOOR && !this.crates[i] && !taken.has(i));
      if (spots.length) { this.items.set(spots[0], r.pick(toolBag)); taken.add(spots[0]); }
    }

    const start = centre(this.startRoom)[0];
    if (!this.solvable(start) && attempt < 40) return this.build(attempt + 1);
    this.px = start % W; this.py = Math.floor(start / W);
    this.rng = new Rng(hash(this.seed, f, 991));
    this.dashes = CHARS[this.char].dash + (this.perks.includes('dash') ? 1 : 0);
    this.keys = 0;
    this.lit = this.perks.includes('nose');
    this.reveal();
    if (this.lit) this.light();
    this.planAll();
  }
  spawn(kind: Kind, i: number, minion: boolean) {
    const K = KINDS[kind];
    const e: Enemy = { id: this.nextId++, kind, x: i % W, y: Math.floor(i / W), hp: K.hp, max: K.hp, awake: false, fresh: false, dizzy: false, under: false, hidden: kind === 'mimic', known: false, t: 0, wait: 0, minion, intent: NO_INTENT() };
    this.enemies.push(e);
    return e;
  }
  /** Every doorway, the stairs (or the boss) and the key can be reached from the start; crates count as open (they can always be pushed or broken). */
  solvable(start = this.pi) {
    const seen = new Uint8Array(W * H), q = [start]; seen[start] = 1;
    while (q.length) {
      const i = q.pop()!;
      for (let d = 0; d < 4; d++) {
        const x = (i % W) + DX[d], y = Math.floor(i / W) + DY[d], j = y * W + x;
        if (!this.inb(x, y) || seen[j]) continue;
        if (walkable(this.tiles[j]) || this.crates[j]) { seen[j] = 1; q.push(j); }
      }
    }
    const need = this.doors.filter((d) => this.tiles[d.at] === DOOR).map((d) => d.at);
    if (this.stairs >= 0) need.push(this.stairs);
    for (const [i, it] of this.items) if (it === 'key') need.push(i);
    for (const e of this.enemies) if (KINDS[e.kind].boss) need.push(e.y * W + e.x);
    const locked = this.doors.find((d) => this.tiles[d.at] === LOCKED);
    if (locked) { const x = locked.at % W, y = Math.floor(locked.at / W); if (![0, 1, 2, 3].some((d) => seen[(y + DY[d]) * W + x + DX[d]])) return false; }
    return need.every((i) => seen[i]);
  }
  private reveal() {
    for (const id of this.roomsAt(this.px, this.py)) {
      if (this.roomSeen[id] && this.seen[this.pi]) continue;
      this.roomSeen[id] = true;
      for (let s = 0; s < 9; s++) if (this.roomOf[s] === id) {
        const c = s % 3, rw = Math.floor(s / 3);
        for (let y = SLOT * rw; y <= SLOT * rw + SLOT; y++) for (let x = SLOT * c; x <= SLOT * c + SLOT; x++) this.seen[y * W + x] = 1;
      }
    }
  }
  private light() {
    this.lit = true; this.seen.fill(1); this.roomSeen = this.roomSeen.map(() => true);
    for (const e of this.enemies) if (e.kind === 'mimic' || e.kind === 'burrower') e.known = true;
  }

  // ---------------------------------------------------------------- turns
  /** Plays one action: U R D L (move or bop), W (wait), T<1-5>[dir] (a tool), X<dir> (dash), P<0-2> (a perk). False if it can't be done. */
  act(a: string): boolean {
    if (!ACTION.test(a)) return false;
    if (this.state === 'perk') {
      if (a[0] !== 'P') return false;
      const p = this.perkChoices[+a[1]]; if (!p) return false;
      this.log.push(a); this.takePerk(p); this.nextFloor();
      return true;
    }
    if (this.state !== 'play' || a[0] === 'P') return false;
    const r = this.player(a);
    if (r === false) return false;
    this.log.push(a);
    this.stats.turns++; this.turn++; this.floorTurns++;
    if (r === 'stairs') { this.descend(); return true; }
    if (this.state === 'play') this.enemyPhase();
    return true;
  }
  /** The player's half of the turn. */
  private player(a: string): boolean | 'stairs' {
    const c = a[0];
    if (c === 'W') { this.ev({ k: 'wait', x: this.px, y: this.py }); return true; }
    if (c === 'X') return this.dash(DIRS.indexOf(a[1]) as Dir);
    if (c === 'T') return this.useTool(TOOLS[+a[1] - 1], a[2] ? (DIRS.indexOf(a[2]) as Dir) : null);
    return this.step(DIRS.indexOf(c) as Dir);
  }
  private step(d: Dir): boolean | 'stairs' {
    this.face = d; if (DX[d]) this.side = DX[d] > 0 ? 1 : -1;
    const x = this.px + DX[d], y = this.py + DY[d], i = this.idx(x, y), t = this.tile(x, y);
    const e = this.enemyAt(i);
    if (e) { this.broom(e, d); return true; }
    if (this.crates[i]) { this.shove(i, d); return true; }
    if (t === LOCKED) {
      if (!this.keys) { this.say('Locked tight. The key is somewhere on this floor.'); this.ev({ k: 'locked', x, y }); return false; }
      this.keys--; this.tiles[i] = DOOR; this.say('Click! The little door swings open.'); this.ev({ k: 'unlock', x, y }); return true;
    }
    if (t === CHEST) { this.openChest(i); return true; }
    if (!walkable(t)) return false;
    return this.enter(x, y);
  }
  /** The player arrives on a tile: pick things up, flip switches, puff bellows, find the stairs. */
  private enter(x: number, y: number, pushed = false): boolean | 'stairs' {
    const from = this.pi;
    this.px = x; this.py = y; const i = this.pi;
    this.ev({ k: pushed ? 'pushed' : 'move', x, y, tx: from % W, ty: Math.floor(from / W) });
    this.reveal();
    const it = this.items.get(i);
    if (it) this.pickUp(i, it);
    const t = this.tiles[i];
    if (t === SWITCH) this.flip();
    else if (t === BELLOWS) this.gust(i);
    if (t === STAIRS && !pushed) return 'stairs';
    return true;
  }
  private pickUp(i: number, it: Item) {
    const x = i % W, y = Math.floor(i / W);
    if (it === 'key') { this.keys++; this.say('You found a little brass key!'); }
    else if (it === 'heart') { this.max = Math.min(MAX_HP, this.max + 1); this.hp = Math.min(this.max, this.hp + 1); this.say('A heart charm! One more heart to fill.'); }
    else {
      if (this.tools[it] >= this.toolMax()) { this.say(`Your pockets are full of ${TOOL_INFO[it].name.toLowerCase()}s.`); return; }
      this.tools[it]++; this.say(`Picked up: ${TOOL_INFO[it].name}.`);
    }
    this.items.delete(i); this.ev({ k: 'pick', x, y, text: it });
  }
  private openChest(i: number) {
    this.tiles[i] = FLOOR;
    const loot: (Tool | 'heart')[] = [this.rng.pick(['duster', 'soap', 'sling'] as Tool[]), this.rng.pick(['acorn', 'lantern', 'duster'] as Tool[])];
    if (this.rng.next() < 0.35 && this.max < MAX_HP) loot.push('heart');
    for (const it of loot) {
      if (it === 'heart') { this.max++; this.hp++; }
      else this.tools[it] = Math.min(this.toolMax(), this.tools[it] + 1);
    }
    this.say(`The chest creaks open: ${loot.map((l) => (l === 'heart' ? 'a heart charm' : TOOL_INFO[l].name)).join(', ')}!`);
    this.ev({ k: 'chest', x: i % W, y: Math.floor(i / W), text: loot.join(',') });
  }
  /** Pushing a crate: it slides one tile, fills a pit, shoves an enemy, or crumbles if it can't move. */
  private shove(i: number, d: Dir) {
    const x = i % W + DX[d], y = Math.floor(i / W) + DY[d], j = this.idx(x, y), t = this.tile(x, y), e = this.enemyAt(j);
    this.ev({ k: 'crate', x: i % W, y: Math.floor(i / W), d });
    if (e) { this.hurt(e, 1, 'crate', true); return; }
    if (t === PIT) { this.crates[i] = 0; this.tiles[j] = FLOOR; this.say('The crate tumbles into the pit and fills it.'); this.ev({ k: 'fill', x, y }); this.enter(i % W, Math.floor(i / W)); return; }
    if (this.inb(x, y) && walkable(t) && t !== STAIRS && !this.crates[j] && !this.items.has(j)) {
      this.crates[i] = 0; this.crates[j] = 1; this.enter(i % W, Math.floor(i / W));
      if (t === SWITCH) this.flip(); else if (t === BELLOWS) this.gust(j);
      return;
    }
    this.crates[i] = 0; this.say('The old crate falls apart.'); this.ev({ k: 'crumble', x: i % W, y: Math.floor(i / W) });
  }
  /** Raising or lowering every prickle trap on the floor. Anything on a rising prickle is poofed. */
  private flip() {
    let up = false;
    for (let i = 0; i < W * H; i++) {
      if (this.tiles[i] === SPIKE) this.tiles[i] = LOWERED;
      else if (this.tiles[i] === LOWERED) { this.tiles[i] = SPIKE; up = true; this.crates[i] = 0; const e = this.enemyAt(i); if (e) this.poof(e, 'prickles'); }
    }
    this.say(up ? 'Clunk! The prickle traps spring up.' : 'Clunk! The prickle traps sink down.');
    this.ev({ k: 'spikes', x: this.px, y: this.py, n: up ? 1 : 0 });
  }
  /** A bellows plate puffs: everything on the four tiles around it is pushed one tile away. The player holds tight. */
  private gust(i: number) {
    if (this.gusting) return;
    this.gusting = true;
    const x = i % W, y = Math.floor(i / W);
    this.ev({ k: 'gust', x, y });
    for (let d = 0; d < 4; d++) {
      const j = this.idx(x + DX[d], y + DY[d]), e = this.enemyAt(j);
      if (e) this.knock(e, d as Dir, 1);
      else if (this.crates[j]) this.slideCrate(j, d as Dir);
    }
    this.gusting = false;
  }
  private slideCrate(i: number, d: Dir) {
    const x = i % W + DX[d], y = Math.floor(i / W) + DY[d], j = this.idx(x, y), t = this.tile(x, y);
    if (t === PIT) { this.crates[i] = 0; this.tiles[j] = FLOOR; this.ev({ k: 'fill', x, y }); return true; }
    if (this.inb(x, y) && walkable(t) && t !== STAIRS && !this.crates[j] && !this.enemyAt(j) && j !== this.pi && !this.items.has(j)) { this.crates[i] = 0; this.crates[j] = 1; this.ev({ k: 'crate', x: i % W, y: Math.floor(i / W), d }); return true; }
    return false;
  }
  private broom(e: Enemy, d: Dir) {
    this.ev({ k: 'swing', x: this.px, y: this.py, d, id: e.id });
    if (e.hidden) { e.hidden = false; e.awake = true; this.say('That hay bale was a Bale Mimic!'); this.ev({ k: 'surprise', x: e.x, y: e.y, id: e.id }); }
    const behind = this.perks.includes('long') ? this.enemyAt(this.idx(e.x + DX[d], e.y + DY[d])) : undefined;
    this.hurt(e, 1, 'broom');
    if (behind && this.enemies.includes(behind)) this.hurt(behind, 1, 'broom');
    if (this.enemies.includes(e)) this.knock(e, d, this.perks.includes('push') ? 2 : 1);
  }
  private dash(d: Dir): boolean | 'stairs' {
    if (this.dashes <= 0) return false;
    this.face = d; if (DX[d]) this.side = DX[d] > 0 ? 1 : -1;
    let moved = 0, target: Enemy | undefined;
    for (let s = 0; s < 3; s++) {
      const x = this.px + DX[d], y = this.py + DY[d], i = this.idx(x, y);
      target = this.enemyAt(i);
      if (target || this.crates[i] || !walkable(this.tile(x, y))) break;
      this.enter(x, y, true); moved++;
      if (this.tiles[i] === STAIRS) break;
    }
    if (!moved && !target) return false;
    this.dashes--; this.ev({ k: 'dash', x: this.px, y: this.py, d });
    if (this.tiles[this.pi] === STAIRS) return 'stairs';
    if (target) this.broom(target, d);
    return true;
  }
  private useTool(tool: Tool | undefined, d: Dir | null): boolean {
    if (!tool || this.tools[tool] <= 0) return false;
    const info = TOOL_INFO[tool];
    if (info.aim && d === null) return false;
    if (!info.aim && d !== null) return false;
    if (d !== null) { this.face = d; if (DX[d]) this.side = DX[d] > 0 ? 1 : -1; }
    const P = { x: this.px, y: this.py };
    if (tool === 'acorn') {
      if (this.hp >= this.max) return false;
      this.hp = Math.min(this.max, this.hp + 1 + (this.perks.includes('acorns') ? 1 : 0)); this.ev({ k: 'heal', x: P.x, y: P.y }); this.say('Crunch! You feel much better.');
    } else if (tool === 'lantern') {
      if (this.lit) return false;
      this.light(); this.ev({ k: 'lantern', x: P.x, y: P.y }); this.say('The lantern lights up the whole floor.');
    } else if (tool === 'duster') {
      const f = { x: P.x + DX[d!], y: P.y + DY[d!] }, side = (d! + 1) % 4;
      this.ev({ k: 'duster', x: P.x, y: P.y, d: d! });
      for (const k of [0, 1, -1]) {
        const e = this.enemyAt(this.idx(f.x + DX[side] * k, f.y + DY[side] * k));
        if (e) { if (e.hidden) { e.hidden = false; e.awake = true; } this.hurt(e, 1, 'duster'); if (this.enemies.includes(e)) this.knock(e, d!, 1); }
      }
    } else if (tool === 'sling') {
      let x = P.x, y = P.y, hit: Enemy | undefined;
      for (let s = 0; s < 7; s++) {
        x += DX[d!]; y += DY[d!]; const i = this.idx(x, y), t = this.tile(x, y);
        if (solid(t) || this.crates[i]) break;
        hit = this.enemyAt(i); if (hit) break;
      }
      this.ev({ k: 'shot', x: P.x, y: P.y, tx: x, ty: y, d: d! });
      if (hit) { if (hit.hidden) { hit.hidden = false; hit.awake = true; } this.hurt(hit, this.perks.includes('sharp') ? 2 : 1, 'sling'); if (this.enemies.includes(hit)) this.knock(hit, d!, 1); }
    } else if (tool === 'soap') {
      const line: number[] = [];
      let x = P.x, y = P.y;
      for (let s = 0; s < 5; s++) { x += DX[d!]; y += DY[d!]; if (solid(this.tile(x, y))) break; line.push(this.idx(x, y)); }
      this.ev({ k: 'soap', x: P.x, y: P.y, d: d!, n: line.length });
      for (let k = line.length - 1; k >= 0; k--) {
        const e = this.enemyAt(line[k]);
        if (e) { if (e.hidden) { e.hidden = false; e.awake = true; } this.knock(e, d!, 2); }
        else if (this.crates[line[k]]) { if (this.slideCrate(line[k], d!)) { const n = line[k] + DY[d!] * W + DX[d!]; if (this.crates[n]) this.slideCrate(n, d!); } }
      }
    }
    this.tools[tool]--; this.stats.toolsUsed++;
    return true;
  }

  // ---------------------------------------------------------------- bops, pushes and poofs
  /** An enemy takes `n`; a boss splits or shrugs, anything else goes dizzy and forgets its plan. */
  hurt(e: Enemy, n: number, cause: string, stun = false) {
    if (e.under || !this.enemies.includes(e)) return;
    if (e.hidden) { e.hidden = false; e.awake = true; }
    e.awake = true;
    e.hp -= n;
    this.ev({ k: 'hit', x: e.x, y: e.y, id: e.id, n, text: cause });
    if (e.hp <= 0) { this.poof(e, cause); return; }
    // bumping into something makes anything but a boss dizzy: it forgets its plan and misses its next turn
    if (stun && !KINDS[e.kind].heavy) { e.dizzy = true; e.intent = NO_INTENT(); }
    if (e.kind === 'bigbun' && this.minions() < 4) {
      for (let d = 0; d < 4; d++) {
        const j = this.idx(e.x + DX[d], e.y + DY[d]);
        if (this.freeFor(j)) { const m = this.spawn('fluff', j, true); m.awake = true; m.dizzy = true; this.ev({ k: 'split', x: m.x, y: m.y, id: m.id, tx: e.x, ty: e.y }); break; }
      }
    }
  }
  /** Knocks an enemy `n` tiles: into a pit or prickles it poofs, into a wall it bonks, into a friend both bonk and the friend slides on. */
  knock(e: Enemy, d: Dir, n: number) {
    if (KINDS[e.kind].heavy || e.under) return;
    for (let k = 0; k < n; k++) {
      if (!this.enemies.includes(e)) return;
      const x = e.x + DX[d], y = e.y + DY[d], j = this.idx(x, y), t = this.tile(x, y);
      if (t === PIT || t === SPIKE) { const from = { x: e.x, y: e.y }; e.x = x; e.y = y; this.ev({ k: 'slide', x, y, id: e.id, tx: from.x, ty: from.y }); this.poof(e, t === PIT ? 'pit' : 'prickles'); return; }
      if (!this.inb(x, y) || solid(t) || !walkable(t)) { this.ev({ k: 'bonk', x: e.x, y: e.y, d, id: e.id }); this.hurt(e, 1, 'wall', true); return; }
      if (this.crates[j]) { this.ev({ k: 'bonk', x: e.x, y: e.y, d, id: e.id }); this.crates[j] = 0; this.ev({ k: 'crumble', x, y }); this.hurt(e, 1, 'crate', true); return; }
      const o = this.enemyAt(j);
      if (o) { this.ev({ k: 'bonk', x: e.x, y: e.y, d, id: e.id }); this.hurt(e, 1, 'bump', true); this.hurt(o, 1, 'bump', true); if (this.enemies.includes(o)) this.knock(o, d, 1); return; }
      if (j === this.pi) { this.ev({ k: 'bonk', x: e.x, y: e.y, d, id: e.id }); this.hurt(e, 1, 'bump', true); return; }
      const from = { x: e.x, y: e.y }; e.x = x; e.y = y; this.shift(e, DX[d], DY[d]);
      this.ev({ k: 'slide', x, y, id: e.id, tx: from.x, ty: from.y });
      if (t === BELLOWS) this.gust(j);
    }
  }
  /** A knocked-back enemy's marks move with it (a puff stays aimed where it was); a walk it had planned is off. */
  private shift(e: Enemy, dx: number, dy: number) {
    const it = e.intent;
    if (it.kind === 'move' || it.kind === 'tunnel') { e.intent = { kind: 'rest', to: -1, tiles: [], dir: -1 }; return; }
    if (it.kind === 'puff' || it.kind === 'none' || it.kind === 'rest') return;
    const m = (i: number) => { const x = i % W + dx, y = Math.floor(i / W) + dy; return this.inb(x, y) ? this.idx(x, y) : -1; };
    it.tiles = it.tiles.map(m).filter((i) => i >= 0);
    if (it.to >= 0) it.to = m(it.to);
  }
  poof(e: Enemy, cause: string) {
    const at = this.enemies.indexOf(e); if (at < 0) return;
    this.enemies.splice(at, 1);
    this.stats.tidied++; this.stats.kinds[e.kind] = (this.stats.kinds[e.kind] ?? 0) + 1;
    this.ev({ k: 'poof', x: e.x, y: e.y, id: e.id, kind: e.kind, text: cause });
    if (KINDS[e.kind].boss) {
      for (const m of [...this.enemies]) if (m.minion) this.poof(m, 'calm');
      if (e.kind === 'king') {
        this.state = 'won'; this.say('The Dust King is tidied away! The cellars are spotless.'); this.ev({ k: 'win', x: e.x, y: e.y });
      } else {
        const at2 = this.idx(e.x, e.y);
        this.tiles[at2] = STAIRS; this.stairs = at2; this.crates[at2] = 0;
        this.say(`The ${KINDS[e.kind].name} is tidied away! Stairs lead on down.`); this.ev({ k: 'stairsopen', x: e.x, y: e.y });
      }
    } else if (!e.minion && this.rng.next() < 0.12) {
      const i = this.idx(e.x, e.y);
      if (this.tiles[i] !== STAIRS && walkable(this.tiles[i]) && !this.items.has(i)) this.items.set(i, this.rng.pick(['acorn', 'sling', 'duster'] as Tool[]));
    }
  }
  private hurtPlayer(n: number, by: Enemy | null, cause: string) {
    if (this.state !== 'play') return;
    this.hp -= n; this.stats.hurt += n;
    this.ev({ k: 'hurt', x: this.px, y: this.py, n, text: cause, id: by?.id });
    if (by && this.perks.includes('bristle') && !by.under && Math.abs(by.x - this.px) + Math.abs(by.y - this.py) === 1) this.hurt(by, 1, 'prickly');
    if (this.hp <= 0) {
      if (this.perks.includes('wind') && !this.windUsed) { this.windUsed = true; this.hp = 2; this.say('Second Wind! You bounce right back up.'); this.ev({ k: 'wind', x: this.px, y: this.py }); }
      else { this.hp = 0; this.state = 'lost'; this.say('Too dusty to go on. Time for a nap and a fresh start.'); this.ev({ k: 'lose', x: this.px, y: this.py }); }
    }
  }
  /** The player gets sneezed one tile; a wall (or anything solid) in the way is a bonk. */
  private pushPlayer(d: Dir, by: Enemy) {
    const x = this.px + DX[d], y = this.py + DY[d], i = this.idx(x, y);
    if (this.inb(x, y) && walkable(this.tiles[i]) && !this.enemyAt(i) && !this.crates[i]) { this.enter(x, y, true); return; }
    this.hurtPlayer(1, by, 'sneeze');
  }

  // ---------------------------------------------------------------- the enemies' half of the turn
  private enemyPhase() {
    const pr = this.roomsAt(this.px, this.py);
    for (const e of this.enemies) {
      e.fresh = false;
      if (e.awake) continue;
      const near = Math.abs(e.x - this.px) + Math.abs(e.y - this.py);
      if (e.hidden) { if (near === 1) { e.hidden = false; e.awake = true; e.fresh = true; this.say('A hay bale wakes up: a Bale Mimic!'); this.ev({ k: 'surprise', x: e.x, y: e.y, id: e.id }); } continue; }
      if (this.seen[e.y * W + e.x] && (near <= 3 || this.roomsAt(e.x, e.y).some((r) => pr.includes(r)))) { e.awake = true; e.fresh = true; this.ev({ k: 'wake', x: e.x, y: e.y, id: e.id }); }
    }
    for (const e of [...this.enemies]) {
      if (this.state !== 'play') break;
      if (!this.enemies.includes(e) || !e.awake || e.fresh) continue;
      if (e.dizzy) { e.dizzy = false; continue; }
      this.perform(e);
    }
    // linger too long and the dust gets thick: a new dust bunny tumbles out every few turns
    if (this.state === 'play' && !this.bossFloor && this.floorTurns > DUST_CALM && (this.floorTurns - DUST_CALM) % DUST_EVERY === 1) this.dustBunny();
    // clouds made on earlier turns make you cough, then thin out
    if (this.state === 'play') {
      const old = [...this.clouds].filter(([, life]) => life < 3);
      if (old.some(([i]) => i === this.pi)) this.hurtPlayer(1, null, 'cloud');
      for (const [i, life] of [...this.clouds]) { if (life <= 1) this.clouds.delete(i); else this.clouds.set(i, Math.min(2, life - 1)); }
    }
    this.planAll();
  }
  /** Carries out an enemy's plan from last turn. */
  private perform(e: Enemy) {
    const it = e.intent, P = this.pi;
    e.t++;
    switch (it.kind) {
      case 'move': if (this.freeFor(it.to)) this.moveEnemy(e, it.to); break;
      case 'tunnel': { if (!this.enemies.some((o) => o !== e && o.under && o.y * W + o.x === it.to)) { const f = { x: e.x, y: e.y }; e.x = it.to % W; e.y = Math.floor(it.to / W); this.ev({ k: 'tunnel', x: e.x, y: e.y, id: e.id, tx: f.x, ty: f.y }); } break; }
      case 'hit': case 'sweep':
        this.ev({ k: it.kind === 'sweep' ? 'sweep' : 'bop', x: e.x, y: e.y, id: e.id, d: it.dir });
        if (it.tiles.includes(P)) this.hurtPlayer(1, e, e.kind);
        // bosses catch their breath after a swing: that is the moment to bop them
        if (KINDS[e.kind].boss) e.wait = 2;
        break;
      case 'jump': {
        const from = { x: e.x, y: e.y };
        if (it.to === P) {
          this.hurtPlayer(1, e, 'pounce');
          const mid = this.idx((e.x + this.px) >> 1, (e.y + this.py) >> 1);
          if (this.freeFor(mid) && (e.x === this.px || e.y === this.py)) { e.x = mid % W; e.y = Math.floor(mid / W); }
        } else {
          // the landing thumps the tiles either side too
          if (it.tiles.includes(P)) this.hurtPlayer(1, e, 'thump');
          if (this.freeFor(it.to)) { e.x = it.to % W; e.y = Math.floor(it.to / W); }
        }
        this.ev({ k: 'jump', x: e.x, y: e.y, id: e.id, tx: from.x, ty: from.y });
        if (e.kind === 'bigbun') e.wait = 1;
        if (this.tiles[this.idx(e.x, e.y)] === BELLOWS && (e.x !== from.x || e.y !== from.y)) this.gust(this.idx(e.x, e.y));
        break;
      }
      case 'roll': {
        const from = { x: e.x, y: e.y };
        let stopped = false;
        for (const j of it.tiles) {
          if (j === this.pi) { this.hurtPlayer(1, e, 'roll'); stopped = true; break; }
          const o = this.enemyAt(j);
          if (o) { this.hurt(o, 1, 'roll', true); if (this.enemies.includes(o)) this.knock(o, it.dir as Dir, 1); stopped = true; break; }
          if (this.crates[j]) { this.crates[j] = 0; this.ev({ k: 'crumble', x: j % W, y: Math.floor(j / W) }); stopped = true; break; }
          if (!walkable(this.tiles[j])) { stopped = true; break; }
          e.x = j % W; e.y = Math.floor(j / W);
        }
        this.ev({ k: 'roll', x: e.x, y: e.y, id: e.id, tx: from.x, ty: from.y, d: it.dir });
        void stopped; e.wait = 1;
        break;
      }
      case 'puff':
        this.ev({ k: 'puff', x: e.x, y: e.y, id: e.id, tx: it.to % W, ty: Math.floor(it.to / W) });
        if (it.to === P) this.hurtPlayer(1, e, 'puff');
        this.clouds.set(it.to, 3);
        e.wait = 1;
        break;
      case 'sneeze':
        this.ev({ k: 'sneeze', x: e.x, y: e.y, id: e.id, d: it.dir, n: it.tiles.length });
        for (let k = it.tiles.length - 1; k >= 0; k--) {
          const j = it.tiles[k];
          if (j === this.pi) this.pushPlayer(it.dir as Dir, e);
          else { const o = this.enemyAt(j); if (o && o !== e) this.knock(o, it.dir as Dir, 1); else if (this.crates[j]) this.slideCrate(j, it.dir as Dir); }
        }
        e.wait = 1;
        break;
      case 'emerge': {
        const T = it.to;
        e.under = false; e.wait = e.kind === 'burrower' ? 2 : 1;
        let land = T;
        if (T === this.pi) this.hurtPlayer(1, e, 'emerge');
        if (!this.freeFor(T) || T === this.pi) {
          const opts = [0, 1, 2, 3].map((d) => this.idx(T % W + DX[d], Math.floor(T / W) + DY[d])).filter((j) => this.freeFor(j) && !this.enemies.some((o) => o !== e && o.under && o.y * W + o.x === j));
          opts.sort((a, b) => Math.abs(a % W - e.x) + Math.abs(Math.floor(a / W) - e.y) - (Math.abs(b % W - e.x) + Math.abs(Math.floor(b / W) - e.y)) || a - b);
          land = opts.length ? opts[0] : -1;
        }
        if (land < 0) { e.under = true; break; }
        e.x = land % W; e.y = Math.floor(land / W);
        this.ev({ k: 'emerge', x: e.x, y: e.y, id: e.id, tx: T % W, ty: Math.floor(T / W) });
        break;
      }
      case 'dig': e.under = true; this.ev({ k: 'dig', x: e.x, y: e.y, id: e.id }); break;
      case 'summon': {
        const cap = e.kind === 'king' ? 4 : 3;
        for (const j of it.tiles) {
          if (this.minions() >= cap || !this.freeFor(j)) continue;
          const kind: Kind = e.kind === 'king' ? (this.minions() % 2 ? 'hopper' : 'fluff') : 'fluff';
          const m = this.spawn(kind, j, true); m.awake = true; m.fresh = true;
          this.ev({ k: 'summon', x: m.x, y: m.y, id: m.id, tx: e.x, ty: e.y });
        }
        break;
      }
      case 'rest': if (e.wait > 0) e.wait--; break;
      default: break;
    }
  }
  /** Turns left before the dust gets thick on this floor (0 once it has). */
  dustLeft() { return this.bossFloor ? DUST_CALM : Math.max(0, DUST_CALM - this.floorTurns); }
  private dustBunny() {
    const spots: number[] = [];
    for (let i = 0; i < W * H; i++) {
      const m = Math.abs(i % W - this.px) + Math.abs(Math.floor(i / W) - this.py);
      if (m >= 4 && m <= 6 && this.seen[i] && this.tiles[i] === FLOOR && this.freeFor(i) && !this.items.has(i)) spots.push(i);
    }
    if (!spots.length) return;
    const kind: Kind = this.area === 0 ? 'fluff' : this.rng.pick(['fluff', 'hopper'] as Kind[]);
    const e = this.spawn(kind, this.rng.pick(spots), false); e.awake = true; e.fresh = true;
    this.say('The dust is getting thick… a dust bunny tumbles out!');
    this.ev({ k: 'dusty', x: e.x, y: e.y, id: e.id });
  }
  private moveEnemy(e: Enemy, to: number) {
    const from = { x: e.x, y: e.y };
    e.x = to % W; e.y = Math.floor(to / W);
    this.ev({ k: 'step', x: e.x, y: e.y, id: e.id, tx: from.x, ty: from.y });
    if (this.tiles[to] === BELLOWS) this.gust(to);
  }
  /** Steps from the player over the tiles enemies walk on, for chasing. */
  private chaseMap() {
    const d = new Int16Array(W * H).fill(-1), q = [this.pi]; d[this.pi] = 0;
    for (let h = 0; h < q.length; h++) {
      const i = q[h];
      for (let k = 0; k < 4; k++) {
        const x = i % W + DX[k], y = Math.floor(i / W) + DY[k], j = y * W + x;
        if (!this.inb(x, y) || d[j] >= 0 || !walkable(this.tiles[j]) || this.crates[j]) continue;
        d[j] = d[i] + 1; q.push(j);
      }
    }
    return d;
  }
  /** Works out what every awake enemy will do next turn. */
  planAll() {
    const dist = this.chaseMap(), taken = new Set<number>();
    for (const e of this.enemies) {
      e.intent = NO_INTENT();
      if (!e.awake || e.hidden || e.dizzy || this.state !== 'play') continue;
      // something that has only just noticed you takes a turn to get its bearings, so a new room never bops you at once
      if (e.fresh) { e.intent = { kind: 'rest', to: -1, tiles: [], dir: -1 }; continue; }
      e.intent = this.plan(e, dist, taken);
      if (e.intent.kind === 'move' || e.intent.kind === 'jump') taken.add(e.intent.to);
    }
  }
  private order(e: Enemy) { const o = e.id % 4; return [0, 1, 2, 3].map((k) => ((k + o) % 4) as Dir); }
  private towards(e: Enemy, dist: Int16Array, taken: Set<number>, score?: (j: number) => number): Intent {
    const here = e.y * W + e.x;
    let best = -1, bs = Infinity;
    const base = dist[here] >= 0 ? dist[here] : 999;
    for (const d of this.order(e)) {
      const j = this.idx(e.x + DX[d], e.y + DY[d]);
      if (!this.inb(e.x + DX[d], e.y + DY[d]) || !this.freeFor(j) || taken.has(j)) continue;
      const dj = dist[j] >= 0 ? dist[j] : 999 + Math.abs(j % W - this.px) + Math.abs(Math.floor(j / W) - this.py);
      const s = score ? score(j) * 1000 + dj : dj;
      const now = score ? score(here) * 1000 + base : base;
      if (s < bs && s < now) { bs = s; best = j; }
    }
    return best >= 0 ? { kind: 'move', to: best, tiles: [], dir: -1 } : { kind: 'rest', to: -1, tiles: [], dir: -1 };
  }
  /** The straight line from an enemy to the player, if they share a row or column: its direction and length. */
  private aligned(e: Enemy) {
    if (e.x !== this.px && e.y !== this.py) return null;
    const dir = (e.x === this.px ? (this.py < e.y ? 0 : 2) : (this.px > e.x ? 1 : 3)) as Dir;
    return { dir, len: Math.abs(e.x - this.px) + Math.abs(e.y - this.py) };
  }
  private rollPath(e: Enemy, d: Dir, max: number) {
    const out: number[] = [];
    let x = e.x, y = e.y;
    for (let k = 0; k < max; k++) {
      x += DX[d]; y += DY[d]; const j = this.idx(x, y);
      if (!this.inb(x, y) || !walkable(this.tiles[j]) || this.crates[j] || this.enemyAt(j)) break;
      out.push(j);
    }
    return out;
  }
  private sees(e: Enemy, range: number) {
    const dx = this.px - e.x, dy = this.py - e.y, n = Math.max(Math.abs(dx), Math.abs(dy));
    if (Math.abs(dx) + Math.abs(dy) > range) return false;
    for (let k = 1; k < n; k++) if (solid(this.tile(Math.round(e.x + (dx * k) / n), Math.round(e.y + (dy * k) / n)))) return false;
    return true;
  }
  /** Where a jump lands: the landing tile and the two beside it, across the jump. */
  private splash(to: number, d: Dir) {
    const out = [to], side = (d + 1) % 4;
    for (const s of [1, -1]) { const x = to % W + DX[side] * s, y = Math.floor(to / W) + DY[side] * s; if (this.inb(x, y) && walkable(this.tiles[this.idx(x, y)])) out.push(this.idx(x, y)); }
    return out;
  }
  private sweepTiles(e: Enemy) {
    const P = this.pi, side = e.x === this.px ? 1 : 0, out = [P];
    for (const s of [1, -1]) { const x = this.px + DX[side] * s, y = this.py + DY[side] * s; if (this.inb(x, y) && walkable(this.tiles[this.idx(x, y)])) out.push(this.idx(x, y)); }
    return out;
  }
  private spawnSpots(e: Enemy, n: number, taken: Set<number>) {
    const out: number[] = [];
    for (const d of this.order(e)) for (const r of [1, 2]) {
      const j = this.idx(e.x + DX[d] * r, e.y + DY[d] * r);
      if (out.length < n && this.inb(e.x + DX[d] * r, e.y + DY[d] * r) && this.freeFor(j) && !taken.has(j) && !out.includes(j)) out.push(j);
    }
    return out;
  }
  private plan(e: Enemy, dist: Int16Array, taken: Set<number>): Intent {
    const P = this.pi, man = Math.abs(e.x - this.px) + Math.abs(e.y - this.py), adj = man === 1, line = this.aligned(e);
    const I = (kind: IntentKind, to = -1, tiles: number[] = [], dir = -1): Intent => ({ kind, to, tiles, dir });
    const hitDir = line ? line.dir : -1;
    if (e.wait > 0 && !e.under) return I('rest');
    switch (e.kind) {
      case 'fluff': return adj ? I('hit', P, [P], hitDir) : this.towards(e, dist, taken);
      case 'mimic':
        if (e.t % 2 === 1) return I('rest');
        return adj ? I('hit', P, [P], hitDir) : this.towards(e, dist, taken);
      case 'hopper': case 'bigbun': {
        if (e.kind === 'bigbun' && adj) return I('hit', P, [P], hitDir);
        if (e.kind === 'bigbun' && e.t % 3 !== 2) return this.towards(e, dist, taken);
        const jumps: { to: number; s: number; d: Dir }[] = [];
        for (const d of this.order(e)) {
          const mx = e.x + DX[d], my = e.y + DY[d], x = e.x + 2 * DX[d], y = e.y + 2 * DY[d], j = this.idx(x, y);
          if (!this.inb(x, y) || solid(this.tile(mx, my)) || taken.has(j)) continue;
          if (j === P) return I('jump', P, this.splash(P, d), d);
          if (!this.freeFor(j)) continue;
          const m = Math.abs(x - this.px) + Math.abs(y - this.py), al = x === this.px || y === this.py;
          jumps.push({ to: j, d, s: adj ? -m : Math.abs(m - 2) * 10 + (al ? 0 : 4) + (dist[j] >= 0 ? dist[j] : 60) / 10 });
        }
        jumps.sort((a, b) => a.s - b.s);
        const here = adj ? -1 : Math.abs(man - 2) * 10 + (line ? 0 : 4) + (dist[e.y * W + e.x] >= 0 ? dist[e.y * W + e.x] : 60) / 10;
        if (jumps.length && jumps[0].s < here) return I('jump', jumps[0].to, this.splash(jumps[0].to, jumps[0].d), jumps[0].d);
        if (adj) return e.kind === 'bigbun' ? I('hit', P, [P], hitDir) : I('hit', P, [P], hitDir);
        return this.towards(e, dist, taken);
      }
      case 'roller': {
        if (line && line.len <= 7) {
          const path = this.rollPath(e, line.dir, 9);
          if (path.includes(P)) return I('roll', -1, path, line.dir);
        }
        return this.towards(e, dist, taken, (j) => Math.min(Math.abs(j % W - this.px), Math.abs(Math.floor(j / W) - this.py)));
      }
      case 'sneezer': {
        if (line && line.len <= 3) {
          const tiles: number[] = [];
          for (let k = 1; k <= 3; k++) { const x = e.x + DX[line.dir] * k, y = e.y + DY[line.dir] * k; if (solid(this.tile(x, y))) break; tiles.push(this.idx(x, y)); }
          if (tiles.includes(P)) return I('sneeze', -1, tiles, line.dir);
        }
        return this.towards(e, dist, taken, (j) => { const m = Math.abs(j % W - this.px) + Math.abs(Math.floor(j / W) - this.py); return Math.min(Math.abs(j % W - this.px), Math.abs(Math.floor(j / W) - this.py)) * 2 + (m < 2 ? 3 : 0); });
      }
      case 'puffer': {
        if (man <= 3 && this.sees(e, 3)) return I('puff', P, [P]);
        return this.towards(e, dist, taken);
      }
      case 'burrower': {
        if (e.under) {
          if (man <= 2) return I('emerge', P, [P]);
          let best = -1, bd = Infinity;
          for (const d of this.order(e)) {
            const x = e.x + DX[d], y = e.y + DY[d], j = this.idx(x, y);
            if (!this.inb(x, y) || !walkable(this.tiles[j]) || taken.has(j)) continue;
            const dj = dist[j] >= 0 ? dist[j] : 999;
            if (dj < bd) { bd = dj; best = j; }
          }
          if (best >= 0) taken.add(best);
          return best >= 0 ? I('tunnel', best) : I('rest');
        }
        if (e.wait > 0) return adj ? I('hit', P, [P], hitDir) : I('rest');
        return adj ? I('hit', P, [P], hitDir) : I('dig');
      }
      case 'foreman': {
        if (e.under) return I('emerge', P, [P]);
        if (adj) return I('sweep', P, this.sweepTiles(e), hitDir);
        const c = e.t % 5;
        if (c === 2 && this.minions() < 3) { const s = this.spawnSpots(e, 2, taken); if (s.length) return I('summon', -1, s); }
        if (c === 4 && man > 2) return I('dig');
        return this.towards(e, dist, taken);
      }
      case 'king': {
        if (adj) return I('sweep', P, this.sweepTiles(e), hitDir);
        const c = e.t % 4;
        if (c === 0 && line) { const path = this.rollPath(e, line.dir, 12); if (path.includes(P)) return I('roll', -1, path, line.dir); }
        if (c === 1 && this.minions() < 4) { const s = this.spawnSpots(e, 2, taken); if (s.length) return I('summon', -1, s); }
        if (c === 2 && man <= 5 && this.sees(e, 5)) return I('puff', P, [P]);
        if (line && line.len <= 6 && c !== 1) { const path = this.rollPath(e, line.dir, 12); if (path.includes(P)) return I('roll', -1, path, line.dir); }
        return this.towards(e, dist, taken);
      }
    }
    return I('none');
  }
  /** Every tile where the player would be bopped next turn: marked tiles and old dust clouds. */
  danger(): Set<number> {
    const out = new Set<number>();
    for (const e of this.enemies) if (HARMFUL.includes(e.intent.kind)) for (const t of e.intent.tiles) out.add(t);
    for (const [i, life] of this.clouds) if (life >= 1) out.add(i);
    return out;
  }

  // ---------------------------------------------------------------- floors and perks
  private descend() {
    this.ev({ k: 'stairs', x: this.px, y: this.py });
    if (PERK_FLOORS.includes(this.floor)) {
      this.state = 'perk';
      const r = new Rng(hash(this.seed, this.floor, 555));
      const open = (Object.keys(PERKS) as Perk[]).filter((p) => p === 'heart' ? this.max < MAX_HP : !this.perks.includes(p));
      this.perkChoices = r.shuffle(open).slice(0, 3);
      return;
    }
    this.nextFloor();
  }
  private takePerk(p: Perk) {
    this.perks.push(p);
    if (p === 'heart') this.max = Math.min(MAX_HP, this.max + 1);
    if (p === 'pockets') { this.tools.duster = Math.min(this.toolMax(), this.tools.duster + 1); this.tools.sling = Math.min(this.toolMax(), this.tools.sling + 1); }
    if (p === 'acorns') this.tools.acorn = Math.min(this.toolMax(), this.tools.acorn + 2);
    this.say(`New perk: ${PERKS[p].name}!`);
    this.ev({ k: 'perk', x: this.px, y: this.py, text: p });
    this.state = 'play'; this.perkChoices = [];
  }
  private nextFloor() {
    const wasBoss = this.bossFloor;
    this.floor++; this.floorTurns = 0;
    if (wasBoss) this.hp = Math.min(this.max, this.hp + 1);
    if (this.perks.includes('tidy') && this.floor % 2 === 0) this.hp = Math.min(this.max, this.hp + 1);
    this.build();
    this.say(this.bossFloor ? `Floor ${this.floor}: something big is snoring nearby…` : `Floor ${this.floor} · ${AREAS[this.area].name}`);
    this.ev({ k: 'floor', x: this.px, y: this.py, n: this.floor });
  }

  // ---------------------------------------------------------------- copies, for bots and look-ahead
  clone(): DungeonGame {
    const g = Object.create(DungeonGame.prototype) as DungeonGame;
    Object.assign(g, this);
    g.tiles = this.tiles.slice(); g.seen = this.seen.slice(); g.crates = this.crates.slice();
    g.roomSeen = [...this.roomSeen]; g.items = new Map(this.items); g.clouds = new Map(this.clouds);
    g.enemies = this.enemies.map((e) => ({ ...e, intent: { ...e.intent, tiles: [...e.intent.tiles] } }));
    g.tools = { ...this.tools }; g.perks = [...this.perks]; g.perkChoices = [...this.perkChoices];
    g.stats = { ...this.stats, kinds: { ...this.stats.kinds } }; g.rng = new Rng(this.rng.s);
    g.log = []; g.events = []; g.msgs = [];
    return g;
  }
  /** A finished or abandoned run's summary. */
  result() { return { char: this.char, mode: this.mode, day: this.day, floor: this.floor, won: this.state === 'won', turns: this.turn, tidied: this.stats.tidied, kinds: { ...this.stats.kinds } }; }
}

/** Replays a saved run from its seed and action log; null if any step no longer makes sense. */
export function replay(run: SavedRun): DungeonGame | null {
  const g = new DungeonGame(run.seed, run.char, run.mode, run.day);
  for (const a of run.log) if (!g.act(a)) return null;
  g.events = [];
  return g;
}

// ---------------------------------------------------------------- saving
export type SavedRun = { seed: number; char: Char; mode: Mode; day: string; log: string[] };
export type DailyResult = { char: Char; floor: number; won: boolean; turns: number };
export type Profile = {
  v: 1; char: Char; runs: number; best: number; wins: Record<Char, number>;
  bestiary: Partial<Record<Kind, number>>; daily: Record<string, DailyResult>;
  settings: { careful: boolean; grid: boolean; fast: boolean };
  run: SavedRun | null;
};
export const freshProfile = (): Profile => ({ v: 1, char: 'dora', runs: 0, best: 0, wins: { dora: 0, enzo: 0 }, bestiary: {}, daily: {}, settings: { careful: true, grid: true, fast: false }, run: null });
const isChar = (c: unknown): c is Char => c === 'dora' || c === 'enzo';
const num = (n: unknown, lo: number, hi: number) => (typeof n === 'number' && Number.isFinite(n) ? Math.max(lo, Math.min(hi, Math.floor(n))) : lo);
/** Reads a save defensively: anything missing, broken or from another version gives a fresh profile. */
export function readProfile(raw: string | null): Profile {
  const p = freshProfile();
  if (!raw) return p;
  let j: Record<string, unknown>;
  try { j = JSON.parse(raw); } catch { return p; }
  if (!j || typeof j !== 'object' || j.v !== 1) return p;
  if (isChar(j.char)) p.char = j.char;
  p.runs = num(j.runs, 0, 1e7); p.best = num(j.best, 0, FLOORS);
  const w = j.wins as Record<string, unknown> | undefined;
  if (w && typeof w === 'object') { p.wins.dora = num(w.dora, 0, 1e7); p.wins.enzo = num(w.enzo, 0, 1e7); }
  const b = j.bestiary as Record<string, unknown> | undefined;
  if (b && typeof b === 'object') for (const k of BESTIARY) if (typeof b[k] === 'number') p.bestiary[k] = num(b[k], 0, 1e9);
  const d = j.daily as Record<string, unknown> | undefined;
  if (d && typeof d === 'object') for (const [day, r] of Object.entries(d)) {
    const x = r as Record<string, unknown>;
    if (/^\d{4}-\d{2}-\d{2}$/.test(day) && x && isChar(x.char)) p.daily[day] = { char: x.char, floor: num(x.floor, 1, FLOORS), won: x.won === true, turns: num(x.turns, 0, 1e7) };
  }
  const s = j.settings as Record<string, unknown> | undefined;
  if (s && typeof s === 'object') { if (typeof s.careful === 'boolean') p.settings.careful = s.careful; if (typeof s.grid === 'boolean') p.settings.grid = s.grid; if (typeof s.fast === 'boolean') p.settings.fast = s.fast; }
  const r = j.run as Record<string, unknown> | undefined;
  if (r && typeof r === 'object' && typeof r.seed === 'number' && isChar(r.char) && (r.mode === 'run' || r.mode === 'daily') && Array.isArray(r.log) && r.log.every((a) => typeof a === 'string' && ACTION.test(a)))
    p.run = { seed: r.seed >>> 0, char: r.char, mode: r.mode, day: typeof r.day === 'string' ? r.day : '', log: r.log as string[] };
  return p;
}
/** Keeps the run in progress (seed plus actions) in the profile. */
export function keepRun(p: Profile, g: DungeonGame) { p.run = g.state === 'play' || g.state === 'perk' ? { seed: g.seed, char: g.char, mode: g.mode, day: g.day, log: [...g.log] } : null; }
/** Records a finished (or abandoned) run. Returns little news lines for the results panel. */
export function record(p: Profile, g: DungeonGame): string[] {
  const r = g.result(), news: string[] = [];
  p.runs++; p.run = null;
  if (r.floor > p.best) { if (p.best) news.push(`NEW DEEPEST: FLOOR ${r.floor}`); p.best = r.floor; }
  if (r.won) { p.wins[r.char]++; news.push(`${CHARS[r.char].name.toUpperCase()} WINS: ${p.wins[r.char]}`); }
  for (const [k, n] of Object.entries(r.kinds) as [Kind, number][]) { if (!p.bestiary[k]) news.push(`NEW IN THE BESTIARY: ${KINDS[k].name.toUpperCase()}`); p.bestiary[k] = (p.bestiary[k] ?? 0) + n; }
  if (r.mode === 'daily' && r.day) {
    const old = p.daily[r.day], mine: DailyResult = { char: r.char, floor: r.floor, won: r.won, turns: r.turns };
    const better = !old || (mine.won && !old.won) || (mine.won === old.won && (mine.floor > old.floor || (mine.floor === old.floor && mine.turns < old.turns)));
    if (better) { p.daily[r.day] = mine; news.push('DAILY BEST SAVED'); }
  }
  return news;
}
