// Honeycomb Hollow's sixty chambers in five areas of the hollow oak, the bee friends' story, and the tips that teach
// each new thing the first time it appears. Maps are rows of characters with odd columns sitting half a cell lower:
// `.` a drop, `w` a wax cap (one hit), `W` thick wax (two hits), `b` thick wax with a trapped bee, `s` a sticky cell,
// `m` moss, `d` dark comb, `a` an acorn, `x` a wasp, `o` a dew drop, a space for no cell. Move limits and star
// targets come from the look-ahead bot (`tests/honey-bot.mjs --tune`), recorded in TUNE at the bottom.

export type AreaId = 'clover' | 'rose' | 'lavender' | 'heather' | 'queen';
export type Friend = 'pip' | 'rosa' | 'bumble' | 'heath' | 'queen';
export interface Goals { honey?: number | 'all'; acorns?: number; moss?: boolean }
export interface Tip { title: string; text: string }
export interface Chamber { id: string; area: AreaId; name: string; map: string[]; colours: number; moves: number; stars: [number, number]; goals: Goals; tip?: Tip; set?: boolean }
export interface Area { id: AreaId; name: string; blurb: string; friend: Friend; friendName: string }

export const AREAS: Area[] = [
  { id: 'clover', name: 'The Clover Hall', blurb: 'Where the young bees learn to make honey. Pip shows the way.', friend: 'pip', friendName: 'Pip' },
  { id: 'rose', name: 'The Rose Arbour', blurb: 'Sticky roses and rolling acorns. Rosa dances the path.', friend: 'rosa', friendName: 'Rosa' },
  { id: 'lavender', name: 'The Lavender Loft', blurb: 'Moss creeps and dew drops wander. Bumble keeps the loft.', friend: 'bumble', friendName: 'Bumble' },
  { id: 'heather', name: 'The Heather Attic', blurb: 'Wasps and dark old comb. Old Heath knows every beam.', friend: 'heath', friendName: 'Old Heath' },
  { id: 'queen', name: 'The Queen’s Chamber', blurb: 'The heart of the oak, and the queen’s lost honey map.', friend: 'queen', friendName: 'The Queen' },
];

// ---- shapes
const H3 = ['   .   ', ' ..... ', '.......', '.......', '.......', '.......', '  ...  '];
const H4 = ['   ...   ', ' ....... ', '.........', '.........', '.........', '.........', '.........', '  .....  ', '    .    '];
const R7 = Array(7).fill('.......');
const R9 = Array(7).fill('.........');
const R8 = Array(8).fill('.........');

