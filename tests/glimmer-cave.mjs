import assert from 'node:assert/strict';
import * as G from '../.checks/glimmer-cave-game.js';

let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`ok   ${name}`); } catch (e) { failed++; console.log(`FAIL ${name}\n${e.stack}`); }
}
const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

// ---- the data ----

test('data: 12 weapons with two overclocks at 5 and two at 10, 48 distinct', () => {
  assert.equal(G.WEAPON_IDS.length, 12); assert.equal(Object.keys(G.WEAPONS).length, 12);
  const seen = new Set();
  for (const id of G.WEAPON_IDS) {
    const w = G.WEAPONS[id];
    assert.equal(w.id, id);
    assert.equal(w.oc5.length, 2); assert.equal(w.oc10.length, 2);
    for (const oc of [...w.oc5, ...w.oc10]) { assert.ok(oc.startsWith(`${id}.`), oc); assert.ok(G.OVERCLOCKS[oc], oc); seen.add(oc); }
  }
  assert.equal(seen.size, 48); assert.equal(Object.keys(G.OVERCLOCKS).length, 48);
});

test('data: level-1 weapon numbers match the spec', () => {
  const want = [['sling', 8, 0.6], ['pickaxe', 14, 0.9], ['popper', 10, 1.2], ['pulse', 6, 2], ['lance', 12, 1.5], ['puffer', 5, 0.8],
    ['boomerang', 9, 1.4], ['bomb', 25, 2.5], ['drum', 10, 4], ['drill', 8, 2]];
  for (const [id, damage, cooldown] of want) { assert.equal(G.WEAPONS[id].damage, damage, id); assert.ok(near(G.WEAPONS[id].cooldown, cooldown), id); }
  assert.equal(G.WEAPONS.orbit.damage, 7); assert.equal(G.WEAPONS.orbit.p.seeds, 3);
  assert.equal(G.WEAPONS.moths.damage, 6); assert.equal(G.WEAPONS.moths.p.moths, 2);
  assert.equal(G.START_POOL.length, 8); assert.ok(!G.START_POOL.includes('bomb'));
});

test('data: mining weapons are pickaxe, bomb and drill', () => {
  assert.deepEqual(G.WEAPON_IDS.filter(id => G.WEAPONS[id].mines).sort(), ['bomb', 'drill', 'pickaxe']);
});

test("data: every weapon's steps has 11 entries", () => {
  for (const id of G.WEAPON_IDS) {
    const s = G.WEAPONS[id].steps;
    assert.equal(s.length, 11, id);
    for (const x of s) assert.ok(['rate', 'size', 'count'].includes(x), `${id} ${x}`);
  }
});

test('data: rarity weights sum to 100 at every hazard, and hazard 5 is [44, 40, 14, 2]', () => {
  for (const h of [1, 2, 3, 4, 5]) assert.equal(G.rarityWeights(h).reduce((a, b) => a + b, 0), 100, `hazard ${h}`);
  assert.deepEqual(G.rarityWeights(1), [60, 28, 10, 2]);
  assert.deepEqual(G.rarityWeights(5), [44, 40, 14, 2]);
});

test('data: critters, elites, jobs and xpNeed match the spec', () => {
  assert.equal(G.xpNeed(1), 8);
  assert.equal(G.targetAlive(0, 1, 1, false), 20); assert.equal(G.targetAlive(300, 1, 1, false), 120);
  assert.equal(G.targetAlive(300, 5, 5, true), 300);
  assert.deepEqual(G.goldRange(1), [3, 6]);
  assert.ok(near(G.critterFluff(6, 3, 2), 6 * 1.7 * 1.25));
  assert.equal(G.CRITTERS.beetle.fluff, 30); assert.equal(G.CRITTERS.mite.speed, 2.8);
  assert.equal(G.ELITE.cache, 20); assert.equal(G.JOBS.crates.goal, 3); assert.equal(G.JOBS.bigone.at, 150);
  assert.equal(G.upgradeCost('rerolls', 2), 160); assert.equal(G.UPGRADES.rerolls.max, 3); assert.equal(G.UPGRADES.fluffier.max, 5);
});

