// Hay Maze Defence: a maze-building tower defence. Predators cross a meadow to raid Dora and Enzo's raisin stash,
// always taking the shortest open route. Every tower blocks its tile, so building reroutes them: lay hay bales and
// towers into a long maze, then slow them with dust and put them to sleep with the bell. You may never seal the way
// completely. Flyers ignore the maze. Deterministic: no randomness at all, so a game replays exactly.

export const COLS = 20, ROWS = 12, TOTAL_WAVES = 20;
export const START_HAY = 80, START_RAISINS = 20, BREAK = 18, SELL_BACK = 0.7, WAVE_BONUS = 8;

export type TowerId = 'hay' | 'flicker' | 'puffer' | 'roller' | 'bell' | 'glider';
export type EnemyId = 'weasel' | 'fox' | 'snake' | 'badger' | 'hawk' | 'lynx';
export type Hits = 'none' | 'ground' | 'air' | 'both';
export type Level = { dmg: number; range: number; rate: number; slow?: number; stun?: number; splash?: number };
export type TowerDef = {
  id: TowerId; name: string; cost: number; upgrades: number[]; levels: Level[]; hits: Hits;
  kind: 'wall' | 'shot' | 'aura' | 'lob' | 'ring'; blurb: string;
};

export const TOWERS: Record<TowerId, TowerDef> = {
  hay: { id: 'hay', name: 'Hay Bale', cost: 4, upgrades: [], hits: 'none', kind: 'wall',
    levels: [{ dmg: 0, range: 0, rate: 0 }],
    blurb: 'Cheap and does nothing but get in the way, which is the point. Build a maze and make them walk.' },
  flicker: { id: 'flicker', name: 'Pellet Flicker', cost: 12, upgrades: [14, 26], hits: 'both', kind: 'shot',
    levels: [{ dmg: 10, range: 2.6, rate: 0.5 }, { dmg: 18, range: 2.8, rate: 0.45 }, { dmg: 32, range: 3.1, rate: 0.4 }],
    blurb: 'A kit with a slingshot who flicks hay pellets at anything, flyers too.' },
  puffer: { id: 'puffer', name: 'Dora’s Dust Puffer', cost: 18, upgrades: [18, 30], hits: 'ground', kind: 'aura',
    levels: [{ dmg: 3, range: 1.7, rate: 0.5, slow: 0.4 }, { dmg: 6, range: 1.9, rate: 0.5, slow: 0.5 }, { dmg: 10, range: 2.1, rate: 0.5, slow: 0.6 }],
    blurb: 'Dora fans a cloud of bath dust. Everything walking through it slows right down.' },
  roller: { id: 'roller', name: 'Enzo’s Boulder Roller', cost: 25, upgrades: [25, 45], hits: 'ground', kind: 'lob',
    levels: [{ dmg: 30, range: 3, rate: 1.5, splash: 0.9 }, { dmg: 55, range: 3.2, rate: 1.4, splash: 1 }, { dmg: 95, range: 3.5, rate: 1.3, splash: 1.2 }],
    blurb: 'Enzo heaves boulders that crash into crowds on the ground.' },
  bell: { id: 'bell', name: 'Snooze Bell', cost: 30, upgrades: [25, 40], hits: 'both', kind: 'ring',
    levels: [{ dmg: 4, range: 1.9, rate: 3.2, stun: 0.6 }, { dmg: 8, range: 2.1, rate: 2.8, stun: 0.8 }, { dmg: 14, range: 2.3, rate: 2.4, stun: 1 }],
    blurb: 'Grandpa Pebble rings a lullaby. Everything nearby nods off where it stands.' },
  glider: { id: 'glider', name: 'Glider Nest', cost: 20, upgrades: [20, 35], hits: 'air', kind: 'shot',
    levels: [{ dmg: 32, range: 3.4, rate: 0.8 }, { dmg: 58, range: 3.7, rate: 0.75 }, { dmg: 100, range: 4, rate: 0.7 }],
    blurb: 'Sugar gliders launch from the nest at anything with wings. Ignores the ground.' },
};
export const TOWER_IDS = Object.keys(TOWERS) as TowerId[];

