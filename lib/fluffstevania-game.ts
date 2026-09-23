// Fluffstevania: Symphony of the Dust — a castle-exploring action RPG. Deterministic: the same inputs always play
// out the same way, so the tests drive this engine directly. Positions are world pixels; heroes and walking
// enemies stand with their feet at (x, y).
import {
  ROOMS, COLS, ROWS, TILE, START, GEAR, FOOD, RELICS, SCRIPTS, ROOM_SCRIPTS, AREAS, SHOP, RENAMED, SUBS, SPELLS, PALS, LORE, itemName,
  type Room, type HeroId, type Slot, type Line, type RelicId, type WeaponStyle, type AreaId, type BossId, type SubId, type SpellId, type PalId,
} from './fluffstevania-world.js';

export { ROOMS, COLS, ROWS, TILE, GEAR, FOOD, RELICS, AREAS, SCRIPTS, SHOP, SUBS, SPELLS, PALS, LORE, itemName };
export type { Room, HeroId, Slot, Line, RelicId, AreaId, BossId, WeaponStyle, SubId, SpellId, PalId };
export const VIEW_W = COLS * TILE, VIEW_H = ROWS * TILE;
export const SCREEN_W = VIEW_W, SCREEN_H = VIEW_H;

/** `spell` casts the lead's spell without the motion; `duo` is the tag-team finisher (tag + attack together works too). */
export type Input = { left: boolean; right: boolean; up: boolean; down: boolean; jump: boolean; attack: boolean; dash: boolean; tag: boolean; spell: boolean; duo: boolean };
export const NO_INPUT: Input = { left: false, right: false, up: false, down: false, jump: false, attack: false, dash: false, tag: false, spell: false, duo: false };

export type Difficulty = 'easy' | 'normal' | 'hard';
/** Foes' HP and damage are scaled; Easy heals a little at every doorway; Hard bosses use their fiercest moves from the start. */
export const DIFFICULTY: Record<Difficulty, { name: string; foeHp: number; foeAtk: number; doorHeal: number; text: string }> = {
  easy: { name: 'Easy', foeHp: 0.7, foeAtk: 0.6, doorHeal: 0.15, text: 'Gentler foes, and every doorway heals a little.' },
  normal: { name: 'Normal', foeHp: 1, foeAtk: 1, doorHeal: 0, text: 'The castle as it was built.' },
  hard: { name: 'Hard', foeHp: 1.5, foeAtk: 1.5, doorHeal: 0, text: 'Tougher foes, and bosses fight all-out from the start.' },
};

// ─── The map ──────────────────────────────────────────────────────────────

const CELLS = new Map<string, Room>();
for (const r of ROOMS) for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) CELLS.set(`${r.mx + x},${r.my + y}`, r);
export const roomAt = (mx: number, my: number) => CELLS.get(`${mx},${my}`);
export const roomById = (id: string) => ROOMS.find((r) => r.id === id)!;
export const TOTAL_CELLS = CELLS.size;
/** The raw map character at world tile (c, r), before breakable walls and gates are applied. Off the map is wall. */
export function rawTile(c: number, r: number): string {
  const room = roomAt(Math.floor(c / COLS), Math.floor(r / ROWS));
  if (!room) return '#';
  return room.rows[r - room.my * ROWS][c - room.mx * COLS];
}
const isSolidTile = (ch: string) => ch === '#' || ch === '%' || ch === 'G' || ch === 'D' || ch === '^' || ch === '|';
export const isSolid = isSolidTile;
export const roomRect = (r: Room) => ({ x: r.mx * VIEW_W, y: r.my * VIEW_H, w: r.w * VIEW_W, h: r.h * VIEW_H });

// ─── Heroes ───────────────────────────────────────────────────────────────

const BASE: Record<HeroId, { hp: number; atk: number; def: number; lck: number; speed: number }> = {
  dora: { hp: 50, atk: 6, def: 1, lck: 6, speed: 140 },
  enzo: { hp: 66, atk: 7, def: 3, lck: 3, speed: 124 },
};
const GROW: Record<HeroId, { hp: number; atk: number; def: number; lck: number }> = {
  dora: { hp: 6, atk: 1.6, def: 0.7, lck: 0.5 },
  enzo: { hp: 8, atk: 1.8, def: 1, lck: 0.3 },
};
/** XP needed to go from `level` to the next. */
export const xpToNext = (level: number) => Math.round(10 * level ** 1.7);
export const LEAF_HP = 10;

/**
 * How each kind of weapon swings. `reach` is measured from just in front of the hero's middle. On the ground a
 * swing carries the hero forward at `lunge` px/s through the wind-up and the live frames, stopping when it connects.
 */
export const STYLES: Record<WeaponStyle, { reach: number; h: number; windup: number; active: number; total: number; mult: number; lunge: number }> = {
  fan: { reach: 34, h: 24, windup: 0.05, active: 0.1, total: 0.3, mult: 1, lunge: 40 },
  claws: { reach: 28, h: 18, windup: 0.03, active: 0.1, total: 0.22, mult: 0.75, lunge: 190 },
  club: { reach: 30, h: 20, windup: 0.12, active: 0.1, total: 0.42, mult: 1.3, lunge: 100 },
};

export const G = 1400, JUMP_V = 470, JUMP_CUT = 150, MAX_FALL = 480;
export const DASH_V = 340, DASH_T = 0.24, DASH_JUMP_V = 290, HOP_V = 420;
/** Wall Cling: the slowest a clinging hero slides, and the kick off a wall (up, away, and how long the away lasts). */
export const CLING_FALL = 70, WALL_JUMP_V = 440, WALL_KICK_V = 170, KICK_T = 0.16;
/** Boulder Roll: how long Enzo bowls along and how fast. Petal Ward: how long the petals whirl. */
export const ROLL_T = 0.7, ROLL_V = 300, PETAL_T = 4;
/** Attack pressed within COMBO_T of a swing ending chains the next hit; the third hit is a finisher. */
export const COMBO_T = 0.22, FINISHER_MULT = 1.5;
/** Dora holds attack this long, then lets go, for the fan's whirlwind spin. */
export const CHARGE_T = 0.55, SPIN = { total: 0.5, active: [0.05, 0.4] as const, reach: 38, mult: 2 };
export const DUO_MAX = 100, DUO_T = 1;
export const maxMp = (level: number) => 30 + 2 * (level - 1);
export const palXpToNext = (level: number) => Math.round(15 * level ** 1.5);
export const HERO_W = 12, HERO_H = 20, TAG_T = 0.44, TAG_ARC = 0.2, TAG_CD = 1, FOLLOW = 22;

type Body = {
  x: number; y: number; vx: number; vy: number; face: 1 | -1; ground: boolean; coyote: number; jumpBuf: number;
  dashT: number; dashCd: number; airDash: boolean; dashJump: boolean; attackT: number; attackId: number; attackHero: HeroId;
  hurtT: number; invT: number; dropT: number; run: number; subCd: number; hopped: boolean; lungeStop: boolean;
  /** 0, 1 or 2: which hit of the combo string this swing is. */
  combo: number; comboT: number; charge: number; spin: boolean; castT: number;
  /** The wall being clung to (-1 left, 1 right, 0 none); `clingT` lets a kick land just after letting go; `kickT` is the push away. */
  cling: number; clingT: number; clingDir: number; kickT: number; kickDir: number; rollT: number;
};
export type Tag = { t: number; hero: HeroId; sx: number; sy: number; hits: Set<number> };
export type Follower = { x: number; y: number; face: 1 | -1; air: boolean; moving: boolean; run: number };

// ─── Enemies ──────────────────────────────────────────────────────────────

export type FoeKind = 'bat' | 'moth' | 'beetle' | 'bone' | 'armadillo' | 'rat' | 'ghost' | 'spider' | 'book' | 'quill' | 'ink' | 'mouse' | 'cuckoo' | 'toad';
export const FOES: Record<FoeKind, { name: string; hp: number; atk: number; def: number; xp: number; w: number; h: number; raisins: number; drop?: [string, number]; fly?: boolean }> = {
  bat: { name: 'Cave Bat', hp: 10, atk: 7, def: 0, xp: 3, w: 14, h: 10, raisins: 2, drop: ['berry', 0.06], fly: true },
  moth: { name: 'Dust Moth', hp: 14, atk: 8, def: 0, xp: 4, w: 16, h: 14, raisins: 2, drop: ['cape', 0.05], fly: true },
  beetle: { name: 'Shell Beetle', hp: 24, atk: 9, def: 3, xp: 6, w: 18, h: 12, raisins: 4, drop: ['shell', 0.05] },
  bone: { name: 'Bone Mouse', hp: 22, atk: 9, def: 1, xp: 8, w: 14, h: 16, raisins: 5, drop: ['cake', 0.1] },
  armadillo: { name: 'Armadillo Guard', hp: 46, atk: 12, def: 4, xp: 15, w: 22, h: 18, raisins: 9, drop: ['bell', 0.08] },
  rat: { name: 'Pantry Rat', hp: 30, atk: 13, def: 2, xp: 14, w: 18, h: 11, raisins: 6, drop: ['cake', 0.08] },
  ghost: { name: 'Jar Ghost', hp: 34, atk: 14, def: 0, xp: 18, w: 16, h: 18, raisins: 7, drop: ['tea', 0.08], fly: true },
  spider: { name: 'Cellar Spider', hp: 26, atk: 12, def: 1, xp: 13, w: 14, h: 12, raisins: 5, drop: ['ring', 0.03], fly: true },
  book: { name: 'Flying Tome', hp: 38, atk: 16, def: 2, xp: 22, w: 16, h: 12, raisins: 8, drop: ['tea', 0.06], fly: true },
  quill: { name: 'Ink Quill', hp: 30, atk: 14, def: 1, xp: 20, w: 10, h: 18, raisins: 7, drop: ['ring', 0.03], fly: true },
  ink: { name: 'Ink Blot', hp: 50, atk: 17, def: 4, xp: 26, w: 18, h: 12, raisins: 9, drop: ['cake', 0.08] },
  mouse: { name: 'Clockwork Mouse', hp: 44, atk: 18, def: 5, xp: 28, w: 16, h: 11, raisins: 9, drop: ['tea', 0.06] },
  cuckoo: { name: 'Cuckoo', hp: 40, atk: 16, def: 3, xp: 26, w: 14, h: 14, raisins: 8, drop: ['ring', 0.04], fly: true },
  toad: { name: 'Spring Toad', hp: 60, atk: 20, def: 5, xp: 32, w: 18, h: 14, raisins: 10, drop: ['cake', 0.08] },
};
const FOE_CHARS: Record<string, FoeKind> = { b: 'bat', m: 'moth', k: 'beetle', x: 'bone', a: 'armadillo', r: 'rat', g: 'ghost', p: 'spider', v: 'book', q: 'quill', j: 'ink', c: 'mouse', u: 'cuckoo', t: 'toad' };
/** A jar ghost is solid for GHOST_ON seconds, then fades out (can't hurt or be hurt) for GHOST_OFF. */
export const GHOST_ON = 2.4, GHOST_OFF = 1.4;
/** How long a defeated foe takes to burn away. */
export const BURN_T = 0.45;
export const ghostFaded = (e: Enemy) => e.kind === 'ghost' && e.t % (GHOST_ON + GHOST_OFF) > GHOST_ON;
/** A cuckoo pops out of its clock every CUCKOO_WAIT seconds (while you're near) for CUCKOO_OUT. */
export const CUCKOO_WAIT = 2.6, CUCKOO_OUT = 1.3;
/** Foes that can neither hurt nor be hurt just now: a faded jar ghost, or a cuckoo shut inside its clock. */
export const foeHidden = (e: Enemy) => ghostFaded(e) || (e.kind === 'cuckoo' && e.state === 'idle');
export type Enemy = {
  /** Which map marker it came from, so a defeated one stays down. Summoned foes have none. */
  key?: string;
  id: number; kind: FoeKind; x: number; y: number; vx: number; vy: number; hp: number; face: 1 | -1; t: number;
  state: 'idle' | 'awake' | 'wind' | 'lunge' | 'rest' | 'throw'; stateT: number; flash: number; hx: number; hy: number;
  ground: boolean; hitId: number; dead: number;
};

export const BOSSES: Record<BossId, { name: string; hp: number; atk: number; def: number; xp: number; w: number; h: number }> = {
  owl: { name: 'Duke Hootsworth', hp: 260, atk: 12, def: 3, xp: 120, w: 36, h: 30 },
  rat: { name: 'Gnawdrick the Rat King', hp: 560, atk: 18, def: 6, xp: 320, w: 46, h: 34 },
  fox: { name: 'Count Culpeo', hp: 980, atk: 24, def: 8, xp: 600, w: 26, h: 44 },
  cat: { name: 'Tick-Tock the Clockwork Cat', hp: 1900, atk: 28, def: 12, xp: 900, w: 40, h: 26 },
};
/** What each boss is filed under in the Bestiary. */
export const BOSS_KILLS: Record<BossId, string> = { owl: 'owl', rat: 'rat_king', fox: 'culpeo', cat: 'ticktock' };
/** The chapter each boss ends. */
const BOSS_CHAPTER: Record<BossId, number> = { owl: 1, rat: 2, fox: 3, cat: 4 };
export const OWL = BOSSES.owl, RAT = BOSSES.rat;
export type OwlMove = 'enter' | 'hover' | 'feathers' | 'rise' | 'swoop' | 'track' | 'drop' | 'rest' | 'dying';
export type RatMove = 'enter' | 'idle' | 'wind' | 'charge' | 'stunned' | 'crouch' | 'leap' | 'cheese' | 'dying';
export type FoxMove = 'enter' | 'float' | 'fire' | 'vanish' | 'appear' | 'lunge' | 'swoop' | 'pillars' | 'dying';
export type CatMove = 'enter' | 'prowl' | 'crouch' | 'pounce' | 'cogs' | 'dash' | 'climb' | 'cling' | 'dive' | 'dizzy' | 'chime' | 'dying';
/** A boss. (x, y) is the middle of its body. */
export type Boss = {
  kind: BossId; x: number; y: number; vx: number; vy: number; hp: number; max: number; move: OwlMove | RatMove | FoxMove | CatMove;
  t: number; face: 1 | -1; flash: number; phase2: boolean; summoned: boolean; sx: number; ex: number; side: number; last: string[]; hitId: number;
};

/**
 * A projectile. Hero shots that `pierce` hit each foe once (or again every `rehit` seconds) instead of stopping.
 * `ax` pulls the Boomerang Acorn back.
 */
export type Shot = {
  kind: 'seed' | 'bone' | 'feather' | 'wave' | 'cheese' | 'rock' | 'gust' | 'acorn' | 'pumpkin' | 'flame' | 'wind' | 'quake' | 'fire' | 'ink'
    | 'cog' | 'note' | 'chime' | 'petal' | 'boulder';
  x: number; y: number; vx: number; vy: number; grav: number; r: number; dmg: number; hero: boolean; life: number; spin: number;
  pierce?: boolean; hits?: Map<number, number>; rehit?: number; ax?: number; launch?: boolean; t?: number;
  /** A finisher's shot (big numbers), or a spell's (a bigger look too). */
  heavy?: boolean; spell?: boolean;
  /** Where a Petal Ward petal sits in its orbit. */
  phase?: number;
};
/** `spell` is a scroll that teaches a spell; `key` is Nutmeg's pocket watch. Nutmeg `pull`s loose loot to the lead. */
export type Pickup = {
  kind: 'raisin' | 'seeds' | 'food' | 'gear' | 'leaf' | 'relic' | 'dust' | 'sub' | 'spell' | 'key'; id: string; amount: number; x: number; y: number; vy: number; t: number;
  flag?: string; fixed: boolean; pull?: boolean;
};
/** Zippy's cage on the belfry stair: three hits break it. */
export type Cage = { x: number; y: number; hp: number; flash: number };
/** The familiar travelling with the heroes. */
export type PalBody = { x: number; y: number; face: 1 | -1; cd: number; act: number; target: number; t: number };
export type Candle = { x: number; y: number; alive: boolean; c: number; r: number };
/** One of the bookshelves in a room's puzzle, numbered 1–3. `flash` shows a strike and stops another for a moment. */
export type Shelf = { x: number; y: number; n: number; flash: number };
/** A damage number; `big` ones (finishers, spells, the Duo Strike) show larger and in gold. */
export type Pop = { x: number; y: number; text: string; t: number; color: string; big?: boolean };
/** A mote of Dust flying out of a defeated foe and into the lead, worth `mp`. */
export type Orb = { x: number; y: number; vx: number; vy: number; t: number; mp: number };
export type Fx = {
  kind: 'dust' | 'spark' | 'poof' | 'clink' | 'flame' | 'rubble' | 'boom' | 'feather' | 'star' | 'ash' | 'slash' | 'hop'
    | 'shard' | 'fur' | 'claw' | 'pillar' | 'ember';
  x: number; y: number; t: number; vx: number; vy: number; color?: string;
};
/** How long each effect lives, in seconds. */
export const FX_LIFE: Record<Fx['kind'], number> = { dust: 0.5, spark: 0.35, poof: 0.5, clink: 0.35, flame: 0.5, rubble: 0.9, boom: 0.6, feather: 0.5, star: 0.5, ash: 0.9, slash: 0.2, hop: 0.35,
  shard: 0.55, fur: 0.45, claw: 0.3, pillar: 1.5, ember: 0.8,
};
/** The colours an enemy crumbles into when defeated. */
const ASH: Record<FoeKind, string[]> = {
  bat: ['#4e3a60', '#8a70a8'], moth: ['#c8b8a0', '#f0e8d8'], beetle: ['#3a7088', '#1e3a48'], bone: ['#e8e2d0', '#a8a090'],
  armadillo: ['#a88a68', '#6a5040'], rat: ['#8a7a70', '#c8b0a0'], ghost: ['#9ff0c8', '#e8fff4'], spider: ['#4a3a4a', '#a06080'],
  book: ['#8a2a3a', '#f0e6d0'], quill: ['#f4f0e8', '#1a1a30'], ink: ['#1a1830', '#4a4870'],
  mouse: ['#c8a050', '#6a6a78'], cuckoo: ['#8a5a30', '#e8d8b0'], toad: ['#6a9a48', '#d8c060'],
};

