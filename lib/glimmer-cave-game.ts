// Glimmer Cave: the rules of a dive. Deterministic and DOM-free: a dive is a seed plus the moves made, and every
// random draw comes from a seeded generator.
import {
  BASE, BEETLE, BURST, CARD, CLASS, CRITTERS, DIG_TIME, DROPS, ELITE, JOBS, JOB_IDS, LAYER_MIX, LAYER_SECONDS, MAX_ALIVE, MITE, OVERCLOCKS, PASSIVES,
  PASSIVE_IDS, PASSIVE_MAX, POD_DISTANCE, POD_SECONDS, POWERUPS, POWERUP_IDS, RARITY, START_POOL, UNLOCK, UPGRADES, UPGRADE_IDS, upgradeCost, WEAPONS, WEAPON_IDS, WYRM, WYRM_AT, WYRM_ID,
  critterFluff, goldRange, rarityWeights, targetAlive, xpNeed,
  type Block, type CritterId, type Hazard, type Hero, type JobId, type LayerNo, type OverclockId, type PassiveId, type PowerupId, type UpgradeId,
  type WeaponId,
} from './glimmer-cave-data.js';
import { Rand, mix } from './glimmer-cave-rand.js';
import { MAP_H, MAP_W, dig, makeMap, solid, tileAt, type CaveMap } from './glimmer-cave-map.js';
import { hurtCritter, newWeapon, runWeapons, type Shot, type WeaponState } from './glimmer-cave-weapons.js';

export * from './glimmer-cave-data.js';
export { Rand, mix } from './glimmer-cave-rand.js';
export * from './glimmer-cave-map.js';
export { effective, hurtCritter, newWeapon, runWeapons, type Eff, type HitOpts, type Owner, type Shot, type WeaponState } from './glimmer-cave-weapons.js';

// ── Types ──────────────────────────────────────────────────────────────────

/** The stick: its length is clamped to 1. */
export type Input = { x: number; y: number };

export type CritterState = 'walk' | 'dash' | 'rest' | 'ready' | 'ram';
/** `t` is the critter's state timer (a beetle's ram keeps the tiles left to go in it); `dx`, `dy` is a ram's line. */
export type Critter = {
  id: number; kind: CritterId; elite: boolean; x: number; y: number; fluff: number; max: number;
  slow: number; slowFor: number; stun: number; hit: number; state: CritterState; t: number; dx: number; dy: number;
};

export type Result = 'bonked' | 'missed' | 'complete';
/** What happened in a step, for the scene and the sound. Positions are in tiles. */
export type CaveEvent =
  | { k: 'fire'; w: WeaponId; x: number; y: number; dx: number; dy: number }
  | { k: 'hit'; id: number; x: number; y: number; dmg: number; crit: boolean }
  | { k: 'bonk'; id: number; kind: CritterId; elite: boolean; x: number; y: number }
  | { k: 'dig'; x: number; y: number; block: Block; progress: number }
  | { k: 'gold'; n: number }
  | { k: 'crystal'; n: number }
  | { k: 'hurt'; dmg: number }
  | { k: 'level'; level: number }
  | { k: 'burst'; dx: number; dy: number }
  | { k: 'pod'; x: number; y: number }
  | { k: 'podReached' }
  | { k: 'job'; id: JobId; n: number; done: boolean }
  | { k: 'drop'; id: PowerupId; x: number; y: number }
  | { k: 'power'; id: PowerupId; x: number; y: number }
  | { k: 'wyrm'; what: 'surface' | 'dive' | 'rumble' | 'bonked'; x: number; y: number }
  | { k: 'over'; result: Result };

export type Phase = 'play' | 'pick' | 'pod' | 'over';

export type Rarity = 0 | 1 | 2 | 3;
export type Card =
  | { k: 'weapon'; id: WeaponId; rarity: Rarity }
  | { k: 'overclock'; id: OverclockId }
  | { k: 'passive'; id: PassiveId; rarity: Rarity }
  | { k: 'snack' };

/** A layer's job. Lanterns keep `lit`, the indices in `map.props` of the lanterns lit, and `standing`, the seconds
 *  stood by the unlit lantern in reach. The big one's goal is 1. */
export type JobState = { id: JobId; n: number; goal: number; done: boolean; lit?: number[]; standing?: number };
/**
 * The Rock Wyrm, as plain data. (x, y) is the head and `dir` its heading in radians; `segs` are the 8 body segments
 * then the tail, head end first. `under` is the seconds left underground; `rumble` the seconds to the next ring (the
 * telegraph runs while it is at or under WYRM.telegraph); `ring` the ring's radius while one spreads from the head,
 * and `ringHit` whether it has caught the hero; `fast` once it has dived and resurfaced.
 */
export type Wyrm = {
  x: number; y: number; dir: number; fluff: number; max: number; segs: { x: number; y: number }[];
  under: number; rumble: number; ring: number | null; ringHit: boolean; fast: boolean; bonked: boolean;
};

/** A fresh job: nothing done yet. */
export function newJob(id: JobId): JobState {
  const j: JobState = { id, n: 0, goal: id === 'bigone' ? 1 : JOBS[id].goal, done: false };
  if (id === 'lanterns') { j.lit = []; j.standing = 0; }
  return j;
}

/** The part of the camp profile a dive reads. Missing upgrades count as level 0. */
export type ProfileLike = { upgrades?: Partial<Record<UpgradeId, number>>; unlocked?: { weapons?: WeaponId[] } };
/** The camp profile, kept in localStorage between dives. `finishedHazard` is the highest hazard finished (0 for none). */
export type Profile = {
  v: 1; gold: number; upgrades: Record<UpgradeId, number>; unlocked: { hazard: Hazard; weapons: WeaponId[] };
  stats: { dives: number; bestLayer: number; bonked: number; finished: number; finishedHazard: number };
};
export type DiveOpts = { seed: number; hero: Hero; hazard: Hazard; profile: ProfileLike; hz?: 60 | 30 | 15 };
/** A dive in progress, saved at a layer's start. `picks` and the whole weapon state keep rarity bonuses across a reload. */
export type RunSave = {
  v: 1; hero: Hero; hazard: Hazard; seed: number; layer: LayerNo; fluff: number; xp: number; level: number; picks: number;
  weapons: WeaponState[]; passives: Partial<Record<PassiveId, { n: number; v: number }>>; campRerolls: number;
  gold: { banked: number; layer: 0 }; jobsUsed: JobId[]; bonked: number;
};
export type Stats = { maxFluff: number; speed: number; pickup: number; armour: number; crit: number; dig: number; damage: number; cooldown: number; projectile: number };

// ── Tuning that only the rules use ─────────────────────────────────────────

/** Weapon slots, and the Fluff a Snack heals. */
const MAX_WEAPONS = 4, SNACK_HEAL = 20;
/** The spawn window: the view, in tiles, centred on the hero. Spawns land 1-3 tiles beyond its edge. */
const VIEW = { w: 18, h: 11 };
const SPAWN_GAP = 0.05;
/** Crystals in pickup range fly at `speed` tiles/s and are taken within `take`. */
const CRYSTAL = { speed: 8, take: 0.3 };
const BUDDY_GAP = 1.2;
/** A beetle lowers its head this long before it rams. */
const READY = 0.4;
/** Rock stops a critter's box at most this big, so an elite still fits a one-tile tunnel. */
const WALL_R = 0.45;
/** The first elite comes this far into a layer, then one every ELITE.every. */
const FIRST_ELITE = 30;
const EPS = 1e-9;
/** The wyrm surfaces this far from the hero, and circles at CIRCLE, aiming LEAD radians ahead around the circle and
 *  turning at most TURN radians a second, so it bends like a snake. Its ring takes RING_TIME s to spread. */
const WYRM_RISE = 6, WYRM_CIRCLE = 4, WYRM_LEAD = 0.6, WYRM_TURN = 2.5, RING_TIME = 1;
/** The wyrm's trail keeps a point every TRAIL_STEP tiles, enough for its whole length. */
const TRAIL_STEP = 0.15, TRAIL_MAX = 2 * Math.ceil((WYRM.segments + 2) * WYRM.spacing / TRAIL_STEP);
/** The most a lantern pool and a weapon's slow together take from a critter's speed, as the weapons cap theirs. */
const SLOW_MAX = 0.9;

export function critterRadius(c: Critter) { return c.id === WYRM_ID ? WYRM.head : CRITTERS[c.kind].radius * (c.elite ? ELITE.size : 1); }

/** Walks `left` tiles back from (x, y) along a trail of x, y pairs (oldest first) and puts the point in `out`; past
 *  the trail's end it stops at its oldest point. */
function backAlong(tr: number[], x: number, y: number, left: number, out: { x: number; y: number }) {
  let px = x, py = y;
  for (let i = tr.length - 2; i >= 0; i -= 2) {
    const qx = tr[i], qy = tr[i + 1], seg = Math.hypot(qx - px, qy - py);
    if (seg >= left) { const f = left / seg; out.x = px + (qx - px) * f; out.y = py + (qy - py) * f; return; }
    left -= seg; px = qx; py = qy;
  }
  out.x = px; out.y = py;
}

// ── Moving boxes against rock ──────────────────────────────────────────────

/** Moves a box of half-size r at (x, y) by dx along x and returns the new x, stopped flush at the first solid tile it
 *  would enter. Moves are under a tile a step, so only the columns crossed are checked. */
function clipX(m: CaveMap, x: number, y: number, r: number, dx: number) {
  const nx = x + dx, y0 = Math.floor(y - r), y1 = Math.floor(y + r - EPS);
  if (dx > 0) {
    const to = Math.floor(nx + r - EPS);
    for (let tx = Math.floor(x + r - EPS) + 1; tx <= to; tx++) for (let ty = y0; ty <= y1; ty++) if (solid(tileAt(m, tx, ty))) return tx - r;
  } else if (dx < 0) {
    const to = Math.floor(nx - r);
    for (let tx = Math.floor(x - r) - 1; tx >= to; tx--) for (let ty = y0; ty <= y1; ty++) if (solid(tileAt(m, tx, ty))) return tx + 1 + r;
  }
  return nx;
}