export type EnemyDef = { id: EnemyId; name: string; hp: number; speed: number; bounty: number; steal: number; armor: number; air: boolean; slowResist: number; stunResist: number; r: number };
export const ENEMIES: Record<EnemyId, EnemyDef> = {
  weasel: { id: 'weasel', name: 'Weasel', hp: 28, speed: 1.7, bounty: 2, steal: 1, armor: 0, air: false, slowResist: 0, stunResist: 0, r: 0.28 },
  fox: { id: 'fox', name: 'Fox', hp: 55, speed: 1.15, bounty: 3, steal: 1, armor: 0, air: false, slowResist: 0, stunResist: 0, r: 0.32 },
  snake: { id: 'snake', name: 'Snake', hp: 85, speed: 0.85, bounty: 4, steal: 1, armor: 0, air: false, slowResist: 0.5, stunResist: 0, r: 0.3 },
  badger: { id: 'badger', name: 'Badger', hp: 150, speed: 0.7, bounty: 6, steal: 2, armor: 4, air: false, slowResist: 0, stunResist: 0, r: 0.36 },
  hawk: { id: 'hawk', name: 'Hawk', hp: 40, speed: 1.35, bounty: 4, steal: 1, armor: 0, air: true, slowResist: 0, stunResist: 0, r: 0.32 },
  lynx: { id: 'lynx', name: 'Lynx', hp: 800, speed: 0.75, bounty: 40, steal: 5, armor: 3, air: false, slowResist: 0.3, stunResist: 0.5, r: 0.42 },
};

/** Each wave is groups of [enemy, count, seconds between them]; groups follow one another. */
export const WAVES: [EnemyId, number, number][][] = [
  [['fox', 8, 1]],
  [['weasel', 12, 0.6]],
  [['fox', 10, 0.8], ['weasel', 6, 0.5]],
  [['snake', 8, 1]],
  [['hawk', 8, 0.9]],
  [['fox', 12, 0.7], ['snake', 6, 0.9]],
  [['badger', 5, 1.4], ['weasel', 10, 0.5]],
  [['hawk', 10, 0.8], ['fox', 10, 0.6]],
  [['snake', 12, 0.8], ['badger', 4, 1.2]],
  [['fox', 8, 0.7], ['lynx', 1, 1]],
  [['weasel', 24, 0.35]],
  [['badger', 8, 1.1], ['hawk', 8, 0.8]],
  [['snake', 16, 0.6], ['fox', 12, 0.5]],
  [['hawk', 16, 0.6]],
  [['badger', 12, 0.9], ['weasel', 16, 0.35]],
  [['fox', 20, 0.45], ['snake', 12, 0.6], ['hawk', 8, 0.7]],
  [['badger', 16, 0.8]],
  [['hawk', 14, 0.55], ['weasel', 20, 0.3]],
  [['snake', 20, 0.5], ['badger', 10, 0.8], ['fox', 15, 0.4]],
  [['badger', 8, 0.9], ['hawk', 10, 0.6], ['lynx', 2, 4]],
];
/** Predators get tougher every wave. */
export const hpScale = (wave: number) => 1 + 0.2 * (wave - 1) + 0.016 * (wave - 1) ** 2;

// ---------- Maps ----------
// '.' meadow, '#' rock, 'E' an entrance on the left or top edge, 'X' the burrow door on the right edge.

