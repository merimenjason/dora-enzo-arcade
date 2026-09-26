// Chinchillas vs Zombies: a Plants vs Zombies-style lane defence. Zombies shamble in from the right along five lanes
// towards Dora and Enzo's burrow. Chinchilla defenders each hold one tile of the lawn and are paid for with sunflower
// seeds, which fall from the sky or are gathered by Seed Gatherers. A hay cart waits at the end of each lane and
// clears it once; a zombie that gets past an empty lane gets into the burrow. Deterministic: seeded, no Math.random.

export const ROWS = 5, COLS = 9;
export const START_SEEDS = 75, SKY_EVERY = 7, SEED_VALUE = 25, SEED_LIFE = 12, FIRST_WAVE = 25, WAVE_GAP = 22;

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- Defenders ----------

export type DefenderId = 'gatherer' | 'flicker' | 'pebble' | 'trap' | 'boulder' | 'frost' | 'twins';
export type DefenderDef = {
  id: DefenderId; name: string; cost: number; recharge: number; hp: number; blurb: string;
  kind: 'producer' | 'shooter' | 'wall' | 'mine' | 'bomb';
  dmg?: number; rate?: number; shots?: number; slow?: boolean; arm?: number;
};
export const DEFENDERS: Record<DefenderId, DefenderDef> = {
  gatherer: { id: 'gatherer', name: 'Seed Gatherer', cost: 50, recharge: 7.5, hp: 300, kind: 'producer', rate: 24,
    blurb: 'A kit with a basket who finds a sunflower seed pouch every 24 seconds. Plant these first.' },
  flicker: { id: 'flicker', name: 'Pellet Flicker', cost: 100, recharge: 7.5, hp: 300, kind: 'shooter', dmg: 25, rate: 1.3, shots: 1,
    blurb: 'Flicks hay pellets down its lane at the first zombie in the way.' },
  pebble: { id: 'pebble', name: 'Grandpa Pebble', cost: 50, recharge: 30, hp: 4000, kind: 'wall',
    blurb: 'Sits down and refuses to budge. Zombies have to chew through a lot of fluff.' },
  trap: { id: 'trap', name: 'Dust Trap', cost: 25, recharge: 30, hp: 300, kind: 'mine', dmg: 1800, arm: 14,
    blurb: 'A buried dust bath. Once it’s ready, the first zombie to step on it goes up in a cloud.' },
  boulder: { id: 'boulder', name: 'Enzo’s Boulder', cost: 150, recharge: 50, hp: 9999, kind: 'bomb', dmg: 1800, arm: 1,
    blurb: 'Enzo drops a boulder that flattens every zombie in the 3 × 3 tiles around it.' },
  frost: { id: 'frost', name: 'Dora’s Frost Fan', cost: 175, recharge: 7.5, hp: 300, kind: 'shooter', dmg: 25, rate: 1.3, shots: 1, slow: true,
    blurb: 'Dora fans icy puffs that chill zombies to half speed, biting included.' },
  twins: { id: 'twins', name: 'Twin Flickers', cost: 200, recharge: 7.5, hp: 300, kind: 'shooter', dmg: 25, rate: 1.3, shots: 2,
    blurb: 'Two kits, two pellets every volley.' },
};
export const DEFENDER_IDS = Object.keys(DEFENDERS) as DefenderId[];

// ---------- Zombies ----------

