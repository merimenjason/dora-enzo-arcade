// Kopi Peng Brawl: the hand-authored content. Five stages of three scenes each (two fights and a boss), one painted
// panel per scene. Waves, hawkers, items on the floor, each stage's twist and the pool its random events come from.
// Nothing in here is random: the engine rolls the events from the seed.

export type FoeKind = 'rat' | 'macaque' | 'mynah' | 'monitor' | 'roach' | 'python' | 'toad' | 'boar';
export type BossKind = 'tank' | 'ssst' | 'tusker' | 'ong' | 'king';
export type ItemKind = 'tray' | 'stool' | 'wok' | 'durian' | 'pole' | 'satay' | 'kopibag' | 'fish' | 'ice' | 'plate' | 'kopi' | 'basin' | 'coconut';
export type HawkerKind = 'satay' | 'drinks' | 'noodle';
export type Twist = 'closing' | 'liondance' | 'train' | 'monsoon' | 'jets';
export type EventKind = 'powercut' | 'durians' | 'roaches' | 'downpour';

/** a foe entering: from the left or right edge, the back (a door or a stall), or dropping from above */
export interface Spawn { k: FoeKind; n?: number; from?: 'L' | 'R' | 'B' | 'T'; rider?: FoeKind; arm?: ItemKind; z?: number }
export interface Wave { foes: Spawn[]; /** seconds after the previous wave is cleared (or the scene starts) */ wait?: number; say?: string }
export interface Scene {
  id: string; bg: string; title: string;
  waves: Wave[];
  hawkers: { k: HawkerKind; x: number }[];
  items: { k: ItemKind; x: number; z: number }[];
  /** tables with plates on them: breaking one drops food that heals a hero or enrages a foe */
  tables: { x: number; z: number }[];
  boss?: BossKind;
  /** seconds into the scene when the random event fires (the kind is rolled from the stage's pool) */
  eventAt?: number;
  panel: string;
}
export interface Stage { id: string; name: string; place: string; twist: Twist; twistName: string; twistHelp: string; events: EventKind[]; scenes: Scene[]; intro: string }

export const PANEL_W = 1536;

