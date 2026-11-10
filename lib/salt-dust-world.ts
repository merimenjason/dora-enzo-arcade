// Salt & Dust: the world. The two walkable places (the well town of Tunupa Well and Coipa Yard), who stands where, the
// conversations with their skill checks, the journey across the salt flat, and the numbers the rules use. The rules
// that run all this are in lib/salt-dust-game.ts; this file is data plus the small functions each choice runs.
import type { SaltGame } from './salt-dust-game.js';

// ─── the view ───
/** the canvas, in its own pixels; the page scales it to fit */
export const VIEW_W = 1536, VIEW_H = 864;
/** an isometric tile on screen: twice as wide as tall */
export const TW = 96, TH = 48;

// ─── the party ───
export type HeroId = 'dora' | 'enzo';
export type Skill = 'scout' | 'speech' | 'barter' | 'repair';
export const SKILLS: Skill[] = ['scout', 'speech', 'barter', 'repair'];
export const SKILL_NAME: Record<Skill, string> = { scout: 'Scout', speech: 'Speech', barter: 'Barter', repair: 'Repair' };
export interface HeroDef { name: string; hp: number; ap: number; skills: Record<Skill, number>; blurb: string }
export const HEROES: Record<HeroId, HeroDef> = {
  dora: { name: 'Dora', hp: 14, ap: 7, skills: { scout: 6, speech: 3, barter: 3, repair: 2 }, blurb: 'The scout. A sling for range, sharp eyes for tracks.' },
  enzo: { name: 'Enzo', hp: 16, ap: 6, skills: { scout: 3, speech: 5, barter: 5, repair: 7 }, blurb: 'The water-finder. A walking pole up close, and he can mend.' },
};
export const WATER_MAX = 10, START_WATER = 6, START_SILVER = 4;

// ─── places ───
export type Place = 'town' | 'yard';
export interface MapDef {
  id: Place; name: string;
  /** grid size in tiles, and where tile (0, 0)'s top corner sits on the canvas */
  w: number; h: number; ox: number; oy: number;
  /** one string per row (y), one character per tile (x): '.' open ground, '#' blocked, 'f' open ground inside the battle area */
  rows: string[];
  dora: [number, number]; enzo: [number, number];
}
export const MAPS: Record<Place, MapDef> = {
  town: {
    id: 'town', name: 'Tunupa Well', w: 24, h: 24, ox: 768, oy: -192,
    rows: [
      '########################',
      '########################',
      '########################',
      '########################',
      '######.......###########',
      '#####.........##########',
      '####...........#########',
      '###.......##....########',
      '####.....####...########',
      '#####....#####...#######',
      '######...######...######',
      '######...#####....######',
      '######....####.....#####',
      '######.............#####',
      '######.............#####',
      '######.............#####',
      '######.............#####',
      '#######............#####',
      '######.............#####',
      '######..............####',
      '########.............###',
      '#############.........##',
      '###############......###',
      '#################...####',
    ],
    dora: [18, 19], enzo: [18, 20],
  },
  yard: {
    id: 'yard', name: 'Coipa Yard', w: 24, h: 24, ox: 768, oy: -192,
    rows: [
      '########.###############',
      '#######.################',
      '######.#################',
      '#####...#########..#####',
      '####.....#######....####',
      '###.......###........###',
      '###........#..........##',
      '####...................#',
      '#####....ffffffffff.....',
      '#####....ffffffffff.....',
      '#####....ffffffffff.....',
      '#####....ffffffffff.....',
      '#####....ffffffffff.....',
      '#####....ffffffffff.....',
      '#####....ffffffffff.....',
      '#####....ffffffffff.....',
      '#####....ffffffffff.....',
      '######...ffffffffff.....',
      '#####...................',
      '#####...................',
      '#####..................#',
      '######....##..........##',
      '#######..####........###',
      '##############......####',
    ],
    dora: [10, 18], enzo: [11, 19],
  },
};

