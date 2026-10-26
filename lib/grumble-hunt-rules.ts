/** Grumble Hunt rules: the beasts, tuning numbers, tables and types the engine shares. All distances are world units; all clocks are seconds. No DOM or Three.js. */
import { type ArmourSetId, SLOTS, WEAPON_TYPES, type WeaponType, type Tier, type Branch, type ArmourPieceId, type Worn, DROPS, ITEMS, MATERIALS, SNACKS, STORY, BEAST_ORDER, POST_GAME_BEASTS, POST_GAME_AREA, type AreaId, type ItemId, type MaterialId, type SnackId } from './grumble-hunt-content.js';
import type { CharmId } from './grumble-hunt-quests.js';
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
export const TELEGRAPH = 0.9;
 // Every attack, including final-phase pounces, has at least this warning (less 0.1 s when Extra Grumpy).
export const GRUMPY_AT = 0.3;
 // Below this share of Grump a beast turns Extra Grumpy: 15% faster, warning 0.1 s sooner.
export const GRUMPY_PACE = 1.15;
export type WeatherKind = 'clear' | 'rain' | 'mist' | 'dust' | 'blizzard';
export const AREA_WEATHER: Record<AreaId, WeatherKind> = { paddock: 'clear', meadow: 'rain', marsh: 'rain', ridge: 'mist', hollow: 'dust', peak: 'blizzard' };
/** At full strength, weather shrinks how far a friend can see the beast to this share of SIGHT. */
export const WEATHER_SIGHT: Record<WeatherKind, number> = { clear: 1, rain: 0.75, mist: 0.6, dust: 0.55, blizzard: 0.5 };
export const WEATHER_RAMP = 3;
 // Seconds for weather to blow in or clear.
export const TURF_TIME = 1;
 // Two beasts square off this long, inside an orange circle, before a turf bonk.
export const TURF_REACH = 4.5;
 // The turf bonk bumps friends this close to the middle of the pair.
export const TURF_GRUMP = 0.1;
 // Share of starting Grump a turf bonk takes off the hunted beast, which is then dizzy.
/** The beast that may wander into each area's hunt once; it can't be bonked and leaves after a turf bonk. */
export const VISITORS: Record<AreaId, BeastId | null> = { paddock: null, meadow: 'puffwart', marsh: 'bristleback', ridge: 'hornclack', hollow: 'bristleback', peak: 'skreel' };
export const VINE_REACH = 9;
 // The grab-on vine reaches a beast this close that is no higher than 2.6.
export const VINE_COOLDOWN = 20;
export const CLING_TIME = 4;
 // Seconds a friend can hold on before letting go by themselves.
export const SOFT_TIME = 12;
 // Two tickles soften a beast this long: bonks take 20% more Grump and 50% more part.
export const YANK = 6;
 // A yank pulls the beast this far; a tree, rock or the edge on the way makes a wall bonk.
export const WALL_GRUMP = 0.03;
export const SLING_START = 5;
 // Pebbles at the start of a hunt; gathering adds 3 and every dizzy shakes 1 loose.
export const SLING_MAX = 12;
export const PEBBLE_POWER = 3;
 // A pebble takes this much Grump and adds 6 dizzy; three knock a flying Skreel down.
export const KNOCKDOWN_HITS = 3;
export const PEBBLE_DIZZY = 6;
export const TREE_BERRIES = 3;
 // Pebbles knock at most this many berries out of trees on a hunt, one per tree.
export const WEAK_SPOT = 1.15;
 // Bonks on a weak spot, the face (Hornclack: the sides, between its shell plates), take this much more Grump.
export type HazardKind = 'acorns' | 'bubbles' | 'rocks' | 'vines' | 'icicles';
/** One hazard per wild area: knock it with a pebble (or press F beside it) and it drops on whatever is inside its circle. */
export const AREA_HAZARD: Record<AreaId, HazardKind | null> = { paddock: null, meadow: 'acorns', marsh: 'bubbles', ridge: 'rocks', hollow: 'vines', peak: 'icicles' };
export const HAZARD_REACH = 3.2, HAZARD_WARN = 0.8, HAZARD_GRUMP = 0.08, HAZARD_DIZZY = 3, HAZARD_TOUCH = 1.3;
export const HAZARD_NAMES: Record<HazardKind, string> = { acorns: 'Acorn bough', bubbles: 'Bubble spring', rocks: 'Rock pile', vines: 'Sticky vines', icicles: 'Icicles' };
export const FINCHES = 3, FINCH_FLUFF = 5, FINCH_REACH = 1.4;
 // Fluff finches per wild area; each one caught adds Fluff and most Fluff for the hunt.
