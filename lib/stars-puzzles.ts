// Starstitch: the handmade constellations. Three lessons, then five nights of eight, each night bringing a rule or
// two. The sky is 100 wide and 80 tall, y downwards.
//
// Stars (`s`), comma-separated: `name x y` and any marks after it: `*2` a bright star touched exactly twice,
// `#` a knot star touched only once, `~other` a twin of the star named, `(` the crescent moon where the thread
// starts, `)` the full moon where it must finish.
// Seams (`e`), space-separated: `a-b` a seam, `a=b` a double seam (stitched twice), `a>b` a one-way seam from a to b.
// Clouds (`c`): [x, y, r] circles that hide the seams whose middles they cover.
// tests/stars.mjs proves every one is solvable and not trivially forced, and tests/stars-bot.mjs solves them all.
import type { Teach } from './stars-game.js';

export type PuzzleDef = {
  id: string; night: number; index: number; name: string; fig?: string;
  s: string; e: string; c?: [number, number, number][]; story: [string, string]; teach?: Teach;
};
export const NIGHT_DEFS = [
  { name: 'First Lessons', blurb: 'Grandmother’s spool of silver thread, and three little constellations to practise on.', sky: 'night-1' },
  { name: 'The Hill at Dusk', blurb: 'The first stars come out over the burrow. Some of them shine brighter than the rest.', sky: 'night-1' },
  { name: 'Deep Autumn', blurb: 'Leaves on the wind and knots in the thread. Some seams want stitching twice.', sky: 'night-2' },
  { name: 'Frost and Aurora', blurb: 'The sky is cold and clear, the comets only fly one way, and clouds drift over the hill.', sky: 'night-3' },
  { name: 'The Moonlit Lake', blurb: 'The moon decides where the thread begins and ends, and twin stars echo across the water.', sky: 'night-4' },
  { name: 'The Meteor Shower', blurb: 'Every rule at once, under a sky full of shooting stars. The last constellation is waiting.', sky: 'night-5' },
];

let night = 0, index = 0;
const N = (n: number) => { night = n; index = 0; };
const P = (d: Omit<PuzzleDef, 'night' | 'index'>): PuzzleDef => ({ ...d, night, index: index++ });

export const PUZZLE_DEFS: PuzzleDef[] = [];
const add = (d: Omit<PuzzleDef, 'night' | 'index'>) => PUZZLE_DEFS.push(P(d));

// ---------------------------------------------------------------- first lessons
N(0);
add({
  id: 't1', name: 'The Thread',
  s: 'a 14 56, b 38 36, c 62 44, d 86 24', e: 'a-b b-c c-d',
  story: ['Grandmother said the stars come loose every autumn,', 'and somebody has to stitch them back. Tonight, it’s us.'],
  teach: { title: 'Stitch the stars', text: 'Press on a star and drag to the next one along its faint seam. The silver thread follows your paw. Stitch every seam to finish.' },
});
add({
  id: 't2', name: 'The Kite',
  s: 'top 50 6, l 28 32, r 72 32, m 50 56, k1 40 68, k2 54 78', e: 'top-l top-r l-m r-m m-k1 k1-k2',
  story: ['A kite caught on the wind above the hill,', 'its tail still fluttering after all these years.'],
  teach: { title: 'Count the seams', text: 'One thread, every seam once. A star with an odd number of seams must be where the thread starts or ends, so begin at one of those.' },
});
add({
  id: 't3', name: 'The Snail', fig: 'snail',
  s: 'tt 8 68, d 38 64, g 64 66, h 80 54, k 90 32, c 58 46, b 54 22, x 42 38, a 30 20, e 20 44',
  e: 'tt-d d-g g-h h-k d-c c-b b-x x-a a-e e-d',
  story: ['The Snail never hurries, Grandmother said,', 'and it always gets home before the frost.'],
  teach: { title: 'Don’t leave a loop behind', text: 'Set off along the snail’s body too soon and its shell is left behind with no way back. Go round a loop before you leave it. Drag back along the thread to unpick.' },
});

