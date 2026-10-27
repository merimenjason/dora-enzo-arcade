// Burrow Command's content as data: the three sides (their units, buildings and upgrades), the maps and the numbers the
// simulation runs on. No DOM and no randomness: command-game.ts turns these tables into a match.

export type SideId = 'colony' | 'guild' | 'hive';
export type Res = 'hay' | 'glimmer';
export type AbilityId = 'cloud' | 'song' | 'firm' | 'snare' | 'shiny' | 'brood' | 'overwind' | 'pack' | 'unpack' | 'tunnel';
export type UpgradeEffect = { dmg?: number; armor?: number; speed?: number; wind?: number; regen?: number; hp?: number };

export type UnitDef = {
  id: string; side: SideId; name: string; blurb: string;
  hay: number; glimmer: number; supply: number; /** seconds to train */ time: number;
  hp: number; armor: number; dmg: number; /** reach in tiles, edge to edge */ range: number; /** seconds between hits */ cd: number;
  /** tiles a second */ speed: number; /** tiles */ sight: number; /** body radius in tiles */ r: number;
  air?: boolean; hitsAir: boolean; hitsGround: boolean; worker?: boolean;
  /** damage multiplier against buildings */ siege?: number; /** splash radius in tiles */ splash?: number;
  hero?: boolean; ability?: AbilityId; /** at most this many at once */ limit?: number; key: string;
  /** a ranged attack throws something the scene draws */ shot?: 'pebble' | 'dust' | 'lid' | 'oil' | 'acorn' | 'apple' | 'spark' | 'seed';
};
export type BuildingDef = {
  id: string; side: SideId; name: string; blurb: string;
  hay: number; glimmer: number; time: number; hp: number; armor: number; size: 2 | 3;
  supply?: number; hq?: boolean; trains: string[]; research: string[]; req: string[];
  tower?: { dmg: number; range: number; cd: number; hitsAir: boolean; shot: UnitDef['shot'] };
  heal?: { r: number; hp: number }; spring?: number; tunnel?: boolean; ability?: AbilityId; key: string;
};
export type UpgradeDef = { id: string; side: SideId; name: string; blurb: string; hay: number; glimmer: number; time: number; effect: UpgradeEffect; key: string };
export type AbilityDef = { id: AbilityId; name: string; blurb: string; /** seconds */ cd: number; /** tiles; 0 means it needs no target */ range: number; radius: number; key: string };
export type SideDef = { id: SideId; name: string; short: string; folk: string; blurb: string; color: string; hq: string; house: string; worker: string; special: string };

export const TICK_HZ = 20;
/** World units in a tile. Positions are whole numbers of these, so the simulation never depends on rounding. */
export const T = 256;
export const MAX_SUPPLY = 60;
export const START_HAY = 150;
export const START_WORKERS = 5;
export const CARRY: Record<Res, number> = { hay: 5, glimmer: 4 };
/** Ticks a worker spends filling its basket at a node. */
export const GATHER_TICKS: Record<Res, number> = { hay: 28, glimmer: 44 };
export const NODE_AMOUNT: Record<Res, number> = { hay: 1500, glimmer: 1200 };
/** Workers that can work one node at once; any more look for another. */
export const NODE_SLOTS: Record<Res, number> = { hay: 2, glimmer: 3 };
/** Hive units run down over this many seconds away from a spring, and wind back up this many times faster near one. */
export const WIND_SECONDS = 70;
export const REWIND_RATE = 10;
/** A wound-down beetle moves and acts at this share of its pace (percent). */
export const WOUND_DOWN = 50;
/** A hive shell mends 1 health every SHELL_MEND ticks once it has gone SHELL_REST ticks without a bump. */
export const SHELL_REST = 100;
export const SHELL_MEND = 8;
/** Heroes mend 1 health every HERO_MEND ticks once they have gone HERO_REST ticks without a bump. */
export const HERO_REST = 100;
export const HERO_MEND = 4;
/** The Guild picks up this share (percent) of a poofed rival's cost when one of its own is within SALVAGE_REACH tiles. */
export const SALVAGE = 15;
export const SALVAGE_REACH = 7;
export const TRAP = { reach: 0.7, root: 3, dmg: 15, max: 6 };
/** A tunnelling chinchilla spends this many seconds underground. */
export const TUNNEL_SECONDS = 2;
/** Inside a Dust Cloud grumpy units move this much slower and take this much longer between swings (percent); a cloud lasts `time` seconds. */
export const SLOW = { speed: 40, cd: 25, time: 5 };
export const TUNNEL_REACH = 4;
/** Skirmishes end after this many minutes; the side with the bigger score is declared the winner. */
export const TIME_LIMIT_MIN = 30;