/** Each wild area is three zones joined by paths; the third is the beast's den. The paddock is one zone. */
export const ZONE_NAMES: Record<AreaId, string[]> = { paddock: ['The Paddock'], meadow: ['Clover Field', 'Bramble Dell', 'Sunny Knoll'], marsh: ['Lily Pools', 'Reed Maze', 'Misty Bog'], ridge: ['Pine Steps', 'Windy Ledge', 'High Saddle'], hollow: ['Red Dunes', 'Echo Canyon', 'Sandstone Den'], peak: ['Frost Gate', 'Icicle Run', 'Summit Bowl'] };
export const ZONE_AT = [0.7, 0.35];
 // Below these shares of its Grump the beast wanders on from zone 1, then zone 2.
export const EXIT_REACH = 2.4;
 // Walk this close to the open path to follow the beast.
export const WANDER_GIVEUP = 12;
 // Seconds a wandering beast tries to reach the path before slipping away anyway.
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
export const ROAR_REACH = 7;
 // A roar makes friends this close cover their ears; a roll or a guard keeps them going.
export const INTRO_CARD = 3.2;
export const ROAR_TIME = 1.1;
 // Seconds a roar lasts; covered ears last 0.9 seconds.
export const TIRED_AT = 0.2;
 // Below this share of Grump a beast trudges home to its nest, once, and snoozes there.
export const SNOOZE = 8;
 // Seconds a beast snoozes in its nest unless a wake-up bonk (double Grump) comes first.
export const NEST_REGAIN = 0.08;
 // A full snooze restores at most this share of Grump.
export const SIGHT = 12;
 // Further than this, or behind a tree or rock, the beast is out of sight and Enzo sniffs out a trail.
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
export const VILLAGER_RADIUS = 0.5, TALK_REACH = 2.2;
export const MATERIAL_IDS = Object.keys(MATERIALS) as MaterialId[];
export const ITEM_IDS = Object.keys(ITEMS) as ItemId[];
export const SNACK_IDS = Object.keys(SNACKS) as SnackId[];
/** Items that can go in the hunt ring; the hay bundle is only a snack ingredient. */
export const RING_ITEMS = ITEM_IDS.filter((id) => ITEMS[id].effect.kind !== 'ingredient');
export const RING_SIZE = 6;
export const DEFAULT_RING: readonly ItemId[] = ['fluffberry', 'big-fluffberry', 'sleepy-seed', 'dizzy-bell', 'sticky-sap', 'smoke-puffball'];
export const CAMP_BERRIES = 3;
 // Every hunt starts with at least this many fluffberries, free from camp.
export const GATHER_TIME = 1.2;
 // Seconds of standing still at a gathering spot.
export const GATHER_REACH = 1.8;
export const DIZZY_FULL = 100;
 // A big bonk or shot adds 50 Dizzy, a buddy's 30, a dizzy bell 40.
