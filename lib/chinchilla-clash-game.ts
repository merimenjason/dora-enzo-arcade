// Chinchilla Clash: a Clash Royale-style lane battler. Two sides, two lanes, three towers each; play cards with bath
// dust to send troops over the river. Deterministic: every random pick comes from a seeded generator, so tests can
// replay a whole match. Coordinates are in tiles on an 18 × 32 arena; side 0 (the player) owns the bottom half.

export const W = 18, H = 32;
/** The river runs across the middle; ground troops cross it on the two bridges. */
export const RIVER_TOP = 15, RIVER_BOTTOM = 17, BRIDGES = [3.5, 14.5], BRIDGE_HALF = 1;
export const REGULATION = 180, DOUBLE_AT = 120, OVERTIME = 60;
export const MAX_DUST = 10, START_DUST = 5, REGEN = 2.8, DEPLOY_TIME = 1;
/** Crown towers take this share of spell damage, as in Clash Royale. */
export const TOWER_SPELL = 0.35;

export type Side = 0 | 1;
export type CardId = 'kits' | 'flickers' | 'dora' | 'enzo' | 'pebble' | 'dasher' | 'gliders' | 'mochi' | 'balloon' | 'dustbomb' | 'volley' | 'cannon';
export type Targets = 'ground' | 'all' | 'buildings';
export type Stats = {
  hp: number; dmg: number; rate: number; range: number; speed: number; r: number; targets: Targets;
  air?: boolean; splash?: number; selfSplash?: boolean; projectile?: number; jumps?: boolean; lifetime?: number; deathDmg?: number;
};
export type Card = {
  id: CardId; name: string; cost: number; kind: 'troop' | 'spell' | 'building'; blurb: string;
  count?: number; stats?: Stats; spell?: { radius: number; dmg: number; knock: number; air: boolean; speed: number };
};

// Speeds are tiles a second: slow 0.75, medium 1, fast 1.5, very fast 2.
export const CARDS: Record<CardId, Card> = {
  kits: { id: 'kits', name: 'Kit Squad', cost: 2, kind: 'troop', count: 4, blurb: 'Four baby chinchillas who nibble fast and fall fast.',
    stats: { hp: 90, dmg: 45, rate: 1, range: 0.4, speed: 1.5, r: 0.35, targets: 'ground' } },
  flickers: { id: 'flickers', name: 'Pellet Flickers', cost: 3, kind: 'troop', count: 2, blurb: 'Two sharpshooters who flick hay pellets at anything, flyers too.',
    stats: { hp: 230, dmg: 60, rate: 1, range: 5, speed: 1, r: 0.4, targets: 'all', projectile: 10 } },
  dora: { id: 'dora', name: 'Dora, Dust Duchess', cost: 5, kind: 'troop', blurb: 'Dora waves her fan and bursts clouds of bath dust over whole crowds, flyers too.',
    stats: { hp: 650, dmg: 140, rate: 1.4, range: 5.5, speed: 1, r: 0.5, targets: 'all', splash: 1.3, projectile: 7 } },
  enzo: { id: 'enzo', name: 'Enzo, Boulder Brawler', cost: 4, kind: 'troop', blurb: 'Enzo spins with his claws out and hits everything around him on the ground.',
    stats: { hp: 1350, dmg: 150, rate: 1.6, range: 0.6, speed: 1, r: 0.55, targets: 'ground', splash: 1.8, selfSplash: true } },
  pebble: { id: 'pebble', name: 'Grandpa Pebble', cost: 5, kind: 'troop', blurb: 'Slow, stubborn and very fluffy. Walks straight for towers and ignores everything else.',
    stats: { hp: 3200, dmg: 190, rate: 1.5, range: 0.6, speed: 0.75, r: 0.75, targets: 'buildings' } },
  dasher: { id: 'dasher', name: 'Dust Dasher', cost: 4, kind: 'troop', blurb: 'Races for towers and leaps clean over the river.',
    stats: { hp: 1150, dmg: 210, rate: 1.6, range: 0.6, speed: 2, r: 0.55, targets: 'buildings', jumps: true } },
  gliders: { id: 'gliders', name: 'Glider Gang', cost: 3, kind: 'troop', count: 3, blurb: 'Zippy and two sugar-glider pals swoop over the river and nip.',
    stats: { hp: 190, dmg: 80, rate: 1, range: 1.5, speed: 2, r: 0.4, targets: 'all', air: true } },
  mochi: { id: 'mochi', name: 'Mochi the Capybara', cost: 3, kind: 'troop', blurb: 'Calm, round and hard to budge. A great blocker for the price.',
    stats: { hp: 1450, dmg: 160, rate: 1.2, range: 0.6, speed: 1, r: 0.6, targets: 'ground' } },
  balloon: { id: 'balloon', name: 'Hay Balloon', cost: 5, kind: 'troop', blurb: 'A chinchilla in a basket drops hay bales on towers, and one last bale when popped.',
    stats: { hp: 1100, dmg: 450, rate: 3, range: 0.4, speed: 1, r: 0.7, targets: 'buildings', air: true, deathDmg: 200 } },
  dustbomb: { id: 'dustbomb', name: 'Dust Bomb', cost: 4, kind: 'spell', blurb: 'A heavy puff of dust that blasts a small area and knocks troops back.',
    spell: { radius: 2.5, dmg: 520, knock: 1.2, air: true, speed: 14 } },
  volley: { id: 'volley', name: 'Pellet Volley', cost: 3, kind: 'spell', blurb: 'A rain of pellets over a wide area. Clears out swarms.',
    spell: { radius: 4, dmg: 240, knock: 0, air: true, speed: 18 } },
  cannon: { id: 'cannon', name: 'Hay Cannon', cost: 3, kind: 'building', blurb: 'A hay-bale cannon that fires at ground troops for 30 seconds. Towers-first troops go for it.',
    stats: { hp: 800, dmg: 120, rate: 0.9, range: 5.5, speed: 0, r: 1, targets: 'ground', projectile: 12, lifetime: 30 } },
};
export const CARD_IDS = Object.keys(CARDS) as CardId[];
export const DECK_SIZE = 8, HAND_SIZE = 4;
export const DEFAULT_DECK: CardId[] = ['kits', 'flickers', 'dora', 'enzo', 'pebble', 'gliders', 'dustbomb', 'cannon'];
/** Dora and Enzo only fight for the player. */
export const HEROES: CardId[] = ['dora', 'enzo'];