export const SIDES: Record<SideId, SideDef> = {
  colony: { id: 'colony', name: 'The Burrow Colony', short: 'Colony', folk: 'chinchillas', color: '#e9b44c', hq: 'burrow', house: 'hut', worker: 'gatherer',
    blurb: 'Adaptable all-rounders led by Dora and Enzo. Tunnel Mounds whisk units between burrows, and Dust Baths mend them.',
    special: 'Tunnels: any Colony unit near a Tunnel Mound or the Great Burrow can pop out at another one.' },
  guild: { id: 'guild', name: 'The Ringtail Guild', short: 'Guild', folk: 'raccoons', color: '#9b7fd1', hq: 'bin', house: 'stash', worker: 'tinkerer',
    blurb: 'Scrappy scavengers: cheap, quick units, sneaky snares, a workshop on wheels, and nothing goes to waste.',
    special: 'Salvage: when a rival is poofed near a raccoon, the Guild tidies up 15% of its cost.' },
  hive: { id: 'hive', name: 'The Clockwork Hive', short: 'Hive', folk: 'wind-up beetles', color: '#4fb3a6', hq: 'core', house: 'cell', worker: 'sorter',
    blurb: 'A whirring swarm. Beetles run down away from Spring Towers but their shells mend themselves, and the Queen winds everyone near her.',
    special: 'Wind-up: beetles slow down after a while away from a Spring Tower, the Hive Core or the Queen.' },
};
export const SIDE_IDS: SideId[] = ['colony', 'guild', 'hive'];

