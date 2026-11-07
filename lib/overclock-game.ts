// Overclock: the rules. A deterministic run-and-gun platformer engine (60 ticks a second, seeded, no DOM). One hero
// leads while the other follows a few steps behind; Shift tags them round instantly with a swap-in attack. Dora: a
// rapid arm-blaster, a dash and a wall-climb. Enzo: a shoulder cannon that charges through three levels, a hover and a
// deflect shield. Each of the eight bosses gives a core that becomes a different power for each hero, and rebooting a
// boss changes another stage of the city. Stages, items and routes are in lib/overclock-world.ts.
import {
  STAGES, T, ROWS, BOSS_STAGES, CORE_BOSSES, STAGE_OF, WEAK, CHANGES, BOSS_NAME, ITEM_STAGE,
  type Stage, type StageId, type BossId, type CoreBoss, type FoeKind, type Arena, type ItemSpot, type Req,
} from './overclock-world.js';
import { FOE_BOXES, BOSS_BOXES, MINI_BOXES } from './overclock-boxes.js';

export { STAGES, BOSS_STAGES, CORE_BOSSES, STAGE_OF, WEAK, CHANGES, BOSS_NAME, ITEM_STAGE, T, ROWS };
export type { Stage, StageId, BossId, CoreBoss, FoeKind, Arena, ItemSpot, Req };

export const SAVE_KEY = 'overclock-v1';
export const VIEW_W = 384, VIEW_H = 216;
export type HeroId = 'dora' | 'enzo';
export type Input = { left: boolean; right: boolean; up: boolean; down: boolean; jump: boolean; shoot: boolean; dash: boolean; prev: boolean; next: boolean; tag: boolean; shield: boolean };
export const NO_INPUT: Input = { left: false, right: false, up: false, down: false, jump: false, shoot: false, dash: false, prev: false, next: false, tag: false, shield: false };
export const other = (h: HeroId): HeroId => (h === 'dora' ? 'enzo' : 'dora');
export const NAME: Record<HeroId, string> = { dora: 'Dora', enzo: 'Enzo' };

// ─── physics ────────────────────────────────────────────────────────────────
export const HW = 12, HH = 28;
export const GRAV = 0.25, MAX_FALL = 5.5, JUMP_V = 5.5, JUMP_CUT = -2;
export const RUN: Record<HeroId, number> = { dora: 1.6, enzo: 1.45 };
export const DASH_V = 3.3, DASH_T = 18, AIRDASH_T = 22, DASH_CD = 6;
export const SLIDE: Record<HeroId, number> = { dora: 0.45, enzo: 1.1 };
export const CLIMB_V = 1.3, KICK_VX = 2.2, KICK_VY = 5.2, KICK_T = 8;
export const HOVER_T = 60, COYOTE = 6, BUFFER = 6;
export const CHARGE = [30, 70, 110] as const;
export const BIKE_V = 2.7, BIKE_JUMP = 7.2;
export const TAG_CD = 40;
/** how long a knocked-out hero rests before they can tag in again (a checkpoint brings them back sooner) */
export const REST_T = 60 * 20;

// ─── powers: each core is a different power for each hero ──────────────────
export type PowerId = 'blaster' | 'cannon' | 'magnet' | 'ghost' | 'drill' | 'decoy' | 'spark' | 'toss' | 'moon' | 'swarm'
  | 'plate' | 'glob' | 'mine' | 'prism' | 'cloud' | 'quake' | 'strike' | 'flare';
export type PowerInfo = { id: PowerId; hero: HeroId; core: CoreBoss | null; name: string; cost: number; text: string; color: string };
export const POWERS: PowerInfo[] = [
  { id: 'blaster', hero: 'dora', core: null, name: 'Arm Blaster', cost: 0, text: 'Quick small shots. Hold to keep firing.', color: '#ff6aa0' },
  { id: 'magnet', hero: 'dora', core: 'crab', name: 'Magnet Pull', cost: 1, text: 'A shot that drags pickups to Dora and pulls shields off robots.', color: '#ff4a4a' },
  { id: 'ghost', hero: 'dora', core: 'chameleon', name: 'Ghost Step', cost: 4, text: 'Fade out for a second and a half: shots and robots pass through.', color: '#9cff5a' },
  { id: 'drill', hero: 'dora', core: 'mole', name: 'Drill Dash', cost: 2, text: 'A spinning dash that hits hard and breaks cracked blocks.', color: '#ffa040' },
  { id: 'decoy', hero: 'dora', core: 'peacock', name: 'Decoy', cost: 3, text: 'A hologram Dora that robots aim at instead.', color: '#b07aff' },
  { id: 'spark', hero: 'dora', core: 'heron', name: 'Chain Spark', cost: 1, text: 'A spark that jumps on to two more robots.', color: '#6ab4ff' },
  { id: 'toss', hero: 'dora', core: 'rhino', name: 'Scrap Toss', cost: 2, text: 'A heavy lobbed chunk that bounces once and breaks cracked blocks.', color: '#c8a050' },
  { id: 'moon', hero: 'dora', core: 'owl', name: 'Moon Hop', cost: 3, text: 'Six seconds of floaty low-gravity jumps.', color: '#c070ff' },
  { id: 'swarm', hero: 'dora', core: 'firefly', name: 'Firefly Swarm', cost: 2, text: 'Four fireflies circle, then seek out robots.', color: '#d8ff40' },
  { id: 'cannon', hero: 'enzo', core: null, name: 'Charge Cannon', cost: 0, text: 'Tap for a pellet. Hold to charge three levels; a full charge pierces and breaks cracked blocks.', color: '#a8ff3a' },
  { id: 'plate', hero: 'enzo', core: 'crab', name: 'Magnet Plate', cost: 3, text: 'A floating magnet plate to stand on, for four seconds.', color: '#ff4a4a' },
  { id: 'glob', hero: 'enzo', core: 'chameleon', name: 'Sticky Glob', cost: 2, text: 'A lobbed glob that glues a robot in place.', color: '#9cff5a' },
  { id: 'mine', hero: 'enzo', core: 'mole', name: 'Burrow Mine', cost: 2, text: 'Tunnels along the floor and bursts up under the first robot.', color: '#ffa040' },
  { id: 'prism', hero: 'enzo', core: 'peacock', name: 'Prism Laser', cost: 1, text: 'A fast beam that bounces off walls three times.', color: '#b07aff' },
  { id: 'cloud', hero: 'enzo', core: 'heron', name: 'Thunder Cloud', cost: 4, text: 'A little cloud follows Enzo and zaps robots below it.', color: '#6ab4ff' },
  { id: 'quake', hero: 'enzo', core: 'rhino', name: 'Quake Stomp', cost: 3, text: 'Shock waves run both ways along the floor and break cracked blocks.', color: '#c8a050' },
  { id: 'strike', hero: 'enzo', core: 'owl', name: 'Orbital Strike', cost: 3, text: 'Marks a spot ahead; a beam from the sky hits it a moment later.', color: '#c070ff' },
  { id: 'flare', hero: 'enzo', core: 'firefly', name: 'Flare', cost: 6, text: 'A blinding flash that stuns and hurts every robot on screen.', color: '#d8ff40' },
];
export const POWER = Object.fromEntries(POWERS.map((p) => [p.id, p])) as Record<PowerId, PowerInfo>;
export const BASE: Record<HeroId, PowerId> = { dora: 'blaster', enzo: 'cannon' };

// ─── mod chips, items, saves ────────────────────────────────────────────────
export type ChipId = 'bolt-magnet' | 'quick-charge' | 'long-hover' | 'tough-fur' | 'rapid' | 'saver' | 'swift-tag' | 'second-wind';
export const CHIPS: { id: ChipId; name: string; price: number; text: string }[] = [
  { id: 'bolt-magnet', name: 'Bolt Magnet', price: 40, text: 'Bolts and capsules drift to you from further away.' },
  { id: 'quick-charge', name: 'Quick Charge', price: 70, text: 'Enzo’s cannon charges a third faster.' },
  { id: 'long-hover', name: 'Long Hover', price: 60, text: 'Enzo hovers for 1.6 s instead of 1 s.' },
  { id: 'tough-fur', name: 'Tough Fur', price: 90, text: 'Both heroes take a quarter less damage.' },
  { id: 'rapid', name: 'Rapid Fire', price: 80, text: 'Dora fires faster, and Enzo can have three pellets out.' },
  { id: 'saver', name: 'Energy Saver', price: 100, text: 'Powers cost half the energy.' },
  { id: 'swift-tag', name: 'Swift Tag', price: 60, text: 'Tag again sooner, and the swap-in attack hits twice as hard.' },
  { id: 'second-wind', name: 'Second Wind', price: 120, text: 'Once a stage, a hero who would be knocked out keeps 1 health.' },
];
export const CHIP_SLOTS = 3;
export const ITEM_NAME: Record<string, string> = { heart: 'Heart Cell', tank: 'Energy Tank', helmet: 'Sensor Band', legs: 'Thruster Boots', body: 'Plate Vest', arm: 'Twin-Core Arm' };
export const ITEM_TEXT: Record<string, string> = {
  heart: 'Both heroes gain 2 maximum health.',
  tank: 'A spare tank that refills a hero’s health. Use it from the pause menu.',
  helmet: 'Shows hidden capsules and cracked blocks, and marks every capsule on the map.',
  legs: 'Both heroes can dash once in mid-air.',
  body: 'Both heroes take half damage.',
  arm: 'Enzo’s full charge fires twice, and Dora can have five shots out.',
};
export const BASE_HP = 16, MAX_EN = 28;

export type Save = {
  v: 1; intro: boolean; beaten: BossId[]; items: string[]; bolts: number; chips: ChipId[]; equipped: ChipId[];
  tanks: number; time: number; seen: string[]; ending: boolean; clears: Record<string, number>;
};
export function freshSave(): Save {
  return { v: 1, intro: false, beaten: [], items: [], bolts: 0, chips: [], equipped: [], tanks: 0, time: 0, seen: [], ending: false, clears: {} };
}
const BOSS_IDS: BossId[] = ['sentinel', 'crab', 'chameleon', 'mole', 'peacock', 'heron', 'rhino', 'owl', 'firefly', 'spider', 'serpent', 'lumen'];
const ALL_ITEM_IDS = BOSS_STAGES.flatMap((s) => STAGES[s].items.map((i) => i.id));
/** Read a save; anything malformed gives null (and the page starts fresh). */
export function parseSave(raw: string | null): Save | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as Partial<Save>;
    if (!o || typeof o !== 'object' || o.v !== 1) return null;
    const s = freshSave();
    s.intro = o.intro === true;
    s.beaten = Array.isArray(o.beaten) ? o.beaten.filter((b): b is BossId => BOSS_IDS.includes(b as BossId)) : [];
    s.items = Array.isArray(o.items) ? o.items.filter((i): i is string => ALL_ITEM_IDS.includes(i as string)) : [];
    s.bolts = Number.isFinite(o.bolts) ? Math.max(0, Math.min(9999, Math.floor(o.bolts as number))) : 0;
    s.chips = Array.isArray(o.chips) ? o.chips.filter((c): c is ChipId => CHIPS.some((x) => x.id === c)) : [];
    s.equipped = Array.isArray(o.equipped) ? o.equipped.filter((c): c is ChipId => s.chips.includes(c as ChipId)).slice(0, CHIP_SLOTS) : [];
    s.tanks = Number.isFinite(o.tanks) ? Math.max(0, Math.min(tankCount(s), Math.floor(o.tanks as number))) : 0;
    s.time = Number.isFinite(o.time) ? Math.max(0, o.time as number) : 0;
    s.seen = Array.isArray(o.seen) ? o.seen.filter((x): x is string => typeof x === 'string').slice(0, 200) : [];
    s.ending = o.ending === true;
    s.clears = o.clears && typeof o.clears === 'object' ? Object.fromEntries(Object.entries(o.clears).filter(([k, v]) => typeof k === 'string' && Number.isFinite(v))) as Record<string, number> : {};
    s.beaten = [...new Set(s.beaten)]; s.items = [...new Set(s.items)]; s.chips = [...new Set(s.chips)]; s.equipped = [...new Set(s.equipped)];
    return s;
  } catch { return null; }
}
export const kindOf = (id: string) => (id.startsWith('heart') ? 'heart' : id.startsWith('tank') ? 'tank' : id) as ItemSpot['kind'];
export const heartCount = (s: Save) => s.items.filter((i) => kindOf(i) === 'heart').length;
export const tankCount = (s: Save) => s.items.filter((i) => kindOf(i) === 'tank').length;
export const hasArmour = (s: Save, a: 'helmet' | 'legs' | 'body' | 'arm') => s.items.includes(a);
export const maxHp = (s: Save) => BASE_HP + 2 * heartCount(s);
export const cores = (s: Save) => CORE_BOSSES.filter((b) => s.beaten.includes(b));
export const powersOf = (s: Save, h: HeroId): PowerId[] => [BASE[h], ...POWERS.filter((p) => p.hero === h && p.core && s.beaten.includes(p.core)).map((p) => p.id)];
export const fortressOpen = (s: Save) => CORE_BOSSES.every((b) => s.beaten.includes(b));
export const stageOpen = (s: Save, id: StageId) => id === 'intro' || id === 'training' ? true
  : BOSS_STAGES.includes(id) ? s.intro
  : id === 'tower1' ? fortressOpen(s) : id === 'tower2' ? s.beaten.includes('spider') : id === 'tower3' ? s.beaten.includes('serpent') : false;
/** Why a locked stage is locked, for the stage select. */
export function lockedWhy(s: Save, id: StageId) {
  if (stageOpen(s, id)) return '';
  if (BOSS_STAGES.includes(id)) return 'Finish the rooftop run first.';
  if (id === 'tower1') return `Reboot all eight bosses first (${cores(s).length} of 8).`;
  return id === 'tower2' ? 'Reboot the Antenna Spider first.' : 'Reboot the Cable Serpent first.';
}
/** The stage-select hint: which core a boss is weak to, once you have it. */
export function weakHint(s: Save, b: CoreBoss) {
  const w = WEAK[b];
  if (!s.beaten.includes(w)) return '';
  const ps = POWERS.filter((p) => p.core === w).map((p) => p.name);
  return `Weak to the ${BOSS_NAME[w]} core: ${ps.join(' or ')}`;
}
/** Is a gate (a city change) open in this save? */
export const gateOn = (s: Save, st: Stage) => !!st.gate && s.beaten.includes(st.gate);
/** Can this save reach an item: the city has changed for it, the air-dash, the bike? */
export const reqMet = (s: Save, r: Req) => (!r.flag || s.beaten.includes(r.flag)) && (!r.legs || hasArmour(s, 'legs'));

// the shop
export function buyChip(s: Save, id: ChipId): { ok: boolean; why: string } {
  const c = CHIPS.find((x) => x.id === id);
  if (!c) return { ok: false, why: 'No such chip.' };
  if (s.chips.includes(id)) return { ok: false, why: 'Already bought.' };
  if (s.bolts < c.price) return { ok: false, why: `Needs ${c.price} bolts (you have ${s.bolts}).` };
  s.bolts -= c.price; s.chips.push(id);
  if (s.equipped.length < CHIP_SLOTS) s.equipped.push(id);
  return { ok: true, why: '' };
}
export function toggleChip(s: Save, id: ChipId): { ok: boolean; why: string } {
  if (!s.chips.includes(id)) return { ok: false, why: 'Buy it from Pip first.' };
  if (s.equipped.includes(id)) { s.equipped = s.equipped.filter((c) => c !== id); return { ok: true, why: '' }; }
  if (s.equipped.length >= CHIP_SLOTS) return { ok: false, why: 'All three chip slots are full: take one out first.' };
  s.equipped.push(id); return { ok: true, why: '' };
}
export const completion = (s: Save) => {
  const got = ALL_ITEM_IDS.filter((i) => s.items.includes(i)).length;
  const bosses = [...CORE_BOSSES, 'spider', 'serpent', 'lumen'].filter((b) => s.beaten.includes(b as BossId)).length;
  return { items: got, itemsOf: ALL_ITEM_IDS.length, bosses, bossesOf: 11, pct: Math.round(((got + bosses) / (ALL_ITEM_IDS.length + 11)) * 100) };
};

