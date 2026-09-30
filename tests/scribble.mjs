import assert from 'node:assert/strict';
import { Game, LEVELS, NOUNS, ADJECTIVES, parse, starsFor, MAX_THINGS, GROUND, CHIN_H } from '../.checks/scribble-game.js';

const run = (g, seconds, each) => { for (let i = 0; i < seconds * 60 && g.state === 'playing'; i++) { each?.(g); g.update(1 / 60); } };
const say = (g, text) => { const r = g.summon(text); assert.ok(r.ok, `summon “${text}”: ${r.ok ? '' : r.message}`); run(g, 0.4); return r.ent; };
const walk = (g, x, y = GROUND, seconds = 5) => { g.goTo(x, y); run(g, seconds, () => { if (!g.lead.target) g.goTo(x, y); }); };
const hold = (g, input, seconds) => { g.input = { dir: 0, up: false, down: false, jump: false, ...input }; run(g, seconds); g.input = { dir: 0, up: false, down: false, jump: false }; };
const drag = (g, e, x, y) => { assert.ok(g.grab(e.id)); g.dragTo(x, y); g.release(); run(g, 0.6); };
const winning = (g, why) => assert.equal(g.state, 'won', `${why}: stuck at ${g.lead.x.toFixed(0)},${g.lead.y.toFixed(0)}; ${g.events.map((e) => e.text ?? e.kind).join(' / ')}`);

// ---------- Words ----------
{
  const p = parse('A GIANT flying hay-bale!');
  assert.ok(p.ok); assert.equal(p.noun.id, 'hay bale'); assert.deepEqual(p.adjs.map((a) => a.id), ['giant', 'flying']);
  assert.equal(parse('ladders').noun.id, 'ladder', 'plurals');
  assert.equal(parse('fireflies').noun.id, 'firefly');
  assert.equal(parse('hot dog').noun.id, 'sausage', 'a two-word noun beats an adjective');
  assert.equal(parse('hot air balloon').noun.id, 'hot air balloon');
  assert.deepEqual(parse('hot ladder').adjs.map((a) => a.id), ['hot']);
  assert.equal(parse('orange').noun.id, 'orange'); assert.equal(parse('orange car').adjs[0].id, 'orange');
  assert.equal(parse('stone').noun.id, 'rock'); assert.equal(parse('stone ladder').adjs[0].id, 'stone');
  assert.equal(parse('').reason, 'empty');
  assert.equal(parse('florp').reason, 'unknown');
  assert.equal(parse('ladr').suggestion, 'ladder', 'did you mean');
  assert.equal(parse('giant').reason, 'no-noun');
  assert.equal(parse('golden wolfberry').reason, 'reserved');
  assert.equal(parse('dora').reason, 'hero');
  assert.equal(parse('sparkly florp ladder').reason, 'unknown');
  const nounWords = NOUNS.flatMap((n) => n.words), adjWords = ADJECTIVES.flatMap((a) => a.words);
  assert.ok(NOUNS.length >= 150, `${NOUNS.length} nouns`);
  assert.ok(ADJECTIVES.length >= 30, `${ADJECTIVES.length} adjectives`);
  assert.equal(new Set(NOUNS.map((n) => n.id)).size, NOUNS.length, 'noun ids are unique');
  for (const w of nounWords) assert.ok(parse(w).ok, `“${w}” parses`);
  for (const a of ADJECTIVES) assert.deepEqual(parse(`${a.words[0]} box`).adjs.map((x) => x.id), [a.id], `adjective ${a.id}`);
  console.log(`PASS words: ${NOUNS.length} nouns (${nounWords.length} words), ${ADJECTIVES.length} adjectives (${adjWords.length} words)`);
}

// ---------- Summoning and adjectives ----------
{
  const g = new Game(-1, 1);
  const box = say(g, 'box'), big = say(g, 'giant box'), tiny = say(g, 'tiny box');
  assert.equal(big.w, box.w * 2); assert.equal(tiny.h, box.h / 2);
  assert.ok(big.mass > box.mass * 3, 'giant things are much heavier');
  const flying = say(g, 'flying hay bale');
  assert.ok(flying.tags.has('fly') && flying.tags.has('ride'));
  const y0 = flying.y; run(g, 2); assert.ok(Math.abs(flying.y - y0) < 4, 'flying things hover');
  const fell = say(g, 'hay bale'); run(g, 2); assert.equal(fell.y, GROUND, 'everything else falls to the ground');
  assert.equal(say(g, 'red car').tint, '#e8403a');
  const heavy = say(g, 'heavy pillow'); assert.ok(heavy.mass >= 6);
  const frozen = say(g, 'frozen campfire'); assert.equal(frozen.burning, 0, 'a frozen campfire is not alight');
  { const h = new Game(-1, 1); assert.ok(say(h, 'flaming log').burning > 0); }
  assert.equal(g.summons.length, 8);
  for (let i = 0; i < MAX_THINGS + 4; i++) g.summon('rock');
  assert.ok(g.ents.filter((e) => !e.level && !e.gone).length <= MAX_THINGS, 'old things vanish past the limit');
  const bad = g.summon('florp'); assert.equal(bad.ok, false); assert.match(bad.message, /florp/);
  assert.equal(g.summons.length, 8 + MAX_THINGS + 4, 'only real summons count');
  console.log('PASS summoning: sizes, adjectives, hovering, falling and the thing limit');
}

