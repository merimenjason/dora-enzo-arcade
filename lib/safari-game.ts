// Snapshot Safari's rules: four Andean trails, twenty-four creatures and their behaviours, how animals notice you, the
// tools, how a photo is scored, and the field journal. Deterministic and DOM-free: a seed replays an outing exactly.

export type TrailId = 'puna' | 'forest' | 'salar' | 'cliffs';
export type TimeId = 'morning' | 'noon' | 'dusk';
export type Who = 'dora' | 'enzo';
export type Pace = 'tiptoe' | 'walk' | 'run';
export type Pose = 'stand' | 'eat' | 'walk' | 'up' | 'sit' | 'lie' | 'roll' | 'jump' | 'fly' | 'spread' | 'dance' | 'dive' | 'swim' | 'climb' | 'shake';
/** What a behaviour waits for: a calm animal, friends nearby, berries, your whistle, or nobody around at all. */
export type Need = 'calm' | 'group' | 'berries' | 'whistle' | 'alone';
export type Facing = 'toward' | 'side' | 'away';
export type Kind = 'camelid' | 'rodent' | 'canid' | 'cat' | 'bear' | 'tapir' | 'deer' | 'wader' | 'duck' | 'raptor' | 'runner' | 'bird';
export type Spot = 'ground' | 'rock' | 'tree' | 'water' | 'flower';

export type Behaviour = {
  id: string; name: string; pose: Pose; rare: boolean;
  /** How likely the behaviour is picked in the morning, at noon and at dusk (0: never then). */
  w: [number, number, number];
  dur: [number, number];
  /** How much the animal moves while doing it, 0 to 1: fast movement blurs a photo. */
  motion: number;
  /** The chance it looks your way while doing it. */
  face: number;
  need?: Need; move?: number; fly?: number; leave?: boolean; approach?: boolean; cub?: boolean;
};
export type Species = {
  id: string; name: string; kind: Kind; w: number; h: number; shy: number; spot: Spot; group: [number, number]; range: number;
  where: Partial<Record<TrailId, [number, number, number]>>; likes: boolean; color: string; fact: string; b: Behaviour[];
};

const B = (id: string, name: string, pose: Pose, w: [number, number, number], o: Partial<Behaviour> = {}): Behaviour =>
  ({ id, name, pose, w, rare: false, dur: [10, 18], motion: 0.12, face: 0.35, ...o });
const R = (id: string, name: string, pose: Pose, w: [number, number, number], o: Partial<Behaviour> = {}) => B(id, name, pose, w, { rare: true, dur: [4, 7], ...o });
const ALL: [number, number, number] = [3, 3, 3], OFF: [number, number, number] = [0, 0, 0];

