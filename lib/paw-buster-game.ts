// Paw Buster X: a Mega Man X-style side-scroller. Dora blasts with a chargeable paw buster,
// Enzo slashes with a whisker saber, and the pair tag in and out (or, in co-op, play side by side).
// Pure and deterministic: the page feeds held buttons into step() at a fixed rate and reads the state back to draw it.
export const TILE = 30, ROWS = 18, VIEW_W = 960, VIEW_H = 540;
export const PHYS = { run: 170, dash: 340, dashTime: 0.4, airDash: 0.3, jump: 520, wallJump: 470, kick: 0.12, gravity: 1500, maxFall: 600, slide: 110, cut: -200 };
export const HERO = { hp: 16, tank: 2, w: 20, h: 30 };
/** Buster charge levels in seconds held; the third needs the Arm Cannon. */
export const CHARGE = { mid: 0.55, full: 1.4, giga: 2.4 };
export const VOLT_SPEED = 380;
export const ENERGY = 28, WEAPON_COST = 2, PIT_DAMAGE = 6, SPIKE_DAMAGE = 6, TAG_TIME = 2, TAG_BONUS = 1.5, WEAKNESS = 3;
export const SUB_CAP = 16, RUSH_HP = 16, CRUSH_DAMAGE = 4, CRUSH_PERIOD = 2.6, CRUSH_LIFT = 150, BELT = 90, HITSTOP = 0.05;
/** Seconds a co-op hero must stand by a fallen partner to revive them; hard mode's health multiplier; waterfall float speed. */
export const REVIVE = 2, HARD_HP = 1.5, FLOAT = 210, GUARDIAN_HP = 20;

export type StageId = 'snowcap' | 'cloud' | 'caldera' | 'mines' | 'salt' | 'lake' | 'citadel';
export type WeaponId = 'buster' | 'frost' | 'gale' | 'ember' | 'quartz' | 'volt' | 'bubble';
export type HeroId = 'dora' | 'enzo';
export type BossKind = 'fox' | 'owl' | 'snake' | 'armadillo' | 'vicuna' | 'toad' | 'cougar';
export type EnemyKind = 'beetle' | 'bat' | 'turret' | 'hopper' | 'ceiling' | 'shield' | 'bomber' | 'guardian';
export type PartId = 'boots' | 'saber' | 'helmet' | 'armor' | 'arm';
export type Rank = 'S' | 'A' | 'B' | 'C';
export type BadgeId = 'untouched' | 'buster' | 'nosub' | 'hard';
export type ShotKind = 'lemon' | 'mid' | 'full' | 'giga' | 'frost' | 'gale' | 'ember' | 'quartz' | 'volt' | 'bubble' | 'icewall' | 'tornado' | 'pillar'
  | 'pellet' | 'shard' | 'feather' | 'fire' | 'wave' | 'claw' | 'crystal' | 'rock' | 'bolt' | 'spark' | 'tongue' | 'foam' | 'bomb';
export type Input = { left: boolean; right: boolean; jump: boolean; fire: boolean; dash: boolean; swap: boolean; prev: boolean; next: boolean };
export const NO_INPUT: Input = { left: false, right: false, jump: false, fire: false, dash: false, swap: false, prev: false, next: false };
export const HEROES: HeroId[] = ['dora', 'enzo'];

export const WEAPONS: Record<WeaponId, { name: string; from: StageId | null; color: string; detail: string; charged: string }> = {
  buster: { name: 'Paw Buster', from: null, color: '#ffe27a', detail: 'Dora fires; hold to charge. Enzo swings his whisker saber, which also cuts enemy shots.', charged: 'Dora’s full charge deals 4 and pierces.' },
  frost: { name: 'Frost Shard', from: 'snowcap', color: '#9fe3ff', detail: 'A fast ice shard that pierces every enemy in a line.', charged: 'An ice wall that blocks shots for 3 seconds.' },
  gale: { name: 'Gale Feather', from: 'cloud', color: '#cfeeb4', detail: 'Three feathers in a fan.', charged: 'A slow tornado that grinds through everything in its path.' },
  ember: { name: 'Ember Coil', from: 'caldera', color: '#ff9a4a', detail: 'A fireball that drops and rolls along the ground.', charged: 'A pillar of fire in front of you.' },
  quartz: { name: 'Quartz Orbit', from: 'mines', color: '#e3a8ff', detail: 'Three crystals circle you for 3 seconds, blocking enemy shots and grinding anything they touch.', charged: 'Six crystals burst outward in a ring.' },
  volt: { name: 'Volt Spark', from: 'salt', color: '#fff27a', detail: 'A spark that curves toward the nearest enemy.', charged: 'Three homing sparks at once.' },
  bubble: { name: 'Bubble Burst', from: 'lake', color: '#8fe0ff', detail: 'Two big bubbles that float upward and pass through enemies.', charged: 'One giant bubble that hits again and again.' },
};
export const PARTS: Record<PartId, { name: string; from: StageId; detail: string }> = {
  boots: { name: 'Dash Boots', from: 'salt', detail: 'Press dash in mid-air for one air dash per jump.' },
  saber: { name: 'Saber Crest', from: 'mines', detail: 'Enzo’s slash while dashing becomes a 5-damage dash slash with longer reach.' },
  helmet: { name: 'Scout Helmet', from: 'cloud', detail: 'Hidden walls show as outlines, and arrows at the screen edge point to items you haven’t found yet.' },
  armor: { name: 'Body Armour', from: 'caldera', detail: 'Hits do a quarter less damage and no longer knock you back.' },
  arm: { name: 'Arm Cannon', from: 'snowcap', detail: 'Keep holding Dora’s buster past a full charge for a 6-damage spiral shot.' },
};
/** How to reach each capsule: the upgrades sit behind walls that a later weapon opens. */
export const CAPSULE_HINTS: Partial<Record<PartId, string>> = {
  helmet: 'Float up the Cloud Forest waterfall with Bubble Burst: hold jump in the falling water.',
  armor: 'A crystal wall in Ember Caldera shatters under Quartz Orbit.',
  arm: 'A dead power door on Snowcap Ridge opens to a Volt Spark.',
};
/** Challenges, shown as badges on each stage card. */
export const BADGES: Record<BadgeId, { name: string; icon: string; detail: string }> = {
  untouched: { name: 'Untouched', icon: '🛡', detail: 'Beat the boss without taking a hit in its room.' },
  buster: { name: 'Buster only', icon: '🍋', detail: 'Clear the stage without firing a special weapon.' },
  nosub: { name: 'Dry tanks', icon: '🚫', detail: 'Beat the Kingpin without drinking from a sub-tank.' },
  hard: { name: 'Hard clear', icon: '🔥', detail: 'Clear the stage on hard mode.' },
};
export const badgesFor = (id: StageId): BadgeId[] => (id === 'citadel' ? ['untouched', 'buster', 'nosub', 'hard'] : ['untouched', 'buster', 'hard']);
/** Target times in seconds for a gold, silver and bronze medal. */
export const TARGETS: Record<StageId, [number, number, number]> = {
  snowcap: [95, 130, 180], cloud: [100, 135, 185], caldera: [95, 130, 180], mines: [100, 135, 185], salt: [100, 135, 185], lake: [100, 135, 185], citadel: [330, 420, 540],
};
export const medalFor = (id: StageId, time: number) => { const [g, s, b] = TARGETS[id]; return time <= g ? 3 : time <= s ? 2 : time <= b ? 1 : 0; };
export const MEDALS = ['', 'Bronze', 'Silver', 'Gold'];
/** A stage rank from 0 to 8 points: up to 3 for the time medal, 3 for taking little damage and 2 for clearing out the enemies. */
export function rankFor(id: StageId, time: number, damage: number, kills: number, total: number): Rank {
  const pts = medalFor(id, time) + (damage === 0 ? 3 : damage <= 8 ? 2 : damage <= 20 ? 1 : 0) + (total && kills / total >= 0.8 ? 2 : total && kills / total >= 0.5 ? 1 : 0);
  return pts >= 7 ? 'S' : pts >= 5 ? 'A' : pts >= 3 ? 'B' : 'C';
}
const RANKS: Rank[] = ['C', 'B', 'A', 'S'];
export const betterRank = (a: Rank | undefined, b: Rank) => (!a || RANKS.indexOf(b) > RANKS.indexOf(a) ? b : a);
/** Each stage's mid-boss. */
export const GUARDIANS: Record<StageId, string> = { snowcap: 'Snow Golem', cloud: 'Thorn Mantis', caldera: 'Slag Crab', mines: 'Drill Mole', salt: 'Salt Golem', lake: 'Reed Crab', citadel: 'Gate Sentinel' };
export const STAGES: { id: StageId; name: string; boss: BossKind; bossName: string; weapon: WeaponId | null; weakness: WeaponId | null; blurb: string }[] = [
  { id: 'snowcap', name: 'Snowcap Ridge', boss: 'fox', bossName: 'Frost Fox', weapon: 'frost', weakness: 'ember', blurb: 'Icy ledges and a fox who never stops running.' },
  { id: 'cloud', name: 'Cloud Forest', boss: 'owl', bossName: 'Storm Owl', weapon: 'gale', weakness: 'frost', blurb: 'Misty treetops, swooping bats and a storm on silent wings.' },
  { id: 'caldera', name: 'Ember Caldera', boss: 'snake', bossName: 'Magma Snake', weapon: 'ember', weakness: 'gale', blurb: 'Lava rock, spitting turrets and a snake beneath the stone.' },
  { id: 'mines', name: 'Crystal Mines', boss: 'armadillo', bossName: 'Quartz Armadillo', weapon: 'quartz', weakness: 'volt', blurb: 'Low tunnels, glittering walls and an armadillo who rolls through shots.' },
  { id: 'salt', name: 'Salt Flats', boss: 'vicuna', bossName: 'Volt Vicuña', weapon: 'volt', weakness: 'bubble', blurb: 'Blinding white plains, wide gaps and a vicuña who calls down lightning.' },
  { id: 'lake', name: 'Titicaca Falls', boss: 'toad', bossName: 'Tide Toad', weapon: 'bubble', weakness: 'quartz', blurb: 'Reed islands, hopping frogs and a giant toad with a long tongue.' },
  { id: 'citadel', name: 'Cougar Citadel', boss: 'cougar', bossName: 'Cougar Kingpin', weapon: null, weakness: null, blurb: 'Three sectors of conveyors and crushers, a rematch with every maverick, then the Kingpin. Opens once all six mavericks fall.' },
];
export const MAVERICKS: StageId[] = ['snowcap', 'cloud', 'caldera', 'mines', 'salt', 'lake'];
/** Stages that hide a sub-tank. */
export const SUB_STAGES: StageId[] = ['cloud', 'caldera', 'mines', 'lake'];
export const bossInfo = (kind: BossKind) => STAGES.find((s) => s.boss === kind)!;
const BOSS_HP: Record<BossKind, number> = { fox: 32, owl: 32, snake: 32, armadillo: 32, vicuna: 32, toad: 32, cougar: 44 };
const BOSS_SIZE: Record<BossKind, [number, number]> = { fox: [52, 40], owl: [46, 42], snake: [62, 24], armadillo: [54, 36], vicuna: [50, 48], toad: [56, 34], cougar: [56, 44] };
const PATTERNS: Record<BossKind, string[]> = {
  fox: ['shards', 'dash', 'leap', 'shards', 'leap', 'dash'],
  owl: ['hover', 'swoop', 'gust', 'swoop', 'hover', 'gust'],
  snake: ['spit', 'lunge', 'burrow', 'spit', 'burrow', 'lunge'],
  armadillo: ['crystals', 'roll', 'leap', 'crystals', 'quake', 'roll'],
  vicuna: ['bolt', 'dash', 'storm', 'leap', 'bolt', 'storm'],
  toad: ['bubbles', 'hop', 'tongue', 'leap', 'bubbles', 'hop', 'tongue'],
  cougar: ['pounce', 'claw', 'dash', 'roar', 'claw', 'pounce', 'dash'],
};
/** Below half health the Kingpin borrows the mavericks' moves. */
const PHASE2 = ['pounce', 'storm', 'claw', 'lunge', 'bolt', 'roar', 'crystals', 'dash'];
/** The citadel's last room: every maverick again, then the Kingpin. */
export const RUSH: BossKind[] = ['fox', 'owl', 'snake', 'armadillo', 'vicuna', 'toad', 'cougar'];

/** Beating one maverick changes another's stage. */
export const CHANGES: { stage: StageId; by: StageId; effect: 'freeze' | 'cool' | 'calm'; text: string }[] = [
  { stage: 'lake', by: 'snowcap', effect: 'freeze', text: 'The Frost Fox’s cold snap froze the lake: its pits are solid ice.' },
  { stage: 'caldera', by: 'lake', effect: 'cool', text: 'The Tide Toad’s floodwater cooled the lava spikes into plain rock.' },
  { stage: 'salt', by: 'cloud', effect: 'calm', text: 'With the Storm Owl gone, no bats circle the Salt Flats.' },
];

