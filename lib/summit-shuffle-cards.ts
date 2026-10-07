// Summit Shuffle's cards, trinkets and statuses: plain data plus one small `play` function per card. A card never
// touches the fight directly; it asks through `Ops`, which the engine in summit-shuffle-game.ts implements, so the
// same card works in a real fight, in a clone the bots search through, and in a test.

export type StatusId =
  // Lasting changes to a creature.
  | 'zoomies' | 'fur' | 'bristle' | 'burrs'
  // Counted down at the end of each of the creature's turns.
  | 'exposed' | 'winded' | 'matted'
  // The chinchilla's own: one-off helpers and powers.
  | 'rush' | 'slip' | 'encore' | 'spare' | 'nest' | 'sticky' | 'den' | 'frenzy' | 'light' | 'bright'
  // Predators only.
  | 'rage' | 'curl' | 'angry' | 'doze' | 'bond';
export type Statuses = Partial<Record<StatusId, number>>;

export type StatusDef = { name: string; icon: string; text: (n: number) => string; bad?: boolean; turns?: boolean };
const turnsOf = (n: number) => (n === 1 ? '1 turn' : `${n} turns`);
export const STATUS: Record<StatusId, StatusDef> = {
  zoomies: { name: 'Zoomies', icon: '⚡', text: (n) => (n >= 0 ? `Every attack hit deals ${n} more damage.` : `Every attack hit deals ${-n} less damage.`) },
  fur: { name: 'Thick Fur', icon: '🧥', text: (n) => `Cards give ${n} more Fluff.` },
  bristle: { name: 'Bristle', icon: '🌵', text: (n) => `Whoever attacks this creature takes ${n} damage for each hit.` },
  burrs: { name: 'Burrs', icon: '🍂', text: (n) => `Loses ${n} health at the start of its turn, then one burr falls off.`, bad: true },
  exposed: { name: 'Exposed', icon: '🎯', text: (n) => `Takes half as much again from attacks for ${turnsOf(n)}.`, bad: true, turns: true },
  winded: { name: 'Winded', icon: '💨', text: (n) => `Attacks deal a quarter less for ${turnsOf(n)}.`, bad: true, turns: true },
  matted: { name: 'Matted', icon: '🌀', text: (n) => `Cards give a quarter less Fluff for ${turnsOf(n)}.`, bad: true, turns: true },
  rush: { name: 'Wound Up', icon: '⏳', text: (n) => `${n} of the Zoomies wear off at the end of this turn.` },
  slip: { name: 'Fur Slip', icon: '✨', text: (n) => `The next ${n === 1 ? 'hit' : `${n} hits`} that would cost health cost none.` },
  encore: { name: 'Encore', icon: '🔁', text: (n) => `The next ${n === 1 ? 'attack' : `${n} attacks`} this turn ${n === 1 ? 'is' : 'are'} played twice.` },
  spare: { name: 'Cheek Stash', icon: '🥜', text: (n) => `${n} more energy next turn.` },
  nest: { name: 'Cosy Nest', icon: '🏡', text: (n) => `Gains ${n} Fluff at the end of each turn.` },
  sticky: { name: 'Sticky Coat', icon: '🍯', text: (n) => `Puts ${n} Burrs on every foe at the start of each turn.` },
  den: { name: 'Deep Burrow', icon: '🕳️', text: () => 'Fluff is kept from turn to turn.' },
  frenzy: { name: 'Endless Zoomies', icon: '🔥', text: (n) => `Gains ${n} Zoomies at the start of each turn.` },
  light: { name: 'Light Feet', icon: '🐾', text: (n) => `Gains ${n} Fluff for every card played.` },
  bright: { name: 'Bright Eyed', icon: '👀', text: (n) => `Draws ${n} more ${n === 1 ? 'card' : 'cards'} each turn.` },
  rage: { name: 'Hungry', icon: '🍖', text: (n) => `Gains ${n} Zoomies at the end of each of its turns.` },
  curl: { name: 'Curl Up', icon: '🐚', text: (n) => `Gains ${n} Fluff the first time an attack hurts it.` },
  angry: { name: 'Short Temper', icon: '💢', text: (n) => `Gains ${n} Zoomies each time an attack hurts it.` },
  doze: { name: 'Dozing', icon: '💤', text: (n) => `Asleep for ${turnsOf(n)}, or until something hurts it.` },
  bond: { name: 'Pack Bond', icon: '🤝', text: (n) => `Gains ${n} Zoomies if a packmate is knocked out.` },
};
/** The statuses that wear off by themselves, one turn at a time. */
export const TIMED: StatusId[] = ['exposed', 'winded', 'matted'];

