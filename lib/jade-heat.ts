// Jade Street: heat. Up to five paper lanterns. Trouble (smashing stalls, knocking wardens, bumping traffic) lights
// them; raccoon wardens on bikes come for you (one per lantern, max four), fruit-crate roadblocks appear from three
// lanterns and a warden blimp's spotlight from four. Break their line of sight for a few seconds (alleys, buildings,
// a bead curtain, the rooftops) and a lantern goes out; a jacket swap at a safe house clears them all. Getting caught
// costs a little cash and puts you at the nearest safe house. No combat: you bump, dodge and hide.
import { T, S, districtAt } from './jade-city.js';
import { VEHICLES, drive, shove, type Body } from './jade-move.js';
import { los, downhill, nearestFree } from './jade-nav.js';
import { dist, clamp } from './jade-rng.js';
import type { World } from './jade-game.js';

export type Warden = { id: number; b: Body; stun: number; leave: boolean; grab: number; pedal: number };
export type Roadblock = { id: number; x: number; y: number; r: number; h: number; sprite: string; knocked: number };
export const SIGHT = 520;

export function addHeat(w: World, n: number, why: string) {
  if (w.p.roof && why !== 'story') return;
  // on Assist, scrapes during a job count half: the job is the challenge, not the wardens
  if (w.assist && w.run && why !== 'story') n *= 0.5;
  const before = Math.floor(w.heat);
  w.heat = clamp(w.heat + n, 0, 5);
  if (Math.floor(w.heat) > before) { w.fx.push({ t: 'heat-up', k: Math.floor(w.heat) }); w.seenT = 0; w.lastSeen = [w.p.x, w.p.y]; }
  w.s.stats.maxHeat = Math.max(w.s.stats.maxHeat, Math.floor(w.heat));
}
export const lanterns = (w: World) => Math.floor(w.heat);

