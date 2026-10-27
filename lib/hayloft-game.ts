// Hayloft Tycoon's rules: a chinchilla production valley that keeps growing while you are away. No DOM here: the page,
// the scene, the tests and the bots all drive this engine. Randomness comes from a seeded generator kept in the save, and
// time only moves through tick() (online) and catchUp() (offline, from wall-clock timestamps), so a seed, the timestamps and
// the list of actions replay a game exactly.
//
// Numbers are plain doubles. The largest thing the content can make is bounded: twelve buildings capped at MAX_LEVEL, a fixed
// set of multipliers, and Stardust that grows with the square root of earnings. tests/hayloft.mjs builds the "everything
// maxed" valley and checks that its rate and the most expensive purchase stay below 1e200, far inside a double's 1.8e308.

export const SAVE_KEY = 'hayloft-tycoon-v1';
export const MUTE_KEY = 'hayloft-tycoon-muted';
export const MAX_LEVEL = 1000;
/** Offline progress is credited for at most this long, plus upgrades. */
export const BASE_OFFLINE_HOURS = 8;
const SUFFIX = ['', 'K', 'M', 'B', 'T'];

// ---------------------------------------------------------------- buildings
export interface BuildingDef { id: string; name: string; icon: string; cost: number; growth: number; cycle: number; out: number; color: string; blurb: string }
/** The production chain, cheapest first. `out` is what one level makes per cycle of `cycle` seconds. */
/** Every price is multiplied by this: the one knob that sets how fast a valley grows. Tuned with tests/hayloft-bot.mjs. */
export const PACE = 10;
export const BUILDINGS: readonly BuildingDef[] = ([
  { id: 'meadow', name: 'Hay Meadow', icon: '🌾', cost: 4, growth: 1.07, cycle: 1, out: 1, color: '#b9d36b', blurb: 'Sweet timothy hay, cut and bundled by the armful.' },
  { id: 'spa', name: 'Dust Bath Spa', icon: '🛁', cost: 60, growth: 1.15, cycle: 3, out: 60, color: '#e9d8b4', blurb: 'Volcanic dust baths. Everyone leaves extra fluffy.' },
  { id: 'pebble', name: 'Pebble Polishery', icon: '🪨', cost: 720, growth: 1.14, cycle: 6, out: 540, color: '#9fb6c9', blurb: 'River pebbles rolled smooth for nibbling and collecting.' },
  { id: 'orchard', name: 'Apple-Twig Orchard', icon: '🍎', cost: 8640, growth: 1.13, cycle: 12, out: 4320, color: '#e98a6b', blurb: 'Crunchy apple twigs, the finest chew in the valley.' },
  { id: 'cushion', name: 'Cozy Cushion Mill', icon: '🧺', cost: 103680, growth: 1.12, cycle: 24, out: 51840, color: '#e7a7c8', blurb: 'Soft fleece cushions stitched for afternoon naps.' },
  { id: 'bakery', name: 'Hay Biscuit Bakery', icon: '🍪', cost: 1.24416e6, growth: 1.11, cycle: 48, out: 622080, color: '#d9a35b', blurb: 'Warm hay biscuits, baked golden every morning.' },
  { id: 'lantern', name: 'Glimmer Lantern Works', icon: '🏮', cost: 1.492992e7, growth: 1.1, cycle: 96, out: 7.46496e6, color: '#ffcf6b', blurb: 'Little lanterns that glow like fireflies at dusk.' },
  { id: 'observatory', name: 'Moonlight Observatory', icon: '🔭', cost: 1.7915904e8, growth: 1.09, cycle: 192, out: 8.957952e7, color: '#8fa3e6', blurb: 'Star charts, moon maps, and the way to new valleys.' },
  { id: 'balloon', name: 'Cloudhopper Balloon Port', icon: '🎈', cost: 2.14990848e9, growth: 1.08, cycle: 384, out: 1.07495424e9, color: '#9fdbe6', blurb: 'Hot-air balloons for sightseeing over the hills.' },
  { id: 'tea', name: 'Starleaf Tea Garden', icon: '🍵', cost: 2.579890176e10, growth: 1.075, cycle: 768, out: 1.289945088e10, color: '#8fcf9a', blurb: 'Rose hip and starleaf tea, sipped on the terraces.' },
  { id: 'bells', name: 'Aurora Bell Tower', icon: '🔔', cost: 3.0958682112e11, growth: 1.07, cycle: 1536, out: 1.5479341056e11, color: '#c9a3f0', blurb: 'Bells that ring in colours on the long winter nights.' },
  { id: 'skyship', name: 'Comet Skyship Dock', icon: '🚀', cost: 3.71504185344e12, growth: 1.07, cycle: 3072, out: 1.85752092672e12, color: '#f0a3a3', blurb: 'Hay-sail skyships that ride the comet winds.' },
] as BuildingDef[]).map((b) => ({ ...b, cost: b.cost * PACE }));
export const N = BUILDINGS.length;
/** The Comet Skyship carries the colony over the mountains: owning one opens the Great Migration. */
export const GATE = 11;
/** [level, ×output] each building earns on reaching that level. */
export const MILESTONES: readonly (readonly [number, number])[] = [
  [10, 2], [25, 2], [50, 2], [100, 3], [150, 2], [200, 3], [250, 2], [300, 3], [400, 3], [500, 4], [600, 2], [700, 2], [800, 3], [900, 3], [1000, 5],
];
/** Valley festivals: every building at this level or more doubles everything. */
export const FESTIVALS = [10, 25, 50, 100, 200, 300, 400, 500] as const;

// ---------------------------------------------------------------- helpers (managers)
export type Perk =
  | { kind: 'tap'; x: number } | { kind: 'bld'; i: number; x: number } | { kind: 'cost'; x: number } | { kind: 'stay'; s: number }
  | { kind: 'burst'; s: number } | { kind: 'loot'; n: number } | { kind: 'visits'; x: number } | { kind: 'stardust'; x: number }
  | { kind: 'all'; x: number } | { kind: 'event'; x: number };
export interface ManagerDef { name: string; coat: 'dora' | 'enzo'; fur: string; cost: number; perk: Perk; says: string }
/** One helper per building: hiring them runs the building on its own (and while you are away), and each brings a perk. */
export const MANAGERS: readonly ManagerDef[] = [
  { name: 'Dora', coat: 'dora', fur: '#fbf8f3', cost: 0, perk: { kind: 'tap', x: 2 }, says: 'Runs the meadow from day one, and taps are twice as strong' },
  { name: 'Pip', coat: 'enzo', fur: '#9c948c', cost: 1.2e4, perk: { kind: 'bld', i: 1, x: 2 }, says: 'Dust Bath Spa ×2' },
  { name: 'Pebble', coat: 'enzo', fur: '#6d6862', cost: 1.5e5, perk: { kind: 'cost', x: 0.97 }, says: 'Buildings cost 3% less' },
  { name: 'Juniper', coat: 'dora', fur: '#e8d2b0', cost: 2e6, perk: { kind: 'stay', s: 4 }, says: 'Visitors linger 4 s longer' },
  { name: 'Tuft', coat: 'dora', fur: '#fbf4ea', cost: 2.5e7, perk: { kind: 'burst', s: 5 }, says: 'Fluff Bursts last 5 s longer' },
  { name: 'Biscuit', coat: 'enzo', fur: '#b3a89a', cost: 3e8, perk: { kind: 'loot', n: 1 }, says: 'Every trip brings back one more find' },
  { name: 'Lumen', coat: 'dora', fur: '#f6ead8', cost: 3.6e9, perk: { kind: 'visits', x: 1.2 }, says: 'Visitors come 20% more often' },
  { name: 'Nova', coat: 'enzo', fur: '#4f4b48', cost: 4.5e10, perk: { kind: 'stardust', x: 1.1 }, says: 'Migrations give 10% more Stardust' },
  { name: 'Breeze', coat: 'dora', fur: '#efe2d0', cost: 5.5e11, perk: { kind: 'all', x: 1.25 }, says: 'Everything makes 25% more' },
  { name: 'Sage', coat: 'enzo', fur: '#c9c2bb', cost: 7e12, perk: { kind: 'all', x: 2 }, says: 'Everything makes twice as much' },
  { name: 'Chime', coat: 'dora', fur: '#fdf6ee', cost: 9e13, perk: { kind: 'event', x: 1.5 }, says: 'Twig Shower boosts last 50% longer' },
  { name: 'Captain Wisp', coat: 'enzo', fur: '#8a847d', cost: 1.1e15, perk: { kind: 'all', x: 3 }, says: 'Everything makes three times as much' },
];

