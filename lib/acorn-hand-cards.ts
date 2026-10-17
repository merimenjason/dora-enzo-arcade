// Acorn Hand's tables: hand types, charms, almanac pages, treats and the rivals who set the boss rules.
// Everything here is data or a pure function of a scoring context, so lib/acorn-hand-game.ts can replay a run exactly.

export type Suit = 0 | 1 | 2 | 3;
export const SUITS = ['Acorns', 'Clovers', 'Berries', 'Pebbles'] as const;
export const SUIT_ONE = ['Acorn', 'Clover', 'Berry', 'Pebble'] as const;
/** Ranks run 2 to 14; 11 to 13 are the face cards and 14 is the ace. */
export const RANK_NAMES: Record<number, string> = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
export const rankName = (r: number) => RANK_NAMES[r] ?? String(r);
export const rankLong = (r: number) => ({ 11: 'Jack', 12: 'Queen', 13: 'King', 14: 'Ace' } as Record<number, string>)[r] ?? String(r);
export const isFace = (r: number) => r >= 11 && r <= 13;
/** Chips a card adds when it scores: its number, ten for a face card, eleven for an ace. */
export const cardChips = (r: number) => (r === 14 ? 11 : r >= 11 ? 10 : r);

export type Gloss = '' | 'honey' | 'ember' | 'crystal' | 'gold';
export const GLOSS_TEXT: Record<Exclude<Gloss, ''>, string> = {
  honey: '+30 chips when it scores',
  ember: '+4 mult when it scores',
  crystal: '×1.5 mult when it scores',
  gold: '+3 nuts if it is still in your hand when the round is won',
};
export type Card = { id: number; rank: number; suit: Suit; gloss: Gloss };

// ── Hand types ────────────────────────────────────────────────────────────────

export type HandId = 'high' | 'pair' | 'two' | 'three' | 'straight' | 'flush' | 'full' | 'four' | 'sflush' | 'five' | 'ffive';
export type HandType = { id: HandId; name: string; chips: number; mult: number; upChips: number; upMult: number };
/** Weakest first. `up` is what each almanac level adds. */
export const HANDS: HandType[] = [
  { id: 'high', name: 'High card', chips: 5, mult: 1, upChips: 10, upMult: 1 },
  { id: 'pair', name: 'Pair', chips: 10, mult: 2, upChips: 15, upMult: 1 },
  { id: 'two', name: 'Two pair', chips: 20, mult: 2, upChips: 20, upMult: 1 },
  { id: 'three', name: 'Three of a kind', chips: 30, mult: 3, upChips: 20, upMult: 2 },
  { id: 'straight', name: 'Straight', chips: 30, mult: 4, upChips: 30, upMult: 3 },
  { id: 'flush', name: 'Flush', chips: 35, mult: 4, upChips: 15, upMult: 2 },
  { id: 'full', name: 'Full house', chips: 40, mult: 4, upChips: 25, upMult: 2 },
  { id: 'four', name: 'Four of a kind', chips: 60, mult: 7, upChips: 30, upMult: 3 },
  { id: 'sflush', name: 'Straight flush', chips: 100, mult: 8, upChips: 40, upMult: 4 },
  { id: 'five', name: 'Five of a kind', chips: 120, mult: 12, upChips: 35, upMult: 3 },
  { id: 'ffive', name: 'Flush five', chips: 160, mult: 16, upChips: 50, upMult: 3 },
];
export const handById = (id: HandId) => HANDS.find((h) => h.id === id)!;
/** Which smaller hands a hand also counts as, for charms that ask whether a hand "contains" one. */
export const CONTAINS: Record<HandId, HandId[]> = {
  high: ['high'], pair: ['pair'], two: ['two', 'pair'], three: ['three', 'pair'], straight: ['straight'], flush: ['flush'],
  full: ['full', 'three', 'two', 'pair'], four: ['four', 'three', 'two', 'pair'], sflush: ['sflush', 'straight', 'flush'],
  five: ['five', 'four', 'three', 'two', 'pair'], ffive: ['ffive', 'five', 'flush', 'four', 'three', 'two', 'pair'],
};