export const TOWER = {
  princess: { hp: 1400, dmg: 50, rate: 0.8, range: 7.5, r: 1.5 },
  king: { hp: 2400, dmg: 60, rate: 1, range: 7, r: 2 },
};
/** Tower positions for side 0; side 1's are mirrored top to bottom. */
export const TOWER_SPOTS = { left: { x: 3.5, y: 25.5 }, right: { x: 14.5, y: 25.5 }, king: { x: 9, y: 28.5 } };

/** How the computer plays: how often it thinks, how much dust it saves before attacking, and how neat it is. */
export type AiLevel = { think: number; push: number; support: boolean; snipe: boolean; defend: number; sloppy: number };
export type Rival = { id: string; name: string; leader: string; arena: string; blurb: string; deck: CardId[]; ai: AiLevel };
export const RIVALS: Rival[] = [
  { id: 'beige', name: 'Sandy’s Beige Brigade', leader: 'Sandy', arena: 'Salt Flat Arena', blurb: 'Sandy saves up and sends everything at once. A good place to learn the lanes.',
    deck: ['kits', 'flickers', 'mochi', 'pebble', 'gliders', 'volley', 'cannon', 'dasher'],
    ai: { think: 1.3, push: 9.5, support: false, snipe: false, defend: 0.5, sloppy: 1.6 } },
  { id: 'violet', name: 'Duchess Velvet’s Violets', leader: 'Duchess Velvet', arena: 'Cactus Canyon', blurb: 'Velvet backs Grandpa Pebble with Flickers and races Dust Dashers down the lanes.',
    deck: ['kits', 'flickers', 'mochi', 'dasher', 'gliders', 'dustbomb', 'volley', 'pebble'],
    ai: { think: 1.1, push: 9, support: true, snipe: false, defend: 0.55, sloppy: 1.2 } },
  { id: 'ebony', name: 'Baron Ebony’s Night Guard', leader: 'Baron Ebony', arena: 'Moonlit Summit', blurb: 'The Baron defends sharply, backs his balloons and finishes weak towers with spells.',
    deck: ['kits', 'flickers', 'pebble', 'balloon', 'gliders', 'dustbomb', 'volley', 'mochi'],
    ai: { think: 0.45, push: 7, support: true, snipe: true, defend: 1.1, sloppy: 0.3 } },
];
/** A fair middle-strength computer player for tests and demos. */
export const STEADY: AiLevel = { think: 0.7, push: 8, support: true, snipe: true, defend: 0.9, sloppy: 0.5 };

export type Role = 'troop' | 'building' | 'princess' | 'king';
export type Unit = {
  id: number; side: Side; card: CardId | null; role: Role; variant: number;
  x: number; y: number; r: number; hp: number; maxHp: number; air: boolean; speed: number;
  range: number; sight: number; dmg: number; rate: number; splash: number; selfSplash: boolean; targets: Targets;
  projectile: number; jumps: boolean; lifetime: number; deathDmg: number;
  cool: number; deploy: number; target: number | null; retarget: number; active: boolean;
  face: 1 | -1; moving: boolean; walk: number; hit: number; attack: number;
};
export type Shot = { id: number; side: Side; kind: 'pellet' | 'puff' | 'hay' | 'tower'; x: number; y: number; target: number | null; tx: number; ty: number; speed: number; dmg: number; splash: number; targets: Targets };
export type Blast = { side: Side; kind: 'dustbomb' | 'volley' | 'bale'; x: number; y: number; fromX: number; fromY: number; radius: number; dmg: number; knock: number; air: boolean; delay: number; total: number };
export type Effect = { kind: 'poof' | 'boom' | 'spark' | 'crown' | 'deploy' | 'spin'; x: number; y: number; r: number; t: number; max: number; side: Side };
export type GameEvent = { type: 'play' | 'crown' | 'tower' | 'over' | 'double' | 'overtime'; side: Side; card?: CardId };
export type PlayResult = 'ok' | 'dust' | 'zone' | 'slot' | 'state';
export type State = 'playing' | 'paused' | 'over';

