// Jade Street: the Jade Line, the island's MRT. Four stations (Chinatown, Raffles Place, Bayfront and Toa Payoh) on one
// line: underground from Chinatown to Bayfront, then up a portal onto the viaduct you can see, north up Bayfront
// Avenue and west to Toa Payoh's elevated station. Two trains shuttle end to end on a fixed timetable worked out
// from the clock, so the trains overhead are where the timetable says. Fast travel: E at a station entrance, pick a
// station, pay the fare, and a short ride view plays (skippable) while you and your partner travel. A durian on the
// train is a fine, and the wardens lose you underground. No DOM; deterministic.
import { T, districtAt } from './jade-city.js';
import type { Isle, Station } from './jade-island.js';
import { nearestFree } from './jade-nav.js';
import { dist } from './jade-rng.js';
import { offence } from './jade-fines.js';
import type { World } from './jade-game.js';

export const FARE = 2;
/** train speed (world units a second), how long it waits at a station, and the trains on the line */
export const TRAIN_SPEED = 640, DWELL = 9, TRAINS = 2;
/** how far from a station entrance its gates reach */
export const STATION_R = 110;
type Leg = { from: number; to: number; t0: number; dur: number };
let LEGS: Leg[] = [], CYCLE = 0, FOR: Isle | null = null;
/** the timetable: dwell at each station, travel to the next, then back down the line */
function legs(isle: Isle) {
  if (FOR === isle) return;
  const s = isle.stations.map(x => x.s), out: Leg[] = []; let t = 0;
  const order = [...s.keys(), ...[...s.keys()].reverse().slice(1, -1)];
  for (let k = 0; k < order.length; k++) {
    const a = order[k], b = order[(k + 1) % order.length];
    out.push({ from: s[a], to: s[a], t0: t, dur: DWELL }); t += DWELL;
    const d = Math.abs(s[b] - s[a]); out.push({ from: s[a], to: s[b], t0: t, dur: d / TRAIN_SPEED + 4 }); t += d / TRAIN_SPEED + 4;
  }
  LEGS = out; CYCLE = t; FOR = isle;
}
/** a point and heading `s` units along the whole line */
export function lineAt(isle: Isle, s: number): [number, number, number] {
  const L = isle.lineLen, P = isle.line;
  s = Math.max(0, Math.min(L[L.length - 1], s));
  let i = 1; while (i < L.length - 1 && L[i] < s) i++;
  const k = (s - L[i - 1]) / Math.max(1, L[i] - L[i - 1]);
  const [x0, y0] = P[i - 1], [x1, y1] = P[i];
  return [x0 + (x1 - x0) * k, y0 + (y1 - y0) * k, Math.atan2(y1 - y0, x1 - x0)];
}
export type TrainPos = { x: number; y: number; h: number; s: number; dir: 1 | -1; at: number; visible: boolean };
/** where train k is at time t: its place on the line, which way it's heading, the station it waits at (or -1) */
export function trainAt(isle: Isle, time: number, k: number): TrainPos {
  legs(isle);
  const t = ((time + k * CYCLE / TRAINS) % CYCLE + CYCLE) % CYCLE;
  let leg = LEGS[0]; for (const l of LEGS) if (t >= l.t0) leg = l;
  const u = Math.min(1, (t - leg.t0) / leg.dur), e = u * u * (3 - 2 * u);
  const s = leg.from + (leg.to - leg.from) * e;
  const dir: 1 | -1 = leg.to > leg.from || (leg.to === leg.from && LEGS[(LEGS.indexOf(leg) + 1) % LEGS.length].to > leg.from) ? 1 : -1;
  const [x, y, h] = lineAt(isle, s);
  const at = leg.to === leg.from ? isle.stations.findIndex(st => st.s === leg.from) : -1;
  return { x, y, h: dir > 0 ? h : h + Math.PI, s, dir, at, visible: s > isle.lineLen[3] - 40 };
}
/** the station whose entrance you are at (open districts only) */
export function stationNear(w: World, x = w.p.x, y = w.p.y): Station | null {
  const isle = w.c.isle; if (!isle) return null;
  for (const st of isle.stations) if (w.open.has(st.d) && dist(st.x, st.y, x, y) < STATION_R) return st;
  return null;
}
/** the stations you could ride to from `from` now */
export const destinations = (w: World, from: Station) => (w.c.isle?.stations ?? []).filter(s => s.id !== from.id && w.open.has(s.d));
/** why you can't take the train now, or null */
export function cantRide(w: World): string | null {
  if (!w.c.isle) return 'No trains tonight';
  if (w.p.ride) return 'Get off your ride first';
  if (w.ticket) return 'Pay your ticket first';
  if (w.s.cash < FARE) return `The fare is ${FARE} coins`;
  if (w.run && w.run.cur?.t !== 'train') return 'Not in the middle of a job';
  return null;
}
/** ride the Jade Line to station `id`: pay, travel (both heroes), and show the ride view. True when you rode */
export function mrtTo(w: World, id: string): boolean {
  const isle = w.c.isle; const from = stationNear(w); const to = isle?.stations.find(s => s.id === id);
  if (!isle || !from || !to || from.id === to.id) return false;
  const why = cantRide(w); if (why) { w.say(why, 'bad'); return false; }
  if (!w.open.has(districtAt(Math.floor(to.x / T), Math.floor(to.y / T)))) { w.say('That station is still under fog', 'bad'); return false; }
  w.s.cash -= FARE; w.s.stats.mrt++;
  if (w.p.carry === 'durian') offence(w, 'durian', from.x, from.y, true);
  // underground the wardens lose you; the partner rides along
  if (w.heat > 0 && !w.run) w.clearHeat();
  const [x, y] = nearestFree(w.c, 'foot', to.x, to.y + T * 0.8, w.open, 3);
  w.p.b.x = x; w.p.b.y = y; w.p.b.speed = 0; w.p.hide = false; w.p.roof = false; w.p.face = 'down';
  w.regroup(); w.fieldCache.clear(); w.cars = []; w.patrols = []; w.peds = [];
  w.lastMrt = to.id;
  // the first ride is the Jade Line lesson learned (the hint and its route line go)
  if (!w.s.learned.includes('mrt')) w.s.learned.push('mrt'); if (w.tutor.cur === 'mrt') w.tutor.cur = null;
  w.ui = { kind: 'ride-view', from: from.name, to: to.name };
  w.fx.push({ t: 'mrt', name: to.name, x, y });
  return true;
}
/** the ride view's length (seconds); the page closes it, or a key skips it */
export const RIDE_VIEW = 3.2;
/** the Jade Line made easy to find (owner, 15-11): the one-time hint, the phone text, and routing to a station */
export const MRT_HINT = 'The Jade Line is open! Chinatown station is in Boat Quay: walk to the gates and press E to ride (2 coins).';
export const MRT_TEXT = 'The Jade Line is running! Chinatown station is in Boat Quay, by the river. Walk up to the gates and press E: 2 coins to Raffles Place, Bayfront or Toa Payoh. Open your phone’s Jade Line tab to find a station.';
export const stationById = (w: World, id: string) => w.c.isle?.stations.find(s => s.id === id) ?? null;
/** set the gold route line to a station (the map's pin, the phone's Route me, the first-ride hint) */
export function routeToStation(w: World, id: string): boolean {
  const s = stationById(w, id); if (!s || !w.open.has(s.d)) return false;
  w.waypoint = [s.x, s.y]; w.routeT = 0; w.updateRoute(); return true;
}
