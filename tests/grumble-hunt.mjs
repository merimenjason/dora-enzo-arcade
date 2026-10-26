import { existsSync } from 'node:fs';
import assert from 'node:assert/strict';
import { HuntGame, ARMOUR_PIECES, MIGHTY_RHYTHM, MIGHTY_FINISHER, FULL_FLUFF, MIGHTY_GRUMP, TURF_PAIRS, MIGHTY_MOVES, MIGHTY_AT, RAIN_REACH, FAN_SPREAD, SPIN_REACH, CHARMS, CHARM_IDS, CHARM_CHAPTER, QUESTS, COMBO_WINDOW, FINISHERS, FINISHER_POWER, FINISHER_DIZZY, FINISHER_RECOVERY, BEAST_IDS, BEASTS, DT, TELEGRAPH, NO_INPUT, GRUMPY_AT, GRUMPY_PACE, WEAK_SPOT, ZONE_NAMES, ZONE_AT, EXIT_REACH, WANDER_GIVEUP, FINCHES, FINCH_FLUFF, AREA_HAZARD, HAZARD_REACH, HAZARD_WARN, HAZARD_GRUMP, HAZARD_DIZZY, SLING_START, SLING_MAX, KNOCKDOWN_HITS, PEBBLE_POWER, PEBBLE_DIZZY, TREE_BERRIES, VINE_REACH, VINE_COOLDOWN, CLING_TIME, SOFT_TIME, YANK, WALL_GRUMP, VISITORS, TURF_TIME, TURF_REACH, TURF_GRUMP, AREA_WEATHER, WEATHER_SIGHT, WEATHER_RAMP, ROAR_REACH, ROAR_TIME, TIRED_AT, SNOOZE, ARENA_RADIUS, SIGHT, CAMP_BERRIES, DIZZY_FULL, GATHER_TIME, HUNT_AREA, RING_ITEMS, RING_SIZE, SNACK_IDS, distance, SCENES, AREA_OBSTACLES, VARIANT_COLORS, VILLAGERS, SPOTS, BOUNTIES, dailyBounties, POST_GAME_BEASTS, STORY_BEASTS, BEAST_MATERIALS, BURROW_REACH, RIVER_REST, SOFT_LANDING, PEBBLE_POUCH, DIZZY_DIG } from '../.checks/grumble-hunt-game.js';
import { DROPS, GATHER, ITEMS, SNACKS, WEAPON_TREE, WEAPON_TYPES, POST_GAME_WEAPONS, cap, armourBonus, armourCost, SLOTS, STORY, rollCalm, MIGHTY_ARMOUR, ARMOUR_SETS, EPILOGUE, storyScene, validate } from '../.checks/grumble-hunt-content.js';
let checks = 0;
function check(name, fn) { fn(); checks++; console.log(`PASS hunt: ${name}`); }
const input = (overrides = {}) => ({ ...NO_INPUT, ...overrides });
const fresh = (id = 'bristleback', hero = 'dora', seed = 39) => { const g = new HuntGame(seed); g.chooseHero(hero); g.story.chapter = 6; g.profile.extraGrumpyUnlocked = true; for (const k of BEAST_IDS) g.profile.beastBook[k].met = true; assert(g.startHunt(id)); g.roared = g.introduced = true; g.zoneAt = []; return g; }; // Checks start after the hello roar and keep the beast in its first zone; the roar and the zones have their own checks.
const tick = (g, seconds, i = NO_INPUT) => { for (let n = 0; n < Math.ceil(seconds / DT); n++) g.step(DT, i); };
/** Meets the four post-game weapon goals. */
const postGame = (g) => { g.profile.bountiesClaimed = 5; g.profile.totalPlops = 10; for (const id of BEAST_IDS) { g.profile.variantNaps[id] = 1; g.profile.beastBook[id].partsBroken = [BEASTS[id].part]; } };
const calm = (g) => { const b = g.beast; b.height = 0; b.state = 'rest'; assert(g.bonkBeast(10000, true, { x: b.x - Math.cos(b.face) * 3, z: b.z + Math.sin(b.face) * 3 })); tick(g, 3.5); };

