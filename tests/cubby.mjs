// Cubby Valley engine checks: the valley grows the same from a seed (and differently from another), with its cubby,
// stump, cave, crystals and recipe leaves; chunk meshing (exact face counts, greedy merging, outward winding, no
// missing faces against a brute-force count); the picking ray; walking, bumping, hopping up steps, ladders and water;
// digging (hard blocks take time, the trowel is faster), placing, sand falling and water flowing; the bag, the loom and
// recipes; burrow checks (shut in, door, light, bed, the neighbour's item, taken); the errands; saplings; the night's
// creatures (spawn rules, light keeping them away, Cosy nights and creative with none, every behaviour, doors stopping
// them, hearts, knock-outs, drops, stolen things returned); the light; and the save, corrupt saves included.
import assert from 'node:assert/strict';
import {
  CubbyGame, readSave, readSlot, freshSave, moveBody, makeBody, findPath, standable, SAVE_KEY, MAX_HP, DAY, NO_INPUT,
} from '../.checks/cubby-game.js';
import {
  World, generate, checkBurrow, encodeDiff, decodeDiff, BLOCKS, BLOCK_BY_KEY as BK, W, D, H, N, idx, toB64, fromB64,
} from '../.checks/cubby-world.js';
import { RECIPES, NEIGHBOURS, CRITTERS, ITEMS, cosyIns } from '../.checks/cubby-content.js';
import { meshChunk } from '../.checks/cubby-mesh.js';
import { chinchilla, neighbour, critter, prop, item, meshPart, PROP_KEYS, ITEM_MODELS } from '../.checks/cubby-models.js';

let n = 0;
const test = (name, f) => { try { f(); n++; } catch (e) { console.error('FAILED:', name); throw e; } };
const S = 777;
const base = new CubbyGame(S);
/** A fresh game on the shared valley (generation is the slow part). */
const fresh = (o = {}) => new CubbyGame(S, o, { ...base.valley, blocks: base.valley.blocks.slice() });
/** An empty world (air everywhere, deepstone floor) for exact geometry checks. */
const empty = () => { const b = new Uint8Array(N); return new World({ blocks: b }); };
const hashOf = (a) => { let h = 2166136261; for (let i = 0; i < a.length; i++) { h ^= a[i]; h = Math.imul(h, 16777619); } return h >>> 0; };
/** A flat test floor in an otherwise empty world, for the physics and creatures. */
function flat(y0 = 10) {
  const g = fresh();
  const w = g.world;
  for (let y = 1; y < H; y++) for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) w.blocks[idx(x, y, z)] = y <= y0 ? BK.stone : BK.air;
  w.relight(0, W - 1, 0, D - 1);
  for (const p of g.players) { p.x = 48.5; p.y = y0 + 1; p.z = 48.5; p.vx = p.vy = p.vz = 0; }
  g.critters = []; g.npcs = []; g.pickups = [];
  return g;
}
const run = (g, s, inp = NO_INPUT) => { for (let t = 0; t < s; t += 1 / 30) g.step(1 / 30, { ...NO_INPUT, ...inp, yaw: inp.yaw ?? g.me.yaw, pitch: inp.pitch ?? g.me.pitch }); };

test('the valley grows the same from the same seed, and differently from another', () => {
  const a = generate(S), b = generate(S), c = generate(S + 1);
  assert.equal(hashOf(a.blocks), hashOf(b.blocks));
  assert.notEqual(hashOf(a.blocks), hashOf(c.blocks));
  assert.deepEqual(a.leaves, b.leaves);
  assert.equal(a.blocks.length, W * D * H);
});

test('every valley has its cubby, stump, cave, crystals, iron, clay and twelve reachable-looking leaves', () => {
  for (const seed of [1, 2, 3, 99, 2024]) {
    const v = generate(seed), w = new World(v);
    assert.equal(w.get(v.homeBed.x, v.homeBed.y, v.homeBed.z), BK.bed, `seed ${seed}: the bed`);
    assert.equal(w.get(v.stump.x, v.stump.y, v.stump.z), BK.stump);
    assert.equal(v.leaves.length, 12, `seed ${seed}: twelve leaves`);
    assert.equal(new Set(v.leaves.map((l) => l.recipe)).size, 12);
    for (const l of v.leaves) {
      assert.ok(BLOCKS[w.get(l.x, l.y, l.z)].shape !== 'cube' && BLOCKS[w.get(l.x, l.y - 1, l.z)].solid, `seed ${seed}: leaf ${l.recipe} sits on ground`);
      assert.ok(RECIPES.some((r) => r.id === l.recipe && r.from === 'leaf'));
    }
    const count = (k) => { let c = 0; for (const b of v.blocks) if ((b & 63) === BK[k]) c++; return c; };
    assert.ok(count('crystal') >= 6, `seed ${seed}: crystals (${count('crystal')})`);
    for (const k of ['ironstone', 'clay', 'sand', 'pebbles', 'log', 'berrybush', 'cotton', 'daisy', 'bluebell', 'tallgrass', 'chalk', 'water']) assert.ok(count(k) > 5, `seed ${seed}: some ${k}`);
    assert.ok(standable(w, v.start.x, v.start.y, v.start.z), `seed ${seed}: the start is standable`);
  }
});

