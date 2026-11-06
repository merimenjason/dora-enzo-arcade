// Burrow Clinic: the data. Rooms and their machines, the silly (always harmless) ailments, the Andean patients, staff
// roles and traits, decorations, and the six clinics of the campaign plus the sandbox. Rules live in clinic-game.ts.

export type RoomKind = 'reception' | 'checkup' | 'staff' | 'fluff' | 'hiccup' | 'ears' | 'steam' | 'dust' | 'comb' | 'dark' | 'hammock' | 'lamp';
export type Role = 'vet' | 'nurse' | 'cleaner' | 'recep';
export type Trait = 'quick' | 'careful' | 'cheery' | 'sleepy';
export type AilmentId = 'static' | 'hiccups' | 'ears' | 'sneezes' | 'dust' | 'tangle' | 'glow' | 'puff' | 'spots';
export type SpeciesId = 'pudu' | 'guanaco' | 'vizcacha' | 'flamingo' | 'alpaca' | 'fox' | 'armadillo' | 'condor';
export type DecoKind = 'bench' | 'plant' | 'cactus' | 'cooler' | 'vending' | 'bin' | 'lamp' | 'rug' | 'table' | 'heater';
export type Pose = 'sit' | 'lie' | 'stand';

export interface RoomDef {
  id: RoomKind; name: string; blurb: string; cost: number; minW: number; minH: number;
  /** who has to be in the room for it to work (null: nobody) */
  staff: Role | null;
  /** the machine sprite drawn in the room */
  machine: string;
  /** what a patient does on the machine */
  pose: Pose;
  /** base ticks for one treatment, diagnosis or desk visit */
  work: number;
  /** a ward has one bed per four floor tiles (up to four); every other room treats one patient at a time */
  ward?: boolean;
  floor: string;
  sound: 'whirr' | 'boing' | 'puff' | 'bubble' | 'buzz' | 'bell' | 'hum' | 'none';
}

