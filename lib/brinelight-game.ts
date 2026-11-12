// Brinelight: the rules. A side-scrolling brawler on a harbour belt with a little depth to walk in. Deterministic:
// randomness comes from a seeded generator and the page feeds one Input per 1/60 s step, so a seed and an input list
// replay a game exactly. No DOM. The page drains `events` (sounds and effects) after each step; the scene draws the
// state. Content (areas, stages, scenes laid out by hand) is in lib/brinelight-levels.ts.
//
// The rule of the two heroes: whatever glints GREY (shells, armour, barrels, claws, ice) wants Enzo, who grabs,
// throws and slams; whatever glints CREAM (wings, things in the air) wants Dora, who kicks fast and is the only one
// who reaches the air. Shift tags at any moment; the incoming hero arrives with a strike, a tag in mid-combo keeps
// the combo and starts a tag chain, and chains fill the Festival meter for the double-team (Attack + Jump).
import {
  AREAS, STAGES, SCENES, COL, LANE_Z, BOSS_NAME,
  type SceneDef, type WaveDef, type BossKind, type FoeKind, type NpcId, type EventDef, type GoalDef,
} from './brinelight-levels.js';

export { AREAS, STAGES, SCENES, COL, LANE_Z, BOSS_NAME };
export const SAVE_KEY = 'brinelight-v1';
export const DT = 1 / 60;
export const FLOOR = 352;      // band y of feet at depth 0 (the back of the deck)
export const DEPTH = 160;      // walkable depth
export const VIEW_W = 860;     // the arena: the width of one locked fight, the same on every screen
export const GRAV = 2000;

export type HeroId = 'dora' | 'enzo';
export interface Input { mx: number; mz: number; atkP: boolean; jmpP: boolean; tagP: boolean; atkH: boolean; jmpH: boolean }
export const NO_INPUT: Input = { mx: 0, mz: 0, atkP: false, jmpP: false, tagP: false, atkH: false, jmpH: false };

/** what the page plays and the scene draws; nothing in here feeds back into the rules */
export type GameEvent =
  | { k: 'sfx'; id: string }
  | { k: 'sparks'; x: number; z: number; h: number; col: string; n: number; big: number }
  | { k: 'dust'; x: number; z: number; n: number; size: number }
  | { k: 'splash'; x: number }
  | { k: 'ring'; x: number; z: number; size: number; col: string; life: number }
  | { k: 'swipe'; x: number; z: number; h: number; face: number; big: number; col: string }
  | { k: 'tink'; x: number; z: number; h: number; want: HeroId }
  | { k: 'fest'; x: number; z: number; h: number; amt: number }
  | { k: 'word'; x: number; z: number; h: number; text: string; col: string }
  | { k: 'debris'; x: number; z: number; kind: string }
  | { k: 'zap'; x: number; z: number; h: number }
  | { k: 'trail'; x: number; z: number; h: number; who: HeroId }
  | { k: 'shock'; x: number; z: number; size: number }
  | { k: 'lantern'; si: number; slot: number; x: number; z: number; h: number }
  | { k: 'flash'; a: number };

