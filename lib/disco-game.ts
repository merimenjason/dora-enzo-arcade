// Dust Disco: a four-lane rhythm game. Every song is written here as data (chords, melody, drums and bass), the music and the
// charts are both built from that data, and the judge below scores presses against the chart. No DOM and no randomness.

export type Diff = 'easy' | 'normal' | 'hard';
export type Mode = 'major' | 'minor' | 'dorian' | 'mixolydian';
export type Inst = 'kick' | 'snare' | 'hat' | 'open' | 'clap' | 'bass' | 'lead' | 'pad' | 'bell';
export type Timbre = 'square' | 'triangle' | 'sawtooth' | 'sine';
/** One bar of drums on a 16th grid (`meter * 4` characters): `x` hit, `X` accented hit, `o` open hat, `.` nothing. */
export type Drums = { k: string; s: string; h: string };
export type Section = {
  bars: number;
  /** Chord roots as 1-based scale degrees, one per bar, cycled. */
  chords: number[];
  /** Melody phrases, cycled. Tokens on the song's grid: a scale degree (0 is the tonic, 7 the octave), `-` holds, `.` rests. */
  mel: string[];
  drums: Drums;
  /** One bar on an 8th grid: `r` root, `t` third, `f` fifth, `o` octave, `-` hold, `.` rest. */
  bass: string;
  /** The chorus: chords in the chart and a bell doubling the tune. */
  big?: boolean;
};
export type Song = {
  id: string; title: string; venue: string; place: string; blurb: string; color: string;
  bpm: number; meter: 3 | 4; res: 2 | 4; swing: number; root: number; mode: Mode; lead: Timbre;
  form: string[]; sections: Record<string, Section>;
};
export type MusicEvent = { t: number; dur: number; inst: Inst; midi: number; vel: number };
/** A cue the chart can pick from: a melody onset or a drum hit. */
type Cue = { t: number; beat: number; frac: number; len: number; src: 'mel' | 'kick' | 'snare' | 'hat'; deg: number; big: boolean; sectionStart: boolean; barStart: boolean; resting: boolean; phrase: number };
export type Note = { id: number; t: number; lane: number; len: number; chord: boolean };
export type Chart = { song: string; diff: Diff; notes: Note[]; end: number; spb: number };

const SCALES: Record<Mode, number[]> = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], mixolydian: [0, 2, 4, 5, 7, 9, 10] };
const mod = (a: number, n: number) => ((a % n) + n) % n;
export const pitch = (s: Song, deg: number) => s.root + 12 * Math.floor(deg / 7) + SCALES[s.mode][mod(deg, 7)];
const four = (k: string, s: string, h: string): Drums => ({ k, s, h });

