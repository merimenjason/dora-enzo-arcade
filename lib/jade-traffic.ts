// Jade Street: traffic and townsfolk. Cars keep to their lane (traffic drives on the left), choose straight, left or
// right at each crossing, U-turn at a road's end, and slow for anything ahead. Townsfolk stroll the pavements, plazas
// and alleys and hop out of the way of anything fast. Both are spawned in a ring around the player and dropped far
// away, so only a few dozen exist at once.
import { T, W, H, S, G, ROADS, districtAt } from './jade-city.js';
import { shove } from './jade-move.js';
import { dist } from './jade-rng.js';
import type { World } from './jade-game.js';
import { addHeat } from './jade-heat.js';

export const CAR_SPRITES = ['car-mint', 'car-cream', 'car-van', 'car-taxi', 'car-bus', 'car-purple', 'car-fruit', 'car-moto'];
export const FOLK = ['rabbit', 'dog', 'squirrel', 'cat', 'duck', 'hedgehog'];
export type Car = { id: number; sprite: string; r: number; d: 1 | -1; s: number; x: number; y: number; h: number; speed: number; cruise: number; plan: { r: number; d: 1 | -1; at: number } | null; planned: number; stopT: number; wob: number; rad: number; len: number };
export type Ped = { id: number; sp: string; x: number; y: number; h: number; tx: number; ty: number; hop: number; hx: number; hy: number; scare: number; wait: number; walk: number };

const MAX_CARS = 16, MAX_PEDS = 22;
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
    const ri = Math.floor(w.R() * ROADS.length), r = ROADS[ri];
    const d: 1 | -1 = w.R() < 0.5 ? 1 : -1;
    const lo = (r.from + 1) * T, hi = (r.to) * T;
    const s = lo + w.R() * (hi - lo);
    const c: Car = { id: w.nextId++, sprite: CAR_SPRITES[Math.floor(w.R() * CAR_SPRITES.length)], r: ri, d, s, x: 0, y: 0, h: 0, speed: 0, cruise: 120 + w.R() * 60, plan: null, planned: -1, stopT: 0, wob: 0, rad: 21, len: 70 };
    if (c.sprite === 'car-bus') { c.len = 96; c.cruise = 105; } if (c.sprite === 'car-moto') { c.len = 44; c.rad = 14; c.cruise = 170; }
    carXY(c);
    const dd = dist(c.x, c.y, px, py);
    const tx = Math.floor(c.x / T), ty = Math.floor(c.y / T);
    if (dd > 760 && dd < 1500 && w.open.has(districtAt(tx, ty)) && !w.cars.some(o => dist(o.x, o.y, c.x, c.y) < 200)) { c.speed = c.cruise; w.cars.push(c); }
  }
  for (const c of w.cars) {
    const r = ROADS[c.r];
    // what's ahead?
    let block = 1e9;
    const fx = Math.cos(c.h), fy = Math.sin(c.h);
    const look = (x: number, y: number, rad: number) => { const dx = x - c.x, dy = y - c.y; const a = dx * fx + dy * fy, l = Math.abs(dx * fy - dy * fx); if (a > 0 && a < 150 && l < rad + 16) block = Math.min(block, a); };
    for (const o of w.cars) if (o !== c) look(o.x, o.y, o.rad);
    look(px, py, w.p.ride ? w.p.ride.b.r : 12);
    for (const pd of w.peds) if (pd.hop <= 0) look(pd.x, pd.y, 10);
    for (const wd of w.wardens) look(wd.b.x, wd.b.y, 14);
    for (const b of w.blocks) look(b.x, b.y, b.r);
    const want = block < c.len / 2 + 22 ? 0 : block < c.len / 2 + 80 ? c.cruise * 0.35 : c.cruise;
    c.speed += Math.max(-500 * dt, Math.min(260 * dt, want - c.speed));
    if (c.speed < 5 && block < 1e9) c.stopT += dt; else c.stopT = 0;
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
      c.r = c.plan.r; c.d = c.plan.d; c.s = old; c.plan = null; c.planned = -1;
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
        if (w.p.ride && before > 110) { if (before > 160) addHeat(w, 0.15, 'car'); w.bumped(before, (c.x + pr.x) / 2, (c.y + pr.y) / 2, 'car'); c.wob = 0.6; pr.speed *= 0.6; w.fx.push({ t: 'car-honk', x: c.x, y: c.y }); }
        w.run?.onCarTouch(c);
      }
    }
  }
  w.cars = w.cars.filter(c => dist(c.x, c.y, px, py) < 1800 && w.open.has(districtAt(Math.floor(c.x / T), Math.floor(c.y / T))));
}