function clipY(m: CaveMap, x: number, y: number, r: number, dy: number) {
  const ny = y + dy, x0 = Math.floor(x - r), x1 = Math.floor(x + r - EPS);
  if (dy > 0) {
    const to = Math.floor(ny + r - EPS);
    for (let ty = Math.floor(y + r - EPS) + 1; ty <= to; ty++) for (let tx = x0; tx <= x1; tx++) if (solid(tileAt(m, tx, ty))) return ty - r;
  } else if (dy < 0) {
    const to = Math.floor(ny - r);
    for (let ty = Math.floor(y - r) - 1; ty >= to; ty--) for (let tx = x0; tx <= x1; tx++) if (solid(tileAt(m, tx, ty))) return ty + 1 + r;
  }
  return ny;
}

// ── The spatial hash ───────────────────────────────────────────────────────

/** Critters bucketed by `cell`-tile squares, rebuilt once a step. Cells and lists are reused, so a rebuild allocates
 *  nothing once warm. */
export class Grid {
  private cols: number; private rows: number; private cells: Critter[][]; private used: number[] = [];
  constructor(public cell = 2) {
    this.cols = Math.ceil(MAP_W / cell); this.rows = Math.ceil(MAP_H / cell);
    this.cells = Array.from({ length: this.cols * this.rows }, () => []);
  }
  private cx(x: number) { return Math.min(this.cols - 1, Math.max(0, Math.floor(x / this.cell))); }
  private cy(y: number) { return Math.min(this.rows - 1, Math.max(0, Math.floor(y / this.cell))); }
  clear() { for (const i of this.used) this.cells[i].length = 0; this.used.length = 0; }
  add(c: Critter) {
    const i = this.cy(c.y) * this.cols + this.cx(c.x), cell = this.cells[i];
    if (!cell.length) this.used.push(i);
    cell.push(c);
  }
  /** Fills `out` with the critters whose centres are within r of (x, y), stopping at `max`. */
  near(x: number, y: number, r: number, out: Critter[], max = Infinity): Critter[] {
    out.length = 0;
    const x0 = this.cx(x - r), x1 = this.cx(x + r), y0 = this.cy(y - r), y1 = this.cy(y + r), r2 = r * r;
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
      for (const c of this.cells[cy * this.cols + cx]) {
        const ex = c.x - x, ey = c.y - y;
        if (ex * ex + ey * ey <= r2) { out.push(c); if (out.length >= max) return out; }
      }
    }
    return out;
  }
}

// ── The dive ───────────────────────────────────────────────────────────────

/**
 * A dive: five layers of one cave. `step` runs one tick of the fixed loop; the phases of a step are methods called in
 * order, so later systems (weapons, cards, jobs, the wyrm) hook in at their phase.
 */
export class Dive {
  seed: number; hero: Hero; hazard: Hazard; profile: ProfileLike; hz: 60 | 30 | 15; dt: number;
  layer: LayerNo = 1; map!: CaveMap; phase: Phase = 'play';
  /** Seconds into the layer, and seconds left on the clock: 300 down to the pod, then the pod's 45
   *  (on layer 5, WYRM_AT down to the wyrm's arrival, then held at 0 until the pod lands). */
  t = 0; timer: number = LAYER_SECONDS;
  hx = 0; hy = 0; face = { x: 1, y: 0 }; moving = false;
  fluff = 0; grace = 0; xp = 0; level = 1; picks = 0; offer: Card[] = [];
  weapons: WeaponState[];
  /** The buddy's one weapon: its class's start, at BUDDY_DAMAGE, never levelled. Null leaves the buddy unarmed (tests). */
  buddyWeapon: WeaponState | null;
  passives: Partial<Record<PassiveId, { n: number; v: number }>> = {};
  /** Rerolls left from camp, for the whole dive, and the layer's own one, refilled by `startLayer`. */
  campRerolls = 0; layerReroll = 0;
  /** The spawn window, in tiles: the page sets it from its stage's aspect. */
  view = { ...VIEW };
  gold = { banked: 0, layer: 0 };
  crystals: { x: number; y: number; n: number }[] = [];
  critters: Critter[] = [];
  /** Live projectiles, zones and orbiters, for the weapons and the scene. */
  shots: Shot[] = [];
  pod: { x: number; y: number; reached: boolean } | null = null;
  /** This layer's job, the jobs of layers 1 to this one, the big one's critter id once it's out, and the wyrm. */
  job: JobState | null = null; jobsUsed: JobId[] = []; bigId: number | null = null; wyrm: Wyrm | null = null;
  /** Critters bonked this dive. */
  bonked = 0;
  buddy = { x: 0, y: 0 };
  digging: { x: number; y: number; p: number } | null = null;
  result: Result | null = null;
  events: CaveEvent[] = [];
  /** False turns all spawning off (tests). */
  spawning = true;
  /** Set by `record`, so a dive is counted once. */
  recorded = false;
  /** True makes every crit chance 0 (tests). */
  critOff = false;
  /** Seconds left of Tunnel Rat's speed. */
  rat = 0;
  /** Power-ups lying on the floor, and the seconds left of the timed ones taken. */
  powerups: { id: PowerupId; x: number; y: number }[] = [];
  boost = { storm: 0, vacuum: 0, hourglass: 0, zoomies: 0 };
  /** The Boomerang Storm's mini boomerangs this step, for the scene. */
  minis: { x: number; y: number }[] = [];
  /** This step's stats, read by the weapons. */
  st!: Stats;
  rand!: Rand;
  grid = new Grid();

  private ids = 0; private spawnCd = 0; private nextBurst: number = BURST.every; private nextElite = FIRST_ELITE;
  private spot = { x: 0, y: 0 };
  /** The layer's drops come from their own Rand, so they never shift the draws the rest of the layer makes. */
  private loot!: Rand;
  /** When each critter may next take a mini boomerang. */
  private stormHit = new Map<number, number>();
  /** Steps from each tile to the hero's, -1 for rock or cut off; rebuilt when the hero changes tile or rock is dug. */
  private flow = new Int16Array(MAP_W * MAP_H); private queue = new Int32Array(MAP_W * MAP_H);
  private flowMap: CaveMap | null = null; private flowAt = -1;
  /** The hero's recent path as x, y pairs, oldest first; the buddy walks it. */
  private trail: number[] = [];
  private scratch: Critter[] = [];
  /** The head's recent path as x, y pairs, oldest first; the segments follow it. */
  private wyrmTrail: number[] = [];
  /** The wyrm's head as the weapons see it: a critter in the grid while the wyrm is up. */
  private head: Critter = {
    id: WYRM_ID, kind: 'beetle', elite: false, x: 0, y: 0, fluff: 0, max: 0, slow: 0, slowFor: 0, stun: 0, hit: 0, state: 'walk', t: 0, dx: 0, dy: 0,
  };

  constructor(o: DiveOpts) {
    this.seed = o.seed >>> 0; this.hero = o.hero; this.hazard = o.hazard; this.profile = o.profile;
    this.hz = o.hz ?? 60; this.dt = 1 / this.hz;
    this.weapons = [newWeapon(CLASS[o.hero].start)];
    this.buddyWeapon = newWeapon(CLASS[o.hero === 'dora' ? 'enzo' : 'dora'].start);
    const head = this.upgrade('headstart');
    this.level = 1 + head; this.picks = head; this.campRerolls = this.upgrade('rerolls');
    this.startLayer(1);
    this.st = this.stats();
    this.fluff = this.st.maxFluff;
  }

  /** Rerolls available now: the layer's own, then camp's. */
  get rerolls() { return this.layerReroll + this.campRerolls; }

  private upgrade(id: UpgradeId) { return this.profile.upgrades?.[id] ?? 0; }
  private passive(id: PassiveId) { return this.passives[id]?.v ?? 0; }

  /** The hero's numbers: base, then class, passives and camp upgrades. `damage` and `cooldown` are multipliers. */
  stats(): Stats {
    const c = CLASS[this.hero], up = (id: UpgradeId) => UPGRADES[id].per * this.upgrade(id), pv = (id: PassiveId) => this.passive(id);
    return {
      maxFluff: (BASE.fluff + up('fluffier') + pv('fluff')) * c.fluff,
      speed: BASE.speed * c.speed * (1 + pv('paws') + up('quicker')) * (this.rat > 0 ? 1 + WEAPONS.drill.p.ratSpeed : 1)
        * (this.boost.zoomies > 0 ? 1 + POWERUPS.zoomies.speed : 1),
      pickup: BASE.pickup * (1 + pv('magnet') + up('magnetic')),
      armour: BASE.armour + pv('coat'),
      crit: BASE.crit + pv('lucky'),
      dig: c.dig * (1 + pv('arms') + up('diggier')) * (this.boost.zoomies > 0 ? 1 + POWERUPS.zoomies.dig : 1),
      damage: 1 + pv('claws') + up('sharper'),
      cooldown: Math.max(0.4, 1 - pv('busy')),
      projectile: c.projectile,
    };
  }

  /** Builds layer n fresh: its Rand from mix(seed, n + 100), then its job (layers 1-4: one the dive hasn't had, drawn
   *  with that Rand), then its map from mix(seed, n) with the job's props. Fluff and the build carry over. Restarting a
   *  layer gives it the same job, since `jobsUsed` is cut back to the layers before it. */
  startLayer(n: LayerNo) {
    this.layer = n; this.job = null; this.wyrm = null; this.bigId = null; this.wyrmTrail = [];
    this.rand = new Rand(mix(this.seed, n + 100)); this.loot = new Rand(mix(this.seed, n + 200));
    this.jobsUsed = this.jobsUsed.slice(0, n - 1);
    if (n < 5) {
      const id = this.rand.pick(JOB_IDS.filter(j => !this.jobsUsed.includes(j)));
      this.jobsUsed.push(id); this.job = newJob(id);
    }
    this.map = makeMap(mix(this.seed, n), n, this.job?.id ?? null);
    this.phase = 'play'; this.result = null; this.t = 0; this.timer = n === 5 ? WYRM_AT : LAYER_SECONDS;
    this.critters = []; this.crystals = []; this.shots = []; this.pod = null; this.rat = 0; this.gold.layer = 0; this.grace = 0;
    this.powerups = []; this.boost = { storm: 0, vacuum: 0, hourglass: 0, zoomies: 0 }; this.minis = []; this.stormHit.clear();
    this.layerReroll = 1;
    this.spawnCd = 0; this.nextBurst = BURST.every; this.nextElite = FIRST_ELITE; this.flowAt = -1; this.ids = 0;
    // Runtime counters start clean, as a save restores them, so a reloaded layer plays like an uninterrupted one.
    for (const w of this.weapons) { w.cd = 0; w.n = 0; }
    if (this.buddyWeapon) { this.buddyWeapon.cd = 0; this.buddyWeapon.n = 0; }
    this.face = { x: 1, y: 0 }; this.moving = false;
    this.placeHero(this.map.start.x + 0.5, this.map.start.y + 0.5);
    this.openPicks();
  }