export const ROOMS: Record<RoomKind, RoomDef> = {
  reception: { id: 'reception', name: 'Reception', blurb: 'Every patient checks in here first. Needs a receptionist.', cost: 300, minW: 3, minH: 3, staff: 'recep', machine: 'desk', pose: 'stand', work: 18, floor: 'terrazzo', sound: 'bell' },
  checkup: { id: 'checkup', name: 'Check-up Room', blurb: 'A vet works out what is wrong. Better vets are quicker and guess right more often.', cost: 450, minW: 3, minH: 3, staff: 'vet', machine: 'exam', pose: 'sit', work: 55, floor: 'lino', sound: 'none' },
  staff: { id: 'staff', name: 'Staff Room', blurb: 'Tired staff put their feet up here and come back fresh.', cost: 350, minW: 3, minH: 3, staff: null, machine: 'sofa', pose: 'sit', work: 0, floor: 'parquet', sound: 'none' },
  fluff: { id: 'fluff', name: 'Fluff-Dryer', blurb: 'A warm hood that smooths crackly Static Fluff. Needs a vet.', cost: 650, minW: 3, minH: 3, staff: 'vet', machine: 'dryer', pose: 'sit', work: 90, floor: 'checker', sound: 'whirr' },
  hiccup: { id: 'hiccup', name: 'Hiccup Jar', blurb: 'Catches every echoing hiccup in a big bubbly jar. Needs a vet.', cost: 800, minW: 3, minH: 3, staff: 'vet', machine: 'jar', pose: 'stand', work: 100, floor: 'checker', sound: 'boing' },
  ears: { id: 'ears', name: 'Ear-Flipper', blurb: 'A springy chair that gently flips Upside-Down Ears the right way up. Needs a vet.', cost: 900, minW: 3, minH: 3, staff: 'vet', machine: 'flipper', pose: 'sit', work: 100, floor: 'checker', sound: 'boing' },
  steam: { id: 'steam', name: 'Steam Booth', blurb: 'Warm steam melts Snowball Sneezes. Needs a vet.', cost: 950, minW: 3, minH: 3, staff: 'vet', machine: 'steam', pose: 'stand', work: 100, floor: 'lino', sound: 'puff' },
  dust: { id: 'dust', name: 'Dust-Bath Ward', blurb: 'A proper roll in soft sand settles Dust-Bath Fever. A nurse looks after every tub at once.', cost: 1100, minW: 4, minH: 3, staff: 'nurse', machine: 'tub', pose: 'lie', work: 150, ward: true, floor: 'terrazzo', sound: 'bubble' },
  comb: { id: 'comb', name: 'Comb Station', blurb: 'A giant comb teases out Tangle Tail. Needs a nurse.', cost: 950, minW: 3, minH: 3, staff: 'nurse', machine: 'comb', pose: 'stand', work: 100, floor: 'parquet', sound: 'whirr' },
  dark: { id: 'dark', name: 'Dark Room', blurb: 'A starry booth where Glow Whiskers rest until they stop glowing. Needs a vet.', cost: 1000, minW: 3, minH: 3, staff: 'vet', machine: 'booth', pose: 'stand', work: 110, floor: 'lino', sound: 'hum' },
  hammock: { id: 'hammock', name: 'Deflating Hammock', blurb: 'A gentle sway lets the air out of Puff-Up. A nurse looks after every hammock at once.', cost: 1200, minW: 4, minH: 3, staff: 'nurse', machine: 'hammock', pose: 'lie', work: 160, ward: true, floor: 'parquet', sound: 'puff' },
  lamp: { id: 'lamp', name: 'Bright Lamp Room', blurb: 'A sunny lamp chases away Sleepy Spots. Needs a vet.', cost: 1050, minW: 3, minH: 3, staff: 'vet', machine: 'sunlamp', pose: 'sit', work: 100, floor: 'checker', sound: 'buzz' },
};
export const ROOM_ORDER: RoomKind[] = ['reception', 'checkup', 'staff', 'fluff', 'hiccup', 'ears', 'steam', 'dust', 'comb', 'dark', 'hammock', 'lamp'];

export interface AilmentDef { id: AilmentId; name: string; blurb: string; room: RoomKind; fee: number }
export const AILMENTS: Record<AilmentId, AilmentDef> = {
  static: { id: 'static', name: 'Static Fluff', blurb: 'Their fur crackles with tiny sparks.', room: 'fluff', fee: 90 },
  hiccups: { id: 'hiccups', name: 'Echo Hiccups', blurb: 'Every hiccup echoes twice.', room: 'hiccup', fee: 110 },
  ears: { id: 'ears', name: 'Upside-Down Ears', blurb: 'Their ears have flipped the wrong way up.', room: 'ears', fee: 120 },
  sneezes: { id: 'sneezes', name: 'Snowball Sneezes', blurb: 'Each sneeze is a tiny snowball.', room: 'steam', fee: 125 },
  dust: { id: 'dust', name: 'Dust-Bath Fever', blurb: 'They keep rolling on the floor for a dust bath.', room: 'dust', fee: 150 },
  tangle: { id: 'tangle', name: 'Tangle Tail', blurb: 'Their tail has tied itself in a knot.', room: 'comb', fee: 130 },
  glow: { id: 'glow', name: 'Glow Whiskers', blurb: 'Their whiskers glow like night lights.', room: 'dark', fee: 140 },
  puff: { id: 'puff', name: 'Puff-Up', blurb: 'They have puffed up as round as a cloud.', room: 'hammock', fee: 160 },
  spots: { id: 'spots', name: 'Sleepy Spots', blurb: 'Sleepy spots make them yawn and nod off.', room: 'lamp', fee: 145 },
};
export const AILMENT_ORDER: AilmentId[] = ['static', 'hiccups', 'ears', 'sneezes', 'dust', 'tangle', 'glow', 'puff', 'spots'];

