// Burrow Clinic: the rules. A deterministic hospital-management sim stepped at a fixed 10 ticks a second, with every
// random roll from a seeded generator kept in the state, so the same seed and the same commands at the same ticks
// always give the same clinic. No DOM. The whole clinic is plain JSON-able data in `Game.s` (the path cache and the
// event feed for the scene live beside it and are rebuilt on load).
//
// A day runs 08:00 to 20:00 in DAY ticks. Patients arrive (rate set by the clinic, reputation, the weather and how
// full the waiting area is) until 18:00, check in at Reception, see a vet in a Check-up Room (who may guess wrong:
// the wrong cure then fails gently and they come back), queue for their cure room, are cured and pay. They wait on
// benches if they can, buy or fetch a drink when thirsty, and lose patience in long queues (faster standing, thirsty,
// cold or near litter; slower near plants, cheery staff, Dora and Enzo). With no patience left they go home unhappy.
// Staff are dispatched to rooms that need them, tire, and rest in a Staff Room; cleaners fix worn machines, water
// plants and sweep. Wages are paid at 20:00. Each clinic has three goals; stars for meeting them, meeting them fast,
// and meeting them with a high reputation.
import {
  ROOMS, AILMENTS, SPECIES, ROLES, TRAITS, DECOS, CLINICS, PATIENT_SPECIES, PATIENT_NAMES, STAFF_NAMES, clinicById, ROLE_ORDER,
  type RoomKind, type Role, type Trait, type AilmentId, type SpeciesId, type DecoKind, type ClinicDef, type Pose,
} from './clinic-levels.js';
import { newGrid, astar, bfs, canStep, DIRS, PathCache, type Grid, type Pt } from './clinic-path.js';

export * from './clinic-levels.js';
export type { Pt } from './clinic-path.js';

export const TICKS_PER_SEC = 10;
/** ticks in one in-game day (08:00 to 20:00) */
export const DAY = 1500;
export const HOUR = DAY / 12;
export const OPEN_HOUR = 8;
export const LAST_ARRIVAL = 10 * HOUR; // 18:00
export const SAVE_KEY = 'burrow-clinic-v1';
export const PORCH = 3; // walkable porch tiles outside the front door

export type Side = 'N' | 'S' | 'E' | 'W';
export const SIDE_D: Record<Side, Pt> = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };
export interface Door { x: number; y: number; side: Side }
export interface Slot { x: number; y: number; patient: number; progress: number; wear: number; broken: boolean; fixer: number }
export interface Room {
  id: number; kind: RoomKind; x: number; y: number; w: number; h: number; rot: number; door: Door; cost: number;
  /** machine tiles (blocked) */
  mach: Pt[];
  slots: Slot[];
  staffSpot: Pt;
  /** where resting staff sit (staff room only) */
  rest: Pt[];
  staff: number;
  /** cleanliness of this room's floor is shared with the corridor litter; this counts uses for the info card */
  uses: number;
  /** machine level 1 to 3 (upgrades: faster treatments, less wear) */
  level: number;
  /** staff room only: a 3-star vet resting here teaches the others (costs TRAIN_COST a day) */
  train: boolean;
}
/** `rot`: the way the decoration's front faces (0 +x, 1 +y, 2 -x, 3 -y, like a mover's dir): a bench seats patients
 *  facing it, and thirsty patients queue at a cooler's or cart's front */
export interface Deco { id: number; kind: DecoKind; x: number; y: number; water: number; seats: number[]; fixer: number; cost: number; rot: number }
export const DIR_D: Pt[] = [[1, 0], [0, 1], [-1, 0], [0, -1]];
export interface Litter { id: number; x: number; y: number; fixer: number }

export type Phase = 'arrive' | 'wait' | 'to_slot' | 'in_slot' | 'drink' | 'cheer' | 'leave' | 'gone';
export interface Mover { x: number; y: number; px: number; py: number; path: Pt[]; goal: Pt | null; dir: number; step: number }
export interface Patient extends Mover {
  id: number; sp: SpeciesId; name: string; ail: AilmentId; dx: AilmentId | null; sure: boolean; wrongs: AilmentId[];
  need: RoomKind; phase: Phase; room: number; slot: number; spot: Pt | null; seat: number; drinkAt: number;
  patience: number; thirst: number; timer: number; vip: boolean; emerg: number; happy: boolean; arrivedAt: number; cured: boolean; fail: number;
  /** their place in a room's waiting line: the room, and the index along the line (-1: not in a line) */
  qr: number; qi: number; fd: number;
  /** what a cured patient takes home (0 none, 1 a coral balloon, 2 a teal balloon, 3 a lollipop, 4 a pinwheel) */
  gift: number;
}
export type StaffState = 'arrive' | 'idle' | 'go' | 'work' | 'to_rest' | 'rest' | 'task' | 'leave' | 'gone';
export interface Task { type: 'fix' | 'water' | 'sweep'; ref: number; slot: number }
export interface Staff extends Mover {
  id: number; role: Role; name: string; look: string; skill: number; trait: Trait; wage: number;
  energy: number; state: StaffState; room: number;
  /** the room the player dropped them into (0: they go wherever they are needed) */
  home: number; task: Task | null; timer: number; hired: number; held: boolean;
  /** experience towards the next star, jobs done today and in all, and how they feel about the job (0 to 100) */
  xp: number; today: number; jobs: number; mood: number;
}
export interface Walker extends Mover { id: number; who: 'dora' | 'enzo' | 'inspector'; timer: number; stops: number[]; seen: number }
export interface Candidate { id: number; role: Role; name: string; look: string; skill: number; trait: Trait; wage: number }
export type EventKind = 'emergency' | 'inspector' | 'vip' | 'breakdown';
export interface Offer { id: number; kind: 'emergency'; ail: AilmentId; sp: SpeciesId; count: number; bonus: number; hours: number; expires: number }
export interface Emergency { id: number; ail: AilmentId; sp: SpeciesId; count: number; spawned: number; cured: number; bonus: number; deadline: number; done: boolean }
export interface Met { day: number; rep: number; stars: number; t: number }
export interface Plan { day: number; hour: number; kind: EventKind; ail: AilmentId | null; done: boolean }
/** a staff member asking for a raise */
export interface Raise { id: number; staff: number; amount: number; expires: number }
/** what happened today, for the Burrow Bulletin */
export interface Today {
  cures: number; earned: number; spent: number; rep: number; unhappy: number; wrong: number;
  emergOk: { sp: SpeciesId; count: number } | null; emergMiss: boolean; vip: string | null; inspector: 'good' | 'bad' | null;
  broken: RoomKind | null; levelups: string[]; rain: boolean;
  quote: { name: string; sp: SpeciesId; ail: AilmentId } | null; grump: { name: string; sp: SpeciesId } | null;
}
/** the day-end newspaper */
export interface Bulletin {
  day: number; headline: string; sub: string; cures: number; earned: number; spent: number; rep: number;
  star: { name: string; look: string; role: Role; jobs: number } | null;
  quote: { name: string; sp: SpeciesId; text: string } | null;
  tip: string;
}
/** why a patient feels the way they do */
export type WhyId = 'thirst' | 'wait' | 'litter' | 'cold' | 'stand' | 'noroom' | 'plants' | 'decor' | 'bench' | 'cheer';
export interface Why { id: WhyId; good: boolean; text: string }
export const TRAIN_COST = 30;
/** machine levels: how much faster a treatment runs, and how much wear it causes */
export const UPGRADE_SPEED = [1, 1, 1.25, 1.5];
export const UPGRADE_WEAR = [1, 1, 0.7, 0.45];
export const canUpgrade = (k: RoomKind) => k !== 'reception' && k !== 'checkup' && k !== 'staff';
const cap = (t: string) => t.replace(/(^|\s)\S/g, (c) => c.toUpperCase());
/** what a cured patient says to the Bulletin */
export const QUOTES: Record<AilmentId, string> = {
  static: 'My fur stopped crackling! I can hug my friends again.',
  hiccups: 'Not one echo since lunch. Bliss!',
  ears: 'My ears are the right way up. I can hear the birds!',
  sneezes: 'No more snowballs. My nose feels toasty.',
  dust: 'One proper roll in the sand and I feel brand new.',
  tangle: 'My tail is smooth as silk. I might show it off.',
  glow: 'I can finally sleep without my whiskers lighting up the room.',
  puff: 'I fit through doors again! Thank you, team.',
  spots: 'Wide awake and spotless. Time for a walk!',
};
export const XP_FOR = (skill: number) => 20 + 15 * skill;

export interface State {
  v: 1; clinic: string; seed: number; rng: number; t: number; open: boolean; nextId: number; layout: number;
  coins: number; rep: number; cures: number; leftUnhappy: number; earned: number; spent: number;
  strict: boolean; assist: boolean; tut: number; result: 'playing' | 'met' | 'failed';
  met: Met | null;
  rooms: Room[]; decos: Deco[]; litter: Litter[];
  patients: Patient[]; staff: Staff[]; walkers: Walker[];
  cands: Candidate[];
  offer: Offer | null; emergencies: Emergency[]; plans: Plan[];
  rain: { from: number; to: number } | null;
  day: number; wagesPaid: number;
  today: Today; bulletin: Bulletin | null; raise: Raise | null;
  log: { t: number; text: string }[];
  stats: { diagnosed: number; wrong: number; drinks: number; repairs: number; inspections: number };
}

export type Ev =
  | { t: 'cure'; x: number; y: number; coins: number; id: number }
  | { t: 'coins'; x: number; y: number; coins: number }
  | { t: 'grumpy'; x: number; y: number; id: number }
  | { t: 'leave'; x: number; y: number; id: number }
  | { t: 'wrong'; x: number; y: number; id: number }
  | { t: 'arrive'; id: number }
  | { t: 'checkin'; x: number; y: number }
  | { t: 'machine'; kind: RoomKind; x: number; y: number }
  | { t: 'broken'; x: number; y: number; room: number }
  | { t: 'fixed'; x: number; y: number }
  | { t: 'build'; x: number; y: number; id?: number }
  | { t: 'rotate'; x: number; y: number }
  | { t: 'sell'; x: number; y: number; coins: number }
  | { t: 'offer'; id: number }
  | { t: 'emergency'; ok: boolean; bonus: number }
  | { t: 'inspector'; ok: boolean; text: string }
  | { t: 'vip'; id: number }
  | { t: 'day'; day: number; wages: number }
  | { t: 'met'; stars: number }
  | { t: 'failed' }
  | { t: 'tut'; step: number }
  | { t: 'open' }
  | { t: 'step'; x: number; y: number }
  | { t: 'drink'; x: number; y: number; coins: number }
  | { t: 'note'; text: string }
  | { t: 'levelup'; id: number; skill: number; x: number; y: number }
  | { t: 'raise'; id: number }
  | { t: 'upgrade'; id: number; level: number; x: number; y: number }
  | { t: 'bulletin'; day: number }
  | { t: 'huff'; x: number; y: number; id: number };

export type Result = { ok: true; id?: number } | { ok: false; reason: string };

