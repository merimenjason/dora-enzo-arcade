// Tetherball: Dora has no weapon. She hooks an enemy on a rope, whirls it round and lets go, and whatever it hits takes
// damage from the speed of the hit (so does the enemy she swung). Light enemies whip round fast; heavy ones drag her
// about. Enzo stands braced in every arena as a living anchor: hook him and Dora swings herself through the crowd. The
// rules only: the arena (walls, spikes, pits, crates, posts), the rope, momentum and impacts, the Grumbles and the rest,
// the thirteen-arena run with its upgrades, and the save. Deterministic from a seed with no DOM; lib/tether-scene.ts
// draws it.

export const DT = 1 / 60;
/** the arena in pixels, the size of the pixel-art floor it is drawn on */
export const W = 480, H = 320;
/** the open floor inside the arena wall */
export const FLOOR = { x0: 26, y0: 42, x1: 454, y1: 282 };

export const PLAYER_R = 7;
export const PLAYER_MASS = 4;
export const RUN_SPEED = 112;
export const DASH = { speed: 300, time: 0.16, cd: 0.7 };
export const IFRAMES = 1;
export const HOOK_SPEED = 560;
export const ROPE = { min: 30, max: 100 };
/** how fast a held rope whirls an enemy up, and the top speed for a light one */
export const SPIN = { acc: 430, cap: 240 };
/** a rope whirling at least this fast blocks shots */
export const SHIELD_SPEED = 150;
/** impacts below this speed do nothing */
export const HIT_MIN = 60;
/** a swing speed of 1 on the meter is this many pixels a second */
export const SPEED_UNIT = 25;

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const len = (x: number, y: number) => Math.hypot(x, y);
/** damage from an impact at this speed: 1 at 60, one more for every 50 above */
export const damageAt = (speed: number) => (speed < HIT_MIN ? 0 : 1 + Math.floor((speed - HIT_MIN) / 50));
export const swingMeter = (speed: number) => Math.round(speed / SPEED_UNIT);

// ---------------------------------------------------------------- enemies
export type FoeKind = 'slime' | 'grumble' | 'spitter' | 'beetle' | 'shellback' | 'boar' | 'golem';
export type FoeDef = { kind: FoeKind; name: string; r: number; mass: number; hp: number; speed: number; touch: number; armour: number; cost: number; line: string };
export const FOES: Record<FoeKind, FoeDef> = {
  slime: { kind: 'slime', name: 'Slime', r: 6, mass: 1, hp: 2, speed: 0, touch: 1, armour: 0, cost: 1, line: 'Hops at you. Light, so it whips round fast, but it bursts after a hit or two.' },
  grumble: { kind: 'grumble', name: 'Grumble', r: 7, mass: 1.5, hp: 3, speed: 42, touch: 1, armour: 0, cost: 1.5, line: 'Walks straight at you, grumbling.' },
  spitter: { kind: 'spitter', name: 'Spitter', r: 7, mass: 1.2, hp: 2, speed: 38, touch: 1, armour: 0, cost: 2, line: 'Keeps its distance and spits acorns. A Grumble on your rope blocks them.' },
  beetle: { kind: 'beetle', name: 'Bomb Beetle', r: 6, mass: 1, hp: 1, speed: 34, touch: 1, armour: 0, cost: 1.5, line: 'Explodes on any hard hit, knocking everything nearby flying.' },
  shellback: { kind: 'shellback', name: 'Shellback', r: 9, mass: 3, hp: 5, speed: 26, touch: 1, armour: 200, cost: 2.5, line: 'Its shell shrugs off slow hits, which makes it the best flail there is.' },
  boar: { kind: 'boar', name: 'Boar', r: 10, mass: 6, hp: 8, speed: 30, touch: 2, armour: 0, cost: 4, line: 'Paws the ground, then charges. Too heavy to swing far: hook it and it drags you.' },
  golem: { kind: 'golem', name: 'Stone Golem', r: 18, mass: 16, hp: 24, speed: 18, touch: 2, armour: 90, cost: 99, line: 'The Grumble King’s guard. Only the hardest hits crack it.' },
};
export type FoeState = 'spawn' | 'walk' | 'aim' | 'charge' | 'stun' | 'slam' | 'throw';
export type Foe = {
  id: number; kind: FoeKind; x: number; y: number; vx: number; vy: number; r: number; mass: number; hp: number; maxHp: number;
  state: FoeState; t: number; cd: number; face: 1 | -1; dir: { x: number; y: number };
  /** seconds left flying free after a swing or a knock; it hurts what it hits while this lasts */
  flung: number; dead: boolean; flash: number;
  /** seconds a knocked-out enemy keeps tumbling on, still hitting whatever it meets */
  tumble: number;
};

// ---------------------------------------------------------------- the arena
export type BiomeId = 'court' | 'meadow' | 'mine' | 'keep';
export const BIOMES: { id: BiomeId; name: string; pool: FoeKind[] }[] = [
  { id: 'court', name: 'Mossy Courtyard', pool: ['slime', 'grumble'] },
  { id: 'meadow', name: 'Clover Meadow', pool: ['slime', 'grumble', 'spitter', 'beetle', 'boar'] },
  { id: 'mine', name: 'Glimmer Mine', pool: ['grumble', 'spitter', 'beetle', 'shellback', 'boar'] },
  { id: 'keep', name: 'Grumble Keep', pool: ['slime', 'grumble', 'spitter', 'beetle', 'shellback', 'boar'] },
];
export const ARENAS_PER_BIOME = 3;
/** twelve arenas and then the golem */
export const ARENAS = BIOMES.length * ARENAS_PER_BIOME + 1;
export type Prop = { x: number; y: number; r: number };
export type Crate = Prop & { broken: boolean };
export type Layout = { biome: BiomeId; spikes: Prop[]; pits: Prop[]; crates: Crate[]; posts: Prop[]; enzo: Prop; waves: FoeKind[][] };
export const SPIKE_R = 9, PIT_R = 16, CRATE_R = 8, POST_R = 5, ENZO_R = 8;
const START = { x: (FLOOR.x0 + FLOOR.x1) / 2, y: FLOOR.y1 - 40 };