/** What a card may ask of the fight it is played in. `t` is a foe's place in the line, or -1 for none. */
export interface Ops {
  /** Attacks one foe: Zoomies, Winded and Exposed all count. `zx` is how many times Zoomies counts. Returns the health lost. */
  hit(t: number, d: number, zx?: number): number;
  hitAll(d: number): void;
  hitRandom(d: number): void;
  /** Fluff from a card: Thick Fur and Matted count. */
  fluff(b: number): void;
  /** Fluff from anything else, exactly as given. */
  gainFluff(n: number): void;
  setFluff(n: number): void;
  readonly myFluff: number;
  /** A status on one foe, or on all of them. */
  hex(t: number, id: StatusId, n: number): void;
  hexAll(id: StatusId, n: number): void;
  /** A status on the chinchilla. */
  buff(id: StatusId, n: number): void;
  draw(n: number): void;
  addEnergy(n: number): void;
  heal(n: number): void;
  raiseMax(n: number): void;
  /** Drops Exposed, Winded and Matted from the chinchilla. */
  cleanse(): void;
  /** A foe's status count, its Fluff, and whether it is still in the fight. */
  foeHas(t: number, id: StatusId): number;
  stripFluff(t: number): void;
  foeIn(t: number): boolean;
  /** Cards played this turn before this one. */
  readonly playedBefore: number;
}

export type CardType = 'attack' | 'skill' | 'power' | 'status' | 'curse';
export type Rarity = 'starter' | 'common' | 'uncommon' | 'rare' | 'special';
export type Art =
  | 'bite' | 'kick' | 'paw' | 'tail' | 'fluff' | 'dust' | 'burr' | 'hay' | 'jump' | 'bark' | 'raisin' | 'roll' | 'nest' | 'coat'
  | 'zoom' | 'rock' | 'snow' | 'heart' | 'drum' | 'eye' | 'mud' | 'thorn' | 'daze' | 'fright' | 'burrow' | 'cheek';
/** The numbers on a card, already picked for plain or upgraded. `x` is the energy an X card spent. */
export type Vals = { d: number; b: number; n: number; x: number; up: boolean };
type Pair = [number, number];
export type CardDef = {
  id: string; name: string; type: CardType; rarity: Rarity; art: Art;
  /** Energy, plain and upgraded. -1 spends whatever is left (X); -2 cannot be played. */
  cost: Pair;
  /** Whether it is aimed at one foe. */
  target: boolean;
  /** `{d}` is attack damage, `{b}` Fluff and `{n}` any other number; each is [plain, upgraded]. */
  text: string | [string, string];
  d?: Pair; b?: Pair; n?: Pair;
  exhaust?: boolean;
  /** Leaves the deck for the rest of the fight at the end of a turn it was not played in. */
  fades?: boolean;
  /** Damage taken for each copy still in hand at the end of the turn. */
  sting?: number;
  /** The one chinchilla who finds this card on a climb; cards without it turn up for both. */
  who?: Who;
  play?: (g: Ops, v: Vals, t: number) => void;
};
export type Who = 'dora' | 'enzo';

type Extra = Partial<Pick<CardDef, 'd' | 'b' | 'n' | 'exhaust' | 'fades' | 'sting'>>;
const list: CardDef[] = [];
function add(id: string, name: string, type: CardType, rarity: Rarity, cost: number | Pair, art: Art, text: string | [string, string], extra: Extra, play?: CardDef['play'], target = false) {
  list.push({ id, name, type, rarity, art, cost: typeof cost === 'number' ? [cost, cost] : cost, target, text, ...extra, play });
}
/** A card aimed at one foe. */
const aimed = (id: string, name: string, type: CardType, rarity: Rarity, cost: number | Pair, art: Art, text: string | [string, string], extra: Extra, play: CardDef['play']) => add(id, name, type, rarity, cost, art, text, extra, play, true);

// ---------- The ten cards every climb starts with ----------
aimed('nip', 'Nip', 'attack', 'starter', 1, 'bite', 'Deal {d} damage.', { d: [6, 9] }, (g, v, t) => { g.hit(t, v.d); });
add('fluffup', 'Fluff Up', 'skill', 'starter', 1, 'fluff', 'Gain {b} Fluff.', { b: [5, 8] }, (g, v) => g.fluff(v.b));
aimed('dustkick', 'Dust Kick', 'attack', 'starter', 2, 'dust', 'Deal {d} damage. Apply {n} Exposed.', { d: [8, 10], n: [2, 3] }, (g, v, t) => { g.hit(t, v.d); g.hex(t, 'exposed', v.n); });

