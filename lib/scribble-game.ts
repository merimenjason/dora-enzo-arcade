// Chinchilla Scribble: a Scribblenauts-style puzzle game. Write a word, it appears, and Dora and Enzo use it to reach
// the golden wolfberry. One screen per level (1000 × 600, y down, the ground at 472). Everything lives here with no
// DOM: side-on box physics, the two chinchillas (one you steer, one who follows), summoned things and what they do to
// each other (fire spreads, water and cold put it out, cold freezes rivers, bombs break rock), and the level's
// residents. Deterministic: summons, input and time fully decide what happens.
import { parse, type Tag, type Noun, type Adjective } from './scribble-words.js';

export { parse, NOUNS, ADJECTIVES, NOUN, ADJ, suggest, type Tag, type Noun, type Adjective } from './scribble-words.js';

export const W = 1000, H = 600, GROUND = 472;
export const GRAVITY = 1500, WALK = 180, JUMP = 540, CLIMB = 150, BOUNCE = 900;
export const CHIN_W = 54, CHIN_H = 44, MAX_THINGS = 14;
export const FUSE = 3, BURN_TIME = 10, BLAST = 160, LIGHT_REACH = 230;

export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- Levels ----------

export type ChinId = 'dora' | 'enzo';
export type Rect = { x: number; y: number; w: number; h: number };
export type TerrainKind = 'ground' | 'cliff' | 'rock' | 'burrow' | 'house' | 'shelf' | 'floor' | 'haystack';
export type Terrain = Rect & { kind: TerrainKind };
export type Water = Rect & { frozen: boolean };
export type Sky = 'meadow' | 'mountain' | 'town' | 'store';

export type Thing =
  | { kind: 'llama' | 'pebble'; x: number; needs: Tag[]; consume: boolean; leaveTo: number; asks: string; thanks: string }
  | { kind: 'puma' | 'zombie'; x: number; from: number; to: number; tame: Tag[]; flee: Tag[] }
  | { kind: 'campfire'; x: number }
  | { kind: 'rockwall'; x: number; w: number; h: number }
  | { kind: 'gate'; x: number; h: number; plateX: number; need: number };

export type LevelDef = {
  name: string; world: number; goal: string; par: number; hints: string[]; sky: Sky; dark?: boolean;
  terrain: [number, number, number, number, TerrainKind][];
  water?: [number, number, number, number][];
  start: number; berry: [number, number] | null; things?: Thing[];
};

export const WORLDS = ['Meadow', 'Mountain', 'Burrow Town'];
const ground = (x = 0, w = W): [number, number, number, number, TerrainKind] => [x, GROUND, w, H - GROUND, 'ground'];

export const LEVELS: LevelDef[] = [
  { name: 'The high ledge', world: 0, sky: 'meadow', par: 1, start: 180, berry: [862, 332],
    goal: 'A golden wolfberry is sitting on the high ledge. It’s too high to jump. Write something that helps you get up there.',
    hints: ['ladder', 'stairs', 'trampoline'],
    terrain: [ground(), [700, 332, 300, 140, 'cliff']] },
  { name: 'The cliff', world: 0, sky: 'meadow', par: 1, start: 200, berry: [862, 250],
    goal: 'The wolfberry is on top of the cliff. Get up there however you like.',
    hints: ['ladder', 'flying carpet', 'giant trampoline'],
    terrain: [ground(), [725, 250, 275, 222, 'cliff']] },
  { name: 'Across the river', world: 0, sky: 'meadow', par: 1, start: 150, berry: [880, GROUND],
    goal: 'Chinchillas can’t swim, and the wolfberry is on the far bank. Find a way across the river.',
    hints: ['bridge', 'boat', 'ice'],
    terrain: [ground(0, 390), ground(690, 310), [390, 566, 300, 34, 'ground']], water: [[390, 486, 300, 80]] },
  { name: 'The hungry llama', world: 0, sky: 'meadow', par: 1, start: 160, berry: [900, GROUND],
    goal: 'A llama is dozing in the old tunnel and won’t budge. It looks hungry.',
    hints: ['carrot', 'hay', 'apple'],
    terrain: [ground(), [480, 0, 520, 330, 'rock']],
    things: [{ kind: 'llama', x: 610, needs: ['plant'], consume: true, leaveTo: W + 160, asks: 'The llama’s tummy rumbles. It wants a snack.', thanks: 'The llama munches it happily and wanders off.' }] },
  { name: 'Campfire in the pass', world: 1, sky: 'mountain', par: 1, start: 160, berry: [900, GROUND],
    goal: 'Someone left a campfire burning in the mountain pass. Put it out so you can get through.',
    hints: ['bucket', 'snowball', 'rain cloud'],
    terrain: [ground(), [440, 0, 560, 360, 'rock']], things: [{ kind: 'campfire', x: 640 }] },
  { name: 'Rockfall', world: 1, sky: 'mountain', par: 1, start: 160, berry: [900, GROUND],
    goal: 'A rockfall has blocked the tunnel. Clear it.',
    hints: ['pickaxe', 'bomb', 'dynamite'],
    terrain: [ground(), [460, 0, 540, 296, 'rock']], things: [{ kind: 'rockwall', x: 610, w: 96, h: 176 }] },
  { name: 'The puma’s patrol', world: 1, sky: 'mountain', par: 1, start: 150, berry: [915, GROUND],
    goal: 'A puma is guarding the wolfberry. Get past it without getting swatted.',
    hints: ['steak', 'cage', 'dog'],
    terrain: [ground()],
    things: [{ kind: 'puma', x: 700, from: 470, to: 850, tame: ['meat'], flee: ['scary'] }] },
  { name: 'The old gate', world: 1, sky: 'mountain', par: 1, start: 150, berry: [900, GROUND],
    goal: 'The gate opens when something heavy sits on the stone plate. Chinchillas are far too light.',
    hints: ['anvil', 'boulder', 'elephant'],
    terrain: [ground(), [560, 0, 440, 330, 'rock']], things: [{ kind: 'gate', x: 620, h: 142, plateX: 380, need: 5 }] },
  { name: 'Pebble’s doorway', world: 2, sky: 'town', par: 1, start: 150, berry: [900, GROUND],
    goal: 'Grandpa Pebble is shivering in the burrow doorway and won’t move until he’s warm.',
    hints: ['blanket', 'heater', 'hot chocolate'],
    terrain: [ground(), [520, 0, 480, 350, 'burrow']],
    things: [{ kind: 'pebble', x: 590, needs: ['warm'], consume: false, leaveTo: 980, asks: 'Grandpa Pebble shivers. “Brrr, it’s chilly out here.”', thanks: '“Ahh, lovely and warm,” says Grandpa Pebble, and shuffles out of the way.' }] },
  { name: 'The dark storeroom', world: 2, sky: 'store', par: 2, start: 150, berry: [760, 318], dark: true,
    goal: 'The wolfberry is somewhere on the top shelf, but the storeroom is pitch dark. Light it up, then climb up.',
    hints: ['lamp', 'ladder', 'glowing ladder'],
    terrain: [[0, GROUND, W, H - GROUND, 'floor'], [640, 318, 240, 18, 'shelf'], [60, 300, 200, 18, 'shelf']] },
  { name: 'Rooftops', world: 2, sky: 'town', par: 2, start: 150, berry: [900, 200],
    goal: 'The wolfberry landed on the tallest roof in Burrow Town.',
    hints: ['ladder', 'stairs', 'helicopter'],
    terrain: [ground(), [420, 300, 200, 172, 'house'], [780, 200, 220, 272, 'house']] },
  { name: 'Zombie in the garden', world: 2, sky: 'town', par: 2, start: 150, berry: [900, 300],
    goal: 'A zombie wandered in from next door and is guarding the haystack. The wolfberry is on top.',
    hints: ['brain', 'torch', 'ladder'],
    terrain: [ground(), [800, 300, 200, 172, 'haystack']],
    things: [{ kind: 'zombie', x: 600, from: 400, to: 770, tame: ['brain', 'meat'], flee: ['scary', 'flame', 'light'] }] },
];