/** mulberry32: small, fast and the same everywhere. */
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

/** A side's own view of the arena: y measured so that its own towers are at the bottom. */
export const local = (side: Side, y: number) => (side === 0 ? y : H - y);
const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export const inRiver = (y: number) => y > RIVER_TOP && y < RIVER_BOTTOM;
export const onBridge = (x: number) => BRIDGES.some((b) => Math.abs(x - b) <= BRIDGE_HALF);

export function validDeck(deck: unknown): deck is CardId[] {
  return Array.isArray(deck) && deck.length === DECK_SIZE && new Set(deck).size === DECK_SIZE && deck.every((id) => CARD_IDS.includes(id));
}
export const averageCost = (deck: CardId[]) => deck.reduce((s, id) => s + CARDS[id].cost, 0) / deck.length;

export type Options = { rival?: number; deck?: CardId[]; seed?: number; ai?: [AiLevel | null, AiLevel | null] };

export class ClashGame {
  state: State = 'playing';
  time = 0;
  rival: Rival;
  round: number;
  seed: number;
  random: () => number;
  dust: [number, number] = [START_DUST, START_DUST];
  crowns: [number, number] = [0, 0];
  decks: [CardId[], CardId[]];
  hands: [CardId[], CardId[]] = [[], []];
  queues: [CardId[], CardId[]] = [[], []];
  units: Unit[] = [];
  shots: Shot[] = [];
  blasts: Blast[] = [];
  effects: Effect[] = [];
  events: GameEvent[] = [];
  ai: [AiLevel | null, AiLevel | null];
  aiClock: [number, number] = [0.6, 0.6];
  /** Cards played and dust spent by each side, for the result screen. */
  played: [number, number] = [0, 0];
  spent: [number, number] = [0, 0];
  winner: Side | null = null;
  /** How the match was decided: a king tower, crowns at full time, a crown in overtime, or tower health. */
  reason: 'king' | 'crowns' | 'overtime' | 'tiebreak' | 'draw' | null = null;
  /** Level at full time, so the match went to overtime. */
  suddenDeath = false;
  message = '';
  messageTime = 0;
  private nextId = 1;