const u = (d: UnitDef) => d;
export const UNITS: Record<string, UnitDef> = Object.fromEntries([
  // ---- the Burrow Colony
  u({ id: 'gatherer', side: 'colony', name: 'Hay Gatherer', blurb: 'Gathers hay and glimmer, and builds.', hay: 50, glimmer: 0, supply: 1, time: 12, hp: 45, armor: 0, dmg: 5, range: 0.5, cd: 1.2, speed: 2.8, sight: 6, r: 0.32, hitsAir: false, hitsGround: true, worker: true, key: 'Q' }),
  u({ id: 'slinger', side: 'colony', name: 'Pebble Slinger', blurb: 'Flings pebbles at anything, flying or not.', hay: 55, glimmer: 0, supply: 1, time: 13, hp: 55, armor: 0, dmg: 8, range: 4.5, cd: 1.2, speed: 2.6, sight: 7, r: 0.33, hitsAir: true, hitsGround: true, key: 'Q', shot: 'pebble' }),
  u({ id: 'fluffguard', side: 'colony', name: 'Fluffguard', blurb: 'Big, padded and hard to budge.', hay: 100, glimmer: 25, supply: 2, time: 20, hp: 180, armor: 1, dmg: 14, range: 0.5, cd: 1.3, speed: 2.3, sight: 6, r: 0.45, hitsAir: false, hitsGround: true, key: 'W' }),
  u({ id: 'puffer', side: 'colony', name: 'Dust Puffer', blurb: 'Puffs sparkly dust that splashes, and a Dust Cloud that slows grumpy units inside.', hay: 75, glimmer: 50, supply: 2, time: 20, hp: 70, armor: 0, dmg: 7, range: 4, cd: 1.4, speed: 2.4, sight: 8, r: 0.36, hitsAir: false, hitsGround: true, splash: 1, ability: 'cloud', key: 'Q', shot: 'dust' }),
  u({ id: 'glider', side: 'colony', name: 'Glider', blurb: 'A quick flying scout who drops seeds from above.', hay: 75, glimmer: 25, supply: 1, time: 16, hp: 60, armor: 0, dmg: 6, range: 3, cd: 1.0, speed: 4.2, sight: 10, r: 0.36, air: true, hitsAir: true, hitsGround: true, key: 'Q', shot: 'seed' }),
  u({ id: 'digger', side: 'colony', name: 'Burrow Digger', blurb: 'Undermines buildings from afar with a big wooden auger.', hay: 150, glimmer: 100, supply: 3, time: 30, hp: 150, armor: 1, dmg: 32, range: 6, cd: 3.0, speed: 1.8, sight: 8, r: 0.5, hitsAir: false, hitsGround: true, siege: 3, splash: 0.8, key: 'W', shot: 'acorn' }),
  u({ id: 'dora', side: 'colony', name: 'Dora', blurb: 'Brave and kind. Rally Song mends and quickens friends nearby.', hay: 0, glimmer: 0, supply: 0, time: 1, hp: 320, armor: 2, dmg: 16, range: 4, cd: 1.0, speed: 3.0, sight: 9, r: 0.4, hitsAir: true, hitsGround: true, hero: true, ability: 'song', key: 'Q', shot: 'seed' }),
  u({ id: 'enzo', side: 'colony', name: 'Enzo', blurb: 'Steady and loyal. Stand Firm halves the bumps friends nearby take.', hay: 0, glimmer: 0, supply: 0, time: 1, hp: 440, armor: 4, dmg: 20, range: 0.4, cd: 1.2, speed: 2.8, sight: 8, r: 0.45, hitsAir: false, hitsGround: true, hero: true, ability: 'firm', key: 'Q' }),
  // ---- the Ringtail Guild
  u({ id: 'tinkerer', side: 'guild', name: 'Tinkerer', blurb: 'Gathers and builds; several Tinkerers build faster together.', hay: 50, glimmer: 0, supply: 1, time: 12, hp: 40, armor: 0, dmg: 5, range: 0.5, cd: 1.2, speed: 2.8, sight: 6, r: 0.32, hitsAir: false, hitsGround: true, worker: true, key: 'Q' }),
  u({ id: 'scrapper', side: 'guild', name: 'Scrapper', blurb: 'Cheap, quick and cheeky up close.', hay: 45, glimmer: 0, supply: 1, time: 10, hp: 58, armor: 0, dmg: 7, range: 0.5, cd: 1.0, speed: 3.4, sight: 6, r: 0.32, hitsAir: false, hitsGround: true, key: 'Q' }),
  u({ id: 'tosser', side: 'guild', name: 'Lid Tosser', blurb: 'Skims bin lids at ground and air alike.', hay: 50, glimmer: 0, supply: 1, time: 12, hp: 47, armor: 0, dmg: 8, range: 4.5, cd: 1.2, speed: 3.0, sight: 7, r: 0.33, hitsAir: true, hitsGround: true, key: 'W', shot: 'lid' }),
  u({ id: 'trapper', side: 'guild', name: 'Trapsetter', blurb: 'Hides honey snares that hold anyone who steps in.', hay: 60, glimmer: 25, supply: 1, time: 15, hp: 50, armor: 0, dmg: 6, range: 3.5, cd: 1.3, speed: 3.0, sight: 8, r: 0.33, hitsAir: false, hitsGround: true, ability: 'snare', key: 'E', shot: 'lid' }),
  u({ id: 'kite', side: 'guild', name: 'Kite Rider', blurb: 'Swoops in on a patchwork kite.', hay: 70, glimmer: 25, supply: 1, time: 15, hp: 55, armor: 0, dmg: 6, range: 3, cd: 1.0, speed: 4.4, sight: 10, r: 0.36, air: true, hitsAir: true, hitsGround: true, key: 'Q', shot: 'lid' }),
  u({ id: 'cart', side: 'guild', name: 'Junk Cart', blurb: 'A spoon catapult on wobbly wheels. Splats buildings from afar.', hay: 125, glimmer: 75, supply: 3, time: 26, hp: 115, armor: 0, dmg: 28, range: 6.5, cd: 3.0, speed: 2.0, sight: 8, r: 0.5, hitsAir: false, hitsGround: true, siege: 3, splash: 1, key: 'Q', shot: 'apple' }),
  u({ id: 'wagon', side: 'guild', name: 'Rolling Workshop', blurb: 'The workshop packed up for the road. Unpack it somewhere clear.', hay: 0, glimmer: 0, supply: 0, time: 1, hp: 500, armor: 1, dmg: 0, range: 0, cd: 1, speed: 1.6, sight: 6, r: 0.8, hitsAir: false, hitsGround: false, ability: 'unpack', key: 'U' }),
  u({ id: 'marlo', side: 'guild', name: 'Marlo', blurb: 'The Guild’s grand leader. Shiny Toss dazzles everyone nearby for a moment.', hay: 0, glimmer: 0, supply: 0, time: 1, hp: 380, armor: 2, dmg: 15, range: 3.5, cd: 1.0, speed: 3.0, sight: 9, r: 0.45, hitsAir: true, hitsGround: true, hero: true, ability: 'shiny', key: 'Q', shot: 'lid' }),
  // ---- the Clockwork Hive
  u({ id: 'sorter', side: 'hive', name: 'Sorter Beetle', blurb: 'Gathers and starts buildings, which then grow on their own.', hay: 50, glimmer: 0, supply: 1, time: 12, hp: 45, armor: 1, dmg: 4, range: 0.5, cd: 1.2, speed: 2.7, sight: 6, r: 0.32, hitsAir: false, hitsGround: true, worker: true, key: 'Q' }),
  u({ id: 'clicker', side: 'hive', name: 'Click Beetle', blurb: 'A quick little swarm beetle.', hay: 45, glimmer: 0, supply: 1, time: 9, hp: 52, armor: 0, dmg: 8, range: 0.5, cd: 1.0, speed: 3.4, sight: 6, r: 0.3, hitsAir: false, hitsGround: true, key: 'Q' }),
  u({ id: 'squirt', side: 'hive', name: 'Squirt Beetle', blurb: 'Sprays slippery oil at ground and air.', hay: 55, glimmer: 0, supply: 1, time: 13, hp: 56, armor: 0, dmg: 8, range: 4.5, cd: 1.2, speed: 2.6, sight: 7, r: 0.33, hitsAir: true, hitsGround: true, key: 'W', shot: 'oil' }),
  u({ id: 'shellback', side: 'hive', name: 'Shellback', blurb: 'A domed tank whose shell mends fast.', hay: 120, glimmer: 25, supply: 2, time: 22, hp: 190, armor: 2, dmg: 12, range: 0.5, cd: 1.4, speed: 2.1, sight: 6, r: 0.48, hitsAir: false, hitsGround: true, key: 'E' }),
  u({ id: 'buzzer', side: 'hive', name: 'Buzz Beetle', blurb: 'Whirs over anything on glassy wings.', hay: 65, glimmer: 25, supply: 1, time: 15, hp: 58, armor: 0, dmg: 6, range: 3, cd: 1.0, speed: 4.2, sight: 10, r: 0.36, air: true, hitsAir: true, hitsGround: true, key: 'Q', shot: 'spark' }),
  u({ id: 'rammer', side: 'hive', name: 'Ram Beetle', blurb: 'Bonks buildings with a polished brass horn.', hay: 140, glimmer: 75, supply: 3, time: 28, hp: 190, armor: 2, dmg: 30, range: 0.4, cd: 2.4, speed: 2.1, sight: 7, r: 0.52, hitsAir: false, hitsGround: true, siege: 3, key: 'Q' }),
  u({ id: 'queen', side: 'hive', name: 'Queen Beetle', blurb: 'Winds every beetle near her. Brood Call builds two Click Beetles on the spot.', hay: 250, glimmer: 150, supply: 4, time: 45, hp: 520, armor: 3, dmg: 18, range: 4, cd: 1.2, speed: 2.0, sight: 10, r: 0.7, hitsAir: true, hitsGround: true, ability: 'brood', limit: 1, key: 'W', shot: 'spark' }),
].map((d) => [d.id, d]));