// ─── who stands where ───
export type SpriteId = 'dora' | 'enzo' | 'warden' | 'parina' | 'wayra' | 'fox' | 'llama';
export type PortraitId = 'dora' | 'enzo' | 'captain' | 'parina' | 'tika' | 'wayra' | 'runnerA' | 'runnerB' | 'chaska' | 'none';
export const PORTRAIT_INDEX: Record<Exclude<PortraitId, 'none'>, number> = { dora: 0, enzo: 1, captain: 2, parina: 3, tika: 4, wayra: 5, runnerA: 6, runnerB: 7, chaska: 5 };
/** the pack llamas in the town's plaza: each paces between two tiles (both kept clear of walkers) */
export const LLAMAS: [number, number][][] = [[[8, 18], [8, 19]]];
/** which frames of each strip are which action */
export const FRAMES: Record<SpriteId, Record<string, number[]>> = {
  dora: { idle: [0, 1], walk: [2, 3, 4, 5], attack: [6, 7, 8], hit: [9, 10], down: [11], talk: [12, 13], backIdle: [14], backWalk: [15, 16, 17], drink: [18, 19, 20], cheer: [21, 22, 23] },
  enzo: { idle: [0, 1], walk: [2, 3, 4, 5], attack: [6, 7, 8], hit: [9, 10], down: [11], talk: [12, 13], backIdle: [14], backWalk: [15, 16, 17], crank: [18, 19], triumph: [20], mend: [21, 22, 23], drink: [24, 25, 26], cheer: [27, 28, 29] },
  fox: { idle: [0, 1], walk: [2, 3, 4, 5], attack: [6, 7, 8], hit: [9, 10], down: [11], talk: [12, 13], backIdle: [14], backWalk: [14, 15, 16], wave: [17] },
  warden: { idle: [0, 1], talk: [2, 3], salute: [4, 5] },
  parina: { idle: [0, 1], talk: [2, 3], pour: [4, 5] },
  wayra: { idle: [0, 1], talk: [2, 3], point: [4, 5] },
  llama: { idle: [0], graze: [1], walk: [2, 3, 4, 5] },
};
export interface Npc {
  id: string; place: Place; name: string; sprite: SpriteId; portrait: PortraitId;
  x: number; y: number;
  /** which way the painting faces: true turns it to face down-left */
  flip?: boolean;
  /** the conversation that opens when the party walks up to them; null means they don't talk */
  talk: string | null;
  /** shown only while this holds */
  here?: (g: SaltGame) => unknown;
}
export const NPCS: Npc[] = [
  { id: 'captain', place: 'town', name: 'Warden Captain', sprite: 'warden', portrait: 'captain', x: 9, y: 12, talk: 'captain.hello' },
  { id: 'warden', place: 'town', name: 'Well Warden', sprite: 'warden', portrait: 'captain', x: 14, y: 7, flip: true, talk: 'warden.hello' },
  { id: 'parina', place: 'town', name: 'Parina', sprite: 'parina', portrait: 'parina', x: 16, y: 10, flip: true, talk: 'parina.hello' },
  { id: 'wayra', place: 'town', name: 'Grandmother Wayra', sprite: 'wayra', portrait: 'wayra', x: 7, y: 12, talk: 'wayra.hello' },
  { id: 'tika', place: 'yard', name: 'Tika', sprite: 'fox', portrait: 'tika', x: 13, y: 9, flip: true, talk: 'tika.hello', here: (g) => !g.f.runnersGone },
  { id: 'runnerA', place: 'yard', name: 'Dust Runner', sprite: 'fox', portrait: 'runnerA', x: 15, y: 10, flip: true, talk: 'tika.hello', here: (g) => !g.f.runnersGone },
  { id: 'runnerB', place: 'yard', name: 'Dust Runner', sprite: 'fox', portrait: 'runnerB', x: 11, y: 9, flip: true, talk: 'tika.hello', here: (g) => !g.f.runnersGone },
];
/** places to click that aren't anyone: the road out of town, the old pump in the yard */
export interface Spot { id: string; place: Place; name: string; x: number; y: number; talk: string; /** stand here to use it */ at: [number, number] }
export const SPOTS: Spot[] = [
  { id: 'road', place: 'town', name: 'The road onto the salt', x: 19, y: 22, at: [19, 22], talk: 'town.leave' },
  { id: 'pump', place: 'yard', name: 'The old iron pump', x: 9, y: 2, at: [10, 6], talk: 'yard.pump' },
];

