// Jade Street: townsfolk with somewhere to be. Each picks a destination near where it appears (a shop door, a market
// stall, a seat at a food-court table, a bench or a busker's crowd) and walks there on the pavements, plazas, alleys
// and footbridges. Roads are crossed only at the zebra crossings: at a crossing with lights they wait for the traffic
// on that road to be held at red, elsewhere for a gap in the cars. At a table they sit and eat; at a door or stall they
// browse a moment and choose again. Anything fast coming at them still makes them hop aside, and a honk scatters them.
import { T, W, H, S, G, F_BRIDGE, F_ALLEY, ROADS, OW, districtAt, type City } from './jade-city.js';
import { unmvT } from './jade-layout.js';
import { dist } from './jade-rng.js';
import type { World } from './jade-game.js';
import { lightOf, LIGHT_AT } from './jade-traffic.js';

export const FOLK = ['rabbit', 'dog', 'squirrel', 'cat', 'duck', 'hedgehog', 'goose', 'sunbear', 'rooster'];
/** the Singapore townsfolk, who say a word or two of Singlish (lib/jade-sg.ts) */
export const SG_FOLK = ['goose', 'sunbear', 'rooster', 'tapir', 'mousedeer', 'civet', 'deer', 'loris', 'turtle'];
/** the island's townsfolk: mostly its own three (a tapir auntie, a mousedeer office worker, a civet student), with a few from town */
export const ISLE_FOLK = ['tapir', 'mousedeer', 'civet', 'tapir', 'mousedeer', 'civet', 'rabbit', 'cat', 'sunbear', 'goose'];
/** the ninth pass's districts have their own townsfolk too: a spotted-deer auntie in a sari in Little India, a slow
 *  loris uncle in a baju Melayu and songkok in Kampong Glam, a sea-turtle tourist in a flowery shirt on Sentosa */
export const EAST_FOLK: Record<'india' | 'glam' | 'resort', string[]> = {
  india: ['deer', 'deer', 'deer', 'loris', 'tapir', 'mousedeer', 'sunbear', 'rabbit'],
  glam: ['loris', 'loris', 'loris', 'deer', 'civet', 'mousedeer', 'goose', 'cat'],
  resort: ['turtle', 'turtle', 'turtle', 'turtle', 'deer', 'civet', 'tapir', 'duck'],
};
/** the twelfth pass's districts: a magpie-robin uncle with his songbird cage in Katong, a green-pigeon shopper with her
 *  bags on Orchard Road, a little-egret traveller pulling a suitcase at Changi */
export const FAR_FOLK: Record<'orchard' | 'katong' | 'changi', string[]> = {
  orchard: ['pigeon', 'pigeon', 'pigeon', 'pigeon', 'mousedeer', 'civet', 'goose', 'cat', 'turtle'],
  katong: ['robin', 'robin', 'robin', 'pigeon', 'tapir', 'sunbear', 'goose', 'deer'],
  changi: ['egret', 'egret', 'egret', 'egret', 'turtle', 'robin', 'tapir', 'rooster'],
};
/** the fourteenth pass's districts: a tabby neighbour with a tote of books in Tiong Bahru, a bullfrog out for the night
 *  at Clarke Quay, a squirrel schoolchild with a toy rocket in Jurong */
export const SOUTH_FOLK: Record<'tiong' | 'quay' | 'jurong', string[]> = {
  tiong: ['tabby', 'tabby', 'tabby', 'robin', 'goose', 'cat', 'tapir', 'turtle'],
  quay: ['frog', 'frog', 'frog', 'pigeon', 'civet', 'egret', 'cat', 'mousedeer'],
  jurong: ['squirrel', 'squirrel', 'squirrel', 'deer', 'turtle', 'sunbear', 'egret', 'goose'],
};
/** the seventeenth pass: Pulau Ubin's kampong folk are its wildlife: red junglefowl scratching about, an oriental pied
 *  hornbill hopping on the tracks, a box turtle taking its time, and a few villagers' neighbours from Changi */
export const UBIN_FOLK = ['fowl', 'fowl', 'fowl', 'hornbill', 'hornbill', 'boxturtle', 'boxturtle', 'egret', 'deer'];
/** the eighteenth pass: Kallang on match night is mostly fans in the home shirt (a sun bear with a drum, a mouse deer
 *  with a foam finger, an otter auntie with a flag), with a few of the town's own out for the evening */
