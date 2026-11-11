// The Sunken Bellspire: the drowned citadel, its rooms, items, gear, lore and story lines.
// Each map cell is one screen of 30×17 tiles of 16 px. A room covers a rectangle of cells and its tiles sit at fixed
// world coordinates, so walking off one room's edge lands in the room next door.

import { saltRooms, type SaltLiftPlan } from './bellspire-salt-world.js';
import { ORCHARD_EXIT, ORCHARD_RETURN, ORCHARD_ROOMS, type Graft } from './bellspire-orchard-world.js';

import { GLACIER_RETURN, GLACIER_ROOMS, ROOT_LIFT, type GlacierRoom } from './bellspire-glacier-world.js';

export const COLS = 30, ROWS = 17, TILE = 16;
/** A humming crystal's bridge: the slabs its path lays (in world pixels), from the crystal's tile. A slab is two tiles
 *  wide and reaches on to the next one on its row when that one is close, so a row of slabs is one walkway. */
export function crystalSpans(c: number, r: number, path: [number, number][]): { x0: number; x1: number; y: number }[] {
  const cols = path.map(([dc, dr]) => [c + dc, r + dr]);
  return cols.map(([sc, sr]) => {
    let x0 = sc * TILE, x1 = (sc + 2) * TILE;
    for (const [c2, r2] of cols) {
      if (r2 !== sr) continue;
      if (c2 > sc + 2 && c2 <= sc + 6) x1 = Math.max(x1, c2 * TILE);
      if (c2 + 2 < sc && c2 + 2 >= sc - 4) x0 = Math.min(x0, (c2 + 2) * TILE);
    }
    return { x0, x1, y: sr * TILE };
  });
}
export const SCREEN_W = COLS * TILE, SCREEN_H = ROWS * TILE;

export type AreaId = 'hub' | 'halls' | 'docks' | 'towers' | 'crypt' | 'throne' | 'cloud' | 'loft' | 'cast' | 'glass' | 'salt' | 'haul' | 'orchard' | 'cellar' | 'icefalls' | 'bluehollows';
export type WaterArea = 'halls' | 'docks' | 'throne';
export const WATER_AREAS: WaterArea[] = ['halls', 'docks', 'throne'];
export const AREAS: Record<AreaId, { name: string; color: string; tiles: Exclude<AreaId, 'hub' | 'cellar'> | 'rootcellar'; ambient: [number, number, number]; theme: number }> = {
  hub: { name: 'Lakebed Landing', color: '#c9a46a', tiles: 'halls', ambient: [0.5, 0.46, 0.52], theme: 0 },
  halls: { name: 'Flooded Halls', color: '#4f86d9', tiles: 'halls', ambient: [0.34, 0.4, 0.58], theme: 1 },
  docks: { name: 'Reed Docks', color: '#5cae55', tiles: 'docks', ambient: [0.38, 0.48, 0.44], theme: 2 },
  towers: { name: 'Bell Towers', color: '#d9a93a', tiles: 'towers', ambient: [0.5, 0.42, 0.36], theme: 3 },
  crypt: { name: 'Crypt Murals', color: '#9a5fd0', tiles: 'crypt', ambient: [0.16, 0.12, 0.22], theme: 4 },
  throne: { name: 'Sunken Throne', color: '#2fa8a0', tiles: 'throne', ambient: [0.2, 0.36, 0.4], theme: 5 },
  // the Windward Belfry: a cliff climb in low golden sun, then a tall timber bell tower of cold louvre light
  cloud: { name: 'The Cloudstair', color: '#e8895a', tiles: 'cloud', ambient: [0.84, 0.78, 0.74], theme: 6 },
  loft: { name: 'The Belfry Loft', color: '#7f9fd8', tiles: 'loft', ambient: [0.34, 0.38, 0.5], theme: 7 },
  // the Foundry Below: a bell foundry in the warm dark under the citadel, then caverns of glowing volcanic glass
  cast: { name: 'The Casting Halls', color: '#d8652e', tiles: 'cast', ambient: [0.42, 0.28, 0.2], theme: 8 },
  salt: { name: 'Evaporation Steps', color: '#b6b3c9', tiles: 'salt', ambient: [0.48, 0.48, 0.58], theme: 10 },
  haul: { name: 'The Mule Galleries', color: '#aa947e', tiles: 'haul', ambient: [0.35, 0.30, 0.28], theme: 11 },
  orchard: { name: 'The Graft Terraces', color: '#b5ad4d', tiles: 'orchard', ambient: [0.68, 0.66, 0.54], theme: 12 },
  cellar: { name: 'The Root Cellars', color: '#c58259', tiles: 'rootcellar', ambient: [0.61, 0.51, 0.47], theme: 13 },
  icefalls: { name: 'The Ice Falls', color: '#95d7ea', tiles: 'icefalls', ambient: [1, 0.99, 0.94], theme: 14 },
  bluehollows: { name: 'The Blue Hollows', color: '#639acb', tiles: 'bluehollows', ambient: [0.77, 0.87, 0.97], theme: 15 },
  glass: { name: 'The Glasswork Caves', color: '#b04fc4', tiles: 'glass', ambient: [0.3, 0.18, 0.34], theme: 9 },
};
/** The second expansion's two areas: under the Sunken Throne, behind a seal that cracks once the Out-of-Tune Bell is calm. */
export const FOUNDRY_AREAS: AreaId[] = ['cast', 'glass'];
/** The expansion's two areas: reached only once the Lake Mother is calm, by Wayra's boat. */
export const BELFRY_AREAS: AreaId[] = ['cloud', 'loft'];
/** The areas with wind: each keeps one direction (1 blows east, −1 west), turned round by its wind bells. */
export type WindArea = 'cloud' | 'loft';
export const WIND_AREAS: WindArea[] = ['cloud', 'loft'];

export type Ability = 'dash' | 'lantern' | 'double' | 'wallkick' | 'chime' | 'glide' | 'deep' | 'rope' | 'echo' | 'hammer' | 'resonance' | 'ballast' | 'catch' | 'bloom' | 'shear' | 'sunmirror' | 'icepick';
export type HeroId = 'dora' | 'enzo';
/** The order the citadel is meant to be opened up in. */
export const ABILITY_ORDER: Ability[] = ['dash', 'lantern', 'double', 'wallkick', 'chime', 'glide', 'deep', 'rope', 'echo', 'hammer', 'resonance', 'ballast', 'catch', 'bloom', 'shear', 'sunmirror', 'icepick'];
/** The citadel's own seven, before the Windward Belfry. */
export const BASE_ABILITIES: Ability[] = ABILITY_ORDER.slice(0, 7);
/** The citadel's and the Windward Belfry's nine, before the Foundry Below. */
export const BELFRY_ABILITIES: Ability[] = ABILITY_ORDER.slice(0, 9);
/** Each ability's icon in the icon strip (the expansion's were painted later, so they sit after the gear). */
export const abilityIcon = (a: Ability) => (a === 'rope' ? 32 : a === 'echo' ? 33 : a === 'hammer' ? 40 : a === 'resonance' ? 41 : a === 'ballast' ? 48 : a === 'catch' ? 49 : a === 'bloom' ? 56 : a === 'shear' ? 57 : a === 'sunmirror' ? 64 : a === 'icepick' ? 65 : 24 + ABILITY_ORDER.indexOf(a));
export const ABILITIES: Record<Ability, { name: string; hero: HeroId | 'both'; door: string; color: string; how: string; needs: string }> = {
  sunmirror: { name: 'Sun Mirror', hero: 'enzo', door: '', color: '#ffe295', how: 'Use as Enzo at a sun socket to melt ice in the reflected beam.', needs: 'Enzo needs Phuyu’s Sun Mirror.' },
  icepick: { name: 'Ice Pick', hero: 'dora', door: '', color: '#94e5ff', how: 'Dora can climb ribbed ice with Up or hold Down and Attack to stop on a slick floor.', needs: 'Dora needs the Ice Pick from Serac Walk.' },
  bloom: { name: 'Lantern Bloom', hero: 'enzo', door: '', color: '#f3c659', how: 'Use as Enzo near a golden bud to grow a branch.', needs: 'Enzo needs Lantern Bloom.' },
  shear: { name: 'Graft Shear', hero: 'dora', door: '', color: '#c59b64', how: 'Strike an ochre graft tie as Dora after its bud has opened.', needs: 'Dora needs Graft Shear.' },
  ballast: { name: 'Shoulder Shift', hero: 'dora', door: '', color: '#c7bbc1', how: 'Use the ballast station as Dora to call a cargo lift down.', needs: 'Dora needs Shoulder Shift.' },
  catch: { name: 'Lift Catch', hero: 'enzo', door: '', color: '#d8b17b', how: 'Use the brass catch as Enzo to lock a lift level at the lower landing.', needs: 'Enzo needs Lift Catch.' },
  dash: { name: 'Reed Dash', hero: 'dora', door: 'd', color: '#3f8cff', how: 'Dora dashes with C or L, on the ground or once in the air. A dash slips through attacks.', needs: 'Needs Dora’s Reed Dash' },
  lantern: { name: 'Moonwick', hero: 'enzo', door: 'l', color: '#ff9a3c', how: 'As Enzo, hold ↓ and press V to raise or lower the lantern. Raised, it lights dark rooms and makes ghost-glass solid.', needs: 'Needs the Moonwick: a raised lantern opens this hatch' },
  double: { name: 'Wind Leap', hero: 'dora', door: 'j', color: '#4fcf6a', how: 'Dora jumps again in mid-air.', needs: 'Needs Dora’s Wind Leap' },
  wallkick: { name: 'Wall Kick', hero: 'dora', door: 'k', color: '#e8484f', how: 'Dora slides down walls; press jump to kick off. Kick between two walls to climb.', needs: 'Needs Dora’s Wall Kick' },
  chime: { name: 'Bell Chime', hero: 'enzo', door: 'c', color: '#f2c94c', how: 'As Enzo, hold ↑ and press V. The chime rings bells and bell-sealed doors from a distance.', needs: 'Needs the Bell Chime: ring this door with it' },
  glide: { name: 'Lantern Glide', hero: 'enzo', door: 'v', color: '#dfe8ff', how: 'As Enzo, hold jump while falling to glide under the opened lantern.', needs: 'Needs Enzo’s Lantern Glide' },
  deep: { name: 'Deep-Dive Coat', hero: 'both', door: 'q', color: '#2fd3c0', how: 'Both of them can now swim down into the deepest water.', needs: 'Needs the Deep-Dive Coat' },
  rope: { name: 'Bell Rope', hero: 'dora', door: 'y', color: '#d99a52', how: 'In the air near a bell hook, Dora presses attack to throw the rope and swing. Steer to pump the swing; jump to let go.', needs: 'A rope-knot sigil: needs Dora’s Bell Rope' },
  echo: { name: 'Echo Step', hero: 'enzo', door: 'n', color: '#5fe3ff', how: 'As Enzo, ring the Bell Chime (↑ + V) by an echo bell: it leaves three glowing notes to stand on for a few seconds.', needs: 'A note sigil: needs Enzo’s Echo Step' },
  hammer: { name: 'Bell Hammer', hero: 'dora', door: '8', color: '#e0703a', how: 'In the air, Dora holds ↓ and presses attack to slam down with the Bell Hammer. It breaks cracked glass, rings bells, and bounces her high off bronze plates.', needs: 'Cracked glass: needs Dora’s Bell Hammer' },
  resonance: { name: 'Resonance', hero: 'enzo', door: '&', color: '#c58cff', how: 'As Enzo, ring the Bell Chime (↑ + V) by a humming crystal: the crystals line up into a bridge for a few seconds. By a prism, the chime sends a beam that opens beam doors.', needs: 'A beam door: needs Enzo’s Resonance by its prism' },
};

export type SpellId = 'bolt' | 'ember' | 'chime' | 'whirl' | 'frost' | 'gale';
export const SPELLS: Record<SpellId, { name: string; hero: HeroId; mp: number; how: string }> = {
  whirl: { name: 'Whirl Slash', hero: 'dora', mp: 5, how: 'V: Dora spins her sword all around her.' },
  bolt: { name: 'Lantern Bolt', hero: 'enzo', mp: 3, how: 'V: a bolt of lantern fire.' },
  ember: { name: 'Ember Ring', hero: 'enzo', mp: 8, how: 'Hold V, then let go: a ring of embers around Enzo.' },
  chime: { name: 'Bell Chime', hero: 'enzo', mp: 4, how: '↑ + V: rings every bell nearby.' },
  frost: { name: 'Frost Fan', hero: 'enzo', mp: 5, how: 'In the air, a tap of V throws a fan of three hail shards forward and down.' },
  gale: { name: 'Gale Wave', hero: 'enzo', mp: 10, how: 'Hold V long past the Ember Ring, then let go: a rolling wave of wind that knocks foes back and rings wind bells.' },
};