export const SANDBOX: LevelDef = {
  name: 'Sandbox', world: 0, sky: 'meadow', par: 0, start: 200, berry: null, hints: [],
  goal: 'No wolfberry here. Write anything and see what happens.',
  terrain: [ground(0, 560), ground(780, 220), [560, 560, 220, 40, 'ground'], [860, 380, 140, 92, 'cliff']], water: [[560, 490, 220, 70]],
};

/** 3 stars at or under par, 2 within two more, else 1. */
export const starsFor = (words: number, par: number) => (words <= par ? 3 : words <= par + 2 ? 2 : 1);

// ---------- Things in the world ----------

export type Mood = 'calm' | 'angry' | 'friendly' | 'sleepy' | 'hungry' | 'happy' | 'caged' | 'fled' | 'out';
export type Role =
  | { kind: 'blocker'; needs: Tag[]; consume: boolean; leaveTo: number; asks: string; thanks: string; asked: number }
  | { kind: 'guard'; from: number; to: number; tame: Tag[]; flee: Tag[]; target: number | null }
  | { kind: 'campfire' } | { kind: 'rockwall'; hp: number } | { kind: 'plate' }
  | { kind: 'gate'; plate: number; need: number; open: number; baseY: number };

export type Ent = {
  id: number; noun: string; art: string; label: string; adjs: string[];
  x: number; y: number; w: number; h: number; vx: number; vy: number; dx: number;
  tags: Set<Tag>; mass: number; speed: number; color: string; tint: string | null;
  pattern: Adjective['pattern'] | null; look: Adjective['look'] | null;
  face: 1 | -1; mood: Mood; burning: number; heat: number; fuse: number; life: number;
  level: boolean; stuck: boolean; held: boolean; grounded: boolean; floating: boolean; standOn: number | null;
  riders: ChinId[]; born: number; wander: number; home: number; role: Role | null; gone: boolean;
};

export type Chin = {
  id: ChinId; x: number; y: number; vx: number; vy: number; face: 1 | -1; grounded: boolean; climbing: boolean;
  riding: number | null; stun: number; safe: { x: number; y: number }; run: number; rideCool: number; away: number;
  target: { x: number; y: number } | null; standOn: number | null; blocked: number; cheer: number;
};

export type Fx = { kind: 'boom' | 'poof' | 'splash' | 'steam' | 'rubble' | 'spark' | 'heart' | 'bounce' | 'eat'; x: number; y: number; t: number };
export type GameEvent = { kind: 'say'; text: string } | { kind: 'win' } | { kind: 'summon'; id: number } | { kind: 'boom' } | { kind: 'splash' };
export type SummonResult = { ok: true; ent: Ent } | { ok: false; message: string; suggestion?: string | null };
export type Input = { dir: -1 | 0 | 1; up: boolean; down: boolean; jump: boolean };

type Body = { x: number; y: number; w: number; h: number; vx: number; vy: number };
type Moved = { grounded: boolean; standOn: number | null; hitX: -1 | 0 | 1; hitUp: boolean };

/** Small flames you can walk past: they still light things and scare zombies. */
const HANDHELD = new Set(['torch', 'candle']);
const overlap = (a: Rect, b: Rect, m = 0) => a.x < b.x + b.w + m && a.x + a.w > b.x - m && a.y < b.y + b.h + m && a.y + a.h > b.y - m;
const sign = (v: number): -1 | 0 | 1 => (v > 0 ? 1 : v < 0 ? -1 : 0);
export const boxOf = (b: { x: number; y: number; w: number; h: number }): Rect => ({ x: b.x - b.w / 2, y: b.y - b.h, w: b.w, h: b.h });
const chinBox = (c: Chin): Rect => ({ x: c.x - CHIN_W / 2, y: c.y - CHIN_H, w: CHIN_W, h: CHIN_H });

export class Game {
  readonly level: number;
  readonly def: LevelDef;
  state: 'playing' | 'won' = 'playing';
  time = 0;
  terrain: Terrain[];
  water: Water[];
  ents: Ent[] = [];
  chins: Record<ChinId, Chin>;
  leader: ChinId = 'dora';
  berry: { x: number; y: number; lit: boolean; got: boolean } | null;
  /** Every phrase summoned this attempt, in order. The star count is how many. */
  summons: string[] = [];
  input: Input = { dir: 0, up: false, down: false, jump: false };
  events: GameEvent[] = [];
  fx: Fx[] = [];
  held: number | null = null;
  private nextId = 1;
  private rand: () => number;
  private said = new Map<string, number>();

  /** `level` indexes LEVELS; -1 is the sandbox. */
  constructor(level: number, seed = 1) {
    this.level = level;
    this.def = level < 0 ? SANDBOX : LEVELS[level];
    this.rand = rng(seed);
    this.terrain = this.def.terrain.map(([x, y, w, h, kind]) => ({ x, y, w, h, kind }));
    this.water = (this.def.water ?? []).map(([x, y, w, h]) => ({ x, y, w, h, frozen: false }));
    this.berry = this.def.berry ? { x: this.def.berry[0], y: this.def.berry[1], lit: !this.def.dark, got: false } : null;
    const make = (id: ChinId, x: number): Chin => {
      const y = this.floorAt(x, 400);
      return { id, x, y, vx: 0, vy: 0, face: 1, grounded: true, climbing: false, riding: null, stun: 0, safe: { x, y }, run: 0, rideCool: 0, away: 0, target: null, standOn: null, blocked: 0, cheer: 0 };
    };
    this.chins = { dora: make('dora', this.def.start), enzo: make('enzo', this.def.start - 70) };
    for (const t of this.def.things ?? []) this.addThing(t);
  }

  get lead() { return this.chins[this.leader]; }
  get follow() { return this.chins[this.leader === 'dora' ? 'enzo' : 'dora']; }
  get stars() { return starsFor(this.summons.length, this.def.par); }
  ent(id: number | null) { return id === null ? undefined : this.ents.find((e) => e.id === id && !e.gone); }
  has(e: Ent, t: Tag) { return e.tags.has(t); }

  // ---------- Building things ----------

  private blank(noun: string, art: string, x: number, y: number, w: number, h: number): Ent {
    return {
      id: this.nextId++, noun, art, label: noun, adjs: [], x, y, w, h, vx: 0, vy: 0, dx: 0, tags: new Set(), mass: 1, speed: 0, color: '', tint: null,
      pattern: null, look: null, face: 1, mood: 'calm', burning: 0, heat: 0, fuse: 0, life: 0, level: false, stuck: false, held: false,
      grounded: false, floating: false, standOn: null, riders: [], born: this.time, wander: 0, home: y, role: null, gone: false,
    };
  }