test('data: copy is gentle', () => {
  const texts = [];
  const add = o => { if (o.name) texts.push(o.name); if (o.text) texts.push(o.text); };
  for (const t of [G.WEAPONS, G.PASSIVES, G.UPGRADES, G.JOBS, G.CRITTERS, G.OVERCLOCKS]) Object.values(t).forEach(add);
  G.RARITY.names.forEach(n => texts.push(n));
  assert.ok(texts.length > 100);
  for (const t of texts) for (const bad of ['kill', 'die', 'dead', 'blood', 'murder', 'hurt']) assert.ok(!t.toLowerCase().includes(bad), `"${t}" has "${bad}"`);
});

test('rand: the same seed replays, and mix is stable', () => {
  const a = new G.Rand(7), b = new G.Rand(7);
  for (let i = 0; i < 20; i++) assert.equal(a.next(), b.next());
  assert.equal(G.mix(1, 2), G.mix(1, 2)); assert.notEqual(G.mix(1, 2), G.mix(2, 1));
});

// ---- the map ----

const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1), LAYERS = [1, 2, 3, 4, 5];
const open = b => b === 'floor';

test('map: the same seed and layer give the same map; a different seed gives a different one', () => {
  const a = G.makeMap(5, 2, null), b = G.makeMap(5, 2, null), c = G.makeMap(6, 2, null);
  assert.deepEqual(a, b); assert.notDeepEqual(a.tiles, c.tiles);
  assert.equal(a.w, 64); assert.equal(a.h, 48); assert.equal(a.tiles.length, 64 * 48); assert.equal(a.tint, 2);
});

test('map: the border is two tiles of bedrock', () => {
  for (const seed of SEEDS) {
    const m = G.makeMap(seed, 1, null);
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      if (x < 2 || y < 2 || x >= m.w - 2 || y >= m.h - 2) assert.equal(m.tiles[y * m.w + x], 'bedrock', `seed ${seed} ${x},${y}`);
    }
  }
});

test('map: every open tile and every pod spot is reachable from the start', () => {
  for (const seed of SEEDS) for (const layer of LAYERS) {
    const m = G.makeMap(seed, layer, null), r = G.reachable(m, m.start);
    assert.ok(open(G.tileAt(m, m.start.x, m.start.y)));
    for (let i = 0; i < m.tiles.length; i++) if (open(m.tiles[i])) assert.equal(r[i], 1, `seed ${seed} layer ${layer} tile ${i}`);
    for (const p of m.pods) assert.equal(r[p.y * m.w + p.x], 1);
  }
});

test('map: at least 12 pod spots, each 3 x 3 open', () => {
  for (const seed of SEEDS) for (const layer of LAYERS) {
    const m = G.makeMap(seed, layer, null);
    assert.ok(m.pods.length >= 12, `seed ${seed} layer ${layer}: ${m.pods.length}`);
    for (const p of m.pods) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) assert.ok(open(G.tileAt(m, p.x + dx, p.y + dy)));
    const far = m.pods.filter(p => Math.hypot(p.x - m.start.x, p.y - m.start.y) >= 12);
    assert.ok(far.length >= 6, `seed ${seed} layer ${layer}: ${far.length} far pods`);
  }
});

test('map: the start has a 5 x 5 room', () => {
  for (const seed of SEEDS) {
    const m = G.makeMap(seed, 3, null);
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) assert.equal(G.tileAt(m, m.start.x + dx, m.start.y + dy), 'floor');
  }
});

test('map: gold is commoner deeper', () => {
  const mean = layer => SEEDS.reduce((n, s) => n + G.makeMap(s, layer, null).tiles.filter(b => b === 'gold').length, 0) / SEEDS.length;
  assert.ok(mean(5) > mean(1), `${mean(1)} vs ${mean(5)}`);
});