// ── Charms ────────────────────────────────────────────────────────────────────

/** What a charm adds at one moment of a score. */
export type Effect = { chips?: number; mult?: number; xmult?: number; nuts?: number };
/** Everything a charm may look at while a hand scores. `state` is the charm's own counter. */
export type Ctx = {
  hand: HandId; played: Card[]; scoring: Card[]; held: Card[];
  playsLeft: number; discardsLeft: number; nuts: number; deckLeft: number; charms: number;
  firstPlay: boolean; lastPlay: boolean; state: number;
};
export type Rule = 'fourFlush' | 'fourStraight' | 'splash' | 'handSize' | 'discard' | 'play' | 'tight';
export type Look = { base: 'dora' | 'enzo'; fur: string; bib: string };
export type Charm = {
  id: string; name: string; rarity: 1 | 2 | 3; text: string;
  /** What the shop leans on: a suit (`s0` to `s3`), a hand id, `face`, `low`, `econ` or `any`. */
  tags: string[];
  look: Look;
  /** Each scoring card, in order. */
  card?: (c: Card, i: number, x: Ctx) => Effect | null;
  /** Each card left in hand. */
  held?: (c: Card, x: Ctx) => Effect | null;
  /** Once, after the cards. */
  main?: (x: Ctx) => Effect | null;
  /** Whether a scoring card scores a second time. */
  again?: (c: Card, i: number, x: Ctx) => boolean;
  /** Runs as the hand is played, before it scores; returns the new counter. */
  played?: (x: Ctx) => number;
  discarded?: (cards: Card[], state: number) => { state?: number; nuts?: number };
  roundWon?: (state: number, boss: boolean) => { state?: number; nuts?: number };
  rule?: Rule;
  /** Copies the charm to its right. */
  echo?: boolean;
  /** Levels up the hand type of the first play each round. */
  sage?: boolean;
  start?: number;
  /** How the counter reads on the charm, when it has one. */
  shows?: (state: number) => string;
};
export const COST = [0, 4, 6, 8];
const has = (x: Ctx, h: HandId) => CONTAINS[x.hand].includes(h);
const L = (base: 'dora' | 'enzo', fur: string, bib: string): Look => ({ base, fur, bib });
const suitMult = (s: Suit) => (c: Card) => (c.suit === s ? { mult: 3 } : null);

