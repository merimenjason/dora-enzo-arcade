// Cubby Valley's tables: every item, the Burrow Workbench's woven patterns, the six neighbours and their errands, and
// the valley's night creatures. Plain data, DOM-free.
import { BLOCKS, BLOCK_BY_KEY } from './cubby-world.js';

export interface ItemDef { key: string; name: string; block: number | null; tool?: boolean; note?: string }
const extra: ItemDef[] = [
  { key: 'twig', name: 'Twig', block: null }, { key: 'iron', name: 'Iron nugget', block: null }, { key: 'berries', name: 'Red berries', block: null },
  { key: 'fluff', name: 'Fluff', block: null }, { key: 'cloth', name: 'Cloth', block: null }, { key: 'paper', name: 'Paper', block: null },
  { key: 'book', name: 'Book', block: null }, { key: 'tart', name: 'Berry tart', block: null }, { key: 'hay', name: 'Hay', block: null },
  { key: 'thorns', name: 'Boar thorns', block: null, note: 'Dropped by Bramble Boars' },
  { key: 'shimmer', name: 'Moth shimmer', block: null, note: 'Dropped by Murk Moths' },
  { key: 'pearl', name: 'Gloom pearl', block: null, note: 'Dropped by Gloom Gnashers' },
  { key: 'trowel', name: 'Digging trowel', block: null, tool: true, note: 'Digs two to three times faster, fastest on stone' },
  { key: 'bonk', name: 'Bonk-stick', block: null, tool: true, note: 'A big soft bonk for night creatures' },
  { key: 'slingshot', name: 'Slingshot', block: null, tool: true, note: 'Flings river pebbles' },
];
const NOT_ITEMS = new Set(['air', 'water', 'turf', 'deepstone', 'stump', 'lantern_out', 'leaves']);
export const ITEMS: Record<string, ItemDef> = {};
for (const b of BLOCKS) if (!NOT_ITEMS.has(b.key)) ITEMS[b.key] = { key: b.key, name: b.name, block: b.id };
for (const e of extra) ITEMS[e.key] = e;
/** The items creative mode's palette offers: every placeable block. */
export const PALETTE = Object.values(ITEMS).filter((i) => i.block !== null).map((i) => i.key);
export const itemName = (k: string) => ITEMS[k]?.name ?? k;
export const blockOf = (k: string) => ITEMS[k]?.block ?? null;
/** What digging a block puts in the bag (before any sapling luck). */
export function dropsOf(b: number): [string, number][] {
  const d = BLOCKS[b];
  if (d.drops) return d.drops;
  return ITEMS[d.key] ? [[d.key, 1]] : [];
}
export const BLOCK_KEY = (k: string) => BLOCK_BY_KEY[k];

export interface Recipe { id: string; out: string; n: number; ins: Record<string, number>; from: 'start' | 'leaf' | string }
const R = (out: string, n: number, ins: Record<string, number>, from: Recipe['from']): Recipe => ({ id: out, out, n, ins, from });
export const RECIPES: Recipe[] = [
  R('planks', 4, { log: 1 }, 'start'), R('twig', 3, { planks: 1 }, 'start'), R('workbench', 1, { planks: 4, twig: 2 }, 'start'),
  R('lantern', 1, { twig: 2, clay: 1 }, 'start'), R('door', 1, { planks: 3 }, 'start'), R('cloth', 1, { fluff: 3 }, 'start'),
  R('cushion', 1, { hay: 2, cloth: 1 }, 'start'), R('bed', 1, { planks: 2, cushion: 1 }, 'start'), R('bonk', 1, { twig: 2, planks: 1 }, 'start'),
  R('tart', 1, { berries: 3, hay: 1 }, 'hazel'), R('brick', 4, { clay: 2, stone: 1 }, 'hazel'), R('oven', 1, { brick: 4, stone: 2 }, 'hazel'),
  R('trowel', 1, { stone: 2, iron: 1, twig: 1 }, 'morrow'), R('slingshot', 1, { twig: 2, thorns: 1, cloth: 1 }, 'morrow'), R('cart', 1, { planks: 2, iron: 2 }, 'morrow'),
  R('paper', 2, { hay: 3 }, 'ottoline'), R('book', 1, { paper: 3, cloth: 1 }, 'ottoline'), R('bookshelf', 1, { planks: 2, book: 2 }, 'ottoline'),
  R('pot', 1, { clay: 2, daisy: 1 }, 'juniper'),
  R('chime', 1, { iron: 1, twig: 2, shimmer: 1 }, 'fennel'), R('drum', 1, { planks: 2, cloth: 1, twig: 1 }, 'fennel'),
  R('anvil', 1, { iron: 4, stone: 3 }, 'barnaby'),
  R('ladder', 3, { twig: 4 }, 'leaf'), R('fence', 3, { twig: 3, planks: 1 }, 'leaf'), R('bench', 1, { planks: 3 }, 'leaf'),
  R('glass', 2, { sand: 3, twig: 1 }, 'leaf'), R('chalk_tile', 2, { chalk: 2 }, 'leaf'), R('rose_tile', 2, { chalk: 2, berries: 1 }, 'leaf'),
  R('sky_tile', 2, { chalk: 2, bluebell: 1 }, 'leaf'), R('sun_tile', 2, { chalk: 2, daisy: 1 }, 'leaf'), R('path', 2, { pebbles: 2 }, 'leaf'),
  R('haybale', 1, { hay: 4 }, 'leaf'), R('bunting', 2, { cloth: 1, twig: 2 }, 'leaf'), R('lamp', 1, { crystal: 1, glass: 1, pearl: 1 }, 'leaf'),
];
export const RECIPE: Record<string, Recipe> = Object.fromEntries(RECIPES.map((r) => [r.id, r]));
export const START_RECIPES = RECIPES.filter((r) => r.from === 'start').map((r) => r.id);
/** In a Cosy nights valley there are no monsters, so their drops are swapped for things found in the valley. */
export const COSY_SWAP: Record<string, string> = { thorns: 'twig', shimmer: 'fluff', pearl: 'crystal' };
export function cosyIns(ins: Record<string, number>, cosy: boolean) {
  if (!cosy) return ins;
  const o: Record<string, number> = {};
  for (const [k, n] of Object.entries(ins)) { const s = COSY_SWAP[k] ?? k; o[s] = (o[s] ?? 0) + n; }
  return o;
}

