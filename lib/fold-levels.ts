// Paperfold: the festival book's five chapters and its forty pages. Each page is a sheet drawn as text: `grid` rows
// with '#' for paper, 'o' for paper with a punched hole and '.' for no paper; `front` and `back` colour the faces,
// with `fc` / `bc` rows overriding single cells by letter (r red, g gold, b blue, t teal, p pink, v violet,
// w white, n navy, o orange, l leaf, c cream, m plum); `marks` print "x y f|b mark" on a face; `tape` joins
// "x0 y0 x1 y1" so no fold may part them; `creases` pre-fold "x0 y0 x1 y1 v|m" (valley or mountain, as seen on the
// front). `sol` is the designed solution: the target is the picture it makes, and par is its length.
// tests/fold-bot.mjs checks every page with a breadth-first solver: par is the true minimum, and the number of
// shortest solutions is recorded in tests/fold-solutions.json.
import type { Colour } from './fold-game.js';

export type ChapterId = 'lanterns' | 'boats' | 'cranes' | 'stars' | 'night';
export type Piece = 'lantern' | 'boat' | 'crane' | 'star' | 'moon' | 'fish';
export type Chapter = { id: ChapterId; name: string; piece: Piece; blurb: string; tip: { title: string; text: string } };
export const CHAPTERS: Chapter[] = [
  { id: 'lanterns', name: 'Lanterns', piece: 'lantern', blurb: 'The festival needs its lanterns back. Fold the coloured sheets into shape.',
    tip: { title: 'Fold to match', text: 'Drag an edge across a crease line to fold it over, or click the side you want to fold. Folded paper flips over, so the back colour shows. Match the picture in the corner: the shape, the colours and the marks on top.' } },
  { id: 'boats', name: 'Boats', piece: 'boat', blurb: 'Little boats for the pond, from odd-shaped sheets cut by the gust.',
    tip: { title: 'Odd shapes', text: 'Not every sheet is square. Any line that crosses the paper can fold, and a part can fold out past the edge of the rest.' } },
  { id: 'cranes', name: 'Cranes', piece: 'crane', blurb: 'Cranes to ride the evening breeze. These pages are punched with little holes.',
    tip: { title: 'Holes show through', text: 'A punched hole lets you see the layer underneath. Fold a coloured square under a hole to fill it, or leave it empty if the picture shows a hole.' } },
  { id: 'stars', name: 'Stars', piece: 'star', blurb: 'Stars for the sky, on sheets with tape and old creases.',
    tip: { title: 'Tape and creases', text: 'Tape holds two squares together, so no fold may part them. A red dashed crease is a mountain fold: that part tucks behind. If the paper is face down, a mountain becomes a valley.' } },
  { id: 'night', name: 'Festival Night', piece: 'moon', blurb: 'Everything at once, and a ribbon that has to finish on the outside. Then: light the lanterns.',
    tip: { title: 'The ribbon', text: 'The ribbon square must end up on top, showing its bow. Everything you have learned comes together here.' } },
];

export type PuzzleSpec = {
  id: string; chapter: ChapterId; name: string; piece: Piece;
  grid: string[]; front: Colour; back: Colour; fc?: string[]; bc?: string[];
  marks?: string[]; tape?: string[]; creases?: string[];
  sol: string[];
  /** a line of teaching shown on this page's first visit */ tip?: string;
};