test('map: crates are buried but diggable, lanterns stand on open floor', () => {
  for (const seed of SEEDS) {
    const m = G.makeMap(seed, 2, 'crates');
    const crates = m.props.filter(p => p.kind === 'crate'); assert.equal(crates.length, 3);
    const r = G.reachable(m, m.start);
    for (const c of crates) {
      assert.equal(G.tileAt(m, c.x, c.y), 'crate');
      const ns = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]].map(([dx, dy]) => [c.x + dx, c.y + dy]);
      assert.ok(ns.every(([x, y]) => G.tileAt(m, x, y) !== 'floor'), 'buried');
      assert.ok(ns.some(([x, y]) => G.solid(G.tileAt(m, x, y)) && G.tileAt(m, x, y) !== 'bedrock' && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => r[(y + dy) * m.w + x + dx] === 1)), 'diggable');
    }
    const l = G.makeMap(seed, 2, 'lanterns').props.filter(p => p.kind === 'lantern'); assert.equal(l.length, 3);
    const m2 = G.makeMap(seed, 2, 'lanterns');
    for (const p of l) { assert.equal(G.tileAt(m2, p.x, p.y), 'lantern'); assert.ok(Math.hypot(p.x - m2.start.x, p.y - m2.start.y) >= 10); }
    assert.equal(G.makeMap(seed, 2, null).props.length, 0);
  }
});

test('dig: dirt turns to floor with nothing; gold drops 3-6 on layer 1; crate drops 15 crystals; bedrock and floor return null and stay', () => {
  const m = G.makeMap(1, 1, null), r = new G.Rand(3), s0 = r.s;
  m.tiles[100] = 'dirt'; m.tiles[101] = 'gold'; m.tiles[102] = 'crate'; m.tiles[103] = 'bedrock'; m.tiles[104] = 'floor'; m.tiles[105] = 'lantern';
  assert.deepEqual(G.dig(m, 100 % 64, 1, r, 1), { block: 'dirt', gold: 0, crystals: 0 }); assert.equal(m.tiles[100], 'floor'); assert.equal(r.s, s0);
  const g = G.dig(m, 101 % 64, 1, r, 1); assert.equal(g.block, 'gold'); assert.ok(g.gold >= 3 && g.gold <= 6); assert.equal(m.tiles[101], 'floor');
  const c0 = r.s; assert.deepEqual(G.dig(m, 102 % 64, 1, r, 1), { block: 'crate', gold: 0, crystals: 15 }); assert.equal(r.s, c0);
  for (const [i, b] of [[103, 'bedrock'], [104, 'floor'], [105, 'lantern']]) { assert.equal(G.dig(m, i % 64, 1, r, 1), null); assert.equal(m.tiles[i], b); }
  assert.equal(G.dig(m, -1, -1, r, 1), null); assert.equal(G.tileAt(m, -5, 3), 'bedrock'); assert.ok(G.solid('dirt') && !G.solid('floor'));
});

test('map: generation is fast', () => {
  const t = performance.now(); for (let i = 0; i < 50; i++) G.makeMap(i, 3, 'crates');
  const ms = (performance.now() - t) / 50; console.log(`     makeMap ${ms.toFixed(2)} ms`); assert.ok(ms < 20);
});

test('map: every open tile and pod spot is reachable on job maps too', () => {
  for (const job of ['lanterns', 'crates']) for (const seed of SEEDS) for (const layer of LAYERS) {
    const m = G.makeMap(seed, layer, job), r = G.reachable(m, m.start);
    for (let i = 0; i < m.tiles.length; i++) if (open(m.tiles[i])) assert.equal(r[i], 1, `${job} seed ${seed} layer ${layer} tile ${i}`);
    for (const p of m.pods) assert.equal(r[p.y * m.w + p.x], 1, `${job} seed ${seed} layer ${layer} pod`);
  }
});

// ---- the dive ----

const R = { x: 1, y: 0 }, Z = { x: 0, y: 0 };
/** A 64 x 48 floor inside a bedrock border, with three pod spots: about 2, 16 and 32 tiles from the middle. */
function openMap() {
  const w = 64, h = 48, tiles = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) tiles.push(x < 2 || y < 2 || x >= w - 2 || y >= h - 2 ? 'bedrock' : 'floor');
  return { w, h, tiles, start: { x: 32, y: 24 }, pods: [{ x: 34, y: 25 }, { x: 48, y: 24 }, { x: 6, y: 6 }], props: [], tint: 1 };
}
function openDive(o = {}) {
  const d = new G.Dive({ seed: 1, hero: 'dora', hazard: 1, profile: {}, ...o });
  d.map = openMap(); d.spawning = false; d.critters.length = 0; d.crystals.length = 0;
  d.placeHero(32.5, 24.5);
  return d;
}
const put = (d, x, y, b) => { d.map.tiles[y * d.map.w + x] = b; };
const run = (d, input, n) => { const ev = []; for (let i = 0; i < n; i++) ev.push(...d.step(input)); return ev; };

