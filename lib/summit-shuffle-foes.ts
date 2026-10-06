// Summit Shuffle's predators: what each one can do, how it picks its next move, and which of them turn up together
// on each of the mountain's three stretches. Every move is plain data, so the engine can show it as an intent a turn
// before it happens.
import type { Statuses } from './summit-shuffle-cards.js';

export type Move = {
  name: string;
  /** Attack damage per hit, and how many hits. */
  dmg?: number; hits?: number;
  /** Fluff for itself. */
  block?: number;
  /** Statuses for itself, and for the chinchilla. */
  self?: Statuses; hero?: Statuses;
  /** Unwanted cards for the chinchilla's deck: [card, how many, which pile]. */
  add?: [string, number, 'discard' | 'draw'];
  /** Seeds taken with each hit that lands. */
  steal?: number;
  /** Runs away, taking whatever it stole. */
  flee?: boolean;
  /** Calls [kind, how many] to its side. */
  summon?: [string, number];
  /** Drops its own Exposed, Winded and Burrs. */
  shed?: boolean;
  /** Does nothing at all this turn. */
  idle?: boolean;
};
/** What a predator knows when it picks its next move. `roll` is 0 to 99. `mem` is its own to keep notes in. */
export type Mind = { turn: number; last: string[]; roll: number; low: boolean; mem: Record<string, number>; allies: number };
export type Shape = 'fox' | 'snake' | 'owl' | 'weasel' | 'hawk' | 'cougar' | 'skunk' | 'beetle' | 'armadillo' | 'lizard' | 'chin';
export type Look = { shape: Shape; body: string; dark: string; light: string; eye: string; /** Height on the stage, where a chinchilla is 100. */ h: number; fly?: boolean };
export type FoeDef = { id: string; name: string; hp: [number, number]; look: Look; start?: Statuses; startFluff?: number; moves: Record<string, Move>; next: (m: Mind) => string; blurb: string };

const was = (m: Mind, id: string, back = 1) => m.last[m.last.length - back] === id;
/** Goes round the list in order. */
const cycle = (...ids: string[]) => (m: Mind) => ids[m.turn % ids.length];
/** Picks by weight, never the same move more than `most` times running. */
const mix = (table: [string, number][], most = 1) => (m: Mind) => {
  const open = table.filter(([id]) => { for (let b = 1; b <= most; b++) if (!was(m, id, b)) return true; return false; });
  const pool = open.length ? open : table, total = pool.reduce((s, [, w]) => s + w, 0);
  let r = (m.roll / 100) * total;
  for (const [id, w] of pool) { r -= w; if (r < 0) return id; }
  return pool[pool.length - 1][0];
};