  private addThing(t: Thing) {
    if (t.kind === 'llama' || t.kind === 'pebble') {
      const e = this.blank(t.kind, t.kind === 'llama' ? 'llama' : 'pebble', t.x, GROUND, t.kind === 'llama' ? 92 : 84, t.kind === 'llama' ? 144 : 112);
      e.tags = new Set(['wall', 'alive']); e.mass = 5; e.face = -1; e.level = true; e.color = '#f3e6cf';
      e.role = { kind: 'blocker', needs: t.needs, consume: t.consume, leaveTo: t.leaveTo, asks: t.asks, thanks: t.thanks, asked: -99 };
      this.ents.push(e);
    } else if (t.kind === 'puma' || t.kind === 'zombie') {
      const e = this.blank(t.kind, t.kind, t.x, GROUND, t.kind === 'puma' ? 124 : 62, t.kind === 'puma' ? 72 : 112);
      e.tags = new Set(['alive']); e.mass = 4; e.face = -1; e.level = true; e.speed = t.kind === 'puma' ? 80 : 45; e.color = '#d2a06a';
      e.role = { kind: 'guard', from: t.from, to: t.to, tame: t.tame, flee: t.flee, target: null };
      this.ents.push(e);
    } else if (t.kind === 'campfire') {
      const e = this.blank('campfire', 'campfire', t.x, GROUND, 84, 52);
      e.tags = new Set(['flame', 'hot', 'warm', 'light']); e.burning = Infinity; e.level = true; e.stuck = true; e.role = { kind: 'campfire' };
      this.ents.push(e);
    } else if (t.kind === 'rockwall') {
      const e = this.blank('rockfall', 'rockwall', t.x, GROUND, t.w, t.h);
      e.tags = new Set(['wall']); e.level = true; e.stuck = true; e.role = { kind: 'rockwall', hp: 0.8 };
      this.ents.push(e);
    } else if (t.kind === 'gate') {
      const plate = this.blank('plate', 'plate', t.plateX, GROUND, 96, 10);
      plate.tags = new Set(['solid']); plate.level = true; plate.stuck = true; plate.role = { kind: 'plate' };
      this.ents.push(plate);
      const gate = this.blank('gate', 'gate', t.x, GROUND, 36, t.h);
      gate.tags = new Set(['wall']); gate.level = true; gate.stuck = true;
      gate.role = { kind: 'gate', plate: plate.id, need: t.need, open: 0, baseY: GROUND };
      this.ents.push(gate);
    }
  }

  /** Writes a word: parses it, builds the thing, and puts it in front of whoever you're steering. */
  summon(text: string): SummonResult {
    if (this.state !== 'playing') return { ok: false, message: '' };
    const p = parse(text);
    if (p.ok === false) {
      const message =
        p.reason === 'empty' ? 'Write a word first, like “ladder”.'
        : p.reason === 'reserved' ? 'Nice try! The golden wolfberry has to be earned.'
        : p.reason === 'hero' ? 'There’s only one Dora and one Enzo. Try “chinchilla” for a new friend.'
        : p.reason === 'no-noun' ? `“${p.word}” describes something, but what? Add a thing after it, like “${p.word} ladder”.`
        : `“${p.word}” isn’t in the chinchillas’ dictionary yet.${p.suggestion ? ` Did you mean “${p.suggestion}”?` : ''}`;
      return { ok: false, message, suggestion: p.suggestion };
    }
    const e = this.build(p.noun, p.adjs);
    this.place(e);
    this.ents.push(e);
    this.summons.push(e.label);
    const own = this.ents.filter((x) => !x.level && x.riders.length === 0 && x.id !== e.id);
    while (own.length >= MAX_THINGS) this.drop(own.shift()!, true);
    this.events.push({ kind: 'summon', id: e.id });
    this.fx.push({ kind: 'poof', x: e.x, y: e.y - e.h / 2, t: 0 });
    return { ok: true, ent: e };
  }

  /** The noun and adjectives made into a thing, not yet placed. */
  build(noun: Noun, adjs: Adjective[]): Ent {
    const e = this.blank(noun.id, noun.art, 0, 0, noun.w, noun.h);
    e.label = [...adjs.map((x) => x.words[0]), noun.words[0]].join(' ');
    e.adjs = adjs.map((x) => x.id);
    e.tags = new Set(noun.tags); e.mass = noun.mass; e.speed = noun.speed || 100; e.color = noun.color;
    for (const x of adjs) {
      if (x.scale) { e.w *= x.scale; e.h *= x.scale; e.mass *= x.scale * x.scale; e.speed *= x.scale > 1 ? 1.2 : 0.8; }
      if (x.sw) { e.w *= x.sw; e.mass *= x.sw; }
      if (x.sh) { e.h *= x.sh; e.mass *= x.sh; }
      for (const t of x.add ?? []) e.tags.add(t);
      for (const t of x.remove ?? []) e.tags.delete(t);
      if (x.mass) e.mass += x.mass;
      if (x.massMul) e.mass *= x.massMul;
      if (x.speed) e.speed *= x.speed;
      if (x.tint) e.tint = x.tint;
      if (x.pattern) e.pattern = x.pattern;
      if (x.look) e.look = x.look;
      if (x.mood) e.mood = x.mood;
    }
    // Wings on something you can drive make it a flying thing you steer instead.
    if (e.tags.has('fly')) { e.tags.delete('drive'); e.tags.delete('boat'); e.speed = Math.max(e.speed, 140); }
    if (e.tags.has('fly') && e.tags.has('ride') && !noun.tags.includes('fly') && !e.tags.has('alive')) e.speed = 170 * (e.speed / (noun.speed || 100));
    e.w = Math.max(8, Math.min(720, e.w)); e.h = Math.max(8, Math.min(520, e.h));
    e.mass = Math.round(e.mass * 10) / 10;
    if (e.tags.has('flame')) e.burning = e.tags.has('burn') && !noun.tags.includes('flame') ? BURN_TIME : Infinity;
    if (e.tags.has('explode')) e.fuse = FUSE;
    if (e.tags.has('sticky')) e.stuck = true;
    e.wander = 1 + this.rand() * 2;
    return e;
  }

  /** In front of the leader, pushed out of any wall, resting where it lands. Flying things hover at head height. */
  private place(e: Ent) {
    const c = this.lead;
    const face = c.face;
    e.face = face;
    e.x = Math.max(e.w / 2, Math.min(W - e.w / 2, c.x + face * (e.w / 2 + CHIN_W / 2 + 14)));
    e.y = c.y;
    if (e.tags.has('fly')) e.y = c.y - CHIN_H - 8;
    // Out of walls: back towards the leader first, then up on top of whatever it's in.
    for (let i = 0; i < 3; i++) {
      const hit = this.walls(e).find((r) => overlap(boxOf(e), r, -0.5));
      if (!hit) break;
      const back = face > 0 ? hit.x - e.w / 2 : hit.x + hit.w + e.w / 2;
      if (Math.abs(back - e.x) <= e.w + CHIN_W + 40 && back - e.w / 2 >= 0 && back + e.w / 2 <= W && (face > 0 ? back >= c.x - e.w / 2 : back <= c.x + e.w / 2)) e.x = back;
      else e.y = hit.y;
    }
    // Onto low things it would otherwise start inside, like the gate's plate.
    for (const p of this.ents) {
      if (p.gone || !p.tags.has('solid') || Math.abs(e.x - p.x) > p.w / 2 + e.w * 0.3) continue;
      const top = this.surface(p, Math.max(p.x - p.w / 2, Math.min(p.x + p.w / 2, e.x)));
      if (top !== null && top < e.y && top > e.y - Math.min(40, e.h * 0.6)) e.y = top;
    }
    e.home = e.y;
    if (!e.tags.has('fly') && !e.stuck) e.y -= 2;
  }

  private drop(e: Ent, quiet = false) {
    e.gone = true;
    for (const id of e.riders) this.getOff(this.chins[id]);
    if (this.held === e.id) this.held = null;
    if (!quiet) this.fx.push({ kind: 'poof', x: e.x, y: e.y - e.h / 2, t: 0 });
  }

  /** Removes one of your summoned things. Level residents stay. */
  remove(id: number) { const e = this.ent(id); if (e && !e.level) { this.drop(e); return true; } return false; }