export function makeLayout(arena: number, seed: number): Layout {
  const r = rng(seed * 7919 + arena * 104729 + 13);
  const boss = arena >= ARENAS - 1, b = Math.min(BIOMES.length - 1, Math.floor(arena / ARENAS_PER_BIOME)), biome = BIOMES[b];
  const taken: Prop[] = [{ ...START, r: 34 }];
  const place = (rad: number, gap: number, edge = 26): Prop => {
    for (let i = 0; i < 200; i++) {
      const p = { x: FLOOR.x0 + edge + r() * (FLOOR.x1 - FLOOR.x0 - edge * 2), y: FLOOR.y0 + edge + r() * (FLOOR.y1 - FLOOR.y0 - edge * 2), r: rad };
      if (taken.every((q) => len(p.x - q.x, p.y - q.y) > p.r + q.r + gap)) { taken.push(p); return p; }
    }
    const p = { x: FLOOR.x0 + edge, y: FLOOR.y0 + edge, r: rad }; taken.push(p); return p;
  };
  // Enzo stands near one of the side walls, out of the way, so he can be hooked from the middle
  const spots = [{ x: FLOOR.x0 + 22, y: (FLOOR.y0 + FLOOR.y1) / 2 }, { x: FLOOR.x1 - 22, y: (FLOOR.y0 + FLOOR.y1) / 2 }, { x: FLOOR.x0 + 30, y: FLOOR.y0 + 26 }, { x: FLOOR.x1 - 30, y: FLOOR.y0 + 26 }];
  const e = spots[Math.floor(r() * spots.length)], enzo = { ...e, r: ENZO_R }; taken.push({ ...e, r: 24 });
  const nSpike = boss ? 4 : 1 + Math.floor(r() * 3), nPit = boss || arena === 0 ? 0 : Math.floor(r() * (b >= 2 ? 3 : 2)), nCrate = 2 + Math.floor(r() * 2), nPost = b >= 1 && !boss ? Math.floor(r() * 2) : 0;
  const pits = Array.from({ length: nPit }, () => place(PIT_R, 30, 40));
  const spikes = Array.from({ length: nSpike }, () => place(SPIKE_R, 30, 34));
  const posts = Array.from({ length: nPost }, () => place(POST_R, 40, 40));
  const crates = Array.from({ length: nCrate }, () => ({ ...place(CRATE_R, 18, 18), broken: false }));
  return { biome: biome.id, spikes, pits, crates, posts, enzo, waves: makeWaves(arena, r) };
}

function makeWaves(arena: number, r: () => number): FoeKind[][] {
  if (arena === 0) return [['slime', 'slime', 'slime', 'slime'], ['slime', 'slime', 'grumble', 'grumble']];
  if (arena >= ARENAS - 1) return [['golem', 'grumble', 'grumble']];
  const b = Math.floor(arena / ARENAS_PER_BIOME), pool = BIOMES[b].pool;
  const waves: FoeKind[][] = [], n = arena < 2 ? 2 : 3;
  for (let w = 0; w < n; w++) {
    let budget = 4.5 + arena * 0.85 + w * 1.2; const wave: FoeKind[] = [];
    // the first boar turns up at the end of the courtyard, and each later biome's newcomer in its first wave
    if (arena === 2 && w === n - 1) { wave.push('boar'); budget -= 3; }
    if (arena % ARENAS_PER_BIOME === 0 && w === 0) { const fresh = b === 1 ? 'spitter' : b === 2 ? 'shellback' : 'boar'; wave.push(fresh); budget -= FOES[fresh].cost; }
    let boars = wave.filter((k) => k === 'boar').length;
    while (budget >= 1) {
      const k = pool[Math.floor(r() * pool.length)];
      if (k === 'boar' && (boars >= 1 + Math.floor(arena / 6) || budget < 4)) continue;
      if (FOES[k].cost > budget + 0.5) { if (budget < 1.6) break; continue; }
      wave.push(k); budget -= FOES[k].cost; if (k === 'boar') boars++;
    }
    waves.push(wave);
  }
  return waves;
}

// ---------------------------------------------------------------- upgrades
export type UpId = 'long' | 'elastic' | 'blast' | 'barb' | 'heavy' | 'whirl' | 'heart' | 'dash' | 'bowl' | 'quake' | 'mend';
export const UPGRADES: { id: UpId; name: string; max: number; line: string }[] = [
  { id: 'long', name: 'Longer rope', max: 3, line: 'The rope reaches 22 px further, and a longer rope swings faster at its end.' },
  { id: 'elastic', name: 'Bungee rope', max: 3, line: 'Letting go slingshots the enemy a quarter faster.' },
  { id: 'blast', name: 'Blast knot', max: 2, line: 'An enemy you let go explodes when it first hits something.' },
  { id: 'barb', name: 'Barbed hook', max: 2, line: 'The hook bites: 1 damage, and the enemy is dazed for a moment.' },
  { id: 'heavy', name: 'Heavy boots', max: 3, line: 'Dora is heavier, so big enemies drag her less and swing faster.' },
  { id: 'whirl', name: 'Whirlwind', max: 3, line: 'Enemies whirl up a third faster, and the top speed goes up.' },
  { id: 'heart', name: 'Big heart', max: 3, line: 'One more heart, and it starts full.' },
  { id: 'dash', name: 'Quick feet', max: 2, line: 'The dash recharges a third faster.' },
  { id: 'bowl', name: 'Bowling', max: 2, line: 'Enemies knocked by a flying enemy fly off faster, so hits chain further.' },
  { id: 'quake', name: 'Wall quake', max: 2, line: 'An enemy slammed into a wall sends out a shockwave.' },
  { id: 'mend', name: 'Enzo’s plasters', max: 3, line: 'Heal a heart at the end of every arena.' },
];
export type Mods = Record<UpId, number>;
export const noMods = (): Mods => ({ long: 0, elastic: 0, blast: 0, barb: 0, heavy: 0, whirl: 0, heart: 0, dash: 0, bowl: 0, quake: 0, mend: 0 });

// ---------------------------------------------------------------- the run
export type Input = { x: number; y: number; ax: number; ay: number; hook: boolean; dash: boolean };
export const idleInput = (): Input => ({ x: 0, y: 0, ax: 0, ay: 0, hook: false, dash: false });
export type Anchor = { kind: 'foe'; id: number } | { kind: 'enzo' } | { kind: 'post'; i: number };
export type Hook = { x: number; y: number; vx: number; vy: number; d: number };
export type Rope = { to: Anchor; len: number; spin: 1 | -1 };
export type Shot = { x: number; y: number; vx: number; vy: number; r: number; kind: 'acorn' | 'rock'; dead: boolean };
export type Wave = { x: number; y: number; r: number; max: number; hit: boolean };
export type Pickup = { x: number; y: number; t: number };
export type Phase = 'fight' | 'pick' | 'won' | 'lost';
export type RunEvent =
  | { k: 'hook' } | { k: 'latch'; to: Anchor['kind']; kind?: FoeKind } | { k: 'miss' } | { k: 'release'; speed: number } | { k: 'yank' }
  | { k: 'hit'; x: number; y: number; dmg: number; speed: number } | { k: 'tink'; x: number; y: number }
  | { k: 'kill'; kind: FoeKind; x: number; y: number; how: 'hit' | 'fall' | 'boom' }
  | { k: 'slam'; x: number; y: number; speed: number } | { k: 'spike'; x: number; y: number } | { k: 'boom'; x: number; y: number }
  | { k: 'crate'; x: number; y: number } | { k: 'heart' } | { k: 'hurt'; hp: number } | { k: 'dash' }
  | { k: 'telegraph'; kind: FoeKind } | { k: 'shot'; kind: Shot['kind'] } | { k: 'quake' } | { k: 'wave'; n: number; of: number }
  | { k: 'clear'; arena: number } | { k: 'combo'; n: number } | { k: 'summon' } | { k: 'won' } | { k: 'lost' };

export type RunOpts = { seed?: number; arena?: number; mods?: Partial<Mods>; empty?: boolean };