export type Equip = Record<Slot, string | null>;
export type Save = {
  v: 1; room: string; x: number; y: number; level: number; xp: number; hp: Record<HeroId, number>; leader: HeroId;
  equip: Record<HeroId, Equip>; bag: Record<string, number>; relics: RelicId[]; flags: string[]; visited: string[];
  raisins: number; seeds: number; time: number; leaves: number;
  difficulty: Difficulty; mp: number; subs: SubId[]; sub: SubId; pals: Partial<Record<PalId, { level: number; xp: number }>>; pal: PalId | null;
  kills: Record<string, number>;
};
export const freshSave = (difficulty: Difficulty = 'normal'): Save => ({
  v: 1, room: START.room, x: START.x, y: START.y, level: 1, xp: 0, hp: { dora: BASE.dora.hp, enzo: BASE.enzo.hp }, leader: 'dora',
  equip: { dora: { weapon: 'fan', armor: null, acc: null }, enzo: { weapon: 'claws', armor: 'scarf', acc: null } },
  bag: {}, relics: [], flags: [], visited: [], raisins: 0, seeds: 10, time: 0, leaves: 0,
  difficulty, mp: maxMp(1), subs: ['seed'], sub: 'seed', pals: {}, pal: null, kills: {},
});
/** A save read back from storage, or null when it doesn't look like one. */
export function parseSave(raw: string | null): Save | null {
  try {
    const v = JSON.parse(raw ?? 'null');
    if (!v || v.v !== 1 || typeof v.room !== 'string' || !ROOMS.some((r) => r.id === v.room)) return null;
    const f = freshSave(), num = (x: unknown, d: number) => (typeof x === 'number' && Number.isFinite(x) ? x : d);
    const strs = (a: unknown) => (Array.isArray(a) ? a.filter((s): s is string => typeof s === 'string') : []);
    const renamed = (id: unknown) => (typeof id === 'string' ? RENAMED[id] ?? id : null);
    const eq = (h: HeroId): Equip => {
      const e = v.equip?.[h] ?? {}, ok = (s: Slot) => { const id = renamed(e[s]); return id && GEAR[id]?.slot === s ? id : null; };
      return { weapon: ok('weapon') ?? f.equip[h].weapon, armor: ok('armor'), acc: ok('acc') };
    };
    const bag: Record<string, number> = {};
    for (const [old, n] of Object.entries(v.bag ?? {})) { const k = renamed(old)!; if ((GEAR[k] || FOOD[k]) && typeof n === 'number' && n > 0) bag[k] = (bag[k] ?? 0) + Math.floor(n); }
    const subs = strs(v.subs).filter((x): x is SubId => x in SUBS);
    if (!subs.includes('seed')) subs.unshift('seed');
    const pals: Save['pals'] = {};
    for (const id of Object.keys(PALS) as PalId[]) {
      const p = v.pals?.[id];
      if (p && typeof p === 'object') pals[id] = { level: Math.max(1, Math.min(10, Math.floor(num(p.level, 1)))), xp: Math.max(0, num(p.xp, 0)) };
    }
    const kills: Record<string, number> = {};
    for (const [k, n] of Object.entries(v.kills ?? {})) if (k in LORE && typeof n === 'number' && n > 0) kills[k] = Math.floor(n);
    const level = Math.max(1, Math.floor(num(v.level, 1)));
    return {
      v: 1, room: v.room, x: num(v.x, f.x), y: num(v.y, f.y), level, xp: Math.max(0, num(v.xp, 0)),
      hp: { dora: num(v.hp?.dora, f.hp.dora), enzo: num(v.hp?.enzo, f.hp.enzo) }, leader: v.leader === 'enzo' ? 'enzo' : 'dora',
      equip: { dora: eq('dora'), enzo: eq('enzo') }, bag, relics: strs(v.relics).filter((r): r is RelicId => r in RELICS),
      flags: strs(v.flags), visited: strs(v.visited), raisins: num(v.raisins, 0), seeds: num(v.seeds, 10), time: num(v.time, 0), leaves: num(v.leaves, 0),
      difficulty: v.difficulty in DIFFICULTY ? v.difficulty : 'normal', mp: Math.max(0, Math.min(maxMp(level), num(v.mp, maxMp(level)))),
      subs, sub: subs.includes(v.sub) ? v.sub : 'seed', pals, pal: typeof v.pal === 'string' && v.pal in pals ? v.pal : null, kills,
    };
  } catch { return null; }
}

const other = (h: HeroId): HeroId => (h === 'dora' ? 'enzo' : 'dora');
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
type Box = { x: number; y: number; w: number; h: number };
const overlap = (a: Box, b: Box) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

export class FluffstevaniaGame {
  level: number; xp: number; hp: Record<HeroId, number>; leader: HeroId; equipped: Record<HeroId, Equip>;
  bag: Record<string, number>; relics: Set<RelicId>; flags: Set<string>; visited: Set<string>;
  raisins: number; seeds: number; time: number; leaves: number;
  difficulty: Difficulty; mp: number; subs: Set<SubId>; sub: SubId; pals: Partial<Record<PalId, { level: number; xp: number }>>; pal: PalId | null;
  kills: Record<string, number>;
  /** The tag-team meter; full at DUO_MAX. `duoT` runs while the finisher plays. */
  duo = 0; duoT = -1;
  palBody: PalBody = { x: 0, y: 0, face: 1, cd: 0, act: 0, target: -1, t: 0 };
  cage: Cage | null = null;
  /** Foes defeated since the last rest or change of area, by marker; they stay down until then. */
  slain = new Set<string>();
  /** The shrine warp list is open. */
  warp = false;
  body: Body; room: Room; follower: Follower; trail: { x: number; y: number; face: 1 | -1; air: boolean }[] = [];
  tag: Tag | null = null; tagCd = 0;
  enemies: Enemy[] = []; boss: Boss | null = null; fight = false; shots: Shot[] = []; pickups: Pickup[] = []; candles: Candle[] = []; shelves: Shelf[] = [];
  pops: Pop[] = []; fx: Fx[] = []; orbs: Orb[] = [];
  state: 'play' | 'dead' | 'chapter' = 'play';
  /** The chapter just finished, while `state` is 'chapter'. */
  chapter = 0;
  /** Pip's shop is open; the world waits. */
  shop = false;
  /** A few frozen frames when a blow lands. */
  hitstop = 0;
  dialog: { lines: Line[]; i: number; next?: string } | null = null;
  toast: { text: string; t: number } | null = null;
  banner: { text: string; t: number } | null = null;
  events: string[] = [];
  /** The last save written at a shrine; the page stores it. */
  saved: Save | null = null;
  cam = { x: 0, y: 0 };
  shake = 0;
  private prev: Input = { ...NO_INPUT };
  private seed = 1;
  private nextId = 1;
  private atShrine = false;
  private sign = -1;
  private stall = false;
  private npc: PalId | null = null;
  private motion: { code: number; t: number }[] = [];
  private lastCode = 5;
  private mpT = 0;
  private chimed = new Set<string>();
  private chimeT = 0;
  private wasMist = false;
  /** The blow being dealt is a big one (a finisher, spell, tag or Duo Strike), for the damage numbers. */
  private heavy = false;

  constructor(save: Save = freshSave()) {
    this.level = save.level; this.xp = save.xp; this.hp = { ...save.hp }; this.leader = save.leader;
    this.equipped = { dora: { ...save.equip.dora }, enzo: { ...save.equip.enzo } }; this.bag = { ...save.bag };
    this.relics = new Set(save.relics); this.flags = new Set(save.flags); this.visited = new Set(save.visited);
    this.raisins = save.raisins; this.seeds = save.seeds; this.time = save.time; this.leaves = save.leaves;
    this.difficulty = save.difficulty ?? 'normal'; this.mp = save.mp ?? maxMp(save.level); this.subs = new Set(save.subs ?? ['seed']); this.sub = save.sub ?? 'seed';
    this.pals = Object.fromEntries(Object.entries(save.pals ?? {}).map(([k, v]) => [k, { ...v }])); this.pal = save.pal ?? null; this.kills = { ...save.kills };
    for (const h of ['dora', 'enzo'] as HeroId[]) this.hp[h] = Math.max(0, Math.min(Math.round(this.hp[h]), this.stats(h).maxHp));
    if (this.hp[this.leader] <= 0) this.leader = other(this.leader);
    if (this.hp[this.leader] <= 0) { this.hp.dora = this.stats('dora').maxHp; this.hp.enzo = this.stats('enzo').maxHp; }
    this.body = {
      x: save.x, y: save.y, vx: 0, vy: 0, face: 1, ground: false, coyote: 0, jumpBuf: 0, dashT: 0, dashCd: 0, airDash: false, dashJump: false,
      attackT: 0, attackId: 0, attackHero: this.leader, hurtT: 0, invT: 0, dropT: 0, run: 0, subCd: 0, hopped: false, lungeStop: false,
      combo: 0, comboT: 9, charge: 0, spin: false, castT: 0, cling: 0, clingT: 0, clingDir: 0, kickT: 0, kickDir: 0, rollT: 0,
    };
    this.room = roomById(save.room);
    this.follower = { x: save.x - FOLLOW, y: save.y, face: 1, air: false, moving: false, run: 0 };
    this.palBody = { x: save.x - FOLLOW - 12, y: save.y - 20, face: 1, cd: 0, act: 0, target: -1, t: 0 };
    this.enter(this.room, true);
    this.resetTrail();
    this.snapCamera();
  }

  // ─── Stats ──────────────────────────────────────────────────────────────
  stats(h: HeroId) {
    const b = BASE[h], g = GROW[h], l = this.level - 1, e = this.equipped[h];
    const gear = [e.weapon, e.armor, e.acc].map((id) => (id ? GEAR[id] : null));
    const sum = (k: 'atk' | 'def' | 'lck') => gear.reduce((s, it) => s + (it?.[k] ?? 0), 0);
    return {
      maxHp: Math.round(b.hp + g.hp * l) + this.leaves * LEAF_HP,
      atk: Math.round(b.atk + g.atk * l) + sum('atk'),
      def: Math.round(b.def + g.def * l) + sum('def'),
      lck: Math.round(b.lck + g.lck * l) + sum('lck'),
      speed: b.speed,
    };
  }
  weaponOf(h: HeroId) {
    const id = this.equipped[h].weapon, gear = id ? GEAR[id] : null;
    const style = gear?.style ?? (h === 'dora' ? 'fan' : 'claws');
    return { style, ...STYLES[style], reach: STYLES[style].reach + (gear?.reach ?? 0) };
  }
  get partner() { return other(this.leader); }
  get maxMp() { return maxMp(this.level); }
  /** Whether a spell is known: the first of each hero's comes with a level, the second from a scroll. */
  knows(id: SpellId) { const sp = SPELLS[id]; return sp.level ? this.level >= sp.level : this.flags.has(`spell:${id}`); }
  /** A hero's first spell, once they're high enough level to know it. */
  spellOf(h: HeroId): SpellId | null { const id = (Object.keys(SPELLS) as SpellId[]).find((k) => SPELLS[k].hero === h)!; return this.knows(id) ? id : null; }
  /** Every spell a hero knows, first spell first. */
  spellsOf(h: HeroId) { return (Object.keys(SPELLS) as SpellId[]).filter((k) => SPELLS[k].hero === h && this.knows(k)); }
  /** The lead is clinging to a wall with the Wall Cling. */
  get clinging() { return this.body.cling !== 0; }
  has(r: RelicId) { return this.relics.has(r); }
  /** The lead is part-way through an iron grate in Mist Form, and is drawn as a wisp of dust. */
  get misting() { return this.has('mist') && this.inGrate(this.body.x, this.body.y); }
  /** Whether a hero-sized box with its feet at (x, y) overlaps a grate. */
  inGrate(x: number, y: number) {
    for (let c = Math.floor((x - HERO_W / 2 - 2) / TILE); c <= Math.floor((x + HERO_W / 2 + 2) / TILE); c++)
      for (let r = Math.floor((y - HERO_H) / TILE); r <= Math.floor((y - 1) / TILE); r++) if (rawTile(c, r) === '|') return true;
    return false;
  }
  get completion() { return Math.round((this.visited.size / TOTAL_CELLS) * 100); }