export const CHARMS: Charm[] = [
  // Common
  { id: 'dora', name: 'Dora', rarity: 1, text: '+4 mult.', tags: ['any'], look: L('dora', '#fbf8f3', '#e9a23b'), main: () => ({ mult: 4 }) },
  { id: 'enzo', name: 'Enzo', rarity: 1, text: '+40 chips.', tags: ['any'], look: L('enzo', '#75737d', '#d9653b'), main: () => ({ chips: 40 }) },
  { id: 'bramble', name: 'Bramble', rarity: 1, text: 'Each scoring Acorn gives +3 mult.', tags: ['s0'], look: L('enzo', '#8a6a4c', '#a8642e'), card: suitMult(0) },
  { id: 'pip', name: 'Pip', rarity: 1, text: 'Each scoring Clover gives +3 mult.', tags: ['s1'], look: L('dora', '#efe0c8', '#5aa64a'), card: suitMult(1) },
  { id: 'mossy', name: 'Mossy', rarity: 1, text: 'Each scoring Berry gives +3 mult.', tags: ['s2'], look: L('dora', '#e8d6cf', '#c6405a'), card: suitMult(2) },
  { id: 'flint', name: 'Flint', rarity: 1, text: 'Each scoring Pebble gives +3 mult.', tags: ['s3'], look: L('enzo', '#8d8f99', '#6f7c8f'), card: suitMult(3) },
  { id: 'willow', name: 'Willow', rarity: 1, text: '+8 mult if the hand contains a pair.', tags: ['pair'], look: L('dora', '#f2e9da', '#7fb069'), main: (x) => (has(x, 'pair') ? { mult: 8 } : null) },
  { id: 'nutmeg', name: 'Nutmeg', rarity: 1, text: '+10 mult if the hand contains two pair.', tags: ['two'], look: L('enzo', '#a07858', '#d08a3a'), main: (x) => (has(x, 'two') ? { mult: 10 } : null) },
  { id: 'pebble', name: 'Pebble', rarity: 1, text: '+12 mult if the hand contains three of a kind.', tags: ['three'], look: L('enzo', '#9a9aa3', '#4f7fbf'), main: (x) => (has(x, 'three') ? { mult: 12 } : null) },
  { id: 'gale', name: 'Gale', rarity: 1, text: '+12 mult if the hand contains a straight.', tags: ['straight'], look: L('enzo', '#a3a7b8', '#3f8fc9'), main: (x) => (has(x, 'straight') ? { mult: 12 } : null) },
  { id: 'thistle', name: 'Thistle', rarity: 1, text: '+10 mult if the hand contains a flush.', tags: ['flush'], look: L('enzo', '#8c7f99', '#8a5bb8'), main: (x) => (has(x, 'flush') ? { mult: 10 } : null) },
  { id: 'wren', name: 'Wren', rarity: 1, text: 'Each scoring 2, 3, 4 or 5 gives +4 mult.', tags: ['low'], look: L('dora', '#e9d2b4', '#c97b4a'), card: (c) => (c.rank <= 5 ? { mult: 4 } : null) },
  { id: 'hazel', name: 'Hazel', rarity: 1, text: 'Each scoring face card gives +30 chips.', tags: ['face'], look: L('enzo', '#b08a62', '#7a4f2a'), card: (c) => (isFace(c.rank) ? { chips: 30 } : null) },
  { id: 'robin', name: 'Robin', rarity: 1, text: 'Each scoring ace gives +20 chips and +4 mult.', tags: ['ace'], look: L('dora', '#f0d9c4', '#d24a3a'), card: (c) => (c.rank === 14 ? { chips: 20, mult: 4 } : null) },
  { id: 'sorrel', name: 'Sorrel', rarity: 1, text: 'Earn 1 nut for each face card you discard.', tags: ['econ', 'face'], look: L('enzo', '#b4744e', '#e0b040'), discarded: (cards) => ({ nuts: cards.filter((c) => isFace(c.rank)).length }) },
  { id: 'cashew', name: 'Cashew', rarity: 1, text: 'Earn 4 nuts when you win a round.', tags: ['econ'], look: L('dora', '#ead8bd', '#c99a3a'), roundWon: () => ({ nuts: 4 }) },
  { id: 'mags', name: 'Mags', rarity: 1, text: '+1 mult for every 3 nuts you hold.', tags: ['econ'], look: L('enzo', '#55535c', '#2f6f6a'), main: (x) => ({ mult: Math.floor(x.nuts / 3) }) },
  { id: 'burrowby', name: 'Burrowby', rarity: 1, text: '+25 chips for each discard you have left.', tags: ['any'], look: L('enzo', '#6b5a50', '#8f6b3e'), main: (x) => (x.discardsLeft ? { chips: 25 * x.discardsLeft } : null) },
  { id: 'driftwood', name: 'Driftwood', rarity: 1, text: '+2 chips for each card left in your draw pile.', tags: ['any'], look: L('enzo', '#9b8c7a', '#5f8f8a'), main: (x) => ({ chips: 2 * x.deckLeft }) },
  { id: 'poppy', name: 'Poppy', rarity: 1, text: '+15 mult if you play three or fewer cards.', tags: ['pair', 'high'], look: L('dora', '#f6e4dc', '#e2543f'), main: (x) => (x.played.length <= 3 ? { mult: 15 } : null) },
  // Uncommon
  { id: 'ember', name: 'Ember', rarity: 2, text: '×2 mult if the hand contains a flush.', tags: ['flush'], look: L('dora', '#c98a5c', '#e2662e'), main: (x) => (has(x, 'flush') ? { xmult: 2 } : null) },
  { id: 'clover', name: 'Clover', rarity: 2, text: '×2 mult if the hand contains two pair.', tags: ['two'], look: L('dora', '#f1dfc2', '#4c9a48'), main: (x) => (has(x, 'two') ? { xmult: 2 } : null) },
  { id: 'cinder', name: 'Cinder', rarity: 2, text: 'Gains +1 mult every time you play a hand.', tags: ['any'], look: L('enzo', '#6e5148', '#c4462f'), start: 0, played: (x) => x.state + 1, main: (x) => (x.state ? { mult: x.state } : null), shows: (s) => `+${s} mult` },
  { id: 'frost', name: 'Frost', rarity: 2, text: 'Gains ×0.25 mult every time you play a straight.', tags: ['straight'], look: L('dora', '#e4ecf2', '#6ab0d8'), start: 1, played: (x) => (has(x, 'straight') ? x.state + 0.25 : x.state), main: (x) => (x.state > 1 ? { xmult: x.state } : null), shows: (s) => `×${s}` },
  { id: 'onyx', name: 'Onyx', rarity: 2, text: '×1.5 mult for each king held in your hand.', tags: ['face'], look: L('enzo', '#2f2d35', '#b8954a'), held: (c) => (c.rank === 13 ? { xmult: 1.5 } : null) },
  { id: 'zephyr', name: 'Zephyr', rarity: 2, text: 'Flushes and straights can be made with four cards.', tags: ['flush', 'straight'], look: L('dora', '#e9eef5', '#5a7fd0'), rule: 'fourFlush' },
  { id: 'aurora', name: 'Aurora', rarity: 2, text: 'The first scoring card scores twice.', tags: ['any'], look: L('dora', '#fbeee4', '#f0a0b8'), again: (_, i) => i === 0 },
  { id: 'fennel', name: 'Fennel', rarity: 2, text: 'Scoring cards give +1, +2, +3, +4 and +5 mult in turn.', tags: ['straight', 'flush', 'full'], look: L('dora', '#e7d7a8', '#8fae3a'), card: (_, i) => ({ mult: i + 1 }) },
  { id: 'sable', name: 'Sable', rarity: 2, text: '×2 mult on the last play of a round.', tags: ['any'], look: L('enzo', '#5a4d47', '#3d6fae'), main: (x) => (x.lastPlay ? { xmult: 2 } : null) },
  { id: 'bracken', name: 'Bracken', rarity: 2, text: 'Gains +3 chips for every card you discard.', tags: ['any'], look: L('enzo', '#7a6a52', '#6b8f3a'), start: 0, discarded: (cards, s) => ({ state: s + 3 * cards.length }), main: (x) => (x.state ? { chips: x.state } : null), shows: (s) => `+${s} chips` },
  { id: 'rill', name: 'Rill', rarity: 2, text: 'Scoring 9s and 10s score twice.', tags: ['any'], look: L('dora', '#dfe7ea', '#3aa0b0'), again: (c) => c.rank === 9 || c.rank === 10 },
  { id: 'juniper', name: 'Juniper', rarity: 2, text: '×1.5 mult if you play exactly four cards.', tags: ['two', 'four'], look: L('enzo', '#6c7564', '#4a6a8a'), main: (x) => (x.played.length === 4 ? { xmult: 1.5 } : null) },
  { id: 'prism', name: 'Prism', rarity: 2, text: '×3 mult if the played cards hold all four suits.', tags: ['any'], look: L('dora', '#f4f0fa', '#9a6ad0'), main: (x) => (new Set(x.played.map((c) => c.suit)).size === 4 ? { xmult: 3 } : null) },
  { id: 'sage', name: 'Sage', rarity: 2, text: 'The first hand you play each round goes up a level first.', tags: ['any'], look: L('enzo', '#8a8578', '#5b4a8a'), sage: true },
  { id: 'lantern', name: 'Lantern', rarity: 2, text: 'Hold one more card in your hand.', tags: ['any'], look: L('dora', '#f6e7c8', '#e8b640'), rule: 'handSize' },
  { id: 'thrift', name: 'Thrift', rarity: 2, text: 'One more discard each round.', tags: ['any'], look: L('enzo', '#857a6a', '#7f9f5a'), rule: 'discard' },
  { id: 'honeycomb', name: 'Honeycomb', rarity: 2, text: 'Each scoring glossed card gives +6 mult.', tags: ['gloss'], look: L('dora', '#f0dcae', '#e0a020'), card: (c) => (c.gloss ? { mult: 6 } : null) },
  // Rare
  { id: 'stag', name: 'Stag', rarity: 3, text: '×1.25 mult for each charm you own, this one included.', tags: ['any'], look: L('enzo', '#8b6a48', '#3f5f3a'), main: (x) => ({ xmult: 1 + 0.25 * x.charms }) },
  { id: 'echo', name: 'Echo', rarity: 3, text: 'Copies the charm to its right.', tags: ['any'], look: L('enzo', '#3f3d48', '#7a7a9a'), echo: true },
  { id: 'luna', name: 'Luna', rarity: 3, text: 'Every card you play scores.', tags: ['any'], look: L('dora', '#f7f3ff', '#c0b0f0'), rule: 'splash' },
  { id: 'regent', name: 'Regent', rarity: 3, text: '×3 mult, but hold one card fewer.', tags: ['any'], look: L('enzo', '#5f4a5a', '#c8a040'), main: () => ({ xmult: 3 }), rule: 'tight' },
  { id: 'comet', name: 'Comet', rarity: 3, text: 'Gains ×0.5 mult every time you beat a boss.', tags: ['any'], look: L('dora', '#fff6e6', '#f08a3a'), start: 1, roundWon: (s, boss) => ({ state: boss ? s + 0.5 : s }), main: (x) => (x.state > 1 ? { xmult: x.state } : null), shows: (s) => `×${s}` },
  { id: 'bloom', name: 'Bloom', rarity: 3, text: 'Scoring face cards score twice.', tags: ['face'], look: L('dora', '#fde8ef', '#e05a8a'), again: (c) => isFace(c.rank) },
  { id: 'tumble', name: 'Tumble', rarity: 3, text: 'One more play each round.', tags: ['any'], look: L('enzo', '#9a7d5e', '#d0703a'), rule: 'play' },
];
export const charmById = (id: string) => CHARMS.find((c) => c.id === id);