// ---------------------------------------------------------------- the songs
export const SONGS: Song[] = [
  {
    id: 'burrow', title: 'Burrow Bop', venue: 'The Home Burrow', place: 'burrow', color: '#f2a37c', bpm: 96, meter: 4, res: 2, swing: 0, root: 72, mode: 'major', lead: 'square',
    blurb: 'A cosy first dance under the fairy lights at home. Easy steps, a big singalong chorus.',
    form: ['intro', 'a', 'b', 'a', 'b', 'outro'],
    sections: {
      intro: { bars: 4, chords: [1, 4, 1, 5], mel: ['. . . . . . . . . . . . . . . . . . . . . . . . . . . . 0 . 2 .'], drums: four('x.......x.......', '................', 'x.x.x.x.x.x.x.x.'), bass: 'r...r...' },
      a: { bars: 8, chords: [1, 6, 4, 5, 1, 6, 4, 5], drums: four('x.......x.......', '....x.......x...', 'x.x.x.x.x.x.x.x.'), bass: 'r.r.f.o.',
        mel: ['4 . 4 2 4 - 5 4 2 - 0 . 2 4 2 0 3 - 3 5 7 - 5 3 4 - - . 1 2 1 -', '4 . 4 2 4 - 5 7 9 - 7 . 5 4 2 . 3 . 5 3 2 . 1 2 0 - - - . . . .'] },
      b: { bars: 8, big: true, chords: [4, 5, 3, 6, 4, 5, 1, 1], drums: four('x...x...x...x...', '....X.......X...', 'x.xox.xox.xox.xo'), bass: 'r.ro.rf.',
        mel: ['5 - 5 7 9 - 7 5 6 - 4 - 6 7 6 4 4 - 2 4 6 - 4 2 5 - - . 4 5 7 -', '5 - 5 7 9 - 10 9 8 - 7 - 6 - 4 . 7 - 4 2 0 - 2 4 7 - - - . . . .'] },
      outro: { bars: 4, chords: [4, 5, 1, 1], mel: ['5 - 4 - 2 - 1 - 2 - - - 4 - - - 7 - - - - - - - . . . . . . . .'], drums: four('x.......x.......', '....x...........', 'x.x.x.x.x.x.x.x.'), bass: 'r...r...' },
    },
  },
  {
    id: 'hayloft', title: 'Hay Loft Hop', venue: 'The Hay Loft', place: 'hayloft', color: '#e8b64e', bpm: 112, meter: 4, res: 2, swing: 0.08, root: 67, mode: 'major', lead: 'triangle',
    blurb: 'A swinging barn dance at sunset. Bouncy steps and long held notes to slide on.',
    form: ['intro', 'a', 'b', 'a', 'b', 'c', 'b', 'outro'],
    sections: {
      intro: { bars: 4, chords: [1, 4, 5, 1], mel: ['. . . . . . . . . . . . . . . . . . . . . . . . 4 . 2 . 1 . 2 .'], drums: four('x.......x.......', '....x.......x...', '..x...x...x...x.'), bass: 'r.f.r.f.' },
      a: { bars: 8, chords: [1, 4, 1, 5, 1, 4, 5, 1], drums: four('x.......x.......', '....x.......x...', 'x.x.x.x.x.x.x.x.'), bass: 'r.f.r.f.',
        mel: ['0 . 2 4 7 . 4 2 3 . 5 7 9 . 7 5 4 . 4 2 0 . 2 4 1 - 2 - 4 - . .', '0 . 2 4 7 . 4 2 3 . 5 7 9 . 7 5 4 . 7 4 6 - 5 4 7 - - . . . . .'] },
      b: { bars: 8, big: true, chords: [4, 4, 1, 1, 4, 4, 5, 5], drums: four('x...x...x...x...', '....X.......X...', 'x.xox.xox.xox.xo'), bass: 'r.o.f.o.',
        mel: ['5 - 5 3 5 - 3 2 3 - 3 5 7 - 5 3 4 - 4 2 4 - 2 0 2 - - . 0 2 4 .', '5 - 5 3 5 - 7 8 9 - 8 7 5 - 3 . 4 - 6 - 8 - 6 4 1 - 2 - 4 - - .'] },
      c: { bars: 8, chords: [6, 4, 5, 5], drums: four('x.....x.x.......', '....x.......x...', 'x.x.x.x.x.x.x.x.'), bass: 'r--.f.r.',
        mel: ['5 . 5 . 4 . 2 . 3 . 3 . 2 . 0 . 1 . 2 . 4 . 6 . 7 - - - 6 - 4 -'] },
      outro: { bars: 2, chords: [5, 1], mel: ['4 . 2 . 1 . 2 . 0 - - - - - - -'], drums: four('x.......x.......', '....x...........', 'x.x.x.x.x.x.x.x.'), bass: 'r...r...' },
    },
  },
  {
    id: 'pond', title: 'Moonpond Waltz', venue: 'The Lily Pond', place: 'pond', color: '#7cc4c0', bpm: 132, meter: 3, res: 2, swing: 0, root: 62, mode: 'minor', lead: 'sine',
    blurb: 'A moonlit waltz on the lily pads, one-two-three. Count in threes and glide.',
    form: ['intro', 'a', 'b', 'a', 'b', 'c', 'b', 'outro'],
    sections: {
      intro: { bars: 4, chords: [1, 6, 4, 5], mel: ['. . . . . . . . . . . . . . . . . . . . . . 2 3'], drums: four('x...........', '....x...x...', 'x.x.x.x.x.x.'), bass: 'r.f.f.' },
      a: { bars: 8, chords: [1, 6, 3, 7, 1, 6, 4, 5], drums: four('x...........', '....x...x...', 'x.x.x.x.x.x.'), bass: 'r.f.f.',
        mel: ['4 - - 2 3 4 5 - - 4 2 . 2 - - 0 2 4 6 - - - . .', '4 - - 2 3 4 5 - 7 - 5 . 3 - 2 - 0 . 1 - - 4 - -'] },
      b: { bars: 8, big: true, chords: [4, 7, 3, 6, 4, 5, 1, 1], drums: four('x.......x...', '....X...X...', 'x.xox.xox.xo'), bass: 'r.o.f.',
        mel: ['7 - - 6 5 4 6 - - 5 4 2 4 - 2 - 4 - 5 - - - . .', '7 - - 6 5 4 6 - - 7 8 9 7 - - 4 - - 7 - - - - .'] },
      c: { bars: 8, chords: [6, 6, 7, 7, 1, 1, 5, 5], drums: four('x...........', '....x...x...', 'x.x.x.x.x.x.'), bass: 'r-----',
        mel: ['2 - 4 - 5 - 7 - 5 - 4 - 6 - 4 - 1 - 4 - - - - .'] },
      outro: { bars: 4, chords: [6, 5, 1, 1], mel: ['5 - - 4 - - 2 - - 1 - - 0 - - - - - - - - - - .'], drums: four('x...........', '....x...x...', 'x.x.x.x.x.x.'), bass: 'r-----' },
    },
  },
  {
    id: 'market', title: 'Pebble Street Funk', venue: 'The Night Market', place: 'market', color: '#e2729e', bpm: 104, meter: 4, res: 4, swing: 0, root: 64, mode: 'dorian', lead: 'sawtooth',
    blurb: 'Funky offbeats under the paper lanterns. Listen for the notes that land between the beats.',
    form: ['intro', 'a', 'b', 'a', 'b', 'c', 'b', 'outro'],
    sections: {
      intro: { bars: 4, chords: [1, 4, 1, 4], mel: ['. . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 4 . 3 .'], drums: four('x.....x...x.....', '....x.......x...', 'x.x.x.x.x.x.x.x.'), bass: 'r..r.o.r' },
      a: { bars: 8, chords: [1, 4, 1, 4], drums: four('x.....x...x..x..', '....x.......x...', 'xxx.xxx.xxx.xxx.'), bass: 'r..r.o.r',
        mel: ['0 . . 0 . . 2 . 3 . 2 . 0 . . . . . -1 . 0 . . . 4 . 3 . 2 . 0 .', '0 . . 0 . . 2 . 3 . 2 . 0 . 7 . . . 6 . 4 . . 3 . . 2 . 0 - - .'] },
      b: { bars: 8, big: true, chords: [3, 4, 1, 7], drums: four('x...x...x...x...', '....X.......X...', 'x.xox.xox.xox.xo'), bass: 'r.or.or.',
        mel: ['4 . . 4 . . 6 . 7 . . 6 . 4 . . 5 . . 5 . . 4 . 3 . . 2 . 3 - .', '4 . . 4 . . 6 . 7 . . 9 . 8 . 7 8 - . 7 . . 6 . 4 . . . 7 - - .'] },
      c: { bars: 8, chords: [4, 4, 1, 1], drums: four('x.....x...x.....', '....x.......x.x.', 'x.x.x.x.x.x.x.x.'), bass: 'r-..r-..',
        mel: ['7 - - - 6 - 4 - . . 3 . 4 . . . 2 - - - 0 - 2 - . . 3 . 4 . . .'] },
      outro: { bars: 2, chords: [4, 1], mel: ['4 . . 4 . . 3 . 2 . . . 0 . . . 7 - - - - - - - - - - - . . . .'], drums: four('x.....x...x.....', '....x.......x...', 'x.x.x.x.x.x.x.x.'), bass: 'r..r.o.r' },
    },
  },
  {
    id: 'summit', title: 'Snowpeak Gallop', venue: 'The Snowy Summit', place: 'summit', color: '#8fb8ea', bpm: 140, meter: 4, res: 2, swing: 0, root: 69, mode: 'major', lead: 'triangle',
    blurb: 'A galloping race over the snow under the aurora. Quick feet, big leaps.',
    form: ['intro', 'a', 'b', 'a', 'b', 'c', 'b', 'b', 'outro'],
    sections: {
      intro: { bars: 4, chords: [1, 5, 6, 4], mel: ['. . . . . . . . . . . . . . . . . . . . . . . . 0 . 2 . 4 . 6 .'], drums: four('x..x..x.x..x..x.', '................', 'x.x.x.x.x.x.x.x.'), bass: 'r.rfr.rf' },
      a: { bars: 8, chords: [1, 5, 6, 4], drums: four('x..x..x.x..x..x.', '....x.......x...', 'x.x.x.x.x.x.x.x.'), bass: 'r.rfr.rf',
        mel: ['0 . 2 4 7 - 4 . 4 . 6 8 9 - 8 . 5 - 4 2 0 . 2 . 3 - 2 - 1 - . .', '0 . 2 4 7 - 4 . 4 . 6 8 9 - 11 . 12 - 11 9 7 . 9 . 7 - - - . . . .'] },
      b: { bars: 8, big: true, chords: [4, 5, 1, 6, 4, 5, 1, 1], drums: four('x..xx..xx..xx..x', '....X.......X...', 'xoxoxoxoxoxoxoxo'), bass: 'r.ofr.of',
        mel: ['3 - 5 - 7 - 5 3 4 - 6 - 8 - 6 4 7 . 7 . 9 . 7 . 5 - - - 4 - 2 -', '3 - 5 - 7 - 5 3 4 - 6 - 8 - 9 - 7 . 4 . 2 . 4 . 7 - - - . . . .'] },
      c: { bars: 8, chords: [6, 4, 1, 5], drums: four('x.......x.......', '....x.......x...', 'x.x.x.x.x.x.x.x.'), bass: 'r---f---',
        mel: ['5 . 5 . 4 . 2 . 3 . 3 . 5 . 7 . 7 . 7 . 4 . 2 . 4 - - - 6 - - -'] },
      outro: { bars: 2, chords: [5, 1], mel: ['4 . 6 . 8 . 9 . 7 - - - - - - -'], drums: four('x..x..x.x.......', '....x...........', 'x.x.x.x.x.......'), bass: 'r.rfr...' },
    },
  },
  {
    id: 'hall', title: 'Dust Storm Disco', venue: 'The Grand Dust Hall', place: 'hall', color: '#b48cf0', bpm: 124, meter: 4, res: 2, swing: 0, root: 69, mode: 'minor', lead: 'square',
    blurb: 'The big night under the giant disco ball. Four on the floor and everything you have learned.',
    form: ['intro', 'a', 'b', 'a', 'b', 'c', 'b', 'b', 'outro'],
    sections: {
      intro: { bars: 4, chords: [1, 6, 3, 7], mel: ['. . . . . . . . . . . . . . . . . . . . . . . . 4 . 6 . 7 . 9 .'], drums: four('x...x...x...x...', '................', '..o...o...o...o.'), bass: 'roroo.ro' },
      a: { bars: 8, chords: [1, 6, 3, 7], drums: four('x...x...x...x...', '....x.......x...', '..o...o...o...o.'), bass: 'roroo.ro',
        mel: ['7 . 7 . 6 4 . 2 3 . 3 . 2 0 . . 4 . 4 . 6 7 . 6 6 - - . 4 . 1 .', '7 . 7 . 6 4 . 2 3 . 3 . 2 0 . 2 4 . 4 . 6 7 . 9 8 - 7 - 6 - . .'] },
      b: { bars: 8, big: true, chords: [6, 7, 1, 1, 6, 7, 5, 5], drums: four('x...x...x...x...', '....X.......X...', 'xxoxxxoxxxoxxxox'), bass: 'roroo.ro',
        mel: ['5 - 7 - 9 - 7 5 6 - 8 - 10 - 8 6 7 . 9 . 7 . 4 . 2 - 4 - 7 - . .', '5 - 7 - 9 - 7 5 6 - 8 - 10 - 11 - 11 - 10 - 8 - 6 - 4 - - - 1 - - .'] },
      c: { bars: 8, chords: [4, 4, 5, 5, 6, 6, 7, 7], drums: four('x...x...x...x...', '....x.......x...', '..o...o...o...o.'), bass: 'r.r.r.r.',
        mel: ['0 0 . 0 2 . 3 . 4 . 2 . 0 . . .'] },
      outro: { bars: 4, chords: [6, 7, 1, 1], mel: ['5 - 7 - 9 - 7 - 6 - 8 - 10 - 8 - 7 - - - - - - - . . . . . . . .'], drums: four('x...x...x...x...', '....x.......x...', '..o...o...o...o.'), bass: 'roroo.ro' },
    },
  },
  {
    id: 'beach', title: 'Pebble Beach Sway', venue: 'The Pebble Beach', place: 'beach', color: '#5fd0c0', bpm: 100, meter: 4, res: 2, swing: 0, root: 65, mode: 'major', lead: 'triangle',
    blurb: 'A lazy sway by the lake in the midday sun. The beat drops on three, so wait for it.',
    form: ['intro', 'a', 'b', 'c', 'a', 'b', 'outro'],
    sections: {
      intro: { bars: 4, chords: [1, 4, 1, 5], mel: ['. . . . . . . . . . . . . . . . . . . . . . . . . . . . 4 . 5 .'], drums: four('........x.......', '........x.......', '..xx..xx..xx..xx'), bass: 'r..rf...' },
      a: { bars: 8, chords: [1, 4, 1, 5, 1, 4, 5, 1], drums: four('........x.......', '........x.......', '..xx..xx..xx..xx'), bass: 'r..rf.o.',
        mel: ['. . 4 - 4 2 0 . 2 - 4 - 5 - 4 . . . 4 - 4 2 0 . 1 - - . 1 2 4 .', '. . 4 - 4 2 0 . 2 - 4 - 7 - 6 . 5 - 4 . 2 . 1 . 0 - - - 2 . 4 .'] },
      b: { bars: 8, big: true, chords: [4, 5, 1, 6, 4, 5, 1, 1], drums: four('x...x...x...x...', '........X.......', 'x.ox.xox.xox.xox'), bass: 'r.ror.f.',
        mel: ['7 - 7 - 6 - 5 . 4 - 5 - 6 - 4 . 4 - 4 2 4 - 5 - 2 - - . . . . .', '7 - 7 - 6 - 5 . 4 - 5 - 6 - 8 . 7 - 6 - 4 - 2 - 0 - - - - - . .'] },
      c: { bars: 8, chords: [6, 4, 1, 5], drums: four('........x.......', '........x.......', 'x.xxx.xxx.xxx.xx'), bass: 'r---....',
        mel: ['. . 2 . 2 . 4 . 5 - - - 4 2 4 . . . 0 . 0 . 2 . 4 - - - 2 1 2 4'] },
      outro: { bars: 2, chords: [5, 1], mel: ['4 - 2 - 1 - 2 - 0 - - - - - - -'], drums: four('........x.......', '........x.......', '..xx..xx..xx..xx'), bass: 'r...r...' },
    },
  },
  {
    id: 'garden', title: 'Lantern Lullaby', venue: 'The Lantern Garden', place: 'garden', color: '#e6a0c8', bpm: 96, meter: 4, res: 2, swing: 0, root: 63, mode: 'major', lead: 'sine',
    blurb: 'A sleepy slow dance under the paper lanterns, rocking like a music box. Soft and steady.',
    form: ['intro', 'a', 'b', 'a', 'b', 'outro'],
    sections: {
      intro: { bars: 4, chords: [1, 6, 4, 5], mel: ['. . . . . . . . . . . . . . . . 4 . 2 . 4 . 7 . 5 . 4 . 2 . 3 .'], drums: four('x...............', '................', '....x.......x...'), bass: 'r---f---' },
      a: { bars: 8, chords: [1, 6, 4, 5, 1, 6, 4, 1], drums: four('x.......x.......', '........x.......', 'x.x.x.xxx.x.x.xx'), bass: 'r---f---',
        mel: ['4 2 0 2 4 - 7 - 5 4 2 0 2 - 4 . 3 5 7 5 3 - 1 - 4 - - - 1 2 3 .', '4 2 0 2 4 - 7 - 9 7 5 4 5 - 7 . 3 5 7 5 3 2 1 2 0 - - - 2 . 3 .'] },
      b: { bars: 8, big: true, chords: [4, 1, 5, 6, 4, 1, 5, 1], drums: four('x.......x.......', '....X.......X...', 'x.xxx.xxx.xxx.xx'), bass: 'r-f-o-f-',
        mel: ['7 - 6 5 3 5 7 . 4 - 2 4 7 - 4 . 6 - 5 4 1 4 6 . 5 - 4 2 0 2 4 .', '7 - 6 5 3 5 7 . 9 - 7 4 2 4 7 . 8 - 6 4 1 2 4 6 7 - - - 4 5 6 .'] },
      outro: { bars: 4, chords: [4, 5, 1, 1], mel: ['5 - 4 - 3 - 2 - 1 - 2 - 3 - 2 - 0 - - - - - - - . . . . . . . .'], drums: four('x...............', '................', '....x.......x...'), bass: 'r-------' },
    },
  },
  {
    id: 'meadow', title: 'Clover Reel', venue: 'The Clover Fair', place: 'meadow', color: '#8fd06b', bpm: 138, meter: 4, res: 2, swing: 0, root: 62, mode: 'mixolydian', lead: 'square',
    blurb: 'A whirling reel round the maypole at the summer fair. Running notes that skip up and down.',
    form: ['intro', 'a', 'b', 'a', 'b', 'c', 'b', 'b', 'outro'],
    sections: {
      intro: { bars: 4, chords: [1, 7, 1, 7], mel: ['. . . . . . . . . . . . . . . . . . . . . . . . 0 1 2 3 4 . . .'], drums: four('x...x...x...x...', '....x.......x...', 'x.x.x.x.x.x.x.x.'), bass: 'r.f.r.f.' },
      a: { bars: 8, chords: [1, 1, 7, 7, 1, 1, 5, 1], drums: four('x...x...x...x...', '....x.......x...', 'x.x.x.x.x.x.x.x.'), bass: 'r.f.r.f.',
        mel: ['4 2 0 2 4 2 4 5 7 5 4 2 4 - 2 . 3 1 -1 1 3 1 3 4 6 4 3 1 3 - . .', '4 2 0 2 4 2 4 5 7 5 4 2 4 - 7 . 8 7 6 4 5 4 2 1 0 - - . 0 . . .'] },
      b: { bars: 8, big: true, chords: [4, 4, 1, 1, 4, 4, 5, 5], drums: four('x...x...x...x...', '....X.......X...', 'x.xox.xox.xox.xo'), bass: 'r.o.f.o.',
        mel: ['7 - 7 5 3 - 5 7 10 - 9 7 8 - 7 5 4 - 4 2 0 - 2 4 7 - - - 4 - - .', '7 - 7 5 3 - 5 7 10 - 9 7 8 - 10 11 8 - 6 4 1 - 4 6 8 - - - - - . .'] },
      c: { bars: 8, chords: [5, 4, 1, 1], drums: four('x.......x.......', '........x.......', 'x.x.x.x.x.x.x.x.'), bass: 'r---r---',
        mel: ['4 - - - 6 - - - 7 - 6 - 4 - 2 - 0 - - - 2 - 4 - 7 - - - - - - .'] },
      outro: { bars: 2, chords: [5, 1], mel: ['8 7 6 4 5 4 2 1 0 - - - - - - -'], drums: four('x...x...x...x...', '....x...........', 'x.x.x.x.x.......'), bass: 'r.f.r...' },
    },
  },
  {
    id: 'cafe', title: 'Raindrop Bossa', venue: 'The Raindrop Café', place: 'cafe', color: '#e0a86a', bpm: 112, meter: 4, res: 4, swing: 0, root: 62, mode: 'dorian', lead: 'sine',
    blurb: 'A cosy bossa nova while the rain taps the windows. Soft notes that tiptoe off the beat.',
    form: ['intro', 'a', 'b', 'a', 'b', 'c', 'b', 'outro'],
    sections: {
      intro: { bars: 4, chords: [1, 4, 1, 4], mel: ['. . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 4 . 3 . 2 . 1 .'], drums: four('x..x....x..x....', '................', 'x.x.x.x.x.x.x.x.'), bass: 'r..fr..f' },
      a: { bars: 8, chords: [1, 4, 3, 7], drums: four('x..x....x..x....', 'x..x..x...x.x...', 'x.x.x.x.x.x.x.x.'), bass: 'r..fr..f',
        mel: ['4 . . 4 . . 2 . 3 . 4 . . . . . 5 . . 5 . . 4 . 3 - - - . . . .', '2 . . 2 . . 4 . 6 . 4 . . . . . 6 . . 5 . . 4 . 3 - - - . . . .'] },
      b: { bars: 8, big: true, chords: [3, 7, 1, 1, 3, 7, 4, 4], drums: four('x..x....x..x....', 'x..X..x...X.x...', 'x.x.x.x.x.x.x.x.'), bass: 'r..fo..f',
        mel: ['6 - - - 7 . 6 . 4 . . 6 . . . . 8 - - - 9 . 8 . 6 . . 8 . . . .', '7 - - - 4 - - - 2 . 4 . 7 . . . 9 - - - - - - - 7 . . . . . . .'] },
      c: { bars: 8, chords: [4, 4, 3, 3], drums: four('x..x....x..x....', '..x.......x.....', 'x.x.x.x.x.x.x.x.'), bass: 'r---f---',
        mel: ['7 - - - - - 6 - 4 - - - 2 - - - 3 - - - 4 - - - 6 - - - 4 - - -'] },
      outro: { bars: 2, chords: [4, 1], mel: ['5 . . 4 . . 3 . 2 . . 1 . . . . 0 - - - - - - - - - - - . . . .'], drums: four('x..x....x..x....', 'x..x..x...x.x...', 'x.x.x.x.x.x.x.x.'), bass: 'r..fr...' },
    },
  },
  {
    id: 'storm', title: 'Thunder Peak Rock', venue: 'Thunder Peak', place: 'storm', color: '#7a8cff', bpm: 152, meter: 4, res: 2, swing: 0, root: 64, mode: 'minor', lead: 'sawtooth',
    blurb: 'Rock out on the clifftop while the friendly thunder rumbles. Fast, loud and full of leaps.',
    form: ['intro', 'a', 'b', 'a', 'b', 'c', 'b', 'b', 'outro'],
    sections: {
      intro: { bars: 4, chords: [1, 1, 1, 7], mel: ['0 . 0 3 . 0 4 . 3 . 2 . 0 . . . 0 . 0 3 . 0 4 . 6 . 4 . 3 . 2 .'], drums: four('x.....x.x.......', '....X.......X...', 'x.x.x.x.x.x.x.x.'), bass: 'rrrrrrrr' },
      a: { bars: 8, chords: [1, 6, 3, 7], drums: four('x.....x.x.......', '....X.......X...', 'x.x.x.x.x.x.x.x.'), bass: 'rrrrrrrr',
        mel: ['4 - 4 . 3 . 4 . 7 - 6 . 4 . 2 . 2 - 2 . 0 . 2 . 6 - - - . . . .', '4 - 4 . 3 . 4 . 7 - 6 . 4 . 7 . 9 - 9 . 8 . 9 . 10 - - - 8 . 6 .'] },
      b: { bars: 8, big: true, chords: [6, 7, 1, 1, 6, 7, 3, 3], drums: four('x.x...x.x.x...x.', '....X.......X...', 'xoxoxoxoxoxoxoxo'), bass: 'rrrrorrr',
        mel: ['9 - 9 - 7 - 9 - 10 - 10 - 8 - 6 - 7 - - - 4 - 7 - 9 - - - - - . .', '9 - 9 - 7 - 9 - 10 - 10 - 12 - 13 - 13 - - - 11 - 9 - 11 - - - - - . .'] },
      c: { bars: 8, chords: [4, 6, 4, 7], drums: four('x.......x.......', '........X.......', 'x...x...x...x...'), bass: 'r---r---',
        mel: ['4 - - - 3 - 2 - 0 - - - 2 - 4 - 5 - - - 4 - 3 - 4 - - - - - . .'] },
      outro: { bars: 2, chords: [7, 1], mel: ['6 . 8 . 10 . 11 . 7 - - - - - - -'], drums: four('x.....x.x.......', '....X...........', 'x.x.x.x.x.......'), bass: 'rrrrr...' },
    },
  },
  {
    id: 'stars', title: 'Encore!', venue: 'The Starlight Stage', place: 'stars', color: '#ffc76b', bpm: 128, meter: 4, res: 2, swing: 0, root: 72, mode: 'major', lead: 'square',
    blurb: 'The grand finale on a cloud among the stars: Burrow Bop comes back as a big disco anthem.',
    form: ['intro', 'a', 'b', 'a', 'b', 'c', 'b', 'b', 'outro'],
    sections: {
      intro: { bars: 4, chords: [1, 4, 1, 5], mel: ['. . . . . . . . . . . . . . . . . . . . . . . . 0 . 2 . 4 . 5 .'], drums: four('x...x...x...x...', '................', '..o...o...o...o.'), bass: 'roroo.ro' },
      a: { bars: 8, chords: [1, 6, 4, 5, 1, 6, 4, 5], drums: four('x...x...x...x...', '....x.......x...', '..o...o...o...o.'), bass: 'roroo.ro',
        mel: ['4 . 4 2 4 - 5 4 2 - 0 . 2 4 2 0 3 - 3 5 7 - 5 3 4 - - . 1 2 1 -', '4 . 4 2 4 - 5 7 9 - 7 . 5 4 2 . 3 . 5 3 2 . 1 2 0 - - - . . . .'] },
      b: { bars: 8, big: true, chords: [4, 5, 3, 6, 4, 5, 1, 1], drums: four('x...x...x...x...', '....X.......X...', 'xxoxxxoxxxoxxxox'), bass: 'roroo.ro',
        mel: ['5 - 5 7 9 - 7 5 6 - 4 - 6 7 6 4 4 - 2 4 6 - 4 2 5 - - . 4 5 7 -', '5 - 5 7 9 - 10 9 8 - 7 - 6 - 4 . 7 - 4 2 0 - 2 4 7 - - - . . . .'] },
      c: { bars: 8, chords: [6, 4, 1, 5], drums: four('x...x...x...x...', '....x.......x...', '..o...o...o...o.'), bass: 'r.r.r.r.',
        mel: ['9 - 7 - 5 - 4 - 7 - 5 - 4 - 2 - 4 - 5 - 7 - 9 - 11 - - - 12 - - -'] },
      outro: { bars: 4, chords: [4, 5, 1, 1], mel: ['5 - 4 - 2 - 1 - 2 - - - 4 - - - 7 - - - - - - - . . . . . . . .'], drums: four('x...x...x...x...', '....x.......x...', '..o...o...o...o.'), bass: 'roroo.ro' },
    },
  },
];
export const songById = (id: string) => SONGS.find((s) => s.id === id) ?? SONGS[0];

