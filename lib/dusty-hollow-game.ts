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
export const POCKETS = 20;
export const LOANS = [4800, 19800, 49800];
export const HOME_NAMES = ['Tent', 'Cozy Burrow', 'Roomy Burrow', 'Grand Burrow'];
export const HOME_ROOM = [2, 4, 6, 8];
export const BITE_WINDOW = 0.9;
export const ROCK_HITS = 4;
export const ROCK_DROPS = [25, 50, 75, 100];
export const FOSSILS_PER_DAY = 3;
export const MAX_BUGS = 6;
export const SAPLING_DAYS = 3;
export const SHOP_OPEN = 8;
export const SHOP_CLOSE = 22;
export const WAKE = 7;
export const BEDTIME = 22;
export const FRIEND_MAX = 10;
export const FRIEND_TITLES = ['Stranger', 'Neighbour', 'Neighbour', 'Acquaintance', 'Acquaintance', 'Friend', 'Friend', 'Good friend', 'Good friend', 'Best friend', 'Best friend'];

export type Terrain = 'grass' | 'path' | 'water' | 'sand' | 'cliff' | 'bridge';
export type Habitat = 'river' | 'pond' | 'sea';
export type TimeOfDay = 'day' | 'night' | 'any';
export type Hero = 'dora' | 'enzo';
export type Tool = 'hands' | 'net' | 'rod' | 'shovel' | 'can';
export type Kind = 'fish' | 'bug' | 'fossil' | 'fruit' | 'flower' | 'seed' | 'furniture';
export type Facing = 0 | 1 | 2 | 3; // up, right, down, left
export const FACE: [number, number][] = [[0, -1], [1, 0], [0, 1], [-1, 0]];

export type Species = { id: string; name: string; price: number; habitat?: Habitat | 'grass' | 'tree' | 'flower' | 'water'; time: TimeOfDay; seasons: Season[]; rarity: number; rain?: boolean; blurb: string };
export const FISH: Species[] = [
  { id: 'trout', name: 'Rainbow Trout', price: 300, habitat: 'river', time: 'any', seasons: ['spring', 'summer', 'autumn', 'winter'], rarity: 5, blurb: 'Loves cold, quick water.' },
  { id: 'catfish', name: 'Andean Catfish', price: 800, habitat: 'river', time: 'night', seasons: ['spring', 'summer', 'autumn'], rarity: 2, blurb: 'Whiskers first, questions later.' },
  { id: 'salmon', name: 'Pacific Salmon', price: 700, habitat: 'river', time: 'any', seasons: ['autumn'], rarity: 3, blurb: 'Swims uphill every autumn.' },
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
];
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
export const FRUIT = ['apple', 'pear', 'peach', 'cherry', 'orange'] as const;
export type Fruit = (typeof FRUIT)[number];
export const NATIVE_FRUIT: Fruit = 'apple';
export const FRUIT_PRICE = { native: 100, foreign: 500 };
export const FLOWER_COLORS = ['red', 'yellow', 'white', 'orange', 'pink', 'purple', 'blue'] as const;
export type FlowerColor = (typeof FLOWER_COLORS)[number];
export const BASE_COLORS: FlowerColor[] = ['red', 'yellow', 'white'];
export const HYBRIDS: Record<string, FlowerColor> = { 'red+yellow': 'orange', 'red+white': 'pink', 'white+yellow': 'purple', 'white+white': 'blue' };
export const FLOWER_PRICE = { base: 40, hybrid: 400 };
export const SEED_PRICE = 80;
export const TOOL_PRICES: Partial<Record<Tool, number>> = { shovel: 600, can: 400 };
export const TOOL_NAMES: Record<Tool, string> = { hands: 'Bare paws', net: 'Bug net', rod: 'Fishing rod', shovel: 'Shovel', can: 'Watering can' };
export type Furniture = { id: string; name: string; price: number };
export const FURNITURE: Furniture[] = [
  { id: 'bed', name: 'Hay Bed', price: 900 },
  { id: 'tub', name: 'Dust Bath Tub', price: 1200 },
  { id: 'table', name: 'Little Table', price: 600 },
  { id: 'rug', name: 'Wool Rug', price: 800 },
  { id: 'shelf', name: 'Bookshelf', price: 1500 },
  { id: 'lamp', name: 'Paper Lamp', price: 700 },
  { id: 'stove', name: 'Pebble Stove', price: 2000 },
  { id: 'cactus', name: 'Cactus Pot', price: 400 },
];