// ── Almanac pages and treats ──────────────────────────────────────────────────

export type ItemKind = 'almanac' | 'treat';
export type Treat = {
  id: string; name: string; text: string;
  /** How many cards in hand it needs selected: 0 means none, otherwise at least 1 and at most this many. */
  picks: number;
};
export const TREATS: Treat[] = [
  { id: 'honey', name: 'Honey drop', text: 'Up to two selected cards turn honey: +30 chips when they score.', picks: 2 },
  { id: 'spice', name: 'Ember spice', text: 'Up to two selected cards turn ember: +4 mult when they score.', picks: 2 },
  { id: 'dew', name: 'Crystal dew', text: 'One selected card turns crystal: ×1.5 mult when it scores.', picks: 1 },
  { id: 'leaf', name: 'Gold leaf', text: 'One selected card turns gold: +3 nuts if it is in your hand when you win the round.', picks: 1 },
  { id: 'dye0', name: 'Acorn dye', text: 'Up to three selected cards become Acorns.', picks: 3 },
  { id: 'dye1', name: 'Clover dye', text: 'Up to three selected cards become Clovers.', picks: 3 },
  { id: 'dye2', name: 'Berry dye', text: 'Up to three selected cards become Berries.', picks: 3 },
  { id: 'dye3', name: 'Pebble dye', text: 'Up to three selected cards become Pebbles.', picks: 3 },
  { id: 'mirror', name: 'Mirror pond', text: 'Adds a copy of one selected card to your deck and your hand.', picks: 1 },
  { id: 'compost', name: 'Compost', text: 'Removes up to two selected cards from your deck for good.', picks: 2 },
  { id: 'sprout', name: 'Sprout', text: 'Up to two selected cards go up one rank (an ace stays an ace).', picks: 2 },
  { id: 'tea', name: 'Clover tea', text: 'Doubles your nuts, adding at most 20.', picks: 0 },
  { id: 'wish', name: 'Wishing stone', text: 'A random charm, if you have room for it.', picks: 0 },
];
export const treatById = (id: string) => TREATS.find((t) => t.id === id);
/** An item in the shop or in one of the two item slots: an almanac page names a hand, a treat names itself. */
export type Item = { kind: ItemKind; id: string };
export const itemName = (it: Item) => (it.kind === 'almanac' ? `Almanac: ${handById(it.id as HandId).name}` : treatById(it.id)!.name);
export const itemText = (it: Item) => {
  if (it.kind === 'treat') return treatById(it.id)!.text;
  const h = handById(it.id as HandId);
  return `${h.name} goes up a level: +${h.upChips} chips and +${h.upMult} mult.`;
};
export const ITEM_COST = 3;