// ---------------------------------------------------------------- composing
const tokens = (s: string) => s.trim().split(/\s+/);
/** Seconds per beat, and the time of a beat with this song's swing on the offbeat 8ths. */
const clock = (s: Song) => {
  const spb = 60 / s.bpm;
  return { spb, at: (beat: number) => { const whole = Math.floor(beat + 1e-9), frac = beat - whole; return (whole + (s.swing && Math.abs(frac - 0.5) < 1e-6 ? 0.5 + s.swing : frac)) * spb; } };
};

export type Score = { events: MusicEvent[]; cues: Cue[]; end: number; bars: number; sections: { name: string; t: number }[] };
const scores = new Map<string, Score>();
/** Builds the whole song once: the music the speakers play and the cues the charts are picked from. */
export function compose(s: Song): Score {
  const hit = scores.get(s.id); if (hit) return hit;
  const { spb, at } = clock(s), events: MusicEvent[] = [], cues: Cue[] = [], sections: { name: string; t: number }[] = [];
  let bar = 0, phraseNo = 0;
  s.form.forEach((name, fi) => {
    const sec = s.sections[name], last = fi === s.form.length - 1;
    sections.push({ name, t: at(bar * s.meter) });
    // the melody: phrases cycled across the section, each token one step of the song's grid
    const steps = sec.bars * s.meter * s.res, mel: string[] = [];
    for (let p = 0; mel.length < steps; p++) mel.push(...tokens(sec.mel[p % sec.mel.length]));
    let sounding = -1;
    const notes: { step: number; len: number; deg: number }[] = [];
    for (let i = 0; i < steps; i++) {
      const tk = mel[i];
      if (tk === '-') { if (sounding >= 0) notes[sounding].len++; continue; }
      if (tk === '.') { sounding = -1; continue; }
      notes.push({ step: i, len: 1, deg: Number(tk) }); sounding = notes.length - 1;
    }
    const restingAt = (beatInSec: number) => !notes.some((n) => beatInSec >= n.step / s.res - 1e-6 && beatInSec < (n.step + n.len) / s.res - 1e-6);
    const phraseBars = (tokens(sec.mel[0]).length / (s.meter * s.res)) || sec.bars;
    for (const n of notes) {
      const beat = bar * s.meter + n.step / s.res, len = n.len / s.res, t = at(beat), dur = at(beat + len) - t;
      events.push({ t, dur: dur * 0.92, inst: 'lead', midi: pitch(s, n.deg), vel: 0.8 });
      if (sec.big) events.push({ t, dur: Math.min(dur, spb), inst: 'bell', midi: pitch(s, n.deg) + 12, vel: 0.35 });
      const inBar = n.step / s.res - Math.floor(n.step / (s.meter * s.res)) * s.meter;
      cues.push({ t, beat, frac: beat - Math.floor(beat + 1e-9), len, src: 'mel', deg: n.deg, big: !!sec.big, sectionStart: n.step < s.meter * s.res && n.step === notes[0].step, barStart: Math.abs(inBar) < 1e-6, resting: false, phrase: phraseNo + Math.floor(n.step / (phraseBars * s.meter * s.res)) });
    }
    phraseNo += Math.ceil(sec.bars / phraseBars);
    for (let b = 0; b < sec.bars; b++) {
      const startBeat = (bar + b) * s.meter, chord = sec.chords[b % sec.chords.length] - 1, fill = b === sec.bars - 1 && !last && sec.bars >= 4;
      // pad chord and bass line
      const triad = [chord, chord + 2, chord + 4].map((d) => pitch(s, d) - 12);
      triad.forEach((m) => events.push({ t: at(startBeat), dur: s.meter * spb * 0.96, inst: 'pad', midi: m, vel: 0.22 }));
      const bass = sec.bass;
      for (let i = 0; i < s.meter * 2; i++) {
        const ch = bass[i % bass.length];
        if (ch === '.' || ch === '-') continue;
        let len = 1; while (bass[(i + len) % bass.length] === '-' && i + len < s.meter * 2) len++;
        const deg = chord + (ch === 'f' ? 4 : ch === 't' ? 2 : ch === 'o' ? 7 : 0);
        const t = at(startBeat + i / 2);
        events.push({ t, dur: at(startBeat + (i + len) / 2) - t - 0.02, inst: 'bass', midi: pitch(s, deg) - 24, vel: 0.7 });
      }
      // drums, with a snare roll into the next section
      const g = s.meter * 4;
      for (let i = 0; i < g; i++) {
        const beat = startBeat + i / 4, t = at(beat), lastBeat = i >= g - 4;
        const k = fill && lastBeat ? '.' : sec.drums.k[i], sn = fill && lastBeat ? 'x' : sec.drums.s[i], h = sec.drums.h[i];
        const base = { beat, frac: i % 4 / 4, len: 0, deg: 0, big: !!sec.big, sectionStart: b === 0 && i === 0, barStart: i === 0, resting: restingAt(b * s.meter + i / 4), phrase: phraseNo - 1 };
        if (k === 'x' || k === 'X') { events.push({ t, dur: 0.2, inst: 'kick', midi: 36, vel: k === 'X' ? 1 : 0.85 }); cues.push({ ...base, t, src: 'kick' }); }
        if (sn === 'x' || sn === 'X') { events.push({ t, dur: 0.15, inst: fill && lastBeat ? 'snare' : sec.big && sn === 'X' ? 'clap' : 'snare', midi: 38, vel: sn === 'X' ? 0.9 : fill && lastBeat ? 0.35 + (i - (g - 4)) * 0.12 : 0.7 }); cues.push({ ...base, t, src: 'snare' }); }
        if (h === 'x' || h === 'o') { events.push({ t, dur: h === 'o' ? 0.18 : 0.04, inst: h === 'o' ? 'open' : 'hat', midi: 42, vel: i % 4 === 0 ? 0.5 : 0.32 }); cues.push({ ...base, t, src: 'hat' }); }
      }
    }
    bar += sec.bars;
  });
  // the closing crash: one last kick and a held chord
  const endBeat = bar * s.meter, end = at(endBeat);
  events.push({ t: end, dur: 0.3, inst: 'kick', midi: 36, vel: 1 }, { t: end, dur: 0.6, inst: 'open', midi: 42, vel: 0.6 });
  [0, 2, 4, 7].forEach((d) => events.push({ t: end, dur: spb * 3, inst: 'pad', midi: pitch(s, d), vel: 0.3 }));
  events.sort((a, b) => a.t - b.t); cues.sort((a, b) => a.t - b.t || (a.src === 'mel' ? -1 : 1));
  const score = { events, cues, end: end + spb * 3, bars: bar, sections };
  scores.set(s.id, score);
  return score;
}