test('meshing: one cube has six faces; two side by side merge into six quads with ten faces', () => {
  const w = empty();
  w.blocks[idx(5, 5, 5)] = BK.stone; w.relight(0, W - 1, 0, D - 1);
  let m = meshChunk(w, 0, 0, 0);
  assert.equal(m.faces, 6); assert.equal(m.quads, 6); assert.equal(m.solid.index.length, 36);
  w.blocks[idx(6, 5, 5)] = BK.stone; w.relight(0, W - 1, 0, D - 1);
  m = meshChunk(w, 0, 0, 0);
  assert.equal(m.faces, 10); assert.equal(m.quads, 6, 'greedy merge');
});

test('meshing: a 16×16 slab is one quad on top; faces between chunks are not lost or doubled', () => {
  const w = empty();
  for (let z = 32; z < 64; z++) for (let x = 32; x < 64; x++) w.blocks[idx(x, 20, z)] = BK.stone;
  w.relight(0, W - 1, 0, D - 1);
  let faces = 0, topQuads = 0;
  for (let cz = 2; cz < 4; cz++) for (let cx = 2; cx < 4; cx++) {
    const m = meshChunk(w, cx, 1, cz); faces += m.faces;
    const q = m.solid; for (let i = 0; i < q.index.length; i += 6) { const a = q.index[i]; if (Math.abs(q.pos[a * 3 + 1] - 21) < 1e-6 && q.pos[q.index[i + 1] * 3 + 1] === 21 && q.pos[q.index[i + 2] * 3 + 1] === 21) topQuads++; }
  }
  assert.equal(faces, 32 * 32 * 2 + 32 * 4, 'top, bottom and the rim');
  assert.equal(topQuads, 4, 'one top quad per chunk');
});

test('meshing the real valley: every exposed face is drawn exactly once, all wound outward', () => {
  const w = base.world;
  let brute = 0, drawn = 0, outward = 0, total = 0;
  for (let cy = 0; cy < 2; cy++) for (let cz = 2; cz < 4; cz++) for (let cx = 2; cx < 4; cx++) {
    const m = meshChunk(w, cx, cy, cz);
    for (const q of [m.solid]) {
      for (let i = 0; i < q.index.length; i += 3) {
        if (q.tile[q.index[i]] < 0) continue;
        const [a, b, c] = [q.index[i], q.index[i + 1], q.index[i + 2]].map((k) => [q.pos[k * 3], q.pos[k * 3 + 1], q.pos[k * 3 + 2]]);
        const e1 = a.map((v, k) => b[k] - v), e2 = a.map((v, k) => c[k] - v);
        const nrm = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
        // the triangle's centre nudged along its normal must be in an empty cell
        const ctr = [0, 1, 2].map((k) => (a[k] + b[k] + c[k]) / 3), l = Math.hypot(...nrm);
        const p = ctr.map((v, k) => Math.floor(v + (nrm[k] / l) * 0.01));
        total++; if (!BLOCKS[w.get(p[0], p[1], p[2])].opaque) outward++;
      }
    }
    for (let y = cy * 16; y < cy * 16 + 16; y++) for (let z = cz * 16; z < cz * 16 + 16; z++) for (let x = cx * 16; x < cx * 16 + 16; x++) {
      const d = BLOCKS[w.get(x, y, z)]; if (d.shape !== 'cube' || !d.opaque) continue;
      for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) if (!BLOCKS[w.get(x + dx, y + dy, z + dz)].opaque) brute++;
    }
    // count the solid-cube unit faces the mesher covered (its merged quads' areas)
    const q = m.solid;
    for (let i = 0; i < q.index.length; i += 6) {
      if (q.tile[q.index[i]] < 0) continue;
      const k = [q.index[i], q.index[i + 1], q.index[i + 2], q.index[i + 5]];
      const xs = k.map((j) => q.pos[j * 3]), ys = k.map((j) => q.pos[j * 3 + 1]), zs = k.map((j) => q.pos[j * 3 + 2]);
      const sx = Math.max(...xs) - Math.min(...xs), sy = Math.max(...ys) - Math.min(...ys), sz = Math.max(...zs) - Math.min(...zs);
      drawn += Math.round((sx || 1) * (sy || 1) * (sz || 1));
    }
  }
  assert.equal(drawn, brute, 'no missing or doubled faces');
  assert.equal(outward, total, 'every triangle faces out of the solid');
});

test('the voxel models mesh, and Dora and Enzo have nothing on top of the head but the ears', () => {
  for (const who of ['dora', 'enzo']) {
    const m = chinchilla(who), head = m.parts.find((p) => p.name === 'head');
    let top = -99; for (const k of head.vox.cells.keys()) top = Math.max(top, ((k >> 8) & 255) - 128);
    assert.ok(top <= 13, `${who}: a smooth crown`);
    const ears = m.parts.filter((p) => p.name.startsWith('ear'));
    for (const e of ears) for (const k of e.vox.cells.keys()) assert.ok(Math.abs((k & 255) - 128 + 0.5) >= 1.5, `${who}: ears sit at the sides`);
    for (const p of m.parts) assert.ok(meshPart(m, p).index.length > 0 || p.vox.cells.size === 0);
  }
  assert.ok(Object.values(chinchilla('dora').colours).includes('#b3132e'), 'Dora’s ruby eyes');
  assert.equal(chinchilla('enzo').colours.eye, '#141519', 'Enzo’s black eyes');
  for (const id of NEIGHBOURS.map((x) => x.id)) assert.ok(neighbour(id).parts[0].vox.cells.size > 50);
  for (const k of Object.keys(CRITTERS)) assert.ok(critter(k).parts[0].vox.cells.size > 30, k);
  for (const k of PROP_KEYS) assert.ok(prop(k), k);
  for (const k of ITEM_MODELS) assert.ok(item(k), k);
});

