// Kiln & Clay's content: the pot shapes (outer profiles in clay units, a unit being about a centimetre), the glazes,
// the valley's neighbours, the week of orders and the upgrades. No rules live here; lib/pottery-game.ts has those.

/** A pot's outer profile: points of (height as a fraction of h, outer radius), bottom to top. */
export type Shape = { name: string; h: number; pts: [number, number][]; hollow: boolean; lip?: boolean };
export type PartId = 'body' | 'lid' | 'spout';
export type Part = { id: PartId; shape: Shape };

export const SHAPES = {
  pinchBowl: { name: 'little bowl', h: 3.4, pts: [[0, 2.3], [0.3, 3.3], [0.7, 4.2], [1, 4.6]], hollow: true },
  cup: { name: 'cup', h: 5.4, pts: [[0, 2.5], [0.12, 2.8], [1, 3.0]], hollow: true },
  mixingBowl: { name: 'mixing bowl', h: 4.6, pts: [[0, 3.0], [0.35, 4.9], [0.75, 6.0], [1, 6.3]], hollow: true },
  mug: { name: 'mug', h: 6.2, pts: [[0, 2.9], [0.15, 3.2], [0.85, 3.2], [1, 3.1]], hollow: true },
  honeyPot: { name: 'honey pot', h: 6.2, pts: [[0, 2.7], [0.45, 4.2], [0.85, 3.2], [1, 3.0]], hollow: true },
  flowerPot: { name: 'flower pot', h: 5.6, pts: [[0, 2.4], [0.9, 3.9], [1, 4.2]], hollow: true },
  tallVase: { name: 'tall vase', h: 11, pts: [[0, 2.6], [0.3, 4.0], [0.72, 2.1], [1, 2.7]], hollow: true },
  basin: { name: 'pudding basin', h: 5.0, pts: [[0, 2.6], [0.6, 4.8], [1, 5.2]], hollow: true },
  quillPot: { name: 'quill pot', h: 7.6, pts: [[0, 2.3], [0.5, 2.2], [1, 2.4]], hollow: true },
  pieDish: { name: 'pie dish', h: 2.4, pts: [[0, 3.2], [0.3, 3.5], [0.6, 7.2], [1, 8.4]], hollow: true },
  paddleDish: { name: 'paddling dish', h: 3.0, pts: [[0, 3.2], [0.25, 3.6], [0.65, 6.6], [1, 7.4]], hollow: true },
  jug: { name: 'jug', h: 8.2, pts: [[0, 3.0], [0.35, 4.1], [0.82, 3.0], [1, 3.4]], hollow: true, lip: true },
  jarBody: { name: 'lidded jar', h: 6.4, pts: [[0, 3.0], [0.5, 4.4], [0.9, 3.5], [1, 3.4]], hollow: true },
  budVase: { name: 'bud vase', h: 7.4, pts: [[0, 2.4], [0.38, 3.8], [0.8, 1.4], [1, 1.7]], hollow: true },
  lampBase: { name: 'round vase', h: 8.6, pts: [[0, 2.8], [0.45, 5.0], [0.85, 2.6], [1, 2.8]], hollow: true },
  storeJar: { name: 'storage jar', h: 9.0, pts: [[0, 3.3], [0.55, 5.0], [0.92, 3.8], [1, 3.7]], hollow: true },
  ciderJug: { name: 'tall jug', h: 10.5, pts: [[0, 3.2], [0.3, 4.4], [0.85, 2.8], [1, 3.3]], hollow: true, lip: true },
  gourd: { name: 'gourd vase', h: 10, pts: [[0, 2.6], [0.25, 4.2], [0.52, 2.4], [0.7, 3.2], [0.88, 1.7], [1, 1.9]], hollow: true },
  teaCup: { name: 'teacup', h: 4.4, pts: [[0, 2.0], [0.2, 2.6], [1, 3.6]], hollow: true },
  milkJug: { name: 'milk jug', h: 6.2, pts: [[0, 2.6], [0.4, 3.3], [0.85, 2.5], [1, 2.8]], hollow: true, lip: true },
  teapot: { name: 'teapot', h: 7.0, pts: [[0, 3.2], [0.42, 5.0], [0.88, 3.4], [1, 3.1]], hollow: true },
  jarLid: { name: 'lid', h: 2.8, pts: [[0, 3.7], [0.4, 3.6], [0.62, 1.4], [0.8, 0.9], [1, 1.2]], hollow: false },
  teapotLid: { name: 'teapot lid', h: 2.8, pts: [[0, 3.3], [0.4, 3.2], [0.62, 1.3], [0.8, 0.85], [1, 1.15]], hollow: false },
  spout: { name: 'spout', h: 5.0, pts: [[0, 2.3], [0.5, 1.7], [1, 1.25]], hollow: true },
  freeThrow: { name: 'anything you like', h: 7, pts: [[0, 3], [1, 3]], hollow: true },
} satisfies Record<string, Shape>;
export type ShapeId = keyof typeof SHAPES;