// ---------------------------------------------------------------- charting
/** What each difficulty may pick: the grid it reads, the closest two notes may be, holds and chords. */
export const DIFF: Record<Diff, { name: string; grid: number; gap: number; gapBeats: number; laneGap: number; hold: number; chordEvery: number; drumGrid: number; hats: boolean; overlap: boolean; miss: number; level: number }> = {
  easy: { name: 'Easy', grid: 1, gap: 0.55, gapBeats: 1, laneGap: 0.5, hold: 2, chordEvery: 0, drumGrid: 2, hats: false, overlap: false, miss: 5, level: 1 },
  normal: { name: 'Normal', grid: 0.5, gap: 0.2, gapBeats: 0.5, laneGap: 0.3, hold: 1.5, chordEvery: 2, drumGrid: 1, hats: false, overlap: false, miss: 7, level: 2 },
  hard: { name: 'Hard', grid: 0.25, gap: 0.12, gapBeats: 0.25, laneGap: 0.17, hold: 1.5, chordEvery: 1, drumGrid: 0.25, hats: true, overlap: true, miss: 8, level: 3 },
};
export const DIFFS: Diff[] = ['easy', 'normal', 'hard'];
const onGrid = (beat: number, grid: number) => Math.abs(beat / grid - Math.round(beat / grid)) < 1e-6;