const b = (d: BuildingDef) => d;
export const BUILDINGS: Record<string, BuildingDef> = Object.fromEntries([
  // ---- the Burrow Colony
  b({ id: 'burrow', side: 'colony', name: 'Great Burrow', blurb: 'Home. Trains Hay Gatherers, takes in hay and glimmer, and joins the tunnels.', hay: 400, glimmer: 0, time: 60, hp: 1300, armor: 5, size: 3, supply: 10, hq: true, trains: ['gatherer'], research: [], req: [], tunnel: true, key: 'Q' }),
  b({ id: 'hut', side: 'colony', name: 'Hay Hut', blurb: 'A cosy hut: room for 8 more.', hay: 100, glimmer: 0, time: 18, hp: 320, armor: 4, size: 2, supply: 8, trains: [], research: [], req: [], key: 'W' }),
  b({ id: 'pit', side: 'colony', name: 'Pebble Pit', blurb: 'Trains Pebble Slingers and Fluffguards.', hay: 150, glimmer: 0, time: 30, hp: 650, armor: 4, size: 3, trains: ['slinger', 'fluffguard'], research: [], req: ['burrow'], key: 'E' }),
  b({ id: 'stump', side: 'colony', name: 'Watch Stump', blurb: 'A lookout that flings pebbles at anyone grumpy nearby.', hay: 100, glimmer: 25, time: 20, hp: 420, armor: 5, size: 2, trains: [], research: [], req: ['pit'], tower: { dmg: 10, range: 6, cd: 1.2, hitsAir: true, shot: 'pebble' }, key: 'R' }),
  b({ id: 'bath', side: 'colony', name: 'Dust Bath', blurb: 'Mends Colony units within 4 tiles.', hay: 100, glimmer: 25, time: 22, hp: 400, armor: 4, size: 2, trains: [], research: [], req: ['pit'], heal: { r: 4, hp: 3 }, key: 'A' }),
  b({ id: 'mound', side: 'colony', name: 'Tunnel Mound', blurb: 'A tunnel mouth. Units near one can pop out at any other.', hay: 75, glimmer: 0, time: 15, hp: 350, armor: 4, size: 2, trains: [], research: [], req: ['pit'], tunnel: true, key: 'S' }),
  b({ id: 'library', side: 'colony', name: 'Seed Library', blurb: 'Studies the Colony’s upgrades.', hay: 125, glimmer: 50, time: 25, hp: 420, armor: 4, size: 2, trains: [], research: ['pebbles', 'fluff', 'paws'], req: ['pit'], key: 'D' }),
  b({ id: 'perch', side: 'colony', name: 'Glider Perch', blurb: 'Launches Gliders.', hay: 150, glimmer: 75, time: 30, hp: 520, armor: 4, size: 3, trains: ['glider'], research: [], req: ['library'], key: 'Z' }),
  b({ id: 'den', side: 'colony', name: 'Digger’s Den', blurb: 'Builds Dust Puffers and Burrow Diggers.', hay: 150, glimmer: 100, time: 35, hp: 620, armor: 4, size: 3, trains: ['puffer', 'digger'], research: [], req: ['library'], key: 'X' }),
  // ---- the Ringtail Guild
  b({ id: 'bin', side: 'guild', name: 'Big Bin', blurb: 'Home. Trains Tinkerers and takes in hay and glimmer.', hay: 400, glimmer: 0, time: 60, hp: 1200, armor: 5, size: 3, supply: 10, hq: true, trains: ['tinkerer'], research: [], req: [], key: 'Q' }),
  b({ id: 'stash', side: 'guild', name: 'Stash Den', blurb: 'A crate-and-teapot den: room for 8 more.', hay: 90, glimmer: 0, time: 15, hp: 280, armor: 3, size: 2, supply: 8, trains: [], research: [], req: [], key: 'W' }),
  b({ id: 'yard', side: 'guild', name: 'Scrap Yard', blurb: 'Trains Scrappers, Lid Tossers and Trapsetters.', hay: 140, glimmer: 0, time: 25, hp: 560, armor: 4, size: 3, trains: ['scrapper', 'tosser', 'trapper'], research: [], req: ['bin'], key: 'E' }),
  b({ id: 'lantern', side: 'guild', name: 'Lantern Post', blurb: 'A lookout that skims lids at anyone grumpy nearby.', hay: 90, glimmer: 25, time: 18, hp: 380, armor: 4, size: 2, trains: [], research: [], req: ['yard'], tower: { dmg: 9, range: 6, cd: 1.1, hitsAir: true, shot: 'lid' }, key: 'R' }),
  b({ id: 'bench', side: 'guild', name: 'Tinker Bench', blurb: 'Tinkers up the Guild’s upgrades.', hay: 110, glimmer: 50, time: 22, hp: 380, armor: 4, size: 2, trains: [], research: ['lids', 'patches', 'wheels'], req: ['yard'], key: 'A' }),
  b({ id: 'workshop', side: 'guild', name: 'Rolling Workshop', blurb: 'Builds Junk Carts, and packs up to roll somewhere new.', hay: 150, glimmer: 75, time: 30, hp: 500, armor: 4, size: 3, trains: ['cart'], research: [], req: ['bench'], ability: 'pack', key: 'S' }),
  b({ id: 'loft', side: 'guild', name: 'Kite Loft', blurb: 'Launches Kite Riders.', hay: 140, glimmer: 75, time: 28, hp: 480, armor: 4, size: 3, trains: ['kite'], research: [], req: ['bench'], key: 'D' }),
  // ---- the Clockwork Hive
  b({ id: 'core', side: 'hive', name: 'Hive Core', blurb: 'Home. Builds Sorter Beetles, takes in hay and glimmer, and winds beetles nearby.', hay: 400, glimmer: 0, time: 60, hp: 1400, armor: 5, size: 3, supply: 10, hq: true, trains: ['sorter'], research: [], req: [], spring: 7, key: 'Q' }),
  b({ id: 'cell', side: 'hive', name: 'Cog Cell', blurb: 'A copper pod: room for 8 more.', hay: 100, glimmer: 0, time: 18, hp: 320, armor: 4, size: 2, supply: 8, trains: [], research: [], req: [], key: 'W' }),
  b({ id: 'spring', side: 'hive', name: 'Spring Tower', blurb: 'Winds beetles within 7 tiles. Overwind fills every spring near it and speeds them up.', hay: 75, glimmer: 0, time: 15, hp: 320, armor: 4, size: 2, trains: [], research: [], req: [], spring: 7, ability: 'overwind', key: 'E' }),
  b({ id: 'brood', side: 'hive', name: 'Brood Works', blurb: 'Builds Click Beetles, Squirt Beetles and Shellbacks.', hay: 150, glimmer: 0, time: 28, hp: 620, armor: 4, size: 3, trains: ['clicker', 'squirt', 'shellback'], research: [], req: ['core'], key: 'R' }),
  b({ id: 'coil', side: 'hive', name: 'Spark Coil', blurb: 'A tower of friendly sparks that tickle anyone grumpy nearby.', hay: 100, glimmer: 25, time: 20, hp: 420, armor: 5, size: 2, trains: [], research: [], req: ['brood'], tower: { dmg: 11, range: 5.5, cd: 1.2, hitsAir: true, shot: 'spark' }, key: 'A' }),
  b({ id: 'hall', side: 'hive', name: 'Winding Hall', blurb: 'Works out the Hive’s upgrades.', hay: 125, glimmer: 50, time: 25, hp: 420, armor: 4, size: 2, trains: [], research: ['gears', 'shells', 'springs'], req: ['brood'], key: 'S' }),
  b({ id: 'nest', side: 'hive', name: 'Buzz Nest', blurb: 'Builds Buzz Beetles.', hay: 150, glimmer: 75, time: 30, hp: 500, armor: 4, size: 3, trains: ['buzzer'], research: [], req: ['hall'], key: 'D' }),
  b({ id: 'forge', side: 'hive', name: 'Gear Forge', blurb: 'Builds Ram Beetles and the Queen.', hay: 150, glimmer: 100, time: 35, hp: 620, armor: 4, size: 3, trains: ['rammer', 'queen'], research: [], req: ['hall'], key: 'F' }),
].map((d) => [d.id, d]));

