// Fluff Forge: build a side-scrolling course out of parts, then run it as Dora or Enzo.
// A course is a grid of one-character parts, ROWS tall and `cols` wide, stored column by column.
// This engine is deterministic (fixed steps, no randomness) so tests and the bot can drive it directly.

export const TILE = 16, ROWS = 15, VIEW_W = 400, VIEW_H = ROWS * TILE;
export const MIN_COLS = 25, MAX_COLS = 240, DEFAULT_COLS = 100;
export const TIMES = [100, 200, 300, 400, 500];
export const CODE_PREFIX = 'FLUFF-';

export type HeroId = 'dora' | 'enzo';
export type ThemeId = 'meadow' | 'salt' | 'cave' | 'snow';
export const THEMES: { id: ThemeId; name: string }[] = [
  { id: 'meadow', name: 'Andean meadow' }, { id: 'salt', name: 'Salt flats' }, { id: 'cave', name: 'Night cave' }, { id: 'snow', name: 'Snowcap' },
];
export const HEROES: Record<HeroId, { name: string; walk: number; run: number; jump: number; perk: string }> = {
  dora: { name: 'Dora', walk: 85, run: 135, jump: 330, perk: 'jumps higher' },
  enzo: { name: 'Enzo', walk: 95, run: 155, jump: 305, perk: 'runs faster' },
};

export type Group = 'terrain' | 'blocks' | 'items' | 'enemies' | 'markers';
export type Part = { ch: string; id: string; name: string; group: Group; hint: string };
export const PARTS: Part[] = [
  { ch: '#', id: 'ground', name: 'Ground', group: 'terrain', hint: 'Solid earth.' },
  { ch: 'H', id: 'stone', name: 'Stone', group: 'terrain', hint: 'A block nothing can break.' },
  { ch: 'I', id: 'ice', name: 'Ice', group: 'terrain', hint: 'Slippery: slow to speed up and slow to stop.' },
  { ch: '=', id: 'cloud', name: 'Cloud ledge', group: 'terrain', hint: 'Jump up through it, land on top. Hold down to drop through.' },
  { ch: 'M', id: 'lift', name: 'Drifting cloud', group: 'terrain', hint: 'A three-wide cloud that drifts left and right.' },
  { ch: '^', id: 'spikes', name: 'Cactus spikes', group: 'terrain', hint: 'Hurts on touch.' },
  { ch: 'B', id: 'brick', name: 'Adobe brick', group: 'blocks', hint: 'Bump it from below. Breaks if you have a power-up.' },
  { ch: '?', id: 'raisin-block', name: 'Raisin block', group: 'blocks', hint: 'Bump it for a raisin.' },
  { ch: 'C', id: 'clover-block', name: 'Clover block', group: 'blocks', hint: 'Bump it for a clover: grow big, break bricks, survive a hit.' },
  { ch: 'F', id: 'feather-block', name: 'Feather block', group: 'blocks', hint: 'Bump it for a condor feather: a second jump in the air and a slow fall.' },
  { ch: 'o', id: 'raisin', name: 'Raisin', group: 'items', hint: 'Collect them all.' },
  { ch: 'S', id: 'spring', name: 'Spring', group: 'items', hint: 'Land on it to fly. Hold jump for extra height.' },
  { ch: 'b', id: 'beetle', name: 'Beetle', group: 'enemies', hint: 'Walks back and forth. Stomp it.' },
  { ch: 'f', id: 'frog', name: 'Frog', group: 'enemies', hint: 'Hops toward you. Stomp it.' },
  { ch: 'v', id: 'bat', name: 'Bat', group: 'enemies', hint: 'Flutters after you when you come close. Stomp it.' },
  { ch: 'x', id: 'prickle', name: 'Prickle', group: 'enemies', hint: 'A walking cactus. Never stomp it; bump the block under it instead.' },
  { ch: 'P', id: 'checkpoint', name: 'Checkpoint', group: 'markers', hint: 'Touch it to restart from here.' },
  { ch: '@', id: 'start', name: 'Start', group: 'markers', hint: 'Where the run begins. One per course.' },
  { ch: 'G', id: 'goal', name: 'Goal flag', group: 'markers', hint: 'Reach it to clear the course. One per course.' },
];
const PART_CHARS = new Set(['.', ...PARTS.map((p) => p.ch)]);
/** Blocks you can stand on and bump. 'U' is a block that has already given up its prize. */
const SOLID = new Set(['#', 'H', 'I', '^', 'B', '?', 'C', 'F', 'U']);
const ENEMY_OF: Record<string, EnemyKind> = { b: 'beetle', f: 'frog', v: 'bat', x: 'prickle' };

export type Course = { title: string; theme: ThemeId; cols: number; time: number; tiles: string };
export type Input = { left: boolean; right: boolean; jump: boolean; run: boolean; down: boolean; swap: boolean };
export const NO_INPUT: Input = { left: false, right: false, jump: false, run: false, down: false, swap: false };