export const KALLANG_FOLK = ['fanbear', 'fanbear', 'fankancil', 'fankancil', 'fanotter', 'fanotter', 'tapir', 'egret', 'robin'];
/** the nineteenth pass: Mandai after dark is night visitors with torches (a tapir family, a sambar deer, a hornbill pair,
 *  egrets off the reservoir) and a robin or two up late */
export const MANDAI_FOLK = ['tapir', 'tapir', 'deer', 'deer', 'hornbill', 'hornbill', 'egret', 'robin', 'boxturtle'];
/** (the twenty-first pass) the Southern Islands' night visitors: sea turtles up the beach, egrets on the reef, day-trippers */
export const ISLANDS_FOLK = ['turtle', 'turtle', 'egret', 'egret', 'boxturtle', 'duck', 'civet', 'robin', 'goose'];
/** (the twenty-fourth pass) Kranji and Woodlands: egrets and a frog off the farms, Woodlands' commuters and their dogs */
export const KRANJI_FOLK = ['egret', 'egret', 'frog', 'duck', 'robin', 'rabbit', 'goose', 'dog', 'tabby'];
const folkAt = (tx: number, ty: number) => { const d = districtAt(tx, ty); return d === 'kranji' ? KRANJI_FOLK : d === 'islands' ? ISLANDS_FOLK : d === 'mandai' ? MANDAI_FOLK : d === 'kallang' ? KALLANG_FOLK : d === 'pulau' ? UBIN_FOLK : d === 'india' || d === 'glam' || d === 'resort' ? EAST_FOLK[d] : d === 'orchard' || d === 'katong' || d === 'changi' ? FAR_FOLK[d] : d === 'tiong' || d === 'quay' || d === 'jurong' ? SOUTH_FOLK[d] : (unmvT(tx, ty)?.[0] ?? OW) >= OW ? ISLE_FOLK : FOLK; };
export type Ped = {
  id: number; sp: string; x: number; y: number; h: number; tx: number; ty: number; hop: number; hx: number; hy: number; scare: number; wait: number; walk: number;
  dest: number; sit: number; roadT: number; watch: boolean;
  /** splattered by a gadget: the splat sprite and how long it stays */
  splat?: string; splatT?: number;
};
export const MAX_PEDS = 30;

// ── crossings: road tile -> the road it crosses (index) and the light there (or -1); built once from the city
let ZEBRA: Int16Array | null = null, ZLIGHT: Int16Array | null = null;
function zebras(c: City) {
  if (ZEBRA) return;
  const Z = new Int16Array(W * H).fill(-1), L = new Int16Array(W * H).fill(-1);
  ROADS.forEach((r, ri) => ROADS.forEach((r2, rj) => {
    if (r2.axis === r.axis || r2.at + 3 < r.from || r2.at > r.to || r.at + 3 < r2.from || r.at > r2.to) return;
    const li = LIGHT_AT.get(r.axis === 'h' ? `${ri}:${rj}` : `${rj}:${ri}`) ?? -1;
    for (const side of [-1, 4]) for (let k = 1; k <= 2; k++) {
      const x = r.axis === 'h' ? r2.at + side : r.at + k, y = r.axis === 'h' ? r.at + k : r2.at + side;
      if (x < 0 || y < 0 || x >= W || y >= H || c.ground[y * W + x] !== G.ROAD) continue;
      Z[y * W + x] = ri; L[y * W + x] = li;
    }
  }));
  ZEBRA = Z; ZLIGHT = L;
}
/** the road a crossing tile crosses, or -1 */
export const zebraAt = (tx: number, ty: number) => ZEBRA && tx >= 0 && ty >= 0 && tx < W && ty < H ? ZEBRA[ty * W + tx] : -1;