// ---------------------------------------------------------------- the seeded generator (mulberry32, state in s.rng)
export function rnd(s: State): number {
  let t = (s.rng = (s.rng + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = <T>(s: State, a: readonly T[]): T => a[Math.floor(rnd(s) * a.length)];
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

export const TUT_STEPS = 6;
export const hourOf = (s: State) => OPEN_HOUR + (s.t % DAY) / HOUR;
export const clockText = (s: State) => { const h = hourOf(s), hh = Math.floor(h), mm = Math.floor((h - hh) * 60 / 10) * 10; return `${hh}:${mm < 10 ? '0' : ''}${mm}`; };
export const isEvening = (s: State) => s.t % DAY >= LAST_ARRIVAL;

/** speed and quality of one staff member */
export function workRate(st: Staff): number {
  let r = 0.7 + 0.12 * st.skill;
  if (st.trait === 'quick') r *= 1.25;
  if (st.energy < 10) r *= 0.5; else if (st.energy < 30) r *= 0.75;
  if ((st.mood ?? 100) < 35) r *= 0.9;
  return r;
}
export function accuracy(st: Staff): number { return Math.min(0.98, 0.6 + 0.08 * st.skill + (st.trait === 'careful' ? 0.1 : 0)); }
export function wageOf(role: Role, skill: number, trait: Trait): number { return Math.round((40 + 22 * skill) * ROLES[role].wage * TRAITS[trait].wage / 5) * 5; }
export const roomCost = (kind: RoomKind, w: number, h: number) => ROOMS[kind].cost + Math.max(0, w * h - ROOMS[kind].minW * ROOMS[kind].minH) * 15;
export const wagesPerDay = (s: State) => s.staff.filter((x) => x.state !== 'gone' && x.state !== 'leave').reduce((a, x) => a + x.wage, 0);

// =====================================================================================================================
export class Game {
  s: State;
  def: ClinicDef;
  grid!: Grid;
  /** the room id on each tile (0 for corridor) */
  roomAt!: Int32Array;
  /** decoration id on each tile */
  decoAt!: Int32Array;
  /** step distance from the front door inside, for the layout helpers */
  entryDist!: Int16Array;
  /** patience multiplier on each tile from decorations (recomputed on layout change and every few ticks for people) */
  comfort!: Float32Array;
  cache = new PathCache();
  events: Ev[] = [];
  private gridVersion = -1;

  constructor(clinic: string, seed = 1, opts: { strict?: boolean; assist?: boolean } = {}) {
    this.def = clinicById(clinic);
    const d = this.def;
    this.s = {
      v: 1, clinic: d.id, seed, rng: (seed * 2654435761) >>> 0 || 1, t: 0, open: false, nextId: 1, layout: 0,
      coins: d.coins, rep: 50, cures: 0, leftUnhappy: 0, earned: 0, spent: 0,
      strict: !!opts.strict, assist: opts.assist !== false, tut: d.twist === 'tutorial' ? 0 : TUT_STEPS, result: 'playing', met: null,
      rooms: [], decos: [], litter: [], patients: [], staff: [], walkers: [], cands: [],
      offer: null, emergencies: [], plans: d.events.map(([day, hour, kind, ail]) => ({ day, hour, kind, ail, done: false })),
      rain: null, day: 1, wagesPaid: 0, today: null as unknown as Today, bulletin: null, raise: null, log: [], stats: { diagnosed: 0, wrong: 0, drinks: 0, repairs: 0, inspections: 0 },
    };
    this.s.today = this.freshToday();
    this.rebuild();
    this.refreshCandidates();
    // Dora and Enzo, the owners, are on the floor from the start
    for (const who of ['dora', 'enzo'] as const) {
      const [x, y] = [this.def.door + (who === 'dora' ? -1 : 1), this.def.h - 2];
      this.s.walkers.push({ id: this.id(), who, x, y, px: x, py: y, path: [], goal: null, dir: 0, step: 0, timer: 20 + (who === 'enzo' ? 40 : 0), stops: [], seen: 0 });
    }
  }

  static load(raw: unknown): Game {
    const o = raw as State;
    if (!o || typeof o !== 'object' || o.v !== 1 || typeof o.clinic !== 'string' || !Array.isArray(o.rooms) || !Array.isArray(o.patients) || !Array.isArray(o.staff)
      || typeof o.t !== 'number' || typeof o.coins !== 'number' || !Number.isFinite(o.coins) || typeof o.rng !== 'number') throw new Error('not a clinic');
    const g = new Game(o.clinic, o.seed);
    g.s = o;
    for (const r of o.rooms) if (!ROOMS[r.kind] || !Array.isArray(r.slots)) throw new Error('bad room');
    // fill in anything a save from before the staff growth, upgrades and bulletins update lacks
    for (const r of o.rooms) { r.level ??= 1; r.train ??= false; }
    for (const p of o.patients) { p.qr ??= 0; p.qi ??= -1; p.fd ??= 1; p.gift ??= 0; }
    for (const st of o.staff) { st.xp ??= 0; st.today ??= 0; st.jobs ??= 0; st.mood ??= 80; }
    o.today ??= g.freshToday(); o.bulletin ??= null; o.raise ??= null;
    for (const d of o.decos) d.rot ??= DECOS[d.kind]?.front ?? 1;
    g.rebuild();
    return g;
  }
  freshToday(): Today {
    const s = this.s;
    return { cures: s.cures, earned: s.earned, spent: s.spent, rep: s.rep, unhappy: s.leftUnhappy, wrong: s.stats.wrong, emergOk: null, emergMiss: false, vip: null, inspector: null, broken: null, levelups: [], rain: false, quote: null, grump: null };
  }
  toJSON(): State { return this.s; }

  id() { return this.s.nextId++; }
  get W() { return this.def.w; }
  get H() { return this.def.h; }
  /** the inside tile of the front door, and the porch tile patients appear on */
  get entry(): Pt { return [this.def.door, this.def.h - 1]; }
  get porch(): Pt { return [this.def.door, this.def.h + PORCH - 1]; }
  note(text: string) { this.s.log.push({ t: this.s.t, text }); if (this.s.log.length > 40) this.s.log.shift(); this.events.push({ t: 'note', text }); }
  roomById(id: number) { return this.s.rooms.find((r) => r.id === id); }
  staffById(id: number) { return this.s.staff.find((r) => r.id === id); }
  patientById(id: number) { return this.s.patients.find((r) => r.id === id); }
  roomsOf(kind: RoomKind) { return this.s.rooms.filter((r) => r.kind === kind); }
  hasRoom(kind: RoomKind) { return this.s.rooms.some((r) => r.kind === kind); }
  unlockedAilments(): AilmentId[] { return this.def.ailments.filter(([, d]) => d <= this.s.day).map(([a]) => a); }
  get day() { return this.s.day; }

  // ------------------------------------------------------------------------------------------------ the grid
  /** rebuild walls, walkability and the per-tile lookups from rooms and decorations */
  rebuild() {
    const { w, h, door } = this.def, GH = h + PORCH;
    const g = newGrid(w, GH);
    const roomAt = new Int32Array(w * GH), decoAt = new Int32Array(w * GH);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) g.walk[y * w + x] = 1;
    for (let y = h; y < GH; y++) g.walk[y * w + door] = 1;
    for (const r of this.s.rooms) {
      for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) roomAt[y * w + x] = r.id;
      for (const [mx, my] of r.mach) g.walk[my * w + mx] = 0;
    }
    for (const r of this.s.rooms) {
      // perimeter edges become walls, except the door
      for (let x = r.x; x < r.x + r.w; x++) {
        if (r.y > 0 && !(r.door.side === 'N' && r.door.x === x)) g.wallS[(r.y - 1) * w + x] = 1;
        if (!(r.door.side === 'S' && r.door.x === x)) g.wallS[(r.y + r.h - 1) * w + x] = 1;
      }
      for (let y = r.y; y < r.y + r.h; y++) {
        if (r.x > 0 && !(r.door.side === 'W' && r.door.y === y)) g.wallE[y * w + r.x - 1] = 1;
        if (r.x + r.w < w && !(r.door.side === 'E' && r.door.y === y)) g.wallE[y * w + r.x + r.w - 1] = 1;
      }
    }
    // the front wall of the building, with the front door
    for (let x = 0; x < w; x++) if (x !== door) g.wallS[(h - 1) * w + x] = 1;
    for (const d of this.s.decos) { decoAt[d.y * w + d.x] = d.id; if (DECOS[d.kind].blocks) g.walk[d.y * w + d.x] = 0; }
    this.grid = g; this.roomAt = roomAt; this.decoAt = decoAt;
    this.entryDist = bfs(g, this.entry[0], this.entry[1]);
    this.computeComfort();
    this.gridVersion = this.s.layout;
    this.qdirty = true;
  }
  /** the layout changed: rebuild, then put anyone stranded somewhere sensible and re-plan everyone's walk */
  relayout() {
    this.s.layout++;
    this.rebuild();
    const all: (Mover & { id: number })[] = [...this.s.patients, ...this.s.staff, ...this.s.walkers];
    for (const m of all) {
      const tx = Math.round(m.x), ty = Math.round(m.y);
      const inside = this.roomAt[ty * this.W + tx];
      const mine = this.belongsIn(m);
      if (inside && inside !== mine) { const p = this.nearestCorridor(tx, ty); m.x = m.px = p[0]; m.y = m.py = p[1]; }
      if (m.goal) this.walkTo(m, m.goal[0], m.goal[1]);
    }
  }
  private belongsIn(m: Mover & { id: number }): number {
    const p = this.s.patients.find((x) => x === m);
    if (p) return p.room;
    const st = this.s.staff.find((x) => x === m);
    if (st) return st.room || (st.task && st.task.type === 'fix' ? st.task.ref : 0) || this.restRoomOf(st);
    return 0;
  }
  private restRoomOf(st: Staff) { if (st.state !== 'rest' && st.state !== 'to_rest') return 0; return this.s.rooms.find((r) => r.kind === 'staff' && st.goal && this.roomAt[st.goal[1] * this.W + st.goal[0]] === r.id)?.id ?? 0; }
  nearestCorridor(x: number, y: number): Pt {
    let best: Pt = this.entry, bd = 1e9;
    for (let yy = 0; yy < this.H; yy++) for (let xx = 0; xx < this.W; xx++) {
      const i = yy * this.W + xx;
      if (this.roomAt[i] || !this.grid.walk[i] || this.entryDist[i] < 0) continue;
      const d = Math.abs(xx - x) + Math.abs(yy - y);
      if (d < bd) { bd = d; best = [xx, yy]; }
    }
    return best;
  }
  tileFree(x: number, y: number) { return x >= 0 && y >= 0 && x < this.W && y < this.H && !this.roomAt[y * this.W + x]; }

  /** patience multipliers from decorations: plants, cactus, lamps, rugs and tables cheer, litter and cold sap */
  computeComfort() {
    const { w } = this.def, GH = this.def.h + PORCH;
    const c = new Float32Array(w * GH).fill(1);
    const plantBoost = this.def.twist === 'plants' ? 0.5 : 0.75;
    const near = (cx: number, cy: number, r: number, f: number) => {
      for (let y = Math.max(0, cy - r); y <= Math.min(GH - 1, cy + r); y++) for (let x = Math.max(0, cx - r); x <= Math.min(w - 1, cx + r); x++) {
        if (Math.abs(x - cx) + Math.abs(y - cy) > r) continue;
        const i = y * w + x; c[i] = Math.max(c[i] * f, 0.45);
      }
    };
    for (const d of this.s.decos) {
      if (d.kind === 'plant' && d.water > 25) near(d.x, d.y, 3, plantBoost);
      else if (d.kind === 'cactus' || d.kind === 'lamp' || d.kind === 'table' || d.kind === 'rug') near(d.x, d.y, 2, 0.88);
    }
    if (this.def.twist === 'cold') {
      const warm = new Uint8Array(w * GH);
      for (const d of this.s.decos) if (d.kind === 'heater') for (let y = Math.max(0, d.y - 4); y <= Math.min(GH - 1, d.y + 4); y++) for (let x = Math.max(0, d.x - 4); x <= Math.min(w - 1, d.x + 4); x++) if (Math.abs(x - d.x) + Math.abs(y - d.y) <= 4) warm[y * w + x] = 1;
      for (let i = 0; i < c.length; i++) if (!warm[i]) c[i] *= 1.45;
    }
    for (const l of this.s.litter) near(l.x, l.y, 1, 1.15);
    this.comfort = c;
  }

  // ------------------------------------------------------------------------------------------------ movement
  walkTo(m: Mover, x: number, y: number): boolean {
    if (this.gridVersion !== this.s.layout) this.rebuild();
    const sx = Math.round(m.x), sy = Math.round(m.y);
    const p = this.cache.get(this.grid, this.s.layout, sx, sy, x, y);
    m.goal = [x, y];
    if (!p) { m.path = []; return false; }
    // part-way between two tiles: first step back onto the tile the path starts from, so nobody cuts a corner
    if (Math.abs(m.x - sx) > 1e-6 || Math.abs(m.y - sy) > 1e-6) p.unshift([sx, sy]);
    m.path = p;
    return true;
  }
  /** advance one mover along its path; true when it has arrived (path empty and on the goal) */
  move(m: Mover, speed: number): boolean {
    m.px = m.x; m.py = m.y;
    let budget = speed;
    while (budget > 0 && m.path.length) {
      const [tx, ty] = m.path[0];
      const dx = tx - m.x, dy = ty - m.y, d = Math.abs(dx) + Math.abs(dy);
      if (d < 1e-6) { m.path.shift(); continue; }
      // face the way we walk: 0 +x, 1 +y, 2 -x, 3 -y
      m.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 0 : 2) : (dy > 0 ? 1 : 3);
      if (d <= budget) { m.x = tx; m.y = ty; budget -= d; m.path.shift(); m.step++; }
      else { const k = budget / d; m.x += dx * k; m.y += dy * k; budget = 0; }
    }
    return m.path.length === 0;
  }
  private atGoal(m: Mover) { return !!m.goal && m.path.length === 0 && Math.abs(m.x - m.goal[0]) < 0.01 && Math.abs(m.y - m.goal[1]) < 0.01; }

  // ------------------------------------------------------------------------------------------------ building
  /** the door a room would get: on the preferred side if a corridor reachable from the front door lies outside it,
   *  else on the edge whose outside tile is closest to the front door */
  autoDoor(x: number, y: number, w: number, h: number, rot: number, extra?: { roomAt: Int32Array; dist: Int16Array }): Door | null {
    const ra = extra?.roomAt ?? this.roomAt, dist = extra?.dist ?? this.entryDist;
    const cands: { d: Door; score: number }[] = [];
    const pref: Side[] = [(['S', 'E', 'N', 'W'] as Side[])[rot % 4]];
    const add = (tx: number, ty: number, side: Side) => {
      const [dx, dy] = SIDE_D[side], ox = tx + dx, oy = ty + dy;
      if (ox < 0 || oy < 0 || ox >= this.W || oy >= this.H) return;
      const i = oy * this.W + ox;
      if (ra[i] || !this.grid.walk[i] || dist[i] < 0) return;
      const mid = side === 'N' || side === 'S' ? Math.abs(tx - (x + (w - 1) / 2)) : Math.abs(ty - (y + (h - 1) / 2));
      cands.push({ d: { x: tx, y: ty, side }, score: (pref.includes(side) ? 0 : 1000) + dist[i] * 2 + mid });
    };
    for (let tx = x; tx < x + w; tx++) { add(tx, y, 'N'); add(tx, y + h - 1, 'S'); }
    for (let ty = y; ty < y + h; ty++) { add(x, ty, 'W'); add(x + w - 1, ty, 'E'); }
    if (!cands.length) return null;
    cands.sort((a, b) => a.score - b.score);
    return cands[0].d;
  }

  /** where the machine, the slots and the staff stand inside a room, given its door */
  layoutRoom(kind: RoomKind, x: number, y: number, w: number, h: number, door: Door): { mach: Pt[]; slots: Pt[]; staffSpot: Pt; rest: Pt[] } {
    const def = ROOMS[kind];
    const inside = (px: number, py: number) => px >= x && py >= y && px < x + w && py < y + h;
    const [ddx, ddy] = SIDE_D[door.side];
    const ix = -ddx, iy = -ddy; // pointing into the room
    const D: Pt = [door.x, door.y];
    const M: Pt = [D[0] + ix, D[1] + iy];
    const perps: Pt[] = ix === 0 ? [[1, 0], [-1, 0]] : [[0, 1], [0, -1]];
    // prefer the side with more room
    perps.sort((a, b) => {
      const room = (p: Pt) => { let n = 0; for (let k = 1; k < 4; k++) if (inside(M[0] + p[0] * k, M[1] + p[1] * k)) n++; return n; };
      return room(b) - room(a);
    });
    if (kind === 'reception') {
      const behind: Pt = [M[0] + ix, M[1] + iy];
      const staffSpot = inside(behind[0], behind[1]) ? behind : [M[0] + perps[0][0], M[1] + perps[0][1]] as Pt;
      return { mach: [M], slots: [D], staffSpot, rest: [] };
    }
    if (kind === 'staff') {
      const rest: Pt[] = [];
      for (let py = y; py < y + h; py++) for (let px = x; px < x + w; px++) if (!(px === M[0] && py === M[1]) && !(px === D[0] && py === D[1])) rest.push([px, py]);
      rest.sort((a, b) => (Math.abs(a[0] - M[0]) + Math.abs(a[1] - M[1])) - (Math.abs(b[0] - M[0]) + Math.abs(b[1] - M[1])));
      return { mach: [M], slots: [], staffSpot: M, rest: rest.slice(0, 6) };
    }
    if (!def.ward) {
      const staffSpot: Pt = [M[0] + perps[0][0], M[1] + perps[0][1]];
      return { mach: [M], slots: [M], staffSpot, rest: [] };
    }
    // a ward: beds greedily from the back, keeping every free tile connected to the door and every bed beside one
    const beds = clamp(Math.floor((w * h) / 4), 1, 4);
    const tiles: Pt[] = [];
    for (let py = y; py < y + h; py++) for (let px = x; px < x + w; px++) if (!(px === D[0] && py === D[1])) tiles.push([px, py]);
    tiles.sort((a, b) => (Math.abs(b[0] - D[0]) + Math.abs(b[1] - D[1])) - (Math.abs(a[0] - D[0]) + Math.abs(a[1] - D[1])) || a[1] - b[1] || a[0] - b[0]);
    const taken = new Set<string>();
    const ok = () => {
      // flood from the door over free tiles
      const seen = new Set<string>([D.join()]); const q: Pt[] = [D];
      while (q.length) { const [cx, cy] = q.pop()!; for (const [dx, dy] of DIRS) { const nx = cx + dx, ny = cy + dy, k = `${nx},${ny}`; if (inside(nx, ny) && !taken.has(k) && !seen.has(k)) { seen.add(k); q.push([nx, ny]); } } }
      const free = w * h - taken.size;
      if (seen.size !== free) return false;
      for (const k of taken) { const [bx, by] = k.split(',').map(Number); if (!DIRS.some(([dx, dy]) => seen.has(`${bx + dx},${by + dy}`))) return false; }
      return true;
    };
    const slots: Pt[] = [];
    for (const t of tiles) {
      if (slots.length >= beds) break;
      // keep beds from touching each other side by side in a clump: they need a free tile next to them
      taken.add(t.join());
      if (!ok()) { taken.delete(t.join()); continue; }
      slots.push(t);
    }
    if (!slots.length) slots.push(M);
    // the nurse stands on the free tile next to the most beds
    let best: Pt = D, bn = -1;
    for (let py = y; py < y + h; py++) for (let px = x; px < x + w; px++) {
      if (taken.has(`${px},${py}`) || (px === D[0] && py === D[1])) continue;
      const n = slots.filter(([sx, sy]) => Math.abs(sx - px) + Math.abs(sy - py) <= 1).length * 10 - (Math.abs(px - D[0]) + Math.abs(py - D[1])) * 0.1;
      if (n > bn) { bn = n; best = [px, py]; }
    }
    return { mach: slots.map((p) => [p[0], p[1]] as Pt), slots, staffSpot: best, rest: [] };
  }

  /** can this room go here? The reason is written for the player. */
  canBuild(kind: RoomKind, x: number, y: number, w: number, h: number, rot = 0, door?: Door | null, ignoreCoins = false): { ok: true; door: Door; cost: number } | { ok: false; reason: string } {
    const def = ROOMS[kind];
    if (!def) return { ok: false, reason: 'Unknown room.' };
    if (!this.def.rooms.includes(kind)) {
      const at = CLINICS.find((c) => c.rooms.includes(kind));
      return { ok: false, reason: `${def.name}s open up at ${at ? at.name : 'a later clinic'}.` };
    }
    const lo = Math.min(def.minW, def.minH), hi = Math.max(def.minW, def.minH);
    if (Math.min(w, h) < lo || Math.max(w, h) < hi) return { ok: false, reason: `Too small: a ${def.name} needs at least ${def.minW}×${def.minH} tiles.` };
    if (w > 8 || h > 8) return { ok: false, reason: 'Too big: rooms are at most 8 tiles on a side.' };
    if (x < 0 || y < 0 || x + w > this.W || y + h > this.H) return { ok: false, reason: 'That pokes outside the clinic walls.' };
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
      const rid = this.roomAt[yy * this.W + xx];
      if (rid) return { ok: false, reason: `That overlaps the ${ROOMS[this.roomById(rid)!.kind].name}.` };
      const did = this.decoAt[yy * this.W + xx];
      if (did) { const d = this.s.decos.find((q) => q.id === did)!; return { ok: false, reason: `A ${DECOS[d.kind].name} is in the way. Sell it or pick another spot.` }; }
    }
    const [ex, ey] = this.entry;
    if (ex >= x && ex < x + w && ey >= y && ey < y + h) return { ok: false, reason: 'Keep the front door clear: patients come in there.' };
    // the inside of the front door needs one free step in front of it
    if (ex >= x && ex < x + w && ey - 1 >= y && ey - 1 < y + h) return { ok: false, reason: 'Leave a little space inside the front door.' };
    const cost = roomCost(kind, w, h);
    if (!ignoreCoins && this.s.coins < cost) return { ok: false, reason: `Not enough coins: a ${def.name} this size costs ${cost}.` };
    // try it: the new room's tiles stop being corridor
    const ra = this.roomAt.slice();
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) ra[yy * this.W + xx] = -1;
    const g2 = this.trialGrid(ra);
    const dist = bfs(g2, ex, ey);
    let d = door ?? null;
    if (d) {
      const onEdge = (d.side === 'N' && d.y === y) || (d.side === 'S' && d.y === y + h - 1) || (d.side === 'W' && d.x === x) || (d.side === 'E' && d.x === x + w - 1);
      const [dx, dy] = SIDE_D[d.side], ox = d.x + dx, oy = d.y + dy;
      if (!onEdge || d.x < x || d.x >= x + w || d.y < y || d.y >= y + h) return { ok: false, reason: 'Doors go on the room’s outside edge.' };
      if (ox < 0 || oy < 0 || ox >= this.W || oy >= this.H || ra[oy * this.W + ox] || dist[oy * this.W + ox] < 0) return { ok: false, reason: 'That door would open onto a wall or another room: it needs a corridor outside.' };
    } else d = this.autoDoor(x, y, w, h, rot, { roomAt: ra, dist });
    if (!d) return { ok: false, reason: 'No corridor touches it, so it can’t have a door.' };
    // every other room's door and every decoration must still be reachable from the front door
    for (const r of this.s.rooms) {
      const [dx, dy] = SIDE_D[r.door.side], ox = r.door.x + dx, oy = r.door.y + dy;
      if (ra[oy * this.W + ox] === -1) return { ok: false, reason: `That would wall up the ${ROOMS[r.kind].name}’s door.` };
      if (dist[oy * this.W + ox] < 0) return { ok: false, reason: `That would cut off the ${ROOMS[r.kind].name}: nobody could reach its door.` };
    }
    for (const dc of this.s.decos) {
      if (!DECOS[dc.kind].blocks && dist[dc.y * this.W + dc.x] >= 0) continue;
      if (!DIRS.some(([dx, dy]) => { const nx = dc.x + dx, ny = dc.y + dy; return nx >= 0 && ny >= 0 && nx < this.W && ny < this.H && dist[ny * this.W + nx] >= 0; })) return { ok: false, reason: `That would cut off the ${DECOS[dc.kind].name}.` };
    }
    return { ok: true, door: d, cost };
  }
  private trialGrid(ra: Int32Array, extraBlock = -1): Grid {
    const g = newGrid(this.grid.w, this.grid.h);
    g.walk.set(this.grid.walk); g.wallS.set(this.grid.wallS); g.wallE.set(this.grid.wallE);
    // tiles of the trial room become unwalkable from outside (we only care about the corridor network)
    for (let i = 0; i < ra.length; i++) if (ra[i] === -1) g.walk[i] = 0;
    if (extraBlock >= 0) g.walk[extraBlock] = 0;
    return g;
  }

  build(kind: RoomKind, x: number, y: number, w: number, h: number, rot = 0, door?: Door | null): Result {
    const c = this.canBuild(kind, x, y, w, h, rot, door);
    if (!c.ok) return c;
    const lay = this.layoutRoom(kind, x, y, w, h, c.door);
    const r: Room = {
      id: this.id(), kind, x, y, w, h, rot: rot % 4, door: c.door, cost: c.cost, mach: lay.mach,
      slots: lay.slots.map(([sx, sy]) => ({ x: sx, y: sy, patient: 0, progress: 0, wear: 0, broken: false, fixer: 0 })),
      staffSpot: lay.staffSpot, rest: lay.rest, staff: 0, uses: 0, level: 1, train: false,
    };
    this.s.rooms.push(r);
    this.s.coins -= c.cost; this.s.spent += c.cost;
    this.relayout();
    this.events.push({ t: 'build', x: x + w / 2, y: y + h / 2, id: r.id });
    return { ok: true, id: r.id };
  }
  /** move a room's door to another edge (a tap on the edge) */
  setDoor(roomId: number, door: Door): Result {
    const r = this.roomById(roomId); if (!r) return { ok: false, reason: 'No such room.' };
    if (r.slots.some((s) => s.patient)) return { ok: false, reason: 'Someone is being treated in there: try again in a moment.' };
    const keep = this.s.rooms; this.s.rooms = keep.filter((q) => q !== r); this.rebuild();
    const c = this.canBuild(r.kind, r.x, r.y, r.w, r.h, r.rot, door, true);
    this.s.rooms = keep;
    if (!c.ok) { this.rebuild(); return c; }
    const lay = this.layoutRoom(r.kind, r.x, r.y, r.w, r.h, c.door);
    r.door = c.door; r.mach = lay.mach; r.staffSpot = lay.staffSpot; r.rest = lay.rest;
    r.slots = lay.slots.map(([sx, sy], i) => ({ ...(r.slots[i] ?? { patient: 0, progress: 0, wear: 0, broken: false, fixer: 0 }), x: sx, y: sy, patient: 0, progress: 0 }));
    this.relayout();
    return { ok: true, id: r.id };
  }
  sell(roomId: number): Result {
    const r = this.roomById(roomId); if (!r) return { ok: false, reason: 'No such room.' };
    if (this.s.tut < TUT_STEPS && this.s.rooms.length <= 3 && ['reception', 'checkup', 'fluff'].includes(r.kind)) return { ok: false, reason: 'Enzo needs this room for the lesson: finish the tutorial first.' };
    const back = Math.round(r.cost / 2);
    // anyone inside goes back to waiting
    for (const p of this.s.patients) if (p.room === r.id) { p.room = 0; p.slot = -1; this.requeue(p, true); }
    for (const st of this.s.staff) {
      if (st.home === r.id) st.home = 0;
      if (st.room === r.id) { st.room = 0; this.setIdle(st); }
      if (st.task && st.task.type === 'fix' && st.task.ref === r.id) { st.task = null; this.setIdle(st); }
      if ((st.state === 'rest' || st.state === 'to_rest') && r.kind === 'staff') this.setIdle(st);
    }
    this.s.rooms = this.s.rooms.filter((q) => q !== r);
    this.s.coins += back; this.s.earned += 0;
    this.relayout();
    this.events.push({ t: 'sell', x: r.x + r.w / 2, y: r.y + r.h / 2, coins: back });
    return { ok: true, id: r.id };
  }

  canPlace(kind: DecoKind, x: number, y: number, ignoreCoins = false): Result {
    const def = DECOS[kind];
    if (!def) return { ok: false, reason: 'Unknown decoration.' };
    if (!this.def.decos.includes(kind)) {
      const at = CLINICS.find((c) => c.decos.includes(kind));
      return { ok: false, reason: `${def.name}s arrive at ${at ? at.name : 'a later clinic'}.` };
    }
    if (x < 0 || y < 0 || x >= this.W || y >= this.H) return { ok: false, reason: 'Decorations go inside the clinic.' };
    const i = y * this.W + x;
    if (this.roomAt[i]) return { ok: false, reason: 'Decorations go in the corridors, not inside rooms.' };
    if (this.decoAt[i]) return { ok: false, reason: 'Something is already there.' };
    const [ex, ey] = this.entry;
    if (Math.abs(x - ex) + Math.abs(y - ey) <= 1 && (x === ex || y === ey)) return { ok: false, reason: 'Keep the front door clear.' };
    for (const r of this.s.rooms) { const [dx, dy] = SIDE_D[r.door.side]; if (r.door.x + dx === x && r.door.y + dy === y) return { ok: false, reason: `That would block the ${ROOMS[r.kind].name}’s door.` }; }
    if (!ignoreCoins && this.s.coins < def.cost) return { ok: false, reason: `Not enough coins: a ${def.name} costs ${def.cost}.` };
    if (def.blocks) {
      const g2 = this.trialGrid(new Int32Array(0), i);
      const dist = bfs(g2, ex, ey);
      for (const r of this.s.rooms) { const [dx, dy] = SIDE_D[r.door.side], o = (r.door.y + dy) * this.W + r.door.x + dx; if (dist[o] < 0) return { ok: false, reason: `That would block the way to the ${ROOMS[r.kind].name}.` }; }
      for (let yy = 0; yy < this.H; yy++) for (let xx = 0; xx < this.W; xx++) {
        const j = yy * this.W + xx;
        if (j === i || this.roomAt[j] || !this.grid.walk[j] || this.entryDist[j] < 0) continue;
        if (dist[j] < 0) return { ok: false, reason: 'That would shut off part of the corridor.' };
      }
      for (const dc of this.s.decos) if (DECOS[dc.kind].blocks && !DIRS.some(([dx, dy]) => { const nx = dc.x + dx, ny = dc.y + dy; return nx >= 0 && ny >= 0 && nx < this.W && ny < this.H && dist[ny * this.W + nx] >= 0; })) return { ok: false, reason: `That would box in the ${DECOS[dc.kind].name}.` };
    }
    return { ok: true };
  }
  place(kind: DecoKind, x: number, y: number, rot?: number): Result {
    const c = this.canPlace(kind, x, y); if (!c.ok) return c;
    const def = DECOS[kind];
    const face = def.facings === 1 ? def.front : rot === undefined ? this.facingFor(kind, x, y) : ((rot % 4) + 4) % 4;
    const d: Deco = { id: this.id(), kind, x, y, water: 100, seats: def.seats ? new Array(def.seats).fill(0) : [], fixer: 0, cost: def.cost, rot: face };
    this.s.decos.push(d);
    this.s.coins -= def.cost; this.s.spent += def.cost;
    this.relayout();
    this.events.push({ t: 'build', x, y });
    return { ok: true, id: d.id };
  }
  /** a sensible facing for a new decoration: its back to a wall, its front to open corridor, and towards a door
   *  (a room's or the front door) when one is in view; ties go to the painted front views */
  facingFor(kind: DecoKind, x: number, y: number): number {
    const def = DECOS[kind];
    if (def.facings === 1) return def.front;
    const W = this.W, H = this.H;
    const inside = (nx: number, ny: number) => nx >= 0 && ny >= 0 && nx < W && ny < H;
    const open = (nx: number, ny: number) => inside(nx, ny) && !this.roomAt[ny * W + nx] && this.grid.walk[ny * W + nx] === 1 && !this.decoAt[ny * W + nx];
    const doors: Pt[] = this.s.rooms.map((r) => { const [dx, dy] = SIDE_D[r.door.side]; return [r.door.x + dx, r.door.y + dy] as Pt; });
    doors.push(this.entry);
    let best = def.front, bestScore = -1e9;
    for (let f = 0; f < 4; f++) {
      const [dx, dy] = DIR_D[f];
      if (!open(x + dx, y + dy)) continue;
      let score = 0;
      if (!open(x - dx, y - dy)) score += 4; // back to a wall (or a room, or the edge)
      // how much open floor it looks out on
      let run = 0; for (let k = 1; k <= 4 && open(x + dx * k, y + dy * k); k++) run++;
      score += run * 0.5;
      // a door ahead, within a few steps and roughly in front
      for (const [qx, qy] of doors) { const ax = (qx - x) * dx + (qy - y) * dy, side = Math.abs((qx - x) * dy - (qy - y) * dx); if (ax >= 1 && ax <= 6 && side <= 2) { score += 2; break; } }
      if (f === 1 || f === 0) score += 0.3; // the painted fronts read best
      if (score > bestScore) { bestScore = score; best = f; }
    }
    return best;
  }
  /** turn a placed decoration to its next facing (free); round things look the same from every side */
  rotateDeco(id: number, by = 1): Result {
    const d = this.s.decos.find((q) => q.id === id); if (!d) return { ok: false, reason: 'Nothing there.' };
    if (DECOS[d.kind].facings === 1) return { ok: false, reason: `A ${DECOS[d.kind].name} looks the same from every side.` };
    d.rot = (((d.rot + by) % 4) + 4) % 4;
    // anyone on the bench turns with it
    for (const p of this.s.patients) if (p.seat === d.id) p.fd = d.rot;
    this.events.push({ t: 'rotate', x: d.x, y: d.y });
    return { ok: true, id };
  }
  sellDeco(id: number): Result {
    const d = this.s.decos.find((q) => q.id === id); if (!d) return { ok: false, reason: 'Nothing there.' };
    for (const p of this.s.patients) if (p.seat === d.id) { p.seat = 0; if (p.phase === 'wait') this.findSpot(p); }
    for (const st of this.s.staff) if (st.task && st.task.type === 'water' && st.task.ref === d.id) { st.task = null; this.setIdle(st); }
    this.s.decos = this.s.decos.filter((q) => q !== d);
    const back = Math.round(d.cost / 2); this.s.coins += back;
    this.relayout();
    this.events.push({ t: 'sell', x: d.x, y: d.y, coins: back });
    return { ok: true, id };
  }

  /** the assist's "try here": a good spot for a room of this kind, lining the walls and keeping the corridor whole */
  suggest(kind: RoomKind, opts: { w?: number; h?: number; rank?: number } = {}): { x: number; y: number; w: number; h: number; rot: number; door: Door } | null {
    const def = ROOMS[kind];
    const sizes: [number, number][] = opts.w ? [[opts.w, opts.h ?? opts.w], [opts.h ?? opts.w, opts.w]] : [[def.minW, def.minH], [def.minH, def.minW]];
    const found: { x: number; y: number; w: number; h: number; rot: number; door: Door; score: number }[] = [];
    const [ex, ey] = this.entry;
    for (const [w, h] of sizes) for (let y = 0; y + h <= this.H; y++) for (let x = 0; x + w <= this.W; x++) {
      const c = this.canBuild(kind, x, y, w, h, 0, null, true);
      if (!c.ok) continue;
      // the rest of the corridor must stay in one piece, with a corridor at least two wide by the front door
      const ra = this.roomAt.slice();
      for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) ra[yy * this.W + xx] = -1;
      const dist = bfs(this.trialGrid(ra), ex, ey);
      let cut = false;
      for (let i = 0; i < this.W * this.H && !cut; i++) if (!ra[i] && this.grid.walk[i] && dist[i] < 0) cut = true;
      if (cut) continue;
      let touch = 0;
      for (let xx = x; xx < x + w; xx++) { touch += y === 0 || this.roomAt[(y - 1) * this.W + xx] ? 1 : 0; touch += y + h === this.H || (y + h < this.H && this.roomAt[(y + h) * this.W + xx]) ? 1 : 0; }
      for (let yy = y; yy < y + h; yy++) { touch += x === 0 || this.roomAt[yy * this.W + x - 1] ? 1 : 0; touch += x + w === this.W || (x + w < this.W && this.roomAt[yy * this.W + x + w]) ? 1 : 0; }
      // a corridor tile left as a one-tile dead-end pocket between the room and a wall is wasted: count them
      let pockets = 0;
      for (let yy = Math.max(0, y - 1); yy <= Math.min(this.H - 1, y + h); yy++) for (let xx = Math.max(0, x - 1); xx <= Math.min(this.W - 1, x + w); xx++) {
        const i = yy * this.W + xx; if (ra[i]) continue;
        let open = 0; for (const [dx, dy] of DIRS) { const nx = xx + dx, ny = yy + dy; if (nx >= 0 && ny >= 0 && nx < this.W && ny < this.H && !ra[ny * this.W + nx]) open++; }
        if (open <= 1) pockets++;
      }
      const near = kind === 'reception' ? 1.2 : kind === 'checkup' ? 0.5 : kind === 'staff' ? -0.15 : 0.2;
      const dd = Math.abs(x + w / 2 - ex) + Math.abs(y + h / 2 - ey);
      const score = touch * 2 - pockets * 4 - dd * near - (w * h - def.minW * def.minH) * 0.5;
      found.push({ x, y, w, h, rot: 0, door: c.door, score });
    }
    if (!found.length) return null;
    found.sort((a, b) => b.score - a.score || a.y - b.y || a.x - b.x);
    const f = found[Math.min(found.length - 1, opts.rank ?? 0)];
    return { x: f.x, y: f.y, w: f.w, h: f.h, rot: f.rot, door: f.door };
  }
  /** a good free corridor tile for a decoration: near the busiest queue, off the walking lines */
  suggestDeco(kind: DecoKind, rank = 0): Pt | null {
    const spots: { p: Pt; score: number }[] = [];
    const busy = this.s.rooms.filter((r) => r.kind !== 'staff');
    const waiting = this.s.patients.filter((p) => p.phase === 'wait' && p.spot).map((p) => p.spot!);
    const reach = kind === 'heater' ? 4 : 3;
    for (let y = 0; y < this.H; y++) for (let x = 0; x < this.W; x++) {
      if (!this.canPlace(kind, x, y, true).ok) continue;
      let wallN = 0; for (const [dx, dy] of DIRS) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= this.W || ny >= this.H || this.roomAt[ny * this.W + nx]) wallN++; }
      let dmin = 99; for (const r of busy) { const [dx, dy] = SIDE_D[r.door.side]; dmin = Math.min(dmin, Math.abs(r.door.x + dx - x) + Math.abs(r.door.y + dy - y)); }
      const crowd = this.s.decos.filter((d) => Math.abs(d.x - x) + Math.abs(d.y - y) <= 1).length;
      const people = waiting.filter(([wx, wy]) => Math.abs(wx - x) + Math.abs(wy - y) <= reach).length;
      const same = this.s.decos.filter((d) => d.kind === kind && Math.abs(d.x - x) + Math.abs(d.y - y) <= reach + 1).length;
      spots.push({ p: [x, y], score: wallN * 2 - Math.abs(dmin - 2) - crowd * 3 + people * 1.5 - same * 4 });
    }
    if (!spots.length) return null;
    spots.sort((a, b) => b.score - a.score || a.p[1] - b.p[1] || a.p[0] - b.p[0]);
    return spots[Math.min(spots.length - 1, rank)].p;
  }

  // ------------------------------------------------------------------------------------------------ staff
  refreshCandidates() {
    const s = this.s; s.cands = [];
    const roles = ROLE_ORDER.filter((r) => r !== 'nurse' || this.def.rooms.some((k) => ROOMS[k].staff === 'nurse'));
    for (const role of roles) for (let i = 0; i < 3; i++) {
      const roll = rnd(s);
      const skill = i === 0 ? 2 + (rnd(s) < 0.5 ? 0 : 1) : roll < 0.12 ? 1 : roll < 0.45 ? 2 : roll < 0.8 ? 3 : roll < 0.95 ? 4 : 5;
      const trait = pick(s, ['quick', 'careful', 'cheery', 'sleepy'] as Trait[]);
      const look = ROLES[role].looks[Math.floor(rnd(s) * 2)];
      s.cands.push({ id: this.id(), role, name: pick(s, STAFF_NAMES), look, skill, trait, wage: wageOf(role, skill, trait) });
    }
  }
  hire(candId: number): Result {
    const c = this.s.cands.find((q) => q.id === candId); if (!c) return { ok: false, reason: 'That candidate has gone.' };
    if (!this.def.rooms.some((k) => ROOMS[k].staff === c.role) && c.role !== 'cleaner') return { ok: false, reason: `No room here needs a ${ROLES[c.role].name}.` };
    if (this.s.staff.filter((x) => x.state !== 'gone').length >= 24) return { ok: false, reason: 'The clinic is full of staff already.' };
    if (this.s.coins < c.wage) return { ok: false, reason: `Not enough coins: hiring costs a day’s wage up front (${c.wage}).` };
    this.s.coins -= c.wage; this.s.spent += c.wage;
    const [px, py] = this.porch;
    const st: Staff = { id: this.id(), role: c.role, name: c.name, look: c.look, skill: c.skill, trait: c.trait, wage: c.wage, energy: 100, state: 'arrive', room: 0, home: 0, task: null, timer: 0, hired: this.s.t,
      x: px, y: py, px, py, path: [], goal: null, dir: 3, step: 0, held: false, xp: 0, today: 0, jobs: 0, mood: 80 };
    this.s.staff.push(st);
    this.walkTo(st, this.entry[0], this.entry[1] - 1);
    this.s.cands = this.s.cands.filter((q) => q !== c);
    // a new face for the list
    const roll = rnd(this.s), skill = roll < 0.15 ? 1 : roll < 0.5 ? 2 : roll < 0.82 ? 3 : roll < 0.96 ? 4 : 5, trait = pick(this.s, ['quick', 'careful', 'cheery', 'sleepy'] as Trait[]);
    this.s.cands.push({ id: this.id(), role: c.role, name: pick(this.s, STAFF_NAMES), look: ROLES[c.role].looks[Math.floor(rnd(this.s) * 2)], skill, trait, wage: wageOf(c.role, skill, trait) });
    return { ok: true, id: st.id };
  }
  fire(staffId: number): Result {
    const st = this.staffById(staffId); if (!st || st.state === 'gone' || st.state === 'leave') return { ok: false, reason: 'No such staff member.' };
    this.release(st);
    st.state = 'leave'; st.home = 0; st.task = null; st.held = false;
    this.walkTo(st, this.porch[0], this.porch[1]);
    return { ok: true, id: st.id };
  }
  /** drop a staff member into a room: they work there until moved (a room of the wrong kind says why not) */
  assign(staffId: number, roomId: number): Result {
    const st = this.staffById(staffId); if (!st || st.state === 'gone' || st.state === 'leave') return { ok: false, reason: 'No such staff member.' };
    const r = this.roomById(roomId);
    st.held = false;
    if (!r) { this.release(st); st.home = 0; this.setIdle(st); return { ok: true }; }
    if (r.kind === 'staff') { this.release(st); this.goRest(st, r); return { ok: true }; }
    if (st.role === 'cleaner') { this.release(st); st.home = 0; this.setIdle(st); return { ok: false, reason: 'Cleaners roam the whole clinic: they go wherever something needs fixing, watering or sweeping.' }; }
    const need = ROOMS[r.kind].staff;
    if (need !== st.role) return { ok: false, reason: `A ${ROOMS[r.kind].name} needs a ${need ? ROLES[need].name.toLowerCase() : 'nobody'}, and ${st.name} is a ${ROLES[st.role].name.toLowerCase()}.` };
    for (const other of this.s.staff) if (other !== st && other.home === r.id) other.home = 0;
    if (r.staff && r.staff !== st.id) { const other = this.staffById(r.staff); if (other) { other.room = 0; if (other.state === 'go' || other.state === 'work') this.setIdle(other); } }
    this.release(st);
    st.room = r.id; st.home = r.id; r.staff = st.id; st.state = 'go'; st.task = null;
    this.walkTo(st, r.staffSpot[0], r.staffSpot[1]);
    return { ok: true, id: r.id };
  }
  /** pick a staff member up (the scene shows them dangling); assign() or drop() puts them down */
  hold(staffId: number, on: boolean) { const st = this.staffById(staffId); if (st) st.held = on; }
  private release(st: Staff) {
    for (const r of this.s.rooms) if (r.staff === st.id) r.staff = 0;
    if (st.task) { this.unclaim(st.task); st.task = null; }
    st.room = 0;
  }
  private setIdle(st: Staff) { st.state = st.state === 'leave' || st.state === 'gone' ? st.state : 'idle'; st.path = []; st.goal = null; st.timer = 0; }
  private goRest(st: Staff, r: Room) {
    const used = new Set(this.s.staff.filter((x) => x !== st && (x.state === 'rest' || x.state === 'to_rest') && x.goal).map((x) => x.goal!.join()));
    const spot = r.rest.find((p) => !used.has(p.join())) ?? r.rest[0] ?? r.staffSpot;
    st.state = 'to_rest'; st.task = null;
    this.walkTo(st, spot[0], spot[1]);
  }

  // ------------------------------------------------------------------------------------------------ events
  respond(offerId: number, accept: boolean): Result {
    const o = this.s.offer; if (!o || o.id !== offerId) return { ok: false, reason: 'That request has passed.' };
    this.s.offer = null;
    if (!accept) { this.note(`You said not today, so the ${o.count} ${SPECIES[o.sp].plural} went to the village doctor instead. They will be looked after there.`); return { ok: true }; }
    this.s.emergencies.push({ id: o.id, ail: o.ail, sp: o.sp, count: o.count, spawned: 0, cured: 0, bonus: o.bonus, deadline: this.s.t + o.hours * HOUR, done: false });
    this.note(`${o.count} ${SPECIES[o.sp].plural} with ${AILMENTS[o.ail].name} are on their way!`);
    return { ok: true, id: o.id };
  }
  // ---- staff growth: experience from every job, a star when there is enough, and a raise to ask for afterwards
  private grow(st: Staff | undefined) {
    if (!st) return;
    st.today++; st.jobs++;
    if (st.skill >= 5) return;
    st.xp += st.role === 'recep' ? 0.5 : 1;
    this.levelCheck(st);
  }
  private levelCheck(st: Staff) {
    if (st.skill >= 5 || st.xp < XP_FOR(st.skill)) return;
    st.xp -= XP_FOR(st.skill); st.skill++;
    this.s.today.levelups.push(st.name);
    this.events.push({ t: 'levelup', id: st.id, skill: st.skill, x: st.x, y: st.y });
    this.note(`${st.name} has learned a lot: now ${st.skill} stars!`);
  }
  /** who teaches in the Staff Room: the best vet with three stars or more */
  teacher(): Staff | undefined {
    let t: Staff | undefined;
    for (const st of this.s.staff) if (st.role === 'vet' && st.skill >= 3 && st.state !== 'leave' && st.state !== 'gone' && (!t || st.skill > t.skill)) t = st;
    return t;
  }
  /** answer a raise request: yes pays them what their stars are worth; no is fine, but they feel it a little */
  answerRaise(id: number, yes: boolean): Result {
    const s = this.s, r = s.raise;
    if (!r || r.id !== id) return { ok: false, reason: 'That request has passed.' };
    s.raise = null;
    const st = this.staffById(r.staff);
    if (!st) return { ok: false, reason: 'They have left already.' };
    if (yes) { st.wage += r.amount; st.mood = Math.min(100, st.mood + 20); this.note(`${st.name} is delighted with the raise: ${st.wage} coins a day now.`); }
    else { st.mood = Math.max(0, st.mood - 15); this.note(st.mood < 35 ? `${st.name} is a bit glum about the raise and will work a little slower for now. They will not leave.` : `${st.name} understands. Maybe next time.`); }
    return { ok: true };
  }
  /** machine upgrades for cure rooms: level 2 and 3 cure faster and wear out more slowly */
  upgradeCost(r: Room): number { return r.level >= 3 || !canUpgrade(r.kind) ? 0 : Math.round(ROOMS[r.kind].cost * (r.level === 1 ? 0.5 : 0.9) / 10) * 10; }
  upgrade(roomId: number): Result {
    const s = this.s, r = this.roomById(roomId);
    if (!r) return { ok: false, reason: 'No such room.' };
    if (!canUpgrade(r.kind)) return { ok: false, reason: 'Only cure rooms have machines to upgrade.' };
    if (r.level >= 3) return { ok: false, reason: 'This machine is as shiny as it gets.' };
    const cost = this.upgradeCost(r);
    if (s.coins < cost) return { ok: false, reason: `Not enough coins: the upgrade costs ${cost}.` };
    s.coins -= cost; s.spent += cost; r.cost += cost; r.level++;
    for (const q of r.slots) q.wear = Math.max(0, q.wear - 30);
    const [mx, my] = r.mach[0] ?? [r.x, r.y];
    this.events.push({ t: 'upgrade', id: r.id, level: r.level, x: mx, y: my });
    this.note(`The ${ROOMS[r.kind].name} is now level ${r.level}: quicker cures and less wear.`);
    return { ok: true, id: r.id };
  }
  /** switch training on or off in a Staff Room */
  setTraining(roomId: number, on: boolean): Result {
    const r = this.roomById(roomId);
    if (!r || r.kind !== 'staff') return { ok: false, reason: 'Training happens in a Staff Room.' };
    if (on && !this.teacher()) return { ok: false, reason: 'Training needs a vet with three stars or more to teach.' };
    r.train = on;
    return { ok: true };
  }

  // ---- why patients feel the way they do
  whyOf(p: Patient): Why[] {
    const s = this.s, out: Why[] = [];
    if (p.phase !== 'wait' && p.phase !== 'arrive' && p.phase !== 'drink') return out;
    const x = Math.round(p.x), y = Math.round(p.y), i = y * this.W + x;
    if (p.thirst > 60) out.push({ id: 'thirst', good: false, text: 'Thirsty' });
    if (s.t - p.arrivedAt > HOUR * 2.5 || p.patience < 40) out.push({ id: 'wait', good: false, text: 'Waited a long time' });
    if (s.litter.some((l) => Math.abs(l.x - x) + Math.abs(l.y - y) <= 1)) out.push({ id: 'litter', good: false, text: 'Litter on the floor' });
    if (this.def.twist === 'cold' && !s.decos.some((d) => d.kind === 'heater' && Math.abs(d.x - x) + Math.abs(d.y - y) <= 4)) out.push({ id: 'cold', good: false, text: 'Feeling cold' });
    if (!this.hasRoom(p.need)) out.push({ id: 'noroom', good: false, text: `No ${ROOMS[p.need].name} yet` });
    if (!p.seat && p.phase === 'wait' && p.patience < 70) out.push({ id: 'stand', good: false, text: 'Tired of standing' });
    if (s.decos.some((d) => d.kind === 'plant' && d.water > 25 && Math.abs(d.x - x) + Math.abs(d.y - y) <= 3)) out.push({ id: 'plants', good: true, text: 'Loves the plants' });
    else if ((this.comfort[i] ?? 1) < 0.95) out.push({ id: 'decor', good: true, text: 'Likes the cosy decor' });
    if (p.seat) out.push({ id: 'bench', good: true, text: 'Comfy on a bench' });
    if (this.cheer(p.x, p.y) < 1) out.push({ id: 'cheer', good: true, text: 'Cheered up by company' });
    return out;
  }
  /** the three most common complaints right now, with where to look */
  complaints(): { id: WhyId; text: string; count: number; at: Pt }[] {
    const m = new Map<WhyId, { id: WhyId; text: string; count: number; at: Pt }>();
    for (const p of this.s.patients) for (const w of this.whyOf(p)) {
      if (w.good) continue;
      const text = w.id === 'noroom' ? 'A room they need is missing' : w.text;
      const e = m.get(w.id);
      if (e) e.count++; else m.set(w.id, { id: w.id, text, count: 1, at: [Math.round(p.x), Math.round(p.y)] });
    }
    return [...m.values()].sort((a, b) => b.count - a.count).slice(0, 3);
  }

  // ---- the Burrow Bulletin
  makeBulletin(): Bulletin {
    const s = this.s, t = s.today;
    const cures = s.cures - t.cures, earned = s.earned - t.earned, spent = s.spent - t.spent, rep = Math.round(s.rep - t.rep), unhappy = s.leftUnhappy - t.unhappy;
    let headline = `Another Cosy Day at ${this.def.name}`, sub = 'Patients came, patients were cured, and nobody lost a whisker.';
    if (t.emergOk) { headline = `${t.emergOk.count} ${cap(SPECIES[t.emergOk.sp].plural)} Saved in the Nick of Time!`; sub = 'The whole team rushed, and every one went home well.'; }
    else if (t.vip) { headline = 'A Condor Leaves the Biggest Tip in Town'; sub = `${t.vip} swooped in, was cured, and left a heap of coins.`; }
    else if (t.inspector === 'good') { headline = 'Inspector Hoots With Delight'; sub = 'A spotless report, and a reward to go with it.'; }
    else if (t.levelups.length) { headline = `${t.levelups[0]} Earns a New Star`; sub = 'Practice makes purr-fect. Faster cures ahead!'; }
    else if (t.inspector === 'bad') { headline = 'Inspector Ruffles a Few Feathers'; sub = 'A tidier clinic will do better next time.'; }
    else if (t.broken) { headline = `${ROOMS[t.broken].name} Takes an Unplanned Nap`; sub = 'A cleaner with a spanner soon had it humming again.'; }
    else if (t.rain) { headline = 'Rainy Morning, Busy Afternoon'; sub = 'Everyone who stayed dry came at once when the sun came out.'; }
    else if (unhappy >= 4) { headline = 'Long Lines Leave a Few Grumbles'; sub = 'Some patients gave up waiting. More rooms or staff would help.'; }
    else if (cures >= 15) { headline = `${cures} Patients Feel Fine Again`; sub = 'A record day of cures and cheerful send-offs.'; }
    let star: Bulletin['star'] = null;
    for (const st of s.staff) if (st.state !== 'gone' && st.today > 0 && (!star || st.today > star.jobs)) star = { name: st.name, look: st.look, role: st.role, jobs: st.today };
    const quote = t.quote ? { name: t.quote.name, sp: t.quote.sp, text: QUOTES[t.quote.ail] } : t.grump ? { name: t.grump.name, sp: t.grump.sp, text: 'The line was ever so long. I might try again tomorrow.' } : null;
    const adv = this.advice()[0];
    const tip = adv ? adv.text : unhappy > 0 ? 'Benches and plants near the busiest door keep lines calm.' : t.levelups.length ? 'Staff with new stars may ask for a raise. Saying yes keeps them cheerful.' : this.teacher() && !s.rooms.some((r) => r.train) ? 'A three-star vet can teach in the Staff Room: switch training on there.' : 'Upgrade a busy cure room for quicker cures and less wear.';
    return { day: s.day, headline, sub, cures, earned, spent, rep, star, quote, tip };
  }
  dismissBulletin() { this.s.bulletin = null; }

  /** start an event now (the schedule, the random roll and the debug hook all come here) */
  trigger(kind: EventKind, ail: AilmentId | null = null): boolean {
    const s = this.s;
    if (kind === 'emergency') {
      if (s.offer || s.emergencies.some((e) => !e.done)) return false;
      const ready = this.unlockedAilments().filter((a) => this.hasRoom(AILMENTS[a].room));
      const a = ail && ready.includes(ail) ? ail : ready.length ? pick(s, ready) : null;
      if (!a) return false;
      const count = Math.min(8, 3 + this.def.index + (this.roomsOf(AILMENTS[a].room).length > 1 ? 2 : 0));
      const sp = a === 'sneezes' ? 'flamingo' : pick(s, PATIENT_SPECIES);
      const hours = Math.min(7, 2 + Math.ceil(count * 0.6));
      s.offer = { id: this.id(), kind: 'emergency', ail: a, sp, count, bonus: Math.round(count * AILMENTS[a].fee * 0.8 / 10) * 10, hours, expires: s.t + HOUR * 2 };
      this.events.push({ t: 'offer', id: s.offer.id });
      return true;
    }
    if (kind === 'inspector') {
      if (s.walkers.some((w) => w.who === 'inspector')) return false;
      const [px, py] = this.porch;
      const stops = s.rooms.filter((r) => r.kind !== 'staff').map((r) => r.id);
      // visits up to four rooms, in a fixed order from the seed
      for (let i = stops.length - 1; i > 0; i--) { const j = Math.floor(rnd(s) * (i + 1)); [stops[i], stops[j]] = [stops[j], stops[i]]; }
      s.walkers.push({ id: this.id(), who: 'inspector', x: px, y: py, px, py, path: [], goal: null, dir: 3, step: 0, timer: 0, stops: stops.slice(0, 4), seen: 0 });
      this.note('A health inspector has arrived! Keep the floors clean and the patients smiling.');
      return true;
    }
    if (kind === 'vip') {
      const ready = this.unlockedAilments().filter((a) => this.hasRoom(AILMENTS[a].room));
      if (!ready.length) return false;
      const p = this.spawnPatient(pick(s, ready), 'condor');
      p.vip = true;
      this.events.push({ t: 'vip', id: p.id });
      this.note(`A very important condor, ${p.name}, has come for a check-up. A happy cure means a big tip!`);
      return true;
    }
    if (kind === 'breakdown') {
      const slots = s.rooms.flatMap((r) => r.slots.filter((q) => !q.broken && ROOMS[r.kind].staff && r.kind !== 'reception').map((q) => ({ r, q })));
      if (!slots.length) return false;
      const { r, q } = pick(s, slots);
      q.wear = 100; q.broken = true;
      this.events.push({ t: 'broken', x: q.x, y: q.y, room: r.id });
      this.note(`The ${ROOMS[r.kind].name} sputtered and stopped. A cleaner can fix it.`);
      return true;
    }
    return false;
  }

  // ------------------------------------------------------------------------------------------------ patients
  spawnPatient(ail: AilmentId, sp?: SpeciesId): Patient {
    const s = this.s, [px, py] = this.porch;
    const species = sp ?? pick(s, PATIENT_SPECIES);
    const p: Patient = {
      id: this.id(), sp: species, name: pick(s, PATIENT_NAMES), ail, dx: null, sure: false, wrongs: [], need: 'reception', phase: 'arrive', room: 0, slot: -1, spot: null, seat: 0, drinkAt: 0,
      patience: 100, thirst: rnd(s) * 30, timer: 0, vip: false, emerg: 0, happy: true, arrivedAt: s.t, cured: false, fail: 0, qr: 0, qi: -1, fd: 1, gift: 0,
      x: px, y: py, px, py, path: [], goal: null, dir: 3, step: 0,
    };
    s.patients.push(p);
    this.requeue(p, false);
    this.events.push({ t: 'arrive', id: p.id });
    return p;
  }
  /** put a patient (back) in line for whatever they need next, and find them somewhere to wait */
  requeue(p: Patient, front: boolean) {
    this.leaveSeat(p);
    p.phase = 'wait'; p.room = 0; p.slot = -1; p.timer = front ? -1 : 0; p.spot = null;
    this.findSpot(p);
  }
  /** find this patient a place in the line for the room they need (everyone in every line is re-placed) */
  findSpot(_p: Patient) { this.assignQueues(); }

  // ---- waiting lines: each room has a tidy line of corridor tiles running away from its door, one tile apart and
  // hugging the walls, with bench seats near the door filled first. Lines never share a tile, so nobody stands on
  // anybody. Recomputed whenever someone joins or leaves a line; the tile chains themselves only change with the layout.
  private qdirty = true;
  private lines = new Map<number, { line: Pt[]; face: number[]; dist: Int16Array }>();
  private linesVer = -1;
  /** the door-front tile of a room, or a spot just inside the front door for patients whose room isn't built yet */
  private anchorOf(key: number): Pt {
    const r = key ? this.roomById(key) : undefined;
    if (r) { const [dx, dy] = SIDE_D[r.door.side]; return [r.door.x + dx, r.door.y + dy]; }
    return [this.entry[0], this.entry[1] - 1];
  }
  /** no-one may queue on these: in front of any door, and the front door's own path */
  private keepClear(): Set<number> {
    const c = new Set<number>();
    for (const r of this.s.rooms) { const [dx, dy] = SIDE_D[r.door.side]; c.add((r.door.y + dy) * this.W + r.door.x + dx); }
    c.add(this.entry[1] * this.W + this.entry[0]); c.add((this.entry[1] - 1) * this.W + this.entry[0]);
    return c;
  }
  lineOf(key: number) {
    if (this.linesVer !== this.s.layout || this.gridVersion !== this.s.layout) { if (this.gridVersion !== this.s.layout) this.rebuild(); this.lines.clear(); this.linesVer = this.s.layout; }
    let L = this.lines.get(key);
    if (L) return L;
    const W = this.W, Hb = this.def.h, [ax, ay] = this.anchorOf(key);
    const dist = bfs(this.grid, ax, ay), clear = this.keepClear();
    const ok = (x: number, y: number) => {
      if (x < 0 || y < 0 || x >= W || y >= Hb) return false;
      const i = y * W + x;
      return !this.roomAt[i] && !!this.grid.walk[i] && !this.decoAt[i] && !clear.has(i) && dist[i] > 0 && this.entryDist[i] >= 0;
    };
    const walls = (x: number, y: number) => {
      let n = 0;
      for (const [dx, dy] of DIRS) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= Hb || this.roomAt[ny * W + nx] || !canStep(this.grid, x, y, dx, dy)) n++; }
      return n;
    };
    const line: Pt[] = [], face: number[] = [], used = new Set<number>();
    const faceTo = (fx: number, fy: number, tx: number, ty: number) => { const dx = tx - fx, dy = ty - fy; return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 0 : 2) : (dy > 0 ? 1 : 3); };
    let cur: Pt | null = null, pdx = 0, pdy = 0;
    while (line.length < 48) {
      let next: Pt | null = null, best = 1e9;
      if (cur) {
        const [cx, cy]: Pt = cur, ci = cy * W + cx;
        for (const [dx, dy] of DIRS) {
          const nx: number = cx + dx, ny: number = cy + dy, ni = ny * W + nx;
          if (!ok(nx, ny) || used.has(ni) || !canStep(this.grid, cx, cy, dx, dy)) continue;
          // along a wall, keeping the same heading, and away from the door
          // ...and back towards the front door, where newcomers come from, rather than into a dead end
          const sc = -walls(nx, ny) * 2 - (dx === pdx && dy === pdy ? 1.5 : 0) + (dist[ni] < dist[ci] ? 4 : 0) + dist[ni] * 0.05 + (this.entryDist[ni] - this.entryDist[ci]) * 0.9;
          if (sc < best) { best = sc; next = [nx, ny]; }
        }
      }
      if (!next) {
        // the start of the line, or a fresh row of the snake: the free tile closest to the door, by a wall if possible
        for (let y = 0; y < Hb; y++) for (let x = 0; x < W; x++) {
          const i = y * W + x;
          if (!ok(x, y) || used.has(i)) continue;
          const sc = dist[i] * 1.2 - walls(x, y) * 0.8 + (cur ? (Math.abs(x - cur[0]) + Math.abs(y - cur[1])) * 0.4 : 0) + this.entryDist[i] * 0.15;
          if (sc < best) { best = sc; next = [x, y]; }
        }
        pdx = 0; pdy = 0;
      } else { pdx = next[0] - cur![0]; pdy = next[1] - cur![1]; }
      if (!next) break;
      used.add(next[1] * W + next[0]);
      // face the one ahead in the line, and the first one faces the door
      const ahead: Pt = line.length && cur && Math.abs(cur[0] - next[0]) + Math.abs(cur[1] - next[1]) === 1 ? cur : [ax, ay];
      face.push(faceTo(next[0], next[1], ahead[0], ahead[1]));
      line.push(next); cur = next;
    }
    L = { line, face, dist };
    this.lines.set(key, L);
    return L;
  }
  /** place everyone who is waiting in the line for the room they need */
  assignQueues() {
    const s = this.s, W = this.W;
    this.qdirty = false;
    const groups = new Map<number, Patient[]>();
    for (const p of s.patients) {
      if (p.phase !== 'wait' && p.phase !== 'arrive') { p.qi = -1; continue; }
      const r = this.roomsOf(p.need)[0], key = r ? r.id : 0;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(p);
    }
    const before = (a: Patient, b: Patient) => (a.timer === -1) !== (b.timer === -1) ? (a.timer === -1 ? -1 : 1) : a.arrivedAt - b.arrivedAt || a.id - b.id;
    const taken = new Set<number>();
    const keys = [...groups.keys()].sort((a, b) => (a || 1e9) - (b || 1e9));
    for (const key of keys) {
      const ps = groups.get(key)!.sort(before);
      const L = this.lineOf(key);
      let li = 0;
      ps.forEach((p, i) => {
        p.qr = key; p.qi = i;
        let t: Pt | null = null;
        if (p.seat && this.seatOf(p)) { const d = this.seatOf(p)!; t = p.spot ?? [d.x, d.y]; p.fd = d.rot; }
        else {
          p.seat = 0;
          // a free bench seat near this door
          let bench: Deco | null = null, bd = 1e9, bi = -1;
          for (const d of s.decos) {
            if (d.kind !== 'bench') continue;
            const dd = L.dist[d.y * W + d.x];
            if (dd < 0 || dd > 8) continue;
            const k = d.seats.indexOf(0);
            if (k >= 0 && dd < bd) { bd = dd; bench = d; bi = k; }
          }
          if (bench) { bench.seats[bi] = p.id; p.seat = bench.id; t = [bench.x, bench.y]; p.fd = bench.rot; }
          else {
            while (li < L.line.length && taken.has(L.line[li][1] * W + L.line[li][0])) li++;
            if (li < L.line.length) { t = L.line[li]; p.fd = L.face[li]; li++; }
            else t = p.spot ?? this.anchorOf(key);
          }
        }
        taken.add(t[1] * W + t[0]);
        const same = p.spot && p.spot[0] === t[0] && p.spot[1] === t[1];
        p.spot = [t[0], t[1]];
        if (!same || (!p.path.length && !this.atGoal(p))) this.walkTo(p, t[0], t[1]);
      });
    }
  }
  private seatOf(p: Patient) { return p.seat ? this.s.decos.find((d) => d.id === p.seat) : undefined; }
  private leaveSeat(p: Patient) { const d = this.seatOf(p); if (d) d.seats = d.seats.map((v) => (v === p.id ? 0 : v)); p.seat = 0; }
  private sendHome(p: Patient, happy: boolean) {
    this.leaveSeat(p);
    p.phase = 'leave'; p.happy = happy; p.room = 0; p.slot = -1; p.qi = -1; p.spot = null; this.qdirty = true;
    this.walkTo(p, this.porch[0], this.porch[1]);
  }
  /** what the patient believes they need after the check-up */
  private diagnose(p: Patient, vet: Staff | undefined) {
    const s = this.s;
    s.stats.diagnosed++;
    const acc = p.sure || !vet ? 1 : accuracy(vet);
    if (rnd(s) < acc) { p.dx = p.ail; }
    else {
      const wrong = this.unlockedAilments().filter((a) => a !== p.ail && !p.wrongs.includes(a) && this.hasRoom(AILMENTS[a].room));
      p.dx = wrong.length ? pick(s, wrong) : p.ail;
      if (p.dx !== p.ail) s.stats.wrong++;
    }
    p.need = AILMENTS[p.dx].room;
  }

  // ------------------------------------------------------------------------------------------------ the sim step
  tick() {
    const s = this.s;
    if (this.gridVersion !== s.layout) this.rebuild();
    if (s.result === 'failed') return;
    this.tutorial();
    if (s.open) {
      s.t++;
      const tod = s.t % DAY;
      if (tod === 0) this.endOfDay();
      this.arrivals();
      this.schedule();
    }
    if (s.open) for (const d of s.decos) if (d.kind === 'plant') { const was = d.water; d.water = Math.max(0, d.water - 0.012 * (this.def.twist === 'plants' ? 3 : 1)); if (was > 25 && d.water <= 25) this.computeComfort(); }
    if (s.t % 10 === 0) this.computeComfort();
    this.dispatch();
    if (this.qdirty) this.assignQueues();
    for (const p of s.patients) this.updatePatient(p);
    for (const st of s.staff) this.updateStaff(st);
    for (const r of s.rooms) this.updateRoom(r);
    for (const w of s.walkers) this.updateWalker(w);
    if (s.t % 20 === 0) { s.patients = s.patients.filter((p) => p.phase !== 'gone'); s.staff = s.staff.filter((x) => x.state !== 'gone'); s.walkers = s.walkers.filter((w) => w.timer >= 0); }
    this.checkGoals();
  }
  run(n: number) { for (let i = 0; i < n; i++) this.tick(); }

  /** open the front door: the clock starts */
  openDoors(): Result {
    if (this.s.open) return { ok: false, reason: 'The clinic is already open.' };
    if (!this.hasRoom('reception')) return { ok: false, reason: 'Build a Reception first: every patient checks in there.' };
    this.s.open = true; this.events.push({ t: 'open' });
    this.note('The doors are open! Patients will start to arrive.');
    return { ok: true };
  }
  private ready() {
    const staffed = (k: RoomKind) => this.hasRoom(k) && this.s.staff.some((x) => x.role === ROOMS[k].staff && x.state !== 'leave' && x.state !== 'gone');
    return staffed('reception') && staffed('checkup') && this.def.rooms.some((k) => k !== 'reception' && k !== 'checkup' && k !== 'staff' && this.hasRoom(k) && staffed(k));
  }
  private tutorial() {
    const s = this.s;
    if (!s.open && s.tut >= TUT_STEPS && s.assist && this.ready()) this.openDoors();
    if (s.tut >= TUT_STEPS) return;
    const has = (k: RoomKind) => this.hasRoom(k);
    const hired = (r: Role) => s.staff.some((x) => x.role === r && x.state !== 'leave' && x.state !== 'gone');
    const done = [has('reception'), hired('recep'), has('checkup'), hired('vet'), has('fluff'), s.cures > 0];
    let step = 0; while (step < TUT_STEPS && done[step]) step++;
    if (step !== s.tut) {
      s.tut = step; this.events.push({ t: 'tut', step });
      if (step >= 5 && !s.open) {
        s.open = true; this.events.push({ t: 'open' });
        // the very first patient walks straight in
        this.spawnPatient('static', 'pudu');
      }
    }
  }
  private endOfDay() {
    const s = this.s;
    const wages = wagesPerDay(s);
    s.coins -= wages; s.spent += wages; s.wagesPaid += wages;
    const training = s.rooms.some((r) => r.kind === 'staff' && r.train) && this.teacher() ? TRAIN_COST : 0;
    if (training) { s.coins -= training; s.spent += training; }
    s.bulletin = this.makeBulletin();
    this.events.push({ t: 'bulletin', day: s.day });
    for (const st of s.staff) { st.today = 0; st.mood = Math.min(100, st.mood + 4); }
    s.today = this.freshToday();
    // somebody who has grown into a better job may ask for a raise in the morning
    if (!s.raise) {
      const due = s.staff.find((st) => st.state !== 'leave' && st.state !== 'gone' && st.wage < wageOf(st.role, st.skill, st.trait));
      if (due) { s.raise = { id: this.id(), staff: due.id, amount: wageOf(due.role, due.skill, due.trait) - due.wage, expires: s.t + DAY + HOUR * 3 }; this.events.push({ t: 'raise', id: due.id }); }
    }
    s.day++;
    this.events.push({ t: 'day', day: s.day, wages });
    this.refreshCandidates();
    // the weather (Lakeside): a rainy spell some mornings, then everyone who stayed home comes at once
    s.rain = null;
    if (this.def.twist === 'rain' && s.day > 1 && rnd(s) < 0.45) {
      const from = s.t + Math.floor(HOUR * (1 + rnd(s) * 2)), to = from + Math.floor(HOUR * (2 + rnd(s) * 2));
      s.rain = { from, to }; s.today.rain = true;
    }
    // a random extra event now and then
    if (s.day > 2 && rnd(s) < this.def.eventChance) s.plans.push({ day: s.day, hour: 2 + Math.floor(rnd(s) * 6), kind: pick(s, ['emergency', 'vip', 'inspector'] as EventKind[]), ail: null, done: false });
    if (s.strict && !s.met && s.day > this.def.days && this.def.twist !== 'sandbox') { s.result = 'failed'; this.events.push({ t: 'failed' }); }
  }
  /** patients an hour right now */
  arrivalRate(): number {
    const s = this.s, d = this.def;
    let r = d.arrive * (0.55 + (s.rep / 100) * 0.9);
    if (s.day === 1) r *= 0.6; else if (s.day === 2) r *= 0.85;
    if (s.rain) { if (s.t >= s.rain.from && s.t < s.rain.to) r *= 0.25; else if (s.t >= s.rain.to && s.t < s.rain.to + HOUR * 2) r *= 2.2; }
    // patients who see a packed waiting room come back another day (keeps a struggling clinic from drowning)
    const waiting = s.patients.filter((p) => p.phase === 'wait' || p.phase === 'arrive').length;
    const cap = 6 + 2 * s.rooms.filter((q) => q.kind !== 'staff' && q.kind !== 'reception').length;
    if (waiting >= cap) r = 0; else if (waiting >= cap * 0.7) r *= 0.5;
    return r;
  }
  private arrivals() {
    const s = this.s, tod = s.t % DAY;
    if (tod >= LAST_ARRIVAL || this.def.twist === 'tutorial' && s.tut < 5) return;
    // emergencies arrive in a little parade
    for (const e of s.emergencies) {
      if (e.done || e.spawned >= e.count) continue;
      if (s.t % 25 === 0 || e.spawned === 0) {
        const p = this.spawnPatient(e.ail, e.sp);
        p.dx = e.ail; p.sure = true; p.need = AILMENTS[e.ail].room; p.emerg = e.id; e.spawned++;
        // they skip the desk and the check-up: it's obvious what's wrong
        this.requeue(p, false);
      }
    }
    if (rnd(s) >= this.arrivalRate() / HOUR) return;
    const ails = this.def.ailments.filter(([, d]) => d <= s.day);
    // a freshly unlocked ailment eases in
    const weights = ails.map(([, d]) => (d === s.day && d > 1 ? 0.5 : 1));
    let roll = rnd(s) * weights.reduce((a, b) => a + b, 0), i = 0;
    while (i < ails.length - 1 && roll >= weights[i]) { roll -= weights[i]; i++; }
    this.spawnPatient(ails[i][0]);
  }
  private schedule() {
    const s = this.s;
    for (const pl of s.plans) {
      if (pl.done || s.day < pl.day) continue;
      if (s.day === pl.day && hourOf(s) < OPEN_HOUR + pl.hour) continue;
      if (this.trigger(pl.kind, pl.ail) || s.day > pl.day + 1) pl.done = true;
    }
    if (s.offer && s.t >= s.offer.expires) { this.note(`Nobody answered in time, so the ${s.offer.count} ${SPECIES[s.offer.sp].plural} went to the village doctor instead. They will be looked after there.`); s.offer = null; }
    if (s.raise && s.t >= s.raise.expires) { const st = this.staffById(s.raise.staff); s.raise = null; if (st) this.note(`${st.name} will ask about that raise another day.`); }
    for (const e of s.emergencies) {
      if (e.done) continue;
      if (e.cured >= e.count) {
        e.done = true; s.coins += e.bonus; s.earned += e.bonus; s.rep = clamp(s.rep + 5, 0, 100); s.today.emergOk = { sp: e.sp, count: e.count };
        this.events.push({ t: 'emergency', ok: true, bonus: e.bonus });
        this.note(`Every ${SPECIES[e.sp].name} cured in time! Bonus: ${e.bonus} coins.`);
      } else if (s.t > e.deadline) {
        e.done = true; s.rep = clamp(s.rep - 1, 0, 100); s.today.emergMiss = true;
        this.events.push({ t: 'emergency', ok: false, bonus: 0 });
        this.note('Not quite in time for the emergency bonus. The rest will still be looked after.');
      }
    }
  }

  /** match waiting patients to free slots (the whole queue for each room kind, longest-waiting first) */
  private dispatch() {
    const s = this.s;
    for (const r of s.rooms) {
      if (r.kind === 'staff') continue;
      for (let si = 0; si < r.slots.length; si++) {
        const sl = r.slots[si];
        if (sl.patient || sl.broken) continue;
        let best: Patient | null = null;
        // those sent back for a second try go first, then whoever has waited longest
        const before = (a: Patient, b: Patient) => (a.timer === -1) !== (b.timer === -1) ? a.timer === -1 : a.arrivedAt < b.arrivedAt || (a.arrivedAt === b.arrivedAt && a.id < b.id);
        for (const p of s.patients) {
          if (p.need !== r.kind || p.phase !== 'wait' || p.room) continue;
          if (!best || before(p, best)) best = p;
        }
        if (!best) break;
        this.leaveSeat(best); this.qdirty = true; best.qi = -1;
        best.phase = 'to_slot'; best.room = r.id; best.slot = si; best.spot = null; sl.patient = best.id; sl.progress = 0;
        if (!this.walkTo(best, sl.x, sl.y)) { best.phase = 'wait'; best.room = 0; best.slot = -1; sl.patient = 0; this.findSpot(best); }
      }
    }
    // a room with someone coming needs its staff member: rooms where a patient is already sitting at the machine go
    // first (longest there first), so one vet shared between a check-up room and a cure room doesn't strand anybody
    const need = s.rooms.filter((r) => r.kind !== 'staff' && r.slots.some((q) => q.patient));
    const waitAt = (r: Room) => { let t = 1e9; for (const q of r.slots) { const p = q.patient ? this.patientById(q.patient) : undefined; if (p && p.phase === 'in_slot') t = Math.min(t, p.arrivedAt); } return t; };
    need.sort((a, b) => waitAt(a) - waitAt(b));
    for (const r of need) {
      const role = ROOMS[r.kind].staff;
      if (!role || !r.slots.some((q) => q.patient)) continue;
      const cur = r.staff ? this.staffById(r.staff) : undefined;
      if (cur && cur.room === r.id && cur.state !== 'leave' && cur.state !== 'gone') continue;
      r.staff = 0;
      let pickSt: Staff | null = null, pd = 1e9;
      for (const st of s.staff) {
        if (st.role !== role || st.held || (st.state !== 'idle' && st.state !== 'arrive') || st.room || (st.home && st.home !== r.id)) continue;
        const d = Math.abs(st.x - r.staffSpot[0]) + Math.abs(st.y - r.staffSpot[1]);
        if (d < pd) { pd = d; pickSt = st; }
      }
      if (pickSt) { pickSt.room = r.id; r.staff = pickSt.id; pickSt.state = 'go'; this.walkTo(pickSt, r.staffSpot[0], r.staffSpot[1]); }
    }
  }

  private updatePatient(p: Patient) {
    const s = this.s;
    if (p.phase === 'gone') return;
    const speed = 0.2 * SPECIES[p.sp].speed;
    if (p.phase === 'leave') {
      if (this.move(p, speed) && this.atGoal(p)) {
        p.phase = 'gone';
        if (!p.happy) { s.leftUnhappy++; s.rep = clamp(s.rep - (p.vip ? 4 : 2), 0, 100); s.today.grump = { name: p.name, sp: p.sp }; this.events.push({ t: 'leave', x: p.x, y: p.y, id: p.id }); }
      } else if (!p.path.length) this.walkTo(p, this.porch[0], this.porch[1]);
      return;
    }
    if (p.phase === 'cheer') { p.px = p.x; p.py = p.y; if (--p.timer <= 0) this.sendHome(p, true); return; }
    if (p.phase === 'to_slot') {
      if (this.move(p, speed) && this.atGoal(p)) { p.phase = 'in_slot'; this.patience(p, -8); }
      else if (!p.path.length) { const r = this.roomById(p.room); if (r) { r.slots[p.slot].patient = 0; } this.requeue(p, true); }
      return;
    }
    if (p.phase === 'in_slot') { p.px = p.x; p.py = p.y; return; }
    if (p.phase === 'drink') {
      if (p.timer > 0) {
        if (this.move(p, speed) && this.atGoal(p)) {
          if (--p.timer === 0) {
            const d = s.decos.find((q) => q.id === p.drinkAt);
            p.thirst = 0; this.patience(p, -12); s.stats.drinks++;
            if (d && d.kind === 'vending') { s.coins += 15; s.earned += 15; this.events.push({ t: 'drink', x: d.x, y: d.y, coins: 15 }); }
            else if (d) this.events.push({ t: 'drink', x: d.x, y: d.y, coins: 0 });
            p.drinkAt = 0; p.phase = 'wait'; this.findSpot(p);
          } else { const d = s.decos.find((q) => q.id === p.drinkAt); if (d) { const dx = d.x - p.x, dy = d.y - p.y; p.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 0 : 2) : (dy > 0 ? 1 : 3); } }
        } else if (!p.path.length) { p.drinkAt = 0; p.phase = 'wait'; this.findSpot(p); }
      }
      this.thirsty(p);
      return;
    }
    // arrive / wait: walk to the waiting spot, then wait
    const there = this.move(p, speed);
    if (there && p.goal && !this.atGoal(p) && s.t % 20 === p.id % 20) this.findSpot(p);
    if (there && p.spot && this.atGoal(p)) p.dir = p.fd;
    if (p.fail > 0) p.fail--;
    this.thirsty(p);
    if (p.phase === 'arrive') p.phase = 'wait';
    // patience drains while waiting
    const i = Math.round(p.y) * this.W + Math.round(p.x);
    let drain = 0.11 * this.def.patience / SPECIES[p.sp].patience;
    if (p.seat && there) drain *= 0.5;
    if (p.thirst > 70) drain *= 1.4;
    drain *= this.comfort[i] ?? 1;
    drain *= this.cheer(p.x, p.y);
    if (!this.hasRoom(p.need)) drain *= 0.7;
    if (p.vip) drain *= 1.2;
    if (!s.open) drain = 0;
    this.patience(p, drain);
    // litter: less near a bin
    if (there && rnd(s) < 0.0005 * (this.binNear(p.x, p.y) ? 0.2 : 1) && s.litter.length < 40 && !s.litter.some((l) => l.x === Math.round(p.x) && l.y === Math.round(p.y)) && i < this.W * this.H) {
      s.litter.push({ id: this.id(), x: Math.round(p.x), y: Math.round(p.y), fixer: 0 });
    }
    // thirsty: fetch a drink if there is one, keeping their place in line
    if (there && p.thirst >= 60 && p.timer !== -1) {
      let best: Deco | null = null, bd = 15;
      for (const d of s.decos) {
        if (d.kind !== 'cooler' && d.kind !== 'vending') continue;
        const dd = Math.abs(d.x - p.x) + Math.abs(d.y - p.y);
        if (dd < bd) { bd = dd; best = d; }
      }
      if (best) {
        const adj = DIRS.map(([dx, dy]) => [best!.x + dx, best!.y + dy] as Pt).filter(([x, y]) => this.tileFree(x, y) && this.grid.walk[y * this.W + x] && this.entryDist[y * this.W + x] >= 0);
        if (adj.length) {
          this.leaveSeat(p); p.spot = null;
          // the front of a cooler or cart first (that is where the tap is), then the nearest side
          const [fx, fy] = DIR_D[best.rot ?? 1], front = (q: Pt) => (q[0] === best!.x + fx && q[1] === best!.y + fy ? -100 : 0);
          adj.sort((a, b) => front(a) - front(b) || Math.abs(a[0] - p.x) + Math.abs(a[1] - p.y) - (Math.abs(b[0] - p.x) + Math.abs(b[1] - p.y)));
          if (this.walkTo(p, adj[0][0], adj[0][1])) { p.phase = 'drink'; p.drinkAt = best.id; p.timer = 14; }
          else this.findSpot(p);
        }
      }
    }
    if (p.patience <= 0) {
      this.events.push({ t: 'grumpy', x: p.x, y: p.y, id: p.id });
      this.note(`${p.name} the ${SPECIES[p.sp].name} got tired of waiting and went home in a huff.`);
      this.events.push({ t: 'huff', x: p.x, y: p.y, id: p.id });
      this.sendHome(p, false);
    }
  }
  private thirsty(p: Patient) { if (this.s.open) p.thirst = Math.min(100, p.thirst + 0.03 * (this.def.twist === 'thirst' ? 2.2 : 1)); }
  private patience(p: Patient, drain: number) {
    const was = p.patience;
    p.patience = clamp(p.patience - drain, 0, 100);
    if (was >= 30 && p.patience < 30) this.events.push({ t: 'grumpy', x: p.x, y: p.y, id: p.id });
  }
  private binNear(x: number, y: number) { return this.s.decos.some((d) => d.kind === 'bin' && Math.abs(d.x - x) + Math.abs(d.y - y) <= 4); }
  /** cheery staff, Dora and Enzo nearby make the wait easier */
  cheer(x: number, y: number): number {
    let f = 1;
    for (const st of this.s.staff) if (st.trait === 'cheery' && st.state !== 'gone' && Math.abs(st.x - x) + Math.abs(st.y - y) <= 3) { f *= 0.75; break; }
    for (const w of this.s.walkers) if (w.who !== 'inspector' && Math.abs(w.x - x) + Math.abs(w.y - y) <= 3) { f *= 0.8; break; }
    return f;
  }

  private updateStaff(st: Staff) {
    const s = this.s;
    if (st.state === 'gone') return;
    if (st.held) { st.px = st.x; st.py = st.y; return; }
    const speed = 0.24 * (st.trait === 'quick' ? 1.15 : 1) * (st.energy < 10 ? 0.7 : 1);
    if (st.state === 'leave') { if (this.move(st, speed) && this.atGoal(st)) st.state = 'gone'; else if (!st.path.length) this.walkTo(st, this.porch[0], this.porch[1]); return; }
    // tiredness
    const working = st.state === 'work' || st.state === 'task';
    if (s.open && st.state !== 'rest') st.energy = Math.max(0, st.energy - (working ? 0.02 : 0.005) * (st.trait === 'sleepy' ? 1.7 : 1));
    if (st.state === 'rest') {
      st.px = st.x; st.py = st.y;
      st.energy = Math.min(100, st.energy + 0.4);
      // a training session: a 3-star vet teaches everybody resting in a Staff Room with training switched on
      const sr = this.roomById(this.restRoomOf(st));
      if (sr && sr.train && st.skill < 5) { const t = this.teacher(); if (t && t !== st) { st.xp += 0.06; this.levelCheck(st); } }
      if (st.energy >= 100) { st.state = 'idle'; st.goal = null; }
      return;
    }
    if (st.state === 'to_rest') { if (this.move(st, speed) && this.atGoal(st)) st.state = 'rest'; else if (!st.path.length) this.setIdle(st); return; }
    // go and rest when tired, if there is a staff room and nobody is mid-treatment with them
    if (st.energy < 28 && (st.state === 'idle' || (st.state === 'work' && !this.busyHere(st)))) {
      const sr = this.roomsOf('staff')[0];
      if (sr) { this.release(st); this.goRest(st, sr); return; }
    }
    if (st.state === 'arrive') { if (this.move(st, speed) && this.atGoal(st)) this.setIdle(st); if (st.role === 'cleaner' && (st.state as StaffState) === 'idle') this.cleanerThink(st); return; }
    if (st.state === 'go') {
      const r = this.roomById(st.room);
      if (!r) { this.setIdle(st); return; }
      if (this.move(st, speed) && this.atGoal(st)) st.state = 'work';
      else if (!st.path.length) { if (!this.walkTo(st, r.staffSpot[0], r.staffSpot[1])) { st.room = 0; r.staff = 0; this.setIdle(st); } }
      return;
    }
    if (st.state === 'work') {
      st.px = st.x; st.py = st.y;
      const r = this.roomById(st.room);
      if (!r) { this.setIdle(st); return; }
      // nothing left to do here and nobody waiting: free to go elsewhere (pinned staff stay)
      const queue = s.patients.some((p) => p.need === r.kind && (p.phase === 'wait' || p.phase === 'drink'));
      // ...or someone is sitting at a machine elsewhere that needs them, and nobody is at this room's machines yet
      const elsewhere = () => s.rooms.some((o) => o !== r && ROOMS[o.kind].staff === st.role && !(o.staff && this.staffById(o.staff)?.room === o.id) && o.slots.some((q) => q.patient && this.patientById(q.patient)?.phase === 'in_slot'));
      if (!st.home && !r.slots.some((q) => q.patient && this.patientById(q.patient)?.phase === 'in_slot') && (!queue && !r.slots.some((q) => q.patient) || elsewhere())) { st.room = 0; r.staff = 0; this.setIdle(st); }
      return;
    }
    if (st.state === 'task') { this.doTask(st, speed); return; }
    // idle
    st.px = st.x; st.py = st.y;
    if (st.role === 'cleaner') { this.cleanerThink(st); return; }
    // back to the room they were dropped into
    const home = st.home ? this.roomById(st.home) : undefined;
    if (home) {
      const other = home.staff ? this.staffById(home.staff) : undefined;
      if (other && other !== st && other.room === home.id) { other.room = 0; if (other.state === 'go' || other.state === 'work') this.setIdle(other); }
      st.room = home.id; home.staff = st.id; st.state = 'go'; this.walkTo(st, home.staffSpot[0], home.staffSpot[1]);
    } else if (st.goal) this.move(st, speed);
  }
  private busyHere(st: Staff) { const r = this.roomById(st.room); return !!r && r.slots.some((q) => q.patient && q.progress > 0); }

  // ---- cleaners
  private unclaim(t: Task) {
    if (t.type === 'fix') { const r = this.roomById(t.ref); if (r && r.slots[t.slot]) r.slots[t.slot].fixer = 0; }
    if (t.type === 'water') { const d = this.s.decos.find((q) => q.id === t.ref); if (d) d.fixer = 0; }
    if (t.type === 'sweep') { const l = this.s.litter.find((q) => q.id === t.ref); if (l) l.fixer = 0; }
  }
  private cleanerThink(st: Staff) {
    const s = this.s;
    if (st.task || st.held) return;
    if (s.t % 5 !== st.id % 5) return;
    const jobs: { task: Task; at: Pt; pri: number }[] = [];
    const reach = (tx: number, ty: number, rid: number): Pt | null => {
      for (const [dx, dy] of DIRS) {
        const nx = tx + dx, ny = ty + dy;
        if (nx < 0 || ny < 0 || nx >= this.W || ny >= this.H) continue;
        const i = ny * this.W + nx;
        if (this.grid.walk[i] && this.roomAt[i] === rid && canStep(this.grid, nx, ny, -dx, -dy, ty * this.W + tx)) return [nx, ny];
      }
      return null;
    };
    for (const r of s.rooms) r.slots.forEach((q, i) => {
      if (q.fixer || (!q.broken && q.wear < 55)) return;
      // fix it when nobody is on it
      if (q.patient && !q.broken) return;
      const at = reach(q.x, q.y, r.id) ?? r.staffSpot;
      jobs.push({ task: { type: 'fix', ref: r.id, slot: i }, at, pri: q.broken ? 3 : 2 });
    });
    for (const d of s.decos) if (d.kind === 'plant' && d.water < 40 && !d.fixer) { const at = reach(d.x, d.y, 0); if (at) jobs.push({ task: { type: 'water', ref: d.id, slot: 0 }, at, pri: 1.5 }); }
    for (const l of s.litter) if (!l.fixer && this.grid.walk[l.y * this.W + l.x]) jobs.push({ task: { type: 'sweep', ref: l.id, slot: 0 }, at: [l.x, l.y], pri: 1 });
    if (!jobs.length) return;
    jobs.sort((a, b) => b.pri - a.pri || (Math.abs(a.at[0] - st.x) + Math.abs(a.at[1] - st.y)) - (Math.abs(b.at[0] - st.x) + Math.abs(b.at[1] - st.y)));
    for (const j of jobs) {
      if (!this.walkTo(st, j.at[0], j.at[1])) continue;
      st.task = j.task; st.state = 'task'; st.timer = 0;
      if (j.task.type === 'fix') this.roomById(j.task.ref)!.slots[j.task.slot].fixer = st.id;
      if (j.task.type === 'water') s.decos.find((q) => q.id === j.task.ref)!.fixer = st.id;
      if (j.task.type === 'sweep') s.litter.find((q) => q.id === j.task.ref)!.fixer = st.id;
      return;
    }
    st.path = []; st.goal = null;
  }
  private doTask(st: Staff, speed: number) {
    const s = this.s, t = st.task!;
    if (!(this.move(st, speed) && this.atGoal(st))) { if (!st.path.length) { this.unclaim(t); st.task = null; this.setIdle(st); } return; }
    const rate = workRate(st);
    st.timer += rate;
    const need = t.type === 'fix' ? 45 : t.type === 'water' ? 12 : 10;
    if (st.timer < need) return;
    if (t.type === 'fix') {
      const r = this.roomById(t.ref), q = r?.slots[t.slot];
      if (q) { q.wear = 0; q.broken = false; q.fixer = 0; s.stats.repairs++; this.events.push({ t: 'fixed', x: q.x, y: q.y }); }
    } else if (t.type === 'water') {
      const d = s.decos.find((q) => q.id === t.ref); if (d) { d.water = 100; d.fixer = 0; this.computeComfort(); }
    } else {
      s.litter = s.litter.filter((l) => l.id !== t.ref); this.computeComfort();
    }
    this.grow(st);
    st.task = null; this.setIdle(st);
  }

  private updateRoom(r: Room) {
    const s = this.s;
    if (r.kind === 'staff') return;
    const st = r.staff ? this.staffById(r.staff) : undefined;
    const present = !!st && st.state === 'work' && st.room === r.id;
    for (const q of r.slots) {
      if (!q.patient) continue;
      const p = this.patientById(q.patient);
      if (!p || p.phase === 'gone' || p.room !== r.id) { q.patient = 0; q.progress = 0; continue; }
      if (p.phase !== 'in_slot' || !present || q.broken) continue;
      const def = ROOMS[r.kind];
      q.progress += workRate(st!) * UPGRADE_SPEED[r.level ?? 1];
      if (s.t % 30 === 0 && def.sound !== 'none') this.events.push({ t: 'machine', kind: r.kind, x: q.x, y: q.y });
      if (q.progress < def.work) continue;
      // done
      q.progress = 0; q.patient = 0; r.uses++;
      this.finishVisit(r, p, st!);
      if (r.kind !== 'reception') {
        q.wear = Math.min(100, q.wear + (r.kind === 'checkup' ? 4 : 7) * (this.def.twist === 'heat' ? 2 : 1) * (st!.trait === 'careful' ? 0.7 : 1) * UPGRADE_WEAR[r.level ?? 1]);
        if (q.wear >= 100 && !q.broken) { q.broken = true; s.today.broken = r.kind; this.events.push({ t: 'broken', x: q.x, y: q.y, room: r.id }); this.note(`The ${def.name} has worn out and stopped. A cleaner can fix it.`); }
      }
    }
  }
  private finishVisit(r: Room, p: Patient, st: Staff) {
    const s = this.s;
    p.room = 0; p.slot = -1;
    if (r.kind === 'reception' || r.kind === 'checkup') this.grow(st);
    if (r.kind === 'reception') {
      this.events.push({ t: 'checkin', x: r.mach[0][0], y: r.mach[0][1] });
      p.need = p.dx ? AILMENTS[p.dx].room : 'checkup';
      this.requeue(p, false);
      return;
    }
    if (r.kind === 'checkup') {
      this.diagnose(p, st);
      this.requeue(p, false);
      return;
    }
    // a cure room
    if (p.dx === p.ail) {
      const fee = Math.round(AILMENTS[p.ail].fee * (p.vip ? 3 : 1) * (p.patience >= 60 ? 1.1 : 1));
      s.coins += fee; s.earned += fee; s.cures++;
      // reputation climbs quickly from low and slowly near the top
      s.rep = clamp(s.rep + (p.vip ? 4 : p.patience >= 60 ? 1 : p.patience >= 30 ? 0.65 : 0.25) * (1.25 - s.rep / 100), 0, 100);
      p.cured = true; p.phase = 'cheer'; p.timer = 18;
      const e = s.emergencies.find((q) => q.id === p.emerg); if (e && !e.done) e.cured++;
      this.events.push({ t: 'cure', x: p.x, y: p.y, coins: fee, id: p.id });
      if (p.vip) { this.note(`${p.name} the condor left a big tip: ${fee} coins!`); s.today.vip = p.name; }
      // a cheerful send-off: a balloon, a lollipop or a pinwheel to take home
      p.gift = 1 + (p.id % 4);
      if (!s.today.quote || p.patience > 50) s.today.quote = { name: p.name, sp: p.sp, ail: p.ail };
      this.grow(st);
    } else {
      // the cure fails gently: a puzzled look, and back for a second opinion
      s.rep = clamp(s.rep - 0.3, 0, 100);
      p.wrongs.push(p.dx!); p.dx = null; p.sure = true; p.need = 'checkup'; p.fail = 30;
      this.events.push({ t: 'wrong', x: p.x, y: p.y, id: p.id });
      this.requeue(p, true);
    }
  }

  private updateWalker(w: Walker) {
    const s = this.s;
    if (w.who === 'inspector') {
      const speed = 0.16;
      if (w.path.length) { this.move(w, speed); return; }
      w.px = w.x; w.py = w.y;
      if (w.timer > 0) { w.timer--; return; }
      if (w.seen < w.stops.length) {
        const r = this.roomById(w.stops[w.seen]); w.seen++;
        if (r) { const [dx, dy] = SIDE_D[r.door.side]; this.walkTo(w, r.door.x + dx, r.door.y + dy); w.timer = 30; }
        return;
      }
      if (w.seen === w.stops.length) {
        w.seen++;
        // the verdict
        const broken = s.rooms.reduce((a, r) => a + r.slots.filter((q) => q.broken).length, 0);
        const waiting = s.patients.filter((p) => p.phase === 'wait');
        const grumpy = waiting.filter((p) => p.patience < 30).length;
        const dry = s.decos.filter((d) => d.kind === 'plant' && d.water <= 25).length;
        const score = 100 - s.litter.length * 5 - broken * 15 - grumpy * 6 - dry * 4;
        s.stats.inspections++;
        const why: string[] = [];
        if (s.litter.length > 3) why.push('litter on the floor'); if (broken) why.push('a broken machine'); if (grumpy > 1) why.push('grumpy patients'); if (dry) why.push('thirsty plants');
        if (score >= 60) { s.rep = clamp(s.rep + 4, 0, 100); s.coins += 200; s.earned += 200; s.today.inspector = 'good'; this.events.push({ t: 'inspector', ok: true, text: 'A glowing report: +200 coins and a better reputation!' }); this.note('The inspector loved the clinic: +200 coins!'); }
        else { s.rep = clamp(s.rep - 2, 0, 100); s.today.inspector = 'bad'; this.events.push({ t: 'inspector', ok: false, text: `The inspector frowned at ${why.join(' and ') || 'the queues'}.` }); this.note(`The inspector frowned at ${why.join(' and ') || 'the queues'}.`); }
        this.walkTo(w, this.porch[0], this.porch[1]);
        return;
      }
      w.timer = -1; // gone
      return;
    }
    // Dora and Enzo: drift towards the longest queue to keep spirits up, or potter about
    const speed = 0.17;
    if (w.path.length) { this.move(w, speed); return; }
    w.px = w.x; w.py = w.y;
    if (--w.timer > 0) return;
    w.timer = 90 + Math.floor(rnd(s) * 120);
    const waiting = s.patients.filter((p) => p.phase === 'wait' && p.spot);
    let target: Pt | null = null;
    if (waiting.length) {
      const grumpiest = waiting.reduce((a, b) => (a.patience < b.patience ? a : b));
      const others = s.walkers.filter((o) => o !== w && o.who !== 'inspector');
      const [gx, gy] = grumpiest.spot!;
      const busy = others.some((o) => o.goal && Math.abs(o.goal[0] - gx) + Math.abs(o.goal[1] - gy) < 3);
      const base = busy ? waiting[Math.floor(rnd(s) * waiting.length)].spot! : [gx, gy];
      const c = this.nearestCorridor(base[0] + (w.who === 'dora' ? 1 : -1), base[1]);
      target = c;
    } else {
      const x = Math.floor(rnd(s) * this.W), y = Math.floor(rnd(s) * this.H);
      target = this.nearestCorridor(x, y);
    }
    if (target) this.walkTo(w, target[0], target[1]);
  }

  // ------------------------------------------------------------------------------------------------ goals
  goals() {
    const s = this.s, g = this.def.goals;
    return [
      { id: 'cures', label: 'Cures', have: s.cures, need: g.cures, done: s.cures >= g.cures },
      { id: 'rep', label: 'Reputation', have: Math.round(s.rep), need: g.rep, done: s.rep >= g.rep },
      { id: 'coins', label: 'Coins', have: Math.round(s.coins), need: g.coins, done: s.coins >= g.coins },
    ];
  }
  starsFor(day: number, rep: number) {
    const d = this.def;
    if (day > d.days) return 1;
    return 1 + (day <= d.fastDay ? 1 : 0) + (rep >= d.starRep ? 1 : 0);
  }
  private checkGoals() {
    const s = this.s;
    if (s.met || this.def.twist === 'sandbox' || s.result !== 'playing' || !s.open) return;
    if (this.goals().every((g) => g.done)) {
      const stars = this.starsFor(s.day, s.rep);
      s.met = { day: s.day, rep: Math.round(s.rep), stars, t: s.t }; s.result = 'met';
      this.events.push({ t: 'met', stars });
    }
  }

  // ------------------------------------------------------------------------------------------------ advice (the assist)
  /** the most useful nudges right now, most urgent first */
  advice(): { id: string; text: string; act?: { hire?: Role; build?: RoomKind; place?: DecoKind } }[] {
    const s = this.s, out: { id: string; text: string; act?: { hire?: Role; build?: RoomKind; place?: DecoKind } }[] = [];
    const active = s.staff.filter((x) => x.state !== 'leave' && x.state !== 'gone');
    const count = (r: Role) => active.filter((x) => x.role === r).length;
    const due = wagesPerDay(s);
    if (s.coins - due < 150 && due > 0) out.push({ id: 'money', text: `Coins are running low: ${due} in wages are due at 20:00. Cures bring coins in; selling a room gives half its price back.` });
    for (const role of ['recep', 'vet', 'nurse'] as Role[]) {
      const rooms = s.rooms.filter((r) => ROOMS[r.kind].staff === role);
      // every desk needs its own receptionist; vets and nurses hop between rooms, but not between too many
      const want = role === 'recep' ? rooms.length : role === 'vet' ? Math.ceil(rooms.length / 2) : Math.min(1, rooms.length);
      if (rooms.length && count(role) < want) {
        const idle = rooms.find((r) => !s.staff.some((x) => x.room === r.id)) ?? rooms[0];
        out.push({ id: `hire-${role}`, text: count(role) ? `More ${ROLES[role].plural.toLowerCase()} please: the ${ROOMS[idle.kind].name} is waiting for one. Hire a ${ROLES[role].name.toLowerCase()}!` : `Your ${ROOMS[idle.kind].name} has nobody to run it. Hire a ${ROLES[role].name.toLowerCase()}!`, act: { hire: role } });
      }
    }
    const rq = s.patients.filter((p) => p.phase === 'wait' && p.need === 'reception').length;
    if (rq >= 7 && this.roomsOf('reception').length < 2) out.push({ id: 'more-reception', text: `${rq} patients are waiting to check in. A second Reception (with its own receptionist) would help.`, act: { build: 'reception' } });
    const missing = new Map<RoomKind, number>();
    for (const p of s.patients) if (p.phase === 'wait' && !this.hasRoom(p.need)) missing.set(p.need, (missing.get(p.need) ?? 0) + 1);
    for (const [k, n] of missing) if (this.def.rooms.includes(k)) out.push({ id: `build-${k}`, text: `${n} patient${n === 1 ? ' is' : 's are'} waiting for a ${ROOMS[k].name}. Build one: the ghost shows a good spot.`, act: { build: k } });
    const broken = s.rooms.some((r) => r.slots.some((q) => q.broken || q.wear >= 75));
    if (broken && !count('cleaner')) out.push({ id: 'hire-cleaner', text: 'A machine is worn out. Hire a cleaner to fix it.', act: { hire: 'cleaner' } });
    if (s.litter.length >= 6 && !count('cleaner')) out.push({ id: 'litter', text: 'Litter is piling up. A cleaner and a few bins would help.', act: { hire: 'cleaner' } });
    if (active.some((x) => x.energy < 30) && !this.hasRoom('staff')) out.push({ id: 'staffroom', text: 'Your staff are worn out. A Staff Room lets them rest.', act: { build: 'staff' } });
    for (const role of ['vet', 'nurse'] as Role[]) {
      const kinds = new Set(s.rooms.filter((r) => ROOMS[r.kind].staff === role).map((r) => r.kind));
      const queue = s.patients.filter((p) => p.phase === 'wait' && kinds.has(p.need)).length;
      if (count(role) && queue >= 3 * count(role) + 2) out.push({ id: `more-${role}`, text: `${queue} patients are queuing for ${ROLES[role].plural.toLowerCase()}. Another ${ROLES[role].name.toLowerCase()} would speed things up.`, act: { hire: role } });
    }
    const queueOf = (k: RoomKind) => s.patients.filter((p) => p.phase === 'wait' && p.need === k).length;
    const cq = queueOf('checkup');
    if (cq >= 6 && this.roomsOf('checkup').length < 3) out.push({ id: `more-checkup-${this.roomsOf('checkup').length}`, text: `${cq} patients are waiting for a check-up. A second Check-up Room (and a vet for it) would halve the line.`, act: { build: 'checkup' } });
    for (const k of this.def.rooms) {
      if (k === 'checkup' || k === 'reception' || k === 'staff' || !this.hasRoom(k)) continue;
      const n = queueOf(k), have = this.roomsOf(k).length;
      if (n >= 5 + have * 2 && have < 3) out.push({ id: `more-${k}-${have}`, text: `${n} patients are queuing for the ${ROOMS[k].name}. Another one would clear the line.`, act: { build: k } });
    }
    if (this.def.twist === 'thirst' && !s.decos.some((d) => d.kind === 'cooler' || d.kind === 'vending') && s.open) out.push({ id: 'drinks', text: 'Everyone is thirsty on the salt: a water cooler or a drinks cart would help a lot.', act: { place: 'cooler' } });
    if (this.def.twist === 'cold') {
      const heaters = s.decos.filter((d) => d.kind === 'heater');
      const cold = s.patients.filter((p) => p.phase === 'wait' && !heaters.some((d) => Math.abs(d.x - p.x) + Math.abs(d.y - p.y) <= 4)).length;
      if (!heaters.length || cold >= 3) out.push({ id: `heater-${heaters.length}`, text: `Brr! ${cold ? `${cold} patients are` : 'Patients are'} shivering far from a heater and losing patience. Place a heater near the queue.`, act: { place: 'heater' } });
    }
    const waitingStand = s.patients.filter((p) => p.phase === 'wait' && !p.seat).length;
    if (waitingStand >= 4 && s.decos.filter((d) => d.kind === 'bench').length < 3) out.push({ id: 'bench', text: 'Patients are standing in line. Benches let them wait twice as patiently.', act: { place: 'bench' } });
    if (s.decos.some((d) => d.kind === 'plant' && d.water <= 25) && !count('cleaner')) out.push({ id: 'water', text: 'The plants are thirsty. A cleaner waters them.', act: { hire: 'cleaner' } });
    return out;
  }
  /** for the hire panel's suggestion: the best candidate of a role we can afford */
  suggestHire(role: Role): Candidate | null {
    const c = this.s.cands.filter((q) => q.role === role && q.wage <= this.s.coins).sort((a, b) => b.skill - a.skill || a.wage - b.wage);
    return c[0] ?? null;
  }
  /** a short summary of the clinic for the debug hook and the tests */
  hash(): string {
    const s = this.s;
    return JSON.stringify([s.t, s.coins, Math.round(s.rep * 1000), s.cures, s.leftUnhappy, s.rng, s.patients.map((p) => [p.id, Math.round(p.x * 100), Math.round(p.y * 100), p.phase, Math.round(p.patience * 100)]),
      s.staff.map((x) => [x.id, Math.round(x.x * 100), Math.round(x.y * 100), x.state, Math.round(x.energy * 100)]), s.rooms.map((r) => [r.id, r.slots.map((q) => [q.patient, Math.round(q.progress), Math.round(q.wear)])])]);
  }
}