const charts = new Map<string, Chart>();
/** Picks the chart for a song: melody notes follow the tune left to right as it rises, drums fill the rests, long notes become holds. */
export function chart(s: Song, diff: Diff): Chart {
  const key = s.id + ':' + diff, hit = charts.get(key); if (hit) return hit;
  const D = DIFF[diff], sc = compose(s), spb = 60 / s.bpm, gap = Math.max(D.gap, D.gapBeats * spb * (1 - 2 * s.swing) * 0.98);
  // each phrase's pitch range, so a phrase uses all four lanes
  const range = new Map<number, [number, number]>();
  for (const c of sc.cues) if (c.src === 'mel') { const r = range.get(c.phrase) ?? [c.deg, c.deg]; range.set(c.phrase, [Math.min(r[0], c.deg), Math.max(r[1], c.deg)]); }
  const notes: Note[] = [], laneFree = [-9, -9, -9, -9];
  let lastT = -9, busyUntil = -9, lastLane = 1, drumFlip = 0, chordCount = 0, prevDeg: number | null = null;
  const laneFor = (c: Cue) => {
    if (c.src !== 'mel') {
      if (c.src === 'hat') return (drumFlip++ % 2) * 3;
      // drums sit on the inside lanes, kick and snare apart; a kick steps away from the last note
      const odd = Math.floor(c.beat / s.meter) % 2 === 1, want = c.src === 'kick' ? (odd ? 0 : 1) : odd ? 3 : 2;
      return want === lastLane && laneFree[3 - want] <= c.t ? 3 - want : want;
    }
    const [lo, hi] = range.get(c.phrase) ?? [0, 7];
    let lane = hi > lo ? Math.round(((c.deg - lo) / (hi - lo)) * 3) : 1;
    // the same pitch again stays put, a step up or down never lands on the same lane
    if (prevDeg !== null && c.deg !== prevDeg && lane === lastLane) lane = c.deg > prevDeg ? Math.min(3, lane + 1) : Math.max(0, lane - 1);
    if (prevDeg !== null && c.deg !== prevDeg && lane === lastLane) lane = lastLane === 0 ? 1 : lastLane === 3 ? 2 : c.deg > prevDeg ? lane - 1 : lane + 1;
    return lane;
  };
  for (const c of sc.cues) {
    if (c.src === 'hat' && !D.hats) continue;
    if (c.src === 'mel' ? !onGrid(c.beat, D.grid) : !onGrid(c.beat, D.drumGrid)) continue;
    // drums only fill where the tune rests (hard also plays the off-beat hats around long notes)
    if (c.src !== 'mel' && !c.resting && !(D.hats && c.src === 'hat' && c.t >= busyUntil - 1e-6 && c.t > lastT + spb * 0.49)) continue;
    if (c.src === 'hat' && !onGrid(c.beat + 0.5, 1)) continue;
    if (c.t - lastT < gap - 1e-6) continue;
    if (!D.overlap && c.t < busyUntil + 0.12) continue;
    let lane = laneFor(c);
    if (laneFree[lane] > c.t) {
      const free = [0, 1, 2, 3].filter((l) => laneFree[l] <= c.t).sort((a, b) => Math.abs(a - lane) - Math.abs(b - lane));
      if (!free.length) continue;
      lane = free[0];
    }
    const holdBeats = c.src === 'mel' && c.len >= D.hold ? c.len - 0.5 : 0;
    const len = holdBeats ? holdBeats * spb : 0;
    notes.push({ id: notes.length, t: c.t, lane, len, chord: false });
    laneFree[lane] = c.t + len + D.laneGap;
    if (len) busyUntil = c.t + len;
    // a chord on strong downbeats of the chorus, on the lane furthest from the tune
    if (D.chordEvery && c.src === 'mel' && c.big && (c.barStart || c.sectionStart) && (!len || diff === 'hard')) {
      if (chordCount++ % D.chordEvery === 0) {
        const other = [3, 0, 2, 1].map((l) => (lane < 2 ? l : 3 - l)).find((l) => l !== lane && laneFree[l] <= c.t && Math.abs(l - lane) >= 2);
        if (other !== undefined) { notes[notes.length - 1].chord = true; notes.push({ id: notes.length, t: c.t, lane: other, len: 0, chord: true }); laneFree[other] = c.t + D.laneGap; }
      }
    }
    lastT = c.t; lastLane = lane; if (c.src === 'mel') prevDeg = c.deg;
  }
  const end = Math.max(sc.end, ...notes.map((n) => n.t + n.len + 1));
  const out = { song: s.id, diff, notes, end, spb };
  charts.set(key, out);
  return out;
}

