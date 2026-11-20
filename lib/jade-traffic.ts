// Jade Street: traffic. Cars keep to their lane (traffic drives on the left), choose straight, left or right at each
// crossing, U-turn at a road's end, slow for anything ahead, and stop at the line when the traffic lights at the
// twelve main crossings are against them (green, amber, then red, the two roads taking turns). They are spawned in a
// ring around the player and dropped far away, so only a couple of dozen exist at once. Townsfolk: lib/jade-folk.ts.
import { T, ROADS, OLD_ROADS, XWAY_ROADS, OW, CT_DISTRICTS, districtAt } from './jade-city.js';
import { shove } from './jade-move.js';
import { dist } from './jade-rng.js';
import type { World } from './jade-game.js';
import { sgBlockers } from './jade-sg.js';
import { addHeat } from './jade-heat.js';

export const CAR_SPRITES = ['car-mint', 'car-cream', 'car-van', 'car-taxi', 'car-bus', 'car-purple', 'car-fruit', 'car-moto'];
export type Car = { id: number; sprite: string; r: number; d: 1 | -1; s: number; x: number; y: number; h: number; speed: number; cruise: number; plan: { r: number; d: 1 | -1; at: number } | null; planned: number; stopT: number; wob: number; rad: number; len: number; go: number; wait?: number };
export const MAX_CARS = 22;

// ── traffic lights at the main crossings: horizontal roads at 30, 46 and 62 with the avenues at 26, 42, 60 and 90
export type Light = { h: number; v: number; tx: number; ty: number; off: number };
export const LIGHTS: Light[] = [];
export const LIGHT_AT = new Map<string, number>();
// (Chinatown's are read off the old-frame road plan OLD_ROADS, which keeps the same index in ROADS, so their numbers and
// phases hold; the light's tile off the moved plan ROADS)
OLD_ROADS.forEach((r, i) => { if (r.axis !== 'h' || ![30, 46, 62].includes(r.at)) return; OLD_ROADS.forEach((r2, j) => {
  if (r2.axis !== 'v' || ![26, 42, 60, 90].includes(r2.at) || r2.from > r.at || r2.to < r.at + 3 || r.from > r2.at || r.to < r2.at + 3) return;
  LIGHT_AT.set(`${i}:${j}`, LIGHTS.length); LIGHTS.push({ h: i, v: j, tx: ROADS[j].at, ty: ROADS[i].at, off: (r2.at * 7 + r.at * 3) % 15 });
}); });
// every other avenue crossing outside Chinatown, after Chinatown's so its lights keep their numbers: read off the world's
// road plan ROADS (the relayout split some roads and added the seam's), not counting the expressways or Sentosa's lanes
// (a road built west of Chinatown's east edge); the phase from the old frame where the road has one
const XW = new Set(XWAY_ROADS);
const builtAt = (i: number) => i < OLD_ROADS.length ? OLD_ROADS[i].at : ROADS[i].at + 1000;
ROADS.forEach((r, i) => { if (r.axis !== 'h' || XW.has(i)) return; ROADS.forEach((r2, j) => {
  if (r2.axis !== 'v' || builtAt(j) < OW || XW.has(j) || r2.from > r.at || r2.to < r.at + 3 || r.to < r2.at + 3 || r.from > r2.at) return;
  LIGHT_AT.set(`${i}:${j}`, LIGHTS.length); LIGHTS.push({ h: i, v: j, tx: r2.at, ty: r.at, off: (builtAt(j) * 7 + (i < OLD_ROADS.length ? OLD_ROADS[i].at : r.at) * 3) % 15 });
}); });
/** (cars on an expressway, XW above, cruise faster) */
/** Chinatown's roads come first in ROADS */
const CT_ROADS = OLD_ROADS.findIndex(r => (r.axis === 'v' ? r.at : r.from) >= OW);
/** how far a road passes from (x, y), in world units */
const roadDist = (r: typeof ROADS[number], x: number, y: number) => { const a = (r.at + 2) * T, lo = r.from * T, hi = (r.to + 1) * T; return r.axis === 'h' ? Math.hypot(Math.max(0, lo - x, x - hi), y - a) : Math.hypot(Math.max(0, lo - y, y - hi), x - a); };
export const CYCLE = 15;
export type LightColour = 'green' | 'amber' | 'red';
/** what the light at crossing `li` shows to traffic on the horizontal ('h') or vertical ('v') road */
export function lightOf(w: { time: number }, li: number, axis: 'h' | 'v'): LightColour {
  const t = (w.time + LIGHTS[li].off) % CYCLE;
  if (axis === 'h') return t >= 0.5 && t < 6 ? 'green' : t >= 6 && t < 7.5 ? 'amber' : 'red';
  return t >= 8 && t < 13.5 ? 'green' : t >= 13.5 ? 'amber' : 'red';
}
const laneOf = (ri: number, d: 1 | -1) => { const r = ROADS[ri]; return (r.at + (r.axis === 'h' ? (d > 0 ? 1 : 2) : (d > 0 ? 2 : 1))) * T + T / 2; };
function carXY(c: Car) {
  const r = ROADS[c.r]; const lane = laneOf(c.r, c.d);
  if (r.axis === 'h') { c.x = c.s; c.y = lane; c.h = c.d > 0 ? 0 : Math.PI; } else { c.x = lane; c.y = c.s; c.h = c.d > 0 ? Math.PI / 2 : -Math.PI / 2; }
}
/** perpendicular roads crossing road ri, with the span of the crossing along ri */
const CROSS: { r: number; a: number; b: number }[][] = ROADS.map((r, i) => ROADS.flatMap((r2, j) => {
  if (j === i || r2.axis === r.axis) return [];
  if (r2.at + 3 < r.from || r2.at > r.to || r.at + 3 < r2.from || r.at > r2.to) return [];
  return [{ r: j, a: r2.at * T, b: (r2.at + 4) * T }];
}));