export const STAGES: Stage[] = [
  {
    id: 's1', name: 'Closing Time', place: 'Lau Pa Sat', twist: 'closing', twistName: 'Closing time',
    twistHelp: 'The cleaners’ trolley sweeps a lane: jump it, or knock foes into its path.',
    events: ['powercut', 'roaches'],
    intro: 'Midnight at Lau Pa Sat. A gang of pests has been raiding the stalls, and tonight they came for the satay. Dora and Enzo were only here for a kopi peng.',
    scenes: [
      { id: '1a', bg: 'bg-1a', title: 'The octagon', panel: 'Rats first. They come low, under your swings.',
        waves: [
          { foes: [{ k: 'rat', n: 2, from: 'R' }], say: 'Oi! Leave the satay alone!' },
          { foes: [{ k: 'rat', n: 2, from: 'L' }, { k: 'macaque', from: 'B' }], wait: 1 },
          { foes: [{ k: 'macaque', n: 2, from: 'R' }, { k: 'mynah', from: 'T' }], wait: 1.5 },
        ],
        hawkers: [{ k: 'satay', x: 300 }, { k: 'drinks', x: 1150 }],
        items: [{ k: 'tray', x: 520, z: 120 }, { k: 'stool', x: 980, z: 60 }],
        tables: [{ x: 700, z: 30 }, { x: 1320, z: 40 }], eventAt: 26 },
      { id: '1b', bg: 'bg-1b', title: 'Shutters down', panel: 'The stalls are closing. Mind the cleaners’ trolley.',
        waves: [
          { foes: [{ k: 'macaque', n: 2, from: 'B' }, { k: 'rat', n: 2, from: 'R' }] },
          { foes: [{ k: 'mynah', n: 2, from: 'T' }, { k: 'macaque', n: 2, from: 'L' }], wait: 1, say: 'The mynahs are passing them our trays!' },
          { foes: [{ k: 'rat', n: 3, from: 'R' }, { k: 'macaque', from: 'B', arm: 'wok' }], wait: 1.5 },
          { foes: [{ k: 'macaque', n: 2, from: 'L' }, { k: 'mynah', from: 'T' }, { k: 'rat', n: 2, from: 'R' }], wait: 1.5, say: 'Last lot before the shutters close!' },
        ],
        hawkers: [{ k: 'noodle', x: 820 }],
        items: [{ k: 'wok', x: 400, z: 150 }, { k: 'durian', x: 1100, z: 100 }, { k: 'kopibag', x: 700, z: 180 }],
        tables: [{ x: 250, z: 40 }], eventAt: 20 },
      { id: '1c', bg: 'bg-1c', title: 'Satay Street', panel: 'Something big is in the satay smoke.', boss: 'tank',
        waves: [{ foes: [], say: 'That is not a lizard. That is a lorry.' }],
        hawkers: [{ k: 'satay', x: 500 }],
        items: [{ k: 'pole', x: 400, z: 160 }, { k: 'satay', x: 1000, z: 80 }],
        tables: [{ x: 1250, z: 30 }] },
    ],
  },
  {
    id: 's2', name: 'Lion Dance', place: 'Chinatown', twist: 'liondance', twistName: 'Lion dance',
    twistHelp: 'Hit on the drum beat for a heavy blow. The lion tramples anyone in its lane.',
    events: ['durians', 'roaches', 'powercut'],
    intro: 'The gang ran into the Chinatown night market, where a lion dance troupe is drumming down the street. Every beat of the drum is a chance to hit harder.',
    scenes: [
      { id: '2a', bg: 'bg-2a', title: 'Pagoda Street', panel: 'Hit on the drum beat. BONG!',
        waves: [
          { foes: [{ k: 'monitor', from: 'R' }, { k: 'rat', n: 2, from: 'L' }] },
          { foes: [{ k: 'monitor', from: 'B', rider: 'rat' }, { k: 'macaque', from: 'R' }], wait: 1, say: 'Rats riding a monitor. Of course.' },
          { foes: [{ k: 'roach', n: 2, from: 'T' }, { k: 'macaque', n: 2, from: 'R' }], wait: 1.5 },
        ],
        hawkers: [{ k: 'drinks', x: 1200 }],
        items: [{ k: 'pole', x: 600, z: 140 }, { k: 'coconut', x: 1000, z: 70 }],
        tables: [{ x: 350, z: 35 }], eventAt: 22 },
      { id: '2b', bg: 'bg-2b', title: 'Smith Street', panel: 'Stay out of the lion’s lane.',
        waves: [
          { foes: [{ k: 'macaque', n: 2, from: 'B' }, { k: 'mynah', from: 'T' }] },
          { foes: [{ k: 'monitor', n: 2, from: 'R' }, { k: 'roach', from: 'T' }], wait: 1 },
          { foes: [{ k: 'monitor', from: 'L', rider: 'rat' }, { k: 'rat', n: 2, from: 'R' }, { k: 'mynah', from: 'T' }], wait: 1.5 },
          { foes: [{ k: 'macaque', n: 2, from: 'R' }, { k: 'monitor', from: 'L' }, { k: 'roach', from: 'T' }], wait: 1.5, say: 'They’re following the drums!' },
        ],
        hawkers: [{ k: 'satay', x: 300 }, { k: 'noodle', x: 1150 }],
        items: [{ k: 'wok', x: 500, z: 100 }, { k: 'plate', x: 900, z: 160 }],
        tables: [{ x: 700, z: 30 }], eventAt: 18 },
      { id: '2c', bg: 'bg-2c', title: 'The temple gate', panel: 'The lion’s head is moving on its own.', boss: 'ssst',
        waves: [{ foes: [], say: 'There’s no dancer inside that lion!' }],
        hawkers: [], items: [{ k: 'stool', x: 450, z: 120 }, { k: 'tray', x: 1100, z: 150 }], tables: [] },
    ],
  },
  {
    id: 's3', name: 'Last Train', place: 'The MRT', twist: 'train', twistName: 'The last train',
    twistHelp: 'At each station the doors open: foes get on, and a foe knocked into an open door is out.',
    events: ['powercut', 'roaches'],
    intro: 'They jumped on the last train east. Every station the doors open, and every station more of them get on.',
    scenes: [
      { id: '3a', bg: 'bg-3a', title: 'Doors closing', panel: 'Knock them out of the open doors!',
        waves: [
          { foes: [{ k: 'rat', n: 2, from: 'R' }, { k: 'macaque', from: 'L' }] },
          { foes: [{ k: 'python', from: 'T' }, { k: 'rat', n: 2, from: 'B' }], wait: 1, say: 'Snake on the handrail!' },
          { foes: [{ k: 'macaque', n: 2, from: 'B' }, { k: 'mynah', from: 'R' }], wait: 1.5 },
        ],
        hawkers: [], items: [{ k: 'kopibag', x: 600, z: 120 }, { k: 'basin', x: 1100, z: 80 }], tables: [], eventAt: 20 },
      { id: '3b', bg: 'bg-3b', title: 'Tanjong Pagar', panel: 'The train leans on the curves.',
        waves: [
          { foes: [{ k: 'python', from: 'T' }, { k: 'macaque', n: 2, from: 'B' }] },
          { foes: [{ k: 'rat', n: 3, from: 'B' }, { k: 'mynah', from: 'R' }], wait: 1 },
          { foes: [{ k: 'python', from: 'T' }, { k: 'monitor', from: 'B', rider: 'rat' }], wait: 1.5 },
          { foes: [{ k: 'macaque', n: 2, from: 'B' }, { k: 'rat', n: 2, from: 'B' }], wait: 1.5, say: 'Next stop, Outram Park!' },
        ],
        hawkers: [], items: [{ k: 'stool', x: 400, z: 150 }, { k: 'pole', x: 1000, z: 100 }], tables: [], eventAt: 16 },
      { id: '3c', bg: 'bg-3c', title: 'The viaduct', panel: 'Something is charging down the carriages.', boss: 'tusker',
        waves: [{ foes: [], say: 'Is that a boar on the MRT?!' }],
        hawkers: [], items: [{ k: 'durian', x: 600, z: 120 }], tables: [] },
    ],
  },
  {
    id: 's4', name: 'Monsoon', place: 'Tekka Market', twist: 'monsoon', twistName: 'Monsoon flood',
    twistHelp: 'The floor floods as you fight: water slows everyone, and fish and ice make good weapons.',
    events: ['downpour', 'powercut', 'durians'],
    intro: 'Off the train and into a monsoon. The gang has holed up in the wet market, and the drains are already overflowing.',
    scenes: [
      { id: '4a', bg: 'bg-4a', title: 'Fish row', panel: 'Toads love the rain.',
        waves: [
          { foes: [{ k: 'toad', n: 2, from: 'R' }] },
          { foes: [{ k: 'macaque', n: 2, from: 'B' }, { k: 'toad', from: 'L' }], wait: 1 },
          { foes: [{ k: 'monitor', from: 'R' }, { k: 'mynah', n: 2, from: 'T' }], wait: 1.5 },
        ],
        hawkers: [{ k: 'drinks', x: 300 }],
        items: [{ k: 'fish', x: 500, z: 140 }, { k: 'ice', x: 950, z: 70 }, { k: 'fish', x: 1200, z: 170 }],
        tables: [{ x: 1100, z: 30 }], eventAt: 20 },
      { id: '4b', bg: 'bg-4b', title: 'The butchers’ row', panel: 'The water is rising.',
        waves: [
          { foes: [{ k: 'toad', n: 2, from: 'B' }, { k: 'rat', n: 2, from: 'R' }] },
          { foes: [{ k: 'macaque', n: 2, from: 'L', arm: 'fish' }, { k: 'roach', from: 'T' }], wait: 1 },
          { foes: [{ k: 'toad', n: 2, from: 'R' }, { k: 'monitor', from: 'B', rider: 'rat' }], wait: 1.5 },
          { foes: [{ k: 'macaque', n: 2, from: 'L', arm: 'fish' }, { k: 'toad', from: 'R' }, { k: 'mynah', from: 'T' }], wait: 1.5, say: 'They’re swinging fish at us now!' },
        ],
        hawkers: [{ k: 'noodle', x: 900 }],
        items: [{ k: 'ice', x: 400, z: 120 }, { k: 'basin', x: 700, z: 60 }],
        tables: [{ x: 300, z: 30 }], eventAt: 18 },
      { id: '4c', bg: 'bg-4c', title: 'The loading bay', panel: 'Something big is croaking.', boss: 'ong',
        waves: [{ foes: [], say: 'That frog is wearing an apron.' }],
        hawkers: [], items: [{ k: 'fish', x: 500, z: 120 }, { k: 'ice', x: 1100, z: 150 }], tables: [] },
    ],
  },
  {
    id: 's5', name: 'Dawn Raid', place: 'Changi Village', twist: 'jets', twistName: 'Jets overhead',
    twistHelp: 'When a plane roars over, everyone on the ground is stunned. Jump as it passes.',
    events: ['durians', 'roaches', 'downpour'],
    intro: 'By dawn the trail leads to Changi Village, home of the Macaque King himself. Planes thunder in to land every few seconds.',
    scenes: [
      { id: '5a', bg: 'bg-5a', title: 'Changi Village', panel: 'Jump when the jets come over.',
        waves: [
          { foes: [{ k: 'boar', from: 'R' }, { k: 'macaque', from: 'L' }] },
          { foes: [{ k: 'boar', from: 'R', rider: 'macaque' }, { k: 'mynah', from: 'T' }], wait: 1, say: 'Macaques riding boars now!' },
          { foes: [{ k: 'macaque', n: 3, from: 'B' }, { k: 'rat', n: 2, from: 'L' }], wait: 1.5 },
        ],
        hawkers: [{ k: 'satay', x: 350 }, { k: 'drinks', x: 1150 }],
        items: [{ k: 'coconut', x: 600, z: 140 }, { k: 'tray', x: 1000, z: 90 }],
        tables: [{ x: 800, z: 30 }], eventAt: 20 },
      { id: '5b', bg: 'bg-5b', title: 'The jetty', panel: 'The whole troop is here.',
        waves: [
          { foes: [{ k: 'macaque', n: 2, from: 'R' }, { k: 'python', from: 'T' }] },
          { foes: [{ k: 'boar', n: 2, from: 'L' }, { k: 'mynah', n: 2, from: 'T' }], wait: 1 },
          { foes: [{ k: 'monitor', from: 'R', rider: 'rat' }, { k: 'toad', from: 'B' }, { k: 'macaque', n: 2, from: 'L', arm: 'pole' }], wait: 1.5 },
          { foes: [{ k: 'boar', from: 'R' }, { k: 'macaque', n: 2, from: 'B' }, { k: 'mynah', from: 'T' }], wait: 1.5, say: 'The King is on the beach. Nearly there.' },
        ],
        hawkers: [{ k: 'noodle', x: 600 }],
        items: [{ k: 'pole', x: 400, z: 160 }, { k: 'durian', x: 1200, z: 80 }],
        tables: [], eventAt: 16 },
      { id: '5c', bg: 'bg-5c', title: 'Changi Beach', panel: 'The Macaque King.', boss: 'king',
        waves: [{ foes: [], say: 'So you’re the one who keeps taking our satay.' }],
        hawkers: [], items: [{ k: 'tray', x: 500, z: 140 }, { k: 'stool', x: 1050, z: 90 }], tables: [] },
    ],
  },
];

export const BOSS_NAME: Record<BossKind, string> = {
  tank: 'Old Tank', ssst: 'Madam Ssst', tusker: 'Tusker', ong: 'Big Frog Ong', king: 'The Macaque King',
};
export const FOE_NAME: Record<FoeKind, string> = {
  rat: 'Sewer Rat', macaque: 'Macaque', mynah: 'Mynah', monitor: 'Monitor Lizard', roach: 'Cockroach',
  python: 'Python', toad: 'Toad', boar: 'Wild Boar',
};
export const HAWKER_NAME: Record<HawkerKind, string> = { satay: 'Satay Uncle', drinks: 'Drinks Auntie', noodle: 'Noodle Uncle' };
export const EVENT_NAME: Record<EventKind, string> = { powercut: 'Power cut!', durians: 'Durian lorry!', roaches: 'Cockroaches!', downpour: 'Downpour!' };

export function allScenes(): { stage: Stage; scene: Scene; si: number; ci: number }[] {
  const out: { stage: Stage; scene: Scene; si: number; ci: number }[] = [];
  STAGES.forEach((stage, si) => stage.scenes.forEach((scene, ci) => out.push({ stage, scene, si, ci })));
  return out;
}