// ─── foes ───────────────────────────────────────────────────────────────────
export type FoeInfo = { hp: number; w: number; h: number; fly: boolean; hang: boolean; dmg: number; bolts: number };
export const FOES: Record<FoeKind, FoeInfo> = {
  drone: { hp: 3, w: 22, h: 20, fly: true, hang: false, dmg: 3, bolts: 2 },
  sentry: { hp: 4, w: 24, h: 24, fly: false, hang: false, dmg: 3, bolts: 2 },
  bat: { hp: 2, w: 26, h: 16, fly: true, hang: false, dmg: 3, bolts: 1 },
  hopper: { hp: 3, w: 20, h: 20, fly: false, hang: false, dmg: 3, bolts: 2 },
  claw: { hp: 4, w: 22, h: 22, fly: true, hang: true, dmg: 4, bolts: 2 },
  riot: { hp: 5, w: 22, h: 26, fly: false, hang: false, dmg: 3, bolts: 3 },
  gecko: { hp: 3, w: 28, h: 14, fly: false, hang: false, dmg: 3, bolts: 2 },
  grub: { hp: 3, w: 16, h: 26, fly: false, hang: false, dmg: 3, bolts: 2 },
  holo: { hp: 4, w: 22, h: 18, fly: true, hang: true, dmg: 3, bolts: 2 },
  jelly: { hp: 3, w: 20, h: 24, fly: true, hang: false, dmg: 3, bolts: 2 },
  cube: { hp: 5, w: 24, h: 24, fly: false, hang: false, dmg: 4, bolts: 3 },
  dish: { hp: 4, w: 22, h: 26, fly: false, hang: false, dmg: 3, bolts: 2 },
  firefly: { hp: 1, w: 14, h: 12, fly: true, hang: false, dmg: 2, bolts: 1 },
  sweeper: { hp: 5, w: 28, h: 22, fly: false, hang: false, dmg: 4, bolts: 3 },
};
export type FoeSt = 'idle' | 'tell' | 'attack' | 'hurt';
export type Foe = {
  id: number; kind: FoeKind; x: number; y: number; vx: number; vy: number; hp: number; max: number; face: 1 | -1; st: FoeSt; t: number; cd: number;
  flash: number; alive: boolean; hx: number; hy: number; big: boolean; shield: boolean; frozen: number; hidden: boolean; ground: boolean; mini: boolean; respawn: number;
};
/** A foe's animation frame (0 idle, 1 tell, 2 attack, 3 hurt) in its four-frame row. */
export const foeFrame = (e: { st: FoeSt; flash: number }) => (e.st === 'tell' ? 1 : e.st === 'attack' ? 2 : e.st === 'hurt' || e.flash > 6 ? 3 : 0);
export type Rect = { x: number; y: number; w: number; h: number };
const overlap = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
/** A foe's hitbox for its current frame: the measured outline of the painted frame (lib/overclock-boxes.ts), so what
 *  you see is what you hit. Faces left in the art; flipped when facing right. */
/** A mini-boss's frame in its own eight-frame sheet (idle 0-1, tell 2, attack 3-4, move 5, hurt 6, beaten 7). */
export const miniFrame = (e: { st: FoeSt; flash: number; t: number; vx: number; alive?: boolean }) =>
  e.alive === false ? 7 : e.st === 'hurt' || e.flash > 6 ? 6 : e.st === 'tell' ? 2 : e.st === 'attack' ? 3 + ((e.t >> 3) & 1) : Math.abs(e.vx) > 0.2 ? 5 : (e.t >> 4) & 1;
export function foeBox(e: { kind: FoeKind; x: number; y: number; face: number; big: boolean; st: FoeSt; flash: number; t?: number; vx?: number }): Rect {
  const mb = e.big ? MINI_BOXES[e.kind]?.[miniFrame({ ...e, t: e.t ?? 0, vx: e.vx ?? 0 })] : null;
  if (mb) { const [x0, y0, w, h] = mb; const x = e.face > 0 ? -(x0 + w) : x0; const sx = w * 0.1, sy = h * 0.1; return { x: e.x + x + sx, y: e.y + y0 + sy, w: w - 2 * sx, h: h - 2 * sy }; }
  const k = e.big ? 2 : 1;
  const b = FOE_BOXES[e.kind]?.[foeFrame(e)];
  if (!b) { const f = FOES[e.kind]; return { x: e.x - (f.w * k) / 2, y: e.y - (f.h * k) / 2, w: f.w * k, h: f.h * k }; }
  const [x0, y0, w, h] = b;
  const x = e.face > 0 ? -(x0 + w) : x0;
  return { x: e.x + x * k, y: e.y + y0 * k, w: w * k, h: h * k };
}

// ─── bosses ─────────────────────────────────────────────────────────────────
/** each district's mini-boss: a big, souped-up cousin of a local robot */
export const MINI_NAME: Partial<Record<FoeKind, string>> = {
  claw: 'Big Crane Claw', gecko: 'Billboard Gecko', grub: 'Rail Grub', holo: 'Holo Lantern', sentry: 'Toll Sentry', cube: 'Crusher Cube',
  dish: 'Dish Turret', firefly: 'Lamp Bug',
};
export type BossInfo = { hp: number; w: number; h: number; fly: boolean; dmg: number; attacks: string[][] };
export const BOSSES: Record<BossId, BossInfo> = {
  sentinel: { hp: 22, w: 64, h: 64, fly: false, dmg: 3, attacks: [['roll', 'volley'], ['roll', 'volley', 'hop'], ['roll', 'volley', 'hop']] },
  crab: { hp: 40, w: 100, h: 78, fly: false, dmg: 4, attacks: [['pull', 'slam', 'scuttle'], ['pull', 'slam', 'scuttle', 'scrap'], ['slam', 'scuttle', 'scrap', 'pull']] },
  chameleon: { hp: 40, w: 92, h: 72, fly: false, dmg: 4, attacks: [['tongue', 'spit', 'hide'], ['tongue', 'spit', 'hide'], ['hide', 'tongue', 'spit', 'hide']] },
  mole: { hp: 38, w: 106, h: 102, fly: false, dmg: 3, attacks: [['drill', 'burrow'], ['drill', 'burrow', 'rocks'], ['burrow', 'rocks', 'drill']] },
  peacock: { hp: 40, w: 84, h: 100, fly: false, dmg: 3, attacks: [['fan', 'peck'], ['fan', 'peck', 'leap'], ['fan', 'leap', 'peck', 'fan']] },
  heron: { hp: 44, w: 54, h: 102, fly: true, dmg: 5, attacks: [['storm', 'stab'], ['storm', 'stab', 'gust'], ['storm', 'gust', 'stab']] },
  rhino: { hp: 38, w: 104, h: 88, fly: false, dmg: 4, attacks: [['charge', 'stomp'], ['charge', 'stomp', 'jump'], ['charge', 'jump', 'stomp']] },
  owl: { hp: 40, w: 54, h: 88, fly: true, dmg: 4, attacks: [['beam', 'swoop'], ['beam', 'swoop', 'orbit'], ['orbit', 'beam', 'swoop']] },
  firefly: { hp: 40, w: 80, h: 84, fly: true, dmg: 4, attacks: [['swarm', 'blaze', 'dive'], ['swarm', 'blaze', 'dive'], ['blaze', 'dive', 'swarm', 'blaze']] },
  spider: { hp: 50, w: 98, h: 88, fly: false, dmg: 4, attacks: [['drop', 'rings'], ['drop', 'rings', 'stab'], ['rings', 'drop', 'stab']] },
  serpent: { hp: 30, w: 58, h: 74, fly: true, dmg: 3, attacks: [['lunge', 'sparks'], ['lunge', 'sparks', 'wave'], ['wave', 'lunge', 'sparks']] },
  lumen: { hp: 40, w: 120, h: 130, fly: false, dmg: 4, attacks: [['slam', 'beam'], ['slam', 'beam', 'sweep'], ['sweep', 'slam', 'beam']] },
};
export type Boss = {
  id: BossId; x: number; y: number; vx: number; vy: number; hp: number; max: number; phase: number; st: 'intro' | 'idle' | 'tell' | 'act' | 'recover' | 'hurt' | 'calm';
  t: number; atk: string; last: string; face: 1 | -1; flash: number; hidden: boolean; slow: number; form: number; tx: number; ty: number; n: number;
  marks: number[]; segs: { x: number; y: number }[]; arena: Arena; refight: boolean; stunAt: number;
};
/** Which frame of the boss's eight-frame sheet to show (idle 0-1, tell 2, attack 3-4, move 5, hurt 6, calm 7). */
export function bossFrame(b: Boss, tick: number): number {
  if (b.st === 'calm') return 7;
  if (b.st === 'hurt' || b.flash > 8) return 6;
  if (b.st === 'tell') return 2;
  if (b.st === 'act') {
    const move = ['scuttle', 'hide', 'burrow', 'leap', 'gust', 'jump', 'orbit', 'dive', 'drop', 'wave', 'sweep', 'roll', 'hop'];
    const second = ['slam', 'spit', 'rocks', 'peck', 'stab', 'stomp', 'swoop', 'blaze', 'stab', 'lunge', 'beam', 'volley'];
    if (move.includes(b.atk)) return 5;
    return second.includes(b.atk) ? 4 : 3;
  }
  return Math.floor(tick / 30) % 2;
}
const LOW_RUSH = ['charge', 'drill', 'scuttle', 'peck', 'roll'];
export function bossBox(b: Boss, tick: number): Rect {
  const info = BOSSES[b.id];
  const key = b.id === 'lumen' ? (b.form === 2 ? 'lumen-b' : 'lumen-a') : b.id === 'sentinel' && !BOSS_BOXES.sentinel ? null : b.id;
  const fb = key ? BOSS_BOXES[key]?.[bossFrame(b, tick)] : null;
  if (b.id === 'lumen' && b.form === 1) {
    // only the face screen can be hit
    return { x: b.x - 38, y: b.y - 155, w: 76, h: 103 };
  }
  if (!fb) return { x: b.x - info.w / 2, y: b.y - info.h, w: info.w, h: info.h };
  const [x0, y0, w, h] = fb;
  const x = b.face > 0 ? -(x0 + w) : x0;
  // shrink by an eighth all round: generous to the heroes
  const sx = w * 0.12, sy = h * 0.12;
  const r = { x: b.x + x + sx, y: b.y + y0 + sy, w: w - 2 * sx, h: h - 2 * sy };
  // a ground rush (a charge, a drill run, a scuttle) goes in low: a full jump clears it
  if (b.st === 'act' && LOW_RUSH.includes(b.atk) && !info.fly) { const top = b.y - 42; if (r.y < top) { r.h -= top - r.y; r.y = top; } }
  return r;
}

// ─── shots, effects, events ─────────────────────────────────────────────────
export type ShotKind = 'pellet' | 'c1' | 'c2' | 'c3' | 'magnet' | 'spark' | 'toss' | 'fly' | 'glob' | 'mine' | 'prism' | 'wave' | 'foe' | 'blob' | 'beam' | 'ring' | 'rock' | 'scrap' | 'bolt' | 'reflect' | 'light' | 'feather';
export type Shot = {
  id: number; kind: ShotKind; friendly: boolean; x: number; y: number; vx: number; vy: number; g: number; w: number; h: number;
  dmg: number; life: number; pierce: boolean; breaks: boolean; power: PowerId; hits: number[]; bounce: number; t: number;
};
export type Pickup = { id: number; kind: 'bolt' | 'hp' | 'en'; x: number; y: number; vy: number; t: number; pulled: boolean; life: number };
export type Effect = { kind: 'plate' | 'decoy' | 'cloud' | 'strike' | 'zap'; x: number; y: number; t: number; life: number; hp: number };
export type GameEvent =
  | { k: 'sfx'; id: string } | { k: 'hit'; x: number; y: number; big: boolean } | { k: 'reboot'; x: number; y: number; big: boolean }
  | { k: 'shake'; n: number } | { k: 'flash'; color: string } | { k: 'toast'; text: string } | { k: 'item'; id: string; kind: string }
  | { k: 'check' } | { k: 'boss'; id: BossId } | { k: 'calm'; id: BossId } | { k: 'clear' } | { k: 'done' } | { k: 'down'; hero: HeroId }
  | { k: 'fail' } | { k: 'tag'; hero: HeroId } | { k: 'save' } | { k: 'debris'; x: number; y: number } | { k: 'muzzle'; x: number; y: number; color: string }
  | { k: 'spark'; x: number; y: number } | { k: 'bike'; on: boolean } | { k: 'ending' } | { k: 'mini' } | { k: 'miniOn'; kind: FoeKind };

/** What the scene needs to draw a hero this tick (also what the follower replays a moment later). */
export type HeroPose = {
  id: HeroId; x: number; y: number; face: 1 | -1; st: string; t: number; shoot: number; charge: number; ghost: boolean; inv: number; bike: boolean; pw?: boolean;
};
export type Settings = { assist: boolean };
type HeroRt = { hp: number; en: number; down: boolean; power: number; rest: number };
type Body = {
  x: number; y: number; vx: number; vy: number; face: 1 | -1; ground: boolean; coyote: number; jumpBuf: number; jumping: boolean;
  dashT: number; dashDir: 1 | -1; dashAir: boolean; airDashed: boolean; dashCd: number; wall: -1 | 0 | 1; cling: boolean; climbing: boolean;
  kickT: number; kickDir: 1 | -1; hoverT: number; hovering: boolean; landT: number; towardT: number; drillT: number; dropT: number;
};

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export type Mode = 'play' | 'boss' | 'clear' | 'out' | 'done' | 'fail' | 'in';

export class OverclockGame {
  save: Save; settings: Settings; stage: Stage; grid: string[][]; tick = 0; rand: () => number;
  heroes: Record<HeroId, HeroRt>; lead: HeroId = 'dora';
  body: Body; history: HeroPose[] = [];
  shots: Shot[] = []; foes: Foe[] = []; pickups: Pickup[] = []; effects: Effect[] = [];
  boss: Boss | null = null; events: GameEvent[] = [];
  mode: Mode = 'in'; modeT = 0; checkpoint = -1; check: { x: number; y: number };
  lastSafe = { x: 0, y: 0 }; inv = 0; hurtT = 0; shootT = 0; shootCd = 0; chargeT = 0; chargeHeld = false; secondShot = 0;
  shieldT = 0; shieldCd = 0; tagCd = 0; tagIn = 0; tagHits: number[] = []; ghostT = 0; moonT = 0; stopT = 0; stompT = 0;
  bike: { x: number; y: number; x1: number; on: boolean; home: number }[] = [];
  riding = -1; miniDone = false; miniOn = false; doorShut = false; secondUsed = false; ids = 1;
  prev: Input = { ...NO_INPUT }; taken: Set<string>; galleryDone: CoreBoss[] = []; inGallery: CoreBoss | 'lumen' | null = null;
  pose: HeroPose; stats = { shots: 0, hurt: 0, kills: 0, falls: 0 };
  invuln = false; // debug: the heroes take no damage
  toastT = new Map<string, number>();

  constructor(save: Save | null, stageId: StageId, settings: Partial<Settings> = {}, seed = 1, checkpoint = -1) {
    this.save = save ? JSON.parse(JSON.stringify(save)) as Save : freshSave();
    this.settings = { assist: true, ...settings };
    this.stage = STAGES[stageId];
    this.grid = this.stage.grid.map((r) => r.split(''));
    this.rand = mulberry(seed * 9973 + 17);
    const hp = maxHp(this.save);
    this.heroes = { dora: { hp, en: MAX_EN, down: false, power: 0, rest: 0 }, enzo: { hp, en: MAX_EN, down: false, power: 0, rest: 0 } };
    this.taken = new Set(this.save.items);
    this.check = { ...this.stage.spawn };
    const cps = this.checks();
    if (checkpoint >= 0 && cps[checkpoint]) { this.checkpoint = checkpoint; this.check = { x: cps[checkpoint].x, y: cps[checkpoint].y }; }
    this.body = this.newBody(this.check.x, this.check.y);
    this.lastSafe = { ...this.check };
    this.bike = this.stage.bikes.map((b) => ({ x: b.x, y: b.y, x1: b.x1, on: false, home: b.x }));
    this.spawnFoes();
    for (const p of this.stage.pickups) this.pickups.push({ id: this.ids++, kind: p.kind, x: p.x, y: p.y, vy: 0, t: 0, pulled: false, life: -1 });
    this.pose = this.makePose();
    this.mode = 'in'; this.modeT = 0;
  }

