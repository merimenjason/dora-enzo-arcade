// Cloudpop: the storm-puffs. Every kind, what it pops into, its speed, its toughness and what it shrugs off.
// A puff's "layers" (RBE, the genre's red-bloon-equivalent) is how many single hits it takes to clear it and its
// children; a puff that reaches the festival costs that many lives. Pure data plus a few helpers; no DOM.

export type DType = 'light' | 'heavy' | 'fire' | 'cold' | 'sound' | 'spit' | 'wind' | 'magic';
export const DTYPE_NAME: Record<DType, string> = {
  light: 'Light', heavy: 'Heavy', fire: 'Fire', cold: 'Cold', sound: 'Sound', spit: 'Spit', wind: 'Wind', magic: 'Magic',
};

export type PuffKind =
  | 'wisp' | 'drizzle' | 'shower' | 'squall' | 'gale'
  | 'rumble' | 'frost' | 'hail' | 'tempest' | 'cloudburst' | 'sleet'
  | 'thunderhead' | 'whirlwind' | 'anvilhead' | 'stormcrown' | 'huracan';

export interface PuffDef {
  kind: PuffKind;
  name: string;
  /** hits to break this shell (before children) */
  hp: number;
  /** speed multiplier on BASE_SPEED */
  speed: number;
  /** body radius in world units */
  r: number;
  /** what it splits into, in order */
  children: PuffKind[];
  /** damage types that cannot hurt it */
  immune: DType[];
  /** ignores freezing and slowing (frost) */
  noChill?: boolean;
  /** born hidden (night) */
  night?: boolean;
  boss?: boolean;
  /** one-line player hint */
  hint: string;
  /** palette colour for code-drawn effects (pop sparkles, health bars) */
  col: string;
}

export const BASE_SPEED = 64; // world units per second for a wisp

export const PUFFS: Record<PuffKind, PuffDef> = {
  wisp: { kind: 'wisp', name: 'Wisp', hp: 1, speed: 1, r: 15, children: [], immune: [], hint: 'The last little scrap of cloud.', col: '#f4f1ea' },
  drizzle: { kind: 'drizzle', name: 'Drizzle', hp: 1, speed: 1.35, r: 16, children: ['wisp'], immune: [], hint: 'Pops into a Wisp.', col: '#6db7ec' },
  shower: { kind: 'shower', name: 'Shower', hp: 1, speed: 1.7, r: 17, children: ['drizzle'], immune: [], hint: 'Pops into a Drizzle.', col: '#3fbf9a' },
  squall: { kind: 'squall', name: 'Squall', hp: 1, speed: 2.9, r: 18, children: ['shower'], immune: [], hint: 'Fast. Pops into a Shower.', col: '#f2c230' },
  gale: { kind: 'gale', name: 'Gale', hp: 1, speed: 3.2, r: 19, children: ['squall'], immune: [], hint: 'Fastest of the common puffs. Pops into a Squall.', col: '#f27d52' },
  rumble: { kind: 'rumble', name: 'Rumble', hp: 1, speed: 1.6, r: 20, children: ['gale', 'gale'], immune: ['heavy'], hint: 'Shrugs off Heavy blasts. Pops into two Gales.', col: '#4a4a5a' },
  frost: { kind: 'frost', name: 'Frost Puff', hp: 1, speed: 1.8, r: 20, children: ['gale', 'gale'], immune: ['cold'], noChill: true, hint: 'Cannot be frozen or slowed, and Cold cannot hurt it. Pops into two Gales.', col: '#bfeefa' },
  hail: { kind: 'hail', name: 'Hail', hp: 1, speed: 1, r: 22, children: ['rumble', 'rumble'], immune: ['light'], hint: 'Ice-armoured: Light shots bounce off. Needs Heavy, Fire, Sound or Magic. Pops into two Rumbles.', col: '#9aa3ad' },
  tempest: { kind: 'tempest', name: 'Tempest', hp: 1, speed: 1.8, r: 22, children: ['rumble', 'frost'], immune: ['heavy', 'cold'], noChill: true, hint: 'Ignores Heavy and Cold and cannot be chilled. Pops into a Rumble and a Frost Puff.', col: '#6c6f9c' },
  cloudburst: { kind: 'cloudburst', name: 'Cloudburst', hp: 1, speed: 2.2, r: 24, children: ['tempest', 'tempest'], immune: [], hint: 'A swirl of every colour. Pops into two Tempests.', col: '#d16fd0' },
  sleet: { kind: 'sleet', name: 'Sleet', hp: 10, speed: 2.5, r: 26, children: ['cloudburst', 'cloudburst'], immune: [], hint: 'Packed sleet: takes 10 hits, then two Cloudbursts burst out.', col: '#7e9bb0' },
  thunderhead: { kind: 'thunderhead', name: 'Thunderhead', hp: 200, speed: 1, r: 54, children: ['sleet', 'sleet', 'sleet', 'sleet'], immune: [], boss: true, hint: 'A boss cloud: 200 hits, then four Sleets.', col: '#3d5a80' },
  whirlwind: { kind: 'whirlwind', name: 'Whirlwind', hp: 400, speed: 2.75, r: 40, children: ['sleet', 'sleet', 'sleet', 'sleet'], immune: ['light'], night: true, boss: true, hint: 'A fast, hidden, ice-armoured twister. Needs night sight and non-Light hits.', col: '#59607a' },
  anvilhead: { kind: 'anvilhead', name: 'Anvilhead', hp: 700, speed: 0.3, r: 68, children: ['thunderhead', 'thunderhead', 'thunderhead', 'thunderhead'], immune: [], boss: true, hint: 'A towering boss: 700 hits, then four Thunderheads.', col: '#2b3a55' },
  stormcrown: { kind: 'stormcrown', name: 'Stormcrown', hp: 4000, speed: 0.18, r: 84, children: ['anvilhead', 'anvilhead', 'anvilhead', 'anvilhead'], immune: [], boss: true, hint: 'The crowned storm: 4000 hits, then four Anvilheads.', col: '#24203c' },
  huracan: { kind: 'huracan', name: 'Huracán', hp: 20000, speed: 0.18, r: 104, children: ['stormcrown', 'stormcrown', 'whirlwind', 'whirlwind', 'whirlwind'], immune: [], boss: true, hint: 'The great storm of the valley: 20000 hits, then two Stormcrowns and three Whirlwinds.', col: '#140f24' },
};
export const PUFF_KINDS = Object.keys(PUFFS) as PuffKind[];
export const BOSSES: PuffKind[] = ['thunderhead', 'whirlwind', 'anvilhead', 'stormcrown', 'huracan'];