export type Item = { kind: Kind; id: string; name: string; price: number };
export type Tree = { x: number; y: number; fruit: Fruit; count: number; grown: number /* day it bears fruit; 0 = mature */ };
export type Flower = { x: number; y: number; color: FlowerColor; watered: boolean };
export type Rock = { x: number; y: number; hits: number };
export type Fossil = { x: number; y: number };
export type Bug = { id: string; x: number; y: number; vx: number; vy: number; life: number };
export type Building = { id: string; name: string; x: number; y: number; w: number; h: number; door: [number, number] };
export type VillagerDef = { id: string; name: string; species: string; likes: Kind; color: string; home: string; lines: string[] };
export type Villager = VillagerDef & { x: number; y: number; tx: number; ty: number; wait: number; facing: Facing };
export type Request = { villager: string; kind: Kind; done: boolean };
export type Dialog = { speaker: string; text: string; options: { label: string; action: string }[] };
export type Screen = 'world' | 'shop' | 'museum' | 'home';
export type Weather = 'clear' | 'rain' | 'snow';
export type Goal = { id: string; text: string; reward: number; test: (g: Hollow) => boolean };

export const HERO_NAMES: Record<Hero, string> = { dora: 'Dora', enzo: 'Enzo' };
const NEIGHBOURS: VillagerDef[] = [
  { id: 'pia', name: 'Pia', species: 'flamingo', likes: 'fish', color: '#f39ab5', home: 'house-pia', lines: ['The sea is loud today. I like it.', 'Have you tried standing on one leg? Very restful.', 'Pink is not a phase, it is a lifestyle.'] },
  { id: 'rodri', name: 'Rodri', species: 'fox', likes: 'fruit', color: '#d9873c', home: 'house-rodri', lines: ['Fruit off the tree beats anything from a shop.', 'Heard a rumour there’s a beetle worth two thousand raisins. Don’t tell Tato.', 'The bridge creaks. I like to think it’s saying hello.'] },
  { id: 'vivi', name: 'Vivi', species: 'viscacha', likes: 'flower', color: '#b7a58c', home: 'house-vivi', lines: ['We viscachas are basically cousins. Long-lost, fluffy cousins.', 'A watered flower is a promise to tomorrow.', 'Sunbathing counts as exercise if you mean it.'] },
  { id: 'tato', name: 'Tato', species: 'condor', likes: 'bug', color: '#4a4750', home: 'house-tato', lines: ['From up high the whole hollow looks like a quilt.', 'Bugs are just very small birds. Don’t look that up.', 'The museum owl owes me a favour. Long story.'] },
];
const FRIEND_LINES = ['Morning! Did you see the mist on the river?', 'Bring me anything you find, I want to see it all.', 'The hollow feels more like home every day you’re here.', 'Pay the loan when you can. No rush. Well, a little rush.'];

export const GOALS: Goal[] = [
  { id: 'fish', text: 'Catch a fish', reward: 200, test: (g) => g.stats.fish > 0 },
  { id: 'bug', text: 'Catch a bug', reward: 200, test: (g) => g.stats.bugs > 0 },
  { id: 'shake', text: 'Shake fruit from a tree', reward: 100, test: (g) => g.stats.fruit > 0 },
  { id: 'talk', text: 'Meet all four neighbours', reward: 300, test: (g) => NEIGHBOURS.every((v) => g.friendship[v.id] > 0) },
  { id: 'donate', text: 'Donate three finds to the museum', reward: 500, test: (g) => g.donated.length >= 3 },
  { id: 'loan', text: 'Pay off the tent loan', reward: 1000, test: (g) => g.homeLevel >= 1 },
  { id: 'fossil', text: 'Dig up a fossil with a shovel', reward: 500, test: (g) => g.stats.fossils > 0 },
  { id: 'hybrid', text: 'Grow a hybrid flower', reward: 800, test: (g) => g.stats.hybrids > 0 },
  { id: 'friend', text: 'Become a Friend to a neighbour', reward: 800, test: (g) => NEIGHBOURS.some((v) => g.friendship[v.id] >= 5) },
  { id: 'museum', text: 'Fill half the museum', reward: 2000, test: (g) => g.donated.length * 2 >= FISH.length + BUGS.length + FOSSILS.length },
  { id: 'grand', text: 'Move into a Grand Burrow', reward: 5000, test: (g) => g.homeLevel >= 3 },
];