  // ─── helpers ───
  get assist() { return this.settings.assist; }
  chip(c: ChipId) { return this.save.equipped.includes(c); }
  checks() { return this.stage.checks.filter((c) => c.assist ? this.assist : true); }
  emit(e: GameEvent) { this.events.push(e); }
  sfx(id: string) { this.emit({ k: 'sfx', id }); }
  toast(text: string, key = text, every = 90) {
    const last = this.toastT.get(key) ?? -9999;
    if (this.tick - last < every) return;
    this.toastT.set(key, this.tick); this.emit({ k: 'toast', text });
  }
  drainEvents() { const e = this.events; this.events = []; return e; }
  newBody(x: number, y: number): Body {
    return { x, y, vx: 0, vy: 0, face: 1, ground: true, coyote: 0, jumpBuf: 0, jumping: false, dashT: 0, dashDir: 1, dashAir: false, airDashed: false, dashCd: 0,
      wall: 0, cling: false, climbing: false, kickT: 0, kickDir: 1, hoverT: 0, hovering: false, landT: 0, towardT: 0, drillT: 0, dropT: 0 };
  }
  get gate() { return gateOn(this.save, this.stage); }
  get gate2() { return !!this.stage.gate2 && this.save.beaten.includes(this.stage.gate2); }
  tileAt(c: number, r: number) { if (c < 0 || c >= this.stage.w) return '#'; if (r < 0) return ' '; if (r >= ROWS) return ' '; return this.grid[r][c]; }
  solid(c: number, r: number) {
    const ch = this.tileAt(c, r);
    if (ch === '#' || ch === '%') return true;
    if (ch === 'x') return !this.gate;
    const d = this.stage.door;
    if (d && this.doorShut && c === d.c && r >= d.r0 - 8 && r <= d.r1) return true;
    const m = this.stage.mini;
    if (m && this.miniOn && (c === m.c0 || c === m.c1) && r >= m.r0 && r <= m.r1) return true;
    return false;
  }
  oneway(c: number, r: number) { const ch = this.tileAt(c, r); return ch === '=' || (ch === 'o' && this.gate) || (ch === 'O' && this.gate2); }
  hazard(c: number, r: number) { const ch = this.tileAt(c, r); return ch === '^' || (ch === 'w' && !this.gate); }
  water(c: number, r: number) { return this.tileAt(c, r) === '~'; }
  plates() { return this.effects.filter((e) => e.kind === 'plate'); }
  get gravity() { return GRAV * this.stage.gravity * (this.moonT > 0 && this.lead === 'dora' ? 0.55 : 1); }
  get dmgMul() { return (this.assist ? 0.6 : 1) * (hasArmour(this.save, 'body') ? 0.5 : 1) * (this.chip('tough-fur') ? 0.75 : 1) * (this.boss ? this.bossLevel.dmg : 1); }
  /** the city fights back harder as it is rebooted: each core the heroes already hold makes a boss a little tougher
   *  (none for the first boss, so any boss is fair first; the upgrades collected along the way more than keep up) */
  get bossLevel() { const n = Math.min(6, cores(this.save).filter((c) => c !== this.boss?.id).length); return { hp: 1 + 0.03 * n, dmg: 1 + 0.05 * n }; }
  get bossSpeed() { return this.assist ? 0.85 : 1; }
  get tellMul() { return this.assist ? 1.45 : 1; }
  heroRect(): Rect { const b = this.body; return { x: b.x - 5, y: b.y - 23, w: 10, h: 21 }; }
  bodyRect(): Rect { const b = this.body; return { x: b.x - HW / 2, y: b.y - HH, w: HW, h: HH }; }
  target() { const d = this.effects.find((e) => e.kind === 'decoy'); return d ? { x: d.x, y: d.y - 14 } : { x: this.body.x, y: this.body.y - 14 }; }
  lockRect(): Arena | null {
    if (this.boss || this.mode === 'boss') return this.boss ? this.boss.arena : this.stage.arena;
    if (this.miniOn && this.stage.mini) return this.stage.mini;
    return null;
  }

  spawnFoes() {
    this.foes = [];
    for (const f of this.stage.foes) {
      const info = FOES[f.kind], k = f.big ? 2 : 1;
      if (f.big && this.miniDone) continue;
      const y = info.hang ? f.y + (info.h * k) / 2 : info.fly ? f.y : f.y - (info.h * k) / 2;
      this.foes.push({ id: this.ids++, kind: f.kind, x: f.x, y, vx: 0, vy: 0, hp: f.big ? 24 : info.hp, max: f.big ? 24 : info.hp, face: -1, st: 'idle',
        t: Math.floor(this.rand() * 60), cd: 40 + Math.floor(this.rand() * 60), flash: 0, alive: true, hx: f.big ? 0 : f.x, hy: y, big: !!f.big, shield: f.kind === 'riot' && !f.big,
        frozen: 0, hidden: f.kind === 'grub' && !f.big, ground: !info.fly, mini: !!f.big, respawn: 0 });
    }
  }

  // ─── the tick ───
  step(inp: Input) {
    const pressed = (k: keyof Input) => inp[k] && !this.prev[k];
    this.tick++;
    if (this.stopT > 0) { this.stopT--; this.prev = { ...inp }; return; }
    this.modeT++;
    if (this.mode === 'in') {
      if (this.modeT >= 40) { this.mode = 'play'; this.modeT = 0; }
      this.pose = this.makePose(); this.record(); this.prev = { ...inp }; return;
    }
    if (this.mode === 'fail') {
      if (this.modeT >= 90) this.reboot();
      this.prev = { ...inp }; return;
    }
    if (this.mode === 'clear') {
      if (this.modeT === 1) this.sfx('victory');
      if (this.modeT >= 110) { this.mode = 'out'; this.modeT = 0; this.sfx('teleport'); }
      this.pose = this.makePose(); this.record(); this.updateSmall(); this.prev = { ...inp }; return;
    }
    if (this.mode === 'out') {
      if (this.modeT >= 45) { this.mode = 'done'; this.modeT = 0; this.emit({ k: 'done' }); }
      this.pose = this.makePose(); this.prev = { ...inp }; return;
    }
    if (this.mode === 'done') { this.prev = { ...inp }; return; }

    const lead = this.heroes[this.lead];
    // a resting partner is back after a while (or at the next checkpoint)
    const part = this.heroes[other(this.lead)];
    if (part.down && --part.rest <= 0) { part.down = false; part.hp = Math.ceil(maxHp(this.save) / 3); this.toast(`${NAME[other(this.lead)]} is rested and ready to tag in.`, 'rested', 1); this.sfx('check'); }
    // tag
    if (this.tagCd > 0) this.tagCd--;
    if (pressed('tag')) this.tryTag();
    // powers
    if (pressed('next') || pressed('prev')) this.cyclePower(pressed('next') ? 1 : -1);
    // shield
    if (this.shieldCd > 0) this.shieldCd--;
    if (this.shieldT > 0) this.shieldT--;
    if (pressed('shield')) {
      if (this.lead !== 'enzo') this.toast('Only Enzo has the deflect shield: tag Enzo in with Shift.', 'shield-dora');
      else if (this.riding >= 0) this.toast('No shield on the hover-bike.', 'shield-bike');
      else if (this.shieldCd === 0) { this.shieldT = 18; this.shieldCd = 36; this.sfx('shield'); }
    }
    // move
    if (this.riding >= 0) this.stepBike(inp, pressed);
    else this.stepBody(inp, pressed);
    // shooting
    this.stepShoot(inp, pressed);
    // timers
    if (this.inv > 0) this.inv--;
    if (this.hurtT > 0) this.hurtT--;
    if (this.ghostT > 0) this.ghostT--;
    if (this.moonT > 0) this.moonT--;
    if (this.stompT > 0) this.stompT--;
    if (this.tagIn > 0) this.stepTagIn();
    if (lead.en < 0) lead.en = 0;
    this.stepFoes();
    if (this.boss) this.stepBoss();
    this.stepShots();
    this.stepEffects();
    this.stepPickups();
    this.stepItems();
    this.stepChecks();
    this.stepArenas();
    this.stepHazards();
    this.pose = this.makePose();
    this.record();
    this.save.time += 1 / 60;
    this.prev = { ...inp };
  }

  /** the little things that still move during the victory pose */
  updateSmall() { this.stepShots(); this.stepEffects(); this.stepPickups(); }

  record() { this.history.push(this.pose); if (this.history.length > 40) this.history.shift(); }
  /** The partner, a few steps behind on the leader's path (drawn only; never hit). */
  follower(): HeroPose | null {
    const p = this.history[Math.max(0, this.history.length - 22)];
    if (!p || this.heroes[other(this.lead)].down) return null;
    return { ...p, id: other(this.lead), shoot: 0, charge: 0, inv: 0, st: p.st === 'shield' || p.st === 'charge' ? 'idle' : p.st };
  }

  makePose(): HeroPose {
    const b = this.body;
    let st = 'idle';
    if (this.mode === 'in') st = 'tin';
    else if (this.mode === 'out') st = 'tout';
    else if (this.mode === 'clear') st = 'victory';
    else if (this.mode === 'fail') st = 'down';
    else if (this.riding >= 0) st = b.ground ? 'bike' : 'bikeup';
    else if (this.hurtT > 8) st = 'hurt';
    else if (this.tagIn > 0) st = 'tagin';
    else if (this.shieldT > 0) st = 'shield';
    else if (this.stompT > 0) st = 'stomp';
    else if (b.drillT > 0) st = 'drill';
    else if (b.dashT > 0) st = 'dash';
    else if (b.climbing) st = 'climb';
    else if (b.cling) st = 'cling';
    else if (b.kickT > 0) st = 'kick';
    else if (b.hovering) st = 'hover';
    else if (!b.ground) st = this.moonT > 0 && this.lead === 'dora' ? 'moon' : b.vy < 0 ? 'jump' : 'fall';
    else if (b.landT > 0) st = 'land';
    else if (this.chargeT >= CHARGE[0] && this.lead === 'enzo' && Math.abs(b.vx) < 0.1) st = 'charge';
    else if (Math.abs(b.vx) > 0.1) st = 'run';
    return { id: this.lead, x: b.x, y: b.y, face: b.face, st, t: this.tick, shoot: this.shootT, charge: this.chargeLevel(), ghost: this.ghostT > 0, inv: this.inv, bike: this.riding >= 0, pw: this.power() !== BASE[this.lead] };
  }
  chargeLevel() { const c = this.chargeT * (this.chip('quick-charge') ? 1.5 : 1); return c >= CHARGE[2] ? 3 : c >= CHARGE[1] ? 2 : c >= CHARGE[0] ? 1 : 0; }