// ---------- Common ----------
aimed('pounce', 'Pounce', 'attack', 'common', 1, 'jump', 'Deal {d} damage. Draw 1 card.', { d: [8, 11] }, (g, v, t) => { g.hit(t, v.d); g.draw(1); });
aimed('doublekick', 'Double Kick', 'attack', 'common', 1, 'kick', 'Deal {d} damage twice.', { d: [5, 7] }, (g, v, t) => { g.hit(t, v.d); g.hit(t, v.d); });
add('tailwhip', 'Tail Whip', 'attack', 'common', 1, 'tail', 'Deal {d} damage to ALL foes.', { d: [8, 11] }, (g, v) => g.hitAll(v.d));
aimed('bowlover', 'Bowl Over', 'attack', 'common', 2, 'roll', 'Deal {d} damage. Apply {n} Winded.', { d: [11, 14], n: [1, 2] }, (g, v, t) => { g.hit(t, v.d); g.hex(t, 'winded', v.n); });
aimed('quicknip', 'Quick Nip', 'attack', 'common', 0, 'bite', 'Deal {d} damage.', { d: [4, 7] }, (g, v, t) => { g.hit(t, v.d); });
aimed('haytoss', 'Hay Toss', 'attack', 'common', 1, 'hay', 'Gain {b} Fluff. Deal {d} damage.', { d: [5, 7], b: [5, 7] }, (g, v, t) => { g.fluff(v.b); g.hit(t, v.d); });
aimed('burrfling', 'Burr Fling', 'attack', 'common', 1, 'burr', 'Deal {d} damage. Apply {n} Burrs.', { d: [5, 7], n: [4, 5] }, (g, v, t) => { g.hit(t, v.d); g.hex(t, 'burrs', v.n); });
aimed('followup', 'Follow Up', 'attack', 'common', 1, 'paw', 'Deal {d} damage. If the foe is Exposed, gain 1 energy and draw 1 card.', { d: [6, 9] }, (g, v, t) => {
  const open = g.foeHas(t, 'exposed') > 0;
  g.hit(t, v.d);
  if (open) { g.addEnergy(1); g.draw(1); }
});
aimed('flurry', 'Flurry', 'attack', 'common', 1, 'paw', 'Deal {d} damage once for every card played this turn, this one included.', { d: [3, 4] }, (g, v, t) => { for (let i = g.playedBefore + 1; i > 0; i--) g.hit(t, v.d); });
add('shakeoff', 'Shake It Off', 'skill', 'common', 1, 'fluff', 'Gain {b} Fluff. Draw 1 card.', { b: [7, 10] }, (g, v) => { g.fluff(v.b); g.draw(1); });
add('dustbath', 'Dust Bath', 'skill', 'common', 1, 'dust', 'Gain {b} Fluff. Shake off Exposed, Winded and Matted.', { b: [7, 10] }, (g, v) => { g.cleanse(); g.fluff(v.b); });
add('popcorn', 'Popcorn', 'skill', 'common', 0, 'jump', 'Draw {n} cards.', { n: [2, 3] }, (g, v) => g.draw(v.n));
add('dustcloud', 'Dust Cloud', 'skill', 'common', 1, 'dust', 'Apply {n} Winded to ALL foes.', { n: [2, 3] }, (g, v) => g.hexAll('winded', v.n));
aimed('burrpatch', 'Burr Patch', 'skill', 'common', 1, 'burr', 'Apply {n} Burrs.', { n: [6, 8] }, (g, v, t) => g.hex(t, 'burrs', v.n));
aimed('squeak', 'Squeak', 'skill', 'common', 0, 'bark', 'Apply {n} Exposed. Draw 1 card.', { n: [1, 2] }, (g, v, t) => { g.hex(t, 'exposed', v.n); g.draw(1); });
add('windup', 'Wind Up', 'skill', 'common', 0, 'zoom', 'Gain {n} Zoomies until the end of this turn.', { n: [2, 4] }, (g, v) => { g.buff('zoomies', v.n); g.buff('rush', v.n); });
add('scamper', 'Scamper', 'skill', 'common', 1, 'zoom', 'Gain {b} Fluff once for every card played this turn, this one included.', { b: [3, 4] }, (g, v) => { for (let i = g.playedBefore + 1; i > 0; i--) g.fluff(v.b); });
add('pricklycurl', 'Prickly Curl', 'skill', 'common', 1, 'thorn', 'Gain {b} Fluff and {n} Bristle.', { b: [6, 8], n: [2, 3] }, (g, v) => { g.fluff(v.b); g.buff('bristle', v.n); });