// ─────────────────────────────────────────────────────────────── seeded randomness
export function rngOf(seed: number) {
  let a = (seed >>> 0) || 1;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const clamp = (v: number, a: number, b: number) => v < a ? a : v > b ? b : v;
const sgn = (v: number) => v < 0 ? -1 : 1;

// ─────────────────────────────────────────────────────────────── the heroes and their moves
export const HC = {
  dora: { spd: 300, zs: 175, jump: 780, H: 165, rad: 30, dash: 760, dashT: 0.2, djx: 430 },
  enzo: { spd: 232, zs: 145, jump: 470, H: 172, rad: 36, dash: 600, dashT: 0.24, djx: 330 },
};
export interface Move {
  key: string; dur: number; hit: number; chain: number; reach: number; y0: number; y1: number; dmg: number; kb: number;
  lunge: number; down?: boolean; heavy?: boolean; shake?: number; snd: string; who: HeroId; slam?: boolean;
}
const mv = (o: Move) => o;
export const MOVES: Record<string, Move> = {
  // Dora: four quick kicks, the last a roundhouse that knocks down
  k1: mv({ key: 'k1', dur: 0.19, hit: 0.05, chain: 0.1, reach: 96, y0: 10, y1: 115, dmg: 1, kb: 70, lunge: 70, snd: 'kick', who: 'dora' }),
  k2: mv({ key: 'k2', dur: 0.21, hit: 0.06, chain: 0.11, reach: 104, y0: 30, y1: 135, dmg: 1, kb: 90, lunge: 70, snd: 'kick', who: 'dora' }),
  k3: mv({ key: 'k3', dur: 0.19, hit: 0.05, chain: 0.1, reach: 96, y0: 10, y1: 115, dmg: 1, kb: 90, lunge: 60, snd: 'kick', who: 'dora' }),
  k4: mv({ key: 'k4', dur: 0.38, hit: 0.1, chain: 0.28, reach: 110, y0: 40, y1: 185, dmg: 1.6, kb: 330, down: true, heavy: true, lunge: 110, snd: 'kick3', who: 'dora' }),
  // Enzo: two heavy paws and a two-fisted slam that sends a shockwave along the deck
  p1: mv({ key: 'p1', dur: 0.25, hit: 0.09, chain: 0.15, reach: 92, y0: 30, y1: 140, dmg: 1.5, kb: 80, lunge: 40, snd: 'punch', who: 'enzo' }),
  p2: mv({ key: 'p2', dur: 0.25, hit: 0.09, chain: 0.15, reach: 92, y0: 30, y1: 140, dmg: 1.5, kb: 90, lunge: 40, snd: 'punch', who: 'enzo' }),
  p3: mv({ key: 'p3', dur: 0.46, hit: 0.18, chain: 0.36, reach: 104, y0: 0, y1: 130, dmg: 2.6, kb: 360, down: true, heavy: true, lunge: 50, snd: 'slam', who: 'enzo', shake: 7, slam: true }),
  // air and dash attacks (not chained)
  dive: mv({ key: 'dive', dur: 0, hit: 0, chain: 0, reach: 86, y0: -40, y1: 100, dmg: 1.4, kb: 220, lunge: 0, snd: 'kick', who: 'dora' }),
  rise: mv({ key: 'rise', dur: 0, hit: 0, chain: 0, reach: 80, y0: 60, y1: 230, dmg: 1.4, kb: 160, lunge: 0, snd: 'kick3', who: 'dora', heavy: true }),
  hammer: mv({ key: 'hammer', dur: 0, hit: 0, chain: 0, reach: 90, y0: -30, y1: 110, dmg: 2, kb: 240, lunge: 0, down: true, snd: 'slam', who: 'enzo' }),
  knee: mv({ key: 'knee', dur: 0.26, hit: 0.04, chain: 0.3, reach: 100, y0: 20, y1: 140, dmg: 1.6, kb: 300, down: true, heavy: true, lunge: 220, snd: 'kick3', who: 'dora' }),
  barge: mv({ key: 'barge', dur: 0.3, hit: 0.05, chain: 0.34, reach: 100, y0: 0, y1: 150, dmg: 2.2, kb: 380, down: true, heavy: true, lunge: 200, snd: 'slam', who: 'enzo', shake: 6 }),
};
export const SPECIAL_NAME: Record<HeroId, string> = { dora: 'Comet Spin', enzo: 'Anchor Drop' };

export type HeroSt =
  | 'idle' | 'walk' | 'dash' | 'atk' | 'air' | 'airatk' | 'land' | 'hurt' | 'down' | 'getup' | 'tagin' | 'flopland'
  | 'grab' | 'hold' | 'throw' | 'heave' | 'special' | 'specland' | 'pick' | 'win' | 'out' | 'dbl';
export interface Hero {
  name: HeroId; x: number; z: number; h: number; vh: number; vx: number; face: number; hp: number; st: HeroSt; t: number;
  mk: string; hits: object[]; struck: boolean; inv: number; flash: number; anim: number; buf: number; jbuf: number;
  hold: Foe | Item | null; airUsed: boolean; ready: boolean; edgeH: number; dashDir: number; djump: boolean; afterDash: number;
  tagX: number; tagFrom: number; airKind: string; specCD: number; landT: number;
  /** seconds since Attack was last pressed: Enzo only grabs by walking in when he isn't mashing */
  atkAgo: number;
}
export type FoeSt =
  | 'enter' | 'idle' | 'walk' | 'wind' | 'atk' | 'rec' | 'hurt' | 'down' | 'up' | 'daze' | 'hover' | 'dive' | 'crash'
  | 'lift' | 'held' | 'thrown' | 'ko' | 'block' | 'puffed' | 'roll' | 'whistle' | 'flee' | 'charge' | 'zap' | 'tangled'
  | 'duck' | 'perch' | 'squirt';
export interface Foe {
  id: number; kind: FoeKind; hp: number; max: number; rad: number; ht: number; x: number; z: number; h: number; vh: number;
  vx: number; vz: number; face: number; st: FoeSt; t: number; cd: number; flash: number; daze: number; anim: number;
  shell: boolean; lantern: number; tok: boolean; script: string; side: number; zoff: number; spin: number; hitList: object[];
  /** this attack is a lobster's counter to being hit in the guard */
  ctr?: boolean;
  didHit: boolean; tx: number; tz: number; dead: boolean; splashed: boolean; blocks: number; puffT: number; callT: number;
  called: boolean; lane: number; dazedOnce: boolean; flipped: boolean; charge: number; stole: boolean;
  /** an eel pulled out of its hole, or an inker knocked off its post: from then on it fights on the boards */
  loose: boolean;
}
export type ItemKind = 'shell' | 'barrel' | 'snack' | 'bun' | 'charm' | 'scroll';
export interface Item { id: number; kind: ItemKind; x: number; z: number; h: number; vx: number; vh: number; t: number; dead: boolean; slide: number; hitList: object[]; sid: string; held: boolean; spin: number }
export type PropKind = 'barrel' | 'crate' | 'fishcrate' | 'ice' | 'net';
export interface Prop { id: number; kind: PropKind; x: number; z: number; hp: number; content: '' | 'snack' | 'charm'; sid: string; alive: boolean; vx: number; hitList: object[]; fall: number; down: boolean; flash: number }
export interface Str { col: number; need: number; got: number; flying: number; glow: number; pulse: number }
/** how hard the mash punishments bite in area 2 with assist on: +PUNISH per wrong hit in a row, up to PUNISH_CAP times (tuned with the bots) */
export let PUNISH = 1.5, PUNISH_CAP = 8, MERCY_KO = true;
export function setPunish(k: number, cap = PUNISH_CAP, ko = MERCY_KO) { PUNISH = k; PUNISH_CAP = cap; MERCY_KO = ko; }
export interface Boss {
  kind: BossKind; x: number; z: number; h: number; vh: number; hp: number; max: number; st: string; t: number; face: number;
  flash: number; hurtT: number; phase: number; armour: number; layers: number; n: number; tx: number; tz: number;
  didHit: boolean; summoned: number; dir: number; pinned: number; cycle: number; ghost: number; tinks: number;
  /** states seen so far: a telegraph is held half as long again the first time it shows; hinted = last phase hinted */
  seen: string[]; lastSt: string; first: boolean; hinted: number;
  /** Tanglejaw: which drain hole he is in, and how far his lunge reaches out of it */
  hole: number; ext: number;
}
/** a barrel rolling down the ropewalk belt (or the old harbour cart): the rumble and the marked lane come first */
export interface Roll { lane: number; x: number; t: number; tell: number; hit: object[]; kind: 'cart' | 'barrel'; keep: boolean; passed: boolean }
/** one of Old Tanglejaw's three drain holes, and whether Enzo has jammed a barrel in it */
export interface Hole { x: number; z: number; plug: boolean }
/** a splat of octopus ink over part of the screen (in screen fractions), until it fades or the inker is hit */
export interface Ink { x: number; y: number; t: number; life: number; r: number; by: number }
/** the one-time icon at the start of each boss phase: whose job this phase is, and the key that does it */
export interface BossHint { who: HeroId; act: 'atk' | 'jmp' | 'carry'; t: number; phase: number }
const BOSS_HINT: Record<BossKind, [HeroId, 'atk' | 'jmp' | 'carry'][]> = {
  brute: [['enzo', 'atk'], ['dora', 'atk'], ['enzo', 'atk']],       // crack the barnacles; juggle him bare; crack again
  clamps: [['enzo', 'atk'], ['dora', 'jmp'], ['enzo', 'atk']],      // rip the barrel; hop the double roll; two barrels
  knuckles: [['dora', 'atk'], ['enzo', 'atk'], ['dora', 'jmp']],    // counter the tell; throw him out of his guard; jump the hop
  admiral: [['dora', 'jmp'], ['enzo', 'atk'], ['dora', 'jmp']],     // counter the dive; pin him grounded; kick the nets away
  longshanks: [['enzo', 'atk'], ['dora', 'jmp'], ['enzo', 'atk']],  // heave the stuck leg; jump the sweep; two stomps now
  tanglejaw: [['enzo', 'carry'], ['dora', 'jmp'], ['enzo', 'carry']], // plug two holes; jump the whip; plug them again
};
export interface Prompt { act: 'move' | 'grab' | 'plug' | 'atk' | 'jmp' | 'tag' | 'dbl' | 'special' | 'go'; who: 'hero' | 'partner' | 'foe' | 'boss'; tint?: 'grey' | 'cream'; x?: number; z?: number; h?: number; dir?: number }
export interface Talk { who: NpcId; line: string; t: number }
export interface Stats {
  time: number; dmg: number; hits: number; best: number; tags: number; tagChains: number; grabs: number; throws: number;
  retries: number; tinks: number; dashes: number; dashAtks: number; specials: number; specialHits: number; specialLanded: number; dbls: number;
  bossTime: Record<string, number>; jumps: number; airHits: number; score: number; lanterns: number; scenes: number;
  wrongHits: number; kos: number; snacks: number;
  /** scene goals won and lost (a lost goal only costs its lanterns), and foes knocked overboard on a ride */
  goals: number; goalsLost: number; overboard: number;
}
/** a scene goal under way (see GoalDef): the thief (chase) or the stall (defend) is x/z/h/hp; `front` is the tide's edge */
export interface Goal {
  def: GoalDef; kind: GoalDef['kind']; t: number; done: boolean; won: boolean; group: number; groupT: number;
  x: number; z: number; h: number; st: string; stT: number; hp: number; max: number; flash: number; front: number; wet: number;
}
/** the hour, by the stage's place in its district: dusk, then night, then the fireworks over the boss */
export type TimeOfDay = 'dusk' | 'night' | 'fireworks';
export function timeOfDay(stageId: string): TimeOfDay {
  const st = STAGES[stageId], i = AREAS[st.area - 1].stages.indexOf(stageId);
  return i <= 0 ? 'dusk' : i === 1 ? 'night' : 'fireworks';
}

interface WaveRun { def: WaveDef; group: number; groupT: number; t: number; called: boolean; carriers: number }
interface Tut { stage: number; t: number; tinks: number; lastMove: number; thief: Foe | null; hermit: Foe | null; gull: Foe | null }

// ─────────────────────────────────────────────────────────────── the foes
export const FD: Record<FoeKind, { hp: number; rad: number; ht: number; spd: number; zs: number; wind: number; atk: number; rec: number; cd: number; dmg: number; reach: number; dazeAt: number; fly?: boolean; score: number }> = {
  crab: { hp: 4.5, rad: 34, ht: 58, spd: 140, zs: 90, wind: 0.5, atk: 0.2, rec: 0.5, cd: 1.0, dmg: 10, reach: 80, dazeAt: 1.6, score: 100 },
  hermit: { hp: 7, rad: 42, ht: 78, spd: 85, zs: 55, wind: 0.7, atk: 0.7, rec: 0.8, cd: 1.8, dmg: 10, reach: 90, dazeAt: 0, score: 200 },
  gull: { hp: 2.4, rad: 40, ht: 70, spd: 230, zs: 120, wind: 0.75, atk: 1, rec: 1.2, cd: 1.6, dmg: 7, reach: 60, dazeAt: 0, fly: true, score: 150 },
  puffer: { hp: 6, rad: 40, ht: 70, spd: 95, zs: 60, wind: 0.6, atk: 0.3, rec: 0.6, cd: 1.4, dmg: 9, reach: 70, dazeAt: 0, score: 200 },
  shrimp: { hp: 2, rad: 28, ht: 70, spd: 210, zs: 120, wind: 0.5, atk: 0.2, rec: 0.4, cd: 1.0, dmg: 5, reach: 60, dazeAt: 0, score: 150 },
  lobster: { hp: 9, rad: 44, ht: 90, spd: 90, zs: 60, wind: 0.65, atk: 0.25, rec: 0.7, cd: 1.6, dmg: 12, reach: 105, dazeAt: 2.5, score: 300 },
  jelly: { hp: 3.5, rad: 36, ht: 80, spd: 70, zs: 50, wind: 0.9, atk: 0.45, rec: 0.9, cd: 2.2, dmg: 9, reach: 70, dazeAt: 0, score: 200 },
  urchin: { hp: 5, rad: 32, ht: 52, spd: 110, zs: 70, wind: 0.6, atk: 0.9, rec: 0.8, cd: 2.0, dmg: 10, reach: 90, dazeAt: 0, score: 200 },
  // area 3: an eel's reach is its lunge out of the hole; a cormorant dives straight down; an inker squirts from a post
  eel: { hp: 4, rad: 30, ht: 50, spd: 75, zs: 45, wind: 0.85, atk: 0.3, rec: 0.5, cd: 2.0, dmg: 9, reach: 170, dazeAt: 0, score: 200 },
  cormorant: { hp: 3, rad: 38, ht: 70, spd: 210, zs: 110, wind: 1.0, atk: 0.3, rec: 1.0, cd: 2.4, dmg: 10, reach: 60, dazeAt: 0, fly: true, score: 200 },
  octo: { hp: 5, rad: 36, ht: 70, spd: 90, zs: 55, wind: 0.8, atk: 0.25, rec: 0.7, cd: 3.2, dmg: 8, reach: 85, dazeAt: 0, score: 250 },
};
/** an eel still in its hole: only its head shows; Enzo's paws haul it out, and its own lunge leaves it stretched out */
export const inHole = (f: Foe) => f.kind === 'eel' && !f.loose;
/** an inker still up on its scaffold post */
export const perched = (f: Foe) => f.kind === 'octo' && !f.loose;
/** the top of an inker's scaffold post, where it sits */
export const POST_H = 90;
const flier = (f: Foe) => f.kind === 'gull' || f.kind === 'cormorant';
/** which hero a foe wants, for the assist outline and the prompts */
export function foeWants(f: Foe): HeroId | null {
  if (f.kind === 'hermit' && f.shell) return 'enzo';
  if (f.kind === 'lobster') return 'enzo';
  if (f.kind === 'puffer' && f.st === 'puffed') return 'enzo';
  if ((f.kind === 'gull' || f.kind === 'jelly' || f.kind === 'cormorant') && f.h > 40) return 'dora';
  if (inHole(f) && f.st !== 'rec') return 'enzo';
  if (perched(f)) return 'dora';
  if (f.kind === 'urchin' && !f.flipped) return 'dora';
  return null;
}

// ─────────────────────────────────────────────────────────────── saves
export interface SaveData {
  v: 1; assist: boolean; cleared: Record<string, { score: number; time: number; medal: number }>; found: string[];
  seen: string[]; sound: boolean; music: boolean; lanterns: number;
}
export function freshSave(): SaveData { return { v: 1, assist: true, cleared: {}, found: [], seen: [], sound: true, music: true, lanterns: 0 }; }
export function parseSave(raw: string | null): SaveData | null {
  if (!raw) return null;
  try {
    const s = JSON.parse(raw);
    if (!s || typeof s !== 'object' || s.v !== 1 || typeof s.cleared !== 'object' || !Array.isArray(s.found)) return null;
    return { ...freshSave(), ...s, found: s.found.filter((x: unknown) => typeof x === 'string'), seen: Array.isArray(s.seen) ? s.seen : [] };
  } catch { return null; }
}
/** a stage is open when it is the first one or the one before it is cleared; area 2 opens after Clamps */
export function stageOpen(save: SaveData, id: string): boolean {
  const order = Object.keys(STAGES), i = order.indexOf(id);
  return i === 0 || (i > 0 && !!save.cleared[order[i - 1]]);
}
/** medal from score per second and damage taken: 3 gold, 2 silver, 1 bronze */
export function medalFor(stats: Stats): number {
  const pace = stats.score / Math.max(30, stats.time);
  return stats.dmg < 60 && pace > 60 ? 3 : stats.dmg < 160 && pace > 35 ? 2 : 1;
}

// ─────────────────────────────────────────────────────────────── the game
export interface GameOpts { stage: string; seed?: number; assist?: boolean; found?: string[]; skipTalk?: boolean }
export type Mode = 'play' | 'down' | 'clear';

export class BrineGame {
  readonly stageId: string; readonly seed: number; rnd: () => number; assist: boolean;
  mode: Mode = 'play'; t = 0; rt = 0; stop = 0; shake = 0; downT = 0; clearT = 0;
  sceneIds: string[]; sceneI = 0; scene!: SceneDef; inSecret = false; len = 0;
  dora!: Hero; enzo!: Hero; active: HeroId = 'dora';
  foes: Foe[] = []; items: Item[] = []; props: Prop[] = []; boss: Boss | null = null; strings: Str[] = [];
  rolls: Roll[] = []; holes: Hole[] = []; ink: Ink[] = []; beltT = 0;
  goal: Goal | null = null; rideX = 0;
  cam = VIEW_W / 2; lock: number | null = null; evI = 0; wave: WaveRun | null = null; go = 0;
  tokens = 0; tagCD = 0; tagQ = 0; fest = 0; festFull = false; dblT = -1;
  combo = { n: 0, t: 0, chain: 0 };
  prompt: Prompt | null = null; talk: Talk | null = null; bossHint: BossHint | null = null;
  learned: Record<string, number> = {};
  tut: Tut = { stage: 9, t: 0, tinks: 0, lastMove: 0, thief: null, hermit: null, gull: null };
  stats: Stats = { time: 0, dmg: 0, hits: 0, best: 0, tags: 0, tagChains: 0, grabs: 0, throws: 0, retries: 0, tinks: 0, dashes: 0, dashAtks: 0, specials: 0, specialHits: 0, specialLanded: 0, dbls: 0, bossTime: {}, jumps: 0, airHits: 0, score: 0, lanterns: 0, scenes: 0, wrongHits: 0, kos: 0, snacks: 0, goals: 0, goalsLost: 0, overboard: 0 };
  found: Set<string>; newFound: string[] = [];
  events: GameEvent[] = [];
  /** the double-tap detector for dashing: last onset of a left/right press, how long it was held, when it let go */
  private tap = { dir: 0, on: -9, off: -9, prev: 0 };
  private koOnce = false;   // a hero has been knocked out this stage: the mash punishments ease off
  private nid = 1; private wrongT = 0; private wrongN = 0; private bossStart = 0; private skipTalk: boolean;
  private retryAt = { evI: 0, x: 0 };
  private teachT = 0; private specN = -1; private dblHit = false;

  constructor(o: GameOpts) {
    if (!STAGES[o.stage]) throw new Error('no stage ' + o.stage);
    this.stageId = o.stage; this.seed = o.seed ?? 1; this.rnd = rngOf(this.seed * 7919 + 17);
    this.assist = o.assist ?? true; this.found = new Set(o.found ?? []); this.skipTalk = !!o.skipTalk;
    this.sceneIds = STAGES[o.stage].scenes.slice();
    this.dora = this.mkHero('dora'); this.enzo = this.mkHero('enzo');
    this.enzo.st = 'out';
    this.enterScene(this.sceneIds[0]);
  }
  private mkHero(name: HeroId): Hero {
    return { name, x: 160, z: 80, h: 0, vh: 0, vx: 0, face: 1, hp: 100, st: 'idle', t: 0, mk: '', hits: [], struck: false, inv: 0, flash: 0, anim: 0, buf: 0, jbuf: 0, hold: null, airUsed: false, ready: true, edgeH: 0, dashDir: 0, djump: false, afterDash: 9, tagX: 0, tagFrom: 0, airKind: '', specCD: 0, landT: 0, atkAgo: 9 };
  }
  hero() { return this[this.active]; }
  partner() { return this[this.active === 'dora' ? 'enzo' : 'dora']; }
  get camL() { return this.cam - VIEW_W / 2; }
  get camR() { return this.cam + VIEW_W / 2; }
  private ev(e: GameEvent) { this.events.push(e); }
  private sfx(id: string) { this.events.push({ k: 'sfx', id }); }
  private rr(a: number, b: number) { return a + (b - a) * this.rnd(); }
  hitstop(s: number) { this.stop = Math.max(this.stop, s); }
  shakeBy(v: number) { this.shake = Math.max(this.shake, v); }

  // ─────────────────────────────────────────── scenes
  enterScene(id: string) {
    const sc = SCENES[id]; this.scene = sc; this.len = sc.lanes[0].length * COL;
    this.foes = []; this.items = []; this.props = []; this.boss = null; this.wave = null; this.lock = null; this.evI = 0; this.tokens = 0; this.flies = []; this.rolls = []; this.holes = []; this.ink = [];
    this.goal = null; this.rideX = 0;
    this.strings = sc.strings.map((s) => ({ col: s.col, need: s.need, got: 0, flying: 0, glow: 0, pulse: 0 }));
    let charm = 0;
    sc.lanes.forEach((row, r) => {
      for (let c = 0; c < row.length; c++) {
        const ch = row[c], x = c * COL + COL / 2, z = LANE_Z[r];
        const prop = (kind: PropKind, content: '' | 'snack' | 'charm' = '', sid = '') => this.props.push({ id: this.nid++, kind, x, z, hp: kind === 'ice' ? 99 : 2, content, sid, alive: true, vx: 0, hitList: [], fall: 0, down: false, flash: 0 });
        if (ch === 'b') prop('barrel');
        else if (ch === 'q') { const sid = `${id}:c${charm++}`; prop('barrel', this.found.has(sid) ? '' : 'charm', sid); }
        else if (ch === 'c') prop('crate');
        else if (ch === 's') prop('crate', 'snack');
        else if (ch === 'f') prop('fishcrate', 'snack');
        else if (ch === 'i') prop('ice');
        else if (ch === 'n') prop('net');
        else if (ch === 'k') { const sid = `${id}:c${charm++}`; prop('crate', this.found.has(sid) ? 'snack' : 'charm', sid); }
        else if (ch === 'g') { const sid = `${id}:c${charm++}`; if (!this.found.has(sid)) this.addItem('charm', x, z, 0, 0, 0, sid); }
        else if (ch === 'm') { const sid = `${id}:shanty`; if (!this.found.has(sid)) this.addItem('scroll', x, z, 0, 0, 0, sid); }
      }
    });
    const d = this.dora, e = this.enzo, p = this.hero();
    for (const h of [d, e]) { h.hold = null; h.vx = 0; h.vh = 0; h.h = 0; h.inv = 0; }
    Object.assign(p, { x: 140, z: 80, st: 'idle', t: 0, face: 1 });
    this.partner().st = 'out';
    this.cam = VIEW_W / 2;
    this.stats.scenes++;
    this.retryAt = { evI: 0, x: 140 };
    if (sc.events[0]?.kind === 'tutorial') this.tut = { stage: 0, t: 0, tinks: 0, lastMove: 0, thief: null, hermit: null, gull: null };
    else this.tut.stage = 9;
  }
  private addItem(kind: ItemKind, x: number, z: number, h: number, vx: number, vh: number, sid = '') {
    const it: Item = { id: this.nid++, kind, x, z, h, vx, vh, t: 0, dead: false, slide: 0, hitList: [], sid, held: false, spin: 0 };
    this.items.push(it); return it;
  }
  /** the way into the hidden scene, once this scene's fights are done: world x of the `a` in the back lane */
  secretDoor(): number | null {
    if (!this.scene.secret || this.inSecret || this.evI < this.scene.events.length || this.wave || this.boss) return null;
    const c = this.scene.lanes[0].indexOf('a'); return c < 0 ? null : c * COL + COL / 2;
  }

  // ─────────────────────────────────────────── input helpers
  /** double-tap left/right to dash: the first tap is short, the second comes soon after it let go */
  private dashTap(mx: number): number {
    const T = this.tap, now = this.t, win = this.assist ? 0.25 : 0.2;
    let fire = 0;
    const d = mx > 0 ? 1 : mx < 0 ? -1 : 0;
    if (d !== T.prev) {
      if (d !== 0) {
        if (d === T.dir && now - T.off <= win && T.off - T.on <= 0.25) fire = d;
        T.dir = d; T.on = now;
      } else T.off = now;
      T.prev = d;
    }
    return fire;
  }

  // ─────────────────────────────────────────── the step
  step(inp: Input) {
    this.rt += DT;
    if (this.mode === 'clear') { this.clearT += DT; return; }
    if (this.mode === 'down') { this.downT += DT; if (this.downT > 1.8) this.retry(); return; }
    this.shake *= Math.pow(0.004, DT);
    if (this.stop > 0) {
      this.stop -= DT; const p = this.hero();
      if (inp.atkP) p.buf = 0.25; if (inp.jmpP) p.jbuf = 0.14; if (inp.tagP) this.tagQ = 0.2;
      this.dashTap(inp.mx);
      return;
    }
    if (this.tagQ > 0) { this.tagQ -= DT; if (!inp.tagP && this.tagCD <= 0) { inp = { ...inp, tagP: true }; this.tagQ = 0; } }
    this.t += DT; this.stats.time += DT; this.tagCD -= DT; this.wrongT -= DT; this.teachT -= DT;
    if (this.combo.t > 0) { this.combo.t -= DT; if (this.combo.t <= 0) { this.combo.n = 0; this.combo.chain = 0; } }
    const dash = this.dashTap(inp.mx);
    if (this.dblT >= 0) this.updDouble();
    else {
      if (inp.tagP && this.hero().st !== 'win') this.doTag(false);
      this.updHero(this.hero(), inp, dash);
    }
    if (this.partner().st === 'out') this.updWaiting(this.partner());
    for (const f of this.foes) this.updFoe(f);
    this.foes = this.foes.filter((f) => !f.dead);
    if (this.boss) this.updBoss();
    this.updItems(); this.updProps(); this.updStrings(); this.updBelt();
    if (this.scene.ride) this.rideX += (this.scene.ride === 'lift' ? 60 : 150) * DT;
    for (const k of this.ink) k.t += DT;
    this.ink = this.ink.filter((k) => k.t < k.life);
    this.updCamera(); this.updEvents();
    if (this.talk) { this.talk.t -= DT; if (this.talk.t <= 0) this.talk = null; }
    this.prompt = this.needPrompt();
  }

  // ─────────────────────────────────────────── heroes
  private updHero(p: Hero, inp: Input, dash: number) {
    const C = HC[p.name];
    p.t += DT; p.anim += DT; p.flash -= DT; p.inv -= DT; p.afterDash += DT; p.specCD -= DT;
    if (inp.atkP) { p.buf = 0.25; p.atkAgo = 0; } else { p.buf = Math.max(0, p.buf - DT); p.atkAgo += DT; }
    if (inp.jmpP) p.jbuf = 0.14; else p.jbuf = Math.max(0, p.jbuf - DT);
    if (inp.mx || inp.mz) { this.tut.lastMove = this.t; this.learned.move = 1; }
    const air = () => p.h > 0 || p.vh > 0;
    switch (p.st) {
      case 'tagin': this.updTagIn(p); return;
      case 'flopland': if (p.t > 0.22) this.setSt(p, 'idle'); return;
      case 'hurt': {
        p.x += p.vx * DT; p.vx *= Math.pow(0.02, DT);
        if (p.h > 0 || p.vh > 0) { p.vh -= GRAV * DT; p.h = Math.max(0, p.h + p.vh * DT); }
        if (p.t > 0.38 && p.h <= 0) this.setSt(p, 'idle');
        this.clampHero(p); return;
      }
      case 'down': {
        p.x += p.vx * DT; p.vx *= Math.pow(0.02, DT);
        if (p.h > 0 || p.vh > 0) { p.vh -= GRAV * DT; p.h = Math.max(0, p.h + p.vh * DT); }
        if (p.t > 0.6 && p.h <= 0) { this.setSt(p, 'getup'); p.inv = 0.8; }
        this.clampHero(p); return;
      }
      case 'getup': if (p.t > 0.3) this.setSt(p, 'idle'); return;
      case 'win': return;
      case 'heave': if (p.t > 0.5) this.setSt(p, 'idle'); return;
      case 'pick': if (p.t > 0.3) this.setSt(p, 'idle'); return;
      case 'land': if (p.t > p.landT) this.setSt(p, 'idle'); else { this.clampHero(p); if (p.jbuf <= 0 && p.buf <= 0) return; } break;
      case 'specland':
        if (p.t <= DT * 1.5 && this.specN >= 0) { if (this.stats.specialHits > this.specN) this.stats.specialLanded++; this.specN = -1; p.specCD = 0.5; }
        if (p.t > (p.name === 'dora' ? 0.32 : 0.4)) this.setSt(p, 'idle'); else return; break;
      case 'special': this.updSpecial(p); return;
      case 'throw': if (p.t > 0.3) this.setSt(p, 'idle'); else return; break;
      case 'grab': if (p.t > 0.14) this.setSt(p, 'hold'); else return; break;
      case 'dash': {
        p.x += p.dashDir * C.dash * DT; p.z += inp.mz * C.zs * 0.5 * DT;
        if (this.stats.dashes % 1 === 0 && p.t < DT * 1.5) this.ev({ k: 'dust', x: p.x, z: p.z, n: 3, size: 0.8 });
        this.ev({ k: 'trail', x: p.x, z: p.z, h: p.h, who: p.name });
        if (p.buf > 0) { p.buf = 0; this.startMove(p, p.name === 'dora' ? 'knee' : 'barge', inp); this.stats.dashAtks++; this.learned.dashAtk = 1; return; }
        if (p.jbuf > 0) { p.jbuf = 0; this.jump(p, true); this.clampHero(p); return; }
        if (p.t >= C.dashT) { this.setSt(p, 'idle'); p.afterDash = 0; }
        this.clampHero(p); return;
      }
    }
    // double-team when the Festival meter is full: Attack and Jump together
    if (this.fest >= 100 && this.partner().hp > 0 && ((inp.atkP && inp.jmpH) || (inp.jmpP && inp.atkH) || (inp.atkP && inp.jmpP))) { this.startDouble(); p.buf = 0; p.jbuf = 0; return; }

    if (p.st === 'atk') {
      const m = MOVES[p.mk];
      if (p.t < m.hit + 0.02) {
        // lunge, but stop at a body instead of walking through it
        let room = 1e9;
        for (const f of this.foes) { if (!this.hittable(f) || f.h > 60 || Math.abs(f.z - p.z) > 30) continue; const dx = (f.x - p.x) * p.face; if (dx > -10 && dx < room) room = dx; }
        if (this.boss && this.boss.st !== 'end') { const dx = (this.bossX() - p.x) * p.face; if (dx > -10 && dx < room) room = dx - 70; }
        const step = m.lunge * DT / (m.hit + 0.02) * (this.assist ? 1 : 0.8);
        if (room > 58) p.x += p.face * Math.min(step, room - 58);
      }
      if (p.t >= m.hit && !p.struck) { p.struck = true; this.strike(p, m); }
      // a double tap cancels the recovery of a ground attack into a dash
      if (dash && p.struck && p.t >= m.hit + 0.04 && m.chain < m.dur && p.h <= 0) { this.setSt(p, 'idle'); }
      else {
      if (p.buf > 0 && p.t >= m.chain && m.chain < m.dur) {
        const seq = p.name === 'dora' ? ['k1', 'k2', 'k3', 'k4'] : ['p1', 'p2', 'p3'];
        const i = seq.indexOf(p.mk);
        if (i >= 0) {
          p.buf = 0;
          if (p.name === 'enzo' && this.tryBossGrab(p)) return;   // the boss moments still work straight out of a combo
          this.startMove(p, seq[(i + 1) % seq.length], inp);
          if (inp.mx) p.face = sgn(inp.mx);
          return;
        }
      }
      if (p.t >= m.dur) this.setSt(p, 'idle');
      else { this.clampHero(p); return; }
      }
    }
    // dash: a double tap on the ground
    if (dash && p.h <= 0 && p.st !== 'hold' && (p.st === 'idle' || p.st === 'walk' || p.st === 'land')) {
      this.setSt(p, 'dash'); p.dashDir = dash; p.face = dash; this.stats.dashes++; this.learned.dash = (this.learned.dash || 0) + 1;
      this.sfx('dash'); this.ev({ k: 'dust', x: p.x - dash * 20, z: p.z, n: 5, size: 1 });
      return;
    }
    // move: immediate, no momentum
    const holding = p.st === 'hold';
    const mx = inp.mx, mz = inp.mz;
    const nrm = mx && mz ? 0.7071 : 1, slow = holding ? 0.78 : 1;
    if (p.st === 'airatk' && p.airKind === 'dive') { p.x += p.face * (p.name === 'dora' ? 330 : 120) * DT; p.z += mz * C.zs * 0.5 * DT; }
    else if (air() && p.djump) { p.x += p.dashDir * C.djx * DT; p.z += mz * C.zs * 0.6 * DT; }
    else if (p.st !== 'land') { p.x += mx * C.spd * nrm * slow * DT; p.z += mz * C.zs * nrm * slow * DT; if (mx) p.face = sgn(mx); }
    // jump (a jump straight after a dash keeps the dash's run-up)
    if (p.jbuf > 0 && !air() && !holding) this.jump(p, p.afterDash < 0.15);
    if (air()) {
      p.vh -= GRAV * (p.st === 'airatk' && p.airKind !== 'rise' ? 1.25 : 1) * DT; p.h += p.vh * DT;
      if (p.st === 'airatk') this.strike(p, MOVES[p.airKind]);
      if (p.h <= 0) {
        p.h = 0; p.vh = 0; this.sfx(p.name === 'enzo' ? 'landHeavy' : 'land'); this.ev({ k: 'dust', x: p.x, z: p.z, n: 3, size: 0.6 });
        const wasAtk = p.st === 'airatk';
        p.djump = false;
        this.setSt(p, 'land'); p.landT = p.name === 'enzo' ? 0.12 : 0.08;
        if (wasAtk && p.name === 'enzo') { this.shakeBy(5); this.ev({ k: 'dust', x: p.x, z: p.z, n: 8, size: 1.2 }); }
      } else if (p.st !== 'airatk') p.st = 'air';
    }
    // Enzo grabs by walking into something grabbable, but never while he's mashing Attack
    if (p.name === 'enzo' && (mx || mz) && !holding && !air() && (p.st === 'idle' || p.st === 'walk') && p.buf <= 0 && p.atkAgo > 0.35 && this.tryGrab(p, !mx)) return;
    // carrying a barrel onto one of Tanglejaw's holes jams it in
    if (holding && !air() && this.tryPlug(p, 60)) return;
    // attack
    if (p.buf > 0) {
      if (holding) { p.buf = 0; if (!this.tryPlug(p, 130)) this.doThrow(p); }
      else if (air() && p.djump && !p.airUsed && p.specCD <= 0) { p.buf = 0; this.startSpecial(p); return; }
      else if (air() && p.st !== 'airatk' && !p.airUsed) {
        p.buf = 0; p.st = 'airatk'; p.airUsed = true; p.hits = []; p.t = 0;
        p.airKind = p.name === 'enzo' ? 'hammer' : p.vh > 120 ? 'rise' : 'dive';
        if (p.airKind === 'dive' || p.airKind === 'hammer') p.vh = Math.min(p.vh, p.name === 'dora' ? -150 : -300);
        const tgt = this.nearestFoe(p, 220); if (tgt && !mx) p.face = sgn(tgt.x - p.x) || p.face;
        this.learned.air = (this.learned.air || 0) + 1; this.sfx('whoosh');
      } else if (!air() && p.st !== 'land') {
        p.buf = 0;
        if (!this.tryBossGrab(p) && !this.tryKickItem(p)) this.startMove(p, p.name === 'dora' ? 'k1' : 'p1', inp);
        this.learned.atk = (this.learned.atk || 0) + 1;
      }
    }
    // a barrel can be carried as long as you like in Tanglejaw's drydock (it's for his holes); anything else is thrown
    const plugging = this.boss?.kind === 'tanglejaw' && !!p.hold && !('ht' in p.hold) && (p.hold as Item).kind === 'barrel';
    if (holding && p.t > (this.assist ? 2.4 : 1.7) && !plugging) this.doThrow(p);
    if (!['airatk', 'atk', 'hold', 'grab', 'throw', 'land', 'dash', 'special', 'air'].includes(p.st)) p.st = (mx || mz) ? 'walk' : 'idle';
    if (p.hold && (p.st === 'idle' || p.st === 'walk')) p.st = 'hold';
    if (p.st === 'air' && !air()) p.st = 'idle';
    this.pickups(p);
    this.clampHero(p);
  }
  private setSt(p: Hero, st: HeroSt) { p.st = st; p.t = 0; if (st === 'idle') { p.struck = false; } }
  private jump(p: Hero, fromDash: boolean) {
    const C = HC[p.name];
    p.vh = C.jump * (fromDash ? 0.85 : 1); p.h = 1; p.jbuf = 0; p.airUsed = false; p.djump = fromDash; p.st = 'air'; p.t = 0;
    if (fromDash) { p.dashDir = p.dashDir || p.face; this.learned.djump = (this.learned.djump || 0) + 1; }
    this.stats.jumps++; this.sfx('jump'); this.ev({ k: 'dust', x: p.x, z: p.z, n: 3, size: 0.7 });
    this.learned.jump = (this.learned.jump || 0) + 1;
  }
  private startMove(p: Hero, key: string, inp: Input) {
    const m = MOVES[key];
    p.st = 'atk'; p.mk = key; p.t = 0; p.hits = []; p.struck = false;
    if (key === 'knee' || key === 'barge') p.face = p.dashDir || p.face;
    else {
      // assist turns you to the nearest foe and drifts you into its lane, so a mashed button lands
      const tgt = this.nearestFoe(p, 190);
      if (tgt) {
        if (!inp.mx) p.face = sgn(tgt.x - p.x) || p.face;
        if (this.assist) p.z += clamp(tgt.z - p.z, -22, 22);
      }
    }
    this.sfx(p.name === 'dora' ? 'whoosh' : 'whooshHeavy');
    this.ev({ k: 'swipe', x: p.x + p.face * 55, z: p.z, h: p.h + (m.y0 + m.y1) * 0.5, face: p.face, big: m.heavy ? 1.4 : 1, col: p.name === 'dora' ? '#fff6dc' : '#e8eef6' });
  }
  private startSpecial(p: Hero) {
    p.st = 'special'; p.t = 0; p.hits = []; p.airUsed = true; this.specN = this.stats.specialHits; p.face = p.dashDir || p.face;
    this.stats.specials++; this.learned.special = (this.learned.special || 0) + 1;
    if (p.name === 'dora') { p.vh = 120; this.sfx('comet'); }
    else { p.vh = 420; this.sfx('anchor'); }
    this.hitstop(0.05);
  }
  /** Dora's Comet Spin skims along the lane; Enzo's Anchor Drop arcs over and lands with a shockwave */
  private updSpecial(p: Hero) {
    const dir = p.face;
    if (p.name === 'dora') {
      p.x += dir * 640 * DT;
      p.vh -= 900 * DT; p.h = Math.max(30, p.h + p.vh * DT);
      this.ev({ k: 'trail', x: p.x, z: p.z, h: p.h + 60, who: 'dora' });
      this.specialSweep(p, 64, 2.2, 'kick3');
      if (p.t > 0.48 || this.atWall(p)) { p.h = 0; p.vh = 0; this.setSt(p, 'specland'); this.sfx('land'); this.ev({ k: 'dust', x: p.x, z: p.z, n: 6, size: 1 }); }
    } else {
      p.x += dir * 380 * DT;
      p.vh -= 2600 * DT; p.h += p.vh * DT;
      this.ev({ k: 'trail', x: p.x, z: p.z, h: p.h + 40, who: 'enzo' });
      if (p.vh < 0) this.specialSweep(p, 56, 1.6, 'punch');
      if (p.h <= 0) {
        p.h = 0; p.vh = 0; this.setSt(p, 'specland');
        this.shakeBy(13); this.hitstop(0.11); this.sfx('flop');
        this.ev({ k: 'shock', x: p.x, z: p.z, size: 200 }); this.ev({ k: 'dust', x: p.x, z: p.z, n: 16, size: 1.7 });
        for (const f of this.foes) {
          if (!this.hittable(f) || f.h > 70 || p.hits.includes(f)) continue;
          const dx = (f.x - p.x) / (this.assist ? 200 : 180), dz = (f.z - p.z) / 80;
          if (dx * dx + dz * dz < 1) { p.hits.push(f); this.stats.specialHits++; this.damageFoe(f, 2.6, { kb: sgn(f.x - p.x) * 340, down: true, heavy: true, by: 'enzo', x: f.x, h: 30, special: true }); }
        }
        if (this.boss && !p.hits.includes(this.boss) && Math.abs(this.bossX() - p.x) < 230) { p.hits.push(this.boss); this.damageBoss(2.4, 'enzo', p.x + 60, 40, true); }
        for (const pr of this.props) if (pr.alive && Math.abs(pr.x - p.x) < 150 && Math.abs(pr.z - p.z) < 60) this.hitProp(pr, p, true);
      }
    }
    this.clampHero(p);
  }
  private nearestFoe(p: Hero, range: number): { x: number; z: number } | null {
    let best: { x: number; z: number } | null = null, bd = range;
    for (const f of this.foes) { if (!this.hittable(f) || f.st === 'enter') continue; const d = Math.abs(f.x - p.x) + Math.abs(f.z - p.z) * 1.5; if (d < bd) { bd = d; best = f; } }
    const b = this.boss; if (!best && b && b.st !== 'end' && Math.abs(b.x - p.x) < range + 150) best = { x: b.x, z: b.z };
    return best;
  }
  private atWall(p: Hero) { return p.x <= this.camL + 42 || p.x >= this.camR - 72; }
  private specialSweep(p: Hero, zTol: number, dmg: number, snd: string) {
    for (const f of this.foes) {
      if (p.hits.includes(f) || !this.hittable(f)) continue;
      if (Math.abs(f.x - p.x) < 70 + f.rad * 0.5 && Math.abs(f.z - p.z) < zTol && f.h < p.h + 170 && f.h + f.ht > p.h - 20) {
        p.hits.push(f); this.stats.specialHits++;
        this.damageFoe(f, dmg, { kb: p.face * 380, down: true, heavy: true, by: p.name, x: f.x, h: p.h + 60, snd, special: true });
      }
    }
    const b = this.boss;
    if (b && !p.hits.includes(b) && b.st !== 'end' && Math.abs(this.bossX() - p.x) < 150 && Math.abs(b.z - p.z) < zTol + 50) {
      p.hits.push(b); this.damageBoss(2.4, p.name, p.x + p.face * 60, p.h + 80, true);
      if (p.name === 'dora') { p.x -= p.face * 30; this.setSt(p, 'specland'); p.h = 0; p.vh = 0; }
    }
    for (const pr of this.props) if (pr.alive && !p.hits.includes(pr) && pr.kind !== 'net' && Math.abs(pr.x - p.x) < 60 && Math.abs(pr.z - p.z) < zTol) { p.hits.push(pr); this.hitProp(pr, p, true); }
  }
  private updTagIn(p: Hero) {
    const chain = this.combo.chain;
    if (p.name === 'dora') {
      const k = Math.min(1, p.t / 0.24);
      p.x = p.tagFrom + (p.tagX - p.tagFrom) * k; p.h = 70 * Math.sin(Math.PI * (0.5 + k * 0.5)) + 8;
      for (const f of this.foes) if (!p.hits.includes(f) && this.hittable(f) && Math.abs(f.x - p.x) < 70 && Math.abs(f.z - p.z) < 50) {
        p.hits.push(f); this.damageFoe(f, 1.5 + 0.5 * chain, { kb: p.face * 280, down: true, heavy: true, by: 'dora', tag: true, daze: 1.6, x: f.x, h: Math.max(f.h + 30, 70), snd: 'kick3' });
      }
      const b = this.boss;
      if (b && !p.hits.includes(b) && Math.abs(this.bossX() - p.x) < 170 && b.st !== 'end') { p.hits.push(b); this.damageBoss(1.5 + 0.5 * chain, 'dora', p.x + 60, 110, true, true); }
      if (k >= 1) { this.setSt(p, 'land'); p.landT = 0.08; p.h = 0; this.ev({ k: 'dust', x: p.x, z: p.z, n: 4, size: 1 }); this.sfx('land'); }
    } else {
      const k = Math.min(1, p.t / 0.26);
      p.h = 360 * (1 - k * k);
      if (k >= 1) {
        p.h = 0; this.setSt(p, 'flopland');
        this.shakeBy(11); this.hitstop(0.09); this.sfx('flop'); this.ev({ k: 'dust', x: p.x, z: p.z, n: 14, size: 1.6 });
        this.ev({ k: 'ring', x: p.x, z: p.z, size: 170, col: '#fff1c8', life: 0.45 });
        for (const f of this.foes) {
          if (!this.hittable(f) || f.h > 60) continue;
          const dx = (f.x - p.x) / (this.assist ? 175 : 150), dz = (f.z - p.z) / 70;
          if (dx * dx + dz * dz < 1) this.damageFoe(f, 1.5 + 0.5 * chain, { kb: sgn(f.x - p.x) * 300, down: true, heavy: true, by: 'enzo', tag: true, daze: 2.4, x: f.x, h: 30 });
        }
        if (this.boss && Math.abs(this.bossX() - p.x) < 240 && this.boss.st !== 'end') this.damageBoss(1.5 + 0.5 * chain, 'enzo', p.x + 60, 40, true, true);
      }
    }
  }
  private clampHero(p: Hero) {
    p.z = clamp(p.z, 0, DEPTH);
    p.x = clamp(p.x, this.camL + 40, this.camR - 70);
    const b = this.boss;
    if (b && b.st !== 'end' && b.st !== 'gone' && !(b.kind === 'admiral' && b.h > 40)) {
      const bx = this.bossX(), r = BOSS_R[b.kind];
      if (Math.abs(p.z - b.z) < 60 && p.h < 120 && Math.abs(p.x - bx) < r) p.x = bx + (p.x < bx ? -r : r);
    }
    for (const pr of this.props) {
      if (!pr.alive || pr.kind === 'net') continue;
      const dx = p.x - pr.x, dz = p.z - pr.z, rx = 46, rz = 22;
      if (Math.abs(dx) < rx && Math.abs(dz) < rz && p.h < 50) {
        if (rx - Math.abs(dx) < (rz - Math.abs(dz)) * 1.6) p.x = pr.x + (dx < 0 ? -rx : rx); else p.z = pr.z + (dz < 0 ? -rz : rz);
      }
    }
    p.z = clamp(p.z, 0, DEPTH);
  }
  private updWaiting(q: Hero) {
    q.t += DT;
    q.edgeH = Math.max(0, q.edgeH - DT * 240);
    q.hp = Math.min(100, q.hp + (this.assist ? 1.2 : 0.6) * DT);   // resting heals, slowly
    if (!q.ready && q.hp >= 35) { q.ready = true; this.sfx('ready'); }
  }
  doTag(forced: boolean) {
    const p = this.hero(), q = this.partner();
    if (q.hp <= 0 || !q.ready) return false;
    if (!forced && (this.tagCD > 0 || p.st === 'tagin' || this.dblT >= 0 || p.st === 'special')) return false;
    if (p.hold) this.dropHold(p);
    const ex = this.camL + 30;
    const face = p.x >= this.cam ? -1 : 1;
    Object.assign(q, { st: 'tagin', t: 0, face: p.x >= ex + 60 ? 1 : -1, z: p.z, hits: [], vh: 0, vx: 0, inv: 0.3, airUsed: false, djump: false, buf: 0, jbuf: 0 });
    q.face = face === -1 && p.x > this.camR - 200 ? 1 : q.face;
    q.tagX = clamp(p.x + q.face * 26, this.camL + 50, this.camR - 50);
    if (q.name === 'dora') { q.tagFrom = ex; q.x = ex; q.h = 70; } else { q.x = q.tagX; q.h = 360; }
    this.ev({ k: 'dust', x: p.x, z: p.z, n: 6, size: 1 });
    Object.assign(p, { st: 'out', t: 0, hold: null, vx: 0, h: 0, edgeH: 60, ready: p.hp > 0 });
    this.active = q.name; this.tagCD = 0.9; this.stats.tags++;
    this.learned.tag = (this.learned.tag || 0) + 1;
    if (this.combo.t > 0 && this.combo.n > 0) {
      this.combo.chain++; this.stats.tagChains++; this.combo.t = 1.8;
      const amt = 12 + 4 * this.combo.chain; this.addFest(amt, q.tagX, q.z, 120);
      this.ev({ k: 'word', x: q.tagX, z: q.z, h: 220, text: `TAG ×${this.combo.chain}`, col: '#bfe8ff' });
      this.stats.score += 150 * this.combo.chain;
    }
    this.sfx('tag');
    return true;
  }
  private addFest(amt: number, x: number, z: number, h: number) {
    const was = this.fest;
    this.fest = Math.min(100, this.fest + amt);
    if (this.fest > was) this.ev({ k: 'fest', x, z, h, amt: this.fest - was });
    if (this.fest >= 100 && was < 100) { this.festFull = true; this.sfx('festFull'); if (!this.learned.dbl) this.hitstop(0.25); }
  }
  private startDouble() {
    this.dblT = 0; this.dblHit = false; this.fest = 0; this.stats.dbls++; this.learned.dbl = 1;
    const p = this.hero(), q = this.partner();
    if (p.hold) this.dropHold(p);
    p.st = 'atk'; p.mk = p.name === 'dora' ? 'k4' : 'p3'; p.t = 0; p.hits = []; p.struck = true;
    q.tagFrom = this.camL + 30; q.st = 'dbl'; q.t = 0; q.x = q.tagFrom; q.z = p.z;
    this.sfx('tag');
  }
  private updDouble() {
    this.dblT += DT;
    const d = this.dblT, q = this.partner(), p = this.hero();
    q.t += DT; p.t += DT;
    q.x = q.tagFrom + (p.x - 70 * p.face - q.tagFrom) * Math.min(1, d / 0.25); q.h = 120 * Math.sin(Math.PI * Math.min(1, d / 0.5)); q.z = p.z; q.face = p.face;
    if (d >= 0.25 - 1e-6 && !this.dblHit) {
      this.dblHit = true;
      this.ev({ k: 'flash', a: 0.4 }); this.shakeBy(14); this.hitstop(0.12); this.sfx('dbl');
      for (const f of this.foes) if (this.hittable(f) && f.x > this.camL - 20 && f.x < this.camR + 20) this.damageFoe(f, 4, { kb: sgn(f.x - p.x) * 420, down: true, heavy: true, by: 'dbl', x: f.x, h: 60, daze: 2 });
      if (this.boss && this.boss.st !== 'end') this.damageBoss(4, 'dbl', this.bossX() - 60, 120, true);
      this.ev({ k: 'sparks', x: p.x, z: p.z, h: 90, col: '#ffd27a', n: 40, big: 1.6 });
    }
    if (d > 0.6) { this.dblT = -1; q.st = 'out'; q.h = 0; q.edgeH = 40; this.setSt(p, 'idle'); }
  }

  // ─────────────────────────────────────────── grabbing, throwing, kicking things
  /** Attack beside a dizzy boss: the boss rule moments (rip the barrel, pin the Admiral, throw Knuckles) */
  private tryBossGrab(p: Hero): boolean {
    if (p.name !== 'enzo' || p.h > 5 || p.hold || !this.boss) return false;
    return this.bossGrab(p, this.assist ? 112 : 94, this.assist ? 42 : 30);
  }
  /** Enzo walks into a dazed foe, a shelled hermit, a puffed puffer, a lobster, a loose shell or a barrel and picks it up */
  private tryGrab(p: Hero, upDown = false): boolean {
    if (p.name !== 'enzo' || p.h > 5 || p.hold) return false;
    const reach = this.assist ? 84 : 72, zTol = this.assist ? 36 : 28;
    // walking up or down the deck into a barrel picks it up too (only barrels: foes are grabbed walking at them)
    if (upDown) {
      for (const pr of this.props) {
        if (!pr.alive || pr.kind !== 'barrel' || Math.abs(pr.x - p.x) > 40 || Math.abs(pr.z - p.z) > zTol) continue;
        pr.alive = false; const it = this.addItem('barrel', pr.x, pr.z, 0, 0, 0, pr.content === 'charm' ? pr.sid : ''); it.held = true; p.hold = it; this.setSt(p, 'grab'); this.sfx('grab'); this.stats.grabs++; return true;
      }
      for (const it of this.items) {
        if (it.kind !== 'barrel' || it.held || it.h > 20 || it.slide || Math.abs(it.x - p.x) > 40 || Math.abs(it.z - p.z) > zTol) continue;
        it.held = true; p.hold = it; this.setSt(p, 'grab'); this.sfx('grab'); this.stats.grabs++; return true;
      }
      return false;
    }
    let best: Foe | null = null, bd = 1e9;
    for (const f of this.foes) {
      if (!['idle', 'walk', 'wind', 'rec', 'daze', 'hurt', 'crash', 'down', 'up', 'puffed', 'block', 'tangled', 'whistle'].includes(f.st) || f.h > 40) continue;
      const grabbable = f.daze > 0 || f.st === 'crash' || f.st === 'tangled' || (f.kind === 'hermit' && f.shell) || (f.kind === 'puffer' && f.st === 'puffed') || (f.kind === 'lobster' && (f.st === 'block' || f.st === 'idle' || f.st === 'walk')) || (f.kind === 'urchin' && f.flipped);
      if (!grabbable) continue;
      if (f.st === 'down' && f.h > 5) continue;
      const dx = (f.x - p.x) * p.face, dz = Math.abs(f.z - p.z);
      if (dx < -10 || dx > reach || dz > zTol) continue;
      if (dx + dz < bd) { bd = dx + dz; best = f; }
    }
    if (!best) {
      // a loose shell or barrel on the deck
      for (const it of this.items) {
        if ((it.kind !== 'shell' && it.kind !== 'barrel') || it.held || it.h > 20 || it.slide) continue;
        const dx = (it.x - p.x) * p.face, dz = Math.abs(it.z - p.z);
        if (dx > -10 && dx < reach && dz < zTol) { it.held = true; p.hold = it; this.setSt(p, 'grab'); this.sfx('grab'); this.stats.grabs++; this.learned.grab = (this.learned.grab || 0) + 1; return true; }
      }
      for (const pr of this.props) {
        if (!pr.alive || pr.kind !== 'barrel') continue;
        const dx = (pr.x - p.x) * p.face, dz = Math.abs(pr.z - p.z);
        if (dx > -10 && dx < reach && dz < zTol) { pr.alive = false; const it = this.addItem('barrel', pr.x, pr.z, 0, 0, 0, pr.content === 'charm' ? pr.sid : ''); it.held = true; p.hold = it; this.setSt(p, 'grab'); this.sfx('grab'); this.stats.grabs++; return true; }
      }
      return false;
    }
    this.releaseToken(best);
    if (inHole(best)) { this.popEel(best); this.ev({ k: 'word', x: best.x, z: best.z, h: 140, text: 'YANKED!', col: '#e8eef6' }); }
    this.setSt(p, 'grab'); p.hold = best; best.st = 'held'; best.daze = 0; best.h = 0;
    if (best.kind === 'hermit' && best.shell) {
      best.shell = false; best.hp = Math.min(best.hp, 2);
      this.addItem('shell', best.x, best.z, 20, p.face * 160, 300);
      this.sfx('pop'); this.ev({ k: 'sparks', x: best.x, z: best.z, h: 50, col: '#c9d3df', n: 8, big: 1 });
      this.ev({ k: 'word', x: best.x, z: best.z, h: 130, text: 'POP!', col: '#e8eef6' });
    } else this.sfx('grab');
    if (best.kind === 'lobster') { best.blocks = 0; }
    this.stats.grabs++; this.learned.grab = (this.learned.grab || 0) + 1;
    this.hitstop(0.05); this.shakeBy(3);
    return true;
  }
  /** Dora kicks a loose shell or barrel along the deck; Enzo shoves fish-ice */
  private tryKickItem(p: Hero): boolean {
    if (p.h > 5) return false;
    if (p.name === 'dora') {
      for (const it of this.items) {
        if ((it.kind !== 'shell' && it.kind !== 'barrel') || it.held || it.h > 20 || it.slide) continue;
        const dx = (it.x - p.x) * p.face, dz = Math.abs(it.z - p.z);
        if (dx > -20 && dx < 90 && dz < 34) {
          it.slide = p.face * 720; it.hitList = []; it.t = 0;
          this.setSt(p, 'atk'); p.mk = 'k1'; p.struck = true; this.sfx('kick'); this.ev({ k: 'sparks', x: it.x, z: it.z, h: 20, col: '#fffbe6', n: 5, big: 0.8 });
          this.learned.kickItem = 1; return true;
        }
      }
    }
    return false;
  }
  private doThrow(p: Hero) {
    const h = p.hold; if (!h) return;
    p.hold = null; this.setSt(p, 'throw');
    if ('kind' in h && (h as Item).sid !== undefined && !('ht' in h)) {
      const it = h as Item; it.held = false; it.x = p.x + p.face * 40; it.z = p.z; it.h = 110; it.vx = p.face * 820; it.vh = 160; it.t = 0; it.hitList = []; it.spin = p.face * 14; it.slide = 0;
    } else {
      const f = h as Foe;
      f.st = 'thrown'; f.x = p.x + p.face * 40; f.z = p.z; f.h = 110; f.vx = p.face * 820; f.vh = 160; f.t = 0; f.spin = p.face * 14; f.hitList = [];
    }
    this.stats.throws++; this.learned.throw = (this.learned.throw || 0) + 1;
    this.sfx('throw'); this.shakeBy(3);
  }
  /** Enzo jams the barrel he's carrying into one of Tanglejaw's holes (at most two: he has to come out somewhere) */
  private tryPlug(p: Hero, range: number): boolean {
    const b = this.boss; const it = p.hold;
    if (!b || b.kind !== 'tanglejaw' || p.name !== 'enzo' || !it || 'ht' in it || (it as Item).kind !== 'barrel' || this.plugs() >= 2) return false;
    const out = ['strike', 'stretched', 'whipw', 'whip', 'sink'].includes(b.st);
    let best = -1, bd = 1e9;
    this.holes.forEach((h, i) => {
      if (h.plug || (out && i === b.hole)) return;
      const d = Math.abs(h.x - p.x) + Math.abs(h.z - p.z) * 1.5;
      if (Math.abs(h.x - p.x) < range && Math.abs(h.z - p.z) < 40 && d < bd) { bd = d; best = i; }
    });
    if (best < 0) return false;
    const h = this.holes[best], bar = it as Item;
    h.plug = true; bar.dead = true; bar.held = false; p.hold = null; this.setSt(p, 'throw');
    if (bar.sid) this.addItem('charm', h.x, h.z, 30, 0, 300, bar.sid);
    this.sfx('thunk'); this.shakeBy(5); this.hitstop(0.06); this.ev({ k: 'dust', x: h.x, z: h.z, n: 8, size: 1.2 });
    this.ev({ k: 'word', x: h.x, z: h.z, h: 130, text: this.plugs() >= 2 ? 'TWO PLUGGED!' : 'PLUGGED!', col: '#e8eef6' });
    this.learned.plug = (this.learned.plug || 0) + 1;
    if (b.hole === best && b.st === 'bubble') { b.st = 'bonk'; b.t = 0; this.sfx('boom'); this.ev({ k: 'word', x: h.x, z: h.z, h: 190, text: 'BONK!', col: '#fff0c8' }); }
    return true;
  }
  plugs() { return this.holes.filter((h) => h.plug).length; }
  /** Tanglejaw strikes out of the end holes towards the middle of the drydock (never into a wall), and out of the middle one towards you */
  private tjDir(i: number, p: Hero) { return i === 0 ? 1 : i === this.holes.length - 1 ? -1 : sgn(p.x - this.holes[i].x) || -1; }
  /** Tanglejaw's roar at a new phase blows the barrels out of his holes; they land nearby, ready to use again */
  private popPlugs() {
    for (const h of this.holes) if (h.plug) {
      h.plug = false;
      this.addItem('barrel', h.x, h.z, 40, h.x > this.cam ? -this.rr(60, 160) : this.rr(60, 160), 520);
      this.ev({ k: 'word', x: h.x, z: h.z, h: 150, text: 'POP!', col: '#e8eef6' }); this.ev({ k: 'dust', x: h.x, z: h.z, n: 8, size: 1.3 });
    }
    this.sfx('pop');
  }
  private dropHold(p: Hero) {
    const h = p.hold; p.hold = null; if (!h) return;
    if ('ht' in h) { const f = h as Foe; f.st = 'down'; f.t = 0; f.h = 60; f.vh = 100; f.vx = -p.face * 60; f.daze = 1.2; }
    else { const it = h as Item; it.held = false; it.h = 60; it.vh = 100; it.vx = 0; }
  }
  private pickups(p: Hero) {
    if (p.hold) return;
    for (const it of this.items) {
      if (it.dead || it.held || it.h > 30 || Math.abs(it.x - p.x) > 44 || Math.abs(it.z - p.z) > 30) continue;
      if (it.kind === 'snack' || it.kind === 'bun') {
        it.dead = true; const heal = it.kind === 'snack' ? 30 : 20; p.hp = Math.min(100, p.hp + heal); this.partner().hp = Math.min(100, this.partner().hp + heal / 2);
        this.sfx('eat'); this.stats.snacks++; this.ev({ k: 'word', x: p.x, z: p.z, h: 200, text: `+${heal}`, col: '#9cf28a' });
      } else if (it.kind === 'charm' || it.kind === 'scroll') {
        it.dead = true; this.found.add(it.sid); this.newFound.push(it.sid);
        this.setSt(p, 'pick'); this.sfx(it.kind === 'scroll' ? 'shanty' : 'charm');
        this.stats.score += 1000;
        this.ev({ k: 'word', x: p.x, z: p.z, h: 210, text: it.kind === 'scroll' ? 'SEA SHANTY!' : 'LANTERN CHARM!', col: '#ffd98a' });
        this.ev({ k: 'sparks', x: it.x, z: it.z, h: 40, col: '#ffd98a', n: 14, big: 1.2 });
      }
    }
  }

  // ─────────────────────────────────────────── combat
  /** knocked-down foes can't be hit until they're up again (no juggling a foe on the boards forever) */
  hittable(f: Foe) { if (f.st === 'duck') return false; if (f.st === 'down' && f.h <= 0 && f.vh <= 0) return false; if (f.st === 'up') return false; return !['ko', 'held', 'thrown', 'enter'].includes(f.st) || (f.st === 'enter' && f.x > this.camL && f.x < this.camR); }
  private inFront(a: { x: number; z: number; h: number; face: number }, t: { x: number; z: number; h: number; rad?: number; ht?: number }, reach: number, zTol: number, y0: number, y1: number) {
    const dx = (t.x - a.x) * a.face, rad = t.rad || 30;
    if (dx < -22 || dx > reach + rad * 0.6) return false;
    if (Math.abs(t.z - a.z) > zTol) return false;
    const a0 = a.h + y0, a1 = a.h + y1, t0 = t.h, t1 = t.h + (t.ht || 60);
    return a1 >= t0 && a0 <= t1;
  }
  private strike(p: Hero, m: Move) {
    const reach = m.reach * (this.assist ? 1.18 : 1), zTol = this.assist ? 34 : 24;
    let any = false;
    for (const f of this.foes) {
      if (p.hits.includes(f) || !this.hittable(f)) continue;
      if (!this.inFront(p, f, reach, zTol, m.y0, m.y1)) continue;
      p.hits.push(f); any = true;
      this.damageFoe(f, m.dmg, { kb: m.kb * p.face, down: m.down, heavy: m.heavy, by: p.name, x: f.x - p.face * 20, h: p.h + (m.y0 + m.y1) / 2 * 0.6, slam: m.slam, rise: m.key === 'rise', from: p.x });
    }
    if (this.goal?.kind === 'chase' && this.catchThief(p.x + p.face * reach * 0.5, p.z, p.h + m.y0, p.h + m.y1, reach * 0.5 + 40)) any = true;
    const b = this.boss;
    if (b && !p.hits.includes(b) && b.st !== 'end' && b.st !== 'intro' && b.st !== 'gone') {
      const bb = this.bossBox();
      if (this.inFront(p, bb, reach, zTol + 50, m.y0, m.y1)) { p.hits.push(b); any = true; this.damageBoss(m.dmg, p.name, p.x + p.face * 70, p.h + 90, !!m.heavy, false, m.key); }
    }
    for (const pr of this.props) {
      if (!pr.alive || p.hits.includes(pr)) continue;
      if (pr.kind === 'net') {
        // a hanging net is kicked down by an air kick or a high kick right under it
        if (p.name === 'dora' && Math.abs(pr.x - p.x - p.face * 30) < 70 && Math.abs(pr.z - p.z) < 40 && (p.h > 30 || m.key === 'k4' || m.key === 'k2')) { p.hits.push(pr); this.dropNet(pr); any = true; }
        continue;
      }
      if (this.inFront(p, { x: pr.x, z: pr.z, h: 0, rad: 30, ht: 60 }, reach, zTol, m.y0, m.y1)) { p.hits.push(pr); this.hitProp(pr, p, !!m.heavy); any = true; }
    }
    // a rolling barrel: Enzo's paws stop it dead (then it's his to carry); Dora's kicks just bounce off
    for (const c of this.rolls) {
      if (c.kind !== 'barrel' || c.t < c.tell || p.hits.includes(c)) continue;
      if (!this.inFront(p, { x: c.x, z: LANE_Z[c.lane], h: 0, rad: 34, ht: 60 }, reach + 30, zTol, m.y0, m.y1)) continue;
      p.hits.push(c); any = true;
      if (p.name === 'enzo') {
        this.addItem('barrel', c.x, LANE_Z[c.lane], 0, 0, 0); c.x = -1e9;
        this.sfx('thunk'); this.hitstop(0.06); this.ev({ k: 'word', x: p.x + p.face * 60, z: p.z, h: 150, text: 'STOPPED!', col: '#e8eef6' });
        this.learned.stop = (this.learned.stop || 0) + 1;
      } else this.wrong(c.x, LANE_Z[c.lane], 40, 'enzo');
    }
    if (any && m.shake) this.shakeBy(m.shake);
    if (m.slam && p.h <= 0) {
      // Enzo's slam ripples along the deck: it flips urchins and knocks the barnacles off a brute
      this.ev({ k: 'ring', x: p.x + p.face * 70, z: p.z, size: 120, col: '#e8eef6', life: 0.35 });
      for (const f of this.foes) if (f.kind === 'urchin' && !f.flipped && Math.abs(f.x - p.x - p.face * 70) < 110 && Math.abs(f.z - p.z) < 40 && this.hittable(f) && !p.hits.includes(f)) { p.hits.push(f); this.flipUrchin(f); }
    }
    return any;
  }
  private comboHit(heavy: boolean, x: number, z: number, h: number) {
    this.combo.n++; this.combo.t = 1.5; this.stats.hits++; this.stats.best = Math.max(this.stats.best, this.combo.n);
    this.stats.score += 10 * Math.min(20, this.combo.n) * (1 + this.combo.chain);
    this.addFest(heavy ? 3 : 2, x, z, h);
  }
  /** a "wrong hero" hit: a grey tink, a word over the target, and after two in a row the partner's portrait asks to tag */
  private wrong(x: number, z: number, h: number, want: HeroId) {
    this.stats.tinks++; this.stats.wrongHits++; this.tut.tinks++;
    this.ev({ k: 'tink', x, z, h, want }); this.sfx(want === 'enzo' ? 'tink' : 'flutter');
    this.wrongN = this.wrongT > 0 ? this.wrongN + 1 : 1; this.wrongT = 2.5;
  }
  damageFoe(f: Foe, dmg: number, o: { kb: number; down?: boolean; heavy?: boolean; by: HeroId | 'dbl' | 'item'; tag?: boolean; daze?: number; x: number; h: number; snd?: string; slam?: boolean; special?: boolean; rise?: boolean; from?: number }) {
    const d = FD[f.kind], dora = o.by === 'dora', enzo = o.by === 'enzo';
    const mult = 1 + 0.15 * Math.min(3, this.combo.chain);
    dmg *= mult;
    // the grey rule: a shelled hermit shrugs off kicks; only Enzo hits it properly
    if (f.kind === 'hermit' && f.shell && dora && !o.tag && !o.special) {
      f.hp -= dmg * 0.25; f.flash = 0.08; f.vx = o.kb * 0.25;
      this.wrong(o.x, f.z, o.h || 40, 'enzo'); this.hitstop(0.035); this.comboHit(false, f.x, f.z, 60);
      if (f.st === 'atk') { f.st = 'rec'; f.t = 0; }
      if (f.hp <= 0) this.koFoe(f, o.kb);
      return;
    }
    // an eel in its hole is Enzo's: his paws haul it out onto the boards (so do tags and thrown things); Dora's kicks
    // only make it duck, until it lunges and lies stretched out
    if (inHole(f) && f.st !== 'rec') {
      if (enzo || o.special || o.tag || o.by === 'item' || o.by === 'dbl') this.popEel(f);
      else {
        f.st = 'duck'; f.t = -0.2; f.flash = 0.08; this.releaseToken(f); this.wrong(o.x, f.z, 40, 'enzo'); this.hitstop(0.03);
        this.ev({ k: 'word', x: f.x, z: f.z, h: 90, text: 'DUCKED!', col: '#e8eef6' });
        return;
      }
    }
    // an inker up on its post: Enzo's paws don't reach it (his slam shakes the post, and a thrown thing knocks it off)
    if (perched(f) && enzo && !o.tag && !o.special && !o.slam) { this.wrong(o.x, f.z, f.h + 40, 'dora'); return; }
    // a lobster blocks from the front: go round the back, or let Enzo break the guard
    if (f.kind === 'lobster' && !o.tag && o.by !== 'dbl' && o.by !== 'item' && !(enzo && (o.heavy || o.special)) && ['idle', 'walk', 'block', 'wind', 'rec'].includes(f.st)) {
      const fromFront = o.from === undefined ? true : sgn((o.from ?? f.x) - f.x) === f.face;
      if (fromFront) {
        f.st = 'block'; f.t = 0; f.blocks++; f.flash = 0.06;
        this.wrong(o.x, f.z, (o.h || 60), 'enzo'); this.hitstop(0.03);
        if (f.blocks >= 3) { f.blocks = 0; f.st = 'atk'; f.t = 0; f.didHit = false; f.ctr = true; this.sfx('whoosh'); }   // the counter
        return;
      }
    }
    // a puffed puffer is all spines: kicks hurt the kicker
    if (f.kind === 'puffer' && f.st === 'puffed' && dora && !o.tag && !o.special) {
      this.wrong(o.x, f.z, 50, 'enzo'); const p = this.hero();
      if (p.name === 'dora' && Math.abs(p.x - f.x) < 140) this.hurtHero(p, this.punish(5), f.x, 200);
      return;
    }
    // an urchin on its feet is all spines too, unless you come down on it from above or flip it with a slam
    if (f.kind === 'urchin' && !f.flipped && !o.tag && o.by !== 'dbl' && o.by !== 'item') {
      const p = this.hero();
      if (o.slam || o.special || (p.h > 30 && dora)) { this.flipUrchin(f); if (!o.special) return; }
      else {
        this.wrong(o.x, f.z, 40, 'dora');
        if (Math.abs(p.x - f.x) < 140 && p.h < 30) this.hurtHero(p, this.punish(6), f.x, 220);
        return;
      }
    }
    // a charged jelly zaps whoever touches it from the deck
    if (f.kind === 'jelly' && (f.st === 'charge' || f.st === 'zap') && !o.tag && o.by !== 'item' && o.by !== 'dbl') {
      const p = this.hero();
      if (p.h < 40 && !o.special) {
        this.ev({ k: 'zap', x: f.x, z: f.z, h: f.h + 40 }); this.sfx('zap'); this.hurtHero(p, this.punish(7), f.x, 260); this.wrongN++; this.wrongT = 2.5;
        return;
      }
    }
    // gulls and jellies up high: only Dora's kicks reach; Enzo's paws whiff
    if ((flier(f) || f.kind === 'jelly') && f.h > 40 && enzo && !o.tag && !o.special) { this.wrong(o.x, f.z, f.h + 40, 'dora'); return; }
    f.hp -= dmg; f.flash = 0.1; this.comboHit(!!o.heavy, f.x, f.z, f.h + 60);
    if (f.h > 40 && dora) this.stats.airHits++;
    const col = o.by === 'enzo' ? '#fff3d6' : '#fffbe6';
    this.ev({ k: 'sparks', x: o.x, z: f.z, h: Math.max(20, o.h || 50), col: o.heavy ? '#ffd27a' : col, n: o.heavy ? 11 : 7, big: o.heavy ? 1.3 : 1 });
    this.sfx(o.snd || (o.by === 'enzo' ? (o.heavy ? 'slam' : 'punch') : (o.heavy ? 'kick3' : 'kick')));
    this.hitstop(o.heavy ? 0.085 : 0.05); this.shakeBy(o.heavy ? 6 : 2.5);
    if (f.st === 'wind' || f.st === 'atk' || f.st === 'charge' || f.st === 'whistle') this.releaseToken(f);
    if (f.kind === 'shrimp' && f.st === 'whistle') f.callT = -99;   // stopped in time
    if (f.hp <= 0) { this.koFoe(f, o.kb); return; }
    if (perched(f)) { this.knockOff(f, o.kb); return; }
    if (inHole(f)) { if (o.down) this.popEel(f); else return; }   // a stretched-out eel just flinches, unless the hit knocks it out of the hole
    if (d.dazeAt && f.hp <= d.dazeAt && !f.dazedOnce) { f.daze = this.assist ? 2.6 : 2; f.dazedOnce = true; }
    if (o.daze) f.daze = Math.max(f.daze, o.daze);
    // committed attacks of the heavy foes have armour: they take the damage but don't flinch from light hits
    const armoured = (f.kind === 'lobster' && (f.st === 'wind' || f.st === 'atk')) || ((f.kind === 'hermit' || f.kind === 'urchin') && f.st === 'roll') || (f.kind === 'puffer' && f.st === 'atk');
    if (armoured && !o.heavy && !o.down && o.by !== 'dbl') { this.ev({ k: 'word', x: f.x, z: f.z, h: f.ht + 40, text: 'ARMOUR!', col: '#ffb48a' }); return; }
    f.vx = o.kb; f.t = 0;
    if (f.kind === 'puffer' && dora && f.st !== 'puffed' && !o.down) { f.st = 'puffed'; f.puffT = this.assist ? 3.4 : 2.6; f.h = 0; this.sfx('puff'); return; }
    if (f.kind === 'puffer' && f.st === 'puffed') { f.vx = o.kb * 0.6; return; }
    if (f.kind === 'jelly') { f.st = 'hurt'; f.charge = 0; if (o.down) { f.st = 'down'; f.vh = 200; } return; }
    if (flier(f) && f.h > 40 && o.rise) { f.st = 'crash'; f.daze = this.assist ? 1.8 : 1.3; f.vh = 0; this.releaseToken(f); return; }
    if (o.down) { f.st = 'down'; f.vh = 380; f.h = Math.max(f.h, 1); }
    else { f.st = 'hurt'; if (flier(f) && f.h > 20) f.vh = 60; }
  }
  private flipUrchin(f: Foe) {
    f.flipped = true; f.st = 'down'; f.t = 0; f.vh = 300; f.h = Math.max(1, f.h); f.daze = this.assist ? 3.2 : 2.4; this.releaseToken(f);
    this.sfx('flip'); this.ev({ k: 'word', x: f.x, z: f.z, h: 110, text: 'FLIPPED!', col: '#fffbe6' }); this.hitstop(0.05);
  }
  private koFoe(f: Foe, kb: number) {
    this.releaseToken(f); this.ink = this.ink.filter((k) => k.by !== f.id);
    f.st = 'ko'; f.t = 0; f.vx = clamp(kb * 0.7, -260, 260) || this.rr(-80, 80); f.vh = 640; f.h = Math.max(1, f.h);
    f.vz = -(f.z + 40) / 0.9; f.spin = sgn(f.vx) * this.rr(8, 14);
    this.shakeBy(5); this.hitstop(0.07); this.stats.kos++; this.stats.score += FD[f.kind].score;
    if (f.lantern >= 0) { this.lanternFly(f.x, f.z, f.h + 40, f.lantern); f.lantern = -1; }
    // health drops often, more often when you're hurt
    const p = this.hero();
    if (this.rnd() < (p.hp < 50 ? 0.22 : 0.08)) this.addItem(this.rnd() < 0.5 ? 'snack' : 'bun', clamp(f.x, this.camL + 60, this.camR - 80), clamp(f.z, 10, DEPTH - 10), 40, 0, 200);
  }
  private lanternFly(x: number, z: number, h: number, si: number) {
    const s = this.strings[si]; if (!s) return;
    const slot = Math.min(s.need - 1, s.got + s.flying);
    s.flying++;
    this.ev({ k: 'lantern', si, slot, x, z, h });
    this.flies.push({ si, t: 0 });
  }
  private flies: { si: number; t: number }[] = [];
  private updStrings() {
    for (const f of this.flies) {
      f.t += DT;
      if (f.t >= 0.9) { const s = this.strings[f.si]; if (!s) continue; s.flying--; s.got = Math.min(s.need, s.got + 1); s.pulse = 1; this.sfx('chime'); this.stats.lanterns++; this.stats.score += 300; }
    }
    this.flies = this.flies.filter((f) => f.t < 0.9);
    for (const s of this.strings) { s.glow += (s.got / s.need - s.glow) * Math.min(1, DT * 3); s.pulse = Math.max(0, s.pulse - DT * 1.5); }
  }
  /** the hits that punish mashing (a lobster's counter, spines, a charged jelly) bite harder in the Fish Market with assist
   *  on, and harder still with every wrong hit in a row: a masher who ignores the tink and the tag prompt sometimes needs
   *  a retry there, while players who read the foes (or tag when it tinks) barely notice. Once a hero is knocked out, or
   *  after a retry, it eases off for the rest of the stage, so nobody gets stuck on it */
  private punish(dmg: number) { return this.assist && this.area() >= 2 && this.stats.retries === 0 && (!MERCY_KO || !this.koOnce) ? dmg * Math.min(PUNISH_CAP, 1 + PUNISH * Math.max(0, (this.wrongT > 0 ? this.wrongN : 0) - 1)) : dmg; }
  hurtHero(p: Hero, dmg: number, fromX: number, kb = 260, heavy = false) {
    if (p.inv > 0 || p.st === 'tagin' || p.st === 'out' || this.mode !== 'play' || this.dblT >= 0 || p.st === 'special' || p.st === 'down' || p.st === 'getup') return false;
    dmg *= this.assist ? 0.6 * [1, 1.25, 1.6][this.tier()] : [1, 1.6, 1.75][this.tier()];
    p.hp = Math.max(0, p.hp - dmg); this.stats.dmg += dmg;
    if (p.hold) this.dropHold(p);
    this.setSt(p, heavy ? 'down' : 'hurt'); p.vx = sgn(p.x - fromX) * kb; p.inv = 0.8; p.flash = 0.12; p.djump = false;
    if (p.h > 0 || heavy) p.vh = heavy ? 300 : 200;
    this.shakeBy(6); this.hitstop(0.06); this.sfx('ouch'); this.ev({ k: 'sparks', x: p.x, z: p.z, h: p.h + 90, col: '#ff8a6a', n: 8, big: 1 });
    this.combo.n = 0; this.combo.t = 0; this.combo.chain = 0;
    if (p.hp <= 0) {
      this.koOnce = true;
      const q = this.partner();
      if (q.hp > 0 && q.ready) { p.ready = false; this.doTag(true); }
      else { this.mode = 'down'; this.downT = 0; this.sfx('downed'); }
    }
    return true;
  }
  private retry() {
    this.stats.retries++;
    this.mode = 'play';
    for (const k of ['dora', 'enzo'] as HeroId[]) Object.assign(this[k], { hp: 70, st: 'out', h: 0, vh: 0, hold: null, inv: 1.5, ready: true });
    this.active = 'dora'; Object.assign(this.dora, { st: 'idle', x: this.cam - VIEW_W * 0.25, z: 80, t: 0 });
    this.foes = []; this.tokens = 0; this.items = this.items.filter((i) => i.kind === 'charm' || i.kind === 'scroll');
    this.combo = { n: 0, t: 0, chain: 0 };
    if (this.wave) { this.wave.group = 0; this.wave.groupT = 0; this.wave.t = 0; this.wave.called = false; this.wave.carriers = 0; }
    if (this.boss) {
      const b = this.boss;
      Object.assign(b, { st: 'idle', t: 0, x: this.camR - 150, z: 80, h: b.kind === 'admiral' ? 160 : 0, vh: 0, pinned: 0, hurtT: 0, armour: b.kind === 'brute' ? 3 : 0 });
      b.hp = Math.min(b.max, b.hp + b.max * 0.15);   // he catches his breath, but keeps most of the damage
    }
    if (this.tut.stage < 9) this.tut.stage = Math.max(1, this.tut.stage);
    const G = this.goal;
    if (G && !G.done) {
      G.groupT = 0;
      if (G.kind === 'defend') { G.t = Math.max(0, G.t - 10); G.hp = Math.max(G.hp, G.max * 0.4); if (G.st === 'broken') G.st = 'ok'; }
      if (G.kind === 'ride') G.group = Math.max(0, G.group - 1);
      if (G.kind === 'tide') G.front = this.camL - 200;
    }
  }

  // ─────────────────────────────────────────── foes
  spawnFoe(kind: FoeKind, side: number, o: Partial<Foe> = {}): Foe {
    const d = FD[kind];
    const f: Foe = {
      id: this.nid++, kind, hp: d.hp * [1, 1.15, 1.3][this.tier()], max: d.hp * [1, 1.15, 1.3][this.tier()], rad: d.rad, ht: d.ht, x: side > 0 ? this.camR + 70 : this.camL - 70, z: this.rr(15, DEPTH - 15),
      h: d.fly ? 150 : kind === 'jelly' ? 70 : 0, vh: 0, vx: 0, vz: 0, face: -side, st: 'enter', t: 0, cd: this.rr(0.4, 1.2), flash: 0, daze: 0,
      anim: this.rnd() * 3, shell: kind === 'hermit', lantern: -1, tok: false, script: '', side, zoff: this.rr(-18, 18), spin: 0, hitList: [],
      didHit: false, tx: 0, tz: 0, dead: false, splashed: false, blocks: 0, puffT: 0, callT: 3, called: false, lane: -1, dazedOnce: false,
      flipped: false, charge: 0, stole: false, loose: false, ...o,
    };
    if (f.lane >= 0) f.z = LANE_Z[f.lane];
    const p = this.hero();
    if (kind === 'eel') {
      // it comes up through the planks near you, in your lane or the next, never right under you
      const s = side > 0 ? 1 : -1, lane = f.lane >= 0 ? f.lane : clamp(this.laneOf(p.z) + Math.floor(this.rr(-1, 2)), 0, 4);
      f.x = clamp(p.x + s * this.rr(150, 290), this.camL + 80, this.camR - 80); f.z = LANE_Z[lane];
      for (const o2 of this.foes) if (o2.kind === 'eel' && !o2.loose && Math.abs(o2.tx - f.x) < 90 && Math.abs(o2.tz - f.z) < 30) f.x = clamp(f.x - s * 140, this.camL + 80, this.camR - 80);
      f.tx = f.x; f.tz = f.z; f.st = 'duck'; f.t = -0.4; f.face = sgn(p.x - f.x) || -1;
    } else if (kind === 'cormorant') f.h = 200;
    else if (kind === 'octo') {
      // it drops onto a scaffold post at the back of the deck
      f.x = side > 0 ? this.camR - this.rr(90, 230) : this.camL + this.rr(90, 230); f.z = this.rr(6, 34); f.h = 330;
      f.tx = f.x; f.tz = f.z; f.face = sgn(p.x - f.x) || -1;
    }
    this.foes.push(f);
    return f;
  }
  area() { return STAGES[this.stageId].area; }
  /** how hard the district is: 0 Lantern Quay, 1 the Fish Market, 2 the Ropewalk and Shipyard */
  private tier() { return Math.min(2, this.area() - 1); }
  private laneOf(z: number) { let best = 0; LANE_Z.forEach((lz, i) => { if (Math.abs(lz - z) < Math.abs(LANE_Z[best] - z)) best = i; }); return best; }
  private maxTokens() { return this.stageId === '1-1' && this.sceneI === 0 ? 1 : this.stageId === '1-1' ? (this.assist ? 1 : 2) : this.area() >= 2 && !this.assist ? 3 : 2; }
  private takeToken(f: Foe) { if (f.tok) return true; if (this.tokens >= this.maxTokens()) return false; this.tokens++; f.tok = true; return true; }
  private releaseToken(f: Foe) { if (f.tok) { f.tok = false; this.tokens = Math.max(0, this.tokens - 1); } }
  private updFoe(f: Foe) {
    const d = FD[f.kind], p = this.hero(), slowW = this.assist ? 1.4 : 1;
    f.t += DT; f.anim += DT; f.flash -= DT; f.cd -= DT;
    if (f.daze > 0 && !['held', 'thrown', 'ko', 'down'].includes(f.st)) f.daze -= DT;
    const out = p.st === 'out';
    switch (f.st) {
      case 'enter': {
        if (f.kind === 'octo') {
          f.h -= 520 * DT; f.face = sgn(p.x - f.x) || f.face;
          if (f.h <= POST_H) { f.h = POST_H; f.st = 'perch'; f.t = 0; f.cd = this.rr(0.8, 1.8); this.sfx('land'); }
          break;
        }
        // leaping aboard a ride from the water
        if (f.script === 'board') { f.h = f.t < 0.7 ? Math.sin(f.t / 0.7 * Math.PI) * 130 : 0; if (f.t >= 0.7) f.script = ''; }
        const tx = clamp(f.x, this.camL + 70, this.camR - 70);
        if (flier(f)) { f.x += sgn(tx - f.x) * d.spd * DT; f.h += ((f.kind === 'cormorant' ? 190 : 130) - f.h) * DT * 2; }
        else f.x += sgn(tx - f.x) * d.spd * 1.1 * DT;
        if (f.lane < 0) f.face = sgn(p.x - f.x); else f.face = sgn(tx - f.x) || f.face;
        if (Math.abs(tx - f.x) < 8) { f.st = flier(f) ? 'hover' : 'idle'; f.t = 0; if (f.lane >= 0) f.cd = 2.2 + this.rnd(); }
        break;
      }
      case 'idle': case 'walk': {
        if (inHole(f)) { this.eelPeek(f, p, out); break; }
        if (f.daze > 0) { f.st = 'daze'; break; }
        if (f.script === 'thief') { this.thief(f); break; }
        if (f.script === 'raid' && this.raid(f)) break;
        if (f.kind === 'shrimp' && !f.called && f.callT > 0) { f.callT -= DT; if (f.callT <= 0) { f.st = 'whistle'; f.t = 0; this.sfx('whistleUp'); break; } }
        if (f.kind === 'jelly') { this.jellyDrift(f, p); break; }
        if (f.lane >= 0 && f.t < 1.6 && f.cd > 0) { f.st = 'idle'; f.face = sgn(p.x - f.x); break; }   // a line of crabs holds its line for a moment
        let side = sgn(f.x - p.x) || 1;
        if (p.x + side * d.reach > this.camR - 30 || p.x + side * d.reach < this.camL + 30) side = -side;
        let tx: number, tz = p.z + f.zoff * 0.3, want = false;
        if (f.cd <= 0 && !out && f.kind !== 'shrimp' && this.takeToken(f)) { tx = p.x + side * d.reach * 0.8; want = true; tz = p.z; }
        else if (f.kind === 'shrimp') { tx = p.x + side * 300; tz = DEPTH - f.z > 80 ? DEPTH - 10 : 10; }
        else { tx = p.x + side * (190 + (f.zoff + 18) * 2); tz = p.z + f.zoff * 2.5; }
        const dx = tx - f.x, dz = tz - f.z;
        const sp = d.spd * (want ? 1 : 0.55);
        f.x += clamp(dx, -sp * DT, sp * DT); f.z += clamp(dz, -d.zs * DT, d.zs * DT); f.z = clamp(f.z, 0, DEPTH);
        f.st = Math.abs(dx) > 6 || Math.abs(dz) > 6 ? 'walk' : 'idle';
        f.face = sgn(p.x - f.x);
        if (want && Math.abs(dx) < 16 && Math.abs(p.z - f.z) < 16 && p.h < 60) {
          f.st = 'wind'; f.t = 0;
          if (f.kind === 'urchin') this.sfx('urchinTell');
          if (f.kind === 'lobster') this.sfx('lobsterTell');
        }
        break;
      }
      case 'wind':
        if (flier(f)) break;
        if (inHole(f)) { if (f.t > d.wind * slowW) { f.st = 'atk'; f.t = 0; f.didHit = false; this.sfx('whoosh'); } break; }
        if (perched(f)) { f.h = POST_H; if (f.t > d.wind * slowW) { f.st = 'squirt'; f.t = 0; this.squirt(f, p); } break; }
        if (f.kind === 'hermit' || f.kind === 'urchin') f.face = sgn(p.x - f.x);
        if (f.t > d.wind * slowW) {
          f.st = f.kind === 'hermit' || f.kind === 'urchin' ? 'roll' : 'atk'; f.t = 0; f.didHit = false;
          if (f.kind === 'crab' || f.kind === 'lobster' || f.kind === 'shrimp') this.sfx('whoosh');
          if (f.kind === 'puffer') this.sfx('bump');
        }
        break;
      case 'atk': {
        if (inHole(f)) {
          // the lunge: low along the boards out of the hole; jump it or step out of the lane
          const ext = Math.min(1, f.t / 0.15) * d.reach; f.x = f.tx + f.face * ext;
          if (!f.didHit && f.t > 0.03) {
            const lo = Math.min(f.tx, f.x) - 30, hi = Math.max(f.tx, f.x) + 30;
            if (p.x > lo && p.x < hi && Math.abs(p.z - f.z) < 26 && p.h < 45 && !out) { f.didHit = true; this.hurtHero(p, d.dmg, f.tx, 300); }
          }
          if (f.t > d.atk) { f.st = 'rec'; f.t = 0; f.daze = this.assist ? 1.8 : 1.3; this.releaseToken(f); }
          break;
        }
        const lunge = f.kind === 'lobster' ? 200 : f.kind === 'puffer' ? 320 : 260;
        if (f.t < 0.08) f.x += f.face * lunge * DT;
        if (!f.didHit && f.t > 0.04) { f.didHit = true; if (this.inFront(f, p, d.reach * (this.assist ? 0.9 : 1), 22, 0, 60)) this.hurtHero(p, f.script === 'weak' ? 4 : f.ctr ? this.punish(d.dmg) : d.dmg, f.x, f.kind === 'lobster' ? 340 : 260); }
        if (f.t > d.atk) { f.st = 'rec'; f.t = 0; f.ctr = false; }
        break;
      }
      case 'roll':
        f.x += f.face * (f.kind === 'urchin' ? 380 : 430) * DT;
        if (!f.didHit && Math.abs(p.x - f.x) < 55 && Math.abs(p.z - f.z) < 26 && p.h < 40) { f.didHit = true; this.hurtHero(p, d.dmg, f.x, 330); }
        for (const o of this.foes) if (f.kind === 'urchin' && o !== f && !f.hitList.includes(o) && this.hittable(o) && o.kind !== 'urchin' && Math.abs(o.x - f.x) < 50 && Math.abs(o.z - f.z) < 24) { f.hitList.push(o); this.damageFoe(o, 1.5, { kb: f.face * 300, down: true, by: 'item', x: o.x, h: 30 }); }
        if (f.t > d.atk || f.x < this.camL + 20 || f.x > this.camR - 20) { f.st = 'rec'; f.t = 0; f.hitList = []; f.x = clamp(f.x, this.camL + 20, this.camR - 20); }
        break;
      case 'rec':
        // a stretched-out eel lies tired on the boards: anyone can hit it, and Enzo can walk in and yank it out
        if (inHole(f)) { if (f.t > (this.assist ? 1.8 : 1.3)) { f.st = 'duck'; f.t = 0; f.x = f.tx; f.daze = 0; f.cd = d.cd + this.rr(0, 1); } break; }
        if (f.t > d.rec) { f.st = 'idle'; f.t = 0; f.cd = (d.cd + this.rr(0, 0.8)) * [1, 0.75, 0.72][this.tier()] + (this.stageId === '1-1' ? 1.2 : 0); this.releaseToken(f); }
        break;
      case 'block':
        f.face = sgn(p.x - f.x);
        if (f.t > 0.5) { f.st = 'idle'; f.t = 0; }
        break;
      case 'hurt':
        f.x += f.vx * DT; f.vx *= Math.pow(0.01, DT);
        if (flier(f)) { f.vh -= 300 * DT; f.h = Math.max(f.h > 20 ? 30 : 0, f.h + f.vh * DT); }
        if (f.t > 0.34) { f.st = flier(f) && f.h > 20 ? 'hover' : f.daze > 0 ? 'daze' : 'idle'; f.t = 0; f.cd = Math.max(f.cd, 0.5); if (f.kind === 'jelly') f.h = Math.max(f.h, 60); }
        break;
      case 'down':
        f.x += f.vx * DT; f.vx *= Math.pow(0.05, DT);
        if (f.h > 0 || f.vh > 0) { f.vh -= GRAV * DT; f.h += f.vh * DT; if (f.h <= 0) { f.h = 0; f.vh = 0; this.ev({ k: 'dust', x: f.x, z: f.z, n: 4, size: 1 }); f.t = 0; } }
        else if (f.t > (this.assist ? 1.0 : 0.75) + (f.flipped ? 1.2 : 0)) { f.st = 'up'; f.t = 0; }
        break;
      case 'up':
        if (f.t > 0.3) { f.flipped = false; f.st = f.daze > 0 ? 'daze' : flier(f) ? 'lift' : 'idle'; f.t = 0; f.cd = Math.max(f.cd, 0.6); if (f.kind === 'jelly') f.h = 70; }
        break;
      case 'daze': case 'tangled':
        if (f.daze <= 0) { f.st = flier(f) ? 'lift' : 'idle'; f.t = 0; }
        break;
      case 'puffed':
        f.x += f.vx * DT; f.vx *= Math.pow(0.05, DT);
        f.puffT -= DT;
        if (Math.abs(p.x - f.x) < 50 && Math.abs(p.z - f.z) < 24 && p.h < 40 && p.name === 'dora' && f.t > 0.3 && !f.didHit) { f.didHit = true; this.hurtHero(p, 5, f.x, 220); }
        if (f.puffT <= 0) { f.st = 'idle'; f.t = 0; f.didHit = false; this.sfx('deflate'); }
        break;
      case 'whistle':
        f.face = sgn(p.x - f.x);
        if (f.t > (this.assist ? 1.4 : 1.0)) {
          f.called = true; f.st = 'flee'; f.t = 0; this.sfx('whistle');
          const call = this.wave?.def.call;
          if (call && !this.wave!.called) { this.wave!.called = true; this.spawnGroup(call[0], -1); this.ev({ k: 'word', x: f.x, z: f.z, h: 120, text: 'BACKUP!', col: '#ffb48a' }); }
        }
        break;
      case 'flee':
        f.x += sgn(f.x - p.x) * d.spd * DT; f.face = sgn(f.x - p.x);
        if (f.x < this.camL - 40 || f.x > this.camR + 40) { f.dead = true; this.releaseToken(f); if (f.lantern >= 0) { this.lanternFly(f.x, f.z, 80, f.lantern); f.lantern = -1; } }
        break;
      case 'charge':
        if (f.t > d.wind * slowW) { f.st = 'zap'; f.t = 0; f.didHit = false; this.sfx('zap'); this.ev({ k: 'zap', x: f.x, z: f.z, h: f.h + 40 }); }
        break;
      case 'zap':
        if (!f.didHit && Math.abs(p.x - f.x) < 95 && Math.abs(p.z - f.z) < 40 && p.h < f.h + 80) { f.didHit = true; this.hurtHero(p, d.dmg, f.x); }
        if (f.t > d.atk) { f.st = 'rec'; f.t = 0; }
        break;
      case 'hover': {
        if (f.daze > 0) { f.st = 'crash'; f.t = 0; break; }
        const side = sgn(f.x - p.x) || 1, corm = f.kind === 'cormorant';
        const tx = clamp(p.x + side * (corm ? 170 : 150), this.camL + 60, this.camR - 60), tz = clamp(p.z - 10, 0, DEPTH);
        f.x += clamp(tx - f.x, -d.spd * 0.6 * DT, d.spd * 0.6 * DT); f.z += clamp(tz - f.z, -d.zs * DT, d.zs * DT);
        f.h += ((corm ? 185 : 125) + Math.sin(f.anim * 3) * 10 - f.h) * DT * 3;
        f.face = sgn(p.x - f.x);
        const calm = f.script === 'calm' && this.tut.t < 4.5;
        if (!calm && f.cd <= 0 && !out && this.takeToken(f)) { f.st = 'wind'; f.t = 0; this.sfx('tell'); }
        break;
      }
      case 'dive': break;
      case 'crash':
        if (f.t > (this.assist ? 1.8 : 1.2) + (f.kind === 'cormorant' ? 0.6 : 0)) { f.st = 'lift'; f.t = 0; f.daze = 0; }
        if (f.h > 0) { f.vh -= GRAV * DT; f.h = Math.max(0, f.h + f.vh * DT); }
        break;
      case 'lift':
        f.h += 260 * DT; if (f.h > 110) { f.st = 'hover'; f.t = 0; f.cd = d.cd + this.rr(0, 1); }
        break;
      case 'perch':
        // up on its post at the back: it puffs, then squirts ink across the screen
        f.face = sgn(p.x - f.x) || f.face; f.h = POST_H; f.x = f.tx; f.z = f.tz;
        if (f.cd <= 0 && !out && this.takeToken(f)) { f.st = 'wind'; f.t = 0; this.sfx('tell'); }
        break;
      case 'squirt':
        if (f.t > 0.45) { f.st = 'perch'; f.t = 0; f.cd = d.cd + this.rr(0, 1.2); this.releaseToken(f); }
        break;
      case 'duck':
        f.x = f.tx; f.z = f.tz; f.h = 0;
        if (f.t > (this.assist ? 1.1 : 0.8)) { f.st = 'idle'; f.t = 0; this.sfx('bubble'); }
        break;
      case 'held': {
        const q = this.enzo;
        f.x = q.x + q.face * 4; f.z = q.z + 0.5; f.h = q.h + 150; f.face = -q.face;
        break;
      }
      case 'thrown': {
        f.x += f.vx * DT; f.vh -= 1400 * DT; f.h += f.vh * DT;
        for (const o of this.foes) {
          if (o === f || f.hitList.includes(o) || !this.hittable(o)) continue;
          if (Math.abs(o.x - f.x) < 60 && Math.abs(o.z - f.z) < 34 && o.h < f.h + 60) { f.hitList.push(o); this.damageFoe(o, 3, { kb: sgn(f.vx) * 420, down: true, heavy: true, by: 'item', x: o.x, h: 40, snd: 'slam' }); }
        }
        const b = this.boss;
        if (b && b.st !== 'end' && !f.hitList.includes(b) && Math.abs(this.bossX() - f.x) < 140 && Math.abs(b.z - f.z) < 70) { f.hitList.push(b); this.damageBoss(3, 'item', f.x, f.h, true); f.vx *= -0.3; }
        if (f.h <= 0 || f.x < this.camL - 40 || f.x > this.camR + 40) { f.h = Math.max(0, f.h); this.koFoe(f, f.vx * 0.4); }
        break;
      }
      case 'ko':
        f.x += f.vx * DT; f.z += f.vz * DT; f.vh -= GRAV * DT; f.h += f.vh * DT;
        if (f.z < -14 && f.h < -10 && !f.splashed) { f.splashed = true; this.ev({ k: 'splash', x: f.x }); this.sfx('splash'); }
        if (f.t > 1.4) f.dead = true;
        break;
    }
    if (this.scene.ride && !flier(f) && !f.dead && (f.st === 'down' || f.st === 'hurt' || f.st === 'thrown') && (f.x < this.camL + 24 || f.x > this.camR - 24)) this.overboard(f);
    // the gull's tell and dive
    if (f.kind === 'gull' && f.st === 'wind') {
      if (f.t > d.wind * slowW) { f.st = 'dive'; f.t = 0; f.didHit = false; f.tx = p.x; f.tz = p.z; this.sfx('whoosh'); }
      else { f.tx = p.x; f.tz = p.z; f.face = sgn(p.x - f.x); f.h += (150 - f.h) * DT * 4; }
    }
    if (f.kind === 'gull' && f.st === 'dive') {
      const dx = f.tx - f.x, dz = f.tz - f.z, dh = -f.h, L3 = Math.hypot(dx, dz, dh) || 1, sp = 640 * DT;
      if (L3 <= sp) { f.x = f.tx; f.z = f.tz; f.h = 0; f.st = 'crash'; f.t = 0; f.daze = this.assist ? 1.7 : 1.15; this.releaseToken(f); this.ev({ k: 'dust', x: f.x, z: f.z, n: 6, size: 1 }); this.sfx('land'); }
      else { f.x += dx / L3 * sp; f.z += dz / L3 * sp; f.h += dh / L3 * sp; }
      if (!f.didHit && Math.abs(p.x - f.x) < 50 && Math.abs(p.z - f.z) < 26 && Math.abs(p.h + 80 - f.h) < 90) { f.didHit = true; this.hurtHero(p, d.dmg, f.x); }
    }
    // the cormorant: it hovers high, a ring follows you on the boards and locks, then it drops straight down beak first
    if (f.kind === 'cormorant' && f.st === 'wind') {
      const T = this.assist ? 1.25 : 0.95;
      if (f.t < T * 0.65) { f.tx = clamp(p.x, this.camL + 60, this.camR - 60); f.tz = p.z; }
      f.x += clamp(f.tx - f.x, -420 * DT, 420 * DT); f.z += clamp(f.tz - f.z, -200 * DT, 200 * DT); f.h += (205 - f.h) * DT * 4; f.face = sgn(p.x - f.x) || f.face;
      if (f.t > T) { f.st = 'dive'; f.t = 0; f.didHit = false; this.sfx('whoosh'); }
    }
    if (f.kind === 'cormorant' && f.st === 'dive') {
      f.x += clamp(f.tx - f.x, -500 * DT, 500 * DT); f.z += clamp(f.tz - f.z, -300 * DT, 300 * DT); f.h -= 950 * DT;
      if (!f.didHit && f.h < 90 && Math.abs(p.x - f.x) < 48 && Math.abs(p.z - f.z) < 26 && p.h < f.h + 40 && !out) { f.didHit = true; this.hurtHero(p, d.dmg, f.x, 300); }
      if (f.h <= 0) {
        f.h = 0; f.st = 'crash'; f.t = 0; f.daze = this.assist ? 2.4 : 1.7; this.releaseToken(f);
        this.ev({ k: 'dust', x: f.x, z: f.z, n: 8, size: 1.2 }); this.sfx('thunk'); this.shakeBy(3);
        if (!f.didHit) this.learned.corm = (this.learned.corm || 0) + 1;
      }
    }
    if (!['held', 'ko', 'thrown', 'enter'].includes(f.st)) { f.z = clamp(f.z, 0, DEPTH); if (f.st !== 'flee') f.x = clamp(f.x, this.camL + 24, this.camR - 24); }
    // bodies don't stack
    if (['idle', 'walk', 'rec', 'daze', 'up', 'block'].includes(f.st) && f.h < 20 && !inHole(f)) {
      const dx = f.x - p.x, dz = f.z - p.z, minX = (f.rad + HC[p.name].rad) * 0.9;
      if (Math.abs(dx) < minX && Math.abs(dz) < 18 && !out && p.st !== 'dash' && p.st !== 'special') f.x = p.x + (sgn(dx) || -p.face) * minX;
      for (const o of this.foes) if (o !== f && o.h < 20 && !inHole(o) && ['idle', 'walk', 'rec'].includes(o.st)) { const ex = f.x - o.x, ez = f.z - o.z; if (Math.abs(ex) < 40 && Math.abs(ez) < 14) { f.x += (sgn(ex) || 1) * 30 * DT; f.z += (sgn(ez) || 1) * 30 * DT; } }
    }
  }
  /** an eel peeking out of its hole: it bubbles and lunges when you're in its lane and in reach */
  private eelPeek(f: Foe, p: Hero, out: boolean) {
    const d = FD.eel;
    f.x = f.tx; f.z = f.tz; f.h = 0; f.st = 'idle'; f.face = sgn(p.x - f.x) || f.face;
    const dx = Math.abs(p.x - f.x);
    if (f.cd <= 0 && !out && Math.abs(p.z - f.z) < 34 && dx < d.reach + 20 && dx > 40 && p.h < 60 && this.takeToken(f)) { f.st = 'wind'; f.t = 0; this.sfx('bubble'); return; }
    // nobody in reach for a while: it ducks under the boards and comes up again in the lane you're in
    if (f.t > 4.5 && !out) {
      const s = sgn(f.x - p.x);
      f.tx = clamp(p.x + s * this.rr(140, 240), this.camL + 80, this.camR - 80); f.tz = LANE_Z[this.laneOf(p.z)];
      f.st = 'duck'; f.t = -0.5; this.sfx('bubble');
    }
  }
  /** an inker's squirt: a splat of ink over part of the screen, and a jet that stings if you're right in front */
  private squirt(f: Foe, p: Hero) {
    this.sfx('squirt');
    this.ink.push({ x: this.rr(0.18, 0.82), y: this.rr(0.16, 0.5), t: 0, life: this.assist ? 3.5 : 5, r: this.rr(0.85, 1.15), by: f.id });
    if (this.ink.length > 3) this.ink.shift();
    this.ev({ k: 'sparks', x: f.x + f.face * 50, z: f.z, h: f.h + 40, col: '#3a2450', n: 12, big: 1.3 });
    if (Math.abs(p.x - f.x) < 280 && sgn(p.x - f.x) === f.face && Math.abs(p.z - f.z) < 60 && p.h < 140 && p.st !== 'out') this.hurtHero(p, 6, f.x, 180);
  }
  /** an eel pulled or slammed out of its hole fights on the boards from then on */
  private popEel(f: Foe) {
    f.loose = true; f.x = f.tx; this.releaseToken(f);
    this.sfx('pop'); this.ev({ k: 'word', x: f.x, z: f.z, h: 110, text: 'POPPED OUT!', col: '#e8eef6' }); this.ev({ k: 'dust', x: f.x, z: f.z, n: 6, size: 1 });
  }
  /** an inker knocked off its post falls to the boards, and its ink clears */
  private knockOff(f: Foe, kb: number) {
    f.loose = true; f.st = 'down'; f.t = 0; f.vh = 150; f.vx = kb * 0.5; this.releaseToken(f);
    this.ink = this.ink.filter((k) => k.by !== f.id);
    this.ev({ k: 'word', x: f.x, z: f.z, h: 170, text: 'KNOCKED OFF!', col: '#fff0c8' });
  }
  private jellyDrift(f: Foe, p: Hero) {
    const d = FD.jelly;
    const tx = p.x + sgn(f.x - p.x) * 120, tz = p.z;
    f.x += clamp(tx - f.x, -d.spd * DT, d.spd * DT); f.z += clamp(tz - f.z, -d.zs * DT, d.zs * DT);
    f.h += (60 + Math.sin(f.anim * 2.4) * 10 - f.h) * DT * 2;
    f.face = sgn(p.x - f.x); f.st = 'walk';
    if (f.cd <= 0 && p.st !== 'out' && Math.abs(p.x - f.x) < 180 && this.takeToken(f)) { f.st = 'charge'; f.t = 0; this.sfx('jellyHum'); }
  }
  /** the tutorial thief: grabs the first lantern, runs to the far side and waits there */
  private thief(f: Foe) {
    const s = this.strings[0], p = this.hero(), sx = s.col * COL;
    if (!f.stole) {
      f.x += sgn(sx - f.x) * 160 * DT; f.z += (8 - f.z) * DT * 3; f.st = 'walk'; f.face = sgn(sx - f.x);
      if (Math.abs(sx - f.x) < 10) { f.stole = true; s.got = 0; f.lantern = 0; this.sfx('pop'); this.ev({ k: 'sparks', x: sx, z: 0, h: 170, col: '#ffd27a', n: 8, big: 1 }); this.tut.stage = 1; this.tut.t = 0; }
    } else {
      const tx = this.camR - 90, dx = tx - f.x;
      if (Math.abs(dx) > 8 && Math.hypot(p.x - f.x, p.z - f.z) > 120) { f.x += sgn(dx) * 120 * DT; f.st = 'walk'; f.face = 1; }
      else { f.st = 'idle'; f.face = sgn(p.x - f.x); if (Math.abs(p.x - f.x) < 110) { f.script = 'weak'; f.cd = 1.2; } }
    }
  }

  // ─────────────────────────────────────────── items and props
  private updItems() {
    for (const it of this.items) {
      if (it.held) continue;
      it.t += DT;
      if (it.slide) {
        it.x += it.slide * DT; it.slide *= Math.pow(0.5, DT);
        this.itemHits(it, 2, 'slide');
        if (Math.abs(it.slide) < 60 || it.x < this.camL + 20 || it.x > this.camR - 20) { it.slide = 0; it.x = clamp(it.x, this.camL + 30, this.camR - 30); if (it.kind === 'barrel') this.breakItem(it); }
      } else if (it.vx && it.h > 0 && it.vh !== 0 && Math.abs(it.vx) > 400) {
        // thrown
        it.x += it.vx * DT; it.vh -= 1400 * DT; it.h += it.vh * DT;
        this.itemHits(it, 3, 'throw');
        if (this.goal?.kind === 'chase' && this.catchThief(it.x, it.z, it.h - 20, it.h + 120, 70) && it.kind === 'barrel') this.breakItem(it);
        if (it.h <= 0) { it.h = 0; it.vh = 0; it.vx = 0; if (it.kind === 'barrel') this.breakItem(it); }
        if (it.x < this.camL - 40 || it.x > this.camR + 40) { if (it.kind === 'barrel' && it.sid) { it.x = clamp(it.x, this.camL + 60, this.camR - 60); this.breakItem(it); } else it.dead = true; }
      } else if (it.h > 0 || it.vh > 0) {
        it.vh -= GRAV * DT; it.h += it.vh * DT; it.x += it.vx * DT;
        if (it.h <= 0) { it.h = 0; it.vh = it.vh < -200 ? -it.vh * 0.3 : 0; it.vx *= 0.5; }
      }
      if ((it.kind === 'shell' || it.kind === 'snack' || it.kind === 'bun') && it.t > 14) it.dead = true;
    }
    this.items = this.items.filter((i) => !i.dead);
  }
  private itemHits(it: Item, dmg: number, how: string) {
    for (const o of this.foes) {
      if (it.hitList.includes(o) || !this.hittable(o)) continue;
      if (Math.abs(o.x - it.x) < 56 && Math.abs(o.z - it.z) < 34 && o.h < it.h + 60) {
        it.hitList.push(o);
        if (o.kind === 'hermit' && o.shell) { o.shell = false; this.addItem('shell', o.x, o.z, 20, -sgn(it.vx || it.slide) * 120, 260); this.sfx('pop'); }
        if (o.kind === 'urchin' && !o.flipped) this.flipUrchin(o);
        this.damageFoe(o, dmg, { kb: sgn(it.vx || it.slide) * 420, down: true, heavy: true, by: 'item', x: o.x, h: 40, snd: 'slam' });
        if (how === 'slide' && it.kind === 'shell') it.slide *= 0.8;
      }
    }
    const b = this.boss;
    if (b && b.st !== 'end' && !it.hitList.includes(b) && Math.abs(this.bossX() - it.x) < 120 && Math.abs(b.z - it.z) < 70 && b.h < it.h + 100) { it.hitList.push(b); this.damageBoss(dmg, 'item', it.x, 60, true); if (it.slide) it.slide = 0; if (it.kind === 'barrel') this.breakItem(it); }
  }
  private breakItem(it: Item) {
    // a sealed tar barrel had a lantern charm inside
    if (it.kind === 'barrel' && it.sid) { this.addItem('charm', clamp(it.x, this.camL + 60, this.camR - 60), it.z, 30, 0, 300, it.sid); it.sid = ''; }
    it.dead = true; this.ev({ k: 'debris', x: it.x, z: it.z, kind: 'barrel' }); this.sfx('crate'); }
  private hitProp(pr: Prop, p: Hero, heavy: boolean) {
    if (pr.kind === 'ice') {
      if (p.name === 'enzo') { pr.vx = p.face * 760; pr.hitList = []; this.sfx('ice'); this.learned.ice = 1; this.ev({ k: 'sparks', x: pr.x, z: pr.z, h: 40, col: '#dff4ff', n: 8, big: 1 }); }
      else this.wrong(pr.x, pr.z, 50, 'enzo');
      return;
    }
    if (pr.kind === 'barrel' && p.name === 'dora') {
      // Dora's kick sets a barrel rolling along the deck
      pr.alive = false; const it = this.addItem('barrel', pr.x, pr.z, 0, 0, 0, pr.content === 'charm' ? pr.sid : ''); it.slide = p.face * 680; this.sfx('kick'); return;
    }
    pr.hp -= heavy ? 2 : 1; pr.flash = 0.1;
    this.sfx('crateHit');
    if (pr.hp <= 0) {
      pr.alive = false; this.ev({ k: 'debris', x: pr.x, z: pr.z, kind: pr.kind }); this.sfx('crate'); this.stats.score += 50;
      if (pr.content === 'charm') this.addItem('charm', pr.x, pr.z, 30, 0, 300, pr.sid);
      else if (pr.content === 'snack') this.addItem(pr.kind === 'fishcrate' ? 'snack' : 'bun', pr.x, pr.z, 30, 0, 300);
    }
  }
  private dropNet(pr: Prop) { pr.fall = 0.01; this.sfx('netDrop'); this.learned.net = 1; }
  private updProps() {
    for (const pr of this.props) {
      if (!pr.alive) continue;
      pr.flash -= DT;
      if (pr.kind === 'ice' && pr.vx) {
        pr.x += pr.vx * DT; pr.vx *= Math.pow(0.45, DT);
        for (const o of this.foes) if (!pr.hitList.includes(o) && this.hittable(o) && o.h < 50 && Math.abs(o.x - pr.x) < 60 && Math.abs(o.z - pr.z) < 34) {
          pr.hitList.push(o);
          if (o.kind === 'urchin') this.flipUrchin(o);
          this.damageFoe(o, 2.6, { kb: sgn(pr.vx) * 440, down: true, heavy: true, by: 'item', x: o.x, h: 30, snd: 'slam' });
        }
        const b = this.boss;
        if (b && !pr.hitList.includes(b) && Math.abs(this.bossX() - pr.x) < 120 && Math.abs(b.z - pr.z) < 70 && b.h < 40) { pr.hitList.push(b); this.damageBoss(2.6, 'item', pr.x, 40, true); pr.vx = -pr.vx * 0.2; }
        if (Math.abs(pr.vx) < 40 || pr.x < this.camL + 40 || pr.x > this.camR - 40) { pr.vx = 0; pr.x = clamp(pr.x, this.camL + 40, this.camR - 40); }
      }
      if (pr.kind === 'net' && pr.fall > 0 && !pr.down) {
        pr.fall += DT;
        if (pr.fall > 0.35) {
          pr.down = true; this.shakeBy(4); this.sfx('netLand'); this.ev({ k: 'dust', x: pr.x, z: pr.z, n: 10, size: 1.4 });
          for (const o of this.foes) if (this.hittable(o) && o.h < 60 && Math.abs(o.x - pr.x) < 110 && Math.abs(o.z - pr.z) < 50) {
            this.damageFoe(o, 1, { kb: 0, by: 'item', x: o.x, h: 30 });
            if (this.hittable(o) && o.st !== 'ko') { o.st = 'tangled'; o.t = 0; o.daze = this.assist ? 3.5 : 2.6; o.h = 0; this.releaseToken(o); if (o.kind === 'lobster') o.blocks = 0; }
          }
          const b = this.boss;
          if (b && b.st !== 'end' && Math.abs(this.bossX() - pr.x) < 160 && Math.abs(b.z - pr.z) < 70 && b.h < 80) this.netBoss();
        }
      }
    }
  }

  // ─────────────────────────────────────────── waves, events, camera
  private spawnGroup(g: string, alt: number) {
    let i = 0;
    for (const tok of g.split(/\s+/).filter(Boolean)) {
      const m = /^(<)?([a-z]+)(>)?(?:@(\d))?$/.exec(tok); if (!m) continue;
      const kind = m[2] as FoeKind, side = m[1] ? -1 : m[3] ? 1 : (i++ % 2 ? -1 : 1) * alt;
      const lane = m[4] !== undefined ? +m[4] : -1;
      const f = this.spawnFoe(kind, side, lane >= 0 ? { lane } : {});
      if (lane >= 0) f.x += side * this.foes.filter((o) => o.lane === lane && o !== f && o.st === 'enter').length * 70;
      const w = this.wave;
      if (w && w.def.lantern !== undefined) {
        const s = this.strings[w.def.lantern];
        if (s && w.carriers < s.need) { f.lantern = w.def.lantern; w.carriers++; }
      }
    }
  }
  private updEvents() {
    const sc = this.scene, p = this.hero();
    if (this.tut.stage < 9) this.updTutorial();
    const G = this.goal;
    if (G && !G.done) { this.updGoal(G); if (G.kind === 'defend' || G.kind === 'ride') return; }
    const w = this.wave;
    if (w) {
      w.t += DT; w.groupT += DT;
      const alive = this.foes.filter((f) => f.st !== 'ko').length;
      if (w.group < w.def.groups.length && w.t > 0.6 && (alive <= 1 || w.groupT > 9) && w.groupT > 1.0) {
        this.spawnGroup(w.def.groups[w.group], 1); w.group++; w.groupT = 0;
      }
      if (w.group >= w.def.groups.length && alive === 0) this.waveClear();
      return;
    }
    if (this.boss) { if (this.boss.st === 'gone') this.bossClear(); return; }
    if (this.tut.stage < 9) return;
    const e: EventDef | undefined = sc.events[this.evI];
    if (e) {
      const ex = e.col * COL;
      if (e.kind === 'tutorial') { this.evI++; return; }
      if (e.kind === 'talk') { if (p.x > ex - 300) { this.evI++; if (!this.skipTalk) this.talk = { who: e.who, line: e.line, t: 4.5 }; } return; }
      if (e.kind === 'cart' || e.kind === 'roll') { if (p.x > ex - 200) { this.evI++; this.sendRoll(e.lane, e.kind === 'cart' ? 'cart' : 'barrel', false); } return; }
      const lx = clamp(ex, VIEW_W / 2, this.len - VIEW_W / 2);
      if (this.cam >= lx - 30) {
        this.lock = lx; this.retryAt = { evI: this.evI, x: p.x };
        if (e.kind === 'wave') { this.wave = { def: e, group: 0, groupT: 0, t: 0, called: false, carriers: 0 }; if (e.teach) this.teachT = 6; }
        else if (e.kind === 'boss') this.spawnBoss(e.who);
        else if (e.kind === 'chase' || e.kind === 'defend' || e.kind === 'ride' || e.kind === 'tide') this.startGoal(e);
        this.evI++;
      }
      return;
    }
    // every event done: walk to the end of the scene
    const door = this.secretDoor();
    if (door !== null && Math.abs(p.x - door) < 40 && p.z < 30 && p.h <= 0) { this.goSecret(); return; }
    if (p.x > this.len - 110 && (!this.goal || this.goal.done)) this.nextScene();
  }
  /** a barrel (or the harbour cart) sent down a lane from the right: first a rumble and dust, then it rolls */
  private sendRoll(lane: number, kind: 'cart' | 'barrel', keep: boolean) {
    this.rolls.push({ lane, x: this.camR + (kind === 'cart' ? 300 : 80), t: 0, tell: kind === 'cart' ? 1.4 : this.assist ? 1.7 : 1.35, hit: [], kind, keep, passed: false });
    this.sfx('rumble');
  }
  /** the ropewalk belt: while a fight is on (and in Tanglejaw's drydock, and Longshanks' last phase) barrels keep coming */
  private updBelt() {
    const bt = this.scene.belt; if (!bt || this.mode !== 'play') return;
    const b = this.boss, on = !!this.wave || (!!b && !['intro', 'end', 'gone'].includes(b.st) && (b.kind === 'tanglejaw' || b.phase >= 3));
    if (!on) { this.beltT = 2.5; return; }
    this.beltT -= DT; if (this.beltT > 0) return;
    if (this.rolls.some((r) => r.kind === 'barrel' && r.x > this.camL)) { this.beltT = 0.5; return; }
    if (bt.keep && this.props.filter((pr) => pr.alive && pr.kind === 'barrel').length + this.items.filter((it) => it.kind === 'barrel').length >= 3) { this.beltT = 2; return; }
    const p = this.hero(), near = bt.lanes.reduce((a, l) => Math.abs(LANE_Z[l] - p.z) < Math.abs(LANE_Z[a] - p.z) ? l : a, bt.lanes[0]);
    this.sendRoll(this.rnd() < 0.55 ? near : bt.lanes[Math.floor(this.rnd() * bt.lanes.length)], 'barrel', !!bt.keep);
    this.beltT = bt.every * (this.assist ? 1.15 : 1) + this.rr(-1, 1);
  }
  private updRolls() {
    const p = this.hero();
    for (const c of this.rolls) {
      c.t += DT;
      if (c.t < c.tell) {
        // the tell: the belt rumbles and dust puffs along the lane it will come down
        if (c.kind === 'barrel' && Math.floor(c.t * 6) !== Math.floor((c.t - DT) * 6)) this.ev({ k: 'dust', x: this.camR - 40 - this.rr(0, 120), z: LANE_Z[c.lane], n: 2, size: 0.8 });
        continue;
      }
      c.x -= (c.kind === 'cart' ? 620 : 560) * DT;
      const z = LANE_Z[c.lane];
      if (!c.hit.includes(p) && p.st !== 'out' && Math.abs(p.x - c.x) < 62 && Math.abs(p.z - z) < 28 && p.h < 50) { c.hit.push(p); this.hurtHero(p, c.kind === 'cart' ? 12 : this.assist ? 11 : 12, c.x + 100, 420, true); }
      if (!c.passed && c.x < p.x - 60) { c.passed = true; if (!c.hit.includes(p)) this.learned.belt = (this.learned.belt || 0) + 1; }
      for (const f of this.foes) if (!c.hit.includes(f) && this.hittable(f) && f.h < 50 && !inHole(f) && Math.abs(f.x - c.x) < 64 && Math.abs(f.z - z) < 30) { c.hit.push(f); this.damageFoe(f, 3, { kb: -460, down: true, heavy: true, by: 'item', x: f.x, h: 40, snd: 'slam' }); }
      const b = this.boss;
      if (b && b.kind === 'longshanks' && !c.hit.includes(b) && this.lsStanding(b) && Math.abs(b.x - c.x) < 90 && Math.abs(b.z - z) < 50) { c.hit.push(b); b.hp = Math.max(1, b.hp - 3); this.topple(b, 'BOWLED OVER!'); }
      if (c.keep && c.x < this.camL + 90) {
        // in the drydock the barrels bump the far wall and stand up, ready to carry
        this.props.push({ id: this.nid++, kind: 'barrel', x: this.camL + 90, z, hp: 2, content: '', sid: '', alive: true, vx: 0, hitList: [], fall: 0, down: false, flash: 0 });
        this.sfx('thunk'); this.ev({ k: 'dust', x: this.camL + 90, z, n: 6, size: 1 }); c.x = -1e9;
      }
    }
    this.rolls = this.rolls.filter((c) => c.x > this.camL - 300);
  }
  // ─────────────────────────────────────────── scene goals: chase, defend, ride, tide
  private startGoal(e: GoalDef) {
    const p = this.hero();
    const G: Goal = { def: e, kind: e.kind, t: 0, done: false, won: false, group: 0, groupT: 99, x: 0, z: 80, h: 0, st: '', stT: 0, hp: 0, max: 0, flash: 0, front: 0, wet: 0 };
    if (e.kind === 'chase') {
      Object.assign(G, { x: this.cam + 260, h: 200, z: p.z, st: 'fly' });
      this.sfx('squawk'); this.ev({ k: 'word', x: G.x, z: G.z, h: 260, text: 'THIEF!', col: '#ffd27a' });
      this.lock = null;
    } else if (e.kind === 'defend') {
      Object.assign(G, { x: this.lock ?? this.cam, z: 22, hp: 100, max: 100, st: 'ok' });
    } else if (e.kind === 'tide') {
      G.front = this.camL - 160; this.lock = null; this.sfx('splash');
      this.ev({ k: 'word', x: p.x, z: p.z, h: 200, text: 'THE TIDE!', col: '#bfe8ff' });
    }
    this.goal = G;
  }
  private goalFoes(G: Goal, alt: number) {
    const n0 = this.foes.length;
    this.spawnGroup(G.def.groups[G.group % G.def.groups.length], alt); G.group++; G.groupT = 0;
    for (const f of this.foes.slice(n0)) {
      if (G.kind === 'defend') f.script = 'raid';
      if (G.kind === 'ride' && !flier(f)) f.script = 'board';
    }
  }
  private winGoal(G: Goal, text: string) {
    G.won = true; this.stats.goals++; this.stats.score += 1500; this.sfx('festFull');
    const s = this.strings[G.def.lantern];
    if (s) { const n = s.need - s.got - s.flying; for (let i = 0; i < n; i++) this.lanternFly(G.kind === 'chase' ? G.x : this.cam + this.rr(-150, 150), G.z, G.kind === 'chase' ? G.h : 200, G.def.lantern); }
    this.ev({ k: 'word', x: G.kind === 'chase' ? G.x : this.cam, z: 60, h: 240, text, col: '#ffe9a8' });
  }
  private loseGoal(G: Goal, text: string) {
    this.stats.goalsLost++; this.sfx('deflate');
    this.ev({ k: 'word', x: G.kind === 'chase' ? G.x : this.cam, z: 60, h: 240, text, col: '#c9d4ff' });
  }
  private updGoal(G: Goal) {
    const A = this.assist, p = this.hero();
    G.t += DT; G.stT += DT; G.groupT += DT; G.flash = Math.max(0, G.flash - DT);
    const alive = this.foes.filter((f) => f.st !== 'ko').length;
    if (G.kind === 'chase') {
      // the gull thief: flies ahead high, then (after a ring on the boards) swoops low over your lane, then climbs again
      const end = this.cam >= this.len - VIEW_W / 2 - 1;
      if (G.st === 'fly' || G.st === 'rise') {
        G.x += (this.cam + 230 + Math.sin(G.t * 1.3) * 70 - G.x) * Math.min(1, DT * 2); G.h += (200 - G.h) * Math.min(1, DT * 3); G.z += (p.z - G.z) * Math.min(1, DT * 2);
        if (end) { G.st = 'escape'; G.stT = 0; this.loseGoal(G, 'IT GOT AWAY!'); }
        else if (G.stT > (G.st === 'rise' ? 0.6 : A ? 2.0 : 1.6)) {
          G.st = G.st === 'rise' ? 'fly' : 'swoopw'; G.stT = 0;
          if (G.st === 'swoopw') { this.sfx('shriek'); this.ev({ k: 'ring', x: clamp(p.x + 110, this.camL + 140, this.camR - 80), z: p.z, size: 70, col: '#ffd27a', life: A ? 0.75 : 0.55 }); }
        }
      } else if (G.st === 'swoopw') {
        G.x += (clamp(p.x + 110, this.camL + 140, this.camR - 80) - G.x) * Math.min(1, DT * 3);
        if (G.stT > (A ? 0.7 : 0.5)) { G.st = 'swoop'; G.stT = 0; this.sfx('whoosh'); }
      } else if (G.st === 'swoop') {
        G.x += (clamp(p.x + 90, this.camL + 120, this.camR - 80) - G.x) * Math.min(1, DT * 2.5); G.h += (70 - G.h) * Math.min(1, DT * 6); G.z += (p.z - G.z) * Math.min(1, DT * 4);
        if (G.stT > (A ? 1.8 : 1.3)) { G.st = 'rise'; G.stT = 0; }
      } else if (G.st === 'hit') {
        G.h = Math.max(30, G.h - 200 * DT);
        if (G.stT > 0.7) { G.st = 'flee'; G.stT = 0; this.sfx('squawk'); }
      } else if (G.st === 'flee' || G.st === 'escape') {
        G.x += 360 * DT; G.h += 160 * DT;
        if (G.stT > 1.6) { G.done = true; if (G.st === 'escape' && !G.won) { /* the lanterns are gone; the scene carries on */ } }
      }
      // a few foes come the other way; the ones left behind drop out of the picture
      if (!G.won && G.group < G.def.groups.length && G.groupT > (A ? 6 : 5) && alive < 2) this.goalFoes(G, 1);
      for (const f of this.foes) if (f.x < this.camL - 120 && f.st !== 'ko') { this.releaseToken(f); f.dead = true; }
      return;
    }
    if (G.kind === 'defend') {
      const dur = G.def.time ?? 45;
      if (G.t < dur && G.group < 99 && ((alive <= (A ? 2 : 3) && G.groupT > 2.5) || G.groupT > 9)) this.goalFoes(G, G.group % 2 ? -1 : 1);
      if (G.t >= dur && alive === 0) {
        G.done = true; this.lock = null; this.go = 3; this.sfx('go');
        if (G.hp > 0) { this.winGoal(G, 'SAVED!'); this.stats.score += Math.round(G.hp * 20); } else this.loseGoal(G, 'NEXT TIME!');
      }
      return;
    }
    if (G.kind === 'ride') {
      if (G.group < G.def.groups.length && G.t > 0.8 && (alive <= 1 || G.groupT > 9) && G.groupT > 1.2) this.goalFoes(G, G.group % 2 ? -1 : 1);
      if (G.group >= G.def.groups.length && alive === 0) { G.done = true; this.lock = null; this.go = 3; this.sfx('go'); this.winGoal(G, 'ALL CLEAR!'); }
      return;
    }
    // the tide: its edge creeps right; standing in it chips your health (never below a quarter with assist on), and
    // it washes away any foe it catches; reaching the far end wins the scene's lanterns
    G.front = Math.min(G.front + (A ? 50 : 62) * DT, this.len - 60);
    if (p.x < G.front + 18 && p.st !== 'out' && p.st !== 'tagin') {
      const chip = (A ? 4 : 7) * DT; G.wet += DT;
      if (p.hp - chip <= (A ? 25 : 0)) { if (!A && p.inv <= 0) this.hurtHero(p, 40, G.front - 50, 200, true); else if (A) p.hp = Math.max(p.hp, 25); }
      else { p.hp -= chip; this.stats.dmg += chip; }
      if (G.wet > 0.6) { G.wet = 0; this.ev({ k: 'splash', x: p.x }); this.sfx('splash'); }
    }
    for (const f of this.foes) if (!flier(f) && f.st !== 'ko' && f.x < G.front - 10 && !inHole(f)) { this.koFoe(f, 300); this.ev({ k: 'splash', x: f.x }); this.ev({ k: 'word', x: f.x, z: f.z, h: 120, text: 'WASHED AWAY!', col: '#bfe8ff' }); }
    if (G.front < this.len - VIEW_W && G.groupT > (A ? 5 : 4) && alive < 2) this.goalFoes(G, 1);
    if (p.x > this.len - 150) { G.done = true; this.winGoal(G, 'SAFE!'); this.learned.tide = (this.learned.tide || 0) + 1; }
  }
  /** a hit on the gull thief (a kick or paw that reaches it, or something thrown) wins the chase */
  private catchThief(x: number, z: number, h0: number, h1: number, reachX: number) {
    const G = this.goal;
    if (!G || G.kind !== 'chase' || G.won || G.done || G.st === 'escape' || G.st === 'flee') return false;
    if (Math.abs(G.x - x) > reachX || Math.abs(G.z - z) > 70 || h1 < G.h || h0 > G.h + (this.assist ? 130 : 110)) return false;
    G.st = 'hit'; G.stT = 0; this.hitstop(0.08); this.shakeBy(5); this.sfx('kick3');
    this.ev({ k: 'sparks', x: G.x, z: G.z, h: G.h + 30, col: '#fff3c4', n: 14, big: 1.4 });
    this.winGoal(G, 'CAUGHT!'); this.learned.chase = (this.learned.chase || 0) + 1;
    return true;
  }
  /** a raider at a defended stall: off the stall's flank, it bashes the stall instead of you, unless you're close */
  private raid(f: Foe): boolean {
    const G = this.goal, p = this.hero(), d = FD[f.kind];
    if (!G || G.kind !== 'defend' || G.done || G.hp <= 0 || f.tok) return false;
    if (Math.abs(p.x - f.x) < 140 && Math.abs(p.z - f.z) < 60) return false;
    const side = f.x < G.x ? -1 : 1, tx = G.x + side * 78, tz = G.z + 16;
    const dx = tx - f.x, dz = tz - f.z;
    f.x += clamp(dx, -d.spd * DT, d.spd * DT); f.z += clamp(dz, -d.zs * DT, d.zs * DT);
    f.face = -side; f.st = Math.abs(dx) > 6 || Math.abs(dz) > 6 ? 'walk' : 'idle';
    if (f.st === 'idle' && f.cd <= 0) {
      f.st = 'atk'; f.t = 0; f.didHit = true; f.cd = this.rr(1.8, 2.6);
      G.hp = Math.max(0, G.hp - (this.assist ? 2.2 : 3.5) * [1, 1.15, 1.3][this.tier()]); G.flash = 0.2; this.sfx('crateHit');
      this.ev({ k: 'debris', x: G.x + side * 40, z: G.z, kind: 'crate' });
      if (G.hp <= 0) { G.st = 'broken'; this.shakeBy(6); this.sfx('crack'); this.loseGoal(G, 'THE STALL!'); }
    }
    return true;
  }
  /** on a ride, a foe knocked past the edge of the deck goes over the side */
  private overboard(f: Foe) {
    this.koFoe(f, sgn(f.x - this.cam) * 300); f.vz = 0; f.splashed = true;
    this.ev({ k: 'splash', x: f.x }); this.sfx('splash'); this.stats.overboard++; this.stats.score += 200;
    this.ev({ k: 'word', x: f.x, z: f.z, h: 120, text: 'OVERBOARD!', col: '#bfe8ff' });
  }

  private waveClear() {
    const w = this.wave!; this.wave = null; this.lock = null; this.go = 3; this.sfx('go');
    if (w.def.lantern !== undefined) { const s = this.strings[w.def.lantern]; if (s && s.got + s.flying < s.need) { const n = s.need - s.got - s.flying; for (let i = 0; i < n; i++) this.lanternFly(this.cam + this.rr(-200, 200), 80, 200, w.def.lantern); } }
    this.stats.score += 500;
  }
  private bossClear() {
    const b = this.boss!; this.stats.bossTime[b.kind] = +(this.t - this.bossStart).toFixed(1);
    this.boss = null; this.lock = null; this.go = 3; this.sfx('go');
    this.stats.score += 3000;
    for (const s of this.strings) { const n = s.need - s.got - s.flying; for (let i = 0; i < n; i++) this.lanternFly(this.cam + this.rr(-150, 150), 80, 260, this.strings.indexOf(s)); }
  }
  private goSecret() {
    const id = this.scene.secret!;
    this.inSecret = true; this.sfx('secret');
    this.sceneIds.splice(this.sceneI + 1, 0, id); this.sceneI++;
    this.enterScene(id); this.inSecret = true;
  }
  private nextScene() {
    if (this.sceneI + 1 >= this.sceneIds.length) {
      this.mode = 'clear'; this.clearT = 0; this.sfx('win');
      const a = this.hero(), o = this.partner();
      this.setSt(a, 'win'); Object.assign(o, { st: 'win', t: 0, ready: true, x: a.x - 110, z: a.z, h: 0, face: 1 });
      this.stats.score += Math.max(0, Math.round(3000 - this.stats.time * 5 - this.stats.dmg * 8));
      return;
    }
    const was = this.scene.id;
    this.sceneI++; this.inSecret = false;
    this.enterScene(this.sceneIds[this.sceneI]);
    if (SCENES[was].id === 'alley' || SCENES[was].id === 'larder' || SCENES[was].id === 'loft') this.inSecret = false;
  }
  private updCamera() {
    const p = this.hero();
    this.go = Math.max(0, this.go - DT);
    const G = this.goal;
    if (this.lock !== null) { this.cam += (this.lock - this.cam) * Math.min(1, DT * 5); }
    else if (G && G.kind === 'chase' && !G.done && !G.won) {
      // the chase: the camera scrolls on by itself, and the left edge pushes you along
      this.cam = Math.min(this.cam + (this.assist ? 112 : 132) * DT, Math.max(VIEW_W / 2, this.len - VIEW_W / 2));
    } else {
      const e = this.scene.events[this.evI];
      const stopAt = e && (e.kind === 'wave' || e.kind === 'boss') ? clamp(e.col * COL, VIEW_W / 2, this.len - VIEW_W / 2) : this.len - VIEW_W / 2;
      const tx = clamp(p.x + p.face * VIEW_W * 0.08, VIEW_W / 2, stopAt);
      this.cam += (tx - this.cam) * Math.min(1, DT * 6);
      this.cam = clamp(this.cam, VIEW_W / 2, Math.max(VIEW_W / 2, this.len - VIEW_W / 2));
    }
    this.updRolls();
  }
  private updTutorial() {
    const T = this.tut; T.t += DT;
    if (T.stage === 0) {
      if (this.t > 0.9 && !T.thief) { T.thief = this.spawnFoe('crab', 1, { script: 'thief', hp: 1.8, z: 30 }); this.strings[0].got = 1; }
      if (T.thief && T.thief.st === 'ko') { T.stage = 2; T.t = 0; }
    } else if (T.stage === 1) {
      if (!this.foes.some((f) => f.st !== 'ko')) { T.stage = 2; T.t = 0; }
    } else if (T.stage === 2) {
      if (T.t > 1.0 && !T.hermit) { T.hermit = this.spawnFoe('hermit', 1, { lantern: 1, z: 90 }); T.hermit.cd = 3; }
      if (T.hermit && T.hermit.st === 'ko') { T.stage = 3; T.t = 0; }
    } else if (T.stage === 3) {
      if (T.t > 1.0 && !T.gull) { T.gull = this.spawnFoe('gull', 1, { lantern: 1, script: 'calm', z: 60 }); T.gull.cd = 4; }
      if (T.gull && T.gull.st === 'ko') { T.stage = 4; T.t = 0; }
    } else if (T.stage === 4 && T.t > 0.9) {
      T.stage = 9; this.go = 3; this.sfx('go');
    }
  }

  // ─────────────────────────────────────────── bosses
  bossX() { return this.boss ? this.boss.x : 0; }
  bossBox() { const b = this.boss!, k = b.kind; return { x: b.x, z: b.z, h: b.h, rad: BOSS_R[k] * 0.9, ht: k === 'admiral' || k === 'longshanks' ? 150 : k === 'tanglejaw' ? 90 : 200 }; }
  private spawnBoss(kind: BossKind) {
    const hp = { brute: 140, clamps: 160, knuckles: 140, admiral: 150, longshanks: 120, tanglejaw: 120 }[kind];
    this.boss = { kind, x: this.camR + 260, z: 80, h: kind === 'admiral' ? 170 : kind === 'longshanks' ? 110 : 0, vh: 0, hp, max: hp, st: 'intro', t: 0, face: -1, flash: 0, hurtT: 0, phase: 1, armour: kind === 'brute' ? 3 : 0, layers: 1, n: 0, tx: 0, tz: 0, didHit: false, summoned: 0, dir: -1, pinned: 0, cycle: 0, ghost: hp, tinks: 0, seen: [], lastSt: 'intro', first: false, hinted: 0, hole: 1, ext: 0 };
    this.bossHint = null;
    if (kind === 'tanglejaw') {
      // three drain holes across the drydock floor; he rises from the middle one
      const L = this.lock ?? this.cam;
      this.holes = [{ x: L - 280, z: LANE_Z[3], plug: false }, { x: L + 10, z: LANE_Z[1], plug: false }, { x: L + 290, z: LANE_Z[3], plug: false }];
      this.boss.x = this.holes[1].x; this.boss.z = this.holes[1].z;
    }
    this.bossStart = this.t; this.sfx(kind === 'admiral' ? 'shriek' : 'roar');
  }
  /** Enzo's grab on a boss: rip off Clamps' barrel, pin the grounded Admiral, throw Knuckles out of his guard */
  private bossGrab(p: Hero, reach: number, zTol: number): boolean {
    const b = this.boss!; const bx = this.bossX();
    // Longshanks' leg stuck in the planks: Enzo heaves on it and the whole crab comes down
    if (b.kind === 'longshanks' && b.st === 'stomp' && Math.abs(b.tx - p.x) < reach + 40 && Math.abs(b.tz - p.z) < zTol + 30) {
      p.face = sgn(b.tx - p.x) || 1; this.setSt(p, 'heave'); b.st = 'heave'; b.t = 0; this.sfx('heave'); this.learned.heave = (this.learned.heave || 0) + 1;
      return true;
    }
    const near = Math.abs(bx - p.x) < reach + BOSS_R[b.kind] && Math.abs(b.z - p.z) < zTol + 40;
    if (!near) return false;
    p.face = sgn(bx - p.x) || 1;
    if (b.kind === 'clamps' && b.st === 'dizzy') { this.setSt(p, 'heave'); b.st = 'ripping'; b.t = 0; this.sfx('heave'); this.learned.rip = (this.learned.rip || 0) + 1; return true; }
    if (b.kind === 'admiral' && b.st === 'grounded') { this.setSt(p, 'heave'); b.st = 'pinned'; b.t = 0; b.pinned = 0; this.sfx('heave'); this.learned.pin = (this.learned.pin || 0) + 1; return true; }
    if (b.kind === 'knuckles' && (b.st === 'guard' || b.st === 'idle')) {
      this.setSt(p, 'heave'); b.st = 'thrown'; b.t = 0; this.sfx('heave'); this.learned.kthrow = (this.learned.kthrow || 0) + 1;
      return true;
    }
    return false;
  }
  private netBoss() {
    const b = this.boss!;
    if (b.kind === 'admiral' && b.h < 80) { b.st = 'grounded'; b.t = 0; b.h = 0; this.ev({ k: 'word', x: b.x, z: b.z, h: 160, text: 'TANGLED!', col: '#fffbe6' }); }
    else this.damageBoss(2, 'item', b.x, 60, true);
  }
  /** how hard each hero hits the boss right now: the right hero in the open window hits hard, the wrong one tinks */
  private bossMult(by: HeroId | 'dbl' | 'item'): { m: number; want: HeroId | null } {
    const b = this.boss!;
    if (by === 'dbl') return { m: 1, want: null };
    switch (b.kind) {
      case 'brute':
        if (b.armour > 0) return by === 'item' ? { m: 0.6, want: null } : { m: by === 'enzo' ? 0.15 : 0.05, want: 'enzo' };
        return { m: by === 'dora' ? 2.4 : by === 'enzo' ? 0.7 : 1.4, want: by === 'enzo' ? 'dora' : null };
      case 'clamps':
        if (b.st === 'bare' || b.st === 'juggle') return { m: by === 'dora' ? 2.6 : by === 'enzo' ? 0.6 : 1.4, want: by === 'enzo' ? 'dora' : null };
        return by === 'item' ? { m: 0.4, want: null } : { m: 0.04, want: 'enzo' };
      case 'knuckles':
        if (b.st === 'dizzy' || b.st === 'down') return { m: by === 'dora' ? 2.2 : by === 'enzo' ? 1.0 : 1.4, want: null };
        if (b.st === 'guard') return by === 'item' ? { m: 0.5, want: null } : { m: 0.05, want: 'enzo' };
        return { m: 0.3, want: null };
      case 'admiral':
        if (b.st === 'pinned') return { m: by === 'enzo' ? 2.6 : 0.2, want: by === 'dora' ? 'enzo' : null };
        if (b.st === 'grounded') return { m: by === 'enzo' ? 1.2 : 0.15, want: by === 'dora' ? 'enzo' : null };
        return { m: by === 'item' ? 0.6 : 0.1, want: b.h > 40 ? 'dora' : null };
      case 'longshanks': {
        if (b.st === 'toppled' || b.st === 'heave' || b.st === 'getup') return { m: by === 'dora' ? 2.4 : by === 'enzo' ? 1.0 : 1.4, want: by === 'enzo' ? 'dora' : null };
        if (b.st === 'wobble' || b.st === 'sweep' || b.st === 'sweepw') return { m: by === 'dora' ? 1.2 : by === 'enzo' ? 0.6 : 1, want: null };
        // up on his stilts only a jump reaches his body; his leg stuck in the planks wants Enzo
        if (this.hero().h > 30) return { m: by === 'dora' ? 0.9 : 0.6, want: null };
        return { m: 0.08, want: b.st === 'stomp' && by === 'dora' ? 'enzo' : null };
      }
      case 'tanglejaw': {
        // only stuck out of his last free hole is he open; with fewer than two holes plugged he just slips back
        if (b.st === 'stretched' && this.plugs() >= 2) return { m: by === 'dora' ? 3.0 : by === 'enzo' ? 0.8 : 1.5, want: by === 'enzo' ? 'dora' : null };
        if (b.st === 'stretched') return { m: 0.3, want: by === 'dora' ? 'enzo' : null };
        return { m: 0.15, want: null };
      }
    }
  }
  damageBoss(dmg: number, by: HeroId | 'dbl' | 'item', x: number, h: number, heavy: boolean, tag = false, key = '') {
    const b = this.boss!; if (b.st === 'end' || b.st === 'gone' || b.st === 'intro') return;
    if (b.kind === 'tanglejaw' && (b.st === 'under' || b.st === 'sink')) return;
    // a barrel thrown into Longshanks' stilts bowls him over
    if (b.kind === 'longshanks' && by === 'item' && this.lsStanding(b)) { b.hp = Math.max(1, b.hp - dmg); this.topple(b, 'BOWLED OVER!'); return; }
    if (b.kind === 'tanglejaw' && b.st === 'stretched' && by === 'dora' && this.plugs() >= 2) this.learned.tjkick = (this.learned.tjkick || 0) + 1;
    if (b.kind === 'longshanks' && b.st === 'toppled' && by === 'dora') this.learned.lsTag = (this.learned.lsTag || 0) + 1;
    // the bosses' own counters: the Admiral is knocked out of his dive by Dora; Knuckles is staggered in his tell
    if (b.kind === 'admiral' && by === 'dora' && (b.st === 'dive' || b.st === 'swoop' || (b.st === 'shriek' && b.h < 200))) {
      b.st = 'tumble'; b.t = 0; b.vh = 200; this.hitstop(0.12); this.shakeBy(9); this.sfx('kick3'); this.sfx('squawk');
      this.ev({ k: 'sparks', x, z: b.z, h, col: '#fff0c8', n: 16, big: 1.5 }); this.ev({ k: 'word', x: b.x, z: b.z, h: b.h + 170, text: 'KNOCKED DOWN!', col: '#fff0c8' });
      b.hp = Math.max(1, b.hp - dmg * 2); this.comboHit(true, b.x, b.z, b.h + 80); this.learned.counterDive = (this.learned.counterDive || 0) + 1;
      return;
    }
    if (b.kind === 'admiral' && by === 'dora' && (b.st === 'grounded')) {
      // Dora's kicks just send him flapping off
      b.st = 'rise'; b.t = 0; this.wrong(x, b.z, h, 'enzo'); b.hp = Math.max(1, b.hp - dmg * 0.15); return;
    }
    if (b.kind === 'knuckles' && b.st === 'tell') { b.st = 'dizzy'; b.t = 0; this.hitstop(0.1); this.sfx('counter'); this.ev({ k: 'word', x: b.x, z: b.z, h: 220, text: 'COUNTER!', col: '#ffe08a' }); this.learned.counter = 1; }
    if (b.kind === 'knuckles' && b.st === 'hop' && by === 'dora') { b.st = 'down'; b.t = 0; b.vh = 0; this.hitstop(0.1); this.sfx('kick3'); this.ev({ k: 'word', x: b.x, z: b.z, h: b.h + 200, text: 'KNOCKED DOWN!', col: '#fff0c8' }); }
    if (b.kind === 'brute' && b.armour > 0 && (((by === 'enzo') && (heavy || tag)) || by === 'item' || by === 'dbl')) {
      b.armour--; b.flash = 0.12; this.hitstop(0.09); this.shakeBy(7); this.sfx('crack');
      this.ev({ k: 'sparks', x, z: b.z, h, col: '#c9d3df', n: 14, big: 1.3 }); this.ev({ k: 'debris', x, z: b.z, kind: 'barnacle' });
      this.ev({ k: 'word', x: b.x, z: b.z, h: 230, text: b.armour ? `BARNACLES ${3 - b.armour}/3` : 'BARE!', col: '#e8eef6' });
      if (!b.armour) { b.st = 'bare'; b.t = 0; this.sfx('festFull'); }
      b.hp = Math.max(1, b.hp - dmg * 0.6); return;
    }
    const { m, want } = this.bossMult(by);
    let d = dmg * m * (1 + 0.15 * Math.min(3, this.combo.chain));
    b.hp = Math.max(0, b.hp - d); b.flash = 0.1;
    this.comboHit(heavy, b.x, b.z, b.h + 100);
    if (m >= 1) {
      b.hurtT = 0.16; b.tinks = 0;
      this.ev({ k: 'sparks', x, z: b.z + 5, h, col: '#ffd27a', n: 12, big: 1.4 }); this.sfx(by === 'enzo' ? 'slam' : 'kick3'); this.hitstop(0.08); this.shakeBy(7);
      if (b.kind === 'clamps' && by === 'dora' && b.st === 'bare') { b.h = Math.min(90, b.h + 30); b.vh = 260; b.st = 'juggle'; b.t = 0; }
    } else if (want) {
      b.tinks++; this.wrong(x, b.z, h, want); this.hitstop(0.03);
    } else {
      this.ev({ k: 'sparks', x, z: b.z + 5, h, col: '#fff3d6', n: 6, big: 1 }); this.sfx('punch'); this.hitstop(0.04);
    }
    if (b.hp <= 0) {
      b.st = 'end'; b.t = 0; this.hitstop(0.3); this.shakeBy(16); this.sfx('boom'); this.ev({ k: 'flash', a: 0.45 });
      for (const f of this.foes) if (this.hittable(f)) this.koFoe(f, sgn(f.x - b.x) * 200);
    }
  }
  private updBoss() {
    const b = this.boss!, p = this.hero(), A = this.assist;
    b.t += DT; b.flash -= DT; b.hurtT -= DT; b.ghost = Math.max(b.hp, b.ghost - 0.25);
    const homeX = this.camR - 150;
    const ph = b.hp > b.max * 0.66 ? 1 : b.hp > b.max * 0.33 ? 2 : 3;
    if (ph > b.phase && b.st !== 'end') {
      if (b.kind === 'tanglejaw') { this.popPlugs(); b.st = 'roar'; b.t = 0; b.ext = 0; }
      b.phase = ph; this.sfx(b.kind === 'admiral' ? 'shriek' : 'roar'); this.shakeBy(8); this.ev({ k: 'word', x: b.x, z: b.z, h: 260, text: ph === 3 ? 'FURIOUS!' : 'ANGRY!', col: '#ffb48a' }); }
    if (b.st === 'intro') {
      if (b.kind !== 'tanglejaw') b.x += (homeX - b.x) * DT * 2.2;
      if (b.t > 1.4) { b.st = b.kind === 'admiral' ? 'hover' : b.kind === 'tanglejaw' ? 'sink' : 'idle'; b.t = 0; this.shakeBy(8); this.sfx('boom'); this.ev({ k: 'dust', x: b.x - 60, z: b.z, n: 12, size: 2 }); }
      return;
    }
    if (b.st === 'end') {
      this.bossHint = null;
      if (b.t > 2.4) { b.x += 260 * DT; if (b.x > this.camR + 60 && b.t < 9) { this.ev({ k: 'splash', x: this.camR - 40 }); this.sfx('splash'); b.t = 9; } }
      if (b.t > 9.4 || (b.t > 3.6 && b.x > this.camR + 60)) b.st = 'gone';
      return;
    }
    if (b.st === 'gone') { this.bossHint = null; return; }
    if (b.st !== b.lastSt) { b.first = !b.seen.includes(b.st); if (b.first) b.seen.push(b.st); b.lastSt = b.st; }
    if (b.hinted < b.phase) { b.hinted = b.phase; const [who, act] = BOSS_HINT[b.kind][b.phase - 1]; this.bossHint = { who, act, t: 3.6, phase: b.phase }; this.sfx('ready'); }
    if (this.bossHint) { this.bossHint.t -= DT; if (this.bossHint.t <= 0) this.bossHint = null; }
    // helpers once the boss is angry
    if (b.phase >= 2 && b.summoned < 1) { b.summoned = 1; const k: FoeKind = b.kind === 'admiral' ? 'gull' : b.kind === 'tanglejaw' ? 'eel' : 'crab'; this.spawnFoe(k, 1); this.spawnFoe(k, -1); }
    if (b.phase >= 3 && b.summoned < 2 && b.kind !== 'clamps') { b.summoned = 2; this.spawnFoe(b.kind === 'admiral' ? 'jelly' : b.kind === 'longshanks' || b.kind === 'tanglejaw' ? 'cormorant' : 'crab', 1); }
    switch (b.kind) {
      case 'brute': this.updBrute(b, p, A, homeX); break;
      case 'clamps': this.updClamps(b, p, A, homeX); break;
      case 'knuckles': this.updKnuckles(b, p, A, homeX); break;
      case 'admiral': this.updAdmiral(b, p, A); break;
      case 'longshanks': this.updLongshanks(b, p, A); break;
      case 'tanglejaw': this.updTanglejaw(b, p, A); break;
    }
    b.z = clamp(b.z, 10, DEPTH - 10);
    if (b.kind !== 'admiral' && b.kind !== 'tanglejaw') b.x = clamp(b.x, this.camL + 90, this.camR - 60);
  }
  private approach(b: Boss, p: Hero, sp: number, gap: number) {
    const side = sgn(b.x - p.x) || 1;
    const tx = clamp(p.x + side * gap, this.camL + 120, this.camR - 80);
    b.x += clamp(tx - b.x, -sp * DT, sp * DT); b.z += clamp(p.z - b.z, -sp * 0.6 * DT, sp * 0.6 * DT);
    b.face = sgn(p.x - b.x) || -1;
    return Math.abs(tx - b.x) < 12 && Math.abs(p.z - b.z) < 20;
  }
  private updBrute(b: Boss, p: Hero, A: boolean, _homeX: number) {
    const F = b.first ? 1.5 : 1;   // the first time a telegraph shows, it is held half as long again
    switch (b.st) {
      case 'idle':
        if (this.approach(b, p, b.armour ? 80 : 120, 150) || b.t > 2.6) { b.st = 'tell'; b.t = 0; this.sfx('tell'); b.tx = p.x; b.tz = p.z; }
        break;
      case 'tell':
        if (b.t < (A ? 0.8 : 0.55) * F) { b.tx = b.x + b.face * 130; b.tz = b.z; }
        if (b.t > (A ? 1.35 : 0.95) * F) { b.st = 'stomp'; b.t = 0; b.didHit = false; }
        break;
      case 'stomp':
        if (!b.didHit && b.t > 0.06) {
          b.didHit = true; this.shakeBy(12); this.sfx('boom'); this.ev({ k: 'ring', x: b.tx, z: b.tz, size: 140, col: '#ffe29a', life: 0.5 }); this.ev({ k: 'dust', x: b.tx, z: b.tz, n: 12, size: 1.8 });
          const dx = (p.x - b.tx) / 115, dz = (p.z - b.tz) / 50;
          if (dx * dx + dz * dz < 1 && p.h < 60) this.hurtHero(p, 14, b.tx, 380, true);
        }
        if (b.t > 0.7) { b.st = b.armour ? 'idle' : 'bare'; b.t = 0; }
        break;
      case 'bare':
        // soft and sheepish: he backs off and swipes weakly; Dora's chance
        this.approach(b, p, 90, 170);
        if (b.t > (A ? 6 : 4.5)) { b.st = 'regrow'; b.t = 0; this.sfx('regrow'); }
        break;
      case 'regrow':
        if (b.t > 0.8) { b.armour = 3; b.st = 'idle'; b.t = 0; }
        break;
    }
  }
  private updClamps(b: Boss, p: Hero, A: boolean, homeX: number) {
    const rollSp = 640 + (b.phase - 1) * 80;
    const F = b.first ? 1.5 : 1;   // the first time a telegraph shows, it is held half as long again
    switch (b.st) {
      case 'idle': {
        if (b.h > 0) { b.vh -= GRAV * DT; b.h = Math.max(0, b.h + b.vh * DT); }
        const close = this.approach(b, p, 90, 140);
        if (close && b.t > 0.8 && b.n % 3 !== 2) { b.st = 'wind'; b.t = 0; this.sfx('tell'); b.n++; break; }
        if (b.t > (A ? 2.4 : 1.8)) { b.st = 'rock'; b.t = 0; b.tz = p.z; b.n++; this.sfx('creak'); }
        break;
      }
      case 'wind': if (b.t > (A ? 0.75 : 0.5) * F) { b.st = 'swipe'; b.t = 0; b.didHit = false; this.sfx('whoosh'); } break;
      case 'swipe':
        if (!b.didHit && b.t > 0.05) { b.didHit = true; if (Math.abs(p.x - (b.x + b.face * 90)) < 90 && Math.abs(p.z - b.z) < 40 && p.h < 70) this.hurtHero(p, 10, b.x, 320); }
        if (b.t > 0.5) { b.st = 'idle'; b.t = 0; }
        break;
      case 'rock':
        // he rocks back twice (the creak and the lane marked on the deck), then rolls along that lane
        b.z += clamp(b.tz - b.z, -120 * DT, 120 * DT);
        if (b.t > (A ? 1.6 : 1.15) * F) { b.st = 'roll'; b.t = 0; b.didHit = false; b.dir = p.x < b.x ? -1 : 1; this.sfx('rumble'); }
        break;
      case 'roll': {
        b.x += b.dir * rollSp * DT;
        if (!b.didHit && Math.abs(p.x - b.x) < 80 && Math.abs(p.z - b.z) < 38 && p.h < 55) { b.didHit = true; this.hurtHero(p, 14, b.x - b.dir * 50, 420, true); }
        for (const f of this.foes) if (this.hittable(f) && Math.abs(f.x - b.x) < 70 && Math.abs(f.z - b.z) < 36 && f.h < 50) this.damageFoe(f, 3, { kb: b.dir * 400, down: true, by: 'item', x: f.x, h: 40 });
        if ((b.dir < 0 && b.x < this.camL + 110) || (b.dir > 0 && b.x > this.camR - 70)) {
          b.x = clamp(b.x, this.camL + 110, this.camR - 70);
          this.shakeBy(9); this.sfx('boom'); this.ev({ k: 'dust', x: b.x, z: b.z, n: 12, size: 1.8 });
          if (b.phase >= 2 && b.cycle % 2 === 0) { b.cycle++; b.st = 'rock'; b.t = A ? 0.5 : 0.4; b.tz = p.z; this.sfx('creak'); }
          else { b.cycle++; b.st = 'dizzy'; b.t = 0; b.face = -b.dir; }
        }
        break;
      }
      case 'dizzy':
        if (b.t > (A ? 4 : 3)) { b.st = 'idle'; b.t = 0; }
        break;
      case 'ripping':
        if (b.t > 0.5) {
          b.layers--; this.shakeBy(9); this.hitstop(0.1); this.sfx('crack');
          this.addItem('barrel', b.x + b.face * 60, b.z, 60, b.face * 100, 300);
          this.ev({ k: 'word', x: b.x, z: b.z, h: 230, text: b.layers > 0 ? 'ONE MORE BARREL!' : 'NO SHELL!', col: '#fff0c8' });
          if (b.layers > 0) { b.st = 'dizzy'; b.t = A ? 1.5 : 1.8; } else { b.st = 'bare'; b.t = 0; this.sfx('festFull'); }
        }
        break;
      case 'bare': case 'juggle':
        if (b.h > 0 || b.vh > 0) { b.vh -= GRAV * DT; b.h = Math.max(0, b.h + b.vh * DT); if (b.h <= 0) { b.vh = 0; b.st = 'bare'; } }
        if (b.st === 'bare' && b.t > (A ? 6 : 4.5) && b.h <= 0) { b.st = 'rebarrel'; b.t = 0; }
        if (b.st === 'juggle' && b.t > 1.5) b.st = 'bare';
        break;
      case 'rebarrel':
        // he scuttles to the barrel pile at the far side and climbs back in
        b.x += clamp(homeX - b.x, -300 * DT, 300 * DT);
        if (b.t > 1.0) { b.layers = b.phase >= 3 ? 2 : 1; b.st = 'idle'; b.t = 0; this.sfx('creak'); }
        break;
    }
  }
  private updKnuckles(b: Boss, p: Hero, A: boolean, _homeX: number) {
    const F = b.first ? 1.5 : 1;   // the first time a telegraph shows, it is held half as long again
    switch (b.st) {
      case 'idle':
        if (this.approach(b, p, 170, 135) && b.t > 0.5) {
          b.n++;
          if (b.n % 4 === 0) { b.st = 'guard'; b.t = 0; this.sfx('guard'); }
          else if (b.n % 4 === 2) { b.st = 'crouch'; b.t = 0; this.sfx('tell'); }
          else { b.st = 'tell'; b.t = 0; this.sfx('tell'); }
        }
        if (b.t > 2.5) { b.st = 'tell'; b.t = 0; this.sfx('tell'); }
        break;
      case 'tell': if (b.t > (A ? 0.95 : 0.7) * F) { b.st = 'punch'; b.t = 0; b.didHit = false; this.sfx('whoosh'); } break;
      case 'punch':
        if (b.t < 0.1) b.x += b.face * 400 * DT;
        if (!b.didHit && b.t > 0.05) { b.didHit = true; if (Math.abs(p.x - (b.x + b.face * 80)) < 90 && Math.abs(p.z - b.z) < 34 && p.h < 80) this.hurtHero(p, 11, b.x, 380); }
        if (b.t > (b.phase >= 2 ? 0.35 : 0.55)) { b.st = b.phase >= 2 && b.cycle++ % 2 === 0 ? 'tell' : 'idle'; b.t = 0; }
        break;
      case 'guard':
        b.face = sgn(p.x - b.x) || -1;
        if (b.t > (A ? 3.2 : 2.6)) { b.st = 'idle'; b.t = 0; }
        break;
      case 'crouch': if (b.t > (A ? 0.7 : 0.5) * F) { b.st = 'hop'; b.t = 0; b.vh = 900; b.tx = p.x; b.tz = p.z; this.sfx('jump'); } break;
      case 'hop':
        b.x += clamp(b.tx - b.x, -320 * DT, 320 * DT); b.z += clamp(b.tz - b.z, -150 * DT, 150 * DT);
        b.vh -= GRAV * 0.8 * DT; b.h = Math.max(0, b.h + b.vh * DT);
        if (b.h <= 0 && b.vh < 0) {
          b.h = 0; b.vh = 0; this.shakeBy(9); this.sfx('boom'); this.ev({ k: 'ring', x: b.x, z: b.z, size: 120, col: '#ffe29a', life: 0.4 });
          if (Math.abs(p.x - b.x) < 100 && Math.abs(p.z - b.z) < 45 && p.h < 50) this.hurtHero(p, 12, b.x, 360, true);
          b.st = 'idle'; b.t = 0;
        }
        break;
      case 'thrown':
        // Enzo hoists him out of his guard and slams him on the boards
        if (b.t > 0.5) { b.st = 'down'; b.t = 0; this.hitstop(0.12); this.shakeBy(12); this.sfx('flop'); b.hp = Math.max(0, b.hp - 6); this.ev({ k: 'dust', x: b.x, z: b.z, n: 14, size: 1.8 }); if (b.hp <= 0) this.damageBoss(0.01, 'enzo', b.x, 40, true); }
        break;
      case 'down':
        if (b.h > 0 || b.vh > 0) { b.vh -= GRAV * DT; b.h = Math.max(0, b.h + b.vh * DT); }
        if (b.t > 0.6 && b.h <= 0) { b.st = 'dizzy'; b.t = 0; }
        break;
      case 'dizzy':
        if (b.t > (A ? 3.4 : 2.6)) { b.st = 'idle'; b.t = 0; b.n = 0; }
        break;
    }
  }
  private updAdmiral(b: Boss, p: Hero, A: boolean) {
    const hoverH = 175;
    const F = b.first ? 1.5 : 1;   // the first time a telegraph shows, it is held half as long again
    switch (b.st) {
      case 'hover': case 'idle': {
        b.st = 'hover';
        const side = sgn(b.x - p.x) || 1;
        const tx = clamp(p.x + side * 200, this.camL + 100, this.camR - 100);
        b.x += clamp(tx - b.x, -160 * DT, 160 * DT); b.z += clamp(p.z - b.z, -90 * DT, 90 * DT);
        b.h += (hoverH + Math.sin(this.rt * 2) * 12 - b.h) * DT * 3; b.face = sgn(p.x - b.x) || -1;
        if (b.t > (A ? 1.9 : 1.4)) {
          b.n++;
          if (b.n % 3 === 0) { b.st = 'wingtell'; b.t = 0; this.sfx('tell2'); b.tz = p.z; }
          else { b.st = 'shriek'; b.t = 0; this.sfx('shriek'); b.tx = p.x; b.tz = p.z; }
        }
        break;
      }
      case 'shriek': {
        // the growing shadow follows you, then locks; then he dives at it
        const T = (A ? 1.3 : 0.95) * F;
        if (b.t < T * 0.65) { b.tx = p.x; b.tz = p.z; }
        b.h += (hoverH + 30 - b.h) * DT * 3;
        if (b.t > T) { b.st = 'dive'; b.t = 0; b.didHit = false; this.sfx('whoosh'); }
        break;
      }
      case 'dive': {
        const dx = b.tx - b.x, dz = b.tz - b.z, dh = -b.h, L3 = Math.hypot(dx, dz, dh) || 1, sp = 720 * DT;
        b.face = sgn(dx) || b.face;
        if (L3 <= sp) {
          b.x = b.tx; b.z = b.tz; b.h = 0; this.shakeBy(8); this.sfx('boom'); this.ev({ k: 'dust', x: b.x, z: b.z, n: 12, size: 1.6 });
          b.st = b.phase >= 2 && b.cycle++ % 2 === 0 ? 'redive' : 'skid'; b.t = 0;
        } else { b.x += dx / L3 * sp; b.z += dz / L3 * sp; b.h += dh / L3 * sp; }
        if (!b.didHit && Math.abs(p.x - b.x) < 60 && Math.abs(p.z - b.z) < 30 && Math.abs(p.h + 80 - b.h) < 80 && b.h < 140) { b.didHit = true; this.hurtHero(p, 13, b.x, 360, true); }
        break;
      }
      case 'redive': b.h += 400 * DT; if (b.h > 120) { b.st = 'shriek'; b.t = A ? 0.35 : 0.3; this.sfx('shriek'); } break;
      case 'skid':
        // a missed dive leaves him stuck in the boards for a moment (longer with assist)
        if (b.t > (A ? 1.3 : 0.7)) { b.st = 'rise'; b.t = 0; }
        break;
      case 'tumble':
        b.vh -= GRAV * DT; b.h = Math.max(0, b.h + b.vh * DT);
        if (b.h <= 0) { b.st = 'grounded'; b.t = 0; this.shakeBy(6); this.ev({ k: 'dust', x: b.x, z: b.z, n: 10, size: 1.4 }); }
        break;
      case 'grounded':
        if (b.t > (A ? 5 : 3.6)) { b.st = 'rise'; b.t = 0; this.sfx('flutter'); }
        break;
      case 'pinned':
        b.pinned += DT;
        if (b.pinned > (A ? 3 : 2.3) || this.hero().name !== 'enzo') { b.st = 'rise'; b.t = 0; this.sfx('flutter'); }
        break;
      case 'rise':
        b.h += 300 * DT; if (b.h > hoverH - 10) { b.st = 'hover'; b.t = 0; }
        break;
      case 'wingtell':
        b.h += (60 - b.h) * DT * 4; b.z += clamp(b.tz - b.z, -80 * DT, 80 * DT);
        if (b.t > (A ? 1.1 : 0.8) * F) { b.st = 'swoop'; b.t = 0; b.didHit = false; b.dir = p.x < b.x ? -1 : 1; this.sfx('whoosh'); }
        break;
      case 'swoop':
        b.x += b.dir * 720 * DT; b.face = b.dir;
        if (!b.didHit && Math.abs(p.x - b.x) < 70 && Math.abs(p.z - b.z) < 36 && p.h < 50) { b.didHit = true; this.hurtHero(p, 11, b.x - b.dir * 40, 380); }
        if (b.x < this.camL - 80 || b.x > this.camR + 80) { b.st = 'rise'; b.t = 0; b.x = clamp(b.x, this.camL + 60, this.camR - 60); }
        break;
    }
    // in phase 3 he cuts the cargo nets loose over your head
    if (b.phase >= 3 && b.st === 'hover' && b.t > 0.5 && b.t - DT <= 0.5) {
      const x = clamp(p.x, this.camL + 80, this.camR - 80);
      this.props.push({ id: this.nid++, kind: 'net', x, z: p.z, hp: 1, content: '', sid: '', alive: true, vx: 0, hitList: [], fall: 0.01 - 0.65, down: false, flash: 0 });
    }
  }

  lsStanding(b: Boss) { return !['toppled', 'heave', 'getup', 'end', 'gone', 'intro'].includes(b.st); }
  private topple(b: Boss, text: string) {
    b.st = 'toppled'; b.t = 0; b.h = 0; this.sfx('boom'); this.shakeBy(10); this.hitstop(0.1);
    this.ev({ k: 'dust', x: b.x, z: b.z, n: 14, size: 2 }); this.ev({ k: 'word', x: b.x, z: b.z, h: 200, text, col: '#fff0c8' });
    this.learned.topple = (this.learned.topple || 0) + 1;
  }
  /** Longshanks the Rigger, a spider crab on stilts. His body is up out of reach of anything but a jump. He stomps
   *  a leg down where a ring marks the boards, and it sticks: Enzo heaves on it and topples him, and Dora kicks him
   *  while he's down. From phase 2 he sweeps his legs low (jump it), from phase 3 he stomps twice and the belt runs. */
  private updLongshanks(b: Boss, p: Hero, A: boolean) {
    const F = b.first ? 1.5 : 1;   // the first time a telegraph shows, it is held half as long again
    switch (b.st) {
      case 'idle': {
        b.h = 110;
        const close = this.approach(b, p, 105, 170);
        if ((close && b.t > 0.7) || b.t > (A ? 2.6 : 2)) {
          b.n++;
          if (b.phase >= 2 && b.n % 2 === 0) { b.st = 'sweepw'; b.t = 0; this.sfx('tell'); b.dir = sgn(p.x - b.x) || -1; b.face = b.dir; }
          else { b.st = 'stomptell'; b.t = 0; this.sfx('creak'); b.tx = p.x; b.tz = p.z; b.cycle = b.phase >= 3 ? 2 : 1; b.face = sgn(p.x - b.x) || -1; }
        }
        break;
      }
      case 'stomptell': {
        // the ring follows you, then locks; he strides over so the leg comes down on it
        const T = (A ? 1.35 : 1.0) * F;
        if (b.t < T * 0.6) { b.tx = clamp(p.x, this.camL + 100, this.camR - 80); b.tz = p.z; b.face = sgn(b.tx - b.x) || b.face; }
        const bx = clamp(b.tx - b.face * 95, this.camL + 90, this.camR - 60);
        b.x += clamp(bx - b.x, -240 * DT, 240 * DT); b.z += clamp(b.tz - b.z, -150 * DT, 150 * DT);
        if (b.t > T) {
          b.st = 'stomp'; b.t = 0; this.sfx('boom'); this.shakeBy(8); this.ev({ k: 'dust', x: b.tx, z: b.tz, n: 12, size: 1.6 });
          if (Math.abs(p.x - b.tx) < 72 && Math.abs(p.z - b.tz) < 32 && p.h < 60 && p.st !== 'out') this.hurtHero(p, 12, b.tx, 340, true);
          else this.learned.stompDodge = (this.learned.stompDodge || 0) + 1;
        }
        break;
      }
      case 'stomp':
        // the leg is stuck fast in the planks for a moment: Enzo's Attack beside it heaves him over
        if (b.t > (A ? 3.2 : 2.4)) { if (b.cycle > 1) { b.cycle--; b.st = 'stomptell'; b.t = A ? 0.45 : 0.35; this.sfx('creak'); } else { b.st = 'idle'; b.t = 0; } }
        break;
      case 'heave': if (b.t > 0.5) this.topple(b, 'TOPPLED!'); break;
      case 'toppled':
        b.h = 0;
        if (b.t > (A ? 5 : 3.8)) { b.st = 'getup'; b.t = 0; this.sfx('creak'); }
        break;
      case 'getup': if (b.t > 0.8) { b.st = 'idle'; b.t = 0; b.h = 110; } break;
      case 'sweepw':
        b.h = 60;
        if (b.t > (A ? 1.25 : 0.9) * F) { b.st = 'sweep'; b.t = 0; b.didHit = false; this.sfx('whoosh'); }
        break;
      case 'sweep': {
        const x0 = b.x - b.dir * 60, x1 = b.x + b.dir * 330;
        if (!b.didHit && b.t > 0.08) {
          b.didHit = true;
          if (p.x > Math.min(x0, x1) && p.x < Math.max(x0, x1) && Math.abs(p.z - b.z) < 75 && p.h < 45 && p.st !== 'out') this.hurtHero(p, 11, b.x, 360);
          else this.learned.sweep = (this.learned.sweep || 0) + 1;
        }
        if (b.t > 0.45) { b.st = 'wobble'; b.t = 0; }
        break;
      }
      case 'wobble': if (b.t > (A ? 1.5 : 1.0)) { b.st = 'idle'; b.t = 0; b.h = 110; } break;
    }
  }
  /** Old Tanglejaw, a moray in the drydock's three drain holes. A hole bubbles and glows, then he lunges along the
   *  boards from it. Enzo carries barrels onto two of the holes; then every lunge comes from the last one and leaves
   *  him stuck out on the stone, where Dora's kicks land hard. Each new phase his roar blows the barrels out again.
   *  From phase 2 he whips round low when you're close to his hole (jump it); in phase 3 he's quicker. */
  private updTanglejaw(b: Boss, p: Hero, A: boolean) {
    const F = b.first ? 1.5 : 1, H = this.holes, hole = H[b.hole];
    b.h = 0;
    switch (b.st) {
      case 'under': {
        b.ext = 0; b.x = hole.x;
        if (b.t > (this.plugs() >= 2 ? 0.6 : A ? 1.2 : 0.9) - (b.phase >= 3 ? 0.2 : 0)) {
          const free = H.map((_, i) => i).filter((i) => !H[i].plug);
          let i = free[0];
          if (this.rnd() < 0.7) { let bd = 1e9; for (const j of free) { const d = Math.abs(H[j].x - p.x) + Math.abs(H[j].z - p.z); if (d < bd) { bd = d; i = j; } } }
          else i = free[Math.floor(this.rnd() * free.length)];
          b.hole = i; b.x = H[i].x; b.z = H[i].z; b.tx = H[i].x; b.tz = H[i].z;
          b.dir = this.tjDir(i, p); b.face = b.dir;
          b.st = 'bubble'; b.t = 0; this.sfx('bubble');
        }
        break;
      }
      case 'bubble': {
        const T = (A ? 1.5 : 1.1) * F;
        if (b.t < T * 0.6) { b.dir = this.tjDir(b.hole, p); b.face = b.dir; }
        if (b.t > T) {
          const near = Math.abs(p.x - hole.x) < 230 && Math.abs(p.z - hole.z) < 90;
          if (b.phase >= 2 && near && b.n % 2 === 1) { b.st = 'whipw'; b.t = 0; this.sfx('tell2'); }
          else { b.st = 'strike'; b.t = 0; b.didHit = false; this.sfx('whoosh'); }
          b.n++;
        }
        break;
      }
      case 'strike': {
        // the lunge stops short of the dock walls, so his head is always somewhere you can reach it
        const room = b.dir > 0 ? this.camR - 90 - hole.x : hole.x - (this.camL + 60);
        b.ext = Math.min(1, b.t / 0.16) * Math.max(60, Math.min(A ? 300 : 340, room)); b.x = hole.x + b.dir * b.ext;
        const lo = Math.min(hole.x, b.x) - 30, hi = Math.max(hole.x, b.x) + 40;
        if (!b.didHit && p.x > lo && p.x < hi && Math.abs(p.z - hole.z) < 32 && p.h < 50 && p.st !== 'out') { b.didHit = true; this.hurtHero(p, 13, hole.x, 380, true); }
        if (b.t > 0.3) {
          if (!b.didHit) this.learned.tjdodge = (this.learned.tjdodge || 0) + 1;
          b.st = 'stretched'; b.t = 0;
          if (this.plugs() >= 2) { this.ev({ k: 'word', x: b.x, z: b.z, h: 140, text: 'STUCK!', col: '#fff0c8' }); this.sfx('festFull'); }
        }
        break;
      }
      case 'stretched':
        if (b.t > (this.plugs() >= 2 ? (A ? 4.2 : 3.0) : (A ? 1.1 : 0.8))) { b.st = 'sink'; b.t = 0; }
        break;
      case 'sink':
        b.ext = Math.max(0, b.ext - 1400 * DT); b.x = hole.x + b.dir * b.ext;
        if (b.t > 0.4) { b.st = 'under'; b.t = 0; b.x = hole.x; }
        break;
      case 'roar': b.ext = 0; b.x = hole.x; if (b.t > 1.1) { b.st = 'sink'; b.t = 0; } break;   // a new phase: the plugs fly out
      case 'bonk': if (b.t > 0.6) { b.st = 'under'; b.t = 0; } break;                         // a barrel jammed on his head
      case 'whipw': if (b.t > (A ? 1.15 : 0.85) * F) { b.st = 'whip'; b.t = 0; b.didHit = false; this.sfx('whoosh'); } break;
      case 'whip':
        if (!b.didHit && b.t > 0.1) {
          b.didHit = true;
          if (Math.abs(p.x - hole.x) < 240 && Math.abs(p.z - hole.z) < 80 && p.h < 45 && p.st !== 'out') this.hurtHero(p, 11, hole.x, 380);
          else this.learned.whip = (this.learned.whip || 0) + 1;
        }
        if (b.t > 0.55) { b.st = 'sink'; b.t = 0; }
        break;
    }
  }

  // ─────────────────────────────────────────── prompts: the player's own keys, only when needed
  private needPrompt(): Prompt | null {
    const p = this.hero(), q = this.partner(), T = this.tut, L = this.learned;
    if (this.mode !== 'play' || this.dblT >= 0) return null;
    const canTag = q.hp > 0 && q.ready;
    const foe = (f: Foe | null) => !!f && f.st !== 'ko';
    if (this.fest >= 100 && !L.dbl && canTag) return { act: 'dbl', who: 'hero' };
    if (T.stage < 9) {
      if (T.stage === 1) {
        const f = this.foes.find((g) => g.st !== 'ko');
        if (f && Math.abs(f.x - p.x) > 150 && this.t - T.lastMove > 1.6 && T.t > 1.2) return { act: 'move', who: 'hero' };
        if (f && Math.abs(f.x - p.x) < 170 && !L.atk) return { act: 'atk', who: 'hero' };
      }
      if (T.stage === 2 && foe(T.hermit)) {
        if (p.name === 'dora' && (T.tinks >= 2 || T.t > 6)) return { act: 'tag', who: 'partner', tint: 'grey' };
        if (p.name === 'enzo' && p.st === 'hold') return { act: 'atk', who: 'hero' };
        if (p.name === 'enzo' && T.hermit!.shell && Math.abs(T.hermit!.x - p.x) < 260) return { act: 'grab', who: 'foe', x: T.hermit!.x, z: T.hermit!.z, h: 120, dir: sgn(T.hermit!.x - p.x) || 1 };
      }
      if (T.stage === 3 && foe(T.gull)) {
        if (p.name === 'enzo' && p.st === 'hold') return { act: 'atk', who: 'hero' };
        if (p.name === 'enzo' && T.gull!.h > 40 && T.t > 2.2 && canTag) return { act: 'tag', who: 'partner', tint: 'cream' };
        if (p.name === 'dora' && T.gull!.h > 40 && p.h <= 0 && Math.abs(T.gull!.x - p.x) < 260 && (L.air || 0) < 1) return { act: 'jmp', who: 'hero' };
        if (p.name === 'dora' && p.h > 30 && !p.airUsed && (L.air || 0) < 1) return { act: 'atk', who: 'hero' };
      }
      return null;
    }
    // the dash special, the first time a line of foes is waiting in one lane
    if ((L.special || 0) < 1 && this.teachT > -20) {
      const line = this.foes.filter((f) => this.hittable(f) && f.h < 30 && f.st !== 'down');
      for (const dir of [1, -1]) {
        const ahead = line.filter((f) => (f.x - p.x) * dir > 60 && (f.x - p.x) * dir < 520 && Math.abs(f.z - p.z) < 44);
        if (ahead.length >= 3) return { act: 'special', who: 'hero', dir };
      }
      if (this.wave?.def.teach && this.teachT > 0) {
        const lane = line.filter((f) => f.lane >= 0);
        if (lane.length >= 3 && Math.abs(lane[0].z - p.z) > 44) return { act: 'move', who: 'hero', dir: lane[0].z > p.z ? 2 : -2 };
      }
    }
    // scene goals: knock the swooping thief down; keep ahead of the tide
    const G = this.goal;
    if (G && !G.done && G.kind === 'chase' && !G.won && (L.chase || 0) < 2 && (G.st === 'swoopw' || G.st === 'swoop')) {
      if (p.name === 'dora' && p.h <= 0 && Math.abs(G.x - p.x) < 300) return { act: 'jmp', who: 'foe', x: G.x, z: G.z, h: G.h + 90 };
      if (p.name === 'dora' && p.h > 30 && !p.airUsed) return { act: 'atk', who: 'foe', x: G.x, z: G.z, h: G.h + 90 };
      if (p.name === 'enzo' && p.st === 'hold') return { act: 'atk', who: 'hero' };
      if (p.name === 'enzo' && canTag) return { act: 'tag', who: 'partner', tint: 'cream' };
    }
    if (G && !G.done && G.kind === 'tide' && p.x < G.front + 140 && (L.tide || 0) < 3 && !this.foes.some((f) => f.st !== 'ko' && Math.abs(f.x - p.x) < 160)) return { act: 'go', who: 'hero' };
    // wrong hero, twice in a row: the partner's portrait asks to tag
    if (this.wrongN >= 2 && this.wrongT > 0 && canTag) {
      const want = p.name === 'dora' ? 'enzo' : 'dora';
      return { act: 'tag', who: 'partner', tint: want === 'enzo' ? 'grey' : 'cream' };
    }
    // a barrel rumbling down the belt in your lane: step out of it (Enzo, once you know: punch it to a stop)
    if ((L.belt || 0) < 3 || (p.name === 'enzo' && (L.stop || 0) < 1)) {
      const r = this.rolls.find((c) => c.kind === 'barrel' && c.t > 0.25 && c.x > p.x - 40 && Math.abs(LANE_Z[c.lane] - p.z) < 30);
      if (r && p.h <= 0) {
        if (p.name === 'enzo' && (L.belt || 0) >= 1 && (L.stop || 0) < 1 && r.t >= r.tell && r.x - p.x < 320) return { act: 'atk', who: 'hero' };
        if ((L.belt || 0) < 3) return { act: 'move', who: 'hero', dir: p.z > 80 ? -2 : 2 };
      }
    }
    // the first cormorant's ring: Dora jumps and kicks it out of the sky
    if ((L.corm || 0) + (L.air || 0) < 3) {
      const c = this.foes.find((f) => f.kind === 'cormorant' && f.st === 'wind');
      if (c && p.name === 'dora' && p.h <= 0 && Math.abs(c.x - p.x) < 240) return { act: 'jmp', who: 'hero' };
    }
    const b = this.boss;
    if (b) {
      if (b.kind === 'longshanks') {
        if (b.st === 'stomp' && p.name === 'enzo' && (L.heave || 0) < 2) return { act: 'atk', who: 'boss', x: b.tx, z: b.tz, h: 120 };
        if (b.st === 'stomp' && p.name === 'dora' && canTag && (L.heave || 0) < 2) return { act: 'tag', who: 'partner', tint: 'grey' };
        if (b.st === 'toppled' && p.name === 'enzo' && canTag && (L.lsTag || 0) < 2) return { act: 'tag', who: 'partner', tint: 'cream' };
        if (b.st === 'stomptell' && (L.stompDodge || 0) < 2 && Math.abs(p.x - b.tx) < 90 && Math.abs(p.z - b.tz) < 40) return { act: 'move', who: 'hero', dir: p.z > 80 ? -2 : 2 };
        if (b.st === 'sweepw' && (L.sweep || 0) < 2) return { act: 'jmp', who: 'hero' };
        if (this.lsStanding(b) && b.st === 'idle' && p.name === 'dora' && p.h <= 0 && b.tinks >= 2 && (L.air || 0) < 6) return { act: 'jmp', who: 'hero' };
      }
      if (b.kind === 'tanglejaw') {
        const plugs = this.plugs();
        if (p.name === 'enzo' && plugs < 2 && !(p.hold && 'ht' in p.hold)) {
          const it = p.hold && !('ht' in p.hold) && (p.hold as Item).kind === 'barrel' ? p.hold as Item : null;
          if (it) {
            const out = ['strike', 'stretched', 'whipw', 'whip', 'sink'].includes(b.st);
            let best: Hole | null = null, bd = 1e9;
            this.holes.forEach((h, i) => { if (h.plug || (out && i === b.hole)) return; const d = Math.abs(h.x - p.x) + Math.abs(h.z - p.z); if (d < bd) { bd = d; best = h; } });
            const hb = best as Hole | null;
            if (hb) return { act: 'plug', who: 'foe', x: hb.x, z: hb.z, h: 80, dir: sgn(hb.x - p.x) || 1 };
          } else if ((L.plug || 0) < 6) {
            let bx = 0, bz = 0, bd = 1e9;
            for (const i of this.items) if (i.kind === 'barrel' && !i.held && i.h < 20 && !i.slide) { const d = Math.abs(i.x - p.x) + Math.abs(i.z - p.z); if (d < bd) { bd = d; bx = i.x; bz = i.z; } }
            for (const pr of this.props) if (pr.alive && pr.kind === 'barrel') { const d = Math.abs(pr.x - p.x) + Math.abs(pr.z - p.z); if (d < bd) { bd = d; bx = pr.x; bz = pr.z; } }
            if (bd < 1e9) return { act: 'grab', who: 'foe', x: bx, z: bz, h: 110, dir: sgn(bx - p.x) || 1 };
          }
        }
        if (p.name === 'dora' && plugs < 2 && canTag && b.st !== 'roar') return { act: 'tag', who: 'partner', tint: 'grey' };
        if (b.st === 'stretched' && plugs >= 2 && p.name === 'enzo' && canTag) return { act: 'tag', who: 'partner', tint: 'cream' };
        if (b.st === 'stretched' && plugs >= 2 && p.name === 'dora' && (L.tjkick || 0) < 3) return { act: 'atk', who: 'boss', x: b.x, z: b.z, h: 110 };
        if (b.st === 'whipw' && (L.whip || 0) < 2) return { act: 'jmp', who: 'hero' };
        if (b.st === 'bubble' && (L.tjdodge || 0) < 2 && Math.abs(p.z - b.tz) < 36) return { act: 'move', who: 'hero', dir: p.z > 80 ? -2 : 2 };
      }
      if (b.kind === 'clamps') {
        if (b.st === 'dizzy' && p.name === 'dora' && canTag && (L.rip || 0) < 2) return { act: 'tag', who: 'partner', tint: 'grey' };
        if (b.st === 'dizzy' && p.name === 'enzo' && (L.rip || 0) < 2) return { act: 'atk', who: 'boss' };
        if (b.st === 'bare' && p.name === 'enzo' && canTag && (L.crackTag || 0) < 2) return { act: 'tag', who: 'partner', tint: 'cream' };
        if (b.st === 'rock' && (L.dodge || 0) < 2 && Math.abs(p.z - b.tz) < 40) return { act: 'move', who: 'hero', dir: p.z > 80 ? -2 : 2 };
      }
      if (b.kind === 'brute') {
        if (b.armour > 0 && p.name === 'dora' && canTag && b.tinks >= 1) return { act: 'tag', who: 'partner', tint: 'grey' };
        if (b.st === 'bare' && p.name === 'enzo' && canTag) return { act: 'tag', who: 'partner', tint: 'cream' };
      }
      if (b.kind === 'admiral') {
        if (b.st === 'grounded' && p.name === 'dora' && canTag) return { act: 'tag', who: 'partner', tint: 'grey' };
        if (b.st === 'grounded' && p.name === 'enzo' && (L.pin || 0) < 2) return { act: 'atk', who: 'boss' };
        if ((b.st === 'shriek' || b.st === 'hover') && p.name === 'enzo' && canTag && (L.counterDive || 0) < 2) return { act: 'tag', who: 'partner', tint: 'cream' };
        if (b.st === 'shriek' && p.name === 'dora' && (L.counterDive || 0) < 2 && b.t > (this.assist ? 0.75 : 0.55)) return { act: 'jmp', who: 'hero' };
      }
      if (b.kind === 'knuckles') {
        if (b.st === 'guard' && p.name === 'dora' && canTag && b.tinks >= 1) return { act: 'tag', who: 'partner', tint: 'grey' };
        if (b.st === 'guard' && p.name === 'enzo' && (L.kthrow || 0) < 2) return { act: 'atk', who: 'boss' };
        if (b.st === 'tell' && (L.counter || 0) < 1) return { act: 'atk', who: 'hero' };
      }
    }
    // Enzo's first dazed foe: walk into it to pick it up (Attack keeps punching)
    if (p.name === 'enzo' && !L.grab && p.h <= 0 && !p.hold) {
      const f = this.foes.find((f) => f.daze > 0 && f.st !== 'held' && f.st !== 'ko' && f.h < 20 && Math.abs(f.x - p.x) < 220 && Math.abs(f.z - p.z) < 50);
      if (f) return { act: 'grab', who: 'foe', x: f.x, z: f.z, h: 110, dir: sgn(f.x - p.x) || 1 };
    }
    // a shelled hermit or a lobster the player keeps tinking off
    if (p.name === 'dora' && this.stats.tinks > 6 && (L.tag || 0) < 4 && this.foes.some((f) => (f.kind === 'hermit' && f.shell || f.kind === 'lobster' || inHole(f)) && f.st !== 'ko') && canTag) return { act: 'tag', who: 'partner', tint: 'grey' };
    if (this.go > 0 && !this.wave && !this.boss && this.foes.length === 0) return { act: 'go', who: 'hero' };
    return null;
  }

  /** what the browser tests and bots read */
  snapshot() {
    const h = (x: Hero) => ({ name: x.name, x: Math.round(x.x), z: Math.round(x.z), h: Math.round(x.h), hp: +x.hp.toFixed(1), st: x.st, face: x.face });
    return {
      mode: this.mode, stage: this.stageId, scene: this.scene.id, sceneI: this.sceneI, t: +this.t.toFixed(2), active: this.active, assist: this.assist,
      heroes: [h(this.dora), h(this.enzo)], cam: Math.round(this.cam), lock: this.lock, evI: this.evI, len: this.len,
      foes: this.foes.map((f) => ({ kind: f.kind, x: Math.round(f.x), z: Math.round(f.z), h: Math.round(f.h), hp: +f.hp.toFixed(2), st: f.st, shell: f.shell })),
      boss: this.boss && { kind: this.boss.kind, hp: +this.boss.hp.toFixed(1), st: this.boss.st, x: Math.round(this.boss.x), armour: this.boss.armour, layers: this.boss.layers, phase: this.boss.phase },
      rolls: this.rolls.map((c) => ({ lane: c.lane, x: Math.round(c.x), rolling: c.t >= c.tell, kind: c.kind })), holes: this.holes.map((h) => ({ x: Math.round(h.x), z: h.z, plug: h.plug })), ink: this.ink.length,
      lanterns: this.strings.map((s) => `${s.got}/${s.need}`).join(' '), fest: Math.round(this.fest), combo: this.combo.n, chain: this.combo.chain,
      prompt: this.prompt && `${this.prompt.act}@${this.prompt.who}`, tut: this.tut.stage, stats: this.stats, found: [...this.found],
    };
  }
}

export const BOSS_R: Record<BossKind, number> = { brute: 120, clamps: 105, knuckles: 70, admiral: 70, longshanks: 90, tanglejaw: 60 };