// ---------------------------------------------------------------- shop upgrades (bought with coins, reset each valley)
export interface UpgradeDef { id: string; name: string; cost: number; target: number | 'all'; x: number }
const UP_NAMES = [
  ['Sharper Sickles', 'Hay Wagons', 'Golden Scythes'], ['Finer Dust', 'Warm Stones', 'Moon Dust'], ['Soft Cloths', 'Tumbling Barrels', 'Diamond Grit'],
  ['Twig Ladders', 'Pruning Songs', 'Apple Blossom Bees'], ['Fluffier Fleece', 'Spinning Wheels', 'Cloud Stuffing'], ['Oat Flour', 'Bigger Ovens', 'Honey Glaze'],
  ['Brighter Wicks', 'Firefly Glass', 'Sunjar Lanterns'], ['Polished Lenses', 'Star Atlases', 'Comet Charts'], ['Patchwork Sails', 'Warm Breezes', 'Rainbow Balloons'],
  ['Rose Hip Blend', 'Terrace Gardens', 'Starleaf Ceremony'], ['Silver Clappers', 'Aurora Ropes', 'Crystal Chimes'], ['Hay Sails', 'Comet Compass', 'Tail Winds'],
];
const UP_STEPS = [1e3, 1e8, 1e15] as const;
export const UPGRADES: readonly UpgradeDef[] = [
  ...BUILDINGS.flatMap((b, i) => UP_STEPS.map((k, j) => ({ id: `${b.id}-${j + 1}`, name: UP_NAMES[i][j], cost: b.cost * k, target: i, x: 3 }))),
  { id: 'bunting', name: 'Valley Bunting', cost: 5e6 * PACE, target: 'all' as const, x: 2 },
  { id: 'band', name: 'Meadow Band', cost: 2e10 * PACE, target: 'all' as const, x: 2 },
  { id: 'choir', name: 'Twilight Choir', cost: 1e15 * PACE, target: 'all' as const, x: 3 },
  { id: 'parade', name: 'Lantern Parade', cost: 1e21 * PACE, target: 'all' as const, x: 3 },
  { id: 'jubilee', name: 'Hay Jubilee', cost: 1e28 * PACE, target: 'all' as const, x: 5 },
  { id: 'aurora', name: 'Aurora Gala', cost: 1e36 * PACE, target: 'all' as const, x: 5 },
].sort((a, b) => a.cost - b.cost);

// ---------------------------------------------------------------- valleys (each Great Migration moves to the next)
export type ValleyId = 'meadowvale' | 'snowdrift' | 'cove' | 'glowcap' | 'cloudreach';
export interface ValleyDef { id: ValleyId; name: string; twist: string; sky: [string, string]; ground: string }
export const VALLEYS: readonly ValleyDef[] = [
  { id: 'meadowvale', name: 'Meadowvale', twist: 'Home sweet home: sunshine and no surprises.', sky: ['#9fd3f0', '#f6e7c4'], ground: '#8cc06a' },
  { id: 'snowdrift', name: 'Snowdrift Valley', twist: 'Snug fires: buildings with a helper make 50% more, but buildings run by paw take twice as long.', sky: ['#b8c9e6', '#eef3fa'], ground: '#e8eef5' },
  { id: 'cove', name: 'Pebble Cove', twist: 'Tides: everything ebbs and flows by 30% every four minutes, and the Pebble Polishery shines ×5.', sky: ['#8fd0e6', '#fbe9c9'], ground: '#ecd6a4' },
  { id: 'glowcap', name: 'Glowcap Hollow', twist: 'Mushroom glow: visitors come 2.5× as often, and each one you catch leaves a spore worth +3% for this valley.', sky: ['#4a3a6e', '#c99ad0'], ground: '#5d7a4a' },
  { id: 'cloudreach', name: 'Cloudreach Isles', twist: 'Updrafts: the top six buildings make ×3, and taps are twice as strong.', sky: ['#7fb8f0', '#fbe0f0'], ground: '#a8d88a' },
];
export const TIDE = { amp: 0.3, period: 240 } as const;

// ---------------------------------------------------------------- Star Tree (Stardust) and the Constellation shop (Moonstones)
export interface TreeDef { id: string; name: string; says: string; max: number; cost: (lvl: number) => number }
export const STAR_TREE: readonly TreeDef[] = [
  { id: 'starlit', name: 'Starlit Fields', says: 'Everything makes ×1.5 per level', max: 40, cost: (l) => 10 * 6 ** l },
  { id: 'paws', name: 'Golden Paws', says: 'Taps give +0.02 s of production per level', max: 5, cost: (l) => Math.ceil(4 * 2.5 ** l) },
  { id: 'helpers', name: 'Eager Helpers', says: 'Helpers cost 25% less per level', max: 3, cost: (l) => 6 * 3 ** l },
  { id: 'welcome', name: 'Warm Welcome', says: 'Start each valley with coins (1K, 100K, 10M, 1B)', max: 4, cost: (l) => 3 * 4 ** l },
  { id: 'whiskers', name: 'Lucky Whiskers', says: 'Visitors come 15% more often per level', max: 5, cost: (l) => Math.ceil(8 * 2.2 ** l) },
  { id: 'naps', name: 'Long Naps', says: 'Away time counts 2 h longer per level', max: 4, cost: (l) => Math.ceil(10 * 2.5 ** l) },
  { id: 'friends', name: 'Old Friends', says: 'Keep your first 4, 8, then all 12 helpers when you migrate', max: 3, cost: (l) => [15, 120, 900][l] },
  { id: 'maps', name: 'Map Makers', says: 'Trips take 10% less time per level', max: 4, cost: (l) => Math.ceil(12 * 2.5 ** l) },
  { id: 'fluffy', name: 'Extra Fluffy', says: 'Fluff Bursts multiply by one more per level', max: 3, cost: (l) => 15 * 4 ** l },
  { id: 'thrift', name: 'Thrift', says: 'Buildings cost 5% less per level', max: 5, cost: (l) => 20 * 3 ** l },
  { id: 'moonbeam', name: 'Moonbeam', says: 'Migrations give 10% more Stardust per level', max: 10, cost: (l) => 25 * 2 ** l },
  { id: 'pockets', name: 'Big Pockets', says: 'One more trip team per level', max: 2, cost: (l) => [60, 400][l] },
];
export const MOON_SHOP: readonly TreeDef[] = [
  { id: 'sky', name: 'Night Sky', says: 'Everything makes ×3 per level, forever', max: 20, cost: (l) => 2 ** l },
  { id: 'comet', name: 'Comet Tail', says: 'Stardust ×1.5 per level', max: 10, cost: (l) => 2 * 2 ** l },
  { id: 'founders', name: 'Seasoned Founders', says: 'Every helper stays with you when you migrate', max: 1, cost: () => 3 },
  { id: 'starseed', name: 'Starseed', says: 'Start each valley with 4 more buildings at level 25', max: 3, cost: (l) => 2 * 3 ** l },
  { id: 'dreams', name: 'Long Dreams', says: 'Away time counts 8 h longer per level', max: 2, cost: (l) => [2, 6][l] },
];