test('the picking ray finds the first block and the face it hit, within reach', () => {
  const w = empty();
  w.blocks[idx(10, 5, 10)] = BK.stone;
  const h = w.raycast(10.5, 5.5, 14.5, 0, 0, -1, 5);
  assert.deepEqual([h.x, h.y, h.z, h.nx, h.ny, h.nz], [10, 5, 10, 0, 0, 1]);
  assert.equal(w.raycast(10.5, 5.5, 18.5, 0, 0, -1, 5), null, 'out of reach');
  const top = w.raycast(10.5, 8.5, 10.5, 0, -1, 0, 5);
  assert.deepEqual([top.ny], [1]);
  w.blocks[idx(10, 5, 12)] = BK.water;
  assert.equal(w.raycast(10.5, 5.5, 14.5, 0, 0, -1, 5).z, 10, 'the ray passes through water');
});

test('walking moves, walls stop, a one-block step is hopped, two blocks is not', () => {
  const g = flat();
  run(g, 1, { fwd: 1, yaw: 0 });
  assert.ok(g.me.z < 48.5 - 3, 'walked forward (yaw 0 is -z)');
  const z0 = Math.floor(g.me.z);
  for (let y = 11; y <= 13; y++) for (let x = 40; x < 56; x++) g.world.set(x, y, z0 - 3, BK.stone, 0, false);
  run(g, 2, { fwd: 1, yaw: 0 });
  assert.ok(g.me.z > z0 - 3 + 0.5, 'the wall stops us'); assert.ok(g.me.y < 11.5, 'and we can’t hop two blocks');
  const g2 = flat();
  for (let x = 40; x < 56; x++) for (let z = 30; z <= 45; z++) g2.world.set(x, 11, z, BK.stone, 0, false);
  run(g2, 2, { fwd: 1, yaw: 0 });
  assert.ok(g2.me.z < 45 && g2.me.y >= 12, 'a one-block step is hopped up automatically');
});

test('ladders climb, water swims, and doors let chinchillas through but stop creatures', () => {
  const g = flat();
  for (let y = 11; y <= 16; y++) { g.world.set(48, y, 47, BK.stone, 0, false); g.world.set(48, y, 48, BK.ladder, 0, false); }
  run(g, 2.5, { fwd: 1, yaw: 0 });
  assert.ok(g.me.y > 15, `climbed the ladder (${g.me.y.toFixed(1)})`);
  const g2 = flat();
  for (let z = 40; z < 50; z++) for (let x = 44; x < 53; x++) for (let y = 8; y <= 10; y++) g2.world.set(x, y, z, BK.water, 0, false);
  g2.me.y = 9; run(g2, 1.2, { jump: true });
  assert.ok(g2.me.y > 9.8, 'swims up');
  const w = g2.world, gd = flat();
  for (let x = 40; x < 56; x++) for (let y = 11; y <= 12; y++) gd.world.set(x, y, 46, BK.planks, 0, false);
  gd.world.set(48, 11, 46, BK.door, 0, false);
  run(gd, 1.5, { fwd: 1, yaw: 0 });
  assert.ok(gd.me.z < 46, 'the chinchilla walks through the round door');
  const boar = makeBody(48.5, 11, 48.5, 0.38, 0.72);
  for (let i = 0; i < 60; i++) moveBody(gd.world, boar, 0, -4, false, false, 1 / 30, { doors: true });
  assert.ok(boar.z > 47, 'a creature can’t pass a door');
  assert.ok(w);
});

test('digging: soft blocks go at once, stone takes a hold, the trowel is three times faster; drops go in the bag', () => {
  const g = flat();
  g.me.x = 48.5; g.me.z = 48.5;
  g.world.set(48, 11, 46, BK.soil);
  g.lookAt(48.5, 11.5, 46.5);
  assert.equal(g.dig(1 / 30, true), 1, 'soil goes at once');
  assert.equal(g.count('soil'), 1);
  g.world.set(48, 11, 46, BK.stone); g.lookAt(48.5, 11.5, 46.5);
  let t = 0; while (g.dig(1 / 30, true) < 1) t += 1 / 30;
  assert.ok(t > 0.9 && t < 1.3, `stone takes about a second with a paw (${t.toFixed(2)})`);
  g.give('trowel', 1); g.world.set(48, 11, 46, BK.stone); g.lookAt(48.5, 11.5, 46.5);
  t = 0; while (g.dig(1 / 30, true) < 1) t += 1 / 30;
  assert.ok(t < 0.45, `the trowel digs stone fast (${t.toFixed(2)})`);
  assert.equal(g.count('stone'), 2);
  g.world.set(48, 11, 46, BK.ironstone); assert.ok(g.digAt(48, 11, 46)); assert.equal(g.count('iron'), 1, 'ironstone gives iron');
  assert.equal(g.digAt(48, 0, 48), false, 'deepstone can’t be dug');
});

test('placing puts the held block where the player looks, not inside anyone; sand falls; water flows in', () => {
  const g = flat();
  g.give('planks', 3); g.hot[0] = 'planks'; g.sel = 0;
  g.lookAt(48.5, 10.9, 45.5);
  assert.ok(g.place()); assert.equal(g.world.get(48, 11, 45), BK.planks); assert.equal(g.count('planks'), 2);
  assert.equal(g.placeAt('planks', 48, 11, 48), false, 'not inside the player');
  g.give('sand', 1); assert.ok(g.placeAt('sand', 50, 14, 50)); assert.equal(g.world.get(50, 11, 50), BK.sand, 'sand falls to the floor');
  for (let x = 40; x <= 44; x++) g.world.set(x, 10, 40, BK.water, 0, false);
  g.world.set(45, 10, 40, BK.stone);
  g.breakBlock(45, 10, 40);
  assert.equal(g.world.get(45, 10, 40), BK.water, 'water runs into a hole beside it');
});

