// Burrow Tactics: turn-based tactics in the style of Into the Breach. Predators raid a meadow of burrows and show
// exactly what they will hit next turn. Three chinchillas each move and act once a turn, and almost every action
// pushes something: into water, into brambles, into each other, or out of the way. Hold out for the set number of
// turns and the raid is over. Deterministic: a Battle is plain data that can be cloned, which is how previews,
// forecasts, the reset button, saving and the test bot all work. Seeded, no Math.random, no DOM.

export const SIZE = 8, CLOUD_TURNS = 2, FIRE_TURNS = 3, RUN_WARREN = 5, RUN_STAGES = 7, CAMPAIGN_WARREN = 3;
/** North, east, south, west. */
export const DIRS: readonly (readonly [number, number])[] = [[0, -1], [1, 0], [0, 1], [-1, 0]];
export type Tile = [number, number];
const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < SIZE && y < SIZE;
const at = (x: number, y: number) => y * SIZE + x;

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

// ---------- Chinchillas ----------

/** The six chinchillas, plus the kit that escort missions are about. */
export type HeroId = 'dora' | 'enzo' | 'pip' | 'pebble' | 'mochi' | 'biscuit' | 'kit';
export type AbilityId = 'seed' | 'whack' | 'puff' | 'toss' | 'tug' | 'pounce' | 'pierce' | 'slam' | 'swap' | 'brace' | 'lull' | 'kick' | 'groom';
export type Aim = 'line' | 'melee' | 'lob' | 'self';
export type AbilityDef = { id: AbilityId; name: string; aim: Aim; min: number; max: number; dmg: number; blurb: string };
export const ABILITIES: Record<AbilityId, AbilityDef> = {
  seed: { id: 'seed', name: 'Seed Shot', aim: 'line', min: 1, max: SIZE, dmg: 1, blurb: 'Fires down a straight line. The first thing in the way takes 1 and is pushed back a tile.' },
  whack: { id: 'whack', name: 'Tail Whack', aim: 'melee', min: 1, max: 1, dmg: 2, blurb: 'Hits the tile next to him for 2 and pushes it away.' },
  puff: { id: 'puff', name: 'Dust Puff', aim: 'lob', min: 2, max: 4, dmg: 0, blurb: 'Lobs a dust cloud 2 to 4 tiles. Nobody inside a cloud can attack, and everything next to it is pushed outward.' },
  toss: { id: 'toss', name: 'Hay Toss', aim: 'lob', min: 2, max: 3, dmg: 1, blurb: 'Lobs a hay bale 2 to 3 tiles. It lands as a wall on an empty tile, or hits whoever is there for 1.' },
  tug: { id: 'tug', name: 'Tug', aim: 'line', min: 1, max: SIZE, dmg: 0, blurb: 'Pulls the first creature in a straight line right up to her.' },
  pounce: { id: 'pounce', name: 'Pounce', aim: 'lob', min: 2, max: 4, dmg: 1, blurb: 'Leaps 2 to 4 tiles to an empty tile. Everyone next to the landing takes 1 and is pushed outward.' },
  pierce: { id: 'pierce', name: 'Piercing Seed', aim: 'line', min: 1, max: SIZE, dmg: 1, blurb: 'A seed that goes straight through: every creature in the line takes 1, up to the first rock, bale or burrow. No push.' },
  slam: { id: 'slam', name: 'Ground Slam', aim: 'self', min: 0, max: 0, dmg: 1, blurb: 'All four tiles around him take 1 and are pushed away.' },
  swap: { id: 'swap', name: 'Switcheroo', aim: 'line', min: 1, max: SIZE, dmg: 0, blurb: 'Swaps places with the first creature in a straight line, friend or predator.' },
  brace: { id: 'brace', name: 'Brace', aim: 'melee', min: 1, max: 1, dmg: 0, blurb: 'Shores up a burrow next to him: it survives the next hit it takes.' },
  lull: { id: 'lull', name: 'Lullaby', aim: 'lob', min: 1, max: 2, dmg: 0, blurb: 'A predator 1 or 2 tiles away in a line dozes off and forgets its attack. Bosses shrug it off.' },
  kick: { id: 'kick', name: 'Drop Kick', aim: 'melee', min: 1, max: 1, dmg: 0, blurb: 'Sends the creature next to her sliding up to 3 tiles. It is bumped if something stops it.' },
  groom: { id: 'groom', name: 'Groom', aim: 'self', min: 0, max: 0, dmg: 0, blurb: 'A quick dust bath: heal 1.' },
};
export type Perk = 'hp' | 'move' | 'power';
export type ClassId = 'scout' | 'bruiser' | 'warden';
/** A class gives one perk that is always on, and sets how far each upgrade can go in a run. */
export const CLASSES: Record<ClassId, { id: ClassId; name: string; perk: string; blurb: string; caps: Record<Perk, number> }> = {
  scout: { id: 'scout', name: 'Scout', perk: 'Hit and run', blurb: 'May still move after acting, if it has not moved yet this turn.', caps: { hp: 1, move: 3, power: 1 } },
  bruiser: { id: 'bruiser', name: 'Bruiser', perk: 'Heavy paws', blurb: 'Anything they knock into something takes 1 more.', caps: { hp: 2, move: 1, power: 2 } },
  warden: { id: 'warden', name: 'Warden', perk: 'Stand guard', blurb: 'A predator’s attack on a burrow next to a Warden hits the Warden instead.', caps: { hp: 3, move: 2, power: 1 } },
};
export const CLASS_IDS = Object.keys(CLASSES) as ClassId[];
export type HeroDef = { id: HeroId; name: string; hp: number; move: number; ability: AbilityId; second: AbilityId | null; cls: ClassId | null; blurb: string };
export const HEROES: Record<HeroId, HeroDef> = {
  dora: { id: 'dora', name: 'Dora', hp: 3, move: 4, ability: 'seed', second: 'pierce', cls: 'scout', blurb: 'A crack shot with a sunflower seed. Knocks things back from across the meadow.' },
  enzo: { id: 'enzo', name: 'Enzo', hp: 4, move: 3, ability: 'whack', second: 'slam', cls: 'bruiser', blurb: 'Hits hard up close and sends predators flying.' },
  pip: { id: 'pip', name: 'Pip', hp: 2, move: 5, ability: 'puff', second: 'swap', cls: 'scout', blurb: 'A quick kit who kicks up dust clouds. A predator in a cloud cannot attack.' },
  pebble: { id: 'pebble', name: 'Grandpa Pebble', hp: 5, move: 3, ability: 'toss', second: 'brace', cls: 'warden', blurb: 'Slow and sturdy. Throws hay bales to wall off a burrow or bonk a fox.' },
  mochi: { id: 'mochi', name: 'Mochi', hp: 3, move: 4, ability: 'tug', second: 'lull', cls: 'warden', blurb: 'Tugs predators out of position: into the stream, into brambles, or into each other’s way.' },
  biscuit: { id: 'biscuit', name: 'Biscuit', hp: 3, move: 4, ability: 'pounce', second: 'kick', cls: 'bruiser', blurb: 'Leaps into the middle of a pack and scatters it.' },
  kit: { id: 'kit', name: 'The kit', hp: 2, move: 3, ability: 'groom', second: null, cls: null, blurb: 'Too small to fight. Get it home.' },
};
/** The chinchillas a squad is picked from. */
export const HERO_IDS: HeroId[] = ['dora', 'enzo', 'pip', 'pebble', 'mochi', 'biscuit'];
/** A chinchilla as it stands between battles: upgrades earned, maximum health lost, and whether it knows its second action. */
export type Member = { id: HeroId; hp: number; move: number; power: number; scars: number; skill: boolean };
export const member = (id: HeroId, skill = false): Member => ({ id, hp: 0, move: 0, power: 0, scars: 0, skill });

// ---------- Predators ----------

export type PredId = 'fox' | 'snake' | 'owl' | 'weasel' | 'mole' | 'skunk' | 'badger' | 'hawk' | 'cougar' | 'bear';
/** `tunnel`: moves under everything. `heavy`: cannot drown. `boss`: marked in a boss battle, and cannot be lulled. */
export type PredDef = { id: PredId; name: string; hp: number; move: number; fly: boolean; dmg: number; cost: number; attack: string; blurb: string; tunnel?: boolean; heavy?: boolean; boss?: boolean };
export const PREDATORS: Record<PredId, PredDef> = {
  fox: { id: 'fox', name: 'Fox', hp: 3, move: 3, fly: false, dmg: 1, cost: 2, attack: 'Bite', blurb: 'Bites the tile in front for 1.' },
  snake: { id: 'snake', name: 'Snake', hp: 2, move: 2, fly: false, dmg: 1, cost: 2, attack: 'Spit', blurb: 'Spits down a straight line. The first thing in the way takes 1.' },
  owl: { id: 'owl', name: 'Owl', hp: 2, move: 4, fly: true, dmg: 2, cost: 3, attack: 'Swoop', blurb: 'Flies in a straight line until something is in the way, hits it for 2 and knocks it back. Flies over water and brambles.' },
  weasel: { id: 'weasel', name: 'Weasel', hp: 2, move: 4, fly: false, dmg: 1, cost: 3, attack: 'Lunge', blurb: 'Lunges through the two tiles in front for 1 each.' },
  mole: { id: 'mole', name: 'Mole', hp: 2, move: 4, fly: false, dmg: 1, cost: 3, tunnel: true, attack: 'Nip', blurb: 'Tunnels under rocks, bales, water and creatures to come up wherever it likes, then nips the tile in front for 1.' },
  skunk: { id: 'skunk', name: 'Skunk', hp: 3, move: 3, fly: false, dmg: 1, cost: 3, attack: 'Spray', blurb: 'Sprays the tile in front for 1 and leaves a stink cloud on it. Nobody inside a cloud can attack.' },
  badger: { id: 'badger', name: 'Badger', hp: 5, move: 2, fly: false, dmg: 2, cost: 5, attack: 'Sweep', blurb: 'Sweeps the tile in front and the two beside it for 2 each.' },
  hawk: { id: 'hawk', name: 'Hawk', hp: 3, move: 4, fly: true, dmg: 2, cost: 4, attack: 'Dive', blurb: 'Dives on one tile 2 to 4 away for 2. Flies over water and brambles.' },
  cougar: { id: 'cougar', name: 'Mountain Cougar', hp: 9, move: 3, fly: false, dmg: 2, cost: 12, heavy: true, boss: true, attack: 'Rake', blurb: 'Rakes all four tiles around it for 2 and throws them back. Too heavy to drown.' },
  bear: { id: 'bear', name: 'Great Bear', hp: 12, move: 2, fly: false, dmg: 3, cost: 14, heavy: true, boss: true, attack: 'Charge', blurb: 'Charges in a straight line until something is in the way, hits it for 3 and knocks it back. Too heavy to drown.' },
};
export const PRED_IDS = Object.keys(PREDATORS) as PredId[];