  private rand() {
    this.seed = (this.seed + 0x6d2b79f5) | 0;
    let t = this.seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // ─── Tiles ──────────────────────────────────────────────────────────────
  tile(c: number, r: number): string {
    const ch = rawTile(c, r);
    if (ch === '%' && this.flags.has(`wall:${c},${r}`)) return '.';
    if (ch === 'G') return this.fight ? 'G' : '.';
    if (ch === 'D' && this.doorOpen(c, r)) return '.';
    return ch;
  }
  /** Sealed doors open for good once their room's `opens` flag is set. */
  doorOpen(c: number, r: number) {
    const opens = roomAt(Math.floor(c / COLS), Math.floor(r / ROWS))?.opens;
    return !!opens && this.flags.has(opens);
  }
  solidAt(x: number, y: number) { return isSolid(this.tile(Math.floor(x / TILE), Math.floor(y / TILE))); }
  /**
   * Move a box whose feet are at (x, y). Ledges (`=`) only catch things falling onto them from above.
   * Returns which sides hit something.
   */
  private move(o: { x: number; y: number; vx: number; vy: number }, w: number, h: number, dt: number, ledges: boolean, mist = false) {
    const hit = { x: false, down: false, up: false };
    // In Mist Form a hero drifts through iron grates as if they weren't there.
    const isSolid = mist ? (ch: string) => ch !== '|' && isSolidTile(ch) : isSolidTile;
    const hw = w / 2;
    o.x += o.vx * dt;
    const top = Math.floor((o.y - h + 0.01) / TILE), bot = Math.floor((o.y - 0.01) / TILE);
    if (o.vx > 0) {
      const c = Math.floor((o.x + hw) / TILE);
      for (let r = top; r <= bot; r++) if (isSolid(this.tile(c, r))) { o.x = c * TILE - hw - 0.01; hit.x = true; break; }
    } else if (o.vx < 0) {
      const c = Math.floor((o.x - hw) / TILE);
      for (let r = top; r <= bot; r++) if (isSolid(this.tile(c, r))) { o.x = (c + 1) * TILE + hw + 0.01; hit.x = true; break; }
    }
    const before = o.y;
    o.y += o.vy * dt;
    const l = Math.floor((o.x - hw + 0.01) / TILE), rr = Math.floor((o.x + hw - 0.01) / TILE);
    if (o.vy > 0) {
      const r = Math.floor(o.y / TILE);
      for (let c = l; c <= rr; c++) {
        const ch = this.tile(c, r);
        if (isSolid(ch) || (ledges && ch === '=' && before <= r * TILE + 0.01)) { o.y = r * TILE; o.vy = 0; hit.down = true; break; }
      }
    } else if (o.vy < 0) {
      const r = Math.floor((o.y - h) / TILE);
      for (let c = l; c <= rr; c++) if (isSolid(this.tile(c, r))) { o.y = (r + 1) * TILE + h; o.vy = 0; hit.up = true; break; }
    }
    return hit;
  }
  private onLedge() {
    const b = this.body, r = Math.floor(b.y / TILE + 0.01);
    if (Math.abs(b.y - r * TILE) > 0.5) return false;
    let ledge = false;
    for (let c = Math.floor((b.x - HERO_W / 2 + 0.01) / TILE); c <= Math.floor((b.x + HERO_W / 2 - 0.01) / TILE); c++) {
      const ch = this.tile(c, r);
      if (isSolid(ch)) return false;
      if (ch === '=') ledge = true;
    }
    return ledge;
  }
  private supported(x: number, y: number, w: number) {
    const r = Math.floor(y / TILE + 0.01);
    for (let c = Math.floor((x - w / 2 + 0.01) / TILE); c <= Math.floor((x + w / 2 - 0.01) / TILE); c++) {
      const ch = this.tile(c, r);
      if (isSolid(ch) || ch === '=') return true;
    }
    return false;
  }

  // ─── Rooms ──────────────────────────────────────────────────────────────
  private enter(room: Room, first = false) {
    const prevArea = this.room?.area;
    // Leaving an area lets its foes return; within an area they stay down until a rest.
    if (!first && prevArea !== room.area) this.slain.clear();
    this.room = room;
    this.enemies = []; this.shots = []; this.candles = []; this.shelves = []; this.boss = null; this.fight = false;
    this.pickups = []; this.cage = null; this.chimed.clear(); this.orbs = [];
    let item = 0;
    const rx = room.mx * COLS, ry = room.my * ROWS;
    for (let r = 0; r < room.rows.length; r++) for (let c = 0; c < room.rows[r].length; c++) {
      const ch = room.rows[r][c], wc = rx + c, wr = ry + r, x = (wc + 0.5) * TILE, y = (wr + 1) * TILE;
      const kind = FOE_CHARS[ch], key = `${room.id}:${c},${r}`;
      if (kind) { if (!this.slain.has(key)) this.spawn(kind, x, kind === 'bat' ? wr * TILE + FOES.bat.h + 2 : y).key = key; }
      else if (ch === 'Z' && !this.pals.zippy) this.cage = { x, y, hp: 3, flash: 0 };
      else if (ch === 'U' && room.sub && !this.subs.has(room.sub)) this.pickups.push({ kind: 'sub', id: room.sub, amount: 1, x, y: y - 4, vy: 0, t: 0, flag: `sub:${room.sub}`, fixed: true });
      else if (ch === 'i') this.candles.push({ x, y: wr * TILE + 12, alive: true, c: wc, r: wr });
      else if (ch === '1' || ch === '2' || ch === '3') this.shelves.push({ x, y, n: Number(ch), flash: 0 });
      else if (ch === 'I') {
        const id = room.items?.[item++], flag = `item:${room.id}:${item - 1}`;
        if (id && !this.flags.has(flag)) this.pickups.push({ kind: GEAR[id] ? 'gear' : 'food', id, amount: 1, x, y: y - 4, vy: 0, t: 0, flag, fixed: true });
      } else if (ch === 'H' && !this.flags.has(`leaf:${room.id}`)) this.pickups.push({ kind: 'leaf', id: 'leaf', amount: 1, x, y: y - 4, vy: 0, t: 0, flag: `leaf:${room.id}`, fixed: true });
      else if (ch === 'R' && room.relic && !this.relics.has(room.relic)) this.pickups.push({ kind: 'relic', id: room.relic, amount: 1, x, y: y - 6, vy: 0, t: 0, flag: `relic:${room.relic}`, fixed: true });
      else if (ch === 'T' && room.spell && !this.flags.has(`spell:${room.spell}`)) this.pickups.push({ kind: 'spell', id: room.spell, amount: 1, x, y: y - 4, vy: 0, t: 0, flag: `spell:${room.spell}`, fixed: true });
      else if (ch === 'W' && !this.flags.has('watch')) this.pickups.push({ kind: 'key', id: 'watch', amount: 1, x, y: y - 4, vy: 0, t: 0, flag: 'watch', fixed: true });
    }
    if (!first && prevArea !== room.area) this.banner = { text: AREAS[room.area].name, t: 2.4 };
    if (first) this.banner = { text: AREAS[room.area].name, t: 2.4 };
    const heal = DIFFICULTY[this.difficulty].doorHeal;
    if (!first && heal) for (const h of ['dora', 'enzo'] as HeroId[]) if (this.hp[h] > 0) this.hp[h] = Math.min(this.stats(h).maxHp, this.hp[h] + Math.ceil(this.stats(h).maxHp * heal));
    // A boss's leaf waits in their room if it wasn't picked up before the game was saved.
    if (room.boss && this.flags.has(`boss:${room.boss}`) && !this.flags.has(`leaf:${room.boss}`)) {
      const rr = roomRect(room);
      this.pickups.push({ kind: 'leaf', id: 'leaf', amount: 1, x: rr.x + rr.w / 2, y: rr.y + 12 * TILE - 4, vy: 0, t: 0, flag: `leaf:${room.boss}`, fixed: true });
    }
    const script = ROOM_SCRIPTS[room.id];
    if (script && !this.flags.has(`script:${script}`)) { this.flags.add(`script:${script}`); this.talk(script); }
    this.atShrine = true; this.sign = -1;
  }
  private spawn(kind: FoeKind, x: number, y: number) {
    const f = FOES[kind];
    const e: Enemy = { id: this.nextId++, kind, x, y, vx: 0, vy: 0, hp: Math.round(f.hp * DIFFICULTY[this.difficulty].foeHp), face: -1, t: this.rand() * 3, state: 'idle', stateT: 0, flash: 0, hx: x, hy: y, ground: false, hitId: -1, dead: 0 };
    this.enemies.push(e);
    return e;
  }
  private resetTrail() {
    const b = this.body;
    this.trail = [{ x: b.x - b.face * FOLLOW, y: b.y, face: b.face, air: false }, { x: b.x, y: b.y, face: b.face, air: !b.ground }];
    this.follower = { ...this.follower, x: b.x - b.face * FOLLOW, y: b.y, face: b.face };
  }
  private snapCamera() {
    const r = roomRect(this.room);
    this.cam.x = clamp(this.body.x - VIEW_W / 2, r.x, r.x + r.w - VIEW_W);
    this.cam.y = clamp(this.body.y - 12 - VIEW_H / 2, r.y, r.y + r.h - VIEW_H);
  }
  talk(script: string, next?: string) {
    const lines = SCRIPTS[script];
    if (lines) this.dialog = { lines, i: 0, next };
  }
  private say(text: string, t = 2.6) { this.toast = { text, t }; }

  // ─── The step ───────────────────────────────────────────────────────────
  step(dt: number, input: Input = NO_INPUT) {
    const pressed = (k: keyof Input) => input[k] && !this.prev[k];
    if (this.dialog) {
      if (pressed('jump') || pressed('attack') || pressed('up')) {
        this.dialog.i++;
        this.events.push('talk');
        if (this.dialog.i >= this.dialog.lines.length) {
          const next = this.dialog.next;
          this.dialog = null;
          if (next?.startsWith('chapter')) { this.state = 'chapter'; this.chapter = Number(next.slice(7)) || 1; }
        }
      }
      this.prev = { ...input };
      return;
    }
    if (this.state !== 'play' || this.shop || this.warp) { this.prev = { ...input }; return; }
    // Hitstop freezes the world for a moment. Presses made meanwhile still count afterwards.
    if (this.hitstop > 0) { this.hitstop = Math.max(0, this.hitstop - dt); return; }
    this.time += dt;
    if (this.toast && (this.toast.t -= dt) <= 0) this.toast = null;
    if (this.banner && (this.banner.t -= dt) <= 0) this.banner = null;
    this.shake = Math.max(0, this.shake - dt);
    this.tagCd = Math.max(0, this.tagCd - dt);
    for (this.mpT += dt; this.mpT >= 1.2; this.mpT -= 1.2) this.mp = Math.min(this.maxMp, this.mp + 1);
    // The tag-team finisher plays out while the rest of the world holds still.
    if (this.duoT >= 0) { this.duoStep(dt); this.particles(dt); this.prev = { ...input }; return; }

    this.control(dt, input, pressed);
    this.roomCheck();
    this.followerStep();
    this.hits();
    this.enemyStep(dt);
    this.bossStep(dt);
    this.shotStep(dt);
    this.pickupStep(dt);
    this.palStep(dt);
    this.touchStep(pressed);
    this.secretStep(dt);
    this.particles(dt);
    this.prev = { ...input };
  }
  private particles(dt: number) {
    for (const p of this.pops) { p.t += dt; p.y -= 22 * dt; }
    this.pops = this.pops.filter((p) => p.t < 0.9);
    for (const f of this.fx) {
      f.t += dt; f.x += f.vx * dt; f.y += f.vy * dt;
      if (f.kind === 'rubble' || f.kind === 'feather' || f.kind === 'shard') f.vy += 500 * dt;
      if (f.kind === 'fur') { f.vy += 40 * dt; f.vx *= 1 - dt * 3; }
      if (f.kind === 'ember') f.vx += Math.sin(f.t * 9 + f.x) * 30 * dt;
      if (f.kind === 'ash') { f.vy -= 60 * dt; f.vx *= 1 - dt * 2; }
    }
    this.fx = this.fx.filter((f) => f.t < FX_LIFE[f.kind]);
    this.orbStep(dt);
    // Mark the map cell the leader stands in, and ease the camera after them.
    const b = this.body;
    this.visited.add(`${Math.floor(b.x / VIEW_W)},${Math.floor((b.y - 10) / VIEW_H)}`);
    const r = roomRect(this.room);
    const tx = clamp(b.x + b.face * 24 - VIEW_W / 2, r.x, r.x + r.w - VIEW_W), ty = clamp(b.y - 12 - VIEW_H / 2, r.y, r.y + r.h - VIEW_H);
    this.cam.x += (tx - this.cam.x) * Math.min(1, dt * 8);
    this.cam.y += (ty - this.cam.y) * Math.min(1, dt * 8);
  }

  private control(dt: number, input: Input, pressed: (k: keyof Input) => boolean) {
    const b = this.body, me = this.stats(this.leader);
    b.invT = Math.max(0, b.invT - dt); b.dashCd = Math.max(0, b.dashCd - dt); b.subCd = Math.max(0, b.subCd - dt); b.dropT = Math.max(0, b.dropT - dt);
    if (b.attackT > 0) {
      const w = this.weaponOf(b.attackHero), before = b.attackT;
      b.attackT = Math.max(0, b.attackT - dt);
      // The spin hits twice.
      if (b.spin && SPIN.total - before < 0.22 && SPIN.total - b.attackT >= 0.22) b.attackId++;
      if (!b.spin && w.style === 'fan' && w.total - before < w.windup && w.total - b.attackT >= w.windup) this.gust();
      if (b.attackT <= 0) { b.comboT = 0; b.spin = false; }
    } else b.comboT += dt;
    b.castT = Math.max(0, b.castT - dt);
    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (pressed('jump')) b.jumpBuf = 0.1; else b.jumpBuf = Math.max(0, b.jumpBuf - dt);

    if (this.tag) {
      this.tag.t += dt;
      if (this.tag.t >= TAG_ARC) { b.vx = b.face * 260; b.vy = Math.min(b.vy, 0); }
      if (this.tag.t >= TAG_T) { this.tag = null; b.invT = Math.max(b.invT, 0.3); b.vx = 0; }
    } else if (b.hurtT > 0) {
      b.hurtT -= dt;
    } else {
      const duo = this.duo >= DUO_MAX && this.hp[this.partner] > 0 && (pressed('duo') || (pressed('tag') && input.attack) || (pressed('attack') && input.tag));
      if (duo) { this.startDuo(); return; }
      if (pressed('tag') && !duo) this.doTag(false);
      if (b.dashT > 0) {
        b.dashT -= dt; b.vx = b.face * DASH_V; b.vy = 0;
        if (this.time % 0.05 < dt) this.fx.push({ kind: 'dust', x: b.x - b.face * 6, y: b.y - 3, t: 0, vx: -b.face * 30, vy: -10 });
        if (b.dashT <= 0) b.dashCd = 0.12;
      } else if (b.rollT > 0) {
        // Boulder Roll: Enzo bowls along, and nothing touches him.
        b.rollT -= dt; b.vx = b.face * ROLL_V; b.invT = Math.max(b.invT, 0.05);
        if (b.ground && this.time % 0.04 < dt) this.fx.push({ kind: 'dust', x: b.x - b.face * 8, y: b.y - 2, t: 0, vx: -b.face * 40, vy: -18 });
      } else if (b.kickT > 0) {
        // Just after a wall kick the hero is pushed away from the wall.
        b.kickT -= dt; b.vx = b.kickDir * WALL_KICK_V;
      } else if (b.castT > 0 && b.ground) {
        b.vx = 0;
      } else if (b.attackT > 0 && b.ground) {
        // A ground swing roots you, except for the lunge that carries you into it.
        const w = this.weaponOf(b.attackHero), into = w.total - b.attackT;
        const lunging = !b.spin && w.lunge > 0 && !b.lungeStop && into < w.windup + w.active && this.supported(b.x + b.face * 8, b.y, 4);
        b.vx = lunging ? b.face * w.lunge : 0;
      } else {
        const speed = b.dashJump && !b.ground ? DASH_JUMP_V : me.speed;
        b.vx = dir * speed;
        if (dir && b.attackT <= 0) b.face = dir as 1 | -1;
      }
      if (pressed('dash') && this.has('dash') && b.dashCd <= 0 && b.dashT <= 0 && b.rollT <= 0 && (b.ground || !b.airDash)) {
        if (dir) b.face = dir as 1 | -1;
        b.dashT = DASH_T; b.attackT = 0; b.kickT = 0; if (!b.ground) b.airDash = true;
        this.events.push('dash');
        for (let i = 0; i < 4; i++) this.fx.push({ kind: 'dust', x: b.x, y: b.y - 4, t: -i * 0.03, vx: -b.face * (40 + i * 20), vy: -20 + i * 8 });
        // A puff of loose fur flies off behind.
        for (let i = 0; i < 6; i++) this.fx.push({ kind: 'fur', x: b.x - b.face * 6, y: b.y - 8 - this.rand() * 10, t: -i * 0.02, vx: -b.face * (30 + this.rand() * 50), vy: -20 - this.rand() * 30, color: this.leader });
      }
      if (b.jumpBuf > 0 && input.down && this.onLedge()) { b.jumpBuf = 0; b.dropT = 0.2; b.y += 2; b.ground = false; }
      else if (b.jumpBuf > 0 && (b.ground || b.coyote > 0)) {
        b.dashJump = b.dashT > 0 || b.dashCd > 0.06;
        b.vy = -JUMP_V; b.ground = false; b.coyote = 0; b.jumpBuf = 0; b.dashT = 0;
        this.events.push('jump');
      } else if (b.jumpBuf > 0 && !b.ground && b.clingT > 0) {
        // A wall kick: up and away from the wall, which also gives back the air dash and the Cloud Hop.
        b.vy = -WALL_JUMP_V; b.kickDir = -b.clingDir; b.kickT = KICK_T; b.face = b.kickDir as 1 | -1; b.vx = b.kickDir * WALL_KICK_V;
        b.jumpBuf = 0; b.dashT = 0; b.clingT = 0; b.cling = 0; b.hopped = false; b.airDash = false; b.dashJump = false;
        this.events.push('walljump');
        for (let i = 0; i < 4; i++) this.fx.push({ kind: 'dust', x: b.x - b.kickDir * 7, y: b.y - 6 - i * 3, t: -i * 0.02, vx: -b.kickDir * (20 + i * 12), vy: -10 + i * 6 });
      } else if (b.jumpBuf > 0 && !b.ground && this.has('hop') && !b.hopped) {
        // The Cloud Hop: a second jump off a puff of dust.
        b.vy = -HOP_V; b.hopped = true; b.jumpBuf = 0; b.dashT = 0;
        this.events.push('hop');
        this.fx.push({ kind: 'hop', x: b.x, y: b.y, t: 0, vx: 0, vy: 0 });
        for (let i = 0; i < 5; i++) this.fx.push({ kind: 'dust', x: b.x + (i - 2) * 4, y: b.y, t: 0, vx: (i - 2) * 30, vy: 30 });
      }
      if (!input.jump && b.vy < -JUMP_CUT && b.dashT <= 0) b.vy = -JUMP_CUT;
      this.attackInput(input, pressed, dir, dt);
    }
    // Wall Cling: pushing into a wall in mid-air grips it, and the slide down it is slow.
    const cling = !this.tag && b.hurtT <= 0 && b.rollT <= 0 && b.dashT <= 0 && !b.ground && dir !== 0 && b.vy > -60 && this.has('climb') && this.wallBeside(dir);
    if (cling && !b.cling) this.events.push('cling');
    b.cling = cling ? dir : 0;
    if (cling) { b.clingT = 0.1; b.clingDir = dir; b.kickT = 0; } else b.clingT = Math.max(0, b.clingT - dt);
    if (b.dashT <= 0 && !(this.tag && this.tag.t >= TAG_ARC)) b.vy = Math.min(b.vy + G * dt, cling ? CLING_FALL : MAX_FALL);
    if (cling && b.vy > 20 && Math.floor(this.time * 16) !== Math.floor((this.time - dt) * 16)) this.fx.push({ kind: 'dust', x: b.x + dir * 6, y: b.y - 4, t: 0, vx: -dir * 15, vy: -15 });
    const wasGround = b.ground;
    const hit = this.move(b, HERO_W, HERO_H, dt, b.dropT <= 0, this.has('mist'));
    // Drifting through a grate: puffs of dust, and a whoosh as the heroes go to mist.
    const misting = this.misting;
    if (misting && !this.wasMist) this.events.push('mist');
    if (misting && Math.floor(this.time * 20) !== Math.floor((this.time - dt) * 20)) this.fx.push({ kind: 'dust', x: b.x + (this.rand() - 0.5) * 12, y: b.y - this.rand() * 18, t: 0, vx: (this.rand() - 0.5) * 30, vy: -20 });
    this.wasMist = misting;
    if (hit.down) {
      if (!wasGround && b.vy === 0) this.fx.push({ kind: 'dust', x: b.x, y: b.y, t: 0.2, vx: 0, vy: -8 });
      b.ground = true; b.airDash = false; b.dashJump = false; b.hopped = false; b.coyote = 0.08;
    } else {
      if (b.ground && b.vy >= 0 && this.supported(b.x, b.y, HERO_W) && b.dropT <= 0) { b.ground = true; }
      else { if (b.ground) b.coyote = 0.08; b.ground = false; b.coyote = Math.max(0, b.coyote - dt); }
    }
    if (hit.x && b.dashT > 0) b.dashT = 0;
    // A rolling boulder bounces back off walls.
    if (hit.x && b.rollT > 0) { b.face = -b.face as 1 | -1; this.shake = Math.max(this.shake, 0.15); this.events.push('clink'); }
    if (hit.down) b.kickT = 0;
    if (b.ground && Math.abs(b.vx) > 1) b.run += Math.abs(b.vx) * dt * 0.12;
    // Spikes bite anything standing on them.
    if (b.ground && this.tile(Math.floor(b.x / TILE), Math.floor(b.y / TILE + 0.01)) === '^') this.hurtHero(12, b.x + b.face, true);
  }

  /** Whether there's a wall the hero can cling to right beside them, on side `dir`. Spikes and grates don't count. */
  private wallBeside(dir: number) {
    const b = this.body, c = Math.floor((b.x + dir * (HERO_W / 2 + 1)) / TILE);
    for (const y of [b.y - 14, b.y - 5]) {
      const ch = this.tile(c, Math.floor(y / TILE));
      if (!isSolid(ch) || ch === '^' || ch === '|') return false;
    }
    return true;
  }
  /** Which way the stick points, in numpad notation relative to the way the lead faces (5 is neutral). */
  private motionCode(input: Input, dir: number) {
    const fwd = dir * this.body.face;
    return input.down ? (fwd > 0 ? 3 : fwd < 0 ? 1 : 2) : input.up ? 8 : fwd > 0 ? 6 : fwd < 0 ? 4 : 5;
  }
  /** Whether the last few directions pressed, within half a second, spell out `seq`. */
  private motionMatches(seq: number[]) {
    const recent = this.motion.filter((m) => m.t >= this.time - 0.5).map((m) => m.code);
    return recent.length >= seq.length && seq.every((code, i) => recent[recent.length - seq.length + i] === code);
  }
  private attackInput(input: Input, pressed: (k: keyof Input) => boolean, dir: number, dt: number) {
    const b = this.body, w = this.weaponOf(this.leader);
    const code = this.motionCode(input, dir);
    if (code !== this.lastCode) { if (code !== 5) { this.motion.push({ code, t: this.time }); if (this.motion.length > 6) this.motion.shift(); } this.lastCode = code; }
    // The spell button casts the lead's first spell, or with ↓ held their second; a motion and attack casts either.
    const spells = this.spellsOf(this.leader);
    const byMotion = pressed('attack') ? spells.find((id) => this.motionMatches(SPELLS[id].motion)) : undefined;
    const byButton = pressed('spell') ? (input.down && spells.length > 1 ? spells[1] : spells[0]) : undefined;
    const spell = byMotion ?? byButton;
    if (spell && b.attackT <= 0 && b.castT <= 0 && b.rollT <= 0) { this.cast(spell); return; }
    if (pressed('spell') && !spells.length) { this.say(`${this.leader === 'dora' ? 'Dora' : 'Enzo'} learns a spell at level ${SPELLS[this.leader === 'dora' ? 'whirlwind' : 'quake'].level}.`); return; }
    // Dora's fan: hold attack after a swing, then let go, for a whirlwind spin.
    if (w.style === 'fan' && input.attack && b.attackT <= 0 && !input.up) b.charge += dt;
    else if (!input.attack) {
      if (b.charge >= CHARGE_T && b.attackT <= 0 && w.style === 'fan') {
        b.attackT = SPIN.total; b.spin = true; b.attackId++; b.attackHero = this.leader; b.combo = 0; b.lungeStop = true;
        this.events.push('spin');
      }
      b.charge = 0;
    }
    if (!pressed('attack')) return;
    const into = w.total - b.attackT;
    const recovering = b.attackT > 0 && !b.spin && b.attackHero === this.leader && into >= w.windup + w.active;
    if (b.attackT > 0 && !recovering) return;
    if (input.up && b.attackT <= 0) { if (b.subCd <= 0) this.throwSub(); return; }
    b.combo = (recovering || b.comboT < COMBO_T) && b.combo < 2 ? b.combo + 1 : 0;
    b.attackT = w.total; b.attackId++; b.attackHero = this.leader; b.dashT = 0; b.lungeStop = false; b.spin = false; b.charge = 0;
    if (dir) b.face = dir as 1 | -1;
    this.events.push(b.combo === 2 ? 'finisher' : w.style === 'fan' ? 'fan' : w.style === 'club' ? 'club' : 'swipe');
    if (b.combo === 2 && w.style === 'club') for (const d of [-1, 1]) this.heroShot('quake', b.x + d * 12, b.y - 6, d * 170, 0, 7, this.stats(this.leader).atk * 0.8, 0.45, { pierce: true, launch: true, heavy: true });
  }
  /** A hero projectile. */
  private heroShot(kind: Shot['kind'], x: number, y: number, vx: number, vy: number, r: number, dmg: number, life: number, extra: Partial<Shot> = {}) {
    const s: Shot = { kind, x, y, vx, vy, grav: 0, r, dmg, hero: true, life, spin: 0, t: 0, ...extra };
    if (s.pierce) s.hits = new Map();
    this.shots.push(s);
    return s;
  }
  /** Each fan sweep blows a little gust of dust ahead; the combo's third sweep blows a big one that goes through foes. */
  private gust() {
    const b = this.body, atk = this.stats(b.attackHero).atk, big = b.combo === 2;
    this.heroShot('gust', b.x + b.face * 14, b.y - 13, b.face * (big ? 300 : 260), 0, big ? 9 : 5, atk * (big ? 0.9 : 0.5), big ? 0.6 : 0.35, big ? { pierce: true, heavy: true } : {});
  }
  private throwSub() {
    const b = this.body, sub = SUBS[this.sub], lv = this.level, f = b.face;
    if (this.seeds < sub.cost) { this.say(`Not enough seeds for the ${sub.name}.`); b.subCd = 0.3; return; }
    this.seeds -= sub.cost; b.subCd = 0.35;
    const x = b.x + f * 6, y = b.y - 14;
    if (this.sub === 'seed') this.heroShot('seed', x, y, f * 200 + b.vx * 0.3, -240, 4, 6 + lv * 2, 2, { grav: 800 });
    else if (this.sub === 'spread') for (const vy of [-250, -170, -90]) this.heroShot('seed', x, y, f * 230 + b.vx * 0.3, vy, 4, 5 + lv * 2, 2, { grav: 800 });
    else if (this.sub === 'acorn') this.heroShot('acorn', x, b.y - 12, f * 300, 0, 6, 8 + lv * 2.2, 1.6, { ax: -f * 520, pierce: true, rehit: 0.35 });
    else if (this.sub === 'cog') this.heroShot('cog', x, b.y - 10, f * 150, -120, 6, 10 + lv * 2.4, 2.6, { grav: 900, pierce: true, rehit: 0.3 });
    else this.heroShot('pumpkin', x, y, f * 150 + b.vx * 0.3, -280, 5, 0, 3, { grav: 800 });
    this.events.push('seed');
  }
  /** The Pumpkin Flask bursts into a row of flames on the floor below where it broke. */
  private burst(x: number, y: number) {
    let floor = Math.floor(y / TILE);
    while (floor < Math.floor(y / TILE) + 6 && !isSolid(this.tile(Math.floor(x / TILE), floor))) floor++;
    for (let i = -2; i <= 2; i++) {
      const fx = x + i * 11;
      if (isSolid(this.tile(Math.floor(fx / TILE), floor - 1))) continue;
      this.heroShot('flame', fx, floor * TILE - 6, 0, 0, 6, 6 + this.level * 1.6, 1.4, { pierce: true, rehit: 0.4 });
    }
    this.events.push('burst');
  }
  private cast(id: SpellId) {
    const sp = SPELLS[id], b = this.body;
    this.motion = [];
    if (this.mp < sp.cost) { this.say(`Not enough Dust for ${sp.name}.`); this.events.push('fizzle'); return; }
    this.mp -= sp.cost; b.castT = 0.4; b.attackT = 0; b.combo = 0; b.charge = 0;
    const atk = this.stats(this.leader).atk;
    if (id === 'whirlwind') this.heroShot('wind', b.x + b.face * 16, b.y - 14, b.face * 120, 0, 12, atk * 0.7 + 3, 1.6, { pierce: true, rehit: 0.25, spell: true });
    else if (id === 'petals') {
      this.shots = this.shots.filter((s) => s.kind !== 'petal');
      for (let i = 0; i < 6; i++) this.heroShot('petal', b.x, b.y - 12, 0, 0, 6, atk * 0.5 + 4, PETAL_T, { pierce: true, rehit: 0.3, spell: true, phase: (i * Math.PI) / 3 });
    } else if (id === 'boulder') {
      b.castT = 0; b.rollT = ROLL_T;
      this.heroShot('boulder', b.x, b.y - 9, 0, 0, 11, atk * 1.3 + 8, ROLL_T, { pierce: true, rehit: 0.25, spell: true, launch: true });
    } else {
      for (const d of [-1, 1]) this.heroShot('quake', b.x + d * 10, b.y - 6, d * 210, 0, 8, atk * 1.4 + 6, 0.9, { pierce: true, launch: true, spell: true });
      this.shake = 0.4;
      // Grit rains from the ceiling.
      for (let i = 0; i < 14; i++) this.fx.push({ kind: 'rubble', x: this.cam.x + this.rand() * VIEW_W, y: this.cam.y + 2, t: -this.rand() * 0.4, vx: (this.rand() - 0.5) * 20, vy: 40 + this.rand() * 60 });
    }
    this.events.push('spell');
    for (let i = 0; i < 8; i++) this.fx.push({ kind: 'star', x: b.x, y: b.y - 14, t: -i * 0.02, vx: Math.cos(i) * 40, vy: Math.sin(i) * 40 });
  }
  /** Fill the tag-team meter. */
  private gainDuo(n: number) {
    if (this.hp[this.partner] <= 0 || this.duo >= DUO_MAX) return;
    this.duo = Math.min(DUO_MAX, this.duo + n);
    if (this.duo >= DUO_MAX) { this.say('Duo Strike ready! Press tag and attack together.'); this.events.push('duoready'); }
  }
  /** Both heroes dash across the screen together, striking every foe in view. */
  private startDuo() {
    const b = this.body;
    this.duo = 0; this.duoT = 0; b.attackT = 0; b.charge = 0; b.dashT = 0; b.rollT = 0;
    b.invT = Math.max(b.invT, DUO_T + 0.4);
    this.events.push('duo'); this.shake = 0.3;
  }
  private duoStep(dt: number) {
    const before = this.duoT;
    this.duoT += dt;
    if (before < 0.55 && this.duoT >= 0.55) {
      const view = { x: this.cam.x, y: this.cam.y, w: VIEW_W, h: VIEW_H };
      const dmg = (this.stats('dora').atk + this.stats('enzo').atk) * 1.2 + 10, lck = this.stats(this.leader).lck;
      this.heavy = true;
      for (const e of this.enemies) if (!e.dead && overlap(view, this.foeBox(e))) this.hitFoe(e, dmg, e.x - 1, true, lck, true);
      if (this.boss && this.bossOpen(this.boss) && overlap(view, this.bossBox(this.boss))) this.hitBoss(dmg, lck);
      this.heavy = false;
      for (const c of this.candles) if (c.alive && overlap(view, { x: c.x - 4, y: c.y - 12, w: 8, h: 14 })) this.snuff(c);
      this.shake = 0.5; this.hitstop = 0.12; this.events.push('crit');
    }
    if (this.duoT >= DUO_T) this.duoT = -1;
  }

  /** Swap heroes. The one coming in tumbles from behind to the front, hurting anything on the way. */
  doTag(forced: boolean) {
    const next = this.partner, b = this.body;
    if (!forced && (this.tagCd > 0 || this.tag)) return false;
    if (this.hp[next] <= 0) { if (!forced) this.say(`${next === 'dora' ? 'Dora' : 'Enzo'} needs a dust bath before tagging back in.`); return false; }
    this.tag = { t: 0, hero: next, sx: this.follower.x, sy: this.follower.y, hits: new Set() };
    this.leader = next; this.tagCd = TAG_CD;
    b.attackT = 0; b.dashT = 0; b.hurtT = 0; b.rollT = 0; b.kickT = 0; b.invT = Math.max(b.invT, TAG_T);
    if (!b.ground) b.vy = Math.min(b.vy, -120);
    this.trail = [{ x: b.x, y: b.y, face: b.face, air: !b.ground }];
    this.follower = { ...this.follower, x: b.x, y: b.y };
    this.events.push('tag');
    return true;
  }
  /** Where the hero coming in is drawn during a tag, and where the tag hurts. */
  tagPoint() {
    const t = this.tag, b = this.body;
    if (!t) return null;
    if (t.t >= TAG_ARC) return { x: b.x, y: b.y - 10, rolling: true };
    const u = t.t / TAG_ARC;
    return { x: t.sx + (b.x - t.sx) * u, y: t.sy - 10 + (b.y - t.sy) * u - Math.sin(Math.PI * u) * 28, rolling: false };
  }

  private roomCheck() {
    const b = this.body, mx = Math.floor(b.x / VIEW_W), my = Math.floor((b.y - 10) / VIEW_H);
    const room = roomAt(mx, my);
    if (room && room !== this.room) {
      this.enter(room);
      this.resetTrail();
      this.events.push('door');
    }
    // Falling out of the map entirely (it shouldn't happen): back to the last shrine spot.
    if (!room) { const r = roomRect(this.room); b.x = clamp(b.x, r.x + 20, r.x + r.w - 20); b.y = clamp(b.y, r.y + 40, r.y + r.h - 20); }
  }

  private followerStep() {
    const b = this.body, last = this.trail[this.trail.length - 1];
    if (Math.hypot(b.x - last.x, b.y - last.y) > 0.8) this.trail.push({ x: b.x, y: b.y, face: b.face, air: !b.ground });
    if (this.trail.length > 90) this.trail.splice(0, this.trail.length - 90);
    // Walk back along the leader's path until FOLLOW pixels behind.
    let d = 0, i = this.trail.length - 1;
    while (i > 0 && d < FOLLOW) { d += Math.hypot(this.trail[i].x - this.trail[i - 1].x, this.trail[i].y - this.trail[i - 1].y); i--; }
    const p = this.trail[i], f = this.follower, ox = f.x, oy = f.y;
    f.x += (p.x - f.x) * 0.25; f.y += (p.y - f.y) * 0.25;
    const moved = Math.hypot(f.x - ox, f.y - oy);
    f.moving = moved > 0.15; f.air = p.air; f.run += moved * 0.12;
    if (Math.abs(f.x - ox) > 0.1) f.face = f.x > ox ? 1 : -1;
    else if (!f.moving) f.face = b.x >= f.x ? 1 : -1;
  }

  // ─── Combat ─────────────────────────────────────────────────────────────
  /** The leader's weapon hitbox while a swing is live. */
  attackBox(): Box | null {
    const b = this.body;
    if (b.attackT <= 0) return null;
    if (b.spin) {
      const into = SPIN.total - b.attackT;
      return into < SPIN.active[0] || into > SPIN.active[1] ? null : { x: b.x - SPIN.reach, y: b.y - 28, w: SPIN.reach * 2, h: 30 };
    }
    const w = this.weaponOf(b.attackHero), into = w.total - b.attackT;
    if (into < w.windup || into > w.windup + w.active) return null;
    const x = b.face > 0 ? b.x + 4 : b.x - 4 - w.reach;
    return { x, y: b.y - 15 - w.h / 2 + 2, w: w.reach, h: w.h };
  }
  private hits() {
    const b = this.body, box = this.attackBox(), tp = this.tagPoint();
    const tagBox = tp ? { x: tp.x - 16, y: tp.y - 14, w: 32, h: 28 } : null;
    const me = this.stats(b.attackHero), tagger = this.tag ? this.stats(this.tag.hero) : null;
    const landed = () => {
      // A lunge stops where it connects, with a sliver of safety so it doesn't run into the foe's body.
      b.lungeStop = true; b.invT = Math.max(b.invT, 0.15);
      this.fx.push({ kind: w.style === 'claws' ? 'claw' : 'slash', x: box!.x + box!.w / 2, y: box!.y + box!.h / 2, t: 0, vx: b.face, vy: finisher ? 1 : 0 });
    };
    const w = this.weaponOf(b.attackHero), finisher = b.combo === 2 && !b.spin;
    this.heavy = finisher || b.spin;
    const mult = b.spin ? SPIN.mult : w.mult * (finisher ? FINISHER_MULT : 1);
    // Enzo's third swipe is an uppercut that throws foes into the air.
    const launch = finisher && w.style === 'claws';
    for (const e of this.enemies) {
      if (e.dead || foeHidden(e)) continue;
      const eb = this.foeBox(e);
      if (box && e.hitId !== b.attackId && overlap(box, eb)) {
        e.hitId = b.attackId;
        if (this.hitFoe(e, me.atk * mult, b.x, false, me.lck, launch)) { landed(); this.gainDuo(7); } else b.lungeStop = true;
      }
      if (tagBox && tagger && !this.tag!.hits.has(e.id) && overlap(tagBox, eb)) { this.tag!.hits.add(e.id); this.heavy = true; this.hitFoe(e, tagger.atk * 1.6 + 4, tp!.x, true, tagger.lck); this.gainDuo(10); this.heavy = finisher || b.spin; }
    }
    const boss = this.boss;
    if (boss && this.bossOpen(boss)) {
      const bb = this.bossBox(boss);
      if (box && boss.hitId !== b.attackId && overlap(box, bb)) { boss.hitId = b.attackId; this.hitBoss(me.atk * mult, me.lck); landed(); this.hitstop = 0.04; this.gainDuo(5); }
      if (tagBox && tagger && !this.tag!.hits.has(-1) && overlap(tagBox, bb)) { this.tag!.hits.add(-1); this.heavy = true; this.hitBoss(tagger.atk * 1.6 + 4, tagger.lck); this.gainDuo(8); }
    }
    this.heavy = false;
    const cage = this.cage;
    if (cage) {
      cage.flash = Math.max(0, cage.flash - 1 / 120);
      const cb = { x: cage.x - 8, y: cage.y - 18, w: 16, h: 18 };
      if ((box && overlap(box, cb) && cage.flash <= 0) || (tagBox && overlap(tagBox, cb) && cage.flash <= 0)) this.hitCage();
    }
    for (const c of this.candles) {
      if (!c.alive) continue;
      const cb = { x: c.x - 4, y: c.y - 12, w: 8, h: 14 };
      if ((box && overlap(box, cb)) || (tagBox && overlap(tagBox, cb))) this.snuff(c);
    }
    for (const sh of this.shelves) {
      sh.flash = Math.max(0, sh.flash - 1 / 120);
      const sb = { x: sh.x - 10, y: sh.y - 30, w: 20, h: 30 };
      if (sh.flash <= 0 && ((box && overlap(box, sb)) || (tagBox && overlap(tagBox, sb)))) this.pullShelf(sh);
    }
    for (const hb of [box, tagBox]) if (hb) this.breakWalls(hb);
  }
  /** Striking a puzzle shelf: the right one opens the room's hidden door; a wrong one sends a book flying at you. */
  private pullShelf(sh: Shelf) {
    const room = this.room, flag = room.opens;
    sh.flash = 0.8;
    if (!flag || !room.puzzle) return;
    if (this.flags.has(flag)) { this.events.push('clink'); return; }
    if (sh.n === room.puzzle) {
      this.flags.add(flag); this.events.push('secret'); this.shake = 0.3;
      this.say('A book slides out with a click, and somewhere a door grinds open!', 3.2);
    } else {
      const e = this.spawn('book', sh.x, sh.y - 30);
      e.state = 'awake';
      this.events.push('snap');
      this.say('Wrong book! It flaps off the shelf and bites.');
    }
  }
  private breakWalls(hb: Box) {
    for (let c = Math.floor(hb.x / TILE); c <= Math.floor((hb.x + hb.w) / TILE); c++)
      for (let r = Math.floor(hb.y / TILE); r <= Math.floor((hb.y + hb.h) / TILE); r++) {
        if (this.tile(c, r) !== '%') continue;
        // The whole cracked section crumbles at once.
        const stack: [number, number][] = [[c, r]];
        while (stack.length) {
          const [x, y] = stack.pop()!;
          if (this.tile(x, y) !== '%') continue;
          this.flags.add(`wall:${x},${y}`);
          for (let i = 0; i < 3; i++) this.fx.push({ kind: 'rubble', x: (x + 0.5) * TILE, y: (y + 0.5) * TILE, t: 0, vx: (this.rand() - 0.5) * 120, vy: -80 - this.rand() * 120 });
          stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
        }
        this.events.push('break'); this.shake = 0.2;
        this.say('A hidden passage!');
      }
  }
  foeBox(e: Enemy): Box { const f = FOES[e.kind]; return { x: e.x - f.w / 2, y: e.y - f.h, w: f.w, h: f.h }; }
  private guarded(e: Enemy, fromX: number) {
    return e.kind === 'armadillo' && e.state !== 'rest' && Math.sign(fromX - e.x) === e.face;
  }
  /** Returns whether the blow did damage (a shield turns it aside). Melee blows (not `pierce`) freeze the frame briefly. */
  private hitCage() {
    const cage = this.cage!;
    cage.hp--; cage.flash = 0.3;
    this.events.push('clink');
    this.fx.push({ kind: 'clink', x: cage.x, y: cage.y - 10, t: 0, vx: 0, vy: 0 });
    if (cage.hp > 0) return;
    for (let i = 0; i < 6; i++) this.fx.push({ kind: 'rubble', x: cage.x, y: cage.y - 10, t: 0, vx: (this.rand() - 0.5) * 140, vy: -80 - this.rand() * 100 });
    this.cage = null;
    this.join('zippy', 'zippyFree');
  }
  /** A familiar joins; the first one to join comes along straight away. */
  private join(id: PalId, script: string) {
    this.pals[id] = { level: 1, xp: 0 };
    if (!this.pal) this.setPal(id);
    this.events.push('relic');
    this.talk(script);
  }
  private hitFoe(e: Enemy, raw: number, fromX: number, pierce: boolean, lck: number, launch = false) {
    const f = FOES[e.kind];
    if (!pierce && this.guarded(e, fromX)) {
      this.fx.push({ kind: 'clink', x: e.x + e.face * 10, y: e.y - 10, t: 0, vx: 0, vy: 0 });
      this.pops.push({ x: e.x, y: e.y - f.h - 4, text: 'GUARD', t: 0, color: '#9fb4c8' });
      this.events.push('clink');
      return false;
    }
    const crit = this.rand() * 100 < lck;
    const dmg = Math.max(1, Math.round(raw * (crit ? 1.5 : 1) - f.def));
    e.hp -= dmg; e.flash = 0.15;
    this.pops.push({ x: e.x, y: e.y - f.h - 4, text: String(dmg), t: 0, color: crit || this.heavy ? '#ffd35a' : '#ffffff', big: this.heavy });
    this.fx.push({ kind: 'spark', x: e.x, y: e.y - f.h / 2, t: 0, vx: Math.sign(e.x - fromX) || 1, vy: 0 });
    this.events.push(crit ? 'crit' : 'hit');
    if (!pierce) this.hitstop = crit ? 0.08 : 0.05;
    if (!f.fly) { e.vx = Math.sign(e.x - fromX || 1) * (launch ? 60 : 90); e.vy = launch ? -330 : -90; e.ground = false; }
    else if (e.kind !== 'cuckoo') { e.x += Math.sign(e.x - fromX || 1) * 6; }
    if (e.kind === 'spider' && e.state !== 'rest') { e.state = 'rest'; e.stateT = 0; }
    if (e.hp <= 0) this.killFoe(e);
    return true;
  }
  private killFoe(e: Enemy) {
    const f = FOES[e.kind];
    // `dead` counts up while the body burns away (drawn by the scene), then it's gone.
    e.dead = 1e-3;
    this.events.push('kill');
    this.kills[e.kind] = (this.kills[e.kind] ?? 0) + 1;
    if (e.key) this.slain.add(e.key);
    this.fx.push({ kind: 'poof', x: e.x, y: e.y - f.h / 2, t: 0, vx: 0, vy: 0 });
    // The foe crumbles into dust that drifts up.
    for (let i = 0; i < 16; i++) {
      this.fx.push({ kind: 'ash', x: e.x + (this.rand() - 0.5) * f.w, y: e.y - this.rand() * f.h, t: -this.rand() * 0.15, vx: (this.rand() - 0.5) * 50, vy: -10 - this.rand() * 30, color: ASH[e.kind][i % 2] });
    }
    // As it burns away, embers rise from it.
    for (let i = 0; i < 8; i++) this.fx.push({ kind: 'ember', x: e.x + (this.rand() - 0.5) * f.w, y: e.y - this.rand() * f.h, t: -0.05 - this.rand() * 0.3, vx: (this.rand() - 0.5) * 20, vy: -30 - this.rand() * 40 });
    // Motes of Dust fly out and home in on the lead, each topping up the Dust meter.
    for (let i = 0; i < 2; i++) this.orbs.push({ x: e.x, y: e.y - f.h / 2, vx: (this.rand() - 0.5) * 160, vy: -80 - this.rand() * 80, t: 0, mp: f.hp >= 30 ? 2 : 1 });
    this.gainXp(f.xp);
    for (let i = 0; i < Math.ceil(f.raisins / 3); i++) this.drop('raisin', 'raisin', Math.min(3, f.raisins - i * 3), e.x, e.y - f.h / 2);
    const luck = this.stats(this.leader).lck;
    if (f.drop && this.rand() < f.drop[1] * (1 + luck / 25)) this.drop(GEAR[f.drop[0]] ? 'gear' : 'food', f.drop[0], 1, e.x, e.y - f.h / 2);
    // Nutmeg sometimes digs up a few more raisins where a foe fell.
    const nut = this.pal === 'nutmeg' ? this.pals.nutmeg! : null;
    if (nut && this.rand() < (15 + 3 * nut.level) / 100) {
      this.drop('raisin', 'raisin', 3, e.x, e.y - f.h / 2);
      this.pops.push({ x: e.x, y: e.y - f.h - 12, text: 'FOUND!', t: 0, color: '#f0c890' });
      this.palBody.act = 0.5; this.events.push('nip');
    }
  }
  private drop(kind: Pickup['kind'], id: string, amount: number, x: number, y: number) {
    this.pickups.push({ kind, id, amount, x: x + (this.rand() - 0.5) * 10, y, vy: -150 - this.rand() * 60, t: 0, fixed: false });
  }
  private snuff(c: Candle) {
    c.alive = false;
    this.events.push('candle');
    this.fx.push({ kind: 'flame', x: c.x, y: c.y - 10, t: 0, vx: 0, vy: -20 });
    const roll = this.rand();
    if (roll < 0.4) this.drop('seeds', 'seeds', roll < 0.1 ? 5 : 1, c.x, c.y - 8);
    else if (roll < 0.7) this.drop('raisin', 'raisin', roll < 0.48 ? 5 : 1, c.x, c.y - 8);
    else if (roll < 0.87) this.drop('dust', 'dust', 8, c.x, c.y - 8);
    else if (roll < 0.94) this.drop('food', 'berry', 1, c.x, c.y - 8);
  }
  gainXp(n: number) {
    this.xp += n;
    const pal = this.pal ? this.pals[this.pal] : null;
    if (pal && pal.level < 10) {
      pal.xp += n;
      while (pal.level < 10 && pal.xp >= palXpToNext(pal.level)) { pal.xp -= palXpToNext(pal.level); pal.level++; this.say(`${PALS[this.pal!].name} grows to level ${pal.level}!`); }
    }
    while (this.xp >= xpToNext(this.level)) {
      this.xp -= xpToNext(this.level);
      const before = { dora: this.stats('dora').maxHp, enzo: this.stats('enzo').maxHp };
      this.level++;
      for (const h of ['dora', 'enzo'] as HeroId[]) if (this.hp[h] > 0) this.hp[h] += this.stats(h).maxHp - before[h];
      this.mp = Math.min(this.maxMp, this.mp + 2);
      const learnt = (Object.keys(SPELLS) as SpellId[]).find((k) => SPELLS[k].level === this.level);
      this.say(learnt ? `${SPELLS[learnt].hero === 'dora' ? 'Dora' : 'Enzo'} learns ${SPELLS[learnt].name}! ${SPELLS[learnt].keys}` : `Level up! Dora and Enzo reach level ${this.level}.`, learnt ? 4 : 2.6);
      this.events.push('level');
      this.fx.push({ kind: 'star', x: this.body.x, y: this.body.y - 24, t: 0, vx: 0, vy: -30 });
      this.fx.push({ kind: 'pillar', x: this.body.x, y: this.body.y, t: 0, vx: 0, vy: 0 });
    }
  }

  /** Damage the leader. Knocks them back and gives a moment of safety; at 0 HP the partner takes over. */
  hurtHero(raw: number, fromX: number, hazard = false) {
    const b = this.body;
    if (b.invT > 0 || this.tag || this.state !== 'play' || this.duoT >= 0) return;
    const dmg = Math.max(1, Math.round(raw * DIFFICULTY[this.difficulty].foeAtk - this.stats(this.leader).def));
    this.hp[this.leader] = Math.max(0, this.hp[this.leader] - dmg);
    this.pops.push({ x: b.x, y: b.y - 26, text: String(dmg), t: 0, color: '#ff7a7a' });
    this.events.push('hurt'); this.shake = 0.15;
    const away = b.x < fromX ? -1 : 1;
    b.vx = away * 120; b.vy = hazard ? -380 : -240; b.hurtT = 0.3; b.invT = 1; b.dashT = 0; b.attackT = 0; b.ground = false;
    if (this.hp[this.leader] <= 0) {
      const down = this.leader;
      this.events.push('down');
      if (this.hp[other(down)] > 0) {
        this.doTag(true);
        this.say(`${down === 'dora' ? 'Dora' : 'Enzo'} is worn out! A dust bath will get them back on their paws.`, 3.2);
      } else {
        this.state = 'dead';
        this.events.push('dead');
      }
    }
  }

  private enemyStep(dt: number) {
    const b = this.body, me = { x: b.x - HERO_W / 2, y: b.y - HERO_H, w: HERO_W, h: HERO_H };
    for (const e of this.enemies) {
      if (e.dead) { e.dead += dt; continue; }
      e.t += dt; e.flash = Math.max(0, e.flash - dt); e.stateT += dt;
      const dx = b.x - e.x, dy = b.y - 10 - (e.y - FOES[e.kind].h / 2), dist = Math.hypot(dx, dy);
      if (e.kind === 'bat') {
        if (e.state === 'idle') { if (Math.abs(dx) < 120 && Math.abs(dy) < 110) { e.state = 'awake'; this.events.push('flap'); } }
        else {
          e.face = dx > 0 ? 1 : -1;
          e.x += clamp(dx, -1, 1) * 72 * dt;
          const ty = b.y - 8 + Math.sin(e.t * 4) * 20;
          e.y += clamp(ty - e.y, -90 * dt, 90 * dt);
        }
      } else if (e.kind === 'moth') {
        if (dist < 200) { e.x += clamp(dx, -1, 1) * 26 * dt; e.y += clamp(dy + 6, -1, 1) * 20 * dt; e.face = dx > 0 ? 1 : -1; }
        e.y += Math.sin(e.t * 3) * 18 * dt;
      } else if (e.kind === 'ghost') {
        // Drifts after you, fading in and out of sight.
        if (dist < 220) { e.x += clamp(dx / 40, -1, 1) * 40 * dt; e.y += clamp(dy / 40, -1, 1) * 30 * dt; e.face = dx > 0 ? 1 : -1; }
        e.y += Math.sin(e.t * 2.4) * 14 * dt;
      } else if (e.kind === 'book') {
        // Rests shut on the air until you come near, then flaps after you and snaps forward, pages first.
        if (e.state === 'idle') { e.y = e.hy + Math.sin(e.t * 2) * 2; if (dist < 140) { e.state = 'awake'; e.stateT = 0; this.events.push('flap'); } }
        else if (e.state === 'awake') {
          e.face = dx > 0 ? 1 : -1;
          e.x += clamp(dx / 60, -1, 1) * 55 * dt; e.y += clamp((dy + Math.sin(e.t * 5) * 14) / 40, -1, 1) * 50 * dt;
          if (e.stateT > 1.6 && dist < 110) { e.state = 'wind'; e.stateT = 0; e.vx = dx / (dist || 1); e.vy = dy / (dist || 1); }
        } else if (e.state === 'wind') { if (e.stateT > 0.3) { e.state = 'lunge'; e.stateT = 0; this.events.push('snap'); } }
        else if (e.state === 'lunge') {
          e.x += e.vx * 200 * dt; e.y += e.vy * 200 * dt;
          if (e.stateT > 0.35 || this.solidAt(e.x, e.y - 6)) { e.state = 'rest'; e.stateT = 0; }
        } else if (e.stateT > 0.5) { e.state = 'awake'; e.stateT = 0; }
      } else if (e.kind === 'quill') {
        // Hovers about its post and flicks blots of ink at you.
        e.face = dx > 0 ? 1 : -1;
        const tx = e.hx + Math.sin(e.t * 0.9) * 24, ty = e.hy + Math.sin(e.t * 2.2) * 8;
        e.x += clamp(tx - e.x, -40 * dt, 40 * dt); e.y += clamp(ty - e.y, -40 * dt, 40 * dt);
        if (e.state === 'throw') {
          if (e.stateT > 0.25 && e.stateT - dt <= 0.25) {
            const a = Math.atan2(dy, dx);
            this.shots.push({ kind: 'ink', x: e.x, y: e.y - FOES.quill.h / 2, vx: Math.cos(a) * 170, vy: Math.sin(a) * 170, grav: 0, r: 4, dmg: 12, hero: false, life: 2.5, spin: 0 });
            this.events.push('throw');
          }
          if (e.stateT > 0.6) { e.state = 'idle'; e.stateT = 0; }
        } else if (e.stateT > 2.4 && dist < 230) { e.state = 'throw'; e.stateT = 0; }
      } else if (e.kind === 'cuckoo') {
        // Shut in its clock on the wall, it pops out every little while you're near and spits a note at you.
        e.face = dx > 0 ? 1 : -1;
        if (e.state === 'idle') { if (e.stateT > CUCKOO_WAIT && dist < 200) { e.state = 'awake'; e.stateT = 0; this.events.push('cuckoo'); } }
        else {
          if (e.stateT > 0.35 && e.stateT - dt <= 0.35) {
            const a = Math.atan2(dy, dx);
            this.shots.push({ kind: 'note', x: e.x + e.face * 6, y: e.y - FOES.cuckoo.h / 2, vx: Math.cos(a) * 150, vy: Math.sin(a) * 150, grav: 0, r: 4, dmg: 14, hero: false, life: 2.5, spin: 0 });
          }
          if (e.stateT > CUCKOO_OUT) { e.state = 'idle'; e.stateT = 0; }
        }
      } else if (e.kind === 'spider') {
        // Hangs on a thread, drops when you pass underneath, then climbs back up.
        const reel = (dy2: number, speed: number) => { e.y += clamp(dy2, -speed * dt, speed * dt); };
        if (e.state === 'idle') { if (Math.abs(dx) < 26 && b.y > e.y && b.y - e.y < 170) { e.state = 'lunge'; e.stateT = 0; this.events.push('drop'); } }
        else if (e.state === 'lunge') {
          const floorBelow = isSolid(this.tile(Math.floor(e.x / TILE), Math.floor((e.y + 2) / TILE)));
          if (floorBelow || e.y - e.hy > 160 || e.stateT > 0.9) { e.state = 'awake'; e.stateT = 0; }
          else e.y += 280 * dt;
        } else if (e.state === 'awake') { if (e.stateT > 0.7) { e.state = 'rest'; e.stateT = 0; } }
        else { reel(e.hy - e.y, 70); if (Math.abs(e.y - e.hy) < 1) { e.state = 'idle'; e.stateT = 0; } }
        e.face = dx > 0 ? 1 : -1;
      } else {
        const f = FOES[e.kind];
        let speed = e.kind === 'beetle' ? 38 : e.kind === 'bone' ? 22 : e.kind === 'rat' ? 34 : e.kind === 'ink' ? 28 : e.kind === 'mouse' ? 30 : 20;
        if (e.kind === 'mouse') {
          // Trundles about, then its key spins, and it zooms off, bouncing back off walls and ledges.
          if (e.state === 'wind') { speed = 0; if (e.stateT > 0.5) { e.state = 'lunge'; e.stateT = 0; this.events.push('zip'); } }
          else if (e.state === 'lunge') { speed = 260; if (e.stateT > 0.8) { e.state = 'rest'; e.stateT = 0; } }
          else if (e.state === 'rest') { speed = 0; if (e.stateT > 0.9) { e.state = 'idle'; e.stateT = 0; } }
          else if (e.stateT > 1.4 && Math.abs(dx) < 160 && Math.abs(dy) < 40 && e.ground) { e.state = 'wind'; e.stateT = 0; e.face = dx > 0 ? 1 : -1; }
        }
        if (e.kind === 'toad') {
          // Sits, then springs at you in a high arc: higher still when you're close.
          speed = 0;
          if (e.state === 'lunge' && e.ground && e.stateT > 0.1) { e.state = 'rest'; e.stateT = 0; this.events.push('squish'); }
          else if (e.state !== 'lunge' && e.ground && e.stateT > 1.3 && Math.abs(dx) < 220 && Math.abs(dy) < 90) {
            const close = Math.abs(dx) < 90;
            e.face = dx > 0 ? 1 : -1; e.state = 'lunge'; e.stateT = 0;
            e.vy = close ? -520 : -420; e.vx = e.face * (close ? 90 : 130); e.ground = false;
            this.events.push('boing');
          }
        }
        if (e.kind === 'ink') {
          // Oozes along, gathers itself up, and springs at you.
          if (e.state === 'wind') { speed = 0; if (e.stateT > 0.35) { e.state = 'lunge'; e.stateT = 0; e.vy = -340; e.vx = e.face * 140; e.ground = false; this.events.push('squish'); } }
          else if (e.state === 'lunge') { speed = 140; if (e.ground && e.stateT > 0.1) { e.state = 'rest'; e.stateT = 0; } }
          else if (e.state === 'rest') { speed = 0; if (e.stateT > 0.7) { e.state = 'idle'; e.stateT = 0; } }
          else if (e.stateT > 1.2 && Math.abs(dx) < 80 && Math.abs(dy) < 40 && e.ground) { e.state = 'wind'; e.stateT = 0; e.face = dx > 0 ? 1 : -1; }
        }
        if (e.kind === 'rat') {
          // Scurries about, then spots you, bristles and charges.
          if (e.state === 'wind') { speed = 0; if (e.stateT > 0.35) { e.state = 'lunge'; e.stateT = 0; this.events.push('squeak'); } }
          else if (e.state === 'lunge') { speed = 230; if (e.stateT > 0.55) { e.state = 'rest'; e.stateT = 0; } }
          else if (e.state === 'rest') { speed = 0; if (e.stateT > 0.6) { e.state = 'idle'; e.stateT = 0; } }
          else if (e.stateT > 1 && Math.abs(dx) < 150 && Math.abs(dy) < 40 && e.ground) { e.state = 'wind'; e.stateT = 0; e.face = dx > 0 ? 1 : -1; }
        }
        if (e.kind === 'bone') {
          if (e.state === 'throw') { speed = 0; if (e.stateT > 0.5) { e.state = 'idle'; e.stateT = 0; } }
          else if (e.stateT > 2.2 && Math.abs(dx) < 190 && Math.abs(dy) < 90) {
            e.state = 'throw'; e.stateT = 0; e.face = dx > 0 ? 1 : -1;
            this.shots.push({ kind: 'bone', x: e.x, y: e.y - 14, vx: clamp(dx * 1.1, -170, 170), vy: -300, grav: 700, r: 5, dmg: 9, hero: false, life: 3, spin: 0 });
            this.events.push('throw');
          }
        }
        if (e.kind === 'armadillo') {
          speed = 0;
          if (e.state === 'idle' || e.state === 'awake') {
            if (Math.abs(dx) < 170 && Math.abs(dy) < 60) { e.face = dx > 0 ? 1 : -1; speed = 20; e.state = 'awake'; }
            if (e.state === 'awake' && Math.abs(dx) < 90 && e.stateT > 2.2) { e.state = 'wind'; e.stateT = 0; }
          } else if (e.state === 'wind') { if (e.stateT > 0.4) { e.state = 'lunge'; e.stateT = 0; this.events.push('lunge'); } }
          else if (e.state === 'lunge') { speed = 220; if (e.stateT > 0.35) { e.state = 'rest'; e.stateT = 0; } }
          else if (e.state === 'rest' && e.stateT > 0.8) { e.state = 'awake'; e.stateT = 0; }
        }
        if (e.ground) {
          // Walkers turn at walls and ledges.
          const ahead = e.x + e.face * (f.w / 2 + 2);
          const wall = isSolid(this.tile(Math.floor(ahead / TILE), Math.floor((e.y - 4) / TILE)));
          const floor = this.supported(ahead, e.y, 2);
          if ((wall || !floor) && e.kind !== 'armadillo' && !(e.kind === 'rat' && e.state === 'lunge')) e.face = -e.face as 1 | -1;
          if ((wall || !floor) && (e.kind === 'armadillo' || (e.kind === 'rat' && e.state === 'lunge'))) { speed = 0; if (e.kind === 'rat') { e.state = 'rest'; e.stateT = 0; } }
          e.vx = e.face * speed;
        }
        e.vy = Math.min(e.vy + G * dt, MAX_FALL);
        const hit = this.move(e, f.w, f.h, dt, true);
        e.ground = hit.down || (e.vy === 0 && this.supported(e.x, e.y, f.w));
        const rr = roomRect(this.room);
        if (e.y > rr.y + rr.h + 40) e.dead = 1;
      }
      if (!foeHidden(e) && overlap(me, this.foeBox(e))) this.hurtHero(FOES[e.kind].atk, e.x);
    }
    this.enemies = this.enemies.filter((e) => !e.dead || e.dead < BURN_T);
  }

  // ─── Bosses ─────────────────────────────────────────────────────────────
  /** Whether the boss can be hit (and hurts on contact): not while arriving, dying, or vanished into mist. */
  bossOpen(o: Boss) {
    if (o.move === 'enter' || o.move === 'dying') return false;
    if (o.kind === 'fox') return !(o.move === 'vanish' && o.t > 0.2) && !(o.move === 'appear' && o.t < 0.15);
    return true;
  }
  bossBox(o: Boss): Box { const k = BOSSES[o.kind]; return { x: o.x - k.w / 2, y: o.y - k.h / 2, w: k.w, h: k.h }; }
  private bossStep(dt: number) {
    const room = this.room, kind = room.boss;
    if (!kind || this.flags.has(`boss:${kind}`)) return;
    const rr = roomRect(room), b = this.body;
    if (!this.fight) {
      if (b.x > rr.x + 3 * TILE && b.x < rr.x + rr.w - 3 * TILE) {
        this.fight = true;
        this.events.push('gate');
        if (!this.flags.has(`script:${kind}`)) { this.flags.add(`script:${kind}`); this.talk(kind); }
        const k = BOSSES[kind], hp = Math.round(k.hp * DIFFICULTY[this.difficulty].foeHp);
        this.boss = { kind, x: rr.x + rr.w / 2, y: rr.y - 30, vx: 0, vy: 0, hp, max: hp, move: 'enter', t: 0, face: -1, flash: 0, phase2: false, summoned: false, sx: 0, ex: 0, side: 1, last: [], hitId: -1 };
      }
      return;
    }
    const o = this.boss;
    if (!o) return;
    o.t += dt; o.flash = Math.max(0, o.flash - dt);
    if (o.kind === 'owl') this.owlStep(o, dt, rr); else if (o.kind === 'rat') this.ratStep(o, dt, rr); else if (o.kind === 'fox') this.foxStep(o, dt, rr); else this.catStep(o, dt, rr);
    if (o.move === 'dying') {
      if (Math.floor(o.t * 10) !== Math.floor((o.t - dt) * 10)) this.fx.push({ kind: 'boom', x: o.x + (this.rand() - 0.5) * 40, y: o.y + (this.rand() - 0.5) * 30, t: 0, vx: 0, vy: 0 });
      if (o.t > 2) this.bossDown();
      return;
    }
    const k = BOSSES[o.kind];
    if (!o.phase2 && o.hp <= o.max / 2) {
      o.phase2 = true;
      if (!o.summoned) {
        o.summoned = true;
        const left = rr.x + 40, right = rr.x + rr.w - 40;
        for (const x of [left, right]) {
          const walker = o.kind === 'rat' || o.kind === 'cat';
          const e = walker ? this.spawn(o.kind === 'rat' ? 'rat' : 'mouse', x, rr.y + 12 * TILE) : this.spawn('bat', x, rr.y + 60);
          e.state = walker ? 'idle' : 'awake'; e.face = x < o.x ? 1 : -1;
        }
      }
      this.say({ owl: 'Duke Hootsworth ruffles up in a fury!', rat: 'Gnawdrick gnashes his teeth and calls his rats!', fox: 'Count Culpeo’s eyes blaze. His bats pour from the shadows!', cat: 'Tick-Tock winds herself tighter and lets loose her mice!' }[o.kind]);
      this.events.push('screech');
    }
    if (this.bossOpen(o)) {
      const me = { x: b.x - HERO_W / 2, y: b.y - HERO_H, w: HERO_W, h: HERO_H };
      if (overlap(me, { x: o.x - k.w / 2 + 4, y: o.y - k.h / 2 + 4, w: k.w - 8, h: k.h - 8 })) this.hurtHero(k.atk, o.x);
    }
  }
  private pickMove(o: Boss, options: string[]) {
    let pick = options[Math.floor(this.rand() * options.length)];
    if (o.last.length >= 2 && o.last.every((m) => m === pick)) pick = options.find((m) => m !== pick)!;
    o.last = [...o.last.slice(-1), pick];
    return pick;
  }
  private owlStep(o: Boss, dt: number, rr: Box) {
    const b = this.body;
    const floor = rr.y + 12 * TILE, left = rr.x + 40, right = rr.x + rr.w - 40, top = rr.y + 60;
    const go = (move: OwlMove) => { o.move = move; o.t = 0; };
    const toward = (tx: number, ty: number, k: number) => { o.x += (tx - o.x) * Math.min(1, k * dt); o.y += (ty - o.y) * Math.min(1, k * dt); };
    if (o.move !== 'dying' && o.move !== 'swoop') o.face = b.x > o.x ? 1 : -1;
    const hard = this.difficulty === 'hard', fierce = o.phase2 || hard;
    const speed = (o.phase2 ? 1.3 : 1) * (hard ? 1.1 : 1);
    switch (o.move as OwlMove) {
      case 'enter':
        toward(rr.x + rr.w / 2, top + 10, 3);
        if (o.t > 1.3) { go('hover'); this.events.push('hoot'); }
        break;
      case 'hover': {
        const hx = o.side > 0 ? right - 50 : left + 50;
        toward(hx, top + Math.sin(this.time * 3) * 8, 3);
        if (o.t > 0.8 / speed) {
          const pick = this.pickMove(o, fierce ? ['feathers', 'swoop', 'dive'] : ['feathers', 'swoop']);
          if (pick === 'feathers') go('feathers');
          else if (pick === 'swoop') { o.sx = o.side > 0 ? right : left; o.ex = o.side > 0 ? left : right; go('rise'); }
          else go('track');
        }
        break;
      }
      case 'feathers':
        toward(o.x, top, 2);
        if (o.t > 0.5 / speed && o.t - dt <= 0.5 / speed) {
          const n = (o.phase2 ? 5 : 3) + (hard ? 2 : 0), aim = Math.atan2(b.y - 12 - o.y, b.x - o.x);
          for (let i = 0; i < n; i++) {
            const a = aim + (i - (n - 1) / 2) * 0.22;
            this.shots.push({ kind: 'feather', x: o.x, y: o.y, vx: Math.cos(a) * 170, vy: Math.sin(a) * 170, grav: 0, r: 5, dmg: 9, hero: false, life: 3, spin: a });
          }
          this.events.push('feathers');
        }
        if (o.t > 1.0 / speed) { o.side = -o.side; go('hover'); }
        break;
      case 'rise':
        toward(o.sx, top, 5);
        if (o.t > 0.6) { go('swoop'); this.events.push('screech'); }
        break;
      case 'swoop': {
        const dur = o.phase2 ? 1.1 : 1.4, u = Math.min(1, o.t / dur);
        o.face = o.ex > o.sx ? 1 : -1;
        o.x = o.sx + (o.ex - o.sx) * u;
        o.y = top + (floor - 10 - OWL.h / 2 - top) * Math.sin(Math.PI * u);
        if (u >= 1) { o.side = o.ex > rr.x + rr.w / 2 ? 1 : -1; go('hover'); }
        break;
      }
      case 'track':
        toward(clamp(b.x, left, right), rr.y + 44, 4);
        if (o.t > 0.7) go('drop');
        break;
      case 'drop':
        o.y += 520 * dt;
        if (o.y >= floor - OWL.h / 2) {
          o.y = floor - OWL.h / 2;
          this.waves(o.x, floor, 14, 11);
          go('rest');
        }
        break;
      case 'rest':
        if (o.t > 0.7) go('hover');
        break;
      case 'dying':
        if (Math.floor(o.t * 6) !== Math.floor((o.t - dt) * 6)) this.fx.push({ kind: 'feather', x: o.x, y: o.y, t: 0, vx: (this.rand() - 0.5) * 160, vy: -120 * this.rand() });
        o.y += 20 * dt;
        break;
    }
  }
  /**
   * Count Culpeo floats just off the floor. He throws fans of fireballs, bursts into bats and reappears behind the
   * lead to sweep his cape along the floor, and swoops across the room. At half HP he calls his bats, throws twice as
   * often and raises pillars of fire where the heroes stand. He can only be hit while he's solid.
   */
  private foxStep(o: Boss, dt: number, rr: Box) {
    const b = this.body, k = BOSSES.fox;
    const floor = rr.y + 12 * TILE, ground = floor - k.h / 2, left = rr.x + 3 * TILE, right = rr.x + rr.w - 3 * TILE, top = rr.y + 70;
    const go = (move: FoxMove) => { o.move = move; o.t = 0; };
    const toward = (tx: number, ty: number, r: number) => { o.x += (tx - o.x) * Math.min(1, r * dt); o.y += (ty - o.y) * Math.min(1, r * dt); };
    const hard = this.difficulty === 'hard', fierce = o.phase2 || hard, fast = (o.phase2 ? 1.25 : 1) * (hard ? 1.1 : 1);
    const bats = (n: number) => { for (let i = 0; i < n; i++) this.fx.push({ kind: 'poof', x: o.x + (this.rand() - 0.5) * 30, y: o.y + (this.rand() - 0.5) * 36, t: -this.rand() * 0.2, vx: 0, vy: 0 }); };
    if (o.move !== 'lunge' && o.move !== 'swoop' && o.move !== 'dying') o.face = b.x > o.x ? 1 : -1;
    switch (o.move as FoxMove) {
      case 'enter':
        // He gathers out of a swirl of bats in the middle of the room.
        if (o.t <= dt * 1.5) { o.x = rr.x + rr.w / 2; o.y = ground - 6; }
        if (o.t < 1 && Math.floor(o.t * 12) !== Math.floor((o.t - dt) * 12)) bats(1);
        if (o.t > 1.4) { go('float'); this.events.push('laugh'); }
        break;
      case 'float': {
        // Drifts to a wary distance from the lead, just off the floor.
        const want = clamp(b.x - Math.sign(b.x - o.x || 1) * 90, left, right);
        toward(want, ground - 6 + Math.sin(this.time * 2.5) * 4, 1.5);
        if (o.t > 0.7 / fast) {
          const pick = this.pickMove(o, fierce ? ['fire', 'vanish', 'swoop', 'pillars'] : ['fire', 'vanish', 'swoop']) as FoxMove;
          if (pick === 'swoop') { o.sx = o.x < rr.x + rr.w / 2 ? left : right; o.ex = o.sx === left ? right : left; }
          go(pick);
        }
        break;
      }
      case 'fire': {
        toward(o.x, ground - 14, 3);
        const volley = (at: number) => {
          if (o.t < at || o.t - dt >= at) return;
          const n = fierce ? 5 : 3, aim = Math.atan2(b.y - 12 - (o.y - 8), b.x - o.x);
          for (let i = 0; i < n; i++) {
            const a = aim + (i - (n - 1) / 2) * 0.2;
            this.shots.push({ kind: 'fire', x: o.x + o.face * 10, y: o.y - 8, vx: Math.cos(a) * 185, vy: Math.sin(a) * 185, grav: 0, r: 5, dmg: 18, hero: false, life: 3, spin: 0 });
          }
          this.events.push('fire');
        };
        volley(0.45 / fast);
        if (fierce) volley(0.95 / fast);
        if (o.t > (fierce ? 1.3 : 0.9) / fast) go('float');
        break;
      }
      case 'vanish':
        // He bursts into bats…
        if (o.t >= 0.2 && o.t - dt < 0.2) { bats(8); this.events.push('flap'); }
        if (o.t > 0.7 / fast) { o.x = clamp(b.x - b.face * 60, left, right); o.y = ground; o.face = b.x > o.x ? 1 : -1; bats(6); go('appear'); }
        break;
      case 'appear':
        // …and gathers again behind the lead.
        if (o.t > 0.35) go('lunge');
        break;
      case 'lunge':
        // A sweep of the cape along the floor.
        if (o.t > 0.3) {
          o.x = clamp(o.x + o.face * 330 * fast * dt, left, right);
          if (Math.floor(o.t * 20) !== Math.floor((o.t - dt) * 20)) this.fx.push({ kind: 'dust', x: o.x - o.face * 14, y: floor - 2, t: 0, vx: -o.face * 40, vy: -20 });
        }
        if (o.t > 0.8) go('float');
        break;
      case 'swoop': {
        if (o.t < 0.4) { toward(o.sx, top, 6); break; }
        const u = Math.min(1, (o.t - 0.4) / (1.3 / fast));
        o.face = o.ex > o.sx ? 1 : -1;
        o.x = o.sx + (o.ex - o.sx) * u;
        o.y = top + (ground - top) * Math.sin(Math.PI * u);
        if (u >= 1) go('float');
        break;
      }
      case 'pillars': {
        // He raises a paw; the floor glows under the heroes and either side, then fire roars up.
        toward(o.x, top + 20, 2);
        if (o.t <= dt * 1.5) o.sx = b.x;
        const spots = [-64, 0, 64].map((d) => clamp(o.sx + d, left, right));
        if (o.t < 0.7 && Math.floor(o.t * 16) !== Math.floor((o.t - dt) * 16)) for (const x of spots) this.fx.push({ kind: 'ember', x: x + (this.rand() - 0.5) * 12, y: floor - 2, t: 0, vx: 0, vy: -40 });
        if (o.t >= 0.7 && o.t - dt < 0.7) {
          for (const x of spots) for (const d of [-6, 6]) this.shots.push({ kind: 'flame', x: x + d, y: floor - 6, vx: 0, vy: 0, grav: 0, r: 6, dmg: 16, hero: false, life: 1.1, spin: 0 });
          this.events.push('burst');
        }
        if (o.t > 1.6) go('float');
        break;
      }
      case 'dying':
        o.y -= 12 * dt;
        if (Math.floor(o.t * 8) !== Math.floor((o.t - dt) * 8)) bats(2);
        break;
    }
  }
  /**
   * Tick-Tock the Clockwork Cat prowls the floor. She pounces with a shockwave landing, bowls cogs that bounce off the
   * walls, and runs up a wall to cling there and dive at the heroes, which leaves her dizzy. At half HP she lets two
   * clockwork mice loose and rings her bell: a low chime to jump, then a high one to stay down for.
   */
  private catStep(o: Boss, dt: number, rr: Box) {
    const b = this.body, k = BOSSES.cat;
    const floor = rr.y + 12 * TILE, ground = floor - k.h / 2, left = rr.x + 2 * TILE + k.w / 2, right = rr.x + rr.w - 2 * TILE - k.w / 2;
    const go = (move: CatMove) => { o.move = move; o.t = 0; };
    const hard = this.difficulty === 'hard', fierce = o.phase2 || hard, fast = (o.phase2 ? 1.25 : 1) * (hard ? 1.1 : 1);
    const land = () => { o.vy = Math.min(o.vy + G * dt, 700); o.y += o.vy * dt; if (o.y >= ground) { o.y = ground; o.vy = 0; return true; } return false; };
    const toward = () => { o.face = b.x > o.x ? 1 : -1; };
    switch (o.move as CatMove) {
      case 'enter':
        if (o.t < 0.6) o.y = rr.y - 30;
        else if (land()) { this.shake = 0.4; this.events.push('quake'); go('prowl'); this.events.push('meow'); }
        break;
      case 'prowl':
        toward();
        if (Math.abs(b.x - o.x) > 70) o.x = clamp(o.x + o.face * 70 * fast * dt, left, right);
        if (o.t > 0.65 / fast) {
          const pick = this.pickMove(o, fierce ? ['pounce', 'cogs', 'dash', 'chime'] : ['pounce', 'cogs', 'dash']);
          go(pick === 'pounce' ? 'crouch' : pick as CatMove);
          if (pick === 'dash') o.face = o.x < rr.x + rr.w / 2 ? -1 : 1;
        }
        break;
      case 'crouch':
        toward();
        if (o.t > 0.4 / fast) { o.vx = (clamp(b.x, left, right) - o.x) / 0.7; o.vy = -520; go('pounce'); this.events.push('jump'); }
        break;
      case 'pounce':
        o.x = clamp(o.x + o.vx * dt, left, right);
        if (land() && o.t > 0.1) { this.waves(o.x, floor, 20, 14); go('prowl'); }
        break;
      case 'cogs':
        toward();
        if (o.t > 0.4 && o.t - dt <= 0.4) {
          this.shots.push({ kind: 'cog', x: o.x + o.face * 22, y: floor - 8, vx: o.face * 170, vy: 0, grav: 0, r: 7, dmg: 14, hero: false, life: 4.5, spin: 0 });
          if (fierce) this.shots.push({ kind: 'cog', x: o.x + o.face * 16, y: o.y - 16, vx: o.face * 120, vy: -380, grav: 900, r: 7, dmg: 14, hero: false, life: 4.5, spin: 0 });
          this.events.push('throw');
        }
        if (o.t > 0.9) go('prowl');
        break;
      case 'dash': {
        // She sprints for the nearer wall…
        const wall = o.face > 0 ? right : left;
        o.x += o.face * 280 * fast * dt;
        if (Math.floor(o.t * 20) !== Math.floor((o.t - dt) * 20)) this.fx.push({ kind: 'dust', x: o.x - o.face * 16, y: floor - 2, t: 0, vx: -o.face * 40, vy: -20 });
        if ((o.x - wall) * o.face >= 0) { o.x = wall; go('climb'); this.events.push('cling'); }
        break;
      }
      case 'climb':
        // …runs straight up it…
        o.y -= 240 * fast * dt;
        if (o.y <= rr.y + 5 * TILE) { o.y = rr.y + 5 * TILE; go('cling'); }
        break;
      case 'cling':
        // …clings there with her eyes on the heroes, then dives.
        if (o.t > 0.5 / fast) {
          const tx = clamp(b.x, left, right), d = Math.hypot(tx - o.x, ground - o.y) || 1;
          o.vx = ((tx - o.x) / d) * 420 * fast; o.vy = ((ground - o.y) / d) * 420 * fast;
          o.face = o.vx > 0 ? 1 : -1; go('dive'); this.events.push('screech');
        }
        break;
      case 'dive':
        o.x = clamp(o.x + o.vx * dt, left, right); o.y += o.vy * dt;
        if (o.y >= ground) { o.y = ground; this.shake = 0.4; this.events.push('quake'); go('dizzy'); }
        break;
      case 'dizzy':
        if (o.t > 0.9) go('prowl');
        break;
      case 'chime':
        // She rings the bell on her collar: a low ring to jump, then a high one to stay down under.
        if ((o.t > 0.4 && o.t - dt <= 0.4) || (o.t > 0.9 && o.t - dt <= 0.9)) {
          const y = o.t < 0.6 ? floor - 7 : floor - 40;
          for (const d of [-1, 1]) this.shots.push({ kind: 'chime', x: o.x + d * 14, y, vx: d * 190, vy: 0, grav: 0, r: 8, dmg: 15, hero: false, life: 2.5, spin: 0 });
          this.events.push('chime');
        }
        if (o.t > 1.4) go('prowl');
        break;
      case 'dying':
        o.y = ground + Math.sin(o.t * 40) * 1;
        if (Math.floor(o.t * 8) !== Math.floor((o.t - dt) * 8)) this.fx.push({ kind: 'rubble', x: o.x, y: o.y - 8, t: 0, vx: (this.rand() - 0.5) * 140, vy: -100 - this.rand() * 80 });
        break;
    }
  }
  /** Two shockwaves running out along the floor from x. */
  private waves(x: number, floor: number, gap: number, dmg: number) {
    for (const d of [-1, 1]) this.shots.push({ kind: 'wave', x: x + d * gap, y: floor - 6, vx: d * 190, vy: 0, grav: 0, r: 7, dmg, hero: false, life: 2.2, spin: 0 });
    this.shake = 0.35; this.events.push('quake');
  }
  /**
   * Gnawdrick the Rat King fights on the floor: he charges wall to wall and stuns himself (loosening rocks from the
   * ceiling), leaps at you and lands with shockwaves, and bowls wheels of cheese. At half HP he calls two rats.
   */
  private ratStep(o: Boss, dt: number, rr: Box) {
    const b = this.body, k = RAT;
    const floor = rr.y + 12 * TILE, left = rr.x + 2 * TILE + k.w / 2, right = rr.x + rr.w - 2 * TILE - k.w / 2, ground = floor - k.h / 2;
    const go = (move: RatMove) => { o.move = move; o.t = 0; };
    const hard = this.difficulty === 'hard', fierce = o.phase2 || hard;
    const fast = (o.phase2 ? 1.25 : 1) * (hard ? 1.1 : 1);
    const land = () => { o.vy = Math.min(o.vy + G * dt, 700); o.y += o.vy * dt; if (o.y >= ground) { o.y = ground; o.vy = 0; return true; } return false; };
    switch (o.move as RatMove) {
      case 'enter':
        if (o.t < 0.6) o.y = rr.y - 30;
        else if (land()) { this.shake = 0.4; this.events.push('quake'); go('idle'); this.events.push('roar'); }
        break;
      case 'idle':
        o.face = b.x > o.x ? 1 : -1;
        if (o.t > 0.75 / fast) {
          const pick = this.pickMove(o, ['charge', 'leap', 'cheese']);
          go(pick === 'charge' ? 'wind' : pick === 'leap' ? 'crouch' : 'cheese');
        }
        break;
      case 'wind':
        o.face = b.x > o.x ? 1 : -1;
        if (o.t > 0.6 / fast) { go('charge'); this.events.push('roar'); }
        break;
      case 'charge': {
        o.x += o.face * 300 * fast * dt;
        if (Math.floor(o.t * 20) !== Math.floor((o.t - dt) * 20)) this.fx.push({ kind: 'dust', x: o.x - o.face * 18, y: floor - 2, t: 0, vx: -o.face * 40, vy: -20 });
        const wall = o.face > 0 ? right : left;
        if ((o.x - wall) * o.face >= 0) {
          o.x = wall; go('stunned');
          this.shake = 0.5; this.events.push('quake');
          // The crash shakes rocks loose from the ceiling.
          const n = fierce ? 6 : 4;
          for (let i = 0; i < n; i++) {
            const x = rr.x + 3 * TILE + this.rand() * (rr.w - 6 * TILE);
            this.shots.push({ kind: 'rock', x, y: rr.y + 3 * TILE + 4, vx: 0, vy: 0, grav: 500 + this.rand() * 300, r: 5, dmg: 12, hero: false, life: 3, spin: this.rand() * 6 });
          }
        }
        break;
      }
      case 'stunned':
        if (o.t > 1.3) go('idle');
        break;
      case 'crouch':
        o.face = b.x > o.x ? 1 : -1;
        if (o.t > 0.35) {
          const target = clamp(b.x, left, right);
          o.vx = (target - o.x) / 0.72; o.vy = -500; go('leap');
          this.events.push('jump');
        }
        break;
      case 'leap':
        o.x = clamp(o.x + o.vx * dt, left, right);
        if (land() && o.t > 0.1) { this.waves(o.x, floor, 20, 13); go('idle'); }
        break;
      case 'cheese':
        o.face = b.x > o.x ? 1 : -1;
        if (o.t > 0.45 && o.t - dt <= 0.45) {
          this.shots.push({ kind: 'cheese', x: o.x + o.face * 26, y: floor - 8, vx: o.face * 150, vy: 0, grav: 0, r: 8, dmg: 12, hero: false, life: 4.5, spin: 0 });
          if (fierce) this.shots.push({ kind: 'cheese', x: o.x + o.face * 20, y: o.y - 20, vx: o.face * 110, vy: -380, grav: 900, r: 8, dmg: 12, hero: false, life: 4.5, spin: 0 });
          this.events.push('throw');
        }
        if (o.t > 0.9) go('idle');
        break;
      case 'dying':
        o.y = ground + Math.sin(o.t * 40) * 1;
        break;
    }
  }
  hitBoss(raw: number, lck: number) {
    const o = this.boss!, k = BOSSES[o.kind];
    const crit = this.rand() * 100 < lck;
    // A stunned Rat King and a dizzy Tick-Tock take extra.
    const open = (o.kind === 'rat' && o.move === 'stunned') || (o.kind === 'cat' && o.move === 'dizzy') ? 1.25 : 1;
    const dmg = Math.max(1, Math.round(raw * open * (crit ? 1.5 : 1) - k.def));
    o.hp = Math.max(0, o.hp - dmg); o.flash = 0.12;
    this.pops.push({ x: o.x, y: o.y - k.h / 2 - 6, text: String(dmg), t: 0, color: crit || this.heavy ? '#ffd35a' : '#ffffff', big: this.heavy });
    this.fx.push({ kind: 'spark', x: o.x, y: o.y, t: 0, vx: Math.sign(o.x - this.body.x) || 1, vy: 0 });
    this.events.push(crit ? 'crit' : 'hit');
    if (o.hp <= 0) { o.move = 'dying'; o.t = 0; this.shots = this.shots.filter((s) => s.hero); this.events.push('bossdie'); this.enemies.forEach((e) => (e.dead = e.dead || 1e-3)); }
  }
  private bossDown() {
    const o = this.boss!;
    this.flags.add(`boss:${o.kind}`);
    this.fight = false;
    this.boss = null;
    this.kills[BOSS_KILLS[o.kind]] = (this.kills[BOSS_KILLS[o.kind]] ?? 0) + 1;
    this.gainXp(BOSSES[o.kind].xp);
    this.pickups.push({ kind: 'leaf', id: 'leaf', amount: 1, x: o.x, y: o.y, vy: -120, t: 0, flag: `leaf:${o.kind}`, fixed: false });
    for (let i = 0; i < 24; i++) this.fx.push({ kind: 'ash', x: o.x + (this.rand() - 0.5) * 40, y: o.y + (this.rand() - 0.5) * 30, t: -this.rand() * 0.3, vx: (this.rand() - 0.5) * 60, vy: -20 - this.rand() * 40, color: { owl: '#c8b088', rat: '#d8c070', fox: '#3a1020', cat: '#c8a050' }[o.kind] });
    this.events.push('victory');
    // A beaten boss is saved at once, so falling later never brings them back.
    this.saved = this.snapshot();
    this.talk(`${o.kind}Down`, `chapter${BOSS_CHAPTER[o.kind]}`);
  }

  private shotStep(dt: number) {
    const b = this.body, me = { x: b.x - HERO_W / 2, y: b.y - HERO_H, w: HERO_W, h: HERO_H };
    const bursts: [number, number][] = [];
    for (const s of this.shots) {
      s.life -= dt; s.vy += s.grav * dt; s.vx += (s.ax ?? 0) * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.spin += dt * 12;
      if (s.t !== undefined) s.t += dt;
      // Petals whirl round the lead; the boulder is Enzo himself, rolling.
      if (s.kind === 'petal') { const a = s.phase! + s.t! * 4.2; s.x = b.x + Math.cos(a) * 26; s.y = b.y - 12 + Math.sin(a) * 18; }
      if (s.kind === 'boulder') { s.x = b.x; s.y = b.y - 9; if (b.rollT <= 0 || this.leader !== 'enzo') s.life = 0; }
      const box = { x: s.x - s.r, y: s.y - s.r, w: s.r * 2, h: s.r * 2 };
      if (s.kind === 'quake' && Math.floor((s.t! - dt) / 0.05) !== Math.floor(s.t! / 0.05)) {
        // The shockwave kicks up shards of stone and dust behind it.
        this.fx.push({ kind: 'shard', x: s.x - Math.sign(s.vx) * 4, y: s.y + 6, t: 0, vx: -s.vx * 0.1 + (this.rand() - 0.5) * 40, vy: -120 - this.rand() * (s.spell ? 120 : 60) });
        this.fx.push({ kind: 'dust', x: s.x - Math.sign(s.vx) * 8, y: s.y + 5, t: 0, vx: -s.vx * 0.15, vy: -10 });
      }
      if (s.kind === 'wave' || s.kind === 'quake') {
        if (isSolid(this.tile(Math.floor((s.x + Math.sign(s.vx) * 6) / TILE), Math.floor((s.y - 2) / TILE)))) s.life = 0;
      } else if (s.kind === 'cheese') {
        // Cheese wheels roll along the floor and bounce back off walls; lobbed ones bounce along.
        if (isSolid(this.tile(Math.floor((s.x + Math.sign(s.vx) * (s.r + 1)) / TILE), Math.floor(s.y / TILE)))) { s.vx = -s.vx; s.x += s.vx * dt * 2; }
        if (s.vy > 0 && this.solidAt(s.x, s.y + s.r)) { s.y = Math.floor((s.y + s.r) / TILE) * TILE - s.r; s.vy = s.grav ? -Math.max(200, s.vy * 0.75) : 0; }
      } else if (s.kind === 'cog') {
        // Cogs roll along the floor and bounce back off walls; a thrown one drops to the floor and rolls from there.
        if (isSolid(this.tile(Math.floor((s.x + Math.sign(s.vx) * (s.r + 1)) / TILE), Math.floor(s.y / TILE)))) { s.vx = -s.vx; s.x += s.vx * dt * 2; }
        if (s.vy > 0 && this.solidAt(s.x, s.y + s.r)) {
          s.y = Math.floor((s.y + s.r) / TILE) * TILE - s.r;
          s.vy = !s.hero && s.grav ? -Math.max(200, s.vy * 0.75) : 0;
          if (s.hero) s.vx = Math.sign(s.vx || 1) * 230;
        }
      } else if (s.kind === 'petal' || s.kind === 'boulder' || s.kind === 'chime') {
        // These pass through walls: petals orbit, the boulder is Enzo, and a chime is sound.
      } else if (s.kind === 'acorn') {
        // Back in the lead's paws once it has turned around.
        if (Math.sign(s.vx) === Math.sign(s.ax ?? 0) && Math.abs(s.x - b.x) < 10 && Math.abs(s.y - b.y + 12) < 20) s.life = 0;
        if (this.solidAt(s.x, s.y)) { this.breakWalls(box); s.life = 0; this.fx.push({ kind: 'spark', x: s.x, y: s.y, t: 0.2, vx: 0, vy: 0 }); }
      } else if (s.kind !== 'flame' && this.solidAt(s.x, s.y)) {
        if (s.kind === 'rock') for (let i = 0; i < 3; i++) this.fx.push({ kind: 'rubble', x: s.x, y: s.y - 2, t: 0.3, vx: (this.rand() - 0.5) * 100, vy: -60 - this.rand() * 80 });
        if (s.hero) this.breakWalls(box);
        if (s.kind === 'pumpkin') bursts.push([s.x, s.y - 4]);
        s.life = 0;
        this.fx.push({ kind: 'spark', x: s.x, y: s.y, t: 0.2, vx: 0, vy: 0 });
      }
      if (s.life <= 0) continue;
      if (s.hero) {
        // Piercing shots hit each foe once, or again every `rehit` seconds.
        const strike = (id: number) => {
          if (!s.pierce) { s.life = 0; return true; }
          const next = s.hits!.get(id);
          if (next !== undefined && s.t! < next) return false;
          s.hits!.set(id, s.rehit ? s.t! + s.rehit : Infinity);
          return true;
        };
        for (const e of this.enemies) {
          if (e.dead || foeHidden(e) || !overlap(box, this.foeBox(e))) continue;
          if (s.kind === 'pumpkin') { bursts.push([s.x, s.y]); s.life = 0; break; }
          if (!strike(e.id)) continue;
          // Gusts of dust are stopped by shields like a swing is; everything else gets past.
          this.heavy = !!(s.heavy || s.spell);
          const hurt = this.hitFoe(e, s.dmg, s.x - s.vx, s.kind !== 'gust', 0, s.launch);
          this.heavy = false;
          if (hurt) this.gainDuo(3);
          else s.life = 0;
          if (s.life <= 0) break;
        }
        for (const c of this.candles) if (s.life > 0 && c.alive && overlap(box, { x: c.x - 4, y: c.y - 12, w: 8, h: 14 })) { this.snuff(c); if (!s.pierce) s.life = 0; }
        const o = this.boss;
        if (s.life > 0 && o && this.bossOpen(o) && overlap(box, this.bossBox(o))) {
          if (s.kind === 'pumpkin') { bursts.push([s.x, s.y]); s.life = 0; }
          else if (strike(-1)) { this.heavy = !!(s.heavy || s.spell); this.hitBoss(s.dmg, 0); this.heavy = false; this.gainDuo(2); }
        }
        const cage = this.cage;
        if (s.life > 0 && cage && cage.flash <= 0 && overlap(box, { x: cage.x - 8, y: cage.y - 18, w: 16, h: 18 })) { this.hitCage(); if (!s.pierce) s.life = 0; }
      } else if (overlap(box, me)) { this.hurtHero(s.dmg, s.x - s.vx); if (s.kind !== 'wave' && s.kind !== 'cheese' && s.kind !== 'cog' && s.kind !== 'chime') s.life = 0; }
    }
    // Petal Ward knocks shots out of the air (not shockwaves, flames or chimes).
    for (const p of this.shots) {
      if (p.kind !== 'petal' || p.life <= 0) continue;
      for (const s of this.shots) {
        if (s.hero || s.life <= 0 || s.kind === 'wave' || s.kind === 'flame' || s.kind === 'chime') continue;
        if (Math.hypot(s.x - p.x, s.y - p.y) < p.r + s.r) { s.life = 0; this.fx.push({ kind: 'clink', x: s.x, y: s.y, t: 0, vx: 0, vy: 0 }); this.events.push('clink'); }
      }
    }
    this.shots = this.shots.filter((s) => s.life > 0);
    for (const [x, y] of bursts) this.burst(x, y);
  }

  /** Dust motes burst out, then home in on the lead; each one caught restores a little Dust. */
  private orbStep(dt: number) {
    const b = this.body, tx = b.x, ty = b.y - 12;
    for (const o of this.orbs) {
      o.t += dt;
      if (o.t < 0.3) { o.vx *= 1 - dt * 4; o.vy += 200 * dt; }
      else {
        const dx = tx - o.x, dy = ty - o.y, d = Math.hypot(dx, dy) || 1, speed = 160 + o.t * 500;
        o.vx += (dx / d * speed - o.vx) * Math.min(1, dt * 10); o.vy += (dy / d * speed - o.vy) * Math.min(1, dt * 10);
      }
      o.x += o.vx * dt; o.y += o.vy * dt;
      if ((o.t > 0.3 && Math.hypot(tx - o.x, ty - o.y) < 10) || o.t > 2.5) {
        o.t = -1;
        this.mp = Math.min(this.maxMp, this.mp + o.mp);
        this.events.push('orb');
      }
    }
    this.orbs = this.orbs.filter((o) => o.t >= 0);
  }
  private pickupStep(dt: number) {
    const b = this.body, me = { x: b.x - 10, y: b.y - HERO_H - 4, w: 20, h: HERO_H + 8 };
    for (const p of this.pickups) {
      p.t += dt;
      if (p.pull) {
        // Nutmeg is fetching it.
        const dx = b.x - p.x, dy = b.y - 10 - p.y, d = Math.hypot(dx, dy) || 1, step = Math.min(d, 260 * dt);
        p.x += (dx / d) * step; p.y += (dy / d) * step;
      } else if (!p.fixed) {
        const o = { x: p.x, y: p.y, vx: 0, vy: p.vy };
        o.vy = Math.min(o.vy + G * 0.7 * dt, MAX_FALL);
        this.move(o, 6, 6, dt, true);
        p.x = o.x; p.y = o.y; p.vy = o.vy;
      }
      if (p.t > 0.25 && overlap(me, { x: p.x - 6, y: p.y - 12, w: 12, h: 12 })) this.collect(p);
      if (!p.fixed && !p.flag && p.t > 12) p.t = -1e9;
    }
    this.pickups = this.pickups.filter((p) => p.t > -1e8 && p.amount > 0);
  }
  private collect(p: Pickup) {
    if (p.flag) this.flags.add(p.flag);
    const amount = p.amount;
    p.amount = 0;
    const add = (id: string) => { this.bag[id] = (this.bag[id] ?? 0) + 1; };
    switch (p.kind) {
      case 'raisin': this.raisins += amount; this.events.push('raisin'); break;
      case 'seeds': this.seeds = Math.min(99, this.seeds + amount); this.events.push('seedpick'); break;
      case 'dust': this.mp = Math.min(this.maxMp, this.mp + amount); this.events.push('dust'); break;
      case 'sub':
        this.subs.add(p.id as SubId); this.sub = p.id as SubId;
        this.say(`Found the ${SUBS[p.id as SubId].name}! ↑ + attack throws it. Switch sub-weapons in the menu.`, 4); this.events.push('item');
        break;
      case 'food': add(p.id); this.say(`Found a ${FOOD[p.id].name}!`); this.events.push('item'); break;
      case 'gear': add(p.id); this.say(`Found the ${GEAR[p.id].name}! Equip it from the menu.`); this.events.push('item'); break;
      case 'leaf':
        this.leaves++;
        for (const h of ['dora', 'enzo'] as HeroId[]) if (this.hp[h] > 0) this.hp[h] += LEAF_HP;
        this.say(`A Wolfberry Leaf! Max HP +${LEAF_HP} for both.`); this.events.push('leaf');
        break;
      case 'relic':
        this.relics.add(p.id as RelicId);
        this.events.push('relic');
        this.talk(p.id);
        break;
      case 'spell':
        this.events.push('relic');
        this.talk(p.id);
        break;
      case 'key':
        this.say('Found a brass pocket watch! It’s still ticking. Someone must be missing it.', 3.4); this.events.push('item');
        break;
    }
  }
  /** Shrines and signs under the leader's feet. */
  private touchStep(pressed: (k: keyof Input) => boolean) {
    const b = this.body, c = Math.floor(b.x / TILE), r = Math.floor((b.y - 1) / TILE);
    const here = rawTile(c, r);
    if (here === 'S') {
      this.flags.add(`shrine:${this.room.id}`);
      if (pressed('up') && this.shrines().length > 1) { this.warp = true; this.events.push('shop'); }
      if (!this.atShrine) {
        this.atShrine = true;
        this.slain.clear();
        this.hp.dora = this.stats('dora').maxHp; this.hp.enzo = this.stats('enzo').maxHp;
        this.saved = this.snapshot();
        this.events.push('save');
        this.say('Saved. A warm dust bath restores Dora and Enzo.', 3);
        for (let i = 0; i < 8; i++) this.fx.push({ kind: 'dust', x: b.x + (i - 4) * 4, y: b.y - 2, t: -i * 0.04, vx: (i - 4) * 10, vy: -40 });
      }
    } else if (this.atShrine && rawTile(c - 1, r) !== 'S' && rawTile(c + 1, r) !== 'S') {
      // Stepping well clear of the shrine arms it again.
      this.atShrine = false;
    }
    this.sign = -1; this.stall = false; this.npc = null;
    const near = (ch: string) => here === ch || rawTile(c - 1, r) === ch || rawTile(c + 1, r) === ch;
    for (const [ch, id] of [['P', 'pudding'], ['Y', 'mochi'], ['C', 'nutmeg']] as const) {
      if (!near(ch) || this.pals[id]) continue;
      this.npc = id;
      if (!pressed('up')) continue;
      if (id === 'pudding') { if (this.bag.cake) { this.bag.cake--; if (!this.bag.cake) delete this.bag.cake; this.join('pudding', 'puddingJoin'); } else this.talk('puddingHungry'); }
      else if (id === 'mochi') { if (this.flags.has('boss:rat')) this.join('mochi', 'mochiJoin'); else this.talk('mochiWait'); }
      else if (this.flags.has('watch')) this.join('nutmeg', 'nutmegJoin');
      else this.talk('nutmegAsk');
    }
    if (here === 'n') {
      const room = this.room, rc = c - room.mx * COLS, rr = r - room.my * ROWS;
      let n = 0;
      for (let y = 0; y < room.rows.length; y++) for (let x = 0; x < room.rows[y].length; x++) if (room.rows[y][x] === 'n') { if (x === rc && y === rr) this.sign = n; n++; }
      if (this.sign >= 0 && pressed('up')) {
        this.dialog = { lines: [{ who: 'sign', text: room.notes?.[this.sign] ?? '' }], i: 0 };
        this.events.push('talk');
      }
    } else if (here === '$' || rawTile(c - 1, r) === '$' || rawTile(c + 1, r) === '$') {
      this.stall = true;
      if (pressed('up')) { this.shop = true; this.events.push('shop'); }
    }
  }
  /** What pressing up would do where the leader stands, so the page can show a prompt. */
  get prompt(): 'READ' | 'SHOP' | 'TALK' | 'WARP' | null {
    if (this.sign >= 0) return 'READ';
    if (this.stall) return 'SHOP';
    if (this.npc) return 'TALK';
    const b = this.body;
    return rawTile(Math.floor(b.x / TILE), Math.floor((b.y - 1) / TILE)) === 'S' && this.shrines().length > 1 ? 'WARP' : null;
  }
  /** The familiar waiting to be befriended where the lead stands, if any. */
  get npcHere() { return this.npc; }
  /** Every shrine room found so far. */
  shrines() { return ROOMS.filter((r) => this.flags.has(`shrine:${r.id}`)).map((r) => r.id); }
  /** Step out at another shrine. */
  warpTo(id: string) {
    const room = ROOMS.find((r) => r.id === id);
    if (!room || !this.flags.has(`shrine:${id}`)) return false;
    const r = room.rows.findIndex((row) => row.includes('S')), c = room.rows[r].indexOf('S');
    const b = this.body;
    b.x = (room.mx * COLS + c + 0.5) * TILE; b.y = (room.my * ROWS + r + 1) * TILE; b.vx = 0; b.vy = 0; b.dashT = 0; b.attackT = 0;
    this.warp = false;
    if (room !== this.room) this.enter(room);
    this.atShrine = true;
    this.resetTrail(); this.snapCamera();
    this.palBody.x = b.x - b.face * 30; this.palBody.y = b.y - 20;
    this.events.push('warp');
    return true;
  }
  closeWarp() { this.warp = false; }
  /** Bring a befriended familiar along, or none. */
  setPal(id: PalId | null) {
    if (id && !this.pals[id]) return false;
    this.pal = id;
    const b = this.body;
    this.palBody = { x: b.x - b.face * 30, y: b.y - 20, face: b.face, cd: 1, act: 0, target: -1, t: 0 };
    return true;
  }
  setSub(id: SubId) { if (!this.subs.has(id)) return false; this.sub = id; return true; }

  // ─── Familiars and secrets ──────────────────────────────────────────────
  private palStep(dt: number) {
    const id = this.pal;
    if (!id) return;
    const p = this.palBody, b = this.body, f = this.follower, lv = this.pals[id]!.level;
    p.t += dt; p.cd = Math.max(0, p.cd - dt); p.act = Math.max(0, p.act - dt);
    const ease = (tx: number, ty: number, k: number) => { p.x += (tx - p.x) * Math.min(1, k * dt); p.y += (ty - p.y) * Math.min(1, k * dt); };
    if (id === 'zippy') {
      // Zippy rides on the lead's shoulder and glides at anything close.
      let tgt = p.target >= 0 ? this.enemies.find((e) => e.id === p.target && !e.dead && !foeHidden(e)) : undefined;
      if (!tgt && p.cd <= 0) {
        let best = 150;
        for (const e of this.enemies) { if (e.dead || foeHidden(e)) continue; const d = Math.hypot(e.x - b.x, e.y - b.y); if (d < best) { best = d; tgt = e; } }
        p.target = tgt ? tgt.id : -1;
      }
      if (!tgt || Math.hypot(b.x - p.x, b.y - p.y) > 220) { p.target = -1; ease(b.x - b.face * 10, b.y - 30 + Math.sin(p.t * 4) * 3, 6); p.face = b.face; return; }
      const tx = tgt.x, ty = tgt.y - FOES[tgt.kind].h / 2, dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
      p.face = dx > 0 ? 1 : -1;
      const step = Math.min(d, 250 * dt);
      p.x += (dx / (d || 1)) * step; p.y += (dy / (d || 1)) * step;
      if (d < 8) {
        this.hitFoe(tgt, 3 + lv * 2, p.x, true, 0);
        this.events.push('nip');
        p.cd = Math.max(0.6, 1.5 - lv * 0.08); p.target = -1; p.act = 0.25;
      }
      return;
    }
    // Pudding, Mochi and Nutmeg trot along behind the partner.
    const tx = f.x - b.face * (id === 'mochi' ? 30 : 24);
    ease(tx, f.y, 6);
    if (Math.abs(tx - p.x) > 0.5) p.face = tx > p.x ? 1 : -1;
    if (id === 'pudding' && p.cd <= 0) {
      const h = this.leader, max = this.stats(h).maxHp;
      if (this.hp[h] > 0 && this.hp[h] < max * 0.4) {
        const heal = Math.min(max - this.hp[h], 6 + lv * 3);
        this.hp[h] += heal;
        this.pops.push({ x: b.x, y: b.y - 30, text: `+${heal}`, t: 0, color: '#8cf0a0' });
        this.events.push('squeak');
        p.cd = Math.max(5, 12 - lv * 0.6); p.act = 0.6;
      }
    }
    if (id === 'nutmeg') {
      // Nutmeg scampers after loose loot within reach and brings it to the lead.
      const reach = 60 + lv * 8;
      for (const q of this.pickups) {
        if (q.pull || q.fixed || q.flag || q.t < 0.3 || (q.kind !== 'raisin' && q.kind !== 'seeds' && q.kind !== 'dust' && q.kind !== 'food')) continue;
        if (Math.hypot(q.x - b.x, q.y - b.y) < reach) { q.pull = true; p.act = 0.3; }
      }
    }
    if (id === 'mochi' && p.cd <= 0) {
      const shot = this.shots.find((s) => !s.hero && s.kind !== 'wave' && Math.hypot(s.x - b.x, s.y - (b.y - 10)) < 40);
      if (shot) {
        shot.life = 0;
        this.fx.push({ kind: 'clink', x: shot.x, y: shot.y, t: 0, vx: 0, vy: 0 });
        this.pops.push({ x: shot.x, y: shot.y - 6, text: 'BONK', t: 0, color: '#f0c890' });
        this.events.push('bonk');
        p.cd = Math.max(2, 7 - lv * 0.45); p.act = 0.4;
      }
    }
  }
  /** With the Silver Bell worn, or Mochi along, a cracked wall nearby gives itself away once per visit. */
  private secretStep(dt: number) {
    if ((this.chimeT -= dt) > 0) return;
    this.chimeT = 0.4;
    const bell = this.equipped.dora.acc === 'bell' || this.equipped.enzo.acc === 'bell';
    if (!bell && this.pal !== 'mochi') return;
    const b = this.body, bc = Math.floor(b.x / TILE), br = Math.floor((b.y - 10) / TILE);
    for (let r = br - 5; r <= br + 5; r++) for (let c = bc - 5; c <= bc + 5; c++) {
      if (this.tile(c, r) !== '%' || this.chimed.has(this.room.id)) continue;
      this.chimed.add(this.room.id);
      this.events.push('secret');
      for (let i = 0; i < 6; i++) this.fx.push({ kind: 'star', x: (c + 0.5) * TILE, y: (r + 0.5) * TILE, t: -i * 0.1, vx: 0, vy: -10 });
      this.say(bell ? 'The Silver Bell jingles. Something is hidden close by.' : 'Mochi sniffs at the wall. Something is hidden close by.');
      return;
    }
  }
  get atSign() { return this.sign >= 0; }
  /** Buy from Pip's stall. Returns whether the raisins changed hands. */
  buy(id: string) {
    const item = SHOP.find((s) => s.id === id);
    if (!item || this.raisins < item.price || (id === 'seeds' && this.seeds >= 99)) return false;
    this.raisins -= item.price;
    if (id === 'seeds') this.seeds = Math.min(99, this.seeds + 10);
    else this.bag[id] = (this.bag[id] ?? 0) + 1;
    this.events.push('buy');
    return true;
  }
  closeShop() { this.shop = false; }
  /** Leave the chapter card and keep exploring. */
  resume() { if (this.state === 'chapter') this.state = 'play'; }

  // ─── Menu actions ───────────────────────────────────────────────────────
  /** Owned copies of `id` not currently worn. */
  spare(id: string) { return this.bag[id] ?? 0; }
  canEquip(h: HeroId, id: string) { const g = GEAR[id]; return !!g && (!g.hero || g.hero === h) && this.spare(id) > 0; }
  equip(h: HeroId, slot: Slot, id: string | null) {
    if (id && (!this.canEquip(h, id) || GEAR[id].slot !== slot)) return false;
    if (slot === 'weapon' && !id) return false;
    const old = this.equipped[h][slot];
    if (old) this.bag[old] = (this.bag[old] ?? 0) + 1;
    if (id) { this.bag[id]--; if (!this.bag[id]) delete this.bag[id]; }
    this.equipped[h][slot] = id;
    for (const k of ['dora', 'enzo'] as HeroId[]) this.hp[k] = Math.min(this.hp[k], this.stats(k).maxHp);
    return true;
  }
  eat(id: string, h: HeroId) {
    const food = FOOD[id];
    if (!food || !this.bag[id]) return false;
    const max = this.stats(h).maxHp;
    if (this.hp[h] >= max) return false;
    this.hp[h] = Math.min(max, this.hp[h] + food.heal);
    this.bag[id]--; if (!this.bag[id]) delete this.bag[id];
    this.events.push('eat');
    return true;
  }

  snapshot(): Save {
    const b = this.body;
    return {
      v: 1, room: this.room.id, x: b.x, y: b.y, level: this.level, xp: this.xp, hp: { ...this.hp }, leader: this.leader,
      equip: { dora: { ...this.equipped.dora }, enzo: { ...this.equipped.enzo } }, bag: { ...this.bag }, relics: [...this.relics],
      flags: [...this.flags], visited: [...this.visited],
      raisins: this.raisins, seeds: this.seeds, time: this.time, leaves: this.leaves,
      difficulty: this.difficulty, mp: this.mp, subs: [...this.subs], sub: this.sub,
      pals: Object.fromEntries(Object.entries(this.pals).map(([k, v]) => [k, { ...v }])), pal: this.pal, kills: { ...this.kills },
    };
  }
}