// ---------------------------------------------------------------- night 1: the hill at dusk (bright stars)
N(1);
add({
  id: 'n1-1', name: 'The Cottage',
  s: 'a 28 74, b 72 74, c 72 42, d 28 42, e 50 12', e: 'a-b b-c c-d d-a a-c b-d d-e e-c',
  story: ['A little cottage with a crooked roof,', 'where the first star of the evening always lands.'],
  teach: { title: 'Stuck?', text: 'Drag back along the golden thread to unpick it, or tap ↶. ✨ Hint gives a gentle nudge: one free in every sky, and more for skies you stitch without one.' },
});
add({
  id: 'n1-2', name: 'The Moth',
  s: 'c 50 44, l1 16 20, l2 22 66, r1 84 20, r2 78 66, h 50 26, an 40 8, t 50 76',
  e: 'c-l1 l1-l2 l2-c c-r1 r1-r2 r2-c c-h h-an c-t',
  story: ['The Moth flies to every lantern in the valley,', 'and visits the moon last of all.'],
});
add({
  id: 'n1-3', name: 'The Spectacles',
  s: 'p 10 40, q 24 24, r 38 40, s 24 56, n 50 46, u 62 40, v 76 24, w 90 40, x 76 56',
  e: 'p-q q-r r-s s-p r-n n-u u-v v-w w-x x-u',
  story: ['Professor Heron lost his spectacles in the sky', 'and has been squinting at the stars ever since.'],
});
add({
  id: 'n1-4', name: 'The Acorn', fig: 'acorn',
  s: 's 50 6, l 66 10, c1 30 26, c2 50 20, c3 70 26, k1 22 38, k2 78 38, n1 30 58, n2 70 58, b 50 76',
  e: 'c2-s s-l l-c2 c1-c2 c2-c3 c1-k1 c3-k2 k1-k2 k1-n1 n1-b b-n2 n2-k2',
  story: ['The Acorn rises every October,', 'and every squirrel in the valley looks up and sighs.'],
});
add({
  id: 'n1-5', name: 'The Signpost',
  s: 'a 50 6, b 76 32, c 50 54 *3, d 24 32, e 36 76, f 64 76', e: 'a-b b-c c-d d-a c-e e-f f-c',
  story: ['The Signpost points every way at once,', 'which is why travellers always find their way home.'],
  teach: { title: 'Bright stars', text: 'A bright star wears little rays. The thread must touch it exactly that many times, counting where the thread starts and where it ends.' },
});
add({
  id: 'n1-6', name: 'The Wheelbarrow',
  s: 't1 14 30, t2 66 26, t3 60 52, t4 26 54 *2, w1 40 74, w2 18 76, h1 90 14, h2 88 36 *1',
  e: 't1-t2 t2-t3 t3-t4 t4-t1 t4-w1 w1-w2 w2-t4 t2-h1 h1-h2 h2-t2',
  story: ['Enzo’s grandfather pushed this wheelbarrow', 'all the way up the sky, and left it there full of starlight.'],
});
add({
  id: 'n1-7', name: 'The Caterpillar',
  s: 'a1 6 40 *2, a2 18 26, j1 30 40, a3 18 54, b1 42 24, j2 54 40, b2 42 56, c1 66 24, j3 78 40, c2 66 56, h1 92 28, h2 92 52',
  e: 'a1-a2 a2-j1 j1-a3 a3-a1 j1-b1 b1-j2 j2-b2 b2-j1 j2-c1 c1-j3 j3-c2 c2-j2 j3-h1 h1-h2 h2-j3',
  story: ['The Caterpillar inches across the autumn sky,', 'one loop at a time, all night long.'],
});
add({
  id: 'n1-8', name: 'The Hare', fig: 'hare',
  s: 'b1 28 44, b2 46 32, b3 66 36, b4 60 54, b5 38 58, hd 78 22, c 88 38, e1 76 4, e2 90 6, f1 74 72, f2 62 74, k1 20 68, k2 6 76',
  e: 'b1-b2 b2-b3 b3-b4 b4-b5 b3-hd hd-c c-b3 hd-e1 e1-e2 e2-hd b4-f1 f1-f2 f2-b4 b5-k1 k1-k2 b1-k1',
  story: ['The Hare leaps over the moon each spring', 'and lands back on the hill each autumn, just in time.'],
});