// ---------- progress ----------
export type Progress = {
  cleared: StageId[]; tanks: StageId[]; best: Partial<Record<StageId, number>>; subs: StageId[]; subFill: number[]; parts: PartId[]; found: StageId[];
  ranks: Partial<Record<StageId, Rank>>; medals: Partial<Record<StageId, number>>; badges: string[]; bossBest: Partial<Record<StageId, number>>; deaths: number; playTime: number;
};
export const SAVE_KEY = 'paw-buster-x-v1';
export const freshProgress = (): Progress => ({ cleared: [], tanks: [], best: {}, subs: [], subFill: [], parts: [], found: [], ranks: {}, medals: {}, badges: [], bossBest: {}, deaths: 0, playTime: 0 });
export const copyProgress = (p: Progress): Progress => structuredClone(p);
const isStage = (v: unknown): v is StageId => STAGES.some((s) => s.id === v);
const isPart = (v: unknown): v is PartId => typeof v === 'string' && v in PARTS;
const isBadge = (v: unknown): v is string => typeof v === 'string' && /^[a-z]+:[a-z]+$/.test(v) && isStage(v.split(':')[0]) && badgesFor(v.split(':')[0] as StageId).includes(v.split(':')[1] as BadgeId);
const list = <T>(a: unknown, ok: (x: unknown) => x is T): T[] => (Array.isArray(a) ? [...new Set(a.filter(ok))] : []);
const count = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0);
function times(v: unknown, ok: (t: number) => boolean) {
  const out: Partial<Record<StageId, number>> = {};
  if (v && typeof v === 'object') for (const [k, t] of Object.entries(v)) if (isStage(k) && typeof t === 'number' && Number.isFinite(t) && ok(t)) out[k] = t;
  return out;
}
/** Reads version 3 saves and upgrades versions 1 (cleared stages, heart tanks and best times) and 2 (plus collectibles). */
export function parseProgress(raw: string | null): Progress {
  if (!raw) return freshProgress();
  try {
    const v = JSON.parse(raw);
    if (!v || typeof v !== 'object' || ![1, 2, 3].includes(v.version) || !Array.isArray(v.cleared) || !Array.isArray(v.tanks) || typeof v.best !== 'object' || !v.best) return freshProgress();
    const subs = list(v.subs, (s): s is StageId => isStage(s) && SUB_STAGES.includes(s));
    const fill: unknown[] = Array.isArray(v.subFill) ? v.subFill : [];
    const ranks: Progress['ranks'] = {};
    if (v.ranks && typeof v.ranks === 'object') for (const [k, r] of Object.entries(v.ranks)) if (isStage(k) && RANKS.includes(r as Rank)) ranks[k] = r as Rank;
    return {
      cleared: list(v.cleared, isStage),
      tanks: list(v.tanks, (s): s is StageId => isStage(s) && s !== 'citadel'),
      best: times(v.best, (t) => t > 0),
      subs,
      subFill: subs.map((_, i) => { const f = fill[i]; return typeof f === 'number' && Number.isFinite(f) ? Math.max(0, Math.min(SUB_CAP, f)) : 0; }),
      parts: list(v.parts, isPart),
      found: list(v.found, isStage),
      ranks,
      medals: times(v.medals, (m) => Number.isInteger(m) && m >= 1 && m <= 3),
      badges: list(v.badges, isBadge),
      bossBest: times(v.bossBest, (t) => t > 0),
      deaths: Math.floor(count(v.deaths)),
      playTime: count(v.playTime),
    };
  } catch {
    return freshProgress();
  }
}
export const saveProgress = (p: Progress) => JSON.stringify({ version: 3, ...p });
/** A save code to carry progress to another browser: a prefix and the save, base64 encoded. */
const CODE = 'PBX3-';
export const exportCode = (p: Progress) => CODE + btoa(saveProgress(p)).replace(/=+$/, '');
/** Reads a save code; null when it isn't one. */
export function importCode(code: string): Progress | null {
  const s = code.replace(/\s+/g, '');
  if (!s.startsWith(CODE)) return null;
  try {
    const raw = atob(s.slice(CODE.length));
    const v = JSON.parse(raw);
    if (!v || typeof v !== 'object' || ![1, 2, 3].includes(v.version) || !Array.isArray(v.cleared)) return null;
    return parseProgress(raw);
  } catch {
    return null;
  }
}
// A citadel already beaten stays open for saves made before the last three mavericks arrived.
export const unlocked = (p: Progress, id: StageId) => id !== 'citadel' || p.cleared.includes('citadel') || MAVERICKS.every((s) => p.cleared.includes(s));
export const weaponsFor = (p: Progress): WeaponId[] => (Object.keys(WEAPONS) as WeaponId[]).filter((w) => w === 'buster' || p.cleared.includes(WEAPONS[w].from!));
export const maxHp = (p: Progress) => HERO.hp + HERO.tank * p.tanks.length;
export const changesFor = (p: Progress, id: StageId) => CHANGES.filter((c) => c.stage === id && p.cleared.includes(c.by));

// ---------- stage maps ----------
type Spawn = { kind: EnemyKind; x: number; y: number };
export type ItemKind = 'hp' | 'ammo' | 'tank' | 'sub' | PartId;
export const isPartItem = (k: ItemKind): k is PartId => k in PARTS;
/** Items that hang in place instead of falling. */
const FIXED = (k: ItemKind) => k === 'tank' || k === 'sub' || isPartItem(k);
/** Items that stay found once collected: shown by the Scout Helmet's arrows. */
export const KEEPSAKE = FIXED;
export type PlatformSpec = { x: number; y: number; w: number; ax: number; ay: number; period: number };
export type CrusherSpec = { x: number; w: number; bottom: number; phase: number };
/**
 * Tiles: 0 air, 1 rock, 2 spikes, 3 conveyor moving right, 4 conveyor moving left, 5 ice,
 * 6 crystal wall (Quartz Orbit shatters it), 7 power door (a Volt Spark opens it), 8 hidden wall (looks solid, but isn't).
 */
export const T = { air: 0, rock: 1, spike: 2, beltR: 3, beltL: 4, ice: 5, crystal: 6, door: 7, hidden: 8 } as const;
export const isSolid = (t: number) => t !== T.air && t !== T.hidden;
/** Which weapon opens each breakable tile. */
export const OPENS: Partial<Record<number, WeaponId>> = { [T.crystal]: 'quartz', [T.door]: 'volt' };
export type StageMap = { cols: number; tiles: Uint8Array; spawns: Spawn[]; items: { kind: ItemKind; x: number; y: number }[]; checkpoints: { x: number; y: number }[]; start: { x: number; y: number }; arena: number; exit: number; platforms: PlatformSpec[]; crushers: CrusherSpec[]; falls: { x: number; w: number }[] };
class Builder {
  cols: number[][] = [];
  spawns: Spawn[] = [];
  items: StageMap['items'] = [];
  checkpoints: StageMap['checkpoints'] = [];
  platforms: PlatformSpec[] = [];
  crushers: CrusherSpec[] = [];
  falls: StageMap['falls'] = [];
  start = { x: 0, y: 0 };
  arenaCol = -1;
  exitCol = -1;
  h = 3;
  get x() { return this.cols.length; }
  private col(h: number, spike = false) {
    const c = Array<number>(ROWS).fill(0);
    for (let r = ROWS - h; r < ROWS; r++) c[r] = 1;
    if (spike && h > 0) c[ROWS - h] = 2;
    this.cols.push(c);
  }
  /** Ground `h` tiles tall for `n` columns. */
  run(n: number, h = this.h) { this.h = h; for (let i = 0; i < n; i++) this.col(h); return this; }
  pit(n: number) { for (let i = 0; i < n; i++) this.col(0); return this; }
  spikes(n: number) { for (let i = 0; i < n; i++) this.col(this.h, true); return this; }
  /** Conveyor belt floor at the current height, carrying the heroes left or right. */
  conveyor(n: number, dir: 1 | -1) { for (let i = 0; i < n; i++) { this.col(this.h); this.cols[this.x - 1][ROWS - this.h] = dir > 0 ? 3 : 4; } return this; }
  /** A floating ledge `len` wide, starting `back` columns behind the cursor, its top `height` tiles up. */
  ledge(back: number, len: number, height: number) { for (let i = 0; i < len; i++) this.cols[this.x - back + i][ROWS - height] = 1; return this; }
  /** A moving platform `len` wide whose top swings `ax` tiles sideways and `ay` tiles up and down around `height`. */
  platform(back: number, len: number, height: number, ax = 0, ay = 0, period = 3) { this.platforms.push({ x: (this.x - back) * TILE, y: (ROWS - height) * TILE, w: len * TILE, ax: ax * TILE, ay: ay * TILE, period }); return this; }
  /** A two-column piston that slams down onto the floor `back` columns behind the cursor. */
  crusher(back: number, phase = 0) { const c = this.x - back; this.crushers.push({ x: c * TILE, w: 2 * TILE, bottom: this.top(c), phase }); return this; }
  private top(c: number) { const r = this.cols[c].findIndex((t) => isSolid(t)); return (r < 0 ? ROWS : r) * TILE; }
  /**
   * A two-tile-high room carved into the last `back` columns (which must be taller than `floor`),
   * its floor `floor` tiles up and `len` columns deep, entered from the left through a `door`:
   * a hidden wall, a crystal wall or a power door. The loot sits inside.
   */
  vault(back: number, len: number, floor: number, door: number, loot: ItemKind[]) {
    const c0 = this.x - back;
    for (let i = 0; i < len; i++) for (let r = ROWS - floor - 2; r < ROWS - floor; r++) this.cols[c0 + i][r] = i === 0 ? door : T.air;
    loot.forEach((kind, i) => this.items.push({ kind, x: (c0 + 1 + (i % (len - 1))) * TILE + TILE / 2, y: (ROWS - floor) * TILE }));
    return this;
  }
  /**
   * A hidden room just under the surface of the last `back` columns: the surface tile of its first
   * column looks like rock but isn't, so you drop through it, and a jump gets you back out. Unlike a
   * vault it leaves the wall face solid, so it never swallows a wall-jump climb.
   */
  stash(back: number, len: number, top: number, loot: ItemKind[]) {
    const c0 = this.x - back, surface = ROWS - top;
    // One row deep, so a jump from inside clears the surface again, and the way in is the far end,
    // so heroes land on solid ground first and can run out of it.
    for (let i = 0; i < len; i++) this.cols[c0 + i][surface + 1] = T.air;
    this.cols[c0 + len - 1][surface] = T.hidden;
    loot.forEach((kind, i) => this.items.push({ kind, x: (c0 + (i % len)) * TILE + TILE / 2, y: (surface + 2) * TILE }));
    return this;
  }
  /** A waterfall over the last `back` columns for `len` columns: Bubble Burst lets you float up it. */
  waterfall(back: number, len: number) { this.falls.push({ x: (this.x - back) * TILE, w: len * TILE }); return this; }
  /** A floating item `above` tiles over the ground at `back` columns behind the cursor, or at an exact height. */
  itemAt(kind: ItemKind, back: number, height: number) { this.items.push({ kind, x: (this.x - 1 - back) * TILE + TILE / 2, y: (ROWS - height) * TILE }); return this; }
  private at(back: number, above: number) { const c = this.x - 1 - back; return { x: c * TILE + TILE / 2, y: this.top(c) - above * TILE }; }
  enemy(kind: EnemyKind, back = 0, above = 0) { this.spawns.push({ kind, ...this.at(back, above) }); return this; }
  item(kind: ItemKind, back = 0, above = 0) { this.items.push({ kind, ...this.at(back, above) }); return this; }
  checkpoint(back = 0) { this.checkpoints.push(this.at(back, 0)); return this; }
  begin(back: number) { this.start = this.at(back, 0); return this; }
  /** A rock ceiling `depth` tiles deep over the last `back` columns. */
  ceiling(back: number, depth: number) { for (let i = this.x - back; i < this.x; i++) for (let r = 0; r < depth; r++) this.cols[i][r] = 1; return this; }
  /** A one-screen boss room: a gate column that seals behind the heroes, 30 columns of floor and a full-height far wall. */
  arena() { this.arenaCol = this.x; this.run(31, 3); this.cols.push(Array<number>(ROWS).fill(1)); return this; }
  /** A teleporter to the stage's next sector. */
  exit() { this.exitCol = this.x; this.run(6, 3); this.cols.push(Array<number>(ROWS).fill(1)); return this; }
  done(): StageMap {
    const tiles = new Uint8Array(this.x * ROWS);
    this.cols.forEach((c, i) => c.forEach((t, r) => (tiles[i * ROWS + r] = t)));
    return { cols: this.x, tiles, spawns: this.spawns, items: this.items, checkpoints: this.checkpoints, start: this.start, arena: this.arenaCol, exit: this.exitCol, platforms: this.platforms, crushers: this.crushers, falls: this.falls };
  }
}
// Rises of two tiles or less can be jumped; taller faces are wall-jump climbs. Plain pits are three
// tiles at most; five-tile pits need a dash jump; wider ones have ledges or moving platforms.
const BUILDS: Record<StageId, ((b: Builder) => Builder)[]> = {
  // Each maverick stage has a mid-boss guardian on a long flat stretch, and a vault: a hidden wall
  // (the Scout Helmet shows it), or a crystal wall or power door that a later weapon opens.
  snowcap: [(b) => b.run(12, 3).begin(9).enemy('beetle', 1)
    .run(6, 5).run(5, 5).enemy('beetle', 1)
    .pit(3)
    .run(8, 5).enemy('turret', 2).enemy('shield', 5).item('hp', 6)
    .run(5, 7).spikes(3)
    .run(6, 7).checkpoint(4).enemy('bat', 1, 4)
    .run(8, 12).run(6, 12).enemy('beetle', 2)
    .run(4, 8).run(6, 4)
    // A trench most heroes dash-jump straight over; at the bottom of it, a dead power door.
    .run(3, 1).run(8, 4).vault(8, 5, 1, T.door, ['arm'])
    .run(12, 4).enemy('guardian', 2)
    .pit(7).ledge(5, 3, 5)
    .run(5, 4).enemy('turret', 1)
    .run(2, 10).item('tank', 1)
    .run(8, 4).enemy('beetle', 3).enemy('bomber', 5, 6)
    .pit(5)
    .run(8, 4).item('hp', 5).checkpoint(2)
    .run(3, 3).arena()],
  cloud: [(b) => b.run(10, 3).begin(7).enemy('bat', 1, 4)
    .pit(3).run(6, 4).enemy('beetle', 1)
    .pit(9).ledge(7, 2, 6).ledge(4, 2, 8)
    .run(6, 6).enemy('turret', 1).enemy('ceiling', 4, 5)
    .run(4, 8).spikes(2).run(5, 8).checkpoint(3)
    .run(3, 14).item('tank', 1)
    .run(6, 5).enemy('bat', 2, 3).enemy('bomber', 5, 6)
    .pit(10).ledge(8, 2, 5).ledge(5, 2, 7).ledge(2, 2, 5).item('sub', 4, 1)
    .run(12, 5).enemy('guardian', 2).item('ammo', 9)
    .run(10, 5).waterfall(9, 2).ledge(7, 4, 14).itemAt('helmet', 5, 14)
    .run(5, 7).enemy('turret', 1)
    .run(6, 4).item('hp', 3).checkpoint(1)
    .run(3, 3).arena()],
  caldera: [(b) => b.run(10, 4).begin(7).enemy('turret', 1)
    .spikes(3).run(5, 4).enemy('beetle', 1)
    .run(5, 6).pit(3).run(4, 6).enemy('turret', 1)
    .spikes(4).ledge(3, 2, 8).item('sub', 2, 1)
    .run(6, 6).checkpoint(3).item('hp', 1).enemy('ceiling', 4, 5)
    .run(12, 6).enemy('guardian', 2)
    .run(3, 11).item('tank', 1)
    .run(5, 5).enemy('shield', 2).enemy('bat', 4, 5)
    .pit(5).run(4, 5).spikes(2).run(6, 5).enemy('turret', 1)
    // Down in the trench, a crystal wall.
    .run(3, 1).run(8, 5).vault(8, 5, 1, T.crystal, ['armor'])
    .run(7, 10).enemy('bat', 3, 3)
    .run(6, 4).item('ammo', 4).item('hp', 2).checkpoint(1)
    .run(3, 3).arena()],
  mines: [(b) => b.run(10, 4).begin(7).enemy('beetle', 1)
    .run(6, 4).ceiling(6, 7).enemy('ceiling', 3, 6)
    .pit(3).run(5, 5).enemy('turret', 1).item('sub', 3, 3)
    .run(4, 7).ceiling(4, 5).spikes(3).run(5, 7).checkpoint(3).item('hp', 1).item('saber', 1, 2)
    .run(3, 12).item('tank', 1)
    .run(12, 6).enemy('guardian', 2).enemy('bat', 8, 3)
    .run(5, 10).stash(5, 3, 10, ['hp', 'ammo'])
    .pit(5).run(6, 6).ceiling(6, 6).enemy('turret', 1)
    .spikes(2).run(5, 6).enemy('shield', 1)
    .run(6, 4).item('ammo', 4).item('hp', 2).checkpoint(1)
    .run(3, 3).arena()],
  salt: [(b) => b.run(12, 3).begin(9).enemy('beetle', 1)
    .pit(5).run(8, 3).enemy('turret', 1).enemy('bat', 5, 4).enemy('bomber', 3, 7)
    .pit(5).run(4, 3).spikes(3).run(12, 3).checkpoint(9).enemy('guardian', 2)
    .run(3, 5).run(3, 7).item('hp', 1).enemy('turret', 1)
    .pit(9).ledge(6, 3, 6).item('boots', 4, 1)
    .run(6, 5).enemy('hopper', 2)
    .run(4, 8).stash(4, 3, 8, ['hp', 'ammo'])
    .run(2, 11).item('tank', 1)
    .run(8, 4).enemy('shield', 2).enemy('bat', 5, 5)
    .pit(5).run(6, 4).enemy('turret', 1)
    .run(6, 4).item('ammo', 4).item('hp', 2).checkpoint(1)
    .run(3, 3).arena()],
  lake: [(b) => b.run(10, 3).begin(7).enemy('hopper', 1)
    .pit(3).run(6, 3).enemy('hopper', 2)
    .run(4, 5).run(4, 7).enemy('turret', 1).enemy('ceiling', 2, 6)
    .pit(10).ledge(8, 2, 6).ledge(5, 2, 8).ledge(2, 2, 6).item('sub', 4, 1)
    .run(6, 6).checkpoint(3).item('hp', 1).enemy('hopper', 4)
    .spikes(3).run(5, 6).enemy('bomber', 2, 6)
    .run(3, 12).item('tank', 1).stash(3, 2, 12, ['hp', 'ammo'])
    .run(12, 5).enemy('guardian', 2).enemy('hopper', 9)
    .pit(5).run(5, 5).enemy('turret', 1)
    .run(6, 4).item('ammo', 4).item('hp', 2).checkpoint(1)
    .run(3, 3).arena()],
  citadel: [
    // Sector 1: the outer wall.
    (b) => b.run(10, 3).begin(7).enemy('beetle', 1)
      .run(4, 5).enemy('turret', 1).spikes(3).run(5, 5).enemy('bat', 2, 4)
      .run(6, 11).stash(6, 3, 11, ['hp', 'ammo']).enemy('turret', 1)
      .run(4, 7).pit(5).run(5, 7).enemy('beetle', 1).checkpoint(4).item('hp', 3)
      .spikes(4).run(4, 7).enemy('bat', 1, 4)
      .pit(10).ledge(8, 2, 6).ledge(5, 2, 9).ledge(2, 2, 6)
      .run(5, 4).enemy('turret', 1).run(4, 9).run(4, 4).enemy('shield', 1)
      .run(6, 4).item('ammo', 4).item('hp', 2).checkpoint(1)
      .run(3, 3).exit(),
    // Sector 2: the conveyor works, with belts, crushers and moving platforms.
    (b) => b.run(10, 3).begin(7).enemy('turret', 1)
      .conveyor(8, 1).crusher(4)
      .run(4, 3).enemy('beetle', 1)
      .conveyor(8, -1).crusher(6).crusher(3, 1.3)
      .pit(8).platform(6, 3, 5, 2, 0, 3)
      .run(6, 4).checkpoint(3).item('hp', 1)
      .run(12, 4).enemy('guardian', 2)
      .run(4, 4).crusher(3, 0.8)
      .pit(6).platform(4, 2, 4, 0, 3, 2.6)
      .run(5, 6).enemy('turret', 1)
      .conveyor(6, 1).enemy('bomber', 2, 6)
      .run(4, 4).item('ammo', 1)
      .pit(10).platform(8, 2, 5, 1.5, 0, 2.4).platform(4, 2, 6, 1.5, 0, 2.4)
      .run(6, 4).item('hp', 2).checkpoint(1)
      .run(3, 3).exit(),
    // Sector 3: the throne room and the boss rush.
    (b) => b.run(12, 3).begin(9).enemy('beetle', 1)
      .pit(6).platform(4, 2, 4, 0, 2, 2.2)
      .run(6, 4).checkpoint(4).crusher(2)
      .conveyor(6, -1).crusher(3, 1.3)
      .run(4, 4).enemy('turret', 1).enemy('ceiling', 2, 6)
      .run(5, 4).item('hp', 2).item('ammo', 3).checkpoint(1)
      .run(3, 3).arena(),
  ],
};
export const partsOf = (id: StageId) => BUILDS[id].length;