  /** Moves to the next layer from its pod. */
  descend(): boolean {
    if (this.phase !== 'pod' || this.layer >= 5) return false;
    this.startLayer((this.layer + 1) as LayerNo);
    return true;
  }

  /** Ends a dive left in a save, as bonked at the start of its layer. Its banked gold still counts. */
  abandon() { this.gold.layer = 0; this.result = 'bonked'; this.phase = 'over'; }

  /** The run as it stands at the start of `layer`, for the page to keep in localStorage. Runtime counters
   *  (weapon `cd` and `n`, shots, the wyrm) aren't saved. */
  toSave(): RunSave {
    const passives: RunSave['passives'] = {};
    for (const id of PASSIVE_IDS) { const p = this.passives[id]; if (p) passives[id] = { n: p.n, v: p.v }; }
    return {
      v: 1, hero: this.hero, hazard: this.hazard, seed: this.seed, layer: this.layer, fluff: this.fluff, xp: this.xp, level: this.level,
      picks: this.picks, weapons: this.weapons.map(w => ({ ...w, overclocks: [...w.overclocks], cd: 0, n: 0 })), passives, campRerolls: this.campRerolls,
      gold: { banked: this.gold.banked, layer: 0 }, jobsUsed: [...this.jobsUsed], bonked: this.bonked,
    };
  }

  /** Rebuilds a dive at the start of the saved layer, or null if the save is malformed. */
  static fromSave(raw: unknown, profile: ProfileLike, opts?: { hz?: 60 | 30 | 15 }): Dive | null {
    const s = raw as Partial<RunSave> | null;
    if (!s || typeof s !== 'object' || s.v !== 1) return null;
    const int = (x: unknown, lo: number, hi: number) => typeof x === 'number' && Number.isInteger(x) && x >= lo && x <= hi;
    const num = (x: unknown) => typeof x === 'number' && Number.isFinite(x);
    if (s.hero !== 'dora' && s.hero !== 'enzo') return null;
    if (!int(s.hazard, 1, 5) || !int(s.layer, 1, 5) || !int(s.seed, 0, 0xffffffff)) return null;
    if (!num(s.fluff) || !num(s.xp) || (s.xp as number) < 0 || !int(s.level, 1, 999) || !int(s.picks, 0, 999) || !int(s.campRerolls, 0, UPGRADES.rerolls.max * UPGRADES.rerolls.per) || !int(s.bonked, 0, 1e9)) return null;
    if (!s.gold || !int(s.gold.banked, 0, 1e9)) return null;
    if (!Array.isArray(s.weapons) || s.weapons.length < 1 || s.weapons.length > MAX_WEAPONS) return null;
    if (!Array.isArray(s.jobsUsed) || s.jobsUsed.length > 5 || s.jobsUsed.some(j => !JOB_IDS.includes(j))) return null;
    if (!s.passives || typeof s.passives !== 'object') return null;
    const weapons: WeaponState[] = [];
    for (const w of s.weapons) {
      if (!w || !WEAPON_IDS.includes(w.id) || weapons.some(x => x.id === w.id) || !int(w.level, 1, 12) || !Array.isArray(w.overclocks)) return null;
      if (!num(w.dmg) || !num(w.rate) || !num(w.size) || !num(w.count) || w.dmg < 0 || w.rate < 0 || w.size < 0 || w.count < 0) return null;
      const def = WEAPONS[w.id], a = w.overclocks.filter(o => (def.oc5 as string[]).includes(o)).length, b = w.overclocks.filter(o => (def.oc10 as string[]).includes(o)).length;
      if (a + b !== w.overclocks.length || new Set(w.overclocks).size !== w.overclocks.length || a > (w.level >= 5 ? 1 : 0) || b > (w.level >= 10 ? 1 : 0)) return null;
      weapons.push({ id: w.id, level: w.level, overclocks: [...w.overclocks], dmg: w.dmg, rate: w.rate, size: w.size, count: w.count, cd: 0, n: 0 });
    }
    const passives: Dive['passives'] = {};
    for (const [id, p] of Object.entries(s.passives)) {
      if (!PASSIVE_IDS.includes(id as PassiveId) || !p || !int(p.n, 0, 99) || !num(p.v) || p.v < 0) return null;
      passives[id as PassiveId] = { n: p.n, v: p.v };
    }
    const v = s as RunSave;
    const d = new Dive({ seed: v.seed, hero: v.hero, hazard: v.hazard, profile, hz: opts?.hz });
    d.weapons = weapons; d.passives = passives; d.xp = v.xp; d.level = v.level; d.picks = v.picks; d.bonked = v.bonked;
    d.gold.banked = v.gold.banked; d.jobsUsed = [...v.jobsUsed];
    d.campRerolls = v.campRerolls;
    d.startLayer(v.layer);
    d.st = d.stats();
    d.fluff = Math.min(d.st.maxFluff, v.fluff);
    if (d.fluff <= 0) return null;
    return d;
  }

  /** Puts the hero at (x, y) with the buddy just behind, and stops any digging. */
  placeHero(x: number, y: number) {
    this.hx = x; this.hy = y; this.digging = null;
    this.trail = [x - BUDDY_GAP, y, x, y]; this.buddy.x = x - BUDDY_GAP; this.buddy.y = y;
  }

  spawn(kind: CritterId, x: number, y: number, elite = false): Critter {
    const fluff = critterFluff(CRITTERS[kind].fluff, this.layer, this.hazard) * (elite ? ELITE.fluff : 1);
    const c: Critter = {
      id: ++this.ids, kind, elite, x, y, fluff, max: fluff, slow: 0, slowFor: 0, stun: 0, hit: 0,
      state: kind === 'mite' ? 'dash' : 'walk', t: kind === 'mite' ? MITE.dash : kind === 'beetle' ? BEETLE.every : 0, dx: 0, dy: 0,
    };
    this.critters.push(c);
    return c;
  }

  /** Digs the block at tile (x, y) if it can be dug, paying out its gold and crystals. Weapons pass `gold`, a
   *  multiplier on the block's gold (Gold Rush), and `always`, which gives a block with no gold a gold block's worth
   *  (the Burrow Bomb's Prospector); `gold` 0 pays nothing (the wyrm). A crate counts toward the crates job. */
  digBlock(x: number, y: number, gold = 1, always = false): boolean {
    const got = dig(this.map, x, y, this.rand, this.layer);
    if (!got) return false;
    this.flowAt = -1;
    this.events.push({ k: 'dig', x, y, block: got.block, progress: 1 });
    if (always && !got.gold) { const [lo, hi] = goldRange(this.layer); got.gold = lo + this.rand.int(hi - lo + 1); }
    if (got.gold && gold > 0) this.addGold(got.gold * gold);
    if (got.crystals) this.crystals.push({ x: x + 0.5, y: y + 0.5, n: got.crystals });
    if (got.block === 'crate' && this.job?.id === 'crates') this.progress(1);
    // the wyrm's digging (gold 0) drops nothing
    if (gold > 0 && (got.block === 'crate' || this.loot.next() < DROPS.block)) this.drop(x + 0.5, y + 0.5);
    return true;
  }

  /** Moves a critter by (dx, dy), stopping flush at rock, as the critters' own moves do. For knockback and pushes. */
  nudge(c: Critter, dx: number, dy: number) {
    if (c.id === WYRM_ID) return;
    const rw = Math.min(WALL_R, critterRadius(c));
    c.x = clipX(this.map, c.x, c.y, rw, dx); c.y = clipY(this.map, c.x, c.y, rw, dy);
  }

  /** True when something other than rock stops a shot of radius r at (x, y): a segment of the wyrm while it's up. */
  blocks(x: number, y: number, r: number): boolean {
    const w = this.wyrm;
    if (!w || w.bonked || w.under > 0) return false;
    const rr = (r + WYRM.body) ** 2;
    for (const s of w.segs) if ((s.x - x) ** 2 + (s.y - y) ** 2 <= rr) return true;
    return false;
  }

  /** Adds gold to the layer's purse, with the Prospector upgrade. */
  addGold(n: number) {
    const g = Math.round(n * (1 + UPGRADES.prospector.per * this.upgrade('prospector')));
    this.gold.layer += g;
    this.events.push({ k: 'gold', n: g });
  }

  /** Lands the pod on the spot whose distance from the hero is closest to the middle of POD_DISTANCE. */
  landPod() {
    const want = (POD_DISTANCE[0] + POD_DISTANCE[1]) / 2;
    let best = this.map.start, bd = Infinity;
    for (const p of this.map.pods) {
      const d = Math.abs(Math.hypot(p.x + 0.5 - this.hx, p.y + 0.5 - this.hy) - want);
      if (d < bd) { bd = d; best = p; }
    }
    this.pod = { x: best.x + 0.5, y: best.y + 0.5, reached: false }; this.timer = POD_SECONDS;
    this.events.push({ k: 'pod', x: this.pod.x, y: this.pod.y });
  }

