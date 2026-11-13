// Highburrow: the scenario data for "The First Valley". No DOM, no logic beyond small lookups.
// The map is pointy-topped hexes in "odd-r" offset rows: odd rows sit half a hex to the right.

export type Good = 'quinoa' | 'potatoes' | 'wool' | 'salt' | 'stone' | 'silver' | 'cloth';
export const GOODS: Good[] = ['quinoa', 'potatoes', 'wool', 'salt', 'stone', 'silver', 'cloth'];
export const FOOD: Good[] = ['potatoes', 'quinoa'];
export const GOOD_NAME: Record<Good, string> = {
  quinoa: 'Quinoa', potatoes: 'Potatoes', wool: 'Wool', salt: 'Salt', stone: 'Stone', silver: 'Silver', cloth: 'Woven cloth',
};
export const GOOD_WHY: Record<Good, string> = {
  quinoa: 'Food. Each settler eats 2 food a turn. The summit festival needs 10.',
  potatoes: 'Food, eaten first. Frost nights spoil some unless you know chuño.',
  wool: 'From alpaca pasture. Weavers turn 2 wool into cloth. The vicuñas trade for it.',
  salt: 'Salt flats make a little; the vicuña herders trade more. Pays for a granary; the condors want it.',
  stone: 'From scree. Every building needs stone.',
  silver: 'Only the condors can reach the silver veins: trade with them. The summit festival needs 4.',
  cloth: 'Woven on a loom. The summit festival needs 6.',
};

export type Terrain = 'forest' | 'meadow' | 'terrace' | 'tpotato' | 'grass' | 'salt' | 'spring' | 'scree' | 'silver'
  | 'snow' | 'peak' | 'lake' | 'reeds' | 'pass';
export interface TerrainDef {
  name: string; band: number; cost: number; walk: boolean; work: boolean;
  /** what one settler on the tile makes each turn */
  good?: Good; n?: number; warmth?: number; job: string;
}
/** altitude bands, low to high */
export const BANDS = ['Cloud forest', 'Terraces', 'Puna grassland', 'Scree', 'Snow line'];
/** move cost in half-steps: 2 = one normal step; a trail makes any tile cost 1 */
export const TERRAIN: Record<Terrain, TerrainDef> = {
  forest: { name: 'Cloud forest', band: 0, cost: 4, walk: true, work: true, good: 'potatoes', n: 2, job: 'Forest garden' },
  meadow: { name: 'River meadow', band: 1, cost: 2, walk: true, work: true, good: 'potatoes', n: 2, job: 'Meadow plot' },
  terrace: { name: 'Quinoa terraces', band: 1, cost: 2, walk: true, work: true, good: 'quinoa', n: 3, job: 'Quinoa terraces' },
  tpotato: { name: 'Potato terraces', band: 1, cost: 2, walk: true, work: true, good: 'potatoes', n: 3, job: 'Potato field' },
  grass: { name: 'Puna grassland', band: 2, cost: 2, walk: true, work: true, good: 'wool', n: 2, job: 'Alpaca pasture' },
  salt: { name: 'Salt flat', band: 2, cost: 2, walk: true, work: true, good: 'salt', n: 1, job: 'Salt flat' },
  spring: { name: 'Hot spring', band: 2, cost: 2, walk: true, work: true, warmth: 3, job: 'Hot spring' },
  scree: { name: 'Scree', band: 3, cost: 4, walk: true, work: true, good: 'stone', n: 2, job: 'Stone quarry' },
  silver: { name: 'Silver vein', band: 3, cost: 4, walk: true, work: false, job: 'Silver vein' },
  snow: { name: 'Snowfield', band: 4, cost: 4, walk: true, work: true, good: 'stone', n: 1, job: 'Snow quarry' },
  peak: { name: 'Peak', band: 4, cost: 99, walk: false, work: false, job: '' },
  lake: { name: 'Lake', band: 1, cost: 99, walk: false, work: false, job: '' },
  reeds: { name: 'Reed island', band: 1, cost: 99, walk: false, work: true, good: 'quinoa', n: 2, job: 'Reed garden' },
  pass: { name: 'Hidden pass', band: 4, cost: 4, walk: false, work: false, job: '' },
};
const CODE: Record<string, Terrain> = {
  F: 'forest', M: 'meadow', T: 'terrace', U: 'tpotato', G: 'grass', A: 'salt', H: 'spring', S: 'scree', V: 'silver',
  N: 'snow', P: 'peak', L: 'lake', R: 'reeds', K: 'pass',
};