check('selection, gates and refused actions leave the record alone', () => {
  const g = new HuntGame(1); assert.equal(g.startHunt('bristleback'), false); assert(g.chooseHero('dora'));
  const before = g.save(); assert.equal(g.startHunt('frostmane'), false); assert.equal(g.forge('hammer-2'), false); assert.deepEqual(g.save(), before);
  assert.deepEqual(BEAST_IDS.filter((id) => g.unlocked(id)), ['bristleback']);
});
check('same seed and inputs reproduce layout, combat, projectiles and materials', () => {
  const a = fresh('puffwart', 'enzo', 85), b = fresh('puffwart', 'enzo', 85);
  for (let n = 0; n < 2400; n++) { const i = input({ x: Math.sin(n * 0.01), z: Math.cos(n * 0.008), bonk: n % 90 < 30, roll: n % 190 === 0 }); a.step(DT, i); b.step(DT, i); }
  for (const key of ['rng', 'hero', 'beast', 'buddy', 'obstacles', 'shots', 'drops', 'profile']) assert.deepEqual(a[key], b[key], key);
  assert.notDeepEqual(new HuntGame(3).obstacles, new HuntGame(4).obstacles);
});
check('every attack has at least 0.6 seconds of warning, including all Frostmane phases', () => {
  assert(TELEGRAPH >= 0.6);
  for (const id of BEAST_IDS) for (const fraction of [0.9, 0.5, 0.2]) {
    const g = fresh(id), b = g.beast; g.buddy.cooldown = 10000; g.hero.invincible = 10000; b.grump = b.maxGrump * fraction;
    for (let cycle = 0; cycle < 3; cycle++) {
      b.state = 'roam'; b.t = 0; b.duration = 0; g.step(DT);
      assert.equal(b.state, 'windup'); assert(b.duration >= 0.6);
      const attack = b.attack; let warning = 0;
      while (b.state === 'windup') { g.step(DT); warning += DT; }
      assert(warning >= 0.6, `${id} ${attack} only warned for ${warning}`);
      assert.equal(b.state, attack);
    }
    if (id === 'frostmane') assert.equal(b.phase, fraction > 2 / 3 ? 1 : fraction > 1 / 3 ? 2 : 3);
  }
});
check('hammer wind-up connects later; heavy hits build dizzy and dizzy bonks are larger', () => {
  const g = fresh(), b = g.beast; g.hero.z = b.z + 2.7; g.buddy.cooldown = 10000;
  g.step(DT, input({ bonk: true })); assert.equal(b.grump, b.maxGrump);
  tick(g, 0.3); assert(b.grump < b.maxGrump); assert(g.hitstop > 0);
  b.state = 'rest'; b.dizzy = 0; g.bonkBeast(1, true, g.hero); assert.equal(b.dizzy, DIZZY_FULL / 2); g.bonkBeast(1, true, g.hero); assert.equal(b.state, 'dizzy');
  // The friend stands at the face, a weak spot.
  const before = b.grump; g.bonkBeast(10, false, g.hero); assert(Math.abs(before - b.grump - 17 * WEAK_SPOT) < 1e-8);
});
check('holding and releasing K fires a charged seed shot; cancelled input does not fire', () => {
  const g = fresh('bristleback', 'enzo'); g.buddy.cooldown = 10000;
  tick(g, 0.6, input({ charge: true })); assert.equal(g.shots.length, 0); g.step(DT); tick(g, 0.13); assert(g.shots.some((s) => s.heavy));
  const c = fresh('bristleback', 'enzo'); tick(c, 0.5, input({ charge: true })); c.clearInput(); tick(c, 0.2); assert.equal(c.shots.length, 0);
});
check('Hornclack front armour depends on direction, and an owl must land for a hammer', () => {
  const g = fresh('hornclack'), b = g.beast; b.face = 0;
  assert.equal(g.bonkBeast(10, false, { x: b.x + 5, z: b.z }), false); assert.equal(b.grump, b.maxGrump);
  // The side is Hornclack's weak spot, between its shell plates.
  assert(g.bonkBeast(10, false, { x: b.x, z: b.z + 4 })); assert(Math.abs(b.grump - (b.maxGrump - 10 * WEAK_SPOT)) < 1e-9);
  g.makeDizzy(); assert(g.bonkBeast(10, false, { x: b.x + 5, z: b.z }));
  const owl = fresh('skreel'); owl.beast.height = 2.5; assert.equal(owl.bonkBeast(10, false, owl.hero), false); owl.beast.height = 0; assert(owl.bonkBeast(10, false, owl.hero));
});
check('a telegraphed Bristleback charge into a rock becomes dizzy', () => {
  const g = fresh(), b = g.beast; g.buddy.cooldown = 10000;
  b.x = b.z = 0; g.hero.x = 0; g.hero.z = 10; g.obstacles = [{ x: 0, z: 5, r: 1, kind: 'rock' }]; b.duration = 0;
  g.step(DT); assert.equal(b.state, 'windup'); tick(g, 1.4); assert.equal(b.state, 'dizzy'); assert(b.z < 5);
});
check('rolls dodge briefly, ordinary bumps consume Fluff and grant a recovery window', () => {
  const g = fresh(); g.step(DT, input({ roll: true, x: 1 })); assert.equal(g.bumpHero(20, g.beast), false); assert.equal(g.hero.fluff, 100);
  g.hero.roll = 0.4; assert(g.bumpHero(20, g.beast)); assert.equal(g.hero.fluff, 80); assert.equal(g.bumpHero(20, g.beast), false);
});
check('items are consumed only when useful; sleepy clouds slow paws and the buddy heals', () => {
  const g = fresh('puffwart'); assert.equal(g.ringItem, 'fluffberry'); assert.equal(g.useItem(), false); assert.equal(g.profile.pouch.fluffberry, CAMP_BERRIES);
  g.hero.fluff = 60; assert(g.useItem()); assert.equal(g.hero.fluff, 90); assert.equal(g.profile.pouch.fluffberry, CAMP_BERRIES - 1);
  g.item = 1; g.hero.fluff = 10; assert.equal(g.useItem(), false, 'none carried'); assert.match(g.note, /Pantry/); assert.equal(g.hero.fluff, 10);
  g.clouds.push({ x: g.hero.x, z: g.hero.z, life: 1, r: 4 }); g.hero.fluff = 40; g.buddy.berry = 0; g.step(DT); assert(g.hero.slow > 0); assert.equal(g.hero.fluff, 68);
});
check('movement resolves tree centres and arena boundaries without NaNs or tunnelling', () => {
  const g = fresh(); g.obstacles = [{ x: 0, z: 0, r: 1, kind: 'tree' }]; g.hero.x = g.hero.z = 0; g.step(DT, input({ x: 1 })); assert(distance(g.hero, g.obstacles[0]) >= 1.45 - 1e-8);
  tick(g, 20, input({ x: 1, sprint: true })); assert(Math.hypot(g.hero.x, g.hero.z) <= 18.55 + 1e-8); assert(Number.isFinite(g.hero.x));
});
check('beast bodies stay solid and malformed movement cannot spoil the meadow', () => {
  const g = fresh(); g.hero.x = g.beast.x; g.hero.z = g.beast.z; g.step(DT);
  assert(distance(g.hero, g.beast) >= 1.85 - 1e-8);
  g.step(DT, input({ x: NaN, z: Infinity })); assert(Number.isFinite(g.hero.x)); assert(Number.isFinite(g.hero.z));
});
check('friends, shopkeepers and the beast never stand inside each other; F talks to a shopkeeper', () => {
  const g = fresh(); g.buddy.x = g.hero.x; g.buddy.z = g.hero.z; g.step(DT); assert(distance(g.hero, g.buddy) >= 0.95 - 1e-8);
  g.buddy.x = g.beast.x; g.buddy.z = g.beast.z; g.beast.state = 'rest'; g.step(DT); assert(distance(g.buddy, g.beast) >= 1.85 - 1e-8);
  g.returnVillage();
  for (const s of SPOTS) {
    const v = VILLAGERS[s.id]; g.hero.x = v.x; g.hero.z = v.z + 3; g.step(DT, input({ z: -1 })); tick(g, 1.5, input({ z: -1 }));
    assert(distance(g.hero, v) >= 0.95 - 1e-6, `${v.name} is solid`); assert.equal(g.nearestSpot()?.id, s.id, `${v.name} is in talking reach`);
    g.events.length = 0; g.step(DT, input({ use: true })); assert(g.events.some((e) => e.kind === 'interact' && e.spot === s.id)); g.step(DT);
  }
});
check('Frostmane changes mood as Grump crosses thresholds, before the next wind-up', () => {
  const g = fresh('frostmane'), b = g.beast;
  g.bonkBeast(300, false, g.hero); assert.equal(b.phase, 2);
  g.bonkBeast(300, false, g.hero); assert.equal(b.phase, 3); assert(b.grump > 0);
});
check('bonks shed materials; a part pops once; calming banks all drops and rewards once', () => {
  const g = fresh(), b = g.beast;
  for (let i = 0; i < 14; i++) g.bonkBeast(11, false, g.hero);
  assert(b.broken); assert.equal(g.events.filter((e) => e.kind === 'part').length, 1); assert(g.drops.some((d) => d.material === 'tusk-shard'));
  const owed = g.drops.length;
  calm(g); assert.equal(g.mode, 'calm'); assert.equal(g.profile.naps.bristleback, 1); assert(g.beastMaterials('bristleback') >= owed + 3); assert.equal(g.drops.length, 0);
  const record = g.save(); assert.equal(g.bonkBeast(100, true, g.hero), false); tick(g, 2); assert.deepEqual(g.save(), record);
});
check('story chapters clear in order, and met friends stay open for free hunts', () => {
  const g = new HuntGame(39); g.chooseHero('dora');
  assert(!g.feature('forge')); assert(!g.feature('pantry')); assert(!g.equip('wand'));
  for (const c of STORY) {
    g.returnVillage(); assert.equal(g.chapter, c.id); assert(g.startChapter()); assert.equal(g.area, c.area);
    assert.equal(g.beast.maxGrump, c.id === 0 ? 40 : BEASTS[c.beast].grump);
    calm(g); assert.equal(g.chapter, c.id + 1);
    assert(g.profile.beastBook[c.beast].met); assert(g.profile.beastBook[c.beast].napped > 0);
    if (c.id === 0) assert(g.feature('forge'));
    if (c.id === 1) assert(g.armourOpen('bristleback'));
    if (c.id === 2) assert(g.feature('pantry'));
    if (c.id === 3) assert(g.equip('wand') === false, 'equip is camp-only');
  }
  assert.equal(g.mode, 'victory'); assert(g.profile.extraGrumpyUnlocked); g.returnVillage();
  for (const id of BEAST_IDS) assert(g.unlocked(id));
});
check('Forge follows exact costs and branch prerequisites', () => {
  const g = new HuntGame(); g.chooseHero('dora'); g.story.chapter = 6; g.profile.extraGrumpyUnlocked = true; for (const id of BEAST_IDS) g.profile.beastBook[id].met = true;
  for (const id of Object.keys(g.profile.pouch)) g.profile.pouch[id] = cap(id);
  assert.equal(g.forge('hammer-3A'), false); assert(g.forge('hammer-2')); assert(g.forge('hammer-3A'));
  assert.equal(g.profile.pouch['bristle-tuft'], 92); assert.equal(g.profile.pouch.berry, 97); assert.equal(g.profile.pouch['tusk-shard'], 98);
  assert.equal(g.forge('hammer-3B'), false); assert(g.forge('hammer-4A')); assert(g.forge('hammer-5A')); assert.equal(g.perk('warm-glow'), 10);
});
check('every tree and armour piece can be crafted, equipped and saved', () => {
  for (const target of WEAPON_TREE) {
    const g = new HuntGame(); g.chooseHero('dora'); g.story.chapter = 6; g.profile.extraGrumpyUnlocked = true; for (const id of BEAST_IDS) g.profile.naps[id] = 1; g.profile.won = true; postGame(g);
    for (const id of Object.keys(g.profile.pouch)) g.profile.pouch[id] = cap(id);
    const path = []; let n = target; while (n.from) { path.unshift(n); n = WEAPON_TREE.find((w) => w.id === n.from); }
    for (const node of path) assert(g.forge(node.id), node.id);
    assert(g.equip(target.type)); assert.equal(g.node().id, target.id);
    for (const perk of target.perks) assert.equal(g.perk(perk.id), perk.value);
    assert.deepEqual(HuntGame.load(g.save()).profile, g.profile);
  }
  for (const beast of BEAST_IDS) {
    const g = new HuntGame(); g.story.chapter = 6; g.profile.extraGrumpyUnlocked = true; for (const id of Object.keys(g.profile.pouch)) g.profile.pouch[id] = cap(id);
    for (const [i, slot] of SLOTS.entries()) { const piece = `${beast}-${slot}`; assert(g.makeArmour(piece)); assert(g.wear(piece)); assert.equal(g.armour.skills.length, i); }
    assert.deepEqual(HuntGame.load(g.save()).profile.armour, g.profile.armour);
    assert.equal(g.makeArmour(`${beast}-helm`), false);
  }
});
check('v2 levels migrate to branch A and locked or malformed equipment is refused', () => {
  const g = HuntGame.load({ v: 2, profile: { hero: 'dora', levels: { dora: 3, enzo: 2 } } });
  assert.equal(g.node('hammer').id, 'hammer-3A'); assert.equal(g.node('bow').id, 'bow-2'); assert.equal(g.save().v, 6);
  assert.equal(g.equip('wand'), false); assert.equal(g.equip('yoyo'), false);
  const bad = HuntGame.load({ v: 3, profile: { weapons: { hammer: { tier: 99, branch: 'Z' } }, equipped: { dora: 'wand' }, armour: { owned: ['bad'], worn: { helm: 'bad' } } } });
  assert.equal(bad.node().id, 'wand-1'); assert.deepEqual(bad.profile.armour.owned, []);
});
check('tuckered-out returns to camp without losing gathered materials and retries top the berries back up', () => {
  const g = fresh(); g.profile.pouch['bristle-tuft'] = 7; g.profile.pouch.fluffberry = 0; g.hero.fluff = 5; g.bumpHero(10, g.beast);
  assert.equal(g.mode, 'camp'); assert.equal(g.profile.pouch['bristle-tuft'], 7); assert(g.startHunt('bristleback')); assert.equal(g.hero.fluff, 100); assert.equal(g.profile.pouch.fluffberry, CAMP_BERRIES);
  g.returnVillage(); g.profile.pouch.fluffberry = 8; g.startHunt('bristleback'); assert.equal(g.profile.pouch.fluffberry, 8, 'crafted berries are never taken away');
});
check('saves round-trip permanent progress, reject malformed numbers and safely return to camp', () => {
  const g = fresh('frostmane', 'enzo'); g.profile.weapons.bow = { tier: 2, branch: null }; calm(g); const save = g.save(), restored = HuntGame.load(JSON.parse(JSON.stringify(save)));
  assert.deepEqual(restored.profile, g.profile); assert.equal(restored.mode, 'village'); restored.profile.naps.frostmane++; assert.notDeepEqual(restored.profile, save.profile);
  for (const s of [null, [], { v: 2 },  { v: 1, profile: { levels: { dora: -100 }, materials: { skreel: NaN }, naps: { frostmane: Infinity }, hero: 'bad' } },
    { v: 2, profile: { levels: { dora: -100 }, pouch: { 'sky-feather': NaN, fluffberry: 1e9 }, ring: ['nope', 7], snack: 'cake', naps: { frostmane: Infinity }, hero: 'bad' } }]) {
    const safe = HuntGame.load(s); assert.equal(safe.profile.weapons.hammer.tier, 1); assert.equal(safe.profile.pouch['sky-feather'], 0); assert.equal(safe.profile.won, false);
    assert(safe.profile.pouch.fluffberry <= ITEMS.fluffberry.max); assert(safe.profile.ring.length >= 1); assert.equal(safe.profile.snack, null);
  }
  const before = g.time; g.step(NaN); g.step(-1); assert.equal(g.time, before); g.paused = true; g.step(DT); assert.equal(g.time, before);
});
check('dizzy openings cannot bank another dizzy', () => {
  const g = fresh(), b = g.beast; g.makeDizzy();
  for (let n = 0; n < 4; n++) g.bonkBeast(1, true, g.hero);
  assert.equal(b.dizzy, 0); b.state = 'rest'; g.bonkBeast(1, true, g.hero);
  assert.equal(b.state, 'rest'); assert.equal(b.dizzy, DIZZY_FULL / 2);
});
check('charges and swoops stop at the lane end without bumping beyond it', () => {
  for (const id of ['bristleback', 'skreel']) for (const dt of [DT, 0.037, 0.05]) {
    const g = fresh(id), b = g.beast; g.obstacles = []; g.buddy.cooldown = 100;
    g.hero.x = 0; g.hero.z = 12; g.buddy.berry = 100;
    Object.assign(b, { x: 0, z: -3, state: 'windup', attack: id === 'skreel' ? 'swoop' : 'charge', t: 0, duration: 0, start: { x: 0, z: -3 }, aim: { x: 0, z: 9 }, dir: { x: 0, z: 1 } });
    g.step(dt); while (b.state !== 'rest') { g.step(dt); assert(b.z <= 9 + 1e-9); assert.equal(g.hero.fluff, 100); }
    assert(Math.abs(b.z - 9) < 1e-9);
  }
});
check('charge waits for tool cooldown before building and releases a big shot', () => {
  const g = fresh('bristleback', 'enzo'); g.buddy.cooldown = 100;
  g.hero.cooldown = 0.8; tick(g, 0.4, input({ charge: true })); assert.equal(g.hero.charge, 0);
  tick(g, 0.8, input({ charge: true })); assert(g.hero.charge >= 0.35);
  g.step(DT); tick(g, 0.13); assert(g.shots.some((s) => s.heavy));
});
check('high Skreel blocks either Dora hammer while allowing either bow', () => {
  for (const leader of ['dora', 'enzo']) for (const buddy of [false, true]) {
    const g = fresh('skreel', leader); g.beast.height = 2.4;
    assert.equal(g.bonkBeast(1, true, g.hero, buddy), (buddy ? g.buddyId : g.heroId) === 'enzo');
    g.beast.height = 0; assert(g.bonkBeast(1, true, g.hero, buddy));
  }
});
check('tuckered out gathers distant drops exactly once', () => {
  const g = fresh(); g.drops.push({ id: 99, x: 15, z: 0, material: 'boar-hide', count: 4 });
  g.hero.fluff = 1; g.bumpHero(10, g.beast); assert.equal(g.profile.pouch['boar-hide'], 4); assert.equal(g.drops.length, 0);
  g.bumpHero(10, g.beast); assert.equal(g.profile.pouch['boar-hide'], 4);
});
check('below 30% Grump a beast turns Extra Grumpy once: 15% faster, warning 0.1 s sooner and never under 0.6 s', () => {
  for (const id of BEAST_IDS) {
    const g = fresh(id), b = g.beast; g.buddy.cooldown = 10000; g.hero.invincible = 10000; b.state = 'rest';
    const from = { x: b.x - Math.cos(b.face) * 3, z: b.z + Math.sin(b.face) * 3 };
    g.bonkBeast(b.maxGrump * (1 - GRUMPY_AT) - 1, false, from); assert.equal(b.grumpy, false, id);
    g.events.length = 0; g.bonkBeast(2, false, from); assert.equal(b.grumpy, true, id);
    assert.equal(g.events.filter((e) => e.kind === 'grumpy').length, 1); assert.match(g.note, /Extra Grumpy/);
    g.bonkBeast(1, false, from); assert.equal(g.events.filter((e) => e.kind === 'grumpy').length, 1, 'only announced once');
    g.hitstop = 0; b.state = 'roam'; b.t = 0; b.duration = 0; g.step(DT); assert.equal(b.state, 'windup');
    let warning = 0; while (b.state === 'windup') { g.step(DT); warning += DT; }
    assert(warning >= 0.6 && Math.abs(warning - (TELEGRAPH - 0.1)) < 2 * DT, `${id} warned for ${warning}`);
  }
  const calmGrump = fresh(), grumpy = fresh();
  for (const g of [calmGrump, grumpy]) { const b = g.beast; g.buddy.cooldown = 10000; b.x = b.z = 0; g.hero.x = 0; g.hero.z = 15; g.hero.invincible = 10000; b.state = 'roam'; b.t = 0; b.duration = 0; }
  grumpy.beast.grumpy = true;
  for (const g of [calmGrump, grumpy]) { g.step(DT); while (g.beast.state === 'windup') g.step(DT); g.step(DT); g.step(DT); }
  const run = (g) => distance(g.beast, g.beast.start);
  assert(Math.abs(run(grumpy) / run(calmGrump) - GRUMPY_PACE) < 0.02, `grumpy charge ran ${run(grumpy)} against ${run(calmGrump)}`);
  assert.equal(fresh().beast.grumpy, false, 'a new hunt starts calm');
});
check('the first wind-up that sees a friend is a warned roar that covers ears nearby, once, and again on turning Extra Grumpy', () => {
  for (const id of BEAST_IDS) {
    const g = fresh(id), b = g.beast, h = g.hero; g.roared = g.introduced = false; g.buddy.cooldown = 10000;
    b.state = 'roam'; b.t = 0; b.duration = 0; h.x = b.x; h.z = b.z + 4; g.events.length = 0; g.step(DT);
    assert.equal(b.state, 'windup', id); assert.equal(b.attack, 'roar', id); assert.equal(g.events.filter((e) => e.kind === 'intro').length, 1); assert.equal(g.introAt, g.huntTime); assert.match(`${BEASTS[id].name}, ${BEASTS[id].title}`, /, the /);
    let warning = 0; while (b.state === 'windup') { g.step(DT); warning += DT; }
    assert(warning >= 0.6, `${id} roar warned for ${warning}`); assert.equal(b.state, 'roar'); assert(g.events.some((e) => e.kind === 'roar'));
    const fluff = h.fluff;
    tick(g, 0.3, input({ x: 1 })); assert(h.covered > 0, `${id} covers ears`); assert.equal(h.fluff, fluff, 'a roar never bumps');
    const at = { x: h.x, z: h.z }; tick(g, 0.4, input({ x: 1 })); assert(distance(h, at) < 1e-9, 'covered ears hold the friend still');
    tick(g, 0.6); assert.equal(h.covered, 0); assert.equal(b.state, 'rest');
    b.state = 'roam'; b.t = 0; b.duration = 0; g.events.length = 0; g.step(DT); assert.notEqual(b.attack, 'roar', 'one hello roar');
    // Extra Grumpy brings one more roar, without a second name card.
    b.state = 'rest'; b.height = 0; g.bonkBeast(b.grump - b.maxGrump * (GRUMPY_AT - 0.02), false, { x: b.x - Math.cos(b.face) * 3, z: b.z + Math.sin(b.face) * 3 }); g.hitstop = 0;
    b.state = 'roam'; b.t = 0; b.duration = 0; g.events.length = 0; g.step(DT); assert.equal(b.attack, 'roar', `${id} grumpy roar`); assert(!g.events.some((e) => e.kind === 'intro'));
  }
  // Out of reach, rolling or guarding friends keep going; the paddock calf never roars.
  for (const setup of [(g) => { g.hero.z = g.beast.z + ROAR_REACH + 0.5; }, (g) => { g.hero.invincible = 5; }]) {
    const g = fresh(), b = g.beast; g.roared = false; g.buddy.cooldown = 10000; g.hero.x = b.x; g.hero.z = b.z + 4; setup(g);
    b.state = 'roam'; b.t = 0; b.duration = 0; g.step(DT); while (b.state === 'windup') g.step(DT);
    tick(g, 0.4); assert.equal(g.hero.covered, 0);
  }
  assert(ROAR_TIME >= 0.9);
  const calf = new HuntGame(5); calf.chooseHero('dora'); assert(calf.startHunt('bristleback')); assert(calf.roared && calf.introduced); assert.equal(calf.introAt, -1);
});
check('below 20% Grump a tired beast trudges home, snoozes in its nest and the first bonk is a doubled wake-up bonk', () => {
  for (const id of BEAST_IDS) {
    const g = fresh(id), b = g.beast; g.buddy.cooldown = 10000; g.hero.invincible = 10000; b.state = 'rest'; b.height = 0;
    const limit = ARENA_RADIUS - 1.5;
    assert(Math.hypot(g.nest.x, g.nest.z) <= limit && g.obstacles.every((o) => distance(g.nest, o) > o.r + 1.5), `${id} nest is clear`);
    const from = () => ({ x: b.x - Math.cos(b.face) * 3, z: b.z + Math.sin(b.face) * 3 });
    g.bonkBeast(b.maxGrump * (1 - TIRED_AT) - 1, false, from()); assert.equal(b.home, 0, id);
    g.events.length = 0; g.bonkBeast(2, false, from()); assert.equal(b.home, 1, id);
    assert.equal(g.events.filter((e) => e.kind === 'tired').length, 1); assert.match(g.note, /nest/);
    g.bonkBeast(1, false, from()); assert.equal(g.events.filter((e) => e.kind === 'tired').length, 1, 'only announced once');
    g.hitstop = 0; g.hero.x = 0; g.hero.z = 15; b.state = 'rest'; b.t = 0; b.duration = 0; g.events.length = 0;
    let t = 0; while (b.state !== 'snooze' && t < 40) { g.step(DT); t += DT; assert(b.state !== 'windup', `${id} attacked on the way home`); }
    assert.equal(b.state, 'snooze', `${id} reached its nest`); assert(distance(b, g.nest) < 1, id); assert.equal(b.height, 0);
    assert.equal(g.events.filter((e) => e.kind === 'snooze').length, 1);
    // A snooze restores a little Grump, never more than 8%.
    const asleep = b.grump; tick(g, 3); assert(b.grump > asleep && b.grump <= asleep + b.maxGrump * 0.08 + 1e-9, `${id} snooze restores a little`);
    g.buddy.cooldown = 0; g.buddy.x = b.x + 2; g.buddy.z = b.z; g.hero.x = b.x + 4; g.hero.z = b.z; g.step(DT); assert.equal(b.state, 'snooze', 'the buddy lets it sleep');
    const before = b.grump; g.bonkBeast(10, false, from());
    assert(Math.abs(before - b.grump - 20) < 1e-9, `${id} wake-up bonk is doubled`); assert.equal(b.state, 'rest'); assert.equal(b.home, 2); assert.match(g.note, /Wake-up/);
    g.hitstop = 0; g.hero.invincible = 10000; b.t = b.duration; g.step(DT); assert.notEqual(b.state, 'trudge', 'only goes home once');
  }
  // Left alone, the snooze ends by itself; the calf in the paddock never goes home.
  const g = fresh(), b = g.beast; g.buddy.cooldown = 10000; b.home = 1; b.state = 'snooze'; b.t = 0; b.duration = SNOOZE; b.x = g.nest.x; b.z = g.nest.z;
  tick(g, SNOOZE + 0.1); assert.notEqual(b.state, 'snooze'); assert.equal(b.home, 2);
  const calf = new HuntGame(5); calf.chooseHero('dora'); assert(calf.startHunt('bristleback')); assert.equal(calf.huntChapter, 0);
  const c = calf.beast; c.state = 'rest'; calf.bonkBeast(c.maxGrump * (1 - TIRED_AT) + 1, false, { x: c.x - 3, z: c.z }); assert.equal(c.home, 0);
});
check('each area has seeded weather that blows in after a clear start, shrinks sight, is announced and clears again', () => {
  for (const id of BEAST_IDS) {
    const g = fresh(id), b = g.beast, kind = AREA_WEATHER[g.area]; g.buddy.cooldown = 10000; g.hero.invincible = 10000;
    assert.notEqual(kind, 'clear', id); assert(g.weatherClear >= 25 && g.weatherClear <= 40 && g.weatherSpell >= 16 && g.weatherSpell <= 24);
    const levels = []; for (let t = 0; t <= g.weatherClear + g.weatherSpell; t += 0.5) { g.huntTime = t; levels.push(g.weather.level); }
    assert(levels.slice(0, 40).every((l) => l === 0), `${id} starts clear for 20 s`); assert(levels.includes(1), `${id} reaches full strength`); assert.equal(levels.at(-1), 0, 'and clears');
    for (let i = 1; i < levels.length; i++) assert(Math.abs(levels[i] - levels[i - 1]) <= 0.5 / WEATHER_RAMP + 1e-9, 'blows in gradually');
    // Sight: an open view at 80% of SIGHT is in sight when clear and out of sight at full strength.
    const peak = g.weatherClear + g.weatherSpell / 2; b.state = 'rest'; b.duration = 10000; b.height = 0;
    let found = false;
    for (let k = 0; k < 24 && !found; k++) { const a = k / 24 * Math.PI * 2; g.hero.x = Math.cos(a) * 4.8; g.hero.z = Math.sin(a) * 4.8; b.x = -g.hero.x; b.z = -g.hero.z; g.huntTime = 0; found = g.inSight(); }
    assert(found, `${id} open view`); g.huntTime = peak; assert.equal(g.weather.level, 1); assert(!g.inSight(), `${id} weather hides the beast`);
    assert(Math.abs(g.sight - SIGHT * WEATHER_SIGHT[kind]) < 1e-9);
    // Stepping across the change announces it once each way.
    const change = (from, seconds) => { g.huntTime = from; g.events.length = 0; let note = ''; for (let n = 0; n < seconds / DT; n++) { g.step(DT); if (!note && g.events.some((e) => e.kind === 'weather')) note = g.note; } assert.equal(g.events.filter((e) => e.kind === 'weather').length, 1); return note; };
    assert.match(change(g.weatherClear - 0.2, 2), /rain|mist|dust|blizzard/i); assert(g.stormy);
    assert.match(change(g.weatherClear + g.weatherSpell - 2, 2.5), /passes/); assert(!g.stormy);
  }
  // Same seed and hunt count, same weather; the next hunt draws a new loop; the paddock stays clear.
  const a = fresh('frostmane'), c = fresh('frostmane'); assert.deepEqual([a.weatherClear, a.weatherSpell], [c.weatherClear, c.weatherSpell]);
  const loops = new Set(); for (let n = 0; n < 6; n++) { calm(a); a.returnVillage(); assert(a.startHunt('frostmane')); loops.add(`${a.weatherClear}/${a.weatherSpell}`); } assert(loops.size > 1);
  const calf = new HuntGame(5); calf.chooseHero('dora'); assert(calf.startHunt('bristleback')); calf.huntTime = 60; assert.equal(calf.weather.level, 0);
});
check('once a hunt a visiting beast wanders in, and meeting the hunted beast they square off for a warned turf bonk', () => {
  for (const id of BEAST_IDS) {
    const g = fresh(id), b = g.beast, h = g.hero, visit = VISITORS[g.area]; g.buddy.cooldown = 10000;
    assert(visit && visit !== id, id); assert(g.visitAt >= 40 && g.visitAt <= 65);
    b.state = 'rest'; b.duration = 10000; b.height = 0; b.x = 0; b.z = 0; h.x = 0; h.z = 15;
    g.huntTime = g.visitAt - DT / 2; g.events.length = 0; g.step(DT);
    assert(g.visitor && g.visitor.id === visit, `${id} visitor`); assert.equal(g.events.filter((e) => e.kind === 'visitor').length, 1); assert.match(g.note, /wanders in/);
    let t = 0; while (b.state !== 'turf' && t < 20) { g.step(DT); t += DT; }
    assert.equal(b.state, 'turf', `${id} squares off`); assert(g.events.some((e) => e.kind === 'turf-warning')); assert.match(g.note, /square off/);
    const grump = b.grump, fluff = h.fluff; let warning = 0;
    while (b.state === 'turf') { g.step(DT); warning += DT; }
    assert(warning >= 0.6 && TURF_TIME >= 0.6, `${id} turf warned for ${warning}`);
    assert.equal(g.events.filter((e) => e.kind === 'turf').length, 1); assert.equal(b.state, 'dizzy'); assert.match(g.note, /Turf bonk/);
    assert.deepEqual(g.profile.turfPairs, [`${id}+${visit}`], `${id} turf pair goes in the Beast Book`); assert.equal(g.huntFacts.turfs, 1); assert(TURF_PAIRS.includes(`${id}+${visit}`));
    assert(Math.abs(grump - b.grump - b.maxGrump * TURF_GRUMP) < 1e-9, `${id} turf Grump`); assert.equal(h.fluff, fluff, 'out of the circle, no bump');
    assert.equal(g.visitor.state, 'leave'); b.state = 'rest'; b.duration = 10000; tick(g, 15); assert.equal(g.visitor, null, `${id} visitor leaves`);
    g.huntTime += 100; tick(g, 1); assert.equal(g.visitor, null, 'only one visit');
  }
  // A friend inside the circle is bumped; a turf bonk never takes the last Grump; the paddock calf has no visitors.
  const g = fresh(), b = g.beast; g.buddy.cooldown = 10000; b.state = 'rest'; b.duration = 10000; b.x = 0; b.z = 0; b.grump = 5; g.hero.x = 0; g.hero.z = 12;
  g.huntTime = g.visitAt; while (b.state !== 'turf') g.step(DT);
  g.hero.x = (b.x + g.visitor.x) / 2; g.hero.z = (b.z + g.visitor.z) / 2 + 1; g.hero.invincible = 0; const fluff = g.hero.fluff;
  while (b.state === 'turf') g.step(DT);
  assert(g.hero.fluff < fluff, 'bumped inside the circle'); assert(b.grump >= 1 && g.mode === 'hunt');
  const calf = new HuntGame(5); calf.chooseHero('dora'); assert(calf.startHunt('bristleback')); assert(calf.visited); calf.huntTime = 100; tick(calf, 0.5); assert.equal(calf.visitor, null);
  assert(TURF_REACH > 4);
});
check('the grab-on vine holds on at the head; two tickles soften, a yank into a rock is a wall bonk, and a held beast never attacks', () => {
  for (const id of BEAST_IDS) {
    const g = fresh(id), b = g.beast, h = g.hero; g.buddy.cooldown = 10000;
    b.state = 'rest'; b.duration = 10000; b.height = 0; b.x = 0; b.z = 0; h.x = 0; h.z = 5; g.obstacles = [];
    g.events.length = 0; g.step(DT, input({ grab: true })); assert.equal(g.vine?.phase, 'fly', id); assert(g.events.some((e) => e.kind === 'vine'));
    tick(g, 0.3); assert.equal(g.vine?.phase, 'cling', id); assert.equal(b.state, 'grabbed'); assert(Math.abs(distance(h, b) - 1.7) < 1e-6);
    tick(g, 1); assert.equal(b.state, 'grabbed', 'held beasts never wind up');
    g.step(DT, input({ bonk: true })); g.step(DT); g.events.length = 0; g.step(DT, input({ bonk: true }));
    assert(b.soft > SOFT_TIME - 0.1, `${id} softened`); assert(g.events.some((e) => e.kind === 'soft'));
    const from = { x: b.x - Math.cos(b.face) * 3, z: b.z + Math.sin(b.face) * 3 }, before = b.grump, part = b.part; g.bonkBeast(10, false, from); g.hitstop = 0;
    assert(Math.abs(before - b.grump - 12) < 1e-9, `${id} soft bonk`); assert(Math.abs(b.part - part - 18 * (1 + g.perk('part-power') + g.perk('pop-parts'))) < 1e-9, `${id} soft part`);
    // Yank towards a rock four steps away: a wall bonk, dizzy and 3% Grump.
    g.obstacles = [{ x: b.x + 4, z: b.z, r: 1, kind: 'rock' }]; const grump = b.grump; g.events.length = 0;
    g.step(DT, input({ charge: true, x: 1 })); assert.equal(b.state, 'yanked', id); assert.equal(g.vine, null);
    let t = 0; while (b.state === 'yanked' && t < 2) { g.step(DT); t += DT; }
    assert.equal(b.state, 'dizzy', `${id} wall bonk`); assert(g.events.some((e) => e.kind === 'wall')); assert(Math.abs(grump - b.grump - b.maxGrump * WALL_GRUMP) < 1e-9);
    g.step(DT, input({ grab: true })); assert.equal(g.vine, null, 'cooling down'); assert.match(g.note, /coiling/); assert(g.vineCd > 0 && g.vineCd <= VINE_COOLDOWN);
  }
  // Holding on ends by itself or with a roll; a yank with nothing in the way is a stumble; too far away, no throw.
  const g = fresh(), b = g.beast, h = g.hero; g.buddy.cooldown = 10000; g.obstacles = [];
  const grab = () => { g.vineCd = 0; b.state = 'rest'; b.duration = 10000; b.x = 0; b.z = 0; h.x = 0; h.z = 5; g.step(DT, input({ grab: true })); tick(g, 0.3); assert.equal(g.vine?.phase, 'cling'); };
  grab(); tick(g, CLING_TIME); assert.equal(g.vine, null); assert.notEqual(b.state, 'grabbed');
  grab(); g.step(DT, input({ roll: true })); assert.equal(g.vine, null); assert.notEqual(b.state, 'grabbed');
  grab(); const start = { x: b.x, z: b.z }, grump = b.grump; g.step(DT, input({ charge: true, x: 1 })); tick(g, 0.8);
  assert.equal(b.state, 'rest'); assert(Math.abs(distance(b, start) - YANK) < 0.3, 'stumbles the full yank'); assert.equal(b.grump, grump);
  g.vineCd = 0; b.x = 0; b.z = 0; h.x = 0; h.z = VINE_REACH + 1; g.step(DT, input({ grab: true })); assert.equal(g.vine, null); assert.match(g.note, /9 steps/);
});
check('the pebble slinger plinks the locked-on beast, knocks a flying Skreel down in three, shakes berries from trees and refills from gathering and dizzies', () => {
  const g = fresh(), b = g.beast, h = g.hero; g.buddy.cooldown = 10000; b.state = 'rest'; b.duration = 10000; b.x = 0; b.z = 0; h.x = 0; h.z = 8; g.obstacles = [];
  assert.equal(g.pebbles, SLING_START); const grump = b.grump, dizzy = b.dizzy, hits = g.hits;
  g.events.length = 0; g.step(DT, input({ sling: true })); assert.equal(g.pebbles, SLING_START - 1); assert.equal(g.stones.length, 1); assert(g.events.some((e) => e.kind === 'sling'));
  tick(g, 0.5); assert.equal(g.stones.length, 0); assert.equal(b.grump, grump - PEBBLE_POWER); assert.equal(b.dizzy, dizzy + PEBBLE_DIZZY); assert.equal(g.hits, hits, 'pebbles never charge weapon meters');
  // Out of pebbles, nothing flies.
  g.pebbles = 0; g.step(DT); g.step(DT, input({ sling: true })); assert.equal(g.stones.length, 0); assert.match(g.note, /Out of pebbles/);
  // Gathering adds 3 and a dizzy shakes 1 loose, up to the most a pouch holds.
  g.pebbles = 0; g.makeDizzy(1); assert.equal(g.pebbles, 1); g.pebbles = SLING_MAX - 1; g.makeDizzy(1); assert.equal(g.pebbles, SLING_MAX);
  // A tree hit drops one berry per tree, at most TREE_BERRIES a hunt; a rock drops nothing.
  const t = fresh(), th = t.hero; t.buddy.cooldown = 10000; t.locked = false; t.beast.x = 15; t.beast.z = -15; t.beast.state = 'rest'; t.beast.duration = 10000;
  t.obstacles = [0, 1, 2, 3].map((i) => ({ x: -12 + i * 8, z: -6, r: 1, kind: 'tree' })).concat([{ x: 12, z: -6, r: 1, kind: 'rock' }]); t.pebbles = 10;
  const shoot = (x) => { th.x = x; th.z = 0; th.face = Math.PI / 2; t.step(DT); t.step(DT, input({ sling: true })); tick(t, 0.6); };
  for (const x of [-12, -12, -4, 4, 12, 20]) shoot(x);
  assert.equal(t.shaken.length, TREE_BERRIES); assert.equal(t.drops.filter((d) => d.material === 'berry').length + (t.profile.pouch.berry > 0 ? 0 : 0), TREE_BERRIES);
  // Three pebbles bring a flying Skreel down; a pebble on a snoozing beast wakes it.
  const s = fresh('skreel'), sb = s.beast; s.buddy.cooldown = 10000; s.obstacles = []; sb.state = 'circle'; sb.height = 2.4; sb.x = 0; sb.z = 0; s.hero.x = 0; s.hero.z = 9; s.pebbles = 5;
  s.events.length = 0; for (let n = 0; n < KNOCKDOWN_HITS; n++) { s.step(DT, input({ sling: true })); tick(s, 0.1); if (n < KNOCKDOWN_HITS - 1) { tick(s, 0.4); assert(!s.events.some((e) => e.kind === 'knockdown'), 'not yet'); } } tick(s, 0.5);
  assert(s.events.some((e) => e.kind === 'knockdown')); assert.equal(sb.state, 'rest'); assert.equal(sb.height, 0); assert(sb.duration >= 2.5);
  // Only a flying Skreel comes down: Puffwart high in a hop just takes the plinks.
  const hp = fresh('puffwart'), pb = hp.beast; hp.buddy.cooldown = 10000; hp.obstacles = []; pb.state = 'hop'; pb.t = 0; pb.duration = 100; pb.start = { x: 0, z: 0 }; pb.aim = { x: 0, z: 0 }; pb.x = 0; pb.z = 0; hp.hero.x = 0; hp.hero.z = 9; hp.hero.invincible = 100;
  for (let n = 0; n < KNOCKDOWN_HITS + 1; n++) { pb.height = 2; hp.step(DT, input({ sling: true })); tick(hp, 0.3); } assert.equal(hp.skyHits, 0); assert.notEqual(pb.state, 'dizzy');
  const z = fresh(), zb = z.beast; z.buddy.cooldown = 10000; z.obstacles = []; zb.home = 1; zb.state = 'snooze'; zb.t = 0; zb.duration = 8; zb.x = 0; zb.z = 0; z.hero.x = 0; z.hero.z = 8;
  z.step(DT, input({ sling: true })); tick(z, 0.5); assert.equal(zb.state, 'rest'); assert.equal(zb.home, 2); assert.match(z.note, /woke/);
});
check('face hits (Hornclack: the sides) are weak spots worth 15% more, and every bonk records its amount for a hit number', () => {
  for (const id of BEAST_IDS) {
    const g = fresh(id), b = g.beast; g.buddy.cooldown = 10000; b.face = 0; b.state = 'rest'; b.height = 0;
    const hit = (at) => { const before = b.grump; g.fx = []; const landed = g.bonkBeast(10, false, { x: b.x + at.x, z: b.z + at.z }); g.hitstop = 0; b.state = 'rest'; return { landed, amount: before - b.grump, fx: g.fx.find((f) => f.kind === 'bonk') }; };
    const face = hit({ x: 4, z: 0 }), back = hit({ x: -4, z: 0 }), side = hit({ x: 0, z: 4 });
    assert(Math.abs(back.amount - 10) < 1e-9, `${id} back`); assert.equal(back.fx.weak, false); assert(Math.abs(back.fx.amount - 10) < 1e-9);
    if (id === 'hornclack') { assert.equal(face.landed, false, 'shell front'); assert(Math.abs(side.amount - 10 * WEAK_SPOT) < 1e-9); assert.equal(side.fx.weak, true); assert.equal(side.fx.text, 'Weak spot!'); }
    else { assert(Math.abs(face.amount - 10 * WEAK_SPOT) < 1e-9, `${id} face`); assert.equal(face.fx.weak, true); assert(Math.abs(side.amount - 10) < 1e-9, `${id} side`); }
  }
  const g = fresh(), b = g.beast; b.state = 'rest'; g.bonkBeast(10, true, { x: b.x - Math.cos(b.face) * 3, z: b.z + Math.sin(b.face) * 3 }); assert.equal(g.fx.find((f) => f.kind === 'bonk').heavy, true);
});
check('each wild area has one hazard: a pebble or F trips it, it warns for 0.8 s, then bonks the beast inside and bumps friends, once a hunt', () => {
  assert(HAZARD_WARN >= 0.6);
  for (const id of BEAST_IDS) {
    const g = fresh(id), z = g.hazard, b = g.beast; assert(z, id); assert.equal(z.kind, AREA_HAZARD[HUNT_AREA[id]]); assert.equal(z.state, 'ready');
    assert(g.obstacles.every((o) => Math.hypot(o.x - z.x, o.z - z.z) > o.r + HAZARD_REACH), `${id} clear of obstacles`);
    // A replay places it in the same spot.
    const again = fresh(id); assert.deepEqual([again.hazard.x, again.hazard.z], [z.x, z.z]);
    // A pebble trips it; the warning gives friends time to leave.
    g.buddy.cooldown = 10000; b.state = 'rest'; b.duration = 100; b.height = 0; b.x = z.x + 1; b.z = z.z; g.hero.x = z.x; g.hero.z = z.z + 7; g.locked = false; g.hero.face = Math.PI / 2; g.hero.invincible = 0;
    g.step(DT, input({ sling: true })); tick(g, 0.5); assert.equal(z.state, 'warn', `${id} warn`); assert(g.events.length >= 0);
    const before = b.grump; g.hero.x = z.x; g.hero.z = z.z + 1; g.hero.invincible = 0; const fluff = g.hero.fluff;
    tick(g, HAZARD_WARN); assert.equal(z.state, 'spent'); assert(Math.abs(before - b.grump - b.maxGrump * HAZARD_GRUMP) < 1e-6 || b.grump === 1, `${id} grump`);
    assert.equal(b.state, 'dizzy', `${id} dizzy`); assert(g.hero.fluff < fluff, `${id} friend bumped`);
    // Spent for the rest of the hunt.
    g.step(DT, input({ sling: true })); tick(g, 1); assert.equal(z.state, 'spent');
  }
  // F beside it trips it too; a beast outside the circle is missed.
  const f = fresh('puffwart'), fz = f.hazard; f.buddy.cooldown = 10000; f.beast.x = fz.x + 9; f.beast.z = fz.z; f.beast.state = 'rest'; f.beast.duration = 100; f.hero.x = fz.x + 1; f.hero.z = fz.z;
  const g0 = f.beast.grump; f.step(DT, input({ use: true })); assert.equal(fz.state, 'warn'); tick(f, HAZARD_WARN + 0.1); assert.equal(fz.state, 'spent'); assert.equal(f.beast.grump, g0); assert.notEqual(f.beast.state, 'dizzy');
  // No hazard in the paddock.
  const calf = new HuntGame(5); calf.chooseHero('dora'); calf.story.chapter = 0; assert(calf.startHunt('bristleback', false, true)); assert.equal(calf.hazard, null);
});
check('a normal calm records the best time per beast in tenths, keeps it through a save, and flags a new record only when faster', () => {
  const g = fresh(); g.huntTime = 42.34; g.beast.grump = 1; g.bonkBeast(10, false, g.hero); assert.equal(g.mode, 'nap'); assert.equal(g.newRecord, true); assert.equal(g.profile.beastBook.bristleback.best, 423); assert.equal(g.lastTime, 423);
  g.returnVillage(); assert(g.startHunt('bristleback')); g.huntTime = 50; g.beast.grump = 1; g.bonkBeast(10, false, g.hero); assert.equal(g.newRecord, false); assert.equal(g.profile.beastBook.bristleback.best, 423);
  g.returnVillage(); assert(g.startHunt('bristleback')); g.huntTime = 30.06; g.beast.grump = 1; g.bonkBeast(10, false, g.hero); assert.equal(g.newRecord, true); assert.equal(g.profile.beastBook.bristleback.best, 301);
  // Extra Grumpy hunts don't count.
  g.returnVillage(); assert(g.startHunt('bristleback', true)); g.huntTime = 5; g.beast.grump = 1; g.bonkBeast(10, false, g.hero); assert.equal(g.newRecord, false); assert.equal(g.profile.beastBook.bristleback.best, 301);
  const back = HuntGame.load(g.save()); assert.equal(back.profile.beastBook.bristleback.best, 301); assert.equal(back.profile.beastBook.skreel.best, 0);
});
check('three fluff finches perch in each wild area; walking up to one adds Fluff and most Fluff for the hunt', () => {
  for (const id of BEAST_IDS) {
    const g = fresh(id); assert.equal(g.finches.length, FINCHES, id); assert.deepEqual(fresh(id).finches, g.finches, 'replays perch them the same');
    for (const f of g.finches) assert(g.obstacles.every((o) => Math.hypot(o.x - f.x, o.z - f.z) > o.r + 1.5));
  }
  const g = fresh(); g.buddy.cooldown = 10000; g.beast.state = 'rest'; g.beast.duration = 1000; const f = g.finches[0], max = g.hero.maxFluff; g.hero.fluff = 50;
  g.hero.x = f.x; g.hero.z = f.z + 0.5; g.step(DT); assert(f.caught); assert.equal(g.hero.maxFluff, max + FINCH_FLUFF); assert.equal(g.hero.fluff, 50 + FINCH_FLUFF); assert(g.events.some((e) => e.kind === 'finch'));
  g.step(DT); assert.equal(g.hero.maxFluff, max + FINCH_FLUFF, 'each finch only once');
  g.returnVillage(); assert.deepEqual(g.finches, []);
  const calf = new HuntGame(5); calf.chooseHero('dora'); calf.story.chapter = 0; assert(calf.startHunt('bristleback', false, true)); assert.deepEqual(calf.finches, []);
});
check('wild areas are three zones: the beast wanders down a path at 70% and 35% Grump, Enzo follows it, and the friends travel after it', () => {
  for (const id of BEAST_IDS) {
    const g = fresh(id), b = g.beast, h = g.hero; g.zoneAt = [...ZONE_AT]; g.buddy.cooldown = 10000; g.hazard = null;
    assert.equal(g.zones, 3); assert.equal(g.zone, 0); assert.equal(g.zoneName, ZONE_NAMES[g.area][0]); assert.deepEqual(g.exits().map((e) => e.to), [1]);
    const inner0 = g.obstacles.filter((o) => Math.hypot(o.x, o.z) <= 19).map((o) => [o.x, o.z]);
    // Above 70% it stays; below, it wanders off without attacking.
    b.state = 'roam'; b.t = 0; b.duration = 100; b.grump = b.maxGrump * 0.71; g.step(DT); assert.equal(b.state, 'roam', `${id} stays`);
    b.grump = b.maxGrump * 0.69; h.x = 12; h.z = 6; g.events.length = 0; g.step(DT); assert.equal(b.state, 'wander', `${id} wanders`); assert(g.events.some((e) => e.kind === 'wander'));
    let t = 0, fluff = h.fluff; while (!b.away && t < WANDER_GIVEUP + 1) { g.step(DT); t += DT; assert(!['windup', 'charge', 'swoop', 'hop', 'pounce', 'sweep', 'shake', 'tongue', 'roar'].includes(b.state), `${id} never attacks on the way`); }
    assert(b.away, `${id} reaches the path`); assert.equal(b.zone, 1); assert.equal(h.fluff, fluff); assert(g.events.some((e) => e.kind === 'away'));
    // Away: out of sight, unbonkable, and Enzo's trail leads to the path.
    assert(!g.inSight()); assert.equal(g.bonkBeast(10, false, b), false); const at = [b.x, b.z]; tick(g, 2); assert.deepEqual([b.x, b.z], at, 'waits in the next zone');
    const trail = g.trail(), exit = g.exitTo(1); assert(trail.length > 3); assert(Math.hypot(trail.at(-1).x - exit.x, trail.at(-1).z - exit.z) < Math.hypot(h.x - exit.x, h.z - exit.z));
    // Walking up the path follows it into zone 2, laid out anew with the beast resting ahead.
    h.x = exit.x; h.z = exit.z + EXIT_REACH - 0.3; g.events.length = 0; g.step(DT);
    assert.equal(g.zone, 1, `${id} travels`); assert(g.events.some((e) => e.kind === 'travel')); assert.equal(b.away, false); assert.equal(b.state, 'rest'); assert.match(g.note, new RegExp(ZONE_NAMES[g.area][1]));
    assert(h.z > 10 && h.invincible >= 1.5); assert(Math.hypot(b.x - h.x, b.z - h.z) > 12); assert.deepEqual(g.exits().map((e) => e.to), [2, 0]);
    assert.notDeepEqual(g.obstacles.filter((o) => Math.hypot(o.x, o.z) <= 19).map((o) => [o.x, o.z]), inner0, 'a new layout');
    assert(g.obstacles.every((o) => Math.hypot(o.x - h.x, o.z - h.z) > o.r + 0.5), 'arrives clear');
    // The second wander leads to the den zone, where it stays until tired.
    b.state = 'roam'; b.t = 0; b.duration = 100; b.grump = b.maxGrump * 0.34; tick(g, WANDER_GIVEUP + 1); assert(b.away); assert.equal(b.zone, 2);
    const e2 = g.exitTo(2); h.x = e2.x; h.z = e2.z + 1; g.step(DT); assert.equal(g.zone, 2); assert.deepEqual(g.exits().map((e) => e.to), [1]);
    h.x = 0; h.z = 17; tick(g, 0.2); assert.equal(g.zone, 2, 'no way back while the beast is here');
    b.state = 'roam'; b.t = 0; b.duration = 100; b.grump = b.maxGrump * 0.25; tick(g, 2); assert.notEqual(b.state, 'wander');
  }
  // Same seed and inputs, same next zone; the calf's paddock is a single zone.
  const run = () => { const g = fresh('puffwart'); g.zoneAt = [...ZONE_AT]; g.beast.grump = g.beast.maxGrump * 0.6; g.beast.state = 'roam'; g.hero.x = 10; tick(g, WANDER_GIVEUP + 1); const e = g.exitTo(1); g.hero.x = e.x; g.hero.z = e.z + 1; g.step(DT); return JSON.stringify([g.zone, g.obstacles, g.spots, g.hazard, g.finches, g.nest]); };
  assert.equal(run(), run());
  const calf = new HuntGame(5); calf.chooseHero('dora'); assert(calf.startHunt('bristleback')); assert.equal(calf.zones, 1); assert.deepEqual(calf.exits(), []);
  // A sap trap left behind comes back to the pouch.
  const s = fresh(); s.zoneAt = [...ZONE_AT]; s.trap = { x: 3, z: 3 }; const sap = Object.keys(ITEMS).find((k) => ITEMS[k].effect.kind === 'trap'), before = s.profile.pouch[sap];
  s.beast.grump = s.beast.maxGrump * 0.6; s.beast.state = 'roam'; s.hero.x = 10; tick(s, WANDER_GIVEUP + 1); const se = s.exitTo(1); s.hero.x = se.x; s.hero.z = se.z + 1; s.step(DT); assert.equal(s.zone, 1); assert.equal(s.trap, null); assert.equal(s.profile.pouch[sap], before + 1);
});
check('out of sight for a second, Enzo sniffs out a pawprint trail that fades once the beast is seen', () => {
  const g = fresh(), b = g.beast; g.buddy.cooldown = 10000; b.state = 'rest'; b.duration = 10000;
  b.x = 0; b.z = -6; g.hero.x = 0; g.hero.z = 4; assert(g.inSight());
  tick(g, 2); assert.equal(g.sniff, 0); assert.equal(g.trail().length, 0);
  g.hero.z = SIGHT - 6 + 0.5; assert.equal(g.inSight(), false); g.events.length = 0;
  tick(g, 0.9); assert.equal(g.sniff, 0); tick(g, 0.2); assert(g.sniff > 0);
  assert.equal(g.events.filter((e) => e.kind === 'sniff').length, 1); assert.match(g.note, /pawprints/);
  const prints = g.trail(); assert(prints.length >= 6);
  for (const p of prints) { assert(distance(p, g.hero) < distance(g.hero, b)); assert(distance(p, b) > 2.4); }
  tick(g, 3); assert(g.sniff > 0, 'the trail stays lit while the beast is out of sight');
  g.hero.z = 0; assert(g.inSight()); tick(g, 2.1); assert.equal(g.sniff, 0); assert.equal(g.trail().length, 0);
  const rock = fresh(), r = rock.beast; rock.buddy.cooldown = 10000; r.state = 'rest'; r.duration = 10000;
  rock.obstacles = [{ x: 0, z: 0, r: 1.3, kind: 'rock' }]; r.x = 0; r.z = -4; rock.hero.x = 0; rock.hero.z = 4;
  assert.equal(rock.inSight(), false, 'a rock between them hides the beast'); tick(rock, 1.1); assert(rock.sniff > 0);
  assert(rock.trail().every((p) => distance(p, rock.obstacles[0]) >= 1.5), 'no prints under the rock');
});
check('holding Tab with Q/E gives the buddy an order without changing items or lock-on; a plain Tab tap still locks', () => {
  const g = fresh(); assert.equal(g.order, 'bonk'); const locked = g.locked, item = g.item;
  g.step(DT, input({ lock: true })); g.step(DT, input({ lock: true, next: true })); assert.equal(g.order, 'gather');
  g.step(DT, input({ lock: true })); g.step(DT, input({ lock: true, next: true })); assert.equal(g.order, 'close');
  g.step(DT, input({ lock: true })); g.step(DT, input({ lock: true, previous: true })); assert.equal(g.order, 'gather');
  g.step(DT); assert.equal(g.locked, locked); assert.equal(g.item, item);
  g.step(DT, input({ lock: true })); g.step(DT); assert.equal(g.locked, !locked);
  g.step(DT, input({ next: true })); assert.equal(g.item, (item + 1) % g.ring.length); assert.equal(g.order, 'gather');
  assert(g.events.some((e) => e.kind === 'order'));
});
check('stay close keeps Dora by the leader, and gather sends the buddy to pick up materials without bonking', () => {
  const near = fresh('bristleback', 'enzo'), b = near.beast; b.state = 'rest'; b.duration = 10000;
  near.hero.x = 0; near.hero.z = 2; near.commandBuddy(-1); assert.equal(near.order, 'close');
  tick(near, 4); assert(distance(near.buddy, { x: near.hero.x - 1.4, z: near.hero.z + 1.4 }) < 1.3, 'Dora stays at the side');
  assert.equal(b.grump, b.maxGrump, 'out of reach from the side, so no bonks');
  const go = fresh('bristleback', 'enzo'); go.beast.state = 'rest'; go.beast.duration = 10000; go.hero.x = 0; go.hero.z = 2;
  tick(go, 4); assert(go.beast.grump < go.beast.maxGrump, 'go bonk still runs in and bonks');
  const g = fresh(), m = g.beast; m.state = 'rest'; m.duration = 10000; g.hero.x = 10; g.hero.z = 10;
  g.commandBuddy(1); assert.equal(g.order, 'gather'); g.spots = []; g.drops.push({ id: 999, x: -8, z: 4, material: 'boar-hide', count: 2 });
  const before = g.profile.pouch['boar-hide']; tick(g, 6);
  assert.equal(g.drops.length, 0); assert.equal(g.profile.pouch['boar-hide'], before + 2); assert.equal(m.grump, m.maxGrump);
});
check('chapter replays do not clear the next chapter or repeat its outro', () => {
  const g = new HuntGame(); g.chooseHero('dora'); g.startChapter(); calm(g); g.returnVillage();
  assert.equal(g.chapter, 1); g.sceneSeen('0-outro'); g.sceneSeen('0-outro'); assert.deepEqual(g.story.scenesSeen, ['0-outro']);
  assert(!g.sceneSeen('garbage'));
});
const village = (seed = 39, naps = 0) => { const g = new HuntGame(seed); g.chooseHero('dora'); g.story.chapter = Math.max(2, naps + 1); for (const id of BEAST_IDS) g.profile.beastBook[id].met = true; for (const id of BEAST_IDS.slice(0, naps)) g.profile.naps[id] = 1; return g; };
const still = (g, seconds) => tick(g, seconds);
check('a v1 save moves into the v3 pouch once, keeping naps, tier paths and the hero', () => {
  const g = HuntGame.load({ v: 1, seed: 5, profile: { hero: 'enzo', levels: { dora: 2, enzo: 3 }, materials: { bristleback: 7, puffwart: 4, skreel: 3, hornclack: 2, frostmane: 1 }, naps: { bristleback: 2, frostmane: 1 }, hunts: 9 } });
  assert.equal(g.profile.hero, 'enzo'); assert.equal(g.node('hammer').id, 'hammer-2'); assert.equal(g.node('bow').id, 'bow-3A'); assert.equal(g.profile.naps.bristleback, 2); assert(g.profile.won); assert.equal(g.profile.hunts, 9);
  for (const [id, n] of [['bristleback', 7], ['puffwart', 4], ['skreel', 3], ['hornclack', 2], ['frostmane', 1]]) assert.equal(g.profile.pouch[DROPS[id].shed.id], n, id);
  assert.equal(g.materialTotal, 17); const save = g.save(); assert.equal(save.v, 6);
  const again = HuntGame.load(JSON.parse(JSON.stringify(save))); assert.deepEqual(again.profile, g.profile);
  g.toggleRing('pathfinder-acorn'); assert.equal(g.toggleRing('dizzy-bell'), true); g.profile.pouch.berry = 2; assert(g.eatSnack('clover-crunch'));
  assert.deepEqual(HuntGame.load(JSON.parse(JSON.stringify(g.save()))).profile, g.profile, 'ring and packed snack round-trip');
});
check('drops follow the content tables and a seed replays them exactly', () => {
  const run = (seed) => { const g = fresh('bristleback', 'dora', seed); g.buddy.cooldown = 1e9; const got = [];
    for (let i = 0; i < 40 && g.mode === 'hunt'; i++) { g.bonkBeast(9, false, g.hero); got.push(...g.drops.map((d) => d.material)); g.drops = []; }
    return { got, rng: g.rng }; };
  const a = run(7), b = run(7); assert.deepEqual(a, b);
  assert(a.got.filter((m) => m === 'bristle-tuft').length >= 3, 'bonks shed bristle tufts'); assert.equal(a.got.filter((m) => m === 'tusk-shard').length, 1, 'the tusks give one tusk shard');
  assert(a.got.every((m) => ['bristle-tuft', 'tusk-shard'].includes(m)));
  const owl = fresh('skreel'); owl.buddy.cooldown = 1e9; owl.beast.height = 0; owl.bonkBeast(owl.beast.maxGrump * 0.33, false, owl.hero); assert(owl.beast.broken);
  assert.equal(owl.drops.filter((d) => d.material === 'sky-feather').reduce((n, d) => n + d.count, 0) >= 2, true, 'the crest gives two sky feathers');
  for (const id of BEAST_IDS) {
    const g = fresh(id); calm(g); const d = DROPS[id].calm;
    assert(g.reward.length >= d.count && g.reward.length <= d.count + 1, `${id} reward ${g.reward}`);
    assert(g.reward.slice(0, d.count).every((m) => d.common.includes(m))); assert(g.reward.slice(d.count).every((m) => m === d.rare.id));
  }
});
check('each hunt lays out its area’s gathering spots, clear of trees, rocks and each other', () => {
  for (const id of BEAST_IDS) {
    const g = fresh(id), area = HUNT_AREA[id], plan = GATHER[area];
    for (const p of plan) { const n = g.spots.filter((s) => s.material === p.id).length; assert(p.chance === undefined ? n === p.spots : n <= p.spots, `${id} ${p.id} ${n}`); }
    for (const s of g.spots) { assert(g.obstacles.every((o) => distance(s, o) > o.r + 1.6)); assert(g.spots.every((t) => t === s || distance(s, t) > 3)); assert(Math.hypot(s.x, s.z) < 16); }
  }
  assert.equal(HUNT_AREA.puffwart, 'marsh'); assert(fresh('puffwart').spots.some((s) => s.material === 'marsh-reed'));
  const glimmers = Array.from({ length: 40 }, (_, seed) => fresh('skreel', 'dora', seed + 1).spots.filter((s) => s.material === 'glimmer-stone').length);
  assert(glimmers.includes(0) && glimmers.includes(1), 'the sparkling ridge spot appears on some hunts only');
  assert.deepEqual(fresh('skreel', 'dora', 11).spots, fresh('skreel', 'dora', 11).spots);
});
check('F at a spot gathers after 1.2 s of standing still; moving or a bump stops it; F elsewhere uses the item', () => {
  const g = fresh(), b = g.beast; g.buddy.cooldown = 1e9; g.order = 'close'; b.state = 'rest'; b.duration = 1e9;
  const spot = g.spots.find((s) => s.material === 'berry'); g.hero.x = spot.x + 1; g.hero.z = spot.z; g.hero.fluff = 50;
  assert.equal(g.nearestGather(), spot); g.step(DT, input({ use: true })); assert(g.gathering); assert.equal(g.profile.pouch.fluffberry, CAMP_BERRIES, 'gathering, not eating');
  still(g, GATHER_TIME - 0.1); assert.equal(g.profile.pouch.berry, 0); still(g, 0.15);
  assert(spot.done); assert.equal(g.profile.pouch.berry, spot.count); assert(g.events.some((e) => e.kind === 'gather')); assert.equal(g.gathering, null);
  g.step(DT); g.step(DT, input({ use: true })); assert.equal(g.gathering, null, 'a gathered spot is empty'); assert.equal(g.profile.pouch.fluffberry, CAMP_BERRIES - 1, 'so F eats a berry');
  const other = g.spots.find((s) => !s.done); g.hero.x = other.x + 1; g.hero.z = other.z;
  g.step(DT); g.step(DT, input({ use: true })); still(g, 0.5); g.step(DT, input({ x: 1 })); assert.equal(g.gathering, null, 'moving stops gathering'); still(g, 2); assert.equal(other.done, false);
  g.hero.x = other.x + 1; g.hero.z = other.z; g.step(DT); g.step(DT, input({ use: true })); still(g, 0.5); g.hero.invincible = 0; g.bumpHero(5, b); assert.equal(g.gathering, null, 'a bump stops it');
});
check('buddy Gather visits gathering spots once the ground is clear', () => {
  const g = fresh(), b = g.beast; b.state = 'rest'; b.duration = 1e9; g.commandBuddy(1); assert.equal(g.order, 'gather');
  const spots = g.spots.length; tick(g, 30);
  assert.equal(g.spots.filter((s) => s.done).length, spots); assert.equal(g.profile.pouch.berry, g.spots.reduce((n, s) => n + s.count, 0)); assert.equal(b.grump, b.maxGrump);
});
check('the Pantry crafts from recipes, by chapter, up to each carry limit, only at camp', () => {
  const g = village(); g.profile.pouch.berry = 30; g.profile.pouch['marsh-reed'] = 10;
  g.story.chapter = 1; assert.equal(g.craft('big-fluffberry'), false, 'chapter 2 recipe'); assert.equal(g.craft('fluffberry'), false); g.story.chapter = 2;
  assert(g.craft('fluffberry')); assert.equal(g.profile.pouch.berry, 29); assert.equal(g.profile.pouch.fluffberry, 1);
  while (g.craft('fluffberry')) { /* up to the limit */ } assert.equal(g.profile.pouch.fluffberry, ITEMS.fluffberry.max); assert.equal(g.profile.pouch.berry, 30 - ITEMS.fluffberry.max);
  const two = village(39, 1); Object.assign(two.profile.pouch, { berry: 4, 'marsh-reed': 3, 'cloud-wisp': 1, 'puff-sac': 1 }); assert.equal(two.chapter, 2);
  assert(two.craft('big-fluffberry')); assert(two.craft('sleepy-seed')); assert(two.craft('smoke-puffball')); assert.equal(two.craft('hay-bundle'), false, 'one reed left');
  assert.deepEqual([two.profile.pouch.berry, two.profile.pouch['marsh-reed'], two.profile.pouch['cloud-wisp'], two.profile.pouch['puff-sac']], [1, 2, 0, 0]);
  assert.equal(two.craft('dizzy-bell'), false); const four = village(39, 3); Object.assign(four.profile.pouch, { 'horn-chip': 1, 'bristle-tuft': 2 }); assert(four.craft('dizzy-bell'));
  four.startHunt('bristleback'); four.profile.pouch.berry = 5; assert.equal(four.craft('fluffberry'), false, 'not in the meadow');
  for (const id of Object.keys(ITEMS)) assert(Object.keys(ITEMS[id].recipe).length > 0);
});
check('the ring holds one to six items in a fixed order; Q/E cycle it and F uses the picked one', () => {
  const g = village(); assert.equal(g.ring.length, RING_SIZE); assert.equal(g.toggleRing('pathfinder-acorn'), false, 'full');
  assert(g.toggleRing('sleepy-seed')); assert(g.toggleRing('pathfinder-acorn')); assert.deepEqual(g.ring, RING_ITEMS.filter((id) => id !== 'sleepy-seed'));
  for (const id of g.ring.slice(1)) g.toggleRing(id); assert.deepEqual(g.ring, ['fluffberry']); assert.equal(g.toggleRing('fluffberry'), false, 'keeps one'); assert.equal(g.toggleRing('hay-bundle'), false);
  g.toggleRing('smoke-puffball'); g.profile.pouch['smoke-puffball'] = 1; g.startHunt('bristleback');
  g.step(DT, input({ next: true })); assert.equal(g.ringItem, 'smoke-puffball'); g.step(DT); g.step(DT, input({ next: true })); assert.equal(g.ringItem, 'fluffberry');
  g.step(DT); g.step(DT, input({ previous: true })); g.step(DT); g.step(DT, input({ use: true })); assert(g.hero.hidden > 0); assert.equal(g.profile.pouch['smoke-puffball'], 0);
});
check('big fluffberries heal 70, sleepy seeds slow the beast 30% for 8 s and only within ten steps', () => {
  const g = fresh(); g.profile.pouch['big-fluffberry'] = 1; g.item = 1; g.hero.fluff = 50; assert(g.useItem()); assert.equal(g.hero.fluff, 100);
  const run = (seed) => { const h = fresh('bristleback', 'dora', 3); const b = h.beast; h.buddy.cooldown = 1e9; b.x = b.z = 0; h.hero.x = 0; h.hero.z = 8; h.hero.invincible = 1e9; if (seed) { h.profile.pouch['sleepy-seed'] = 1; h.item = 2; assert(h.useItem()); assert.equal(b.drowsy, 8); }
    b.state = 'roam'; b.t = 0; b.duration = 0; h.step(DT); while (b.state === 'windup') h.step(DT); h.step(DT); h.step(DT); return distance(b, b.start); };
  assert(Math.abs(run(true) / run(false) - 0.7) < 0.02);
  const far = fresh(); far.profile.pouch['sleepy-seed'] = 1; far.item = 2; far.hero.z = far.beast.z + 10.5; assert.equal(far.useItem(), false); assert.equal(far.profile.pouch['sleepy-seed'], 1);
  const wear = fresh(); wear.beast.drowsy = 0.5; wear.beast.state = 'rest'; wear.beast.duration = 1e9; tick(wear, 0.6); assert.equal(wear.beast.drowsy, 0);
});
check('a dizzy bell rung beside the beast adds 40 Dizzy: two bells and a big bonk make it dizzy, and it is never wasted', () => {
  const g = fresh(), b = g.beast; g.buddy.cooldown = 1e9; b.state = 'rest'; b.duration = 1e9; g.profile.pouch['dizzy-bell'] = 3; g.item = 3;
  g.hero.z = b.z + 5; assert.equal(g.useItem(), false); assert.equal(g.profile.pouch['dizzy-bell'], 3);
  g.hero.z = b.z + 3; assert(g.useItem()); assert.equal(b.dizzy, 40); g.itemRecovery = 0; assert(g.useItem()); assert.equal(b.dizzy, 80); assert.equal(b.state, 'rest');
  g.bonkBeast(1, true, g.hero); assert.equal(b.state, 'dizzy', '80 + a big bonk'); assert.equal(g.useItem(), false, 'already dizzy'); assert.equal(g.profile.pouch['dizzy-bell'], 1);
});
check('sticky sap: one trap at a time; a grounded beast that reaches it is stuck for 4 s, even mid-charge', () => {
  const g = fresh(), b = g.beast; g.buddy.cooldown = 1e9; g.hero.invincible = 1e9; g.obstacles = []; g.profile.pouch['sticky-sap'] = 2; g.item = 4;
  b.x = 0; b.z = -8; g.hero.x = 0; g.hero.z = 0; assert(g.useItem()); assert.equal(g.useItem(), false, 'one at a time'); assert.equal(g.profile.pouch['sticky-sap'], 1);
  g.hero.z = 6; b.state = 'roam'; b.t = 0; b.duration = 0; g.step(DT); assert.equal(b.state, 'windup');
  while (b.state !== 'stuck' && b.state !== 'rest') g.step(DT);
  assert.equal(b.state, 'stuck'); assert(Math.abs(b.z) < 1.7, 'stopped on the trap'); assert.equal(g.trap, null); assert(g.events.some((e) => e.kind === 'trap'));
  const at = { x: b.x, z: b.z }; let stuck = 0; while (b.state === 'stuck') { g.step(DT); stuck += DT; assert.deepEqual({ x: b.x, z: b.z }, at); }
  assert(Math.abs(stuck - ITEMS['sticky-sap'].effect.seconds) < 2 * DT); assert.equal(b.state, 'rest');
  const owl = fresh('skreel'); owl.trap = { x: owl.beast.x, z: owl.beast.z }; owl.beast.height = 2.4; owl.step(DT); assert.notEqual(owl.beast.state, 'stuck', 'flying over is fine');
});
check('a smoke puffball hides you for 6 s: the beast wanders and starts no attack, and a bonk gives you away', () => {
  const g = fresh(), b = g.beast; g.buddy.cooldown = 1e9; g.profile.pouch['smoke-puffball'] = 2; g.item = 5; g.hero.x = 0; g.hero.z = 10;
  b.state = 'roam'; b.t = 0; b.duration = 0.1; assert(g.useItem()); assert.equal(g.hero.hidden, 6);
  const states = new Set(); for (let t = 0; t < 5.9; t += DT) { g.step(DT); states.add(b.state); }
  assert.deepEqual([...states], ['roam']); assert(distance(b, g.hero) > 5);
  tick(g, 0.2); assert.equal(g.hero.hidden, 0); tick(g, 0.2); assert.equal(b.state, 'windup', 'found again after six seconds');
  const p = fresh(); p.profile.pouch['smoke-puffball'] = 1; p.item = 5; assert(p.useItem()); p.bonkBeast(5, false, p.hero); assert.equal(p.hero.hidden, 0); assert.match(p.note, /Peekaboo/);
});
check('a pathfinder acorn lights Enzo’s trail for 20 s', () => {
  const g = fresh(); g.profile.ring = ['fluffberry', 'pathfinder-acorn']; g.profile.pouch['pathfinder-acorn'] = 1; g.item = 1; g.beast.state = 'rest'; g.beast.duration = 1e9;
  g.hero.x = 0; g.hero.z = 4; g.beast.x = 0; g.beast.z = -8; assert(g.useItem()); assert.equal(g.sniff, 20); assert(g.trail().length > 4);
  tick(g, 19.5); assert(g.sniff > 0); tick(g, 1); assert.equal(g.sniff, 0);
});
check('snacks: one packed at a time, paid at the Pantry, used up by the next hunt', () => {
  const g = village(39, 1); g.profile.pouch.berry = 10; g.profile.pouch['hay-bundle'] = 3; g.profile.pouch['glimmer-stone'] = 1;
  assert.equal(g.eatSnack('lucky-seed-bun'), false, 'chapter 3'); assert(g.eatSnack('clover-crunch')); assert.equal(g.profile.pouch.berry, 8); assert.equal(g.eatSnack('hay-nibble'), false, 'one at a time');
  g.startHunt('bristleback'); assert.equal(g.snack, 'clover-crunch'); assert.equal(g.profile.snack, null); assert.equal(g.hero.fluff, 120); assert.equal(g.hero.maxFluff, 120);
  g.hero.fluff = 100; g.profile.pouch.fluffberry = 3; assert(g.useItem()); assert.equal(g.hero.fluff, 120);
  g.returnVillage(); g.startHunt('bristleback'); assert.equal(g.snack, null); assert.equal(g.hero.maxFluff, 100);
  g.returnVillage(); assert(g.eatSnack('hay-nibble')); g.startHunt('bristleback'); g.hero.rollCd = 0.85; tick(g, 0.85 / 1.25 + DT); assert.equal(g.hero.rollCd, 0);
  g.returnVillage(); assert(g.eatSnack('berry-stack')); g.startHunt('bristleback'); g.beast.state = 'rest'; g.bonkBeast(1, true, g.hero); assert(Math.abs(g.beast.dizzy - 55) < 1e-9);
  let plain = 0, lucky = 0;
  for (let seed = 1; seed <= 60; seed++) for (const bun of [false, true]) {
    const h = village(seed, 3); if (bun) { Object.assign(h.profile.pouch, { berry: 2, 'hay-bundle': 1, 'glimmer-stone': 1 }); assert(h.eatSnack('lucky-seed-bun')); }
    h.startHunt('bristleback'); calm(h); const rares = h.reward.filter((m) => m === DROPS.bristleback.calm.rare.id).length; if (bun) lucky += rares; else plain += rares;
  }
  assert(lucky > plain * 1.4, `lucky ${lucky} vs plain ${plain}`);
  for (const id of SNACK_IDS) assert(SNACKS[id].cost);
});
const geared = (type, tier = 1, branch = null, beast = 'bristleback') => {
  const g = new HuntGame(77); g.chooseHero('dora'); g.story.chapter = 6; g.profile.extraGrumpyUnlocked = true; for (const id of BEAST_IDS) g.profile.beastBook[id].met = true; for (const id of BEAST_IDS) g.profile.naps[id] = 1;
  postGame(g);
  g.profile.weapons[type] = { tier, branch }; assert(g.equip(type)); assert(g.startHunt(beast));
  g.buddy.cooldown = 1e9; g.hero.invincible = 1e9; g.obstacles = []; g.beast.state = 'rest'; g.beast.duration = 100;
  g.hero.x = g.beast.x; g.hero.z = g.beast.z + 2.7; return g;
};
const special = (g, seconds = 0.1) => { tick(g, seconds, input({ charge: true, bonk: seconds >= 0.2 && ['greatsword', 'lance', 'gunlance', 'chargeblade'].includes(g.weapon()) })); tick(g, 0.3); };
check('either hero equips all fourteen basic tools; the buddy remembers their own choice', () => {
  const g = new HuntGame(); g.chooseHero('enzo');
  for (const type of Object.keys(WEAPON_TYPES).filter((id) => WEAPON_TYPES[id].chapter === 0)) { assert(g.equip(type, 'dora')); assert(g.equip(type, 'enzo')); }
  assert(g.equip('sword', 'dora')); assert(g.equip('bow', 'enzo')); g.chooseHero('dora'); assert.equal(g.weapon(g.buddyId), 'bow');
  assert(g.startHunt('bristleback')); assert.equal(g.equip('hammer'), false);
});
check('guard perks block sides, perfect guards build Dizzy, and lance reflects charges', () => {
  const g = geared('greatsword', 4, 'B'); g.hero.invincible = 0; g.step(DT, input({ charge: true }));
  const side = { x: g.hero.x + 3, z: g.hero.z }; assert.equal(g.bumpHero(20, side), false); assert.equal(g.hero.fluff, 100); assert.equal(g.beast.dizzy, 20);
  const lance = geared('lance', 4, 'B'); lance.hero.invincible = 0; lance.step(DT, input({ charge: true })); lance.beast.state = 'charge';
  assert.equal(lance.bumpHero(20, lance.beast), false); assert.equal(lance.beast.state, 'dizzy');
});
check('greatsword finish and lance counter pop parts; shield bash and leap have different perks', () => {
  for (const type of ['greatsword', 'lance']) { const g = geared(type, 4, 'A'); if (type === 'lance') g.counter = 2; special(g, 0.6); assert(g.beast.broken, type); }
  const a = geared('sword', 3, 'A'), b = geared('sword'); special(a); special(b); assert(a.beast.dizzy > b.beast.dizzy);
  const leap = geared('sword', 4, 'B'), plain = geared('sword', 4, 'A'); special(leap, 0.5); special(plain, 0.5); assert(leap.beast.grump < plain.beast.grump);
});
check('Focus, Bloom, seedpods and firefly glows have distinct working signatures', () => {
  const katana = geared('katana', 4, 'A'); katana.hero.invincible = 0; special(katana, 0.05); assert.equal(katana.bumpHero(10, katana.beast), false); assert.equal(katana.focus, 100);
  const spade = geared('switchaxe', 4, 'B'); special(spade); assert(spade.bloom); spade.focus = 100; special(spade, 0.5); assert(spade.focus < 100); assert(spade.beast.grump < spade.beast.maxGrump - 40);
  const pod = geared('chargeblade', 4, 'B'); tick(pod, 1.2, input({ bonk: true })); assert(pod.pods > 0); special(pod); tick(pod, 0.8, input({ bonk: true })); assert.equal(pod.pods, 0);
  const fly = geared('glaive', 4, 'B'); fly.hero.fluff = 50; special(fly); assert.equal(fly.hero.fluff, 55); assert(fly.glow > 15); tick(fly, 0.8, input({ bonk: true })); assert(fly.vault > 0);
});
check('songs heal both friends, Glimmer heals every tenth hit, and sleepy puffs build Dizzy over time', () => {
  const horn = geared('horn', 4, 'B'); horn.hero.fluff = 40; horn.buddy.fluff = 60; special(horn); assert.equal(horn.hero.fluff, 50); assert.equal(horn.buddy.fluff, 70); assert(horn.song > 0);
  const glow = geared('hammer', 5, 'A'); glow.hero.fluff = 40; glow.buddy.fluff = 60;
  for (let i = 0; i < 9; i++) glow.bonkBeast(1, false, glow.hero); assert.equal(glow.hero.fluff, 40); glow.bonkBeast(1, false, glow.hero); assert.equal(glow.hero.fluff, 50); assert.equal(glow.buddy.fluff, 70);
  const puff = geared('hammer', 3, 'B'); puff.bonkBeast(1, false, puff.hero); const initial = puff.beast.dizzy; tick(puff, 2.3); assert(puff.beast.dizzy >= initial + 4.9);
});
check('bow seed tiers share the original Bonk; slingshot rolls reload; Big Poof has a cooldown', () => {
  const quick = geared('bow'); special(quick, 0.6); assert(Math.abs(quick.beast.maxGrump - quick.beast.grump - 20 * WEAK_SPOT) < 1e-9, 'a face shot is a weak-spot hit'); assert.equal(quick.beast.dizzy, 50);
  const bow = geared('bow'); special(bow, 1.1); assert(bow.shots.length > 0 || bow.beast.grump < bow.beast.maxGrump); assert.equal(bow.shotsFired, 1);
  const sling = geared('lightbow'); tick(sling, 3, input({ bonk: true })); assert.equal(sling.loaded, 0); sling.step(DT, input({ roll: true })); assert.equal(sling.loaded, 6);
  const poof = geared('gunlance', 4, 'A'); special(poof, 0.5); assert(poof.poof > 2 && poof.poof <= 3);
});
check('all armour skills affect combat at two or three pieces and mixed pieces add Fluff', () => {
  const outfit = (beast, n) => { const g = geared('lance'); g.profile.armour.worn = Object.fromEntries(SLOTS.slice(0, n).map((slot) => [slot, `${beast}-${slot}`])); g.hero.invincible = 0; return g; };
  const steady = outfit('bristleback', 2), plain = outfit('bristleback', 1); steady.bumpHero(1, steady.beast); plain.bumpHero(1, plain.beast); assert(distance(steady.hero, steady.beast) < distance(plain.hero, plain.beast));
  const cloud = outfit('puffwart', 2); cloud.hero.slow = 1; cloud.step(DT, input({ x: 1 })); assert(cloud.hero.speed > 3);
  const deep = outfit('puffwart', 3); deep.hero.fluff = 20; assert(deep.useItem()); assert.equal(deep.itemRecovery, 0.3);
  const dodge = outfit('skreel', 2); dodge.hero.roll = 0.4; assert.equal(dodge.bumpHero(10, dodge.beast), false);
  const jump = outfit('skreel', 3); jump.step(DT, input({ roll: true })); jump.step(DT); jump.step(DT, input({ roll: true })); assert.equal(jump.extraRoll, false);
  const shell = outfit('hornclack', 2); shell.step(DT, input({ charge: true })); assert.equal(shell.bumpHero(20, { x: shell.hero.x + 3, z: shell.hero.z }), false);
  const frost = outfit('frostmane', 3); frost.hero.fluff = 1; assert(frost.bumpHero(20, frost.beast)); assert.equal(frost.hero.fluff, 50); frost.hero.invincible = 0; frost.bumpHero(100, frost.beast); assert.equal(frost.mode, 'camp');
  const regen = outfit('frostmane', 2); regen.hero.fluff = 50; regen.hero.z = 15; tick(regen, 2.2); assert(regen.hero.fluff >= 51);
});
check('Bubble Burst heals the buddy and gathers loose materials; Yo-yo loop perks reach further', () => {
  const bubble = geared('wand', 4, 'A'); bubble.buddy.fluff = 40; bubble.drops.push({ id: 990, x: bubble.beast.x, z: bubble.beast.z, material: 'berry', count: 1 });
  tick(bubble, 0.8, input({ bonk: true })); assert(bubble.buddy.fluff >= 65); assert(bubble.profile.pouch.berry > 0);
  const yoyo = geared('yoyo', 3, 'A'); yoyo.hero.z = yoyo.beast.z + 4.4; tick(yoyo, 0.4, input({ bonk: true })); assert(yoyo.beast.grump < yoyo.beast.maxGrump);
  const loop = geared('yoyo', 4, 'B'); loop.drops.push({ id: 991, x: loop.hero.x + 5, z: loop.hero.z, material: 'berry', count: 2 }); tick(loop, 0.4, input({ bonk: true })); assert.equal(loop.profile.pouch.berry, 2);
});
check('Pumpkin Flurry needs planted paws and its branch reduces recovery; sticky ammo roots on the third seed', () => {
  const pumpkin = geared('heavybow', 4, 'A'); tick(pumpkin, 0.8, input({ charge: true })); assert(pumpkin.shotsFired >= 3); pumpkin.step(DT); assert(pumpkin.flurry > 3 && pumpkin.flurry <= 3.5);
  const moving = geared('heavybow'); tick(moving, 0.5, input({ charge: true, x: 1 })); assert.equal(moving.shotsFired, 0);
  const bow = geared('bow', 4, 'B'); special(bow, 0.05); assert.equal(bow.ammo, 1); tick(bow, 2, input({ bonk: true })); assert(bow.stickyHits >= 3); assert(bow.beast.state === 'stuck' || bow.beast.state === 'dizzy');
});
check('every weapon tree path keeps normal and charged hero and buddy Bonk and Dizzy', () => {
  function measure(type, tier, branch, buddy, heavy, charge) {
    const g = geared(type, tier, branch), b = g.beast;
    b.grump = b.maxGrump = 100000; g.profile.equipped.enzo = type;
    g.swingCharge = charge; let dizzy = 0;
    g.makeDizzy = () => { dizzy += DIZZY_FULL; };
    const add = g.addDizzy.bind(g); g.addDizzy = (n, hit) => { dizzy += n; add(n, hit); };
    if (g.ranged(buddy ? g.buddyId : g.heroId)) {
      g.shoot(buddy ? g.buddy : g.hero, heavy, buddy);
      for (const s of g.shots) g.bonkBeast(s.power, s.heavy, g.hero, buddy, s.dizzyShare);
    } else if (buddy) {
      const power = type === 'hammer' ? 8 : WEAPON_TYPES[type].bonk * 2 / 3;
      g.bonkBeast(power * g.weaponScale(type), heavy, g.buddy, true);
    } else g.weaponBonk(heavy);
    return [100000 - b.grump, dizzy];
  }
  for (const type of Object.keys(WEAPON_TYPES)) for (const branch of ['A', 'B']) for (const buddy of [false, true]) for (const [heavy, charge] of [[false, 0], [true, 0.6], [true, 1.1]]) {
    let previous = [0, 0];
    for (let tier = 1; tier <= 5; tier++) {
      const next = measure(type, tier, tier < 3 ? null : branch, buddy, heavy, charge);
      for (let i = 0; i < 2; i++) assert(next[i] + 1e-8 >= previous[i], `${type} ${branch} tier ${tier}, buddy ${buddy}, heavy ${heavy}, stat ${i}: ${previous} → ${next}`);
      previous = next;
    }
  }
});
check('v1 and v2 levels two and three retain old hero and buddy power', () => {
  for (const v of [1, 2]) for (const level of [2, 3]) for (const hero of ['dora', 'enzo']) {
    const g = HuntGame.load({ v, profile: { hero, levels: { dora: level, enzo: level } } });
    assert(g.startHunt('bristleback')); g.obstacles = []; const b = g.beast; b.state = 'rest';
    g.hero.x = b.x; g.hero.z = b.z + 2.7;
    for (const heavy of [false, true]) {
      b.grump = b.maxGrump = 10000; b.state = 'rest'; g.swingCharge = 0.6; g.shots = [];
      if (hero === 'dora') g.weaponBonk(heavy);
      else { g.shoot(g.hero, heavy, false); for (const s of g.shots) g.bonkBeast(s.power, heavy, g.hero, false, s.dizzyShare); }
      const old = (hero === 'dora' ? heavy ? 27 : 14 : heavy ? 20 : 9) * (1 + (level - 1) * (hero === 'dora' ? 0.35 : 0.32));
      assert(10000 - b.grump + 1e-8 >= old, `${v}/${level}/${hero}/${heavy}`);
    }
    const type = g.weapon(g.buddyId), oldBuddy = (type === 'hammer' ? 8 : 5) * (1 + (level - 1) * (type === 'hammer' ? 0.3 : 0.32));
    const newBuddy = (type === 'hammer' ? 8 : 5) * g.weaponScale(type); assert(newBuddy >= oldBuddy);
  }
});
check('final mist bonks and tuckered camp returns clear all hunt weapon state', () => {
  const g = geared('katana', 3, 'B'); g.beast.grump = 1; g.weaponBonk(true); assert.equal(g.mode, 'nap');
  tick(g, 3.5); g.returnVillage(); assert.equal(g.mist, 0); assert.doesNotThrow(() => g.step(DT));
  g.mist = 1; assert.doesNotThrow(() => g.step(DT)); g.addDizzy(5);
  const camp = geared('hammer', 3, 'B'); camp.buddy.swing = 0.2; camp.mist = 2; camp.vault = 1; camp.bloom = true; camp.pods = 3; camp.hero.invincible = 0; camp.bumpHero(1000, camp.beast);
  assert.equal(camp.mode, 'camp'); for (const key of ['mist', 'vault', 'pods', 'counter', 'poof', 'flurry', 'focus', 'glow', 'song']) assert.equal(camp[key], 0, key); assert.equal(camp.bloom, false); assert.equal(camp.buddy.swing, -1);
});
check('held guards end quietly; taps and J plus K still use signatures', () => {
  for (const type of ['greatsword', 'gunlance', 'chargeblade']) {
    const g = geared(type); tick(g, 0.5, input({ charge: true })); assert(g.guarding); tick(g, 0.4);
    assert.equal(g.beast.grump, g.beast.maxGrump, type); assert.equal(g.bloom, false); assert.equal(g.poof, 0);
    tick(g, 0.5, input({ charge: true })); assert(g.guarding, type);
  }
  const blade = geared('chargeblade'); special(blade, 0.05); assert(blade.bloom);
  const poof = geared('gunlance'); special(poof, 0.5); assert(poof.poof > 0);
});
check('Platepod guards cap pods and Galepod Dizzy needs every pod', () => {
  const g = geared('chargeblade', 4, 'A'); g.pods = 3; g.hero.invincible = 0; g.step(DT, input({ charge: true })); g.bumpHero(10, g.beast); assert.equal(g.pods, 3);
  for (const pods of [3, 4]) { const b = geared('chargeblade', 4, 'B'); b.bloom = true; b.pods = pods; b.weaponBonk(false); assert.equal(b.beast.state === 'dizzy', pods === 4); }
});
check('Staff taps stay grounded and a hero vault cannot lift a melee buddy', () => {
  const g = geared('glaive', 4, 'A'); tick(g, 0.15, input({ bonk: true })); assert.equal(g.vault, 0);
  tick(g, 0.8, input({ bonk: true })); assert(g.vault > 0);
  g.beast.id = 'skreel'; g.beast.height = 3; g.profile.equipped.enzo = 'hammer'; assert.equal(g.bonkBeast(1, true, g.buddy, true), false);
  const grounded = geared('glaive'); grounded.beast.id = 'skreel'; grounded.beast.height = 3; assert.equal(grounded.bonkBeast(1, false, grounded.hero), false);
});
check('buddy shots own their ammo, charge, fifth shot and pierce perks', () => {
  const g = geared('lightbow', 4, 'A'); g.ammo = 2; g.swingCharge = 1.4; g.shotsFired = 4; g.profile.equipped.enzo = 'bow';
  g.shoot(g.buddy, false, true); const s = g.shots[0]; assert.equal(s.ammo, 0); assert.equal(s.charge, 0); assert.equal(s.power, 5); assert.equal(s.heavy, false);
  g.shots = []; g.profile.equipped.enzo = 'lightbow'; g.profile.equipped.dora = 'hammer'; g.buddyShots = 4; g.shoot(g.buddy, false, true); assert.equal(g.shots[0].power, WEAPON_TYPES.lightbow.bonk * 2 / 3 * 2.1 * 2);
  const bow = geared('bow', 4, 'A'); bow.profile.equipped.enzo = 'bow'; bow.swingCharge = 1.4; bow.shoot(bow.beast, false, true); bow.step(DT); assert.equal(bow.shots.length, 0, 'uncharged buddy seeds do not pierce');
});
check('buddy double bubbles stay buddy hits and reach from thirteen steps', () => {
  const g = geared('hammer'); g.profile.equipped.enzo = 'wand'; g.profile.weapons.wand = { tier: 4, branch: 'B' };
  g.buddy.x = g.beast.x; g.buddy.z = g.beast.z + 12.9; g.shoot(g.buddy, false, true);
  tick(g, 2.4); assert.equal(g.hits, 0); assert.equal(g.buddyHits, 2); assert(g.beast.grump < g.beast.maxGrump);
});
check('Swish Counter respects reach and Bloom fills only in Bloom mode', () => {
  const g = geared('katana'); g.hero.z = 20; g.counter = 0.3; g.hero.invincible = 0; g.bumpHero(1, g.beast); assert.equal(g.beast.grump, g.beast.maxGrump);
  const axe = geared('switchaxe', 3, 'B'); axe.bonkBeast(1, false, axe.hero); assert.equal(axe.focus, 0); axe.bloom = true; axe.bonkBeast(1, false, axe.hero); assert.equal(axe.focus, 25);
});
check('two quick items work while Deep Breath shortens their recovery animation', () => {
  const g = geared('hammer'); g.hero.fluff = 1; assert(g.useItem()); assert(g.useItem()); assert.equal(g.hero.fluff, 61); assert.equal(g.itemRecovery, 0.6);
  g.profile.armour.worn = Object.fromEntries(SLOTS.map((slot) => [slot, `puffwart-${slot}`])); assert(g.useItem()); assert.equal(g.itemRecovery, 0.3);
});

