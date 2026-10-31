// Paperfold: the festival book's five chapters and its forty pages. Each page is a sheet drawn as text: `grid` rows
// with '#' for paper, 'o' for paper with a punched hole and '.' for no paper; `front` and `back` colour the faces,
// with `fc` / `bc` rows overriding single cells by letter (r red, g gold, b blue, t teal, p pink, v violet,
// w white, n navy, o orange, l leaf, c cream, m plum); `marks` print "x y f|b mark" on a face; `tape` joins
// "x0 y0 x1 y1" so no fold may part them; `creases` pre-fold "x0 y0 x1 y1 v|m" (valley or mountain, as seen on the
// front). `sol` is the designed solution: the target is the picture it makes, and par is its length.
// tests/fold-bot.mjs checks every page with the exhaustive solver in fold-game.ts: par is the true minimum, and the
// number of shortest solutions is recorded in tests/fold-solutions.json. The early chapters stay small and short;
// from the back half of Cranes the sheets grow to 6 by 6 and the pars to 8, and the targets were composed as little
// pictures (a crane's head, a lantern, a boat, a star) whose only shortest way is one particular order of folds.
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
    tip: { title: 'Tape and creases', text: 'Tape holds two squares together, so no fold may part them. A red dashed crease is a mountain fold: that part tucks behind. A blue dashed crease is a valley: it folds over the top. Turn the paper face down and each becomes the other, and creases that disagree along one line lock it.' } },
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
  P({ id: 'l7', chapter: 'lanterns', piece: 'lantern', name: 'Lantern Window', grid: ['###', '###', '###'], front: 'red', back: 'gold', fc: ['rrr', 'rpg', 'rrp'],
    marks: ['2 1 f flame', '2 2 f window'], sol: ['x1<', 'y1v', 'x1>'] }),
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
  P({ id: 'c5', chapter: 'cranes', piece: 'crane', name: 'Lace Crane', grid: ['#o##', '####', '###o', '####'], front: 'white', back: 'red', fc: ['wwww', 'wwww', 'wwww', 'rwww'], bc: ['rrrr', 'rprr', 'rrrr', 'rrwr'],
    marks: ['0 3 f dot', '2 3 b eye', '1 1 b heart'], sol: ['x3>', 'y1^', 'x1<', 'y1v'],
    tip: 'The sheets grow from here, and the order of the folds matters: whatever folds last lands on top. Find the square that must finish uppermost, and save its fold for later.' }),
  P({ id: 'c6', chapter: 'cranes', piece: 'crane', name: 'Folded Wings', grid: ['##o##', '#####', 'o###o', '#####'], front: 'white', back: 'pink', fc: ['wwwwp', 'wwwww', 'wwrww', 'wwwww'],
    marks: ['2 2 f dot', '4 3 f eye', '3 0 f heart'], sol: ['x1<', 'x3<', 'x2>', 'y3v', 'y2^'] }),
  P({ id: 'c7', chapter: 'cranes', piece: 'crane', name: 'Crane Tail', grid: ['#o####', '######', '####o#', '######'], front: 'white', back: 'red', bc: ['rrrrwp', 'rprrrr', 'rrrrrr', 'rrrrrw'],
    marks: ['4 3 b dot', '5 3 b eye', '0 0 f leaf'], sol: ['x1>', 'x1>', 'y3v', 'y1v', 'x1>'] }),
  P({ id: 'c8', chapter: 'cranes', piece: 'crane', name: 'The Thousand Cranes', grid: ['#o###', '###o#', '#####', 'o###o', '##o##'], front: 'red', back: 'white', fc: ['rrwrr', 'rrrrr', 'rrrrr', 'rrrrr', 'rrrrw'], bc: ['wwwwp', 'wwwww', 'wwwww', 'wwwww', 'wwwww'],
    marks: ['1 2 f dot', '4 4 f eye', '2 0 f heart', '4 0 b flower'], sol: ['y4v', 'x1<', 'x1<', 'y1v', 'x1>', 'y2^'] }),

  // ---- Stars: tape and creases
  P({ id: 's1', chapter: 'stars', piece: 'star', name: 'Taped Together', grid: ['###'], front: 'navy', back: 'gold', tape: ['0 0 1 0'], marks: ['0 0 b star'], sol: ['x2>'],
    tip: 'The tape holds the left two squares together: the line between them can’t fold.' }),
  P({ id: 's2', chapter: 'stars', piece: 'star', name: 'Mountain Fold', grid: ['##'], front: 'navy', back: 'gold', creases: ['0 0 1 0 m'], marks: ['1 0 b star', '0 0 f moon'], sol: ['x1<'],
    tip: 'A mountain crease folds behind: the right half tucks under, out of sight.' }),
  P({ id: 's3', chapter: 'stars', piece: 'star', name: 'Valley Fold', grid: ['###', '###'], front: 'navy', back: 'gold', creases: ['0 0 1 0 v', '0 1 1 1 m'],
    marks: ['0 0 b star', '2 1 b moon', '0 1 f sun'], sol: ['y1v', 'x1<'],
    tip: 'Blue dashes are a valley crease, red a mountain. On one line they disagree, so it won’t fold. Fold the top down first: face down, the valley turns into a mountain, and the two agree.' }),
  P({ id: 's4', chapter: 'stars', piece: 'star', name: 'Starlight Strip', grid: ['####', '####', '####', '####'], front: 'navy', back: 'gold', fc: ['nnnn', 'nnnn', 'nnnn', 'gnnv'], bc: ['gngg', 'gggg', 'gggg', 'gngg'], tape: ['1 1 2 1'], creases: ['2 3 3 3 m', '2 2 3 2 m'],
    marks: ['1 0 b moon', '2 0 b star', '3 3 f sun'], sol: ['y1v', 'x3>', 'x2>', 'y2^'] }),
  P({ id: 's5', chapter: 'stars', piece: 'star', name: 'Twinkle', grid: ['#####', '#####', '#####', '#####'], front: 'navy', back: 'gold', fc: ['nvnnn', 'nnnnn', 'nnnnn', 'nnnnn'], tape: ['2 0 2 1'], creases: ['0 2 1 2 m', '0 3 1 3 v'],
    marks: ['0 3 b star', '4 0 f moon'], sol: ['y3^', 'x1<', 'x1<', 'y2v', 'x1>'] }),
  P({ id: 's6', chapter: 'stars', piece: 'star', name: 'Upside Down', grid: ['######', '######', '######', '######'], front: 'navy', back: 'gold', fc: ['nnvvnn', 'nnvvnn', 'nnvvnn', 'nnvvnn'], bc: ['gggggg', 'gggggv', 'gggggg', 'gggggg'], creases: ['0 0 1 0 m', '0 1 1 1 m', '0 2 1 2 m', '0 3 1 3 m', '4 0 5 0 v', '4 1 5 1 v', '4 2 5 2 v', '4 3 5 3 v'],
    marks: ['0 3 f moon', '5 2 b star', '3 0 b sun'], sol: ['x1>', 'y1v', 'x1<', 'x3>', 'y2v', 'x1>'] }),
  P({ id: 's7', chapter: 'stars', piece: 'star', name: 'Patchwork Sky', grid: ['.###.', '#####', '#####', '#####', '.###.'], front: 'navy', back: 'gold', fc: ['.nvn.', 'gvnvn', 'vnvnv', 'nnnvg', '.nvn.'], bc: ['.ggv.', 'ggggg', 'ggggg', 'ggggg', '.ggg.'], tape: ['2 1 2 2'], creases: ['0 2 1 2 m', '3 2 4 2 v'],
    marks: ['0 1 f star', '3 0 b moon', '1 3 f sun', '4 3 f star'], sol: ['x1<', 'y4^', 'y3^', 'x1<', 'y1v', 'x1>'] }),
  P({ id: 's8', chapter: 'stars', piece: 'star', name: 'The Evening Star', grid: ['.####.', '######', '######', '######', '.####.'], front: 'gold', back: 'navy', fc: ['.ggvg.', 'gggggg', 'gggggg', 'gggggn', '.gggg.'], bc: ['.gnnn.', 'nnnnnn', 'nnnnnn', 'nnnnnn', '.nnnn.'], tape: ['2 2 3 2'], creases: ['0 2 1 2 m', '4 2 5 2 v'],
    marks: ['5 3 f moon', '1 4 f star', '1 0 b sun'], sol: ['x1<', 'y3v', 'x1<', 'x3>', 'y1v', 'x2<'] }),

  // ---- Festival Night: the ribbon, and everything together
  P({ id: 'n1', chapter: 'night', piece: 'moon', name: 'Ribbon Tie', grid: ['####', '####'], front: 'plum', back: 'gold', fc: ['gmmm', 'mmmm'],
    marks: ['1 0 f ribbon', '0 0 f moon'], sol: ['x3>', 'x1>', 'y1v'] }),
  P({ id: 'n2', chapter: 'night', piece: 'fish', name: 'Paper Carp', grid: ['######', '######', '######'], front: 'orange', back: 'white', fc: ['oooooo', 'ocococ', 'oooooo'], bc: ['wwwwww', 'wwowww', 'wwwwww'],
    marks: ['4 0 b ribbon', '0 1 f eye'], sol: ['x5>', 'x4>', 'y1^', 'x3>', 'y1^'] }),
  P({ id: 'n3', chapter: 'night', piece: 'lantern', name: 'Ribbon Lantern', grid: ['#####', '#o#o#', '#####', '##o##', '#####'], front: 'red', back: 'gold', fc: ['rrrrr', 'rrgrr', 'rrrrr', 'rrrrr', 'rrrrr'], bc: ['rgrgg', 'ggggg', 'ggggp', 'ggggg', 'ggggg'],
    marks: ['4 1 b ribbon', '2 2 f window', '4 2 b window', '1 3 b flame'], sol: ['x1<', 'x3<', 'y4v', 'x1<', 'y3v'] }),
  P({ id: 'n4', chapter: 'night', piece: 'boat', name: 'Candle Boat', grid: ['######', '######', '######', '######', '.####.'], front: 'blue', back: 'white', fc: ['bbbbbb', 'bbbbbb', 'bbbbbb', 'bbbbbb', '.bwbb.'], bc: ['wwwwww', 'wwwwww', 'nwwwww', 'wwwwwn', '.wwww.'], tape: ['2 4 3 4', '0 1 0 2'],
    marks: ['2 4 f flame', '3 1 f wave', '2 1 f ribbon', '0 0 f wave'], sol: ['x5>', 'y4^', 'x1>', 'y1^', 'y1v', 'x3<'] }),
  P({ id: 'n5', chapter: 'night', piece: 'crane', name: 'Ribbon Crane', grid: ['##o##', '#####', 'o###o', '#####', '##o##'], front: 'white', back: 'red', fc: ['wwwpw', 'wwwww', 'wwwww', 'wwwwr', 'wwwww'], creases: ['0 1 1 1 m', '0 3 1 3 m'],
    marks: ['4 3 f dot', '2 2 f eye', '4 0 f ribbon'], sol: ['x1<', 'x3<', 'x2<', 'y4v', 'y1v', 'y1v'] }),
  P({ id: 'n6', chapter: 'night', piece: 'star', name: 'Shooting Star', grid: ['######', '######', '######', '######', '######'], front: 'navy', back: 'gold', fc: ['nvnvnv', 'vnvnvn', 'gvnvvv', 'vnvnvn', 'nvnvnv'], bc: ['ggnggg', 'gggggg', 'gggggg', 'gggggg', 'gggggg'], tape: ['2 2 3 2'], creases: ['4 0 5 0 v', '4 1 5 1 v', '4 2 5 2 m'],
    marks: ['4 2 f ribbon', '0 2 f star'], sol: ['y4v', 'y1v', 'y1v', 'x5>', 'y1^', 'x4<', 'x1>'] }),
  P({ id: 'n7', chapter: 'night', piece: 'fish', name: 'Moon Carp', grid: ['.####.', '######', '######', '######', '######', '.####.'], front: 'orange', back: 'cream', fc: ['.oooo.', 'oovroo', 'orooro', 'orooro', 'oorrog', '.oooo.'], bc: ['.cccc.', 'cccccc', 'cccccc', 'cccccc', 'cccccc', '.orcc.'], creases: ['2 0 2 1 m', '3 0 3 1 m', '2 4 2 5 v', '3 4 3 5 v'],
    marks: ['0 3 b moon', '5 1 f eye', '1 5 b ribbon'], sol: ['y1^', 'y4v', 'y1^', 'x5>', 'x4>', 'y1^', 'x3<'] }),
  P({ id: 'n8', chapter: 'night', piece: 'moon', name: 'Festival Night', grid: ['######', '#o##o#', '######', '######', '#o##o#', '######'], front: 'navy', back: 'gold', fc: ['nrnnnr', 'rnrnrn', 'nrnrnr', 'rnrnrg', 'nrnrnr', 'rnrnrn'], bc: ['gggggg', 'gggggg', 'gggggg', 'gggggg', 'gggggg', 'grgggg'], tape: ['2 2 3 2'], creases: ['0 0 1 0 m', '0 5 1 5 v'],
    marks: ['0 1 b moon', '3 0 f star', '1 5 b flame', '5 3 f ribbon'], sol: ['y5^', 'x1<', 'y1v', 'x4<', 'x1<', 'y3^', 'x2<', 'y1v'] }),
];