export class Run {
  seed: number; rand: () => number; t = 0;
  arena = 0; layout!: Layout; waveIx = 0; queue: FoeKind[] = []; spawnT = 0; arenaT = 0;
  phase: Phase = 'fight'; offer: UpId[] = []; mods: Mods;
  // Dora
  x = START.x; y = START.y; vx = 0; vy = 0; hp = 5; maxHp = 5; inv = 0; dashT = 0; dashCd = 0; dashDir = { x: 1, y: 0 };
  face: 1 | -1 = 1; aim = { x: 1, y: 0 }; flying = 0; lastSafe = { x: START.x, y: START.y };
  hook: Hook | null = null; rope: Rope | null = null; hookCd = 0;
  foes: Foe[] = []; shots: Shot[] = []; quakes: Wave[] = []; pickups: Pickup[] = [];
  hitstop = 0; events: RunEvent[] = [];
  combo = 0; comboT = 0;
  stats = { kills: 0, bestCombo: 0, topSpeed: 0, arenas: 0, hits: 0 };
  private nextId = 1; private prev = idleInput(); private pairs = new Map<string, number>(); private summonT = 9;

  constructor(o: RunOpts = {}) {
    this.seed = o.seed ?? 1; this.rand = rng(this.seed);
    this.mods = { ...noMods(), ...o.mods };
    this.maxHp = 5 + this.mods.heart; this.hp = this.maxHp;
    this.enter(o.arena ?? 0, o.empty);
  }

  get over() { return this.phase === 'won' || this.phase === 'lost'; }
  get mass() { return PLAYER_MASS + this.mods.heavy * 1.5; }
  get ropeMax() { return ROPE.max + this.mods.long * 22; }
  get dashCdMax() { return DASH.cd * (1 - this.mods.dash / 3); }
  get boss() { return this.arena >= ARENAS - 1; }
  get biome() { return BIOMES[Math.min(BIOMES.length - 1, Math.floor(this.arena / ARENAS_PER_BIOME))]; }
  foe(id: number) { return this.foes.find((f) => f.id === id && !f.dead); }
  /** the speed of whatever is on the end of the rope (or of Dora, swinging round Enzo) */
  get swing() {
    const r = this.rope; if (!r) return 0;
    if (r.to.kind === 'foe') { const f = this.foe(r.to.id); return f ? len(f.vx - this.vx * 0.3, f.vy - this.vy * 0.3) : 0; }
    return len(this.vx, this.vy);
  }
  /** while an enemy whirls fast enough, the disc its rope sweeps blocks shots: this is its radius (0 when it doesn't) */
  get shield() {
    const r = this.rope; if (!r || r.to.kind !== 'foe') return 0;
    const f = this.foe(r.to.id); return f && this.swing >= SHIELD_SPEED ? r.len + f.r : 0;
  }
  anchorAt(a: Anchor): { x: number; y: number } | null {
    if (a.kind === 'enzo') return this.layout.enzo;
    if (a.kind === 'post') return this.layout.posts[a.i] ?? null;
    return this.foe(a.id) ?? null;
  }

  /** set up an arena: its layout and the first wave */
  enter(arena: number, empty = false) {
    this.arena = arena; this.layout = makeLayout(arena, this.seed);
    if (empty) this.layout.waves = [];
    this.waveIx = 0; this.queue = []; this.spawnT = 0.6; this.arenaT = 0; this.summonT = 9;
    this.foes = []; this.shots = []; this.quakes = []; this.pickups = []; this.hook = null; this.rope = null;
    this.x = START.x; this.y = START.y; this.vx = this.vy = 0; this.flying = 0; this.inv = 1;
    this.phase = 'fight'; this.offer = [];
    if (this.layout.waves.length) { this.queue = [...this.layout.waves[0]]; this.events.push({ k: 'wave', n: 1, of: this.layout.waves.length }); }
  }

  /** add an enemy (the tests and the waves both use this) */
  spawn(kind: FoeKind, x: number, y: number, ready = false): Foe {
    const d = FOES[kind];
    const f: Foe = { id: this.nextId++, kind, x, y, vx: 0, vy: 0, r: d.r, mass: d.mass, hp: d.hp, maxHp: d.hp, state: ready ? 'walk' : 'spawn', t: ready ? 0 : 0.7,
      cd: 0.8 + this.rand() * 1.5, face: x < this.x ? 1 : -1, dir: { x: 0, y: 0 }, flung: 0, dead: false, flash: 0, tumble: 0 };
    this.foes.push(f); return f;
  }

  /** a spot at the edge of the floor, well away from Dora and clear of the props */
  private spawnSpot(r: number) {
    const L = this.layout;
    for (let i = 0; i < 60; i++) {
      const side = Math.floor(this.rand() * 4), u = this.rand();
      const x = side < 2 ? FLOOR.x0 + 20 + u * (FLOOR.x1 - FLOOR.x0 - 40) : side === 2 ? FLOOR.x0 + 18 : FLOOR.x1 - 18;
      const y = side === 0 ? FLOOR.y0 + 16 : side === 1 ? FLOOR.y1 - 16 : FLOOR.y0 + 20 + u * (FLOOR.y1 - FLOOR.y0 - 40);
      if (len(x - this.x, y - this.y) < 120) continue;
      if ([...L.spikes, ...L.pits, ...L.posts, L.enzo, ...L.crates.filter((c) => !c.broken)].some((p) => len(p.x - x, p.y - y) < p.r + r + 8)) continue;
      if (this.foes.some((f) => !f.dead && len(f.x - x, f.y - y) < f.r + r + 4)) continue;
      return { x, y };
    }
    return { x: FLOOR.x0 + 30 + this.rand() * 40, y: FLOOR.y0 + 20 };
  }

  /** take one of the upgrades on offer and go on to the next arena (with nothing left to offer, just go on) */
  pick(id?: UpId) {
    if (this.phase !== 'pick') return false;
    if (this.offer.length) {
      if (!id || !this.offer.includes(id)) return false;
      this.mods[id]++;
      if (id === 'heart') { this.maxHp++; this.hp = Math.min(this.maxHp, this.hp + 1); }
    }
    this.enter(this.arena + 1);
    return true;
  }

  private makeOffer() {
    const open = UPGRADES.filter((u) => this.mods[u.id] < u.max).map((u) => u.id);
    const out: UpId[] = [];
    while (out.length < 3 && open.length) out.push(open.splice(Math.floor(this.rand() * open.length), 1)[0]);
    this.offer = out;
  }

  // ---------------------------------------------------------------- one step
  tick(inp: Input) {
    this.events = [];
    if (this.over || this.phase === 'pick') { this.prev = inp; return; }
    if (this.hitstop > 0) { this.hitstop -= DT; return; }
    const press = (k: 'hook' | 'dash') => inp[k] && !this.prev[k];
    this.t += DT; this.arenaT += DT;
    this.player(inp, press('dash'));
    this.tether(inp, press('hook'), !inp.hook && this.prev.hook);
    this.prev = { ...inp };
    for (const f of this.foes) if (!f.dead) this.think(f);
    this.summon();
    this.integrate();
    this.ropeConstraint(inp.hook);
    this.collide();
    this.updateShots();
    this.updateQuakes();
    this.pickupsTick();
    this.waves();
    if (this.comboT > 0) { this.comboT -= DT; if (this.comboT <= 0) { if (this.combo >= 3) this.events.push({ k: 'combo', n: this.combo }); this.combo = 0; } }
    this.foes = this.foes.filter((f) => !f.dead || f.flash > 0 || f.tumble > 0);
    for (const f of this.foes) if (f.dead) { f.flash -= DT; f.tumble -= DT; }
    const s = this.swing; if (s > this.stats.topSpeed) this.stats.topSpeed = s;
    if (this.hp <= 0 && !this.over) { this.phase = 'lost'; this.events.push({ k: 'lost' }); }
  }

