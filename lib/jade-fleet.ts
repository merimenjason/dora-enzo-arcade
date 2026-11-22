// Jade Street, the twentieth pass's vehicle perks: a business that runs vehicles lends its owner one. Own the
// ComfortDelGro Taxi Depot and your own cab (a new ride) pulls up beside you when you call it, and Grab rides are on
// the house; own the Boat Quay Bumboat Service and a bumboat comes to the river bank you stand at; the Siloso Kayak Hire
// leaves a kayak (the other new ride) at the Sentosa shore; the Jalan Ubin Bicycle Rental brings a bike to you anywhere
// on Pulau Ubin; and the Marina Ice Kacang Cart's ice-cream motorbike comes when called. Levels 2 and 3 of the business
// make its vehicle quicker and give it a new livery. Calls are free roam only, as taxis are (no job, no heat, no
// ticket, on foot). Each business has one vehicle out at a time: calling again sends the old one home. Derived from
// the save's business levels (no save fields of its own). No DOM; deterministic.
import { T, W, G, S, F_BRIDGE, districtAt, passable, type District, type MoveClass } from './jade-city.js';
import { nearestFree } from './jade-nav.js';
import { VEHICLES, type VehicleKind } from './jade-move.js';
import type { World, Ride } from './jade-game.js';
import type { Save } from './jade-save.js';
import { BIZ, BIZ_OF, bizPos } from './jade-biz.js';

export type FleetId = 'taxi' | 'bumboat' | 'kayak' | 'ubinbikes' | 'icekacang' | 'snorkelhire' | 'railbikes' | 'bikehire' | 'kayakhire';
export type Perk = { id: FleetId; kind: VehicleKind; perk: string; call: string; where: string };
/** the five vehicle businesses and what each lends (the buy panel's "Perk:" line, the phone's button) */
export const FLEET: Perk[] = [
  { id: 'taxi', kind: 'cab', perk: 'your own cab, called from your phone, and free Grab rides', call: 'Call your cab', where: 'Stand by a road' },
  { id: 'bumboat', kind: 'boat', perk: 'a bumboat sent to any river bank or jetty you call from', call: 'Call your bumboat', where: 'Stand at a jetty or the water’s edge' },
  { id: 'kayak', kind: 'kayak', perk: 'a kayak waiting at any Sentosa shore', call: 'Call a kayak', where: 'Stand at the water’s edge on Sentosa' },
  { id: 'ubinbikes', kind: 'bike', perk: 'a bike brought to you anywhere on Pulau Ubin', call: 'Call a bike', where: 'Only on Pulau Ubin' },
  { id: 'icekacang', kind: 'icecream', perk: 'the ice-cream motorbike, called from your phone', call: 'Call the ice-cream bike', where: 'Stand by a road' },
  // (the twenty-first pass) the St John's Snorkel Hire
  { id: 'snorkelhire', kind: 'kayak', perk: 'a kayak waiting at any Southern Islands shore', call: 'Call a kayak', where: 'Stand at the water’s edge on the Southern Islands' },
  // (the twenty-second pass) the Rail Corridor Bike Hire
  { id: 'railbikes', kind: 'bike', perk: 'a bike brought to you anywhere in Bukit Timah', call: 'Call a bike', where: 'Only in Bukit Timah' },
  // (the twenty-fourth pass) the Kranji Bicycle Hire
  { id: 'bikehire', kind: 'bike', perk: 'a bike brought to you anywhere in Kranji and Woodlands', call: 'Call a bike', where: 'Only in Kranji and Woodlands, outside the memorial grounds' },
  // (the twenty-fifth pass) the Waterway Kayak Hire
  { id: 'kayakhire', kind: 'kayak', perk: 'a kayak waiting at any Punggol and Coney Island shore', call: 'Call a kayak', where: 'Stand at the water’s edge in Punggol: the Waterway, the river mouth or the channel' },
];
export const FLEET_OF: Record<FleetId, Perk> = Object.fromEntries(FLEET.map(f => [f.id, f])) as Record<FleetId, Perk>;
/** the business's level makes its vehicle quicker (levels 0 to 3) */
export const FLEET_SPEED = [1, 1, 1.08, 1.16] as const;
/** and gives it a new livery at levels 2 and 3: a painted sprite for the two new rides, a hue for the others */
export const FLEET_HUE = [0, 0, 140, 40] as const;
export const perkLine = (id: string) => { const f = FLEET_OF[id as FleetId]; return f ? `Perk: ${f.perk}. Levels 2 and 3: quicker, with a new paint job.` : null; };
export const fleetLevel = (s: Save, id: FleetId) => s.biz[id]?.lvl ?? 0;
/** the vehicle businesses this save owns */
export const ownedFleet = (s: Save) => FLEET.filter(f => fleetLevel(s, f.id) >= 1);
/** Grab is on the house with the taxi depot */
export const freeGrab = (s: Save) => fleetLevel(s, 'taxi') >= 1;
/** the sprite a vehicle business's ride is drawn with at its level (the new rides' own liveries) */
export function fleetSprite(r: Ride, s: Save): string | null {
  if (!r.own) return null; const lv = fleetLevel(s, r.own as FleetId);
  if (r.kind === 'cab' || r.kind === 'kayak') return lv >= 2 ? `v-${r.kind}-${lv}` : `v-${r.kind}`;
  return null;
}
/** the hue a business's ride is painted at its level (null: draw it as usual) */
export function fleetHue(r: Ride, s: Save): number | null {
  if (!r.own || r.kind === 'cab' || r.kind === 'kayak') return r.own ? 0 : null;
  return FLEET_HUE[fleetLevel(s, r.own as FleetId)];
}
export const fleetBoost = (w: World, r: Ride) => r.own ? FLEET_SPEED[fleetLevel(w.s, r.own as FleetId)] : 1;