test('move: the hero moves 3.2 tiles in one second right, and Enzo 3.52', () => {
  const a = openDive(); run(a, R, 60);
  assert.ok(near(a.hx, 32.5 + 3.2, 0.01), `${a.hx}`); assert.ok(near(a.hy, 24.5)); assert.deepEqual(a.face, { x: 1, y: 0 }); assert.ok(a.moving);
  assert.ok(near(a.buddy.x, a.hx - 1.2, 0.05) && near(a.buddy.y, a.hy, 1e-6), 'the buddy trails 1.2 tiles behind');
  const b = openDive({ hero: 'enzo' }); run(b, R, 60); assert.ok(near(b.hx, 32.5 + 3.52, 0.01), `${b.hx}`);
  const c = openDive(); run(c, { x: 3, y: 4 }, 60);
  assert.ok(near(Math.hypot(c.hx - 32.5, c.hy - 24.5), 3.2, 0.01), 'input is clamped to length 1'); assert.ok(near(c.face.x, 0.6) && near(c.face.y, 0.8));
  run(c, Z, 5); assert.ok(!c.moving); assert.ok(near(c.face.x, 0.6), 'face keeps the last direction');
});

test("move: the hero can't pass rock", () => {
  const d = openDive(); for (let y = 2; y < 46; y++) put(d, 35, y, 'bedrock');
  const ev = run(d, R, 120);
  assert.ok(near(d.hx, 35 - G.BASE.radius, 1e-6), `${d.hx}`); assert.equal(d.digging, null); assert.equal(ev.filter(e => e.k === 'dig').length, 0);
  run(d, { x: -1, y: 0 }, 60); assert.ok(near(d.hx, 35 - G.BASE.radius - 3.2, 0.01), 'and leaves it freely');
});

test('move: sliding along a wall', () => {
  const d = openDive(); for (let y = 2; y < 46; y++) put(d, 33, y, 'bedrock');
  d.placeHero(32.7, 24.5);
  const ev = run(d, { x: 1, y: -1 }, 30);
  assert.ok(near(d.hx, 32.7, 1e-6), `${d.hx}`); assert.ok(near(24.5 - d.hy, 3.2 * Math.SQRT1_2 * 0.5, 0.01), `${d.hy}`);
  assert.equal(ev.filter(e => e.k === 'dig').length, 0); assert.equal(d.digging, null);
});

test('dig: pushing into dirt digs it in 0.6 s, Dora in 0.3 s', () => {
  for (const [hero, secs] of [['enzo', 0.6], ['dora', 0.3]]) {
    const d = openDive({ hero }); put(d, 33, 24, 'dirt'); d.placeHero(32.7, 24.5);
    let n = 0; const ev = [];
    while (G.tileAt(d.map, 33, 24) === 'dirt' && n < 200) { ev.push(...d.step(R)); n++; }
    assert.ok(Math.abs(n - secs * 60) <= 1, `${hero}: ${n} steps`);
    const digs = ev.filter(e => e.k === 'dig');
    assert.ok(digs.every(e => e.x === 33 && e.y === 24 && e.block === 'dirt'));
    assert.equal(digs.at(-1).progress, 1); assert.ok(digs.slice(0, -1).every((e, i, a) => e.progress < 1 && (i === 0 || e.progress > a[i - 1].progress)));
    run(d, R, 30); assert.ok(d.hx > 33, 'and walks into the dug tile');
  }
});

test('dig: progress resets on a new block', () => {
  const d = openDive({ hero: 'enzo' }); for (let y = 18; y < 30; y++) put(d, 33, y, 'dirt');
  d.placeHero(32.7, 24.5);
  run(d, R, 18); assert.deepEqual([d.digging.x, d.digging.y], [33, 24]); assert.ok(near(d.digging.p, 0.5, 0.02), `${d.digging.p}`);
  d.hy = 25.5; d.step(R); assert.deepEqual([d.digging.x, d.digging.y], [33, 25]); assert.ok(d.digging.p < 0.05);
  d.hy = 24.5; d.step(R); assert.deepEqual([d.digging.x, d.digging.y], [33, 24]); assert.ok(d.digging.p < 0.05, 'back on the first block starts again');
  d.step(Z); assert.equal(d.digging, null, 'letting go stops digging');
  d.hy = 18.5; const ev = run(d, { x: 1, y: 1 }, 150);
  assert.ok(d.hy > 24, `${d.hy}`); assert.equal(ev.filter(e => e.k === 'dig' && e.progress === 1).length, 0, 'brushing past rock chips nothing');
  for (let y = 18; y < 30; y++) assert.equal(G.tileAt(d.map, 33, y), 'dirt');
});

