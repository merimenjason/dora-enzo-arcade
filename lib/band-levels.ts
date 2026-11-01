// Woodland Band: the five clearings and their thirty requests, each with its starting song, the cast who may join,
// what the audience asks for (a hummed tune, a mood, a fix, or a three-musician limit), the flourish for the third
// star, par for the second, and a designed solution. Also unlocking and progress. tests/band-bot.mjs checks every
// solution earns three stars, that a searching solver solves each request within par, and that random grids don't.
import { R, type Clearing, type MusicianId, type Request, type Row, type Rule, type Save, type Song } from './band-game.js';

const song = (key: number, steps: number, bpm: number, swing: number, rows: Row[]): Song => ({ key, steps, bpm, swing, rows });
const C1: MusicianId[] = ['hedgehog', 'frog', 'enzo', 'dora'];
const C2: MusicianId[] = ['hedgehog', 'woodpecker', 'frog', 'owl', 'enzo', 'dora'];
const C3: MusicianId[] = ['hedgehog', 'woodpecker', 'frog', 'mole', 'owl', 'enzo', 'dora'];
const C4: MusicianId[] = ['hedgehog', 'woodpecker', 'frog', 'mole', 'owl', 'enzo', 'dora', 'birds'];
type Def = Omit<Request, 'id' | 'clearing' | 'n' | 'rules'> & { rules?: Rule[] };
const mossy = (rows: Row[], bpm = 96) => song(0, 8, bpm, 0, rows);
const river = (rows: Row[], bpm = 104) => song(1, 16, bpm, 0.12, rows);
const ring = (rows: Row[], bpm = 112) => song(2, 16, bpm, 0.18, rows);
const tree = (rows: Row[], bpm = 120) => song(3, 16, bpm, 0, rows);
const moon = (rows: Row[], bpm = 92) => song(4, 16, bpm, 0.1, rows);
const E8 = '........', E16 = '................';