// ---------------------------------------------------------------- judging
export type Judge = 'perfect' | 'great' | 'good' | 'miss';
export const WINDOW = { perfect: 0.045, great: 0.09, good: 0.135 };
/** How far before a note a press is still read as an early miss of it rather than a stray. */
export const STRAY = 0.2;
export const POINTS = { perfect: 100, great: 70, good: 40, miss: 0, hold: 100 };
export const GROOVE = { start: 50, perfect: 2, great: 1.5, good: 0.5, hold: 1, drop: 5, stray: 2 };
/** Dust Up: needs half a sparkle meter, and lasts 16 beats when the meter is full. */
export const DUST_UP = { need: 50, beats: 16, perfect: 4, great: 2, good: 1 };
export const multiplier = (combo: number) => 1 + Math.min(3, Math.floor(combo / 20));
export const grade = (acc: number) => (acc >= 95 ? 'S' : acc >= 88 ? 'A' : acc >= 78 ? 'B' : acc >= 65 ? 'C' : 'D');
export type DiscoEvent =
  | { kind: 'judge'; judge: Judge; lane: number; t: number; offset: number; combo: number; chord: boolean }
  | { kind: 'hold'; lane: number; t: number }
  | { kind: 'drop'; lane: number; t: number }
  | { kind: 'stray'; lane: number; t: number }
  | { kind: 'dustup'; t: number; until: number }
  | { kind: 'dustdown'; t: number }
  | { kind: 'milestone'; combo: number; t: number }
  | { kind: 'fail'; t: number }
  | { kind: 'clear'; t: number };