  /** The top summoned thing under a point, for dragging. */
  entAt(x: number, y: number) {
    for (let i = this.ents.length - 1; i >= 0; i--) {
      const e = this.ents[i];
      if (!e.gone && !e.level && overlap(boxOf(e), { x: x - 6, y: y - 6, w: 12, h: 12 })) return e;
    }
    return undefined;
  }
  grab(id: number) {
    const e = this.ent(id);
    if (!e || e.level || this.state !== 'playing') return false;
    for (const r of e.riders) this.getOff(this.chins[r]);
    this.held = id; e.held = true; e.vx = e.vy = 0;
    return true;
  }
  /** Moves the held thing so its bottom centre sits at (x, y). */
  dragTo(x: number, y: number) {
    const e = this.ent(this.held);
    if (!e) return;
    e.x = Math.max(e.w / 2, Math.min(W - e.w / 2, x));
    e.y = Math.max(e.h, Math.min(H + 20, y));
  }
  release() {
    const e = this.ent(this.held);
    this.held = null;
    if (!e) return;
    e.held = false; e.vx = e.vy = 0;
    this.pushOut(e, e);
    e.home = e.y;
  }
  /** Nudges a thing with the keyboard: the same as a short drag. */
  nudge(id: number, dx: number, dy: number) {
    const e = this.ent(id);
    if (!e || e.level) return;
    e.x = Math.max(e.w / 2, Math.min(W - e.w / 2, e.x + dx));
    e.y = Math.max(e.h, Math.min(H, e.y + dy));
    this.pushOut(e, e);
    e.home = e.y; e.vy = 0;
  }

  swap() {
    if (this.state !== 'playing') return;
    this.leader = this.leader === 'dora' ? 'enzo' : 'dora';
    this.chins.dora.target = this.chins.enzo.target = null;
    this.say(this.leader === 'dora' ? 'You’re steering Dora.' : 'You’re steering Enzo.', 0);
  }
  /** Tap-to-move: the leader walks, climbs or flies towards the point. */
  goTo(x: number, y: number) { if (this.state === 'playing') this.lead.target = { x, y }; }
  /** Hop off whatever the leader is riding. */
  hopOff() { const c = this.lead; if (c.riding !== null) { this.getOff(c); c.vy = -320; } }

  private say(text: string, gap = 2) {
    const last = this.said.get(text) ?? -99;
    if (this.time - last < gap) return;
    this.said.set(text, this.time);
    this.events.push({ kind: 'say', text });
  }

  // ---------- Collision ----------

  private gateRect(e: Ent): Rect {
    const r = e.role as Extract<Role, { kind: 'gate' }>;
    return { x: e.x - e.w / 2, y: r.baseY - e.h - r.open * e.h, w: e.w, h: e.h };
  }
  /** Everything solid from every side: terrain, frozen water and walls like the llama, the rockfall and the gate. */
  walls(skip?: Ent): Rect[] {
    const out: Rect[] = [...this.terrain, ...this.water.filter((w) => w.frozen)];
    for (const e of this.ents) {
      if (e.gone || e === skip || !e.tags.has('wall')) continue;
      out.push(e.role?.kind === 'gate' ? this.gateRect(e) : boxOf(e));
    }
    return out;
  }
  /** The height of a thing's walkable top at x, or null where there isn't one. */
  surface(e: Ent, x: number): number | null {
    const u = (x - e.x) / (e.w / 2);
    if (Math.abs(u) > 1.02) return null;
    if (e.tags.has('stairs')) {
      const k = Math.min(3, Math.max(0, Math.floor(((e.face > 0 ? u : -u) + 1) * 2)));
      return e.y - (e.h * (k + 1)) / 4;
    }
    if (e.tags.has('arc')) return e.y - e.h * Math.sqrt(Math.max(0, 1 - Math.min(1, u * u)));
    if (e.tags.has('canopy')) return Math.abs(u) < 0.8 ? e.y - e.h : null;
    if (e.art === 'plate') return e.y - e.h;
    return e.y - e.h;
  }
  private pushOut(b: Body, skip: Ent | null) {
    for (const r of this.walls(skip ?? undefined)) {
      const box = boxOf(b);
      if (!overlap(box, r, -0.5)) continue;
      const left = box.x + box.w - r.x, right = r.x + r.w - box.x, up = box.y + box.h - r.y, down = r.y + r.h - box.y;
      const m = Math.min(left, right, up, down);
      if (m === up) b.y = r.y; else if (m === left) b.x -= left; else if (m === right) b.x += right; else b.y += down;
    }
  }
  /** Moves a body a step: x then y against walls, then lands it on the tops of solid things. */
  private move(b: Body, dt: number, self: Ent | null, oneWay: boolean, stick: number | null, stepUp: number): Moved {
    const res: Moved = { grounded: false, standOn: null, hitX: 0, hitUp: false };
    const walls = this.walls(self ?? undefined);
    b.x += b.vx * dt;
    for (const r of walls) {
      const box = boxOf(b);
      if (!overlap(box, r, -0.5)) continue;
      if (b.y - r.y <= stepUp && b.y - r.y >= 0) { b.y = r.y; continue; }
      if (b.vx > 0) b.x = r.x - b.w / 2 - 0.01; else if (b.vx < 0) b.x = r.x + r.w + b.w / 2 + 0.01;
      else b.x = box.x + box.w / 2 < r.x + r.w / 2 ? r.x - b.w / 2 : r.x + r.w + b.w / 2;
      res.hitX = sign(b.vx) || 1; b.vx = 0;
    }
    b.x = Math.max(b.w / 2, Math.min(W - b.w / 2, b.x));
    const prevY = b.y;
    b.y += b.vy * dt;
    for (const r of walls) {
      const box = boxOf(b);
      if (!(box.x < r.x + r.w - 0.5 && box.x + box.w > r.x + 0.5 && box.y < r.y + r.h && box.y + box.h > r.y)) continue;
      if (b.vy >= 0 && prevY - 0.5 <= r.y + 8) { b.y = r.y; b.vy = 0; res.grounded = true; }
      else if (b.vy < 0 && prevY - b.h >= r.y + r.h - 8) { b.y = r.y + r.h + b.h; b.vy = 0; res.hitUp = true; }
      else if (b.vy >= 0) { b.y = r.y; b.vy = 0; res.grounded = true; }
    }
    if (oneWay && b.vy >= 0) {
      let best: number | null = null, on: number | null = null;
      for (const p of this.ents) {
        if (p.gone || p === self || p.held || !p.tags.has('solid') || p.standOn === self?.id) continue;
        if (self && p.riders.length && self.riders.length) continue;
        const inside = Math.abs(b.x - p.x) <= p.w / 2 + (self ? Math.min(b.w, p.w) * 0.3 : 4);
        if (!inside) continue;
        const s = this.surface(p, Math.max(p.x - p.w / 2, Math.min(p.x + p.w / 2, b.x)));
        if (s === null) continue;
        const slack = stick === p.id ? 36 : Math.max(6, stepUp);
        if (prevY <= s + slack && b.y >= s - (stick === p.id ? 36 : 0) && (best === null || s < best)) { best = s; on = p.id; }
      }
      if (best !== null) { b.y = best; b.vy = 0; res.grounded = true; res.standOn = on; }
    }
    return res;
  }
  private floorAt(x: number, below: number): number {
    let best = H + 400;
    for (const r of this.terrain) if (x >= r.x && x <= r.x + r.w && r.y >= below && r.y < best) best = r.y;
    return best;
  }
  private waterAt(x: number, y: number) { return this.water.find((w) => !w.frozen && x > w.x && x < w.x + w.w && y > w.y + 4 && y < w.y + w.h + 40); }

  // ---------- The chinchillas ----------

