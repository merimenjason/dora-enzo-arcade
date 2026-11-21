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

/** (the seventeenth pass: the Ubin bumboat from Changi Point, 4 coins) */
export const FARES = { cable: 4, ferry: 3, bumboat: 4, launch: 3 } as const;
/** how far from a stop its gates reach */
export const LINK_R = 110;
/** the cabins on the line, their spacing in seconds round the loop, and their speed (world units a second) */
export const CABINS = 8, CABIN_SPEED = 150;
/** the ferry's speed, and how long it waits at each pier */
export const FERRY_SPEED = 300, FERRY_DWELL = 8;
/** your crossing runs this much faster than the ferry seen from the shore (pass 13: 2.2, was 1.4: thirteen seconds of
 * open water is now about eight) */
export const FERRY_RIDE = 2.2;
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

export const linksOf = (w: World): Link[] => [...(w.c.east ? [w.c.east.cable, w.c.east.ferry] : []), ...(w.c.ubin ? [w.c.ubin.boat] : []), ...(w.c.islands ? [w.c.islands.ferry] : [])];
/** a boat link (the island ferry, the Ubin bumboat): you ride it in real time, the camera on the boat */
export const byBoat = (l: Link) => l.id !== 'cable';
const linkOfId = (w: World, id: Link['id'] | undefined) => linksOf(w).find(l => l.id === (id ?? 'ferry'));
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
  if (!openStop(w, to)) return l.id === 'bumboat' ? 'Pak Ubin’s bumboats aren’t running to Pulau Ubin yet' : l.id === 'launch' ? 'The island ferry isn’t running to the Southern Islands yet' : 'Sentosa is still under fog';
  if (w.s.cash < FARES[l.id]) return `The fare is ${FARES[l.id]} coins`;
  if (w.run && w.run.cur?.t !== 'cable') return 'Not in the middle of a job';
  if (w.ferry) return 'You are on a boat';
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
  const board = () => {
    if (link.id === 'bumboat') w.s.stats.bumboats++; else if (link.id === 'launch') w.s.stats.launches++; else w.s.stats.ferry++;
    const back = to.id === link.stops[0].id;
    w.ferry = { s: back ? total(link) : 0, dir: back ? -1 : 1, to: to.id, t: 0, l: link.id };
    w.p.hide = true; w.mate.hide = true; w.p.act = null;
    w.fx.push({ t: 'ferry-go' });
    w.say(link.id === 'bumboat' ? `Pak Ubin's bumboat putters off for ${to.name}! (E skips the crossing)` : link.id === 'launch' ? `The island ferry casts off for ${to.name}! (E skips the crossing)` : `All aboard for ${to.name}! (E skips the crossing)`, 'good');
  };
  // the bumboat waits for a wave from the jetty (its own animation); the island ferry is boarded at the gate
  if (link.id === 'bumboat') { w.p.face = 'down'; w.p.act = { n: 'boat-hail', t: 0, dur: 0.8, then: board }; } else board();
  return true;
}
function arriveAt(w: World, to: LinkStop) {
  const [x, y] = nearestFree(w.c, 'foot', to.x, to.y + T * 0.6, w.open, 3);
  w.p.b.x = x; w.p.b.y = y; w.p.b.speed = 0; w.p.hide = false; w.p.roof = false; w.p.face = 'down'; w.mate.hide = false; w.p.act = null;
  w.regroup(); w.fieldCache.clear(); w.cars = []; w.patrols = []; w.peds = [];
  w.lastLink = to.id;
}
/** the ferry crossing you are on (lib/jade-game.ts steps it) */
export type FerryRide = { s: number; dir: 1 | -1; to: string; t: number; /** which boat (the island ferry when unset) */ l?: Link['id'] };
export function ferryStep(w: World, dt: number) {
  const f = w.ferry, l = linkOfId(w, f?.l); if (!f || !l) return;
  f.t += dt; f.s += f.dir * FERRY_SPEED * FERRY_RIDE * dt;
  const [x, y] = linkAt(l, f.s);
  w.p.b.x = x; w.p.b.y = y; w.mate.b.x = x; w.mate.b.y = y;
  if (f.s <= 0 || f.s >= total(l)) ferryLand(w);
}
/** step off at the pier (the crossing's end, or E to skip it) */
export function ferryLand(w: World) {
  const f = w.ferry, l = linkOfId(w, f?.l); if (!f || !l) return;
  const to = l.stops.find(s => s.id === f.to)!;
  w.ferry = null; arriveAt(w, to);
  w.fx.push({ t: 'ferry-in', name: to.name, x: to.x, y: to.y });
  w.say(`${to.name}. Mind the gap!`, 'good');
}
/** the one-time hints and the phone text when Sentosa opens */
export const CABLE_HINT = 'Sentosa is open! Ride the cable car from HarbourFront at the docks (E at the station, 4 coins), walk the boardwalk, or take the MRT to Beach station.';
export const EAST_TEXT = 'The MRT runs on over the Rochor River: Bugis for Kampong Glam, and Little India. Walk over the bridges on Syed Alwi Road or Arab Street, or take a taxi.';
export const FAR_TEXT = 'The MRT runs on: Katong Park for Joo Chiat and East Coast Park, over the Geylang River east of Kampong Glam, and Orchard for the Christmas light-up, past Fort Canning Park north-west of Chinatown. Walk, or take a taxi.';
export const CHANGI_TEXT = 'Changi is open! The MRT runs to Changi Airport station: Jewel, the Rain Vortex, the airport and Changi Village. Hire a bike at East Coast Park and ride along the coast.';
export const SOUTH_TEXT = 'The MRT runs on west of Chinatown: Tiong Bahru for the market and the bird corner, and Clarke Quay for the river. Or walk: Outram Road runs down Chinatown’s west side to Clarke Quay, and on to Tiong Bahru under the Ayer Rajah Expressway.';
export const UBIN_TEXT = 'Pulau Ubin is open! Take my bumboat from the Changi Point jetty, four coins. Kak Ayu rents bicycles by the Ubin jetty. No cars, no trains, only the kampong. And the boars, lah.';
/** the hook at the end of chapter ten (not an ending: the story goes on) */
export const KAMPONG_TEXT = 'The black-sailed junk slipped away before dawn, heading south. Keep both halves of the chart safe. I will ask the fishermen where she has gone.';
/** the phone text when Kallang opens (after chapter ten), and the hook at the end of chapter eleven (not an ending either) */
export const KALLANG_TEXT = 'Hello? This is Kubung, at the Old Kallang Airport. A black seaplane landed on my basin at dawn, and crows in caps are carrying my archive away. Ms Tenuk at the Sports Hub says you help people. Take the MRT to Stadium, or walk east from Kampong Glam.';
export const ROAR_TEXT = 'She flew south over the Straits with the photograph, and you still have the chart. I have found the 1937 survey’s flight log: the bearing is in it. Come and see me at the airport.';
/** the phone text when Mandai opens (after chapter eleven), and the hook at the end of chapter twelve (not an ending:
 * the story goes on) */
