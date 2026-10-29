// Echo Burrow's thirty rooms, in five chapters of six. Each map is 24 tiles wide and 13 tall:
//   #  rock            k  rock framing a kit tunnel (a one-tile gap only Dora fits)
//   =  ledge you can jump up through and stand on        ~  crumbling ledge      %  glow-moss (solid near the echo)
//   ^  fan (wind rises above it)   o  crate   *  golden seed   e  burrow door (the way out)   d / z  Dora's / Enzo's start
//   1-4  pressure plate for group 1-4      5-8  heavy plate (weight 2: Enzo or a crate) for group 1-4
//   A-D  door opened by group 1-4 (a column of letters is one door)
//   v / V  a seesaw's left tile (four tiles wide), its left / right end down
// Lifts are listed apart: a plank `w` tiles wide resting on the floor of row `r`, rising `up` tiles while group `g`
// is pressed. `all` lists groups whose plates must all be pressed at once; `hold` keeps a group's doors open for some
// seconds after release; `fan` makes the fans run only while that group is pressed.
export type ChapterId = 'cellar' | 'hollow' | 'brook' | 'gallery' | 'home';
export type RoomDef = {
  id: string; name: string; chapter: ChapterId;
  /** Who records first (and becomes the echo). */
  first: 'dora' | 'enzo';
  /** Seconds of candle for the recording. */
  candle: number;
  /** Loops for the par star (the recording counts as one, so 2 is a first-try clear). */
  par: number;
  /** A free nudge, one short sentence. */
  hint: string;
  /** A new idea this room teaches, shown as the room opens. */
  teach?: string;
  map: string[];
  lifts?: { c: number; r: number; w: number; up: number; g: number }[];
  all?: number[];
  hold?: Record<number, number>;
  fan?: number;
};
export type Chapter = { id: ChapterId; name: string; blurb: string };

export const CHAPTERS: Chapter[] = [
  { id: 'cellar', name: 'The Root Cellar', blurb: 'Dust, old roots and the first echo.' },
  { id: 'hollow', name: 'Mushroom Hollow', blurb: 'Crates, heavy plates and doors that count to three.' },
  { id: 'brook', name: 'The Underground Brook', blurb: 'Lifts, wind and running water.' },
  { id: 'gallery', name: 'Crystal Gallery', blurb: 'Enzo goes first. Seesaws and crumbling ledges.' },
  { id: 'home', name: 'Home Burrow', blurb: 'Glow-moss, every trick, and the way home.' },
];

export const ROOM_DEFS: RoomDef[] = [
  // ---------------------------------------------------------------- the Root Cellar
  {
    id: 'c1', name: 'First Light', chapter: 'cellar', first: 'dora', candle: 12, par: 3,
    hint: 'Walk Dora onto the plate and stay there until the candle burns out.',
    teach: 'Dora records first. Then Enzo plays beside her echo.',
    map: [
      '########################',
      '#......................#',
      '#.*....................#',
      '#......................#',
      '#......................#',
      '#d...1.................#',
      '#######....#...........#',
      '#..........#...........#',
      '#..........#...........#',
      '#..........A...........#',
      '#..........A...........#',
      '#..z.......A.........e.#',
      '########################',
    ],
  },
  {
    id: 'c2', name: 'Two Doors', chapter: 'cellar', first: 'dora', candle: 12, par: 3,
    hint: 'Hold the first plate until Enzo is through, then hurry to the second.',
    teach: 'The echo replays in time: what Dora does later happens later.',
    map: [
      '########################',
      '#......................#',
      '#......................#',
      '#......................#',
      '#d..1......3.....2.....#',
      '########################',
      '#...#..#......#........#',
      '#...#..#......#........#',
      '#...#..#......#........#',
      '#...C..A......B........#',
      '#...C..A......B........#',
      '#.*.C.zA......B......e.#',
      '########################',
    ],
  },
  {
    id: 'c3', name: 'Leg Up', chapter: 'cellar', first: 'dora', candle: 14, par: 3,
    hint: 'Have Dora wait at the foot of the wall. Enzo can jump off her head.',
    teach: 'Jump off Dora’s echo for a springy boost.',
    map: [
      '########################',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#..*...................#',
      '#.####.............e...#',
      '#...........############',
      '#...........############',
      '#...........############',
      '#d.z..#.....############',
      '########################',
    ],
  },
  {
    id: 'c4', name: 'Kit Tunnel', chapter: 'cellar', first: 'dora', candle: 14, par: 3,
    hint: 'Only Dora fits the little tunnel. The plate is on the other side.',
    teach: 'Kit tunnels are one tile high: Dora fits, Enzo doesn’t.',
    map: [
      '########################',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#............*.........#',
      '#########...===....#...#',
      '#.....###..........#...#',
      '#.....kkk..........A...#',
      '#.1.......d..z.....A.e.#',
      '########################',
    ],
  },
  {
    id: 'c5', name: 'Hold, Then Help', chapter: 'cellar', first: 'dora', candle: 16, par: 3,
    hint: 'Dora holds the plate first, then drops down to give Enzo a leg up.',
    map: [
      '########################',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#d..1..................#',
      '#########..*...........#',
      '#......#..===.....e....#',
      '#......#.........#######',
      '#......A.........#######',
      '#......A.........#######',
      '#.z....A....#....#######',
      '########################',
    ],
  },
  {
    id: 'c6', name: 'Root Maze', chapter: 'cellar', first: 'dora', candle: 12, par: 4,
    hint: 'Crawl through to the plate, then drop down the hole and wait by the tall wall.',
    map: [
      '########################',
      '#......####............#',
      '#......kkkk............#',
      '#d.........1.........*.#',
      '############.###########',
      '#........#.............#',
      '#........#.............#',
      '#........#...........e.#',
      '#........#.......#######',
      '#........A.......#######',
      '#........A.......#######',
      '#.z......A.......#######',
      '########################',
    ],
  },
];
