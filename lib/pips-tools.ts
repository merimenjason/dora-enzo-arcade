// Lucky Pips · the data: every tool, foe, charm and mystery tent. No rules live here beyond each tool's own
// one-line effect, which is a pure function of the dice placed in it; lib/pips-game.ts applies the effects.

export type Who = 'dora' | 'enzo' | 'any';
/** What a tool's slot accepts. Multi-die needs (pair, triple, run, seven) fill one die at a time. */
export type Need =
  | { k: 'any' } | { k: 'max'; n: number } | { k: 'min'; n: number } | { k: 'even' } | { k: 'odd' }
  | { k: 'is'; n: number[] } | { k: 'pair' } | { k: 'triple' } | { k: 'run' } | { k: 'seven' } | { k: 'count'; n: number };
/** What a tool does once its slot is full. Dice made by a tool (split, flip, copy...) land back in the tray. */
export type Fx = {
  dmg?: number; dmgAll?: number; pierce?: boolean; block?: number; heal?: number; thorns?: number;
  poison?: number; poisonAll?: number; burn?: number; stun?: boolean; cleanse?: boolean; unstick?: boolean;
  dice?: number[]; roll?: number; acorns?: number; selfDmg?: number;
};
export type ToolDef = {
  id: string; name: string; who: Who; rarity: 1 | 2 | 3;
  need: Need; needUp?: Need;
  /** uses per turn (99 means as often as you like); 0 means once per battle */
  uses: number; usesUp?: number;
  text: string; textUp: string;
  fx: (v: number[], up: boolean) => Fx;
  glyph: string;      // the icon the scene draws for it
  /** in the starting pool, or unlocked by an achievement */
  unlock?: 'meadow' | 'midway' | 'win' | 'foggy';
};
const sum = (v: number[]) => v.reduce((a, b) => a + b, 0);

