// Lake Whisker, the world of Driftwood Post: every island, rock, reed bed, current, fog bank, hidden shell and message
// bottle, all placed by hand, plus the story's letters and the pool of side deliveries. Data and geometry only, no DOM:
// driftwood-game.ts holds the rules and driftwood-scene.ts draws it.
//
// Coordinates are lake units, x to the east and y to the south; angles are radians with 0 pointing east and π/2 south.

export const LAKE_W = 4000, LAKE_H = 3000;
/** How far from the lake's edge the land starts. The boat bumps softly off it. */
export const SHORE = 70;

export type IslandId =
  | 'home' | 'lighthouse' | 'bakery' | 'boatyard' | 'reeds' | 'orchard' | 'market' | 'heron' | 'rabbits' | 'observatory'
  | 'palm' | 'sandbar' | 'birdhouse' | 'gullrest' | 'pebblebar';
export type ResidentId = 'duo' | 'tuft' | 'pip' | 'bun' | 'tamsin' | 'mossy' | 'bramble' | 'clover' | 'grisel' | 'dabble' | 'quill';
export type Pt = [number, number];

export type IslandDef = {
  id: IslandId; name: string; x: number; y: number;
  /** How wide and tall the island's painting stands on the lake, in lake units (its ground's middle sits on x, y). */
  size: number;
  /** Which way the jetty points out from the island (villages only). */
  dockA: number | null;
  /** The painting has its own jetty or slipway where the boat ties up, so none is drawn over it. */
  jetty?: boolean;
  art: string; resident: ResidentId | null; blurb: string;
};

export const ISLAND_DEFS: IslandDef[] = [
  { id: 'home', name: 'Whisker Cove', x: 600, y: 2470, size: 490, dockA: 1.26, art: 'island-home', jetty: true, resident: 'duo',
    blurb: 'Home: the red-roofed post office, Granny Tuft’s burrow and the boathouse where the driftwood dinghy waited.' },
  { id: 'lighthouse', name: 'Lighthouse Rock', x: 1450, y: 1880, size: 380, dockA: 2.35, art: 'island-lighthouse', resident: 'pip',
    blurb: 'A rocky knuckle with a white-and-red lighthouse. Old Pip has kept the lamp for forty years.' },
  { id: 'bakery', name: 'Crumb Isle', x: 1760, y: 2620, size: 440, dockA: 2.7, art: 'island-bakery', resident: 'bun',
    blurb: 'A round, warm island that smells of bread. The windmill grinds Bun’s flour.' },
  { id: 'boatyard', name: 'Slipway Isle', x: 420, y: 1640, size: 410, dockA: 1.31, art: 'island-boatyard', jetty: true, resident: 'tamsin',
    blurb: 'Timber stacks, a crane and a slipway. Tamsin can fix anything that floats, and some things that don’t.' },
  { id: 'reeds', name: 'Reedmere', x: 2620, y: 2380, size: 360, dockA: 2.75, art: 'island-reeds', resident: 'mossy',
    blurb: 'Stilt houses over the marsh, lily pads and the loudest choir on the lake.' },
  { id: 'orchard', name: 'Blossom Holm', x: 3460, y: 2500, size: 490, dockA: 2.7, art: 'island-orchard', resident: 'bramble',
    blurb: 'Blossom trees and humming beehives. Bramble looks after both.' },
  { id: 'market', name: 'Bobbin Market', x: 2200, y: 1520, size: 430, dockA: 1.65, art: 'island-market', resident: 'dabble',
    blurb: 'Striped stalls and bargains. If it exists, Dabble sells it; if it doesn’t, Dabble knows a duck.' },
  { id: 'heron', name: 'Crag Top', x: 1060, y: 820, size: 530, dockA: 1.85, art: 'island-heron', resident: 'grisel',
    blurb: 'A tall grey crag with a very tidy nest on top, and a very particular heron in it.' },
  { id: 'rabbits', name: 'Twin Hills', x: 3420, y: 1470, size: 540, dockA: 3.0, art: 'island-rabbits', resident: 'clover',
    blurb: 'Two grassy hills full of burrows, joined by a little bridge. Clover lives on the left hill.' },
  { id: 'observatory', name: 'Starpine', x: 2720, y: 540, size: 410, dockA: 1.7, art: 'island-observatory', resident: 'quill',
    blurb: 'Tall pines and a tiny domed observatory, often wrapped in fog. Professor Quill counts the stars.' },
  { id: 'palm', name: 'Lone Palm', x: 1900, y: 930, size: 200, dockA: null, art: 'island-small-1', resident: null, blurb: 'One tree, two rocks and a great deal of opinion from the gulls.' },
  { id: 'sandbar', name: 'Shell Sandbar', x: 3040, y: 1980, size: 240, dockA: null, art: 'island-small-2', resident: null, blurb: 'A long pale sandbar that collects shells and sunbathing ducks.' },
  { id: 'birdhouse', name: 'Birdhouse Rock', x: 430, y: 470, size: 190, dockA: null, art: 'island-small-3', resident: null, blurb: 'A mossy rock with a birdhouse on a post. Nobody knows who lives in it.' },
  { id: 'gullrest', name: 'Gull Rest', x: 3640, y: 760, size: 210, dockA: null, art: 'island-small-1', resident: null, blurb: 'A palm, some rocks, and gulls resting from a hard day of shouting.' },
  { id: 'pebblebar', name: 'Pebble Bar', x: 1160, y: 1420, size: 200, dockA: null, art: 'island-small-2', resident: null, blurb: 'A curl of pebbles just above the water, perfect for skimming stones.' },
];