/** `tough` multiplies every predator's health on the map. */
export type MazeMap = { id: string; name: string; blurb: string; tough: number; rows: string[] };
const TOUGH_CANYON = 0.85, TOUGH_SUMMIT = 1.3;
export const MAPS: MazeMap[] = [
  { id: 'meadow', name: 'Clover Meadow', blurb: 'Wide open grass and one way in. Plenty of room to build a long, winding maze.', tough: 1, rows: [
    '....................',
    '....................',
    '........#...........',
    '....................',
    '...............#....',
    'E..................X',
    'E..................X',
    '.....#..............',
    '....................',
    '...........#........',
    '....................',
    '....................',
  ] },
  { id: 'canyon', name: 'Cactus Canyon', blurb: 'Two trails in, rocks everywhere, and less room to work with. Make the trails meet.', tough: TOUGH_CANYON, rows: [
    '....................',
    'E.....#.............',
    '......#.....##......',
    '..##..#.............',
    '..##.........#......',
    '.............#.....X',
    '......##...........X',
    '......##.....#......',
    '..#..........#......',
    '..#.....#...........',
    'E.......#.....##....',
    '....................',
  ] },
  { id: 'summit', name: 'Moonlit Summit', blurb: 'Raiders from the west and down the mountain, and the burrow is close. Hawks love it up here.', tough: TOUGH_SUMMIT, rows: [
    '......EE............',
    '....................',
    '.#........#.........',
    '.#....##..#....##...',
    '......##............',
    'E..............#...X',
    'E....#.............X',
    '.....#....##........',
    '.#........##...#....',
    '.#..................',
    '.......#......#.....',
    '....................',
  ] },
];

// ---------- State ----------

export type Tower = { id: number; kind: TowerId; c: number; r: number; level: number; spent: number; cool: number; target: number | null; aim: number; flash: number };
export type Enemy = {
  id: number; kind: EnemyId; x: number; y: number; hp: number; maxHp: number; slow: number; slowT: number; stun: number;
  progress: number; dir: [number, number]; face: 1 | -1; hit: number; entrance: number; bob: number;
};
export type Shot = { id: number; kind: 'pellet' | 'glider' | 'boulder'; x: number; y: number; sx: number; sy: number; tx: number; ty: number; target: number | null; speed: number; dmg: number; splash: number; hits: Hits; t: number; total: number };
export type Effect = { kind: 'puff' | 'ring' | 'boom' | 'hit' | 'leak' | 'coin'; x: number; y: number; r: number; t: number; max: number; value?: number };
export type GameEvent = { type: 'build' | 'upgrade' | 'sell' | 'wave' | 'kill' | 'leak' | 'won' | 'lost'; kind?: string; value?: number };
export type BuildResult = 'ok' | 'hay' | 'taken' | 'blocked' | 'occupied' | 'state' | 'bounds';
export type State = 'playing' | 'paused' | 'won' | 'lost';

const DIRS: [number, number][] = [[1, 0], [0, -1], [0, 1], [-1, 0]];
export const INF = 1 << 30;

export class MazeGame {
  map: MazeMap;
  round: number;
  state: State = 'playing';
  hay = START_HAY;
  raisins = START_RAISINS;
  /** Waves started so far; the one under way is `wave`. */
  wave = 0;
  /** Seconds until the next wave starts on its own; null before the first wave, which waits for the player. */
  countdown: number | null = null;
  time = 0;
  towers: Tower[] = [];
  enemies: Enemy[] = [];
  shots: Shot[] = [];
  effects: Effect[] = [];
  events: GameEvent[] = [];
  queue: { kind: EnemyId; at: number; entrance: number }[] = [];
  entrances: [number, number][] = [];
  exits: [number, number][] = [];
  dist: Int32Array = new Int32Array(COLS * ROWS);
  kills = 0;
  leaked = 0;
  private rocks: boolean[] = [];
  private nextId = 1;

  constructor(round = 0) {
    this.round = Math.max(0, Math.min(MAPS.length - 1, round));
    this.map = MAPS[this.round];
    this.map.rows.forEach((row, r) => row.split('').forEach((ch, c) => {
      this.rocks[r * COLS + c] = ch === '#';
      if (ch === 'E') this.entrances.push([c, r]);
      if (ch === 'X') this.exits.push([c, r]);
    }));
    this.dist = this.field(-1);
  }