/** A glaze family is what a customer asks for; each glaze belongs to one. */
export type Family = 'honey' | 'cream' | 'blue' | 'green' | 'pink' | 'purple' | 'black';
export type GlazeId = 'honey' | 'cream' | 'sky' | 'moss' | 'rose' | 'cobalt' | 'celadon' | 'amber' | 'plum' | 'charcoal';
export const GLAZES: Record<GlazeId, { name: string; fam: Family; hex: string; raw: string; day: number; shop?: boolean }> = {
  honey: { name: 'Honey', fam: 'honey', hex: '#e2a033', raw: '#e8cfa0', day: 1 },
  cream: { name: 'Cream', fam: 'cream', hex: '#f4ead2', raw: '#ece6da', day: 1 },
  sky: { name: 'Sky blue', fam: 'blue', hex: '#6fb2e2', raw: '#c4d8e4', day: 1 },
  moss: { name: 'Moss green', fam: 'green', hex: '#6f9e45', raw: '#cad6b8', day: 1 },
  rose: { name: 'Rose', fam: 'pink', hex: '#e48a9c', raw: '#ecd0d4', day: 2 },
  cobalt: { name: 'Cobalt', fam: 'blue', hex: '#2c56a8', raw: '#b4bfd8', day: 3 },
  celadon: { name: 'Celadon', fam: 'green', hex: '#9fcdb0', raw: '#d4e2d8', day: 4 },
  amber: { name: 'Amber', fam: 'honey', hex: '#b8641e', raw: '#dcc0a4', day: 5 },
  plum: { name: 'Plum', fam: 'purple', hex: '#7a3a72', raw: '#d4c0d0', day: 99, shop: true },
  charcoal: { name: 'Charcoal', fam: 'black', hex: '#363238', raw: '#c8c4c4', day: 99, shop: true },
};
export const GLAZE_IDS = Object.keys(GLAZES) as GlazeId[];
export const FAMILY_NAME: Record<Family, string> = { honey: 'honey', cream: 'cream', blue: 'blue', green: 'green', pink: 'pink', purple: 'plum', black: 'charcoal' };

/** What a customer asks of the glaze. Every key present is one wish, scored loosely. */
export type GlazeAsk = { all?: Family; rim?: Family; foot?: Family; stripes?: { fam: Family; n: number }; speckle?: true; drip?: Family };

export type CustomerId = 'hedgehog' | 'duck' | 'badger' | 'heron' | 'squirrel' | 'rabbit' | 'owl';
export const CUSTOMERS: Record<CustomerId, { name: string; who: string; fur: string; trim: string }> = {
  hedgehog: { name: 'Mrs Prickle', who: 'the hedgehog', fur: '#8a6a4a', trim: '#f0c8d8' },
  duck: { name: 'Mother Duck', who: 'and the ducklings', fur: '#f6f2ea', trim: '#6fa8dc' },
  badger: { name: 'Bramble', who: 'the badger baker', fur: '#4a4a4e', trim: '#ffffff' },
  heron: { name: 'Professor Heron', who: 'the heron', fur: '#9aa8b4', trim: '#d8c070' },
  squirrel: { name: 'Hazel', who: 'the red squirrel', fur: '#c8642a', trim: '#f2d8b0' },
  rabbit: { name: 'Clover', who: 'the rabbit', fur: '#a07a58', trim: '#ffffff' },
  owl: { name: 'Old Mr Hoot', who: 'the owl', fur: '#8a6440', trim: '#c84a3a' },
};
export const CUSTOMER_IDS = Object.keys(CUSTOMERS) as CustomerId[];

export type Order = {
  id: string; day: number; who: CustomerId; title: string; ask: string;
  parts: Part[]; handle?: boolean; glaze: GlazeAsk;
  /** A new idea this order teaches, shown once. */
  teach?: { title: string; text: string };
  /** What the customer says at 3, 2 and 1 stars. */
  thanks: [string, string, string];
};
const body = (s: ShapeId): Part[] => [{ id: 'body', shape: SHAPES[s] }];