  private player(inp: Input, dash: boolean) {
    if (this.inv > 0) this.inv -= DT;
    if (this.dashCd > 0) this.dashCd -= DT;
    if (this.flying > 0) this.flying -= DT;
    const m = len(inp.x, inp.y), mx = m > 1 ? inp.x / m : inp.x, my = m > 1 ? inp.y / m : inp.y;
    if (mx) this.face = mx > 0 ? 1 : -1;
    // aim: the mouse or stick if given, otherwise the way Dora is walking or facing
    const am = len(inp.ax, inp.ay);
    if (am > 0.2) this.aim = { x: inp.ax / am, y: inp.ay / am };
    else if (m > 0.2) this.aim = { x: mx, y: my };
    { const a = len(this.aim.x, this.aim.y) || 1; this.aim = { x: this.aim.x / a, y: this.aim.y / a }; }
    if (dash && this.dashCd <= 0) {
      const d = m > 0.2 ? { x: mx / len(mx, my), y: my / len(mx, my) } : { x: this.face, y: 0 };
      this.dashDir = d; this.dashT = DASH.time; this.dashCd = this.dashCdMax; this.events.push({ k: 'dash' });
      // a dash while whirling an enemy cracks the rope like a whip: a burst of swing speed
      const r = this.rope;
      if (r && r.to.kind === 'foe') { const f = this.foe(r.to.id); if (f) { const u = this.unit(f.x - this.x, f.y - this.y), t = { x: -u.y * r.spin, y: u.x * r.spin }; const k = 90 * Math.min(1, 3 / f.mass); f.vx += t.x * k; f.vy += t.y * k; } }
    }
    if (this.dashT > 0) { this.dashT -= DT; this.vx = this.dashDir.x * DASH.speed; this.vy = this.dashDir.y * DASH.speed; if (this.dashT <= 0) this.inv = Math.max(this.inv, 0.25); return; }
    const swingingSelf = this.rope && this.rope.to.kind !== 'foe';
    if (this.flying > 0 || swingingSelf) {
      // flying free or swinging round an anchor: only a little steering
      this.vx += mx * 160 * DT; this.vy += my * 160 * DT;
      if (!swingingSelf) { const k = Math.exp(-1.6 * DT); this.vx *= k; this.vy *= k; }
      return;
    }
    const k = 1 - Math.exp(-16 * DT);
    this.vx += (mx * RUN_SPEED - this.vx) * k; this.vy += (my * RUN_SPEED - this.vy) * k;
  }

  private unit(x: number, y: number) { const l = len(x, y) || 1; return { x: x / l, y: y / l }; }

  /** the nearest thing worth hooking roughly where Dora is aiming */
  autoAim(): { x: number; y: number } | null {
    let best: { x: number; y: number } | null = null, score = Infinity;
    const cands: { x: number; y: number }[] = [...this.foes.filter((f) => !f.dead && f.state !== 'spawn'), this.layout.enzo, ...this.layout.posts];
    for (const c of cands) {
      const dx = c.x - this.x, dy = c.y - this.y, d = len(dx, dy); if (d > this.ropeMax + 30 || d < 4) continue;
      const dot = (dx * this.aim.x + dy * this.aim.y) / d; if (dot < 0.5) continue;
      const s = d * (2 - dot) * (c === this.layout.enzo || this.layout.posts.includes(c as Prop) ? 1.4 : 1);
      if (s < score) { score = s; best = c; }
    }
    return best;
  }

  private tether(inp: Input, press: boolean, let_go: boolean) {
    if (this.hookCd > 0) this.hookCd -= DT;
    if (press && !this.hook && !this.rope && this.hookCd <= 0) {
      const t = Math.abs(inp.ax) + Math.abs(inp.ay) > 0.2 ? null : this.autoAim();
      const d = t ? this.unit(t.x - this.x, t.y - this.y) : this.aim;
      this.hook = { x: this.x, y: this.y, vx: d.x * HOOK_SPEED, vy: d.y * HOOK_SPEED, d: 0 };
      this.events.push({ k: 'hook' });
    }
    const h = this.hook;
    if (h) {
      const steps = 3;
      for (let i = 0; i < steps && this.hook; i++) {
        h.x += (h.vx * DT) / steps; h.y += (h.vy * DT) / steps; h.d += (HOOK_SPEED * DT) / steps;
        const hit = this.hookHit(h);
        if (hit) { this.latch(hit, inp.hook); break; }
        if (h.d > this.ropeMax || h.x < FLOOR.x0 - 6 || h.x > FLOOR.x1 + 6 || h.y < FLOOR.y0 - 10 || h.y > FLOOR.y1 + 6) { this.hook = null; this.hookCd = 0.2; this.events.push({ k: 'miss' }); }
      }
    }
    if (let_go && this.rope) this.release();
  }

  private hookHit(h: Hook): Anchor | null {
    for (const f of this.foes) if (!f.dead && f.state !== 'spawn' && len(f.x - h.x, f.y - h.y) < f.r + 3) return { kind: 'foe', id: f.id };
    const e = this.layout.enzo; if (len(e.x - h.x, e.y - h.y) < e.r + 3) return { kind: 'enzo' };
    for (let i = 0; i < this.layout.posts.length; i++) { const p = this.layout.posts[i]; if (len(p.x - h.x, p.y - h.y) < p.r + 4) return { kind: 'post', i }; }
    return null;
  }

  private latch(a: Anchor, held: boolean) {
    this.hook = null;
    const at = this.anchorAt(a)!; const d = len(at.x - this.x, at.y - this.y);
    if (a.kind === 'foe') {
      const f = this.foe(a.id)!;
      if (this.mods.barb) { this.hurtFoe(f, this.mods.barb, 'hit'); if (f.dead) return; if (f.kind !== 'golem') { f.state = 'stun'; f.t = 0.4 + 0.3 * this.mods.barb; } }
      // a quick tap yanks it to Dora instead of swinging it
      if (!held) { const u = this.unit(this.x - f.x, this.y - f.y), k = 230 * Math.min(1, 2.5 / f.mass); f.vx = u.x * k; f.vy = u.y * k; f.flung = 0.45; this.events.push({ k: 'yank' }); this.hookCd = 0.25; return; }
      // whirl the way it was already going round, or the way Dora is moving round it, or clockwise
      const u = this.unit(f.x - this.x, f.y - this.y), rvx = f.vx - this.vx, rvy = f.vy - this.vy, vt = -u.y * rvx + u.x * rvy;
      const mt = -u.y * this.vx + u.x * this.vy;
      const spin: 1 | -1 = Math.abs(vt) > 25 ? (vt > 0 ? 1 : -1) : Math.abs(mt) > 20 ? (mt < 0 ? 1 : -1) : 1;
      this.rope = { to: a, len: clamp(d, ROPE.min, this.ropeMax), spin };
      this.events.push({ k: 'latch', to: 'foe', kind: f.kind });
    } else {
      if (!held) { this.hookCd = 0.2; this.events.push({ k: 'miss' }); return; }
      const u = this.unit(this.x - at.x, this.y - at.y), vt = -u.y * this.vx + u.x * this.vy;
      this.rope = { to: a, len: clamp(d, ROPE.min, this.ropeMax), spin: vt >= 0 ? 1 : -1 };
      this.events.push({ k: 'latch', to: a.kind });
    }
  }