export type RelicId = 'fur' | 'doors' | 'paws' | 'burrs' | 'quick' | 'roots';
export const RELICS: Record<RelicId, { id: RelicId; name: string; blurb: string }> = {
  fur: { id: 'fur', name: 'Thick Fur', blurb: 'Each chinchilla ignores the first damage it takes in a battle.' },
  doors: { id: 'doors', name: 'Reinforced Doors', blurb: 'Each burrow survives the first hit it takes in a battle.' },
  paws: { id: 'paws', name: 'Spring Paws', blurb: 'Predators take 1 more damage when they are bumped into something.' },
  burrs: { id: 'burrs', name: 'Burr Seeds', blurb: 'Predators take 1 more damage from brambles.' },
  quick: { id: 'quick', name: 'Quick Start', blurb: 'Every chinchilla moves 1 further on the first turn of a battle.' },
  roots: { id: 'roots', name: 'Deep Roots', blurb: 'Standing on rustling grass to block it no longer hurts.' },
};
export const RELIC_IDS = Object.keys(RELICS) as RelicId[];

// ---------- A battle ----------

export type Terrain = 'grass' | 'water' | 'bramble' | 'ice' | 'hill';
export type Goal = 'hold' | 'escort' | 'hunt';
export type Feature = 'rock' | 'bale' | 'burrow' | 'rubble';
export type Unit = {
  id: number; side: 'hero' | 'pred'; kind: HeroId | PredId; x: number; y: number; hp: number; maxHp: number; move: number;
  /** Extra damage: a chinchilla's upgrade, or 1 for an alpha predator. */
  power: number; fly: boolean; alpha: boolean; fur: boolean;
  /** A chinchilla that knows its second action; a predator that is the battle's quarry. */
  skill: boolean; mark: boolean;
  moved: boolean; acted: boolean; fromX: number; fromY: number; canUndo: boolean;
  /** A predator's telegraphed attack: its direction (-1 for none), the dive distance, and its place in the queue. */
  dir: number; dist: number; order: number;
};
export type Mark = { x: number; y: number; kind: PredId; alpha: boolean };
export type Spawn = { turn: number; kind: PredId; x?: number; y?: number; alpha?: boolean };
export type BattleDef = {
  name: string; region: number; turns: number; map: string[]; heroes: Tile[];
  preds: { kind: PredId; x: number; y: number; alpha?: boolean; mark?: boolean; hp?: number }[]; plan: Spawn[]; boss?: boolean; seed: number;
  /** `escort`: get the kit from `kit` to `exit`. `hunt`: knock out the marked predator in time. */
  goal?: Goal; kit?: Tile; exit?: Tile;
  /** The nursery: a burrow that must not fall. */
  key?: Tile;
  /** Lets the player choose where the squad starts. */
  deploy?: boolean;
};
export type Stats = { kills: number; drowned: number; lost: number; downs: number; friendly: number; fizzled: number; blocks: number; guards: number; slain: PredId[] };
export type State = 'deploy' | 'player' | 'won' | 'lost';
export type Result = 'ok' | 'state' | 'unit' | 'done' | 'reach' | 'target' | 'cloud' | 'soaked' | 'undo';
export type Ev =
  | { t: 'move'; id: number; path: Tile[] }
  | { t: 'act'; id: number; ability: AbilityId; x: number; y: number }
  | { t: 'attack'; id: number; kind: PredId; tiles: Tile[] }
  | { t: 'hit'; x: number; y: number; dmg: number; id: number; what: 'unit' | 'bale' | 'burrow' | 'rock' | 'none'; saved: boolean }
  | { t: 'push'; id: number; from: Tile; to: Tile; leap: boolean }
  | { t: 'bump'; id: number; x: number; y: number }
  | { t: 'ko'; id: number; how: 'ko' | 'drown' }
  | { t: 'cloud'; x: number; y: number } | { t: 'bale'; x: number; y: number } | { t: 'heal'; id: number } | { t: 'soak'; id: number }
  | { t: 'mark'; x: number; y: number } | { t: 'emerge'; unit: Unit } | { t: 'blocked'; x: number; y: number }
  | { t: 'intent'; id: number } | { t: 'fizzle'; id: number } | { t: 'phase'; who: 'pred' | 'player'; turn: number }
  | { t: 'fire'; x: number; y: number; on: boolean; burnt: boolean } | { t: 'guard'; id: number; x: number; y: number } | { t: 'brace'; x: number; y: number }
  | { t: 'lull'; id: number } | { t: 'place' }
  | { t: 'reset' } | { t: 'end'; state: State };
export type Threat = { path: Tile[]; hits: Tile[] };
export type Forecast = { warren: number; burrows: Tile[]; heroes: Record<number, number>; downs: number[]; kills: number };

export class Battle {
  name = ''; region = 0; boss = false;
  turn = 1; turns = 4; state: State = 'player';
  warren = CAMPAIGN_WARREN; maxWarren = CAMPAIGN_WARREN;
  goal: Goal = 'hold'; exit = -1; key = -1; hunt = false;
  terrain: Terrain[] = []; feature: (Feature | null)[] = []; armor: number[] = []; cloud: number[] = []; fire: number[] = [];
  units: Unit[] = []; marks: Mark[] = []; plan: Spawn[] = []; relics: RelicId[] = [];
  stats: Stats = { kills: 0, drowned: 0, lost: 0, downs: 0, friendly: 0, fizzled: 0, blocks: 0, guards: 0, slain: [] };
  rs = 1; nextId = 1; resetLeft = 1; turnStart: string | null = null;
  /** The predator whose attack is resolving, so a predator hurt by it counts as friendly fire. */
  striker = 0;
  events: Ev[] = []; quiet = false;