test('dig: a gold block adds its gold to gold.layer', () => {
  const d = openDive(); put(d, 33, 24, 'gold'); d.placeHero(32.7, 24.5);
  const ev = run(d, R, 40), [lo, hi] = G.goldRange(1);
  assert.equal(G.tileAt(d.map, 33, 24), 'floor');
  assert.ok(d.gold.layer >= lo && d.gold.layer <= hi, `${d.gold.layer}`); assert.equal(d.gold.banked, 0);
  assert.deepEqual(ev.filter(e => e.k === 'gold').map(e => e.n), [d.gold.layer]);
  assert.ok(ev.some(e => e.k === 'dig' && e.block === 'gold' && e.progress === 1));
});

test('critters: contact takes Fluff once per 0.5 s of grace', () => {
  const d = openDive({ hero: 'enzo' }); assert.equal(d.fluff, 100);
  d.spawn('soot', d.hx, d.hy);
  const ev = d.step(Z); assert.equal(d.fluff, 95); assert.deepEqual(ev.filter(e => e.k === 'hurt'), [{ k: 'hurt', dmg: 5 }]);
  run(d, Z, 23); assert.equal(d.fluff, 95, 'still 95 after 0.4 s');
  run(d, Z, 12); assert.equal(d.fluff, 90, '90 after 0.6 s');
});

test('critters: a beetle within 4 tiles rams 2 tiles every 4 s', () => {
  const d = openDive(); const b = d.spawn('beetle', d.hx - 3, d.hy); b.t = 0; d.fluff = 1e9;
  const rams = [], lengths = []; let prev = b.state, rx = 0, ry = 0;
  for (let i = 1; i <= 660; i++) {
    if (b.state === 'ready') { rx = b.x; ry = b.y; }
    d.step(Z);
    if (b.state === 'ram' && prev !== 'ram') rams.push(i / 60);
    if (prev === 'ram' && b.state !== 'ram') lengths.push(Math.hypot(b.x - rx, b.y - ry));
    prev = b.state;
  }
  assert.ok(rams.length >= 3, `${rams}`); assert.ok(near(rams[0], 0.4, 0.04), `${rams[0]}`);
  for (let i = 1; i < rams.length; i++) assert.ok(near(rams[i] - rams[i - 1], 4, 0.05), `${rams}`);
  for (const l of lengths) assert.ok(near(l, 2, 1e-6), `${lengths}`);
  const far = openDive(), f = far.spawn('beetle', far.hx - 8, far.hy); f.t = 0;
  run(far, Z, 60); assert.equal(f.state, 'walk', 'a beetle 8 tiles away walks'); assert.ok(near(f.x, far.hx - 8 + 1.4, 0.02), `${f.x}`);
});