// ---------- ghost recordings ----------
// A run is one byte of held buttons per step, run-length encoded; replaying it into a fresh game with
// the same save and options reproduces the run exactly, because the engine is deterministic.
const ORDER = Object.keys(NO_INPUT) as (keyof Input)[];
export const inputMask = (i: Input) => ORDER.reduce((m, k, b) => m | (i[k] ? 1 << b : 0), 0);
export const unmask = (m: number) => Object.fromEntries(ORDER.map((k, b) => [k, (m & (1 << b)) !== 0])) as Input;
export function encodeRun(masks: number[]) {
  const out: string[] = [];
  for (let i = 0; i < masks.length;) {
    let j = i;
    while (j < masks.length && masks[j] === masks[i]) j++;
    out.push(`${masks[i].toString(36)}.${(j - i).toString(36)}`);
    i = j;
  }
  return out.join(',');
}
export function decodeRun(s: string): number[] {
  const out: number[] = [];
  for (const part of s ? s.split(',') : []) {
    const [m, n] = part.split('.').map((x) => parseInt(x, 36));
    if (!(m >= 0 && m < 256 && n > 0)) return [];
    for (let i = 0; i < n; i++) out.push(m);
  }
  return out;
}
export function buildStage(id: StageId, part = 0): StageMap { return BUILDS[id][part](new Builder()).done(); }
/** The boss gallery's map: a step of floor, then the boss room, with the heroes already inside the door. */
function galleryMap(): StageMap {
  const b = new Builder().run(2, 3).arena();
  b.start = { x: (b.arenaCol + 2) * TILE + TILE / 2, y: (ROWS - 3) * TILE };
  return b.done();
}
/** A looping showcase for the weapon-get screen: Dora on flat ground, firing at two sturdy dummies. */
export function weaponDemo(weapon: WeaponId) {
  const from = WEAPONS[weapon].from;
  const g = new PawBusterGame('snowcap', { ...freshProgress(), cleared: from ? [from] : [] });
  for (let c = 0; c < g.map.cols; c++) for (let r = 0; r < ROWS; r++) g.tiles[c * ROWS + r] = r >= ROWS - 3 ? T.rock : T.air;
  g.tilesRev++;
  g.items = [];
  g.weapon = Math.max(0, g.weapons.indexOf(weapon));
  const y = (ROWS - 3) * TILE;
  g.enemies = [13, 19].map((c, i) => ({ id: 9000 + i, kind: 'turret', x: c * TILE, y: y - 28, w: 26, h: 28, vx: 0, vy: 0, hp: 1e9, face: -1, t: -1e9, flash: 0, slash: -1, x0: c * TILE, y0: y - 28, mode: 0, alive: true, ground: true }));
  for (let i = 0; i < 150; i++) g.step(1 / 120);
  Object.assign(g.player, { x: 4 * TILE, y: y - HERO.h, vx: 0, vy: 0, face: 1 });
  return g;
}
/** The demo's buttons `t` seconds into its 3.4-second loop: two taps, then a full charge. */
export const demoInput = (t: number): Input => { const k = t % 3.4; return { ...NO_INPUT, fire: k < 0.05 || (k > 0.4 && k < 0.45) || (k > 0.9 && k < 1 + CHARGE.full) }; };

// ---------- live state ----------
export type Player = { x: number; y: number; w: number; h: number; vx: number; vy: number; face: 1 | -1; ground: boolean; slide: 0 | 1 | -1; dashT: number; airDash: boolean; adT: number; adUsed: boolean; kickT: number; kickDir: number; hurtT: number; invT: number; charge: number; slashT: number; slashCd: number; slashId: number; combo: number; dashSlash: boolean; shotCd: number; fireBuf: number; swapCd: number; tagT: number; runT: number; ride: number; down: boolean; reviveT: number; safe: { x: number; y: number } };
export type Shot = { x: number; y: number; vx: number; vy: number; r: number; dmg: number; kind: ShotKind; hero: boolean; life: number; pierce: boolean; hits: number[]; grav: number; weapon: WeaponId | null; orbit?: number; rehit?: number; block?: boolean; owner?: HeroId };
export type Enemy = { id: number; kind: EnemyKind; x: number; y: number; w: number; h: number; vx: number; vy: number; hp: number; face: number; t: number; flash: number; slash: number; x0: number; y0: number; mode: 0 | 1 | 2; alive: boolean; ground: boolean; cycle?: number };
export type Boss = { kind: BossKind; x: number; y: number; w: number; h: number; vx: number; vy: number; hp: number; max: number; face: 1 | -1; move: string; t: number; cycle: number; inv: number; flinch: number; ground: boolean; hidden: boolean; tx: number; ty: number; fired: number; slash: number; deathT: number; phase2: boolean };
export type Item = { kind: ItemKind; x: number; y: number; vy: number; gone: boolean };
export type Effect = { x: number; y: number; t: number; kind: 'spark' | 'boom' | 'dust' | 'heal' | 'debris'; vx?: number; vy?: number; color?: string };
export type Platform = { x: number; y: number; w: number; h: number; dx: number; dy: number; spec: PlatformSpec };
export type Crusher = { x: number; w: number; bottom: number; spec: CrusherSpec };
export type State = 'ready' | 'play' | 'paused' | 'boss' | 'clearing' | 'clear' | 'lost';
/** `gallery` refights the stage's boss on its own, for a best time. */
export type GameOptions = { easy?: boolean; hard?: boolean; coop?: boolean; gallery?: boolean };
type Body = { x: number; y: number; w: number; h: number };
const overlap = (a: Body, b: Body) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const shotBox = (s: Shot): Body => ({ x: s.x - s.r, y: s.y - s.r, w: s.r * 2, h: s.r * 2 });
const ENEMY: Record<EnemyKind, { w: number; h: number; hp: number }> = {
  beetle: { w: 24, h: 20, hp: 3 }, bat: { w: 24, h: 18, hp: 2 }, turret: { w: 26, h: 28, hp: 4 }, hopper: { w: 22, h: 18, hp: 3 },
  ceiling: { w: 26, h: 24, hp: 4 }, shield: { w: 24, h: 28, hp: 4 }, bomber: { w: 28, h: 18, hp: 3 }, guardian: { w: 46, h: 44, hp: GUARDIAN_HP },
};
const SHOT_R: Partial<Record<ShotKind, number>> = { wave: 10, claw: 11, bolt: 14, rock: 11, foam: 10, crystal: 7, tongue: 8, bomb: 8 };
const fullEnergy = () => Object.fromEntries(Object.keys(WEAPONS).map((w) => [w, ENERGY])) as Record<WeaponId, number>;
const orInput = (a: Input, b: Input) => { for (const k of Object.keys(a) as (keyof Input)[]) a[k] ||= b[k]; };

export class PawBusterGame {
  readonly stage: (typeof STAGES)[number];
  readonly easy: boolean;
  readonly hard: boolean;
  readonly coop: boolean;
  readonly gallery: boolean;
  map!: StageMap;
  part = 0;
  progress: Progress;
  tiles!: Uint8Array;
  state: State = 'ready';
  readyT = 0;
  introT = 0;
  introMax = 2.2;
  endT = 0;
  time = 0;
  clock = 0;
  camX = 0;
  shake = 0;
  wind = 0;
  /** Hit-stop: the world holds still for a moment after a big hit. */
  freeze = 0;
  /** The hero in control. In co-op this is whichever hero the engine is updating, and the leader between updates. */
  hero: HeroId = 'dora';
  hp: Record<HeroId, number> = { dora: 0, enzo: 0 };
  max = HERO.hp;
  weaponOf: Record<HeroId, number> = { dora: 0, enzo: 0 };
  energy: Record<WeaponId, number> = fullEnergy();
  /** One body each in co-op; in single play both heroes share one body and tag in and out. */
  bodies!: Record<HeroId, Player>;
  player!: Player;
  enemies: Enemy[] = [];
  boss: Boss | null = null;
  shots: Shot[] = [];
  items: Item[] = [];
  effects: Effect[] = [];
  platforms: Platform[] = [];
  crushers: Crusher[] = [];
  banner = { text: '', t: 0 };
  events: string[] = [];
  checkpoint = -1;
  kills = 0;
  fight = false;
  newBest = false;
  /** Which boss of the citadel's rush is up; kept across retries. */
  rush = 0;
  retries = 0;
  /** Health lost this run, and in the current boss room: for the rank and the Untouched badge. */
  damage = 0;
  bossDamage = 0;
  usedSpecial = false;
  usedSub = false;
  /** Enemies in the whole stage, for the rank's clear-out score. */
  enemyTotal = 0;
  rank: Rank | null = null;
  medal = 0;
  /** Badges first earned by this clear. */
  earned: BadgeId[] = [];
  /** Bumped whenever the tile grid changes, so the renderer knows to redraw its cached tiles. */
  tilesRev = 0;
  private prev: Record<HeroId, Input> = { dora: { ...NO_INPUT }, enzo: { ...NO_INPUT } };
  private pending: Record<HeroId, { edge: Input; released: boolean }> = { dora: { edge: { ...NO_INPUT }, released: false }, enzo: { edge: { ...NO_INPUT }, released: false } };
  private serial = 0;
  private resume: State = 'play';