export type Slot = 'weapon' | 'coat' | 'ring' | 'relic';
export type Perk = 'fast' | 'reach' | 'cheapchime' | 'bright' | 'sturdy' | 'swim' | 'lucky' | 'regen' | 'crit' | 'quick' | 'secrets' | 'xp' | 'windward' | 'notes' | 'cool' | 'mend' | 'harvest' | 'grip' | 'tempered' | 'keen' | 'focus';
export type Gear = { name: string; slot: Slot; hero?: HeroId; atk?: number; def?: number; mag?: number; hp?: number; mp?: number; perk?: Perk; text: string; icon: number };
export const GEAR: Record<string, Gear> = {
  'dora-salt-coat': { name: 'Salt-Road Wrap', slot: 'coat', hero: 'dora', def: 7, perk: 'mend', text: 'A plum caravan tunic with felt gaiters. Caravan stamina: HP slowly comes back outside guardian fights.', icon: 50 },
  'enzo-salt-coat': { name: 'Waxed Haul Coat', slot: 'coat', hero: 'enzo', def: 7, perk: 'mend', text: 'A slate coat with a broad ochre hem. Caravan stamina: HP slowly comes back outside guardian fights.', icon: 51 },
  'dora-glacier-coat': { name: 'Saffron Pass Coat', slot: 'coat', hero: 'dora', def: 8, perk: 'grip', text: 'A quilted saffron mountaineer’s coat with burgundy lining. Sure grip: slide half as far on ice.', icon: 66 },
  'enzo-glacier-coat': { name: 'Indigo Drift Parka', slot: 'coat', hero: 'enzo', def: 8, perk: 'grip', text: 'Deep indigo wool with pale fleece at the cuffs. Sure grip: slide half as far on ice.', icon: 67 },
  'dora-orchard-coat': { name: 'Harvest Tunic', slot: 'coat', hero: 'dora', def: 7, perk: 'harvest', text: 'An ochre field tunic with a brown hem. Harvest: foes drop healing more often, and it heals more.', icon: 58 },
  'enzo-orchard-coat': { name: 'Graft Keeper’s Coat', slot: 'coat', hero: 'enzo', def: 7, perk: 'harvest', text: 'An olive orchard coat with pale sage trim. Harvest: foes drop healing more often, and it heals more.', icon: 59 },
  'bronze-sword': { name: 'Bronze Sword', slot: 'weapon', hero: 'dora', atk: 2, text: 'Short, light and sharp enough.', icon: 0 },
  'reed-cutter': { name: 'Reed-Cutter', slot: 'weapon', hero: 'dora', atk: 5, perk: 'fast', text: 'A curved green blade. Swings come round faster.', icon: 1 },
  moonsteel: { name: 'Moonsteel Blade', slot: 'weapon', hero: 'dora', atk: 9, perk: 'reach', text: 'Silver and cold. A longer arc.', icon: 2 },
  'oak-staff': { name: 'Oak Lantern Staff', slot: 'weapon', hero: 'enzo', atk: 2, mag: 1, text: 'Enzo’s old staff, with the lantern on its hook.', icon: 3 },
  'bell-staff': { name: 'Bell Staff', slot: 'weapon', hero: 'enzo', atk: 5, mag: 3, perk: 'cheapchime', text: 'A bronze staff with a bell on top. The Bell Chime costs 2 less MP.', icon: 4 },
  'star-lamp': { name: 'Star Lamp', slot: 'weapon', hero: 'enzo', atk: 8, mag: 6, perk: 'bright', text: 'A lamp that holds a star. The lantern shines much further.', icon: 5 },
  'teal-coat': { name: 'Teal Explorer Coat', slot: 'coat', def: 1, text: 'Dora’s favourite coat, full of pockets.', icon: 6 },
  'rust-coat': { name: 'Rust Long Coat', slot: 'coat', def: 1, text: 'Enzo’s long coat. Warm, if a bit dusty.', icon: 7 },
  'condor-talon': { name: 'Condor Talon', slot: 'weapon', hero: 'dora', atk: 13, perk: 'reach', text: 'A curved blade of dark steel with a white feathered guard. Hits hard, with a long arc.', icon: 36 },
  'carillon-staff': { name: 'Carillon Staff', slot: 'weapon', hero: 'enzo', atk: 10, mag: 10, perk: 'notes', text: 'Three small bells around the lantern. Echo notes last twice as long.', icon: 37 },
  'windward-jacket': { name: 'Windward Jacket', slot: 'coat', hero: 'dora', def: 5, perk: 'windward', text: 'Dusty-rose quilting and a feathered collar, made for the mountain. Gusts push half as hard.', icon: 34 },
  'highland-cloak': { name: 'Highland Cloak', slot: 'coat', hero: 'enzo', def: 4, mp: 8, perk: 'windward', text: 'Slate-blue felt with a cream-and-red band. +8 MP, and gusts push half as hard.', icon: 35 },
  'snail-coat': { name: 'Snail-Shell Coat', slot: 'coat', def: 4, perk: 'sturdy', text: 'A coat with a shell on the back. Hits no longer knock the wearer back.', icon: 8 },
  'reed-coat': { name: 'Reedweave Coat', slot: 'coat', def: 2, perk: 'swim', text: 'Woven from golden reeds. Swim a third faster.', icon: 9 },
  'reed-ring': { name: 'Lucky Reed Ring', slot: 'ring', perk: 'lucky', text: 'A ring of green reed with a tiny bud. A quarter more coins.', icon: 11 },
  'frog-ring': { name: 'Frog Ring', slot: 'ring', hp: 10, text: 'A gold ring with a little frog on it. +10 HP.', icon: 12 },
  'moon-ring': { name: 'Moon Ring', slot: 'ring', mp: 6, perk: 'regen', text: 'A moonstone ring. +6 MP, and MP slowly comes back.', icon: 13 },
  'puma-tooth': { name: 'Puma Tooth', slot: 'relic', perk: 'crit', text: 'From the Puma of the Murals. Some hits land twice as hard.', icon: 14 },
  'condor-feather': { name: 'Condor Feather', slot: 'relic', perk: 'quick', text: 'A long black feather. Run a little faster.', icon: 15 },
  'salt-lamp': { name: 'Salt Lamp', slot: 'relic', perk: 'secrets', text: 'Pink salt that glows. Cracked walls shine, and light reaches further.', icon: 16 },
  'bell-charm': { name: 'Bell Charm', slot: 'relic', perk: 'xp', text: 'A small golden bell. A quarter more XP.', icon: 17 },
  // the Foundry Below
  'forge-apron': { name: 'Forge Apron', slot: 'coat', hero: 'dora', def: 6, perk: 'cool', text: 'Rust-red leather, a linen shirt, thick gloves and goggles. The forge heat builds half as fast.', icon: 42 },
  'ash-smock': { name: 'Ashwork Smock', slot: 'coat', hero: 'enzo', def: 5, mp: 6, perk: 'cool', text: 'Charcoal felt with brass buckles and a folded hood. +6 MP, and the forge heat builds half as fast.', icon: 43 },
  'obsidian-edge': { name: 'Obsidian Edge', slot: 'weapon', hero: 'dora', atk: 16, perk: 'keen', text: 'A blade of black volcanic glass. Very sharp, and keener still.', icon: 46 },
  'ladle-staff': { name: 'Founder’s Ladle', slot: 'weapon', hero: 'enzo', atk: 11, mag: 13, perk: 'focus', text: 'A staff topped with a little glowing ladle of bronze. Its magic runs hot.', icon: 47 },
  // the expansions' weapons (09-11-2026): each area's first guardian gives Enzo a staff, its second Dora a blade
  'tally-staff': { name: 'Tally Bell Staff', slot: 'weapon', hero: 'enzo', atk: 13, mag: 15, perk: 'regen', text: 'Slate-grey wood bound in ochre cord, with a pack bell and a rock-salt lantern. MP slowly comes back.', icon: 68 },
  'salt-sabre': { name: 'Saltglass Sabre', slot: 'weapon', hero: 'dora', atk: 20, perk: 'crit', text: 'A curved blade of clear pink salt crystal. Some hits land twice as hard.', icon: 69 },
  'bloom-staff': { name: 'Bloomwood Staff', slot: 'weapon', hero: 'enzo', atk: 14, mag: 17, perk: 'focus', text: 'Pale birch wound with a living vine, with a blossom lantern. Its magic runs hot.', icon: 70 },
  'graft-blade': { name: 'Graftwood Blade', slot: 'weapon', hero: 'dora', atk: 21, perk: 'fast', text: 'Olive-gold grafted wood with a bronze edge. Swings come round faster.', icon: 71 },
  'sun-lamp': { name: 'Sunpass Lamp', slot: 'weapon', hero: 'enzo', atk: 16, mag: 20, perk: 'bright', text: 'A brass staff with a sun-disc lantern in a mirror ring. The lantern shines much further.', icon: 72 },
  'sun-blade': { name: 'Sunpass Blade', slot: 'weapon', hero: 'dora', atk: 24, perk: 'keen', text: 'Clear glacier ice with a gold sun-ray guard. Very sharp, and keener still.', icon: 73 },
  'cinder-charm': { name: 'Cinder Charm', slot: 'relic', perk: 'tempered', text: 'An ember that never goes out, in a little iron cage. Tempered: +3 defence.', icon: 45 },
};
/** What each perk adds to the numbers (the rest change how things work): Tupa's recasts use these too. */
export const PERK_STATS: Partial<Record<Perk, { atk?: number; def?: number; mag?: number }>> = { tempered: { def: 3 }, keen: { atk: 3 }, focus: { mag: 3 } };
/** Tupa's recasts: one perk worked into a piece of gear, for coins. */
export const RECAST_PERKS: Perk[] = ['cool', 'tempered', 'keen', 'focus', 'lucky', 'regen'];
export const RECAST_PRICE = 120;
export const START_EQUIP: Record<HeroId, Record<Slot, string | null>> = {
  dora: { weapon: 'bronze-sword', coat: 'teal-coat', ring: null, relic: null },
  enzo: { weapon: 'oak-staff', coat: 'rust-coat', ring: null, relic: null },
};

export type FoodId = 'cake' | 'tea';
export const FOOD: Record<FoodId, { name: string; text: string; icon: number }> = {
  cake: { name: 'Quinoa Cake', text: 'Heals the leader by 40% of their HP.', icon: 18 },
  tea: { name: 'Hot Muña Tea', text: 'Restores half of both heroes’ MP, and wakes a knocked-out hero.', icon: 19 },
};
export const SHOP: { id: string; price: number }[] = [
  { id: 'cake', price: 12 }, { id: 'tea', price: 20 }, { id: 'reed-ring', price: 80 }, { id: 'reed-coat', price: 110 },
  { id: 'moon-ring', price: 140 }, { id: 'reed-cutter', price: 150 }, { id: 'bell-staff', price: 160 },
];

export type BossId = 'frog' | 'hydra' | 'puma' | 'warden' | 'mother' | 'condor' | 'clappers' | 'tune' | 'founder' | 'choir' | 'hollow' | 'weighmaster' | 'panback' | 'tollkeeper' | 'bracken-stag' | 'rootback' | 'graft-mother' | 'glass-vicuna' | 'serac-osjollo' | 'sun-gate';
export const BOSSES: Record<BossId, { name: string; title: string; hp: number; atk: number; xp: number; reward: string[] }> = {
  frog: { name: 'The Grand Frog Idol', title: 'Guardian of the Flooded Halls', hp: 220, atk: 8, xp: 120, reward: ['ability:lantern', 'heart'] },
  hydra: { name: 'The Reed Hydra', title: 'Tangle of the Reed Docks', hp: 420, atk: 12, xp: 220, reward: ['spell:ember', 'heart'] },
  puma: { name: 'The Puma of the Murals', title: 'Painted Hunter of the Crypt', hp: 480, atk: 15, xp: 300, reward: ['gear:puma-tooth', 'drop'] },
  warden: { name: 'The Bell Warden', title: 'The Bell That Rang at Midnight', hp: 600, atk: 14, xp: 420, reward: ['ability:glide', 'heart'] },
  mother: { name: 'The Lake Mother', title: 'She Who Sleeps Beneath', hp: 720, atk: 16, xp: 600, reward: [] },
  condor: { name: 'The Hail Condor', title: 'Storm Above the Cloudstair', hp: 1000, atk: 20, xp: 700, reward: ['ability:echo', 'spell:frost'] },
  clappers: { name: 'The Twin Clappers', title: 'Two Tongues of One Bell', hp: 820, atk: 17, xp: 800, reward: ['spell:gale', 'drop'] },
  tune: { name: 'The Out-of-Tune Bell', title: 'The Belfry’s Sour Heart', hp: 1300, atk: 24, xp: 1000, reward: [] },
  founder: { name: 'The Molten Founder', title: 'Smith of the Casting Halls', hp: 1250, atk: 27, xp: 1100, reward: ['ability:resonance', 'heart'] },
  choir: { name: 'The Glass Choir', title: 'Three Voices in the Glass', hp: 1000, atk: 27, xp: 1200, reward: ['gear:ladle-staff', 'drop'] },
  weighmaster: { name: 'Whiteback Weighmaster', title: 'The Last Pack Llama', hp: 660, atk: 22, xp: 1350, reward: ['heart', 'gear:tally-staff'] },
  panback: { name: 'Panback Armadillo', title: 'Keeper of the Weighing Pan', hp: 820, atk: 24, xp: 1450, reward: ['drop', 'gear:salt-sabre'] },
  tollkeeper: { name: 'The Last Tollkeeper', title: 'Guardian of the Caravan Road', hp: 1000, atk: 25, xp: 1750, reward: ['heart'] },
  hollow: { name: 'The Hollow Bell', title: 'The Bell Cast Without a Voice', hp: 1600, atk: 26, xp: 1500, reward: [] },
  'bracken-stag': { name: 'The Bracken Stag', title: 'Watcher of the Nursery', hp: 720, atk: 20, xp: 1500, reward: ['drop', 'gear:bloom-staff'] },
  rootback: { name: 'The Rootback', title: 'Keeper of the Cistern', hp: 860, atk: 22, xp: 1600, reward: ['heart', 'gear:graft-blade'] },
  'glass-vicuna': { name: 'The Glass-Horn Vicuña', title: 'The Road Above the Snowline', hp: 720, atk: 22, xp: 1600, reward: ['gear:sun-lamp'] },
  'serac-osjollo': { name: 'The Serac Osjollo', title: 'The Hunter in the Blue Ice', hp: 850, atk: 24, xp: 1800, reward: ['gear:sun-blade'] },
  'sun-gate': { name: 'The Sun Gate Warden', title: 'The Face of the High Pass', hp: 980, atk: 26, xp: 2100, reward: [] },
  'graft-mother': { name: 'The Mother of Grafts', title: 'Heart Beneath the Orchard', hp: 1040, atk: 24, xp: 1850, reward: [] },
};
/** The Foundry Below's two guardians: both must be calm before the deep seal opens on the Hollow Bell. */
export const FOUNDRY_GUARDIANS = ['founder', 'choir'] as const satisfies readonly BossId[];
/** The Windward Belfry's two guardians: both must be calm before the belfry seal opens on the Out-of-Tune Bell. */
export const BELFRY_GUARDIANS = ['condor', 'clappers'] as const satisfies readonly BossId[];
/** Every guardian, citadel and belfry, in story order: the Echo Trials' guardian rush meets all eight. */
export const SALT_GUARDIANS = ['weighmaster', 'panback', 'tollkeeper'] as const satisfies readonly BossId[];
export const GLACIER_GUARDIANS = ['glass-vicuna', 'serac-osjollo', 'sun-gate'] as const satisfies readonly BossId[];
export const ORCHARD_GUARDIANS = ['bracken-stag', 'rootback', 'graft-mother'] as const satisfies readonly BossId[];
export const ALL_BOSSES: BossId[] = ['frog', 'hydra', 'puma', 'warden', 'mother', 'condor', 'clappers', 'tune', 'founder', 'choir', 'hollow'];