const DOORS = BIZ.map(bizPos);
const tileOf = (x: number, y: number) => [Math.floor(x / T), Math.floor(y / T)] as const;
/** the same gate as a taxi's (free roam, no heat, no ticket, on foot), then where each vehicle can come */
export function cantCall(w: World, id: FleetId): string | null {
  const f = FLEET_OF[id]; if (!f) return 'No such business';
  if (fleetLevel(w.s, id) < 1) return 'Buy the business first';
  if (w.run) return 'No calls during a job';
  if (w.heat >= 1) return 'Not with the wardens after you';
  if (w.ticket) return 'Pay your ticket first';
  if (w.p.ride || w.p.roof || w.p.hide) return 'Call from the ground, on foot';
  const [tx, ty] = tileOf(w.p.x, w.p.y), d = districtAt(tx, ty);
  if (id === 'ubinbikes' && d !== 'pulau') return 'The bike shop only delivers on Pulau Ubin';
  if (id === 'kayak' && d !== 'resort') return 'The kayaks only go out from Sentosa’s shores';
  if (id === 'railbikes' && d !== 'bukit') return 'The Rail Corridor’s bikes only go round Bukit Timah';
  if (id === 'bikehire' && d !== 'kranji') return 'The bike hire only delivers in Kranji and Woodlands';
  if (id === 'bikehire') { const q = w.c.kranji?.quiet; if (q && tx >= q[0] && ty >= q[1] && tx <= q[2] && ty <= q[3]) return 'Not inside the memorial grounds'; }
  if (id === 'snorkelhire' && d !== 'islands') return 'The snorkel hut’s kayaks only go out round the Southern Islands';
  if (id === 'kayakhire' && d !== 'punggol') return 'The Waterway kayaks only go out round Punggol and Coney Island';
  if ((id === 'taxi' || id === 'icekacang' || id === 'ubinbikes') && d === 'punggol') return 'No roads in Punggol Point and Coney Island: only boardwalks and park connectors';
  if ((id === 'taxi' || id === 'icekacang') && d === 'pulau') return 'No roads on Pulau Ubin: only bike tracks';
  if ((id === 'taxi' || id === 'icekacang' || id === 'ubinbikes') && d === 'islands') return 'No roads on the Southern Islands: only footpaths';
  if (!spotFor(w, f)) return f.where;
  return null;
}
/** nothing on foot in the way along the line (tiles, and the businesses' stalls and doors) */
function clearWalk(w: World, x0: number, y0: number, x1: number, y1: number): boolean {
  const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 16);
  for (let i = 1; i < n; i++) {
    const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n;
    if (!passable(w.c, 'foot', Math.floor(x / T), Math.floor(y / T))) return false;
    if (DOORS.some(([a, b]) => Math.hypot(a - x, b - y) < 48)) return false;
  }
  return true;
}
/** where the vehicle comes to: a road beside you for the cab and the ice-cream bike, the water beside you for the boats,
 *  a track beside you for the bike (null when there is none close by) */