  private getOff(c: Chin) {
    const e = this.ent(c.riding);
    if (e) e.riders = e.riders.filter((r) => r !== c.id);
    c.riding = null; c.rideCool = 0.6; c.grounded = false;
  }
  private getOn(c: Chin, e: Ent) {
    if (c.riding !== null || c.rideCool > 0 || e.riders.length >= 2 || e.held || e.mood === 'angry') return;
    c.riding = e.id; c.climbing = false; c.vx = c.vy = 0;
    if (!e.tags.has('fly')) c.target = null;
    e.riders.push(c.id);
    if (c.id === this.leader) this.say(e.tags.has('fly') ? `Riding the ${e.label}. Steer with the arrows; ↓ on the ground hops off.` : `Riding the ${e.label}. ↓ hops off.`, 6);
  }
  private seat(c: Chin, e: Ent) {
    const i = e.riders.indexOf(c.id), two = e.riders.length > 1;
    const off = two ? (i === 0 ? 1 : -1) * Math.min(e.w * 0.2, 26) * e.face : 0;
    c.x = e.x + off;
    c.y = e.tags.has('hang') ? e.y + CHIN_H - 4 : e.tags.has('fly') || e.tags.has('boat') || e.tags.has('drive') ? e.y - e.h + Math.min(10, e.h * 0.3) : e.y - e.h * 0.82;
    c.face = e.face; c.vx = e.vx; c.vy = 0; c.grounded = true;
  }
  private knock(c: Chin, fromX: number, text: string) {
    if (c.stun > 0) return;
    if (c.riding !== null) this.getOff(c);
    const d = c.x < fromX ? -1 : 1;
    c.vx = d * 280; c.vy = -340; c.stun = 0.7; c.climbing = false; c.grounded = false; c.target = null;
    this.fx.push({ kind: 'spark', x: c.x, y: c.y - CHIN_H, t: 0 });
    this.say(text, 1.5);
  }
  private respawn(c: Chin, text: string) {
    if (c.riding !== null) this.getOff(c);
    this.fx.push({ kind: 'splash', x: c.x, y: c.y, t: 0 });
    c.x = c.safe.x; c.y = c.safe.y; c.vx = c.vy = 0; c.climbing = false; c.stun = 0.4; c.target = null;
    this.fx.push({ kind: 'poof', x: c.x, y: c.y - CHIN_H / 2, t: 0 });
    this.events.push({ kind: 'splash' });
    this.say(text, 1.5);
  }
  private climbable(c: Chin) {
    return this.ents.find((e) => {
      if (e.gone || e.held || !e.tags.has('climb')) return false;
      const reach = e.tags.has('canopy') ? 24 : e.w / 2 + 8;
      return Math.abs(c.x - e.x) < reach && c.y > e.y - e.h - 6 && c.y - CHIN_H < e.y;
    });
  }
  /** Turns a tap target into the same input keys a player would press. */
  private steer(c: Chin, t: { x: number; y: number }): Input {
    const dx = t.x - c.x, dy = t.y - c.y;
    const out: Input = { dir: Math.abs(dx) > 10 ? sign(dx) : 0, up: false, down: false, jump: false };
    const ride = this.ent(c.riding);
    if (ride) {
      if (ride.tags.has('fly')) { out.up = dy < -12; out.down = dy > 12; }
      if (Math.abs(dx) < 14 && (!ride.tags.has('fly') || Math.abs(dy) < 14)) {
        c.target = null;
        // Arrived over solid ground: hop off onto it.
        if (ride.tags.has('fly') && this.floorAt(c.x, c.y - 4) - c.y < 70) { this.getOff(c); c.vy = -200; }
      }
      return out;
    }
    const ladder = this.climbable(c);
    if (c.climbing && ladder) {
      // Up (or down) to the target's height, then off sideways; from the top, walk off.
      if (dy > 24) { out.down = true; out.dir = 0; }
      else if (dy < -4 && c.y > ladder.y - ladder.h + 1) { out.up = true; out.dir = 0; }
    } else if (ladder && dy < -30 && ladder.y - ladder.h < c.y - 20) { out.up = true; out.dir = 0; }
    else if (dy < -30 && c.id === this.leader) {
      // A ride hovering just overhead: get under it and hop on.
      const fly = this.ents.find((e) => !e.gone && !e.held && e.tags.has('fly') && e.tags.has('ride') && e.riders.length < 2 && e.mood !== 'angry'
        && Math.abs(e.x - c.x) < e.w / 2 + 160 && e.y < c.y + 4 && e.y > c.y - CHIN_H - 90);
      if (fly) {
        const off = fly.x - c.x;
        out.dir = Math.abs(off) > fly.w / 4 ? sign(off) : 0;
        if (Math.abs(off) < fly.w / 2 + 6 && c.grounded) out.jump = true;
      }
    }
    if (c.grounded && out.dir && this.ledgeAhead(c, out.dir)) out.jump = true;
    if (Math.abs(dx) <= 10 && (!c.climbing || Math.abs(dy) < 20)) c.target = null;
    return out;
  }
  /** A step up ahead that a jump clears. */
  private ledgeAhead(c: Chin, dir: number) {
    const probe: Rect = { x: c.x + dir * (CHIN_W / 2 + 4) - 3, y: c.y - CHIN_H, w: 6, h: CHIN_H - 2 };
    if (this.walls().some((r) => overlap(probe, r) && c.y - r.y < 92 && c.y - r.y > 10)) return true;
    const x = c.x + dir * (CHIN_W / 2 + 10);
    return this.ents.some((e) => {
      if (e.gone || e.held || !e.tags.has('solid') || Math.abs(x - e.x) > e.w / 2) return false;
      const s = this.surface(e, x);
      return s !== null && c.y - s > 14 && c.y - s < 92;
    });
  }
  private danger(c: Chin, dir: number) {
    const x = c.x + dir * (CHIN_W / 2 + 16);
    if (this.water.some((w) => !w.frozen && x > w.x && x < w.x + w.w && Math.abs(c.y - w.y) < 30)) return true;
    return this.ents.some((e) => !e.gone && (e.burning > 0 || this.hostile(e)) && Math.abs(e.x - x) < e.w / 2 + 30 && Math.abs(e.y - c.y) < 60);
  }
  private hostile(e: Ent) {
    if (!e.tags.has('alive')) return false;
    if (e.role?.kind === 'guard') return e.mood === 'calm' || e.mood === 'angry';
    return e.mood === 'angry';
  }