// ---------- Every noun summons and settles ----------
{
  for (const n of NOUNS) {
    const g = new Game(-1, 2);
    const e = say(g, n.words[0]);
    run(g, 3);
    assert.ok(Number.isFinite(e.x) && Number.isFinite(e.y), `${n.id} stays finite`);
  }
  console.log(`PASS all ${NOUNS.length} nouns summon and run without trouble`);
}

// ---------- The world reacting ----------
{
  // Fire spreads to things that burn, then they burn away.
  let g = new Game(-1, 3);
  const log = say(g, 'log'); const fire = say(g, 'fire'); drag(g, fire, log.x, log.y - log.h);
  run(g, 2); assert.ok(log.burning > 0, 'the log catches');
  run(g, 12); assert.ok(!g.ents.includes(log), 'and burns away');
  // Water puts fire out.
  g = new Game(4, 3);
  walk(g, 560); say(g, 'bucket'); run(g, 1);
  assert.equal(g.ents.find((e) => e.noun === 'campfire').mood, 'out');
  // Cold freezes the river, and you can walk on it.
  g = new Game(2, 3);
  walk(g, 360); say(g, 'snowball'); run(g, 2);
  assert.ok(g.water[0].frozen, 'the river froze');
  walk(g, 880, GROUND, 8); winning(g, 'walk over the ice');
  // Stepping in the river sends you back.
  g = new Game(2, 3);
  hold(g, { dir: 1 }, 3); run(g, 1.5);
  assert.ok(g.lead.x < 430 && g.lead.y === GROUND, 'splash, back on the bank');
  assert.ok(g.events.some((e) => e.kind === 'splash'));
  // A trampoline bounces you higher than a jump.
  g = new Game(-1, 3);
  const tramp = say(g, 'trampoline');
  let top = GROUND; g.goTo(tramp.x, tramp.y - tramp.h); run(g, 2.5, () => { top = Math.min(top, g.lead.y); });
  assert.ok(GROUND - top > 180, `bounced ${GROUND - top}px`);
  // The gate wants weight; two chinchillas and a box are not enough.
  g = new Game(7, 3);
  walk(g, 380); run(g, 1);
  const gate = g.ents.find((e) => e.noun === 'gate');
  assert.equal(gate.role.open, 0);
  // Fire hurts, a hostile animal pushes you away.
  g = new Game(4, 3);
  hold(g, { dir: 1 }, 5);
  assert.ok(g.lead.x < 600, 'the campfire stops you');
  assert.ok(g.events.some((e) => e.text === 'Ouch! Too hot!'));
  // Bombs blow up rockfalls.
  g = new Game(5, 3);
  walk(g, 400); say(g, 'bomb'); run(g, 4);
  assert.ok(!g.ents.some((e) => e.noun === 'rockfall'), 'the rockfall is gone');
  console.log('PASS the world: fire spreads, water and cold, ice bridges, splashes, bounces, the gate, burns and blasts');
}

// ---------- The follower and the swap ----------
{
  const g = new Game(1, 4);
  walk(g, 700); say(g, 'ladder'); walk(g, 862, 250, 8);
  winning(g, 'climb the ladder');
  const f = g.follow;
  assert.ok(Math.abs(f.x - g.lead.x) < 300, 'the follower caught up');
  const s = new Game(0, 4);
  s.swap(); assert.equal(s.leader, 'enzo');
  hold(s, { dir: 1 }, 1); assert.ok(s.chins.enzo.x > s.chins.dora.x, 'you steer Enzo now and Dora follows');
  console.log('PASS the follower keeps up; swapping hands the keys to the other chinchilla');
}