export type Power = 'small' | 'clover' | 'feather';
export type Hero = {
  x: number; y: number; vx: number; vy: number; w: number; h: number; face: 1 | -1; ground: boolean;
  power: Power; hurt: number; coyote: number; buffer: number; held: boolean; flutter: number; ride: number; drop: number; run: number;
};
export type EnemyKind = 'beetle' | 'frog' | 'bat' | 'prickle';
export type Enemy = { kind: EnemyKind; x: number; y: number; w: number; h: number; vx: number; vy: number; dir: 1 | -1; t: number; home: number; awake: boolean; ground: boolean; dead: number; flip: boolean };
export type Item = { kind: 'clover' | 'feather'; x: number; y: number; vx: number; vy: number; rise: number; t: number; dir: 1 | -1 };
export type Lift = { cx: number; y: number; x: number; w: number; dx: number };
export type Fx = { kind: 'brick' | 'raisin' | 'poof' | 'stomp' | 'grow'; x: number; y: number; age: number };
export type Flag = { x: number; y: number; taken: boolean };
export type State = 'play' | 'dying' | 'clear';
export type Result = { time: number; raisins: number; deaths: number };

const SIZE: Record<EnemyKind, [number, number]> = { beetle: [14, 10], frog: [14, 12], bat: [14, 10], prickle: [14, 14] };
const SMALL_H = 14, BIG_H = 24, HERO_W = 12;
const LIFT_W = 48, LIFT_SWING = 40, LIFT_PERIOD = 4;
const RISE = { up: 950, down: 1900, fall: 360, float: 70 };

export const index = (c: number, r: number) => c * ROWS + r;
const approach = (v: number, target: number, step: number) => (v < target ? Math.min(target, v + step) : Math.max(target, v - step));
const overlap = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const count = (s: string, ch: string) => s.split(ch).length - 1;

export class FluffForgeGame {
  course: Course;
  cols: number;
  tiles: string[] = [];
  hero!: Hero;
  heroId: HeroId;
  enemies: Enemy[] = [];
  items: Item[] = [];
  lifts: Lift[] = [];
  fx: Fx[] = [];
  flags: Flag[] = [];
  goal = { x: 0, y: 0 };
  start = { x: 0, y: 0 };
  /** Tiles mid-bounce after a bump, and springs mid-squash, by tile index → seconds left. */
  bumps = new Map<number, number>();
  springs = new Map<number, number>();
  state: State = 'play';
  stateT = 0;
  t = 0;
  clock = 0;
  elapsed = 0;
  raisins = 0;
  saved = 0;
  deaths = 0;
  cam = 0;
  result: Result | null = null;
  cause = '';
  events: string[] = [];
  private checkpoint: Flag | null = null;
  /** Raisins and raisin blocks already cashed in when the last checkpoint was touched, so a restart can't pay them twice. */
  private spent: number[] = [];
  private last: Input = { ...NO_INPUT };

  constructor(course: Course, hero: HeroId = 'dora') {
    this.course = course;
    this.cols = course.cols;
    this.heroId = hero;
    this.build();
    this.cam = this.camTarget();
  }

  /** Lay the course out fresh: tiles, enemies and lifts back where the maker put them, and the hero at the start or checkpoint. */
  private build() {
    const { tiles, cols } = this.course;
    this.tiles = tiles.split('');
    this.enemies = []; this.items = []; this.lifts = []; this.fx = [];
    this.bumps.clear(); this.springs.clear();
    const firstBuild = this.flags.length === 0;
    for (let c = 0; c < cols; c++) for (let r = 0; r < ROWS; r++) {
      const i = index(c, r), ch = this.tiles[i];
      const kind = ENEMY_OF[ch];
      if (kind) {
        const [w, h] = SIZE[kind];
        const y = kind === 'bat' ? r * TILE + 3 : (r + 1) * TILE - h;
        this.enemies.push({ kind, x: c * TILE + (TILE - w) / 2, y, w, h, vx: 0, vy: 0, dir: -1, t: 0, home: y, awake: false, ground: false, dead: 0, flip: false });
        this.tiles[i] = '.';
      } else if (ch === 'M') {
        this.lifts.push({ cx: c * TILE + TILE / 2, y: r * TILE + 4, x: c * TILE + TILE / 2 - LIFT_W / 2, w: LIFT_W, dx: 0 });
        this.tiles[i] = '.';
      } else if (ch === 'P') {
        if (firstBuild) this.flags.push({ x: c * TILE, y: (r + 1) * TILE, taken: false });
        this.tiles[i] = '.';
      } else if (ch === 'G') {
        this.goal = { x: c * TILE, y: (r + 1) * TILE };
        this.tiles[i] = '.';
      } else if (ch === '@') {
        this.start = { x: c * TILE + (TILE - HERO_W) / 2, y: (r + 1) * TILE };
        this.tiles[i] = '.';
      }
    }
    for (const i of this.spent) this.tiles[i] = this.tiles[i] === '?' ? 'U' : '.';
    this.liftStep();
    const at = this.checkpoint ? { x: this.checkpoint.x + (TILE - HERO_W) / 2, y: this.checkpoint.y } : this.start;
    this.hero = { x: at.x, y: at.y - SMALL_H, vx: 0, vy: 0, w: HERO_W, h: SMALL_H, face: 1, ground: false, power: 'small', hurt: 0, coyote: 0, buffer: 0, held: false, flutter: 0, ride: -1, drop: 0, run: 0 };
    this.raisins = this.saved;
    this.clock = this.course.time;
    this.state = 'play';
    this.stateT = 0;
  }

  tile(c: number, r: number) {
    if (r < 0 || r >= ROWS) return '.';
    if (c < 0 || c >= this.cols) return 'H';
    return this.tiles[index(c, r)];
  }
  private solid(c: number, r: number) { return SOLID.has(this.tile(c, r)); }