export function trafficStep(w: World, dt: number) {
  const px = w.p.x, py = w.p.y;
  // spawn in a ring off screen
  if (w.cars.length < MAX_CARS && w.tick % 9 === 0) {
    // in Chinatown any of its twelve roads, as before (so its traffic is as busy as it was); on the island a road that
    // passes near you (it has many more roads than you can see)
    const near = CT_DISTRICTS.includes(districtAt(Math.floor(px / T), Math.floor(py / T))) ? [] : ROADS.map((_, i) => i).filter(i => roadDist(ROADS[i], px, py) < 1500);
    const ri = near.length ? near[Math.floor(w.R() * near.length)] : Math.floor(w.R() * CT_ROADS), r = ROADS[ri];
    const d: 1 | -1 = w.R() < 0.5 ? 1 : -1;
    const lo = (r.from + 1) * T, hi = (r.to) * T;
    const s = lo + w.R() * (hi - lo);
    const c: Car = { id: w.nextId++, sprite: CAR_SPRITES[Math.floor(w.R() * CAR_SPRITES.length)], r: ri, d, s, x: 0, y: 0, h: 0, speed: 0, cruise: 120 + w.R() * 60, plan: null, planned: -1, stopT: 0, wob: 0, rad: 21, len: 70, go: -1 };
    if (c.sprite === 'car-bus') { c.len = 96; c.cruise = 105; } if (c.sprite === 'car-moto') { c.len = 44; c.rad = 14; c.cruise = 170; }
    if (XW.has(ri)) c.cruise = 250 + (c.cruise - 105) * 0.8;
    carXY(c);
    const dd = dist(c.x, c.y, px, py);
    const tx = Math.floor(c.x / T), ty = Math.floor(c.y / T);
    if (dd > 760 && dd < 1500 && w.open.has(districtAt(tx, ty)) && !w.cars.some(o => dist(o.x, o.y, c.x, c.y) < 200) && !CROSS[ri].some(x => d > 0 ? c.s > x.a - 4 * T && c.s < x.b : c.s > x.a && c.s < x.b + 4 * T)) { c.speed = c.cruise; w.cars.push(c); }
  }
  for (const c of w.cars) {
    const r = ROADS[c.r];
    // what's ahead?
    let block = 1e9, held = false;
    const fx = Math.cos(c.h), fy = Math.sin(c.h);
    const look = (x: number, y: number, rad: number, back = 0) => { const dx = x - c.x, dy = y - c.y; const a = dx * fx + dy * fy, l = Math.abs(dx * fy - dy * fx); if (a > 0 && a < 150 + back && l < rad + 16) block = Math.min(block, a - back); };
    // (21-11) cars: the one ahead in your own lane is measured to its tail, so a queue no longer piles cars on top of
    // each other; a car crossing your path is waited for, but after 1.5 s of waiting you go (the first of two stuck
    // cars by id), which ends the junction gridlock where two cars each waited on the other forever
    const waited = (c.wait ?? 0) > 1.5;
    let crossHeld = false;
    for (const o of w.cars) if (o !== c) {
      const lane = o.r === c.r && o.d === c.d;
      if (lane) { look(o.x, o.y, o.rad, o.len / 2 - 22); continue; }
      if (waited && !((o.wait ?? 0) > 1.5 && o.id < c.id)) continue;
      const b0 = block; look(o.x, o.y, o.rad); if (block < b0) crossHeld = true;
    }
    look(px, py, w.p.ride ? w.p.ride.b.r : 12);
    for (const pd of w.peds) if (pd.hop <= 0) look(pd.x, pd.y, 10);
    for (const wd of w.wardens) look(wd.b.x, wd.b.y, 14);
    for (const b of w.blocks) look(b.x, b.y, b.r);
    for (const [bx, by, br] of sgBlockers(w)) look(bx, by, br);
    // the lights: stop at the line before the crossing (an amber you are too close to stop for, you go through)
    for (const x of CROSS[c.r]) {
      const li = LIGHT_AT.get(r.axis === 'h' ? `${c.r}:${x.r}` : `${x.r}:${c.r}`); if (li === undefined) continue;
      const line = c.d > 0 ? x.a - T - 6 : x.b + T + 6, edge = c.d > 0 ? x.a : x.b;
      const ahead = (line - c.s) * c.d, front = ahead - c.len / 2, toBox = (edge - c.s) * c.d - c.len / 2;
      if (toBox < -c.len - 2 * T) { if (c.go === li) c.go = -1; continue; }
      if (ahead > 260) continue;
      const col = lightOf(w, li, r.axis);
      // past the line on green or amber: committed, so it clears the crossing even if the light turns red
      if (col !== 'red' && front < -4) { c.go = li; continue; }
      if (col === 'green' || c.go === li || toBox < -2) continue;
      if (col === 'amber' && front < 34) { c.go = li; continue; }
      block = Math.min(block, front >= -4 ? ahead + 22 : c.len / 2 + 6); held = true;
    }
    const want = block < c.len / 2 + 22 ? 0 : block < c.len / 2 + 80 ? c.cruise * 0.35 : c.cruise;
    c.speed += Math.max(-500 * dt, Math.min(260 * dt, want - c.speed));
    if (c.speed < 5 && block < 1e9 && !held) c.stopT += dt; else c.stopT = 0;
    c.wait = c.speed < 5 && crossHeld && !held ? (c.wait ?? 0) + dt : c.speed > 30 ? 0 : (c.wait ?? 0);
    if (c.stopT > 2.5 && dist(px, py, c.x, c.y) < 200) { c.stopT = 0; w.fx.push({ t: 'car-honk', x: c.x, y: c.y }); }
    c.wob = Math.max(0, c.wob - dt);
    const s0 = c.s; c.s += c.d * c.speed * dt;
    // choose at each crossing: straight, left or right
    for (const x of CROSS[c.r]) {
      const entry = c.d > 0 ? x.a : x.b;
      if (c.planned !== x.r && (c.d > 0 ? c.s > entry - 40 && s0 <= entry + 4 : c.s < entry + 40 && s0 >= entry - 4)) {
        c.planned = x.r;
        const r2 = ROADS[x.r]; const opts: { r: number; d: 1 | -1 }[] = [];
        if (r2.to >= r.at + 6) opts.push({ r: x.r, d: 1 });
        if (r2.from <= r.at - 3) opts.push({ r: x.r, d: -1 });
        const straight = c.d > 0 ? r.to * T > x.b + 2 * T : r.from * T < x.a - 2 * T;
        if (opts.length && (!straight || w.R() < 0.45)) { const o = opts[Math.floor(w.R() * opts.length)]; c.plan = { r: o.r, d: o.d, at: laneOf(o.r, o.d) }; } else c.plan = null;
      }
    }
    if (c.plan && (c.d > 0 ? s0 < c.plan.at && c.s >= c.plan.at : s0 > c.plan.at && c.s <= c.plan.at)) {
      const old = r.axis === 'h' ? c.y : c.x;
      const wasX = XW.has(c.r); c.r = c.plan.r; c.d = c.plan.d; c.s = old; c.plan = null; c.planned = -1;
      if (XW.has(c.r) !== wasX) c.cruise += wasX ? -130 : 130;
    }
    // road's end: U-turn
    const rr = ROADS[c.r];
    if (c.d > 0 && c.s > (rr.to + 0.4) * T) { c.d = -1; c.s = (rr.to + 0.4) * T; }
    if (c.d < 0 && c.s < (rr.from + 0.6) * T) { c.d = 1; c.s = (rr.from + 0.6) * T; }
    carXY(c);
    // touching the player: the player gets nudged; a hard knock is a bump with a little heat
    const pr = w.p.ride ? w.p.ride.b : w.p.b;
    if (!w.p.roof && !w.p.hide) {
      const before = pr.speed;
      const o = shove(c, 0, pr, c.rad + pr.r, 0);
      if (o > 0) {
        if (w.p.ride && before > 110) { if (before > 160) addHeat(w, 0.15 * w.diff.crash, 'car'); w.bumped(before, (c.x + pr.x) / 2, (c.y + pr.y) / 2, 'car'); c.wob = 0.6; pr.speed *= 0.6; w.fx.push({ t: 'car-honk', x: c.x, y: c.y }); }
        w.run?.onCarTouch(c);
      }
    }
  }
  w.cars = w.cars.filter(c => dist(c.x, c.y, px, py) < 1800 && w.open.has(districtAt(Math.floor(c.x / T), Math.floor(c.y / T))));
}