  /** One tick of 1 / hz seconds. Returns this step's events, or [] unless the dive is in play. */
  step(input: Input): CaveEvent[] {
    this.events = [];
    if (this.phase !== 'play') return this.events;
    const st = this.st = this.stats();
    this.timers();
    this.moveHero(input, st);
    this.fire();
    this.moveCritters();
    this.contact(st);
    this.pickup(st);
    this.powerUps();
    this.spawnWaves();
    this.jobs();
    this.podCheck();
    this.overCheck();
    this.openPicks();
    return this.events;
  }

  // 1. Timers.
  timers() {
    this.t += this.dt;
    this.timer = Math.max(0, this.timer - this.dt);
    if (this.grace > 0) this.grace -= this.dt;
    if (this.rat > 0) this.rat -= this.dt;
    const b = this.boost;
    for (const k of ['storm', 'vacuum', 'hourglass', 'zoomies'] as const) if (b[k] > 0) b[k] = Math.max(0, b[k] - this.dt);
  }

  // 2. The hero's move, by axis, against rock. A blocked axis with input on it digs.
  moveHero(input: Input, st: Stats) {
    // A NaN or infinite stick counts as no input.
    const ok = Number.isFinite(input.x) && Number.isFinite(input.y);
    let ix = ok ? input.x : 0, iy = ok ? input.y : 0;
    const len = Math.hypot(ix, iy);
    this.moving = len > 1e-6;
    if (this.moving) { this.face.x = ix / len; this.face.y = iy / len; }
    if (len > 1) { ix /= len; iy /= len; }
    const m = this.map, r = BASE.radius, step = st.speed * this.dt, wantX = this.hx + ix * step, wantY = this.hy + iy * step;
    this.hx = clipX(m, this.hx, this.hy, r, ix * step);
    const blockedX = ix !== 0 && Math.abs(this.hx - wantX) > EPS;
    this.hy = clipY(m, this.hx, this.hy, r, iy * step);
    const blockedY = iy !== 0 && Math.abs(this.hy - wantY) > EPS;
    this.walkTrail();

    let tx = 0, ty = 0, found = false;
    if (blockedX && (!blockedY || Math.abs(ix) >= Math.abs(iy))) {
      tx = ix > 0 ? Math.round(this.hx + r) : Math.round(this.hx - r) - 1;
      for (const y of [Math.floor(this.hy), Math.floor(this.hy - r), Math.floor(this.hy + r - EPS)]) if (solid(tileAt(m, tx, y))) { ty = y; found = true; break; }
    } else if (blockedY) {
      ty = iy > 0 ? Math.round(this.hy + r) : Math.round(this.hy - r) - 1;
      for (const x of [Math.floor(this.hx), Math.floor(this.hx - r), Math.floor(this.hx + r - EPS)]) if (solid(tileAt(m, x, ty))) { tx = x; found = true; break; }
    }
    const block = found ? tileAt(m, tx, ty) : 'floor';
    if (!(block in DIG_TIME)) { this.digging = null; return; }
    if (!this.digging || this.digging.x !== tx || this.digging.y !== ty) this.digging = { x: tx, y: ty, p: 0 };
    this.digging.p += this.dt / DIG_TIME[block as keyof typeof DIG_TIME] * st.dig;
    if (this.digging.p >= 1 - EPS) { this.digging = null; this.digBlock(tx, ty); }
    else this.events.push({ k: 'dig', x: tx, y: ty, block, progress: this.digging.p });
  }

  /** Records the hero's path and puts the buddy BUDDY_GAP tiles back along it. */
  private walkTrail() {
    const tr = this.trail;
    if (Math.hypot(this.hx - tr[tr.length - 2], this.hy - tr[tr.length - 1]) >= 0.15) { tr.push(this.hx, this.hy); if (tr.length > 32) tr.splice(0, 2); }
    backAlong(tr, this.hx, this.hy, BUDDY_GAP, this.buddy);
  }

  // 3. Weapons. The grid is rebuilt here, once a step, for the weapons, the critters' spacing and the contact check.
  //    The wyrm's head joins it while the wyrm is up, so every weapon aims at and hits it as it does a critter.
  fire() {
    this.grid.clear();
    for (const c of this.critters) this.grid.add(c);
    const w = this.wyrm;
    if (w && !w.bonked && w.under <= 0) {
      const h = this.head; h.x = w.x; h.y = w.y; h.fluff = w.fluff; h.max = w.max;
      this.grid.add(h);
    }
    runWeapons(this, 'hero');
    runWeapons(this, 'buddy');
    this.sweep();
  }

  /** Drops bonked critters from the list, in place. */
  sweep() {
    const cs = this.critters; let k = 0;
    for (let i = 0; i < cs.length; i++) if (cs[i].fluff > 0) cs[k++] = cs[i];
    cs.length = k;
  }

  // 4. Critters move and attack.
  moveCritters() {
    // the Hourglass holds every critter where it stands
    if (this.boost.hourglass > 0) return;
    this.updateFlow();
    const m = this.map, dt = this.dt, near = this.scratch, push = 1 - Math.exp(-15 * dt);
    for (const c of this.critters) {
      if (c.hit > 0) c.hit -= dt;
      if (c.slowFor > 0) { c.slowFor -= dt; if (c.slowFor <= 0) c.slow = 0; }
      if (c.stun > 0) { c.stun -= dt; continue; }
      const rw = Math.min(WALL_R, critterRadius(c)), slow = 1 - Math.min(SLOW_MAX, Math.max(c.slow, this.poolSlow(c.x, c.y)));
      if (c.kind === 'beetle' && this.beetle(c, rw, slow)) continue;
      let speed = CRITTERS[c.kind].speed * slow;
      if (c.kind === 'mite') {
        c.t -= dt;
        if (c.t <= 0) { if (c.state === 'dash') { c.state = 'rest'; c.t += MITE.rest; } else { c.state = 'dash'; c.t += MITE.dash; } }
        // A mite's table speed is its average, so it dashes faster to make up for its rests.
        speed = c.state === 'rest' ? 0 : speed * (MITE.dash + MITE.rest) / MITE.dash;
      }
      this.steer(c);
      let vx = c.dx * speed * dt, vy = c.dy * speed * dt;
      // A light push apart from up to six neighbours, so a crowd spreads instead of stacking.
      const rc = critterRadius(c);
      for (const o of this.grid.near(c.x, c.y, rc + WALL_R, near, 7)) {
        if (o === c) continue;
        const ex = c.x - o.x, ey = c.y - o.y, d = Math.hypot(ex, ey), over = rc + critterRadius(o) - d;
        if (over > 0 && d > 1e-6) { vx += ex / d * over * push; vy += ey / d * over * push; }
      }
      c.x = clipX(m, c.x, c.y, rw, vx); c.y = clipY(m, c.x, c.y, rw, vy);
    }
  }

  /** Points c.dx, c.dy at the hero: straight when close, otherwise down the flow field (diagonally where both ways
   *  are open). Leaves them 0 when on top of the hero. */
  private steer(c: Critter) {
    const m = this.map, w = m.w, f = this.flow, ex = this.hx - c.x, ey = this.hy - c.y, d2 = ex * ex + ey * ey;
    const tx = Math.floor(c.x), ty = Math.floor(c.y), i = ty * w + tx, here = tx >= 0 && ty >= 0 && tx < w && ty < m.h ? f[i] : -1;
    let gx = this.hx, gy = this.hy;
    if (d2 >= 2.25 && here > 0) {
      const lower = (j: number) => f[j] >= 0 && f[j] < here;
      const sx = tx + 1 < w && lower(i + 1) ? 1 : tx > 0 && lower(i - 1) ? -1 : 0;
      const sy = ty + 1 < m.h && lower(i + w) ? 1 : ty > 0 && lower(i - w) ? -1 : 0;
      let ux = sx, uy = sy;
      if (sx && sy && f[i + sy * w + sx] < 0) { if (Math.abs(ex) >= Math.abs(ey)) uy = 0; else ux = 0; }
      gx = tx + ux + 0.5; gy = ty + uy + 0.5;
    }
    const vx = gx - c.x, vy = gy - c.y, d = Math.hypot(vx, vy);
    if (d < 1e-2) { c.dx = 0; c.dy = 0; } else { c.dx = vx / d; c.dy = vy / d; }
  }

  /** A beetle's habit: within BEETLE.within tiles and off cooldown, it readies for READY s and rams BEETLE.ram tiles.
   *  Returns true when this step was spent readying or ramming. */
  private beetle(c: Critter, rw: number, slow: number): boolean {
    if (c.state === 'ready') {
      c.t -= this.dt;
      if (c.t > 0) return true;
      c.state = 'ram'; c.t = BEETLE.ram;
    }
    if (c.state === 'ram') {
      const go = Math.min(c.t, BEETLE.ramSpeed * slow * this.dt);
      c.t -= go;
      c.x = clipX(this.map, c.x, c.y, rw, c.dx * go); c.y = clipY(this.map, c.x, c.y, rw, c.dy * go);
      if (c.t <= EPS) { c.state = 'walk'; c.t = BEETLE.every - READY - BEETLE.ram / BEETLE.ramSpeed; }
      return true;
    }
    c.t -= this.dt;
    const ex = this.hx - c.x, ey = this.hy - c.y, d = Math.hypot(ex, ey);
    if (c.t > 0 || d > BEETLE.within) return false;
    c.state = 'ready'; c.t = READY;
    if (d > 1e-6) { c.dx = ex / d; c.dy = ey / d; } else { c.dx = 1; c.dy = 0; }
    return true;
  }

  /** Steps from each tile to the hero's over floor, -1 for rock or cut off, fresh for the hero's tile and the rock as
   *  they are now. The bot routes with it. */
  flowField(): Int16Array { this.updateFlow(); return this.flow; }

