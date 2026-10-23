// Grumble Hunt content: the story chapters, materials, drop tables, Pantry recipes, snacks, the six weapon
// trees and the armour sets from docs/grumble-hunt/expansion-design.md, as plain data plus pure helpers.
// No DOM and no randomness of its own: anything random takes the engine's seeded generator, so a seed
// still replays a run exactly. Nothing here is ever hurt; beasts shed, get dizzy and nap.

export type Rand = () => number;
export type Pouch = Partial<Record<MaterialId | ItemId, number>>;
export type Cost = Partial<Record<MaterialId | ItemId, number>>;

// ---------- beasts and chapters ----------
export type BeastId = 'bristleback' | 'puffwart' | 'skreel' | 'hornclack' | 'frostmane';
export type AreaId = 'paddock' | 'meadow' | 'marsh' | 'ridge' | 'hollow' | 'peak';
export const BEAST_ORDER: readonly BeastId[] = ['bristleback', 'puffwart', 'skreel', 'hornclack', 'frostmane'];

// ---------- materials ----------
export type Rarity = 'common' | 'part' | 'rare';
export type MaterialId =
  | 'bristle-tuft' | 'tusk-shard' | 'boar-hide' | 'curly-tail-tuft'
  | 'wart-pebble' | 'puff-sac' | 'cloud-wisp' | 'marsh-reed'
  | 'sky-feather' | 'owl-down' | 'shell-plate' | 'horn-chip'
  | 'frost-fur' | 'mane-lock' | 'glimmer-stone' | 'berry';
/** `chapter` is the first story chapter where the material can be had; `icon` is its cell in icons-materials.webp. */
export const MATERIALS: Record<MaterialId, { name: string; rarity: Rarity; chapter: number; icon: number }> = {
  'bristle-tuft': { name: 'Bristle tuft', rarity: 'common', chapter: 1, icon: 0 },
  'tusk-shard': { name: 'Tusk shard', rarity: 'part', chapter: 1, icon: 1 },
  'boar-hide': { name: 'Boar hide patch', rarity: 'common', chapter: 1, icon: 2 },
  'curly-tail-tuft': { name: 'Curly tail tuft', rarity: 'rare', chapter: 1, icon: 3 },
  'puff-sac': { name: 'Puff sac', rarity: 'part', chapter: 2, icon: 4 },
  'wart-pebble': { name: 'Wart pebble', rarity: 'common', chapter: 2, icon: 5 },
  'cloud-wisp': { name: 'Sleepy-cloud wisp', rarity: 'rare', chapter: 2, icon: 6 },
  'marsh-reed': { name: 'Marsh reed', rarity: 'common', chapter: 2, icon: 7 },
  'sky-feather': { name: 'Sky feather', rarity: 'common', chapter: 3, icon: 8 },
  'owl-down': { name: 'Owl down', rarity: 'rare', chapter: 3, icon: 9 },
  'shell-plate': { name: 'Beetle shell plate', rarity: 'part', chapter: 4, icon: 10 },
  'horn-chip': { name: 'Horn chip', rarity: 'part', chapter: 4, icon: 11 },
  'frost-fur': { name: 'Frost fur', rarity: 'common', chapter: 5, icon: 12 },
  'mane-lock': { name: 'Icy mane lock', rarity: 'part', chapter: 5, icon: 13 },
  'glimmer-stone': { name: 'Glimmer stone', rarity: 'rare', chapter: 3, icon: 14 },
  berry: { name: 'Berry', rarity: 'common', chapter: 0, icon: 15 },
};