/** can a pedestrian stand on this tile (roads only on a zebra, bridges only footbridges) */
export function pedTile(c: City, tx: number, ty: number) {
  if (tx < 0 || ty < 0 || tx >= W || ty >= H) return false;
  zebras(c);
  const i = ty * W + tx, g = c.ground[i];
  if (c.solid[i] !== S.OPEN) return false;
  // (the twenty-first pass) nobody strolls the Southern Islands' reef flats at night, or on Pulau Satumu, the lighthouse's
  // own rock
  if (g === G.REEF) return false;
  const q = c.islands?.quiet; if (q && tx >= q[0] && ty >= q[1] && tx <= q[2] && ty <= q[3]) return false;
  // (the twenty-fourth pass) nobody strolls among Sungei Buloh's crocodiles, and the Kranji War Memorial is left quiet
  if (g === G.MUDFLAT) return false;
  const k = c.kranji?.quiet; if (k && tx >= k[0] && ty >= k[1] && tx <= k[2] && ty <= k[3]) return false;
  if (g === G.ROAD) return ZEBRA![i] >= 0;
  if (g === G.BRIDGE) return (c.flags[i] & F_BRIDGE) > 0 && (c.flags[i] & F_ALLEY) > 0;
  return true;
}

// ── destinations
type Dest = { x: number; y: number; tx: number; ty: number; kind: 'door' | 'stall' | 'seat' | 'bench' };
let DESTS: Dest[] | null = null;
export function dests(c: City): Dest[] {
  if (DESTS) return DESTS;
  const out: Dest[] = [];
  const add = (tx: number, ty: number, kind: Dest['kind'], x = tx * T + T / 2, y = ty * T + T / 2) => { if (pedTile(c, tx, ty) && c.ground[ty * W + tx] !== G.ROAD) out.push({ x, y, tx, ty, kind }); };
  for (const b of c.buildings) if (b.front && !b.roof && (b.x * 7 + b.y * 3) % 4 === 0) add(b.x + 1, b.y + b.h, 'door');
  for (const p of c.props) {
    const tx = Math.floor(p.x / T), ty = Math.floor(p.y / T);
    if (p.sprite.startsWith('stall')) add(tx, ty + 1, 'stall', p.x, (ty + 1) * T + 18);
    else if (p.sprite === 'table') { add(tx - 1, ty, 'seat', p.x - 34, p.y + 4); add(tx + 1, ty, 'seat', p.x + 34, p.y + 4); }
    else if (p.sprite === 'bench' || p.sprite === 'plaza-bench') add(tx, ty + 1, 'bench');
  }
  DESTS = out; return out;
}

// ── flow fields to a destination over pedestrian tiles (4-way, cached)
const fields = new Map<string, Int32Array>();
function pedField(w: World, d: number): Int32Array {
  const D = dests(w.c)[d]; const key = d + ':' + [...w.open].join();
  let f = fields.get(key); if (f) return f;
  f = new Int32Array(W * H).fill(-1);
  const q = new Int32Array(W * H); let h = 0, t = 0;
  f[D.ty * W + D.tx] = 0; q[t++] = D.ty * W + D.tx;
  while (h < t) {
    const i = q[h++], x = i % W, y = (i - x) / W;
    // townsfolk pick places within 26 tiles, so the search stops well past that (the island made whole-city searches costly)
    if (f[i] >= 64) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy; if (!pedTile(w.c, nx, ny) || !w.open.has(districtAt(nx, ny))) continue;
      const j = ny * W + nx; if (f[j] >= 0) continue;
      // a crossing is entered and left straight across the road, never along it
      if (ZEBRA![j] >= 0 && ZEBRA![i] >= 0 && (ROADS[ZEBRA![j]].axis === 'h' ? dy === 0 : dx === 0)) continue;
      f[j] = f[i] + 1; q[t++] = j;
    }
  }
  fields.set(key, f); if (fields.size > 70) fields.delete(fields.keys().next().value!);
  return f;
}

/** may a pedestrian step onto this crossing tile now? */
function mayCross(w: World, tx: number, ty: number) {
  const ri = ZEBRA![ty * W + tx]; if (ri < 0) return true;
  const li = ZLIGHT![ty * W + tx];
  if (li >= 0) return lightOf(w, li, ROADS[ri].axis) === 'red';
  const px = tx * T + T / 2, py = ty * T + T / 2;
  return !w.cars.some(c => c.r === ri && dist(c.x, c.y, px, py) < 240 && ((ROADS[ri].axis === 'h' ? px - c.x : py - c.y) * c.d > -40));
}

