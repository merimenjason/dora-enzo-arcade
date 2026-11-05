// Out of Frame: a pixel-art platformer roguelite where time only runs inside Enzo's camera viewfinder. Dora walks on
// her own; the player moves the frame and makes her jump. Anything whose centre is inside the frame moves; everything
// else is frozen where it is, and anything frozen is solid, so a frozen Grumble is a step, a frozen falling rock is a
// block and a frozen arrow is a plank. Dora herself only moves while her face is in the frame. Deterministic at 60
// ticks a second from a seed, with no DOM: the page draws it, the tests and bots drive it directly.

export const DT = 1 / 60;
export const TILE = 16, COLS = 30, ROWS = 16;
export const W = COLS * TILE, H = ROWS * TILE;
/** Dora's box, and the point that has to be inside the frame for her to move (her face) */
export const DORA = { w: 10, h: 15, face: 12 };
export const WALK = 64, GRAV = 980, JUMP = 320, HOP = 230, FALL_MAX = 380;
export const FRAME = { w: 144, h: 112, pan: 240 };
export const FILM = { start: 75, max: 90, clear: 14, can: 10 };
export const HP = 4;
/** seconds a raft or lift waits at each end */
export const DOCK = 0.8;
export const SCREENS = 9, PER_BIOME = 3;
export const SEG = 15;

export function rngNext(s: number): [number, number] {
  const a = (s + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, a];
}

export const BIOMES = [
  { id: 'ruins', name: 'Jungle Ruins' },
  { id: 'cave', name: 'Crystal Cave' },
  { id: 'temple', name: 'Sunken Temple' },
] as const;
export type BiomeId = (typeof BIOMES)[number]['id'];

// Segments are 15 tiles wide and 12 tall (rows 4 to 15 of the screen); two make a screen. Both ends of every segment
// are open ground at row 12, so any two join. # rock, = crumbling floor, - plank (stand on top, pass from below),
// ^ spikes, ~ water, A/a arrow trap firing left/right (solid), B boulder chute, G Grumble, R hanging rock,
// P platform (moves 5 tiles right and back), L lift (sits on rock, moves 5 tiles up and back), o acorn, f film, h heart.
export type Segment = { id: string; tier: 0 | 1 | 2; rows: string[] };
const g4 = ['###############', '###############', '###############', '###############'];
const air = (n: number) => Array(n).fill('...............');
export const SEGMENTS: Segment[] = [
  { id: 'start', tier: 0, rows: [...air(5), '....o...o...o..', ...air(2), ...g4] },
  { id: 'grumble', tier: 0, rows: [...air(5), '.......o.......', '...............', '.........G.....', ...g4] },
  { id: 'gap', tier: 0, rows: [...air(6), '......o........', '...............', '#####..########', '#####..########', '#####^^########', '###############'] },
  { id: 'trap', tier: 0, rows: [...air(5), '........o......', '.............#.', '.............A.', ...g4] },
  { id: 'crumble', tier: 0, rows: [...air(5), '.....o..o......', '...............', '...............', '###=======#####', '###~~~~~~~#####', '###~~~~~~~#####', '###############'] },
  { id: 'chute', tier: 0, rows: ['...............', '............B..', ...air(3), '......o........', '...............', '...............', ...g4] },
  { id: 'rocks', tier: 0, rows: ['...#########...', '....R....R.....', ...air(4), '.......o.......', '...............', ...g4] },
  { id: 'raft', tier: 0, rows: [...air(5), '.......o.......', '...............', '...............', '###P......#####', '###~~~~~~~#####', '###~~~~~~~#####', '###############'] },
  { id: 'ledge', tier: 0, rows: [...air(4), '.......o.......', '...............', '......G........', '....#######....', ...g4] },

  { id: 'bridge', tier: 1, rows: [...air(6), '.....o.........', '...............', '###.....A######', '###.....#######', '###^^^^^#######', '###############'] },
  { id: 'lift', tier: 1, rows: [...air(2), '...........o...', '.......####....', '.......####....', '.......####....', '.......####....', '.......####....', '#####L#########', '###############', '###############', '###############'] },
  { id: 'cellar', tier: 1, rows: ['.##############', '...R....R...R..', ...air(4), '........o......', '...............', '####===###===##', '####...###...##', '####^^^###^^^##', '###############'] },
  { id: 'rolling', tier: 1, rows: ['...............', '...........B...', ...air(4), '......o........', '...............', '#####..########', '#####..########', '#####^^########', '###############'] },
  { id: 'valley', tier: 1, rows: [...air(5), '.......o.......', '...............', '...............', '###.........###', '###.G....G..###', '###############', '###############'] },
  { id: 'gallery', tier: 1, rows: ['............#..', '............#..', '............#..', '............#..', '............#..', '............A..', '...o...........', '........A......', ...g4] },
  { id: 'ferry', tier: 1, rows: ['.....######....', '......R..R.....', ...air(4), '........o......', '...............', '###P.......####', '###........####', '###^^^^^^^^####', '###############'] },
  { id: 'steps', tier: 1, rows: [...air(3), '...........o...', '...............', '.........==....', '......==.......', '...==..........', '###..........##', '###..........##', '###^^^^^^^^^^##', '###############'] },

  { id: 'pegs', tier: 2, rows: ['..#............', '..#............', '..#............', '..#.......o....', '..#......####..', '..a......####..', '..a......####..', '.........####..', ...g4] },
  { id: 'gauntlet', tier: 2, rows: ['...............', '..........B....', ...air(3), '.....o.........', '...............', '.......G.......', '##...##########', '##...##########', '##^^^##########', '###############'] },
  { id: 'moat', tier: 2, rows: ['....######.....', '.....R..R......', ...air(4), '.....o.........', '...............', '###.....A######', '###.....#######', '###~~~~~#######', '###############'] },
  { id: 'shaft', tier: 2, rows: ['...............', '...........o...', '...........A...', '.......#####...', '.......#####...', '.......#####...', '.......#####...', '.......#####...', '#####L#########', '###############', '###############', '###############'] },
  { id: 'crossing', tier: 2, rows: ['...............', '.........B.....', ...air(4), '.......o.......', '...............', '##=====########', '##~~~~~########', '##~~~~~########', '###############'] },
  { id: 'patrol', tier: 2, rows: ['...#########...', '....R.....R....', ...air(2), '.......o.......', '...............', '...G......G....', '..###########..', ...g4] },
  { id: 'rafts', tier: 2, rows: [...air(5), '.......o.......', '...............', '......P........', '##P..........##', '##~~~~~~~~~~~##', '##~~~~~~~~~~~##', '###############'] },
  { id: 'ladder', tier: 2, rows: ['...............', '...............', '...............', '...............', '.........o.....', '........==.....', '.....==........', '..==...........', '##...........##', '##...........##', '##^^^^^^^^^^^##', '###############'] },
];