/** The four area guardians: each holds one bell seal on the throne door, and all four must be calmed before it opens. */
export const GUARDIANS = ['frog', 'hydra', 'puma', 'warden'] as const satisfies readonly BossId[];
export const GUARDIAN_AREA: Record<(typeof GUARDIANS)[number], AreaId> = { frog: 'halls', hydra: 'docks', puma: 'crypt', warden: 'towers' };

/** Lore murals: the painted panels (`panel` indexes the six paintings). */
/** Each candle shrine's own name, shown on the map, the shrine card and on arrival. */
export const SHRINE_NAMES: Record<string, string> = {
  'salt-gate': 'Salt Gate Candle', 'salt-mulegate': 'Mule Gate Candle', 'salt-toll-road': 'Toll Road Candle',
  'glacier-camp': 'Phuyu’s Camp Candle', 'glacier-meltwater': 'Meltwater Candle',
  'glacier-sun-gate': 'Sun Gate Candle',
  'orchard-wicket': 'Orchard Wicket Candle', 'orchard-cistern': 'Cistern Candle', 'orchard-weir': 'Lantern Weir Candle',
  landing: 'Landing Candle', chapel: 'Chapel Candle', mill: 'Reed Mill Candle', gears: 'Bell Loft Candle',
  cshrine: 'Mural Crypt Candle', tshrine: 'Pearl Throne Candle',
  cliffoot: 'Cliff Foot Candle', bannerwalk: 'Bannerwalk Candle', loftbase: 'Belfry Candle',
  fgate: 'Foundry Gate Candle', forgeshrine: 'Furnace Candle', caveshrine: 'Glass Candle',
};

export const MURALS: { panel: number; text: string }[] = [
  { panel: 0, text: 'A citadel of bells beside a great lake. Every midnight the bells rang, and the lake listened.' },
  { panel: 1, text: 'The people feared the water would rise too high. They silenced the bells, and the lake slept over the towers.' },
  { panel: 0, text: 'Every year a reed-boat crew left quinoa on the water, to thank the sleeping lake.' },
  { panel: 2, text: 'One keeper stayed behind: Ukumari, the bear who rang the bells. The water closed over the bell tower.' },
  { panel: 2, text: 'Ukumari polished every bell for a thousand years, and nobody heard them.' },
  { panel: 3, text: 'Under the lake sleeps the Lake Mother. She sleeps while the bells are quiet, and wakes when they ring.' },
  { panel: 1, text: 'High in the towers the bell ropes were tied off, and the great bell was hung in chains so it could never ring.' },
  { panel: 2, text: 'The keeper’s room: one chair, one cup, and a thousand bells, all polished.' },
  { panel: 4, text: 'The paint on this panel is fresh: a bear pulling a bell rope, and the lake draining away.' },
  { panel: 5, text: 'A last little panel, painted very carefully: the bear, the lake spirit and two chinchillas together under the sun.' },
  // the Windward Belfry's eight (panels 6 to 13)
  { panel: 6, text: 'The citadel had a twin: a belfry high on the mountain, so the bells could answer each other across the lake.' },
  { panel: 12, text: 'Some bells were tuned to the air itself. Ring one, and its notes hang there long enough to stand on.' },
  { panel: 10, text: 'The belfry’s great bell cracked in a hard winter. After that it rang a sour note, and the wind forgot its way.' },
  { panel: 9, text: 'The great bell had two clappers, iron and glass. Since the crack, they only quarrel.' },
  { panel: 11, text: 'The bellringers crossed the gorge on ropes, swinging from hook to hook. Children practised on the low ones.' },
  { panel: 8, text: 'When the bell went sour, a condor of the high storms came to sit on the bridge, and hail followed it.' },
  { panel: 13, text: 'A panel nobody had finished: the mended bell ringing in tune, and the sun coming up over both belfries.' },
  { panel: 7, text: 'The people of the lake carried every bell up the cliff on their backs, and strung them up on ropes.' },
  // the Foundry Below's six (panels 14 to 19)
  { panel: 14, text: 'Every bell of the lake was cast down here, in a foundry inside the sleeping mountain.' },
  { panel: 15, text: 'One bell came out of the mould hollow, with no voice at all. The founders were ashamed, and turned away from it.' },
  { panel: 16, text: 'Left alone in the dark, the hollow bell called out to anything that would answer. Embers and glass answered.' },
  { panel: 17, text: 'In the caves below, the glass learned to sing. Three voices, low, middle and high, always in the same order.' },
  { panel: 18, text: 'Two small figures: one strikes a bell with a hammer, one rings a staff, and the crystals line up to listen.' },
  { panel: 19, text: 'The last panel: the hollow bell made whole, golden, ringing with the citadel and the belfry above it.' },
  { panel: 20, text: 'The orchard steps once carried more baskets than the road could carry mules.' },
  { panel: 21, text: 'A light wakes the graft. A cut gives it somewhere to grow.' },
  { panel: 22, text: 'The first roots kept watch when the orchard keeper fell asleep.' },
  { panel: 24, text: 'The vizcacha keepers turned the sun toward the ice, and the caravans went over the high pass again.' },
];
/** How many murals the citadel itself holds (the rest are the belfry's). */
export const BASE_MURALS = 10;
/** ...and with the Windward Belfry's: the rest are the Foundry Below's. */
export const BELFRY_MURALS = 18;

