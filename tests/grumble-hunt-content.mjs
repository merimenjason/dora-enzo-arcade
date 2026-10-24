import assert from 'node:assert/strict';
import {
  MATERIALS, DROPS, ITEMS, BASIC_WEAPONS, POST_GAME_WEAPONS, MH_EQUIVALENT, FIRST_PICKS, SNACKS, WEAPON_TYPES, WEAPON_TREE, ARMOUR_SETS, SLOTS, STORY, BEAST_ORDER, BEAST_MATS,
  rollShed, rollCalm, rollGather, canAfford, pay, add, cap, weaponNode, nextNodes, weaponStats, armourCost, armourBonus, validate,
} from '../.checks/grumble-hunt-content.js';

/** mulberry32, as in the engines: the same seed gives the same rolls everywhere. */
const rng = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

// the content is self-consistent: no unknown materials, nothing asked for before it can be had, kind story text
assert.deepEqual(validate(), []);

// the icon cells line up with the icon sheets: 16 materials in 16 cells, items in their own order
assert.deepEqual(Object.values(MATERIALS).map((m) => m.icon).sort((a, b) => a - b), [...Array(16).keys()]);
assert.equal(new Set(Object.values(ITEMS).map((i) => i.icon)).size, Object.keys(ITEMS).length);

// twenty weapon types: the fourteen basic ones you can pick at the start, one per Monster Hunter Wilds type,
// two of Grumble Hunt's own that the story unlocks, and four more that post-game goals unlock. Each has tiers
// 1 and 2, then two branches of tiers 3, 4 and the Glimmer tier 5.
const TYPES = Object.keys(WEAPON_TYPES);
assert.equal(TYPES.length, 20);
assert.equal(BASIC_WEAPONS.length, 14);
assert.deepEqual(TYPES.filter((w) => WEAPON_TYPES[w].chapter === 0).sort(), [...BASIC_WEAPONS].sort());
assert.deepEqual(TYPES.filter((w) => !BASIC_WEAPONS.includes(w)).sort(), ['feather', 'pogo', 'puffer', 'umbrella', 'wand', 'yoyo']);
assert.deepEqual([...POST_GAME_WEAPONS].sort(), ['feather', 'pogo', 'puffer', 'umbrella']);
for (const w of POST_GAME_WEAPONS) assert.equal(WEAPON_TYPES[w].chapter, 6, w);
assert.deepEqual(Object.keys(MH_EQUIVALENT).sort(), [...BASIC_WEAPONS].sort());
assert.equal(new Set(Object.values(MH_EQUIVALENT)).size, 14);
for (const w of FIRST_PICKS) assert.ok(BASIC_WEAPONS.includes(w), w);
assert.deepEqual(STORY[0].unlocks.weapons, BASIC_WEAPONS);
assert.deepEqual(STORY.flatMap((c) => c.unlocks.weapons ?? []).sort(), TYPES.filter((w) => !POST_GAME_WEAPONS.includes(w)).sort(), 'every story type is unlocked exactly once');
assert.equal(WEAPON_TREE.length, 20 * (2 + 2 * 3));
assert.equal(new Set(WEAPON_TREE.map((n) => n.name)).size, 20 * 7, 'every tier name is unique, apart from each type\'s shared Glimmer name');
for (const type of Object.keys(WEAPON_TYPES)) {
  assert.deepEqual(nextNodes(`${type}-1`).map((n) => n.id), [`${type}-2`]);
  assert.deepEqual(nextNodes(`${type}-2`).map((n) => n.id).sort(), [`${type}-3A`, `${type}-3B`]);
  for (const b of ['A', 'B']) assert.equal(weaponNode(`${type}-5${b}`).perks.at(-1).id, 'warm-glow');
}
// stats grow with the tier and perks carry up a branch
assert.deepEqual(weaponStats('hammer-1'), { bonk: 12, dizzy: 14, speed: 'slow', perks: [] });
assert.equal(weaponStats('hammer-4A').bonk, Math.round(12 * 2.1));
assert.deepEqual(weaponStats('hammer-4A').perks.map((p) => p.id), ['charge-speed', 'shockwave']);
assert.throws(() => weaponStats('hammer-9'));

// pouch arithmetic never goes negative and respects carry limits
let pouch = add({}, ['berry', 'berry', 'berry']);
assert.equal(pouch.berry, 3);
assert.ok(canAfford(pouch, ITEMS.fluffberry.recipe));
assert.throws(() => pay(pouch, { berry: 4 }));
pouch = pay(pouch, { berry: 2 });
assert.equal(pouch.berry, 1);
assert.equal(add({ 'dizzy-bell': 2 }, ['dizzy-bell'])['dizzy-bell'], cap('dizzy-bell'));

// armour: two pieces of a set switch on its first skill, three switch on both; sets mix
assert.deepEqual(armourBonus({}), { fluff: 0, skills: [] });
assert.deepEqual(armourBonus({ helm: 'bristleback-helm', vest: 'bristleback-vest' }).skills.map((s) => s.id), ['steady-paws']);
assert.deepEqual(armourBonus({ helm: 'bristleback-helm', vest: 'bristleback-vest', boots: 'bristleback-boots' }).skills.map((s) => s.id), ['steady-paws', 'charge-guard']);
assert.deepEqual(armourBonus({ helm: 'skreel-helm', vest: 'hornclack-vest', boots: 'skreel-boots' }), { fluff: 7 + 12 + 7, skills: [ARMOUR_SETS.skreel.two] });
assert.deepEqual(armourCost('puffwart-vest'), { 'wart-pebble': 3, 'cloud-wisp': 1 });