export type Tile = '.' | '#' | '=' | '-' | '^' | '~' | 'A' | 'a';
export const SOLID = new Set(['#', '=', 'A', 'a']);
export type Kind = 'grumble' | 'boulder' | 'arrow' | 'rock' | 'plat' | 'lift' | 'trap' | 'chute' | 'acorn' | 'film' | 'heart';
export type Ent = {
  id: number; k: Kind; x: number; y: number; w: number; h: number; vx: number; vy: number;
  /** a timer whose meaning depends on the kind; it only runs while the thing is live */
  t: number; s: string; x0: number; y0: number; dir: number; live: boolean; dead: boolean; owner: number;
};
/** hazards that hurt Dora when they touch her while they are live, and hold her weight while frozen */
export const HAZARD: Partial<Record<Kind, { name: string; line: string }>> = {
  grumble: { name: 'Grumble', line: 'A Grumble! Freeze it and it’s just a step. Or land on its head.' },
  boulder: { name: 'Boulder', line: 'Boulders roll while they’re in the picture. Jump them, or leave them out.' },
  arrow: { name: 'Arrow', line: 'Arrows stop dead at the edge of the picture. A frozen arrow holds Dora!' },
  rock: { name: 'Hanging rock', line: 'Those rocks drop when Dora walks under. A frozen rock is a block to stand on.' },
};
export const isHazard = (k: Kind) => k === 'grumble' || k === 'boulder' || k === 'arrow' || k === 'rock';

export const LENSES = [
  { id: 'wide', name: 'Wide lens', max: 2, text: 'The frame is two tiles wider.' },
  { id: 'tall', name: 'Tall lens', max: 2, text: 'The frame is a tile and a half taller.' },
  { id: 'pan', name: 'Smooth tripod', max: 2, text: 'The frame moves 40% faster.' },
  { id: 'reel', name: 'Long reel', max: 2, text: '20 more seconds of film, now and at most.' },
  { id: 'heart', name: 'Plasters', max: 2, text: 'One more heart, and heal one.' },
  { id: 'spring', name: 'Springy boots', max: 1, text: 'Dora jumps a tile higher.' },
  { id: 'slow', name: 'Slow shutter', max: 1, text: 'Everything but Dora moves at three quarters speed.' },
  { id: 'nutty', name: 'Acorn cache', max: 1, text: 'Every acorn is worth 2 seconds of film.' },
] as const;
export type LensId = (typeof LENSES)[number]['id'];
export const noLenses = (): Record<LensId, number> => ({ wide: 0, tall: 0, pan: 0, reel: 0, heart: 0, spring: 0, slow: 0, nutty: 0 });

export type Input = { /** where the frame's centre should go */ tx: number; ty: number; /** jump held */ jump: boolean };
export type Phase = 'play' | 'pick' | 'won' | 'lost';
export type Ev =
  | { k: 'jump' | 'land' | 'hop' | 'stomp' | 'hurt' | 'fall' | 'acorn' | 'film' | 'heart' | 'clear' | 'thaw' | 'freeze'; x: number; y: number }
  | { k: 'arrow' | 'boulder' | 'drop' | 'break' | 'crumble' | 'tink' | 'stick'; x: number; y: number };

export type Dora = {
  x: number; y: number; vx: number; vy: number; ground: boolean; on: number; hp: number; inv: number; hurt: number; live: boolean; buf: number; coyote: number; held: boolean; walk: number;
  /** where she comes back after a fall: solid rock she stood on half a second ago */
  safe: { x: number; y: number }; steady: number;
};

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const overlap = (ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number) =>
  ax < bx + bw && bx < ax + aw && ay < by + bh && by < ay + ah;