export type Rock = { x: number; y: number; r: number; shoal?: boolean };
/** Rocks bump the boat; shoals are pale sandy shallows that bump it the same way. */
export const ROCKS: Rock[] = [
  // around Lighthouse Rock
  { x: 1625, y: 1760, r: 26 }, { x: 1300, y: 1760, r: 22 }, { x: 1620, y: 1990, r: 20 }, { x: 1660, y: 1830, r: 14 },
  // Crag Top's skirt of boulders
  { x: 845, y: 715, r: 30 }, { x: 1240, y: 700, r: 26 }, { x: 1220, y: 960, r: 20 }, { x: 930, y: 980, r: 18 },
  // the narrows between the market and Pebble Bar
  { x: 1660, y: 1400, r: 24 }, { x: 1720, y: 1640, r: 20 },
  // Shell Sandbar's shoals
  { x: 3190, y: 1910, r: 46, shoal: true }, { x: 2900, y: 2080, r: 40, shoal: true },
  // Starpine's rocky approach, hidden in the fog
  { x: 2520, y: 760, r: 26 }, { x: 2930, y: 740, r: 24 }, { x: 2600, y: 330, r: 22 }, { x: 2910, y: 410, r: 18 },
  // the far east and the orchard
  { x: 3760, y: 1980, r: 30 }, { x: 3200, y: 2700, r: 26 }, { x: 3700, y: 2240, r: 18 },
  // Twin Hills' little reef
  { x: 3150, y: 1300, r: 22 }, { x: 3180, y: 1650, r: 20 },
  // near home and the bakery
  { x: 930, y: 2300, r: 22 }, { x: 1300, y: 2560, r: 26, shoal: true }, { x: 2080, y: 2470, r: 22 },
  // the north-west
  { x: 620, y: 560, r: 24 }, { x: 300, y: 1040, r: 28 }, { x: 1520, y: 520, r: 30, shoal: true },
  // Gull Rest
  { x: 3500, y: 640, r: 20 }, { x: 3780, y: 900, r: 22 },
];

/** Reed beds: ellipses that slow the boat to a crawl. Reedmere is ringed with them. */
export type Reed = { x: number; y: number; rx: number; ry: number; rot: number };
export const REEDS: Reed[] = [
  { x: 2390, y: 2230, rx: 140, ry: 60, rot: 0.5 }, { x: 2860, y: 2520, rx: 150, ry: 70, rot: -0.35 }, { x: 2480, y: 2610, rx: 110, ry: 55, rot: 0.25 },
  { x: 230, y: 2150, rx: 120, ry: 60, rot: 1.2 }, { x: 3820, y: 1500, rx: 100, ry: 50, rot: 1.4 }, { x: 1020, y: 2680, rx: 120, ry: 50, rot: -0.2 },
];

/** Currents: streams that carry the boat along their line, strongest in the middle. `speed` is lake units a tick. */
export type Current = { name: string; pts: Pt[]; w: number; speed: number };
export const CURRENTS: Current[] = [
  { name: 'The Long Current', pts: [[260, 1240], [900, 1190], [1500, 1180], [1950, 1140], [2500, 1060], [3000, 1020], [3500, 1060], [3860, 1150]], w: 120, speed: 1.15 },
  { name: 'The Homeward Drift', pts: [[2950, 1760], [2450, 1960], [1950, 2150], [1450, 2230], [1000, 2190]], w: 110, speed: 1.0 },
  { name: 'Heron’s Race', pts: [[720, 380], [760, 760], [760, 1100], [700, 1420]], w: 95, speed: 0.9 },
];

/** Fog banks: soft patches that hide the chart and shrink how far you can see. They drift a little. */
export type Fog = { x: number; y: number; r: number };
export const FOGS: Fog[] = [
  { x: 2720, y: 560, r: 470 },
  { x: 3680, y: 560, r: 300 },
  { x: 320, y: 300, r: 280 },
  { x: 1980, y: 2000, r: 220 },
];

/** Hidden shells in coves and behind rocks: sail over one to pick it up. */
export const SHELLS: Pt[] = [
  [880, 2620], [1260, 1980], [1880, 2810], [640, 1500], [2780, 2640], [3700, 2420], [2380, 1700], [1180, 620],
  [3640, 1240], [2560, 300], [1950, 1030], [3100, 1870], [520, 360], [3730, 900], [1150, 1520], [310, 1900],
  [3230, 2760], [2980, 690], [1680, 1720], [2140, 2380],
];

export type Bottle = { x: number; y: number; title: string; text: string };
export const BOTTLES: Bottle[] = [
  { x: 1050, y: 2050, title: 'A very old note', text: 'When this lake was young, a post boat called the Dandelion sailed it every morning. The islands sent each other bread and gossip and the occasional goat. Whoever finds this: keep the post going.' },
  { x: 2050, y: 760, title: 'A note in a pup’s handwriting', text: 'I am Pip and I am seven and tonight I sailed in the Lantern Regatta with my dad. Every island lit up. When I am big I will keep the lighthouse so the lights never go out.' },
  { x: 3300, y: 1820, title: 'A note with a cloud drawn on it', text: 'If you find this, I am Clover and I am six and I like clouds. If you also like clouds please write back. I live on the left hill. (Not the right hill.)' },
  { x: 860, y: 1260, title: 'A sailor’s tip', text: 'The Long Current runs east across the middle of the lake. Ride it to the market and you’ll be there before your tea goes cold. Coming back, use the Homeward Drift in the south.' },
  { x: 3000, y: 2900, title: 'Tamsin’s grandad’s notebook', text: 'A good keel lets a boat point higher into the wind. A bigger sail is grand on a reach. And a sturdy hull forgives a lot of rocks. Most important: say thank you to your boat.' },
  { x: 2400, y: 940, title: 'A pressed feather', text: 'Lantern Regatta, champion: G. Heron of Crag Top, three years running. She sailed like the wind and she complained about the wind the whole way round.' },
];

export type Resident = { name: string; role: string; art: string | null };
export const RESIDENTS: Record<ResidentId, Resident> = {
  duo: { name: 'Dora & Enzo', role: 'the new posties', art: 'dora' },
  tuft: { name: 'Granny Tuft', role: 'Dora and Enzo’s gran', art: null },
  pip: { name: 'Old Pip', role: 'lighthouse keeper', art: 'otter' },
  bun: { name: 'Bun', role: 'baker', art: 'mole' },
  tamsin: { name: 'Tamsin', role: 'boatwright', art: 'beaver' },
  mossy: { name: 'Mossy', role: 'choir conductor', art: 'mossy' },
  bramble: { name: 'Bramble', role: 'beekeeper', art: 'rabbit-b' },
  clover: { name: 'Clover', role: 'cloud-spotter', art: 'rabbit-a' },
  grisel: { name: 'Mrs Grisel', role: 'heron of strong opinions', art: 'heron' },
  dabble: { name: 'Dabble', role: 'market trader', art: 'duck' },
  quill: { name: 'Professor Quill', role: 'astronomer', art: 'hedgehog' },
};

