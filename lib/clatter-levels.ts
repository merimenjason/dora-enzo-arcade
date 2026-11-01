// Clatterbox's puzzles: five cardboard rooms of six, each a little diorama with fixed parts (taped down, or hung from
// the box), a tray of parts to place, the build areas they may go in, a goal (or two), the bonus button and an
// authored solution that the tests replay. Coordinates are in box units, x to the right and y up from the floor.

export type PartId =
  | 'marble' | 'acorn' | 'domino' | 'ramp' | 'plank' | 'block' | 'seesaw' | 'spring' | 'fan' | 'bellows' | 'car' | 'balloon'
  | 'pin' | 'candle' | 'scissors' | 'funnel' | 'bell' | 'trapdoor' | 'pulley' | 'string' | 'shelf' | 'hedgehog' | 'bowl' | 'lantern' | 'train';
/** A placed part: where its centre (or pin) is, its turn in 15° steps and whether it is flipped. */
export type Place = { p: PartId; x: number; y: number; r: number; f: 0 | 1 };
/**
 * A fixed part. Shelves take a size (w × h). A string runs from (x, y) on the box (or on part `from` there) to part
 * `to` at its local offset `at`, `len` long (default: taut). A pulley's bucket and weight hang d1 and d2 below its
 * wheels. `v` starts a part moving.
 */
export type Item = {
  p: PartId; x: number; y: number; r?: number; f?: 0 | 1; w?: number; h?: number;
  to?: number; from?: number; at?: [number, number]; len?: number; d1?: number; d2?: number; v?: [number, number];
};
export type Puzzle = {
  id: string; room: number; n: number; name: string; line: string; after: string;
  W: number; H: number; items: Item[]; tray: Partial<Record<PartId, number>>;
  zones: [number, number, number, number][]; token: [number, number] | null;
  /** The fewest parts the searching bot needed (the second star). */
  par: number; sol: Place[]; time?: number; tip?: { title: string; text: string };
};
export type Room = { id: string; name: string; blurb: string; puzzles: string[]; icon: string };

const P = (p: PartId, x: number, y: number, r = 0, f: 0 | 1 = 0): Place => ({ p, x, y, r, f });
const shelf = (x: number, y: number, w: number, r = 0, h = 0.26): Item => ({ p: 'shelf', x, y, w, h, r });
/** A row of standing dominoes on a surface whose top is at y. */
const row = (y: number, ...xs: number[]): Item[] => xs.map((x) => ({ p: 'domino', x, y: y + 0.6 }));