  constructor(o: Options = {}) {
    this.round = clamp(o.rival ?? 0, 0, RIVALS.length - 1);
    this.rival = RIVALS[this.round];
    this.seed = o.seed ?? 1;
    this.random = rng(this.seed);
    this.decks = [validDeck(o.deck) ? [...o.deck] : [...DEFAULT_DECK], [...this.rival.deck]];
    this.ai = o.ai ?? [null, this.rival.ai];
    for (const side of [0, 1] as Side[]) {
      const deck = [...this.decks[side]];
      for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(this.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
      this.hands[side] = deck.slice(0, HAND_SIZE);
      this.queues[side] = deck.slice(HAND_SIZE);
      for (const role of ['left', 'right', 'king'] as const) {
        const spot = TOWER_SPOTS[role], t = role === 'king' ? TOWER.king : TOWER.princess;
        const u = this.makeUnit(side, null, role === 'king' ? 'king' : 'princess', spot.x, local(side, spot.y), {
          hp: t.hp, dmg: t.dmg, rate: t.rate, range: t.range, speed: 0, r: t.r, targets: 'all', projectile: 12,
        });
        u.deploy = 0; u.active = role !== 'king'; u.variant = role === 'left' ? 0 : role === 'right' ? 1 : 2;
      }
    }
  }

  get double() { return this.time >= DOUBLE_AT; }
  get overtime() { return this.time >= REGULATION; }
  get clock() { return this.overtime ? REGULATION + OVERTIME - this.time : REGULATION - this.time; }
  next(side: Side) { return this.queues[side][0]; }
  towers(side: Side) { return this.units.filter((u) => u.side === side && (u.role === 'princess' || u.role === 'king')); }
  tower(side: Side, which: 'left' | 'right' | 'king') { return this.units.find((u) => u.side === side && u.role === (which === 'king' ? 'king' : 'princess') && u.variant === (which === 'left' ? 0 : which === 'right' ? 1 : 2)) ?? null; }
  unit(id: number | null) { return id === null ? null : this.units.find((u) => u.id === id && u.hp > 0) ?? null; }

  pause() {
    if (this.state === 'playing') this.state = 'paused';
    else if (this.state === 'paused') this.state = 'playing';
  }

  /** Where `side` may put a troop or building: its own half, plus the enemy's half of a lane whose tower has fallen. */
  canPlace(side: Side, card: CardId, x: number, y: number) {
    if (x < 0.5 || x > W - 0.5 || y < 0.5 || y > H - 0.5) return false;
    if (CARDS[card].kind === 'spell') return true;
    const ly = local(side, y);
    if (ly >= RIVER_BOTTOM + 0.5) return true;
    const foe = (1 - side) as Side;
    if (x < W / 2 && !this.tower(foe, 'left') && ly >= 10) return !inRiver(y) || onBridge(x);
    if (x >= W / 2 && !this.tower(foe, 'right') && ly >= 10) return !inRiver(y) || onBridge(x);
    return false;
  }

  /** Plays the card in hand slot `slot` for `side` at (x, y). */
  play(side: Side, slot: number, x: number, y: number): PlayResult {
    if (this.state !== 'playing') return 'state';
    const id = this.hands[side][slot];
    if (!id) return 'slot';
    const card = CARDS[id];
    if (this.dust[side] < card.cost) return 'dust';
    if (!this.canPlace(side, id, x, y)) return 'zone';
    this.dust[side] -= card.cost;
    this.spent[side] += card.cost;
    this.played[side]++;
    this.hands[side][slot] = this.queues[side].shift()!;
    this.queues[side].push(id);
    this.events.push({ type: 'play', side, card: id });
    if (card.spell) {
      const king = this.tower(side, 'king') ?? { x: W / 2, y: local(side, 30) };
      const fromX = king.x, fromY = king.y, far = dist(fromX, fromY, x, y);
      const delay = 0.3 + far / card.spell.speed;
      this.blasts.push({ side, kind: id as 'dustbomb' | 'volley', x, y, fromX, fromY, radius: card.spell.radius, dmg: card.spell.dmg, knock: card.spell.knock, air: card.spell.air, delay, total: delay });
      return 'ok';
    }
    const offsets = FORMATIONS[card.count ?? 1];
    offsets.forEach(([dx, dy], i) => {
      const u = this.makeUnit(side, id, card.kind === 'building' ? 'building' : 'troop', clamp(x + dx, 0.5, W - 0.5), clamp(y + dy, 0.5, H - 0.5), card.stats!);
      u.variant = i;
      u.face = x < W / 2 ? 1 : -1;
    });
    this.effects.push({ kind: 'deploy', x, y, r: card.count && card.count > 1 ? 1.2 : 0.9, t: 0, max: DEPLOY_TIME, side });
    return 'ok';
  }

  step(dt: number) {
    if (this.state !== 'playing') return;
    const wasDouble = this.double, wasOvertime = this.overtime;
    this.time += dt;
    if (!wasDouble && this.double) this.say('Double dust! Dust fills twice as fast.', 'double');
    if (!wasOvertime && this.overtime && this.crowns[0] === this.crowns[1]) { this.suddenDeath = true; this.say('Overtime! The next crown wins.', 'overtime'); }
    this.messageTime = Math.max(0, this.messageTime - dt);
    const regen = this.double ? REGEN / 2 : REGEN;
    for (const side of [0, 1] as Side[]) this.dust[side] = Math.min(MAX_DUST, this.dust[side] + dt / regen);

    for (const side of [0, 1] as Side[]) {
      const level = this.ai[side];
      if (!level) continue;
      this.aiClock[side] -= dt;
      if (this.aiClock[side] <= 0) { this.aiClock[side] = level.think * (0.8 + this.random() * 0.4); think(this, side, level); }
    }

    for (const u of this.units) this.act(u, dt);
    this.separate();
    this.fly(dt);
    this.land(dt);
    for (const e of this.effects) e.t += dt;
    this.effects = this.effects.filter((e) => e.t < e.max);
    this.bury();
    this.decide();
  }

  // ---------- Units ----------

  private makeUnit(side: Side, card: CardId | null, role: Role, x: number, y: number, s: Stats) {
    const u: Unit = {
      id: this.nextId++, side, card, role, variant: 0, x, y, r: s.r, hp: s.hp, maxHp: s.hp, air: !!s.air, speed: s.speed,
      range: s.range, sight: Math.max(5.5, s.range + 1), dmg: s.dmg, rate: s.rate, splash: s.splash ?? 0, selfSplash: !!s.selfSplash, targets: s.targets,
      projectile: s.projectile ?? 0, jumps: !!s.jumps, lifetime: s.lifetime ?? 0, deathDmg: s.deathDmg ?? 0,
      cool: s.rate * 0.4, deploy: DEPLOY_TIME, target: null, retarget: 0, active: true,
      face: side === 0 ? 1 : -1, moving: false, walk: 0, hit: 0, attack: 0,
    };
    this.units.push(u);
    return u;
  }

  /** Whether `u` is allowed to attack `v`. */
  canHit(u: { side: Side; targets: Targets }, v: Unit) {
    if (v.side === u.side || v.hp <= 0) return false;
    if (u.targets === 'buildings') return v.role !== 'troop';
    if (u.targets === 'ground') return !v.air;
    return true;
  }

  private reach(u: Unit, v: Unit) { return dist(u.x, u.y, v.x, v.y) - v.r - (u.projectile ? 0 : u.r); }

  /** The nearest thing `u` can hit that it can see; failing that (for troops), the nearest enemy building. */
  private pick(u: Unit): Unit | null {
    let best: Unit | null = null, bestD = Infinity;
    const isTower = u.role === 'princess' || u.role === 'king';
    for (const v of this.units) {
      if (!this.canHit(u, v)) continue;
      if ((isTower || u.role === 'building') && v.role !== 'troop') continue;
      const d = this.reach(u, v);
      if (d > (isTower || u.role === 'building' ? u.range : u.sight)) continue;
      if (d < bestD) { best = v; bestD = d; }
    }
    if (best || u.role !== 'troop') return best;
    for (const v of this.units) {
      if (v.side === u.side || v.role === 'troop' || v.hp <= 0) continue;
      const d = dist(u.x, u.y, v.x, v.y) + (v.x < W / 2 === u.x < W / 2 ? 0 : 0.01);
      if (d < bestD) { best = v; bestD = d; }
    }
    return best;
  }

  private act(u: Unit, dt: number) {
    u.hit = Math.max(0, u.hit - dt);
    u.attack = Math.max(0, u.attack - dt);
    u.moving = false;
    if (u.deploy > 0) { u.deploy -= dt; return; }
    if (u.lifetime) u.hp -= (u.maxHp / u.lifetime) * dt;
    if (!u.active) return;
    u.cool -= dt;
    let target = this.unit(u.target);
    if (target && !this.canHit(u, target)) target = null;
    const locked = target && this.reach(u, target) <= u.range;
    u.retarget -= dt;
    if (!locked && (u.retarget <= 0 || !target)) { target = this.pick(u); u.retarget = 0.25; }
    if ((u.role === 'princess' || u.role === 'king' || u.role === 'building') && target && this.reach(u, target) > u.range) target = null;
    u.target = target?.id ?? null;
    if (!target) { u.cool = Math.max(u.cool, 0); return; }
    if (Math.abs(target.x - u.x) > 0.05) u.face = target.x > u.x ? 1 : -1;
    if (this.reach(u, target) <= u.range) {
      if (u.cool <= 0) { u.cool = u.rate; u.attack = 0.3; this.strike(u, target); }
      return;
    }
    if (u.speed <= 0) return;
    this.move(u, target, dt);
  }

  private move(u: Unit, target: Unit, dt: number) {
    let gx = target.x, gy = target.y;
    if (!u.air && !u.jumps) {
      const below = u.y >= (RIVER_TOP + RIVER_BOTTOM) / 2, targetBelow = gy >= (RIVER_TOP + RIVER_BOTTOM) / 2;
      if (below !== targetBelow && !(inRiver(u.y) && inRiver(gy))) {
        const bx = BRIDGES.reduce((a, b) => (Math.abs(u.x - b) + Math.abs(gx - b) < Math.abs(u.x - a) + Math.abs(gx - a) ? b : a));
        const exit = targetBelow ? RIVER_BOTTOM + 0.4 : RIVER_TOP - 0.4;
        if (inRiver(u.y) || Math.abs(u.x - bx) < 0.35) { gx = bx; gy = exit; }
        else { gx = bx; gy = below ? RIVER_BOTTOM + 0.4 : RIVER_TOP - 0.4; }
      }
    }
    const dx = gx - u.x, dy = gy - u.y, d = Math.hypot(dx, dy);
    if (d < 1e-6) return;
    const stepLen = Math.min(d, u.speed * dt), prevY = u.y;
    u.x += (dx / d) * stepLen; u.y += (dy / d) * stepLen;
    u.walk += stepLen;
    u.moving = true;
    if (Math.abs(dx) > 0.05) u.face = dx > 0 ? 1 : -1;
    this.keepDry(u, prevY);
  }

  /** Ground troops that can't jump stay out of the water: onto the bridge, or back on the bank. */
  private keepDry(u: Unit, prevY: number) {
    if (u.air || u.jumps || u.role !== 'troop' || !inRiver(u.y) || onBridge(u.x)) return;
    if (!inRiver(prevY)) { u.y = prevY; return; }
    const bx = BRIDGES.reduce((a, b) => (Math.abs(u.x - b) < Math.abs(u.x - a) ? b : a));
    u.x = clamp(u.x, bx - BRIDGE_HALF + 0.05, bx + BRIDGE_HALF - 0.05);
  }

  private strike(u: Unit, target: Unit) {
    if (u.projectile) {
      const kind = u.role === 'princess' || u.role === 'king' ? 'tower' : u.card === 'dora' ? 'puff' : u.card === 'cannon' ? 'hay' : 'pellet';
      this.shots.push({ id: this.nextId++, side: u.side, kind, x: u.x, y: u.y - (u.role === 'troop' ? 0.4 : 1), target: target.id, tx: target.x, ty: target.y, speed: u.projectile, dmg: u.dmg, splash: u.splash, targets: u.targets });
      return;
    }
    if (u.card === 'balloon') {
      this.blasts.push({ side: u.side, kind: 'bale', x: target.x, y: target.y, fromX: u.x, fromY: u.y, radius: 0.8, dmg: u.dmg, knock: 0, air: false, delay: 0.35, total: 0.35 });
      return;
    }
    if (u.selfSplash) {
      this.effects.push({ kind: 'spin', x: u.x, y: u.y, r: u.splash, t: 0, max: 0.35, side: u.side });
      for (const v of this.units) if (this.canHit(u, v) && dist(u.x, u.y, v.x, v.y) - v.r <= u.splash) this.hurt(v, u.dmg);
      return;
    }
    this.hurt(target, u.dmg);
    this.effects.push({ kind: 'spark', x: (u.x + target.x) / 2, y: (u.y + target.y) / 2, r: 0.4, t: 0, max: 0.2, side: u.side });
  }

  hurt(v: Unit, dmg: number) {
    if (v.hp <= 0) return;
    v.hp -= dmg;
    v.hit = 0.12;
    if (v.role === 'king') v.active = true;
  }

  // ---------- Shots and blasts ----------

  private fly(dt: number) {
    for (const s of this.shots) {
      const t = this.unit(s.target);
      if (t) { s.tx = t.x; s.ty = t.y; }
      const dx = s.tx - s.x, dy = s.ty - s.y, d = Math.hypot(dx, dy), stepLen = s.speed * dt;
      if (d > stepLen + 0.05) { s.x += (dx / d) * stepLen; s.y += (dy / d) * stepLen; continue; }
      s.x = s.tx; s.y = s.ty; s.speed = 0;
      if (s.splash) {
        this.effects.push({ kind: 'poof', x: s.x, y: s.y, r: s.splash, t: 0, max: 0.4, side: s.side });
        for (const v of this.units) if (this.canHit(s, v) && dist(s.x, s.y, v.x, v.y) - v.r <= s.splash) this.hurt(v, s.dmg);
      } else if (t) {
        this.hurt(t, s.dmg);
        this.effects.push({ kind: 'spark', x: s.x, y: s.y, r: 0.35, t: 0, max: 0.2, side: s.side });
      }
    }
    this.shots = this.shots.filter((s) => s.speed > 0);
  }

  private land(dt: number) {
    for (const b of this.blasts) {
      b.delay -= dt;
      if (b.delay > 0) continue;
      this.effects.push({ kind: 'boom', x: b.x, y: b.y, r: b.radius, t: 0, max: b.kind === 'volley' ? 0.5 : 0.6, side: b.side });
      for (const v of this.units) {
        if (v.side === b.side || v.hp <= 0 || (v.air && !b.air)) continue;
        if (dist(b.x, b.y, v.x, v.y) - v.r > b.radius) continue;
        const tower = v.role === 'princess' || v.role === 'king';
        this.hurt(v, b.kind === 'bale' || !tower ? b.dmg : Math.round(b.dmg * TOWER_SPELL));
        if (b.knock && v.role === 'troop' && !v.air) {
          const dx = v.x - b.x, dy = v.y - b.y, d = Math.hypot(dx, dy) || 1, prevY = v.y;
          v.x = clamp(v.x + (dx / d) * b.knock, 0.4, W - 0.4); v.y = clamp(v.y + (dy / d) * b.knock, 0.4, H - 0.4);
          this.keepDry(v, prevY);
        }
      }
    }
    this.blasts = this.blasts.filter((b) => b.delay > 0);
  }

  /** Troops push each other apart, and get pushed out of towers and buildings. */
  private separate() {
    const movers = this.units.filter((u) => u.role === 'troop' && u.hp > 0);
    for (let i = 0; i < movers.length; i++) {
      const a = movers[i];
      for (let j = i + 1; j < movers.length; j++) {
        const b = movers[j];
        if (a.air !== b.air) continue;
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), gap = (a.r + b.r) * 0.9 - d;
        if (gap <= 0) continue;
        // Head-on meetings slide sideways a little, so troops step around each other instead of shoving in a line.
        const side = Math.abs(dx) < 0.15 ? (a.id % 2 ? 0.35 : -0.35) : 0;
        const sx = (d > 1e-6 ? dx / d : 0) + side, sy = d > 1e-6 ? dy / d : 0, sl = Math.hypot(sx, sy) || 1;
        const nx = sx / sl, ny = sy / sl;
        const wa = b.r * b.r / (a.r * a.r + b.r * b.r), wb = 1 - wa;
        const ay = a.y, by = b.y;
        a.x -= nx * gap * wa; a.y -= ny * gap * wa; b.x += nx * gap * wb; b.y += ny * gap * wb;
        this.keepDry(a, ay); this.keepDry(b, by);
      }
      if (a.air) continue;
      for (const s of this.units) {
        if (s.role === 'troop' || s.hp <= 0) continue;
        const dx = a.x - s.x, dy = a.y - s.y, d = Math.hypot(dx, dy), gap = s.r + a.r * 0.8 - d;
        if (gap <= 0) continue;
        const ay = a.y;
        a.x += (d > 1e-6 ? dx / d : 1) * gap; a.y += (d > 1e-6 ? dy / d : 0) * gap;
        this.keepDry(a, ay);
      }
    }
    for (const u of movers) { u.x = clamp(u.x, 0.4, W - 0.4); u.y = clamp(u.y, 0.4, H - 0.4); }
  }

