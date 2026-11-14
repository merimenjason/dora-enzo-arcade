// Jade Street ride radio: the stations you can tune to while riding, each an original looping tune of eight bars of
// eighth notes (lead), one bass note a beat and one chord a bar, played by the scheduler in sound.ts. Road rides
// (scooter, trishaw, tuk-tuk, van) share four stations; the boat has its own three. The last entry is always "Radio off".

export type Voice = 'pluck' | 'chip' | 'keys' | 'erhu';
export type Station = {
  name: string; bpm: number; voice: Voice; swing?: number;
  /** 64 eighth notes (MIDI, 0 = rest) */
  lead: number[];
  /** 32 quarter notes (MIDI, 0 = rest) */
  bass: number[];
  /** 8 chords, one a bar */
  chords: number[][];
  /** drum pattern per bar of 8 steps: kick, snare, hat ('x' = hit) */
  kick: string; snare: string; hat: string;
};

const bars = (...b: number[][]) => b.flat();
const walk = (...b: number[][]) => [...b, ...b].flat();

export const STATIONS: Station[] = [
  { // D major pentatonic city pop
    name: 'Jade FM', bpm: 112, voice: 'pluck',
    lead: bars([74, 0, 76, 78, 81, 0, 78, 76], [74, 0, 71, 0, 69, 71, 74, 0], [71, 0, 74, 76, 78, 76, 74, 71], [69, 0, 0, 0, 76, 0, 74, 0],
      [74, 76, 78, 0, 81, 83, 81, 78], [76, 0, 74, 0, 71, 74, 0, 0], [71, 74, 76, 78, 76, 74, 71, 69], [74, 0, 0, 0, 0, 0, 0, 0]),
    bass: walk([38, 45, 38, 45], [35, 42, 35, 42], [43, 50, 43, 50], [45, 52, 45, 52]),
    chords: [[62, 66, 69], [59, 62, 66], [55, 59, 62], [57, 61, 64], [62, 66, 69], [59, 62, 66], [55, 59, 62], [57, 61, 64]],
    kick: 'x...x...', snare: '..x...x.', hat: 'x.x.x.x.',
  },
  { // slow and warm, major-seventh chords
    name: 'Lantern Lo-fi', bpm: 74, voice: 'keys',
    lead: bars([72, 0, 0, 69, 0, 67, 0, 0], [71, 0, 0, 67, 0, 64, 0, 0], [69, 0, 72, 0, 74, 0, 72, 69], [67, 0, 0, 0, 0, 0, 64, 67],
      [72, 0, 76, 0, 74, 72, 0, 69], [71, 0, 0, 74, 72, 0, 71, 67], [69, 0, 0, 65, 0, 69, 72, 0], [71, 0, 0, 0, 0, 0, 0, 0]),
    bass: walk([41, 0, 48, 41], [40, 0, 47, 40], [38, 0, 45, 38], [36, 0, 43, 36]),
    chords: [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59], [53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]],
    kick: 'x....x..', snare: '....x...', hat: '..x...x.',
  },
  { // A minor chiptune
    name: 'Neon Arcade', bpm: 140, voice: 'chip',
    lead: bars([81, 0, 76, 0, 72, 76, 81, 84], [83, 0, 81, 0, 77, 0, 72, 0], [79, 0, 76, 79, 84, 0, 83, 81], [79, 0, 74, 0, 71, 74, 79, 0],
      [81, 84, 88, 84, 81, 76, 72, 76], [77, 81, 84, 81, 77, 72, 69, 72], [76, 79, 84, 79, 76, 72, 67, 71], [74, 0, 79, 0, 83, 0, 0, 0]),
    bass: walk([33, 45, 33, 45], [29, 41, 29, 41], [36, 48, 36, 48], [31, 43, 31, 43]),
    chords: [[57, 60, 64], [53, 57, 60], [55, 60, 64], [55, 59, 62], [57, 60, 64], [53, 57, 60], [55, 60, 64], [55, 59, 62]],
    kick: 'x...x...', snare: '..x...x.', hat: '.x.x.x.x',
  },
  { // a swung harbour-bar tune with a walking bass
    name: 'Harbour Swing', bpm: 120, voice: 'keys', swing: 0.33,
    lead: bars([76, 0, 79, 0, 81, 79, 76, 0], [73, 0, 76, 79, 81, 0, 0, 0], [77, 0, 74, 0, 72, 74, 77, 0], [79, 0, 77, 74, 71, 0, 67, 0],
      [72, 76, 79, 84, 0, 81, 79, 76], [79, 0, 76, 73, 0, 69, 0, 0], [74, 77, 81, 0, 79, 77, 74, 72], [71, 0, 74, 0, 72, 0, 0, 0]),
    bass: walk([36, 40, 43, 45], [33, 37, 40, 43], [38, 41, 45, 48], [31, 35, 38, 41]),
    chords: [[48, 52, 55, 57], [45, 49, 52, 55], [50, 53, 57, 60], [43, 47, 50, 53], [48, 52, 55, 57], [45, 49, 52, 55], [50, 53, 57, 60], [43, 47, 50, 53]],
    kick: 'x...x...', snare: '..x...x.', hat: 'x.xxx.xx',
  },
  { // E minor pentatonic on a bowed two-string voice
    name: 'Canal Strings', bpm: 66, voice: 'erhu',
    lead: bars([76, 0, 0, 79, 81, 0, 79, 76], [74, 0, 0, 0, 71, 0, 74, 0], [76, 0, 79, 0, 83, 0, 81, 79], [76, 0, 0, 0, 0, 0, 0, 0],
      [79, 0, 81, 0, 83, 0, 86, 83], [81, 0, 79, 0, 76, 0, 74, 0], [71, 0, 74, 76, 79, 0, 76, 74], [76, 0, 0, 0, 0, 0, 0, 0]),
    bass: walk([40, 0, 47, 0], [36, 0, 43, 0], [38, 0, 45, 0], [40, 0, 47, 0]),
    chords: [[52, 55, 59], [48, 52, 55], [50, 54, 57], [52, 55, 59], [52, 55, 59], [48, 52, 55], [50, 54, 57], [52, 55, 59]],
    kick: '', snare: '', hat: 'x...x...',
  },
  { // G major pentatonic on the plucked zither
    name: 'Moonlit Ferry', bpm: 84, voice: 'pluck',
    lead: bars([67, 71, 74, 79, 0, 76, 74, 0], [71, 0, 69, 0, 67, 0, 0, 0], [69, 71, 74, 0, 76, 0, 79, 0], [81, 0, 79, 76, 74, 0, 0, 0],
      [79, 0, 81, 0, 83, 81, 79, 76], [74, 0, 76, 0, 79, 0, 0, 0], [76, 74, 71, 69, 67, 69, 71, 0], [67, 0, 0, 0, 0, 0, 0, 0]),
    bass: walk([43, 0, 50, 0], [40, 0, 47, 0], [36, 0, 43, 0], [38, 0, 45, 0]),
    chords: [[55, 59, 62], [52, 55, 59], [48, 52, 55], [50, 54, 57], [55, 59, 62], [52, 55, 59], [48, 52, 55], [50, 54, 57]],
    kick: 'x.......', snare: '', hat: '....x...',
  },
];
const BY_NAME = Object.fromEntries(STATIONS.map(s => [s.name, s]));
const ROAD = ['Jade FM', 'Lantern Lo-fi', 'Neon Arcade', 'Harbour Swing'];
const BOAT = ['Canal Strings', 'Moonlit Ferry', 'Lantern Lo-fi'];
export const OFF = 'Radio off';

/** the station names for a ride kind, "Radio off" last */
export const stationList = (kind: string | null) => [...(kind === 'boat' ? BOAT : ROAD), OFF];
export const stationOf = (name: string): Station | null => BY_NAME[name] ?? null;
