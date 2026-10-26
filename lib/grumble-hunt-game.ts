/** Grumble Hunt rules. All distances are world units; all clocks are seconds. No DOM or Three.js. */
import { MIGHTY_ARMOUR, type ArmourSetId, SLOTS, POST_GAME_WEAPONS, WEAPON_TYPES, TIER_MULT, armourBonus, armourCost, weaponNode, type WeaponType, type Tier, type Branch, type ArmourPieceId, type Worn, DROPS, GATHER, ITEMS, MATERIALS, SNACKS, STORY, canAfford, cap, pay, rollCalm, rollShed, BEAST_ORDER, POST_GAME_BEASTS, POST_GAME_AREA, type AreaId, type ItemId, type MaterialId, type SnackId } from './grumble-hunt-content.js';
export type { AreaId, ItemId, MaterialId, SnackId };
export type HeroId = 'dora' | 'enzo';
export const BEAST_IDS = ['bristleback', 'puffwart', 'skreel', 'hornclack', 'frostmane', 'paddlepaw', 'rumblesnout'] as const;
export type BeastId = typeof BEAST_IDS[number];
/** The five story beasts, then the two that arrive after the story. */
export const STORY_BEASTS = BEAST_ORDER;
export { POST_GAME_BEASTS };
export const BEASTS: Record<BeastId, { name: string; title: string; grump: number; part: string; tip: string; color: string }> = {
  bristleback: { name: 'Bristleback', title: 'the Bristly Charger', grump: 420, part: 'tusks', tip: 'Step out of the orange lane. A charge into a tree or rock makes it dizzy!', color: '#b98050' },
  puffwart: { name: 'Puffwart', title: 'the Puffy Pond Toad', grump: 440, part: 'throat sac', tip: 'Roll past the tongue, leave the sleepy clouds, and bonk between hops.', color: '#8c9d4b' },
  skreel: { name: 'Skreel', title: 'the Swooping Sky Crest', grump: 400, part: 'crest', tip: 'Dodge the swoop, then get close while Skreel rests on the ground.', color: '#788ca6' },
  hornclack: { name: 'Hornclack', title: 'the Shell-Horned Wanderer', grump: 560, part: 'horn cap', tip: 'The front shell blocks bonks. Circle around to the sides or back.', color: '#8b919f' },
  paddlepaw: { name: 'Paddlepaw', title: 'the Belly-Sliding River Otter', grump: 700, part: 'pebble pouch', tip: 'Step out of the belly-slide lane and slip between the three splash lanes. A slide into a tree makes it dizzy!', color: '#8a6447' },
  rumblesnout: { name: 'Rumblesnout', title: 'the Burrowing Badger', grump: 760, part: 'pebble crown', tip: 'When it digs down, an orange circle shows where it will pop up. Step out, then bonk it while it shakes off the dirt.', color: '#8e9099' },
  frostmane: { name: 'Frostmane', title: 'the Snowy Mane of the Peak', grump: 840, part: 'mane tufts', tip: 'Watch for a pounce or a round mane-shake marker. Three moods, one lovely nap.', color: '#accfe7' },
};
export const DT = 1 / 60;
export const ARENA_RADIUS = 19;
export const TELEGRAPH = 0.9; // Every attack, including final-phase pounces, has at least this warning (less 0.1 s when Extra Grumpy).
export const GRUMPY_AT = 0.3; // Below this share of Grump a beast turns Extra Grumpy: 15% faster, warning 0.1 s sooner.
export const GRUMPY_PACE = 1.15;
export type WeatherKind = 'clear' | 'rain' | 'mist' | 'dust' | 'blizzard';
export const AREA_WEATHER: Record<AreaId, WeatherKind> = { paddock: 'clear', meadow: 'rain', marsh: 'rain', ridge: 'mist', hollow: 'dust', peak: 'blizzard' };
/** At full strength, weather shrinks how far a friend can see the beast to this share of SIGHT. */
export const WEATHER_SIGHT: Record<WeatherKind, number> = { clear: 1, rain: 0.75, mist: 0.6, dust: 0.55, blizzard: 0.5 };
export const WEATHER_RAMP = 3; // Seconds for weather to blow in or clear.
export const TURF_TIME = 1; // Two beasts square off this long, inside an orange circle, before a turf bonk.
export const TURF_REACH = 4.5; // The turf bonk bumps friends this close to the middle of the pair.
export const TURF_GRUMP = 0.1; // Share of starting Grump a turf bonk takes off the hunted beast, which is then dizzy.
/** The beast that may wander into each area's hunt once; it can't be bonked and leaves after a turf bonk. */
export const VISITORS: Record<AreaId, BeastId | null> = { paddock: null, meadow: 'puffwart', marsh: 'bristleback', ridge: 'hornclack', hollow: 'bristleback', peak: 'skreel' };
export const VINE_REACH = 9; // The grab-on vine reaches a beast this close that is no higher than 2.6.
export const VINE_COOLDOWN = 20;
export const CLING_TIME = 4; // Seconds a friend can hold on before letting go by themselves.
export const SOFT_TIME = 12; // Two tickles soften a beast this long: bonks take 20% more Grump and 50% more part.
export const YANK = 6; // A yank pulls the beast this far; a tree, rock or the edge on the way makes a wall bonk.
export const WALL_GRUMP = 0.03;
export const SLING_START = 5; // Pebbles at the start of a hunt; gathering adds 3 and every dizzy shakes 1 loose.
export const SLING_MAX = 12;
export const PEBBLE_POWER = 3; // A pebble takes this much Grump and adds 6 dizzy; three knock a flying Skreel down.
export const KNOCKDOWN_HITS = 3;
export const PEBBLE_DIZZY = 6;
export const TREE_BERRIES = 3; // Pebbles knock at most this many berries out of trees on a hunt, one per tree.
export const WEAK_SPOT = 1.15; // Bonks on a weak spot, the face (Hornclack: the sides, between its shell plates), take this much more Grump.
export type HazardKind = 'acorns' | 'bubbles' | 'rocks' | 'vines' | 'icicles';
/** One hazard per wild area: knock it with a pebble (or press F beside it) and it drops on whatever is inside its circle. */
export const AREA_HAZARD: Record<AreaId, HazardKind | null> = { paddock: null, meadow: 'acorns', marsh: 'bubbles', ridge: 'rocks', hollow: 'vines', peak: 'icicles' };
export const HAZARD_REACH = 3.2, HAZARD_WARN = 0.8, HAZARD_GRUMP = 0.08, HAZARD_DIZZY = 3, HAZARD_TOUCH = 1.3;
export const HAZARD_NAMES: Record<HazardKind, string> = { acorns: 'Acorn bough', bubbles: 'Bubble spring', rocks: 'Rock pile', vines: 'Sticky vines', icicles: 'Icicles' };
export const FINCHES = 3, FINCH_FLUFF = 5, FINCH_REACH = 1.4; // Fluff finches per wild area; each one caught adds Fluff and most Fluff for the hunt.
/** Each wild area is three zones joined by paths; the third is the beast's den. The paddock is one zone. */
export const ZONE_NAMES: Record<AreaId, string[]> = { paddock: ['The Paddock'], meadow: ['Clover Field', 'Bramble Dell', 'Sunny Knoll'], marsh: ['Lily Pools', 'Reed Maze', 'Misty Bog'], ridge: ['Pine Steps', 'Windy Ledge', 'High Saddle'], hollow: ['Red Dunes', 'Echo Canyon', 'Sandstone Den'], peak: ['Frost Gate', 'Icicle Run', 'Summit Bowl'] };
export const ZONE_AT = [0.7, 0.35]; // Below these shares of its Grump the beast wanders on from zone 1, then zone 2.
export const EXIT_REACH = 2.4; // Walk this close to the open path to follow the beast.
export const WANDER_GIVEUP = 12; // Seconds a wandering beast tries to reach the path before slipping away anyway.
/** Three J swings in rhythm make a string: each swing must start within COMBO_WINDOW seconds of the last one recovering, and the third is
 *  the tool's finisher: half again as strong, then a slower recovery. Slow tools add Dizzy, medium tools loosen parts twice as fast, fast tools bonk twice. */
export const MIGHTY_RHYTHM = 0.3, MIGHTY_FINISHER = 1.1, FULL_FLUFF = 1.15;
export const ARMOUR_PIECES: readonly ArmourPieceId[] = ([...BEAST_IDS, 'mighty'] as ArmourSetId[]).flatMap((id) => SLOTS.map((slot) => `${id}-${slot}` as ArmourPieceId));
export const COMBO_WINDOW = 0.6, FINISHER_POWER = 1.5, FINISHER_DIZZY = 20, FINISHER_RECOVERY = 1.3;
export const FINISHERS: Partial<Record<WeaponType, string>> = {
  hammer: 'Acorn Upswing', greatsword: 'Driftwood Drop', katana: 'Petal Spin', sword: 'Twig Twirl', claws: 'Pitter-Pat Flurry', horn: 'Gourd Encore', lance: 'Triple Poke',
  gunlance: 'Puffcap Pop', switchaxe: 'Spade Sweep', chargeblade: 'Seedpod Slam', glaive: 'Firefly Twirl', yoyo: 'Round the World', feather: 'Tickle Storm', pogo: 'Boing Bonk', umbrella: 'Brolly Swirl',
};
export const FINISHER_KIND: Record<'slow' | 'medium' | 'fast', string> = { slow: '+20 Dizzy', medium: 'parts loosen twice as fast', fast: 'bonks twice' };
/** Mighty beasts are quest-only, after the story and MIGHTY_AT other quests: MIGHTY_GRUMP times the Grump, twice the rare chance and one new
 *  move each, warned like every other attack. Rain drops orange circles round the leader, the fan sends three lanes, the spin is a wide circle. */
export const MIGHTY_GRUMP = 2, MIGHTY_AT = 3;
export const RAIN_REACH = 2.2, FAN_SPREAD = 0.55, FAN_REACH = 1.1, FAN_LENGTH = 11, SPIN_REACH = 6;
export const MIGHTY_MOVES = { bristleback: 'rush', puffwart: 'rain', skreel: 'fan', hornclack: 'spin', frostmane: 'rain', paddlepaw: 'spin', rumblesnout: 'rain' } as const;
export const MIGHTY_NAMES: Record<BeastId, string> = { bristleback: 'Double Dash', puffwart: 'Bubble Rain', skreel: 'Feather Fan', hornclack: 'Shell Spin', frostmane: 'Icicle Rain', paddlepaw: 'Whirlpool Spin', rumblesnout: 'Pebble Shower' };
/** Rumblesnout's burrow: it digs down under an orange circle on the leader, then pops up inside it. */
export const BURROW_REACH = 2.4;
/** Post-game armour skills: Paddlepaw's River Rest and Soft Landing, Rumblesnout's Pebble Pouch and Dizzy Dig. */
export const RIVER_REST = 1.25, SOFT_LANDING = 0.8, PEBBLE_POUCH = { start: 4, max: 16 }, DIZZY_DIG = 1.1;
export const ROAR_REACH = 7; // A roar makes friends this close cover their ears; a roll or a guard keeps them going.
export const INTRO_CARD = 3.2;
export const ROAR_TIME = 1.1; // Seconds a roar lasts; covered ears last 0.9 seconds.
export const TIRED_AT = 0.2; // Below this share of Grump a beast trudges home to its nest, once, and snoozes there.
export const SNOOZE = 8; // Seconds a beast snoozes in its nest unless a wake-up bonk (double Grump) comes first.
const NEST_REGAIN = 0.08; // A full snooze restores at most this share of Grump.
export const SIGHT = 12; // Further than this, or behind a tree or rock, the beast is out of sight and Enzo sniffs out a trail.
export const ORDERS = ['close', 'bonk', 'gather'] as const;
export type BuddyOrder = typeof ORDERS[number];
export const ORDER_NAMES: Record<BuddyOrder, string> = { close: 'Stay close', bonk: 'Go bonk', gather: 'Gather' };
export const SAVE_KEY = 'grumble-hunt-v6';
export const V5_SAVE_KEY = 'grumble-hunt-v5';
export const V4_SAVE_KEY = 'grumble-hunt-v4';
export const V3_SAVE_KEY = 'grumble-hunt-v3';
export const V2_SAVE_KEY = 'grumble-hunt-v2';
/** Older saves are read only when the current save is absent. */
export const V1_SAVE_KEY = 'grumble-hunt-v1';
export const SPOTS = [
  { id: 'forge', name: 'Forge', x: -6, z: -3 },
  { id: 'board', name: 'Hunt board', x: 0, z: -5 },
  { id: 'book', name: 'Beast Book', x: 6, z: -3 },
  { id: 'pantry', name: 'Pantry', x: -6.5, z: 4 },
] as const;
/** Each spot's shopkeeper, standing clear of the building and its props. Walk up to one and press F to open their spot. */
export const VILLAGERS = {
  forge: { name: 'Bramble', x: -7.3, z: -0.9, face: 0 }, board: { name: 'Old Mossback', x: 2, z: -4.1, face: 0 },
  book: { name: 'Wren', x: 7.4, z: -0.9, face: 0 }, pantry: { name: 'Pip', x: -6.78, z: 5.75, face: 0.55 },
} as const;
const VILLAGER_RADIUS = 0.5, TALK_REACH = 2.2;
export const MATERIAL_IDS = Object.keys(MATERIALS) as MaterialId[];
export const ITEM_IDS = Object.keys(ITEMS) as ItemId[];
export const SNACK_IDS = Object.keys(SNACKS) as SnackId[];
/** Items that can go in the hunt ring; the hay bundle is only a snack ingredient. */
export const RING_ITEMS = ITEM_IDS.filter((id) => ITEMS[id].effect.kind !== 'ingredient');
export const RING_SIZE = 6;
export const DEFAULT_RING: readonly ItemId[] = ['fluffberry', 'big-fluffberry', 'sleepy-seed', 'dizzy-bell', 'sticky-sap', 'smoke-puffball'];
export const CAMP_BERRIES = 3; // Every hunt starts with at least this many fluffberries, free from camp.
export const GATHER_TIME = 1.2; // Seconds of standing still at a gathering spot.
export const GATHER_REACH = 1.8;
export const DIZZY_FULL = 100; // A big bonk or shot adds 50 Dizzy, a buddy's 30, a dizzy bell 40.
const TRAP_REACH = 1.6, SLEEPY_REACH = 10, BELL_REACH = 4;
/** Each hunt happens in its beast's story area, which sets the gathering spots. */
export const HUNT_AREA = Object.fromEntries(BEAST_IDS.map((id) => [id, STORY.find((c) => c.id > 0 && c.beast === id)?.area ?? POST_GAME_AREA[id]!])) as Record<BeastId, AreaId>;
/** Every turf bonk the free hunts can show, as `hunted+visitor`: the hunted beast meets its area's wandering visitor. The Beast Book keeps the ones seen. */
export const TURF_PAIRS = BEAST_IDS.flatMap((id) => { const v = VISITORS[HUNT_AREA[id]]; return v && v !== id ? [`${id}+${v}`] : []; });
const GATHERED: readonly MaterialId[] = ['berry', 'marsh-reed', 'glimmer-stone'];
/** What each beast sheds, pops off and gives at nap time. Gathered berries, reeds and glimmer stones are not beast materials. */
export const BEAST_MATERIALS = Object.fromEntries(BEAST_IDS.map((id) => {
  const d = DROPS[id], all = [d.shed.id, ...Object.values(d.parts), ...d.calm.common, d.calm.rare.id];
  return [id, MATERIAL_IDS.filter((m) => all.includes(m) && !GATHERED.includes(m))];
})) as Record<BeastId, MaterialId[]>;
/** Beast materials in common / rare / part order for the camp satchel. */
const RANK = { common: 0, rare: 1, part: 2 };
export const FORGE_MATERIALS = MATERIAL_IDS.filter((m) => !GATHERED.includes(m)).sort((a, b) => RANK[MATERIALS[a].rarity] - RANK[MATERIALS[b].rarity]);
/** The pop-off part's material. Skreel has no part in the drop tables, so its crest gives two sky feathers. */
const PART_DROP: Record<BeastId, { id: MaterialId; count: number }> = {
  bristleback: { id: DROPS.bristleback.parts.tusks, count: 1 }, puffwart: { id: DROPS.puffwart.parts.throat, count: 1 }, skreel: { id: 'sky-feather', count: 2 },
  hornclack: { id: DROPS.hornclack.parts.horn, count: 1 }, frostmane: { id: DROPS.frostmane.parts.mane, count: 1 },
  paddlepaw: { id: DROPS.paddlepaw.parts.pouch, count: 1 }, rumblesnout: { id: DROPS.rumblesnout.parts.crown, count: 2 },
};
/** The first build kept one count per beast; each carries over as that beast's shed material. */
const V1_MATERIAL: Record<BeastId, MaterialId> = Object.fromEntries(BEAST_IDS.map((id) => [id, DROPS[id].shed.id])) as Record<BeastId, MaterialId>;
export type SpotId = typeof SPOTS[number]['id'];
export type Vec = { x: number; z: number };
export type Input = { x: number; z: number; sprint: boolean; bonk: boolean; charge: boolean; roll: boolean; lock: boolean; previous: boolean; next: boolean; use: boolean; grab: boolean; sling: boolean };
export const NO_INPUT: Input = { x: 0, z: 0, sprint: false, bonk: false, charge: false, roll: false, lock: false, previous: false, next: false, use: false, grab: false, sling: false };
export type Pouch = Record<MaterialId | ItemId, number>;
/** `ring` is the items carried into a hunt, in ring order; `snack` is packed for the next hunt. */
export type StoryProgress = { chapter: number; scenesSeen: string[] };
/** best: the fastest normal (not Extra Grumpy) calm in whole tenths of a second, 0 before the first. */
export type BeastBook = Record<BeastId, { met: boolean; napped: number; partsBroken: string[]; best: number }>;
export type Profile = { charms: { levels: Record<CharmId, number>; worn: CharmId | null }; quests: Record<string, number>; stars: number; bountiesClaimed: number; variantNaps: Record<BeastId, number>; mightyBest: Record<BeastId, number>; turfPairs: string[]; totalPlops: number; story: StoryProgress; beastBook: BeastBook; bounties: { day: string; done: string[]; ready: string[] }; extraGrumpyUnlocked: boolean; hero: HeroId | null; weapons: Record<WeaponType, { tier: Tier; branch: Branch | null }>; equipped: Record<HeroId, WeaponType>; armour: { owned: ArmourPieceId[]; worn: Worn }; pouch: Pouch; ring: ItemId[]; snack: SnackId | null; naps: Record<BeastId, number>; won: boolean; hunts: number };
export type Hero = Vec & { finisher: boolean; face: number; fluff: number; maxFluff: number; speed: number; roll: number; rollX: number; rollZ: number; rollCd: number; invincible: number; charge: number; swing: number; heavy: boolean; landed: boolean; cooldown: number; slow: number; hidden: number; covered: number };
export type BeastState = 'burrow' | 'rush' | 'rain' | 'fan' | 'spin' | 'roam' | 'windup' | 'charge' | 'hop' | 'tongue' | 'cloud' | 'circle' | 'swoop' | 'sweep' | 'pounce' | 'shake' | 'roar' | 'turf' | 'grabbed' | 'yanked' | 'rest' | 'dizzy' | 'stuck' | 'trudge' | 'snooze' | 'wander' | 'nap';
export type Beast = Vec & { id: BeastId; grump: number; maxGrump: number; face: number; state: BeastState; t: number; duration: number; attack: BeastState; aim: Vec; start: Vec; dir: Vec; phase: number; cycle: number; dizzy: number; part: number; broken: boolean; bonks: number; flash: number; height: number; grumpy: boolean; drowsy: number; drowsySlow: number; home: 0 | 1 | 2; soft: number; zone: number; away: boolean; mighty: boolean; rush: number; marks: Vec[] };
export type Visitor = Vec & { id: BeastId; face: number; state: 'arrive' | 'face' | 'leave'; t: number; home: Vec };
export type Stone = Vec & { id: number; dx: number; dz: number; life: number };
export type Finch = Vec & { id: number; caught: boolean };
export type Hazard = Vec & { kind: HazardKind; state: 'ready' | 'warn' | 'spent'; t: number };
export type Obstacle = Vec & { r: number; kind: 'tree' | 'rock' | 'pine' };
export type Shot = Vec & { id: number; dx: number; dz: number; life: number; power: number; heavy: boolean; buddy: boolean; type: WeaponType; ammo: number; charge: number; hit: boolean; dizzyShare: number };
export type Drop = Vec & { id: number; material: MaterialId; count: number };
export type GatherSpot = Vec & { id: number; material: MaterialId; count: number; done: boolean };
export type Cloud = Vec & { life: number; r: number };
export type Fx = Vec & { id: number; kind: 'bonk' | 'dust' | 'dizzy' | 'berry' | 'part' | 'nap'; t: number; text: string; amount?: number; weak?: boolean; heavy?: boolean };
export type Ride = { riding: boolean; meter: number; fullBonks: number; phase: 'quiet' | 'warning' | 'buck'; timer: number; grip: boolean; used: number; left: number; pose: number; landing: number; plopped: number };
const freshRide = (): Ride => ({ riding: false, meter: 0, fullBonks: 0, phase: 'quiet', timer: 0, grip: false, used: 0, left: 0, pose: 0, landing: 0, plopped: 0 });
export type HuntEvent = { kind: 'quest' | 'finisher' | 'hop-on' | 'ride-bonk' | 'buck-warning' | 'shaken-off' | 'plop' | 'bonk' | 'dizzy' | 'berry' | 'part' | 'nap' | 'bump' | 'shoot' | 'item' | 'interact' | 'grumpy' | 'tired' | 'snooze' | 'intro' | 'roar' | 'covered' | 'weather' | 'visitor' | 'turf-warning' | 'turf' | 'vine' | 'cling' | 'soft' | 'yank' | 'wall' | 'sling' | 'plink' | 'fruit' | 'knockdown' | 'hazard-warning' | 'hazard' | 'finch' | 'wander' | 'away' | 'travel' | 'sniff' | 'order' | 'gather' | 'trap' | 'craft'; spot?: SpotId };
export type Mode = 'village' | 'hunt' | 'nap' | 'calm' | 'camp' | 'victory';
const countRecord = (): Record<BeastId, number> => ({ bristleback: 0, puffwart: 0, skreel: 0, hornclack: 0, frostmane: 0, paddlepaw: 0, rumblesnout: 0 });
const emptyPouch = () => Object.fromEntries([...MATERIAL_IDS, ...ITEM_IDS].map((id) => [id, 0])) as Pouch;
export const freshProfile = (): Profile => ({ charms: { levels: { clover: 0, acorn: 0, feather: 0 }, worn: null }, quests: {}, stars: 0, bountiesClaimed: 0, variantNaps: countRecord(), mightyBest: countRecord(), turfPairs: [], totalPlops: 0, story: { chapter: 0, scenesSeen: [] }, beastBook: Object.fromEntries(BEAST_IDS.map((id) => [id, { met: false, napped: 0, partsBroken: [], best: 0 }])) as unknown as BeastBook, bounties: { day: '', done: [], ready: [] }, extraGrumpyUnlocked: false, hero: null, weapons: Object.fromEntries(Object.keys(WEAPON_TYPES).map((id) => [id, { tier: 1, branch: null }])) as Profile['weapons'], equipped: { dora: 'hammer', enzo: 'bow' }, armour: { owned: [], worn: {} }, pouch: emptyPouch(), ring: [...DEFAULT_RING], snack: null, naps: countRecord(), won: false, hunts: 0 });
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
export const distance = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.z - b.z);
const faceTo = (a: Vec, b: Vec) => Math.atan2(-(b.z - a.z), b.x - a.x);
const direction = (a: Vec, b: Vec): Vec => { const d = distance(a, b) || 1; return { x: (b.x - a.x) / d, z: (b.z - a.z) / d }; };
const hero = (maxFluff = 100): Hero => ({ finisher: false, x: 0, z: 7, face: Math.PI / 2, fluff: maxFluff, maxFluff, speed: 0, roll: -1, rollX: 0, rollZ: -1, rollCd: 0, invincible: 0, charge: 0, swing: -1, heavy: false, landed: false, cooldown: 0, slow: 0, hidden: 0, covered: 0 });
const buddy = () => ({ x: -1.5, z: 8.5, face: Math.PI / 2, speed: 0, swing: -1, cooldown: 1, berry: 3, gather: 0, gatherT: 0, fluff: 100, maxFluff: 100 });
export const plural = (n: number, name: string) => n === 1 ? name : name.endsWith('y') ? `${name.slice(0, -1)}ies` : `${name}s`;
/** Distance from a point to a finite marked attack lane. */
export function laneDistance(p: Vec, a: Vec, b: Vec) {
  const x = b.x - a.x, z = b.z - a.z, d = x * x + z * z;
  const t = d ? clamp(((p.x - a.x) * x + (p.z - a.z) * z) / d, 0, 1) : 0;
  return Math.hypot(p.x - a.x - x * t, p.z - a.z - z * t);
}

