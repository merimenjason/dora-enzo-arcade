// Dusty Hollow: a cozy village-life game. Deterministic, no DOM; the page and the
// canvas scene read this state, and tests/dusty-hollow.mjs drives it directly.

export const W = 32;
export const H = 24;
/** Seconds of real time in one village day. */
export const DAY = 360;
export const DAYS_PER_SEASON = 4;
export const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;
export type Season = (typeof SEASONS)[number];
export const WALK = 3.2;
export const RUN = 5.4;
/** Sneaking speed; shy bugs let a sneaking hero get twice as close. */
export const SNEAK = 1.2;
export const POCKETS = 20;
export const LOANS = [4800, 19800, 49800];
export const HOME_NAMES = ['Tent', 'Cozy Burrow', 'Roomy Burrow', 'Grand Burrow'];
/** Room size in tiles per home level: [columns, rows]. */
export const HOME_GRID: [number, number][] = [[3, 2], [4, 2], [4, 3], [5, 3]];
export const BITE_WINDOW = 0.9;
export const REEL_SPEED = 0.7;
export const REEL_SLIP = 0.12;
export const TENSION_RELAX = 1.3;
export const ROCK_HITS = 4;
export const ROCK_DROPS = [25, 50, 75, 100];
export const FOSSILS_PER_DAY = 3;
export const SHELLS_PER_DAY = 3;
export const SNOWBALLS = 3;
export const SNOWMAN_PRIZE = 500;
export const MAX_BUGS = 6;
export const SAPLING_DAYS = 3;
export const SHOP_OPEN = 8;
export const SHOP_CLOSE = 22;
export const WAKE = 7;
export const BEDTIME = 22;
export const FRIEND_MAX = 10;
export const FRIEND_TITLES = ['Stranger', 'Neighbour', 'Neighbour', 'Acquaintance', 'Acquaintance', 'Friend', 'Friend', 'Good friend', 'Good friend', 'Best friend', 'Best friend'];
export const FESTIVAL_PRIZES = [3000, 1500, 500];
export const WISH_PRIZE = 300;
export const BIRTHDAY_BONUS = 5;
/** Raisins for completing a museum wing, on top of a plaque for the burrow. */
export const WING_REWARD = 3000;
/** One-time raisins when three pieces of a furniture set stand in the room. */
export const SET_BONUS = 1000;
export const BALLOON_PRIZE = 500;
/** Chance a planted foreign fruit grows into a golden tree. */
export const GOLDEN_CHANCE = 0.12;
export const VISIT_FRIENDSHIP = 6;
export const YEAR = DAYS_PER_SEASON * 4;

export type Terrain = 'grass' | 'path' | 'water' | 'sand' | 'cliff' | 'bridge';
export type Habitat = 'river' | 'pond' | 'sea';
export type TimeOfDay = 'day' | 'night' | 'any';
export type Hero = 'dora' | 'enzo';
export type Tool = 'hands' | 'net' | 'rod' | 'shovel' | 'can' | 'trowel';
export type Kind = 'fish' | 'bug' | 'fossil' | 'fruit' | 'flower' | 'seed' | 'furniture' | 'shell';
export type Facing = 0 | 1 | 2 | 3; // up, right, down, left
export const FACE: [number, number][] = [[0, -1], [1, 0], [0, 1], [-1, 0]];

export type Species = { id: string; name: string; price: number; habitat?: Habitat | 'grass' | 'tree' | 'flower' | 'water'; time: TimeOfDay; seasons: Season[]; rarity: number; rain?: boolean; festival?: boolean; blurb: string };
export const FISH: Species[] = [
  { id: 'trout', name: 'Rainbow Trout', price: 300, habitat: 'river', time: 'any', seasons: ['spring', 'summer', 'autumn', 'winter'], rarity: 5, blurb: 'Loves cold, quick water.' },
  { id: 'catfish', name: 'Andean Catfish', price: 800, habitat: 'river', time: 'night', seasons: ['spring', 'summer', 'autumn'], rarity: 2, blurb: 'Whiskers first, questions later.' },
  { id: 'salmon', name: 'Pacific Salmon', price: 700, habitat: 'river', time: 'any', seasons: ['autumn'], rarity: 3, blurb: 'Swims uphill every autumn.' },
  { id: 'pejerrey', name: 'Andean Pejerrey', price: 2800, habitat: 'river', time: 'day', seasons: ['autumn'], rarity: 1, blurb: 'A silver flash in the autumn shallows.' },
  { id: 'pupfish', name: 'Pupfish', price: 120, habitat: 'pond', time: 'day', seasons: ['spring', 'summer', 'autumn', 'winter'], rarity: 5, blurb: 'Tiny, tough and everywhere.' },
  { id: 'frog', name: 'Pond Frog', price: 100, habitat: 'pond', time: 'any', seasons: ['spring', 'summer'], rarity: 4, blurb: 'Technically not a fish. Nobody minds.' },
  { id: 'carp', name: 'Crucian Carp', price: 160, habitat: 'pond', time: 'any', seasons: ['spring', 'summer', 'autumn', 'winter'], rarity: 5, blurb: 'The pond’s steady resident.' },
  { id: 'goldfish', name: 'Goldfish', price: 1300, habitat: 'pond', time: 'day', seasons: ['spring', 'summer'], rarity: 2, blurb: 'Someone’s pet, long ago.' },
  { id: 'koi', name: 'Koi', price: 4000, habitat: 'pond', time: 'night', seasons: ['spring', 'summer', 'autumn', 'winter'], rarity: 1, blurb: 'Patient as the moon.' },
  { id: 'anchovy', name: 'Anchovy', price: 200, habitat: 'sea', time: 'day', seasons: ['spring', 'summer', 'autumn', 'winter'], rarity: 5, blurb: 'Travels in silver crowds.' },
  { id: 'sardine', name: 'Peruvian Sardine', price: 150, habitat: 'sea', time: 'any', seasons: ['spring', 'summer', 'autumn', 'winter'], rarity: 5, blurb: 'The coast’s bread and butter.' },
  { id: 'seabass', name: 'Sea Bass', price: 400, habitat: 'sea', time: 'any', seasons: ['spring', 'summer', 'autumn', 'winter'], rarity: 4, blurb: 'At least it’s a decent size.' },
  { id: 'squid', name: 'Humboldt Squid', price: 1500, habitat: 'sea', time: 'night', seasons: ['spring', 'summer', 'autumn', 'winter'], rarity: 2, blurb: 'Rises with the dark.' },
  { id: 'ray', name: 'Manta Ray', price: 3000, habitat: 'sea', time: 'day', seasons: ['summer'], rarity: 1, blurb: 'A kite under the waves.' },
  { id: 'tuna', name: 'Yellowfin Tuna', price: 7000, habitat: 'sea', time: 'any', seasons: ['summer', 'winter'], rarity: 1, blurb: 'The one everyone talks about.' },
  { id: 'dorado', name: 'Golden Dorado', price: 9000, habitat: 'river', time: 'any', seasons: ['spring'], rarity: 1, festival: true, blurb: 'Surfaces once a year, on tourney day.' },
  { id: 'zungaro', name: 'Great Zúngaro', price: 12000, habitat: 'river', time: 'any', seasons: ['autumn'], rarity: 1, festival: true, blurb: 'The catfish the whole hollow tells stories about.' },
  { id: 'titicaca', name: 'Titicaca Water Frog', price: 10000, habitat: 'pond', time: 'any', seasons: ['winter'], rarity: 1, festival: true, blurb: 'Comes up through the ice on Snowman Day.' },
];
export const BUGS: Species[] = [
  { id: 'butterfly', name: 'Common Butterfly', price: 160, habitat: 'flower', time: 'day', seasons: ['spring', 'summer'], rarity: 5, blurb: 'Drifts from bloom to bloom.' },
  { id: 'swallowtail', name: 'Andean Swallowtail', price: 240, habitat: 'flower', time: 'day', seasons: ['spring'], rarity: 3, blurb: 'Only shows up for spring.' },
  { id: 'bee', name: 'Bumblebee', price: 300, habitat: 'flower', time: 'day', seasons: ['spring', 'summer', 'autumn'], rarity: 4, blurb: 'Busy, fuzzy, forgiving.' },
  { id: 'ladybug', name: 'Ladybug', price: 200, habitat: 'grass', time: 'day', seasons: ['spring', 'autumn'], rarity: 4, blurb: 'Lucky, if you ask a chinchilla.' },
  { id: 'grasshopper', name: 'Grasshopper', price: 160, habitat: 'grass', time: 'day', seasons: ['summer', 'autumn'], rarity: 5, blurb: 'Jumps before you can blink.' },
  { id: 'cricket', name: 'Cricket', price: 130, habitat: 'grass', time: 'night', seasons: ['summer', 'autumn'], rarity: 5, blurb: 'The sound of a warm evening.' },
  { id: 'firefly', name: 'Firefly', price: 300, habitat: 'water', time: 'night', seasons: ['summer'], rarity: 3, blurb: 'A lantern the size of a seed.' },
  { id: 'dragonfly', name: 'Dragonfly', price: 230, habitat: 'water', time: 'day', seasons: ['summer', 'autumn'], rarity: 4, blurb: 'Hovers over the river.' },
  { id: 'cicada', name: 'Cicada', price: 250, habitat: 'tree', time: 'day', seasons: ['summer'], rarity: 4, blurb: 'Louder than it has any right to be.' },
  { id: 'moth', name: 'Moth', price: 130, habitat: 'tree', time: 'night', seasons: ['spring', 'summer', 'autumn', 'winter'], rarity: 5, blurb: 'Drawn to the porch lamps.' },
  { id: 'stag', name: 'Stag Beetle', price: 2000, habitat: 'tree', time: 'night', seasons: ['summer'], rarity: 1, blurb: 'The prize of a summer night.' },
  { id: 'snail', name: 'Snail', price: 250, habitat: 'flower', time: 'any', seasons: ['spring', 'summer', 'autumn'], rarity: 4, rain: true, blurb: 'Comes out only when it rains.' },
  { id: 'wintermoth', name: 'Winter Moth', price: 600, habitat: 'tree', time: 'night', seasons: ['winter'], rarity: 2, blurb: 'Flies when nothing else dares.' },
  { id: 'snowflea', name: 'Snow Flea', price: 350, habitat: 'grass', time: 'day', seasons: ['winter'], rarity: 4, blurb: 'A speck of pepper on the snow.' },
  { id: 'hercules', name: 'Hercules Beetle', price: 11000, habitat: 'tree', time: 'any', seasons: ['summer'], rarity: 1, festival: true, blurb: 'Shows itself only on Bug-Off day.' },
];
/** The jackpot species that surfaces only on each season's festival day. */
export const JACKPOTS: Record<Season, Species> = {
  spring: FISH.find((f) => f.id === 'dorado')!,
  summer: BUGS.find((b) => b.id === 'hercules')!,
  autumn: FISH.find((f) => f.id === 'zungaro')!,
  winter: FISH.find((f) => f.id === 'titicaca')!,
};
export const FOSSILS: Species[] = [
  { id: 'ammonite', name: 'Ammonite', price: 1100, time: 'any', seasons: [], rarity: 5, blurb: 'A spiral from an ancient sea.' },
  { id: 'trilobite', name: 'Trilobite', price: 1300, time: 'any', seasons: [], rarity: 5, blurb: 'Older than the mountains.' },
  { id: 'fern', name: 'Fern Fossil', price: 1000, time: 'any', seasons: [], rarity: 5, blurb: 'A leaf pressed for a million years.' },
  { id: 'glyptodont', name: 'Glyptodont Shell', price: 2500, time: 'any', seasons: [], rarity: 3, blurb: 'An armadillo the size of a car.' },
  { id: 'megatherium', name: 'Megatherium Claw', price: 2800, time: 'any', seasons: [], rarity: 3, blurb: 'From a giant ground sloth.' },
  { id: 'fang', name: 'Sabre-tooth Fang', price: 3200, time: 'any', seasons: [], rarity: 2, blurb: 'Best kept behind glass.' },
  { id: 'condor', name: 'Ancient Condor Skull', price: 3600, time: 'any', seasons: [], rarity: 2, blurb: 'Once had a six-metre wingspan.' },
  { id: 'egg', name: 'Dinosaur Egg', price: 5000, time: 'any', seasons: [], rarity: 1, blurb: 'Still hasn’t hatched. Probably won’t.' },
];
export const SHELLS: { id: string; name: string; price: number; rarity: number }[] = [
  { id: 'clam', name: 'Clam Shell', price: 90, rarity: 5 },
  { id: 'sanddollar', name: 'Sand Dollar', price: 150, rarity: 3 },
  { id: 'conch', name: 'Conch', price: 300, rarity: 2 },
];
export const FRUIT = ['apple', 'pear', 'peach', 'cherry', 'orange'] as const;
export type Fruit = (typeof FRUIT)[number];
export const NATIVE_FRUIT: Fruit = 'apple';
export const FRUIT_PRICE = { native: 100, foreign: 500, golden: 1500 };
/** Fruit id borne by a golden tree; it sells high and cannot be planted. */
export const GOLDEN_FRUIT = 'golden';
export const FLOWER_COLORS = ['red', 'yellow', 'white', 'orange', 'pink', 'purple', 'blue'] as const;
export type FlowerColor = (typeof FLOWER_COLORS)[number];
export const BASE_COLORS: FlowerColor[] = ['red', 'yellow', 'white'];
export const HYBRIDS: Record<string, FlowerColor> = { 'red+yellow': 'orange', 'red+white': 'pink', 'white+yellow': 'purple', 'white+white': 'blue' };
export const FLOWER_PRICE = { base: 40, hybrid: 400 };
export const SEED_PRICE = 80;
export const TOOL_PRICES: Partial<Record<Tool, number>> = { shovel: 600, can: 400, trowel: 2400 };
export const TOOL_NAMES: Record<Tool, string> = { hands: 'Bare paws', net: 'Bug net', rod: 'Fishing rod', shovel: 'Shovel', can: 'Watering can', trowel: 'Trowel' };
export type FurnitureSet = 'Cabin' | 'Seaside' | 'Andean';
export const SETS: FurnitureSet[] = ['Cabin', 'Seaside', 'Andean'];
export type Furniture = { id: string; name: string; price: number; shop: boolean; set?: FurnitureSet };
export const FURNITURE: Furniture[] = [
  { id: 'bed', name: 'Hay Bed', price: 900, shop: true, set: 'Cabin' },
  { id: 'table', name: 'Little Table', price: 600, shop: true, set: 'Cabin' },
  { id: 'shelf', name: 'Bookshelf', price: 1500, shop: true, set: 'Cabin' },
  { id: 'stove', name: 'Pebble Stove', price: 2000, shop: true, set: 'Cabin' },
  { id: 'tub', name: 'Dust Bath Tub', price: 1200, shop: true, set: 'Seaside' },
  { id: 'rug', name: 'Wool Rug', price: 800, shop: true, set: 'Seaside' },
  { id: 'hammock', name: 'Rope Hammock', price: 1100, shop: true, set: 'Seaside' },
  { id: 'chart', name: 'Sea Chart', price: 750, shop: true, set: 'Seaside' },
  { id: 'lamp', name: 'Paper Lamp', price: 700, shop: true, set: 'Andean' },
  { id: 'cactus', name: 'Cactus Pot', price: 400, shop: true, set: 'Andean' },
  { id: 'poncho', name: 'Woven Poncho', price: 900, shop: true, set: 'Andean' },
  { id: 'quena', name: 'Quena Flute Stand', price: 650, shop: true, set: 'Andean' },
  { id: 'trophy', name: 'Festival Trophy', price: 4000, shop: false },
  { id: 'photo-pia', name: 'Photo of Pia', price: 2000, shop: false },
  { id: 'photo-rodri', name: 'Photo of Rodri', price: 2000, shop: false },
  { id: 'photo-vivi', name: 'Photo of Vivi', price: 2000, shop: false },
  { id: 'photo-tato', name: 'Photo of Tato', price: 2000, shop: false },
  { id: 'photo-lupe', name: 'Photo of Lupe', price: 2000, shop: false },
  { id: 'photo-nico', name: 'Photo of Nico', price: 2000, shop: false },
  { id: 'plaque-fish', name: 'Aquarium Plaque', price: 3000, shop: false },
  { id: 'plaque-bug', name: 'Insect Hall Plaque', price: 3000, shop: false },
  { id: 'plaque-fossil', name: 'Fossil Gallery Plaque', price: 3000, shop: false },
];
/** Vito's verdict on the room, by score. */
export const HOME_RATINGS: [number, string][] = [[500, 'Bare but honest'], [1500, 'Getting somewhere'], [3000, 'Rather nice'], [Infinity, 'The talk of the hollow']];
export type Wing = { id: 'fish' | 'bug' | 'fossil'; name: string; list: Species[] };
export const WINGS: Wing[] = [{ id: 'fish', name: 'Aquarium', list: FISH }, { id: 'bug', name: 'Insect hall', list: BUGS }, { id: 'fossil', name: 'Fossil gallery', list: FOSSILS }];