const F = (def: FoeDef) => def;
const list: FoeDef[] = [
  // ----- The Foothills -----
  F({ id: 'snake', name: 'Grass Snake', hp: [32, 38], look: { shape: 'snake', body: '#5fae55', dark: '#3c7d3a', light: '#cdeaa0', eye: '#ffe066', h: 78 },
    moves: { bite: { name: 'Bite', dmg: 7 }, hiss: { name: 'Hiss', hero: { exposed: 2 } }, lash: { name: 'Tail Lash', dmg: 5, block: 5 } },
    next: (m) => (m.turn === 0 ? (m.roll < 60 ? 'hiss' : 'bite') : mix([['bite', 50], ['hiss', 20], ['lash', 30]])(m)), blurb: 'Hisses to leave you Exposed, then bites.' }),
  F({ id: 'weasel', name: 'Weasel', hp: [20, 25], look: { shape: 'weasel', body: '#a8794e', dark: '#4a3324', light: '#f6ead6', eye: '#16121a', h: 66 },
    moves: { nip: { name: 'Nip', dmg: 5 }, scurry: { name: 'Scurry', dmg: 2, hits: 2 }, workup: { name: 'Work Up', block: 3, self: { zoomies: 2 } } },
    next: mix([['nip', 45], ['scurry', 30], ['workup', 25]]), blurb: 'Quick and never alone. It works itself up to hit harder.' }),
  F({ id: 'beetle', name: 'Burr Beetle', hp: [12, 14], look: { shape: 'beetle', body: '#8a5a3c', dark: '#4a2f22', light: '#e2b56a', eye: '#16121a', h: 44 }, start: { curl: 3 },
    moves: { bite: { name: 'Bite', dmg: 4 }, fling: { name: 'Mud Fling', dmg: 3, add: ['mud', 1, 'discard'] } },
    next: mix([['bite', 65], ['fling', 35]], 2), blurb: 'Small, curls up when first hurt, and flings Mud into your deck.' }),
  F({ id: 'youngfox', name: 'Young Fox', hp: [49, 55], look: { shape: 'fox', body: '#e58436', dark: '#3a2a2a', light: '#fff4e4', eye: '#1a1418', h: 88 },
    moves: { snap: { name: 'Snap', dmg: 8 }, crouch: { name: 'Crouch', block: 8 }, pounce: { name: 'Pounce', dmg: 14 } },
    next: (m) => (was(m, 'crouch') ? 'pounce' : mix([['snap', 60], ['crouch', 40]], 2)(m)), blurb: 'When it crouches, a big pounce is coming next turn.' }),
  F({ id: 'vizcacha', name: 'Thieving Vizcacha', hp: [41, 46], look: { shape: 'chin', body: '#a98a62', dark: '#6a5238', light: '#efe2c6', eye: '#16121a', h: 96 },
    moves: { swipe: { name: 'Swipe', dmg: 6, steal: 12 }, pack: { name: 'Pack Up', block: 12 }, flee: { name: 'Run Off', flee: true } },
    next: (m) => (m.turn < 2 ? 'swipe' : m.turn === 2 ? 'pack' : 'flee'), blurb: 'Steals seeds with every swipe that lands, then runs. Knock it out to get them back.' }),
  // Alphas
  F({ id: 'skunk', name: 'Alpha Skunk', hp: [78, 84], look: { shape: 'skunk', body: '#2e2a33', dark: '#1c1920', light: '#f4f1ea', eye: '#f4f1ea', h: 104 },
    moves: { spray: { name: 'Spray', hero: { winded: 2, matted: 2 }, self: { zoomies: 2 } }, claw: { name: 'Claw', dmg: 10 }, scratch: { name: 'Double Scratch', dmg: 5, hits: 2 }, slam: { name: 'Tail Slam', dmg: 14 } },
    next: cycle('spray', 'claw', 'scratch', 'slam'), blurb: 'Its spray leaves you Winded and Matted, and it comes back stronger after each one.' }),
  F({ id: 'dozingowl', name: 'Dozing Owl', hp: [86, 92], look: { shape: 'owl', body: '#8a6a4c', dark: '#6b4f3a', light: '#e9d9bd', eye: '#ffd23e', h: 108, fly: true }, start: { doze: 3 }, startFluff: 8,
    moves: { sleep: { name: 'Asleep', block: 8 }, stir: { name: 'Waking Up', idle: true }, talon: { name: 'Talon', dmg: 13 }, screech: { name: 'Screech', hero: { exposed: 2 }, add: ['daze', 2, 'draw'] } },
    next: (m) => (m.mem.asleep ? 'sleep' : m.mem.stirred ? cycle('talon', 'talon', 'screech')({ ...m, turn: m.mem.awake }) : 'stir'), blurb: 'Fast asleep under its feathers. Hit it hard while you can: it wakes up angry.' }),
  // Guardian
  F({ id: 'oldfox', name: 'Russet, the Old Fox', hp: [130, 136], look: { shape: 'fox', body: '#c9652d', dark: '#33221f', light: '#f6e6cf', eye: '#ffd23e', h: 134 },
    moves: { stalk: { name: 'Stalk', block: 10, hero: { exposed: 1 } }, snap: { name: 'Snap', dmg: 5, hits: 2 }, pounce: { name: 'Pounce', dmg: 16 }, howl: { name: 'Howl', self: { zoomies: 2 }, hero: { winded: 1 } }, call: { name: 'Call the Kits', summon: ['kit', 2], block: 8 } },
    next: (m) => { if (m.low && !m.mem.called) { m.mem.called = 1; return 'call'; } return cycle('stalk', 'snap', 'pounce', 'howl')({ ...m, turn: m.turn - (m.mem.called ? 1 : 0) }); }, blurb: 'Stalks, snaps and pounces in a steady round, and calls two kits when it is half beaten.' }),
  F({ id: 'kit', name: 'Fox Kit', hp: [13, 16], look: { shape: 'fox', body: '#eea05a', dark: '#4a3430', light: '#fff4e4', eye: '#1a1418', h: 58 },
    moves: { nip: { name: 'Nip', dmg: 4 }, yap: { name: 'Yap', self: { zoomies: 1 }, block: 3 } }, next: mix([['nip', 70], ['yap', 30]]), blurb: 'A small fox with a small bite.' }),

  // ----- The Cliffs -----
  F({ id: 'hawk', name: 'Cliff Hawk', hp: [61, 67], look: { shape: 'hawk', body: '#7c5a3e', dark: '#4a3526', light: '#ead9bf', eye: '#ffcf3e', h: 92, fly: true },
    moves: { circle: { name: 'Circle', block: 9, self: { zoomies: 1 } }, peck: { name: 'Peck', dmg: 9 }, dive: { name: 'Dive', dmg: 16 } },
    next: (m) => (was(m, 'circle') ? 'dive' : mix([['peck', 55], ['circle', 45]], 2)(m)), blurb: 'Circles, then dives. Each circle makes it a little stronger.' }),
  F({ id: 'viper', name: 'Mountain Viper', hp: [54, 61], look: { shape: 'snake', body: '#b08a4a', dark: '#6e4f2a', light: '#f0dfa8', eye: '#ff7a3a', h: 84 },
    moves: { strike: { name: 'Strike', dmg: 10 }, coil: { name: 'Coil', self: { zoomies: 2 }, block: 6 }, hiss: { name: 'Hiss', hero: { exposed: 2 }, add: ['daze', 1, 'discard'] } },
    next: mix([['strike', 50], ['coil', 25], ['hiss', 25]]), blurb: 'Coils to hit harder and hisses to leave you Exposed and dazed.' }),
  F({ id: 'armadillo', name: 'Grumpy Armadillo', hp: [57, 64], look: { shape: 'armadillo', body: '#b79a7a', dark: '#6e5844', light: '#ecdcc4', eye: '#16121a', h: 74 }, start: { bristle: 2 },
    moves: { curl: { name: 'Curl', block: 12 }, roll: { name: 'Roll', dmg: 11 } }, next: (m) => (m.turn % 3 === 0 ? 'curl' : 'roll'), blurb: 'Its plates hurt whoever attacks it. Burrs get past them.' }),
  F({ id: 'lizard', name: 'Rock Lizard', hp: [21, 24], look: { shape: 'lizard', body: '#7fa06a', dark: '#4c6a42', light: '#dfe8b6', eye: '#ffd23e', h: 46 },
    moves: { bite: { name: 'Bite', dmg: 5 }, lash: { name: 'Tail Lash', dmg: 3, hero: { winded: 1 } }, bask: { name: 'Bask', self: { zoomies: 1 } } },
    next: mix([['bite', 50], ['lash', 25], ['bask', 25]]), blurb: 'Basks to get stronger. Deal with a pack of them quickly.' }),
  F({ id: 'pampas', name: 'Pampas Cat', hp: [74, 79], look: { shape: 'cougar', body: '#b9a27a', dark: '#6f5a3c', light: '#f3e8d2', eye: '#b6e060', h: 96 },
    moves: { swipe: { name: 'Swipe', dmg: 6, hits: 2 }, pounce: { name: 'Pounce', dmg: 13, hero: { exposed: 1 } }, hide: { name: 'Hide', block: 10 } },
    next: mix([['swipe', 45], ['pounce', 35], ['hide', 20]]), blurb: 'Two quick swipes, or one pounce that leaves you Exposed.' }),
  F({ id: 'bandit', name: 'Vizcacha Bandit', hp: [64, 70], look: { shape: 'chin', body: '#8f7a5c', dark: '#54432e', light: '#e6d8bc', eye: '#16121a', h: 100 },
    moves: { swipe: { name: 'Swipe', dmg: 8, steal: 15 }, pack: { name: 'Pack Up', block: 16 }, flee: { name: 'Run Off', flee: true } },
    next: (m) => (m.turn < 2 ? 'swipe' : m.turn === 2 ? 'pack' : 'flee'), blurb: 'Steals seeds with every swipe that lands, then runs. Knock it out to get them back.' }),
  // Alphas
  F({ id: 'hornedowl', name: 'Alpha Horned Owl', hp: [131, 140], look: { shape: 'owl', body: '#6f5a48', dark: '#3f3228', light: '#e3d2b4', eye: '#ffb02e', h: 128, fly: true },
    moves: { swoop: { name: 'Silent Swoop', dmg: 18 }, screech: { name: 'Screech', hero: { winded: 2 }, add: ['daze', 2, 'draw'] }, talons: { name: 'Talons', dmg: 6, hits: 3 }, mantle: { name: 'Mantle', block: 16, self: { zoomies: 2 } } },
    next: cycle('screech', 'swoop', 'talons', 'mantle'), blurb: 'Its screech fills your draw pile with Daze, and it mantles to grow stronger.' }),
  F({ id: 'grison', name: 'Alpha Grison', hp: [64, 69], look: { shape: 'weasel', body: '#8d8a92', dark: '#232127', light: '#f2efe8', eye: '#16121a', h: 88 }, start: { bond: 3 },
    moves: { bite: { name: 'Bite', dmg: 10 }, flurry: { name: 'Flurry', dmg: 3, hits: 3 }, brace: { name: 'Brace', block: 9 } },
    next: mix([['bite', 45], ['flurry', 35], ['brace', 20]]), blurb: 'Hunts as a pair. When one is knocked out the other turns furious.' }),
  // Guardian
  F({ id: 'condor', name: 'The Old Condor', hp: [221, 232], look: { shape: 'hawk', body: '#2f2c36', dark: '#17151c', light: '#f1ede4', eye: '#ff6a4a', h: 168, fly: true },
    moves: { buffet: { name: 'Wing Buffet', dmg: 5, hits: 3 }, updraft: { name: 'Updraft', block: 16, self: { zoomies: 1 } }, drop: { name: 'Rock Drop', dmg: 20 }, shadow: { name: 'Great Shadow', hero: { exposed: 1, matted: 2 }, add: ['daze', 2, 'discard'] } },
    next: cycle('shadow', 'buffet', 'updraft', 'drop'), blurb: 'Every updraft makes it stronger, and the rock it drops afterwards is the biggest hit on the cliffs.' }),

  // ----- The Snowline -----
  F({ id: 'andeancat', name: 'Andean Cat', hp: [88, 96], look: { shape: 'cougar', body: '#9a9aa6', dark: '#4e4c5a', light: '#f1f0f4', eye: '#e8c84a', h: 100 },
    moves: { slash: { name: 'Slash', dmg: 12 }, stalk: { name: 'Stalk', block: 12, self: { zoomies: 2 } }, lunge: { name: 'Lunge', dmg: 7, hits: 2 } },
    next: mix([['slash', 40], ['stalk', 25], ['lunge', 35]]), blurb: 'Stalks to get stronger, then slashes or lunges twice.' }),
  F({ id: 'eagle', name: 'Buzzard-Eagle', hp: [92, 99], look: { shape: 'hawk', body: '#5a5f6e', dark: '#2c2f3a', light: '#f3f1ea', eye: '#ffcf3e', h: 112, fly: true },
    moves: { rise: { name: 'Rise', block: 14 }, dive: { name: 'Dive', dmg: 19 }, screech: { name: 'Screech', hero: { exposed: 2 } } },
    next: (m) => (was(m, 'rise') || was(m, 'screech') ? 'dive' : m.roll < 55 ? 'rise' : 'screech'), blurb: 'Every other turn is a dive. Use the turn between to get ready.' }),
  F({ id: 'snowviper', name: 'Snow Viper', hp: [54, 61], look: { shape: 'snake', body: '#c9d6e2', dark: '#7f93a6', light: '#ffffff', eye: '#5ad1ff', h: 86 },
    moves: { strike: { name: 'Strike', dmg: 10 }, hiss: { name: 'Frost Hiss', hero: { matted: 2, winded: 1 } }, coil: { name: 'Coil', block: 8, self: { zoomies: 2 } } },
    next: mix([['strike', 50], ['hiss', 25], ['coil', 25]]), blurb: 'Its frost hiss leaves you Matted and Winded.' }),
  F({ id: 'scavenger', name: 'Condor Scavenger', hp: [65, 72], look: { shape: 'hawk', body: '#3b3842', dark: '#1e1c24', light: '#e9e4da', eye: '#ffb02e', h: 100, fly: true }, start: { rage: 1 },
    moves: { peck: { name: 'Peck', dmg: 7 }, flap: { name: 'Flap', block: 8, dmg: 4 } }, next: mix([['peck', 65], ['flap', 35]], 2), blurb: 'Gets hungrier, and stronger, every turn the fight goes on.' }),
  F({ id: 'youngpuma', name: 'Young Puma', hp: [120, 130], look: { shape: 'cougar', body: '#c9995a', dark: '#8a6234', light: '#f5ead8', eye: '#c8e060', h: 122 },
    moves: { swipe: { name: 'Swipe', dmg: 14 }, roar: { name: 'Roar', self: { zoomies: 2 }, hero: { winded: 2 } }, maul: { name: 'Maul', dmg: 8, hits: 2 } },
    next: (m) => (m.turn === 0 ? 'roar' : mix([['swipe', 45], ['maul', 35], ['roar', 20]])(m)), blurb: 'Opens with a roar that leaves you Winded, then swipes and mauls.' }),
  F({ id: 'icebeetle', name: 'Ice Beetle', hp: [24, 27], look: { shape: 'beetle', body: '#7fb6d6', dark: '#3d6f8f', light: '#e6f6ff', eye: '#16121a', h: 48 }, start: { curl: 4 },
    moves: { bite: { name: 'Bite', dmg: 5 }, fling: { name: 'Slush Fling', dmg: 4, add: ['mud', 1, 'discard'] } }, next: mix([['bite', 65], ['fling', 35]], 2), blurb: 'A tougher beetle that curls up harder and flings slush.' }),
  // Alphas
  F({ id: 'puma', name: 'Alpha Puma', hp: [176, 187], look: { shape: 'cougar', body: '#b9853f', dark: '#6f4a22', light: '#f3e4c8', eye: '#ffd23e', h: 150 },
    moves: { maul: { name: 'Maul', dmg: 20 }, rake: { name: 'Rake', dmg: 8, hits: 2, hero: { exposed: 1 } }, roar: { name: 'Roar', block: 12, self: { zoomies: 2 } } },
    next: cycle('rake', 'maul', 'roar'), blurb: 'Rakes you open, mauls, then roars itself stronger. It only gets worse.' }),
  F({ id: 'snowowl', name: 'Alpha Snowy Owl', hp: [164, 175], look: { shape: 'owl', body: '#e9eef4', dark: '#9aa7b6', light: '#ffffff', eye: '#ffd23e', h: 134, fly: true },
    moves: { wings: { name: 'Blizzard Wings', dmg: 4, hits: 4 }, hush: { name: 'Hush', block: 15, add: ['daze', 3, 'draw'] }, talon: { name: 'Talon', dmg: 21 }, glare: { name: 'Glare', hero: { winded: 2, matted: 2 }, self: { zoomies: 2 } } },
    next: cycle('hush', 'wings', 'talon', 'glare'), blurb: 'Hushes your deck with Daze, then beats four times with its wings.' }),
  // Guardian
  F({ id: 'cougar', name: 'The Cougar of the Summit', hp: [302, 314], look: { shape: 'cougar', body: '#d2a15c', dark: '#7e5626', light: '#fbf0dc', eye: '#ff5a3a', h: 190 },
    moves: {
      prowl: { name: 'Prowl', block: 12, self: { zoomies: 1 } }, swipe: { name: 'Swipe', dmg: 10, hits: 2 }, maul: { name: 'Maul', dmg: 23 }, roar: { name: 'Roar', hero: { winded: 1, exposed: 1, matted: 1 } },
      fury: { name: 'Fury', shed: true, self: { zoomies: 2 }, block: 16 }, frenzy: { name: 'Frenzy', dmg: 6, hits: 4 }, crush: { name: 'Crushing Maul', dmg: 26 },
    },
    next: (m) => {
      if (m.low && !m.mem.fury) { m.mem.fury = 1; m.mem.at = m.turn + 1; return 'fury'; }
      return m.mem.fury ? cycle('frenzy', 'crush', 'prowl')({ ...m, turn: m.turn - m.mem.at }) : cycle('roar', 'swipe', 'prowl', 'maul')(m);
    }, blurb: 'The last guardian. At half health it shakes off everything you have done to it and turns furious.' }),
];
export const FOES: Record<string, FoeDef> = Object.fromEntries(list.map((f) => [f.id, f]));
export const FOE_IDS = list.map((f) => f.id);

