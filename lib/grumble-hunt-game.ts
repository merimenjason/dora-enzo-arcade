/** Grumble Hunt rules. All distances are world units; all clocks are seconds. No DOM or Three.js. */
import { DROPS, GATHER, ITEMS, MATERIALS, SNACKS, STORY, canAfford, cap, pay, rollCalm, rollShed, type AreaId, type ItemId, type MaterialId, type SnackId } from './grumble-hunt-content.js';
export type { AreaId, ItemId, MaterialId, SnackId };
export type HeroId = 'dora' | 'enzo';
export const BEAST_IDS = ['bristleback', 'puffwart', 'skreel', 'hornclack', 'frostmane'] as const;
export type BeastId = typeof BEAST_IDS[number];
export const BEASTS: Record<BeastId, { name: string; grump: number; part: string; tip: string; color: string }> = {
  bristleback: { name: 'Bristleback', grump: 420, part: 'tusks', tip: 'Step out of the orange lane. A charge into a tree or rock makes it dizzy!', color: '#b98050' },
  puffwart: { name: 'Puffwart', grump: 440, part: 'throat sac', tip: 'Roll past the tongue, leave the sleepy clouds, and bonk between hops.', color: '#8c9d4b' },
  skreel: { name: 'Skreel', grump: 400, part: 'crest', tip: 'Dodge the swoop, then get close while Skreel rests on the ground.', color: '#788ca6' },
  hornclack: { name: 'Hornclack', grump: 560, part: 'horn cap', tip: 'The front shell blocks bonks. Circle around to the sides or back.', color: '#8b919f' },
  frostmane: { name: 'Frostmane', grump: 840, part: 'mane tufts', tip: 'Watch for a pounce or a round mane-shake marker. Three moods, one lovely nap.', color: '#accfe7' },
};
export const DT = 1 / 60;
export const ARENA_RADIUS = 19;
export const TELEGRAPH = 0.9; // Every attack, including final-phase pounces, has at least this warning (less 0.1 s when Extra Grumpy).
export const GRUMPY_AT = 0.3; // Below this share of Grump a beast turns Extra Grumpy: 15% faster, warning 0.1 s sooner.
export const GRUMPY_PACE = 1.15;
export const SIGHT = 12; // Further than this, or behind a tree or rock, the beast is out of sight and Enzo sniffs out a trail.
export const ORDERS = ['close', 'bonk', 'gather'] as const;
export type BuddyOrder = typeof ORDERS[number];
export const ORDER_NAMES: Record<BuddyOrder, string> = { close: 'Stay close', bonk: 'Go bonk', gather: 'Gather' };
export const SAVE_KEY = 'grumble-hunt-v2';
/** The first build's save. It is read once when there is no v2 save, then v2 is written. */
export const V1_SAVE_KEY = 'grumble-hunt-v1';
export const SPOTS = [
  { id: 'forge', name: 'Forge', x: -6, z: -3 },
  { id: 'board', name: 'Hunt board', x: 0, z: -5 },
  { id: 'book', name: 'Beast Book', x: 6, z: -3 },
  { id: 'pantry', name: 'Pantry', x: -6.5, z: 4 },
] as const;
export const MATERIAL_IDS = Object.keys(MATERIALS) as MaterialId[];
export const ITEM_IDS = Object.keys(ITEMS) as ItemId[];
export const SNACK_IDS = Object.keys(SNACKS) as SnackId[];
/** Items that can go in the hunt ring; the hay bundle is only a snack ingredient. */
export const RING_ITEMS = ITEM_IDS.filter((id) => ITEMS[id].effect.kind !== 'ingredient');
export const RING_SIZE = 6;
export const DEFAULT_RING: readonly ItemId[] = ['fluffberry', 'big-fluffberry', 'sleepy-seed', 'dizzy-bell', 'sticky-sap', 'smoke-puffball'];
export const CAMP_BERRIES = 3; // Every hunt starts with at least this many fluffberries, free from camp.
export const GATHER_TIME = 1.2; // Seconds of standing still at a gathering spot.
export const GATHER_REACH = 1.8;
export const DIZZY_FULL = 100; // A big bonk or shot adds 50 Dizzy, a buddy's 30, a dizzy bell 40.
const TRAP_REACH = 1.6, SLEEPY_REACH = 10, BELL_REACH = 4;
/** Each hunt happens in its beast's story area, which sets the gathering spots. */
export const HUNT_AREA = Object.fromEntries(BEAST_IDS.map((id) => [id, STORY.find((c) => c.id > 0 && c.beast === id)!.area])) as Record<BeastId, AreaId>;
const GATHERED: readonly MaterialId[] = ['berry', 'marsh-reed', 'glimmer-stone'];
/** What each beast sheds, pops off and gives at nap time. Gathered berries, reeds and glimmer stones are not beast materials. */
export const BEAST_MATERIALS = Object.fromEntries(BEAST_IDS.map((id) => {
  const d = DROPS[id], all = [d.shed.id, ...Object.values(d.parts), ...d.calm.common, d.calm.rare.id];
  return [id, MATERIAL_IDS.filter((m) => all.includes(m) && !GATHERED.includes(m))];
})) as Record<BeastId, MaterialId[]>;
/** The Forge spends beast materials commonest first, keeping parts and rares for last. */
const RANK = { common: 0, rare: 1, part: 2 };
export const FORGE_MATERIALS = MATERIAL_IDS.filter((m) => !GATHERED.includes(m)).sort((a, b) => RANK[MATERIALS[a].rarity] - RANK[MATERIALS[b].rarity]);
/** The pop-off part's material. Skreel has no part in the drop tables, so its crest gives two sky feathers. */
const PART_DROP: Record<BeastId, { id: MaterialId; count: number }> = {
  bristleback: { id: DROPS.bristleback.parts.tusks, count: 1 }, puffwart: { id: DROPS.puffwart.parts.throat, count: 1 }, skreel: { id: 'sky-feather', count: 2 },
  hornclack: { id: DROPS.hornclack.parts.horn, count: 1 }, frostmane: { id: DROPS.frostmane.parts.mane, count: 1 },
};
/** The first build kept one count per beast; each carries over as that beast's shed material. */
const V1_MATERIAL: Record<BeastId, MaterialId> = Object.fromEntries(BEAST_IDS.map((id) => [id, DROPS[id].shed.id])) as Record<BeastId, MaterialId>;
export type SpotId = typeof SPOTS[number]['id'];
export type Vec = { x: number; z: number };
export type Input = { x: number; z: number; sprint: boolean; bonk: boolean; charge: boolean; roll: boolean; lock: boolean; previous: boolean; next: boolean; use: boolean };
export const NO_INPUT: Input = { x: 0, z: 0, sprint: false, bonk: false, charge: false, roll: false, lock: false, previous: false, next: false, use: false };
export type Pouch = Record<MaterialId | ItemId, number>;
/** `ring` is the items carried into a hunt, in ring order; `snack` is packed for the next hunt. */
export type Profile = { hero: HeroId | null; levels: Record<HeroId, number>; pouch: Pouch; ring: ItemId[]; snack: SnackId | null; naps: Record<BeastId, number>; won: boolean; hunts: number };
export type Hero = Vec & { face: number; fluff: number; maxFluff: number; speed: number; roll: number; rollX: number; rollZ: number; rollCd: number; invincible: number; charge: number; swing: number; heavy: boolean; landed: boolean; cooldown: number; slow: number; hidden: number };
export type BeastState = 'roam' | 'windup' | 'charge' | 'hop' | 'tongue' | 'cloud' | 'circle' | 'swoop' | 'sweep' | 'pounce' | 'shake' | 'rest' | 'dizzy' | 'stuck' | 'nap';
export type Beast = Vec & { id: BeastId; grump: number; maxGrump: number; face: number; state: BeastState; t: number; duration: number; attack: BeastState; aim: Vec; start: Vec; dir: Vec; phase: number; cycle: number; dizzy: number; part: number; broken: boolean; bonks: number; flash: number; height: number; grumpy: boolean; drowsy: number };
export type Obstacle = Vec & { r: number; kind: 'tree' | 'rock' };
export type Shot = Vec & { id: number; dx: number; dz: number; life: number; power: number; heavy: boolean; buddy: boolean };
export type Drop = Vec & { id: number; material: MaterialId; count: number };
export type GatherSpot = Vec & { id: number; material: MaterialId; count: number; done: boolean };
export type Cloud = Vec & { life: number; r: number };
export type Fx = Vec & { id: number; kind: 'bonk' | 'dust' | 'dizzy' | 'berry' | 'part' | 'nap'; t: number; text: string };
export type HuntEvent = { kind: 'bonk' | 'dizzy' | 'berry' | 'part' | 'nap' | 'bump' | 'shoot' | 'item' | 'interact' | 'grumpy' | 'sniff' | 'order' | 'gather' | 'trap' | 'craft'; spot?: SpotId };
export type Mode = 'village' | 'hunt' | 'nap' | 'calm' | 'camp' | 'victory';
const countRecord = (): Record<BeastId, number> => ({ bristleback: 0, puffwart: 0, skreel: 0, hornclack: 0, frostmane: 0 });
const emptyPouch = () => Object.fromEntries([...MATERIAL_IDS, ...ITEM_IDS].map((id) => [id, 0])) as Pouch;
export const freshProfile = (): Profile => ({ hero: null, levels: { dora: 1, enzo: 1 }, pouch: emptyPouch(), ring: [...DEFAULT_RING], snack: null, naps: countRecord(), won: false, hunts: 0 });
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
export const distance = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.z - b.z);
const faceTo = (a: Vec, b: Vec) => Math.atan2(-(b.z - a.z), b.x - a.x);
const direction = (a: Vec, b: Vec): Vec => { const d = distance(a, b) || 1; return { x: (b.x - a.x) / d, z: (b.z - a.z) / d }; };
const hero = (maxFluff = 100): Hero => ({ x: 0, z: 7, face: Math.PI / 2, fluff: maxFluff, maxFluff, speed: 0, roll: -1, rollX: 0, rollZ: -1, rollCd: 0, invincible: 0, charge: 0, swing: -1, heavy: false, landed: false, cooldown: 0, slow: 0, hidden: 0 });
const buddy = () => ({ x: -1.5, z: 8.5, face: Math.PI / 2, speed: 0, swing: -1, cooldown: 1, berry: 3, gather: 0, gatherT: 0 });
export const plural = (n: number, name: string) => n === 1 ? name : name.endsWith('y') ? `${name.slice(0, -1)}ies` : `${name}s`;
/** Distance from a point to a finite marked attack lane. */
export function laneDistance(p: Vec, a: Vec, b: Vec) {
  const x = b.x - a.x, z = b.z - a.z, d = x * x + z * z;
  const t = d ? clamp(((p.x - a.x) * x + (p.z - a.z) * z) / d, 0, 1) : 0;
  return Math.hypot(p.x - a.x - x * t, p.z - a.z - z * t);
}