  constructor(stage: StageId, progress: Partial<Progress> = freshProgress(), options: GameOptions = {}) {
    this.stage = STAGES.find((s) => s.id === stage)!;
    this.easy = !!options.easy;
    this.hard = !!options.hard && !this.easy;
    this.coop = !!options.coop;
    this.gallery = !!options.gallery;
    this.progress = copyProgress({ ...freshProgress(), ...progress });
    const calm = changesFor(this.progress, stage).some((c) => c.effect === 'calm');
    this.enemyTotal = this.gallery ? 0 : [...Array(partsOf(stage)).keys()].reduce((n, part) => n + buildStage(stage, part).spawns.filter((s) => !(calm && s.kind === 'bat')).length, 0);
    this.load();
  }
  get weapons() { return weaponsFor(this.progress); }
  get weapon() { return this.weaponOf[this.hero]; }
  set weapon(n: number) { this.weaponOf[this.hero] = n; }
  get weaponId(): WeaponId { return this.weaponFor(this.hero); }
  weaponFor(h: HeroId): WeaponId { return this.weapons[this.weaponOf[h]] ?? 'buster'; }
  get partner(): HeroId { return this.hero === 'dora' ? 'enzo' : 'dora'; }
  get victory() { return this.state === 'clear' && this.stage.id === 'citadel' && !this.gallery; }
  get lastPart() { return this.part === partsOf(this.stage.id) - 1; }
  get rushing() { return this.stage.id === 'citadel' && this.lastPart && !this.gallery; }
  get guardianMax() { return Math.ceil(GUARDIAN_HP * (this.hard ? HARD_HP : 1)); }
  /** Dora with the Arm Cannon, holding a buster charge past the third level. */
  gigaFor(h: HeroId) { return h === 'dora' && this.weaponFor(h) === 'buster' && this.has('arm') && this.bodies[h].charge >= CHARGE.giga; }
  /** Heroes still on their feet: both in co-op until one falls, otherwise the one in control. */
  get living(): HeroId[] { return this.coop ? HEROES.filter((h) => !this.bodies[h].down) : [this.hero]; }
  levelOf(p: Player) { return p.charge >= CHARGE.full ? 2 : p.charge >= CHARGE.mid ? 1 : 0; }
  get chargeLevel() { return this.levelOf(this.player); }
  has(part: PartId) { return this.progress.parts.includes(part); }
  private use(h: HeroId) { this.hero = h; this.player = this.bodies[h]; }
  private leader(): HeroId {
    if (!this.coop) return this.hero;
    const l = this.living;
    if (l.length < 2) return l[0] ?? 'dora';
    return this.bodies.dora.x >= this.bodies.enzo.x ? 'dora' : 'enzo';
  }

  private body(x: number, y: number): Player {
    const at = { x: x - HERO.w / 2, y: y - HERO.h };
    return { ...at, w: HERO.w, h: HERO.h, vx: 0, vy: 0, face: 1, ground: true, slide: 0, dashT: 0, airDash: false, adT: 0, adUsed: false, kickT: 0, kickDir: 0, hurtT: 0, invT: 0, charge: 0, slashT: 0, slashCd: 0, slashId: 0, combo: 0, dashSlash: false, shotCd: 0, fireBuf: 0, swapCd: 0, tagT: 0, runT: 0, ride: -1, down: false, reviveT: 0, safe: { ...at } };
  }
  private collected(kind: ItemKind) {
    const id = this.stage.id, p = this.progress;
    return (kind === 'tank' && p.tanks.includes(id)) || (kind === 'sub' && p.subs.includes(id)) || (isPartItem(kind) && p.parts.includes(kind));
  }
  /**
   * (Re)build the current sector and put the heroes at the last checkpoint reached. A fresh load
   * (a new run or a retry) restores full health and energy; moving on to the next sector keeps them.
   */
  private load(fresh = true) {
    const id = this.stage.id;
    this.map = this.gallery ? galleryMap() : buildStage(id, this.part);
    this.tiles = this.map.tiles.slice();
    this.tilesRev++;
    const changes = this.gallery ? [] : changesFor(this.progress, id).map((c) => c.effect);
    if (changes.includes('freeze')) this.freezePits();
    if (changes.includes('cool')) this.tiles.forEach((t, i) => { if (t === 2) this.tiles[i] = 1; });
    if (fresh) {
      this.max = maxHp(this.progress);
      this.hp = { dora: this.max, enzo: this.max };
      this.energy = fullEnergy();
      this.hero = 'dora';
    } else if (this.coop) {
      for (const h of HEROES) if (this.hp[h] <= 0) this.hp[h] = Math.ceil(this.max / 2);
    } else if (this.hp[this.hero] <= 0) this.hero = this.partner;
    this.enemies = this.map.spawns.filter((s) => !(changes.includes('calm') && s.kind === 'bat')).map((s) => this.spawnEnemy(s.kind, s.x, s.y));
    this.items = this.map.items.filter((i) => !this.collected(i.kind)).map((i) => ({ ...i, y: i.y - 14, vy: 0, gone: false }));
    const at = this.checkpoint >= 0 ? this.map.checkpoints[this.checkpoint] : this.map.start;
    if (this.coop) { this.bodies = { dora: this.body(at.x - 14, at.y), enzo: this.body(at.x + 14, at.y) }; this.hero = 'dora'; }
    else { const b = this.body(at.x, at.y); this.bodies = { dora: b, enzo: b }; }
    this.use(this.hero);
    this.platforms = this.map.platforms.map((s) => ({ x: s.x, y: s.y, w: s.w, h: 12, dx: 0, dy: 0, spec: s }));
    this.crushers = this.map.crushers.map((s) => ({ x: s.x, w: s.w, bottom: s.bottom - CRUSH_LIFT, spec: s }));
    this.boss = null;
    this.fight = false;
    this.shots = [];
    this.effects = [];
    this.wind = 0;
    this.freeze = 0;
    this.state = 'ready';
    this.readyT = 1.2;
    this.camX = this.cameraTarget();
    this.say(!fresh ? `SECTOR ${this.part + 1}` : 'READY');
  }
  /** Fill every pit with ice up to the lower of the ground on either side. */
  private freezePits() {
    const end = this.map.arena > 0 ? this.map.arena : this.map.cols;
    const ground = (c: number) => { let h = 0; while (h < ROWS && this.tiles[c * ROWS + ROWS - 1 - h]) h++; return h; };
    for (let c = 0; c < end; c++) {
      if (ground(c)) continue;
      let e = c;
      while (e < end && !ground(e)) e++;
      const h = Math.max(1, Math.min(c > 0 ? ground(c - 1) : 3, e < end ? ground(e) : 3));
      for (let k = c; k < e; k++) for (let r = ROWS - h; r < ROWS; r++) if (!this.tiles[k * ROWS + r]) this.tiles[k * ROWS + r] = 5;
      c = e;
    }
  }
  retry() { if (this.state === 'lost') { this.retries++; this.load(); } }
  /** Move on to another sector of a multi-sector stage, keeping health and weapon energy. */
  enterPart(n: number) {
    this.part = n;
    this.checkpoint = -1;
    this.load(false);
    this.events.push('checkpoint');
  }
  pause() { if (this.state === 'play' || this.state === 'boss') { this.resume = this.state; this.state = 'paused'; } else if (this.state === 'paused') this.state = this.resume; }
  /** Drink from a sub-tank: heals the hero in control (in co-op, whichever living hero is lower). */
  useSub(i: number) {
    if (!['play', 'boss', 'paused'].includes(this.state)) return false;
    const fill = this.progress.subFill[i] ?? 0;
    const alive = this.coop ? this.living : [this.hero];
    const h = alive.reduce<HeroId | null>((low, x) => (low === null || this.hp[x] < this.hp[low] ? x : low), null);
    if (fill <= 0 || h === null || this.hp[h] >= this.max) return false;
    const used = Math.min(fill, this.max - this.hp[h]);
    this.hp[h] += used;
    this.progress.subFill[i] -= used;
    this.usedSub = true;
    this.fx(this.bodies[h].x + HERO.w / 2, this.bodies[h].y + HERO.h / 2, 'heal');
    this.events.push('subuse');
    return true;
  }
  private say(text: string) { this.banner = { text, t: 1.6 }; }
  private spawnEnemy(kind: EnemyKind, x: number, y: number): Enemy {
    const d = ENEMY[kind];
    return { id: this.serial++, kind, x: x - d.w / 2, y: y - d.h, w: d.w, h: d.h, vx: 0, vy: 0, hp: Math.ceil(d.hp * (this.hard ? HARD_HP : 1)), face: -1, t: 0, flash: 0, slash: -1, x0: x - d.w / 2, y0: y - d.h, mode: 0, alive: true, ground: false };
  }

  // ----- world -----
  tile(c: number, r: number) {
    if (c < 0 || c >= this.map.cols) return 1;
    if (r >= ROWS) return 0;
    return this.tiles[c * ROWS + Math.max(0, r)];
  }
  solid(x: number, y: number) { return isSolid(this.tile(Math.floor(x / TILE), Math.floor(y / TILE))); }
  /** Move a box through the tile grid one axis at a time; reports what it ran into. */
  private move(b: Body, dx: number, dy: number) {
    let hitX = 0, hitY = 0, spike = false;
    if (dx) {
      b.x += dx;
      const c = Math.floor((dx > 0 ? b.x + b.w - 0.001 : b.x) / TILE);
      for (let r = Math.floor(b.y / TILE); r <= Math.floor((b.y + b.h - 0.001) / TILE); r++) {
        const t = this.tile(c, r);
        if (!isSolid(t)) continue;
        spike ||= t === 2;
        b.x = dx > 0 ? c * TILE - b.w : (c + 1) * TILE;
        hitX = Math.sign(dx);
        break;
      }
    }
    if (dy) {
      b.y += dy;
      const r = Math.floor((dy > 0 ? b.y + b.h - 0.001 : b.y) / TILE);
      for (let c = Math.floor(b.x / TILE); c <= Math.floor((b.x + b.w - 0.001) / TILE); c++) {
        const t = this.tile(c, r);
        if (!isSolid(t)) continue;
        spike ||= t === 2;
        b.y = dy > 0 ? r * TILE - b.h : (r + 1) * TILE;
        hitY = Math.sign(dy);
        break;
      }
    }
    return { hitX, hitY, spike };
  }
  private touchingWall(b: Body, side: number) {
    const c = Math.floor((side > 0 ? b.x + b.w + 1 : b.x - 1) / TILE);
    for (let r = Math.floor((b.y + 4) / TILE); r <= Math.floor((b.y + b.h - 4) / TILE); r++) { const t = this.tile(c, r); if (t === T.rock || t === T.crystal || t === T.door) return true; }
    return false;
  }
  private cameraTarget() {
    if (this.fight) return this.map.arena * TILE;
    const alive = (this.coop ? this.living : [this.hero]).map((h) => this.bodies[h]);
    const cx = alive.length ? alive.reduce((s, b) => s + b.x + b.w / 2, 0) / alive.length : this.player.x;
    return Math.max(0, Math.min(this.map.cols * TILE - VIEW_W, cx - VIEW_W * (this.coop ? 0.5 : 0.42)));
  }
  private fx(x: number, y: number, kind: Effect['kind']) { this.effects.push({ x, y, t: 0, kind }); }