  release() {
    const r = this.rope; if (!r) return;
    this.rope = null; this.hookCd = 0.15;
    if (r.to.kind === 'foe') {
      const f = this.foe(r.to.id); if (!f) return;
      const k = 1 + 0.25 * this.mods.elastic; f.vx *= k; f.vy *= k; f.flung = 1.4; (f as Foe & { blast?: boolean }).blast = this.mods.blast > 0;
      this.events.push({ k: 'release', speed: len(f.vx, f.vy) });
    } else { this.flying = 0.6; this.events.push({ k: 'release', speed: len(this.vx, this.vy) }); }
  }

  // ---------------------------------------------------------------- enemies' minds
  private think(f: Foe) {
    if (f.flash > 0) f.flash -= DT;
    const def = FOES[f.kind], caught = this.rope?.to.kind === 'foe' && this.rope.to.id === f.id;
    if (f.flung > 0) f.flung -= DT;
    if (f.state === 'spawn') { f.t -= DT; if (f.t <= 0) f.state = 'walk'; return; }
    if (f.state === 'stun') { f.t -= DT; if (f.t <= 0) f.state = 'walk'; return; }
    // a swung enemy is helpless, except a charging boar or the golem, which are too heavy to stop
    if ((caught || f.flung > 0) && f.kind !== 'golem' && !(f.kind === 'boar' && f.state === 'charge')) { if (f.state !== 'walk') { f.state = 'walk'; f.cd = 0.8; } return; }
    const dx = this.x - f.x, dy = this.y - f.y, d = len(dx, dy) || 1;
    if (Math.abs(f.vx) > 4) f.face = f.vx > 0 ? 1 : -1; else if (Math.abs(dx) > 2) f.face = dx > 0 ? 1 : -1;
    f.cd -= DT;
    const want = (vx: number, vy: number, rate = 6) => { const k = 1 - Math.exp(-rate * DT); f.vx += (vx - f.vx) * k; f.vy += (vy - f.vy) * k; };
    const walk = (sp: number, sign = 1) => { const a = this.avoid(f); want((dx / d) * sp * sign + a.x * sp, (dy / d) * sp * sign + a.y * sp); };
    switch (f.kind) {
      case 'slime':
        want(0, 0, 4);
        if (f.cd <= 0) { f.cd = 0.8 + this.rand() * 0.5; const a = this.avoid(f), k = 95; f.vx = (dx / d + a.x) * k; f.vy = (dy / d + a.y) * k; }
        break;
      case 'grumble': case 'beetle': case 'shellback': walk(def.speed); break;
      case 'spitter':
        if (f.state === 'aim') { want(0, 0); f.t -= DT; if (f.t <= 0) { f.state = 'walk'; f.cd = 2 + this.rand() * 0.8; this.fire(f, 'acorn', Math.atan2(dy, dx)); } break; }
        walk(def.speed, d > 130 ? 1 : d < 90 ? -1 : 0);
        if (f.cd <= 0 && d < 220) { f.state = 'aim'; f.t = 0.6; this.events.push({ k: 'telegraph', kind: f.kind }); }
        break;
      case 'boar':
        if (f.state === 'aim') { want(0, 0, 10); f.t -= DT; f.dir = this.unit(dx, dy); if (f.t <= 0) { f.state = 'charge'; f.t = 1.1; } break; }
        if (f.state === 'charge') { f.t -= DT; f.vx = f.dir.x * 210; f.vy = f.dir.y * 210; f.face = f.dir.x >= 0 ? 1 : -1; if (f.t <= 0) { f.state = 'walk'; f.cd = 1.6 + this.rand(); } break; }
        walk(def.speed);
        if (f.cd <= 0 && d < 190) { f.state = 'aim'; f.t = 0.7; this.events.push({ k: 'telegraph', kind: f.kind }); }
        break;
      case 'golem':
        if (f.state === 'slam') { want(0, 0, 10); f.t -= DT; if (f.t <= 0) { f.state = 'walk'; f.cd = 3.2; this.quakes.push({ x: f.x, y: f.y, r: f.r, max: 110, hit: false }); this.events.push({ k: 'quake' }); } break; }
        if (f.state === 'throw') { want(0, 0, 10); f.t -= DT; if (f.t <= 0) { f.state = 'walk'; f.cd = 3.2; const a = Math.atan2(dy, dx); for (const s of [-0.35, 0, 0.35]) this.fire(f, 'rock', a + s); } break; }
        walk(def.speed);
        if (f.cd <= 0) { const slam = d < 110; f.state = slam ? 'slam' : 'throw'; f.t = slam ? 0.9 : 0.8; this.events.push({ k: 'telegraph', kind: f.kind }); }
        break;
    }
  }

  /** the golem calls in more little ones every few seconds, so there's always something to swing at it */
  private summon() {
    if (!this.foes.some((f) => f.kind === 'golem' && !f.dead)) return;
    this.summonT -= DT; if (this.summonT > 0) return;
    this.summonT = 8; if (this.foes.filter((g) => !g.dead).length >= 5) return;
    for (let i = 0; i < 2; i++) { const p = this.spawnSpot(7); this.spawn(this.rand() < 0.35 ? 'beetle' : this.rand() < 0.5 ? 'slime' : 'grumble', p.x, p.y); }
    this.events.push({ k: 'summon' });
  }

  /** a gentle push away from pits, spikes, crates and Enzo so walkers go round them */
  private avoid(f: Foe) {
    let ax = 0, ay = 0; const L = this.layout;
    const push = (p: Prop, reach: number) => { const dx = f.x - p.x, dy = f.y - p.y, d = len(dx, dy); const m = p.r + f.r + reach; if (d < m && d > 0.01) { const k = (m - d) / m; ax += (dx / d) * k * 1.6; ay += (dy / d) * k * 1.6; } };
    for (const p of L.pits) push(p, 22); for (const p of L.spikes) push(p, 10); for (const c of L.crates) if (!c.broken) push(c, 6); push(L.enzo, 8);
    return { x: ax, y: ay };
  }

  private fire(f: Foe, kind: Shot['kind'], a: number) {
    const sp = kind === 'rock' ? 120 : 150;
    this.shots.push({ x: f.x + Math.cos(a) * (f.r + 3), y: f.y + Math.sin(a) * (f.r + 3), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: kind === 'rock' ? 5 : 3, kind, dead: false });
    this.events.push({ k: 'shot', kind });
  }

  // ---------------------------------------------------------------- motion and the rope
  private integrate() {
    this.x += this.vx * DT; this.y += this.vy * DT;
    for (const f of this.foes) {
      if (f.dead && f.tumble <= 0) continue;
      // sliding: flung enemies slide a long way, walkers stop quickly (their minds set their speed anyway)
      const caught = this.rope?.to.kind === 'foe' && this.rope.to.id === f.id;
      if (!caught && f.state !== 'charge') { const k = Math.exp(-(f.flung > 0 ? 1.1 : f.state === 'stun' ? 5 : 0.6) * DT); f.vx *= k; f.vy *= k; }
      f.x += f.vx * DT; f.y += f.vy * DT;
    }
  }

