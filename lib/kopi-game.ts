// Kopi Peng Brawl: the engine. A two-hero belt brawler: both heroes are always on the belt; one is played and the other
// is a helper bot until a second player takes it over. Fixed 60 Hz step, seeded randomness (a seed replays a run
// exactly), no DOM. Sounds and comic effects leave the engine as `fx` events for the scene and the page.
import {
  STAGES, PANEL_W, BOSS_NAME, FOE_NAME, EVENT_NAME,
  type FoeKind, type BossKind, type ItemKind, type HawkerKind, type EventKind, type Scene, type Stage, type Spawn,
} from './kopi-levels.js';

export { STAGES, PANEL_W, BOSS_NAME, FOE_NAME, EVENT_NAME };
export type { FoeKind, BossKind, ItemKind, HawkerKind, EventKind, Scene, Stage };

export const SAVE_KEY = 'kopi-peng-v1';
export const DT = 1 / 60;
export const VIEW_W = 1536;
export const VIEW_H = 864;
export const DEPTH = 220;        // walkable depth: z = 0 at the back of the floor, DEPTH at the front
export const FLOOR_Y = 606;      // screen y of z = 0
export const GRAV = 2300;

export type HeroId = 'dora' | 'enzo';
export type Ctrl = 'p1' | 'p2' | 'bot';
export interface Input { mx: number; mz: number; atk: boolean; jmp: boolean; grab: boolean; atkH: boolean; jmpH: boolean }
export const NO_INPUT: Input = { mx: 0, mz: 0, atk: false, jmp: false, grab: false, atkH: false, jmpH: false };

export type Sfx = 'PANG' | 'BONK' | 'WHAM' | 'KRAK' | 'DUSH' | 'POK' | 'SPLASH' | 'CLANG' | 'SSSS' | 'OINK' | 'CROAK' | 'KO';
export type Fx =
  | { k: 'hit'; x: number; z: number; h: number; sfx: Sfx | null; big: boolean; beat?: boolean }
  | { k: 'ko'; x: number; z: number }
  | { k: 'out'; x: number; z: number }
  | { k: 'banner'; text: string; sub?: string; t: number }
  | { k: 'say'; who: string; text: string }
  | { k: 'snd'; s: string }
  | { k: 'smoke'; x: number; z: number }
  | { k: 'dust'; x: number; z: number }
  | { k: 'flash' }
  | { k: 'shake'; a: number };