// ---------- Uncommon ----------
aimed('fullpelt', 'Full Pelt', 'attack', 'uncommon', 2, 'zoom', 'Deal {d} damage. Zoomies count {n} times for this card.', { d: [16, 16], n: [3, 5] }, (g, v, t) => { g.hit(t, v.d, v.n); });
aimed('bellyflop', 'Belly Flop', 'attack', 'uncommon', [1, 0], 'fluff', 'Deal damage equal to your Fluff.', {}, (g, _v, t) => { g.hit(t, g.myFluff); });
add('zoomaround', 'Zoom Around', 'attack', 'uncommon', -1, 'zoom', 'Spend all your energy. Deal {d} damage to ALL foes once for each energy spent.', { d: [6, 9] }, (g, v) => { for (let i = 0; i < v.x; i++) g.hitAll(v.d); });
aimed('ambush', 'Ambush', 'attack', 'uncommon', 1, 'eye', 'Deal {d} damage. Deal it twice if this is the first card you play this turn.', { d: [8, 11] }, (g, v, t) => { const first = g.playedBefore === 0; g.hit(t, v.d); if (first) g.hit(t, v.d); });
aimed('drumfeet', 'Drumming Feet', 'attack', 'uncommon', 1, 'drum', 'Deal {d} damage 3 times.', { d: [3, 4] }, (g, v, t) => { for (let i = 0; i < 3; i++) g.hit(t, v.d); });
aimed('gnaw', 'Gnaw Through', 'attack', 'uncommon', 2, 'bite', 'Remove the foe’s Fluff, then deal {d} damage.', { d: [14, 18] }, (g, v, t) => { g.stripFluff(t); g.hit(t, v.d); });
add('burrstorm', 'Burr Storm', 'attack', 'uncommon', 2, 'burr', 'Deal {d} damage and apply {n} Burrs to ALL foes.', { d: [6, 8], n: [5, 7] }, (g, v) => { g.hitAll(v.d); g.hexAll('burrs', v.n); });
aimed('sorespot', 'Sore Spot', 'attack', 'uncommon', 1, 'burr', 'Deal {d} damage, then as much again as the foe has Burrs.', { d: [8, 11] }, (g, v, t) => { g.hit(t, v.d); const n = g.foeHas(t, 'burrs'); if (n > 0 && g.foeIn(t)) g.hit(t, n, 0); });
add('puffup', 'Puff Up', 'skill', 'uncommon', [1, 0], 'fluff', 'Double your Fluff.', {}, (g) => g.gainFluff(g.myFluff));
aimed('tangle', 'Tangle', 'skill', 'uncommon', 1, 'burr', 'Apply {n} Burrs, then double the foe’s Burrs. Exhaust.', { n: [3, 5], exhaust: true }, (g, v, t) => { g.hex(t, 'burrs', v.n); g.hex(t, 'burrs', g.foeHas(t, 'burrs')); });
aimed('alarmbark', 'Alarm Bark', 'skill', 'uncommon', 1, 'bark', ['Apply 1 Exposed and {n} Winded.', 'Apply 2 Exposed and {n} Winded.'], { n: [2, 3] }, (g, v, t) => { g.hex(t, 'exposed', v.up ? 2 : 1); g.hex(t, 'winded', v.n); });
add('groom', 'Groom', 'skill', 'uncommon', 1, 'heart', 'Heal {n} health. Exhaust.', { n: [5, 8], exhaust: true }, (g, v) => g.heal(v.n));
add('cheekstash', 'Cheek Stash', 'skill', 'uncommon', 1, 'cheek', 'Gain {b} Fluff. Next turn, gain 1 more energy.', { b: [6, 9] }, (g, v) => { g.fluff(v.b); g.buff('spare', 1); });
add('dustdevil', 'Dust Devil', 'skill', 'uncommon', 1, 'dust', 'Gain {b} Fluff. Apply 1 Exposed to ALL foes.', { b: [5, 8] }, (g, v) => { g.fluff(v.b); g.hexAll('exposed', 1); });
add('wintercoat', 'Winter Coat', 'power', 'uncommon', 1, 'coat', 'Gain {n} Thick Fur.', { n: [2, 3] }, (g, v) => g.buff('fur', v.n));
add('thezoomies', 'The Zoomies', 'power', 'uncommon', 1, 'zoom', 'Gain {n} Zoomies.', { n: [2, 3] }, (g, v) => g.buff('zoomies', v.n));
add('stickycoat', 'Sticky Coat', 'power', 'uncommon', 1, 'burr', 'At the start of your turn, apply {n} Burrs to ALL foes.', { n: [2, 3] }, (g, v) => g.buff('sticky', v.n));
add('cosynest', 'Cosy Nest', 'power', 'uncommon', 1, 'nest', 'At the end of your turn, gain {n} Fluff.', { n: [3, 4] }, (g, v) => g.buff('nest', v.n));
add('lightfeet', 'Light Feet', 'power', 'uncommon', [2, 1], 'paw', 'Whenever you play a card, gain 1 Fluff.', {}, (g) => g.buff('light', 1));
add('bramblecoat', 'Bramble Coat', 'power', 'uncommon', 1, 'thorn', 'Gain {n} Bristle.', { n: [4, 6] }, (g, v) => g.buff('bristle', v.n));