// =====================================================================================================================
// the save: campaign progress, the clinic in play and the settings
export interface Settings { sound: boolean; music: boolean; speed: 1 | 2 | 3; assist: boolean; strict: boolean; motion: boolean; sandbox: boolean; bulletins: boolean }
export interface Save {
  v: 1;
  stars: Record<string, number>;
  best: Record<string, number>;
  current: State | null;
  settings: Settings;
  seenIntro: boolean;
}
export const newSettings = (): Settings => ({ sound: true, music: true, speed: 1, assist: true, strict: false, motion: true, sandbox: false, bulletins: true });
export const newSave = (): Save => ({ v: 1, stars: {}, best: {}, current: null, settings: newSettings(), seenIntro: false });
export function parseSave(raw: string | null): Save {
  if (!raw) return newSave();
  try {
    const o = JSON.parse(raw);
    if (!o || o.v !== 1 || typeof o.stars !== 'object' || !o.stars || typeof o.settings !== 'object' || !o.settings) return newSave();
    const out = newSave();
    for (const c of [...CLINICS.map((q) => q.id)]) { const v = o.stars[c]; if (typeof v === 'number' && v >= 0 && v <= 3) out.stars[c] = Math.floor(v); const b = o.best?.[c]; if (typeof b === 'number') out.best[c] = b; }
    const st = o.settings;
    out.settings = { sound: st.sound !== false, music: st.music !== false, speed: st.speed === 2 || st.speed === 3 ? st.speed : 1, assist: st.assist !== false, strict: st.strict === true, motion: st.motion !== false, sandbox: st.sandbox === true, bulletins: st.bulletins !== false };
    out.seenIntro = o.seenIntro === true;
    if (o.current) { try { Game.load(o.current); out.current = o.current; } catch { out.current = null; } }
    return out;
  } catch { return newSave(); }
}
export const serialise = (s: Save) => JSON.stringify(s);
/** is clinic i open on the map? */
export function clinicOpen(save: Save, i: number): boolean { return i === 0 || (save.stars[CLINICS[i - 1].id] ?? 0) > 0; }
export function sandboxOpen(save: Save): boolean { return save.settings.sandbox || (save.stars[CLINICS[1].id] ?? 0) > 0; }
export const totalStars = (save: Save) => CLINICS.reduce((a, c) => a + (save.stars[c.id] ?? 0), 0);
/** record a clinic's result (stars only ever go up) */
export function record(save: Save, clinic: string, met: Met) {
  save.stars[clinic] = Math.max(save.stars[clinic] ?? 0, met.stars);
  save.best[clinic] = Math.min(save.best[clinic] ?? 999, met.day);
}
export const poseOf = (kind: RoomKind): Pose => ROOMS[kind].pose;
