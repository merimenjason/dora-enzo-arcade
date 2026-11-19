// Jade Street: the layout table (lib/jade-layout.ts). With the live table (the identity) the world is byte for byte
// the world before the table existed: a hash of the ground, solid and flag layers and the places matches the one taken
// from origin/main (a779a06f) before the change. Then the same facts are gathered again in a child process under the
// test shift (tests/jade-shift.mjs: every block +7 tiles east and +3 south), and every one must have moved by exactly
// that much and kept its ground and district: each place, parked ride, cast member, story and side-job target, gig,
// business, boost wall and the boss's ladder, and the whole map read back through the table.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { World, DT, NO_INPUT } from '../.checks/jade-game.js';
import { city, T, W, H, OLD_W, OLD_H, idx, districtAt, districtAtOld, ROADS, OLD_ROADS } from '../.checks/jade-city.js';
import { LAYOUT_MODE, NW, NH, mvT, unmvT, blockNew, UNIFORM } from '../.checks/jade-layout.js';
import { MISSIONS, SIDE } from '../.checks/jade-story.js';
import { newSave } from '../.checks/jade-save.js';
import { castOf } from '../.checks/jade-cast.js';
import { GIG_DEFS } from '../.checks/jade-gigs.js';
import { BIZ } from '../.checks/jade-biz.js';
import { BOOSTS } from '../.checks/jade-tag.js';
import { LADDER, LEAP_SPOTS } from '../.checks/jade-boss.js';
import { LIGHTS } from '../.checks/jade-traffic.js';

/** sha256 over ground, solid and flags and the places' JSON, taken on origin/main a779a06f before the table existed */
const MAIN_HASH = 'd4fb60f13b6f26c211e019112112d94360a2e648ea6ae6e720f707b3907bbf69';

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
  };
}

const self = fileURLToPath(import.meta.url);
if (LAYOUT_MODE === 'zero') {
  const z = facts();
  // the identity table: the world is the world before the table, and every frame is the same frame
  assert.equal(z.hash, MAIN_HASH, 'zero layout: ground, solid, flags and places as on origin/main');
  assert.equal(W, OLD_W); assert.equal(H, OLD_H); assert.equal(NW, 376); assert.equal(NH, 128);
  for (let y = 0; y < H; y += 3) for (let x = 0; x < W; x += 3) { assert.deepEqual(mvT(x, y), [x, y]); assert.deepEqual(unmvT(x, y), [x, y]); assert.equal(districtAt(x, y), districtAtOld(x, y)); }
  // the shifted world, in a child process (the table is read once, when the modules load)
  const out = execFileSync(process.execPath, ['--import', fileURLToPath(new URL('./jade-shift.mjs', import.meta.url)), self, '--child'], { maxBuffer: 1 << 28 }).toString();
  const sh = JSON.parse(out);
  assert.equal(sh.mode, 'shift');
  assert.notEqual(sh.hash, MAIN_HASH, 'the shift moves the world');
  assert.equal(sh.W, OLD_W + 7); assert.equal(sh.H, OLD_H + 3);
  // the whole map, read back through the table, is the same map
  assert.deepEqual(sh.back, z.back, 'shift: every old tile keeps its ground, solid and flags');
  // every placed thing moved by exactly the shift and stands on the same ground in the same district
  let n = 0;
  const same = (a, b, what) => {
    assert.ok(a && b, `${what}: present in both`);
    assert.equal(b.tx - a.tx, 7, `${what}: moved 7 east`); assert.equal(b.ty - a.ty, 3, `${what}: moved 3 south`);
    if (a.x !== undefined) { assert.equal(b.x - a.x, 7 * T, `${what}: x`); assert.equal(b.y - a.y, 3 * T, `${what}: y`); }
    assert.equal(b.g, a.g, `${what}: same ground`); assert.equal(b.d, a.d, `${what}: same district`); n++;
  };
  for (const id of Object.keys(z.places)) same(z.places[id], sh.places[id], `place ${id}`);
  assert.equal(Object.keys(sh.places).length, Object.keys(z.places).length);
  for (const k of ['parking', 'rides', 'cast', 'gigs', 'biz', 'boss', 'lights']) {
    assert.equal(sh[k].length, z[k].length, `${k}: same count`);
    z[k].forEach((a, i) => same(a, sh[k][i], `${k} ${a.id ?? a.kind ?? i}`));
  }
  z.boosts.forEach((b, i) => { same(b[0], sh.boosts[i][0], `boost ${i} street`); same(b[1], sh.boosts[i][1], `boost ${i} roof`); });
  assert.deepEqual(Object.keys(sh.story), Object.keys(z.story), 'story: the same targets');
  for (const k of Object.keys(z.story)) same(z.story[k], sh.story[k], `story ${k}`);
  // roads keep their index; each moves by the shift along its own axis
  z.roads.forEach((r, i) => { const s = sh.roads[i]; assert.equal(s.axis, r.axis); assert.equal(s.at - r.at, r.axis === 'h' ? 3 : 7, `road ${i}`); assert.equal(s.from - r.from, r.axis === 'h' ? 7 : 3, `road ${i} from`); });
  console.log(`jade layout: zero table matches origin/main (${MAIN_HASH.slice(0, 12)}); shift moved ${n} targets, ${Object.keys(z.story).length} of them story spots, and kept every tile`);
} else {
  // the child: the shifted world. Checks that need no parent first, then the facts for the parent to compare
  assert.ok(UNIFORM);
  for (let y = 0; y < OLD_H; y++) for (let x = 0; x < OLD_W; x++) {
    const [nx, ny] = mvT(x, y);
    assert.deepEqual(unmvT(nx, ny), [x, y], `round trip ${x},${y}`);
    assert.equal(districtAt(nx, ny), districtAtOld(x, y), `district at ${x},${y}`);
  }
  // the filler strip the shift opens on the west and north is open sea, off every block
  for (let y = 0; y < H; y++) for (let x = 0; x < 7; x++) { assert.equal(blockNew(x, y), null); assert.equal(unmvT(x, y), null); }
  for (let x = 0; x < W; x++) for (let y = 0; y < 3; y++) assert.equal(blockNew(x, y), null);
  if (process.argv.includes('--child')) process.stdout.write(JSON.stringify(facts()));
  else console.log('jade layout (shifted run): every old tile round-trips through the table and keeps its district');
}