// ─── conversations ───
export interface Check { skill: Skill; n: number; /** situational bonuses: [amount, why] */ bonus?: (g: SaltGame) => [number, string][] }
export interface Opt {
  text: string | ((g: SaltGame) => string);
  check?: Check;
  /** hidden unless this holds */
  show?: (g: SaltGame) => unknown;
  /** greyed out, with this reason, when it returns a string */
  block?: (g: SaltGame) => string | null;
  /** what happens; returns the next node, or null to end the conversation */
  run: (g: SaltGame, pass: boolean) => string | null;
}
export interface TalkNode { who: PortraitId; name: string; text: string | ((g: SaltGame) => string); opts: Opt[]; art?: string }
const end = () => null;
const water = (g: SaltGame) => `${g.water} / ${WATER_MAX}`;

export const TALK: Record<string, TalkNode> = {
  // Grandmother Wayra, by the wind pump: the errand, the Runners' tracks, a tip for the market
  'wayra.hello': {
    who: 'wayra', name: 'Grandmother Wayra',
    text: (g) => g.f.quest ? 'Back again, little ones? Ask what you like. The well will not wait for ever.' : 'Dora, Enzo. Tunupa’s well drops a hand’s width every week, and the Wardens tax what is left. Your gauge has been humming, Enzo. Where does it point?',
    opts: [
      { text: 'Across the flat, to Coipa Yard. The old salt-train yard.', show: (g) => !g.f.quest, run: (g) => { g.f.quest = true; return 'wayra.yard'; } },
      { text: '[Scout 5] Which way do the Dust Runners ride these days?', check: { skill: 'scout', n: 5 }, show: (g) => g.f.quest && !g.f.tracks && !g.f.tracksTried, run: (g, pass) => { g.f.tracksTried = true; if (pass) g.f.tracks = true; return pass ? 'wayra.tracks' : 'wayra.notracks'; } },
      { text: 'Anything we should know before we haggle in town?', show: (g) => !g.f.pumpTip, run: (g) => { g.f.pumpTip = true; return 'wayra.tip'; } },
      { text: 'Could we rest by your fire a while?', show: (g) => g.hurt(), run: (g) => { g.healAll(); return 'wayra.rest'; } },
      { text: 'We’ll be on our way.', run: end },
    ],
  },
  'wayra.yard': {
    who: 'wayra', name: 'Grandmother Wayra',
    text: 'Coipa. Tika’s Dust Runners camp there now, by the old iron pump. Carry water: the flat drinks it from you. There are two ways across. Straight over the flat is quick and hot. Along the cactus islands is longer, but there is shade.',
    opts: [{ text: 'We’ll find that spring, Grandmother.', run: () => 'wayra.hello' }],
  },
  'wayra.tracks': {
    who: 'wayra', name: 'Grandmother Wayra',
    text: 'Sharp eyes, Dora. They ride the straight way, past the red lagoon, and they doze through the noon heat. Come at them quietly and you will have the first move.',
    opts: [{ text: 'Thank you.', run: () => 'wayra.hello' }],
  },
  'wayra.notracks': {
    who: 'wayra', name: 'Grandmother Wayra', text: 'Hm. The wind has swept the tracks today. Keep your eyes open out there.',
    opts: [{ text: 'We will.', run: () => 'wayra.hello' }],
  },
  'wayra.tip': {
    who: 'wayra', name: 'Grandmother Wayra',
    text: 'Parina’s pump has squeaked for a month, and she is too proud to say so. A merchant with a broken pump bargains softer than she lets on.',
    opts: [{ text: 'We’ll remember that.', run: () => 'wayra.hello' }],
  },
  'wayra.rest': {
    who: 'wayra', name: 'Grandmother Wayra', text: 'Sit, sit. Quinoa and warm stones. There, you look less like dried leaves.',
    opts: [{ text: 'Thank you, Grandmother.', run: () => 'wayra.hello' }],
  },

  // the Warden Captain at the well: the tax, a cracked pulley, a promise
  'captain.hello': {
    who: 'captain', name: 'Warden Captain',
    text: (g) => g.f.wardenFill ? 'The Wardens keep their word, and so will you. Go well.' : 'Halt at the well. Tunupa water is taxed: two silver a fill, by order of the Wardens.',
    opts: [
      { text: 'Here’s two silver. Fill us up. (+4 water)', show: (g) => !g.f.wardenFill, block: (g) => g.silver < 2 ? 'You have only ' + g.silver + ' silver.' : g.water >= WATER_MAX ? 'Your canteen is full.' : null,
        run: (g) => { g.silver -= 2; g.addWater(4); return 'captain.paid'; } },
      { text: '[Repair 6] Your pulley is cracked. We’ll fix it for a fill.', check: { skill: 'repair', n: 6 }, show: (g) => !g.f.pulley,
        run: (g, pass) => { if (!pass) return 'captain.nofix'; g.f.pulley = true; g.f.wardenFill = true; g.addWater(4); return 'captain.fixed'; } },
      { text: '[Speech 6] We’re after a new spring at Coipa Yard. If we find it, the Wardens share it.', check: { skill: 'speech', n: 6, bonus: (g) => g.f.quest ? [[1, 'Wayra’s errand']] : [] },
        show: (g) => !g.f.wardens && !g.f.shareTried,
        run: (g, pass) => { g.f.shareTried = true; if (!pass) return 'captain.noshare'; g.f.wardens = true; g.addWater(2); return 'captain.share'; } },
      { text: 'Another time.', run: end },
    ],
  },
  'captain.paid': { who: 'captain', name: 'Warden Captain', text: (g) => `Two silver, counted. Fill your canteen. (Water ${water(g)})`, opts: [{ text: 'Thank you.', run: (g) => { g.f.wardenFill = true; return null; } }] },
  'captain.fixed': {
    who: 'captain', name: 'Warden Captain',
    text: (g) => `Enzo works the cracked pulley free and binds it with copper wire. The Captain tests it twice, then nods. “A fair trade. Fill up.” (Water ${water(g)})`,
    opts: [{ text: 'Glad to help.', run: () => 'captain.hello' }],
  },
  'captain.nofix': { who: 'captain', name: 'Warden Captain', text: 'Leave the pulley to the Wardens.', opts: [{ text: 'All right.', run: () => 'captain.hello' }] },
  'captain.share': {
    who: 'captain', name: 'Warden Captain',
    text: (g) => `Grandmother Wayra sent you? Then you have my word, and the Wardens’. Take two cups for the road, and tell Tika’s Runners we will share, if there is a spring to share. (Water ${water(g)})`,
    opts: [{ text: 'We’ll tell her.', run: () => 'captain.hello' }],
  },
  'captain.noshare': { who: 'captain', name: 'Warden Captain', text: 'Promises are cheap at a dry well, strangers. Come back with water, not words.', opts: [{ text: 'Fair enough.', run: () => 'captain.hello' }] },
  'warden.hello': {
    who: 'captain', name: 'Well Warden', text: 'Talk to the Captain about water. I only guard it.',
    opts: [{ text: 'Sorry to bother you.', run: end }],
  },

  // Parina of the Brine Guild: water by the cup
  'parina.hello': {
    who: 'parina', name: 'Parina of the Brine Guild',
    text: (g) => g.f.guild ? 'Friend of the Guild! My pump sings again. Three cups a silver, for you.' : 'Water is three cups a silver. For strangers, four.',
    opts: [
      { text: 'We will take two cups. (3 silver, +2 water)', show: (g) => !g.f.guild, block: (g) => g.silver < 3 ? 'You have only ' + g.silver + ' silver.' : g.water >= WATER_MAX ? 'Your canteen is full.' : null,
        run: (g) => { g.silver -= 3; g.addWater(2); return 'parina.sold'; } },
      { text: 'Three cups, please. (1 silver, +3 water)', show: (g) => g.f.guild, block: (g) => g.silver < 1 ? 'You have no silver.' : g.water >= WATER_MAX ? 'Your canteen is full.' : null,
        run: (g) => { g.silver -= 1; g.addWater(3); return 'parina.sold'; } },
      { text: '[Barter 6] Three, and we mend your pump.', check: { skill: 'barter', n: 6, bonus: (g) => g.f.pumpTip ? [[1, 'Wayra’s tip']] : [] }, show: (g) => !g.f.guild && !g.f.barterTried,
        run: (g, pass) => { g.f.barterTried = true; if (!pass) return 'parina.sniff'; g.f.guild = true; g.addWater(3); return 'parina.mended'; } },
      { text: 'We will return when the price falls.', run: end },
    ],
  },
  'parina.sold': { who: 'parina', name: 'Parina of the Brine Guild', text: (g) => `She pours, not one drop over. “Pleasure.” (Water ${water(g)})`, opts: [{ text: 'Thank you.', run: () => 'parina.hello' }] },
  'parina.mended': {
    who: 'parina', name: 'Parina of the Brine Guild',
    text: (g) => `Enzo has the pump’s leather washer out, trimmed and back in before she can argue. It stops squeaking. Parina pours three cups and presses a little Guild seal of blue glass into Dora’s paw. “Show that where water is traded. The Guild remembers its friends.” (Water ${water(g)})`,
    opts: [{ text: 'A pleasure doing business.', run: () => 'parina.hello' }],
  },
  'parina.sniff': {
    who: 'parina', name: 'Parina of the Brine Guild',
    text: 'She sniffs. “My pump is perfectly well, thank you. The price is the price.”',
    opts: [{ text: 'Of course.', run: () => 'parina.hello' }],
  },

  // the road out
  'town.leave': {
    who: 'none', name: 'The road onto the salt',
    text: (g) => g.f.quest ? `The road runs out of Tunupa onto the white salt flat. Coipa Yard is a long walk away, and the flat drinks water. Water ${water(g)}.` : 'The road runs out onto the white salt flat. But where to? Enzo’s gauge hums, and Grandmother Wayra by the wind pump will know what it means.',
    opts: [
      { text: 'Set out for Coipa Yard.', show: (g) => g.f.quest, run: (g) => { g.startTravel(); return null; } },
      { text: 'Not yet.', run: end },
    ],
  },

  // Tika and the Dust Runners at the old pump
  'tika.hello': {
    who: 'tika', name: 'Tika of the Dust Runners',
    text: (g) => g.f.peace ? 'Go on, then. Show us this water of yours.' : (g.f.seen ? 'So the chinchillas made it. I watched you cross by the lagoon. ' : '') + 'Turn your paws around. This yard and its pump are Runner ground. The pump’s been dry since the rains left, but it’s ours.',
    opts: [
      { text: '[Speech 6] The pump is dry for you too. Let Enzo find the water, and we all share it.', check: { skill: 'speech', n: 6, bonus: (g) => g.f.wardens ? [[1, 'the Wardens’ word']] : [] },
        show: (g) => !g.f.peace && !g.f.speechTried, run: (g, pass) => { g.f.speechTried = true; if (!pass) return 'tika.wind'; g.makePeace('share'); return 'tika.share'; } },
      { text: '[Scout 6] Your mast is cracked through. Chase us and you’ll be walking home.', check: { skill: 'scout', n: 6 },
        show: (g) => !g.f.peace && !!g.f.caravanTip && !g.f.mastTried, run: (g, pass) => { g.f.mastTried = true; if (!pass) return 'tika.wind'; g.makePeace('mast'); return 'tika.mast'; } },
      { text: 'The Brine Guild vouches for us. (Show the blue glass seal.)', show: (g) => !g.f.peace && !!g.f.guild, run: (g) => { g.makePeace('guild'); return 'tika.guild'; } },
      { text: (g) => `Take ${g.toll()} water as a toll, and let us look at the pump.`, show: (g) => !g.f.peace, block: (g) => g.water < g.toll() ? `You have only ${g.water} water.` : null,
        run: (g) => { g.water -= g.toll(); g.makePeace('toll'); return 'tika.toll'; } },
      { text: 'Then we’ll settle it the hard way.', show: (g) => !g.f.peace, run: (g) => { g.startCombat(); return null; } },
      { text: 'Back in a moment.', run: end },
    ],
  },
  'tika.wind': {
    who: 'tika', name: 'Tika of the Dust Runners', text: (g) => `Tika laughs. “Words are wind, and wind is all we have out here.” Her price just went up to ${g.toll()} water.`,
    opts: [{ text: 'Hm.', run: () => 'tika.hello' }],
  },
  'tika.share': {
    who: 'tika', name: 'Tika of the Dust Runners',
    text: 'She looks at the Captain’s copper token a long time. “Share. With Wardens.” Then she grins. “All right, water-finder. Find it, and Runners drink beside Wardens. Go on.”',
    opts: [{ text: 'Enzo, the gauge.', run: end }],
  },
  'tika.mast': {
    who: 'tika', name: 'Tika of the Dust Runners',
    text: 'Her ears go flat. She glances at the sail-cart’s mast, and the long crack in it. “Who told you that? …Fine. Look at your pump. We were leaving anyway.”',
    opts: [{ text: 'Safe travels.', run: end }],
  },
  'tika.guild': {
    who: 'tika', name: 'Tika of the Dust Runners',
    text: 'The blue glass catches the sun. Tika steps back. “The Guild buys our salt. I’m not crossing the Guild over a dry pump. Go on.”',
    opts: [{ text: 'Thank you.', run: end }],
  },
  'tika.toll': {
    who: 'tika', name: 'Tika of the Dust Runners', text: (g) => `She drinks from your canteen, and passes it round her Runners. “A fair toll. The pump is yours to stare at.” (Water ${water(g)})`,
    opts: [{ text: 'Enjoy it.', run: end }],
  },
  'tika.beaten': {
    who: 'tika', name: 'Tika of the Dust Runners', text: 'Tika sits in the salt, ears down, and waves a paw. “Enough! Have your dry pump. We’ll be watching.” The Runners pull back to their sail-cart.',
    opts: [{ text: 'No one has to get hurt out here.', run: end }],
  },
  'tika.won': {
    who: 'tika', name: 'Tika of the Dust Runners',
    text: (g) => `You come round at the edge of the yard. Tika stands over you with your canteen. “Half for us, half for you. Go home, chinchillas.” (Water ${water(g)}) You can talk to her again, or try once more.`,
    opts: [{ text: 'We’re not going home.', run: end }],
  },

  // the pump at Coipa Yard
  'yard.pump': {
    who: 'enzo', name: 'Enzo',
    text: (g) => g.f.peace ? 'The gauge is humming like a kettle. It’s right here, Dora, under the old pump.' : 'The gauge is humming like a kettle. But Tika’s Runners are watching every step we take near their pump.',
    opts: [
      { text: 'Crank the divining gauge.', show: (g) => !!g.f.peace, run: (g) => { g.findSpring(); return null; } },
      { text: 'Not yet.', run: end },
    ],
  },
};