export type Who = 'dora' | 'enzo' | 'wayra' | 'ukumari' | 'mother' | 'sign' | 'bell' | 'tupa' | 'hollow' | 'founder' | 'phuyu' | 'killa' | 'suma';
export type Line = { who: Who; text: string };
export const NAMES: Record<Who, string> = { dora: 'Dora', enzo: 'Enzo', wayra: 'Wayra', ukumari: 'Ukumari', mother: 'The Lake Mother', sign: '', bell: 'The Out-of-Tune Bell', tupa: 'Tupa', hollow: 'The Hollow Bell', founder: 'The Molten Founder', phuyu: 'Phuyu', killa: 'Killa', suma: 'Suma' };
export const SCRIPTS: Record<string, Line[]> = {
  'glass-vicuna': [
    { who: 'enzo', text: 'It plants both hooves before it charges. I can turn the sun into that plug.' },
    { who: 'dora', text: 'I’ll jump the charge, then strike when it skids into the water.' },
  ],
  'serac-osjollo': [
    { who: 'enzo', text: 'I’ll melt its perch, then freeze the fall with Frost Fan.' },
    { who: 'dora', text: 'I’ll climb it and meet the cat on the ledge when it leaps back.' },
  ],
  'sun-gate': [
    { who: 'enzo', text: 'Wait for the eye to shine. I can catch its own beam in the mirror.' },
    { who: 'dora', text: 'I’ll jump the sweep and strike the face when it goes into shadow.' },
  ],
  'bracken-stag': [
    { who: 'enzo', text: 'That branch could catch its antlers. I’ll wake the bud before it charges.' },
    { who: 'dora', text: 'Then I cut the tie while it’s caught.' },
  ],
  rootback: [
    { who: 'dora', text: 'The shell’s too thick. Can you get that graft under it, Enzo?' },
    { who: 'enzo', text: 'Once it lifts, cut the tie and strike underneath.' },
  ],
  'graft-mother': [
    { who: 'enzo', text: 'Only one bud shines at a time. I’ll wake the one on the bright side.' },
    { who: 'dora', text: 'I’ll cut its tie when the roots settle. Then we’ll switch sides.' },
  ],
  intro: [
    { who: 'enzo', text: 'The whole lake drained away in one night. And listen, Dora: bells.' },
    { who: 'dora', text: 'Somebody is ringing them. Let’s go down and find out who, and why.' },
    { who: 'enzo', text: 'That candle shrine will keep us safe. Walk up to it and press ↑ to rest and save.' },
  ],
  wayra: [
    { who: 'wayra', text: 'Visitors! A whole citadel under my raft, and nobody to sell cakes to. I’m Wayra.' },
    { who: 'wayra', text: 'Quinoa cakes, hot muña tea, and a few nice things I fished out of the mud. Press ↑ by my raft to shop.' },
  ],
  bell: [
    { who: 'enzo', text: 'This bell is tied to the water. Hit it, and the halls drain or flood.' },
    { who: 'dora', text: 'Low water for walking, high water for swimming. Got it.' },
  ],
  deep: [{ who: 'enzo', text: 'It’s too deep to dive down here. The water pushes us back up.' }],
  frog: [
    { who: 'dora', text: 'That frog statue is the size of a house.' },
    { who: 'enzo', text: 'And it’s waking up. Watch its eyes: when they flash, it’s about to move.' },
  ],
  frogDone: [
    { who: 'enzo', text: 'It’s gone back to sleep. And look, it was sitting on a wick of moonlight.' },
    { who: 'enzo', text: 'My lantern can hold it! Hold ↓ and press V as me to raise it. Dark rooms and ghost-glass won’t stop us now.' },
  ],
  hydra: [{ who: 'dora', text: 'The reeds are moving on their own. Three heads, Enzo!' }, { who: 'enzo', text: 'Each head glows before it strikes. Step aside, then hit back.' }],
  hydraDone: [{ who: 'enzo', text: 'The reeds have settled back into the lagoon. I can feel embers in the lantern now.' }, { who: 'enzo', text: 'Hold V and let go for an Ember Ring.' }],
  puma: [{ who: 'dora', text: 'The puma in the painting just blinked.' }, { who: 'enzo', text: 'It crouches before it pounces. Jump or dash through.' }],
  pumaDone: [{ who: 'dora', text: 'It stepped back into its mural and curled up to sleep. It left a tooth behind.' }],
  warden: [{ who: 'enzo', text: 'The great bell! This is the one we’ve been hearing every midnight.' }, { who: 'dora', text: 'Jump the rings, watch the chains, and keep moving.' }],
  wardenDone: [
    { who: 'enzo', text: 'It’s quiet now. Inside the bell there’s a cloth of lantern light.' },
    { who: 'enzo', text: 'Hold jump while I’m falling and I can glide with it!' },
  ],
  keeper: [
    { who: 'ukumari', text: 'Oh! Visitors! Nobody has visited in a thousand years. I’m Ukumari, keeper of the bells.' },
    { who: 'dora', text: 'Ukumari, were you the one ringing the bells at midnight?' },
    { who: 'ukumari', text: 'I was. I only wanted someone to see the citadel again. I rang them just once…' },
    { who: 'ukumari', text: 'But the bells woke the Lake Mother, and she pulled her water away to look. Now she can’t get back to sleep.' },
    { who: 'enzo', text: 'Then we’ll calm her down, and ring her a lullaby with the Bell Chime.' },
    { who: 'ukumari', text: 'Would you? I’ll open the throne door for you. Be gentle with her.' },
  ],
  /** meeting Ukumari before every guardian is calm (the restless ones are named after these lines) */
  keeperEarly: [
    { who: 'ukumari', text: 'Oh! Visitors! Nobody has visited in a thousand years. I’m Ukumari, keeper of the bells.' },
    { who: 'dora', text: 'Ukumari, were you the one ringing the bells at midnight?' },
    { who: 'ukumari', text: 'I was. I only wanted someone to see the citadel again. I rang them just once…' },
    { who: 'ukumari', text: 'But the bells woke the Lake Mother, and the guardians too. Each one holds a bell seal on the throne door.' },
  ],
  mother: [{ who: 'mother', text: 'WHO RINGS… WHO WAKES ME…' }, { who: 'enzo', text: 'She’s not angry, Dora, just tired. Calm her down, and keep clear of her sweeps.' }],
  motherDone: [
    { who: 'mother', text: '…A lullaby. Thank you, little ones. I will sleep now, and my water will come home.' },
    { who: 'ukumari', text: 'And I’ll ring the bells just once a year, at the festival, so everybody remembers the citadel.' },
    { who: 'dora', text: 'We’ll come every year to listen.' },
  ],
  firstDark: [{ who: 'enzo', text: 'It’s so dark in here. My lantern only lights a little circle.' }],
  ghost: [{ who: 'enzo', text: 'Ghost-glass! It only exists in lantern light. Keep the lantern raised and stay close.' }],

  // ─── the Windward Belfry ───────────────────────────────────────────────
  /** told to a save that has already calmed the Lake Mother, at the next shrine rest */
  belfryCall: [
    { who: 'wayra', text: 'Dora! Enzo! Since the lake settled, I keep hearing a bell from up the mountain. A sour one.' },
    { who: 'wayra', text: 'There’s a cliff path above the shore. Find my boat by the landing and I’ll row you over.' },
  ],
  boatEarly: [{ who: 'wayra', text: 'My boat? Not while the lake is this restless, little ones. Calm whatever lives under it first.' }],
  cliff: [
    { who: 'enzo', text: 'The Lake Mother said the citadel had a twin. That must be it, right at the top: the Windward Belfry.' },
    { who: 'dora', text: 'And that’s the sour bell Wayra heard. Mind the wind up here, Enzo. It pushes.' },
  ],
  wind: [{ who: 'enzo', text: 'A wind bell. Ring it, and the wind should turn round. Hit it, or ring it with the Bell Chime.' }],
  rope: [{ who: 'dora', text: 'A bell rope with a hook on the end. Jump near a bell hook, then press attack to swing!' }],
  echo: [{ who: 'enzo', text: 'An echo bell. If I ring it with the chime, its notes should hang in the air long enough to climb.' }],
  condor: [
    { who: 'dora', text: 'That’s no ordinary condor. It’s carrying the storm with it.' },
    { who: 'enzo', text: 'The planks won’t hold for long, and the wind keeps changing. Watch its wings: they rise before the hail.' },
  ],
  condorDone: [
    { who: 'enzo', text: 'It’s settled on the bridge post, all its hail gone. And the bell on its neck rang a clear note.' },
    { who: 'enzo', text: 'I can hear that note in the lantern now. Ring an echo bell with the chime, and I can make steps of it.' },
  ],
  clappers: [
    { who: 'dora', text: 'Two clappers, and they’re both angry. Only a good hard blade is going to dent the iron one.' },
    { who: 'enzo', text: 'And the glass one only rings for me. Dora takes the iron, I take the glass. Tag between them!' },
  ],
  clappersDone: [
    { who: 'dora', text: 'They’ve stopped quarrelling. Look, they’re just hanging there side by side.' },
    { who: 'enzo', text: 'All that wind they were stirring up went into the lantern. Hold V a long time, and I can let it go as a Gale Wave.' },
  ],
  tune: [
    { who: 'bell', text: 'BONNNG… WRONG… EVERYTHING RINGS WRONG…' },
    { who: 'enzo', text: 'It isn’t angry, Dora. It hurts. Every note it rings is out of tune.' },
    { who: 'dora', text: 'Then let’s ring it back into tune. Watch the wind, and the notes when they come.' },
  ],
  tuneDone: [
    { who: 'bell', text: '…There. That’s the note. I had forgotten how it sounded.' },
    { who: 'enzo', text: 'Listen, Dora. The citadel is answering it from the lake.' },
    { who: 'dora', text: 'Both belfries, in tune. Ukumari is going to love this.' },
  ],
  trials: [
    { who: 'enzo', text: 'Listen, Dora: the shrine candles hum with the belfry’s note now. Echo Trials. We can race each area again, or meet all eight guardians in a row.' },
    { who: 'dora', text: 'At any lit shrine, then. The Trials page in the menu keeps our best times, and a bell of bronze, silver or gold for each.' },
  ],

  // ─── the Foundry Below ─────────────────────────────────────────────────
  /** told at the next shrine rest once the Out-of-Tune Bell is calm */
  foundryCall: [
    { who: 'ukumari', text: 'Little ones! When the belfry rang in tune, something answered from under the throne. A seal in the floor by the Pearl Throne Candle has cracked.' },
    { who: 'ukumari', text: 'The founders who cast our bells worked down there, long ago. It will be hot. Mind yourselves.' },
  ],
  foundry: [
    { who: 'enzo', text: 'Feel that heat, Dora. A whole foundry, still glowing after a thousand years.' },
    { who: 'dora', text: 'Watch the heat gauge by our names. Shade and mist cool us down; a shrine cools us right off.' },
  ],
  tupa: [
    { who: 'tupa', text: 'Oh! Customers, after all this time. I’m Tupa. I cast bells, once. Now I mostly keep the furnaces company.' },
    { who: 'tupa', text: 'Bring me your gear and some coins, and I’ll recast it in the fire with a little something extra worked in. Press ↑ by my anvil.' },
    { who: 'tupa', text: 'And take care down there. One of our bells came out hollow, and it has been calling to the dark ever since.' },
  ],
  channel: [{ who: 'enzo', text: 'Molten bronze, right across the floor. My Frost Fan should cool it into a crust we can walk on. Jump, then tap V over it.' }],
  vents: [{ who: 'dora', text: 'Those vents puff out mist, and the mist hardens the slag for a little while. Wait for a puff, then go!' }],
  glassfloor: [{ who: 'dora', text: 'Cracked glass. With the Bell Hammer I can slam right through it: jump, then hold ↓ and press attack.' }],
  founder: [
    { who: 'founder', text: 'MORE BRONZE… THE MOULD IS NOT FULL… IT IS NEVER FULL…' },
    { who: 'enzo', text: 'It’s far too hot to hurt, Dora. Let me frost it first: wherever my Frost Fan hits, it cools, and your blade can bite there.' },
  ],
  founderDone: [
    { who: 'founder', text: '…Cool. I had forgotten cool. Thank you. Take my listening, little one: the glass below will hear you now.' },
    { who: 'enzo', text: 'I can hear the crystals humming, Dora. If I ring the chime by one, they should line up for me. And the prisms send a beam.' },
  ],
  crystal: [{ who: 'enzo', text: 'A humming crystal. Ring the chime by it (↑ + V) and the crystals should line up into a bridge.' }],
  choir: [
    { who: 'enzo', text: 'Three singers, Dora: low, middle and high. Listen to the order they sing in.' },
    { who: 'dora', text: 'Then ring their notes back in the same order: hit each one when it’s its turn.' },
  ],
  choirDone: [
    { who: 'dora', text: 'They’re bowing. I think that was a thank-you.' },
    { who: 'enzo', text: 'The deep seal by the Furnace Candle should be open now. The hollow bell is down there.' },
  ],
  hollow: [
    { who: 'hollow', text: '…… …… ……' },
    { who: 'enzo', text: 'It has no voice at all, Dora. That’s why it calls everything to it. The lava is rising: stay high!' },
    { who: 'dora', text: 'A good slam on its crown should ring it. Let’s find its note.' },
  ],
  hollowDone: [
    { who: 'hollow', text: '…Bonnng. …Is that me? Is that my voice?' },
    { who: 'tupa', text: 'It is. A good, warm voice. Welcome home, little bell.' },
    { who: 'dora', text: 'Three bells now: the citadel, the belfry and the foundry. Let’s go up and listen to them all.' },
  ],
};

/**
 * A room as text. `.` air, `#` stone, `=` a ledge you can jump up through, `H` ladder, `g` ghost-glass (solid only in
 * a raised lantern's light), `x` a cracked wall that breaks, `^` sharp salt or brambles (a touch costs a little HP and
 * puts you back on the last safe ledge), `f` a floating reed platform (rides the water; the mark is where it rests).
 * Doors: `d` dash, `j` Wind Leap, `l` lantern hatch, `k` Wall Kick, `c` bell-sealed (ring it with the Bell Chime),
 * `u` Ukumari's throne door, `b` a boss room seal (shut while the boss is awake).
 * Things: `S` candle shrine, `M` Wayra's raft, `R` mural, `C` chest, `A` ability pedestal, `B` water bell, `O` boss,
 * `U` Ukumari, `@` the start, `T` torch, `i` candle (breaks for coins), `w` moonlit window, `h` hanging bell, `v` reed
 * boat wreck. Enemies: `F` stone lake-frog, `m` lantern moth, `e` eel serpent, `r` reed-boat sentinel, `K` condor
 * knight, `I` bell imp, `a` drowned armour shell, `z` mud vizcacha, `J` glow jelly, `G` salt golem.
 *
 * The Windward Belfry adds: `o` a bell hook (Dora's rope catches it), `Q` an echo bell, `W` a wind bell, `P` the pivot
 * of a giant swinging bell, `D` Wayra's boat; doors `y` a rope-knot sigil (Bell Rope), `n` a note sigil (Echo Step)
 * and `Z` the belfry seal (open once the Hail Condor and the Twin Clappers are calm); enemies `Y` wind spirit, `X`
 * hail-hawk, `L` clapper creature, `E` bell-beetle.
 *
 * Water: `water[area level]` is the row whose middle the surface sits in when that area's water is low (0) or high (1);
 * `null` is dry. Below row `deep` the water is too deep to dive without the Deep-Dive Coat.
 */
export type Room = {
  id: string; area: AreaId; gx: number; gy: number; w: number; h: number; rows: string[];
  water?: [number | null, number | null]; deep?: number; dark?: boolean;
  chests?: string[]; ability?: Ability; murals?: number[]; boss?: BossId; script?: string;
  /** gust zones (room tiles, inclusive): [c0, r0, c1, r1, strength]; the push is strength × the area's wind
   *  direction. `boss` zones blow only while a guardian is fighting. */
  gusts?: ([number, number, number, number, number] | [number, number, number, number, number, 'boss'])[];
  /** for each echo bell (`Q`, in order), where its three notes appear: tile offsets from the bell; each note is a
   *  two-tile ledge you can jump up through */
  echoes?: [number, number][][];
  /** for each giant swinging bell (`P`, its pivot, in order): rope length in tiles, swing in radians, period in ticks
   *  and a phase (0 to 1) */
  swings?: { len: number; amp: number; period: number; phase: number }[];
  /** part of the Windward Belfry (counted for 100% only once the expansion's totals are added) */
  exp?: boolean;
  /** part of the Foundry Below (the second expansion; `exp` is set too) */
  fd?: boolean;
  /** the forge heat (room tiles, inclusive): where the heat gauge builds; anywhere else in the room is shade */
  heat?: [number, number, number, number][];
  /** for each humming crystal (`*`, in order), the slabs of its bridge: tile offsets from the crystal; each slab is a
   *  two-tile ledge you can jump up through, lit one after another */
  crystals?: [number, number][][];
  salt?: boolean;
  saltLift?: SaltLiftPlan;
  grafts?: Graft[];
  glacier?: GlacierRoom;
};

export const isOrchardRoom = (room: Room) => room.area === 'orchard' || room.area === 'cellar';
const d = (n: number) => '.'.repeat(n);
const s = (n: number) => '#'.repeat(n);
/** A run of rows repeated `n` times. */
const rep = (n: number, row: string) => Array<string>(n).fill(row);
const ladderShaft = (col: number, width = 30, ladder = true) => s(col - 1) + '.' + (ladder ? 'H' : '.') + '..' + s(width - col - 3);

/** A room drawn in strokes instead of typed out row by row: it starts as solid stone (or the rows given), then air is
 *  carved and things are placed. Columns and rows are the room's own, from 0. */
class Sketch {
  g: string[][];
  constructor(w: number, h: number, rows?: string[]) { this.g = rows ? rows.map((r) => [...r]) : Array.from({ length: h * ROWS }, () => Array<string>(w * COLS).fill('#')); }
  /** fill a rectangle (inclusive) */
  fill(c0: number, r0: number, c1: number, r1: number, ch: string) { for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) this.g[r][c] = ch; return this; }
  /** write a string from (c, r) to the right */
  at(c: number, r: number, str: string) { for (let i = 0; i < str.length; i++) this.g[r][c + i] = str[i]; return this; }
  /** a column of one tile from r0 to r1 */
  down(c: number, r0: number, r1: number, ch: string) { return this.fill(c, r0, c, r1, ch); }
  /** a ladder in a three-wide shaft from r0 down to r1 */
  shaft(c: number, r0: number, r1: number) { this.fill(c - 1, r0, c + 1, r1, '.'); return this.down(c, r0, r1, 'H'); }
  rows() { return this.g.map((r) => r.join('')); }
}
const sketch = (w: number, h: number, draw: (k: Sketch) => void, rows?: string[]) => { const k = new Sketch(w, h, rows); draw(k); return k.rows(); };

