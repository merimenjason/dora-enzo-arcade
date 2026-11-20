// Jade Street: the fifteenth pass's four rides, one of each parked where it belongs: a tandem bike at the East Coast
// Park racks beside the hired bike, the ice-cream uncle's motorbike and sidecar outside ION Orchard on Orchard Road, a
// Skyline Luge cart on Siloso Road on Sentosa, and a dragon boat on the Singapore River at Clarke Quay. They are added
// after every other pass and after relayout() (their tiles are in the old frame, like the rest, and moved here), last in
// the parking list, so every older ride keeps its id and its seeded lock and paint. Their stats are in lib/jade-move.ts.
import { T, type City, type District } from './jade-city.js';
import type { VehicleKind } from './jade-move.js';
import { mvT } from './jade-layout.js';

/** each new ride's old-frame tile, its district and the way it points (0: east, along the street or the river) */
export const NEW_RIDES: { kind: VehicleKind; at: [number, number]; d: District; rot: number; where: string }[] = [
  // on the cycling track, three tiles on from the hired bike by the second rack
  { kind: 'tandem', at: [307, 81], d: 'katong', rot: 0, where: 'the East Coast Park bike racks' },
  // on the pavement outside ION Orchard, between the parked scooters
  { kind: 'icecream', at: [302, 11], d: 'orchard', rot: 0, where: 'Orchard Road, outside ION Orchard' },
  // on the pavement of Siloso Road, west of the sky tower
  { kind: 'luge', at: [75, 100], d: 'resort', rot: 0, where: 'Siloso Road on Sentosa' },
  // moored along the north bank of the Singapore River, between Read Bridge and the next one up
  { kind: 'dragon', at: [315, 103], d: 'quay', rot: 0, where: 'the Singapore River at Clarke Quay' },
  // the sixteenth pass: a second dragon boat on Jurong Lake, off the festival lawn (chapter 9's crow learns its drum)
  { kind: 'dragon', at: [217, 117], d: 'jurong', rot: Math.PI, where: 'Jurong Lake, off the festival lawn' },
];

export function newRides(c: City) {
  for (const r of NEW_RIDES) { const [x, y] = mvT(r.at[0], r.at[1]); c.parking.push({ x: x * T + T / 2, y: y * T + T / 2, d: r.d, kind: r.kind, rot: r.rot }); }
}