test('spawning respects the cap and the view', () => {
  const inView = (d, c) => Math.abs(c.x - d.hx) < 9 && Math.abs(c.y - d.hy) < 5.5;
  const d = openDive(); d.spawning = true;
  for (let i = 0; i < 300; i++) d.spawn('soot', 3 + (i % 58), 3 + Math.floor(i / 58) * 0.5);
  d.t = 59.99;
  for (let i = 0; i < 30; i++) { d.step(Z); assert.ok(d.critters.length <= 300, `${d.critters.length}`); }
  assert.equal(d.critters.length, 300);
  d.critters.length = 200; d.t = 119.99;
  let top = Math.max(...d.critters.map(c => c.id)), fresh = 0, bursts = 0;
  for (let i = 0; i < 300; i++) {
    bursts += d.step(Z).filter(e => e.k === 'burst').length;
    assert.ok(d.critters.length <= 300);
    for (const c of d.critters) if (c.id > top) { fresh++; assert.equal(G.tileAt(d.map, Math.floor(c.x), Math.floor(c.y)), 'floor'); assert.ok(!inView(d, c), `${c.x},${c.y}`); }
    top = Math.max(top, ...d.critters.map(c => c.id));
  }
  assert.equal(bursts, 1); assert.equal(fresh, 30);
  for (const seed of [3, 4, 5]) {
    const r = new G.Dive({ seed, hero: 'enzo', hazard: 3, profile: {} }); r.t = 200; let top = 0, n = 0;
    for (let i = 0; i < 1200; i++) {
      r.step({ x: Math.cos(i / 90), y: Math.sin(i / 70) }); r.fluff = 999;
      assert.ok(r.critters.length <= 300);
      for (const c of r.critters) if (c.id > top) {
        n++; assert.equal(G.tileAt(r.map, Math.floor(c.x), Math.floor(c.y)), 'floor', `seed ${seed} ${c.x},${c.y}`); assert.ok(!inView(r, c), `seed ${seed} ${c.x},${c.y}`);
        top = c.id;
      }
    }
    assert.ok(n > 100, `seed ${seed}: ${n} spawns`);
  }
  const e1 = new G.Dive({ seed: 9, hero: 'enzo', hazard: 1, profile: {} }); e1.t = 29.9; run(e1, Z, 12);
  assert.ok(!e1.critters.some(c => c.elite), 'no elites on layer 1');
  const e2 = new G.Dive({ seed: 9, hero: 'enzo', hazard: 1, profile: {} }); e2.startLayer(2); e2.t = 29.9; run(e2, Z, 12);
  const elites = e2.critters.filter(c => c.elite);
  assert.equal(elites.length, 1); assert.ok(near(elites[0].max, G.critterFluff(G.CRITTERS[elites[0].kind].fluff, 2, 1) * G.ELITE.fluff));
});

test('timer: the pod lands at 0:00 between 12 and 20 tiles away, and the run lasts 45 s', () => {
  const d = openDive(); assert.equal(d.timer, 300); assert.equal(d.pod, null);
  d.timer = 1; let n = 0, ev = [];
  while (!d.pod && n < 200) { ev = d.step(Z); n++; }
  assert.ok(Math.abs(n - 60) <= 1, `${n}`); assert.deepEqual(d.pod, { x: 48.5, y: 24.5, reached: false });
  assert.deepEqual(ev.filter(e => e.k === 'pod'), [{ k: 'pod', x: 48.5, y: 24.5 }]); assert.equal(d.timer, 45);
  n = 0; while (d.phase === 'play' && n < 5000) { d.step(Z); n++; }
  assert.ok(Math.abs(n - 45 * 60) <= 1, `${n}`);
  for (const seed of SEEDS) {
    const r = new G.Dive({ seed, hero: 'dora', hazard: 1, profile: {} }); r.spawning = false; r.timer = 0.001; r.step(Z);
    const dist = Math.hypot(r.pod.x - r.hx, r.pod.y - r.hy);
    assert.ok(dist >= 12 && dist <= 20, `seed ${seed}: ${dist}`); assert.equal(G.tileAt(r.map, Math.floor(r.pod.x), Math.floor(r.pod.y)), 'floor');
  }
  const five = openDive(); five.startLayer(5); assert.equal(five.timer, G.WYRM_AT);
  five.spawning = false; five.timer = 0.001; run(five, Z, 10); assert.equal(five.pod, null, 'no pod on layer 5 before the wyrm'); assert.equal(five.timer, 0);
});

test("pod: reaching it banks the layer's gold and opens phase pod; descend starts layer 2", () => {
  const d = openDive(); d.gold.banked = 5; d.gold.layer = 12; d.timer = 0.001; d.step(Z);
  assert.ok(d.pod); assert.equal(d.descend(), false, 'no descending while playing');
  d.hx = d.pod.x - 0.8; d.hy = d.pod.y;
  const ev = d.step(Z);
  assert.equal(d.phase, 'pod'); assert.ok(d.pod.reached); assert.deepEqual(d.gold, { banked: 17, layer: 0 }); assert.ok(ev.some(e => e.k === 'podReached'));
  assert.deepEqual(d.step(R), [], 'no steps at the pod');
  assert.equal(d.descend(), true);
  assert.equal(d.layer, 2); assert.equal(d.phase, 'play'); assert.equal(d.timer, 300); assert.equal(d.t, 0); assert.equal(d.pod, null);
  assert.deepEqual(d.map, G.makeMap(G.mix(1, 2), 2, null)); assert.deepEqual([d.hx, d.hy], [d.map.start.x + 0.5, d.map.start.y + 0.5]);
  assert.deepEqual(d.gold, { banked: 17, layer: 0 });
});