export function heatStep(w: World, dt: number) {
  const L = lanterns(w);
  const px = w.p.x, py = w.p.y;
  const pb = w.p.ride ? w.p.ride.b : w.p.b;
  if (L === 0) {
    w.heat = Math.max(0, w.heat - 0.06 * dt);
    for (const wd of w.wardens) wd.leave = true;
    w.blimp.on = false;
  }
  // spawn wardens to match the lanterns, coming from off screen along open ground
  const want = L === 0 ? 0 : Math.min(4, Math.max(1, L + w.diff.extra));
  const active = w.wardens.filter(x => !x.leave).length;
  if (active < want && w.tick % 30 === 0) {
    // they come from behind or the sides, never out of the street you're running down
    const a = (pb.speed > 40 ? pb.h + Math.PI : w.R() * Math.PI * 2) + (w.R() - 0.5) * 2.4;
    const [sx, sy] = nearestFree(w.c, 'small', px + Math.cos(a) * 760, py + Math.sin(a) * 520, w.open, 6);
    if (dist(sx, sy, px, py) > 420) w.wardens.push({ id: w.nextId++, b: { x: sx, y: sy, h: a + Math.PI, speed: 0, r: 15, len: 40, cls: 'small' }, stun: 0, leave: false, grab: 0, pedal: 0 });
  }
  while (w.wardens.filter(x => !x.leave).length > want) { const x = w.wardens.find(x => !x.leave); if (!x) break; x.leave = true; }
  // who can see you?
  let seen = false;
  if (!w.p.hide && L > 0) {
    for (const wd of w.wardens) if (!wd.leave && wd.stun <= 0 && dist(wd.b.x, wd.b.y, px, py) < w.diff.sight && los(w.c, wd.b.x, wd.b.y, px, py)) { seen = true; break; }
    if (w.blimp.on && dist(w.blimp.x, w.blimp.y, px, py) < 120 && !w.p.roof) seen = true;
  }
  if (L > 0) {
    if (seen) { w.seenT = 0; w.lastSeen = [px, py]; }
    else {
      w.seenT += dt * (w.p.hide ? 2 : 1);
      if (w.seenT >= w.diff.evade) {
        w.seenT = 0; w.heat = Math.max(0, Math.floor(w.heat) - 1 + 0.001);
        w.fx.push({ t: 'heat-down', k: Math.floor(w.heat) });
        if (Math.floor(w.heat) === 0) { w.heat = 0; w.s.stats.escapes++; w.say('You lost them! The lanterns are dark.', 'good'); w.run?.onHeatClear(); }
      }
    }
  }
  // wardens ride to where they last saw you (straight at you when they can see you)
  const tgt = seen ? [px, py] : w.lastSeen;
  const f = L > 0 ? w.fieldTo('small', tgt[0], tgt[1]) : null;
  const top = w.diff.warden + L * 12;
  for (const wd of w.wardens) {
    wd.pedal += dt;
    if (wd.stun > 0) { wd.stun -= dt; wd.b.speed *= 0.9; continue; }
    let gx: number, gy: number;
    if (wd.leave) { gx = wd.b.x + Math.cos(wd.b.h) * 200; gy = wd.b.y + Math.sin(wd.b.h) * 200; }
    else if (seen && dist(wd.b.x, wd.b.y, px, py) < 160 && los(w.c, wd.b.x, wd.b.y, px, py)) { gx = px; gy = py; }
    else { const n = f ? downhill(w.c, f, wd.b.x, wd.b.y, w.open) : null; if (n) { gx = n[0]; gy = n[1]; } else { gx = tgt[0]; gy = tgt[1]; } }
    const dx = gx - wd.b.x, dy = gy - wd.b.y, dl = Math.hypot(dx, dy) || 1;
    drive(w.ctx(), wd.b, dx / dl, dy / dl, wd.leave ? 260 : top, 700, 9, dt, false);
    // the player knocks a warden over: stunned, a little more heat
    if (!w.p.roof && !w.p.hide) {
      const speed = pb.speed;
      const o = shove(wd.b, wd.b.r, pb, pb.r, 0.8);
      if (o > 0 && (w.p.ride ? speed > 130 : w.p.dashT > 0)) { wd.stun = 1.3; w.bumped(speed, wd.b.x, wd.b.y, 'warden'); addHeat(w, 0.3, 'warden'); w.fx.push({ t: 'whistle', x: wd.b.x, y: wd.b.y }); }
    }
    // a grab: on foot you're caught when they reach you; in a ride only when you've come to a stop beside them
    const near = dist(wd.b.x, wd.b.y, px, py) < (w.p.ride ? w.p.ride.b.r + 26 : 28);
    const vulnerable = !w.p.hide && !w.p.roof && !w.p.air && w.p.dashT <= 0 && (!w.p.ride || pb.speed < 50);
    wd.grab = near && vulnerable && !wd.leave ? wd.grab + dt : Math.max(0, wd.grab - dt * 2);
    if (wd.grab > (w.p.ride ? 1.1 : w.diff.grab)) { caught(w); return; }
  }
  w.wardens = w.wardens.filter(x => !(x.leave && dist(x.b.x, x.b.y, px, py) > 1100));
  // roadblocks from three lanterns: a row of fruit crates across the road ahead
  if (L >= 3 && w.blocks.length < 2 && w.tick % 120 === 0 && w.p.ride) {
    const h = w.p.ride.b.h;
    for (const d of [9, 11, 13]) {
      const x = px + Math.cos(h) * d * T, y = py + Math.sin(h) * d * T;
      const tx = Math.floor(x / T), ty = Math.floor(y / T);
      if (tx < 1 || ty < 1 || tx > 118 || ty > 90 || w.c.ground[ty * 120 + tx] !== 2 || !w.open.has(districtAt(tx, ty))) continue;
      w.blocks.push({ id: w.nextId++, x: tx * T + T / 2, y: ty * T + T / 2, r: 26, h: h + Math.PI / 2, sprite: w.R() < 0.5 ? 'block-oranges' : 'block-melons', knocked: 0 });
      w.fx.push({ t: 'roadblock' }); break;
    }
  }
  for (const b of w.blocks) {
    if (b.knocked > 0) { b.knocked += dt; continue; }
    if (w.p.roof) continue;
    const speed = pb.speed;
    const o = shove(b, 0, pb, b.r + pb.r, 0);
    if (o > 0) { if (speed > 150) { b.knocked = 0.01; w.bumped(speed, b.x, b.y, 'block'); addHeat(w, 0.25, 'block'); w.fx.push({ t: 'spill', x: b.x, y: b.y }); } else pb.speed *= 0.5; }
  }
  w.blocks = w.blocks.filter(b => b.knocked < 1.2 && dist(b.x, b.y, px, py) < 1600 && L >= 2);
  // the blimp from four lanterns: drifts after where you were last seen, its spotlight finds you
  if (L >= 4) {
    if (!w.blimp.on) { w.blimp = { x: px - 600, y: py - 500, on: true }; w.fx.push({ t: 'blimp' }); }
    const bx = w.lastSeen[0], by = w.lastSeen[1];
    const sp = w.diff.blimp * dt; const d = dist(bx, by, w.blimp.x, w.blimp.y);
    if (d > 1) { w.blimp.x += (bx - w.blimp.x) / d * Math.min(d, sp); w.blimp.y += (by - w.blimp.y) / d * Math.min(d, sp); }
  } else w.blimp.on = false;
}

/** caught: a small fine, a trip to the nearest safe house, and any job restarts from its checkpoint */
export function caught(w: World) {
  const fine = Math.min(150, Math.max(10, Math.round(w.s.cash * 0.05)));
  const paid = Math.min(fine, w.s.cash);
  w.s.cash -= paid; w.s.stats.caught++;
  w.fx.push({ t: 'caught', k: paid });
  w.banner = { text: 'Caught!', sub: `Captain Bristle fined you ${paid} coins`, t: 3 };
  w.clearHeat();
  if (w.run) { w.respawnAtSafe(); w.fail('The wardens caught you.'); return; }
  w.respawnAtSafe();
  w.p.act = { n: 'caught', t: 0, dur: 1.4 };
}
export const wardenSprite = (wd: Warden) => (Math.floor(wd.pedal * 6) % 2 ? 'warden-bike-a' : 'warden-bike-b');
export { VEHICLES };