  // ----- the frame -----
  /** Advance the game. `input2` drives Enzo in co-op and is ignored otherwise. */
  step(dt: number, input: Input = NO_INPUT, input2: Input = NO_INPUT) {
    // Nothing moves, and no presses are consumed, while paused.
    if (this.state === 'paused') return;
    dt = Math.min(dt, 1 / 60);
    const slots: HeroId[] = this.coop ? HEROES : ['dora'];
    const given: Record<HeroId, Input> = { dora: input, enzo: input2 };
    const edge = { dora: { ...NO_INPUT }, enzo: { ...NO_INPUT } }, released = { dora: false, enzo: false };
    for (const h of slots) {
      for (const k of Object.keys(NO_INPUT) as (keyof Input)[]) edge[h][k] = given[h][k] && !this.prev[h][k];
      released[h] = this.prev[h].fire && !given[h].fire;
      this.prev[h] = { ...given[h] };
      // Presses and releases during a hit-stop are kept for the first frame after it.
      const pend = this.pending[h];
      if (this.freeze > 0) { orInput(pend.edge, edge[h]); pend.released ||= released[h]; }
      else { orInput(edge[h], pend.edge); released[h] ||= pend.released; this.pending[h] = { edge: { ...NO_INPUT }, released: false }; }
    }
    this.clock += dt;
    this.banner.t = Math.max(0, this.banner.t - dt);
    this.shake = Math.max(0, this.shake - dt);
    for (const e of this.effects) {
      e.t += dt;
      if (e.vx !== undefined && e.vy !== undefined) { e.x += e.vx * dt; e.vy += 900 * dt; e.y += e.vy * dt; }
    }
    this.effects = this.effects.filter((e) => e.t < (e.kind === 'debris' ? 1.2 : 0.5));
    if (this.state === 'lost' || this.state === 'clear') { this.endT += dt; return; }
    if (this.freeze > 0) { this.freeze -= dt; return; }
    if (this.state === 'ready') { this.readyT -= dt; if (this.readyT <= 0) this.state = 'play'; }
    if (this.state === 'boss') { this.introT -= dt; if (this.introT <= 0) { this.state = 'play'; this.say('GO!'); } }
    const control = this.state === 'play';
    if (control) { this.time += dt; this.progress.playTime += dt; }
    this.moveHazards();
    const part = this.part;
    for (const h of this.living) {
      this.use(h);
      const slot = this.coop ? h : 'dora';
      this.updatePlayer(dt, control ? given[slot] : NO_INPUT, control ? edge[slot] : NO_INPUT, control && released[slot]);
      // updatePlayer can end the run or carry the heroes to the next sector.
      if ((this.state as State) === 'lost' || this.part !== part) return;
    }
    if (this.coop) { this.revive(dt); this.tether(); }
    this.use(this.leader());
    this.updateEnemies(dt);
    this.updateBoss(dt);
    this.updateShots(dt);
    this.updateItems(dt);
    this.hits();
    this.use(this.leader());
    const target = this.cameraTarget();
    this.camX += (target - this.camX) * Math.min(1, dt * 9);
    if (Math.abs(target - this.camX) < 0.5) this.camX = target;
  }
  /** Co-op heroes can't drift further apart than one screen: the one out in front is held back. */
  private tether() {
    const [a, b] = this.living.map((h) => this.bodies[h]);
    if (!a || !b) return;
    const gap = VIEW_W - 120;
    if (b.x - a.x > gap) b.x = a.x + gap;
    else if (a.x - b.x > gap) a.x = b.x + gap;
  }
  /** A co-op hero who stands by a fallen partner for REVIVE seconds brings them back with half health. */
  private revive(dt: number) {
    for (const h of HEROES) {
      const d = this.bodies[h], helper = this.bodies[h === 'dora' ? 'enzo' : 'dora'];
      if (!d.down) continue;
      const near = !helper.down && Math.abs(helper.x - d.x) < 44 && Math.abs(helper.y - d.y) < 44;
      d.reviveT = near ? d.reviveT + dt : Math.max(0, d.reviveT - dt);
      if (d.reviveT < REVIVE) continue;
      Object.assign(d, { down: false, reviveT: 0, invT: 1.5, hurtT: 0, vx: 0, vy: 0 });
      this.hp[h] = Math.ceil(this.max / 2);
      this.fx(d.x + d.w / 2, d.y + d.h / 2, 'heal');
      this.say(`${h.toUpperCase()} IS BACK`);
      this.events.push('revive');
    }
  }
  private moveHazards() {
    for (const pl of this.platforms) {
      const s = Math.sin((this.clock / pl.spec.period) * Math.PI * 2), nx = pl.spec.x + s * pl.spec.ax, ny = pl.spec.y + s * pl.spec.ay;
      pl.dx = nx - pl.x; pl.dy = ny - pl.y; pl.x = nx; pl.y = ny;
    }
    for (const c of this.crushers) {
      // Up, a sudden slam, a pause on the floor, then a slow rise.
      const k = ((this.clock + c.spec.phase) % CRUSH_PERIOD) / CRUSH_PERIOD;
      const off = k < 0.45 ? CRUSH_LIFT : k < 0.52 ? CRUSH_LIFT * (1 - (k - 0.45) / 0.07) : k < 0.7 ? 0 : CRUSH_LIFT * ((k - 0.7) / 0.3);
      const was = c.bottom;
      c.bottom = c.spec.bottom - off;
      if (was < c.spec.bottom - 1 && c.bottom >= c.spec.bottom - 1 && c.x + c.w > this.camX && c.x < this.camX + VIEW_W) { this.shake = Math.max(this.shake, 0.12); this.events.push('stomp'); }
    }
  }

  private updatePlayer(dt: number, input: Input, edge: Input, released: boolean) {
    const p = this.player, dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    p.invT = Math.max(0, p.invT - dt);
    p.shotCd = Math.max(0, p.shotCd - dt);
    p.fireBuf = Math.max(0, p.fireBuf - dt);
    p.slashCd = Math.max(0, p.slashCd - dt);
    p.slashT = Math.max(0, p.slashT - dt);
    p.swapCd = Math.max(0, p.swapCd - dt);
    p.tagT = Math.max(0, p.tagT - dt);
    if (!this.coop && edge.swap && p.swapCd <= 0 && this.hp[this.partner] > 0) this.swap(false);
    if (edge.next || edge.prev) {
      const n = this.weapons.length;
      if (n > 1) { this.weapon = (this.weapon + (edge.next ? 1 : n - 1)) % n; p.charge = 0; this.events.push('weapon'); this.say(WEAPONS[this.weaponId].name.toUpperCase()); }
    }
    // Ride along with the platform underfoot.
    if (p.ride >= 0) { const pl = this.platforms[p.ride]; if (pl) this.move(p, pl.dx, pl.dy); }
    if (p.hurtT > 0) {
      p.hurtT -= dt;
      p.vx = -p.face * 90;
      p.adT = 0;
    } else {
      if (edge.dash && p.ground && p.dashT <= 0) { p.dashT = PHYS.dashTime; this.events.push('dash'); this.fx(p.x + p.w / 2 - p.face * 10, p.y + p.h, 'dust'); }
      else if (edge.dash && !p.ground && !p.adUsed && p.kickT <= 0 && this.has('boots')) {
        p.adT = PHYS.airDash; p.adUsed = true; p.airDash = true; p.vy = 0;
        if (dir) p.face = dir as 1 | -1;
        this.events.push('dash'); this.fx(p.x + p.w / 2 - p.face * 10, p.y + p.h / 2, 'dust');
      }
      if (p.dashT > 0) { p.dashT -= dt; if (!input.dash || (dir && dir !== p.face) || !p.ground) p.dashT = 0; }
      if (p.adT > 0) { p.adT -= dt; if (!input.dash) p.adT = 0; }
      if (p.ground) { p.airDash = false; p.adUsed = false; p.adT = 0; }
      const speed = p.dashT > 0 || p.airDash ? PHYS.dash : PHYS.run;
      if (p.kickT > 0) { p.kickT -= dt; p.vx = p.kickDir * speed; }
      else if (p.dashT > 0 || p.adT > 0) p.vx = p.face * PHYS.dash;
      else { p.vx = dir * speed; if (dir) p.face = dir as 1 | -1; }
      if (edge.jump) {
        const wall = this.touchingWall(p, 1) ? 1 : this.touchingWall(p, -1) ? -1 : 0;
        if (p.ground) { p.vy = -PHYS.jump; p.airDash = p.dashT > 0 || input.dash; p.dashT = 0; p.ground = false; p.ride = -1; this.events.push('jump'); }
        else if (wall) { p.vy = -PHYS.wallJump; p.kickT = PHYS.kick; p.kickDir = -wall; p.face = -wall as 1 | -1; p.airDash = input.dash; p.adT = 0; p.adUsed = false; p.vx = p.kickDir * (p.airDash ? PHYS.dash : PHYS.run); this.events.push('jump'); this.fx(p.x + (wall > 0 ? p.w : 0), p.y + p.h / 2, 'spark'); }
      }
      if (!input.jump && p.vy < PHYS.cut && p.kickT <= 0) p.vy = PHYS.cut;
      this.attack(dt, input, edge, released);
    }
    if (p.adT > 0) p.vy = 0;
    else p.vy = Math.min(PHYS.maxFall, p.vy + PHYS.gravity * dt);
    // In a waterfall, Bubble Burst carries the hero upward while jump is held.
    if (input.jump && this.weaponId === 'bubble' && this.map.falls.some((f) => p.x + p.w > f.x && p.x < f.x + f.w)) { p.vy = p.y > 16 ? -FLOAT : 0; p.ground = false; p.ride = -1; }
    p.slide = 0;
    if (!p.ground && dir && p.vy > 0 && p.kickT <= 0 && this.touchingWall(p, dir)) { p.vy = Math.min(p.vy, PHYS.slide); p.slide = dir as 1 | -1; p.face = -dir as 1 | -1; }
    const wind = this.wind && this.state === 'play' ? this.wind : 0;
    const under = this.tile(Math.floor((p.x + p.w / 2) / TILE), Math.floor((p.y + p.h + 1) / TILE));
    const belt = p.ground && p.ride < 0 ? (under === 3 ? BELT : under === 4 ? -BELT : 0) : 0;
    const fall = p.vy, bottom = p.y + p.h;
    const hit = this.move(p, (p.vx + wind + belt) * dt, p.vy * dt);
    // Moving platforms are one-way: land on them from above, jump up through them.
    p.ride = -1;
    if (p.vy >= 0) this.platforms.forEach((pl, i) => { if (p.x + p.w > pl.x && p.x < pl.x + pl.w && bottom <= pl.y + 4 && p.y + p.h >= pl.y) { p.y = pl.y - p.h; p.ride = i; } });
    if (hit.hitY > 0 || p.ride >= 0) { if (!p.ground && fall > 300) this.fx(p.x + p.w / 2, p.y + p.h, 'dust'); p.ground = true; p.vy = 0; }
    else { if (hit.hitY < 0) p.vy = 0; p.ground = false; }
    if (p.ground && p.ride < 0 && !this.move({ ...p }, 0, 1).hitY) p.ground = false;
    // A guardian blocks the way until it falls.
    for (const e of this.enemies) if (e.kind === 'guardian' && e.alive && this.awake(e) && p.x + p.w > e.x && p.x < e.x + e.w) p.x = p.x + p.w / 2 < e.x + e.w / 2 ? e.x - p.w : e.x + e.w;
    p.runT = p.ground && p.vx ? p.runT + dt : 0;
    if (hit.spike) { this.hurt(SPIKE_DAMAGE, p.x + p.w / 2 - p.face, true); p.vy = -380; p.ground = false; }
    else if (p.ground && p.ride < 0 && !this.fight) p.safe = { x: p.x, y: p.y };
    if (p.y > ROWS * TILE + 40) {
      this.hurt(this.easy ? 0 : PIT_DAMAGE, p.x, true, true);
      if (this.state !== 'lost') { Object.assign(p, { x: p.safe.x, y: p.safe.y, vx: 0, vy: 0, dashT: 0, adT: 0, kickT: 0, hurtT: 0, invT: 1.2, ride: -1 }); this.events.push('fall'); }
    }
    // Checkpoints (which also bring a fallen co-op partner back), sector exits and the boss door.
    const next = this.map.checkpoints[this.checkpoint + 1];
    if (next && p.x + p.w / 2 >= next.x) {
      this.checkpoint++; this.say('CHECKPOINT'); this.events.push('checkpoint');
      if (this.coop) for (const h of HEROES) {
        const b = this.bodies[h];
        if (!b.down) continue;
        Object.assign(b, { down: false, x: p.x, y: p.y, vx: 0, vy: 0, invT: 1.5, hurtT: 0, ride: -1, safe: { x: p.x, y: p.y } });
        this.hp[h] = Math.ceil(this.max / 2);
        this.fx(p.x + p.w / 2, p.y + p.h / 2, 'heal');
      }
    }
    if (this.map.exit > 0 && p.x > (this.map.exit + 2) * TILE) { this.enterPart(this.part + 1); return; }
    if (!this.fight && this.map.arena > 0 && p.x > (this.map.arena + 1.5) * TILE) this.startFight();
  }

