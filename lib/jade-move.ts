// Jade Street: moving. Direct controls for everything the player drives: push a direction and you go that way; a ride
// swings round quickly to face it (no drifting, no steering wheel). Bodies are one circle on foot and a short capsule
// of two circles for rides, pushed out of buildings, water, stalls, lamp posts and trees; a hard knock reports a bump
// (no damage, a little lost speed). Ride stats live here.
import { T, W, H, S, passable, type City, type MoveClass } from './jade-city.js';
import { angDiff, clamp } from './jade-rng.js';

export type VehicleKind = 'scooter' | 'trishaw' | 'tuktuk' | 'van' | 'boat';
export const VEHICLE_KINDS: VehicleKind[] = ['scooter', 'trishaw', 'tuktuk', 'van', 'boat'];
export type VStats = { name: string; speed: number; accel: number; turn: number; r: number; len: number; cargo: number; cls: MoveClass; seats: number; blurb: string };
export const VEHICLES: Record<VehicleKind, VStats> = {
  scooter: { name: 'Scooter', speed: 340, accel: 900, turn: 12, r: 15, len: 46, cargo: 8, cls: 'small', seats: 1, blurb: 'Quick and nimble. Fits down alleys. Small basket.' },
  trishaw: { name: 'Trishaw', speed: 250, accel: 600, turn: 10, r: 19, len: 58, cargo: 16, cls: 'big', seats: 2, blurb: 'Slow and steady, with a seat for a fare and room for goods.' },
  tuktuk: { name: 'Tuk-tuk', speed: 310, accel: 750, turn: 10, r: 21, len: 60, cargo: 20, cls: 'big', seats: 2, blurb: 'Zippy three-wheeler with a passenger bench.' },
  van: { name: 'Delivery van', speed: 285, accel: 620, turn: 8.5, r: 24, len: 80, cargo: 40, cls: 'big', seats: 2, blurb: 'Big hold for trading runs. Too wide for alleys.' },
  boat: { name: 'Canal boat', speed: 250, accel: 520, turn: 7, r: 21, len: 78, cargo: 30, cls: 'boat', seats: 2, blurb: 'Glides along the canal and the harbour.' },
};
export const FOOT = { walk: 145, run: 235, dash: 560, dashT: 0.22, dashCd: 0.75, hopT: 0.42, hopCd: 0.35, r: 12, cargo: 4 };

export type Body = { x: number; y: number; h: number; speed: number; r: number; len: number; cls: MoveClass };
export type Obstacle = { x: number; y: number; r: number };
export type Ctx = { c: City; roof: boolean; air: boolean; blocked?: (tx: number, ty: number) => boolean; obstacles: Obstacle[][] };

/** spatial buckets (one per tile) of the round obstacles: lamp posts, trees, statues, cranes */
export function obstacleGrid(c: City): Obstacle[][] {
  const g: Obstacle[][] = Array.from({ length: W * H }, () => []);
  for (const p of c.props) {
    if (p.solid !== 'tall' || !p.r) continue;
    const tx = Math.floor(p.x / T), ty = Math.floor(p.y / T);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const x = tx + dx, y = ty + dy; if (x >= 0 && y >= 0 && x < W && y < H) g[y * W + x].push({ x: p.x, y: p.y, r: p.r }); }
  }
  return g;
}

/** the circle centres of a body (rides are two circles front and back) */
export function circles(b: Body): [number, number][] {
  const off = Math.max(0, b.len / 2 - b.r);
  if (off < 2) return [[b.x, b.y]];
  const cx = Math.cos(b.h) * off, cy = Math.sin(b.h) * off;
  return [[b.x + cx, b.y + cy], [b.x - cx, b.y - cy]];
}

function blockedTile(ctx: Ctx, cls: MoveClass, tx: number, ty: number) {
  if (ctx.blocked && ctx.blocked(tx, ty)) return true;
  return !passable(ctx.c, cls, tx, ty, ctx.roof, ctx.air);
}

/** push one circle out of blocked tiles and obstacles; returns the correction */
function pushOut(ctx: Ctx, cls: MoveClass, x: number, y: number, r: number): [number, number] {
  let ox = 0, oy = 0;
  for (let it = 0; it < 3; it++) {
    const px = x + ox, py = y + oy;
    const tx0 = Math.floor((px - r) / T), tx1 = Math.floor((px + r) / T), ty0 = Math.floor((py - r) / T), ty1 = Math.floor((py + r) / T);
    let moved = false;
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      if (!blockedTile(ctx, cls, tx, ty)) continue;
      const qx = clamp(px + ox - (px - x) - 0 + 0, tx * T, tx * T + T), qy = clamp(py, ty * T, ty * T + T);
      const cx = clamp(x + ox, tx * T, tx * T + T), cy = clamp(y + oy, ty * T, ty * T + T);
      void qx; void qy;
      let dx = x + ox - cx, dy = y + oy - cy; const d = Math.hypot(dx, dy);
      if (d >= r) continue;
      if (d < 0.001) {
        // centre is inside the tile: push out along the shortest axis
        const l = x + ox - tx * T, rr = tx * T + T - (x + ox), u = y + oy - ty * T, dd = ty * T + T - (y + oy);
        const m = Math.min(l, rr, u, dd);
        if (m === l) ox -= l + r; else if (m === rr) ox += rr + r; else if (m === u) oy -= u + r; else oy += dd + r;
      } else { dx /= d; dy /= d; ox += dx * (r - d); oy += dy * (r - d); }
      moved = true;
    }
    if (!ctx.roof) {
      const tx = Math.floor((x + ox) / T), ty = Math.floor((y + oy) / T);
      if (tx >= 0 && ty >= 0 && tx < W && ty < H && cls !== 'boat' && cls !== 'fly') for (const o of ctx.obstacles[ty * W + tx]) {
        let dx = x + ox - o.x, dy = y + oy - o.y; const d = Math.hypot(dx, dy), m = r + o.r;
        if (d >= m) continue;
        if (d < 0.001) { dx = 1; dy = 0; } else { dx /= d; dy /= d; }
        ox += dx * (m - d); oy += dy * (m - d); moved = true;
      }
    }
    if (!moved) break;
  }
  return [ox, oy];
}