/** Units that need another building standing as well as the one that trains them. */
export const UNIT_REQ: Record<string, string> = {};

const g = (d: UpgradeDef) => d;
export const UPGRADES: Record<string, UpgradeDef> = Object.fromEntries([
  g({ id: 'pebbles', side: 'colony', name: 'Sharper Pebbles', blurb: 'Colony units and Watch Stumps hit 20% harder.', hay: 100, glimmer: 100, time: 40, effect: { dmg: 20 }, key: 'Q' }),
  g({ id: 'fluff', side: 'colony', name: 'Thicker Fluff', blurb: '+1 armour and +10% health for Colony units.', hay: 100, glimmer: 100, time: 40, effect: { armor: 1, hp: 10 }, key: 'W' }),
  g({ id: 'paws', side: 'colony', name: 'Swift Paws', blurb: 'Colony units move 15% faster.', hay: 75, glimmer: 75, time: 35, effect: { speed: 15 }, key: 'E' }),
  g({ id: 'lids', side: 'guild', name: 'Lucky Lids', blurb: 'Guild units and Lantern Posts hit 20% harder.', hay: 100, glimmer: 100, time: 40, effect: { dmg: 20 }, key: 'Q' }),
  g({ id: 'patches', side: 'guild', name: 'Patched Coats', blurb: '+1 armour and +10% health for Guild units.', hay: 100, glimmer: 100, time: 40, effect: { armor: 1, hp: 10 }, key: 'W' }),
  g({ id: 'wheels', side: 'guild', name: 'Greased Wheels', blurb: 'Guild units move 20% faster.', hay: 75, glimmer: 75, time: 35, effect: { speed: 20 }, key: 'E' }),
  g({ id: 'springs', side: 'hive', name: 'Tighter Springs', blurb: 'Beetles stay wound twice as long.', hay: 75, glimmer: 75, time: 35, effect: { wind: 100 }, key: 'E' }),
  g({ id: 'shells', side: 'hive', name: 'Polished Shells', blurb: '+1 armour, and shells mend twice as fast.', hay: 100, glimmer: 100, time: 40, effect: { armor: 1, regen: 100 }, key: 'W' }),
  g({ id: 'gears', side: 'hive', name: 'Quick Gears', blurb: 'Hive units and Spark Coils hit 20% harder.', hay: 100, glimmer: 100, time: 40, effect: { dmg: 20 }, key: 'Q' }),
].map((d) => [d.id, d]));

