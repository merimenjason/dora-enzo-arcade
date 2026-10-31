// Kite Day's summer: the challenges in each place, in order. Positions are in metres in the place's world (the
// chinchilla starts at the place's `start`; heights are measured from sea level, so `up(place, x, h)` puts a thing
// h metres above the ground at x). Medal marks come from the bot's runs (see tests/kite-bot.mjs): for timed goals
// lower is better, for scored goals higher is better.
import { PLACES, groundAt, type PlaceId } from './kite-world.js';

export type Shape = 'diamond' | 'sled' | 'delta' | 'box' | 'bird' | 'dragon';
export type TargetKind = 'ring' | 'balloon' | 'bubble' | 'puff' | 'lantern' | 'gate';
/** A thing in the sky: a ring to fly through or a thing to pop. Moving ones sway round (x, y). */
export type Target = { x: number; y: number; r: number; kind: TargetKind; mx?: number; my?: number; period?: number; phase?: number };
/** A cue in the festival routine: be at the gate on the beat, or loop on the beat. */
export type Cue = { t: number; x: number; y: number; r: number; loop?: boolean };
export type Rival = { name: string; who: string; skill: number; react: number; noise: number; shape: Shape; sail: number; tail: number; offset: number };
export type Goal =
  | { kind: 'rings'; rings: Target[]; limit: number }
  | { kind: 'pop'; targets: Target[]; need: number; limit: number }
  | { kind: 'tricks'; limit: number; ask: string }
  | { kind: 'deliver'; baskets: [number, number][]; limit: number }
  | { kind: 'race'; gates: Target[]; dragonfly: number; limit: number }
  | { kind: 'hold'; zone: Target; limit: number }
  | { kind: 'duel'; rival: Rival; to: number; limit: number }
  | { kind: 'routine'; cues: Cue[]; limit: number };
export type Challenge = {
  id: string; place: PlaceId; name: string; blurb: string; goal: Goal;
  /** medal marks [bronze, silver, gold]; `low` means a lower value (a time) is better */
  marks: [number, number, number]; better: 'low' | 'high';
  /** the kite shape this challenge awards the first time it is done */
  award?: Shape;
  /** the kite the challenge suggests */
  suggest?: Shape;
  /** the wind is seeded per challenge, so a challenge always blows the same way */
  seed: number;
  /** starting line length */
  line?: number;
};

const up = (place: PlaceId, x: number, h: number): [number, number] => [x, groundAt(PLACES[place], x) + h];
/** A point dx metres downwind of the chinchilla's starting paws and dy metres above them. */
const rel = (place: PlaceId, dx: number, dy: number): [number, number] => { const P = PLACES[place], x = P.start + dx; return [x, groundAt(P, P.start) + 1.1 + dy]; };
const at = (place: PlaceId, dx: number, dy: number, r = 2.2, kind: TargetKind = 'ring'): Target => { const [x, y] = rel(place, dx, dy); return { x, y, r, kind }; };
const sway = (t: Target, mx: number, my: number, period: number, phase = 0): Target => ({ ...t, mx, my, period, phase });
const many = (place: PlaceId, pts: [number, number][], r: number, kind: TargetKind) => pts.map(([dx, dy]) => at(place, dx, dy, r, kind));
const drift = (ts: Target[], mx: number, my: number) => ts.map((t, i) => sway(t, mx * (0.7 + (i % 3) * 0.2), my * (0.8 + (i % 2) * 0.3), 6 + (i * 1.7) % 5, (i * 0.37) % 1));