/** builds a screen's tiles and things from two segments */
export function buildScreen(segs: Segment[]) {
  const grid: Tile[] = [];
  const ents: Omit<Ent, 'id'>[] = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const seg = segs[Math.floor(c / SEG)], ch = r < 4 ? '.' : seg.rows[r - 4][c % SEG];
    const x = c * TILE, y = r * TILE;
    const base = { vx: 0, vy: 0, t: 0, s: '', x0: x, y0: y, dir: -1, live: false, dead: false, owner: -1 };
    let tile: Tile = '.';
    switch (ch) {
      case '#': case '=': case '-': case '^': case '~': tile = ch; break;
      case 'A': case 'a': tile = ch; ents.push({ ...base, k: 'trap', x, y, w: TILE, h: TILE, dir: ch === 'A' ? -1 : 1, t: 0.6 }); break;
      case 'B': ents.push({ ...base, k: 'chute', x, y, w: TILE, h: TILE, t: 0.4 }); break;
      case 'G': ents.push({ ...base, k: 'grumble', x: x + 1, y: y + 3, w: 14, h: 13 }); break;
      case 'R': ents.push({ ...base, k: 'rock', x: x + 2, y, w: 12, h: 14, s: 'hang' }); break;
      case 'P': ents.push({ ...base, k: 'plat', x, y, w: 32, h: 6, dir: 1 }); break;
      case 'L': tile = '#'; ents.push({ ...base, k: 'lift', x, y, w: 32, h: 6, dir: -1 }); break;
      case 'o': ents.push({ ...base, k: 'acorn', x: x + 3, y: y + 3, w: 10, h: 10 }); break;
      case 'f': ents.push({ ...base, k: 'film', x: x + 3, y: y + 3, w: 10, h: 10 }); break;
      case 'h': ents.push({ ...base, k: 'heart', x: x + 3, y: y + 3, w: 10, h: 10 }); break;
    }
    grid.push(tile);
  }
  return { grid, ents };
}

/** the order of segments for a run: the start, then each biome's segments shuffled */
export function plan(seed: number) {
  let s = seed >>> 0 || 1;
  const r = () => { const [v, n] = rngNext(s); s = n; return v; };
  const screens: string[][] = [];
  for (let b = 0; b < BIOMES.length; b++) {
    const pool = SEGMENTS.filter((g) => g.tier === b && g.id !== 'start').map((g) => g.id);
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    for (let k = 0; k < PER_BIOME; k++) screens.push(b === 0 && k === 0 ? ['start', pool[6]] : [pool[k * 2], pool[k * 2 + 1]]);
  }
  return screens;
}
export const segment = (id: string) => SEGMENTS.find((g) => g.id === id)!;

export class Run {
  seed: number; rs: number;
  phase: Phase = 'play';
  screen = 0;
  plan: string[][];
  grid: Tile[] = [];
  /** crumbling tiles: tile index → seconds left, counting only while the tile is live */
  crumble: Record<number, number> = {};
  ents: Ent[] = [];
  nextId = 1;
  dora: Dora;
  frame = { x: 0, y: 0, w: FRAME.w, h: FRAME.h };
  film = FILM.start; filmMax = FILM.max;
  lenses = noLenses();
  offer: LensId[] = [];
  stats = { acorns: 0, stomps: 0, hits: 0, falls: 0, time: 0, frozenSteps: 0 };
  /** kinds of hazard that have been live in the frame this run */
  seen: Kind[] = [];
  events: Ev[] = [];
  /** seconds since the screen started */
  clock = 0;
  constructor(seed: number) {
    this.seed = seed >>> 0 || 1; this.rs = this.seed;
    this.plan = plan(this.seed);
    this.dora = { x: 12, y: 192, vx: 0, vy: 0, ground: true, on: -1, hp: HP, inv: 0, hurt: 0, live: true, buf: 0, coyote: 0, held: false, walk: 0, safe: { x: 12, y: 192 }, steady: 0 };
    this.enter(0);
  }
  rnd() { const [v, n] = rngNext(this.rs); this.rs = n; return v; }
  get biome() { return BIOMES[Math.floor(this.screen / PER_BIOME)]; }
  get hpMax() { return HP + this.lenses.heart; }
  get over() { return this.phase === 'won' || this.phase === 'lost'; }
  get slow() { return this.lenses.slow ? 0.75 : 1; }
  /** a deep copy, for bots that look ahead */
  clone(): Run { const c = Object.create(Run.prototype) as Run; Object.assign(c, structuredClone({ ...this })); return c; }