  step(dt: number, input: Input) {
    this.t += dt;
    const pressed = (k: keyof Input) => input[k] && !this.last[k];
    for (const timers of [this.bumps, this.springs]) {
      for (const [k, v] of timers) {
        if (v - dt <= 0) timers.delete(k);
        else timers.set(k, v - dt);
      }
    }
    for (const f of this.fx) f.age += dt;
    this.fx = this.fx.filter((f) => f.age < 0.7);
    this.liftStep();
    if (this.state === 'dying') {
      this.stateT += dt;
      const h = this.hero;
      if (this.stateT > 0.35) { h.vy = Math.min(h.vy + RISE.down * dt, RISE.fall); h.y += h.vy * dt; }
      if (this.stateT > 1.5) this.build();
    } else if (this.state === 'clear') {
      this.stateT += dt;
      const h = this.hero;
      h.vx = 60; h.face = 1;
      this.moveHero(dt, NO_INPUT);
    } else {
      if (pressed('swap')) { this.heroId = this.heroId === 'dora' ? 'enzo' : 'dora'; this.events.push('swap'); }
      this.clock -= dt;
      this.elapsed += dt;
      this.control(dt, input, pressed('jump'));
      this.moveHero(dt, input);
      this.enemyStep(dt);
      this.itemStep(dt);
      this.touch(input);
      if (this.clock <= 0) this.die('Time up');
      else if (this.hero.y > VIEW_H + 16) this.die('Fell');
    }
    this.cam = Math.max(0, Math.min(this.cols * TILE - VIEW_W, this.cam + (this.camTarget() - this.cam) * Math.min(1, dt * 8)));
    this.last = { ...input };
  }

  private camTarget() {
    return Math.max(0, Math.min(this.cols * TILE - VIEW_W, this.hero.x + this.hero.w / 2 - VIEW_W / 2 + this.hero.face * 24));
  }

  private liftStep() {
    for (const l of this.lifts) {
      const x = l.cx - l.w / 2 + Math.sin((this.t * Math.PI * 2) / LIFT_PERIOD) * LIFT_SWING;
      l.dx = x - l.x;
      l.x = x;
    }
  }

  /** Running, skidding, jumping and the feather's flutter. */
  private control(dt: number, input: Input, jumped: boolean) {
    const h = this.hero, stats = HEROES[this.heroId];
    if (h.ride >= 0) h.x += this.lifts[h.ride].dx;
    const ice = h.ground && this.underfoot() === 'I';
    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const max = input.run ? stats.run : stats.walk;
    if (dir) {
      let accel = h.ground ? (ice ? 160 : 520) : 360;
      if (h.ground && !ice && Math.sign(h.vx) === -dir) accel *= 2;
      if (dir * h.vx < max) h.vx = Math.min(max, dir * h.vx + accel * dt) * dir;
      else h.vx = approach(h.vx, dir * max, 300 * dt);
      h.face = dir as 1 | -1;
    } else if (h.ground) h.vx = approach(h.vx, 0, (ice ? 80 : 600) * dt);
    h.buffer = jumped ? 0.1 : h.buffer - dt;
    h.coyote = h.ground ? 0.08 : h.coyote - dt;
    if (h.buffer > 0 && h.coyote > 0) {
      h.vy = -(stats.jump + Math.abs(h.vx) * 0.12);
      h.ground = false; h.coyote = 0; h.buffer = 0; h.held = true; h.ride = -1;
      this.events.push('jump');
    } else if (h.buffer > 0 && !h.ground && h.power === 'feather' && h.flutter > 0) {
      h.vy = -stats.jump * 0.85;
      h.flutter--; h.buffer = 0; h.held = true;
      this.events.push('flutter');
    }
    if (!input.jump) h.held = false;
    if (input.down && h.ground && this.onLedge()) { h.drop = 0.2; h.ground = false; h.ride = -1; }
    h.drop -= dt;
    h.hurt -= dt;
    h.run = h.ground ? h.run + Math.abs(h.vx) * dt : h.run;
    const g = h.vy < 0 && h.held ? RISE.up : RISE.down;
    h.vy = Math.min(h.vy + g * dt, RISE.fall);
    if (h.power === 'feather' && input.jump && h.vy > RISE.float) h.vy = RISE.float;
  }

  private underfoot() {
    const h = this.hero, r = Math.floor((h.y + h.h + 1) / TILE);
    const a = this.tile(Math.floor(h.x / TILE), r), b = this.tile(Math.floor((h.x + h.w - 0.01) / TILE), r);
    return a === 'I' || b === 'I' ? 'I' : a;
  }
  private onLedge() {
    const h = this.hero, r = Math.floor((h.y + h.h + 1) / TILE);
    if (h.ride >= 0) return true;
    for (let c = Math.floor(h.x / TILE); c <= Math.floor((h.x + h.w - 0.01) / TILE); c++) if (this.solid(c, r)) return false;
    return this.tile(Math.floor((h.x + h.w / 2) / TILE), r) === '=';
  }

