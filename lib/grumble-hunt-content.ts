// Grumble Hunt content: the story chapters, materials, drop tables, Pantry recipes, snacks, the six weapon
// trees and the armour sets from docs/grumble-hunt/expansion-design.md, as plain data plus pure helpers.
// No DOM and no randomness of its own: anything random takes the engine's seeded generator, so a seed
// still replays a run exactly. Nothing here is ever hurt; beasts shed, get dizzy and nap.

export type Rand = () => number;
export type Pouch = Partial<Record<MaterialId | ItemId, number>>;
export type Cost = Partial<Record<MaterialId | ItemId, number>>;

// ---------- beasts and chapters ----------
export type BeastId = 'bristleback' | 'puffwart' | 'skreel' | 'hornclack' | 'frostmane' | 'paddlepaw' | 'rumblesnout';
export type AreaId = 'paddock' | 'meadow' | 'marsh' | 'ridge' | 'hollow' | 'peak';
/** The five story beasts, in chapter order. */
export const BEAST_ORDER: readonly BeastId[] = ['bristleback', 'puffwart', 'skreel', 'hornclack', 'frostmane'];
/** Beasts that arrive after the story, each in an area it shares with a story beast. */
export const POST_GAME_BEASTS: readonly BeastId[] = ['paddlepaw', 'rumblesnout'];
export const POST_GAME_AREA: Partial<Record<BeastId, AreaId>> = { paddlepaw: 'marsh', rumblesnout: 'hollow' };

// ---------- materials ----------
export type Rarity = 'common' | 'part' | 'rare';
export type MaterialId =
  | 'bristle-tuft' | 'tusk-shard' | 'boar-hide' | 'curly-tail-tuft'
  | 'wart-pebble' | 'puff-sac' | 'cloud-wisp' | 'marsh-reed'
  | 'sky-feather' | 'owl-down' | 'shell-plate' | 'horn-chip'
  | 'frost-fur' | 'mane-lock' | 'glimmer-stone' | 'berry'
  | 'otter-fluff' | 'river-stone' | 'river-pearl' | 'stripe-fur' | 'crown-pebble' | 'geode-heart';