  enter(n: number) {
    this.screen = n; this.clock = 0; this.crumble = {};
    const { grid, ents } = buildScreen(this.plan[n].map(segment));
    this.grid = grid; this.ents = ents.map((e) => ({ ...e, id: this.nextId++ }));
    // one roll of film per screen on open ground somewhere in the middle, and a heart on the first screen of a place
    const spots: number[] = [];
    for (let c = 6; c < COLS - 4; c++) if (this.tile(c, 12) === '#' && this.tile(c, 11) === '.' && this.tile(c, 10) === '.') spots.push(c);
    if (spots.length) { const c = spots[Math.floor(this.rnd() * spots.length)]; this.add('film', c * TILE + 3, 10 * TILE + 3, 10, 10); }
    if (n > 0 && n % PER_BIOME === 0 && spots.length) { const c = spots[Math.floor(this.rnd() * spots.length)]; this.add('heart', c * TILE + 3, 9 * TILE + 3, 10, 10); }
    const d = this.dora; Object.assign(d, { x: 12, y: 192, vx: 0, vy: 0, ground: true, on: -1, inv: 0, hurt: 0, buf: 0, coyote: 0, safe: { x: 12, y: 192 }, steady: 0 });
    this.frame.w = FRAME.w + 32 * this.lenses.wide; this.frame.h = FRAME.h + 24 * this.lenses.tall;
    this.frame.x = clamp(d.x + 40 - this.frame.w / 2, 0, W - this.frame.w); this.frame.y = clamp(d.y - 30 - this.frame.h / 2, 0, H - this.frame.h);
    this.phase = 'play';
  }
  add(k: Kind, x: number, y: number, w: number, h: number, more: Partial<Ent> = {}) {
    const e: Ent = { id: this.nextId++, k, x, y, w, h, vx: 0, vy: 0, t: 0, s: '', x0: x, y0: y, dir: -1, live: false, dead: false, owner: -1, ...more };
    this.ents.push(e); return e;
  }
  tile(c: number, r: number): Tile { return c < 0 || r >= ROWS ? '#' : r < 0 || c >= COLS ? '.' : this.grid[r * COLS + c]; }
  /** is this point inside the frame? */
  inFrame(x: number, y: number) { const f = this.frame; return x > f.x && x < f.x + f.w && y > f.y && y < f.y + f.h; }
  /** what a thing standing on top would land on: top edges of tiles and of solid things */
  solidTiles(x0: number, y0: number, x1: number, y1: number, oneWay: boolean) {
    const out: { x: number; y: number; w: number; h: number; one: boolean; id: number }[] = [];
    for (let r = Math.floor(y0 / TILE); r <= Math.floor((y1 - 0.001) / TILE); r++) for (let c = Math.floor(x0 / TILE); c <= Math.floor((x1 - 0.001) / TILE); c++) {
      const t = this.tile(c, r);
      if (SOLID.has(t)) out.push({ x: c * TILE, y: r * TILE, w: TILE, h: TILE, one: false, id: -1 });
      else if (oneWay && t === '-') out.push({ x: c * TILE, y: r * TILE, w: TILE, h: 4, one: true, id: -1 });
    }
    return out;
  }
  /** solid boxes for Dora: tiles, frozen hazards, stuck arrows, platforms and lifts */
  solids(x0: number, y0: number, x1: number, y1: number) {
    const out = this.solidTiles(x0, y0, x1, y1, true);
    for (const e of this.ents) {
      if (e.dead || !overlap(e.x, e.y, e.w, e.h, x0, y0, x1 - x0, y1 - y0)) continue;
      if (e.k === 'plat' || e.k === 'lift') out.push({ x: e.x, y: e.y, w: e.w, h: e.h, one: true, id: e.id });
      else if (e.k === 'arrow' && (e.s === 'stuck' || !e.live)) out.push({ x: e.x, y: e.y, w: e.w, h: e.h, one: true, id: e.id });
      else if (isHazard(e.k) && (!e.live || e.s === 'rest') && e.s !== 'hang') out.push({ x: e.x, y: e.y, w: e.w, h: e.h, one: false, id: e.id });
    }
    return out;
  }
  blocked(x0: number, y0: number, x1: number, y1: number) { return this.solids(x0, y0, x1, y1).some((b) => !b.one); }

  pick(id?: LensId) {
    if (this.phase !== 'pick') return false;
    if (id) {
      if (!this.offer.includes(id)) return false;
      this.lenses[id]++;
      if (id === 'reel') { this.filmMax += 20; this.film = Math.min(this.filmMax, this.film + 20); }
      if (id === 'heart') this.dora.hp = Math.min(this.hpMax, this.dora.hp + 1);
    }
    this.offer = []; this.enter(this.screen + 1); return true;
  }

