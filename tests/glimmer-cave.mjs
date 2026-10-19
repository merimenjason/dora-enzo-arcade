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

process.exitCode = failed ? 1 : 0;