/** `chapter` is the first story chapter where the material can be had; `icon` is its cell in icons-materials.webp, or from 16 on in icons-materials-2.webp. */
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
  'otter-fluff': { name: 'Otter fluff', rarity: 'common', chapter: 6, icon: 16 },
  'river-stone': { name: 'Smooth river stone', rarity: 'part', chapter: 6, icon: 17 },
  'river-pearl': { name: 'River pearl', rarity: 'rare', chapter: 6, icon: 18 },
  'stripe-fur': { name: 'Striped fur', rarity: 'common', chapter: 6, icon: 19 },
  'crown-pebble': { name: 'Crown pebble', rarity: 'part', chapter: 6, icon: 20 },
  'geode-heart': { name: 'Geode heart', rarity: 'rare', chapter: 6, icon: 21 },
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
  paddlepaw: { shed: { id: 'otter-fluff', chance: 0.2 }, parts: { pouch: 'river-stone' }, calm: { common: ['otter-fluff', 'otter-fluff', 'river-stone'], count: 3, rare: { id: 'river-pearl', chance: 0.3 } } },
  rumblesnout: { shed: { id: 'stripe-fur', chance: 0.2 }, parts: { crown: 'crown-pebble' }, calm: { common: ['stripe-fur', 'stripe-fur', 'crown-pebble'], count: 3, rare: { id: 'geode-heart', chance: 0.3 } } },
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
export function rollCalm(r: Rand, beast: BeastId, brokenParts: readonly string[] = [], bonusRareRolls = 0, rareMultiplier = 1): MaterialId[] {
  const d = DROPS[beast], got: MaterialId[] = [];
  for (let i = 0; i < d.calm.count; i++) got.push(d.calm.common[Math.floor(r() * d.calm.common.length)]);
  for (let i = 0; i <= bonusRareRolls; i++) if (r() < Math.min(1, d.calm.rare.chance * rareMultiplier)) got.push(d.calm.rare.id);
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
export type WeaponType =
  | 'greatsword' | 'katana' | 'sword' | 'claws' | 'hammer' | 'horn' | 'lance'
  | 'gunlance' | 'switchaxe' | 'chargeblade' | 'glaive' | 'lightbow' | 'heavybow' | 'bow'
  | 'wand' | 'yoyo' | 'feather' | 'puffer' | 'pogo' | 'umbrella';
/**
 * The basic weapons you choose from at the start, in the weapon-select order: one for each of Monster Hunter
 * Wilds' fourteen types (see MH_EQUIVALENT). The Bubble Wand and Pinecone Yo-yo are Grumble Hunt's own,
 * unlocked in the story.
 */
export const BASIC_WEAPONS: readonly WeaponType[] = ['greatsword', 'katana', 'sword', 'claws', 'hammer', 'horn', 'lance', 'gunlance', 'switchaxe', 'chargeblade', 'glaive', 'lightbow', 'heavybow', 'bow'];
/** Which Monster Hunter weapon type each one plays like. */
export const MH_EQUIVALENT: Partial<Record<WeaponType, string>> = {
  greatsword: 'Great Sword', katana: 'Long Sword', sword: 'Sword & Shield', claws: 'Dual Blades', hammer: 'Hammer', horn: 'Hunting Horn', lance: 'Lance',
  gunlance: 'Gunlance', switchaxe: 'Switch Axe', chargeblade: 'Charge Blade', glaive: 'Insect Glaive', lightbow: 'Light Bowgun', heavybow: 'Heavy Bowgun', bow: 'Bow',
};
/** Marked "Good first pick" on the weapon-select screen: easy to play well straight away. */
export const FIRST_PICKS: readonly WeaponType[] = ['sword', 'hammer', 'bow'];
export type Speed = 'slow' | 'medium' | 'fast';
/** Tier-1 stats. `bonk` lowers Grump, `dizzy` builds the dizzy meter. `chapter` is when the type is first unlocked. */
export const WEAPON_TYPES: Record<WeaponType, { name: string; bonk: number; dizzy: number; speed: Speed; signature: string; chapter: number }> = {
  hammer: { name: 'Acorn Hammer', bonk: 12, dizzy: 14, speed: 'slow', signature: 'Big Swing: hold to charge three levels (×1, ×1.6, ×2.4); a level-3 head hit adds 25 Dizzy.', chapter: 0 },
  bow: { name: 'Seed Bow', bonk: 6, dizzy: 3, speed: 'medium', signature: 'Charged Shot: hold for one, two or three seeds; switch between plain, sticky and pop seeds.', chapter: 0 },
  greatsword: { name: 'Driftwood Greatsword', bonk: 15, dizzy: 6, speed: 'slow', signature: 'Big Finish: charge, shoulder tackle, then a giant overhead swing (×3 Bonk); Blade Guard blocks with the flat of the blade.', chapter: 0 },
  sword: { name: 'Twig Sword and Acorn Shield', bonk: 5, dizzy: 5, speed: 'fast', signature: 'Shield Bash (+10 Dizzy) and a Leap Slash; items can be used without putting the sword away.', chapter: 0 },
  katana: { name: 'Bamboo Katana', bonk: 7, dizzy: 3, speed: 'medium', signature: 'Focus: hits fill a meter spent on a Focus Spin (×2 Bonk); a well-timed Swish Counter slips through an attack and hits back.', chapter: 0 },
  claws: { name: 'Twin Claws', bonk: 4, dizzy: 3, speed: 'fast', signature: 'Zoomies: move and attack 30% faster while the Zoom meter lasts; hits refill it.', chapter: 0 },
  lance: { name: 'Thistle Lance', bonk: 9, dizzy: 6, speed: 'medium', signature: 'Guard: hold to block from the front; let go as an attack lands for a Counter Boop (×2 Bonk, +15 Dizzy).', chapter: 0 },
  horn: { name: 'Gourd Horn', bonk: 9, dizzy: 12, speed: 'medium', signature: 'Songs: hits play notes, and K plays the song they make: Speedy (+15% speed), Sturdy (knock-backs push 50% less) or Sleepy (the beast slows 20%). Songs reach your buddy too.', chapter: 0 },
  gunlance: { name: 'Puffcap Lance', bonk: 8, dizzy: 5, speed: 'medium', signature: 'Poof Shots: the puffball tip pops gusts of air that bonk through shells; hold K for a Big Poof (5 s to puff up again). Guards like the Thistle Lance.', chapter: 0 },
  switchaxe: { name: 'Switch Spade', bonk: 10, dizzy: 6, speed: 'medium', signature: 'Switch: K flips between Spade mode (long reach) and Bloom mode (fast, fills the Bloom meter); a full meter unlocks a Bloom Burst finisher (×2.5 Bonk).', chapter: 0 },
  chargeblade: { name: 'Seedpod Blade', bonk: 8, dizzy: 6, speed: 'medium', signature: 'Seedpods: sword hits fill seedpods in the shield; K snaps sword and shield into a Bloom Axe whose swings pop them for bonus Bonk. Guard in sword mode.', chapter: 0 },
  glaive: { name: 'Firefly Staff', bonk: 6, dizzy: 4, speed: 'fast', signature: 'Firefly: K sends your firefly to the beast for a glow (red: +15% Bonk, white: +15% speed, orange: knock-backs push less; all three last twice as long). Hold J to vault for bonks from the air.', chapter: 0 },
  lightbow: { name: 'Acorn Slingshot', bonk: 4, dizzy: 2, speed: 'fast', signature: 'Rapid shots on the move; K swaps ammo (acorns, sticky sap, pop seeds), and rolling reloads.', chapter: 0 },
  heavybow: { name: 'Pumpkin Popper', bonk: 11, dizzy: 5, speed: 'slow', signature: 'Plant your paws and lob big puffballs (×2 Bonk); hold K for a Popcorn Flurry of tiny pops while you stand still; guard with the pumpkin shell.', chapter: 0 },
  wand: { name: 'Bubble Wand', bonk: 5, dizzy: 4, speed: 'medium', signature: 'Bubble Burst: a slow bubble that pops for an area hit, lifts loose materials and heals your buddy 15 Fluff.', chapter: 3 },
  yoyo: { name: 'Pinecone Yo-yo', bonk: 7, dizzy: 5, speed: 'medium', signature: 'Loop-the-Loop: spin all around you; on a dizzy beast it pulls you up for a Hop-on.', chapter: 4 },
  feather: { name: 'Tickle Feather', bonk: 3, dizzy: 6, speed: 'fast', signature: 'Giggle: hits fill a meter; full makes a 3 s giggle-dizzy. Tap K for a double-tickle flurry.', chapter: 6 },
  puffer: { name: 'Dandelion Puffer', bonk: 4, dizzy: 7, speed: 'medium', signature: 'J puffs a 3.5-unit, 60° cone; fluff adds 2 Dizzy/s for 3 s. Hold K then release for Big Breath: +15 Dizzy, 2.5-unit push, 6 s recharge.', chapter: 6 },
  pogo: { name: 'Pogo Spring', bonk: 8, dizzy: 5, speed: 'medium', signature: 'J hop-bonks forward. Hold K then release for a 0.8 s High Bounce, reaching flying Skreel or a Hop-on beside a dizzy beast.', chapter: 6 },
  umbrella: { name: 'Leaf Umbrella', bonk: 6, dizzy: 5, speed: 'medium', signature: 'Hold K to guard all around at half walking speed. Tap J while guarding for a radius-3 Raindrop Spin. Hold K in the air to float down slowly.', chapter: 6 },
};
export const POST_GAME_WEAPONS: readonly WeaponType[] = ['feather', 'puffer', 'pogo', 'umbrella'];
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
  greatsword: {
    t2: 'Iron-rim Greatsword', glimmer: 'Glimmer Greatsword',
    A: ['bristleback', 'Tuskedge Greatsword', perk('part-power', 0.2, '+20% part-break power.'), 'Boarking Greatsword', perk('finish-break', 1, 'Big Finish pops a part off at once.')],
    B: ['hornclack', 'Shellslab Greatsword', perk('side-guard', 1, 'Blade Guard blocks attacks from the sides too.'), 'Bulwark Greatsword', perk('guard-dizzy', 20, 'Blocking just as an attack lands adds 20 Dizzy to the beast.')],
  },
  sword: {
    t2: 'Oakleaf Sword', glimmer: 'Glimmer Sword',
    A: ['bristleback', 'Bristle Sprig', perk('bash-dizzy', 0.5, 'Shield Bash adds 50% more Dizzy.'), 'Hogback Sword', perk('bash-break', 1, 'A Shield Bash on a dizzy beast pops a part off.')],
    B: ['skreel', 'Feather Sprig', perk('quick-items', 0.3, 'Items are used 30% faster with the sword out.'), 'Skylark Sword', perk('leap-power', 0.5, 'Leap Slash does 50% more Bonk.')],
  },
  katana: {
    t2: 'Ringed Bamboo Katana', glimmer: 'Glimmer Katana',
    A: ['skreel', 'Featheredge Katana', perk('focus-fill', 0.25, 'Focus fills 25% faster.'), 'Galewind Katana', perk('counter-focus', 1, 'A Swish Counter fills Focus all the way.')],
    B: ['puffwart', 'Mistreed Katana', perk('sleepy-spin', 5, 'Focus Spin leaves a sleepy mist: +5 Dizzy over time.'), 'Dreamreed Katana', perk('double-spin', 2, 'Focus Spin hits twice on a dizzy beast.')],
  },
  horn: {
    t2: 'Banded Gourd Horn', glimmer: 'Glimmer Horn',
    A: ['puffwart', 'Snoozy Horn', perk('sleepy-song', 0.3, 'Sleepy Song lasts 30% longer.'), 'Lullaby Horn', perk('lullaby', 20, 'Sleepy Song adds 20 Dizzy to a slowed beast.')],
    B: ['skreel', 'Breezy Horn', perk('speedy-song', 0.1, 'Speedy Song gives 10% more speed.'), 'Skysong Horn', perk('song-heal', 10, 'Every song restores 10 Fluff to you and your buddy.')],
  },
  gunlance: {
    t2: 'Twin-cap Lance', glimmer: 'Glimmer Puffcap',
    A: ['hornclack', 'Shellpop Lance', perk('poof-shell', 0.25, 'Poof Shots do 25% more Bonk on shells.'), 'Clackcannon Lance', perk('poof-cool', 2, 'Big Poof puffs up again 2 s sooner.')],
    B: ['bristleback', 'Huffpuff Lance', perk('poof-dizzy', 5, 'Poof Shots add 5 Dizzy.'), 'Boarpuff Lance', perk('poof-head', 1, 'A Big Poof on the head makes the beast dizzy.')],
  },
  switchaxe: {
    t2: 'Iron Switch Spade', glimmer: 'Glimmer Spade',
    A: ['bristleback', 'Tusk Spade', perk('spade-bonk', 0.15, 'Spade mode does 15% more Bonk.'), 'Rootdigger Spade', perk('switch-hit', 1, 'Switching mid-combo adds a free hit.')],
    B: ['puffwart', 'Puffbloom Spade', perk('bloom-fill', 0.25, 'The Bloom meter fills 25% faster.'), 'Mossbloom Spade', perk('burst-puff', 10, 'Bloom Burst leaves a sleepy puff: +10 Dizzy.')],
  },
  chargeblade: {
    t2: 'Podded Seedblade', glimmer: 'Glimmer Seedblade',
    A: ['hornclack', 'Shellpod Blade', perk('free-first-guard', 1, 'The first guard in a row costs no stamina.'), 'Platepod Blade', perk('guard-pod', 1, 'Guarding just as an attack lands fills a seedpod.')],
    B: ['skreel', 'Featherpod Blade', perk('extra-pod', 1, 'The shield holds one more seedpod.'), 'Galepod Blade', perk('pod-dizzy', 1, 'Popping every seedpod at once makes the beast dizzy.')],
  },
  glaive: {
    t2: 'Lantern Staff', glimmer: 'Glimmer Staff',
    A: ['skreel', 'Featherlight Staff', perk('air-bonk', 0.2, 'Vault higher; bonks from the air do 20% more.'), 'Moonmoth Staff', perk('air-dizzy', 5, 'Bonks from the air add 5 Dizzy.')],
    B: ['puffwart', 'Glowbog Staff', perk('long-glow', 0.3, 'Glows last 30% longer.'), 'Marshglow Staff', perk('glow-heal', 5, 'Your firefly also brings back 5 Fluff.')],
  },
  lightbow: {
    t2: 'Twine Slingshot', glimmer: 'Glimmer Slingshot',
    A: ['skreel', 'Feather Slingshot', perk('far-shot', 0.3, 'Shots fly 30% further.'), 'Gust Slingshot', perk('fifth-shot', 2, 'Every fifth shot is free and does double Bonk.')],
    B: ['puffwart', 'Sap Slingshot', perk('long-sap', 0.4, 'Sticky ammo slows 40% longer.'), 'Bog Slingshot', perk('leg-slow', 0.3, 'Sticky hits on the legs slow the beast 30%.')],
  },
  heavybow: {
    t2: 'Gourd Popper', glimmer: 'Glimmer Popper',
    A: ['hornclack', 'Shellbreak Popper', perk('pop-shell', 0.3, 'Puffballs do 30% more Bonk on shells.'), 'Beetlebomb Popper', perk('flurry-cool', 0.3, 'Popcorn Flurry is ready again 30% sooner.')],
    B: ['bristleback', 'Boarblast Popper', perk('pop-parts', 0.2, 'Puffballs pop parts off 20% sooner.'), 'Tuskthunder Popper', perk('pop-head', 20, 'A puffball on the head adds 20 Dizzy.')],
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
  feather: {
    t2: 'Ribbon Feather', glimmer: 'Glimmer Feather',
    A: ['frostmane', 'Frost Giggles', perk('giggle-fill', 0.25, 'Giggle fills 25% faster.'), 'Snowcurl Feather', perk('giggle-fill', 0.25, 'Giggle fills 25% faster.')],
    B: ['hornclack', 'Shell Tickle', perk('move-speed', 0.05, 'Walk 5% faster.'), 'Clackcurl Feather', perk('move-speed', 0.05, 'Walk 5% faster.')],
  },
  puffer: {
    t2: 'Twine Puffer', glimmer: 'Glimmer Puffer',
    A: ['frostmane', 'Frost Fluff', perk('wide-puff', 0.25, 'The fluff cone is 25% wider.'), 'Snowclock Puffer', perk('wide-puff', 0.25, 'The fluff cone is 25% wider.')],
    B: ['hornclack', 'Shell Breeze', perk('fluff-time', 1, 'Fluff clings 1 s longer.'), 'Clackclock Puffer', perk('fluff-time', 1, 'Fluff clings 1 s longer.')],
  },
  pogo: {
    t2: 'Banded Pogo', glimmer: 'Glimmer Pogo',
    A: ['frostmane', 'Frost Hopper', perk('high-gather', 1, 'Bounce higher and pull loose materials in.'), 'Snowcap Pogo', perk('high-gather', 1, 'Bounce higher and pull loose materials in.')],
    B: ['hornclack', 'Shell Bouncer', perk('move-speed', 0.05, 'Walk 5% faster.'), 'Clackcap Pogo', perk('move-speed', 0.05, 'Walk 5% faster.')],
  },
  umbrella: {
    t2: 'Twine Umbrella', glimmer: 'Glimmer Umbrella',
    A: ['frostmane', 'Frost Parasol', perk('spin-heal', 5, 'Raindrop Spin restores 5 buddy Fluff.'), 'Snowleaf Umbrella', perk('spin-heal', 5, 'Raindrop Spin restores 5 buddy Fluff.')],
    B: ['hornclack', 'Shell Parasol', perk('free-guard', 0.5, 'The first 0.5 s of guard costs no stamina.'), 'Clackleaf Umbrella', perk('free-guard', 0.5, 'The first 0.5 s of guard costs no stamina.')],
  },
};
/** The commons, part and rare material of each beast, used to price tree nodes and armour. */
export const BEAST_MATS: Record<BeastId, { common: MaterialId; part: MaterialId; rare: MaterialId }> = {
  bristleback: { common: 'bristle-tuft', part: 'tusk-shard', rare: 'curly-tail-tuft' },
  puffwart: { common: 'wart-pebble', part: 'puff-sac', rare: 'cloud-wisp' },
  skreel: { common: 'sky-feather', part: 'sky-feather', rare: 'owl-down' },
  hornclack: { common: 'shell-plate', part: 'horn-chip', rare: 'horn-chip' },
  frostmane: { common: 'frost-fur', part: 'mane-lock', rare: 'glimmer-stone' },
  paddlepaw: { common: 'otter-fluff', part: 'river-stone', rare: 'river-pearl' },
  rumblesnout: { common: 'stripe-fur', part: 'crown-pebble', rare: 'geode-heart' },
};
/** Merges costs that name the same material twice (the Skreel and Hornclack reuse materials across slots). */
const sum = (...parts: Cost[]): Cost => { const c: Cost = {}; for (const p of parts) for (const [k, v] of Object.entries(p)) c[k as MaterialId] = (c[k as MaterialId] ?? 0) + (v ?? 0); return c; };
/** Tier 2 is paid for with the starter beasts, so it's in reach as soon as the weapon type is. */
const tier2Cost = (type: WeaponType): Cost => (POST_GAME_WEAPONS.includes(type) ? { 'frost-fur': 3, 'shell-plate': 2, 'bristle-tuft': 2 } : WEAPON_TYPES[type].chapter <= 1 ? { 'bristle-tuft': 3, berry: 2 } : { 'wart-pebble': 3, berry: 2 });

function buildTree(): WeaponNode[] {
  const nodes: WeaponNode[] = [];
  for (const type of Object.keys(TREES) as WeaponType[]) {
    const t = TREES[type], base = WEAPON_TYPES[type];
    nodes.push({ id: `${type}-1`, type, tier: 1, branch: null, name: base.name, from: null, cost: {}, perks: [] });
    nodes.push({ id: `${type}-2`, type, tier: 2, branch: null, name: t.t2, from: `${type}-1`, cost: tier2Cost(type), perks: [] });
    for (const b of ['A', 'B'] as const) {
      const [beast, n3, p3, n4, p4] = t[b], m = BEAST_MATS[beast];
      nodes.push({ id: `${type}-3${b}`, type, tier: 3, branch: b, name: n3, from: `${type}-2`, cost: sum({ [m.common]: 4 }, { [m.part]: 1 }), perks: [p3] });
      nodes.push({ id: `${type}-4${b}`, type, tier: 4, branch: b, name: n4, from: `${type}-3${b}`, cost: sum({ [m.rare]: 3 }, { 'mane-lock': 1, 'glimmer-stone': 1 }), perks: p3.id === p4.id ? [p3] : [p3, p4] });
      nodes.push({ id: `${type}-5${b}`, type, tier: 5, branch: b, name: t.glimmer, from: `${type}-4${b}`, cost: { 'frost-fur': 2, 'mane-lock': 2, 'glimmer-stone': 2 }, perks: p3.id === p4.id ? [p3, WARM_GLOW] : [p3, p4, WARM_GLOW] });
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
/** A set for each beast, and the Mighty set made from Mighty calms. */
export type ArmourSetId = BeastId | 'mighty';
export type ArmourPieceId = `${ArmourSetId}-${Slot}`;
export type Skill = { id: string; name: string; text: string };
export const ARMOUR_SETS: Record<ArmourSetId, { name: string; fluff: number; two: Skill; three: Skill }> = {
  bristleback: { name: 'Bristle', fluff: 10, two: { id: 'steady-paws', name: 'Steady Paws', text: 'Knock-backs push you 40% less.' }, three: { id: 'charge-guard', name: 'Charge Guard', text: 'Charges never knock you down.' } },
  puffwart: { name: 'Puffwart', fluff: 8, two: { id: 'snooze-proof', name: 'Snooze Proof', text: 'Sleepy clouds slow you half as much.' }, three: { id: 'deep-breath', name: 'Deep Breath', text: 'Items are used 50% faster.' } },
  skreel: { name: 'Skreel', fluff: 7, two: { id: 'feather-step', name: 'Feather Step', text: 'The roll dodge window is 30% longer.' }, three: { id: 'updraft', name: 'Updraft', text: 'One free double-jump roll.' } },
  hornclack: { name: 'Hornclack', fluff: 12, two: { id: 'shell-stance', name: 'Shell Stance', text: 'Guarding blocks attacks from the sides too.' }, three: { id: 'hard-head', name: 'Hard Head', text: '+20% Dizzy on head hits.' } },
  mighty: { name: 'Mighty', fluff: 15, two: { id: 'mighty-rhythm', name: 'Mighty Rhythm', text: 'Strings wait 0.9 s for the next swing, and finishers hit 10% harder.' }, three: { id: 'full-fluff', name: 'Full Fluff', text: 'While your Fluff is full, your bonks take 15% more Grump.' } },
  paddlepaw: { name: 'Paddlepaw', fluff: 11, two: { id: 'river-rest', name: 'River Rest', text: 'Fluffberries and big fluffberries heal 25% more.' }, three: { id: 'soft-landing', name: 'Soft Landing', text: 'Bumps take 20% less Fluff.' } },
  rumblesnout: { name: 'Rumblesnout', fluff: 12, two: { id: 'pebble-pouch', name: 'Pebble Pouch', text: 'Start every hunt with 4 more pebbles, and carry up to 16.' }, three: { id: 'dizzy-dig', name: 'Dizzy Dig', text: 'Bonks on a dizzy beast take 10% more Grump.' } },
  frostmane: { name: 'Frostmane', fluff: 10, two: { id: 'frost-fluff', name: 'Frost Fluff', text: 'Regain 1 Fluff every 2 s out of combat.' }, three: { id: 'warm-heart', name: 'Warm Heart', text: 'Once per hunt, getting tuckered out is forgiven: you get back up at 50% Fluff.' } },
};
export const SLOTS: readonly Slot[] = ['helm', 'vest', 'boots'];
/** Each piece: three of its beast's commons and one part (helm, boots) or rare (vest) material. */
/** Each Mighty piece needs its Mighty quests finished at least once, 4 quest stars and rare materials. */
export const MIGHTY_ARMOUR: Record<Slot, { quests: string[]; stars: number; cost: Cost }> = {
  helm: { quests: ['mighty-bristleback', 'mighty-puffwart'], stars: 4, cost: { 'curly-tail-tuft': 2, 'cloud-wisp': 2, 'tusk-shard': 2 } },
  vest: { quests: ['mighty-skreel', 'mighty-hornclack'], stars: 4, cost: { 'owl-down': 2, 'shell-plate': 3, 'horn-chip': 3 } },
  boots: { quests: ['mighty-frostmane'], stars: 4, cost: { 'glimmer-stone': 2, 'mane-lock': 3, 'frost-fur': 3 } },
};
export function armourCost(piece: ArmourPieceId): Cost {
  const [beast, slot] = piece.split('-') as [ArmourSetId, Slot];
  if (beast === 'mighty') return MIGHTY_ARMOUR[slot].cost;
  const m = BEAST_MATS[beast];
  return sum({ [m.common]: 3 }, { [slot === 'vest' ? m.rare : m.part]: 1 });
}
export type Worn = Partial<Record<Slot, ArmourPieceId>>;
/** Total bonus Fluff and the skills switched on by 2 and 3 pieces of a set. Pieces of different sets mix. */
export function armourBonus(worn: Worn) {
  const counts = new Map<ArmourSetId, number>(); let fluff = 0;
  for (const piece of Object.values(worn)) { if (!piece) continue; const beast = piece.split('-')[0] as ArmourSetId; counts.set(beast, (counts.get(beast) ?? 0) + 1); fluff += ARMOUR_SETS[beast].fluff; }
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
    unlocks: { weapons: [...BASIC_WEAPONS], features: ['forge', 'weapon-choice'] },
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
    unlocks: { features: ['armour'] }, ready: { weaponTier: 1 },
  },
  {
    id: 2, title: 'Snores in Soggy Marsh', area: 'marsh', beast: 'puffwart', teaches: ['items', 'pantry', 'sleepy-cloud', 'snacks'],
    intro: [
      { panel: 'story-2', speaker: 'pip', text: 'Take a snack and some fluffberries before you go!' },
      { panel: 'story-2', speaker: 'enzo', text: 'Do not stand in the sleepy cloud. Yaaawn.' },
    ],
    outro: [{ panel: 'story-2', speaker: 'narrator', text: 'The Puffwart gave one last puff and settled down for a snooze.' }],
    unlocks: { features: ['pantry', 'snacks'] }, ready: { weaponTier: 2 },
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

/** After the ending: the two post-game beasts come down to the valley. Plays once, the first time the hunt board opens after the story. */
export const EPILOGUE: Page[] = [
  { panel: 'story-6', speaker: 'wren', text: 'Two new friends have come down to the valley!' },
  { panel: 'story-6', speaker: 'mossback', text: 'Paddlepaw slides in from the stream. Rumblesnout digs up through Pebble Hollow.' },
  { panel: 'story-6', speaker: 'enzo', text: 'They look a little grumpy. Shall we help them find a nap?' },
];
/** After the Best of Friends quest: the two river friends nap together, and Dora and Enzo get a ribbon. */
export const FINALE: Page[] = [
  { panel: 'story-7', speaker: 'narrator', text: 'As the sun sets, Paddlepaw curls up beside Rumblesnout. Its paddle tail makes a cosy blanket.' },
  { panel: 'story-7', speaker: 'pip', text: 'Look, they wove you something from river reeds and pebbles!' },
  { panel: 'story-7', speaker: 'dora', text: 'A Best of Friends ribbon. We will keep it forever!' },
];
/** A story scene by id: `<chapter>-intro`, `<chapter>-outro`, `epilogue` or `finale`. */
export function storyScene(id: string): { title: string; pages: Page[]; beast: BeastId | null } {
  if (id === 'epilogue') return { title: 'New Friends', pages: EPILOGUE, beast: null };
  if (id === 'finale') return { title: 'Best of Friends', pages: FINALE, beast: null };
  const [chapter, kind] = id.split('-'), c = STORY[Number(chapter)];
  return { title: c.title, pages: kind === 'intro' ? c.intro : c.outro, beast: c.beast };
}

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
  for (const beast of [...BEAST_ORDER, ...POST_GAME_BEASTS]) for (const slot of SLOTS) for (const m of Object.keys(armourCost(`${beast}-${slot}`)) as MaterialId[]) if (!(m in MATERIALS)) out.push(`${beast}-${slot}: unknown ${m}`);
  for (const c of [...STORY, { id: 'epilogue', intro: EPILOGUE, outro: FINALE }]) for (const p of [...c.intro, ...c.outro]) {
    if (p.text.split(/(?<=[.!?])\s+/).length > 2) out.push(`chapter ${c.id}: page has more than two sentences`);
    if (/\b(hurt|kill|die|dead|blood|wound|injur|attack them|defeat)\w*/i.test(p.text)) out.push(`chapter ${c.id}: unkind word in "${p.text}"`);
  }
  return out;
}
