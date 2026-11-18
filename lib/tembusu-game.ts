// Tembusu: the rules. One tree on a hill, from seed to fall, as a pure function of its seed, its start time and the
// timestamped bud picks. Nothing here reads the clock: every call takes `now`, and a clock that goes backwards is
// treated as standing still (`max(now, lastNow)`). The tree lives on a growth clock that runs with real time but stops
// while a fork waits for the player; after ASSIST_WAIT the assist picks a sensible bud and growth carries on. Catch-up
// replays the tree from its start, jumping from event to event (forks, weather, the seasons when animals look for a
// home), so a week away resolves at once. A fallen tree waits for the seed pick for as long as it takes.
// Drawing lives in lib/tembusu-scene.ts and the page in app/tembusu/page.tsx.

export const SAVE_KEY = 'tembusu-v1';
/** a grown tree's life in real hours at the normal grow speed: about one tree a day */
export const TREE_HOURS = 12;
/** the calm "slow" grow speed */
export const SLOW_HOURS = 24;
/** the first tree is a short tutorial tree, so a first sitting reaches the fall and the seed pick */
export const FIRST_TREE_MINUTES = 15;
/** forks on a grown tree and on the tutorial tree; the spacing follows from the tree's length */
export const FORKS = 8;
export const FIRST_FORKS = 5;
/** how long a fork waits for the player before the assist picks a bud */
export const ASSIST_WAIT = 60 * 60_000;
/** how many seeds a player can keep from a fallen tree, and how many Enzo's journal holds */
export const KEEP = 3;
export const JOURNAL_SEEDS = 12;
/** places on the hill for earlier trees */
export const HILL_SLOTS = 6;

const HOUR = 3_600_000;
/** animals look for a home this many times over a tree's life (every 30 minutes on a 12-hour tree) */
const TICKS = 24;

// ---------------------------------------------------------------- content

export type Bud = 'wide' | 'tall' | 'flower' | 'root' | 'hollow' | 'bark';
export const BUDS: Bud[] = ['wide', 'tall', 'flower', 'root', 'hollow', 'bark'];
export const BUD_INFO: Record<Bud, { name: string; line: string }> = {
  wide: { name: 'Wide branch', line: 'A long low branch. Room for more animals.' },
  tall: { name: 'Tall leader', line: 'Reaches for the light. Can snap in a storm.' },
  flower: { name: 'Flower', line: 'Bees and sunbirds come, then fruit.' },
  root: { name: 'Deep root', line: 'Holds water through a dry spell.' },
  hollow: { name: 'Hollow', line: 'A hole in the trunk for nesting.' },
  bark: { name: 'Thick bark', line: 'Stands up to lightning and beetles.' },
};

export type AnimalId = 'hornbill' | 'colugo' | 'squirrel' | 'sunbird' | 'koel' | 'robin' | 'bat' | 'monitor' | 'bees' | 'birdwing' | 'kingfisher' | 'loris';
export type Shape = { forks: number; wide: number; tall: number; flowers: number; fruit: number; roots: number; hollows: number; bark: number; health: number };
type AnimalDef = { id: AnimalId; name: string; needs: string; effect: string; help: boolean; night?: boolean; day?: boolean; ok: (s: Shape) => boolean };
export const ANIMALS: AnimalDef[] = [
  { id: 'hornbill', name: 'Oriental pied hornbill', needs: 'a hollow, high up', effect: 'carries seeds: one more seed when the tree falls', help: true, ok: (s) => s.hollows >= 1 && s.forks >= 3 },
  { id: 'colugo', name: 'Sunda colugo', needs: 'a tall trunk to glide from', effect: 'nibbles young leaves', help: false, ok: (s) => s.tall >= 2 },
  { id: 'squirrel', name: 'Plantain squirrel', needs: 'fruit', effect: 'eats the fruit', help: false, ok: (s) => s.fruit >= 1 },
  { id: 'sunbird', name: 'Crimson sunbird', needs: 'flowers', effect: 'carries pollen: more fruit', help: true, ok: (s) => s.flowers >= 1 },
  { id: 'koel', name: 'Asian koel', needs: 'plenty of fruit', effect: 'eats hairy caterpillars: the tree heals faster', help: true, ok: (s) => s.fruit >= 2 },
  { id: 'robin', name: 'Oriental magpie-robin', needs: 'a hollow and a low wide branch', effect: 'eats beetles', help: true, ok: (s) => s.hollows >= 1 && s.wide >= 1 },
  { id: 'bat', name: 'Cave nectar bat', needs: 'flowers, at night', effect: 'carries pollen at night: more fruit', help: true, night: true, ok: (s) => s.flowers >= 2 },
  { id: 'monitor', name: 'Clouded monitor lizard', needs: 'thick bark to climb', effect: 'eats beetle grubs', help: true, ok: (s) => s.bark >= 2 },
  { id: 'bees', name: 'Giant honey bees', needs: 'flowers and a tall limb for the comb', effect: 'carry pollen: more fruit', help: true, ok: (s) => s.flowers >= 2 && s.tall >= 1 },
  { id: 'birdwing', name: 'Common birdwing', needs: 'flowers in the sun', effect: 'its caterpillars nibble leaves', help: false, day: true, ok: (s) => s.flowers >= 1 && s.tall >= 1 },
  { id: 'kingfisher', name: 'Collared kingfisher', needs: 'two hollows', effect: 'eats beetles', help: true, ok: (s) => s.hollows >= 2 },
  { id: 'loris', name: 'Sunda slow loris', needs: 'wide branches, at night', effect: 'gnaws the bark for sap', help: false, night: true, ok: (s) => s.wide >= 2 },
];
export const ANIMAL: Record<AnimalId, AnimalDef> = Object.fromEntries(ANIMALS.map((a) => [a.id, a])) as Record<AnimalId, AnimalDef>;
const BEETLE_EATERS: AnimalId[] = ['robin', 'monitor', 'kingfisher'];
const POLLINATORS: AnimalId[] = ['sunbird', 'bat', 'bees'];