type NoteState = { judge: Judge | null; holding: boolean; tail: 'ok' | 'drop' | null };

export class DiscoGame {
  readonly song: Song; readonly diff: Diff; readonly chart: Chart; readonly noFail: boolean;
  state: 'play' | 'clear' | 'fail' = 'play';
  time = -60; score = 0; combo = 0; maxCombo = 0; groove = GROOVE.start; sparkle = 0; dustUntil = -1e9;
  counts = { perfect: 0, great: 0, good: 0, miss: 0, hold: 0, drop: 0, stray: 0 };
  /** Signed timing of every judged press in seconds, negative is early, for the results screen. */
  offsets: number[] = [];
  readonly notes: NoteState[];
  readonly down = [false, false, false, false];
  events: DiscoEvent[] = [];
  private cursor = 0;
  constructor(songId: string, diff: Diff, opts: { noFail?: boolean } = {}) {
    this.song = songById(songId); this.diff = diff; this.chart = chart(this.song, diff); this.noFail = !!opts.noFail;
    this.notes = this.chart.notes.map(() => ({ judge: null, holding: false, tail: null }));
  }
  get dustUp() { return this.time < this.dustUntil; }
  get total() { return this.chart.notes.length + this.chart.notes.filter((n) => n.len > 0).length; }
  /** Accuracy so far, 0..100, over everything already judged. */
  get accuracy() {
    const c = this.counts, judged = c.perfect + c.great + c.good + c.miss + c.hold + c.drop;
    return judged ? (100 * (c.perfect * POINTS.perfect + c.great * POINTS.great + c.good * POINTS.good + c.hold * POINTS.hold)) / (judged * 100) : 100;
  }
  get progress() { return Math.max(0, Math.min(1, this.time / this.chart.end)); }
  private emit(e: DiscoEvent) { this.events.push(e); }
  private bump(n: number) {
    this.groove = Math.max(0, Math.min(100, this.groove + n));
    if (this.groove <= 0 && !this.noFail && this.state === 'play') { this.state = 'fail'; this.emit({ kind: 'fail', t: this.time }); }
  }
  private count(j: Judge, lane: number, t: number, offset: number, chord: boolean) {
    this.counts[j]++;
    if (j === 'miss') { this.combo = 0; this.bump(-DIFF[this.diff].miss); }
    else {
      this.combo++; this.maxCombo = Math.max(this.maxCombo, this.combo); this.offsets.push(offset);
      this.score += POINTS[j] * multiplier(this.combo) * (this.dustUp ? 2 : 1);
      this.bump(GROOVE[j]);
      if (!this.dustUp) this.sparkle = Math.min(100, this.sparkle + DUST_UP[j]);
      if (this.combo % 50 === 0) this.emit({ kind: 'milestone', combo: this.combo, t });
    }
    this.emit({ kind: 'judge', judge: j, lane, t, offset, combo: this.combo, chord });
  }
  /** A lane pressed at song time `t`. */
  press(lane: number, t: number) {
    if (this.state !== 'play' || lane < 0 || lane > 3) return;
    this.tick(t); this.down[lane] = true;
    const notes = this.chart.notes;
    let best = -1, bestGap = Infinity;
    for (let i = this.cursor; i < notes.length && notes[i].t <= t + STRAY; i++) {
      const n = notes[i];
      if (n.lane !== lane || this.notes[i].judge) continue;
      const d = Math.abs(t - n.t); if (d < bestGap) { best = i; bestGap = d; }
    }
    if (best < 0 || bestGap > STRAY) { this.counts.stray++; this.bump(-GROOVE.stray); this.emit({ kind: 'stray', lane, t }); return; }
    const n = notes[best], off = t - n.t;
    // too early for any window: an early miss, so mashing never pays
    const j: Judge = bestGap <= WINDOW.perfect ? 'perfect' : bestGap <= WINDOW.great ? 'great' : bestGap <= WINDOW.good ? 'good' : 'miss';
    this.notes[best].judge = j;
    if (j !== 'miss' && n.len > 0) this.notes[best].holding = true;
    else if (n.len > 0) { this.notes[best].tail = 'drop'; this.counts.drop++; this.combo = 0; }
    this.count(j, lane, t, off, n.chord);
  }
  /** A lane let go at song time `t`: a hold let go well before its end is dropped. */
  release(lane: number, t: number) {
    if (lane < 0 || lane > 3) return;
    this.down[lane] = false;
    if (this.state !== 'play') return;
    this.tick(t);
    const i = this.notes.findIndex((s, k) => s.holding && this.chart.notes[k].lane === lane);
    if (i < 0) return;
    const n = this.chart.notes[i], st = this.notes[i];
    st.holding = false;
    if (t >= n.t + n.len - WINDOW.great) this.finishHold(i, t);
    else { st.tail = 'drop'; this.counts.drop++; this.combo = 0; this.bump(-GROOVE.drop); this.emit({ kind: 'drop', lane, t }); }
  }
  private finishHold(i: number, t: number) {
    const st = this.notes[i]; st.holding = false; st.tail = 'ok'; this.counts.hold++;
    this.score += POINTS.hold * multiplier(this.combo) * (this.dustUp ? 2 : 1); this.bump(GROOVE.hold);
    this.emit({ kind: 'hold', lane: this.chart.notes[i].lane, t });
  }
  /** Spends the sparkle meter on Dust Up: double points until it runs out. */
  dust(t: number) {
    if (this.state !== 'play' || this.dustUp || this.sparkle < DUST_UP.need) return false;
    this.tick(t);
    this.dustUntil = t + (this.sparkle / 100) * DUST_UP.beats * this.chart.spb; this.sparkle = 0;
    this.emit({ kind: 'dustup', t, until: this.dustUntil });
    return true;
  }
  /** Moves the song clock: notes that slipped past are missed, finished holds pay out, the song ends. */
  tick(t: number) {
    if (this.state !== 'play' || t < this.time) return;
    const wasDust = this.dustUp;
    this.time = t;
    if (wasDust && !this.dustUp) this.emit({ kind: 'dustdown', t: this.dustUntil });
    const notes = this.chart.notes;
    for (let i = this.cursor; i < notes.length && notes[i].t < t - WINDOW.good; i++) {
      const st = this.notes[i];
      if (!st.judge) { st.judge = 'miss'; if (notes[i].len > 0) { st.tail = 'drop'; this.counts.drop++; } this.count('miss', notes[i].lane, notes[i].t + WINDOW.good, WINDOW.good, notes[i].chord); if (this.state !== 'play') return; }
    }
    while (this.cursor < notes.length && this.notes[this.cursor].judge && (!notes[this.cursor].len || this.notes[this.cursor].tail)) this.cursor++;
    for (let i = this.cursor; i < notes.length && notes[i].t <= t; i++) if (this.notes[i].holding && t >= notes[i].t + notes[i].len) this.finishHold(i, notes[i].t + notes[i].len);
    if (t >= this.chart.end && this.state === 'play') { this.state = 'clear'; this.emit({ kind: 'clear', t }); }
  }
  /** Whether a hold is being held right now, for drawing. */
  holding(i: number) { return this.notes[i].holding; }
  result() {
    const acc = this.accuracy, c = this.counts, cleared = this.state === 'clear';
    const full = cleared && c.miss === 0 && c.drop === 0, all = full && c.great === 0 && c.good === 0;
    const g = cleared ? grade(acc) : 'D';
    return { song: this.song.id, diff: this.diff, score: Math.round(this.score), accuracy: Math.round(acc * 10) / 10, grade: g, cleared, fullCombo: full, allPerfect: all, maxCombo: this.maxCombo, stars: cleared ? (g === 'S' ? 3 : g === 'A' ? 2 : 1) : 0, counts: { ...c } };
  }
}