// ---------- Rare ----------
aimed('feast', 'Feast', 'attack', 'rare', 2, 'hay', 'Deal {d} damage. If that knocks the foe out, raise your max health by {n}. Exhaust.', { d: [12, 16], n: [3, 4], exhaust: true }, (g, v, t) => { g.hit(t, v.d); if (!g.foeIn(t)) g.raiseMax(v.n); });
add('furslip', 'Fur Slip', 'skill', 'rare', [2, 1], 'coat', 'The next hit that would cost you health costs none. Exhaust.', { exhaust: true }, (g) => g.buff('slip', 1));
add('endless', 'Endless Zoomies', 'power', 'rare', [3, 2], 'zoom', 'At the start of your turn, gain 2 Zoomies.', {}, (g) => g.buff('frenzy', 2));
add('deepburrow', 'Deep Burrow', 'power', 'rare', [2, 1], 'burrow', 'Your Fluff no longer falls away at the start of your turn.', {}, (g) => g.buff('den', 1));
add('avalanche', 'Avalanche', 'attack', 'rare', 3, 'rock', 'Deal {d} damage to ALL foes.', { d: [28, 36] }, (g, v) => g.hitAll(v.d));
add('stampede', 'Stampede', 'attack', 'rare', 2, 'drum', 'Deal {d} damage to a random foe {n} times.', { d: [6, 6], n: [4, 5] }, (g, v) => { for (let i = 0; i < v.n; i++) g.hitRandom(v.d); });
add('raisin', 'Raisin', 'skill', 'rare', 0, 'raisin', 'Gain {n} energy. Draw 2 cards. Exhaust.', { n: [1, 2], exhaust: true }, (g, v) => { g.addEnergy(v.n); g.draw(2); });
add('snowden', 'Snow Den', 'skill', 'rare', 2, 'snow', 'Gain {b} Fluff. Exhaust.', { b: [24, 30], exhaust: true }, (g, v) => g.fluff(v.b));
add('encore', 'Encore', 'skill', 'rare', [1, 0], 'drum', 'Your next attack this turn is played twice.', {}, (g) => g.buff('encore', 1));
add('brighteyed', 'Bright Eyed', 'power', 'rare', [1, 0], 'eye', 'Draw 1 more card every turn.', {}, (g) => g.buff('bright', 1));

// ---------- Dora's own: quick paws, sore spots and many small hits ----------
aimed('hopscotch', 'Hopscotch', 'attack', 'common', 1, 'jump', 'Deal {d} damage. Deal it again if you have already played a card this turn.', { d: [6, 8] }, (g, v, t) => { const again = g.playedBefore > 0; g.hit(t, v.d); if (again) g.hit(t, v.d); });
aimed('earflick', 'Ear Flick', 'attack', 'common', 0, 'paw', 'Deal {d} damage. Gain 1 Zoomies until the end of this turn.', { d: [3, 5] }, (g, v, t) => { g.hit(t, v.d); g.buff('zoomies', 1); g.buff('rush', 1); });
aimed('sidestep', 'Sidestep', 'skill', 'common', 1, 'zoom', 'Gain {b} Fluff. Apply 1 Exposed.', { b: [6, 9] }, (g, v, t) => { g.fluff(v.b); g.hex(t, 'exposed', 1); });
aimed('pinpoint', 'Pinpoint', 'attack', 'uncommon', 1, 'eye', 'Deal {d} damage. Deal it again if the foe is Exposed.', { d: [7, 10] }, (g, v, t) => { const open = g.foeHas(t, 'exposed') > 0; g.hit(t, v.d); if (open) g.hit(t, v.d); });
add('whirl', 'Whirligig', 'attack', 'uncommon', 2, 'tail', 'Deal {d} damage to ALL foes once for every card played this turn, this one included.', { d: [4, 5] }, (g, v) => { for (let i = g.playedBefore + 1; i > 0; i--) g.hitAll(v.d); });
add('secondwind', 'Second Wind', 'skill', 'uncommon', 0, 'heart', ['Gain 1 energy. Draw 1 card. Exhaust.', 'Gain 1 energy. Draw 2 cards. Exhaust.'], { exhaust: true }, (g, v) => { g.addEnergy(1); g.draw(v.up ? 2 : 1); });
aimed('thousandnips', 'A Thousand Nips', 'attack', 'rare', 2, 'bite', 'Deal {d} damage 6 times.', { d: [3, 4] }, (g, v, t) => { for (let i = 0; i < 6; i++) g.hit(t, v.d); });
add('spotlight', 'Spotlight', 'skill', 'rare', 1, 'eye', 'Apply {n} Exposed to ALL foes. Exhaust.', { n: [3, 4], exhaust: true }, (g, v) => g.hexAll('exposed', v.n));