  tick(inp: Input) {
    this.events = [];
    if (this.phase !== 'play') return;
    this.clock += DT; this.stats.time += DT;
    this.film -= DT;
    if (this.film <= 0) { this.film = 0; this.phase = 'lost'; return; }
    this.moveFrame(inp);
    const d = this.dora;
    const wasLive = d.live;
    d.live = this.inFrame(d.x, d.y - DORA.face);
    if (wasLive !== d.live) this.events.push({ k: d.live ? 'thaw' : 'freeze', x: d.x, y: d.y });
    for (const e of this.ents) {
      e.live = !e.dead && this.inFrame(e.x + e.w / 2, e.y + e.h / 2);
      if (e.live && isHazard(e.k) && !this.seen.includes(e.k)) this.seen.push(e.k);
    }
    const sdt = DT * this.slow;
    for (const e of this.ents) if (e.live && (e.k === 'plat' || e.k === 'lift')) this.mover(e, sdt);
    for (const e of this.ents) if (e.live && !e.dead) this.think(e, sdt);
    if (inp.jump && !d.held) d.buf = 0.14;
    d.held = inp.jump;
    if (d.live) this.doraTick();
    // crumbling floor counts down only while it's in the frame
    for (const k of Object.keys(this.crumble)) {
      const i = +k, c = i % COLS, r = Math.floor(i / COLS);
      if (!this.inFrame(c * TILE + 8, r * TILE + 8)) continue;
      this.crumble[i] -= sdt;
      if (this.crumble[i] <= 0) { delete this.crumble[i]; this.grid[i] = '.'; this.events.push({ k: 'crumble', x: c * TILE + 8, y: r * TILE + 8 }); }
    }
    this.ents = this.ents.filter((e) => !e.dead);
    if (this.phase === 'play' && d.x >= W - 6) this.clear();
  }
  moveFrame(inp: Input) {
    const f = this.frame, sp = FRAME.pan * (1 + 0.4 * this.lenses.pan) * DT;
    const cx = f.x + f.w / 2, cy = f.y + f.h / 2;
    const tx = clamp(inp.tx, f.w / 2, W - f.w / 2), ty = clamp(inp.ty, f.h / 2, H - f.h / 2);
    const dx = tx - cx, dy = ty - cy, l = Math.hypot(dx, dy);
    const k = l <= sp ? 1 : sp / l;
    f.x = clamp(f.x + dx * k, 0, W - f.w); f.y = clamp(f.y + dy * k, 0, H - f.h);
  }
  clear() {
    this.events.push({ k: 'clear', x: this.dora.x, y: this.dora.y });
    this.film = Math.min(this.filmMax, this.film + FILM.clear);
    if (this.screen + 1 >= SCREENS) { this.phase = 'won'; return; }
    // a heart back at the end of each place
    if ((this.screen + 1) % PER_BIOME === 0) this.dora.hp = Math.min(this.hpMax, this.dora.hp + 1);
    const pool = LENSES.filter((l) => this.lenses[l.id] < l.max).map((l) => l.id);
    this.offer = [];
    while (this.offer.length < 3 && pool.length) this.offer.push(pool.splice(Math.floor(this.rnd() * pool.length), 1)[0]);
    this.phase = 'pick';
  }

  /** platforms and lifts: back and forth over five tiles, waiting a moment at each end, never into Dora */
  mover(e: Ent, dt: number) {
    if (e.t > 0) { e.t -= dt; return; }
    const sp = e.k === 'plat' ? 36 : 30, range = 80;
    const dx = e.k === 'plat' ? e.dir * sp * dt : 0, dy = e.k === 'lift' ? e.dir * sp * dt : 0;
    const d = this.dora, riding = d.on === e.id && d.ground;
    const nx = e.x + dx, ny = e.y + dy;
    if (!riding && overlap(nx, ny, e.w, e.h, d.x - DORA.w / 2, d.y - DORA.h, DORA.w, DORA.h)) { e.dir = -e.dir; return; }
    e.x = nx; e.y = ny;
    if (e.k === 'plat' && (e.x >= e.x0 + range || e.x <= e.x0)) { e.x = clamp(e.x, e.x0, e.x0 + range); e.dir = -e.dir; e.t = DOCK; }
    if (e.k === 'lift' && (e.y <= e.y0 - range || e.y >= e.y0)) { e.y = clamp(e.y, e.y0 - range, e.y0); e.dir = -e.dir; e.t = DOCK; }
    // Dora rides along, but only if she's moving too
    if (riding && d.live) { d.x += dx; d.y += dy; }
  }