type Def = Omit<Puzzle, 'id' | 'room' | 'n' | 'W' | 'H'> & { W?: number; H?: number };
const DEFS: Def[][] = [
  // ---------------------------------------------------------------- 1 · the kitchen shelf
  [
    {
      name: 'Breakfast Bell', line: 'Ring the breakfast bell! The marble needs a way across the gap.', after: 'Ding-a-ling! Breakfast is ready.',
      items: [shelf(2, 4.6, 3.6, -1), { p: 'marble', x: 0.75, y: 5.35 }, shelf(9.5, 2.6, 5, 0, 0.3), { p: 'bell', x: 11.2, y: 3.75 }],
      tray: { ramp: 1 }, zones: [[3.6, 0.6, 7.2, 4.4]], token: [5.4, 3.9], par: 1, sol: [P('ramp', 4.85, 3.65, -1)],
      tip: { title: 'Place a part, then press Go', text: 'Drag the ramp from the tray into the dashed build area. Turn it with ⟲ ⟳. Press Go to let the marble roll, and Rewind to try again.' },
    },
    {
      name: 'Clack Clack', line: 'A domino is missing from the row. Fill the gap so the clacks reach the bell.', after: 'Clack, clack, clack… ding!',
      items: [shelf(1.6, 4.2, 3, -1), { p: 'marble', x: 0.6, y: 4.85 }, shelf(7.4, 1.45, 9.2, 0, 0.3), ...row(1.6, 4.0, 4.8, 5.6, 6.4, 8.4, 9.2, 10.0), { p: 'bell', x: 10.9, y: 3.35 }],
      tray: { domino: 1 }, zones: [[3.4, 1.6, 11.2, 3.6]], token: [8.0, 2.95], par: 1, sol: [P('domino', 7.4, 2.204)],
      tip: { title: 'Dominoes', text: 'A domino falls into the next one if it stands close enough: about one domino-height apart or less.' },
    },
    {
      name: 'Seeds for the Sparrow', line: 'The last domino nudges an acorn off the table. Guide it into the sparrow’s bowl.', after: 'Cheep! The sparrow tucks in.',
      items: [shelf(1.2, 4.75, 2.6, -1), { p: 'marble', x: 0.4, y: 5.3 }, shelf(4.4, 2.85, 4.4), ...row(2.98, 3.4, 4.2, 5.8), { p: 'acorn', x: 6.32, y: 3.25 }, { p: 'bowl', x: 9.9, y: 0 }],
      tray: { domino: 1, ramp: 1 }, zones: [[2.3, 2.98, 6.5, 4.4], [6.8, 0.7, 11.6, 3.4]], token: [8.4, 2.2], par: 2, sol: [P('domino', 4.8, 3.584), P('ramp', 8.05, 1.65, -2)],
    },
    {
      name: 'Down the Shelves', line: 'Bring the marble down past the jam jar to the bell. One ramp, or two?', after: 'Ding! Somebody’s up early.',
      items: [shelf(10.3, 5.6, 3.2, 1), { p: 'marble', x: 11.45, y: 6.25 }, shelf(1.6, 1.6, 3.2), { p: 'bell', x: 0.75, y: 2.65 }, shelf(6.2, 2.6, 0.3, 0, 2.6)],
      tray: { ramp: 2 }, zones: [[4.2, 3.2, 9.6, 5.6], [2.4, 1.8, 6.0, 3.9]], token: [5.0, 4.1], par: 1, sol: [P('ramp', 6.95, 4.35, 1)],
    },
    {
      name: 'Acorn Relay', line: 'The marble starts the clacks; the last domino sends the acorn on. Get it to the bell.', after: 'Clack, clack, tink… ding!',
      items: [shelf(1.2, 3.6, 2.2, -1), { p: 'marble', x: 0.4, y: 4.05 }, shelf(4.6, 2.6, 5.2), ...row(2.73, 3.0, 3.8, 5.4, 6.2), shelf(6.95, 2.98, 0.5, 0, 0.5), { p: 'acorn', x: 7.0, y: 3.5 }, { p: 'bell', x: 11.1, y: 1.45 }],
      tray: { domino: 1, ramp: 1 }, zones: [[2.1, 2.73, 7.1, 4.4], [7.4, 0.6, 11.7, 3.4]], token: [9.0, 2.3], par: 2, sol: [P('domino', 5.1, 3.334), P('ramp', 8.65, 1.65, -2)],
    },
    {
      name: 'Breakfast Is Served', line: 'Ring the bell, and the bell knocks the acorn on. Fill the sparrow’s bowl too.', after: 'Ding! Cheep! Breakfast for everyone.',
      items: [shelf(1.4, 5.6, 2.8, -1), { p: 'marble', x: 0.4, y: 6.2 }, shelf(8.8, 3.3, 3.6), { p: 'bell', x: 9.4, y: 4.45 }, { p: 'acorn', x: 10.2, y: 3.7 }, { p: 'bowl', x: 8.4, y: 0 }],
      tray: { ramp: 2 }, zones: [[3.4, 2.6, 6.8, 5.4], [6.6, 0.7, 11.95, 2.9]], token: [9.9, 2.1], par: 2, sol: [P('ramp', 4.65, 4.15, -1), P('ramp', 10.35, 1.65, 1)],
    },
  ],
  // ---------------------------------------------------------------- 2 · the toy box
  [
    {
      name: 'Boing!', line: 'The bell hangs over the wall of blocks. Put a spring where the marble lands.', after: 'Boing… ding! What a jump.',
      items: [shelf(1.6, 5.0, 2.6, -1), { p: 'marble', x: 0.5, y: 5.6 }, shelf(7.2, 1.3, 0.4, 0, 2.6), { p: 'bell', x: 9.4, y: 4.0 }],
      tray: { spring: 1 }, zones: [[1.8, 0, 6.8, 3.2]], token: [5.2, 3.6], par: 1, sol: [P('spring', 4.05, 2.45)],
      tip: { title: 'Springs', text: 'Anything that lands on the spring’s pad bounces off it hard, straight out from the pad. Turn the spring to aim the bounce.' },
    },
    {
      name: 'Seesaw Toss', line: 'The hedgehog naps up on the toy shelf. Drop the marble on one end of a seesaw to toss an acorn up to him.', after: 'Bonk! The hedgehog yawns and waves.',
      items: [{ p: 'funnel', x: 3.8, y: 5.2 }, { p: 'marble', x: 3.8, y: 6.4 }, shelf(1.3, 1.8, 2.6), { p: 'hedgehog', x: 0.85, y: 1.93, f: 1 }],
      tray: { seesaw: 1, acorn: 1 }, zones: [[2.8, 0, 9.4, 3.6]], token: [4.7, 3.64], par: 2, sol: [P('seesaw', 4.55, 1.85, 0, 1), P('acorn', 5.8, 3.014)],
      tip: { title: 'Seesaws', text: 'Push one end of the seesaw down and the other end flies up, with whatever is sitting on it. Acorns are light; marbles are heavy.' },
    },
    {
      name: 'Wind-Up Car', line: 'Wake the hedgehog at the end of the rug. The marble drops straight down: a bump starts the car.', after: 'Toot toot! The hedgehog yawns and waves.',
      items: [{ p: 'funnel', x: 2.4, y: 4.4 }, { p: 'marble', x: 2.4, y: 5.6 }, { p: 'hedgehog', x: 11.1, y: 0, f: 1 }, shelf(7.6, 2.4, 3.6, 0, 0.24)],
      tray: { car: 1 }, zones: [[0.4, 0, 10.2, 2.2]], token: [8.6, 0.6], par: 1, sol: [P('car', 1.65, 0.354)],
      tip: { title: 'The wind-up car', text: 'Give the car a bump and it drives off the way it faces, for a few seconds. Flip it to face the other way.' },
    },
    {
      name: 'Car Jump', line: 'The hedgehog sleeps up on the toy drum. The car drives off the shelf: give it a bounce.', after: 'Vroom… boing… bump! The hedgehog yawns and waves.',
      items: [{ p: 'funnel', x: 1.4, y: 4.9 }, { p: 'marble', x: 1.4, y: 6.1 }, shelf(1.9, 2.4, 3.8), { p: 'car', x: 1.4, y: 2.92 }, shelf(10.4, 1.0, 3.2, 0, 2.0), { p: 'hedgehog', x: 11.1, y: 2.0, f: 1 }],
      tray: { spring: 1 }, zones: [[4.0, 0, 8.6, 2.0]], token: [6.9, 2.9], par: 1, sol: [P('spring', 4.75, 0.75, -2)],
    },
    {
      name: 'Clockwork Clacks', line: 'Wind up the car to start the clacks: one domino is still in the toy box.', after: 'Whirr, clack, clack, clack… ding!',
      items: [{ p: 'funnel', x: 1.6, y: 4.6 }, { p: 'marble', x: 1.6, y: 5.8 }, ...row(0, 5.2, 6.0, 6.8, 9.2, 10.0), { p: 'bell', x: 10.9, y: 1.75 }],
      tray: { car: 1, domino: 1 }, zones: [[0.4, 0, 4.6, 1.1], [4.6, 0, 10.4, 1.4]], token: [8.0, 1.5], par: 2, sol: [P('domino', 8.1, 0.604), P('car', 0.9, 0.354)],
    },
    {
      name: 'Toy Box Parade', line: 'Two marbles, two jobs: wake the hedgehog by the door and ring the bell on the top shelf.', after: 'Vroom, boing, ding! The whole toy box is awake.',
      items: [{ p: 'funnel', x: 2.0, y: 4.0 }, { p: 'marble', x: 2.0, y: 5.2 }, { p: 'hedgehog', x: 11.1, y: 0, f: 1 }, shelf(1.6, 5.0, 3.2, 0, 0.3), { p: 'bell', x: 0.9, y: 6.2 },
        shelf(10.0, 5.2, 3.6, 2), { p: 'marble', x: 11.3, y: 6.25 }],
      tray: { car: 1, spring: 1 }, zones: [[0.3, 0, 9.0, 3.0]], token: [5.2, 4.4], par: 2, sol: [P('spring', 6.55, 2.25), P('car', 6.05, 2.754)],
    },
  ],
  // ---------------------------------------------------------------- 3 · the garden shed
  [
    {
      name: 'A Little Breeze', line: 'The acorn rolls off the potting bench. Blow it over to the sparrow’s bowl.', after: 'Whoosh… plop! Cheep!',
      items: [shelf(1.6, 4.4, 3.0, -1), { p: 'acorn', x: 0.5, y: 5.0 }, { p: 'bowl', x: 9.2, y: 0 }],
      tray: { fan: 1 }, zones: [[0.3, 0, 6.4, 3.6]], token: [6.6, 2.2], par: 1, sol: [P('fan', 4.05, 2.85)],
      tip: { title: 'Fans', text: 'A fan blows along the way it points, softer further away. Light things fly: acorns, balloons, matchboxes. Heavy marbles hardly notice.' },
    },
    {
      name: 'Pop!', line: 'The balloon carries the acorn up the sloping roof and along the lid. Pop it right over the bowl.', after: 'Pop… plop! Cheep, cheep!',
      items: [{ p: 'acorn', x: 1.4, y: 0.27 }, { p: 'balloon', x: 1.4, y: 2.2 }, { p: 'string', x: 1.4, y: 1.78, from: 1, to: 0, at: [0, 0.2] }, shelf(3.6, 5.5, 6.0, 2), shelf(8.0, 1.6, 3.0), { p: 'bowl', x: 8.0, y: 1.73 }],
      tray: { pin: 1 }, zones: [[2.0, 3.0, 11.8, 7.0]], token: [6.9, 3.4], par: 1, sol: [P('pin', 6.25, 6.25)],
      tip: { title: 'Balloons and pins', text: 'A balloon rises, and can carry an acorn on its string. It pops on a pin’s point, or in a flame, and lets go of whatever it carries.' },
    },
    {
      name: 'Puff', line: 'Drop the marble on the bellows: the puff will push the acorn off the shelf.', after: 'Pfff… roll… plop! Cheep!',
      items: [{ p: 'funnel', x: 4.4, y: 5.0 }, { p: 'marble', x: 4.4, y: 6.2 }, shelf(5.6, 1.5, 3.6), { p: 'acorn', x: 6.6, y: 1.9 }, { p: 'bowl', x: 9.8, y: 0 }],
      tray: { bellows: 1 }, zones: [[3.8, 1.63, 7.4, 3.8]], token: [8.0, 1.6], par: 1, sol: [P('bellows', 4.8, 1.909)],
      tip: { title: 'Bellows', text: 'When something drops on the bellows, it puffs: a gust out of its nozzle that shoves light things along. Flip it to puff the other way.' },
    },
    {
      name: 'Up and Away', line: 'The balloon lifts the acorn straight up. Blow it across and pop it over the bowl.', after: 'Whoosh, pop, plop! Cheep!',
      items: [{ p: 'acorn', x: 1.4, y: 0.27 }, { p: 'balloon', x: 1.4, y: 2.2 }, { p: 'string', x: 1.4, y: 1.78, from: 1, to: 0, at: [0, 0.2] }, shelf(9.6, 2.6, 2.6), { p: 'bowl', x: 9.6, y: 2.73 }],
      tray: { fan: 1, pin: 1 }, zones: [[0.2, 1.0, 6.0, 6.8], [6.0, 3.6, 11.8, 6.8]], token: [5.0, 5.4], par: 2, sol: [P('fan', 0.95, 5.55, -1), P('pin', 7.75, 5.55, 6)],
    },
    {
      name: 'Garden Clacks', line: 'A puff can knock a domino over. Start the clacks along the bench to the bell.', after: 'Pfff, clack, clack… ding!',
      items: [{ p: 'funnel', x: 1.8, y: 5.2 }, { p: 'marble', x: 1.8, y: 6.4 }, shelf(6.4, 1.4, 9.6), ...row(1.53, 4.4, 5.2, 7.6, 8.4), { p: 'bell', x: 9.3, y: 3.15 }],
      tray: { bellows: 1, domino: 1 }, zones: [[1.6, 1.53, 8.8, 3.4]], token: [6.1, 1.67], par: 2, sol: [P('bellows', 2.35, 1.809), P('domino', 6.35, 2.544)],
    },
    {
      name: 'Garden Party', line: 'Everything at once: send the acorn up and over to the bowl, and puff the marble’s way to the bell.', after: 'Whoosh, pop, plop! Pfff, clack… ding! What a party.',
      items: [{ p: 'acorn', x: 1.0, y: 0.27 }, { p: 'balloon', x: 1.0, y: 2.2 }, { p: 'string', x: 1.0, y: 1.78, from: 1, to: 0, at: [0, 0.2] }, shelf(10.4, 3.6, 3.2), { p: 'bowl', x: 10.4, y: 3.73 },
        { p: 'funnel', x: 4.6, y: 4.6 }, { p: 'marble', x: 4.6, y: 5.8 }, shelf(7.4, 1.0, 5.6), ...row(1.13, 7.6, 8.4, 9.2), { p: 'bell', x: 10.1, y: 2.75 }],
      tray: { fan: 1, pin: 1, bellows: 1 }, zones: [[0.2, 2.4, 4.4, 5.4], [4.6, 1.13, 7.2, 3.0]], token: [3.6, 4.0], par: 3, sol: [P('fan', 0.95, 3.65, 1), P('pin', 2.95, 2.65, 6), P('bellows', 5.35, 1.409)],
    },
  ],
  // ---------------------------------------------------------------- 4 · the attic
  [
    {
      name: 'Snip!', line: 'An acorn dangles over the sleeping hedgehog. Hang the scissors where the marble will set them swinging.', after: 'Snip… bonk! The hedgehog yawns and waves.',
      items: [shelf(4.5, 2.6, 9.0), shelf(1.0, 3.6, 2.0, -2), { p: 'marble', x: 0.4, y: 4.25 }, { p: 'acorn', x: 11.0, y: 2.4 }, { p: 'string', x: 11.0, y: 7.0, to: 3, at: [0, 0.2] }, { p: 'hedgehog', x: 11.0, y: 0, f: 1 }, shelf(10.15, 1.2, 0.2, 0, 2.4)],
      tray: { scissors: 1 }, zones: [[6.0, 2.73, 10.1, 6.9]], token: [10.6, 4.4], par: 1, sol: [P('scissors', 9.25, 4.65)],
      tip: { title: 'Scissors', text: 'The scissors hang on a split pin. Knock them and they swing, and snip any string their blades pass through.' },
    },
    {
      name: 'Slow Burn', line: 'A string holds the trapdoor shut. Stand a candle under the string.', after: 'Fizz… creak… plop! Cheep!',
      items: [shelf(2.4, 3.2, 3.6), { p: 'trapdoor', x: 8.2, y: 3.4, f: 1 }, { p: 'acorn', x: 6.9, y: 3.75 }, { p: 'string', x: 0.6, y: 6.2, to: 1, at: [-0.95, 0] }, shelf(8.5, 3.4, 0.5, 0, 0.3), shelf(4.45, 1.2, 0.2, 0, 2.4), { p: 'bowl', x: 5.4, y: 0 }],
      tray: { candle: 1 }, zones: [[0.4, 0, 6.0, 6.6]], token: [5.6, 2.4], par: 1, sol: [P('candle', 3.4, 3.734)],
      tip: { title: 'Candles', text: 'A candle’s flame burns through any string held in it for a moment, and pops balloons. Stand it on a shelf, right under the string.' },
    },
    {
      name: 'Going Down', line: 'Fill the pulley’s bucket and down it goes, onto the sleeping hedgehog. Send the marble into the bucket.', after: 'Clunk… creak… bonk! The hedgehog yawns and waves.',
      items: [shelf(1.6, 5.0, 3.2, -1), { p: 'marble', x: 0.5, y: 5.6 }, { p: 'pulley', x: 9.2, y: 6.4, d1: 3.2, d2: 4.6 }, shelf(9.9, 1.4, 1.2, 0, 0.2), { p: 'hedgehog', x: 8.5, y: 0 }, shelf(7.3, 0.6, 0.2, 0, 1.2)],
      tray: { ramp: 1 }, zones: [[3.2, 2.2, 7.6, 6.2]], token: [6.2, 4.4], par: 1, sol: [P('ramp', 4.45, 4.45)],
      tip: { title: 'The pulley', text: 'The bucket and the weight hang on one cord over two wheels. Put something heavy in the bucket and down it goes, and up comes the weight.' },
    },
    {
      name: 'Snip and Drop', line: 'Snip the string that holds the trapdoor, then guide the acorn to the bowl.', after: 'Snip, creak, roll… plop! Cheep!',
      items: [shelf(4.5, 4.0, 9.0), shelf(1.0, 5.0, 2.0, -2), { p: 'marble', x: 0.4, y: 5.65 }, { p: 'trapdoor', x: 11.7, y: 4.4, f: 1 }, { p: 'acorn', x: 10.6, y: 4.75 }, { p: 'string', x: 9.75, y: 7.0, to: 3, at: [-0.95, 0] }, { p: 'bowl', x: 6.4, y: 0 }],
      tray: { scissors: 1, ramp: 1 }, zones: [[6.6, 4.13, 9.6, 6.9], [7.0, 0.5, 11.8, 3.6]], token: [9.0, 2.0], par: 2, sol: [P('scissors', 7.85, 6.15), P('ramp', 9.75, 1.35, 1)],
    },
    {
      name: 'Hot Wax', line: 'The marble hangs on a string. Burn it down, and send the marble to the pulley’s bucket.', after: 'Fizz, clunk, creak… bonk! The hedgehog yawns and waves.',
      items: [{ p: 'marble', x: 2.75, y: 5.5 }, { p: 'string', x: 2.75, y: 7.0, to: 0 }, shelf(2.0, 4.2, 2.6, -1), { p: 'pulley', x: 9.2, y: 6.4, d1: 3.2, d2: 4.6 }, shelf(9.9, 1.4, 1.2, 0, 0.2), { p: 'hedgehog', x: 8.5, y: 0 }, shelf(7.3, 0.6, 0.2, 0, 1.2), shelf(3.65, 5.0, 1.4)],
      tray: { candle: 1, ramp: 1 }, zones: [[2.9, 5.13, 4.4, 6.8], [3.6, 2.0, 7.8, 4.6]], token: [6.0, 3.0], par: 2, sol: [P('candle', 3.15, 5.534), P('ramp', 4.85, 2.85, -2)],
    },
    {
      name: 'Attic Lights', line: 'Two jobs before bedtime: light the lantern, and let the balloon up to ring the bell.', after: 'Snip, thump, click! Fizz, whoosh… ding! Lights on.',
      items: [shelf(3.4, 4.0, 6.8), shelf(1.0, 5.4, 2.0, -3), { p: 'marble', x: 0.7, y: 6.25 }, { p: 'block', x: 7.15, y: 3.2 }, { p: 'string', x: 7.15, y: 7.0, to: 3 }, { p: 'lantern', x: 7.3, y: 0, f: 1 }, shelf(6.7, 4.33, 0.2, 0, 0.4),
        { p: 'balloon', x: 10.6, y: 2.2 }, { p: 'string', x: 10.6, y: 0, to: 7 }, { p: 'bell', x: 10.6, y: 6.9 }, shelf(4.6, 1.2, 3.0)],
      tray: { scissors: 1, candle: 1 }, zones: [[4.6, 4.13, 7.0, 6.9], [3.2, 1.33, 6.0, 2.6], [9.0, 0, 12, 1.4]], token: [6.8, 2.6], par: 2, sol: [P('scissors', 5.35, 6.15), P('candle', 10.25, 0.404)],
    },
  ],
  // ---------------------------------------------------------------- 5 · the big show (bigger boards; the view follows the chain)
  [
    {
      name: 'Opening Act', W: 16, H: 8, line: 'The neighbours are taking their seats. Bridge the gap, fill the row, ring the bell!', after: 'Clack-clack-clack… ding! The audience claps.',
      items: [shelf(2, 5.6, 3.6, -1), { p: 'marble', x: 0.75, y: 6.35 }, shelf(10.6, 2.8, 10.8, 0, 0.3), ...row(2.95, 8.2, 9.0, 9.8, 12.2, 13.0, 13.8), { p: 'bell', x: 14.7, y: 4.55 }],
      tray: { ramp: 1, domino: 1 }, zones: [[3.2, 1.4, 7.4, 5.4], [5.4, 2.95, 14.2, 4.6]], token: [10.46, 3.25], par: 2, sol: [P('ramp', 3.95, 3.65, 4), P('domino', 10.9, 3.554)],
    },
    {
      name: 'The Long Drive', W: 16, H: 8, line: 'Start the car, jump it off the shelf, and let it drive into the clacks.', after: 'Vroom, boing, clack-clack… ding!',
      items: [{ p: 'funnel', x: 1.4, y: 5.4 }, { p: 'marble', x: 1.4, y: 6.6 }, shelf(2.6, 2.4, 5.2), shelf(12.6, 1.0, 6.8, 0, 2.0), ...row(2.0, 11.6, 12.4, 13.2, 14.0), { p: 'bell', x: 14.9, y: 3.75 }],
      tray: { car: 1, spring: 1 }, zones: [[0.3, 2.53, 4.6, 3.6], [5.4, 0, 9.0, 2.4]], token: [8.0, 3.2], par: 2, sol: [P('car', 0.8, 2.884), P('spring', 6.15, 2.15)],
    },
    {
      name: 'Balloon Ride', W: 16, H: 8, line: 'Up goes the acorn on its balloon. Blow it all the way across the stage and pop it over the bowl.', after: 'Whoosh… pop… plop! Cheep!',
      items: [{ p: 'acorn', x: 1.4, y: 0.27 }, { p: 'balloon', x: 1.4, y: 2.2 }, { p: 'string', x: 1.4, y: 1.78, from: 1, to: 0, at: [0, 0.2] }, shelf(13.6, 3.0, 3.2), { p: 'bowl', x: 13.6, y: 3.13 }, shelf(8.0, 4.4, 0.3, 0, 3.0)],
      tray: { fan: 1, pin: 1 }, zones: [[0.2, 1.0, 6.0, 7.8], [8.4, 4.0, 15.8, 7.8]], token: [10.4, 7.0], par: 2, sol: [P('fan', 0.95, 3.05, 1), P('pin', 12.15, 5.55, 6)],
    },
    {
      name: 'Snip, Fizz, Ding', W: 16, H: 8, line: 'Light the lantern for the audience, and send the balloon up to ring the bell.', after: 'Snip, click! Fizz, whoosh… ding!',
      items: [shelf(3.4, 4.0, 6.8), shelf(1.0, 5.4, 2.0, -3), { p: 'marble', x: 0.7, y: 6.25 }, { p: 'block', x: 7.15, y: 3.2 }, { p: 'string', x: 7.15, y: 8.0, to: 3 }, { p: 'lantern', x: 7.3, y: 0, f: 1 }, shelf(6.7, 4.33, 0.2, 0, 0.4),
        { p: 'balloon', x: 13.6, y: 2.2 }, { p: 'string', x: 13.6, y: 0, to: 7 }, { p: 'bell', x: 13.6, y: 7.9 }, shelf(11.0, 0.9, 0.3, 0, 1.8)],
      tray: { scissors: 1, candle: 1 }, zones: [[4.6, 4.13, 7.0, 7.9], [11.4, 0, 15.8, 1.4]], token: [7.15, 1.25], par: 2, sol: [P('scissors', 5.35, 6.15), P('candle', 13.4, 0.404)],
    },
    {
      name: 'Dress Rehearsal', W: 16, H: 8, line: 'A puff starts the clacks, and the last domino sends the acorn flying. Catch it in the bowl.', after: 'Pfff, clack-clack, roll… plop! Cheep!',
      items: [{ p: 'funnel', x: 2.0, y: 6.0 }, { p: 'marble', x: 2.0, y: 7.2 }, shelf(6.4, 2.4, 9.6), ...row(2.53, 4.4, 5.2, 6.0, 6.8, 7.6, 8.4, 9.2, 10.0), shelf(10.75, 2.78, 0.5, 0, 0.5), { p: 'acorn', x: 10.8, y: 3.3 }, { p: 'bowl', x: 14.4, y: 0 }],
      tray: { bellows: 1, ramp: 1 }, zones: [[1.6, 2.53, 4.0, 4.4], [11.4, 0.6, 15.8, 4.0]], token: [12.6, 2.6], par: 2, sol: [P('bellows', 2.6, 2.809), P('ramp', 12.65, 1.75)],
    },
    {
      name: 'The Big Show', W: 24, H: 9, time: 20, line: 'The whole box at once! Ring the bell, light the lantern, and toot the night train in.', after: 'Ding! Click! Toot-toot! The neighbours cheer and cheer.',
      items: [
        // the bell act, on the left
        shelf(2, 6.6, 3.6, -1), { p: 'marble', x: 0.75, y: 7.35 }, shelf(9.0, 4.6, 4.0, 0, 0.3), { p: 'bell', x: 10.0, y: 5.75 },
        // the lantern act, in the middle
        shelf(11.8, 2.4, 4.4), shelf(9.9, 3.4, 1.6, -3), { p: 'marble', x: 9.6, y: 4.05 }, { p: 'block', x: 14.55, y: 1.4 }, { p: 'string', x: 14.55, y: 9, to: 7 }, { p: 'lantern', x: 14.7, y: 0, f: 1 }, shelf(14.1, 2.88, 0.2, 0, 0.7), shelf(13.8, 1.13, 0.2, 0, 2.26), shelf(15.45, 0.5, 0.2, 0, 1.0),
        // the train act, on the right
        { p: 'funnel', x: 17.2, y: 6.6 }, { p: 'marble', x: 17.2, y: 7.8 }, { p: 'train', x: 22.4, y: 0, f: 1 },
      ],
      tray: { ramp: 1, scissors: 1, car: 1 }, zones: [[3.6, 2.8, 7.2, 6.4], [12.4, 2.53, 14.2, 6.4], [15.6, 0, 20.0, 1.2]], token: [19.4, 0.5], par: 3, sol: [P('ramp', 4.85, 5.65, -1), P('car', 16.6, 0.354), P('scissors', 12.65, 5.15)],
    },
  ],
];