export const ROOMS: Room[] = [
  // ─── Lakebed Landing (the hub) ───────────────────────────────────────────
  { id: 'landing', area: 'hub', gx: 5, gy: 3, w: 2, h: 1, script: 'intro', murals: [0], rows: [
    s(43) + d(4) + s(13),
    s(43) + d(4) + s(13),
    s(43) + d(4) + s(13),
    '#' + d(41) + '#kkkk#' + d(11) + '#',
    '#' + d(9) + 'w' + d(15) + 'h' + d(15) + '#....#' + d(4) + 'w' + d(6) + '#',
    '#' + d(58) + '#',
    '#' + d(58) + '#',
    '#' + d(39) + '='.repeat(10) + d(9) + '#',
    '#' + d(58) + '#',
    '#..T' + d(31) + '======' + d(15) + 'T..#',
    '#' + d(58) + '#',
    '#' + d(58) + '#',
    '.' + d(28) + '======' + d(23) + 'd.',
    '.' + d(57) + 'd.',
    '...iSi..@' + d(13) + 'M' + d(7) + 'R' + d(27) + 'd.',
    s(13) + '.H..' + s(43),
    s(13) + '.H..' + s(43),
  ] },
  { id: 'well', area: 'hub', gx: 5, gy: 4, w: 1, h: 1, chests: ['coins:40'], rows: [
    ...rep(5, ladderShaft(14)),
    '###' + d(11) + 'H' + d(12) + '###',
    '###' + d(11) + 'H' + d(12) + '###',
    '###' + d(11) + 'H' + d(12) + '###',
    '###' + d(11) + 'H' + d(12) + '###',
    '###.T' + d(9) + 'H' + d(10) + 'T.###',
    '###' + d(11) + 'H' + d(12) + '###',
    '###' + d(11) + 'H' + d(12) + '###',
    '###' + d(11) + 'H' + d(12) + '###',
    '###' + d(11) + 'H' + d(12) + '###',
    '###' + d(11) + 'H' + d(7) + 'C' + d(4) + '###',
    s(13) + 'llll' + s(13),
    s(13) + d(4) + s(13),
  ] },

  // ─── Flooded Halls ───────────────────────────────────────────────────────
  { id: 'gate', area: 'halls', gx: 4, gy: 3, w: 1, h: 1, water: [null, 14], rows: [
    ladderShaft(14), ladderShaft(14),
    '#' + d(12) + '.H..' + d(12) + '#',
    '#' + d(5) + 'h' + d(6) + '.H..' + d(6) + 'h' + d(5) + '#',
    '#' + d(12) + '.H..' + d(5) + 'w' + d(6) + '#',
    '#' + d(12) + '.H..' + d(12) + '#',
    '#' + d(12) + '.H..' + d(12) + '#',
    '#' + d(12) + '.H..' + d(12) + '#',
    '#' + d(7) + 'm' + d(4) + '.H..' + d(12) + '#',
    '#' + d(12) + '.H..' + d(12) + '#',
    '#.T' + d(10) + '.H..' + d(10) + 'T.#',
    '#' + d(12) + '.H..' + d(12) + '#',
    '.' + d(12) + '.H..' + d(12) + '.',
    '.' + d(12) + '.H..' + d(12) + '.',
    '.' + d(4) + 'i' + d(7) + '.H..' + d(3) + 'F' + d(8) + '.',
    s(30), s(30),
  ] },
  { id: 'loft', area: 'halls', gx: 4, gy: 2, w: 1, h: 1, chests: ['coins:30'], rows: [
    s(30), s(30),
    '#' + d(28) + '#',
    '#' + d(19) + 'h' + d(8) + '#',
    '#' + d(7) + 'w' + d(20) + '#',
    ...rep(5, '#' + d(28) + '#'),
    '#.T' + d(26) + '#',
    '#' + d(28) + '#',
    '.' + d(28) + '#',
    '.' + d(28) + '#',
    '.' + d(7) + 'i' + d(15) + 'C' + d(4) + '#',
    s(13) + '.H..' + s(13),
    s(13) + '.H..' + s(13),
  ] },
  { id: 'arch', area: 'halls', gx: 3, gy: 2, w: 1, h: 1, chests: ['heart'], rows: [
    s(30), s(30),
    '#' + d(28) + '#',
    '#' + d(14) + 'h' + d(13) + '#',
    '#' + d(28) + '#',
    '#' + d(28) + '#',
    '#...x' + d(24) + '#',
    '#...x' + d(24) + '#',
    '#.C.x' + d(24) + '#',
    '####=======' + d(18) + '#',
    '#' + d(28) + '#',
    '#' + d(20) + 'm' + d(7) + '#',
    '.' + d(8) + '====' + d(16) + '.',
    '.' + d(28) + '.',
    '.' + d(19) + 'F' + d(8) + '.',
    s(30), s(30),
  ] },
  { id: 'gallery', area: 'halls', gx: 1, gy: 2, w: 2, h: 1, chests: ['gear:frog-ring'], murals: [1], rows: [
    s(60), s(60),
    '#' + d(58) + '#',
    '#' + d(9) + 'h' + d(19) + 'h' + d(19) + 'h' + d(8) + '#',
    '#' + d(5) + 'w' + d(13) + 'w' + d(13) + 'w' + d(13) + 'w' + d(10) + '#',
    '#' + d(58) + '#',
    '#' + d(39) + 'K' + d(18) + '#',
    '#' + d(37) + '======' + d(15) + '#',
    '#' + d(14) + 'm' + d(43) + '#',
    '#.T' + d(54) + 'T.#',
    '#' + d(43) + '=====' + d(10) + '#',
    '#' + d(58) + '#',
    '#' + d(48) + '====' + d(6) + '.',
    '#' + d(58) + '.',
    '#...C' + d(20) + 'R' + d(33) + '.',
    s(13) + '.H..' + s(43),
    s(13) + '.H..' + s(43),
  ] },
  { id: 'chapel', area: 'halls', gx: 1, gy: 3, w: 1, h: 1, rows: [
    ladderShaft(14), ladderShaft(14),
    '#' + d(12) + '.H..' + d(12) + '#',
    '#' + d(12) + '.H..' + d(12) + '#',
    '#' + d(12) + '.H..' + d(12) + '#',
    '#' + d(12) + '.H..' + d(12) + '#',
    '#' + d(12) + '.H..' + d(12) + '.',
    '#' + d(12) + '.H..' + d(12) + '.',
    '#' + d(12) + '.H..' + d(12) + '.',
    '#' + d(9) + '='.repeat(19) + '#',
    '#' + d(28) + '#',
    '#'.repeat(9) + '.T' + d(18) + '#',
    '.' + d(19) + '=====' + d(4) + '#',
    '.' + d(28) + '#',
    '.' + d(15) + 'iSi' + d(10) + '#',
    '###' + d(6) + s(21),
    '###^^^^^^' + s(21),
  ] },
  { id: 'idol', area: 'halls', gx: 0, gy: 3, w: 1, h: 1, boss: 'frog', water: [null, 14], rows: [
    s(30), s(30),
    ...rep(9, '#' + d(28) + '#'),
    '#...=====' + d(11) + '=====' + d(4) + '#',
    '#' + d(27) + 'b.',
    '#' + d(27) + 'b.',
    '#' + d(7) + 'O' + d(19) + 'b.',
    s(30), s(30),
  ] },
  { id: 'nave', area: 'halls', gx: 2, gy: 3, w: 2, h: 1, water: [14, 7], script: 'bell', rows: [
    s(60), s(60),
    '#' + d(58) + '#',
    '#' + d(19) + 'h' + d(19) + 'h' + d(18) + '#',
    '#' + d(9) + 'w' + d(19) + 'w' + d(19) + 'w' + d(8) + '#',
    '#' + d(58) + '#',
    '.' + d(38) + 'B' + d(19) + '#',
    '.' + d(36) + '#####' + d(17) + '#',
    '.' + d(49) + 'm' + d(8) + '#',
    '######' + d(35) + '====' + d(14) + '#',
    '#' + d(58) + '#',
    '#' + d(58) + '#',
    '#' + d(24) + 'e' + d(17) + '====' + d(12) + '.',
    '#' + d(58) + '.',
    '#....v' + d(46) + 'F' + d(6) + '.',
    s(13) + '.H..' + s(43),
    s(13) + '.H..' + s(43),
  ] },
  { id: 'cistern', area: 'halls', gx: 1, gy: 4, w: 2, h: 1, water: [14, 0], deep: 3, chests: ['coins:40'], ability: 'dash', rows: [
    s(43) + '.H..' + s(13),
    s(43) + '.H..' + s(13),
    '#' + d(42) + '.H..' + d(12) + '#',
    '#' + d(42) + '.H..' + d(12) + '#',
    '#' + d(42) + '.H..' + d(12) + '#',
    '#' + d(42) + '.H..' + d(12) + '#',
    '#' + d(42) + '.H..' + '...J........' + '#',
    '#' + d(42) + '.H..' + d(12) + '#',
    '#' + d(42) + '.H..' + d(12) + '#',
    '#' + d(42) + '.H..' + d(12) + '#',
    '#' + d(24) + 'e' + d(17) + '.H..' + d(12) + '#',
    '#' + d(42) + '.H..' + d(12) + '#',
    '#' + d(42) + '.H..' + d(12) + '#',
    '#' + d(42) + '.H..' + d(12) + '#',
    '#..A' + d(25) + 'C' + d(13) + '.H..' + d(12) + '#',
    s(13) + '=H==' + s(43),
    s(13) + '.H..' + s(43),
  ] },
  { id: 'sink', area: 'halls', gx: 1, gy: 5, w: 1, h: 2, water: [8, 0], deep: 2, script: 'deep', rows: [
    ladderShaft(14),
    ...rep(12, s(8) + d(6) + 'H' + d(7) + s(8)),
    s(8) + '..J...H.......' + s(8),
    ...rep(9, s(8) + d(6) + 'H' + d(7) + s(8)),
    s(8) + d(6) + 'H' + '...J...' + s(8),
    ...rep(9, s(8) + d(6) + 'H' + d(7) + s(8)),
    ladderShaft(14),
  ] },

  // ─── Sunken Throne ───────────────────────────────────────────────────────
  { id: 'tgate', area: 'throne', gx: 1, gy: 7, w: 1, h: 1, water: [13, 0], rows: [
    ladderShaft(14), ladderShaft(14), ladderShaft(14),
    '#' + d(12) + '.H..' + d(12) + '#',
    '#' + d(12) + '.H..' + d(12) + '#',
    '#' + d(12) + '.H..' + d(12) + '#',
    '#' + d(12) + '.H..' + d(12) + '#',
    '#' + d(9) + '='.repeat(10) + d(9) + '#',
    '#' + d(28) + '#',
    '#....J' + d(23) + '#',
    '#' + d(28) + '#',
    '#' + d(28) + '#',
    '.' + d(28) + '.',
    '.' + d(28) + '.',
    '.' + d(28) + '.',
    s(13) + '=H==' + s(13),
    s(13) + '.H..' + s(13),
  ] },
  { id: 'keeper', area: 'throne', gx: 0, gy: 7, w: 1, h: 1, water: [13, 0], murals: [7], script: 'keeper', rows: [
    s(30), s(30),
    ...rep(10, '#' + d(28) + '#'),
    '#' + d(28) + '.',
    '#' + d(28) + '.',
    '#....R' + d(10) + 'U' + d(12) + '.',
    s(30), s(30),
  ] },
  { id: 'thall', area: 'throne', gx: 2, gy: 7, w: 2, h: 1, water: [13, 0], chests: ['gear:moonsteel'], rows: [
    s(60), s(60),
    '#' + d(58) + '#',
    '#' + d(19) + 'h' + d(19) + 'h' + d(18) + '#',
    '#' + d(58) + '#',
    '#' + d(9) + 'J' + d(39) + 'J' + d(8) + '#',
    '#' + d(58) + '#',
    '#' + d(58) + '#',
    '#' + d(29) + 'B' + d(28) + '#',
    '#' + d(25) + '='.repeat(9) + d(24) + '#',
    '#' + d(58) + '#',
    '#' + d(58) + '#',
    '.' + d(19) + '=====' + d(34) + '.',
    '.' + d(58) + '.',
    '.' + d(14) + 'e' + d(29) + 'C' + d(13) + '.',
    s(60), s(60),
  ] },
  { id: 'garden', area: 'throne', gx: 4, gy: 7, w: 1, h: 1, water: [13, 0], chests: ['heart'], murals: [8], rows: [
    s(30), s(30),
    '#' + d(28) + '#',
    '#' + d(9) + 'h' + d(18) + '#',
    ...rep(8, '#' + d(28) + '#'),
    '.' + d(28) + '#',
    '.' + d(28) + '#',
    '.....R' + d(14) + 'C' + d(8) + '#',
    s(30), s(30),
  ] },
  { id: 'court', area: 'throne', gx: 1, gy: 8, w: 2, h: 1, water: [13, 0], rows: [
    s(13) + '.H..' + s(43),
    '#' + d(12) + '.H..' + d(42) + '#',
    '#' + d(12) + '.H..' + d(42) + '#',
    '#' + d(12) + '.H..' + d(42) + '#',
    '#' + d(12) + '.H..' + d(42) + '#',
    '#' + d(9) + '='.repeat(10) + d(39) + '#',
    '#' + d(58) + '#',
    '#' + d(58) + '#',
    '#' + d(39) + 'J' + d(18) + '#',
    '#' + d(58) + '#',
    '#' + d(20) + 'J' + d(37) + '#',
    '#' + d(58) + '#',
    '.' + d(57) + 'u.',
    '.' + d(57) + 'u.',
    '.' + d(29) + 'e' + d(27) + 'u.',
    s(60), s(60),
  ] },
  { id: 'tshrine', area: 'throne', gx: 0, gy: 8, w: 1, h: 1, water: [13, 0], rows: [
    s(30), s(30),
    ...rep(10, '#' + d(28) + '#'),
    '#' + d(28) + '.',
    '#' + d(28) + '.',
    '#' + d(7) + 'iSi' + d(18) + '.',
    s(30), s(30),
  ] },
  { id: 'mother', area: 'throne', gx: 3, gy: 8, w: 2, h: 1, boss: 'mother', water: [14, 14], rows: [
    s(60), s(60),
    '#' + d(58) + '#',
    '#' + d(14) + 'h' + d(28) + 'h' + d(14) + '#',
    ...rep(4, '#' + d(58) + '#'),
    '#' + d(7) + '=======' + d(30) + '=======' + d(7) + '#',
    '#' + d(58) + '#',
    '#' + d(58) + '#',
    '#' + d(58) + '#',
    '.b' + d(57) + '#',
    '.b' + d(57) + '#',
    '.b' + d(40) + 'O' + d(16) + '#',
    s(60), s(60),
  ] },

  // ─── Reed Docks ──────────────────────────────────────────────────────────
  { id: 'dgate', area: 'docks', gx: 7, gy: 3, w: 1, h: 1, water: [null, 12], rows: [
    s(30), s(30),
    ...rep(8, '#' + d(28) + '#'),
    '#....T' + d(18) + 'T....#',
    '#' + d(28) + '#',
    '.' + d(28) + '.',
    '.' + d(28) + '.',
    '.' + d(9) + 'z' + d(9) + 'r' + d(8) + '.',
    s(30), s(30),
  ] },
  { id: 'jetty', area: 'docks', gx: 8, gy: 3, w: 2, h: 1, water: [14, 8], rows: [
    s(43) + '.H..' + s(13),
    '#' + d(42) + '.H..' + d(12) + '#',
    '#' + d(42) + '.H..' + d(12) + '#',
    '#' + d(42) + '.H..' + d(12) + '#',
    '#' + d(42) + '.H..' + d(12) + '#',
    '#' + d(42) + '.H..' + d(12) + '#',
    '#' + d(39) + '='.repeat(11) + d(8) + '#',
    '#' + d(24) + 'm' + d(33) + '#',
    '#' + d(58) + '#',
    '#' + d(58) + '#',
    '#....T' + d(53) + '#',
    '#' + d(20) + 'B' + d(37) + '#',
    '.' + d(17) + '=======' + d(34) + '.',
    '.' + d(58) + '.',
    '.' + d(9) + 'z' + d(19) + 'e' + d(5) + 'ffff' + d(19) + '.',
    s(13) + '=H==' + s(43),
    s(13) + '.H..' + s(43),
  ] },
  { id: 'stilts', area: 'docks', gx: 8, gy: 2, w: 2, h: 1, chests: ['tea'], ability: 'double', rows: [
    s(60), s(60),
    '#' + d(58) + '#',
    '#' + d(58) + '#',
    '#' + d(58) + '#',
    '#' + d(49) + 'm' + d(8) + '#',
    '#' + d(58) + '#',
    '#' + d(58) + '#',
    '#' + d(58) + '#',
    '#' + d(29) + 'K' + d(28) + '#',
    '#' + d(26) + '=======' + d(25) + '#',
    '#....T' + d(53) + '#',
    '#' + d(58) + '.',
    '#' + d(58) + '.',
    '#' + d(7) + 'A' + d(11) + 'C' + d(38) + '.',
    s(43) + '=H==' + s(13),
    s(43) + '.H..' + s(13),
  ] },
  { id: 'reeds', area: 'docks', gx: 10, gy: 2, w: 1, h: 2, water: [null, 29], rows: [
    s(30), s(30),
    ...rep(10, '#' + d(28) + '#'),
    '.' + d(28) + '.',
    '.' + d(28) + '.',
    '.' + d(28) + '.',
    s(10) + d(10) + s(10),
    s(10) + d(10) + s(10),
    '#' + d(28) + '#',
    '#' + d(28) + '#',
    '#' + d(28) + '#',
    '#...======' + d(19) + '#',
    '#' + d(28) + '#',
    '#' + d(19) + 'm' + d(8) + '#',
    '#' + d(28) + '#',
    '#' + d(11) + '======' + d(11) + '#',
    '#' + d(28) + '#',
    '#' + d(28) + '#',
    '#' + d(28) + '#',
    '#' + d(19) + '======...#',
    '.' + d(28) + '.',
    '.' + d(28) + '.',
    '.' + d(14) + 'z' + d(13) + '.',
    s(30), s(30),
  ] },
  { id: 'mill', area: 'docks', gx: 11, gy: 2, w: 1, h: 2, chests: ['cake'], murals: [2], rows: [
    s(30), s(30),
    ...rep(8, '#' + d(28) + '#'),
    '#....T' + d(23) + '#',
    '#' + d(28) + '#',
    '.' + d(28) + '#',
    '.' + d(28) + '#',
    '....R' + d(9) + 'C' + d(14) + '#',
    s(20) + 'H' + s(9),
    s(20) + 'H' + s(9),
    ...rep(12, '#' + d(19) + 'H' + d(8) + '#'),
    '.' + d(19) + 'H' + d(8) + '#',
    '.' + d(19) + 'H' + d(8) + '#',
    '....iSi' + d(13) + 'H' + d(8) + '#',
    s(30), s(30),
  ] },
  { id: 'boathouse', area: 'docks', gx: 7, gy: 4, w: 2, h: 1, water: [14, 10], chests: ['ability:deep'], rows: [
    s(30) + s(13) + '.H..' + s(13),
    s(30) + s(13) + '.H..' + s(13),
    s(30) + s(13) + '.H..' + s(13),
    s(30) + s(13) + '.H..' + s(13),
    s(30) + s(13) + '.H..' + s(13),
    '#' + d(29) + d(14) + 'H' + d(14) + '#',
    '#' + d(29) + d(14) + 'H' + d(14) + '#',
    '#' + d(29) + d(14) + 'H' + d(14) + '#',
    '#' + d(29) + d(14) + 'H' + d(14) + '#',
    '#=====H==' + d(13) + '======..' + d(14) + 'H' + d(14) + '#',
    '#.....H' + d(23) + d(14) + 'H' + d(14) + '#',
    '#.....H' + d(23) + d(14) + 'H' + d(14) + '#',
    '#.....H' + d(17) + '====c.' + d(14) + 'H' + d(13) + 'j.',
    '#.....H' + d(21) + 'c.' + d(14) + 'H' + d(13) + 'j.',
    '#..C..H' + d(21) + 'c.' + d(6) + 'a' + d(7) + 'H' + d(13) + 'j.',
    s(9) + d(13) + s(8) + s(13) + '=H==' + s(13),
    s(9) + '^'.repeat(13) + s(8) + s(13) + '.H..' + s(13),
  ] },
  { id: 'lagoon', area: 'docks', gx: 9, gy: 4, w: 2, h: 1, boss: 'hydra', water: [14, 14], rows: [
    s(60), s(60),
    '#' + d(58) + '#',
    '#' + d(58) + '#',
    ...rep(7, '#' + d(58) + '#'),
    '#' + d(9) + '======' + d(9) + '======' + d(28) + '#',
    '.b' + d(57) + '#',
    '.b' + d(57) + '#',
    '.b' + d(44) + 'O' + d(12) + '#',
    s(60), s(60),
  ] },

  // ─── Crypt Murals ────────────────────────────────────────────────────────
  { id: 'stair', area: 'crypt', gx: 5, gy: 5, w: 1, h: 1, dark: true, script: 'firstDark', rows: [
    ...rep(5, ladderShaft(14)),
    ...rep(7, '#' + d(13) + 'H' + d(14) + '#'),
    '.' + d(13) + 'H' + d(14) + '.',
    '.' + d(13) + 'H' + d(14) + '.',
    '.' + d(4) + 'i' + d(8) + 'H' + d(14) + '.',
    s(13) + 'kkkk' + s(13),
    s(13) + d(4) + s(13),
  ] },
  { id: 'chasm', area: 'crypt', gx: 5, gy: 6, w: 1, h: 1, dark: true, rows: [
    ...rep(10, s(13) + d(4) + s(13)),
    '#' + d(28) + '#',
    '#' + d(28) + '#',
    '.' + d(28) + '.',
    '.' + d(28) + '.',
    '.' + d(5) + 'a' + d(22) + '.',
    s(30), s(30),
  ] },
  { id: 'niches', area: 'crypt', gx: 3, gy: 5, w: 2, h: 1, dark: true, chests: ['heart'], murals: [3], script: 'ghost', rows: [
    s(60), s(60),
    ...rep(6, '#' + d(58) + '#'),
    '#' + d(24) + 'm' + d(33) + '#',
    '#' + d(19) + 'T' + d(19) + 'T' + d(18) + '#',
    '#' + d(58) + '#',
    '#' + d(58) + '#',
    '#' + d(58) + '.',
    '#' + d(58) + '.',
    '#....C...R' + d(30) + 'a' + d(18) + '.',
    '#' + s(11) + 'g'.repeat(16) + s(32),
    s(12) + '^'.repeat(16) + s(32),
  ] },
  { id: 'vault', area: 'crypt', gx: 3, gy: 6, w: 2, h: 1, dark: true, chests: ['gear:salt-lamp', 'heart'], murals: [4], rows: [
    s(60), s(60),
    ...rep(7, '#' + d(58) + '#'),
    '#' + d(23) + 'C' + d(34) + '#',
    '#' + d(19) + '========' + d(31) + '#',
    '#.T' + d(56) + '#',
    '#...x' + d(54) + '.',
    '#...x' + d(10) + '====' + d(40) + '.',
    '#.C.x.....R' + d(19) + 'G' + d(28) + '.',
    s(60), s(60),
  ] },
  { id: 'murals', area: 'crypt', gx: 6, gy: 5, w: 2, h: 1, dark: true, ability: 'wallkick', murals: [5], rows: [
    s(60), s(60),
    '#' + d(58) + '#',
    '#' + d(58) + '#',
    '#' + d(58) + '#',
    '#' + d(29) + 'A' + d(28) + '#',
    '#' + d(26) + s(7) + d(25) + '#',
    '#' + d(44) + 'm' + d(13) + '#',
    '#' + d(58) + '#',
    '#' + d(21) + 'gggg' + d(33) + '#',
    '#' + d(7) + 'T' + d(41) + 'T' + d(8) + '#',
    '#' + d(58) + '#',
    '.' + d(16) + 'gggg' + d(38) + '.',
    '.' + d(58) + '.',
    '.....R' + d(30) + 'a' + d(22) + '.',
    s(60), s(60),
  ] },
  { id: 'cshrine', area: 'crypt', gx: 8, gy: 5, w: 1, h: 1, rows: [
    ladderShaft(14),
    s(13) + 'llll' + s(13),
    ladderShaft(14), ladderShaft(14), ladderShaft(14),
    ...rep(7, '#' + d(13) + 'H' + d(14) + '#'),
    '.' + d(13) + 'H' + d(14) + '#',
    '.' + d(13) + 'H' + d(14) + '#',
    '....iSi' + d(7) + 'H' + d(14) + '#',
    ladderShaft(14), ladderShaft(14),
  ] },
  { id: 'cwell', area: 'crypt', gx: 8, gy: 6, w: 1, h: 1, dark: true, chests: ['drop'], murals: [9], rows: [
    ...rep(5, ladderShaft(14)),
    ...rep(9, '#' + d(13) + 'H' + d(14) + '#'),
    '#...R' + d(9) + 'H' + d(9) + 'C' + d(4) + '#',
    s(30), s(30),
  ] },
  { id: 'puma', area: 'crypt', gx: 6, gy: 6, w: 2, h: 1, boss: 'puma', dark: true, rows: [
    s(60), s(60),
    ...rep(6, '#' + d(58) + '#'),
    '#' + d(25) + '========' + d(25) + '#',
    '#' + d(58) + '#',
    '#' + d(58) + '#',
    '#...======' + d(40) + '======...#',
    '.b' + d(57) + '#',
    '.b' + d(57) + '#',
    '.b' + d(43) + 'O' + d(13) + '#',
    s(60), s(60),
  ] },

  // ─── Bell Towers ─────────────────────────────────────────────────────────
  { id: 'shaft', area: 'towers', gx: 6, gy: 2, w: 1, h: 1, rows: [
    ...rep(12, s(13) + d(4) + s(13)),
    '.' + d(16) + s(13),
    '.' + d(16) + s(13),
    '.' + d(16) + s(13),
    s(13) + d(4) + s(13),
    s(13) + d(4) + s(13),
  ] },
  { id: 'tloft', area: 'towers', gx: 5, gy: 2, w: 1, h: 1, chests: ['heart'], rows: [
    s(30), s(30),
    '#' + d(28) + '#',
    '#' + d(14) + 'h' + d(13) + '#',
    ...rep(6, '#' + d(28) + '#'),
    '#' + d(26) + 'T.#',
    '#' + d(28) + '#',
    '#' + d(28) + '.',
    '#' + d(28) + '.',
    '#..C' + d(14) + 'G' + d(10) + '.',
    s(30), s(30),
  ] },
  { id: 'base', area: 'towers', gx: 5, gy: 1, w: 2, h: 1, rows: [
    s(60), s(60),
    '#' + d(58) + '#',
    '#' + d(9) + 'h' + d(39) + 'h' + d(8) + '#',
    '.' + d(58) + '#',
    '.' + d(58) + '#',
    '.' + d(11) + 'I' + d(46) + '#',
    '='.repeat(29) + d(30) + '#',
    '#' + d(58) + '#',
    '#' + d(58) + '#',
    '#' + d(29) + '======' + d(23) + '#',
    '#.T' + d(54) + 'T.#',
    '#' + d(58) + '.',
    '#' + d(58) + '.',
    '#' + d(19) + 'K' + d(29) + 'I' + d(8) + '.',
    s(43) + d(4) + s(13),
    s(43) + d(4) + s(13),
  ] },
  { id: 'bellroom', area: 'towers', gx: 3, gy: 1, w: 2, h: 1, ability: 'chime', rows: [
    s(43) + d(4) + s(13),
    s(43) + d(4) + s(13),
    s(43) + d(4) + s(13),
    s(43) + d(4) + s(13),
    '#' + d(41) + '#....#' + d(11) + '.',
    '#' + d(41) + '#....#' + d(11) + '.',
    '#' + d(41) + '#....#' + d(11) + '.',
    '#' + d(41) + '#....#' + '='.repeat(12),
    '#' + d(41) + '#....#' + d(11) + '#',
    '#' + d(9) + 'h' + d(48) + '#',
    '#.T' + d(56) + '#',
    '#' + d(42) + '====' + d(3) + '=====' + d(4) + '#',
    '.' + d(58) + '#',
    '.' + d(58) + '#',
    '.' + d(9) + 'A' + d(19) + 'I' + d(28) + '#',
    s(60), s(60),
  ] },
  { id: 'roost', area: 'towers', gx: 2, gy: 1, w: 1, h: 1, chests: ['gear:condor-feather'], rows: [
    s(30), s(30),
    '#' + d(28) + '#',
    '#' + d(4) + 'w' + d(23) + '#',
    ...rep(6, '#' + d(28) + '#'),
    '#' + d(19) + 'K' + d(8) + '#',
    '#' + d(16) + '=======' + d(5) + '#',
    '#' + d(28) + '.',
    '#' + d(28) + '.',
    '#..C' + d(11) + 'K' + d(13) + '.',
    s(30), s(30),
  ] },
  { id: 'spire', area: 'towers', gx: 4, gy: 0, w: 2, h: 1, rows: [
    s(60), s(60),
    '#' + d(58) + '#',
    '#' + d(19) + 'h' + d(19) + 'h' + d(18) + '#',
    '#' + d(9) + 'w' + d(19) + 'w' + d(19) + 'w' + d(8) + '#',
    ...rep(5, '#' + d(58) + '#'),
    '#.T' + d(54) + 'T.#',
    '#' + d(58) + '#',
    '.' + d(57) + 'c.',
    '.' + d(57) + 'c.',
    '.' + d(29) + 'G' + d(27) + 'c.',
    s(13) + d(4) + s(43),
    s(13) + d(4) + s(43),
  ] },
  { id: 'attic', area: 'towers', gx: 3, gy: 0, w: 1, h: 1, chests: ['gear:bell-charm'], murals: [6], rows: [
    s(30), s(30),
    '#' + d(28) + '#',
    '#' + d(9) + 'h' + d(18) + '#',
    ...rep(6, '#' + d(28) + '#'),
    '#.T' + d(26) + '#',
    '#' + d(28) + '#',
    '#' + d(28) + '.',
    '#' + d(28) + '.',
    '#....R' + d(8) + 'C' + d(14) + '.',
    s(30), s(30),
  ] },
  { id: 'warden', area: 'towers', gx: 6, gy: 0, w: 2, h: 1, boss: 'warden', rows: [
    s(60), s(60),
    '#' + d(58) + '#',
    '#' + d(9) + 'w' + d(19) + 'w' + d(19) + 'w' + d(8) + '#',
    ...rep(6, '#' + d(58) + '#'),
    '#...=======' + d(38) + '=======...#',
    '#' + d(58) + '#',
    '.b' + d(57) + '#',
    '.b' + d(57) + '#',
    '.b' + d(28) + 'O' + d(28) + '#',
    s(60), s(60),
  ] },
  { id: 'gears', area: 'towers', gx: 7, gy: 1, w: 1, h: 1, rows: [
    s(30), s(30),
    '#' + d(28) + '#',
    '#' + d(9) + 'h' + d(18) + '#',
    ...rep(6, '#' + d(28) + '#'),
    '#.T' + d(24) + 'T.#',
    '#' + d(28) + '#',
    '.' + d(28) + '#',
    '.' + d(28) + '#',
    '.' + d(12) + 'iSi' + d(13) + '#',
    s(30), s(30),
  ] },
];