  static create(def: BattleDef, squad: Member[], opts: { warren?: number; maxWarren?: number; relics?: RelicId[] } = {}) {
    const b = new Battle();
    b.name = def.name; b.region = def.region; b.boss = !!def.boss; b.turns = def.turns; b.goal = def.goal ?? 'hold';
    if (def.exit) b.exit = at(def.exit[0], def.exit[1]);
    if (def.key) b.key = at(def.key[0], def.key[1]);
    b.rs = (def.seed * 2654435761) >>> 0;
    b.warren = opts.warren ?? CAMPAIGN_WARREN; b.maxWarren = opts.maxWarren ?? b.warren; b.relics = [...(opts.relics ?? [])];
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      const ch = def.map[y]?.[x] ?? '.';
      b.terrain.push(ch === '~' ? 'water' : ch === '^' ? 'bramble' : ch === '=' ? 'ice' : ch === 'n' ? 'hill' : 'grass');
      b.fire.push(ch === '*' ? FIRE_TURNS : 0);
      b.feature.push(ch === '#' ? 'rock' : ch === 'h' ? 'bale' : ch === 'B' ? 'burrow' : null);
      b.armor.push(ch === 'B' && b.relics.includes('doors') ? 1 : 0);
      b.cloud.push(0);
    }
    squad.forEach((m, i) => {
      const d = HEROES[m.id], [x, y] = def.heroes[i], hp = Math.max(1, d.hp + m.hp - m.scars);
      b.units.push({ id: b.nextId++, side: 'hero', kind: m.id, x, y, hp, maxHp: hp, move: d.move + m.move, power: m.power, fly: false, alpha: false, fur: b.relics.includes('fur'), skill: !!m.skill, mark: false, moved: false, acted: false, fromX: -1, fromY: -1, canUndo: false, dir: -1, dist: 0, order: 0 });
    });
    if (def.kit) b.units.push({ id: b.nextId++, side: 'hero', kind: 'kit', x: def.kit[0], y: def.kit[1], hp: HEROES.kit.hp, maxHp: HEROES.kit.hp, move: HEROES.kit.move, power: 0, fly: false, alpha: false, fur: false, skill: false, mark: false, moved: false, acted: false, fromX: -1, fromY: -1, canUndo: false, dir: -1, dist: 0, order: 0 });
    for (const p of def.preds) { const u = b.makePred(p.kind, p.x, p.y, !!p.alpha); u.mark = !!p.mark || (b.boss && !!PREDATORS[p.kind].boss); if (p.hp) u.hp = u.maxHp = p.hp; b.units.push(u); }
    b.hunt = b.units.some((u) => u.mark);
    b.plan = def.plan.map((s) => ({ ...s }));
    if (def.deploy) { b.state = 'deploy'; return b; }
    b.quiet = true; b.think(); b.placeMarks(); b.quiet = false;
    b.turnStart = JSON.stringify(b.data());
    return b;
  }
  // ----- Choosing where to start -----
  /** The open home-side tiles a chinchilla may start on. */
  zone(): Tile[] {
    const out: Tile[] = [];
    if (this.state !== 'deploy') return out;
    for (let y = 0; y < SIZE; y++) for (let x = 0; x <= 3; x++) {
      const i = at(x, y), u = this.unitAt(x, y);
      if (!this.solid(x, y) && this.terrain[i] !== 'water' && !this.fire[i] && i !== this.exit && (!u || (u.side === 'hero' && u.kind !== 'kit'))) out.push([x, y]);
    }
    return out;
  }
  /** Puts a chinchilla on a starting tile, swapping with whoever is already there. */
  place(id: number, x: number, y: number): Result {
    const u = this.unit(id);
    if (this.state !== 'deploy') return 'state';
    if (!u || u.side !== 'hero' || u.kind === 'kit') return 'unit';
    if (!this.zone().some((t) => t[0] === x && t[1] === y)) return 'reach';
    const other = this.unitAt(x, y, id);
    if (other) { other.x = u.x; other.y = u.y; }
    u.x = x; u.y = y;
    this.ev({ t: 'place' });
    return 'ok';
  }
  /** Ends the deployment: the predators move and pick their attacks, and turn 1 begins. */
  ready(): Result {
    if (this.state !== 'deploy') return 'state';
    this.state = 'player';
    this.think(); this.placeMarks();
    this.turnStart = JSON.stringify(this.data());
    this.ev({ t: 'phase', who: 'player', turn: this.turn });
    return 'ok';
  }
  /** Everything worth keeping, as plain data. */
  data() { return { ...this, events: [], turnStart: null, quiet: false }; }
  snapshot() { return JSON.parse(JSON.stringify({ ...this.data(), turnStart: this.turnStart })) as Record<string, unknown>; }
  static from(data: Record<string, unknown>) { const b = new Battle(); Object.assign(b, JSON.parse(JSON.stringify(data))); b.events = []; b.quiet = false; return b; }
  /** A silent copy to try things on. */
  clone() {
    const b = new Battle();
    // The plan and relics never change during a battle, so the copy shares them.
    Object.assign(b, this, { terrain: [...this.terrain], fire: [...this.fire], feature: [...this.feature], armor: [...this.armor], cloud: [...this.cloud], units: this.units.map((u) => ({ ...u })), marks: this.marks.map((m) => ({ ...m })), stats: { ...this.stats, slain: [...this.stats.slain] }, events: [], turnStart: null, quiet: true });
    return b;
  }

  private ev(e: Ev) { if (!this.quiet) this.events.push(e); }
  private rand() {
    this.rs = (this.rs + 0x6d2b79f5) >>> 0;
    let t = this.rs;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  private makePred(kind: PredId, x: number, y: number, alpha: boolean): Unit {
    const d = PREDATORS[kind], hp = d.hp + (alpha ? 2 : 0);
    return { id: this.nextId++, side: 'pred', kind, x, y, hp, maxHp: hp, move: d.move, power: alpha ? 1 : 0, fly: d.fly, alpha, fur: false, skill: false, mark: false, moved: false, acted: false, fromX: -1, fromY: -1, canUndo: false, dir: -1, dist: 0, order: 0 };
  }

  // ----- Reading the board -----
  get heroes() { return this.units.filter((u) => u.side === 'hero' && u.hp > 0); }
  get preds() { return this.units.filter((u) => u.side === 'pred' && u.hp > 0); }
  unit(id: number) { return this.units.find((u) => u.id === id); }
  unitAt(x: number, y: number, skip = 0) { return this.units.find((u) => u.hp > 0 && u.x === x && u.y === y && u.id !== skip); }
  /** A rock, bale or burrow: something that fills the tile. */
  solid(x: number, y: number) { const f = this.feature[at(x, y)]; return f === 'rock' || f === 'bale' || f === 'burrow'; }
  burrows() { const out: Tile[] = []; this.feature.forEach((f, i) => { if (f === 'burrow') out.push([i % SIZE, Math.floor(i / SIZE)]); }); return out; }
  soaked(u: Unit) { return !u.fly && this.terrain[at(u.x, u.y)] === 'water'; }
  /** Whether more predators are still to come. */
  pending() { return this.marks.length > 0 || this.plan.some((s) => s.turn > this.turn); }

  /** Every tile a unit can walk or fly to this turn, as tile index → the tile index it came from. */
  reach(u: Unit) {
    const start = at(u.x, u.y), out = new Map<number, number>([[start, -1]]);
    const steps = u.move + (u.side === 'hero' && this.turn === 1 && this.relics.includes('quick') ? 1 : 0);
    let frontier = [start];
    for (let s = 0; s < steps; s++) {
      const next: number[] = [];
      for (const i of frontier) for (const [dx, dy] of DIRS) {
        const nx = (i % SIZE) + dx, ny = Math.floor(i / SIZE) + dy, j = at(nx, ny);
        if (!inside(nx, ny) || out.has(j)) continue;
        if (!u.fly && !(u.side === 'pred' && PREDATORS[u.kind as PredId].tunnel)) { const o = this.unitAt(nx, ny); if (this.terrain[j] === 'water' || this.solid(nx, ny) || (o && o.side !== u.side)) continue; }
        out.set(j, i); next.push(j);
      }
      frontier = next;
    }
    return out;
  }
  private canStop(u: Unit, x: number, y: number) { return !this.solid(x, y) && !this.unitAt(x, y, u.id) && (u.fly || this.terrain[at(x, y)] !== 'water'); }
  /** The tiles a chinchilla can move to now. */
  moves(id: number): Tile[] {
    const u = this.unit(id);
    if (!u || u.side !== 'hero' || u.hp <= 0 || u.moved || this.state !== 'player') return [];
    return [...this.reach(u).keys()].map((i): Tile => [i % SIZE, Math.floor(i / SIZE)]).filter(([x, y]) => (x !== u.x || y !== u.y) && this.canStop(u, x, y));
  }
  private pathTo(reach: Map<number, number>, x: number, y: number) {
    const out: Tile[] = [];
    for (let i = at(x, y); i >= 0; i = reach.get(i) ?? -1) out.unshift([i % SIZE, Math.floor(i / SIZE)]);
    return out;
  }
  /** Looks along a line from (x, y): the empty tiles passed and the first unit or solid thing met. */
  ray(x: number, y: number, dir: number, skip = 0): { path: Tile[]; hit: Tile | null } {
    const [dx, dy] = DIRS[dir], path: Tile[] = [];
    for (let nx = x + dx, ny = y + dy; inside(nx, ny); nx += dx, ny += dy) {
      if (this.unitAt(nx, ny, skip) || this.solid(nx, ny)) return { path, hit: [nx, ny] };
      path.push([nx, ny]);
    }
    return { path, hit: null };
  }

  // ----- What things do -----
  private hurt(u: Unit, n: number) {
    u.canUndo = false;
    if (u.side === 'hero' && u.fur) { u.fur = false; this.ev({ t: 'hit', x: u.x, y: u.y, dmg: 0, id: u.id, what: 'unit', saved: true }); return; }
    u.hp = Math.max(0, u.hp - n);
    if (u.side === 'pred' && this.striker && this.striker !== u.id) this.stats.friendly++;
    this.ev({ t: 'hit', x: u.x, y: u.y, dmg: n, id: u.id, what: 'unit', saved: false });
    if (u.hp <= 0) this.ko(u, 'ko');
  }
  private ko(u: Unit, how: 'ko' | 'drown') {
    u.hp = 0; u.dir = -1;
    if (u.side === 'pred') { this.stats.kills++; this.stats.slain.push(u.kind as PredId); if (how === 'drown') this.stats.drowned++; } else this.stats.downs++;
    this.ev({ t: 'ko', id: u.id, how });
  }
  /** Damage to whatever is on a tile: a unit, a bale or a burrow. */
  private hit(x: number, y: number, n: number) {
    if (!inside(x, y)) return;
    const u = this.unitAt(x, y), i = at(x, y), f = this.feature[i];
    if (u) { this.hurt(u, n); return; }
    if (f === 'bale') { this.feature[i] = null; this.ev({ t: 'hit', x, y, dmg: n, id: 0, what: 'bale', saved: false }); }
    else if (f === 'burrow') {
      if (this.armor[i] > 0) { this.armor[i]--; this.ev({ t: 'hit', x, y, dmg: 0, id: 0, what: 'burrow', saved: true }); return; }
      // A Warden beside the burrow takes a predator's blow for it.
      const guard = this.striker ? this.heroes.filter((h) => HEROES[h.kind as HeroId].cls === 'warden' && Math.abs(h.x - x) + Math.abs(h.y - y) === 1).sort((a, b) => b.hp - a.hp || a.id - b.id)[0] : undefined;
      if (guard) { this.stats.guards++; this.ev({ t: 'guard', id: guard.id, x, y }); this.hurt(guard, n); return; }
      this.feature[i] = 'rubble'; this.warren = Math.max(0, this.warren - 1); this.stats.lost++;
      this.ev({ t: 'hit', x, y, dmg: 1, id: 0, what: 'burrow', saved: false });
    } else this.ev({ t: 'hit', x, y, dmg: 0, id: 0, what: f === 'rock' ? 'rock' : 'none', saved: false });
  }
  /** What the tile a unit has just been put on does to it. */
  private land(u: Unit) {
    if (u.fly || u.hp <= 0) return;
    const i = at(u.x, u.y), t = this.terrain[i];
    if (t === 'water') { if (u.side === 'pred' && !PREDATORS[u.kind as PredId].heavy) this.ko(u, 'drown'); else this.ev({ t: 'soak', id: u.id }); }
    else if (t === 'bramble') this.hurt(u, 1 + (u.side === 'pred' && this.relics.includes('burrs') ? 1 : 0));
    if (u.hp > 0 && this.fire[i] > 0) this.hurt(u, 1);
  }
  /** Moves a unit one tile, or bumps it into whatever is in the way. `extra` is a Bruiser's heavier bump. Ice carries it on. */
  private push(u: Unit, dir: number, extra = 0) {
    if (u.hp <= 0) return;
    const nx = u.x + DIRS[dir][0], ny = u.y + DIRS[dir][1];
    if (!inside(nx, ny)) return;
    u.canUndo = false;
    const other = this.unitAt(nx, ny), bump = (v: Unit) => 1 + (v.side === 'pred' && this.relics.includes('paws') ? 1 : 0);
    if (this.solid(nx, ny)) { this.ev({ t: 'bump', id: u.id, x: nx, y: ny }); this.hurt(u, bump(u) + extra); this.hit(nx, ny, 1); }
    else if (other) { this.ev({ t: 'bump', id: u.id, x: nx, y: ny }); this.hurt(u, bump(u) + extra); this.hurt(other, bump(other)); }
    else {
      const from: Tile = [u.x, u.y]; u.x = nx; u.y = ny; this.ev({ t: 'push', id: u.id, from, to: [nx, ny], leap: false }); this.land(u);
      if (u.hp > 0 && !u.fly && this.terrain[at(nx, ny)] === 'ice') this.push(u, dir, extra);
    }
  }

  // ----- The player's turn -----
  moveHero(id: number, x: number, y: number): Result {
    const u = this.unit(id);
    if (this.state !== 'player') return 'state';
    if (!u || u.side !== 'hero' || u.hp <= 0) return 'unit';
    if (u.moved) return 'done';
    const reach = this.reach(u);
    if (!inside(x, y) || !reach.has(at(x, y)) || (x === u.x && y === u.y) || !this.canStop(u, x, y)) return 'reach';
    u.fromX = u.x; u.fromY = u.y; u.x = x; u.y = y; u.moved = true; u.canUndo = true;
    this.ev({ t: 'move', id, path: this.pathTo(reach, x, y) });
    this.land(u);
    this.settle();
    return 'ok';
  }
  undoMove(id: number): Result {
    const u = this.unit(id);
    if (this.state !== 'player' || !u || !u.moved || !u.canUndo || this.unitAt(u.fromX, u.fromY, u.id)) return 'undo';
    const path: Tile[] = [[u.x, u.y], [u.fromX, u.fromY]];
    u.x = u.fromX; u.y = u.fromY; u.moved = false; u.canUndo = false;
    this.ev({ t: 'move', id, path });
    return 'ok';
  }
  /** Whether a chinchilla has this action: Groom, its own, or its second once learned. */
  knows(u: Unit, ability: AbilityId) { const d = HEROES[u.kind as HeroId]; return u.side === 'hero' && (ability === 'groom' || ability === d.ability || (u.skill && ability === d.second)); }
  /** The actions a chinchilla can pick from, Groom last. */
  abilities(u: Unit): AbilityId[] { const d = HEROES[u.kind as HeroId]; return [...(d.ability === 'groom' ? [] : [d.ability]), ...(u.skill && d.second ? [d.second] : []), 'groom']; }
  /** The tiles an action can be aimed at. Line actions list the thing each direction would hit. */
  targets(id: number, ability: AbilityId): Tile[] {
    const u = this.unit(id), a = ABILITIES[ability];
    if (!u || u.side !== 'hero' || u.hp <= 0 || u.acted || this.state !== 'player' || !this.knows(u, ability)) return [];
    if (ability !== 'groom' && (this.cloud[at(u.x, u.y)] > 0 || this.soaked(u))) return [];
    if (a.aim === 'self') return [[u.x, u.y]];
    const out: Tile[] = [];
    for (let d = 0; d < 4; d++) {
      const [dx, dy] = DIRS[d];
      if (a.aim === 'line') { const { hit } = this.ray(u.x, u.y, d); if (hit && ((ability !== 'tug' && ability !== 'swap') || this.unitAt(hit[0], hit[1]))) out.push(hit); continue; }
      for (let n = a.min; n <= a.max; n++) {
        const x = u.x + dx * n, y = u.y + dy * n;
        if (!inside(x, y)) break;
        const there = this.unitAt(x, y), water = this.terrain[at(x, y)] === 'water';
        if (ability === 'whack' && !there && !this.solid(x, y)) continue;
        if (ability === 'kick' && !there) continue;
        if (ability === 'brace' && (this.feature[at(x, y)] !== 'burrow' || this.armor[at(x, y)] > 0)) continue;
        if (ability === 'lull' && !(there && there.side === 'pred' && there.dir >= 0 && !PREDATORS[there.kind as PredId].boss)) continue;
        if (ability === 'toss' && (this.solid(x, y) || (water && !there))) continue;
        if (ability === 'pounce' && (there || this.solid(x, y) || water)) continue;
        out.push([x, y]);
      }
    }
    return out;
  }
  /** Turns a clicked tile into the tile the action would really land on, or null. A line action accepts any tile along the line. */
  aimAt(id: number, ability: AbilityId, x: number, y: number): Tile | null {
    const u = this.unit(id), list = this.targets(id, ability);
    if (!u) return null;
    const exact = list.find((t) => t[0] === x && t[1] === y);
    if (exact || ABILITIES[ability].aim !== 'line' || (x !== u.x && y !== u.y) || (x === u.x && y === u.y)) return exact ?? null;
    const sx = Math.sign(x - u.x), sy = Math.sign(y - u.y);
    return list.find((t) => Math.sign(t[0] - u.x) === sx && Math.sign(t[1] - u.y) === sy) ?? null;
  }
  act(id: number, ability: AbilityId, x: number, y: number): Result {
    const u = this.unit(id);
    if (this.state !== 'player') return 'state';
    if (!u || u.side !== 'hero' || u.hp <= 0) return 'unit';
    if (u.acted) return 'done';
    if (ability !== 'groom' && this.cloud[at(u.x, u.y)] > 0) return 'cloud';
    if (ability !== 'groom' && this.soaked(u)) return 'soaked';
    if (!this.targets(id, ability).some((t) => t[0] === x && t[1] === y)) return 'target';
    const cls = HEROES[u.kind as HeroId].cls, raw = ABILITIES[ability].dmg + u.power, dmg = raw + (raw > 0 && this.terrain[at(u.x, u.y)] === 'hill' ? 1 : 0);
    const dir = DIRS.findIndex(([dx, dy]) => dx === Math.sign(x - u.x) && dy === Math.sign(y - u.y)), heavy = cls === 'bruiser' ? 1 : 0;
    // A Scout that has not moved yet may still move after acting.
    u.acted = true; u.canUndo = false; if (cls !== 'scout') u.moved = true;
    this.ev({ t: 'act', id, ability, x, y });
    const around = (cx: number, cy: number, each: (v: Unit, d: number) => void) => { for (let d = 0; d < 4; d++) { const v = this.unitAt(cx + DIRS[d][0], cy + DIRS[d][1]); if (v && v.id !== u.id) each(v, d); } };
    if (ability === 'groom') { u.hp = Math.min(u.maxHp, u.hp + 1); this.ev({ t: 'heal', id }); }
    else if (ability === 'seed' || ability === 'whack') { const v = this.unitAt(x, y); this.hit(x, y, dmg); if (v) this.push(v, dir, heavy); }
    else if (ability === 'puff') {
      this.cloud[at(x, y)] = CLOUD_TURNS; this.ev({ t: 'cloud', x, y });
      const mid = this.unitAt(x, y); if (mid && dmg > 0) this.hurt(mid, dmg);
      around(x, y, (v, d) => this.push(v, d));
    } else if (ability === 'toss') {
      if (this.unitAt(x, y)) this.hit(x, y, dmg); else { this.feature[at(x, y)] = 'bale'; this.ev({ t: 'bale', x, y }); }
    } else if (ability === 'tug') {
      const v = this.unitAt(x, y)!, from: Tile = [v.x, v.y], tx = u.x + DIRS[dir][0], ty = u.y + DIRS[dir][1];
      v.canUndo = false;
      if (tx !== v.x || ty !== v.y) { v.x = tx; v.y = ty; this.ev({ t: 'push', id: v.id, from, to: [tx, ty], leap: false }); this.land(v); }
      if (dmg > 0 && v.hp > 0) this.hurt(v, dmg);
    } else if (ability === 'pounce') {
      const from: Tile = [u.x, u.y]; u.x = x; u.y = y;
      this.ev({ t: 'push', id, from, to: [x, y], leap: true }); this.land(u);
      around(x, y, (v, d) => { this.hurt(v, dmg); this.push(v, d, heavy); });
    } else if (ability === 'pierce') {
      const [dx, dy] = DIRS[dir];
      for (let nx = u.x + dx, ny = u.y + dy; inside(nx, ny); nx += dx, ny += dy) { const stop = this.solid(nx, ny); if (stop || this.unitAt(nx, ny)) this.hit(nx, ny, dmg); if (stop) break; }
    } else if (ability === 'slam') around(u.x, u.y, (v, d) => { this.hurt(v, dmg); this.push(v, d, heavy); });
    else if (ability === 'swap') {
      const v = this.unitAt(x, y)!, mine: Tile = [u.x, u.y], theirs: Tile = [v.x, v.y];
      v.canUndo = false; u.x = theirs[0]; u.y = theirs[1]; v.x = mine[0]; v.y = mine[1];
      this.ev({ t: 'push', id, from: mine, to: theirs, leap: true }); this.ev({ t: 'push', id: v.id, from: theirs, to: mine, leap: true });
      this.land(u); this.land(v);
      if (dmg > 0 && v.hp > 0) this.hurt(v, dmg);
    } else if (ability === 'brace') { this.armor[at(x, y)] = 1; this.ev({ t: 'brace', x, y }); }
    else if (ability === 'lull') { const v = this.unitAt(x, y)!; v.dir = -1; this.ev({ t: 'lull', id: v.id }); if (dmg > 0) this.hurt(v, dmg); }
    else if (ability === 'kick') {
      const v = this.unitAt(x, y)!;
      if (dmg > 0) this.hurt(v, dmg);
      for (let n = 0; n < 3 && v.hp > 0; n++) { const px = v.x, py = v.y; this.push(v, dir, heavy); if (v.x === px && v.y === py) break; }
    }
    this.settle();
    return 'ok';
  }
  /** The battle as it would stand after an action, for showing the result before it is confirmed. */
  preview(id: number, ability: AbilityId, x: number, y: number) { const b = this.clone(); return b.act(id, ability, x, y) === 'ok' ? b : null; }
  resetTurn(): Result {
    if (this.state === 'won' || this.state === 'deploy' || !this.turnStart || this.resetLeft <= 0) return 'undo';
    const left = this.resetLeft - 1, saved = this.turnStart;
    Object.assign(this, JSON.parse(saved), { resetLeft: left, events: this.events, quiet: false });
    this.turnStart = JSON.stringify(this.data());
    this.ev({ t: 'reset' });
    return 'ok';
  }

  // ----- The predators' turn -----
  /** Where a predator's attack would land from a given tile and direction. */
  threatFrom(u: Unit, x: number, y: number, dir: number, dist: number): Threat {
    const k = u.kind as PredId, [dx, dy] = DIRS[dir] ?? [0, 0], keep = (list: Tile[]) => list.filter(([a, b]) => inside(a, b));
    if (k === 'fox' || k === 'mole' || k === 'skunk') return { path: [], hits: keep([[x + dx, y + dy]]) };
    if (k === 'weasel') return { path: [], hits: keep([[x + dx, y + dy], [x + dx * 2, y + dy * 2]]) };
    if (k === 'badger') return { path: [], hits: keep([[x + dx, y + dy], [x + dx + dy, y + dy + dx], [x + dx - dy, y + dy - dx]]) };
    if (k === 'hawk') return { path: [], hits: keep([[x + dx * dist, y + dy * dist]]) };
    if (k === 'cougar') return { path: [], hits: keep(DIRS.map(([a, b]): Tile => [x + a, y + b])) };
    const r = this.ray(x, y, dir, u.id);
    return { path: r.path, hits: r.hit ? [r.hit] : [] };
  }
  /** The tiles a predator is about to hit, given where it stands now. */
  threat(u: Unit): Threat { return u.side === 'pred' && u.hp > 0 && u.dir >= 0 ? this.threatFrom(u, u.x, u.y, u.dir, u.dist) : { path: [], hits: [] }; }
  private strike(u: Unit) {
    if (u.hp <= 0 || u.dir < 0) return;
    const dir = u.dir, th = this.threat(u), dmg = PREDATORS[u.kind as PredId].dmg + u.power + (this.terrain[at(u.x, u.y)] === 'hill' ? 1 : 0), charge = u.kind === 'owl' || u.kind === 'bear';
    u.dir = -1;
    if (this.cloud[at(u.x, u.y)] > 0) { this.stats.fizzled++; this.ev({ t: 'fizzle', id: u.id }); return; }
    this.striker = u.id;
    this.ev({ t: 'attack', id: u.id, kind: u.kind as PredId, tiles: [...th.path, ...th.hits] });
    if (charge && th.path.length) { const from: Tile = [u.x, u.y], to = th.path[th.path.length - 1]; u.x = to[0]; u.y = to[1]; this.ev({ t: 'push', id: u.id, from, to, leap: true }); this.land(u); }
    for (const [x, y] of th.hits) {
      const v = this.unitAt(x, y);
      if (u.hp > 0) this.hit(x, y, dmg);
      if (u.kind === 'skunk' && u.hp > 0) { this.cloud[at(x, y)] = CLOUD_TURNS; this.ev({ t: 'cloud', x, y }); }
      if (v && charge && u.hp > 0) this.push(v, dir);
      if (v && u.kind === 'cougar') this.push(v, DIRS.findIndex(([a, b]) => a === x - u.x && b === y - u.y));
    }
    this.striker = 0;
  }
  /** Everything the predators' phase does that is already decided: their attacks in order, then the fire. */
  resolveAttacks() {
    for (const u of [...this.preds].sort((a, b) => a.order - b.order)) { this.strike(u); if (this.doomed()) return; }
    this.burn();
  }
  /** Fire hurts whatever stands in it, spreads to brambles and hay next to it, and burns down by one. */
  private burn() {
    const lit: number[] = [];
    this.fire.forEach((n, i) => { if (n > 0) lit.push(i); });
    if (!lit.length) return;
    for (const u of this.units) if (u.hp > 0 && !u.fly && this.fire[at(u.x, u.y)] > 0) this.hurt(u, 1);
    for (const i of lit) {
      for (const [dx, dy] of DIRS) {
        const x = (i % SIZE) + dx, y = Math.floor(i / SIZE) + dy, j = at(x, y);
        if (!inside(x, y) || this.fire[j] > 0) continue;
        if (this.feature[j] === 'bale') { this.feature[j] = null; this.ev({ t: 'hit', x, y, dmg: 1, id: 0, what: 'bale', saved: false }); }
        else if (this.terrain[j] !== 'bramble' || this.feature[j]) continue;
        this.fire[j] = FIRE_TURNS; this.ev({ t: 'fire', x, y, on: true, burnt: false });
      }
      if (--this.fire[i] > 0) continue;
      const burnt = this.terrain[i] === 'bramble';
      if (burnt) this.terrain[i] = 'grass';
      this.ev({ t: 'fire', x: i % SIZE, y: Math.floor(i / SIZE), on: false, burnt });
    }
  }
  private emerge() {
    this.marks = this.marks.filter((m) => {
      const u = this.unitAt(m.x, m.y), i = at(m.x, m.y);
      if (u) { this.stats.blocks++; this.ev({ t: 'blocked', x: m.x, y: m.y }); if (!(u.side === 'hero' && this.relics.includes('roots'))) this.hurt(u, 1); return true; }
      if (this.feature[i] === 'bale') { this.feature[i] = null; this.stats.blocks++; this.ev({ t: 'blocked', x: m.x, y: m.y }); this.ev({ t: 'hit', x: m.x, y: m.y, dmg: 1, id: 0, what: 'bale', saved: false }); return true; }
      const p = this.makePred(m.kind, m.x, m.y, m.alpha);
      this.units.push(p); this.ev({ t: 'emerge', unit: { ...p } });
      return false;
    });
  }
  /** Each predator, in turn, picks the tile and direction that hits the most and telegraphs it. */
  private think() {
    const claimed = new Set<number>();
    let order = 1;
    for (const u of this.preds.sort((a, b) => a.id - b.id)) {
      const reach = this.reach(u), def = PREDATORS[u.kind as PredId];
      const goals: Tile[] = [...this.burrows(), ...this.heroes.map((h): Tile => [h.x, h.y])];
      let best = { score: -Infinity, x: u.x, y: u.y, dir: 0, dist: 2 };
      for (const i of reach.keys()) {
        const x = i % SIZE, y = Math.floor(i / SIZE);
        if (!this.canStop(u, x, y)) continue;
        const hill = this.terrain[i] === 'hill', dmg = def.dmg + u.power + (hill ? 1 : 0);
        const base = (!u.fly && this.terrain[i] === 'bramble' ? -3 : 0) + (!u.fly && this.fire[i] > 0 ? -3 : 0) + (this.cloud[i] > 0 ? -4 : 0) + (hill ? 0.4 : 0);
        const near = goals.length ? Math.min(...goals.map(([gx, gy]) => Math.abs(gx - x) + Math.abs(gy - y))) : 0;
        for (let dir = 0; dir < (u.kind === 'cougar' ? 1 : 4); dir++) for (let dist = 2; dist <= (u.kind === 'hawk' ? 4 : 2); dist++) {
          let gain = 0;
          for (const [hx, hy] of this.threatFrom(u, x, y, dir, dist).hits) {
            const v = this.unitAt(hx, hy, u.id), f = this.feature[at(hx, hy)];
            if (v) gain += v.side === 'hero' ? (v.hp <= dmg ? 7 : 4) + (v.kind === 'kit' ? 3 : 0) : -5;
            else if (f === 'burrow') {
              // A braced burrow shrugs the hit off, and a Warden beside one takes it instead.
              const warden = this.heroes.some((h) => HEROES[h.kind as HeroId].cls === 'warden' && Math.abs(h.x - hx) + Math.abs(h.y - hy) === 1);
              gain += this.armor[at(hx, hy)] > 0 ? 1 : warden ? 3 : claimed.has(at(hx, hy)) ? 1 : at(hx, hy) === this.key ? 9 : 6;
            }
            else if (f === 'bale') gain += 0.5;
          }
          const score = base + (gain > 0 ? gain : gain - near * 0.3) + this.rand() * 0.2;
          if (score > best.score) best = { score, x, y, dir, dist };
        }
      }
      if (best.x !== u.x || best.y !== u.y) { const path = this.pathTo(reach, best.x, best.y); u.x = best.x; u.y = best.y; this.ev({ t: 'move', id: u.id, path }); this.land(u); }
      if (u.hp <= 0) continue;
      u.dir = best.dir; u.dist = best.dist; u.order = order++;
      for (const [hx, hy] of this.threat(u).hits) claimed.add(at(hx, hy));
      this.ev({ t: 'intent', id: u.id });
    }
  }
  private placeMarks() {
    for (const s of this.plan.filter((p) => p.turn === this.turn)) {
      let spot: Tile | null = s.x !== undefined && s.y !== undefined ? [s.x, s.y] : null;
      const free = ([x, y]: Tile) => !this.solid(x, y) && this.terrain[at(x, y)] !== 'water' && !this.fire[at(x, y)] && at(x, y) !== this.exit && !this.unitAt(x, y) && !this.marks.some((m) => m.x === x && m.y === y);
      if (!spot || !free(spot)) {
        const open: Tile[] = [];
        for (let y = 0; y < SIZE; y++) for (let x = 3; x < SIZE; x++) if ((x >= 6 || y === 0 || y === SIZE - 1) && free([x, y])) open.push([x, y]);
        spot = open.length ? open[Math.floor(this.rand() * open.length)] : null;
      }
      if (!spot) continue;
      this.marks.push({ x: spot[0], y: spot[1], kind: s.kind, alpha: !!s.alpha });
      this.ev({ t: 'mark', x: spot[0], y: spot[1] });
    }
  }
  /** The kit of an escort mission, while it stands. */
  get kit() { return this.units.find((u) => u.kind === 'kit' && u.hp > 0); }
  /** Whether the battle is already lost: no warren, nobody left to fight, the nursery gone, or the kit knocked out. */
  doomed() {
    return this.warren <= 0 || !this.heroes.some((u) => u.kind !== 'kit') || (this.key >= 0 && this.feature[this.key] !== 'burrow') || (this.goal === 'escort' && !this.kit);
  }
  /** Ends the battle if it has been decided. */
  private settle() {
    if (this.state !== 'player') return;
    const kit = this.kit;
    if (this.doomed()) this.state = 'lost';
    else if ((this.hunt && !this.preds.some((u) => u.mark)) || (kit && at(kit.x, kit.y) === this.exit) || (this.preds.length === 0 && !this.pending())) this.state = 'won';
    if (this.state !== 'player') this.ev({ t: 'end', state: this.state });
  }
  endTurn(): Result {
    if (this.state !== 'player') return 'state';
    this.ev({ t: 'phase', who: 'pred', turn: this.turn });
    this.resolveAttacks();
    this.settle();
    if (this.state !== 'player') return 'ok';
    this.emerge();
    this.settle();
    if (this.state !== 'player') return 'ok';
    if (this.turn >= this.turns) { this.state = this.goal === 'hold' ? 'won' : 'lost'; this.ev({ t: 'end', state: this.state }); return 'ok'; }
    this.think();
    this.turn++;
    this.placeMarks();
    this.cloud = this.cloud.map((n) => Math.max(0, n - 1));
    for (const u of this.heroes) { u.moved = false; u.acted = false; u.canUndo = false; }
    this.settle();
    if (this.state === 'player') { this.turnStart = JSON.stringify(this.data()); this.ev({ t: 'phase', who: 'player', turn: this.turn }); }
    return 'ok';
  }
  /** What the coming predator attacks will cost if the turn ends now. Exact: no randomness is involved. */
  forecast(): Forecast {
    const b = this.clone();
    b.resolveAttacks();
    const heroes: Record<number, number> = {}, downs: number[] = [];
    for (const u of this.heroes) { const v = b.unit(u.id)!; if (v.hp < u.hp) heroes[u.id] = u.hp - v.hp; if (v.hp <= 0) downs.push(u.id); }
    return { warren: this.warren - b.warren, burrows: this.burrows().filter(([x, y]) => b.feature[at(x, y)] !== 'burrow'), heroes, downs, kills: b.stats.kills - this.stats.kills };
  }
}