// ---------------------------------------------------------------- research (blueprints + real time, permanent)
export interface ResearchDef { id: string; name: string; says: string; bp: number; minutes: number; needs?: string }
export const RESEARCH: readonly ResearchDef[] = [
  { id: 'sickles', name: 'Sharper Sickles', says: 'Hay Meadow ×3', bp: 1, minutes: 5 },
  { id: 'sand', name: 'Warm Sand', says: 'Dust Bath Spa ×3', bp: 2, minutes: 10, needs: 'sickles' },
  { id: 'naps', name: 'Comfy Naps', says: 'Away time counts 2 h longer', bp: 2, minutes: 15 },
  { id: 'trails', name: 'Trail Maps', says: 'Trips take 15% less time', bp: 3, minutes: 30 },
  { id: 'baskets', name: 'Twig Baskets', says: 'Twig Shower boosts last 50% longer', bp: 3, minutes: 20, needs: 'sickles' },
  { id: 'feeders', name: 'Bird Feeders', says: 'Visitors come 25% more often', bp: 4, minutes: 45, needs: 'baskets' },
  { id: 'fluff', name: 'Fluff Science', says: 'Fluff Bursts last 10 s longer', bp: 4, minutes: 40, needs: 'sand' },
  { id: 'whiskers', name: 'Golden Whiskers', says: 'Taps give +0.05 s of production', bp: 6, minutes: 60, needs: 'fluff' },
  { id: 'bulk', name: 'Bulk Orders', says: 'Buildings cost 7% less', bp: 5, minutes: 60, needs: 'naps' },
  { id: 'team', name: 'Extra Team', says: 'One more trip team', bp: 6, minutes: 90, needs: 'trails' },
  { id: 'harmony', name: 'Valley Harmony', says: 'Everything makes ×2', bp: 10, minutes: 120, needs: 'bulk' },
  { id: 'charts', name: 'Star Charts', says: 'Migrations give 15% more Stardust', bp: 8, minutes: 120, needs: 'team' },
  { id: 'deepnaps', name: 'Deep Naps', says: 'Away time counts 4 h longer', bp: 8, minutes: 180, needs: 'harmony' },
  { id: 'moonmaps', name: 'Moon Maps', says: 'Trips take another 15% less time', bp: 12, minutes: 180, needs: 'charts' },
  { id: 'harmony2', name: 'Grand Harmony', says: 'Everything makes ×3', bp: 20, minutes: 240, needs: 'deepnaps' },
  { id: 'library', name: 'The Great Hay Library', says: 'Everything makes ×5', bp: 40, minutes: 480, needs: 'harmony2' },
];

// ---------------------------------------------------------------- trips (expeditions) and keepsakes
export interface TripDef { id: string; name: string; minutes: number; finds: number; keepsake: number; blurb: string }
export const TRIPS: readonly TripDef[] = [
  { id: 'brook', name: 'Babbling Brook', minutes: 15, finds: 1, keepsake: 0, blurb: 'A quick paddle and a picnic.' },
  { id: 'woods', name: 'Whispering Woods', minutes: 30, finds: 2, keepsake: 0, blurb: 'Pine needles and owl gossip.' },
  { id: 'ridge', name: 'Rosy Ridge', minutes: 60, finds: 3, keepsake: 0.04, blurb: 'A long climb with a pink sunset.' },
  { id: 'caves', name: 'Crystal Caves', minutes: 120, finds: 5, keepsake: 0.1, blurb: 'Glittering tunnels full of echoes.' },
  { id: 'lake', name: 'Moonlake Shore', minutes: 240, finds: 8, keepsake: 0.2, blurb: 'Silver water and very old stones.' },
  { id: 'peaks', name: 'Starpeak Summit', minutes: 480, finds: 14, keepsake: 0.35, blurb: 'Overnight under the whole sky.' },
];
export const KEEPSAKES = [
  'Smooth River Stone', 'Owl Feather', 'Tiny Silver Bell', 'Moon Shell', 'Crystal Seed', 'Sunset Ribbon', 'Snow Globe', 'Old Star Map', 'Pine Cone Crown', 'Four-Leaf Clover',
] as const;
export const TEAM_NAMES = ['Team Dora', 'Team Enzo', 'Team Pip', 'Team Clover', 'Team Juniper'] as const;
export type Find = 'bp' | 'berry' | 'clock' | 'stardust' | 'keepsake' | 'trailmix';
export interface Loot { bp: number; berry: number; clock: number; stardust: number; trailmix: number; keepsake: number }

// ---------------------------------------------------------------- visitors, taps, boosts, the Twig Shower
export type VisitorKind = 'acorn' | 'pedlar' | 'owl' | 'bat' | 'breeze';
export const VISITORS: Record<VisitorKind, { name: string; weight: number; says: string }> = {
  acorn: { name: 'Hummingbird with a Golden Acorn', weight: 40, says: 'Golden Acorn! ×7 everything for 30 s' },
  pedlar: { name: 'Viscacha Pedlar', weight: 25, says: 'A sack of coins: 10 minutes of production' },
  owl: { name: 'Owl Scholar', weight: 15, says: 'A blueprint for the research desk' },
  bat: { name: 'Berry Bat', weight: 10, says: 'A sunberry for later' },
  breeze: { name: 'Fluff Breeze', weight: 10, says: 'A Fluff Burst, right now' },
};
export const VISIT = { min: 75, max: 150, stay: 12 } as const;
export const FLUFF = { max: 50, decay: 0.6, mult: 2, seconds: 15 } as const;
export const TAP = { base: 0.02, min: 1 } as const;
export const SHOWER = { every: [360, 600] as const, offer: 45, seconds: 10, per: 0.1, cap: 6, boost: 120 } as const;
export const BERRY = { mult: 3, seconds: 600 } as const;
export const ACORN = { mult: 7, seconds: 30 } as const;
export type BoostKind = 'fluff' | 'acorn' | 'twig' | 'berry';
export interface Boost { kind: BoostKind; mult: number; until: number }

// ---------------------------------------------------------------- achievements
export interface AchievementDef { id: string; name: string; says: string; test: (s: State) => boolean }
const ach = (id: string, name: string, says: string, test: (s: State) => boolean): AchievementDef => ({ id, name, says, test });
const big = [1e6, 1e9, 1e12, 1e15, 1e18, 1e21, 1e24, 1e30];
export const ACHIEVEMENTS: readonly AchievementDef[] = [
  ...BUILDINGS.flatMap((b, i) => [
    ach(`${b.id}-25`, `${b.name} I`, `Own 25 of ${b.name}`, (s) => s.levels[i] >= 25),
    ach(`${b.id}-100`, `${b.name} II`, `Own 100 of ${b.name}`, (s) => s.levels[i] >= 100),
  ]),
  ...big.map((n, k) => ach(`earn-${k}`, ['Pocket Money', 'Hay Fortune', 'Valley Tycoon', 'Hill Baron', 'Mountain Mogul', 'Sky Magnate', 'Star Tycoon', 'Galaxy of Hay'][k], `Earn ${fmt(n)} coins in all`, (s) => s.stats.earned >= n)),
  ...[1, 10, 50, 200].map((n, k) => ach(`visit-${k}`, ['Hello There', 'Good Host', 'Bird Whisperer', 'Everyone’s Friend'][k], `Catch ${n} visitor${n > 1 ? 's' : ''}`, (s) => s.stats.visitors >= n)),
  ...[100, 1000, 10000].map((n, k) => ach(`tap-${k}`, ['Busy Paws', 'Tireless Paws', 'Legendary Paws'][k], `Tap ${fmt(n)} times`, (s) => s.stats.taps >= n)),
  ...[1, 3, 5, 10, 25].map((n, k) => ach(`migrate-${k}`, ['Off We Go', 'Seasoned Movers', 'Valley Hoppers', 'Great Wanderers', 'Endless Horizons'][k], `Make ${n} Great Migration${n > 1 ? 's' : ''}`, (s) => s.stats.migrations >= n)),
  ...[1, 10, 50].map((n, k) => ach(`trip-${k}`, ['First Steps Out', 'Trail Regulars', 'Born Explorers'][k], `Finish ${n} trip${n > 1 ? 's' : ''}`, (s) => s.stats.trips >= n)),
  ach('research-0', 'Curious Mind', 'Finish a research', (s) => s.research.length >= 1),
  ach('research-1', 'Bookworm', 'Finish 5 research', (s) => s.research.length >= 5),
  ach('research-2', 'Hay Professor', 'Finish every research', (s) => s.research.length >= RESEARCH.length),
  ach('shower-0', 'Twig Catcher', 'Play a Twig Shower', (s) => s.stats.showers >= 1),
  ach('shower-1', 'Basket Full', 'Play 10 Twig Showers', (s) => s.stats.showers >= 10),
  ach('shower-2', 'Quick Paws', 'Catch 25 in one Twig Shower', (s) => s.stats.bestShower >= 25),
  ach('daily-0', 'Three Days Running', 'Open three daily gifts in a row', (s) => s.daily.best >= 3),
  ach('daily-1', 'Week of Gifts', 'Open seven daily gifts in a row', (s) => s.daily.best >= 7),
  ach('helpers', 'Full Staff', 'Hire all twelve helpers in one valley', (s) => s.managers.every(Boolean)),
  ach('festival', 'Valley Festival', 'Get every building to 25', (s) => s.levels.every((l) => l >= 25)),
  ach('constellation', 'Named a Star', 'Name a Constellation', (s) => s.constellations >= 1),
  ach('keepsakes', 'Full Shelf', 'Find every keepsake', (s) => s.keepsakes.every((k) => k > 0)),
];
/** Each achievement adds this much to everything, for good. */
export const ACH_BONUS = 0.03;
export const DAILY = [
  { bp: 2 }, { berry: 1 }, { clock: 1 }, { bp: 3 }, { berry: 2 }, { clock: 2 }, { bp: 5, stardust: 1 },
] as const;