/** The story: who writes to whom, in order. `need` lists the story letters that must arrive before this one is written. */
export type StoryDef = {
  n: number; from: IslandId; to: IslandId; sender: ResidentId; recipient: ResidentId; title: string; text: string;
  parcel?: boolean; heavy?: boolean; fragile?: boolean; express?: boolean; need: number[];
};
export const STORY: StoryDef[] = [
  { n: 1, from: 'home', to: 'lighthouse', sender: 'tuft', recipient: 'pip', need: [], title: 'A letter for Old Pip',
    text: 'Dear Pip,\nThe post boat has sprung a leak, so my two grandkits have patched up that old driftwood dinghy and declared themselves the post. They are very fluffy and very serious about it. Please act surprised.\nLove, Tuft' },
  { n: 2, from: 'lighthouse', to: 'bakery', sender: 'pip', recipient: 'bun', need: [1], title: 'An order for a seed loaf',
    text: 'Bun, old friend,\nA post boat! I nearly dropped my kettle. My lamp’s gone dim and my larder’s gone dimmer. One seed loaf, please, and all the news you’ve been saving up these four quiet years.\n— Pip' },
  { n: 3, from: 'bakery', to: 'home', sender: 'bun', recipient: 'tuft', need: [2], parcel: true, fragile: true, title: 'Six cream buns',
    text: 'Dear Tuft,\nThank-you buns for your brave posties: six cream buns, still warm. Please tell them not to sail into anything. Buns are very delicate. So am I, if I’m honest.\nFloury regards, Bun' },
  { n: 4, from: 'home', to: 'boatyard', sender: 'tuft', recipient: 'tamsin', need: [3], title: 'A worried note about the boat',
    text: 'Tamsin, dear,\nThe children’s boat is held together with string, hope and one of my old scarves. Could you look her over? I’ve put shells in the jar to pay for it. Don’t tell them I said “hope”.\n— Tuft' },
  { n: 5, from: 'boatyard', to: 'lighthouse', sender: 'tamsin', recipient: 'pip', need: [4], parcel: true, heavy: true, title: 'A lamp wick (and an anchor)',
    text: 'Pip,\nHere is the lamp wick you ordered four years ago. Sorry about the wait. It’s heavy because I’ve put a spare anchor in the box. No reason. Anchors are just nice to have.\n— Tamsin' },
  { n: 6, from: 'lighthouse', to: 'rabbits', sender: 'pip', recipient: 'clover', need: [5], title: 'An answer, years late',
    text: 'Young Clover,\nYears ago you asked me whether anyone else on the lake liked cloud-spotting. I’ve finally remembered: Bramble, over on Blossom Holm. Write to her. The post is back, so you’ve no excuse.\n— Old Pip' },
  { n: 7, from: 'rabbits', to: 'orchard', sender: 'clover', recipient: 'bramble', need: [6], title: 'A shy first letter',
    text: 'Dear Bramble,\nPip says you like clouds. Today I saw one shaped like a teapot. Do you like teapots? You don’t have to answer. (Please answer.)\nFrom Clover, Twin Hills (the left hill)' },
  { n: 8, from: 'orchard', to: 'rabbits', sender: 'bramble', recipient: 'clover', need: [7], express: true, title: 'EXPRESS EXPRESS EXPRESS',
    text: 'Dear Clover,\nI DO like teapots!! This morning I saw a cloud shaped like a rabbit holding a teapot, and I think it might have been you. Is that a strange thing to write? I have written EXPRESS on this three times.\nYour friend (?) Bramble' },
  { n: 9, from: 'orchard', to: 'bakery', sender: 'bramble', recipient: 'bun', need: [8], parcel: true, heavy: true, title: 'Four jars of blossom honey',
    text: 'Dear Mr Bun,\nThe bees have been busy and so have I. Four jars of blossom honey, as promised before the post went quiet. Sorry they’re four years late. The bees say sorry too. Mostly they say “bzz”.\n— Bramble' },
  { n: 10, from: 'bakery', to: 'market', sender: 'bun', recipient: 'dabble', need: [9], title: 'A flour order',
    text: 'Dabble!\nThe posties are back and I have honey again. Order me the big flour sacks, the really big ones you have to sit on to close. Something tells me everyone’s going to want cake.\n— Bun' },
  { n: 11, from: 'market', to: 'heron', sender: 'dabble', recipient: 'grisel', need: [10], parcel: true, fragile: true, title: 'New spectacles',
    text: 'Mrs G!\nYour new spectacles have finally come in! Rather than make you fly down to the market and complain about the queue, I’m sending them by post. Handle with care, posties. She will check.\nQuack quack, Dabble' },
  { n: 12, from: 'heron', to: 'home', sender: 'grisel', recipient: 'duo', need: [11], title: 'A complaint (sort of)',
    text: 'To Whom It May Concern,\nYour boat is too small. Your posties are too fluffy. My spectacles arrived in perfect condition, which is most irregular, and I intend to get used to it.\nYours, Mrs Grisel\nP.S. Thank you.' },
  { n: 13, from: 'market', to: 'reeds', sender: 'dabble', recipient: 'mossy', need: [10], parcel: true, heavy: true, title: 'Ten lily pads',
    text: 'Mossy, my dear,\nTen fresh lily pads for the choir stand, as ordered! The posties tell me they’re much heavier than they look. Most things are, except clouds and rumours.\nQuack, Dabble' },
  { n: 14, from: 'reeds', to: 'observatory', sender: 'mossy', recipient: 'quill', need: [13], title: 'A question about stars',
    text: 'Dear Professor,\nThe Reedmere Choir would like to sing to the stars. Which night of the season will they be brightest? We are ready to practise. We have been practising. We never stop. Ribbit.\n— Mossy, conductor' },
  { n: 15, from: 'observatory', to: 'lighthouse', sender: 'quill', recipient: 'pip', need: [14], express: true, title: 'Urgent and exciting!',
    text: 'Pip! Urgent and exciting!\nMy sums say the clearest night of the year is coming very soon. From up here I could see every island at once, if only they were lit. Your lamp could reach them all with a proper lens. I am grinding one!\n— Professor Quill' },
  { n: 16, from: 'lighthouse', to: 'market', sender: 'pip', recipient: 'dabble', need: [15, 12], title: 'An old otter’s idea',
    text: 'Dabble,\nAn old otter’s idea. On the clear night, what if every island lit a lantern and sailed out to the lighthouse, like the regattas we had when I was a pup? Tell everybody. You’re the best at telling everybody.\n— Pip' },
  { n: 17, from: 'market', to: 'boatyard', sender: 'dabble', recipient: 'tamsin', need: [16], express: true, title: 'TAMSIN! REGATTA!',
    text: 'TAMSIN!\nA Lantern Regatta! The whole lake is coming! Everyone wants a boat! How many can you build by the clear night? (Please say lots.) (Please say hundreds.)\nVery excited quacks, Dabble' },
  { n: 18, from: 'boatyard', to: 'observatory', sender: 'tamsin', recipient: 'quill', need: [17], parcel: true, heavy: true, title: 'A brass lens mount',
    text: 'Professor,\nBrass mount for your lens, made from the drawing on the back of your napkin. I built nine boats today and I’m not even tired. That’s a lie. Mind your spines on the edges.\n— Tamsin' },
  { n: 19, from: 'observatory', to: 'lighthouse', sender: 'quill', recipient: 'pip', need: [18], parcel: true, fragile: true, title: 'The great lens',
    text: 'Pip,\nThe lens! Ground by paw over eleven nights. Please do not drop it, sit on it, or use it to make toast. It will throw your light to the far shore and back.\nStarrily, Quill' },
  { n: 20, from: 'rabbits', to: 'orchard', sender: 'clover', recipient: 'bramble', need: [16], express: true, title: 'A very brave question',
    text: 'Bramble,\nThere’s going to be a regatta. Would you like to share a boat? You can say no. Please don’t say no. I’ve drawn you a teapot on the back to help you decide.\n— Clover (the left hill)' },
  { n: 21, from: 'orchard', to: 'rabbits', sender: 'bramble', recipient: 'clover', need: [20], title: 'YES',
    text: 'YES.\n(Sorry for shouting. Yes, please.) I will bring the teapot. A real one, with honey. I’m so happy I told the bees, and the bees told everyone.\n— Bramble' },
  { n: 22, from: 'heron', to: 'bakery', sender: 'grisel', recipient: 'bun', need: [16], title: 'A cake reservation',
    text: 'Mr Bun,\nI shall attend this regatta purely to complain about it. Kindly reserve me a large slice of something. Not too large. Quite large. Make it large.\n— Mrs Grisel' },
  { n: 23, from: 'bakery', to: 'lighthouse', sender: 'bun', recipient: 'pip', need: [22], parcel: true, heavy: true, fragile: true, title: 'The Lantern Cake',
    text: 'Pip,\nOne Lantern Cake: three layers, honey icing and a little marzipan lighthouse on top. It is heavy and it is fragile, like all the best things. Tilt it and I’ll know.\n— Bun' },
  { n: 24, from: 'lighthouse', to: 'home', sender: 'pip', recipient: 'duo', need: [19, 21, 23], title: 'An invitation',
    text: 'To the Posties of Lake Whisker,\nEvery island is talking again, and it’s because of you two and your leaky little boat. Tonight is the clear night. Sail to the lighthouse at dusk, and bring a lantern.\nWith love, Old Pip' },
];

