// Jade Street: the layout table (lib/jade-layout.ts). The world is built in the old frame and each district's block is
// copied to where it is in Singapore. Three runs, two of them child processes (the table is read once, when the
// modules load):
// - the identity (tests/jade-zero.mjs): the old frame, left where it was built. Its hash pins the build;
// - the test shift (tests/jade-shift.mjs: every block +7 tiles east and +3 south): every place, parked ride, cast
//   member, story and side-job target, gig, business, boost wall, light and the boss's ladder moved by exactly that
//   much and kept its ground and district, and the whole map reads back through the table;
// - the real table (this process): block by block, every tile of every block is the identity's tile (ground, solid
//   and flags), and every placed thing moved with its block. The filler between the blocks (the seams: parkland, the
//   sea, the river's way to the harbour, the roads that join the districts) is checked too: every road's lanes are
//   road or bridge, and every light stands where its two roads cross.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { World, DT, NO_INPUT } from '../.checks/jade-game.js';
import { city, T, W, H, OLD_W, OLD_H, idx, districtAt, districtAtOld, ROADS, OLD_ROADS, CT_DISTRICTS, G } from '../.checks/jade-city.js';
import { LAYOUT_MODE, LAYOUT, NW, NH, mvT, mvP, unmvT, blockNew, blockOld, UNIFORM } from '../.checks/jade-layout.js';
import { MISSIONS, SIDE } from '../.checks/jade-story.js';
import { newSave } from '../.checks/jade-save.js';
import { castOf } from '../.checks/jade-cast.js';
import { GIG_DEFS } from '../.checks/jade-gigs.js';
import { BIZ } from '../.checks/jade-biz.js';
import { BOOSTS } from '../.checks/jade-tag.js';
import { LADDER, LEAP_SPOTS } from '../.checks/jade-boss.js';
import { LIGHTS } from '../.checks/jade-traffic.js';
import { NEW_RIDES } from '../.checks/jade-rides.js';

/** sha256 over the identity world's ground, solid and flags and the places' JSON. It was d4fb60f1 on origin/main
 * a779a06f, before the table existed; the real layout (19-11-2026) took out the two bridges from Kampong Glam over the
 * strait to Jurong and Tiong Bahru (the districts now join over land) and the Singapore River's mouth past Clarke
 * Quay's east edge (the river runs on through the seam), and those are the only changes to the build. The sixteenth
 * pass (20-11-2026) added two places, the ride-job givers `buaya` (Orchard) and `kerbau` (Clarke Quay); without them
 * the hash is still 2bf5685f, so the ground, solid and flags are untouched */
const ZERO_HASH = 'cd70127f2b1d5d08be17acf547a64a94216a64766a6ab86e5fab37dc187c2885';

const c = city();
const ti = (x, y) => [Math.floor(x / T), Math.floor(y / T)];
/** what stands at a tile: its ground and district */
const at = (tx, ty) => ({ tx, ty, g: c.ground[idx(tx, ty)], d: districtAt(tx, ty) });
const atP = (x, y) => ({ x, y, ...at(...ti(x, y)) });

/** every tile pair in a story step (cams and lookouts are [x, y, facing]; index fields like boost.at are plain numbers) */
function pairs(v, path, out) {
  if (Array.isArray(v)) {
    if (v.length >= 2 && v.length <= 3 && typeof v[0] === 'number' && typeof v[1] === 'number') { out.push([path, at(v[0], v[1])]); return; }
    v.forEach((x, i) => pairs(x, `${path}.${i}`, out)); return;
  }
  if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) pairs(x, `${path}.${k}`, out);
}