  private moveHero(dt: number, input: Input) {
    const h = this.hero;
    h.x += h.vx * dt;
    if (h.vx > 0) {
      const c = Math.floor((h.x + h.w - 0.01) / TILE);
      for (let r = Math.floor(h.y / TILE); r <= Math.floor((h.y + h.h - 0.01) / TILE); r++) if (this.solid(c, r)) { h.x = c * TILE - h.w; h.vx = 0; break; }
    } else if (h.vx < 0) {
      const c = Math.floor(h.x / TILE);
      for (let r = Math.floor(h.y / TILE); r <= Math.floor((h.y + h.h - 0.01) / TILE); r++) if (this.solid(c, r)) { h.x = (c + 1) * TILE; h.vx = 0; break; }
    }
    const prevBottom = h.y + h.h;
    h.y += h.vy * dt;
    h.ground = false;
    const left = Math.floor(h.x / TILE), right = Math.floor((h.x + h.w - 0.01) / TILE);
    if (h.vy >= 0) {
      const r = Math.floor((h.y + h.h - 0.01) / TILE);
      const top = r * TILE;
      let land = '', at = -1;
      for (let c = left; c <= right; c++) {
        const ch = this.tile(c, r);
        if (SOLID.has(ch) || ((ch === '=' || ch === 'S') && prevBottom <= top + 0.5 && h.drop <= 0)) {
          if (!land || ch === 'S' || (land !== 'S' && ch === '^')) { land = ch; at = index(c, r); }
        }
      }
      if (land) { h.y = top - h.h; h.vy = 0; h.ground = true; h.ride = -1; h.flutter = 1; }
      else {
        h.ride = -1;
        this.lifts.forEach((l, i) => {
          if (h.drop <= 0 && prevBottom <= l.y + 0.5 && h.y + h.h >= l.y && h.x + h.w > l.x && h.x < l.x + l.w) {
            h.y = l.y - h.h; h.vy = 0; h.ground = true; h.ride = i; h.flutter = 1;
          }
        });
      }
      if (land === 'S' && this.state === 'play') {
        h.vy = input.jump ? -640 : -520; h.ground = false; h.held = input.jump;
        this.springs.set(at, 0.25);
        this.events.push('spring');
      }
    } else {
      const r = Math.floor(h.y / TILE);
      const hits = [];
      for (let c = left; c <= right; c++) if (this.solid(c, r)) hits.push(c);
      if (hits.length) {
        h.y = (r + 1) * TILE; h.vy = 0;
        const mid = Math.floor((h.x + h.w / 2) / TILE);
        this.bump(hits.includes(mid) ? mid : hits[0], r);
      }
    }
  }

  /** Something hit a block from below. */
  private bump(c: number, r: number) {
    const i = index(c, r), ch = this.tiles[i];
    this.bumps.set(i, 0.15);
    for (const e of this.enemies) {
      if (!e.dead && Math.abs(e.y + e.h - r * TILE) < 3 && e.x + e.w > c * TILE && e.x < (c + 1) * TILE) this.kill(e, true);
    }
    if (ch === '?') { this.tiles[i] = 'U'; this.raisins++; this.fx.push({ kind: 'raisin', x: c * TILE + 8, y: r * TILE, age: 0 }); this.events.push('raisin'); }
    else if (ch === 'C' || ch === 'F') {
      this.tiles[i] = 'U';
      this.items.push({ kind: ch === 'C' ? 'clover' : 'feather', x: c * TILE + 2, y: r * TILE + 2, vx: 0, vy: 0, rise: 0.5, t: 0, dir: 1 });
      this.events.push('sprout');
    } else if (ch === 'B' && this.hero.power !== 'small') {
      this.tiles[i] = '.';
      this.bumps.delete(i);
      this.fx.push({ kind: 'brick', x: c * TILE + 8, y: r * TILE + 8, age: 0 });
      this.events.push('break');
    } else this.events.push('bump');
  }

  private kill(e: Enemy, flip: boolean) {
    e.dead = flip ? 2 : 0.45;
    e.flip = flip;
    if (flip) { e.vy = -200; e.vx = 30 * e.dir; }
    this.fx.push({ kind: 'stomp', x: e.x + e.w / 2, y: e.y + e.h, age: 0 });
    this.events.push(flip ? 'kick' : 'stomp');
  }

  /** Move a walker or hopper one step against the tiles. Returns true when it bumped a wall. */
  private walk(e: { x: number; y: number; w: number; h: number; vx: number; vy: number; ground: boolean }, dt: number) {
    let wall = false;
    e.x += e.vx * dt;
    const r0 = Math.floor(e.y / TILE), r1 = Math.floor((e.y + e.h - 0.01) / TILE);
    if (e.vx > 0) { const c = Math.floor((e.x + e.w - 0.01) / TILE); for (let r = r0; r <= r1; r++) if (this.solid(c, r)) { e.x = c * TILE - e.w; wall = true; break; } }
    else if (e.vx < 0) { const c = Math.floor(e.x / TILE); for (let r = r0; r <= r1; r++) if (this.solid(c, r)) { e.x = (c + 1) * TILE; wall = true; break; } }
    const prev = e.y + e.h;
    e.vy = Math.min(e.vy + RISE.down * dt, RISE.fall);
    e.y += e.vy * dt;
    e.ground = false;
    if (e.vy >= 0) {
      const r = Math.floor((e.y + e.h - 0.01) / TILE);
      for (let c = Math.floor(e.x / TILE); c <= Math.floor((e.x + e.w - 0.01) / TILE); c++) {
        const ch = this.tile(c, r);
        if (SOLID.has(ch) || ((ch === '=' || ch === 'S') && prev <= r * TILE + 0.5)) { e.y = r * TILE - e.h; e.vy = 0; e.ground = true; break; }
      }
      if (!e.ground) for (const l of this.lifts) if (prev <= l.y + 0.5 && e.y + e.h >= l.y && e.x + e.w > l.x && e.x < l.x + l.w) { e.y = l.y - e.h; e.vy = 0; e.ground = true; e.x += l.dx; }
    } else {
      const r = Math.floor(e.y / TILE);
      for (let c = Math.floor(e.x / TILE); c <= Math.floor((e.x + e.w - 0.01) / TILE); c++) if (this.solid(c, r)) { e.y = (r + 1) * TILE; e.vy = 0; break; }
    }
    return wall;
  }