// ── Vouchers ──────────────────────────────────────────────────────────────────

/** A permanent upgrade for the rest of the run. One is on offer each ante. */
export type Voucher = { id: string; name: string; text: string };
export const VOUCHERS: Voucher[] = [
  { id: 'shelf', name: 'Wider Shelf', text: '+1 charm slot.' },
  { id: 'pockets', name: 'Deep Pockets', text: '+1 item slot.' },
  { id: 'haggler', name: 'Haggler', text: 'Rerolls start at 3 nuts, not 5.' },
  { id: 'hoard', name: 'Squirrel Hoard', text: 'Interest goes up to 10, not 5: up to 50 nuts held count.' },
  { id: 'play', name: 'Extra Paw', text: '+1 play each round.' },
  { id: 'discard', name: 'Spare Paw', text: '+1 discard each round.' },
  { id: 'hand', name: 'Big Paws', text: '+1 hand size.' },
  { id: 'stall', name: 'Bigger Stall', text: 'The shop shows 3 charms, not 2.' },
  { id: 'market', name: 'Market Day', text: 'Every pack shows one more option.' },
  { id: 'lucky', name: 'Lucky Burrow', text: 'Uncommon and rare charms are twice as likely.' },
];
export const voucherById = (id: string) => VOUCHERS.find((v) => v.id === id);
export const VOUCHER_COST = 10;