  // ---------- Deaths, crowns and the result ----------

  private bury() {
    const dead = this.units.filter((u) => u.hp <= 0);
    if (!dead.length) return;
    this.units = this.units.filter((u) => u.hp > 0);
    for (const u of dead) {
      this.effects.push({ kind: 'poof', x: u.x, y: u.y, r: u.r + 0.4, t: 0, max: 0.5, side: u.side });
      if (u.deathDmg) this.blasts.push({ side: u.side, kind: 'bale', x: u.x, y: u.y, fromX: u.x, fromY: u.y, radius: 2, dmg: u.deathDmg, knock: 0, air: false, delay: 0.4, total: 0.4 });
      if (u.role === 'princess' || u.role === 'king') {
        const foe = (1 - u.side) as Side;
        this.crowns[foe] = u.role === 'king' ? 3 : Math.min(3, this.crowns[foe] + 1);
        const king = this.tower(u.side, 'king');
        if (king) king.active = true;
        this.effects.push({ kind: 'crown', x: u.x, y: u.y, r: 2.5, t: 0, max: 1.2, side: foe });
        this.events.push({ type: 'crown', side: foe });
        this.say(foe === 0 ? 'Crown! A tower falls.' : 'Ouch! You lost a tower.', 'tower');
        if (u.role === 'king') { this.finish(foe, 'king'); return; }
      }
    }
  }