  /** a hazard or a machine, while it's live */
  think(e: Ent, dt: number) {
    const d = this.dora;
    switch (e.k) {
      case 'trap': {
        e.t -= dt;
        if (e.t <= 0) {
          e.t = 1.8;
          const mx = e.dir < 0 ? e.x - 14 : e.x + TILE;
          // a trap whose mouth is blocked by its own bridge stops firing
          const jammed = this.ents.some((a) => a.k === 'arrow' && a.s === 'stuck' && overlap(mx, e.y + 6, 14, 4, a.x, a.y, a.w, a.h)) || SOLID.has(this.tile(Math.floor((mx + 7) / TILE), Math.floor((e.y + 8) / TILE)));
          if (!jammed && this.ents.filter((a) => a.owner === e.id && a.s !== 'stuck').length < 4) {
            const a = this.add('arrow', mx, e.y + 6, 14, 4, { vx: 150 * e.dir, dir: e.dir, owner: e.id, live: true });
            this.events.push({ k: 'arrow', x: a.x + 7, y: a.y });
          }
        }
        return;
      }
      case 'chute': {
        e.t -= dt;
        if (e.t <= 0) {
          e.t = 3.2;
          if (this.ents.filter((b) => b.owner === e.id).length < 3) { this.add('boulder', e.x + 1, e.y + 2, 14, 14, { owner: e.id, dir: -1, live: true }); this.events.push({ k: 'boulder', x: e.x + 8, y: e.y + 8 }); }
        }
        return;
      }
      case 'grumble': {
        e.vy = Math.min(FALL_MAX, e.vy + GRAV * dt);
        this.fallBody(e, dt);
        if (e.y > H + 20) { e.dead = true; return; }
        if (e.s !== 'air') {
          const nx = e.x + e.dir * 30 * dt;
          const front = e.dir < 0 ? nx : nx + e.w;
          const wall = this.blockedForFoe(e, nx);
          const ledge = !SOLID.has(this.tile(Math.floor(front / TILE), Math.floor((e.y + e.h + 2) / TILE)));
          if (wall || ledge) e.dir = -e.dir; else e.x = nx;
        }
        break;
      }
      case 'boulder': {
        if (e.s === 'rest') return;
        e.vy = Math.min(FALL_MAX, e.vy + GRAV * dt);
        this.fallBody(e, dt);
        if (e.s !== 'air') {
          const nx = e.x + e.dir * 80 * dt;
          if (this.blockedForFoe(e, nx)) { e.dead = true; this.events.push({ k: 'break', x: e.x + 7, y: e.y + 7 }); return; }
          e.x = nx;
        }
        if (e.x < -20 || e.y > H + 20 || this.wet(e)) { e.dead = true; this.events.push({ k: 'break', x: e.x + 7, y: e.y + 7 }); return; }
        // a boulder that rolls into a spiked pit stays there, and the next one stacks on top
        const spike = this.spikeTop(e);
        if (spike !== null) { e.y = spike - e.h; e.vy = 0; e.s = 'rest'; this.events.push({ k: 'land', x: e.x + 7, y: e.y + 14 }); return; }
        break;
      }
      case 'arrow': {
        if (e.s === 'stuck') return;
        const nx = e.x + e.vx * dt;
        // an arrow that meets a stuck one sticks into its end, so a trap left running builds a bridge
        const peg = this.ents.find((o) => o.k === 'arrow' && o.s === 'stuck' && o !== e && Math.abs(o.y - e.y) < 3 && overlap(nx, e.y, e.w, e.h, o.x, o.y, o.w, o.h));
        if (peg) { e.x = e.vx > 0 ? peg.x - e.w + 3 : peg.x + peg.w - 3; e.s = 'stuck'; e.vx = 0; this.events.push({ k: 'stick', x: e.x + 7, y: e.y }); return; }
        if (this.solidTiles(nx, e.y, nx + e.w, e.y + e.h, false).length) {
          // it sticks in the rock, and stays there as a peg
          e.x = e.vx > 0 ? Math.floor((nx + e.w) / TILE) * TILE - e.w + 4 : Math.floor(nx / TILE) * TILE + TILE - 4;
          e.s = 'stuck'; e.vx = 0; this.events.push({ k: 'stick', x: e.x + 7, y: e.y }); return;
        }
        e.x = nx;
        if (e.x < -20 || e.x > W + 20) { e.dead = true; return; }
        if (!d.live && overlap(e.x, e.y, e.w, e.h, d.x - DORA.w / 2, d.y - DORA.h, DORA.w, DORA.h)) { e.dead = true; this.events.push({ k: 'tink', x: e.x + 7, y: e.y }); return; }
        break;
      }
      case 'rock': {
        if (e.s === 'hang') {
          if (d.y > e.y && Math.abs(d.x - (e.x + e.w / 2)) < 28) { e.s = 'shake'; e.t = 0.35; }
          return;
        }
        if (e.s === 'shake') { e.t -= dt; if (e.t <= 0) { e.s = 'fall'; this.events.push({ k: 'drop', x: e.x + 6, y: e.y }); } return; }
        e.vy = Math.min(FALL_MAX, e.vy + GRAV * dt);
        const ny = e.y + e.vy * dt;
        const doraBox = !d.live && overlap(e.x, ny, e.w, e.h, d.x - DORA.w / 2, d.y - DORA.h, DORA.w, DORA.h);
        if (doraBox || this.blockedForFoe(e, e.x, ny) || ny > H + 20) { e.dead = true; this.events.push({ k: 'break', x: e.x + 6, y: e.y + 10 }); return; }
        e.y = ny;
        break;
      }
    }
    // a live hazard against frozen Dora: Grumbles turn round, boulders break
    if (!d.live && overlap(e.x, e.y, e.w, e.h, d.x - DORA.w / 2, d.y - DORA.h, DORA.w, DORA.h)) {
      if (e.k === 'grumble') { e.dir = d.x > e.x + e.w / 2 ? -1 : 1; e.x += e.dir * 2; }
      if (e.k === 'boulder') { e.dead = true; this.events.push({ k: 'break', x: e.x + 7, y: e.y + 7 }); }
    }
  }
  /** walls for walking hazards: rock, and anything frozen in the way */
  blockedForFoe(e: Ent, nx: number, ny = e.y) {
    if (this.solidTiles(nx, ny, nx + e.w, ny + e.h - 0.5, false).length) return true;
    for (const o of this.ents) if (o !== e && !o.dead && (!o.live || o.s === 'rest') && isHazard(o.k) && o.s !== 'hang' && o.k !== 'arrow' && overlap(nx, ny, e.w, e.h - 0.5, o.x, o.y, o.w, o.h)) return true;
    return false;
  }
  /** gravity for Grumbles and boulders: they land on rock and on platforms */
  fallBody(e: Ent, dt: number) {
    const ny = e.y + e.vy * dt;
    let top = Infinity;
    for (const b of this.solidTiles(e.x + 1, e.y + e.h - 0.5, e.x + e.w - 1, ny + e.h + 0.5, true)) if (b.y >= e.y + e.h - 0.5) top = Math.min(top, b.y);
    for (const o of this.ents) if ((o.k === 'plat' || o.k === 'lift' || o.s === 'rest') && o !== e && overlap(e.x, ny, e.w, e.h + 0.5, o.x, o.y, o.w, o.h) && o.y >= e.y + e.h - 1) top = Math.min(top, o.y);
    if (top < Infinity) { e.y = top - e.h; e.vy = 0; e.s = ''; } else { e.y = ny; if (e.vy > 30) e.s = 'air'; }
  }
  wet(e: Ent) { return this.tile(Math.floor((e.x + e.w / 2) / TILE), Math.floor((e.y + e.h - 2) / TILE)) === '~'; }
  /** the top of the spikes under a thing, if it has sunk into them */
  spikeTop(e: Ent) {
    const c = Math.floor((e.x + e.w / 2) / TILE), r = Math.floor((e.y + e.h) / TILE);
    return this.tile(c, r) === '^' && e.y + e.h > r * TILE + 6 ? r * TILE + 6 : null;
  }
  deadly(x: number, y: number, w: number, h: number) {
    for (let r = Math.floor(y / TILE); r <= Math.floor((y + h - 0.001) / TILE); r++) for (let c = Math.floor(x / TILE); c <= Math.floor((x + w - 0.001) / TILE); c++) {
      const t = this.tile(c, r);
      if (t === '~' && y + h > r * TILE + 4) return true;
      if (t === '^' && y + h > r * TILE + 7) return true;
    }
    return false;
  }