// ---------- drop tables ----------
/** What a beast sheds on a bonk, drops when a part pops off, and gives when it naps. */
export type Drops = {
  shed: { id: MaterialId; chance: number };
  parts: Record<string, MaterialId>;
  calm: { common: MaterialId[]; count: number; rare: { id: MaterialId; chance: number } };
};
export const DROPS: Record<BeastId, Drops> = {
  bristleback: { shed: { id: 'bristle-tuft', chance: 0.2 }, parts: { tusks: 'tusk-shard' }, calm: { common: ['boar-hide', 'bristle-tuft'], count: 3, rare: { id: 'curly-tail-tuft', chance: 0.25 } } },
  puffwart: { shed: { id: 'wart-pebble', chance: 0.2 }, parts: { throat: 'puff-sac' }, calm: { common: ['wart-pebble', 'marsh-reed'], count: 3, rare: { id: 'cloud-wisp', chance: 0.25 } } },
  skreel: { shed: { id: 'sky-feather', chance: 0.2 }, parts: {}, calm: { common: ['sky-feather', 'sky-feather', 'owl-down'], count: 3, rare: { id: 'owl-down', chance: 0.25 } } },
  hornclack: { shed: { id: 'shell-plate', chance: 0.1 }, parts: { shell: 'shell-plate', horn: 'horn-chip' }, calm: { common: ['horn-chip', 'shell-plate'], count: 3, rare: { id: 'horn-chip', chance: 0.25 } } },
  frostmane: { shed: { id: 'frost-fur', chance: 0.2 }, parts: { mane: 'mane-lock' }, calm: { common: ['frost-fur', 'mane-lock'], count: 3, rare: { id: 'glimmer-stone', chance: 0.5 } } },
};
/** Gathering spots per area: berry bushes everywhere, reeds in the marsh, one sparkling glimmer spot from the ridge on. */
export const GATHER: Record<AreaId, { id: MaterialId; spots: number; each: number; chance?: number }[]> = {
  paddock: [{ id: 'berry', spots: 2, each: 2 }],
  meadow: [{ id: 'berry', spots: 3, each: 2 }],
  marsh: [{ id: 'berry', spots: 2, each: 2 }, { id: 'marsh-reed', spots: 4, each: 2 }],
  ridge: [{ id: 'berry', spots: 2, each: 2 }, { id: 'glimmer-stone', spots: 1, each: 1, chance: 0.5 }],
  hollow: [{ id: 'berry', spots: 2, each: 2 }, { id: 'marsh-reed', spots: 1, each: 2 }, { id: 'glimmer-stone', spots: 1, each: 1, chance: 0.5 }],
  peak: [{ id: 'berry', spots: 2, each: 2 }, { id: 'glimmer-stone', spots: 1, each: 1, chance: 0.75 }],
};

/** One bonk: maybe shed a material. Returns what was shed, or null. */
export function rollShed(r: Rand, beast: BeastId): MaterialId | null {
  const s = DROPS[beast].shed;
  return r() < s.chance ? s.id : null;
}
/** The nap reward: `count` commons, one roll for the rare, plus the materials for any broken parts. */
export function rollCalm(r: Rand, beast: BeastId, brokenParts: readonly string[] = [], bonusRareRolls = 0): MaterialId[] {
  const d = DROPS[beast], got: MaterialId[] = [];
  for (let i = 0; i < d.calm.count; i++) got.push(d.calm.common[Math.floor(r() * d.calm.common.length)]);
  for (let i = 0; i <= bonusRareRolls; i++) if (r() < d.calm.rare.chance) got.push(d.calm.rare.id);
  for (const part of brokenParts) if (d.parts[part]) got.push(d.parts[part]);
  return got;
}
/** A full visit to an area's gathering spots. */
export function rollGather(r: Rand, area: AreaId): MaterialId[] {
  const got: MaterialId[] = [];
  for (const g of GATHER[area]) for (let i = 0; i < g.spots; i++) if (g.chance === undefined || r() < g.chance) for (let k = 0; k < g.each; k++) got.push(g.id);
  return got;
}

// ---------- pouch arithmetic ----------
export function canAfford(pouch: Pouch, cost: Cost): boolean {
  return Object.entries(cost).every(([id, n]) => (pouch[id as MaterialId] ?? 0) >= (n ?? 0));
}
/** Pays `cost` out of a copy of `pouch`; throws if it can't be paid, so callers check `canAfford` first. */
export function pay(pouch: Pouch, cost: Cost): Pouch {
  if (!canAfford(pouch, cost)) throw new Error('not enough materials');
  const next = { ...pouch };
  for (const [id, n] of Object.entries(cost)) next[id as MaterialId] = (next[id as MaterialId] ?? 0) - (n ?? 0);
  return next;
}
export function add(pouch: Pouch, got: readonly (MaterialId | ItemId)[]): Pouch {
  const next = { ...pouch };
  for (const id of got) next[id] = Math.min((next[id] ?? 0) + 1, cap(id));
  return next;
}
/** Items stop at their carry limit; materials stop at 99. */
export const cap = (id: MaterialId | ItemId) => (id in ITEMS ? ITEMS[id as ItemId].max : 99);