export const SPECIES: Species[] = [
  { id: 'vicuna', name: 'Vicuña', kind: 'camelid', w: 1.4, h: 1.3, shy: 0.75, spot: 'ground', group: [2, 4], range: 7, where: { puna: [3, 3, 2], salar: [2, 2, 2] }, likes: false, color: '#c98d4e',
    fact: 'The smallest wild camel, with the softest wool in the world. Herds keep a lookout.',
    b: [B('graze', 'Grazing', 'eat', ALL, { motion: 0.15, face: 0.2 }), B('trot', 'Trotting together', 'walk', [1, 1, 1], { need: 'group', move: 1.5, motion: 0.5, face: 0.3 }),
      R('dust', 'Dust bath', 'roll', [0, 1.2, 0.4], { need: 'calm', motion: 0.45, face: 0.4 }), B('lookout', 'Sentry call', 'up', OFF, { need: 'whistle', dur: [3, 5], motion: 0.08, face: 0.9 })] },
  { id: 'llama', name: 'Llama', kind: 'camelid', w: 1.6, h: 1.8, shy: 0.25, spot: 'ground', group: [1, 2], range: 5, where: { puna: [3, 3, 3] }, likes: true, color: '#efe3cf',
    fact: 'A friendly hummer. Llamas talk to each other with soft hums and ear wiggles.',
    b: [B('chew', 'Chewing', 'stand', ALL, { motion: 0.08, face: 0.5 }), B('peek', 'Curious stare', 'up', [2, 2, 2], { need: 'calm', approach: true, motion: 0.05, face: 1 }),
      B('berries', 'Berry snack', 'eat', OFF, { need: 'berries', face: 0.5 }), R('hum', 'Humming with a cria', 'stand', [0.6, 0, 1], { need: 'calm', motion: 0.08, face: 0.5 })] },
  { id: 'alpaca', name: 'Alpaca', kind: 'camelid', w: 1.25, h: 1.4, shy: 0.35, spot: 'ground', group: [2, 4], range: 5, where: { puna: [3, 2, 3] }, likes: false, color: '#f4ead8',
    fact: 'Alpacas are fluffier than llamas and like to stay close together.',
    b: [B('graze', 'Munching', 'eat', ALL), B('shake', 'Fluffy shake', 'shake', [1, 1, 1], { motion: 0.65, face: 0.5, dur: [3, 5] }),
      B('huddle', 'Cosy huddle', 'lie', [0.5, 0, 2.5], { need: 'group', motion: 0, face: 0.4 }), R('pronk', 'Pronking', 'jump', [0.7, 0.3, 0.7], { need: 'calm', motion: 0.75, face: 0.3 })] },
  { id: 'flamingo', name: 'Andean flamingo', kind: 'wader', w: 0.9, h: 1.4, shy: 0.6, spot: 'water', group: [3, 5], range: 5, where: { salar: [3, 3, 3] }, likes: false, color: '#f6a6b6',
    fact: 'Flamingos are pink from the tiny algae they sieve from salty lagoons, upside down.',
    b: [B('filter', 'Filter feeding', 'eat', ALL, { motion: 0.2, face: 0.2 }), B('oneleg', 'Standing on one leg', 'sit', [2, 1, 3], { need: 'calm', motion: 0, face: 0.3 }),
      R('march', 'Flamingo dance', 'dance', [1, 0, 0.5], { need: 'group', motion: 0.45, face: 0.3, move: 0.7 }), R('takeoff', 'Taking flight', 'fly', [0.3, 0.3, 0.6], { motion: 0.55, fly: 4, move: 2.5, leave: true })] },
  { id: 'condor', name: 'Andean condor', kind: 'raptor', w: 1.1, h: 1.0, shy: 0.5, spot: 'rock', group: [1, 2], range: 4, where: { cliffs: [2, 3, 2] }, likes: false, color: '#2e2a2c',
    fact: 'One of the biggest flying birds on Earth. It can glide for hours without a flap.',
    b: [B('perch', 'Perched on a ledge', 'stand', ALL, { motion: 0.05 }), B('spread', 'Sunning its wings', 'spread', [3, 1, 0], { motion: 0.1, face: 0.7 }),
      B('soar', 'Soaring', 'fly', [1, 3, 1], { fly: 5.6, move: 2.4, motion: 0.3, face: 0.3, dur: [8, 14] }), R('sunglide', 'Gliding past the sun', 'fly', [0, 0.8, 0], { fly: 6.2, move: 2.8, motion: 0.3, face: 0.4, dur: [6, 9] })] },
  { id: 'hummingbird', name: 'Giant hummingbird', kind: 'bird', w: 0.32, h: 0.3, shy: 0.3, spot: 'flower', group: [1, 2], range: 2, where: { forest: [3, 3, 2] }, likes: false, color: '#5bb38a',
    fact: 'The biggest hummingbird of all, and still its heart beats over a thousand times a minute.',
    b: [B('hover', 'Hovering', 'fly', ALL, { motion: 0.55, face: 0.3, fly: 1.7 }), B('sip', 'Sipping nectar', 'eat', ALL, { motion: 0.35, face: 0.2 }),
      B('perch', 'Resting on a twig', 'stand', [2, 2, 2], { need: 'calm', motion: 0, face: 0.6 }), R('dive', 'Courtship dive', 'dive', [1.2, 0.3, 0], { motion: 0.8, face: 0.5, fly: 2.4 })] },
  { id: 'fox', name: 'Andean fox', kind: 'canid', w: 1.0, h: 0.7, shy: 0.7, spot: 'ground', group: [1, 1], range: 8, where: { puna: [1, 1, 2], cliffs: [1, 1, 2] }, likes: false, color: '#c4733c',
    fact: 'The culpeo trots for miles on the high plains, listening for mice under the grass.',
    b: [B('trot', 'Trotting', 'walk', ALL, { move: 1.3, motion: 0.45 }), B('sniff', 'Sniffing the air', 'up', [2, 2, 2], { motion: 0.1, face: 0.5 }),
      R('pounce', 'Mouse pounce', 'jump', [0.6, 0.3, 0.9], { need: 'calm', motion: 0.65, face: 0.2 }), B('tilt', 'Head tilt', 'stand', OFF, { need: 'whistle', dur: [3, 5], motion: 0, face: 1 })] },
  { id: 'bear', name: 'Spectacled bear', kind: 'bear', w: 1.5, h: 1.25, shy: 0.55, spot: 'ground', group: [1, 2], range: 5, where: { forest: [2, 2, 2] }, likes: true, color: '#2b2522',
    fact: 'Every spectacled bear has its own pale "glasses". They love bromeliads and fruit.',
    b: [B('munch', 'Munching bromeliads', 'eat', ALL, { motion: 0.2 }), B('climb', 'Climbing a tree', 'climb', [1, 1, 1], { motion: 0.3, face: 0.3, fly: 1.6 }),
      B('berries', 'Berry feast', 'sit', OFF, { need: 'berries', motion: 0.15, face: 0.7 }), R('tumble', 'Cub tumble', 'roll', [0.8, 0.5, 0.8], { need: 'group', cub: true, motion: 0.55, face: 0.5 })] },
  { id: 'cavy', name: 'Wild guinea pig', kind: 'rodent', w: 0.42, h: 0.28, shy: 0.8, spot: 'ground', group: [2, 4], range: 3, where: { puna: [2, 2, 3], forest: [1, 1, 2] }, likes: true, color: '#8a6a4c',
    fact: 'The wild cousins of pet guinea pigs live in grassy runs and chatter to each other.',
    b: [B('nibble', 'Nibbling clover', 'eat', ALL), B('peek', 'Peeking from the grass', 'up', [2, 2, 2], { motion: 0, face: 0.9 }),
      R('popcorn', 'Popcorning', 'jump', [1, 1, 1], { need: 'calm', motion: 0.75 }), B('berries', 'Sharing berries', 'eat', OFF, { need: 'berries', face: 0.5 })] },
  { id: 'torrent', name: 'Torrent duck', kind: 'duck', w: 0.5, h: 0.42, shy: 0.6, spot: 'water', group: [1, 2], range: 4, where: { forest: [2, 2, 1] }, likes: false, color: '#e7e2da',
    fact: 'Torrent ducks swim up rushing mountain streams that would sweep anyone else away.',
    b: [B('preen', 'Preening on a rock', 'stand', ALL, { motion: 0.2 }), B('dive', 'Diving', 'dive', [2, 2, 2], { motion: 0.6, face: 0.2 }),
      R('rapids', 'Riding the rapids', 'swim', [1.2, 0.6, 0.3], { motion: 0.6, move: 1.1 })] },
  { id: 'coot', name: 'Giant coot', kind: 'duck', w: 0.62, h: 0.5, shy: 0.35, spot: 'water', group: [1, 3], range: 4, where: { salar: [3, 3, 2] }, likes: false, color: '#2c2b30',
    fact: 'Giant coots build floating nests of waterweed so big a person could stand on one.',
    b: [B('paddle', 'Paddling', 'swim', ALL, { move: 0.5, motion: 0.3 }), B('nest', 'Building its nest', 'eat', [2, 2, 2], { motion: 0.2 }),
      R('chick', 'Feeding a chick', 'eat', [1.2, 0.5, 0.4], { need: 'calm', motion: 0.15, face: 0.6 })] },
  { id: 'cat', name: 'Andean cat', kind: 'cat', w: 0.9, h: 0.5, shy: 0.95, spot: 'ground', group: [1, 1], range: 9, where: { cliffs: [0, 0, 2] }, likes: false, color: '#b9aa94',
    fact: 'So rarely seen that many scientists have never met one. Its stripy tail is thick as a rope.',
    b: [B('watch', 'Watching from the rocks', 'sit', [2, 2, 2], { motion: 0, face: 0.7 }), B('groom', 'Grooming', 'sit', [1, 1, 1], { need: 'calm', motion: 0.3 }),
      R('stalk', 'Prowling', 'walk', [3, 3, 3], { need: 'alone', move: 0.7, motion: 0.3, dur: [8, 12] })] },
  { id: 'tinamou', name: 'Puna tinamou', kind: 'runner', w: 0.45, h: 0.4, shy: 0.7, spot: 'ground', group: [1, 2], range: 4, where: { puna: [3, 2, 2] }, likes: true, color: '#9c8458',
    fact: 'A round, speckled bird that would rather walk than fly, and whistles sweetly at dawn.',
    b: [B('peck', 'Pecking seeds', 'eat', ALL), B('freeze', 'Freezing still', 'stand', [1, 1, 1], { motion: 0, face: 0.5 }),
      B('call', 'Whistling back', 'up', OFF, { need: 'whistle', dur: [3, 5], motion: 0.1, face: 0.7 })] },
  { id: 'caracara', name: 'Mountain caracara', kind: 'raptor', w: 0.6, h: 0.6, shy: 0.4, spot: 'ground', group: [1, 2], range: 6, where: { puna: [2, 2, 2], salar: [1, 1, 1], cliffs: [1, 1, 1] }, likes: false, color: '#2b2726',
    fact: 'A clever falcon with an orange face that walks about turning over stones for snacks.',
    b: [B('strut', 'Strutting', 'walk', ALL, { move: 0.7, motion: 0.35 }), B('probe', 'Turning stones', 'eat', [2, 2, 2]),
      R('call', 'Head-back call', 'up', [1.2, 0.6, 0.6], { need: 'calm', motion: 0.35, face: 0.4 })] },
  { id: 'goose', name: 'Andean goose', kind: 'duck', w: 0.72, h: 0.7, shy: 0.45, spot: 'water', group: [2, 4], range: 5, where: { salar: [3, 2, 3] }, likes: false, color: '#f3f1ec',
    fact: 'Snow-white geese with dark wings that graze the boggy shores of high lakes.',
    b: [B('graze', 'Grazing the shore', 'eat', ALL), B('honk', 'Honking parade', 'up', [1, 1, 1], { need: 'group', move: 0.5, motion: 0.4, face: 0.4 }), B('preen', 'Preening', 'stand', [2, 2, 2], { motion: 0.25 })] },
  { id: 'rhea', name: 'Puna rhea', kind: 'runner', w: 1.0, h: 1.4, shy: 0.6, spot: 'ground', group: [1, 3], range: 7, where: { puna: [2, 2, 1], salar: [1, 1, 1] }, likes: false, color: '#a89880',
    fact: 'A tall bird that cannot fly but can outrun almost anything on the plains.',
    b: [B('stride', 'Striding', 'walk', ALL, { move: 1.2, motion: 0.45 }), B('peck', 'Pecking', 'eat', [2, 2, 2]),
      R('wings', 'Wing display', 'spread', [0.7, 0.5, 0.7], { need: 'calm', motion: 0.3, face: 0.5 })] },
  { id: 'lapwing', name: 'Andean lapwing', kind: 'wader', w: 0.45, h: 0.45, shy: 0.5, spot: 'ground', group: [1, 3], range: 5, where: { puna: [2, 2, 2], salar: [2, 2, 2] }, likes: false, color: '#9aa29a',
    fact: 'A noisy plover with pink legs and bold wing stripes it flashes when it is cross.',
    b: [B('wade', 'Wading', 'walk', ALL, { move: 0.5, motion: 0.3 }), B('call', 'Calling out', 'up', [1, 1, 1], { motion: 0.2, face: 0.5 }),
      R('flash', 'Wing flash', 'spread', OFF, { need: 'whistle', motion: 0.3, face: 0.6 })] },
  { id: 'taruca', name: 'Taruca deer', kind: 'deer', w: 1.3, h: 1.3, shy: 0.8, spot: 'ground', group: [1, 3], range: 6, where: { forest: [1, 1, 2], cliffs: [1, 1, 2] }, likes: false, color: '#9e8564',
    fact: 'A stocky mountain deer with big ears that picks its way along rocky slopes.',
    b: [B('browse', 'Browsing', 'eat', ALL), B('ears', 'Ears up', 'up', [2, 2, 2], { motion: 0, face: 0.9 }),
      R('leap', 'Leaping', 'jump', [0.4, 0, 1], { move: 1.8, motion: 0.75 })] },
  { id: 'viscacha', name: 'Mountain viscacha', kind: 'rodent', w: 0.55, h: 0.55, shy: 0.55, spot: 'rock', group: [1, 4], range: 2, where: { cliffs: [3, 2, 3], puna: [1, 1, 1] }, likes: true, color: '#b7aa98',
    fact: 'A long-tailed cousin of the chinchilla that loves to sit on a warm rock with its eyes half shut.',
    b: [B('nibble', 'Nibbling', 'eat', ALL), B('groom', 'Washing its face', 'sit', [2, 2, 2], { motion: 0.3, face: 0.6 }),
      R('sun', 'Sunbathing', 'lie', [1.6, 0.7, 0], { need: 'calm', motion: 0, face: 0.5 }), B('stand', 'Standing tall', 'up', OFF, { need: 'whistle', dur: [3, 5], motion: 0, face: 0.9 })] },
  { id: 'chinchilla', name: 'Wild chinchilla', kind: 'rodent', w: 0.42, h: 0.38, shy: 0.85, spot: 'rock', group: [1, 3], range: 2, where: { cliffs: [0, 0.5, 3] }, likes: true, color: '#8f8b93',
    fact: 'Dora and Enzo\'s wild cousins! They come out at dusk to nibble and roll in volcanic dust.',
    b: [B('nibble', 'Nibbling a seed', 'eat', ALL), B('peek', 'Peeking out', 'up', [2, 2, 2], { motion: 0, face: 0.9 }),
      R('dust', 'Dust bath', 'roll', [0, 0, 1.2], { need: 'calm', motion: 0.5 })] },
  { id: 'rooster', name: 'Cock-of-the-rock', kind: 'bird', w: 0.4, h: 0.42, shy: 0.5, spot: 'tree', group: [1, 4], range: 2, where: { forest: [3, 1, 1] }, likes: false, color: '#ff6a2a',
    fact: 'A blazing orange bird with a crest like a fan. The males gather each morning to show off.',
    b: [B('perch', 'Perched', 'stand', ALL, { motion: 0.05 }), B('hop', 'Hopping branches', 'jump', [2, 2, 2], { motion: 0.5 }),
      R('lek', 'Lek dance', 'dance', [1.4, 0, 0.3], { need: 'group', motion: 0.45, face: 0.5 })] },
  { id: 'ibis', name: 'Puna ibis', kind: 'wader', w: 0.7, h: 0.7, shy: 0.45, spot: 'water', group: [2, 4], range: 5, where: { salar: [3, 3, 3] }, likes: false, color: '#4a3d4a',
    fact: 'Glossy dark ibises that probe the mud with long curved bills and fly home in lines.',
    b: [B('probe', 'Probing the mud', 'eat', ALL), B('preen', 'Preening', 'stand', [2, 2, 2], { motion: 0.25 }),
      R('flock', 'Flying in a line', 'fly', [0.7, 0.3, 1.2], { need: 'group', fly: 3.6, move: 2.2, motion: 0.4, leave: true })] },
  { id: 'toucan', name: 'Mountain toucan', kind: 'bird', w: 0.5, h: 0.5, shy: 0.5, spot: 'tree', group: [1, 2], range: 2, where: { forest: [2, 2, 2] }, likes: true, color: '#4c6e8e',
    fact: 'A misty-blue toucan with a painted bill that tosses berries up and catches them.',
    b: [B('perch', 'Perched in the mist', 'stand', ALL, { motion: 0.05 }), B('berries', 'Berry toss', 'eat', OFF, { need: 'berries', motion: 0.3, face: 0.5 }),
      B('call', 'Yelping call', 'up', [1, 1, 1], { motion: 0.2, face: 0.4 })] },
  { id: 'tapir', name: 'Mountain tapir', kind: 'tapir', w: 1.6, h: 1.0, shy: 0.65, spot: 'ground', group: [1, 1], range: 5, where: { forest: [1, 1, 2] }, likes: false, color: '#3a3438',
    fact: 'A woolly tapir with a wiggly little trunk and white lips. It loves a good wallow.',
    b: [B('browse', 'Browsing leaves', 'eat', ALL), R('wallow', 'Mud wallow', 'lie', [0.4, 0.7, 0.7], { need: 'calm', motion: 0.15 }),
      B('sniff', 'Trunk sniff', 'up', OFF, { need: 'whistle', dur: [3, 5], motion: 0.05, face: 0.9 })] },
];
export const SPECIES_BY_ID: Record<string, Species> = Object.fromEntries(SPECIES.map((s) => [s.id, s]));