const P = (s: PuzzleSpec) => s;
export const PUZZLES: PuzzleSpec[] = [
  // ---- Lanterns: folding flips the paper over
  P({ id: 'l1', chapter: 'lanterns', piece: 'lantern', name: 'First Fold', grid: ['##'], front: 'red', back: 'gold', marks: ['1 0 b window'], sol: ['x1<'],
    tip: 'Fold the right half over onto the left: the gold back flips up, window and all.' }),
  P({ id: 'l2', chapter: 'lanterns', piece: 'lantern', name: 'Corner to Corner', grid: ['##', '##'], front: 'red', back: 'gold', marks: ['0 1 b window'], sol: ['x1<', 'y1^'],
    tip: 'Two folds this time. Watch which corner the window is on.' }),
  P({ id: 'l3', chapter: 'lanterns', piece: 'lantern', name: 'Paper Strip', grid: ['###'], front: 'orange', back: 'cream', marks: ['0 0 b flame', '2 0 f star'], sol: ['x1<', 'x1>'] }),
  P({ id: 'l4', chapter: 'lanterns', piece: 'lantern', name: 'Two Windows', grid: ['###', '###'], front: 'red', back: 'gold', fc: ['rpr', 'prp'], marks: ['0 0 b window', '2 1 b window'], sol: ['x1<', 'y1v'] }),
  P({ id: 'l5', chapter: 'lanterns', piece: 'lantern', name: 'Long Lantern', grid: ['####', '####'], front: 'pink', back: 'gold', bc: ['ggog', 'oggo'], marks: ['2 0 b flame', '0 1 b window'], sol: ['y1^', 'x3>', 'x2<'] }),
  P({ id: 'l6', chapter: 'lanterns', piece: 'lantern', name: 'Striped Lantern', grid: ['####', '####'], front: 'red', back: 'cream', fc: ['rgrg', 'grgr'], marks: ['1 1 b flame', '3 0 b window'], sol: ['y1v', 'x1<', 'x1>'] }),
  P({ id: 'l7', chapter: 'lanterns', piece: 'lantern', name: 'Tall Order', grid: ['#####'], front: 'violet', back: 'gold', fc: ['vpvpv'], bc: ['gggog'], marks: ['3 0 b sun', '1 0 b window'], sol: ['x1<', 'x1>', 'x1>'] }),
  P({ id: 'l8', chapter: 'lanterns', piece: 'lantern', name: 'The Great Lantern', grid: ['####', '####', '####'], front: 'red', back: 'gold', fc: ['rrrr', 'rppr', 'rrrr'], marks: ['0 0 b flame', '3 2 b window', '1 1 f sun', '2 0 b window'], sol: ['x3>', 'x2<', 'y1^'] }),

  // ---- Boats: odd shapes and longer sheets
  P({ id: 'b1', chapter: 'boats', piece: 'boat', name: 'Little Hull', grid: ['##.', '###'], front: 'blue', back: 'white', marks: ['0 0 b wave'], sol: ['x1<', 'x1>'] }),
  P({ id: 'b2', chapter: 'boats', piece: 'boat', name: 'Corner Sheet', grid: ['#.', '##'], front: 'teal', back: 'white', marks: ['1 1 b wave', '0 0 f dot'], sol: ['x1>', 'y1v'] }),
  P({ id: 'b3', chapter: 'boats', piece: 'boat', name: 'Sailcloth', grid: ['.#.', '###'], front: 'blue', back: 'cream', marks: ['1 0 b flower', '0 1 f wave'], sol: ['x2<', 'y1v'] }),
  P({ id: 'b4', chapter: 'boats', piece: 'boat', name: 'Long Keel', grid: ['####', '####'], front: 'navy', back: 'white', marks: ['3 0 b wave', '0 1 b star'], sol: ['x1<', 'y1v', 'x1<'] }),
  P({ id: 'b5', chapter: 'boats', piece: 'boat', name: 'Two-Tone Raft', grid: ['####', '###.'], front: 'teal', back: 'gold', fc: ['tbtb', 'btb.'], marks: ['2 0 b sun'], sol: ['x3<', 'x2>', 'y1v'] }),
  P({ id: 'b6', chapter: 'boats', piece: 'boat', name: 'Mast and Sail', grid: ['#...', '####', '#...'], front: 'red', back: 'white', bc: ['b...', 'wwbw', 'b...'], marks: ['3 1 b wave', '0 0 b flower'], sol: ['x3>', 'y2v', 'x1<'] }),
  P({ id: 'b7', chapter: 'boats', piece: 'boat', name: 'Duck Boat', grid: ['##..', '####'], front: 'gold', back: 'teal', marks: ['0 0 f eye', '3 1 b wave'], sol: ['x3>', 'x2>', 'y1v'] }),
  P({ id: 'b8', chapter: 'boats', piece: 'boat', name: 'The Festival Barge', grid: ['####', '####', '.##.'], front: 'blue', back: 'gold', marks: ['0 0 b sun', '3 1 b wave', '1 2 f star'], sol: ['x1<', 'x2<', 'y2^'] }),

  // ---- Cranes: punched holes
  P({ id: 'c1', chapter: 'cranes', piece: 'crane', name: 'Peephole', grid: ['#o'], front: 'white', back: 'pink', marks: ['0 0 b eye'], sol: ['x1>'],
    tip: 'The right square has a hole punched in it, and a hole shows whatever lies underneath. Fold so the pink eye ends up on top.' }),
  P({ id: 'c2', chapter: 'cranes', piece: 'crane', name: 'Wing Tips', grid: ['o##o'], front: 'white', back: 'red', marks: ['1 0 b heart'], sol: ['x1<', 'x2<'] }),
  P({ id: 'c3', chapter: 'cranes', piece: 'crane', name: 'Window Bird', grid: ['##', 'o#'], front: 'pink', back: 'white', marks: ['1 0 b eye', '1 1 b dot'], sol: ['x1>', 'y1^'] }),
  P({ id: 'c4', chapter: 'cranes', piece: 'crane', name: 'Long Neck', grid: ['###', 'o#o'], front: 'white', back: 'teal', marks: ['0 0 b eye', '2 0 f heart'], sol: ['x1<', 'y1v'] }),
  P({ id: 'c5', chapter: 'cranes', piece: 'crane', name: 'Lace Crane', grid: ['#o##', '####'], front: 'red', back: 'white', bc: ['wwww', 'wpwp'], marks: ['1 1 b eye', '0 0 b flower'], sol: ['x1<', 'x1<', 'y1^'] }),
  P({ id: 'c6', chapter: 'cranes', piece: 'crane', name: 'Two Holes', grid: ['o##', '##o', '###'], front: 'violet', back: 'pink', marks: ['1 0 b eye', '0 1 f star', '2 2 b heart'], sol: ['x2>', 'x1>', 'y2v'] }),
  P({ id: 'c7', chapter: 'cranes', piece: 'crane', name: 'Crane Tail', grid: ['####', 'o..#'], front: 'white', back: 'red', marks: ['3 1 b eye', '1 0 b heart'], sol: ['x1<', 'x1<', 'y1v'] }),
  P({ id: 'c8', chapter: 'cranes', piece: 'crane', name: 'The Thousand Cranes', grid: ['#o#o', 'o#o#', '#o#o'], front: 'red', back: 'white', bc: ['wwww', 'wpwp', 'wwww'], marks: ['0 0 b eye', '2 2 f heart', '1 1 b star'], sol: ['x1<', 'x2>', 'y1^', 'x1>'] }),

  // ---- Stars: tape and creases
  P({ id: 's1', chapter: 'stars', piece: 'star', name: 'Taped Together', grid: ['###'], front: 'navy', back: 'gold', tape: ['0 0 1 0'], marks: ['0 0 b star'], sol: ['x2>'],
    tip: 'The tape holds the left two squares together: the line between them can’t fold.' }),
  P({ id: 's2', chapter: 'stars', piece: 'star', name: 'Mountain Fold', grid: ['##'], front: 'navy', back: 'gold', creases: ['0 0 1 0 m'], marks: ['1 0 b star', '0 0 f moon'], sol: ['x1<'],
    tip: 'A mountain crease folds behind: the right half tucks under, out of sight.' }),
  P({ id: 's3', chapter: 'stars', piece: 'star', name: 'Starlight Strip', grid: ['####'], front: 'navy', back: 'gold', tape: ['2 0 3 0'], marks: ['3 0 b star', '0 0 f moon'], sol: ['x1>', 'x1>'] }),
  P({ id: 's4', chapter: 'stars', piece: 'star', name: 'Tucked Away', grid: ['###', '###'], front: 'navy', back: 'gold', creases: ['0 0 0 1 m', '1 0 1 1 m', '2 0 2 1 m'], marks: ['0 0 b star', '2 1 f moon'], sol: ['x1<', 'x1>'] }),
  P({ id: 's5', chapter: 'stars', piece: 'star', name: 'Twinkle', grid: ['.#.', '###', '.#.'], front: 'gold', back: 'navy', tape: ['1 1 1 2'], marks: ['1 0 b star', '2 1 f sun'], sol: ['x1<', 'y1v', 'x1>'] }),
  P({ id: 's6', chapter: 'stars', piece: 'star', name: 'Upside Down', grid: ['####', '####'], front: 'navy', back: 'gold', creases: ['2 0 3 0 m', '2 1 3 1 m'], marks: ['3 0 b star', '0 1 b moon'], sol: ['x3>', 'x1<', 'y1^'] }),
  P({ id: 's7', chapter: 'stars', piece: 'star', name: 'Patchwork Sky', grid: ['###', '###', '###'], front: 'navy', back: 'gold', fc: ['nvn', 'vnv', 'nvn'], tape: ['0 0 0 1'], creases: ['1 1 1 2 m', '2 1 2 2 m'], marks: ['2 2 b star', '0 0 b moon'], sol: ['y2v', 'x2>', 'x1<'] }),
  P({ id: 's8', chapter: 'stars', piece: 'star', name: 'The Evening Star', grid: ['.##.', '####', '.##.'], front: 'gold', back: 'navy', tape: ['1 0 2 0'], creases: ['0 1 1 1 m'], marks: ['1 2 b star', '3 1 b moon', '2 1 f sun'], sol: ['x1<', 'y1v', 'y1^', 'x1<'] }),

  // ---- Festival Night: the ribbon, and everything together
  P({ id: 'n1', chapter: 'night', piece: 'moon', name: 'Ribbon Tie', grid: ['###'], front: 'plum', back: 'gold', marks: ['0 0 b ribbon', '2 0 b moon'], sol: ['x1<', 'x1<'] }),
  P({ id: 'n2', chapter: 'night', piece: 'fish', name: 'Paper Carp', grid: ['###', '#..'], front: 'orange', back: 'white', marks: ['2 0 b eye', '0 1 f ribbon'], sol: ['x2>', 'y1^'] }),
  P({ id: 'n3', chapter: 'night', piece: 'lantern', name: 'Ribbon Lantern', grid: ['###', 'o##', '###'], front: 'red', back: 'gold', fc: ['rrr', 'rpr', 'rrr'], marks: ['0 0 b ribbon', '1 2 b flame'], sol: ['x1<', 'x1>', 'y2v'] }),
  P({ id: 'n4', chapter: 'night', piece: 'boat', name: 'Candle Boat', grid: ['####', '.##.'], front: 'blue', back: 'white', tape: ['1 1 2 1'], marks: ['0 0 b flame', '3 0 f ribbon'], sol: ['y1^', 'x1<', 'x1>'] }),
  P({ id: 'n5', chapter: 'night', piece: 'crane', name: 'Ribbon Crane', grid: ['####', '#o##'], front: 'white', back: 'red', bc: ['rrrr', 'rrpr'], creases: ['0 1 1 1 m'], marks: ['2 0 b ribbon', '0 0 b eye'], sol: ['x1>', 'y1^', 'x2>'] }),
  P({ id: 'n6', chapter: 'night', piece: 'star', name: 'Shooting Star', grid: ['####', '##..'], front: 'navy', back: 'gold', fc: ['nvnv', 'vn..'], tape: ['0 1 1 1'], marks: ['3 0 b star', '0 0 b ribbon'], sol: ['y1^', 'x3>', 'x1>'] }),
  P({ id: 'n7', chapter: 'night', piece: 'fish', name: 'Moon Carp', grid: ['####', '####', '#...'], front: 'orange', back: 'cream', fc: ['oooo', 'orro', 'o...'], creases: ['1 1 2 1 m'], marks: ['3 0 b moon', '0 2 b ribbon', '1 1 f eye'], sol: ['y2v', 'y1v', 'x3<'] }),
  P({ id: 'n8', chapter: 'night', piece: 'moon', name: 'Festival Night', grid: ['####', '####', '####', '####'], front: 'navy', back: 'gold', fc: ['nrnr', 'rnrn', 'nrnr', 'rnrn'],
    tape: ['1 1 2 1'], marks: ['0 0 b moon', '3 3 b ribbon', '3 0 b star', '1 2 f flame'], sol: ['y1^', 'y2^', 'x1<', 'x1>'] }),
];
