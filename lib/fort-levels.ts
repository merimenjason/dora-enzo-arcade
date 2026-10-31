// Pillow Fort's pieces and nights. A piece is one or more shapes (or a rope of little links for blankets and fairy
// lights) with how heavy, grippy, bouncy and squashy it is. A night is a room, a basket of pieces in order, the goals
// (a height line, and either a den to cover with a roof or a higher line, and a piece par for the third star) and the
// hazards that visit: the window draught, the cat, the thunder and a sleepy Enzo.
import { box, circle, poly, type Shape } from './fort-physics.js';

export type Kind = 'cushion' | 'pillow' | 'floor' | 'bolster' | 'book' | 'atlas' | 'stool' | 'teacup' | 'teapot' | 'duck' | 'box' | 'blanket' | 'lights';
export type PieceDef = {
  name: string;
  shapes?: () => Shape[];
  rope?: { links: number; gap: number; r: number; mass: number };
  density: number; friction: number; restitution: number;
  /** How much it squashes under weight and on landing, 0 (book) to 1 (cushion). */
  soft: number;
  /** Rotation step in radians; 0 means it can't be turned. */
  step: number;
  angDamp?: number;
};
const Q = Math.PI / 2, E = Math.PI / 4;
export const PIECES: Record<Kind, PieceDef> = {
  cushion: { name: 'Cushion', shapes: () => [box(1.6, 0.62, 0.2)], density: 0.5, friction: 0.95, restitution: 0.08, soft: 1, step: Q },
  pillow: { name: 'Little pillow', shapes: () => [box(0.92, 0.92, 0.24)], density: 0.5, friction: 0.95, restitution: 0.08, soft: 1, step: E },
  floor: { name: 'Floor cushion', shapes: () => [box(2.5, 0.7, 0.24)], density: 0.45, friction: 1, restitution: 0.05, soft: 1, step: Q },
  bolster: { name: 'Bolster', shapes: () => [box(2.3, 0.48, 0.2)], density: 0.6, friction: 0.85, restitution: 0.06, soft: 0.55, step: Q },
  book: { name: 'Book', shapes: () => [box(1.25, 0.25, 0.02)], density: 1.3, friction: 0.6, restitution: 0.02, soft: 0, step: Q },
  atlas: { name: 'Big atlas', shapes: () => [box(1.9, 0.32, 0.03)], density: 1.2, friction: 0.6, restitution: 0.02, soft: 0, step: Q },
  stool: {
    name: 'Wobbly stool', density: 0.8, friction: 0.7, restitution: 0.05, soft: 0, step: Q,
    // the right leg is a touch shorter than the left, so it rocks
    shapes: () => [box(1.5, 0.2, 0.04, 0, 0.5), box(0.16, 0.92, 0.02, -0.56, -0.06), box(0.16, 0.86, 0.02, 0.56, -0.03)],
  },
  teacup: {
    name: 'Teacup', density: 1, friction: 0.55, restitution: 0.2, soft: 0, step: Q,
    shapes: () => [box(0.72, 0.07, 0, 0, -0.2), poly([[-0.24, -0.165], [0.24, -0.165], [0.32, 0.2], [-0.32, 0.2]])],
  },
  teapot: {
    name: 'Teapot', density: 0.9, friction: 0.6, restitution: 0.15, soft: 0, step: Q,
    shapes: () => [circle(0.42, 0, 0.02), box(0.56, 0.1, 0.02, 0, -0.38), box(0.26, 0.12, 0.03, 0, 0.47), poly([[0.36, -0.06], [0.68, 0.22], [0.62, 0.28], [0.3, 0.12]])],
  },
  duck: {
    name: 'Rubber duck', density: 0.35, friction: 0.6, restitution: 0.55, soft: 0.3, step: E,
    shapes: () => [circle(0.32, 0, 0), circle(0.2, 0.2, 0.34), box(0.44, 0.08, 0.02, -0.02, -0.29)],
  },
  box: { name: 'Cardboard box', shapes: () => [box(1.1, 0.9, 0.03)], density: 0.35, friction: 0.75, restitution: 0.04, soft: 0.1, step: Q },
  blanket: { name: 'Blanket', rope: { links: 21, gap: 0.2, r: 0.075, mass: 0.07 }, density: 0, friction: 1, restitution: 0, soft: 0, step: 0 },
  lights: { name: 'Fairy lights', rope: { links: 18, gap: 0.18, r: 0.05, mass: 0.025 }, density: 0, friction: 0.8, restitution: 0, soft: 0, step: 0 },
};