export type Save = {
  v: 1; hero: Hero; seed: number; rs: number; day: number; clock: number; x: number; y: number; facing: Facing;
  raisins: number; debt: number; homeLevel: number; tools: Tool[]; tool: Tool; pockets: Item[]; furniture: string[];
  donated: string[]; friendship: Record<string, number>; talked: string[]; requests: Request[]; goals: string[];
  trees: Tree[]; flowers: Flower[]; rocks: Rock[]; fossils: Fossil[];
  stats: Hollow['stats']; caught: string[];
};

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
  { id: 'house-tato', name: 'Tato’s house', x: 25, y: 14, w: 3, h: 2, door: [26, 16] },
];
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
  raisins = 0;
  debt = LOANS[0];
  homeLevel = 0;
  tools: Tool[] = ['hands', 'net', 'rod'];
  tool: Tool = 'hands';
  pockets: Item[] = [];
  selected = -1;
  furniture: string[] = [];
  donated: string[] = [];
  caught: string[] = [];
  friendship: Record<string, number> = {};
  talked: string[] = [];
  requests: Request[] = [];
  goals: string[] = [];
  trees: Tree[] = [];
  flowers: Flower[] = [];
  rocks: Rock[] = [];
  fossils: Fossil[] = [];
  bugs: Bug[] = [];
  villagers: Villager[] = [];
  stats = { fish: 0, bugs: 0, fossils: 0, fruit: 0, hybrids: 0, sold: 0, days: 1 };
  screen: Screen = 'world';
  dialog: Dialog | null = null;
  message = '';
  messageAge = 0;
  fishing: { x: number; y: number; wait: number; bite: number } | null = null;
  bugTimer = 0;
  /** Set by the engine for the page to play a sound: catch, miss, coin, talk, dig, shake. */
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

  get friendName() { return HERO_NAMES[this.hero === 'dora' ? 'enzo' : 'dora']; }
  get heroName() { return HERO_NAMES[this.hero]; }
  get hour() { return (this.clock / DAY) * 24; }
  get season(): Season { return SEASONS[Math.floor((this.day - 1) / DAYS_PER_SEASON) % 4]; }
  get year() { return Math.floor((this.day - 1) / (DAYS_PER_SEASON * 4)) + 1; }
  get isNight() { return this.hour < 6 || this.hour >= 19; }
  get weather(): Weather { const h = mulberry(this.seed * 131 + this.day)(); return h < 0.28 ? (this.season === 'winter' ? 'snow' : 'rain') : 'clear'; }
  get shopOpen() { return this.hour >= SHOP_OPEN && this.hour < SHOP_CLOSE; }
  get museumTotal() { return FISH.length + BUGS.length + FOSSILS.length; }
  get homeName() { return HOME_NAMES[this.homeLevel]; }
  get clockText() { const h = Math.floor(this.hour), m = Math.floor((this.hour - h) * 60); return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`; }

  tileAt(x: number, y: number): Terrain { return x < 0 || y < 0 || x >= W || y >= H ? 'cliff' : this.terrain[y * W + x]; }
  buildingAt(x: number, y: number) { return BUILDINGS.find((b) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h); }
  treeAt(x: number, y: number) { return this.trees.find((t) => t.x === x && t.y === y); }
  rockAt(x: number, y: number) { return this.rocks.find((r) => r.x === x && r.y === y); }
  flowerAt(x: number, y: number) { return this.flowers.find((f) => f.x === x && f.y === y); }
  fossilAt(x: number, y: number) { return this.fossils.find((f) => f.x === x && f.y === y); }
  doorAt(x: number, y: number) { return BUILDINGS.find((b) => b.door[0] === x && b.door[1] === y); }
  /** Anything a walker cannot stand on. */
  solid(x: number, y: number) {
    const t = this.tileAt(x, y);
    return t === 'cliff' || t === 'water' || !!this.buildingAt(x, y) || !!this.treeAt(x, y) || !!this.rockAt(x, y);
  }
  /** Plain grass with nothing standing on it. */
  freeGrass(x: number, y: number) {
    return this.tileAt(x, y) === 'grass' && !this.solid(x, y) && !this.flowerAt(x, y) && !this.fossilAt(x, y) && !this.doorAt(x, y) && !BUILDINGS.some((b) => Math.abs(b.door[0] - x) <= 1 && Math.abs(b.door[1] - y) <= 1) && Math.abs(y - STREET_Y) > 1;
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
      return { ...v, x: b.door[0] + 0.5, y: STREET_Y + 0.5, tx: b.door[0] + 0.5, ty: STREET_Y + 0.5, wait: 1, facing: 2 as Facing };
    });
  }

  // ---- time -------------------------------------------------------------
  step(dt: number, input: { dx: number; dy: number; run: boolean } = { dx: 0, dy: 0, run: false }) {
    if (this.messageAge > 0) { this.messageAge -= dt; if (this.messageAge <= 0) this.message = ''; }
    this.clock += dt;
    if (this.clock >= DAY) { this.clock -= DAY; this.newDay(); }
    this.checkGoals();
    if (this.screen !== 'world') return;
    if (!this.dialog) this.moveVillagers(dt);
    this.moveBugs(dt);
    if (this.fishing) {
      this.fishing.wait -= dt;
      if (this.fishing.wait <= 0 && this.fishing.bite === 0) { this.fishing.bite = BITE_WINDOW; this.event = 'bite'; }
      else if (this.fishing.bite > 0) { this.fishing.bite -= dt; if (this.fishing.bite <= 0) { this.fishing = null; this.say('It got away.'); this.event = 'miss'; } }
      if (input.dx || input.dy) this.fishing = null;
    }
    if (this.dialog) return;
    this.moving = !!(input.dx || input.dy);
    this.running = input.run && this.moving;
    if (!this.moving) return;
    const len = Math.hypot(input.dx, input.dy) || 1;
    const sp = (input.run ? RUN : WALK) * dt;
    if (Math.abs(input.dx) >= Math.abs(input.dy)) this.facing = input.dx > 0 ? 1 : 3; else this.facing = input.dy > 0 ? 2 : 0;
    this.tryMove((input.dx / len) * sp, 0);
    this.tryMove(0, (input.dy / len) * sp);
  }
  private tryMove(dx: number, dy: number) {
    const nx = this.x + dx, ny = this.y + dy, r = 0.3;
    const blocked = [[-r, -r], [r, -r], [-r, r], [r, r]].some(([ox, oy]) => this.solid(Math.floor(nx + ox), Math.floor(ny + oy)));
    if (!blocked) { this.x = nx; this.y = ny; }
  }
  /** Skip straight to the next morning. Only possible from inside the burrow. */
  sleep() {
    if (this.screen !== 'home') return false;
    this.newDay();
    this.clock = (WAKE / 24) * DAY;
    this.say(`A new day in Dusty Hollow. ${this.weather === 'clear' ? 'The sky is clear.' : this.weather === 'rain' ? 'It’s raining.' : 'Snow is falling.'}`);
    return true;
  }
  private newDay() {
    this.day++;
    this.stats.days++;
    this.talked = [];
    this.bugs = [];
    this.fishing = null;
    for (const t of this.trees) { if (t.grown && this.day >= t.grown) t.grown = 0; if (!t.grown) t.count = 3; }
    for (const r of this.rocks) r.hits = 0;
    this.breedFlowers();
    this.newDayContent();
  }
  private newDayContent() {
    this.fossils = [];
    for (let i = 0, tries = 0; i < FOSSILS_PER_DAY && tries < 500; tries++) {
      const x = 1 + Math.floor(this.rng() * (W - 2)), y = 1 + Math.floor(this.rng() * (H - 5));
      if (this.freeGrass(x, y)) { this.fossils.push({ x, y }); i++; }
    }
    this.requests = NEIGHBOURS.map((v) => ({ villager: v.id, kind: this.rng() < 0.5 ? v.likes : this.pick(['fish', 'bug', 'fruit', 'flower'] as Kind[]), done: false }));
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

  // ---- wildlife -----------------------------------------------------------
  private active(s: Species) {
    if (s.seasons.length && !s.seasons.includes(this.season)) return false;
    if (s.time === 'day' && this.isNight) return false;
    if (s.time === 'night' && !this.isNight) return false;
    if (s.rain && this.weather === 'clear') return false;
    return true;
  }
  private weighted(list: Species[]): Species | null {
    const total = list.reduce((s, f) => s + f.rarity, 0);
    if (!total) return null;
    let r = this.rng() * total;
    for (const f of list) { r -= f.rarity; if (r <= 0) return f; }
    return list[list.length - 1];
  }
  private moveBugs(dt: number) {
    this.bugTimer -= dt;
    if (this.bugTimer <= 0) {
      this.bugTimer = 4 + this.rng() * 4;
      if (this.bugs.length < MAX_BUGS && !(this.weather !== 'clear' && this.rng() < 0.6)) {
        const kinds = BUGS.filter((b) => this.active(b));
        const s = this.weighted(kinds);
        if (s) {
          const spot = this.bugSpot(s.habitat as string);
          if (spot) this.bugs.push({ id: s.id, x: spot[0] + 0.5, y: spot[1] + 0.5, vx: 0, vy: 0, life: 45 + this.rng() * 30 });
        }
      }
    }
    for (const b of this.bugs) {
      b.life -= dt;
      if (this.rng() < dt * 0.6) { b.vx = (this.rng() - 0.5) * 1.2; b.vy = (this.rng() - 0.5) * 1.2; }
      const nx = b.x + b.vx * dt, ny = b.y + b.vy * dt;
      if (!this.solid(Math.floor(nx), Math.floor(ny)) || this.tileAt(Math.floor(nx), Math.floor(ny)) === 'water') { b.x = nx; b.y = ny; } else { b.vx = -b.vx; b.vy = -b.vy; }
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
    const awake = this.hour >= WAKE && this.hour < BEDTIME;
    for (const v of this.villagers) {
      if (!awake) continue;
      const dx = v.tx - v.x, dy = v.ty - v.y, d = Math.hypot(dx, dy);
      if (d < 0.05) {
        v.wait -= dt;
        if (v.wait <= 0) {
          v.wait = 1 + this.rng() * 3;
          const dir = this.pick(FACE);
          const nx = Math.floor(v.x) + dir[0], ny = Math.floor(v.y) + dir[1];
          if (!this.solid(nx, ny) && !this.doorAt(nx, ny) && Math.hypot(nx + 0.5 - this.x, ny + 0.5 - this.y) > 0.9) { v.tx = nx + 0.5; v.ty = ny + 0.5; v.facing = FACE.indexOf(dir) as Facing; }
        }
      } else {
        const sp = Math.min(d, 1.4 * dt);
        v.x += (dx / d) * sp; v.y += (dy / d) * sp;
      }
    }
  }
  get villagersOut() { return this.hour >= WAKE && this.hour < BEDTIME; }

  // ---- pockets ------------------------------------------------------------
  get full() { return this.pockets.length >= POCKETS; }
  addItem(item: Item) {
    if (this.full) { this.say('Your pockets are full.'); return false; }
    this.pockets.push(item);
    return true;
  }
  say(text: string) { this.message = text; this.messageAge = 3.5; }
  itemFor(kind: Kind, id: string): Item {
    if (kind === 'fish' || kind === 'bug' || kind === 'fossil') { const s = (kind === 'fish' ? FISH : kind === 'bug' ? BUGS : FOSSILS).find((s) => s.id === id)!; return { kind, id, name: s.name, price: s.price }; }
    if (kind === 'fruit') return { kind, id, name: id[0].toUpperCase() + id.slice(1), price: id === NATIVE_FRUIT ? FRUIT_PRICE.native : FRUIT_PRICE.foreign };
    if (kind === 'flower') return { kind, id, name: `${id[0].toUpperCase() + id.slice(1)} flower`, price: BASE_COLORS.includes(id as FlowerColor) ? FLOWER_PRICE.base : FLOWER_PRICE.hybrid };
    if (kind === 'seed') return { kind, id, name: `${id[0].toUpperCase() + id.slice(1)} seeds`, price: SEED_PRICE / 2 };
    const f = FURNITURE.find((f) => f.id === id)!; return { kind, id, name: f.name, price: Math.floor(f.price / 4) };
  }
  select(i: number) { this.selected = i >= 0 && i < this.pockets.length && this.selected !== i ? i : -1; }
  setTool(t: Tool) { if (this.tools.includes(t)) { this.tool = t; this.fishing = null; } }
  cycleTool() { const i = this.tools.indexOf(this.tool); this.setTool(this.tools[(i + 1) % this.tools.length]); }

  // ---- the action button ----------------------------------------------------
  interact(): string {
    if (this.dialog) return '';
    if (this.screen !== 'world') return '';
    if (this.fishing) return this.reel();
    const [fx, fy] = this.facingTile();
    const v = this.villagerNear();
    if (v) return this.talk(v);
    const door = this.doorAt(Math.floor(this.x), Math.floor(this.y));
    if (door && this.facing === 0) return this.enter(door);
    const tree = this.treeAt(fx, fy);
    if (tree) return this.shake(tree);
    const rock = this.rockAt(fx, fy);
    if (rock) return this.tool === 'shovel' ? this.hitRock(rock) : this.tell('A hard rock. A shovel might knock something loose.');
    const bug = this.bugNear(fx, fy);
    if (bug && this.tool === 'net') return this.catchBug(bug);
    const habitat = this.habitatOf(fx, fy);
    if (habitat) return this.tool === 'rod' ? this.cast(fx, fy) : this.tell(`The ${habitat} glitters. You’d need a rod.`);
    const fossil = this.fossilAt(fx, fy);
    if (fossil) return this.tool === 'shovel' ? this.dig(fossil) : this.tell('A cracked patch of earth. Something is buried here.');
    const flower = this.flowerAt(fx, fy);
    if (flower) {
      if (this.tool === 'can') { flower.watered = true; this.event = 'water'; return this.tell('Watered. Watered neighbours may breed overnight.'); }
      if (this.tool === 'hands') { const item = this.itemFor('flower', flower.color); if (this.addItem(item)) { this.flowers.splice(this.flowers.indexOf(flower), 1); this.event = 'shake'; return this.tell(`Picked a ${item.name.toLowerCase()}.`); } return this.message; }
      return this.tell(`A ${flower.color} flower. Pick it bare-pawed or water it.`);
    }
    if (this.tool === 'shovel' && this.freeGrass(fx, fy)) return this.plant(fx, fy);
    if (bug) return this.tell('A bug! Swap to the net.');
    return this.tell('Nothing here but grass.');
  }
  private tell(text: string) { this.say(text); return text; }
  villagerNear() {
    if (!this.villagersOut) return null;
    const [dx, dy] = FACE[this.facing];
    return this.villagers.find((v) => Math.hypot(v.x - (this.x + dx * 0.8), v.y - (this.y + dy * 0.8)) < 0.8) ?? null;
  }
  private bugNear(fx: number, fy: number) { return this.bugs.find((b) => Math.hypot(b.x - (fx + 0.5), b.y - (fy + 0.5)) < 1.1) ?? null; }

  private shake(tree: Tree) {
    if (tree.grown) return this.tell(`A sapling. It fruits on day ${tree.grown}.`);
    if (!tree.count) return this.tell('No fruit today. Try tomorrow.');
    if (this.addItem(this.itemFor('fruit', tree.fruit))) { tree.count--; this.stats.fruit++; this.event = 'shake'; return this.tell(`Shook loose ${tree.count ? 'an' : 'the last'} ${tree.fruit}.`); }
    return this.message;
  }
  private hitRock(rock: Rock) {
    if (rock.hits >= ROCK_HITS) return this.tell('The rock has given all it will today.');
    const drop = ROCK_DROPS[rock.hits++];
    this.raisins += drop;
    this.event = 'coin';
    return this.tell(`Clang! ${drop} raisins rolled out.`);
  }
  private catchBug(bug: Bug) {
    const item = this.itemFor('bug', bug.id);
    if (!this.addItem(item)) return this.message;
    this.bugs.splice(this.bugs.indexOf(bug), 1);
    this.stats.bugs++;
    this.record(bug.id);
    this.event = 'catch';
    return this.tell(`Caught a ${item.name}!`);
  }
  private cast(x: number, y: number) {
    const rainy = this.weather !== 'clear';
    this.fishing = { x, y, wait: (rainy ? 1 : 2) + this.rng() * (rainy ? 3 : 5), bite: 0 };
    this.event = 'cast';
    return this.tell('Cast. Wait for the tug, then press again.');
  }
  private reel() {
    const f = this.fishing!;
    this.fishing = null;
    if (f.bite <= 0) { this.event = 'miss'; return this.tell('Too early. Nothing on the line.'); }
    const habitat = this.habitatOf(f.x, f.y)!;
    const s = this.weighted(FISH.filter((f) => f.habitat === habitat && this.active(f)));
    if (!s) { this.event = 'miss'; return this.tell('The line came back empty.'); }
    const item = this.itemFor('fish', s.id);
    if (!this.addItem(item)) return this.message;
    this.stats.fish++;
    this.record(s.id);
    this.event = 'catch';
    return this.tell(`Caught a ${item.name}!`);
  }
  private dig(fossil: Fossil) {
    const s = this.weighted(FOSSILS)!;
    const item = this.itemFor('fossil', s.id);
    if (!this.addItem(item)) return this.message;
    this.fossils.splice(this.fossils.indexOf(fossil), 1);
    this.stats.fossils++;
    this.record(s.id);
    this.event = 'dig';
    return this.tell(`Dug up ${item.name.match(/^[AEIOU]/) ? 'an' : 'a'} ${item.name}!`);
  }
  private plant(x: number, y: number) {
    const item = this.pockets[this.selected];
    if (!item || (item.kind !== 'seed' && item.kind !== 'fruit')) return this.tell('Select seeds or a fruit to plant here.');
    this.pockets.splice(this.selected, 1);
    this.selected = -1;
    this.event = 'dig';
    if (item.kind === 'seed') { this.flowers.push({ x, y, color: item.id as FlowerColor, watered: false }); return this.tell(`Planted ${item.id} flowers.`); }
    this.trees.push({ x, y, fruit: item.id as Fruit, count: 0, grown: this.day + SAPLING_DAYS });
    return this.tell(`Planted ${item.id === NATIVE_FRUIT ? 'an' : 'a'} ${item.id} sapling. It fruits in ${SAPLING_DAYS} days.`);
  }
  private record(id: string) { if (!this.caught.includes(id)) this.caught.push(id); }

  // ---- buildings ----------------------------------------------------------
  private enter(b: Building) {
    if (b.id === 'home') { this.screen = 'home'; return this.tell(`Home sweet ${this.homeName.toLowerCase()}.`); }
    if (b.id === 'shop') { if (!this.shopOpen) return this.tell(`Vito’s opens ${SHOP_OPEN}:00 to ${SHOP_CLOSE}:00.`); this.screen = 'shop'; return this.tell('Vito: Welcome in! Buy, sell, browse, no pressure.'); }
    if (b.id === 'museum') { this.screen = 'museum'; return this.tell('Bubo: Hoo. Donations gratefully catalogued.'); }
    if (b.id === 'friend') return this.loanTalk();
    return this.tell(`${b.name}. The door is locked; catch them outside.`);
  }
  exit() { this.screen = 'world'; this.dialog = null; }
  buy(id: string): string {
    if (this.screen !== 'shop') return '';
    let price = 0, item: Item | null = null, tool: Tool | null = null;
    if (id in TOOL_PRICES) { tool = id as Tool; price = TOOL_PRICES[tool]!; if (this.tools.includes(tool)) return this.tell('You already own one.'); }
    else if (BASE_COLORS.includes(id as FlowerColor)) { price = SEED_PRICE; item = this.itemFor('seed', id); }
    else { const f = FURNITURE.find((f) => f.id === id); if (!f) return ''; price = f.price; item = this.itemFor('furniture', id); if (this.furniture.includes(id)) return this.tell('You already have that at home.'); }
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
    this.pockets.splice(i, 1);
    if (this.selected >= this.pockets.length) this.selected = -1;
    this.raisins += item.price;
    this.stats.sold += item.price;
    this.event = 'coin';
    return this.tell(`Sold ${item.name.toLowerCase()} for ${item.price} raisins.`);
  }
  sellAll(): string {
    if (this.screen !== 'shop') return '';
    const sellable = this.pockets.filter((p) => p.kind !== 'furniture' && p.kind !== 'seed');
    const total = sellable.reduce((s, p) => s + p.price, 0);
    this.pockets = this.pockets.filter((p) => p.kind === 'furniture' || p.kind === 'seed');
    this.selected = -1;
    this.raisins += total;
    this.stats.sold += total;
    if (total) this.event = 'coin';
    return this.tell(total ? `Sold ${sellable.length} things for ${total} raisins.` : 'Nothing to sell.');
  }
  /** Furniture the shop has in stock today: three rotating pieces plus the cheap staples. */
  get stock(): Furniture[] {
    const r = mulberry(this.seed * 17 + this.day);
    const shuffled = [...FURNITURE];
    for (let i = shuffled.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; }
    return shuffled.slice(0, 3).sort((a, b) => a.price - b.price);
  }
  donate(i: number): string {
    if (this.screen !== 'museum') return '';
    const item = this.pockets[i];
    if (!item) return '';
    if (item.kind !== 'fish' && item.kind !== 'bug' && item.kind !== 'fossil') return this.tell('Bubo: We only display fish, bugs and fossils. Hoo.');
    if (this.donated.includes(item.id)) return this.tell(`Bubo: We already have a ${item.name.toLowerCase()}. Sell it, perhaps?`);
    this.pockets.splice(i, 1);
    if (this.selected >= this.pockets.length) this.selected = -1;
    this.donated.push(item.id);
    this.event = 'talk';
    return this.tell(`Bubo: A ${item.name.toLowerCase()}! Displayed with pride. ${this.donated.length} of ${this.museumTotal}.`);
  }
  place(i: number): string {
    if (this.screen !== 'home') return '';
    const item = this.pockets[i];
    if (!item || item.kind !== 'furniture') return this.tell('Only furniture goes in the burrow.');
    if (this.furniture.length >= HOME_ROOM[this.homeLevel]) return this.tell(`No room left in the ${this.homeName.toLowerCase()}. Pay off the loan to expand.`);
    this.pockets.splice(i, 1);
    if (this.selected >= this.pockets.length) this.selected = -1;
    this.furniture.push(item.id);
    this.event = 'dig';
    return this.tell(`Placed the ${item.name.toLowerCase()}.`);
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
    if (this.homeLevel < LOANS.length) { this.debt = LOANS[this.homeLevel]; return this.tell(`Paid off! Welcome to your ${this.homeName}. The next expansion is ${this.debt} raisins, whenever you like.`); }
    this.debt = 0;
    return this.tell(`Paid off! The ${this.homeName} is yours, free and clear. ${this.friendName} is beaming.`);
  }

  // ---- neighbours -------------------------------------------------------------
  private talk(v: Villager) {
    v.facing = ((this.facing + 2) % 4) as Facing;
    const first = !this.talked.includes(v.id);
    if (first) { this.talked.push(v.id); this.friendship[v.id] = Math.min(FRIEND_MAX, this.friendship[v.id] + 1); }
    const req = this.requests.find((r) => r.villager === v.id && !r.done);
    const line = v.id === 'friend' ? this.friendLine() : req ? `${this.pick(v.lines)} Oh, and I’ve been wanting a ${req.kind} all day.` : this.pick(v.lines);
    const options: Dialog['options'] = [];
    const sel = this.pockets[this.selected];
    if (req && sel && sel.kind === req.kind) options.push({ label: `Here, a ${sel.name.toLowerCase()}`, action: 'deliver' });
    else if (sel) options.push({ label: `Give the ${sel.name.toLowerCase()}`, action: 'gift' });
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
    this.pockets.splice(this.selected, 1);
    this.selected = -1;
    if (opt.action === 'deliver') {
      const req = this.requests.find((r) => r.villager === v.id)!;
      req.done = true;
      this.friendship[v.id] = Math.min(FRIEND_MAX, this.friendship[v.id] + 3);
      const foreign = FRUIT.filter((f) => f !== NATIVE_FRUIT);
      if (this.rng() < 0.5 && !this.full) { const f = this.pick(foreign); this.pockets.push(this.itemFor('fruit', f)); this.event = 'catch'; return this.tell(`${v.name}: Exactly what I wanted! Take this ${f}, they don’t grow here.`); }
      const reward = 300;
      this.raisins += reward;
      this.event = 'coin';
      return this.tell(`${v.name}: Exactly what I wanted! Here, ${reward} raisins.`);
    }
    const liked = item.kind === v.likes;
    this.friendship[v.id] = Math.min(FRIEND_MAX, this.friendship[v.id] + (liked ? 3 : 1));
    this.event = 'talk';
    return this.tell(liked ? `${v.name}: A ${item.name.toLowerCase()}? You remembered! I love these.` : `${v.name}: Oh, a ${item.name.toLowerCase()}. How thoughtful.`);
  }
  /** Award any goal newly met. Returns the goals completed this call. */
  checkGoals(): Goal[] {
    const done: Goal[] = [];
    for (const g of GOALS) {
      if (this.goals.includes(g.id) || !g.test(this)) continue;
      this.goals.push(g.id);
      this.raisins += g.reward;
      done.push(g);
    }
    if (done.length) { this.event = 'goal'; this.say(`Goal: ${done[done.length - 1].text}! +${done[done.length - 1].reward} raisins.`); }
    return done;
  }

  // ---- saves --------------------------------------------------------------------
  save(): Save {
    return {
      v: 1, hero: this.hero, seed: this.seed, rs: this.rs, day: this.day, clock: this.clock, x: this.x, y: this.y, facing: this.facing,
      raisins: this.raisins, debt: this.debt, homeLevel: this.homeLevel, tools: [...this.tools], tool: this.tool, pockets: this.pockets.map((p) => ({ ...p })), furniture: [...this.furniture],
      donated: [...this.donated], friendship: { ...this.friendship }, talked: [...this.talked], requests: this.requests.map((r) => ({ ...r })), goals: [...this.goals],
      trees: this.trees.map((t) => ({ ...t })), flowers: this.flowers.map((f) => ({ ...f })), rocks: this.rocks.map((r) => ({ ...r })), fossils: this.fossils.map((f) => ({ ...f })),
      stats: { ...this.stats }, caught: [...this.caught],
    };
  }
  static load(s: Save): Hollow {
    const g = new Hollow(s.hero, s.seed);
    Object.assign(g, {
      rs: s.rs, day: s.day, clock: s.clock, x: s.x, y: s.y, facing: s.facing, raisins: s.raisins, debt: s.debt, homeLevel: s.homeLevel, tools: [...s.tools], tool: s.tool,
      pockets: s.pockets.map((p) => ({ ...p })), furniture: [...s.furniture], donated: [...s.donated], friendship: { ...g.friendship, ...s.friendship }, talked: [...s.talked],
      requests: s.requests.map((r) => ({ ...r })), goals: [...s.goals], trees: s.trees.map((t) => ({ ...t })), flowers: s.flowers.map((f) => ({ ...f })), rocks: s.rocks.map((r) => ({ ...r })),
      fossils: s.fossils.map((f) => ({ ...f })), stats: { ...g.stats, ...s.stats }, caught: [...s.caught],
    });
    g.screen = 'world';
    g.dialog = null;
    return g;
  }
}