// ---------- Pantry: items and snacks ----------
export type ItemId = 'fluffberry' | 'big-fluffberry' | 'sleepy-seed' | 'dizzy-bell' | 'sticky-sap' | 'smoke-puffball' | 'pathfinder-acorn' | 'hay-bundle';
export type ItemEffect =
  | { kind: 'heal'; fluff: number }
  | { kind: 'drowsy'; slow: number; seconds: number }
  | { kind: 'dizzy'; amount: number }
  | { kind: 'trap'; seconds: number }
  | { kind: 'hide'; seconds: number }
  | { kind: 'track'; seconds: number }
  | { kind: 'ingredient' };
/** `icon` is the item's cell in icons-items.webp; `chapter` is when the Pantry starts offering it. */
export const ITEMS: Record<ItemId, { name: string; recipe: Cost; makes: number; max: number; effect: ItemEffect; chapter: number; icon: number }> = {
  fluffberry: { name: 'Fluffberry', recipe: { berry: 1 }, makes: 1, max: 10, effect: { kind: 'heal', fluff: 30 }, chapter: 0, icon: 0 },
  'big-fluffberry': { name: 'Big fluffberry', recipe: { berry: 2, 'marsh-reed': 1 }, makes: 1, max: 5, effect: { kind: 'heal', fluff: 70 }, chapter: 2, icon: 1 },
  'sleepy-seed': { name: 'Sleepy seed', recipe: { berry: 1, 'cloud-wisp': 1 }, makes: 1, max: 3, effect: { kind: 'drowsy', slow: 0.3, seconds: 8 }, chapter: 2, icon: 2 },
  'dizzy-bell': { name: 'Dizzy bell', recipe: { 'horn-chip': 1, 'bristle-tuft': 2 }, makes: 1, max: 2, effect: { kind: 'dizzy', amount: 40 }, chapter: 4, icon: 3 },
  'sticky-sap': { name: 'Sticky sap', recipe: { 'marsh-reed': 2 }, makes: 1, max: 2, effect: { kind: 'trap', seconds: 4 }, chapter: 4, icon: 4 },
  'smoke-puffball': { name: 'Smoke puffball', recipe: { 'puff-sac': 1 }, makes: 1, max: 3, effect: { kind: 'hide', seconds: 6 }, chapter: 2, icon: 5 },
  'pathfinder-acorn': { name: 'Pathfinder acorn', recipe: { berry: 1, 'sky-feather': 1 }, makes: 1, max: 3, effect: { kind: 'track', seconds: 20 }, chapter: 3, icon: 6 },
  'hay-bundle': { name: 'Hay bundle', recipe: { 'marsh-reed': 3 }, makes: 1, max: 5, effect: { kind: 'ingredient' }, chapter: 2, icon: 7 },
};
export type SnackId = 'clover-crunch' | 'hay-nibble' | 'berry-stack' | 'lucky-seed-bun';
export type SnackEffect = { maxFluff?: number; staminaRegen?: number; dizzyBonus?: number; bonusRareRolls?: number };
export const SNACKS: Record<SnackId, { name: string; cost: Cost; effect: SnackEffect; chapter: number }> = {
  'clover-crunch': { name: 'Clover Crunch', cost: { berry: 2 }, effect: { maxFluff: 20 }, chapter: 2 },
  'hay-nibble': { name: 'Hay Nibble', cost: { 'hay-bundle': 1 }, effect: { staminaRegen: 0.25 }, chapter: 2 },
  'berry-stack': { name: 'Berry Stack', cost: { berry: 3, 'hay-bundle': 1 }, effect: { dizzyBonus: 0.1 }, chapter: 2 },
  'lucky-seed-bun': { name: 'Lucky Seed Bun', cost: { berry: 2, 'hay-bundle': 1, 'glimmer-stone': 1 }, effect: { bonusRareRolls: 1 }, chapter: 3 },
};

