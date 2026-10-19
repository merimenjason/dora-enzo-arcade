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
/** The dive tests' open cave. The hero and the buddy are unarmed unless `arms` keeps their weapons. */
function openDive(o = {}, arms = false) {
  const d = new G.Dive({ seed: 1, hero: 'dora', hazard: 1, profile: {}, ...o });
  d.map = openMap(); d.spawning = false; d.critters.length = 0; d.crystals.length = 0;
  if (!arms) { d.weapons = []; d.buddyWeapon = null; }
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

// ---- weapons ----

const HX = 32.5, HY = 24.5;
/** A dive holding one weapon with the given overclocks: no buddy, no crits, Fluff to spare. */
function armed(id, ocs = [], o = {}) {
  const d = openDive(o), w = G.newWeapon(id); w.overclocks = ocs;
  d.weapons = [w]; d.buddyWeapon = null; d.critOff = true; d.fluff = 1e9;
  return d;
}
/** A critter that `hold` puts back where it was placed before every step. */
function place(d, x, y, kind = 'soot', fluff = 999) { const c = d.spawn(kind, x, y); c.fluff = c.max = fluff; c.home = [x, y]; return c; }
/** Steps n times with the placed critters held still; each event carries the step it came in. */
function hold(d, n, input = Z) {
  const ev = [];
  for (let i = 0; i < n; i++) {
    for (const c of d.critters) if (c.home) { c.x = c.home[0]; c.y = c.home[1]; }
    for (const e of d.step(input)) ev.push({ ...e, step: i });
  }
  return ev;
}
const hits = ev => ev.filter(e => e.k === 'hit');
const shots = (d, k) => d.shots.filter(s => s.k === k);
/** Steps until the first hit, at most n steps, and returns it. */
function firstHit(d, n = 120) { for (let i = 0; i < n; i++) { const h = hits(hold(d, 1)); if (h.length) return { ...h[0], step: i }; } return null; }
/** Every distinct object of kind k seen in d.shots over n steps. */
function seen(d, k, n) { const s = new Set(); for (let i = 0; i < n; i++) { hold(d, 1); for (const x of shots(d, k)) s.add(x); } return s; }

test('weapons: each level-1 weapon hits a placed critter for its table damage at its table rate', () => {
  // weapon, the critter's offset from the hero, hits in 10 s
  const table = [
    ['sling', [3, 0], [16, 17]], ['pickaxe', [1, 0], [12, 12]], ['popper', [3, 0], [8, 9]], ['pulse', [1.5, 0], [5, 5]],
    ['lance', [3, 0], [7, 7]], ['puffer', [1.5, 0], [13, 13]], ['boomerang', [2, 0], [14, 16]], ['orbit', [1.6, 0], [14, 15]],
    ['bomb', [1, 0], [4, 4]], ['moths', [2, 0], [19, 23]], ['drum', [2, 0], [3, 3]], ['drill', [3, 0], [5, 5]],
  ];
  assert.equal(table.length, 12);
  for (const [id, [ox, oy], [lo, hi]] of table) {
    const d = armed(id); place(d, HX + ox, HY + oy);
    const ev = hold(d, 600), h = hits(ev);
    assert.ok(h.length >= lo && h.length <= hi, `${id}: ${h.length} hits`);
    assert.ok(near(h[0].dmg, G.WEAPONS[id].damage), `${id}: first hit ${h[0].dmg}`);
    assert.ok(h.every(e => near(e.dmg, h[0].dmg)), `${id}: every hit the same`);
    if (id === 'bomb') { const f = ev.find(e => e.k === 'fire'); assert.ok(Math.abs(h[0].step - f.step - 60) <= 1, `bomb: ${h[0].step - f.step} steps after the drop`); }
  }
});

test('weapons: the lance aims at its crowd, not the compass point', () => {
  for (const deg of [20, -20, 65]) {
    const d = armed('lance'), a = deg * Math.PI / 180, c = place(d, HX + 4 * Math.cos(a), HY + 4 * Math.sin(a));
    assert.ok(hits(hold(d, 1)).some(e => e.id === c.id), `${deg} degrees`);
  }
});

test('weapons: mining weapons dig', () => {
  for (const [id, x, n] of [['pickaxe', 33, 1], ['bomb', 33, 70], ['drill', 35, 40]]) {
    const d = armed(id); put(d, x, 24, 'dirt'); const ev = hold(d, n);
    assert.equal(G.tileAt(d.map, x, 24), 'floor', id); assert.ok(ev.some(e => e.k === 'dig' && e.x === x && e.progress === 1), id);
  }
  const d = armed('sling'); put(d, 34, 24, 'dirt'); place(d, HX + 4, HY);
  const ev = hold(d, 120);
  assert.equal(G.tileAt(d.map, 34, 24), 'dirt'); assert.equal(hits(ev).length, 0, 'the acorn stops at the dirt');
});

test('weapons: a card raises damage by 15% x rarity', () => {
  for (const [r, want] of [[0, 9.2], [3, 11.6]]) {
    const d = armed('sling'); d.weapons[0].dmg = G.CARD.damage * G.RARITY.mult[r]; place(d, HX + 3, HY);
    assert.ok(near(firstHit(d).dmg, want, 1e-9), `rarity ${r}`);
  }
  // The helper reads the card bonuses: rate shortens the cooldown, size grows radii, count adds acorns.
  const d = armed('sling'); Object.assign(d.weapons[0], { rate: 0.06, size: 0.1, count: 1 });
  const e = G.effective(d, d.weapons[0], 'hero');
  assert.ok(near(e.cd, 0.6 / 1.06)); assert.ok(near(e.size, 1.1)); assert.equal(e.count, 1);
  place(d, HX + 3, HY); hold(d, 1); assert.equal(shots(d, 'acorn').length, 2);
  const fires = hold(d, 80).filter(e => e.k === 'fire').map(e => e.step);
  assert.ok(Math.abs(fires[0] + 1 - 0.6 / 1.06 * 60) <= 1, `${fires[0]}`);
});

test("weapons: the buddy's sling does 4 and never levels", () => {
  const d = openDive({}, true); d.weapons = []; d.critOff = true; d.fluff = 1e9;
  assert.equal(d.buddyWeapon.id, 'sling'); assert.equal(new G.Dive({ seed: 1, hero: 'enzo', hazard: 1, profile: {} }).buddyWeapon.id, 'pickaxe');
  d.passives.claws = { n: 2, v: 0.16 };
  place(d, d.buddy.x + 3, d.buddy.y);
  const h = hits(hold(d, 300));
  assert.ok(h.length >= 7, `${h.length}`); assert.ok(h.every(e => near(e.dmg, 4)), `${h[0].dmg}`);
  assert.equal(d.buddyWeapon.level, 1); assert.deepEqual(d.buddyWeapon.overclocks, []);
  const hero = armed('sling'); hero.passives.claws = { n: 2, v: 0.16 }; place(hero, HX + 3, HY);
  assert.ok(near(firstHit(hero).dmg, 8 * 1.16), "the hero's hits take all-damage bonuses");
});

test('weapons: shots sweep their path at 15 Hz', () => {
  for (const id of ['sling', 'drill', 'boomerang', 'moths']) {
    const d = armed(id, [], { hz: 15 }); place(d, HX + 3, HY, 'mite');
    assert.ok(hits(hold(d, 30)).length >= 1, id);
  }
});

test('weapons: hits bonk at 0 Fluff, drop crystals and count', () => {
  const d = armed('sling'); const c = place(d, HX + 3, HY, 'beetle', 5);
  const ev = hold(d, 30);
  assert.ok(ev.some(e => e.k === 'bonk' && e.id === c.id && e.kind === 'beetle'));
  assert.equal(d.critters.length, 0); assert.equal(d.bonked, 1); assert.deepEqual(d.crystals.map(x => x.n), [G.CRITTERS.beetle.xp]);
  const e = armed('sling'); place(e, HX + 3, HY, 'soot', 5).elite = true; hold(e, 30);
  assert.deepEqual(e.crystals.map(x => x.n), [G.ELITE.cache]);
});

test('overclocks: each changes what it says', () => {
  const at = (d, x, y, ...r) => place(d, HX + x, HY + y, ...r);
  /** Each overclock: what to measure, given the overclocks held, and what it should be with this one. */
  const T = {
    'sling.twin': [ocs => { const d = armed('sling', ocs); at(d, 3, 0); hold(d, 1); const a = shots(d, 'acorn');
      return a.length === 2 ? Math.abs(Math.atan2(a[0].dy, a[0].dx) - Math.atan2(a[1].dy, a[1].dx)) * 180 / Math.PI : -a.length; }, v => near(v, 15, 1e-6)],
    'sling.heavy': [ocs => { const d = armed('sling', ocs); const c = at(d, 3, 0); c.stun = 100; let h = [];
      for (let i = 0; i < 60 && !h.length; i++) h = hits(d.step(Z)); return [h[0].dmg, c.x - (HX + 3)]; }, ([dmg, kx]) => near(dmg, 14.4, 1e-9) && near(kx, 0.5, 1e-9)],
    'sling.ricochet': [ocs => { const d = armed('sling', ocs); at(d, 3, 0); at(d, 4.5, 1); at(d, 6, 0); const ev = hold(d, 1); d.weapons[0].cd = 99;
      return new Set(hits([...ev, ...hold(d, 90)]).map(e => e.id)).size; }, v => v === 3],
    'sling.storm': [ocs => { const d = armed('sling', ocs); d.weapons[0].n = 4; at(d, 3, 0); hold(d, 1); return shots(d, 'acorn').length; }, v => v === 8],

    'pickaxe.wide': [ocs => { const d = armed('pickaxe', ocs); at(d, 0, -1); return hits(hold(d, 1)).length; }, v => v === 1],
    'pickaxe.double': [ocs => { const d = armed('pickaxe', ocs); at(d, 1, 0); const h = hits(hold(d, 40)); return h.length > 1 ? h[1].step - h[0].step : 0; }, v => Math.abs(v - 15) <= 1],
    'pickaxe.quake': [ocs => { const d = armed('pickaxe', ocs); at(d, 2.5, 0); return hits(hold(d, 1)).length; }, v => v === 1],
    'pickaxe.goldrush': [ocs => { const d = armed('pickaxe', ocs); put(d, 33, 24, 'gold'); hold(d, 1); return d.gold.layer; },
      v => { const d = armed('pickaxe'); put(d, 33, 24, 'gold'); hold(d, 1); return d.gold.layer > 0 && v === Math.round(d.gold.layer * 1.5); }],

    'popper.cluster': [ocs => { const d = armed('popper', ocs); at(d, 3, 0); hold(d, 1); d.weapons[0].cd = 99; return seen(d, 'splash', 60).size; }, v => v === 3],
    'popper.big': [ocs => { const d = armed('popper', ocs); at(d, 5.5, 0); const o = at(d, 7, 0); return hits(hold(d, 50)).some(e => e.id === o.id); }, v => v === true],
    'popper.sticky': [ocs => { const d = armed('popper', ocs); const c = at(d, 3, 0); hold(d, 45); return [c.slow, shots(d, 'patch').length]; }, ([s, n]) => near(s, 0.4) && n === 1],
    'popper.bouncy': [ocs => { const d = armed('popper', ocs); at(d, 3, 0); hold(d, 1); d.weapons[0].cd = 99; return seen(d, 'splash', 110).size; }, v => v === 3],

    'pulse.bright': [ocs => { const d = armed('pulse', ocs); at(d, 3.4, 0); return hits(hold(d, 60)).length; }, v => v === 1],
    'pulse.warm': [ocs => { const d = armed('pulse', ocs); const c = at(d, 1.5, 0); const h = firstHit(d); d.weapons[0].cd = 99;
      const s0 = c.slow; hold(d, 112); const s1 = c.slow; hold(d, 10); return [s0, s1, c.slow, h.step]; }, ([a, b, c]) => near(a, 0.25) && near(b, 0.25) && c === 0],
    'pulse.beacon': [ocs => { const d = armed('pulse', ocs); at(d, 4.5, 0); const h = hits(hold(d, 300)); return h.length === 1 && h[0].step >= 240; }, v => v === true],
    'pulse.hearth': [ocs => [3, 8].map(n => { const d = armed('pulse', ocs); d.fluff = 50;
      for (let i = 0; i < n; i++) at(d, 1.5 * Math.cos(i * Math.PI / 4), 1.5 * Math.sin(i * Math.PI / 4)); hold(d, 30); return d.fluff - 50; }), ([a, b]) => near(a, 3) && near(b, 5)],

    'lance.prism': [ocs => { const d = armed('lance', ocs); at(d, 3, 0); hold(d, 1); return shots(d, 'lance').length; }, v => v === 3],
    'lance.long': [ocs => { const d = armed('lance', ocs); for (let i = 0; i < 10; i++) at(d, 1.5 + i, 0); return hits(hold(d, 1)).length; }, v => v === 10],
    'lance.resonance': [ocs => { const d = armed('lance', ocs); at(d, 5.5, 0); const b = at(d, 6.2, 0.7); return hits(hold(d, 1)).filter(e => e.id === b.id).map(e => e.dmg); },
      v => v.length === 1 && near(v[0], 6)],
    'lance.glimmer': [ocs => { const d = armed('lance', ['lance.long', ...ocs]); let bonks = 0, doubles = 0;
      for (let k = 0; k < 1000 && bonks < 2000; k++) {
        d.critters.length = 0; d.crystals.length = 0; for (let i = 0; i < 10; i++) at(d, 2 + 0.5 * i, 0, 'soot', 1e-3);
        d.weapons[0].cd = 0; const b = hold(d, 1).filter(e => e.k === 'bonk').length; bonks += b; doubles += d.crystals.length - b;
      }
      return bonks >= 2000 ? doubles / bonks : -bonks; }, v => v >= 0.08 && v <= 0.12],

    'puffer.big': [ocs => { const d = armed('puffer', ocs); at(d, 1.5 * Math.SQRT1_2, -1.5 * Math.SQRT1_2); return hits(hold(d, 1)).length; }, v => v === 1],
    'puffer.sneezy': [ocs => { const d = armed('puffer', ocs); at(d, -1.5, 0); return hits(hold(d, 1)).length; }, v => v === 1],
    'puffer.cloud': [ocs => { const d = armed('puffer', ocs); const c = at(d, -4, 0); hold(d, 1); d.weapons[0].cd = 99; hold(d, 59); c.home = [HX + 1.5, HY];
      return hits(hold(d, 45)).length; }, v => v >= 1],
    'puffer.pepper': [ocs => { const d = armed('puffer', ocs); const c = at(d, 1.5, 0); const h = hits(hold(d, 1)); return [h[0].dmg, c.slow]; }, ([dmg, s]) => near(dmg, 10) && s === 0],

    'boomerang.pair': [ocs => { const d = armed('boomerang', ocs); hold(d, 1); return shots(d, 'twig').length; }, v => v === 2],
    'boomerang.long': [ocs => { const d = armed('boomerang', ocs); hold(d, 1); d.weapons[0].cd = 99; let far = 0;
      for (let i = 0; i < 120; i++) { hold(d, 1); for (const s of shots(d, 'twig')) far = Math.max(far, Math.hypot(s.x - HX, s.y - HY)); } return far; }, v => Math.abs(v - 6) < 0.15],
    'boomerang.whirl': [ocs => { const d = armed('boomerang', ocs); hold(d, 1); d.weapons[0].cd = 99; let still = 0, px = 0, py = 0;
      for (let i = 0; i < 150; i++) { hold(d, 1); const s = shots(d, 'twig')[0]; if (s && s.x === px && s.y === py) still++; if (s) { px = s.x; py = s.y; } } return still; }, v => Math.abs(v - 60) <= 2],
    'boomerang.sharp': [ocs => { const d = armed('boomerang', ocs); at(d, 2, 0); return firstHit(d).dmg; }, v => near(v, 15.3, 1e-9)],

    'orbit.more': [ocs => { const d = armed('orbit', ocs); hold(d, 1); return shots(d, 'seed').length; }, v => v === 5],
    'orbit.wide': [ocs => { const d = armed('orbit', ocs); hold(d, 2); return shots(d, 'seed').map(s => Math.hypot(s.x - HX, s.y - HY)); }, v => v.every(r => near(r, 2.4, 1e-9))],
    'orbit.twin': [ocs => { const d = armed('orbit', ocs); hold(d, 1); const s = shots(d, 'seed'); return [s.filter(x => x.dir > 0).length, s.filter(x => x.dir < 0).length]; },
      ([a, b]) => a === 3 && b === 3],
    'orbit.sprout': [ocs => { const d = armed('orbit', ocs); at(d, 1.6, 0); return seen(d, 'bramble', 120).size; }, v => v >= 1],

    'bomb.bigger': [ocs => { const d = armed('bomb', ocs); at(d, 2.2, 0); return hits(hold(d, 70)).length; }, v => v === 1],
    'bomb.quick': [ocs => { const d = armed('bomb', ocs); at(d, 1, 0); const ev = hold(d, 70), f = ev.find(e => e.k === 'fire'); return hits(ev)[0].step - f.step; }, v => Math.abs(v - 24) <= 1],
    'bomb.chain': [ocs => { const d = armed('bomb', ocs); const c = at(d, 2, 0); return hits(hold(d, 90)).filter(e => e.id === c.id).length; }, v => v === 1],
    'bomb.prospector': [ocs => { const d = armed('bomb', ocs); put(d, 33, 24, 'dirt'); hold(d, 70); return [G.tileAt(d.map, 33, 24), d.gold.layer]; }, ([t, g]) => t === 'floor' && g > 0],

    'moths.swarm': [ocs => { const d = armed('moths', ocs); hold(d, 1); return shots(d, 'moth').length; }, v => v === 4],
    'moths.dazzle': [ocs => { const d = armed('moths', ocs); const c = at(d, 2, 0); firstHit(d); return c.stun; }, v => v > 0.25 && v <= 0.3],
    'moths.moonlit': [ocs => { const d = armed('moths', ocs); at(d, 2, 0); at(d, 3, 0); return hits(hold(d, 30)).length; }, v => v === 3],
    'moths.firefly': [ocs => { const d = armed('moths', ocs); at(d, 0.8, 0); at(d, 3, 0); return hits(hold(d, 60)).some(e => near(e.dmg, 15)); }, v => v === true],

    'drum.deep': [ocs => { const d = armed('drum', ocs); at(d, 4.9, 0); return hits(hold(d, 1)).length; }, v => v === 1],
    'drum.quick': [ocs => { const d = armed('drum', ocs); at(d, 2, 0); const h = hits(hold(d, 200)); return h.length > 1 ? h[1].step - h[0].step : 0; }, v => Math.abs(v - 150) <= 1],
    'drum.avalanche': [ocs => { const d = armed('drum', ocs); put(d, 34, 24, 'dirt'); hold(d, 1); return G.tileAt(d.map, 34, 24); }, v => v === 'floor'],
    'drum.echo': [ocs => { const d = armed('drum', ocs); at(d, 2, 0); const h = hits(hold(d, 60)); return h.length > 1 ? h[1].step - h[0].step : 0; }, v => Math.abs(v - 30) <= 1],

    'drill.twin': [ocs => { const d = armed('drill', ocs); at(d, -3, 0); return hits(hold(d, 60)).length; }, v => v === 1],
    'drill.long': [ocs => { const d = armed('drill', ocs); at(d, 9, 0); return hits(hold(d, 90)).length; }, v => v === 1],
    'drill.diamond': [ocs => { const d = armed('drill', ocs); at(d, 3, 0); return firstHit(d).dmg; }, v => near(v, 16)],
    'drill.tunnelrat': [ocs => { const d = armed('drill', ocs); hold(d, 1); const a = d.stats().speed; d.weapons[0].cd = 99; hold(d, 123); return [a / 3.2, d.stats().speed / 3.2]; },
      ([a, b]) => near(a, 1.25) && near(b, 1)],
  };
  assert.equal(Object.keys(T).length, 48);
  for (const oc of Object.keys(G.OVERCLOCKS)) assert.ok(T[oc], `no check for ${oc}`);
  const bad = [];
  for (const [oc, [get, ok]] of Object.entries(T)) {
    try {
      const w = get([oc]), wo = get([]);
      if (!ok(w)) bad.push(`${oc}: with ${JSON.stringify(w)}`);
      if (ok(wo)) bad.push(`${oc}: the same without (${JSON.stringify(wo)})`);
    } catch (e) { bad.push(`${oc}: ${e.message}`); }
  }
  assert.deepEqual(bad, []);
});

// ── Levels, cards, rarity and rerolls ──────────────────────────────────────

/** A dive holding `ids` as weapons, with the cave empty, ready to level. */
function leveller(ids = ['sling'], o = {}) {
  const d = openDive(o); d.weapons = ids.map(id => G.newWeapon(id)); return d;
}
const level = d => { d.collect(G.xpNeed(d.level)); d.step(Z); };
const cardKey = c => `${c.k}:${c.id ?? ''}`;
const isValid = c => c.k === 'snack' || G.RARITY.names[c.rarity ?? 0];

test('levels: 8 crystals reach level 2 and open a pick of three distinct valid cards', () => {
  const d = leveller(); d.collect(8);
  assert.equal(d.level, 2); assert.equal(d.xp, 0); assert.equal(d.picks, 1); assert.equal(d.phase, 'play');
  const ev = d.step(Z);
  assert.ok(ev.some(e => e.k === 'level') || d.phase === 'pick');
  assert.equal(d.phase, 'pick'); assert.equal(d.offer.length, 3);
  assert.equal(new Set(d.offer.map(cardKey)).size, 3);
  for (const c of d.offer) { assert.ok(['weapon', 'passive'].includes(c.k)); assert.ok(isValid(c)); }
  const lv = openDive(); lv.collect(8); assert.ok(lv.events.some(e => e.k === 'level' && e.level === 2));
  // Leftover experience carries over.
  const e = leveller(); e.collect(10); assert.equal(e.level, 2); assert.equal(e.xp, 2);
});

test('levels: with a free slot, an offer holds a new weapon', () => {
  const d = leveller(['sling']);
  for (let i = 0; i < 200; i++) {
    const o = d.deal();
    assert.ok(o.some(c => c.k === 'weapon' && c.id !== 'sling'), `deal ${i}`);
    assert.equal(new Set(o.map(cardKey)).size, o.length);
  }
  // Unlocked weapons join the pool; locked ones never appear.
  const locked = leveller(['sling']), seenIds = new Set();
  for (let i = 0; i < 300; i++) for (const c of locked.deal()) if (c.k === 'weapon') seenIds.add(c.id);
  assert.ok(!seenIds.has('bomb') && !seenIds.has('drill'));
  const unl = leveller(['sling'], { profile: { unlocked: { weapons: ['bomb'] } } }), seen2 = new Set();
  for (let i = 0; i < 300; i++) for (const c of unl.deal()) if (c.k === 'weapon') seen2.add(c.id);
  assert.ok(seen2.has('bomb'));
});

test('levels: rarity scales a passive', () => {
  const d = leveller(); d.offer = [{ k: 'passive', id: 'paws', rarity: 3 }]; d.phase = 'pick'; d.picks = 1;
  assert.equal(d.pick(0), true);
  assert.ok(near(d.passives.paws.v, 0.18)); assert.equal(d.passives.paws.n, 1);
  assert.equal(d.phase, 'play'); assert.equal(d.picks, 0);
  // Rarity is rolled from the hazard's weights: Epic stays rare, and Common is the commonest.
  const r = leveller(), count = [0, 0, 0, 0];
  for (let i = 0; i < 400; i++) for (const c of r.deal()) if (c.rarity !== undefined) count[c.rarity]++;
  assert.ok(count[0] > count[1] && count[1] > count[2] && count[2] > count[3] && count[3] > 0, count.join());
  // Thick Fluff adds its amount to max Fluff and heals it.
  const f = leveller(); f.fluff = 50; const before = f.stats().maxFluff;
  f.offer = [{ k: 'passive', id: 'fluff', rarity: 1 }]; f.phase = 'pick'; f.picks = 1; f.pick(0);
  const cls = G.CLASS.dora.fluff;
  assert.ok(near(f.stats().maxFluff, before + 22.5 * cls)); assert.ok(near(f.fluff, 72.5));
});

test("levels: a weapon card raises its level, damage and that level's step", () => {
  const d = leveller(['sling']); d.offer = [{ k: 'weapon', id: 'sling', rarity: 2 }]; d.phase = 'pick'; d.picks = 1; d.pick(0);
  const w = d.weapons[0], step = G.WEAPONS.sling.steps[0];
  assert.equal(w.level, 2); assert.ok(near(w.dmg, 0.3)); assert.ok(near(w[step], step === 'count' ? 1 : G.CARD[step] * 2));
  // A new weapon joins at level 1.
  d.offer = [{ k: 'weapon', id: 'pulse', rarity: 0 }]; d.phase = 'pick'; d.picks = 1; d.pick(0);
  assert.equal(d.weapons.length, 2); assert.equal(d.weapons[1].id, 'pulse'); assert.equal(d.weapons[1].level, 1); assert.equal(d.weapons[1].dmg, 0);
});

test("levels: at level 4 a weapon's next card is an overclock pair; picking one makes it level 5 with that overclock", () => {
  for (const [lv, pair, next] of [[4, 'oc5', 5], [9, 'oc10', 10]]) {
    const d = leveller(['sling', 'pulse']); d.weapons[0].level = lv; level(d);
    assert.equal(d.phase, 'pick');
    assert.deepEqual(d.offer.map(c => c.k), ['overclock', 'overclock']);
    assert.deepEqual(d.offer.map(c => c.id).sort(), [...G.WEAPONS.sling[pair]].sort());
    const id = d.offer[1].id; assert.equal(d.pick(1), true);
    assert.equal(d.weapons[0].level, next); assert.deepEqual(d.weapons[0].overclocks, [id]);
  }
  // With two waiting, the lower slot's pair comes first, and the weapon is out of normal offers.
  const d = leveller(['sling', 'pulse']); d.weapons[0].level = 9; d.weapons[1].level = 4; d.deal();
  assert.ok(d.deal().every(c => c.id.startsWith('sling.')));
  const f = leveller(['sling', 'pulse', 'pickaxe', 'popper']); f.weapons[2].level = 4;
  assert.ok(f.deal().every(c => c.k === 'overclock'));
  f.weapons[2].level = 5;
  for (let i = 0; i < 100; i++) assert.ok(f.deal().every(c => c.k !== 'overclock'));
});

test('levels: four slots fill, then only those weapons and passives are offered', () => {
  const held = ['sling', 'pulse', 'pickaxe', 'popper'], d = leveller(held);
  for (let i = 0; i < 200; i++) {
    const o = d.deal(); assert.equal(o.length, 3); assert.equal(new Set(o.map(cardKey)).size, 3);
    for (const c of o) { assert.ok(c.k === 'passive' || (c.k === 'weapon' && held.includes(c.id)), cardKey(c)); }
  }
});

test('levels: nothing past its cap', () => {
  const d = leveller(['sling', 'pulse', 'pickaxe', 'popper']); d.weapons[0].level = 12; d.passives.fluff = { n: 5, v: 75 };
  for (let i = 0; i < 500; i++) for (const c of d.deal()) {
    assert.ok(!(c.k === 'weapon' && c.id === 'sling'), 'weapon at 12');
    assert.ok(!(c.k === 'passive' && c.id === 'fluff'), 'passive at 5');
  }
  assert.equal(d.weapons[0].level, 12);
});

test('stacked level-ups and an empty pool', () => {
  const d = leveller(['sling']); d.collect(20);
  assert.equal(d.level, 3); assert.equal(d.picks, 2); assert.equal(d.xp, 1);
  d.step(Z); assert.equal(d.phase, 'pick');
  assert.equal(d.step(Z).length, 0);
  assert.equal(d.pick(0), true); assert.equal(d.phase, 'pick'); assert.equal(d.picks, 1); assert.equal(d.offer.length, 3);
  assert.equal(d.pick(0), true); assert.equal(d.phase, 'play'); assert.equal(d.picks, 0);
  // Play resumes only after the last pick.
  const t = d.t; d.step(Z); assert.ok(d.t > t);
  // Nothing valid: a single Snack that heals 20.
  const e = leveller(['sling', 'pulse', 'pickaxe', 'popper']);
  for (const w of e.weapons) w.level = 12;
  for (const id of G.PASSIVE_IDS) e.passives[id] = { n: 5, v: 1 };
  e.fluff = 50; e.collect(8); e.step(Z);
  assert.deepEqual(e.offer, [{ k: 'snack' }]);
  assert.equal(e.pick(0), true); assert.ok(near(e.fluff, 70)); assert.equal(e.phase, 'play');
  e.fluff = e.stats().maxFluff - 5; e.collect(G.xpNeed(e.level)); e.step(Z); e.pick(0); assert.ok(near(e.fluff, e.stats().maxFluff));
});

test('levels: head start opens the first picks at once', () => {
  const d = new G.Dive({ seed: 1, hero: 'dora', hazard: 1, profile: { upgrades: { headstart: 2 } } });
  assert.equal(d.level, 3); assert.equal(d.picks, 2); assert.equal(d.phase, 'pick'); assert.ok(d.offer.length > 0);
  d.pick(0); d.pick(0); assert.equal(d.phase, 'play'); assert.equal(d.level, 3);
});

test('rerolls: one per layer, refreshed on descend; an overclock offer can\'t be rerolled', () => {
  const d = leveller(); assert.equal(d.rerolls, 1);
  d.collect(8); d.step(Z);
  assert.equal(d.reroll(), true); assert.equal(d.rerolls, 0); assert.equal(d.offer.length, 3); assert.equal(d.phase, 'pick');
  assert.equal(d.reroll(), false);
  d.pick(0); d.pod = { x: 34, y: 25, reached: true }; d.phase = 'pod';
  assert.equal(d.descend(), true); assert.equal(d.rerolls, 1);
  const o = leveller(['sling']); o.weapons[0].level = 4; level(o);
  assert.equal(o.offer[0].k, 'overclock'); const offer = JSON.stringify(o.offer);
  assert.equal(o.reroll(), false); assert.equal(o.rerolls, 1); assert.equal(JSON.stringify(o.offer), offer);
  assert.equal(new G.Dive({ seed: 1, hero: 'dora', hazard: 1, profile: { upgrades: { rerolls: 2 } } }).rerolls, 3);
});

test('illegal actions change nothing', () => {
  const snap = d => JSON.stringify({ phase: d.phase, level: d.level, xp: d.xp, picks: d.picks, offer: d.offer, weapons: d.weapons, passives: d.passives, rerolls: d.rerolls });
  const d = leveller();
  let before = snap(d);
  assert.equal(d.pick(0), false); assert.equal(d.reroll(), false); assert.equal(snap(d), before);
  d.collect(8); d.step(Z); before = snap(d);
  assert.equal(d.pick(5), false); assert.equal(d.pick(-1), false); assert.equal(d.descend(), false);
  assert.deepEqual(d.step(Z), []); assert.equal(snap(d), before);
  d.reroll(); before = snap(d);
  assert.equal(d.reroll(), false); assert.equal(snap(d), before);
});

process.exitCode = failed ? 1 : 0;