  doraTick() {
    const d = this.dora, ev = this.events;
    d.inv = Math.max(0, d.inv - DT); d.buf = Math.max(0, d.buf - DT);
    d.coyote = d.ground ? 0.08 : Math.max(0, d.coyote - DT);
    if (d.hurt > 0) { d.hurt -= DT; d.vx = -60; } else d.vx = this.riding() ? 0 : WALK;
    // jump
    if (d.buf > 0 && (d.ground || d.coyote > 0) && d.hurt <= 0) {
      d.vy = -(JUMP + 30 * this.lenses.spring); d.ground = false; d.coyote = 0; d.buf = 0; d.on = -1; ev.push({ k: 'jump', x: d.x, y: d.y });
    }
    // across: walk, hop up single steps, wait at anything taller
    const hw = DORA.w / 2, nx = d.x + d.vx * DT;
    if (nx - hw < 0) d.x = hw;
    else if (!this.blocked(nx - hw, d.y - DORA.h, nx + hw, d.y - 0.01)) { d.x = nx; d.walk += Math.abs(d.vx) * DT; }
    else if (d.ground && d.vx > 0 && !this.blocked(nx - hw, d.y - DORA.h - 17, nx + hw, d.y - 17.01) && !this.blocked(d.x - hw, d.y - DORA.h - 17, d.x + hw, d.y - 0.5)) {
      d.vy = -HOP; d.ground = false; d.on = -1; ev.push({ k: 'hop', x: d.x, y: d.y });
    }
    // down: land on the highest top between here and where gravity takes her
    d.vy = Math.min(FALL_MAX, d.vy + GRAV * DT);
    const ny = d.y + d.vy * DT;
    if (d.vy >= 0) {
      let top = Infinity, on = -1;
      // level with the ground, a platform or lift wins, so Dora rides it when it moves
      for (const b of this.solids(d.x - hw, d.y - 0.5, d.x + hw, ny + 0.01)) if (b.y >= d.y - 0.5 && (b.y < top || (b.y === top && b.id >= 0))) { top = b.y; on = b.id; }
      // landing on a live Grumble's head squashes it
      if (d.vy > 40) for (const e of this.ents) if (e.k === 'grumble' && e.live && !e.dead && overlap(d.x - hw, d.y - 2, DORA.w, ny - d.y + 2, e.x, e.y, e.w, 6)) {
        e.dead = true; d.vy = -220; this.stats.stomps++; ev.push({ k: 'stomp', x: e.x + 7, y: e.y });
        top = Infinity; break;
      }
      if (top < Infinity) {
        if (!d.ground && d.vy > 120) ev.push({ k: 'land', x: d.x, y: top });
        d.y = top; d.vy = 0; d.ground = true; d.on = on;
        if (on >= 0) { const e = this.ents.find((x) => x.id === on); if (e && isHazard(e.k) && !e.live && e.k !== 'arrow') this.stats.frozenSteps++; }
      } else if (d.vy !== -220) { d.y = ny; d.ground = false; d.on = -1; }
      else d.y = ny;
    } else {
      if (this.blocked(d.x - hw, ny - DORA.h, d.x + hw, d.y - DORA.h)) { d.y = Math.ceil((ny - DORA.h) / TILE) * TILE + DORA.h; d.vy = 0; } else d.y = ny;
      d.ground = false; d.on = -1;
    }
    // stepping on crumbling floor starts it going
    if (d.ground && d.on < 0) for (const c of [Math.floor((d.x - hw + 1) / TILE), Math.floor((d.x + hw - 1) / TILE)]) {
      const r = Math.round(d.y / TILE), i = r * COLS + c;
      if (this.grid[i] === '=' && this.crumble[i] === undefined) this.crumble[i] = 0.4;
    }
    // standing on whole rock for half a second makes this a safe place to come back to
    const rock = d.ground && d.on < 0 && [d.x - hw + 1, d.x + hw - 1].every((x) => { const t = this.tile(Math.floor(x / TILE), Math.floor(d.y / TILE)); return t === '#' || t === 'A' || t === 'a'; });
    d.steady = rock ? d.steady + DT : 0;
    if (d.steady >= 0.5 && d.inv <= 0) d.safe = { x: d.x, y: d.y };
    // falls, spikes and water: back to the last safe place
    if (d.y > H + 24 || this.deadly(d.x - hw + 1, d.y - DORA.h, DORA.w - 2, DORA.h)) { this.fall(); return; }
    // hazards and pickups
    for (const e of this.ents) {
      if (e.dead || !overlap(e.x, e.y, e.w, e.h, d.x - hw, d.y - DORA.h, DORA.w, DORA.h)) continue;
      if (e.k === 'acorn') { e.dead = true; this.stats.acorns++; if (this.lenses.nutty) this.film = Math.min(this.filmMax, this.film + 2); ev.push({ k: 'acorn', x: e.x + 5, y: e.y + 5 }); }
      else if (e.k === 'film') { e.dead = true; this.film = Math.min(this.filmMax, this.film + FILM.can); ev.push({ k: 'film', x: e.x + 5, y: e.y + 5 }); }
      else if (e.k === 'heart') { e.dead = true; d.hp = Math.min(this.hpMax, d.hp + 1); ev.push({ k: 'heart', x: e.x + 5, y: e.y + 5 }); }
      else if (isHazard(e.k) && e.live && e.s !== 'hang' && e.s !== 'stuck' && e.s !== 'rest' && d.inv <= 0) {
        if (e.k === 'rock' && e.s !== 'fall') continue;
        this.hurt();
        if (e.k === 'arrow' || e.k === 'rock') { e.dead = true; ev.push({ k: 'break', x: e.x + e.w / 2, y: e.y }); }
        if (this.phase !== 'play') return;
      }
    }
  }
  /** on a raft or a lift Dora stands still while it moves, and won't walk off its edge into nothing */
  riding() {
    const d = this.dora;
    if (!d.ground || d.on < 0) return false;
    const e = this.ents.find((o) => o.id === d.on);
    if (!e || (e.k !== 'plat' && e.k !== 'lift')) return false;
    if (e.live && e.t <= 0) return true;
    return !this.solids(d.x + 4, d.y - 16, d.x + 8, d.y + 1).some((b) => b.y >= d.y - 16);
  }
  hurt() {
    const d = this.dora;
    d.hp--; this.stats.hits++; d.inv = 1.2; d.hurt = 0.3; d.vy = -200; d.ground = false; d.on = -1;
    this.events.push({ k: 'hurt', x: d.x, y: d.y });
    if (d.hp <= 0) this.phase = 'lost';
  }
  fall() {
    const d = this.dora;
    d.hp--; this.stats.falls++;
    this.events.push({ k: 'fall', x: d.x, y: Math.min(d.y, H) });
    if (d.hp <= 0) { this.phase = 'lost'; return; }
    Object.assign(d, { x: d.safe.x, y: d.safe.y, vx: 0, vy: 0, ground: true, on: -1, inv: 1.5, hurt: 0, steady: 0 });
  }
}