const pedOk = (w: World, tx: number, ty: number) => {
  if (tx < 0 || ty < 0 || tx >= W || ty >= H) return false;
  const i = ty * W + tx; const g = w.c.ground[i];
  return w.c.solid[i] === S.OPEN && g !== G.ROAD && g !== G.BRIDGE && g !== G.STAIRS && w.open.has(districtAt(tx, ty));
};
export function pedStep(w: World, dt: number) {
  const px = w.p.x, py = w.p.y;
  if (w.peds.length < MAX_PEDS && w.tick % 7 === 3) {
    const a = w.R() * Math.PI * 2, d = 650 + w.R() * 500;
    const tx = Math.floor((px + Math.cos(a) * d) / T), ty = Math.floor((py + Math.sin(a) * d) / T);
    if (pedOk(w, tx, ty)) w.peds.push({ id: w.nextId++, sp: FOLK[Math.floor(w.R() * FOLK.length)], x: tx * T + T / 2, y: ty * T + T / 2, h: 0, tx, ty, hop: 0, hx: 0, hy: 0, scare: 0, wait: 0, walk: w.R() * 9 });
  }
  const pv = w.p.ride ? w.p.ride.b : w.p.b;
  const fast = pv.speed > 90 || w.p.dashT > 0;
  for (const pd of w.peds) {
    if (pd.hop > 0) {
      pd.hop -= dt; const k = dt / 0.42;
      const nx = pd.x + pd.hx * k, ny = pd.y + pd.hy * k;
      const tx = Math.floor(nx / T), ty = Math.floor(ny / T);
      if (tx >= 0 && ty >= 0 && tx < W && ty < H && w.c.solid[ty * W + tx] === S.OPEN) { pd.x = nx; pd.y = ny; }
      if (pd.hop <= 0) { pd.tx = Math.floor(pd.x / T); pd.ty = Math.floor(pd.y / T); }
      continue;
    }
    // something fast coming? hop sideways out of its path
    const dx = pd.x - pv.x, dy = pd.y - pv.y, dd = Math.hypot(dx, dy);
    const toward = dd > 1 ? (Math.cos(pv.h) * dx + Math.sin(pv.h) * dy) / dd : 0;
    if (!w.p.roof && ((fast && dd < 120 && toward > 0.4) || (pd.scare > 0 && dd < 240) || dd < pv.r + 12)) {
      pd.scare = 0;
      const side = Math.sign(Math.cos(pv.h) * dy - Math.sin(pv.h) * dx) || 1;
      let hx = -Math.sin(pv.h) * side * 62, hy = Math.cos(pv.h) * side * 62;
      const ok = (x: number, y: number) => { const tx = Math.floor(x / T), ty = Math.floor(y / T); return tx >= 0 && ty >= 0 && tx < W && ty < H && w.c.solid[ty * W + tx] === S.OPEN; };
      if (!ok(pd.x + hx, pd.y + hy)) { hx = -hx; hy = -hy; }
      if (!ok(pd.x + hx, pd.y + hy)) { hx = 0; hy = 0; }
      pd.hop = 0.42; pd.hx = hx; pd.hy = hy; w.fx.push({ t: 'ped-hop', x: pd.x, y: pd.y });
      continue;
    }
    if (pd.wait > 0) { pd.wait -= dt; continue; }
    const gx = pd.tx * T + T / 2, gy = pd.ty * T + T / 2;
    const ex = gx - pd.x, ey = gy - pd.y, el = Math.hypot(ex, ey);
    if (el < 3) {
      // pick the next tile: keep going if we can, otherwise turn
      const dirs: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      const cur: [number, number] = [Math.round(Math.cos(pd.h)), Math.round(Math.sin(pd.h))];
      const fwd = pedOk(w, pd.tx + cur[0], pd.ty + cur[1]) && (cur[0] || cur[1]) && w.R() < 0.85;
      if (fwd) { pd.tx += cur[0]; pd.ty += cur[1]; }
      else {
        const opts = dirs.filter(([a, b]) => pedOk(w, pd.tx + a, pd.ty + b) && !(a === -cur[0] && b === -cur[1]));
        const pick = opts.length ? opts[Math.floor(w.R() * opts.length)] : dirs.find(([a, b]) => pedOk(w, pd.tx + a, pd.ty + b));
        if (pick) { pd.tx += pick[0]; pd.ty += pick[1]; pd.h = Math.atan2(pick[1], pick[0]); }
        if (w.R() < 0.1) pd.wait = 1 + w.R() * 2;
      }
    } else {
      const sp = 52; pd.h = Math.atan2(ey, ex); pd.walk += dt;
      pd.x += ex / el * Math.min(el, sp * dt); pd.y += ey / el * Math.min(el, sp * dt);
    }
  }
  w.peds = w.peds.filter(pd => dist(pd.x, pd.y, px, py) < 1500);
}