// ---------- The campaign ----------

export type Bonus = { text: string; stat: 'kills' | 'drowned' | 'friendly' | 'fizzled' | 'blocks'; n: number } | { text: string; stat: 'nodown' } | { text: string; stat: 'slay'; kind: PredId };
/** `skills` lists the squad members who know their second action in this mission; `teaches` is the one it introduces. */
export type Mission = BattleDef & { squad: HeroId[]; warren: number; bonus: Bonus; tip: string; unlock?: HeroId; skills?: HeroId[]; teaches?: HeroId };
export const MISSIONS: Mission[] = [
  { name: 'First Steps', region: 0, turns: 3, seed: 101, squad: ['dora', 'enzo'], warren: 3,
    map: ['........', '.B......', '........', '..B.....', '........', '.B......', '........', '........'],
    heroes: [[3, 2], [3, 4]], preds: [{ kind: 'fox', x: 6, y: 2 }, { kind: 'fox', x: 6, y: 5 }], plan: [],
    bonus: { text: 'Knock out a fox', stat: 'kills', n: 1 },
    tip: 'Red tiles are what the foxes will bite when you end the turn. Hit a fox to push it, and its bite moves with it.' },
  { name: 'Mind the Water', region: 0, turns: 4, seed: 102, squad: ['dora', 'enzo'], warren: 3,
    map: ['........', '.B..~...', '....~...', '..B.....', '....~~..', '.B..~~..', '........', '........'],
    heroes: [[2, 2], [2, 5]], preds: [{ kind: 'fox', x: 6, y: 1 }, { kind: 'fox', x: 6, y: 4 }, { kind: 'fox', x: 5, y: 6 }], plan: [{ turn: 2, kind: 'fox', x: 7, y: 3 }],
    bonus: { text: 'Push a predator into the water', stat: 'drowned', n: 1 },
    tip: 'Foxes cannot swim. Push one into the water and it is gone, however healthy it was.' },
  { name: 'Crossfire', region: 0, turns: 4, seed: 103, squad: ['dora', 'enzo'], warren: 3, unlock: 'pip',
    map: ['........', '.B...#..', '........', '.B......', '......#.', '.B......', '...#....', '........'],
    heroes: [[2, 2], [2, 4]], preds: [{ kind: 'snake', x: 6, y: 2 }, { kind: 'snake', x: 6, y: 6 }, { kind: 'fox', x: 5, y: 4 }], plan: [{ turn: 2, kind: 'fox', x: 7, y: 3 }],
    bonus: { text: 'Make one predator hit another', stat: 'friendly', n: 1 },
    tip: 'A snake spits at the first thing in its line. Push another predator into that line and the snake does your work.' },
  { name: 'Dust Up', region: 0, turns: 4, seed: 104, squad: ['dora', 'enzo', 'pip'], warren: 3, unlock: 'pebble',
    map: ['........', '.B....^.', '...#....', '.B......', '........', '.B..#...', '......^.', '........'],
    heroes: [[2, 2], [2, 4], [3, 6]], preds: [{ kind: 'fox', x: 6, y: 1 }, { kind: 'snake', x: 6, y: 4 }, { kind: 'fox', x: 6, y: 6 }], plan: [{ turn: 1, kind: 'snake', x: 7, y: 2 }, { turn: 2, kind: 'fox', x: 7, y: 5 }],
    bonus: { text: 'Smother 2 attacks in dust', stat: 'fizzled', n: 2 },
    tip: 'Pip’s dust cloud stops whoever stands in it from attacking, and shoves everything beside it outward.' },
  { name: 'Owl Country', region: 1, turns: 4, seed: 105, squad: ['dora', 'enzo', 'pebble'], warren: 4,
    map: ['........', '.B......', '...h....', '.B......', '........', '.B...h..', '........', '...B....'],
    heroes: [[2, 2], [2, 4], [3, 5]], preds: [{ kind: 'owl', x: 7, y: 1 }, { kind: 'owl', x: 7, y: 3 }, { kind: 'fox', x: 6, y: 6 }], plan: [{ turn: 1, kind: 'owl', x: 7, y: 5 }, { turn: 2, kind: 'fox', x: 7, y: 0 }],
    bonus: { text: 'Keep every chinchilla standing', stat: 'nodown' },
    tip: 'An owl swoops until something is in the way. Grandpa Pebble can throw a hay bale into its path.' },
  { name: 'Bramble Patch', region: 1, turns: 4, seed: 106, squad: ['dora', 'enzo', 'pip'], warren: 3, unlock: 'mochi',
    map: ['....^...', '.B..^...', '......^.', '.B.^....', '....^...', '.B....^.', '...^....', '........'],
    heroes: [[2, 2], [2, 4], [2, 6]], preds: [{ kind: 'weasel', x: 6, y: 1 }, { kind: 'weasel', x: 6, y: 4 }, { kind: 'fox', x: 6, y: 6 }], plan: [{ turn: 1, kind: 'weasel', x: 7, y: 3 }, { turn: 2, kind: 'fox', x: 7, y: 6 }],
    bonus: { text: 'Knock out 3 predators', stat: 'kills', n: 3 },
    tip: 'Anything pushed into brambles takes 1. A weasel only has 2 health, so a shot and a thorn finish it.' },
  { name: 'Rustling Grass', region: 1, turns: 5, seed: 107, squad: ['dora', 'enzo', 'mochi'], warren: 3,
    map: ['........', '.B......', '....~...', '.B..~...', '........', '.B....#.', '........', '........'],
    heroes: [[2, 2], [2, 4], [3, 6]], preds: [{ kind: 'fox', x: 6, y: 3 }],
    plan: [{ turn: 1, kind: 'fox', x: 7, y: 1 }, { turn: 1, kind: 'snake', x: 7, y: 5 }, { turn: 2, kind: 'weasel', x: 7, y: 3 }, { turn: 2, kind: 'fox', x: 6, y: 7 }, { turn: 3, kind: 'owl', x: 7, y: 2 }, { turn: 3, kind: 'snake', x: 7, y: 6 }],
    bonus: { text: 'Block rustling grass twice', stat: 'blocks', n: 2 },
    tip: 'Rustling grass is a predator about to arrive. Stand on it, or push something onto it, and it cannot come up. Blocking costs the blocker 1.' },
  { name: 'The Badger Sett', region: 2, turns: 5, seed: 108, squad: ['enzo', 'mochi', 'pebble'], warren: 4, unlock: 'biscuit',
    map: ['........', '.B...~..', '.....~..', '.B......', '....#...', '.B...~..', '.....~..', '..B.....'],
    heroes: [[2, 2], [3, 4], [2, 6]], preds: [{ kind: 'badger', x: 6, y: 3 }, { kind: 'snake', x: 6, y: 6 }, { kind: 'fox', x: 6, y: 0 }], plan: [{ turn: 1, kind: 'fox', x: 7, y: 4 }, { turn: 2, kind: 'weasel', x: 7, y: 2 }, { turn: 3, kind: 'snake', x: 7, y: 6 }],
    bonus: { text: 'Knock out the badger', stat: 'slay', kind: 'badger' },
    tip: 'A badger sweeps three tiles for 2 each and takes a lot of hitting. Mochi can tug it into the water.' },
  { name: 'Hawk Shadow', region: 2, turns: 5, seed: 109, squad: ['dora', 'biscuit', 'pip'], warren: 4,
    map: ['........', '.B..#...', '........', '.B....^.', '..#.....', '.B......', '....^...', '.B......'],
    heroes: [[2, 2], [3, 5], [2, 6]], preds: [{ kind: 'hawk', x: 6, y: 2 }, { kind: 'hawk', x: 6, y: 5 }, { kind: 'weasel', x: 5, y: 7 }], plan: [{ turn: 1, kind: 'fox', x: 7, y: 3 }, { turn: 2, kind: 'owl', x: 7, y: 0 }, { turn: 2, kind: 'snake', x: 7, y: 6 }, { turn: 3, kind: 'weasel', x: 7, y: 4 }],
    bonus: { text: 'Knock out 4 predators', stat: 'kills', n: 4 },
    tip: 'A hawk dives on a tile a fixed distance away. Push the hawk one tile and the dive lands one tile over.' },
  { name: 'The Mountain Cougar', region: 2, turns: 6, seed: 110, squad: ['dora', 'enzo', 'biscuit'], warren: 4, boss: true,
    map: ['........', '.B...#..', '....~...', '.B..~...', '........', '.B...^..', '...#....', '.B......'],
    heroes: [[2, 2], [2, 4], [2, 6]], preds: [{ kind: 'cougar', x: 6, y: 3 }, { kind: 'fox', x: 6, y: 1 }, { kind: 'snake', x: 6, y: 6 }],
    plan: [{ turn: 1, kind: 'owl', x: 7, y: 2 }, { turn: 2, kind: 'weasel', x: 7, y: 5 }, { turn: 3, kind: 'fox', x: 7, y: 0 }, { turn: 3, kind: 'hawk', x: 7, y: 6 }, { turn: 4, kind: 'weasel', x: 7, y: 3 }],
    bonus: { text: 'Knock out the Mountain Cougar', stat: 'slay', kind: 'cougar' },
    tip: 'The cougar rakes everything around it and will not drown. Knock it out and the raid ends at once, or simply outlast it.' },
  // ----- Chapter two: you choose where the squad starts, and each mission teaches one second action. -----
  { name: 'Thin Ice', region: 2, turns: 4, seed: 111, squad: ['dora', 'enzo', 'mochi'], warren: 3, deploy: true, skills: ['enzo'], teaches: 'enzo',
    map: ['........', '.B..==~.', '....==~.', '.B.===..', '...===..', '.B..==~.', '....==~.', '........'],
    heroes: [[2, 2], [2, 4], [3, 6]], preds: [{ kind: 'fox', x: 7, y: 1 }, { kind: 'fox', x: 7, y: 4 }, { kind: 'weasel', x: 7, y: 6 }], plan: [{ turn: 1, kind: 'fox', x: 7, y: 3 }, { turn: 2, kind: 'snake', x: 7, y: 5 }],
    bonus: { text: 'Send 2 predators into the water', stat: 'drowned', n: 2 },
    tip: 'Anything pushed onto ice keeps sliding until it leaves the ice or hits something. Enzo’s Ground Slam pushes everything around him at once.' },
  { name: 'Wildfire', region: 1, turns: 4, seed: 112, squad: ['dora', 'pip', 'pebble'], warren: 3, deploy: true, skills: ['dora'], teaches: 'dora',
    map: ['........', '.B..^^*.', '....^...', '.B.h^...', '....^^..', '.B...^..', '...h.^*.', '........'],
    heroes: [[2, 2], [2, 4], [3, 5]], preds: [{ kind: 'weasel', x: 7, y: 2 }, { kind: 'fox', x: 7, y: 5 }, { kind: 'snake', x: 6, y: 3 }], plan: [{ turn: 1, kind: 'fox', x: 7, y: 0 }, { turn: 2, kind: 'weasel', x: 7, y: 7 }],
    bonus: { text: 'Knock out 3 predators', stat: 'kills', n: 3 },
    tip: 'Fire hurts whatever stands in it when the predators’ turn ends, and it spreads through brambles and hay. Dora’s Piercing Seed hits everyone in a line.' },
  { name: 'High Ground', region: 1, turns: 5, seed: 113, squad: ['dora', 'biscuit', 'enzo'], warren: 4, deploy: true, skills: ['biscuit', 'enzo'], teaches: 'biscuit',
    map: ['........', '.B..n...', '......#.', '.B.n....', '.....n..', '.B......', '...n..^.', '..B.....'],
    heroes: [[2, 2], [2, 4], [3, 5]], preds: [{ kind: 'skunk', x: 6, y: 1 }, { kind: 'skunk', x: 6, y: 5 }, { kind: 'fox', x: 7, y: 3 }], plan: [{ turn: 1, kind: 'weasel', x: 7, y: 6 }, { turn: 2, kind: 'skunk', x: 7, y: 2 }, { turn: 3, kind: 'fox', x: 7, y: 4 }],
    bonus: { text: 'Keep every chinchilla standing', stat: 'nodown' },
    tip: 'Whoever stands on high ground hits 1 harder, predators too. A skunk’s spray leaves a stink cloud: nobody inside it can attack.' },
  { name: 'The Lost Kit', region: 0, turns: 6, seed: 114, squad: ['pip', 'mochi', 'enzo'], warren: 3, deploy: true, skills: ['pip', 'enzo'], teaches: 'pip', goal: 'escort', kit: [7, 5], exit: [0, 3],
    map: ['........', '.B...#..', '....~...', '...#....', '.....#..', '.B..~~#.', '........', '.B......'],
    heroes: [[2, 2], [2, 4], [3, 6]], preds: [{ kind: 'fox', x: 5, y: 0 }, { kind: 'fox', x: 5, y: 6 }, { kind: 'snake', x: 4, y: 7 }], plan: [{ turn: 1, kind: 'weasel', x: 5, y: 3 }, { turn: 2, kind: 'fox', x: 3, y: 2 }, { turn: 3, kind: 'fox', x: 2, y: 3 }],
    bonus: { text: 'Keep every chinchilla standing', stat: 'nodown' },
    tip: 'A kit is stranded on the far side. Walk it to the den flag. Pip’s Switcheroo swaps places with the first creature in a line, the kit included.' },
  { name: 'The Nursery', region: 1, turns: 5, seed: 115, squad: ['pebble', 'enzo', 'dora'], warren: 4, deploy: true, skills: ['pebble', 'enzo', 'dora'], teaches: 'pebble', key: [1, 3],
    map: ['........', '.B......', '...#....', '.B...^..', '........', '.B..#...', '........', '..B.....'],
    heroes: [[2, 2], [2, 4], [3, 5]], preds: [{ kind: 'mole', x: 6, y: 2 }, { kind: 'mole', x: 6, y: 5 }, { kind: 'fox', x: 6, y: 3 }], plan: [{ turn: 1, kind: 'mole', x: 7, y: 4 }, { turn: 2, kind: 'weasel', x: 7, y: 1 }, { turn: 3, kind: 'mole', x: 7, y: 6 }],
    bonus: { text: 'Knock out 3 predators', stat: 'kills', n: 3 },
    tip: 'The burrow with the gold star is the nursery: lose it and the battle is lost. Moles tunnel under everything. Grandpa Pebble can Brace a burrow, and as a Warden he takes hits meant for burrows beside him.' },
  { name: 'The Old Badger', region: 2, turns: 5, seed: 116, squad: ['mochi', 'biscuit', 'dora'], warren: 4, deploy: true, skills: ['mochi', 'biscuit', 'dora'], teaches: 'mochi', goal: 'hunt',
    map: ['........', '.B......', '......^.', '.B..#...', '........', '.B....^.', '...^#...', '.B......'],
    heroes: [[2, 2], [2, 4], [2, 6]], preds: [{ kind: 'badger', x: 6, y: 4, alpha: true, mark: true, hp: 10 }, { kind: 'fox', x: 6, y: 1 }, { kind: 'snake', x: 6, y: 6 }], plan: [{ turn: 1, kind: 'weasel', x: 7, y: 3 }, { turn: 2, kind: 'fox', x: 7, y: 0 }, { turn: 3, kind: 'owl', x: 7, y: 5 }],
    bonus: { text: 'Make one predator hit another', stat: 'friendly', n: 1 },
    tip: 'Knock out the marked badger before the turns run out. Mochi’s Lullaby makes a predator forget its attack, which buys a turn to line things up.' },
  { name: 'Smoke and Stink', region: 2, turns: 5, seed: 117, squad: ['pip', 'pebble', 'enzo'], warren: 4, deploy: true, skills: ['pip', 'pebble', 'enzo'],
    map: ['........', '.B..^^..', '.....^*.', '.B.h....', '....=...', '.B..=n..', '...^....', '..B.....'],
    heroes: [[2, 2], [2, 4], [2, 6]], preds: [{ kind: 'skunk', x: 6, y: 1 }, { kind: 'mole', x: 6, y: 4 }, { kind: 'skunk', x: 6, y: 6 }], plan: [{ turn: 1, kind: 'mole', x: 7, y: 3 }, { turn: 2, kind: 'hawk', x: 7, y: 5 }, { turn: 3, kind: 'skunk', x: 7, y: 2 }, { turn: 3, kind: 'fox', x: 7, y: 7 }],
    bonus: { text: 'Smother 2 attacks in dust', stat: 'fizzled', n: 2 },
    tip: 'A cloud stops attacks whoever made it: push a predator into a skunk’s stink and it coughs instead of biting.' },
  { name: 'The Great Bear', region: 2, turns: 6, seed: 118, squad: ['dora', 'mochi', 'biscuit'], warren: 4, deploy: true, boss: true, skills: ['dora', 'mochi', 'biscuit'],
    map: ['........', '.B..n...', '....==..', '.B..==~.', '........', '.B...^..', '...#....', '.B......'],
    heroes: [[2, 2], [2, 4], [2, 6]], preds: [{ kind: 'bear', x: 7, y: 4 }, { kind: 'skunk', x: 6, y: 1 }, { kind: 'mole', x: 6, y: 6 }],
    plan: [{ turn: 1, kind: 'owl', x: 7, y: 2 }, { turn: 2, kind: 'weasel', x: 7, y: 5 }, { turn: 3, kind: 'mole', x: 7, y: 0 }, { turn: 4, kind: 'hawk', x: 7, y: 6 }],
    bonus: { text: 'Knock out the Great Bear', stat: 'slay', kind: 'bear' },
    tip: 'The bear charges in a straight line until something stops it, and hits that for 3. Give it a rock, a hay bale or another predator to run into.' },
];
/** The first mission of chapter two (0-based). */
export const CHAPTER_TWO = 10;
/** The mission that opens The Long Night once it is won (0-based). */
export const RUN_UNLOCK = 4;
export const missionBattle = (i: number) => Battle.create(MISSIONS[i], MISSIONS[i].squad.map((id) => member(id, !!MISSIONS[i].skills?.includes(id))), { warren: MISSIONS[i].warren });
/** What a battle asks for, in a few words. */
export const goalText = (b: Battle) => (b.goal === 'escort' ? 'Get the kit to the den' : b.goal === 'hunt' ? 'Knock out the marked predator in time' : b.key >= 0 ? 'Hold out, and keep the nursery standing' : 'Hold out until the raid ends');
export function bonusMet(b: Battle, bonus: Bonus) {
  if (bonus.stat === 'nodown') return b.stats.downs === 0;
  if (bonus.stat === 'slay') return b.stats.slain.includes(bonus.kind);
  return b.stats[bonus.stat] >= bonus.n;
}
/** 0 for a loss; otherwise one star for winning, one for losing no burrow and one for the mission's bonus. */
export const stars = (b: Battle, m: Mission) => (b.state !== 'won' ? 0 : 1 + (b.stats.lost === 0 ? 1 : 0) + (bonusMet(b, m.bonus) ? 1 : 0));
/** The chinchillas you have after winning the first `cleared` missions. */
export const unlockedHeroes = (cleared: number): HeroId[] => ['dora', 'enzo', ...MISSIONS.slice(0, cleared).map((m) => m.unlock).filter((h): h is HeroId => !!h)];