// ---------- weapons ----------
export type WeaponType = 'hammer' | 'bow' | 'claws' | 'lance' | 'wand' | 'yoyo';
export type Speed = 'slow' | 'medium' | 'fast';
/** Tier-1 stats. `bonk` lowers Grump, `dizzy` builds the dizzy meter. `chapter` is when the type is first unlocked. */
export const WEAPON_TYPES: Record<WeaponType, { name: string; bonk: number; dizzy: number; speed: Speed; signature: string; chapter: number }> = {
  hammer: { name: 'Acorn Hammer', bonk: 12, dizzy: 14, speed: 'slow', signature: 'Big Swing: hold to charge three levels (×1, ×1.6, ×2.4); a level-3 head hit adds 25 Dizzy.', chapter: 0 },
  bow: { name: 'Seed Bow', bonk: 6, dizzy: 3, speed: 'medium', signature: 'Charged Shot: hold for one, two or three seeds; switch between plain, sticky and pop seeds.', chapter: 0 },
  claws: { name: 'Twin Claws', bonk: 4, dizzy: 3, speed: 'fast', signature: 'Zoomies: move and attack 30% faster while the Zoom meter lasts; hits refill it.', chapter: 1 },
  lance: { name: 'Thistle Lance', bonk: 9, dizzy: 6, speed: 'medium', signature: 'Guard: hold to block from the front; let go as an attack lands for a Counter Boop (×2 Bonk, +15 Dizzy).', chapter: 2 },
  wand: { name: 'Bubble Wand', bonk: 5, dizzy: 4, speed: 'medium', signature: 'Bubble Burst: a slow bubble that pops for an area hit, lifts loose materials and heals your buddy 15 Fluff.', chapter: 3 },
  yoyo: { name: 'Pinecone Yo-yo', bonk: 7, dizzy: 5, speed: 'medium', signature: 'Loop-the-Loop: spin all around you; on a dizzy beast it pulls you up for a Hop-on.', chapter: 4 },
};
export type Tier = 1 | 2 | 3 | 4 | 5;
/** Tier 5 is the Glimmer capstone. */
export const TIER_MULT: Record<Tier, number> = { 1: 1, 2: 1.3, 3: 1.65, 4: 2.1, 5: 2.4 };
export type Branch = 'A' | 'B';
export type Perk = { id: string; text: string; value: number };
export type WeaponNode = { id: string; type: WeaponType; tier: Tier; branch: Branch | null; name: string; from: string | null; cost: Cost; perks: Perk[] };