  /** A 4-way breadth-first fill from the hero's tile over floor. */
  private updateFlow() {
    const m = this.map, w = m.w, n = w * m.h, at = Math.floor(this.hy) * w + Math.floor(this.hx);
    if (this.flowMap === m && this.flowAt === at) return;
    if (this.flow.length !== n) { this.flow = new Int16Array(n); this.queue = new Int32Array(n); }
    this.flowMap = m; this.flowAt = at;
    const f = this.flow, q = this.queue, tiles = m.tiles;
    f.fill(-1);
    if (tiles[at] !== 'floor') return;
    f[at] = 0; q[0] = at;
    let head = 0, tail = 1;
    while (head < tail) {
      const i = q[head++], x = i % w, d = f[i] + 1;
      if (x + 1 < w && f[i + 1] < 0 && tiles[i + 1] === 'floor') { f[i + 1] = d; q[tail++] = i + 1; }
      if (x > 0 && f[i - 1] < 0 && tiles[i - 1] === 'floor') { f[i - 1] = d; q[tail++] = i - 1; }
      if (i + w < n && f[i + w] < 0 && tiles[i + w] === 'floor') { f[i + w] = d; q[tail++] = i + w; }
      if (i >= w && f[i - w] < 0 && tiles[i - w] === 'floor') { f[i - w] = d; q[tail++] = i - w; }
    }
  }

  // 5. Contact: the strongest touching critter takes its bump from Fluff, then grace.
  contact(st: Stats) {
    if (this.grace > 0 || this.boost.hourglass > 0) return;
    const r = BASE.radius, hx = this.hx, hy = this.hy;
    // The grid was built before the critters moved, so the search reaches a step's worth of movement further.
    let bump = 0;
    for (const c of this.grid.near(hx, hy, r + ELITE.size * WALL_R + 8 * this.dt, this.scratch)) {
      if (c.fluff <= 0 || c.id === WYRM_ID) continue;
      const rr = r + critterRadius(c), ex = c.x - hx, ey = c.y - hy;
      if (ex * ex + ey * ey <= rr * rr) bump = Math.max(bump, CRITTERS[c.kind].contact * (c.elite ? ELITE.contact : 1));
    }
    if (!bump) return;
    this.hurt(Math.max(1, bump - st.armour));
  }

  /** Takes Fluff and starts the grace period. */
  hurt(dmg: number) {
    this.fluff = Math.max(0, this.fluff - dmg); this.grace = BASE.grace;
    this.events.push({ k: 'hurt', dmg });
  }

  // 6. Crystals in pickup range fly to the hero and are collected.
  pickup(st: Stats) {
    const vac = this.boost.vacuum > 0, cs = this.crystals, reach = vac ? Infinity : st.pickup, fly = CRYSTAL.speed * this.dt * (vac ? POWERUPS.vacuum.speed : 1);
    let k = 0;
    for (let i = 0; i < cs.length; i++) {
      const c = cs[i], ex = this.hx - c.x, ey = this.hy - c.y;
      let d = Math.hypot(ex, ey);
      if (d <= reach && d > 0) { const s = Math.min(d, fly); c.x += ex / d * s; c.y += ey / d * s; d -= s; }
      if (d < CRYSTAL.take) { this.collect(c.n); continue; }
      cs[k++] = c;
    }
    cs.length = k;
  }