// ---------------------------------------------------------------- night 2: deep autumn (knots, double seams)
N(2);
add({
  id: 'n2-1', name: 'The Mushroom',
  s: 'c1 12 42, c2 28 20, top 50 10 #, c3 72 20, c4 88 42, m 50 44, s1 40 74 #, s2 60 74',
  e: 'c1-c2 c2-top top-c3 c3-c4 c4-m m-c1 m-s1 s1-s2 s2-m',
  story: ['A toadstool grew in the sky one wet night', 'and no one has had the heart to pick it.'],
  teach: { title: 'Knot stars', text: 'A knot star can only be touched once: the thread may pass through it, but never come back to it.' },
});
add({
  id: 'n2-2', name: 'The Pinecone',
  s: 'p 50 6, a 38 22, b 62 22, c 24 40 #, d 50 40, e 76 40 #, f 38 58, g 62 58, h 50 76 *2',
  e: 'p-a p-b a-b a-c a-d b-d b-e c-f d-f d-g e-g f-g f-h g-h',
  story: ['The Pinecone drops one seed a year,', 'and that’s how new stars are planted.'],
});
add({
  id: 'n2-3', name: 'The Conker',
  s: 's2 38 6, s1 50 18, c1 50 34, c2 72 44, c3 64 68, c4 36 68, c5 28 44',
  e: 's2-s1 s1=c1 c1-c2 c2-c3 c3-c4 c4-c5 c5-c1',
  story: ['Enzo’s champion conker, on its string,', 'swung so hard it never came back down.'],
  teach: { title: 'Double seams', text: 'A double seam is stitched twice: there and back again, or round the long way. It glows brighter after the first stitch, and gold after the second.' },
});
add({
  id: 'n2-4', name: 'The Lantern', fig: 'lantern',
  s: 'h1 40 12, h2 50 2 #, h3 60 12, t 50 20, l1 30 30, r1 70 30, l2 30 72, r2 70 72, b 50 72, f 50 48',
  e: 't-h1 h1-h2 h2-h3 h3-t t-l1 t-r1 l1-r1 l1-l2 r1-r2 l2-b b-r2 b=f',
  story: ['Somebody hung a lantern in the sky', 'so the moths would have something to visit.'],
});
add({
  id: 'n2-5', name: 'The Hoe',
  s: 'k1 16 48, k2 38 48, k3 62 48, k4 84 48, d1 16 74, d2 38 72, d3 62 72, d4 84 74, hd 50 8 #',
  e: 'k1-k2 k2-k3 k3-k4 k1=d1 k4=d4 k2-d2 k3-d3 d2-d3 hd-k2 hd-k3',
  story: ['Dora’s garden hoe, left out in the rain,', 'rusted into starlight overnight.'],
});
add({
  id: 'n2-6', name: 'The Ladder',
  s: 'l1 32 8 #, l2 32 30, l3 32 52, l4 32 74, r1 68 8, r2 68 30, r3 68 52, r4 68 74 #',
  e: 'l1-l2 l2-l3 l3-l4 r1-r2 r2-r3 r3-r4 l1-r1 l2=r2 l3-r3 l4-r4',
  story: ['A ladder for anyone who wants to climb up', 'and see the burrow from above.'],
});
add({
  id: 'n2-7', name: 'The Cartwheel',
  s: 'h 50 42 *4, w0 82 42, w1 73 19 #, w2 50 10, w3 27 19 #, w4 18 42, w5 27 65 #, w6 50 74, w7 73 65 #',
  e: 'w0-w1 w1-w2 w2-w3 w3-w4 w4-w5 w5-w6 w6-w7 w7-w0 h=w0 h=w2 h=w4 h=w6',
  story: ['A cartwheel rolled off the harvest wagon', 'and kept on rolling, right up into the dark.'],
});
add({
  id: 'n2-8', name: 'The Sleeping Fox', fig: 'fox',
  s: 'r1 18 40, r2 28 16, r3 54 8, r4 80 18, r5 90 44, r6 74 68, r7 46 74, r8 22 64, hd 56 44 *2, e1 48 28 #, e2 66 30, sn 72 52, tt 34 48',
  e: 'r1-r2 r2-r3 r3-r4 r4-r5 r5-r6 r6-r7 r7-r8 r8-r1 hd-e1 e1-e2 e2-hd r7-hd hd-sn sn-r6 r8=tt',
  story: ['The Fox curls up when the nights grow long,', 'tail over nose, and dreams of the summer.'],
});