export interface SpeciesDef { id: SpeciesId; name: string; plural: string; speed: number; patience: number }
export const SPECIES: Record<SpeciesId, SpeciesDef> = {
  pudu: { id: 'pudu', name: 'pudú', plural: 'pudús', speed: 1, patience: 1 },
  guanaco: { id: 'guanaco', name: 'guanaco', plural: 'guanacos', speed: 1.1, patience: 1 },
  vizcacha: { id: 'vizcacha', name: 'vizcacha', plural: 'vizcachas', speed: 0.95, patience: 1.1 },
  flamingo: { id: 'flamingo', name: 'flamingo', plural: 'flamingos', speed: 1, patience: 0.95 },
  alpaca: { id: 'alpaca', name: 'alpaca', plural: 'alpacas', speed: 0.95, patience: 1.1 },
  fox: { id: 'fox', name: 'culpeo fox', plural: 'culpeo foxes', speed: 1.15, patience: 0.9 },
  armadillo: { id: 'armadillo', name: 'armadillo', plural: 'armadillos', speed: 0.85, patience: 1.15 },
  condor: { id: 'condor', name: 'condor', plural: 'condors', speed: 1, patience: 0.9 },
};
export const PATIENT_SPECIES: SpeciesId[] = ['pudu', 'guanaco', 'vizcacha', 'flamingo', 'alpaca', 'fox', 'armadillo'];

export const ROLES: Record<Role, { name: string; plural: string; blurb: string; wage: number; looks: [string, string] }> = {
  vet: { name: 'Vet', plural: 'Vets', blurb: 'Diagnose patients and run most cure rooms.', wage: 1, looks: ['vet-a', 'vet-b'] },
  nurse: { name: 'Nurse', plural: 'Nurses', blurb: 'Run the wards and the Comb Station.', wage: 0.85, looks: ['nurse-a', 'nurse-b'] },
  cleaner: { name: 'Cleaner', plural: 'Cleaners', blurb: 'Sweep litter, fix machines and water plants.', wage: 0.6, looks: ['clean-a', 'clean-b'] },
  recep: { name: 'Receptionist', plural: 'Receptionists', blurb: 'Check patients in at Reception.', wage: 0.65, looks: ['recep-a', 'recep-b'] },
};
export const ROLE_ORDER: Role[] = ['recep', 'vet', 'nurse', 'cleaner'];
export const TRAITS: Record<Trait, { name: string; blurb: string; wage: number }> = {
  quick: { name: 'Quick', blurb: 'Works a quarter faster.', wage: 1.15 },
  careful: { name: 'Careful', blurb: 'Fewer wrong guesses, and machines wear more slowly.', wage: 1.1 },
  cheery: { name: 'Cheery', blurb: 'Patients nearby stay patient for longer.', wage: 1.05 },
  sleepy: { name: 'Sleepy', blurb: 'Needs more breaks, but asks for less.', wage: 0.8 },
};
export const FUR: Record<string, string> = { 'vet-a': 'white', 'vet-b': 'black-velvet', 'nurse-a': 'beige', 'nurse-b': 'silver', 'clean-a': 'brown', 'clean-b': 'beige', 'recep-a': 'silver', 'recep-b': 'white' };

/** `facings`: 4 for things with a front and a back (a back view is painted), 1 for round things that look the same from
 *  every side; `front`: the way the painting's front faces (0 +x, 1 +y, 2 -x, 3 -y, as the movers' dir). Every front
 *  painting faces +y (down and left on screen); mirrored it faces +x, and the back paintings give -x and -y */