const perk = (id: string, value: number, text: string): Perk => ({ id, value, text });
const WARM_GLOW = perk('warm-glow', 10, 'Every 10th hit restores 10 Fluff to you and your buddy.');
// [branch beast, tier 3 name and perk, tier 4 name and perk] for branch A then branch B of each type
type BranchSpec = [BeastId, string, Perk, string, Perk];
const TREES: Record<WeaponType, { t2: string; A: BranchSpec; B: BranchSpec; glimmer: string }> = {
  hammer: {
    t2: 'Iron-band Hammer', glimmer: 'Glimmer Hammer',
    A: ['bristleback', 'Bristle Basher', perk('charge-speed', 0.2, 'Big Swing charges 20% faster.'), 'Tuskquake Hammer', perk('shockwave', 1, 'A level-3 Big Swing sends out a short shockwave.')],
    B: ['puffwart', 'Puffball Pounder', perk('sleepy-puff', 5, 'Hits leave a sleepy puff: +5 Dizzy over time.'), 'Snoozecloud Hammer', perk('long-dizzy', 1.5, 'A level-3 hit on a dizzy beast keeps it dizzy 1.5 s longer.')],
  },
  bow: {
    t2: 'Twine Bow', glimmer: 'Glimmer Bow',
    A: ['skreel', 'Feather Flight', perk('seed-speed', 0.3, 'Seeds fly 30% faster.'), 'Galeseed Bow', perk('pierce', 1, 'Level-3 shots go straight through.')],
    B: ['puffwart', 'Sticky Reed', perk('sticky-longer', 0.4, 'Sticky seeds slow 40% longer.'), 'Bogroot Bow', perk('root', 2, 'Three sticky hits hold the beast in place for 2 s.')],
  },
  claws: {
    t2: 'Pebble Claws', glimmer: 'Glimmer Claws',
    A: ['hornclack', 'Shell Snips', perk('shell-bonk', 0.2, '+20% Bonk on shell parts.'), 'Plateclack Claws', perk('zoom-behind', 1, 'Zoomies doesn\'t drain while you hit from behind.')],
    B: ['skreel', 'Down Dusters', perk('move-speed', 0.15, '+15% move speed.'), 'Skydown Claws', perk('roll-refill', 1, 'Rolling through an attack refills the Zoom meter.')],
  },
  lance: {
    t2: 'Bramble Lance', glimmer: 'Glimmer Lance',
    A: ['hornclack', 'Horncap Lance', perk('free-guard', 0.5, 'Guarding costs no stamina for the first 0.5 s.'), 'Rhinoclack Lance', perk('boop-break', 1, 'A Counter Boop pops a part off at once.')],
    B: ['bristleback', 'Bristle Pike', perk('guard-bonk', 0.1, '+10% Bonk while guarding.'), 'Tusk Pike', perk('reflect-charge', 1, 'Guarding a charge bounces it back and makes the beast dizzy.')],
  },
  wand: {
    t2: 'Reedstraw Wand', glimmer: 'Glimmer Wand',
    A: ['puffwart', 'Frothy Wand', perk('big-bubbles', 0.25, 'Bubbles are 25% bigger.'), 'Puffsac Wand', perk('heal-bubble', 25, 'Heal bubbles restore 25 Fluff.')],
    B: ['skreel', 'Breezy Wand', perk('homing', 1, 'Bubbles drift towards the locked-on beast.'), 'Cyclone Wand', perk('double-burst', 2, 'Bubble Burst hits twice.')],
  },
  yoyo: {
    t2: 'Twine Yo-yo', glimmer: 'Glimmer Yo-yo',
    A: ['bristleback', 'Tusk Spinner', perk('wide-loop', 0.2, 'Loop-the-Loop is 20% wider.'), 'Boarhog Spinner', perk('long-hop', 2, 'A Hop-on lasts 2 s longer.')],
    B: ['hornclack', 'Plate Spinner', perk('shell-dizzy', 25, '+25 Dizzy on shell parts.'), 'Shellstorm Spinner', perk('loop-gather', 1, 'Loop-the-Loop pulls loose materials in.')],
  },
};
/** The commons, part and rare material of each beast, used to price tree nodes and armour. */
export const BEAST_MATS: Record<BeastId, { common: MaterialId; part: MaterialId; rare: MaterialId }> = {
  bristleback: { common: 'bristle-tuft', part: 'tusk-shard', rare: 'curly-tail-tuft' },
  puffwart: { common: 'wart-pebble', part: 'puff-sac', rare: 'cloud-wisp' },
  skreel: { common: 'sky-feather', part: 'sky-feather', rare: 'owl-down' },
  hornclack: { common: 'shell-plate', part: 'horn-chip', rare: 'horn-chip' },
  frostmane: { common: 'frost-fur', part: 'mane-lock', rare: 'glimmer-stone' },
};
/** Merges costs that name the same material twice (the Skreel and Hornclack reuse materials across slots). */
const sum = (...parts: Cost[]): Cost => { const c: Cost = {}; for (const p of parts) for (const [k, v] of Object.entries(p)) c[k as MaterialId] = (c[k as MaterialId] ?? 0) + (v ?? 0); return c; };
/** Tier 2 is paid for with the starter beasts, so it's in reach as soon as the weapon type is. */
const tier2Cost = (type: WeaponType): Cost => (WEAPON_TYPES[type].chapter <= 1 ? { 'bristle-tuft': 3, berry: 2 } : { 'wart-pebble': 3, berry: 2 });

function buildTree(): WeaponNode[] {
  const nodes: WeaponNode[] = [];
  for (const type of Object.keys(TREES) as WeaponType[]) {
    const t = TREES[type], base = WEAPON_TYPES[type];
    nodes.push({ id: `${type}-1`, type, tier: 1, branch: null, name: base.name, from: null, cost: {}, perks: [] });
    nodes.push({ id: `${type}-2`, type, tier: 2, branch: null, name: t.t2, from: `${type}-1`, cost: tier2Cost(type), perks: [] });
    for (const b of ['A', 'B'] as const) {
      const [beast, n3, p3, n4, p4] = t[b], m = BEAST_MATS[beast];
      nodes.push({ id: `${type}-3${b}`, type, tier: 3, branch: b, name: n3, from: `${type}-2`, cost: sum({ [m.common]: 4 }, { [m.part]: 1 }), perks: [p3] });
      nodes.push({ id: `${type}-4${b}`, type, tier: 4, branch: b, name: n4, from: `${type}-3${b}`, cost: sum({ [m.rare]: 3 }, { 'mane-lock': 1, 'glimmer-stone': 1 }), perks: [p3, p4] });
      nodes.push({ id: `${type}-5${b}`, type, tier: 5, branch: b, name: t.glimmer, from: `${type}-4${b}`, cost: { 'frost-fur': 2, 'mane-lock': 2, 'glimmer-stone': 2 }, perks: [p3, p4, WARM_GLOW] });
    }
  }
  return nodes;
}
export const WEAPON_TREE: readonly WeaponNode[] = buildTree();
export const weaponNode = (id: string) => WEAPON_TREE.find((n) => n.id === id);
/** The nodes you could craft next from `ownedId` (one for tiers 1, 3 and 4; two at the tier-2 branch point). */
export const nextNodes = (ownedId: string) => WEAPON_TREE.filter((n) => n.from === ownedId);
/** Bonk and Dizzy for a node, after its tier multiplier, rounded to whole numbers. */
export function weaponStats(id: string) {
  const n = weaponNode(id); if (!n) throw new Error(`no weapon ${id}`);
  const base = WEAPON_TYPES[n.type], k = TIER_MULT[n.tier];
  return { bonk: Math.round(base.bonk * k), dizzy: Math.round(base.dizzy * k), speed: base.speed, perks: n.perks };
}