/** Side deliveries, drawn from this pool between story letters. `{to}` and `{from}` become the residents’ names. */
export type SideDef = { title: string; text: string; parcel?: boolean; heavy?: boolean; fragile?: boolean; express?: boolean };
export const SIDE_POOL: SideDef[] = [
  { title: 'A postcard', text: 'Dear {to},\nWish you were here! I’ve drawn a picture of here on the front so you can see it. It’s the same as there, mostly, but with more me.\n— {from}' },
  { title: 'Knitted socks', parcel: true, text: '{to},\nI knitted you socks. One is longer than the other. Wear it on your longer leg.\n— {from}' },
  { title: 'A jar of pickled acorns', parcel: true, heavy: true, text: 'For {to}: pickled acorns, my mother’s recipe. Do not open near anyone you wish to keep as a friend.\n— {from}' },
  { title: 'A painted teacup', parcel: true, fragile: true, text: '{to},\nA teacup I painted with tiny boats on it. If it arrives in one piece, the posties are wizards.\n— {from}' },
  { title: 'A party invitation', express: true, text: '{to}!\nParty! Tonight! Bring a hat! Any hat! Even a small one! Reply by post, quickly, it’s tonight!\n— {from}' },
  { title: 'A borrowed book, returned', parcel: true, text: 'Dear {to},\nHere is your book back. I only spilt tea on one page and I think it improves the plot.\n— {from}' },
  { title: 'A recipe card', text: '{to},\nAs promised: dandelion fritters. The secret ingredient is more dandelions.\n— {from}' },
  { title: 'Pressed flowers', fragile: true, parcel: true, text: 'For {to}: flowers from my garden, pressed flat in a very heavy dictionary. Please open gently.\n— {from}' },
  { title: 'A box of good pebbles', parcel: true, heavy: true, text: '{to},\nFor your garden path. They are very good pebbles. I checked each one personally.\n— {from}' },
  { title: 'A birthday card', express: true, text: 'Happy birthday, {to}! I remembered! (I nearly didn’t.) Please read this before the day is over.\n— {from}' },
  { title: 'A crossword answer', express: true, text: '{to},\nIt was “TEAPOT”. I couldn’t wait until Thursday. I may never sleep again.\n— {from}' },
  { title: 'A tin of biscuits', parcel: true, text: 'Dear {to},\nA tin of biscuits. There were twelve. There are now eleven. I tested one for safety.\n— {from}' },
  { title: 'A drawing of a cloud', text: '{to},\nI saw this cloud and thought of you. It looks like a sheep doing its taxes.\n— {from}' },
  { title: 'A spare lantern', parcel: true, fragile: true, text: '{to},\nA spare lantern for long evenings. Light it, put the kettle on, and think of me.\n— {from}' },
  { title: 'A thank-you note', text: 'Dear {to},\nThank you for the thing. You know the thing. It was lovely, and I think of it often.\n— {from}' },
  { title: 'A jar of jam', parcel: true, heavy: true, fragile: true, text: '{to},\nBlackberry jam, the good kind. The jar is heavy and the glass is thin, so I’ve wrapped it in three scarves.\n— {from}' },
];