export type RoomId = 'living' | 'attic' | 'library' | 'treehouse';
export const ROOMS: { id: RoomId; name: string; blurb: string }[] = [
  { id: 'living', name: 'The living room', blurb: 'Cushions off the sofa, books off the shelf, and the rain on the window. Start here.' },
  { id: 'attic', name: 'The attic', blurb: 'Boxes, teacups and a rubber duck under the beams, and a draught that whistles through the window.' },
  { id: 'library', name: 'The library', blurb: 'Big books make strong walls, but the cat likes to pounce on whatever is on top.' },
  { id: 'treehouse', name: 'The treehouse', blurb: 'Up in the storm: thunder shakes the floor and a sleepy Enzo flops wherever he likes.' },
];

export type Night = {
  id: string; room: RoomId; name: string;
  /** Height to reach (and hold for five seconds at bedtime) for the first star. */
  line: number;
  /** The second star: den space to cover with a roof, or else a higher line. */
  den?: number; high?: number;
  /** The third star: pieces used, at most. */
  par: number;
  queue: Kind[];
  wind?: number; cat?: number; thunder?: number; enzo?: number;
  tip?: { title: string; text: string };
};

const n = (id: string, room: RoomId, name: string, o: Omit<Night, 'id' | 'room' | 'name'>): Night => ({ id, room, name, ...o });
const C = 'cushion', P = 'pillow', F = 'floor', B = 'bolster', K = 'book', A = 'atlas', S = 'stool', T = 'teacup', H = 'teapot', D = 'duck', X = 'box', L = 'blanket', Z = 'lights';