export type ZombieId = 'zombie' | 'flag' | 'cone' | 'pogo' | 'bucket' | 'brute';
export type ZombieDef = { id: ZombieId; name: string; hp: number; armor: number; speed: number; bite: number; blurb: string };
/** Speed in tiles a second; `bite` is damage a second while eating. */
export const ZOMBIES: Record<ZombieId, ZombieDef> = {
  zombie: { id: 'zombie', name: 'Zombie', hp: 200, armor: 0, speed: 0.18, bite: 100, blurb: 'Shambles, groans, eats whatever is in the way.' },
  flag: { id: 'flag', name: 'Flag Zombie', hp: 200, armor: 0, speed: 0.24, bite: 100, blurb: 'Leads a huge wave. Where the flag goes, the horde follows.' },
  cone: { id: 'cone', name: 'Conehead', hp: 200, armor: 370, speed: 0.18, bite: 100, blurb: 'A traffic cone on its head soaks up pellets.' },
  pogo: { id: 'pogo', name: 'Pogo Zombie', hp: 340, armor: 0, speed: 0.35, bite: 100, blurb: 'Bounces over the first defender it meets, then walks.' },
  bucket: { id: 'bucket', name: 'Buckethead', hp: 200, armor: 1100, speed: 0.18, bite: 100, blurb: 'A pail on its head. Very hard to stop with pellets alone.' },
  brute: { id: 'brute', name: 'Brute', hp: 3000, armor: 0, speed: 0.16, bite: 0, blurb: 'Huge. Flattens any defender in one smash.' },
};
const COST: Record<ZombieId, number> = { zombie: 1, flag: 1, cone: 2, pogo: 2, bucket: 4, brute: 10 };

// ---------- Levels ----------

export type LevelDef = { name: string; rows: number[]; waves: number; flags: number[]; pool: ZombieId[]; starter: DefenderId[]; unlock: DefenderId | null; base: number; step: number; tip: string };
export const LEVELS: LevelDef[] = [
  { name: 'The First Night', rows: [1, 2, 3], waves: 6, flags: [5], pool: ['zombie'], starter: ['gatherer', 'flicker'], unlock: 'pebble', base: 1, step: 0.35,
    tip: 'Plant Seed Gatherers first, then a Pellet Flicker in every lane. Click the falling seeds to collect them.' },
  { name: 'Cones on the Lawn', rows: [1, 2, 3], waves: 8, flags: [7], pool: ['zombie', 'cone'], starter: [], unlock: 'trap', base: 1, step: 0.45,
    tip: 'Coneheads take longer to stop. Grandpa Pebble holds a lane while your Flickers work.' },
  { name: 'The Long Row', rows: [0, 1, 2, 3, 4], waves: 10, flags: [4, 9], pool: ['zombie', 'cone'], starter: [], unlock: 'boulder', base: 1, step: 0.45,
    tip: 'Dust Traps are cheap, but take 14 seconds to be ready. Plant them early, ahead of a lane.' },
  { name: 'Bouncing Trouble', rows: [0, 1, 2, 3, 4], waves: 10, flags: [4, 9], pool: ['zombie', 'cone', 'pogo'], starter: [], unlock: 'frost', base: 1, step: 0.55,
    tip: 'Pogo Zombies jump the first defender they meet. Put Grandpa Pebble out in front to take the jump.' },
  { name: 'Bucket Brigade', rows: [0, 1, 2, 3, 4], waves: 12, flags: [5, 11], pool: ['zombie', 'cone', 'pogo', 'bucket'], starter: [], unlock: 'twins', base: 1, step: 0.6,
    tip: 'Buckets are tough. Chill them with Dora’s Frost Fan so everything else has longer to shoot.' },
  { name: 'The Horde', rows: [0, 1, 2, 3, 4], waves: 14, flags: [6, 13], pool: ['zombie', 'cone', 'pogo', 'bucket'], starter: [], unlock: null, base: 1, step: 0.65,
    tip: 'Twin Flickers double your firepower. Save Enzo’s Boulder for when a lane gets crowded.' },
  { name: 'Brute Force', rows: [0, 1, 2, 3, 4], waves: 14, flags: [6, 13], pool: ['zombie', 'cone', 'bucket', 'pogo', 'brute'], starter: [], unlock: null, base: 1, step: 0.7,
    tip: 'Brutes flatten defenders in one smash. Stop them before they arrive, or drop a boulder on them.' },
  { name: 'The Last Night', rows: [0, 1, 2, 3, 4], waves: 16, flags: [7, 15], pool: ['zombie', 'cone', 'bucket', 'pogo', 'brute'], starter: [], unlock: null, base: 1, step: 0.75,
    tip: 'Everything they have. Hold until morning.' },
];
/** The defenders you have going into level `n` (0-based). */
export const unlockedBy = (n: number) => [...LEVELS[0].starter, ...LEVELS.slice(0, n).map((l) => l.unlock).filter((d): d is DefenderId => !!d)];