export type Item = { kind: Kind; id: string; name: string; price: number; hidden?: string; pinned?: boolean };
export type Placed = { id: string; x: number; y: number };
export type Tree = { x: number; y: number; fruit: Fruit; count: number; grown: number /* day it bears fruit; 0 = mature */; golden?: boolean };
export type Flower = { x: number; y: number; color: FlowerColor; watered: boolean };
export type Rock = { x: number; y: number; hits: number };
export type Spot = { x: number; y: number };
export type Shell = Spot & { id: string };
export type Bug = { id: string; x: number; y: number; vx: number; vy: number; life: number; shy: boolean; fleeing: boolean };
export type Building = { id: string; name: string; x: number; y: number; w: number; h: number; door: [number, number] };
export type VillagerDef = { id: string; name: string; species: string; likes: Kind; color: string; home: string; lines: string[]; arrives?: number; story?: string };
export type Villager = VillagerDef & { x: number; y: number; tx: number; ty: number; wait: number; facing: Facing };
/** Where a villager likes to be at each part of the day. */
export type Haunt = { x: number; y: number; name: string };
export type Period = 'morning' | 'afternoon' | 'evening';
export type Balloon = { x: number; y: number; speed: number };
export type Summary = { day: number; lines: string[] };
export type Request = { villager: string; kind: Kind; done: boolean };
export type Dialog = { speaker: string; text: string; options: { label: string; action: string }[] };
export type Screen = 'world' | 'shop' | 'museum' | 'home' | 'board';
export type Weather = 'clear' | 'rain' | 'snow';
export type Festival = 'tourney' | 'bugoff' | 'snowday' | null;
export type FishingPhase = 'wait' | 'nibble' | 'bite' | 'reel';
export type Fishing = { x: number; y: number; species: string; size: 1 | 2 | 3; fight: number; phase: FishingPhase; timer: number; nibbles: number; progress: number; tension: number };
export type Effect = { kind: 'fruit' | 'dirt' | 'splash' | 'puff' | 'sparkle' | 'snow' | 'leaf' | 'present'; x: number; y: number; age: number; color: string };
export type Goal = { id: string; text: string; reward: number; test: (g: Hollow) => boolean };
export type Peek = { target: string; hint: string };

export const HERO_NAMES: Record<Hero, string> = { dora: 'Dora', enzo: 'Enzo' };
export const NEIGHBOURS: VillagerDef[] = [
  { id: 'pia', name: 'Pia', species: 'flamingo', likes: 'fish', color: '#f39ab5', home: 'house-pia', lines: ['The sea is loud today. I like it.', 'Have you tried standing on one leg? Very restful.', 'Pink is not a phase, it is a lifestyle.'], story: 'You’ve heard me talk about the sea all year, so here’s the truth of it: I flew here from a salt lake that dried up, and I promised myself I’d never live anywhere I couldn’t hear water. Then you turned up and made the whole hollow feel less like somewhere I landed and more like somewhere I chose. Keep this photo of me. Stand it in your burrow so I’m in the room even when I’m at the beach.' },
  { id: 'rodri', name: 'Rodri', species: 'fox', likes: 'fruit', color: '#d9873c', home: 'house-rodri', lines: ['Fruit off the tree beats anything from a shop.', 'Heard a rumour there’s a beetle worth two thousand raisins. Don’t tell Tato.', 'The bridge creaks. I like to think it’s saying hello.'], story: 'Right. The bridge. I told you it creaks a hello, and that’s because I built it — badly, twenty years ago, before there was a street here at all. Everyone else had moved on to the coast. I stayed because I liked the trees. Took this long for someone to make staying feel clever instead of stubborn. Take this photo of me, and don’t you dare sell it to Vito.' },
  { id: 'vivi', name: 'Vivi', species: 'viscacha', likes: 'flower', color: '#b7a58c', home: 'house-vivi', lines: ['We viscachas are basically cousins. Long-lost, fluffy cousins.', 'A watered flower is a promise to tomorrow.', 'Sunbathing counts as exercise if you mean it.'], story: 'Long-lost fluffy cousins, I always say. Here’s the part I leave out: I came to the hollow the winter after my burrow collapsed, with a pot of red seeds and nothing else. Every flower on this hillside came out of that pot, and half of them came out of it because you carried the watering can. That’s a lot of promises to tomorrow. Have a photo of me for the wall.' },
  { id: 'tato', name: 'Tato', species: 'condor', likes: 'bug', color: '#4a4750', home: 'house-tato', lines: ['From up high the whole hollow looks like a quilt.', 'Bugs are just very small birds. Don’t look that up.', 'The museum owl owes me a favour. Long story.'], story: 'From up high the hollow looks like a quilt, I said. What I never said is that I used to just pass over it. Condors don’t settle. I circled this valley for three years before I put a house on the ridge, and I still don’t entirely know why, except that someone down here kept waving. Take this photo. Hang it where you can see the sky from.' },
  { id: 'lupe', name: 'Lupe', species: 'llama', likes: 'fruit', color: '#e8dcc2', home: 'house-lupe', lines: ['I heard the hollow was getting lively, so here I am.', 'Nothing beats a pear. Nothing. I have thought about this.', 'I hum when I walk. Sorry in advance.'], arrives: 4, story: 'I hum when I walk, and now you know what I’m humming: a song my grandmother sang on the salt road, walking cargo over the pass. I came here because the hollow was getting lively, and I stayed because being somewhere lively is not the same as being somewhere wanted. You managed both. This photo is of me mid-hum, which is the only honest kind.' },
  { id: 'nico', name: 'Nico', species: 'cat', likes: 'fish', color: '#8a7f73', home: 'house-nico', lines: ['An Andean cat, yes. Rare. Please don’t make it weird.', 'The river at dawn is the best restaurant in town.', 'I nap on the museum steps. Bubo pretends not to see.'], arrives: 8, story: 'An Andean cat, yes, rare, don’t make it weird — and the reason I say that first is so nobody gets to say it before me. There were fewer than a hundred of us in these mountains when I was born. I nap on the museum steps because Bubo keeps a case ready for my kind and I like that it stays empty. You never once made it weird. Keep this photo of me.' },
];
/** Day of the 16-day year each villager celebrates. */
export const BIRTHDAYS: Record<string, number> = { pia: 2, lupe: 4, friend: 5, rodri: 6, vivi: 10, nico: 12, tato: 14 };
/** Each villager's schedule: mornings 7–12, afternoons 12–17, evenings 17–22. They wander within a few tiles of the spot. */
export const HAUNTS: Record<string, Record<Period, Haunt>> = {
  friend: { morning: { x: 9, y: 10, name: 'outside Burrow Works' }, afternoon: { x: 6, y: 12, name: 'on the street' }, evening: { x: 9, y: 10, name: 'outside Burrow Works' } },
  pia: { morning: { x: 28, y: 10, name: 'outside her house' }, afternoon: { x: 10, y: 20, name: 'by the sea' }, evening: { x: 15, y: 10, name: 'outside Vito’s' } },
  rodri: { morning: { x: 5, y: 17, name: 'outside his house' }, afternoon: { x: 3, y: 4, name: 'in the north-west orchard' }, evening: { x: 20, y: 18, name: 'on the lower bridge' } },
  vivi: { morning: { x: 11, y: 17, name: 'outside her house' }, afternoon: { x: 12, y: 3, name: 'in the flower meadow by the pond' }, evening: { x: 11, y: 12, name: 'on the street' } },
  tato: { morning: { x: 26, y: 17, name: 'outside his house' }, afternoon: { x: 24, y: 2, name: 'on the north cliff path' }, evening: { x: 24, y: 10, name: 'on the museum steps' } },
  lupe: { morning: { x: 14, y: 20, name: 'outside her house' }, afternoon: { x: 15, y: 10, name: 'outside Vito’s' }, evening: { x: 14, y: 20, name: 'outside her house' } },
  nico: { morning: { x: 16, y: 4, name: 'on the river bank' }, afternoon: { x: 24, y: 10, name: 'on the museum steps' }, evening: { x: 22, y: 17, name: 'outside his house' } },
};
const FRIEND_LINES = ['Morning! Did you see the mist on the river?', 'Bring me anything you find, I want to see it all.', 'The hollow feels more like home every day you’re here.', 'Pay the loan when you can. No rush. Well, a little rush.'];

/** The closing ceremony, once the list is done, the museum is full and everyone is a Best friend. */
export const CEREMONY_LINES = [
  'Lanterns come up the street one by one. The whole hollow is walking your way.',
  'Bubo: Hoo. Forty-one cases, and not one of them empty. I have nothing left to catalogue, and I could not be happier about it.',
  'Vito: I have sold you a shovel, a watering can, a trowel and most of a house. Tonight everything is on the house. Do not get used to it.',
  'Pia: When I got here the street was quiet by seven. Listen to it now.',
  'Tato: From up high tonight, the hollow is all lit windows. Every one of them is someone you know.',
  'The lanterns go up over the sea. Nobody says anything for a while, and nobody needs to.',
];
export const GOALS: Goal[] = [
  { id: 'fish', text: 'Catch a fish', reward: 200, test: (g) => g.stats.fish > 0 },
  { id: 'bug', text: 'Catch a bug', reward: 200, test: (g) => g.stats.bugs > 0 },
  { id: 'shake', text: 'Shake fruit from a tree', reward: 100, test: (g) => g.stats.fruit > 0 },
  { id: 'talk', text: 'Meet all four neighbours', reward: 300, test: (g) => NEIGHBOURS.filter((v) => !v.arrives).every((v) => g.friendship[v.id] > 0) },
  { id: 'donate', text: 'Donate three finds to the museum', reward: 500, test: (g) => g.donated.length >= 3 },
  { id: 'loan', text: 'Pay off the tent loan', reward: 1000, test: (g) => g.homeLevel >= 1 },
  { id: 'fossil', text: 'Have a fossil assessed', reward: 500, test: (g) => g.stats.fossils > 0 },
  { id: 'hybrid', text: 'Grow a hybrid flower', reward: 800, test: (g) => g.stats.hybrids > 0 },
  { id: 'friend', text: 'Become a Friend to a neighbour', reward: 800, test: (g) => NEIGHBOURS.some((v) => g.friendship[v.id] >= 5) },
  { id: 'museum', text: 'Fill half the museum', reward: 2000, test: (g) => g.donated.length * 2 >= FISH.length + BUGS.length + FOSSILS.length },
  { id: 'grand', text: 'Move into a Grand Burrow', reward: 5000, test: (g) => g.homeLevel >= 3 },
];

export type Save = {
  v: 2 | 3; hero: Hero; seed: number; rs: number; day: number; clock: number; x: number; y: number; facing: Facing;
  raisins: number; debt: number; homeLevel: number; tools: Tool[]; tool: Tool; pockets: Item[]; furniture: Placed[];
  donated: string[]; friendship: Record<string, number>; talked: string[]; requests: Request[]; goals: string[]; gifts: Record<string, string[]>;
  trees: Tree[]; flowers: Flower[]; rocks: Rock[]; fossils: Spot[]; shells: Shell[]; snowballs: Spot[]; snowmen: Spot[];
  stats: Hollow['stats']; caught: string[]; today: { fish: number; bugs: number }; wished: boolean; live: boolean; liveKey: string; arrived: string[];
  wingsDone?: string[]; setsDone?: string[]; sunny?: number; balloonDone?: boolean; visits?: string[]; log?: Hollow['log']; keepsakes?: string[]; jackpotTaken?: boolean; escort?: boolean;
  edits?: Record<string, Terrain>; outdoor?: Placed[]; ended?: boolean;
};
export type SaveV1 = Omit<Save, 'v' | 'furniture'> & { v: 1; furniture: string[] };

export function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const BUILDINGS: Building[] = [
  { id: 'home', name: 'Your burrow', x: 3, y: 7, w: 3, h: 2, door: [4, 9] },
  { id: 'friend', name: 'Burrow Works', x: 8, y: 7, w: 3, h: 2, door: [9, 9] },
  { id: 'shop', name: 'Vito’s Emporium', x: 13, y: 6, w: 4, h: 3, door: [14, 9] },
  { id: 'museum', name: 'Hollow Museum', x: 21, y: 6, w: 5, h: 3, door: [23, 9] },
  { id: 'house-pia', name: 'Pia’s house', x: 27, y: 7, w: 3, h: 2, door: [28, 9] },
  { id: 'house-rodri', name: 'Rodri’s house', x: 4, y: 14, w: 3, h: 2, door: [5, 16] },
  { id: 'house-vivi', name: 'Vivi’s house', x: 10, y: 14, w: 3, h: 2, door: [11, 16] },
  { id: 'house-lupe', name: 'Lupe’s house', x: 13, y: 17, w: 3, h: 2, door: [14, 19] },
  { id: 'house-nico', name: 'Nico’s house', x: 21, y: 14, w: 3, h: 2, door: [22, 16] },
  { id: 'house-tato', name: 'Tato’s house', x: 25, y: 14, w: 3, h: 2, door: [26, 16] },
];
export const BOARD: Spot = { x: 12, y: 10 };
export const STREET_Y = 11;
export const RIVER_X = 18;
export const POND = { x: 6, y: 2, w: 4, h: 3 };