export const TRAILS: { id: TrailId; name: string; cover: string; blurb: string }[] = [
  { id: 'puna', name: 'Puna Grassland', cover: 'tall grass', blurb: 'Golden grass under snowy volcanoes. Camelids, rheas and busy little birds.' },
  { id: 'forest', name: 'Cloud Forest', cover: 'ferns', blurb: 'Mossy trees in the mist, a tumbling stream, flowers for hummingbirds, and the odd bear.' },
  { id: 'salar', name: 'Salt Flat Lagoon', cover: 'tola bushes', blurb: 'A mirror of salt and pink water. Flamingos, coots and geese everywhere.' },
  { id: 'cliffs', name: 'Condor Cliffs', cover: 'tussocks', blurb: 'Warm rocks, steep ledges and huge skies. Watch for wings, whiskers and a very shy cat.' },
];
export const TIMES: { id: TimeId; name: string }[] = [{ id: 'morning', name: 'Morning' }, { id: 'noon', name: 'Noon' }, { id: 'dusk', name: 'Dusk' }];
const TI: Record<TimeId, number> = { morning: 0, noon: 1, dusk: 2 };
/** Golden light per trail and time of day, 0 to 1: soft low sun makes every photo glow. */
export const LIGHT: Record<TrailId, [number, number, number]> = { puna: [0.7, 0.1, 1], forest: [0.45, 0.25, 0.6], salar: [0.75, 0.05, 1], cliffs: [0.7, 0.15, 0.95] };