export type Spawn = { kind: ZombieId; row: number; at: number };
/** Every zombie of level `n`, with its lane and arrival time. Flag waves are twice the size. */
export function planLevel(n: number, seed: number): Spawn[] {
  const L = LEVELS[n], r = rng(seed * 31 + n * 977 + 5), out: Spawn[] = [];
  // Lanes are dealt out like cards, so a wave spreads across the lawn instead of piling into one lane.
  let deck: number[] = [];
  const lane = () => { if (!deck.length) { deck = [...L.rows]; for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; } } return deck.pop()!; };
  for (let w = 0; w < L.waves; w++) {
    const flag = L.flags.includes(w), start = FIRST_WAVE + w * WAVE_GAP;
    let budget = (L.base + w * L.step) * (flag ? 2 : 1);
    if (flag) { out.push({ kind: 'flag', row: lane(), at: start }); budget -= 1; }
    // The final wave always brings the toughest zombie the level knows.
    if (w === L.waves - 1) { const top = L.pool.at(-1)!; out.push({ kind: top, row: lane(), at: start + 1 }); budget -= COST[top]; }
    let i = 0;
    while (budget >= 1 && i < 60) {
      // The first two waves are plain zombies, time to plant before the specials arrive.
      const affordable = w < 2 ? ['zombie' as ZombieId] : L.pool.filter((k) => COST[k] <= budget && (k !== 'brute' || w >= L.waves / 2));
      const kind = affordable[Math.floor(r() * affordable.length)] ?? 'zombie';
      budget -= COST[kind];
      out.push({ kind, row: lane(), at: start + (flag ? 2 : 0) + i * (flag ? 0.8 : 1.6) + r() * 1.5 });
      i++;
    }
  }
  return out.sort((a, b) => a.at - b.at);
}

// ---------- The game ----------

export type Defender = { id: number; kind: DefenderId; row: number; col: number; hp: number; maxHp: number; cool: number; armed: number; bite: number; flash: number };
export type Zombie = {
  id: number; kind: ZombieId; row: number; x: number; hp: number; maxHp: number; armor: number; maxArmor: number;
  slowT: number; eating: number | null; jumped: boolean; jump: number; hit: number; step: number; smash: number; wave: number;
};
export type Pellet = { id: number; row: number; x: number; dmg: number; slow: boolean };
export type Seed = { id: number; x: number; y: number; toY: number; value: number; life: number; sky: boolean };
export type Cart = 'ready' | 'rolling' | 'used';
export type Effect = { kind: 'boom' | 'dust' | 'splat' | 'hit' | 'chill' | 'smash' | 'coin'; x: number; y: number; r: number; t: number; max: number; value?: number };
export type GameEvent = { type: 'plant' | 'shovel' | 'collect' | 'kill' | 'cart' | 'boom' | 'wave' | 'flag' | 'won' | 'lost'; kind?: string; value?: number };
export type PlantResult = 'ok' | 'seeds' | 'recharge' | 'taken' | 'lane' | 'locked' | 'state' | 'bounds';
export type State = 'playing' | 'paused' | 'won' | 'lost';

export class Game {
  level: number;
  def: LevelDef;
  state: State = 'playing';
  time = 0;
  seeds = START_SEEDS;
  unlocked: DefenderId[];
  recharge: Record<DefenderId, number>;
  defenders: Defender[] = [];
  zombies: Zombie[] = [];
  pellets: Pellet[] = [];
  drops: Seed[] = [];
  carts: Cart[];
  cartX: number[];
  effects: Effect[] = [];
  events: GameEvent[] = [];
  spawns: Spawn[];
  total: number;
  kills = 0;
  message = '';
  messageTime = 0;
  private random: () => number;
  private skyClock = 6;
  private nextId = 1;
  private waveSeen = -1;