export const TRAP_REACH = 1.6, SLEEPY_REACH = 10, BELL_REACH = 4;
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
export const PART_DROP: Record<BeastId, { id: MaterialId; count: number }> = {
  bristleback: { id: DROPS.bristleback.parts.tusks, count: 1 }, puffwart: { id: DROPS.puffwart.parts.throat, count: 1 }, skreel: { id: 'sky-feather', count: 2 },
  hornclack: { id: DROPS.hornclack.parts.horn, count: 1 }, frostmane: { id: DROPS.frostmane.parts.mane, count: 1 },
  paddlepaw: { id: DROPS.paddlepaw.parts.pouch, count: 1 }, rumblesnout: { id: DROPS.rumblesnout.parts.crown, count: 2 },
};
/** The first build kept one count per beast; each carries over as that beast's shed material. */
export const V1_MATERIAL: Record<BeastId, MaterialId> = Object.fromEntries(BEAST_IDS.map((id) => [id, DROPS[id].shed.id])) as Record<BeastId, MaterialId>;
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
export const freshRide = (): Ride => ({ riding: false, meter: 0, fullBonks: 0, phase: 'quiet', timer: 0, grip: false, used: 0, left: 0, pose: 0, landing: 0, plopped: 0 });
export type HuntEvent = { kind: 'splash' | 'dig' | 'pop' | 'mighty' | 'keepsake' | 'quest' | 'finisher' | 'hop-on' | 'ride-bonk' | 'buck-warning' | 'shaken-off' | 'plop' | 'bonk' | 'dizzy' | 'berry' | 'part' | 'nap' | 'bump' | 'shoot' | 'item' | 'interact' | 'grumpy' | 'tired' | 'snooze' | 'intro' | 'roar' | 'covered' | 'weather' | 'visitor' | 'turf-warning' | 'turf' | 'vine' | 'cling' | 'soft' | 'yank' | 'wall' | 'sling' | 'plink' | 'fruit' | 'knockdown' | 'hazard-warning' | 'hazard' | 'finch' | 'wander' | 'away' | 'travel' | 'sniff' | 'order' | 'gather' | 'trap' | 'craft'; spot?: SpotId };
export type Mode = 'village' | 'hunt' | 'nap' | 'calm' | 'camp' | 'victory';
const countRecord = (): Record<BeastId, number> => ({ bristleback: 0, puffwart: 0, skreel: 0, hornclack: 0, frostmane: 0, paddlepaw: 0, rumblesnout: 0 });
const emptyPouch = () => Object.fromEntries([...MATERIAL_IDS, ...ITEM_IDS].map((id) => [id, 0])) as Pouch;
export const freshProfile = (): Profile => ({ charms: { levels: { clover: 0, acorn: 0, feather: 0 }, worn: null }, quests: {}, stars: 0, bountiesClaimed: 0, variantNaps: countRecord(), mightyBest: countRecord(), turfPairs: [], totalPlops: 0, story: { chapter: 0, scenesSeen: [] }, beastBook: Object.fromEntries(BEAST_IDS.map((id) => [id, { met: false, napped: 0, partsBroken: [], best: 0 }])) as unknown as BeastBook, bounties: { day: '', done: [], ready: [] }, extraGrumpyUnlocked: false, hero: null, weapons: Object.fromEntries(Object.keys(WEAPON_TYPES).map((id) => [id, { tier: 1, branch: null }])) as Profile['weapons'], equipped: { dora: 'hammer', enzo: 'bow' }, armour: { owned: [], worn: {} }, pouch: emptyPouch(), ring: [...DEFAULT_RING], snack: null, naps: countRecord(), won: false, hunts: 0 });
export const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
export const distance = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.z - b.z);
export const faceTo = (a: Vec, b: Vec) => Math.atan2(-(b.z - a.z), b.x - a.x);
export const direction = (a: Vec, b: Vec): Vec => { const d = distance(a, b) || 1; return { x: (b.x - a.x) / d, z: (b.z - a.z) / d }; };
export const hero = (maxFluff = 100): Hero => ({ finisher: false, x: 0, z: 7, face: Math.PI / 2, fluff: maxFluff, maxFluff, speed: 0, roll: -1, rollX: 0, rollZ: -1, rollCd: 0, invincible: 0, charge: 0, swing: -1, heavy: false, landed: false, cooldown: 0, slow: 0, hidden: 0, covered: 0 });
export const buddy = () => ({ x: -1.5, z: 8.5, face: Math.PI / 2, speed: 0, swing: -1, cooldown: 1, berry: 3, gather: 0, gatherT: 0, fluff: 100, maxFluff: 100 });
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
export const freshFacts = (): HuntFacts => ({ items: 0, bumps: 0, gathered: 0, dizzies: 0, napped: false, finishers: 0, vines: 0, knockdowns: 0, turfs: 0 });
