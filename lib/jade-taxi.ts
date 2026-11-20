// Jade Street: taxis, hailed through the Grab app on the phone or by hailing at the kerb (G). A teal or yellow
// taxi drives over (or one already on the road pulls in), you both climb in, pick a drop-off on the list, and it
// drives you there on its own along the roads (skip the ride with E). The fare is by distance. Free roam only: no
// taxis during a job, with heat, or with a ticket in hand. No DOM; deterministic.
import { T, W, G, districtAt, type Place } from './jade-city.js';
import { downhill, nearestFree } from './jade-nav.js';
import { dist } from './jade-rng.js';
import type { Body } from './jade-move.js';
import type { World } from './jade-game.js';

export const TAXI_APP = 'Grab';
/** autopilot speed (world units a second): quick, so the island's districts are a short ride apart */
export const TAXI_SPEED = 420;
export type Taxi = { b: Body; st: 'come' | 'wait' | 'ride' | 'gone'; t: number; to: string | null; sprite: string; fare: number; wait: number };
export const fareTo = (w: World, p: Place) => Math.max(4, Math.round(3 + dist(w.p.x, w.p.y, p.x, p.y) / T * 0.12));
/** why you can't get a taxi now, or null */
export function cantHail(w: World): string | null {
  if (w.run) return 'No taxis during a job';
  if (districtAt(Math.floor(w.p.x / T), Math.floor(w.p.y / T)) === 'pulau') return 'No taxis on Pulau Ubin: no roads, only bike tracks. Hire a bike from Kak Ayu, or take the bumboat back';
  if (w.heat >= 1) return 'No taxi will stop with the wardens after you';
  if (w.ticket) return 'Pay your ticket first';
  if (w.p.ride || w.p.roof || w.p.hide) return 'Hail from the pavement, on foot';
  if (w.taxi && w.taxi.st !== 'gone') return 'Your taxi is on its way';
  return null;
}
/** hail a taxi: one on the road nearby pulls in, or the app sends one from a street or two away */
export function hail(w: World, app = false): boolean {
  const why = cantHail(w); if (why) { w.say(why, 'bad'); return false; }
  const px = w.p.x, py = w.p.y;
  const near = w.cars.find(c => c.sprite === 'car-taxi' && dist(c.x, c.y, px, py) < 700);
  let x: number, y: number, h = 0;
  if (near) { x = near.x; y = near.y; h = near.h; w.cars = w.cars.filter(c => c !== near); }
  else {
    let best: [number, number] | null = null;
    for (let k = 0; k < 40 && !best; k++) {
      const a = w.R() * Math.PI * 2, d = 520 + w.R() * 260;
      const [cx, cy] = nearestFree(w.c, 'big', px + Math.cos(a) * d, py + Math.sin(a) * d, w.open, 6);
      const tx = Math.floor(cx / T), ty = Math.floor(cy / T);
      if (w.c.ground[ty * W + tx] === G.ROAD && w.open.has(districtAt(tx, ty)) && w.fieldTo('big', px, py).dist[ty * W + tx] >= 0) best = [cx, cy];
    }
    if (!best) { w.say('No taxis round here. Try a bigger road.', 'bad'); return false; }
    [x, y] = best;
  }
  w.taxi = { b: { x, y, h, speed: 0, r: 22, len: 76, cls: 'big' }, st: 'come', t: 0, to: null, sprite: w.R() < 0.6 ? 'v-taxi' : 'v-taxi-b', fare: 0, wait: 0 };
  w.p.act = { n: app ? 'phone' : 'hail', t: 0, dur: 0.9 }; w.p.face = app ? 'down' : 'side';
  w.fx.push({ t: 'hail', x: px, y: py });
  w.say(app ? `${TAXI_APP}: a taxi is on its way` : 'Taxi! A taxi is on its way', 'good');
  return true;
}
/** the places a taxi drops off at: safe houses, markets, contacts, stations and sights in open districts */
export function dropOffs(w: World): { id: string; name: string; fare: number }[] {
  const out: { id: string; name: string; fare: number }[] = [];
  for (const [id, p] of Object.entries(w.c.places)) {
    if (!w.open.has(p.d) || !p.name || !['safe', 'market', 'station', 'spot'].includes(p.kind)) continue;
    // (Pulau Ubin is over the strait: no taxi crosses it)
    if (p.d === 'pulau') continue;
    if (dist(p.x, p.y, w.p.x, w.p.y) < 8 * T) continue;
    out.push({ id, name: p.name, fare: fareTo(w, p) });
  }
  return out.sort((a, b) => a.fare - b.fare).slice(0, 14);
}
/** get in and go (from the drop-off list) */
export function taxiGo(w: World, id: string): boolean {
  const tx = w.taxi, p = w.c.places[id]; if (!tx || tx.st !== 'wait' || !p) return false;
  const fare = fareTo(w, p);
  if (w.s.cash < fare) { w.say(`The fare is ${fare} coins`, 'bad'); return false; }
  tx.st = 'ride'; tx.to = id; tx.fare = fare; tx.t = 0; w.ui = null;
  w.p.hide = true; w.mate.hide = true;
  w.fx.push({ t: 'taxi-in' });
  return true;
}
/** the drop-off: pay, step out, both of you */
export function arrive(w: World) {
  const tx = w.taxi; if (!tx || !tx.to) return;
  const p = w.c.places[tx.to];
  w.s.cash -= Math.min(w.s.cash, tx.fare); w.s.stats.taxi++;
  const [x, y] = nearestFree(w.c, 'foot', p.x, p.y + T * 0.8, w.open, 4);
  w.p.b.x = x; w.p.b.y = y; w.p.b.speed = 0; w.p.hide = false; w.mate.hide = false; w.p.face = 'down';
  w.regroup(); tx.st = 'gone'; tx.t = 0; tx.b.x = x + 70; tx.b.y = y;
  w.fx.push({ t: 'taxi-out', k: tx.fare, x, y });
  w.say(`${TAXI_APP}: ${tx.fare} coins. Terima kasih!`, 'good');
}
export function taxiStep(w: World, dt: number) {
  const tx = w.taxi; if (!tx) return;
  tx.t += dt;
  if (tx.st === 'gone') { if (tx.t > 3) w.taxi = null; else { tx.b.x += Math.cos(tx.b.h) * 200 * dt; tx.b.y += Math.sin(tx.b.h) * 200 * dt; } return; }
  const goal: [number, number] = tx.st === 'ride' ? [w.c.places[tx.to!].x, w.c.places[tx.to!].y] : [w.p.x, w.p.y];
  if (tx.st === 'wait') { tx.wait += dt; if (dist(tx.b.x, tx.b.y, w.p.x, w.p.y) > 600 || tx.wait > 40) { tx.st = 'gone'; tx.t = 0; w.say('The taxi drove off.', 'bad'); } return; }
  if (tx.st === 'come' && (w.run || w.heat >= 1)) { tx.st = 'gone'; tx.t = 0; return; }
  const d = dist(tx.b.x, tx.b.y, goal[0], goal[1]);
  if (d < (tx.st === 'ride' ? 110 : 90)) {
    if (tx.st === 'come') { tx.st = 'wait'; tx.wait = 0; tx.b.speed = 0; w.fx.push({ t: 'taxi-stop', x: tx.b.x, y: tx.b.y }); if (!w.p.act) { w.p.act = { n: 'point', t: 0, dur: 0.9 }; w.p.face = 'side'; } w.say('Your taxi is here: E to get in', 'good', 'taxi is on its way'); }
    else arrive(w);
    return;
  }
  // the autopilot: down the big rides' flow field (it ghosts through traffic), a little faster on the long straights
  const f = w.fieldTo('big', goal[0], goal[1]);
  const n = downhill(w.c, f, tx.b.x, tx.b.y, w.open) ?? goal;
  const dx = n[0] - tx.b.x, dy = n[1] - tx.b.y, l = Math.hypot(dx, dy) || 1;
  const want = Math.atan2(dy, dx); let dh = want - tx.b.h; while (dh > Math.PI) dh -= 2 * Math.PI; while (dh < -Math.PI) dh += 2 * Math.PI;
  tx.b.h += Math.max(-8 * dt, Math.min(8 * dt, dh));
  tx.b.speed = Math.min(TAXI_SPEED, tx.b.speed + 700 * dt) * (Math.abs(dh) > 1.2 ? 0.92 : 1);
  const step = Math.min(l, tx.b.speed * dt);
  tx.b.x += dx / l * step; tx.b.y += dy / l * step;
  if (tx.st === 'ride') {
    w.p.b.x = tx.b.x; w.p.b.y = tx.b.y; w.mate.b.x = tx.b.x; w.mate.b.y = tx.b.y;
    // a stuck autopilot (no road found) just drops you off
    if (tx.t > 90) arrive(w);
  }
}
/** skip the rest of the ride (E in the back seat) */
export function skipRide(w: World) { if (w.taxi?.st === 'ride') arrive(w); }