// ---------- The Long Night ----------

export const REGIONS = ['The Meadow', 'The Foothills', 'The High Pass'];
const STAGE_REGION = [0, 0, 1, 1, 2, 2, 2];
const POOLS: PredId[][] = [['fox', 'snake'], ['fox', 'snake', 'owl', 'weasel', 'skunk'], ['fox', 'snake', 'owl', 'weasel', 'mole', 'skunk', 'badger', 'hawk']];
/** Balance knobs for a run: the predators on the board at the start, and those that arrive each turn. */
export const START_BUDGET = 7, START_STEP = 1, WAVE_BUDGET = 3.8, WAVE_STEP = 0.8, ALPHA_FROM = 3, ALPHA_CHANCE = 0.3;
export type Difficulty = 'gentle' | 'standard' | 'fierce';
/** How a run's difficulty changes the warren and how many predators come. */
export const DIFFICULTY: Record<Difficulty, { id: Difficulty; name: string; warren: number; budget: number; blurb: string }> = {
  gentle: { id: 'gentle', name: 'Gentle', warren: 6, budget: 0.8, blurb: 'A warren of 6 and fewer predators.' },
  standard: { id: 'standard', name: 'Standard', warren: RUN_WARREN, budget: 1, blurb: 'A warren of 5. The run as it was tuned.' },
  fierce: { id: 'fierce', name: 'Fierce', warren: 4, budget: 1.3, blurb: 'A warren of 4 and more predators.' },
};
export const DIFFICULTY_IDS = Object.keys(DIFFICULTY) as Difficulty[];
/** The boss waiting at the end of a run: the bear on even seeds, the cougar on odd ones. */
export const runBoss = (seed: number): PredId => (seed % 2 === 0 ? 'bear' : 'cougar');