  // ─── the hero's body ───
  stepBody(inp: Input, pressed: (k: keyof Input) => boolean) {
    const b = this.body, h = this.lead, g = this.gravity;
    const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    if (b.dashCd > 0) b.dashCd--;
    if (b.landT > 0) b.landT--;
    if (pressed('jump')) b.jumpBuf = BUFFER; else if (b.jumpBuf > 0) b.jumpBuf--;
    if (b.ground) { b.coyote = COYOTE; b.airDashed = false; b.hoverT = this.chip('long-hover') ? 96 : HOVER_T; b.dashAir = false; } else if (b.coyote > 0) b.coyote--;
    const locked = this.shieldT > 0 || this.hurtT > 8;
    // facing
    if (dir && !locked && b.kickT === 0 && b.dashT === 0 && b.drillT === 0) b.face = dir as 1 | -1;
    // dash
    if (pressed('dash') && !locked && b.dashT === 0 && b.dashCd === 0 && b.drillT === 0) {
      if (b.ground || b.cling) { b.dashT = DASH_T; b.dashDir = b.cling ? (-b.wall as 1 | -1) || b.face : b.face; this.sfx('dash'); }
      else if (hasArmour(this.save, 'legs') && !b.airDashed) { b.dashT = AIRDASH_T; b.dashDir = b.face; b.airDashed = true; b.dashAir = true; b.vy = 0; this.sfx('dash'); }
    }
    if (b.dashT > 0 && !inp.dash && b.ground && b.dashT < DASH_T - 4) { b.dashT = 0; }
    // horizontal speed
    const speed = RUN[h];
    if (b.drillT > 0) { b.drillT--; b.vx = b.face * 4; b.vy = Math.min(b.vy, 1); }
    else if (b.kickT > 0) { b.kickT--; b.vx = b.kickDir * KICK_VX * (b.dashAir ? 1.4 : 1); }
    else if (b.dashT > 0) {
      b.dashT--; b.vx = b.dashDir * DASH_V;
      if (!b.ground && !b.dashAir) b.dashT = 0;
      if (b.dashAir && !b.ground) b.vy = Math.min(b.vy, 0.2);
      if (b.dashT === 0) b.dashCd = DASH_CD;
    } else if (locked) b.vx = this.hurtT > 8 ? -b.face * 1.2 : 0;
    else b.vx = dir * (b.dashAir && !b.ground ? DASH_V : speed);
    // down + jump on a ledge drops through it
    if (b.dropT > 0) b.dropT--;
    if (b.jumpBuf > 0 && inp.down && b.ground && this.onLedge()) { b.dropT = 10; b.jumpBuf = 0; b.ground = false; b.coyote = 0; }
    // jumping
    if (b.jumpBuf > 0 && !locked) {
      if (b.ground || b.coyote > 0) {
        b.vy = -JUMP_V; b.ground = false; b.coyote = 0; b.jumpBuf = 0; b.jumping = true;
        b.dashAir = b.dashT > 0 || (inp.dash && b.dashCd < DASH_CD); if (b.dashT > 0) b.dashT = 0;
        this.sfx('jump');
      } else if (b.wall !== 0) {
        b.vy = -KICK_VY; b.kickDir = (-b.wall) as 1 | -1; b.kickT = KICK_T; b.face = b.kickDir; b.jumpBuf = 0; b.jumping = true;
        b.dashAir = inp.dash; b.cling = false; b.climbing = false;
        this.sfx('walljump'); this.emit({ k: 'spark', x: b.x + b.wall * 6, y: b.y - 10 });
      }
    }
    if (b.jumping && !inp.jump && b.vy < JUMP_CUT) b.vy = JUMP_CUT;
    if (b.vy >= 0) b.jumping = false;
    // hover (Enzo): hold jump in the air on the way down
    b.hovering = false;
    if (h === 'enzo' && !b.ground && inp.jump && b.vy >= 0 && b.hoverT > 0 && !b.cling && b.kickT === 0 && !locked) {
      b.hovering = true; b.hoverT--; b.vy = 0; b.dashAir = false; b.vx = clamp(b.vx, -0.8, 0.8);
      if (b.hoverT === 0) this.sfx('hoverend');
      else if (b.hoverT % 12 === 0) this.sfx('hover');
    }
    // gravity
    if (!b.hovering && !(b.dashAir && b.dashT > 0)) b.vy = Math.min(b.vy + g, MAX_FALL);
    // wall: cling (Dora climbs), slide (Enzo)
    const wl = this.wallAt(-1), wr = this.wallAt(1);
    b.wall = wr ? 1 : wl ? -1 : 0;
    const toward = b.wall !== 0 && dir === b.wall;
    if (toward) b.towardT = 10; else if (b.towardT > 0) b.towardT--;
    const wasCling = b.cling;
    b.cling = false; b.climbing = false;
    if (b.wall !== 0 && !locked && b.kickT === 0 && (toward || (h === 'dora' && b.towardT > 0 && wasCling))) {
      if (h === 'dora' && (inp.up || (b.ground && toward && inp.up))) {
        b.climbing = true; b.cling = true; b.vy = -CLIMB_V * (this.stage.gravity < 1 ? 1.1 : 1); b.ground = false;
        if (this.tick % 14 === 0) this.sfx('climb');
      } else if (!b.ground && b.vy > 0) {
        b.cling = true;
        const slide = inp.down ? 2.2 : SLIDE[h];
        if (b.vy > slide) b.vy = slide;
        if (this.tick % 6 === 0) this.emit({ k: 'spark', x: b.x + b.wall * 6, y: b.y - 4 });
      }
      if (b.cling) { b.dashAir = false; b.airDashed = false; }
    }
    if (h === 'enzo' && toward && inp.up && pressed('up')) this.toast(this.heroes.dora.down ? `Enzo can\u2019t climb walls: Dora is back in ${Math.ceil(this.heroes.dora.rest / 60)} s.` : 'Enzo can\u2019t climb walls: tag Dora in, or wall-jump.', 'enzo-climb', 120);
    // move
    const wasGround = b.ground;
    this.moveX(b.vx);
    const vyIn = b.vy;
    this.moveY(b.vy, b.dropT > 0);
    if (b.ground && !wasGround) {
      b.landT = vyIn > 3 ? 8 : 4; this.sfx('land'); b.dashAir = false;
      if (b.dashT > 0 && b.dashAir) b.dashT = 0;
    }
    // climbing over the top of a wall
    if (h === 'dora' && b.climbing && !this.wallAt(b.wall || b.face, -HH + 4)) { b.vy = -3.2; b.climbing = false; }
    // safe ground
    if (b.ground && !this.hazardUnder()) {
      const l = this.standable(b.x - HW / 2 + 1, b.y), r = this.standable(b.x + HW / 2 - 1, b.y);
      if (l && r && !this.effects.some((e) => e.kind === 'plate' && Math.abs(e.x - b.x) < 30)) this.lastSafe = { x: b.x, y: b.y };
    }
    // fell
    if (b.y > ROWS * T + 30) this.fell();
  }
  onLedge() { const b = this.body, r = Math.floor((b.y + 1) / T); let ledge = false; for (const x of [b.x - HW / 2 + 1, b.x + HW / 2 - 1]) { const c = Math.floor(x / T); if (this.solid(c, r)) return false; if (this.oneway(c, r)) ledge = true; } return ledge; }
  standable(x: number, y: number) { const c = Math.floor(x / T), r = Math.floor((y + 1) / T); return this.solid(c, r) || this.oneway(c, r); }
  hazardUnder() { const b = this.body; return this.hazard(Math.floor(b.x / T), Math.floor((b.y - 1) / T)); }
  wallAt(side: number, dy = 0) {
    const b = this.body, x = b.x + side * (HW / 2 + 1.5), c = Math.floor(x / T);
    for (const yy of [b.y - HH + 6 + dy, b.y - 6 + (dy ? dy + HH - 12 : 0)]) {
      if (dy && yy !== b.y - HH + 6 + dy) continue;
      if (this.solid(c, Math.floor(yy / T))) return true;
    }
    return false;
  }
  moveX(vx: number) {
    const b = this.body;
    let nx = b.x + vx;
    const edge = nx + Math.sign(vx) * HW / 2;
    if (vx !== 0) {
      const c = Math.floor(edge / T);
      for (let y = b.y - HH + 1; y <= b.y - 1; y += 8) {
        const r = Math.floor(Math.min(y, b.y - 1) / T);
        if (this.solid(c, r)) {
          if (this.tryBreakDash(c, r)) continue;
          nx = vx > 0 ? c * T - HW / 2 - 0.01 : (c + 1) * T + HW / 2 + 0.01; b.vx = 0;
          if (b.dashT > 0 && b.ground) b.dashT = 0;
          break;
        }
      }
      if (this.solid(c, Math.floor((b.y - 1) / T)) && b.vx !== 0) {
        if (!this.tryBreakDash(c, Math.floor((b.y - 1) / T))) { nx = vx > 0 ? c * T - HW / 2 - 0.01 : (c + 1) * T + HW / 2 + 0.01; b.vx = 0; }
      }
    }
    b.x = clamp(nx, HW, this.stage.w * T - HW);
  }
  tryBreakDash(c: number, r: number) {
    if (this.body.drillT > 0 && this.tileAt(c, r) === '%') { this.breakTile(c, r); return true; }
    return false;
  }
  moveY(vy: number, drop: boolean) {
    const b = this.body;
    const ny = b.y + vy;
    const c0 = Math.floor((b.x - HW / 2 + 1) / T), c1 = Math.floor((b.x + HW / 2 - 1) / T);
    b.ground = false;
    if (vy >= 0) {
      const r0 = Math.floor((b.y - 0.01) / T) + 1, r1 = Math.floor(ny / T);
      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          if (this.solid(c, r) || (!drop && this.oneway(c, r))) { b.y = r * T; b.vy = 0; b.ground = true; return; }
        }
      }
      // standing exactly on a top
      if (vy === 0) for (let c = c0; c <= c1; c++) { const r = Math.floor(b.y / T); if (b.y % T === 0 && (this.solid(c, r) || this.oneway(c, r))) { b.ground = true; return; } }
      for (const p of this.plates()) {
        if (b.x > p.x - 18 && b.x < p.x + 18 && b.y <= p.y + 0.01 && ny >= p.y && !drop) { b.y = p.y; b.vy = 0; b.ground = true; return; }
      }
      b.y = ny;
      if (b.y % T === 0) for (let c = c0; c <= c1; c++) if (this.solid(c, b.y / T) || this.oneway(c, b.y / T)) b.ground = true;
    } else {
      const head = Math.floor((ny - HH) / T);
      for (let c = c0; c <= c1; c++) if (this.solid(c, head)) { b.y = (head + 1) * T + HH; b.vy = 0; return; }
      b.y = ny;
    }
  }

  // ─── the hover-bike ───
  stepBike(inp: Input, pressed: (k: keyof Input) => boolean) {
    const b = this.body, bk = this.bike[this.riding];
    const v = BIKE_V + (inp.right ? 0.9 : 0) - (inp.left ? 1.3 : 0);
    b.face = 1; b.vx = v;
    if (pressed('jump') && b.ground) { b.vy = -BIKE_JUMP; b.ground = false; this.sfx('jump'); }
    b.vy = Math.min(b.vy + GRAV * this.stage.gravity, MAX_FALL);
    const nx = b.x + b.vx;
    // barriers: bump and stop
    const c = Math.floor((nx + 10) / T);
    let blocked = false;
    for (let y = b.y - 20; y <= b.y - 1; y += 6) if (this.solid(c, Math.floor(y / T))) blocked = true;
    if (blocked) { b.vx = 0; if (this.tick % 20 === 0) this.sfx('bump'); } else b.x = nx;
    const ny = b.y + b.vy;
    b.ground = false;
    if (b.vy >= 0) {
      const r0 = Math.floor((b.y - 0.01) / T) + 1, r1 = Math.floor(ny / T);
      for (let r = r0; r <= r1 && !b.ground; r++) {
        for (const cx of [Math.floor((b.x - 10) / T), Math.floor((b.x + 10) / T)]) {
          if (this.solid(cx, r) || this.oneway(cx, r) || this.water(cx, r)) { b.y = r * T; b.vy = 0; b.ground = true; break; }
        }
      }
      if (!b.ground) b.y = ny;
    } else {
      // a roof overhead (a low tunnel): the rider bumps their head and drops back down, no harm done
      let roof = false;
      for (const cx of [Math.floor((b.x - 8) / T), Math.floor((b.x + 8) / T)]) if (this.solid(cx, Math.floor((ny - 30) / T))) roof = true;
      if (roof) { b.vy = 0.5; if (this.tick % 10 === 0) this.sfx('bump'); this.emit({ k: 'shake', n: 2 }); } else b.y = ny;
    }
    bk.x = b.x; bk.y = b.y;
    if (b.x >= bk.x1) { this.riding = -1; bk.on = false; b.vx = 0; b.vy = -3; this.emit({ k: 'bike', on: false }); this.sfx('dismount'); }
    if (b.y > ROWS * T + 30) { this.riding = -1; bk.on = false; bk.x = bk.home; this.fell(); }
  }

  // ─── shooting and powers ───
  power(h: HeroId = this.lead): PowerId { const ps = powersOf(this.save, h); return ps[this.heroes[h].power % ps.length] ?? BASE[h]; }
  cyclePower(d: number) {
    const ps = powersOf(this.save, this.lead);
    if (ps.length <= 1) { this.toast('No powers yet: reboot a boss to earn its core.', 'nopow'); return; }
    const hr = this.heroes[this.lead];
    hr.power = (hr.power + d + ps.length) % ps.length; this.chargeT = 0;
    this.sfx('select');
  }
  muzzle(): { x: number; y: number } {
    const b = this.body;
    if (this.lead === 'enzo') return { x: b.x + b.face * 18, y: b.y - (this.riding >= 0 ? 22 : 24) };
    return { x: b.x + b.face * 15, y: b.y - (b.ground ? 16 : 18) };
  }
  addShot(s: Partial<Shot> & { kind: ShotKind; x: number; y: number; vx: number; vy: number }) {
    const shot: Shot = { id: this.ids++, friendly: true, g: 0, w: 6, h: 4, dmg: 1, life: 90, pierce: false, breaks: false, power: BASE[this.lead], hits: [], bounce: 0, t: 0, ...s };
    this.shots.push(shot); return shot;
  }
  stepShoot(inp: Input, pressed: (k: keyof Input) => boolean) {
    if (this.shootT > 0) this.shootT--;
    if (this.shootCd > 0) this.shootCd--;
    if (this.secondShot > 0 && --this.secondShot === 0) this.fireCharge(3);
    const b = this.body;
    if (this.shieldT > 0 || this.hurtT > 8 || b.cling && b.climbing) { if (!inp.shoot) this.chargeT = 0; return; }
    const pw = this.power();
    const m = this.muzzle();
    if (pw === 'blaster') {
      const max = hasArmour(this.save, 'arm') ? 5 : 3;
      const mine = this.shots.filter((s) => s.friendly && s.kind === 'pellet').length;
      if (inp.shoot && this.shootCd === 0 && mine < max) {
        this.addShot({ kind: 'pellet', x: m.x, y: m.y, vx: b.face * 6, vy: 0, dmg: 1, w: 8, h: 4, life: 60, power: 'blaster' });
        this.shootCd = this.chip('rapid') ? 5 : 8; this.shootT = 14; this.sfx('blaster'); this.stats.shots++;
        this.emit({ k: 'muzzle', x: m.x, y: m.y, color: '#7ff' });
      }
      return;
    }
    if (pw === 'cannon') {
      if (inp.shoot) {
        if (pressed('shoot')) {
          const max = this.chip('rapid') ? 3 : 2;
          if (this.shots.filter((s) => s.friendly && s.kind === 'pellet').length < max) {
            this.addShot({ kind: 'pellet', x: m.x, y: m.y, vx: b.face * 5, vy: 0, dmg: 1, w: 8, h: 6, life: 70, power: 'cannon' });
            this.shootT = 12; this.sfx('pellet'); this.stats.shots++; this.emit({ k: 'muzzle', x: m.x, y: m.y, color: '#bf6' });
          }
          this.chargeT = 0;
        }
        const before = this.chargeLevel();
        this.chargeT++;
        const now = this.chargeLevel();
        if (now > before) this.sfx(`charge${now}`);
      } else if (this.chargeT > 0) {
        const lvl = this.chargeLevel();
        if (lvl > 0) { this.fireCharge(lvl); if (lvl === 3 && hasArmour(this.save, 'arm')) this.secondShot = 12; }
        this.chargeT = 0;
      }
      return;
    }
    if (!pressed('shoot')) return;
    const info = POWER[pw], hr = this.heroes[this.lead];
    const cost = this.chip('saver') ? Math.ceil(info.cost / 2) : info.cost;
    if (hr.en < cost) { this.toast(`Not enough energy for ${info.name}: pick up cyan capsules.`, 'noen'); this.sfx('empty'); return; }
    const ok = this.usePower(pw, m);
    if (ok) { hr.en -= cost; this.shootT = 14; this.stats.shots++; this.emit({ k: 'muzzle', x: m.x, y: m.y, color: info.color }); }
  }
  fireCharge(lvl: number) {
    const b = this.body, m = this.muzzle();
    const sz = [0, 10, 14, 20][lvl];
    this.addShot({ kind: lvl === 1 ? 'c1' : lvl === 2 ? 'c2' : 'c3', x: m.x, y: m.y, vx: b.face * (lvl === 3 ? 6 : 5), vy: 0, dmg: [0, 2, 3, 5][lvl], w: sz + 6, h: sz,
      life: 80, pierce: lvl === 3, breaks: lvl === 3, power: 'cannon' });
    this.shootT = 16; this.sfx(lvl === 3 ? 'blast3' : 'blast'); this.stats.shots++;
    this.emit({ k: 'muzzle', x: m.x, y: m.y, color: lvl === 3 ? '#fff' : '#bf6' });
    if (lvl === 3) this.emit({ k: 'shake', n: 3 });
  }
  usePower(pw: PowerId, m: { x: number; y: number }): boolean {
    const b = this.body, f = b.face;
    switch (pw) {
      case 'magnet': this.addShot({ kind: 'magnet', x: m.x, y: m.y, vx: f * 5, vy: 0, w: 10, h: 8, dmg: 1, power: pw }); this.sfx('magnet'); return true;
      case 'ghost': this.ghostT = 90; this.sfx('ghost'); return true;
      case 'drill': if (this.riding >= 0) return false; b.drillT = 22; this.tagHits = []; this.sfx('drill'); return true;
      case 'decoy': this.effects = this.effects.filter((e) => e.kind !== 'decoy'); this.effects.push({ kind: 'decoy', x: b.x + f * 20, y: b.y, t: 0, life: 240, hp: 3 }); this.sfx('decoy'); return true;
      case 'spark': this.addShot({ kind: 'spark', x: m.x, y: m.y, vx: f * 6, vy: 0, w: 10, h: 8, dmg: 1, power: pw }); this.sfx('spark'); return true;
      case 'toss': this.addShot({ kind: 'toss', x: m.x, y: m.y - 4, vx: f * 3, vy: -4, g: 0.25, w: 12, h: 12, dmg: 4, life: 150, breaks: true, bounce: 1, power: pw }); this.sfx('toss'); return true;
      case 'moon': this.moonT = 360; this.sfx('moon'); return true;
      case 'swarm': for (let i = 0; i < 4; i++) this.addShot({ kind: 'fly', x: b.x, y: b.y - 20, vx: Math.cos(i * 1.57) * 2, vy: Math.sin(i * 1.57) * 2, w: 6, h: 6, dmg: 1, life: 200, power: pw }); this.sfx('swarm'); return true;
      case 'plate': {
        this.effects = this.effects.filter((e) => e.kind !== 'plate');
        const y = b.ground ? b.y - 32 : b.y + 2, x = b.ground ? b.x + f * 30 : b.x;
        this.effects.push({ kind: 'plate', x, y: Math.round(y), t: 0, life: 240, hp: 0 }); this.sfx('plate'); return true;
      }
      case 'glob': this.addShot({ kind: 'glob', x: m.x, y: m.y, vx: f * 3.2, vy: -3, g: 0.2, w: 10, h: 10, dmg: 1, life: 120, power: pw }); this.sfx('glob'); return true;
      case 'mine': if (!b.ground) { this.toast('The Burrow Mine needs the floor under Enzo.', 'mine-air'); return false; }
        this.addShot({ kind: 'mine', x: b.x + f * 10, y: b.y - 4, vx: f * 3, vy: 0, w: 10, h: 8, dmg: 4, life: 100, power: pw }); this.sfx('mine'); return true;
      case 'prism': this.addShot({ kind: 'prism', x: m.x, y: m.y, vx: f * 7, vy: 0, w: 12, h: 3, dmg: 2, life: 120, bounce: 3, power: pw }); this.sfx('prism'); return true;
      case 'cloud': this.effects = this.effects.filter((e) => e.kind !== 'cloud'); this.effects.push({ kind: 'cloud', x: b.x, y: b.y - 60, t: 0, life: 300, hp: 0 }); this.sfx('cloud'); return true;
      case 'quake': if (!b.ground) { this.toast('The Quake Stomp needs the floor under Enzo.', 'quake-air'); return false; }
        for (const d of [-1, 1]) this.addShot({ kind: 'wave', x: b.x + d * 8, y: b.y - 8, vx: d * 3, vy: 0, w: 14, h: 16, dmg: 3, life: 60, pierce: true, breaks: true, power: pw });
        this.stompT = 24; this.emit({ k: 'shake', n: 4 }); this.sfx('quake'); return true;
      case 'strike': {
        let x = b.x + f * 80; const c = Math.floor(x / T); x = c * T + 8;
        let r = Math.floor((b.y - 8) / T); for (let i = 0; i < 12 && !this.solid(c, r) && !this.oneway(c, r); i++) r++;
        this.effects.push({ kind: 'strike', x, y: r * T, t: 0, life: 52, hp: 0 }); this.sfx('mark'); return true;
      }
      case 'flare': {
        this.emit({ k: 'flash', color: '#efffa0' }); this.sfx('flare');
        for (const e of this.foes) if (e.alive && !e.hidden && Math.abs(e.x - b.x) < 220 && Math.abs(e.y - b.y) < 140) { e.frozen = Math.max(e.frozen, 90); this.damageFoe(e, 2, 0, false, 'flare'); }
        if (this.boss && this.boss.st !== 'calm' && !this.boss.hidden) this.damageBoss(2, 'flare');
        return true;
      }
    }
    return false;
  }

  // ─── tag ───
  tryTag() {
    const o = other(this.lead);
    if (this.heroes[o].down) { this.toast(`${NAME[o]} is resting: back in ${Math.ceil(this.heroes[o].rest / 60)} s, or at the next checkpoint.`, 'tagdown', 60); return; }
    if (this.tagCd > 0 || (this.mode !== 'play' && this.mode !== 'boss')) return;
    if (this.body.cling && o === 'enzo' && !this.body.ground) { /* allowed: Enzo slides */ }
    this.lead = o; this.tagCd = this.chip('swift-tag') ? 15 : TAG_CD; this.tagIn = 18; this.tagHits = []; this.inv = Math.max(this.inv, 24);
    this.chargeT = 0; this.shieldT = 0; this.body.hovering = false; this.body.drillT = 0;
    this.emit({ k: 'tag', hero: o }); this.sfx('tag');
  }
  stepTagIn() {
    this.tagIn--;
    const b = this.body, f = b.face;
    const r: Rect = this.lead === 'dora' ? { x: b.x + (f > 0 ? 0 : -26), y: b.y - 24, w: 26, h: 20 } : { x: b.x + (f > 0 ? 2 : -34), y: b.y - 32, w: 32, h: 30 };
    if (this.lead === 'dora' && this.riding < 0 && this.tagIn > 6) b.x = clamp(b.x + f * 1.2, HW, this.stage.w * T - HW);
    const dmg = (this.lead === 'dora' ? 3 : 4) * (this.chip('swift-tag') ? 2 : 1);
    for (const e of this.foes) if (e.alive && !e.hidden && !this.tagHits.includes(e.id) && overlap(r, foeBox(e))) { this.tagHits.push(e.id); this.damageFoe(e, dmg, f, true, BASE[this.lead]); }
    if (this.boss && !this.tagHits.includes(-1) && this.boss.st !== 'calm' && !this.boss.hidden && overlap(r, bossBox(this.boss, this.tick))) { this.tagHits.push(-1); this.damageBoss(dmg, BASE[this.lead]); }
  }

  // ─── hurting the heroes ───
  hurt(dmg: number, from: number, why = '') {
    if (this.invuln || this.inv > 0 || this.ghostT > 0 || (this.mode !== 'play' && this.mode !== 'boss')) return false;
    if (this.tagIn > 0) return false;
    const hr = this.heroes[this.lead];
    const d = Math.max(0.5, Math.round(dmg * this.dmgMul * 2) / 2);
    hr.hp -= d; this.stats.hurt += d;
    this.inv = 60; this.hurtT = 18; this.chargeT = 0; this.shieldT = 0;
    const b = this.body;
    if (this.riding < 0) { b.face = (from > b.x ? 1 : -1); b.vy = Math.min(b.vy, -2); b.dashT = 0; b.drillT = 0; b.cling = false; }
    this.sfx('hurt'); this.emit({ k: 'shake', n: 3 }); this.emit({ k: 'hit', x: b.x, y: b.y - 16, big: false });
    if (hr.hp <= 0) {
      if (this.chip('second-wind') && !this.secondUsed) { this.secondUsed = true; hr.hp = 1; this.inv = 90; this.toast('Second Wind!', 'sw', 1); return true; }
      hr.hp = 0; hr.down = true; hr.rest = REST_T; this.emit({ k: 'down', hero: this.lead }); this.sfx('down');
      const o = other(this.lead);
      if (!this.heroes[o].down) {
        this.lead = o; this.inv = 90; this.hurtT = 0; this.tagIn = 0; this.emit({ k: 'tag', hero: o });
        this.toast(`${NAME[other(o)]} needs a rest: ${NAME[o]} takes over.`, 'auto', 1);
      } else { this.mode = 'fail'; this.modeT = 0; this.emit({ k: 'fail' }); this.sfx('fail'); }
    }
    void why;
    return true;
  }
  fell() {
    const b = this.body;
    this.stats.falls++;
    if (this.assist) {
      b.x = this.lastSafe.x; b.y = this.lastSafe.y; b.vx = 0; b.vy = 0; b.dashT = 0; b.drillT = 0;
      this.inv = 0; this.hurt(4, b.x); this.inv = 60; this.hurtT = 0; b.vy = 0; b.vx = 0;
      this.sfx('fall'); this.toast('A fall: back to the last ledge.', 'fall', 240);
    } else {
      const hr = this.heroes[this.lead];
      hr.hp = 0; hr.down = true; hr.rest = REST_T; this.emit({ k: 'down', hero: this.lead });
      const o = other(this.lead);
      if (!this.heroes[o].down) { this.lead = o; b.x = this.lastSafe.x; b.y = this.lastSafe.y; b.vx = 0; b.vy = 0; this.inv = 90; this.emit({ k: 'tag', hero: o }); }
      else { this.mode = 'fail'; this.modeT = 0; this.emit({ k: 'fail' }); this.sfx('fail'); b.y = ROWS * T; }
    }
  }
  /** both heroes down: back to the last checkpoint, both rested */
  reboot() {
    const hp = maxHp(this.save);
    for (const h of ['dora', 'enzo'] as HeroId[]) { this.heroes[h].hp = hp; this.heroes[h].down = false; this.heroes[h].en = MAX_EN; }
    this.body = this.newBody(this.check.x, this.check.y); this.lastSafe = { ...this.check };
    this.shots = []; this.effects = []; this.riding = -1; this.bike = this.stage.bikes.map((b) => ({ x: b.x, y: b.y, x1: b.x1, on: false, home: b.x }));
    this.spawnFoes(); this.boss = null; this.doorShut = false; this.miniOn = false; this.inGallery = null; this.secondUsed = false;
    this.mode = 'in'; this.modeT = 0; this.inv = 60; this.chargeT = 0; this.history = [];
    this.emit({ k: 'reboot', x: this.check.x, y: this.check.y - 20, big: false });
  }
  useTank(): { ok: boolean; why: string } {
    const hr = this.heroes[this.lead];
    if (this.save.tanks <= 0) return { ok: false, why: tankCount(this.save) ? 'The tanks are empty: they refill at checkpoints on assist, or in the hub.' : 'No energy tanks yet: they hide in capsules.' };
    if (hr.hp >= maxHp(this.save)) return { ok: false, why: `${NAME[this.lead]}’s health is already full.` };
    this.save.tanks--; hr.hp = maxHp(this.save); this.sfx('tank'); this.emit({ k: 'save' });
    return { ok: true, why: '' };
  }

  // ─── foes ───
  damageFoe(e: Foe, dmg: number, dir: number, big: boolean, pw: PowerId) {
    if (!e.alive || e.hidden) return;
    e.hp -= dmg; e.flash = 10;
    if (dir) e.x += dir * (e.big ? 1 : 3);
    this.emit({ k: 'hit', x: e.x, y: e.y, big });
    this.sfx('hitfoe');
    if (e.hp <= 0) {
      e.alive = false; this.stats.kills++;
      this.emit({ k: 'reboot', x: e.x, y: e.y, big: e.big }); this.sfx(e.big ? 'bigboom' : 'boom'); this.stopT = 2;
      const n = FOES[e.kind].bolts * (e.big ? 4 : 1);
      for (let i = 0; i < n; i++) this.pickups.push({ id: this.ids++, kind: 'bolt', x: e.x + (i - n / 2) * 5, y: e.y, vy: -2 - this.rand() * 2, t: 0, pulled: false, life: 600 });
      const roll = this.rand();
      if (e.big || roll < 0.18) this.pickups.push({ id: this.ids++, kind: 'hp', x: e.x, y: e.y, vy: -2, t: 0, pulled: false, life: 600 });
      if (e.big || (roll > 0.82)) this.pickups.push({ id: this.ids++, kind: 'en', x: e.x + 6, y: e.y, vy: -2, t: 0, pulled: false, life: 600 });
      if (e.mini) { this.miniDone = true; this.miniOn = false; this.emit({ k: 'mini' }); this.emit({ k: 'shake', n: 5 }); }
      if (this.stage.id === 'training') e.respawn = 180;
    }
    void pw;
  }
  stepFoes() {
    const b = this.body, tgt = this.target(), hr = this.heroRect();
    const camL = b.x - 260, camR = b.x + 260;
    for (const e of this.foes) {
      if (!e.alive) {
        if (e.respawn > 0 && --e.respawn === 0) { e.alive = true; e.hp = e.max; e.x = e.hx; e.y = e.hy; e.st = 'idle'; e.shield = e.kind === 'riot'; e.hidden = e.kind === 'grub'; }
        continue;
      }
      if (e.x < camL || e.x > camR || Math.abs(e.y - b.y) > 200) continue;
      if (e.mini && !this.miniOn) {
        const m = this.stage.mini!;
        if (b.x > (m.c0 + 2) * T && b.x < (m.c1 - 1) * T && !this.miniDone) { this.miniOn = true; this.emit({ k: 'miniOn', kind: this.foes.find((f) => f.mini)?.kind ?? 'sentry' }); this.sfx('door'); }
        else continue;
      }
      if (e.flash > 0) e.flash--;
      if (e.frozen > 0) { e.frozen--; if (overlap(hr, foeBox(e)) ) { /* frozen foes don't hurt */ } continue; }
      e.t++;
      const info = FOES[e.kind], k = e.big ? 2 : 1;
      const dx = tgt.x - e.x, dy = tgt.y - e.y, dist = Math.hypot(dx, dy);
      const cdMul = e.big ? 0.6 : 1;
      if (e.st !== 'attack' || !['bat', 'firefly', 'cube', 'sweeper', 'hopper'].includes(e.kind)) e.face = dx > 0 ? 1 : -1;
      const shoot = (vx: number, vy: number, kind: ShotKind = 'foe', g = 0) => {
        const spread = e.big ? [-0.35, 0, 0.35] : [0];
        for (const a of spread) {
          const ca = Math.cos(a), sa = Math.sin(a);
          this.shots.push({ id: this.ids++, kind, friendly: false, x: e.x + e.face * info.w * k * 0.4, y: e.y, vx: vx * ca - vy * sa, vy: vx * sa + vy * ca, g, w: 7, h: 7, dmg: info.dmg - 1, life: 180, pierce: false, breaks: false, power: 'blaster', hits: [], bounce: 0, t: 0 });
        }
        this.sfx('foeshot');
      };
      const aim = (speed: number) => { const d = Math.max(1, dist); shoot((dx / d) * speed, (dy / d) * speed); };
      const tell = (n: number) => { e.st = 'tell'; e.t = 0; e.cd = n; this.sfx('foetell'); };
      if (e.mini) { this.stepMini(e, dx, dist, shoot, tell); }
      else switch (e.kind) {
        case 'drone': {
          e.y = e.hy + Math.sin(e.t / 30) * 6;
          if (e.st === 'idle') { e.x += clamp(dx, -0.4, 0.4) * (Math.abs(e.x - e.hx) < 120 ? 1 : 0); if (--e.cd <= 0 && dist < 200) tell(36); }
          else if (e.st === 'tell' && e.t >= e.cd) { aim(2.2); e.st = 'attack'; e.t = 0; }
          else if (e.st === 'attack' && e.t > 20) { e.st = 'idle'; e.cd = 150 * cdMul; }
          break;
        }
        case 'sentry': case 'dish': case 'gecko': case 'riot': {
          const walker = e.kind !== 'dish';
          if (e.st === 'idle') {
            if (walker && dist < 220 && Math.abs(dx) > 40) this.walkFoe(e, e.face * (e.kind === 'gecko' ? 0.6 : 0.5));
            if (--e.cd <= 0 && dist < 190) tell(e.kind === 'dish' ? 36 : 30);
          } else if (e.st === 'tell' && e.t >= e.cd) {
            if (e.kind === 'gecko') shoot(e.face * 2, -3, 'blob', 0.15);
            else if (e.kind === 'dish') { for (const a of [-0.5, 0, 0.5]) { const d = Math.max(1, dist); this.shots.push({ id: this.ids++, kind: 'ring', friendly: false, x: e.x, y: e.y - 6, vx: ((dx / d) * Math.cos(a) - (dy / d) * Math.sin(a)) * 2, vy: ((dx / d) * Math.sin(a) + (dy / d) * Math.cos(a)) * 2, g: 0, w: 9, h: 9, dmg: 2, life: 160, pierce: false, breaks: false, power: 'blaster', hits: [], bounce: 0, t: 0 }); } this.sfx('foeshot'); }
            else shoot(e.face * 2.6, 0);
            e.st = 'attack'; e.t = 0;
          } else if (e.st === 'attack' && e.t > 30) { e.st = 'idle'; e.cd = (e.kind === 'riot' ? 140 : 110) * cdMul; }
          break;
        }
        case 'bat': case 'firefly': {
          if (e.st === 'idle') {
            if (e.kind === 'firefly') { e.x = e.hx + Math.sin(e.t / 40) * 20; e.y = e.hy + Math.cos(e.t / 25) * 8; }
            else { e.x += (e.hx - e.x) * 0.03; e.y += (e.hy - e.y) * 0.03; }
            if (--e.cd <= 0 && dist < (e.kind === 'bat' ? 130 : 150)) { tell(e.kind === 'bat' ? 22 : 16); }
          } else if (e.st === 'tell') { if (e.t >= e.cd) { const sp = e.kind === 'bat' ? 2.5 : 2.8, d = Math.max(1, dist); e.vx = (dx / d) * sp; e.vy = (dy / d) * sp; e.face = e.vx > 0 ? 1 : -1; e.st = 'attack'; e.t = 0; this.sfx('swoop'); } }
          else if (e.st === 'attack') { e.x += e.vx; e.y += e.vy; if (e.t > 45) { e.st = 'idle'; e.cd = 90 * cdMul; } }
          else if (e.st === 'hurt' && e.t > 10) e.st = 'idle';
          break;
        }
        case 'hopper': {
          if (e.st === 'idle') { if (--e.cd <= 0 && dist < 200) tell(24); }
          else if (e.st === 'tell' && e.t >= e.cd) { e.vx = e.face * 1.6; e.vy = -4.5; e.st = 'attack'; e.t = 0; e.ground = false; this.sfx('hop'); }
          else if (e.st === 'attack') { this.fallFoe(e); if (e.ground && e.t > 5) { e.st = 'idle'; e.cd = 50 * cdMul; e.vx = 0; } }
          break;
        }
        case 'claw': case 'holo': {
          if (e.kind === 'claw') {
            if (e.st === 'idle') { e.x += clamp(dx, -0.3, 0.3); e.y += (e.hy - e.y) * 0.05; if (--e.cd <= 0 && Math.abs(dx) < 26 && dy > 0) tell(24); }
            else if (e.st === 'tell' && e.t >= e.cd) { e.st = 'attack'; e.t = 0; e.vy = 4; this.sfx('swoop'); }
            else if (e.st === 'attack') { const r = Math.floor((e.y + 14 * k) / T); if (e.t < 40 && !this.solid(Math.floor(e.x / T), r) && e.y < e.hy + 120) e.y += 4; if (e.t > 60) { e.st = 'idle'; e.cd = 60; } }
          } else {
            if (e.st === 'idle') { if (--e.cd <= 0 && dist < 200) tell(30); }
            else if (e.st === 'tell' && e.t >= e.cd) { aim(3); e.st = 'attack'; e.t = 0; }
            else if (e.st === 'attack' && e.t > 24) { e.st = 'idle'; e.cd = 120 * cdMul; }
          }
          break;
        }
        case 'grub': {
          if (e.hidden) { if (Math.abs(dx) < 60 && Math.abs(dy) < 50) { e.hidden = false; tell(18); this.sfx('pop'); } }
          else if (e.st === 'tell' && e.t >= e.cd) { e.st = 'attack'; e.t = 0; }
          else if (e.st === 'attack' && e.t > 40) { e.st = 'idle'; e.t = 0; }
          else if (e.st === 'idle' && e.t > 90 && Math.abs(dx) > 70) { e.hidden = true; e.hp = e.max; }
          break;
        }
        case 'jelly': {
          e.x += clamp(dx, -0.35, 0.35); e.y += clamp(dy, -0.25, 0.25);
          if (e.st === 'idle') { if (--e.cd <= 0 && dist < 120) tell(30); }
          else if (e.st === 'tell' && e.t >= e.cd) { e.st = 'attack'; e.t = 0; this.sfx('zap'); }
          else if (e.st === 'attack' && e.t > 40) { e.st = 'idle'; e.cd = 160 * cdMul; }
          break;
        }
        case 'cube': case 'sweeper': {
          if (e.st === 'idle') {
            if (e.kind === 'sweeper') this.walkFoe(e, e.face * 0.5);
            if (--e.cd <= 0 && Math.abs(dx) < (e.kind === 'cube' ? 180 : 110) && Math.abs(dy) < 50) tell(e.kind === 'cube' ? 30 : 24);
          } else if (e.st === 'tell' && e.t >= e.cd) { e.vx = e.face * (e.kind === 'cube' ? 2.4 : 3); e.st = 'attack'; e.t = 0; this.sfx('roll'); }
          else if (e.st === 'attack') { if (!this.walkFoe(e, e.vx) || e.t > (e.kind === 'cube' ? 110 : 30)) { e.st = 'idle'; e.cd = 90 * cdMul; e.vx = 0; } }
          break;
        }
      }
      if (e.st === 'hurt' && e.t > 12) e.st = 'idle';
      // touching a hero
      if (!e.hidden && this.ghostT === 0) {
        const box = foeBox(e);
        const reach = e.kind === 'jelly' && e.st === 'attack' ? { x: box.x - 10, y: box.y - 6, w: box.w + 20, h: box.h + 24 } : box;
        if (overlap(hr, reach)) {
          if (this.shieldT > 0 && Math.sign(e.x - b.x) === b.face) { e.x += b.face * 8; this.sfx('reflect'); }
          else this.hurt(info.dmg, e.x);
        }
        const dc = this.effects.find((x) => x.kind === 'decoy');
        if (dc && overlap({ x: dc.x - 6, y: dc.y - 24, w: 12, h: 24 }, box) && this.tick % 30 === 0) { dc.hp--; }
      }
    }
  }
  /** A mini-boss: a big version of a stage's robot with its own simple pattern. Flyers hover at a height the heroes
   *  can shoot, aim three-shot spreads and dive now and then; walkers stalk, fire spreads and leap with shock waves. */
  stepMini(e: Foe, dx: number, dist: number, shoot: (vx: number, vy: number, kind?: ShotKind, g?: number) => void, tell: (n: number) => void) {
    const m = this.stage.mini!, info = FOES[e.kind];
    const floor = (m.r1 + 1) * T, L = (m.c0 + 2) * T, R = (m.c1 - 1) * T;
    const fly = info.fly;
    const spd = this.assist ? 0.85 : 1;
    const tg = this.target();
    if (e.st === 'idle') {
      if (fly) { e.y += ((floor - 44 + Math.sin(e.t / 24) * 10) - e.y) * 0.06; e.x = clamp(e.x + clamp(dx, -0.6, 0.6) * spd, L, R); }
      else { e.y = floor - info.h; if (Math.abs(dx) > 70) { const nx = clamp(e.x + Math.sign(dx) * 0.6 * spd, L, R); e.x = nx; } }
      if (--e.cd <= 0) { tell(this.assist ? 40 : 28); e.hx = (e.hx + 1) % 3; }
    } else if (e.st === 'tell' && e.t >= e.cd) {
      e.st = 'attack'; e.t = 0;
      if (e.hx % 3 === 2) { e.vx = clamp(tg.x, L, R); e.vy = e.x; this.sfx(fly ? 'swoop' : 'hop'); }
      else { const d = Math.max(1, dist); shoot((dx / d) * 2.4 * spd, ((tg.y - e.y) / d) * 2.4 * spd); }
    } else if (e.st === 'attack') {
      if (e.hx % 3 === 2) {
        const k = Math.min(1, e.t / 50);
        e.x = e.vy + (e.vx - e.vy) * k;
        if (fly) e.y = floor - 44 + Math.sin(k * Math.PI) * 26;
        else e.y = floor - info.h - Math.sin(k * Math.PI) * 70;
        if (k >= 1) {
          if (!fly) { for (const d of [-1, 1]) this.shots.push({ id: this.ids++, kind: 'wave', friendly: false, x: e.x + d * 20, y: floor - 8, vx: d * 2.4 * spd, vy: 0, g: 0, w: 14, h: 14, dmg: 3, life: 100, pierce: false, breaks: false, power: 'blaster', hits: [], bounce: 0, t: 0 }); this.emit({ k: 'shake', n: 4 }); this.sfx('slam'); }
          e.st = 'idle'; e.cd = 70;
        }
      } else if (e.t > 24) { e.st = 'idle'; e.cd = 80; }
    }
  }
  /** a ground foe walks; false when a wall or a ledge's edge stops it */
  walkFoe(e: Foe, vx: number) {
    const info = FOES[e.kind], k = e.big ? 2 : 1;
    const nx = e.x + vx, front = nx + Math.sign(vx) * info.w * k / 2;
    const c = Math.floor(front / T), feet = e.y + info.h * k / 2;
    const r = Math.floor((feet - 2) / T), below = Math.floor((feet + 2) / T);
    if (this.solid(c, r) || (!this.solid(c, below) && !this.oneway(c, below))) { e.face = (vx > 0 ? -1 : 1); return false; }
    if (this.stage.mini && e.mini) { const m = this.stage.mini; if (nx < (m.c0 + 2) * T || nx > (m.c1 - 1) * T) return false; }
    e.x = nx; return true;
  }
  fallFoe(e: Foe) {
    const info = FOES[e.kind], k = e.big ? 2 : 1;
    if (!this.walkFoe(e, e.vx)) e.vx = 0;
    e.vy = Math.min(e.vy + GRAV * this.stage.gravity, 5);
    const feet = e.y + info.h * k / 2 + e.vy;
    const r = Math.floor(feet / T), c = Math.floor(e.x / T);
    if (e.vy > 0 && (this.solid(c, r) || this.oneway(c, r))) { e.y = r * T - info.h * k / 2; e.vy = 0; e.ground = true; }
    else { e.y += e.vy; e.ground = false; }
    if (e.y > ROWS * T + 40) { e.alive = false; }
  }

  // ─── shots ───
  stepShots() {
    const hr = this.heroRect(), b = this.body;
    for (const s of this.shots) {
      s.t++; s.life--;
      if (s.kind === 'fly' && s.t > 20) {
        const tg = this.nearestFoe(s.x, s.y, 220);
        if (tg) { const d = Math.max(1, Math.hypot(tg.x - s.x, tg.y - s.y)); s.vx += ((tg.x - s.x) / d) * 0.4; s.vy += ((tg.y - s.y) / d) * 0.4; const sp = Math.hypot(s.vx, s.vy); if (sp > 3.5) { s.vx *= 3.5 / sp; s.vy *= 3.5 / sp; } }
      }
      if (s.kind === 'scrap' && s.t === 50) { s.vx = -s.vx; }
      s.vy += s.g; s.x += s.vx; s.y += s.vy;
      const c = Math.floor(s.x / T), r = Math.floor(s.y / T);
      if (s.kind === 'mine' || s.kind === 'wave') {
        // run along the floor: stop at walls, drop off edges
        const fr = Math.floor((s.y + 6) / T);
        if (!this.solid(c, fr) && !this.oneway(c, fr)) s.life = 0;
      }
      if (this.solid(c, r)) {
        if (s.friendly && s.breaks && this.tileAt(c, r) === '%') { this.breakTile(c, r); if (!s.pierce) s.life = 0; }
        else if (s.kind === 'prism' && s.bounce > 0) { s.bounce--; s.x -= s.vx; s.vx = -s.vx; this.sfx('bounce'); }
        else if (s.kind === 'toss' && s.bounce > 0) { s.bounce--; s.y -= s.vy; s.vy = -Math.abs(s.vy) * 0.6; }
        else if (s.kind !== 'beam' && s.kind !== 'rock') s.life = 0;
      }
      if (s.kind === 'rock' && s.vy > 0 && this.solid(c, Math.floor((s.y + 4) / T))) s.life = 0;
      if (s.friendly) {
        if (s.kind === 'magnet') for (const p of this.pickups) if (Math.abs(p.x - s.x) < 40 && Math.abs(p.y - s.y) < 40) p.pulled = true;
        const sr: Rect = { x: s.x - s.w / 2, y: s.y - s.h / 2, w: s.w, h: s.h };
        for (const e of this.foes) {
          if (!e.alive || e.hidden || s.hits.includes(e.id)) continue;
          const box = foeBox(e);
          if (!overlap(sr, box)) continue;
          s.hits.push(e.id);
          // the riot robot's shield turns weak shots aside from the front
          if (e.shield && Math.sign(s.vx) === -e.face && e.st !== 'tell' && e.st !== 'attack') {
            if (s.kind === 'magnet' || s.kind === 'c3') { e.shield = false; this.sfx('shieldoff'); this.emit({ k: 'debris', x: e.x, y: e.y }); if (s.kind === 'magnet') s.life = 0; continue; }
            if (s.kind !== 'wave' && s.kind !== 'mine' && s.kind !== 'toss') { s.life = 0; this.sfx('clink'); this.emit({ k: 'spark', x: s.x, y: s.y }); break; }
          }
          if (s.kind === 'glob') e.frozen = 150;
          if (s.kind === 'mine') this.emit({ k: 'debris', x: e.x, y: e.y });
          this.damageFoe(e, s.dmg, Math.sign(s.vx), s.dmg >= 3, s.power);
          if (s.kind === 'spark') this.chain(e, 2);
          if (!s.pierce) { s.life = 0; break; }
        }
        if (this.boss && s.life > 0 && !s.hits.includes(-1) && this.boss.st !== 'calm' && !this.boss.hidden && this.boss.st !== 'intro') {
          if (overlap(sr, bossBox(this.boss, this.tick))) {
            s.hits.push(-1);
            if (s.kind === 'glob') this.boss.slow = 120;
            this.damageBoss(s.dmg, s.power);
            if (!s.pierce) s.life = 0;
          }
        }
      } else {
        if (s.kind === 'reflect') continue;
        const sr: Rect = { x: s.x - s.w / 2, y: s.y - s.h / 2, w: s.w, h: s.h };
        // the deflect shield
        if (this.shieldT > 0 && this.lead === 'enzo') {
          const sh: Rect = { x: b.x + (b.face > 0 ? 6 : -22), y: b.y - 34, w: 16, h: 34 };
          if (overlap(sr, sh) && s.kind !== 'beam') {
            s.friendly = true; s.vx = -s.vx * 1.3 || b.face * 4; s.vy = -s.vy * 0.5; s.dmg = Math.max(2, s.dmg); s.hits = []; s.power = 'cannon'; s.life = 120; s.g = 0;
            this.sfx('reflect'); this.emit({ k: 'spark', x: s.x, y: s.y }); continue;
          }
        }
        for (const ef of this.effects) if (ef.kind === 'decoy' && overlap(sr, { x: ef.x - 6, y: ef.y - 24, w: 12, h: 24 })) { ef.hp--; s.life = 0; }
        if (s.life > 0 && overlap(sr, hr)) { if (this.hurt(s.dmg + 1, s.x)) { if (s.kind !== 'beam') s.life = 0; } }
      }
    }
    this.shots = this.shots.filter((s) => s.life > 0 && s.y < ROWS * T + 40 && s.y > -80);
  }
  nearestFoe(x: number, y: number, range: number): { x: number; y: number } | null {
    let best: { x: number; y: number } | null = null, bd = range;
    for (const e of this.foes) if (e.alive && !e.hidden) { const d = Math.hypot(e.x - x, e.y - y); if (d < bd) { bd = d; best = e; } }
    if (this.boss && !this.boss.hidden && this.boss.st !== 'calm') { const bb = bossBox(this.boss, this.tick), bx = bb.x + bb.w / 2, by = bb.y + bb.h / 2; if (Math.hypot(bx - x, by - y) < bd) best = { x: bx, y: by }; }
    return best;
  }
  chain(from: Foe, n: number) {
    let cur = from; const done = [from.id];
    for (let i = 0; i < n; i++) {
      let next: Foe | null = null, bd = 100;
      for (const e of this.foes) if (e.alive && !e.hidden && !done.includes(e.id)) { const d = Math.hypot(e.x - cur.x, e.y - cur.y); if (d < bd) { bd = d; next = e; } }
      if (!next) break;
      done.push(next.id); this.effects.push({ kind: 'zap', x: cur.x, y: cur.y, t: 0, life: 10, hp: next.x * 10000 + next.y });
      this.damageFoe(next, 1, 0, false, 'spark'); cur = next;
    }
  }
  breakTile(c: number, r: number) {
    if (this.tileAt(c, r) !== '%') return;
    this.grid[r][c] = ' ';
    this.emit({ k: 'debris', x: c * T + 8, y: r * T + 8 }); this.sfx('crumble'); this.emit({ k: 'shake', n: 2 });
    // a cracked wall comes down together
    for (const [dc, dr] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) if (this.tileAt(c + dc, r + dr) === '%') this.breakTile(c + dc, r + dr);
  }

  // ─── effects ───
  stepEffects() {
    const b = this.body;
    for (const ef of this.effects) {
      ef.t++;
      if (ef.kind === 'cloud') {
        ef.x += (b.x - ef.x) * 0.08; ef.y += (b.y - 64 - ef.y) * 0.08;
        if (ef.t % 40 === 0) {
          let best: Foe | null = null, bd = 120;
          for (const e of this.foes) if (e.alive && !e.hidden && e.y > ef.y && Math.abs(e.x - ef.x) < bd) { bd = Math.abs(e.x - ef.x); best = e; }
          if (best) { this.effects.push({ kind: 'zap', x: ef.x, y: ef.y, t: 0, life: 10, hp: best.x * 10000 + best.y }); this.damageFoe(best, 2, 0, false, 'cloud'); this.sfx('zap'); }
          else if (this.boss && !this.boss.hidden && this.boss.st !== 'calm' && Math.abs(this.boss.x - ef.x) < 100) { this.effects.push({ kind: 'zap', x: ef.x, y: ef.y, t: 0, life: 10, hp: this.boss.x * 10000 + (this.boss.y - 20) }); this.damageBoss(2, 'cloud'); }
        }
      }
      if (ef.kind === 'strike' && ef.t === 40) {
        this.sfx('strike'); this.emit({ k: 'shake', n: 4 });
        const r: Rect = { x: ef.x - 14, y: ef.y - 200, w: 28, h: 200 };
        for (const e of this.foes) if (e.alive && !e.hidden && overlap(r, foeBox(e))) this.damageFoe(e, 6, 0, true, 'strike');
        if (this.boss && !this.boss.hidden && this.boss.st !== 'calm' && overlap(r, bossBox(this.boss, this.tick))) this.damageBoss(6, 'strike');
        for (let rr = Math.floor(ef.y / T) - 1; rr <= Math.floor(ef.y / T); rr++) this.breakTile(Math.floor(ef.x / T), rr);
      }
      if (ef.kind === 'decoy' && ef.hp <= 0) ef.life = 0;
    }
    this.effects = this.effects.filter((e) => e.t < e.life);
  }

  // ─── pickups, items, checkpoints ───
  stepPickups() {
    const b = this.body, hr = this.heroRect();
    const reach = this.chip('bolt-magnet') ? 64 : 0;
    for (const p of this.pickups) {
      p.t++; if (p.life > 0) p.life--;
      if (p.pulled || (reach && Math.hypot(p.x - b.x, p.y - b.y + 14) < reach)) { const d = Math.max(1, Math.hypot(b.x - p.x, b.y - 14 - p.y)); p.x += ((b.x - p.x) / d) * 4; p.y += ((b.y - 14 - p.y) / d) * 4; p.vy = 0; }
      else if (p.life >= 0) {
        p.vy = Math.min(p.vy + 0.2, 4); const ny = p.y + p.vy; const r = Math.floor((ny + 4) / T), c = Math.floor(p.x / T);
        if (p.vy > 0 && (this.solid(c, r) || this.oneway(c, r))) { p.y = r * T - 4; p.vy = 0; } else p.y = ny;
      }
      if (overlap(hr, { x: p.x - 6, y: p.y - 6, w: 12, h: 12 })) {
        p.life = 0; p.t = -1;
        const h = this.heroes[this.lead];
        if (p.kind === 'bolt') { this.save.bolts = Math.min(9999, this.save.bolts + (p.life === -1 ? 3 : 2)); this.sfx('bolt'); }
        else if (p.kind === 'hp') { h.hp = Math.min(maxHp(this.save), h.hp + 4); this.sfx('heal'); }
        else { h.en = Math.min(MAX_EN, h.en + 6); this.sfx('energy'); }
      }
    }
    this.pickups = this.pickups.filter((p) => p.t >= 0 && p.life !== 0 && p.y < ROWS * T + 20);
  }
  stepItems() {
    const hr = this.heroRect();
    for (const it of this.stage.items) {
      if (this.taken.has(it.id)) continue;
      if (!overlap(hr, { x: it.x - 10, y: it.y - 26, w: 20, h: 26 })) continue;
      this.taken.add(it.id); this.save.items.push(it.id);
      if (it.kind === 'heart') { for (const h of ['dora', 'enzo'] as HeroId[]) if (!this.heroes[h].down) this.heroes[h].hp += 2; }
      if (it.kind === 'tank') this.save.tanks = Math.min(tankCount(this.save), this.save.tanks + 1);
      this.emit({ k: 'item', id: it.id, kind: it.kind }); this.sfx('capsule'); this.emit({ k: 'save' });
    }
  }
  stepChecks() {
    const cps = this.checks(), b = this.body;
    for (let i = this.checkpoint + 1; i < cps.length; i++) {
      if (b.x >= cps[i].x && Math.abs(b.y - cps[i].y) < 80) {
        this.checkpoint = i; this.check = { x: cps[i].x, y: cps[i].y };
        for (const h of ['dora', 'enzo'] as HeroId[]) if (this.heroes[h].down) { this.heroes[h].down = false; this.heroes[h].hp = Math.ceil(maxHp(this.save) / 2); }
        if (this.assist) this.save.tanks = tankCount(this.save);
        this.emit({ k: 'check' }); this.sfx('check'); this.emit({ k: 'save' });
      }
    }
    // the bike
    if (this.riding < 0) for (let i = 0; i < this.bike.length; i++) {
      const bk = this.bike[i];
      if (Math.abs(b.x - bk.x) < 14 && Math.abs(b.y - bk.y) < 10 && b.ground && bk.x < bk.x1 - 20) {
        this.riding = i; bk.on = true; this.body.dashT = 0; this.body.cling = false; this.emit({ k: 'bike', on: true }); this.sfx('mount');
      }
    }
  }
  stepArenas() {
    const st = this.stage, b = this.body;
    if (st.gallery) { this.stepGallery(); return; }
    if (!this.boss && st.arena && st.boss && b.x > (st.arena.c0 + 1) * T && this.mode === 'play') this.startBoss(st.boss, st.arena);
  }
  stepGallery() {
    const g = this.stage.gallery!, b = this.body;
    if (this.boss) return;
    if (this.inGallery) return;
    for (const p of g.pads) {
      if (this.galleryDone.includes(p.boss)) continue;
      if (Math.abs(b.x - p.x) < 10 && Math.abs(b.y - p.y) < 4 && b.ground) {
        this.inGallery = p.boss; this.body.x = (g.arena.c0 + 3) * T; this.body.y = (g.arena.r1 + 1) * T; this.sfx('teleport');
        this.startBoss(p.boss, g.arena, true); return;
      }
    }
    if (this.galleryDone.length >= 8 && Math.abs(b.x - g.final.x) < 12 && Math.abs(b.y - g.final.y) < 4 && b.ground) {
      this.inGallery = 'lumen'; this.body.x = (g.lumen.c0 + 3) * T; this.body.y = (g.lumen.r1 + 1) * T; this.sfx('teleport');
      this.startBoss('lumen', g.lumen);
    }
  }
  stepHazards() {
    const b = this.body;
    if (this.riding >= 0) return;
    const c0 = Math.floor((b.x - 4) / T), c1 = Math.floor((b.x + 4) / T), r = Math.floor((b.y - 2) / T);
    // live electric puddles are as bad as a pit
    for (let c = c0; c <= c1; c++) if (this.tileAt(c, r) === 'w' && !this.gate) { this.emit({ k: 'flash', color: '#bfe6ff' }); this.sfx('zap'); this.fell(); return; }
    for (let c = c0; c <= c1; c++) if (this.hazard(c, r) || this.hazard(c, Math.floor((b.y - 12) / T))) {
      if (this.hurt(this.assist ? 4 : 6, b.x - b.face * 4)) { b.vy = -4.2; this.emit({ k: 'spark', x: b.x, y: b.y }); }
      break;
    }
    // deep water on foot is a pit
    if (this.water(Math.floor(b.x / T), Math.floor((b.y - 4) / T))) this.fell();
  }

  // ─── bosses ───
  startBoss(id: BossId, arena: Arena, refight = false) {
    const info = BOSSES[id];
    const x = (arena.c1 - 4) * T, floor = (arena.r1 + 1) * T;
    const lvlHp = Math.round(info.hp * (1 + 0.03 * Math.min(6, cores(this.save).filter((c) => c !== id).length)));
    this.boss = { id, x, y: info.fly ? floor - 4 : floor, vx: 0, vy: 0, hp: lvlHp, max: lvlHp, phase: 1, st: 'intro', t: 0, atk: '', last: '', face: -1, flash: 0,
      hidden: false, slow: 0, form: 1, tx: x, ty: floor, n: 0, marks: [], segs: [], arena, refight, stunAt: -999 };
    if (id === 'lumen') { this.boss.x = (arena.c1 - 5) * T; }
    if (id === 'serpent') this.boss.segs = Array.from({ length: 7 }, () => ({ x: this.boss!.x, y: this.boss!.y }));
    this.doorShut = true; this.mode = 'boss'; this.chargeT = 0;
    this.emit({ k: 'boss', id }); this.sfx('door');
  }
  damageBoss(dmg: number, pw: PowerId) {
    const bs = this.boss;
    if (!bs || bs.st === 'calm' || bs.st === 'intro' || bs.hidden) return;
    const core = POWER[pw]?.core;
    const weak = bs.id in WEAK && core && WEAK[bs.id as CoreBoss] === core;
    let d = dmg;
    // a short guard after each hit: shots in it glance off (so a stream of pellets can't melt a boss)
    if (bs.flash > 0) { this.sfx('clink'); return; }
    if (weak) {
      d = Math.max(3, Math.round(dmg * 2));
      // the weakness staggers it, but not again until it has had time to fight back
      if (bs.st !== 'hurt' && this.tick - bs.stunAt > 360) { bs.st = 'hurt'; bs.t = 0; bs.marks = []; bs.stunAt = this.tick; }
      this.sfx('weak'); this.emit({ k: 'shake', n: 4 });
    }
    bs.hp -= d; bs.flash = weak ? 24 : 8; this.stopT = d >= 3 ? 3 : 2;
    this.emit({ k: 'hit', x: bs.x, y: bs.y - BOSSES[bs.id].h / 2, big: d >= 3 }); this.sfx('hitboss');
    if (bs.hp <= 0) {
      if (bs.id === 'lumen' && bs.form === 1) {
        bs.form = 2; bs.hp = 26; bs.max = 26; bs.st = 'recover'; bs.t = 0; bs.y = (bs.arena.r1 - 4) * T; bs.flash = 30;
        this.emit({ k: 'flash', color: '#ffffff' }); this.sfx('bigboom'); this.emit({ k: 'shake', n: 8 }); this.emit({ k: 'toast', text: 'Lumen’s screens fall away: only its bright core is left.' });
        return;
      }
      bs.hp = 0; bs.st = 'calm'; bs.t = 0; bs.marks = []; bs.hidden = false;
      this.shots = this.shots.filter((s) => s.friendly);
      this.foes.forEach((e) => { if (e.kind === 'firefly' && !e.mini && e.hx < 0) e.alive = false; });
      this.emit({ k: 'calm', id: bs.id }); this.sfx('calm'); this.emit({ k: 'shake', n: 8 }); this.stopT = 8;
    }
  }
  bossShot(x: number, y: number, vx: number, vy: number, kind: ShotKind = 'foe', g = 0, size = 8, life = 200) {
    this.shots.push({ id: this.ids++, kind, friendly: false, x, y, vx, vy, g, w: size, h: size, dmg: BOSSES[this.boss!.id].dmg - 1, life, pierce: false, breaks: false, power: 'blaster', hits: [], bounce: 0, t: 0 });
  }
  stepBoss() {
    const bs = this.boss!, info = BOSSES[bs.id], a = bs.arena, b = this.body, tgt = this.target();
    const L = (a.c0 + 1) * T + 8, R = (a.c1) * T - 8, floor = (a.r1 + 1) * T, top = a.r0 * T;
    const spd = this.bossSpeed * (1 + 0.12 * (bs.phase - 1)) * (bs.slow > 0 ? 0.5 : 1);
    if (bs.slow > 0) bs.slow--;
    if (bs.flash > 0) bs.flash--;
    bs.t++;
    const hpFrac = bs.hp / bs.max;
    bs.phase = bs.id === 'lumen' ? bs.form + (hpFrac < 0.5 ? 1 : 0) : hpFrac > 0.66 ? 1 : hpFrac > 0.33 ? 2 : 3;
    if (bs.st === 'intro') { if (bs.t >= 80) { bs.st = 'idle'; bs.t = 0; } return; }
    if (bs.st === 'calm') {
      if (bs.t === 1 && bs.id !== 'lumen') this.emit({ k: 'reboot', x: bs.x, y: bs.y - info.h / 2, big: true });
      if (!info.fly || bs.id === 'lumen') { bs.y = Math.min(floor, bs.y + 2); } else { bs.y = Math.min(floor - 10, bs.y + 1.5); }
      if (bs.t === 120) this.finishBoss();
      return;
    }
    const face = (x: number) => { bs.face = x > bs.x ? 1 : -1; };
    const flyer = (info.fly && bs.id !== 'serpent') || (bs.id === 'lumen' && bs.form === 2);
    if (bs.st === 'hurt') { if (bs.t >= 36) { bs.st = 'recover'; bs.t = 0; } this.bossTouch(); return; }
    if (bs.st === 'recover') {
      if (flyer) { bs.y += ((floor - 4) - bs.y) * 0.05; }
      if (bs.hidden && bs.id !== 'mole') bs.hidden = false;
      if (bs.t >= 30 / spd) { bs.st = 'idle'; bs.t = 0; }
      this.bossTouch(); return;
    }
    if (bs.st === 'idle') {
      face(tgt.x);
      if (flyer) { bs.y += ((floor - 4 + Math.sin(this.tick / 20) * 6) - bs.y) * 0.08; const keep = clamp(tgt.x + (tgt.x > (L + R) / 2 ? -110 : 110), L + 30, R - 30); bs.x += clamp(keep - bs.x, -0.6, 0.6); }
      if (bs.id === 'serpent') this.serpentIdle(L, R, floor);
      if (bs.t >= (this.assist ? 50 : 34) / spd) {
        const list = (bs.id === 'lumen' && bs.form === 2 ? ['rings', 'blaze', 'dive', 'rings'] : info.attacks[Math.min(2, bs.phase - 1)]).filter((x) => x !== bs.last);
        bs.atk = list[Math.floor(this.rand() * list.length)]; bs.last = bs.atk;
        bs.st = 'tell'; bs.t = 0; bs.n = 0; bs.marks = [];
        this.sfx('tell'); bs.flash = 0;
        this.bossTell(bs, tgt, L, R, floor);
      }
      this.bossTouch(); return;
    }
    if (bs.st === 'tell') {
      const need = (bs.atk === 'storm' || bs.atk === 'beam' || bs.atk === 'burrow' || bs.atk === 'rocks' || bs.atk === 'slam' && bs.id === 'lumen' ? 46 : 30) * this.tellMul / spd;
      if (bs.id === 'serpent') this.serpentIdle(L, R, floor);
      if (bs.t >= need) { bs.st = 'act'; bs.t = 0; bs.n = 0; }
      this.bossTouch(); return;
    }
    // act
    const done = this.bossAct(bs, tgt, L, R, floor, top, spd);
    if (done) { bs.st = 'recover'; bs.t = 0; bs.vx = 0; bs.vy = 0; }
    this.bossTouch();
  }
  /** set up the tell: aim lines, marked spots */
  bossTell(bs: Boss, tgt: { x: number; y: number }, L: number, R: number, floor: number) {
    if (bs.atk === 'storm' || bs.atk === 'rocks') {
      const n = bs.atk === 'storm' ? 2 + bs.phase : 3 + bs.phase;
      const xs: number[] = [Math.round(tgt.x)];
      for (let i = 1; i < n; i++) xs.push(Math.round(L + this.rand() * (R - L)));
      bs.marks = xs;
    }
    if (bs.atk === 'beam') { bs.tx = tgt.x; bs.ty = tgt.y; }
    if (bs.id === 'lumen' && (bs.atk === 'slam')) bs.marks = [Math.round(clamp(tgt.x, L, R - 60))];
    if (bs.atk === 'drop') bs.tx = clamp(tgt.x, L, R);
    if (bs.atk === 'hide') { const spots = [L + 20, (L + R) / 2, R - 20]; bs.tx = spots[Math.floor(this.rand() * 3)]; bs.ty = floor - 80 - Math.floor(this.rand() * 2) * 40; }
    void floor;
  }
  bossAct(bs: Boss, tgt: { x: number; y: number }, L: number, R: number, floor: number, top: number, spd: number): boolean {
    const info = BOSSES[bs.id], b = this.body, t = bs.t;
    const toward = (x: number) => (x > bs.x ? 1 : -1);
    const face = (x: number) => { bs.face = x > bs.x ? 1 : -1; };
    const aimShot = (sp: number, kind: ShotKind = 'foe', y = bs.y - info.h * 0.6) => { const dx = tgt.x - bs.x, dy = tgt.y - y, d = Math.max(1, Math.hypot(dx, dy)); this.bossShot(bs.x + bs.face * 20, y, (dx / d) * sp, (dy / d) * sp, kind); };
    const radial = (n: number, sp: number, y = bs.y - info.h / 2, off = 0) => { for (let i = 0; i < n; i++) { const an = off + (i / n) * Math.PI * 2; this.bossShot(bs.x, y, Math.cos(an) * sp, Math.sin(an) * sp, 'ring'); } this.sfx('burst'); };
    const shock = () => { for (const d of [-1, 1]) this.bossShot(bs.x + d * info.w / 2, floor - 8, d * 2.6 * spd, 0, 'wave', 0, 14, 120); this.emit({ k: 'shake', n: 5 }); this.sfx('slam'); };
    const run = (v: number) => { bs.x += v; if (bs.x < L + info.w / 2) { bs.x = L + info.w / 2; return true; } if (bs.x > R - info.w / 2) { bs.x = R - info.w / 2; return true; } return false; };
    const leapTo = (x: number, dur: number) => { if (t === 1) { bs.tx = clamp(x, L + info.w / 2, R - info.w / 2); bs.ty = bs.x; } const k = Math.min(1, t / dur); bs.x = bs.ty + (bs.tx - bs.ty) * k; bs.y = floor - Math.sin(k * Math.PI) * 90; return k >= 1; };
    switch (bs.atk) {
      // the sentinel (rooftop): a big sentry
      case 'roll': if (t === 1) bs.vx = toward(tgt.x) * 2.6 * spd; return run(bs.vx) || t > 120;
      case 'volley': if (t % 18 === 1 && t < 60) aimShot(2.6); return t > 70;
      case 'hop': return leapTo(tgt.x, 50) && (shock(), true);
      // Magnet Crab
      case 'pull': {
        if (b.ground || this.riding < 0) { const d = toward(b.x); if (Math.abs(b.x - bs.x) > 20) this.body.x -= d * 0.55 * spd; }
        if (t % 8 === 0) this.emit({ k: 'spark', x: bs.x + bs.face * 30, y: bs.y - 30 });
        if (t % 10 === 0) this.sfx('magnetpull');
        return t > 110;
      }
      case 'slam': {
        if (bs.id === 'lumen') {
          if (t === 1) { this.sfx('slam'); }
          if (t === 20) { const x = bs.marks[0] ?? tgt.x; for (const d of [-1, 1]) this.bossShot(x + d * 20, floor - 8, d * 2.4 * spd, 0, 'wave', 0, 14, 110); this.shots.push({ id: this.ids++, kind: 'beam', friendly: false, x: x + 30, y: floor - 24, vx: 0, vy: 0, g: 0, w: 60, h: 48, dmg: 4, life: 14, pierce: true, breaks: false, power: 'blaster', hits: [], bounce: 0, t: 0 }); this.emit({ k: 'shake', n: 7 }); bs.marks = []; }
          return t > 50;
        }
        if (t < 24) { bs.y = floor - Math.sin((t / 24) * Math.PI) * 40; return false; }
        if (t === 24) { bs.y = floor; shock(); }
        return t > 40;
      }
      case 'scuttle': if (t === 1) bs.vx = (bs.x > (L + R) / 2 ? -1 : 1) * 3 * spd; return run(bs.vx);
      case 'scrap': if (t === 1 || t === 20) { this.bossShot(bs.x, bs.y - 30, toward(tgt.x) * 3, -0.2 * (t === 1 ? 1 : -1), 'scrap', 0, 12); this.sfx('throw'); } return t > 110;
      // Neon Chameleon
      case 'tongue': {
        if (t === 1) this.sfx('tongue');
        const reach = Math.min(1, t / 10) * (t < 34 ? 1 : Math.max(0, 1 - (t - 34) / 10)) * 150;
        const r: Rect = { x: bs.face > 0 ? bs.x + 20 : bs.x - 20 - reach, y: bs.y - 22, w: reach, h: 8 };
        if (reach > 4 && overlap(r, this.heroRect())) this.hurt(info.dmg, bs.x);
        bs.tx = reach;
        return t > 46;
      }
      case 'spit': if (t % 14 === 1 && t < 44) { this.bossShot(bs.x + bs.face * 24, bs.y - 26, bs.face * (1.6 + (t / 14) * 0.6), -3.4, 'blob', 0.15, 10); this.sfx('spit'); } return t > 60;
      case 'hide': {
        if (t === 1) { bs.hidden = true; this.sfx('fade'); }
        if (t === 40) { bs.x = bs.tx; bs.y = bs.ty; face(tgt.x); }
        if (t === 70) { bs.hidden = false; this.sfx('appear'); }
        if (t > 70 && t % 12 === 0 && t < 110) { aimShot(2.6, 'blob'); }
        if (t === 125) { bs.y = floor; }
        return t > 130;
      }
      // Subway Mole
      case 'drill': if (t === 1) { bs.vx = toward(tgt.x) * 3 * spd; this.sfx('drillboss'); } return run(bs.vx) || t > 100;
      case 'burrow': {
        if (t === 1) { bs.hidden = true; this.sfx('dig'); }
        // it follows the hero for 50 frames, then the mark stays put for 30: time to dash clear
        if (t < 80) { if (t < 50) bs.x += clamp(tgt.x - bs.x, -1.6, 1.6) * spd; if (t % 6 === 0) this.emit({ k: 'debris', x: bs.x, y: floor - 2 }); bs.marks = [bs.x]; return false; }
        if (t === 80) { bs.hidden = false; bs.marks = []; this.emit({ k: 'shake', n: 6 }); this.sfx('burst'); for (let i = 0; i < 4; i++) this.bossShot(bs.x, floor - 30, (i - 1.5) * 1.3, -4, 'rock', 0.18, 10); }
        return t > 100;
      }
      case 'rocks': {
        if (t === 1) { this.emit({ k: 'shake', n: 6 }); this.sfx('slam'); }
        if (t === 10) { for (const x of bs.marks) this.bossShot(x, top + 4, 0, 1, 'rock', 0.15, 12); bs.marks = []; }
        return t > 60;
      }
      // Hologram Peacock
      case 'fan': {
        if (t === 1 || (bs.phase >= 3 && t === 30)) { const n = bs.phase >= 2 ? 7 : 5; for (let i = 0; i < n; i++) { const an = -0.9 + (i / (n - 1)) * 1.4; this.bossShot(bs.x + bs.face * 20, bs.y - 40, bs.face * Math.cos(an) * 2.6, Math.sin(an) * 2.6, 'ring'); } this.sfx('fan'); }
        return t > 50;
      }
      case 'peck': if (t === 1) { bs.vx = toward(tgt.x) * 3.6 * spd; this.sfx('dash'); } return run(bs.vx) || t > 90;
      case 'leap': return leapTo(tgt.x, 56) && (shock(), true);
      // Storm Heron
      case 'storm': {
        if (t < 30) { bs.y += ((top + 30) - bs.y) * 0.1; return false; }
        if (t === 30) { for (const x of bs.marks) this.shots.push({ id: this.ids++, kind: 'beam', friendly: false, x, y: (top + floor) / 2, vx: 0, vy: 0, g: 0, w: 18, h: floor - top, dmg: 4, life: 22, pierce: true, breaks: false, power: 'blaster', hits: [], bounce: 0, t: 0 }); this.sfx('thunder'); this.emit({ k: 'flash', color: '#cfe6ff' }); this.emit({ k: 'shake', n: 5 }); }
        if (t === 52) bs.marks = [];
        return t > 70;
      }
      case 'stab': {
        if (t === 1) { const dx = tgt.x - bs.x, dy = tgt.y - (bs.y - 30), d = Math.max(1, Math.hypot(dx, dy)); bs.vx = (dx / d) * 4 * spd; bs.vy = (dy / d) * 4 * spd; face(tgt.x); this.sfx('swoop'); }
        bs.x = clamp(bs.x + bs.vx, L + 20, R - 20); bs.y = clamp(bs.y + bs.vy, top + 60, floor);
        return t > 40 || bs.y >= floor;
      }
      case 'gust': {
        if (t % 4 === 0 && this.riding < 0) this.body.x = clamp(this.body.x + toward(this.body.x) * 1.6, L - 4, R + 4);
        if (t % 20 === 0) this.bossShot(bs.x, bs.y - 30, toward(tgt.x) * 2.4, (this.rand() - 0.5) * 1.2, 'foe');
        if (t % 10 === 0) this.sfx('wind');
        return t > 100;
      }
      // Scrapyard Rhino
      case 'charge': {
        if (t === 1) { bs.vx = toward(tgt.x) * 3.2 * spd; this.sfx('charge'); }
        if (bs.n === 0 && run(bs.vx)) { bs.n = 1; bs.t = 1000; this.emit({ k: 'shake', n: 8 }); this.sfx('slam'); for (let i = 0; i < 3; i++) this.bossShot(L + this.rand() * (R - L), top + 4, 0, 1, 'rock', 0.15, 12); }
        if (bs.n === 1) return t > 1050;
        return t > 160;
      }
      case 'stomp': if (t === 16 || (bs.phase >= 3 && t === 46)) shock(); return t > (bs.phase >= 3 ? 70 : 40);
      case 'jump': return leapTo(tgt.x, 60) && (shock(), true);
      // Satellite Owl
      case 'beam': {
        if (bs.id === 'lumen') {
          if (t === 1) { bs.ty = this.rand() < 0.5 ? floor - 10 : floor - 62; this.sfx('beam'); }
          if (t < 40) { const r: Rect = { x: L, y: bs.ty - 6, w: bs.x - L - 30, h: 12 }; if (overlap(r, this.heroRect())) this.hurt(info.dmg, bs.x); }
          return t > 50;
        }
        if (t === 1) this.sfx('beam');
        const dx = bs.tx - bs.x, dy = bs.ty - (bs.y - 30), d = Math.max(1, Math.hypot(dx, dy));
        if (t >= 6 && t < 30) {
          for (let s = 30; s < 420; s += 16) { const px = bs.x + (dx / d) * s, py = bs.y - 30 + (dy / d) * s; if (overlap({ x: px - 6, y: py - 6, w: 12, h: 12 }, this.heroRect())) { this.hurt(info.dmg, bs.x); break; } }
        }
        return t > 40;
      }
      case 'swoop': {
        if (t === 1) { bs.tx = tgt.x; bs.ty = bs.x; this.sfx('swoop'); }
        const k = Math.min(1, t / 60); bs.x = bs.ty + (bs.tx - bs.ty) * k * 1.4; bs.x = clamp(bs.x, L + 20, R - 20); bs.y = floor - 4 - Math.sin(k * Math.PI) * 76;
        // over the heroes' heads, it drops a fan of feathers
        if (t === 30) { for (const vx of [-1.2, 0, 1.2]) this.bossShot(bs.x, bs.y - 10, vx, 2.2, 'feather', 0, 8); this.sfx('throw'); }
        return k >= 1;
      }
      case 'orbit': if (t === 1 || t === 30) radial(bs.phase >= 3 ? 10 : 8, 1.6, bs.y - 30, t === 30 ? 0.3 : 0); return t > 60;
      // Firefly Queen
      case 'swarm': {
        if (t === 1) {
          const alive = this.foes.filter((e) => e.alive && e.kind === 'firefly' && e.hx < 0).length;
          for (let i = 0; i < Math.min(3, 5 - alive); i++) this.foes.push({ id: this.ids++, kind: 'firefly', x: bs.x, y: bs.y - 30, vx: 0, vy: 0, hp: 1, max: 1, face: -1, st: 'idle', t: 0, cd: 30 + i * 20, flash: 0, alive: true, hx: -1, hy: -1, big: false, shield: false, frozen: 0, hidden: false, ground: false, mini: false, respawn: 0 });
          this.sfx('swarm');
        }
        // her swarm circles her until it dives
        for (const e of this.foes) if (e.alive && e.kind === 'firefly' && e.hx < 0 && e.st === 'idle') { e.x = bs.x + Math.cos(this.tick / 20 + e.id) * 40; e.y = bs.y - 30 + Math.sin(this.tick / 20 + e.id) * 20; }
        return t > 40;
      }
      case 'blaze': if (t === 1 || (bs.phase >= 3 && t === 26)) radial(bs.phase >= 3 ? 12 : 8, 2, bs.y - 30, t === 26 ? 0.26 : 0); return t > 50;
      case 'dive': {
        if (t === 1) { const dx = tgt.x - bs.x, dy = tgt.y - (bs.y - 26), d = Math.max(1, Math.hypot(dx, dy)); bs.vx = (dx / d) * 3.6 * spd; bs.vy = (dy / d) * 3.6 * spd; this.sfx('swoop'); }
        bs.x = clamp(bs.x + bs.vx, L + 20, R - 20); bs.y = clamp(bs.y + bs.vy, top + 50, floor);
        return t > 46;
      }
      // Antenna Spider
      case 'drop': {
        if (t < 30) { bs.y += (top + 50 - bs.y) * 0.15; return false; }
        if (t === 30) bs.x = bs.tx;
        if (t > 40) { bs.y = Math.min(floor, bs.y + 5); if (bs.y >= floor && bs.n === 0) { bs.n = 1; shock(); } }
        return t > 80;
      }
      case 'rings': if (t === 1 || t === 24 || (bs.phase >= 3 && t === 48)) radial(bs.phase >= 2 ? 10 : 8, 1.8, bs.y - 30, t * 0.01); return t > 60;
      case 'stab': {
        if (bs.id === 'heron') return true;
        if (t === 1) { bs.vx = toward(tgt.x) * 3 * spd; this.sfx('dash'); }
        return run(bs.vx) || t > 70;
      }
      // Cable Serpent
      case 'lunge': {
        if (t === 1) { bs.x = tgt.x > (L + R) / 2 ? L + 10 : R - 10; bs.y = clamp(tgt.y, top + 40, floor - 14); face(tgt.x); bs.vx = bs.face * 3.6 * spd; this.sfx('lunge'); }
        bs.x += bs.vx; this.pushSegs();
        return bs.x < L || bs.x > R || t > 90;
      }
      case 'sparks': if (t % 16 === 1 && t < 50) { aimShot(2.8, 'foe', bs.y - 10); } this.serpentIdle(L, R, floor); return t > 60;
      case 'wave': { bs.x = L + ((R - L) * t) / 120; bs.y = floor - 60 + Math.sin(t / 10) * 50; this.pushSegs(); return t > 120; }
      // Lumen
      case 'sweep': {
        if (t === 1) { bs.tx = R - 40; this.sfx('sweep'); }
        bs.tx -= 4 * spd;
        const r: Rect = { x: bs.tx - 24, y: floor - 22, w: 48, h: 22 };
        if (overlap(r, this.heroRect())) this.hurt(info.dmg, bs.tx);
        return bs.tx < L + 10;
      }
      case 'core': return true;
    }
    return true;
  }
  serpentIdle(L: number, R: number, floor: number) {
    const bs = this.boss!;
    bs.x = (L + R) / 2 + Math.sin(this.tick / 50) * (R - L) * 0.35; bs.y = floor - 70 + Math.sin(this.tick / 23) * 30;
    bs.face = Math.cos(this.tick / 50) > 0 ? 1 : -1;
    this.pushSegs();
  }
  pushSegs() {
    const bs = this.boss!;
    if (!bs.segs.length) return;
    bs.segs.unshift({ x: bs.x, y: bs.y }); bs.segs.length = 7 * 5;
    for (let i = 0; i < bs.segs.length; i++) if (!bs.segs[i]) bs.segs[i] = { x: bs.x, y: bs.y };
  }
  /** touching the boss hurts (its body, the Serpent's coils, and Lumen's core in its second form) */
  bossTouch() {
    const bs = this.boss!;
    if (bs.hidden || bs.st === 'calm' || bs.st === 'intro' || this.ghostT > 0) return;
    const hr = this.heroRect();
    const lumen1 = bs.id === 'lumen' && bs.form === 1;
    const box = lumen1 ? { x: bs.x - 60, y: bs.y - 160, w: 120, h: 160 } : bossBox(bs, this.tick);
    if (overlap(hr, box)) {
      if (this.shieldT > 0 && Math.sign(bs.x - this.body.x) === this.body.face) { this.sfx('reflect'); return; }
      // touching a boss between its attacks stings less than being hit by one
      this.hurt(bs.st === 'act' ? BOSSES[bs.id].dmg : Math.ceil(BOSSES[bs.id].dmg / 2), bs.x);
    }
    if (bs.id === 'serpent' && bs.st === 'act') for (let i = 5; i < bs.segs.length; i += 5) { const s = bs.segs[i]; if (s && overlap(hr, { x: s.x - 8, y: s.y - 8, w: 16, h: 16 })) { this.hurt(2, s.x); break; } }
  }
  finishBoss() {
    const bs = this.boss!;
    if (this.stage.gallery && bs.id !== 'lumen') {
      // back to the gallery
      this.galleryDone.push(bs.id as CoreBoss); this.inGallery = null; this.boss = null; this.doorShut = false; this.mode = 'play';
      const pad = this.stage.gallery.pads.find((p) => p.boss === bs.id)!;
      this.body.x = pad.x; this.body.y = pad.y - 0.01; this.body.vx = 0; this.body.vy = 0; this.lastSafe = { x: pad.x, y: pad.y };
      for (const h of ['dora', 'enzo'] as HeroId[]) if (!this.heroes[h].down) this.heroes[h].hp = Math.min(maxHp(this.save), this.heroes[h].hp + 8);
      this.pickups.push({ id: this.ids++, kind: 'en', x: pad.x + 16, y: pad.y - 20, vy: 0, t: 0, pulled: false, life: 900 });
      this.sfx('teleport'); this.emit({ k: 'toast', text: `${BOSS_NAME[bs.id]} rebooted again. ${8 - this.galleryDone.length} to go.` });
      if (this.galleryDone.length === 8) this.emit({ k: 'toast', text: 'All eight! The centre teleporter to Lumen is open.' });
      return;
    }
    if (!this.save.beaten.includes(bs.id)) this.save.beaten.push(bs.id);
    if (this.stage.id === 'intro') this.save.intro = true;
    if (bs.id === 'lumen') this.save.ending = true;
    const key = this.stage.id;
    const tsec = Math.round(this.save.time);
    if (!this.save.clears[key] || tsec < this.save.clears[key]) this.save.clears[key] = tsec;
    this.mode = 'clear'; this.modeT = 0; this.body.vx = 0; this.shots = [];
    this.emit({ k: 'clear' }); this.emit({ k: 'save' });
    if (bs.id === 'lumen') this.emit({ k: 'ending' });
  }

  // ─── for the page and tests ───
  hud() {
    const h = this.heroes, b = this.boss;
    return {
      lead: this.lead, dora: { ...h.dora }, enzo: { ...h.enzo }, max: maxHp(this.save), maxEn: MAX_EN,
      power: this.power(), powerName: POWER[this.power()].name, bolts: this.save.bolts, tanks: this.save.tanks, tankMax: tankCount(this.save),
      boss: b ? { id: b.id, name: BOSS_NAME[b.id], hp: Math.max(0, b.hp), max: b.max, st: b.st, form: b.form } : null,
      mini: this.miniOn ? this.foes.find((e) => e.mini && e.alive) ?? null : null,
      mode: this.mode, stage: this.stage.id, charge: this.chargeLevel(), riding: this.riding >= 0, checkpoint: this.checkpoint,
      gallery: this.stage.gallery ? this.galleryDone.length : -1,
    };
  }
  /** items in this stage the save hasn't found, with whether they can be reached yet */
  itemsLeft() { return this.stage.items.filter((i) => !this.taken.has(i.id)).map((i) => ({ ...i, open: reqMet(this.save, i.req) })); }
  // debug
  teleport(x: number, y: number) { this.body.x = x; this.body.y = y; this.body.vx = 0; this.body.vy = 0; this.lastSafe = { x, y }; this.riding = -1; }
  toCheckpoint(i: number) { const c = this.checks()[i]; if (!c) return false; this.checkpoint = i; this.check = { x: c.x, y: c.y }; this.teleport(c.x, c.y); return true; }
  fightBoss() { const st = this.stage; if (st.gallery) { this.teleport(st.gallery.pads[0].x - 40, st.gallery.pads[0].y); return; } if (st.arena) this.teleport((st.arena.c0 + 3) * T, (st.arena.r1 + 1) * T); }
}

/** For the hub's map: every capsule, where it is, and whether it's been found. */
export function itemMap(s: Save) {
  return BOSS_STAGES.map((id) => ({ stage: id, name: STAGES[id].name, items: STAGES[id].items.map((i) => ({ id: i.id, kind: i.kind, found: s.items.includes(i.id), open: reqMet(s, i.req), hint: i.hint })) }));
}