export const NIGHTS: Night[] = [
  n('l1', 'living', 'First cushions', { line: 2, high: 3, par: 5, queue: [C, C, C, C, C, C, C],
    tip: { title: 'Build a pillow fort!', text: 'Move the piece with the mouse (or ← →) and click (or Space) to drop it. Stack cushions up past the dotted line, then press Bedtime: the fort has to stand for five seconds.' } }),
  n('l2', 'living', 'Story books', { line: 2.6, high: 3.6, par: 7, queue: [K, K, C, K, C, K, P, K, C],
    tip: { title: 'Turn it round', text: 'Right-click, the mouse wheel, or ↑ turns a piece. A book on its end makes a tall, thin pillar; on its side it makes a strong shelf.' } }),
  n('l3', 'living', 'The bolster', { line: 3, high: 4, par: 7, queue: [C, B, C, B, C, P, B, C, C] }),
  n('l4', 'living', 'A roof!', { line: 1.6, den: 2, par: 7, queue: [C, C, P, P, C, C, L, P, C],
    tip: { title: 'Make a den', text: 'Two pillars with a gap between them, and the blanket draped across the top, make an inside. The glowing space under the roof is your den: it counts wherever a chinchilla could sit.' } }),
  n('l5', 'living', 'The wobbly stool', { line: 3, den: 2.5, par: 8, queue: [S, C, K, K, P, C, B, L, C, C] }),
  n('l6', 'living', 'Sofa castle', { line: 3.5, den: 3, par: 10, queue: [F, C, C, B, B, K, K, L, P, C, Z, C] }),

  n('a1', 'attic', 'Draughty corner', { line: 3.2, high: 4.2, par: 8, wind: 0.4, queue: [X, X, C, K, X, C, P, K, C, X],
    tip: { title: 'The window draught', text: 'A draught blows in from the window and pushes on the fort, harder the higher it gets. Lean against it and keep things wide at the bottom.' } }),
  n('a2', 'attic', 'Tea party', { line: 3, high: 4, par: 8, queue: [X, T, K, T, C, H, K, C, T, X] }),
  n('a3', 'attic', 'Rubber duck', { line: 3.4, high: 4.4, par: 8, wind: 0.3, queue: [C, D, X, K, D, C, X, P, K, C] }),
  n('a4', 'attic', 'Under the eaves', { line: 2.4, den: 3, par: 8, wind: 0.4, queue: [X, X, C, C, K, K, L, P, Z, C] }),
  n('a5', 'attic', 'Trunk tower', { line: 4.4, high: 5.4, par: 10, wind: 0.5, queue: [X, S, X, K, C, T, B, K, X, P, D, C] }),
  n('a6', 'attic', 'Attic hideout', { line: 3.5, den: 4, par: 11, wind: 0.5, queue: [F, X, X, B, B, C, C, L, K, K, Z, H, C] }),

  n('b1', 'library', 'Book stacks', { line: 3, high: 4, par: 9, queue: [A, K, K, K, A, K, K, K, C, K, K] }),
  n('b2', 'library', 'The cat', { line: 3.6, high: 4.6, par: 9, cat: 4, queue: [C, K, A, C, K, P, K, A, C, B, C],
    tip: { title: 'Here comes the cat', text: 'Every few pieces the cat creeps up and pounces on the very top of the fort. A heavy, flat piece on top shrugs it off; a duck does not.' } }),
  n('b3', 'library', 'Reading nook', { line: 2.5, den: 3.5, par: 9, queue: [K, K, K, K, A, C, C, L, P, Z, K, C] }),
  n('b4', 'library', 'Encyclopaedias', { line: 4.6, high: 5.6, par: 11, cat: 4, queue: [A, A, K, K, S, A, K, K, C, K, A, P, C] }),
  n('b5', 'library', 'The library ladder', { line: 5, high: 6, par: 11, cat: 3, wind: 0.3, queue: [S, K, K, C, B, A, P, K, C, T, K, D, C] }),
  n('b6', 'library', 'The great library den', { line: 4, den: 5, par: 13, cat: 4, queue: [F, A, A, B, B, K, K, K, K, L, C, C, Z, P, C] }),

  n('t1', 'treehouse', 'Thunder', { line: 3.6, high: 4.6, par: 8, thunder: 3, queue: [C, X, C, K, C, B, P, K, C, C],
    tip: { title: 'Thunder!', text: 'When the thunder rumbles the whole treehouse shakes. Soft cushions settle and grip; teacups and ducks rattle loose.' } }),
  n('t2', 'treehouse', 'Sleepy Enzo', { line: 3.2, den: 3.5, par: 9, enzo: 4, queue: [F, C, K, C, S, P, K, C, L, C, C],
    tip: { title: 'Sleepy Enzo', text: 'Enzo is very tired. Partway through he will yawn and flop down on the fort for a nap. Build it sturdy enough to take a sleepy chinchilla.' } }),
  n('t3', 'treehouse', 'Treetop tower', { line: 5.4, high: 6.4, par: 11, thunder: 4, wind: 0.4, queue: [X, S, C, K, A, C, B, P, K, X, C, H, C] }),
  n('t4', 'treehouse', 'Duck storm', { line: 4.4, high: 5.4, par: 11, thunder: 3, cat: 5, queue: [D, C, D, X, K, D, C, A, P, D, B, C, C] }),
  n('t5', 'treehouse', 'Everything at once', { line: 4.4, den: 4, par: 12, thunder: 4, cat: 5, enzo: 6, wind: 0.3, queue: [F, X, X, C, B, B, K, A, L, C, P, Z, K, C, C] }),
  n('t6', 'treehouse', 'The grand fort', { line: 6, den: 6, par: 16, thunder: 5, cat: 6, enzo: 8, wind: 0.3, queue: [F, F, X, X, B, B, A, A, K, K, L, C, C, S, P, Z, C, K, C, P] }),
];

export const SANDBOX_KINDS: Kind[] = ['cushion', 'pillow', 'floor', 'bolster', 'book', 'atlas', 'stool', 'box', 'teacup', 'teapot', 'duck', 'blanket', 'lights'];