function choose(w: World, pd: Ped) {
  const all = dests(w.c); if (!all.length) return;
  if (w.crowd && dist(w.crowd.x, w.crowd.y, pd.x, pd.y) < 520 && w.R() < 0.7) { pd.dest = -1; pd.watch = true; return; }
  pd.watch = false;
  for (let k = 0; k < 8; k++) {
    const i = Math.floor(w.R() * all.length), d = all[i];
    if (i === pd.dest || dist(d.x, d.y, pd.x, pd.y) > 26 * T || !w.open.has(districtAt(d.tx, d.ty))) continue;
    if (d.kind === 'seat' && w.peds.some(o => o.dest === i)) continue;
    const f = pedField(w, i); if (f[Math.floor(pd.y / T) * W + Math.floor(pd.x / T)] < 0) continue;
    pd.dest = i; return;
  }
  pd.dest = -1; pd.wait = 1 + w.R() * 2;
}

export function pedStep(w: World, dt: number) {
  const px = w.p.x, py = w.p.y;
  if (w.peds.length < MAX_PEDS && w.tick % 6 === 3) {
    const a = w.R() * Math.PI * 2, d = 600 + w.R() * 550;
    const tx = Math.floor((px + Math.cos(a) * d) / T), ty = Math.floor((py + Math.sin(a) * d) / T);
    if (pedTile(w.c, tx, ty) && zebraAt(tx, ty) < 0 && w.open.has(districtAt(tx, ty))) {
      const pd: Ped = { id: w.nextId++, sp: folkAt(tx, ty)[Math.floor(w.R() * folkAt(tx, ty).length)], x: tx * T + T / 2, y: ty * T + T / 2, h: 0, tx, ty, hop: 0, hx: 0, hy: 0, scare: 0, wait: 0, walk: w.R() * 9, dest: -1, sit: 0, roadT: 0, watch: false };
      choose(w, pd); w.peds.push(pd);
    }
  }
  const pv = w.p.ride ? w.p.ride.b : w.p.b;
  const fast = pv.speed > 90 || w.p.dashT > 0;
  const all = dests(w.c);
  for (const pd of w.peds) {
    const ctx = Math.floor(pd.x / T), cty = Math.floor(pd.y / T);
    pd.roadT = w.c.ground[cty * W + ctx] === G.ROAD ? pd.roadT + dt : 0;
    if (pd.splatT) { pd.splatT = Math.max(0, pd.splatT - dt); if (!pd.splatT) pd.splat = ''; }
    if (pd.hop > 0) {
      pd.hop -= dt; const k = dt / 0.42;
      const nx = pd.x + pd.hx * k, ny = pd.y + pd.hy * k;
      if (pedTile(w.c, Math.floor(nx / T), Math.floor(ny / T))) { pd.x = nx; pd.y = ny; }
      continue;
    }
    // something fast coming? hop sideways out of its path (onto somewhere a walker may stand)
    const dx = pd.x - pv.x, dy = pd.y - pv.y, dd = Math.hypot(dx, dy);
    const toward = dd > 1 ? (Math.cos(pv.h) * dx + Math.sin(pv.h) * dy) / dd : 0;
    if (!w.p.roof && ((fast && dd < 120 && toward > 0.4) || (pd.scare > 0 && dd < 240) || dd < pv.r + 12)) {
      pd.scare = 0; pd.sit = 0;
      const side = Math.sign(Math.cos(pv.h) * dy - Math.sin(pv.h) * dx) || 1;
      let hx = -Math.sin(pv.h) * side * 62, hy = Math.cos(pv.h) * side * 62;
      const ok = (x: number, y: number) => pedTile(w.c, Math.floor(x / T), Math.floor(y / T));
      if (!ok(pd.x + hx, pd.y + hy)) { hx = -hx; hy = -hy; }
      if (!ok(pd.x + hx, pd.y + hy)) { hx = 0; hy = 0; }
      pd.hop = 0.42; pd.hx = hx; pd.hy = hy; w.fx.push({ t: 'ped-hop', x: pd.x, y: pd.y });
      continue;
    }
    if (pd.sit > 0) { pd.sit -= dt; pd.walk += dt; if (pd.sit <= 0) choose(w, pd); continue; }
    if (pd.wait > 0) { pd.wait -= dt; if (pd.wait <= 0 && pd.dest < 0 && !pd.watch) choose(w, pd); continue; }
    // the next tile toward the destination
    let gx: number, gy: number;
    if (pd.watch && w.crowd) {
      const a = (pd.id * 2.4) % (Math.PI * 2), r = 70 + (pd.id % 3) * 22;
      gx = w.crowd.x + Math.cos(a) * r; gy = w.crowd.y + 30 + Math.sin(a) * r * 0.6;
      if (dist(gx, gy, pd.x, pd.y) < 6) { pd.h = Math.atan2(w.crowd.y - pd.y, w.crowd.x - pd.x); pd.wait = 0.5; continue; }
      if (!pedTile(w.c, Math.floor(gx / T), Math.floor(gy / T)) || dist(gx, gy, pd.x, pd.y) > 3 * T) { const [ax, ay] = toward2(w, pd, w.crowd.x, w.crowd.y); gx = ax; gy = ay; }
    } else if (pd.dest >= 0) {
      const d = all[pd.dest];
      if (ctx === d.tx && cty === d.ty) {
        gx = d.x; gy = d.y;
        if (dist(gx, gy, pd.x, pd.y) < 3) {
          if (d.kind === 'seat') { pd.sit = 8 + w.R() * 10; pd.h = Math.PI / 2; }
          else { pd.wait = 1.5 + w.R() * 3; pd.h = d.kind === 'door' ? -Math.PI / 2 : Math.PI / 2; }
          pd.dest = -1; continue;
        }
      } else {
        const f = pedField(w, pd.dest); let best = f[cty * W + ctx], bx = ctx, by = cty;
        if (best < 0) { const [ax, ay] = nearestPed(w, pd); bx = ax; by = ay; }
        else for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const v = f[(cty + oy) * W + ctx + ox]; if (cty + oy >= 0 && cty + oy < H && v >= 0 && v < best) { best = v; bx = ctx + ox; by = cty + oy; } }
        if (bx === ctx && by === cty && best !== 0) { choose(w, pd); continue; }
        // a crossing: wait at the kerb until it is safe
        if (zebraAt(bx, by) >= 0 && zebraAt(ctx, cty) < 0 && !mayCross(w, bx, by)) { pd.h = Math.atan2(by - cty, bx - ctx); pd.walk = 0; continue; }
        gx = bx * T + T / 2; gy = by * T + T / 2;
        // keep to the middle of a tile's lane but cut corners smoothly
        if (bx === ctx) gx = pd.x + (gx - pd.x) * 0.2; if (by === cty) gy = pd.y + (gy - pd.y) * 0.2;
      }
    } else { pd.wait = 0.5; choose(w, pd); continue; }
    const ex = gx - pd.x, ey = gy - pd.y, el = Math.hypot(ex, ey);
    if (el < 0.5) continue;
    const sp = zebraAt(ctx, cty) >= 0 ? 74 : 52; pd.h = Math.atan2(ey, ex); pd.walk += dt;
    pd.x += ex / el * Math.min(el, sp * dt); pd.y += ey / el * Math.min(el, sp * dt);
  }
  w.peds = w.peds.filter(pd => dist(pd.x, pd.y, px, py) < 1500 || pd.roadT > 0);
}
function nearestPed(w: World, pd: Ped): [number, number] {
  const tx = Math.floor(pd.x / T), ty = Math.floor(pd.y / T);
  for (let r = 1; r < 4; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (pedTile(w.c, tx + dx, ty + dy) && zebraAt(tx + dx, ty + dy) < 0) return [tx + dx, ty + dy];
  return [tx, ty];
}
function toward2(w: World, pd: Ped, x: number, y: number): [number, number] {
  const tx = Math.floor(pd.x / T), ty = Math.floor(pd.y / T); let best: [number, number] = [pd.x, pd.y], bd = dist(pd.x, pd.y, x, y);
  for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { if (!pedTile(w.c, tx + ox, ty + oy) || zebraAt(tx + ox, ty + oy) >= 0) continue; const cx = (tx + ox) * T + T / 2, cy = (ty + oy) * T + T / 2, d = dist(cx, cy, x, y); if (d < bd) { bd = d; best = [cx, cy]; } }
  return best;
}