/** Every story scene id, ending with the post-game epilogue and finale. */
export const SCENES = [...STORY.flatMap((c) => [`${c.id}-intro`, `${c.id}-outro`]), 'epilogue', 'finale'];
export const VARIANT_COLORS: Record<BeastId, string> = { bristleback: '#e4c278', puffwart: '#639dc8', skreel: '#b7a1d8', hornclack: '#dfb085', frostmane: '#e6adc7', paddlepaw: '#6fb0a8', rumblesnout: '#c79a6a' };
/** The meadow keeps its original seeded layout. Other areas use fixed, clear-centred tables. */
const areaTable = (kind: Obstacle['kind'], shift: number): Obstacle[] => [
  ...Array.from({ length: 18 }, (_, i) => { const a = i / 18 * Math.PI * 2; return { x: Math.cos(a) * 23, z: Math.sin(a) * 23, r: 0.8 + i % 3 * 0.15, kind }; }),
  { x: -9, z: 1 + shift, r: 0.8, kind }, { x: 9, z: -3 - shift, r: 0.9, kind },
  { x: -6 - shift, z: -9, r: 1.3, kind: 'rock' }, { x: 7, z: 8 + shift, r: 1.1, kind: 'rock' },
];
export const AREA_OBSTACLES: Record<AreaId, Obstacle[]> = { meadow: [], paddock: areaTable('tree', 0).slice(0, 18), marsh: areaTable('tree', 1), ridge: areaTable('pine', 2), hollow: areaTable('rock', 3), peak: areaTable('pine', 4) };
export type HuntFacts = { items: number; bumps: number; gathered: number; dizzies: number; napped: boolean; finishers: number; vines: number; knockdowns: number; turfs: number };
const freshFacts = (): HuntFacts => ({ items: 0, bumps: 0, gathered: 0, dizzies: 0, napped: false, finishers: 0, vines: 0, knockdowns: 0, turfs: 0 });
export const BOUNTY_BUNDLE = { berry: 3, 'bristle-tuft': 2, 'wart-pebble': 2 };
export const BOUNTIES: { id: string; title: string; check: (f: HuntFacts, b: Beast) => boolean }[] = [
  { id: 'no-items', title: 'Calm a beast without using items', check: (f) => f.napped && f.items === 0 },
  { id: 'tusks', title: 'Pop off both Bristleback tusks', check: (_, b) => b.id === 'bristleback' && b.broken },
  { id: 'sac', title: 'Boop a Puffwart throat sac loose', check: (_, b) => b.id === 'puffwart' && b.broken },
  { id: 'crest', title: 'Find a shed Skreel crest', check: (_, b) => b.id === 'skreel' && b.broken },
  { id: 'horn', title: 'Pop off a Hornclack horn cap', check: (_, b) => b.id === 'hornclack' && b.broken },
  { id: 'mane', title: 'Find a shed Frostmane mane tuft', check: (_, b) => b.id === 'frostmane' && b.broken },
  { id: 'gentle', title: 'Calm a beast without a bump', check: (f) => f.napped && f.bumps === 0 },
  { id: 'gather', title: 'Gather from three spots on a hunt', check: (f) => f.gathered >= 3 },
  { id: 'dizzy', title: 'Make three dizzy openings', check: (f) => f.dizzies >= 3 },
  { id: 'nap', title: 'Help any beast find a lovely nap', check: (f) => f.napped },
  { id: 'pouch', title: 'Boop loose a Paddlepaw pebble pouch', check: (_, b) => b.id === 'paddlepaw' && b.broken },
  { id: 'crown', title: 'Knock the pebble crown off a Rumblesnout', check: (_, b) => b.id === 'rumblesnout' && b.broken },
  { id: 'turf', title: 'Watch a turf bonk on a hunt', check: (f) => f.turfs > 0 },
];
/** Old Mossback's quests: one beast with a time limit or a side goal, or two beasts in a row (the second wanders in after the first naps).
 *  A quest opens with its chapter; finishing it pays stars and a bundle every time. Missing the limit or the goal still ends in a lovely nap. */
export type Quest = { mighty?: boolean; needs?: string[]; keepsake?: boolean; id: string; title: string; text: string; beasts: BeastId[]; chapter: number; stars: number; reward: Partial<Record<MaterialId, number>>; limit?: number; goal?: { text: string; miss: string; check: (f: HuntFacts) => boolean } };
export const QUESTS: readonly Quest[] = [
  { id: 'quick-bristleback', title: 'Speedy Snooze', text: 'Calm Bristleback within 90 seconds.', beasts: ['bristleback'], chapter: 2, stars: 1, reward: { 'bristle-tuft': 3, 'boar-hide': 1 }, limit: 90 },
  { id: 'no-vine-puffwart', title: 'Paws Only', text: 'Calm Puffwart without throwing the vine.', beasts: ['puffwart'], chapter: 3, stars: 1, reward: { 'wart-pebble': 3, 'marsh-reed': 2 }, goal: { text: 'No vine', miss: 'the vine came out', check: (f) => f.vines === 0 } },
  { id: 'double-meadow', title: 'Double Trouble', text: 'Calm Bristleback, then Puffwart wanders in for a second nap.', beasts: ['bristleback', 'puffwart'], chapter: 3, stars: 2, reward: { 'boar-hide': 2, 'wart-pebble': 2, 'curly-tail-tuft': 1 } },
  { id: 'skreel-knockdown', title: 'Feather Duster', text: 'Knock a flying Skreel down with pebbles, then calm it.', beasts: ['skreel'], chapter: 4, stars: 1, reward: { 'sky-feather': 3, 'owl-down': 1 }, goal: { text: 'One pebble knockdown', miss: 'no pebbles brought Skreel down', check: (f) => f.knockdowns >= 1 } },
  { id: 'finisher-hornclack', title: 'Shell Rhythm', text: 'Land three finishers with a melee tool, then calm Hornclack.', beasts: ['hornclack'], chapter: 5, stars: 2, reward: { 'shell-plate': 2, 'horn-chip': 2 }, goal: { text: 'Three finishers', miss: 'fewer than three finishers landed', check: (f) => f.finishers >= 3 } },
  { id: 'double-sky', title: 'Sky and Shell', text: 'Calm Skreel, then Hornclack wanders in for a second nap.', beasts: ['skreel', 'hornclack'], chapter: 5, stars: 2, reward: { 'owl-down': 1, 'shell-plate': 2, 'sky-feather': 2 } },
  { id: 'quick-frostmane', title: 'Frosty Sprint', text: 'Calm Frostmane within 4 minutes.', beasts: ['frostmane'], chapter: 6, stars: 2, reward: { 'frost-fur': 3, 'mane-lock': 1 }, limit: 240 },
  { id: 'gentle-frostmane', title: 'Featherlight', text: 'Calm Frostmane with three bumps or fewer.', beasts: ['frostmane'], chapter: 6, stars: 2, reward: { 'frost-fur': 2, 'glimmer-stone': 1 }, goal: { text: 'Three bumps or fewer', miss: 'more than three bumps', check: (f) => f.bumps <= 3 } },
  { id: 'peak-parade', title: 'Peak Parade', text: 'Calm Hornclack, then Frostmane wanders in for a second nap.', beasts: ['hornclack', 'frostmane'], chapter: 6, stars: 3, reward: { 'horn-chip': 2, 'frost-fur': 2, 'glimmer-stone': 1 } },
  { id: 'quick-paddlepaw', title: 'Slippery Sprint', text: 'Calm Paddlepaw within 3 minutes.', beasts: ['paddlepaw'], chapter: 6, stars: 2, reward: { 'otter-fluff': 3, 'river-stone': 1 }, limit: 180 },
  { id: 'splash-and-dig', title: 'Splash and Dig', text: 'Calm Rumblesnout, then Paddlepaw wanders in for a second nap.', beasts: ['rumblesnout', 'paddlepaw'], chapter: 6, stars: 3, reward: { 'stripe-fur': 2, 'otter-fluff': 2, 'geode-heart': 1 } },
  ...BEAST_IDS.map((id): Quest => ({ id: `mighty-${id}`, title: `Mighty ${BEASTS[id].name}`, text: `A Mighty ${BEASTS[id].name}: twice the Grump and a new move, the ${MIGHTY_NAMES[id]}.`, beasts: [id], chapter: 6, stars: 3, mighty: true,
    reward: ({ bristleback: { 'curly-tail-tuft': 2, 'tusk-shard': 1 }, puffwart: { 'cloud-wisp': 2, 'puff-sac': 1 }, skreel: { 'owl-down': 3, 'sky-feather': 2 }, hornclack: { 'horn-chip': 2, 'shell-plate': 2 }, frostmane: { 'glimmer-stone': 2, 'mane-lock': 2 }, paddlepaw: { 'river-pearl': 2, 'river-stone': 1 }, rumblesnout: { 'geode-heart': 2, 'crown-pebble': 1 } } as Record<BeastId, Quest['reward']>)[id] })),
  // The post-game finale: both Mighty river friends in a row, after each one's own Mighty quest. It pays the Best of Friends ribbon.
  { id: 'finale', title: 'Best of Friends', text: 'A Mighty Rumblesnout, then a Mighty Paddlepaw wanders in for a second nap.', beasts: ['rumblesnout', 'paddlepaw'], chapter: 6, stars: 5, mighty: true, keepsake: true, needs: ['mighty-rumblesnout', 'mighty-paddlepaw'], reward: { 'river-pearl': 1, 'geode-heart': 1, 'glimmer-stone': 2 } },
];
/** Bramble's charm tree: three charms, each made at level I and grown to II and III with beast materials and quest stars.
 *  One charm is worn at a time. Clover fills the nap reward, Acorn adds Fluff, Feather quickens rolls and the vine. */
export const CHARM_IDS = ['clover', 'acorn', 'feather'] as const;
export type CharmId = typeof CHARM_IDS[number];
export const CHARM_CHAPTER = 2;
export type CharmLevel = { text: string; cost: Partial<Record<MaterialId, number>>; stars: number; fluff: number; commons: number; rareRolls: number; roll: number; vine: number };
const level = (text: string, cost: CharmLevel['cost'], stars: number, effect: Partial<Pick<CharmLevel, 'fluff' | 'commons' | 'rareRolls' | 'roll' | 'vine'>>): CharmLevel => ({ text, cost, stars, fluff: 0, commons: 0, rareRolls: 0, roll: 0, vine: 0, ...effect });
export const CHARMS: Record<CharmId, { name: string; levels: CharmLevel[] }> = {
  clover: { name: 'Clover Charm', levels: [
    level('+1 common material at every nap', { berry: 4, 'bristle-tuft': 3 }, 0, { commons: 1 }),
    level('+1 common and one more rare roll at every nap', { 'curly-tail-tuft': 1, 'cloud-wisp': 1, 'sky-feather': 3 }, 2, { commons: 1, rareRolls: 1 }),
    level('+2 commons and one more rare roll at every nap', { 'glimmer-stone': 2, 'owl-down': 2, 'mane-lock': 2 }, 5, { commons: 2, rareRolls: 1 }),
  ] },
  acorn: { name: 'Acorn Charm', levels: [
    level('+10 Fluff', { 'boar-hide': 3, 'wart-pebble': 3 }, 0, { fluff: 10 }),
    level('+20 Fluff', { 'shell-plate': 3, 'horn-chip': 2 }, 2, { fluff: 20 }),
    level('+30 Fluff', { 'frost-fur': 4, 'mane-lock': 2, 'tusk-shard': 2 }, 5, { fluff: 30 }),
  ] },
  feather: { name: 'Feather Charm', levels: [
    level('Rolls recover 15% faster; the vine coils back 2 s sooner', { 'sky-feather': 3, 'marsh-reed': 3 }, 0, { roll: 0.15, vine: 2 }),
    level('Rolls recover 30% faster; the vine coils back 4 s sooner', { 'owl-down': 1, 'puff-sac': 2, 'sky-feather': 3 }, 2, { roll: 0.3, vine: 4 }),
    level('Rolls recover 45% faster; the vine coils back 6 s sooner', { 'glimmer-stone': 2, 'cloud-wisp': 2, 'frost-fur': 4 }, 5, { roll: 0.45, vine: 6 }),
  ] },
};
const NO_CHARM = level('', {}, 0, {});
function validDay(day: unknown): day is string {
  if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const year = Number(day.slice(0, 4)), month = Number(day.slice(5, 7)), date = Number(day.slice(8));
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return year > 0 && month >= 1 && month <= 12 && date >= 1 && date <= days[month - 1];
}
/** Date hashing uses a local generator, so viewing Wren's board never changes hunt randomness. */
export function dailyBounties(day: string) {
  let seed = 2166136261;
  for (const c of day) seed = Math.imul(seed ^ c.charCodeAt(0), 16777619) >>> 0;
  const pool = [...BOUNTIES];
  for (let i = pool.length - 1; i > 0; i--) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; const j = seed % (i + 1); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return pool.slice(0, 3);
}

export class HuntGame {
  storyHunt = false;
  huntChapter = -1;
  clearedChapter = -1;
  /** The quest under way (its beast step and why it was missed, if it was), and the last finished quest for the results. */
  quest: { id: string; step: number; failed: string } | null = null;
  questResult: { id: string; success: boolean; stars: number; why: string } | null = null;
  /** The last calm beat this beast's best time (shown on the results). */
  newRecord = false;
  /** The last calm's hunt time in tenths of a second. */
  lastTime = 0;
  variant = false;
  huntTime = 0;
  huntFacts = freshFacts();
  profile = freshProfile();
  mode: Mode = 'village';
  hero = hero();
  buddy = buddy();
  beast: Beast | null = null;
  obstacles: Obstacle[] = [];
  shots: Shot[] = [];
  drops: Drop[] = [];
  clouds: Cloud[] = [];
  fx: Fx[] = [];
  events: HuntEvent[] = [];
  /** The ring slot picked with Q/E. */
  item = 0;
  /** This hunt's area, gathering spots and the leader's gathering in progress (spot id and seconds). */
  area: AreaId = 'meadow';
  spots: GatherSpot[] = [];
  gathering: { spot: number; t: number } | null = null;
  /** Roars due: the hello roar when the beast first notices the friends, and another on turning Extra Grumpy. The first one shows the name card. */
  /** This hunt's weather loop, from the seed and hunt count rather than the generator: clear, then weather, then clear again. */
  weatherClear = 30;
  weatherSpell = 20;
  stormy = false;
  /** The grab-on vine: flying for 0.25 s, then holding on at the beast's head. */
  vine: { phase: 'fly' | 'cling'; t: number; pokes: number } | null = null;
  vineCd = 0;
  /** The pebble slinger: pebbles in the pouch, pebbles in flight, hits on a flying Skreel, and trees already shaken. */
  pebbles = SLING_START;
  stones: Stone[] = [];
  hazard: Hazard | null = null;
  finches: Finch[] = [];
  /** The zone the friends are in; the beast's own zone is on the beast. */
  zone = 0;
  /** This hunt's Grump shares for wandering on from each zone. */
  zoneAt: number[] = [];
  private baseObstacles: Obstacle[] = [];
  skyHits = 0;
  shaken: number[] = [];
  /** A visiting beast, the hunt time it arrives and the angle it comes from. */
  visitor: Visitor | null = null;
  visitAt = 50;
  visitAngle = 0;
  visited = false;
  roared = false;
  introduced = false;
  /** Hunt time of the name card, or -1; the page shows the card for INTRO_CARD seconds. */
  introAt = -1;
  /** Where a tired beast goes to snooze: the first clear spot around the edge, chosen without the random generator. */
  nest: Vec = { x: 0, z: 0 };
  /** One sticky sap trap on the ground at a time. */
  trap: Vec | null = null;
  /** The snack eaten for this hunt, and the materials from the last nap's reward. */
  snack: SnackId | null = null;
  reward: MaterialId[] = [];
  locked = false;
  /** What the buddy does; 'bonk' is the starting order. Held Tab plus Q/E changes it. */
  order: BuddyOrder = 'bonk';
  /** Seconds the sniff trail stays lit; out of sight for a second keeps it lit. */
  sniff = 0;
  unseen = 0;
  paused = false;
  time = 0;
  hitstop = 0;
  shake = 0;
  revision = 0;
  note = 'Welcome to Clover Camp. Pick a friend, then visit the hunt board.';
  lastHunt: BeastId = 'bristleback';
  seed: number;
  rng: number;
  private id = 0;
  private last: Input = { ...NO_INPUT };
  private resultTime = 0;
  private ordered = false;
  giggle = 0;
  fluffTime = 0;
  breath = 0;
  bounce = 0;
  float = 0;
  private featherFlurry = false;
  private bounceLanding = false;
  get isGuarding() { return this.guarding; }
  get airHeight() {
    if (this.bounce > 0) return Math.sin(this.bounce / 0.8 * Math.PI) * (this.perk('high-gather') ? 3 : 2.4);
    if (this.float > 0) return this.float / 0.46 * 0.6;
    return this.vault > 0 ? Math.sin(this.vault / 0.8 * Math.PI) : 0;
  }
  focus = 0;
  zoom = 5;
  bloom = false;
  pods = 0;
  ammo = 0;
  notes = 0;
  song = 0;
  glow = 0;
  hits = 0;
  buddyHits = 0;
  revived = false;
  extraRoll = true;
  private swingCharge = 0;
  /** Swings in the current string (0–2) and the seconds left to start the next one in rhythm. */
  combo = 0;
  comboTimer = 0;
  private partBoost = 1;
  private guarding = false;
  stamina = 100;
  guardTime = 0;
  counter = 0;
  poof = 0;
  flurry = 0;
  itemRecovery = 0;
  vault = 0;
  mist = 0;
  stickyHits = 0;
  shotsFired = 0;
  loaded = 6;
  glowColors = 0;
  songKind = 0;
  ride: Ride = freshRide();
  rides = 0;
  plops = 0;
  plopNote = '';
  private loop = false;
  private rideRelease = false;
  private nextDizzy = 0;
  private vaultHold = 0;
  private guardCombo = false;
  private chargeHold = 0;
  private buddyShots = 0;

