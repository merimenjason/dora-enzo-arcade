// Tidepool's rules: a side-on rock pool below Dora and Enzo's summer cottage, looked after through the tides and four
// seasons. Creatures are small agents with simple rules, each in its own niche (anemones catch drifting food, limpets
// and periwinkles graze the algae on the rocks, hermit crabs scavenge scraps and swap shells, shrimp nibble algae and
// flee the blenny, the blenny hunts shrimp, starfish eat mussels, mussels filter the water, seaweed grows in the light).
// The tide goes in and out on a clock: high water brings food, larvae, visitors and fresh cool water; low water cuts
// the pool off, so it warms, its oxygen falls and the gulls come. The player only nudges: rocks, shells, seaweed, the
// driftwood plank, a bucket of seawater, creatures brought in from the basket, and shooing gulls. Twenty-four journal
// pages, six a season, are the goals; the last is the autumn spring tide, when everything is released to the sea.
// Deterministic: a fixed step and a seeded generator, no Math.random and no clock, so a seed and the same actions
// replay a pool exactly. No DOM.

export const SAVE_KEY = 'tidepool-v1';
/** Seconds of play per step at normal speed. */
export const TICK = 0.1;
/** Steps in one tide, high water to high water. */
export const TIDE = 600;
/** The world: 160 × 90 units, y down. The pool's water always fills y 40 to the sand; high tide rises over the rim. */
export const W = 160, H = 90;
export const POOL = { x0: 24, x1: 136, low: 40, high: 29 };
export const ENERGY_MAX = 6, BUCKET_COST = 2, MAX_WEEDS = 8, MAX_ROCKS = 4, MAX_SCRAPS = 14;
/** The plank shades the middle of the pool. */
export const PLANK = { x0: 42, x1: 118 };

export type Sp = 'anemone' | 'limpet' | 'periwinkle' | 'mussel' | 'shrimp' | 'hermit' | 'blenny' | 'starfish';
export type Kind = Sp | 'seaweed' | 'gull' | 'jelly';
export type Food = 'plankton' | 'algae' | 'scraps' | Sp;
export const SPECIES: Sp[] = ['anemone', 'limpet', 'periwinkle', 'mussel', 'shrimp', 'hermit', 'blenny', 'starfish'];
/** Every page of the field guide, in order. */
export const KINDS: Kind[] = ['anemone', 'limpet', 'periwinkle', 'mussel', 'seaweed', 'shrimp', 'hermit', 'blenny', 'starfish', 'gull', 'jelly'];
export type Item = 'rock' | 'shell' | 'seedling' | Sp;
export const ITEMS: Item[] = ['rock', 'shell', 'seedling', ...SPECIES];
export type Tool = 'look' | 'rock' | 'shell' | 'plant' | 'trim' | 'plank' | 'bucket';
export type Weather = 'calm' | 'heat' | 'bloom' | 'storm';

type SpInfo = { name: string; plural: string; cap: number; heat: number; o2: number; resp: number; eats: string; eatenBy: string; note: string };
/** Each creature's numbers: the most the pool holds, the warmth and oxygen it can stand, and how hard it breathes. */
export const INFO: Record<Kind, SpInfo> = {
  anemone: { name: 'Beadlet anemone', plural: 'anemones', cap: 8, heat: 28, o2: 18, resp: 0.003, eats: 'plankton, caught on sticky tentacles at high tide', eatenBy: 'nobody here', note: 'Closes into a jelly bead when the water goes still. Buds a new anemone when it is well fed.' },
  limpet: { name: 'Limpet', plural: 'limpets', cap: 6, heat: 33, o2: 15, resp: 0.002, eats: 'the green film of algae on the rocks', eatenBy: 'nobody here', note: 'Grazes slowly over a rock, then wanders off to a greener one.' },
  periwinkle: { name: 'Periwinkle', plural: 'periwinkles', cap: 6, heat: 33, o2: 15, resp: 0.002, eats: 'algae on the rocks', eatenBy: 'nobody here', note: 'When it dies it leaves its little shell behind, just right for a small hermit crab.' },
  mussel: { name: 'Mussel', plural: 'mussels', cap: 10, heat: 29, o2: 15, resp: 0.0027, eats: 'plankton, filtered from the water', eatenBy: 'starfish', note: 'A bed of mussels clears a cloudy plankton bloom. Settles on rocks from the high tide.' },
  shrimp: { name: 'Rock shrimp', plural: 'shrimp', cap: 8, heat: 26, o2: 30, resp: 0.0045, eats: 'algae and scraps', eatenBy: 'the blenny and gulls', note: 'Darts into the seaweed when the blenny comes hunting.' },
  hermit: { name: 'Hermit crab', plural: 'hermit crabs', cap: 5, heat: 27, o2: 22, resp: 0.0037, eats: 'scraps on the sand', eatenBy: 'gulls', note: 'Grows out of its shell and needs a bigger one: it swaps in a hurry.' },
  blenny: { name: 'Blenny', plural: 'blennies', cap: 3, heat: 27, o2: 35, resp: 0.0075, eats: 'shrimp, and scraps when shrimp are scarce', eatenBy: 'gulls', note: 'Nests in a seaweed forest in summer. Grumpy face, kind heart.' },
  starfish: { name: 'Starfish', plural: 'starfish', cap: 2, heat: 25, o2: 28, resp: 0.0045, eats: 'mussels, very slowly', eatenBy: 'nobody here', note: 'Spawns in the warm high tides of late summer when it has eaten well.' },
  seaweed: { name: 'Seaweed', plural: 'seaweed', cap: MAX_WEEDS, heat: 30, o2: 0, resp: 0, eats: 'sunlight', eatenBy: 'nobody, but shrimp hide in it', note: 'Grows in the light and breathes out oxygen. Dies back in autumn: trim it so it does not rot.' },
  gull: { name: 'Herring gull', plural: 'gulls', cap: 0, heat: 99, o2: 0, resp: 0, eats: 'shrimp, blennies, crabs: anything it can see', eatenBy: 'nobody', note: 'Comes at low tide. Shoo it away! Creatures under the plank or in the weed are hidden from it.' },
  jelly: { name: 'Moon jelly', plural: 'moon jellies', cap: 0, heat: 99, o2: 0, resp: 0, eats: 'plankton', eatenBy: 'nobody here', note: 'A summer visitor that drifts in on the high tide and out again.' },
};
/** The food web: who eats what. */
export const LINKS: [Kind, Food][] = [
  ['anemone', 'plankton'], ['mussel', 'plankton'], ['jelly', 'plankton'],
  ['limpet', 'algae'], ['periwinkle', 'algae'], ['shrimp', 'algae'], ['shrimp', 'scraps'], ['hermit', 'scraps'],
  ['blenny', 'shrimp'], ['blenny', 'scraps'], ['starfish', 'mussel'], ['gull', 'shrimp'], ['gull', 'blenny'], ['gull', 'hermit'],
];
export const linkKey = (a: Kind, b: Food) => `${a}>${b}`;

type SeasonDef = { name: string; light: number; sea: number; air: number; food: number; gulls: number; blurb: string };
export const SEASONS: SeasonDef[] = [
  { name: 'Spring', light: 0.78, sea: 11, air: 15, food: 42, gulls: 1, blurb: 'The pool wakes up. Settle in the hermit crab, plant seaweed and learn who eats whom.' },
  { name: 'Summer', light: 1, sea: 16, air: 22, food: 46, gulls: 2, blurb: 'Long bright days, a heatwave and hungry gulls. The plank and the bucket arrive.' },
  { name: 'Late summer', light: 0.86, sea: 17, air: 20, food: 52, gulls: 2, blurb: 'A plankton bloom, the starfish, and a full pool of every kind.' },
  { name: 'Autumn', light: 0.58, sea: 13, air: 13, food: 40, gulls: 1, blurb: 'Storms, falling weed and new arrivals, until the great spring tide.' },
];
/** When each season's weather comes, by tide within the season (it comes round again every six tides). */
export function weatherFor(season: number, seasonTide: number): Weather {
  const k = seasonTide % 6;
  if (season === 1 && (k === 2 || k === 3)) return 'heat';
  if (season === 2 && (k === 1 || k === 2)) return 'bloom';
  if (season === 3 && k === 3) return 'storm';
  return 'calm';
}

// ---------------------------------------------------------------- the world's things
export type Rock = { id: number; x: number; y: number; r: number; a: number; placed: boolean };
export type Weed = { id: number; x: number; size: number; planted: boolean };
export type Scrap = { id: number; x: number; y: number; amt: number };
export type Shell = { id: number; x: number; y: number; size: number };
export type Agent = {
  id: number; sp: Sp; x: number; y: number; px: number; py: number; dir: 1 | -1;
  e: number; hp: number; age: number; st: string; t: number;
  rock: number; ang: number; seat: number; tx: number; ty: number; size: number; shell: number; hid: boolean; prey: number;
};
export type Gull = { id: number; x: number; y: number; px: number; py: number; st: 'in' | 'eye' | 'dive' | 'out'; t: number; prey: number; side: 1 | -1 };
export type Jelly = { id: number; x: number; y: number; px: number; py: number; t: number; out: boolean };

export type Ev =
  | { k: 'eat'; who: Kind; food: Food; x: number; y: number }
  | { k: 'born'; sp: Sp; x: number; y: number; how: 'larva' | 'bud' | 'brood' | 'fry' | 'spawn' | 'brought' }
  | { k: 'die'; sp: Sp; x: number; y: number; cause: 'eaten' | 'gull' | 'heat' | 'air' | 'hunger' | 'storm' | 'cramped' }
  | { k: 'tide'; high: boolean }
  | { k: 'peak'; tide: number; weather: Weather }
  | { k: 'gull'; id: number; st: 'in' | 'dive' | 'grab' | 'shoo' | 'miss'; x: number; y: number }
  | { k: 'swap'; x: number; y: number; bigger: boolean }
  | { k: 'hide'; x: number; y: number }
  | { k: 'nest'; x: number; y: number }
  | { k: 'spawn'; x: number; y: number }
  | { k: 'find'; item: Item }
  | { k: 'page'; id: number; shells: number }
  | { k: 'season'; season: number }
  | { k: 'weather'; w: Weather; on: boolean }
  | { k: 'storm' }
  | { k: 'act'; t: Tool | 'bring' | 'shoo'; x: number; y: number }
  | { k: 'look'; kind: Kind; level: number; up: boolean }
  | { k: 'plank'; on: boolean }
  | { k: 'release' }
  | { k: 'ending' };