// ── Booster packs ─────────────────────────────────────────────────────────────

export type PackKind = 'charm' | 'almanac' | 'treat' | 'card';
export const PACK_KINDS: PackKind[] = ['charm', 'almanac', 'treat', 'card'];
/** A pack in the shop: how many options it shows, how many you take, and its price. */
export type PackType = { id: string; kind: PackKind; big: boolean; name: string; shown: number; picks: number; cost: number };
export const PACKS: PackType[] = [
  { id: 'charm', kind: 'charm', big: false, name: 'Charm pack', shown: 2, picks: 1, cost: 5 },
  { id: 'charm-big', kind: 'charm', big: true, name: 'Big charm pack', shown: 4, picks: 1, cost: 7 },
  { id: 'almanac', kind: 'almanac', big: false, name: 'Almanac pack', shown: 3, picks: 1, cost: 4 },
  { id: 'almanac-big', kind: 'almanac', big: true, name: 'Big almanac pack', shown: 5, picks: 2, cost: 7 },
  { id: 'treat', kind: 'treat', big: false, name: 'Treat pack', shown: 3, picks: 1, cost: 4 },
  { id: 'treat-big', kind: 'treat', big: true, name: 'Big treat pack', shown: 5, picks: 2, cost: 7 },
  { id: 'card', kind: 'card', big: false, name: 'Card pack', shown: 3, picks: 1, cost: 4 },
  { id: 'card-big', kind: 'card', big: true, name: 'Big card pack', shown: 5, picks: 2, cost: 7 },
];
export const packById = (id: string) => PACKS.find((p) => p.id === id);
/** Packs in each shop; how often one is big; cards dealt for a treat pack; how often a pack card is glossed. */
export const SHOP_PACKS = 2, BIG_PACK_ODDS = 0.25, PACK_DEAL = 8, CARD_PACK_GLOSS = 0.3;