// ---------- Enzo's own: a thick coat, burrs and heavy paws ----------
aimed('thump', 'Thump', 'attack', 'common', 1, 'paw', 'Deal {d} damage.', { d: [10, 13] }, (g, v, t) => { g.hit(t, v.d); });
add('hunker', 'Hunker Down', 'skill', 'common', 1, 'coat', 'Gain {b} Fluff.', { b: [10, 13] }, (g, v) => g.fluff(v.b));
aimed('burrbite', 'Burr Bite', 'attack', 'common', 1, 'burr', 'Deal {d} damage. Apply {n} Burrs to ALL foes.', { d: [6, 8], n: [2, 3] }, (g, v, t) => { g.hit(t, v.d); g.hexAll('burrs', v.n); });
add('quillburst', 'Quill Burst', 'attack', 'uncommon', 1, 'thorn', 'Deal {d} damage to ALL foes. Gain {n} Bristle.', { d: [5, 7], n: [2, 3] }, (g, v) => { g.hitAll(v.d); g.buff('bristle', v.n); });
add('padding', 'Padding', 'skill', 'uncommon', 2, 'nest', 'Gain {b} Fluff. Draw 1 card.', { b: [14, 18] }, (g, v) => { g.fluff(v.b); g.draw(1); });
aimed('burrroll', 'Burr Roll', 'skill', 'uncommon', 1, 'roll', 'Apply {n} Burrs and 1 Winded.', { n: [6, 8] }, (g, v, t) => { g.hex(t, 'burrs', v.n); g.hex(t, 'winded', 1); });
add('earthshaker', 'Earthshaker', 'attack', 'rare', 2, 'rock', 'Deal {d} damage and apply {n} Winded to ALL foes.', { d: [10, 14], n: [1, 2] }, (g, v) => { g.hitAll(v.d); g.hexAll('winded', v.n); });
add('ironhide', 'Iron Hide', 'power', 'rare', 2, 'coat', 'Gain {n} Thick Fur and {n} Bristle.', { n: [2, 3] }, (g, v) => { g.buff('fur', v.n); g.buff('bristle', v.n); });

// Which of the cards above belong to one chinchilla. The rest, and everything in the starting deck, are shared.
const ONLY: Record<Who, string[]> = {
  dora: ['followup', 'flurry', 'windup', 'scamper', 'fullpelt', 'ambush', 'alarmbark', 'dustdevil', 'lightfeet', 'endless', 'encore', 'brighteyed',
    'hopscotch', 'earflick', 'sidestep', 'pinpoint', 'whirl', 'secondwind', 'thousandnips', 'spotlight'],
  enzo: ['burrfling', 'burrpatch', 'pricklycurl', 'bellyflop', 'burrstorm', 'sorespot', 'puffup', 'tangle', 'stickycoat', 'bramblecoat', 'deepburrow',
    'thump', 'hunker', 'burrbite', 'quillburst', 'padding', 'burrroll', 'earthshaker', 'ironhide'],
};
for (const who of Object.keys(ONLY) as Who[]) for (const id of ONLY[who]) list.find((c) => c.id === id)!.who = who;

// ---------- Cards nobody wants: predators and bad luck put them in the deck ----------
add('daze', 'Daze', 'status', 'special', -2, 'daze', 'Cannot be played. Fades at the end of the turn.', { fades: true });
add('thorn', 'Thorn', 'status', 'special', -2, 'thorn', 'Cannot be played. Deals 2 damage to you if it is in your hand at the end of your turn.', { sting: 2 });
add('mud', 'Mud', 'status', 'special', 1, 'mud', 'Does nothing. Exhaust.', { exhaust: true }, () => {});
add('fright', 'Fright', 'curse', 'special', -2, 'fright', 'Cannot be played. It stays in your deck until a treat stall or a dust hollow takes it out.', {});