  // ---------- The grid and the route ----------

  static idx(c: number, r: number) { return r * COLS + c; }
  inGrid(c: number, r: number) { return c >= 0 && r >= 0 && c < COLS && r < ROWS; }
  rock(c: number, r: number) { return this.rocks[r * COLS + c]; }
  towerAt(c: number, r: number) { return this.towers.find((t) => t.c === c && t.r === r) ?? null; }
  isEntrance(c: number, r: number) { return this.entrances.some(([ec, er]) => ec === c && er === r); }
  isExit(c: number, r: number) { return this.exits.some(([ec, er]) => ec === c && er === r); }

  /** Steps to the burrow from every tile, walking round rocks and towers (and `extra`, a tile being tried). */
  field(extra: number) {
    const d = new Int32Array(COLS * ROWS).fill(INF), open = (i: number) => !this.rocks[i] && i !== extra && !this.towers.some((t) => t.r * COLS + t.c === i);
    const q: number[] = [];
    for (const [c, r] of this.exits) { const i = r * COLS + c; if (open(i)) { d[i] = 0; q.push(i); } }
    for (let h = 0; h < q.length; h++) {
      const i = q[h], c = i % COLS, r = (i / COLS) | 0;
      for (const [dc, dr] of DIRS) {
        const nc = c + dc, nr = r + dr, n = nr * COLS + nc;
        if (!this.inGrid(nc, nr) || d[n] !== INF || !open(n)) continue;
        d[n] = d[i] + 1; q.push(n);
      }
    }
    return d;
  }

  /** The tile a ground predator on (c, r) heads for next, keeping its heading when two are equally good. */
  step(c: number, r: number, dir: [number, number], d = this.dist): [number, number] | null {
    const here = d[r * COLS + c];
    let best: [number, number] | null = null, bestD = here;
    for (const [dc, dr] of [dir, ...DIRS]) {
      const nc = c + dc, nr = r + dr;
      if (!this.inGrid(nc, nr)) continue;
      const nd = d[nr * COLS + nc];
      if (nd < bestD) { best = [dc, dr]; bestD = nd; }
    }
    return best;
  }

  /** The tiles a ground predator walks from entrance `e` to the burrow. */
  route(e: number, d = this.dist): [number, number][] {
    let [c, r] = this.entrances[e];
    const path: [number, number][] = [[c, r]];
    let dir: [number, number] = r === 0 && c > 0 ? [0, 1] : [1, 0];
    for (let guard = 0; guard < COLS * ROWS; guard++) {
      const s = this.step(c, r, dir, d);
      if (!s) break;
      dir = s; c += s[0]; r += s[1]; path.push([c, r]);
    }
    return path;
  }
  /** The longest walk from any entrance, in tiles. */
  get walk() { return Math.max(...this.entrances.map(([c, r]) => this.dist[r * COLS + c])); }

  // ---------- Building ----------

  canBuild(kind: TowerId, c: number, r: number): BuildResult {
    if (this.state === 'won' || this.state === 'lost') return 'state';
    if (!this.inGrid(c, r)) return 'bounds';
    if (this.rock(c, r) || this.towerAt(c, r) || this.isEntrance(c, r) || this.isExit(c, r)) return 'taken';
    if (this.hay < TOWERS[kind].cost) return 'hay';
    if (this.enemies.some((e) => !ENEMIES[e.kind].air && Math.floor(e.x) === c && Math.floor(e.y) === r)) return 'occupied';
    const d = this.field(r * COLS + c);
    if (this.entrances.some(([ec, er]) => d[er * COLS + ec] >= INF)) return 'blocked';
    for (const e of this.enemies) {
      if (ENEMIES[e.kind].air) continue;
      const ec = Math.floor(e.x), er = Math.floor(e.y);
      if (this.inGrid(ec, er) && d[er * COLS + ec] >= INF) return 'blocked';
    }
    return 'ok';
  }