// ---------------------------------------------------------------- night 3: frost and aurora (one-way seams, clouds)
N(3);
add({
  id: 'n3-1', name: 'The Icicle',
  s: 'a 26 12, b 74 12, c 62 40, d 38 40, t 50 76',
  e: 'a>b b>c c-d d-a c-t t>d',
  story: ['An icicle hangs from the rim of the sky', 'and drips a new star every winter.'],
  teach: { title: 'One-way seams', text: 'A little comet flies along a one-way seam. It can only be stitched in the comet’s direction.' },
});
add({
  id: 'n3-2', name: 'The Snowflake',
  s: 'h 50 40, i0 70 40, i1 60 23, i2 40 23, i3 30 40, i4 40 57, i5 60 57, o0 92 40, o2 30 6, o4 30 74',
  e: 'h-i0 h-i2 h-i4 i0>i1 i1>i2 i2>i3 i3>i4 i4>i5 i5>i0 i0-o0 o0-i1 i2-o2 o2-i3 i4-o4 o4-i5 h-i5',
  story: ['No two snowflakes are alike,', 'except this one, which is exactly like itself.'],
});
add({
  id: 'n3-3', name: 'The Sledge',
  s: 'r1 8 60, r2 30 70, r3 60 70, r4 86 62, r5 96 46, s1 26 46, s2 66 46, p1 24 26, p2 52 22',
  e: 'r1>r2 r2>r3 r3>r4 r4>r5 r2-s1 r3-s2 s1-s2 s1-p1 p1-p2 p2-s2 r1-s1 r5-s2',
  story: ['The fastest sledge on the mountain', 'took the bend too wide and kept on going.'],
});
add({
  id: 'n3-4', name: 'The Owl', fig: 'owl',
  s: 'e1 34 8, e2 66 8, h1 30 26, h2 70 26, bk 50 34, y1 40 24, y2 60 24, b1 26 52, b2 74 52, f1 40 76, f2 60 76, m 50 58',
  e: 'e1>h1 h2>e2 e1-y1 y2-e2 h1-y1 y1-bk bk-y2 y2-h2 h1-b1 h2-b2 b1>f1 f2>b2 f1-m m-f2 y1-y2',
  story: ['The Owl keeps watch over the valley', 'and only blinks when the sun comes up.'],
});
add({
  id: 'n3-5', name: 'The Mitten',
  s: 'w1 30 76, w2 66 76, c1 28 60, c2 68 60, f1 24 26, f2 50 10, f3 74 26, t1 84 44, t2 94 30, m 50 42',
  e: 'w1-w2 w1-c1 w2-c2 c1-c2 c1-f1 f1-f2 f2-f3 f3-c2 c2-t1 t1-t2 t2-f3 c1-m m-f2 m-c2 f3-m',
  c: [[50, 34, 18]],
  story: ['A mitten lost on the sledging hill', 'turned up in the sky, still warm.'],
  teach: { title: 'Clouds', text: 'A cloud hides the seams behind it. Move close and they glimmer through for a moment: remember where they go. Stitched seams always show.' },
});
add({
  id: 'n3-6', name: 'The Pine Tree',
  s: 'top 50 4, a1 36 22, a2 64 22, b1 26 40, b2 50 36, b3 74 40, c1 16 60, c2 40 56, c3 60 56, c4 84 60, tr 50 76',
  e: 'top>a1 a2>top a1-a2 a1-b1 a1-b2 a2-b2 a2-b3 b1-b2 b2-b3 b1>c1 c1-c2 c2-b2 b2-c3 c3-c4 c4>b3 c2-tr tr-c3 c2-c3',
  c: [[32, 46, 14], [70, 48, 13]],
  story: ['The tallest pine on the hill', 'grew so tall it ended up among the stars.'],
});
add({
  id: 'n3-7', name: 'The Skater',
  s: 'a 14 30, b 30 14, c 46 30, d 30 46, x 54 40, e 62 52, f 78 36, g 94 52, h 78 68',
  e: 'a>b b>c d>a c-x x-e e>f f>g g>h h>e d-x',
  c: [[50, 40, 12]],
  story: ['A skater drawing figures on the frozen pond', 'spun so fast she spun right into the sky.'],
});
add({
  id: 'n3-8', name: 'The Stag', fig: 'stag',
  s: 'hd 64 30, n 74 38, a1 58 14, a2 50 4, a3 66 4, a4 76 10, a5 86 4, b1 30 40, b2 62 48, l1 28 76, l2 40 76, l3 56 76, l4 66 76, t 16 34',
  e: 'hd-n n>b2 hd-a1 a1=a2 a1-a3 a3-hd hd-a4 a4=a5 b1-hd b1-b2 b1>l1 l2>b1 b2>l3 l4>b2 l1-l2 l3-l4 b1=t',
  c: [[50, 32, 11]],
  story: ['The Stag walks the ridge at the top of the world', 'and the frost follows wherever he steps.'],
});