function facts() {
  const s = newSave(5); s.started = true; s.story.intro = true; s.story.ch = 10;
  s.done = [...MISSIONS.map(m => m.id), ...SIDE.map(m => m.id)];
  const w = new World(s, 5); w.quiet = true; w.talk = null; w.step(NO_INPUT, DT);
  const story = []; for (const m of [...MISSIONS, ...SIDE]) m.steps.forEach((st, i) => pairs(st, `${m.id}.${i}`, story));
  const h = createHash('sha256'); h.update(Buffer.from(c.ground)); h.update(Buffer.from(c.solid)); h.update(Buffer.from(c.flags)); h.update(JSON.stringify(c.places));
  // the map read back in old-frame order through the table: equal to the live map's layers when nothing is lost
  const back = (a) => { const o = new Uint8Array(OLD_W * OLD_H); for (let y = 0; y < OLD_H; y++) for (let x = 0; x < OLD_W; x++) o[y * OLD_W + x] = a[idx(...mvT(x, y))]; return createHash('sha256').update(Buffer.from(o)).digest('hex'); };
  return {
    mode: LAYOUT_MODE, hash: h.digest('hex'), W, H,
    back: { ground: back(c.ground), solid: back(c.solid), flags: back(c.flags) },
    places: Object.fromEntries(Object.entries(c.places).map(([id, p]) => [id, atP(p.x, p.y)])),
    parking: c.parking.map(p => atP(p.x, p.y)),
    rides: w.rides.map(r => ({ kind: r.kind, ...atP(r.b.x, r.b.y) })),
    cast: castOf(w).map(m => ({ id: m.id, ...atP(m.x, m.y) })),
    story: Object.fromEntries(story),
    gigs: GIG_DEFS.filter(g => typeof g.at !== 'string').map(g => ({ id: g.id, ...at(g.at[0], g.at[1]) })),
    biz: BIZ.map(b => ({ id: b.id, ...at(...b.at) })),
    boosts: BOOSTS.map(b => [at(...b.g), at(...b.r)]),
    boss: [LADDER, ...LEAP_SPOTS].map(p => at(...p)),
    lights: LIGHTS.map(l => at(l.tx, l.ty)),
    roads: ROADS.map((r, i) => ({ ...r, old: OLD_ROADS[i] })),
    layers: process.argv.includes('--layers') ? { ground: Buffer.from(c.ground).toString('base64'), solid: Buffer.from(c.solid).toString('base64'), flags: Buffer.from(c.flags).toString('base64') } : null,
  };
}

const self = fileURLToPath(import.meta.url);
/** the facts of a child process run under a preload that picks the table */
const child = (preload, ...args) => JSON.parse(execFileSync(process.execPath, ['--import', fileURLToPath(new URL(preload, import.meta.url)), self, '--child', ...args], { maxBuffer: 1 << 28 }).toString());
const KEYS = ['parking', 'rides', 'cast', 'gigs', 'biz', 'boss'];

