import assert from 'node:assert/strict';
import { HuntGame, BEAST_IDS, BEASTS, DT, TELEGRAPH, NO_INPUT, GRUMPY_AT, GRUMPY_PACE, SIGHT, distance } from '../.checks/grumble-hunt-game.js';
let checks = 0;
function check(name, fn) { fn(); checks++; console.log(`PASS hunt: ${name}`); }
const input = (overrides = {}) => ({ ...NO_INPUT, ...overrides });
const fresh = (id = 'bristleback', hero = 'dora', seed = 39) => { const g = new HuntGame(seed); g.chooseHero(hero); if (BEAST_IDS.indexOf(id) >= 3) for (const k of BEAST_IDS.slice(0, 3)) g.profile.naps[k] = 1; assert(g.startHunt(id)); return g; };
const tick = (g, seconds, i = NO_INPUT) => { for (let n = 0; n < Math.ceil(seconds / DT); n++) g.step(DT, i); };
const calm = (g) => { const b = g.beast; b.height = 0; b.state = 'rest'; assert(g.bonkBeast(10000, true, { x: b.x - Math.cos(b.face) * 3, z: b.z + Math.sin(b.face) * 3 })); tick(g, 3.5); };

check('selection, gates and refused actions leave the record alone', () => {
  const g = new HuntGame(1); assert.equal(g.startHunt('bristleback'), false); assert(g.chooseHero('dora'));
  const before = g.save(); assert.equal(g.startHunt('frostmane'), false); assert.equal(g.upgrade('dora'), false); assert.deepEqual(g.save(), before);
  assert.deepEqual(BEAST_IDS.filter((id) => g.unlocked(id)), BEAST_IDS.slice(0, 3));
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
  b.state = 'rest'; b.dizzy = 0; g.bonkBeast(1, true, g.hero); g.bonkBeast(1, true, g.hero); assert.equal(b.state, 'dizzy');
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
  const g = fresh('puffwart'); assert.equal(g.useItem(), false); assert.equal(g.items[0], 3);
  g.hero.fluff = 60; assert(g.useItem()); assert.equal(g.hero.fluff, 95); assert.equal(g.items[0], 2);
  g.item = 1; assert.equal(g.useItem(), false); g.hero.z = g.beast.z + 4; assert(g.useItem()); assert.equal(g.beast.state, 'dizzy');
  g.item = 2; assert(g.useItem()); assert.equal(g.hero.pep, 10);
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
check('Frostmane changes mood as Grump crosses thresholds, before the next wind-up', () => {
  const g = fresh('frostmane'), b = g.beast;
  g.bonkBeast(300, false, g.hero); assert.equal(b.phase, 2);
  g.bonkBeast(300, false, g.hero); assert.equal(b.phase, 3); assert(b.grump > 0);
});
check('bonks shed materials; a part pops once; calming banks all drops and rewards once', () => {
  const g = fresh(), b = g.beast;
  for (let i = 0; i < 14; i++) g.bonkBeast(11, false, g.hero);
  assert(b.broken); assert.equal(g.events.filter((e) => e.kind === 'part').length, 1); assert(g.drops.length >= 3);
  calm(g); assert.equal(g.mode, 'calm'); assert.equal(g.profile.naps.bristleback, 1); assert(g.profile.materials.bristleback >= 10); assert.equal(g.drops.length, 0);
  const record = g.save(); assert.equal(g.bonkBeast(100, true, g.hero), false); tick(g, 2); assert.deepEqual(g.save(), record);
});
check('three different naps unlock both final hunts; Frostmane leads to victory and replay', () => {
  const g = fresh(); calm(g); g.returnVillage(); g.startHunt('bristleback'); calm(g); assert.equal(g.unlocked('hornclack'), false);
  for (const id of ['puffwart', 'skreel']) { g.returnVillage(); g.startHunt(id); calm(g); }
  assert(g.unlocked('hornclack')); assert(g.unlocked('frostmane')); g.returnVillage(); g.startHunt('frostmane'); calm(g);
  assert.equal(g.mode, 'victory'); assert(g.profile.won); g.returnVillage(); assert(g.startHunt('bristleback'));
});
check('forge spends actual materials on both tools, capped at three levels', () => {
  const g = new HuntGame(); g.chooseHero('dora'); g.profile.materials.bristleback = 20; g.profile.materials.puffwart = 20;
  for (const hero of ['dora', 'enzo']) { assert(g.upgrade(hero)); assert(g.upgrade(hero)); assert.equal(g.profile.levels[hero], 3); assert.equal(g.upgrade(hero), false); }
  assert.equal(g.materialTotal, 4);
});
check('tuckered-out returns to camp without losing gathered materials and retries refill the pouch', () => {
  const g = fresh(); g.profile.materials.bristleback = 7; g.items[0] = 0; g.hero.fluff = 5; g.bumpHero(10, g.beast);
  assert.equal(g.mode, 'camp'); assert.equal(g.profile.materials.bristleback, 7); assert(g.startHunt('bristleback')); assert.equal(g.hero.fluff, 100); assert.deepEqual(g.items, [3, 2, 2]);
});
check('saves round-trip permanent progress, reject malformed numbers and safely return to camp', () => {
  const g = fresh('frostmane', 'enzo'); g.profile.levels.enzo = 2; calm(g); const save = g.save(), restored = HuntGame.load(JSON.parse(JSON.stringify(save)));
  assert.deepEqual(restored.profile, g.profile); assert.equal(restored.mode, 'village'); restored.profile.naps.frostmane++; assert.notDeepEqual(restored.profile, save.profile);
  for (const s of [null, [], { v: 2 }, { v: 1, profile: { levels: { dora: -100 }, materials: { skreel: NaN }, naps: { frostmane: Infinity }, hero: 'bad' } }]) {
    const safe = HuntGame.load(s); assert.equal(safe.profile.levels.dora, 1); assert.equal(safe.profile.materials.skreel, 0); assert.equal(safe.profile.won, false);
  }
  const before = g.time; g.step(NaN); g.step(-1); assert.equal(g.time, before); g.paused = true; g.step(DT); assert.equal(g.time, before);
});
check('dizzy openings cannot bank another dizzy', () => {
  const g = fresh(), b = g.beast; g.makeDizzy();
  for (let n = 0; n < 4; n++) g.bonkBeast(1, true, g.hero);
  assert.equal(b.dizzy, 0); b.state = 'rest'; g.bonkBeast(1, true, g.hero);
  assert.equal(b.state, 'rest'); assert.equal(b.dizzy, 1);
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
  const g = fresh(); g.drops.push({ id: 99, x: 15, z: 0, material: 'bristleback', count: 4 });
  g.hero.fluff = 1; g.bumpHero(10, g.beast); assert.equal(g.profile.materials.bristleback, 4); assert.equal(g.drops.length, 0);
  g.bumpHero(10, g.beast); assert.equal(g.profile.materials.bristleback, 4);
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
  g.step(DT, input({ next: true })); assert.equal(g.item, (item + 1) % 3); assert.equal(g.order, 'gather');
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
  g.commandBuddy(1); assert.equal(g.order, 'gather'); g.drops.push({ id: 999, x: -8, z: 4, material: 'bristleback', count: 2 });
  const before = g.profile.materials.bristleback; tick(g, 6);
  assert.equal(g.drops.length, 0); assert.equal(g.profile.materials.bristleback, before + 2); assert.equal(m.grump, m.maxGrump);
});
check('final hunt unlock belongs only to the third different nap result', () => {
  const g = fresh(); calm(g); assert.equal(g.unlockedFinalHunts, false);
  g.returnVillage(); g.startHunt('puffwart'); calm(g); assert.equal(g.unlockedFinalHunts, false);
  g.returnVillage(); g.startHunt('skreel'); calm(g); assert.equal(g.unlockedFinalHunts, true);
  g.returnVillage(); g.startHunt('bristleback'); assert.equal(g.unlockedFinalHunts, false); calm(g); assert.equal(g.unlockedFinalHunts, false);
  g.startHunt('bristleback'); g.hero.fluff = 1; g.bumpHero(10, g.beast); assert.equal(g.unlockedFinalHunts, false);
});
console.log(`Grumble Hunt: ${checks} engine checks passed.`);