export type TraitId =
  | 'storm-hardy' | 'early-flowering' | 'wide-crown' | 'deep-taproot' | 'hollow-prone' | 'sweet-fruit' | 'quick-sapling' | 'long-lived'
  | 'thick-skinned' | 'tall-reaching' | 'drought-tolerant' | 'bitter-sap' | 'night-blooming' | 'fragrant' | 'springy-wood' | 'self-healing'
  | 'broad-leaves' | 'welcoming' | 'many-seeded' | 'sun-seeking';
export const TRAITS: { id: TraitId; name: string; line: string }[] = [
  { id: 'storm-hardy', name: 'Storm-hardy', line: 'Storms break fewer branches.' },
  { id: 'early-flowering', name: 'Early flowering', line: 'Starts with a flower.' },
  { id: 'wide-crown', name: 'Wide crown', line: 'Starts with a wide branch.' },
  { id: 'deep-taproot', name: 'Deep taproot', line: 'Starts with a deep root.' },
  { id: 'hollow-prone', name: 'Hollow-prone', line: 'Lightning and age open hollows.' },
  { id: 'sweet-fruit', name: 'Sweet fruit', line: 'More fruit each season.' },
  { id: 'quick-sapling', name: 'Quick sapling', line: 'Reaches its forks sooner.' },
  { id: 'long-lived', name: 'Long-lived', line: 'Lives a little longer.' },
  { id: 'thick-skinned', name: 'Thick-skinned', line: 'Starts with thick bark.' },
  { id: 'tall-reaching', name: 'Tall-reaching', line: 'Starts with a tall leader.' },
  { id: 'drought-tolerant', name: 'Drought-tolerant', line: 'Dry spells do less harm.' },
  { id: 'bitter-sap', name: 'Bitter sap', line: 'Beetles do less harm.' },
  { id: 'night-blooming', name: 'Night-blooming', line: 'Night animals come sooner.' },
  { id: 'fragrant', name: 'Fragrant', line: 'Flower-lovers come sooner.' },
  { id: 'springy-wood', name: 'Springy wood', line: 'Tall leaders bend instead of snapping.' },
  { id: 'self-healing', name: 'Self-healing', line: 'Heals faster between troubles.' },
  { id: 'broad-leaves', name: 'Broad leaves', line: 'Catches more light.' },
  { id: 'welcoming', name: 'Welcoming', line: 'Room for one more animal.' },
  { id: 'many-seeded', name: 'Many-seeded', line: 'Drops one more seed.' },
  { id: 'sun-seeking', name: 'Sun-seeking', line: 'Tall leaders offered more often.' },
];
export const TRAIT: Record<TraitId, { id: TraitId; name: string; line: string }> = Object.fromEntries(TRAITS.map((t) => [t.id, t])) as never;

export type EventKind = 'storm' | 'dry' | 'lightning' | 'beetles' | 'fruiting' | 'migrants';
export const EVENT_KINDS: EventKind[] = ['storm', 'dry', 'lightning', 'beetles', 'fruiting', 'migrants'];
const EVENT_WEIGHT: Record<EventKind, number> = { storm: 3, dry: 2, lightning: 1.5, beetles: 1.5, fruiting: 2, migrants: 1.5 };
/** how long the weather of an event colours the hill, as a share of the tree's life */
export const WEATHER_SPAN = 0.03;

// ---------------------------------------------------------------- the saved inputs

export type Pick = { f: number; at: number; b: number };
export type TreeIn = {
  /** which tree on the hill this is, from 1 */
  n: number;
  seed: number;
  start: number;
  /** the player's time-zone offset in minutes east of UTC, fixed when the tree was planted, for dawn and night */
  tz: number;
  /** real hours a whole life takes at this tree's grow speed */
  hours: number;
  traits: TraitId[];
  picks: Pick[];
};
export type Seed = { trait: TraitId; lineage: TraitId[] };
export type TreeRecord = { n: number; start: number; fell: number; cause: 'age' | 'storm'; animals: AnimalId[]; traits: TraitId[] };
export type Save = {
  v: 1;
  sound: boolean;
  speed: 'normal' | 'slow';
  lastNow: number;
  tree: TreeIn;
  /** after a fall: the seeds the player kept (indices into fallSeeds), waiting to be planted */
  kept: number[] | null;
  journal: { seeds: Seed[]; traits: TraitId[]; animals: AnimalId[]; trees: TreeRecord[] };
};

// ---------------------------------------------------------------- randomness keyed by (seed, tag, index): no stream