test('the light: lanterns light around them, the sky lights the open and not under a roof', () => {
  const g = flat();
  const w = g.world;
  assert.equal(w.sky(48, 11, 48), 15);
  for (let x = 44; x <= 52; x++) for (let z = 44; z <= 52; z++) w.set(x, 14, z, BK.stone, 0, false);
  w.relight(30, 66, 30, 66);
  assert.ok(w.sky(48, 11, 48) < 15 && w.sky(48, 13, 48) < 15, 'shade under the roof');
  w.set(48, 11, 48, BK.lantern);
  assert.equal(w.lamp(48, 11, 48), 14); assert.equal(w.lamp(51, 11, 48), 11);
  w.set(48, 11, 48, BK.air);
  assert.equal(w.lamp(51, 11, 48), 0, 'and goes when the lantern goes');
});

test('the bag and the Burrow Workbench: known patterns weave, unknown ones and missing things don’t', () => {
  const g = fresh();
  const s = g.valley.start;
  g.me.x = s.x + 0.5; g.me.z = s.z - 5.5; g.me.y = 17;
  assert.ok(g.nearBench(), 'the cubby’s workbench is in reach');
  g.give('log', 2);
  assert.ok(g.weave('planks')); assert.equal(g.count('planks'), 4);
  assert.equal(g.weave('oven'), false, 'oven is not known yet');
  assert.equal(g.weave('door', 2), false, 'not enough planks for two doors');
  const m = g.matchLoom([{ key: 'clay', n: 2 }, { key: 'stone', n: 1 }]);
  assert.equal(m.recipe.id, 'brick'); assert.equal(m.known, false);
  assert.equal(g.matchLoom([{ key: 'log', n: 3 }]).times, 3);
  assert.equal(g.matchLoom([{ key: 'log', n: 1 }, { key: 'clay', n: 1 }]), null);
  g.me.x = 20; g.me.z = 20; assert.equal(g.nearBench(), false); assert.equal(g.weave('twig'), false, 'needs a workbench nearby');
  assert.ok(RECIPES.length >= 30, `about thirty recipes (${RECIPES.length})`);
  for (const r of RECIPES) for (const k of [...Object.keys(r.ins), r.out]) assert.ok(ITEMS[k], `${r.id}: ${k} is an item`);
});

function room(g, x0, y0, z0, opts = {}) {
  const w = g.world;
  for (let x = x0; x <= x0 + 4; x++) for (let z = z0; z <= z0 + 4; z++) for (let y = y0; y <= y0 + 3; y++) {
    const shell = x === x0 || x === x0 + 4 || z === z0 || z === z0 + 4 || y === y0 || y === y0 + 3;
    w.set(x, y, z, shell ? BK.planks : BK.air, 0, false);
  }
  if (opts.door !== false) w.set(x0 + 2, y0 + 1, z0, BK.door, 0, false);
  if (opts.lantern !== false) w.set(x0 + 3, y0 + 1, z0 + 3, BK.lantern, 0, false);
  if (opts.bed !== false) w.set(x0 + 1, y0 + 1, z0 + 3, BK.bed, 0, false);
  if (opts.item) w.set(x0 + 3, y0 + 1, z0 + 1, BK[opts.item], 0, false);
  if (opts.hole) w.set(x0 + 4, y0 + 2, z0 + 2, BK.air, 0, false);
  w.relight(x0 - 16, x0 + 20, z0 - 16, z0 + 20);
  g.me.x = x0 + 2.5; g.me.y = y0 + 1; g.me.z = z0 + 2.5;
}
test('a swimmer scrambles up a bank a block above the water', () => {
  const g = flat(10), w = g.world;
  for (let z = 44; z <= 52; z++) for (let x = 44; x <= 52; x++) { w.set(x, 10, z, BK.water, 0, false); w.set(x, 9, z, BK.water, 0, false); }
  w.relight(30, 66, 30, 66);
  const b = g.me; b.x = 48.5; b.y = 9.6; b.z = 48.5;
  run(g, 5, { fwd: 1, jump: true, yaw: Math.PI / 2 });
  assert.ok(b.y >= 11 && b.x < 44, `out on the bank (${b.x.toFixed(1)}, ${b.y.toFixed(2)})`);
});

test('paths hop up one block (never two) and swim out over a bank', () => {
  const g = flat(10), w = g.world;
  for (let z = 0; z < D; z++) w.set(50, 11, z, BK.stone, 0, false);
  let p = findPath(w, { x: 48, y: 11, z: 48 }, { x: 52, y: 11, z: 48 });
  assert.ok(p && p.some((s) => s.x === 50 && s.y === 12), 'over the one-block wall');
  for (let z = 0; z < D; z++) w.set(50, 12, z, BK.stone, 0, false);
  p = findPath(w, { x: 48, y: 11, z: 48 }, { x: 52, y: 11, z: 48 }, 20000);
  assert.equal(p, null, 'not over a two-block wall');
});