// ─────────────────────────────────────────────────────────────── seeded randomness
export function rngOf(seed: number) {
  let a = (seed >>> 0) || 1;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const clamp = (v: number, a: number, b: number) => v < a ? a : v > b ? b : v;
const sgn = (v: number) => v < 0 ? -1 : 1;

// ─────────────────────────────────────────────────────────────── heroes and moves
export const HC: Record<HeroId, { spd: number; zs: number; run: number; jump: number; hp: number; rad: number }> = {
  dora: { spd: 270, zs: 165, run: 470, jump: 860, hp: 120, rad: 28 },
  enzo: { spd: 225, zs: 140, run: 400, jump: 700, hp: 150, rad: 34 },
};
export interface Move {
  anim: string; dur: number; hit: [number, number]; dmg: number; reach: number; zTol: number; kb: number; lift?: number;
  down?: boolean; stun: number; stop: number; sfx: Sfx; chain?: number; lunge?: number; both?: boolean; low?: boolean;
}
const M = (o: Move) => o;
export const MOVES: Record<string, Move> = {
  // Dora: quick, kicks, longer combos
  'dora-jab': M({ anim: 'jab', dur: 0.24, hit: [0.06, 0.12], dmg: 6, reach: 92, zTol: 30, kb: 40, stun: 0.3, stop: 0.035, sfx: 'POK', chain: 0.1 }),
  'dora-jab2': M({ anim: 'jab2', dur: 0.26, hit: [0.07, 0.13], dmg: 7, reach: 96, zTol: 30, kb: 60, stun: 0.32, stop: 0.04, sfx: 'PANG', chain: 0.1 }),
  'dora-kick': M({ anim: 'kick', dur: 0.44, hit: [0.12, 0.24], dmg: 13, reach: 118, zTol: 34, kb: 360, lift: 380, down: true, stun: 0.5, stop: 0.08, sfx: 'WHAM', low: true }),
  'dora-air': M({ anim: 'airkick', dur: 9, hit: [0.06, 9], dmg: 11, reach: 104, zTol: 36, kb: 300, lift: 240, down: true, stun: 0.5, stop: 0.07, sfx: 'DUSH', low: true }),
  'dora-dash': M({ anim: 'dashkick', dur: 0.42, hit: [0.04, 0.26], dmg: 12, reach: 110, zTol: 34, kb: 420, lift: 300, down: true, stun: 0.5, stop: 0.07, sfx: 'WHAM', lunge: 520, low: true }),
  'dora-special': M({ anim: 'cyclone', dur: 0.9, hit: [0.1, 0.8], dmg: 9, reach: 140, zTol: 46, kb: 380, lift: 420, down: true, stun: 0.5, stop: 0.03, sfx: 'CLANG', both: true, lunge: 260, low: true }),
  // Enzo: slower, heavier
  'enzo-jab': M({ anim: 'jab', dur: 0.28, hit: [0.07, 0.13], dmg: 8, reach: 90, zTol: 32, kb: 50, stun: 0.34, stop: 0.04, sfx: 'POK', chain: 0.12 }),
  'enzo-jab2': M({ anim: 'jab2', dur: 0.32, hit: [0.08, 0.15], dmg: 10, reach: 94, zTol: 32, kb: 80, stun: 0.36, stop: 0.05, sfx: 'BONK', chain: 0.12 }),
  'enzo-belly': M({ anim: 'belly', dur: 0.52, hit: [0.16, 0.28], dmg: 16, reach: 104, zTol: 40, kb: 460, lift: 320, down: true, stun: 0.55, stop: 0.1, sfx: 'WHAM', low: true }),
  'enzo-air': M({ anim: 'airslam', dur: 9, hit: [0.04, 9], dmg: 14, reach: 92, zTol: 40, kb: 260, lift: 200, down: true, stun: 0.5, stop: 0.08, sfx: 'KRAK', both: true, low: true }),
  'enzo-dash': M({ anim: 'dashbump', dur: 0.46, hit: [0.04, 0.3], dmg: 14, reach: 96, zTol: 38, kb: 480, lift: 260, down: true, stun: 0.5, stop: 0.08, sfx: 'WHAM', lunge: 440, low: true }),
  'enzo-special': M({ anim: 'slam', dur: 0.95, hit: [0.5, 0.62], dmg: 26, reach: 200, zTol: 90, kb: 420, lift: 520, down: true, stun: 0.6, stop: 0.14, sfx: 'KRAK', both: true, low: true }),
  // with a weapon (either hero)
  'swing-heavy': M({ anim: 'swing', dur: 0.5, hit: [0.17, 0.27], dmg: 15, reach: 124, zTol: 40, kb: 380, lift: 300, down: true, stun: 0.5, stop: 0.1, sfx: 'CLANG', low: true }),
  'swing-light': M({ anim: 'poke', dur: 0.3, hit: [0.08, 0.15], dmg: 9, reach: 118, zTol: 34, kb: 120, stun: 0.36, stop: 0.05, sfx: 'PANG', chain: 0.08 }),
  'team': M({ anim: 'team', dur: 1.3, hit: [0.8, 0.95], dmg: 40, reach: 900, zTol: 260, kb: 600, lift: 600, down: true, stun: 0.8, stop: 0.2, sfx: 'KO', both: true, low: true }),
};
const COMBO: Record<HeroId, string[]> = { dora: ['dora-jab', 'dora-jab2', 'dora-kick'], enzo: ['enzo-jab', 'enzo-jab2', 'enzo-belly'] };
export const SPECIAL_NAME: Record<HeroId, string> = { dora: 'Tray Cyclone', enzo: 'Stool Slam' };
export const METER_MAX = 200;    // two bars; a special costs one, a team-up both

export interface ItemDef { cls: 'heavy' | 'light' | 'throw' | 'food'; uses: number; dmg: number; heal?: number; sfx: Sfx; throwDmg: number; slide?: boolean }
export const ITEMS: Record<ItemKind, ItemDef> = {
  tray: { cls: 'light', uses: 7, dmg: 10, sfx: 'CLANG', throwDmg: 12 },
  stool: { cls: 'heavy', uses: 4, dmg: 16, sfx: 'BONK', throwDmg: 16 },
  wok: { cls: 'heavy', uses: 5, dmg: 15, sfx: 'CLANG', throwDmg: 14 },
  durian: { cls: 'throw', uses: 2, dmg: 14, sfx: 'KRAK', throwDmg: 20 },
  pole: { cls: 'light', uses: 8, dmg: 9, sfx: 'PANG', throwDmg: 10 },
  satay: { cls: 'throw', uses: 1, dmg: 6, sfx: 'POK', throwDmg: 12 },
  kopibag: { cls: 'light', uses: 3, dmg: 8, sfx: 'SPLASH', throwDmg: 10 },
  fish: { cls: 'light', uses: 6, dmg: 9, sfx: 'SPLASH', throwDmg: 9 },
  ice: { cls: 'throw', uses: 1, dmg: 12, sfx: 'KRAK', throwDmg: 16, slide: true },
  plate: { cls: 'food', uses: 1, dmg: 0, heal: 30, sfx: 'POK', throwDmg: 0 },
  kopi: { cls: 'food', uses: 1, dmg: 0, heal: 45, sfx: 'POK', throwDmg: 0 },
  basin: { cls: 'heavy', uses: 4, dmg: 13, sfx: 'BONK', throwDmg: 14 },
  coconut: { cls: 'throw', uses: 2, dmg: 12, sfx: 'BONK', throwDmg: 18 },
};

// ─────────────────────────────────────────────────────────────── foes
export interface FoeDef { hp: number; spd: number; zs: number; reach: number; dmg: number; wind: number; act: number; rec: number; cd: number; rad: number; ht: number; fly?: boolean; heavy?: boolean; score: number; down?: boolean }
export const FD: Record<FoeKind, FoeDef> = {
  rat: { hp: 22, spd: 200, zs: 130, reach: 64, dmg: 5, wind: 0.32, act: 0.3, rec: 0.5, cd: 1.3, rad: 22, ht: 50, score: 100 },
  macaque: { hp: 40, spd: 165, zs: 120, reach: 78, dmg: 7, wind: 0.36, act: 0.16, rec: 0.5, cd: 1.5, rad: 26, ht: 120, score: 200 },
  mynah: { hp: 18, spd: 250, zs: 160, reach: 60, dmg: 4, wind: 0.3, act: 0.25, rec: 0.6, cd: 1.6, rad: 20, ht: 50, fly: true, score: 150 },
  monitor: { hp: 85, spd: 92, zs: 70, reach: 140, dmg: 10, wind: 0.7, act: 0.3, rec: 0.8, cd: 2.2, rad: 40, ht: 70, heavy: true, score: 400, down: true },
  roach: { hp: 5, spd: 300, zs: 220, reach: 30, dmg: 0, wind: 0, act: 0, rec: 0, cd: 0, rad: 14, ht: 20, fly: true, score: 50 },
  python: { hp: 60, spd: 120, zs: 80, reach: 70, dmg: 3, wind: 0.6, act: 0.25, rec: 1.0, cd: 2.0, rad: 30, ht: 80, score: 400 },
  toad: { hp: 45, spd: 140, zs: 100, reach: 230, dmg: 6, wind: 0.5, act: 0.2, rec: 0.7, cd: 2.0, rad: 30, ht: 60, score: 250 },
  boar: { hp: 70, spd: 120, zs: 80, reach: 60, dmg: 13, wind: 0.7, act: 0, rec: 0.6, cd: 2.4, rad: 40, ht: 80, heavy: true, score: 450, down: true },
};
export interface BossDef { hp: number; spd: number; rad: number; ht: number; score: number }
export const BD: Record<BossKind, BossDef> = {
  tank: { hp: 420, spd: 80, rad: 70, ht: 110, score: 5000 },
  ssst: { hp: 440, spd: 130, rad: 50, ht: 120, score: 5000 },
  tusker: { hp: 480, spd: 110, rad: 70, ht: 140, score: 6000 },
  ong: { hp: 460, spd: 120, rad: 70, ht: 130, score: 6000 },
  king: { hp: 620, spd: 170, rad: 44, ht: 200, score: 10000 },
};

// ─────────────────────────────────────────────────────────────── entities
export type HeroSt = 'idle' | 'walk' | 'run' | 'atk' | 'jump' | 'hurt' | 'down' | 'getup' | 'out' | 'pick' | 'throw' | 'wrapped' | 'stun' | 'carry' | 'eat' | 'cheer';
export interface Hero {
  id: HeroId; ctrl: Ctrl; x: number; z: number; h: number; vx: number; vz: number; vh: number; face: number;
  hp: number; maxHp: number; st: HeroSt; t: number; move: string | null; combo: number; comboT: number;
  hold: Item | null; carry: Foe | null; inv: number; meter: number; buff: number; running: boolean;
  tapDir: number; tapT: number; lastMx: number; hit: Set<object>; outT: number; anim: string; animT: number;
  wrappedBy: Foe | null; mash: number; landT: number; teamReq: number; score: number; hits: number;
}
export type FoeSt = 'idle' | 'walk' | 'wind' | 'act' | 'rec' | 'hurt' | 'air' | 'down' | 'getup' | 'dead' | 'eat' | 'flee' | 'wrap' | 'ride' | 'enter' | 'stun' | 'charge' | 'cough' | 'thrown' | 'carried';
export interface Foe {
  id: number; kind: FoeKind | BossKind; boss: boolean; x: number; z: number; h: number; vx: number; vz: number; vh: number;
  face: number; hp: number; maxHp: number; st: FoeSt; t: number; cd: number; target: Hero | null; arm: Item | null;
  rider: Foe | null; mount: Foe | null; enrage: number; anim: string; animT: number; hit: Set<object>; hitsTaken: number;
  wrapping: Hero | null; dead: boolean; fade: number; inv: number; pat: string; patT: number; phase: number; flash: number;
  lane: number; gone: boolean; atkN: number; stolen: boolean; thrownBy: Hero | null;
}
export interface Item { id: number; kind: ItemKind; x: number; z: number; h: number; vx: number; vz: number; vh: number; uses: number; held: boolean; flying: Hero | Foe | null; fromFoe: boolean; hit: Set<object>; spin: number; gone: boolean; slide: number }
export interface Hawker { k: HawkerKind; x: number; cd: number; act: string; t: number }
export interface Table { x: number; z: number; broken: boolean }
export interface Hazard { kind: 'trolley' | 'lion' | 'durian' | 'boarline'; z: number; x: number; dir: number; spd: number; tell: number; hit: Set<object>; done: boolean }
export interface Smoke { x: number; z: number; t: number; r: number }
export interface Shot { kind: 'satay' | 'tongue'; x: number; z: number; h: number; vx: number; t: number; owner: Foe; hit: Set<object>; done: boolean; len?: number }
export interface Stats { score: number; hits: number; bestCombo: number; kos: number; specials: number; teamups: number; time: number; retries: number; foodEaten: number; outs: number; beats: number }
export interface SaveData { v: 1; cleared: Record<string, { score: number; rank: number }>; assist: boolean; sound: boolean; music: boolean; seen: string[] }
export function freshSave(): SaveData { return { v: 1, cleared: {}, assist: true, sound: true, music: true, seen: [] }; }
export function parseSave(raw: string | null): SaveData | null {
  if (!raw) return null;
  try { const s = JSON.parse(raw); if (!s || s.v !== 1 || typeof s.cleared !== 'object') return null; return { ...freshSave(), ...s }; } catch { return null; }
}
export function stageOpen(save: SaveData, i: number) { return i === 0 || !!save.cleared[STAGES[i - 1].id]; }
export const RANKS = ['C', 'B', 'A', 'S'];
export function rankFor(s: Stats, stageIdx: number): number {
  let r = 0; const par = 150 + stageIdx * 20;
  if (s.time < par * 1.4) r++; if (s.time < par) r++;
  if (s.bestCombo >= 8) r++; if (s.outs === 0 && s.retries === 0) r++;
  return clamp(r - 1, 0, 3);
}

export interface GameOpts { stage: number; scene?: number; seed?: number; assist?: boolean; p1?: HeroId; p2?: boolean; skipTalk?: boolean; auto?: boolean }
export type Mode = 'play' | 'down' | 'clear';

export class KopiGame {
  stageIdx: number; stage: Stage; sceneIdx = 0; scene: Scene; rng: () => number; botRng: () => number; seed: number;
  heroes: Hero[]; foes: Foe[] = []; items: Item[] = []; hawkers: Hawker[] = []; tables: Table[] = []; hazards: Hazard[] = [];
  smoke: Smoke[] = []; shots: Shot[] = []; fx: Fx[] = []; nextId = 1;
  camX = 0; lockX = 0; locked = false; wave = -1; waveWait = 0; sceneT = 0; stageT = 0; t = 0; stop = 0; mode: Mode = 'play';
  go = 0; stats: Stats; assist: boolean; eventDone = false; event: EventKind | null = null; eventT = 0;
  dark = 0; slip = 0; water = 0; beat = 0; beatT = 0; doors = 0; doorT = 0; curve = 0; curveT = 0; lightning = 0;
  twistT = 0; jetT = 0; jetTell = 0; jet = 0; boss: Foe | null = null; bossName = ''; clearT = 0; talk: { who: string; text: string; t: number } | null = null;
  shake = 0; downT = 0; panelIntro = 0; skipTalk: boolean;

  constructor(o: GameOpts) {
    this.stageIdx = clamp(o.stage, 0, STAGES.length - 1); this.stage = STAGES[this.stageIdx];
    this.seed = o.seed ?? 12345; this.rng = rngOf(this.seed); this.botRng = rngOf(this.seed ^ 0x9e3779b9);
    this.assist = o.assist ?? true; this.skipTalk = !!o.skipTalk;
    const p1 = o.p1 ?? 'dora';
    const mk = (id: HeroId, x: number, z: number): Hero => ({
      id, ctrl: o.auto ? 'bot' : id === p1 ? 'p1' : (o.p2 ? 'p2' : 'bot'), x, z, h: 0, vx: 0, vz: 0, vh: 0, face: 1, hp: HC[id].hp, maxHp: HC[id].hp,
      st: 'idle', t: 0, move: null, combo: 0, comboT: 0, hold: null, carry: null, inv: 0, meter: 50, buff: 0, running: false,
      tapDir: 0, tapT: 9, lastMx: 0, hit: new Set(), outT: 0, anim: 'idle', animT: 0, wrappedBy: null, mash: 0, landT: 0, teamReq: 0, score: 0, hits: 0,
    });
    this.heroes = [mk('dora', 220, 90), mk('enzo', 160, 160)];
    this.stats = { score: 0, hits: 0, bestCombo: 0, kos: 0, specials: 0, teamups: 0, time: 0, retries: 0, foodEaten: 0, outs: 0, beats: 0 };
    this.scene = this.stage.scenes[0];
    this.enterScene(o.scene ?? 0);
  }

  // ─────────────────────────────────────── scenes
  enterScene(i: number) {
    this.sceneIdx = i; this.scene = this.stage.scenes[i];
    const base = i * PANEL_W;
    this.lockX = base; this.camX = base; this.locked = true; this.wave = -1; this.waveWait = 1.2; this.sceneT = 0; this.eventDone = !this.scene.eventAt;
    this.foes = []; this.shots = []; this.hazards = []; this.smoke = []; this.boss = null; this.go = 0;
    this.items = this.scene.items.map((it) => this.mkItem(it.k, base + it.x, it.z));
    this.hawkers = this.scene.hawkers.map((h) => ({ k: h.k, x: base + h.x, cd: 4 + this.rng() * 4, act: 'stand', t: 0 }));
    this.tables = this.scene.tables.map((t) => ({ x: base + t.x, z: t.z, broken: false }));
    this.heroes.forEach((h, k) => {
      if (h.x < base + 80 || h.x > base + PANEL_W - 80 || i === 0) { h.x = base + 200 - k * 70; }
      h.z = clamp(h.z, 20, DEPTH - 20);
      if (h.st === 'out') { h.st = 'idle'; h.hp = Math.round(h.maxHp * 0.5); }
    });
    this.twistT = 6; this.jetT = 7; this.doorT = 8; this.curveT = 11;
    if (this.stage.twist === 'monsoon') this.water = i === 0 ? 0.05 : i === 1 ? 0.35 : 0.6;
    this.panelIntro = 1.6;
    if (this.scene.waves[0]?.say && !this.skipTalk) this.say(this.heroes[0].ctrl === 'p1' ? 'Dora' : 'Enzo', this.scene.waves[0].say);
    this.fx.push({ k: 'banner', text: this.scene.title, sub: i === 0 ? `${this.stage.place} · ${this.stage.twistName}` : undefined, t: 2.2 });
  }
  say(who: string, text: string) { this.talk = { who, text, t: 3.2 }; this.fx.push({ k: 'say', who, text }); }
  mkItem(k: ItemKind, x: number, z: number, h = 0): Item {
    return { id: this.nextId++, kind: k, x, z, h, vx: 0, vz: 0, vh: 0, uses: ITEMS[k].uses, held: false, flying: null, fromFoe: false, hit: new Set(), spin: 0, gone: false, slide: 0 };
  }
  mkFoe(kind: FoeKind | BossKind, x: number, z: number, boss = false): Foe {
    const hp = boss ? BD[kind as BossKind].hp : FD[kind as FoeKind].hp;
    return { id: this.nextId++, kind, boss, x, z, h: 0, vx: 0, vz: 0, vh: 0, face: -1, hp, maxHp: hp, st: 'enter', t: 0, cd: 1 + this.rng(), target: null, arm: null,
      rider: null, mount: null, enrage: 0, anim: 'walk', animT: 0, hit: new Set(), hitsTaken: 0, wrapping: null, dead: false, fade: 0, inv: 0.4, pat: '', patT: 0, phase: 0,
      flash: 0, lane: z, gone: false, atkN: 0, stolen: false, thrownBy: null };
  }
  spawn(s: Spawn) {
    const n = s.n ?? 1, base = this.lockX;
    for (let i = 0; i < n; i++) {
      const from = s.from ?? (this.rng() < 0.5 ? 'L' : 'R');
      let x = from === 'L' ? base - 60 - i * 70 : from === 'R' ? base + PANEL_W + 60 + i * 70 : base + 300 + this.rng() * (PANEL_W - 600);
      if (from === 'B' && this.stage.twist === 'train') x = base + this.doorXs()[i % 2] + (this.rng() - 0.5) * 60;
      const z = s.z ?? (from === 'B' ? 4 : 20 + this.rng() * (DEPTH - 40));
      const f = this.mkFoe(s.k, x, z);
      if (from === 'T' || FD[s.k].fly) { f.h = s.k === 'python' ? 230 : 160; if (from === 'T') f.x = base + 250 + this.rng() * (PANEL_W - 500); }
      if (from === 'B') { f.st = 'enter'; f.vz = 90; }
      if (s.arm) { const it = this.mkItem(s.arm, x, z); it.held = true; f.arm = it; this.items.push(it); }
      if (s.rider) { const r = this.mkFoe(s.rider, x, z); r.st = 'ride'; r.mount = f; f.rider = r; this.foes.push(r); }
      this.foes.push(f);
    }
  }
  doorXs() { return [330, 1130]; }
  liveFoes() { return this.foes.filter((f) => !f.dead && !f.gone); }

  // ─────────────────────────────────────── the step
  step(inputs: Partial<Record<HeroId, Input>>) {
    this.fx.length = 0;
    if (this.mode !== 'play') { this.stepEnd(); return; }
    if (this.stop > 0) { this.stop -= DT; return; }
    this.t += DT; this.sceneT += DT; this.stageT += DT; this.stats.time += DT;
    if (this.talk) { this.talk.t -= DT; if (this.talk.t <= 0) this.talk = null; }
    if (this.panelIntro > 0) this.panelIntro -= DT;
    this.shake = Math.max(0, this.shake - DT * 30);
    this.stepWaves(); this.stepTwist(); this.stepEvent();
    for (const h of this.heroes) {
      const inp = h.ctrl === 'bot' ? this.botInput(h) : (inputs[h.id] ?? NO_INPUT);
      this.stepHero(h, inp);
    }
    this.stepTeam();
    for (const f of this.foes) {
      this.stepFoe(f);
      // once in, foes stay on screen (a boar backing off for a run-up must not wander out of reach)
      if (!f.dead && f.st !== 'enter' && f.st !== 'thrown' && f.st !== 'carried' && f.kind !== 'roach') f.x = clamp(f.x, this.camX + 40, this.camX + VIEW_W - 40);
    }
    this.foes = this.foes.filter((f) => !f.gone);
    this.stepItems(); this.stepShots(); this.stepHazards(); this.stepHawkers(); this.stepCamera();
    const outs = this.heroes.filter((h) => h.st === 'out').length;
    if (outs === 2) { this.mode = 'down'; this.downT = 0; this.fx.push({ k: 'banner', text: 'Both down!', sub: 'Continue?', t: 9 }); }
  }
  stepEnd() { if (this.mode === 'clear') this.clearT += DT; else this.downT += DT; for (const h of this.heroes) { h.t += DT; h.animT += DT; } }

  /** continue after both heroes went down: restart this scene with full health */
  retry() {
    this.stats.retries++;
    for (const h of this.heroes) { h.hp = h.maxHp; h.st = 'idle'; h.t = 0; h.hold = null; h.carry = null; h.wrappedBy = null; h.inv = 2; h.h = 0; h.vh = 0; h.meter = Math.max(h.meter, 100); }
    this.mode = 'play'; this.enterScene(this.sceneIdx);
  }

  stepWaves() {
    if (!this.locked) return;
    const live = this.liveFoes().filter((f) => f.kind !== 'roach' && !f.boss);
    if (this.boss && !this.boss.dead) return;
    if (this.boss && this.boss.dead) {
      if (this.mode === 'play' && this.boss.fade > 1.2) { this.mode = 'clear'; this.clearT = 0; for (const h of this.heroes) if (h.st !== 'out') { h.st = 'cheer'; h.t = 0; } this.fx.push({ k: 'banner', text: 'Stage clear!', t: 4 }); }
      return;
    }
    if (live.length > 0) return;
    if (this.wave + 1 >= this.scene.waves.length) {
      if (this.scene.boss) {
        if (!this.boss) this.spawnBoss();
        return;
      }
      this.locked = false; this.go = 3; this.fx.push({ k: 'snd', s: 'go' });
      return;
    }
    this.waveWait -= DT;
    if (this.waveWait > 0) return;
    this.wave++;
    const w = this.scene.waves[this.wave];
    if (w.say && this.wave > 0 && !this.skipTalk) this.say(this.wave % 2 ? 'Enzo' : 'Dora', w.say);
    for (const s of w.foes) this.spawn(s);
    this.waveWait = this.scene.waves[this.wave + 1]?.wait ?? 1;
  }
  spawnBoss() {
    const k = this.scene.boss!;
    const f = this.mkFoe(k, this.lockX + PANEL_W - 260, 120, true);
    f.st = 'enter'; f.x = this.lockX + PANEL_W + 160; f.face = -1;
    if (k === 'ssst') { f.h = 0; }
    this.foes.push(f); this.boss = f; this.bossName = BOSS_NAME[k];
    this.fx.push({ k: 'banner', text: BOSS_NAME[k], sub: 'Boss', t: 2.6 }); this.fx.push({ k: 'snd', s: 'boss' });
    this.shake = 8;
  }

  // ─────────────────────────────────────── twists
  stepTwist() {
    const tw = this.stage.twist, fight = this.locked;
    if (tw === 'closing' && fight) {
      this.twistT -= DT;
      if (this.twistT <= 0) { this.twistT = 11 + this.rng() * 3; this.addLaneHazard('trolley', 720, 1.3); }
    }
    if (tw === 'liondance') {
      const per = 0.6; this.beatT += DT; if (this.beatT >= per) { this.beatT -= per; this.beat++; this.fx.push({ k: 'snd', s: 'drum' }); }
      if (fight && !this.scene.boss) { this.twistT -= DT; if (this.twistT <= 0) { this.twistT = 13 + this.rng() * 3; this.addLaneHazard('lion', 360, 1.6); } }
    }
    if (tw === 'train') {
      if (this.doors > 0) { this.doors -= DT; if (this.doors <= 0) this.fx.push({ k: 'snd', s: 'doorsclose' }); }
      else if (fight && !this.scene.boss) {
        this.doorT -= DT;
        if (this.doorT <= 0) { this.doorT = 15; this.doors = 6; this.fx.push({ k: 'banner', text: 'Doors opening', t: 1.6 }); this.fx.push({ k: 'snd', s: 'doors' });
          if (this.wave >= 0 && this.wave < this.scene.waves.length - 1 && this.liveFoes().length < 5) this.spawn({ k: this.rng() < 0.5 ? 'rat' : 'macaque', from: 'B' }); }
      }
      if (this.curve !== 0) { this.curve -= sgn(this.curve) * DT; if (Math.abs(this.curve) < DT) this.curve = 0; }
      else { this.curveT -= DT; if (this.curveT <= 0) { this.curveT = 10 + this.rng() * 4; this.curve = (this.rng() < 0.5 ? -1 : 1) * 2.2; this.fx.push({ k: 'snd', s: 'curve' }); } }
      // tunnels: the lights cut out now and then
      if (!this.scene.boss && this.sceneIdx === 0 && this.dark <= 0 && this.rng() < DT / 18) { this.dark = 3.5; this.fx.push({ k: 'snd', s: 'dark' }); }
    }
    if (tw === 'monsoon') {
      this.water = Math.min(this.sceneIdx === 2 ? 0.75 : 0.9, this.water + DT / 160);
      this.twistT -= DT;
      if (this.twistT <= 0) { this.twistT = 7 + this.rng() * 4; this.lightning = 0.35; this.fx.push({ k: 'flash' }); this.fx.push({ k: 'snd', s: 'thunder' });
        if (fight && this.items.filter((i) => !i.gone && !i.held).length < 4) this.items.push(this.mkItem(this.rng() < 0.6 ? 'fish' : 'ice', this.lockX + 200 + this.rng() * (PANEL_W - 400), 10 + this.rng() * 40, 0)); }
    }
    if (this.lightning > 0) this.lightning -= DT;
    if (tw === 'jets' && fight) {
      if (this.jetTell > 0) {
        this.jetTell -= DT;
        if (this.jetTell <= 0) {
          this.jet = 0.6; this.shake = 10; this.fx.push({ k: 'snd', s: 'jet' });
          for (const h of this.heroes) if (h.h < 12 && h.st !== 'out' && h.st !== 'down' && h.inv <= 0) { this.setHero(h, 'stun'); h.t = -0.6; }
          for (const f of this.liveFoes()) if (f.h < 12 && !f.boss && f.st !== 'down' && f.st !== 'air') { f.st = 'stun'; f.t = 0; }
        }
      } else { this.jetT -= DT; if (this.jetT <= 0) { this.jetT = 9 + this.rng() * 3; this.jetTell = 1.6; this.fx.push({ k: 'snd', s: 'rumble' }); } }
      if (this.jet > 0) this.jet -= DT;
    }
    if (this.dark > 0) this.dark -= DT;
    if (this.slip > 0) this.slip -= DT;
  }
  addLaneHazard(kind: Hazard['kind'], spd: number, tell: number, z?: number) {
    const dir = this.rng() < 0.5 ? 1 : -1;
    const lane = z ?? 30 + this.rng() * (DEPTH - 60);
    this.hazards.push({ kind, z: lane, x: dir > 0 ? this.camX - 220 : this.camX + VIEW_W + 220, dir, spd, tell, hit: new Set(), done: false });
    this.fx.push({ k: 'snd', s: kind === 'lion' ? 'lion' : 'trolley' });
  }
  stepEvent() {
    if (this.eventT > 0) { this.eventT -= DT; if (this.eventT <= 0) this.event = null; }
    if (this.eventDone || !this.locked || this.scene.boss || this.sceneT < (this.scene.eventAt ?? 1e9)) return;
    this.eventDone = true;
    const pool = this.stage.events; const ev = pool[Math.floor(this.rng() * pool.length)];
    this.event = ev; this.eventT = 7;
    this.fx.push({ k: 'banner', text: EVENT_NAME[ev], t: 1.8 }); this.fx.push({ k: 'snd', s: 'event' });
    if (ev === 'powercut') this.dark = 6;
    if (ev === 'downpour') { this.slip = 8; this.fx.push({ k: 'snd', s: 'rain' }); }
    if (ev === 'roaches') for (let i = 0; i < 4; i++) { const f = this.mkFoe('roach', this.lockX + (i % 2 ? PANEL_W + 40 : -40), 40 + this.rng() * 150); f.h = 70 + this.rng() * 60; f.st = 'walk'; this.foes.push(f); }
    if (ev === 'durians') for (let i = 0; i < 5; i++) {
      const dir = i % 2 ? -1 : 1;
      this.hazards.push({ kind: 'durian', z: 25 + (i * 41) % (DEPTH - 40), x: dir > 0 ? this.camX - 120 - i * 180 : this.camX + VIEW_W + 120 + i * 180, dir, spd: 430, tell: 0.6, hit: new Set(), done: false });
    }
  }
  stepHazards() {
    for (const z of this.hazards) {
      if (z.tell > 0) { z.tell -= DT; continue; }
      z.x += z.dir * z.spd * DT;
      const zt = z.kind === 'lion' ? 42 : z.kind === 'durian' ? 20 : 30, half = z.kind === 'lion' ? 120 : z.kind === 'durian' ? 26 : 70;
      const dmg = z.kind === 'durian' ? 8 : z.kind === 'lion' ? 12 : 10;
      for (const h of this.heroes) if (!z.hit.has(h) && Math.abs(h.z - z.z) < zt && Math.abs(h.x - z.x) < half && h.h < 30 && h.st !== 'out' && h.inv <= 0) {
        z.hit.add(h); this.hurtHero(h, dmg, z.dir, true, null); this.fx.push({ k: 'hit', x: h.x, z: h.z, h: 60, sfx: z.kind === 'lion' ? 'WHAM' : 'BONK', big: true });
      }
      for (const f of this.liveFoes()) if (!z.hit.has(f) && Math.abs(f.z - z.z) < zt && Math.abs(f.x - z.x) < half && f.h < 30 && !f.boss && f.st !== 'ride') {
        z.hit.add(f); this.hurtFoe(f, dmg * 2, z.dir, null, MOVES['dora-kick']); this.fx.push({ k: 'hit', x: f.x, z: f.z, h: 50, sfx: 'WHAM', big: true });
      }
      if (z.kind === 'trolley') for (const it of this.items) if (!it.held && !it.gone && Math.abs(it.z - z.z) < zt && Math.abs(it.x - z.x) < half) it.gone = true;
      if ((z.dir > 0 && z.x > this.camX + VIEW_W + 260) || (z.dir < 0 && z.x < this.camX - 260)) {
        z.done = true;
        if (z.kind === 'durian' && this.items.filter((i) => i.kind === 'durian' && !i.gone).length < 2) this.items.push(this.mkItem('durian', clamp(z.x, this.camX + 80, this.camX + VIEW_W - 80), z.z));
      }
    }
    this.hazards = this.hazards.filter((z) => !z.done);
  }

  // ─────────────────────────────────────── heroes
  setHero(h: Hero, st: HeroSt) { h.st = st; h.t = 0; if (st !== 'atk') h.move = null; }
  speedK(h: { h: number }) { return (1 - 0.35 * (this.stage.twist === 'monsoon' && h.h < 5 ? this.water : 0)) * (h === this.heroes[0] || h === this.heroes[1] ? 1 : 1); }
  stepHero(h: Hero, inp: Input) {
    h.t += DT; h.animT += DT; if (h.inv > 0) h.inv -= DT; if (h.buff > 0) h.buff -= DT; if (h.comboT > 0) h.comboT -= DT; if (h.teamReq > 0) h.teamReq -= DT;
    const C = HC[h.id];
    // double tap to run
    const mxs = Math.abs(inp.mx) > 0.5 ? sgn(inp.mx) : 0;
    h.tapT += DT;
    if (mxs !== 0 && h.lastMx === 0) { if (h.tapDir === mxs && h.tapT < 0.28) h.running = true; h.tapDir = mxs; h.tapT = 0; }
    if (mxs === 0 || mxs !== h.tapDir) h.running = mxs !== 0 && h.running && mxs === h.tapDir;
    h.lastMx = mxs;
    if (h.st === 'out') { h.outT -= DT; const mate = this.heroes.find((o) => o !== h)!; if (h.outT <= 0 && mate.st !== 'out') { h.st = 'getup'; h.t = 0; h.hp = Math.round(h.maxHp * 0.5); h.inv = 2.5; this.fx.push({ k: 'banner', text: `${h.id === 'dora' ? 'Dora' : 'Enzo'} is back!`, t: 1.2 }); } return; }
    // physics
    const air = h.h > 0 || h.vh > 0;
    if (air) { h.vh -= GRAV * DT; h.h += h.vh * DT; if (h.h <= 0) { h.h = 0; h.vh = 0; this.land(h); } }
    const slip = this.slip > 0 ? 0.04 : 0.25;
    const drift = this.curve !== 0 && h.h < 5 ? sgn(this.curve) * 70 : 0;
    const sk = this.speedK(h);
    const can = h.st === 'idle' || h.st === 'walk' || h.st === 'run';
    if (h.st === 'wrapped') {
      if (inp.atk || inp.jmp) h.mash += 1;
      const by = h.wrappedBy;
      if (!by || by.dead || by.wrapping !== h || h.mash >= 14) { if (by && by.wrapping === h) { by.wrapping = null; by.st = 'stun'; by.t = 0; } h.wrappedBy = null; this.setHero(h, 'idle'); h.inv = 0.8; h.mash = 0; }
      else { h.hp -= 4 * DT * (this.assist ? 0.7 : 1); if (h.hp <= 0) this.knockOut(h); }
      return;
    }
    if (can && !air) {
      const spd = (h.running ? C.run : C.spd) * sk * (h.carry ? 0.7 : 1);
      const tx = inp.mx * spd, tz = inp.mz * C.zs * sk;
      h.vx += (tx - h.vx) * Math.min(1, slip * 60 * DT * 4); h.vz += (tz - h.vz) * Math.min(1, slip * 60 * DT * 4);
      if (mxs !== 0) h.face = mxs;
      const moving = Math.abs(h.vx) > 30 || Math.abs(h.vz) > 30;
      const want: HeroSt = moving ? (h.running ? 'run' : 'walk') : 'idle';
      if (h.st !== want) { h.st = want; if (want !== 'idle' || h.t > 0.1) h.t = 0; }
      h.anim = h.carry ? 'carry' : h.hold && ITEMS[h.hold.kind].cls === 'heavy' ? (moving ? 'walkhold' : 'idlehold') : want;
      // actions
      if (inp.jmp && inp.atk && h.meter >= 100) { this.special(h); }
      else if (inp.jmp) { h.vh = C.jump; h.h = 0.1; this.setHero(h, 'jump'); h.anim = 'jump'; h.vx = inp.mx * (h.running ? C.run : C.spd) * sk; h.vz = inp.mz * C.zs * 0.8; this.fx.push({ k: 'snd', s: 'jump' }); }
      else if (inp.grab) this.grabAction(h);
      else if (inp.atk) this.attack(h, inp);
    } else if (h.st === 'jump') {
      h.anim = h.vh > 0 ? 'jump' : 'fall';
      if (inp.atk && !h.move) { h.move = `${h.id}-air`; h.hit = new Set(); h.st = 'atk'; h.t = 0; h.anim = MOVES[h.move].anim; }
      h.vx += (inp.mx * C.spd * 0.9 - h.vx) * 0.04; h.vz += (inp.mz * C.zs * 0.7 - h.vz) * 0.04;
    } else if (h.st === 'atk' && h.move) {
      const mv = MOVES[h.move];
      if (mv.lunge && h.t < mv.hit[1]) { h.vx = h.face * mv.lunge * (1 - h.t / Math.max(mv.hit[1], 0.01)) * sk; }
      else if (!air) { h.vx *= 0.82; h.vz *= 0.82; }
      if (h.move === 'dora-special') { h.face = Math.floor(h.t / 0.07) % 2 ? -1 : 1; h.vz = inp.mz * 120; }
      if (h.t >= mv.hit[0] && h.t <= mv.hit[1]) this.hitbox(h, mv);
      if (mv.chain && h.t > mv.dur - mv.chain && inp.atk && h.hold === null) { this.attack(h, inp, true); }
      else if (h.t >= mv.dur && !air) { this.setHero(h, 'idle'); }
      if (air && h.t > 0.6 && mv.dur > 5) { /* air move lasts to landing */ }
    } else if (h.st === 'hurt' || h.st === 'stun') {
      h.vx *= 0.88; h.vz *= 0.88; h.anim = h.st === 'stun' ? 'stun' : 'hurt';
      if (h.t >= (h.st === 'stun' ? 0.8 : 0.36)) this.setHero(h, 'idle');
    } else if (h.st === 'down') {
      h.anim = 'down'; if (!air) { h.vx *= 0.85; h.vz *= 0.85; }
      if (h.t >= 1.0 && !air) { if (h.hp <= 0) this.knockOut(h); else { this.setHero(h, 'getup'); h.inv = 1.2; } }
    } else if (h.st === 'getup') { h.anim = 'getup'; if (h.t >= 0.45) this.setHero(h, 'idle'); }
    else if (h.st === 'pick') { h.anim = 'pick'; h.vx *= 0.7; h.vz *= 0.7; if (h.t >= 0.22) this.setHero(h, 'idle'); }
    else if (h.st === 'eat') { h.anim = 'eat'; h.vx *= 0.7; h.vz *= 0.7; if (h.t >= 0.5) this.setHero(h, 'idle'); }
    else if (h.st === 'throw') { h.anim = 'throw'; h.vx *= 0.8; h.vz *= 0.8; if (h.t >= 0.32) this.setHero(h, 'idle'); }
    else if (h.st === 'cheer') { h.anim = 'cheer'; h.vx = 0; h.vz = 0; }
    if (h.st !== 'jump' && h.st !== 'atk' && !air && !can) { /* friction handled above */ }
    h.x += (h.vx + drift * 0) * DT; h.z += (h.vz + (h.h < 5 ? drift : 0)) * DT;
    h.z = clamp(h.z, 6, DEPTH - 6);
    const lo = this.camX + 40, hi = this.locked ? this.camX + VIEW_W - 40 : this.camX + VIEW_W - 40;
    h.x = clamp(h.x, lo, hi);
    // pick up food by walking over it
    if (can && !air) for (const it of this.items) if (!it.gone && !it.held && !it.flying && ITEMS[it.kind].cls === 'food' && Math.abs(it.x - h.x) < 40 && Math.abs(it.z - h.z) < 26) {
      it.gone = true; h.hp = Math.min(h.maxHp, h.hp + (ITEMS[it.kind].heal ?? 20) * (this.assist ? 1.25 : 1)); if (it.kind === 'kopi') h.meter = Math.min(METER_MAX, h.meter + 60); h.buff = 8;
      this.setHero(h, 'eat'); this.stats.foodEaten++; this.fx.push({ k: 'snd', s: 'eat' });
    }
    if (h.carry) { const c = h.carry; c.x = h.x + h.face * 10; c.z = h.z; c.h = 120; c.st = 'carried'; c.face = -h.face; }
  }
  land(h: Hero) {
    if (h.st === 'atk' && h.move && MOVES[h.move].dur > 5) {
      if (h.move === 'enzo-air') { this.shake = 6; this.fx.push({ k: 'dust', x: h.x, z: h.z }); }
      this.setHero(h, 'idle');
    } else if (h.st === 'jump') this.setHero(h, 'idle');
    this.fx.push({ k: 'snd', s: 'land' });
  }
  attack(h: Hero, inp: Input, chained = false) {
    if (h.hold) {
      const d = ITEMS[h.hold.kind];
      if (d.cls === 'throw') { this.throwItem(h); return; }
      h.move = d.cls === 'heavy' ? 'swing-heavy' : 'swing-light';
    } else if (h.carry) { this.throwFoe(h); return; }
    else if (h.running) h.move = `${h.id}-dash`;
    else {
      if (!chained || h.comboT <= 0) h.combo = 0;
      h.move = COMBO[h.id][Math.min(h.combo, 2)];
      h.combo = (h.combo + 1) % 3; h.comboT = 0.6;
    }
    h.st = 'atk'; h.t = 0; h.hit = new Set(); h.anim = MOVES[h.move].anim; h.animT = 0; h.running = false;
    if (inp.mx) h.face = sgn(inp.mx);
    this.fx.push({ k: 'snd', s: 'swing' });
  }
  special(h: Hero) {
    const mate = this.heroes.find((o) => o !== h)!;
    // a team-up: both heroes close and both pressing Special within half a second (one bar each)
    if (mate.teamReq > 0 && Math.abs(mate.x - h.x) < 260 && Math.abs(mate.z - h.z) < 120 && h.meter >= 100 && mate.st !== 'out') {
      for (const o of [h, mate]) { o.move = 'team'; o.st = 'atk'; o.t = 0; o.hit = new Set(); o.anim = 'team'; o.animT = 0; o.inv = 1.6; o.hold = null; }
      h.meter -= 100; // the partner already paid a bar for the special this replaces
      this.stats.teamups++; this.fx.push({ k: 'banner', text: 'Kopi Peng Combo!', t: 1.6 }); this.fx.push({ k: 'snd', s: 'team' }); this.shake = 12;
      return;
    }
    h.teamReq = 0.5;
    h.meter -= 100; h.move = `${h.id}-special`; h.st = 'atk'; h.t = 0; h.hit = new Set(); h.anim = MOVES[h.move].anim; h.animT = 0; h.inv = 0.6;
    this.stats.specials++; this.fx.push({ k: 'snd', s: 'special' });
  }
  stepTeam() { /* team-up timing lives in special(); kept for clarity */ }
  grabAction(h: Hero) {
    if (h.hold) { this.throwItem(h); return; }
    if (h.carry) { this.throwFoe(h); return; }
    // nearest item on the floor
    let best: Item | null = null, bd = 1e9;
    for (const it of this.items) if (!it.gone && !it.held && !it.flying && ITEMS[it.kind].cls !== 'food') { const d = Math.abs(it.x - h.x) + Math.abs(it.z - h.z) * 1.5; if (d < 90 && d < bd) { bd = d; best = it; } }
    if (best) { best.held = true; h.hold = best; this.setHero(h, 'pick'); this.fx.push({ k: 'snd', s: 'pick' }); return; }
    // Enzo lifts a stunned or downed small foe
    if (h.id === 'enzo') {
      for (const f of this.liveFoes()) if (!f.boss && (f.kind === 'rat' || f.kind === 'macaque' || f.kind === 'toad') && (f.st === 'stun' || f.st === 'hurt' || f.st === 'down' || f.st === 'cough') && Math.abs(f.x - h.x) < 90 && Math.abs(f.z - h.z) < 34) {
        h.carry = f; f.st = 'carried'; f.wrapping = null; this.setHero(h, 'pick'); this.fx.push({ k: 'snd', s: 'pick' }); return;
      }
    }
    // nothing to grab: a quick shove
    h.move = `${h.id}-jab`; h.st = 'atk'; h.t = 0; h.hit = new Set(); h.anim = 'jab';
  }
  throwItem(h: Hero) {
    const it = h.hold!; h.hold = null;
    it.held = false; it.flying = h; it.hit = new Set(); it.x = h.x + h.face * 40; it.z = h.z; it.h = 90;
    it.vx = h.face * 820; it.vh = ITEMS[it.kind].slide ? 0 : 180; it.vz = 0; it.spin = h.face * 18;
    if (ITEMS[it.kind].slide) { it.h = 6; it.slide = 1; }
    this.setHero(h, 'throw'); this.fx.push({ k: 'snd', s: 'throw' });
  }
  throwFoe(h: Hero) {
    const f = h.carry!; h.carry = null;
    f.st = 'thrown'; f.t = 0; f.thrownBy = h; f.x = h.x + h.face * 30; f.h = 110; f.vx = h.face * 760; f.vh = 260; f.hit = new Set();
    this.setHero(h, 'throw'); this.fx.push({ k: 'snd', s: 'throw' });
  }
  /** a hero's attack hitbox: every foe in reach in front (or both sides) at a similar depth, once per move */
  hitbox(h: Hero, mv: Move) {
    let dmgK = (h.buff > 0 ? 1.25 : 1) * (h.ctrl === 'bot' ? 0.7 : 1);
    const onBeat = this.stage.twist === 'liondance' && Math.min(this.beatT, 0.6 - this.beatT) < 0.1;
    if (onBeat) dmgK *= 1.6;
    if (h.hold && mv === MOVES['swing-heavy'] || h.hold && mv === MOVES['swing-light']) dmgK *= ITEMS[h.hold!.kind].dmg / mv.dmg;
    for (const f of this.foes) {
      if (f.dead || f.gone || h.hit.has(f) || f.inv > 0 || f.st === 'carried' || f.st === 'ride' && !mv.low) continue;
      if (f.st === 'down' && !mv.low) continue;
      const rad = f.boss ? BD[f.kind as BossKind].rad : FD[f.kind as FoeKind].rad;
      const dx = (f.x - h.x) * (mv.both ? sgn(f.x - h.x) : h.face);
      if (dx < -rad * 0.6 || dx > mv.reach + rad) continue;
      if (Math.abs(f.z - h.z) > mv.zTol + (f.boss ? 30 : 0)) continue;
      const fh = f.h; const hh = h.h;
      if (Math.abs(fh - hh) > (f.boss ? 140 : 90)) continue;
      // the rat's low charge slips under jabs
      if (f.kind === 'rat' && f.st === 'act' && !mv.low) continue;
      h.hit.add(f);
      const dmg = mv.dmg * dmgK;
      this.hurtFoe(f, dmg, mv.both ? sgn(f.x - h.x) : h.face, h, mv);
      const sfx = h.hold ? ITEMS[h.hold.kind].sfx : mv.sfx;
      this.fx.push({ k: 'hit', x: f.x, z: f.z, h: fh + 60, sfx: (mv.down || onBeat || h.hold) ? sfx : (this.rng() < 0.35 ? sfx : null), big: !!mv.down || onBeat, beat: onBeat });
      if (onBeat) this.stats.beats++;
      this.stop = Math.max(this.stop, mv.stop); if (mv.down) this.shake = Math.max(this.shake, 4);
      h.meter = Math.min(METER_MAX, h.meter + dmg * 0.9);
      h.hits++; this.stats.hits++;
      if (h.hold && (mv === MOVES['swing-heavy'] || mv === MOVES['swing-light'])) { h.hold.uses--; if (h.hold.uses <= 0) { h.hold.gone = true; h.hold = null; this.fx.push({ k: 'snd', s: 'break' }); } }
    }
    // tables break and drop food
    for (const tb of this.tables) if (!tb.broken && Math.abs(tb.x - h.x - h.face * 60) < 80 && Math.abs(tb.z - h.z) < 40) {
      tb.broken = true; const it = this.mkItem(this.rng() < 0.5 ? 'plate' : 'kopi', tb.x, tb.z + 14); this.items.push(it); this.fx.push({ k: 'hit', x: tb.x, z: tb.z, h: 40, sfx: 'KRAK', big: false });
    }
  }
  hurtFoe(f: Foe, dmg: number, dir: number, by: Hero | null, mv: Move) {
    if (f.dead) return;
    f.hp -= dmg; f.flash = 0.12; f.hitsTaken++;
    if (by) { by.score += Math.round(dmg * 10); this.stats.score += Math.round(dmg * 10); this.comboTick(by); }
    if (f.wrapping) { f.atkN++; if (f.atkN >= 3 || f.hp <= 0) { const w = f.wrapping; f.wrapping = null; w.wrappedBy = null; this.setHero(w, 'idle'); w.inv = 1; f.atkN = 0; } }
    if (f.rider && f.hitsTaken >= 1) this.dismount(f);
    if (f.mount) { const m = f.mount; m.rider = null; f.mount = null; }
    if (f.arm && (mv.down || this.rng() < 0.3)) { const it = f.arm; f.arm = null; it.held = false; it.x = f.x; it.z = f.z; it.h = 60; it.vh = 300; it.vx = dir * 120; }
    if (f.boss) {
      if (f.hp <= 0) { this.killFoe(f, dir); return; }
      if (mv.down && f.pat === 'stunned') { f.vx = dir * 120; }
      return;
    }
    const heavy = FD[f.kind as FoeKind].heavy;
    if (f.hp <= 0 || mv.down || (heavy && f.hitsTaken % 4 === 0 && mv.dmg >= 10)) {
      f.st = 'air'; f.t = 0; f.vx = dir * mv.kb * (heavy ? 0.6 : 1); f.vh = (mv.lift ?? 300) * (heavy ? 0.6 : 1); f.h = Math.max(f.h, 1); f.face = -dir;
    } else if (!heavy || mv.dmg >= 12) {
      f.st = 'hurt'; f.t = -mv.stun * 0.5; f.vx = dir * mv.kb; f.face = -dir;
    }
    if (f.kind === 'roach' && f.hp <= 0) { this.killFoe(f, dir); }
  }
  comboTick(h: Hero) {
    const c = this.combo; if (this.t - c.last > 1.4 || c.who !== h.id) c.n = 0;
    c.n++; c.last = this.t; c.who = h.id; if (c.n > this.stats.bestCombo) this.stats.bestCombo = c.n;
  }
  combo = { n: 0, last: -9, who: '' as string };
  killFoe(f: Foe, dir: number) {
    if (f.dead) return;
    f.dead = true; f.hp = 0; f.st = 'air'; f.vh = 380; f.vx = dir * 260; f.h = Math.max(f.h, 1); f.fade = 0;
    if (f.wrapping) { const w = f.wrapping; f.wrapping = null; w.wrappedBy = null; this.setHero(w, 'idle'); }
    if (f.rider) this.dismount(f);
    const pts = f.boss ? BD[f.kind as BossKind].score : FD[f.kind as FoeKind].score;
    this.stats.score += pts; this.stats.kos++;
    this.fx.push({ k: 'ko', x: f.x, z: f.z });
    if (f.boss) { this.fx.push({ k: 'hit', x: f.x, z: f.z, h: 120, sfx: 'KO', big: true }); this.shake = 14; this.stop = 0.4; }
  }
  dismount(m: Foe) {
    const r = m.rider; if (!r) return; m.rider = null; r.mount = null;
    r.st = 'air'; r.t = 0; r.vh = 520; r.vx = (this.rng() < 0.5 ? -1 : 1) * 160; r.h = Math.max(r.h, 60);
    this.fx.push({ k: 'snd', s: 'hop' });
  }
  hurtHero(h: Hero, dmg: number, dir: number, down: boolean, by: Foe | null) {
    if (h.inv > 0 || h.st === 'out' || h.st === 'down' && h.h <= 0) return;
    if (h.st === 'atk' && h.move === 'team') return;
    dmg *= this.assist ? 0.7 : 1;
    h.hp -= dmg; h.running = false;
    if (h.carry) { const c = h.carry; h.carry = null; c.st = 'air'; c.vh = 200; c.h = 60; }
    if (h.hold && (down || this.rng() < 0.2)) { const it = h.hold; h.hold = null; it.held = false; it.x = h.x; it.z = h.z; it.h = 60; it.vh = 260; it.vx = -dir * 100; }
    this.combo.n = 0;
    if (h.hp <= 0 || down) { h.st = 'down'; h.t = 0; h.vh = 380; h.h = Math.max(1, h.h); h.vx = dir * 220; h.anim = 'down'; h.animT = 0; h.face = -dir; h.move = null; }
    else { this.setHero(h, 'hurt'); h.vx = dir * 120; h.anim = 'hurt'; h.animT = 0; h.face = -dir; }
    h.inv = Math.max(h.inv, 0.25);
    this.fx.push({ k: 'snd', s: 'hurt' });
    void by;
  }
  knockOut(h: Hero) {
    h.hp = 0; h.st = 'out'; h.t = 0; h.outT = 8; h.anim = 'down'; h.hold = null; h.carry = null; this.stats.outs++;
    if (h.wrappedBy) { h.wrappedBy.wrapping = null; h.wrappedBy = null; }
    this.fx.push({ k: 'banner', text: `${h.id === 'dora' ? 'Dora' : 'Enzo'} is down!`, sub: 'Back in 8 seconds', t: 1.6 });
  }

  // ─────────────────────────────────────── items and shots
  stepItems() {
    for (const it of this.items) {
      if (it.gone || it.held) continue;
      if (it.flying || it.h > 0 || it.vh !== 0) {
        if (!it.slide) { it.vh -= GRAV * 0.7 * DT; it.h += it.vh * DT; }
        it.x += it.vx * DT; it.z += it.vz * DT;
        if (it.slide) { it.vx *= 0.995; if (Math.abs(it.vx) < 60) { it.slide = 0; it.flying = null; } }
        if (it.flying) {
          const thrower = it.flying; const d = ITEMS[it.kind];
          const foeThrow = (thrower as Foe).kind !== undefined && !(thrower as Hero).id;
          if (!foeThrow) {
            for (const f of this.foes) if (!f.dead && !f.gone && !it.hit.has(f) && f.st !== 'carried' && Math.abs(f.x - it.x) < 50 + (f.boss ? 40 : 0) && Math.abs(f.z - it.z) < 36 && Math.abs(f.h + 50 - it.h) < 110) {
              it.hit.add(f); this.hurtFoe(f, d.throwDmg * (this.assist ? 1.1 : 1), sgn(it.vx), thrower as Hero, MOVES['dora-kick']);
              this.fx.push({ k: 'hit', x: f.x, z: f.z, h: f.h + 60, sfx: d.sfx, big: true }); this.stop = Math.max(this.stop, 0.06);
              if (!it.slide) { it.vx *= -0.3; it.vh = 220; }
              it.uses--;
            }
          } else {
            for (const h of this.heroes) if (!it.hit.has(h) && Math.abs(h.x - it.x) < 46 && Math.abs(h.z - it.z) < 34 && Math.abs(h.h + 60 - it.h) < 100) { it.hit.add(h); this.hurtHero(h, d.throwDmg * 0.6, sgn(it.vx), false, null); it.vx *= -0.3; }
          }
        }
        if (it.h <= 0 && !it.slide) { it.h = 0; it.vh = 0; it.vx *= 0.3; it.flying = null; if (Math.abs(it.vx) < 5) it.vx = 0; if (it.uses <= 0) it.gone = true; }
        if (it.x < this.camX - 300 || it.x > this.camX + VIEW_W + 300) it.gone = true;
      }
      it.z = clamp(it.z, 4, DEPTH - 4);
    }
    this.items = this.items.filter((i) => !i.gone);
  }
  stepShots() {
    for (const s of this.shots) {
      s.t += DT;
      if (s.kind === 'satay') {
        s.x += s.vx * DT;
        for (const h of this.heroes) if (!s.hit.has(h) && h.st !== 'out' && Math.abs(h.x - s.x) < 34 && Math.abs(h.z - s.z) < 22 && h.h < 70) { s.hit.add(h); this.hurtHero(h, 7, sgn(s.vx), false, s.owner); }
        if (s.t > 3) s.done = true;
      }
    }
    this.shots = this.shots.filter((s) => !s.done);
  }

  // ─────────────────────────────────────── hawkers
  stepHawkers() {
    for (const k of this.hawkers) {
      k.t += DT; k.cd -= DT;
      if (k.act !== 'stand' && k.t > 1.2) { k.act = 'stand'; }
      if (!this.locked || k.cd > 0) continue;
      const live = this.liveFoes().filter((f) => !f.boss);
      if (k.k === 'satay' && live.length > 0) {
        // fan a cloud of satay smoke over the floor in front: foes cough, heroes recover a little
        const tgt = live[Math.floor(this.rng() * live.length)];
        this.smoke.push({ x: tgt.x, z: tgt.z, t: 4.5, r: 110 }); k.act = 'fan'; k.t = 0; k.cd = 10 + this.rng() * 4;
        this.fx.push({ k: 'smoke', x: tgt.x, z: tgt.z }); this.fx.push({ k: 'say', who: 'Satay Uncle', text: 'Smoke them out!' });
      }
      if (k.k === 'drinks') {
        const low = this.heroes.filter((h) => h.st !== 'out' && h.hp < h.maxHp * 0.55).sort((a, b) => a.hp - b.hp)[0];
        const empty = this.heroes.find((h) => h.st !== 'out' && !h.hold) ;
        if (low) { const it = this.mkItem('kopi', k.x, 0); it.vz = 0; it.slide = 0; it.x = k.x; it.z = 4; it.vx = 0; it.h = 0;
          // slide the glass along the floor to land near the hero
          it.x = clamp(low.x + (this.rng() - 0.5) * 120, this.camX + 60, this.camX + VIEW_W - 60); it.z = clamp(low.z - 30, 10, DEPTH - 10); it.h = 260; it.vh = 0;
          this.items.push(it); k.act = 'slide'; k.t = 0; k.cd = 14; this.fx.push({ k: 'say', who: 'Drinks Auntie', text: 'Kopi peng! On the house!' }); }
        else if (empty && live.length >= 3) { const it = this.mkItem(this.rng() < 0.5 ? 'stool' : 'tray', clamp(empty.x + empty.face * 80, this.camX + 60, this.camX + VIEW_W - 60), clamp(empty.z, 10, DEPTH - 10), 300); this.items.push(it); k.act = 'throw'; k.t = 0; k.cd = 12; this.fx.push({ k: 'say', who: 'Drinks Auntie', text: 'Catch!' }); }
      }
      if (k.k === 'noodle') {
        const near = live.filter((f) => Math.abs(f.x - k.x) < 420);
        if (near.length >= 3) { for (const f of near) if (f.st !== 'air' && f.st !== 'down' && !f.boss) { f.st = 'stun'; f.t = 0; f.wrapping = null; } k.act = 'bang'; k.t = 0; k.cd = 15; this.shake = 5;
          this.fx.push({ k: 'hit', x: k.x, z: 0, h: 120, sfx: 'CLANG', big: true }); this.fx.push({ k: 'say', who: 'Noodle Uncle', text: 'Oi! Not in my kitchen!' }); }
      }
    }
    for (const s of this.smoke) {
      s.t -= DT;
      for (const f of this.liveFoes()) if (!f.boss && Math.hypot(f.x - s.x, (f.z - s.z) * 2) < s.r && f.h < 40 && (f.st === 'walk' || f.st === 'idle' || f.st === 'wind')) { f.st = 'cough'; f.t = 0; }
      for (const h of this.heroes) if (h.st !== 'out' && Math.hypot(h.x - s.x, (h.z - s.z) * 2) < s.r) h.hp = Math.min(h.maxHp, h.hp + 3 * DT);
    }
    this.smoke = this.smoke.filter((s) => s.t > 0);
  }

  // ─────────────────────────────────────── camera
  stepCamera() {
    if (this.go > 0) this.go -= DT;
    if (this.locked) { this.camX += (this.lockX - this.camX) * 0.1; return; }
    const alive = this.heroes.filter((h) => h.st !== 'out');
    const lead = Math.max(...alive.map((h) => h.x));
    const next = (this.sceneIdx + 1) * PANEL_W;
    const want = clamp(lead - VIEW_W * 0.55, this.camX, next);
    this.camX += (want - this.camX) * 0.12;
    // drag the trailing hero along
    for (const h of this.heroes) if (h.x < this.camX + 40) h.x = this.camX + 40;
    if (this.camX >= next - 2 && this.sceneIdx + 1 < this.stage.scenes.length) { this.camX = next; this.enterScene(this.sceneIdx + 1); }
  }

  // ─────────────────────────────────────── foes
  pickTarget(f: Foe): Hero | null {
    const alive = this.heroes.filter((h) => h.st !== 'out');
    if (!alive.length) return null;
    // spread out: prefer the hero fewer foes are already after, then the nearer one
    let best = alive[0], bs = 1e9;
    for (const h of alive) { const n = this.foes.filter((o) => o !== f && !o.dead && o.target === h).length; const s = n * 260 + Math.abs(h.x - f.x) + Math.abs(h.z - f.z); if (s < bs) { bs = s; best = h; } }
    return best;
  }
  attackers(h: Hero) { return this.foes.filter((f) => !f.dead && f.target === h && (f.st === 'wind' || f.st === 'act')).length; }
  /** steps a foe; a new anim starts from its first frame */
  stepFoe(f: Foe) { const a0 = f.anim; this.stepFoeBody(f); if (f.anim !== a0) f.animT = 0; }
  stepFoeBody(f: Foe) {
    f.t += DT; f.animT += DT; if (f.inv > 0) f.inv -= DT; if (f.flash > 0) f.flash -= DT; if (f.enrage > 0) f.enrage -= DT; f.cd -= DT;
    if (f.dead) {
      f.fade += DT; this.physFoe(f, true);
      if (f.fade > (f.boss ? 2.5 : 1.4)) f.gone = true; return;
    }
    if (f.boss) { this.stepBoss(f); return; }
    const D = FD[f.kind as FoeKind];
    const sk = (this.stage.twist === 'monsoon' && !D.fly && f.kind !== 'toad' ? 1 - 0.35 * this.water : f.kind === 'toad' && this.stage.twist === 'monsoon' ? 1.2 : 1) * (f.enrage > 0 ? 1.3 : 1);
    if (f.st === 'carried') { f.anim = 'hurt'; return; }
    if (f.st === 'ride') {
      const m = f.mount; if (!m || m.dead) { f.mount = null; f.st = 'air'; f.vh = 300; f.h = 40; return; }
      f.x = m.x - m.face * 10; f.z = m.z; f.h = m.kind === 'boar' ? 70 : 46; f.face = m.face; f.anim = 'ride';
      // jump off when the mount is close to a hero
      const t = m.target; if (t && Math.abs(t.x - m.x) < 230 && Math.abs(t.z - m.z) < 60 && this.rng() < DT * 1.5) { this.dismount(m); f.vx = sgn(t.x - f.x) * 280; f.target = t; }
      return;
    }
    if (f.st === 'thrown') {
      f.anim = 'air'; f.vh -= GRAV * DT; f.h += f.vh * DT; f.x += f.vx * DT;
      for (const o of this.foes) if (o !== f && !o.dead && !o.gone && !f.hit.has(o) && o.st !== 'carried' && Math.abs(o.x - f.x) < 60 && Math.abs(o.z - f.z) < 40 && o.h < 120) {
        f.hit.add(o); this.hurtFoe(o, 18, sgn(f.vx), f.thrownBy, MOVES['enzo-belly']); this.fx.push({ k: 'hit', x: o.x, z: o.z, h: 60, sfx: 'WHAM', big: true });
      }
      if (f.h <= 0) { f.h = 0; this.hurtFoe(f, 14, sgn(f.vx), f.thrownBy, MOVES['enzo-belly']); if (!f.dead) { f.st = 'down'; f.t = 0; f.vx *= 0.3; } this.shake = 5; this.fx.push({ k: 'dust', x: f.x, z: f.z }); }
      return;
    }
    if (f.st === 'air') {
      f.anim = 'air'; this.physFoe(f, false);
      // knocked into an open train door: out of the train
      if (this.doors > 0 && f.z < 34 && this.doorXs().some((dx) => Math.abs(f.x - (this.lockX + dx)) < 100)) { f.dead = true; f.gone = true; this.stats.kos++; this.stats.score += FD[f.kind as FoeKind].score * 2; this.fx.push({ k: 'out', x: f.x, z: f.z }); return; }
      if (f.h <= 0 && f.vh <= 0) { f.h = 0; f.vh = 0; if (f.hp <= 0) { this.killFoe(f, sgn(f.vx || 1)); return; } f.st = 'down'; f.t = 0; f.vx *= 0.4; this.fx.push({ k: 'dust', x: f.x, z: f.z }); }
      return;
    }
    if (f.st === 'down') { f.anim = 'down'; f.vx *= 0.85; f.x += f.vx * DT; if (f.t > 0.8) { f.st = 'getup'; f.t = 0; f.inv = 0.5; } return; }
    if (f.st === 'getup') { f.anim = 'getup'; if (f.t > 0.4) { f.st = 'walk'; f.t = 0; } return; }
    if (f.st === 'hurt') { f.anim = 'hurt'; f.vx *= 0.82; f.x += f.vx * DT; if (f.t > 0.32) { f.st = 'walk'; f.t = 0; f.cd = Math.max(f.cd, 0.4); } return; }
    if (f.st === 'stun' || f.st === 'cough') { f.anim = f.st; f.vx *= 0.8; f.x += f.vx * DT; if (f.t > (f.st === 'cough' ? 1.6 : 1.2)) { f.st = 'walk'; f.t = 0; } return; }
    if (f.st === 'eat') { f.anim = 'eat'; if (f.t > 1.2) { f.st = 'walk'; f.t = 0; f.enrage = 10; this.fx.push({ k: 'say', who: 'Macaque', text: 'Ooh ooh! SATAY!' }); } return; }
    if (f.st === 'enter') {
      f.anim = 'walk';
      if (f.kind === 'python') { f.st = 'walk'; f.t = 0; return; }
      const cx = clamp(f.x, this.camX + 60, this.camX + VIEW_W - 60); f.x += sgn(cx - f.x) * Math.min(Math.abs(cx - f.x), D.spd * 1.2 * DT);
      if (f.vz) { f.z += f.vz * DT; if (f.z > 40) f.vz = 0; }
      if (Math.abs(cx - f.x) < 2 && !f.vz) { f.st = 'walk'; f.t = 0; }
      return;
    }
    if (!f.target || f.target.st === 'out' || this.rng() < DT * 0.2) f.target = this.pickTarget(f);
    const T = f.target; if (!T) { f.anim = 'idle'; return; }
    switch (f.kind as FoeKind) {
      case 'roach': this.stepRoach(f, D); return;
      case 'mynah': this.stepMynah(f, T, D, sk); return;
      case 'python': this.stepPython(f, T, D); return;
      case 'toad': this.stepToad(f, T, D, sk); return;
      case 'boar': this.stepBoar(f, T, D, sk); return;
      default: this.stepWalker(f, T, D, sk);
    }
  }
  physFoe(f: Foe, dying: boolean) {
    f.vh -= GRAV * DT; f.h += f.vh * DT; f.x += f.vx * DT; f.z += f.vz * DT;
    if (f.h <= 0) { f.h = 0; f.vh = dying ? 0 : f.vh; f.vx *= 0.9; }
    f.z = clamp(f.z, 4, DEPTH - 4);
    if (!dying) f.x = clamp(f.x, this.camX - 40, this.camX + VIEW_W + 40);
  }
  approach(f: Foe, tx: number, tz: number, spd: number, zs: number) {
    const dx = tx - f.x, dz = tz - f.z;
    f.x += clamp(dx, -spd * DT, spd * DT); f.z += clamp(dz, -zs * DT, zs * DT);
    f.z = clamp(f.z, 4, DEPTH - 4);
    return Math.abs(dx) < 8 && Math.abs(dz) < 8;
  }
  /** rats, macaques and monitors: walk to a spot beside the target, wind up, strike, recover */
  stepWalker(f: Foe, T: Hero, D: FoeDef, sk: number) {
    // macaques go for food and loose weapons first
    if (f.kind === 'macaque' && (f.st === 'walk' || f.st === 'idle')) {
      const food = this.items.find((i) => !i.gone && !i.held && !i.flying && ITEMS[i.kind].cls === 'food' && Math.abs(i.x - f.x) < 420);
      if (food) { f.anim = 'run'; if (this.approach(f, food.x, food.z, D.spd * 1.3 * sk, D.zs)) { food.gone = true; f.st = 'eat'; f.t = 0; } else f.face = sgn(food.x - f.x); return; }
      if (!f.arm) { const loose = this.items.find((i) => !i.gone && !i.held && !i.flying && ITEMS[i.kind].cls !== 'food' && Math.abs(i.x - f.x) < 300);
        if (loose) { f.anim = 'run'; if (this.approach(f, loose.x, loose.z, D.spd * 1.2 * sk, D.zs)) { loose.held = true; f.arm = loose; } else f.face = sgn(loose.x - f.x); return; } }
    }
    const side = f.x < T.x ? -1 : 1;
    const reach = f.arm ? 100 : D.reach;
    const want = T.x + side * reach * 0.8;
    if (f.st === 'walk' || f.st === 'idle') {
      const busy = this.attackers(T) >= 2;
      const hold = busy || f.cd > 0;
      const tx = hold ? T.x + side * (reach + 90 + (f.id % 3) * 40) : want;
      const arrived = this.approach(f, tx, T.z + (hold ? ((f.id % 2) ? 40 : -40) : 0), D.spd * sk * (hold ? 0.6 : 1), D.zs * sk);
      f.face = sgn(T.x - f.x); f.anim = arrived ? 'idle' : 'walk';
      // macaques leap in from mid range
      if (f.kind === 'macaque' && !hold && Math.abs(T.x - f.x) > 160 && Math.abs(T.x - f.x) < 280 && Math.abs(T.z - f.z) < 40 && this.rng() < DT * 1.2) {
        f.st = 'act'; f.t = 0; f.pat = 'leap'; f.vh = 620; f.h = 1; f.vx = (T.x - f.x) * 1.6; f.hit = new Set(); f.anim = 'leap'; return;
      }
      if (!hold && Math.abs(T.x - f.x) <= reach - 6 && Math.abs(T.z - f.z) < 22 && T.h < 40) { f.st = 'wind'; f.t = 0; f.anim = 'wind'; f.pat = f.kind === 'monitor' && this.rng() < 0.5 ? 'sweep' : 'strike'; }
      return;
    }
    if (f.st === 'wind') {
      f.anim = f.pat === 'sweep' ? 'windsweep' : 'wind';
      const w = D.wind * (this.dark > 0 ? 1.5 : 1) * (f.enrage > 0 ? 0.7 : 1);
      if (f.t >= w) { f.st = 'act'; f.t = 0; f.hit = new Set(); f.anim = f.pat === 'sweep' ? 'sweep' : 'strike'; if (f.kind === 'rat') f.vx = f.face * 420; }
      return;
    }
    if (f.st === 'act') {
      if (f.pat === 'leap') {
        f.vh -= GRAV * DT; f.h += f.vh * DT; f.x += f.vx * DT;
        this.foeHit(f, 46, 40, D.dmg, false);
        if (f.h <= 0) { f.h = 0; f.st = 'rec'; f.t = 0; f.cd = D.cd; }
        return;
      }
      if (f.kind === 'rat') { f.x += f.vx * DT; f.vx *= 0.96; }
      const reach = (f.pat === 'sweep' ? 150 : f.arm ? 110 : D.reach) + 18;
      if (f.kind !== 'rat' && f.t < D.act * 0.5) f.x += f.face * 160 * DT;
      const dmg = (f.arm ? ITEMS[f.arm.kind].dmg * 0.6 : D.dmg) * (f.enrage > 0 ? 1.5 : 1);
      this.foeHit(f, reach, 28, dmg, f.pat === 'sweep' || !!D.down || (!!f.arm && ITEMS[f.arm.kind].cls === 'heavy'), f.pat === 'sweep');
      if (f.t >= D.act) { f.st = 'rec'; f.t = 0; f.cd = D.cd * (0.8 + this.rng() * 0.5); if (f.arm) { f.arm.uses--; if (f.arm.uses <= 0) { f.arm.gone = true; f.arm = null; } } }
      return;
    }
    if (f.st === 'rec') { f.anim = 'rec'; f.vx *= 0.8; f.x += f.vx * DT; if (f.t >= D.rec) { f.st = 'walk'; f.t = 0; } }
  }
  /** a foe's hitbox against the heroes */
  foeHit(f: Foe, reach: number, zTol: number, dmg: number, down: boolean, both = false, hTol = 80) {
    for (const h of this.heroes) {
      if (f.hit.has(h) || h.st === 'out' || h.inv > 0) continue;
      const dx = (h.x - f.x) * (both ? sgn(h.x - f.x) : f.face);
      if (dx < -20 || dx > reach) continue;
      if (Math.abs(h.z - f.z) > zTol) continue;
      if (Math.abs(h.h - f.h) > hTol) continue;
      f.hit.add(h); this.hurtHero(h, dmg, sgn(h.x - f.x), down, f);
      this.fx.push({ k: 'hit', x: h.x, z: h.z, h: h.h + 70, sfx: down ? 'WHAM' : null, big: down });
    }
  }
  stepRoach(f: Foe, D: FoeDef) {
    // flies at whoever is nearest, hero or foe, and makes them flinch; gives up after a while
    f.anim = 'fly';
    if (f.t > 14) { f.vx = sgn(f.x - (this.camX + VIEW_W / 2)) * 400; f.x += f.vx * DT; if (f.x < this.camX - 100 || f.x > this.camX + VIEW_W + 100) f.gone = true; return; }
    let tgt: { x: number; z: number; h: number } | null = null, bd = 1e9;
    for (const h of this.heroes) if (h.st !== 'out') { const d = Math.abs(h.x - f.x) + Math.abs(h.z - f.z); if (d < bd) { bd = d; tgt = h; } }
    for (const o of this.foes) if (o !== f && !o.dead && o.kind !== 'roach' && !o.boss) { const d = Math.abs(o.x - f.x) + Math.abs(o.z - f.z) + 60; if (d < bd) { bd = d; tgt = o; } }
    if (!tgt) return;
    const wob = Math.sin(this.t * 9 + f.id) * 80;
    f.x += clamp(tgt.x - f.x, -D.spd * DT, D.spd * DT) + Math.cos(this.t * 7 + f.id) * 2;
    f.z += clamp(tgt.z - f.z + wob * 0.3, -D.zs * DT, D.zs * DT); f.z = clamp(f.z, 4, DEPTH - 4);
    f.h = 70 + Math.sin(this.t * 5 + f.id) * 30; f.face = sgn(tgt.x - f.x);
    if (f.cd <= 0 && Math.abs(tgt.x - f.x) < 34 && Math.abs(tgt.z - f.z) < 24) {
      f.cd = 1.4;
      if ((tgt as Hero).id) { const h = tgt as Hero; if (h.inv <= 0 && (h.st === 'idle' || h.st === 'walk' || h.st === 'run')) { this.setHero(h, 'stun'); h.t = 0.35; this.fx.push({ k: 'say', who: h.id === 'dora' ? 'Dora' : 'Enzo', text: 'EEK! Get it off!' }); } }
      else { const o = tgt as Foe; if (o.st === 'walk' || o.st === 'idle' || o.st === 'wind') { o.st = 'stun'; o.t = 0.4; } }
      f.x += (this.rng() - 0.5) * 120;
    }
  }
  stepMynah(f: Foe, T: Hero, D: FoeDef, sk: number) {
    // carries what it stole to a macaque, else snatches from a hero, else pecks
    f.anim = f.st === 'act' ? 'swoop' : 'fly';
    if (f.arm) {
      const mac = this.liveFoes().find((o) => o.kind === 'macaque' && !o.arm && o.st !== 'down' && o.st !== 'air');
      const tx = mac ? mac.x : f.x + f.face * 200, tz = mac ? mac.z : f.z;
      this.approach(f, tx, tz, D.spd * sk, D.zs); f.h += (150 - f.h) * 0.05; f.face = sgn(tx - f.x) || f.face;
      f.arm.x = f.x; f.arm.z = f.z; f.arm.h = f.h - 30;
      if (mac && Math.abs(mac.x - f.x) < 20 && Math.abs(mac.z - f.z) < 14) { mac.arm = f.arm; f.arm = null; this.fx.push({ k: 'say', who: 'Macaque', text: 'Ooh! A present!' }); this.fx.push({ k: 'snd', s: 'drop' }); }
      else if (!mac && f.t > 4) { const it = f.arm; f.arm = null; it.held = false; it.h = f.h; it.vh = 0; it.x = f.x; it.z = f.z; }
      return;
    }
    if (f.st === 'act') {
      f.h += (50 - f.h) * 0.2; this.approach(f, T.x, T.z, D.spd * 1.6, D.zs * 1.4);
      if (Math.abs(T.x - f.x) < 40 && Math.abs(T.z - f.z) < 26 && T.st !== 'out') {
        if (T.hold && T.inv <= 0) { const it = T.hold; T.hold = null; f.arm = it; it.held = true; this.fx.push({ k: 'say', who: T.id === 'dora' ? 'Dora' : 'Enzo', text: 'Hey! Give that back!' }); this.fx.push({ k: 'snd', s: 'snatch' }); f.t = 0; f.st = 'walk'; }
        else { f.hit = new Set(); this.foeHit(f, 40, 26, D.dmg, false, true, 120); f.st = 'rec'; f.t = 0; f.cd = D.cd; }
      }
      if (f.t > 1.2) { f.st = 'rec'; f.t = 0; f.cd = D.cd; }
      return;
    }
    const tx = T.x - sgn(T.x - f.x) * 140, tz = T.z;
    this.approach(f, tx, tz, D.spd * sk * 0.7, D.zs * 0.7); f.h += (150 + Math.sin(this.t * 3 + f.id) * 20 - f.h) * 0.05; f.face = sgn(T.x - f.x);
    if (f.st === 'rec' && f.t > 0.6) { f.st = 'walk'; f.t = 0; }
    if (f.cd <= 0 && f.st === 'walk' && Math.abs(T.z - f.z) < 40) { f.st = 'act'; f.t = 0; }
  }
  stepPython(f: Foe, T: Hero, D: FoeDef) {
    // hangs from the rail above: slides over the target, lowers, wraps; hittable when low (or by jump attacks)
    if (f.wrapping) {
      const w = f.wrapping; f.anim = 'wrap'; f.x += (w.x - f.x) * 0.3; f.z = w.z; f.h += (40 - f.h) * 0.2;
      if (w.st !== 'wrapped') { f.wrapping = null; f.st = 'rec'; f.t = 0; }
      if (f.t > 6) { w.wrappedBy = null; this.setHero(w, 'idle'); f.wrapping = null; f.st = 'rec'; f.t = 0; f.cd = D.cd; }
      return;
    }
    if (f.st === 'wind') { f.anim = 'lower'; f.h += (36 - f.h) * 0.12; f.x += clamp(T.x - f.x, -260 * DT, 260 * DT); if (f.t > D.wind) { f.st = 'act'; f.t = 0; f.anim = 'strike'; } return; }
    if (f.st === 'act') {
      f.anim = 'strike';
      if (Math.abs(T.x - f.x) < 80 && Math.abs(T.z - f.z) < 30 && T.h < 60 && T.inv <= 0 && T.st !== 'out' && T.st !== 'down' && !T.wrappedBy) {
        f.wrapping = T; T.wrappedBy = f; T.st = 'wrapped'; T.t = 0; T.mash = 0; T.anim = 'wrapped'; T.hold = null; f.atkN = 0; f.t = 0;
        this.fx.push({ k: 'hit', x: T.x, z: T.z, h: 90, sfx: 'SSSS', big: true });
        const mate = this.heroes.find((o) => o !== T)!; if (mate.st !== 'out') this.fx.push({ k: 'say', who: T.id === 'dora' ? 'Dora' : 'Enzo', text: mate.ctrl === 'bot' ? 'Help! Get this snake off me!' : 'Mash Attack! Or get your partner to whack it!' });
        return;
      }
      if (f.t > D.act) { f.st = 'rec'; f.t = 0; f.cd = D.cd; }
      return;
    }
    if (f.st === 'rec') { f.anim = f.t < 1.1 ? 'stun' : 'rise'; if (f.t > 1.1) f.h += (230 - f.h) * 0.05; if (f.t > 1.1 + D.rec) { f.st = 'walk'; f.t = 0; } return; }
    f.anim = 'hang'; f.h += (230 - f.h) * 0.05;
    const busy = T.wrappedBy;
    const tx = busy ? T.x + 260 * (f.id % 2 ? 1 : -1) : T.x;
    this.approach(f, tx, T.z, D.spd, D.zs); f.face = sgn(T.x - f.x);
    if (!busy && f.cd <= 0 && Math.abs(T.x - f.x) < 100 && Math.abs(T.z - f.z) < 30) { f.st = 'wind'; f.t = 0; }
  }
  stepToad(f: Foe, T: Hero, D: FoeDef, sk: number) {
    // hops about; a tongue lash down the lane pulls a hero in
    if (f.st === 'wind') { f.anim = 'puff'; if (f.t >= D.wind) { f.st = 'act'; f.t = 0; f.hit = new Set(); f.anim = 'tongue'; this.fx.push({ k: 'snd', s: 'croak' }); } return; }
    if (f.st === 'act') {
      f.anim = 'tongue';
      const len = Math.min(1, f.t / 0.15) * D.reach;
      for (const h of this.heroes) if (!f.hit.has(h) && h.st !== 'out' && h.inv <= 0 && Math.abs(h.z - f.z) < 24 && h.h < 60) {
        const dx = (h.x - f.x) * f.face; if (dx > 0 && dx < len) { f.hit.add(h); this.hurtHero(h, D.dmg, -f.face, false, f); h.x = f.x + f.face * 70; this.fx.push({ k: 'hit', x: h.x, z: h.z, h: 70, sfx: 'CROAK', big: true }); }
      }
      if (f.t > 0.4) { f.st = 'rec'; f.t = 0; f.cd = D.cd; }
      return;
    }
    if (f.st === 'rec') { f.anim = 'idle'; if (f.t > D.rec) { f.st = 'walk'; f.t = 0; } return; }
    // hop toward a spot in the target's lane, a tongue's length away
    const side = f.x < T.x ? -1 : 1;
    if (f.h > 0 || f.vh > 0) { f.vh -= GRAV * DT; f.h += f.vh * DT; f.x += f.vx * DT; f.z += f.vz * DT; f.z = clamp(f.z, 4, DEPTH - 4); f.anim = 'hop'; if (f.h <= 0) { f.h = 0; f.vh = 0; } return; }
    f.anim = 'idle'; f.face = sgn(T.x - f.x);
    const tx = T.x + side * 170, tz = T.z;
    if (Math.abs(T.z - f.z) < 20 && Math.abs(T.x - f.x) < D.reach - 20 && f.cd <= 0 && T.h < 40) { f.st = 'wind'; f.t = 0; return; }
    if (f.t > 0.5) { f.t = 0; f.vh = 420; f.h = 1; f.vx = clamp(tx - f.x, -220, 220) * 1.6 * sk; f.vz = clamp(tz - f.z, -120, 120) * 1.5; }
  }
  stepBoar(f: Foe, T: Hero, D: FoeDef, sk: number) {
    // paws the ground, then charges straight along its lane; stunned if it runs into the edge
    if (f.st === 'wind') { f.anim = 'paw'; if (f.t >= D.wind) { f.st = 'charge'; f.t = 0; f.hit = new Set(); this.fx.push({ k: 'hit', x: f.x, z: f.z, h: 90, sfx: 'OINK', big: false }); } return; }
    if (f.st === 'charge') {
      f.anim = 'charge'; f.x += f.face * 560 * sk * DT;
      this.foeHit(f, 70, 32, D.dmg, true, false, 70);
      for (const o of this.foes) if (o !== f && !o.dead && o !== f.rider && !f.hit.has(o) && o.kind !== 'roach' && Math.abs(o.x - f.x) < 60 && Math.abs(o.z - f.z) < 30 && o.h < 40 && !o.boss) { f.hit.add(o); this.hurtFoe(o, 10, f.face, null, MOVES['dora-kick']); }
      if (f.x < this.camX + 30 || f.x > this.camX + VIEW_W - 30) { f.x = clamp(f.x, this.camX + 30, this.camX + VIEW_W - 30); f.st = 'stun'; f.t = -0.6; this.shake = 6; this.fx.push({ k: 'hit', x: f.x, z: f.z, h: 70, sfx: 'BONK', big: true }); }
      if (f.t > 2.4) { f.st = 'rec'; f.t = 0; f.cd = D.cd; }
      return;
    }
    if (f.st === 'rec') { f.anim = 'idle'; if (f.t > D.rec) { f.st = 'walk'; f.t = 0; } return; }
    f.anim = 'walk';
    const arrived = this.approach(f, f.x, T.z, D.spd * 0.3, D.zs * sk);
    f.face = sgn(T.x - f.x);
    if (Math.abs(T.x - f.x) < 140) { this.approach(f, f.x - f.face * 200, T.z, D.spd * sk, 0); f.face = sgn(T.x - f.x); }
    if ((arrived || Math.abs(T.z - f.z) < 16) && f.cd <= 0 && Math.abs(T.x - f.x) > 200) { f.st = 'wind'; f.t = 0; }
  }

  // ─────────────────────────────────────── bosses
  stepBoss(f: Foe) {
    const B = BD[f.kind as BossKind];
    const T = (f.target && f.target.st !== 'out') ? f.target : (f.target = this.pickTarget(f));
    if (f.st === 'enter') { f.anim = 'walk'; f.x -= 200 * DT; if (f.x < this.lockX + PANEL_W - 300) { f.st = 'walk'; f.t = 0; f.patT = 1.2; } return; }
    if (!T) { f.anim = 'idle'; return; }
    f.patT -= DT;
    const hpK = f.hp / f.maxHp;
    // phase summons
    const ph = hpK < 0.34 ? 2 : hpK < 0.67 ? 1 : 0;
    if (ph > f.phase) {
      f.phase = ph;
      const adds: Record<BossKind, Spawn[]> = {
        tank: [{ k: 'rat', n: 2, from: 'R' }], ssst: [{ k: 'monitor', from: 'L', rider: 'rat' }], tusker: [{ k: 'macaque', n: 2, from: 'B' }],
        ong: [{ k: 'toad', n: 2, from: 'R' }], king: [{ k: 'macaque', n: 2, from: 'L' }, { k: 'mynah', from: 'T' }],
      };
      for (const s of adds[f.kind as BossKind]) this.spawn(s);
      this.fx.push({ k: 'say', who: BOSS_NAME[f.kind as BossKind], text: ph === 1 ? 'Get them, boys!' : 'ENOUGH!' });
    }
    if (f.h > 0 || f.vh > 0) { f.vh -= GRAV * DT; f.h += f.vh * DT; f.x += f.vx * DT; if (f.h <= 0) { f.h = 0; f.vh = 0; this.bossLand(f); } }
    f.x = clamp(f.x, this.camX + 60, this.camX + VIEW_W - 60); f.z = clamp(f.z, 10, DEPTH - 10);
    const k = f.kind as BossKind;
    if (f.pat === 'stunned') { f.anim = 'stun'; if (f.patT <= 0) { f.pat = ''; f.patT = 1; } return; }
    if (f.pat === '') {
      f.anim = 'walk'; f.face = sgn(T.x - f.x);
      const near = Math.abs(T.x - f.x) < B.rad + 90 && Math.abs(T.z - f.z) < 40;
      this.approach(f, T.x - f.face * (B.rad + 60), T.z, B.spd * (ph >= 2 ? 1.25 : 1), B.spd * 0.7);
      if (f.patT <= 0) {
        const r = this.rng();
        const pick = (opts: string[]) => opts[Math.floor(r * opts.length)];
        f.pat = k === 'tank' ? (near ? pick(['sweep', 'bite']) : pick(['bite', 'flop', 'sweep'])) :
          k === 'ssst' ? (near ? pick(['wrap', 'lunge']) : pick(['lunge', 'roar', 'parade'])) :
          k === 'tusker' ? pick(['charge', 'charge', 'stomp']) :
          k === 'ong' ? (near ? pick(['slam', 'tongue']) : pick(['tongue', 'hopslam'])) :
          pick(near ? ['slap', 'leap', 'steal'] : ['satay', 'leap', 'satay', 'steal']);
        f.t = 0; f.hit = new Set(); f.patT = 0;
        const tell: Record<string, string> = { charge: 'OINK', roar: 'SSSS', tongue: 'CROAK' };
        if (tell[f.pat]) this.fx.push({ k: 'hit', x: f.x, z: f.z, h: B.ht + 40, sfx: tell[f.pat] as Sfx, big: false });
      }
      return;
    }
    const done = (cool: number) => { f.pat = ''; f.patT = cool * (ph >= 2 ? 0.75 : 1); f.anim = 'idle'; };
    switch (f.pat) {
      case 'sweep': f.anim = f.t < 0.7 ? 'windsweep' : 'sweep'; if (f.t > 0.7 && f.t < 1.0) this.foeHit(f, 230, 70, 14, true, true, 40); if (f.t > 1.4) done(1.2); break;
      case 'bite': f.anim = f.t < 0.5 ? 'wind' : 'strike'; if (f.t > 0.5 && f.t < 0.8) { f.x += f.face * 500 * DT; this.foeHit(f, B.rad + 70, 40, 14, true); } if (f.t > 1.2) done(1.0); break;
      case 'flop': if (f.t < DT * 1.5) { f.vh = 900; f.h = 1; f.vx = (T.x - f.x) * 1.0; f.anim = 'leap'; } if (f.t > 3) done(1.4); break;
      case 'lunge': f.anim = f.t < 0.55 ? 'wind' : 'strike'; if (f.t > 0.55 && f.t < 0.85) { f.x += f.face * 700 * DT; this.foeHit(f, B.rad + 90, 36, 15, true); } if (f.t > 1.3) done(1.0); break;
      case 'wrap': f.anim = 'strike'; if (f.t > 0.4 && f.t < 0.7 && !f.wrapping) {
          if (Math.abs(T.x - f.x) < B.rad + 90 && Math.abs(T.z - f.z) < 40 && T.inv <= 0 && T.h < 60) { f.wrapping = T; T.wrappedBy = f; T.st = 'wrapped'; T.t = 0; T.mash = 0; T.anim = 'wrapped'; T.hold = null; f.atkN = 0; this.fx.push({ k: 'hit', x: T.x, z: T.z, h: 90, sfx: 'SSSS', big: true }); } }
        if (f.wrapping) { f.anim = 'wrap'; if (f.t > 4.5 || f.wrapping.st !== 'wrapped') { const w = f.wrapping; if (w.st === 'wrapped') { w.wrappedBy = null; this.setHero(w, 'idle'); } f.wrapping = null; done(1.5); } }
        else if (f.t > 1.2) done(1.0); break;
      case 'roar': f.anim = 'roar'; if (f.t > 0.9 && f.t < 1.0) { this.shake = 8; for (const h of this.heroes) if (h.h < 15 && h.st !== 'out' && h.inv <= 0 && Math.abs(h.x - f.x) < 420) { this.setHero(h, 'stun'); } this.fx.push({ k: 'hit', x: f.x, z: f.z, h: 160, sfx: 'SSSS', big: true }); } if (f.t > 1.6) done(1.2); break;
      case 'parade': if (f.t < DT * 1.5) { this.addLaneHazard('lion', 420, 1.2, T.z); f.anim = 'roar'; } if (f.t > 1.4) done(1.6); break;
      case 'charge':
        if (f.t < 0.8) { f.anim = 'paw'; this.approach(f, f.x, T.z, 0, 160); f.face = sgn(T.x - f.x); break; }
        f.anim = 'charge'; f.x += f.face * 640 * DT; this.foeHit(f, B.rad + 40, 50, 16, true, false, 60);
        if (f.x <= this.camX + 70 || f.x >= this.camX + VIEW_W - 70) { f.pat = 'stunned'; f.patT = 2.2; this.shake = 12; this.fx.push({ k: 'hit', x: f.x, z: f.z, h: 120, sfx: 'BONK', big: true }); }
        if (f.t > 4) done(1); break;
      case 'stomp': f.anim = f.t < 0.7 ? 'wind' : 'stomp'; if (f.t > 0.7 && f.t < 0.8) { this.shake = 10; for (const h of this.heroes) if (h.h < 10 && h.st !== 'out' && h.inv <= 0 && Math.abs(h.x - f.x) < 460) this.hurtHero(h, 8, sgn(h.x - f.x), false, f); this.fx.push({ k: 'dust', x: f.x, z: f.z }); } if (f.t > 1.4) done(1.2); break;
      case 'slam': f.anim = f.t < 0.5 ? 'wind' : 'strike'; if (f.t > 0.5 && f.t < 0.75) this.foeHit(f, B.rad + 80, 46, 14, true, true); if (f.t > 1.1) done(1.0); break;
      case 'tongue': {
        f.anim = f.t < 0.7 ? 'puff' : 'tongue';
        if (f.t > 0.7 && f.t < 1.0) { const len = Math.min(1, (f.t - 0.7) / 0.15) * 560;
          for (const h of this.heroes) if (!f.hit.has(h) && h.st !== 'out' && h.inv <= 0 && Math.abs(h.z - f.z) < 34 && h.h < 70) { const dx = (h.x - f.x) * f.face; if (dx > 0 && dx < len) { f.hit.add(h); this.hurtHero(h, 12, -f.face, true, f); h.x = f.x + f.face * 120; this.fx.push({ k: 'hit', x: h.x, z: h.z, h: 70, sfx: 'CROAK', big: true }); } } }
        if (f.t > 1.4) done(1.2); break;
      }
      case 'hopslam': if (f.t < DT * 1.5) { f.vh = 1000; f.h = 1; f.vx = (T.x - f.x) * 0.9; f.anim = 'leap'; } if (f.t > 3) done(1.2); break;
      case 'slap': f.anim = f.t < 0.35 ? 'wind' : 'strike'; if (f.t > 0.35 && f.t < 0.55) this.foeHit(f, B.rad + 70, 36, 12, f.atkN++ % 2 === 1); if (f.t > 0.8) done(0.7); break;
      case 'leap': if (f.t < DT * 1.5) { f.vh = 1100; f.h = 1; f.vx = (T.x - f.x) * 0.95; f.anim = 'leap'; } if (f.t > 3) done(1.0); break;
      case 'satay': f.anim = 'throw'; if ([0.4, 0.6, 0.8].some((s) => f.t >= s && f.t < s + DT)) {
          const z = clamp(T.z + (this.rng() - 0.5) * 80, 10, DEPTH - 10);
          this.shots.push({ kind: 'satay', x: f.x + f.face * 40, z, h: 70, vx: f.face * 700, t: 0, owner: f, hit: new Set(), done: false }); this.fx.push({ k: 'snd', s: 'throw' }); }
        if (f.t > 1.2) done(1.2); break;
      case 'steal': f.anim = 'run'; this.approach(f, T.x, T.z, 420, 200);
        if (Math.abs(T.x - f.x) < 70 && Math.abs(T.z - f.z) < 30) { if (T.hold) { T.hold.gone = true; T.hold = null; this.fx.push({ k: 'say', who: 'The Macaque King', text: 'Mine now.' }); } else { f.hit = new Set(); this.foeHit(f, 90, 36, 10, false, true); } done(1.0); }
        if (f.t > 2.2) done(1.0); break;
      default: done(1);
    }
  }
  bossLand(f: Foe) {
    this.shake = 12; this.fx.push({ k: 'dust', x: f.x, z: f.z }); this.fx.push({ k: 'snd', s: 'land' });
    const r = f.kind === 'ong' ? 260 : 200;
    for (const h of this.heroes) if (h.st !== 'out' && h.inv <= 0 && h.h < 20 && Math.hypot(h.x - f.x, (h.z - f.z) * 2) < r) this.hurtHero(h, 14, sgn(h.x - f.x), true, f);
    if (f.pat === 'flop' || f.pat === 'hopslam' || f.pat === 'leap') { f.pat = ''; f.patT = 1.1; }
  }

  // ─────────────────────────────────────── the helper bot
  /** the partner's controls: human-paced (a reaction delay and a cadence), free a wrapped partner, dodge hazards */
  bots: Record<HeroId, { react: number; tx: number; tz: number; atkCd: number; jumpCd: number }> = { dora: { react: 0, tx: 0, tz: 0, atkCd: 0, jumpCd: 0 }, enzo: { react: 0.1, tx: 0, tz: 0, atkCd: 0, jumpCd: 0 } };
  botInput(h: Hero): Input {
    const b = this.bots[h.id], r = this.botRng, inp: Input = { ...NO_INPUT };
    b.atkCd -= DT; b.jumpCd -= DT; b.react -= DT;
    if (h.st === 'out' || this.mode !== 'play') return inp;
    if (h.st === 'wrapped') { if (r() < 0.25) inp.atk = true; return inp; }
    const mate = this.heroes.find((o) => o !== h)!;
    // dodge: jump trolleys, lions, durians and jets
    const danger = this.hazards.some((z) => z.tell <= 0.2 && Math.abs(z.z - h.z) < 50 && Math.abs(z.x - h.x) < 260 && sgn(h.x - z.x) === z.dir) || (this.jetTell > 0 && this.jetTell < 0.35);
    if (danger && b.jumpCd <= 0 && h.h <= 0) { b.jumpCd = 0.8; inp.jmp = true; return inp; }
    if (h.st === 'jump' && !h.move && this.liveFoes().some((f) => Math.abs(f.x - h.x) < 110 && Math.abs(f.z - h.z) < 30 && Math.abs(f.h - h.h) < 80)) { inp.atk = true; return inp; }
    if (b.react > 0) { inp.mx = b.tx; inp.mz = b.tz; return inp; }
    b.react = 0.16 + r() * 0.12;
    let goal: { x: number; z: number } | null = null, attackNow = false;
    if (mate.st === 'wrapped' && mate.wrappedBy) { const p = mate.wrappedBy; goal = { x: p.x - sgn(p.x - h.x) * 60, z: p.z }; attackNow = Math.abs(p.x - h.x) < 110 && Math.abs(p.z - h.z) < 26; }
    else {
      const foes = this.liveFoes().filter((f) => f.st !== 'ride' && f.st !== 'carried' && f.st !== 'enter' && f.x > this.camX - 20 && f.x < this.camX + VIEW_W + 20);
      // food when hurt
      const food = h.hp < h.maxHp * 0.5 && this.items.find((i) => !i.gone && !i.held && ITEMS[i.kind].cls === 'food');
      if (food) goal = { x: food.x, z: food.z };
      else if (foes.length) {
        // leave the player's target alone when there is another
        const pl = this.heroes.find((o) => o !== h)!;
        let best = foes[0], bs = 1e9;
        for (const f of foes) { const s = Math.abs(f.x - h.x) + Math.abs(f.z - h.z) * 2 + (Math.abs(f.x - pl.x) < 120 && foes.length > 1 ? 300 : 0) + (f.h > 100 ? 200 : 0); if (s < bs) { bs = s; best = f; } }
        const side = h.x < best.x ? -1 : 1;
        goal = { x: best.x + side * 80, z: best.z };
        attackNow = Math.abs(best.x - h.x) < 120 && Math.abs(best.z - h.z) < 26 && Math.abs(best.h - h.h) < 90;
        if (best.h > 80 && best.h < 280 && Math.abs(best.x - h.x) < 80 && Math.abs(best.z - h.z) < 24 && h.h <= 0 && b.jumpCd <= 0) { b.jumpCd = 0.9; inp.jmp = true; inp.mx = sgn(best.x - h.x); return inp; }
        if (best.h > 80) goal = { x: best.x - sgn(best.x - h.x) * 20, z: best.z };
        if (h.meter >= 100 && foes.length >= 3 && Math.abs(best.x - h.x) < 160 && r() < 0.3) { inp.atk = true; inp.jmp = true; return inp; }
        if (!h.hold && r() < 0.3) { const it = this.items.find((i) => !i.gone && !i.held && !i.flying && ITEMS[i.kind].cls !== 'food' && Math.abs(i.x - h.x) < 70 && Math.abs(i.z - h.z) < 30); if (it) { inp.grab = true; return inp; } }
      } else if (!this.locked) goal = { x: mate.x + 40, z: mate.z + (mate.z < DEPTH / 2 ? 60 : -60) };
      else goal = { x: mate.x - 120 * mate.face, z: mate.z + 50 };
    }
    if (attackNow && b.atkCd <= 0) { inp.atk = true; h.face = sgn((goal?.x ?? h.x) - h.x) || h.face; b.atkCd = 0.28 + r() * 0.2; return inp; }
    if (goal) { const dx = goal.x - h.x, dz = goal.z - h.z; inp.mx = Math.abs(dx) > 14 ? sgn(dx) : 0; inp.mz = Math.abs(dz) > 10 ? clamp(dz / 40, -1, 1) : 0; }
    b.tx = inp.mx; b.tz = inp.mz;
    return inp;
  }

  // ─────────────────────────────────────── helpers for the page and tests
  hero(id: HeroId) { return this.heroes.find((h) => h.id === id)!; }
  setCtrl(id: HeroId, c: Ctrl) { this.hero(id).ctrl = c; }
  /** swap which hero player 1 plays (solo only) */
  swap() { const a = this.heroes.find((h) => h.ctrl === 'p1'); const b = this.heroes.find((h) => h.ctrl === 'bot'); if (a && b) { a.ctrl = 'bot'; b.ctrl = 'p1'; } }
  screenY(z: number, h = 0) { return FLOOR_Y + z - h; }
  sceneCount() { return this.stage.scenes.length; }
  progress() { return (this.sceneIdx + (this.locked ? Math.max(0, this.wave) / Math.max(1, this.scene.waves.length) : 1)) / this.stage.scenes.length; }
}