/** What opens as the journal's stars add up. */
export const UNLOCKS: { id: string; need: number; name: string; kind: 'time' | 'trail' | 'tool' }[] = [
  { id: 'noon', need: 12, name: 'Noon outings', kind: 'time' },
  { id: 'forest', need: 30, name: 'Cloud Forest', kind: 'trail' },
  { id: 'berries', need: 50, name: 'Berry pouch', kind: 'tool' },
  { id: 'dusk', need: 70, name: 'Dusk outings', kind: 'time' },
  { id: 'salar', need: 95, name: 'Salt Flat Lagoon', kind: 'trail' },
  { id: 'whistle', need: 125, name: 'Soft whistle', kind: 'tool' },
  { id: 'cliffs', need: 155, name: 'Condor Cliffs', kind: 'trail' },
  { id: 'trap', need: 190, name: 'Camera trap', kind: 'tool' },
];

// ---- numbers
export const DT = 1 / 30;
export const FILM = 24;
export const TRAIL_LEN = 220;
/** An outing lasts this many seconds of game time before the light goes. */
export const DAY = 360;
export const BERRIES = 3;
export const TRAP_FRAMES = 3;
/** The trap's lens: a fixed view a little ahead of it, and how close an animal must come to set it off. */
export const TRAP_ZOOM = 1.8, TRAP_REACH = 1.8;
export const PACE_SPEED: Record<Pace, number> = { tiptoe: 0.8, walk: 2, run: 4.4 };
/** How loud each way of moving is; standing still is almost silent and hiding is silent. */
export const NOISE = { still: 0.05, tiptoe: 0.18, walk: 0.55, run: 1.25 };
/** How steady the camera can get for each way of moving. */
const STEADY = { still: 1, tiptoe: 0.5, walk: 0.22, run: 0 };
export const ZOOM: [number, number] = [1, 8];
/** The frame is this many metres tall at zoom 1, and 3:2. */
export const FRAME_H = 5, ASPECT = 1.5;
export const WHISTLE_COOLDOWN = 8;
const REACH = 14;

