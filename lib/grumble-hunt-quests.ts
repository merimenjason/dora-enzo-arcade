/** Grumble Hunt camp extras: Wren's bounties, Old Mossback's quests and Bramble's charms. No DOM or Three.js. */
import { type MaterialId } from './grumble-hunt-content.js';
import { BEAST_IDS, type BeastId, BEASTS, MIGHTY_NAMES, type Beast, type HuntFacts } from './grumble-hunt-rules.js';
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
export const NO_CHARM = level('', {}, 0, {});
export function validDay(day: unknown): day is string {
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