export const W = 18, H = 14;
// bottom-left cloud forest climbing to the snow at the top-right; the summit plateau is walled by peaks, with a
// long way round on the far right and two hidden passes (K) the condors know.
const ROWS = [
  'GSSSPPNNNNNNNPPPPP',
  'GGSSSKNNNNNHVNPPPP',
  'TGGVSSPNNNNNNNNPPP',
  'TTGGGSPPPKPPNNNSPP',
  'FTTGGGSSSSSPPNNSSP',
  'FLLLTGGAASHSPPNVSS',
  'FLRLLTGAAGGSSSSSSS',
  'FLLRLTGGGGGGSSSSSS',
  'FFLLLUTTGGGGGSSSSS',
  'FFFMMUUTTGGGGGSSSS',
  'FFFFMMUTTTGGGGGSSS',
  'FFFFFGMUTTTGGGGGSS',
  'FFFFFFMMUUTTTGGGGS',
  'FFFFFFFMMUUTTTGGGG',
];
/** rivers as waypoints; each is walked hex by hex below, so every step is a real neighbour */
const RIVER_WAYPOINTS: [number, number][][] = [
  [[16, 4], [13, 7], [11, 8], [9, 8], [5, 8]],   // from the scree down past the herders into the lake
  [[3, 9], [5, 12], [6, 13]],                     // the lake's outflow down through the forest
];
export const MAP: Terrain[] = ROWS.join('').split('').map(c => CODE[c]);
function walkRiver(pts: [number, number][]) {
  const out: [number, number][] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    let c = out[out.length - 1];
    while (c[0] !== pts[i][0] || c[1] !== pts[i][1]) {
      c = neighbours(c[0], c[1]).sort((a, b) => hexDist(a, pts[i]) - hexDist(b, pts[i]) || +(MAP[idx(a[0], a[1])] === 'peak') - +(MAP[idx(b[0], b[1])] === 'peak'))[0];
      out.push(c);
    }
  }
  return out;
}
export const RIVER_PATHS: [number, number][][] = RIVER_WAYPOINTS.map(walkRiver);
export const RIVERS = new Set(RIVER_PATHS.flat().map(([q, r]) => r * W + q));

export type NeighbourId = 'herders' | 'condors' | 'viscachas';
export interface Offer { give: [Good, number]; get: [Good, number] }
export interface NeighbourDef {
  id: NeighbourId; name: string; who: string; q: number; r: number;
  offers: Offer[];
  skill: { id: string; name: string; line: string };
  quest: { text: string; done: string } & ({ kind: 'deliver'; good: Good; n: number } | { kind: 'visit'; q: number; r: number; thing: string });
  reward: [Good, number] | null;
  greet: string;
}
export const NEIGHBOURS: Record<NeighbourId, NeighbourDef> = {
  herders: {
    id: 'herders', name: 'Vicuña Herders', who: 'Elder Wari', q: 10, r: 7,
    offers: [
      { give: ['wool', 6], get: ['salt', 4] },
      { give: ['salt', 3], get: ['wool', 5] },
      { give: ['quinoa', 5], get: ['wool', 4] },
    ],
    skill: { id: 'weave', name: 'Fine weaving', line: '+1 cloth per weaver' },
    quest: { kind: 'deliver', good: 'salt', n: 4, text: 'The herd needs a salt lick. Bring 4 salt.', done: 'The herd is licking salt happily.' },
    reward: ['wool', 6],
    greet: 'Soft wool, fair trades. Welcome to the grass.',
  },
  condors: {
    id: 'condors', name: 'Condors of the Cliff', who: 'Old Kuntur', q: 3, r: 1,
    offers: [
      { give: ['quinoa', 6], get: ['silver', 1] },
      { give: ['salt', 3], get: ['silver', 1] },
      { give: ['cloth', 1], get: ['silver', 2] },
    ],
    skill: { id: 'passes', name: 'Sky paths', line: 'Reveals the hidden passes to the summit' },
    quest: { kind: 'visit', q: 0, r: 0, thing: 'fallen feather', text: 'My best feather blew away to the far west corner. Could Dora find it?', done: 'My feather! Thank you, little one.' },
    reward: ['silver', 1],
    greet: 'We see the whole valley from up here.',
  },
  viscachas: {
    id: 'viscachas', name: 'Viscacha Warren', who: 'Granny Sisa', q: 14, r: 8,
    offers: [
      { give: ['quinoa', 4], get: ['potatoes', 6] },
      { give: ['wool', 3], get: ['stone', 5] },
      { give: ['salt', 2], get: ['potatoes', 5] },
    ],
    skill: { id: 'chuno', name: 'Chuño', line: 'Frost no longer spoils potatoes, and frost nights freeze-dry +2 food' },
    quest: { kind: 'visit', q: 0, r: 6, thing: 'lost pup', text: 'Our little pup wandered off to the reeds by the lake. Please find her!', done: 'You found her! The whole warren thanks you.' },
    reward: ['potatoes', 6],
    greet: 'Mind the rocks, dears. Come and sit in the sun.',
  },
};
export const NEIGHBOUR_IDS: NeighbourId[] = ['herders', 'condors', 'viscachas'];

