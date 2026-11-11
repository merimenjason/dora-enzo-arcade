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
  type SceneDef, type WaveDef, type BossKind, type FoeKind, type NpcId, type EventDef,
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
  | 'lift' | 'held' | 'thrown' | 'ko' | 'block' | 'puffed' | 'roll' | 'whistle' | 'flee' | 'charge' | 'zap' | 'tangled';
export interface Foe {
  id: number; kind: FoeKind; hp: number; max: number; rad: number; ht: number; x: number; z: number; h: number; vh: number;
  vx: number; vz: number; face: number; st: FoeSt; t: number; cd: number; flash: number; daze: number; anim: number;
  shell: boolean; lantern: number; tok: boolean; script: string; side: number; zoff: number; spin: number; hitList: object[];
  /** this attack is a lobster's counter to being hit in the guard */
  ctr?: boolean;
  didHit: boolean; tx: number; tz: number; dead: boolean; splashed: boolean; blocks: number; puffT: number; callT: number;
  called: boolean; lane: number; dazedOnce: boolean; flipped: boolean; charge: number; stole: boolean;
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
}
/** the one-time icon at the start of each boss phase: whose job this phase is, and the key that does it */
export interface BossHint { who: HeroId; act: 'atk' | 'jmp'; t: number; phase: number }
const BOSS_HINT: Record<BossKind, [HeroId, 'atk' | 'jmp'][]> = {
  brute: [['enzo', 'atk'], ['dora', 'atk'], ['enzo', 'atk']],       // crack the barnacles; juggle him bare; crack again
  clamps: [['enzo', 'atk'], ['dora', 'jmp'], ['enzo', 'atk']],      // rip the barrel; hop the double roll; two barrels
  knuckles: [['dora', 'atk'], ['enzo', 'atk'], ['dora', 'jmp']],    // counter the tell; throw him out of his guard; jump the hop
  admiral: [['dora', 'jmp'], ['enzo', 'atk'], ['dora', 'jmp']],     // counter the dive; pin him grounded; kick the nets away
};
export interface Prompt { act: 'move' | 'grab' | 'atk' | 'jmp' | 'tag' | 'dbl' | 'special' | 'go'; who: 'hero' | 'partner' | 'foe' | 'boss'; tint?: 'grey' | 'cream'; x?: number; z?: number; h?: number; dir?: number }
export interface Talk { who: NpcId; line: string; t: number }
export interface Stats {
  time: number; dmg: number; hits: number; best: number; tags: number; tagChains: number; grabs: number; throws: number;
  retries: number; tinks: number; dashes: number; dashAtks: number; specials: number; specialHits: number; specialLanded: number; dbls: number;
  bossTime: Record<string, number>; jumps: number; airHits: number; score: number; lanterns: number; scenes: number;
  wrongHits: number; kos: number; snacks: number;
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
};
/** which hero a foe wants, for the assist outline and the prompts */
export function foeWants(f: Foe): HeroId | null {
  if (f.kind === 'hermit' && f.shell) return 'enzo';
  if (f.kind === 'lobster') return 'enzo';
  if (f.kind === 'puffer' && f.st === 'puffed') return 'enzo';
  if ((f.kind === 'gull' || f.kind === 'jelly') && f.h > 40) return 'dora';
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
  cam = VIEW_W / 2; lock: number | null = null; evI = 0; wave: WaveRun | null = null; go = 0;
  tokens = 0; tagCD = 0; tagQ = 0; fest = 0; festFull = false; dblT = -1;
  combo = { n: 0, t: 0, chain: 0 };
  prompt: Prompt | null = null; talk: Talk | null = null; bossHint: BossHint | null = null;
  learned: Record<string, number> = {};
  tut: Tut = { stage: 9, t: 0, tinks: 0, lastMove: 0, thief: null, hermit: null, gull: null };
  stats: Stats = { time: 0, dmg: 0, hits: 0, best: 0, tags: 0, tagChains: 0, grabs: 0, throws: 0, retries: 0, tinks: 0, dashes: 0, dashAtks: 0, specials: 0, specialHits: 0, specialLanded: 0, dbls: 0, bossTime: {}, jumps: 0, airHits: 0, score: 0, lanterns: 0, scenes: 0, wrongHits: 0, kos: 0, snacks: 0 };
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
    this.foes = []; this.items = []; this.props = []; this.boss = null; this.wave = null; this.lock = null; this.evI = 0; this.tokens = 0; this.flies = []; this.cart = null;
    this.strings = sc.strings.map((s) => ({ col: s.col, need: s.need, got: 0, flying: 0, glow: 0, pulse: 0 }));
    let charm = 0;
    sc.lanes.forEach((row, r) => {
      for (let c = 0; c < row.length; c++) {
        const ch = row[c], x = c * COL + COL / 2, z = LANE_Z[r];
        const prop = (kind: PropKind, content: '' | 'snack' | 'charm' = '', sid = '') => this.props.push({ id: this.nid++, kind, x, z, hp: kind === 'ice' ? 99 : 2, content, sid, alive: true, vx: 0, hitList: [], fall: 0, down: false, flash: 0 });
        if (ch === 'b') prop('barrel');
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
    this.updItems(); this.updProps(); this.updStrings();
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
    if (p.name === 'enzo' && mx && !holding && !air() && (p.st === 'idle' || p.st === 'walk') && p.buf <= 0 && p.atkAgo > 0.35 && this.tryGrab(p)) return;
    // attack
    if (p.buf > 0) {
      if (holding) { p.buf = 0; this.doThrow(p); }
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
    if (holding && p.t > (this.assist ? 2.4 : 1.7)) this.doThrow(p);
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
  private tryGrab(p: Hero): boolean {
    if (p.name !== 'enzo' || p.h > 5 || p.hold) return false;
    const reach = this.assist ? 84 : 72, zTol = this.assist ? 36 : 28;
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
        if (dx > -10 && dx < reach && dz < zTol) { pr.alive = false; const it = this.addItem('barrel', pr.x, pr.z, 0, 0, 0); it.held = true; p.hold = it; this.setSt(p, 'grab'); this.sfx('grab'); this.stats.grabs++; return true; }
      }
      return false;
    }
    this.releaseToken(best);
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
  hittable(f: Foe) { if (f.st === 'down' && f.h <= 0 && f.vh <= 0) return false; if (f.st === 'up') return false; return !['ko', 'held', 'thrown', 'enter'].includes(f.st) || (f.st === 'enter' && f.x > this.camL && f.x < this.camR); }
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
    if ((f.kind === 'gull' || f.kind === 'jelly') && f.h > 40 && enzo && !o.tag && !o.special) { this.wrong(o.x, f.z, f.h + 40, 'dora'); return; }
    f.hp -= dmg; f.flash = 0.1; this.comboHit(!!o.heavy, f.x, f.z, f.h + 60);
    if (f.h > 40 && dora) this.stats.airHits++;
    const col = o.by === 'enzo' ? '#fff3d6' : '#fffbe6';
    this.ev({ k: 'sparks', x: o.x, z: f.z, h: Math.max(20, o.h || 50), col: o.heavy ? '#ffd27a' : col, n: o.heavy ? 11 : 7, big: o.heavy ? 1.3 : 1 });
    this.sfx(o.snd || (o.by === 'enzo' ? (o.heavy ? 'slam' : 'punch') : (o.heavy ? 'kick3' : 'kick')));
    this.hitstop(o.heavy ? 0.085 : 0.05); this.shakeBy(o.heavy ? 6 : 2.5);
    if (f.st === 'wind' || f.st === 'atk' || f.st === 'charge' || f.st === 'whistle') this.releaseToken(f);
    if (f.kind === 'shrimp' && f.st === 'whistle') f.callT = -99;   // stopped in time
    if (f.hp <= 0) { this.koFoe(f, o.kb); return; }
    if (d.dazeAt && f.hp <= d.dazeAt && !f.dazedOnce) { f.daze = this.assist ? 2.6 : 2; f.dazedOnce = true; }
    if (o.daze) f.daze = Math.max(f.daze, o.daze);
    // committed attacks of the heavy foes have armour: they take the damage but don't flinch from light hits
    const armoured = (f.kind === 'lobster' && (f.st === 'wind' || f.st === 'atk')) || ((f.kind === 'hermit' || f.kind === 'urchin') && f.st === 'roll') || (f.kind === 'puffer' && f.st === 'atk');
    if (armoured && !o.heavy && !o.down && o.by !== 'dbl') { this.ev({ k: 'word', x: f.x, z: f.z, h: f.ht + 40, text: 'ARMOUR!', col: '#ffb48a' }); return; }
    f.vx = o.kb; f.t = 0;
    if (f.kind === 'puffer' && dora && f.st !== 'puffed' && !o.down) { f.st = 'puffed'; f.puffT = this.assist ? 3.4 : 2.6; f.h = 0; this.sfx('puff'); return; }
    if (f.kind === 'puffer' && f.st === 'puffed') { f.vx = o.kb * 0.6; return; }
    if (f.kind === 'jelly') { f.st = 'hurt'; f.charge = 0; if (o.down) { f.st = 'down'; f.vh = 200; } return; }
    if (f.kind === 'gull' && f.h > 40 && o.rise) { f.st = 'crash'; f.daze = this.assist ? 1.8 : 1.3; f.vh = 0; this.releaseToken(f); return; }
    if (o.down) { f.st = 'down'; f.vh = 380; f.h = Math.max(f.h, 1); }
    else { f.st = 'hurt'; if (f.kind === 'gull' && f.h > 20) f.vh = 60; }
  }
  private flipUrchin(f: Foe) {
    f.flipped = true; f.st = 'down'; f.t = 0; f.vh = 300; f.h = Math.max(1, f.h); f.daze = this.assist ? 3.2 : 2.4; this.releaseToken(f);
    this.sfx('flip'); this.ev({ k: 'word', x: f.x, z: f.z, h: 110, text: 'FLIPPED!', col: '#fffbe6' }); this.hitstop(0.05);
  }
  private koFoe(f: Foe, kb: number) {
    this.releaseToken(f);
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
  private punish(dmg: number) { return this.assist && this.area() === 2 && this.stats.retries === 0 && (!MERCY_KO || !this.koOnce) ? dmg * Math.min(PUNISH_CAP, 1 + PUNISH * Math.max(0, (this.wrongT > 0 ? this.wrongN : 0) - 1)) : dmg; }
  hurtHero(p: Hero, dmg: number, fromX: number, kb = 260, heavy = false) {
    if (p.inv > 0 || p.st === 'tagin' || p.st === 'out' || this.mode !== 'play' || this.dblT >= 0 || p.st === 'special' || p.st === 'down' || p.st === 'getup') return false;
    dmg *= this.assist ? 0.6 * (this.area() === 2 ? 1.25 : 1) : this.area() === 2 ? 1.6 : 1;
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
  }

  // ─────────────────────────────────────────── foes
  spawnFoe(kind: FoeKind, side: number, o: Partial<Foe> = {}): Foe {
    const d = FD[kind];
    const f: Foe = {
      id: this.nid++, kind, hp: d.hp * (this.area() === 2 ? 1.15 : 1), max: d.hp * (this.area() === 2 ? 1.15 : 1), rad: d.rad, ht: d.ht, x: side > 0 ? this.camR + 70 : this.camL - 70, z: this.rr(15, DEPTH - 15),
      h: d.fly ? 150 : kind === 'jelly' ? 70 : 0, vh: 0, vx: 0, vz: 0, face: -side, st: 'enter', t: 0, cd: this.rr(0.4, 1.2), flash: 0, daze: 0,
      anim: this.rnd() * 3, shell: kind === 'hermit', lantern: -1, tok: false, script: '', side, zoff: this.rr(-18, 18), spin: 0, hitList: [],
      didHit: false, tx: 0, tz: 0, dead: false, splashed: false, blocks: 0, puffT: 0, callT: 3, called: false, lane: -1, dazedOnce: false,
      flipped: false, charge: 0, stole: false, ...o,
    };
    if (f.lane >= 0) f.z = LANE_Z[f.lane];
    this.foes.push(f);
    return f;
  }
  area() { return STAGES[this.stageId].area; }
  private maxTokens() { return this.stageId === '1-1' && this.sceneI === 0 ? 1 : this.stageId === '1-1' ? (this.assist ? 1 : 2) : this.area() === 2 && !this.assist ? 3 : 2; }
  private takeToken(f: Foe) { if (f.tok) return true; if (this.tokens >= this.maxTokens()) return false; this.tokens++; f.tok = true; return true; }
  private releaseToken(f: Foe) { if (f.tok) { f.tok = false; this.tokens = Math.max(0, this.tokens - 1); } }
  private updFoe(f: Foe) {
    const d = FD[f.kind], p = this.hero(), slowW = this.assist ? 1.4 : 1;
    f.t += DT; f.anim += DT; f.flash -= DT; f.cd -= DT;
    if (f.daze > 0 && !['held', 'thrown', 'ko', 'down'].includes(f.st)) f.daze -= DT;
    const out = p.st === 'out';
    switch (f.st) {
      case 'enter': {
        const tx = clamp(f.x, this.camL + 70, this.camR - 70);
        if (f.kind === 'gull') { f.x += sgn(tx - f.x) * d.spd * DT; f.h += (130 - f.h) * DT * 2; }
        else f.x += sgn(tx - f.x) * d.spd * 1.1 * DT;
        if (f.lane < 0) f.face = sgn(p.x - f.x); else f.face = sgn(tx - f.x) || f.face;
        if (Math.abs(tx - f.x) < 8) { f.st = f.kind === 'gull' ? 'hover' : 'idle'; f.t = 0; if (f.lane >= 0) f.cd = 2.2 + this.rnd(); }
        break;
      }
      case 'idle': case 'walk': {
        if (f.daze > 0) { f.st = 'daze'; break; }
        if (f.script === 'thief') { this.thief(f); break; }
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
        if (f.kind === 'gull') break;
        if (f.kind === 'hermit' || f.kind === 'urchin') f.face = sgn(p.x - f.x);
        if (f.t > d.wind * slowW) {
          f.st = f.kind === 'hermit' || f.kind === 'urchin' ? 'roll' : 'atk'; f.t = 0; f.didHit = false;
          if (f.kind === 'crab' || f.kind === 'lobster' || f.kind === 'shrimp') this.sfx('whoosh');
          if (f.kind === 'puffer') this.sfx('bump');
        }
        break;
      case 'atk': {
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
        if (f.t > d.rec) { f.st = 'idle'; f.t = 0; f.cd = (d.cd + this.rr(0, 0.8)) * (this.area() === 2 ? 0.75 : 1) + (this.stageId === '1-1' ? 1.2 : 0); this.releaseToken(f); }
        break;
      case 'block':
        f.face = sgn(p.x - f.x);
        if (f.t > 0.5) { f.st = 'idle'; f.t = 0; }
        break;
      case 'hurt':
        f.x += f.vx * DT; f.vx *= Math.pow(0.01, DT);
        if (f.kind === 'gull') { f.vh -= 300 * DT; f.h = Math.max(f.h > 20 ? 30 : 0, f.h + f.vh * DT); }
        if (f.t > 0.34) { f.st = f.kind === 'gull' && f.h > 20 ? 'hover' : f.daze > 0 ? 'daze' : 'idle'; f.t = 0; f.cd = Math.max(f.cd, 0.5); if (f.kind === 'jelly') f.h = Math.max(f.h, 60); }
        break;
      case 'down':
        f.x += f.vx * DT; f.vx *= Math.pow(0.05, DT);
        if (f.h > 0 || f.vh > 0) { f.vh -= GRAV * DT; f.h += f.vh * DT; if (f.h <= 0) { f.h = 0; f.vh = 0; this.ev({ k: 'dust', x: f.x, z: f.z, n: 4, size: 1 }); f.t = 0; } }
        else if (f.t > (this.assist ? 1.0 : 0.75) + (f.flipped ? 1.2 : 0)) { f.st = 'up'; f.t = 0; }
        break;
      case 'up':
        if (f.t > 0.3) { f.flipped = false; f.st = f.daze > 0 ? 'daze' : f.kind === 'gull' ? 'lift' : 'idle'; f.t = 0; f.cd = Math.max(f.cd, 0.6); if (f.kind === 'jelly') f.h = 70; }
        break;
      case 'daze': case 'tangled':
        if (f.daze <= 0) { f.st = f.kind === 'gull' ? 'lift' : 'idle'; f.t = 0; }
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
        const side = sgn(f.x - p.x) || 1;
        const tx = clamp(p.x + side * 150, this.camL + 60, this.camR - 60), tz = clamp(p.z - 10, 0, DEPTH);
        f.x += clamp(tx - f.x, -d.spd * 0.6 * DT, d.spd * 0.6 * DT); f.z += clamp(tz - f.z, -d.zs * DT, d.zs * DT);
        f.h += (125 + Math.sin(f.anim * 3) * 10 - f.h) * DT * 3;
        f.face = sgn(p.x - f.x);
        const calm = f.script === 'calm' && this.tut.t < 4.5;
        if (!calm && f.cd <= 0 && !out && this.takeToken(f)) { f.st = 'wind'; f.t = 0; this.sfx('tell'); }
        break;
      }
      case 'dive': break;
      case 'crash':
        if (f.t > (this.assist ? 1.8 : 1.2)) { f.st = 'lift'; f.t = 0; f.daze = 0; }
        if (f.h > 0) { f.vh -= GRAV * DT; f.h = Math.max(0, f.h + f.vh * DT); }
        break;
      case 'lift':
        f.h += 260 * DT; if (f.h > 110) { f.st = 'hover'; f.t = 0; f.cd = d.cd + this.rr(0, 1); }
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
    if (!['held', 'ko', 'thrown', 'enter'].includes(f.st)) { f.z = clamp(f.z, 0, DEPTH); if (f.st !== 'flee') f.x = clamp(f.x, this.camL + 24, this.camR - 24); }
    // bodies don't stack
    if (['idle', 'walk', 'rec', 'daze', 'up', 'block'].includes(f.st) && f.h < 20) {
      const dx = f.x - p.x, dz = f.z - p.z, minX = (f.rad + HC[p.name].rad) * 0.9;
      if (Math.abs(dx) < minX && Math.abs(dz) < 18 && !out && p.st !== 'dash' && p.st !== 'special') f.x = p.x + (sgn(dx) || -p.face) * minX;
      for (const o of this.foes) if (o !== f && o.h < 20 && ['idle', 'walk', 'rec'].includes(o.st)) { const ex = f.x - o.x, ez = f.z - o.z; if (Math.abs(ex) < 40 && Math.abs(ez) < 14) { f.x += (sgn(ex) || 1) * 30 * DT; f.z += (sgn(ez) || 1) * 30 * DT; } }
    }
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
        if (it.h <= 0) { it.h = 0; it.vh = 0; it.vx = 0; if (it.kind === 'barrel') this.breakItem(it); }
        if (it.x < this.camL - 40 || it.x > this.camR + 40) it.dead = true;
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
  private breakItem(it: Item) { it.dead = true; this.ev({ k: 'debris', x: it.x, z: it.z, kind: 'barrel' }); this.sfx('crate'); }
  private hitProp(pr: Prop, p: Hero, heavy: boolean) {
    if (pr.kind === 'ice') {
      if (p.name === 'enzo') { pr.vx = p.face * 760; pr.hitList = []; this.sfx('ice'); this.learned.ice = 1; this.ev({ k: 'sparks', x: pr.x, z: pr.z, h: 40, col: '#dff4ff', n: 8, big: 1 }); }
      else this.wrong(pr.x, pr.z, 50, 'enzo');
      return;
    }
    if (pr.kind === 'barrel' && p.name === 'dora') {
      // Dora's kick sets a barrel rolling along the deck
      pr.alive = false; const it = this.addItem('barrel', pr.x, pr.z, 0, 0, 0); it.slide = p.face * 680; this.sfx('kick'); return;
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
      if (e.kind === 'cart') { if (p.x > ex - 200) { this.evI++; this.cart = { lane: e.lane, x: this.camR + 300, t: 0, hit: [] }; this.sfx('rumble'); } return; }
      const lx = clamp(ex, VIEW_W / 2, this.len - VIEW_W / 2);
      if (this.cam >= lx - 30) {
        this.lock = lx; this.retryAt = { evI: this.evI, x: p.x };
        if (e.kind === 'wave') { this.wave = { def: e, group: 0, groupT: 0, t: 0, called: false, carriers: 0 }; if (e.teach) this.teachT = 6; }
        else if (e.kind === 'boss') this.spawnBoss(e.who);
        this.evI++;
      }
      return;
    }
    // every event done: walk to the end of the scene
    const door = this.secretDoor();
    if (door !== null && Math.abs(p.x - door) < 40 && p.z < 30 && p.h <= 0) { this.goSecret(); return; }
    if (p.x > this.len - 110) this.nextScene();
  }
  cart: { lane: number; x: number; t: number; hit: object[] } | null = null;
  private updCart() {
    const c = this.cart; if (!c) return;
    c.t += DT;
    if (c.t < 1.4) return;   // the rumble and the dashed lane are the tell
    c.x -= 620 * DT;
    const z = LANE_Z[c.lane], p = this.hero();
    if (!c.hit.includes(p) && Math.abs(p.x - c.x) < 70 && Math.abs(p.z - z) < 30 && p.h < 50) { c.hit.push(p); this.hurtHero(p, 12, c.x + 100, 420, true); }
    for (const f of this.foes) if (!c.hit.includes(f) && this.hittable(f) && f.h < 50 && Math.abs(f.x - c.x) < 70 && Math.abs(f.z - z) < 32) { c.hit.push(f); this.damageFoe(f, 3, { kb: -460, down: true, heavy: true, by: 'item', x: f.x, h: 40, snd: 'slam' }); }
    if (c.x < this.camL - 300) this.cart = null;
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
    if (SCENES[was].id === 'alley' || SCENES[was].id === 'larder') this.inSecret = false;
  }
  private updCamera() {
    const p = this.hero();
    this.go = Math.max(0, this.go - DT);
    if (this.lock !== null) { this.cam += (this.lock - this.cam) * Math.min(1, DT * 5); }
    else {
      const e = this.scene.events[this.evI];
      const stopAt = e && (e.kind === 'wave' || e.kind === 'boss') ? clamp(e.col * COL, VIEW_W / 2, this.len - VIEW_W / 2) : this.len - VIEW_W / 2;
      const tx = clamp(p.x + p.face * VIEW_W * 0.08, VIEW_W / 2, stopAt);
      this.cam += (tx - this.cam) * Math.min(1, DT * 6);
      this.cam = clamp(this.cam, VIEW_W / 2, Math.max(VIEW_W / 2, this.len - VIEW_W / 2));
    }
    this.updCart();
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
  bossBox() { const b = this.boss!; return { x: b.x, z: b.z, h: b.h, rad: BOSS_R[b.kind] * 0.9, ht: b.kind === 'admiral' ? 150 : 200 }; }
  private spawnBoss(kind: BossKind) {
    const hp = { brute: 140, clamps: 160, knuckles: 140, admiral: 150 }[kind];
    this.boss = { kind, x: this.camR + 260, z: 80, h: kind === 'admiral' ? 170 : 0, vh: 0, hp, max: hp, st: 'intro', t: 0, face: -1, flash: 0, hurtT: 0, phase: 1, armour: kind === 'brute' ? 3 : 0, layers: 1, n: 0, tx: 0, tz: 0, didHit: false, summoned: 0, dir: -1, pinned: 0, cycle: 0, ghost: hp, tinks: 0, seen: [], lastSt: 'intro', first: false, hinted: 0 };
    this.bossHint = null;
    this.bossStart = this.t; this.sfx(kind === 'admiral' ? 'shriek' : 'roar');
  }
  /** Enzo's grab on a boss: rip off Clamps' barrel, pin the grounded Admiral, throw Knuckles out of his guard */
  private bossGrab(p: Hero, reach: number, zTol: number): boolean {
    const b = this.boss!; const bx = this.bossX();
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
    }
  }
  damageBoss(dmg: number, by: HeroId | 'dbl' | 'item', x: number, h: number, heavy: boolean, tag = false, key = '') {
    const b = this.boss!; if (b.st === 'end' || b.st === 'gone' || b.st === 'intro') return;
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
    if (ph > b.phase && b.st !== 'end') { b.phase = ph; this.sfx(b.kind === 'admiral' ? 'shriek' : 'roar'); this.shakeBy(8); this.ev({ k: 'word', x: b.x, z: b.z, h: 260, text: ph === 3 ? 'FURIOUS!' : 'ANGRY!', col: '#ffb48a' }); }
    if (b.st === 'intro') {
      b.x += (homeX - b.x) * DT * 2.2;
      if (b.t > 1.4) { b.st = b.kind === 'admiral' ? 'hover' : 'idle'; b.t = 0; this.shakeBy(8); this.sfx('boom'); this.ev({ k: 'dust', x: b.x - 60, z: b.z, n: 12, size: 2 }); }
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
    if (b.phase >= 2 && b.summoned < 1) { b.summoned = 1; const k: FoeKind = b.kind === 'admiral' ? 'gull' : b.kind === 'knuckles' ? 'crab' : 'crab'; this.spawnFoe(k, 1); this.spawnFoe(k, -1); }
    if (b.phase >= 3 && b.summoned < 2 && b.kind !== 'clamps') { b.summoned = 2; this.spawnFoe(b.kind === 'admiral' ? 'jelly' : 'crab', 1); }
    switch (b.kind) {
      case 'brute': this.updBrute(b, p, A, homeX); break;
      case 'clamps': this.updClamps(b, p, A, homeX); break;
      case 'knuckles': this.updKnuckles(b, p, A, homeX); break;
      case 'admiral': this.updAdmiral(b, p, A); break;
    }
    b.z = clamp(b.z, 10, DEPTH - 10);
    if (b.kind !== 'admiral') b.x = clamp(b.x, this.camL + 90, this.camR - 60);
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
    // wrong hero, twice in a row: the partner's portrait asks to tag
    if (this.wrongN >= 2 && this.wrongT > 0 && canTag) {
      const want = p.name === 'dora' ? 'enzo' : 'dora';
      return { act: 'tag', who: 'partner', tint: want === 'enzo' ? 'grey' : 'cream' };
    }
    const b = this.boss;
    if (b) {
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
    if (p.name === 'dora' && this.stats.tinks > 6 && (L.tag || 0) < 4 && this.foes.some((f) => (f.kind === 'hermit' && f.shell || f.kind === 'lobster') && f.st !== 'ko') && canTag) return { act: 'tag', who: 'partner', tint: 'grey' };
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
      boss: this.boss && { kind: this.boss.kind, hp: +this.boss.hp.toFixed(1), st: this.boss.st, x: Math.round(this.boss.x), armour: this.boss.armour, layers: this.boss.layers },
      lanterns: this.strings.map((s) => `${s.got}/${s.need}`).join(' '), fest: Math.round(this.fest), combo: this.combo.n, chain: this.combo.chain,
      prompt: this.prompt && `${this.prompt.act}@${this.prompt.who}`, tut: this.tut.stage, stats: this.stats, found: [...this.found],
    };
  }
}

export const BOSS_R: Record<BossKind, number> = { brute: 120, clamps: 105, knuckles: 70, admiral: 70 };