export const ABILITIES: Record<AbilityId, AbilityDef> = {
  cloud: { id: 'cloud', name: 'Dust Cloud', blurb: 'A cloud of sparkly dust for 5 s: grumpy units inside move 40% slower and swing 25% slower.', cd: 22, range: 6, radius: 2.2, key: 'F' },
  song: { id: 'song', name: 'Rally Song', blurb: 'Friends within 5 tiles mend 60 health and move 30% faster for 6 s.', cd: 30, range: 0, radius: 5, key: 'F' },
  firm: { id: 'firm', name: 'Stand Firm', blurb: 'Friends within 4 tiles take half the bumps for 7 s.', cd: 30, range: 0, radius: 4, key: 'F' },
  snare: { id: 'snare', name: 'Honey Snare', blurb: 'Hide a snare. The first grumpy walker to step in is held for 3 s. Six at a time.', cd: 6, range: 3, radius: 0.7, key: 'F' },
  shiny: { id: 'shiny', name: 'Shiny Toss', blurb: 'Grumpy units within 3 tiles of the spot stop to stare for 3 s.', cd: 25, range: 6, radius: 3, key: 'F' },
  brood: { id: 'brood', name: 'Brood Call', blurb: 'Two Click Beetles whir out beside the Queen (they need supply).', cd: 40, range: 0, radius: 0, key: 'F' },
  overwind: { id: 'overwind', name: 'Overwind', blurb: 'Every beetle within 7 tiles is fully wound and 40% quicker for 8 s.', cd: 60, range: 0, radius: 7, key: 'F' },
  pack: { id: 'pack', name: 'Pack Up', blurb: 'Fold the workshop onto its wheels to roll it somewhere new.', cd: 0, range: 0, radius: 0, key: 'F' },
  unpack: { id: 'unpack', name: 'Unpack', blurb: 'Set the workshop down here (it needs a clear 3×3 spot).', cd: 0, range: 0, radius: 0, key: 'F' },
  tunnel: { id: 'tunnel', name: 'Tunnel', blurb: 'Walk to the nearest tunnel mouth and pop out at the one you pick.', cd: 0, range: 0, radius: 0, key: 'T' },
};

