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

process.exitCode = failed ? 1 : 0;