  constructor(level = 0, seed = 1) {
    this.level = Math.max(0, Math.min(LEVELS.length - 1, level));
    this.def = LEVELS[this.level];
    this.unlocked = unlockedBy(this.level);
    this.random = rng(seed * 101 + this.level);
    this.spawns = planLevel(this.level, seed);
    this.total = this.spawns.length;
    this.recharge = Object.fromEntries(DEFENDER_IDS.map((d) => [d, 0])) as Record<DefenderId, number>;
    // Slow-to-recharge defenders start part-charged, as in the original.
    for (const d of ['pebble', 'trap', 'boulder'] as DefenderId[]) this.recharge[d] = DEFENDERS[d].recharge * 0.6;
    this.carts = Array.from({ length: ROWS }, (_, r) => (this.def.rows.includes(r) ? 'ready' : 'used'));
    this.cartX = Array.from({ length: ROWS }, () => -0.55);
  }

  lane(row: number) { return this.def.rows.includes(row); }
  at(row: number, col: number) { return this.defenders.find((d) => d.row === row && d.col === col) ?? null; }
  /** 0 to 1: how much of the level has arrived. */
  get progress() { return this.total ? 1 - this.spawns.length / this.total : 1; }
  /** Wave number of the latest arrivals, from 1. */
  get wave() { return Math.max(0, Math.min(this.def.waves, Math.floor((this.time - FIRST_WAVE) / WAVE_GAP) + 1)); }

  canPlant(kind: DefenderId, row: number, col: number): PlantResult {
    if (this.state !== 'playing') return 'state';
    if (!this.unlocked.includes(kind)) return 'locked';
    if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return 'bounds';
    if (!this.lane(row)) return 'lane';
    if (this.at(row, col)) return 'taken';
    if (this.recharge[kind] > 0) return 'recharge';
    if (this.seeds < DEFENDERS[kind].cost) return 'seeds';
    return 'ok';
  }
  plant(kind: DefenderId, row: number, col: number): PlantResult {
    const ok = this.canPlant(kind, row, col);
    if (ok !== 'ok') return ok;
    const d = DEFENDERS[kind];
    this.seeds -= d.cost;
    this.recharge[kind] = d.recharge;
    this.defenders.push({ id: this.nextId++, kind, row, col, hp: d.hp, maxHp: d.hp, cool: kind === 'gatherer' ? 7 + this.random() * 5 : 0.4, armed: d.arm ?? 0, bite: 0, flash: 0 });
    this.events.push({ type: 'plant', kind });
    return 'ok';
  }
  /** Digs up a defender (no refund, as in the original). */
  shovel(row: number, col: number) {
    const d = this.at(row, col);
    if (!d || this.state !== 'playing') return false;
    this.defenders = this.defenders.filter((x) => x !== d);
    this.events.push({ type: 'shovel', kind: d.kind });
    return true;
  }
  collect(id: number) {
    const s = this.drops.find((x) => x.id === id);
    if (!s || this.state === 'won' || this.state === 'lost') return false;
    this.seeds += s.value;
    this.drops = this.drops.filter((x) => x !== s);
    this.effects.push({ kind: 'coin', x: s.x, y: s.y, r: 0.4, t: 0, max: 0.7, value: s.value });
    this.events.push({ type: 'collect', value: s.value });
    return true;
  }
  collectAll() { let n = 0; for (const s of this.drops) if (this.collect(s.id)) n++; return n; }
  pause() { if (this.state === 'playing') this.state = 'paused'; else if (this.state === 'paused') this.state = 'playing'; }