// ---------------------------------------------------------------- geometry

export type Island = IslandDef & {
  /** The smoothed coast, used both for collisions and for drawing. */
  poly: Pt[];
  /** The farthest the coast reaches from the middle, for quick distance checks. */
  reach: number;
  /** Where the boat ties up, and which way it faces when it casts off. */
  dock: { x: number; y: number; a: number } | null;
  /** Where the jetty meets the shore. */
  pier: Pt | null;
};

/**
 * Each island painting's ground, traced from the painting (`public/art/driftwood/<art>.webp`): where the ground's middle
 * sits in the picture and 48 points round its edge, as fractions of the picture's size. Traced from the paintings'
 * outlines, kept inside the sandy rim, and capped above by the ground's mirror image so towers, trees and crags that
 * stand up off the ground don't count as land. Both the collisions and the drawn stand-ins use these.
 */
export const ART_SHAPES: Record<string, { c: Pt; pts: Pt[] }> = {
  'island-bakery': { c: [0.498, 0.644], pts: [[0.931, 0.644], [0.925, 0.701], [0.904, 0.753], [0.87, 0.799], [0.832, 0.837], [0.792, 0.87], [0.746, 0.892], [0.699, 0.906], [0.656, 0.919], [0.615, 0.926], [0.575, 0.932], [0.536, 0.936], [0.498, 0.934], [0.461, 0.93], [0.422, 0.928], [0.382, 0.924], [0.343, 0.912], [0.304, 0.897], [0.26, 0.882], [0.215, 0.862], [0.174, 0.832], [0.136, 0.795], [0.103, 0.75], [0.077, 0.7], [0.066, 0.644], [0.077, 0.589], [0.103, 0.539], [0.136, 0.494], [0.174, 0.457], [0.215, 0.427], [0.26, 0.407], [0.304, 0.392], [0.343, 0.377], [0.382, 0.365], [0.422, 0.361], [0.461, 0.359], [0.498, 0.355], [0.536, 0.353], [0.575, 0.357], [0.615, 0.363], [0.656, 0.37], [0.699, 0.383], [0.746, 0.397], [0.792, 0.419], [0.832, 0.452], [0.87, 0.49], [0.904, 0.536], [0.925, 0.588]] },
  'island-boatyard': { c: [0.499, 0.558], pts: [[0.919, 0.558], [0.91, 0.612], [0.899, 0.665], [0.892, 0.72], [0.871, 0.772], [0.834, 0.815], [0.795, 0.853], [0.751, 0.885], [0.698, 0.902], [0.645, 0.911], [0.598, 0.925], [0.548, 0.933], [0.499, 0.929], [0.451, 0.92], [0.406, 0.905], [0.362, 0.889], [0.315, 0.877], [0.265, 0.862], [0.219, 0.838], [0.172, 0.809], [0.131, 0.77], [0.105, 0.721], [0.091, 0.667], [0.082, 0.613], [0.079, 0.558], [0.089, 0.504], [0.1, 0.451], [0.111, 0.397], [0.144, 0.353], [0.192, 0.322], [0.227, 0.286], [0.265, 0.253], [0.315, 0.238], [0.362, 0.227], [0.406, 0.21], [0.451, 0.196], [0.499, 0.186], [0.548, 0.182], [0.598, 0.19], [0.645, 0.204], [0.698, 0.213], [0.751, 0.23], [0.795, 0.262], [0.834, 0.3], [0.871, 0.343], [0.892, 0.395], [0.899, 0.45], [0.91, 0.503]] },
  'island-heron': { c: [0.498, 0.696], pts: [[0.871, 0.696], [0.86, 0.744], [0.829, 0.785], [0.793, 0.818], [0.751, 0.842], [0.708, 0.857], [0.672, 0.87], [0.637, 0.878], [0.604, 0.879], [0.574, 0.88], [0.549, 0.886], [0.525, 0.898], [0.498, 0.91], [0.469, 0.914], [0.441, 0.91], [0.413, 0.902], [0.386, 0.89], [0.359, 0.878], [0.328, 0.866], [0.294, 0.853], [0.261, 0.833], [0.219, 0.812], [0.165, 0.786], [0.129, 0.745], [0.126, 0.696], [0.136, 0.649], [0.168, 0.608], [0.219, 0.581], [0.261, 0.559], [0.294, 0.54], [0.328, 0.526], [0.359, 0.515], [0.386, 0.502], [0.413, 0.491], [0.441, 0.482], [0.469, 0.479], [0.498, 0.482], [0.525, 0.494], [0.549, 0.507], [0.574, 0.513], [0.604, 0.513], [0.637, 0.515], [0.672, 0.523], [0.708, 0.535], [0.751, 0.55], [0.793, 0.574], [0.829, 0.608], [0.86, 0.649]] },
  'island-home': { c: [0.498, 0.546], pts: [[0.927, 0.546], [0.923, 0.602], [0.916, 0.658], [0.9, 0.713], [0.879, 0.766], [0.852, 0.817], [0.807, 0.855], [0.757, 0.884], [0.708, 0.91], [0.654, 0.923], [0.601, 0.928], [0.549, 0.933], [0.498, 0.928], [0.45, 0.914], [0.405, 0.895], [0.363, 0.873], [0.317, 0.86], [0.265, 0.85], [0.214, 0.829], [0.168, 0.799], [0.124, 0.762], [0.097, 0.712], [0.084, 0.657], [0.077, 0.601], [0.076, 0.546], [0.077, 0.49], [0.09, 0.437], [0.11, 0.385], [0.134, 0.336], [0.17, 0.294], [0.214, 0.262], [0.265, 0.242], [0.317, 0.232], [0.363, 0.219], [0.405, 0.197], [0.45, 0.178], [0.498, 0.164], [0.548, 0.165], [0.598, 0.175], [0.652, 0.175], [0.708, 0.182], [0.757, 0.208], [0.799, 0.245], [0.834, 0.288], [0.869, 0.332], [0.897, 0.381], [0.909, 0.436], [0.919, 0.49]] },
  'island-lighthouse': { c: [0.498, 0.676], pts: [[0.917, 0.676], [0.922, 0.732], [0.907, 0.785], [0.875, 0.832], [0.839, 0.872], [0.792, 0.901], [0.739, 0.916], [0.688, 0.923], [0.645, 0.93], [0.607, 0.938], [0.57, 0.944], [0.534, 0.946], [0.498, 0.941], [0.464, 0.932], [0.431, 0.925], [0.397, 0.921], [0.361, 0.913], [0.329, 0.897], [0.297, 0.876], [0.259, 0.86], [0.213, 0.84], [0.169, 0.812], [0.128, 0.775], [0.101, 0.728], [0.095, 0.676], [0.101, 0.624], [0.128, 0.577], [0.169, 0.539], [0.213, 0.511], [0.259, 0.492], [0.297, 0.475], [0.329, 0.455], [0.361, 0.439], [0.397, 0.431], [0.431, 0.426], [0.464, 0.42], [0.498, 0.411], [0.534, 0.406], [0.57, 0.407], [0.607, 0.413], [0.645, 0.421], [0.688, 0.428], [0.739, 0.435], [0.792, 0.45], [0.839, 0.479], [0.867, 0.523], [0.885, 0.572], [0.905, 0.622]] },
  'island-market': { c: [0.498, 0.529], pts: [[0.92, 0.529], [0.923, 0.585], [0.925, 0.644], [0.913, 0.701], [0.888, 0.754], [0.85, 0.799], [0.802, 0.834], [0.748, 0.855], [0.693, 0.867], [0.646, 0.885], [0.599, 0.907], [0.55, 0.921], [0.498, 0.932], [0.446, 0.928], [0.397, 0.908], [0.349, 0.889], [0.298, 0.875], [0.248, 0.855], [0.208, 0.819], [0.171, 0.78], [0.127, 0.743], [0.092, 0.697], [0.082, 0.641], [0.082, 0.584], [0.081, 0.529], [0.084, 0.475], [0.087, 0.419], [0.099, 0.364], [0.13, 0.317], [0.171, 0.279], [0.208, 0.24], [0.248, 0.204], [0.298, 0.184], [0.349, 0.17], [0.397, 0.15], [0.446, 0.131], [0.498, 0.127], [0.55, 0.138], [0.599, 0.152], [0.646, 0.173], [0.693, 0.192], [0.748, 0.203], [0.802, 0.225], [0.846, 0.262], [0.876, 0.311], [0.897, 0.364], [0.912, 0.418], [0.918, 0.474]] },
  'island-observatory': { c: [0.498, 0.539], pts: [[0.923, 0.539], [0.923, 0.595], [0.922, 0.653], [0.908, 0.709], [0.874, 0.756], [0.831, 0.795], [0.79, 0.831], [0.746, 0.862], [0.694, 0.878], [0.644, 0.891], [0.598, 0.911], [0.549, 0.928], [0.498, 0.931], [0.448, 0.922], [0.399, 0.908], [0.352, 0.893], [0.304, 0.876], [0.262, 0.847], [0.225, 0.812], [0.181, 0.782], [0.146, 0.742], [0.123, 0.694], [0.096, 0.647], [0.078, 0.594], [0.073, 0.539], [0.078, 0.484], [0.096, 0.431], [0.123, 0.384], [0.146, 0.336], [0.181, 0.296], [0.225, 0.266], [0.262, 0.231], [0.304, 0.202], [0.352, 0.185], [0.399, 0.17], [0.448, 0.156], [0.498, 0.147], [0.549, 0.15], [0.598, 0.168], [0.642, 0.191], [0.689, 0.208], [0.743, 0.22], [0.788, 0.249], [0.826, 0.288], [0.865, 0.328], [0.896, 0.374], [0.913, 0.428], [0.919, 0.484]] },
  'island-orchard': { c: [0.498, 0.55], pts: [[0.922, 0.55], [0.915, 0.605], [0.915, 0.661], [0.92, 0.725], [0.89, 0.776], [0.831, 0.805], [0.776, 0.828], [0.733, 0.856], [0.687, 0.877], [0.637, 0.886], [0.589, 0.891], [0.544, 0.898], [0.498, 0.909], [0.45, 0.913], [0.403, 0.905], [0.356, 0.893], [0.31, 0.875], [0.266, 0.852], [0.218, 0.83], [0.17, 0.802], [0.132, 0.761], [0.104, 0.713], [0.086, 0.66], [0.081, 0.605], [0.08, 0.55], [0.104, 0.498], [0.138, 0.453], [0.149, 0.405], [0.162, 0.356], [0.196, 0.318], [0.235, 0.287], [0.276, 0.261], [0.318, 0.237], [0.359, 0.214], [0.403, 0.196], [0.45, 0.186], [0.498, 0.19], [0.544, 0.201], [0.589, 0.209], [0.637, 0.214], [0.687, 0.223], [0.728, 0.25], [0.759, 0.288], [0.795, 0.322], [0.836, 0.355], [0.875, 0.394], [0.896, 0.443], [0.911, 0.495]] },
  'island-rabbits': { c: [0.498, 0.55], pts: [[0.928, 0.55], [0.93, 0.607], [0.923, 0.664], [0.904, 0.718], [0.869, 0.764], [0.82, 0.797], [0.771, 0.822], [0.723, 0.843], [0.674, 0.854], [0.625, 0.857], [0.581, 0.86], [0.538, 0.857], [0.498, 0.848], [0.46, 0.839], [0.422, 0.832], [0.383, 0.828], [0.341, 0.821], [0.301, 0.807], [0.259, 0.789], [0.216, 0.766], [0.175, 0.736], [0.138, 0.699], [0.108, 0.654], [0.082, 0.605], [0.069, 0.55], [0.082, 0.495], [0.108, 0.445], [0.138, 0.401], [0.175, 0.363], [0.216, 0.334], [0.259, 0.311], [0.301, 0.293], [0.341, 0.279], [0.383, 0.272], [0.425, 0.277], [0.465, 0.295], [0.498, 0.316], [0.527, 0.33], [0.555, 0.338], [0.584, 0.343], [0.615, 0.348], [0.665, 0.332], [0.747, 0.301], [0.816, 0.306], [0.852, 0.345], [0.879, 0.392], [0.906, 0.441], [0.922, 0.494]] },
  'island-reeds': { c: [0.498, 0.507], pts: [[0.924, 0.507], [0.921, 0.563], [0.921, 0.62], [0.924, 0.683], [0.912, 0.746], [0.883, 0.803], [0.837, 0.846], [0.777, 0.871], [0.716, 0.884], [0.658, 0.894], [0.607, 0.912], [0.553, 0.926], [0.498, 0.928], [0.443, 0.922], [0.389, 0.913], [0.335, 0.9], [0.28, 0.884], [0.226, 0.862], [0.172, 0.833], [0.125, 0.793], [0.096, 0.739], [0.081, 0.679], [0.076, 0.62], [0.077, 0.562], [0.076, 0.507], [0.083, 0.452], [0.092, 0.398], [0.098, 0.341], [0.11, 0.283], [0.132, 0.226], [0.179, 0.187], [0.234, 0.162], [0.288, 0.142], [0.345, 0.138], [0.397, 0.129], [0.446, 0.109], [0.498, 0.111], [0.549, 0.12], [0.602, 0.119], [0.657, 0.122], [0.714, 0.133], [0.773, 0.148], [0.829, 0.176], [0.864, 0.226], [0.888, 0.282], [0.907, 0.338], [0.916, 0.395], [0.921, 0.451]] },
  'island-small-1': { c: [0.498, 0.717], pts: [[0.912, 0.717], [0.91, 0.771], [0.88, 0.819], [0.832, 0.855], [0.784, 0.882], [0.743, 0.905], [0.701, 0.92], [0.66, 0.928], [0.625, 0.936], [0.592, 0.944], [0.56, 0.949], [0.529, 0.95], [0.498, 0.948], [0.468, 0.946], [0.437, 0.944], [0.405, 0.942], [0.369, 0.941], [0.328, 0.938], [0.285, 0.93], [0.242, 0.913], [0.202, 0.888], [0.164, 0.855], [0.129, 0.816], [0.101, 0.769], [0.089, 0.717], [0.101, 0.664], [0.129, 0.618], [0.164, 0.578], [0.202, 0.546], [0.242, 0.52], [0.285, 0.504], [0.328, 0.495], [0.369, 0.493], [0.405, 0.491], [0.437, 0.49], [0.468, 0.488], [0.498, 0.485], [0.529, 0.484], [0.56, 0.484], [0.592, 0.489], [0.625, 0.498], [0.66, 0.506], [0.681, 0.534], [0.697, 0.564], [0.759, 0.566], [0.828, 0.58], [0.865, 0.618], [0.892, 0.665]] },
  'island-small-2': { c: [0.498, 0.494], pts: [[0.928, 0.494], [0.914, 0.549], [0.871, 0.594], [0.817, 0.626], [0.766, 0.649], [0.719, 0.664], [0.678, 0.674], [0.642, 0.681], [0.608, 0.684], [0.577, 0.684], [0.547, 0.679], [0.521, 0.672], [0.498, 0.673], [0.473, 0.681], [0.447, 0.686], [0.419, 0.685], [0.389, 0.683], [0.354, 0.682], [0.317, 0.675], [0.28, 0.662], [0.232, 0.648], [0.183, 0.625], [0.138, 0.591], [0.095, 0.547], [0.077, 0.494], [0.095, 0.441], [0.138, 0.398], [0.183, 0.364], [0.233, 0.341], [0.283, 0.329], [0.324, 0.32], [0.361, 0.315], [0.395, 0.316], [0.425, 0.318], [0.45, 0.313], [0.474, 0.311], [0.498, 0.315], [0.521, 0.319], [0.545, 0.319], [0.571, 0.318], [0.6, 0.318], [0.634, 0.317], [0.672, 0.32], [0.716, 0.327], [0.765, 0.34], [0.817, 0.362], [0.871, 0.394], [0.914, 0.439]] },
  'island-small-3': { c: [0.498, 0.721], pts: [[0.926, 0.721], [0.917, 0.776], [0.884, 0.824], [0.838, 0.862], [0.796, 0.893], [0.75, 0.914], [0.703, 0.926], [0.664, 0.936], [0.626, 0.943], [0.59, 0.944], [0.558, 0.946], [0.528, 0.947], [0.498, 0.947], [0.468, 0.949], [0.438, 0.947], [0.407, 0.941], [0.375, 0.934], [0.341, 0.925], [0.303, 0.916], [0.26, 0.904], [0.213, 0.885], [0.172, 0.856], [0.13, 0.819], [0.09, 0.774], [0.073, 0.721], [0.09, 0.667], [0.13, 0.622], [0.172, 0.586], [0.213, 0.556], [0.26, 0.538], [0.303, 0.526], [0.341, 0.516], [0.375, 0.508], [0.407, 0.5], [0.438, 0.495], [0.468, 0.493], [0.498, 0.494], [0.528, 0.494], [0.558, 0.496], [0.59, 0.498], [0.626, 0.499], [0.664, 0.505], [0.703, 0.515], [0.75, 0.527], [0.796, 0.549], [0.838, 0.58], [0.884, 0.617], [0.917, 0.666]] },
};