  // 6b. Power-ups: the hero takes any within reach, then the Boomerang Storm's minis fly and hit.
  powerUps() {
    const ps = this.powerups;
    let k = 0;
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      if ((p.x - this.hx) ** 2 + (p.y - this.hy) ** 2 <= DROPS.take ** 2) { this.usePowerup(p.id, p.x, p.y); continue; }
      ps[k++] = p;
    }
    ps.length = k;
    this.stormStep();
  }

  /** Drops a power-up at (x, y), drawn by weight from the layer's loot Rand, unless DROPS.max already lie about. */
  drop(x: number, y: number) {
    if (this.powerups.length >= DROPS.max) return;
    const low = this.fluff < this.stats().maxFluff * POWERUPS.snack.low;
    const weight = (id: PowerupId) => POWERUPS[id].weight * (id === 'snack' && low ? POWERUPS.snack.lowWeight : 1);
    let r = this.loot.next() * POWERUP_IDS.reduce((t, id) => t + weight(id), 0), id: PowerupId = POWERUP_IDS[0];
    for (const q of POWERUP_IDS) { r -= weight(q); if (r < 0) { id = q; break; } }
    this.powerups.push({ id, x, y });
    this.events.push({ k: 'drop', id, x, y });
  }

  /** What a power-up does the moment it's taken. */
  usePowerup(id: PowerupId, x = this.hx, y = this.hy) {
    this.events.push({ k: 'power', id, x, y });
    const P = POWERUPS;
    switch (id) {
      case 'storm': this.boost.storm = P.storm.secs; return;
      case 'vacuum': this.boost.vacuum = P.vacuum.secs; return;
      case 'hourglass': this.boost.hourglass = P.hourglass.secs; return;
      case 'zoomies': this.boost.zoomies = P.zoomies.secs; return;
      case 'snack': this.fluff = Math.min(this.stats().maxFluff, this.fluff + P.snack.heal); return;
      case 'pouch': this.addGold(P.pouch.base + P.pouch.per * this.hazard); return;
      case 'sneeze': {
        // a share of each critter's own most Fluff, so it bites as hard on layer 5 as on layer 1; no crits or bonuses
        const hw = this.view.w / 2, hh = this.view.h / 2;
        for (const c of this.critters) {
          if (c.fluff <= 0 || Math.abs(c.x - this.hx) > hw || Math.abs(c.y - this.hy) > hh) continue;
          hurtCritter(this, c, c.max * (c.elite ? P.sneeze.eliteShare : P.sneeze.share), this.hx, this.hy, { buddy: true });
          if (c.fluff > 0) c.stun = Math.max(c.stun, P.sneeze.stun);
        }
        this.sweep();
        return;
      }
    }
  }

  /** The Boomerang Storm: P.count minis on a turning ring that swings out to `reach` and back every `period` s. Each
   *  hits a critter (or the wyrm's head) it touches, at most once every `every` s per critter. */
  private stormStep() {
    const P = POWERUPS.storm, left = this.boost.storm;
    if (left <= 0) { if (this.minis.length) { this.minis = []; this.stormHit.clear(); } return; }
    const t = P.secs - left, r = 0.6 + (P.reach - 0.6) * Math.abs(Math.sin((Math.PI * t) / P.period)), a0 = t * P.turn;
    const dmg = critterFluff(P.dmg, this.layer, this.hazard), minis: { x: number; y: number }[] = [];
    for (let i = 0; i < P.count; i++) {
      const a = a0 + (i * 2 * Math.PI) / P.count, x = this.hx + Math.cos(a) * r, y = this.hy + Math.sin(a) * r;
      minis.push({ x, y });
      for (const c of this.grid.near(x, y, P.hitR + ELITE.size * 0.5, this.scratch)) {
        if (c.fluff <= 0 || (this.stormHit.get(c.id) ?? 0) > this.t) continue;
        const rr = P.hitR + critterRadius(c);
        if ((c.x - x) ** 2 + (c.y - y) ** 2 > rr * rr) continue;
        this.stormHit.set(c.id, this.t + P.every);
        hurtCritter(this, c, dmg, this.hx, this.hy, {}, 0.3);
      }
    }
    this.minis = minis;
    this.sweep();
  }

  /** Takes n experience from a crystal (and counts n toward a haul). Every level it crosses queues a pick; the pick
   *  opens at the end of the step. */
  collect(n: number) {
    this.xp += n;
    this.events.push({ k: 'crystal', n });
    if (this.job?.id === 'haul') this.progress(n);
    while (this.xp >= xpNeed(this.level)) {
      this.xp -= xpNeed(this.level); this.level++; this.picks++;
      this.events.push({ k: 'level', level: this.level });
    }
  }

  // ── Cards ──

  /** Opens the first of the queued picks, if any, when the dive is in play. */
  private openPicks() {
    if (this.picks > 0 && this.phase === 'play') { this.offer = this.deal(); this.phase = 'pick'; }
  }

  private rollRarity(): Rarity {
    const w = rarityWeights(this.hazard); let r = this.rand.next() * 100;
    for (let i = 0; i < 3; i++) { r -= w[i]; if (r < 0) return i as Rarity; }
    return 3;
  }

  /** A weapon whose next card is its overclock: level 4 (the pair at 5) or level 9 (the pair at 10). */
  private waiting(w: WeaponState) { return w.level === 4 || w.level === 9; }

  /** The cards to choose from: a waiting weapon's two overclocks, else three distinct cards by equal weight from the
   *  valid pool (a new weapon among them while a slot is free), else a lone Snack. */
  deal(): Card[] {
    const r = this.rand;
    const wait = this.weapons.find(w => this.waiting(w));
    if (wait) return r.shuffle([...(wait.level === 4 ? WEAPONS[wait.id].oc5 : WEAPONS[wait.id].oc10)]).map(id => ({ k: 'overclock', id }));
    type Pick = { k: 'weapon' | 'passive'; id: WeaponId | PassiveId };
    const held = new Set<WeaponId>(this.weapons.map(w => w.id));
    const fresh: Pick[] = [];
    if (this.weapons.length < MAX_WEAPONS) {
      const pool = new Set<WeaponId>([...START_POOL, ...(this.profile.unlocked?.weapons ?? [])]);
      for (const id of WEAPON_IDS) if (pool.has(id) && !held.has(id)) fresh.push({ k: 'weapon', id });
    }
    const pool: Pick[] = [...fresh];
    for (const w of this.weapons) if (w.level < 12) pool.push({ k: 'weapon', id: w.id });
    for (const id of PASSIVE_IDS) if ((this.passives[id]?.n ?? 0) < PASSIVE_MAX) pool.push({ k: 'passive', id });
    if (!pool.length) return [{ k: 'snack' }];
    const drawn: Pick[] = [];
    while (drawn.length < 3 && pool.length) drawn.push(pool.splice(r.int(pool.length), 1)[0]);
    if (fresh.length && !drawn.some(c => fresh.includes(c))) drawn[drawn.length - 1] = r.pick(fresh);
    return drawn.map(c => ({ k: c.k, id: c.id, rarity: this.rollRarity() }) as Card);
  }

  /** Takes card i of the offer. The next queued pick is dealt, or play resumes. */
  pick(i: number): boolean {
    if (this.phase !== 'pick' || !Number.isInteger(i) || i < 0 || i >= this.offer.length) return false;
    const c = this.offer[i];
    if (c.k === 'snack') this.fluff = Math.min(this.stats().maxFluff, this.fluff + SNACK_HEAL);
    else if (c.k === 'overclock') {
      const w = this.weapons.find(x => c.id.startsWith(`${x.id}.`) && this.waiting(x))!;
      w.overclocks.push(c.id); w.level++;
    } else if (c.k === 'passive') {
      const m = RARITY.mult[c.rarity], v = PASSIVES[c.id].per * m, p = this.passives[c.id] ?? (this.passives[c.id] = { n: 0, v: 0 });
      p.n++; p.v += v;
      if (c.id === 'fluff') this.fluff = Math.min(this.stats().maxFluff, this.fluff + v);
    } else {
      let w = this.weapons.find(x => x.id === c.id);
      if (!w) this.weapons.push(newWeapon(c.id));
      else {
        const m = RARITY.mult[c.rarity];
        w.level++; w.dmg += CARD.damage * m;
        const step = WEAPONS[w.id].steps[w.level - 2];
        if (step === 'count') w.count += CARD.count; else w[step] += CARD[step] * m;
      }
    }
    this.picks--; this.offer = [];
    this.st = this.stats();
    if (this.picks > 0) this.offer = this.deal(); else this.phase = 'play';
    return true;
  }

  /** Redeals the offer for one reroll, spending the layer's before camp's. Overclock offers and a lone Snack can't be
   *  rerolled. */
  reroll(): boolean {
    const k = this.offer[0]?.k;
    if (this.phase !== 'pick' || this.rerolls <= 0 || k === 'overclock' || k === 'snack') return false;
    if (this.layerReroll > 0) this.layerReroll--; else this.campRerolls--;
    this.offer = this.deal();
    return true;
  }

  // 7. Spawns: bursts, elites, then a trickle toward the target alive, never past MAX_ALIVE.
  spawnWaves() {
    if (!this.spawning) return;
    if (this.t >= this.nextBurst) { this.nextBurst = (Math.floor(this.t / BURST.every) + 1) * BURST.every; this.burst(); }
    if (this.layer >= ELITE.from && this.t >= this.nextElite) {
      this.nextElite = FIRST_ELITE + (Math.floor((this.t - FIRST_ELITE) / ELITE.every) + 1) * ELITE.every;
      if (this.critters.length < MAX_ALIVE && this.spawnSpot(-1)) this.spawn(this.pickKind(), this.spot.x, this.spot.y, true);
    }
    const target = targetAlive(this.t, this.layer, this.hazard, this.pod !== null && !this.pod.reached);
    this.spawnCd -= this.dt;
    while (this.spawnCd <= 0 && this.critters.length < target) {
      this.spawnCd += SPAWN_GAP;
      if (!this.spawnSpot(-1)) continue;
      const kind = this.pickKind();
      if (kind !== 'mite') { this.spawn(kind, this.spot.x, this.spot.y); continue; }
      const n = MITE.pack[0] + this.rand.int(MITE.pack[1] - MITE.pack[0] + 1);
      for (let i = 0; i < n && this.critters.length < MAX_ALIVE; i++) {
        this.spawn('mite', this.spot.x + (this.rand.next() - 0.5) * 0.6, this.spot.y + (this.rand.next() - 0.5) * 0.6);
      }
    }
    if (this.spawnCd < 0) this.spawnCd = 0;
  }

  /** A swarm burst: BURST.n critters at once from one side, up to the cap. */
  private burst() {
    const side = this.rand.int(4), dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    this.events.push({ k: 'burst', dx: dirs[side][0], dy: dirs[side][1] });
    const n = Math.min(BURST.n, MAX_ALIVE - this.critters.length);
    for (let i = 0; i < n; i++) if (this.spawnSpot(side)) this.spawn(this.pickKind(), this.spot.x, this.spot.y);
  }

  private pickKind(): CritterId {
    const [s, m, b] = LAYER_MIX[this.layer];
    const x = this.rand.next() * (s + m + b);
    return x < s ? 'soot' : x < s + m ? 'mite' : 'beetle';
  }

  /** Finds an open tile 1-3 tiles beyond the view's edge on a side (0 right, 1 left, 2 down, 3 up; -1 any) and puts
   *  its centre in `spot`. Gives up after 8 tries. */
  private spawnSpot(side: number): boolean {
    const hw = this.view.w / 2, hh = this.view.h / 2;
    for (let i = 0; i < 8; i++) {
      const s = side < 0 ? this.rand.int(4) : side, out = 1 + this.rand.next() * 2, along = this.rand.next() * 2 - 1;
      const x = s === 0 ? this.hx + hw + out : s === 1 ? this.hx - hw - out : this.hx + along * (hw + 3);
      const y = s === 2 ? this.hy + hh + out : s === 3 ? this.hy - hh - out : this.hy + along * (hh + 3);
      const tx = Math.floor(x), ty = Math.floor(y);
      if (tileAt(this.map, tx, ty) === 'floor') { this.spot.x = tx + 0.5; this.spot.y = ty + 0.5; return true; }
    }
    return false;
  }

  // 8. Jobs and the wyrm. Haul and crates count where crystals are taken and blocks dug; lanterns and the big one here.
  jobs() {
    const j = this.job;
    if (j && !j.done) {
      if (j.id === 'lanterns') this.lanterns(j);
      else if (j.id === 'bigone') this.bigOne();
    }
    if (this.layer === 5) this.wyrmStep();
  }

  /** Adds n to the job's count, up to its goal, and emits `job`; reaching the goal pays its gold x layer, once. */
  private progress(n: number) {
    const j = this.job;
    if (!j || j.done) return;
    j.n = Math.min(j.goal, j.n + n);
    if (j.n >= j.goal) { j.done = true; this.addGold(JOBS[j.id].gold * this.layer); }
    this.events.push({ k: 'job', id: j.id, n: j.n, done: j.done });
  }

  /** Standing within `reach` of an unlit lantern's centre for `stand` seconds lights it; stepping away starts over. */
  private lanterns(j: JobState) {
    const L = JOBS.lanterns, lit = j.lit ?? (j.lit = []), props = this.map.props;
    let at = -1;
    for (let i = 0; i < props.length && at < 0; i++) {
      const p = props[i];
      if (p.kind === 'lantern' && !lit.includes(i) && Math.hypot(p.x + 0.5 - this.hx, p.y + 0.5 - this.hy) <= L.reach) at = i;
    }
    if (at < 0) { j.standing = 0; return; }
    j.standing = (j.standing ?? 0) + this.dt;
    if (j.standing >= L.stand - EPS) { j.standing = 0; lit.push(at); this.progress(1); }
  }

  /** The slow a lit lantern's warm pool puts on a critter at (x, y): JOBS.lanterns.slow within `pool` tiles, else 0. */
  private poolSlow(x: number, y: number) {
    const j = this.job;
    if (!j || j.id !== 'lanterns' || !j.lit?.length) return 0;
    const L = JOBS.lanterns;
    for (const i of j.lit) { const p = this.map.props[i]; if (Math.hypot(p.x + 0.5 - x, p.y + 0.5 - y) <= L.pool) return L.slow; }
    return 0;
  }

  /** The big one: an elite of the layer's mix comes in off screen at JOBS.bigone.at (ignoring the cap); bonking it
   *  drops the job's crystal cache beside its own and completes the job. */
  private bigOne() {
    if (this.bigId === null) {
      if (this.t >= JOBS.bigone.at - EPS && this.spawnSpot(-1)) this.bigId = this.spawn(this.pickKind(), this.spot.x, this.spot.y, true).id;
      return;
    }
    for (const e of this.events) {
      if (e.k !== 'bonk' || e.id !== this.bigId) continue;
      this.crystals.push({ x: e.x, y: e.y, n: JOBS.bigone.cache });
      this.progress(1);
      return;
    }
  }

  // ── The Rock Wyrm ──

  /** Brings the wyrm up with its head at (x, y), heading `dir` radians, its body laid straight out behind. */
  raiseWyrm(x: number, y: number, dir: number) {
    const max = WYRM.fluff * (1 + 0.25 * (this.hazard - 1)), back = (WYRM.segments + 2) * WYRM.spacing;
    const w: Wyrm = this.wyrm = {
      x, y, dir, fluff: max, max, segs: Array.from({ length: WYRM.segments + 1 }, () => ({ x, y })),
      under: 0, rumble: WYRM.rumbleEvery, ring: null, ringHit: false, fast: false, bonked: false,
    };
    this.wyrmTrail = [x - Math.cos(dir) * back, y - Math.sin(dir) * back, x, y];
    this.placeSegs(w);
    this.events.push({ k: 'wyrm', what: 'surface', x, y });
    this.wyrmDig(w);
  }

  /** Takes dmg from the wyrm's head, unless it's underground or bonked. At WYRM.diveAt of its Fluff it dives for
   *  WYRM.diveFor s, once; at 0 it's bonked: it drops its crystals, pays its gold x hazard, and the pod lands. */
  hurtWyrm(dmg: number) {
    const w = this.wyrm;
    if (!w || w.bonked || w.under > 0) return;
    w.fluff = Math.max(0, w.fluff - dmg); this.head.fluff = w.fluff;
    if (w.fluff <= 0) {
      w.bonked = true; w.ring = null;
      this.events.push({ k: 'wyrm', what: 'bonked', x: w.x, y: w.y });
      // Its head is on dug floor unless it was crossing bedrock; then the crystals come to the hero.
      const open = tileAt(this.map, Math.floor(w.x), Math.floor(w.y)) === 'floor';
      this.crystals.push({ x: open ? w.x : this.hx, y: open ? w.y : this.hy, n: WYRM.crystals });
      this.addGold(WYRM.gold * this.hazard);
      this.landPod();
    } else if (!w.fast && w.fluff <= w.max * WYRM.diveAt) {
      w.under = WYRM.diveFor; w.ring = null; w.rumble = WYRM.rumbleEvery; this.head.fluff = 0;
      this.events.push({ k: 'wyrm', what: 'dive', x: w.x, y: w.y });
    }
  }

  /** Layer 5's wyrm, a step: it surfaces WYRM_RISE tiles from the hero at WYRM_AT; then it rumbles every
   *  WYRM.rumbleEvery s (holding still, reared up, through the telegraph and the ring), and otherwise circles the hero
   *  at WYRM_CIRCLE tiles, digging, and bumps a hero it touches. Underground it keeps circling but does nothing else. */
  private wyrmStep() {
    const w = this.wyrm, dt = this.dt, m = this.map;
    if (!w) {
      if (this.t < WYRM_AT - EPS) return;
      const a = this.rand.next() * 2 * Math.PI;
      const x = Math.min(m.w - 2.5, Math.max(2.5, this.hx + Math.cos(a) * WYRM_RISE)), y = Math.min(m.h - 2.5, Math.max(2.5, this.hy + Math.sin(a) * WYRM_RISE));
      this.raiseWyrm(x, y, a + Math.PI / 2);
      return;
    }
    if (w.bonked) return;
    if (w.under > 0) {
      w.under -= dt;
      if (w.under <= EPS) {
        w.under = 0; w.fast = true; w.rumble = WYRM.rumbleEvery;
        this.events.push({ k: 'wyrm', what: 'surface', x: w.x, y: w.y });
      }
    } else {
      const was = w.rumble;
      w.rumble -= dt;
      if (was > WYRM.telegraph && w.rumble <= WYRM.telegraph) this.events.push({ k: 'wyrm', what: 'rumble', x: w.x, y: w.y });
      if (w.rumble <= EPS && w.ring === null) { w.rumble += WYRM.rumbleEvery; w.ring = 0; w.ringHit = false; }
    }
    if (w.ring !== null) {
      w.ring = Math.min(WYRM.ring, w.ring + WYRM.ring / RING_TIME * dt);
      const d = Math.hypot(this.hx - w.x, this.hy - w.y);
      if (!w.ringHit && this.fluff > 0 && Math.abs(d - w.ring) <= WYRM.ringWidth) { w.ringHit = true; this.hurt(Math.max(1, WYRM.ringDamage - this.st.armour)); }
      if (w.ring >= WYRM.ring) w.ring = null;
    }
    if (w.under <= 0 && (w.rumble <= WYRM.telegraph || w.ring !== null)) { this.wyrmTouch(w); return; }

    // Steer for a point WYRM_LEAD radians on around the circle, turning at most WYRM_TURN a second.
    const go = WYRM.speed * (w.fast ? WYRM.fastAfter : 1) * dt, a = Math.atan2(w.y - this.hy, w.x - this.hx) + WYRM_LEAD;
    const want = Math.atan2(this.hy + Math.sin(a) * WYRM_CIRCLE - w.y, this.hx + Math.cos(a) * WYRM_CIRCLE - w.x);
    let turn = want - w.dir;
    turn -= Math.round(turn / (2 * Math.PI)) * 2 * Math.PI;
    w.dir += Math.max(-WYRM_TURN * dt, Math.min(WYRM_TURN * dt, turn));
    w.dir -= Math.round(w.dir / (2 * Math.PI)) * 2 * Math.PI;
    w.x = Math.min(m.w - 1, Math.max(1, w.x + Math.cos(w.dir) * go)); w.y = Math.min(m.h - 1, Math.max(1, w.y + Math.sin(w.dir) * go));
    const tr = this.wyrmTrail;
    if (Math.hypot(w.x - tr[tr.length - 2], w.y - tr[tr.length - 1]) >= TRAIL_STEP) { tr.push(w.x, w.y); if (tr.length > TRAIL_MAX) tr.splice(0, 2); }
    this.placeSegs(w);
    if (w.under <= 0) this.wyrmDig(w);
    this.wyrmTouch(w);
  }

  /** Puts each segment `spacing` further back along the head's trail. */
  private placeSegs(w: Wyrm) {
    for (let i = 0; i < w.segs.length; i++) backAlong(this.wyrmTrail, w.x, w.y, (i + 1) * WYRM.spacing, w.segs[i]);
  }

  /** Digs the block under the head, paying nothing. Bedrock stays; the wyrm passes through it. */
  private wyrmDig(w: Wyrm) {
    const tx = Math.floor(w.x), ty = Math.floor(w.y);
    if (tileAt(this.map, tx, ty) in DIG_TIME) this.digBlock(tx, ty, 0);
  }

  /** The head or any segment touching the hero bumps for WYRM.contact, less armour, through grace. */
  private wyrmTouch(w: Wyrm) {
    if (w.under > 0 || this.grace > 0 || this.fluff <= 0) return;
    const r = BASE.radius, hx = this.hx, hy = this.hy;
    let touch = (w.x - hx) ** 2 + (w.y - hy) ** 2 <= (r + WYRM.head) ** 2;
    for (const s of w.segs) if (!touch && (s.x - hx) ** 2 + (s.y - hy) ** 2 <= (r + WYRM.body) ** 2) touch = true;
    if (touch) this.hurt(Math.max(1, WYRM.contact - this.st.armour));
  }

  // 9. The pod: it lands when the clock runs out, and is reached within 1 tile. A bonked hero never reaches it.
  podCheck() {
    if (this.fluff <= 0) return;
    if (!this.pod) { if (this.timer <= 0 && this.layer < 5) this.landPod(); return; }
    if (this.pod.reached) return;
    if (Math.hypot(this.hx - this.pod.x, this.hy - this.pod.y) <= 1) {
      this.pod.reached = true; this.gold.banked += this.gold.layer; this.gold.layer = 0;
      this.events.push({ k: 'podReached' });
      if (this.layer === 5) this.result = 'complete'; else this.phase = 'pod';
    } else if (this.timer <= 0) this.result = 'missed';
  }

  // 10. Over: bonked at 0 Fluff or a missed pod keeps half the layer's gold, rounded down.
  overCheck() {
    if (!this.result && this.fluff <= 0) this.result = 'bonked';
    if (!this.result) return;
    this.phase = 'over';
    if (this.result !== 'complete') { this.gold.banked += Math.floor(this.gold.layer / 2); this.gold.layer = 0; }
    this.events.push({ k: 'over', result: this.result });
  }
}