  private updateChin(c: Chin, dt: number, lead: boolean) {
    c.stun = Math.max(0, c.stun - dt); c.rideCool = Math.max(0, c.rideCool - dt); c.cheer = Math.max(0, c.cheer - dt);
    let inp: Input = { dir: 0, up: false, down: false, jump: false };
    if (lead) {
      inp = { ...this.input };
      if (inp.dir || inp.up || inp.down || inp.jump) c.target = null;
      else if (c.target) inp = this.steer(c, c.target);
    } else inp = this.followInput(c, dt);
    if (c.stun > 0) inp = { dir: 0, up: false, down: false, jump: false };

    // Riding: the rider steers the thing and sits on it.
    const ride = this.ent(c.riding);
    if (c.riding !== null && !ride) c.riding = null;
    if (ride) {
      if (lead || !ride.riders.includes(this.leader)) this.drive(ride, inp, dt, lead);
      this.seat(c, ride);
      if (lead && inp.down && ride.grounded && !ride.tags.has('fly')) { this.getOff(c); c.vy = -300; }
      if (lead && inp.down && ride.tags.has('fly') && ride.grounded) { this.getOff(c); c.vy = -200; }
      if (lead && inp.dir && ride.dx === 0 && (ride.grounded || ride.floating || ride.tags.has('fly'))) {
        c.blocked += dt;
        if (c.blocked > 0.25) { this.getOff(c); c.vx = inp.dir * WALK; c.vy = -JUMP; c.blocked = 0; }
      } else c.blocked = 0;
      if (!lead && this.lead.riding !== c.riding) { this.getOff(c); c.vy = -250; }
      return this.touch(c);
    }

    // Climbing.
    const ladder = this.climbable(c);
    if (c.climbing && !ladder) c.climbing = false;
    if (!c.climbing && ladder && (inp.up || (inp.down && c.grounded && c.y <= ladder.y - ladder.h + 8))) { c.climbing = true; c.grounded = false; c.vx = 0; c.vy = 0; c.x += (ladder.x - c.x) * 0.5; }
    if (c.climbing && ladder) {
      c.vy = inp.up ? -CLIMB : inp.down ? CLIMB : 0;
      c.vx = 0;
      if (inp.dir) { c.climbing = false; c.vx = inp.dir * WALK; c.face = inp.dir; c.vy = -160; }
      else {
        c.y += c.vy * dt;
        const top = ladder.y - ladder.h;
        if (c.y <= top) { c.y = top; c.climbing = false; c.grounded = true; c.standOn = ladder.tags.has('solid') || ladder.tags.has('canopy') ? ladder.id : null; c.vy = 0; }
        if (c.y >= ladder.y && inp.down) { c.climbing = false; }
        const floor = this.floorAt(c.x, c.y - 4);
        if (c.y > floor) { c.y = floor; c.climbing = false; }
        return this.touch(c);
      }
    }

    // Walking and jumping.
    const air = !c.grounded;
    if (c.stun <= 0) {
      const want = inp.dir * WALK;
      c.vx = air ? c.vx + (want - c.vx) * Math.min(1, 6 * dt) : want;
      if (inp.dir) c.face = inp.dir;
    } else c.vx *= 1 - Math.min(1, 2 * dt);
    if (inp.jump && c.grounded) { c.vy = -JUMP; c.grounded = false; }
    c.vy = Math.min(900, c.vy + GRAVITY * dt);
    const carrier = this.ent(c.standOn);
    if (carrier && c.grounded) c.x += carrier.dx;
    const wasGrounded = c.grounded;
    const body: Body = { x: c.x, y: c.y, w: CHIN_W, h: CHIN_H, vx: c.vx, vy: c.vy };
    const m = this.move(body, dt, null, true, c.grounded ? c.standOn : null, 14);
    c.x = body.x; c.y = body.y; c.vx = body.vx; c.vy = body.vy;
    c.grounded = m.grounded; c.standOn = m.standOn;
    c.run += Math.abs(c.vx) * dt * 0.12;
    const under = this.ent(m.standOn);
    if (under && !wasGrounded && under.tags.has('bouncy')) {
      c.vy = -BOUNCE; c.grounded = false;
      this.fx.push({ kind: 'bounce', x: c.x, y: c.y, t: 0 });
    } else if (under && (under.tags.has('drive') || under.tags.has('boat') || (under.tags.has('ride') && !under.tags.has('fly')))) this.getOn(c, under);
    if (c.grounded && m.standOn === null && !this.waterAt(c.x, c.y + 6) && c.stun <= 0) c.safe = { x: c.x, y: c.y };
    return this.touch(c);
  }

  /** What touching the world does to a chinchilla: water, fire, grumpy animals, flying rides and the wolfberry. */
  private touch(c: Chin) {
    const box = chinBox(c);
    if (c.riding === null && this.waterAt(c.x, c.y)) return this.respawn(c, 'Splash! Chinchillas can’t swim.');
    if (c.y > H + 60) return this.respawn(c, 'Whoops! Back you come.');
    for (const e of this.ents) {
      if (e.gone || e.held || !overlap(box, boxOf(e), 2)) continue;
      if (e.burning > 0 && !e.riders.includes(c.id) && !HANDHELD.has(e.noun)) { this.knock(c, e.x, 'Ouch! Too hot!'); break; }
      if (this.hostile(e)) {
        this.knock(c, e.x, e.role?.kind === 'guard' ? (e.noun === 'puma' ? 'The puma swats you away!' : 'The zombie lurches at you! Eek!') : `The ${e.label} chases you off!`);
        break;
      }
      if (e.tags.has('fly') && e.tags.has('ride') && c.riding === null && !c.climbing && (c.id === this.leader || this.lead.riding === e.id)) this.getOn(c, e);
    }
    const b = this.berry;
    if (b && !b.got && b.lit && overlap(box, { x: b.x - 18, y: b.y - 44, w: 36, h: 44 }, 4) && this.state === 'playing') {
      b.got = true; this.state = 'won';
      this.chins.dora.cheer = this.chins.enzo.cheer = 3;
      this.fx.push({ kind: 'heart', x: b.x, y: b.y - 40, t: 0 });
      this.events.push({ kind: 'win' });
    }
  }

  /** The follower trails the leader, climbs after them, hops on their ride, and catches up by magic if stuck. */
  private followInput(c: Chin, dt: number): Input {
    const l = this.lead;
    const d = Math.hypot(l.x - c.x, l.y - c.y);
    const settled = (l.grounded || l.riding !== null) && l.stun <= 0 && !l.climbing;
    c.away = d > 260 || Math.abs(l.y - c.y) > 110 ? c.away + dt : 0;
    if (c.away > 3 && settled && c.stun <= 0 && this.state === 'playing') {
      c.away = 0;
      if (c.riding !== null) this.getOff(c);
      this.fx.push({ kind: 'poof', x: c.x, y: c.y - CHIN_H / 2, t: 0 });
      const ride = this.ent(l.riding);
      if (ride && ride.riders.length < 2) { c.riding = ride.id; ride.riders.push(c.id); this.seat(c, ride); }
      else {
        c.x = Math.max(CHIN_W / 2, Math.min(W - CHIN_W / 2, l.x - l.face * 56));
        c.y = l.y; c.vx = c.vy = 0; c.climbing = false;
        if (this.walls().some((r) => overlap(chinBox(c), r, -1))) c.x = l.x;
        c.standOn = l.standOn; c.grounded = true;
      }
      this.fx.push({ kind: 'poof', x: c.x, y: c.y - CHIN_H / 2, t: 0 });
      return { dir: 0, up: false, down: false, jump: false };
    }
    if (this.state === 'won') return { dir: 0, up: false, down: false, jump: false };
    const ride = this.ent(l.riding);
    if (ride && c.riding === null && d < 90 && ride.riders.length < 2 && (ride.grounded || ride.floating) && !ride.tags.has('fly')) this.getOn(c, ride);
    const tx = l.x - l.face * 64;
    const out = this.steer(c, { x: tx, y: l.y });
    c.target = null;
    if (Math.abs(tx - c.x) < 40 && Math.abs(l.y - c.y) < 30) out.dir = 0;
    if (out.dir && !c.climbing && this.danger(c, out.dir)) out.dir = 0;
    if (!l.climbing && l.y > c.y + 20 && c.climbing) out.down = true;
    return out;
  }

  // ---------- Things moving ----------

  /** A ridden thing, steered with the rider's keys. */
  private drive(e: Ent, inp: Input, dt: number, lead: boolean) {
    if (!lead) { e.vx = 0; return; }
    if (inp.dir) e.face = inp.dir;
    if (e.tags.has('fly')) {
      e.vx = inp.dir * e.speed; e.vy = inp.up ? -e.speed : inp.down ? e.speed : 0;
    } else if (e.tags.has('boat')) {
      e.vx = e.floating ? inp.dir * e.speed : 0;
    } else {
      e.vx = inp.dir * e.speed;
      if (inp.jump && e.grounded && e.tags.has('jumper')) { e.vy = -780; e.grounded = false; }
    }
    e.home = e.y;
    void dt;
  }