  update(dt: number) {
    if (this.state !== 'playing') return;
    this.time += dt;
    this.messageTime = Math.max(0, this.messageTime - dt);
    for (const k of DEFENDER_IDS) this.recharge[k] = Math.max(0, this.recharge[k] - dt);
    // Seeds drifting down from the sky.
    this.skyClock -= dt;
    if (this.skyClock <= 0) {
      this.skyClock = SKY_EVERY + this.random() * 3;
      const row = this.def.rows[Math.floor(this.random() * this.def.rows.length)];
      this.drops.push({ id: this.nextId++, x: 0.6 + this.random() * (COLS - 1.2), y: -0.6, toY: row + 0.55, value: SEED_VALUE, life: SEED_LIFE, sky: true });
    }
    for (const s of this.drops) { if (s.y < s.toY) s.y = Math.min(s.toY, s.y + dt * 0.9); else s.life -= dt; }
    this.drops = this.drops.filter((s) => s.life > 0);
    // Zombies arrive.
    while (this.spawns.length && this.spawns[0].at <= this.time) {
      const s = this.spawns.shift()!, z = ZOMBIES[s.kind];
      const wave = Math.floor((s.at - FIRST_WAVE) / WAVE_GAP);
      this.zombies.push({ id: this.nextId++, kind: s.kind, row: s.row, x: COLS + 0.3 + this.random() * 0.4, hp: z.hp, maxHp: z.hp, armor: z.armor, maxArmor: z.armor, slowT: 0, eating: null, jumped: false, jump: 0, hit: 0, step: this.random() * 6, smash: 0, wave });
      if (wave !== this.waveSeen) {
        this.waveSeen = wave;
        if (wave === 0) this.say('Here they come!');
        if (this.def.flags.includes(wave)) { this.say(wave === this.def.waves - 1 ? 'The final wave!' : 'A huge wave is coming!'); this.events.push({ type: 'flag' }); }
        this.events.push({ type: 'wave', value: wave + 1 });
      }
    }
    for (const d of this.defenders) this.act(d, dt);
    for (const z of this.zombies) this.shamble(z, dt);
    this.fly(dt);
    this.roll(dt);
    for (const e of this.effects) e.t += dt;
    this.effects = this.effects.filter((e) => e.t < e.max);
    this.bury();
    if (this.state === 'playing' && !this.spawns.length && !this.zombies.length) { this.state = 'won'; this.events.push({ type: 'won' }); }
  }

  private say(text: string) { this.message = text; this.messageTime = 3; }

  private act(d: Defender, dt: number) {
    const def = DEFENDERS[d.kind];
    d.flash = Math.max(0, d.flash - dt);
    d.bite = Math.max(0, d.bite - dt);
    if (def.kind === 'producer') {
      d.cool -= dt;
      if (d.cool <= 0) { d.cool = def.rate!; d.flash = 0.4; this.drops.push({ id: this.nextId++, x: d.col + 0.7, y: d.row + 0.3, toY: d.row + 0.7, value: SEED_VALUE, life: SEED_LIFE, sky: false }); }
      return;
    }
    if (def.kind === 'shooter') {
      d.cool -= dt;
      const target = this.zombies.some((z) => z.row === d.row && z.x > d.col + 0.2 && z.x < COLS + 0.1 && z.hp > 0);
      if (d.cool > 0 || !target) { if (d.cool < 0) d.cool = 0; return; }
      d.cool = def.rate!; d.flash = 0.2;
      for (let i = 0; i < def.shots!; i++) this.pellets.push({ id: this.nextId++, row: d.row, x: d.col + 0.75 - i * 0.35, dmg: def.dmg!, slow: !!def.slow });
      return;
    }
    if (def.kind === 'mine' || def.kind === 'bomb') {
      d.armed = Math.max(0, d.armed - dt);
      if (def.kind === 'bomb' && d.armed <= 0) this.blast(d, 1);
      else if (def.kind === 'mine' && d.armed <= 0 && this.zombies.some((z) => z.row === d.row && z.hp > 0 && z.jump <= 0 && this.touching(z, d))) this.blast(d, 0);
    }
  }

  /** A boulder (reach 1: the 3 × 3 around it) or a dust trap (reach 0: its own tile). */
  private blast(d: Defender, reach: number) {
    const def = DEFENDERS[d.kind], cx = d.col + 0.5;
    // 0.75 reaches the zombie whose front is touching the tile (`touching`), so a trap always catches whoever set it off.
    for (const z of this.zombies) if (Math.abs(z.row - d.row) <= reach && Math.abs(z.x - cx) <= 0.75 + reach) this.hurt(z, def.dmg!);
    this.effects.push({ kind: reach ? 'boom' : 'dust', x: cx, y: d.row + 0.5, r: reach ? 1.6 : 0.9, t: 0, max: 0.8 });
    this.events.push({ type: 'boom', kind: d.kind });
    d.hp = 0;
  }