const DEFS: Def[][] = [
  // ---------------------------------------------------------------- Mossy Hollow: C pentatonic, 8 steps
  [
    {
      name: 'Four Big Thumps', kind: 'echo', cast: C1,
      ask: 'A beat! A beat! Four big thumps, please, one on every big beat.', after: 'The rabbits thump their feet right along.',
      start: mossy([R('hedgehog', E8), R('dora', '0...4...')]),
      target: [R('hedgehog', '0.0.0.0.')],
      flourish: { text: 'Enzo joins in with a sparkle', rule: { k: 'has', m: ['enzo'] } }, par: 6,
      sol: { rows: [R('hedgehog', '0.0.0.0.'), R('enzo', '....7...'), R('dora', '0...4...')] },
      tip: { title: 'Tap to play', text: 'Tap the glowing rings on the hedgehog’s row to put a beat in each. The band plays round and round, so you hear every change.' },
    },
    {
      name: 'Low, Then High', kind: 'echo', cast: C1,
      ask: 'The pond frogs hum a bass line: a low note, then a higher one. Hum it back!', after: 'Ribbit! The frogs are very impressed.',
      start: mossy([R('hedgehog', '0.1.0.1.'), R('frog', E8), R('dora', '0...4...')]),
      target: [R('frog', '0...3...')],
      flourish: { text: 'Dora strums on all four big beats', rule: { k: 'count', m: 'dora', min: 4, max: 8 } }, par: 4,
      sol: { rows: [R('hedgehog', '0.1.0.1.'), R('frog', '0...3...'), R('dora', '0.0.4.4.')] },
      tip: { title: 'Drag for pitch', text: 'Drag up or down on a note to make it higher or lower. Press “Hear the tune” to hear the audience hum, then match them.' },
    },
    {
      name: 'Something Sleepy', kind: 'mood', cast: C1, tempo: [60, 140],
      ask: 'The dormice are yawning. Something sleepy, please: slow and soft, and no drums.', after: 'Zzz. Three dormice asleep in a row.',
      start: mossy([R('hedgehog', '01010101'), R('enzo', '75757575'), R('dora', '0.0.4.4.')], 120),
      rules: [{ k: 'tempo', min: 60, max: 80 }, { k: 'density', min: 0, max: 1 }, { k: 'lacks', m: ['hedgehog'] }, { k: 'has', m: ['dora'] }],
      flourish: { text: 'Enzo hums along softly: two or three notes', rule: { k: 'count', m: 'enzo', min: 2, max: 3 } }, par: 6,
      sol: { bpm: 72, rows: [R('enzo', '7...7..5'), R('dora', '0.0.4.4.')] },
      tip: { title: 'A mood', text: 'The card lists what the audience means. Turn the tempo dial, take a musician off with ✕, and thin out the notes until every line has a tick.' },
    },
    {
      name: 'The Wandering Frog', kind: 'fix', cast: C1,
      ask: 'The frog keeps croaking in the wrong places. The bass should land with every kick drum.', after: 'Thump and pluck, together at last.',
      start: mossy([R('hedgehog', '0.1.001.'), R('frog', '..0.0..0'), R('dora', '0...4...')]),
      rules: [{ k: 'with', a: 'frog', b: 'hedgehog', bp: 0 }],
      flourish: { text: 'The frog’s last note is a high G', rule: { k: 'ends', m: 'frog', p: 3 } }, par: 5,
      sol: { rows: [R('hedgehog', '0.1.001.'), R('frog', '0...03..'), R('dora', '0...4...')] },
      tip: { title: 'Fix the band', text: 'One musician is off. Kicks are the low drum notes. Move the frog’s notes so they land with the kicks, and nowhere else.' },
    },
    {
      name: 'Three on a Log', kind: 'limit', cast: C1, maxRows: 3,
      ask: 'Only three musicians fit on the mossy log, but make it bouncy!', after: 'The log bounces. So do the rabbits.',
      start: mossy([R('hedgehog', '0.1.0.1.'), R('frog', '0...3...'), R('enzo', '7.5.7.5.'), R('dora', '0...4...')]),
      rules: [{ k: 'has', m: ['hedgehog'] }, { k: 'sync', min: 0.4, max: 1 }, { k: 'density', min: 1.25, max: 99 }],
      flourish: { text: 'Enzo stays in the band', rule: { k: 'has', m: ['enzo'] } }, par: 8,
      sol: { rows: [R('hedgehog', '02120212'), R('frog', '0...3...'), R('enzo', '7655765.')] },
      tip: { title: 'Only three', text: 'The log holds three. Take one musician off, then fill the gaps between the big beats so it bounces.' },
    },
    {
      name: 'Mossy Hollow Hoedown', kind: 'mood', cast: C1, tempo: [60, 160],
      ask: 'Everybody in! Make the squirrels dance: quick, busy and bouncy, the frog with the kicks.', after: 'A hoedown! The squirrels do-si-do.',
      start: mossy([R('hedgehog', '0.1.0.1.'), R('frog', '0...3...'), R('dora', '0...4...')]),
      rules: [{ k: 'tempo', min: 112, max: 180 }, { k: 'band', min: 4, max: 99 }, { k: 'density', min: 2, max: 99 }, { k: 'sync', min: 0.25, max: 1 }, { k: 'with', a: 'frog', b: 'hedgehog', bp: 0 }],
      flourish: { text: 'Enzo’s sparkles climb: six or more, each higher', rule: { k: 'climb', m: 'enzo', min: 6 } }, par: 9,
      sol: { bpm: 120, rows: [R('hedgehog', '0.1.0.1.'), R('frog', '0...3...'), R('enzo', '01234567'), R('dora', '0...4...')] },
    },
  ],
  // ---------------------------------------------------------------- Riverbank: F major, 16 steps, a little swing
  [
    {
      name: 'Knock on the Reeds', kind: 'echo', cast: C2,
      ask: 'The otters tap a rhythm on the reeds: knock, knock, knock, then down the blocks.', after: 'The otters tap along on their tummies.',
      start: river([R('hedgehog', '0...1...0...1...'), R('woodpecker', E16), R('frog', '0.......4.......'), R('dora', '0.......3.......')]),
      target: [R('woodpecker', '..2...2...2.1.0.')],
      flourish: { text: 'The owl joins in', rule: { k: 'has', m: ['owl'] } }, par: 8,
      sol: { rows: [R('hedgehog', '0...1...0...1...'), R('woodpecker', '..2...2...2.1.0.'), R('frog', '0.......4.......'), R('owl', '....4.......2...'), R('dora', '0.......3.......')] },
      tip: { title: 'Sixteen steps', text: 'By the river the bar has sixteen steps. The big beats are the ones with the mustard marks.' },
    },
    {
      name: 'The Owl’s Lullaby', kind: 'echo', cast: C2,
      ask: 'A heron hums the owl a lullaby. Can the owl play it back?', after: 'The heron stands on one leg and sighs.',
      start: river([R('frog', '0.......3.......'), R('owl', E16), R('dora', '0.......3.......')]),
      target: [R('owl', '0.2.4...3.2.1...')],
      flourish: { text: 'A kick drum on the very first step', rule: { k: 'at', m: 'hedgehog', step: 0, p: 0 } }, par: 8,
      sol: { rows: [R('hedgehog', '0...............'), R('frog', '0.......3.......'), R('owl', '0.2.4...3.2.1...'), R('dora', '0.......3.......')] },
    },
    {
      name: 'Rapids!', kind: 'mood', cast: C2, tempo: [60, 180],
      ask: 'Fast as the rapids! Quick and busy, with the woodpecker knocking too.', after: 'Whoosh! The otters ride the rapids twice.',
      start: river([R('hedgehog', '0.1.0.1.0.1.0.1.'), R('woodpecker', E16), R('frog', '0...0...4...4...')]),
      rules: [{ k: 'tempo', min: 140, max: 180 }, { k: 'density', min: 1.25, max: 99 }, { k: 'has', m: ['woodpecker', 'hedgehog'] }],
      flourish: { text: 'The hedgehog plays the tishy hat', rule: { k: 'uses', m: 'hedgehog', p: 2 } }, par: 10,
      sol: { bpm: 150, rows: [R('hedgehog', '0.1.0.1.0.1.0.2.'), R('woodpecker', '.2.2.2.2.2.2.2.2'), R('frog', '0...0...4...4...')] },
    },
    {
      name: 'Stepping Stones', kind: 'fix', cast: C2,
      ask: 'The owl’s tune trips on the stepping stones. Every note should climb higher than the last.', after: 'Hop, hop, hop, all the way across.',
      start: river([R('hedgehog', '0...1...0...1...'), R('frog', '0.......4.......'), R('owl', '0.1.2.4.3.5.6.7.')]),
      rules: [{ k: 'climb', m: 'owl', min: 8 }],
      flourish: { text: 'The woodpecker knocks on the very last step', rule: { k: 'at', m: 'woodpecker', step: 15 } }, par: 4,
      sol: { rows: [R('hedgehog', '0...1...0...1...'), R('woodpecker', '...............1'), R('frog', '0.......4.......'), R('owl', '0.1.2.3.4.5.6.7.')] },
    },
    {
      name: 'Taking Turns', kind: 'limit', cast: C2, maxRows: 3,
      ask: 'Only three fit on the raft, and the owl and the woodpecker keep talking at once. Take turns!', after: 'Polite as anything. The raft floats on.',
      start: river([R('hedgehog', '0...1...0...1...'), R('woodpecker', '1...1...1...1...'), R('frog', '0.......4.......'), R('owl', '0.2.4.2.0.2.4.2.')]),
      rules: [{ k: 'has', m: ['owl', 'woodpecker'] }, { k: 'apart', a: 'owl', b: 'woodpecker' }, { k: 'count', m: 'owl', min: 4, max: 99 }, { k: 'count', m: 'woodpecker', min: 4, max: 99 }],
      flourish: { text: 'The woodpecker plays a high knock', rule: { k: 'uses', m: 'woodpecker', p: 2 } }, par: 6,
      sol: { rows: [R('hedgehog', '0...1...0...1...'), R('woodpecker', '2...1...1...1...'), R('owl', '..2...2...2...2.')] },
    },
    {
      name: 'Riverbank Regatta', kind: 'echo', cast: C2,
      ask: 'The boat race song! Hum the owl’s part back, and Enzo sparkles with every snare.', after: 'Every boat wins. Hooray for the regatta!',
      start: river([R('hedgehog', '0...1...0...1...'), R('frog', '0.......4.......'), R('owl', E16), R('dora', '0.......4.......')]),
      target: [R('owl', '4.4.5.4...2...0.')],
      rules: [{ k: 'with', a: 'enzo', b: 'hedgehog', bp: 1 }],
      flourish: { text: 'Enzo’s last sparkle is a high F', rule: { k: 'ends', m: 'enzo', p: 7 } }, par: 9,
      sol: { rows: [R('hedgehog', '0...1...0...1...'), R('frog', '0.......4.......'), R('owl', '4.4.5.4...2...0.'), R('enzo', '....5.......7...'), R('dora', '0.......4.......')] },
    },
  ],
  // ---------------------------------------------------------------- Mushroom Ring: D dorian, swung
  [
    {
      name: 'Oompah in the Ring', kind: 'echo', cast: C3,
      ask: 'The beetles hum a tuba tune. Oom, oom, pah… can the mole play it?', after: 'The beetles clack their shells in time.',
      start: ring([R('hedgehog', '0...1...0...1...'), R('mole', E16), R('dora', '..0...0...3...3.')]),
      target: [R('mole', '0..0..3.4..4..3.')],
      flourish: { text: 'The woodpecker joins in', rule: { k: 'has', m: ['woodpecker'] } }, par: 8,
      sol: { rows: [R('hedgehog', '0...1...0...1...'), R('woodpecker', '.......1........'), R('mole', '0..0..3.4..4..3.'), R('dora', '..0...0...3...3.')] },
      tip: { title: 'The mole', text: 'The mole plays the tuba: big round low notes. Drag up and down and listen for the hum.' },
    },
    {
      name: 'Spooky but Fun', kind: 'mood', cast: C3, tempo: [60, 160],
      ask: 'Something spooky but fun for the badgers: slow, low and creeping between the beats. No sparkles!', after: 'The badgers creep about, giggling.',
      start: ring([R('hedgehog', '0...1...0...1...'), R('owl', '7.9.7.9.8.9.7.5.'), R('enzo', '9.......9.......')]),
      rules: [{ k: 'tempo', min: 60, max: 90 }, { k: 'pitch', min: 0, max: 57 }, { k: 'lacks', m: ['enzo'] }, { k: 'has', m: ['mole'] }, { k: 'sync', min: 0.3, max: 1 }],
      flourish: { text: 'The frog creeps with the mole, note for note', rule: { k: 'with', a: 'frog', b: 'mole' } }, par: 8,
      sol: { bpm: 84, rows: [R('hedgehog', '0...1...0...1...'), R('frog', '...0.......4....'), R('mole', '...0.......3....')] },
    },
    {
      name: 'Mole Copycat', kind: 'fix', cast: C3,
      ask: 'The mole oompahs on the big beats, but the kicks have moved. The tuba should land with every kick.', after: 'Oom-thump! Oom-thump! Perfect.',
      start: ring([R('hedgehog', '0..01...0..01...'), R('mole', '0...0...0...0...'), R('dora', '0.......3.......')]),
      rules: [{ k: 'with', a: 'mole', b: 'hedgehog', bp: 0 }],
      flourish: { text: 'The mole reaches up to an A', rule: { k: 'uses', m: 'mole', p: 4 } }, par: 4,
      sol: { rows: [R('hedgehog', '0..01...0..01...'), R('mole', '0..4....0..4....'), R('dora', '0.......3.......')] },
    },
    {
      name: 'Hedgehog Groove', kind: 'echo', cast: C3,
      ask: 'The beetles beatbox a groove: boom, tss, clap, tss… Kick, hat and snare, in the right places.', after: 'The toadstools wobble to the groove.',
      start: ring([R('hedgehog', E16), R('mole', '0.....0.3.....3.'), R('dora', '0.......3.......')]),
      target: [R('hedgehog', '0.2.1.2.0.201.2.')],
      flourish: { text: 'The owl joins in', rule: { k: 'has', m: ['owl'] } }, par: 11,
      sol: { rows: [R('hedgehog', '0.2.1.2.0.201.2.'), R('mole', '0.....0.3.....3.'), R('owl', '........4.......'), R('dora', '0.......3.......')] },
    },
    {
      name: 'Three Toadstools', kind: 'limit', cast: C3, maxRows: 3,
      ask: 'Three toadstools, three musicians. Keep the mole, and make it bounce between the beats.', after: 'Boing, boing, boing go the toadstools.',
      start: ring([R('hedgehog', '0...1...0...1...'), R('woodpecker', '..1...1...1...1.'), R('mole', '0...0...0...0...'), R('owl', '0.2.4.2.0.2.4.2.')]),
      rules: [{ k: 'has', m: ['mole'] }, { k: 'sync', min: 0.5, max: 1 }, { k: 'density', min: 1, max: 1.5 }],
      flourish: { text: 'The owl’s last note is the high D', rule: { k: 'ends', m: 'owl', p: 7 } }, par: 2,
      sol: { rows: [R('woodpecker', '..1...1...1...1.'), R('mole', '0...0...0...0...'), R('owl', '0.2.4.2.0.2.4.7.')] },
    },
    {
      name: 'Fairy Ring Dance', kind: 'mood', cast: C3, tempo: [60, 160],
      ask: 'The fairy ring dance! Quick and bouncy, five or more playing, and the mole and the frog never at once.', after: 'Round and round the ring they go.',
      start: ring([R('hedgehog', '0...1...0...1...'), R('frog', '0.......3.......'), R('owl', '0.2.4.2.0.2.4.2.'), R('dora', '0.......3.......')], 100),
      rules: [{ k: 'tempo', min: 116, max: 140 }, { k: 'band', min: 5, max: 99 }, { k: 'apart', a: 'mole', b: 'frog' }, { k: 'sync', min: 0.4, max: 1 }],
      flourish: { text: 'The mole climbs: four or more notes, each higher', rule: { k: 'climb', m: 'mole', min: 4 } }, par: 5,
      sol: { bpm: 124, rows: [R('hedgehog', '0...1...0...1...'), R('frog', '0.......3.......'), R('mole', '..0...1...2...3.'), R('owl', '0.2.4.2.0.2.4.2.'), R('dora', '0.......3.......')] },
    },
  ],
  // ---------------------------------------------------------------- Treetop Stage: E-flat major, the bird choir
  [
    {
      name: 'The Choir Tunes Up', kind: 'echo', cast: C4,
      ask: 'The squirrels hum four chords. Can the bird choir sing them back?', after: 'Tweet-tweet-tweeeet. Lovely harmony.',
      start: tree([R('hedgehog', '0...1...0...1...'), R('frog', '0...5...3...4...'), R('birds', E16)]),
      target: [R('birds', '0...5...3...4...')],
      flourish: { text: 'Dora strums just what the choir sings', rule: { k: 'same', a: 'dora', b: 'birds' } }, par: 9,
      sol: { rows: [R('hedgehog', '0...1...0...1...'), R('frog', '0...5...3...4...'), R('dora', '0...5...3...4...'), R('birds', '0...5...3...4...')] },
      tip: { title: 'The bird choir', text: 'The choir sings whole chords. Drag up and down to change the chord: listen for the one that fits the hum.' },
    },
    {
      name: 'Dora’s Wrong Chords', kind: 'fix', cast: C4,
      ask: 'Dora’s ukulele has wandered off from the choir. She should strum just what the birds sing.', after: 'Strum and sing, all in tune.',
      start: tree([R('hedgehog', '0...1...0...1...'), R('dora', '0...5...4...3...'), R('birds', '0...5...3...4...')]),
      rules: [{ k: 'same', a: 'dora', b: 'birds' }],
      flourish: { text: 'Enzo sparkles on the very last step', rule: { k: 'at', m: 'enzo', step: 15 } }, par: 4,
      sol: { rows: [R('hedgehog', '0...1...0...1...'), R('enzo', '...............7'), R('dora', '0...5...3...4...'), R('birds', '0...5...3...4...')] },
    },
    {
      name: 'Up in the Branches', kind: 'mood', cast: C4, tempo: [60, 180],
      ask: 'Up here everything twinkles. Quick, high and light, please: the owl and Enzo twinkling in turn, and nothing low and rumbly.', after: 'The squirrels sway on the twigs, eyes shining.',
      start: tree([R('hedgehog', '0...1...0...1...'), R('frog', '0.......4.......'), R('mole', '0...0...0...0...')]),
      rules: [{ k: 'tempo', min: 132, max: 180 }, { k: 'pitch', min: 72, max: 999 }, { k: 'lacks', m: ['mole', 'frog'] }, { k: 'has', m: ['owl', 'enzo'] }, { k: 'range', min: 12, max: 99 }, { k: 'density', min: 0, max: 0.75 }, { k: 'apart', a: 'owl', b: 'enzo' }],
      flourish: { text: 'The owl climbs: three or more notes, each higher', rule: { k: 'climb', m: 'owl', min: 3 } }, par: 8,
      sol: { bpm: 140, rows: [R('hedgehog', '0...1...0...1...'), R('owl', '..5...6...7.....'), R('enzo', '..............7.')] },
    },
    {
      name: 'Enzo’s Sparkle Song', kind: 'echo', cast: C4,
      ask: 'A wren hums a sparkly tune way up high. Enzo, play it on the glockenspiel!', after: 'The wren does a little twirl.',
      start: tree([R('hedgehog', '0...1...0...1...'), R('enzo', E16), R('birds', '0.......3.......')]),
      target: [R('enzo', '7.9.7...5.3.5...')],
      flourish: { text: 'The owl answers, never playing with Enzo', rule: { k: 'apart', a: 'owl', b: 'enzo' } }, par: 8,
      sol: { rows: [R('hedgehog', '0...1...0...1...'), R('owl', '.............4..'), R('enzo', '7.9.7...5.3.5...'), R('birds', '0.......3.......')] },
    },
    {
      name: 'Three on a Branch', kind: 'limit', cast: C4, maxRows: 3,
      ask: 'This branch holds three. Keep the birds and the owl, keep it light, and let the owl finish on the high E-flat.', after: 'The branch hardly bends at all.',
      start: tree([R('hedgehog', '0.1.0.1.0.1.0.1.'), R('frog', '0...5...3...4...'), R('owl', '4.5.7.5.4.2.0...'), R('enzo', '7.......7.......'), R('birds', '0...5...3...4...')]),
      rules: [{ k: 'has', m: ['birds', 'owl'] }, { k: 'density', min: 0, max: 1 }, { k: 'ends', m: 'owl', p: 7 }],
      flourish: { text: 'The owl plays eight notes or more', rule: { k: 'count', m: 'owl', min: 8, max: 99 } }, par: 3,
      sol: { rows: [R('owl', '4.5.7.5.4.2.0.7.'), R('enzo', '7.......7.......'), R('birds', '0...5...3...4...')] },
    },
    {
      name: 'The Great Tree Sway', kind: 'mood', cast: C4, tempo: [60, 160],
      ask: 'The whole tree sways. Slower, five or more playing, the frog with the kicks, and the owl ending on top.', after: 'The old oak creaks happily in time.',
      start: tree([R('hedgehog', '0...1...0...1...'), R('frog', '0.......3.......'), R('birds', '0.......3.......')]),
      rules: [{ k: 'tempo', min: 80, max: 100 }, { k: 'band', min: 5, max: 99 }, { k: 'with', a: 'frog', b: 'hedgehog', bp: 0 }, { k: 'ends', m: 'owl', p: 7 }, { k: 'has', m: ['birds'] }],
      flourish: { text: 'Dora strums just what the choir sings', rule: { k: 'same', a: 'dora', b: 'birds' } }, par: 6,
      sol: { bpm: 92, rows: [R('hedgehog', '0...1...0...1...'), R('frog', '0.......3.......'), R('owl', '....4.......7...'), R('dora', '0.......3.......'), R('birds', '0.......3.......')] },
    },
  ],
  // ---------------------------------------------------------------- the Moonlight Festival: A minor
  [
    {
      name: 'Moon Song', kind: 'echo', cast: C4,
      ask: 'The moths hum the old moon song. Owl, you know this one!', after: 'The moths flutter round the lanterns.',
      start: moon([R('hedgehog', '0.......1.......'), R('frog', '0.......5.......'), R('owl', E16), R('birds', '0.......5.......')]),
      target: [R('owl', '4.4.7.6.5...4...')],
      flourish: { text: 'Enzo sparkles with the snare', rule: { k: 'with', a: 'enzo', b: 'hedgehog', bp: 1 } }, par: 8,
      sol: { rows: [R('hedgehog', '0.......1.......'), R('frog', '0.......5.......'), R('owl', '4.4.7.6.5...4...'), R('enzo', '........4.......'), R('birds', '0.......5.......')] },
    },
    {
      name: 'Fireflies', kind: 'mood', cast: C4, tempo: [60, 180],
      ask: 'The fireflies want to blink along: quick, light and bouncy, with Enzo, and no big tuba.', after: 'Blink, blink, blink! The glade lights up.',
      start: moon([R('hedgehog', '0...1...0...1...'), R('mole', '0.......5.......'), R('owl', '4.......4.......')]),
      rules: [{ k: 'tempo', min: 120, max: 180 }, { k: 'lacks', m: ['mole'] }, { k: 'sync', min: 0.5, max: 1 }, { k: 'has', m: ['enzo'] }, { k: 'density', min: 0.75, max: 99 }],
      flourish: { text: 'Enzo climbs: six or more notes, each higher', rule: { k: 'climb', m: 'enzo', min: 6 } }, par: 10,
      sol: { bpm: 132, rows: [R('hedgehog', '0...1...0...1...'), R('owl', '4.......4.......'), R('enzo', '.0.1.2...3.4.5..')] },
    },
    {
      name: 'Muddle in the Moonlight', kind: 'fix', cast: C4,
      ask: 'What a muddle! The frog should land with the kicks, and the woodpecker should never knock over the owl.', after: 'Untangled. The hedgehogs nod wisely.',
      start: moon([R('hedgehog', '0...1...0...1...'), R('woodpecker', '.2.2.22..1.111.1'), R('frog', '..0.......5.....'), R('owl', '0.2.4.2.0.2.4.2.')]),
      rules: [{ k: 'with', a: 'frog', b: 'hedgehog', bp: 0 }, { k: 'apart', a: 'woodpecker', b: 'owl' }],
      flourish: { text: 'The frog’s last note is the low F', rule: { k: 'ends', m: 'frog', p: 5 } }, par: 6,
      sol: { rows: [R('hedgehog', '0...1...0...1...'), R('woodpecker', '.2.2.2...1.1.1.1'), R('frog', '0.......5.......'), R('owl', '0.2.4.2.0.2.4.2.')] },
    },
    {
      name: 'Lantern Bass', kind: 'echo', cast: C4,
      ask: 'The toads by the lanterns hum a walking bass. Frog, walk with them!', after: 'The toads walk off, very pleased.',
      start: moon([R('hedgehog', '0..0..1.0..0..1.'), R('frog', E16), R('birds', '0.......5.......')]),
      target: [R('frog', '0..0..7.5..5..4.')],
      flourish: { text: 'The mole starts with an oompah on the first step', rule: { k: 'at', m: 'mole', step: 0 } }, par: 8,
      sol: { rows: [R('hedgehog', '0..0..1.0..0..1.'), R('frog', '0..0..7.5..5..4.'), R('mole', '0...............'), R('birds', '0.......5.......')] },
    },
    {
      name: 'Hush for the Moon', kind: 'limit', cast: C4, maxRows: 3, tempo: [60, 140],
      ask: 'The moon is rising. Hush! Three musicians, slow and soft, with the owl, and no drums or knocking.', after: 'Even the crickets hold their breath.',
      start: moon([R('hedgehog', '0.1.0.1.0.1.0.1.'), R('woodpecker', '2222222222222222'), R('owl', '7.6.5.4.3.2.1.0.'), R('enzo', '9.9.9.9.9.9.9.9.'), R('birds', '0...5...3...4...')]),
      rules: [{ k: 'tempo', min: 60, max: 76 }, { k: 'density', min: 0, max: 0.75 }, { k: 'lacks', m: ['hedgehog', 'woodpecker'] }, { k: 'has', m: ['owl'] }],
      flourish: { text: 'The choir’s last chord is F', rule: { k: 'ends', m: 'birds', p: 5 } }, par: 4,
      sol: { bpm: 68, rows: [R('owl', '7.6.5.4.3.2.1.0.'), R('birds', '0...5...3...5...')] },
    },
    {
      name: 'The Moonlight Festival', kind: 'mood', cast: C4, tempo: [60, 160],
      ask: 'The whole wood is here! A little quicker, six musicians, Dora and Enzo both, the frog with the kicks, and bouncy.', after: 'The whole wood cheers for the Woodland Band!',
      start: moon([R('hedgehog', '0...1...0...1...'), R('frog', '0.......5.......'), R('owl', '4.4.7.6.5...4...'), R('birds', '0.......5.......')]),
      rules: [{ k: 'tempo', min: 100, max: 124 }, { k: 'band', min: 6, max: 99 }, { k: 'has', m: ['dora', 'enzo'] }, { k: 'with', a: 'frog', b: 'hedgehog', bp: 0 }, { k: 'sync', min: 0.3, max: 1 }],
      flourish: { text: 'Enzo climbs: four or more notes, each higher', rule: { k: 'climb', m: 'enzo', min: 4 } }, par: 8,
      sol: { bpm: 112, rows: [R('hedgehog', '0...1...0...1...'), R('frog', '0.......5.......'), R('owl', '4.4.7.6.5...4...'), R('enzo', '..0...2...4...7.'), R('dora', '0...............'), R('birds', '0.......5.......')] },
    },
  ],
];