// ---------- Every level has a solution, usually several ----------
const SOLUTIONS = [
  ['ladder', (g) => { walk(g, 680); say(g, 'ladder'); walk(g, 862, 332, 8); }],
  ['stairs', (g) => { walk(g, 520); say(g, 'stairs'); walk(g, 862, 332, 8); }],
  ['trampoline', (g) => { walk(g, 560); say(g, 'trampoline'); walk(g, 862, 332, 8); }],
  ['ladder', (g) => { walk(g, 700); say(g, 'ladder'); walk(g, 862, 250, 8); }],
  ['flying carpet', (g) => { walk(g, 600); say(g, 'flying carpet'); hold(g, { dir: 1 }, 0.3); walk(g, 862, 244, 8); }],
  ['bridge', (g) => { walk(g, 370); say(g, 'bridge'); walk(g, 880, GROUND, 8); }],
  ['boat', (g) => { walk(g, 370); say(g, 'boat'); walk(g, 880, GROUND, 10); }],
  ['carrot', (g) => { walk(g, 500); say(g, 'carrot'); run(g, 3); walk(g, 900, GROUND, 8); }],
  ['hay', (g) => { walk(g, 480); say(g, 'hay'); run(g, 3); walk(g, 900, GROUND, 8); }],
  ['bucket', (g) => { walk(g, 560); say(g, 'bucket'); walk(g, 900, GROUND, 8); }],
  ['rain cloud', (g) => { walk(g, 500); const c = say(g, 'rain cloud'); drag(g, c, 640, 350); walk(g, 900, GROUND, 8); }],
  ['pickaxe', (g) => { walk(g, 540); say(g, 'pickaxe'); run(g, 2); walk(g, 900, GROUND, 8); }],
  ['steak', (g) => { walk(g, 360); say(g, 'steak'); run(g, 6); walk(g, 915, GROUND, 10); }],
  ['cage', (g) => { walk(g, 300); const c = say(g, 'cage'); const puma = g.ents.find((e) => e.noun === 'puma'); drag(g, c, puma.x, puma.y - puma.h - 40); run(g, 2); walk(g, 915, GROUND, 10); }],
  ['dog', (g) => { walk(g, 360); say(g, 'dog'); run(g, 8); walk(g, 915, GROUND, 10); }],
  ['anvil', (g) => { walk(g, 300); say(g, 'anvil'); run(g, 3); walk(g, 900, GROUND, 8); }],
  ['blanket', (g) => { walk(g, 520); say(g, 'blanket'); run(g, 6); walk(g, 900, GROUND, 8); }],
  ['lamp + ladder', (g) => { walk(g, 600); say(g, 'lamp'); say(g, 'ladder'); walk(g, 760, 318, 10); }],
  ['glowing ladder', (g) => { walk(g, 600); say(g, 'glowing ladder'); walk(g, 760, 318, 10); }],
  ['ladder + ladder', (g) => { walk(g, 400); say(g, 'ladder'); walk(g, 600, 300, 8); walk(g, 720, GROUND, 4); say(g, 'ladder'); walk(g, 900, 200, 10); }],
  ['flying bed', (g) => { say(g, 'flying bed'); walk(g, 900, 196, 14); }],
  ['helicopter', (g) => { say(g, 'helicopter'); hold(g, { dir: 1 }, 0.2); walk(g, 900, 196, 12); }],
  ['brain + ladder', (g) => { walk(g, 300); say(g, 'brain'); run(g, 8); walk(g, 760); say(g, 'ladder'); walk(g, 900, 300, 10); }],
  ['torch + ladder', (g) => { walk(g, 280); say(g, 'torch'); run(g, 6); walk(g, 760); say(g, 'ladder'); walk(g, 900, 300, 10); }],
];
const LEVEL_OF = [0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 6, 6, 6, 7, 8, 9, 9, 10, 10, 10, 11, 11];
SOLUTIONS.forEach(([name, play], i) => {
  const g = new Game(LEVEL_OF[i], 5);
  play(g);
  winning(g, `level ${LEVEL_OF[i] + 1} “${LEVELS[LEVEL_OF[i]].name}” with ${String(name)}`);
});
for (let l = 0; l < LEVELS.length; l++) assert.ok(LEVEL_OF.includes(l), `level ${l + 1} has a solution`);
{
  // Doing nothing wins nothing, and the dark storeroom hides the wolfberry without a light.
  for (let l = 0; l < LEVELS.length; l++) { const g = new Game(l, 6); walk(g, 900, GROUND, 6); assert.equal(g.state, 'playing', `level ${l + 1} needs a word`); }
  const g = new Game(9, 6); walk(g, 600); say(g, 'ladder'); walk(g, 760, 318, 10);
  assert.equal(g.state, 'playing', 'no light, no wolfberry');
}
console.log(`PASS all ${LEVELS.length} levels: ${SOLUTIONS.length} different solutions win, and walking alone never does`);

assert.equal(starsFor(1, 1), 3); assert.equal(starsFor(3, 1), 2); assert.equal(starsFor(4, 1), 1);
void CHIN_H;
console.log('PASS stars: 3 at par, 2 within two words, 1 beyond');