export interface DecoDef { id: DecoKind; name: string; blurb: string; cost: number; blocks: boolean; seats?: number; facings: 1 | 4; front: number }
export const DECOS: Record<DecoKind, DecoDef> = {
  bench: { id: 'bench', name: 'Bench', blurb: 'Two seats. Sitting patients wait twice as patiently.', cost: 60, blocks: false, seats: 2, facings: 4, front: 1 },
  plant: { id: 'plant', name: 'Leafy Plant', blurb: 'Cheers up patients nearby while it is watered.', cost: 50, blocks: true, facings: 1, front: 1 },
  cactus: { id: 'cactus', name: 'Cactus', blurb: 'A little cheer that never needs water.', cost: 40, blocks: true, facings: 1, front: 1 },
  cooler: { id: 'cooler', name: 'Water Cooler', blurb: 'Thirsty patients drink here for free.', cost: 120, blocks: true, facings: 4, front: 1 },
  vending: { id: 'vending', name: 'Drinks Cart', blurb: 'Thirsty patients buy a drink here: 15 coins a cup.', cost: 200, blocks: true, facings: 4, front: 1 },
  bin: { id: 'bin', name: 'Litter Bin', blurb: 'Patients nearby drop far less litter.', cost: 30, blocks: true, facings: 1, front: 1 },
  lamp: { id: 'lamp', name: 'Floor Lamp', blurb: 'A warm glow that cheers patients a little.', cost: 50, blocks: true, facings: 1, front: 1 },
  rug: { id: 'rug', name: 'Round Rug', blurb: 'Cosy underfoot: a little cheer, and you can walk on it.', cost: 40, blocks: false, facings: 1, front: 1 },
  table: { id: 'table', name: 'Magazine Table', blurb: 'Something to read: a little cheer.', cost: 45, blocks: true, facings: 1, front: 1 },
  heater: { id: 'heater', name: 'Heater', blurb: 'Keeps patients warm nearby. Essential on the Summit.', cost: 150, blocks: true, facings: 4, front: 1 },
};
export const DECO_ORDER: DecoKind[] = ['bench', 'plant', 'cactus', 'cooler', 'vending', 'bin', 'lamp', 'rug', 'table', 'heater'];

export type Twist = 'tutorial' | 'thirst' | 'rain' | 'plants' | 'heat' | 'cold' | 'sandbox';
export interface ClinicDef {
  id: string; index: number; name: string; place: string; blurb: string; twist: Twist; twistText: string;
  w: number; h: number; door: number; ground: string; backdrop: string;
  coins: number; days: number; fastDay: number; starRep: number;
  goals: { cures: number; rep: number; coins: number };
  rooms: RoomKind[]; decos: DecoKind[];
  /** ailments and the day each starts turning up */
  ailments: [AilmentId, number][];
  /** patients an hour at reputation 50 */
  arrive: number;
  /** waiting patience drain multiplier (lower is kinder) */
  patience: number;
  /** scheduled events: [day, hour, kind, detail] */
  events: [number, number, 'emergency' | 'inspector' | 'vip' | 'breakdown', AilmentId | null][];
  /** chance a day gets one extra random event (after day 2) */
  eventChance: number;
}