// ---------- armour ----------
export type Slot = 'helm' | 'vest' | 'boots';
export type ArmourPieceId = `${BeastId}-${Slot}`;
export type Skill = { id: string; name: string; text: string };
export const ARMOUR_SETS: Record<BeastId, { name: string; fluff: number; two: Skill; three: Skill }> = {
  bristleback: { name: 'Bristle', fluff: 10, two: { id: 'steady-paws', name: 'Steady Paws', text: 'Knock-backs push you 40% less.' }, three: { id: 'charge-guard', name: 'Charge Guard', text: 'Charges never knock you down.' } },
  puffwart: { name: 'Puffwart', fluff: 8, two: { id: 'snooze-proof', name: 'Snooze Proof', text: 'Sleepy clouds slow you half as much.' }, three: { id: 'deep-breath', name: 'Deep Breath', text: 'Items are used 50% faster.' } },
  skreel: { name: 'Skreel', fluff: 7, two: { id: 'feather-step', name: 'Feather Step', text: 'The roll dodge window is 30% longer.' }, three: { id: 'updraft', name: 'Updraft', text: 'One free double-jump roll.' } },
  hornclack: { name: 'Hornclack', fluff: 12, two: { id: 'shell-stance', name: 'Shell Stance', text: 'Guarding blocks attacks from the sides too.' }, three: { id: 'hard-head', name: 'Hard Head', text: '+20% Dizzy on head hits.' } },
  frostmane: { name: 'Frostmane', fluff: 10, two: { id: 'frost-fluff', name: 'Frost Fluff', text: 'Regain 1 Fluff every 2 s out of combat.' }, three: { id: 'warm-heart', name: 'Warm Heart', text: 'Once per hunt, getting tuckered out is forgiven: you get back up at 50% Fluff.' } },
};
export const SLOTS: readonly Slot[] = ['helm', 'vest', 'boots'];
/** Each piece: three of its beast's commons and one part (helm, boots) or rare (vest) material. */
export function armourCost(piece: ArmourPieceId): Cost {
  const [beast, slot] = piece.split('-') as [BeastId, Slot], m = BEAST_MATS[beast];
  return sum({ [m.common]: 3 }, { [slot === 'vest' ? m.rare : m.part]: 1 });
}
export type Worn = Partial<Record<Slot, ArmourPieceId>>;
/** Total bonus Fluff and the skills switched on by 2 and 3 pieces of a set. Pieces of different sets mix. */
export function armourBonus(worn: Worn) {
  const counts = new Map<BeastId, number>(); let fluff = 0;
  for (const piece of Object.values(worn)) { if (!piece) continue; const beast = piece.split('-')[0] as BeastId; counts.set(beast, (counts.get(beast) ?? 0) + 1); fluff += ARMOUR_SETS[beast].fluff; }
  const skills: Skill[] = [];
  for (const [beast, n] of counts) { if (n >= 2) skills.push(ARMOUR_SETS[beast].two); if (n >= 3) skills.push(ARMOUR_SETS[beast].three); }
  return { fluff, skills };
}