export const SAVE_KEY = 'out-of-frame-v1';
export type Save = {
  v: 1; intro: boolean;
  best: { screen: number; acorns: number; time: number };
  stats: { runs: number; wins: number; acorns: number };
  seen: string[];
  settings: { sound: boolean; music: boolean };
};
export const newSave = (): Save => ({ v: 1, intro: false, best: { screen: 0, acorns: 0, time: 0 }, stats: { runs: 0, wins: 0, acorns: 0 }, seen: [], settings: { sound: true, music: true } });
export function parseSave(raw: string | null): Save {
  const s = newSave(); if (!raw) return s;
  try {
    const o = JSON.parse(raw); if (!o || o.v !== 1) return s;
    const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : d);
    s.intro = o.intro === true;
    for (const k of ['screen', 'acorns', 'time'] as const) s.best[k] = num(o.best?.[k], 0);
    for (const k of ['runs', 'wins', 'acorns'] as const) s.stats[k] = num(o.stats?.[k], 0);
    s.seen = Array.isArray(o.seen) ? o.seen.filter((k: unknown): k is string => typeof k === 'string' && k in HAZARD) : [];
    s.settings.sound = o.settings?.sound !== false; s.settings.music = o.settings?.music !== false;
  } catch { /* a broken save starts fresh */ }
  return s;
}
export const serialise = (s: Save) => JSON.stringify(s);
/** adds a finished run to the save */
export function bank(s: Save, r: Run) {
  s.stats.runs++; s.stats.acorns += r.stats.acorns;
  const won = r.phase === 'won';
  if (won) { s.stats.wins++; if (!s.best.time || r.stats.time < s.best.time) s.best.time = Math.round(r.stats.time); }
  s.best.screen = Math.max(s.best.screen, won ? SCREENS : r.screen + 1);
  s.best.acorns = Math.max(s.best.acorns, r.stats.acorns);
}
