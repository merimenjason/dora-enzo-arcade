import assert from 'node:assert/strict';
import { HuntGame, BEAST_IDS, BEASTS, DT, TELEGRAPH, NO_INPUT, GRUMPY_AT, GRUMPY_PACE, AREA_WEATHER, WEATHER_SIGHT, WEATHER_RAMP, ROAR_REACH, ROAR_TIME, TIRED_AT, SNOOZE, ARENA_RADIUS, SIGHT, CAMP_BERRIES, DIZZY_FULL, GATHER_TIME, HUNT_AREA, RING_ITEMS, RING_SIZE, SNACK_IDS, distance, SCENES, AREA_OBSTACLES, VARIANT_COLORS, VILLAGERS, SPOTS, BOUNTIES, dailyBounties } from '../.checks/grumble-hunt-game.js';
import { DROPS, GATHER, ITEMS, SNACKS, WEAPON_TREE, WEAPON_TYPES, POST_GAME_WEAPONS, cap, armourBonus, armourCost, SLOTS, STORY, rollCalm } from '../.checks/grumble-hunt-content.js';
let checks = 0;
function check(name, fn) { fn(); checks++; console.log(`PASS hunt: ${name}`); }
const input = (overrides = {}) => ({ ...NO_INPUT, ...overrides });
const fresh = (id = 'bristleback', hero = 'dora', seed = 39) => { const g = new HuntGame(seed); g.chooseHero(hero); g.story.chapter = 6; g.profile.extraGrumpyUnlocked = true; for (const k of BEAST_IDS) g.profile.beastBook[k].met = true; assert(g.startHunt(id)); g.roared = g.introduced = true; return g; }; // Checks start after the hello roar; the roar has its own check.
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
  const before = b.grump; g.bonkBeast(10, false, g.hero); assert(Math.abs(before - b.grump - 17) < 1e-8);
});
check('holding and releasing K fires a charged seed shot; cancelled input does not fire', () => {
  const g = fresh('bristleback', 'enzo'); g.buddy.cooldown = 10000;
  tick(g, 0.6, input({ charge: true })); assert.equal(g.shots.length, 0); g.step(DT); tick(g, 0.13); assert(g.shots.some((s) => s.heavy));
  const c = fresh('bristleback', 'enzo'); tick(c, 0.5, input({ charge: true })); c.clearInput(); tick(c, 0.2); assert.equal(c.shots.length, 0);
});
check('Hornclack front armour depends on direction, and an owl must land for a hammer', () => {
  const g = fresh('hornclack'), b = g.beast; b.face = 0;
  assert.equal(g.bonkBeast(10, false, { x: b.x + 5, z: b.z }), false); assert.equal(b.grump, b.maxGrump);
  assert(g.bonkBeast(10, false, { x: b.x, z: b.z + 4 })); assert.equal(b.grump, b.maxGrump - 10);
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
  assert.equal(g.node('hammer').id, 'hammer-3A'); assert.equal(g.node('bow').id, 'bow-2'); assert.equal(g.save().v, 5);
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
  assert.equal(g.materialTotal, 17); const save = g.save(); assert.equal(save.v, 5);
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
  const quick = geared('bow'); special(quick, 0.6); assert.equal(quick.beast.maxGrump - quick.beast.grump, 20); assert.equal(quick.beast.dizzy, 50);
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
check('each area uses its obstacle table and the seeded meadow is unchanged', () => {
  for (const c of STORY) {
    const g = new HuntGame(39); g.chooseHero('dora'); g.story.chapter = c.id; assert(g.startChapter());
    if (c.area !== 'meadow') assert.deepEqual(g.obstacles, AREA_OBSTACLES[c.area]);
    else {
      assert.equal(g.obstacles.length, 30);
      assert.deepEqual(g.obstacles.slice(-4), [{ x: -9, z: 1, r: 0.8, kind: 'tree' }, { x: 9, z: -3, r: 0.9, kind: 'tree' }, { x: -6, z: -9, r: 1.3, kind: 'rock' }, { x: 7, z: 8, r: 1.1, kind: 'rock' }]);
      const original = new HuntGame(39); original.makeMeadow(); assert.deepEqual(g.obstacles, original.obstacles);
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
    g.bonkBeast(g.beast.maxGrump * 0.72, false, { x: 0, z: -7 }); assert(g.beast.grumpy); g.hitstop = 0; g.beast.state = 'roam'; g.beast.duration = 0; g.step(DT); assert(g.beast.duration >= 0.6);
  }
});
check('daily picks are deterministic, distinct and do not change hunt randomness', () => {
  const ids = (day) => dailyBounties(day).map((t) => t.id);
  assert.deepEqual(ids('2026-10-24'), ids('2026-10-24')); assert.equal(new Set(ids('2026-10-24')).size, 3);
  assert.notDeepEqual(ids('2026-10-24'), ids('2026-10-25'));
  const g = fresh(); const rng = g.rng; assert(g.setBountyDay('2026-10-24')); void g.dailyBounties; assert.equal(g.rng, rng); assert(!g.setBountyDay('today')); assert(!g.setBountyDay('2026-02-30')); assert(g.setBountyDay('2028-02-29'));
});
check('every bounty checks its own task and rejects incomplete hunts', () => {
  const no = { items: 1, bumps: 1, gathered: 0, dizzies: 0, napped: false };
  for (const task of BOUNTIES) {
    const b = { id: 'bristleback', broken: false }; assert(!task.check(no, b), task.id);
    const yes = { items: 0, bumps: 0, gathered: 3, dizzies: 3, napped: true };
    const part = { tusks: 'bristleback', sac: 'puffwart', crest: 'skreel', horn: 'hornclack', mane: 'frostmane' }[task.id];
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
    const g = HuntGame.load({ v, profile }); assert.equal(g.save().v, 5); assert.equal(g.chapter, 4);
    assert.deepEqual(g.story.scenesSeen, SCENES.filter((id) => Number(id[0]) <= 3)); assert(g.profile.beastBook.skreel.met); assert.equal(g.profile.beastBook.skreel.napped, 2);
    if (v === 3) { assert.equal(g.profile.weapons.yoyo.tier, 3); assert.equal(g.profile.equipped.dora, 'yoyo'); assert.equal(g.profile.armour.worn.helm, 'bristleback-helm'); }
    else assert.equal(g.profile.weapons.hammer.tier, 3);
    if (v !== 1) assert.equal(g.profile.pouch.berry, 7);
    const complete = HuntGame.load({ v, profile: { ...profile, naps: Object.fromEntries(BEAST_IDS.map((id) => [id, 1])) } }); assert.equal(complete.chapter, 6); assert(complete.profile.extraGrumpyUnlocked); assert.deepEqual(complete.story.scenesSeen, SCENES);
  }
  const gap = HuntGame.load({ v: 3, profile: { naps: { puffwart: 1 } } }); assert.equal(gap.chapter, 1); assert(gap.story.scenesSeen.includes('2-outro')); gap.chooseHero('dora'); gap.startChapter(); calm(gap); assert.equal(gap.chapter, 3, 'already cleared chapters beyond an old-save gap stay cleared');
});
check('v4 rejects malformed story, book and daily progress', () => {
  const g = HuntGame.load({ v: 4, profile: { story: { chapter: '6', scenesSeen: ['nonsense', 2] }, beastBook: { bristleback: { met: 'yes', napped: -4, partsBroken: ['nonsense'] } }, bounties: { day: 'not-a-date', done: ['nap'] }, extraGrumpyUnlocked: 'yes' } });
  assert.equal(g.chapter, 0); assert.deepEqual(g.story.scenesSeen, []); assert.deepEqual(g.profile.beastBook.bristleback, { met: false, napped: 0, partsBroken: [] }); assert(!g.profile.extraGrumpyUnlocked); assert.equal(g.profile.bounties.day, '');
});
check('a v4 save moves into v5 with the counters it can prove, and v5 counters load strictly', () => {
  const g = fresh(); g.setBountyDay('2026-10-24'); g.profile.bounties.done = [g.dailyBounties[0].id]; g.profile.beastBook.skreel.partsBroken = ['crest'];
  const v4 = JSON.parse(JSON.stringify(g.save())); v4.v = 4; delete v4.profile.bountiesClaimed; delete v4.profile.variantNaps; delete v4.profile.totalPlops;
  const moved = HuntGame.load(v4); assert.equal(moved.save().v, 5); assert.equal(moved.profile.bountiesClaimed, 1); assert.equal(moved.profile.totalPlops, 0);
  assert.deepEqual(moved.profile.variantNaps, { bristleback: 0, puffwart: 0, skreel: 0, hornclack: 0, frostmane: 0 }); assert.deepEqual(moved.profile.beastBook.skreel.partsBroken, ['crest']);
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
console.log(`Grumble Hunt: ${checks} engine checks passed.`);