export type NeighbourId = 'hazel' | 'morrow' | 'ottoline' | 'juniper' | 'fennel' | 'barnaby';
export type Step =
  | { kind: 'bring'; items: Record<string, number>; say: string; learn: string[] }
  | { kind: 'count'; what: 'catch' | 'plant' | 'lantern'; n: number; say: string; learn: string[] }
  | { kind: 'burrow'; say: string };
export interface Neighbour { id: NeighbourId; name: string; animal: string; role: string; item: string; hello: string; thanks: string; steps: Step[] }
export const NEIGHBOURS: Neighbour[] = [
  {
    id: 'hazel', name: 'Hazel', animal: 'hedgehog', role: 'baker', item: 'oven',
    hello: 'Oh, what a valley! I’m Hazel, and I bake. Might I stay, if you build me somewhere snug?',
    thanks: 'A real oven! The valley will smell of tarts by morning.',
    steps: [
      { kind: 'bring', items: { berries: 3 }, say: 'Could you pick 3 red berries? Dig the round red-berry bushes in the meadow.', learn: ['tart'] },
      { kind: 'bring', items: { tart: 1 }, say: 'Now weave a berry tart at the Burrow Workbench (berries and hay) so I can taste the valley.', learn: ['brick', 'oven'] },
      { kind: 'burrow', say: 'Build me a burrow: walls and a roof all round, a round door, a lantern, a bed and a brick oven. Then stand inside and check it.' },
    ],
  },
  {
    id: 'morrow', name: 'Morrow', animal: 'mole', role: 'miner', item: 'cart',
    hello: 'Evenin’. Morrow, miner. I hear there’s glow under that chalk cliff.',
    thanks: 'Snug as a tunnel. I’ll keep the cart oiled.',
    steps: [
      { kind: 'bring', items: { stone: 6 }, say: 'Bring me 6 fieldstone. Stone takes a long dig with your paws, so keep holding.', learn: ['trowel', 'slingshot'] },
      { kind: 'bring', items: { crystal: 2, pearl: 1 }, say: 'The glow cave is in the east cliff. Bring 2 glow crystals, and a gloom pearl from one of the Gloom Gnashers that guard them. Lanterns make them back off.', learn: ['cart'] },
      { kind: 'burrow', say: 'A burrow for me, then, with an ore cart inside. Door, lantern, bed: the usual.' },
    ],
  },
  {
    id: 'ottoline', name: 'Ottoline', animal: 'owl', role: 'librarian', item: 'bookshelf',
    hello: 'Hoo! Ottoline. I keep books, and I keep late hours.',
    thanks: 'Shelves! I shall write the history of Cubby Valley.',
    steps: [
      { kind: 'count', what: 'catch', n: 3, say: 'At night the little dust-bunnies come out. Catch 3 by bumping into them; they turn into fluff. Mind the grumpy ones.', learn: ['paper', 'book'] },
      { kind: 'bring', items: { book: 2 }, say: 'Weave paper from hay, then books from paper and cloth. Bring me 2 books.', learn: ['bookshelf'] },
      { kind: 'burrow', say: 'A quiet burrow with a bookshelf, if you please.' },
    ],
  },
  {
    id: 'juniper', name: 'Juniper', animal: 'rabbit', role: 'gardener', item: 'pot',
    hello: 'Hi hi! Juniper! Gardens are my favourite thing. Can I plant some?',
    thanks: 'My very own flower pot! I’ll keep the meadow blooming.',
    steps: [
      { kind: 'count', what: 'plant', n: 3, say: 'Birch leaves sometimes drop saplings. Plant 3 saplings on soil and watch them grow.', learn: ['pot'] },
      { kind: 'bring', items: { daisy: 2, bluebell: 2 }, say: 'Bring me 2 daisies and 2 bluebells: daisies in the meadow, bluebells in the birch wood.', learn: ['sun_tile'] },
      { kind: 'burrow', say: 'A burrow with a flower pot (clay and a daisy) for me!' },
    ],
  },
  {
    id: 'fennel', name: 'Fennel', animal: 'fox', role: 'musician', item: 'drum',
    hello: 'Fennel’s the name, music’s the game. This valley needs a tune.',
    thanks: 'Listen to that drum! Summer’s nearly here.',
    steps: [
      { kind: 'count', what: 'lantern', n: 3, say: 'Light the valley for me: place 3 new lanterns anywhere outside. Murk Moths snuff lanterns, so tap a snuffed one to relight it.', learn: ['chime'] },
      { kind: 'bring', items: { chime: 1 }, say: 'Weave me a wind chime. It needs moth shimmer from a Murk Moth.', learn: ['drum'] },
      { kind: 'burrow', say: 'A burrow with a drum, and I’ll play every evening.' },
    ],
  },
  {
    id: 'barnaby', name: 'Barnaby', animal: 'badger', role: 'smith', item: 'anvil',
    hello: 'Barnaby. Smith. I make the tools that make the things.',
    thanks: 'A good anvil, a good burrow. Now, about this fair everyone mentions…',
    steps: [
      { kind: 'bring', items: { iron: 5 }, say: 'Iron, 5 nuggets. Ironstone is in the cliffs and deep in the cave.', learn: ['anvil'] },
      { kind: 'bring', items: { thorns: 4 }, say: 'Bramble Boar thorns make the best rivets. Bring me 4. Watch for the snort before a boar charges, and step aside.', learn: [] },
      { kind: 'burrow', say: 'Last one. A burrow with an anvil, and then the valley is full.' },
    ],
  },
];
export const NEIGHBOUR: Record<NeighbourId, Neighbour> = Object.fromEntries(NEIGHBOURS.map((n) => [n.id, n])) as Record<NeighbourId, Neighbour>;