// ─── the Windward Belfry ───────────────────────────────────────────────────
// East of the citadel on the map, reached by Wayra's boat from the landing once the Lake Mother is calm. The
// Cloudstair climbs from the shore (gy 8) to the Hail Condor's bridge (gy 4); the Belfry Loft rises from there to the
// Out-of-Tune Bell at the top (gy 0).
const room = (id: string, area: AreaId, gx: number, gy: number, w: number, h: number, draw: (k: Sketch) => void, extra: Partial<Room> = {}): Room =>
  ({ id, area, gx, gy, w, h, exp: true, rows: sketch(w, h, draw), ...extra });

export const BELFRY_ROOMS: Room[] = [
  // the shore below the cliffs: Wayra's boat, a shrine, and the way up on the right
  room('cliffoot', 'cloud', 13, 8, 2, 1, (k) => {
    k.fill(1, 2, 58, 14, '.').fill(59, 12, 59, 14, '.');
    k.at(30, 11, '=======').at(33, 10, 'C');
    k.at(4, 14, 'D').at(9, 14, 'iSi').at(20, 14, 'R').at(46, 14, 'E').at(14, 9, 'T').at(52, 9, 'T').at(40, 6, 'Y');
  }, { chests: ['coins:30'], murals: [10], script: 'cliff' }),
  // a zigzag of ledges up a windy chimney
  room('switchback', 'cloud', 15, 7, 1, 2, (k) => {
    k.fill(1, 2, 28, 31, '.').fill(0, 29, 0, 31, '.').fill(0, 12, 0, 14, '.').fill(1, 15, 3, 15, '#');
    k.at(6, 29, '=======').at(15, 26, '=======').at(22, 23, '======').at(13, 20, '=======').at(4, 17, '=======');
    k.at(15, 10, 'X').at(25, 30, 'T');
  }, { gusts: [[1, 18, 28, 27, 1]] }),
  // a gorge the wind blows across: ring a wind bell to turn it round and be carried over
  room('windgate', 'cloud', 13, 7, 2, 1, (k) => {
    k.fill(1, 2, 58, 14, '.').fill(59, 12, 59, 14, '.');
    k.fill(26, 15, 35, 15, '.').fill(26, 16, 35, 16, '^');
    k.shaft(4, 0, 14);
    k.at(44, 14, 'W').at(12, 14, 'W').at(16, 14, 'C').at(8, 14, 'R').at(30, 7, 'Y').at(50, 9, 'T');
  }, { chests: ['gear:windward-jacket'], murals: [17], gusts: [[20, 4, 41, 15, 2]], script: 'wind' }),
  // the Bell Rope's pedestal, a note-sealed way to the cairns, and a rope-knot door on to the gorge
  room('ropehall', 'cloud', 13, 5, 1, 2, (k) => {
    k.fill(1, 2, 28, 30, '.').shaft(4, 31, 33);
    k.at(20, 30, 'A');
    k.fill(29, 28, 29, 30, '.').down(28, 28, 30, 'n');
    k.fill(29, 12, 29, 14, '.').down(28, 12, 14, 'y').fill(20, 15, 28, 15, '#').down(19, 15, 30, 'H');
    k.at(2, 10, '=====').at(4, 9, 'C').at(15, 9, 'o').at(9, 22, 'T');
  }, { ability: 'rope', chests: ['tea'] }),
  // off the ropehall behind a note sigil: an echo bell's stair up to a shelf
  room('cairns', 'cloud', 14, 6, 2, 1, (k) => {
    k.fill(1, 2, 58, 13, '.').fill(0, 11, 0, 13, '.');
    k.fill(25, 5, 40, 5, '#');
    k.at(10, 13, 'Q').at(32, 4, 'C').at(37, 4, 'R').at(45, 13, 'E').at(50, 6, 'Y');
  }, { chests: ['drop'], murals: [11], echoes: [[[4, -2], [8, -5], [12, -8]]], script: 'echo' }),
  // a spiked gorge with one tall pillar in it: only the rope crosses
  room('bannerwalk', 'cloud', 14, 5, 2, 1, (k) => {
    k.fill(1, 2, 58, 14, '.').fill(0, 12, 0, 14, '.');
    k.fill(8, 15, 30, 15, '.').fill(8, 16, 30, 16, '^').fill(18, 8, 20, 16, '#');
    k.shaft(33, 0, 14);
    k.at(12, 7, 'o').at(25, 7, 'o').at(19, 7, 'C');
    k.at(44, 14, 'iSi').at(52, 14, 'R').at(24, 3, 'X').at(40, 5, 'X');
  }, { chests: ['heart'], murals: [14] }),
  // the Hail Condor's rope bridge
  room('condorbridge', 'cloud', 15, 4, 3, 1, (k) => {
    k.fill(1, 2, 88, 11, '.');
    k.fill(8, 12, 81, 12, '=').fill(8, 13, 81, 15, '.').fill(8, 16, 81, 16, '^');
    k.shaft(3, 12, 16).at(2, 12, 'bbb');
    k.shaft(85, 0, 11).at(84, 2, 'bbb');
    k.at(45, 11, 'O');
  }, { boss: 'condor', gusts: [[8, 2, 81, 11, 1.2, 'boss']] }),

  // the belfry's foot: a shrine, and an echo bell's stair to the hatch in the ceiling
  room('loftbase', 'loft', 17, 3, 2, 1, (k) => {
    k.fill(1, 2, 58, 14, '.').fill(0, 12, 0, 14, '.').shaft(25, 15, 16);
    k.fill(30, 4, 36, 4, '#').shaft(33, 0, 3);
    k.at(8, 14, 'iSi').at(50, 14, 'Q').at(4, 14, 'R').at(20, 14, 'E').at(44, 14, 'E').at(15, 3, 'L').at(56, 9, 'T');
  }, { murals: [15], echoes: [[[-4, -3], [-8, -6], [-12, -9]]] }),
  // a side loft of louvred windows: notes up, then the rope across
  room('louvres', 'loft', 16, 3, 1, 1, (k) => {
    k.fill(1, 2, 28, 14, '.').fill(29, 12, 29, 14, '.');
    k.fill(1, 6, 4, 6, '#');
    k.at(22, 14, 'Q').at(10, 3, 'o').at(2, 5, 'C').at(8, 14, 'R');
  }, { chests: ['gear:highland-cloak'], murals: [12], echoes: [[[-3, -3], [-6, -6], [-3, -9]]] }),
  // the tall shaft of swinging bells; its doorways lead to the cogworks, the clappers and (sealed) the great bell
  room('bellshaft', 'loft', 18, 0, 1, 3, (k) => {
    k.fill(1, 2, 28, 48, '.').shaft(3, 49, 50).at(2, 49, '=').at(4, 49, '=');
    k.down(27, 15, 48, 'H');
    k.fill(1, 32, 26, 32, '#').at(28, 32, '=').fill(1, 15, 26, 15, '#').at(28, 15, '=');
    k.fill(0, 46, 0, 48, '.').fill(0, 29, 0, 31, '.').fill(0, 12, 0, 14, '.').down(1, 12, 14, 'Z');
    k.at(13, 34, 'P').at(13, 17, 'P');
    k.at(18, 44, '=======').at(19, 40, 'o').fill(4, 40, 9, 40, '#').at(7, 39, 'C');
    k.at(14, 24, 'L').at(15, 48, 'E').at(24, 8, 'T').at(4, 28, 'T');
  }, { chests: ['gear:carillon-staff'], swings: [{ len: 6, amp: 0.6, period: 170, phase: 0 }, { len: 6, amp: 0.7, period: 190, phase: 0.5 }] }),
  // cogs and a perch: a crooked note path
  room('cogworks', 'loft', 16, 2, 2, 1, (k) => {
    k.fill(1, 2, 58, 14, '.').fill(59, 12, 59, 14, '.');
    k.fill(24, 7, 31, 7, '#');
    k.at(48, 14, 'Q').at(27, 6, 'C').at(30, 6, 'R').at(12, 2, 'P').at(20, 14, 'E').at(40, 3, 'L');
  }, { chests: ['gear:condor-talon'], murals: [13], echoes: [[[-5, -3], [-10, -3], [-14, -6]]], swings: [{ len: 7, amp: 0.7, period: 160, phase: 0.25 }] }),
  // the Twin Clappers
  room('clapperloft', 'loft', 16, 1, 2, 1, (k) => {
    k.fill(1, 2, 58, 14, '.').fill(59, 12, 59, 14, '.').down(58, 12, 14, 'b');
    k.at(8, 10, '='.repeat(15)).at(37, 10, '='.repeat(15));
    k.at(30, 14, 'O');
  }, { boss: 'clappers' }),
  // the top of the belfry: the Out-of-Tune Bell
  room('belltop', 'loft', 16, 0, 2, 1, (k) => {
    k.fill(1, 2, 58, 14, '.').fill(59, 12, 59, 14, '.').down(58, 12, 14, 'b');
    k.at(4, 10, '=========').at(47, 10, '=========');
    k.at(30, 14, 'O');
  }, { boss: 'tune', gusts: [[1, 2, 57, 14, 1.1, 'boss']] }),

  // three small rooms in the citadel that only the rope opens (their doors are rope-knot sigils)
  room('ropeloft', 'halls', 0, 2, 1, 1, (k) => {
    k.fill(1, 2, 28, 13, '.').fill(29, 3, 29, 5, '.').fill(24, 6, 28, 6, '#').fill(1, 14, 28, 14, '^');
    k.fill(2, 10, 6, 10, '#').at(4, 9, 'C').at(18, 4, 'o').at(10, 5, 'o').at(14, 11, 'm');
  }, { chests: ['coins:80'] }),
  room('ropegallery', 'crypt', 9, 5, 1, 1, (k) => {
    k.fill(1, 2, 28, 14, '.').fill(0, 12, 0, 14, '.').fill(6, 15, 22, 15, '^');
    k.at(11, 8, 'o').at(18, 8, 'o').at(26, 14, 'R').at(15, 4, 'I');
  }, { murals: [16] }),
  room('ropecellar', 'hub', 6, 4, 1, 1, (k) => {
    k.fill(1, 2, 28, 14, '.').shaft(21, 0, 14);
    k.fill(1, 15, 12, 15, '^').at(14, 9, '======').fill(2, 6, 6, 6, '#').at(4, 5, 'C').at(11, 3, 'o').at(26, 9, 'T');
  }, { chests: ['heart'] }),
];