test('burrow checks: shut in, a door, a light, a bed and the neighbour’s item; gaps and taken beds fail', () => {
  const g = flat();
  room(g, 40, 10, 40, { door: false });
  let r = checkBurrow(g.world, g.me.x, g.me.y + 0.3, g.me.z);
  assert.ok(r.enclosed); assert.equal(r.door, false); assert.match(r.reason, /door/);
  room(g, 40, 10, 40, { hole: true });
  r = checkBurrow(g.world, g.me.x, g.me.y + 0.3, g.me.z); assert.equal(r.enclosed, false, 'a gap to the outside');
  room(g, 40, 10, 40, { lantern: false }); assert.match(checkBurrow(g.world, g.me.x, g.me.y + 0.3, g.me.z).reason, /lantern/);
  room(g, 40, 10, 40, { bed: false }); assert.match(checkBurrow(g.world, g.me.x, g.me.y + 0.3, g.me.z).reason, /bed/);
  room(g, 40, 10, 40);
  r = checkBurrow(g.world, g.me.x, g.me.y + 0.3, g.me.z);
  assert.ok(r.enclosed && r.door && r.light && r.bed && r.reason === '', 'a good burrow');
  assert.equal(r.size, 18);
  g.quest = { i: 0, step: 2, count: 0 };
  let c = g.checkHere(); assert.equal(c.ok, false); assert.match(c.reason, /oven/, 'Hazel needs her oven');
  room(g, 40, 10, 40, { item: 'oven' });
  c = g.checkHere(); assert.ok(c.ok, c.reason);
  g.npcs = [g.visitor('hazel')];
  assert.ok(g.moveIn()); assert.equal(g.moved.length, 1); assert.equal(g.quest.i, 1);
  g.quest.step = 2; c = g.checkHere(); assert.ok(c.taken, 'a burrow with a claimed bed is taken');
  assert.match(c.reason, /already lives/);
  // a bookshelf is solid like a wall, but standing in the burrow it still counts as Ottoline's
  const o = flat(); o.quest = { i: 2, step: 2, count: 0 };
  room(o, 40, 10, 40, { item: 'bookshelf' });
  c = o.checkHere(); assert.ok(c.ok, c.reason); assert.ok(c.report.has.includes('bookshelf'));
});

test('errands: bring, count and burrow steps teach their recipes and hand on to the next neighbour', () => {
  const g = fresh();
  const v = g.visiting; g.me.x = v.body.x + 1; g.me.z = v.body.z; g.me.y = v.body.y;
  assert.equal(g.neighbour.id, 'hazel'); assert.equal(g.ready(), false);
  g.give('berries', 3); assert.ok(g.ready()); assert.ok(g.handIn());
  assert.ok(g.known.has('tart')); assert.equal(g.count('berries'), 0); assert.equal(g.quest.step, 1);
  g.give('tart', 1); assert.ok(g.handIn()); assert.ok(g.known.has('oven') && g.known.has('brick'));
  g.quest = { i: 2, step: 0, count: 0 };
  g.counted('catch'); g.counted('plant'); assert.equal(g.quest.count, 1, 'only the step’s own kind counts');
  g.counted('catch'); g.counted('catch'); assert.ok(g.ready());
  assert.equal(NEIGHBOURS.length, 6);
  for (const nb of NEIGHBOURS) { assert.equal(nb.steps.at(-1).kind, 'burrow'); assert.ok(RECIPES.some((r) => r.out === nb.item)); }
  // every item a neighbour asks for can be woven from recipes the chain (or the start) teaches
  const taught = new Set(RECIPES.filter((r) => r.from === 'start').map((r) => r.id));
  for (const nb of NEIGHBOURS) {
    for (const st of nb.steps) {
      if (st.kind === 'bring') for (const k of Object.keys(st.items)) { const r = RECIPES.find((x) => x.out === k); if (r) assert.ok(taught.has(r.id), `${nb.id} asks for ${k} before teaching it`); }
      if (st.kind === 'burrow') assert.ok(taught.has(RECIPES.find((x) => x.out === nb.item).id), `${nb.id}'s ${nb.item} is taught`);
      if (st.kind !== 'burrow') for (const r of st.learn) taught.add(r);
    }
  }
});

test('saplings planted on soil grow into birches', () => {
  const g = flat();
  g.world.set(50, 10, 50, BK.soil);
  g.give('sapling', 1);
  assert.ok(g.placeAt('sapling', 50, 11, 50));
  g.time += 95; g.step(0.05);
  assert.equal(g.world.get(50, 11, 50), BK.log); assert.equal(g.world.get(50, 15, 50), BK.leaves);
});

// ---------------------------------------------------------------- the night
const toNight = (g) => { g.time = Math.floor(g.time / DAY) * DAY + DAY * 0.75; g.wasNight = true; };
test('spawn rules: surface monsters only at night, in the dark, under open sky; gnashers only in the dark cave', () => {
  const g = flat();
  assert.equal(g.canSpawnAt('boar', 30, 11, 30), false, 'not by day');
  toNight(g);
  assert.ok(g.canSpawnAt('boar', 30, 11, 30), 'at night in the open');
  g.world.set(31, 11, 30, BK.lantern);
  assert.equal(g.canSpawnAt('boar', 30, 11, 30), false, 'not beside a lantern');
  assert.equal(g.canSpawnAt('gnasher', 30, 11, 34), false, 'gnashers not under the sky');
  for (let x = 20; x <= 26; x++) for (let z = 20; z <= 26; z++) g.world.set(x, 13, z, BK.stone, 0, false);
  for (let x = 20; x <= 26; x++) for (let y = 11; y <= 12; y++) { g.world.set(x, y, 20, BK.stone, 0, false); g.world.set(x, y, 26, BK.stone, 0, false); g.world.set(20, y, x, BK.stone, 0, false); g.world.set(26, y, x, BK.stone, 0, false); }
  g.world.relight(0, 60, 0, 60);
  assert.ok(g.canSpawnAt('gnasher', 23, 11, 23), 'in a dark closed space');
  assert.equal(g.canSpawnAt('boar', 23, 11, 23), false, 'boars not under a roof');
});