export type MoveResult = { bump: number; nx: number; ny: number };
/**
 * Direct control step. (ix, iy) is the stick, length 0..1. `top` is the top speed for this body now.
 * Returns the hardest knock this step (speed lost into a wall) so the game can play a bump.
 */
export function drive(ctx: Ctx, b: Body, ix: number, iy: number, top: number, accel: number, turn: number, dt: number, onFoot: boolean): MoveResult {
  const m = Math.min(1, Math.hypot(ix, iy));
  if (m > 0.12) {
    const th = Math.atan2(iy, ix);
    if (onFoot) { b.h = th; }
    else { const d = angDiff(b.h, th); b.h += clamp(d, -turn * dt, turn * dt); }
    const align = onFoot ? 1 : Math.max(0.3, Math.cos(angDiff(b.h, th)));
    const want = top * m * align;
    b.speed = b.speed < want ? Math.min(want, b.speed + accel * dt) : Math.max(want, b.speed - accel * 1.6 * dt);
  } else {
    b.speed = Math.max(0, b.speed - accel * (onFoot ? 4 : 1.8) * dt);
  }
  return step(ctx, b, dt);
}

/** move along the heading and resolve collisions */
export function step(ctx: Ctx, b: Body, dt: number): MoveResult {
  const vx = Math.cos(b.h) * b.speed, vy = Math.sin(b.h) * b.speed;
  // substeps keep fast rides from tunnelling through a one-tile wall
  const n = Math.max(1, Math.ceil((b.speed * dt) / (b.r * 0.8)));
  let bump = 0, nx = 0, ny = 0;
  for (let k = 0; k < n; k++) {
    b.x += vx * dt / n; b.y += vy * dt / n;
    let sx = 0, sy = 0, cnt = 0;
    for (const [cx, cy] of circles(b)) {
      const [ox, oy] = pushOut(ctx, b.cls, cx, cy, b.r);
      if (ox || oy) { sx += ox; sy += oy; cnt++; }
    }
    if (cnt) {
      b.x += sx / cnt; b.y += sy / cnt;
      const l = Math.hypot(sx, sy) || 1; const ux = sx / l, uy = sy / l;
      const into = -(vx * ux + vy * uy);
      if (into > 0) { bump = Math.max(bump, into); nx = ux; ny = uy; }
    }
  }
  if (bump > 0) {
    // slide along the wall: keep the tangential part of the speed
    const tx = -ny, ty = nx; const along = Math.cos(b.h) * tx + Math.sin(b.h) * ty;
    b.speed = Math.abs(along) * b.speed * 0.92 + 0.0;
    if (bump > 140 && b.cls !== 'foot') b.speed *= 0.7;
  }
  b.x = clamp(b.x, b.r, W * T - b.r); b.y = clamp(b.y, b.r, H * T - b.r);
  return { bump, nx, ny };
}

/** is the body overlapping anything solid right now (for the never-stuck checks) */
export function overlapping(ctx: Ctx, b: Body): boolean {
  for (const [cx, cy] of circles(b)) { const [ox, oy] = pushOut(ctx, b.cls, cx, cy, b.r - 1.5); if (Math.abs(ox) + Math.abs(oy) > 0.5) return true; }
  return false;
}

/** circle–circle shove between two movers; returns the overlap that was resolved */
export function shove(a: { x: number; y: number }, ra: number, b: { x: number; y: number }, rb: number, wa = 0.5): number {
  const dx = b.x - a.x, dy = b.y - a.y; const d = Math.hypot(dx, dy), m = ra + rb;
  if (d >= m || d < 0.001) return 0;
  const o = m - d, ux = dx / d, uy = dy / d;
  a.x -= ux * o * wa; a.y -= uy * o * wa; b.x += ux * o * (1 - wa); b.y += uy * o * (1 - wa);
  return o;
}
export const solidAt = (c: City, x: number, y: number) => { const tx = Math.floor(x / T), ty = Math.floor(y / T); return tx < 0 || ty < 0 || tx >= W || ty >= H ? S.BUILDING : c.solid[ty * W + tx]; };