  private decide() {
    if (this.state === 'over' || this.time < REGULATION) return;
    if (this.crowns[0] !== this.crowns[1]) { this.finish(this.crowns[0] > this.crowns[1] ? 0 : 1, this.suddenDeath ? 'overtime' : 'crowns'); return; }
    if (this.time < REGULATION + OVERTIME) return;
    // Level after overtime: the side whose weakest tower is weaker loses it, as in Clash Royale.
    const weakest = (side: Side) => Math.min(...this.towers(side).map((t) => t.hp));
    const a = weakest(0), b = weakest(1);
    if (Math.abs(a - b) < 1) this.finish(null, 'draw');
    else this.finish(a > b ? 0 : 1, 'tiebreak');
  }

  private finish(winner: Side | null, reason: NonNullable<ClashGame['reason']>) {
    if (this.state === 'over') return;
    this.state = 'over';
    this.winner = winner;
    this.reason = reason;
    if (winner !== null && reason === 'tiebreak') this.crowns[winner] = Math.min(3, this.crowns[winner] + 1);
    this.events.push({ type: 'over', side: winner ?? 0 });
  }

  private say(text: string, type: 'double' | 'overtime' | 'tower') {
    this.message = text;
    this.messageTime = 2.5;
    if (type !== 'tower') this.events.push({ type, side: 0 });
  }
}