// drops replay exactly from a seed, and nap rewards include the materials for broken parts
const a = rng(7), b = rng(7);
assert.deepEqual(rollCalm(a, 'bristleback', ['tusks']), rollCalm(b, 'bristleback', ['tusks']));
assert.ok(rollCalm(rng(1), 'hornclack', ['shell', 'horn']).filter((m) => m === 'horn-chip').length >= 1);
assert.ok(rollCalm(rng(1), 'bristleback', ['tusks']).includes('tusk-shard'));
let sheds = 0; const r = rng(3); for (let i = 0; i < 10000; i++) if (rollShed(r, 'bristleback')) sheds++;
assert.ok(Math.abs(sheds / 10000 - DROPS.bristleback.shed.chance) < 0.02, `shed rate ${sheds / 10000}`);
assert.ok(rollGather(rng(2), 'marsh').filter((m) => m === 'marsh-reed').length === 8);

// story: chapters 0 to 5 in order, every beast met, every page names a panel the art prompt asks for
assert.deepEqual(STORY.map((c) => c.id), [0, 1, 2, 3, 4, 5]);
assert.deepEqual([...new Set(STORY.map((c) => c.beast))], BEAST_ORDER);
const panels = new Set(['story-0a', 'story-0b', 'story-1', 'story-1-end', 'story-2', 'story-3', 'story-4', 'story-5a', 'story-5b', 'story-end']);
for (const c of STORY) for (const p of [...c.intro, ...c.outro]) assert.ok(panels.has(p.panel), `${c.id}: panel ${p.panel}`);
for (const [id, s] of Object.entries(SNACKS)) assert.ok(Object.keys(s.cost).length > 0, id);

// No grind walls. A bot plays the story: before each chapter's hunt it crafts the gear the chapter expects
// (`ready`), hunting earlier beasts again only when it can't afford it yet. Each chapter must be ready
// within 6 hunts, counting the repeats. A hunt bonks about 30 times, breaks every part and naps the beast.
function hunt(r, beast, area, pouch) {
  const got = [];
  for (let i = 0; i < 30; i++) { const m = rollShed(r, beast); if (m) got.push(m); }
  got.push(...rollCalm(r, beast, Object.keys(DROPS[beast].parts)), ...rollGather(r, area));
  return add(pouch, got);
}
function playStory(seed, start = 'hammer') {
  const r = rng(seed); let pouch = {}, weapon = `${start}-1`; const armour = [], hunts = [];
  const met = [];
  for (const c of STORY) {
    let count = 0;
    const wantTier = c.ready?.weaponTier ?? 1, wantArmour = c.ready?.armourPieces ?? 0;
    const tryCraft = () => {
      while (weaponNode(weapon).tier < wantTier) {
        // take the next node it can afford, preferring a branch whose beast it has already met
        const next = nextNodes(weapon).filter((n) => canAfford(pouch, n.cost));
        if (!next.length) break; pouch = pay(pouch, next[0].cost); weapon = next[0].id;
      }
      for (const beast of met) for (const slot of SLOTS) {
        if (armour.length >= wantArmour) break;
        const piece = `${beast}-${slot}`;
        if (!armour.includes(piece) && canAfford(pouch, armourCost(piece))) { pouch = pay(pouch, armourCost(piece)); armour.push(piece); }
      }
      return weaponNode(weapon).tier >= wantTier && armour.length >= wantArmour;
    };
    while (!tryCraft()) {
      // farm the most recent beast met that drops something still missing for whatever is short: the next
      // weapon node while the weapon tier is short, armour pieces only while armour is short (as the Forge shows)
      const short = [
        ...(weaponNode(weapon).tier < wantTier ? nextNodes(weapon).map((n) => n.cost) : []),
        ...(armour.length < wantArmour ? met.flatMap((m) => SLOTS.filter((s) => !armour.includes(`${m}-${s}`)).map((s) => armourCost(`${m}-${s}`))) : []),
      ];
      const wanted = short.flatMap((cost) => Object.entries(cost).filter(([id, n]) => (pouch[id] ?? 0) < n).map(([id]) => id));
      const drops = (beast) => { const d = DROPS[beast]; return [d.shed.id, ...Object.values(d.parts), ...d.calm.common, d.calm.rare.id]; };
      const beast = [...met].reverse().find((m) => drops(m).some((id) => wanted.includes(id))) ?? met.at(-1) ?? 'bristleback';
      const prev = STORY.find((p) => p.beast === beast && p.id > 0) ?? STORY[0];
      pouch = hunt(r, prev.beast, prev.area, pouch); count++;
      assert.ok(count < 50, `chapter ${c.id} never becomes ready`);
    }
    pouch = hunt(r, c.beast, c.area, pouch); count++;
    if (!met.includes(c.beast)) met.push(c.beast);
    hunts.push(count);
  }
  return { hunts, weapon, armour };
}
const worst = STORY.map(() => 0);
for (const start of BASIC_WEAPONS) for (let seed = 1; seed <= 40; seed++) {
  const { hunts } = playStory(seed, start);
  hunts.forEach((n, ch) => (worst[ch] = Math.max(worst[ch], n)));
  hunts.forEach((n, ch) => assert.ok(n <= 6, `${start}, seed ${seed}: chapter ${ch} took ${n} hunts (${hunts.join(', ')})`));
}
const sample = playStory(1);
console.log(`grumble-hunt content: ok (most hunts any chapter took over ${BASIC_WEAPONS.length} starting weapons × 40 seeds: ${worst.join(', ')}; seed 1 ends with ${weaponNode(sample.weapon).name} and ${sample.armour.length} armour pieces)`);
void BEAST_MATS;
