// Driftwood Post's rules: a little post boat sailing Lake Whisker by the wind. Deterministic and DOM-free, stepped at
// 30 ticks a second; a seed and the same inputs replay a voyage exactly. The weather, the wind's shifts and the side
// deliveries come from two seeded generators whose states are saved with the voyage.
//
// Sailing, kept simple and readable: the boat's speed is the wind's strength times a polar curve of the angle between
// the heading and the wind (nothing inside the no-go zone, best on a beam reach), eased in and out so tacking through
// the wind costs speed. The rudder turns harder at speed. Currents and leeway push the boat along, reeds slow it, and
// rocks bump it back. Docking opens an island's post office: pick up letters and parcels, hand over what's for them.
// The world itself (islands, rocks, currents, the letters) lives in driftwood-world.ts.
import {
  LAKE_W, LAKE_H, ISLANDS, ISLAND, VILLAGES, ROCKS, STORY, SIDE_POOL, RESIDENTS, SHELLS, BOTTLES,
  insidePoly, nearestOnPoly, clearance, edgeDist, inReeds, currentAt, fogDepth,
  type IslandId, type ResidentId, type StoryDef,
} from './driftwood-world.js';

export * from './driftwood-world.js';

export const HZ = 30, DT = 1 / HZ;
export const SAVE_KEY = 'driftwood-post-v1';
const TAU = Math.PI * 2, DEG = Math.PI / 180;

// ---------------------------------------------------------------- numbers
/** The boat's collision radius, in lake units. */
export const BOAT_R = 13;
/** Lake units a tick at full wind (strength 1) on a beam reach, with no upgrades: about 100 a second. */
export const MAX_SPEED = 3.3;
/** Inside this angle of the wind the sail can't drive the boat. The keel upgrade lets it point higher. */
export const NO_GO = 42 * DEG, KEEL_NO_GO = 34 * DEG;
/** Leeway: how much of the wind's push slips the boat sideways, a tick per unit of wind (the keel halves it). */
export const LEEWAY = 0.2;
/** Turning, radians a tick at full rudder: a little when stopped, much more at speed. */
export const TURN_SLOW = 0.026, TURN_FAST = 0.04;
/** Easing toward the target speed, a tick: speeding up, slowing down, and the gentler coast through the no-go zone
 * (the boat carries its way through a tack, losing about half its speed on a brisk one). */
export const ACCEL = 0.022, DECEL = 0.04, IRONS = 0.016;
/** The anchor (and asking to dock while too fast) keeps this much speed a tick. */
export const BRAKE = 0.9;
/** Reeds keep this share of the target speed; each heavy parcel takes this share off, down to the floor. */
export const REED_SLOW = 0.42, HEAVY_SLOW = 0.08, HEAVY_FLOOR = 0.76;
/** A bigger sail adds this much speed per level. */
export const SAIL_BONUS = 0.12;
/** Docking: ask within DOCK_REACH of the jetty's end below DOCK_SPEED; or drift in slowly and it ties up by itself. */
export const DOCK_REACH = 120, DOCK_SPEED = 1.0, AUTO_DOCK = 48, AUTO_SPEED = 0.5;
/** Bumps: an impact faster than this (into the shore) scuffs the hull; three scuffs and Enzo stops to patch it. */
export const BUMP_SPEED = 1.0, SCUFFS = 3, SCUFF_GAP = 24, PATCH_TICKS = 4 * HZ;
/** A day lasts six real minutes: 10,800 ticks for 1,440 minutes. Voyages start just before seven in the morning. */
export const DAY_TICKS = 6 * 60 * HZ, MIN_PER_TICK = 1440 / DAY_TICKS, START_MINUTE = 6 * 60 + 40;
/** How far you can see, in lake units: by day, at night, at night with the lantern; fog and rain shrink it. */
export const SIGHT_DAY = 560, SIGHT_NIGHT = 290, SIGHT_LANTERN = 480, FOG_SIGHT = 0.42, FOG_LANTERN = 0.62, RAIN_SIGHT = 0.8;
/** Without the spyglass, the next delivery's arrow shows within this distance of the island. */
export const ARROW_RANGE = 1500;
/** Bag size, and the most the crates can make it. */
export const BAG = 3, BAG_MAX = 6;
/** Picking up a hidden shell or a bottle: sail within this distance. */
export const GRAB = 36;
/** Shells for each hidden shell and each bottle. */
export const SHELL_VALUE = 5, BOTTLE_VALUE = 3;
/** The chart is a grid of CHART_CELL-unit squares, revealed as the boat sees them. */
export const CHART_CELL = 50, CHART_W = Math.ceil(LAKE_W / CHART_CELL), CHART_H = Math.ceil(LAKE_H / CHART_CELL);
/** Pay, in shells: story letters and parcels, side letters and parcels, a heavy parcel's extra, and the bonuses. */
export const PAY = { letter: 5, parcel: 7, sideLetter: 3, sideParcel: 5, heavy: 2, express: 4, intact: 3 };
/** Side deliveries start once Tamsin has her letter (story 4) and the boatyard opens. */
export const SIDE_FROM = 4, SHOP_FROM = 4;

export type UpId = 'sail' | 'keel' | 'crates' | 'lantern' | 'spyglass' | 'hull';
export const UP_IDS: UpId[] = ['sail', 'keel', 'crates', 'lantern', 'spyglass', 'hull'];
export const UPGRADES: Record<UpId, { name: string; icon: string; prices: number[]; text: string }> = {
  sail: { name: 'Bigger sail', icon: '⛵', prices: [30, 60], text: `A larger patched sail: +${SAIL_BONUS * 100}% speed for each level.` },
  keel: { name: 'Deep keel', icon: '⚓', prices: [40], text: `Points ${Math.round((NO_GO - KEEL_NO_GO) / DEG)}° closer to the wind and slips sideways half as much.` },
  crates: { name: 'Mail crates', icon: '📦', prices: [20, 35, 55], text: 'One more bag slot each, up to six.' },
  lantern: { name: 'Lantern', icon: '🏮', prices: [30], text: 'See much further at night and in fog.' },
  spyglass: { name: 'Spyglass', icon: '🔭', prices: [25], text: 'The next delivery’s arrow shows from anywhere on the lake.' },
  hull: { name: 'Sturdy hull', icon: '🛡️', prices: [50], text: 'Bumps don’t scuff the boat or jostle parcels.' },
};