// ─── the journey ───
export type NodeId = 'tunupa' | 'lagoon' | 'isle1' | 'isle2' | 'coipa';
/** where each stop sits on the painted map, as fractions of the canvas */
export const MAP_NODES: Record<NodeId, { name: string; x: number; y: number }> = {
  tunupa: { name: 'Tunupa Well', x: 0.21, y: 0.6 },
  lagoon: { name: 'The Red Lagoon', x: 0.5, y: 0.38 },
  isle1: { name: 'First cactus island', x: 0.52, y: 0.8 },
  isle2: { name: 'Far cactus island', x: 0.74, y: 0.7 },
  coipa: { name: 'Coipa Yard', x: 0.8, y: 0.26 },
};
export interface Leg { to: NodeId; water: number; label: string }
/** the ways on from each stop */
export const LEGS: Record<NodeId, Leg[]> = {
  tunupa: [
    { to: 'lagoon', water: 2, label: 'Straight across the flat: 2 stages, 2 water each, quick and hot' },
    { to: 'isle1', water: 1, label: 'Along the cactus islands: 3 stages, 1 water each, with shade' },
  ],
  lagoon: [{ to: 'coipa', water: 2, label: 'Press on to Coipa Yard (2 water)' }],
  isle1: [{ to: 'isle2', water: 1, label: 'On to the far island (1 water)' }],
  isle2: [{ to: 'coipa', water: 1, label: 'On to Coipa Yard (1 water)' }],
  coipa: [],
};
/** a stop's event: a painting, a scene and choices (run once, on the first arrival) */
export const EVENTS: Partial<Record<NodeId, string>> = { lagoon: 'ev.runners', isle1: 'ev.cistern', isle2: 'ev.caravan' };
Object.assign(TALK, {
  'ev.runners': {
    who: 'none', name: 'The Red Lagoon', art: 'ev-runners',
    text: 'Sail-carts! Three Dust Runner carts race along the far shore of the red lagoon, throwing up plumes of salt. They will pass close.',
    opts: [
      { text: '[Scout 6] Lie flat in the salt crust until they pass.', check: { skill: 'scout', n: 6 }, run: (g, pass) => { if (pass) g.f.unseen = true; else g.f.seen = true; return pass ? 'ev.runners.hid' : 'ev.runners.seen'; } },
      { text: 'Keep walking and hope they don’t care.', run: (g) => { g.f.seen = true; return 'ev.runners.seen'; } },
    ],
  },
  'ev.runners.hid': { who: 'dora', name: 'Dora', art: 'ev-runners', text: 'Dora pulls Enzo down flat. The carts hiss past, close enough to count the patches on the sails, and never look round. “They’re heading for Coipa. And they think they’re alone.”', opts: [{ text: 'Go on.', run: end }] },
  'ev.runners.seen': { who: 'none', name: 'The Red Lagoon', art: 'ev-runners', text: 'A fox on the lead cart turns her head and watches you all the way past. The Runners will know you are coming.', opts: [{ text: 'Go on.', run: end }] },
  'ev.cistern': {
    who: 'none', name: 'A cactus island', art: 'ev-islands',
    text: 'A rocky island rises out of the salt, crowded with cacti. Under the overhang there is shade, and an old stone cistern, its pipe silted up. A little water glints at the bottom.',
    opts: [
      { text: '[Repair 5] Clear the silted pipe and fill up. (+4 water)', check: { skill: 'repair', n: 5 }, run: (g, pass) => { if (pass) g.addWater(4); else { g.addWater(1); g.healAll(); } return pass ? 'ev.cistern.fixed' : 'ev.cistern.rest'; } },
      { text: 'Rest in the shade and scoop what you can. (+1 water, heal)', run: (g) => { g.addWater(1); g.healAll(); return 'ev.cistern.rest'; } },
    ],
  },
  'ev.cistern.fixed': { who: 'enzo', name: 'Enzo', art: 'ev-islands', text: (g) => `Enzo works a copper rod down the pipe until the silt gives way with a gulp, and clear water runs. (Water ${water(g)})`, opts: [{ text: 'Go on.', run: end }] },
  'ev.cistern.rest': { who: 'none', name: 'A cactus island', art: 'ev-islands', text: (g) => `You sit out the worst of the heat in the shade and scrape a cup from the cistern. (Water ${water(g)})`, opts: [{ text: 'Go on.', run: end }] },
  'ev.caravan': {
    who: 'chaska', name: 'Ch’aska the herder', art: 'ev-caravan',
    text: 'A little caravan has stopped dead: a cart with a cracked wheel and three tired llamas lying in the heat. An old herder waves you over. “Two cups, travellers? Just to get them on their feet.”',
    opts: [
      { text: 'Give her two water.', block: (g) => g.water < 2 ? 'You have only ' + g.water + ' water.' : null, run: (g) => { g.water -= 2; g.silver += 1; g.f.caravanTip = true; return 'ev.caravan.gave'; } },
      { text: '[Repair 6] We’ll mend your wheel instead.', check: { skill: 'repair', n: 6 }, run: (g, pass) => { if (!pass) return 'ev.caravan.left'; g.silver += 2; g.f.caravanTip = true; return 'ev.caravan.mended'; } },
      { text: 'We can’t spare any. Good luck.', run: () => 'ev.caravan.left' },
    ],
  },
  'ev.caravan.gave': { who: 'chaska', name: 'Ch’aska the herder', art: 'ev-caravan', text: (g) => `The llamas drink and clamber up. Ch’aska presses a silver on you. “A tip for your trouble: Tika’s sail-cart has a mast cracked through. She can’t risk a chase.” (Water ${water(g)})`, opts: [{ text: 'Thank you.', run: end }] },
  'ev.caravan.mended': { who: 'chaska', name: 'Ch’aska the herder', art: 'ev-caravan', text: 'Enzo splints the wheel with his walking pole’s spare ferrule and a strap. Ch’aska pays two silver, and a secret: “Tika’s sail-cart has a mast cracked through. She can’t risk a chase.”', opts: [{ text: 'Good to know.', run: end }] },
  'ev.caravan.left': { who: 'chaska', name: 'Ch’aska the herder', art: 'ev-caravan', text: 'She nods slowly, and goes back to fanning her llamas.', opts: [{ text: 'Go on.', run: end }] },
} as Record<string, TalkNode>);