  build(kind: TowerId, c: number, r: number): BuildResult {
    const ok = this.canBuild(kind, c, r);
    if (ok !== 'ok') return ok;
    const def = TOWERS[kind];
    this.hay -= def.cost;
    this.towers.push({ id: this.nextId++, kind, c, r, level: 0, spent: def.cost, cool: 0, target: null, aim: 0, flash: 0 });
    this.dist = this.field(-1);
    this.events.push({ type: 'build', kind });
    return 'ok';
  }

  upgradeCost(t: Tower) { return TOWERS[t.kind].upgrades[t.level] ?? null; }
  upgrade(t: Tower) {
    const cost = this.upgradeCost(t);
    if (cost === null || this.hay < cost || this.state === 'won' || this.state === 'lost') return false;
    this.hay -= cost; t.spent += cost; t.level++;
    this.effects.push({ kind: 'coin', x: t.c + 0.5, y: t.r + 0.5, r: 0.6, t: 0, max: 0.6 });
    this.events.push({ type: 'upgrade', kind: t.kind });
    return true;
  }
  refund(t: Tower) { return Math.floor(t.spent * SELL_BACK); }
  sell(t: Tower) {
    if (!this.towers.includes(t) || this.state === 'won' || this.state === 'lost') return false;
    this.hay += this.refund(t);
    this.towers = this.towers.filter((x) => x !== t);
    this.dist = this.field(-1);
    this.events.push({ type: 'sell', kind: t.kind });
    return true;
  }

  // ---------- Waves ----------

  /** Starts the next wave now. Sending it before the countdown ends pays a hay for every second saved. */
  sendWave() {
    if (this.state !== 'playing' || this.queue.length || this.wave >= TOTAL_WAVES) return false;
    if (this.countdown !== null) this.hay += Math.floor(this.countdown);
    if (this.wave > 0) this.hay += WAVE_BONUS + this.wave;
    this.wave++;
    this.countdown = null;
    let at = 0, n = 0;
    for (const [kind, count, gap] of WAVES[this.wave - 1]) {
      for (let i = 0; i < count; i++) { this.queue.push({ kind, at, entrance: n++ % this.entrances.length }); at += gap; }
      at += 1.5;
    }
    this.events.push({ type: 'wave', value: this.wave });
    return true;
  }

  pause() {
    if (this.state === 'playing') this.state = 'paused';
    else if (this.state === 'paused') this.state = 'playing';
  }

  private spawn(kind: EnemyId, entrance: number) {
    const def = ENEMIES[kind], [c, r] = this.entrances[entrance];
    const top = r === 0 && c > 0, hp = Math.round(def.hp * hpScale(this.wave) * this.map.tough);
    this.enemies.push({
      id: this.nextId++, kind, x: top ? c + 0.5 : c - 0.6, y: top ? r - 0.6 : r + 0.5, hp, maxHp: hp,
      slow: 0, slowT: 0, stun: 0, progress: 0, dir: top ? [0, 1] : [1, 0], face: 1, hit: 0, entrance, bob: this.nextId * 0.7,
    });
  }

  // ---------- The clock ----------

  update(dt: number) {
    if (this.state !== 'playing') return;
    this.time += dt;
    for (const q of this.queue) q.at -= dt;
    while (this.queue.length && this.queue[0].at <= 0) { const q = this.queue.shift()!; this.spawn(q.kind, q.entrance); }
    if (!this.queue.length && this.wave > 0 && this.wave < TOTAL_WAVES) {
      if (this.countdown === null) this.countdown = BREAK;
      this.countdown -= dt;
      if (this.countdown <= 0) this.sendWave();
    }
    for (const e of this.enemies) this.walk1(e, dt);
    for (const t of this.towers) this.fire(t, dt);
    this.fly(dt);
    for (const f of this.effects) f.t += dt;
    this.effects = this.effects.filter((f) => f.t < f.max);
    this.reap();
    if (this.raisins <= 0) { this.raisins = 0; this.state = 'lost'; this.events.push({ type: 'lost' }); return; }
    if (this.wave >= TOTAL_WAVES && !this.queue.length && !this.enemies.length) { this.state = 'won'; this.events.push({ type: 'won' }); }
  }