// ---------------------------------------------------------------- weather
export type WeatherId = 'calm' | 'breeze' | 'gusty' | 'squall';
export const WEATHER: Record<WeatherId, { name: string; str: number; gust: number; min: number; max: number; shiftMin: number; shiftMax: number; swing: number; weight: number }> = {
  calm: { name: 'Calm', str: 0.55, gust: 0.06, min: 60, max: 120, shiftMin: 30, shiftMax: 60, swing: 30, weight: 18 },
  breeze: { name: 'Breezy', str: 0.85, gust: 0.08, min: 80, max: 170, shiftMin: 25, shiftMax: 55, swing: 40, weight: 45 },
  gusty: { name: 'Gusty', str: 0.92, gust: 0.26, min: 60, max: 130, shiftMin: 18, shiftMax: 40, swing: 45, weight: 25 },
  squall: { name: 'Rain squall', str: 1.18, gust: 0.2, min: 25, max: 45, shiftMin: 8, shiftMax: 16, swing: 55, weight: 12 },
};
/** The wind mostly blows from the west-south-west and swings at most this far either side of it. */
export const PREVAIL = -0.3, PREVAIL_SWING = 115 * DEG;

// ---------------------------------------------------------------- helpers
export const wrap = (a: number) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
/** mulberry32, one step: returns [value in 0..1, next state]. */
export function rnd(state: number): [number, number] {
  const s = (state + 0x6d2b79f5) >>> 0; let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, s];
}

/**
 * The polar curve: the share of full speed at an angle `twa` (radians, 0 = head to wind, π = dead downwind) off the
 * wind. Nothing inside the no-go zone, a quick rise to 62% close-hauled, a peak of 100% on a beam reach, and 62%
 * dead downwind.
 */
export function polar(twa: number, noGo = NO_GO) {
  const a = Math.abs(twa);
  if (a < noGo) return 0;
  const band = 8 * DEG;
  if (a < noGo + band) { const u = (a - noGo) / band; return 0.62 * u * u * (3 - 2 * u); }
  if (a <= Math.PI / 2) { const u = (a - noGo - band) / (Math.PI / 2 - noGo - band); return 0.62 + 0.38 * Math.sin(u * Math.PI / 2); }
  return 1 - 0.38 * Math.pow((a - Math.PI / 2) / (Math.PI / 2), 1.4);
}
/** The best sheet setting at an angle off the wind: hauled tight close-hauled, let right out on a run. */
export const idealSheet = (twa: number, noGo = NO_GO) => clamp((Math.abs(twa) - noGo) / (Math.PI - noGo), 0.04, 1);
/** Speed share for a sheet that is `err` away from ideal (manual trim): the sweet spot beats auto-trim by 8%. */
export const trimFactor = (err: number) => clamp(1.08 - 1.4 * Math.pow(Math.abs(err), 1.25), 0.5, 1.08);

// ---------------------------------------------------------------- types
export type Input = { steer: number; trim: number | null; anchor: boolean; dock: boolean };
export const idleInput = (): Input => ({ steer: 0, trim: null, anchor: false, dock: false });

export type Item = {
  id: string; story: number; from: IslandId; to: IslandId; sender: ResidentId; recipient: ResidentId;
  title: string; text: string; parcel: boolean; heavy: boolean; fragile: boolean;
  /** Minutes allowed for an express delivery (0 when not express). */
  express: number; pay: number;
  /** The game minute it was picked up, when it's due, and whether a bump has jostled it. */
  got: number; due: number; jostled: boolean;
};
export type Phase = 'sail' | 'dock' | 'patch' | 'ending';
export type Ev =
  | { k: 'tack' } | { k: 'gybe' }
  | { k: 'bump'; x: number; y: number; hard: boolean; power: number }
  | { k: 'scuff'; n: number; jostled: string[] } | { k: 'patch' } | { k: 'patched' }
  | { k: 'dock'; id: IslandId } | { k: 'castoff'; id: IslandId } | { k: 'slow' }
  | { k: 'pickup'; item: Item } | { k: 'deliver'; item: Item; pay: number; onTime: boolean | null; intact: boolean | null }
  | { k: 'unlock'; id: IslandId } | { k: 'seen'; id: IslandId } | { k: 'letters'; id: IslandId; n: number }
  | { k: 'shell'; i: number } | { k: 'bottle'; i: number }
  | { k: 'weather'; w: WeatherId } | { k: 'shift' } | { k: 'regatta' } | { k: 'ending' } | { k: 'buy'; up: UpId } | { k: 'late'; item: Item };

export type Ups = Record<UpId, number>;
export type Stats = { bumps: number; scuffs: number; patches: number; delivered: number; side: number; earned: number; express: number; expressOnTime: number; tacks: number; sailed: number };
export type Settings = { sound: boolean; music: boolean; manualTrim: boolean };
/** A voyage as saved: always tied up at an island, so loading puts the boat back at that jetty. */
export type Voyage = {
  seed: number; at: IslandId; tick: number; minute: number; rng: number; jobRng: number;
  weather: WeatherId; weatherUntil: number; wind: { dir: number; str: number; toDir: number; nextShift: number; nextDir: number };
  ups: Ups; bag: Item[]; done: number[]; side: Partial<Record<IslandId, Item>>; sideCount: number;
  shells: number; found: string; bottles: string; chart: string; seen: IslandId[]; known: IslandId[]; regatta: number; stats: Stats;
};
export type Save = { v: 1; voyage: Voyage | null; settings: Settings; finished: number };

const ISL_IDS = ISLANDS.map((i) => i.id);
const isIsland = (v: unknown): v is IslandId => typeof v === 'string' && (ISL_IDS as string[]).includes(v);
const isVillage = (v: unknown): v is IslandId => isIsland(v) && ISLAND[v].dock !== null;
const num = (v: unknown, lo: number, hi: number, d: number) => (typeof v === 'number' && Number.isFinite(v) ? clamp(v, lo, hi) : d);
const freshStats = (): Stats => ({ bumps: 0, scuffs: 0, patches: 0, delivered: 0, side: 0, earned: 0, express: 0, expressOnTime: 0, tacks: 0, sailed: 0 });
const freshUps = (): Ups => ({ sail: 0, keel: 0, crates: 0, lantern: 0, spyglass: 0, hull: 0 });