  private enemyStep(dt: number) {
    const h = this.hero, centre = this.cam + VIEW_W / 2;
    for (const e of this.enemies) {
      if (!e.awake && Math.abs(e.x - centre) < VIEW_W * 0.75) e.awake = true;
      if (!e.awake) continue;
      if (e.dead) {
        e.dead -= dt;
        if (e.flip) { e.vy += RISE.down * dt; e.y += e.vy * dt; e.x += e.vx * dt; }
        continue;
      }
      e.t += dt;
      if (e.kind === 'bat') {
        const dx = h.x - e.x;
        e.vx = Math.abs(dx) < 170 ? approach(e.vx, Math.sign(dx) * 45, 120 * dt) : approach(e.vx, 0, 120 * dt);
        if (e.vx) e.dir = e.vx > 0 ? 1 : -1;
        e.x += e.vx * dt;
        e.y = e.home + Math.sin(e.t * 3) * 18;
        continue;
      }
      if (e.kind === 'frog') {
        if (e.ground) {
          e.vx = 0;
          e.dir = h.x < e.x ? -1 : 1;
          if (e.t > 1.1) { e.vy = -250; e.vx = 55 * e.dir; e.t = 0; this.events.push('hop'); }
        }
        if (this.walk(e, dt)) e.vx = 0;
      } else {
        e.vx = (e.kind === 'beetle' ? 32 : 26) * e.dir;
        if (e.kind === 'prickle' && e.ground) {
          const ahead = Math.floor((e.dir > 0 ? e.x + e.w + 1 : e.x - 1) / TILE), below = Math.floor((e.y + e.h + 1) / TILE);
          const t = this.tile(ahead, below);
          if (!SOLID.has(t) && t !== '=' && t !== 'S') e.dir = -e.dir as 1 | -1;
        }
        if (this.walk(e, dt)) e.dir = -e.dir as 1 | -1;
      }
    }
    this.enemies = this.enemies.filter((e) => (e.dead ? e.dead > 0 : e.y < VIEW_H + 32));
  }

  private itemStep(dt: number) {
    for (const it of this.items) {
      it.t += dt;
      if (it.rise > 0) { it.rise -= dt; it.y -= (TILE / 0.5) * dt; continue; }
      if (it.kind === 'clover') {
        it.vx = 50 * it.dir;
        const box = { x: it.x, y: it.y, w: 12, h: 12, vx: it.vx, vy: it.vy, ground: false };
        if (this.walk(box, dt)) it.dir = -it.dir as 1 | -1;
        it.x = box.x; it.y = box.y; it.vy = box.vy;
      } else {
        it.y += 24 * dt;
        it.x += Math.cos(it.t * 2.2) * 30 * dt;
      }
    }
    this.items = this.items.filter((it) => it.y < VIEW_H + 16);
  }

  /** Everything the hero can touch: raisins, spikes, power-ups, enemies, checkpoints and the goal. */
  private touch(input: Input) {
    const h = this.hero;
    for (let c = Math.floor(h.x / TILE); c <= Math.floor((h.x + h.w - 0.01) / TILE); c++) {
      for (let r = Math.floor(h.y / TILE); r <= Math.floor((h.y + h.h - 0.01) / TILE); r++) {
        if (this.tile(c, r) === 'o') { this.tiles[index(c, r)] = '.'; this.raisins++; this.events.push('raisin'); }
      }
    }
    // Spikes hurt from any side: check the ring of tiles just outside the hero.
    const x0 = Math.floor((h.x - 1) / TILE), x1 = Math.floor((h.x + h.w) / TILE), y0 = Math.floor((h.y - 1) / TILE), y1 = Math.floor((h.y + h.h) / TILE);
    let spiked = false;
    for (let c = x0; c <= x1; c++) for (let r = y0; r <= y1; r++) {
      if (this.tile(c, r) !== '^') continue;
      const box = { x: c * TILE, y: r * TILE, w: TILE, h: TILE };
      if (overlap({ x: h.x - 0.5, y: h.y - 0.5, w: h.w + 1, h: h.h + 1.5 }, box)) spiked = true;
    }
    if (spiked && h.hurt <= 0) { this.hurt(); if (this.state === 'play') h.vy = -260; }
    const got = this.items.filter((it) => it.rise <= 0 && overlap(h, { x: it.x, y: it.y, w: 12, h: 12 }));
    this.items = this.items.filter((it) => !got.includes(it));
    for (const it of got) this.powerUp(it.kind);
    for (const e of this.enemies) {
      if (e.dead || this.state !== 'play' || !overlap(h, e)) continue;
      const stomp = h.vy > 0 && h.y + h.h - h.vy / 120 <= e.y + 6;
      if (stomp && e.kind !== 'prickle') {
        this.kill(e, false);
        h.vy = input.jump ? -340 : -220; h.held = input.jump; h.flutter = 1;
      } else this.hurt();
    }
    for (const f of this.flags) {
      if (!f.taken && h.x + h.w > f.x + 4 && h.x < f.x + TILE - 4) {
        f.taken = true; this.checkpoint = f; this.saved = this.raisins;
        this.spent = [];
        this.tiles.forEach((ch, i) => { const was = this.course.tiles[i]; if ((was === 'o' && ch === '.') || (was === '?' && ch === 'U')) this.spent.push(i); });
        this.events.push('checkpoint');
      }
    }
    if (this.state === 'play' && h.x + h.w / 2 >= this.goal.x + TILE / 2) {
      this.state = 'clear'; this.stateT = 0;
      this.result = { time: this.elapsed, raisins: this.raisins, deaths: this.deaths };
      this.events.push('clear');
    }
  }