test('spawning over a night: monsters come; never in a lit burrow; Cosy nights and creative have none', () => {
  const g = flat(); toNight(g);
  for (let i = 0; i < 400; i++) { g.spawnT = 0; g.spawnTick(0.1); }
  const kinds = new Set(g.critters.map((c) => c.kind));
  for (const k of ['boar', 'moth', 'grumble', 'bunny']) assert.ok(kinds.has(k), `a ${k} appears`);
  for (const c of g.critters) assert.ok(g.world.lamp(Math.floor(c.body.x), Math.floor(c.body.y), Math.floor(c.body.z)) < 4);
  const cosy = flat(); cosy.cosy = true; toNight(cosy);
  for (let i = 0; i < 200; i++) { cosy.spawnT = 0; cosy.spawnTick(0.1); }
  assert.ok(cosy.critters.every((c) => c.kind === 'bunny'), 'Cosy nights: only dust-bunnies');
  const cr = flat(); cr.mode = 'creative'; cr.cosy = true; toNight(cr);
  for (let i = 0; i < 200; i++) { cr.spawnT = 0; cr.spawnTick(0.1); }
  assert.equal(cr.critters.length, 0, 'creative: no creatures');
  // a burrow with a lantern: nothing ever spawns inside
  const b = flat(); toNight(b); room(b, 44, 10, 44);
  b.safeFromBurrow({ x: 45, y: 11, z: 47 });
  for (let x = 45; x <= 47; x++) for (let z = 45; z <= 47; z++) for (const k of ['boar', 'moth', 'grumble', 'gnasher', 'bunny']) assert.equal(b.canSpawnAt(k, x, 11, z), false);
});

test('the Bramble Boar snorts, charges in a line, hurts on contact, and bonks dizzy into a wall', () => {
  const g = flat(); toNight(g);
  const c = g.spawn('boar', 48, 11, 40);
  c.cd = 0; g.step(0.1);
  assert.equal(c.st, 'windup'); assert.ok(g.drain().some((e) => e.t === 'snort'), 'a snort before the charge');
  assert.ok(Math.abs(Math.atan2(-(g.me.x - c.body.x), -(g.me.z - c.body.z)) - c.body.yaw) < 0.1, 'it faces the chinchilla');
  run(g, 2.2);
  assert.ok(g.hp < MAX_HP, 'the charge hits'); assert.equal(g.hp, MAX_HP - CRITTERS.boar.damage);
  // a second boar, with the chinchilla behind a wall's gap: it misses and bonks the wall
  const h = flat(); toNight(h);
  for (let x = 40; x <= 56; x++) for (let y = 11; y <= 12; y++) h.world.set(x, y, 51, BK.stone, 0, false);
  const b2 = h.spawn('boar', 48, 11, 42); b2.cd = 0;
  h.step(0.1); assert.equal(b2.st, 'windup');
  run(h, 0.85);
  h.me.x = 52.5; h.me.z = 49.5;
  run(h, 1.4);
  assert.ok(['stun', 'rest', 'roam'].includes(b2.st));
  assert.ok(h.drain().some((e) => e.t === 'thud'), 'bonked into the wall');
});

test('the Murk Moth snuffs a lantern in the open, not one under a roof, and swoops', () => {
  const g = flat(); toNight(g);
  g.world.set(40, 11, 40, BK.lantern);
  for (let x = 54; x <= 56; x++) for (let z = 54; z <= 56; z++) g.world.set(x, 13, z, BK.stone, 0, false);
  g.world.set(55, 11, 55, BK.lantern);
  g.me.x = 70; g.me.z = 70;
  const m = g.spawn('moth', 44, 11, 44); m.cd = 0;
  run(g, 8);
  assert.equal(g.world.get(40, 11, 40), BK.lantern_out, 'the open lantern is snuffed');
  assert.equal(g.world.get(55, 11, 55), BK.lantern, 'the roofed one stays lit');
  g.me.x = 41.5; g.me.z = 41.5; g.lookAt(40.5, 11.3, 40.5);
  assert.equal(g.use(), 'relight'); assert.equal(g.world.get(40, 11, 40), BK.lantern);
  const s = flat(); toNight(s);
  const m2 = s.spawn('moth', 50, 11, 50); m2.cd = 0;
  run(s, 4);
  assert.ok(s.hp < MAX_HP, 'a swoop hurts');
});

test('the Gloom Gnasher lurks, lunges when close, and backs away from lantern light', () => {
  const g = flat();
  const c = g.spawn('gnasher', 48, 11, 44); c.cd = 0;
  g.me.x = 48.5; g.me.z = 52.5; run(g, 1);
  assert.equal(c.st, 'lurk', 'still as a rock while you are far off');
  g.me.z = 47.8; g.step(0.1);
  assert.equal(c.st, 'lunge');
  run(g, 1.5);
  assert.ok(g.hp < MAX_HP, 'the lunge bites');
  const l = flat(); const c2 = l.spawn('gnasher', 48, 11, 44); c2.cd = 0;
  l.world.set(48, 11, 46, BK.lantern);
  l.me.x = 48.5; l.me.z = 47.5; run(l, 2);
  assert.equal(l.hp, MAX_HP, 'no bite in lantern light');
  assert.ok(!l.critters.includes(c2) || Math.hypot(c2.body.x - 48.5, c2.body.z - 46.5) > 2, 'it backs off or poofs');
});