export type BuildKind = 'loom' | 'granary' | 'kiln' | 'lookout' | 'bath' | 'caravan';
export interface BuildDef { name: string; work: number; cost: Partial<Record<Good, number>>; line: string; job?: string; slots?: number }
export const BUILDS: Record<BuildKind, BuildDef> = {
  loom: { name: 'Wool Loom', work: 10, cost: { stone: 2 }, line: 'Weavers turn 2 wool into 1 cloth.', job: 'Weaver', slots: 2 },
  granary: { name: 'Granary', work: 10, cost: { stone: 2, salt: 1 }, line: 'Halves frost spoilage. A keeper adds +2 growth.', job: 'Granary keeper', slots: 1 },
  kiln: { name: 'Kiln', work: 10, cost: { stone: 3 }, line: '+2 Warmth every turn. A keeper adds +3 more.', job: 'Kiln keeper', slots: 1 },
  lookout: { name: 'Lookout', work: 8, cost: { stone: 2 }, line: 'See further and get warned before frost nights. A watcher adds +5 happiness.', job: 'Watcher', slots: 1 },
  bath: { name: 'Hot Spring Bath', work: 16, cost: { stone: 4 }, line: '+4 Warmth and +10 happiness. An attendant adds +2 Warmth, +5 happiness. Half the work beside a hot spring.', job: 'Bath attendant', slots: 1 },
  caravan: { name: 'Llama Caravan', work: 8, cost: { quinoa: 4, wool: 2 }, line: 'A new llama caravan to haul goods between villages.' },
};
export const BUILD_IDS: BuildKind[] = ['kiln', 'loom', 'granary', 'lookout', 'bath', 'caravan'];

/** indoor jobs; a tile job is written "t:q,r" */
export type IndoorJob = 'hearth' | 'builder' | 'weaver' | 'kiln' | 'granary' | 'lookout' | 'bath';
export const INDOOR: Record<IndoorJob, { name: string; needs?: BuildKind; slots: number; line: string }> = {
  hearth: { name: 'Hearth keeper', slots: 2, line: '+3 Warmth' },
  builder: { name: 'Builder', slots: 9, line: '+3 build work' },
  weaver: { name: 'Weaver', needs: 'loom', slots: 2, line: '2 wool → 1 cloth' },
  kiln: { name: 'Kiln keeper', needs: 'kiln', slots: 1, line: '+3 Warmth' },
  granary: { name: 'Granary keeper', needs: 'granary', slots: 1, line: '+2 growth' },
  lookout: { name: 'Watcher', needs: 'lookout', slots: 1, line: '+5 happiness' },
  bath: { name: 'Bath attendant', needs: 'bath', slots: 1, line: '+2 Warmth, +5 happiness' },
};
export const INDOOR_IDS: IndoorJob[] = ['hearth', 'builder', 'weaver', 'kiln', 'granary', 'lookout', 'bath'];

export const VILLAGE_NAMES = ['Saltstep', 'Reedwhisker', 'Woolcrest', 'Pebblenook'];
export const SUMMIT_NAME = 'Highburrow';
export const START = { village: [5, 10] as [number, number], dora: [6, 9] as [number, number], enzo: [5, 10] as [number, number], caravan: [5, 10] as [number, number] };
export const MAX_VILLAGES = 5;
export const LAST_TURN = 60;
/** food each settler eats a turn */
export const EAT = 2;
export const SEASON_LEN = 8;
/** what the summit festival needs in the summit village's storehouse */
export const FESTIVAL: Partial<Record<Good, number>> = { cloth: 6, quinoa: 10, silver: 4 };
export const POP_GOAL = { assist: 22, normal: 24 };
export const UNIT_INFO = {
  dora: { name: 'Dora', role: 'Scout', mp: 6, sight: 2 },
  enzo: { name: 'Enzo', role: 'Leader', mp: 4, sight: 1 },
  settler: { name: 'Settlers', role: 'Settlers', mp: 4, sight: 1 },
  caravan: { name: 'Llama caravan', role: 'Caravan', mp: 6, sight: 1 },
};
export const CARAVAN_CAP = 12;
/** a storehouse holds this much of each good (a granary doubles it for food) */
export const STORE_CAP = 40;