export const MANDAI_TEXT = 'Hello… this is… Kongkang. Ranger… at the Night Safari, in Mandai. A black seaplane… landed on my reservoir. And strange owls… on my trails. Kubung says… you help. The MRT… runs to Mandai Lake Road.';
export const SELETAR_TEXT = 'Bearing one-eight-two from Station Mandai runs straight down the island and out to sea, past Raffles Lighthouse. She left her card on my jetty: see you at the lighthouse. Until then… my trails are yours. Any night.';
/** the phone text when the Southern Islands open (after chapter twelve), and the hook at the end of chapter thirteen
 * (not an ending: the story goes on) */
export const ISLANDS_TEXT = 'Vanda here, at the bay. Raffles Lighthouse, you said? The island ferry runs from Marina South Pier, on the promenade south of the Bay, out to St John’s Island: three coins. My friend Kak Lumba guides on the reef there. Come and see me first.';
export const LIGHTHOUSE_TEXT = 'Pak Camar here, on the rock. The lamp is lit and the door is still on its hinges, thanks to you. That island on the 1937 chart that no other chart has: I have the keeper’s log open on it. Come and read it with me. The ferry runs all night.';
export const JURONG_TEXT = 'Jurong is open! The MRT runs to Jurong East station: the Science Centre, Snow City and the Chinese Garden on Jurong Lake. Or cross the bridge at the end of Beach Road.';
export const RESORT_TEXT = 'Sentosa is open! The cable car leaves from HarbourFront at the docks (4 coins), the boardwalk runs beside the Sentosa Gateway, the MRT stops at Beach station, and the ferry crosses from Marina Bay (3 coins).';
export function routeToStop(w: World, id: string): boolean {
  const s = linkById(w, id); if (!s || !openStop(w, s.stop)) return false;
  w.waypoint = [s.stop.x, s.stop.y]; w.routeT = 0; w.updateRoute(); return true;
}