/** The board, predators and arrivals for battle `stage` (0-based) of a run. The same seed always gives the same battle. */
export function makeField(seed: number, stage: number, difficulty: Difficulty = 'standard'): BattleDef {
  const region = STAGE_REGION[stage], boss = stage === RUN_STAGES - 1, mult = DIFFICULTY[difficulty].budget, bossKind = runBoss(seed);
  for (let attempt = 0; ; attempt++) {
    const r = rng(seed * 7919 + stage * 104729 + attempt * 31 + 11), pick = (n: number) => Math.floor(r() * n);
    const g: string[][] = Array.from({ length: SIZE }, () => Array<string>(SIZE).fill('.'));
    const free = (x: number, y: number) => inside(x, y) && g[y][x] === '.';
    const scatter = (ch: string, n: number, x0: number, x1: number) => { for (let i = 0, tries = 0; i < n && tries < 80; tries++) { const x = x0 + pick(x1 - x0 + 1), y = pick(SIZE); if (free(x, y)) { g[y][x] = ch; i++; } } };
    // One or two ponds grown from a seed tile, kept off the home side.
    for (let p = 0, ponds = 1 + pick(2); p < ponds; p++) {
      let x = 3 + pick(4), y = 1 + pick(6);
      for (let i = 0, n = 2 + pick(3); i < n; i++) { if (free(x, y)) g[y][x] = '~'; const [dx, dy] = DIRS[pick(4)]; x = Math.max(3, Math.min(6, x + dx)); y = Math.max(0, Math.min(SIZE - 1, y + dy)); }
    }
    // Burrows down the home side, never two together.
    const burrows: Tile[] = [];
    for (let tries = 0; burrows.length < (stage >= 2 ? 4 : 3) && tries < 200; tries++) {
      const x = pick(3), y = pick(SIZE);
      if (free(x, y) && !burrows.some(([bx, by]) => Math.abs(bx - x) + Math.abs(by - y) < 2)) { g[y][x] = 'B'; burrows.push([x, y]); }
    }
    // Ice in the High Pass, grown the same way as a pond.
    if (region === 2) { let x = 3 + pick(3), y = 1 + pick(6); for (let i = 0, n = 3 + pick(3); i < n; i++) { if (free(x, y)) g[y][x] = '='; const [dx, dy] = DIRS[pick(4)]; x = Math.max(2, Math.min(6, x + dx)); y = Math.max(0, Math.min(SIZE - 1, y + dy)); } }
    scatter('#', 2 + pick(2), 2, 7); scatter('^', 1 + region + pick(3), 2, 7); scatter('h', pick(3), 2, 5);
    if (region >= 1) scatter('n', 1 + pick(2), 2, 6);
    // Now and then a fire is already burning next to the brambles in the Foothills.
    if (region === 1 && r() < 0.5) { const thorns: Tile[] = []; g.forEach((row, y) => row.forEach((ch, x) => { if (ch === '^') thorns.push([x, y]); })); const [tx, ty] = thorns[pick(thorns.length)] ?? [-1, -1]; for (const [dx, dy] of DIRS) if (free(tx + dx, ty + dy) && tx + dx >= 3) { g[ty + dy][tx + dx] = '*'; break; } }
    const heroes: Tile[] = [];
    for (let tries = 0; heroes.length < 3 && tries < 200; tries++) { const x = 1 + pick(3), y = pick(SIZE); if (free(x, y) && !heroes.some(([hx, hy]) => hx === x && hy === y)) heroes.push([x, y]); }
    const taken = new Set(heroes.map(([x, y]) => at(x, y)));
    const spot = (x0: number): Tile | null => { for (let tries = 0; tries < 60; tries++) { const x = x0 + pick(SIZE - x0), y = pick(SIZE); if (free(x, y) && !taken.has(at(x, y))) { taken.add(at(x, y)); return [x, y]; } } return null; };
    const roll = (budget: number, each: (kind: PredId, alpha: boolean) => void) => {
      for (let guard = 0; budget >= 2 && guard < 12; guard++) {
        const can = POOLS[region].filter((k) => PREDATORS[k].cost <= budget), kind = can[pick(can.length)];
        const alpha = stage >= ALPHA_FROM && budget >= PREDATORS[kind].cost + 2 && r() < ALPHA_CHANCE;
        budget -= PREDATORS[kind].cost + (alpha ? 2 : 0); each(kind, alpha);
      }
    };
    const preds: BattleDef['preds'] = [], plan: Spawn[] = [], turns = boss ? 6 : stage < 2 ? 4 : 5;
    if (boss) { const s = spot(5); if (s) preds.push({ kind: bossKind, x: s[0], y: s[1] }); }
    roll((boss ? 4 : START_BUDGET + stage * START_STEP) * mult, (kind, alpha) => { const s = spot(5); if (s) preds.push({ kind, x: s[0], y: s[1], alpha }); });
    for (let t = 1; t < turns; t++) roll((WAVE_BUDGET + stage * WAVE_STEP) * mult, (kind, alpha) => plan.push({ turn: t, kind, alpha }));
    // Everyone has to be able to walk to everything that isn't water or a wall.
    const seen = new Set<number>(), walk = '.^=n*', open = (x: number, y: number) => inside(x, y) && walk.includes(g[y][x]);
    if (heroes.length === 3) { const stack = [heroes[0]]; seen.add(at(...heroes[0])); while (stack.length) { const [x, y] = stack.pop()!; for (const [dx, dy] of DIRS) if (open(x + dx, y + dy) && !seen.has(at(x + dx, y + dy))) { seen.add(at(x + dx, y + dy)); stack.push([x + dx, y + dy]); } } }
    const walkable = g.flat().filter((ch) => walk.includes(ch)).length;
    // From the third night on, one burrow in three is a nursery.
    const key = !boss && stage >= 2 && r() < 0.34 ? burrows[pick(burrows.length)] : undefined;
    const ok = heroes.length === 3 && burrows.length >= 3 && preds.length > 0 && seen.size === walkable && burrows.every(([x, y]) => DIRS.some(([dx, dy]) => seen.has(at(x + dx, y + dy)) && inside(x + dx, y + dy)));
    if (ok || attempt > 60) return { name: boss ? `The ${PREDATORS[bossKind].name}` : `${REGIONS[region]} · night ${stage + 1}`, region, turns, map: g.map((row) => row.join('')), heroes, preds, plan, boss, key, deploy: true, seed: seed * 131 + stage * 17 + attempt };
  }
}