// ── Rivals and their rules ────────────────────────────────────────────────────

export type BossRule = 'suit0' | 'suit1' | 'suit2' | 'suit3' | 'five' | 'fog' | 'veil' | 'small' | 'plays' | 'nodiscard' | 'trickle' | 'fame' | 'shell';
export type Rival = 'fox' | 'snake' | 'owl' | 'weasel' | 'badger' | 'hawk' | 'cougar' | 'mole' | 'skunk' | 'bear' | 'beetle' | 'armadillo' | 'lizard';
export type Boss = { rule: BossRule; name: string; rival: Rival; text: string };
export const BOSSES: Boss[] = [
  { rule: 'suit0', name: 'The Fox', rival: 'fox', text: 'Acorns score nothing.' },
  { rule: 'suit1', name: 'The Owl', rival: 'owl', text: 'Clovers score nothing.' },
  { rule: 'suit2', name: 'The Hawk', rival: 'hawk', text: 'Berries score nothing.' },
  { rule: 'suit3', name: 'The Snake', rival: 'snake', text: 'Pebbles score nothing.' },
  { rule: 'five', name: 'The Badger', rival: 'badger', text: 'Every play must be exactly five cards.' },
  { rule: 'fog', name: 'The Skunk', rival: 'skunk', text: 'Your first hand is dealt face down.' },
  { rule: 'veil', name: 'The Weasel', rival: 'weasel', text: 'Face cards are dealt face down.' },
  { rule: 'small', name: 'The Mole', rival: 'mole', text: 'Hold one card fewer.' },
  { rule: 'plays', name: 'The Bear', rival: 'bear', text: 'Only three plays this round.' },
  { rule: 'nodiscard', name: 'The Cougar', rival: 'cougar', text: 'No discards this round.' },
  { rule: 'trickle', name: 'The Beetle', rival: 'beetle', text: 'After each play or discard, draw at most three cards.' },
  { rule: 'fame', name: 'The Lizard', rival: 'lizard', text: 'Your most-played hand type scores half its base chips and mult.' },
  { rule: 'shell', name: 'The Armadillo', rival: 'armadillo', text: 'A thick shell: the target is half as high again.' },
];
export const bossByRule = (r: BossRule) => BOSSES.find((b) => b.rule === r)!;

// ── The road ──────────────────────────────────────────────────────────────────

export const ANTES = 8;
/** The small round's target in each ante; the big round is 1.5 times it and the boss round twice it. */
export const ANTE_BASE = [250, 650, 1800, 4400, 8500, 16000, 25500, 38000];
/** Past ante 8, each ante's target is this many times the last. */
export const ENDLESS_GROWTH = 1.8;
export const BLIND = [
  { name: 'Small round', scale: 1, reward: 3 },
  { name: 'Big round', scale: 1.5, reward: 4 },
  { name: 'Boss round', scale: 2, reward: 5 },
] as const;
export const anteBase = (ante: number) => (ante <= ANTES ? ANTE_BASE[ante - 1] : Math.round(ANTE_BASE[ANTES - 1] * ENDLESS_GROWTH ** (ante - ANTES)));