export type Action =
  | { t: 'look'; x: number; y: number }
  | { t: 'bring'; sp: Sp; x: number; y: number }
  | { t: 'rock'; x: number }
  | { t: 'shell'; x: number }
  | { t: 'plant'; x: number }
  | { t: 'trim'; x: number; y?: number }
  | { t: 'plank' }
  | { t: 'bucket' }
  | { t: 'shoo'; x: number; y: number }
  | { t: 'season' }
  | { t: 'release' };

// ---------------------------------------------------------------- the journal's pages
export type PageDef = { id: number; season: number; title: string; goal: string; care: boolean; shells: [number, number]; reward?: Partial<Record<Item, number>>; rewardText?: string };
/** `shells`: done within this many tides of the season starting earns three shells, then two (set from the bots). */
export const PAGES: PageDef[] = [
  { id: 1, season: 0, title: 'First look', goal: 'Look closely at 3 different kinds of creature', care: true, shells: [2, 6], reward: { seedling: 1 }, rewardText: 'a seedling' },
  { id: 2, season: 0, title: 'A new neighbour', goal: 'Bring the hermit crab in from your basket', care: true, shells: [2, 6], reward: { shell: 1 }, rewardText: 'a spare shell' },
  { id: 3, season: 0, title: 'Dinner on the tide', goal: 'See the anemones catch food 6 times at high tide', care: false, shells: [2, 6] },
  { id: 4, season: 0, title: 'Weed garden', goal: 'Plant 2 seaweeds and grow one to full height', care: true, shells: [4, 10], reward: { blenny: 1 }, rewardText: 'a blenny in your basket' },
  { id: 5, season: 0, title: 'Grazers’ rock', goal: 'Place a rock and keep 6 limpets and periwinkles', care: true, shells: [2, 6], reward: { rock: 1 }, rewardText: 'a rock' },
  { id: 6, season: 0, title: 'Hide and seek', goal: 'See a shrimp escape the blenny into the seaweed', care: true, shells: [7, 16], reward: { shrimp: 1 }, rewardText: 'a shrimp' },
  { id: 7, season: 1, title: 'A bit of shade', goal: 'Shade the warm pool with the plank at low tide', care: true, shells: [2, 6] },
  { id: 8, season: 1, title: 'Heatwave', goal: 'Keep 6 kinds alive through the heatwave, losing none', care: true, shells: [5, 12] },
  { id: 9, season: 1, title: 'A bigger shell', goal: 'Help a hermit crab find a bigger shell', care: true, shells: [2, 6], reward: { seedling: 1 }, rewardText: 'a seedling' },
  { id: 10, season: 1, title: 'Seaweed forest', goal: 'Grow 4 tall seaweeds and see a blenny nest in them', care: true, shells: [2, 6] },
  { id: 11, season: 1, title: 'Gull watch', goal: 'Shoo away 3 gulls', care: true, shells: [3, 8], reward: { shell: 1 }, rewardText: 'a shell' },
  { id: 12, season: 1, title: 'Fresh seawater', goal: 'Bring the air back with a bucket when the pool runs short', care: true, shells: [4, 10] },
  { id: 13, season: 2, title: 'The bloom', goal: 'Have 6 mussels filtering during the plankton bloom', care: false, shells: [3, 8], reward: { rock: 1 }, rewardText: 'a rock' },
  { id: 14, season: 2, title: 'Five arms', goal: 'Bring the starfish in from your basket', care: true, shells: [2, 6] },
  { id: 15, season: 2, title: 'Who eats whom', goal: 'Witness 7 different links in the food web', care: false, shells: [2, 6] },
  { id: 16, season: 2, title: 'Full house', goal: 'Have all 9 kinds living in the pool at once', care: true, shells: [2, 6], reward: { shell: 1 }, rewardText: 'a shell' },
  { id: 17, season: 2, title: 'Anemone garden', goal: 'Grow 6 anemones', care: false, shells: [2, 6] },
  { id: 18, season: 2, title: 'Starfish spawn', goal: 'Witness the starfish spawn on a warm high tide', care: true, shells: [3, 8] },
  { id: 19, season: 3, title: 'Storm surge', goal: 'Keep 7 kinds through the storm surge, losing none', care: true, shells: [5, 12] },
  { id: 20, season: 3, title: 'Autumn tidy', goal: 'Trim the dying seaweed 3 times', care: true, shells: [2, 6] },
  { id: 21, season: 3, title: 'New arrivals', goal: 'See 6 young creatures settle on the high tides', care: false, shells: [8, 18] },
  { id: 22, season: 3, title: 'Field guide', goal: 'Finish 8 sketches in the journal', care: true, shells: [2, 6] },
  { id: 23, season: 3, title: 'A steady pool', goal: '3 tides in a row with 7 kinds and air never below 30', care: true, shells: [4, 10] },
  { id: 24, season: 3, title: 'The spring tide', goal: 'Release everyone to the sea on the autumn spring tide', care: true, shells: [99, 99] },
];
/** Pages needed in a season to turn to the next one. */
export const TO_TURN = 4;

// ---------------------------------------------------------------- shapes
/** The sand floor, a shallow bowl. */
export const floorY = (x: number) => { const t = Math.max(-1, Math.min(1, (x - 80) / 56)); return 76 + 7 * (1 - t * t); };
/** The tide's height from 0 (low water) to 1 (high water), for a step. */
export const levelAt = (tick: number) => 0.5 + 0.5 * Math.cos(2 * Math.PI * (((tick + PHASE0) % TIDE) / TIDE));
const PHASE0 = Math.round(TIDE * 0.3);
/** The water's surface for a tide level. */
export const waterY = (level: number) => POOL.low + (POOL.high - POOL.low) * Math.max(0, Math.min(1, (level - 0.2) / 0.8));
const SEATS = [-160, -125, -90, -55, -20].map((d) => (d * Math.PI) / 180);
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

// ---------------------------------------------------------------- saves
export type Settings = { sound: boolean; music: boolean; hints: boolean };
export type Snap = ReturnType<TideGame['snapshot']>;
export type Save = { v: 1; settings: Settings; run: Snap | null; free: Snap | null; ended: boolean; best: number };
export const freshSave = (): Save => ({ v: 1, settings: { sound: true, music: true, hints: true }, run: null, free: null, ended: false, best: 0 });
export function readSave(raw: string | null): Save {
  const s = freshSave();
  if (!raw) return s;
  try {
    const o = JSON.parse(raw) as Partial<Save>;
    if (!o || typeof o !== 'object' || o.v !== 1) return s;
    const st = o.settings as Partial<Settings> | undefined;
    if (st && typeof st === 'object') for (const k of ['sound', 'music', 'hints'] as const) if (typeof st[k] === 'boolean') s.settings[k] = st[k]!;
    if (o.run && TideGame.load(o.run)) s.run = o.run;
    if (o.free && TideGame.load(o.free)) s.free = o.free;
    s.ended = o.ended === true;
    s.best = typeof o.best === 'number' && Number.isFinite(o.best) ? clamp(Math.floor(o.best), 0, 72) : 0;
  } catch { /* a corrupt save: start fresh */ }
  return s;
}

export type Mode = { kind: 'story' } | { kind: 'free'; season: number };
type Stats = {
  catchesHigh: number; escapes: number; swaps: number; nests: number; spawns: number; shoos: number; trims: number; recruits: number;
  planted: number; rocksPlaced: number; buckets: number; bucketLow: number; plankHot: number; brought: Partial<Record<Sp, number>>;
  births: number; deaths: number; eaten: number;
};
const freshStats = (): Stats => ({ catchesHigh: 0, escapes: 0, swaps: 0, nests: 0, spawns: 0, shoos: 0, trims: 0, recruits: 0, planted: 0, rocksPlaced: 0, buckets: 0, bucketLow: 0, plankHot: 0, brought: {}, births: 0, deaths: 0, eaten: 0 });

// ---------------------------------------------------------------- the game
export class TideGame {
  mode: Mode;
  seed: number;
  tick = 0;
  tideNo = 0;
  season = 0;
  seasonStart = 0;
  weather: Weather = 'calm';
  temp = 12;
  o2 = 95;
  food = 30;
  plank = false;
  energy = 3;
  rocks: Rock[] = [];
  weeds: Weed[] = [];
  scraps: Scrap[] = [];
  shells: Shell[] = [];
  agents: Agent[] = [];
  gulls: Gull[] = [];
  jellies: Jelly[] = [];
  basket: Record<Item, number> = { rock: 0, shell: 0, seedling: 0, anemone: 0, limpet: 0, periwinkle: 0, mussel: 0, shrimp: 0, hermit: 0, blenny: 0, starfish: 0 };
  tools: Tool[] = ['look', 'rock', 'shell', 'plant', 'trim'];
  /** Looks per kind: 1 a pencil outline, 2 coloured in, 3 finished with notes. */
  sketch: Partial<Record<Kind, number>> = {};
  lastLook: Partial<Record<Kind, [number, number]>> = {};
  links: string[] = [];
  /** Finished pages: the tide (within its season) it was done and the shells. */
  done: Record<number, { tide: number; shells: number }> = {};
  stats: Stats = freshStats();
  /** This season's counts (reset when the season turns). */
  ss: Stats = freshStats();
  /** The heatwave and storm checks: the kinds alive when it began. */
  trial: { w: Weather; kinds: Kind[] } | null = null;
  steady = 0;
  minO2 = 100;
  release = 0;
  ended = false;
  nextId = 1;
  events: Ev[] = [];
  private rng: number;