/** An island's coast: its painting's traced ground, placed and scaled on the lake. */
export function coast(d: { x: number; y: number; size: number; art: string }): Pt[] {
  const sh = ART_SHAPES[d.art];
  return sh.pts.map(([u, v]) => [d.x + (u - sh.c[0]) * d.size, d.y + (v - sh.c[1]) * d.size]);
}
/** Where an island's painting goes on the lake: its top-left corner and its size. */
export function artBox(d: { x: number; y: number; size: number; art: string }) {
  const sh = ART_SHAPES[d.art];
  return { x: d.x - sh.c[0] * d.size, y: d.y - sh.c[1] * d.size, s: d.size };
}

/** The coast's radius in a direction, read off the smoothed polygon by casting a ray from the middle. */
export function radiusAt(poly: Pt[], cx: number, cy: number, a: number) {
  const dx = Math.cos(a), dy = Math.sin(a); let best = 0;
  for (let i = 0; i < poly.length; i++) {
    const [ax, ay] = poly[i], [bx, by] = poly[(i + 1) % poly.length];
    const ex = bx - ax, ey = by - ay, den = dx * ey - dy * ex; if (Math.abs(den) < 1e-9) continue;
    const t = ((ax - cx) * ey - (ay - cy) * ex) / den, u = ((ax - cx) * dy - (ay - cy) * dx) / den;
    if (t > 0 && u >= 0 && u <= 1) best = Math.max(best, t);
  }
  return best;
}