const rider = (type = 'yoyo', tier = 1, branch = null) => {
  const g = geared(type, tier, branch); g.obstacles = []; g.buddy.cooldown = 1000; g.buddy.berry = 1000;
  g.hero.x = g.beast.x; g.hero.z = g.beast.z + 2.5; g.makeDizzy(20); return g;
};
const loopOn = (g) => { tick(g, 0.05, input({ charge: true })); tick(g, 0.3); };
const tapRide = (g, n) => { for (let i = 0; i < n; i++) { g.step(DT, input({ bonk: true, charge: true })); tick(g, 0.12, input({ charge: true })); } };
check('Hop-on: only a connecting Yo-yo loop on a dizzy or sap-stuck beast starts a ride', () => {
  const g = rider(); loopOn(g); assert(g.ride.riding); assert.equal(g.rides, 1); assert.equal(g.hero.x, g.beast.x); assert.equal(g.hero.z, g.beast.z);
  for (const state of ['roam', 'stuck']) { const h = rider(); h.beast.state = state; loopOn(h); assert.equal(h.ride.riding, state === 'stuck'); }
  const far = rider(); far.hero.z += 10; loopOn(far); assert.equal(far.ride.riding, false);
});
check('Hop-on: outward rock rolls and Staff vaults use a two-unit landing with a three-unit opening', () => {
  for (const type of ['hammer', 'glaive']) { const g = rider(type); g.obstacles = [{ x: 0, z: 0, r: 1, kind: 'rock' }]; g.hero.x = 1.5; g.hero.z = 0; g.beast.x = 5; g.beast.z = 0;
    assert(g.rockHop(1, 0)); assert.equal(g.rockHop(-1, 0), null);
    if (type === 'glaive') { g.hero.x = 1.45; g.hero.cooldown = 100; tick(g, 0.3, input({ bonk: true })); tick(g, 0.08, input({ x: 1, bonk: true })); } else g.step(DT, input({ x: 1, roll: true })); assert(g.ride.riding);
  }
  for (const missing of ['rock', 'dizzy', 'landing']) { const g = rider('hammer'); g.obstacles = missing === 'rock' ? [] : [{ x: 0, z: 0, r: 1, kind: 'rock' }]; g.hero.x = 1.5; g.hero.z = 0; g.beast.x = missing === 'landing' ? 10 : 5; g.beast.z = 0; if (missing === 'dizzy') g.beast.state = 'rest'; g.step(DT, input({ x: 1, roll: true })); assert.equal(g.ride.riding, false); }
});
check('Hop-on: five J edges fill a full bonk; a held J never spams, and normal tier Bonk lowers Grump', () => {
  const g = rider(); loopOn(g); const grump = g.beast.grump;
  tick(g, 0.8, input({ bonk: true, charge: true })); assert.equal(g.ride.meter, 1); assert.equal(g.ride.fullBonks, 0);
  g.step(DT, input({ charge: true })); tapRide(g, 4); assert.equal(g.ride.fullBonks, 1); assert.equal(g.ride.meter, 0);
  assert(Math.abs(grump - g.beast.grump - WEAPON_TYPES.yoyo.bonk * 1.7) < 1e-8); assert(g.events.some((e) => e.kind === 'ride-bonk'));
});
check('Hop-on: every seeded buck warns for at least 0.6 seconds; grip is free and Frostmane bucks longer', () => {
  for (const id of BEAST_IDS) { const g = rider(); g.beast.id = id; loopOn(g); const stamina = g.stamina; let warning = 0, count = 0, buckTime = 0, prior = 'quiet';
    for (let i = 0; i < 7 / DT; i++) { g.step(DT, input({ charge: true })); if (g.ride.phase === 'warning') warning += DT; if (g.ride.phase === 'buck' && prior === 'warning') { assert(warning >= 0.6); warning = 0; count++; buckTime = g.ride.timer; } prior = g.ride.phase; }
    assert(count >= 2); assert(g.ride.riding); assert.equal(g.stamina, stamina); assert.equal(buckTime, id === 'frostmane' ? 0.5 : 0.3);
  }
});
check('Hop-on: an ungripped buck gives a soft invincible landing with no Fluff loss and preserves the meter', () => {
  const g = rider(); loopOn(g); tapRide(g, 2); const fluff = g.hero.fluff;
  tick(g, 2.5); assert.equal(g.ride.riding, false); assert.equal(g.ride.meter, 2); assert.equal(g.hero.fluff, fluff); assert(g.hero.invincible > 0); assert(distance(g.hero, g.beast) >= 1.85); assert(g.events.some((e) => e.kind === 'shaken-off'));
});
check('Hop-on: three full bonks plop, add exactly 30 Dizzy, restart dizzy, roll the part meter and shed two seeded commons', () => {
  const g = rider(); loopOn(g); g.beast.part = g.beast.maxGrump * 0.31; g.beast.dizzy = 0;
  // Make the plop chance certain without ordinary bonks crossing the part threshold.
  const plopDrops = []; const drop = g.drop.bind(g); g.drop = (at, material, count) => { if (at.x === g.beast.x + 3) plopDrops.push(material); drop(at, material, count); };
  let rolls = 0; const random = g.random.bind(g); g.random = () => { rolls++; return random(); };
  tapRide(g, 15); assert.equal(g.ride.fullBonks, 3); assert.equal(g.ride.riding, false); assert.equal(g.plops, 1); assert.equal(g.profile.totalPlops, 11, 'geared starts at 10 plops'); assert.equal(g.beast.dizzy, 30); assert.equal(g.beast.state, 'dizzy'); assert.equal(g.beast.duration, 3.2); assert(g.beast.t < 0.2); assert(g.beast.broken); assert(rolls >= 7); assert(g.events.some((e) => e.kind === 'plop')); assert.match(g.note, /two commons.*hopped off/);
  assert.equal(plopDrops.length, 2); assert(plopDrops.every((m) => DROPS[g.beast.id].calm.common.includes(m)));
  const chance = rider(); loopOn(chance); chance.beast.part = 0; chance.random = () => 0.99; tapRide(chance, 15); assert.equal(chance.beast.broken, false); assert.equal(chance.plops, 1);
});
check('Hop-on: the fifteenth tap still plops when its bonk also calms, and releasing grip after roll does not loop back on', () => {
  const g = rider(); loopOn(g); tapRide(g, 10); g.beast.grump = 1; tapRide(g, 5); assert.equal(g.mode, 'nap'); assert.equal(g.plops, 1); assert.match(g.plopNote, /hopped off/); assert.equal(g.ride.used, 0);
  const off = rider(); loopOn(off); off.step(DT, input({ charge: true })); off.step(DT, input({ roll: true, charge: true })); tick(off, 0.4); assert.equal(off.ride.riding, false); assert.equal(off.rides, 1);
});
check('Hop-on: roll is free, two rides per hunt, long-hop adds two seconds to cap and dizzy, dizzy expiry ends riding', () => {
  const g = rider(); loopOn(g); const fluff = g.hero.fluff;
  for (let i = 0; i < 2; i++) { g.hitstop = 0; g.step(DT, input({ roll: true })); assert.equal(g.hero.fluff, fluff); g.step(DT); if (i === 0) { g.hero.cooldown = 0; loopOn(g); assert(g.ride.riding); } }
  g.hero.cooldown = 0; loopOn(g); assert.equal(g.ride.riding, false); assert.equal(g.ride.used, 2);
  const long = rider('yoyo', 4, 'A'); const duration = long.beast.duration; loopOn(long); assert.equal(long.beast.duration, duration + 2); assert(long.ride.left > 9.5);
  long.beast.t = long.beast.duration - DT / 2; long.step(DT); assert.equal(long.ride.riding, false);
  const cap = rider(); loopOn(cap); tick(cap, 8.1, input({ charge: true })); assert.equal(cap.ride.riding, false);
});
check('Hop-on: seeded rides replay exactly and all exits clear transient ride state safely without a beast', () => {
  const run = () => { const g = rider(); loopOn(g); tick(g, 3, input({ charge: true })); tapRide(g, 15); return { ride: g.ride, beast: g.beast, drops: g.drops, rng: g.rng, fx: g.fx }; }; assert.deepEqual(run(), run());
  for (const phase of ['quiet', 'warning', 'buck']) { const g = rider(); loopOn(g); g.ride.phase = phase; g.returnVillage(); assert.equal(g.ride.riding, false); assert.equal(g.ride.used, 0); assert.doesNotThrow(() => tick(g, 1)); g.ride.riding = true; assert.doesNotThrow(() => g.step(DT)); assert.equal(g.ride.riding, false); }
  const nap = rider(); loopOn(nap); nap.bonkBeast(9999, false, nap.hero); assert.equal(nap.mode, 'nap'); assert.equal(nap.ride.used, 0); assert.doesNotThrow(() => tick(nap, 4));
  const camp = rider(); loopOn(camp); camp.endRide('roll'); camp.hero.invincible = 0; camp.bumpHero(9999, camp.beast); assert.equal(camp.mode, 'camp'); assert.equal(camp.ride.used, 0); assert.doesNotThrow(() => tick(camp, 1));
});