// ---------------------------------------------------------------- night 4: the moonlit lake (moons, twin stars)
N(4);
add({
  id: 'n4-1', name: 'The Rowing Boat',
  s: 'h1 10 46 ), h2 30 66, h3 70 66, h4 90 46 (, m1 34 46, m2 66 46, ms 50 10, o1 20 30, o2 80 30',
  e: 'h1-h2 h2-h3 h3-h4 h1-m1 m1-m2 m2-h4 m1-ms ms-m2 o1-m1 o2-m2 o1-h1 o2-h4',
  story: ['A little rowing boat drifts across the lake', 'and never once needs its oars.'],
  teach: { title: 'Moons', text: 'When the moons are out, the thread must begin at the crescent moon and finish at the full moon.' },
});
add({
  id: 'n4-2', name: 'The Lily Pad',
  s: 'c 50 40 (, p0 82 40 *1, p1 66 14, p2 34 14, p3 18 40, p4 34 66, p5 66 66, f1 50 2, f2 50 78 #',
  e: 'p0-p1 p1-p2 p2-p3 p3-p4 p4-p5 p5-p0 c-p1 c-p2 c-p4 c-p5 f1-p1 f1-p2 f2-p4 f2-p5',
  story: ['A frog sat on this lily pad to watch the moon', 'and the lily pad floated up to meet it.'],
});
add({
  id: 'n4-3', name: 'The Dragonfly',
  s: 'b1 50 6, b2 50 26 ~r1, b3 50 48, b4 50 76, w1 16 34, w2 22 60, r1 70 18 ~b2, r2 92 10, r3 90 34, r4 70 34',
  e: 'b1-b2 b2-b3 b3-b4 b3-w1 w1-w2 w2-b3 r1-r2 r2-r3 r3-r4 r4-r1',
  story: ['The Dragonfly is so quick, Grandmother said,', 'that it’s in two places at once.'],
  teach: { title: 'Twin stars', text: 'Twin stars share a colour. Stitch into one and the needle leaps to the other: pick it up there and carry on.' },
});
add({
  id: 'n4-4', name: 'The Leaping Trout', fig: 'trout',
  s: 'n 88 30, b1 72 16, b2 50 12, b3 28 22, t1 10 10, t2 6 38, b4 30 40, b5 54 38, b6 74 42, fin 52 54 ~sp, sp 46 79 ~fin, w1 26 70, w2 66 70',
  e: 'n-b1 b1-b2 b2-b3 b3-t1 t1-t2 t2-b3 b3-b4 b4-b5 b5-b6 b6-n b2-b5 b5-fin fin-b4 sp-w1 sp-w2 w1-w2',
  story: ['The Trout leapt for a mayfly one summer evening', 'and is still in the air, shining.'],
});
add({
  id: 'n4-5', name: 'The Reeds',
  s: 'g1 8 76 (, g2 30 72, r1 14 40, t1 28 10 ~t3, r2 40 34, m 50 56, g3 70 72, r3 60 34, t3 72 8 ~t1, r4 88 40, g4 92 76 )',
  e: 'g1-g2 g2-r1 r1-t1 t1-r2 r2-g2 g2-m m-g3 g3-r3 r3-t3 t3-r4 r4-g3 g3-g4',
  story: ['The reeds at the edge of the lake whisper', 'the names of every star, one by one.'],
});
add({
  id: 'n4-6', name: 'The Water Wheel',
  s: 'h 50 40, w0 78 40, w1 64 16, w2 36 16, w3 22 40, w4 36 64, w5 64 64, s1 92 66 (, s2 92 14 ), x 8 74 ~y, y 8 6 ~x',
  e: 'w0-w1 w1-w2 w2-w3 w3-w4 w4-w5 w5-w0 h-w0 h-w2 h-w4 h-w5 s1-w5 w0-s2 w4-x y-w2',
  story: ['The old water wheel turns all night,', 'stirring the stars so they don’t settle.'],
});
add({
  id: 'n4-7', name: 'The Ripples',
  s: 'c 50 40 ~o, a0 66 40, a1 50 26, a2 34 40, a3 50 54, o 92 70 ~c, b0 84 40, b1 50 8, b2 16 40, b3 50 74',
  e: 'a0-a1 a1-a2 a2-a3 a3-a0 b0-b1 b1-b2 b2-b3 b3-b0 c-a0 o-b0 a1=b1 a3=b3',
  story: ['A pebble dropped in the lake long ago', 'and the rings are still spreading, out among the stars.'],
});
add({
  id: 'n4-8', name: 'The Heron', fig: 'heron',
  s: 'bk 92 22 ), hd 74 18, n1 64 28, n2 60 42, w2 52 34 ~w4, b1 44 50, b2 26 42 *2, b3 22 58, b4 44 64, lg 50 76, ft 36 78, t 8 36 (, w1 32 28, w4 8 74 ~w2, r1 4 56, r2 22 72',
  e: 't-b2 b1-b2 b2-b3 b3-b4 b4-b1 b2-w1 w1-b1 b1-w2 w2-n2 n2-n1 n1-hd hd-bk b4-lg lg-ft ft-b4 w4-r1 r1-r2 r2-w4',
  story: ['The Heron stands on one leg in the shallows', 'and waits for the moon to come and be caught.'],
});