const CLEARING_INFO: [string, string, string][] = [
  ['mossy', 'Mossy Hollow', 'A soft green dell under the ferns, where the rabbits and dormice like it gentle.'],
  ['river', 'Riverbank', 'Reeds, stepping stones and otters who like a quick tune. The owl and the woodpecker join.'],
  ['ring', 'Mushroom Ring', 'A ring of red toadstools where the beetles and badgers groove. The mole brings his tuba.'],
  ['tree', 'Treetop Stage', 'A stage high in the old oak. The squirrels hum and the bird choir sings chords.'],
  ['moon', 'Moonlight Festival', 'Lanterns, fireflies and the whole wood under the moon. The last and biggest show.'],
];
export const REQUESTS: Record<string, Request> = {};
export const REQ_IDS: string[] = [];
export const CLEARINGS: Clearing[] = CLEARING_INFO.map(([id, name, blurb], c) => {
  const ids = DEFS[c].map((d, i) => {
    const rid = `${c + 1}-${i + 1}`;
    REQUESTS[rid] = { ...d, rules: d.rules ?? [], id: rid, clearing: c, n: i };
    REQ_IDS.push(rid);
    return rid;
  });
  return { id, name, blurb, key: DEFS[c][0].start.key, requests: ids };
});

// ---------------------------------------------------------------- progress
export const done = (s: Save, id: string) => !!s.reqs[id]?.done;
/** A request opens once the one before it is solved (the first is always open). */
export function reqOpen(s: Save, id: string): boolean { const i = REQ_IDS.indexOf(id); return i === 0 || (i > 0 && done(s, REQ_IDS[i - 1])); }
export const clearingOpen = (s: Save, c: number) => !!CLEARINGS[c] && reqOpen(s, CLEARINGS[c].requests[0]);
export const clearingCount = (s: Save, c: number) => CLEARINGS[c].requests.filter((id) => done(s, id)).length;
export function nextRequest(s: Save): string | null { return REQ_IDS.find((id) => !done(s, id)) ?? null; }
export function totalStars(s: Save): number { let n = 0; for (const id of REQ_IDS) { const b = s.reqs[id]?.stars ?? 0; n += (b & 1) + ((b >> 1) & 1) + ((b >> 2) & 1); } return n; }
/** The jam opens after the second request. */
export const jamOpen = (s: Save) => done(s, REQ_IDS[1]);
/** Everyone met so far, for the jam. */
export function jamCast(s: Save): MusicianId[] {
  let cast: MusicianId[] = C1;
  for (const c of CLEARINGS) if (clearingOpen(s, CLEARINGS.indexOf(c))) cast = REQUESTS[c.requests[0]].cast;
  return cast;
}
/** The keys the jam may use: each open clearing's. */
export function jamKeys(s: Save): number[] { return CLEARINGS.map((c, i) => (clearingOpen(s, i) ? c.key : -1)).filter((k) => k >= 0); }
export const isFinale = (id: string) => id === REQ_IDS[REQ_IDS.length - 1];