export const TOOLS: ToolDef[] = [
  // the starting kits
  { id: 'sling', name: 'Pinecone Sling', who: 'any', rarity: 1, need: { k: 'any' }, uses: 1, text: 'Any die: deal that much.', textUp: 'Any die: deal that +2.', fx: (v, u) => ({ dmg: v[0] + (u ? 2 : 0) }), glyph: 'sling' },
  { id: 'shield', name: 'Twig Shield', who: 'any', rarity: 1, need: { k: 'even' }, needUp: { k: 'any' }, uses: 1, text: 'Even die: block that +1.', textUp: 'Any die: block that +1.', fx: v => ({ block: v[0] + 1 }), glyph: 'shield' },
  { id: 'splitter', name: 'Acorn Splitter', who: 'dora', rarity: 1, need: { k: 'min', n: 2 }, uses: 1, usesUp: 2, text: 'Split a die into two that add up to it.', textUp: 'Split a die in two. Twice a turn.', fx: v => ({ dice: [Math.ceil(v[0] / 2), Math.floor(v[0] / 2)] }), glyph: 'acorn' },
  { id: 'clover', name: 'Lucky Clover', who: 'dora', rarity: 1, need: { k: 'is', n: [6] }, needUp: { k: 'min', n: 5 }, uses: 1, text: 'A 6: deal 6, heal 2 and roll a new die.', textUp: 'A 5 or 6: deal it, heal 2 and roll a new die.', fx: v => ({ dmg: v[0], heal: 2, roll: 1 }), glyph: 'clover' },
  { id: 'honey', name: 'Honey Pot', who: 'enzo', rarity: 1, need: { k: 'max', n: 3 }, needUp: { k: 'max', n: 4 }, uses: 1, text: 'Up to 3: deal it ×3.', textUp: 'Up to 4: deal it ×3.', fx: v => ({ dmg: v[0] * 3 }), glyph: 'honey' },
  { id: 'mallet', name: 'Oak Mallet', who: 'enzo', rarity: 1, need: { k: 'min', n: 5 }, needUp: { k: 'min', n: 4 }, uses: 1, text: '5 or more: deal it ×2.', textUp: '4 or more: deal it ×2.', fx: v => ({ dmg: v[0] * 2 }), glyph: 'mallet' },
  { id: 'rattle', name: 'Twin Rattle', who: 'any', rarity: 1, need: { k: 'pair' }, uses: 1, text: 'Two of a kind: deal double their total.', textUp: 'Two of a kind: deal double their total +4.', fx: (v, u) => ({ dmg: sum(v) * 2 + (u ? 4 : 0) }), glyph: 'rattle' },
  { id: 'top', name: 'Spinning Top', who: 'any', rarity: 1, need: { k: 'any' }, uses: 1, usesUp: 2, text: 'Flip a die over (7 minus it).', textUp: 'Flip a die over. Twice a turn.', fx: v => ({ dice: [7 - v[0]] }), glyph: 'top' },
  // the common pool
  { id: 'path', name: 'Straight Path', who: 'any', rarity: 2, need: { k: 'run' }, uses: 1, text: 'A run of three (like 2-3-4): stun and deal 6.', textUp: 'A run of three: stun and deal 12.', fx: (_, u) => ({ stun: true, dmg: u ? 12 : 6 }), glyph: 'path' },
  { id: 'pebble', name: 'Pebble Toss', who: 'any', rarity: 1, need: { k: 'max', n: 2 }, uses: 2, text: 'Up to 2: deal 5. Twice a turn.', textUp: 'Up to 2: deal 7. Twice a turn.', fx: (_, u) => ({ dmg: u ? 7 : 5 }), glyph: 'pebble' },
  { id: 'nettle', name: 'Nettle Sting', who: 'dora', rarity: 1, need: { k: 'any' }, uses: 1, text: 'Any die: poison half of it (round up).', textUp: 'Any die: poison that much.', fx: (v, u) => ({ poison: u ? v[0] : Math.ceil(v[0] / 2) }), glyph: 'nettle' },
  { id: 'ember', name: 'Ember Lantern', who: 'any', rarity: 2, need: { k: 'min', n: 3 }, needUp: { k: 'any' }, uses: 1, text: '3 or more: burn that much.', textUp: 'Any die: burn that +1.', fx: (v, u) => ({ burn: v[0] + (u ? 1 : 0) }), glyph: 'lantern' },
  { id: 'tea', name: 'Mint Tea', who: 'dora', rarity: 1, need: { k: 'any' }, uses: 1, text: 'Any die: heal 2 and wash off poison, burn and frost.', textUp: 'Any die: heal 4 and wash off poison, burn and frost.', fx: (_, u) => ({ heal: u ? 4 : 2, cleanse: true }), glyph: 'tea' },
  { id: 'bell', name: 'Bell Ringer', who: 'any', rarity: 1, need: { k: 'is', n: [1] }, needUp: { k: 'max', n: 2 }, uses: 1, text: 'A 1: roll two new dice.', textUp: 'Up to 2: roll two new dice.', fx: () => ({ roll: 2 }), glyph: 'bell' },
  { id: 'seeds', name: 'Seed Pouch', who: 'dora', rarity: 1, need: { k: 'max', n: 2 }, needUp: { k: 'max', n: 3 }, uses: 1, text: 'Up to 2: roll a new die.', textUp: 'Up to 3: roll a new die.', fx: () => ({ roll: 1 }), glyph: 'seeds' },
  { id: 'hammer', name: 'Hazel Hammer', who: 'enzo', rarity: 1, need: { k: 'any' }, uses: 1, text: 'Any die: smash through block and deal that much.', textUp: 'Any die: smash through block and deal that +3.', fx: (v, u) => ({ dmg: v[0] + (u ? 3 : 0), pierce: true }), glyph: 'hammer' },
  { id: 'wall', name: 'Burrow Wall', who: 'enzo', rarity: 1, need: { k: 'min', n: 4 }, needUp: { k: 'min', n: 3 }, uses: 1, text: '4 or more: block it ×2.', textUp: '3 or more: block it ×2.', fx: v => ({ block: v[0] * 2 }), glyph: 'wall' },
  { id: 'hay', name: 'Hay Bale', who: 'enzo', rarity: 1, need: { k: 'any' }, uses: 99, text: 'Any die: block 2. As often as you like.', textUp: 'Any die: block 3. As often as you like.', fx: (_, u) => ({ block: u ? 3 : 2 }), glyph: 'hay' },
  { id: 'wish', name: 'Wishbone', who: 'dora', rarity: 1, need: { k: 'any' }, uses: 2, usesUp: 3, text: 'Re-roll a die. Twice a turn.', textUp: 'Re-roll a die. Three times a turn.', fx: () => ({ roll: 1 }), glyph: 'wish' },
  { id: 'vane', name: 'Weathervane', who: 'any', rarity: 1, need: { k: 'max', n: 5 }, uses: 2, usesUp: 3, text: 'Up to 5: turn it up by 1. Twice a turn.', textUp: 'Up to 5: turn it up by 1. Three times a turn.', fx: v => ({ dice: [v[0] + 1] }), glyph: 'vane' },
  { id: 'mill', name: 'Mill Wheel', who: 'any', rarity: 1, need: { k: 'min', n: 2 }, uses: 2, usesUp: 3, text: '2 or more: turn it down by 1. Twice a turn.', textUp: '2 or more: turn it down by 1. Three times a turn.', fx: v => ({ dice: [v[0] - 1] }), glyph: 'mill' },
  { id: 'kettle', name: 'Copper Kettle', who: 'any', rarity: 2, need: { k: 'is', n: [6] }, uses: 1, text: 'A 6: deal 10 and burn 3.', textUp: 'A 6: deal 14 and burn 4.', fx: (_, u) => ({ dmg: u ? 14 : 10, burn: u ? 4 : 3 }), glyph: 'kettle' },
  { id: 'lanterns', name: 'Twin Lanterns', who: 'enzo', rarity: 2, need: { k: 'pair' }, uses: 1, text: 'Two of a kind: block their total +4.', textUp: 'Two of a kind: block their total +8.', fx: (v, u) => ({ block: sum(v) + (u ? 8 : 4) }), glyph: 'lanterns' },
  { id: 'toffee', name: 'Triple Toffee', who: 'any', rarity: 3, need: { k: 'triple' }, uses: 1, text: 'Three of a kind: deal double their total +6.', textUp: 'Three of a kind: deal double their total +12.', fx: (v, u) => ({ dmg: sum(v) * 2 + (u ? 12 : 6) }), glyph: 'toffee' },
  { id: 'mirror', name: 'Mirror Pond', who: 'dora', rarity: 2, need: { k: 'max', n: 4 }, needUp: { k: 'any' }, uses: 1, text: 'Up to 4: it comes back with a twin.', textUp: 'Any die: it comes back with a twin.', fx: v => ({ dice: [v[0], v[0]] }), glyph: 'mirror' },
  { id: 'quill', name: 'Quill Dart', who: 'any', rarity: 1, need: { k: 'odd' }, uses: 2, text: 'Odd die: deal that much. Twice a turn.', textUp: 'Odd die: deal that +2. Twice a turn.', fx: (v, u) => ({ dmg: v[0] + (u ? 2 : 0) }), glyph: 'quill' },
  { id: 'scales', name: 'Balance Beam', who: 'any', rarity: 1, need: { k: 'even' }, uses: 2, text: 'Even die: deal that much. Twice a turn.', textUp: 'Even die: deal that +2. Twice a turn.', fx: (v, u) => ({ dmg: v[0] + (u ? 2 : 0) }), glyph: 'scales' },
  { id: 'jam', name: 'Rosehip Jam', who: 'dora', rarity: 1, need: { k: 'max', n: 3 }, needUp: { k: 'max', n: 4 }, uses: 1, text: 'Up to 3: heal that much.', textUp: 'Up to 4: heal that +1.', fx: (v, u) => ({ heal: v[0] + (u ? 1 : 0) }), glyph: 'jam' },
  { id: 'sunflower', name: 'Sunflower', who: 'dora', rarity: 2, need: { k: 'min', n: 5 }, needUp: { k: 'min', n: 4 }, uses: 1, text: '5 or more: deal that much and heal 2.', textUp: '4 or more: deal that much and heal 3.', fx: (v, u) => ({ dmg: v[0], heal: u ? 3 : 2 }), glyph: 'sun' },
  { id: 'drum', name: 'Thunder Drum', who: 'enzo', rarity: 2, need: { k: 'is', n: [6] }, needUp: { k: 'min', n: 5 }, uses: 0, text: 'A 6: stun. Once a battle.', textUp: 'A 5 or 6: stun. Once a battle.', fx: () => ({ stun: true }), glyph: 'drum' },
  { id: 'seven', name: 'Lucky Seven', who: 'any', rarity: 2, need: { k: 'seven' }, uses: 1, text: 'Two dice that add up to 7: deal 15.', textUp: 'Two dice that add up to 7: deal 20.', fx: (_, u) => ({ dmg: u ? 20 : 15 }), glyph: 'seven' },
  { id: 'sparkler', name: 'Sparkler Fan', who: 'any', rarity: 2, need: { k: 'min', n: 3 }, uses: 1, text: '3 or more: deal that much to every foe.', textUp: '3 or more: deal that +2 to every foe.', fx: (v, u) => ({ dmgAll: v[0] + (u ? 2 : 0) }), glyph: 'sparkler' },
  { id: 'bees', name: 'Honeybee Hive', who: 'dora', rarity: 2, need: { k: 'any' }, uses: 1, text: 'Any die: poison every foe 2.', textUp: 'Any die: poison every foe 4.', fx: (_, u) => ({ poisonAll: u ? 4 : 2 }), glyph: 'bees' },
  { id: 'kindling', name: 'Kindling', who: 'any', rarity: 1, need: { k: 'odd' }, uses: 1, text: 'Odd die: burn that +1.', textUp: 'Odd die: burn that +3.', fx: (v, u) => ({ burn: v[0] + (u ? 3 : 1) }), glyph: 'kindling' },
  { id: 'horseshoe', name: 'Old Horseshoe', who: 'dora', rarity: 1, need: { k: 'is', n: [1] }, needUp: { k: 'max', n: 2 }, uses: 1, text: 'A 1: deal 7 and heal 2.', textUp: 'Up to 2: deal 9 and heal 2.', fx: (_, u) => ({ dmg: u ? 9 : 7, heal: 2 }), glyph: 'horseshoe' },
  { id: 'bramble', name: 'Bramble Fence', who: 'enzo', rarity: 2, need: { k: 'any' }, uses: 1, text: 'Any die: block that and prick 2 back each hit.', textUp: 'Any die: block that +2 and prick 4 back each hit.', fx: (v, u) => ({ block: v[0] + (u ? 2 : 0), thorns: u ? 4 : 2 }), glyph: 'bramble' },
  { id: 'duster', name: 'Feather Duster', who: 'any', rarity: 1, need: { k: 'any' }, uses: 1, text: 'Any die: unstick your dice and tools, block 4.', textUp: 'Any die: unstick your dice and tools, block 7.', fx: (_, u) => ({ unstick: true, block: u ? 7 : 4 }), glyph: 'duster' },
  // countdown tools: feed them dice over a battle until the counter runs out
  { id: 'cannon', name: 'Chestnut Cannon', who: 'enzo', rarity: 2, need: { k: 'count', n: 15 }, uses: 99, text: 'Feed it 15 pips over the battle: deal 24.', textUp: 'Feed it 15 pips: deal 32.', fx: (_, u) => ({ dmg: u ? 32 : 24 }), glyph: 'cannon' },
  { id: 'barrel', name: 'Rain Barrel', who: 'dora', rarity: 2, need: { k: 'count', n: 10 }, uses: 99, text: 'Feed it 10 pips over the battle: heal 7.', textUp: 'Feed it 10 pips: heal 11.', fx: (_, u) => ({ heal: u ? 11 : 7 }), glyph: 'barrel' },
  { id: 'piggy', name: 'Acorn Bank', who: 'any', rarity: 2, need: { k: 'count', n: 14 }, uses: 99, text: 'Feed it 14 pips: deal 14 and find 10 acorns.', textUp: 'Feed it 14 pips: deal 20 and find 15 acorns.', fx: (_, u) => ({ dmg: u ? 20 : 14, acorns: u ? 15 : 10 }), glyph: 'piggy' },
  { id: 'woodpile', name: 'Woodpile', who: 'enzo', rarity: 2, need: { k: 'count', n: 12 }, uses: 99, text: 'Feed it 12 pips: block 18.', textUp: 'Feed it 12 pips: block 26.', fx: (_, u) => ({ block: u ? 26 : 18 }), glyph: 'woodpile' },
  // unlocked between runs
  { id: 'firework', name: 'Big Firework', who: 'any', rarity: 3, need: { k: 'is', n: [6] }, uses: 1, text: 'A 6: deal 8 to every foe and burn them 3.', textUp: 'A 6: deal 12 to every foe and burn them 4.', fx: (_, u) => ({ dmgAll: u ? 12 : 8, burn: u ? 4 : 3 }), glyph: 'firework', unlock: 'meadow' },
  { id: 'caramel', name: 'Caramel Apple', who: 'dora', rarity: 2, need: { k: 'pair' }, uses: 1, text: 'Two of a kind: heal their total.', textUp: 'Two of a kind: heal their total +3.', fx: (v, u) => ({ heal: sum(v) + (u ? 3 : 0) }), glyph: 'apple', unlock: 'meadow' },
  { id: 'anvil', name: 'Cobbler’s Anvil', who: 'enzo', rarity: 3, need: { k: 'triple' }, uses: 1, text: 'Three of a kind: block 20 and deal their total.', textUp: 'Three of a kind: block 28 and deal double their total.', fx: (v, u) => ({ block: u ? 28 : 20, dmg: sum(v) * (u ? 2 : 1) }), glyph: 'anvil', unlock: 'midway' },
  { id: 'kite', name: 'Paper Kite', who: 'any', rarity: 2, need: { k: 'run' }, uses: 1, text: 'A run of three: roll three new dice.', textUp: 'A run of three: roll three new dice and block 5.', fx: (_, u) => ({ roll: 3, block: u ? 5 : 0 }), glyph: 'kite', unlock: 'midway' },
  { id: 'carousel', name: 'Little Carousel', who: 'any', rarity: 2, need: { k: 'any' }, uses: 99, text: 'Any die: deal 1. As often as you like.', textUp: 'Any die: deal 2. As often as you like.', fx: (_, u) => ({ dmg: u ? 2 : 1 }), glyph: 'carousel', unlock: 'win' },
  { id: 'cider', name: 'Hot Cider', who: 'enzo', rarity: 2, need: { k: 'min', n: 4 }, uses: 1, text: '4 or more: block that and heal 2.', textUp: '4 or more: block that +3 and heal 3.', fx: (v, u) => ({ block: v[0] + (u ? 3 : 0), heal: u ? 3 : 2 }), glyph: 'cider', unlock: 'win' },
  { id: 'gambit', name: 'Ringmaster’s Hat', who: 'any', rarity: 3, need: { k: 'is', n: [1, 6] }, uses: 1, text: 'A 1 or a 6: deal 4 times it, but take 2.', textUp: 'A 1 or a 6: deal 5 times it, but take 2.', fx: (v, u) => ({ dmg: v[0] * (u ? 5 : 4), selfDmg: 2 }), glyph: 'hat', unlock: 'foggy' },
];
export const TOOL: Record<string, ToolDef> = Object.fromEntries(TOOLS.map(t => [t.id, t]));
export const needOf = (t: ToolDef, up: boolean) => (up && t.needUp) || t.need;
export const usesOf = (t: ToolDef, up: boolean) => (up && t.usesUp != null ? t.usesUp : t.uses);
/** How many dice a need takes before it fires. */
export const slotsOf = (n: Need) => (n.k === 'pair' || n.k === 'seven' ? 2 : n.k === 'triple' || n.k === 'run' ? 3 : 1);