  private ropeConstraint(held: boolean) {
    const r = this.rope; if (!r) return;
    const a = this.anchorAt(r.to);
    if (!a) { this.rope = null; return; }
    if (!held) return;
    const dx = a.x - this.x, dy = a.y - this.y, d = len(dx, dy) || 1, u = { x: dx / d, y: dy / d };
    if (r.to.kind === 'foe') {
      const f = a as Foe, im = 1 / this.mass, fm = 1 / f.mass, sum = im + fm;
      // whirl it: speed it round in its direction, up to a top speed that falls with its weight
      const t = { x: -u.y * r.spin, y: u.x * r.spin };
      const cap = (SPIN.cap + 30 * this.mods.whirl + 12 * this.mods.long) * Math.sqrt(Math.min(1, (2 * this.mass) / PLAYER_MASS / f.mass));
      const rvx = f.vx - this.vx, rvy = f.vy - this.vy, vt = rvx * t.x + rvy * t.y;
      if (vt < cap) { const acc = SPIN.acc * (1 + this.mods.whirl / 3) * Math.min(1, (1.5 * this.mass) / PLAYER_MASS / f.mass) * DT; const add = Math.min(acc, cap - vt); f.vx += t.x * add; f.vy += t.y * add; }
      else { const k = Math.exp(-2 * DT); const extra = (vt - cap) * (1 - k); f.vx -= t.x * extra; f.vy -= t.y * extra; }
      // the rope never stretches: pull the two together by their weights, and stop them flying apart
      if (d > r.len) {
        const c = d - r.len; this.x += u.x * c * (im / sum); this.y += u.y * c * (im / sum); f.x -= u.x * c * (fm / sum); f.y -= u.y * c * (fm / sum);
        const sep = (f.vx - this.vx) * u.x + (f.vy - this.vy) * u.y;
        if (sep > 0) { this.vx += u.x * sep * (im / sum); this.vy += u.y * sep * (im / sum); f.vx -= u.x * sep * (fm / sum); f.vy -= u.y * sep * (fm / sum); }
      }
      f.flung = Math.max(f.flung, 0.15);
    } else {
      // swinging round Enzo or a post: Dora is the one going round
      const t = { x: u.y * r.spin, y: -u.x * r.spin };
      const vt = this.vx * t.x + this.vy * t.y, cap = SPIN.cap + 20 * this.mods.whirl;
      if (vt < cap) { const add = Math.min(SPIN.acc * 0.9 * DT, cap - vt); this.vx += t.x * add; this.vy += t.y * add; }
      if (d > r.len) {
        const c = d - r.len; this.x += u.x * c; this.y += u.y * c;
        const sep = -(this.vx * u.x + this.vy * u.y); if (sep > 0) { this.vx += u.x * sep; this.vy += u.y * sep; }
      }
    }
  }

  // ---------------------------------------------------------------- collisions and impacts
  private pairReady(a: number, b: number) {
    const k = a < b ? `${a}:${b}` : `${b}:${a}`, t = this.pairs.get(k) ?? -1;
    if (this.t - t < 0.3) return false; this.pairs.set(k, this.t); return true;
  }

  hurtFoe(f: Foe, dmg: number, how: 'hit' | 'fall' | 'boom', speed = 999) {
    if (f.dead || dmg <= 0) return;
    if (how === 'hit' && speed < FOES[f.kind].armour) { this.events.push({ k: 'tink', x: f.x, y: f.y }); return; }
    f.hp -= dmg; f.flash = 0.12;
    if (f.kind === 'beetle' && !f.dead) { this.explode(f); return; }
    if (f.hp <= 0) this.kill(f, how);
  }

  private kill(f: Foe, how: 'hit' | 'fall' | 'boom') {
    if (f.dead) return;
    f.dead = true; f.flash = how === 'fall' ? 0.5 : 0.25; this.stats.kills++;
    if (how === 'hit' && len(f.vx, f.vy) > HIT_MIN) { f.tumble = 0.5; f.flung = Math.max(f.flung, 0.5); }
    if (this.rope?.to.kind === 'foe' && this.rope.to.id === f.id) this.rope = null;
    this.events.push({ k: 'kill', kind: f.kind, x: f.x, y: f.y, how });
    if (f.kind === 'golem') { for (const g of this.foes) if (!g.dead && g !== f) { g.dead = true; g.flash = 0.25; } }
  }

  private explode(f: Foe) {
    f.dead = true; f.flash = 0.3; this.stats.kills++;
    if (this.rope?.to.kind === 'foe' && this.rope.to.id === f.id) this.rope = null;
    this.events.push({ k: 'boom', x: f.x, y: f.y }); this.events.push({ k: 'kill', kind: f.kind, x: f.x, y: f.y, how: 'boom' });
    this.blast(f.x, f.y, 44, 3);
  }

  /** a blast: damage and a shove outwards for everything close, chaining into other beetles */
  private blast(x: number, y: number, rad: number, dmg: number) {
    this.hitstop = Math.max(this.hitstop, 0.07);
    for (const g of this.foes) {
      if (g.dead) continue; const dx = g.x - x, dy = g.y - y, d = len(dx, dy); if (d > rad + g.r) continue;
      const u = d > 0.01 ? { x: dx / d, y: dy / d } : { x: 1, y: 0 }, k = (260 * Math.min(1, 2 / g.mass) + 40) * (1 - d / (rad + g.r) * 0.5);
      g.vx += u.x * k; g.vy += u.y * k; g.flung = Math.max(g.flung, 0.9);
      this.hurtFoe(g, g.kind === 'golem' ? dmg : dmg, 'boom');
    }
    for (const c of this.layout.crates) if (!c.broken && len(c.x - x, c.y - y) < rad + c.r) this.breakCrate(c);
    if (len(this.x - x, this.y - y) < rad * 0.7 + PLAYER_R) this.hurtPlayer(1, x, y);
  }

  private hurtPlayer(n: number, fx: number, fy: number) {
    if (this.inv > 0 || this.dashT > 0 || this.over) return;
    this.hp -= n; this.inv = IFRAMES; this.hitstop = Math.max(this.hitstop, 0.08);
    const u = this.unit(this.x - fx, this.y - fy); this.vx = u.x * 170; this.vy = u.y * 170; this.flying = 0.2;
    this.events.push({ k: 'hurt', hp: this.hp });
    this.combo = 0; this.comboT = 0;
  }

  private breakCrate(c: Crate) {
    if (c.broken) return; c.broken = true; this.events.push({ k: 'crate', x: c.x, y: c.y });
    if (this.rand() < 0.35) this.pickups.push({ x: c.x, y: c.y, t: 0 });
  }