export const unitsOf = (side: SideId) => Object.values(UNITS).filter((d) => d.side === side);
export const buildingsOf = (side: SideId) => Object.values(BUILDINGS).filter((d) => d.side === side);
export const upgradesOf = (side: SideId) => Object.values(UPGRADES).filter((d) => d.side === side);

// ---------------------------------------------------------------- maps
/** Terrain codes in the map grid. */
export const GRASS = 0, WATER = 1, TREE = 2, ROCK = 3, DIRT = 4;
export type Feature =
  | { t: 'pond' | 'wood' | 'rocks' | 'clear' | 'path'; x: number; y: number; rx: number; ry: number }
  | { t: 'hay' | 'glimmer'; x: number; y: number };
export type MapDef = {
  id: string; name: string; blurb: string; w: number; h: number;
  /** HQ top-left tiles, one per player slot. */
  starts: [number, number][];
  /** Where a second home fits (HQ top-left), used by the computer to expand. */
  sites: [number, number][];
  features: Feature[];
  /** Copy every feature, start and site turned half a circle round the middle, for a fair 1-on-1. */
  mirror: boolean;
};

/** A home's resources: an arc of hay meadows on one side of the HQ at (x, y) and a glimmer deposit on another. */
export function kit(x: number, y: number, hay: [number, number], glim: [number, number], n = 6): Feature[] {
  const out: Feature[] = [];
  const cx = x + 1.5, cy = y + 1.5, [hx, hy] = hay;
  // the meadows sit about 5.5 tiles away, spread across the direction (hx, hy)
  const px = -hy, py = hx;
  for (let i = 0; i < n; i++) {
    const s = (i - (n - 1) / 2) * 2.1, bend = Math.abs(i - (n - 1) / 2) * -0.45;
    out.push({ t: 'hay', x: Math.round(cx + hx * (5.6 + bend) + px * s - 1), y: Math.round(cy + hy * (5.6 + bend) + py * s - 1) });
  }
  out.push({ t: 'glimmer', x: Math.round(cx + glim[0] * 6 - 1), y: Math.round(cy + glim[1] * 6 - 1) });
  return out;
}