export class HuntGame {
  profile = freshProfile();
  mode: Mode = 'village';
  hero = hero();
  buddy = buddy();
  beast: Beast | null = null;
  obstacles: Obstacle[] = [];
  shots: Shot[] = [];
  drops: Drop[] = [];
  clouds: Cloud[] = [];
  fx: Fx[] = [];
  events: HuntEvent[] = [];
  /** The ring slot picked with Q/E. */
  item = 0;
  /** This hunt's area, gathering spots and the leader's gathering in progress (spot id and seconds). */
  area: AreaId = 'meadow';
  spots: GatherSpot[] = [];
  gathering: { spot: number; t: number } | null = null;
  /** One sticky sap trap on the ground at a time. */
  trap: Vec | null = null;
  /** The snack eaten for this hunt, and the materials from the last nap's reward. */
  snack: SnackId | null = null;
  reward: MaterialId[] = [];
  unlockedFinalHunts = false;
  locked = false;
  /** What the buddy does; 'bonk' is the starting order. Held Tab plus Q/E changes it. */
  order: BuddyOrder = 'bonk';
  /** Seconds the sniff trail stays lit; out of sight for a second keeps it lit. */
  sniff = 0;
  unseen = 0;
  paused = false;
  time = 0;
  hitstop = 0;
  shake = 0;
  revision = 0;
  note = 'Welcome to Clover Camp. Pick a friend, then visit the hunt board.';
  lastHunt: BeastId = 'bristleback';
  seed: number;
  rng: number;
  private id = 0;
  private last: Input = { ...NO_INPUT };
  private resultTime = 0;
  private ordered = false;