  private walk1(e: Enemy, dt: number) {
    const def = ENEMIES[e.kind];
    e.hit = Math.max(0, e.hit - dt);
    if (e.stun > 0) { e.stun -= dt; return; }
    e.slowT -= dt;
    if (e.slowT <= 0) e.slow = 0;
    let budget = def.speed * (1 - e.slow * (1 - def.slowResist)) * dt;
    e.bob += budget * 6;
    for (let guard = 0; guard < 4 && budget > 1e-6; guard++) {
      let tx: number, ty: number;
      if (def.air) { const [xc, xr] = this.exits[Math.floor(this.exits.length / 2)]; tx = xc + 1.6; ty = xr + (this.exits.length > 1 ? 0 : 0.5); }
      else {
        const c = Math.floor(e.x), r = Math.floor(e.y);
        if (!this.inGrid(c, r)) { const [ec, er] = this.entrances[e.entrance]; tx = ec + 0.5; ty = er + 0.5; if (c >= COLS) { tx = COLS + 1; ty = e.y; } }
        else if (this.isExit(c, r)) { tx = COLS + 1; ty = r + 0.5; }
        else {
          const s = this.step(c, r, e.dir);
          if (!s) return;
          e.dir = s; tx = c + s[0] + 0.5; ty = r + s[1] + 0.5;
        }
      }
      const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy);
      if (Math.abs(dx) > 0.02) e.face = dx > 0 ? 1 : -1;
      const move = Math.min(d, budget);
      if (d > 1e-6) { e.x += (dx / d) * move; e.y += (dy / d) * move; }
      e.progress += move; budget -= move;
      if (e.x >= COLS + 0.4) { this.leak(e); return; }
      if (move < 1e-6) break;
    }
  }

  private leak(e: Enemy) {
    const steal = ENEMIES[e.kind].steal;
    this.raisins -= steal; this.leaked++;
    e.hp = -Infinity;
    this.effects.push({ kind: 'leak', x: COLS - 0.5, y: e.y, r: 0.8, t: 0, max: 0.8, value: steal });
    this.events.push({ type: 'leak', kind: e.kind, value: steal });
  }

  canHit(hits: Hits, e: Enemy) { const air = ENEMIES[e.kind].air; return hits === 'both' || (hits === 'air' && air) || (hits === 'ground' && !air); }

  private inRange(t: Tower, lv: Level) {
    const x = t.c + 0.5, y = t.r + 0.5, def = TOWERS[t.kind];
    return this.enemies.filter((e) => e.hp > 0 && e.x > -0.2 && e.y > -0.2 && this.canHit(def.hits, e) && Math.hypot(e.x - x, e.y - y) <= lv.range + ENEMIES[e.kind].r * 0.5);
  }

  private fire(t: Tower, dt: number) {
    const def = TOWERS[t.kind], lv = def.levels[t.level];
    t.flash = Math.max(0, t.flash - dt);
    if (def.kind === 'wall') return;
    t.cool -= dt;
    if (t.cool > 0) return;
    const near = this.inRange(t, lv);
    if (!near.length) { t.cool = 0; t.target = null; return; }
    const x = t.c + 0.5, y = t.r + 0.5;
    t.cool = lv.rate; t.flash = 0.25;
    if (def.kind === 'aura') {
      this.effects.push({ kind: 'puff', x, y, r: lv.range, t: 0, max: 0.6 });
      for (const e of near) { this.hurt(e, lv.dmg); e.slow = Math.max(e.slow, lv.slow ?? 0); e.slowT = 0.9; }
      return;
    }
    if (def.kind === 'ring') {
      this.effects.push({ kind: 'ring', x, y, r: lv.range, t: 0, max: 0.7 });
      for (const e of near) { this.hurt(e, lv.dmg); e.stun = Math.max(e.stun, (lv.stun ?? 0) * (1 - ENEMIES[e.kind].stunResist)); }
      return;
    }
    // Shooters take the predator furthest along its way.
    const target = near.reduce((a, b) => (b.progress > a.progress ? b : a));
    t.target = target.id; t.aim = Math.atan2(target.y - y, target.x - x);
    if (def.kind === 'lob') {
      const d = Math.hypot(target.x - x, target.y - y), total = 0.25 + d / 5;
      // Lead the target a little: aim where it will be when the boulder lands.
      const lead = ENEMIES[target.kind].speed * (1 - target.slow) * total * (target.stun > 0 ? 0 : 1);
      const tx = target.x + target.dir[0] * lead * 0.7, ty = target.y + target.dir[1] * lead * 0.7;
      this.shots.push({ id: this.nextId++, kind: 'boulder', x, y, sx: x, sy: y, tx, ty, target: null, speed: 0, dmg: lv.dmg, splash: lv.splash ?? 0.8, hits: def.hits, t: 0, total });
      return;
    }
    this.shots.push({ id: this.nextId++, kind: t.kind === 'glider' ? 'glider' : 'pellet', x, y, sx: x, sy: y, tx: target.x, ty: target.y, target: target.id, speed: t.kind === 'glider' ? 8 : 10, dmg: lv.dmg, splash: 0, hits: def.hits, t: 0, total: 0 });
  }

  private fly(dt: number) {
    for (const s of this.shots) {
      s.t += dt;
      if (s.kind === 'boulder') {
        const p = Math.min(1, s.t / s.total);
        s.x = s.sx + (s.tx - s.sx) * p; s.y = s.sy + (s.ty - s.sy) * p;
        if (p < 1) continue;
        this.effects.push({ kind: 'boom', x: s.tx, y: s.ty, r: s.splash, t: 0, max: 0.45 });
        for (const e of this.enemies) if (e.hp > 0 && this.canHit(s.hits, e) && Math.hypot(e.x - s.tx, e.y - s.ty) <= s.splash + ENEMIES[e.kind].r) this.hurt(e, s.dmg);
        s.total = -1;
        continue;
      }
      const target = this.enemies.find((e) => e.id === s.target && e.hp > 0);
      if (target) { s.tx = target.x; s.ty = target.y; }
      const dx = s.tx - s.x, dy = s.ty - s.y, d = Math.hypot(dx, dy), step = s.speed * dt;
      if (d > step + 0.05) { s.x += (dx / d) * step; s.y += (dy / d) * step; continue; }
      if (target) { this.hurt(target, s.dmg); this.effects.push({ kind: 'hit', x: s.tx, y: s.ty, r: 0.25, t: 0, max: 0.2 }); }
      s.total = -1;
    }
    this.shots = this.shots.filter((s) => s.total !== -1);
  }

  hurt(e: Enemy, dmg: number) {
    if (e.hp <= 0 || dmg <= 0) return;
    e.hp -= Math.max(1, dmg - ENEMIES[e.kind].armor);
    e.hit = 0.12;
  }

  private reap() {
    const gone = this.enemies.filter((e) => e.hp <= 0);
    if (!gone.length) return;
    this.enemies = this.enemies.filter((e) => e.hp > 0);
    for (const e of gone) {
      if (e.hp === -Infinity) continue;
      const bounty = ENEMIES[e.kind].bounty;
      this.hay += bounty; this.kills++;
      this.effects.push({ kind: 'coin', x: e.x, y: e.y, r: 0.5, t: 0, max: 0.8, value: bounty });
      this.events.push({ type: 'kill', kind: e.kind, value: bounty });
    }
  }
}