test('pod: missing it bonks the hero with result missed', () => {
  const d = openDive(); d.timer = 0.001; d.step(Z); d.gold.layer = 9;
  const ev = run(d, Z, 45 * 60 + 2);
  assert.equal(d.phase, 'over'); assert.equal(d.result, 'missed'); assert.equal(d.gold.banked, 4);
  assert.deepEqual(ev.filter(e => e.k === 'over'), [{ k: 'over', result: 'missed' }]); assert.equal(d.descend(), false);
});

test("bonked: at 0 Fluff, result bonked, half the layer's gold banked, rounded down", () => {
  const d = openDive({ hero: 'enzo' }); d.gold.layer = 7; d.fluff = 3; d.spawn('soot', d.hx, d.hy);
  const ev = d.step(Z);
  assert.equal(d.phase, 'over'); assert.equal(d.result, 'bonked'); assert.equal(d.fluff, 0); assert.equal(d.gold.banked, 3);
  assert.deepEqual(ev.at(-1), { k: 'over', result: 'bonked' }); assert.deepEqual(d.step(R), []);
});

test("bonked on the pod's step", () => {
  const d = openDive(); d.timer = 0.001; d.step(Z); d.gold.layer = 9; d.fluff = 2;
  d.hx = d.pod.x; d.hy = d.pod.y; d.spawn('soot', d.hx, d.hy);
  const ev = d.step(Z);
  assert.equal(d.result, 'bonked'); assert.equal(d.phase, 'over'); assert.ok(!d.pod.reached); assert.equal(d.gold.banked, 4);
  assert.ok(!ev.some(e => e.k === 'podReached'));
});

test('determinism: the same seed and inputs give the same events', () => {
  const play = () => {
    const d = new G.Dive({ seed: 42, hero: 'dora', hazard: 2, profile: {} }), out = [];
    for (let i = 0; i < 3000; i++) out.push(JSON.stringify(d.step({ x: Math.cos(i / 150), y: Math.sin(i / 97) })));
    out.push(JSON.stringify([d.hx, d.hy, d.fluff, d.gold, d.critters, d.map.tiles]));
    return out;
  };
  const a = play(), b = play();
  assert.deepEqual(a, b); assert.ok(a.some(s => s.includes('"hurt"')), 'critters reached the hero');
});

test('hz: 15 Hz moves as far per second as 60 Hz', () => {
  const a = openDive({ hz: 15 }), b = openDive(), go = { x: 1, y: 0.5 };
  assert.equal(a.dt, 1 / 15); run(a, go, 15); run(b, go, 60);
  assert.ok(Math.abs(a.hx - b.hx) < 0.05 && Math.abs(a.hy - b.hy) < 0.05, `${a.hx},${a.hy} vs ${b.hx},${b.hy}`);
});

test('stats: base, class, passives and camp upgrades combine', () => {
  const e = new G.Dive({ seed: 1, hero: 'enzo', hazard: 1, profile: { upgrades: { fluffier: 2, sharper: 3 } } }).stats();
  assert.equal(e.maxFluff, 116); assert.ok(near(e.damage, 1.15)); assert.ok(near(e.speed, 3.52)); assert.equal(e.dig, 1);
  const d = new G.Dive({ seed: 1, hero: 'dora', hazard: 1, profile: {} });
  assert.ok(near(d.fluff, 115)); assert.equal(d.stats().dig, 2); assert.equal(d.weapons[0].id, 'pickaxe'); assert.equal(d.weapons[0].level, 1);
  d.passives.paws = { n: 1, v: 0.06 }; assert.ok(near(d.stats().speed, 3.2 * 1.06));
});

process.exitCode = failed ? 1 : 0;