type Raw = [id: string, name: string, map: string[], colours: number, goals: Goals, tip?: Tip];
const RAW: Record<AreaId, Raw[]> = {
  clover: [
    ['c1', 'First Drops', H3, 6, { honey: 'all' }, { title: 'Turn three drops', text: 'Tap where three cells meet to turn them round. Line up three drops of one colour, in any direction, and they pop into honey. Fill the comb with honey!' }],
    ['c2', 'Bee Line', H3, 6, { honey: 'all' }, { title: 'Four in a line: a bee', text: 'Line up four drops and a bee hatches. Match the bee and it zooms along its whole line.' }],
    ['c3', 'Clover Patch', R7, 6, { honey: 'all' }],
    ['c4', 'Crossing Paths', R7, 6, { honey: 'all' }, { title: 'Crossing lines: a blossom', text: 'When two lines cross (an L, a V or a little triangle), a blossom opens. Match it and it bursts in a ring.' }],
    ['c5', 'Sunny Comb', H4, 6, { honey: 'all' }],
    ['c6', 'Royal Taste', H4, 6, { honey: 'all' }, { title: 'Five in a line: royal jelly', text: 'Five in a line makes royal jelly. Turn it with any drops and every drop of their colours turns to honey.' }],
    ['c7', 'Busy Bees', R9, 6, { honey: 'all' }, { title: 'Turn two specials together', text: 'Turn two specials in one trio and they fire together: bee and bee make a star, blossom and blossom a great bloom, and royal jelly with a bee sends out a swarm.' }],
    ['c8', 'Wax Seals', ['.......', '.......', '.w.w.w.', '.......', '.w.w.w.', '.......', '.......'], 6, { honey: 'all' }, { title: 'Wax caps', text: 'Make a match next to a wax cap to crack it open. Thick wax takes two.' }],
    ['c9', 'Thick Wax', ['   ...   ', ' ....... ', '..W...W..', '...W.W...', '....W....', '...W.W...', '..W...W..', '  .....  ', '    .    '], 6, { honey: 'all' }],
    ['c10', 'Trapped!', ['.......', '.......', '..b.b..', '.......', '.b...b.', '.......', '.......'], 6, { honey: 'all' }, { title: 'Bees in the wax', text: 'Some young bees are sealed in thick wax. Crack the wax twice to set them free.' }],
    ['c11', 'Waxen Hall', ['.........', '.........', '.w.w.w.w.', '.........', '..b...b..', '.........', '.........'], 6, { honey: 'all' }],
    ['c12', 'The Clover Crown', ['   ...   ', ' ....... ', '...b.b...', '..W...W..', '.b..W..b.', '..W...W..', '...b.b...', '  .....  ', '    .    '], 6, { honey: 'all' }],
  ],
  rose: [
    ['r1', 'Acorn Drop', ['..a.a..', '.......', '.......', '.......', '.......', '.......', '.......'], 6, { honey: 'all', acorns: 2 }, { title: 'Acorns', text: 'Acorns don’t match. Clear the drops beneath them, or turn them down, until they roll out of the bottom of the comb.' }],
    ['r2', 'Rolling Down', ['   .a.   ', ' ....... ', '.........', '.........', '.........', '.........', '.........', '  .....  ', '    .    '], 6, { honey: 'all', acorns: 4 }],
    ['r3', 'Sticky Petals', ['.......', '.......', '.s...s.', '..sss..', '.s...s.', '.......', '.......'], 6, { honey: 'all' }, { title: 'Sticky cells', text: 'A drop in a sticky cell is glued in place: it can’t be turned and won’t fall. Match it where it sits to wash it clean.' }],
    ['r4', 'Rose Glaze', ['   ...   ', ' ....... ', '..s...s..', '.s.....s.', '.s.....s.', '.s.....s.', '..s...s..', '  .....  ', '    .    '], 6, { honey: 'all' }],
    ['r5', 'Nutty Wax', ['...a.a...', '.........', '.........', 'w.w.w.w.w', '.........', '.........', '.........'], 6, { honey: 'all', acorns: 4 }],
    ['r6', 'Sweet Traps', ['.......', '..s.s..', '.sb.bs.', '.......', '..sbs..', '.......', '.......'], 6, { honey: 'all' }],
    ['r7', 'Acorn Avalanche', ['..a...a..', '.........', '.........', '.........', '.........', '.........', '.........', '.........'], 6, { honey: 'all', acorns: 6 }],
    ['r8', 'Thorny Thicket', ['.........', '.s.....s.', '..s...s..', '...s.s...', '....s....', '...s.s...', '..s...s..'], 6, { honey: 'all' }],
    ['r9', 'Stuck Nuts', ['   .a.   ', ' ....... ', '.........', '..s...s..', '.........', '...s.s...', '.........', '  .....  ', '    .    '], 6, { acorns: 4, honey: 'all' }],
    ['r10', 'Petal Prison', ['.......', '.sssss.', '.sb.bs.', '.s...s.', '.sb.bs.', '.sssss.', '.......'], 6, { honey: 'all' }],
    ['r11', 'Rosehip', ['....a....', '.........', '.........', '.........', '.........', '.........', '.........', '.........'], 6, { honey: 'all', acorns: 3 }],
    ['r12', 'The Rose Window', ['   .a.   ', ' ..s.s.. ', '..s.W.s..', '.s.W.W.s.', '..W.b.W..', '.s.W.W.s.', '..s.W.s..', '  .....  ', '    .    '], 6, { honey: 'all', acorns: 3 }],
  ],
  lavender: [
    ['l1', 'Mossy Corner', ['.......', '.......', '.......', '.......', 'm.....m', 'mm...mm', 'mmm.mmm'], 6, { honey: 'all', moss: true }, { title: 'Moss', text: 'Moss creeps one cell further every turn you don’t clear any. Make matches on the moss to scrub it away.' }],
    ['l2', 'Moss Garden', ['   ...   ', ' ....... ', '.........', '...mmm...', '...mmm...', '...mmm...', '.........', '  .....  ', '    .    '], 6, { honey: 'all', moss: true }],
    ['l3', 'Morning Dew', ['.......', '.......', '..o.o..', '.......', '...o...', '.......', '.......'], 6, { honey: 'all' }, { title: 'Dew drops', text: 'Dew drops roll about after every turn. Make a match beside one to catch it.' }],
    ['l4', 'Dewfall', ['   ...   ', ' ....... ', '..o...o..', '.........', '....o....', '.........', '..o...o..', '  .....  ', '    .    '], 6, { honey: 'all' }],
    ['l5', 'Moss and Wax', ['.........', '.........', '.w.w.w.w.', '.........', 'mm.....mm', 'mmm...mmm', 'mmmm.mmmm'], 6, { honey: 'all', moss: true }],
    ['l6', 'Dewy Bees', ['.......', '..o.o..', '.b...b.', '.......', '...o...', '..b.b..', '.......'], 6, { honey: 'all' }],
    ['l7', 'Moss Roll', ['..a...a..', '.........', '.........', '.........', '.........', 'mm.....mm', 'mmm...mmm', 'mmmmmmmmm'], 6, { honey: 'all', moss: true, acorns: 3 }],
    ['l8', 'Glistening', ['   ...   ', ' ....... ', '...o.o...', '.........', '..o...o..', '.........', '...o.o...', '  .....  ', '    .    '], 6, { honey: 'all' }],
    ['l9', 'Overgrown', ['.........', '.........', '.........', 'mm.....mm', 'mmm...mmm', 'mmmm.mmmm', 'mmmmmmmmm', 'mmmmmmmmm'], 6, { honey: 'all', moss: true }],
    ['l10', 'Sticky Dew', ['.........', '..o...o..', '.s.s.s.s.', '.........', '....o....', '.s.s.s.s.', '.........'], 6, { honey: 'all' }],
    ['l11', 'Damp Loft', ['   ...   ', ' ....... ', '..o...o..', '.........', '.mm...mm.', 'mmm...mmm', 'mmmm.mmmm', '  mmmmm  ', '    m    '], 6, { honey: 'all', moss: true }],
    ['l12', 'The Lavender Loom', ['.........', '..o...o..', '.b.....b.', '.........', 'mmm...mmm', '.........', 'mmm...mmm', 'mmmmmmmmm'], 6, { honey: 'all', moss: true }],
  ],
  heather: [
    ['h1', 'Wasp Watch', ['.......', '.......', '.......', '...x...', '.......', '.......', '.......'], 6, { honey: 'all' }, { title: 'Wasps', text: 'A wasp hops after every turn, eats a drop and licks the honey off its cell. Make a match next to it to shoo it away.' }],
    ['h2', 'Two Wasps', ['   ...   ', ' ....... ', '.........', '..x...x..', '.........', '.........', '.........', '  .....  ', '    .    '], 6, { honey: 'all' }],
    ['h3', 'Dark Comb', ['.......', '.......', '..ddd..', '..ddd..', '..ddd..', '.......', '.......'], 6, { honey: 'all' }, { title: 'Dark comb', text: 'Old dark comb won’t take honey until light reaches it. Only a blossom’s burst can light it up.' }],
    ['h4', 'Shadowed', ['   ...   ', ' ....... ', '..d...d..', '.d.....d.', 'd.......d', '.d.....d.', '..d...d..', '  .....  ', '    .    '], 6, { honey: 'all' }],
    ['h5', 'Wasp Nest', ['.........', '.........', '..b...b..', '....x....', '.........', '..b...b..', '.........'], 6, { honey: 'all' }],
    ['h6', 'Night Acorns', ['..a.a..', '.......', '.......', '.ddddd.', '.......', '.......', '.......'], 6, { acorns: 4, honey: 'all' }],
    ['h7', 'Waspy Moss', ['   ...   ', ' ....... ', '...x.x...', '.........', '.........', 'mm.....mm', 'mmm...mmm', '  mmmmm  ', '    m    '], 7, { honey: 'all', moss: true }],
    ['h8', 'Candle Wax', ['.........', '.........', '.W.ddd.W.', '...ddd...', '.W.ddd.W.', '.........', '.........'], 7, { honey: 'all' }],
    ['h9', 'Stingers in the Dark', ['.........', '...x.x...', '.........', '.dd...dd.', '.dd...dd.', '.........', '.........', '.........'], 7, { honey: 'all' }],
    ['h10', 'Heather Dew', ['   ...   ', ' ....... ', '..o...o..', '...ddd...', '...ddd...', '...ddd...', '..o...o..', '  .....  ', '    .    '], 7, { honey: 'all' }],
    ['h11', 'Buzzing Attic', ['.........', '.........', '.b.x.x.b.', '.........', '.........', '..b...b..', '.........', '.........'], 7, { honey: 'all' }],
    ['h12', 'The Heather Lantern', ['   ...   ', ' ....... ', '..x...x..', '...ddd...', '..ddddd..', '...ddd...', '.........', '  .....  ', '    .    '], 7, { honey: 'all' }],
  ],
  queen: [
    ['q1', 'Royal Hall', R8, 7, { honey: 'all' }, { title: 'Six colours', text: 'The Queen’s Chamber is in full bloom: six colours of nectar. Matches are rarer, so look for turns that set up two at once.' }],
    ['q2', 'Golden Steps', ['....a....', '.........', '.w.w.w.w.', '.........', '.w.w.w.w.', '.........', '.........'], 7, { acorns: 3, honey: 'all' }],
    ['q3', 'Guarded Brood', ['   ...   ', ' ....... ', '..sbs....', '.........', '....sbs..', '.........', '..b...b..', '  .....  ', '    .    '], 7, { honey: 'all' }],
    ['q4', 'Mossy Throne', ['.........', '.........', '...ddd...', '...ddd...', '.........', 'mmm...mmm', 'mmmmmmmmm', 'mmmmmmmmm'], 7, { honey: 'all', moss: true }],
    ['q5', 'Dew on the Crown', ['   ...   ', ' ....... ', '..o...o..', '.x.....x.', '.........', '..o...o..', '.........', '  .....  ', '    .    '], 7, { honey: 'all' }],
    ['q6', 'Royal Nursery', ['.........', '.b.....b.', '..W...W..', '....b....', '..W...W..', '.b.....b.', '.........'], 7, { honey: 'all' }],
    ['q7', 'Amber Hall', ['....a....', '.........', '..s...s..', '...ddd...', '..s...s..', '.........', '.........', '.........'], 7, { acorns: 3, honey: 'all' }],
    ['q8', 'Wasp Guard', ['.........', '.x.....x.', '.........', '...b.b...', '.........', '.........', '.........'], 7, { honey: 'all' }],
    ['q9', 'The Long Gallery', ['   ...   ', ' ...o... ', '..W...W..', '.........', 'm.......m', 'mm.....mm', 'mmm...mmm', '  mmmmm  ', '    m    '], 7, { honey: 'all', moss: true }],
    ['q10', 'Sealed Vault', ['.........', '.sssssss.', '.s.b.b.s.', '.s.....s.', '.s.b.b.s.', '.sssssss.', '.........'], 7, { honey: 'all' }],
    ['q11', 'The Gilded Way', ['..a...a..', '.........', '.d.d.d.d.', '.........', '.w.w.w.w.', '.........', '.........', '.........'], 7, { acorns: 4, honey: 'all' }],
    ['q12', 'The Queen’s Map', ['   .a.   ', ' ..b.b.. ', '..W...W..', '.d.ddd.d.', '..d...d..', '.d.ddd.d.', '..W...W..', '  .b.b.  ', '    .    '], 7, { honey: 'all', acorns: 2 }],
  ],
};