  /** what happens when two bodies meet at speed: both take damage, momentum swaps over, and the struck one flies */
  private impact(a: Foe, b: Foe) {
    const dx = b.x - a.x, dy = b.y - a.y, d = len(dx, dy) || 0.01, u = { x: dx / d, y: dy / d }, over = a.r + b.r - d;
    const ia = 1 / a.mass, ib = 1 / b.mass, sum = ia + ib;
    a.x -= u.x * over * (ia / sum); a.y -= u.y * over * (ia / sum); b.x += u.x * over * (ib / sum); b.y += u.y * over * (ib / sum);
    const vn = (a.vx - b.vx) * u.x + (a.vy - b.vy) * u.y; if (vn <= 0) return;
    const live = a.flung > 0 || b.flung > 0;
    const j = (1.7 * vn) / sum;
    a.vx -= j * ia * u.x; a.vy -= j * ia * u.y; b.vx += j * ib * u.x; b.vy += j * ib * u.y;
    if (!live || vn < HIT_MIN || !this.pairReady(a.id, b.id)) return;
    const dmg = damageAt(vn);
    // bowling: whatever gets hit flies off and hurts what it hits in turn
    const boost = 1 + 0.3 * this.mods.bowl;
    for (const g of [a, b]) if (g.flung <= 0.15 && g.kind !== 'golem') { g.vx *= boost; g.vy *= boost; g.flung = 0.9; }
    this.stats.hits++;
    this.events.push({ k: 'hit', x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, dmg, speed: vn });
    this.hitstop = Math.max(this.hitstop, Math.min(0.09, 0.03 + 0.012 * dmg));
    this.combo++; this.comboT = 1.1; if (this.combo > this.stats.bestCombo) this.stats.bestCombo = this.combo;
    for (const g of [a, b]) { const bl = g as Foe & { blast?: boolean }; if (bl.blast) { bl.blast = false; this.blast(g.x, g.y, 30 + 6 * this.mods.blast, 2); } }
    if (b.kind === 'golem' && dmg >= 3) { b.state = 'stun'; b.t = 0.8; }
    this.hurtFoe(a, dmg, 'hit', vn); this.hurtFoe(b, dmg, 'hit', vn);
  }

  /** a body against something that does not move (a wall, a spike, a post, Enzo): the bounce, and how hard it hit */
  private bounce(f: { x: number; y: number; vx: number; vy: number }, nx: number, ny: number, push: number, rest: number) {
    f.x += nx * push; f.y += ny * push;
    const vn = -(f.vx * nx + f.vy * ny); if (vn <= 0) return 0;
    f.vx += nx * vn * (1 + rest); f.vy += ny * vn * (1 + rest);
    return vn;
  }