export const CHALLENGES: Challenge[] = [
  // ---------------------------------------------------------------- Clover Meadow
  { id: 'm1', place: 'meadow', name: 'First Flight', seed: 11, suggest: 'diamond', blurb: 'Fly through the three big daisy rings. Hold to pull and climb, let go to ease, and steer with the nose.',
    goal: { kind: 'rings', limit: 90, rings: many('meadow', [[7, 6], [12, 11], [6, 14]], 3.2, 'ring') }, marks: [90, 30, 18], better: 'low' },
  { id: 'm2', place: 'meadow', name: 'Clover Rings', seed: 12, award: 'sled', blurb: 'Six ribbon rings, high and low. Follow the arrow, and pull to bring the kite in for the near ones.',
    goal: { kind: 'rings', limit: 90, rings: many('meadow', [[9, 5], [16, 10], [11, 16], [5, 11], [17, 4], [19, 15]], 2.3, 'ring') }, marks: [90, 42, 28], better: 'low' },
  { id: 'm3', place: 'meadow', name: 'Loop the Loop', seed: 13, blurb: 'Hold a turn to loop. Loops score, a loop one way then the other is a figure-eight, and a fast low swoop counts too. Keep high!',
    goal: { kind: 'tricks', limit: 45, ask: 'Loops, figure-eights and swoops' }, marks: [400, 1100, 1900], better: 'high' },
  { id: 'm4', place: 'meadow', name: 'Dandelion Clocks', seed: 14, blurb: 'Pop eight dandelion puffs drifting over the meadow, in any order.',
    goal: { kind: 'pop', need: 8, limit: 90, targets: drift(many('meadow', [[8, 7], [15, 12], [6, 15], [18, 7], [12, 19], [20, 12], [4, 9], [16, 17], [11, 4]], 1.4, 'puff'), 2, 1.2) }, marks: [90, 48, 32], better: 'low' },
  // ---------------------------------------------------------------- Apple Orchard
  { id: 'o1', place: 'orchard', name: 'Parcel Post', seed: 21, suggest: 'sled', blurb: 'Two parcels hang from your kite. Dip it to each treehouse basket. Keep out of the leaves, and mind the tumbling air behind the trees!',
    goal: { kind: 'deliver', limit: 120, baskets: [up('orchard', 30 - 3.2 - 0.7, 5.6), up('orchard', 40 - 3.8 - 0.7, 7.2)] }, marks: [120, 52, 34], better: 'low' },
  { id: 'o2', place: 'orchard', name: 'Between the Boughs', seed: 22, award: 'delta', blurb: 'Weave five rings over and between the apple trees, through the swirling air behind them.',
    goal: { kind: 'rings', limit: 100, rings: many('orchard', [[7, 8], [14, 12], [21, 16], [24, 9], [16, 21]], 2.3, 'ring') }, marks: [100, 46, 30], better: 'low' },
  { id: 'o3', place: 'orchard', name: 'Dragonfly Dash', seed: 23, suggest: 'delta', blurb: 'Race the dragonfly through its six gates. Beat it to the last one!',
    goal: { kind: 'race', limit: 90, dragonfly: 3.4, gates: many('orchard', [[8, 7], [15, 13], [10, 19], [4, 12], [18, 9], [22, 17]], 2.3, 'gate') }, marks: [0, 0, 0], better: 'low' },
  { id: 'o4', place: 'orchard', name: 'The Big Delivery', seed: 24, blurb: 'Three parcels: one behind the apple tree, one on the oak top, and one far down the row, so walk along with it (A and D).',
    goal: { kind: 'deliver', limit: 150, baskets: [up('orchard', 30 + 3.2 + 0.8, 6.2), up('orchard', 40, 7 + 3.8 + 1.1), up('orchard', 53 - 3 - 0.7, 5.6)] }, marks: [150, 74, 48], better: 'low' },
  // ---------------------------------------------------------------- Breezy Beach
  { id: 'b1', place: 'beach', name: 'Sea Wind Rings', seed: 31, suggest: 'diamond', blurb: 'Five rings over the sand in a strong, gusty sea wind. Ease in the gusts, pull in the lulls.',
    goal: { kind: 'rings', limit: 90, rings: many('beach', [[10, 6], [18, 12], [13, 17], [22, 8], [17, 21]], 2.2, 'ring') }, marks: [90, 40, 26], better: 'low' },
  { id: 'b2', place: 'beach', name: 'Figure-Eights', seed: 32, award: 'box', blurb: 'The crowd on the sand loves a figure-eight: loop one way, then straight away the other way.',
    goal: { kind: 'tricks', limit: 45, ask: 'Figure-eights score the most' }, marks: [500, 1300, 2200], better: 'high' },
  { id: 'b3', place: 'beach', name: 'Hold Steady', seed: 33, suggest: 'box', blurb: 'Keep your kite in the sunny circle while the gusts and lulls roll in off the sea.',
    goal: { kind: 'hold', limit: 40, zone: at('beach', 14, 12, 4.2, 'ring') }, marks: [16, 26, 33], better: 'high' },
  { id: 'b4', place: 'beach', name: 'Dune Dragonfly', seed: 34, blurb: 'A quick sea dragonfly darts over the dunes. Seven gates; beat it home.',
    goal: { kind: 'race', limit: 90, dragonfly: 4.2, gates: many('beach', [[8, 5], [16, 11], [20, 18], [10, 16], [18, 6], [24, 13], [14, 22]], 2.3, 'gate') }, marks: [0, 0, 0], better: 'low' },
  // ---------------------------------------------------------------- High Downs
  { id: 'h1', place: 'hilltop', name: 'Balloons Aloft', seed: 41, suggest: 'sled', blurb: 'Pop five balloons floating high over the fields. The breeze is light: ride the thermals (rising air, shimmering over the warm fields) to climb.',
    goal: { kind: 'pop', need: 5, limit: 120, targets: drift(many('hilltop', [[12, 12], [18, 20], [10, 22], [22, 14], [16, 27], [24, 24]], 1.6, 'balloon'), 0.6, 1) }, marks: [120, 60, 38], better: 'low' },
  { id: 'h2', place: 'hilltop', name: 'Hang Time', seed: 42, award: 'bird', blurb: 'Keep your kite high in the sky circle. Lulls come and go: pull through them and find the rising air.',
    goal: { kind: 'hold', limit: 45, zone: at('hilltop', 16, 18, 5, 'ring') }, marks: [14, 26, 36], better: 'high' },
  { id: 'h3', place: 'hilltop', name: 'Sky Show', seed: 43, suggest: 'bird', blurb: 'Show the downs everything: loops, figure-eights and swoops, chained together for bigger scores.',
    goal: { kind: 'tricks', limit: 50, ask: 'Chain tricks for a combo' }, marks: [450, 1200, 2100], better: 'high' },
  { id: 'h4', place: 'hilltop', name: 'Cloud Rings', seed: 44, blurb: 'Five rings climbing toward the clouds. The highest needs a thermal and a long line.',
    goal: { kind: 'rings', limit: 110, rings: many('hilltop', [[10, 8], [16, 13], [12, 19], [20, 21], [17, 27]], 2.3, 'ring') }, marks: [110, 58, 38], better: 'low' },
  // ---------------------------------------------------------------- Village Fête
  { id: 'v1', place: 'fete', name: 'Bubble Fair', seed: 51, suggest: 'delta', blurb: 'The bubble stall is blowing giant bubbles. Pop ten of them as they drift by.',
    goal: { kind: 'pop', need: 10, limit: 90, targets: drift(many('fete', [[9, 7], [15, 11], [21, 8], [12, 15], [18, 18], [23, 14], [6, 10], [20, 22], [13, 5], [16, 24], [8, 19], [24, 6]], 1.35, 'bubble'), 2.6, 1.6) }, marks: [90, 52, 36], better: 'low' },
  { id: 'v2', place: 'fete', name: 'Rooftop Post', seed: 52, award: 'dragon', blurb: 'Three parcels for the baskets on the cottage chimney, the marquee flag and the cake stall (walk along for that one). The air tumbles over the roofs.',
    goal: { kind: 'deliver', limit: 150, baskets: [up('fete', 32.5, 4 + 3.2 + 1.4), up('fete', 43.5, 3.6 + 2.4 + 1.5), up('fete', 53.5, 2.4 + 1.6 + 1.2)] }, marks: [150, 70, 46], better: 'low' },
  { id: 'v3', place: 'fete', name: 'Bunting Run', seed: 53, blurb: 'Seven gates strung with bunting, over and between the rooftops.',
    goal: { kind: 'rings', limit: 110, rings: many('fete', [[8, 5], [14, 10], [20, 8], [24, 13], [19, 18], [11, 16], [15, 22]], 2.3, 'gate') }, marks: [110, 54, 36], better: 'low' },
  { id: 'v4', place: 'fete', name: 'Show for the Fête', seed: 54, blurb: 'The whole village is watching. Fifty seconds of loops, eights and swoops.',
    goal: { kind: 'tricks', limit: 50, ask: 'The crowd cheers for combos' }, marks: [500, 1300, 2200], better: 'high' },
  // ---------------------------------------------------------------- Festival Cliffs
  { id: 'c1', place: 'cliffs', name: 'Updraft Rings', seed: 61, blurb: 'Six rings out toward the cliff edge, where the sea breeze climbs the rocks.',
    goal: { kind: 'rings', limit: 100, rings: many('cliffs', [[10, 6], [18, 11], [23, 17], [14, 19], [21, 7], [25, 13]], 2.3, 'ring') }, marks: [100, 46, 30], better: 'low' },
  { id: 'c2', place: 'cliffs', name: 'Duel: Saffron', seed: 62, suggest: 'dragon', blurb: 'A friendly kite duel with Saffron the stoat. Touch her tail streamer three times before she touches yours. If the lines cross for long, they tangle!',
    goal: { kind: 'duel', to: 3, limit: 150, rival: { name: 'Saffron', who: 'the stoat', skill: 0.55, react: 0.5, noise: 2.2, shape: 'delta', sail: 4, tail: 1, offset: 5 } }, marks: [2, 1, 0], better: 'low' },
  { id: 'c3', place: 'cliffs', name: 'Duel: Old Burdock', seed: 63, blurb: 'Old Burdock the badger has flown at forty festivals. Three touches wins.',
    goal: { kind: 'duel', to: 3, limit: 150, rival: { name: 'Burdock', who: 'the badger', skill: 0.8, react: 0.35, noise: 1.4, shape: 'box', sail: 7, tail: 5, offset: 5 } }, marks: [2, 1, 0], better: 'low' },
  { id: 'c4', place: 'cliffs', name: 'The Festival Finale', seed: 64, blurb: 'Dora and Enzo fly the closing routine together, two kites in formation. Hit each gate on the beat and loop when the drum calls.',
    goal: { kind: 'routine', limit: 64, cues: [] }, marks: [1400, 2400, 3200], better: 'high' },
];

/** The finale's cues: a gate on the beat every few seconds, with loops on the big beats. */
function routineCues(): Cue[] {
  const path: [number, number, boolean?][] = [[10, 6], [16, 11], [11, 16], [6, 10], [14, 5], [20, 12, true], [17, 19], [11, 15], [8, 7], [15, 9, true], [21, 15], [14, 20], [9, 13], [17, 6], [12, 11, true], [19, 17]];
  return path.map(([dx, dy, loop], i) => { const [x, y] = rel('cliffs', dx, dy); return { t: 4 + i * 3.6, x, y, r: 2.4, loop: !!loop }; });
}
(CHALLENGES.find((c) => c.id === 'c4')!.goal as { cues: Cue[] }).cues = routineCues();

export const CHALLENGE: Record<string, Challenge> = Object.fromEntries(CHALLENGES.map((c) => [c.id, c]));
export const challengesIn = (p: PlaceId) => CHALLENGES.filter((c) => c.place === p);