// the citadel rooms the rope rooms open off: a rope-knot door in each
const patch = (id: string, draw: (k: Sketch) => void) => { const r = ROOMS.find((x) => x.id === id)!; r.rows = sketch(r.w, r.h, draw, r.rows); };
patch('gallery', (k) => { k.fill(0, 3, 0, 5, '.').down(1, 3, 5, 'y').at(1, 6, '==H==').down(3, 7, 14, 'H').at(9, 4, 'o'); });
patch('cshrine', (k) => { k.fill(29, 12, 29, 14, '.').down(28, 12, 14, 'y'); });
patch('landing', (k) => { k.at(50, 15, 'yyy').at(50, 16, '.H.'); });
// Wayra's boat waits at the landing, by her raft
patch('landing', (k) => { k.at(26, 14, 'D'); });
ROOMS.push(...BELFRY_ROOMS);

// ─── the Foundry Below ─────────────────────────────────────────────────────
// Under the Sunken Throne (gy 9 to 12), through a seal in the floor by the Pearl Throne Candle that cracks once the
// Out-of-Tune Bell is calm. The Casting Halls run east from the seal and down to the Molten Founder; the Glasswork
// Caves climb from the Furnace Candle to the Glass Choir, and the deep seal under the Furnace Candle opens on the
// Hollow Bell once both are calm.
//
// Glyphs: `~` molten bronze (hot: a touch burns and puts you back on the last safe ledge; Enzo's Frost Fan cools a
// whole channel into a crust to walk on for a while), `_` lava (always burns), `:` slag (burns, but hardens while a
// vent in the room puffs mist), `+` a bronze bounce plate (a Bell Hammer slam onto it bounces Dora high). Doors: `8`
// cracked glass (a Bell Hammer slam from above breaks it), `&` a beam door (Resonance rung by a prism `!` within a few
// tiles opens it), `9` the foundry seal (open once the Out-of-Tune Bell is calm), `V` the deep seal (open once the
// Molten Founder and the Glass Choir are calm). Things: `N` Tupa the bellfounder, `%` a mist vent, `*` a humming
// crystal, `!` a beam prism. Foes: `1` ingot walker, `2` ember wisp, `3` crystal bat, `4` glass snail.
const fdroom = (id: string, area: AreaId, gx: number, gy: number, w: number, h: number, draw: (k: Sketch) => void, extra: Partial<Room> = {}): Room =>
  ({ ...room(id, area, gx, gy, w, h, draw, extra), fd: true });