/** Moves, then the moves left for two and for three stars, from the look-ahead bot. */
export const TUNE: Record<string, [number, number, number]> = {
  c1: [25, 11, 14],
  c2: [25, 11, 14],
  c3: [20, 7, 10],
  c4: [20, 7, 10],
  c5: [21, 8, 13],
  c6: [21, 8, 13],
  c7: [19, 5, 8],
  c8: [21, 7, 10],
  c9: [18, 6, 9],
  c10: [23, 7, 12],
  c11: [28, 12, 18],
  c12: [19, 4, 8],
  r1: [24, 8, 13],
  r2: [20, 6, 11],
  r3: [20, 6, 11],
  r4: [16, 3, 8],
  r5: [27, 7, 13],
  r6: [26, 10, 14],
  r7: [29, 13, 17],
  r8: [23, 7, 14],
  r9: [20, 7, 9],
  r10: [21, 4, 9],
  r11: [28, 11, 15],
  r12: [22, 5, 8],
  l1: [21, 6, 11],
  l2: [19, 6, 10],
  l3: [18, 5, 9],
  l4: [18, 6, 10],
  l5: [24, 6, 15],
  l6: [19, 5, 9],
  l7: [23, 7, 11],
  l8: [18, 5, 9],
  l9: [18, 4, 9],
  l10: [26, 8, 15],
  l11: [18, 6, 11],
  l12: [25, 10, 13],
  h1: [21, 7, 12],
  h2: [22, 6, 13],
  h3: [36, 18, 26],
  h4: [30, 8, 19],
  h5: [22, 5, 10],
  h6: [33, 10, 20],
  h7: [32, 14, 18],
  h8: [47, 17, 25],
  h9: [32, 7, 13],
  h10: [30, 5, 17],
  h11: [27, 8, 13],
  h12: [37, 11, 26],
  q1: [30, 6, 15],
  q2: [34, 6, 15],
  q3: [28, 7, 15],
  q4: [44, 13, 27],
  q5: [22, 5, 10],
  q6: [36, 9, 16],
  q7: [31, 7, 12],
  q8: [27, 6, 11],
  q9: [26, 6, 12],
  q10: [34, 8, 14],
  q11: [39, 12, 19],
  q12: [39, 10, 18],
};

