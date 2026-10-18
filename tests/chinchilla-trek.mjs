import assert from 'node:assert/strict';
import * as G from '../.checks/chinchilla-trek-game.js';

let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`ok   ${name}`); } catch (e) { failed++; console.log(`FAIL ${name}\n${e.stack}`); }
}
const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

// ---- the data ----

test('data: 18 skills and 4 evolutions', () => {
  assert.equal(G.SKILL_IDS.length, 18); assert.equal(Object.keys(G.SKILLS).length, 18);
  assert.deepEqual([...G.EVO_IDS], ['storm', 'fury', 'bramble', 'feast']);
  const used = new Set();
  for (const id of G.EVO_IDS) {
    const [a, b] = G.EVOS[id].from;
    assert.ok(G.SKILLS[a] && G.SKILLS[b] && a !== b, id);
    for (const s of [a, b]) { assert.ok(!used.has(s), `${s} is in two evolutions`); used.add(s); }
  }
  assert.deepEqual(G.EVOS.storm.from, ['combo', 'static']); assert.deepEqual(G.EVOS.fury.from, ['keen', 'grit']);
  assert.deepEqual(G.EVOS.bramble.from, ['shell', 'prickle']); assert.deepEqual(G.EVOS.feast.from, ['snack', 'nap']);
});

test('data: skill values match the spec', () => {
  const want = {
    combo: [0.2, 0.35, 0.5], counter: [0.2, 0.35, 0.5], sharp: [0.15, 0.25, 0.4], keen: [0.1, 0.2, 0.3], fluff: [0.2, 0.35, 0.5],
    shell: [0.15, 0.25, 0.4], dust: [0.08, 0.15, 0.22], static: [0.5, 0.8, 1.2], snack: [0.08, 0.14, 0.2], nap: [0.02, 0.04, 0.06],
    grit: [0.3, 0.5, 0.8], prickle: [0.15, 0.25, 0.4], pounce: [2, 3, 4], roll: [1, 1.5, 2], pepper: [0.1, 0.15, 0.2],
    frost: [0.12, 0.2, 0.28], lucky: [0.2, 0.4, 0.6], wind: [0.3, 0.5, 0.7],
  };
  assert.deepEqual(Object.keys(want), [...G.SKILL_IDS], 'spec order');
  for (const [id, v] of Object.entries(want)) { assert.deepEqual([...G.SKILLS[id].v], v, id); assert.equal(G.SKILLS[id].text.length, 3, id); }
  assert.equal(G.ZAP_CHANCE, 0.25);
});

test('data: 5 chapters, each with 4 foes, an elite and a boss of the right rank and chapter', () => {
  assert.deepEqual(G.CHAPTERS.map((c) => c.name), ['Clover Meadow', 'Bramble Wood', 'Willow River', 'Frosty Peak', 'Moon Hollow']);
  assert.equal(Object.keys(G.FOES).length, 30);
  G.CHAPTERS.forEach((ch, i) => {
    assert.equal(ch.no, i + 1); assert.equal(ch.foes.length, 4);
    for (const f of ch.foes) { assert.equal(G.FOES[f].rank, 'foe', f); assert.equal(G.FOES[f].chapter, ch.no, f); }
    assert.equal(G.FOES[ch.elite].rank, 'elite'); assert.equal(G.FOES[ch.boss].rank, 'boss');
    assert.equal(G.FOES[ch.elite].chapter, ch.no); assert.equal(G.FOES[ch.boss].chapter, ch.no);
  });
  assert.deepEqual(G.CHAPTERS.map((c) => c.boss), ['kingmole', 'badger', 'otter', 'foxqueen', 'hornedowl']);
  const base = { foe: [40, 6], elite: [90, 8], boss: [180, 11] };
  for (const f of Object.values(G.FOES)) {
    const [h, a] = base[f.rank];
    assert.ok(f.hp >= h * 0.8 - 1e-9 && f.hp <= h * 1.2 + 1e-9 && f.atk >= a * 0.8 - 1e-9 && f.atk <= a * 1.2 + 1e-9, `${f.id} within 20% of its rank`);
  }
});

test('data: elites and bosses all have traits', () => {
  const want = { hedgepig: 'shell', kingmole: 'rage', raccoon: 'double', badger: 'rage', turtle: 'shell', otter: 'double', pika: 'swift', foxqueen: 'chill', shadowcat: 'swift', hornedowl: 'regen', wasp: 'sting' };
  for (const [id, t] of Object.entries(want)) assert.equal(G.FOES[id].trait, t, id);
  for (const f of Object.values(G.FOES)) if (f.rank !== 'foe') assert.ok(f.trait, f.id);
});

test('data: scenes', () => {
  const rollable = G.SCENES.filter((s) => !s.followUp), ids = new Set(G.SCENES.map((s) => s.id));
  assert.equal(ids.size, G.SCENES.length, 'unique ids');
  assert.ok(rollable.length >= 20, `${rollable.length} rollable scenes`);
  for (const n of [1, 2, 3, 4, 5]) assert.ok(rollable.filter((s) => s.chapter === n).length >= 2, `chapter ${n}`);
  assert.ok(rollable.filter((s) => s.chapter === 0).length >= 8, 'general scenes');
  for (const s of G.SCENES) {
    assert.equal(s.choices.length, 2, s.id);
    for (const c of s.choices) {
      if (c.odds !== undefined) { assert.ok(c.odds > 0 && c.odds < 1 && c.lose && c.loseText, `${s.id} odds`); }
      for (const e of [...c.win, ...(c.lose ?? [])]) if (e.k === 'later') { const f = G.SCENES.find((x) => x.id === e.scene); assert.ok(f?.followUp, `${s.id} → ${e.scene}`); }
    }
    const words = JSON.stringify(s).toLowerCase();
    for (const bad of ['kill', ' die', 'dead', 'blood', 'steal']) assert.ok(!words.includes(bad), `${s.id} says ${bad}`);
  }
  for (const id of ['mushroom', 'bird', 'dustbath', 'pip']) assert.ok(ids.has(id), `the spec's ${id} scene`);
});

test('data: day weights sum to 100, fixed days per the spec', () => {
  assert.equal(Object.values(G.DAY_WEIGHTS).reduce((a, b) => a + b, 0), 100);
  assert.deepEqual(G.DAY_WEIGHTS, { fight: 40, story: 20, cache: 12, find: 10, rest: 8, wheel: 5, pedlar: 5 });
  assert.deepEqual({ ...G.FIXED_DAYS }, { 10: 'elite', 15: 'crossroads', 20: 'elite', 25: 'pedlar', 30: 'boss' });
});

test('data: gear and rarities', () => {
  assert.deepEqual([...G.RARITY], ['Plain', 'Fine', 'Rare', 'Grand', 'Legend']);
  assert.deepEqual(G.GEAR_STAT.hat, [10, 20, 35, 55, 80]); assert.deepEqual(G.GEAR_STAT.scarf, [1, 2, 4, 6, 9]);
  assert.ok(near(G.GEAR_STAT.charm[4], 0.12) && near(G.GEAR_STAT.boots[4], 0.08));
});

test('rand and mix are deterministic', () => {
  const a = new G.Rand(7), b = new G.Rand(7);
  for (let i = 0; i < 20; i++) assert.equal(a.next(), b.next());
  assert.equal(G.mix(3, 4), G.mix(3, 4)); assert.notEqual(G.mix(3, 4), G.mix(4, 3));
});

if (failed) { console.log(`${failed} failed`); process.exit(1); }
console.log('PASS Chinchilla Trek engine');