test('Grumblefluffs nibble from the bag and give it back when bonked; dust-bunnies are caught and knock over dark things', () => {
  const g = flat(); toNight(g);
  g.give('clay', 6);
  const c = g.spawn('grumble', 48, 11, 45); c.st = 'chase';
  run(g, 1.5);
  assert.ok(c.loot, 'it took a mouthful'); const took = Object.entries(c.loot)[0];
  assert.equal(g.count(took[0]) + took[1], took[0] === 'clay' ? 6 : took[1] + g.count(took[0]));
  g.defeat(c);
  const p = g.pickups.at(-1); assert.equal(p.items[took[0]], took[1] + (CRITTERS.grumble.drops[took[0]] ?? 0), 'defeated, it drops what it took');
  const b = flat(); toNight(b);
  b.world.set(40, 11, 48, BK.pot); b.me.x = 70; b.me.z = 70;
  const bun = b.spawn('bunny', 43, 11, 48); bun.cd = 0;
  run(b, 6);
  assert.equal(b.world.get(40, 11, 48), BK.air, 'the dark flower pot is knocked over'); assert.ok(b.pickups.some((x) => x.items.pot), 'and left to pick up');
  const bun2 = b.spawn('bunny', 69, 11, 70); b.me.x = 69.5; b.me.z = 70.5; b.step(0.05);
  assert.ok(!b.critters.includes(bun2) && b.count('fluff') >= 2 && b.stats.caught === 1, 'bump a dust-bunny to catch it');
});

test('bonks: the bonk-stick hits harder and farther than a paw, knocks back and poofs a monster for its drops', () => {
  for (const [kind, drop] of [['boar', 'thorns'], ['moth', 'shimmer'], ['gnasher', 'pearl'], ['grumble', 'fluff']]) {
    const g = flat(); toNight(g);
    const c = g.spawn(kind, 48, 11, 46); c.st = 'stun'; c.t = -99;
    if (kind === 'moth') c.body.y = 11.2;
    g.sel = 0; g.lookAt(c.body.x, c.body.y + 0.3, c.body.z);
    let swings = 0;
    while (g.critters.includes(c) && swings < 10) { g.swingCd = 0; c.hurt = 0; g.swing(); swings++; c.body.x = 48.5; c.body.z = 46.5; c.body.vx = c.body.vz = 0; }
    assert.ok(!g.critters.includes(c), `${kind} defeated`);
    assert.equal(swings, Math.ceil(CRITTERS[kind].hp / 2), `${kind}: bonk-stick does 2`);
    assert.ok(g.pickups.some((p) => p.items[drop] >= 1), `${kind} drops ${drop}`);
    run(g, 1.5, { fwd: 1, yaw: 0 });
    assert.ok(g.count(drop) >= 1, `${drop} picked up`);
  }
  const p = flat(); toNight(p); p.hot[0] = null; p.inv = {};
  const c = p.spawn('boar', 48, 11, 46); c.st = 'stun'; c.t = -99;
  p.lookAt(48.5, 11.3, 46.5); p.swing(); assert.equal(c.hp, CRITTERS.boar.hp - 1, 'a paw does 1');
  const k = flat(); toNight(k);
  const c2 = k.spawn('boar', 48, 11, 46); c2.st = 'stun'; c2.t = -99; k.lookAt(48.5, 11.3, 46.5); k.swing();
  assert.ok(Math.hypot(c2.body.vx, c2.body.vz) > 5, 'knockback');
  const s = flat(); toNight(s); s.give('slingshot', 1); s.give('pebbles', 3); s.hot[2] = 'slingshot'; s.sel = 2;
  const c3 = s.spawn('moth', 48, 11, 42); c3.st = 'stun'; c3.t = -99; c3.body.y = 11.2;
  s.lookAt(48.5, 11.5, 42.5); assert.ok(s.swing()); assert.equal(s.count('pebbles'), 2);
  for (let i = 0; i < 20; i++) { c3.body.x = 48.5; c3.body.z = 42.5; c3.body.y = 11.2; s.shotTick(1 / 30); }
  assert.ok(!s.critters.includes(c3), 'a slingshot pebble poofs a moth');
});

test('hearts and knock-outs: you wake by your bed, half of each stack (not tools) waits where you fell', () => {
  const g = fresh(); toNight(g);
  g.give('clay', 7); g.give('trowel', 1);
  const fell = { x: g.me.x, z: g.me.z };
  g.me.x = 30; g.me.z = 30;
  let hits = 0;
  while (g.hp > 0 && hits < 20) { g.hurtT = 0; g.hurt(2, 31, 30); hits++; if (g.stats.kos) break; }
  assert.equal(g.stats.kos, 1); assert.equal(hits, 5, 'ten half-hearts, two a hit');
  assert.equal(g.hp, MAX_HP); assert.equal(g.count('clay'), 4); assert.equal(g.count('trowel'), 1, 'tools are kept');
  assert.ok(Math.hypot(g.me.x - g.valley.homeBed.x, g.me.z - g.valley.homeBed.z) < 2.5, 'back beside the cubby bed');
  const p = g.pickups.find((x) => x.items.clay === 3); assert.ok(p, 'three clay wait where you fell');
  assert.ok(Math.hypot(p.x - 30, p.z - 30) < 1);
  assert.ok(fell);
  const r = fresh(); r.hp = 3; r.calm = 0; run(r, 8);
  assert.ok(r.hp > 3, 'hearts come back when nothing has hurt you for a while');
  const sl = fresh(); toNight(sl); sl.spawn('boar', Math.floor(sl.me.x) + 3, Math.floor(sl.me.y), Math.floor(sl.me.z));
  assert.equal(sl.sleep(sl.valley.homeBed), 'nosleep', 'no sleeping with a monster close by');
  sl.critters = []; assert.equal(sl.sleep(sl.valley.homeBed), 'sleep'); assert.equal(sl.night, false);
});