  private creature(e: Ent, dt: number) {
    if (e.riders.length) return;
    const flying = e.tags.has('fly');
    if (e.mood === 'sleepy' || e.mood === 'caged') { e.vx = 0; if (flying) e.vy = 0; return; }
    const lead = this.lead;
    if (e.mood === 'angry' && this.state === 'playing') {
      const dx = lead.x - e.x;
      e.vx = sign(dx) * e.speed * 0.8; e.face = sign(dx) || e.face;
      if (flying) e.vy = sign(lead.y - CHIN_H / 2 - (e.y - e.h / 2)) * e.speed * 0.6;
      return;
    }
    if (e.mood === 'hungry') {
      const food = this.nearest(e, (f) => f.tags.has('food') && f !== e && !f.held, 500);
      if (food) {
        const dx = food.x - e.x;
        e.vx = sign(dx) * e.speed * 0.7; e.face = sign(dx) || e.face;
        if (flying) e.vy = sign(food.y - e.y) * e.speed * 0.5;
        if (overlap(boxOf(e), boxOf(food), 4)) { this.drop(food); this.fx.push({ kind: 'eat', x: food.x, y: food.y - 10, t: 0 }); e.mood = 'happy'; this.say(`The ${e.label} gobbles up the ${food.label}.`); }
        return;
      }
    }
    e.wander -= dt;
    if (e.wander <= 0) {
      e.wander = 1.5 + this.rand() * 2.5;
      const r = this.rand();
      e.vx = r < 0.35 ? -e.speed * 0.35 : r < 0.7 ? e.speed * 0.35 : 0;
      if (Math.abs(e.x - e.home) > 0 && flying) e.vy = (this.rand() - 0.5) * 40;
      if (e.vx) e.face = sign(e.vx) as 1 | -1;
    }
    if (flying) {
      // Hover near where it was put.
      if (Math.abs(e.y - e.home) > 40) e.vy = sign(e.home - e.y) * 30;
    }
  }

