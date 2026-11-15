// Jade Street: the two new ways over the water to Sentosa. The cable car hangs from a line over the harbour between
// the HarbourFront station on the docks and the Sentosa station on Siloso Road: its cabins go round all night (you can
// see them overhead), and E at either station rides it, with a painted ride view like the MRT's. The island ferry
// runs from the Sentosa pier east round the harbour and in under the East Coast Parkway to the Marina Bay boardwalk:
// you ride it all the way (the camera follows the boat; E skips to the pier). A durian aboard either is a fine, and
// the wardens lose you over the water. A job's cable step names its stop. No DOM; deterministic.
import { T, districtAt } from './jade-city.js';
import type { Link, LinkStop } from './jade-east.js';
import { nearestFree } from './jade-nav.js';
import { dist } from './jade-rng.js';
import { offence } from './jade-fines.js';
import type { World } from './jade-game.js';

export const FARES = { cable: 4, ferry: 3 } as const;
/** how far from a stop its gates reach */
export const LINK_R = 110;
/** the cabins on the line, their spacing in seconds round the loop, and their speed (world units a second) */
export const CABINS = 8, CABIN_SPEED = 150;
/** the ferry's speed, and how long it waits at each pier */
export const FERRY_SPEED = 300, FERRY_DWELL = 8;
/** the cable car's ride view (seconds; any key skips it) */
export const CABLE_VIEW = 3.6;

const total = (l: Link) => l.len[l.len.length - 1];
/** a point and heading `s` units along a link's path */
export function linkAt(l: Link, s: number): [number, number, number] {
  const L = l.len, P = l.path; s = Math.max(0, Math.min(total(l), s));
  let i = 1; while (i < L.length - 1 && L[i] < s) i++;
  const k = (s - L[i - 1]) / Math.max(1, L[i] - L[i - 1]);
  const [x0, y0] = P[i - 1], [x1, y1] = P[i];
  return [x0 + (x1 - x0) * k, y0 + (y1 - y0) * k, Math.atan2(y1 - y0, x1 - x0)];
}
/** the cabins overhead at time t: each runs out on one cable and back on the other (a little apart) */
export function cabins(l: Link, time: number): { x: number; y: number; h: number }[] {
  const len = total(l), loop = 2 * len, out: { x: number; y: number; h: number }[] = [];
  for (let k = 0; k < CABINS; k++) {
    const u = ((time * CABIN_SPEED + k * loop / CABINS) % loop + loop) % loop;
    const back = u > len, s = back ? loop - u : u;
    const [x, y, h] = linkAt(l, s), off = back ? -16 : 16;
    out.push({ x: x - Math.sin(h) * off, y: y + Math.cos(h) * off, h: back ? h + Math.PI : h });
  }
  return out;
}
/** where the ferry is on its timetable (when nobody is riding it): out, wait, back, wait */
export function ferryAt(l: Link, time: number): { x: number; y: number; h: number; at: number } {
  const len = total(l), run = len / FERRY_SPEED, cyc = 2 * (run + FERRY_DWELL);
  const t = ((time % cyc) + cyc) % cyc;
  const leg = (s: number, back: boolean, at: number) => { const [x, y, h] = linkAt(l, s); return { x, y, h: back ? h + Math.PI : h, at }; };
  if (t < FERRY_DWELL) return leg(0, false, 0);
  if (t < FERRY_DWELL + run) return leg((t - FERRY_DWELL) * FERRY_SPEED, false, -1);
  if (t < 2 * FERRY_DWELL + run) return leg(len, true, 1);
  return leg(len - (t - 2 * FERRY_DWELL - run) * FERRY_SPEED, true, -1);
}

