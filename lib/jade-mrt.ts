// Jade Street: the MRT, the island's MRT. Four stations (Chinatown, Raffles Place, Bayfront and Toa Payoh) on one
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
  return { x, y, h: dir > 0 ? h : h + Math.PI, s, dir, at, visible: s > isle.visFrom };
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
/** ride the MRT to station `id`: pay, travel (both heroes), and show the ride view. True when you rode */
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
  // the first ride is the MRT lesson learned (the hint and its route line go)
  if (!w.s.learned.includes('mrt')) w.s.learned.push('mrt'); if (w.tutor.cur === 'mrt') w.tutor.cur = null;
  w.ui = { kind: 'ride-view', from: from.name, to: to.name };
  w.fx.push({ t: 'mrt', name: to.name, x, y });
  return true;
}
/** the ride view's length (seconds); the page closes it, or a key skips it */
export const RIDE_VIEW = 3.2;
/** the MRT made easy to find (owner, 15-11): the one-time hint, the phone text, and routing to a station */
export const MRT_HINT = 'The MRT is open! Chinatown station is in Boat Quay: Madame Glint waits by the gates with your next job; press E to ride (2 coins).';
export const MRT_TEXT = 'The MRT is running! Chinatown station is in Boat Quay, by the river. Walk up to the gates and press E: 2 coins to Raffles Place, Bayfront or Toa Payoh. Open your phone’s MRT tab to find a station.';
export const stationById = (w: World, id: string) => w.c.isle?.stations.find(s => s.id === id) ?? null;
/** set the gold route line to a station (the map's pin, the phone's Route me, the first-ride hint) */
export function routeToStation(w: World, id: string): boolean {
  const s = stationById(w, id); if (!s || !w.open.has(s.d)) return false;
  w.waypoint = [s.x, s.y]; w.routeT = 0; w.updateRoute(); return true;
}

// ── getting far (pass 13): Route me and the gold line take the MRT, the cable car or the ferry when it is quicker
/** a far trip by train or link: walk to `from`, ride to `to`, walk on; `secs` is the rough time, `direct` on foot */
type Stop = { id: string; name: string; x: number; y: number };
/** one ride of a trip */
export type TripLeg = { via: 'mrt' | 'cable' | 'ferry'; from: Stop; to: Stop; ride: number };
/** `then`: a second ride after this one (the sixteenth pass chains two when that is clearly quicker than either alone,
 * say the ferry to Sentosa and on by cable car; the gold line leads to the first, and after it the plan is made again
 * from where you are, so the second follows by itself) */
export type Travel = { via: TripLeg['via']; from: Stop; to: Stop; secs: number; direct: number; then?: TripLeg };
/** a two-ride trip must beat the best single ride (or the walk) by this share: clearly quicker, not a coin toss */
export const CHAIN_SAVE = 0.15;
/** on foot about this fast over the ground, streets and corners included (units a second) */
export const TRAVEL_FOOT = 235 / 1.3;
/** a ride's cost in seconds: the gates, the ride view and the walk out (the ferry also crosses in real time) */
export const RIDE_SECS = { mrt: 8, cable: 9, ferry: 6 } as const;
/** shorter than this (seconds on foot) the plan is always to walk; a ride must save at least this share of the time */
export const TRAVEL_MIN = 25, TRAVEL_SAVE = 0.35;
/** how far a walk is, as the crow flies (every district joins its neighbours over land; the street grid's corners
 * are in TRAVEL_FOOT) */