// ---------------------------------------------------------------- state
export interface Trip { dest: string; team: number; start: number; ends: number; loot: Loot }
export interface State {
  v: 1; seed: number; rng: number;
  /** Game seconds credited so far (online and offline). */
  t: number;
  /** The wall clock (ms) this state was last brought up to. */
  wall: number;
  coins: number; earned: number; lifetime: number;
  levels: number[]; cycles: number[]; managers: boolean[]; upgrades: string[];
  valley: number; spores: number;
  stardust: number; starsEver: number; tree: Record<string, number>;
  moonstones: number; moon: Record<string, number>; constellations: number;
  boosts: Boost[]; fluff: number;
  items: { bp: number; berry: number; clock: number };
  keepsakes: number[];
  research: string[]; studying: { id: string; ends: number } | null;
  trips: (Trip | null)[];
  visitor: { kind: VisitorKind; at: number; until: number; y: number; dir: 1 | -1 } | null; nextVisit: number;
  shower: { until: number } | null; nextShower: number;
  daily: { last: number; streak: number; best: number };
  achieved: string[];
  buy: 1 | 10 | 100 | 0;
  stats: { earned: number; taps: number; visitors: number; migrations: number; trips: number; showers: number; bestShower: number; bursts: number; played: number };
}
export type GameEvent =
  | { kind: 'buy'; i: number; n: number } | { kind: 'milestone'; i: number; level: number; x: number } | { kind: 'festival'; level: number }
  | { kind: 'hire'; i: number } | { kind: 'upgrade'; id: string } | { kind: 'cycle'; i: number; coins: number }
  | { kind: 'tap'; coins: number } | { kind: 'burst' } | { kind: 'visitor'; v: VisitorKind } | { kind: 'caught'; v: VisitorKind; text: string }
  | { kind: 'shower' } | { kind: 'achievement'; id: string } | { kind: 'trip'; slot: number } | { kind: 'research'; id: string }
  | { kind: 'migrate'; stardust: number } | { kind: 'constellation'; moonstones: number } | { kind: 'gift'; text: string } | { kind: 'item'; text: string };
export interface AwaySummary { away: number; credited: number; capped: boolean; coins: number; tripsReady: number; research: string[] }