// ---------- story ----------
export type Speaker = 'mossback' | 'bramble' | 'pip' | 'wren' | 'dora' | 'enzo' | 'narrator';
/** One storybook page: a painted panel (public/art/hunt/<panel>.webp) and at most two short sentences. */
export type Page = { panel: string; speaker: Speaker; text: string };
export type Chapter = {
  id: number; title: string; area: AreaId; beast: BeastId; grump?: number; teaches: string[];
  intro: Page[]; outro: Page[]; unlocks: { weapons?: WeaponType[]; features?: string[] };
  /** Gear the bot checks you can afford before this chapter's hunt, so no chapter needs grinding. */
  ready?: { weaponTier?: Tier; armourPieces?: number };
};
export const STORY: readonly Chapter[] = [
  {
    id: 0, title: 'A Grumpy Morning', area: 'paddock', beast: 'bristleback', grump: 40, teaches: ['move', 'bonk', 'roll', 'lock-on', 'grump-meter', 'nap'],
    intro: [
      { panel: 'story-0a', speaker: 'narrator', text: 'One morning a cold, cranky wind blew down from Frosty Peak.' },
      { panel: 'story-0a', speaker: 'narrator', text: 'Every beast it touched woke up very, very grumpy.' },
      { panel: 'story-0b', speaker: 'mossback', text: 'Dora, Enzo, the little Bristleback in the paddock has the grumps!' },
      { panel: 'story-0b', speaker: 'mossback', text: 'Give it a few gentle bonks until it is ready for a nap.' },
    ],
    outro: [
      { panel: 'story-1-end', speaker: 'enzo', text: 'Look, it is snoring already!' },
      { panel: 'story-0b', speaker: 'mossback', text: 'Well done. Now, where is this grumpy wind coming from?' },
    ],
    unlocks: { weapons: ['hammer', 'bow'], features: ['forge'] },
  },
  {
    id: 1, title: 'The Huffy Hog', area: 'meadow', beast: 'bristleback', teaches: ['telegraphs', 'tree-crash', 'part-breaks', 'materials'],
    intro: [
      { panel: 'story-1', speaker: 'wren', text: 'A big Bristleback is huffing all over Clover Meadow!' },
      { panel: 'story-1', speaker: 'dora', text: 'When it paws the ground, we roll out of the way.' },
    ],
    outro: [
      { panel: 'story-1-end', speaker: 'narrator', text: 'The Bristleback curled up under a tree and dreamed of acorns.' },
      { panel: 'story-1-end', speaker: 'enzo', text: 'The wind smells like snow. It must come from the mountain.' },
    ],
    unlocks: { weapons: ['claws'], features: ['armour'] }, ready: { weaponTier: 1 },
  },
  {
    id: 2, title: 'Snores in Soggy Marsh', area: 'marsh', beast: 'puffwart', teaches: ['items', 'pantry', 'sleepy-cloud', 'snacks'],
    intro: [
      { panel: 'story-2', speaker: 'pip', text: 'Take a snack and some fluffberries before you go!' },
      { panel: 'story-2', speaker: 'enzo', text: 'Do not stand in the sleepy cloud. Yaaawn.' },
    ],
    outro: [{ panel: 'story-2', speaker: 'narrator', text: 'The Puffwart gave one last puff and settled down for a snooze.' }],
    unlocks: { weapons: ['lance'], features: ['pantry', 'snacks'] }, ready: { weaponTier: 2 },
  },
  {
    id: 3, title: 'Swoops over Windy Ridge', area: 'ridge', beast: 'skreel', teaches: ['tracking', 'gathering', 'ranged-openings'],
    intro: [
      { panel: 'story-3', speaker: 'wren', text: 'The Skreel is hiding high on Windy Ridge.' },
      { panel: 'story-3', speaker: 'enzo', text: 'Leave it to my nose. Follow the glowing pawprints!' },
    ],
    outro: [{ panel: 'story-3', speaker: 'narrator', text: 'The Skreel fluffed its feathers and tucked its head in for a nap.' }],
    unlocks: { weapons: ['wand'], features: ['gathering', 'tracking'] }, ready: { weaponTier: 2, armourPieces: 2 },
  },
  {
    id: 4, title: 'The Stubborn Beetle', area: 'hollow', beast: 'hornclack', teaches: ['weak-spots', 'shell-breaks', 'traps'],
    intro: [
      { panel: 'story-4', speaker: 'bramble', text: 'Bonks bounce off that shell. Try its sides and back!' },
      { panel: 'story-4', speaker: 'dora', text: 'And if it sits in sticky sap, it can not turn around.' },
    ],
    outro: [{ panel: 'story-4', speaker: 'narrator', text: 'The Hornclack pulled in its legs and napped like a warm pebble.' }],
    unlocks: { weapons: ['yoyo'], features: ['traps'] }, ready: { weaponTier: 3, armourPieces: 2 },
  },
  {
    id: 5, title: 'The Frosty Peak', area: 'peak', beast: 'frostmane', teaches: [],
    intro: [
      { panel: 'story-5a', speaker: 'narrator', text: 'At the top of the mountain sat Frostmane, beside a cracked, flickering crystal.' },
      { panel: 'story-5a', speaker: 'mossback', text: 'The Glimmer Stone kept the mountain warm. Without it, the wind turns cranky.' },
      { panel: 'story-5a', speaker: 'dora', text: 'Then we calm Frostmane, and Bramble can mend the stone.' },
    ],
    outro: [
      { panel: 'story-5b', speaker: 'bramble', text: 'Tap, tap, tap. Good as new!' },
      { panel: 'story-5b', speaker: 'narrator', text: 'Warm light spread down the mountain, and the wind turned soft and sleepy.' },
      { panel: 'story-end', speaker: 'narrator', text: 'That evening the whole valley had a picnic, and every beast napped in the sun.' },
    ],
    unlocks: { features: ['free-hunt', 'extra-grumpy', 'bounties'] }, ready: { weaponTier: 3, armourPieces: 3 },
  },
];