export function walkDist(x: number, y: number, tx: number, ty: number): number { return dist(x, y, tx, ty); }
/** the quickest way from (x, y) to (tx, ty): a ride when it saves enough time, else null (walk) */
export function travelPlan(w: World, tx: number, ty: number, x = w.p.x, y = w.p.y): Travel | null {
  const open = (sx: number, sy: number) => w.open.has(districtAt(Math.floor(sx / T), Math.floor(sy / T)));
  const direct = walkDist(x, y, tx, ty) / TRAVEL_FOOT; if (direct < TRAVEL_MIN) return null;
  const near = <S extends { x: number; y: number }>(list: S[], px: number, py: number) => list.reduce<S | null>((m, s) => !m || dist(s.x, s.y, px, py) < dist(m.x, m.y, px, py) ? s : m, null);
  const stns = (w.c.isle?.stations ?? []).filter(s => w.open.has(s.d));
  const mrt = stns.length > 1 && w.s.cash >= FARE;
  /** the fixed links (both ways), and the MRT between the stations nearest two points */
  const links: TripLeg[] = [];
  for (const l of w.c.east ? [w.c.east.cable, w.c.east.ferry] : []) {
    if (!l.stops.every(s => open(s.x, s.y))) continue;
    const ride = RIDE_SECS[l.id] + (l.id === 'ferry' ? l.len[l.len.length - 1] / 660 : 0);
    links.push({ via: l.id, from: l.stops[0], to: l.stops[1], ride }, { via: l.id, from: l.stops[1], to: l.stops[0], ride });
  }
  const train = (ax: number, ay: number, bx: number, by: number): TripLeg | null => {
    if (!mrt) return null; const a = near(stns, ax, ay)!, b = near(stns, bx, by)!;
    return a.id === b.id ? null : { via: 'mrt', from: a, to: b, ride: RIDE_SECS.mrt };
  };
  const walk = (ax: number, ay: number, bx: number, by: number) => dist(ax, ay, bx, by) / TRAVEL_FOOT;
  let best: Travel | null = null;
  const one = (l: TripLeg | null) => {
    if (!l) return;
    const secs = walk(x, y, l.from.x, l.from.y) + l.ride + walk(l.to.x, l.to.y, tx, ty);
    if (secs < direct * (1 - TRAVEL_SAVE) && (!best || secs < best.secs)) best = { via: l.via, from: l.from, to: l.to, secs, direct };
  };
  one(train(x, y, tx, ty)); for (const l of links) one(l);
  // two rides back to back: a link then the train on, the train then a link, or the two links
  const bar = Math.min(direct * (1 - TRAVEL_SAVE), (best as Travel | null)?.secs ?? Infinity) * (1 - CHAIN_SAVE);
  let chain: Travel | null = null;
  const two = (a: TripLeg | null, b: TripLeg | null) => {
    if (!a || !b || a.via === b.via) return;
    const secs = walk(x, y, a.from.x, a.from.y) + a.ride + walk(a.to.x, a.to.y, b.from.x, b.from.y) + b.ride + walk(b.to.x, b.to.y, tx, ty);
    if (secs < bar && (!chain || secs < chain.secs)) chain = { via: a.via, from: a.from, to: a.to, secs, direct, then: b };
  };
  for (const l of links) { two(l, train(l.to.x, l.to.y, tx, ty)); two(train(x, y, l.from.x, l.from.y), l); for (const m of links) two(l, m); }
  return chain ?? best;
}
/** "by MRT from Chinatown to Changi Airport" */
const short = (n: string) => n.replace(/ (station|stop|pier)$/i, '');
const legText = (t: { via: TripLeg['via']; from: Stop; to: Stop }) => `${t.via === 'mrt' ? 'MRT' : t.via === 'cable' ? 'Cable car' : 'Ferry'}: ${short(t.from.name)} → ${short(t.to.name)}`;
export const travelText = (t: Travel) => legText(t) + (t.then ? `, then ${legText(t.then)}` : '');
/** a rough travel time for a card: "about 40 s by MRT", "about 2 min on foot" */
export function travelHint(w: World, tx: number, ty: number): string {
  const t = travelPlan(w, tx, ty), s = t ? t.secs : walkDist(w.p.x, w.p.y, tx, ty) / TRAVEL_FOOT;
  // (a ride is never "close by", however quick: it is still a ride away)
  const when = s < 15 && !t ? 'close by' : s < 90 ? `about ${Math.max(10, Math.round(s / 10) * 10)} s` : `about ${Math.round(s / 60)} min`;
  return s < 15 && !t ? when : `${when} ${t ? (t.via === 'mrt' ? 'by MRT' : t.via === 'cable' ? 'by cable car' : 'by ferry') : 'on foot'}`;
}