// ---- a seeded generator: a seed replays an outing exactly
export function rng(seed: number) {
  let s = seed | 0;
  return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const r2 = (v: number) => Math.round(v * 100) / 100;

// ---- the trail
export type FeatureKind = 'grass' | 'rock' | 'tree' | 'water' | 'flower';
export type Feature = { kind: FeatureKind; x: number; w: number; h: number };
export type Trail = { id: TrailId; time: TimeId; len: number; features: Feature[] };

/** Lays out a trail's grass, rocks, trees, water and flowers from the seed. */
export function layTrail(id: TrailId, time: TimeId, r: () => number): Trail {
  const f: Feature[] = [], len = TRAIL_LEN;
  const between = (kind: FeatureKind, gap: [number, number], w: [number, number], h: [number, number], from = 8) => {
    for (let x = from + r() * gap[0]; x < len - 6; x += gap[0] + r() * (gap[1] - gap[0])) f.push({ kind, x: r2(x), w: r2(w[0] + r() * (w[1] - w[0])), h: r2(h[0] + r() * (h[1] - h[0])) });
  };
  const grass: Record<TrailId, [number, number]> = { puna: [13, 22], forest: [14, 24], salar: [18, 28], cliffs: [16, 26] };
  between('grass', grass[id], [3, 6], [0.9, 1.2], 6);
  if (id === 'puna') { between('rock', [22, 40], [1, 2], [0.6, 1.3]); between('tree', [50, 80], [2, 3], [2.6, 3.4], 30); between('water', [90, 120], [10, 16], [0, 0], 40); between('flower', [30, 50], [0.4, 0.6], [0.4, 0.6]); }
  if (id === 'forest') { between('tree', [9, 16], [2, 3], [3.4, 4.4], 4); between('water', [60, 90], [12, 18], [0, 0], 30); between('flower', [12, 22], [0.5, 0.8], [1, 1.5]); between('rock', [40, 60], [1, 1.6], [0.5, 0.9]); }
  if (id === 'salar') { between('water', [30, 46], [18, 28], [0, 0], 14); between('rock', [40, 70], [1, 1.8], [0.4, 0.9]); }
  if (id === 'cliffs') { between('rock', [10, 18], [1.4, 2.6], [1, 2.2]); between('tree', [70, 110], [1.6, 2.4], [2.2, 2.8], 40); }
  f.sort((a, b) => a.x - b.x);
  return { id, time, len, features: f };
}

// ---- the creatures out on the trail
export type Animal = {
  n: number; sp: Species; group: number; cub: boolean;
  x: number; y: number; baseY: number; home: number; dir: 1 | -1; face: Facing; faceIn: number;
  beh: number; left: number; target: number; alarm: number; calm: number; state: 'live' | 'berry' | 'flee' | 'gone'; fleeFor: number; seen: boolean;
};
export const behaviourOf = (a: Animal) => a.sp.b[a.beh];

// ---- photos
/** A photo is stored as a description and re-drawn by the scene: who, doing what, where in the frame, and its score. */
export type Subject = { sp: string; bh: string; nx: number; ny: number; sz: number; dir: 1 | -1; face: Facing; cub?: boolean };
export type Photo = Subject & {
  st: number; pts: number; tr: TrailId; tm: TimeId; who: Who; ax: number; ay: number; z: number; sharp: number;
  /** size, framing, sharpness, facing: each 0 to 1. */
  k: [number, number, number, number]; ex: Subject[]; rare: boolean; light: number; trap?: boolean; day: number; id: string;
};
export type Shot = { photo: Photo | null; empty: boolean };

export type SafariEvent =
  | { kind: 'snap'; photo: Photo | null } | { kind: 'flee'; sp: string } | { kind: 'rare'; sp: string; bh: string }
  | { kind: 'berries'; x: number } | { kind: 'whistle' } | { kind: 'trap'; x: number } | { kind: 'trapShot' } | { kind: 'trapBack'; n: number }
  | { kind: 'late' } | { kind: 'end' };

export type Tools = { berries: boolean; whistle: boolean; trap: boolean };
export type View = { x: number; y: number; zoom: number };
export const frameOf = (v: View) => { const fh = FRAME_H / v.zoom, fw = fh * ASPECT; return { x0: v.x - fw / 2, x1: v.x + fw / 2, y0: v.y - fh / 2, y1: v.y + fh / 2, fw, fh }; };

/** The size a creature is drawn and scored at in a pose: cubs are small, flyers spread their wings, loungers lie low. */
export function sizeOf(sp: Species, pose: Pose, cub = false) {
  const k = cub ? 0.55 : 1, wide = pose === 'fly' || pose === 'spread', low = pose === 'lie' || pose === 'roll';
  const w = sp.w * k * (wide ? (sp.kind === 'raptor' ? 2.4 : 1.6) : low ? 1.15 : 1);
  const h = sp.h * k * (low ? 0.6 : pose === 'fly' && sp.kind === 'raptor' ? 0.7 : pose === 'up' ? 1.12 : 1);
  return { w, h };
}
/** An animal's box in the world: centred over its feet. */
export function boxOf(a: Animal) { const { w, h } = sizeOf(a.sp, behaviourOf(a).pose, a.cub); return { w, h, cx: a.x, cy: a.y + h / 2 }; }

export type Score = { photo: Photo | null; reasons: string[] };

/** Scores one frame: subject size, framing, sharpness, facing, behaviour, company and light. */
export function scoreView(animals: Animal[], v: View, steady: number, ctx: { tr: TrailId; tm: TimeId; who: Who; day: number; id: string; trap?: boolean }): Photo | null {
  const F = frameOf(v);
  type Cand = Subject & { size: number; frame: number; sharp: number; fc: number; frac: number; motion: number; rare: boolean };
  const cands: Cand[] = [];
  for (const a of animals) {
    if (a.state === 'gone') continue;
    const b = boxOf(a), bx0 = b.cx - b.w / 2, bx1 = b.cx + b.w / 2, by0 = b.cy - b.h / 2, by1 = b.cy + b.h / 2;
    const ix = Math.max(0, Math.min(bx1, F.x1) - Math.max(bx0, F.x0)), iy = Math.max(0, Math.min(by1, F.y1) - Math.max(by0, F.y0));
    const vis = (ix * iy) / (b.w * b.h); if (vis < 0.6) continue;
    const frac = Math.max(b.w / F.fw, b.h / F.fh);
    const size = frac < 0.06 ? 0 : frac < 0.3 ? (frac - 0.06) / 0.24 : frac <= 0.72 ? 1 : frac <= 1 ? 1 - (frac - 0.72) * 1.6 : 0.4;
    const nx = (b.cx - v.x) / F.fw, ny = (v.y - b.cy) / F.fh;
    const centre = 0.9 * (1 - Math.hypot(nx, ny) / 0.3);
    const third = Math.min(...[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([sx, sy]) => Math.hypot(nx - sx / 6, ny - sy / 6)));
    const frame = clamp(Math.max(centre, 1 - third / 0.16), 0, 1) * vis * vis;
    const beh = behaviourOf(a), motion = a.state === 'flee' ? 1 : a.state === 'berry' ? 0.4 : a.alarm > 0.45 ? 0.05 : beh.motion;
    const sharp = clamp(1 - motion * 0.55 - (1 - steady) * (0.45 + 0.06 * v.zoom), 0, 1);
    const fc = a.face === 'toward' ? 1 : a.face === 'side' ? 0.6 : 0.15;
    cands.push({ sp: a.sp.id, bh: beh.id, nx: r2(nx), ny: r2(ny), sz: r2(b.h / F.fh), dir: a.dir, face: a.face, cub: a.cub || undefined, size, frame, sharp, fc, frac, motion, rare: beh.rare });
  }
  if (!cands.length) return null;
  const q = (c: Cand) => 0.28 * c.size + 0.24 * c.frame + 0.3 * c.sharp + 0.18 * c.fc;
  cands.sort((a, b) => q(b) + (b.rare ? 0.3 : 0) - q(a) - (a.rare ? 0.3 : 0));
  const m = cands[0], extras = cands.slice(1).filter((c) => c.frac >= 0.1);
  const light = LIGHT[ctx.tr][TI[ctx.tm]];
  let raw = 2.8 * q(m) + (m.rare ? 1.4 : 0.3) + Math.min(2, extras.length) * 0.35 + 0.7 * light;
  if (m.size === 0) raw = Math.min(raw, 0.4);
  else if (m.sharp < 0.35) raw = Math.min(raw, 1.4);
  const st = clamp(Math.floor(raw + 0.5), 0, 5);
  const strip = (c: Cand): Subject => ({ sp: c.sp, bh: c.bh, nx: c.nx, ny: c.ny, sz: c.sz, dir: c.dir, face: c.face, ...(c.cub ? { cub: true } : {}) });
  return {
    ...strip(m), st, pts: Math.round(clamp(raw / 5, 0, 1) * 100), tr: ctx.tr, tm: ctx.tm, who: ctx.who, ax: r2(v.x), ay: r2(v.y), z: r2(v.zoom), sharp: r2(m.sharp),
    k: [r2(m.size), r2(m.frame), r2(m.sharp), r2(m.fc)], ex: extras.slice(0, 3).map(strip), rare: m.rare, light: r2(light), day: ctx.day, id: ctx.id, ...(ctx.trap ? { trap: true } : {}),
  };
}

/** A kind word about a photo, picked from what went well and what could go better. */
export function comment(p: Photo | null): string {
  if (!p) return 'Lovely scenery! Nobody was in the frame this time.';
  const s = SPECIES_BY_ID[p.sp], b = s?.b.find((x) => x.id === p.bh), name = s ? s.name.toLowerCase() : 'friend', [size, frame, sharp, face] = p.k;
  const pick = (xs: string[]) => xs[(Math.abs(Math.round(p.ax * 7 + p.ay * 13 + p.z * 31)) + p.st) % xs.length];
  if (size === 0) return pick([`A tiny speck of ${name}. Creep closer or zoom in.`, `Is that a ${name}? Far, far away! Zoom in next time.`]);
  if (sharp < 0.35) return pick([`A wobbly ${name}! Stand still for a steadier shot.`, `Whoosh! Too much movement. Stop and let the camera settle.`]);
  if (p.st >= 5) return pick([`A masterpiece! ${b?.name ?? 'This'} will be the star of the journal.`, `Wow. Frame this one for the burrow wall!`, `Perfect timing, perfect light. Bravo!`]);
  if (p.rare) return pick([`A rare moment: ${b?.name.toLowerCase()}! Not many see that.`, `You caught it! ${b?.name} is a lucky sight.`]);
  if (face < 0.3) return pick([`A fine view of a ${name}'s back! A little patience and it may turn around.`, `${s?.name} was looking the other way. Maybe a whistle would help?`]);
  if (size < 0.5) return pick([`Nice, but the ${name} is small in the frame. Zoom in a touch.`, `A good start! Get a little closer to fill the frame.`]);
  if (frame < 0.4) return pick([`Try putting the ${name} in the middle, or on a third.`, `Lovely subject, a little off to the edge.`]);
  if (p.ex.length) return pick([`Friends together! Group photos are the best.`, `More than one in the frame: lovely.`]);
  if (p.light >= 0.7) return pick([`That golden light is gorgeous.`, `Soft, warm light. Beautiful.`]);
  return pick([`A clear, sweet photo of a ${name}.`, `Nicely framed and nice and sharp.`, `The ${name} looks very pleased with this one.`]);
}

/** Where a behaviour can be found, for the journal's empty slots. */
export function hint(s: Species, b: Behaviour): string {
  const when = b.w.every((x) => x > 0) || b.need === 'whistle' || b.need === 'berries' ? '' : TIMES.filter((_, i) => b.w[i] > 0).map((t) => t.name.toLowerCase()).join(' and ');
  const need: Record<Need, string> = { calm: 'when it feels calm: hide or keep very still', group: 'with friends nearby', berries: 'toss some berries', whistle: 'try a soft whistle', alone: 'only when nobody is near: a camera trap might see it' };
  return [b.rare ? 'Rare' : '', when ? `${when[0].toUpperCase()}${when.slice(1)}` : '', b.need ? need[b.need] : ''].filter(Boolean).join(' · ') || 'Common';
}

export const slotKey = (sp: string, bh: string) => `${sp}:${bh}`;
export const ALL_SLOTS = SPECIES.flatMap((s) => s.b.map((b) => slotKey(s.id, b.id)));
export const MAX_STARS = ALL_SLOTS.length * 5;

export class SafariGame {
  readonly trail: Trail; readonly time: TimeId; readonly who: Who; readonly tools: Tools; readonly seed: number; readonly day: number;
  t = 0; x = 4; dir: 1 | -1 = 1; moving: -1 | 0 | 1 = 0; pace: Pace = 'walk'; crouch = false; steady = 1;
  film = FILM; berries = 0; whistleAt = -99; berry: { x: number; until: number } | null = null;
  trap: { x: number; at: number; shots: Photo[]; last: number; back: boolean } | null = null;
  view: View = { x: 10, y: 1, zoom: 2 };
  animals: Animal[] = []; photos: Photo[] = []; events: SafariEvent[] = []; state: 'out' | 'done' = 'out';
  private r: () => number; private acc = 0; private lastSnap = -9; private shotN = 0; private warned = false;
  constructor(o: { trail: TrailId; time: TimeId; who?: Who; seed: number; tools?: Partial<Tools>; day?: number; groups?: number }) {
    this.seed = o.seed; this.r = rng(o.seed); this.time = o.time; this.who = o.who ?? 'dora'; this.day = o.day ?? 1;
    this.tools = { berries: false, whistle: false, trap: false, ...o.tools };
    this.berries = this.tools.berries ? BERRIES : 0;
    this.trail = layTrail(o.trail, o.time, this.r);
    this.populate(o.groups ?? GROUPS);
  }
  get ti() { return TI[this.time]; }
  /** Places the creature groups along the trail, each at a spot that suits it. */
  private populate(n: number) {
    const r = this.r, pool = SPECIES.filter((s) => (s.where[this.trail.id]?.[this.ti] ?? 0) > 0), used = new Map<string, number>();
    const span = (this.trail.len - 40) / n;
    for (let g = 0; g < n; g++) {
      const slot = 24 + span * (g + 0.2 + r() * 0.6);
      const ws = pool.map((s) => (s.where[this.trail.id]![this.ti]) / (1 + 2 * (used.get(s.id) ?? 0)));
      let pickAt = r() * ws.reduce((a, b) => a + b, 0), sp = pool[0];
      for (let i = 0; i < pool.length; i++) { pickAt -= ws[i]; if (pickAt <= 0) { sp = pool[i]; break; } }
      used.set(sp.id, (used.get(sp.id) ?? 0) + 1);
      let home = slot, baseY = 0;
      const want: FeatureKind | null = sp.spot === 'ground' ? null : sp.spot;
      if (want) {
        const near = this.trail.features.filter((f) => f.kind === want && Math.abs(f.x - slot) < span * 0.6).sort((a, b) => Math.abs(a.x - slot) - Math.abs(b.x - slot))[0];
        const f = near ?? { kind: want, x: r2(slot), w: want === 'water' ? 12 : 1.6, h: want === 'tree' ? 3.6 : want === 'rock' ? 1.2 : want === 'flower' ? 1.2 : 0 };
        if (!near) { this.trail.features.push(f); this.trail.features.sort((a, b) => a.x - b.x); }
        home = want === 'water' ? f.x + (r() - 0.5) * f.w * 0.5 : f.x;
        baseY = want === 'rock' ? f.h : want === 'tree' ? f.h * 0.72 : want === 'flower' ? f.h : 0;
      }
      const count = sp.group[0] + Math.floor(r() * (sp.group[1] - sp.group[0] + 1));
      for (let i = 0; i < count; i++) {
        const cub = (sp.id === 'bear' && i === 1);
        const a: Animal = {
          n: this.animals.length, sp, group: g, cub, x: r2(home + (i - (count - 1) / 2) * Math.max(0.8, sp.w * 1.1)), y: baseY, baseY, home, dir: r() < 0.5 ? 1 : -1, face: 'side', faceIn: 0,
          beh: 0, left: 0, target: home, alarm: 0, calm: 0, state: 'live', fleeFor: 0, seen: false,
        };
        this.animals.push(a); this.choose(a);
      }
    }
  }
  /** Whether a behaviour can start right now for this animal. */
  canDo(a: Animal, b: Behaviour) {
    if (b.cub && !a.cub) return false;
    switch (b.need) {
      case 'calm': return a.calm >= 0.6;
      case 'group': return this.animals.some((o) => o !== a && o.group === a.group && o.state === 'live' && Math.abs(o.x - a.x) < 6);
      case 'alone': return Math.abs(this.x - a.x) > REACH;
      case 'berries': case 'whistle': return false;
    }
    return true;
  }
  private choose(a: Animal, force?: number) {
    const r = this.r, list = a.sp.b;
    let i = force ?? -1;
    if (i < 0) {
      // herds keep together: most of the time a group member joins in with whatever a friend nearby is doing
      const lead = this.animals.find((o) => o !== a && o.group === a.group && o.state === 'live' && o.left > 2);
      if (lead && r() < FOLLOW && this.canDo(a, behaviourOf(lead)) && behaviourOf(lead).w[this.ti] > 0) i = lead.beh;
      else {
        const ws = list.map((b) => (this.canDo(a, b) ? b.w[this.ti] * (b.rare ? RARE : 1) : 0)), sum = ws.reduce((x, y) => x + y, 0);
        let at = r() * sum; i = 0;
        for (let k = 0; k < ws.length; k++) { at -= ws[k]; if (ws[k] > 0 && at <= 0) { i = k; break; } }
      }
    }
    a.beh = i; const b = list[i]; a.left = b.dur[0] + r() * (b.dur[1] - b.dur[0]);
    a.target = a.home + (r() - 0.5) * 2 * a.sp.range;
    if (b.id === 'sunglide') a.target = a.home + (r() < 0.5 ? -1 : 1) * 30;
    this.turn(a);
    if (b.rare) this.events.push({ kind: 'rare', sp: a.sp.id, bh: b.id });
  }
  private turn(a: Animal) { const b = behaviourOf(a), r = this.r(); a.face = r < b.face ? 'toward' : r < b.face + (1 - b.face) * 0.65 ? 'side' : 'away'; a.faceIn = 2 + this.r() * 3; }

  // ---- what the player does
  /** Walk left or right (0 to stop) at a pace. */
  move(dir: -1 | 0 | 1, pace?: Pace) { this.moving = dir; if (pace) this.pace = pace; if (dir) { this.dir = dir; this.crouch = false; } }
  /** Crouch: inside cover you are hidden; anywhere else it only steadies the camera. */
  hide(on: boolean) { this.crouch = on; if (on) this.moving = 0; }
  cover() { return this.trail.features.find((f) => f.kind === 'grass' && Math.abs(f.x - this.x) <= f.w / 2) ?? null; }
  get hidden() { return this.crouch && this.moving === 0 && !!this.cover(); }
  aim(x: number, y: number, zoom = this.view.zoom) {
    this.view = { x: clamp(x, this.x - REACH, this.x + REACH), y: clamp(y, 0, 8), zoom: clamp(zoom, ZOOM[0], ZOOM[1]) };
  }
  noise() {
    if (this.hidden) return 0;
    const base = this.moving ? NOISE[this.pace] : NOISE.still;
    return this.moving && this.cover() ? base * 0.6 : base;
  }
  preview(): Photo | null { return scoreView(this.animals, this.view, this.steady, this.ctx()); }
  private ctx(trap = false) { return { tr: this.trail.id, tm: this.time, who: this.who, day: this.day, id: `${this.seed}-${this.shotN}`, trap }; }
  /** Takes a photo of whatever is in the viewfinder. Uses one frame of film. */
  snap(): Photo | null | undefined {
    if (this.state !== 'out' || this.film <= 0 || this.t - this.lastSnap < 0.5) return undefined;
    this.film--; this.lastSnap = this.t;
    const p = scoreView(this.animals, this.view, this.steady, this.ctx()); this.shotN++;
    if (p) this.photos.push(p);
    // the shutter is a little click: very shy animals close by notice it
    for (const a of this.animals) if (a.state === 'live' && Math.abs(a.x - this.x) < 6) a.alarm += 0.08 * a.sp.shy;
    this.events.push({ kind: 'snap', photo: p });
    return p;
  }
  /** Tosses a handful of berries a few steps ahead. */
  toss() {
    if (this.state !== 'out' || this.berries <= 0 || this.berry) return false;
    this.berries--; this.berry = { x: r2(this.x + this.dir * 4), until: this.t + 25 };
    this.events.push({ kind: 'berries', x: this.berry.x }); return true;
  }
  /** A soft whistle: nearby animals look up, and some answer in their own way. */
  whistle() {
    if (this.state !== 'out' || !this.tools.whistle || this.t - this.whistleAt < WHISTLE_COOLDOWN) return false;
    this.whistleAt = this.t;
    for (const a of this.animals) {
      if (a.state !== 'live' || Math.abs(a.x - this.x) > REACH) continue;
      const i = a.sp.b.findIndex((b) => b.need === 'whistle');
      if (i >= 0) this.choose(a, i); else { a.face = 'toward'; a.faceIn = 2.5; }
      a.alarm += 0.1 * a.sp.shy * (this.hidden ? 0.3 : 1);
    }
    this.events.push({ kind: 'whistle' }); return true;
  }
  /** Sets the camera trap down here. It takes up to three photos when an animal wanders past and nobody is near. */
  placeTrap() {
    if (this.state !== 'out' || !this.tools.trap || this.trap) return false;
    this.trap = { x: r2(this.x), at: this.t, shots: [], last: -9, back: false };
    this.events.push({ kind: 'trap', x: this.trap.x }); return true;
  }
  /** Heads home, ending the outing. A camera trap left out comes home empty. */
  home() {
    if (this.state !== 'out') return;
    this.state = 'done';
    this.events.push({ kind: 'end' });
  }
  get trapLost() { return !!this.trap && !this.trap.back && this.trap.shots.length > 0; }
  get dayLeft() { return Math.max(0, DAY - this.t); }

  /** Advances by real seconds in fixed steps. */
  tick(dt: number) { this.acc += Math.min(dt, 0.25); while (this.acc >= DT && this.state === 'out') { this.acc -= DT; this.step(); } }
  step() {
    if (this.state !== 'out') return;
    const dt = DT; this.t += dt;
    // walking
    if (this.moving) this.x = clamp(this.x + this.moving * PACE_SPEED[this.pace] * dt, 0, this.trail.len);
    const target = this.hidden || this.crouch ? 1 : this.moving ? STEADY[this.pace] : STEADY.still;
    this.steady = target > this.steady ? Math.min(target, this.steady + dt * (this.hidden || this.crouch ? 1.2 : 0.8)) : Math.max(target, this.steady - dt * 4);
    if (this.berry && this.t > this.berry.until) this.berry = null;
    const noise = this.noise(), quiet = !this.moving || this.hidden;
    for (const a of this.animals) this.creature(a, dt, noise, quiet);
    // the camera trap
    const tp = this.trap;
    if (tp && !tp.back) {
      if (Math.abs(this.x - tp.x) > 8 && tp.shots.length < TRAP_FRAMES && this.t - tp.last >= 4 && this.t - tp.at > 3) {
        const v: View = { x: tp.x, y: 1, zoom: TRAP_ZOOM };
        const near = this.animals.some((a) => a.state === 'live' && Math.abs(a.x - tp.x) < TRAP_REACH && a.y < 2);
        const p = near ? scoreView(this.animals, v, 1, this.ctx(true)) : null;
        if (p && p.st >= 2) { this.shotN++; tp.shots.push(p); tp.last = this.t; this.events.push({ kind: 'trapShot' }); }
      }
      if (this.t - tp.at > 5 && Math.abs(this.x - tp.x) < 1.5) { tp.back = true; this.photos.push(...tp.shots); this.events.push({ kind: 'trapBack', n: tp.shots.length }); }
    }
    if (!this.warned && this.t >= DAY - 45) { this.warned = true; this.events.push({ kind: 'late' }); }
    if (this.t >= DAY) this.home();
  }
  private creature(a: Animal, dt: number, noise: number, quiet: boolean) {
    if (a.state === 'gone') return;
    const b = behaviourOf(a), d = Math.abs(a.x - this.x) + Math.max(0, a.y - 3) * 0.5;
    if (d < 16) a.seen = true;
    if (a.state === 'flee') {
      a.fleeFor -= dt; const away = a.x >= this.x ? 1 : -1; a.dir = away;
      a.x += away * (a.sp.kind === 'raptor' || a.sp.kind === 'bird' || a.sp.kind === 'wader' ? 3 : 4) * dt;
      if (a.sp.kind === 'bird' || a.sp.kind === 'raptor' || a.sp.kind === 'wader' || a.sp.kind === 'duck') a.y += 1.6 * dt;
      if (a.fleeFor <= 0) a.state = 'gone';
      return;
    }
    // noticing you
    const shy = a.sp.shy, reach = 4 + 16 * shy;
    let up = d < reach ? noise * (1 - d / reach) * (0.3 + 1.5 * shy) : 0;
    if (!this.hidden && d < 1.2 + 2.5 * shy && b.need !== 'berries' && a.state !== 'berry') up += 0.3 * shy;
    a.alarm = Math.max(0, a.alarm + (up - 0.12) * dt);
    if (a.alarm >= 1) { a.state = 'flee'; a.fleeFor = 2.5; a.face = 'side'; this.events.push({ kind: 'flee', sp: a.sp.id }); return; }
    if (d < 18 && a.alarm < 0.3) {
      if (this.hidden) a.calm += dt * CALM.hidden; else if (!this.moving) a.calm += dt * CALM.still; else if (this.pace !== 'tiptoe') a.calm -= dt * 0.08;
    }
    a.calm = clamp(a.calm, 0, 1);
    // berries draw the berry-lovers in
    const ber = this.berry, likes = a.sp.likes || a.sp.b.some((x) => x.need === 'berries');
    if (ber && likes && a.state === 'live' && a.alarm < 0.5 && Math.abs(a.x - ber.x) < 12 && b.need !== 'berries') a.state = 'berry';
    if (a.state === 'berry') {
      if (!ber) { a.state = 'live'; this.choose(a); return; }
      const gap = ber.x - a.x; a.dir = gap >= 0 ? 1 : -1;
      if (a.y > 0) a.y = Math.max(0, a.y - 1.5 * dt);
      if (Math.abs(gap) > 0.5) { a.x += Math.sign(gap) * Math.min(Math.abs(gap), 1.1 * dt); return; }
      a.state = 'live'; const i = a.sp.b.findIndex((x) => x.need === 'berries');
      this.choose(a, i >= 0 ? i : a.sp.b.findIndex((x) => x.pose === 'eat') >= 0 ? a.sp.b.findIndex((x) => x.pose === 'eat') : 0);
      a.left = Math.max(a.left, 8); a.home = a.x; return;
    }
    // looking at you when uneasy: frozen and facing the camera
    if (a.alarm > 0.45) { a.face = 'toward'; a.dir = this.x >= a.x ? 1 : -1; return; }
    a.left -= dt; a.faceIn -= dt;
    if (a.faceIn <= 0) this.turn(a);
    if (b.move) {
      const gap = a.target - a.x;
      if (Math.abs(gap) < 0.2) a.target = a.home + (this.r() - 0.5) * 2 * a.sp.range * (b.fly ? 3 : 1);
      else { a.x += Math.sign(gap) * Math.min(Math.abs(gap), b.move * dt); if (a.face !== 'toward') a.dir = gap >= 0 ? 1 : -1; }
    } else if (b.approach) {
      const gap = this.x - a.x; if (Math.abs(gap) > 3.5) a.x += Math.sign(gap) * 0.5 * dt; a.dir = gap >= 0 ? 1 : -1;
    }
    if (a.face === 'toward') a.dir = this.x >= a.x ? 1 : -1;
    const wantY = b.fly ? (a.sp.kind === 'raptor' || b.leave || b.id === 'climb' ? b.fly : a.baseY + (b.fly - 1.2) * 0.5) : a.baseY;
    if (a.y !== wantY) a.y = a.y < wantY ? Math.min(wantY, a.y + 1.4 * dt) : Math.max(wantY, a.y - 1.4 * dt);
    if (a.left <= 0) {
      if (b.leave) { a.state = 'gone'; return; }
      // a whistle or berry behaviour finishes back into ordinary life
      this.choose(a);
    }
  }
}
/** How many creature groups live along each trail per outing. */
export const GROUPS = 5;
/** How often a group member copies a friend's behaviour, and how much rarer the rare behaviours are picked. */
export const FOLLOW = 0.7, RARE = 0.6;
/** How fast an animal calms down each second while you hide nearby, or simply stand still. */
export const CALM = { hidden: 0.05, still: 0.025 };

// ---- the field journal and the save
export const SAVE_KEY = 'snapshot-safari-v1';
export type Profile = {
  journal: Record<string, Photo>; outings: number; shots: number; bestRoll: number; best: Photo | null;
  who: Who; trail: TrailId; time: TimeId; sound: boolean; seen: string[];
};
export const freshProfile = (): Profile => ({ journal: {}, outings: 0, shots: 0, bestRoll: 0, best: null, who: 'dora', trail: 'puna', time: 'morning', sound: true, seen: [] });
const isTrail = (x: unknown): x is TrailId => TRAILS.some((t) => t.id === x);
const isTime = (x: unknown): x is TimeId => TIMES.some((t) => t.id === x);
const num = (x: unknown, lo: number, hi: number) => typeof x === 'number' && Number.isFinite(x) && x >= lo && x <= hi;
function cleanSubject(o: unknown): Subject | null {
  if (!o || typeof o !== 'object') return null; const s = o as Record<string, unknown>, sp = SPECIES_BY_ID[s.sp as string];
  if (!sp || !sp.b.some((b) => b.id === s.bh) || !num(s.nx, -2, 2) || !num(s.ny, -2, 2) || !num(s.sz, 0, 10)) return null;
  const face: Facing = s.face === 'toward' || s.face === 'away' ? s.face : 'side';
  return { sp: sp.id, bh: s.bh as string, nx: s.nx as number, ny: s.ny as number, sz: s.sz as number, dir: s.dir === -1 ? -1 : 1, face, ...(s.cub === true ? { cub: true } : {}) };
}
/** Checks a saved photo field by field; anything odd is dropped. */
export function cleanPhoto(o: unknown): Photo | null {
  const sub = cleanSubject(o); if (!sub) return null; const p = o as Record<string, unknown>;
  if (!num(p.st, 0, 5) || !Number.isInteger(p.st) || !isTrail(p.tr) || !isTime(p.tm) || !Array.isArray(p.k) || p.k.length !== 4 || !p.k.every((v) => num(v, 0, 1))) return null;
  if (!num(p.ax, -50, 400) || !num(p.ay, -5, 20) || !num(p.z, ZOOM[0], ZOOM[1]) || !num(p.sharp, 0, 1)) return null;
  const ex = Array.isArray(p.ex) ? p.ex.map(cleanSubject).filter((x): x is Subject => !!x).slice(0, 3) : [];
  const b = SPECIES_BY_ID[sub.sp].b.find((x) => x.id === sub.bh)!;
  return {
    ...sub, st: p.st as number, pts: num(p.pts, 0, 100) ? (p.pts as number) : 0, tr: p.tr as TrailId, tm: p.tm as TimeId, who: p.who === 'enzo' ? 'enzo' : 'dora',
    ax: p.ax as number, ay: p.ay as number, z: p.z as number, sharp: p.sharp as number, k: p.k as [number, number, number, number], ex, rare: b.rare,
    light: num(p.light, 0, 1) ? (p.light as number) : 0, day: num(p.day, 0, 1e6) ? (p.day as number) : 0, id: typeof p.id === 'string' ? p.id.slice(0, 40) : '', ...(p.trap === true ? { trap: true } : {}),
  };
}
/** Reads a save, keeping only what makes sense; anything broken starts afresh. */
export function readProfile(raw: string | null): Profile {
  const p = freshProfile(); if (!raw) return p;
  try {
    const o = JSON.parse(raw) as Record<string, unknown>; if (!o || typeof o !== 'object' || Array.isArray(o)) return p;
    if (o.journal && typeof o.journal === 'object') for (const [k, v] of Object.entries(o.journal as Record<string, unknown>)) {
      const ph = cleanPhoto(v); if (ph && slotKey(ph.sp, ph.bh) === k) p.journal[k] = ph;
    }
    if (num(o.outings, 0, 1e6)) p.outings = Math.floor(o.outings as number);
    if (num(o.shots, 0, 1e8)) p.shots = Math.floor(o.shots as number);
    if (num(o.bestRoll, 0, 1e4)) p.bestRoll = Math.floor(o.bestRoll as number);
    p.best = cleanPhoto(o.best);
    p.who = o.who === 'enzo' ? 'enzo' : 'dora'; p.sound = o.sound !== false;
    if (isTrail(o.trail)) p.trail = o.trail; if (isTime(o.time)) p.time = o.time;
    if (Array.isArray(o.seen)) p.seen = [...new Set(o.seen.filter((s): s is string => typeof s === 'string' && !!SPECIES_BY_ID[s]))];
  } catch { return freshProfile(); }
  if (!isOpen(p, p.trail)) p.trail = 'puna';
  if (!isOpen(p, p.time)) p.time = 'morning';
  return p;
}
export const journalStars = (p: Profile) => Object.values(p.journal).reduce((n, x) => n + x.st, 0);
export const slotsFilled = (p: Profile) => Object.keys(p.journal).length;
/** Morning and the Puna Grassland are always open; everything else waits for journal stars. */
export function isOpen(p: Profile, id: string) { const u = UNLOCKS.find((x) => x.id === id); return !u || journalStars(p) >= u.need; }
export const nextUnlock = (p: Profile) => UNLOCKS.find((u) => journalStars(p) < u.need) ?? null;
export const toolsFor = (p: Profile): Tools => ({ berries: isOpen(p, 'berries'), whistle: isOpen(p, 'whistle'), trap: isOpen(p, 'trap') });

export type Developed = { photo: Photo; slot: string; isNew: boolean; better: boolean; keep: boolean };
/** The "developing" step: each photo, whether its slot is new or it beats the journal, and a suggestion to keep the best per slot. */
export function develop(p: Profile, photos: Photo[]): Developed[] {
  const best = new Map<string, Photo>();
  for (const ph of photos) { const k = slotKey(ph.sp, ph.bh), b = best.get(k); if (!b || ph.st > b.st || (ph.st === b.st && ph.pts > b.pts)) best.set(k, ph); }
  return photos.map((ph) => {
    const slot = slotKey(ph.sp, ph.bh), had = p.journal[slot];
    const isNew = !had, better = !!had && (ph.st > had.st || (ph.st === had.st && ph.pts > had.pts));
    return { photo: ph, slot, isNew, better, keep: best.get(slot) === ph && (isNew || better) && ph.st > 0 };
  });
}
/** Pastes the chosen photos into the journal and records the outing. Returns kind news for the results screen. */
export function paste(p: Profile, all: Photo[], keep: Photo[]): string[] {
  const before = journalStars(p), news: string[] = [];
  let fresh = 0;
  for (const ph of keep) {
    if (ph.st <= 0) continue;
    const k = slotKey(ph.sp, ph.bh), had = p.journal[k];
    if (!had) fresh++;
    if (!had || ph.st > had.st || (ph.st === had.st && ph.pts > had.pts)) p.journal[k] = ph;
  }
  p.outings++; p.shots += all.length;
  const roll = all.reduce((n, x) => n + x.st, 0); p.bestRoll = Math.max(p.bestRoll, roll);
  for (const ph of all) { if (!p.best || ph.st > p.best.st || (ph.st === p.best.st && ph.pts > p.best.pts)) p.best = ph; if (!p.seen.includes(ph.sp)) p.seen.push(ph.sp); }
  const after = journalStars(p);
  if (fresh) news.push(`${fresh} NEW PAGE${fresh > 1 ? ' SLOTS' : ' SLOT'}`);
  for (const u of UNLOCKS) if (before < u.need && after >= u.need) news.push(`UNLOCKED: ${u.name.toUpperCase()}`);
  if (slotsFilled(p) === ALL_SLOTS.length && fresh) news.push('THE JOURNAL IS COMPLETE!');
  return news;
}