  private attack(dt: number, input: Input, edge: Input, released: boolean) {
    const p = this.player, w = this.weaponId, mx = p.x + p.w / 2 + p.face * 16, my = p.y + 12;
    const shot = (vx: number, vy: number, kind: ShotKind, dmg: number, extra: Partial<Shot> = {}) => this.shots.push({ x: mx, y: my, vx, vy, r: 8, dmg, kind, hero: true, life: 2.5, pierce: false, hits: [], grav: 0, weapon: w, owner: this.hero, ...extra });
    // A press during a cooldown is buffered briefly and fires as soon as it can, so mashing never drops a shot.
    if (edge.fire) p.fireBuf = 0.2;
    if (w !== 'buster') {
      // Only one ring of orbiting crystals at a time.
      const busy = w === 'quartz' && this.shots.some((s) => s.orbit !== undefined && s.owner === this.hero);
      if (p.fireBuf > 0 && p.shotCd <= 0 && !busy && this.energy[w] >= WEAPON_COST) {
        p.fireBuf = 0;
        this.energy[w] -= WEAPON_COST;
        p.shotCd = 0.3;
        if (w === 'frost') shot(p.face * 480, 0, 'frost', 2, { pierce: true });
        if (w === 'gale') for (const a of [-0.35, 0, 0.35]) shot(Math.cos(a) * p.face * 360, Math.sin(a) * 360, 'gale', 1.5);
        if (w === 'ember') shot(p.face * 230, -160, 'ember', 2, { grav: 900, life: 3 });
        if (w === 'quartz') for (let i = 0; i < 3; i++) shot(0, 0, 'quartz', 1, { pierce: true, r: 9, life: 3, orbit: (i * Math.PI * 2) / 3, rehit: 0.5 });
        if (w === 'volt') shot(p.face * VOLT_SPEED, 0, 'volt', 2, { life: 2 });
        if (w === 'bubble') for (const vy of [-40, -140]) shot(p.face * 220, vy, 'bubble', 2, { pierce: true, r: 11, grav: -60, life: 2.2 });
        this.usedSpecial = true;
        this.events.push(`special-${w}`);
      }
    } else if (this.hero === 'enzo') {
      if (p.fireBuf > 0 && p.slashCd <= 0) {
        p.fireBuf = 0; p.slashT = 0.16; p.slashCd = 0.3; p.slashId++; p.combo = (p.combo + 1) % 3;
        p.dashSlash = this.has('saber') && (p.dashT > 0 || p.adT > 0 || (p.airDash && !p.ground));
        this.events.push(p.dashSlash ? 'blast' : 'slash');
      }
      return;
    } else {
      const lemons = this.shots.filter((s) => s.kind === 'lemon').length;
      // Fast, short-lived shots and a generous cap, so tapping as fast as you can always fires.
      if (p.fireBuf > 0 && p.shotCd <= 0 && lemons < 8) { p.fireBuf = 0; shot(p.face * 640, 0, 'lemon', 1, { r: 5, life: 0.9 }); p.shotCd = 0.1; this.events.push('shot'); }
    }
    // Hold fire to charge: Dora's buster, or either hero's special weapon.
    if (input.fire) {
      const before = this.levelOf(p), giga = this.gigaFor(this.hero);
      p.charge += dt;
      const now = this.levelOf(p);
      if (now > before) this.events.push(now === 2 ? 'charge2' : 'charge1');
      if (!giga && this.gigaFor(this.hero)) this.events.push('charge3');
    } else if (released) {
      const lvl = this.levelOf(p);
      if (this.gigaFor(this.hero)) { shot(p.face * 420, 0, 'giga', 6, { r: 18, life: 1.8, pierce: true }); this.events.push('giga'); }
      else if (w === 'buster' && lvl) { shot(p.face * 460, 0, lvl === 2 ? 'full' : 'mid', lvl === 2 ? 4 : 2, { r: lvl === 2 ? 14 : 9, life: 1.6, pierce: lvl === 2 }); this.events.push(lvl === 2 ? 'blast' : 'shot'); }
      else if (w !== 'buster' && lvl === 2 && this.energy[w] >= WEAPON_COST * 2) { this.energy[w] -= WEAPON_COST * 2; this.chargedSpecial(w, mx, shot); this.usedSpecial = true; this.events.push(`charged-${w}`); }
      p.charge = 0;
    }
  }
  private chargedSpecial(w: WeaponId, mx: number, shot: (vx: number, vy: number, kind: ShotKind, dmg: number, extra?: Partial<Shot>) => void) {
    const p = this.player, f = p.face, feet = p.y + p.h, cx = p.x + p.w / 2, cy = p.y + p.h / 2;
    if (w === 'frost') shot(0, 0, 'icewall', 2, { x: mx + f * 26, y: feet - 22, r: 20, life: 3, pierce: true, block: true, rehit: 0.5 });
    if (w === 'gale') shot(f * 150, 0, 'tornado', 2, { y: feet - 22, r: 20, life: 2.5, pierce: true, rehit: 0.3 });
    if (w === 'ember') for (let i = 0; i < 4; i++) shot(0, 0, 'pillar', 3, { x: mx + f * 40, y: feet - 12 - i * 24, r: 12, life: 0.8, pierce: true });
    if (w === 'quartz') for (let i = 0; i < 6; i++) { const a = (i * Math.PI) / 3; shot(Math.cos(a) * 320, Math.sin(a) * 320, 'quartz', 2, { x: cx, y: cy, pierce: true, life: 1.2 }); }
    if (w === 'volt') for (const vy of [-160, 0, 160]) shot(f * VOLT_SPEED, vy, 'volt', 2, { life: 2 });
    if (w === 'bubble') shot(f * 140, -20, 'bubble', 4, { r: 22, grav: -30, life: 3, pierce: true, rehit: 0.4 });
  }

  /** Tag the partner in. A forced swap happens when the active hero is knocked out. */
  private swap(forced: boolean) {
    const p = this.player, next = this.partner;
    this.weaponOf[next] = this.weaponOf[this.hero];
    this.use(next);
    p.swapCd = 0.8;
    p.tagT = forced ? 0 : TAG_TIME;
    p.charge = 0;
    p.slashT = 0;
    if (forced) { p.invT = 1.5; this.say(`${this.hero.toUpperCase()} TAGS IN`); }
    this.events.push('swap');
    this.fx(p.x + p.w / 2, p.y + p.h / 2, 'heal');
  }
  hurt(dmg: number, fromX: number, hazard = false, force = false) {
    const p = this.player;
    if (this.state === 'clearing' || this.state === 'clear' || this.state === 'lost' || p.down) return;
    if (p.invT > 0 && !force) return;
    const armor = this.has('armor');
    if (this.easy) dmg = Math.ceil(dmg / 2);
    if (armor) dmg = Math.ceil(dmg * 0.75);
    const lost = Math.min(this.hp[this.hero], dmg);
    this.hp[this.hero] -= lost;
    this.damage += lost;
    if (this.fight) this.bossDamage += lost;
    p.invT = 1;
    // Body Armour takes the knockback out of a hit.
    p.hurtT = hazard || armor ? 0 : 0.3;
    p.face = fromX > p.x + p.w / 2 ? 1 : -1;
    if (!hazard && !armor) p.vy = -220;
    p.charge = 0;
    p.dashT = 0;
    p.adT = 0;
    this.shake = 0.2;
    this.events.push('hurt');
    if (this.hp[this.hero] > 0) return;
    this.events.push('down');
    if (this.coop) {
      // A fallen co-op hero waits on the last safe ground: the partner can stand by them to revive them, or reach a checkpoint.
      this.fx(p.x + p.w / 2, p.y + p.h / 2, 'boom');
      Object.assign(p, { down: true, reviveT: 0, x: p.safe.x, y: p.safe.y, vx: 0, vy: 0, ride: -1 });
      if (HEROES.every((h) => this.bodies[h].down)) this.lose();
      else this.say(`${this.hero.toUpperCase()} IS DOWN`);
      return;
    }
    if (this.hp[this.partner] > 0) this.swap(true);
    else this.lose();
  }
  private lose() { this.state = 'lost'; this.endT = 0; this.progress.deaths++; this.events.push('lost'); }

  // ----- enemies -----
  private awake(b: Body) { return b.x + b.w > this.camX - 60 && b.x < this.camX + VIEW_W + 60; }
  private updateEnemies(dt: number) {
    const p = this.player, px = p.x + p.w / 2, py = p.y + p.h / 2;
    for (const e of this.enemies) {
      if (!e.alive || !this.awake(e)) continue;
      e.t += dt;
      e.flash = Math.max(0, e.flash - dt);
      const ex = e.x + e.w / 2, ey = e.y + e.h / 2;
      if (e.kind === 'beetle') {
        e.vy = Math.min(PHYS.maxFall, e.vy + PHYS.gravity * dt);
        const hit = this.move(e, e.face * 50 * dt, e.vy * dt);
        e.ground = hit.hitY > 0;
        if (e.ground) e.vy = 0;
        const ahead = e.face > 0 ? e.x + e.w + 2 : e.x - 2;
        if (hit.hitX || (e.ground && !this.solid(ahead, e.y + e.h + 4))) e.face = -e.face;
        if (e.y > ROWS * TILE) e.alive = false;
      } else if (e.kind === 'hopper') {
        // Sits, then hops toward the heroes, but never off a ledge it can see.
        e.vy = Math.min(PHYS.maxFall, e.vy + PHYS.gravity * dt);
        const hit = this.move(e, e.vx * dt, e.vy * dt);
        e.ground = hit.hitY > 0;
        if (hit.hitX) e.vx = -e.vx;
        if (e.ground) {
          e.vy = 0; e.vx = 0; e.face = px > ex ? 1 : -1;
          if (e.t > 1.3 && Math.abs(px - ex) < 360 && this.solid(ex + e.face * 60, e.y + e.h + 4)) { e.t = 0; e.vy = -430; e.vx = e.face * 110; }
        }
        if (e.y > ROWS * TILE) e.alive = false;
      } else if (e.kind === 'bat') {
        if (e.mode === 0) {
          e.x = e.x0 + Math.sin(e.t * 1.3) * 26;
          e.y = e.y0 + Math.sin(e.t * 3) * 10;
          if (Math.abs(px - ex) < 190 && e.t > 1) { e.mode = 1; e.t = 0; const d = Math.hypot(px - ex, py - ey) || 1; e.vx = ((px - ex) / d) * 130; e.vy = ((py - ey) / d) * 130; }
        } else if (e.mode === 1) {
          e.x += e.vx * dt; e.y += e.vy * dt;
          if (e.t > 1.3) { e.mode = 2; e.t = 0; }
        } else {
          const dx = e.x0 - e.x, dy = e.y0 - e.y, d = Math.hypot(dx, dy);
          if (d < 4) { e.mode = 0; e.t = 0; }
          else { e.x += (dx / d) * 90 * dt; e.y += (dy / d) * 90 * dt; }
        }
        e.face = px > ex ? 1 : -1;
      } else if (e.kind === 'ceiling') {
        // Hangs on a chain and drops a shot on anyone passing underneath.
        e.face = px > ex ? 1 : -1;
        if (e.t > 1.6 && Math.abs(px - ex) < 150 && py > ey) { e.t = 0; this.enemyShot(ex, e.y + e.h, (px - ex) * 0.6, 240, 'pellet', 2); this.events.push('enemy-shot'); }
      } else if (e.kind === 'shield') {
        // Walks at the heroes behind a shield, turning to face them only now and then.
        e.vy = Math.min(PHYS.maxFall, e.vy + PHYS.gravity * dt);
        if (e.t > 1.2) { e.t = 0; e.face = px > ex ? 1 : -1; }
        const ahead = e.face > 0 ? e.x + e.w + 2 : e.x - 2;
        const hit = this.move(e, (e.ground && this.solid(ahead, e.y + e.h + 4) && Math.abs(px - ex) > 20 ? e.face * 45 : 0) * dt, e.vy * dt);
        e.ground = hit.hitY > 0;
        if (e.ground) e.vy = 0;
        if (e.y > ROWS * TILE) e.alive = false;
      } else if (e.kind === 'bomber') {
        // Patrols high up and drops a bomb when it passes over a hero.
        e.x += e.face * 110 * dt;
        if (Math.abs(e.x - e.x0) > 200) { e.x = e.x0 + Math.sign(e.x - e.x0) * 200; e.face = -e.face; }
        e.y = e.y0 + Math.sin(this.clock * 2 + e.id) * 6;
        if (e.mode === 0 && Math.abs(px - ex) < 24 && py > ey) { e.mode = 1; e.t = 0; this.enemyShot(ex, e.y + e.h, e.face * 40, 0, 'bomb', 3, { grav: 900 }); this.events.push('enemy-shot'); }
        if (e.mode === 1 && e.t > 1.4) e.mode = 0;
      } else if (e.kind === 'guardian') {
        this.updateGuardian(e, dt, px, py);
      } else {
        e.face = px > ex ? 1 : -1;
        if (e.t > 2.2) {
          e.t = 0;
          if (Math.abs(px - ex) < 460) { const d = Math.hypot(px - ex, py - ey) || 1; this.enemyShot(ex, e.y + 8, ((px - ex) / d) * 210, ((py - e.y - 8) / d) * 210, 'pellet', 2); this.events.push('enemy-shot'); }
        }
      }
    }
    this.enemies = this.enemies.filter((e) => e.alive);
  }
  /** A mid-boss: paces its ground, then alternates a spread of shots with a leap that sends out shock waves. */
  private updateGuardian(e: Enemy, dt: number, px: number, py: number) {
    const ex = e.x + e.w / 2, ey = e.y + e.h / 2, floor = e.y + e.h;
    e.vy = Math.min(PHYS.maxFall, e.vy + PHYS.gravity * dt);
    if (e.mode === 0) {
      e.face = px > ex ? 1 : -1;
      e.vx = Math.sign(e.x0 + Math.sin(this.clock * 1.5) * 50 - e.x) * 40;
      if (e.t > (this.hard ? 1.5 : 2.1) && e.ground) {
        e.t = 0; e.cycle = (e.cycle ?? 0) + 1; e.mode = e.cycle % 2 ? 1 : 2;
        if (e.mode === 2) { e.vy = -520; e.vx = Math.max(-150, Math.min(150, (px - ex) * 0.8)); e.ground = false; this.events.push('jump'); }
      }
    } else if (e.mode === 1) {
      e.vx = 0;
      if (e.t >= 0.35 && e.t - dt < 0.35) {
        const a = Math.atan2(py - ey, px - ex);
        for (const d of [-0.3, 0, 0.3]) this.enemyShot(ex, ey - 6, Math.cos(a + d) * 240, Math.sin(a + d) * 240, 'pellet', 3);
        this.events.push('enemy-shot');
      }
      if (e.t > 0.9) { e.mode = 0; e.t = 0; }
    } else if (e.ground && e.t > 0.2) {
      e.vx = 0; e.mode = 0; e.t = 0; this.shake = Math.max(this.shake, 0.25); this.events.push('stomp');
      for (const s of [-1, 1]) this.enemyShot(ex, floor - 10, s * 230, 0, 'wave', 3);
    }
    const hit = this.move(e, e.vx * dt, e.vy * dt);
    e.x = Math.max(e.x0 - 90, Math.min(e.x0 + 90, e.x));
    e.ground = hit.hitY > 0;
    if (e.ground || hit.hitY < 0) e.vy = 0;
  }
  private enemyShot(x: number, y: number, vx: number, vy: number, kind: ShotKind, dmg: number, extra: Partial<Shot> = {}) {
    this.shots.push({ x, y, vx, vy, r: SHOT_R[kind] ?? 6, dmg, kind, hero: false, life: 4, pierce: false, hits: [], grav: 0, weapon: null, ...extra });
  }
  private damageEnemy(e: Enemy, dmg: number) {
    e.hp -= dmg * (this.player.tagT > 0 ? TAG_BONUS : 1);
    e.flash = 0.12;
    this.fx(e.x + e.w / 2, e.y + e.h / 2, 'spark');
    if (e.hp > 0) { this.events.push('hit'); return; }
    e.alive = false;
    this.kills++;
    this.freeze = HITSTOP;
    this.fx(e.x + e.w / 2, e.y + e.h / 2, 'boom');
    this.debris(e.x + e.w / 2, e.y + e.h / 2, e.kind === 'guardian' ? 18 : 6, e.kind === 'guardian' ? '#ffd46a' : '#c9ced9');
    this.events.push('kill');
    if (e.kind === 'guardian') {
      this.shake = 0.45;
      this.say(`${GUARDIANS[this.stage.id].toUpperCase()} DOWN`);
      this.events.push('guardian-down');
      for (const [kind, dx] of [['hp', -12], ['ammo', 12]] as const) this.items.push({ kind, x: e.x + e.w / 2 + dx, y: e.y, vy: -200, gone: false });
      return;
    }
    const drop: ItemKind | null = this.kills % 5 === 0 ? 'ammo' : this.kills % 3 === 0 ? 'hp' : null;
    if (drop) this.items.push({ kind: drop, x: e.x + e.w / 2, y: e.y, vy: -160, gone: false });
  }