// ---------------------------------------------------------------- bitsets
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
/** Packs 0/1 bytes into a short string, six bits a character. */
export function packBits(bits: Uint8Array) {
  let s = '';
  for (let i = 0; i < bits.length; i += 6) { let v = 0; for (let b = 0; b < 6; b++) if (bits[i + b]) v |= 1 << b; s += B64[v]; }
  return s;
}
/** Unpacks a string from packBits into `n` bits; anything that isn't a valid string unpacks to all zeros. */
export function unpackBits(s: unknown, n: number) {
  const out = new Uint8Array(n); if (typeof s !== 'string') return out;
  for (let c = 0; c < s.length && c * 6 < n; c++) {
    const v = B64.indexOf(s[c]); if (v < 0) return new Uint8Array(n);
    for (let b = 0; b < 6 && c * 6 + b < n; b++) out[c * 6 + b] = (v >> b) & 1;
  }
  return out;
}

// ---------------------------------------------------------------- deliveries
const dockDist = (a: IslandId, b: IslandId) => { const p = ISLAND[a].dock!, q = ISLAND[b].dock!; return Math.hypot(p.x - q.x, p.y - q.y); };
/** Express time allowed, in game minutes: a fair sail at about 55 units a second with tacking, plus half an hour. */
export const expressLimit = (from: IslandId, to: IslandId) => Math.ceil(((dockDist(from, to) * 1.5) / 55 * HZ * MIN_PER_TICK + 30) / 10) * 10;
export function storyItem(d: StoryDef): Item {
  const parcel = !!d.parcel;
  return {
    id: 'story-' + d.n, story: d.n, from: d.from, to: d.to, sender: d.sender, recipient: d.recipient, title: d.title, text: d.text,
    parcel, heavy: !!d.heavy, fragile: !!d.fragile, express: d.express ? expressLimit(d.from, d.to) : 0,
    pay: (parcel ? PAY.parcel : PAY.letter) + (d.heavy ? PAY.heavy : 0), got: 0, due: 0, jostled: false,
  };
}
const fill = (t: string, from: ResidentId, to: ResidentId) => t.split('{to}').join(RESIDENTS[to].name).split('{from}').join(RESIDENTS[from].name);
/** Who sends and receives the post at an island: home's letters come from Granny Tuft and go to her too. */
export const islandSender = (id: IslandId): ResidentId => (id === 'home' ? 'tuft' : ISLAND[id].resident ?? 'tuft');