/** How far out from the coast the jetty reaches: the boat ties up at its end. */
export const PIER = 58;

export const ISLANDS: Island[] = ISLAND_DEFS.map((d) => {
  const poly = coast(d), reach = Math.max(...poly.map(([x, y]) => Math.hypot(x - d.x, y - d.y)));
  let dock: Island['dock'] = null, pier: Pt | null = null;
  if (d.dockA !== null) {
    const r = radiusAt(poly, d.x, d.y, d.dockA);
    pier = [d.x + Math.cos(d.dockA) * (r - 6), d.y + Math.sin(d.dockA) * (r - 6)];
    dock = { x: d.x + Math.cos(d.dockA) * (r + PIER), y: d.y + Math.sin(d.dockA) * (r + PIER), a: d.dockA };
  }
  return { ...d, poly, reach, dock, pier };
});
export const ISLAND: Record<IslandId, Island> = Object.fromEntries(ISLANDS.map((i) => [i.id, i])) as Record<IslandId, Island>;
export const VILLAGES = ISLANDS.filter((i) => i.dock !== null).map((i) => i.id);

export function insidePoly(poly: Pt[], x: number, y: number) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** The nearest point on a polygon's outline. */
export function nearestOnPoly(poly: Pt[], x: number, y: number): { x: number; y: number; d: number } {
  let bx = 0, by = 0, bd = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const [ax, ay] = poly[i], [cx, cy] = poly[(i + 1) % poly.length];
    const ex = cx - ax, ey = cy - ay, l2 = ex * ex + ey * ey;
    const t = l2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * ex + (y - ay) * ey) / l2)) : 0;
    const px = ax + ex * t, py = ay + ey * t, d = (px - x) * (px - x) + (py - y) * (py - y);
    if (d < bd) { bd = d; bx = px; by = py; }
  }
  return { x: bx, y: by, d: Math.sqrt(bd) };
}