function hash(seed: number, tag: number, i: number) {
  let h = (seed ^ Math.imul(tag + 0x9e3779b9, 0x85ebca6b) ^ Math.imul(i + 0x632be5ab, 0xc2b2ae35)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d); h = Math.imul(h ^ (h >>> 15), 0x846ca68b); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
const T = { life: 1, evTime: 2, evKind: 3, out: 4, offer: 5, tick: 6, seeds: 7, side: 8, mig: 9, next: 10, assist: 11 };
const r = (tin: TreeIn, tag: number, i: number, j = 0) => hash(tin.seed, tag * 7919 + j, i);

function weighted<K extends string>(w: Record<K, number>, x: number, keys: K[]): K {
  const tot = keys.reduce((a, k) => a + w[k], 0); let y = x * tot;
  for (const k of keys) { y -= w[k]; if (y < 0) return k; }
  return keys[keys.length - 1];
}

// ---------------------------------------------------------------- the derived tree

export type Branch = { id: number; bud: Bud | 'start'; side: -1 | 1; tier: number; angle: 0 | 1 | 2; born: number; broken: boolean; flower: boolean; fruit: number };
export type LogKind = 'plant' | 'fork' | 'pick' | 'assist' | EventKind | 'arrive' | 'leave' | 'visit' | 'break' | 'snap' | 'hollow' | 'brace' | 'fall';
export type LogEntry = { at: number; u: number; kind: LogKind; bud?: Bud; animal?: AnimalId; branch?: number; cause?: 'age' | 'storm'; harm?: number };
export type Resident = { id: AnimalId; since: number; branch: number };
export type TreeState = {
  n: number;
  /** the effective now (never behind the last one seen) */
  now: number;
  /** growth clock, in lives: 0 at planting, `life` at old age */
  u: number;
  life: number;
  /** real ms per unit of growth */
  ms: number;
  phase: 'growing' | 'fork' | 'fallen';
  fork: { k: number; offer: Bud[]; reached: number; assistAt: number; branch: Branch } | null;
  fell: { at: number; cause: 'age' | 'storm' } | null;
  forksDone: number;
  forks: number;
  branches: Branch[];
  hollows: { born: number; tier: number; side: -1 | 1 }[];
  roots: number;
  bark: number;
  tall: number;
  health: number;
  animals: Resident[];
  ever: AnimalId[];
  seen: AnimalId[];
  log: LogEntry[];
  /** what was picked at each fork, and whether the assist picked it */
  chosen: { bud: Bud; assist: boolean }[];
  storms: number;
  dry: number;
  beetles: number;
  /** real time of the next thing that will change the tree (Infinity when it waits for the player) */
  nextAt: number;
  /** the weather on the hill now, if a storm or a dry spell is passing */
  weather: 'storm' | 'dry' | null;
  traits: TraitId[];
};

export const forkCount = (tin: TreeIn) => (tin.n === 1 ? FIRST_FORKS : FORKS);
const has = (tin: TreeIn, t: TraitId) => tin.traits.includes(t);

export function shapeOf(s: TreeState): Shape {
  const live = s.branches.filter((b) => !b.broken);
  return {
    forks: s.forksDone, wide: live.filter((b) => b.bud === 'wide').length, tall: s.tall,
    flowers: live.filter((b) => b.flower).length, fruit: live.reduce((a, b) => a + b.fruit, 0),
    roots: s.roots, hollows: s.hollows.length, bark: s.bark, health: s.health,
  };
}
export const capacity = (s: TreeState) => {
  const sh = shapeOf(s);
  return 1 + sh.wide * 2 + Math.floor(s.branches.filter((b) => !b.broken).length / 3) + (s.traits.includes('welcoming') ? 1 : 0);
};

/** hour of the day (0-24) at a real time, in the tree's time zone */
export const hourAt = (tin: TreeIn, at: number) => ((((at / HOUR + tin.tz / 60) % 24) + 24) % 24);
export type DayPart = 'dawn' | 'day' | 'dusk' | 'night';
export const dayPart = (h: number): DayPart => (h >= 5.5 && h < 8 ? 'dawn' : h >= 8 && h < 17.5 ? 'day' : h >= 17.5 && h < 20 ? 'dusk' : 'night');

type Item = { u: number; kind: 'fork' | 'event' | 'tick' | 'age'; i: number };

/** the fixed plan of a tree: its life, when its forks come, and its weather, all from the seed */
export function plan(tin: TreeIn) {
  const F = forkCount(tin);
  let life = 1.0 + (r(tin, T.life, 0) - 0.5) * 0.16;
  if (has(tin, 'long-lived')) life *= 1.12;
  const gap = 1 / (F + 1), quick = has(tin, 'quick-sapling') ? 0.8 : 1;
  const items: Item[] = [];
  for (let k = 0; k < F; k++) items.push({ u: (k + 0.7) * gap * quick + (quick < 1 ? k * gap * 0.06 : 0), kind: 'fork', i: k });
  const E = tin.n === 1 ? 5 : 10;
  const kinds: EventKind[] = [];
  for (let i = 0; i < E; i++) {
    let kind = weighted(EVENT_WEIGHT, r(tin, T.evKind, i), EVENT_KINDS);
    // the tutorial tree always shows a storm and a fruiting season
    if (tin.n === 1 && i === 2) kind = 'fruiting';
    if (tin.n === 1 && i === 3) kind = 'storm';
    kinds.push(kind);
    items.push({ u: (0.06 + 0.9 * (i + r(tin, T.evTime, i)) / E) * life, kind: 'event', i });
  }
  for (let t = 1; t <= TICKS * 2; t++) if (t / TICKS < life) items.push({ u: t / TICKS, kind: 'tick', i: t });
  items.push({ u: life, kind: 'age', i: 0 });
  const order = { fork: 0, event: 1, tick: 2, age: 3 };
  items.sort((a, b) => a.u - b.u || order[a.kind] - order[b.kind] || a.i - b.i);
  return { life, items, kinds, F };
}

/** the bud types a fork offers: three different ones */
export function offerAt(tin: TreeIn, k: number): Bud[] {
  const w: Record<Bud, number> = { wide: 1, tall: 1, flower: 1, root: 1, hollow: 1, bark: 1 };
  if (has(tin, 'sun-seeking')) w.tall = 2.2;
  const out: Bud[] = [];
  for (let j = 0; out.length < 3; j++) {
    const left = BUDS.filter((b) => !out.includes(b));
    out.push(weighted(w, r(tin, T.offer, k, j), left));
  }
  // the tutorial tree's first fork shows the three easiest-to-see buds
  if (tin.n === 1 && k === 0) return ['wide', 'flower', 'tall'];
  return out;
}

/** the assist's choice: the bud that fills the tree's biggest gap, in the order offered when it's a tie */
export function assistPick(s: TreeState, offer: Bud[]): number {
  const sh = shapeOf(s);
  const need: Record<Bud, number> = {
    wide: 2 - sh.wide, tall: 1.5 - sh.tall, flower: 2 - sh.flowers, root: 1.6 - sh.roots, hollow: 1.2 - sh.hollows,
    bark: (s.health < 60 ? 2 : 1.3) - sh.bark,
  };
  let best = 0;
  offer.forEach((b, i) => { if (need[b] > need[offer[best]] + 1e-9) best = i; });
  return best;
}

function newBranch(s: TreeState, bud: Bud | 'start', k: number, born: number, tin: TreeIn): Branch {
  const side: -1 | 1 = k % 2 === 0 ? (r(tin, T.side, 0) < 0.5 ? -1 : 1) : (s.branches.length && s.branches[s.branches.length - 1].side === 1 ? -1 : 1);
  const angle: 0 | 1 | 2 = bud === 'wide' ? 0 : bud === 'tall' ? 2 : 1;
  // the fork climbs the trunk as the tree grows; wide branches stay low
  const tier = bud === 'wide' ? Math.min(0.45, 0.25 + k * 0.03) : Math.min(0.92, 0.3 + k * 0.08);
  return { id: s.branches.length, bud, side, tier, angle, born, broken: false, flower: bud === 'flower', fruit: 0 };
}

function freshState(tin: TreeIn, life: number, F: number): TreeState {
  const s: TreeState = {
    n: tin.n, now: tin.start, u: 0, life, ms: tin.hours * HOUR, phase: 'growing', fork: null, fell: null, forksDone: 0, forks: F,
    branches: [], hollows: [], roots: 0, bark: 0, tall: 0, health: 80, animals: [], ever: [], seen: [], log: [], chosen: [],
    storms: 0, dry: 0, beetles: 0, nextAt: Infinity, weather: null, traits: [...tin.traits],
  };
  if (has(tin, 'early-flowering')) s.branches.push({ ...newBranch(s, 'flower', 0, 0, tin), tier: 0.4 });
  if (has(tin, 'wide-crown')) s.branches.push({ ...newBranch(s, 'wide', 1, 0, tin), tier: 0.3 });
  if (has(tin, 'deep-taproot')) s.roots++;
  if (has(tin, 'thick-skinned')) s.bark++;
  if (has(tin, 'tall-reaching')) s.tall++;
  s.log.push({ at: tin.start, u: 0, kind: 'plant' });
  return s;
}

function applyBud(s: TreeState, tin: TreeIn, k: number, bud: Bud, u: number) {
  const b = newBranch(s, bud, k, u, tin);
  s.branches.push(b);
  if (bud === 'tall') s.tall++;
  if (bud === 'root') s.roots++;
  if (bud === 'bark') s.bark++;
  if (bud === 'hollow') s.hollows.push({ born: u, tier: 0.35 + 0.12 * (s.hollows.length % 4), side: b.side });
  s.forksDone = k + 1;
}

const lose = (s: TreeState, harm: number) => { s.health = Math.max(0, s.health - harm); return harm; };
const residents = (s: TreeState, ids: AnimalId[]) => s.animals.filter((a) => ids.includes(a.id)).length;

function event(s: TreeState, tin: TreeIn, kind: EventKind, i: number, at: number, u: number) {
  const o = (j: number) => r(tin, T.out, i, j);
  const sh = shapeOf(s);
  const entry: LogEntry = { at, u, kind };
  if (kind === 'storm') {
    s.storms++;
    // Dora braces the branch most likely to break before the storm arrives
    const live = s.branches.filter((b) => !b.broken);
    const risk = (b: Branch) => (b.bud === 'tall' ? 3 : b.angle === 0 ? 2 : 1) + (b.flower ? 0.5 : 0) - b.id * 0.01;
    const braced = live.length ? live.reduce((a, b) => (risk(b) > risk(a) ? b : a)) : null;
    if (braced) s.log.push({ at, u, kind: 'brace', branch: braced.id });
    const hardy = has(tin, 'storm-hardy') ? 0.5 : 1;
    if (s.tall > 0) {
      const snap = (0.14 + 0.07 * s.tall) * hardy * (has(tin, 'springy-wood') ? 0.3 : 1) * (braced?.bud === 'tall' ? 0.6 : 1);
      if (o(0) < snap) {
        s.tall--;
        const top = [...live].reverse().find((b) => b.bud === 'tall');
        if (top) top.broken = true;
        s.log.push({ at, u, kind: 'snap', branch: top?.id });
      }
    }
    live.forEach((b, j) => {
      if (b.broken || b.bud === 'tall') return;
      const weak = s.health < 50 ? 0.16 : 0.05;
      if (o(10 + j) < weak * hardy * (b === braced ? 0.4 : 1) * (b.angle === 0 ? 1.4 : 1)) {
        b.broken = true; b.fruit = 0; s.log.push({ at, u, kind: 'break', branch: b.id });
      }
    });
    entry.harm = lose(s, Math.max(2, 9 - s.bark * 2.5) * hardy);
    s.log.push(entry);
    if (s.health < 30 && o(1) < 0.55) fall(s, at, u, 'storm');
    return;
  }
  if (kind === 'dry') {
    s.dry++;
    let harm = Math.max(2, 22 - sh.roots * 8);
    if (has(tin, 'drought-tolerant')) harm *= 0.5;
    if (sh.roots === 0) s.branches.forEach((b) => { b.fruit = Math.max(0, b.fruit - 1); });
    entry.harm = lose(s, harm);
  } else if (kind === 'lightning') {
    entry.harm = lose(s, Math.max(2, 22 - s.bark * 8));
    if (o(0) < (has(tin, 'hollow-prone') ? 0.8 : 0.4)) {
      const side: -1 | 1 = o(1) < 0.5 ? -1 : 1;
      s.hollows.push({ born: u, tier: 0.3 + 0.5 * o(2), side });
      s.log.push(entry); s.log.push({ at, u, kind: 'hollow' });
      return;
    }
  } else if (kind === 'beetles') {
    s.beetles++;
    let harm = Math.max(0, 18 - s.bark * 5 - residents(s, BEETLE_EATERS) * 5);
    if (has(tin, 'bitter-sap')) harm *= 0.5;
    entry.harm = lose(s, harm);
  } else if (kind === 'fruiting') {
    const extra = has(tin, 'sweet-fruit') ? 2 : 1;
    const pollen = residents(s, POLLINATORS);
    for (const b of s.branches) if (b.flower && !b.broken) b.fruit = Math.min(4, b.fruit + extra + (pollen ? 1 : 0));
  } else if (kind === 'migrants') {
    // a visitor passes through: seen and written in the journal, even if it doesn't stay
    const away = ANIMALS.filter((a) => !s.animals.some((x) => x.id === a.id));
    const pick = away[Math.floor(o(0) * away.length)];
    if (pick) { entry.animal = pick.id; if (!s.seen.includes(pick.id)) s.seen.push(pick.id); }
  }
  s.log.push(entry);
}

function fall(s: TreeState, at: number, u: number, cause: 'age' | 'storm') {
  s.phase = 'fallen'; s.fell = { at, cause }; s.u = u;
  for (const a of s.animals) s.log.push({ at, u, kind: 'leave', animal: a.id });
  s.animals = [];
  s.log.push({ at, u, kind: 'fall', cause });
}

function tick(s: TreeState, tin: TreeIn, i: number, at: number, u: number) {
  const night = dayPart(hourAt(tin, at)) === 'night';
  const day = dayPart(hourAt(tin, at)) === 'day';
  const sh = shapeOf(s);
  // animals whose home has gone move on
  for (const a of [...s.animals]) {
    const def = ANIMAL[a.id];
    if (!def.ok(sh)) { s.animals = s.animals.filter((x) => x !== a); s.log.push({ at, u, kind: 'leave', animal: a.id }); }
  }
  // the residents help or cost
  let heal = 1.6 + (has(tin, 'self-healing') ? 1.4 : 0) + (has(tin, 'broad-leaves') ? 0.6 : 0) + s.tall * 0.4;
  for (const a of s.animals) {
    if (a.id === 'koel') heal += 1;
    if (a.id === 'colugo' || a.id === 'birdwing') heal -= 0.8;
    if (a.id === 'loris') heal -= 0.6;
    if (a.id === 'squirrel' && r(tin, T.tick, i, 1) < 0.5) {
      const fb = s.branches.find((b) => b.fruit > 0); if (fb) fb.fruit--;
    }
  }
  s.health = Math.max(0, Math.min(100, s.health + heal));
  // pollinators slowly set fruit between fruiting seasons
  if (residents(s, POLLINATORS) && r(tin, T.tick, i, 2) < 0.3) {
    const fb = s.branches.find((b) => b.flower && !b.broken && b.fruit < 3); if (fb) fb.fruit++;
  }
  // one animal at most looks for a home each tick
  const room = capacity(s) - s.animals.length;
  if (room <= 0) return;
  const sh2 = shapeOf(s);
  const want = ANIMALS.filter((a) => !s.animals.some((x) => x.id === a.id) && a.ok(sh2) && (!a.night || night || (has(tin, 'night-blooming') && a.id === 'bat')) && (!a.day || day));
  if (!want.length) return;
  let chance = 0.4;
  if (has(tin, 'fragrant') && want.some((a) => ['sunbird', 'bees', 'birdwing'].includes(a.id))) chance = 0.65;
  if (has(tin, 'night-blooming') && night) chance = 0.65;
  if (r(tin, T.tick, i, 3) >= chance) return;
  const a = want[Math.floor(r(tin, T.tick, i, 4) * want.length)];
  const live = s.branches.filter((b) => !b.broken);
  const branch = live.length ? live[Math.floor(r(tin, T.tick, i, 5) * live.length)].id : -1;
  s.animals.push({ id: a.id, since: at, branch });
  if (!s.ever.includes(a.id)) s.ever.push(a.id);
  if (!s.seen.includes(a.id)) s.seen.push(a.id);
  s.log.push({ at, u, kind: 'arrive', animal: a.id });
}

/**
 * The tree at `now`, replayed from its planting. `now` must already be clamped (see `clampNow`). Picks are matched to
 * forks by number; a pick stamped after the assist's time for its fork is ignored, because the assist took that fork.
 */
export function derive(tin: TreeIn, now: number): TreeState {
  const { life, items, kinds, F } = plan(tin);
  const s = freshState(tin, life, F);
  const ms = s.ms;
  let waited = 0;
  const realAt = (u: number) => tin.start + u * ms + waited;
  s.now = now;
  for (const it of items) {
    const at = realAt(it.u);
    if (at > now) { s.u = Math.max(0, (now - tin.start - waited) / ms); s.nextAt = at; break; }
    s.u = it.u;
    if (it.kind === 'fork') {
      const k = it.i, offer = offerAt(tin, k);
      const p = tin.picks.find((q) => q.f === k);
      const assistAt = at + ASSIST_WAIT;
      let b: number, resume: number, assist = false;
      if (p && p.at < assistAt) { b = Math.max(0, Math.min(2, p.b)); resume = Math.max(p.at, at); }
      else if (now >= assistAt) { b = assistPick(s, offer); resume = assistAt; assist = true; }
      else {
        s.phase = 'fork';
        s.fork = { k, offer, reached: at, assistAt, branch: newBranch(s, offer[0], k, it.u, tin) };
        s.log.push({ at, u: it.u, kind: 'fork' });
        s.nextAt = assistAt;
        return finish(s, tin);
      }
      s.log.push({ at, u: it.u, kind: 'fork' });
      waited += resume - at;
      applyBud(s, tin, k, offer[b], it.u);
      s.chosen.push({ bud: offer[b], assist });
      s.log.push({ at: resume, u: it.u, kind: assist ? 'assist' : 'pick', bud: offer[b] });
    } else if (it.kind === 'event') {
      event(s, tin, kinds[it.i], it.i, at, it.u);
    } else if (it.kind === 'tick') {
      tick(s, tin, it.i, at, it.u);
    } else {
      fall(s, at, it.u, 'age');
    }
    if (s.phase === 'fallen') { s.nextAt = Infinity; return finish(s, tin); }
  }
  return finish(s, tin);
}

function finish(s: TreeState, tin: TreeIn): TreeState {
  // the weather on the hill: a storm or dry spell colours the scene for a little while after it starts
  s.weather = null;
  if (s.phase !== 'fallen') {
    for (let i = s.log.length - 1; i >= 0; i--) {
      const e = s.log[i];
      if (e.kind !== 'storm' && e.kind !== 'dry') continue;
      if (s.u - e.u < WEATHER_SPAN) s.weather = e.kind;
      break;
    }
  }
  void tin;
  return s;
}

/** the seeds a fallen tree drops, each carrying one trait: some earned by its life, some from its parent, some new */
export function fallSeeds(tin: TreeIn, s: TreeState): Seed[] {
  if (!s.fell) return [];
  const sh = shapeOf(s);
  const earned: TraitId[] = [];
  if (sh.wide >= 2) earned.push('wide-crown');
  if (sh.roots >= 2) earned.push('deep-taproot');
  if (s.hollows.length >= 2) earned.push('hollow-prone');
  if (s.storms >= 2 && s.fell.cause === 'age') earned.push('storm-hardy');
  if (s.branches.some((b) => b.flower && b.born < 0.35)) earned.push('early-flowering');
  if (s.ever.includes('squirrel') || s.ever.includes('koel')) earned.push('sweet-fruit');
  if (s.bark >= 2) earned.push('thick-skinned');
  if (s.tall >= 2) earned.push('tall-reaching');
  if (s.dry >= 1 && sh.roots >= 1) earned.push('drought-tolerant');
  if (s.beetles >= 1 && s.bark >= 1) earned.push('bitter-sap');
  if (s.ever.includes('bat')) earned.push('night-blooming');
  if (s.ever.includes('bees') || s.ever.includes('sunbird')) earned.push('fragrant');
  if (s.fell.cause === 'age') earned.push('long-lived');
  if (s.health >= 80) earned.push('self-healing');
  if (s.ever.length >= 4) earned.push('welcoming');
  const n = Math.min(6, 4 + (s.ever.includes('hornbill') ? 1 : 0) + (has(tin, 'many-seeded') ? 1 : 0));
  const out: Seed[] = [];
  for (let i = 0; out.length < n && i < 60; i++) {
    const x = r(tin, T.seeds, i, 0), y = r(tin, T.seeds, i, 1);
    const pool: TraitId[] = x < 0.5 && earned.length ? earned : x < 0.65 && tin.traits.length ? tin.traits : TRAITS.map((t) => t.id);
    const t = pool[Math.floor(y * pool.length)];
    if (out.some((o) => o.trait === t)) continue;
    out.push({ trait: t, lineage: tin.traits.filter((q) => q !== t).slice(0, 2) });
  }
  return out;
}

/** a planted seed's traits: its own, then up to two of its parent's */
export const traitsOf = (seed: Seed): TraitId[] => [seed.trait, ...seed.lineage.filter((t) => t !== seed.trait)].slice(0, 3);

// ---------------------------------------------------------------- the save

export function newTree(n: number, seed: number, start: number, tz: number, speed: Save['speed'], traits: TraitId[]): TreeIn {
  const hours = n === 1 ? FIRST_TREE_MINUTES / 60 : speed === 'slow' ? SLOW_HOURS : TREE_HOURS;
  return { n, seed: seed >>> 0, start, tz, hours, traits, picks: [] };
}

export function newSave(now: number, seed: number, tz = 0): Save {
  return { v: 1, sound: true, speed: 'normal', lastNow: now, tree: newTree(1, seed, now, tz, 'normal', []), kept: null, journal: { seeds: [], traits: [], animals: [], trees: [] } };
}

/** the device clock may go backwards; the tree never does */
export const clampNow = (save: Save, now: number) => Math.max(now, save.lastNow);

/** a check-in: the tree as of now, and the save with the clock moved on and the journal brought up to date */
export function checkIn(save: Save, now: number): { save: Save; tree: TreeState } {
  const t = clampNow(save, now);
  const tree = derive(save.tree, t);
  const animals = [...save.journal.animals];
  for (const a of tree.seen) if (!animals.includes(a)) animals.push(a);
  const traits = [...save.journal.traits];
  for (const q of save.tree.traits) if (!traits.includes(q)) traits.push(q);
  return { save: { ...save, lastNow: t, journal: { ...save.journal, animals, traits } }, tree };
}

/** the decision the tree is waiting for, if any: only ever one */
export type Decision = { kind: 'bud'; offer: Bud[] } | { kind: 'keep'; seeds: Seed[] } | { kind: 'plant'; kept: Seed[] } | null;
export function decision(save: Save, tree: TreeState): Decision {
  if (tree.phase === 'fork' && tree.fork) return { kind: 'bud', offer: tree.fork.offer };
  if (tree.phase === 'fallen') {
    const seeds = fallSeeds(save.tree, tree);
    if (!save.kept) return { kind: 'keep', seeds };
    return { kind: 'plant', kept: save.kept.map((i) => seeds[i]).filter(Boolean) };
  }
  return null;
}

/** pick bud `b` (0-2) at the fork that is waiting now; anything else leaves the save alone */
export function pickBud(save: Save, now: number, b: number): Save {
  const t = clampNow(save, now);
  const tree = derive(save.tree, t);
  if (tree.phase !== 'fork' || !tree.fork || b < 0 || b > 2) return save;
  return { ...save, lastNow: t, tree: { ...save.tree, picks: [...save.tree.picks, { f: tree.fork.k, at: t, b }] } };
}

/** keep up to three of a fallen tree's seeds */
export function keepSeeds(save: Save, now: number, idx: number[]): Save {
  const t = clampNow(save, now);
  const tree = derive(save.tree, t);
  if (tree.phase !== 'fallen' || save.kept) return save;
  const n = fallSeeds(save.tree, tree).length;
  const kept = [...new Set(idx)].filter((i) => i >= 0 && i < n).slice(0, KEEP);
  if (!kept.length) return save;
  return { ...save, lastNow: t, kept };
}

/**
 * Plant a seed: one of the kept ones (`from: 'kept'`) or one saved in Enzo's journal (`from: 'journal'`). The other kept
 * seeds go into the journal, the fallen tree joins the hill, and a new tree starts now.
 */
export function plant(save: Save, now: number, from: 'kept' | 'journal', i: number, tz = save.tree.tz): Save {
  const t = clampNow(save, now);
  const tree = derive(save.tree, t);
  if (tree.phase !== 'fallen' || !save.kept || !tree.fell) return save;
  const seeds = fallSeeds(save.tree, tree);
  const kept = save.kept.map((k) => seeds[k]).filter(Boolean);
  let journalSeeds = [...save.journal.seeds];
  let seed: Seed | undefined;
  if (from === 'kept') { seed = kept[i]; if (!seed) return save; journalSeeds.push(...kept.filter((_, j) => j !== i)); }
  else { seed = journalSeeds[i]; if (!seed) return save; journalSeeds = journalSeeds.filter((_, j) => j !== i); journalSeeds.push(...kept); }
  journalSeeds = journalSeeds.slice(-JOURNAL_SEEDS);
  const traits = [...save.journal.traits];
  for (const s of seeds) if (!traits.includes(s.trait)) traits.push(s.trait);
  const animals = [...save.journal.animals];
  for (const a of tree.seen) if (!animals.includes(a)) animals.push(a);
  const rec: TreeRecord = { n: save.tree.n, start: save.tree.start, fell: tree.fell.at, cause: tree.fell.cause, animals: tree.ever, traits: save.tree.traits };
  const next = newTree(save.tree.n + 1, hash(save.tree.seed, 99, save.tree.n) * 4294967296, t, tz, save.speed, traitsOf(seed));
  return { ...save, lastNow: t, kept: null, tree: next, journal: { seeds: journalSeeds, traits, animals, trees: [...save.journal.trees, rec] } };
}

/** the earlier trees on the hill: each slot holds the newest tree that fell there, at a stage set by how long ago */
export type HillSpot = { slot: number; n: number; stage: 'stump' | 'sapling' | 'young' };
export function hill(save: Save): HillSpot[] {
  const out: HillSpot[] = [];
  for (const rec of save.journal.trees.slice(-HILL_SLOTS)) {
    const ago = save.tree.n - rec.n;
    out.push({ slot: (rec.n - 1) % HILL_SLOTS, n: rec.n, stage: ago <= 1 ? 'stump' : ago <= 3 ? 'sapling' : 'young' });
  }
  return out;
}

/** a coarse age for the panel: words, never a ticking number */
export function ageWord(s: TreeState): string {
  if (s.phase === 'fallen') return 'fallen';
  const f = s.u / s.life;
  return f < 0.08 ? 'a seedling' : f < 0.25 ? 'a sapling' : f < 0.5 ? 'young' : f < 0.8 ? 'grown' : 'old';
}

/** one short line for the latest happening */
export function describe(e: LogEntry, s?: TreeState): string {
  const a = e.animal ? ANIMAL[e.animal].name : '';
  const art = (n: string) => (/^[AEIOU]/.test(n) ? 'An' : 'A');
  switch (e.kind) {
    case 'plant': return 'Enzo planted a seed.';
    case 'fork': return 'A branch reached a fork.';
    case 'pick': return `${BUD_INFO[e.bud!].name} chosen.`;
    case 'assist': return `The tree grew a ${BUD_INFO[e.bud!].name.toLowerCase()} on its own.`;
    case 'storm': return 'A storm passed over the hill.';
    case 'dry': return 'A dry spell.';
    case 'lightning': return 'Lightning struck the tree.';
    case 'beetles': return e.harm ? 'Beetles got under the bark.' : 'Beetles came, and were eaten.';
    case 'fruiting': return 'A fruiting season.';
    case 'migrants': return a ? `${art(a)} ${a} passed through.` : 'Migrants passed through.';
    case 'arrive': return `${art(a)} ${a} moved in.`;
    case 'leave': return `The ${a} moved on.`;
    case 'visit': return `${art(a)} ${a} visited.`;
    case 'break': return 'A branch broke in the wind.';
    case 'snap': return 'The tall leader snapped.';
    case 'hollow': return 'Lightning opened a hollow.';
    case 'brace': return 'Dora braced a branch.';
    case 'fall': return e.cause === 'storm' ? 'The tree came down in the storm.' : 'The old tree lay down.';
  }
  void s;
  return '';
}

/** the latest happening worth showing (Dora's bracing is shown, not told) */
export function latest(s: TreeState): LogEntry {
  for (let i = s.log.length - 1; i >= 0; i--) if (s.log[i].kind !== 'brace' && s.log[i].kind !== 'fork') return s.log[i];
  return s.log[0];
}

// ---------------------------------------------------------------- the save on disk

export function serialise(s: Save) { return JSON.stringify(s); }
export function parseSave(raw: string | null, now: number, seed: number, tz: number): Save {
  const fresh = newSave(now, seed, tz);
  if (!raw) return fresh;
  try {
    const o = JSON.parse(raw);
    if (!o || o.v !== 1 || !o.tree || typeof o.tree.seed !== 'number' || typeof o.tree.start !== 'number' || !Array.isArray(o.tree.picks)) return fresh;
    const traits = (a: unknown): TraitId[] => (Array.isArray(a) ? a.filter((t): t is TraitId => typeof t === 'string' && t in TRAIT) : []);
    const animals = (a: unknown): AnimalId[] => (Array.isArray(a) ? a.filter((t): t is AnimalId => typeof t === 'string' && t in ANIMAL) : []);
    const tree: TreeIn = {
      n: Math.max(1, Math.floor(Number(o.tree.n) || 1)), seed: o.tree.seed >>> 0, start: o.tree.start, tz: Number(o.tree.tz) || 0,
      hours: Number(o.tree.hours) > 0 ? Number(o.tree.hours) : TREE_HOURS, traits: traits(o.tree.traits).slice(0, 3),
      picks: o.tree.picks.filter((p: Pick) => p && Number.isInteger(p.f) && typeof p.at === 'number' && Number.isInteger(p.b)).map((p: Pick) => ({ f: p.f, at: p.at, b: p.b })),
    };
    const j = o.journal ?? {};
    return {
      v: 1, sound: o.sound !== false, speed: o.speed === 'slow' ? 'slow' : 'normal', lastNow: Number(o.lastNow) || tree.start, tree,
      kept: Array.isArray(o.kept) ? o.kept.filter((i: unknown) => Number.isInteger(i)).slice(0, KEEP) : null,
      journal: {
        seeds: Array.isArray(j.seeds) ? j.seeds.filter((s: Seed) => s && (s.trait in TRAIT)).map((s: Seed) => ({ trait: s.trait, lineage: traits(s.lineage).slice(0, 2) })).slice(-JOURNAL_SEEDS) : [],
        traits: traits(j.traits), animals: animals(j.animals),
        trees: Array.isArray(j.trees) ? j.trees.filter((t: TreeRecord) => t && Number.isInteger(t.n)).map((t: TreeRecord) => ({ n: t.n, start: Number(t.start) || 0, fell: Number(t.fell) || 0, cause: t.cause === 'storm' ? 'storm' : 'age', animals: animals(t.animals), traits: traits(t.traits) })) : [],
      },
    };
  } catch { return fresh; }
}