export type Reward = { type: 'perk'; hero: HeroId; perk: Perk } | { type: 'skill'; hero: HeroId } | { type: 'relic'; relic: RelicId } | { type: 'repair' };
export const PERK_TEXT: Record<Perk, string> = { hp: '+1 health', move: '+1 move', power: '+1 damage' };
export function rewardText(w: Reward) {
  if (w.type === 'repair') return { title: 'Dig a new burrow', blurb: 'The warren regains 1.' };
  if (w.type === 'relic') return { title: RELICS[w.relic].name, blurb: RELICS[w.relic].blurb };
  if (w.type === 'skill') { const a = ABILITIES[HEROES[w.hero].second!]; return { title: `${HEROES[w.hero].name} learns ${a.name}`, blurb: a.blurb }; }
  return { title: `${HEROES[w.hero].name}: ${PERK_TEXT[w.perk]}`, blurb: w.perk === 'power' ? `${HEROES[w.hero].name}’s actions do 1 more damage.` : w.perk === 'hp' ? 'One more hit before going down.' : 'One more tile every turn.' };
}

export class Run {
  seed = 1; stage = 0; squad: Member[] = []; warren = RUN_WARREN; maxWarren = RUN_WARREN; difficulty: Difficulty = 'standard'; relics: RelicId[] = [];
  phase: 'battle' | 'reward' | 'won' | 'lost' = 'battle';
  choices: Reward[] = []; battle: Battle | null = null; kills = 0; saved = 0;