export interface DecisionDef { id: string; title: string; who: NeighbourId | null; text: string; from: number; choices: { label: string; line: string }[] }
/** mid-game requests that ask for a decision (each comes once, between turns 14 and 36) */
export const DECISIONS: DecisionDef[] = [
  { id: 'herd', title: 'A hungry herd', who: 'herders', from: 14, text: 'Elder Wari: "Frost burned our grass. Could your league spare 8 quinoa for the herd?"',
    choices: [{ label: 'Share 8 quinoa', line: '+25 friendship, and they send 6 wool in thanks' }, { label: 'We can’t spare it', line: 'Keep the quinoa; −10 friendship' }] },
  { id: 'alpacas', title: 'Stray alpacas', who: 'herders', from: 20, text: 'A small herd of alpacas wandered into your pastures. They belong to the vicuña herders’ cousins.',
    choices: [{ label: 'Keep them', line: 'Every alpaca pasture makes +1 wool from now on; −15 friendship' }, { label: 'Walk them home', line: '+25 friendship with the herders' }] },
  { id: 'coldsnap', title: 'A long cold snap', who: 'condors', from: 26, text: 'Old Kuntur: "I see a long cold snap riding the wind. Two frost nights in a row are coming."',
    choices: [{ label: 'Knit blankets', line: 'Each village with 3 wool spends it: +15 Warmth now' }, { label: 'Tough it out', line: 'Keep the wool and brace for two frosts' }] },
];
export interface EventDef { id: string; title: string; text: string; season?: 'wet' | 'dry' }
export const EVENTS: EventDef[] = [
  { id: 'rains', title: 'Good rains', text: 'Soft rain on the terraces: food tiles make +1 next turn.', season: 'wet' },
  { id: 'warm', title: 'Warm spell', text: 'A warm wind from the forest: every village gains +6 Warmth.' },
  { id: 'hail', title: 'Hailstorm', text: 'Hail flattened some quinoa: one village loses 3 quinoa.' },
  { id: 'snowstorm', title: 'Snowstorm', text: 'Snow on the heights: units on scree or snow lose their moves next turn.', season: 'dry' },
  { id: 'llama', title: 'Wandering llama', text: 'A friendly llama wandered in carrying 3 wool.' },
  { id: 'gift', title: 'Neighbourly gift', text: 'Your best friends left a basket of 4 potatoes.' },
];

// ── hex helpers (odd-r offset)
export function idx(q: number, r: number) { return r * W + q; }
export function inMap(q: number, r: number) { return q >= 0 && r >= 0 && q < W && r < H; }
export function neighbours(q: number, r: number): [number, number][] {
  const odd = r & 1;
  const d = odd ? [[1, 0], [-1, 0], [0, -1], [1, -1], [0, 1], [1, 1]] : [[1, 0], [-1, 0], [-1, -1], [0, -1], [-1, 1], [0, 1]];
  return d.map(([dq, dr]) => [q + dq, r + dr] as [number, number]).filter(([a, b]) => inMap(a, b));
}
export function toCube(q: number, r: number) { const x = q - (r - (r & 1)) / 2; return { x, z: r, y: -x - r }; }
export function hexDist(a: [number, number], b: [number, number]) {
  const A = toCube(a[0], a[1]), B = toCube(b[0], b[1]);
  return Math.max(Math.abs(A.x - B.x), Math.abs(A.y - B.y), Math.abs(A.z - B.z));
}
export function ring(q: number, r: number, rad: number): [number, number][] {
  const out: [number, number][] = [];
  for (let rr = r - rad; rr <= r + rad; rr++) for (let qq = q - rad - 1; qq <= q + rad + 1; qq++)
    if (inMap(qq, rr) && hexDist([q, r], [qq, rr]) <= rad) out.push([qq, rr]);
  return out;
}
export function season(turn: number): 'wet' | 'dry' { return Math.floor((turn - 1) / SEASON_LEN) % 2 === 0 ? 'wet' : 'dry'; }