// ---------- checks ----------
/** When a material, item or weapon type first becomes available, for checking that nothing asks for it too early. */
export function firstChapter(id: MaterialId | ItemId): number {
  return id in MATERIALS ? MATERIALS[id as MaterialId].chapter : ITEMS[id as ItemId].chapter;
}
/**
 * Problems with the content, as readable strings (empty when everything is consistent). A tree node is only
 * reachable once its weapon type is unlocked, and asks for nothing that arrives in a later chapter than its
 * branch beast's chapter (or the Frostmane chapter for tiers 4 and 5).
 */
export function validate(): string[] {
  const out: string[] = [];
  const chapterOf = (b: BeastId) => STORY.filter((c) => c.id > 0).find((c) => c.beast === b)!.id;
  for (const n of WEAPON_TREE) {
    if (n.from && !weaponNode(n.from)) out.push(`${n.id}: parent ${n.from} missing`);
    const branchBeast = n.branch ? TREES[n.type][n.branch][0] : null;
    const by = n.tier >= 4 ? 5 : branchBeast ? Math.max(chapterOf(branchBeast), WEAPON_TYPES[n.type].chapter) : Math.max(WEAPON_TYPES[n.type].chapter, 1);
    for (const id of Object.keys(n.cost) as MaterialId[]) {
      if (!(id in MATERIALS)) out.push(`${n.id}: unknown material ${id}`);
      else if (firstChapter(id) > by) out.push(`${n.id}: needs ${id} (chapter ${firstChapter(id)}) by chapter ${by}`);
    }
  }
  for (const [id, item] of Object.entries(ITEMS)) for (const m of Object.keys(item.recipe) as MaterialId[]) {
    if (!(m in MATERIALS)) out.push(`${id}: unknown material ${m}`);
    else if (firstChapter(m) > item.chapter) out.push(`${id}: needs ${m} (chapter ${firstChapter(m)}) by chapter ${item.chapter}`);
  }
  for (const [id, s] of Object.entries(SNACKS)) for (const m of Object.keys(s.cost) as (MaterialId | ItemId)[]) if (firstChapter(m) > s.chapter) out.push(`${id}: needs ${m} too early`);
  for (const beast of BEAST_ORDER) for (const slot of SLOTS) for (const m of Object.keys(armourCost(`${beast}-${slot}`)) as MaterialId[]) if (!(m in MATERIALS)) out.push(`${beast}-${slot}: unknown ${m}`);
  for (const c of STORY) for (const p of [...c.intro, ...c.outro]) {
    if (p.text.split(/(?<=[.!?])\s+/).length > 2) out.push(`chapter ${c.id}: page has more than two sentences`);
    if (/\b(hurt|kill|die|dead|blood|wound|injur|attack them|defeat)\w*/i.test(p.text)) out.push(`chapter ${c.id}: unkind word in "${p.text}"`);
  }
  return out;
}