export const FOUNDRY_ROOMS: Room[] = [
  // in under the seal: Tupa's anvil, a shrine, and the way on east
  fdroom('fgate', 'cast', 0, 9, 1, 1, (k) => {
    k.fill(1, 2, 28, 14, '.').fill(29, 12, 29, 14, '.').shaft(21, 0, 14);
    k.at(4, 14, 'N').at(9, 14, 'iSi').at(15, 14, 'R').at(2, 9, 'T').at(26, 9, 'T');
  }, { murals: [18], script: 'foundry' }),
  // a long low hall with two channels of molten bronze across the floor (too wide to jump: frost them)
  fdroom('channel', 'cast', 1, 9, 2, 1, (k) => {
    k.fill(0, 12, 59, 14, '.').fill(1, 6, 7, 14, '.').fill(52, 6, 58, 14, '.');
    k.fill(8, 15, 23, 15, '~').fill(36, 15, 51, 15, '~');
    k.at(29, 14, 'C').at(33, 14, '1').at(30, 12, '2').at(4, 8, 'T').at(55, 8, 'T');
  }, { chests: ['gear:forge-apron'], heat: [[8, 12, 51, 14]], script: 'channel' }),
  // a shaft down, a cavern, and a low tunnel over lava: its slag hardens while the vents puff
  fdroom('vents', 'cast', 3, 9, 1, 2, (k) => {
    k.fill(0, 12, 6, 14, '.').fill(1, 16, 6, 31, '.').down(3, 15, 31, 'H');
    k.fill(7, 4, 28, 26, '.');
    k.fill(7, 28, 28, 31, '.').fill(29, 29, 29, 31, '.').fill(0, 29, 0, 31, '.');
    k.at(7, 32, '_:::::::_::::::_');
    k.at(11, 29, '%').at(17, 29, '%');
    k.at(24, 26, 'C').at(18, 10, '2').at(12, 20, '2').at(14, 8, 'T').at(26, 30, 'T');
  }, { chests: ['gear:ash-smock'], heat: [[7, 4, 28, 26], [7, 29, 28, 31]], script: 'vents' }),
  // the Bell Hammer's pedestal; a bounce plate under a high ledge, and a chest under cracked glass
  fdroom('anvilhall', 'cast', 1, 10, 2, 1, (k) => {
    k.fill(1, 2, 58, 14, '.').fill(59, 12, 59, 14, '.');
    k.fill(20, 15, 22, 15, '+').at(17, 5, '========').at(20, 4, 'C');
    k.fill(46, 11, 52, 14, '#').fill(47, 12, 51, 14, '.').at(48, 11, '888').at(49, 14, 'C');
    k.at(32, 14, 'A').at(8, 14, 'R').at(38, 14, '1').at(12, 4, 'T').at(42, 4, 'T');
  }, { ability: 'hammer', chests: ['heart', 'gear:cinder-charm'], murals: [19] }),
  // the great crucible hall: heat, a channel, a vent's mist for shade, and cracked glass down to the Founder; a beam
  // door east (opened from the Glass Candle's side) is the way back up from the caves
  fdroom('crucible', 'cast', 4, 10, 2, 1, (k) => {
    k.fill(0, 12, 0, 14, '.').fill(1, 2, 58, 14, '.').fill(59, 12, 59, 14, '.').down(58, 12, 14, '&');
    k.fill(14, 15, 25, 15, '~').fill(33, 15, 38, 15, ':').at(35, 14, '%');
    k.at(49, 15, '888').at(49, 16, '.H.');
    k.at(8, 14, 'C').at(20, 8, '2').at(44, 7, '2').at(30, 14, '1').at(53, 14, '1').at(6, 6, 'T').at(40, 6, 'T');
  }, { chests: ['coins:120'], heat: [[1, 2, 58, 14]], script: 'glassfloor' }),
  // the Molten Founder's casting floor
  fdroom('founder', 'cast', 4, 11, 2, 1, (k) => {
    k.fill(1, 2, 58, 14, '.').fill(59, 12, 59, 14, '.').down(58, 12, 14, 'b');
    k.shaft(50, 0, 14).at(49, 1, 'bbb');
    k.at(5, 10, '=========').at(36, 10, '=========');
    k.at(25, 14, 'O');
  }, { boss: 'founder' }),
  // the Furnace Candle: a prism by the beam door east, and the deep seal in the floor
  fdroom('forgeshrine', 'cast', 6, 11, 1, 1, (k) => {
    k.fill(0, 12, 0, 14, '.').fill(1, 2, 28, 14, '.').fill(29, 12, 29, 14, '.').down(28, 12, 14, '&');
    k.at(14, 15, 'VVV').at(14, 16, '.H.');
    k.at(5, 14, 'iSi').at(24, 13, '!').at(20, 14, 'R').at(10, 8, 'T');
  }, { murals: [20] }),

  // over a lava lake: two humming crystals, one on each shore, each bridging the whole way across
  fdroom('prism', 'glass', 7, 11, 2, 1, (k) => {
    k.fill(0, 12, 0, 14, '.').fill(1, 6, 58, 14, '.').fill(59, 12, 59, 14, '.');
    k.fill(6, 15, 53, 15, '_');
    k.at(3, 14, '*').at(56, 14, '*').at(20, 6, '3').at(40, 6, '3').at(1, 9, 'T');
  }, {
    heat: [[6, 6, 53, 14]], script: 'crystal',
    // (both crystals lay the same slabs, the last reaching the far floor; see crystalSpans: one walkway)
    crystals: [[4, 10, 16, 22, 28, 34, 40, 46, 49].map((dc) => [dc, -1] as [number, number]), [-4, -7, -13, -19, -25, -31, -37, -43, -49].map((dc) => [dc, -1] as [number, number])],
  }),
  // a tall glass stair: ledges up to the snail gallery, then a crystal's stair up to the Glass Choir
  fdroom('glassstair', 'glass', 9, 9, 1, 3, (k) => {
    k.fill(1, 2, 28, 48, '.').fill(0, 46, 0, 48, '.').fill(0, 29, 0, 31, '.').fill(0, 12, 0, 14, '.');
    k.fill(1, 32, 8, 32, '#').fill(1, 15, 8, 15, '#');
    k.at(18, 46, '=======').at(8, 43, '=======').at(18, 40, '=======').at(8, 37, '=======').at(14, 34, '=======');
    k.at(24, 22, '====').at(25, 21, 'C');
    k.fill(4, 49, 6, 49, '+');
    k.at(5, 31, '*').at(12, 48, 'R').at(20, 48, '4').at(14, 10, '3').at(20, 27, '3').at(26, 44, 'T').at(3, 26, 'T');
  }, { chests: ['drop'], murals: [22], crystals: [[[5, -3], [10, -6], [15, -9], [10, -12], [5, -15]]] }),
  // the snail gallery: a closet behind a beam door, and the Glass Candle west
  fdroom('snails', 'glass', 7, 10, 2, 1, (k) => {
    k.fill(0, 12, 0, 14, '.').fill(1, 2, 58, 14, '.').fill(59, 12, 59, 14, '.');
    k.fill(20, 10, 27, 14, '#').fill(21, 11, 26, 14, '.').down(20, 11, 14, '&').at(24, 14, 'C');
    k.at(14, 13, '!').at(36, 10, '=========');
    k.at(35, 14, '4').at(48, 14, '4').at(30, 4, '3').at(10, 4, '3').at(52, 14, 'R').at(44, 6, 'T');
  }, { chests: ['gear:obsidian-edge'], murals: [23] }),
  // the Glass Candle: its prism opens the beam door back into the crucible hall
  fdroom('caveshrine', 'glass', 6, 10, 1, 1, (k) => {
    k.fill(0, 12, 0, 14, '.').fill(1, 2, 28, 14, '.').fill(29, 12, 29, 14, '.');
    k.at(10, 14, 'iSi').at(3, 13, '!').at(22, 14, 'R').at(16, 6, 'T');
  }, { murals: [21] }),
  // the Glass Choir's cave
  fdroom('choir', 'glass', 7, 9, 2, 1, (k) => {
    k.fill(1, 2, 58, 14, '.').fill(59, 12, 59, 14, '.').down(58, 12, 14, 'b');
    k.at(4, 10, '========').at(48, 10, '========');
    k.at(30, 14, 'O');
  }, { boss: 'choir' }),
  // the Hollow Bell, over a lava pit that rises as it fights
  fdroom('hollow', 'glass', 6, 12, 2, 1, (k) => {
    k.fill(1, 2, 58, 14, '.').fill(1, 15, 58, 15, '_').shaft(15, 0, 7).at(14, 1, 'bbb');
    k.fill(3, 12, 12, 12, '#').fill(24, 12, 35, 12, '#').fill(47, 12, 56, 12, '#');
    k.at(13, 8, '=========').at(38, 8, '=========');
    k.at(30, 6, 'O');
  }, { boss: 'hollow' }),
];
// the seal in the floor by the Pearl Throne Candle, over the ladder down to the foundry
patch('tshrine', (k) => { k.at(20, 15, '999').at(20, 16, '.H.'); });
ROOMS.push(...FOUNDRY_ROOMS);
patch('fgate', (k) => { k.at(26, 14, '?'); });
ROOMS.push(...saltRooms());
patch(ORCHARD_RETURN, (k) => { k.at(...ORCHARD_EXIT, ','); });
ROOMS.push(...ORCHARD_ROOMS);
patch(GLACIER_RETURN, (k) => { k.at(...ROOT_LIFT, '('); });
ROOMS.push(...GLACIER_ROOMS);