/** the light whose crossing a rider at (x1, y1) has just driven into against a red, or -1 (heading h picks the road) */
export function redRun(w: { time: number }, x0: number, y0: number, x1: number, y1: number, h: number): number {
  const axis: 'h' | 'v' = Math.abs(Math.cos(h)) >= Math.abs(Math.sin(h)) ? 'h' : 'v';
  for (let li = 0; li < LIGHTS.length; li++) {
    const L = LIGHTS[li], bx = ROADS[L.v].at * T, by = ROADS[L.h].at * T;
    const inBox = (x: number, y: number) => x > bx && x < bx + 4 * T && y > by && y < by + 4 * T;
    if (!inBox(x0, y0) && inBox(x1, y1)) return lightOf(w, li, axis) === 'red' ? li : -1;
  }
  return -1;
}
/** true when a rider at (x, y) heading h is within `look` of a crossing whose light is not green for that way (a
 *  racer that plays fair waits at it, as the player must on Normal and Hard); never inside a crossing */
export function redAhead(w: { time: number }, x: number, y: number, h: number, look: number): boolean {
  const axis: 'h' | 'v' = Math.abs(Math.cos(h)) >= Math.abs(Math.sin(h)) ? 'h' : 'v';
  const fx = Math.cos(h), fy = Math.sin(h);
  for (let li = 0; li < LIGHTS.length; li++) {
    const L = LIGHTS[li], bx = ROADS[L.v].at * T, by = ROADS[L.h].at * T;
    if (x > bx && x < bx + 4 * T && y > by && y < by + 4 * T) return false;
    const cx = bx + 2 * T - x, cy = by + 2 * T - y;
    const along = cx * fx + cy * fy, side = Math.abs(-cx * fy + cy * fx);
    if (side < 2 * T && along > 2 * T && along < 2 * T + look) return lightOf(w, li, axis) !== 'green';
  }
  return false;
}