test('Cosy nights swaps the monster drops in recipes and errands for valley things', () => {
  assert.deepEqual(cosyIns({ iron: 1, twig: 2, shimmer: 1 }, true), { iron: 1, twig: 2, fluff: 1 });
  const g = fresh({ cosy: true });
  g.quest = { i: 5, step: 1, count: 0 };
  assert.deepEqual(g.needs(g.stepNow.items), { twig: 4 });
  assert.equal(g.monstersOn(), false);
});

test('the save: a round trip keeps the world, bag, recipes, errands and places; corrupt saves never crash', () => {
  const g = fresh({ name: 'Test' });
  g.world.set(40, 30, 40, BK.planks, 2); g.world.set(41, 30, 40, BK.planks); g.world.set(42, 30, 40, BK.planks);
  g.breakBlock(g.valley.stump.x + 3, 16, g.valley.stump.z + 3);
  g.give('clay', 5); g.learn('glass'); g.quest = { i: 1, step: 1, count: 0 };
  g.moved.push({ who: 'hazel', bed: g.valley.homeBed, home: g.valley.start, cells: [] });
  g.drop(10, 20, 10, { iron: 2 });
  g.time = 1234.5;
  const raw = JSON.stringify({ v: 1, slots: [g.toSlot(), null, null], last: 0, settings: { sound: false, music: true, view: 'first', sens: 1.5, invert: true } });
  const s = readSave(raw);
  assert.equal(s.settings.sound, false); assert.equal(s.settings.view, 'first');
  const h = CubbyGame.fromSlot(s.slots[0]);
  assert.equal(h.world.get(40, 30, 40), BK.planks); assert.equal(h.world.facing(40, 30, 40), 2);
  assert.equal(hashOf(h.world.blocks), hashOf(g.world.blocks), 'the same world');
  assert.equal(h.count('clay'), g.count('clay')); assert.ok(h.known.has('glass'));
  assert.deepEqual(h.quest, g.quest); assert.equal(h.time, 1234.5); assert.equal(h.pickups[0].items.iron, 2);
  assert.equal(h.npcs.length, 2, 'Hazel at home and Morrow visiting');
  assert.equal(SAVE_KEY, 'cubby-valley-v1');
  const d = new Map([[5, 3], [6, 3], [7, 3], [1000, 14], [N - 1, 2]]);
  assert.deepEqual([...decodeDiff(encodeDiff(d))], [...d]);
  assert.deepEqual([...fromB64(toB64(Uint8Array.from([1, 2, 3, 4, 250])))], [1, 2, 3, 4, 250]);
  for (const bad of [null, '', 'nope', '{', '[]', '{"v":2}', '{"v":1,"slots":"x"}', '{"v":1,"slots":[1,"a",{"v":1}]}',
    JSON.stringify({ v: 1, slots: [{ ...g.toSlot(), diff: '!!!!' }] }), JSON.stringify({ v: 1, slots: [{ ...g.toSlot(), seed: -4 }] }),
    JSON.stringify({ v: 1, slots: [{ ...g.toSlot(), players: [] }] }), JSON.stringify({ v: 1, slots: [{ ...g.toSlot(), inv: { clay: 'lots', nope: 3, iron: -2 } }], settings: 5 })]) {
    const r = readSave(bad);
    assert.equal(r.slots.length, 3);
    for (const sl of r.slots) if (sl) { const gg = CubbyGame.fromSlot(sl); assert.ok(gg.world); }
  }
  const odd = readSave(JSON.stringify({ v: 1, slots: [{ ...g.toSlot(), inv: { clay: 'lots', nope: 3, iron: 2 }, hot: [1, 'clay', 'zzz'], hp: 99, quest: { i: 77, step: -3 } }] }));
  assert.deepEqual(odd.slots[0].inv, { iron: 2 }); assert.equal(odd.slots[0].hp, MAX_HP); assert.equal(odd.slots[0].hot[1], 'clay'); assert.equal(odd.slots[0].hot[2], null);
  assert.ok(odd.slots[0].quest.i <= 6);
  assert.equal(readSlot({ ...g.toSlot(), diff: 'AAA' }), null, 'a broken world diff drops the slot');
  assert.deepEqual(freshSave().slots, [null, null, null]);
});

test('paths: the walk from the start to the stump and into the glow cave exists', () => {
  const g = base, v = g.valley, w = g.world;
  const from = { x: v.start.x, y: v.start.y, z: v.start.z };
  assert.ok(findPath(w, from, { x: v.stump.x + 1, y: v.stump.y, z: v.stump.z + 1 }), 'to the stump');
  const c = g.crystals[0];
  const p = findPath(w, from, { x: c.x, y: c.y, z: c.z }, 60000, 2);
  assert.ok(p && p.length > 10, 'down into the crystal cave');
});

console.log(`cubby: ${n} checks passed`);