  constructor(mode: Mode = { kind: 'story' }, seed = 20261101) {
    this.mode = mode; this.seed = seed >>> 0; this.rng = (seed >>> 0) || 1;
    this.season = mode.kind === 'free' ? clamp(Math.floor(mode.season), 0, 3) : 0;
    this.temp = SEASONS[this.season].sea; this.food = SEASONS[this.season].food * 0.7;
    const rock = (x: number, y: number, r: number) => { this.rocks.push({ id: this.nextId++, x, y, r, a: 0.55, placed: false }); };
    rock(31, 62, 6); rock(50, floorY(50) - 3.5, 7); rock(76, floorY(76) - 2.5, 5); rock(104, floorY(104) - 4, 8); rock(129, 64, 6);
    this.weeds.push({ id: this.nextId++, x: 63, size: 0.55, planted: false }, { id: this.nextId++, x: 91, size: 0.62, planted: false });
    const R = this.rocks;
    this.addSeated('anemone', R[1], 2); this.addSeated('anemone', R[3], 1); this.addSeated('anemone', R[0], 3);
    this.addSeated('mussel', R[3], 3); this.addSeated('mussel', R[3], 4); this.addSeated('mussel', R[4], 1);
    this.addGrazer('limpet', R[1]); this.addGrazer('limpet', R[3]); this.addGrazer('limpet', R[2]);
    this.addGrazer('periwinkle', R[4]); this.addGrazer('periwinkle', R[0]);
    for (const x of [44, 70, 98, 116]) this.addSwimmer('shrimp', x, 60 + this.rand() * 12);
    this.scraps.push({ id: this.nextId++, x: 84, y: floorY(84) - 0.5, amt: 0.6 }, { id: this.nextId++, x: 112, y: floorY(112) - 0.5, amt: 0.6 });
    if (mode.kind === 'story') {
      Object.assign(this.basket, { hermit: 1, seedling: 2, shell: 0, rock: 1 });
    } else {
      this.tools = ['look', 'rock', 'shell', 'plant', 'trim', 'plank', 'bucket'];
      Object.assign(this.basket, { hermit: 2, seedling: 4, shell: 3, rock: 3, blenny: 1, starfish: 1, shrimp: 2 });
      this.energy = ENERGY_MAX;
      for (const k of KINDS) this.sketch[k] = 3;
      this.links = LINKS.map(([a, b]) => linkKey(a, b));
    }
    for (const a of this.agents) { a.px = a.x; a.py = a.y; }
  }