/** puff modifiers, carried by any kind and passed to its children */
export interface PuffMods { night?: boolean; fog?: boolean; fort?: boolean }

/** the shell's hit points with modifiers: fortified doubles boss and sleet shells and gives hail four */
export function shellHp(kind: PuffKind, fort: boolean, bossScale = 1): number {
  const d = PUFFS[kind];
  let hp = d.hp;
  if (fort) { if (kind === 'hail') hp = 4; else if (d.hp > 1) hp *= 2; }
  if (d.boss) hp = Math.round(hp * bossScale);
  return hp;
}

const RBE_CACHE: Record<string, number> = {};
/** layers: total hits to clear a puff and everything inside it */
export function layers(kind: PuffKind, fort = false, bossScale = 1): number {
  const key = kind + (fort ? 'F' : '') + bossScale;
  if (RBE_CACHE[key] !== undefined) return RBE_CACHE[key];
  const d = PUFFS[kind];
  let n = shellHp(kind, fort, bossScale);
  for (const c of d.children) n += layers(c, fort && PUFFS[c].hp > 1, bossScale);
  return (RBE_CACHE[key] = n);
}

/** regrowth (fog): a fogged puff that has not been hit for a while grows back one step toward what it was */
export const REGROW_NEXT: Partial<Record<PuffKind, PuffKind>> = {
  wisp: 'drizzle', drizzle: 'shower', shower: 'squall', squall: 'gale', gale: 'rumble', rumble: 'hail', frost: 'tempest', hail: 'cloudburst', tempest: 'cloudburst', cloudburst: 'sleet',
};
export const RANK: Record<PuffKind, number> = {
  wisp: 1, drizzle: 2, shower: 3, squall: 4, gale: 5, rumble: 6, frost: 6, hail: 7, tempest: 7, cloudburst: 8, sleet: 9,
  thunderhead: 10, whirlwind: 11, anvilhead: 12, stormcrown: 13, huracan: 14,
};
export const REGROW_EVERY = 3; // seconds without a hit

/** can this damage type hurt this kind at all? */
export function canHurt(kind: PuffKind, t: DType): boolean {
  if (t === 'magic') return true;
  return !PUFFS[kind].immune.includes(t);
}