export const CARDS: Record<string, CardDef> = Object.fromEntries(list.map((c) => [c.id, c]));
export const CARD_IDS = list.map((c) => c.id);
/** The cards that can turn up as rewards and in the stall. */
export const POOL = list.filter((c) => c.rarity === 'common' || c.rarity === 'uncommon' || c.rarity === 'rare').map((c) => c.id);
/** The part of the pool one chinchilla draws from: the shared cards and their own. */
export const poolFor = (who: Who) => POOL.filter((id) => !CARDS[id].who || CARDS[id].who === who);
export const STARTER_DECK = ['nip', 'nip', 'nip', 'nip', 'nip', 'fluffup', 'fluffup', 'fluffup', 'fluffup', 'dustkick'];

export type Card = { id: string; up: boolean; uid: number };
export const costOf = (c: { id: string; up: boolean }) => CARDS[c.id].cost[c.up ? 1 : 0];
export const nameOf = (c: { id: string; up: boolean }) => CARDS[c.id].name + (c.up ? '+' : '');
const pick = (p: Pair | undefined, up: boolean) => (p ? p[up ? 1 : 0] : 0);
export const valsOf = (c: { id: string; up: boolean }, x = 0): Vals => { const d = CARDS[c.id]; return { d: pick(d.d, c.up), b: pick(d.b, c.up), n: pick(d.n, c.up), x, up: c.up }; };
/** Whether upgrading would change anything. Status cards and curses have no better version. */
export const canUpgrade = (c: { id: string; up: boolean }) => { const d = CARDS[c.id]; return !c.up && d.type !== 'status' && d.type !== 'curse'; };
/**
 * A card's rules text with its numbers filled in. In a fight, `dmg` and `fluff` turn the printed numbers into what
 * the card would do right now, with Zoomies, Winded, Thick Fur and Matted counted.
 */
export function describe(c: { id: string; up: boolean }, now?: { dmg: (d: number) => number; fluff: (b: number) => number }): string {
  const d = CARDS[c.id], v = valsOf(c), text = typeof d.text === 'string' ? d.text : d.text[c.up ? 1 : 0];
  return text.replace(/\{d\}/g, String(now ? now.dmg(v.d) : v.d)).replace(/\{b\}/g, String(now ? now.fluff(v.b) : v.b)).replace(/\{n\}/g, String(v.n));
}

// ---------- Words worth explaining ----------
export type Gloss = { name: string; icon: string; text: string };
/** The words on cards, trinkets and intents that mean something particular, each said once in plain terms. */
export const GLOSSARY: Gloss[] = [
  { name: 'Fluff', icon: '🛡️', text: 'Soaks up damage before health does. It falls away at the start of its owner’s next turn.' },
  { name: 'Exposed', icon: STATUS.exposed.icon, text: 'Takes half as much again from attacks. Counts down one each turn.' },
  { name: 'Winded', icon: STATUS.winded.icon, text: 'Its attacks deal a quarter less. Counts down one each turn.' },
  { name: 'Matted', icon: STATUS.matted.icon, text: 'Cards give a quarter less Fluff. Counts down one each turn.' },
  { name: 'Burrs', icon: STATUS.burrs.icon, text: 'Loses that much health at the start of its turn, straight past any Fluff. Then one burr falls off.' },
  { name: 'Zoomies', icon: STATUS.zoomies.icon, text: 'Every attack hit deals that much more damage.' },
  { name: 'Bristle', icon: STATUS.bristle.icon, text: 'Whoever attacks takes that much damage for each hit.' },
  { name: 'Thick Fur', icon: STATUS.fur.icon, text: 'Cards give that much more Fluff.' },
  { name: 'Exhaust', icon: '🌫️', text: 'Once played, it is gone until the fight is over.' },
  { name: 'Daze', icon: '💫', text: 'A card that cannot be played and fades at the end of the turn.' },
  { name: 'Thorn', icon: '🌿', text: 'A card that cannot be played and deals 2 damage if it is still in hand at the end of the turn.' },
  { name: 'Mud', icon: '🟤', text: 'A card that costs 1 energy and does nothing.' },
  { name: 'Fright', icon: '😱', text: 'A card that cannot be played and stays in the deck until something takes it out.' },
];
/** The glossary entries for the words a line of rules text uses, in the order they come up. `skip` is a word not to explain, such as the card's own name. */
export function glossFor(text: string, skip = ''): Gloss[] {
  return GLOSSARY.map((g) => ({ g, at: text.search(new RegExp(`\\b${g.name}s?\\b`)) })).filter((x) => x.at >= 0 && x.g.name !== skip).sort((a, b) => a.at - b.at).map((x) => x.g);
}