  constructor(seed = 39) { this.seed = seed >>> 0; this.rng = this.seed; this.makeMeadow(); }
  random() { this.rng = (Math.imul(this.rng, 1664525) + 1013904223) >>> 0; return this.rng / 4294967296; }
  get heroId(): HeroId { return this.profile.hero ?? 'dora'; }
  get buddyId(): HeroId { return this.heroId === 'dora' ? 'enzo' : 'dora'; }
  get uniqueNaps() { return BEAST_IDS.filter((id) => this.profile.naps[id] > 0).length; }
  /** Beast materials counted by the camp satchel. */
  get materialTotal() { return FORGE_MATERIALS.reduce((n, id) => n + this.profile.pouch[id], 0); }
  /** The first chapter still waiting for a nap; six means the warm-wind ending. */
  get chapter() { return this.profile.story.chapter; }
  get story() { return this.profile.story; }
  feature(name: string) {
    return STORY.some((c) => c.unlocks.features?.includes(name) && this.chapter >= (c.id <= 1 || c.id === 5 ? c.id + 1 : c.id));
  }
  weaponGoal(type: WeaponType) {
    if (type === 'feather') return { goal: 'Complete 5 bounties', count: this.profile.bountiesClaimed, total: 5 };
    if (type === 'puffer') return { goal: 'Calm all five Extra Grumpy variants', count: STORY_BEASTS.filter((id) => this.profile.variantNaps[id] > 0).length, total: 5 };
    if (type === 'pogo') return { goal: 'Finish 10 Hop-on plops', count: this.profile.totalPlops, total: 10 };
    if (type === 'umbrella') return { goal: 'Break every part on all five beasts', count: STORY_BEASTS.filter((id) => this.profile.beastBook[id].partsBroken.includes(BEASTS[id].part)).length, total: 5 };
    return null;
  }
  weaponOpen(type: WeaponType) { const goal = this.weaponGoal(type); if (goal) return this.chapter === 6 && goal.count >= goal.total; return STORY.some((c) => c.unlocks.weapons?.includes(type) && this.chapter >= c.id); }
  /** The Mighty set needs the Mighty quests that each piece names. */
  mightyArmourOpen(slot: typeof SLOTS[number]) { return MIGHTY_ARMOUR[slot].quests.every((id) => (this.profile.quests[id] ?? 0) > 0); }
  armourOpen(id: ArmourSetId) { if (id === 'mighty') return this.feature('armour') && this.chapter >= 6 && SLOTS.some((slot) => this.mightyArmourOpen(slot)); return BEAST_IDS.includes(id) && this.feature('armour') && this.chapter >= (STORY.find((c) => c.id > 0 && c.beast === id)?.id ?? 6); }
  sceneSeen(id: string) { if (!SCENES.includes(id)) return false; if (!this.story.scenesSeen.includes(id)) { this.story.scenesSeen.push(id); this.revision++; } return true; }
  startChapter() { if (this.chapter > 5) return false; return this.startHunt(STORY[this.chapter].beast, false, true); }
  questOpen(id: string) { const q = QUESTS.find((x) => x.id === id); return !!q && !!this.profile.hero && this.chapter >= q.chapter && q.beasts.every((b) => this.freeHuntOpen(b)) && (!q.mighty || this.questsDone >= MIGHTY_AT) && (q.needs ?? []).every((n) => (this.profile.quests[n] ?? 0) > 0); }
  /** Different non-Mighty quests finished at least once. */
  get questsDone() { return QUESTS.filter((q) => !q.mighty && (this.profile.quests[q.id] ?? 0) > 0).length; }
  /** Takes a quest from the board: its first beast's hunt, in that beast's area. */
  startQuest(id: string) {
    const q = QUESTS.find((x) => x.id === id);
    if (!q || !this.questOpen(id) || !this.startHunt(q.beasts[0])) return false;
    this.quest = { id, step: 0, failed: '' }; if (q.beasts.length > 1) this.visited = true;
    if (q.mighty) { const b = this.beast!; b.mighty = true; b.grump = b.maxGrump = BEASTS[b.id].grump * MIGHTY_GRUMP; }
    this.note = `Quest: ${q.title}. ${q.text}`; this.revision++; return true;
  }
  private stepQuest() {
    const q = this.quest && QUESTS.find((x) => x.id === this.quest!.id);
    if (!q?.limit || this.quest!.failed || this.huntTime <= q.limit) return;
    this.quest!.failed = `the quest wanted a calm within ${q.limit} s`;
    this.note = `The quest timer ran out. No rush now: keep going for a lovely nap!`;
  }
  /** After the first beast of a two-beast quest naps, the second wanders in across the zone and roars hello. */
  private nextQuestBeast() {
    const q = this.quest && QUESTS.find((x) => x.id === this.quest!.id);
    if (!q || this.quest!.step + 1 >= q.beasts.length) return false;
    const id = q.beasts[++this.quest!.step], h = this.hero, r = Math.hypot(h.x, h.z) || 1;
    this.beast = this.newBeast(id, BEASTS[id].grump * (q.mighty ? MIGHTY_GRUMP : 1)); if (q.mighty) this.beast.mighty = true; this.beast.x = -h.x / r * 11; this.beast.z = -h.z / r * 11; this.beast.zone = this.zone;
    this.move(this.beast, 0, 0, 1.5); this.beast.face = faceTo(this.beast, h);
    this.mode = 'hunt'; this.lastHunt = id; this.profile.beastBook[id].met = true; this.roared = this.introduced = false; this.introAt = -1; this.locked = true;
    this.zoneAt = [...ZONE_AT]; this.nest = this.findNest(); this.clouds = []; this.shots = []; this.ride = freshRide(); this.resultTime = 0;
    this.events.push({ kind: 'visitor' }); this.note = `Here comes ${BEASTS[id].name} for the second nap! ${BEASTS[id].tip}`; this.revision++;
    return true;
  }
  private endQuest() {
    const q = QUESTS.find((x) => x.id === this.quest!.id)!;
    const why = this.quest!.failed || (q.goal && !q.goal.check(this.huntFacts) ? q.goal.miss : ''), success = !why;
    if (success) { this.profile.stars = Math.min(9999, this.profile.stars + q.stars); this.profile.quests[q.id] = Math.min(9999, (this.profile.quests[q.id] ?? 0) + 1); for (const [m, n] of Object.entries(q.reward)) this.gain(m as MaterialId, n!); this.events.push({ kind: 'quest' }); }
    this.questResult = { id: q.id, success, stars: success ? q.stars : 0, why }; this.quest = null;
  }
  setBountyDay(day: string) {
    if (!validDay(day)) return false;
    if (this.profile.bounties.day !== day) { this.profile.bounties = { day, done: [], ready: [] }; this.revision++; }
    return true;
  }
  get dailyBounties() { return validDay(this.profile.bounties.day) ? dailyBounties(this.profile.bounties.day) : []; }
  claimBounty(id: string) {
    const b = this.profile.bounties;
    if (!this.profile.extraGrumpyUnlocked || !this.dailyBounties.some((t) => t.id === id) || !b.ready.includes(id) || b.done.includes(id)) return false;
    for (const [material, count] of Object.entries(BOUNTY_BUNDLE)) this.gain(material as MaterialId, count);
    b.done.push(id); this.profile.bountiesClaimed = Math.min(999999, this.profile.bountiesClaimed + 1); this.revision++; return true;
  }
  get ring() { return this.profile.ring; }
  get ringItem(): ItemId | undefined { return this.profile.ring[this.item]; }
  /** A beast's materials in the pouch, for the Beast Book. */
  beastMaterials(id: BeastId) { return BEAST_MATERIALS[id].reduce((n, m) => n + this.profile.pouch[m], 0); }
  unlocked(id: BeastId) { return this.freeHuntOpen(id) || (this.chapter <= 5 && STORY[this.chapter].beast === id); }
  /** A free hunt opens once the beast is met in the story; the post-game beasts open with the ending. */
  freeHuntOpen(id: BeastId) { return this.profile.beastBook[id].met || POST_GAME_BEASTS.includes(id) && this.chapter >= 6; }
  /** Most pebbles in the sling: Rumblesnout's Pebble Pouch carries more. */
  get slingMax() { return this.skill('pebble-pouch') ? PEBBLE_POUCH.max : SLING_MAX; }
  chooseHero(id: HeroId) { if (this.mode !== 'village' || !['dora', 'enzo'].includes(id)) return false; this.profile.hero = id; this.note = `${id === 'dora' ? 'Dora' : 'Enzo'} leads the way. Visit the hunt board, Pantry, Forge, or Beast Book.`; this.revision++; return true; }
  weapon(id: HeroId = this.heroId) { return this.profile.equipped[id]; }
  node(type: WeaponType = this.weapon()) { const w = this.profile.weapons[type]; return weaponNode(`${type}-${w.tier}${w.branch ?? ''}`)!; }
  perk(id: string, buddy = false) { return this.node(this.weapon(buddy ? this.buddyId : this.heroId)).perks.find((p) => p.id === id)?.value ?? 0; }
  get armour() { return armourBonus(this.profile.armour.worn); }
  /** The worn charm's level, or no effect. */
  get charm(): CharmLevel { const id = this.profile.charms.worn, n = id ? this.profile.charms.levels[id] : 0; return id && n > 0 ? CHARMS[id].levels[n - 1] : NO_CHARM; }
  /** Most Fluff before snacks and finches: 100, armour and the worn charm. */
  get baseFluff() { return 100 + this.armour.fluff + this.charm.fluff; }
  canCharm(id: CharmId) {
    const n = this.profile.charms.levels[id], next = CHARMS[id]?.levels[n];
    return this.mode === 'village' && this.chapter >= CHARM_CHAPTER && !!next && this.profile.stars >= next.stars && canAfford(this.profile.pouch, next.cost);
  }
  /** Makes a charm, or grows it a level; the first charm made is worn straight away. */
  makeCharm(id: CharmId) {
    if (!this.canCharm(id)) return false;
    const c = this.profile.charms, next = CHARMS[id].levels[c.levels[id]];
    this.profile.pouch = pay(this.profile.pouch, next.cost) as Pouch; this.profile.stars -= next.stars; c.levels[id]++; c.worn ??= id;
    this.hero.maxFluff = this.baseFluff; this.hero.fluff = this.hero.maxFluff;
    this.note = `Bramble polishes the ${CHARMS[id].name} ${['I', 'II', 'III'][c.levels[id] - 1]}. Lovely!`; this.events.push({ kind: 'craft' }); this.revision++; return true;
  }
  /** Wears a made charm, or takes off the one worn. */
  wearCharm(id: CharmId) {
    const c = this.profile.charms; if (this.mode !== 'village' || !(c.levels[id] > 0)) return false;
    c.worn = c.worn === id ? null : id; this.hero.maxFluff = this.baseFluff; this.hero.fluff = this.hero.maxFluff; this.revision++; return true;
  }
  skill(id: string) { return this.armour.skills.some((s) => s.id === id); }
  ranged(id: HeroId = this.heroId) { return ['bow', 'lightbow', 'heavybow', 'wand'].includes(this.weapon(id)); }
  /** Tools that guard while K is held (the Charge Blade only in sword mode). */
  guardTool() { return ['lance', 'gunlance', 'greatsword', 'chargeblade', 'heavybow', 'umbrella'].includes(this.weapon()) && !(this.weapon() === 'chargeblade' && this.bloom); }
  /** How many charge levels the leader's held K builds: the hammer and bow have two (0.35 and 1.0),
   *  tools whose release gets bigger have one, and the rest just fire their signature on release. */
  chargeLevels() {
    const type = this.weapon();
    if (type === 'hammer' || type === 'bow') return 2;
    if (type === 'switchaxe') return this.bloom && this.focus >= 100 ? 1 : 0;
    if (type === 'puffer') return this.breath <= 0 ? 1 : 0;
    return ['greatsword', 'katana', 'sword', 'gunlance', 'yoyo', 'wand', 'claws', 'pogo'].includes(type) ? 1 : 0;
  }
  /** What holding K is doing right now, for the HUD and the scene. */
  hold(): { kind: 'none' | 'guard' | 'charge' | 'release'; level: number; levels: number; amount: number } {
    const amount = this.hero.charge, levels = this.chargeLevels();
    if (this.guarding) return { kind: 'guard', level: 0, levels: 0, amount };
    if (amount <= 0 || this.mode !== 'hunt') return { kind: 'none', level: 0, levels, amount: 0 };
    const level = levels === 2 && amount >= 1 ? 2 : levels > 0 && amount >= 0.35 ? 1 : 0;
    return { kind: levels ? 'charge' : 'release', level, levels, amount };
  }
  equip(type: WeaponType, who: HeroId = this.heroId) {
    if (this.mode !== 'village' || !Object.hasOwn(WEAPON_TYPES, type) || !['dora', 'enzo'].includes(who) || !this.weaponOpen(type)) return false;
    this.profile.equipped[who] = type; this.revision++; return true;
  }
  canForge(id: string) {
    const n = weaponNode(id);
    return !!n && this.mode === 'village' && this.feature('forge') && this.weaponOpen(n.type) && n.from === this.node(n.type).id && canAfford(this.profile.pouch, n.cost);
  }
  forge(id: string) {
    if (!this.canForge(id)) return false;
    const n = weaponNode(id)!; this.profile.pouch = pay(this.profile.pouch, n.cost) as Pouch;
    this.profile.weapons[n.type] = { tier: n.tier, branch: n.branch };
    this.note = `Bramble cheers! ${n.name} is ready.`; this.events.push({ kind: 'craft' }); this.revision++; return true;
  }
  canMakeArmour(piece: ArmourPieceId) {
    const [set, slot] = piece.split('-') as [ArmourSetId, typeof SLOTS[number]], mighty = set === 'mighty';
    return this.mode === 'village' && ARMOUR_PIECES.includes(piece) && this.armourOpen(set) && (!mighty || this.mightyArmourOpen(slot) && this.profile.stars >= MIGHTY_ARMOUR[slot].stars) && !this.profile.armour.owned.includes(piece) && canAfford(this.profile.pouch, armourCost(piece));
  }
  makeArmour(piece: ArmourPieceId) {
    if (!this.canMakeArmour(piece)) return false;
    this.profile.pouch = pay(this.profile.pouch, armourCost(piece)) as Pouch; this.profile.armour.owned.push(piece); this.revision++;
    if (piece.startsWith('mighty-')) { this.profile.stars -= MIGHTY_ARMOUR[piece.split('-')[1] as typeof SLOTS[number]].stars; this.note = 'Bramble hammers out a Mighty piece. It glows like the sun!'; this.events.push({ kind: 'craft' }); }
    return true;
  }
  wear(piece: ArmourPieceId) {
    if (this.mode !== 'village' || !this.profile.armour.owned.includes(piece)) return false;
    const slot = piece.split('-')[1] as typeof SLOTS[number];
    if (this.profile.armour.worn[slot] === piece) delete this.profile.armour.worn[slot]; else this.profile.armour.worn[slot] = piece;
    this.hero.maxFluff = this.baseFluff; this.hero.fluff = this.hero.maxFluff; this.revision++; return true;
  }
  canCraft(id: ItemId) { const it = ITEMS[id]; return this.mode === 'village' && !!it && this.feature('pantry') && this.chapter >= it.chapter && this.profile.pouch[id] < it.max && canAfford(this.profile.pouch, it.recipe); }
  /** Makes one batch of an item at the Pantry from its recipe. */
  craft(id: ItemId) {
    if (!this.canCraft(id)) return false;
    const it = ITEMS[id], p = pay(this.profile.pouch, it.recipe) as Pouch;
    p[id] = Math.min(it.max, p[id] + it.makes); this.profile.pouch = p;
    this.note = `${it.name} made! You have ${p[id]}.`; this.events.push({ kind: 'craft' }); this.revision++;
    return true;
  }
  canEat(id: SnackId) { const s = SNACKS[id]; return this.mode === 'village' && !!s && !this.profile.snack && this.feature('snacks') && this.chapter >= s.chapter && canAfford(this.profile.pouch, s.cost); }
  /** Packs one snack for the next hunt; it lasts that hunt only. */
  eatSnack(id: SnackId) {
    if (!this.canEat(id)) return false;
    this.profile.pouch = pay(this.profile.pouch, SNACKS[id].cost) as Pouch; this.profile.snack = id;
    this.note = `${SNACKS[id].name} packed for your next hunt!`; this.events.push({ kind: 'craft' }); this.revision++;
    return true;
  }
  /** Puts an item in the hunt ring or takes it out, keeping the ring's order, at least one item and at most six. */
  toggleRing(id: ItemId) {
    if (this.mode !== 'village' || !RING_ITEMS.includes(id)) return false;
    const ring = this.profile.ring, inRing = ring.includes(id);
    if (inRing ? ring.length <= 1 : ring.length >= RING_SIZE) return false;
    this.profile.ring = RING_ITEMS.filter((r) => r === id ? !inRing : ring.includes(r)); this.item = 0; this.revision++;
    return true;
  }
  nearestSpot() { return SPOTS.find((s) => distance(this.hero, s) < 3 || distance(this.hero, VILLAGERS[s.id]) < TALK_REACH) ?? null; }
  /** The closest gathering spot within reach of the leader that still has something to gather. */
  nearestGather() { return this.mode === 'hunt' ? this.spots.find((s) => !s.done && distance(this.hero, s) < GATHER_REACH) ?? null : null; }
  clearInput() { this.last = { ...NO_INPUT }; this.hero.charge = 0; this.hero.speed = 0; }
  /** This hunt's gathering spots, clear of trees, rocks and each other. A chancy spot (the sparkling glimmer spot) may not appear. */
  private makeSpots() {
    this.spots = [];
    if (!this.feature('gathering')) return;
    for (const g of GATHER[this.area]) for (let i = 0; i < g.spots; i++) {
      const present = g.chance === undefined || this.random() < g.chance;
      let at: Vec | null = null;
      for (let tries = 0; tries < 40 && !at; tries++) {
        const a = this.random() * Math.PI * 2, r = 6 + this.random() * 9, c = { x: Math.cos(a) * r, z: Math.sin(a) * r };
        if (this.obstacles.every((o) => distance(c, o) > o.r + 1.6) && this.spots.every((s) => distance(c, s) > 3) && distance(c, { x: 0, z: 7 }) > 3 && distance(c, { x: 0, z: -3 }) > 4) at = c;
      }
      if (present && at) this.spots.push({ ...at, id: ++this.id, material: g.id, count: g.each, done: false });
    }
  }
  private makeMeadow() {
    this.obstacles = [];
    for (let i = 0; i < 26; i++) {
      const a = i / 26 * Math.PI * 2, r = 21 + this.random() * 5;
      this.obstacles.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, r: 0.6 + this.random() * 0.3, kind: 'tree' });
    }
    // Clear entry and centre; these in-arena obstacles are also boar dizzy opportunities.
    this.obstacles.push({ x: -9, z: 1, r: 0.8, kind: 'tree' }, { x: 9, z: -3, r: 0.9, kind: 'tree' }, { x: -6, z: -9, r: 1.3, kind: 'rock' }, { x: 7, z: 8, r: 1.1, kind: 'rock' });
  }
  private makeArea() {
    if (this.area === 'meadow') { this.makeMeadow(); return; }
    this.obstacles = AREA_OBSTACLES[this.area].map((o) => ({ ...o }));
  }
  /** This hunt's hazard, from a seed hash (no rng): partway out, clear of trees, rocks, spots and the nest. */
  private placeHazard(): Hazard | null {
    const kind = this.huntChapter === 0 ? null : AREA_HAZARD[this.area]; if (!kind) return null;
    const h = Math.imul(this.seed ^ Math.imul(this.profile.hunts + 7 + this.zone * 101, 2246822519), 1664525) + 1013904223 >>> 0, turn = h % 628 / 100;
    for (let r = 10; r < ARENA_RADIUS - 5; r += 1.5) for (let k = 0; k < 12; k++) {
      const a = turn + k * Math.PI / 6, p = { x: Math.cos(a) * r, z: Math.sin(a) * r };
      if (this.obstacles.every((o) => distance(p, o) > o.r + HAZARD_REACH) && this.spots.every((s) => distance(p, s) > HAZARD_REACH) && distance(p, this.nest) > HAZARD_REACH + 2) return { kind, ...p, state: 'ready', t: 0 };
    }
    return null;
  }
  get zones() { return this.mode === 'village' || this.huntChapter === 0 ? 1 : ZONE_NAMES[this.area].length; }
  get zoneName() { return ZONE_NAMES[this.area][Math.min(this.zone, ZONE_NAMES[this.area].length - 1)]; }
  /** The open paths out of this zone: on to the next zone at the far (north) edge, back at the near (south) edge. */
  exits(): (Vec & { to: number })[] {
    const r = ARENA_RADIUS - 1.2, out: (Vec & { to: number })[] = [];
    if (this.zone < this.zones - 1) out.push({ x: 0, z: -r, to: this.zone + 1 });
    if (this.zone > 0) out.push({ x: 0, z: r, to: this.zone - 1 });
    return out;
  }
  exitTo(zone: number) { return this.exits().find((e) => e.to === (zone > this.zone ? this.zone + 1 : this.zone - 1)) ?? null; }
  /** Each zone turns the area's inner trees and rocks to a new spot, and leaves gaps in the ring of trees for its paths. */
  private layoutZone() {
    const k = this.zone, gaps = this.exits().map((e) => Math.atan2(e.z, e.x));
    this.obstacles = this.baseObstacles.flatMap((o) => {
      const r = Math.hypot(o.x, o.z), a = Math.atan2(o.z, o.x);
      if (r > ARENA_RADIUS) return gaps.some((g) => Math.abs(Math.atan2(Math.sin(a - g), Math.cos(a - g))) < 0.32) ? [] : [{ ...o }];
      if (k === 0) return [{ ...o }];
      const t = k === 1 ? a + 2.3 : Math.PI - a + 1.1;
      return [{ ...o, x: Math.cos(t) * r, z: Math.sin(t) * r }];
    });
  }
  /** Following the beast down a path into the next zone, with its own spots, nest, hazard and finches. */
  private travel(to: number) {
    const b = this.beast!, h = this.hero, from = this.zone;
    this.collect(true);
    if (this.trap) { const sap = (Object.keys(ITEMS) as ItemId[]).find((id) => ITEMS[id].effect.kind === 'trap'); if (sap) this.gain(sap, 1); this.trap = null; }
    this.zone = to; this.layoutZone(); this.makeSpots(); this.shaken = []; this.nest = this.findNest(); this.hazard = this.placeHazard(); this.finches = this.placeFinches();
    const back = to > from ? 1 : -1, edge = ARENA_RADIUS - 4.5;
    h.x = 0; h.z = edge * back; h.face = back > 0 ? Math.PI / 2 : -Math.PI / 2; h.invincible = Math.max(h.invincible, 1.5); h.roll = -1; h.swing = -1; h.charge = 0;
    this.buddy.x = -1.5; this.buddy.z = (edge + 1.5) * back; this.buddy.swing = -1;
    b.away = false; b.zone = to; b.x = 0; b.z = -3 * back; b.height = 0; b.state = 'rest'; b.t = 0; b.duration = 1.2; b.face = faceTo(b, h);
    this.shots = []; this.stones = []; this.clouds = []; this.drops = []; this.vine = null; this.gathering = null; this.guarding = false; this.chargeHold = 0;
    if (this.visitor) { this.visitor = null; this.visited = true; }
    this.unseen = 0; this.sniff = 0; this.events.push({ kind: 'travel' }); this.revision++;
    this.note = `Zone ${to + 1} · ${this.zoneName}. There's ${BEASTS[b.id].name}!`;
  }
  /** Fluff finches perch round the arena, from a seed hash (no rng), clear of obstacles, spots, the nest and the hazard. */
  private placeFinches(): Finch[] {
    if (this.huntChapter === 0 || this.area === 'paddock') return [];
    let h = Math.imul(this.seed ^ Math.imul(this.profile.hunts + 11 + this.zone * 101, 3266489917), 1664525) + 1013904223 >>> 0; const out: Finch[] = [];
    for (let tries = 0; tries < 60 && out.length < FINCHES; tries++) {
      h = Math.imul(h, 1664525) + 1013904223 >>> 0; const a = h % 628 / 100; h = Math.imul(h, 1664525) + 1013904223 >>> 0; const r = 8 + h % 1000 / 1000 * (ARENA_RADIUS - 12), p = { x: Math.cos(a) * r, z: Math.sin(a) * r };
      const clear = (q: Vec, d: number) => distance(p, q) > d;
      if (this.obstacles.every((o) => clear(o, o.r + 1.5)) && this.spots.every((q) => clear(q, 2.5)) && clear(this.nest, 3.5) && (!this.hazard || clear(this.hazard, 4)) && out.every((q) => clear(q, 8))) out.push({ id: out.length, ...p, caught: false });
    }
    return out;
  }
  private stepFinches() {
    const h = this.hero; if (this.mode !== 'hunt' || this.ride.riding) return;
    for (const f of this.finches) {
      if (f.caught || distance(h, f) > FINCH_REACH) continue;
      f.caught = true; h.maxFluff += FINCH_FLUFF; h.fluff = Math.min(h.maxFluff, h.fluff + FINCH_FLUFF); this.events.push({ kind: 'finch' }); this.effect('berry', f, `+${FINCH_FLUFF} Fluff`);
      const left = this.finches.filter((q) => !q.caught).length;
      this.note = `A fluff finch! +${FINCH_FLUFF} Fluff for this hunt.${left ? ` ${left} more ${left === 1 ? 'is' : 'are'} about.` : ' That was the last one here.'}`;
    }
  }
  /** Knock the hazard: an orange circle warns for HAZARD_WARN seconds, then it drops on everything inside. */
  private trip() {
    const z = this.hazard; if (!z || z.state !== 'ready' || this.mode !== 'hunt') return false;
    z.state = 'warn'; z.t = 0; this.events.push({ kind: 'hazard-warning' }); this.note = `${HAZARD_NAMES[z.kind]} wobble! Out of the orange circle, and lead the beast in.`;
    return true;
  }
  private stepHazard(dt: number) {
    const z = this.hazard, b = this.beast; if (!z || z.state !== 'warn') return;
    z.t += dt; if (z.t < HAZARD_WARN) return;
    z.state = 'spent'; this.events.push({ kind: 'hazard' }); this.shake = Math.max(this.shake, 0.35); this.effect('dust', z, HAZARD_NAMES[z.kind] + '!');
    if (distance(this.hero, z) < HAZARD_REACH) this.bumpHero(10, z);
    if (!b || this.mode !== 'hunt' || distance(b, z) >= HAZARD_REACH + 0.8 || b.height > 1.5 && b.id === 'skreel' && z.kind !== 'bubbles') { this.note = `${HAZARD_NAMES[z.kind]} missed. Lead the beast in next hunt!`; return; }
    b.grump = Math.max(1, b.grump - b.maxGrump * HAZARD_GRUMP); b.flash = 0.18; b.height = 0; this.effect('bonk', b, 'Bonk!', { amount: b.maxGrump * HAZARD_GRUMP, weak: true, heavy: true }); this.moods(b);
    if (this.mode !== 'hunt') return;
    this.makeDizzy(HAZARD_DIZZY); this.note = z.kind === 'vines' ? `Tangled in sticky vines! ${BEASTS[b.id].name} is stuck. Big bonks welcome!` : `${HAZARD_NAMES[z.kind]} bonk! ${BEASTS[b.id].name} is dizzy. Big bonks welcome!`;
  }
  private findNest(): Vec {
    const limit = (this.area === 'paddock' ? 12 : ARENA_RADIUS) - 4, turn = BEAST_IDS.indexOf(this.beast?.id ?? 'bristleback') * 1.3;
    for (let r = limit; r > 4; r -= 2) for (let k = 0; k < 16; k++) {
      const a = turn + k * Math.PI / 8, p = { x: Math.cos(a) * r, z: Math.sin(a) * r };
      if (this.obstacles.every((o) => distance(p, o) > o.r + 2.4) && this.spots.every((s) => distance(p, s) > 2)) return p;
    }
    return { x: 0, z: -limit };
  }
  private resetWeapons() {
    this.giggle = 0; this.fluffTime = 0; this.breath = 0; this.bounce = 0; this.float = 0; this.featherFlurry = false; this.bounceLanding = false;
    this.bloom = false; this.ammo = 0; this.songKind = 0; this.swingCharge = 0;
    this.combo = 0; this.comboTimer = 0; this.partBoost = 1; this.focus = 0; this.zoom = 5; this.pods = 0; this.notes = 0; this.song = 0; this.glow = 0; this.hits = 0; this.buddyHits = 0; this.revived = false; this.extraRoll = true; this.stamina = 100; this.guardTime = 0; this.counter = 0; this.poof = 0; this.flurry = 0; this.itemRecovery = 0; this.vault = 0; this.mist = 0; this.stickyHits = 0; this.shotsFired = 0; this.loaded = 6; this.glowColors = 0; this.ride = freshRide(); this.loop = false; this.rideRelease = false; this.plopNote = '';
    this.buddy.cooldown = 0; this.buddy.swing = -1;
    this.chargeHold = 0; this.hero.cooldown = 0; this.hero.heavy = false; this.hero.landed = false;
    this.guarding = false; this.nextDizzy = 0; this.vaultHold = 0; this.guardCombo = false; this.buddyShots = 0; this.hero.charge = 0; this.hero.swing = -1;
  }
  private weaponScale(type: WeaponType) {
    const tier = this.node(type).tier;
    // Old levels used 35% hammer and 32% bow steps; preserve migrated power.
    if (tier <= 3 && (type === 'hammer' || type === 'bow')) {
      const step = type === 'hammer' ? 0.35 : 0.32;
      return Math.max(TIER_MULT[tier], 1 + (tier - 1) * step);
    }
    return TIER_MULT[tier];
  }
  startHunt(id: BeastId, variant = false, story = false) {
    if (!BEAST_IDS.includes(id) || !this.profile.hero || !['village', 'camp', 'calm', 'victory'].includes(this.mode) || !this.unlocked(id)) return false;
    if (variant && !this.profile.extraGrumpyUnlocked) return false;
    this.storyHunt = story || this.chapter === 0; this.huntChapter = this.storyHunt ? this.chapter : -1; this.variant = variant; this.huntTime = 0; this.huntFacts = freshFacts();
    this.profile.beastBook[id].met = true;
    this.resetWeapons();
    this.snack = this.profile.snack; this.profile.snack = null;
    this.lastHunt = id; this.mode = 'hunt'; this.hero = hero(this.baseFluff + (this.snack ? SNACKS[this.snack].effect.maxFluff ?? 0 : 0)); this.buddy = buddy();
    this.beast = this.newBeast(id, this.huntChapter === 0 ? 40 : BEASTS[id].grump * (variant ? 1.6 : 1)); this.quest = null; this.questResult = null;
    this.shots = []; this.drops = []; this.clouds = []; this.fx = []; this.item = 0; this.sniff = 0; this.unseen = 0; this.locked = true; this.paused = false; this.hitstop = 0; this.shake = 0; this.last = { ...NO_INPUT }; this.resultTime = 0;
    this.roared = this.introduced = this.huntChapter === 0; this.introAt = -1; this.vine = null; this.vineCd = 0; this.pebbles = SLING_START + (this.skill('pebble-pouch') ? PEBBLE_POUCH.start : 0); this.stones = []; this.skyHits = 0; this.shaken = []; this.gathering = null; this.trap = null; this.reward = []; this.area = this.huntChapter >= 0 ? STORY[this.huntChapter].area : HUNT_AREA[id];
    this.profile.pouch.fluffberry = Math.max(this.profile.pouch.fluffberry, CAMP_BERRIES);
    this.profile.hunts++; this.zone = 0; this.zoneAt = [...ZONE_AT]; this.makeArea(); this.baseObstacles = this.obstacles; this.layoutZone(); this.makeSpots(); this.nest = this.findNest(); this.hazard = this.placeHazard(); this.finches = this.placeFinches(); this.planWeather(); this.revision++; this.note = BEASTS[id].tip;
    return true;
  }
  private newBeast(id: BeastId, grump: number): Beast {
    return { id, x: 0, z: -3, face: -Math.PI / 2, grump, maxGrump: grump, state: id === 'skreel' ? 'circle' : 'roam', t: 0, duration: 2.4, attack: 'charge', aim: { x: 0, z: 0 }, start: { x: 0, z: -3 }, dir: { x: 0, z: 1 }, phase: 1, cycle: 0, dizzy: 0, part: 0, broken: false, bonks: 0, flash: 0, height: 0, grumpy: false, drowsy: 0, drowsySlow: 0.3, home: 0, soft: 0, zone: 0, away: false, mighty: false, rush: 0, marks: [] };
  }
  returnVillage() {
    this.resetWeapons(); this.quest = null; this.questResult = null;
    this.area = 'meadow'; this.makeMeadow(); this.mode = 'village'; this.beast = null; this.hero = hero(this.baseFluff); this.hero.z = 4; this.buddy.x = -1.5; this.buddy.z = 5.5;
    this.drops = []; this.shots = []; this.stones = []; this.hazard = null; this.finches = []; this.clouds = []; this.fx = []; this.spots = []; this.gathering = null; this.trap = null; this.snack = null; this.sniff = 0; this.unseen = 0; this.locked = false; this.paused = false; this.last = { ...NO_INPUT }; this.revision++;
    this.note = 'Materials tucked away safely. Visit the Pantry, Forge, Beast Book, or hunt board.';
  }
  private effect(kind: Fx['kind'], at: Vec, text = '', hit?: Pick<Fx, 'amount' | 'weak' | 'heavy'>) { this.fx.push({ ...at, kind, id: ++this.id, t: 0, text, ...hit }); }
  private move(p: Vec, dx: number, dz: number, radius: number) {
    p.x += dx; p.z += dz;
    for (let pass = 0; pass < 2; pass++) {
      const obstacles = this.mode === 'village' ? [...this.obstacles, ...SPOTS.map((s) => ({ ...s, r: s.id === 'board' ? 1.3 : 1.8 })), ...SPOTS.map((s) => ({ ...VILLAGERS[s.id], r: VILLAGER_RADIUS }))] : this.obstacles;
      for (const o of obstacles) {
        const d = distance(p, o), r = o.r + radius;
        if (d < r) { const nx = d > 0.0001 ? (p.x - o.x) / d : 1, nz = d > 0.0001 ? (p.z - o.z) / d : 0; p.x = o.x + nx * r; p.z = o.z + nz * r; }
      }
      const d = Math.hypot(p.x, p.z), limit = (this.mode === 'hunt' && this.area === 'paddock' ? 12 : ARENA_RADIUS) - radius;
      if (d > limit) { p.x *= limit / d; p.z *= limit / d; }
    }
  }
  private drop(at: Vec, material: MaterialId, count: number) {
    this.drops.push({ id: ++this.id, x: at.x + (this.random() - 0.5) * 1.4, z: at.z + (this.random() - 0.5) * 1.4, material, count });
  }
  /** Adds to the pouch; materials stop at 99 and items at their carry limit. */
  private gain(id: MaterialId | ItemId, count: number) { this.profile.pouch[id] = Math.min(cap(id), this.profile.pouch[id] + count); this.revision++; }
  private collect(all = false, by: Vec = this.hero, reach = 2.6) {
    this.drops = this.drops.filter((d) => {
      if (!all && distance(by, d) > reach) return true;
      this.gain(d.material, d.count);
      this.effect('part', d, `+${d.count} ${plural(d.count, MATERIALS[d.material].name)}`); return false;
    });
  }
  /** Finishes gathering a spot, by the leader or the buddy. */
  private gather(spot: GatherSpot, by: Vec) {
    this.huntFacts.gathered++;
    spot.done = true; this.gain(spot.material, spot.count); this.pebbles = Math.min(this.slingMax, this.pebbles + 3);
    const name = plural(spot.count, MATERIALS[spot.material].name);
    this.effect('part', spot, `+${spot.count} ${name}`); this.events.push({ kind: 'gather' });
    this.note = `${by === this.hero ? 'You' : this.buddyId === 'dora' ? 'Dora' : 'Enzo'} gathered ${spot.count} ${name.toLowerCase()}.`;
  }
  /** Builds the dizzy meter; a full meter makes the beast dizzy. Berry Stack adds 10% to every hit. */
  private addDizzy(amount: number, hit = true) {
    const b = this.beast; if (!b || this.mode !== 'hunt') return;
    b.dizzy += amount * (hit && this.snack ? 1 + (SNACKS[this.snack].effect.dizzyBonus ?? 0) : 1);
    if (b.dizzy >= DIZZY_FULL) { this.makeDizzy(); b.dizzy = 0; }
  }
  /** A front-shell block is based on the actual bonk origin, including arrows and the buddy. */
  bonkBeast(power: number, heavy: boolean, from: Vec, buddy = false, dizzyShare = 1) {
    const b = this.beast, perk = (id: string) => this.perk(id, buddy);
    if (!b || this.mode !== 'hunt' || b.away || b.grump <= 0 || !Number.isFinite(power) || power <= 0) return false;
    const dir = direction(b, from), front = dir.x * Math.cos(b.face) + dir.z * -Math.sin(b.face);
    if (b.id === 'hornclack' && this.weapon(buddy ? this.buddyId : this.heroId) !== 'gunlance' && front > 0.45 && b.state !== 'dizzy') { this.effect('dust', b, 'Try the sides!'); this.note = 'The front shell is sturdy. Circle to the sides or back.'; return false; }
    if (b.height < -0.5) { this.effect('dust', b, 'Underground!'); return false; }
    if (b.id === 'skreel' && b.height > 1.8 && (buddy || this.vault <= 0 && !this.bounceLanding) && !this.ranged(buddy ? this.buddyId : this.heroId)) return false;
    const wasDizzy = b.state === 'dizzy', wasSnoozing = b.state === 'snooze';
    if (buddy && ++this.buddyHits % 10 === 0 && perk('warm-glow')) this.healFriends(10);
    if (!buddy) { this.hits++; if (this.weapon() !== 'switchaxe' || this.bloom) this.focus = Math.min(100, this.focus + 20 * (1 + perk('focus-fill') + perk('bloom-fill'))); if (!this.bloom) this.pods = Math.min(3 + perk('extra-pod'), this.pods + 1); this.notes++; this.zoom = Math.min(5, this.zoom + 0.5); if (perk('warm-glow') && this.hits % 10 === 0) this.healFriends(10); }
    const soft = b.soft > 0, weak = b.id === 'hornclack' ? Math.abs(front) < 0.3 : front > 0.45, amount = power * (wasDizzy ? 1.7 : wasSnoozing ? 2 : 1) * (soft ? 1.2 : 1) * (weak ? WEAK_SPOT : 1) * (!buddy && this.skill('full-fluff') && this.hero.fluff >= this.hero.maxFluff ? FULL_FLUFF : 1) * (!buddy && wasDizzy && this.skill('dizzy-dig') ? DIZZY_DIG : 1);
    b.grump = Math.max(0, b.grump - amount); b.flash = 0.18; b.bonks++; b.part += amount * (1 + perk('part-power') + perk('pop-parts')) * (soft ? 1.5 : 1) * (buddy ? 1 : this.partBoost);
    if (b.id === 'frostmane') {
      const next = b.grump < b.maxGrump / 3 ? 3 : b.grump < b.maxGrump * 2 / 3 ? 2 : 1;
      if (next > b.phase && b.grump > 0) { b.phase = next; this.note = `Frostmane mood ${next}: ${next === 2 ? 'watch for the icy mane shake' : 'quick pounces, with a warning before each one'}!`; }
    }
    this.moods(b);
    if (wasSnoozing && b.grump > 0) { b.state = 'rest'; b.t = 0; b.duration = 1.5; b.home = 2; this.note = 'Wake-up bonk! Double Grump off. Back to the hunt!'; }
    if (!buddy) { this.hitstop = heavy ? 0.11 : 0.08; this.shake = heavy ? 0.3 : 0.15; if (this.hero.hidden > 0) { this.hero.hidden = 0; this.note = 'Peekaboo! The bonk gave away your smoky hiding spot.'; } }
    this.events.push({ kind: 'bonk' }); this.effect('bonk', b, wasDizzy ? 'Big bonk!' : wasSnoozing ? 'Wake-up bonk!' : weak ? 'Weak spot!' : 'Bonk!', { amount, weak, heavy: heavy || wasDizzy || wasSnoozing || !buddy && this.hero.finisher && this.hero.swing >= 0 });
    const shed = rollShed(() => this.random(), b.id); if (shed) this.drop(b, shed, 1);
    if (!b.broken && b.part >= b.maxGrump * 0.32) { b.broken = true; this.rememberPart(); this.drop(b, PART_DROP[b.id].id, PART_DROP[b.id].count); this.events.push({ kind: 'part' }); this.effect('part', b, `${BEASTS[b.id].part} popped off!`); }
    if (!buddy && perk('sleepy-puff')) { this.mist = 2; this.nextDizzy = perk('sleepy-puff') / 2; }
    if (!buddy && heavy && this.swingCharge >= 1 && wasDizzy && perk('long-dizzy')) b.duration += perk('long-dizzy');
    if (b.grump > 0 && !wasDizzy && !wasSnoozing) {
      const type = this.weapon(buddy ? this.buddyId : this.heroId), base = WEAPON_TYPES[type];
      let dizzy = (buddy ? heavy ? 30 : ['hammer', 'bow'].includes(type) ? 0 : base.dizzy : ['hammer', 'bow'].includes(type) ? heavy ? 50 : 0 : base.dizzy) * this.weaponScale(type);
      if (!buddy && front > 0.45) dizzy = dizzy * (this.skill('hard-head') ? 1.2 : 1) + (type === 'heavybow' ? perk('pop-head') : 0);
      this.addDizzy(dizzy * dizzyShare);
    }

    const tool = this.weapon(buddy ? this.buddyId : this.heroId);
    // Giggle is the leader's own meter; a buddy's feather just bonks.
    if (tool === 'feather' && !buddy && b.grump > 0) {
      this.giggle += (wasDizzy ? 15 : 12) * (1 + perk('giggle-fill'));
      if (this.giggle >= 100) { this.giggle = 0; this.makeDizzy(3); this.effect('dizzy', b, 'Giggle!'); }
    }
    if (tool === 'puffer' && b.grump > 0) this.fluffTime = 3 + perk('fluff-time');
    if (b.grump <= 0 && !(this.ride.riding && this.ride.fullBonks === 3)) this.nap();
    return true;
  }
  /** Extra Grumpy below 30% Grump and tired below 20%, each announced once a hunt. */
  private moods(b: Beast) {
    if (!b.grumpy && b.grump > 0 && b.grump < b.maxGrump * GRUMPY_AT) {
      b.grumpy = true; this.roared = this.huntChapter === 0; this.events.push({ kind: 'grumpy' }); this.effect('dust', b, 'Extra Grumpy!');
      this.note = `${BEASTS[b.id].name} is Extra Grumpy! Steamy ears, quicker paws and quicker warnings. Nearly nap time.`;
    }
    if (!b.home && this.huntChapter !== 0 && b.grump > 0 && b.grump < b.maxGrump * TIRED_AT) {
      b.home = 1; this.events.push({ kind: 'tired' }); this.effect('dust', b, 'So sleepy…');
      this.note = `${BEASTS[b.id].name} is tired and trudging home to its nest. Follow it for a wake-up bonk!`;
    }
  }
  private nap() {
    const b = this.beast; if (!b || this.mode !== 'hunt') return;
    this.ride = freshRide();
    b.state = 'nap'; b.t = 0; b.height = 0; this.mode = 'nap'; this.resultTime = 0;
    const book = this.profile.beastBook[b.id]; book.napped++;
    // Best times count normal hunts, not the paddock calf, in tenths of a second.
    const tenths = Math.max(1, Math.round(this.huntTime * 10)); this.lastTime = tenths; const best = b.mighty ? this.profile.mightyBest[b.id] : book.best; this.newRecord = !this.variant && this.huntChapter !== 0 && !this.quest?.step && (best === 0 || tenths < best); if (this.newRecord) { if (b.mighty) this.profile.mightyBest[b.id] = tenths; else book.best = tenths; } if (this.variant) this.profile.variantNaps[b.id] = Math.min(999999, this.profile.variantNaps[b.id] + 1); this.huntFacts.napped = true;
    for (const task of this.dailyBounties) if (this.profile.extraGrumpyUnlocked && task.check(this.huntFacts, b) && !this.profile.bounties.ready.includes(task.id)) this.profile.bounties.ready.push(task.id);
    if (this.chapter <= 5 && STORY[this.chapter].beast === b.id && (this.chapter !== 0 || this.huntChapter === 0)) {
      this.clearedChapter = this.chapter; this.story.chapter++;
      while (this.chapter > 1 && this.chapter <= 5 && this.profile.naps[STORY[this.chapter].beast] > 0) this.story.chapter++;
      this.profile.extraGrumpyUnlocked = this.chapter > 5;
    }
    this.profile.naps[b.id]++; this.profile.won ||= b.id === 'frostmane';
    // Three commons and a rare roll (two with a Lucky Seed Bun); the pop-off part already dropped its own material.
    this.reward = rollCalm(() => this.random(), b.id, [], (this.snack ? SNACKS[this.snack].effect.bonusRareRolls ?? 0 : 0) + this.charm.rareRolls, this.variant || b.mighty ? 2 : 1);
    const common = DROPS[b.id].calm.common; for (let i = 0; i < this.charm.commons; i++) this.reward.splice(DROPS[b.id].calm.count + i, 0, common[Math.floor(this.random() * common.length)]);
    for (const m of this.reward) this.drop(b, m, 1);
    this.collect(true); this.gathering = null; this.revision++;
    this.events.push({ kind: 'nap' }); this.effect('nap', b, 'Calmed. Time for a nap!'); this.note = `${BEASTS[b.id].name} is going to the sanctuary for a lovely nap.`;
    if (this.quest && this.quest.step + 1 >= QUESTS.find((x) => x.id === this.quest!.id)!.beasts.length) this.endQuest();
  }
  private rememberPart() { const b = this.beast!; const parts = this.profile.beastBook[b.id].partsBroken; if (!parts.includes(BEASTS[b.id].part)) parts.push(BEASTS[b.id].part); }
  makeDizzy(seconds = 3.2) {
    const b = this.beast; if (!b || this.mode !== 'hunt' || b.state === 'nap') return;
    this.huntFacts.dizzies++;
    b.state = 'dizzy'; b.t = 0; b.duration = seconds; b.height = 0; b.rush = 0; this.pebbles = Math.min(this.slingMax, this.pebbles + 1);
    this.effect('dizzy', b, 'Dizzy!'); this.events.push({ kind: 'dizzy' }); this.note = 'Dizzy! A lovely opening for a big bonk.';
  }
  bumpHero(amount: number, from: Vec) {
    const h = this.hero;
    if (this.mode !== 'hunt' || this.ride.riding || h.invincible > 0) return false;
    if (h.roll >= 0 && h.roll < 0.32 * (this.skill('feather-step') ? 1.3 : 1)) { if (this.perk('roll-refill')) this.zoom = 5; return false; }
    if (this.weapon() === 'katana' && this.counter > 0) {
      h.invincible = 0.4; if (this.beast && distance(h, this.beast) < 3.65) this.weaponBonk(true); this.focus = this.perk('counter-focus') ? 100 : Math.min(100, this.focus + 30); return false;
    }
    if (this.guarding && this.beast && this.stamina > 0) {
      const d = direction(h, from), front = d.x * Math.cos(h.face) - d.z * Math.sin(h.face);
      if (this.weapon() === 'umbrella' || front > 0.3 || this.skill('shell-stance') || this.perk('side-guard')) {
        const perfect = this.guardTime < 0.25;
        if (perfect) this.addDizzy(this.perk('guard-dizzy')); if (this.perk('reflect-charge') && this.beast.state === 'charge') this.makeDizzy();
        const free = this.guardTime <= this.perk('free-guard') || this.perk('free-first-guard') && perfect;
        if (!free) this.stamina = Math.max(0, this.stamina - 15);
        if (this.weapon() === 'lance') this.counter = 0.35;
        if (perfect && this.perk('guard-pod')) this.pods = Math.min(3 + this.perk('extra-pod'), this.pods + 1);
        h.invincible = 0.3; return false;
      }
    }
    this.huntFacts.bumps++; this.combo = 0; this.comboTimer = 0;
    h.fluff = Math.max(0, h.fluff - amount * (this.skill('soft-landing') ? SOFT_LANDING : 1));
    if (h.fluff <= 0 && this.skill('warm-heart') && !this.revived) { this.revived = true; h.fluff = h.maxFluff / 2; this.effect('berry', h, 'Warm Heart! Back on your paws.'); } h.invincible = 1.4; this.gathering = null;
    const d = direction(from, h), push = this.skill('charge-guard') && this.beast?.state === 'charge' ? 0 : (this.skill('steady-paws') ? 0.9 : 1.5) * (this.song > 0 && this.songKind === 1 || this.glow > 0 && this.glowColors === 3 ? 0.5 : 1); this.move(h, d.x * push, d.z * push, 0.45); this.shake = 0.24;
    this.events.push({ kind: 'bump' }); this.note = 'A little bump! Roll through the orange warning or use a berry.';
    if (h.fluff <= 0) { this.collect(true); this.mode = 'camp'; this.quest = null; this.resetWeapons(); this.paused = false; this.locked = false; h.x = 0; h.z = 7; this.buddy.x = -1.5; this.buddy.z = 8.5; this.shots = []; this.note = 'Tuckered out. Back at camp, with every gathered material safe. Try again whenever you like.'; this.revision++; }
    return true;
  }
  /** Uses the picked ring item. Nothing is spent when it can't help yet, and the note says why. */
  useItem() {
    const id = this.ringItem, h = this.hero, b = this.beast;
    if (this.mode !== 'hunt' || !id) return false;
    const it = ITEMS[id], e = it.effect, refuse = (note: string) => { this.note = note; return false; };
    if (this.profile.pouch[id] <= 0) return refuse(`No ${plural(2, it.name).toLowerCase()} left. Make more at the Pantry.`);
    const near = (reach: number) => !!b && !b.away && b.state !== 'nap' && distance(h, b) <= reach;
    if (e.kind === 'heal') {
      if (h.fluff >= h.maxFluff) return refuse('Your Fluff is already full. Save that berry for later!');
      const fluff = Math.round(e.fluff * (this.skill('river-rest') ? RIVER_REST : 1));
      h.fluff = Math.min(h.maxFluff, h.fluff + fluff); this.effect('berry', h, `+${fluff} Fluff`); this.note = `${it.name}! +${fluff} Fluff.`;
    } else if (e.kind === 'drowsy') {
      if (!near(SLEEPY_REACH)) return refuse('Get within ten steps of the beast to toss a sleepy seed.');
      b!.drowsy = e.seconds; b!.drowsySlow = e.slow; this.effect('dust', b!, 'Drowsy…'); this.note = `Sleepy seed! The beast moves ${Math.round(e.slow * 100)}% slower for ${e.seconds} seconds.`;
    } else if (e.kind === 'dizzy') {
      if (!near(BELL_REACH) || b!.state === 'dizzy' || b!.state === 'stuck') return refuse('Ring the dizzy bell right beside the beast, when it isn’t dizzy or stuck already.');
      this.note = `Ding! The dizzy bell adds ${e.amount} Dizzy.`; this.effect('dizzy', b!, 'Ding!'); this.addDizzy(e.amount, false);
    } else if (e.kind === 'trap') {
      if (this.trap) return refuse('One sticky sap trap at a time. Lead the beast over the one on the ground!');
      this.trap = { x: h.x, z: h.z }; this.note = 'Sticky sap set! Lead the beast over it for a sticky four seconds.';
    } else if (e.kind === 'hide') {
      h.hidden = e.seconds; this.effect('dust', h, 'Poof!'); this.note = `Poof! Hidden in smoke for ${e.seconds} seconds. The beast loses track and wanders. A bonk gives you away.`;
    } else if (e.kind === 'track') {
      this.sniff = Math.max(this.sniff, e.seconds); this.note = `Enzo sniffs the pathfinder acorn. Glowing pawprints lead to the beast for ${e.seconds} seconds.`;
    } else return false;
    this.itemRecovery = 0.6 * (this.skill('deep-breath') ? 0.5 : 1) * (1 - this.perk('quick-items'));
    this.huntFacts.items++; this.profile.pouch[id]--; this.events.push({ kind: 'item' }); this.revision++;
    return true;
  }
  /** Steps the buddy's order through stay close, go bonk and gather. */
  commandBuddy(step: 1 | -1) {
    if (this.mode !== 'hunt' && this.mode !== 'village') return false;
    this.order = ORDERS[(ORDERS.indexOf(this.order) + step + ORDERS.length) % ORDERS.length];
    const name = this.buddyId === 'dora' ? 'Dora' : 'Enzo';
    this.note = this.order === 'close' ? `${name} stays close by your side.` : this.order === 'bonk' ? `${name} goes to bonk the beast.` : `${name} gathers any materials on the ground.`;
    this.events.push({ kind: 'order' }); this.revision++;
    return true;
  }
  /** The beast is in sight when it is within SIGHT and no tree or rock stands between it and the leader. */
  private planWeather() {
    let h = Math.imul(this.seed ^ Math.imul(this.profile.hunts + 1, 2654435761), 1664525) + 1013904223 >>> 0;
    this.weatherClear = 25 + h % 16; h = Math.imul(h, 1664525) + 1013904223 >>> 0; this.weatherSpell = 16 + h % 9; this.stormy = false;
    h = Math.imul(h, 1664525) + 1013904223 >>> 0; this.visitAt = 40 + h % 26; h = Math.imul(h, 1664525) + 1013904223 >>> 0; this.visitAngle = h % 628 / 100;
    this.visitor = null; this.visited = this.huntChapter === 0 || !VISITORS[this.area];
  }
  /** The weather now: its kind for this area and its strength from 0 (clear) to 1. */
  get weather(): { kind: WeatherKind; level: number } {
    const kind = this.mode === 'village' ? 'clear' : AREA_WEATHER[this.area];
    if (kind === 'clear') return { kind, level: 0 };
    const period = this.weatherClear + this.weatherSpell, p = this.huntTime % period;
    return { kind, level: p < this.weatherClear ? 0 : clamp(Math.min(p - this.weatherClear, period - p) / WEATHER_RAMP, 0, 1) };
  }
  get sight() { const w = this.weather; return SIGHT * (1 - (1 - WEATHER_SIGHT[w.kind]) * w.level); }
  inSight() {
    const b = this.beast; if (!b) return true; if (b.away) return false;
    return distance(this.hero, b) <= this.sight && !this.obstacles.some((o) => laneDistance(o, this.hero, b) < o.r);
  }
  /** Enzo's pawprint trail from the leader towards the beast, skipping prints under trees and rocks. */
  trail(): (Vec & { face: number })[] {
    const b = this.beast, h = this.hero; if (!b || this.sniff <= 0) return [];
    // Away in another zone, the trail leads to the path it took.
    const to = b.away ? this.exitTo(b.zone) ?? b : b, length = distance(h, to) + (b.away ? 2.5 : 0), d = direction(h, to), face = Math.atan2(-d.z, d.x), out: (Vec & { face: number })[] = [];
    for (let i = 0, at = 1.2; at < length - 2.5 && i < 16; i++, at += 1.1) {
      const side = i % 2 ? 0.2 : -0.2, p = { x: h.x + d.x * at - d.z * side, z: h.z + d.z * at + d.x * side, face };
      if (!this.obstacles.some((o) => distance(p, o) < o.r + 0.2)) out.push(p);
    }
    return out;
  }
  /** The landing is 2 units out from the leader, along the jump direction. */
  rockHop(x: number, z: number): Obstacle | null {
    const b = this.beast, h = this.hero, len = Math.hypot(x, z);
    if (this.mode !== 'hunt' || !b || this.ride.riding || this.ride.used >= 2 || !['dizzy', 'stuck'].includes(b.state) || len < 0.1) return null;
    const dx = x / len, dz = z / len, landing = { x: h.x + dx * 2, z: h.z + dz * 2 };
    if (distance(landing, b) > 3) return null;
    return this.obstacles.find((o) => o.kind === 'rock' && Math.abs(distance(h, o) - o.r) <= 0.6 && (h.x - o.x) * dx + (h.z - o.z) * dz > 0) ?? null;
  }
  /** Preview the outward jump towards the beast; the same rule checks the actual roll or vault. */
  hopRock() {
    const b = this.beast;
    return b ? this.rockHop(b.x - this.hero.x, b.z - this.hero.z) : null;
  }
  private startRide() {
    const b = this.beast, r = this.ride;
    if (!b || this.mode !== 'hunt' || r.riding || r.used >= 2 || !['dizzy', 'stuck'].includes(b.state) || b.duration <= b.t) return false;
    const extra = this.perk('long-hop'); b.duration += extra;
    this.ride = { ...freshRide(), riding: true, used: r.used + 1, left: 8 + extra, timer: 1.2 + this.random() * 0.4 };
    this.rides++; this.gathering = null; this.guarding = false; this.chargeHold = 0;
    this.hero.x = b.x; this.hero.z = b.z; this.hero.face = b.face; this.hero.roll = -1; this.hero.swing = -1; this.hero.charge = 0; this.hero.speed = 0;
    this.events.push({ kind: 'hop-on' }); this.effect('dust', b, 'Hop-on!'); this.note = 'Hop-on! Tap J to bonk, hold K through a buck, roll to hop off.';
    return true;
  }
  private rideBonk() {
    const b = this.beast, r = this.ride; if (!b || !r.riding) return;
    r.pose = 0.22; r.meter++;
    if (r.meter < 5) return;
    r.meter = 0; r.fullBonks++;
    const type = this.weapon(), power = type === 'hammer' ? 14 : type === 'bow' ? 9 : WEAPON_TYPES[type].bonk;
    const complete = r.fullBonks >= 3;
    this.bonkBeast(power * this.weaponScale(type), false, { x: b.x - Math.cos(b.face) * 2, z: b.z + Math.sin(b.face) * 2 });
    this.events.push({ kind: 'ride-bonk' }); this.effect('bonk', b, 'Boop!');
    if (complete && this.mode === 'hunt') { this.plop(); if (b.grump <= 0) this.nap(); }
    this.hitstop = 0; // Riding counts tap edges without a full-bonk pause swallowing the next tap.
    if (complete && this.mode === 'hunt') this.note = 'Plop! +30 Dizzy, two commons shed, and you hopped off.';
  }
  private buck() {
    const b = this.beast, r = this.ride; if (!b || !r.riding) return;
    r.phase = 'buck'; r.timer = b.id === 'frostmane' ? 0.5 : 0.3;
    if (!r.grip) this.endRide('shaken-off');
  }
  private endRide(reason: 'roll' | 'shaken-off' | 'time' | 'plop') {
    const b = this.beast, r = this.ride; if (!r.riding) return;
    this.rideRelease = true;
    r.riding = false; r.grip = false; r.left = 0; r.phase = 'quiet'; r.timer = 0; r.landing = 0.6;
    if (b) { this.hero.x = b.x; this.hero.z = b.z; this.move(this.hero, -Math.sin(b.face) * 2.8, -Math.cos(b.face) * 2.8, 0.45); }
    this.hero.invincible = Math.max(this.hero.invincible, 1); this.hero.swing = -1; this.hero.charge = 0;
    if (reason === 'shaken-off') { this.events.push({ kind: 'shaken-off' }); this.note = 'Soft landing! No Fluff lost. Hold K through the next buck.'; }
    else if (reason !== 'plop') this.note = 'Back on your paws!';
  }
  private plop() {
    const b = this.beast; if (!b || !this.ride.riding) return;
    // A seeded part-meter chance, separate from Grump and from the three full bonks.
    if (!b.broken && this.random() < Math.min(1, b.part / (b.maxGrump * 0.32))) {
      b.broken = true; this.rememberPart(); this.drop(b, PART_DROP[b.id].id, PART_DROP[b.id].count); this.events.push({ kind: 'part' }); this.effect('part', b, 'Part popped off!');
    }
    const common = DROPS[b.id].calm.common;
    for (let i = 0; i < 2; i++) this.drop({ x: b.x + 3, z: b.z }, common[Math.floor(this.random() * common.length)], 1);
    this.makeDizzy(); b.dizzy += 30; this.plops++; this.profile.totalPlops = Math.min(999999, this.profile.totalPlops + 1); this.revision++; this.ride.plopped = 2;
    this.plopNote = 'Hop-on plop: two commons shed, +30 Dizzy, and you hopped off.';
    this.endRide('plop'); this.events.push({ kind: 'plop' }); this.effect('dizzy', b, 'Plop!'); this.note = 'Plop! +30 Dizzy, two commons shed, and you hopped off.';
  }
  private stepRide(dt: number, input: Input) {
    const b = this.beast, r = this.ride;
    if (!b || this.mode !== 'hunt') { this.ride = freshRide(); return; }
    if (input.roll && !this.last.roll) { this.endRide('roll'); return; }
    r.grip = input.charge; r.left -= dt; b.t += dt; b.height = 0; b.flash = Math.max(0, b.flash - dt);
    if (!['dizzy', 'stuck'].includes(b.state) || b.t >= b.duration || r.left <= 0) { this.endRide('time'); return; }
    this.hero.x = b.x; this.hero.z = b.z; this.hero.face = b.face;
    r.timer -= dt;
    if (r.phase === 'quiet' && r.timer <= 0) { r.phase = 'warning'; r.timer = 0.65; this.events.push({ kind: 'buck-warning' }); this.note = 'Hold on! (K)'; }
    else if (r.phase === 'warning' && r.timer <= 0) this.buck();
    else if (r.phase === 'buck') {
      if (!r.grip) this.endRide('shaken-off');
      else if (r.timer <= 0) { r.phase = 'quiet'; r.timer = 1.6 + this.random() - (b.id === 'frostmane' ? 0.5 : 0.3) - 0.65; }
    }
    if (r.riding && input.bonk && !this.last.bonk) this.rideBonk();
  }
  private attack(heavy: boolean, loop = false) {
    const h = this.hero;
    if (h.cooldown > 0 || h.roll >= 0 || h.swing >= 0) return false;
    this.loop = loop; this.swingCharge = h.charge; h.finisher = false;
    h.heavy = heavy; h.swing = 0; h.landed = false; h.cooldown = this.weapon() === 'hammer' ? heavy ? 0.95 : 0.67 : this.weapon() === 'bow' ? heavy ? 0.8 : 0.43 : ({ slow: 0.85, medium: 0.55, fast: 0.3 }[WEAPON_TYPES[this.weapon()].speed]);
    if (this.weapon() === 'pogo' && !heavy) this.move(h, Math.cos(h.face) * 0.6, -Math.sin(h.face) * 0.6, 0.45);
    if (this.weapon() === 'claws' && this.zoom > 0) h.cooldown /= 1.3;
    if (this.weapon() === 'switchaxe' && this.bloom) h.cooldown *= 0.7;
    if (this.beast) h.face = faceTo(h, this.beast);
    return true;
  }
  /** A J swing. Melee tools count it towards a three-swing string; the third is the finisher. */
  private jab() {
    const h = this.hero, name = FINISHERS[this.weapon()];
    if (!this.attack(false) || !name) return;
    this.combo = this.comboTimer > 0 ? this.combo + 1 : 1;
    if (this.combo >= 3) { this.combo = 0; h.finisher = true; h.cooldown *= FINISHER_RECOVERY; }
    this.comboTimer = h.cooldown + COMBO_WINDOW + (this.skill('mighty-rhythm') ? MIGHTY_RHYTHM : 0);
  }
  private healFriends(amount: number) { if (amount <= 0) return; this.effect('berry', this.hero, `+${amount} Fluff for both friends`); this.hero.fluff = Math.min(this.hero.maxFluff, this.hero.fluff + amount); this.buddy.fluff = Math.min(this.buddy.maxFluff, this.buddy.fluff + amount); }
  private signature(charge: number) {
    const type = this.weapon(), b = this.beast;
    if (type === 'umbrella') return;
    if (type === 'feather') { this.attack(false); this.featherFlurry = this.hero.swing === 0; return; }
    if (type === 'puffer') { if (charge >= 0.35 && this.breath <= 0) { this.attack(true); if (this.hero.swing === 0) this.breath = 6; } return; }
    if (type === 'pogo') { if (charge >= 0.35 && this.bounce <= 0 && this.hero.cooldown <= 0) { this.bounce = 0.8; this.hero.cooldown = 1.1; this.hero.swing = -1; } return; }
    if (type === 'lightbow' || type === 'bow' && charge < 0.35) { this.ammo = (this.ammo + 1) % 3; return; }
    if (type === 'switchaxe' && this.bloom && this.focus >= 100 && charge >= 0.35) { this.attack(true); return; }
    if (type === 'sword') { this.attack(true); return; }
    if (type === 'switchaxe' || type === 'chargeblade') { this.bloom = !this.bloom; if (this.perk('switch-hit') && b && distance(this.hero, b) < 4) this.weaponBonk(false); return; }
    if (type === 'horn') { this.song = 10; this.songKind = this.notes % 3; if (b && this.songKind === 2) { if (b.drowsy > 0) this.addDizzy(this.perk('lullaby')); b.drowsy = 10 * (1 + this.perk('sleepy-song')); b.drowsySlow = 0.2; } this.healFriends(this.perk('song-heal')); return; }
    if (type === 'glaive') { this.glowColors = this.glowColors % 3 + 1; this.glow = 15 * (this.glowColors === 3 ? 2 : 1) * (1 + this.perk('long-glow')); this.hero.fluff = Math.min(this.hero.maxFluff, this.hero.fluff + this.perk('glow-heal')); return; }
    if (type === 'greatsword' && charge < 0.35) { this.hero.invincible = 0.25; this.move(this.hero, Math.cos(this.hero.face) * 0.6, -Math.sin(this.hero.face) * 0.6, 0.45); }
    if (type === 'katana' && charge < 0.35) { this.counter = 0.35; return; }
    if (type === 'lance' && (this.counter > 0 || b && ['charge', 'pounce', 'sweep'].includes(b.state) && b.t < 0.25)) { this.counter = 0; this.hero.cooldown = 0; this.attack(true); return; }
    if (type === 'lance') return;
    if (type === 'gunlance' && charge >= 0.35) { if (this.poof > 0) return; this.poof = 5 - this.perk('poof-cool'); }
    this.attack(charge >= 0.35, type === 'yoyo');
  }
  private weaponBonk(heavy: boolean) {
    const type = this.weapon(), b = this.beast; if (!b) return;
    if (type === 'yoyo' && this.loop) { this.loop = false; if (this.startRide()) return; }
    const front = direction(b, this.hero).x * Math.cos(b.face) - direction(b, this.hero).z * Math.sin(b.face);
    if (b.id === 'hornclack' && front > 0.45 && b.state !== 'dizzy' && type !== 'gunlance') { this.note = 'Try the sides!'; return; }
    if (b.height > 1.8 && this.vault <= 0 && !this.bounceLanding) return;
    let power = WEAPON_TYPES[type].bonk;
    if (type === 'hammer' && heavy && this.swingCharge >= 1 && direction(b, this.hero).x * Math.cos(b.face) - direction(b, this.hero).z * Math.sin(b.face) > .45) this.addDizzy(25);
    if (type === 'hammer') power = heavy ? this.swingCharge >= 1 ? 12 * 2.4 : 27 : 14;
    else if (heavy && !['feather', 'puffer', 'umbrella'].includes(type)) power *= type === 'greatsword' ? 3 : type === 'katana' && this.focus >= 40 ? 2 : 1.6;
    if (type === 'katana' && heavy) { this.focus = 0; this.mist = 2; this.nextDizzy = this.perk('sleepy-spin') / 2; if (b.state === 'dizzy' && this.perk('double-spin')) power *= 2; }
    if (type === 'switchaxe') { power *= this.bloom ? 1 : 1 + this.perk('spade-bonk'); if (heavy && this.focus >= 100) { power *= 2.5; this.focus = 0; this.addDizzy(this.perk('burst-puff')); } }
    if (type === 'chargeblade' && this.bloom) { power += this.pods * 4; if (this.pods >= 3 + this.perk('extra-pod') && this.perk('pod-dizzy')) this.makeDizzy(); this.pods = 0; }
    if (type === 'glaive') { if (this.glow > 0) power *= 1.15; if (this.vault > 0) { power *= 1 + this.perk('air-bonk'); this.addDizzy(this.perk('air-dizzy')); } }
    if (b.id === 'hornclack') power *= 1 + this.perk('shell-bonk');
    const bash = type === 'sword' && heavy && this.swingCharge < 0.35;
    if (bash) this.addDizzy(10 * (1 + this.perk('bash-dizzy')));
    if (type === 'sword' && heavy && !bash) power *= 1 + this.perk('leap-power');
    if (type === 'lance' && heavy) { power *= 2; this.addDizzy(15); }
    if (heavy && (this.perk('finish-break') || this.perk('boop-break') || bash && b.state === 'dizzy' && this.perk('bash-break'))) b.part = b.maxGrump;
    if (type === 'gunlance') { power *= b.id === 'hornclack' ? 1 + this.perk('poof-shell') : 1; this.addDizzy(this.perk('poof-dizzy')); if (heavy && this.perk('poof-head') && direction(b, this.hero).x * Math.cos(b.face) - direction(b, this.hero).z * Math.sin(b.face) > .45) this.makeDizzy(); }
    if (type === 'yoyo' && b.id === 'hornclack') this.addDizzy(this.perk('shell-dizzy'));
    if (type === 'lance' && (this.guarding || heavy)) power *= 1 + this.perk('guard-bonk');
    if (type === 'hammer' && heavy && this.swingCharge >= 1 && this.perk('shockwave')) { this.effect('dust', b, 'Shockwave!'); }
    const finisher = !heavy && this.hero.finisher && this.hero.swing >= 0 && !!FINISHERS[type], speed = WEAPON_TYPES[type].speed;
    if (finisher) { power *= FINISHER_POWER * (this.skill('mighty-rhythm') ? MIGHTY_FINISHER : 1); if (speed === 'medium') this.partBoost = 2; }
    const landed = this.bonkBeast(power * this.weaponScale(type), heavy, this.hero); this.partBoost = 1;
    if (finisher && landed) {
      this.huntFacts.finishers++; this.events.push({ kind: 'finisher' }); this.hitstop = Math.max(this.hitstop, 0.11); this.shake = Math.max(this.shake, 0.3);
      this.note = `${FINISHERS[type]}! ${speed === 'slow' ? '+20 Dizzy.' : speed === 'medium' ? 'Parts loosen twice as fast.' : 'Two bonks in one.'}`;
      if (speed === 'fast' && this.mode === 'hunt') this.bonkBeast(power / FINISHER_POWER / (this.skill('mighty-rhythm') ? MIGHTY_FINISHER : 1) * this.weaponScale(type), false, this.hero);
      if (speed === 'slow' && this.mode === 'hunt' && b.state !== 'dizzy') this.addDizzy(FINISHER_DIZZY, false);
    }
    if (landed && type === 'umbrella' && heavy) { const heal = this.perk('spin-heal'); this.buddy.fluff = Math.min(this.buddy.maxFluff, this.buddy.fluff + heal); }
    if (type === 'feather' && this.featherFlurry) { this.featherFlurry = false; this.bonkBeast(power * this.weaponScale(type), false, this.hero); }
    if (type === 'yoyo' && this.perk('loop-gather')) this.collect(true);
  }
  private puff(from: Vec & { face: number }, big: boolean, buddy = false) {
    const b = this.beast; if (!b) return;
    const d = direction(from, b), angle = (big ? Math.PI / 3 : Math.PI / 6) * (1 + this.perk('wide-puff', buddy));
    if (distance(from, b) > (big ? 4.5 : 3.5) || d.x * Math.cos(from.face) - d.z * Math.sin(from.face) < Math.cos(angle)) return;
    if (!this.bonkBeast(WEAPON_TYPES.puffer.bonk * this.weaponScale('puffer') * (buddy ? 2 / 3 : 1), false, from, buddy)) return;
    if (big && this.mode === 'hunt') {
      this.addDizzy(15);
      for (let i = 0; i < 25; i++) {
        const next = { x: b.x + d.x * 0.1, z: b.z + d.z * 0.1 };
        if (this.obstacles.some((o) => laneDistance(o, b, next) < o.r + 1.3) || Math.hypot(next.x, next.z) > ARENA_RADIUS - 1.3) break;
        b.x = next.x; b.z = next.z;
      }
      this.effect('dust', b, 'Big Breath!');
    }
  }
  private shoot(from: Vec, heavy: boolean, buddy: boolean) {
    if (!this.beast) return;
    const d = direction(from, this.beast), type = this.weapon(buddy ? this.buddyId : this.heroId), mult = this.weaponScale(type);
    if (!buddy && type === 'lightbow' && this.loaded <= 0) { this.note = 'Roll to reload your acorns!'; return; }
    if (!buddy) { this.shotsFired++; if (type === 'lightbow' && !(this.perk('fifth-shot') && this.shotsFired % 5 === 0)) this.loaded--; }
    const speed = type === 'wand' ? 6 : 20 * (1 + this.perk('seed-speed', buddy));
    if (buddy) this.buddyShots++;
    const shotNumber = buddy ? this.buddyShots : this.shotsFired;
    const fifth = this.perk('fifth-shot', buddy) && shotNumber % 5 === 0;
    const power = (buddy ? type === 'bow' ? 5 : WEAPON_TYPES[type].bonk * 2 / 3 : type === 'bow' ? heavy ? 20 : 9 : WEAPON_TYPES[type].bonk * (type === 'heavybow' ? heavy ? 0.45 : 2 : heavy ? 2 : 1)) * mult * (fifth ? 2 : 1);
    const seeds = type === 'bow' && heavy && !buddy ? this.swingCharge >= 1 ? 3 : 2 : 1;
    for (let seed = 0; seed < seeds; seed++) this.shots.push({ ...from, id: ++this.id, dx: d.x * speed, dz: d.z * speed, life: (buddy && type === 'wand' ? 2.5 : 1.5) * (1 + this.perk('far-shot', buddy)), power: power / seeds, heavy, buddy, type, ammo: buddy ? 0 : this.ammo, charge: buddy ? 0 : this.swingCharge, hit: false, dizzyShare: 1 / seeds });
    this.events.push({ kind: 'shoot' });
  }
  private stepHero(dt: number, input: Input) {
    if (this.rideRelease) { if (!input.charge) this.rideRelease = false; input = { ...input, charge: false }; this.last.charge = false; }
    const h = this.hero, pressed = (k: keyof Input) => !!input[k] && !this.last[k];
    for (const k of ['invincible', 'cooldown', 'slow', 'hidden'] as const) h[k] = Math.max(0, h[k] - dt);
    this.ride.pose = Math.max(0, this.ride.pose - dt); this.ride.landing = Math.max(0, this.ride.landing - dt); this.ride.plopped = Math.max(0, this.ride.plopped - dt);
    if (this.ride.riding) { this.stepRide(dt, input); return; }
    if (h.covered > 0) { h.covered = Math.max(0, h.covered - dt); h.speed = 0; return; }
    this.vineCd = Math.max(0, this.vineCd - dt); this.comboTimer = Math.max(0, this.comboTimer - dt);
    if (this.vine) { this.stepVine(dt, input); return; }
    if (pressed('grab') && this.mode === 'hunt') { this.throwVine(); if (this.vine) return; }
    if (pressed('sling') && this.mode === 'hunt') this.sling();
    this.song = Math.max(0, this.song - dt); this.glow = Math.max(0, this.glow - dt);
    this.breath = Math.max(0, this.breath - dt);
    if (this.fluffTime > 0 && this.mode === 'hunt') { const elapsed = Math.min(dt, this.fluffTime); this.fluffTime -= elapsed; if (this.beast?.state !== 'dizzy') this.addDizzy(2 * elapsed); }
    if (this.bounce > 0) {
      this.bounce = Math.max(0, this.bounce - dt);
      if (this.bounce <= 0 && this.beast) {
        this.bounceLanding = true;
        // Beast bodies keep paws 1.85 away, so a landing up to 2.5 away counts as right beside it.
        if (distance(h, this.beast) <= 2.5 && this.beast.state === 'dizzy' && this.startRide()) { this.bounceLanding = false; return; }
        if (distance(h, this.beast) < 3.65) this.weaponBonk(true);
        this.bounceLanding = false;
        if (this.perk('high-gather')) this.collect(false, h, 8);
      }
    }
    if (this.float > 0) this.float = Math.max(0, this.float - dt * (input.charge ? 0.5 : 1));
    for (const key of ['counter', 'poof', 'flurry', 'itemRecovery', 'vault'] as const) this[key] = Math.max(0, this[key] - dt);
    if (this.mode === 'hunt' && this.beast && this.mist > 0) { this.mist -= dt; this.addDizzy(this.nextDizzy * dt); }
    if (this.weapon() === 'claws' && this.zoom > 0 && !(this.perk('zoom-behind') && this.beast && direction(this.beast, h).x * Math.cos(this.beast.face) - direction(this.beast, h).z * Math.sin(this.beast.face) < -0.3 && input.bonk)) this.zoom = Math.max(0, this.zoom - dt);
    this.vaultHold = this.weapon() === 'glaive' && input.bonk ? this.vaultHold + dt : 0;
    if (this.mode === 'hunt' && this.vaultHold >= 0.35 && this.vault <= 0) { this.vault = 0.8; if (this.rockHop(input.x, input.z) && this.startRide()) return; }
    const releasedHold = this.chargeHold;
    this.chargeHold = input.charge ? this.chargeHold + dt : 0;
    const guardTool = this.guardTool();
    if (pressed('charge')) this.guardCombo = false;
    if (input.charge && input.bonk && this.weapon() !== 'umbrella') this.guardCombo = true;
    this.guarding = input.charge && !this.guardCombo && guardTool;
    // Raindrop Spin: J while the umbrella is open.
    if (this.weapon() === 'umbrella' && this.guarding && pressed('bonk')) this.attack(true);
    this.guardTime = this.guarding ? this.guardTime + dt : 0;
    if (this.guarding && this.guardTime > this.perk('free-guard')) this.stamina = Math.max(0, this.stamina - dt * 8); else this.stamina = Math.min(100, this.stamina + dt * 20 * (1 + (this.snack ? SNACKS[this.snack].effect.staminaRegen ?? 0 : 0)));
    if (this.mode === 'hunt' && this.weapon() === 'heavybow' && input.charge && this.flurry <= 0 && Math.hypot(input.x, input.z) < 0.1 && h.cooldown <= 0) { this.shoot(h, true, false); h.cooldown = 0.18; }
    if (this.weapon() === 'heavybow' && !input.charge && this.last.charge) this.flurry = 5 * (1 - this.perk('flurry-cool'));
    if (this.skill('frost-fluff') && this.beast && distance(h, this.beast) > 12) h.fluff = Math.min(h.maxFluff, h.fluff + dt / 2);
    // Hay Nibble: rolls recover 25% faster.
    h.rollCd = Math.max(0, h.rollCd - dt * (1 + (this.snack ? SNACKS[this.snack].effect.staminaRegen ?? 0 : 0) + this.charm.roll));
    // Tab toggles lock-on when it is let go, unless Q or E gave the buddy an order while it was held.
    if (pressed('lock')) this.ordered = false;
    if (input.lock && (pressed('next') || pressed('previous'))) { this.commandBuddy(pressed('next') ? 1 : -1); this.ordered = true; }
    else {
      const slots = Math.max(1, this.profile.ring.length);
      if (pressed('next')) this.item = (this.item + 1) % slots;
      if (pressed('previous')) this.item = (this.item + slots - 1) % slots;
    }
    if (!input.lock && this.last.lock && !this.ordered) this.locked = !this.locked;
    // F at a gathering spot gathers; anywhere else it uses the picked item.
    if (pressed('use')) {
      if (this.mode === 'village') { const s = this.nearestSpot(); if (s) this.events.push({ kind: 'interact', spot: s.id }); }
      else if (this.gathering) { /* Already gathering. */ }
      else if (this.hazard?.state === 'ready' && distance(this.hero, this.hazard) < 2.2 && this.mode === 'hunt') this.trip();
      else { const spot = this.nearestGather(); if (spot) { this.gathering = { spot: spot.id, t: 0 }; this.note = `Gathering ${plural(2, MATERIALS[spot.material].name).toLowerCase()}… stay still for a moment.`; } else this.useItem(); }
    }
    const len = Math.hypot(input.x, input.z), dx = len > 1 ? input.x / len : input.x, dz = len > 1 ? input.z / len : input.z;
    if (this.gathering) {
      // Moving, rolling or swinging stops gathering; a bump does too.
      const spot = this.spots.find((s) => s.id === this.gathering!.spot);
      if (!spot || spot.done || len > 0.1 || input.roll || input.bonk || input.charge || h.swing >= 0) this.gathering = null;
      else if ((this.gathering.t += dt) >= GATHER_TIME) { this.gathering = null; this.gather(spot, h); }
    }
    if (pressed('roll') && h.rollCd <= 0 && this.rockHop(input.x, input.z) && this.startRide()) return;
    if (pressed('roll') && (h.rollCd <= 0 || this.skill('updraft') && this.extraRoll && h.roll >= 0)) { if (h.rollCd > 0) this.extraRoll = false; this.loaded = 6; this.combo = 0; this.comboTimer = 0; h.roll = 0; h.rollCd = 0.85; h.rollX = len > 0.1 ? dx : Math.cos(h.face); h.rollZ = len > 0.1 ? dz : -Math.sin(h.face); h.swing = -1; h.charge = 0; this.effect('dust', h); }
    if (h.roll >= 0) {
      h.roll += dt; const speed = 6 + 6 * (1 - Math.min(1, h.roll / 0.46)); this.move(h, h.rollX * speed * dt, h.rollZ * speed * dt, 0.45); h.speed = 7;
      if (h.roll >= 0.46) { h.roll = -1; if (this.weapon() === 'umbrella') this.float = 0.46; }
    } else {
      const speed = (input.sprint ? 6.8 : 4.4) * (h.slow ? this.skill('snooze-proof') ? 0.775 : 0.55 : 1) * (1 + this.perk('move-speed') + (this.song > 0 && this.songKind === 0 ? 0.15 + this.perk('speedy-song') : 0) + (this.glow > 0 && this.glowColors >= 2 ? 0.15 : 0) + (this.weapon() === 'claws' && this.zoom > 0 ? 0.3 : 0)) * (h.swing >= 0 ? this.weapon() === 'heavybow' ? 0 : 0.4 : input.charge ? this.weapon() === 'umbrella' ? 0.5 : 0.6 : 1);
      this.move(h, dx * speed * dt, dz * speed * dt, 0.45); h.speed = len > 0.1 ? speed : 0;
      if (len > 0.1) h.face = Math.atan2(-dz, dx); else if (this.locked && this.beast && this.mode === 'hunt') h.face = faceTo(h, this.beast);
      if (this.mode === 'hunt') {
        if (input.charge && h.swing < 0 && h.cooldown <= 0) h.charge = Math.min(1.4, h.charge + dt * (1 + this.perk('charge-speed')));
        else if (!input.charge && this.last.charge) { if (!guardTool || this.guardCombo || releasedHold < 0.2) this.signature(h.charge); h.charge = 0; this.guardCombo = false; }
        else if (input.bonk && !input.charge && this.bounce <= 0) this.jab();
      }
    }
    if (h.swing >= 0) {
      h.swing += dt;
      const contact = this.weapon() === 'hammer' ? 0.24 : this.ranged() ? 0.12 : 0.1;
      if (h.swing >= contact && !h.landed) {
        h.landed = true;
        if (this.weapon() === 'puffer') this.puff(h, h.heavy);
        else if (this.ranged()) this.shoot(h, h.heavy, false);
        else if (this.beast && distance(h, this.beast) < (this.weapon() === 'umbrella' && h.heavy ? 3 : this.weapon() === 'puffer' ? 3.5 : this.weapon() === 'yoyo' ? 4 * (1 + this.perk('wide-loop')) : this.weapon() === 'switchaxe' && !this.bloom || this.weapon() === 'hammer' && this.perk('shockwave') && h.heavy && this.swingCharge >= 1 ? 4.5 : 3.65)) this.weaponBonk(h.heavy);
        if (this.ride.riding) return;
        this.effect('dust', h);
      }
      if (h.swing > (['hammer', 'bow'].includes(this.weapon()) ? !this.ranged() ? 0.6 : 0.35 : WEAPON_TYPES[this.weapon()].speed === 'fast' ? 0.2 : 0.4)) { h.swing = -1; h.finisher = false; }
    }
    if (this.beast && this.mode === 'hunt' && distance(h, this.beast) < 1.85) {
      const gap = distance(h, this.beast), d = gap < 0.0001 ? { x: 1, z: 0 } : direction(this.beast, h);
      this.move(h, d.x * (1.85 - gap), d.z * (1.85 - gap), 0.45);
    }
  }
  /** The two friends never stand inside each other, and the buddy never stands inside the beast. */
  private keepApart() {
    const h = this.hero, p = this.buddy, b = this.beast;
    const push = (from: Vec, by: number) => { const gap = distance(from, p); if (gap >= by) return; const d = gap < 0.0001 ? { x: -1, z: 0 } : direction(from, p); this.move(p, d.x * (by - gap), d.z * (by - gap), 0.4); };
    if (!this.ride.riding) push(h, 0.95);
    if (b && this.mode === 'hunt' && b.height < 1) push(b, 1.85);
  }
  private stepBuddy(dt: number) {
    const p = this.buddy, h = this.hero, b = this.beast;
    p.cooldown -= dt; p.berry -= dt;
    if (p.swing >= 0) { p.swing += dt; if (p.swing > 0.6) p.swing = -1; }
    if (this.mode === 'hunt' && h.fluff <= 45 && p.berry <= 0) { h.fluff = Math.min(h.maxFluff, h.fluff + 28); p.berry = 10; this.events.push({ kind: 'berry' }); this.effect('berry', h, 'Buddy berry! +28 Fluff'); this.note = `${this.buddyId === 'dora' ? 'Dora' : 'Enzo'} tossed you a healing berry!`; }
    // Go bonk helps once the leader is near the beast; stay close helps only from the leader's side; gather never bonks.
    const helping = this.mode === 'hunt' && b && !b.away && b.state !== 'snooze' && (this.order === 'bonk' ? distance(h, b) < 11 : this.order === 'close');
    const chase = helping && this.order === 'bonk' && !this.ranged(this.buddyId);
    const gathering = this.order === 'gather' && this.mode === 'hunt';
    const pickup = gathering ? this.drops.reduce<Drop | null>((best, d) => !best || distance(p, d) < distance(p, best) ? d : best, null) : null;
    // With no drops left, Gather visits the gathering spots the leader isn't already busy with.
    const spot = gathering && !pickup ? this.spots.filter((s) => !s.done && s.id !== this.gathering?.spot).reduce<GatherSpot | null>((best, s) => !best || distance(p, s) < distance(p, best) ? s : best, null) : null;
    if (!spot || spot.id !== p.gather) { p.gather = spot?.id ?? 0; p.gatherT = 0; }
    const target = pickup ?? spot ?? (chase ? b! : { x: h.x - 1.4, z: h.z + 1.4 });
    const d = distance(p, target), gap = pickup ? 0.3 : spot ? 1.2 : chase ? 2.7 : 1.2;
    p.speed = d > gap ? Math.min(6, 2 + d) * (this.song > 0 && this.songKind === 0 ? 1.15 : 1) : 0;
    if (d > gap) { const n = direction(p, target); this.move(p, n.x * p.speed * dt, n.z * p.speed * dt, 0.4); p.face = faceTo(p, target); }
    if (helping && b && p.cooldown <= 0 && distance(p, b) < (!this.ranged(this.buddyId) ? 3.6 : 13)) {
      p.face = faceTo(p, b); p.swing = 0; p.cooldown = 2.3;
      if (this.weapon(this.buddyId) === 'puffer') this.puff(p, false, true);
      else if (this.ranged(this.buddyId)) this.shoot(p, false, true); else this.bonkBeast((this.weapon(this.buddyId) === 'hammer' ? 8 : WEAPON_TYPES[this.weapon(this.buddyId)].bonk * 2 / 3) * this.weaponScale(this.weapon(this.buddyId)), !POST_GAME_WEAPONS.includes(this.weapon(this.buddyId)), p, true);
    }
    if (pickup) this.collect(false, p, 1.2);
    if (spot && d <= gap && (p.gatherT += dt) >= GATHER_TIME) { p.gatherT = 0; this.gather(spot, p); }
  }
  /** The three Mighty-fan lanes, from where the beast stood when it wound up. */
  fanLanes(): { start: Vec; end: Vec }[] {
    const b = this.beast; if (!b) return [];
    return [-1, 0, 1].map((k) => { const a = k * FAN_SPREAD, c = Math.cos(a), s = Math.sin(a); return { start: b.start, end: { x: b.start.x + (b.dir.x * c + b.dir.z * s) * FAN_LENGTH, z: b.start.z + (-b.dir.x * s + b.dir.z * c) * FAN_LENGTH } }; });
  }
  /** `force` winds up a set move straight away (the Double Dash's second dash) without counting a new cycle. */
  private windup(force?: BeastState) {
    const b = this.beast!;
    if (!force) { b.cycle++; b.rush = 0; }
    b.phase = b.id === 'frostmane' ? b.grump < b.maxGrump / 3 ? 3 : b.grump < b.maxGrump * 2 / 3 ? 2 : 1 : 1;
    const attacks: Record<BeastId, BeastState[]> = { bristleback: ['charge'], puffwart: ['hop', 'tongue', 'cloud'], skreel: ['swoop'], hornclack: ['sweep', 'charge'], frostmane: ['pounce', 'shake', 'pounce'], paddlepaw: ['charge', 'fan', 'hop'], rumblesnout: ['burrow', 'sweep', 'charge'] };
    const pattern: BeastState[] = [...(b.id === 'frostmane' ? b.phase === 1 ? ['pounce'] : b.phase === 2 ? ['pounce', 'shake'] : ['pounce', 'pounce', 'shake'] : attacks[b.id]) as BeastState[], ...(b.mighty ? [MIGHTY_MOVES[b.id]] : [])];
    // The first wind-up that can see a friend, and the first after turning Extra Grumpy, is a roar instead.
    const roar = !force && !this.roared && this.inSight();
    if (roar) { b.cycle--; this.roared = true; }
    b.attack = force ?? (roar ? 'roar' : pattern[(b.cycle - 1) % pattern.length]);
    // The Double Dash is two charges, each with its own warning.
    if (b.attack === 'rush') { b.attack = 'charge'; b.rush = 1; }
    b.state = 'windup'; b.t = 0; b.duration = Math.max(0.6, b.grumpy ? TELEGRAPH - 0.1 : TELEGRAPH); b.start = { x: b.x, z: b.z }; b.dir = direction(b, this.hero); b.face = faceTo(b, this.hero);
    const length = b.attack === 'charge' || b.attack === 'swoop' ? 12 : b.attack === 'fan' ? FAN_LENGTH : b.attack === 'pounce' || b.attack === 'hop' ? Math.min(9, distance(b, this.hero)) : b.attack === 'tongue' ? 7 : 0;
    b.aim = { x: b.x + b.dir.x * length, z: b.z + b.dir.z * length };
    // Rain: one circle on the leader and the rest in a ring round them, turned a little each time.
    const h = this.hero, n = b.attack === 'rain' ? b.id === 'frostmane' ? 4 : 3 : b.attack === 'burrow' ? 1 : 0, turn = b.cycle * 1.3;
    b.marks = Array.from({ length: n }, (_, i) => i === 0 ? { x: h.x, z: h.z } : { x: h.x + Math.cos(turn + i / (n - 1) * Math.PI * 2) * 3.6, z: h.z + Math.sin(turn + i / (n - 1) * Math.PI * 2) * 3.6 });
    this.effect('dust', b);
    if (roar && !this.introduced) { this.introduced = true; this.introAt = this.huntTime; this.events.push({ kind: 'intro' }); }
    this.note = b.attack === 'rain' ? `${MIGHTY_NAMES[b.id]}! Step out of the orange circles before they land.` : b.attack === 'burrow' ? `${BEASTS[b.id].name} digs down! Step out of the orange circle before it pops up.` : b.attack === 'fan' ? `${b.id === 'paddlepaw' ? 'Splash' : 'Feather Fan'}! Slip between the three orange lanes.` : b.attack === 'spin' ? `${MIGHTY_NAMES[b.id]}! Get well outside the big orange circle.` : b.rush ? `${MIGHTY_NAMES[b.id]}! Two charges, each with its own orange lane.` : b.attack === 'roar' ? 'Big roar coming! Step out of the orange circle, roll or guard.' : b.attack === 'shake' || b.attack === 'sweep' || b.attack === 'cloud' ? 'Orange circle! Step outside or roll as it lands.' : 'Orange lane! Step sideways or roll as it arrives.';
  }
  private stepVisitor(dt: number) {
    const b = this.beast; if (!b) return;
    if (b.away && this.visitor) this.visitor.state = 'leave';
    if (!this.visitor) {
      if (b.away) return;
      if (this.visited || this.huntTime < this.visitAt || b.home) return;
      const id = VISITORS[this.area]!, r = ARENA_RADIUS - 1.5, home = { x: Math.cos(this.visitAngle) * r, z: Math.sin(this.visitAngle) * r };
      this.visited = true; this.visitor = { id, ...home, face: 0, state: 'arrive', t: 0, home }; this.events.push({ kind: 'visitor' });
      this.note = `A wild ${BEASTS[id].name} wanders in! If it meets ${BEASTS[b.id].name}, look out for a turf bonk.`;
      return;
    }
    const v = this.visitor; v.t += dt;
    if (v.state === 'arrive') {
      if (v.t > 25 || b.home) { v.state = 'leave'; v.t = 0; return; }
      if (distance(v, b) < 5 && ['roam', 'circle', 'rest'].includes(b.state)) {
        // Squaring off is the warning: an orange circle round the pair for TURF_TIME before the bonk.
        v.state = 'face'; v.t = 0; b.state = 'turf'; b.t = 0; b.duration = TURF_TIME; b.height = 0; b.face = faceTo(b, v); v.face = faceTo(v, b);
        this.events.push({ kind: 'turf-warning' }); this.note = `${BEASTS[b.id].name} and ${BEASTS[v.id].name} square off! Step out of the orange circle.`;
        return;
      }
      const n = direction(v, b); this.move(v, n.x * dt * 2.4, n.z * dt * 2.4, 1.5); v.face = faceTo(v, b);
    } else if (v.state === 'face') {
      if (b.state !== 'turf') { v.state = 'leave'; v.t = 0; }
      // Step back a little so the two square off nose to nose without overlapping.
      else if (distance(v, b) < 4.8) { const n = direction(b, v); this.move(v, n.x * dt * 3, n.z * dt * 3, 1.5); v.face = faceTo(v, b); }
    } else {
      const d = distance(v, v.home); if (d < 0.6) { this.visitor = null; return; }
      const n = direction(v, v.home), step = Math.min(d, dt * 3); v.x += n.x * step; v.z += n.z * step; v.face = faceTo(v, v.home);
    }
  }
  /** The turf bonk: a big shove that takes Grump off the hunted beast and leaves it dizzy; the visitor wanders off. */
  private turfBonk() {
    const b = this.beast!, v = this.visitor, mid = v ? { x: (b.x + v.x) / 2, z: (b.z + v.z) / 2 } : { x: b.x, z: b.z };
    this.events.push({ kind: 'turf' }); this.shake = Math.max(this.shake, 0.4); this.effect('bonk', mid, 'Turf bonk!');
    b.grump = Math.max(1, b.grump - b.maxGrump * TURF_GRUMP); b.flash = 0.18; this.moods(b); this.huntFacts.turfs++;
    const pair = v && `${b.id}+${v.id}`; if (pair && TURF_PAIRS.includes(pair) && !this.profile.turfPairs.includes(pair)) this.profile.turfPairs.push(pair);
    if (distance(this.hero, mid) < TURF_REACH) this.bumpHero(12, mid);
    if (v) { v.state = 'leave'; v.t = 0; }
    if (this.mode !== 'hunt') return;
    this.makeDizzy(2.5); this.note = `Turf bonk! ${BEASTS[b.id].name} is dizzy. Big bonks welcome!`;
  }
  /** G throws the grab-on vine at a nearby beast that is low enough; it lands 0.25 s later. */
  throwVine() {
    const b = this.beast, h = this.hero;
    if (!b || this.mode !== 'hunt' || b.away || this.vine || this.ride.riding || this.airHeight > 0.5) return false;
    if (this.vineCd > 0) { this.note = `The vine is coiling back up: ${Math.ceil(this.vineCd)} s.`; return false; }
    if (distance(h, b) > VINE_REACH || b.height > 2.6 || b.height < -0.5 || ['nap', 'turf', 'yanked'].includes(b.state)) { this.note = 'Get within 9 steps, with the beast near the ground, to throw the vine.'; return false; }
    this.vine = { phase: 'fly', t: 0, pokes: 0 }; this.vineCd = VINE_COOLDOWN - this.charm.vine; this.huntFacts.vines++; this.gathering = null; this.guarding = false; this.chargeHold = 0;
    h.face = faceTo(h, b); h.roll = -1; h.swing = -1; h.charge = 0; h.speed = 0; this.events.push({ kind: 'vine' });
    return true;
  }
  private stepVine(dt: number, input: Input) {
    const v = this.vine!, b = this.beast, h = this.hero, pressed = (k: keyof Input) => !!input[k] && !this.last[k];
    v.t += dt; h.speed = 0;
    if (!b || this.mode !== 'hunt') { this.vine = null; return; }
    if (v.phase === 'fly') {
      if (v.t < 0.25) return;
      if (distance(h, b) > VINE_REACH + 1 || b.height > 2.6 || b.height < -0.5 || ['nap', 'turf', 'yanked'].includes(b.state)) { this.vine = null; this.note = 'The vine missed. Try again when it is closer.'; return; }
      // Holding on stops whatever the beast was doing; it never attacks while held.
      v.phase = 'cling'; v.t = 0; b.state = 'grabbed'; b.t = 0; b.duration = CLING_TIME; b.height = 0; b.face = faceTo(b, h);
      this.events.push({ kind: 'cling' }); this.note = 'Holding on! J to tickle it soft, K to yank it into a tree or rock, Space to let go.';
      return;
    }
    h.x = b.x + Math.cos(b.face) * 1.7; h.z = b.z - Math.sin(b.face) * 1.7; h.face = b.face + Math.PI;
    if (b.state !== 'grabbed' || pressed('roll') || v.t >= CLING_TIME) { this.letGo(); return; }
    if (pressed('bonk')) {
      v.pokes++; this.effect('bonk', b, 'Tickle!'); this.events.push({ kind: 'bonk' });
      if (v.pokes === 2) { b.soft = SOFT_TIME; this.events.push({ kind: 'soft' }); this.effect('part', b, 'Softened!'); this.note = 'Softened! For 12 seconds bonks take 20% more Grump and pop parts sooner.'; }
    }
    if (pressed('charge')) {
      // The yank goes the way the stick points, or straight towards the friend's side.
      const len = Math.hypot(input.x, input.z), dir = len > 0.2 ? { x: input.x / len, z: input.z / len } : { x: -Math.cos(b.face), z: Math.sin(b.face) };
      this.letGo(); b.state = 'yanked'; b.t = 0; b.duration = YANK / 12; b.start = { x: b.x, z: b.z }; b.dir = dir; b.face = faceTo(b, { x: b.x + dir.x, z: b.z + dir.z });
      this.events.push({ kind: 'yank' }); this.note = 'Yank!';
    }
  }
  private letGo() {
    const b = this.beast, h = this.hero; this.vine = null; h.invincible = Math.max(h.invincible, 0.5);
    if (b && b.state === 'grabbed') { b.state = 'rest'; b.t = 0; b.duration = 1.2; }
    if (b) { const d = direction(b, h); this.move(h, d.x * 0.8, d.z * 0.8, 0.4); }
  }
  private wallBonk() {
    const b = this.beast!;
    b.grump = Math.max(1, b.grump - b.maxGrump * WALL_GRUMP); b.flash = 0.18; this.moods(b);
    this.events.push({ kind: 'wall' }); this.shake = Math.max(this.shake, 0.4); this.effect('bonk', b, 'Wall bonk!');
    this.makeDizzy(2); this.note = 'Wall bonk! Dizzy and a little less grumpy. Big bonks welcome!';
  }
  /** R flicks a pebble towards the locked-on beast, or straight ahead. */
  sling() {
    const h = this.hero, b = this.beast;
    if (this.mode !== 'hunt' || this.ride.riding || this.vine) return false;
    if (this.pebbles <= 0) { this.note = 'Out of pebbles. Gathering and dizzy beasts shake more loose.'; return false; }
    const d = this.locked && b ? direction(h, b) : { x: Math.cos(h.face), z: -Math.sin(h.face) };
    if (this.locked && b) h.face = faceTo(h, b);
    this.pebbles--; this.stones.push({ id: ++this.id, x: h.x + d.x * 0.6, z: h.z + d.z * 0.6, dx: d.x * 22, dz: d.z * 22, life: 0.7 }); this.events.push({ kind: 'sling' });
    return true;
  }
  private stepStones(dt: number) {
    const b = this.beast;
    this.stones = this.stones.filter((s) => {
      const from = { x: s.x, z: s.z }; s.x += s.dx * dt; s.z += s.dz * dt; s.life -= dt;
      if (b && this.mode === 'hunt' && !b.away && b.state !== 'nap' && laneDistance(b, from, s) < 1.4) { this.plink(b); return false; }
      if (this.hazard?.state === 'ready' && laneDistance(this.hazard, from, s) < HAZARD_TOUCH) { this.trip(); return false; }
      const tree = this.obstacles.findIndex((o) => o.kind !== 'rock' && laneDistance(o, from, s) < o.r);
      if (tree >= 0) {
        if (!this.shaken.includes(tree) && this.shaken.length < TREE_BERRIES) { this.shaken.push(tree); const o = this.obstacles[tree]; this.drop({ x: o.x, z: o.z }, 'berry', 1); this.events.push({ kind: 'fruit' }); this.note = 'Plonk! A berry fell out of the tree.'; }
        return false;
      }
      return s.life > 0 && !this.obstacles.some((o) => distance(s, o) < o.r);
    });
  }
  /** A pebble hit: a little Grump and dizzy, never charging weapon meters; three hits bring a flying Skreel down. */
  private plink(b: Beast) {
    b.grump = Math.max(0, b.grump - PEBBLE_POWER); b.flash = 0.12; this.events.push({ kind: 'plink' }); this.effect('bonk', b, 'Plink!');
    if (b.grump <= 0) { this.nap(); return; }
    this.moods(b);
    if (b.state === 'snooze') { b.state = 'rest'; b.t = 0; b.duration = 1.5; b.home = 2; this.note = 'Plink! That woke it up. Save the snooze for a wake-up bonk next time.'; return; }
    if (b.id === 'skreel' && b.height > 1.5 && ['circle', 'swoop', 'windup'].includes(b.state) && ++this.skyHits >= KNOCKDOWN_HITS) { this.skyHits = 0; this.huntFacts.knockdowns++; this.events.push({ kind: 'knockdown' }); b.state = 'rest'; b.t = 0; b.duration = 2.5; b.height = 0; this.effect('dust', b, 'Down it comes!'); this.note = 'Down it comes! Skreel rests on the ground for a moment. Get close!'; return; }
    this.addDizzy(PEBBLE_DIZZY);
  }
  private coverEars(b: Beast) {
    const h = this.hero, rolling = h.roll >= 0 && h.roll < 0.32 * (this.skill('feather-step') ? 1.3 : 1);
    if (distance(this.buddy, b) < ROAR_REACH) this.buddy.cooldown = Math.max(this.buddy.cooldown, 0.9);
    if (distance(h, b) >= ROAR_REACH || rolling || this.guarding || h.invincible > 0 || this.airHeight > 0.5) return;
    h.covered = 0.9; h.charge = 0; this.events.push({ kind: 'covered' }); this.effect('dust', h, 'Ears covered!');
    this.note = 'What a roar! Roll or guard as it roars to keep going.';
  }
  private stepBeast(dt: number) {
    const b = this.beast; if (!b || this.ride.riding || b.away) return;
    const pace = (b.grumpy ? GRUMPY_PACE : 1) * (b.drowsy > 0 ? 1 - b.drowsySlow : 1);
    b.t += dt; b.flash = Math.max(0, b.flash - dt); b.drowsy = Math.max(0, b.drowsy - dt);
    // A beast on the ground that steps on the sticky sap is stuck where it stands, even mid-charge.
    if (this.trap && b.height < 0.5 && !['dizzy', 'stuck', 'snooze', 'turf', 'grabbed', 'nap'].includes(b.state) && distance(b, this.trap) < TRAP_REACH) {
      const sap = ITEMS['sticky-sap'].effect as { seconds: number };
      b.state = 'stuck'; b.t = 0; b.duration = sap.seconds; b.height = 0; this.trap = null;
      this.effect('dust', b, 'Stuck!'); this.events.push({ kind: 'trap' }); this.note = `Stuck in sticky sap for ${sap.seconds} seconds. Bonk away!`;
      return;
    }
    if (b.state === 'dizzy' || b.state === 'stuck') { b.height = 0; if (b.t >= b.duration) { b.duration = b.state === 'dizzy' ? 1.8 : 1.2; b.state = 'rest'; b.t = 0; } return; }
    if (b.state === 'rest') { b.height = 0; if (b.t >= b.duration) { b.state = b.id === 'skreel' ? 'circle' : 'roam'; b.t = 0; b.duration = b.id === 'frostmane' ? 1.5 : 2.4; } return; }
    b.soft = Math.max(0, b.soft - dt);
    if (b.state === 'grabbed') { b.height = 0; if (!this.vine) { b.state = 'rest'; b.t = 0; b.duration = 1.2; } return; }
    if (b.state === 'yanked') {
      const nx = b.start.x + b.dir.x * Math.min(YANK, b.t * 12), nz = b.start.z + b.dir.z * Math.min(YANK, b.t * 12);
      if (this.obstacles.some((o) => Math.hypot(nx - o.x, nz - o.z) < o.r + 1.4) || Math.hypot(nx, nz) > (this.area === 'paddock' ? 12 : ARENA_RADIUS) - 1.5) { this.wallBonk(); return; }
      b.x = nx; b.z = nz; b.height = 0;
      if (b.t >= b.duration) { b.state = 'rest'; b.t = 0; b.duration = 1.2; this.note = 'A wobbly stumble. Yank it into a tree or rock for a wall bonk!'; }
      return;
    }
    if (b.state === 'turf') { b.height = 0; if (this.visitor) b.face = faceTo(b, this.visitor); if (b.t >= b.duration) this.turfBonk(); return; }
    if (b.state === 'snooze') {
      b.height = 0; b.grump = Math.min(b.maxGrump, b.grump + b.maxGrump * NEST_REGAIN / SNOOZE * dt);
      if (b.t >= b.duration) { b.state = 'rest'; b.t = 0; b.duration = 1.5; b.home = 2; this.note = `${BEASTS[b.id].name} woke up refreshed. Back to the hunt!`; }
      return;
    }
    if (b.home === 1 && (b.state === 'roam' || b.state === 'circle')) { b.state = 'trudge'; b.t = 0; }
    if ((b.state === 'roam' || b.state === 'circle') && !b.home && this.zone < this.zones - 1 && b.grump < b.maxGrump * (this.zoneAt[this.zone] ?? 0)) {
      b.state = 'wander'; b.t = 0; this.events.push({ kind: 'wander' }); this.effect('dust', b, 'Off it goes!');
      this.note = `${BEASTS[b.id].name} is wandering off towards Zone ${this.zone + 2} · ${ZONE_NAMES[this.area][this.zone + 1]}. Bonk it on the way, or follow it!`;
    }
    if (b.state === 'wander') {
      // A brisk walk (or a low flight) to the open path, past the friends without attacking.
      const e = this.exitTo(this.zone + 1)!, d = distance(b, e);
      b.height = b.id === 'skreel' ? Math.min(1.6, b.height + dt * 2) : Math.max(0, b.height - dt * 3);
      if (d < 1.2 || b.t > WANDER_GIVEUP) {
        b.away = true; b.zone = this.zone + 1; b.x = e.x; b.z = e.z; b.state = 'rest'; b.t = 0; b.duration = 1; b.height = 0; b.drowsy = 0;
        this.events.push({ kind: 'away' }); this.note = `${BEASTS[b.id].name} went to Zone ${b.zone + 1} · ${ZONE_NAMES[this.area][b.zone]}. Follow the path!`;
        return;
      }
      const n = direction(b, e); this.move(b, n.x * dt * 3.4 * pace, n.z * dt * 3.4 * pace, 1.5); b.face = faceTo(b, e);
      return;
    }
    if (b.state === 'trudge') {
      // A slow walk home, ignoring the friends; arriving starts the snooze.
      b.height = Math.max(0, b.height - dt * 3);
      const d = distance(b, this.nest);
      if (d < 0.5) { b.state = 'snooze'; b.t = 0; b.duration = SNOOZE; b.height = 0; b.x = this.nest.x; b.z = this.nest.z; this.events.push({ kind: 'snooze' }); this.effect('nap', b, 'Zzz…'); this.note = `${BEASTS[b.id].name} is snoozing in its nest. Sneak up for a wake-up bonk!`; return; }
      const n = direction(b, this.nest), step = Math.min(d, dt * 2.2 * pace); b.x += n.x * step; b.z += n.z * step; b.face = faceTo(b, this.nest);
      return;
    }
    if (b.state === 'roam' || b.state === 'circle') {
      // Hidden in smoke, the leader can't be found: the beast wanders a slow loop and starts no new attack.
      const hidden = this.hero.hidden > 0, wander = { x: Math.cos(this.time * 0.35) * 9, z: Math.sin(this.time * 0.35) * 9 };
      if (b.state === 'circle') { b.height = 2.4; this.move(b, Math.cos(this.time * 0.7) * dt * 2.7 * pace, Math.sin(this.time * 0.7) * dt * 2.7 * pace, 1.5); b.face = this.time * -0.7; }
      else { b.height = 0; const goal = hidden ? wander : this.hero, d = distance(b, goal); if (d > (hidden ? 0.5 : 5)) { const n = direction(b, goal); this.move(b, n.x * dt * 1.35 * pace, n.z * dt * 1.35 * pace, 1.5); b.face = faceTo(b, goal); } }
      if (b.t >= b.duration) { if (hidden || this.huntChapter === 0 && this.huntTime < 20) b.t = 0; else this.windup(); }
      return;
    }
    if (b.state === 'windup') {
      b.height = b.id === 'skreel' ? 1 + Math.sin(b.t * 8) * 0.2 : b.attack === 'burrow' ? -Math.min(1, b.t / 0.5) * 2.2 : 0;
      if (b.t >= b.duration && b.attack === 'roar') { b.state = 'roar'; b.t = 0; b.duration = ROAR_TIME; this.events.push({ kind: 'roar' }); this.shake = Math.max(this.shake, 0.35); return; }
      if (b.t >= b.duration) { b.state = b.attack; b.t = 0; b.duration = b.attack === 'charge' || b.attack === 'swoop' ? distance(b.start, b.aim) / ((b.attack === 'charge' ? 12 : 14) * pace) : b.attack === 'pounce' || b.attack === 'hop' ? 0.72 / pace : b.attack === 'rain' || b.attack === 'fan' || b.attack === 'burrow' ? 0.5 : b.attack === 'spin' ? 0.7 : 0.65; }
      return;
    }
    const active = b.state;
    if (active === 'charge' || active === 'swoop') {
      const speed = (active === 'charge' ? 12 : 14) * pace;
      const travel = Math.min(distance(b.start, b.aim), b.t * speed);
      const nx = b.start.x + b.dir.x * travel, nz = b.start.z + b.dir.z * travel;
      const obstacle = this.obstacles.some((o) => Math.hypot(nx - o.x, nz - o.z) < o.r + 1.4) || Math.hypot(nx, nz) > ARENA_RADIUS - 1.5;
      if (obstacle) { this.makeDizzy(3.8); return; }
      b.x = nx; b.z = nz; b.height = active === 'swoop' ? Math.max(0, 0.8 - b.t) : 0;
      if (distance(this.hero, b) < 2.5) this.bumpHero(15, b);
    } else if (active === 'pounce' || active === 'hop') {
      const f = Math.min(1, b.t / b.duration), x = b.start.x + (b.aim.x - b.start.x) * f, z = b.start.z + (b.aim.z - b.start.z) * f;
      this.move(b, x - b.x, z - b.z, 1.4); b.height = Math.sin(f * Math.PI) * (active === 'hop' ? 2 : 1.5);
      if (f > 0.75 && distance(this.hero, b) < 3) this.bumpHero(b.id === 'frostmane' ? 17 + b.phase : 12, b);
    } else if (active === 'tongue') {
      if (b.t > 0.18 && b.t < 0.48 && laneDistance(this.hero, b.start, b.aim) < 1.2) this.bumpHero(12, b);
    } else if (active === 'sweep' || active === 'shake') {
      if (b.t > 0.25 && distance(this.hero, b) < (active === 'shake' ? 5 : 4)) this.bumpHero(active === 'shake' ? 14 : 16, b);
    } else if (active === 'rain') {
      const mark = b.t > 0.05 && b.t < 0.3 ? b.marks.find((m) => distance(this.hero, m) < RAIN_REACH) : undefined; if (mark) this.bumpHero(14, mark);
    } else if (active === 'burrow') {
      // Pops up inside its circle: a bump for anyone still in it, then a long shake-off as the opening.
      const m = b.marks[0]; if (m) { b.x = m.x; b.z = m.z; } b.height = -2.2 * Math.max(0, 1 - b.t / 0.25);
      if (m && b.t > 0.05 && b.t < 0.3 && distance(this.hero, m) < BURROW_REACH) this.bumpHero(15, m);
    } else if (active === 'fan') {
      if (b.t > 0.15 && b.t < 0.45 && this.fanLanes().some((l) => laneDistance(this.hero, l.start, l.end) < FAN_REACH)) this.bumpHero(12, b);
    } else if (active === 'spin') {
      if (b.t > 0.25 && distance(this.hero, b) < SPIN_REACH) this.bumpHero(16, b);
    } else if (active === 'roar') {
      // One sound wave, 0.2 s in: friends inside the reach cover their ears unless rolling, guarding or riding.
      if (b.t >= 0.2 && b.t - dt < 0.2) this.coverEars(b);
    } else if (active === 'cloud' && b.t >= b.duration) {
      this.clouds.push({ x: b.x + b.dir.x * 3, z: b.z + b.dir.z * 3, life: 5, r: 3.5 });
    }
    if (b.t >= b.duration && b.rush && active === 'charge') { b.rush = 0; this.windup('charge'); return; }
    if (b.t >= b.duration) { b.state = 'rest'; b.t = 0; b.height = 0; b.marks = []; b.duration = b.id === 'skreel' ? 4.5 : active === 'burrow' ? 2.8 : b.id === 'frostmane' ? 2.3 - b.phase * 0.3 : 2.2; }
  }
  private stepWeather() {
    const w = this.weather, stormy = w.level >= 0.5;
    if (stormy === this.stormy) return;
    this.stormy = stormy; this.events.push({ kind: 'weather' });
    const names: Record<WeatherKind, string> = { clear: '', rain: 'rain shower', mist: 'mist', dust: 'dust storm', blizzard: 'blizzard' };
    this.note = !stormy ? `The ${names[w.kind]} passes. You can see far again.` : w.kind === 'rain' ? 'A rain shower rolls in. Splish, splash! It is a little harder to see far.' : w.kind === 'mist' ? 'Mist creeps over the ridge. Stay close, or follow Enzo’s nose.' : w.kind === 'dust' ? 'A dust storm swirls up! Follow Enzo’s nose if the beast slips out of sight.' : 'A blizzard blows in! It is hard to see far, so follow Enzo’s nose.';
  }
  private stepSniff(dt: number) {
    this.sniff = Math.max(0, this.sniff - dt);
    if (this.mode !== 'hunt' || this.inSight()) { this.unseen = 0; return; }
    this.unseen += dt;
    if (this.unseen < 1) return;
    if (this.sniff <= 0) { this.events.push({ kind: 'sniff' }); this.note = this.beast?.away ? `Enzo sniffs the air. The pawprints lead down the path to Zone ${this.beast.zone + 1}!` : 'Enzo sniffs the air. Follow the glowing pawprints to the beast!'; }
    this.sniff = Math.max(this.sniff, 2);
  }
  step(dt: number, input: Input = NO_INPUT) {
    if (this.paused || !Number.isFinite(dt) || dt <= 0) return;
    dt = Math.min(dt, 0.05); if (this.mode === 'hunt') this.huntTime += dt; this.time += dt; this.shake = Math.max(0, this.shake - dt * 1.8);
    input = { ...input, x: Number.isFinite(input.x) ? clamp(input.x, -1, 1) : 0, z: Number.isFinite(input.z) ? clamp(input.z, -1, 1) : 0 };
    for (const f of this.fx) f.t += dt;
    this.fx = this.fx.filter((f) => f.t < 1.4);
    if (this.mode === 'nap') { this.resultTime += dt; if (this.beast) this.beast.t += dt; if (this.resultTime >= 3.2 && !this.nextQuestBeast()) this.mode = this.beast?.id === 'frostmane' && !this.questResult ? 'victory' : 'calm'; return; }
    if (this.mode !== 'village' && this.mode !== 'hunt') return;
    if (this.hitstop > 0) { this.hitstop = Math.max(0, this.hitstop - dt); return; }
    this.stepHero(dt, input); this.stepBuddy(dt); this.keepApart();
    if (this.mode === 'hunt' && this.beast?.away && !this.ride.riding) { const e = this.exitTo(this.beast.zone); if (e && distance(this.hero, e) < EXIT_REACH) this.travel(this.beast.zone); }
    if (this.mode === 'hunt' && this.beast) {
      this.stepBeast(dt);
      this.shots = this.shots.filter((s) => {
        const perk = (id: string) => this.perk(id, s.buddy);
        if (s.type === 'wand' && this.locked && perk('homing')) { const d = direction(s, this.beast!); s.dx = d.x * 6; s.dz = d.z * 6; }
        const from = { x: s.x, z: s.z }; s.x += s.dx * dt; s.z += s.dz * dt; s.life -= dt;
        if (!s.hit && laneDistance(this.beast!, from, s) < 1.8 * (1 + (s.type === 'wand' ? perk('big-bubbles') : 0))) {
          s.hit = true;
          const b = this.beast!;
          let power = s.power * (s.type === 'heavybow' && b.id === 'hornclack' ? 1 + perk('pop-shell') : 1);
          if (s.ammo === 2) power *= 1.2;
          if (this.bonkBeast(power, s.heavy, from, s.buddy, s.dizzyShare)) {
            if (s.ammo === 1 && this.mode === 'hunt') { b.drowsy = 5 * (1 + perk('sticky-longer') + perk('long-sap')); b.drowsySlow = s.type === 'lightbow' ? b.height <= 0.1 && perk('leg-slow') ? perk('leg-slow') : 0.15 : 0.3; if (++this.stickyHits % 3 === 0 && perk('root')) { b.state = 'stuck'; b.t = 0; b.duration = 2; } }
            if (s.type === 'wand') { this.collect(false, b, 4); if (perk('double-burst')) this.bonkBeast(power, false, from, s.buddy, s.dizzyShare); this.buddy.fluff = Math.min(this.buddy.maxFluff, this.buddy.fluff + (perk('heal-bubble') || 15)); this.effect('berry', this.buddy, `+${perk('heal-bubble') || 15} buddy Fluff`); }
          }
          return !!perk('pierce') && s.charge >= 1;
        }
        if (this.obstacles.some((o) => distance(s, o) < o.r)) return false;
        return s.life > 0;
      });
      this.clouds = this.clouds.filter((c) => { c.life -= dt; if (distance(this.hero, c) < c.r) this.hero.slow = 0.4; return c.life > 0; });
      this.collect();
      this.stepStones(dt); this.stepQuest(); this.stepSniff(dt); this.stepWeather(); this.stepVisitor(dt); this.stepHazard(dt); this.stepFinches();
    }
    if (!this.beast || this.mode !== 'hunt') this.ride = freshRide();
    this.last = { ...input };
  }
  save() { return { v: 6, seed: this.seed, profile: JSON.parse(JSON.stringify(this.profile)) as Profile }; }
  /** Reload safely returns to camp; gathered materials and all permanent progress are kept. A v1 save's materials move into the pouch. */
  static load(value: unknown): HuntGame {
    const game = new HuntGame();
    if (!value || typeof value !== 'object') return game;
    const s = value as { v?: unknown; seed?: unknown; profile?: Partial<Profile> & { levels?: Partial<Record<HeroId, number>>; materials?: Partial<Record<BeastId, unknown>> } };
    if ((s.v !== 1 && s.v !== 2 && s.v !== 3 && s.v !== 4 && s.v !== 5 && s.v !== 6) || !s.profile || typeof s.profile !== 'object') return game;
    const p = s.profile, integer = (n: unknown, max: number, fallback = 0) => typeof n === 'number' && Number.isFinite(n) ? clamp(Math.floor(n), 0, max) : fallback;
    game.profile.hero = p.hero === 'dora' || p.hero === 'enzo' ? p.hero : null;
    for (const id of BEAST_IDS) game.profile.naps[id] = integer(p.naps?.[id], 9999);
    if (s.v === 1) for (const id of BEAST_IDS) game.profile.pouch[V1_MATERIAL[id]] = Math.min(99, game.profile.pouch[V1_MATERIAL[id]] + integer(p.materials?.[id], 99999));
    else {
      for (const id of [...MATERIAL_IDS, ...ITEM_IDS]) game.profile.pouch[id] = integer((p.pouch as Partial<Pouch> | undefined)?.[id], cap(id));
      const ring = Array.isArray(p.ring) ? RING_ITEMS.filter((id) => p.ring!.includes(id)).slice(0, RING_SIZE) : [];
      if (ring.length) game.profile.ring = ring;
      game.profile.snack = typeof p.snack === 'string' && SNACK_IDS.includes(p.snack as SnackId) ? p.snack as SnackId : null;
    }
    if (s.v !== 4 && s.v !== 5 && s.v !== 6) {
      const any = game.uniqueNaps > 0;
      game.story.chapter = any ? 1 : 0;
      while (game.chapter <= 5 && game.profile.naps[STORY[game.chapter].beast] > 0) game.story.chapter++;
      game.story.scenesSeen = SCENES.filter((id) => { if (id === 'epilogue' || id === 'finale') return false; const n = Number(id.split('-')[0]); return n === 0 ? any : game.profile.naps[STORY[n].beast] > 0; });
      for (const id of BEAST_IDS) game.profile.beastBook[id] = { met: game.profile.naps[id] > 0, napped: game.profile.naps[id], partsBroken: [], best: 0 };
    } else {
      game.story.chapter = integer(p.story?.chapter, 6);
      game.story.scenesSeen = Array.isArray(p.story?.scenesSeen) ? SCENES.filter((id) => p.story!.scenesSeen.includes(id)) : [];
      for (const id of BEAST_IDS) {
        const b = p.beastBook?.[id];
        game.profile.beastBook[id] = { met: b?.met === true, napped: integer(b?.napped, 9999), partsBroken: Array.isArray(b?.partsBroken) ? [BEASTS[id].part].filter((part) => b!.partsBroken.includes(part)) : [], best: integer(b?.best, 99999) };
      }
      if (validDay(p.bounties?.day)) {
        // Today's picks only, once each, kept in the order they were earned.
        const picks = dailyBounties(p.bounties!.day).map((t) => t.id), keep = (list: unknown) => Array.isArray(list) ? list.filter((id, i) => picks.includes(id) && list.indexOf(id) === i) as string[] : [];
        game.profile.bounties = { day: p.bounties!.day, done: keep(p.bounties?.done), ready: keep(p.bounties?.ready) };
      }
    }
    game.profile.bountiesClaimed = s.v === 5 || s.v === 6 ? integer(p.bountiesClaimed, 999999) : game.profile.bounties.done.length;
    game.profile.totalPlops = s.v === 5 || s.v === 6 ? integer(p.totalPlops, 999999) : 0;
    for (const id of BEAST_IDS) game.profile.variantNaps[id] = s.v === 5 || s.v === 6 ? integer(p.variantNaps?.[id], 999999) : 0;
    for (const id of BEAST_IDS) game.profile.mightyBest[id] = s.v === 6 ? integer(p.mightyBest?.[id], 99999) : 0;
    game.profile.turfPairs = Array.isArray(p.turfPairs) ? TURF_PAIRS.filter((pair) => p.turfPairs!.includes(pair)) : [];
    game.profile.extraGrumpyUnlocked = game.chapter === 6;
    if (s.v === 1 || s.v === 2) {
      for (const [hero, type] of [['dora', 'hammer'], ['enzo', 'bow']] as const) { const tier = clamp(integer(p.levels?.[hero], 3, 1), 1, 3) as Tier; game.profile.weapons[type] = { tier, branch: tier >= 3 ? 'A' : null }; }
    } else {
      for (const type of Object.keys(WEAPON_TYPES) as WeaponType[]) {
        const w = p.weapons?.[type];
        if (w && Number.isInteger(w.tier) && w.tier >= 1 && w.tier <= 5 && (w.tier < 3 ? w.branch === null : w.branch === 'A' || w.branch === 'B')) game.profile.weapons[type] = { tier: w.tier, branch: w.branch };
      }
      for (const who of ['dora', 'enzo'] as const) { const type = p.equipped?.[who]; if (typeof type === 'string' && Object.hasOwn(WEAPON_TYPES, type) && (!POST_GAME_WEAPONS.includes(type) || game.weaponOpen(type))) game.profile.equipped[who] = type; }
      game.profile.armour.owned = Array.isArray(p.armour?.owned) ? ARMOUR_PIECES.filter((id) => p.armour!.owned.includes(id)) : [];
      for (const slot of SLOTS) { const piece = p.armour?.worn?.[slot]; if (piece && game.profile.armour.owned.includes(piece) && piece.endsWith(`-${slot}`)) game.profile.armour.worn[slot] = piece; }
    }
    if (s.v === 6) { const c = p.charms; for (const id of CHARM_IDS) game.profile.charms.levels[id] = integer(c?.levels?.[id], 3); game.profile.charms.worn = c && CHARM_IDS.includes(c.worn as CharmId) && game.profile.charms.levels[c.worn as CharmId] > 0 ? c.worn : null; }
    if (s.v === 6) { game.profile.stars = integer(p.stars, 9999); for (const q of QUESTS) { const n = integer(p.quests?.[q.id], 9999); if (n) game.profile.quests[q.id] = n; } }
    game.profile.won = game.profile.naps.frostmane > 0; game.profile.hunts = integer(p.hunts, 999999);
    if (typeof s.seed === 'number' && Number.isFinite(s.seed)) game.seed = game.rng = s.seed >>> 0;
    game.hero = hero(game.baseFluff);
    return game;
  }
}