  private powerUp(kind: 'clover' | 'feather') {
    const h = this.hero;
    if (h.power === 'small') { h.y -= BIG_H - SMALL_H; h.h = BIG_H; this.fx.push({ kind: 'grow', x: h.x + h.w / 2, y: h.y + h.h / 2, age: 0 }); }
    h.power = kind;
    h.flutter = 1;
    this.events.push('power');
  }

  private hurt() {
    const h = this.hero;
    if (h.hurt > 0 || this.state !== 'play') return;
    if (h.power === 'small') return this.die('Ouch');
    h.power = 'small';
    h.y += BIG_H - SMALL_H; h.h = SMALL_H;
    h.hurt = 1.5;
    this.fx.push({ kind: 'poof', x: h.x + h.w / 2, y: h.y + h.h / 2, age: 0 });
    this.events.push('shrink');
  }

  private die(cause: string) {
    if (this.state !== 'play') return;
    this.state = 'dying'; this.stateT = 0; this.cause = cause;
    this.deaths++;
    const h = this.hero;
    h.vx = 0; h.vy = -330;
    this.events.push('die');
  }

  /** A copy that can be stepped on its own, for the bot's search. */
  clone(): FluffForgeGame {
    const g = Object.assign(Object.create(FluffForgeGame.prototype), this) as FluffForgeGame;
    g.tiles = this.tiles.slice();
    g.hero = { ...this.hero };
    g.enemies = this.enemies.map((e) => ({ ...e }));
    g.items = this.items.map((i) => ({ ...i }));
    g.lifts = this.lifts.map((l) => ({ ...l }));
    g.fx = this.fx.map((f) => ({ ...f }));
    g.flags = this.flags.map((f) => ({ ...f }));
    g.checkpoint = this.checkpoint ? g.flags[this.flags.indexOf(this.checkpoint)] : null;
    g.bumps = new Map(this.bumps);
    g.springs = new Map(this.springs);
    g.events = this.events.slice();
    g.last = { ...this.last };
    g.spent = this.spent.slice();
    return g;
  }
}

// ---------- Courses: building, editing, checking and sharing ----------

/** An empty course: a start, a goal and two rows of ground to stand on. */
export function blankCourse(cols = DEFAULT_COLS, theme: ThemeId = 'meadow', title = 'My course'): Course {
  const t: string[] = Array(cols * ROWS).fill('.');
  for (let c = 0; c < cols; c++) { t[index(c, ROWS - 1)] = '#'; t[index(c, ROWS - 2)] = '#'; }
  t[index(2, ROWS - 3)] = '@';
  t[index(cols - 4, ROWS - 3)] = 'G';
  return { title, theme, cols, time: 300, tiles: t.join('') };
}

/** Put one part in a cell. Start and goal are unique, so placing one moves it. Returns the same course when nothing changes. */
export function paint(course: Course, c: number, r: number, ch: string): Course {
  if (c < 0 || c >= course.cols || r < 0 || r >= ROWS || !PART_CHARS.has(ch)) return course;
  const i = index(c, r);
  if (course.tiles[i] === ch) return course;
  let tiles = course.tiles;
  if (ch === '@' || ch === 'G') tiles = tiles.split(ch).join('.');
  tiles = tiles.slice(0, i) + ch + tiles.slice(i + 1);
  return { ...course, tiles };
}

/** Grow or shrink a course to `cols` columns. New columns get ground; the goal is kept inside. */
export function resize(course: Course, cols: number): Course {
  cols = Math.max(MIN_COLS, Math.min(MAX_COLS, Math.round(cols)));
  if (cols === course.cols) return course;
  const blank = blankCourse(cols);
  let tiles = '';
  for (let c = 0; c < cols; c++) {
    const src = c < course.cols ? course.tiles.slice(c * ROWS, (c + 1) * ROWS) : blank.tiles.slice(c * ROWS, (c + 1) * ROWS).replace(/[@G]/g, '.');
    tiles += src;
  }
  const next = { ...course, cols, tiles };
  if (!tiles.includes('G') && course.tiles.includes('G')) return paint(next, cols - 4, ROWS - 3, 'G');
  return next;
}

/** What stops a course from being played, in words for the maker. Empty when it is ready. */
export function problems(course: Course): string[] {
  const out: string[] = [];
  const starts = count(course.tiles, '@'), goals = count(course.tiles, 'G');
  if (starts === 0) out.push('Place a start.');
  if (goals === 0) out.push('Place a goal flag.');
  if (starts > 1 || goals > 1) out.push('Only one start and one goal allowed.');
  return out;
}

/** Draw a course back out as rows, top to bottom. */
export function toRows(course: Course): string[] {
  return Array.from({ length: ROWS }, (_, r) => Array.from({ length: course.cols }, (_, c) => course.tiles[index(c, r)]).join(''));
}