/** The fixed village map. Terrain never changes, so it is rebuilt rather than saved. */
export function makeTerrain(): Terrain[] {
  const t: Terrain[] = Array.from({ length: W * H }, () => 'grass' as Terrain);
  const set = (x: number, y: number, v: Terrain) => { if (x >= 0 && y >= 0 && x < W && y < H) t[y * W + x] = v; };
  for (let x = 0; x < W; x++) { set(x, 0, 'cliff'); set(x, H - 1, 'water'); set(x, H - 2, 'water'); set(x, H - 3, 'water'); set(x, H - 4, 'sand'); }
  for (let y = 0; y < H; y++) { set(0, y, 'cliff'); set(W - 1, y, 'cliff'); }
  for (let y = 1; y < H - 3; y++) { const wob = y > 12 ? 1 : 0; set(RIVER_X + wob, y, 'water'); set(RIVER_X + 1 + wob, y, 'water'); }
  for (let y = POND.y; y < POND.y + POND.h; y++) for (let x = POND.x; x < POND.x + POND.w; x++) set(x, y, 'water');
  for (let x = 1; x < W - 1; x++) set(x, STREET_Y, t[STREET_Y * W + x] === 'water' ? 'bridge' : 'path');
  set(RIVER_X + 1, 18, 'bridge'); set(RIVER_X + 2, 18, 'bridge');
  for (const b of BUILDINGS) { const [dx, dy] = b.door; for (let y = dy; y < STREET_Y; y++) set(dx, y, 'path'); for (let y = STREET_Y + 1; y <= dy; y++) set(dx, y, 'path'); }
  for (let y = STREET_Y; y < H - 4; y++) set(16, y, 'path');
  for (let x = 14; x <= 16; x++) set(x, 19, 'path');
  return t;
}

export class Hollow {
  hero: Hero;
  seed: number;
  rs: number;
  terrain = makeTerrain();
  day = 1;
  clock = (8 / 24) * DAY;
  x = 4.5;
  y = 10.5;
  facing: Facing = 2;
  moving = false;
  running = false;
  sneaking = false;
  raisins = 0;
  debt = LOANS[0];
  homeLevel = 0;
  tools: Tool[] = ['hands', 'net', 'rod'];
  tool: Tool = 'hands';
  pockets: Item[] = [];
  selected = -1;
  furniture: Placed[] = [];
  donated: string[] = [];
  caught: string[] = [];
  friendship: Record<string, number> = {};
  gifts: Record<string, string[]> = {};
  talked: string[] = [];
  requests: Request[] = [];
  goals: string[] = [];
  arrived: string[] = [];
  trees: Tree[] = [];
  flowers: Flower[] = [];
  rocks: Rock[] = [];
  fossils: Spot[] = [];
  shells: Shell[] = [];
  snowballs: Spot[] = [];
  snowmen: Spot[] = [];
  bugs: Bug[] = [];
  villagers: Villager[] = [];
  effects: Effect[] = [];
  reaction: { icon: string; age: number } | null = null;
  stats = { fish: 0, bugs: 0, fossils: 0, fruit: 0, hybrids: 0, sold: 0, days: 1, festivals: 0, wishes: 0, snowmen: 0, balloons: 0, visits: 0, keepsakes: 0, paved: 0, ending: 0 };
  today = { fish: 0, bugs: 0 };
  /** Today's tally for the bedtime summary. */
  log: { fish: number; bugs: number; fruit: number; fossils: number; shells: number; earned: number; hearts: number; best: { name: string; price: number } | null } = { fish: 0, bugs: 0, fruit: 0, fossils: 0, shells: 0, earned: 0, hearts: 0, best: null };
  /** Last night's summary, shown until dismissed. */
  summary: Summary | null = null;
  /** Season title card: text and seconds left. */
  splash: { text: string; age: number } | null = null;
  wished = false;
  /** A day the sky is forced clear by a wish; 0 when none. */
  sunny = 0;
  wingsDone: string[] = [];
  setsDone: string[] = [];
  /** Neighbours who have handed over their Best-friend keepsake. */
  keepsakes: string[] = [];
  /** Set once the day's jackpot has been landed; it shows itself only the once. */
  jackpotTaken = false;
  /** Whether the other chinchilla walks with you. Off, they keep their own schedule like any neighbour. */
  escort = true;
  /** Tiles the player has paved or lifted, keyed "x,y". The rest of the map is fixed. */
  edits: Record<string, Terrain> = {};
  /** Furniture standing out in the hollow rather than in the burrow. */
  outdoor: Placed[] = [];
  /** The closing ceremony while it plays, then `ended` for good. */
  ceremony: { t: number; line: number } | null = null;
  ended = false;
  /** Neighbours who dropped by the burrow today. */
  visits: string[] = [];
  visitor: { id: string; name: string; line: string } | null = null;
  balloon: Balloon | null = null;
  balloonDone = false;
  /** Consecutive snapped lines, for the friend's advice. */
  snaps = 0;
  /** Live mode follows the real clock and calendar instead of six-minute days. */
  live = false;
  liveKey = '';
  liveSeason: Season | null = null;
  screen: Screen = 'world';
  dialog: Dialog | null = null;
  message = '';
  messageAge = 0;
  fishing: Fishing | null = null;
  bugTimer = 0;
  /** Seconds a shooting star stays visible; 0 when the sky is quiet. */
  star = 0;
  starTimer = 0;
  /** Set by the engine for the page to play a sound: catch, miss, coin, talk, dig, shake, ... */
  event = '';

  constructor(hero: Hero = 'dora', seed = 7) {
    this.hero = hero;
    this.seed = seed;
    this.rs = seed;
    for (const v of NEIGHBOURS) this.friendship[v.id] = 0;
    this.friendship.friend = 0;
    this.plantWorld();
    this.spawnVillagers();
    this.newDayContent();
  }

  rng() { const r = mulberry(this.rs); const v = r(); this.rs = (this.rs + 0x6d2b79f5) >>> 0; return v; }
  pick<T>(list: T[]): T { return list[Math.floor(this.rng() * list.length)]; }
  /** A per-day hash in [0, 1) that never touches the RNG stream. */
  dayHash(salt: number) { return mulberry(this.seed * 131 + this.day * 7 + salt)(); }