export type CritterKind = 'bunny' | 'boar' | 'moth' | 'gnasher' | 'grumble';
export interface CritterDef { kind: CritterKind; name: string; hp: number; hostile: boolean; damage: number; drops: Record<string, number>; speed: number; note: string }
export const CRITTERS: Record<CritterKind, CritterDef> = {
  bunny: { kind: 'bunny', name: 'Dust-bunny', hp: 1, hostile: false, damage: 0, drops: { fluff: 2 }, speed: 2.6, note: 'A harmless fluffball that knocks over things left in the dark. Bump into one to catch it.' },
  boar: { kind: 'boar', name: 'Bramble Boar', hp: 5, hostile: true, damage: 3, drops: { thorns: 2 }, speed: 2.2, note: 'Snorts and scrapes before it charges in a straight line. Step aside and it bonks into whatever is behind you, dizzy.' },
  moth: { kind: 'moth', name: 'Murk Moth', hp: 2, hostile: true, damage: 1, drops: { shimmer: 1 }, speed: 3.2, note: 'Flutters out of the dark to snuff lanterns standing in the open, and swoops at anyone outside at night.' },
  gnasher: { kind: 'gnasher', name: 'Gloom Gnasher', hp: 4, hostile: true, damage: 2, drops: { pearl: 1 }, speed: 2.8, note: 'Sits still as a rock in the dark cave beside the glow crystals, then lunges. Backs away from lantern light.' },
  grumble: { kind: 'grumble', name: 'Grumblefluff', hp: 3, hostile: true, damage: 1, drops: { fluff: 2 }, speed: 3.4, note: 'A grumpy dust-bunny that nibbles into your bag and runs off with a mouthful. Bonk it to get your things back.' },
};