  // ---------------------------------------------------------------- randomness
  rand() {
    let t = (this.rng = (this.rng + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // ---------------------------------------------------------------- reading the pool
  get level() { return levelAt(this.tick); }
  get connected() { return this.level > 0.5 || this.release > 0; }
  get waterY() { return this.release > 0 ? POOL.high - Math.min(8, this.release / 15) : waterY(this.level); }
  /** Where the tide clock's hand is: 0 high water, 0.5 low water. */
  get phase() { return ((this.tick + PHASE0) % TIDE) / TIDE; }
  get seasonTide() { return this.tideNo - this.seasonStart; }
  get light() { return SEASONS[this.season].light * (this.weather === 'storm' ? 0.4 : 1); }
  get air() { return SEASONS[this.season].air + (this.weather === 'heat' ? 10 : 0); }
  get seaFood() { return this.weather === 'bloom' ? 96 : SEASONS[this.season].food; }
  get done24() { return !!this.done[24]; }
  count(sp: Sp) { let n = 0; for (const a of this.agents) if (a.sp === sp) n++; return n; }
  /** The kinds living in the pool (seaweed counts once a frond is past a sprout). */
  kinds(): Kind[] {
    const out: Kind[] = [];
    for (const sp of SPECIES) if (this.agents.some((a) => a.sp === sp)) out.push(sp);
    if (this.weeds.some((w) => w.size >= 0.25)) out.push('seaweed');
    return out;
  }
  weedTop(w: Weed) { return floorY(w.x) - (5 + w.size * 24); }
  algaeSum() { let s = 0; for (const r of this.rocks) s += r.a * r.r / 6; return s; }
  weedMass() { let s = 0; for (const w of this.weeds) s += w.size; return s; }
  pagesIn(season: number) { return PAGES.filter((p) => p.season === season); }
  pagesDone(season?: number) { return PAGES.filter((p) => (season === undefined || p.season === season) && this.done[p.id]).length; }
  shellCount() { let n = 0; for (const k in this.done) n += this.done[k].shells; return n; }
  canTurn() { return this.mode.kind === 'story' && this.season < 3 && this.pagesDone(this.season) >= TO_TURN && this.release === 0; }
  canRelease() { return this.mode.kind === 'story' && this.season === 3 && this.pagesDone(3) >= TO_TURN && this.release === 0 && !this.ended; }
  /** How far along a page is: [now, need]. */
  progress(id: number): [number, number] {
    if (this.done[id]) return [1, 1];
    const s = this.ss, n = (sp: Sp) => this.count(sp);
    switch (id) {
      case 1: return [Math.min(3, KINDS.filter((k) => (this.sketch[k] ?? 0) > 0).length), 3];
      case 2: return [Math.min(1, this.stats.brought.hermit ?? 0), 1];
      case 3: return [Math.min(6, s.catchesHigh), 6];
      case 4: return [Math.min(2, s.planted) + (this.weeds.some((w) => w.planted && w.size >= 0.95) ? 1 : 0), 3];
      case 5: return [Math.min(1, s.rocksPlaced) + Math.min(6, n('limpet') + n('periwinkle')), 7];
      case 6: return [Math.min(1, s.escapes), 1];
      case 7: return [Math.min(30, s.plankHot), 30];
      case 8: return [this.trial?.w === 'heat' ? 1 : 0, 2];
      case 9: return [Math.min(1, s.swaps), 1];
      case 10: return [Math.min(4, this.weeds.filter((w) => w.size >= 0.8).length) + Math.min(1, s.nests), 5];
      case 11: return [Math.min(3, s.shoos), 3];
      case 12: return [Math.min(1, s.bucketLow), 1];
      case 13: return [this.weather === 'bloom' ? Math.min(6, n('mussel')) : Math.min(5, n('mussel')), 6];
      case 14: return [Math.min(1, this.stats.brought.starfish ?? 0), 1];
      case 15: return [Math.min(7, this.links.length), 7];
      case 16: return [this.kinds().filter((k) => k !== 'gull' && k !== 'jelly').length, 9];
      case 17: return [Math.min(6, n('anemone')), 6];
      case 18: return [Math.min(1, s.spawns), 1];
      case 19: return [this.trial?.w === 'storm' ? 1 : 0, 2];
      case 20: return [Math.min(3, s.trims), 3];
      case 21: return [Math.min(6, s.recruits), 6];
      case 22: return [Math.min(8, KINDS.filter((k) => (this.sketch[k] ?? 0) >= 3).length), 8];
      case 23: return [Math.min(3, this.steady), 3];
      default: return [0, 1];
    }
  }

  // ---------------------------------------------------------------- adding things
  private agent(sp: Sp, x: number, y: number): Agent {
    const a: Agent = { id: this.nextId++, sp, x, y, px: x, py: y, dir: this.rand() < 0.5 ? 1 : -1, e: 0.6, hp: 1, age: 0, st: 'idle', t: 0, rock: -1, ang: -Math.PI / 2, seat: -1, tx: x, ty: y, size: 1, shell: 0, hid: false, prey: -1 };
    this.agents.push(a);
    return a;
  }
  private seatFree(r: Rock, i: number) { return !this.agents.some((a) => a.rock === r.id && a.seat === i); }
  private seatPos(r: Rock, i: number): [number, number] { return [r.x + Math.cos(SEATS[i]) * r.r, r.y + Math.sin(SEATS[i]) * r.r]; }
  private addSeated(sp: Sp, r: Rock, seat: number) {
    const [x, y] = this.seatPos(r, seat), a = this.agent(sp, x, y);
    a.rock = r.id; a.seat = seat; a.ang = SEATS[seat]; a.size = sp === 'anemone' ? 0.9 + this.rand() * 0.3 : 1;
    return a;
  }
  private addGrazer(sp: Sp, r: Rock) {
    const ang = -Math.PI / 2 + (this.rand() - 0.5) * 2.2, a = this.agent(sp, r.x + Math.cos(ang) * r.r, r.y + Math.sin(ang) * r.r);
    a.rock = r.id; a.ang = ang; a.st = 'graze';
    return a;
  }
  private addSwimmer(sp: Sp, x: number, y: number) {
    const a = this.agent(sp, clamp(x, 28, 132), clamp(y, 46, floorY(x) - 2));
    if (sp === 'hermit') { a.y = floorY(a.x) - 1.6; a.size = 0.6; a.shell = 0.8; }
    if (sp === 'starfish') { a.y = floorY(a.x) - 1.2; a.size = 0.8; }
    if (sp === 'blenny') a.y = clamp(y, 60, floorY(x) - 3);
    return a;
  }
  /** A free seat on the rock nearest (x, y), for an anemone or a mussel. */
  private freeSeat(x: number, y: number): [Rock, number] | null {
    let best: [Rock, number] | null = null, bd = Infinity;
    for (const r of this.rocks) for (let i = 0; i < SEATS.length; i++) {
      if (!this.seatFree(r, i)) continue;
      const [sx, sy] = this.seatPos(r, i), d = Math.hypot(sx - x, sy - y);
      if (d < bd) { bd = d; best = [r, i]; }
    }
    return best;
  }
  private nearestRock(x: number, y: number) { let best = this.rocks[0], bd = Infinity; for (const r of this.rocks) { const d = Math.hypot(r.x - x, r.y - y) - r.r; if (d < bd) { bd = d; best = r; } } return best; }
  private rockById(id: number) { return this.rocks.find((r) => r.id === id); }
  /** Larvae and young: one newcomer of a kind, settled where it can live. */
  private recruit(sp: Sp, how: 'larva' | 'bud' | 'brood' | 'fry' | 'spawn', near?: Agent): Agent | null {
    if (this.count(sp) >= INFO[sp].cap) return null;
    let a: Agent | null = null;
    if (sp === 'anemone' || sp === 'mussel') {
      const s = this.freeSeat(near?.x ?? 40 + this.rand() * 80, near?.y ?? 70);
      if (!s) return null;
      a = this.addSeated(sp, s[0], s[1]); a.size = 0.55;
    } else if (sp === 'limpet' || sp === 'periwinkle') {
      const r = near ? this.rockById(near.rock) ?? this.rocks[0] : [...this.rocks].sort((p, q) => q.a - p.a)[Math.floor(this.rand() * 2)];
      a = this.addGrazer(sp, r); a.size = 0.6;
    } else {
      a = this.addSwimmer(sp, near?.x ?? 36 + this.rand() * 88, near?.y ?? 52 + this.rand() * 20); a.size = sp === 'hermit' ? 0.5 : 0.65;
      if (sp === 'hermit') a.shell = 0.62;
    }
    a.e = 0.5; a.px = a.x; a.py = a.y;
    this.stats.births++; this.ss.births++;
    if (how === 'larva' || how === 'fry' || how === 'spawn') { this.stats.recruits++; this.ss.recruits++; }
    this.events.push({ k: 'born', sp, x: a.x, y: a.y, how });
    return a;
  }
  private kill(a: Agent, cause: Extract<Ev, { k: 'die' }>['cause'], leave = true) {
    const i = this.agents.indexOf(a); if (i < 0) return;
    this.agents.splice(i, 1);
    this.stats.deaths++; this.ss.deaths++;
    this.events.push({ k: 'die', sp: a.sp, x: a.x, y: a.y, cause });
    if (leave && cause !== 'storm') this.addScrap(a.x, Math.min(floorY(a.x) - 0.5, a.y + 2), 0.5);
    if (a.sp === 'periwinkle' && cause !== 'gull' && cause !== 'storm') this.shells.push({ id: this.nextId++, x: a.x, y: floorY(a.x) - 1, size: 0.55 });
    if (a.sp === 'hermit' && cause !== 'gull' && cause !== 'storm') this.shells.push({ id: this.nextId++, x: a.x, y: floorY(a.x) - 1, size: a.shell });
    for (const b of this.agents) if (b.prey === a.id) { b.prey = -1; if (b.st === 'hunt' || b.st === 'eatm') b.st = 'idle'; }
    for (const g of this.gulls) if (g.prey === a.id) g.prey = -1;
  }
  private addScrap(x: number, y: number, amt: number) {
    if (this.scraps.length >= MAX_SCRAPS) { const s = this.scraps.reduce((m, q) => (q.amt < m.amt ? q : m)); s.amt = Math.max(s.amt, amt); s.x = x; s.y = y; return; }
    let yy = clamp(y, 44, floorY(x) - 0.5);
    for (const r of this.rocks) if (Math.abs(x - r.x) < r.r) yy = Math.min(yy, r.y - Math.sqrt(r.r * r.r - (x - r.x) ** 2) - 0.4);
    this.scraps.push({ id: this.nextId++, x, y: yy, amt });
  }
  private saw(who: Kind, food: Food, x: number, y: number) {
    const k = linkKey(who, food);
    if (!this.links.includes(k)) this.links.push(k);
    this.events.push({ k: 'eat', who, food, x, y });
  }

  // ---------------------------------------------------------------- the player's nudges
  /** Why the last action could not be done. */
  why = '';
  act(a: Action): boolean {
    this.why = '';
    if (this.ended || (this.release > 0 && a.t !== 'look')) { this.why = 'The spring tide is carrying everyone out.'; return false; }
    switch (a.t) {
      case 'look': return this.look(a.x, a.y);
      case 'shoo': {
        const g = this.gullAt(a.x, a.y);
        if (!g || g.st === 'out') { this.why = 'No gull there.'; return false; }
        g.st = 'out'; g.t = 0; g.prey = -1; this.stats.shoos++; this.ss.shoos++;
        this.events.push({ k: 'gull', id: g.id, st: 'shoo', x: g.x, y: g.y }, { k: 'act', t: 'shoo', x: g.x, y: g.y });
        return true;
      }
      case 'bring': {
        if (this.basket[a.sp] <= 0) { this.why = 'None in the basket.'; return false; }
        if (this.count(a.sp) >= INFO[a.sp].cap) { this.why = `The pool has all the ${INFO[a.sp].plural} it can hold.`; return false; }
        let c: Agent;
        if (a.sp === 'anemone' || a.sp === 'mussel') { const s = this.freeSeat(a.x, a.y); if (!s) { this.why = 'No room on the rocks.'; return false; } c = this.addSeated(a.sp, s[0], s[1]); }
        else if (a.sp === 'limpet' || a.sp === 'periwinkle') c = this.addGrazer(a.sp, this.nearestRock(a.x, a.y));
        else c = this.addSwimmer(a.sp, a.x, a.y);
        c.px = c.x; c.py = c.y; c.e = 0.8;
        this.basket[a.sp]--; this.stats.brought[a.sp] = (this.stats.brought[a.sp] ?? 0) + 1;
        this.events.push({ k: 'born', sp: a.sp, x: c.x, y: c.y, how: 'brought' }, { k: 'act', t: 'bring', x: c.x, y: c.y });
        return true;
      }
      case 'rock': {
        if (this.basket.rock <= 0) { this.why = 'No rocks in the basket.'; return false; }
        if (this.rocks.filter((r) => r.placed).length >= MAX_ROCKS) { this.why = 'That is plenty of rocks.'; return false; }
        const x = clamp(a.x, 30, 130);
        if (this.rocks.some((r) => Math.abs(r.x - x) < r.r + 5 && r.y > 70)) { this.why = 'Too close to another rock.'; return false; }
        const r = 4.5 + this.rand() * 1.5;
        this.rocks.push({ id: this.nextId++, x, y: floorY(x) - r * 0.45, r, a: 0.3, placed: true });
        this.basket.rock--; this.stats.rocksPlaced++; this.ss.rocksPlaced++;
        this.events.push({ k: 'act', t: 'rock', x, y: floorY(x) - r });
        return true;
      }
      case 'shell': {
        if (this.basket.shell <= 0) { this.why = 'No shells in the basket.'; return false; }
        const x = clamp(a.x, 28, 132), big = this.agents.filter((h) => h.sp === 'hermit').reduce((m, h) => Math.max(m, h.size), 0.6);
        this.shells.push({ id: this.nextId++, x, y: floorY(x) - 1, size: clamp(big + 0.3, 0.85, 1.5) });
        this.basket.shell--;
        this.events.push({ k: 'act', t: 'shell', x, y: floorY(x) - 1 });
        return true;
      }
      case 'plant': {
        if (this.basket.seedling <= 0) { this.why = 'No seedlings in the basket.'; return false; }
        const x = clamp(a.x, 29, 131);
        if (this.weeds.length >= MAX_WEEDS) { this.why = 'The weed bed is full: trim before planting more.'; return false; }
        if (this.weeds.some((w) => Math.abs(w.x - x) < 6)) { this.why = 'Too close to another seaweed.'; return false; }
        if (this.rocks.some((r) => Math.abs(r.x - x) < r.r * 0.8 && r.y > 70)) { this.why = 'Plant it on the sand, not on a rock.'; return false; }
        this.weeds.push({ id: this.nextId++, x, size: 0.12, planted: true });
        this.basket.seedling--; this.stats.planted++; this.ss.planted++;
        this.events.push({ k: 'act', t: 'plant', x, y: floorY(x) });
        return true;
      }
      case 'trim': {
        const w = this.weedAt(a.x, a.y ?? 70);
        if (!w) { this.why = 'Point at a seaweed to trim it.'; return false; }
        if (w.size < 0.3) { this.why = 'It is only a sprout.'; return false; }
        w.size -= 0.32; this.stats.trims++; this.ss.trims++;
        this.addScrap(w.x + 2, floorY(w.x) - 0.5, 0.45);
        this.events.push({ k: 'act', t: 'trim', x: w.x, y: this.weedTop(w) + 6 });
        return true;
      }
      case 'plank': {
        if (!this.tools.includes('plank')) { this.why = 'You have no plank yet.'; return false; }
        if (!this.plank && this.connected) { this.why = 'The tide would float it away. Wait for low tide.'; return false; }
        this.plank = !this.plank;
        this.events.push({ k: 'plank', on: this.plank }, { k: 'act', t: 'plank', x: 80, y: POOL.low });
        return true;
      }
      case 'bucket': {
        if (!this.tools.includes('bucket')) { this.why = 'You have no bucket yet.'; return false; }
        if (this.connected) { this.why = 'The sea is already filling the pool.'; return false; }
        if (this.energy < BUCKET_COST) { this.why = `A bucket needs ${BUCKET_COST} energy. Energy comes back each low tide.`; return false; }
        this.energy -= BUCKET_COST; this.stats.buckets++; this.ss.buckets++;
        if (this.o2 < 60) this.ss.bucketLow++;
        const sea = SEASONS[this.season].sea;
        this.o2 = Math.min(this.o2Max(), this.o2 + 32); this.temp -= (this.temp - sea) * 0.5; this.food = Math.min(100, this.food + 12);
        this.events.push({ k: 'act', t: 'bucket', x: 80, y: POOL.low });
        return true;
      }
      case 'season': {
        if (!this.canTurn()) { this.why = `Finish ${TO_TURN} pages of this season first.`; return false; }
        this.turnSeason();
        return true;
      }
      case 'release': {
        if (!this.canRelease()) { this.why = `Finish ${TO_TURN} pages of autumn first.`; return false; }
        this.release = 1; this.plank = false; this.releasedKinds = this.kinds().length;
        this.events.push({ k: 'release' });
        return true;
      }
    }
    return false;
  }
  /** Looking closely: each look of a kind fills in its sketch (a different one, or the same one a moment later). */
  look(x: number, y: number): boolean {
    const hit = this.pick(x, y);
    if (!hit) { this.why = 'Nothing there to look at.'; return false; }
    const k = hit.kind, last = this.lastLook[k], lvl = this.sketch[k] ?? 0;
    const fresh = !last || last[0] !== hit.id || this.tick - last[1] >= 30;
    let up = false;
    if (fresh && lvl < 3) { this.sketch[k] = lvl + 1; up = true; }
    this.lastLook[k] = [hit.id, this.tick];
    this.events.push({ k: 'look', kind: k, level: this.sketch[k] ?? 0, up });
    this.lookedAt = hit;
    return true;
  }
  lookedAt: { kind: Kind; id: number } | null = null;
  /** What is at (x, y): a gull, a creature, a jelly, a seaweed or nothing. */
  pick(x: number, y: number): { kind: Kind; id: number } | null {
    const g = this.gullAt(x, y); if (g) return { kind: 'gull', id: g.id };
    let best: Agent | null = null, bd = 6;
    for (const a of this.agents) { const d = Math.hypot(a.x - x, a.y - y) - (a.sp === 'starfish' ? 2 : 0); if (d < bd) { bd = d; best = a; } }
    if (best) return { kind: best.sp, id: best.id };
    for (const j of this.jellies) if (Math.hypot(j.x - x, j.y - y) < 6) return { kind: 'jelly', id: j.id };
    const w = this.weedAt(x, y); if (w) return { kind: 'seaweed', id: w.id };
    return null;
  }
  gullAt(x: number, y: number) { let best: Gull | null = null, bd = 9; for (const g of this.gulls) { if (g.st === 'out') continue; const d = Math.hypot(g.x - x, g.y - y); if (d < bd) { bd = d; best = g; } } return best; }
  weedAt(x: number, y: number) {
    let best: Weed | null = null, bd = Infinity;
    for (const w of this.weeds) { const dx = Math.abs(w.x - x); if (dx < 3.5 + w.size * 3 && y >= this.weedTop(w) - 3 && y <= floorY(w.x) + 3 && dx < bd) { bd = dx; best = w; } }
    return best;
  }
  /** Where a creature from the basket would go, for the page's preview. */
  o2Max() { return clamp(100 - Math.max(0, this.temp - 12) * 1.6, 40, 100); }

  // ---------------------------------------------------------------- seasons
  private turnSeason() {
    this.season++; this.seasonStart = this.tideNo; this.ss = freshStats(); this.steady = 0; this.trial = null;
    const gift: Partial<Record<Item, number>> = this.season === 1 ? { seedling: 2, shell: 1 } : this.season === 2 ? { starfish: 1, rock: 1, seedling: 1 } : { rock: 2, seedling: 1, shell: 1 };
    for (const k in gift) this.basket[k as Item] += gift[k as Item]!;
    if (this.season === 1) this.tools.push('plank', 'bucket');
    this.energy = Math.max(this.energy, 4);
    this.weather = weatherFor(this.season, 0);
    this.events.push({ k: 'season', season: this.season });
  }
  /** For tests and the free pool: jump to a season. */
  setSeason(s: number) {
    while (this.season < Math.min(3, s)) this.turnSeason();
  }

  // ---------------------------------------------------------------- one step
  step() {
    if (this.ended) return;
    const wasConnected = this.connected, wasPhase = this.phase;
    this.tick++;
    for (const a of this.agents) { a.px = a.x; a.py = a.y; }
    for (const g of this.gulls) { g.px = g.x; g.py = g.y; }
    for (const j of this.jellies) { j.px = j.x; j.py = j.y; }
    if (this.release > 0) { this.stepRelease(); return; }
    const conn = this.connected;
    if (this.phase < wasPhase) this.peak();
    if (conn && !wasConnected) this.flood();
    if (!conn && wasConnected) this.ebb();
    this.environment(conn);
    this.growth();
    for (const a of [...this.agents]) if (this.agents.includes(a)) this.behave(a, conn);
    this.stepGulls(conn);
    this.stepJellies(conn);
    for (const s of this.scraps) s.amt -= 0.0002;
    this.scraps = this.scraps.filter((s) => s.amt > 0.02);
    if (this.tick % 5 === 0) this.checkPages();
  }

  /** High water: a new tide on the clock, the weather for it, and the heatwave and storm checks. */
  private peak() {
    this.tideNo++;
    const prev = this.weather;
    if (this.mode.kind === 'story' || this.mode.kind === 'free') this.weather = weatherFor(this.season, this.seasonTide);
    this.events.push({ k: 'peak', tide: this.tideNo, weather: this.weather });
    if (prev !== this.weather) {
      if (prev !== 'calm') this.events.push({ k: 'weather', w: prev, on: false });
      if (this.weather !== 'calm') this.events.push({ k: 'weather', w: this.weather, on: true });
    }
    // the trials: what was alive when the heatwave or storm began, and whether it all made it through
    if ((this.weather === 'heat' || this.weather === 'storm') && prev !== this.weather) this.trial = { w: this.weather, kinds: this.kinds() };
    if (this.trial && prev === this.trial.w && this.weather !== prev) {
      const now = this.kinds(), kept = this.trial.kinds.every((k) => now.includes(k));
      if (this.trial.w === 'heat' && this.season === 1 && kept && this.trial.kinds.length >= 6) this.finishPage(8);
      if (this.trial.w === 'storm' && this.season === 3 && kept && this.trial.kinds.length >= 7) this.finishPage(19);
      this.trial = null;
    }
    // a steady pool: every tide with seven kinds and the air never short
    if (this.season === 3) { this.steady = this.kinds().length >= 7 && this.minO2 >= 30 ? this.steady + 1 : 0; if (this.steady >= 3) this.finishPage(23); }
    this.minO2 = this.o2;
    // the starfish spawn on a warm late-summer high tide, when they have eaten well
    if (this.season === 2) {
      const ready = this.agents.filter((a) => a.sp === 'starfish' && a.e >= 0.65 && a.age > 300);
      if (ready.length && this.temp >= 15) {
        const s = ready[0]; this.stats.spawns++; this.ss.spawns++;
        this.events.push({ k: 'spawn', x: s.x, y: s.y });
        for (const r of ready) r.e -= 0.3;
        this.recruit('starfish', 'spawn', s);
      }
    }
  }
  /** The sea comes over the rim: food, larvae, visitors, scraps stirred up, and in a storm, the surge. */
  private flood() {
    this.events.push({ k: 'tide', high: true });
    if (this.plank) { this.plank = false; this.events.push({ k: 'plank', on: false }); }
    const bloom = this.weather === 'bloom', big = this.food;
    void big;
    // larvae settle where there is room and something to eat
    const tries: Sp[] = [];
    if (this.seaFood > 25) tries.push('mussel', 'anemone');
    if (bloom) tries.push('mussel');
    if (this.algaeSum() / (1 + this.count('limpet') + this.count('periwinkle')) > 0.32) tries.push(this.rand() < 0.5 ? 'limpet' : 'periwinkle');
    if (this.count('shrimp') < 3 && this.rand() < 0.6) tries.push('shrimp');
    if (this.count('hermit') === 0 && this.season >= 1 && this.rand() < 0.25) tries.push('hermit');
    for (const sp of tries) if (this.rand() < (sp === 'mussel' ? 0.75 : 0.55)) this.recruit(sp, 'larva');
    if (this.scraps.length < 6) for (let i = 0; i < 2; i++) { const x = 34 + this.rand() * 92; this.addScrap(x, floorY(x) - 0.5, 0.45); }
    if ((this.season === 1 || this.season === 2) && this.jellies.length < 2 && this.rand() < 0.6) {
      this.jellies.push({ id: this.nextId++, x: 140, y: 44 + this.rand() * 8, px: 140, py: 48, t: 0, out: false });
    }
    if (this.weather === 'storm') this.surge();
  }
  /** The storm surge: anything loose and unsheltered may be swept away; weed is torn. */
  private surge() {
    this.events.push({ k: 'storm' });
    for (const w of this.weeds) w.size *= 0.7;
    for (const a of [...this.agents]) {
      if (a.sp === 'anemone' || a.sp === 'mussel') continue;
      const sheltered = this.weeds.some((w) => w.size >= 0.45 && Math.abs(w.x - a.x) < 5) || this.rocks.some((r) => (r.placed || r.r >= 7) && Math.hypot(r.x - a.x, r.y - a.y) < r.r + 7);
      if (!sheltered && this.rand() < (a.sp === 'limpet' || a.sp === 'periwinkle' ? 0.3 : 0.6)) this.kill(a, 'storm', false);
    }
    this.basket.shell += 1; this.basket.rock += 1;
    this.events.push({ k: 'find', item: 'shell' });
  }
  /** The sea draws back: the pool is on its own. Beachcombing finds, energy back, and the gulls are coming. */
  private ebb() {
    this.events.push({ k: 'tide', high: false });
    this.energy = Math.min(ENERGY_MAX, this.energy + 1);
    if (this.mode.kind === 'free') for (const k of ['shell', 'seedling', 'rock'] as Item[]) this.basket[k] = Math.max(this.basket[k], 2);
    const total = ITEMS.reduce((n, k) => n + this.basket[k], 0);
    if (total < 7) {
      const pool: Item[] = ['seedling', 'shell', 'seedling', 'rock', 'shrimp', 'periwinkle', 'limpet', 'anemone'];
      if (this.season >= 1) pool.push('mussel', 'hermit');
      if (this.season >= 2) pool.push('blenny');
      const it = pool[Math.floor(this.rand() * pool.length)];
      this.basket[it]++;
      this.events.push({ k: 'find', item: it });
    }
    const n = SEASONS[this.season].gulls;
    for (let i = 0; i < n; i++) {
      const side: 1 | -1 = this.rand() < 0.5 ? 1 : -1;
      this.gulls.push({ id: this.nextId++, x: side > 0 ? -10 : W + 10, y: 8, px: 0, py: 0, st: 'in', t: -Math.floor(i * 110 + this.rand() * 60), prey: -1, side });
    }
    for (const g of this.gulls) { g.px = g.x; g.py = g.y; }
    for (const j of this.jellies) j.out = true;
  }

  private environment(conn: boolean) {
    const S = SEASONS[this.season];
    if (conn) {
      this.temp += (S.sea - this.temp) * 0.012;
      this.o2 += (100 - this.o2) * 0.02;
      this.food += (this.seaFood - this.food) * 0.02;
    } else {
      const target = this.air + 5 * this.light * (this.plank ? 0.25 : 1);
      this.temp += (target - this.temp) * 0.0045 * (this.plank ? 0.45 : 1);
      const lit = this.light * (this.plank ? 0.55 : 1);
      const prod = lit * (0.0075 * this.weedMass() + 0.002 * this.algaeSum());
      let cons = 0;
      for (const a of this.agents) cons += INFO[a.sp].resp * (0.5 + 0.5 * a.size);
      cons *= 1 + 0.06 * Math.max(0, this.temp - 10);
      for (const s of this.scraps) cons += 0.002 * s.amt;
      if (this.season === 3) for (const w of this.weeds) if (w.size > 0.55) cons += 0.006 * (w.size - 0.4);
      this.o2 = clamp(this.o2 + prod - cons, 0, this.o2Max());
      this.food *= 0.9993;
      if (this.plank && this.temp >= 20) { this.ss.plankHot++; this.stats.plankHot++; }
    }
    this.minO2 = Math.min(this.minO2, this.o2);
  }
  private growth() {
    const lit = this.light * (this.plank ? 0.5 : 1), mass = this.weedMass();
    for (const w of this.weeds) {
      if (this.season === 3) w.size += w.size > 0.6 ? -0.00025 : 0.0006 * lit * (1 - w.size);
      else if (this.temp < INFO.seaweed.heat) w.size += 0.0026 * lit * (1 - w.size) * (1 - Math.min(0.5, (mass - w.size) * 0.05));
      else w.size -= 0.0006;
    }
    this.weeds = this.weeds.filter((w) => w.size > 0.04);
    const shade = Math.min(0.5, mass * 0.06);
    for (const r of this.rocks) r.a = clamp(r.a + 0.0016 * lit * (1 - r.a) * (1 - shade), 0, 1);
  }

  // ---------------------------------------------------------------- the creatures' rules
  private behave(a: Agent, conn: boolean) {
    const I = INFO[a.sp];
    a.age++;
    a.hid = false;
    // stress: heat, short air and hunger wear a creature down; when all is well it mends
    let hurt = 0;
    if (this.temp > I.heat) hurt += (this.temp - I.heat) * 0.0022;
    if (this.o2 < I.o2) hurt += (I.o2 - this.o2) * 0.0009;
    if (a.e <= 0) hurt += 0.0025;
    if (a.sp === 'hermit' && a.size > a.shell + 0.06) hurt += 0.00035;
    if (hurt > 0) a.hp -= hurt; else if (a.e > 0.15) a.hp = Math.min(1, a.hp + 0.002);
    if (a.hp <= 0) {
      const cause = this.temp > I.heat ? 'heat' : this.o2 < I.o2 ? 'air' : a.sp === 'hermit' && a.size > a.shell + 0.06 ? 'cramped' : 'hunger';
      this.kill(a, cause); return;
    }
    if (a.size < 1 && a.sp !== 'hermit') a.size = Math.min(1, a.size + 0.0004);
    switch (a.sp) {
      case 'anemone': {
        a.e -= 0.0004;
        a.st = conn ? 'open' : 'still';
        if (this.rand() < this.food / 100 * (conn ? 0.018 : 0.01)) {
          a.e = Math.min(1, a.e + 0.11); this.food = Math.max(0, this.food - 0.3);
          if (conn) { this.ss.catchesHigh++; this.stats.catchesHigh++; }
          this.saw('anemone', 'plankton', a.x, a.y - 2);
        }
        if (a.e > 0.85 && a.age > 900 && this.rand() < 0.003) { if (this.recruit('anemone', 'bud', a)) a.e -= 0.4; }
        break;
      }
      case 'mussel': {
        a.e -= 0.0004;
        a.st = conn || this.food > 20 ? 'open' : 'shut';
        if (a.st === 'open' && this.food > 2) {
          const take = 0.012 * this.food / 50;
          this.food = Math.max(0, this.food - take); a.e = Math.min(1, a.e + take * 0.11);
          if (this.rand() < 0.004) this.saw('mussel', 'plankton', a.x, a.y - 1.5);
        }
        break;
      }
      case 'limpet': case 'periwinkle': this.graze(a); break;
      case 'shrimp': this.shrimp(a); break;
      case 'blenny': this.blenny(a); break;
      case 'starfish': this.starfish(a); break;
      case 'hermit': this.hermit(a); break;
    }
    a.e = clamp(a.e, 0, 1);
  }
  private graze(a: Agent) {
    const peri = a.sp === 'periwinkle';
    a.e -= 0.00045;
    const r = this.rockById(a.rock);
    if (a.st === 'walk' || !r) {
      // crawling over the sand to a greener rock
      const tr = this.rockById(a.prey) ?? this.rocks[0];
      const gx = tr.x, gy = tr.y - tr.r;
      const sp = peri ? 0.07 : 0.045, dx = gx - a.x, dy = gy - a.y, d = Math.hypot(dx, dy);
      if (d < 1.2) { a.rock = tr.id; a.ang = -Math.PI / 2; a.st = 'graze'; a.prey = -1; return; }
      a.x += (dx / d) * sp; a.y = Math.min(floorY(a.x) - 1, a.y + (dy / d) * sp); a.dir = dx > 0 ? 1 : -1;
      return;
    }
    if (r.a > 0.08) {
      const take = peri ? 0.00062 : 0.00058;
      r.a -= take; a.e = Math.min(1, a.e + take * 3.1);
      if (this.rand() < 0.002) this.saw(a.sp, 'algae', a.x, a.y);
    }
    // creep about the rock's top
    if (a.t <= 0) { a.tx = -Math.PI / 2 + (this.rand() - 0.5) * 2.4; a.t = 60 + Math.floor(this.rand() * 80); }
    a.t--;
    a.ang += clamp(a.tx - a.ang, -0.006, 0.006) * (peri ? 1.6 : 1);
    a.dir = a.tx > a.ang ? 1 : -1;
    a.x = r.x + Math.cos(a.ang) * (r.r + 0.6); a.y = r.y + Math.sin(a.ang) * (r.r + 0.6);
    // a bare rock: off to the greenest one in reach
    if (r.a < 0.12 && this.rand() < 0.004) {
      let best: Rock | null = null;
      for (const q of this.rocks) if (q.id !== r.id && q.a > r.a + 0.2 && (!best || q.a > best.a)) best = q;
      if (best) { a.st = 'walk'; a.prey = best.id; a.rock = -1; }
    }
    if (a.e > 0.9 && a.age > 1200 && r.a > 0.45 && this.rand() < 0.0006) { if (this.recruit(a.sp, 'brood', a)) a.e -= 0.4; }
  }
  private swimTo(a: Agent, tx: number, ty: number, speed: number) {
    const dx = tx - a.x, dy = ty - a.y, d = Math.hypot(dx, dy);
    if (d > 0.01) { const s = Math.min(speed, d); a.x += (dx / d) * s; a.y += (dy / d) * s; if (Math.abs(dx) > 0.05) a.dir = dx > 0 ? 1 : -1; }
    a.x = clamp(a.x, 27, 133); a.y = clamp(a.y, POOL.low + 3, floorY(a.x) - 1.5);
    for (const r of this.rocks) { const ex = a.x - r.x, ey = a.y - r.y, e = Math.hypot(ex, ey); if (e < r.r + 1 && e > 0.001) { a.x = r.x + (ex / e) * (r.r + 1); a.y = r.y + (ey / e) * (r.r + 1); } }
    return d;
  }
  private inWeed(x: number, y: number) { return this.weeds.find((w) => w.size >= 0.3 && Math.abs(w.x - x) < 2.5 + w.size * 2.5 && y >= this.weedTop(w) + 2 && y <= floorY(w.x)); }
  private shrimp(a: Agent) {
    a.e -= 0.0005;
    const hunter = this.agents.find((b) => b.sp === 'blenny' && b.st === 'hunt' && Math.hypot(b.x - a.x, b.y - a.y) < 12);
    if (hunter) {
      // flee to the nearest seaweed
      let wb: Weed | null = null, wd = Infinity;
      for (const w of this.weeds) { if (w.size < 0.3) continue; const d = Math.abs(w.x - a.x); if (d < wd) { wd = d; wb = w; } }
      if (wb) {
        const ty = Math.max(this.weedTop(wb) + 4, Math.min(a.y, floorY(wb.x) - 3));
        this.swimTo(a, wb.x, ty, 0.42);
        if (this.inWeed(a.x, a.y)) {
          a.hid = true;
          if (a.st !== 'hide') { a.st = 'hide'; if (hunter.prey === a.id) { this.stats.escapes++; this.ss.escapes++; this.events.push({ k: 'hide', x: a.x, y: a.y }); hunter.prey = -1; hunter.st = 'rest'; hunter.t = 90; } }
        }
      } else this.swimTo(a, a.x + (a.x - hunter.x), a.y + (a.y - hunter.y) * 0.5, 0.4);
      return;
    }
    if (a.st === 'hide') { a.hid = !!this.inWeed(a.x, a.y); if (this.rand() < 0.01) a.st = 'idle'; return; }
    // feed: scraps first, then the greenest rock nearby
    if (a.t <= 0) {
      a.t = 50 + Math.floor(this.rand() * 70);
      const s = this.scraps.find((q) => Math.abs(q.x - a.x) < 22 && q.amt > 0.08);
      if (s && a.e < 0.7 && this.rand() < 0.6) { a.tx = s.x; a.ty = s.y - 1; a.st = 'scrap'; a.prey = s.id; }
      else {
        const r = this.rocks.filter((q) => q.a > 0.15).sort((p, q) => Math.abs(p.x - a.x) - Math.abs(q.x - a.x))[0];
        const w = this.weeds.filter((q) => q.size >= 0.35).sort((p, q) => Math.abs(p.x - a.x) - Math.abs(q.x - a.x))[0];
        if (w && a.e < 0.85 && (!r || this.rand() < 0.45)) { a.tx = w.x + (this.rand() - 0.5) * 3; a.ty = this.weedTop(w) + 3 + this.rand() * (floorY(w.x) - this.weedTop(w) - 5); a.st = 'weed'; a.prey = w.id; }
        else if (r && a.e < 0.85) { const ang = -Math.PI / 2 + (this.rand() - 0.5) * 2; a.tx = r.x + Math.cos(ang) * (r.r + 1.2); a.ty = r.y + Math.sin(ang) * (r.r + 1.2); a.st = 'nibble'; a.prey = r.id; }
        else { a.tx = 30 + this.rand() * 100; a.ty = 48 + this.rand() * 28; a.st = 'idle'; }
      }
      a.t += Math.round(Math.hypot(a.tx - a.x, a.ty - a.y) / 0.22);
    }
    a.t--;
    const d = this.swimTo(a, a.tx, a.ty, a.st === 'idle' ? 0.12 : 0.22);
    if (d < (a.st === 'scrap' ? 2.6 : 1.5)) {
      if (a.st === 'scrap') { const s = this.scraps.find((q) => q.id === a.prey); if (s) { const take = Math.min(s.amt, 0.01); s.amt -= take; a.e += take * 1.2; if (this.rand() < 0.01) this.saw('shrimp', 'scraps', a.x, a.y); } else a.t = 0; }
      else if (a.st === 'weed') { if (this.weeds.some((w) => w.id === a.prey)) { a.e += 0.0024; if (this.rand() < 0.002) this.saw('shrimp', 'algae', a.x, a.y); } else a.t = 0; }
      else if (a.st === 'nibble') { const r = this.rockById(a.prey); if (r && r.a > 0.08) { r.a -= 0.0005; a.e += 0.0028; if (this.rand() < 0.003) this.saw('shrimp', 'algae', a.x, a.y); } else a.t = 0; }
    }
    if (a.e > 0.8 && this.count('shrimp') >= 2 && this.rand() < 0.0015) { if (this.recruit('shrimp', 'brood', a)) a.e -= 0.35; }
  }
  private blenny(a: Agent) {
    a.e -= 0.0004;
    const forest = this.weeds.filter((w) => w.size >= 0.8);
    if (a.st === 'nest') {
      // guarding the nest in the weed until the fry hatch
      a.t--; this.swimTo(a, a.tx + Math.sin(a.age * 0.05) * 2, a.ty, 0.08); a.hid = true;
      if (a.t <= 0) { a.st = 'idle'; this.recruit('blenny', 'fry', a); }
      return;
    }
    if (this.season === 1 && forest.length >= 4 && a.e >= 0.35 && a.age > 200 && this.ss.nests === 0) {
      const w = forest[Math.floor(this.rand() * forest.length)];
      a.st = 'nest'; a.t = 400; a.tx = w.x; a.ty = floorY(w.x) - 5; a.prey = -1;
      this.stats.nests++; this.ss.nests++;
      this.events.push({ k: 'nest', x: w.x, y: floorY(w.x) - 5 });
      return;
    }
    if (a.st === 'hunt') {
      const p = this.agents.find((b) => b.id === a.prey);
      a.t--;
      if (!p || p.hid || a.t <= 0) { a.st = 'rest'; a.t = 100; a.prey = -1; return; }
      const d = this.swimTo(a, p.x, p.y, 0.5);
      if (d < 2.4) {
        this.kill(p, 'eaten', false); this.stats.eaten++;
        a.e = Math.min(1, a.e + 0.45); a.st = 'rest'; a.t = 160; a.prey = -1;
        this.saw('blenny', 'shrimp', a.x, a.y);
      }
      return;
    }
    if (a.st === 'scrap') {
      // a hungry blenny picks at scraps on the sand
      const s = this.scraps.find((q) => q.id === a.prey);
      a.t--;
      if (!s || s.amt < 0.02 || a.t <= 0 || a.e > 0.75) { a.st = 'idle'; a.t = 0; a.prey = -1; return; }
      if (this.swimTo(a, s.x, s.y - 1.5, 0.14) < 2.6) { const take = Math.min(s.amt, 0.006); s.amt -= take; a.e += take * 1.6; if (this.rand() < 0.01) this.saw('blenny', 'scraps', a.x, a.y); }
      return;
    }
    if (a.st === 'rest') { a.t--; this.swimTo(a, a.tx, a.ty, 0.06); if (a.t > 0) return; a.st = 'idle'; }
    if (a.e < 0.5 && this.rand() < 0.02) {
      let best: Agent | null = null, bd = 34;
      for (const b of this.agents) if (b.sp === 'shrimp' && !b.hid && !this.inWeed(b.x, b.y)) { const d = Math.hypot(b.x - a.x, b.y - a.y); if (d < bd) { bd = d; best = b; } }
      let sb: Scrap | null = null, sd = 60;
      for (const q of this.scraps) { const d = Math.abs(q.x - a.x); if (q.amt > 0.08 && d < sd) { sd = d; sb = q; } }
      if (best && (!sb || a.e >= 0.35 || this.rand() < 0.4)) { a.st = 'hunt'; a.prey = best.id; a.t = 110; return; }
      if (sb && a.e < 0.4) { a.st = 'scrap'; a.prey = sb.id; a.t = 400; return; }
    }
    // lurk near the bottom, by a rock or the weed
    if (a.t <= 0) { a.t = 80 + Math.floor(this.rand() * 80); a.tx = 32 + this.rand() * 96; a.ty = floorY(a.tx) - 3 - this.rand() * 6; }
    a.t--;
    this.swimTo(a, a.tx, a.ty, 0.08);
  }
  private starfish(a: Agent) {
    a.e -= 0.00034;
    if (a.st === 'eatm') {
      const m = this.agents.find((b) => b.id === a.prey);
      if (!m) { a.st = 'idle'; return; }
      a.t--;
      if (a.t <= 0) { this.kill(m, 'eaten', false); this.stats.eaten++; a.e = Math.min(1, a.e + 0.55); a.st = 'idle'; a.prey = -1; this.saw('starfish', 'mussel', a.x, a.y); }
      return;
    }
    let goal: Agent | null = null;
    if (a.e < 0.7) {
      let bd = Infinity;
      for (const b of this.agents) if (b.sp === 'mussel') { const d = Math.hypot(b.x - a.x, b.y - a.y); if (d < bd) { bd = d; goal = b; } }
    }
    if (goal) {
      const dx = goal.x - a.x, dy = goal.y - a.y, d = Math.hypot(dx, dy);
      if (d < 2.6) { a.st = 'eatm'; a.prey = goal.id; a.t = 260; return; }
      a.x += (dx / d) * 0.025; a.y += (dy / d) * 0.025; a.dir = dx > 0 ? 1 : -1; a.ang += 0.003 * a.dir;
      return;
    }
    if (a.t <= 0) { a.t = 200; a.tx = 32 + this.rand() * 96; }
    a.t--;
    const dx = a.tx - a.x; if (Math.abs(dx) > 0.5) { a.x += Math.sign(dx) * 0.012; a.ang += 0.0015 * Math.sign(dx); }
    a.y += (floorY(a.x) - 1.2 - a.y) * 0.05;
  }
  private hermit(a: Agent) {
    a.e -= 0.0005;
    const ground = (x: number) => { let y = floorY(x) - 1.6; for (const r of this.rocks) if (Math.abs(x - r.x) < r.r) y = Math.min(y, r.y - Math.sqrt(r.r * r.r - (x - r.x) ** 2) - 1.2); return y; };
    if (a.st === 'swap') {
      a.t--;
      if (a.t <= 0) {
        const s = this.shells.find((q) => q.id === a.prey);
        if (s && s.size >= a.size) {
          const old = a.shell; a.shell = s.size; s.size = old; s.x = a.x - 2.5 * a.dir;
          const bigger = a.shell > old;
          if (bigger) { this.stats.swaps++; this.ss.swaps++; }
          this.events.push({ k: 'swap', x: a.x, y: a.y, bigger });
        }
        a.st = 'idle'; a.prey = -1; a.t = 0;
      }
      return;
    }
    if (a.e > 0.45) a.size = Math.min(1.45, a.size + 0.00016);
    const cramped = a.size > a.shell - 0.02;
    let gx: number | null = null;
    if (cramped) {
      let best: Shell | null = null, bd = Infinity;
      for (const s of this.shells) if (s.size >= a.size + 0.04 && s.size < a.size + 0.7) { const d = Math.abs(s.x - a.x); if (d < bd) { bd = d; best = s; } }
      if (best) {
        gx = best.x;
        if (Math.abs(best.x - a.x) < 1.6) { a.st = 'swap'; a.t = 40; a.prey = best.id; return; }
      }
    }
    if (gx === null && a.e < 0.85) {
      let best: Scrap | null = null, bd = Infinity;
      for (const s of this.scraps) { const d = Math.abs(s.x - a.x); if (d < bd) { bd = d; best = s; } }
      if (best) {
        if (Math.abs(best.x - a.x) < 1.6) {
          const take = Math.min(best.amt, 0.008); best.amt -= take; a.e = Math.min(1, a.e + take * 2.2); a.st = 'eat';
          if (this.rand() < 0.01) this.saw('hermit', 'scraps', a.x, a.y);
          a.y = ground(a.x); return;
        }
        gx = best.x;
      }
    }
    if (gx === null) { if (a.t <= 0) { a.t = 120; a.tx = 30 + this.rand() * 100; } a.t--; gx = a.tx; }
    const dx = gx - a.x;
    a.st = 'walk';
    if (Math.abs(dx) > 0.1) { a.x += Math.sign(dx) * 0.06; a.dir = dx > 0 ? 1 : -1; }
    a.x = clamp(a.x, 28, 132); a.y = ground(a.x);
  }

  // ---------------------------------------------------------------- gulls and visitors
  private stepGulls(conn: boolean) {
    for (const g of this.gulls) {
      g.t++;
      if (g.t < 0) continue;
      if (conn && g.st !== 'out') { g.st = 'out'; g.t = 0; }
      if (g.st === 'in') {
        // circling down to hover over the pool
        const tx = 80 - g.side * 20, ty = 22;
        g.x += (tx - g.x) * 0.04; g.y += (ty - g.y) * 0.04 + Math.sin(g.t * 0.15) * 0.15;
        if (g.t === 1) this.events.push({ k: 'gull', id: g.id, st: 'in', x: g.x, y: g.y });
        if (g.t > 50) { g.st = 'eye'; g.t = 0; }
      } else if (g.st === 'eye') {
        // eyeing the pool: the moment to shoo it
        g.x += Math.sin(g.t * 0.05) * 0.25; g.y = 22 + Math.sin(g.t * 0.12) * 1.2;
        if (g.t > 80) {
          const prey = this.agents.filter((a) => (a.sp === 'shrimp' || a.sp === 'blenny' || a.sp === 'hermit') && !a.hid && a.st !== 'nest' && !(this.plank && a.x > PLANK.x0 && a.x < PLANK.x1));
          if (!prey.length) { g.st = 'out'; g.t = 0; this.events.push({ k: 'gull', id: g.id, st: 'miss', x: g.x, y: g.y }); continue; }
          prey.sort((p, q) => Math.hypot(p.x - g.x, p.y - g.y) - Math.hypot(q.x - g.x, q.y - g.y));
          g.prey = prey[0].id; g.st = 'dive'; g.t = 0;
          this.events.push({ k: 'gull', id: g.id, st: 'dive', x: g.x, y: g.y });
        }
      } else if (g.st === 'dive') {
        const p = this.agents.find((a) => a.id === g.prey);
        if (!p || p.hid || (this.plank && p.x > PLANK.x0 && p.x < PLANK.x1)) { g.st = 'out'; g.t = 0; this.events.push({ k: 'gull', id: g.id, st: 'miss', x: g.x, y: g.y }); continue; }
        const dx = p.x - g.x, dy = p.y - g.y, d = Math.hypot(dx, dy);
        g.x += (dx / d) * Math.min(d, 1.6); g.y += (dy / d) * Math.min(d, 1.6);
        if (d < 2) {
          this.kill(p, 'gull', false); this.stats.eaten++;
          this.saw('gull', p.sp, g.x, g.y);
          this.events.push({ k: 'gull', id: g.id, st: 'grab', x: g.x, y: g.y });
          g.st = 'out'; g.t = 0; g.prey = -1;
        }
      } else {
        g.x += g.side * -1.4 * Math.min(1, g.t / 10); g.y -= 0.7;
      }
    }
    this.gulls = this.gulls.filter((g) => !(g.st === 'out' && (g.y < -12 || g.x < -20 || g.x > W + 20)));
  }
  private stepJellies(conn: boolean) {
    for (const j of this.jellies) {
      j.t++;
      if (j.out && conn) j.out = false;
      if (j.out) { j.x += 0.12; j.y -= 0.03; }
      else { j.x += Math.sin(j.t * 0.01) * 0.05 - 0.04; j.y += Math.sin(j.t * 0.03) * 0.04; j.x = clamp(j.x, 34, 150); j.y = clamp(j.y, this.waterY + 4, 70); if (this.rand() < 0.002 && this.food > 10) { this.food -= 0.5; this.saw('jelly', 'plankton', j.x, j.y); } }
    }
    this.jellies = this.jellies.filter((j) => j.x < W + 10);
  }

  // ---------------------------------------------------------------- the spring tide
  private stepRelease() {
    this.release++;
    const r = this.release;
    if (r === 2) this.events.push({ k: 'tide', high: true });
    // everyone drifts up and out over the rim to the open sea
    const rise = Math.min(1, r / 120);
    for (const a of [...this.agents]) {
      const delay = (a.id * 37) % 140;
      if (r < 40 + delay) continue;
      a.x += 0.35 + (a.id % 5) * 0.05; a.y += (34 - a.y) * 0.02 * rise; a.dir = 1;
      if (a.x > W + 6) this.agents.splice(this.agents.indexOf(a), 1);
    }
    for (const j of this.jellies) j.x += 0.3;
    this.gulls = [];
    if (r > 60 && this.agents.length === 0 && !this.ended) {
      this.ended = true;
      const kinds = this.releasedKinds;
      this.finishPage(24, kinds >= 8 ? 3 : kinds >= 6 ? 2 : 1);
      this.events.push({ k: 'ending' });
    }
  }
  /** How many kinds went out on the spring tide (counted when it begins). */
  releasedKinds = 0;

  // ---------------------------------------------------------------- the pages
  private checkPages() {
    if (this.mode.kind !== 'story') return;
    for (const p of PAGES) {
      if (p.season !== this.season || this.done[p.id]) continue;
      if (p.id === 8 || p.id === 19 || p.id === 23 || p.id === 24) continue;
      const [now, need] = this.progress(p.id);
      if (now >= need) this.finishPage(p.id);
    }
  }
  finishPage(id: number, shells?: number) {
    if (this.done[id] || this.mode.kind !== 'story') return;
    const p = PAGES[id - 1], t = this.seasonTide;
    const s = shells ?? (t <= p.shells[0] ? 3 : t <= p.shells[1] ? 2 : 1);
    this.done[id] = { tide: t, shells: s };
    if (p.reward) for (const k in p.reward) this.basket[k as Item] += p.reward[k as Item]!;
    this.energy = Math.min(ENERGY_MAX, this.energy + 1);
    this.events.push({ k: 'page', id, shells: s });
  }

  // ---------------------------------------------------------------- saving
  snapshot() {
    const r2 = (v: number) => Math.round(v * 1000) / 1000;
    return {
      v: 1 as const, mode: this.mode, seed: this.seed, rng: this.rng, tick: this.tick, tideNo: this.tideNo, season: this.season, seasonStart: this.seasonStart,
      weather: this.weather, temp: this.temp, o2: this.o2, food: this.food, plank: this.plank, energy: this.energy,
      rocks: this.rocks.map((r) => ({ ...r })), weeds: this.weeds.map((w) => ({ ...w })), scraps: this.scraps.map((s) => ({ ...s })), shells: this.shells.map((s) => ({ ...s })),
      agents: this.agents.map((a) => ({ ...a, px: r2(a.x), py: r2(a.y) })), gulls: this.gulls.map((g) => ({ ...g })), jellies: this.jellies.map((j) => ({ ...j })),
      basket: { ...this.basket }, tools: [...this.tools], sketch: { ...this.sketch }, lastLook: { ...this.lastLook }, links: [...this.links], done: { ...this.done },
      stats: JSON.parse(JSON.stringify(this.stats)) as Stats, ss: JSON.parse(JSON.stringify(this.ss)) as Stats, trial: this.trial ? { w: this.trial.w, kinds: [...this.trial.kinds] } : null,
      steady: this.steady, minO2: this.minO2, release: this.release, releasedKinds: this.releasedKinds, ended: this.ended, nextId: this.nextId,
    };
  }
  /** A saved pool, or null when the save is not a pool this version can read. */
  static load(raw: unknown): TideGame | null {
    try {
      const o = raw as Snap;
      if (!o || typeof o !== 'object' || o.v !== 1) return null;
      const mode = o.mode as Mode;
      if (!mode || (mode.kind !== 'story' && !(mode.kind === 'free' && Number.isInteger(mode.season) && mode.season >= 0 && mode.season <= 3))) return null;
      const nums = [o.seed, o.rng, o.tick, o.tideNo, o.season, o.seasonStart, o.temp, o.o2, o.food, o.energy, o.steady, o.minO2, o.release, o.nextId];
      if (!nums.every((n) => typeof n === 'number' && Number.isFinite(n))) return null;
      if (o.season < 0 || o.season > 3 || o.tick < 0 || o.seasonStart > o.tideNo) return null;
      const arr = [o.rocks, o.weeds, o.scraps, o.shells, o.agents, o.gulls, o.jellies];
      if (!arr.every(Array.isArray) || !o.rocks.length) return null;
      const finite = (x: Record<string, unknown>, keys: string[]) => keys.every((k) => typeof x[k] === 'number' && Number.isFinite(x[k] as number));
      if (!o.rocks.every((r) => finite(r, ['id', 'x', 'y', 'r', 'a']))) return null;
      if (!o.weeds.every((w) => finite(w, ['id', 'x', 'size']))) return null;
      if (!o.agents.every((a) => SPECIES.includes(a.sp) && finite(a as unknown as Record<string, unknown>, ['id', 'x', 'y', 'e', 'hp', 'age', 't', 'rock', 'ang', 'seat', 'tx', 'ty', 'size', 'shell', 'prey']))) return null;
      if (!o.basket || !ITEMS.every((k) => typeof o.basket[k] === 'number' && o.basket[k] >= 0)) return null;
      if (!Array.isArray(o.tools) || !Array.isArray(o.links) || !o.done || typeof o.done !== 'object' || !o.stats || !o.ss) return null;
      const g = new TideGame(mode, o.seed);
      Object.assign(g, {
        rng: o.rng >>> 0, tick: o.tick, tideNo: o.tideNo, season: o.season, seasonStart: o.seasonStart, weather: (['calm', 'heat', 'bloom', 'storm'] as Weather[]).includes(o.weather) ? o.weather : 'calm',
        temp: o.temp, o2: o.o2, food: o.food, plank: !!o.plank, energy: clamp(o.energy, 0, ENERGY_MAX),
        rocks: o.rocks.map((r) => ({ ...r })), weeds: o.weeds.map((w) => ({ ...w })), scraps: o.scraps.map((s) => ({ ...s })), shells: o.shells.map((s) => ({ ...s })),
        agents: o.agents.map((a) => ({ ...a })), gulls: o.gulls.map((q) => ({ ...q })), jellies: o.jellies.map((j) => ({ ...j })),
        basket: { ...g.basket, ...o.basket }, tools: o.tools.filter((t) => ['look', 'rock', 'shell', 'plant', 'trim', 'plank', 'bucket'].includes(t)),
        sketch: { ...o.sketch }, lastLook: { ...o.lastLook }, links: o.links.filter((l) => typeof l === 'string'), done: { ...o.done },
        stats: { ...freshStats(), ...o.stats }, ss: { ...freshStats(), ...o.ss }, trial: o.trial ?? null,
        steady: o.steady, minO2: o.minO2, release: o.release, releasedKinds: o.releasedKinds ?? 0, ended: !!o.ended, nextId: o.nextId,
      });
      return g;
    } catch { return null; }
  }
}

/** The number of shells a finished story earned, for the menu. */
export const shellTotal = (g: TideGame) => g.shellCount();