export const ROOMS: Room[] = [
  { id: 'kitchen', name: 'The Kitchen Shelf', blurb: 'Marbles, ramps and dominoes among the jam jars.', icon: '🍳', puzzles: [] },
  { id: 'toys', name: 'The Toy Box', blurb: 'Seesaws, springs and a wind-up car.', icon: '🧸', puzzles: [] },
  { id: 'shed', name: 'The Garden Shed', blurb: 'Fans, bellows and balloons that pop on pins.', icon: '🪴', puzzles: [] },
  { id: 'attic', name: 'The Attic', blurb: 'Strings, scissors, candles, trapdoors and the pulley.', icon: '🕯️', puzzles: [] },
  { id: 'show', name: 'The Big Show', blurb: 'Big boards, long chains, and the neighbours are coming.', icon: '🎪', puzzles: [] },
];
export const PUZZLES: Record<string, Puzzle> = {};
export const PUZZLE_IDS: string[] = [];
DEFS.forEach((list, r) => list.forEach((d, n) => {
  const id = `${r + 1}-${n + 1}`;
  PUZZLES[id] = { W: 12, H: 7, ...d, id, room: r, n };
  ROOMS[r].puzzles.push(id); PUZZLE_IDS.push(id);
}));

/** The free build: a big empty box with a marble to start things, and a bell, a sleepy hedgehog and a sparrow's bowl to aim at. */
export const FREE: Puzzle = {
  id: 'free', room: -1, n: 0, name: 'Free Build', W: 16, H: 8, time: 30,
  line: 'Build anything you like. The marble starts it; the bell, the hedgehog and the sparrow are waiting.', after: 'What a contraption!',
  items: [shelf(1.4, 6.2, 2.8, -2), { p: 'marble', x: 0.5, y: 6.85 }, { p: 'bell', x: 15.2, y: 7.9 }, { p: 'hedgehog', x: 14.8, y: 0, f: 1 }, { p: 'bowl', x: 8.0, y: 0 }],
  tray: {}, zones: [[0.2, 0, 15.8, 7.8]], token: null, par: 0, sol: [],
};