  /** Deterministic bits of wreckage flying out from a point. */
  private debris(x: number, y: number, n: number, color: string) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + n, v = 120 + ((i * 53) % 5) * 45;
      this.effects.push({ x, y, t: 0, kind: 'debris', vx: Math.cos(a) * v, vy: Math.sin(a) * v - 200, color });
    }
  }

  // ----- boss -----
  private startFight() {
    this.fight = true;
    this.bossDamage = 0;
    this.tilesRev++;
    for (let r = 0; r < ROWS; r++) this.tiles[this.map.arena * ROWS + r] = 1;
    // In co-op a partner still outside is pulled in before the gate shuts.
    for (const h of this.living) {
      const b = this.bodies[h];
      if (b.x < (this.map.arena + 1) * TILE + 2) Object.assign(b, { x: (this.map.arena + 2) * TILE, y: (ROWS - 3) * TILE - b.h, vx: 0, vy: 0, ride: -1 });
      b.dashT = 0; b.charge = 0;
    }
    this.enemies = [];
    this.shots = this.shots.filter((s) => s.hero);
    this.spawnBoss(this.rushing ? RUSH[this.rush] : this.stage.boss, 2.2);
  }
  private spawnBoss(kind: BossKind, intro: number) {
    const [w, h] = BOSS_SIZE[kind], floor = (ROWS - 3) * TILE, x = (this.map.arena + 24) * TILE;
    const hp = Math.ceil((this.rushing && kind !== 'cougar' ? RUSH_HP : BOSS_HP[kind]) * (this.hard ? HARD_HP : 1));
    this.boss = { kind, x, y: kind === 'owl' ? 120 : floor - h, w, h, vx: 0, vy: 0, hp, max: hp, face: -1, move: 'idle', t: 0, cycle: -1, inv: 0, flinch: 0, ground: kind !== 'owl', hidden: false, tx: 0, ty: 0, fired: 0, slash: -1, deathT: 0, phase2: false };
    this.state = 'boss';
    this.introT = this.introMax = intro;
    this.say(this.rushing && this.rush > 0 ? bossInfo(kind).bossName.toUpperCase() : 'WARNING');
    this.events.push('warning');
  }
  private rest(b: Boss) {
    b.move = 'idle'; b.t = 0; b.fired = 0; b.vx = 0;
    // Hard mode: every move ends with an aimed three-way volley.
    if (this.hard && this.state === 'play' && b.hp > 0 && !b.hidden) {
      const p = this.player, bx = b.x + b.w / 2, by = b.y + b.h / 2, a = Math.atan2(p.y + p.h / 2 - by, p.x + p.w / 2 - bx);
      for (const d of [-0.25, 0, 0.25]) this.enemyShot(bx, by, Math.cos(a + d) * 230, Math.sin(a + d) * 230, 'pellet', 2);
    }
  }
  private updateBoss(dt: number) {
    const b = this.boss;
    if (!b) return;
    const p = this.player, px = p.x + p.w / 2, py = p.y + p.h / 2, bx = b.x + b.w / 2, by = b.y + b.h / 2;
    const left = (this.map.arena + 1) * TILE, right = (this.map.arena + 31) * TILE, floor = (ROWS - 3) * TILE;
    if (this.state === 'clearing') {
      b.deathT += dt;
      if (Math.floor(b.deathT * 8) !== Math.floor((b.deathT - dt) * 8)) this.fx(b.x + ((b.deathT * 97) % b.w), b.y + ((b.deathT * 61) % b.h), 'boom');
      const more = this.rushing && this.rush < RUSH.length - 1;
      if (more && b.deathT > 1.2) {
        // The next boss of the rush steps in, and a health capsule drops for the heroes.
        this.rush++;
        this.items.push({ kind: 'hp', x: left + 15 * TILE, y: 200, vy: 0, gone: false });
        for (const h of this.living) this.bodies[h].invT = 1;
        this.spawnBoss(RUSH[this.rush], 1.6);
      } else if (!more && b.deathT > 2.4) this.finish();
      return;
    }
    b.inv = Math.max(0, b.inv - dt);
    const flying = b.kind === 'owl';
    const physics = () => {
      if (flying) { b.x = Math.max(left, Math.min(right - b.w, b.x + b.vx * dt)); b.y = Math.max(40, Math.min(floor - b.h, b.y + b.vy * dt)); return { hitX: b.x <= left || b.x >= right - b.w ? 1 : 0 }; }
      b.vy = Math.min(PHYS.maxFall * 1.4, b.vy + PHYS.gravity * dt);
      const hit = this.move(b, b.vx * dt, b.vy * dt);
      b.ground = hit.hitY > 0;
      if (b.ground || hit.hitY < 0) b.vy = 0;
      return hit;
    };
    if (b.flinch > 0) { b.flinch -= dt; b.vx = 0; if (flying) b.vy = 0; physics(); return; }
    if (this.state !== 'play') { b.vx = 0; physics(); return; }
    const rage = (b.hp < b.max / 2 ? 1.25 : 1) * (this.hard ? 1.2 : 1);
    b.t += dt * rage;
    const toward = (px > bx ? 1 : -1) as 1 | -1;
    const clampX = (x: number) => Math.max(left + 14, Math.min(right - 14, x));
    const stormColumns = (x: number) => [-110, 0, 110].map((o) => clampX(x + o));
    const next = () => { const pat = b.phase2 ? PHASE2 : PATTERNS[b.kind]; b.cycle++; b.move = pat[b.cycle % pat.length]; b.t = 0; b.fired = 0; b.face = toward; };
    const leap = (vy: number) => {
      if (b.fired === 0) { b.vy = -vy; b.vx = Math.max(-320, Math.min(320, (px - bx) / 0.85)); b.ground = false; b.fired = 1; b.t = 0.001; }
      else if (b.fired === 1 && b.ground && b.t > 0.15) {
        b.vx = 0; b.fired = 2; this.shake = 0.25; this.events.push('stomp');
        for (const s of [-1, 1]) this.enemyShot(bx, floor - 10, s * 230, 0, 'wave', 3);
        this.rest(b);
      }
    };
    const dash = () => {
      if (b.t < 0.35) { b.vx = 0; return; }
      b.vx = b.face * 380 * rage;
    };
    let hit = { hitX: 0 };
    switch (b.move) {
      case 'idle':
        b.vx = 0;
        if (flying) { b.vx = (VIEW_W / 2 + this.map.arena * TILE - bx) * 1.2; b.vy = (110 - b.y) * 2; }
        b.face = toward;
        if (b.t > 0.6) next();
        break;
      case 'dash': dash(); break;
      case 'leap': case 'pounce': leap(b.move === 'pounce' ? 680 : 620); break;
      case 'shards':
        if (b.t > 0.35 && !b.fired) { b.fired = 1; const a = Math.atan2(py - by, px - bx); for (const d of [-0.22, 0, 0.22]) this.enemyShot(bx, by, Math.cos(a + d) * 260, Math.sin(a + d) * 260, 'shard', 3); this.events.push('enemy-shot'); }
        if (b.t > 0.9) this.rest(b);
        break;
      case 'hover': {
        const mid = this.map.arena * TILE + VIEW_W / 2;
        b.vx = (mid + Math.sin(b.t * 1.6) * 300 - bx) * 3;
        b.vy = (110 - b.y) * 3;
        b.face = toward;
        if (Math.floor(b.t / 0.45) > b.fired) { b.fired++; this.enemyShot(bx, b.y + b.h, Math.max(-120, Math.min(120, (px - bx) * 0.4)), 200, 'feather', 2); }
        if (b.t > 2.6) this.rest(b);
        break;
      }
      case 'swoop':
        if (b.t < 0.45) { b.vx = 0; b.vy = 0; break; }
        if (!b.fired) { b.fired = 1; b.tx = px - b.w / 2; b.ty = Math.min(floor - b.h, py - b.h / 2); this.events.push('swoop'); }
        {
          const dx = b.tx - b.x, dy = b.ty - b.y, d = Math.hypot(dx, dy);
          if (d < 8 || b.t > 1.8) this.rest(b);
          else { b.vx = (dx / d) * 430 * rage; b.vy = (dy / d) * 430 * rage; }
        }
        break;
      case 'gust':
        b.vx = 0; b.vy = 0;
        this.wind = toward * 120;
        if ((b.t > 0.5 && b.fired === 0) || (b.t > 1.2 && b.fired === 1)) { b.fired++; this.enemyShot(bx, by, toward * 240, 0, 'feather', 2); }
        if (b.t > 2.2) { this.wind = 0; this.rest(b); }
        break;
      case 'spit':
        if (b.t > 0.3 && !b.fired) { b.fired = 1; for (const v of [140, 210, 280]) this.enemyShot(bx + b.face * 20, by - 6, b.face * v, -430, 'fire', 3, { grav: 900 }); this.events.push('enemy-shot'); }
        if (b.t > 1) this.rest(b);
        break;
      case 'lunge':
        if (b.t < 0.4) { b.vx = 0; break; }
        b.vx = b.face * 420 * rage;
        break;
      case 'burrow':
        b.vx = 0;
        if (b.t < 0.45) { b.hidden = true; b.tx = Math.max(left, Math.min(right - b.w, px - b.w / 2)); }
        else if (b.t < 1.25) b.x = b.tx;
        else if (!b.fired) { b.fired = 1; b.hidden = false; b.vy = -560; b.ground = false; this.shake = 0.2; this.events.push('stomp'); }
        else if (b.ground && b.t > 1.45) this.rest(b);
        break;
      case 'claw':
        b.vx = 0;
        if ((b.t > 0.3 && b.fired === 0) || (b.t > 0.75 && b.fired === 1)) { this.enemyShot(bx + b.face * 24, floor - (b.fired ? 62 : 14), b.face * 330, 0, 'claw', 3); b.fired++; this.events.push('slash'); }
        if (b.t > 1.2) this.rest(b);
        break;
      case 'crystals':
        if (b.t > 0.35 && !b.fired) { b.fired = 1; for (const v of [160, 260, 360]) this.enemyShot(bx, b.y, b.face * v, -520, 'crystal', 3, { grav: 1000 }); this.events.push('enemy-shot'); }
        if (b.t > 1) this.rest(b);
        break;
      case 'roll':
        // Curled up, the armadillo shrugs off everything but its weakness; it bounces off the walls three times.
        if (b.t < 0.4) { b.vx = 0; break; }
        b.vx = b.face * 400 * rage;
        if (b.t > 3.2) this.rest(b);
        break;
      case 'quake':
        b.vx = 0;
        if (b.t > 0.4 && !b.fired) {
          b.fired = 1; this.shake = 0.4; this.events.push('stomp');
          for (const o of [-120, 0, 120]) this.enemyShot(clampX(px + o), -20 - Math.abs(o) * 0.4, 0, 0, 'rock', 3, { grav: 700, life: 3 });
        }
        if (b.t > 1.3) this.rest(b);
        break;
      case 'bolt':
        if (b.fired < 2 && b.t > 0.3 + b.fired * 0.35) {
          b.fired++;
          const a = Math.atan2(py - (b.y + 14), px - bx);
          this.enemyShot(bx + b.face * 22, b.y + 14, Math.cos(a) * 380, Math.sin(a) * 380, 'spark', 3);
          this.events.push('enemy-shot');
        }
        if (b.t > 1.1) this.rest(b);
        break;
      case 'storm':
        // Marks three columns around the heroes, then lightning strikes them.
        b.vx = 0;
        if (!b.fired) { b.fired = 1; b.tx = px; this.events.push('charge1'); }
        if (b.fired === 1 && b.t > 0.9) { b.fired = 2; this.shake = 0.25; this.events.push('stomp'); for (const x of stormColumns(b.tx)) this.enemyShot(x, -40, 0, 900, 'bolt', 3, { life: 1 }); }
        if (b.t > 1.5) this.rest(b);
        break;
      case 'hop':
        // Three short hops toward the heroes.
        if (b.ground) b.vx = 0;
        if (b.fired < 3) { if (b.ground && b.t > 0.2) { b.face = toward; b.vy = -380; b.vx = toward * 150 * rage; b.ground = false; b.fired++; b.t = 0; } }
        else if (b.ground) this.rest(b);
        break;
      case 'tongue':
        b.vx = 0;
        if (b.t > 0.45 && !b.fired) { b.fired = 1; this.enemyShot(bx + b.face * 26, b.y + 12, b.face * 520, 0, 'tongue', 3, { life: 0.5 }); this.events.push('slash'); }
        if (b.t > 1) this.rest(b);
        break;
      case 'bubbles':
        b.vx = 0;
        if (b.fired < 4 && b.t > 0.3 * (b.fired + 1)) { b.fired++; this.enemyShot(bx + b.face * 20, b.y + 8, b.face * (120 + b.fired * 30), -30 * b.fired, 'foam', 2, { grav: -40, life: 4 }); this.events.push('enemy-shot'); }
        if (b.t > 1.8) this.rest(b);
        break;
      case 'roar':
        b.vx = 0;
        if (b.t > 0.5 && !b.fired) {
          b.fired = 1; this.shake = 0.5; this.events.push('roar');
          const bats = this.enemies.filter((e) => e.kind === 'bat').length;
          for (let i = bats; i < 2; i++) { const e = this.spawnEnemy('bat', (this.map.arena + 6 + i * 18) * TILE, 150); e.t = 1; this.enemies.push(e); }
        }
        if (b.t > 1.1) this.rest(b);
        break;
    }
    if (b.move !== 'burrow') b.hidden = false;
    hit = physics();
    if (hit.hitX && (b.move === 'dash' || b.move === 'lunge')) { b.face = -b.face as 1 | -1; this.shake = 0.15; this.rest(b); }
    if (hit.hitX && b.move === 'roll') { b.face = -b.face as 1 | -1; this.shake = 0.15; b.fired++; if (b.fired >= 3) this.rest(b); }
  }
  /** A rolling armadillo deflects everything except its weakness. */
  guarded(b: Boss, weapon: WeaponId | null) { return b.move === 'roll' && b.t >= 0.4 && weapon !== bossInfo(b.kind).weakness; }
  private damageBoss(b: Boss, dmg: number, weapon: WeaponId | null) {
    if (b.inv > 0 || b.hidden || this.state !== 'play') return false;
    if (this.guarded(b, weapon)) { this.fx(b.x + b.w / 2, b.y + b.h / 2, 'spark'); this.events.push('deflect'); return false; }
    const info = bossInfo(b.kind), weak = weapon !== null && weapon === info.weakness;
    if (weak && b.move === 'roll') this.rest(b);
    b.hp -= dmg * (weak ? WEAKNESS : 1) * (this.player.tagT > 0 ? TAG_BONUS : 1);
    b.inv = 0.1;
    this.fx(b.x + b.w / 2, b.y + b.h / 2, 'spark');
    if (weak) {
      b.flinch = 0.45; this.wind = 0; this.events.push('weak');
      if (!this.progress.found.includes(info.id)) { this.progress.found.push(info.id); this.events.push('found'); }
    } else this.events.push('hit');
    if (weak || dmg >= 4) this.freeze = HITSTOP;
    if (b.kind === 'cougar' && !b.phase2 && b.hp > 0 && b.hp <= b.max / 2) {
      b.phase2 = true; b.cycle = -1; this.rest(b); this.shake = 0.4;
      this.say('KINGPIN ENRAGED'); this.events.push('roar');
    }
    if (b.hp <= 0) {
      b.hp = 0; this.state = 'clearing'; b.deathT = 0; b.vx = 0; this.wind = 0; this.shake = 0.6;
      this.debris(b.x + b.w / 2, b.y + b.h / 2, 28, '#ffd46a');
      this.shots = []; this.enemies = [];
      for (const h of HEROES) this.bodies[h].invT = 99;
      this.events.push('boss-down');
    }
    return true;
  }
  private finish() {
    const id = this.stage.id, pr = this.progress;
    this.state = 'clear';
    this.endT = 0;
    if (this.gallery) {
      // Gallery refights only keep a best time.
      const best = pr.bossBest[id];
      this.newBest = best === undefined || this.time < best;
      if (this.newBest) pr.bossBest[id] = Math.round(this.time * 10) / 10;
      this.say('BOSS DOWN');
      this.events.push('clear');
      return;
    }
    if (!pr.cleared.includes(id)) pr.cleared.push(id);
    const best = pr.best[id];
    this.newBest = best === undefined || this.time < best;
    if (this.newBest) pr.best[id] = Math.round(this.time * 10) / 10;
    this.medal = medalFor(id, this.time);
    this.rank = rankFor(id, this.time, this.damage, Math.min(this.kills, this.enemyTotal), this.enemyTotal);
    pr.ranks[id] = betterRank(pr.ranks[id], this.rank);
    if (this.medal > (pr.medals[id] ?? 0)) pr.medals[id] = this.medal;
    const won: BadgeId[] = [];
    if (this.bossDamage === 0) won.push('untouched');
    if (!this.usedSpecial) won.push('buster');
    if (id === 'citadel' && !this.usedSub) won.push('nosub');
    if (this.hard) won.push('hard');
    this.earned = won.filter((b) => !pr.badges.includes(`${id}:${b}`));
    pr.badges.push(...this.earned.map((b) => `${id}:${b}`));
    this.say(this.stage.weapon ? `WEAPON GET: ${WEAPONS[this.stage.weapon].name.toUpperCase()}` : 'MISSION COMPLETE');
    this.events.push('clear');
    if (this.earned.length) this.events.push('badge');
  }

  // ----- shots, items, contact -----
  private updateShots(dt: number) {
    const alive: Shot[] = [];
    for (const s of this.shots) {
      s.life -= dt;
      // Shots that grind (orbits, walls, tornadoes, giant bubbles) may hit the same foe again every so often.
      if (s.rehit && Math.floor(s.life / s.rehit) !== Math.floor((s.life + dt) / s.rehit)) s.hits = [];
      if (s.orbit !== undefined) {
        const o = this.bodies[s.owner ?? this.hero];
        if (o.down) continue;
        s.orbit += dt * 7;
        s.x = o.x + o.w / 2 + Math.cos(s.orbit) * 34;
        s.y = o.y + o.h / 2 + Math.sin(s.orbit) * 34;
        // Orbiting crystals pass through walls, shattering any crystal wall they touch.
        this.impact(s);
        if (s.life > 0) alive.push(s);
        continue;
      }
      if (s.kind === 'volt') this.home(s, dt);
      s.vy += s.grav * dt;
      s.x += s.vx * dt;
      if (s.life <= 0) continue;
      if (this.solid(s.x, s.y)) { this.impact(s); continue; }
      s.y += s.vy * dt;
      if (s.kind === 'ember' && s.vy > 0 && this.solid(s.x, s.y + s.r)) { s.y = Math.floor((s.y + s.r) / TILE) * TILE - s.r; s.vy = 0; s.vx = Math.sign(s.vx) * 260; }
      else if (this.solid(s.x, s.y)) { this.impact(s); continue; }
      if (s.x < this.camX - 40 || s.x > this.camX + VIEW_W + 40 || s.y > ROWS * TILE + 40 || s.y < -80) continue;
      alive.push(s);
    }
    this.shots = alive;
  }
  /** A shot meets the level: the right weapon opens a crystal wall or power door, and bombs burst into shock waves. */
  private impact(s: Shot) {
    const c = Math.floor(s.x / TILE), r = Math.floor(s.y / TILE), t = this.tile(c, r);
    if (s.hero && OPENS[t] !== undefined && OPENS[t] === s.weapon) this.open(c, r, t);
    if (s.kind === 'bomb') {
      this.fx(s.x, s.y, 'boom');
      this.shake = Math.max(this.shake, 0.1);
      for (const d of [-1, 1]) this.enemyShot(s.x, r * TILE - 10, d * 220, 0, 'wave', 2, { life: 0.5 });
    }
  }
  /** Clear every connected tile of one breakable kind. */
  private open(c: number, r: number, t: number) {
    const todo: [number, number][] = [[c, r]];
    while (todo.length) {
      const [x, y] = todo.pop()!;
      if (x < 0 || x >= this.map.cols || y < 0 || y >= ROWS || this.tiles[x * ROWS + y] !== t) continue;
      this.tiles[x * ROWS + y] = T.air;
      this.fx(x * TILE + TILE / 2, y * TILE + TILE / 2, 'boom');
      todo.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    this.tilesRev++;
    this.shake = Math.max(this.shake, 0.2);
    this.events.push('break');
  }
  /** Turn a volt spark toward the nearest enemy or boss within reach. */
  private home(s: Shot, dt: number) {
    const b = this.boss, targets: Body[] = this.enemies.filter((e) => e.alive);
    if (b && !b.hidden && this.state === 'play') targets.push(b);
    let best: Body | null = null, reach = 420;
    for (const t of targets) { const d = Math.hypot(t.x + t.w / 2 - s.x, t.y + t.h / 2 - s.y); if (d < reach) { reach = d; best = t; } }
    if (!best) return;
    const cur = Math.atan2(s.vy, s.vx), want = Math.atan2(best.y + best.h / 2 - s.y, best.x + best.w / 2 - s.x);
    const turn = Math.atan2(Math.sin(want - cur), Math.cos(want - cur)), a = cur + Math.max(-4 * dt, Math.min(4 * dt, turn));
    s.vx = Math.cos(a) * VOLT_SPEED;
    s.vy = Math.sin(a) * VOLT_SPEED;
  }
  private updateItems(dt: number) {
    for (const it of this.items) {
      if (it.gone || FIXED(it.kind)) continue;
      it.vy = Math.min(PHYS.maxFall, it.vy + PHYS.gravity * dt);
      const box = { x: it.x - 7, y: it.y - 7, w: 14, h: 14 };
      const hit = this.move(box, 0, it.vy * dt);
      if (hit.hitY) it.vy = 0;
      it.y = box.y + 7;
      if (it.y > ROWS * TILE + 20) it.gone = true;
    }
    for (const h of this.living) {
      this.use(h);
      for (const it of this.items) {
        if (it.gone || !overlap(this.player, { x: it.x - 10, y: it.y - 10, w: 20, h: 20 })) continue;
        it.gone = true;
        this.fx(it.x, it.y, 'heal');
        this.collect(it.kind);
      }
    }
    this.items = this.items.filter((i) => !i.gone);
  }
  private collect(kind: ItemKind) {
    const id = this.stage.id, pr = this.progress;
    if (kind === 'hp') {
      const total = this.hp[this.hero] + 6;
      this.hp[this.hero] = Math.min(this.max, total);
      // Health beyond the maximum tops up the sub-tanks.
      let extra = total - this.max;
      for (let i = 0; i < pr.subFill.length && extra > 0; i++) { const add = Math.min(extra, SUB_CAP - pr.subFill[i]); pr.subFill[i] += add; extra -= add; }
      this.events.push('pickup');
    }
    if (kind === 'ammo') { for (const w of Object.keys(this.energy) as WeaponId[]) this.energy[w] = Math.min(ENERGY, this.energy[w] + 8); this.events.push('pickup'); }
    if (kind === 'tank' && !pr.tanks.includes(id)) {
      pr.tanks.push(id);
      this.max = maxHp(pr);
      this.hp.dora = Math.min(this.max, this.hp.dora + HERO.tank);
      this.hp.enzo = Math.min(this.max, this.hp.enzo + HERO.tank);
      this.say('HEART TANK · MAX HEALTH UP');
      this.events.push('tank');
    }
    if (kind === 'sub' && !pr.subs.includes(id)) { pr.subs.push(id); pr.subFill.push(0); this.say('SUB-TANK'); this.events.push('sub'); }
    if (isPartItem(kind) && !pr.parts.includes(kind)) { pr.parts.push(kind); this.say(PARTS[kind].name.toUpperCase()); this.events.push('part'); }
  }
  /** The saber's reach: a box in front of Enzo while a swing is live, longer for a dash slash. */
  get saberBox(): Body | null {
    const p = this.player;
    if (this.hero !== 'enzo' || p.slashT <= 0) return null;
    const w = p.dashSlash ? 64 : 44;
    return { x: p.face > 0 ? p.x + p.w - 4 : p.x - w + 4, y: p.y - 8, w, h: 44 };
  }
  private hits() {
    const b = this.boss;
    for (const s of this.shots) {
      if (s.life <= 0 || !s.hero) continue;
      const box = shotBox(s);
      for (const e of this.enemies) {
        if (!e.alive || s.hits.includes(e.id) || !overlap(box, e)) continue;
        s.hits.push(e.id);
        // A shield stops weak shots from the front: hit it from behind, or with a charged shot.
        if (e.kind === 'shield' && (s.x - (e.x + e.w / 2)) * e.face > 0 && s.dmg < 4) {
          this.fx(s.x, s.y, 'spark'); this.events.push('deflect');
          if (!s.pierce) { s.life = 0; break; }
          continue;
        }
        this.damageEnemy(e, s.dmg);
        if (!s.pierce) { s.life = 0; break; }
      }
      if (s.life > 0 && b && !s.hits.includes(-1) && overlap(box, b) && this.damageBoss(b, s.dmg, s.weapon)) { s.hits.push(-1); if (!s.pierce) s.life = 0; }
      else if (s.life > 0 && b && !b.hidden && (b.inv > 0 || this.guarded(b, s.weapon)) && overlap(box, b) && !s.pierce && this.state === 'play') s.life = 0;
    }
    const blockers = this.shots.filter((s) => s.hero && s.life > 0 && (s.block || s.orbit !== undefined)).map(shotBox);
    for (const h of this.living) {
      this.use(h);
      const p = this.player, saber = this.saberBox;
      for (const s of this.shots) {
        // A hero knocked out by an earlier shot this frame no longer soaks up the rest.
        if (p.down) break;
        if (s.life <= 0 || s.hero) continue;
        const box = shotBox(s);
        const cuttable = s.kind !== 'wave' && s.kind !== 'bolt';
        if (cuttable && ((saber && overlap(box, saber)) || blockers.some((o) => overlap(box, o)))) { s.life = 0; this.fx(s.x, s.y, 'spark'); this.events.push('deflect'); continue; }
        if (overlap(box, p)) { this.hurt(s.dmg, s.x); if (s.kind !== 'wave') s.life = 0; }
      }
      if (saber) {
        const dmg = p.dashSlash ? 5 : p.combo === 2 ? 4 : 3;
        for (const e of this.enemies) if (e.alive && e.slash !== p.slashId && overlap(saber, e)) { e.slash = p.slashId; this.damageEnemy(e, dmg); }
        if (b && b.slash !== p.slashId && overlap(saber, b) && this.damageBoss(b, dmg, 'buster')) b.slash = p.slashId;
      }
      for (const e of this.enemies) if (e.alive && overlap(p, e)) this.hurt(e.kind === 'guardian' ? 4 : 3, e.x + e.w / 2);
      if (b && !b.hidden && this.state === 'play' && overlap(p, b)) this.hurt(4, b.x + b.w / 2);
      for (const c of this.crushers) if (overlap(p, { x: c.x + 3, y: 0, w: c.w - 6, h: c.bottom })) this.hurt(CRUSH_DAMAGE, c.x + c.w / 2);
    }
    this.shots = this.shots.filter((s) => s.life > 0);
  }

  /** One line for screen readers and tests. */
  get status() {
    const s = this.stage, hp = (h: HeroId) => `${h === 'dora' ? 'Dora' : 'Enzo'} ${Math.ceil(this.hp[h])}/${this.max}`;
    const who = this.coop ? 'Co-op' : `${this.hero === 'dora' ? 'Dora' : 'Enzo'} in play`;
    const sector = this.gallery ? ' · Boss gallery' : partsOf(s.id) > 1 ? ` · Sector ${this.part + 1}` : '';
    const boss = this.boss ? ` · ${bossInfo(this.boss.kind).bossName} ${Math.ceil(this.boss.hp)}/${this.boss.max}` : '';
    return `${s.name}${sector} · ${who} · ${hp('dora')} · ${hp('enzo')} · ${WEAPONS[this.weaponId].name}${boss}`;
  }
}