// ---------------------------------------------------------------- night 5: the meteor shower (every rule)
N(5);
add({
  id: 'n5-1', name: 'The Comet',
  s: 'h 78 30 *3, a 90 18, b 92 42, c 70 48, d 66 14, t1 50 30, t2 30 40, t3 10 54, u1 46 50, u2 24 66',
  e: 'h-a a-b b-h h-c c-d d-h h>t1 t1>t2 t2>t3 t3-u2 u2>u1 u1>c',
  story: ['The Comet comes back every hundred years', 'and always brings a little more sparkle.'],
});
add({
  id: 'n5-2', name: 'The Bell',
  s: 'k 50 4 (, s 50 16, b1 34 26, b2 66 26, b3 28 50, b4 72 50, r1 14 68, r2 86 68, c 50 76 #, m 50 62',
  e: 'k=s s-b1 s-b2 b1-b3 b2-b4 b3-r1 b4-r2 r1-c c-r2 b3-b4 b3-m m-b4',
  c: [[50, 44, 14]],
  story: ['The bell from the valley church', 'rings once at midnight, from somewhere up there.'],
});
add({
  id: 'n5-3', name: 'The Kite on the Wind',
  s: 'top 50 4, l 26 30, r 74 30, m 50 56, c 50 30, k1 40 70 ~k3, k3 78 72 ~k1, k4 92 56',
  e: 'top>l l>m m>r r>top top-c c-m l-c c-r m-k1 k3-k4 k4>r',
  story: ['A second kite broke free to join the first,', 'and its tail went one way while it went another.'],
});
add({
  id: 'n5-4', name: 'The Teapot', fig: 'teapot',
  s: 'kn 50 6 ~st, l1 36 18, l2 64 18, b1 22 34, b2 78 34, b3 18 58, b4 82 58, f1 34 74, f2 66 74, h1 6 30, h2 6 56, sp1 92 40, sp2 98 22 ), st 22 8 ~kn, q1 10 2, q2 8 16, m 50 46',
  e: 'kn-l1 kn-l2 l1-b1 l2-b2 b1-b3 b2-b4 b3-f1 f1-f2 f2-b4 b1-h1 h1-h2 h2-b3 b4>sp1 sp1>sp2 b2-sp1 b1-m m-b4 b3-m m-b2 st-q1 q1-q2 q2-st',
  c: [[50, 40, 15]],
  story: ['A teapot for the longest night of the year,', 'always warm, always full, always enough for everyone.'],
});
add({
  id: 'n5-5', name: 'The Harp',
  s: 'p1 14 74, p2 14 40, p3 22 8, t1 50 14, t2 80 22, t3 90 50, f1 74 74, s1 30 72, s2 46 72, s3 62 72, u1 34 36, u2 52 30, u3 68 40',
  e: 'p1-p2 p2-p3 p3>t1 t1>t2 t2>t3 t3-f1 f1-s3 s3-s2 s2-s1 s1-p1 s1=u1 s2-u2 u2-t1 s3=u3',
  c: [[50, 48, 9]],
  story: ['Somebody left a harp out on the hill,', 'and the wind played it all the way up to the stars.'],
});
add({
  id: 'n5-6', name: 'The Burrow Door',
  s: 'd1 22 76 (, d2 22 44, d3 36 18, d4 64 18, d5 78 44, d6 78 76 ), c 50 40 *2, w1 16 24 ~w2, k 84 22 #, w2 50 58 ~w1, p 40 70, q 60 70',
  e: 'd1-d2 d2-d3 d3-d4 d4-d5 d5-d6 d2-c c-d5 d3-c c-d4 d2-w1 w1-d3 d4-k k-d5 w2-p p-q q-w2',
  story: ['The round green door of the burrow,', 'left open a crack so the starlight can get in.'],
});
add({
  id: 'n5-7', name: 'The Shooting Star',
  s: 's0 70 8, s1 76 26, s2 94 28, s3 80 40, s4 86 60, s5 70 48 *2, s6 54 60, s7 60 40, s8 46 28 ), s9 64 26, t1 40 50 ~u1, t2 22 62, t3 6 76 (, u1 26 26 ~t1, u2 10 14',
  e: 's0>s1 s1>s2 s2>s3 s3>s4 s4>s5 s5>s6 s6>s7 s7>s8 s8>s9 s9>s0 s1-s9 s3-s5 s5-s7 s7-s9 s1-s3 t3-t2 t2-t1 u1-u2 u2-s8',
  c: [[72, 36, 12]],
  story: ['Make a wish on the Shooting Star,', 'and Grandmother said it always, always comes true.'],
});
add({
  id: 'n5-8', name: 'The Two Chinchillas', fig: 'twochin',
  s: 'de1 16 10, de2 30 8, dh1 12 26, dh2 34 24, dn 24 34 #, db1 8 52, db2 36 48, df1 14 74, df2 34 74, dt 2 70, ee1 70 8, ee2 84 10, eh1 66 24, eh2 88 26, en 76 34 #, eb1 64 48, eb2 92 52, ef1 66 74, ef2 86 74, et 98 70, hrt 50 40 *1',
  e: 'de1-de2 de1-dh1 de2-dh2 dh1-dn dn-dh2 dh1-db1 db1-df1 df1-df2 df2-db2 db1=dt db2-hrt hrt-eb1 ee1-ee2 ee2-eh2 ee1-eh1 eh2-en en-eh1 eh2-eb2 eb2-ef2 ef2-ef1 ef1-eb1 eb2=et',
  story: ['And the brightest of them all: two chinchillas, side by side,', 'stitched into the sky above the burrow, where they’ll always be.'],
});