/** Clock helpers: `minute` counts from the start of day one. */
export const clockOf = (minute: number) => ((minute % 1440) + 1440) % 1440;
export const clockText = (minute: number) => { const m = Math.floor(clockOf(minute)); return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
export type DayPart = 'dawn' | 'day' | 'golden' | 'night';
export function dayPart(minute: number): DayPart {
  const m = clockOf(minute);
  return m >= 300 && m < 450 ? 'dawn' : m >= 450 && m < 1020 ? 'day' : m >= 1020 && m < 1170 ? 'golden' : 'night';
}
/** Daylight from 0 (deep night) to 1 (full day), smooth through dawn and dusk. */
export function daylight(minute: number) {
  const m = clockOf(minute), s = (a: number, b: number, x: number) => { const u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
  return s(290, 470, m) * (1 - s(1050, 1200, m));
}

const castOffHeadings = new Map<IslandId, number>();
/**
 * Which way the boat points casting off: out along the jetty, turned (by as little as will do) toward the widest open
 * water in the next 240 units, so no jetty sends her straight at a nearby shore.
 */
export function castOffHeading(id: IslandId): number {
  const known = castOffHeadings.get(id); if (known !== undefined) return known;
  const d = ISLAND[id].dock!; let best = d.a, score = -Infinity;
  for (let k = -12; k <= 12; k++) {
    const a = d.a + k * 0.1; let open = Infinity;
    for (let s = 20; s <= 240; s += 10) open = Math.min(open, clearance(d.x + Math.cos(a) * s, d.y + Math.sin(a) * s));
    const sc = Math.min(open, 60) - Math.abs(k) * 1.5; if (sc > score) { score = sc; best = a; }
  }
  best = wrap(best); castOffHeadings.set(id, best); return best;
}

export class DriftwoodGame {
  seed: number; tick = 0; minute = START_MINUTE; phase: Phase = 'dock'; at: IslandId | null = 'home';
  boat = { x: 0, y: 0, h: 0, v: 0, vx: 0, vy: 0, bx: 0, by: 0, sheet: 0.3, trimErr: 0, side: 1, turn: 0, inReeds: false, anchored: false, braking: false, luff: 0 };
  wind = { dir: PREVAIL, str: 0.85, toDir: PREVAIL, nextShift: 0, nextDir: PREVAIL, gust: 0 };
  weather: WeatherId = 'breeze'; weatherUntil = 0;
  rng: number; jobRng: number;
  ups: Ups = freshUps();
  bag: Item[] = []; done = new Set<number>(); side: Partial<Record<IslandId, Item>> = {}; sideCount = 0;
  shells = 0; found: Uint8Array = new Uint8Array(SHELLS.length); bottles: Uint8Array = new Uint8Array(BOTTLES.length);
  chart = new Uint8Array(CHART_W * CHART_H); seen = new Set<IslandId>(); known = new Set<IslandId>(['home']);
  scuffs = 0; lastScuff = -999; patchT = 0;
  /** Touching a shore or rock last tick (only the first touch bumps), and a dock key still held from casting off. */
  touching = false; dockLatch = false; regatta = 0; armed = new Set<IslandId>(); stats: Stats = freshStats();
  events: Ev[] = [];
  /** Bumped whenever the chart changes, so the scene knows to redraw its copy. */
  chartVersion = 0;
  private gustP: number[];
  private side0 = 1;

  constructor(o: { seed?: number } = {}) {
    this.seed = (o.seed ?? 1) >>> 0;
    this.rng = (this.seed * 2654435761) >>> 0; this.jobRng = (this.seed * 40503 + 12345) >>> 0;
    this.gustP = [0, 1, 2].map((i) => ((this.seed * (i + 3) * 0.6180339) % 1) * TAU);
    const home = ISLAND.home.dock!;
    this.boat.x = home.x; this.boat.y = home.y; this.boat.h = home.a;
    this.wind.nextShift = this.tick + 30 * HZ; this.weatherUntil = 120 * HZ;
    this.wind.nextDir = this.pickDir(this.wind.dir, 40);
    this.reveal(true);
  }

  private r() { const [v, s] = rnd(this.rng); this.rng = s; return v; }
  private rj() { const [v, s] = rnd(this.jobRng); this.jobRng = s; return v; }
  private pickDir(from: number, swing: number) {
    const d = from + (this.r() * 2 - 1) * swing * DEG, off = wrap(d - PREVAIL);
    return PREVAIL + clamp(off, -PREVAIL_SWING, PREVAIL_SWING);
  }

  // ---------------------------------------------------------------- reading the state
  get noGo() { return this.ups.keel ? KEEL_NO_GO : NO_GO; }
  get capacity() { return Math.min(BAG_MAX, BAG + this.ups.crates); }
  get clock() { return clockOf(this.minute); }
  get day() { return Math.floor(this.minute / 1440) + 1; }
  /** The wind's strength this tick, gusts included. */
  get windStr() { return this.wind.str * (1 + this.wind.gust); }
  /** The angle between the heading and where the wind comes from: + when the wind comes over the right-hand side. */
  get twaSigned() { return wrap(this.boat.h - (this.wind.dir + Math.PI)); }
  get speed() { return Math.hypot(this.boat.vx, this.boat.vy); }
  /** Speed in knots for the HUD: one knot is twelve lake units a second. */
  get knots() { return (this.speed * HZ) / 12; }
  get rain() { return this.weather === 'squall'; }
  get fog() { return fogDepth(this.boat.x, this.boat.y, this.tick); }
  get sight() {
    const day = daylight(this.minute), night = this.ups.lantern ? SIGHT_LANTERN : SIGHT_NIGHT;
    let s = night + (SIGHT_DAY - night) * day;
    s *= 1 - this.fog * (1 - (this.ups.lantern ? FOG_LANTERN : FOG_SIGHT));
    if (this.rain) s *= RAIN_SIGHT;
    return s;
  }
  get heavyCount() { return this.bag.filter((i) => i.heavy).length; }
  get storyDone() { return this.done.size; }
  get shopOpen() { return this.done.has(SHOP_FROM); }
  get shellsFound() { return this.found.reduce((a, b) => a + b, 0); }
  get bottlesFound() { return this.bottles.reduce((a, b) => a + b, 0); }
  get chartShare() { return this.chart.reduce((a, b) => a + b, 0) / this.chart.length; }

  /** Story letters ready to be picked up at an island: not done, not in the bag, and everything they wait on has arrived. */
  storyWaiting(id: IslandId) {
    return STORY.filter((d) => d.from === id && !this.done.has(d.n) && !this.bag.some((b) => b.story === d.n) && d.need.every((n) => this.done.has(n)));
  }
  /** Everything waiting at an island's post office. */
  waiting(id: IslandId): Item[] {
    const out = this.storyWaiting(id).map(storyItem), s = this.side[id];
    if (s && !this.bag.some((b) => b.id === s.id)) out.push(s);
    return out;
  }
  /** The bag's items addressed to the island the boat is tied up at. */
  forHere() { return this.at ? this.bag.filter((i) => i.to === this.at) : []; }
  /** The nearest jetty within reach, if any. */
  nearDock(reach = DOCK_REACH): IslandId | null {
    let best: IslandId | null = null, bd = reach;
    for (const id of VILLAGES) { const d = ISLAND[id].dock!, k = Math.hypot(d.x - this.boat.x, d.y - this.boat.y); if (k < bd) { bd = k; best = id; } }
    return best;
  }
  /** Where the next delivery is: the regatta, then express letters, the earliest story letter, any other; else a pickup. */
  goal(): { id: IslandId; why: 'regatta' | 'deliver' | 'pickup' } | null {
    if (this.regatta === 1) return { id: 'lighthouse', why: 'regatta' };
    if (this.bag.length) {
      const pick = [...this.bag].sort((a, b) => (a.express && !b.express ? -1 : b.express && !a.express ? 1 : a.express && b.express ? a.due - b.due : (a.story || 99) - (b.story || 99)))[0];
      return { id: pick.to, why: 'deliver' };
    }
    const next = STORY.find((d) => !this.done.has(d.n) && d.need.every((n) => this.done.has(n)));
    if (next) return { id: next.from, why: 'pickup' };
    return null;
  }
  /** Whether the HUD may show the arrow to the goal: always with the spyglass or for the regatta, else when near. */
  arrowShown() {
    const g = this.goal(); if (!g) return false;
    if (this.ups.spyglass || g.why === 'regatta') return true;
    const d = ISLAND[g.id].dock!; return Math.hypot(d.x - this.boat.x, d.y - this.boat.y) < ARROW_RANGE;
  }

  // ---------------------------------------------------------------- the tick
  step(inp: Input) {
    if (this.phase === 'dock' || this.phase === 'ending') return;
    // a dock key held down through casting off doesn't count until it's let go
    if (!inp.dock) this.dockLatch = false; else if (this.dockLatch) inp = { ...inp, dock: false };
    this.tick++;
    this.minute += MIN_PER_TICK;
    this.weatherTick();
    if (this.phase === 'patch') {
      const b = this.boat; b.v *= 0.9; b.vx *= 0.9; b.vy *= 0.9;
      if (--this.patchT <= 0) { this.phase = 'sail'; this.scuffs = 0; this.events.push({ k: 'patched' }); }
      this.lateCheck();
      return;
    }
    this.sail(inp);
    if (this.tick % 5 === 0) this.reveal(false);
    this.pickups();
    this.lateCheck();
    this.dockCheck(inp);
  }

  private weatherTick() {
    const w = this.wind, W = WEATHER[this.weather];
    if (this.tick >= this.weatherUntil) {
      if (this.regatta === 1) this.weather = 'breeze';
      else {
        let roll = this.r() * 100, next: WeatherId = 'breeze';
        for (const id of Object.keys(WEATHER) as WeatherId[]) { if (id === this.weather) continue; const k = WEATHER[id].weight * (100 / (100 - WEATHER[this.weather].weight)); if (roll < k) { next = id; break; } roll -= k; }
        this.weather = next;
      }
      const N = WEATHER[this.weather];
      this.weatherUntil = this.tick + Math.round((N.min + this.r() * (N.max - N.min)) * HZ);
      this.wind.nextShift = Math.min(this.wind.nextShift, this.tick + 4 * HZ);
      this.events.push({ k: 'weather', w: this.weather });
    }
    if (this.tick >= w.nextShift) {
      w.toDir = w.nextDir;
      const N = WEATHER[this.weather];
      w.nextDir = this.pickDir(w.toDir, N.swing);
      w.nextShift = this.tick + Math.round((N.shiftMin + this.r() * (N.shiftMax - N.shiftMin)) * HZ);
      this.events.push({ k: 'shift' });
    }
    // the wind swings round smoothly (about three seconds to settle) and its strength eases to the weather's
    w.dir = wrap(w.dir + wrap(w.toDir - w.dir) * 0.012);
    const Wn = WEATHER[this.weather];
    w.str += (Wn.str - w.str) * 0.006;
    const t = this.tick, p = this.gustP;
    const n = 0.5 * Math.sin(t * 0.013 + p[0]) + 0.3 * Math.sin(t * 0.037 + p[1]) + 0.2 * Math.sin(t * 0.091 + p[2]);
    w.gust = W.gust * n;
    if (this.weather === 'squall') w.dir = wrap(w.dir + Math.sin(t * 0.021 + p[1]) * 0.002);
  }

  private sail(inp: Input) {
    const b = this.boat, noGo = this.noGo, steer = clamp(Number.isFinite(inp.steer) ? inp.steer : 0, -1, 1);
    // steering: harder at speed; in irons with the rudder centred, the bow falls off the wind by itself
    const along = clamp(b.v / MAX_SPEED, 0, 1);
    b.turn = steer * (TURN_SLOW + TURN_FAST * along);
    b.h = wrap(b.h + b.turn);
    let twa = this.twaSigned;
    if (Math.abs(twa) < noGo && Math.abs(steer) < 0.2) { b.h = wrap(b.h + (twa >= 0 ? 1 : -1) * 0.007); twa = this.twaSigned; }
    // tacks and gybes: which side the wind comes over flips (ignoring the jitter right at head- or dead-downwind)
    if (Math.abs(twa) > 4 * DEG && Math.abs(twa) < 176 * DEG) {
      const s = twa >= 0 ? 1 : -1;
      if (s !== this.side0) { this.side0 = s; if (Math.abs(twa) < Math.PI / 2) { this.events.push({ k: 'tack' }); this.stats.tacks++; } else this.events.push({ k: 'gybe' }); }
    }
    b.side = this.side0;
    // the sail: auto-trim sets itself; manual trim eases or hauls the sheet and rewards the sweet spot
    const ideal = idealSheet(twa, noGo); let tf = 1;
    if (inp.trim === null || !Number.isFinite(inp.trim)) { b.sheet += (ideal - b.sheet) * 0.12; b.trimErr = 0; }
    else { b.sheet = clamp(b.sheet + clamp(inp.trim, -1, 1) * 0.018, 0, 1); b.trimErr = b.sheet - ideal; tf = trimFactor(b.trimErr); }
    const p = polar(twa, noGo);
    b.luff = Math.abs(twa) < noGo ? 1 : b.trimErr > 0.12 ? clamp((b.trimErr - 0.12) * 4, 0, 1) : 0;
    // target speed and easing toward it
    b.inReeds = inReeds(b.x, b.y);
    const heavy = Math.max(HEAVY_FLOOR, 1 - HEAVY_SLOW * this.heavyCount);
    const vt = this.windStr * p * MAX_SPEED * (1 + SAIL_BONUS * this.ups.sail) * tf * heavy * (b.inReeds ? REED_SLOW : 1);
    b.v += (vt - b.v) * (Math.abs(twa) < noGo ? IRONS : vt > b.v ? ACCEL : DECEL);
    if (b.inReeds) b.v *= 0.99;
    b.anchored = !!inp.anchor;
    const near = inp.dock ? this.nearDock() : null;
    b.braking = b.anchored || (near !== null && b.v > DOCK_SPEED * 0.6);
    if (b.braking) b.v *= BRAKE;
    if (near !== null && b.v > DOCK_SPEED && this.tick % 45 === 0) this.events.push({ k: 'slow' });
    b.v = Math.max(0, b.v);
    // drift: leeway from the wind and the current's push; an anchor holds against most of it
    const ws = this.windStr * LEEWAY * (this.ups.keel ? 0.5 : 1) * (1 - 0.5 * along);
    const [cx, cy] = currentAt(b.x, b.y), hold = b.anchored ? 0.15 : 1;
    const dx = (Math.cos(this.wind.dir) * ws + cx) * hold * (b.inReeds ? 0.5 : 1), dy = (Math.sin(this.wind.dir) * ws + cy) * hold * (b.inReeds ? 0.5 : 1);
    b.vx = Math.cos(b.h) * b.v + dx + b.bx; b.vy = Math.sin(b.h) * b.v + dy + b.by;
    b.bx *= 0.86; b.by *= 0.86; if (Math.abs(b.bx) + Math.abs(b.by) < 0.01) { b.bx = 0; b.by = 0; }
    this.move(b.vx, b.vy);
    this.stats.sailed += this.speed;
  }

  /** Moves the boat in small steps so even a fast boat can't jump through a rock, and pushes it out of anything solid. */
  private move(vx: number, vy: number) {
    const b = this.boat, n = Math.max(1, Math.ceil(Math.hypot(vx, vy) / 4));
    let bumped = false;
    for (let i = 0; i < n; i++) {
      b.x += vx / n; b.y += vy / n;
      // push out of the deepest overlap, again and again: wedged between a rock and a coast, each push can undo the other
      for (let k = 0; k < 12; k++) {
        const hit = this.contact(b.x, b.y); if (!hit) break;
        b.x = hit.x; b.y = hit.y;
        if (!bumped) { bumped = true; this.bump(hit.nx, hit.ny, hit.soft); }
      }
    }
    this.touching = bumped;
  }
  /** The deepest overlap at a point: where to push the boat to, and the shore's outward normal there. */
  contact(x: number, y: number): { x: number; y: number; nx: number; ny: number; soft: boolean } | null {
    let best: { x: number; y: number; nx: number; ny: number; soft: boolean } | null = null, depth = 0;
    const e = edgeDist(x, y);
    if (e.d < BOAT_R) { depth = BOAT_R - e.d; best = { x: x + e.nx * depth, y: y + e.ny * depth, nx: e.nx, ny: e.ny, soft: true }; }
    for (const r of ROCKS) {
      const dx = x - r.x, dy = y - r.y, d = Math.hypot(dx, dy), over = r.r + BOAT_R - d;
      if (over > depth) { depth = over; const nx = d > 1e-6 ? dx / d : 1, ny = d > 1e-6 ? dy / d : 0; best = { x: r.x + nx * (r.r + BOAT_R), y: r.y + ny * (r.r + BOAT_R), nx, ny, soft: false }; }
    }
    for (const isl of ISLANDS) {
      if (Math.hypot(x - isl.x, y - isl.y) > isl.reach + BOAT_R) continue;
      const q = nearestOnPoly(isl.poly, x, y), inside = insidePoly(isl.poly, x, y);
      if (!inside && q.d >= BOAT_R) continue;
      const over = inside ? q.d + BOAT_R : BOAT_R - q.d;
      if (over <= depth) continue;
      let nx: number, ny: number;
      if (q.d > 1e-6) { nx = (inside ? q.x - x : x - q.x) / q.d; ny = (inside ? q.y - y : y - q.y) / q.d; }
      else { const a = Math.atan2(y - isl.y, x - isl.x); nx = Math.cos(a); ny = Math.sin(a); }
      depth = over; best = { x: q.x + nx * BOAT_R, y: q.y + ny * BOAT_R, nx, ny, soft: false };
    }
    return best;
  }
  private bump(nx: number, ny: number, soft: boolean) {
    const b = this.boat, into = -(b.vx * nx + b.vy * ny);
    if (into <= 0.05) return;
    const first = !this.touching;
    // the push into the shore is spent: what's left slides along it
    b.vx += nx * into; b.vy += ny * into;
    if (soft || into < BUMP_SPEED || !first) {
      // a gentle nudge (or still pressed against the same shore): slide along it, with one soft bump on touching
      b.v *= 0.96;
      if (first && into > 0.4) this.events.push({ k: 'bump', x: b.x - nx * BOAT_R, y: b.y - ny * BOAT_R, hard: false, power: into });
      return;
    }
    // a real bump: knocked back, slowed, swung toward the shore's line, and a scuff unless the hull is sturdy
    b.v *= 0.35; b.bx = nx * (0.9 + into * 0.5); b.by = ny * (0.9 + into * 0.5);
    const tx = -ny, ty = nx, hx = Math.cos(b.h), hy = Math.sin(b.h), along = hx * tx + hy * ty, ta = Math.atan2(along >= 0 ? ty : -ty, along >= 0 ? tx : -tx);
    b.h = wrap(b.h + clamp(wrap(ta - b.h), -0.35, 0.35));
    this.stats.bumps++;
    this.events.push({ k: 'bump', x: b.x - nx * BOAT_R, y: b.y - ny * BOAT_R, hard: true, power: into });
    if (this.ups.hull || this.tick - this.lastScuff < SCUFF_GAP) return;
    this.lastScuff = this.tick; this.scuffs++; this.stats.scuffs++;
    const jostled: string[] = [];
    for (const it of this.bag) if (it.fragile && !it.jostled) { it.jostled = true; jostled.push(it.title); }
    this.events.push({ k: 'scuff', n: this.scuffs, jostled });
    if (this.scuffs >= SCUFFS) { this.phase = 'patch'; this.patchT = PATCH_TICKS; this.stats.patches++; this.events.push({ k: 'patch' }); }
  }

  /** Reveals the chart around the boat and notices islands coming into view. */
  private reveal(all: boolean) {
    const b = this.boat, r = all ? SIGHT_DAY : this.sight, r2 = r * r;
    const c0 = Math.max(0, Math.floor((b.x - r) / CHART_CELL)), c1 = Math.min(CHART_W - 1, Math.floor((b.x + r) / CHART_CELL));
    const r0 = Math.max(0, Math.floor((b.y - r) / CHART_CELL)), r1 = Math.min(CHART_H - 1, Math.floor((b.y + r) / CHART_CELL));
    let changed = false;
    for (let cy = r0; cy <= r1; cy++) for (let cx = c0; cx <= c1; cx++) {
      const i = cy * CHART_W + cx; if (this.chart[i]) continue;
      const dx = (cx + 0.5) * CHART_CELL - b.x, dy = (cy + 0.5) * CHART_CELL - b.y;
      if (dx * dx + dy * dy <= r2) { this.chart[i] = 1; changed = true; }
    }
    if (changed) this.chartVersion++;
    for (const isl of ISLANDS) {
      if (this.seen.has(isl.id)) continue;
      if (Math.hypot(isl.x - b.x, isl.y - b.y) - isl.reach * 0.6 < r) { this.seen.add(isl.id); this.chartVersion++; if (!all) this.events.push({ k: 'seen', id: isl.id }); }
    }
  }

  private pickups() {
    const b = this.boat;
    for (let i = 0; i < SHELLS.length; i++) {
      if (this.found[i]) continue; const [x, y] = SHELLS[i];
      if (Math.abs(x - b.x) < GRAB && Math.abs(y - b.y) < GRAB && Math.hypot(x - b.x, y - b.y) < GRAB) { this.found[i] = 1; this.shells += SHELL_VALUE; this.events.push({ k: 'shell', i }); }
    }
    for (let i = 0; i < BOTTLES.length; i++) {
      if (this.bottles[i]) continue; const o = BOTTLES[i];
      if (Math.hypot(o.x - b.x, o.y - b.y) < GRAB) { this.bottles[i] = 1; this.shells += BOTTLE_VALUE; this.events.push({ k: 'bottle', i }); }
    }
  }
  private lateCheck() {
    for (const it of this.bag) if (it.express && it.due > 0 && this.minute > it.due && this.minute - MIN_PER_TICK <= it.due) this.events.push({ k: 'late', item: it });
  }

  private dockCheck(inp: Input) {
    const b = this.boat;
    for (const id of VILLAGES) {
      if (this.armed.has(id)) continue;
      const d = ISLAND[id].dock!; if (Math.hypot(d.x - b.x, d.y - b.y) > 200) this.armed.add(id);
    }
    const near = this.nearDock(); if (!near) return;
    const d = ISLAND[near].dock!, dist = Math.hypot(d.x - b.x, d.y - b.y), sp = this.speed;
    if (inp.dock && b.v <= DOCK_SPEED) { this.dockAt(near); return; }
    if (dist < AUTO_DOCK && sp < AUTO_SPEED && this.armed.has(near)) this.dockAt(near);
  }

  // ---------------------------------------------------------------- at the dock
  /** Ties up at an island's jetty (also the browser tests' teleport). Returns false for an island without one. */
  dockAt(id: IslandId) {
    const isl = ISLAND[id]; if (!isl || !isl.dock || this.phase === 'ending') return false;
    const b = this.boat;
    b.x = isl.dock.x; b.y = isl.dock.y; b.v = 0; b.vx = 0; b.vy = 0; b.bx = 0; b.by = 0; b.h = wrap(isl.dock.a + Math.PI);
    this.at = id; this.phase = 'dock'; this.scuffs = 0; this.patchT = 0;
    if (!this.seen.has(id)) { this.seen.add(id); this.chartVersion++; }
    this.known.add(id);
    this.events.push({ k: 'dock', id });
    if (this.regatta === 1 && id === 'lighthouse') { this.regatta = 2; this.phase = 'ending'; this.events.push({ k: 'ending' }); return true; }
    this.offerSide(id);
    const n = this.waiting(id).length; if (n) this.events.push({ k: 'letters', id, n });
    return true;
  }
  /** Makes up a side delivery at a village, between story letters, if none is waiting there already. */
  private offerSide(id: IslandId) {
    if (!this.done.has(SIDE_FROM) || this.side[id]) return;
    const dests = VILLAGES.filter((v) => v !== id && this.known.has(v)); if (!dests.length) return;
    if (this.rj() < 0.25) return;
    const to = dests[Math.floor(this.rj() * dests.length)], def = SIDE_POOL[Math.floor(this.rj() * SIDE_POOL.length)];
    const from = islandSender(id), rec = islandSender(to), parcel = !!def.parcel;
    this.sideCount++;
    this.side[id] = {
      id: 'side-' + this.sideCount, story: 0, from: id, to, sender: from, recipient: rec, title: def.title, text: fill(def.text, from, rec),
      parcel, heavy: !!def.heavy, fragile: !!def.fragile, express: def.express ? expressLimit(id, to) : 0,
      pay: (parcel ? PAY.sideParcel : PAY.sideLetter) + (def.heavy ? PAY.heavy : 0), got: 0, due: 0, jostled: false,
    };
  }
  /** Takes an item from the island's post office into the bag. */
  pickUp(itemId: string) {
    if (this.phase !== 'dock' || !this.at || this.bag.length >= this.capacity) return false;
    const it = this.waiting(this.at).find((i) => i.id === itemId); if (!it) return false;
    const copy: Item = { ...it, got: this.minute, due: it.express ? this.minute + it.express : 0, jostled: false };
    this.bag.push(copy);
    if (it.story === 0) delete this.side[this.at];
    if (!this.known.has(copy.to)) { this.known.add(copy.to); this.chartVersion++; this.events.push({ k: 'unlock', id: copy.to }); }
    this.events.push({ k: 'pickup', item: copy });
    return true;
  }
  /** Picks up everything that fits, story letters first. Returns how many. */
  pickUpAll() { let n = 0; for (const it of this.waiting(this.at ?? 'home')) if (this.pickUp(it.id)) n++; return n; }
  /** Hands over an item addressed to this island. Returns the shells paid, or -1. */
  deliver(itemId: string) {
    if (this.phase !== 'dock' || !this.at) return -1;
    const i = this.bag.findIndex((x) => x.id === itemId && x.to === this.at); if (i < 0) return -1;
    const it = this.bag[i]; this.bag.splice(i, 1);
    const onTime = it.express ? this.minute <= it.due : null, intact = it.fragile ? !it.jostled : null;
    const pay = it.pay + (onTime ? PAY.express : 0) + (intact ? PAY.intact : 0);
    this.shells += pay; this.stats.earned += pay; this.stats.delivered++;
    if (it.express) { this.stats.express++; if (onTime) this.stats.expressOnTime++; }
    if (it.story) this.done.add(it.story); else this.stats.side++;
    this.events.push({ k: 'deliver', item: it, pay, onTime, intact });
    if (it.story === STORY.length && this.regatta === 0) {
      // Pip's invitation: dusk falls, the weather clears, and the lighthouse waits
      this.regatta = 1;
      const today = Math.floor(this.minute / 1440) * 1440, dusk = today + 18 * 60 + 30, jump = Math.max(0, dusk - this.minute);
      this.minute += jump;
      // the evening rushes on, not the post: express items in the bag keep the time they had left
      for (const b of this.bag) if (b.express && b.due > 0) b.due += jump;
      this.weather = 'breeze'; this.weatherUntil = this.tick + 600 * HZ;
      this.events.push({ k: 'regatta' });
    }
    const n = this.waiting(this.at).length; if (n) this.events.push({ k: 'letters', id: this.at, n });
    return pay;
  }
  /** Hands over everything addressed here. Returns the total paid. */
  deliverAll() { let t = 0; for (const it of this.forHere()) { const p = this.deliver(it.id); if (p > 0) t += p; } return t; }
  /** Leaves the jetty, pointing out to open water. */
  castOff() {
    if (this.phase !== 'dock' || !this.at) return false;
    const isl = ISLAND[this.at], b = this.boat;
    b.h = castOffHeading(this.at); b.v = 0.8; b.vx = 0; b.vy = 0; b.bx = 0; b.by = 0;
    this.armed.delete(this.at); this.dockLatch = true; this.touching = false;
    this.events.push({ k: 'castoff', id: this.at });
    this.at = null; this.phase = 'sail';
    this.side0 = this.twaSigned >= 0 ? 1 : -1;
    return true;
  }
  /** After the regatta, the lake carries on: back to the lighthouse jetty, free to sail and deliver side post. */
  sailOn() { if (this.phase !== 'ending') return false; this.phase = 'dock'; this.at = 'lighthouse'; this.offerSide('lighthouse'); return true; }

  // ---------------------------------------------------------------- the boatyard
  price(id: UpId) { const p = UPGRADES[id].prices; return this.ups[id] < p.length ? p[this.ups[id]] : Infinity; }
  canBuy(id: UpId): 'ok' | 'max' | 'shells' | 'closed' {
    if (this.ups[id] >= UPGRADES[id].prices.length) return 'max';
    if (this.phase !== 'dock' || this.at !== 'boatyard' || !this.shopOpen) return 'closed';
    return this.shells >= this.price(id) ? 'ok' : 'shells';
  }
  buy(id: UpId) {
    if (this.canBuy(id) !== 'ok') return false;
    this.shells -= this.price(id); this.ups[id]++;
    this.events.push({ k: 'buy', up: id });
    return true;
  }

  // ---------------------------------------------------------------- saving
  toVoyage(): Voyage {
    const w = this.wind;
    return {
      seed: this.seed, at: this.at ?? 'home', tick: this.tick, minute: this.minute, rng: this.rng, jobRng: this.jobRng,
      weather: this.weather, weatherUntil: this.weatherUntil, wind: { dir: w.dir, str: w.str, toDir: w.toDir, nextShift: w.nextShift, nextDir: w.nextDir },
      ups: { ...this.ups }, bag: this.bag.map((i) => ({ ...i })), done: [...this.done].sort((a, b) => a - b),
      side: Object.fromEntries(Object.entries(this.side).map(([k, v]) => [k, { ...v }])), sideCount: this.sideCount,
      shells: this.shells, found: packBits(this.found), bottles: packBits(this.bottles), chart: packBits(this.chart),
      seen: [...this.seen], known: [...this.known], regatta: this.regatta, stats: { ...this.stats },
    };
  }
  /** Rebuilds a voyage from saved data, tied up at its island. Anything missing or odd falls back to a fresh value. */
  static fromVoyage(raw: unknown): DriftwoodGame | null {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const o = raw as Partial<Voyage>;
    const g = new DriftwoodGame({ seed: num(o.seed, 0, 4294967295, 1) });
    g.tick = Math.floor(num(o.tick, 0, 1e10, 0)); g.minute = num(o.minute, 0, 1e9, START_MINUTE);
    g.rng = num(o.rng, 0, 4294967295, g.rng) >>> 0; g.jobRng = num(o.jobRng, 0, 4294967295, g.jobRng) >>> 0;
    if (typeof o.weather === 'string' && o.weather in WEATHER) g.weather = o.weather as WeatherId;
    g.weatherUntil = num(o.weatherUntil, 0, 1e10, g.tick + 60 * HZ);
    if (o.wind && typeof o.wind === 'object') {
      const w = o.wind; g.wind.dir = wrap(num(w.dir, -10, 10, PREVAIL)); g.wind.str = num(w.str, 0.2, 2, 0.85); g.wind.toDir = wrap(num(w.toDir, -10, 10, g.wind.dir));
      g.wind.nextShift = num(w.nextShift, 0, 1e10, g.tick + 30 * HZ); g.wind.nextDir = wrap(num(w.nextDir, -10, 10, g.wind.dir));
    }
    if (o.ups && typeof o.ups === 'object') for (const id of UP_IDS) g.ups[id] = Math.floor(num((o.ups as Record<string, unknown>)[id], 0, UPGRADES[id].prices.length, 0));
    if (Array.isArray(o.done)) for (const n of o.done) if (typeof n === 'number' && STORY.some((d) => d.n === n)) g.done.add(n);
    // the bag: story items are rebuilt from the story itself; side items are checked field by field
    const items = (list: unknown[]) => {
      const out: Item[] = [];
      for (const v of list) {
        const it = readItem(v); if (!it || out.some((x) => x.id === it.id)) continue;
        if (it.story && g.done.has(it.story)) continue;
        out.push(it);
      }
      return out;
    };
    if (Array.isArray(o.bag)) g.bag = items(o.bag).slice(0, g.capacity);
    if (o.side && typeof o.side === 'object') for (const [k, v] of Object.entries(o.side)) { if (!isVillage(k)) continue; const it = readItem(v); if (it && it.story === 0 && it.from === k) g.side[k] = it; }
    g.sideCount = Math.floor(num(o.sideCount, 0, 1e6, 0));
    g.shells = Math.floor(num(o.shells, 0, 1e6, 0));
    g.found = unpackBits(o.found, SHELLS.length); g.bottles = unpackBits(o.bottles, BOTTLES.length); g.chart = unpackBits(o.chart, CHART_W * CHART_H);
    if (Array.isArray(o.seen)) for (const s of o.seen) if (isIsland(s)) g.seen.add(s);
    if (Array.isArray(o.known)) for (const s of o.known) if (isIsland(s)) g.known.add(s);
    for (const it of g.bag) { g.known.add(it.to); g.known.add(it.from); }
    g.regatta = Math.floor(num(o.regatta, 0, 2, 0));
    if (g.regatta === 0 && g.done.has(STORY.length)) g.regatta = 1;
    if (o.stats && typeof o.stats === 'object') for (const k of Object.keys(g.stats) as (keyof Stats)[]) g.stats[k] = num((o.stats as Record<string, unknown>)[k], 0, 1e12, 0);
    const at = isVillage(o.at) ? o.at : 'home', d = ISLAND[at].dock!;
    g.at = at; g.phase = 'dock'; g.boat.x = d.x; g.boat.y = d.y; g.boat.h = wrap(d.a + Math.PI);
    g.chartVersion++;
    g.events.length = 0;
    return g;
  }

  /** A short fingerprint of the state, for the determinism tests. */
  hash() {
    const b = this.boat, r = (v: number) => Math.round(v * 1000);
    return [this.tick, r(b.x), r(b.y), r(b.h), r(b.v), r(this.wind.dir), r(this.wind.str), this.weather, this.rng, this.jobRng, this.shells, this.scuffs, this.phase, this.at, this.bag.map((i) => i.id).join(','), [...this.done].join(','), packBits(this.chart)].join('|');
  }
}

function readItem(v: unknown): Item | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Partial<Item>;
  if (typeof o.story === 'number' && o.story > 0) {
    const d = STORY.find((s) => s.n === o.story); if (!d) return null;
    const it = storyItem(d);
    return { ...it, got: num(o.got, 0, 1e9, 0), due: it.express ? num(o.due, 0, 1e9, 0) : 0, jostled: o.jostled === true };
  }
  if (typeof o.id !== 'string' || !/^side-\d+$/.test(o.id) || !isVillage(o.from) || !isVillage(o.to) || o.from === o.to) return null;
  const isRes = (r: unknown): r is ResidentId => typeof r === 'string' && r in RESIDENTS;
  if (!isRes(o.sender) || !isRes(o.recipient) || typeof o.title !== 'string' || typeof o.text !== 'string') return null;
  return {
    id: o.id, story: 0, from: o.from, to: o.to, sender: o.sender, recipient: o.recipient, title: o.title.slice(0, 80), text: o.text.slice(0, 600),
    parcel: o.parcel === true, heavy: o.heavy === true, fragile: o.fragile === true, express: Math.floor(num(o.express, 0, 2000, 0)), pay: Math.floor(num(o.pay, 0, 20, 3)),
    got: num(o.got, 0, 1e9, 0), due: num(o.due, 0, 1e9, 0), jostled: o.jostled === true,
  };
}

export const freshSave = (): Save => ({ v: 1, voyage: null, settings: { sound: true, music: true, manualTrim: false }, finished: 0 });
/** Reads the save defensively: bad JSON, an old version or odd fields give a fresh save (or fresh parts of one). */
export function readSave(raw: string | null): Save {
  const s = freshSave(); if (!raw) return s;
  try {
    const o = JSON.parse(raw) as Partial<Save> | null;
    if (!o || typeof o !== 'object' || Array.isArray(o) || o.v !== 1) return s;
    if (o.settings && typeof o.settings === 'object') { s.settings.sound = o.settings.sound !== false; s.settings.music = o.settings.music !== false; s.settings.manualTrim = o.settings.manualTrim === true; }
    s.finished = Math.floor(num(o.finished, 0, 1e6, 0));
    if (o.voyage) { const g = DriftwoodGame.fromVoyage(o.voyage); s.voyage = g ? g.toVoyage() : null; }
  } catch { return freshSave(); }
  return s;
}