// ---------------------------------------------------------------- saving
export const SAVE_KEY = 'dust-disco-v1';
export type Best = { score: number; accuracy: number; grade: string; stars: number; fullCombo: boolean; allPerfect: boolean; plays: number };
export type Profile = { best: Record<string, Best>; speed: number; offset: number; noFail: boolean; hitSounds: boolean; song: string; diff: Diff };
export const freshProfile = (): Profile => ({ best: {}, speed: 5, offset: 0, noFail: false, hitSounds: true, song: SONGS[0].id, diff: 'easy' });
const isDiff = (d: unknown): d is Diff => d === 'easy' || d === 'normal' || d === 'hard';
/** Reads a save, keeping only what makes sense; anything broken starts afresh. */
export function readProfile(raw: string | null): Profile {
  const p = freshProfile(); if (!raw) return p;
  try {
    const o = JSON.parse(raw) as Partial<Profile>; if (!o || typeof o !== 'object') return p;
    if (typeof o.speed === 'number' && o.speed >= 1 && o.speed <= 10) p.speed = Math.round(o.speed);
    if (typeof o.offset === 'number' && Math.abs(o.offset) <= 250) p.offset = Math.round(o.offset);
    p.noFail = o.noFail === true; p.hitSounds = o.hitSounds !== false;
    if (typeof o.song === 'string' && SONGS.some((s) => s.id === o.song)) p.song = o.song;
    if (isDiff(o.diff)) p.diff = o.diff;
    if (o.best && typeof o.best === 'object') for (const [k, b] of Object.entries(o.best)) {
      const [id, d] = k.split(':');
      if (!SONGS.some((s) => s.id === id) || !isDiff(d) || !b || typeof b.score !== 'number') continue;
      p.best[k] = { score: b.score, accuracy: Number(b.accuracy) || 0, grade: String(b.grade ?? 'D'), stars: Math.max(0, Math.min(3, Number(b.stars) || 0)), fullCombo: !!b.fullCombo, allPerfect: !!b.allPerfect, plays: Number(b.plays) || 1 };
    }
  } catch { return freshProfile(); }
  return p;
}
export const cleared = (p: Profile, id: string) => DIFFS.some((d) => (p.best[id + ':' + d]?.stars ?? 0) > 0);
/** A song opens once the one before it is cleared on any difficulty. */
export const unlocked = (p: Profile, i: number) => i <= 0 || cleared(p, SONGS[i - 1].id);
export const totalStars = (p: Profile) => Object.values(p.best).reduce((n, b) => n + b.stars, 0);
/** Folds a finished song into the save and says what is new. */
export function record(p: Profile, r: ReturnType<DiscoGame['result']>): string[] {
  const key = r.song + ':' + r.diff, old = p.best[key], news: string[] = [];
  const i = SONGS.findIndex((s) => s.id === r.song), wasOpen = i + 1 < SONGS.length && unlocked(p, i + 1);
  const next: Best = old ? { ...old, plays: old.plays + 1 } : { score: 0, accuracy: 0, grade: '-', stars: 0, fullCombo: false, allPerfect: false, plays: 1 };
  p.best[key] = next;
  if (!r.cleared) return news;
  if (old && old.stars > 0 && r.score > old.score) news.push('NEW BEST');
  if (r.score > next.score || next.stars === 0) { next.score = r.score; next.accuracy = r.accuracy; next.grade = r.grade; }
  next.stars = Math.max(next.stars, r.stars);
  if (r.fullCombo && !next.fullCombo) news.push('FULL COMBO');
  if (r.allPerfect && !next.allPerfect) news.push('ALL PERFECT');
  next.fullCombo ||= r.fullCombo; next.allPerfect ||= r.allPerfect;
  p.best[key] = next;
  if (!wasOpen && i + 1 < SONGS.length && unlocked(p, i + 1)) news.push('NEW SONG: ' + SONGS[i + 1].title.toUpperCase());
  return news;
}