  private shamble(z: Zombie, dt: number) {
    const def = ZOMBIES[z.kind], chilled = z.slowT > 0, pace = chilled ? 0.5 : 1;
    z.slowT = Math.max(0, z.slowT - dt); z.hit = Math.max(0, z.hit - dt); z.smash = Math.max(0, z.smash - dt);
    if (z.jump > 0) { z.jump -= dt; z.x -= (1.25 / 0.7) * dt; return; }
    const food = this.defenders.filter((d) => d.row === z.row && d.hp > 0 && DEFENDERS[d.kind].kind !== 'bomb' && this.touching(z, d))
      .sort((a, b) => b.col - a.col)[0];
    if (food) {
      if (z.kind === 'pogo' && !z.jumped) { z.jumped = true; z.jump = 0.7; return; }
      if (DEFENDERS[food.kind].kind === 'mine' && food.armed <= 0) return;
      z.eating = food.id;
      if (z.kind === 'brute') { if (z.smash <= 0) { z.smash = 1.5 / pace; food.hp = 0; this.effects.push({ kind: 'smash', x: food.col + 0.5, y: food.row + 0.6, r: 0.8, t: 0, max: 0.5 }); } return; }
      food.hp -= def.bite * pace * dt; food.bite = 0.2;
      return;
    }
    z.eating = null;
    const speed = z.kind === 'pogo' && z.jumped ? ZOMBIES.zombie.speed : def.speed;
    z.x -= speed * pace * dt;
    z.step += speed * pace * dt * 6;
    if (z.x < 0.05) this.breach(z);
  }

  /** The front of a zombie is 0.35 tiles left of its middle; it's touching a defender once its front reaches that tile. */
  touching(z: Zombie, d: Defender) { const front = z.x - 0.35; return z.row === d.row && front <= d.col + 0.85 && front >= d.col + 0.1; }

  /** A zombie reached the burrow end of its lane: the hay cart goes, or the level is lost. */
  private breach(z: Zombie) {
    if (this.carts[z.row] === 'ready') { this.carts[z.row] = 'rolling'; this.events.push({ type: 'cart' }); return; }
    if (this.carts[z.row] === 'rolling') return;
    this.state = 'lost';
    this.events.push({ type: 'lost' });
  }

  private roll(dt: number) {
    for (let r = 0; r < ROWS; r++) {
      if (this.carts[r] !== 'rolling') continue;
      this.cartX[r] += 4 * dt;
      for (const z of this.zombies) if (z.row === r && z.hp > 0 && z.x <= this.cartX[r] + 0.6) { z.hp = 0; z.armor = 0; this.effects.push({ kind: 'splat', x: z.x, y: r + 0.5, r: 0.6, t: 0, max: 0.5 }); }
      if (this.cartX[r] > COLS + 1) this.carts[r] = 'used';
    }
  }

  private fly(dt: number) {
    for (const p of this.pellets) {
      p.x += 5 * dt;
      const z = this.zombies.filter((q) => q.row === p.row && q.hp > 0 && q.jump <= 0 && q.x - 0.3 <= p.x && q.x + 0.3 >= p.x - 5 * dt).sort((a, b) => a.x - b.x)[0];
      if (z) {
        this.hurt(z, p.dmg);
        if (p.slow) { z.slowT = 10; this.effects.push({ kind: 'chill', x: z.x, y: p.row + 0.45, r: 0.3, t: 0, max: 0.3 }); }
        else this.effects.push({ kind: 'hit', x: z.x - 0.25, y: p.row + 0.45, r: 0.3, t: 0, max: 0.2 });
        p.x = 99;
      }
    }
    this.pellets = this.pellets.filter((p) => p.x < COLS + 1);
  }

  hurt(z: Zombie, dmg: number) {
    const onArmor = Math.min(z.armor, dmg);
    z.armor -= onArmor; z.hp -= dmg - onArmor; z.hit = 0.1;
  }

  private bury() {
    const gone = this.zombies.filter((z) => z.hp <= 0);
    if (gone.length) {
      this.zombies = this.zombies.filter((z) => z.hp > 0);
      for (const z of gone) { this.kills++; this.effects.push({ kind: 'splat', x: z.x, y: z.row + 0.5, r: 0.5, t: 0, max: 0.5 }); this.events.push({ type: 'kill', kind: z.kind }); }
    }
    this.defenders = this.defenders.filter((d) => d.hp > 0);
  }
}