const rle = (s: string) => s.replace(/(.)\1*/g, (run, ch) => (run.length > 1 ? run.length : '') + ch);
const unrle = (s: string) => s.replace(/(\d+)(\D)/g, (_, n, ch) => ch.repeat(Math.min(Number(n), ROWS)));
/** Squeeze the tiles: each column run-length encoded, and repeated columns written once as `count*column`, split by '|'. */
function pack(tiles: string) {
  const cols = tiles.match(new RegExp(`.{${ROWS}}`, 'g')) ?? [];
  const out: string[] = [];
  for (let i = 0; i < cols.length;) {
    let j = i;
    while (j < cols.length && cols[j] === cols[i]) j++;
    out.push((j - i > 1 ? `${j - i}*` : '') + rle(cols[i]));
    i = j;
  }
  return out.join('|');
}
function unpack(data: string) {
  return data.split('|').map((token) => {
    const m = /^(\d+)\*(.*)$/.exec(token);
    const col = unrle(m ? m[2] : token);
    return col.repeat(m ? Math.min(Number(m[1]), MAX_COLS) : 1);
  }).join('');
}
function toBase64(text: string) {
  let bin = '';
  for (const b of new TextEncoder().encode(text)) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromBase64(code: string) {
  const bin = atob(code.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(bin, (ch) => ch.charCodeAt(0)));
}

/** A course as a short code a friend can paste in. */
export function encodeCourse(course: Course) {
  return CODE_PREFIX + toBase64(JSON.stringify({ v: 1, t: course.title, th: course.theme, c: course.cols, tm: course.time, d: pack(course.tiles) }));
}

/** Read a course code back. Returns null for anything that isn't a complete, playable course. */
export function decodeCourse(code: string): Course | null {
  try {
    const clean = code.replace(/\s+/g, '');
    if (!clean.startsWith(CODE_PREFIX)) return null;
    const v = JSON.parse(fromBase64(clean.slice(CODE_PREFIX.length)));
    if (!v || v.v !== 1 || typeof v.d !== 'string') return null;
    const cols = v.c;
    if (!Number.isInteger(cols) || cols < MIN_COLS || cols > MAX_COLS) return null;
    const tiles = unpack(v.d);
    if (tiles.length !== cols * ROWS || tiles.split('').some((ch) => !PART_CHARS.has(ch))) return null;
    const course: Course = {
      title: typeof v.t === 'string' && v.t.trim() ? v.t.trim().slice(0, 40) : 'Shared course',
      theme: THEMES.some((t) => t.id === v.th) ? v.th : 'meadow',
      cols, time: TIMES.includes(v.tm) ? v.tm : 300, tiles,
    };
    return problems(course).length ? null : course;
  } catch {
    return null;
  }
}

/** Raisins a course starts with: loose ones plus raisin blocks. */
export const raisinCount = (course: Course) => count(course.tiles, 'o') + count(course.tiles, '?');

// ---------- Starter courses ----------

/** A pen for laying out a course in code: columns left to right, rows 0 (top) to ROWS - 1 (bottom). */
export type Pen = {
  put: (c: number, r: number, ch: string) => void;
  /** Write a string of parts left to right starting at (c, r). */
  row: (c: number, r: number, parts: string) => void;
  fill: (c0: number, c1: number, r0: number, r1: number, ch: string) => void;
  /** Two rows of ground (or `ch`) under columns c0..c1. */
  ground: (c0: number, c1: number, ch?: string) => void;
  /** A pit: clear columns c0..c1 to the bottom of the screen. */
  pit: (c0: number, c1: number) => void;
  /** A block column `h` tall standing on the ground at column c. */
  pillar: (c: number, h: number, ch?: string) => void;
};
export function design(title: string, theme: ThemeId, time: number, cols: number, draw: (p: Pen) => void): Course {
  const t: string[] = Array(cols * ROWS).fill('.');
  const put = (c: number, r: number, ch: string) => { if (c >= 0 && c < cols && r >= 0 && r < ROWS) t[index(c, r)] = ch; };
  const fill = (c0: number, c1: number, r0: number, r1: number, ch: string) => { for (let c = c0; c <= c1; c++) for (let r = r0; r <= r1; r++) put(c, r, ch); };
  draw({
    put, fill,
    row: (c, r, parts) => parts.split('').forEach((ch, i) => put(c + i, r, ch)),
    ground: (c0, c1, ch = '#') => { fill(c0, c1, ROWS - 2, ROWS - 2, ch); fill(c0, c1, ROWS - 1, ROWS - 1, ch === 'I' ? '#' : ch); },
    pit: (c0, c1) => fill(c0, c1, 0, ROWS - 1, '.'),
    pillar: (c, h, ch = 'H') => fill(c, c, ROWS - 2 - h, ROWS - 3, ch),
  });
  return { title, theme, cols, time, tiles: t.join('') };
}

export type Starter = Course & { id: string; by: HeroId; blurb: string };
const starter = (id: string, by: HeroId, blurb: string, c: Course): Starter => ({ ...c, id, by, blurb });
const G = ROWS - 3; // the row just above the ground

export const STARTERS: Starter[] = [
  starter('first-hop', 'dora', 'Stomp beetles, bump blocks and grab your first clover.', design('Dora’s First Hop', 'meadow', 300, 112, (p) => {
    p.ground(0, 111); p.pit(33, 34); p.pit(59, 61); p.pit(95, 96);
    p.put(2, G, '@');
    p.row(5, 10, 'oooo');
    p.row(12, 9, '?C?B?');
    p.put(20, G, 'b'); p.pillar(24, 2); p.put(28, G, 'b');
    p.row(32, 10, 'oooo');
    p.pillar(38, 1); p.row(40, 9, 'BB?BB'); p.row(40, 8, 'ooooo');
    p.put(47, G, 'f'); p.put(52, 8, 'v');
    for (let i = 0; i < 4; i++) { p.pillar(55 + i, i + 1); p.pillar(65 - i, i + 1); }
    p.row(58, 5, 'oooo');
    p.put(69, G, 'P');
    p.row(74, 10, '===='); p.row(74, 9, 'oooo'); p.put(80, G, 'b');
    p.put(86, G, 'S'); p.row(85, 3, 'ooo'); p.row(85, 4, 'ooo');
    p.put(90, G, 'x');
    p.put(99, 9, 'F');
    for (let i = 0; i < 5; i++) p.pillar(101 + i, i + 1);
    p.put(108, G, 'G');
  })),
  starter('salt-sprint', 'enzo', 'Slide across the ice and ride the drifting clouds over the salt pans.', design('Salt Flat Sprint', 'salt', 200, 128, (p) => {
    p.ground(0, 20); p.ground(21, 34, 'I'); p.ground(41, 70); p.ground(77, 99, 'I'); p.ground(100, 127);
    p.put(2, G, '@');
    p.put(13, G, 'b'); p.row(15, 9, 'BB?BB'); p.row(15, 8, 'ooooo');
    p.put(24, G, 'f'); p.row(27, 10, 'oooo');
    p.put(38, 11, 'M'); p.row(36, 8, 'oooooo');
    p.put(44, G, 'f');
    p.row(48, G, '^^'); p.fill(53, 56, 11, 12, 'H'); p.row(57, G, '^^^'); p.fill(60, 63, 11, 12, 'H'); p.row(57, 9, 'ooo');
    p.put(67, G, 'P');
    p.put(73, 11, 'M'); p.row(71, 8, 'oooooo');
    p.put(84, G, 'b'); p.row(86, 9, '?B?B?'); p.put(92, G, 'x'); p.put(97, 9, 'F');
    for (let i = 0; i < 4; i++) p.pillar(100 + i, i + 1);
    p.pit(104, 107); p.fill(108, 111, 9, 14, 'H'); p.row(104, 6, 'oooo');
    p.put(120, G, 'G');
  })),
  starter('night-cave', 'dora', 'Low ceilings, bats and a clover worth keeping. Bricks hide a stash of raisins.', design('Night Cave Crawl', 'cave', 300, 104, (p) => {
    p.fill(0, 103, 0, 1, 'H'); p.fill(0, 0, 0, 14, 'H'); p.fill(103, 103, 0, 14, 'H');
    p.fill(1, 8, 2, 3, 'H'); p.fill(26, 34, 2, 3, 'H'); p.fill(44, 56, 2, 2, 'H'); p.fill(68, 80, 2, 3, 'H');
    p.ground(1, 102, 'H'); p.pit(33, 35); p.pit(66, 69); p.fill(33, 35, 0, 1, 'H'); p.fill(66, 69, 0, 3, 'H');
    p.put(2, G, '@');
    p.row(8, 11, 'ooo'); p.row(11, 8, '?C?'); p.put(15, G, 'b'); p.put(14, 6, 'v');
    p.row(20, 8, '====='); p.row(20, 7, 'ooooo'); p.put(26, G, 'x');
    p.row(30, 10, '========='); p.row(31, 9, 'ooooooo');
    p.put(43, G, 'b'); p.put(49, 5, 'v'); p.put(52, G, 'b');
    p.row(58, G, '^^');
    p.put(62, G, 'P');
    p.put(67, 8, 'v'); p.row(66, 9, 'oooo');
    p.put(76, G, 'f'); p.row(78, 8, '?C?');
    p.fill(83, 86, 6, 8, 'B'); p.row(83, 5, 'oooo');
    p.put(92, G, 'b');
    p.put(97, G, 'G');
  })),
  starter('summit', 'enzo', 'Climb the snowcap on springs and clouds. Hold jump as you land on a spring to fly higher.', design('Snowcap Summit', 'snow', 400, 110, (p) => {
    p.ground(0, 18); p.ground(35, 48); p.ground(61, 82, 'I'); p.ground(83, 91);
    p.put(2, G, '@');
    p.put(8, G, 'b'); p.put(14, G, 'S'); p.row(13, 3, 'ooo');
    p.row(16, 6, '======'); p.row(16, 5, 'oooooo');
    p.fill(24, 34, 7, 14, 'H'); p.put(30, 6, 'x'); p.row(25, 4, 'oooo');
    p.put(39, G, 'b'); p.put(40, 9, 'F'); p.put(43, G, 'f');
    p.put(46, G, 'S');
    p.fill(50, 60, 4, 14, 'H'); p.put(55, 3, 'P'); p.row(51, 1, 'ooo');
    p.put(66, G, 'x'); p.row(70, G, '^^'); p.put(75, G, 'b'); p.row(64, 10, 'oooo');
    p.put(86, G, 'S');
    p.row(84, 5, '======'); p.row(84, 4, 'oooooo');
    p.fill(92, 109, 4, 14, 'H');
    p.put(104, 3, 'G');
  })),
];