if (process.argv.includes('--child')) {
  // a child: the identity or the shifted world. The checks that need no parent first, then the facts for the parent
  for (let y = 0; y < OLD_H; y++) for (let x = 0; x < OLD_W; x++) {
    const [nx, ny] = mvT(x, y);
    assert.deepEqual(unmvT(nx, ny), [x, y], `round trip ${x},${y}`);
    assert.equal(districtAt(nx, ny), districtAtOld(x, y), `district at ${x},${y}`);
  }
  if (LAYOUT_MODE === 'zero') { assert.equal(W, OLD_W); assert.equal(H, OLD_H); assert.equal(NW, 376); assert.equal(NH, 128); }
  else {
    assert.equal(LAYOUT_MODE, 'shift'); assert.ok(UNIFORM);
    // the filler strip the shift opens on the west and north is open sea, off every block
    for (let y = 0; y < H; y++) for (let x = 0; x < 7; x++) { assert.equal(blockNew(x, y), null); assert.equal(unmvT(x, y), null); }
    for (let x = 0; x < W; x++) for (let y = 0; y < 3; y++) assert.equal(blockNew(x, y), null);
  }
  process.stdout.write(JSON.stringify(facts()));
} else {
  assert.equal(LAYOUT_MODE, 'real');
  const z = child('./jade-zero.mjs', '--layers'), sh = child('./jade-shift.mjs');
  assert.equal(z.mode, 'zero'); assert.equal(sh.mode, 'shift');
  assert.equal(z.hash, ZERO_HASH, 'identity layout: ground, solid, flags and places as pinned');

  // ── the shift: everything moved by exactly +7, +3 and kept its ground and district
  assert.notEqual(sh.hash, z.hash, 'the shift moves the world');
  assert.equal(sh.W, OLD_W + 7); assert.equal(sh.H, OLD_H + 3);
  assert.deepEqual(sh.back, z.back, 'shift: every old tile keeps its ground, solid and flags');
  let n = 0;
  const same = (a, b, what) => {
    assert.ok(a && b, `${what}: present in both`);
    assert.equal(b.tx - a.tx, 7, `${what}: moved 7 east`); assert.equal(b.ty - a.ty, 3, `${what}: moved 3 south`);
    if (a.x !== undefined) { assert.equal(b.x - a.x, 7 * T, `${what}: x`); assert.equal(b.y - a.y, 3 * T, `${what}: y`); }
    assert.equal(b.g, a.g, `${what}: same ground`); assert.equal(b.d, a.d, `${what}: same district`); n++;
  };
  for (const id of Object.keys(z.places)) same(z.places[id], sh.places[id], `place ${id}`);
  assert.equal(Object.keys(sh.places).length, Object.keys(z.places).length);
  for (const k of [...KEYS, 'lights']) {
    assert.equal(sh[k].length, z[k].length, `${k}: same count`);
    z[k].forEach((a, i) => same(a, sh[k][i], `${k} ${a.id ?? a.kind ?? i}`));
  }
  z.boosts.forEach((b, i) => { same(b[0], sh.boosts[i][0], `boost ${i} street`); same(b[1], sh.boosts[i][1], `boost ${i} roof`); });
  assert.deepEqual(Object.keys(sh.story), Object.keys(z.story), 'story: the same targets');
  for (const k of Object.keys(z.story)) same(z.story[k], sh.story[k], `story ${k}`);
  z.roads.forEach((r, i) => { const s = sh.roads[i]; assert.equal(s.axis, r.axis); assert.equal(s.at - r.at, r.axis === 'h' ? 3 : 7, `road ${i}`); assert.equal(s.from - r.from, r.axis === 'h' ? 7 : 3, `road ${i} from`); });

  // ── the real table, block by block: every tile of every block is the identity's tile
  const zl = Object.fromEntries(Object.entries(z.layers).map(([k, v]) => [k, Buffer.from(v, 'base64')]));
  const blocks = Object.fromEntries(LAYOUT.blocks.map(b => [b.id, 0]));
  for (let y = 0; y < OLD_H; y++) for (let x = 0; x < OLD_W; x++) {
    const b = blockOld(x, y), [nx, ny] = mvT(x, y), o = y * OLD_W + x, i = idx(nx, ny);
    if (nx - x !== b.nx - b.x0 || ny - y !== b.ny - b.y0 || blockNew(nx, ny) !== b) assert.fail(`${x},${y} does not move with block ${b.id}`);
    if (c.ground[i] !== zl.ground[o] || c.solid[i] !== zl.solid[o] || c.flags[i] !== zl.flags[o]) assert.fail(`block ${b.id}: old ${x},${y} (new ${nx},${ny}) is not the identity's tile`);
    blocks[b.id]++;
  }
  // every old tile lands on a new tile of its own (no block covers another); the rest of the new frame is seam
  let seam = 0; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!unmvT(x, y)) seam++;
  assert.equal(seam, W * H - OLD_W * OLD_H, 'the blocks tile the old frame once over');
  // a placed thing moved with its block onto the same ground; its district is the identity's, but for the main block's
  // tiles that were Orchard Road's or the south strip's (now Katong's estates and Sentosa's sea), and for a moved block,
  // which is its own district throughout (Tiong Bahru's last two columns were built as Clarke Quay's)
  const REMAP = { orchard: 'katong', jurong: 'resort', tiong: 'resort', quay: 'resort' };
  let m = 0;
  const moved = (a, b, what) => {
    assert.ok(a && b, `${what}: present in both`);
    assert.deepEqual([b.tx, b.ty], mvT(a.tx, a.ty), `${what}: moved with its block`);
    if (a.x !== undefined) assert.deepEqual([b.x, b.y], mvP(a.x, a.y), `${what}: x, y`);
    assert.equal(b.g, a.g, `${what}: same ground`);
    const bo = blockOld(a.tx, a.ty).id;
    assert.ok(b.d === a.d || (bo === 'main' ? b.d === REMAP[a.d] : b.d === bo), `${what}: district ${a.d} -> ${b.d}`); m++;
  };
  const r = facts();
  for (const id of Object.keys(z.places)) moved(z.places[id], r.places[id], `place ${id}`);
  for (const k of KEYS) {
    // the fifteenth pass's special rides are parked last of all, after the seams' (lib/jade-rides.ts): matched end to end
    const nNew = k === 'parking' || k === 'rides' ? NEW_RIDES.length : 0, zk = z[k].slice(0, z[k].length - nNew), rk = r[k].slice(0, r[k].length - nNew);
    zk.forEach((a, i) => moved(a, rk[i], `${k} ${a.id ?? a.kind ?? i}`));
    // the seams' own kerbside parking (and the rides parked there) come after the build's, on seam tiles
    if (nNew) {
      rk.slice(zk.length).forEach((b, i) => assert.equal(unmvT(b.tx, b.ty), null, `${k} ${zk.length + i} on a seam`));
      z[k].slice(-nNew).forEach((a, i) => { const b = r[k][r[k].length - nNew + i]; assert.equal(a.kind ?? NEW_RIDES[i].kind, NEW_RIDES[i].kind); moved(a, b, `${k} ${NEW_RIDES[i].kind}`); });
    } else assert.equal(r[k].length, z[k].length, `${k}: same count`);
  }
  z.boosts.forEach((b, i) => { moved(b[0], r.boosts[i][0], `boost ${i} street`); moved(b[1], r.boosts[i][1], `boost ${i} roof`); });
  assert.deepEqual(Object.keys(r.story), Object.keys(z.story), 'story: the same targets');
  for (const k of Object.keys(z.story)) moved(z.story[k], r.story[k], `story ${k}`);
  // Chinatown's lights keep their numbers and tiles (the others are read off the world's roads)
  z.lights.forEach((a, i) => { if (CT_DISTRICTS.includes(a.d)) moved(a, r.lights[i], `light ${i}`); });

  // ── the seams: every road's lanes are lanes (road, or a bridge over water), every light stands at the corner where its
  // two roads' lanes cross
  const lane = new Set([G.ROAD, G.BRIDGE]);
  ROADS.forEach((rd, i) => { for (let s = rd.from; s <= rd.to; s++) for (const k of [1, 2]) {
    const [x, y] = rd.axis === 'h' ? [s, rd.at + k] : [rd.at + k, s];
    if (!lane.has(c.ground[idx(x, y)])) assert.fail(`road ${i}: lane tile ${x},${y} is ground ${c.ground[idx(x, y)]}`);
  } });
  const on = (rd, x, y) => rd.axis === 'h' ? y >= rd.at && y < rd.at + 4 && x >= rd.from && x <= rd.to : x >= rd.at && x < rd.at + 4 && y >= rd.from && y <= rd.to;
  LIGHTS.forEach((l, i) => { assert.ok(on(ROADS[l.h], l.tx, l.ty) && on(ROADS[l.v], l.tx, l.ty), `light ${i} on roads ${l.h} and ${l.v}`); assert.equal(c.ground[idx(l.tx + 1, l.ty + 1)], G.ROAD, `light ${i}: a crossing of lanes`); });
  console.log(`jade layout: identity pinned (${z.hash.slice(0, 12)}); shift moved ${n} targets and kept every tile; real table: ${Object.entries(blocks).map(([k, v]) => `${k} ${v}`).join(', ')} tiles as built, ${m} targets moved with their blocks, ${seam} seam tiles, ${ROADS.length} roads laid, ${LIGHTS.length} lights on crossings`);
}