  static start(seed: number, heroes: HeroId[], difficulty: Difficulty = 'standard') {
    const r = new Run();
    r.seed = seed; r.difficulty = difficulty; r.warren = r.maxWarren = DIFFICULTY[difficulty].warren; r.squad = heroes.slice(0, 3).map((id) => member(id)); r.begin();
    return r;
  }
  private begin() { this.battle = Battle.create(makeField(this.seed, this.stage, this.difficulty), this.squad, { warren: this.warren, maxWarren: this.maxWarren, relics: this.relics }); this.phase = 'battle'; }
  /** Call once the battle is decided: banks the result and deals the rewards. */
  finish() {
    const b = this.battle;
    if (!b || this.phase !== 'battle' || (b.state !== 'won' && b.state !== 'lost')) return;
    this.kills += b.stats.kills;
    if (b.state === 'lost') { this.phase = 'lost'; return; }
    this.warren = b.warren; this.saved += b.burrows().length;
    for (const u of b.units) if (u.side === 'hero' && u.kind !== 'kit' && u.hp <= 0) { const m = this.squad.find((s) => s.id === u.kind)!; if (HEROES[m.id].hp + m.hp - m.scars > 1) m.scars++; }
    if (this.stage >= RUN_STAGES - 1) { this.phase = 'won'; return; }
    const r = rng(this.seed * 613 + this.stage * 7 + 3), pick = <T,>(list: T[]) => list[Math.floor(r() * list.length)];
    const perks: Reward[] = this.squad.flatMap((m) => (['hp', 'move', 'power'] as Perk[]).filter((p) => m[p] < CLASSES[HEROES[m.id].cls!].caps[p]).map((perk): Reward => ({ type: 'perk', hero: m.id, perk })));
    const relics = RELIC_IDS.filter((id) => !this.relics.includes(id)), skills = this.squad.filter((m) => !m.skill);
    const out: Reward[] = [];
    const take = (w: Reward | undefined) => { if (w && out.length < 3 && !out.some((o) => JSON.stringify(o) === JSON.stringify(w))) out.push(w); };
    take(pick(perks));
    if (this.warren < this.maxWarren) take({ type: 'repair' });
    if (skills.length && r() < 0.6) take({ type: 'skill', hero: pick(skills).id });
    if (relics.length && r() < 0.7) take({ type: 'relic', relic: pick(relics) });
    for (let guard = 0; out.length < 3 && guard < 40; guard++) take(perks.length ? pick(perks) : relics.length ? { type: 'relic', relic: pick(relics) } : { type: 'repair' });
    this.choices = out; this.phase = 'reward';
  }
  pick(i: number) {
    const w = this.choices[i];
    if (this.phase !== 'reward' || !w) return false;
    if (w.type === 'repair') this.warren = Math.min(this.maxWarren, this.warren + 1);
    else if (w.type === 'relic') this.relics.push(w.relic);
    else if (w.type === 'skill') this.squad.find((m) => m.id === w.hero)!.skill = true;
    else this.squad.find((m) => m.id === w.hero)![w.perk]++;
    this.choices = []; this.stage++; this.begin();
    return true;
  }
  snapshot() { return JSON.parse(JSON.stringify({ ...this, battle: this.battle?.snapshot() ?? null })) as Record<string, unknown>; }
  static restore(data: Record<string, unknown>) {
    const r = new Run();
    Object.assign(r, JSON.parse(JSON.stringify({ ...data, battle: null })));
    r.battle = data.battle ? Battle.from(data.battle as Record<string, unknown>) : null;
    return r;
  }
}

// ---------- The planner ----------
// One-turn lookahead on copies of the battle. The Hint button and the test bot both use it, so they cannot disagree.

export type Step = { id: number; move: Tile | null; act: { ability: AbilityId; x: number; y: number } | null; /** A Scout's move after acting. */ then: Tile | null; score: number };
/** How good a board is for the chinchillas. */
export function boardValue(b: Battle) {
  if (b.state === 'lost' || b.doomed()) return -1e6;
  let v = b.warren * 30 + (b.state === 'won' ? 1e4 : 0);
  if (b.key >= 0 && b.armor[b.key] > 0) v += 6;
  for (const u of b.units) {
    if (u.hp <= 0) continue;
    if (u.kind === 'kit') v += 40 + u.hp * 12 - walkSteps(b, u.x, u.y, b.exit) * 9;
    else if (u.side === 'hero') v += 22 + u.hp * 7 + (b.marks.some((m) => m.x === u.x && m.y === u.y) && u.hp > 1 ? 5 : 0) - (b.soaked(u) ? 6 : 0) - (b.fire[u.y * SIZE + u.x] > 0 ? 4 : 0);
    else v -= (7 + u.hp * 3) * (u.mark ? 2.5 : 1);
  }
  return v;
}
/** How many steps it is on foot from a tile to a goal, round rocks, bales, burrows and water but ignoring creatures. */
function walkSteps(b: Battle, x: number, y: number, goal: number) {
  const seen = new Map<number, number>([[at(x, y), 0]]), queue = [at(x, y)];
  for (let n = 0; n < queue.length; n++) {
    const i = queue[n], d = seen.get(i)!;
    if (i === goal) return d;
    for (const [dx, dy] of DIRS) { const nx = (i % SIZE) + dx, ny = Math.floor(i / SIZE) + dy, j = at(nx, ny); if (inside(nx, ny) && !seen.has(j) && !b.solid(nx, ny) && b.terrain[j] !== 'water') { seen.set(j, d + 1); queue.push(j); } }
  }
  return 20;
}
/** The board after the predators' attacks, scored. */
const after = (b: Battle) => { b.resolveAttacks(); return boardValue(b); };
/** The best thing one chinchilla can do now. */
export function bestStep(b: Battle, id: number): Step {
  const u = b.unit(id)!, scout = HEROES[u.kind as HeroId].cls === 'scout';
  let top: Step = { id, move: null, act: null, then: null, score: after(b.clone()) };
  const acts = (c: Battle, each: (d: Battle, act: Step['act']) => void) => {
    for (const ability of c.abilities(c.unit(id)!)) for (const [x, y] of c.targets(id, ability)) {
      if (ability === 'groom' && c.unit(id)!.hp >= c.unit(id)!.maxHp) continue;
      const d = c.clone();
      if (d.act(id, ability, x, y) === 'ok') each(d, { ability, x, y });
    }
  };
  const consider = (c: Battle, move: Tile | null) => {
    const still = after(c.clone());
    if (still > top.score) top = { id, move, act: null, then: null, score: still };
    acts(c, (d, act) => { const score = after(d); if (score > top.score) top = { id, move, act, then: null, score }; });
  };
  consider(b.clone(), null);
  for (const [x, y] of b.moves(id)) { const c = b.clone(); c.moveHero(id, x, y); consider(c, [x, y]); }
  // A Scout can also act first and move afterwards.
  if (scout && !u.moved && !u.acted) acts(b, (d, act) => {
    if (d.state !== 'player') return;
    for (const [x, y] of d.moves(id)) { const e = d.clone(); e.moveHero(id, x, y); const score = after(e); if (score > top.score + 0.01) top = { id, move: null, act, then: [x, y], score }; }
  });
  return top;
}
/** Carries out a step; false if the battle would not take it. */
export function doStep(b: Battle, s: Step) {
  if (s.move && b.moveHero(s.id, s.move[0], s.move[1]) !== 'ok') return false;
  if (s.act && b.state === 'player' && b.act(s.id, s.act.ability, s.act.x, s.act.y) !== 'ok') return false;
  if (s.then && b.state === 'player' && b.moveHero(s.id, s.then[0], s.then[1]) !== 'ok') return false;
  return true;
}
/** A whole player turn: tries each order of the chinchillas that can still do something and keeps the best. */
export function planTurn(b: Battle): Step[] {
  const ids = b.heroes.filter((u) => !u.acted || !u.moved).map((u) => u.id);
  const orders: number[][] = [];
  const permute = (rest: number[], done: number[]) => { if (!rest.length) orders.push(done); rest.forEach((id, i) => permute([...rest.slice(0, i), ...rest.slice(i + 1)], [...done, id])); };
  permute(ids.slice(0, 4), []);
  let pick: { score: number; steps: Step[] } | null = null;
  for (const order of orders) {
    const c = b.clone(), steps: Step[] = [];
    for (const id of order) {
      if (c.state !== 'player' || !c.unit(id) || c.unit(id)!.hp <= 0) continue;
      const step = bestStep(c, id);
      doStep(c, step); steps.push(step);
    }
    const score = c.state === 'player' ? after(c) : boardValue(c);
    if (!pick || score > pick.score) pick = { score, steps };
  }
  return pick ? pick.steps : [];
}
/** The next thing the planner would do, or null when it would simply end the turn. */
export function hint(b: Battle): Step | null {
  if (b.state !== 'player') return null;
  return planTurn(b).find((s) => s.move || s.act || s.then) ?? null;
}