function spotFor(w: World, f: Perk): [number, number] | null {
  const cls: MoveClass = VEHICLES[f.kind].cls, px = w.p.x, py = w.p.y, [tx, ty] = tileOf(px, py);
  const road = f.kind === 'cab' || f.kind === 'icecream', reach = cls === 'boat' ? 3 : road ? 4 : 2;
  let best: [number, number] | null = null, bd = Infinity;
  for (let dy = -reach; dy <= reach; dy++) for (let dx = -reach; dx <= reach; dx++) {
    const x = tx + dx, y = ty + dy; if (x < 0 || y < 0 || x >= W || (!dx && !dy)) continue;
    if (!w.open.has(districtAt(x, y) as District) || !passable(w.c, cls, x, y)) continue;
    if (road && w.c.ground[y * W + x] !== G.ROAD) continue;
    // (a boat comes to open water: not a pier or a boardwalk over it, not under a bridge)
    if (cls === 'boat' && (w.c.solid[y * W + x] !== S.WATER || (w.c.flags[y * W + x] & F_BRIDGE))) continue;
    // (clear of every business's door, so E there offers the ride, not the business)
    if (DOORS.some(([dx2, dy2]) => Math.hypot(dx2 - (x * T + T / 2), dy2 - (y * T + T / 2)) < 110)) continue;
    // (and a straight walk to it: no wall, no stall between you and it; boats only need the bank)
    if (cls !== 'boat' && !clearWalk(w, px, py, x * T + T / 2, y * T + T / 2)) continue;
    const d = Math.hypot(dx, dy); if (d < bd) { bd = d; best = [x, y]; }
  }
  if (!best) return null;
  return nearestFree(w.c, cls, best[0] * T + T / 2, best[1] * T + T / 2, w.open, 2);
}
/** call a business's vehicle: it pulls up (or comes in to the bank) beside you, parked and unlocked */
export function callRide(w: World, id: FleetId): Ride | null {
  const why = cantCall(w, id); if (why) { w.say(why, 'bad'); return null; }
  const f = FLEET_OF[id], at = spotFor(w, f)!;
  // one at a time: the last one called goes home (unless the partner sits in it)
  w.rides = w.rides.filter(r => r.own !== id || w.mate.seat === r);
  const h = Math.atan2(w.p.y - at[1], w.p.x - at[0]) + Math.PI / 2;
  const r = w.addRide(f.kind, at[0], at[1], h, false, 0, false); r.own = id;
  w.p.act = { n: 'call-ride', t: 0, dur: 0.9 }; w.p.face = 'down';
  w.fx.push({ t: 'hail', x: w.p.x, y: w.p.y });
  w.say(`${f.call.replace(/^Call (your |a |the )?/, '').replace(/^./, c => c.toUpperCase())} is here!`, 'good');
  return r;
}
/** the nearest tile to a vehicle business's door, in its own district, where its ride can be called from (the tests'
 *  and the browser tests' stand-here; moves the player there, or leaves them and returns null) */
export function fleetSpot(w: World, id: FleetId): [number, number] | null {
  const [bx, by] = bizPos(BIZ_OF[id]), d = BIZ_OF[id].d, tx0 = Math.floor(bx / T), ty0 = Math.floor(by / T), ox = w.p.b.x, oy = w.p.b.y;
  for (let r = 0; r < 40; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; const tx = tx0 + dx, ty = ty0 + dy;
    if (districtAt(tx, ty) !== d || !passable(w.c, 'foot', tx, ty)) continue;
    w.p.b.x = tx * T + T / 2; w.p.b.y = ty * T + T / 2; if (!cantCall(w, id)) return [tx, ty];
  }
  w.p.b.x = ox; w.p.b.y = oy; return null;
}