export const MAPS: MapDef[] = [
  {
    id: 'clover', name: 'Clover Hollow', blurb: 'A small, open meadow round a lily pond. Quick to cross, quick to meet.', w: 52, h: 52, mirror: true,
    starts: [[7, 7]], sites: [[7, 34]],
    features: [
      ...kit(7, 7, [-0.2, 1], [1, 0]),
      ...kit(7, 34, [-0.7, 0.7], [1, 0], 5),
      { t: 'pond', x: 26, y: 26, rx: 4.5, ry: 3.5 },
      { t: 'wood', x: 18, y: 4, rx: 4, ry: 2.5 }, { t: 'wood', x: 3, y: 22, rx: 2, ry: 4 },
      { t: 'rocks', x: 16, y: 18, rx: 1.5, ry: 1.2 }, { t: 'wood', x: 34, y: 11, rx: 3, ry: 2 },
    ],
  },
  {
    id: 'ponds', name: 'Twin Ponds', blurb: 'Two long ponds split the middle into three lanes. Watch every one.', w: 64, h: 56, mirror: true,
    starts: [[5, 26]], sites: [[18, 6]],
    features: [
      ...kit(5, 26, [-0.15, -1], [0, 1]),
      ...kit(18, 6, [0, -1], [-1, 0], 5),
      { t: 'pond', x: 32, y: 17, rx: 9, ry: 3.2 }, { t: 'wood', x: 25, y: 22, rx: 3, ry: 2 },
      { t: 'rocks', x: 13, y: 40, rx: 2, ry: 3 }, { t: 'wood', x: 3, y: 48, rx: 3, ry: 4 }, { t: 'wood', x: 30, y: 4, rx: 4, ry: 2 },
    ],
  },
  {
    id: 'crossing', name: 'Mossy Crossing', blurb: 'A stream runs right across, with three shallow fords. Hold them and you hold the map.', w: 60, h: 64, mirror: true,
    starts: [[28, 5]], sites: [[6, 16]],
    features: [
      ...kit(28, 5, [-1, 0], [1, 0.3]),
      ...kit(6, 16, [-1, -0.2], [0, -1], 5),
      { t: 'pond', x: 7, y: 31.5, rx: 8, ry: 2 }, { t: 'pond', x: 30, y: 31.5, rx: 10, ry: 2 },
      { t: 'clear', x: 17, y: 32, rx: 1.6, ry: 3 }, { t: 'path', x: 17, y: 32, rx: 1.4, ry: 2.6 },
      { t: 'clear', x: 30, y: 32, rx: 1.6, ry: 3 }, { t: 'path', x: 30, y: 32, rx: 1.4, ry: 2.6 },
      { t: 'wood', x: 44, y: 16, rx: 4, ry: 3 }, { t: 'rocks', x: 18, y: 22, rx: 2, ry: 1.5 }, { t: 'wood', x: 54, y: 5, rx: 4, ry: 3 },
    ],
  },
  {
    id: 'ridge', name: 'Pebble Ridge', blurb: 'Rocky ridges make narrow passes. Expansions hide behind them.', w: 64, h: 64, mirror: true,
    starts: [[6, 6]], sites: [[40, 5], [6, 40]],
    features: [
      ...kit(6, 6, [0.7, 0.7], [-0.3, 1]),
      ...kit(40, 5, [0, -1], [1, 0.3], 5),
      ...kit(6, 40, [-1, 0], [0.3, 1], 5),
      { t: 'rocks', x: 20, y: 20, rx: 7, ry: 1.6 }, { t: 'clear', x: 21, y: 20, rx: 1.8, ry: 2.5 },
      { t: 'rocks', x: 30, y: 14, rx: 1.4, ry: 6 }, { t: 'rocks', x: 14, y: 30, rx: 6, ry: 1.4 },
      { t: 'pond', x: 32, y: 32, rx: 3, ry: 3 }, { t: 'wood', x: 22, y: 42, rx: 3, ry: 3 },
    ],
  },
  {
    id: 'sunflower', name: 'Sunflower Fields', blurb: 'A wide, open map with plenty of meadows to claim. Room for big plans.', w: 72, h: 60, mirror: true,
    starts: [[6, 8]], sites: [[30, 6], [8, 32]],
    features: [
      ...kit(6, 8, [-0.6, -0.8], [0.3, 1]),
      ...kit(30, 6, [0, -1], [1, 0], 5),
      ...kit(8, 32, [-1, 0.2], [0.2, 1], 5),
      { t: 'wood', x: 22, y: 20, rx: 3, ry: 3 }, { t: 'wood', x: 44, y: 22, rx: 2.5, ry: 4 }, { t: 'pond', x: 36, y: 30, rx: 2.5, ry: 2 },
      { t: 'rocks', x: 20, y: 45, rx: 2, ry: 2 }, { t: 'wood', x: 52, y: 6, rx: 4, ry: 2 },
    ],
  },
];
export const mapById = (id: string) => MAPS.find((m) => m.id === id) ?? MAPS[0];

/** A tiny fixed hash for map scenery, so a map always looks the same. */
export function hash2(a: number, b: number, s = 0) {
  let h = Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(s | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