  get friendName() { return HERO_NAMES[this.hero === 'dora' ? 'enzo' : 'dora']; }
  get heroName() { return HERO_NAMES[this.hero]; }
  get hour() { return (this.clock / DAY) * 24; }
  get season(): Season { return this.liveSeason ?? SEASONS[Math.floor((this.day - 1) / DAYS_PER_SEASON) % 4]; }
  get dayOfSeason() { return (this.day - 1) % DAYS_PER_SEASON; }
  get dayOfYear() { return ((this.day - 1) % YEAR) + 1; }
  get year() { return Math.floor((this.day - 1) / YEAR) + 1; }
  get isNight() { return this.hour < 6 || this.hour >= 19; }
  get weather(): Weather { return this.weatherOn(this.day); }
  /** The sky on any day: about 28% rainy, snow in winter, unless a wish cleared it. */
  weatherOn(day: number): Weather {
    if (day === this.sunny) return 'clear';
    const season = this.liveSeason ?? SEASONS[Math.floor((day - 1) / DAYS_PER_SEASON) % 4];
    const h = mulberry(this.seed * 131 + day)();
    return h < 0.28 ? (season === 'winter' ? 'snow' : 'rain') : 'clear';
  }
  get forecast(): Weather { return this.weatherOn(this.day + 1); }
  /** One day a season, never the festival day, Vito pins fruit at 150% and halves one piece of furniture. */
  saleDayOf(day: number) {
    const seasonIndex = Math.floor((day - 1) / DAYS_PER_SEASON);
    const pickDay = Math.floor(mulberry(this.seed * 977 + seasonIndex * 31)() * (DAYS_PER_SEASON - 1));
    return (day - 1) % DAYS_PER_SEASON === pickDay;
  }
  get isSale() { return this.saleDayOf(this.day); }
  /** The piece Vito has marked down today; null when it is not a sale day. */
  get saleItem(): Furniture | null { return this.isSale ? this.stock[Math.floor(this.dayHash(5) * 3)] ?? null : null; }
  /** Vito's price for a piece of furniture today. */
  priceOf(f: Furniture) { return this.saleItem?.id === f.id ? Math.floor(f.price / 2) : f.price; }
  /** Current part of the day for villager schedules. */
  get period(): Period { return this.hour < 12 ? 'morning' : this.hour < 17 ? 'afternoon' : 'evening'; }
  haunt(id: string, period: Period = this.period): Haunt { return HAUNTS[id]?.[period] ?? HAUNTS.friend[period]; }
  /** Where to find a resident right now, or where they will be this afternoon. */
  whereabouts(id: string, period?: Period) { return this.haunt(id, period).name; }
  /** Vito's score for the room: placed furniture value plus a bonus for every set of three or more. */
  get roomScore() {
    const value = [...this.furniture, ...this.outdoor].reduce((sum, p) => sum + (FURNITURE.find((f) => f.id === p.id)?.price ?? 0), 0);
    return Math.round(value / 4) + this.completeSets.length * 1000 + this.stats.paved * 15;
  }
  get homeRating() { return HOME_RATINGS.find(([max]) => this.roomScore < max)![1]; }
  /** Sets with three or more pieces standing in the room. */
  get completeSets(): FurnitureSet[] { return SETS.filter((set) => this.setCount(set) >= 3); }
  setCount(set: FurnitureSet) { return this.furniture.filter((p) => FURNITURE.find((f) => f.id === p.id)?.set === set).length; }
  /** Museum wings the hero has completed. */
  wingDone(w: Wing) { return w.list.every((sp) => this.donated.includes(sp.id)); }
  /** '' normally, a warning when three or fewer pockets are free. */
  get pocketWarning() { return this.full ? 'Pockets full' : this.pockets.length >= POCKETS - 3 ? `Pockets nearly full (${POCKETS - this.pockets.length} free)` : ''; }
  get shopOpen() { return this.hour >= SHOP_OPEN && this.hour < SHOP_CLOSE; }
  get museumTotal() { return FISH.length + BUGS.length + FOSSILS.length; }
  get homeName() { return HOME_NAMES[this.homeLevel]; }
  /** The burrow belongs to both of them, whoever is being steered. */
  get houseName() { return `${HERO_NAMES.dora} and ${HERO_NAMES.enzo}’s ${this.homeName}`; }
  get roomSize() { return HOME_GRID[this.homeLevel]; }
  get clockText() { const h = Math.floor(this.hour), m = Math.floor((this.hour - h) * 60); return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`; }
  /** Vito's fruit price multiplier for the day, 0.7 to 1.5 in steps of 0.05. */
  get fruitRate() { return this.isSale ? 1.5 : Math.round((0.7 + this.dayHash(3) * 0.8) * 20) / 20; }
  get festival(): Festival {
    if (this.dayOfSeason !== DAYS_PER_SEASON - 1) return null;
    return this.season === 'summer' ? 'bugoff' : this.season === 'winter' ? 'snowday' : 'tourney';
  }
  get villagersOut() { return this.hour >= WAKE && this.hour < BEDTIME; }
  /** Villagers who currently live in the hollow; late arrivals move in as goals are met. */
  get residents() { return this.villagers.filter((v) => !v.arrives || this.arrived.includes(v.id)); }
  isBirthday(id: string) { return BIRTHDAYS[id] === this.dayOfYear; }
  /** The other chinchilla: the one you are not currently steering. */
  get companion() { return this.villagers.find((v) => v.id === 'friend') ?? null; }
  /** Hand control to the other chinchilla; they trade places. */
  swap(): string {
    const c = this.companion;
    if (!c) return '';
    const [hx, hy, hf] = [this.x, this.y, this.facing];
    this.hero = this.hero === 'dora' ? 'enzo' : 'dora';
    this.x = c.x; this.y = c.y; this.facing = c.facing;
    c.x = c.tx = hx; c.y = c.ty = hy; c.facing = hf;
    c.name = this.friendName;
    c.species = this.hero === 'dora' ? 'enzo' : 'dora';
    c.color = this.hero === 'dora' ? '#8e8f98' : '#f2ede4';
    this.fishing = null;
    this.event = 'swap';
    return this.tell(`${this.heroName} takes the lead. ${this.friendName} falls in behind.`);
  }
  /** Sale value at Vito's, with the day's fruit market applied. */
  valueOf(item: Item) { return item.kind === 'fruit' ? Math.round(item.price * this.fruitRate) : item.price; }

  tileAt(x: number, y: number): Terrain {
    if (x < 0 || y < 0 || x >= W || y >= H) return 'cliff';
    return this.edits[`${x},${y}`] ?? this.terrain[y * W + x];
  }
  /** The map as it was laid out, ignoring anything the player has paved. */
  originalAt(x: number, y: number): Terrain { return x < 0 || y < 0 || x >= W || y >= H ? 'cliff' : this.terrain[y * W + x]; }
  outdoorAt(x: number, y: number) { return this.outdoor.find((p) => p.x === x && p.y === y); }
  /** Grass the player may pave: anything clear, including right up to their own door. */
  pavable(x: number, y: number) {
    return this.tileAt(x, y) === 'grass' && !this.solid(x, y) && !this.flowerAt(x, y) && !this.fossilAt(x, y) && !this.snowballAt(x, y) && !this.doorAt(x, y);
  }
  /** Paving the player laid, which is the only paving they can lift again. */
  paved(x: number, y: number) { return this.edits[`${x},${y}`] === 'path' && this.originalAt(x, y) === 'grass'; }
  buildingAt(x: number, y: number) { return BUILDINGS.find((b) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h); }
  treeAt(x: number, y: number) { return this.trees.find((t) => t.x === x && t.y === y); }
  rockAt(x: number, y: number) { return this.rocks.find((r) => r.x === x && r.y === y); }
  flowerAt(x: number, y: number) { return this.flowers.find((f) => f.x === x && f.y === y); }
  fossilAt(x: number, y: number) { return this.fossils.find((f) => f.x === x && f.y === y); }
  shellAt(x: number, y: number) { return this.shells.find((f) => f.x === x && f.y === y); }
  snowballAt(x: number, y: number) { return this.snowballs.find((f) => f.x === x && f.y === y); }
  snowmanAt(x: number, y: number) { return this.snowmen.find((f) => f.x === x && f.y === y); }
  doorAt(x: number, y: number) { return BUILDINGS.find((b) => b.door[0] === x && b.door[1] === y); }
  isBoard(x: number, y: number) { return BOARD.x === x && BOARD.y === y; }
  /** Anything a walker cannot stand on. */
  solid(x: number, y: number) {
    const t = this.tileAt(x, y);
    return t === 'cliff' || t === 'water' || !!this.buildingAt(x, y) || !!this.treeAt(x, y) || !!this.rockAt(x, y) || this.isBoard(x, y) || !!this.snowmanAt(x, y) || !!this.outdoorAt(x, y);
  }
  /** Plain grass with nothing standing on it. */
  freeGrass(x: number, y: number) {
    return this.tileAt(x, y) === 'grass' && !this.solid(x, y) && !this.flowerAt(x, y) && !this.fossilAt(x, y) && !this.snowballAt(x, y) && !this.doorAt(x, y) && !BUILDINGS.some((b) => Math.abs(b.door[0] - x) <= 1 && Math.abs(b.door[1] - y) <= 1) && Math.abs(y - STREET_Y) > 1;
  }
  habitatOf(x: number, y: number): Habitat | null {
    if (this.tileAt(x, y) !== 'water') return null;
    if (y >= H - 3) return 'sea';
    if (x >= POND.x && x < POND.x + POND.w && y >= POND.y && y < POND.y + POND.h) return 'pond';
    return 'river';
  }
  facingTile(): [number, number] { const [dx, dy] = FACE[this.facing]; return [Math.floor(this.x + dx * 0.9), Math.floor(this.y + dy * 0.9)]; }

  private plantWorld() {
    const r = mulberry(this.seed);
    const tryPlace = (ok: (x: number, y: number) => boolean, place: (x: number, y: number) => void, n: number) => {
      for (let placed = 0, tries = 0; placed < n && tries < 4000; tries++) {
        const x = 1 + Math.floor(r() * (W - 2)), y = 1 + Math.floor(r() * (H - 5));
        if (ok(x, y)) { place(x, y); placed++; }
      }
    };
    tryPlace((x, y) => this.freeGrass(x, y) && !this.treeAt(x, y) && !this.treeAt(x + 1, y) && !this.treeAt(x - 1, y) && !this.treeAt(x, y + 1) && !this.treeAt(x, y - 1),
      (x, y) => this.trees.push({ x, y, fruit: NATIVE_FRUIT, count: 3, grown: 0 }), 22);
    tryPlace((x, y) => this.freeGrass(x, y), (x, y) => this.rocks.push({ x, y, hits: 0 }), 4);
    tryPlace((x, y) => this.freeGrass(x, y), (x, y) => this.flowers.push({ x, y, color: BASE_COLORS[Math.floor(r() * 3)], watered: false }), 14);
  }
  private spawnVillagers() {
    const friend: VillagerDef = { id: 'friend', name: this.friendName, species: this.hero === 'dora' ? 'enzo' : 'dora', likes: 'fruit', color: this.hero === 'dora' ? '#8e8f98' : '#f2ede4', home: 'friend', lines: FRIEND_LINES };
    this.villagers = [friend, ...NEIGHBOURS].map((v) => {
      const b = BUILDINGS.find((b) => b.id === v.home)!;
      const y = b.door[1] === 19 ? 19 : STREET_Y;
      return { ...v, x: b.door[0] + 0.5, y: y + 0.5, tx: b.door[0] + 0.5, ty: y + 0.5, wait: 1, facing: 2 as Facing };
    });
    // The two chinchillas moved in together, so the companion starts at your shoulder.
    const c = this.companion!;
    c.x = c.tx = this.x - 1; c.y = c.ty = this.y;
  }

  // ---- time -------------------------------------------------------------
  step(dt: number, input: { dx: number; dy: number; run: boolean; hold?: boolean; sneak?: boolean } = { dx: 0, dy: 0, run: false }) {
    if (this.messageAge > 0) { this.messageAge -= dt; if (this.messageAge <= 0) this.message = ''; }
    if (this.splash) { this.splash.age -= dt; if (this.splash.age <= 0) this.splash = null; }
    for (const e of this.effects) e.age += dt;
    this.effects = this.effects.filter((e) => e.age < 0.9);
    if (this.reaction) { this.reaction.age += dt; if (this.reaction.age > 1.2) this.reaction = null; }
    if (!this.live) {
      this.clock += dt;
      if (this.clock >= DAY) { this.clock -= DAY; this.newDay(); }
    }
    this.checkGoals();
    if (this.screen !== 'world') return;
    if (this.ceremony) this.runCeremony(dt);
    else if (!this.ended && !this.dialog && this.finaleReady && this.hour >= 18 && this.hour < 21) this.startCeremony();
    this.moving = !!(input.dx || input.dy) && !this.dialog;
    this.sneaking = !!input.sneak && !this.dialog;
    this.running = input.run && this.moving && !this.sneaking;
    if (!this.dialog) this.moveVillagers(dt);
    this.moveBugs(dt);
    this.sky(dt);
    this.driftBalloon(dt);
    if (this.fishing) this.fishTick(dt, !!input.hold, !!(input.dx || input.dy));
    if (!this.moving) return;
    const len = Math.hypot(input.dx, input.dy) || 1;
    const sp = (this.sneaking ? SNEAK : input.run ? RUN : WALK) * dt;
    if (Math.abs(input.dx) >= Math.abs(input.dy)) this.facing = input.dx > 0 ? 1 : 3; else this.facing = input.dy > 0 ? 2 : 0;
    this.tryMove((input.dx / len) * sp, 0);
    this.tryMove(0, (input.dy / len) * sp);
  }
  private tryMove(dx: number, dy: number) {
    const nx = this.x + dx, ny = this.y + dy, r = 0.3;
    const blocked = [[-r, -r], [r, -r], [-r, r], [r, r]].some(([ox, oy]) => this.solid(Math.floor(nx + ox), Math.floor(ny + oy)));
    if (!blocked) { this.x = nx; this.y = ny; }
  }
  /** Follow the real clock: called by the page every frame in live mode. */
  syncLive(now: Date) {
    this.live = true;
    this.clock = ((now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()) / 86400) * DAY;
    const m = now.getMonth();
    // Southern-hemisphere seasons: the hollow sits in the Andes.
    this.liveSeason = m >= 11 || m <= 1 ? 'summer' : m <= 4 ? 'autumn' : m <= 7 ? 'winter' : 'spring';
    const key = `${now.getFullYear()}-${m}-${now.getDate()}`;
    if (this.liveKey && this.liveKey !== key) this.newDay();
    this.liveKey = key;
  }
  setLive(on: boolean, now?: Date) {
    if (on) { this.syncLive(now ?? new Date()); return; }
    this.live = false;
    this.liveSeason = null;
    this.liveKey = '';
  }
  /** Skip straight to the next morning. Only possible from inside the burrow, and never in live mode. */
  sleep() {
    if (this.screen !== 'home' || this.live) return false;
    this.message = '';
    this.newDay();
    this.clock = (WAKE / 24) * DAY;
    const news = this.message;
    this.say(`A new day in Dusty Hollow. ${this.weather === 'clear' ? 'The sky is clear.' : this.weather === 'rain' ? 'It’s raining.' : 'Snow is falling.'}${news ? ` ${news}` : ''}`);
    return true;
  }
  private newDay() {
    const results = this.settleFestival();
    this.summary = this.summarise();
    const seasonWas = this.season;
    this.day++;
    this.stats.days++;
    this.talked = [];
    this.visits = [];
    this.visitor = null;
    this.bugs = [];
    this.balloon = null;
    this.balloonDone = false;
    this.fishing = null;
    this.snaps = 0;
    this.jackpotTaken = false;
    this.today = { fish: 0, bugs: 0 };
    this.log = { fish: 0, bugs: 0, fruit: 0, fossils: 0, shells: 0, earned: 0, hearts: 0, best: null };
    if (this.season !== seasonWas) { const name = this.season[0].toUpperCase() + this.season.slice(1); this.splash = { text: `${name} in Dusty Hollow`, age: 4 }; this.event = 'season'; }
    for (const t of this.trees) { if (t.grown && this.day >= t.grown) { t.grown = 0; if (t.golden) this.say(`The ${t.fruit} sapling grew in overnight, and its leaves shine gold!`); } if (!t.grown) t.count = 3; }
    for (const r of this.rocks) r.hits = 0;
    this.breedFlowers();
    this.snowmen = [];
    this.newDayContent();
    if (this.wished) { this.wished = false; this.stats.wishes++; this.say(this.grantWish()); }
    if (results) this.say(results);
  }
  /** What a wish leaves by the door: raisins, fruit, furniture, a cheerful hollow or a clear sky. */
  private grantWish(): string {
    const roll = this.rng();
    const foreign = FRUIT.filter((f) => f !== NATIVE_FRUIT);
    const unowned = FURNITURE.filter((f) => f.shop && !this.furniture.some((p) => p.id === f.id) && !this.pockets.some((p) => p.kind === 'furniture' && p.id === f.id));
    if (roll < 0.12 && unowned.length && !this.full) { const f = this.pick(unowned); this.pockets.push(this.itemFor('furniture', f.id)); return `A star fragment lay by your door, and inside it, somehow, a ${f.name.toLowerCase()}.`; }
    if (roll < 0.22) { for (const v of this.residents) this.befriend(v.id, 1); return 'The whole hollow woke up cheerful. Everyone likes you a little more today.'; }
    if (roll < 0.3) { this.sunny = this.weatherOn(this.day) === 'clear' ? this.day + 1 : this.day; return `Your wish swept the clouds away: ${this.sunny === this.day ? 'today' : 'tomorrow'} will be clear.`; }
    if (roll < 0.55 && !this.full) { const f = this.pick(foreign); this.pockets.push(this.itemFor('fruit', f)); return `A star fragment lay by your door with ${f === 'orange' ? 'an' : 'a'} ${f} inside.`; }
    this.earn(WISH_PRIZE);
    return `Your wish came true: ${WISH_PRIZE} raisins by the door.`;
  }
  /** The bedtime card for the day just ended. */
  private summarise(): Summary {
    const l = this.log, lines: string[] = [];
    const n = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;
    if (l.fish || l.bugs) lines.push(`Caught ${[l.fish ? n(l.fish, 'fish', 'fish') : '', l.bugs ? n(l.bugs, 'bug') : ''].filter(Boolean).join(' and ')}.`);
    if (l.fruit || l.shells) lines.push(`Gathered ${[l.fruit ? n(l.fruit, 'fruit', 'fruit') : '', l.shells ? n(l.shells, 'shell') : ''].filter(Boolean).join(' and ')}.`);
    if (l.fossils) lines.push(`Dug up ${n(l.fossils, 'fossil')}.`);
    if (l.best) lines.push(`Best find: ${/^[AEIOU]/.test(l.best.name) ? 'an' : 'a'} ${l.best.name}, worth ${l.best.price.toLocaleString()}.`);
    if (l.earned) lines.push(`Earned ${l.earned.toLocaleString()} raisins.`);
    if (l.hearts) lines.push(`Friendship grew by ${n(l.hearts, 'heart')}.`);
    if (!lines.length) lines.push('A quiet day. Those count too.');
    return { day: this.day, lines };
  }
  /** Raisins that came in today, for the summary. */
  earn(n: number) { this.raisins += n; this.log.earned += n; }
  /** Remember the day's most valuable find for the bedtime card. */
  private note(item: Item) { const price = this.valueOf(item); if (!this.log.best || price > this.log.best.price) this.log.best = { name: item.name, price }; }
  /** Raise friendship, capped, and count the hearts gained today. */
  befriend(id: string, n: number) {
    const was = this.friendship[id] ?? 0;
    this.friendship[id] = Math.min(FRIEND_MAX, was + n);
    this.log.hearts += this.friendship[id] - was;
  }
  private newDayContent() {
    this.fossils = [];
    this.shells = [];
    this.snowballs = [];
    for (let i = 0, tries = 0; i < FOSSILS_PER_DAY && tries < 500; tries++) {
      const x = 1 + Math.floor(this.rng() * (W - 2)), y = 1 + Math.floor(this.rng() * (H - 5));
      if (this.freeGrass(x, y)) { this.fossils.push({ x, y }); i++; }
    }
    for (let i = 0, tries = 0; i < SHELLS_PER_DAY && tries < 200; tries++) {
      const x = 1 + Math.floor(this.rng() * (W - 2)), y = H - 4;
      if (this.tileAt(x, y) === 'sand' && !this.shellAt(x, y) && x !== 16) { this.shells.push({ x, y, id: this.weightedId(SHELLS) }); i++; }
    }
    if (this.festival === 'snowday') {
      for (let i = 0, tries = 0; i < SNOWBALLS && tries < 500; tries++) {
        const x = 1 + Math.floor(this.rng() * (W - 2)), y = 1 + Math.floor(this.rng() * (H - 5));
        if (this.freeGrass(x, y)) { this.snowballs.push({ x, y }); i++; }
      }
    }
    this.requests = this.residents.filter((v) => v.id !== 'friend').map((v) => ({ villager: v.id, kind: this.rng() < 0.5 ? v.likes : this.pick(['fish', 'bug', 'fruit', 'flower'] as Kind[]), done: false }));
  }
  private breedFlowers() {
    const born: Flower[] = [];
    for (const f of this.flowers) {
      if (!f.watered) continue;
      const mates = this.flowers.filter((o) => o !== f && o.watered && Math.abs(o.x - f.x) + Math.abs(o.y - f.y) === 1);
      for (const m of mates) {
        if (this.rng() > 0.45) continue;
        const spots = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [f.x + dx, f.y + dy]).filter(([x, y]) => this.freeGrass(x, y) && !born.some((b) => b.x === x && b.y === y));
        if (!spots.length) continue;
        const [x, y] = this.pick(spots);
        const key = [f.color, m.color].sort().join('+');
        const hybrid = HYBRIDS[key];
        const color: FlowerColor = hybrid && this.rng() < 0.5 ? hybrid : this.rng() < 0.5 ? f.color : m.color;
        born.push({ x, y, color, watered: false });
        if (!BASE_COLORS.includes(color)) this.stats.hybrids++;
        break;
      }
    }
    for (const f of this.flowers) f.watered = false;
    this.flowers.push(...born);
  }
  /** On about 40% of clear days a balloon crosses the hollow in the early afternoon, carrying a present. */
  private driftBalloon(dt: number) {
    if (this.balloon) {
      this.balloon.x += this.balloon.speed * dt;
      if (this.balloon.x > W + 1) { this.balloon = null; this.balloonDone = true; }
      return;
    }
    if (this.balloonDone || this.weather !== 'clear' || !this.balloonDay) return;
    if (this.hour >= this.balloonHour && this.hour < 17) this.balloon = { x: -1, y: 3 + Math.floor(this.dayHash(32) * (H - 9)), speed: 0.55 };
  }
  get balloonDay() { return this.dayHash(30) < 0.4; }
  get balloonHour() { return 13 + this.dayHash(31) * 2; }
  /** Whether the balloon is close enough overhead to hit with a thrown fruit or shell. */
  get balloonInReach() { return !!this.balloon && Math.hypot(this.balloon.x - this.x, this.balloon.y - this.y) < 2.4; }
  private sky(dt: number) {
    if (this.star > 0) { this.star -= dt; return; }
    if (this.season !== 'summer' || this.weather !== 'clear' || this.hour < 20) return;
    this.starTimer -= dt;
    if (this.starTimer <= 0) { this.starTimer = 12 + this.rng() * 14; this.star = 3; this.event = 'star'; }
  }

  // ---- the ending ---------------------------------------------------------
  /** Everything on the list done, every case filled, and nobody left to befriend. */
  get finaleReady() {
    return this.goals.length >= GOALS.length && this.donated.length >= this.museumTotal && this.residents.every((v) => (this.friendship[v.id] ?? 0) >= FRIEND_MAX);
  }
  private startCeremony() {
    this.ceremony = { t: 0, line: 0 };
    this.event = 'goal';
    this.say(CEREMONY_LINES[0]);
  }
  /** Walk a villager to their place in the ring, ignoring their usual wandering. */
  private gather(v: Villager, dt: number, index: number, total: number) {
    const a = (index / Math.max(1, total)) * Math.PI * 2;
    const tx = this.x + Math.cos(a) * 2.4, ty = this.y + Math.sin(a) * 2.4;
    const dx = tx - v.x, dy = ty - v.y, d = Math.hypot(dx, dy);
    v.tx = v.x; v.ty = v.y;
    if (d < 0.25) { v.facing = (Math.abs(this.x - v.x) >= Math.abs(this.y - v.y) ? (this.x > v.x ? 1 : 3) : this.y > v.y ? 2 : 0) as Facing; return; }
    const sp = Math.min(d, 2 * dt);
    const nx = v.x + (dx / d) * sp, ny = v.y + (dy / d) * sp;
    if (!this.solid(Math.floor(nx), Math.floor(v.y))) v.x = nx;
    if (!this.solid(Math.floor(v.x), Math.floor(ny))) v.y = ny;
  }
  private runCeremony(dt: number) {
    const cer = this.ceremony!;
    cer.t += dt;
    const crowd = this.residents;
    crowd.forEach((v, i) => this.gather(v, dt, i, crowd.length));
    if (cer.t < 6) return;
    cer.t = 0;
    cer.line++;
    if (cer.line < CEREMONY_LINES.length) { this.say(CEREMONY_LINES[cer.line]); this.event = 'talk'; return; }
    this.ceremony = null;
    this.ended = true;
    this.stats.ending = this.day;
    this.event = 'goal';
    this.react('♥');
    this.say(`Day ${this.day}. The hollow is home, and it was always going to take exactly this long.`);
  }

  // ---- festivals and notices ----------------------------------------------
  /** Standings for today's tourney or bug-off; rivals climb through the day toward a fixed target. */
  get festivalBoard(): { name: string; score: number; you: boolean }[] {
    const f = this.festival;
    if (!f || f === 'snowday') return [];
    const progress = Math.max(0, Math.min(1, (this.hour - 7) / 13));
    const rows = this.residents.map((v, i) => ({ name: v.name, score: Math.floor((800 + this.dayHash(10 + i) * 3200) * progress), you: false }));
    rows.push({ name: this.heroName, score: f === 'tourney' ? this.today.fish : this.today.bugs, you: true });
    return rows.sort((a, b) => b.score - a.score);
  }
  private settleFestival(): string {
    const f = this.festival;
    if (!f || f === 'snowday') return '';
    const clockWas = this.clock;
    this.clock = DAY - 1;
    const board = this.festivalBoard;
    this.clock = clockWas;
    const place = board.findIndex((r) => r.you);
    if (!board[place].score) return '';
    this.stats.festivals++;
    const prize = FESTIVAL_PRIZES[place] ?? 0;
    this.earn(prize);
    const name = f === 'tourney' ? 'Fishing Tourney' : 'Bug-Off';
    if (place === 0 && !this.full) { this.pockets.push(this.itemFor('furniture', 'trophy')); return `You won the ${name}! ${prize} raisins and a Festival Trophy.`; }
    return place < 3 ? `${['First', 'Second', 'Third'][place]} in the ${name}: ${prize} raisins.` : `The ${name} is over. ${board[0].name} took the trophy.`;
  }
  /** Today's notice board. */
  get notices(): string[] {
    const out: string[] = [];
    const f = this.festival;
    if (f === 'tourney') out.push('Fishing Tourney today! Every fish you land counts by value until midnight. Trophy and 3,000 raisins for the top haul.');
    if (f === 'bugoff') out.push('Summer Bug-Off today! Every bug you net counts by value until midnight. Trophy and 3,000 raisins for the top score.');
    if (f === 'snowday') out.push(`Snowman Day! Three snowballs are lying about the hollow. Roll each into a snowman with bare paws for ${SNOWMAN_PRIZE} raisins.`);
    if (f) { const j = JACKPOTS[this.season]; out.push(this.jackpotTaken ? `The ${j.name} has been landed. That is the last anyone will see of it until next ${this.season}.` : `${this.caught.includes(j.id) ? `The ${j.name} is up again today` : `They say a ${j.name} shows itself today, and only today`} — one of them, ${j.habitat === 'tree' ? 'under the trees' : `in the ${j.habitat}`}, worth ${j.price.toLocaleString()} raisins to whoever lands it first.`); }
    const next = DAYS_PER_SEASON - 1 - this.dayOfSeason;
    if (next > 0) out.push(`${this.season === 'summer' ? 'Bug-Off' : this.season === 'winter' ? 'Snowman Day' : 'Fishing Tourney'} in ${next} day${next > 1 ? 's' : ''}.`);
    for (const v of this.residents) if (this.isBirthday(v.id)) out.push(`It’s ${v.name}’s birthday today! A gift will mean a lot.`);
    for (const v of this.residents) {
      const soon = (BIRTHDAYS[v.id] - this.dayOfYear + YEAR) % YEAR;
      if (soon > 0 && soon <= 2) out.push(`${v.name}’s birthday is in ${soon} day${soon > 1 ? 's' : ''}.`);
    }
    if (this.isSale) out.push(`SALE at Vito’s today! Fruit pays 150% and the ${this.saleItem?.name.toLowerCase() ?? 'featured piece'} is half price.`);
    else if (this.saleDayOf(this.day + 1)) out.push('Vito’s sale is tomorrow: fruit at 150% and one piece of furniture half price. Hold your harvest!');
    out.push(`Vito’s fruit market: paying ${Math.round(this.fruitRate * 100)}% today.`);
    out.push(`Vito’s Home Rating: ${this.roomScore.toLocaleString()} points, “${this.homeRating}.”${this.completeSets.length ? ` Sets: ${this.completeSets.join(', ')}.` : ''}`);
    const fc = this.forecast;
    out.push(`Tomorrow: ${fc === 'clear' ? 'clear skies' : fc === 'rain' ? 'rain, good for fishing and snails' : 'snow'}.`);
    if (this.balloonDay && this.weather === 'clear') out.push(this.balloonDone ? 'A balloon drifted over this afternoon and out to sea.' : `A balloon is expected from the west around ${Math.floor(this.balloonHour)}:00. Throw a fruit or shell when it passes over.`);
    out.push(`This afternoon: ${this.residents.map((v) => `${v.name} ${this.whereabouts(v.id, 'afternoon')}`).join('; ')}.`);
    const res = this.residents.filter((v) => v.id !== 'friend');
    if (res.length >= 2) { const a = res[Math.floor(this.dayHash(20) * res.length)]; const b = res[(res.indexOf(a) + 1 + Math.floor(this.dayHash(21) * (res.length - 1))) % res.length]; out.push(`${a.name} is visiting ${b.name} this afternoon.`); }
    if (this.season === 'summer' && this.weather === 'clear') out.push('Clear summer night: watch for shooting stars after 20:00 and press the action button to wish.');
    if (this.weather !== 'clear') out.push(this.weather === 'rain' ? 'Rain today: fish bite faster, snails are out.' : 'Snow today: bundle up.');
    const unmet = NEIGHBOURS.filter((v) => v.arrives && !this.arrived.includes(v.id));
    if (unmet.length) out.push(`${unmet[0].name} the ${unmet[0].species} is thinking of moving in once ${unmet[0].arrives} goals on ${this.friendName}’s list are done.`);
    return out;
  }

  // ---- wildlife -----------------------------------------------------------
  private active(s: Species) {
    if (s.festival && (!this.festival || this.jackpotTaken)) return false;
    if (s.seasons.length && !s.seasons.includes(this.season)) return false;
    if (s.time === 'day' && this.isNight) return false;
    if (s.time === 'night' && !this.isNight) return false;
    if (s.rain && this.weather === 'clear') return false;
    return true;
  }
  private weighted<T extends { rarity: number }>(list: T[]): T | null {
    const total = list.reduce((s, f) => s + f.rarity, 0);
    if (!total) return null;
    let r = this.rng() * total;
    for (const f of list) { r -= f.rarity; if (r <= 0) return f; }
    return list[list.length - 1];
  }
  private weightedId(list: { id: string; rarity: number }[]) { return this.weighted(list)!.id; }
  private moveBugs(dt: number) {
    this.bugTimer -= dt;
    if (this.bugTimer <= 0) {
      this.bugTimer = 4 + this.rng() * 4;
      if (this.bugs.length < MAX_BUGS && !(this.weather !== 'clear' && this.rng() < 0.6)) {
        const kinds = BUGS.filter((b) => this.active(b));
        const s = this.weighted(kinds);
        if (s) {
          const spot = this.bugSpot(s.habitat as string);
          if (spot) this.bugs.push({ id: s.id, x: spot[0] + 0.5, y: spot[1] + 0.5, vx: 0, vy: 0, life: 45 + this.rng() * 30, shy: s.rarity <= 2, fleeing: false });
        }
      }
    }
    for (const b of this.bugs) {
      b.life -= dt;
      const d = Math.hypot(b.x - this.x, b.y - this.y);
      const scare = this.sneaking ? (b.shy ? 0.5 : 0) : this.running ? (b.shy ? 2.4 : 1.3) : b.shy ? 1.0 : 0;
      if (!b.fleeing && this.moving && d < scare) {
        b.fleeing = true;
        b.life = Math.min(b.life, 1.4);
        const ang = Math.atan2(b.y - this.y, b.x - this.x);
        b.vx = Math.cos(ang) * 4; b.vy = Math.sin(ang) * 4;
        this.event = 'flee';
      }
      if (!b.fleeing && this.rng() < dt * 0.6) { b.vx = (this.rng() - 0.5) * 1.2; b.vy = (this.rng() - 0.5) * 1.2; }
      const nx = b.x + b.vx * dt, ny = b.y + b.vy * dt;
      if (b.fleeing || !this.solid(Math.floor(nx), Math.floor(ny)) || this.tileAt(Math.floor(nx), Math.floor(ny)) === 'water') { b.x = nx; b.y = ny; } else { b.vx = -b.vx; b.vy = -b.vy; }
    }
    this.bugs = this.bugs.filter((b) => b.life > 0);
  }
  private bugSpot(habitat: string): [number, number] | null {
    for (let i = 0; i < 40; i++) {
      const x = 1 + Math.floor(this.rng() * (W - 2)), y = 1 + Math.floor(this.rng() * (H - 5));
      if (habitat === 'tree') { const t = this.pick(this.trees); if (t && !this.solid(t.x, t.y + 1)) return [t.x, t.y + 1]; continue; }
      if (habitat === 'flower') { const f = this.pick(this.flowers); if (f) return [f.x, f.y]; continue; }
      if (habitat === 'water') { if (this.tileAt(x, y) === 'water' && y < H - 3) return [x, y]; continue; }
      if (this.freeGrass(x, y)) return [x, y];
    }
    return null;
  }
  private moveVillagers(dt: number) {
    if (this.ceremony) return;
    for (const v of this.residents) {
      if (v.id === 'friend' && this.escort) { this.follow(v, dt); continue; }
      if (!this.villagersOut) continue;
      const dx = v.tx - v.x, dy = v.ty - v.y, d = Math.hypot(dx, dy);
      if (d < 0.05) {
        v.wait -= dt;
        if (v.wait <= 0) {
          v.wait = 1 + this.rng() * 3;
          const h = this.haunt(v.id);
          const far = Math.hypot(h.x + 0.5 - v.x, h.y + 0.5 - v.y) > 2.5;
          // Far from where they mean to be, villagers head that way; close by, they potter about.
          const dir = far && this.rng() < 0.8 ? this.pick(FACE.filter((d) => Math.hypot(h.x + 0.5 - v.x - d[0], h.y + 0.5 - v.y - d[1]) < Math.hypot(h.x + 0.5 - v.x, h.y + 0.5 - v.y))) ?? this.pick(FACE) : this.pick(FACE);
          const nx = Math.floor(v.x) + dir[0], ny = Math.floor(v.y) + dir[1];
          if (!this.solid(nx, ny) && !this.doorAt(nx, ny) && Math.hypot(nx + 0.5 - this.x, ny + 0.5 - this.y) > 0.9) { v.tx = nx + 0.5; v.ty = ny + 0.5; v.facing = FACE.indexOf(dir) as Facing; }
        }
      } else {
        const sp = Math.min(d, (Math.hypot(this.haunt(v.id).x + 0.5 - v.x, this.haunt(v.id).y + 0.5 - v.y) > 2.5 ? 2.2 : 1.4) * dt);
        v.x += (dx / d) * sp; v.y += (dy / d) * sp;
      }
    }
  }

  // ---- pockets ------------------------------------------------------------
  get full() { return this.pockets.length >= POCKETS; }
  addItem(item: Item) {
    if (this.full) { this.say('Your pockets are full.'); this.react('💦'); return false; }
    this.pockets.push(item);
    return true;
  }
  say(text: string) { this.message = text; this.messageAge = 3.5; }
  react(icon: string) { this.reaction = { icon, age: 0 }; }
  fx(kind: Effect['kind'], x: number, y: number, color = '#fff') { this.effects.push({ kind, x, y, age: 0, color }); }
  itemFor(kind: Kind, id: string): Item {
    if (kind === 'fish' || kind === 'bug' || kind === 'fossil') { const s = (kind === 'fish' ? FISH : kind === 'bug' ? BUGS : FOSSILS).find((s) => s.id === id)!; return { kind, id, name: s.name, price: s.price }; }
    if (kind === 'fruit') return { kind, id, name: id === GOLDEN_FRUIT ? 'Golden fruit' : id[0].toUpperCase() + id.slice(1), price: id === GOLDEN_FRUIT ? FRUIT_PRICE.golden : id === NATIVE_FRUIT ? FRUIT_PRICE.native : FRUIT_PRICE.foreign };
    if (kind === 'flower') return { kind, id, name: `${id[0].toUpperCase() + id.slice(1)} flower`, price: BASE_COLORS.includes(id as FlowerColor) ? FLOWER_PRICE.base : FLOWER_PRICE.hybrid };
    if (kind === 'seed') return { kind, id, name: `${id[0].toUpperCase() + id.slice(1)} seeds`, price: SEED_PRICE / 2 };
    if (kind === 'shell') { const s = SHELLS.find((s) => s.id === id)!; return { kind, id, name: s.name, price: s.price }; }
    const f = FURNITURE.find((f) => f.id === id)!; return { kind, id, name: f.name, price: Math.floor(f.price / 4) };
  }
  unknownFossil(hidden: string): Item { return { kind: 'fossil', id: 'unknown', name: 'Unidentified fossil', price: 0, hidden }; }
  select(i: number) { this.selected = i >= 0 && i < this.pockets.length && this.selected !== i ? i : -1; }
  private removeAt(i: number) { this.pockets.splice(i, 1); if (this.selected === i) this.selected = -1; else if (this.selected > i) this.selected--; }
  setTool(t: Tool) { if (this.tools.includes(t)) { this.tool = t; this.fishing = null; } }
  cycleTool() { const i = this.tools.indexOf(this.tool); this.setTool(this.tools[(i + 1) % this.tools.length]); }
  togglePin(i: number) { const p = this.pockets[i]; if (p) p.pinned = !p.pinned; }
  /** Sort pockets: pinned first, then by kind, then by value. The selection follows its item. */
  sortPockets() {
    const order: Kind[] = ['fish', 'bug', 'fossil', 'shell', 'fruit', 'flower', 'seed', 'furniture'];
    const sel = this.pockets[this.selected];
    this.pockets.sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || order.indexOf(a.kind) - order.indexOf(b.kind) || b.price - a.price || a.name.localeCompare(b.name));
    this.selected = sel ? this.pockets.indexOf(sel) : -1;
  }
  /** Switch to a tool the hero owns; false if they don't. */
  private need(t: Tool) {
    if (this.tool === t) return true;
    if (!this.tools.includes(t)) return false;
    this.tool = t;
    this.event = 'swap';
    return true;
  }

  // ---- looking around ---------------------------------------------------------
  /** What the hero is facing and what would happen on the action button. */
  peek(): Peek {
    if (this.fishing) return { target: 'Fishing', hint: this.fishing.phase === 'reel' ? 'Hold to reel, let go to ease the line' : this.fishing.phase === 'bite' ? 'Now! Press to hook it' : 'Wait for the real tug' };
    const [fx, fy] = this.facingTile();
    const v = this.villagerNear();
    if (v) return { target: v.name, hint: this.isBirthday(v.id) ? 'It’s their birthday! Talk or give a gift' : 'Talk' };
    const door = this.doorAt(Math.floor(this.x), Math.floor(this.y));
    if (door && this.facing === 0) return { target: door.id === 'home' ? this.houseName : door.name, hint: door.id === 'shop' && !this.shopOpen ? `Closed until ${SHOP_OPEN}:00` : 'Enter' };
    if (this.isBoard(fx, fy)) return { target: 'Notice board', hint: 'Read' };
    const outside = this.outdoorAt(fx, fy);
    if (outside) return { target: FURNITURE.find((f) => f.id === outside.id)!.name, hint: 'Pick it up' };
    const tree = this.treeAt(fx, fy);
    if (tree) return { target: tree.grown ? `${tree.fruit[0].toUpperCase() + tree.fruit.slice(1)} sapling` : tree.golden ? 'Golden tree' : `${tree.fruit[0].toUpperCase() + tree.fruit.slice(1)} tree`, hint: this.tool === 'trowel' ? (tree.golden ? 'Too precious to move' : 'Dig it up to replant') : tree.grown ? `Fruits on day ${tree.grown}` : tree.count ? `Shake (${tree.count} left)` : 'Bare until tomorrow' };
    const rock = this.rockAt(fx, fy);
    if (rock) return { target: 'Rock', hint: this.tools.includes('shovel') ? (rock.hits >= ROCK_HITS ? 'Spent for today' : 'Hit with the shovel') : 'Needs a shovel' };
    if (this.snowmanAt(fx, fy)) return { target: 'Snowman', hint: 'Looking good' };
    if (this.snowballAt(fx, fy)) return { target: 'Snowball', hint: 'Roll with bare paws' };
    const bug = this.bugNear(fx, fy);
    if (bug) return { target: BUGS.find((b) => b.id === bug.id)!.name, hint: bug.shy && !this.sneaking ? 'Net it (shy: sneak up on it)' : 'Net it (walk, don’t run)' };
    const habitat = this.habitatOf(fx, fy);
    if (habitat) return { target: `The ${habitat}`, hint: 'Cast the rod' };
    if (this.fossilAt(fx, fy)) return { target: 'Cracked earth', hint: this.tools.includes('shovel') ? 'Dig' : 'Needs a shovel' };
    const shell = this.shellAt(fx, fy);
    if (shell) return { target: SHELLS.find((s) => s.id === shell.id)!.name, hint: 'Pick up' };
    const flower = this.flowerAt(fx, fy);
    if (flower) return { target: `${flower.color[0].toUpperCase() + flower.color.slice(1)} flower${flower.watered ? ' (watered)' : ''}`, hint: this.tool === 'can' ? 'Water' : this.tool === 'hands' ? 'Pick' : 'Pick bare-pawed or water with the can' };
    if (this.balloonInReach) { const s = this.pockets[this.selected]; return { target: 'A balloon overhead', hint: s && (s.kind === 'fruit' || s.kind === 'shell') ? `Throw the ${s.name.toLowerCase()}` : 'Select a fruit or shell to throw' }; }
    if (this.star > 0) return { target: 'A shooting star', hint: this.wished ? 'Already wished tonight' : 'Make a wish' };
    if (this.tool === 'trowel') {
      const sel = this.pockets[this.selected];
      if (this.paved(fx, fy)) return { target: 'Your paving', hint: 'Lift it back to grass' };
      if (sel?.kind === 'furniture' && this.freeGrass(fx, fy)) return { target: 'Grass', hint: `Stand the ${sel.name.toLowerCase()} here` };
      if (this.pavable(fx, fy)) return { target: 'Grass', hint: 'Lay paving' };
    }
    if (this.tool === 'shovel' && this.freeGrass(fx, fy)) { const s = this.pockets[this.selected]; return { target: 'Grass', hint: s && (s.kind === 'seed' || s.kind === 'fruit') ? `Plant ${s.name.toLowerCase()}` : 'Select seeds or fruit to plant' }; }
    return { target: this.tileAt(fx, fy) === 'sand' ? 'Sand' : 'Grass', hint: '' };
  }

  // ---- the action button ----------------------------------------------------
  interact(): string {
    if (this.dialog) return '';
    if (this.screen !== 'world') return '';
    if (this.fishing) return this.hook();
    const [fx, fy] = this.facingTile();
    const v = this.villagerNear();
    if (v) return this.talk(v);
    const door = this.doorAt(Math.floor(this.x), Math.floor(this.y));
    if (door && this.facing === 0) return this.enter(door);
    if (this.isBoard(fx, fy)) { this.screen = 'board'; return this.tell('The notice board.'); }
    const outside = this.outdoorAt(fx, fy);
    if (outside) return this.liftOutside(outside);
    const tree = this.treeAt(fx, fy);
    if (tree) return this.tool === 'trowel' ? this.digTree(tree) : this.shake(tree);
    const rock = this.rockAt(fx, fy);
    if (rock) return this.need('shovel') ? this.hitRock(rock) : this.tell('A hard rock. A shovel might knock something loose.');
    const snowball = this.snowballAt(fx, fy);
    if (snowball) return this.rollSnowman(snowball);
    const bug = this.bugNear(fx, fy);
    if (bug && this.need('net')) return this.catchBug(bug);
    const habitat = this.habitatOf(fx, fy);
    if (habitat) return this.need('rod') ? this.cast(fx, fy, habitat) : this.tell(`The ${habitat} glitters. You’d need a rod.`);
    const fossil = this.fossilAt(fx, fy);
    if (fossil) return this.need('shovel') ? this.dig(fossil) : this.tell('A cracked patch of earth. Something is buried here.');
    const shell = this.shellAt(fx, fy);
    if (shell) return this.pickShell(shell);
    const flower = this.flowerAt(fx, fy);
    if (flower) {
      if (this.tool === 'can') { flower.watered = true; this.event = 'water'; this.fx('splash', fx + 0.5, fy + 0.5, '#5da2cf'); return this.tell('Watered. Watered neighbours may breed overnight.'); }
      if (this.tool === 'hands') { const item = this.itemFor('flower', flower.color); if (this.addItem(item)) { this.flowers.splice(this.flowers.indexOf(flower), 1); this.event = 'shake'; this.fx('puff', fx + 0.5, fy + 0.5, '#f7e06a'); return this.tell(`Picked a ${item.name.toLowerCase()}.`); } return this.message; }
      return this.tell(`A ${flower.color} flower. Pick it bare-pawed or water it.`);
    }
    if (this.tool === 'trowel') {
      const sel = this.pockets[this.selected];
      if (this.paved(fx, fy)) return this.unpave(fx, fy);
      if (sel?.kind === 'furniture' && this.freeGrass(fx, fy)) return this.standOutside(fx, fy);
      if (this.pavable(fx, fy)) return this.pave(fx, fy);
    }
    if (this.tool === 'shovel' && this.freeGrass(fx, fy)) return this.plant(fx, fy);
    if (this.balloonInReach) return this.throwAtBalloon();
    if (this.star > 0) return this.wish();
    return this.tell('Nothing here but grass.');
  }
  /** Throw the selected fruit or shell at the passing balloon; a hit drops a present. */
  private throwAtBalloon() {
    const item = this.pockets[this.selected];
    if (!item || (item.kind !== 'fruit' && item.kind !== 'shell')) return this.tell('Select a fruit or shell to throw at the balloon.');
    const b = this.balloon!;
    this.removeAt(this.selected);
    this.balloon = null;
    this.balloonDone = true;
    this.stats.balloons++;
    this.fx('puff', b.x, b.y, '#f4a3c4');
    this.fx('present', b.x, b.y, '#f0cd6b');
    this.event = 'pop';
    this.react('★');
    const unowned = FURNITURE.filter((f) => f.shop && !this.furniture.some((p) => p.id === f.id) && !this.pockets.some((p) => p.kind === 'furniture' && p.id === f.id));
    if (this.rng() < 0.5 && unowned.length && !this.full) { const f = this.pick(unowned); this.pockets.push(this.itemFor('furniture', f.id)); return this.tell(`Pop! The present floated down: a ${f.name.toLowerCase()}.`); }
    this.earn(BALLOON_PRIZE);
    return this.tell(`Pop! The present floated down: ${BALLOON_PRIZE} raisins.`);
  }
  private tell(text: string) { this.say(text); return text; }
  villagerNear() {
    const [dx, dy] = FACE[this.facing];
    return this.residents.find((v) => (this.villagersOut || (v.id === 'friend' && this.escort)) && Math.hypot(v.x - (this.x + dx * 0.8), v.y - (this.y + dy * 0.8)) < 0.8) ?? null;
  }
  /** True while the companion is out walking with you rather than keeping neighbour hours. */
  out(v: Villager) { return this.villagersOut || (v.id === 'friend' && this.escort); }
  /** Walk the companion to a spot just behind the hero, so they never block what you are facing. */
  private follow(v: Villager, dt: number) {
    const [fx, fy] = FACE[this.facing];
    const tx = this.x - fx * 1.5, ty = this.y - fy * 1.5;
    const dx = tx - v.x, dy = ty - v.y, d = Math.hypot(dx, dy);
    if (d > 9) { v.x = v.tx = tx; v.y = v.ty = ty; return; }
    if (d < 0.3) return;
    v.facing = (Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 1 : 3) : dy > 0 ? 2 : 0) as Facing;
    const sp = Math.min(d, (d > 2.6 ? RUN : WALK) * dt);
    const nx = v.x + (dx / d) * sp, ny = v.y + (dy / d) * sp;
    if (!this.solid(Math.floor(nx), Math.floor(v.y))) v.x = nx;
    if (!this.solid(Math.floor(v.x), Math.floor(ny))) v.y = ny;
    v.tx = v.x; v.ty = v.y;
  }
  private bugNear(fx: number, fy: number) { return this.bugs.find((b) => !b.fleeing && Math.hypot(b.x - (fx + 0.5), b.y - (fy + 0.5)) < 1.1) ?? null; }

  private shake(tree: Tree) {
    if (tree.grown) return this.tell(`A sapling. It fruits on day ${tree.grown}.`);
    this.fx('leaf', tree.x + 0.5, tree.y + 0.3, this.season === 'autumn' ? '#d98a3c' : '#4f9a4a');
    if (!tree.count) return this.tell('No fruit today. Try tomorrow.');
    if (this.addItem(this.itemFor('fruit', tree.golden ? GOLDEN_FRUIT : tree.fruit))) { tree.count--; this.stats.fruit++; this.log.fruit++; this.note(this.pockets[this.pockets.length - 1]); this.event = 'shake'; this.fx('fruit', tree.x + 0.5, tree.y + 0.4, tree.golden ? GOLDEN_FRUIT : tree.fruit); this.react('♪'); return this.tell(tree.golden ? `A golden ${tree.fruit} fell, heavy and glowing. ${tree.count} left today.` : `Shook loose ${tree.count ? 'an' : 'the last'} ${tree.fruit}.`); }
    return this.message;
  }
  private hitRock(rock: Rock) {
    if (rock.hits >= ROCK_HITS) return this.tell('The rock has given all it will today.');
    const drop = ROCK_DROPS[rock.hits++];
    this.earn(drop);
    this.event = 'coin';
    this.fx('sparkle', rock.x + 0.5, rock.y + 0.3, '#ffd94a');
    return this.tell(`Clang! ${drop} raisins rolled out.`);
  }
  private rollSnowman(s: Spot) {
    if (this.tool !== 'hands') return this.tell('Put the tools away; snowmen are rolled by paw.');
    this.snowballs.splice(this.snowballs.indexOf(s), 1);
    this.snowmen.push({ x: s.x, y: s.y });
    this.earn(SNOWMAN_PRIZE);
    this.stats.snowmen++;
    this.event = 'goal';
    this.fx('snow', s.x + 0.5, s.y + 0.5, '#fff');
    this.react('♥');
    return this.tell(`A fine snowman! ${SNOWMAN_PRIZE} raisins for the effort.`);
  }
  private catchBug(bug: Bug) {
    const item = this.itemFor('bug', bug.id);
    if (!this.addItem(item)) return this.message;
    this.bugs.splice(this.bugs.indexOf(bug), 1);
    this.stats.bugs++;
    this.log.bugs++;
    this.note(item);
    this.today.bugs += item.price;
    this.record(bug.id);
    this.event = 'catch';
    this.fx('puff', bug.x, bug.y, '#ffffff');
    this.react('!');
    return this.tell(`Caught a ${item.name}!`);
  }
  private pickShell(shell: Shell) {
    if (!this.addItem(this.itemFor('shell', shell.id))) return this.message;
    this.shells.splice(this.shells.indexOf(shell), 1);
    this.log.shells++;
    this.note(this.pockets[this.pockets.length - 1]);
    this.event = 'shake';
    return this.tell(`Picked up a ${SHELLS.find((s) => s.id === shell.id)!.name.toLowerCase()}.`);
  }
  private wish() {
    if (this.wished) return this.tell('You already wished tonight. Don’t be greedy.');
    this.wished = true;
    this.event = 'star';
    this.react('★');
    return this.tell('You wished on the star. Check by your door tomorrow.');
  }

  // ---- fishing --------------------------------------------------------------------
  private cast(x: number, y: number, habitat: Habitat) {
    const rainy = this.weather !== 'clear';
    const s = this.weighted(FISH.filter((f) => f.habitat === habitat && this.active(f)));
    if (!s) return this.tell('Nothing seems to be swimming here right now.');
    const size: 1 | 2 | 3 = s.price < 300 ? 1 : s.price < 1500 ? 2 : 3;
    const fight = size === 1 ? 0.22 : size === 2 ? 0.34 : 0.48;
    this.fishing = { x, y, species: s.id, size, fight, phase: 'wait', timer: (rainy ? 1 : 2) + this.rng() * (rainy ? 3 : 5), nibbles: Math.floor(this.rng() * 3), progress: 0, tension: 0 };
    this.event = 'cast';
    this.fx('splash', x + 0.5, y + 0.5, '#ffffff');
    return this.tell('Cast. Ignore the nibbles; hook it on the real tug, then hold to reel.');
  }
  private fishTick(dt: number, hold: boolean, moved: boolean) {
    const f = this.fishing!;
    if (moved && f.phase !== 'reel') { this.fishing = null; return; }
    if (f.phase === 'wait') {
      f.timer -= dt;
      if (f.timer <= 0) {
        if (f.nibbles > 0) { f.nibbles--; f.phase = 'nibble'; f.timer = 0.4; this.event = 'nibble'; }
        else { f.phase = 'bite'; f.timer = BITE_WINDOW; this.event = 'bite'; }
      }
    } else if (f.phase === 'nibble') {
      f.timer -= dt;
      if (f.timer <= 0) { f.phase = 'wait'; f.timer = 0.8 + this.rng() * 1.6; }
    } else if (f.phase === 'bite') {
      f.timer -= dt;
      if (f.timer <= 0) { this.fishing = null; this.say('It got away.'); this.event = 'miss'; this.react('💦'); }
    } else {
      if (hold) { f.progress += REEL_SPEED * dt; f.tension += f.fight * dt; }
      else { f.progress -= REEL_SLIP * dt; f.tension -= TENSION_RELAX * dt; }
      if (this.rng() < dt * 0.7) f.tension += f.fight * 0.1;
      f.tension = Math.max(0, f.tension);
      if (f.tension >= 1) { this.fishing = null; this.snaps++; this.say(this.snaps >= 3 ? `Snap! ${this.friendName}, passing on the bank: “Ease off the moment the line turns red. You’ll get it.”` : 'Snap! The line broke.'); this.event = 'miss'; this.react('💦'); }
      else if (f.progress <= 0) { this.fishing = null; this.say('It slipped the hook.'); this.event = 'miss'; }
      else if (f.progress >= 1) this.land();
    }
  }
  private hook() {
    const f = this.fishing!;
    if (f.phase === 'reel') return '';
    if (f.phase !== 'bite') { this.fishing = null; this.event = 'miss'; return this.tell(f.phase === 'nibble' ? 'Just a nibble. You spooked it.' : 'Too early. Nothing on the line.'); }
    f.phase = 'reel';
    f.progress = 0.3;
    f.tension = 0;
    this.event = 'hook';
    return this.tell('Hooked! Hold to reel, let go when the line strains.');
  }
  private land() {
    const f = this.fishing!;
    this.fishing = null;
    const item = this.itemFor('fish', f.species);
    if (!this.addItem(item)) return this.message;
    this.stats.fish++;
    this.log.fish++;
    this.note(item);
    this.today.fish += item.price;
    this.record(f.species);
    this.snaps = 0;
    this.event = 'catch';
    this.fx('splash', f.x + 0.5, f.y + 0.5, '#ffffff');
    this.react('!');
    if (f.size === 3) return this.tell(`Caught a ${item.name}! ${this.friendName} shouts from the bank: “What a monster!”`);
    return this.tell(`Caught a ${item.name}!`);
  }

  private dig(fossil: Spot) {
    const s = this.weighted(FOSSILS)!;
    if (!this.addItem(this.unknownFossil(s.id))) return this.message;
    this.fossils.splice(this.fossils.indexOf(fossil), 1);
    this.log.fossils++;
    this.event = 'dig';
    this.fx('dirt', fossil.x + 0.5, fossil.y + 0.5, '#7a5a3a');
    this.react('?');
    return this.tell('Dug up a fossil! Bubo at the museum can tell you what it is.');
  }
  private plant(x: number, y: number) {
    const item = this.pockets[this.selected];
    if (!item || (item.kind !== 'seed' && item.kind !== 'fruit')) return this.tell('Select seeds or a fruit to plant here.');
    if (item.id === GOLDEN_FRUIT) return this.tell('Far too precious to bury. Sell it, or give it to someone who deserves it.');
    this.removeAt(this.selected);
    this.event = 'dig';
    this.fx('dirt', x + 0.5, y + 0.5, '#7a5a3a');
    if (item.kind === 'seed') { this.flowers.push({ x, y, color: item.id as FlowerColor, watered: false }); return this.tell(`Planted ${item.id} flowers.`); }
    const golden = item.id !== NATIVE_FRUIT && this.rng() < GOLDEN_CHANCE;
    this.trees.push({ x, y, fruit: item.id as Fruit, count: 0, grown: this.day + SAPLING_DAYS, golden });
    return this.tell(`Planted ${item.id === NATIVE_FRUIT ? 'an' : 'a'} ${item.id} sapling. It fruits in ${SAPLING_DAYS} days.`);
  }
  /** Lay a path tile of your own. Only grass you could walk on becomes paving. */
  private pave(x: number, y: number) {
    this.edits[`${x},${y}`] = 'path';
    this.stats.paved++;
    this.event = 'dig';
    this.fx('dirt', x + 0.5, y + 0.5, '#c9b48a');
    return this.tell('Laid a path stone.');
  }
  private unpave(x: number, y: number) {
    delete this.edits[`${x},${y}`];
    this.event = 'dig';
    this.fx('dirt', x + 0.5, y + 0.5, '#7a5a3a');
    return this.tell('Lifted the stone. The grass will come back.');
  }
  /** Dig a tree up to move it. You get its fruit back, so replanting costs you the days. */
  private digTree(tree: Tree) {
    if (tree.golden) return this.tell('A golden tree. Far too precious to move.');
    if (!this.addItem(this.itemFor('fruit', tree.fruit))) return this.message;
    this.trees.splice(this.trees.indexOf(tree), 1);
    this.event = 'dig';
    this.fx('dirt', tree.x + 0.5, tree.y + 0.5, '#7a5a3a');
    this.fx('leaf', tree.x + 0.5, tree.y + 0.3, '#4f9a4a');
    return this.tell(`Dug up the ${tree.fruit} tree. Plant the ${tree.fruit} again wherever you like.`);
  }
  /** Stand a piece of furniture out in the hollow. */
  private standOutside(x: number, y: number) {
    const item = this.pockets[this.selected];
    if (!item || item.kind !== 'furniture') return this.tell('Select a piece of furniture to stand here.');
    this.removeAt(this.selected);
    this.outdoor.push({ id: item.id, x, y });
    this.event = 'dig';
    return this.tell(`Stood the ${item.name.toLowerCase()} out in the hollow.`);
  }
  private liftOutside(p: Placed) {
    const name = FURNITURE.find((f) => f.id === p.id)!.name;
    if (!this.addItem(this.itemFor('furniture', p.id))) return this.message;
    this.outdoor.splice(this.outdoor.indexOf(p), 1);
    this.event = 'shake';
    return this.tell(`Took the ${name.toLowerCase()} back.`);
  }
  private record(id: string) {
    if (!this.caught.includes(id)) this.caught.push(id);
    if ([...FISH, ...BUGS].some((s) => s.id === id && s.festival)) this.jackpotTaken = true;
  }

  // ---- buildings ----------------------------------------------------------
  private enter(b: Building) {
    if (b.id === 'home') { this.screen = 'home'; return this.hostVisitor() ?? this.tell(`Home sweet ${this.homeName.toLowerCase()}.`); }
    if (b.id === 'shop') { if (!this.shopOpen) return this.tell(`Vito’s opens ${SHOP_OPEN}:00 to ${SHOP_CLOSE}:00.`); this.screen = 'shop'; return this.tell('Vito: Welcome in! Buy, sell, browse, no pressure.'); }
    if (b.id === 'museum') { this.screen = 'museum'; return this.claimWings() ?? this.tell('Bubo: Hoo. Donations gratefully catalogued.'); }
    if (b.id === 'friend') return this.loanTalk();
    const v = NEIGHBOURS.find((v) => v.home === b.id);
    if (v?.arrives && !this.arrived.includes(v.id)) return this.tell(`An empty plot. ${v.name} moves in once ${v.arrives} goals are done.`);
    return this.tell(`${b.name}. The door is locked; catch them outside.`);
  }
  exit() { this.screen = 'world'; this.dialog = null; this.visitor = null; }
  /** A good friend who is out and about may follow you in and admire the room, once a day each. */
  private hostVisitor(): string | null {
    if (!this.villagersOut) return null;
    const guests = this.residents.filter((v) => v.id !== 'friend' && (this.friendship[v.id] ?? 0) >= VISIT_FRIENDSHIP && !this.visits.includes(v.id));
    if (!guests.length || this.rng() > 0.35) return null;
    const v = this.pick(guests);
    this.visits.push(v.id);
    this.stats.visits++;
    this.befriend(v.id, 1);
    let line: string;
    if (!this.furniture.length) line = 'Cozy. Minimalist, even. You should see what Vito has in.';
    else if (this.completeSets.length) line = `The whole ${this.completeSets[0]} set! It really comes together in here.`;
    else { const p = this.pick(this.furniture); line = `I love the ${FURNITURE.find((f) => f.id === p.id)!.name.toLowerCase()}. Where did you find it?`; }
    this.visitor = { id: v.id, name: v.name, line };
    this.event = 'talk';
    this.react('♥');
    return this.tell(`${v.name} followed you in: “${line}”`);
  }
  /** Award a plaque and raisins for each completed wing not yet rewarded. Needs a free pocket. */
  claimWings(): string | null {
    for (const w of WINGS) {
      if (this.wingsDone.includes(w.id) || !this.wingDone(w)) continue;
      if (this.full) return this.tell(`Bubo: The ${w.name.toLowerCase()} is complete! Free a pocket and I’ll hand over your plaque.`);
      this.wingsDone.push(w.id);
      this.earn(WING_REWARD);
      this.pockets.push(this.itemFor('furniture', `plaque-${w.id}`));
      this.event = 'goal';
      this.react('★');
      return this.tell(`Bubo: The ${w.name.toLowerCase()} is complete! Hoo-hoo! ${WING_REWARD} raisins and a plaque for your burrow.`);
    }
    return null;
  }
  buy(id: string): string {
    if (this.screen !== 'shop') return '';
    let price = 0, item: Item | null = null, tool: Tool | null = null;
    if (id in TOOL_PRICES) { tool = id as Tool; price = TOOL_PRICES[tool]!; if (this.tools.includes(tool)) return this.tell('You already own one.'); }
    else if (BASE_COLORS.includes(id as FlowerColor)) { price = SEED_PRICE; item = this.itemFor('seed', id); }
    else { const f = FURNITURE.find((f) => f.id === id && f.shop); if (!f) return ''; price = this.priceOf(f); item = this.itemFor('furniture', id); if (this.furniture.some((p) => p.id === id) || this.pockets.some((p) => p.kind === 'furniture' && p.id === id)) return this.tell('You already have that one.'); }
    if (this.raisins < price) return this.tell(`Vito: That’s ${price} raisins. Come back with more.`);
    if (item && this.full) return this.tell('Your pockets are full.');
    this.raisins -= price;
    if (tool) this.tools.push(tool); else if (item) this.pockets.push(item);
    this.event = 'coin';
    return this.tell(`Bought ${tool ? TOOL_NAMES[tool].toLowerCase() : item!.name.toLowerCase()} for ${price}.`);
  }
  sell(i: number): string {
    if (this.screen !== 'shop') return '';
    const item = this.pockets[i];
    if (!item) return '';
    if (item.id === 'unknown') return this.tell('Vito: No idea what that is. Bubo at the museum will know.');
    const value = this.valueOf(item);
    this.removeAt(i);
    this.earn(value);
    this.stats.sold += value;
    this.event = 'coin';
    return this.tell(`Sold ${item.name.toLowerCase()} for ${value} raisins.`);
  }
  /** Sell everything except seeds, furniture, pinned items and unassessed fossils. */
  sellAll(): string {
    if (this.screen !== 'shop') return '';
    const keep = (p: Item) => p.kind === 'furniture' || p.kind === 'seed' || !!p.pinned || p.id === 'unknown';
    const sellable = this.pockets.filter((p) => !keep(p));
    const total = sellable.reduce((s, p) => s + this.valueOf(p), 0);
    this.pockets = this.pockets.filter(keep);
    this.selected = -1;
    this.earn(total);
    this.stats.sold += total;
    if (total) this.event = 'coin';
    return this.tell(total ? `Sold ${sellable.length} things for ${total} raisins.` : 'Nothing to sell.');
  }
  /** Furniture the shop has in stock today: three rotating pieces at list price. */
  get stock(): Furniture[] {
    const r = mulberry(this.seed * 17 + this.day);
    const shuffled = FURNITURE.filter((f) => f.shop);
    for (let i = shuffled.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; }
    return shuffled.slice(0, 3).sort((a, b) => a.price - b.price);
  }
  /** Bubo identifies one unassessed fossil per visit to the counter, so each reveal is its own little moment. */
  assess(): string {
    if (this.screen !== 'museum') return '';
    const p = this.pockets.find((p) => p.id === 'unknown' && p.hidden);
    if (!p) return this.tell('Bubo: Nothing to assess. Bring me anything you dig up.');
    const real = this.itemFor('fossil', p.hidden!);
    p.id = real.id; p.name = real.name; p.price = real.price;
    delete p.hidden;
    this.stats.fossils++;
    this.record(real.id);
    this.note(p);
    this.event = 'reveal';
    this.react('!');
    const left = this.unassessed;
    const dup = this.donated.includes(real.id);
    return this.tell(`Bubo: Hmm… aha! ${real.name === 'Ammonite' ? 'An' : 'A'} ${real.name.toLowerCase()}, worth ${real.price.toLocaleString()}. ${dup ? 'We already display one; sell it with a clear conscience.' : 'New to the museum, if you can bear to part with it.'}${left ? ` ${left} more to look at.` : ''}`);
  }
  get unassessed() { return this.pockets.filter((p) => p.id === 'unknown').length; }
  donate(i: number): string {
    if (this.screen !== 'museum') return '';
    const item = this.pockets[i];
    if (!item) return '';
    if (item.id === 'unknown') return this.tell('Bubo: Let me assess that first.');
    if (item.kind !== 'fish' && item.kind !== 'bug' && item.kind !== 'fossil') return this.tell('Bubo: We only display fish, bugs and fossils. Hoo.');
    if (this.donated.includes(item.id)) return this.tell(`Bubo: We already have a ${item.name.toLowerCase()}. Sell it, perhaps?`);
    this.removeAt(i);
    this.donated.push(item.id);
    this.event = 'talk';
    return this.claimWings() ?? this.tell(`Bubo: A ${item.name.toLowerCase()}! Displayed with pride. ${this.donated.length} of ${this.museumTotal}.`);
  }
  furnitureAt(x: number, y: number) { return this.furniture.find((p) => p.x === x && p.y === y); }
  /** Put a piece from your pockets on a free room tile. */
  place(i: number, x: number, y: number): string {
    if (this.screen !== 'home') return '';
    const item = this.pockets[i];
    if (!item || item.kind !== 'furniture') return this.tell('Only furniture goes in the burrow.');
    const [cols, rows] = this.roomSize;
    if (x < 0 || y < 0 || x >= cols || y >= rows) return this.tell('That is outside the room.');
    if (this.furnitureAt(x, y)) return this.tell('Something is already there.');
    this.removeAt(i);
    this.furniture.push({ id: item.id, x, y });
    this.event = 'dig';
    const set = FURNITURE.find((f) => f.id === item.id)?.set;
    if (set && this.setCount(set) >= 3 && !this.setsDone.includes(set)) { this.setsDone.push(set); this.earn(SET_BONUS); this.event = 'goal'; this.react('★'); return this.tell(`Placed the ${item.name.toLowerCase()}, and that completes the ${set} set! Vito sends ${SET_BONUS} raisins in admiration.`); }
    return this.tell(`Placed the ${item.name.toLowerCase()}.`);
  }
  /** Move a placed piece to another free tile. */
  moveFurniture(from: Placed, x: number, y: number): string {
    if (this.screen !== 'home') return '';
    const [cols, rows] = this.roomSize;
    if (x < 0 || y < 0 || x >= cols || y >= rows) return this.tell('That is outside the room.');
    if (this.furnitureAt(x, y)) return this.tell('Something is already there.');
    from.x = x; from.y = y;
    return this.tell('Moved.');
  }
  /** Take a placed piece back into your pockets. */
  pickUp(p: Placed): string {
    if (this.screen !== 'home') return '';
    if (this.full) return this.tell('Your pockets are full.');
    this.furniture.splice(this.furniture.indexOf(p), 1);
    this.pockets.push(this.itemFor('furniture', p.id));
    return this.tell(`Picked up the ${FURNITURE.find((f) => f.id === p.id)!.name.toLowerCase()}.`);
  }
  private loanTalk() {
    const friend = this.friendName;
    if (this.debt === 0) { this.dialog = { speaker: friend, text: `Your ${this.homeName.toLowerCase()} is all paid for. Nothing left to build; enjoy it.`, options: [{ label: 'Thanks!', action: 'close' }] }; return ''; }
    this.dialog = {
      speaker: friend,
      text: `Burrow Works! Your ${this.homeName.toLowerCase()} loan stands at ${this.debt} raisins. You have ${this.raisins}. Pay some off?`,
      options: [{ label: this.raisins >= this.debt ? `Pay it all (${this.debt})` : `Pay what I have (${this.raisins})`, action: 'pay' }, { label: 'Not today', action: 'close' }],
    };
    this.event = 'talk';
    return '';
  }
  pay(): string {
    const amount = Math.min(this.raisins, this.debt);
    if (!amount) return this.tell(`${this.friendName}: Not a single raisin? Go shake a tree.`);
    this.raisins -= amount;
    this.debt -= amount;
    this.event = 'coin';
    if (this.debt > 0) return this.tell(`Paid ${amount}. ${this.debt} raisins to go.`);
    this.homeLevel++;
    this.react('♥');
    if (this.homeLevel < LOANS.length) { this.debt = LOANS[this.homeLevel]; return this.tell(`Paid off! Welcome to your ${this.homeName}. The next expansion is ${this.debt} raisins, whenever you like.`); }
    this.debt = 0;
    return this.tell(`Paid off! The ${this.homeName} is yours, free and clear. ${this.friendName} is beaming.`);
  }

  // ---- neighbours -------------------------------------------------------------
  private talk(v: Villager) {
    v.facing = ((this.facing + 2) % 4) as Facing;
    const first = !this.talked.includes(v.id);
    if (first) { this.talked.push(v.id); this.befriend(v.id, 1); }
    const req = this.requests.find((r) => r.villager === v.id && !r.done);
    const last = this.gifts[v.id]?.[0];
    let line = v.id === 'friend' ? this.friendLine() : this.pick(v.lines);
    const keepsake = v.story && (this.friendship[v.id] ?? 0) >= FRIEND_MAX && !this.keepsakes.includes(v.id);
    if (keepsake && this.full) line = `I’ve something for you, and no room in those pockets of yours. Come back when you’ve a slot free.`;
    else if (keepsake) {
      this.keepsakes.push(v.id);
      this.pockets.push(this.itemFor('furniture', `photo-${v.id}`));
      this.stats.keepsakes++;
      this.react('♥');
      this.dialog = { speaker: v.name, text: v.story!, options: [{ label: 'Thank you', action: 'close' }] };
      this.event = 'goal';
      return '';
    }
    if (this.isBirthday(v.id)) line = `It’s my birthday today! ${line}`;
    else if (last && this.rng() < 0.3) line = `Still have that ${last} you gave me. ${line}`;
    if (req) line += ` Oh, and I’ve been wanting a ${req.kind} all day.`;
    const options: Dialog['options'] = [];
    const sel = this.pockets[this.selected];
    if (req && sel && sel.kind === req.kind && sel.id !== 'unknown') options.push({ label: `Here, a ${sel.name.toLowerCase()}`, action: 'deliver' });
    else if (sel && sel.id !== 'unknown') options.push({ label: `Give the ${sel.name.toLowerCase()}`, action: 'gift' });
    options.push({ label: 'See you around', action: 'close' });
    this.dialog = { speaker: v.name, text: line, options };
    this.event = 'talk';
    return '';
  }
  private friendLine() {
    const next = GOALS.find((g) => !this.goals.includes(g.id));
    return next ? `${this.pick(FRIEND_LINES)} Next on our list: ${next.text.toLowerCase()}.` : 'We did everything on the list. This hollow is home now.';
  }
  choose(i: number): string {
    const d = this.dialog;
    if (!d) return '';
    const opt = d.options[i];
    this.dialog = null;
    if (!opt || opt.action === 'close') return '';
    if (opt.action === 'pay') return this.pay();
    const v = this.villagers.find((v) => v.name === d.speaker);
    const item = this.pockets[this.selected];
    if (!v || !item) return '';
    this.removeAt(this.selected);
    const birthday = this.isBirthday(v.id);
    if (opt.action === 'deliver') {
      const req = this.requests.find((r) => r.villager === v.id)!;
      req.done = true;
      this.befriend(v.id, 3 + (birthday ? BIRTHDAY_BONUS : 0));
      this.remember(v.id, item);
      this.react('♥');
      const foreign = FRUIT.filter((f) => f !== NATIVE_FRUIT);
      if (this.rng() < 0.5 && !this.full) { const f = this.pick(foreign); this.pockets.push(this.itemFor('fruit', f)); this.event = 'catch'; return this.tell(`${v.name}: Exactly what I wanted! Take this ${f}, they don’t grow here.`); }
      const reward = 300;
      this.earn(reward);
      this.event = 'coin';
      return this.tell(`${v.name}: Exactly what I wanted! Here, ${reward} raisins.`);
    }
    const repeat = (this.gifts[v.id] ?? []).includes(item.id);
    const liked = item.kind === v.likes;
    const gain = repeat ? 0 : liked ? 3 : 1;
    this.befriend(v.id, gain + (birthday ? BIRTHDAY_BONUS : 0));
    this.remember(v.id, item);
    this.event = 'talk';
    if (birthday) { this.react('♥'); return this.tell(`${v.name}: You remembered my birthday! A ${item.name.toLowerCase()}, I’ll treasure it.`); }
    if (repeat) return this.tell(`${v.name}: Another ${item.name.toLowerCase()}? I still have the last one, but thank you.`);
    if (liked) this.react('♥');
    return this.tell(liked ? `${v.name}: A ${item.name.toLowerCase()}? You remembered! I love these.` : `${v.name}: Oh, a ${item.name.toLowerCase()}. How thoughtful.`);
  }
  private remember(id: string, item: Item) {
    const list = this.gifts[id] ?? [];
    this.gifts[id] = [item.id, ...list.filter((g) => g !== item.id)].slice(0, 3);
  }
  /** Award any goal newly met, and let neighbours move in. Returns the goals completed this call. */
  checkGoals(): Goal[] {
    const done: Goal[] = [];
    for (const g of GOALS) {
      if (this.goals.includes(g.id) || !g.test(this)) continue;
      this.goals.push(g.id);
      this.earn(g.reward);
      done.push(g);
    }
    if (done.length) { this.event = 'goal'; this.react('★'); this.say(`Goal: ${done[done.length - 1].text}! +${done[done.length - 1].reward} raisins.`); }
    for (const v of NEIGHBOURS) {
      if (v.arrives && !this.arrived.includes(v.id) && this.goals.length >= v.arrives) {
        this.arrived.push(v.id);
        this.requests.push({ villager: v.id, kind: v.likes, done: false });
        this.say(`${v.name} the ${v.species} has moved into the hollow!`);
        this.event = 'goal';
      }
    }
    return done;
  }

  // ---- saves --------------------------------------------------------------------
  save(): Save {
    return {
      v: 3, hero: this.hero, seed: this.seed, rs: this.rs, day: this.day, clock: this.clock, x: this.x, y: this.y, facing: this.facing,
      raisins: this.raisins, debt: this.debt, homeLevel: this.homeLevel, tools: [...this.tools], tool: this.tool, pockets: this.pockets.map((p) => ({ ...p })), furniture: this.furniture.map((p) => ({ ...p })),
      donated: [...this.donated], friendship: { ...this.friendship }, talked: [...this.talked], requests: this.requests.map((r) => ({ ...r })), goals: [...this.goals], gifts: Object.fromEntries(Object.entries(this.gifts).map(([k, v]) => [k, [...v]])),
      trees: this.trees.map((t) => ({ ...t })), flowers: this.flowers.map((f) => ({ ...f })), rocks: this.rocks.map((r) => ({ ...r })), fossils: this.fossils.map((f) => ({ ...f })), shells: this.shells.map((s) => ({ ...s })), snowballs: this.snowballs.map((s) => ({ ...s })), snowmen: this.snowmen.map((s) => ({ ...s })),
      stats: { ...this.stats }, caught: [...this.caught], today: { ...this.today }, wished: this.wished, live: this.live, liveKey: this.liveKey, arrived: [...this.arrived],
      wingsDone: [...this.wingsDone], setsDone: [...this.setsDone], sunny: this.sunny, balloonDone: this.balloonDone, visits: [...this.visits], log: { ...this.log }, keepsakes: [...this.keepsakes], jackpotTaken: this.jackpotTaken, escort: this.escort,
      edits: { ...this.edits }, outdoor: this.outdoor.map((p) => ({ ...p })), ended: this.ended,
    };
  }
  static load(raw: Save | SaveV1): Hollow {
    const g = new Hollow(raw.hero, raw.seed);
    const s = raw as Save;
    const cols = HOME_GRID[raw.homeLevel][0];
    const furniture: Placed[] = raw.v === 1 ? (raw.furniture as string[]).map((id, i) => ({ id, x: i % cols, y: Math.floor(i / cols) })) : s.furniture.map((p) => ({ ...p }));
    Object.assign(g, {
      rs: s.rs, day: s.day, clock: s.clock, x: s.x, y: s.y, facing: s.facing, raisins: s.raisins, debt: s.debt, homeLevel: s.homeLevel, tools: [...s.tools], tool: s.tool,
      pockets: s.pockets.map((p) => ({ ...p })), furniture, donated: [...s.donated], friendship: { ...g.friendship, ...s.friendship }, talked: [...s.talked],
      requests: s.requests.map((r) => ({ ...r })), goals: [...s.goals], gifts: s.gifts ?? {}, trees: s.trees.map((t) => ({ ...t })), flowers: s.flowers.map((f) => ({ ...f })), rocks: s.rocks.map((r) => ({ ...r })),
      fossils: s.fossils.map((f) => ({ ...f })), shells: (s.shells ?? g.shells).map((x) => ({ ...x })), snowballs: (s.snowballs ?? []).map((x) => ({ ...x })), snowmen: (s.snowmen ?? []).map((x) => ({ ...x })),
      stats: { ...g.stats, ...s.stats }, caught: [...s.caught], today: s.today ? { ...s.today } : { fish: 0, bugs: 0 }, wished: !!s.wished, live: !!s.live, liveKey: s.liveKey ?? '', arrived: [...(s.arrived ?? [])],
      wingsDone: [...(s.wingsDone ?? [])], setsDone: [...(s.setsDone ?? [])], sunny: s.sunny ?? 0, balloonDone: !!s.balloonDone, visits: [...(s.visits ?? [])], log: { ...g.log, ...s.log }, keepsakes: [...(s.keepsakes ?? [])], jackpotTaken: !!s.jackpotTaken, escort: s.escort ?? true,
      edits: { ...s.edits }, outdoor: (s.outdoor ?? []).map((p) => ({ ...p })), ended: !!s.ended,
    });
    if (raw.v === 1) for (const v of NEIGHBOURS) if (v.arrives && g.goals.length >= v.arrives && !g.arrived.includes(v.id)) g.arrived.push(v.id);
    g.screen = 'world';
    g.dialog = null;
    return g;
  }
}