  private collide() {
    const L = this.layout, live = this.foes.filter((f) => !f.dead || f.tumble > 0);
    const statics: Prop[] = [...L.spikes, ...L.posts, L.enzo, ...L.crates.filter((c) => !c.broken)];
    // enemies against the room
    for (const f of live) {
      if (f.state === 'spawn') continue;
      for (const p of statics) {
        const dx = f.x - p.x, dy = f.y - p.y, d = len(dx, dy), m = f.r + p.r; if (d >= m) continue;
        const nx = d > 0.01 ? dx / d : 1, ny = d > 0.01 ? dy / d : 0;
        const vn = this.bounce(f, nx, ny, m - d, f.flung > 0 ? 0.5 : 0);
        if (L.spikes.includes(p) && vn >= 50) { this.events.push({ k: 'spike', x: f.x, y: f.y }); this.hurtFoe(f, 3, 'boom'); this.hitstop = Math.max(this.hitstop, 0.06); }
        else if ((p as Crate).broken === false && vn >= 90 && f.flung > 0) this.breakCrate(p as Crate);
        else if (f.kind === 'boar' && f.state === 'charge') { f.state = 'stun'; f.t = 1.4; this.hurtFoe(f, 1, 'boom'); this.events.push({ k: 'slam', x: f.x, y: f.y, speed: vn }); }
      }
      // pits: anything but the golem that ends up over the middle of one falls in
      if (f.kind !== 'golem' && !f.dead) for (const p of L.pits) if (len(f.x - p.x, f.y - p.y) < p.r - f.r * 0.2) { this.kill(f, 'fall'); break; }
      // the walls
      const walls: [number, number, number][] = [[f.x - f.r - FLOOR.x0, 1, 0], [FLOOR.x1 - f.x - f.r, -1, 0], [f.y - f.r - FLOOR.y0, 0, 1], [FLOOR.y1 - f.y - f.r, 0, -1]];
      for (const [gap, nx, ny] of walls) {
        if (gap >= 0) continue;
        const vn = this.bounce(f, nx, ny, -gap, f.flung > 0 ? 0.55 : 0);
        if (f.kind === 'boar' && f.state === 'charge') { f.state = 'stun'; f.t = 1.4; this.hurtFoe(f, 1, 'boom'); this.events.push({ k: 'slam', x: f.x, y: f.y, speed: vn }); continue; }
        if (f.flung > 0 && vn >= 90 && !f.dead) {
          this.events.push({ k: 'slam', x: f.x, y: f.y, speed: vn }); this.hitstop = Math.max(this.hitstop, 0.05);
          if (this.mods.quake) this.blast(f.x, f.y, 26 + 8 * this.mods.quake, 1);
          if (!f.dead) this.hurtFoe(f, damageAt(vn), 'hit', vn);
        }
      }
    }
    // enemies against each other
    for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
      const a = live[i], b = live[j]; if ((a.dead && b.dead) || a.state === 'spawn' || b.state === 'spawn') continue;
      if (len(b.x - a.x, b.y - a.y) < a.r + b.r) this.impact(a, b);
    }
    // Dora against the room and the enemies
    const solid: Prop[] = [...L.spikes, ...L.posts, L.enzo, ...L.crates.filter((c) => !c.broken), ...L.pits.map((p) => ({ x: p.x, y: p.y, r: p.r - 5 }))];
    const fast = len(this.vx, this.vy);
    for (const p of solid) {
      const dx = this.x - p.x, dy = this.y - p.y, d = len(dx, dy), m = PLAYER_R + p.r; if (d >= m) continue;
      if ((p as Crate).broken === false && (fast > 140 || this.dashT > 0)) { this.breakCrate(p as Crate); continue; }
      this.bounce(this, d > 0.01 ? dx / d : 1, d > 0.01 ? dy / d : 0, m - d, 0.3);
    }
    if (this.x < FLOOR.x0 + PLAYER_R) this.bounce(this, 1, 0, FLOOR.x0 + PLAYER_R - this.x, 0.3);
    if (this.x > FLOOR.x1 - PLAYER_R) this.bounce(this, -1, 0, this.x - FLOOR.x1 + PLAYER_R, 0.3);
    if (this.y < FLOOR.y0 + PLAYER_R) this.bounce(this, 0, 1, FLOOR.y0 + PLAYER_R - this.y, 0.3);
    if (this.y > FLOOR.y1 - PLAYER_R) this.bounce(this, 0, -1, this.y - FLOOR.y1 + PLAYER_R, 0.3);
    const ropeFoe = this.rope?.to.kind === 'foe' ? this.rope.to.id : -1;
    // flying round Enzo (or let go of him) Dora is the flail herself
    const slamming = fast >= 140 && (this.flying > 0 || (this.rope && this.rope.to.kind !== 'foe'));
    for (const f of this.foes) {
      // a dash goes straight through
      if (f.dead || f.state === 'spawn' || this.dashT > 0) continue;
      const dx = f.x - this.x, dy = f.y - this.y, d = len(dx, dy), m = f.r + PLAYER_R; if (d >= m) continue;
      const u = d > 0.01 ? { x: dx / d, y: dy / d } : { x: 1, y: 0 };
      if (slamming) {
        const vn = (this.vx - f.vx) * u.x + (this.vy - f.vy) * u.y;
        if (vn > 0 && this.pairReady(0, f.id)) {
          const j = (1.6 * vn) / (1 / this.mass + 1 / f.mass);
          f.vx += (j / f.mass) * u.x; f.vy += (j / f.mass) * u.y; this.vx -= (j / this.mass) * u.x * 0.5; this.vy -= (j / this.mass) * u.y * 0.5; f.flung = 0.9;
          const dmg = damageAt(vn); this.stats.hits++; this.events.push({ k: 'hit', x: f.x, y: f.y, dmg, speed: vn });
          this.hitstop = Math.max(this.hitstop, 0.05); this.combo++; this.comboT = 1.1; if (this.combo > this.stats.bestCombo) this.stats.bestCombo = this.combo;
          this.hurtFoe(f, dmg, 'hit', vn);
        }
        continue;
      }
      // push apart; a hostile one hurts on touch, a swung or flying one does not
      const ip = 1 / this.mass, ifm = 1 / f.mass, sum = ip + ifm, over = m - d;
      this.x -= u.x * over * (ip / sum); this.y -= u.y * over * (ip / sum); f.x += u.x * over * (ifm / sum); f.y += u.y * over * (ifm / sum);
      if (f.id !== ropeFoe && f.flung <= 0 && f.state !== 'stun') this.hurtPlayer(FOES[f.kind].touch, f.x, f.y);
    }
    if (!L.pits.some((p) => len(this.x - p.x, this.y - p.y) < p.r + 10)) this.lastSafe = { x: this.x, y: this.y };
  }

  private updateShots() {
    const shield = this.shield;
    for (const s of this.shots) {
      if (s.dead) continue;
      s.x += s.vx * DT; s.y += s.vy * DT;
      if (s.x < FLOOR.x0 - 4 || s.x > FLOOR.x1 + 4 || s.y < FLOOR.y0 - 8 || s.y > FLOOR.y1 + 4) { s.dead = true; continue; }
      const L = this.layout;
      if ([...L.spikes, ...L.posts, L.enzo, ...L.crates.filter((c) => !c.broken)].some((p) => len(p.x - s.x, p.y - s.y) < p.r + s.r)) { s.dead = true; continue; }
      // a fast-whirling rope is a blur that shots can't get through
      if (shield && len(s.x - this.x, s.y - this.y) < shield) { s.dead = true; this.events.push({ k: 'tink', x: s.x, y: s.y }); continue; }
      // a swung or flying enemy is a shield
      for (const f of this.foes) if (!f.dead && f.state !== 'spawn' && (f.flung > 0) && len(f.x - s.x, f.y - s.y) < f.r + s.r) { s.dead = true; this.events.push({ k: 'tink', x: s.x, y: s.y }); break; }
      if (s.dead) continue;
      if (len(this.x - s.x, this.y - s.y) < PLAYER_R + s.r - 1) { s.dead = true; this.hurtPlayer(1, s.x - s.vx, s.y - s.vy); }
    }
    this.shots = this.shots.filter((s) => !s.dead);
  }

  private updateQuakes() {
    for (const q of this.quakes) {
      q.r += 160 * DT;
      const d = len(this.x - q.x, this.y - q.y);
      if (!q.hit && Math.abs(d - q.r) < 7) { q.hit = true; this.hurtPlayer(1, q.x, q.y); }
    }
    this.quakes = this.quakes.filter((q) => q.r < q.max);
  }

  private pickupsTick() {
    for (const p of this.pickups) { p.t += DT; if (len(p.x - this.x, p.y - this.y) < PLAYER_R + 6 && this.hp < this.maxHp) { this.hp++; p.t = 999; this.events.push({ k: 'heart' }); } }
    this.pickups = this.pickups.filter((p) => p.t < 20);
  }

  private waves() {
    if (this.queue.length) {
      this.spawnT -= DT;
      if (this.spawnT <= 0) { const k = this.queue.shift()!; const p = this.spawnSpot(FOES[k].r); this.spawn(k, p.x, p.y); this.spawnT = 0.35; }
      return;
    }
    if (this.foes.some((f) => !f.dead)) return;
    if (this.boss && this.arenaT > 1) { this.phase = 'won'; this.stats.arenas = this.arena + 1; this.events.push({ k: 'won' }); return; }
    if (this.waveIx + 1 < this.layout.waves.length) {
      this.waveIx++; this.queue = [...this.layout.waves[this.waveIx]]; this.spawnT = 0.9;
      this.events.push({ k: 'wave', n: this.waveIx + 1, of: this.layout.waves.length });
      return;
    }
    if (!this.layout.waves.length) return;
    this.rope = null; this.hook = null; this.foes = []; this.shots = []; this.quakes = [];
    this.stats.arenas = this.arena + 1;
    if (this.mods.mend) this.hp = Math.min(this.maxHp, this.hp + 1);
    if ((this.arena + 1) % ARENAS_PER_BIOME === 0) this.hp = Math.min(this.maxHp, this.hp + 1);
    this.events.push({ k: 'clear', arena: this.arena });
    this.phase = 'pick'; this.makeOffer();
  }
}

// ---------------------------------------------------------------- the save
export const SAVE_KEY = 'tetherball-v1';
export type Save = {
  v: 1; intro: boolean;
  best: { arena: number; kills: number; combo: number; speed: number };
  stats: { runs: number; wins: number; kills: number };
  seen: FoeKind[];
  settings: { sound: boolean; music: boolean };
};
export const newSave = (): Save => ({ v: 1, intro: false, best: { arena: 0, kills: 0, combo: 0, speed: 0 }, stats: { runs: 0, wins: 0, kills: 0 }, seen: [], settings: { sound: true, music: true } });
export function parseSave(raw: string | null): Save {
  const s = newSave(); if (!raw) return s;
  try {
    const o = JSON.parse(raw); if (!o || o.v !== 1) return s;
    const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : d);
    s.intro = o.intro === true;
    for (const k of ['arena', 'kills', 'combo', 'speed'] as const) s.best[k] = num(o.best?.[k], 0);
    for (const k of ['runs', 'wins', 'kills'] as const) s.stats[k] = num(o.stats?.[k], 0);
    s.seen = Array.isArray(o.seen) ? o.seen.filter((k: unknown): k is FoeKind => typeof k === 'string' && k in FOES) : [];
    s.settings = { sound: o.settings?.sound !== false, music: o.settings?.music !== false };
  } catch { return newSave(); }
  return s;
}
export const serialise = (s: Save) => JSON.stringify(s);
/** fold a finished run into the save */
export function bank(s: Save, r: Run) {
  s.stats.runs++; if (r.phase === 'won') s.stats.wins++; s.stats.kills += r.stats.kills;
  s.best.arena = Math.max(s.best.arena, r.phase === 'won' ? ARENAS : r.arena + 1);
  s.best.kills = Math.max(s.best.kills, r.stats.kills); s.best.combo = Math.max(s.best.combo, r.stats.bestCombo);
  s.best.speed = Math.max(s.best.speed, swingMeter(r.stats.topSpeed));
}