/** The lake's edge wanders in and out a little, so the far shore looks like a shore and not a box. */
export const shoreIn = (t: number, side: number) => SHORE + 26 * Math.sin(t * 0.0037 + side * 1.9) + 14 * Math.sin(t * 0.0113 + side * 4.1);
/** How far a point is inside the lake's edge (negative on land), and which way is back into the lake. */
export function edgeDist(x: number, y: number): { d: number; nx: number; ny: number } {
  const l = x - shoreIn(y, 0), r = LAKE_W - shoreIn(y, 1) - x, t = y - shoreIn(x, 2), b = LAKE_H - shoreIn(x, 3) - y;
  const d = Math.min(l, r, t, b);
  return d === l ? { d, nx: 1, ny: 0 } : d === r ? { d, nx: -1, ny: 0 } : d === t ? { d, nx: 0, ny: 1 } : { d, nx: 0, ny: -1 };
}

/**
 * How far a point is from anything solid (coasts, rocks, shoals, the lake's edge), negative inside. Used by the
 * pathfinding in the bot and the tests, and by the scene's shallows; the rules use the same shapes.
 */
export function clearance(x: number, y: number) {
  let d = edgeDist(x, y).d;
  for (const r of ROCKS) d = Math.min(d, Math.hypot(x - r.x, y - r.y) - r.r);
  for (const isl of ISLANDS) {
    const far = Math.hypot(x - isl.x, y - isl.y) - isl.reach; if (far > d) continue;
    const n = nearestOnPoly(isl.poly, x, y); d = Math.min(d, insidePoly(isl.poly, x, y) ? -n.d : n.d);
  }
  return d;
}

/** Whether a point is inside a reed bed. */
export function inReeds(x: number, y: number) {
  for (const r of REEDS) {
    const dx = x - r.x, dy = y - r.y, c = Math.cos(-r.rot), s = Math.sin(-r.rot), u = dx * c - dy * s, v = dx * s + dy * c;
    if ((u * u) / (r.rx * r.rx) + (v * v) / (r.ry * r.ry) <= 1) return true;
  }
  return false;
}

/** The current's push at a point, in lake units a tick: along the nearest stretch of stream, fading to its edges. */
export function currentAt(x: number, y: number): Pt {
  let vx = 0, vy = 0;
  for (const c of CURRENTS) {
    let best = Infinity, dx = 0, dy = 0, along = 0;
    for (let i = 0; i < c.pts.length - 1; i++) {
      const [ax, ay] = c.pts[i], [bx, by] = c.pts[i + 1], ex = bx - ax, ey = by - ay, l2 = ex * ex + ey * ey;
      const t = Math.max(0, Math.min(1, ((x - ax) * ex + (y - ay) * ey) / l2)), px = ax + ex * t, py = ay + ey * t, d = Math.hypot(x - px, y - py);
      if (d < best) { best = d; const l = Math.sqrt(l2); dx = ex / l; dy = ey / l; along = (i + t) / (c.pts.length - 1); }
    }
    if (best >= c.w) continue;
    // full strength in the middle, easing to nothing at the edge, and easing in and out at the stream's two ends
    const across = 1 - (best / c.w) ** 2, ends = Math.min(1, along * 8, (1 - along) * 8), k = c.speed * across * Math.max(0, ends);
    vx += dx * k; vy += dy * k;
  }
  return [vx, vy];
}

/** A fog bank's middle at a tick: they wander slowly in small loops. */
export function fogAt(i: number, tick: number): Fog {
  const f = FOGS[i], t = tick / 30;
  return { x: f.x + Math.sin(t * 0.021 + i * 1.7) * 70, y: f.y + Math.cos(t * 0.017 + i * 2.3) * 45, r: f.r * (1 + Math.sin(t * 0.031 + i) * 0.06) };
}
/** How deep in fog a point is: 0 in clear air, 1 in the thick of it. */
export function fogDepth(x: number, y: number, tick: number) {
  let k = 0;
  for (let i = 0; i < FOGS.length; i++) { const f = fogAt(i, tick), d = Math.hypot(x - f.x, y - f.y) / f.r; if (d < 1) k = Math.max(k, Math.min(1, (1 - d) * 2.2)); }
  return k;
}