// ── The bot's policy ───────────────────────────────────────────────────────

/** The policy's reach in tiles (critters to flee, crystals and gold blocks to fetch), the most the crowd's push counts
 *  for, and the weight of each pull. */
export const BOT = { flee: 5, crystal: 4, gold: 3, urge: 2, pod: 4, crystalPull: 1, jobPull: 0.8, goldPull: 0.7, bigPull: 0.6 };
/** The 16 headings the policy chooses among when it flees, so it never runs into rock. */
const HEADINGS = Array.from({ length: 16 }, (_, i) => ({ x: Math.cos(i * Math.PI / 8), y: Math.sin(i * Math.PI / 8) }));
const D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** The unit step from the hero toward tile (tx, ty) along the flow field, or null when it's rock or cut off. On the
 *  hero's own tile it points straight at (px, py). */
function route(d: Dive, f: Int16Array, tx: number, ty: number, px: number, py: number): Input | null {
  const m = d.map, w = m.w;
  if (tx < 0 || ty < 0 || tx >= w || ty >= m.h || f[ty * w + tx] < 0) return null;
  let x = tx, y = ty;
  // Walks back down the field to the tile next to the hero's.
  while (f[y * w + x] > 1) {
    const k = f[y * w + x];
    for (const [dx, dy] of D4) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < w && ny < m.h && f[ny * w + nx] === k - 1) { x = nx; y = ny; break; }
    }
  }
  const gx = f[y * w + x] === 0 ? px : x + 0.5, gy = f[y * w + x] === 0 ? py : y + 0.5;
  const vx = gx - d.hx, vy = gy - d.hy, len = Math.hypot(vx, vy);
  return len < 1e-3 ? { x: 0, y: 0 } : { x: vx / len, y: vy / len };
}

/** The step toward a solid block at (bx, by): along the field to its nearest open side, then into it. Null when no
 *  side is reached. `stand` returns no push once the hero is on that side (lanterns are stood by, not dug). */
function routeBlock(d: Dive, f: Int16Array, bx: number, by: number, stand = false): Input | null {
  const m = d.map, w = m.w;
  let best = -1, bk = Infinity;
  for (const [dx, dy] of D4) {
    const nx = bx + dx, ny = by + dy;
    if (nx < 0 || ny < 0 || nx >= w || ny >= m.h) continue;
    const k = f[ny * w + nx];
    if (k >= 0 && k < bk) { bk = k; best = ny * w + nx; }
  }
  if (best < 0) return null;
  const sx = best % w, sy = (best - sx) / w;
  if (bk > 0) return route(d, f, sx, sy, sx + 0.5, sy + 0.5);
  if (stand) return { x: 0, y: 0 };
  // On the open side: push square into the block, centred on the shared edge so the dig lands on it.
  const ex = bx - sx, ey = by - sy, cx = ex ? 0 : sx + 0.5 - d.hx, cy = ey ? 0 : sy + 0.5 - d.hy;
  const vx = ex + cx * 2, vy = ey + cy * 2, len = Math.hypot(vx, vy);
  return { x: vx / len, y: vy / len };
}

/**
 * The bot's stick for this step, the spec's plain policy. It flees the weighted centre of the critters within 5 tiles
 * (weight 1 / distance squared; the wyrm counts heavily, and more while it rumbles), on the open heading closest to
 * straight away. It is drawn toward the nearest crystal within 4 tiles, the job's target, a gold block within 3 tiles
 * and, once it lands, the pod, which outweighs everything. Every pull is routed along the flow field, so the bot
 * walks round rock rather than into it, and only pushes into a block it means to dig.
 */