  constructor(seed = 39) { this.seed = seed >>> 0; this.rng = this.seed; this.makeMeadow(); }
  random() { this.rng = (Math.imul(this.rng, 1664525) + 1013904223) >>> 0; return this.rng / 4294967296; }
  get heroId(): HeroId { return this.profile.hero ?? 'dora'; }
  get buddyId(): HeroId { return this.heroId === 'dora' ? 'enzo' : 'dora'; }
  get uniqueNaps() { return BEAST_IDS.filter((id) => this.profile.naps[id] > 0).length; }
  /** Beast materials the Forge can spend. */
  get materialTotal() { return FORGE_MATERIALS.reduce((n, id) => n + this.profile.pouch[id], 0); }
  /** The Pantry offers items and snacks by story chapter. Until story mode, that is the chapter of the next beast to befriend. */
  get chapter() { return Math.min(5, 1 + this.uniqueNaps); }
  get ring() { return this.profile.ring; }
  get ringItem(): ItemId | undefined { return this.profile.ring[this.item]; }
  /** A beast's materials in the pouch, for the Beast Book. */
  beastMaterials(id: BeastId) { return BEAST_MATERIALS[id].reduce((n, m) => n + this.profile.pouch[m], 0); }
  unlocked(id: BeastId) { return BEAST_IDS.indexOf(id) < 3 || this.uniqueNaps >= 3 || this.profile.won; }
  chooseHero(id: HeroId) { if (this.mode !== 'village' || !['dora', 'enzo'].includes(id)) return false; this.profile.hero = id; this.note = `${id === 'dora' ? 'Dora' : 'Enzo'} leads the way. Visit the hunt board, Pantry, Forge, or Beast Book.`; this.revision++; return true; }
  upgradeCost(id: HeroId) { return this.profile.levels[id] >= 3 ? 0 : this.profile.levels[id] === 1 ? 6 : 12; }
  upgrade(id: HeroId) {
    if (!['dora', 'enzo'].includes(id) || this.mode !== 'village') return false;
    let cost = this.upgradeCost(id);
    if (!cost || this.materialTotal < cost) return false;
    for (const key of FORGE_MATERIALS) { const n = Math.min(cost, this.profile.pouch[key]); this.profile.pouch[key] -= n; cost -= n; }
    this.profile.levels[id]++; this.revision++;
    this.note = `${id === 'dora' ? 'Acorn Hammer' : 'Seed Bow'} is now level ${this.profile.levels[id]}!`;
    return true;
  }
  canCraft(id: ItemId) { const it = ITEMS[id]; return this.mode === 'village' && !!it && this.chapter >= it.chapter && this.profile.pouch[id] < it.max && canAfford(this.profile.pouch, it.recipe); }
  /** Makes one batch of an item at the Pantry from its recipe. */
  craft(id: ItemId) {
    if (!this.canCraft(id)) return false;
    const it = ITEMS[id], p = pay(this.profile.pouch, it.recipe) as Pouch;
    p[id] = Math.min(it.max, p[id] + it.makes); this.profile.pouch = p;
    this.note = `${it.name} made! You have ${p[id]}.`; this.events.push({ kind: 'craft' }); this.revision++;
    return true;
  }
  canEat(id: SnackId) { const s = SNACKS[id]; return this.mode === 'village' && !!s && !this.profile.snack && this.chapter >= s.chapter && canAfford(this.profile.pouch, s.cost); }
  /** Packs one snack for the next hunt; it lasts that hunt only. */
  eatSnack(id: SnackId) {
    if (!this.canEat(id)) return false;
    this.profile.pouch = pay(this.profile.pouch, SNACKS[id].cost) as Pouch; this.profile.snack = id;
    this.note = `${SNACKS[id].name} packed for your next hunt!`; this.events.push({ kind: 'craft' }); this.revision++;
    return true;
  }
  /** Puts an item in the hunt ring or takes it out, keeping the ring's order, at least one item and at most six. */
  toggleRing(id: ItemId) {
    if (this.mode !== 'village' || !RING_ITEMS.includes(id)) return false;
    const ring = this.profile.ring, inRing = ring.includes(id);
    if (inRing ? ring.length <= 1 : ring.length >= RING_SIZE) return false;
    this.profile.ring = RING_ITEMS.filter((r) => r === id ? !inRing : ring.includes(r)); this.item = 0; this.revision++;
    return true;
  }
  nearestSpot() { return SPOTS.find((s) => distance(this.hero, s) < 3) ?? null; }
  /** The closest gathering spot within reach of the leader that still has something to gather. */
  nearestGather() { return this.mode === 'hunt' ? this.spots.find((s) => !s.done && distance(this.hero, s) < GATHER_REACH) ?? null : null; }
  clearInput() { this.last = { ...NO_INPUT }; this.hero.charge = 0; this.hero.speed = 0; }
  /** This hunt's gathering spots, clear of trees, rocks and each other. A chancy spot (the sparkling glimmer spot) may not appear. */
  private makeSpots() {
    this.spots = [];
    for (const g of GATHER[this.area]) for (let i = 0; i < g.spots; i++) {
      const present = g.chance === undefined || this.random() < g.chance;
      let at: Vec | null = null;
      for (let tries = 0; tries < 40 && !at; tries++) {
        const a = this.random() * Math.PI * 2, r = 6 + this.random() * 9, c = { x: Math.cos(a) * r, z: Math.sin(a) * r };
        if (this.obstacles.every((o) => distance(c, o) > o.r + 1.6) && this.spots.every((s) => distance(c, s) > 3) && distance(c, { x: 0, z: 7 }) > 3 && distance(c, { x: 0, z: -3 }) > 4) at = c;
      }
      if (present && at) this.spots.push({ ...at, id: ++this.id, material: g.id, count: g.each, done: false });
    }
  }
  private makeMeadow() {
    this.obstacles = [];
    for (let i = 0; i < 26; i++) {
      const a = i / 26 * Math.PI * 2, r = 21 + this.random() * 5;
      this.obstacles.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, r: 0.6 + this.random() * 0.3, kind: 'tree' });
    }
    // Clear entry and centre; these in-arena obstacles are also boar dizzy opportunities.
    this.obstacles.push({ x: -9, z: 1, r: 0.8, kind: 'tree' }, { x: 9, z: -3, r: 0.9, kind: 'tree' }, { x: -6, z: -9, r: 1.3, kind: 'rock' }, { x: 7, z: 8, r: 1.1, kind: 'rock' });
  }
  startHunt(id: BeastId) {
    if (!BEAST_IDS.includes(id) || !this.profile.hero || !['village', 'camp', 'calm', 'victory'].includes(this.mode) || !this.unlocked(id)) return false;
    this.unlockedFinalHunts = false;
    this.snack = this.profile.snack; this.profile.snack = null;
    this.lastHunt = id; this.mode = 'hunt'; this.hero = hero(100 + (this.snack ? SNACKS[this.snack].effect.maxFluff ?? 0 : 0)); this.buddy = buddy();
    const grump = BEASTS[id].grump;
    this.beast = { id, x: 0, z: -3, face: -Math.PI / 2, grump, maxGrump: grump, state: id === 'skreel' ? 'circle' : 'roam', t: 0, duration: 2.4, attack: 'charge', aim: { x: 0, z: 0 }, start: { x: 0, z: -3 }, dir: { x: 0, z: 1 }, phase: 1, cycle: 0, dizzy: 0, part: 0, broken: false, bonks: 0, flash: 0, height: 0, grumpy: false, drowsy: 0 };
    this.shots = []; this.drops = []; this.clouds = []; this.fx = []; this.item = 0; this.sniff = 0; this.unseen = 0; this.locked = true; this.paused = false; this.hitstop = 0; this.shake = 0; this.last = { ...NO_INPUT }; this.resultTime = 0;
    this.gathering = null; this.trap = null; this.reward = []; this.area = HUNT_AREA[id];
    this.profile.pouch.fluffberry = Math.max(this.profile.pouch.fluffberry, CAMP_BERRIES);
    this.profile.hunts++; this.makeMeadow(); this.makeSpots(); this.revision++; this.note = BEASTS[id].tip;
    return true;
  }
  returnVillage() {
    this.mode = 'village'; this.beast = null; this.hero = hero(); this.hero.z = 4; this.buddy.x = -1.5; this.buddy.z = 5.5;
    this.drops = []; this.shots = []; this.clouds = []; this.fx = []; this.spots = []; this.gathering = null; this.trap = null; this.snack = null; this.sniff = 0; this.unseen = 0; this.locked = false; this.paused = false; this.last = { ...NO_INPUT }; this.revision++;
    this.note = 'Materials tucked away safely. Visit the Pantry, Forge, Beast Book, or hunt board.';
  }
  private effect(kind: Fx['kind'], at: Vec, text = '') { this.fx.push({ ...at, kind, id: ++this.id, t: 0, text }); }
  private move(p: Vec, dx: number, dz: number, radius: number) {
    p.x += dx; p.z += dz;
    for (let pass = 0; pass < 2; pass++) {
      const obstacles = this.mode === 'village' ? [...this.obstacles, ...SPOTS.map((s) => ({ ...s, r: s.id === 'board' ? 1.3 : 1.8 }))] : this.obstacles;
      for (const o of obstacles) {
        const d = distance(p, o), r = o.r + radius;
        if (d < r) { const nx = d > 0.0001 ? (p.x - o.x) / d : 1, nz = d > 0.0001 ? (p.z - o.z) / d : 0; p.x = o.x + nx * r; p.z = o.z + nz * r; }
      }
      const d = Math.hypot(p.x, p.z), limit = ARENA_RADIUS - radius;
      if (d > limit) { p.x *= limit / d; p.z *= limit / d; }
    }
  }
  private drop(at: Vec, material: MaterialId, count: number) {
    this.drops.push({ id: ++this.id, x: at.x + (this.random() - 0.5) * 1.4, z: at.z + (this.random() - 0.5) * 1.4, material, count });
  }
  /** Adds to the pouch; materials stop at 99 and items at their carry limit. */
  private gain(id: MaterialId | ItemId, count: number) { this.profile.pouch[id] = Math.min(cap(id), this.profile.pouch[id] + count); this.revision++; }
  private collect(all = false, by: Vec = this.hero, reach = 2.6) {
    this.drops = this.drops.filter((d) => {
      if (!all && distance(by, d) > reach) return true;
      this.gain(d.material, d.count);
      this.effect('part', d, `+${d.count} ${plural(d.count, MATERIALS[d.material].name)}`); return false;
    });
  }
  /** Finishes gathering a spot, by the leader or the buddy. */
  private gather(spot: GatherSpot, by: Vec) {
    spot.done = true; this.gain(spot.material, spot.count);
    const name = plural(spot.count, MATERIALS[spot.material].name);
    this.effect('part', spot, `+${spot.count} ${name}`); this.events.push({ kind: 'gather' });
    this.note = `${by === this.hero ? 'You' : this.buddyId === 'dora' ? 'Dora' : 'Enzo'} gathered ${spot.count} ${name.toLowerCase()}.`;
  }
  /** Builds the dizzy meter; a full meter makes the beast dizzy. Berry Stack adds 10% to every hit. */
  private addDizzy(amount: number, hit = true) {
    const b = this.beast!; b.dizzy += amount * (hit && this.snack ? 1 + (SNACKS[this.snack].effect.dizzyBonus ?? 0) : 1);
    if (b.dizzy >= DIZZY_FULL) { this.makeDizzy(); b.dizzy = 0; }
  }
  /** A front-shell block is based on the actual bonk origin, including arrows and the buddy. */
  bonkBeast(power: number, heavy: boolean, from: Vec, buddy = false) {
    const b = this.beast;
    if (!b || this.mode !== 'hunt' || b.grump <= 0 || !Number.isFinite(power) || power <= 0) return false;
    const dir = direction(b, from), front = dir.x * Math.cos(b.face) + dir.z * -Math.sin(b.face);
    if (b.id === 'hornclack' && front > 0.45 && b.state !== 'dizzy') { this.effect('dust', b, 'Try the sides!'); this.note = 'The front shell is sturdy. Circle to the sides or back.'; return false; }
    if (b.id === 'skreel' && b.height > 1.8 && (buddy ? this.buddyId : this.heroId) === 'dora') return false;
    const wasDizzy = b.state === 'dizzy';
    const amount = power * (wasDizzy ? 1.7 : 1);
    b.grump = Math.max(0, b.grump - amount); b.flash = 0.18; b.bonks++; b.part += amount;
    if (b.id === 'frostmane') {
      const next = b.grump < b.maxGrump / 3 ? 3 : b.grump < b.maxGrump * 2 / 3 ? 2 : 1;
      if (next > b.phase && b.grump > 0) { b.phase = next; this.note = `Frostmane mood ${next}: ${next === 2 ? 'watch for the icy mane shake' : 'quick pounces, with a warning before each one'}!`; }
    }
    if (!b.grumpy && b.grump > 0 && b.grump < b.maxGrump * GRUMPY_AT) {
      b.grumpy = true; this.events.push({ kind: 'grumpy' }); this.effect('dust', b, 'Extra Grumpy!');
      this.note = `${BEASTS[b.id].name} is Extra Grumpy! Steamy ears, quicker paws and quicker warnings. Nearly nap time.`;
    }
    if (!buddy) { this.hitstop = heavy ? 0.11 : 0.08; this.shake = heavy ? 0.3 : 0.15; if (this.hero.hidden > 0) { this.hero.hidden = 0; this.note = 'Peekaboo! The bonk gave away your smoky hiding spot.'; } }
    this.events.push({ kind: 'bonk' }); this.effect('bonk', b, wasDizzy ? 'Big bonk!' : 'Bonk!');
    const shed = rollShed(() => this.random(), b.id); if (shed) this.drop(b, shed, 1);
    if (!b.broken && b.part >= b.maxGrump * 0.32) { b.broken = true; this.drop(b, PART_DROP[b.id].id, PART_DROP[b.id].count); this.events.push({ kind: 'part' }); this.effect('part', b, `${BEASTS[b.id].part} popped off!`); }
    if (heavy && b.grump > 0 && !wasDizzy) this.addDizzy(buddy ? 30 : 50);
    if (b.grump <= 0) {
      b.state = 'nap'; b.t = 0; b.height = 0; this.mode = 'nap'; this.resultTime = 0;
      const before = this.uniqueNaps;
      this.profile.naps[b.id]++; this.unlockedFinalHunts = before === 2 && this.uniqueNaps === 3; this.profile.won ||= b.id === 'frostmane';
      // Three commons and a rare roll (two with a Lucky Seed Bun); the pop-off part already dropped its own material.
      this.reward = rollCalm(() => this.random(), b.id, [], this.snack ? SNACKS[this.snack].effect.bonusRareRolls ?? 0 : 0);
      for (const m of this.reward) this.drop(b, m, 1);
      this.collect(true); this.gathering = null; this.revision++;
      this.events.push({ kind: 'nap' }); this.effect('nap', b, 'Calmed. Time for a nap!'); this.note = `${BEASTS[b.id].name} is going to the sanctuary for a lovely nap.`;
    }
    return true;
  }
  makeDizzy(seconds = 3.2) {
    const b = this.beast; if (!b || this.mode !== 'hunt' || b.state === 'nap') return;
    b.state = 'dizzy'; b.t = 0; b.duration = seconds; b.height = 0;
    this.effect('dizzy', b, 'Dizzy!'); this.events.push({ kind: 'dizzy' }); this.note = 'Dizzy! A lovely opening for a big bonk.';
  }
  bumpHero(amount: number, from: Vec) {
    const h = this.hero;
    if (this.mode !== 'hunt' || h.invincible > 0 || (h.roll >= 0 && h.roll < 0.32)) return false;
    h.fluff = Math.max(0, h.fluff - amount); h.invincible = 1.4; this.gathering = null;
    const d = direction(from, h); this.move(h, d.x * 1.5, d.z * 1.5, 0.45); this.shake = 0.24;
    this.events.push({ kind: 'bump' }); this.note = 'A little bump! Roll through the orange warning or use a berry.';
    if (h.fluff <= 0) { this.collect(true); this.mode = 'camp'; this.paused = false; this.locked = false; h.x = 0; h.z = 7; this.buddy.x = -1.5; this.buddy.z = 8.5; this.shots = []; this.note = 'Tuckered out. Back at camp, with every gathered material safe. Try again whenever you like.'; this.revision++; }
    return true;
  }
  /** Uses the picked ring item. Nothing is spent when it can't help yet, and the note says why. */
  useItem() {
    const id = this.ringItem, h = this.hero, b = this.beast;
    if (this.mode !== 'hunt' || !id) return false;
    const it = ITEMS[id], e = it.effect, refuse = (note: string) => { this.note = note; return false; };
    if (this.profile.pouch[id] <= 0) return refuse(`No ${plural(2, it.name).toLowerCase()} left. Make more at the Pantry.`);
    const near = (reach: number) => !!b && b.state !== 'nap' && distance(h, b) <= reach;
    if (e.kind === 'heal') {
      if (h.fluff >= h.maxFluff) return refuse('Your Fluff is already full. Save that berry for later!');
      h.fluff = Math.min(h.maxFluff, h.fluff + e.fluff); this.effect('berry', h, `+${e.fluff} Fluff`); this.note = `${it.name}! +${e.fluff} Fluff.`;
    } else if (e.kind === 'drowsy') {
      if (!near(SLEEPY_REACH)) return refuse('Get within ten steps of the beast to toss a sleepy seed.');
      b!.drowsy = e.seconds; this.effect('dust', b!, 'Drowsy…'); this.note = `Sleepy seed! The beast moves ${Math.round(e.slow * 100)}% slower for ${e.seconds} seconds.`;
    } else if (e.kind === 'dizzy') {
      if (!near(BELL_REACH) || b!.state === 'dizzy' || b!.state === 'stuck') return refuse('Ring the dizzy bell right beside the beast, when it isn’t dizzy or stuck already.');
      this.note = `Ding! The dizzy bell adds ${e.amount} Dizzy.`; this.effect('dizzy', b!, 'Ding!'); this.addDizzy(e.amount, false);
    } else if (e.kind === 'trap') {
      if (this.trap) return refuse('One sticky sap trap at a time. Lead the beast over the one on the ground!');
      this.trap = { x: h.x, z: h.z }; this.note = 'Sticky sap set! Lead the beast over it for a sticky four seconds.';
    } else if (e.kind === 'hide') {
      h.hidden = e.seconds; this.effect('dust', h, 'Poof!'); this.note = `Poof! Hidden in smoke for ${e.seconds} seconds. The beast loses track and wanders. A bonk gives you away.`;
    } else if (e.kind === 'track') {
      this.sniff = Math.max(this.sniff, e.seconds); this.note = `Enzo sniffs the pathfinder acorn. Glowing pawprints lead to the beast for ${e.seconds} seconds.`;
    } else return false;
    this.profile.pouch[id]--; this.events.push({ kind: 'item' }); this.revision++;
    return true;
  }
  /** Steps the buddy's order through stay close, go bonk and gather. */
  commandBuddy(step: 1 | -1) {
    if (this.mode !== 'hunt' && this.mode !== 'village') return false;
    this.order = ORDERS[(ORDERS.indexOf(this.order) + step + ORDERS.length) % ORDERS.length];
    const name = this.buddyId === 'dora' ? 'Dora' : 'Enzo';
    this.note = this.order === 'close' ? `${name} stays close by your side.` : this.order === 'bonk' ? `${name} goes to bonk the beast.` : `${name} gathers any materials on the ground.`;
    this.events.push({ kind: 'order' }); this.revision++;
    return true;
  }
  /** The beast is in sight when it is within SIGHT and no tree or rock stands between it and the leader. */
  inSight() {
    const b = this.beast; if (!b) return true;
    return distance(this.hero, b) <= SIGHT && !this.obstacles.some((o) => laneDistance(o, this.hero, b) < o.r);
  }
  /** Enzo's pawprint trail from the leader towards the beast, skipping prints under trees and rocks. */
  trail(): (Vec & { face: number })[] {
    const b = this.beast, h = this.hero; if (!b || this.sniff <= 0) return [];
    const length = distance(h, b), d = direction(h, b), face = Math.atan2(-d.z, d.x), out: (Vec & { face: number })[] = [];
    for (let i = 0, at = 1.2; at < length - 2.5 && i < 16; i++, at += 1.1) {
      const side = i % 2 ? 0.2 : -0.2, p = { x: h.x + d.x * at - d.z * side, z: h.z + d.z * at + d.x * side, face };
      if (!this.obstacles.some((o) => distance(p, o) < o.r + 0.2)) out.push(p);
    }
    return out;
  }
  private attack(heavy: boolean) {
    const h = this.hero;
    if (h.cooldown > 0 || h.roll >= 0 || h.swing >= 0) return;
    h.heavy = heavy; h.swing = 0; h.landed = false; h.cooldown = this.heroId === 'dora' ? heavy ? 0.95 : 0.67 : heavy ? 0.8 : 0.43;
    if (this.beast) h.face = faceTo(h, this.beast);
  }
  private shoot(from: Vec, heavy: boolean, buddy: boolean) {
    if (!this.beast) return;
    const d = direction(from, this.beast), level = this.profile.levels[buddy ? this.buddyId : this.heroId];
    this.shots.push({ ...from, id: ++this.id, dx: d.x * 20, dz: d.z * 20, life: 1.5, power: (buddy ? 5 : heavy ? 20 : 9) * (1 + (level - 1) * 0.32), heavy, buddy });
    this.events.push({ kind: 'shoot' });
  }
  private stepHero(dt: number, input: Input) {
    const h = this.hero, pressed = (k: keyof Input) => !!input[k] && !this.last[k];
    for (const k of ['invincible', 'cooldown', 'slow', 'hidden'] as const) h[k] = Math.max(0, h[k] - dt);
    // Hay Nibble: rolls recover 25% faster.
    h.rollCd = Math.max(0, h.rollCd - dt * (1 + (this.snack ? SNACKS[this.snack].effect.staminaRegen ?? 0 : 0)));
    // Tab toggles lock-on when it is let go, unless Q or E gave the buddy an order while it was held.
    if (pressed('lock')) this.ordered = false;
    if (input.lock && (pressed('next') || pressed('previous'))) { this.commandBuddy(pressed('next') ? 1 : -1); this.ordered = true; }
    else {
      const slots = Math.max(1, this.profile.ring.length);
      if (pressed('next')) this.item = (this.item + 1) % slots;
      if (pressed('previous')) this.item = (this.item + slots - 1) % slots;
    }
    if (!input.lock && this.last.lock && !this.ordered) this.locked = !this.locked;
    // F at a gathering spot gathers; anywhere else it uses the picked item.
    if (pressed('use')) {
      if (this.mode === 'village') { const s = this.nearestSpot(); if (s) this.events.push({ kind: 'interact', spot: s.id }); }
      else if (this.gathering) { /* Already gathering. */ }
      else { const spot = this.nearestGather(); if (spot) { this.gathering = { spot: spot.id, t: 0 }; this.note = `Gathering ${plural(2, MATERIALS[spot.material].name).toLowerCase()}… stay still for a moment.`; } else this.useItem(); }
    }
    const len = Math.hypot(input.x, input.z), dx = len > 1 ? input.x / len : input.x, dz = len > 1 ? input.z / len : input.z;
    if (this.gathering) {
      // Moving, rolling or swinging stops gathering; a bump does too.
      const spot = this.spots.find((s) => s.id === this.gathering!.spot);
      if (!spot || spot.done || len > 0.1 || input.roll || input.bonk || input.charge || h.swing >= 0) this.gathering = null;
      else if ((this.gathering.t += dt) >= GATHER_TIME) { this.gathering = null; this.gather(spot, h); }
    }
    if (pressed('roll') && h.rollCd <= 0) { h.roll = 0; h.rollCd = 0.85; h.rollX = len > 0.1 ? dx : Math.cos(h.face); h.rollZ = len > 0.1 ? dz : -Math.sin(h.face); h.swing = -1; h.charge = 0; this.effect('dust', h); }
    if (h.roll >= 0) {
      h.roll += dt; const speed = 6 + 6 * (1 - Math.min(1, h.roll / 0.46)); this.move(h, h.rollX * speed * dt, h.rollZ * speed * dt, 0.45); h.speed = 7;
      if (h.roll >= 0.46) h.roll = -1;
    } else {
      const speed = (input.sprint ? 6.8 : 4.4) * (h.slow ? 0.55 : 1) * (h.swing >= 0 ? 0.4 : input.charge ? 0.6 : 1);
      this.move(h, dx * speed * dt, dz * speed * dt, 0.45); h.speed = len > 0.1 ? speed : 0;
      if (len > 0.1) h.face = Math.atan2(-dz, dx); else if (this.locked && this.beast && this.mode === 'hunt') h.face = faceTo(h, this.beast);
      if (this.mode === 'hunt') {
        if (input.charge && h.swing < 0 && h.cooldown <= 0) h.charge = Math.min(1.4, h.charge + dt);
        else if (!input.charge && this.last.charge) { this.attack(h.charge >= 0.35); h.charge = 0; }
        else if (input.bonk && !input.charge) this.attack(false);
      }
    }
    if (h.swing >= 0) {
      h.swing += dt;
      const contact = this.heroId === 'dora' ? 0.24 : 0.12;
      if (h.swing >= contact && !h.landed) {
        h.landed = true;
        if (this.heroId === 'enzo') this.shoot(h, h.heavy, false);
        else if (this.beast && distance(h, this.beast) < 3.65) this.bonkBeast((h.heavy ? 27 : 14) * (1 + (this.profile.levels.dora - 1) * 0.35), h.heavy, h);
        this.effect('dust', h);
      }
      if (h.swing > (this.heroId === 'dora' ? 0.6 : 0.35)) h.swing = -1;
    }
    if (this.beast && this.mode === 'hunt' && distance(h, this.beast) < 1.85) {
      const gap = distance(h, this.beast), d = gap < 0.0001 ? { x: 1, z: 0 } : direction(this.beast, h);
      this.move(h, d.x * (1.85 - gap), d.z * (1.85 - gap), 0.45);
    }
  }
  private stepBuddy(dt: number) {
    const p = this.buddy, h = this.hero, b = this.beast;
    p.cooldown -= dt; p.berry -= dt;
    if (p.swing >= 0) { p.swing += dt; if (p.swing > 0.6) p.swing = -1; }
    if (this.mode === 'hunt' && h.fluff <= 45 && p.berry <= 0) { h.fluff = Math.min(h.maxFluff, h.fluff + 28); p.berry = 10; this.events.push({ kind: 'berry' }); this.effect('berry', h, 'Buddy berry! +28 Fluff'); this.note = `${this.buddyId === 'dora' ? 'Dora' : 'Enzo'} tossed you a healing berry!`; }
    // Go bonk helps once the leader is near the beast; stay close helps only from the leader's side; gather never bonks.
    const helping = this.mode === 'hunt' && b && (this.order === 'bonk' ? distance(h, b) < 11 : this.order === 'close');
    const chase = helping && this.order === 'bonk' && this.buddyId === 'dora';
    const gathering = this.order === 'gather' && this.mode === 'hunt';
    const pickup = gathering ? this.drops.reduce<Drop | null>((best, d) => !best || distance(p, d) < distance(p, best) ? d : best, null) : null;
    // With no drops left, Gather visits the gathering spots the leader isn't already busy with.
    const spot = gathering && !pickup ? this.spots.filter((s) => !s.done && s.id !== this.gathering?.spot).reduce<GatherSpot | null>((best, s) => !best || distance(p, s) < distance(p, best) ? s : best, null) : null;
    if (!spot || spot.id !== p.gather) { p.gather = spot?.id ?? 0; p.gatherT = 0; }
    const target = pickup ?? spot ?? (chase ? b! : { x: h.x - 1.4, z: h.z + 1.4 });
    const d = distance(p, target), gap = pickup ? 0.3 : spot ? 1.2 : chase ? 2.7 : 1.2;
    p.speed = d > gap ? Math.min(6, 2 + d) : 0;
    if (d > gap) { const n = direction(p, target); this.move(p, n.x * p.speed * dt, n.z * p.speed * dt, 0.4); p.face = faceTo(p, target); }
    if (helping && b && p.cooldown <= 0 && distance(p, b) < (this.buddyId === 'dora' ? 3.6 : 13)) {
      p.face = faceTo(p, b); p.swing = 0; p.cooldown = 2.3;
      if (this.buddyId === 'enzo') this.shoot(p, false, true); else this.bonkBeast(8 * (1 + (this.profile.levels.dora - 1) * 0.3), true, p, true);
    }
    if (pickup) this.collect(false, p, 1.2);
    if (spot && d <= gap && (p.gatherT += dt) >= GATHER_TIME) { p.gatherT = 0; this.gather(spot, p); }
  }
  private windup() {
    const b = this.beast!;
    b.cycle++; b.phase = b.id === 'frostmane' ? b.grump < b.maxGrump / 3 ? 3 : b.grump < b.maxGrump * 2 / 3 ? 2 : 1 : 1;
    const attacks: Record<BeastId, BeastState[]> = { bristleback: ['charge'], puffwart: ['hop', 'tongue', 'cloud'], skreel: ['swoop'], hornclack: ['sweep', 'charge'], frostmane: ['pounce', 'shake', 'pounce'] };
    const pattern = b.id === 'frostmane' ? b.phase === 1 ? ['pounce'] : b.phase === 2 ? ['pounce', 'shake'] : ['pounce', 'pounce', 'shake'] : attacks[b.id];
    b.attack = pattern[(b.cycle - 1) % pattern.length] as BeastState;
    b.state = 'windup'; b.t = 0; b.duration = b.grumpy ? TELEGRAPH - 0.1 : TELEGRAPH; b.start = { x: b.x, z: b.z }; b.dir = direction(b, this.hero); b.face = faceTo(b, this.hero);
    const length = b.attack === 'charge' || b.attack === 'swoop' ? 12 : b.attack === 'pounce' || b.attack === 'hop' ? Math.min(9, distance(b, this.hero)) : b.attack === 'tongue' ? 7 : 0;
    b.aim = { x: b.x + b.dir.x * length, z: b.z + b.dir.z * length };
    this.effect('dust', b);
    this.note = b.attack === 'shake' || b.attack === 'sweep' || b.attack === 'cloud' ? 'Orange circle! Step outside or roll as it lands.' : 'Orange lane! Step sideways or roll as it arrives.';
  }
  private stepBeast(dt: number) {
    const b = this.beast!, sleepy = ITEMS['sleepy-seed'].effect as { slow: number };
    const pace = (b.grumpy ? GRUMPY_PACE : 1) * (b.drowsy > 0 ? 1 - sleepy.slow : 1);
    b.t += dt; b.flash = Math.max(0, b.flash - dt); b.drowsy = Math.max(0, b.drowsy - dt);
    // A beast on the ground that steps on the sticky sap is stuck where it stands, even mid-charge.
    if (this.trap && b.height < 0.5 && !['dizzy', 'stuck', 'nap'].includes(b.state) && distance(b, this.trap) < TRAP_REACH) {
      const sap = ITEMS['sticky-sap'].effect as { seconds: number };
      b.state = 'stuck'; b.t = 0; b.duration = sap.seconds; b.height = 0; this.trap = null;
      this.effect('dust', b, 'Stuck!'); this.events.push({ kind: 'trap' }); this.note = `Stuck in sticky sap for ${sap.seconds} seconds. Bonk away!`;
      return;
    }
    if (b.state === 'dizzy' || b.state === 'stuck') { b.height = 0; if (b.t >= b.duration) { b.duration = b.state === 'dizzy' ? 1.8 : 1.2; b.state = 'rest'; b.t = 0; } return; }
    if (b.state === 'rest') { b.height = 0; if (b.t >= b.duration) { b.state = b.id === 'skreel' ? 'circle' : 'roam'; b.t = 0; b.duration = b.id === 'frostmane' ? 1.5 : 2.4; } return; }
    if (b.state === 'roam' || b.state === 'circle') {
      // Hidden in smoke, the leader can't be found: the beast wanders a slow loop and starts no new attack.
      const hidden = this.hero.hidden > 0, wander = { x: Math.cos(this.time * 0.35) * 9, z: Math.sin(this.time * 0.35) * 9 };
      if (b.state === 'circle') { b.height = 2.4; this.move(b, Math.cos(this.time * 0.7) * dt * 2.7 * pace, Math.sin(this.time * 0.7) * dt * 2.7 * pace, 1.5); b.face = this.time * -0.7; }
      else { b.height = 0; const goal = hidden ? wander : this.hero, d = distance(b, goal); if (d > (hidden ? 0.5 : 5)) { const n = direction(b, goal); this.move(b, n.x * dt * 1.35 * pace, n.z * dt * 1.35 * pace, 1.5); b.face = faceTo(b, goal); } }
      if (b.t >= b.duration) { if (hidden) b.t = 0; else this.windup(); }
      return;
    }
    if (b.state === 'windup') {
      b.height = b.id === 'skreel' ? 1 + Math.sin(b.t * 8) * 0.2 : 0;
      if (b.t >= b.duration) { b.state = b.attack; b.t = 0; b.duration = b.attack === 'charge' || b.attack === 'swoop' ? distance(b.start, b.aim) / ((b.attack === 'charge' ? 12 : 14) * pace) : b.attack === 'pounce' || b.attack === 'hop' ? 0.72 / pace : 0.65; }
      return;
    }
    const active = b.state;
    if (active === 'charge' || active === 'swoop') {
      const speed = (active === 'charge' ? 12 : 14) * pace;
      const travel = Math.min(distance(b.start, b.aim), b.t * speed);
      const nx = b.start.x + b.dir.x * travel, nz = b.start.z + b.dir.z * travel;
      const obstacle = this.obstacles.some((o) => Math.hypot(nx - o.x, nz - o.z) < o.r + 1.4) || Math.hypot(nx, nz) > ARENA_RADIUS - 1.5;
      if (obstacle) { this.makeDizzy(3.8); return; }
      b.x = nx; b.z = nz; b.height = active === 'swoop' ? Math.max(0, 0.8 - b.t) : 0;
      if (distance(this.hero, b) < 2.5) this.bumpHero(15, b);
    } else if (active === 'pounce' || active === 'hop') {
      const f = Math.min(1, b.t / b.duration), x = b.start.x + (b.aim.x - b.start.x) * f, z = b.start.z + (b.aim.z - b.start.z) * f;
      this.move(b, x - b.x, z - b.z, 1.4); b.height = Math.sin(f * Math.PI) * (active === 'hop' ? 2 : 1.5);
      if (f > 0.75 && distance(this.hero, b) < 3) this.bumpHero(b.id === 'frostmane' ? 17 + b.phase : 12, b);
    } else if (active === 'tongue') {
      if (b.t > 0.18 && b.t < 0.48 && laneDistance(this.hero, b.start, b.aim) < 1.2) this.bumpHero(12, b);
    } else if (active === 'sweep' || active === 'shake') {
      if (b.t > 0.25 && distance(this.hero, b) < (active === 'shake' ? 5 : 4)) this.bumpHero(active === 'shake' ? 14 : 16, b);
    } else if (active === 'cloud' && b.t >= b.duration) {
      this.clouds.push({ x: b.x + b.dir.x * 3, z: b.z + b.dir.z * 3, life: 5, r: 3.5 });
    }
    if (b.t >= b.duration) { b.state = 'rest'; b.t = 0; b.height = 0; b.duration = b.id === 'skreel' ? 4.5 : b.id === 'frostmane' ? 2.3 - b.phase * 0.3 : 2.2; }
  }
  private stepSniff(dt: number) {
    this.sniff = Math.max(0, this.sniff - dt);
    if (this.mode !== 'hunt' || this.inSight()) { this.unseen = 0; return; }
    this.unseen += dt;
    if (this.unseen < 1) return;
    if (this.sniff <= 0) { this.events.push({ kind: 'sniff' }); this.note = 'Enzo sniffs the air. Follow the glowing pawprints to the beast!'; }
    this.sniff = Math.max(this.sniff, 2);
  }
  step(dt: number, input: Input = NO_INPUT) {
    if (this.paused || !Number.isFinite(dt) || dt <= 0) return;
    dt = Math.min(dt, 0.05); this.time += dt; this.shake = Math.max(0, this.shake - dt * 1.8);
    input = { ...input, x: Number.isFinite(input.x) ? clamp(input.x, -1, 1) : 0, z: Number.isFinite(input.z) ? clamp(input.z, -1, 1) : 0 };
    for (const f of this.fx) f.t += dt;
    this.fx = this.fx.filter((f) => f.t < 1.4);
    if (this.mode === 'nap') { this.resultTime += dt; if (this.beast) this.beast.t += dt; if (this.resultTime >= 3.2) this.mode = this.beast?.id === 'frostmane' ? 'victory' : 'calm'; return; }
    if (this.mode !== 'village' && this.mode !== 'hunt') return;
    if (this.hitstop > 0) { this.hitstop = Math.max(0, this.hitstop - dt); return; }
    this.stepHero(dt, input); this.stepBuddy(dt);
    if (this.mode === 'hunt' && this.beast) {
      this.stepBeast(dt);
      this.shots = this.shots.filter((s) => {
        const from = { x: s.x, z: s.z }; s.x += s.dx * dt; s.z += s.dz * dt; s.life -= dt;
        if (laneDistance(this.beast!, from, s) < 1.8) { this.bonkBeast(s.power, s.heavy, from, s.buddy); return false; }
        if (this.obstacles.some((o) => distance(s, o) < o.r)) return false;
        return s.life > 0;
      });
      this.clouds = this.clouds.filter((c) => { c.life -= dt; if (distance(this.hero, c) < c.r) this.hero.slow = 0.4; return c.life > 0; });
      this.collect();
      this.stepSniff(dt);
    }
    this.last = { ...input };
  }
  save() { return { v: 2, seed: this.seed, profile: JSON.parse(JSON.stringify(this.profile)) as Profile }; }
  /** Reload safely returns to camp; gathered materials and all permanent progress are kept. A v1 save's materials move into the pouch. */
  static load(value: unknown): HuntGame {
    const game = new HuntGame();
    if (!value || typeof value !== 'object') return game;
    const s = value as { v?: unknown; seed?: unknown; profile?: Partial<Profile> & { materials?: Partial<Record<BeastId, unknown>> } };
    if ((s.v !== 1 && s.v !== 2) || !s.profile || typeof s.profile !== 'object') return game;
    const p = s.profile, integer = (n: unknown, max: number, fallback = 0) => typeof n === 'number' && Number.isFinite(n) ? clamp(Math.floor(n), 0, max) : fallback;
    game.profile.hero = p.hero === 'dora' || p.hero === 'enzo' ? p.hero : null;
    for (const id of BEAST_IDS) game.profile.naps[id] = integer(p.naps?.[id], 9999);
    if (s.v === 1) for (const id of BEAST_IDS) game.profile.pouch[V1_MATERIAL[id]] = Math.min(99, game.profile.pouch[V1_MATERIAL[id]] + integer(p.materials?.[id], 99999));
    else {
      for (const id of [...MATERIAL_IDS, ...ITEM_IDS]) game.profile.pouch[id] = integer((p.pouch as Partial<Pouch> | undefined)?.[id], cap(id));
      const ring = Array.isArray(p.ring) ? RING_ITEMS.filter((id) => p.ring!.includes(id)).slice(0, RING_SIZE) : [];
      if (ring.length) game.profile.ring = ring;
      game.profile.snack = typeof p.snack === 'string' && SNACK_IDS.includes(p.snack as SnackId) ? p.snack as SnackId : null;
    }
    for (const id of ['dora', 'enzo'] as const) game.profile.levels[id] = clamp(integer(p.levels?.[id], 3, 1), 1, 3);
    game.profile.won = game.profile.naps.frostmane > 0; game.profile.hunts = integer(p.hunts, 999999);
    if (typeof s.seed === 'number' && Number.isFinite(s.seed)) game.seed = game.rng = s.seed >>> 0;
    return game;
  }
}