  private nearest(from: Ent, ok: (e: Ent) => boolean, reach: number) {
    let best: Ent | undefined, bd = reach;
    for (const e of this.ents) {
      if (e.gone || e === from || !ok(e)) continue;
      const d = Math.hypot(e.x - from.x, e.y - from.y);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  private resident(e: Ent, dt: number) {
    const r = e.role!;
    if (r.kind === 'blocker') {
      if (e.mood === 'happy') {
        const dx = r.leaveTo - e.x;
        e.vx = Math.abs(dx) > 4 ? sign(dx) * 90 : 0; e.face = sign(dx) || e.face;
        if (e.x > W + 60 || e.x < -60) e.gone = true;
        return;
      }
      e.vx = 0;
      const gift = this.nearest(e, (f) => !f.level && !f.held && r.needs.some((t) => f.tags.has(t)), 120);
      if (gift) {
        if (r.consume) { this.drop(gift, true); this.fx.push({ kind: 'eat', x: gift.x, y: gift.y - 10, t: 0 }); }
        e.mood = 'happy'; e.tags.delete('wall');
        this.fx.push({ kind: 'heart', x: e.x, y: e.y - e.h, t: 0 });
        this.say(r.thanks, 0);
        return;
      }
      const l = this.lead;
      if (Math.abs(l.x - e.x) < 150 && this.time - r.asked > 8) { r.asked = this.time; this.say(r.asks, 0); }
    } else if (r.kind === 'guard') {
      if (e.mood === 'caged' || e.mood === 'sleepy') { e.vx = 0; return; }
      if (e.mood === 'fled') {
        e.vx = e.face * 280;
        e.x += e.vx * dt;
        if (e.x < -120 || e.x > W + 120) e.gone = true;
        return;
      }
      const cage = this.ents.find((t) => !t.gone && !t.held && t.tags.has('trap') && overlap(boxOf(t), boxOf(e), -4));
      if (cage) {
        e.mood = 'caged'; e.vx = 0; cage.x = e.x; cage.stuck = true; cage.vy = 0;
        this.say(e.noun === 'puma' ? 'Caught! The puma sulks in the cage.' : 'Caught! The zombie rattles the bars.', 0);
        return;
      }
      const scare = this.nearest(e, (f) => !f.level && !f.held && (r.flee.some((t) => f.tags.has(t)) || (r.flee.includes('flame') && f.burning > 0)) && f.mood !== 'sleepy' && f.mood !== 'caged', 230);
      if (scare) {
        e.mood = 'fled'; e.face = scare.x > e.x ? -1 : 1;
        this.say(e.noun === 'puma' ? `The puma takes one look at the ${scare.label} and bolts!` : `“Braaains?” The zombie sees the ${scare.label} and runs for it!`, 0);
        return;
      }
      const snack = this.nearest(e, (f) => !f.level && !f.held && r.tame.some((t) => f.tags.has(t)), 320);
      if (snack) {
        const dx = snack.x - e.x;
        e.vx = sign(dx) * e.speed * 1.2; e.face = sign(dx) || e.face;
        if (overlap(boxOf(e), boxOf(snack), 6)) {
          this.drop(snack, true); this.fx.push({ kind: 'eat', x: snack.x, y: snack.y - 10, t: 0 });
          e.mood = 'sleepy'; e.vx = 0;
          this.say(e.noun === 'puma' ? `The puma gobbles the ${snack.label} and curls up for a nap.` : `The zombie munches the ${snack.label} and dozes off, full.`, 0);
        }
        return;
      }
      const l = this.lead, f = this.follow;
      const near = [l, f].find((c) => c.x > r.from - 80 && c.x < r.to + 80 && Math.abs(c.y - e.y) < 90 && c.stun <= 0);
      if (near) { const dx = near.x - e.x; e.vx = sign(dx) * e.speed * 1.6; e.face = sign(dx) || e.face; }
      else {
        if (e.x <= r.from) e.face = 1; else if (e.x >= r.to) e.face = -1;
        e.vx = e.face * e.speed;
      }
      if ((e.x < r.from - 20 && e.vx < 0) || (e.x > r.to + 20 && e.vx > 0)) e.vx = 0;
    } else if (r.kind === 'gate') {
      const plate = this.ent(r.plate)!;
      const load = this.load(plate, 0);
      const was = r.open;
      r.open = Math.max(0, Math.min(1, r.open + (load >= r.need ? 1.2 : -1.2) * dt));
      if (was < 1 && r.open >= 1) this.say('Clunk! The gate grinds open.', 0);
      if (load > 0 && load < r.need) this.say('The plate clicks, but it needs something much heavier.', 5);
    }
  }
  /** How much weighs on a thing: whatever stands on it, and whatever stands on that. */
  private load(p: Ent, depth: number): number {
    if (depth > 6) return 0;
    let sum = 0;
    for (const e of this.ents) if (!e.gone && !e.held && e.standOn === p.id && e.grounded) sum += e.mass + this.load(e, depth + 1);
    for (const c of Object.values(this.chins)) if (c.standOn === p.id && c.grounded) sum += 1;
    return sum;
  }

  private physics(e: Ent, dt: number) {
    const x0 = e.x;
    if (e.held || e.stuck) { e.dx = 0; e.grounded = !e.held; return; }
    if (e.role?.kind === 'guard' && e.mood === 'fled') { e.dx = e.x - x0; return; }
    const flying = e.tags.has('fly');
    if (!flying) e.vy = Math.min(900, e.vy + GRAVITY * dt);
    else if (!e.riders.length && !e.tags.has('alive')) { e.vx *= 1 - Math.min(1, 4 * dt); e.vy = Math.abs(e.y - e.home) > 1 ? sign(e.home - e.y) * Math.min(60, Math.abs(e.home - e.y) * 4) : 0; }
    if (!e.tags.has('alive') && !e.riders.length && !flying && e.grounded) e.vx *= 1 - Math.min(1, 8 * dt);
    const body: Body = { x: e.x, y: e.y, w: e.w, h: e.h, vx: e.vx, vy: e.vy };
    const fallV = e.vy;
    const m = this.move(body, dt, e, !flying, e.grounded ? e.standOn : null, e.tags.has('alive') ? 16 : 4);
    e.x = body.x; e.y = body.y; e.vx = body.vx; e.vy = body.vy;
    e.grounded = m.grounded; e.standOn = m.standOn;
    const carrier = this.ent(m.standOn);
    if (carrier && carrier.dx) e.x += carrier.dx;
    if (m.grounded && e.tags.has('bouncy') && fallV > 260 && !e.riders.length) { e.vy = -fallV * 0.6; e.grounded = false; }
    // Water: floaters bob at the top, everything else sinks slowly.
    const pool = this.water.find((w) => !w.frozen && e.x > w.x && e.x < w.x + w.w && e.y > w.y && e.y - e.h < w.y + w.h);
    e.floating = false;
    if (pool && !flying) {
      if (e.tags.has('float') || e.tags.has('boat')) {
        const rest = pool.y + Math.min(e.h * 0.35, 18);
        e.y += (rest - e.y) * Math.min(1, 8 * dt); e.vy = 0; e.floating = true; e.grounded = false;
        if (!e.riders.length) e.vx *= 1 - Math.min(1, 1.5 * dt);
      } else e.vy = Math.min(e.vy, 110);
    }
    if (e.y > H + 300) e.gone = true;
    e.dx = e.x - x0;
  }

  /** Fire, water, cold, blasts and tools doing things to each other. */
  private interact(dt: number) {
    const live = this.ents.filter((e) => !e.gone);
    const rains = live.filter((e) => e.tags.has('rain'));
    for (const e of live) {
      if (e.burning > 0) {
        const doused = live.some((o) => o !== e && !o.held && (o.tags.has('wet') || o.tags.has('cold')) && overlap(boxOf(o), boxOf(e), 4))
          || rains.some((r) => Math.abs(r.x - e.x) < r.w / 2 + e.w / 2 - 10 && e.y > r.y);
        if (doused) {
          e.burning = 0; this.fx.push({ kind: 'steam', x: e.x, y: e.y - e.h / 2, t: 0 });
          if (e.role?.kind === 'campfire') { e.mood = 'out'; e.tags.delete('flame'); e.tags.delete('hot'); e.tags.delete('light'); this.say('Fsssh! The campfire is out.', 0); }
          else if (e.noun === 'fire') this.drop(e, true);
          else { e.tags.delete('flame'); this.say(`Fsssh! The ${e.label} stops burning.`); }
          continue;
        }
        if (e.burning !== Infinity) {
          e.burning -= dt;
          if (e.burning <= 0) { this.drop(e); this.fx.push({ kind: 'steam', x: e.x, y: e.y - e.h / 2, t: 0 }); this.say(`The ${e.label} burned away.`); continue; }
        }
        for (const o of live) {
          if (o === e || o.burning > 0 || o.held) continue;
          if (!overlap(boxOf(o), boxOf(e), 2)) continue;
          if (o.tags.has('explode')) o.fuse = Math.min(o.fuse || FUSE, 0.2);
          if (o.tags.has('burn') && !o.tags.has('wet')) {
            o.heat += dt;
            if (o.heat > 0.8) { o.burning = BURN_TIME; o.tags.add('flame'); o.tags.add('light'); this.say(`The ${o.label} caught fire!`); }
          }
        }
      }
      if (e.tags.has('cold') && !e.held) {
        const pool = this.water.find((w) => !w.frozen && overlap(boxOf(e), w, 2));
        if (pool) { pool.frozen = true; this.fx.push({ kind: 'spark', x: e.x, y: pool.y, t: 0 }); this.say('Crackle! The water froze solid.', 0); }
      }
      if (e.tags.has('break') && !e.held) {
        const rock = live.find((o) => o.role?.kind === 'rockwall' && overlap(boxOf(o), boxOf(e), 8));
        if (rock && rock.role?.kind === 'rockwall') { rock.role.hp -= dt; if (rock.role.hp <= 0) this.crumble(rock); }
      }
      if (e.fuse > 0 && !e.gone) {
        e.fuse -= dt;
        if (e.fuse <= 0) this.blast(e);
      }
      if (e.noun === 'water' && e.grounded) { e.life += dt; if (e.life > 5) this.drop(e, true); }
    }
  }
  private crumble(rock: Ent) {
    rock.gone = true;
    this.fx.push({ kind: 'rubble', x: rock.x, y: rock.y - rock.h / 2, t: 0 });
    this.say('Crack! The rocks tumble away.', 0);
  }
  private blast(e: Ent) {
    this.drop(e, true);
    this.fx.push({ kind: 'boom', x: e.x, y: e.y - e.h / 2, t: 0 });
    this.events.push({ kind: 'boom' });
    const cx = e.x, cy = e.y - e.h / 2;
    for (const o of this.ents) {
      if (o.gone) continue;
      const d = Math.hypot(o.x - cx, o.y - o.h / 2 - cy) - Math.max(o.w, o.h) / 2;
      if (d > BLAST) continue;
      if (o.role?.kind === 'rockwall') { this.crumble(o); continue; }
      if (o.role?.kind === 'guard' && (o.mood === 'calm' || o.mood === 'angry')) { o.mood = 'fled'; o.face = o.x < cx ? -1 : 1; this.say(`BOOM! The ${o.noun} runs for the hills.`, 0); continue; }
      if (o.level || o.stuck) continue;
      o.vx += sign(o.x - cx || 1) * 380; o.vy = -460; o.grounded = false;
      if (o.tags.has('explode')) o.fuse = Math.min(o.fuse || FUSE, 0.15);
      if (o.tags.has('burn')) { o.burning = BURN_TIME; o.tags.add('flame'); }
    }
    for (const c of Object.values(this.chins)) {
      if (Math.hypot(c.x - cx, c.y - CHIN_H / 2 - cy) < BLAST + 20) this.knock(c, cx, 'BOOM! A bit close, that one.');
    }
  }

  update(dt: number) {
    this.time += dt;
    for (const f of this.fx) f.t += dt;
    this.fx = this.fx.filter((f) => f.t < 1.4);
    // Residents and creatures decide, things move (lowest first so stacks settle), then the chinchillas.
    for (const e of this.ents) {
      if (e.gone) continue;
      if (e.role) this.resident(e, dt);
      else if (e.tags.has('alive')) this.creature(e, dt);
    }
    const order = this.ents.filter((e) => !e.gone).sort((a, b) => b.y - a.y);
    for (const e of order) this.physics(e, dt);
    this.interact(dt);
    if (this.berry && this.def.dark) {
      const b = this.berry;
      b.lit = this.ents.some((e) => !e.gone && (e.tags.has('light') || e.burning > 0) && Math.hypot(e.x - b.x, e.y - e.h / 2 - (b.y - 20)) < LIGHT_REACH);
      if (!b.lit && Math.hypot(this.lead.x - b.x, this.lead.y - b.y) < 90) this.say('It’s too dark to see anything up here. Some light would help.', 6);
    }
    this.updateChin(this.lead, dt, true);
    this.updateChin(this.follow, dt, false);
    this.ents = this.ents.filter((e) => !e.gone);
    this.input.jump = false;
  }
}