export type LeadId = 'dora' | 'enzo' | 'both';
export const LEADS: Record<LeadId, { name: string; hp: number; tools: string[]; passive: string; blurb: string }> = {
  dora: { name: 'Dora leads', hp: 44, tools: ['sling', 'shield', 'clover', 'splitter', 'pebble'], passive: 'Lucky Paw: re-roll a die a turn, and every 6 you roll heals 1.', blurb: 'Lucky and kind: re-rolls, splits and healing.' },
  enzo: { name: 'Enzo leads', hp: 40, tools: ['sling', 'shield', 'honey', 'mallet'], passive: 'Thick Fur: start every turn with 2 block.', blurb: 'Big and sturdy: heavy hits and walls.' },
  both: { name: 'Side by Side', hp: 38, tools: ['sling', 'shield', 'rattle', 'top', 'pebble'], passive: 'Paw in Paw: every pair you roll gives 2 block.', blurb: 'Together: pairs, flips and twin tricks.' },
};

/** A foe's plan for its next turn. Any mix of these happens together; the scene draws one icon each. */
export type Intent = {
  atk?: number; hits?: number; block?: number; poison?: number; burn?: number; frost?: number;
  curse?: number; lock?: boolean; summon?: string; heal?: number; buff?: number;
};
export type FoeDef = { id: string; name: string; hp: number; art: string; moves: Intent[]; order: 'cycle' | 'shuffle'; boss?: boolean; minion?: boolean; blurb: string };
export const FOES: Record<string, FoeDef> = {
  hoopla: { id: 'hoopla', name: 'Hoopla Goblin', hp: 17, art: 'foe-hoopla', order: 'shuffle', blurb: 'Juggles hoops and flings them two at a time.', moves: [{ atk: 5 }, { atk: 3, hits: 2 }, { atk: 3, block: 5 }] },
  candyfloss: { id: 'candyfloss', name: 'Candyfloss Cloud', hp: 21, art: 'foe-candyfloss', order: 'shuffle', blurb: 'Sticky sugar frosts your dice.', moves: [{ atk: 4, frost: 1 }, { block: 7, heal: 3 }, { atk: 6 }] },
  ringtoss: { id: 'ringtoss', name: 'Ring-toss Imp', hp: 19, art: 'foe-ringtoss', order: 'shuffle', blurb: 'Rings a tool so you cannot use it.', moves: [{ atk: 3, lock: true }, { atk: 6 }, { atk: 2, poison: 3 }] },
  toffee: { id: 'toffee', name: 'Toffee Golem', hp: 32, art: 'foe-toffee', order: 'cycle', blurb: 'Slow and heavy; sticks your dice with toffee.', moves: [{ block: 8, curse: 1 }, { atk: 11 }, { atk: 4, block: 4 }] },
  carousel: { id: 'carousel', name: 'Carousel Ghost', hp: 25, art: 'foe-carousel', order: 'cycle', blurb: 'Spins faster every turn.', moves: [{ atk: 4, buff: 2 }, { burn: 3, atk: 3 }, { atk: 5, buff: 2 }, { block: 6 }] },
  seedling: { id: 'seedling', name: 'Pumpkin Seedling', hp: 9, art: 'boss-pumpkin', order: 'cycle', minion: true, blurb: 'A little pumpkin sprout.', moves: [{ atk: 3 }, { block: 3 }] },
  moth: { id: 'moth', name: 'Lantern Moth', hp: 92, art: 'boss-moth', order: 'cycle', boss: true, blurb: 'Its wings burn and its dust frosts.', moves: [{ atk: 6, burn: 3 }, { lock: true, block: 10 }, { atk: 4, hits: 3 }, { frost: 2, atk: 5 }, { atk: 15 }] },
  pumpkin: { id: 'pumpkin', name: 'Prize Pumpkin', hp: 60, art: 'boss-pumpkin', order: 'cycle', boss: true, blurb: 'Grows seedlings, then flattens you.', moves: [{ atk: 7 }, { summon: 'seedling', block: 6 }, { curse: 1, atk: 5 }, { block: 8, buff: 2 }, { atk: 13 }] },
  ringmaster: { id: 'ringmaster', name: 'The Fog Ringmaster', hp: 135, art: 'boss-ringmaster', order: 'cycle', boss: true, blurb: 'Runs the whole foggy show.', moves: [{ atk: 9, lock: true }, { summon: 'hoopla', block: 10 }, { curse: 2, atk: 6 }, { atk: 5, hits: 3 }, { buff: 3, block: 12 }, { atk: 22 }] },
};
export type AreaDef = { id: string; name: string; foes: string[][]; elites: string[]; boss: string; art: string };
export const AREAS: AreaDef[] = [
  { id: 'meadow', name: 'The Meadow Fair', foes: [['hoopla'], ['candyfloss'], ['ringtoss'], ['hoopla', 'hoopla']], elites: ['toffee', 'carousel'], boss: 'pumpkin', art: 'bg-meadow' },
  { id: 'midway', name: 'The Lantern Midway', foes: [['ringtoss', 'hoopla'], ['carousel'], ['toffee'], ['candyfloss', 'ringtoss']], elites: ['carousel', 'toffee'], boss: 'moth', art: 'bg-midway' },
  { id: 'bigtop', name: 'The Big Top', foes: [['toffee', 'hoopla'], ['carousel', 'candyfloss'], ['ringtoss', 'ringtoss'], ['toffee', 'candyfloss']], elites: ['carousel', 'toffee'], boss: 'ringmaster', art: 'bg-bigtop' },
];
/** How much harder each area makes its foes: hearts × hp, + atk on every hit. */
export const TIER = [{ hp: 1, atk: 0 }, { hp: 1.45, atk: 1 }, { hp: 1.9, atk: 2 }];