export const linksOf = (w: World): Link[] => w.c.east ? [w.c.east.cable, w.c.east.ferry] : [];
const openStop = (w: World, s: LinkStop) => w.open.has(districtAt(Math.floor(s.x / T), Math.floor(s.y / T)));
/** the cable car station or ferry pier you are at, its link, and the stop at the other end (both ends open) */
export function linkNear(w: World, x = w.p.x, y = w.p.y): { link: Link; from: LinkStop; to: LinkStop } | null {
  for (const l of linksOf(w)) for (let i = 0; i < 2; i++) {
    const s = l.stops[i], o = l.stops[1 - i]; if (openStop(w, s) && openStop(w, o) && dist(s.x, s.y, x, y) < LINK_R) return { link: l, from: s, to: o };
  }
  return null;
}
export const linkById = (w: World, id: string) => { for (const l of linksOf(w)) for (const s of l.stops) if (s.id === id) return { link: l, stop: s }; return null; };
/** why you can't ride now, or null */
export function cantLink(w: World, l: Link, to: LinkStop): string | null {
  if (w.p.ride) return 'Get off your ride first';
  if (w.ticket) return 'Pay your ticket first';
  if (!openStop(w, to)) return 'Sentosa is still under fog';
  if (w.s.cash < FARES[l.id]) return `The fare is ${FARES[l.id]} coins`;
  if (w.run && w.run.cur?.t !== 'cable') return 'Not in the middle of a job';
  if (w.ferry) return 'You are on the ferry';
  return null;
}
/** pay and go: the cable car jumps you there behind its ride view; the ferry carries you along its route */
export function linkGo(w: World): boolean {
  const n = linkNear(w); if (!n) return false;
  const why = cantLink(w, n.link, n.to); if (why) { w.say(why, 'bad'); return false; }
  const { link, from, to } = n;
  w.s.cash -= FARES[link.id];
  if (w.p.carry === 'durian') offence(w, 'durian', from.x, from.y, true);
  if (w.heat > 0 && !w.run) w.clearHeat();
  w.p.act = { n: 'tap-card', t: 0, dur: 0.5 };
  if (link.id === 'cable') {
    w.s.stats.cable++;
    arriveAt(w, to);
    w.ui = { kind: 'ride-view', from: from.name, to: to.name, via: 'cable' };
    w.fx.push({ t: 'cable', name: to.name, x: to.x, y: to.y });
    return true;
  }
  w.s.stats.ferry++;
  const back = to.id === link.stops[0].id;
  w.ferry = { s: back ? total(link) : 0, dir: back ? -1 : 1, to: to.id, t: 0 };
  w.p.hide = true; w.mate.hide = true; w.p.act = null;
  w.fx.push({ t: 'ferry-go' });
  w.say(`All aboard for ${to.name}! (E skips the crossing)`, 'good');
  return true;
}
function arriveAt(w: World, to: LinkStop) {
  const [x, y] = nearestFree(w.c, 'foot', to.x, to.y + T * 0.6, w.open, 3);
  w.p.b.x = x; w.p.b.y = y; w.p.b.speed = 0; w.p.hide = false; w.p.roof = false; w.p.face = 'down'; w.mate.hide = false; w.p.act = null;
  w.regroup(); w.fieldCache.clear(); w.cars = []; w.patrols = []; w.peds = [];
  w.lastLink = to.id;
}
/** the ferry crossing you are on (lib/jade-game.ts steps it) */
export type FerryRide = { s: number; dir: 1 | -1; to: string; t: number };
export function ferryStep(w: World, dt: number) {
  const f = w.ferry, l = w.c.east?.ferry; if (!f || !l) return;
  f.t += dt; f.s += f.dir * FERRY_SPEED * 1.4 * dt;
  const [x, y] = linkAt(l, f.s);
  w.p.b.x = x; w.p.b.y = y; w.mate.b.x = x; w.mate.b.y = y;
  if (f.s <= 0 || f.s >= total(l)) ferryLand(w);
}
/** step off at the pier (the crossing's end, or E to skip it) */
export function ferryLand(w: World) {
  const f = w.ferry, l = w.c.east?.ferry; if (!f || !l) return;
  const to = l.stops.find(s => s.id === f.to)!;
  w.ferry = null; arriveAt(w, to);
  w.fx.push({ t: 'ferry-in', name: to.name, x: to.x, y: to.y });
  w.say(`${to.name}. Mind the gap!`, 'good');
}
/** the one-time hints and the phone text when Sentosa opens */
export const CABLE_HINT = 'Sentosa is open! Ride the cable car from HarbourFront at the docks (E at the station, 4 coins), walk the boardwalk, or take the MRT to Beach station.';
export const EAST_TEXT = 'The MRT runs on over the Rochor River: Bugis for Kampong Glam, and Little India. Walk over the bridges on Syed Alwi Road or Arab Street, or take a taxi.';
export const RESORT_TEXT = 'Sentosa is open! The cable car leaves from HarbourFront at the docks (4 coins), the boardwalk runs beside the Sentosa Gateway, the MRT stops at Beach station, and the ferry crosses from Marina Bay (3 coins).';
export function routeToStop(w: World, id: string): boolean {
  const s = linkById(w, id); if (!s || !openStop(w, s.stop)) return false;
  w.waypoint = [s.stop.x, s.stop.y]; w.routeT = 0; w.updateRoute(); return true;
}