export function drive(d: Dive): Input {
  if (d.phase !== 'play') return { x: 0, y: 0 };
  const m = d.map, w = m.w, hx = d.hx, hy = d.hy, f = d.flowField(), htx = Math.floor(hx), hty = Math.floor(hy);
  let ax = 0, ay = 0;
  const pull = (v: Input | null, k: number) => { if (v) { ax += v.x * k; ay += v.y * k; } };

  // The crowd: the weighted centre of what's near.
  let sx = 0, sy = 0, sw = 0;
  const threat = (x: number, y: number, k: number) => {
    const ex = x - hx, ey = y - hy, d2 = ex * ex + ey * ey;
    if (d2 > BOT.flee * BOT.flee) return;
    const q = k / Math.max(0.05, d2);
    sx += ex * q; sy += ey * q; sw += q;
  };
  for (const c of d.critters) threat(c.x, c.y, c.elite ? 3 : 1);
  const wy = d.wyrm;
  if (wy && !wy.bonked && wy.under <= 0) {
    const loud = wy.rumble <= WYRM.telegraph || wy.ring !== null ? 6 : 2;
    threat(wy.x, wy.y, loud * 2);
    for (const s of wy.segs) threat(s.x, s.y, 2);
  }

  if (d.pod && !d.pod.reached) pull(route(d, f, Math.floor(d.pod.x), Math.floor(d.pod.y), d.pod.x, d.pod.y), BOT.pod);
  else {
    // The nearest crystal within reach (any distance on a haul).
    const haul = d.job?.id === 'haul' && !d.job.done;
    let cb: { x: number; y: number } | null = null, cd = haul ? Infinity : BOT.crystal * BOT.crystal;
    for (const c of d.crystals) {
      const d2 = (c.x - hx) ** 2 + (c.y - hy) ** 2;
      if (d2 < cd && f[Math.floor(c.y) * w + Math.floor(c.x)] >= 0) { cd = d2; cb = c; }
    }
    if (cb) pull(route(d, f, Math.floor(cb.x), Math.floor(cb.y), cb.x, cb.y), BOT.crystalPull);

    // The job's target.
    const j = d.job;
    if (j && !j.done) {
      if (j.id === 'crates' || j.id === 'lanterns') {
        let pb = -1, pd = Infinity;
        m.props.forEach((p, i) => {
          if (p.kind === 'crate' ? j.id !== 'crates' || tileAt(m, p.x, p.y) !== 'crate' : j.id !== 'lanterns' || j.lit?.includes(i)) return;
          const d2 = (p.x + 0.5 - hx) ** 2 + (p.y + 0.5 - hy) ** 2;
          if (d2 < pd) { pd = d2; pb = i; }
        });
        if (pb >= 0) {
          const p = m.props[pb], at = j.id === 'lanterns' && Math.hypot(p.x + 0.5 - hx, p.y + 0.5 - hy) <= JOBS.lanterns.reach - 0.15;
          // Standing by a lantern, it holds its ground unless the crowd is right on it.
          if (at) { sw = sw > 1.5 ? sw : 0; } else pull(routeBlock(d, f, p.x, p.y, j.id === 'lanterns'), BOT.jobPull);
        }
      } else if (j.id === 'bigone' && d.bigId !== null) {
        const big = d.critters.find(c => c.id === d.bigId);
        if (big && (big.x - hx) ** 2 + (big.y - hy) ** 2 > 9) pull(route(d, f, Math.floor(big.x), Math.floor(big.y), big.x, big.y), BOT.bigPull);
      }
    }

    // The nearest gold block within 3 tiles that has an open side.
    let gb = -1, gd = BOT.gold * BOT.gold + 1e-9;
    for (let y = Math.max(0, hty - BOT.gold); y <= Math.min(m.h - 1, hty + BOT.gold); y++) {
      for (let x = Math.max(0, htx - BOT.gold); x <= Math.min(w - 1, htx + BOT.gold); x++) {
        if (m.tiles[y * w + x] !== 'gold') continue;
        const d2 = (x + 0.5 - hx) ** 2 + (y + 0.5 - hy) ** 2;
        if (d2 < gd) { gd = d2; gb = y * w + x; }
      }
    }
    if (gb >= 0) pull(routeBlock(d, f, gb % w, Math.floor(gb / w)), BOT.goldPull);
  }

  // Flee on the open heading nearest straight away, harder the closer the crowd.
  if (sw > 0) {
    const cx = sx / sw, cy = sy / sw, len = Math.hypot(cx, cy), urge = Math.min(BOT.urge, sw);
    let ux = len > 1e-6 ? -cx / len : 0, uy = len > 1e-6 ? -cy / len : 0;
    if (len > 1e-6) {
      let best = -Infinity;
      for (const h of HEADINGS) {
        const open = !solid(tileAt(m, Math.floor(hx + h.x * 0.8), Math.floor(hy + h.y * 0.8)))
          && !solid(tileAt(m, Math.floor(hx + h.x * 1.6), Math.floor(hy + h.y * 1.6)));
        const score = h.x * -cx / len + h.y * -cy / len - (open ? 0 : 2);
        if (score > best) { best = score; ux = h.x; uy = h.y; }
      }
    }
    ax += ux * urge; ay += uy * urge;
  }
  const len = Math.hypot(ax, ay);
  return len < 0.05 ? { x: 0, y: 0 } : { x: ax / len, y: ay / len };
}

/** The bot's card: the first of an overclock pair (dealt shuffled, so it varies); otherwise by fixed weights, a new
 *  weapon 5 while a slot is free, a held weapon 3, a passive 2 and a Snack 1. */
export function botPick(d: Dive, r: Rand): number {
  const o = d.offer;
  if (!o.length || o[0].k === 'overclock') return 0;
  const held = new Set(d.weapons.map(x => x.id));
  const ws = o.map(c => c.k === 'weapon' ? (held.has(c.id) ? 3 : 5) : c.k === 'passive' ? 2 : 1);
  let x = r.next() * ws.reduce((a, b) => a + b, 0);
  for (let i = 0; i < ws.length; i++) { x -= ws[i]; if (x < 0) return i; }
  return ws.length - 1;
}

/** The bot's reroll, tried once per offer: while rerolls remain, it rerolls an offer with no held-weapon card and,
 *  while a slot is free, no new weapon. Returns whether it rerolled. */
export function botReroll(d: Dive): boolean {
  if (d.phase !== 'pick' || d.rerolls <= 0) return false;
  const held = new Set(d.weapons.map(x => x.id)), free = d.weapons.length < MAX_WEAPONS;
  const useful = d.offer.some(c => c.k === 'weapon' && (held.has(c.id) || free));
  return !useful && d.reroll();
}

/** A random player's card: any of the offer, evenly. */
export function randomPick(d: Dive, r: Rand): number { return r.int(Math.max(1, d.offer.length)); }

// ── Camp ───────────────────────────────────────────────────────────────────

const UNLOCKABLE = Object.keys(UNLOCK) as (keyof typeof UNLOCK)[];

export function freshProfile(): Profile {
  const upgrades = {} as Record<UpgradeId, number>;
  for (const id of UPGRADE_IDS) upgrades[id] = 0;
  return { v: 1, gold: 0, upgrades, unlocked: { hazard: 1, weapons: [] }, stats: { dives: 0, bestLayer: 0, bonked: 0, finished: 0, finishedHazard: 0 } };
}

/** Reads a stored profile. Anything malformed loads fresh; unknown ids are dropped and numbers clamped. */
export function loadProfile(raw: unknown): Profile {
  const r = raw as Partial<Profile> | null, p = freshProfile();
  if (!r || typeof r !== 'object' || r.v !== 1) return p;
  const int = (x: unknown, hi = 1e9) => typeof x === 'number' && Number.isFinite(x) ? Math.min(hi, Math.max(0, Math.floor(x))) : 0;
  p.gold = int(r.gold);
  const up = r.upgrades as Record<string, unknown> | undefined;
  if (up && typeof up === 'object') for (const id of UPGRADE_IDS) p.upgrades[id] = int(up[id], UPGRADES[id].max);
  const u = r.unlocked;
  if (u && typeof u === 'object') {
    p.unlocked.hazard = Math.max(1, int(u.hazard, 5)) as Hazard;
    if (Array.isArray(u.weapons)) p.unlocked.weapons = UNLOCKABLE.filter(id => (u.weapons as unknown[]).includes(id));
  }
  const st = r.stats as Record<string, unknown> | undefined;
  if (st && typeof st === 'object') for (const k of Object.keys(p.stats) as (keyof Profile['stats'])[]) p.stats[k] = int(st[k]);
  p.stats.bestLayer = Math.min(5, p.stats.bestLayer); p.stats.finishedHazard = Math.min(5, p.stats.finishedHazard);
  return p;
}

/** Spends the next level's cost on an upgrade, if it's affordable and below its max. */
export function buy(p: Profile, id: UpgradeId): boolean {
  const lv = p.upgrades[id], cost = upgradeCost(id, lv + 1);
  if (lv >= UPGRADES[id].max || p.gold < cost) return false;
  p.gold -= cost; p.upgrades[id] = lv + 1;
  return true;
}

/** Banks an ended (or abandoned) dive into the profile: its gold, stats and the unlocks it earned. Runs once per dive. */
export function record(p: Profile, d: Dive): { gold: number; unlocked: WeaponId[]; hazard: Hazard | null } {
  if (d.recorded) return { gold: 0, unlocked: [], hazard: null };
  d.recorded = true;
  const done = d.result === 'complete', gold = d.gold.banked, s = p.stats;
  p.gold += gold; s.dives++; s.bonked += d.bonked; s.bestLayer = Math.max(s.bestLayer, d.layer);
  if (done) { s.finished++; s.finishedHazard = Math.max(s.finishedHazard, d.hazard); }
  const met = (r: (typeof UNLOCK)[keyof typeof UNLOCK]) =>
    r.k === 'layer' ? s.bestLayer >= r.n : r.k === 'finish' ? s.finished > 0 : r.k === 'finishHazard' ? s.finishedHazard >= r.n : s.bonked >= r.n;
  const unlocked = UNLOCKABLE.filter(id => !p.unlocked.weapons.includes(id) && met(UNLOCK[id]));
  p.unlocked.weapons.push(...unlocked);
  let hazard: Hazard | null = null;
  if (done && d.hazard < 5 && d.hazard + 1 > p.unlocked.hazard) { hazard = (d.hazard + 1) as Hazard; p.unlocked.hazard = hazard; }
  else if (done && d.hazard === 5 && p.unlocked.hazard < 5) { hazard = 5; p.unlocked.hazard = 5; }
  return { gold, unlocked, hazard };
}