export type CharmDef = { id: string; name: string; text: string; glyph: string };
export const CHARMS: CharmDef[] = [
  { id: 'die', name: 'Fifth Die', text: 'Roll one more die every turn.', glyph: 'die' },
  { id: 'acorn', name: 'Golden Acorn', text: '+10 most hearts, and heal 10.', glyph: 'acorn' },
  { id: 'locket', name: 'Four-Leaf Locket', text: 'One more re-roll every turn.', glyph: 'clover' },
  { id: 'scarf', name: 'Warm Scarf', text: 'Start every battle with 8 block.', glyph: 'scarf' },
  { id: 'belt', name: 'Tool Belt', text: 'Room for one more tool on the table.', glyph: 'belt' },
  { id: 'paws', name: 'Sticky Paws', text: 'Toffee and rings can no longer stick your dice or tools.', glyph: 'paw' },
  { id: 'spark', name: 'Ember Charm', text: 'Every burn you light burns 2 more.', glyph: 'lantern' },
  { id: 'basket', name: 'Picnic Basket', text: 'Heal 4 after every battle.', glyph: 'basket' },
];
export const CHARM: Record<string, CharmDef> = Object.fromEntries(CHARMS.map(c => [c.id, c]));

/** The mystery tents: each choice's effect is applied by the engine by id. */
export type TentDef = { id: string; name: string; text: string; choices: { id: string; label: string }[] };
export const TENTS: TentDef[] = [
  { id: 'fortune', name: 'The Fortune Teller', text: 'A fog-sprite with a crystal ball offers to polish one of your tools… for a price.', choices: [{ id: 'pay', label: 'Pay 6 hearts: upgrade a random tool' }, { id: 'leave', label: 'Politely leave' }] },
  { id: 'lost', name: 'The Lost Basket', text: 'A picnic basket sits alone under a tree, a tool poking out of the cloth.', choices: [{ id: 'tool', label: 'Take the tool' }, { id: 'acorns', label: 'Take the acorns tucked beside it (+25)' }] },
  { id: 'ferris', name: 'The Wobbly Ferris Wheel', text: 'The little ferris wheel creaks round and round, its seats swaying in the fog.', choices: [{ id: 'ride', label: 'Ride it: heal 10' }, { id: 'fix', label: 'Fix it: lose 4 hearts, gain a tool' }] },
  { id: 'pie', name: 'The Pie Contest', text: 'Six pies cool on a long table. The judge has fled the fog.', choices: [{ id: 'eat', label: 'Eat a slice: +4 most hearts' }, { id: 'judge', label: 'Judge it: +30 acorns' }] },
  { id: 'mirror', name: 'The Hall of Mirrors', text: 'In the wobbly mirrors your tools look bigger, smaller, sillier.', choices: [{ id: 'remove', label: 'Leave a tool behind: remove your weakest' }, { id: 'leave', label: 'Walk on through' }] },
  { id: 'coconut', name: 'The Coconut Shy', text: 'Three wooden balls and a row of coconuts. Roll a die: 4 or more wins a rare tool, less costs 5 hearts.', choices: [{ id: 'throw', label: 'Throw!' }, { id: 'leave', label: 'Not today' }] },
  { id: 'smith', name: 'The Tinker’s Cart', text: 'An old badger tinker, fog-free, hums at her bench.', choices: [{ id: 'upgrade', label: 'Pay 30 acorns: upgrade a random tool' }, { id: 'leave', label: 'Wave and move on' }] },
  { id: 'ambush', name: 'The Rattling Tent', text: 'Something inside the tent rattles a tambourine. A fog-sprite bursts out!', choices: [{ id: 'fight', label: 'Fight it (a tool as the prize)' }] },
];
export const TENT: Record<string, TentDef> = Object.fromEntries(TENTS.map(t => [t.id, t]));

/** Foggier levels: each adds one rule on top of the ones below it. */
export const FOGGIER = [
  'The fair as it is.',
  'Foes have 15% more hearts.',
  'Every foe hit lands 1 harder.',
  'Picnics heal less (a fifth, not a third).',
  'You start with 4 fewer hearts.',
  'Bosses have 20% more hearts and start with 10 block.',
];