// ─── the fight ───
export interface FoeDef { id: string; name: string; hp: number; ap: number; portrait: PortraitId; leader?: boolean }
export const FOES: FoeDef[] = [
  { id: 'tika', name: 'Tika', hp: 12, ap: 6, portrait: 'tika', leader: true },
  { id: 'runnerA', name: 'Runner', hp: 10, ap: 6, portrait: 'runnerA' },
  { id: 'runnerB', name: 'Runner', hp: 10, ap: 6, portrait: 'runnerB' },
];
/** where everyone stands when the fight starts (yard tiles); the quiet approach puts the heroes closer */
export const FIGHT_START = {
  dora: [11, 16] as [number, number], enzo: [12, 16] as [number, number],
  doraQuiet: [12, 13] as [number, number], enzoQuiet: [13, 14] as [number, number],
  tika: [13, 9] as [number, number], runnerA: [15, 10] as [number, number], runnerB: [11, 9] as [number, number],
};
/** action costs and numbers */
export const RULES = {
  move: 1, slingAp: 3, poleAp: 3, mendAp: 3, drinkAp: 2, spearAp: 3,
  slingRange: 6, slingBase: 85, slingFall: 5, slingMin: 40,
  poleHit: 85, spearHit: 70, spearHitHelp: 60,
  slingDmg: [3, 4] as [number, number], poleDmg: [4, 5] as [number, number], spearDmg: [3, 4] as [number, number],
  mendHeal: 5, mendUses: 2, drinkHeal: 3,
  /** a Runner this hurt stops attacking and backs off */
  fleeAt: 2,
};