// ---------- Trinkets ----------
export type TrinketTier = 'start' | 'common' | 'boss';
export type TrinketDef = { id: string; name: string; tier: TrinketTier; icon: string; text: string };
const T = (id: string, name: string, tier: TrinketTier, icon: string, text: string): TrinketDef => ({ id, name, tier, icon, text });
const trinkets: TrinketDef[] = [
  T('bell', 'Ruby Bell', 'start', '🔔', 'On the first turn of every fight, draw 2 more cards and gain 1 more energy.'),
  T('scarf', 'Grey Scarf', 'start', '🧣', 'Heal 5 health after every fight.'),

  T('haycube', 'Hay Cube', 'common', '📦', 'Start every fight with 8 Fluff.'),
  T('pumice', 'Pumice Stone', 'common', '🌑', 'Start every fight with 1 Zoomies.'),
  T('chewstick', 'Chew Stick', 'common', '🥢', 'Your first attack card in every fight deals 8 more damage with each hit.'),
  T('rosehip', 'Dried Rosehip', 'common', '🌹', 'Naps at a rest burrow heal 15 more health.'),
  T('wolfberry', 'Golden Wolfberry', 'common', '🍒', 'Raises your max health by 10.'),
  T('pebble', 'Lucky Pebble', 'common', '🍀', 'Every fight you win pays 12 more seeds.'),
  T('wheel', 'Running Wheel', 'common', '🎡', 'Gain 1 more energy on every third turn of a fight.'),
  T('lavaledge', 'Lava Ledge', 'common', '🌋', 'Exposed foes take three quarters more from your attacks, not half.'),
  T('dusthouse', 'Dust House', 'common', '🏠', 'Every foe starts the fight Exposed for 1 turn.'),
  T('hammock', 'Fleece Hammock', 'common', '🛏️', 'If you end your turn with no Fluff, gain 6.'),
  T('slab', 'Granite Slab', 'common', '⬛', 'Every hit that gets through your Fluff costs 1 less health, down to 1.'),
  T('burrcomb', 'Burr Comb', 'common', '🖌️', 'Whenever you apply Burrs, apply 1 more.'),
  T('collar', 'Bramble Collar', 'common', '🌵', 'Start every fight with 3 Bristle.'),
  T('loyalty', 'Stall Stamp Card', 'common', '🎟️', 'Everything at a treat stall costs 30% less.'),
  T('hayrack', 'Hay Rack', 'common', '🌾', 'Whenever your discard pile is shuffled back into your draw pile, gain 5 Fluff.'),
  T('raisinstash', 'Raisin Stash', 'common', '🍇', 'If you finish a fight at half health or less, heal 10.'),
  T('chewtoy', 'Apple Chew', 'common', '🍎', 'When you find this, two cards in your deck are upgraded.'),
  T('alarmcall', 'Tin Whistle', 'common', '📯', 'Whenever a foe is knocked out, gain 1 energy and draw 1 card.'),
  T('moss', 'Moss Blanket', 'common', '🌿', 'Gain 12 Fluff at the start of your second turn in every fight.'),
  T('clover', 'Four-leaf Clover', 'common', '☘️', 'Card rewards show one more card to choose from.'),
  T('lantern', 'Glow Beetle Jar', 'common', '🏮', 'Gain 1 more energy on the first turn of every fight.'),
  T('goggles', 'Snow Goggles', 'common', '👓', 'Whenever you draw a Daze, a Thorn or a Mud, draw another card.'),

  T('springwater', 'Spring Water', 'boss', '💧', 'Gain 1 more energy every turn. You can no longer nap at rest burrows.'),
  T('suncrown', 'Sunflower Crown', 'boss', '🌻', 'Gain 1 more energy every turn. Every fight starts with 2 Thorns in your draw pile.'),
  T('emptypouch', 'Hole in the Pouch', 'boss', '👝', 'Gain 1 more energy every turn. Fights no longer pay seeds.'),
  T('twigs', 'Apple Twigs', 'boss', '🌱', 'Draw 1 more card every turn.'),
  T('summittea', 'Summit Tea', 'boss', '🍵', 'Raises your max health by 12 and heals you to full.'),
  T('claws', 'Filed Claws', 'boss', '💅', 'Start every fight with 2 Zoomies. So does every foe, with 1.'),
];
export const TRINKETS: Record<string, TrinketDef> = Object.fromEntries(trinkets.map((t) => [t.id, t]));
export const TRINKET_IDS = trinkets.map((t) => t.id);