export const CHAMBERS: Chamber[] = AREAS.flatMap((a) => RAW[a.id].map(([id, name, map, colours, goals, tip], k) => {
  const t = TUNE[id] ?? [30, 4, 8];
  return { id, area: a.id, name, map, colours, goals, tip, moves: t[0], stars: [t[1], t[2]] as [number, number], set: k === RAW[a.id].length - 1 };
}));

export type Who = Friend | 'dora' | 'enzo';
export interface Page { who: Who; text: string }
/** The story: a few picture-book pages as each area opens, and when its last chamber is filled. */
export const STORY: Record<string, Page[]> = {
  'clover-in': [
    { who: 'pip', text: 'Oh! Two chinchillas in our oak! Please, can you help? The queen’s honey map has crumbled away, and without it the comb is empty and dark.' },
    { who: 'dora', text: 'We’d love to help. How do we make honey?' },
    { who: 'pip', text: 'Turn the nectar drops three at a time. Line up their colours and they turn to honey! Come on, the Clover Hall first.' },
  ],
  'clover-out': [
    { who: 'pip', text: 'The Clover Hall is glowing again! Look, a corner of the map is shining in the wax.' },
    { who: 'enzo', text: 'There’s more of it up the trunk. Onward!' },
  ],
  'rose-in': [
    { who: 'rosa', text: 'Welcome to the Rose Arbour! Mind the sticky petals, and the acorns that roll in from the branch above.' },
    { who: 'rosa', text: 'Bring the acorns down to the bottom and I’ll dance you the way to the next piece of the map.' },
  ],
  'rose-out': [
    { who: 'rosa', text: 'A rose-gold piece of the map! I’ll dance the news to the whole hive.' },
  ],
  'lavender-in': [
    { who: 'bumble', text: 'Mmm, hello. I’m Bumble. The Lavender Loft has gone all mossy while we napped, and the dew keeps wandering off.' },
    { who: 'enzo', text: 'Scrub the moss, catch the dew. We can do that.' },
  ],
  'lavender-out': [
    { who: 'bumble', text: 'Clean and sweet-smelling again. Here, the lavender piece of the map. Don’t tell anyone I fell asleep on it.' },
  ],
  'heather-in': [
    { who: 'heath', text: 'Hm. Visitors. I’m Old Heath. Up here in the attic the comb is old and dark, and the wasps are bold.' },
    { who: 'heath', text: 'Only a blossom’s light wakes old comb. And shoo those wasps with a match beside them.' },
    { who: 'dora', text: 'Blossoms and shooing. Got it!' },
  ],
  'heather-out': [
    { who: 'heath', text: 'Well I never. The attic glows like it did when I was a grub. The last piece is with the queen.' },
  ],
  'queen-in': [
    { who: 'queen', text: 'So you are the two who have been filling my oak with honey. Welcome to my chamber.' },
    { who: 'queen', text: 'Fill the last of the comb, and the honey map will be whole again.' },
  ],
  'queen-out': [
    { who: 'queen', text: 'The map is whole! Every hollow is gold. The oak will remember you, Dora and Enzo.' },
  ],
};