// ---------------------------------------------------------------- small maths
/** mulberry32 step: returns [value 0..1, next state]. */
export function rand(state: number): [number, number] {
  const s = (state + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, s];
}
/** Big readable numbers: 999, 1.23K, 45.6M, 789B, 1.00T, then aa, ab … zz for each further thousand. */
export function fmt(n: number): string {
  if (!Number.isFinite(n)) return n > 0 ? '∞' : '0';
  if (n < 0) return '-' + fmt(-n);
  if (n < 1000) return n < 10 && n % 1 ? (Math.floor(n * 10) / 10).toString() : Math.floor(n).toString();
  // digits are cut, never rounded up, so 999,999 shows as 999K rather than a surprising 1.00M
  // (the tiny nudge undoes float error, so 1e29 reads 100ae, not 99.9ae)
  let g = Math.floor(Math.log10(n) / 3), m = (n / 10 ** (g * 3)) * (1 + 1e-12);
  if (m < 1) { g--; m *= 1000; } else if (m >= 1000) { g++; m /= 1000; }
  const digits = m >= 100 ? 0 : m >= 10 ? 1 : 2, cut = 10 ** digits, shown = (Math.floor(m * cut + 1e-9) / cut).toFixed(digits);
  let suffix = SUFFIX[g];
  if (suffix === undefined) { const k = g - SUFFIX.length; suffix = String.fromCharCode(97 + Math.floor(k / 26) % 26) + String.fromCharCode(97 + (k % 26)); }
  return shown + suffix;
}
/** A friendly duration: 45s, 12m, 3h 20m, 2d 4h. */
export function fmtTime(sec: number): string {
  sec = Math.max(0, Math.ceil(sec));
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60); if (m < 60) return `${m}m${sec % 60 && m < 10 ? ` ${sec % 60}s` : ''}`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h${m % 60 ? ` ${m % 60}m` : ''}`;
  return `${Math.floor(h / 24)}d${h % 24 ? ` ${h % 24}h` : ''}`;
}
/** Total cost of `n` more levels of a building that has `level` already. */
export function costOf(i: number, level: number, n: number, mult = 1) {
  const b = BUILDINGS[i], r = b.growth;
  return b.cost * mult * r ** level * (r ** n - 1) / (r - 1);
}
/** How many more levels `coins` buys (up to MAX_LEVEL). */
export function maxAfford(i: number, level: number, coins: number, mult = 1) {
  const b = BUILDINGS[i], r = b.growth, room = MAX_LEVEL - level;
  if (room <= 0) return 0;
  const first = b.cost * mult * r ** level; if (coins < first) return 0;
  let n = Math.floor(Math.log(coins * (r - 1) / first + 1) / Math.log(r));
  n = Math.max(0, Math.min(room, n));
  while (n > 0 && costOf(i, level, n, mult) > coins * (1 + 1e-12)) n--;
  while (n < room && costOf(i, level, n + 1, mult) <= coins) n++;
  return n;
}
export function milestoneMult(level: number) { let m = 1; for (const [l, x] of MILESTONES) if (level >= l) m *= x; return m; }
export function nextMilestone(level: number) { return MILESTONES.find(([l]) => l > level)?.[0] ?? null; }
/** ∫ of the tide factor 1 + A·sin(2πt/P) from a to b. */
export function tideIntegral(a: number, b: number) {
  const w = (2 * Math.PI) / TIDE.period;
  return b - a + (TIDE.amp / w) * (Math.cos(w * a) - Math.cos(w * b));
}
export const tideAt = (t: number) => 1 + TIDE.amp * Math.sin((2 * Math.PI * t) / TIDE.period);
/** Stardust one valley's earnings are worth at its Great Migration, before multipliers. */
export const stardustFor = (earned: number) => Math.floor(10 * (Math.max(0, earned) / 1e18) ** 0.25);
/** Every Stardust ever earned shines on the whole valley: ×(1 + ½·√stardust). */
export const stardustShine = (starsEver: number) => 1 + 0.5 * Math.sqrt(Math.max(0, starsEver));
export const moonstonesFor = (starsEver: number) => Math.floor(Math.sqrt(Math.max(0, starsEver) / 5e4));
/** Stardust ever earned you need before you can name a Constellation. */
export const CONSTELLATION_AT = 2e5;

export function freshState(seed: number, wall: number): State {
  const s: State = {
    v: 1, seed: seed >>> 0, rng: seed >>> 0, t: 0, wall,
    coins: 0, earned: 0, lifetime: 0,
    levels: BUILDINGS.map((_, i) => (i === 0 ? 1 : 0)), cycles: BUILDINGS.map(() => -1), managers: BUILDINGS.map((_, i) => i === 0), upgrades: [],
    valley: 0, spores: 0, stardust: 0, starsEver: 0, tree: {}, moonstones: 0, moon: {}, constellations: 0,
    boosts: [], fluff: 0, items: { bp: 0, berry: 0, clock: 0 }, keepsakes: KEEPSAKES.map(() => 0),
    research: [], studying: null, trips: [null, null, null, null, null],
    visitor: null, nextVisit: 40, shower: null, nextShower: 240,
    daily: { last: -1, streak: 0, best: 0 }, achieved: [], buy: 1,
    stats: { earned: 0, taps: 0, visitors: 0, migrations: 0, trips: 0, showers: 0, bestShower: 0, bursts: 0, played: 0 },
  };
  return s;
}

// ---------------------------------------------------------------- the game
export class HayloftGame {
  s: State;
  events: GameEvent[] = [];
  constructor(state: State) { this.s = state; }
  static fresh(seed: number, wall: number) { return new HayloftGame(freshState(seed, wall)); }

  private roll() { const [v, next] = rand(this.s.rng); this.s.rng = next; return v; }
  tree(id: string) { return this.s.tree[id] ?? 0; }
  moon(id: string) { return this.s.moon[id] ?? 0; }
  has(id: string) { return this.s.research.includes(id); }
  get valleyDef() { return VALLEYS[this.s.valley % VALLEYS.length]; }
  get year() { return Math.floor(this.s.valley / VALLEYS.length) + 1; }
  private perks(kind: Perk['kind']) { const out: Perk[] = []; this.s.managers.forEach((m, i) => { if (m && MANAGERS[i].perk.kind === kind) out.push(MANAGERS[i].perk); }); return out; }

  // ---- multipliers
  costMult() {
    let m = 0.95 ** this.tree('thrift');
    if (this.has('bulk')) m *= 0.93;
    for (const p of this.perks('cost')) m *= (p as { x: number }).x;
    return m;
  }
  managerCost(i: number) { return MANAGERS[i].cost * PACE * 0.75 ** this.tree('helpers'); }
  /** Everything-multiplier that does not change from second to second. */
  globalMult() {
    const s = this.s;
    let m = (1 + ACH_BONUS * s.achieved.length) * stardustShine(s.starsEver) * 1.5 ** this.tree('starlit') * 3 ** this.moon('sky');
    m *= 1 + 0.1 * s.keepsakes.filter((k) => k > 0).length;
    for (const f of FESTIVALS) if (s.levels.every((l) => l >= f)) m *= 2;
    for (const u of UPGRADES) if (u.target === 'all' && s.upgrades.includes(u.id)) m *= u.x;
    for (const p of this.perks('all')) m *= (p as { x: number }).x;
    if (this.has('harmony')) m *= 2;
    if (this.has('harmony2')) m *= 3;
    if (this.has('library')) m *= 5;
    if (this.valleyDef.id === 'glowcap') m *= 1 + 0.03 * s.spores;
    return m;
  }
  /** Output multiplier for one building, without boosts or the tide. */
  buildingMult(i: number, global = this.globalMult()) {
    const s = this.s; let m = milestoneMult(s.levels[i]) * global;
    for (const u of UPGRADES) if (u.target === i && s.upgrades.includes(u.id)) m *= u.x;
    for (const p of this.perks('bld')) if ((p as { i: number }).i === i) m *= (p as { x: number }).x;
    if (i === 0 && this.has('sickles')) m *= 3;
    if (i === 1 && this.has('sand')) m *= 3;
    const v = this.valleyDef.id;
    if (v === 'snowdrift' && s.managers[i]) m *= 1.5;
    if (v === 'cove' && i === 2) m *= 5;
    if (v === 'cloudreach' && i >= N - 6) m *= 3;
    return m;
  }
  /** Coins one cycle of building i pays. */
  cyclePay(i: number, global = this.globalMult()) { return this.s.levels[i] * BUILDINGS[i].out * this.buildingMult(i, global); }
  cycleTime(i: number) { return BUILDINGS[i].cycle * (this.valleyDef.id === 'snowdrift' && !this.s.managers[i] ? 2 : 1); }
  /** Steady coins per second from buildings with helpers, before boosts and tides. */
  baseRate() {
    const g = this.globalMult(); let r = 0;
    for (let i = 0; i < N; i++) if (this.s.managers[i] && this.s.levels[i] > 0) r += this.cyclePay(i, g) / BUILDINGS[i].cycle;
    return r;
  }
  boostMult(t = this.s.t) { let m = 1; for (const b of this.s.boosts) if (b.until > t) m *= b.mult; return m; }
  tide(t = this.s.t) { return this.valleyDef.id === 'cove' ? tideAt(t) : 1; }
  /** What the valley is making each second right now. */
  rate() { return this.baseRate() * this.boostMult() * this.tide(); }
  tapSeconds() {
    let sec = TAP.base + 0.02 * this.tree('paws') + (this.has('whiskers') ? 0.05 : 0);
    for (const p of this.perks('tap')) sec *= (p as { x: number }).x;
    if (this.valleyDef.id === 'cloudreach') sec *= 2;
    return sec;
  }
  tapValue() { return Math.max(TAP.min, this.rate() * this.tapSeconds()); }
  offlineCapHours() { return BASE_OFFLINE_HOURS + 2 * this.tree('naps') + 8 * this.moon('dreams') + (this.has('naps') ? 2 : 0) + (this.has('deepnaps') ? 4 : 0); }
  tripSlots() { return 2 + this.tree('pockets') + (this.has('team') ? 1 : 0); }
  tripMult() { return 0.9 ** this.tree('maps') * (this.has('trails') ? 0.85 : 1) * (this.has('moonmaps') ? 0.85 : 1); }
  visitRate() {
    let r = 1 + 0.15 * this.tree('whiskers'); if (this.has('feeders')) r *= 1.25;
    for (const p of this.perks('visits')) r *= (p as { x: number }).x;
    if (this.valleyDef.id === 'glowcap') r *= 2.5;
    return r;
  }
  burstSeconds() { let s = FLUFF.seconds + (this.has('fluff') ? 10 : 0); for (const p of this.perks('burst')) s += (p as { s: number }).s; return s; }
  burstMult() { return FLUFF.mult + this.tree('fluffy'); }
  stardustMult() {
    let m = (1 + 0.1 * this.tree('moonbeam')) * 1.5 ** this.moon('comet') * (this.has('charts') ? 1.15 : 1);
    for (const p of this.perks('stardust')) m *= (p as { x: number }).x;
    return m;
  }
  /** Stardust a Great Migration would give right now. */
  pendingStardust() { return Math.floor(stardustFor(this.s.earned) * this.stardustMult()); }
  canMigrate() { return this.s.levels[GATE] >= 1 && this.pendingStardust() >= 1; }
  pendingMoonstones() { return moonstonesFor(this.s.starsEver); }
  canConstellate() { return this.s.starsEver >= CONSTELLATION_AT && this.pendingMoonstones() >= 1; }

  // ---- time
  private earn(c: number) { const s = this.s; s.coins += c; s.earned += c; s.lifetime += c; s.stats.earned += c; }
  /**
   * Production for dt seconds. Shared by tick() and catchUp(), so time online and time away pay the same. Boost ends split the
   * time into pieces with a fixed multiplier; the tide is integrated exactly.
   */
  private produce(dt: number) {
    const s = this.s; if (dt <= 0) return;
    const g = this.globalMult(), cove = this.valleyDef.id === 'cove';
    let rate = 0; const pay: number[] = [];
    for (let i = 0; i < N; i++) { pay[i] = s.levels[i] > 0 ? this.cyclePay(i, g) : 0; if (s.managers[i]) rate += pay[i] / BUILDINGS[i].cycle; }
    // helpers: a steady stream, piece by piece between boost ends
    let a = s.t; const end = s.t + dt;
    const cuts = s.boosts.map((b) => b.until).filter((u) => u > a && u < end).sort((x, y) => x - y);
    for (const b of [...cuts, end]) {
      if (b <= a) continue;
      const span = cove ? tideIntegral(a, b) : b - a;
      if (rate > 0) this.earn(rate * this.boostMult((a + b) / 2) * span);
      a = b;
    }
    // buildings run by paw: a running cycle pays when it finishes, at that moment's boosts and tide
    for (let i = 0; i < N; i++) {
      if (s.managers[i] || s.cycles[i] < 0) continue;
      const len = this.cycleTime(i), left = len - s.cycles[i];
      if (dt >= left) { const at = s.t + left, c = pay[i] * this.boostMult(at) * (cove ? tideAt(at) : 1); this.earn(c); s.cycles[i] = -1; this.events.push({ kind: 'cycle', i, coins: c }); }
      else s.cycles[i] += dt;
    }
    s.t = end;
    s.boosts = s.boosts.filter((b) => b.until > s.t);
  }
  /** Things that run on the wall clock: research and trips finish whether or not production is credited. */
  private wallChecks() {
    const s = this.s;
    if (s.studying && s.wall >= s.studying.ends) { const id = s.studying.id; s.research.push(id); s.studying = null; this.events.push({ kind: 'research', id }); }
  }
  /** Online time: production, visitors, the Twig Shower offer and the fluff meter. dt in seconds. */
  tick(dt: number) {
    const s = this.s; if (!(dt > 0)) return;
    dt = Math.min(dt, 1);
    this.produce(dt);
    s.wall += dt * 1000; s.stats.played += dt;
    s.fluff = Math.max(0, s.fluff - FLUFF.decay * dt);
    if (s.visitor && s.t >= s.visitor.until) s.visitor = null;
    if (!s.visitor && s.t >= s.nextVisit) this.spawnVisitor();
    if (s.shower && s.t >= s.shower.until) s.shower = null;
    if (!s.shower && s.t >= s.nextShower) { s.shower = { until: s.t + SHOWER.offer }; s.nextShower = s.t + SHOWER.offer + SHOWER.every[0] + this.roll() * (SHOWER.every[1] - SHOWER.every[0]); this.events.push({ kind: 'shower' }); }
    this.wallChecks();
    this.checkAchievements();
  }
  /**
   * Time away: brings the state up to `now` (ms). Production is credited for up to the offline cap; trips and research run on
   * the wall clock in full. Visitors and Twig Showers wait for you to come back.
   */
  catchUp(now: number): AwaySummary {
    const s = this.s, away = Math.max(0, (now - s.wall) / 1000), cap = this.offlineCapHours() * 3600;
    const credited = Math.min(away, cap), before = s.coins, researchBefore = s.research.length;
    let left = credited; while (left > 0) { const step = Math.min(left, 3600); this.produce(step); left -= step; }
    if (now > s.wall) s.wall = now;
    if (s.visitor) s.visitor = null;
    s.nextVisit = Math.max(s.nextVisit, s.t + 20);
    if (s.shower) s.shower = null;
    s.nextShower = Math.max(s.nextShower, s.t + 60);
    this.wallChecks();
    this.checkAchievements();
    return { away, credited, capped: away > cap, coins: s.coins - before, tripsReady: s.trips.filter((x) => x && s.wall >= x.ends).length, research: s.research.slice(researchBefore) };
  }
  private spawnVisitor() {
    const s = this.s, total = Object.values(VISITORS).reduce((a, v) => a + v.weight, 0);
    let pick = this.roll() * total, kind: VisitorKind = 'acorn';
    for (const [k, v] of Object.entries(VISITORS) as [VisitorKind, (typeof VISITORS)[VisitorKind]][]) { pick -= v.weight; if (pick < 0) { kind = k; break; } }
    let stay: number = VISIT.stay; for (const p of this.perks('stay')) stay += (p as { s: number }).s;
    s.visitor = { kind, at: s.t, until: s.t + stay, y: 0.15 + this.roll() * 0.4, dir: this.roll() < 0.5 ? 1 : -1 };
    s.nextVisit = s.t + (VISIT.min + this.roll() * (VISIT.max - VISIT.min)) / this.visitRate();
    this.events.push({ kind: 'visitor', v: kind });
  }
  private addBoost(kind: BoostKind, mult: number, seconds: number) {
    const s = this.s, b = s.boosts.find((x) => x.kind === kind);
    if (b && kind === 'berry') b.until += seconds;
    else if (b) { b.mult = Math.max(b.mult, mult); b.until = Math.max(b.until, s.t + seconds); }
    else s.boosts.push({ kind, mult, until: s.t + seconds });
  }
  boost(kind: BoostKind) { return this.s.boosts.find((b) => b.kind === kind && b.until > this.s.t) ?? null; }

  // ---- actions
  /** Levels the next buy would add for the current buy setting (×1, ×10, ×100 or max). */
  buyCount(i: number, mode = this.s.buy) {
    const s = this.s, room = MAX_LEVEL - s.levels[i];
    if (mode === 0) return Math.max(1, Math.min(room, maxAfford(i, s.levels[i], s.coins, this.costMult())));
    return Math.min(room, mode);
  }
  buyCost(i: number, n = this.buyCount(i)) { return costOf(i, this.s.levels[i], n, this.costMult()); }
  buy(i: number, n = this.buyCount(i)) {
    const s = this.s; if (i < 0 || i >= N || n < 1 || s.levels[i] + n > MAX_LEVEL) return false;
    if (i > 0 && s.levels[i - 1] < 1 && s.levels[i] === 0) return false;
    const c = this.buyCost(i, n); if (c > s.coins) return false;
    const was = s.levels[i], fest = FESTIVALS.filter((f) => s.levels.every((l) => l >= f)).length;
    s.coins -= c; s.levels[i] += n;
    this.events.push({ kind: 'buy', i, n });
    for (const [l, x] of MILESTONES) if (was < l && s.levels[i] >= l) this.events.push({ kind: 'milestone', i, level: l, x });
    const fest2 = FESTIVALS.filter((f) => s.levels.every((l) => l >= f));
    if (fest2.length > fest) this.events.push({ kind: 'festival', level: fest2[fest2.length - 1] });
    this.checkAchievements();
    return true;
  }
  /** Is building i visible in the shop yet (the one after the last owned is shown as the next to build)? */
  unlocked(i: number) { return i === 0 || this.s.levels[i - 1] > 0 || this.s.levels[i] > 0; }
  hire(i: number) {
    const s = this.s; if (s.managers[i] || s.levels[i] < 1) return false;
    const c = this.managerCost(i); if (c > s.coins) return false;
    s.coins -= c; s.managers[i] = true; s.cycles[i] = -1; this.events.push({ kind: 'hire', i }); this.checkAchievements(); return true;
  }
  upgrade(id: string) {
    const s = this.s, u = UPGRADES.find((x) => x.id === id); if (!u || s.upgrades.includes(id) || u.cost > s.coins) return false;
    if (u.target !== 'all' && s.levels[u.target] < 1) return false;
    s.coins -= u.cost; s.upgrades.push(id); this.events.push({ kind: 'upgrade', id }); return true;
  }
  /** Start one cycle of a building that has no helper yet. */
  run(i: number) {
    const s = this.s; if (s.managers[i] || s.levels[i] < 1 || s.cycles[i] >= 0) return false;
    s.cycles[i] = 0; return true;
  }
  /** A tap on Dora and Enzo: a few coins and some fluff for the burst meter. */
  tap() {
    const s = this.s, c = this.tapValue(); this.earn(c); s.stats.taps++;
    this.events.push({ kind: 'tap', coins: c });
    if (!this.boost('fluff')) { s.fluff += 1; if (s.fluff >= FLUFF.max) this.burst(); }
    return c;
  }
  private burst() { this.s.fluff = 0; this.addBoost('fluff', this.burstMult(), this.burstSeconds()); this.s.stats.bursts++; this.events.push({ kind: 'burst' }); }
  catchVisitor() {
    const s = this.s, v = s.visitor; if (!v || s.t >= v.until) return null;
    s.visitor = null; s.stats.visitors++;
    if (this.valleyDef.id === 'glowcap') s.spores++;
    let text = '';
    if (v.kind === 'acorn') { this.addBoost('acorn', ACORN.mult, ACORN.seconds); text = `Golden Acorn! ×${ACORN.mult} for ${ACORN.seconds} s`; }
    else if (v.kind === 'pedlar') { const c = Math.max(25, this.baseRate() * 600); this.earn(c); text = `+${fmt(c)} coins from the pedlar`; }
    else if (v.kind === 'owl') { s.items.bp++; text = '+1 blueprint'; }
    else if (v.kind === 'bat') { s.items.berry++; text = '+1 sunberry'; }
    else { this.burst(); text = 'Fluff Burst!'; }
    this.events.push({ kind: 'caught', v: v.kind, text }); this.checkAchievements();
    return text;
  }
  useBerry() { const s = this.s; if (s.items.berry < 1) return false; s.items.berry--; this.addBoost('berry', BERRY.mult, BERRY.seconds); this.events.push({ kind: 'item', text: `Sunberry: ×${BERRY.mult} for ${BERRY.seconds / 60} minutes` }); return true; }
  /** A clock acorn: an hour of steady production right now. */
  useClock() { const s = this.s; if (s.items.clock < 1) return false; s.items.clock--; const c = this.baseRate() * 3600; this.earn(c); this.events.push({ kind: 'item', text: `Clock Acorn: +${fmt(c)} coins` }); return true; }
  /** Spend a clock acorn to bring research or a trip an hour closer. */
  rush(what: 'research' | number) {
    const s = this.s; if (s.items.clock < 1) return false;
    if (what === 'research') { if (!s.studying) return false; s.studying.ends -= 3600000; }
    else { const tr = s.trips[what]; if (!tr || s.wall >= tr.ends) return false; tr.ends -= 3600000; }
    s.items.clock--; this.wallChecks(); return true;
  }
  /** The Twig Shower: starts the minigame (returns its seed), or null if none is on offer. */
  startShower() { const s = this.s; if (!s.shower) return null; s.shower = null; return Math.floor(this.roll() * 4294967296); }
  finishShower(caught: number) {
    const s = this.s; caught = Math.max(0, Math.min(200, Math.floor(caught) || 0));
    s.stats.showers++; s.stats.bestShower = Math.max(s.stats.bestShower, caught);
    let sec: number = SHOWER.boost; if (this.has('baskets')) sec *= 1.5; for (const p of this.perks('event')) sec *= (p as { x: number }).x;
    const mult = Math.min(SHOWER.cap, 1 + SHOWER.per * caught);
    if (caught > 0) this.addBoost('twig', mult, sec);
    this.checkAchievements();
    return { mult, seconds: sec };
  }
  sendTrip(dest: string, slot?: number) {
    const s = this.s, d = TRIPS.find((x) => x.id === dest); if (!d) return false;
    if (slot === undefined) slot = s.trips.findIndex((x, k) => k < this.tripSlots() && !x);
    if (slot < 0 || slot >= this.tripSlots() || s.trips[slot]) return false;
    const loot: Loot = { bp: 0, berry: 0, clock: 0, stardust: 0, trailmix: 0, keepsake: -1 };
    let finds = d.finds; for (const p of this.perks('loot')) finds += (p as { n: number }).n;
    for (let k = 0; k < finds; k++) {
      const r = this.roll();
      if (r < 0.42) loot.bp++; else if (r < 0.64) loot.berry++; else if (r < 0.78) loot.clock++;
      else if (r < 0.86 && s.stats.migrations > 0) loot.stardust += Math.max(1, Math.floor(s.starsEver * 0.01));
      else loot.trailmix++;
    }
    if (this.roll() < d.keepsake) loot.keepsake = Math.floor(this.roll() * KEEPSAKES.length);
    s.trips[slot] = { dest, team: slot, start: s.wall, ends: s.wall + d.minutes * 60000 * this.tripMult(), loot };
    return true;
  }
  /** Bring a finished trip home; returns what it found. */
  claimTrip(slot: number) {
    const s = this.s, tr = s.trips[slot]; if (!tr || s.wall < tr.ends) return null;
    const L = tr.loot, parts: string[] = [];
    s.items.bp += L.bp; s.items.berry += L.berry; s.items.clock += L.clock;
    if (L.bp) parts.push(`${L.bp} blueprint${L.bp > 1 ? 's' : ''}`);
    if (L.berry) parts.push(`${L.berry} sunberr${L.berry > 1 ? 'ies' : 'y'}`);
    if (L.clock) parts.push(`${L.clock} clock acorn${L.clock > 1 ? 's' : ''}`);
    if (L.stardust) { s.stardust += L.stardust; s.starsEver += L.stardust; parts.push(`${L.stardust} Stardust`); }
    if (L.trailmix) { const c = this.baseRate() * 1200 * L.trailmix + 50; this.earn(c); parts.push(`trail mix worth ${fmt(c)} coins`); }
    if (L.keepsake >= 0) {
      if (s.keepsakes[L.keepsake]++ === 0) parts.push(`a keepsake: the ${KEEPSAKES[L.keepsake]}!`);
      else { s.items.bp += 2; parts.push(`another ${KEEPSAKES[L.keepsake]} (traded for 2 blueprints)`); }
    }
    s.trips[slot] = null; s.stats.trips++;
    this.events.push({ kind: 'trip', slot }); this.checkAchievements();
    return parts;
  }
  canResearch(id: string) {
    const s = this.s, r = RESEARCH.find((x) => x.id === id);
    return !!r && !s.studying && !this.has(id) && (!r.needs || this.has(r.needs)) && s.items.bp >= r.bp;
  }
  study(id: string) {
    if (!this.canResearch(id)) return false;
    const r = RESEARCH.find((x) => x.id === id)!; this.s.items.bp -= r.bp; this.s.studying = { id, ends: this.s.wall + r.minutes * 60000 }; return true;
  }
  /** The daily gift; `day` is the player's local calendar day number. */
  claimDaily(day: number) {
    const s = this.s, d = s.daily; if (!(day > d.last)) return null;
    d.streak = day === d.last + 1 ? d.streak + 1 : 1; d.last = day; d.best = Math.max(d.best, d.streak);
    const g = DAILY[(d.streak - 1) % DAILY.length] as { bp?: number; berry?: number; clock?: number; stardust?: number }, parts: string[] = [];
    if (g.bp) { s.items.bp += g.bp; parts.push(`${g.bp} blueprints`); }
    if (g.berry) { s.items.berry += g.berry; parts.push(`${g.berry} sunberr${g.berry > 1 ? 'ies' : 'y'}`); }
    if (g.clock) { s.items.clock += g.clock; parts.push(`${g.clock} clock acorn${g.clock > 1 ? 's' : ''}`); }
    if (g.stardust) { const n = Math.max(5, Math.floor(s.starsEver * 0.05)); s.stardust += n; s.starsEver += n; parts.push(`${n} Stardust`); }
    const text = `Day ${d.streak}: ${parts.join(', ')}`; this.events.push({ kind: 'gift', text }); this.checkAchievements();
    return text;
  }
  dailyReady(day: number) { return day > this.s.daily.last; }
  buyTree(id: string) {
    const s = this.s, n = STAR_TREE.find((x) => x.id === id); if (!n) return false;
    const l = this.tree(id); if (l >= n.max) return false; const c = n.cost(l); if (c > s.stardust) return false;
    s.stardust -= c; s.tree[id] = l + 1; return true;
  }
  buyMoon(id: string) {
    const s = this.s, n = MOON_SHOP.find((x) => x.id === id); if (!n) return false;
    const l = this.moon(id); if (l >= n.max) return false; const c = n.cost(l); if (c > s.moonstones) return false;
    s.moonstones -= c; s.moon[id] = l + 1; return true;
  }
  /** Lay out a fresh valley: coins, buildings and helpers per the Star Tree and the Constellation shop. */
  private newValley() {
    const s = this.s;
    s.coins = [0, 1e3, 1e5, 1e7, 1e9][this.tree('welcome')];
    s.earned = 0; s.upgrades = []; s.spores = 0; s.boosts = []; s.fluff = 0; s.visitor = null; s.shower = null;
    s.levels = BUILDINGS.map((_, i) => (i === 0 ? 1 : 0)); s.cycles = BUILDINGS.map(() => -1);
    const seeded = 4 * this.moon('starseed'); for (let i = 0; i < seeded; i++) s.levels[i] = 25;
    const keep = this.moon('founders') ? N : [0, 4, 8, N][this.tree('friends')];
    s.managers = BUILDINGS.map((_, i) => i === 0 || (i < keep && s.managers[i]));
    s.nextVisit = s.t + 40; s.nextShower = Math.max(s.nextShower, s.t + 240);
  }
  /** The Great Migration: Stardust for the earnings so far, then a new valley with its own twist. */
  migrate() {
    const s = this.s; if (!this.canMigrate()) return 0;
    const gain = this.pendingStardust(); s.stardust += gain; s.starsEver += gain; s.valley++; s.stats.migrations++;
    this.newValley(); this.events.push({ kind: 'migrate', stardust: gain }); this.checkAchievements();
    return gain;
  }
  /** Name a Constellation: Stardust and the Star Tree become Moonstones; the colony starts again in Meadowvale. */
  constellate() {
    const s = this.s; if (!this.canConstellate()) return 0;
    const gain = this.pendingMoonstones(); s.moonstones += gain; s.constellations++;
    s.stardust = 0; s.starsEver = 0; s.tree = {}; s.lifetime = 0; s.valley = 0;
    s.managers = s.managers.map((_, i) => i === 0);
    this.newValley(); this.events.push({ kind: 'constellation', moonstones: gain }); this.checkAchievements();
    return gain;
  }
  setBuy(mode: 1 | 10 | 100 | 0) { this.s.buy = mode; }
  checkAchievements() {
    const s = this.s;
    for (const a of ACHIEVEMENTS) if (!s.achieved.includes(a.id) && a.test(s)) { s.achieved.push(a.id); this.events.push({ kind: 'achievement', id: a.id }); }
  }
  /** Anything worth a look: a full trip, a free research desk with blueprints, a gift, a migration. Used for the tab badges. */
  todo(day: number) {
    const s = this.s;
    return {
      trips: s.trips.some((x, k) => (x ? s.wall >= x.ends : k < this.tripSlots())),
      research: !s.studying && RESEARCH.some((r) => this.canResearch(r.id)),
      gift: this.dailyReady(day),
      stars: this.canMigrate() || this.canConstellate(),
    };
  }
  save() { return JSON.stringify(this.s); }
}

// ---------------------------------------------------------------- saving
const num = (x: unknown, d: number, lo = 0, hi = Number.MAX_VALUE) => (typeof x === 'number' && Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : d);
const int = (x: unknown, d: number, lo = 0, hi = Number.MAX_SAFE_INTEGER) => Math.floor(num(x, d, lo, hi));
const rec = (x: unknown, defs: readonly TreeDef[]) => {
  const out: Record<string, number> = {}; if (!x || typeof x !== 'object') return out;
  for (const d of defs) { const v = int((x as Record<string, unknown>)[d.id], 0, 0, d.max); if (v) out[d.id] = v; }
  return out;
};
/** Reads a save defensively: anything missing, broken or from another version falls back to a fresh valley. */
export function readSave(raw: string | null, seed: number, wall: number): HayloftGame {
  const f = freshState(seed, wall);
  let o: Record<string, unknown>;
  try { o = raw ? JSON.parse(raw) : null; } catch { return new HayloftGame(f); }
  if (!o || typeof o !== 'object' || o.v !== 1) return new HayloftGame(f);
  const arr = <T>(x: unknown, len: number, map: (v: unknown, i: number) => T, d: T[]) => (Array.isArray(x) && x.length === len ? x.map(map) : d);
  const st = (o.stats ?? {}) as Record<string, unknown>, items = (o.items ?? {}) as Record<string, unknown>, daily = (o.daily ?? {}) as Record<string, unknown>;
  const s: State = {
    ...f,
    seed: int(o.seed, f.seed, 0, 4294967295), rng: int(o.rng, f.rng, -2147483648, 4294967295) | 0,
    t: num(o.t, 0), wall: num(o.wall, wall, 0),
    coins: num(o.coins, 0), earned: num(o.earned, 0), lifetime: num(o.lifetime, 0),
    levels: arr(o.levels, N, (v, i) => int(v, i === 0 ? 1 : 0, 0, MAX_LEVEL), f.levels),
    cycles: arr(o.cycles, N, (v) => num(v, -1, -1, 1e5), f.cycles),
    managers: arr(o.managers, N, (v, i) => i === 0 || v === true, f.managers),
    upgrades: Array.isArray(o.upgrades) ? o.upgrades.filter((u): u is string => typeof u === 'string' && UPGRADES.some((x) => x.id === u)) : [],
    valley: int(o.valley, 0, 0, 1e6), spores: int(o.spores, 0, 0, 1e6),
    stardust: num(o.stardust, 0), starsEver: num(o.starsEver, 0), tree: rec(o.tree, STAR_TREE),
    moonstones: num(o.moonstones, 0), moon: rec(o.moon, MOON_SHOP), constellations: int(o.constellations, 0),
    boosts: Array.isArray(o.boosts) ? o.boosts.filter((b): b is Boost => !!b && ['fluff', 'acorn', 'twig', 'berry'].includes(b.kind) && Number.isFinite(b.mult) && Number.isFinite(b.until)).map((b) => ({ kind: b.kind, mult: num(b.mult, 1, 1, 100), until: b.until })) : [],
    fluff: num(o.fluff, 0, 0, FLUFF.max),
    items: { bp: int(items.bp, 0), berry: int(items.berry, 0), clock: int(items.clock, 0) },
    keepsakes: arr(o.keepsakes, KEEPSAKES.length, (v) => int(v, 0), f.keepsakes),
    research: Array.isArray(o.research) ? [...new Set(o.research.filter((r): r is string => typeof r === 'string' && RESEARCH.some((x) => x.id === r)))] : [],
    studying: o.studying && typeof o.studying === 'object' && RESEARCH.some((r) => r.id === (o.studying as { id: unknown }).id) ? { id: (o.studying as { id: string }).id, ends: num((o.studying as { ends: unknown }).ends, wall) } : null,
    trips: arr(o.trips, 5, (v) => {
      if (!v || typeof v !== 'object') return null; const x = v as Record<string, unknown>, L = (x.loot ?? {}) as Record<string, unknown>;
      if (!TRIPS.some((d) => d.id === x.dest)) return null;
      return { dest: x.dest as string, team: int(x.team, 0, 0, 4), start: num(x.start, wall), ends: num(x.ends, wall), loot: { bp: int(L.bp, 0), berry: int(L.berry, 0), clock: int(L.clock, 0), stardust: int(L.stardust, 0), trailmix: int(L.trailmix, 0), keepsake: int(L.keepsake, -1, -1, KEEPSAKES.length - 1) } };
    }, f.trips),
    visitor: null, nextVisit: num(o.nextVisit, f.nextVisit), shower: null, nextShower: num(o.nextShower, f.nextShower),
    daily: { last: int(daily.last, -1, -1), streak: int(daily.streak, 0), best: int(daily.best, 0) },
    achieved: Array.isArray(o.achieved) ? [...new Set(o.achieved.filter((a): a is string => typeof a === 'string' && ACHIEVEMENTS.some((x) => x.id === a)))] : [],
    buy: ([1, 10, 100, 0] as const).find((b) => b === o.buy) ?? 1,
    stats: {
      earned: num(st.earned, 0), taps: int(st.taps, 0), visitors: int(st.visitors, 0), migrations: int(st.migrations, 0), trips: int(st.trips, 0),
      showers: int(st.showers, 0), bestShower: int(st.bestShower, 0), bursts: int(st.bursts, 0), played: num(st.played, 0),
    },
  };
  // a running cycle on a building with a helper (or none owned) is just idle
  s.cycles = s.cycles.map((c, i) => (s.managers[i] || s.levels[i] < 1 ? -1 : c));
  return new HayloftGame(s);
}

// ---------------------------------------------------------------- the Twig Shower minigame
export interface Twig { id: number; x: number; born: number; fall: number; gold: boolean; caught: boolean; gone: boolean }
/**
 * Apple twigs tumble down for ten seconds; tap them before they reach the grass. Positions are in a 0..1 square (x across, y
 * down). Golden twigs count three. Deterministic for a seed.
 */
export class TwigShower {
  time = 0; caught = 0; twigs: Twig[] = []; private rng: number; private next = 0.2; private id = 0;
  static RADIUS = 0.1;
  constructor(seed: number) { this.rng = seed | 0; }
  private roll() { const [v, n] = rand(this.rng); this.rng = n; return v; }
  get done() { return this.time >= SHOWER.seconds && this.twigs.every((t) => t.caught || t.gone); }
  y(t: Twig, at = this.time) { return -0.08 + ((at - t.born) / t.fall) * 1.1; }
  tick(dt: number) {
    this.time += dt;
    while (this.next <= this.time && this.next < SHOWER.seconds) {
      const late = this.next / SHOWER.seconds;
      this.twigs.push({ id: this.id++, x: 0.08 + this.roll() * 0.84, born: this.next, fall: 2.3 - late * 0.9 + this.roll() * 0.4, gold: this.roll() < 0.12, caught: false, gone: false });
      this.next += 0.26 + this.roll() * 0.18;
    }
    for (const t of this.twigs) if (!t.caught && !t.gone && this.y(t) > 1.02) t.gone = true;
  }
  /** A tap at (x, y): catches the nearest falling twig within reach. Returns it, or null. */
  tap(x: number, y: number) {
    let best: Twig | null = null, d = TwigShower.RADIUS;
    for (const t of this.twigs) {
      if (t.caught || t.gone || this.time < t.born) continue;
      const dd = Math.hypot(t.x - x, this.y(t) - y); if (dd < d) { d = dd; best = t; }
    }
    if (best) { best.caught = true; this.caught += best.gold ? 3 : 1; }
    return best;
  }
}