export type ActDef = { name: string; blurb: string; easy: string[][]; hard: string[][]; alphas: string[][]; boss: string[] };
export const ACTS: ActDef[] = [
  { name: 'The Foothills', blurb: 'Scrub, burrs and long grass.',
    easy: [['snake'], ['weasel', 'weasel'], ['beetle', 'beetle', 'beetle']],
    hard: [['youngfox'], ['snake', 'weasel'], ['beetle', 'beetle', 'snake'], ['vizcacha'], ['youngfox', 'beetle'], ['weasel', 'weasel', 'weasel']],
    alphas: [['skunk'], ['dozingowl']], boss: ['oldfox'] },
  { name: 'The Cliffs', blurb: 'Bare rock, ledges and a long way down.',
    easy: [['hawk'], ['viper'], ['lizard', 'lizard', 'lizard']],
    hard: [['armadillo', 'viper'], ['pampas'], ['hawk', 'lizard'], ['lizard', 'lizard', 'armadillo'], ['bandit'], ['viper', 'viper'], ['pampas', 'lizard']],
    alphas: [['hornedowl'], ['grison', 'grison']], boss: ['condor'] },
  { name: 'The Snowline', blurb: 'Thin air, snow and the summit.',
    easy: [['andeancat'], ['eagle'], ['snowviper', 'snowviper']],
    hard: [['scavenger', 'scavenger'], ['youngpuma'], ['andeancat', 'snowviper'], ['icebeetle', 'icebeetle', 'icebeetle', 'icebeetle'], ['eagle', 'icebeetle', 'icebeetle'], ['youngpuma', 'icebeetle']],
    alphas: [['puma'], ['snowowl']], boss: ['cougar'] },
];