export const DAYS: { name: string; blurb: string }[] = [
  { name: 'Opening Day', blurb: 'The sign is up and the kiln is warm. Three neighbours are waiting already.' },
  { name: 'Handles', blurb: 'Mugs and pots that want holding.' },
  { name: 'Tall Things', blurb: 'Raise the walls high and keep them steady.' },
  { name: 'Wide and Low', blurb: 'Dishes and a jug. Slow the wheel for the wide ones.' },
  { name: 'Lids', blurb: 'Jars with lids that fit, and a vase with a narrow neck.' },
  { name: 'Grand Pieces', blurb: 'The biggest pots yet. Keep your walls even.' },
  { name: 'The Valley Picnic', blurb: 'Everyone is coming to the picnic. They need a tea set.' },
];

export const ORDERS: Order[] = [
  // ---- day 1: centre, open, raise, shape; dip, stripes, a rim
  { id: 'o1', day: 1, who: 'hedgehog', title: 'A blackberry bowl', ask: 'Could you make me a little bowl for my blackberries? Honey-coloured all over, if you please.',
    parts: body('pinchBowl'), glaze: { all: 'honey' },
    thanks: ['Oh, it’s perfect! The blackberries will look so happy in it.', 'What a dear little bowl. Thank you!', 'It’s a bowl, and I shall love it anyway.'] },
  { id: 'o2', day: 1, who: 'duck', title: 'The ducklings’ cup', ask: 'A cup for the ducklings’ milk, please, cream with two green stripes. They love stripes.',
    parts: body('cup'), glaze: { all: 'cream', stripes: { fam: 'green', n: 2 } },
    teach: { title: 'Stripes', text: 'Pick a glaze, then drag up or down the spinning pot to paint a band. A short drag makes a thin stripe.' },
    thanks: ['Quack! The ducklings are fighting over who drinks first!', 'Lovely stripes. Thank you, dears.', 'They’ll drink from it all the same. Thank you.'] },
  { id: 'o3', day: 1, who: 'badger', title: 'A dough bowl', ask: 'I need a big, wide mixing bowl for my bread dough. Cream inside and out, with a blue rim.',
    parts: body('mixingBowl'), glaze: { all: 'cream', rim: 'blue' },
    teach: { title: 'A rim', text: 'Dip it cream first, then pick a blue and paint a band right at the top for the rim.' },
    thanks: ['A baker’s dream of a bowl! Tomorrow’s loaves will be the best yet.', 'Good and sturdy. Thank you!', 'It’ll hold the dough. Thank you kindly.'] },
  // ---- day 2: handles, bellies
  { id: 'o4', day: 2, who: 'duck', title: 'A mug for Father Duck', ask: 'Father Duck wants a proper mug with a handle. Blue, like the pond.',
    parts: body('mug'), handle: true, glaze: { all: 'blue' },
    teach: { title: 'Handles', text: 'After throwing, pick a handle. The kiln joins it on for good.' },
    thanks: ['He hasn’t put it down all morning!', 'A fine mug. Thank you!', 'He says it’s very… mug-like. Thank you!'] },
  { id: 'o5', day: 2, who: 'squirrel', title: 'A honey pot', ask: 'A round honey pot, nice and plump in the middle and a bit narrower at the top. Honey glaze with a cream rim!',
    parts: body('honeyPot'), glaze: { all: 'honey', rim: 'cream' },
    teach: { title: 'A plump belly', text: 'Press inside the pot low down and drag outwards to swell the belly. Then press outside near the top and drag in to narrow it.' },
    thanks: ['So plump! So round! My honey has a palace!', 'Lovely and round. Thank you!', 'It holds honey. That’s the main thing!'] },
  { id: 'o6', day: 2, who: 'rabbit', title: 'A flower pot', ask: 'A flower pot that gets wider at the top, please. Cream with one rose-pink stripe.',
    parts: body('flowerPot'), glaze: { all: 'cream', stripes: { fam: 'pink', n: 1 } },
    thanks: ['My daisies will feel so fancy!', 'A pretty pot. Thank you!', 'The daisies don’t mind. Thank you!'] },
  // ---- day 3: tall, speckle
  { id: 'o7', day: 3, who: 'heron', title: 'A tall vase for reeds', ask: 'A tall vase for my reeds: a round belly low down, a slim neck, and a little flare at the top. Blue all over.',
    parts: body('tallVase'), glaze: { all: 'blue' },
    teach: { title: 'Tall walls', text: 'Raise the walls a few times: press outside at the bottom and slide up. Thin walls go higher, but too thin and they wobble.' },
    thanks: ['Exquisite. Truly. The reeds approve.', 'A most elegant vase. Thank you.', 'It stands up. That is something. Thank you.'] },
  { id: 'o8', day: 3, who: 'hedgehog', title: 'A pudding basin', ask: 'A deep pudding basin for my steamed puddings. Cream with brown speckles, like a hen’s egg.',
    parts: body('basin'), glaze: { all: 'cream', speckle: true },
    teach: { title: 'Speckles', text: 'Tap ✨ Speckle to scatter little iron flecks over the glaze.' },
    thanks: ['It’s just like an egg! My puddings will be so proud.', 'A good deep basin. Thank you!', 'It’ll hold a pudding. Thank you, dear.'] },
  { id: 'o9', day: 3, who: 'owl', title: 'A quill pot', ask: 'A tall, straight quill pot for my feathers and pens. Green all over, with a honey foot.',
    parts: body('quillPot'), glaze: { all: 'green', foot: 'honey' },
    teach: { title: 'A foot', text: 'A band right at the bottom of the pot is its foot.' },
    thanks: ['Hoo! Splendid. My quills stand to attention.', 'Very handsome. Thank you.', 'It will do nicely. Thank you.'] },
  // ---- day 4: wide and low, drips, jugs
  { id: 'o10', day: 4, who: 'badger', title: 'A pie dish', ask: 'A wide, shallow pie dish for my blackberry pies. Honey with a cream rim.',
    parts: body('pieDish'), glaze: { all: 'honey', rim: 'cream' },
    teach: { title: 'Wide and low', text: 'Wide pots fling themselves apart on a fast wheel. Slow the wheel down before you pull a dish out wide.' },
    thanks: ['The pie fits like it was made for it. Because it was!', 'A fine dish. Thank you!', 'Pie will go in it. Thank you!'] },
  { id: 'o11', day: 4, who: 'duck', title: 'A paddling dish', ask: 'A shallow paddling dish for the ducklings. Blue, with cream drips running down from the rim, like little waterfalls.',
    parts: body('paddleDish'), glaze: { all: 'blue', drip: 'cream' },
    teach: { title: 'Drips', text: 'Pick a glaze and tap 💧 Drip to let it run down from the rim.' },
    thanks: ['Splish! They won’t get out of it!', 'Lovely waterfalls. Thank you!', 'They’ll paddle in it anyway. Thank you!'] },
  { id: 'o12', day: 4, who: 'rabbit', title: 'A carrot-juice jug', ask: 'A jug with a handle for carrot juice, round below and narrower at the neck. Honey, with two cream stripes.',
    parts: body('jug'), handle: true, glaze: { all: 'honey', stripes: { fam: 'cream', n: 2 } },
    thanks: ['Pours like a dream! Not a drop spilled.', 'A lovely jug. Thank you!', 'It pours… mostly. Thank you!'] },
  // ---- day 5: lids, narrow necks
  { id: 'o13', day: 5, who: 'squirrel', title: 'An acorn jar with a lid', ask: 'A jar with a lid to keep my acorns safe from the jays. Green, with a honey stripe.',
    parts: [{ id: 'body', shape: SHAPES.jarBody }, { id: 'lid', shape: SHAPES.jarLid }], glaze: { all: 'green', stripes: { fam: 'honey', n: 1 } },
    teach: { title: 'Lids', text: 'Throw the jar first, then a small lid from its own little lump of clay: it doesn’t need opening. Shape a wide flat lid with a knob on top.' },
    thanks: ['Not a single jay will get in. Perfect!', 'It fits! Thank you!', 'The lid wobbles a bit, but I love it.'] },
  { id: 'o14', day: 5, who: 'heron', title: 'A bud vase', ask: 'A bud vase for a single rose: round below and a very slim neck. Rose pink, with a blue rim.',
    parts: body('budVase'), glaze: { all: 'pink', rim: 'blue' },
    thanks: ['One rose, one vase, perfect harmony.', 'Charming. Thank you.', 'The rose seems content. Thank you.'] },
  { id: 'o15', day: 5, who: 'owl', title: 'A round vase', ask: 'A round, moon-bellied vase for my study. Celadon green, speckled, with a cream foot.',
    parts: body('lampBase'), glaze: { all: 'green', speckle: true, foot: 'cream' },
    thanks: ['Like the full moon over the wood. Hoo!', 'Very fine. Thank you.', 'It is round-ish. Thank you.'] },
  // ---- day 6: grand pieces
  { id: 'o16', day: 6, who: 'hedgehog', title: 'A big storage jar', ask: 'A big jar with a lid for my winter apples. Amber, with a cream rim and cream drips.',
    parts: [{ id: 'body', shape: SHAPES.storeJar }, { id: 'lid', shape: SHAPES.jarLid }], glaze: { all: 'honey', rim: 'cream', drip: 'cream' },
    thanks: ['All my apples, safe and snug. Wonderful!', 'A grand jar. Thank you!', 'It holds apples. Thank you, dear.'] },
  { id: 'o17', day: 6, who: 'badger', title: 'A tall cider jug', ask: 'A tall jug for apple cider, with a handle. Cream, two honey stripes and a blue rim.',
    parts: body('ciderJug'), handle: true, glaze: { all: 'cream', stripes: { fam: 'honey', n: 2 }, rim: 'blue' },
    thanks: ['The finest jug in the valley!', 'A splendid jug. Thank you!', 'It pours. Good enough for cider!'] },
  { id: 'o18', day: 6, who: 'heron', title: 'A gourd vase', ask: 'A gourd vase: a big round belly, a waist, a smaller round belly above, and a slim neck. Blue with speckles.',
    parts: body('gourd'), glaze: { all: 'blue', speckle: true },
    thanks: ['A masterpiece. I may weep.', 'Remarkable work. Thank you.', 'Most… interesting. Thank you.'] },
  // ---- day 7: the picnic tea set
  { id: 'o19', day: 7, who: 'owl', title: 'Teacups for the picnic', ask: 'Teacups for everyone at the picnic! Make me the first one, with a handle: cream with a honey rim.',
    parts: body('teaCup'), handle: true, glaze: { all: 'cream', rim: 'honey' },
    thanks: ['I’ll have the potters copy this one for every guest!', 'A lovely cup. Thank you.', 'Tea will go in it. Hoo!'] },
  { id: 'o20', day: 7, who: 'rabbit', title: 'A milk jug', ask: 'A little milk jug for the tea, with a handle. Cream, with one blue stripe.',
    parts: body('milkJug'), handle: true, glaze: { all: 'cream', stripes: { fam: 'blue', n: 1 } },
    thanks: ['The perfect splash of milk every time!', 'Sweet little jug. Thank you!', 'It will do for milk. Thank you!'] },
  { id: 'o21', day: 7, who: 'squirrel', title: 'The picnic teapot', ask: 'The big one: a teapot for the whole valley! A round body, a spout, a lid and a handle. Cream with a blue rim and blue stripes, like the picnic sky.',
    parts: [{ id: 'body', shape: SHAPES.teapot }, { id: 'spout', shape: SHAPES.spout }, { id: 'lid', shape: SHAPES.teapotLid }], handle: true, glaze: { all: 'cream', rim: 'blue', stripes: { fam: 'blue', n: 2 } },
    teach: { title: 'The teapot', text: 'Three throws: the round body, a slim tapering spout, and a lid with a knob. Then a handle, and the kiln joins them all.' },
    thanks: ['The whole valley is coming for tea. Thank you, both of you!', 'It pours! Hooray for the picnic!', 'A teapot! Just about! Hooray!'] },
];
export const ORDER_IDS = ORDERS.map((o) => o.id);
export const DAY_COUNT = DAYS.length;
export const FINALE = 'o21';