const BASIC: DecoKind[] = ['bench', 'plant', 'cactus', 'cooler', 'bin', 'lamp', 'rug', 'table'];
export const CLINICS: ClinicDef[] = [
  {
    id: 'burrow', index: 0, name: 'Burrow Clinic', place: 'the green foothills', blurb: 'Dora and Enzo’s very first clinic, dug into a grassy hill. Enzo will show you the ropes.',
    twist: 'tutorial', twistText: 'Step-by-step notes from Enzo. Patients only arrive once you are ready, and nothing here can be lost by being slow.',
    w: 15, h: 12, door: 7, ground: 'grass', backdrop: 'bg1', coins: 4000, days: 7, fastDay: 5, starRep: 70,
    goals: { cures: 70, rep: 65, coins: 4500 }, rooms: ['reception', 'checkup', 'staff', 'fluff', 'hiccup'], decos: BASIC,
    ailments: [['static', 1], ['hiccups', 3]], arrive: 2.6, patience: 0.6,
    events: [[3, 3, 'emergency', 'static'], [4, 2, 'inspector', null], [5, 4, 'vip', null]], eventChance: 0.1,
  },
  {
    id: 'salt', index: 1, name: 'Salt Flat', place: 'the great white salt flat', blurb: 'A sunny clinic on the dazzling salt. Everyone arrives thirsty.',
    twist: 'thirst', twistText: 'Patients get thirsty twice as fast here: water coolers and drinks carts keep them patient (and carts earn coins).',
    w: 16, h: 13, door: 8, ground: 'salt', backdrop: 'bg2', coins: 4500, days: 8, fastDay: 6, starRep: 70,
    goals: { cures: 100, rep: 70, coins: 6500 }, rooms: ['reception', 'checkup', 'staff', 'fluff', 'hiccup', 'ears'], decos: [...BASIC, 'vending'],
    ailments: [['static', 1], ['hiccups', 1], ['ears', 2]], arrive: 3.0, patience: 0.8,
    events: [[3, 3, 'emergency', 'ears'], [4, 2, 'inspector', null], [5, 5, 'breakdown', null], [6, 3, 'vip', null]], eventChance: 0.2,
  },
  {
    id: 'lake', index: 2, name: 'Lakeside', place: 'the blue mountain lake', blurb: 'A clinic on stilts by the lake, with reed boats bobbing past.',
    twist: 'rain', twistText: 'Rainy days keep patients away, then the sun comes out and they all arrive at once.',
    w: 18, h: 14, door: 9, ground: 'pebbles', backdrop: 'bg3', coins: 5500, days: 9, fastDay: 6, starRep: 70,
    goals: { cures: 120, rep: 70, coins: 9000 }, rooms: ['reception', 'checkup', 'staff', 'fluff', 'hiccup', 'ears', 'steam', 'dust'], decos: [...BASIC, 'vending'],
    ailments: [['static', 1], ['hiccups', 1], ['ears', 1], ['sneezes', 2], ['dust', 3]], arrive: 3.2, patience: 0.85,
    events: [[3, 4, 'emergency', 'sneezes'], [4, 2, 'inspector', null], [5, 3, 'vip', null], [7, 3, 'emergency', 'dust']], eventChance: 0.2,
  },
  {
    id: 'forest', index: 3, name: 'Cloud Forest', place: 'the misty cloud forest', blurb: 'A wooden clinic among giant ferns and drifting clouds.',
    twist: 'plants', twistText: 'Plants grow fast and dry out three times quicker, but a watered plant cheers patients twice as much.',
    w: 19, h: 15, door: 9, ground: 'moss', backdrop: 'bg4', coins: 6000, days: 10, fastDay: 7, starRep: 72,
    goals: { cures: 160, rep: 72, coins: 13000 }, rooms: ['reception', 'checkup', 'staff', 'fluff', 'hiccup', 'ears', 'steam', 'dust', 'comb', 'dark'], decos: [...BASIC, 'vending'],
    ailments: [['static', 1], ['hiccups', 1], ['ears', 1], ['sneezes', 1], ['dust', 2], ['tangle', 2], ['glow', 3]], arrive: 3.4, patience: 0.9,
    events: [[3, 3, 'emergency', 'tangle'], [4, 2, 'inspector', null], [5, 4, 'breakdown', null], [6, 3, 'vip', null], [8, 2, 'emergency', 'glow']], eventChance: 0.25,
  },
  {
    id: 'springs', index: 4, name: 'Hot Springs', place: 'the steaming hot springs', blurb: 'A stone clinic among bubbling turquoise pools.',
    twist: 'heat', twistText: 'The warm air makes machines wear out twice as fast: keep cleaners on hand to fix them.',
    w: 20, h: 15, door: 10, ground: 'sand', backdrop: 'bg5', coins: 6500, days: 10, fastDay: 7, starRep: 72,
    goals: { cures: 170, rep: 70, coins: 13000 }, rooms: ['reception', 'checkup', 'staff', 'fluff', 'hiccup', 'ears', 'steam', 'dust', 'comb', 'dark', 'hammock'], decos: [...BASIC, 'vending'],
    ailments: [['static', 1], ['hiccups', 1], ['ears', 1], ['sneezes', 1], ['dust', 1], ['tangle', 2], ['glow', 2], ['puff', 3]], arrive: 3.5, patience: 0.9,
    events: [[2, 5, 'breakdown', null], [3, 3, 'emergency', 'puff'], [4, 2, 'inspector', null], [6, 3, 'vip', null], [8, 3, 'emergency', 'static']], eventChance: 0.25,
  },
  {
    id: 'summit', index: 5, name: 'Summit', place: 'the snowy summit', blurb: 'A snug stone hut high in the snow, with condors gliding past the window.',
    twist: 'cold', twistText: 'It is cold up here: patients far from a heater lose patience faster. Place heaters near the queues.',
    w: 21, h: 16, door: 10, ground: 'snow', backdrop: 'bg6', coins: 7500, days: 11, fastDay: 8, starRep: 75,
    goals: { cures: 180, rep: 60, coins: 11000 }, rooms: ['reception', 'checkup', 'staff', 'fluff', 'hiccup', 'ears', 'steam', 'dust', 'comb', 'dark', 'hammock', 'lamp'], decos: [...BASIC, 'vending', 'heater'],
    ailments: [['static', 1], ['hiccups', 1], ['ears', 1], ['sneezes', 1], ['dust', 1], ['tangle', 1], ['glow', 2], ['puff', 2], ['spots', 3]], arrive: 3.6, patience: 0.95,
    events: [[3, 3, 'emergency', 'spots'], [4, 2, 'inspector', null], [5, 3, 'vip', null], [6, 4, 'breakdown', null], [8, 3, 'emergency', 'sneezes'], [9, 2, 'inspector', null]], eventChance: 0.3,
  },
];
export const SANDBOX: ClinicDef = {
  id: 'sandbox', index: 6, name: 'Sandbox', place: 'a wide open meadow', blurb: 'Every room, every ailment and plenty of coins. No goals: build the clinic of your dreams.',
  twist: 'sandbox', twistText: 'Everything is unlocked. There are no goals and no day limit.',
  w: 24, h: 18, door: 12, ground: 'grass', backdrop: 'bg1', coins: 50000, days: 999, fastDay: 999, starRep: 100,
  goals: { cures: 0, rep: 0, coins: 0 }, rooms: [...ROOM_ORDER], decos: [...DECO_ORDER],
  ailments: AILMENT_ORDER.map((a) => [a, 1] as [AilmentId, number]), arrive: 3.4, patience: 0.8,
  events: [[3, 3, 'emergency', 'static'], [5, 3, 'inspector', null], [6, 3, 'vip', null]], eventChance: 0.3,
};
export const ALL_CLINICS: ClinicDef[] = [...CLINICS, SANDBOX];
export const clinicById = (id: string): ClinicDef => ALL_CLINICS.find((c) => c.id === id) ?? CLINICS[0];

export const PATIENT_NAMES = ['Pip', 'Lupe', 'Tito', 'Nina', 'Coco', 'Bruno', 'Luz', 'Paco', 'Mimi', 'Rufo', 'Inti', 'Kiki', 'Tomo', 'Sol', 'Pancho', 'Lola',
  'Quilla', 'Beto', 'Chispa', 'Pepa', 'Nube', 'Toto', 'Rosa', 'Yaku', 'Pocho', 'Mora', 'Chufo', 'Ñata', 'Kusi', 'Lalo', 'Wayra', 'Pita', 'Fifi', 'Ramón', 'Tika', 'Choco'];
export const STAFF_NAMES = ['Ana', 'Benji', 'Cata', 'Dani', 'Eli', 'Fede', 'Gabi', 'Hugo', 'Iris', 'Juli', 'Kai', 'Lino', 'Maru', 'Nico', 'Olga', 'Pablo', 'Quique', 'Rita',
  'Santi', 'Tere', 'Uma', 'Vale', 'Wil', 'Ximena', 'Yayo', 'Zoe', 'Abril', 'Bea', 'Ciro', 'Dulce', 'Emi', 'Flor'];