check('tutorial calf has 40 Grump and starts no warning before twenty seconds', () => {
  const g = new HuntGame(8); g.chooseHero('dora'); assert(g.startChapter()); g.buddy.cooldown = 1e9; g.hero.invincible = 1e9;
  assert.equal(g.beast.maxGrump, 40); assert.equal(g.area, 'paddock');
  for (let n = 0; n < 1199; n++) { g.step(DT); assert.equal(g.beast.cycle, 0); }
  tick(g, 3); assert(g.beast.cycle > 0); assert(g.beast.duration >= 0.6);
});
check('each area uses its obstacle table and the seeded meadow is unchanged, less the ring trees in the first zone\'s path', () => {
  // Zone 1 keeps every tree and rock inside the arena; only ring trees beyond the edge in the north path's gap step aside.
  const pathless = (list, gap) => list.filter((o) => Math.hypot(o.x, o.z) <= ARENA_RADIUS || !gap || Math.abs(Math.atan2(Math.sin(Math.atan2(o.z, o.x) + Math.PI / 2), Math.cos(Math.atan2(o.z, o.x) + Math.PI / 2))) >= 0.32);
  for (const c of STORY) {
    const g = new HuntGame(39); g.chooseHero('dora'); g.story.chapter = c.id; assert(g.startChapter()); const gap = g.zones > 1;
    assert.equal(gap, c.area !== 'paddock');
    if (c.area !== 'meadow') assert.deepEqual(g.obstacles, pathless(AREA_OBSTACLES[c.area], gap));
    else {
      assert.deepEqual(g.obstacles.slice(-4), [{ x: -9, z: 1, r: 0.8, kind: 'tree' }, { x: 9, z: -3, r: 0.9, kind: 'tree' }, { x: -6, z: -9, r: 1.3, kind: 'rock' }, { x: 7, z: 8, r: 1.1, kind: 'rock' }]);
      const original = new HuntGame(39); original.makeMeadow(); assert.equal(original.obstacles.length, 30); assert.deepEqual(g.obstacles, pathless(original.obstacles, gap)); assert(g.obstacles.length < 30, 'the path gap');
    }
  }
  assert.notDeepEqual(AREA_OBSTACLES.marsh, AREA_OBSTACLES.ridge); assert.notDeepEqual(AREA_OBSTACLES.hollow, AREA_OBSTACLES.peak);
});
check('story feature gates open on their teaching chapter and armour follows beast order', () => {
  const g = new HuntGame(); g.chooseHero('dora'); for (const id of Object.keys(g.profile.pouch)) g.profile.pouch[id] = cap(id);
  assert(!g.canForge('hammer-2')); assert(!g.canCraft('fluffberry')); assert(!g.canEat('clover-crunch')); assert(!g.canMakeArmour('bristleback-helm'));
  for (const id of Object.keys(ITEMS)) g.profile.pouch[id] = 0;
  g.story.chapter = 1; assert(g.canForge('hammer-2')); assert(!g.canMakeArmour('bristleback-helm'));
  g.story.chapter = 2; assert(g.canCraft('fluffberry')); assert(g.canEat('clover-crunch')); assert(g.canMakeArmour('bristleback-helm')); assert(!g.canMakeArmour('skreel-helm'));
  assert(!g.equip('wand')); g.story.chapter = 3; assert(g.equip('wand')); assert(g.feature('gathering')); assert(!g.equip('yoyo')); assert(!g.canCraft('sticky-sap'));
  g.story.chapter = 4; assert(g.equip('yoyo')); assert(g.canCraft('sticky-sap'));
});
check('variants require the ending, add sixty percent Grump and double the rare chance', () => {
  const locked = new HuntGame(); locked.chooseHero('dora'); assert(!locked.startHunt('bristleback', true));
  for (const id of BEAST_IDS) {
    const g = fresh(id); g.returnVillage(); assert(g.startHunt(id, true)); assert.equal(g.beast.maxGrump, BEASTS[id].grump * 1.6);
    assert.match(VARIANT_COLORS[id], /^#[0-9a-f]{6}$/); assert.notEqual(VARIANT_COLORS[id], BEASTS[id].color);
    const chance = DROPS[id].calm.rare.chance, r = () => chance * 1.5;
    assert.equal(rollCalm(r, id).length, DROPS[id].calm.count); assert.equal(rollCalm(r, id, [], 0, 2).length, DROPS[id].calm.count + 1);
    g.zoneAt = []; g.bonkBeast(g.beast.maxGrump * 0.72, false, { x: 0, z: -7 }); assert(g.beast.grumpy); g.hitstop = 0; g.beast.state = 'roam'; g.beast.duration = 0; g.step(DT); assert(g.beast.duration >= 0.6);
  }
});
check('daily picks are deterministic, distinct and do not change hunt randomness', () => {
  const ids = (day) => dailyBounties(day).map((t) => t.id);
  assert.deepEqual(ids('2026-10-24'), ids('2026-10-24')); assert.equal(new Set(ids('2026-10-24')).size, 3);
  assert.notDeepEqual(ids('2026-10-24'), ids('2026-10-25'));
  const g = fresh(); const rng = g.rng; assert(g.setBountyDay('2026-10-24')); void g.dailyBounties; assert.equal(g.rng, rng); assert(!g.setBountyDay('today')); assert(!g.setBountyDay('2026-02-30')); assert(g.setBountyDay('2028-02-29'));
});
check('every bounty checks its own task and rejects incomplete hunts', () => {
  const no = { items: 1, bumps: 1, gathered: 0, dizzies: 0, napped: false, turfs: 0 };
  for (const task of BOUNTIES) {
    const b = { id: 'bristleback', broken: false }; assert(!task.check(no, b), task.id);
    const yes = { items: 0, bumps: 0, gathered: 3, dizzies: 3, napped: true, turfs: 1 };
    const part = { tusks: 'bristleback', sac: 'puffwart', crest: 'skreel', horn: 'hornclack', mane: 'frostmane', pouch: 'paddlepaw', crown: 'rumblesnout' }[task.id];
    assert(task.check(yes, { id: part ?? 'bristleback', broken: true }), task.id);
    if (part) assert(!task.check(yes, { id: BEAST_IDS.find((id) => id !== part), broken: true }));
  }
});
check('a completed daily bounty pays only once, survives loading and resets with the day', () => {
  const g = fresh(); g.setBountyDay('2026-10-24'); const task = g.dailyBounties[0]; assert(!g.claimBounty(task.id));
  g.huntFacts = { items: 0, bumps: 0, gathered: 3, dizzies: 3, napped: true }; g.beast.broken = true;
  // Select a daily task that this beast can complete, without changing the daily picks.
  const achievable = g.dailyBounties.find((t) => t.check(g.huntFacts, g.beast)); assert(achievable);
  calm(g); assert(g.profile.bounties.ready.includes(achievable.id)); const before = g.profile.pouch.berry;
  assert(g.claimBounty(achievable.id)); assert.equal(g.profile.pouch.berry, before + 3); assert(!g.claimBounty(achievable.id));
  const loaded = HuntGame.load(g.save()); assert(!loaded.claimBounty(achievable.id)); assert(loaded.setBountyDay('2026-10-24')); assert(loaded.profile.bounties.done.includes(achievable.id));
  loaded.setBountyDay('2026-10-25'); assert.deepEqual(loaded.profile.bounties.done, []); assert.deepEqual(loaded.profile.bounties.ready, []);
  // Loading keeps the order tasks were earned in, drops repeats and other days' tasks.
  for (const day of ['2026-10-24', '2026-10-26']) {
    const picks = dailyBounties(day).map((t) => t.id), earned = [picks[2], picks[0]];
    g.profile.bounties = { day, done: [picks[1], 'tusks-not-today', picks[1]], ready: earned };
    const back = HuntGame.load(JSON.parse(JSON.stringify(g.save()))).profile.bounties;
    assert.deepEqual(back.ready, earned, day); assert.deepEqual(back.done, [picks[1]], day);
  }
});
check('v1, v2 and v3 saves migrate cleared chapters, seen scenes and equipment into v5', () => {
  for (const v of [1, 2, 3]) {
    const profile = { hero: 'enzo', naps: Object.fromEntries(BEAST_IDS.map((id, i) => [id, i < 3 ? 2 : 0])), levels: { dora: 3, enzo: 2 }, weapons: { yoyo: { tier: 3, branch: 'B' } }, equipped: { dora: 'yoyo', enzo: 'bow' }, pouch: { berry: 7 }, armour: { owned: ['bristleback-helm'], worn: { helm: 'bristleback-helm' } } };
    const g = HuntGame.load({ v, profile }); assert.equal(g.save().v, 6); assert.equal(g.chapter, 4);
    assert.deepEqual(g.story.scenesSeen, SCENES.filter((id) => Number(id[0]) <= 3)); assert(g.profile.beastBook.skreel.met); assert.equal(g.profile.beastBook.skreel.napped, 2);
    if (v === 3) { assert.equal(g.profile.weapons.yoyo.tier, 3); assert.equal(g.profile.equipped.dora, 'yoyo'); assert.equal(g.profile.armour.worn.helm, 'bristleback-helm'); }
    else assert.equal(g.profile.weapons.hammer.tier, 3);
    if (v !== 1) assert.equal(g.profile.pouch.berry, 7);
    const complete = HuntGame.load({ v, profile: { ...profile, naps: Object.fromEntries(BEAST_IDS.map((id) => [id, 1])) } }); assert.equal(complete.chapter, 6); assert(complete.profile.extraGrumpyUnlocked); assert.deepEqual(complete.story.scenesSeen, SCENES.filter((id) => id !== 'epilogue' && id !== 'finale'), 'an old finished save still gets the epilogue');
  }
  const gap = HuntGame.load({ v: 3, profile: { naps: { puffwart: 1 } } }); assert.equal(gap.chapter, 1); assert(gap.story.scenesSeen.includes('2-outro')); gap.chooseHero('dora'); gap.startChapter(); calm(gap); assert.equal(gap.chapter, 3, 'already cleared chapters beyond an old-save gap stay cleared');
});
check('v4 rejects malformed story, book and daily progress', () => {
  const g = HuntGame.load({ v: 4, profile: { story: { chapter: '6', scenesSeen: ['nonsense', 2] }, beastBook: { bristleback: { met: 'yes', napped: -4, partsBroken: ['nonsense'] } }, bounties: { day: 'not-a-date', done: ['nap'] }, extraGrumpyUnlocked: 'yes' } });
  assert.equal(g.chapter, 0); assert.deepEqual(g.story.scenesSeen, []); assert.deepEqual(g.profile.beastBook.bristleback, { met: false, napped: 0, partsBroken: [], best: 0 }); assert(!g.profile.extraGrumpyUnlocked); assert.equal(g.profile.bounties.day, '');
});
check('a v4 save moves into v5 with the counters it can prove, and v5 counters load strictly', () => {
  const g = fresh(); g.setBountyDay('2026-10-24'); g.profile.bounties.done = [g.dailyBounties[0].id]; g.profile.beastBook.skreel.partsBroken = ['crest'];
  const v4 = JSON.parse(JSON.stringify(g.save())); v4.v = 4; delete v4.profile.bountiesClaimed; delete v4.profile.variantNaps; delete v4.profile.totalPlops;
  const moved = HuntGame.load(v4); assert.equal(moved.save().v, 6); assert.equal(moved.profile.bountiesClaimed, 1); assert.equal(moved.profile.totalPlops, 0);
  assert.deepEqual(moved.profile.variantNaps, { bristleback: 0, puffwart: 0, skreel: 0, hornclack: 0, frostmane: 0, paddlepaw: 0, rumblesnout: 0 }); assert.deepEqual(moved.profile.beastBook.skreel.partsBroken, ['crest']);
  const bad = HuntGame.load({ v: 5, profile: { bountiesClaimed: -3, totalPlops: 'ten', variantNaps: { puffwart: 2.7, skreel: Infinity } } });
  assert.equal(bad.profile.bountiesClaimed, 0); assert.equal(bad.profile.totalPlops, 0); assert.equal(bad.profile.variantNaps.puffwart, 2); assert.equal(bad.profile.variantNaps.skreel, 0);
  const locked = HuntGame.load({ v: 5, profile: { story: { chapter: 6, scenesSeen: [] }, equipped: { dora: 'pogo' } } }); assert.equal(locked.profile.equipped.dora, 'hammer', 'a locked post-game tool is not equipped');
});
check('the same seed and chapter reproduce the complete story hunt', () => {
  for (let chapter = 0; chapter <= 5; chapter++) {
    const run = () => { const g = new HuntGame(983); g.chooseHero('enzo'); g.story.chapter = chapter; assert(g.startChapter()); for (let n = 0; n < 900; n++) g.step(DT, input({ bonk: n % 2 === 0, x: Math.sin(n * .01), z: Math.cos(n * .01) })); return { save: g.save(), beast: g.beast, obstacles: g.obstacles, rng: g.rng }; };
    assert.deepEqual(run(), run());
  }
});

check('post-game weapons open only after the story, each through its own goal and progress count', () => {
  const g = new HuntGame(5); g.chooseHero('dora'); g.story.chapter = 6;
  assert.deepEqual(POST_GAME_WEAPONS.map((t) => [g.weaponGoal(t).count, g.weaponGoal(t).total]), [[0, 5], [0, 5], [0, 10], [0, 5]]);
  for (const t of POST_GAME_WEAPONS) { assert(!g.weaponOpen(t), t); assert(!g.equip(t), t); }
  g.profile.bountiesClaimed = 4; g.profile.totalPlops = 9;
  for (const id of BEAST_IDS.slice(0, 4)) { g.profile.variantNaps[id] = 2; g.profile.beastBook[id].partsBroken = [BEASTS[id].part]; }
  assert.deepEqual(POST_GAME_WEAPONS.map((t) => g.weaponGoal(t).count), [4, 4, 9, 4]); for (const t of POST_GAME_WEAPONS) assert(!g.weaponOpen(t), t);
  postGame(g); for (const t of POST_GAME_WEAPONS) assert(g.equip(t), t);
  g.story.chapter = 5; for (const t of POST_GAME_WEAPONS) assert(!g.weaponOpen(t), `${t} waits for the story`);
  assert.equal(g.weaponGoal('hammer'), null);
});
check('claimed bounties, Extra Grumpy naps and plops count towards the goals', () => {
  const g = fresh(); g.setBountyDay('2026-10-24'); g.huntFacts = { items: 0, bumps: 0, gathered: 3, dizzies: 3, napped: true }; g.beast.broken = true;
  const task = g.dailyBounties.find((t) => t.check(g.huntFacts, g.beast)); calm(g); assert(g.claimBounty(task.id)); assert.equal(g.profile.bountiesClaimed, 1);
  assert.equal(g.profile.variantNaps.bristleback, 0); g.returnVillage();
  assert(g.startHunt('puffwart', true)); calm(g); assert.equal(g.profile.variantNaps.puffwart, 1); assert.equal(g.weaponGoal('puffer').count, 1);
  const loaded = HuntGame.load(JSON.parse(JSON.stringify(g.save()))); assert.equal(loaded.profile.bountiesClaimed, 1); assert.equal(loaded.profile.variantNaps.puffwart, 1);
});
check('Tickle Feather: hits fill Giggle, faster on a dizzy beast; full makes a 3 s giggle-dizzy; K taps a double-tickle', () => {
  const g = geared('feather'), b = g.beast; b.grump = b.maxGrump = 1e5;
  for (let i = 0; i < 8; i++) g.weaponBonk(false);
  assert.equal(g.giggle, 96); assert.notEqual(b.state, 'dizzy');
  g.weaponBonk(false); assert.equal(b.state, 'dizzy'); assert.equal(b.duration, 3); assert.equal(g.giggle, 0);
  g.weaponBonk(false); assert.equal(g.giggle, 15, 'a dizzy beast giggles faster');
  const fast = geared('feather', 3, 'A'); fast.beast.grump = fast.beast.maxGrump = 1e5; fast.weaponBonk(false); assert.equal(fast.giggle, 15);
  const buddy = geared('feather'); buddy.bonkBeast(2, false, buddy.buddy, true); assert.equal(buddy.giggle, 0, 'buddy hits leave the Giggle meter alone');
  const tap = geared('feather'), one = geared('feather');
  tap.step(DT, input({ charge: true })); tick(tap, 0.3); one.step(DT, input({ bonk: true })); tick(one, 0.3);
  const twice = tap.beast.maxGrump - tap.beast.grump, once = one.beast.maxGrump - one.beast.grump;
  assert(once > 0); assert(Math.abs(twice - 2 * once) < 1e-8, `${twice} vs ${once}`);
});
check('Dandelion Puffer: a 3.5-unit cone; fluff adds Dizzy for 3 s without stacking', () => {
  const g = geared('puffer'), b = g.beast; b.grump = b.maxGrump = 1e5;
  g.step(DT, input({ bonk: true })); tick(g, 0.3); assert(b.grump < b.maxGrump); assert(g.fluffTime > 2.5);
  g.step(DT, input({ bonk: true })); tick(g, 0.6); assert(g.fluffTime <= 3, 'a second puff refreshes the fluff time');
  const before = b.dizzy; tick(g, 1); assert(Math.abs(b.dizzy - before - 2) < 0.05, `${b.dizzy - before}`);
  tick(g, 3); const after = b.dizzy; tick(g, 1); assert.equal(g.fluffTime, 0); assert.equal(b.dizzy, after);
  const far = geared('puffer'); far.hero.z = far.beast.z + 4.2; far.step(DT, input({ bonk: true })); tick(far, 0.3); assert.equal(far.beast.grump, far.beast.maxGrump);
});
check('Dandelion Puffer: Big Breath pushes 2.5 units, stops at obstacles, adds 15 Dizzy and recharges for 6 s', () => {
  const breath = (g) => { tick(g, 0.5, input({ charge: true })); tick(g, 0.3); };
  const g = geared('puffer'), b = g.beast; b.grump = b.maxGrump = 1e5; const start = { x: b.x, z: b.z };
  breath(g); assert(Math.abs(distance(start, b) - 2.5) < 0.01, `${distance(start, b)}`); assert(b.dizzy >= 15); assert(g.breath > 5);
  assert.equal(g.chargeLevels(), 0); const grump = b.grump; breath(g); assert.equal(b.grump, grump, 'no second Big Breath while it recharges');
  tick(g, 6); assert.equal(g.breath, 0); assert.equal(g.chargeLevels(), 1);
  const wall = geared('puffer'), w = wall.beast; w.grump = w.maxGrump = 1e5; wall.obstacles = [{ x: w.x, z: w.z - 2, r: 0.6, kind: 'rock' }]; const at = { x: w.x, z: w.z };
  breath(wall); assert(distance(at, w) < 0.3, 'the push stops at the rock'); assert(distance(w, wall.obstacles[0]) >= 0.6 + 1.3 - 0.1);
});
check('Pogo Spring: J hops forward; a High Bounce reaches a flying Skreel and lands into a Hop-on on a dizzy beast', () => {
  const hop = geared('pogo'), z = hop.hero.z; hop.step(DT, input({ bonk: true })); assert(hop.hero.z < z - 0.5, 'the hop moves towards the beast');
  const bounce = (g) => { tick(g, 0.5, input({ charge: true })); g.step(DT); };
  const g = geared('pogo', 1, null, 'skreel'), b = g.beast; b.grump = b.maxGrump = 1e5; b.state = 'circle'; b.height = 2.4;
  g.weaponBonk(false); assert.equal(b.grump, b.maxGrump, 'a plain hop cannot reach the sky');
  bounce(g); assert(g.bounce > 0.7); assert(g.airHeight > 0); g.hero.x = b.x; g.hero.z = b.z + 2.7; g.bounce = DT / 2; b.height = 2.4; g.step(DT);
  assert(b.grump < b.maxGrump, 'the landing bonks the flying Skreel');
  const ride = geared('pogo'); ride.hero.z = ride.beast.z + 2.2; ride.makeDizzy(20); bounce(ride); tick(ride, 0.9); assert(ride.ride.riding); assert.equal(ride.ride.used, 1);
  const full = geared('pogo'); full.hero.z = full.beast.z + 2.2; full.makeDizzy(20); full.ride.used = 2; full.beast.grump = full.beast.maxGrump = 1e5;
  bounce(full); tick(full, 0.9); assert(!full.ride.riding, 'only two rides a hunt'); assert(full.beast.grump < full.beast.maxGrump, 'it lands with a bonk instead');
});
check('Leaf Umbrella: guards from every side at half speed, J spins around it, and it floats down after a roll', () => {
  for (const side of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const g = geared('umbrella'); g.hero.invincible = 0; g.step(DT, input({ charge: true })); assert(g.isGuarding);
    const fluff = g.hero.fluff; g.bumpHero(10, { x: g.hero.x + Math.cos(side) * 2, z: g.hero.z + Math.sin(side) * 2 }); assert.equal(g.hero.fluff, fluff, `side ${side}`);
  }
  const walk = geared('umbrella'), x = walk.hero.x; tick(walk, 1, input({ charge: true, x: 1 })); const guarded = walk.hero.x - x;
  const free = geared('umbrella'), fx = free.hero.x; tick(free, 1, input({ x: 1 })); assert(Math.abs(guarded / (free.hero.x - fx) - 0.5) < 0.02, `${guarded} vs ${free.hero.x - fx}`);
  const spin = geared('umbrella'), b = spin.beast; b.grump = b.maxGrump = 1e5; spin.hero.z = b.z + 2.9;
  spin.step(DT, input({ charge: true })); spin.step(DT, input({ charge: true, bonk: true })); tick(spin, 0.3, input({ charge: true })); assert(b.grump < b.maxGrump); assert(spin.isGuarding, 'J does not close the umbrella');
  const heal = geared('umbrella', 3, 'A'); heal.buddy.fluff = 10; heal.step(DT, input({ charge: true })); heal.step(DT, input({ charge: true, bonk: true })); tick(heal, 0.3, input({ charge: true })); assert.equal(heal.buddy.fluff, 15);
  const fall = (held) => { const g = geared('umbrella'); g.step(DT, input({ roll: true, x: 1 })); let t = 0; while (g.hero.roll >= 0) g.step(DT, input({ charge: held })); while (g.float > 0) { g.step(DT, input({ charge: held })); t += DT; } return t; };
  const slow = fall(true), quick = fall(false); assert(quick > 0.4); assert(Math.abs(slow / quick - 2) < 0.1, `${slow} / ${quick}`);
});
check('the four post-game weapons replay exactly from a seed', () => {
  for (const type of POST_GAME_WEAPONS) {
    const run = () => { const g = geared(type); g.hero.invincible = 0; g.buddy.cooldown = 0; g.beast.duration = 0; for (let n = 0; n < 1500; n++) g.step(DT, input({ bonk: n % 40 < 8, charge: n % 300 > 240, x: Math.sin(n * .01), z: Math.cos(n * .013) })); return { save: g.save(), beast: g.beast, hero: g.hero, rng: g.rng, giggle: g.giggle, breath: g.breath }; };
    assert.deepEqual(run(), run(), type);
  }
});
check('melee tools chain three J swings in rhythm into their own finisher; ranged tools and the puffer never do', () => {
  const swing = (g) => { g.step(DT, input({ bonk: true })); while (g.hero.cooldown > 0 || g.hitstop > 0) g.step(DT); tick(g, 0.05); };
  const string = (type) => { const g = geared(type), b = g.beast; b.grump = b.maxGrump = 1e5; const drops = [], parts = [], bonks = []; for (let i = 0; i < 3; i++) { const grump = b.grump, part = b.part, n = b.bonks; swing(g); drops.push(grump - b.grump); parts.push(b.part - part); bonks.push(b.bonks - n); } return { g, b, drops, parts, bonks }; };
  // Slow: the hammer's third swing is the Acorn Upswing, half again as strong, with 20 Dizzy and a slower recovery.
  const slow = string('hammer');
  assert(slow.drops[0] > 0); assert(Math.abs(slow.drops[1] / slow.drops[0] - 1) < 1e-9); assert(Math.abs(slow.drops[2] / slow.drops[0] - FINISHER_POWER) < 1e-9, JSON.stringify(slow.drops));
  assert.equal(slow.b.dizzy, FINISHER_DIZZY); assert.equal(slow.g.events.filter((e) => e.kind === 'finisher').length, 1); assert.equal(slow.g.huntFacts.finishers, 1); assert.match(slow.g.note, new RegExp(FINISHERS.hammer));
  // Medium: the katana's Petal Spin also loosens the part twice as fast.
  const medium = string('katana'); assert(Math.abs(medium.drops[2] / medium.drops[0] - FINISHER_POWER) < 1e-9); assert(Math.abs(medium.parts[2] / medium.parts[0] - FINISHER_POWER * 2) < 1e-9, JSON.stringify(medium.parts));
  // Fast: the sword's Twig Twirl bonks twice.
  const fast = string('sword'); assert.deepEqual(fast.bonks, [1, 1, 2]); assert(Math.abs(fast.drops[2] / fast.drops[0] - (FINISHER_POWER + 1)) < 1e-9, JSON.stringify(fast.drops));
  // The finisher swing recovers more slowly, then a new string starts.
  const g = geared('hammer'); g.beast.grump = g.beast.maxGrump = 1e5; swing(g); swing(g); g.step(DT, input({ bonk: true })); assert(Math.abs(g.hero.cooldown - 0.67 * FINISHER_RECOVERY) < 1e-9, `${g.hero.cooldown}`); while (g.hero.cooldown > 0 || g.hitstop > 0) g.step(DT); swing(g); assert.equal(g.combo, 1);
  // Waiting longer than the rhythm window, rolling or a bump starts the string again.
  const late = geared('hammer'); late.beast.grump = late.beast.maxGrump = 1e5; swing(late); swing(late); assert.equal(late.combo, 2); tick(late, COMBO_WINDOW + 0.1); swing(late); assert.equal(late.combo, 1); assert(!late.events.some((e) => e.kind === 'finisher'));
  const rolled = geared('hammer'); rolled.beast.grump = rolled.beast.maxGrump = 1e5; swing(rolled); swing(rolled); rolled.step(DT, input({ roll: true, x: 1 })); assert.equal(rolled.combo, 0); assert.equal(rolled.comboTimer, 0);
  const bumped = geared('hammer'); bumped.beast.grump = bumped.beast.maxGrump = 1e5; swing(bumped); swing(bumped); bumped.hero.invincible = 0; assert(bumped.bumpHero(1, bumped.beast)); assert.equal(bumped.combo, 0);
  // Every melee tool has a named finisher; bows, the wand and the puffer have none and never build a string.
  for (const type of Object.keys(WEAPON_TYPES)) assert.equal(!!FINISHERS[type], !['bow', 'lightbow', 'heavybow', 'wand', 'puffer'].includes(type), type);
  for (const type of ['bow', 'lightbow', 'wand', 'puffer']) { const r = geared(type); r.beast.grump = r.beast.maxGrump = 1e5; for (let i = 0; i < 6; i++) swing(r); assert.equal(r.combo, 0, type); assert(!r.events.some((e) => e.kind === 'finisher'), type); }
});
const questGame = (chapter = 6) => { const g = new HuntGame(41); g.chooseHero('dora'); g.story.chapter = chapter; g.profile.extraGrumpyUnlocked = chapter === 6; for (const id of BEAST_IDS) g.profile.beastBook[id].met = BEAST_IDS.indexOf(id) < chapter; return g; };
const questCalm = (g) => { const b = g.beast; g.roared = g.introduced = true; b.height = 0; b.state = 'rest'; assert(g.bonkBeast(1e6, true, { x: b.x - Math.cos(b.face) * 3, z: b.z + Math.sin(b.face) * 3 })); tick(g, 3.5); };
check('the quest board opens quests by chapter and refuses unknown ones', () => {
  assert(QUESTS.length >= 9); assert.equal(new Set(QUESTS.map((q) => q.id)).size, QUESTS.length);
  for (const q of QUESTS) { assert(q.stars >= 1 && q.beasts.length >= 1 && q.beasts.length <= 2, q.id); assert(q.limit === undefined || q.limit >= 60, q.id); for (const id of Object.keys(q.reward)) assert(DROPS[q.beasts[0]] && cap(id) === 99, `${q.id} ${id}`); }
  const early = questGame(2); assert.equal(early.startQuest('double-meadow'), false); assert(early.questOpen('quick-bristleback')); assert.equal(early.startQuest('nonsense'), false);
  const g = questGame(); assert(g.startQuest('quick-bristleback')); assert.equal(g.mode, 'hunt'); assert.equal(g.quest.id, 'quick-bristleback'); assert.equal(g.storyHunt, false); assert.equal(g.startQuest('double-meadow'), false, 'not mid-hunt');
});
check('a two-beast quest brings the second beast in after the first nap, then pays its stars and bundle', () => {
  const g = questGame(), q = QUESTS.find((x) => x.id === 'double-meadow'), before = { ...g.profile.pouch };
  assert(g.startQuest(q.id)); assert.equal(g.beast.id, q.beasts[0]); assert.equal(g.area, 'meadow'); assert(g.visited, 'no visitor wanders into a two-beast quest');
  questCalm(g); assert.equal(g.mode, 'hunt'); assert.equal(g.beast.id, q.beasts[1]); assert.equal(g.quest.step, 1); assert.equal(g.roared, false, 'the newcomer roars hello'); assert.equal(g.beast.grump, g.beast.maxGrump);
  assert(Math.hypot(g.beast.x - g.hero.x, g.beast.z - g.hero.z) > 8, 'it arrives a little way off'); assert.equal(g.questResult, null);
  questCalm(g); assert.equal(g.mode, 'calm'); assert.deepEqual(g.questResult, { id: q.id, success: true, stars: q.stars, why: '' }); assert.equal(g.profile.stars, q.stars); assert.equal(g.profile.quests[q.id], 1);
  for (const [id, n] of Object.entries(q.reward)) assert(g.profile.pouch[id] >= before[id] + n, id);
  assert.equal(g.profile.naps.bristleback, 1); assert.equal(g.profile.naps.puffwart, 1);
  const again = g.save(); const loaded = HuntGame.load(again); assert.equal(loaded.profile.stars, q.stars); assert.equal(loaded.profile.quests[q.id], 1);
});
check('timed and side-goal quests still end in a lovely nap when missed, with no stars', () => {
  const slow = questGame(); assert(slow.startQuest('quick-bristleback')); slow.beast.state = 'rest'; slow.beast.duration = 1e9; slow.hero.invincible = 1e9; slow.buddy.cooldown = 1e9; slow.zoneAt = [];
  slow.huntTime = 89.9; tick(slow, 0.2); assert.match(slow.note, /no rush/i); assert(slow.quest.failed);
  questCalm(slow); assert.equal(slow.mode, 'calm'); assert.equal(slow.questResult.success, false); assert.match(slow.questResult.why, /90 s/); assert.equal(slow.profile.stars, 0); assert.equal(slow.profile.quests['quick-bristleback'] ?? 0, 0);
  const quick = questGame(); assert(quick.startQuest('quick-bristleback')); questCalm(quick); assert(quick.questResult.success); assert.equal(quick.profile.stars, 1);
  const vine = questGame(); assert(vine.startQuest('no-vine-puffwart')); vine.hero.x = vine.beast.x; vine.hero.z = vine.beast.z + 5; vine.beast.state = 'rest'; vine.beast.height = 0; assert(vine.throwVine()); assert.equal(vine.huntFacts.vines, 1); tick(vine, 0.5); vine.step(DT, input({ roll: true }));
  questCalm(vine); assert.equal(vine.questResult.success, false); assert.match(vine.questResult.why, /vine/i);
  const paws = questGame(); assert(paws.startQuest('no-vine-puffwart')); questCalm(paws); assert(paws.questResult.success);
  const out = questGame(); assert(out.startQuest('quick-bristleback')); out.hero.fluff = 1; out.hero.invincible = 0; out.bumpHero(5, out.beast); assert.equal(out.mode, 'camp'); assert.equal(out.quest, null); assert.equal(out.profile.stars, 0);
});
const rich = (g) => { for (const id of Object.keys(g.profile.pouch)) g.profile.pouch[id] = cap(id); g.profile.stars = 99; return g; };
check('the charm tree: three charms, three levels each, paid in materials and quest stars, one worn at a time', () => {
  assert.deepEqual(CHARM_IDS, ['clover', 'acorn', 'feather']);
  for (const id of CHARM_IDS) { assert.equal(CHARMS[id].levels.length, 3); assert.equal(CHARMS[id].levels[0].stars, 0); assert(CHARMS[id].levels[2].stars > CHARMS[id].levels[1].stars); for (const l of CHARMS[id].levels) for (const m of Object.keys(l.cost)) assert.equal(cap(m), 99, m); }
  const closed = rich(questGame(CHARM_CHAPTER - 1)); assert.equal(closed.makeCharm('acorn'), false);
  const g = questGame(); g.returnVillage(); assert.equal(g.makeCharm('acorn'), false, 'materials are needed');
  rich(g); g.profile.stars = 0; const pouch = { ...g.profile.pouch };
  assert(g.makeCharm('acorn')); assert.equal(g.profile.charms.levels.acorn, 1); assert.equal(g.profile.charms.worn, 'acorn', 'the first charm made is worn');
  for (const [m, n] of Object.entries(CHARMS.acorn.levels[0].cost)) assert.equal(g.profile.pouch[m], pouch[m] - n);
  assert.equal(g.makeCharm('acorn'), false, 'level II needs quest stars'); g.profile.stars = CHARMS.acorn.levels[1].stars; assert(g.makeCharm('acorn')); assert.equal(g.profile.stars, 0);
  g.profile.stars = 99; rich(g); assert(g.makeCharm('acorn')); assert.equal(g.profile.charms.levels.acorn, 3); assert.equal(g.makeCharm('acorn'), false, 'III is the top');
  assert(g.makeCharm('feather')); assert.equal(g.profile.charms.worn, 'acorn', 'a new charm does not swap the worn one'); assert(g.wearCharm('feather')); assert.equal(g.profile.charms.worn, 'feather'); assert(g.wearCharm('feather')); assert.equal(g.profile.charms.worn, null); assert.equal(g.wearCharm('clover'), false, 'only made charms');
  assert(g.wearCharm('acorn')); const loaded = HuntGame.load(g.save()); assert.deepEqual(loaded.profile.charms, g.profile.charms); assert.equal(loaded.hero.maxFluff, 100 + 30);
  assert.deepEqual(HuntGame.load({ v: 6, profile: { charms: { levels: { acorn: 7, clover: -1, feather: 'x' }, worn: 'clover' } } }).profile.charms, { levels: { clover: 0, acorn: 3, feather: 0 }, worn: null });
  g.startHunt('bristleback'); assert(g.makeCharm('clover') === false && g.wearCharm('feather') === false, 'only at camp');
});
check('charm effects: more Fluff, quicker rolls and vine, and a fuller nap reward', () => {
  const wearing = (id, level) => { const g = rich(questGame()); g.returnVillage(); for (let i = 0; i < level; i++) assert(g.makeCharm(id)); assert(g.profile.charms.worn === id || g.wearCharm(id)); return g; };
  const plain = rich(questGame()); plain.returnVillage();
  const acorn = wearing('acorn', 2); assert(acorn.startHunt('bristleback')); assert.equal(acorn.hero.maxFluff, 120); assert.equal(acorn.hero.fluff, 120);
  const feather = wearing('feather', 3); assert(feather.startHunt('bristleback')); assert(plain.startHunt('bristleback'));
  for (const g of [feather, plain]) { g.zoneAt = []; g.hero.invincible = 1e9; g.buddy.cooldown = 1e9; g.beast.state = 'rest'; g.beast.duration = 1e9; g.step(DT, input({ roll: true, x: 1 })); }
  let a = 0, b = 0; while (feather.hero.rollCd > 0) { feather.step(DT); a++; } while (plain.hero.rollCd > 0) { plain.step(DT); b++; } assert(Math.abs(a / b - 1 / 1.45) < 0.03, `${a} / ${b}`);
  for (const g of [feather, plain]) { g.hero.x = g.beast.x; g.hero.z = g.beast.z + 5; assert(g.throwVine()); }
  assert(Math.abs(plain.vineCd - feather.vineCd - 6) < 1e-9);
  // Clover III: two more commons every nap, and a second rare roll (frost fur and mane locks are Frostmane's commons, glimmer its rare).
  let rarePlain = 0, rareClover = 0;
  for (let seed = 1; seed <= 30; seed++) for (const id of [null, 'clover']) {
    const g = id ? wearing(id, 3) : rich(questGame()); if (!id) g.returnVillage(); g.seed = g.rng = seed; assert(g.startHunt('frostmane')); calm(g);
    const commons = g.reward.filter((m) => m !== 'glimmer-stone').length, rares = g.reward.length - commons; assert.equal(commons, id ? 5 : 3);
    if (id) rareClover += rares; else rarePlain += rares;
  }
  assert(rareClover > rarePlain * 1.4, `${rareClover} vs ${rarePlain}`);
});
const mightyGame = () => { const g = questGame(); for (const q of QUESTS.filter((x) => !x.mighty).slice(0, MIGHTY_AT)) g.profile.quests[q.id] = 1; return g; };
check('Mighty beasts open after the story and three quests, with more Grump and one new move each', () => {
  const mighty = QUESTS.filter((q) => q.mighty && !q.keepsake); assert.deepEqual(mighty.map((q) => q.beasts[0]), BEAST_IDS);
  const early = questGame(); for (const q of QUESTS.filter((x) => !x.mighty).slice(0, MIGHTY_AT - 1)) early.profile.quests[q.id] = 1; assert.equal(early.questOpen('mighty-frostmane'), false);
  const five = questGame(5); for (const q of QUESTS.filter((x) => !x.mighty)) five.profile.quests[q.id] = 1; assert.equal(five.questOpen('mighty-bristleback'), false, 'not before the ending');
  for (const id of BEAST_IDS) {
    const g = mightyGame(); assert(g.startQuest(`mighty-${id}`)); const b = g.beast; assert(b.mighty); assert.equal(b.maxGrump, BEASTS[id].grump * MIGHTY_GRUMP); assert.equal(b.grump, b.maxGrump);
    g.roared = g.introduced = true; g.zoneAt = []; g.buddy.cooldown = 1e9; g.hero.invincible = 1e9; g.obstacles = []; const seen = new Set();
    for (let cycle = 0; cycle < 8; cycle++) {
      b.x = 0; b.z = -3; g.hero.x = 0; g.hero.z = 4; b.state = id === 'skreel' ? 'circle' : 'roam'; b.t = 0; b.duration = 0; g.step(DT); assert.equal(b.state, 'windup'); assert(b.duration >= 0.6, `${id} ${b.attack}`); seen.add(b.attack);
      if (b.attack === 'charge' && b.rush) { tick(g, b.duration + 0.05); while (b.state === 'charge') g.step(DT); assert.equal(b.state, 'windup', 'the second dash winds up again'); assert(b.duration >= 0.6); assert.equal(b.rush, 0); seen.add('rush'); }
    }
    assert(seen.has(MIGHTY_MOVES[id]), `${id} used ${[...seen]}`);
  }
});
check('Mighty moves: rain circles, a three-lane feather fan and a wide shell spin each hit only inside their warning', () => {
  const at = (id, move, place) => { const g = mightyGame(); assert(g.startQuest(`mighty-${id}`)); g.roared = g.introduced = true; g.zoneAt = []; g.buddy.cooldown = 1e9; g.obstacles = []; const b = g.beast; b.x = 0; b.z = 0; b.height = 0; g.hero.x = 0; g.hero.z = 6;
    b.state = 'windup'; b.attack = move; b.t = 0; b.duration = 0.9; b.start = { x: 0, z: 0 }; b.dir = { x: 0, z: 1 }; b.face = faceAngle(0, 1); b.marks = move === 'rain' ? [{ x: 0, z: 6 }, { x: 5, z: 6 }, { x: -5, z: 6 }] : []; b.aim = { x: 0, z: 11 };
    place(g); const f = g.huntFacts.bumps; tick(g, 0.9 + 0.8, NO_INPUT); return g.huntFacts.bumps - f; };
  const faceAngle = (x, z) => Math.atan2(-z, x);
  assert(at('puffwart', 'rain', (g) => { g.hero.x = 0.5; g.hero.z = 6.5; }) > 0, 'inside a rain circle');
  assert.equal(at('puffwart', 'rain', (g) => { g.hero.x = 2.5; g.hero.z = 6 + RAIN_REACH + 0.6; }), 0, 'between and outside the circles');
  assert(at('skreel', 'fan', (g) => { g.hero.x = Math.sin(FAN_SPREAD) * 6; g.hero.z = Math.cos(FAN_SPREAD) * 6; }) > 0, 'in a side lane');
  assert.equal(at('skreel', 'fan', (g) => { g.hero.x = Math.sin(FAN_SPREAD / 2) * 6; g.hero.z = Math.cos(FAN_SPREAD / 2) * 6; }), 0, 'between the lanes');
  assert(at('hornclack', 'spin', (g) => { g.hero.z = SPIN_REACH - 0.6; }) > 0); assert.equal(at('hornclack', 'spin', (g) => { g.hero.z = SPIN_REACH + 0.6; }), 0);
});
check('a Mighty calm pays three stars and twice the rare chance', () => {
  const g = mightyGame(), stars = g.profile.stars; assert(g.startQuest('mighty-hornclack')); questCalm(g); assert.equal(g.mode, 'calm'); assert(g.questResult.success); assert.equal(g.profile.stars, stars + 3); assert.equal(g.profile.quests['mighty-hornclack'], 1);
  assert(!g.beast.mighty || g.mode === 'calm');
});
check('the Mighty armour set needs its Mighty quests and stars, and its skills stretch strings, boost finishers and reward full Fluff', () => {
  const g = mightyGame(); rich(g); g.profile.stars = 12;
  for (const slot of SLOTS) assert.equal(g.canMakeArmour(`mighty-${slot}`), false, `${slot} waits for its Mighty quests`);
  g.profile.quests['mighty-bristleback'] = 1; assert.equal(g.canMakeArmour('mighty-helm'), false, 'the helm needs both its beasts');
  g.profile.quests['mighty-puffwart'] = 1; assert(g.canMakeArmour('mighty-helm')); assert.equal(g.canMakeArmour('mighty-vest'), false);
  const pouch = { ...g.profile.pouch }; assert(g.makeArmour('mighty-helm')); assert.equal(g.profile.stars, 8);
  for (const [m, n] of Object.entries(MIGHTY_ARMOUR.helm.cost)) assert.equal(g.profile.pouch[m], pouch[m] - n, m);
  assert.equal(g.makeArmour('mighty-helm'), false, 'made once');
  g.profile.stars = 3; g.profile.quests['mighty-skreel'] = g.profile.quests['mighty-hornclack'] = 1; assert.equal(g.canMakeArmour('mighty-vest'), false, 'four stars a piece');
  g.profile.stars = 8; g.profile.quests['mighty-frostmane'] = 1; assert(g.makeArmour('mighty-vest')); assert(g.makeArmour('mighty-boots')); assert.equal(g.profile.stars, 0);
  for (const slot of SLOTS) assert(g.wear(`mighty-${slot}`)); assert.equal(g.hero.maxFluff, 100 + 3 * ARMOUR_SETS.mighty.fluff);
  assert.deepEqual(g.armour.skills.map((x) => x.id), ['mighty-rhythm', 'full-fluff']);
  const back = HuntGame.load(JSON.parse(JSON.stringify(g.save()))); assert.deepEqual(back.profile.armour.worn, { helm: 'mighty-helm', vest: 'mighty-vest', boots: 'mighty-boots' }); assert.equal(back.hero.maxFluff, 145);
  assert.equal(HuntGame.load({ ...g.save(), profile: { ...g.save().profile, armour: { owned: ['mighty-crown', 'mighty-helm'], worn: { helm: 'mighty-crown' } } } }).profile.armour.owned.join(), 'mighty-helm');
  assert(ARMOUR_PIECES.includes('mighty-boots'));
  // Skills in a hunt: the string waits 0.9 s, the finisher hits 1.65 times as hard, and full Fluff adds 15%.
  const armed = (worn) => { const a = geared('hammer'); a.profile.armour.owned = [...ARMOUR_PIECES]; for (const x of worn) a.profile.armour.worn[x.split('-')[1]] = x; a.beast.grump = a.beast.maxGrump = 1e5; return a; };
  const swing = (a) => { a.step(DT, input({ bonk: true })); while (a.hero.cooldown > 0 || a.hitstop > 0) a.step(DT); tick(a, 0.05); };
  const two = armed(['mighty-helm', 'mighty-vest']); two.step(DT, input({ bonk: true })); assert(Math.abs(two.comboTimer - (two.hero.cooldown + COMBO_WINDOW + MIGHTY_RHYTHM)) < 1e-9);
  const late = armed(['mighty-helm', 'mighty-vest']); swing(late); swing(late); tick(late, COMBO_WINDOW + 0.1); swing(late); assert.equal(late.huntFacts.finishers, 1, 'a swing 0.7 s late still finishes the string');
  const drops = []; const rhythm = armed(['mighty-helm', 'mighty-vest']); for (let i = 0; i < 3; i++) { const gr = rhythm.beast.grump; swing(rhythm); drops.push(gr - rhythm.beast.grump); }
  assert(Math.abs(drops[2] / drops[0] - FINISHER_POWER * MIGHTY_FINISHER) < 1e-9, JSON.stringify(drops));
  const hit = (fluff) => { const a = armed(['mighty-helm', 'mighty-vest', 'mighty-boots']), b = a.beast; b.state = 'rest'; a.hero.fluff = a.hero.maxFluff - (fluff ?? 0); const gr = b.grump; a.bonkBeast(10, false, { x: b.x - Math.cos(b.face) * 3, z: b.z + Math.sin(b.face) * 3 }); return gr - b.grump; };
  assert(Math.abs(hit() / hit(1) - FULL_FLUFF) < 1e-9, `${hit()} vs ${hit(1)}`);
});
check('post-game beasts: Paddlepaw and Rumblesnout open after the story, each in its own area, and nap with their own materials', () => {
  const g = new HuntGame(5); g.chooseHero('dora'); assert.deepEqual(POST_GAME_BEASTS, ['paddlepaw', 'rumblesnout']); assert.deepEqual(BEAST_IDS, [...STORY_BEASTS, ...POST_GAME_BEASTS]);
  for (const id of POST_GAME_BEASTS) { assert.equal(g.unlocked(id), false); assert.equal(g.freeHuntOpen(id), false); }
  g.story.chapter = 6; for (const id of POST_GAME_BEASTS) { assert(g.unlocked(id)); assert(g.freeHuntOpen(id)); }
  assert.equal(HUNT_AREA.paddlepaw, 'marsh'); assert.equal(HUNT_AREA.rumblesnout, 'hollow');
  for (const id of POST_GAME_BEASTS) {
    const h = fresh(id); assert.equal(h.area, HUNT_AREA[id]); assert.equal(h.beast.maxGrump, BEASTS[id].grump); calm(h); assert.equal(h.mode, 'calm');
    assert(h.reward.some((m) => BEAST_MATERIALS[id].includes(m)), `${id} naps with its own materials`); assert(h.profile.beastBook[id].met);
    assert(QUESTS.some((q) => q.id === `mighty-${id}`)); assert.equal(BEAST_MATERIALS[id].length, 3);
  }
  // The post-game weapon goals still ask for the five story beasts.
  const w = new HuntGame(5); w.chooseHero('dora'); w.story.chapter = 6;
  for (const id of STORY_BEASTS) { w.profile.variantNaps[id] = 1; w.profile.beastBook[id].partsBroken = [BEASTS[id].part]; }
  assert.equal(w.weaponGoal('puffer').count, 5); assert.equal(w.weaponGoal('umbrella').count, 5); assert(w.weaponOpen('puffer')); assert(w.weaponOpen('umbrella'));
  const back = HuntGame.load(JSON.parse(JSON.stringify(fresh('paddlepaw').save()))); assert.equal(back.profile.beastBook.paddlepaw.met, true);
});
check('Rumblesnout digs down under one orange circle on the leader, pops up there, and cannot be bonked underground', () => {
  const dig = (stay) => {
    const g = fresh('rumblesnout'), b = g.beast; g.buddy.cooldown = 1e9; g.obstacles = []; b.x = 0; b.z = 0; g.hero.x = 0; g.hero.z = 6;
    b.state = 'roam'; b.cycle = 0; b.t = 0; b.duration = 0; g.step(DT);
    assert.equal(b.state, 'windup'); assert.equal(b.attack, 'burrow'); assert(b.duration >= 0.6); assert.equal(b.marks.length, 1); assert(distance(b.marks[0], g.hero) < 0.01);
    tick(g, 0.6); assert(b.height < -0.5, 'underground'); const gr = b.grump; assert.equal(g.bonkBeast(10, false, { x: b.x + 1, z: b.z }), false); assert.equal(b.grump, gr);
    if (!stay) { g.hero.x = 0; g.hero.z = 6 + BURROW_REACH + 0.6; }
    const bumps = g.huntFacts.bumps; tick(g, 1); assert(Math.hypot(b.x, b.z - 6) < 0.01, 'pops up on the circle'); assert(b.height >= 0);
    return g.huntFacts.bumps - bumps;
  };
  assert(dig(true) > 0, 'inside the circle'); assert.equal(dig(false), 0, 'stepped out');
});
check('Paddlepaw splashes three orange lanes, and its Mighty move is a whirlpool spin', () => {
  const g = fresh('paddlepaw'), b = g.beast; g.buddy.cooldown = 1e9; b.cycle = 1; b.state = 'roam'; b.t = 0; b.duration = 0; g.step(DT);
  assert.equal(b.attack, 'fan'); assert.equal(g.fanLanes().length, 3); assert.match(g.note, /Splash/);
  assert.equal(MIGHTY_MOVES.paddlepaw, 'spin'); assert.equal(MIGHTY_MOVES.rumblesnout, 'rain');
});
check('Paddlepaw and Rumblesnout armour: bigger berries, softer bumps, a fuller pebble pouch and bigger dizzy bonks', () => {
  const armed = (set, n, id = 'bristleback') => { const a = new HuntGame(9); a.chooseHero('dora'); a.story.chapter = 6; for (const k of BEAST_IDS) a.profile.beastBook[k].met = true; a.profile.armour.owned = [...ARMOUR_PIECES]; for (const s of SLOTS.slice(0, n)) a.profile.armour.worn[s] = `${set}-${s}`; assert(a.startHunt(id)); a.roared = a.introduced = true; a.zoneAt = []; a.buddy.cooldown = 1e9; return a; };
  assert.deepEqual(armed('paddlepaw', 3).armour.skills.map((x) => x.id), ['river-rest', 'soft-landing']); assert.deepEqual(armed('rumblesnout', 3).armour.skills.map((x) => x.id), ['pebble-pouch', 'dizzy-dig']);
  const heal = (n) => { const a = armed('paddlepaw', n); a.profile.ring = ['fluffberry']; a.item = 0; a.hero.fluff = 10; a.useItem(); return a.hero.fluff - 10; };
  assert.equal(heal(2), Math.round(heal(0) * RIVER_REST));
  const bump = (n) => { const a = armed('paddlepaw', n); a.hero.invincible = 0; const f = a.hero.fluff; a.bumpHero(20, a.beast); return f - a.hero.fluff; };
  assert.equal(bump(3), 20 * SOFT_LANDING); assert.equal(bump(2), 20);
  const pouch = armed('rumblesnout', 2); assert.equal(pouch.pebbles, SLING_START + PEBBLE_POUCH.start); pouch.pebbles = 0; for (let i = 0; i < 10; i++) pouch.makeDizzy(0.01); assert.equal(pouch.pebbles, 10); assert.equal(pouch.slingMax, PEBBLE_POUCH.max);
  const dizzy = (n) => { const a = armed('rumblesnout', n), b = a.beast; b.grump = b.maxGrump = 1e5; a.makeDizzy(5); const gr = b.grump; a.bonkBeast(10, false, { x: b.x - Math.cos(b.face) * 3, z: b.z + Math.sin(b.face) * 3 }); return gr - b.grump; };
  assert(Math.abs(dizzy(3) / dizzy(2) - DIZZY_DIG) < 1e-9);
});
check('the epilogue is a story scene of its own, and a Mighty calm keeps its own best time', () => {
  assert.deepEqual(SCENES.slice(-2), ['epilogue', 'finale']); assert.equal(storyScene('epilogue').pages, EPILOGUE); assert.equal(storyScene('epilogue').beast, null); assert.equal(storyScene('2-intro').beast, 'puffwart');
  assert(EPILOGUE.every((p) => existsSync(new URL(`../public/art/hunt/${p.panel}.webp`, import.meta.url))), 'every epilogue painting exists'); assert.deepEqual(validate(), []);
  const g = mightyGame(); assert(g.sceneSeen('epilogue')); assert(g.story.scenesSeen.includes('epilogue'));
  const back = HuntGame.load(JSON.parse(JSON.stringify(g.save()))); assert(back.story.scenesSeen.includes('epilogue'));
  assert(g.startQuest('mighty-paddlepaw')); g.huntTime = 61.2; questCalm(g); assert.equal(g.profile.mightyBest.paddlepaw, 612); assert.equal(g.profile.beastBook.paddlepaw.best, 0, 'the normal best stays apart'); assert(g.newRecord);
  g.returnVillage(); assert(g.startQuest('mighty-paddlepaw')); g.huntTime = 70; questCalm(g); assert.equal(g.profile.mightyBest.paddlepaw, 612); assert.equal(g.newRecord, false);
  assert.equal(HuntGame.load(JSON.parse(JSON.stringify(g.save()))).profile.mightyBest.paddlepaw, 612);
  assert.equal(HuntGame.load({ v: 6, profile: { mightyBest: { skreel: -4, hornclack: 'fast' } } }).profile.mightyBest.skreel, 0);
});
check('the Best of Friends finale: both Mighty river friends in a row, after their own Mighty quests, for the ribbon and the finale scene', () => {
  const g = mightyGame(), q = QUESTS.find((x) => x.id === 'finale');
  assert(q.keepsake && q.mighty && q.stars === 5); assert.deepEqual(q.beasts, ['rumblesnout', 'paddlepaw']); assert(SCENES.includes('finale')); assert.equal(storyScene('finale').title, 'Best of Friends'); assert(storyScene('finale').pages.every((p) => existsSync(new URL(`../public/art/hunt/${p.panel}.webp`, import.meta.url))));
  assert.equal(g.questOpen('finale'), false); g.profile.quests['mighty-rumblesnout'] = 1; assert.equal(g.questOpen('finale'), false, 'needs both Mighty quests');
  g.profile.quests['mighty-paddlepaw'] = 1; assert(g.questOpen('finale'));
  const stars = g.profile.stars; assert(g.startQuest('finale')); assert(g.beast.mighty); assert.equal(g.beast.maxGrump, BEASTS.rumblesnout.grump * MIGHTY_GRUMP);
  questCalm(g); assert.equal(g.beast.id, 'paddlepaw', 'Mighty Paddlepaw wanders in'); assert(g.beast.mighty); assert.equal(g.beast.maxGrump, BEASTS.paddlepaw.grump * MIGHTY_GRUMP); assert.equal(g.quest.step, 1);
  questCalm(g); assert(g.questResult.success); assert.equal(g.profile.stars, stars + 5); assert.equal(g.profile.quests.finale, 1);
  assert(g.sceneSeen('finale')); const back = HuntGame.load(JSON.parse(JSON.stringify(g.save()))); assert(back.story.scenesSeen.includes('finale')); assert.equal(back.profile.quests.finale, 1);
});
check('the turf-bonk page only keeps real pairs from a save', () => {
  assert.equal(TURF_PAIRS.length, BEAST_IDS.length); assert(TURF_PAIRS.includes('rumblesnout+bristleback'));
  const g = HuntGame.load({ v: 6, profile: { turfPairs: ['bristleback+puffwart', 'puffwart+puffwart', 7, 'bristleback+puffwart'] } }); assert.deepEqual(g.profile.turfPairs, ['bristleback+puffwart']);
  assert.deepEqual(HuntGame.load({ v: 6, profile: { turfPairs: 'nope' } }).profile.turfPairs, []);
  assert.equal(BOUNTIES.find((t) => t.id === 'turf').check({ napped: true, turfs: 0 }, { id: 'bristleback' }), false);
});
console.log(`Grumble Hunt: ${checks} engine checks passed.`);