export type UpgradeId = 'sponge' | 'quiet' | 'glazes' | 'shelf' | 'kiln';
export const UPGRADES: Record<UpgradeId, { name: string; icon: string; cost: number; blurb: string; day: number }> = {
  sponge: { name: 'Big Sponge', icon: '🧽', cost: 15, blurb: 'Water lasts longer: the clay dries more slowly.', day: 1 },
  quiet: { name: 'Quiet Wheel', icon: '🎡', cost: 40, blurb: 'Finer control: your touch is more precise and the walls hold steadier.', day: 2 },
  glazes: { name: 'Plum & Charcoal', icon: '🎨', cost: 25, blurb: 'Two new glazes for your own pots.', day: 2 },
  shelf: { name: 'Display Shelf', icon: '🪟', cost: 35, blurb: 'Pots in your gallery sit in the window; passers-by tip an acorn for each (up to five) every new day.', day: 3 },
  kiln: { name: 'Big Kiln', icon: '🔥', cost: 60, blurb: 'Fires two pots at once, and its heat holds steadier: the sweet band is wider.', day: 3 },
};
export const UPGRADE_IDS = Object.keys(UPGRADES) as UpgradeId[];

/** The handles a pot can be given. */
export type HandleId = 'loop' | 'ear' | 'big' | 'twig';
export const HANDLES: Record<HandleId, { name: string }> = { loop: { name: 'Loop' }, ear: { name: 'Ear' }, big: { name: 'Big D' }, twig: { name: 'Twist' } };
export const HANDLE_IDS = Object.keys(HANDLES) as HandleId[];