const FORMATIONS: Record<number, [number, number][]> = {
  1: [[0, 0]],
  2: [[-0.5, 0], [0.5, 0]],
  3: [[0, -0.45], [-0.5, 0.4], [0.5, 0.4]],
  4: [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]],
};

// ---------- The computer player ----------

const WIN_CONDITIONS: CardId[] = ['pebble', 'dasher', 'balloon'];
const TANKY: CardId[] = ['pebble', 'mochi', 'enzo', 'balloon', 'dasher'];
const SUPPORT: CardId[] = ['dora', 'flickers', 'kits', 'gliders'];

/** One decision for `side`: defend a push on its half if one is coming, otherwise build and send an attack. */
export function think(g: ClashGame, side: Side, level: AiLevel) {
  const foe = (1 - side) as Side, dust = g.dust[side], hand = g.hands[side];
  const noise = () => (g.random() - 0.5) * 2 * level.sloppy;
  // Plays in this side's own view (its towers at the bottom), nudged into a legal spot.
  const put = (slot: number, x: number, ly: number) => {
    const id = hand[slot], spell = CARDS[id].kind === 'spell';
    const px = clamp(x + (spell ? noise() * 0.4 : noise()), 1, W - 1);
    let py = clamp(ly + (spell ? noise() * 0.4 : noise()), 1, H - 1);
    if (!spell) { py = Math.max(py, RIVER_BOTTOM + 0.6); if (py > 30.5) py = 30.5; }
    return g.play(side, slot, px, local(side, py)) === 'ok';
  };
  const affordable = hand.map((id, slot) => ({ id, slot, card: CARDS[id] })).filter((c) => c.card.cost <= dust);

  // Spell a tower that one blast would finish.
  if (level.snipe) {
    for (const t of g.towers(foe)) {
      for (const c of affordable) {
        if (!c.card.spell || t.hp > c.card.spell.dmg * TOWER_SPELL) continue;
        if (put(c.slot, t.x, local(side, t.y))) return;
      }
    }
  }

  // Defence: enemy troops on or near this side's half, nearest the towers first.
  const threats = g.units.filter((u) => u.side === foe && u.role === 'troop' && local(side, u.y) > RIVER_TOP - 2).sort((a, b) => local(side, b.y) - local(side, a.y));
  if (threats.length) {
    const lead = threats[0], cx = lead.x, cly = local(side, lead.y);
    const group = threats.filter((u) => dist(u.x, u.y, lead.x, lead.y) < 3.5);
    const threatHp = group.reduce((s, u) => s + u.hp, 0), air = group.some((u) => u.air), swarm = group.length >= 3;
    const guard = g.units.filter((u) => u.side === side && u.role !== 'princess' && u.role !== 'king' && dist(u.x, u.y, lead.x, lead.y) < 6).reduce((s, u) => s + u.hp, 0);
    if (guard < threatHp * level.defend) {
      let best: { slot: number; score: number; id: CardId } | null = null;
      for (const c of affordable) {
        let score = 0;
        if (c.card.spell) {
          const hit = group.filter((u) => dist(u.x, u.y, lead.x, lead.y) <= c.card.spell!.radius + 0.5);
          const value = hit.reduce((s, u) => s + Math.min(u.hp, c.card.spell!.dmg), 0);
          score = value >= c.card.cost * 140 && hit.length >= 2 ? value / c.card.cost / 60 : 0;
        } else {
          const st = c.card.stats!;
          if (air && st.targets !== 'all') continue;
          if (st.targets === 'buildings') continue;
          score = 1 + (st.hp * (c.card.count ?? 1)) / 1500 + (st.dmg * (c.card.count ?? 1)) / st.rate / 200;
          if (swarm && (st.splash || c.id === 'volley')) score += 2;
          if (!swarm && threatHp > 1000 && (c.id === 'kits' || c.id === 'cannon' || c.id === 'mochi')) score += 1.5;
          if (c.id === 'cannon' && group.every((u) => u.targets === 'buildings' && !u.air)) score += 2;
          score /= Math.sqrt(c.card.cost);
        }
        if (score > 0 && (!best || score > best.score)) best = { slot: c.slot, score, id: c.id };
      }
      if (best) {
        const card = CARDS[best.id];
        if (card.spell) { if (put(best.slot, lead.x, cly)) return; }
        else if (card.kind === 'building') { if (put(best.slot, W / 2, 22)) return; }
        else {
          const ranged = (card.stats!.range ?? 0) > 2;
          const ly = clamp(cly + (ranged ? 4.5 : 2), RIVER_BOTTOM + 0.6, 30);
          if (put(best.slot, cx, ly)) return;
        }
      }
    }
  }

  // Support a friendly tank that is crossing the river.
  if (level.support) {
    const tank = g.units.find((u) => u.side === side && u.role === 'troop' && u.card && TANKY.includes(u.card) && local(side, u.y) > 13 && local(side, u.y) < 24);
    if (tank) {
      const c = affordable.find((c) => SUPPORT.includes(c.id));
      if (c && dust >= c.card.cost + 1 && put(c.slot, tank.x, Math.max(local(side, tank.y) + 2.5, RIVER_BOTTOM + 0.6))) return;
    }
  }

  // Attack once enough dust is saved, down the lane whose tower is weakest (or already down).
  if (dust >= level.push || dust >= MAX_DUST - 0.2) {
    const left = g.tower(foe, 'left'), right = g.tower(foe, 'right');
    const lane = (left?.hp ?? 0) <= (right?.hp ?? 0) ? BRIDGES[0] : BRIDGES[1];
    const win = affordable.find((c) => WIN_CONDITIONS.includes(c.id)) ?? affordable.find((c) => TANKY.includes(c.id));
    if (win) { if (put(win.slot, lane, win.id === 'pebble' || win.id === 'balloon' ? 28 : 18.5)) return; }
    const troop = affordable.filter((c) => c.card.kind === 'troop').sort((a, b) => b.card.cost - a.card.cost)[0];
    if (troop && put(troop.slot, lane, 18.5)) return;
    if (dust >= MAX_DUST - 0.2) {
      const any = affordable.find((c) => c.card.kind !== 'spell');
      if (any) put(any.slot, lane, 24);
    }
  }
}
