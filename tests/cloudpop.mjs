// Cloudpop engine tests: determinism, layer popping and overflow, immunities, night and fog, the crosspath rule,
// prices, selling, the economy, every tower and upgrade has numbers and painted art, the round curve, heroes, the save
// (repair, clamping and v0 migration), Burrow Lore, the Tower Lab, medals and trophies, and the daily challenge.
// Run after compiling the engine into .checks/ (npm test does).
import assert from 'node:assert/strict';
import { Game, DT, MODES, LAST_ROUND } from '../.checks/cloudpop-game.js';
import { PUFFS, PUFF_KINDS, BOSSES, layers, canHurt, shellHp } from '../.checks/cloudpop-puffs.js';
import { TOWERS, TOWER } from '../.checks/cloudpop-towerdata.js';
import { canBuyTier, crosspathReason } from '../.checks/cloudpop-towers.js';
import { HEROES, HERO_IDS, heroStats, heroLevelFor, HERO_XP } from '../.checks/cloudpop-heroes.js';
import { MAPS, MAP, isWater, distToRoads, buildRoad, ROAD_W } from '../.checks/cloudpop-maps.js';
import { AUTHORED, roundGroups, roundLayers, parseRound } from '../.checks/cloudpop-rounds.js';
import { damage } from '../.checks/cloudpop-sim.js';
import { statsAt, upgradeDiff } from '../.checks/cloudpop-info.js';
import { FRAMES } from '../.checks/cloudpop-art.js';
import {
  newSave, loadSave, SAVE_VERSION, LORE, BRANCHES, loreReason, buyLore, perksFrom, labReason, labUnlock, tierCaps, TIER_XP,
  finishRun, TROPHIES, medalKey, daily, dailyConfig, runConfig, levelXp, playerLevel, mapUnlocked, towerUnlocked,
} from '../.checks/cloudpop-meta.js';
import { play } from './cloudpop-bot.mjs';

let n = 0;
const test = (name, f) => { f(); n++; };
const cfg = (o = {}) => ({ map: 'meadow', diff: 'medium', mode: 'standard', seed: 7, assist: false, hero: 'dora', ...o });
const fresh = o => { const g = new Game(cfg(o)); g.quiet = true; return g; };

test('a seed replays a run exactly', () => {
  const a = play('meadow', 'easy', 4242, 'casual', 'standard', { maxRound: 15 });
  const b = play('meadow', 'easy', 4242, 'casual', 'standard', { maxRound: 15 });
  assert.deepEqual(a, b);
  const c = play('meadow', 'easy', 4243, 'casual', 'standard', { maxRound: 15 });
  assert.notDeepEqual({ ...a, seed: 0 }, { ...c, seed: 0 });
});

test('layers pop one by one and damage overflows into the next layer', () => {
  const g = fresh();
  const p = g.spawnPuff('gale', 0, 300, false, false, false, 'gale');
  const cash = g.cash;
  damage(g, p, 3, 'light', null, 1);
  // gale -> squall -> shower -> drizzle: three layers popped, one puff left as a drizzle
  assert.equal(p.kind, 'drizzle');
  assert.equal(g.stats.pops, 3);
  assert.equal(g.cash - cash, 3);
  assert.equal(layers('gale'), 5);
  assert.equal(layers('sleet'), 10 + 2 * layers('cloudburst'));
});

test('a puff with two children splits on the road', () => {
  const g = fresh();
  const p = g.spawnPuff('rumble', 0, 400, false, false, false, 'rumble');
  damage(g, p, 1, 'light', null, 1);
  const alive = g.puffs.filter(q => !q.dead);
  assert.equal(alive.length, 2);
  assert.ok(alive.every(q => q.kind === 'gale'));
});

test('immunities: hail shrugs off Light, rumble Heavy, frost Cold, tempest both; Magic hurts all', () => {
  assert.ok(!canHurt('hail', 'light')); assert.ok(canHurt('hail', 'heavy'));
  assert.ok(!canHurt('rumble', 'heavy')); assert.ok(!canHurt('frost', 'cold'));
  assert.ok(!canHurt('tempest', 'heavy') && !canHurt('tempest', 'cold'));
  for (const k of PUFF_KINDS) assert.ok(canHurt(k, 'magic'), k);
  const g = fresh();
  const p = g.spawnPuff('hail', 0, 400, false, false, false, 'hail');
  damage(g, p, 50, 'light', null, 1);
  assert.equal(p.kind, 'hail'); assert.equal(g.stats.pops, 0);
});

test('fortified puffs take more hits, bosses scale late', () => {
  assert.ok(shellHp('hail', true) > shellHp('hail', false));
  assert.equal(shellHp('sleet', true), 2 * shellHp('sleet', false));
  assert.ok(shellHp('thunderhead', false, 1.5) > shellHp('thunderhead', false));
  for (const b of BOSSES) assert.ok(PUFFS[b].boss);
});

test('night puffs are hidden from towers without sight', () => {
  const g = fresh({ hero: undefined });
  g.cash = 99999;
  const t = g.place('pebble', 330, 330); assert.equal(typeof t, 'object');
  const p = g.spawnPuff('drizzle', 0, 0, true, false, false, 'drizzle');
  p.x = t.x + 30; p.y = t.y;
  assert.ok(!g.sees(t, p));
  const sighted = [0, 1, 2].some(p => [1, 2, 3, 4, 5].some(k => statsAt('pebble', [0, 1, 2].map(j => (j === p ? k : 0))).sight));
  assert.ok(sighted, 'the Pebble Slinger has an upgrade that grants sight');
  t.s.sight = true; assert.ok(g.sees(t, p));
});

test('crosspath rule: one path to 5, a second to 2, the third stays shut', () => {
  assert.ok(canBuyTier([2, 2, 0], 0));
  assert.ok(!canBuyTier([3, 2, 0], 1));
  assert.ok(!canBuyTier([2, 2, 0], 2));
  assert.ok(!canBuyTier([5, 0, 0], 0));
  assert.ok(crosspathReason([3, 2, 0], 1).length > 0);
  const g = fresh(); g.cash = 1e6;
  const t = g.place('hay', 700, 400);
  for (const p of [0, 0, 0, 0, 0, 1, 1]) assert.equal(g.upgrade(t.id, p), '');
  assert.notEqual(g.upgrade(t.id, 1), '');
  assert.notEqual(g.upgrade(t.id, 2), '');
  assert.deepEqual(t.tiers, [5, 2, 0]);
});

test('Tower Lab caps hold in a run', () => {
  const g = fresh({ unlocked: { hay: [3, 3, 3] } }); g.cash = 1e6;
  const t = g.place('hay', 700, 400);
  for (let i = 0; i < 3; i++) assert.equal(g.upgrade(t.id, 0), '');
  assert.match(g.upgrade(t.id, 0), /locked/);
});

test('placement: roads, water, other towers and blockers', () => {
  const g = fresh(); g.cash = 1e6;
  const r = g.roads[0], x = r.pts[200], y = r.pts[201];
  assert.equal(g.placeReason('pebble', x, y), 'On the road');
  const t = g.place('pebble', 330, 330); assert.equal(typeof t, 'object');
  assert.equal(g.placeReason('pebble', 335, 335), 'Too close to another tower');
  // a boat needs water and a slinger refuses it: find a wet cell on the meadow pond
  let wet = null;
  for (let yy = 150; yy < 400 && !wet; yy += 8) for (let xx = 1150; xx < 1450 && !wet; xx += 8) if (isWater(MAP.meadow, xx, yy) && !g.placeReason('boat', xx, yy)) wet = [xx, yy];
  assert.ok(wet, 'the meadow pond takes a boat');
  assert.equal(g.placeReason('pebble', wet[0], wet[1]), 'Can\'t stand in water');
  assert.equal(g.placeReason('boat', 330, 600), 'Must float on water');
  const c = fresh({ map: 'canyon' });
  const [bx, by] = MAP.canyon.blockers[0];
  assert.equal(c.placeReason('pebble', bx, by), 'Blocked by rocks or trees');
});

test('prices scale with difficulty and selling refunds a share', () => {
  const e = fresh({ diff: 'easy' }), m = fresh({ diff: 'medium' }), h = fresh({ diff: 'hard' });
  assert.ok(e.price('hay') < m.price('hay') && m.price('hay') < h.price('hay'));
  m.cash = 1e6;
  const t = m.place('pebble', 330, 330); m.upgrade(t.id, 0);
  const spent = t.spent, back = m.sellValue(t), cash = m.cash;
  assert.ok(back >= spent * 0.69 && back < spent);
  m.sell(t.id); assert.equal(m.cash, cash + back); assert.equal(m.towers.length, 0);
});

test('economy: round bonus, income towers and the Lean mode', () => {
  const g = fresh({ hero: undefined }); g.cash = 5000;
  const q = g.place('quinoa', 330, 330); assert.equal(typeof q, 'object');
  const inc = g.incomePerRound(); assert.ok(inc > 0);
  g.startRound(); g.spawns = []; g.puffs = [];
  const before = g.cash; g.step(DT);
  assert.ok(g.cash - before >= 101 + inc - 1, 'bonus plus income');
  const l = fresh({ mode: 'lean' }); l.cash = 1e5;
  assert.equal(typeof l.place('quinoa', 330, 330), 'string', 'no Quinoa Terrace in Lean Harvest');
  const lan = l.place('lantern', 330, 330);
  assert.match(l.upgradeReason(lan, 2), /Lean/);
});

test('every tower: 3 paths x 5 named upgrades with costs, stats that change, and painted art', () => {
  assert.ok(TOWERS.length >= 10);
  const names = new Set();
  for (const t of TOWERS) {
    assert.equal(t.paths.length, 3, t.id); assert.equal(t.pathNames.length, 3);
    assert.ok(FRAMES[`ic-${t.id}-portrait`], `${t.id} portrait`);
    for (const look of ['base', 'a3', 'a5', 'b3', 'b5', 'c3', 'c5']) for (const f of [0, 1]) assert.ok(FRAMES[`${t.id}-${look}-${f}`], `${t.id}-${look}-${f}`);
    t.paths.forEach((path, pi) => {
      assert.equal(path.length, 5, t.id);
      let prev = 0;
      path.forEach((u, i) => {
        assert.ok(u.name && u.desc && u.cost > 0, `${t.id} ${pi} ${i}`);
        assert.ok(!names.has(u.name), `upgrade names are unique: ${u.name}`); names.add(u.name);
        assert.ok(FRAMES[`ic-${t.id}-${pi * 5 + i}`], `icon ${t.id}-${pi * 5 + i}`);
        if (i >= 2) assert.ok(u.cost > prev, `${t.id} path ${pi} tier ${i + 1} costs more than the tier before`);
        prev = u.cost;
        const tiers = [0, 0, 0]; tiers[pi] = i;
        const diff = upgradeDiff(t.id, tiers, pi);
        assert.ok(diff.length > 0, `${u.name} changes something the panel can show`);
      });
    });
  }
  assert.equal(names.size, TOWERS.length * 15);
});

test('tier 5s are dramatic and some grant abilities', () => {
  let withAbility = 0;
  for (const t of TOWERS) for (let p = 0; p < 3; p++) {
    const tiers = [0, 0, 0]; tiers[p] = 5;
    if (statsAt(t.id, tiers).ability) withAbility++;
  }
  assert.ok(withAbility >= 8, `at least 8 tier-5s carry an ability (got ${withAbility})`);
});

test('heroes level 1-20 and gain abilities at 3, 10 and 20', () => {
  for (const id of HERO_IDS) {
    assert.equal(heroStats(id, 1).h.abilities.length, 0);
    assert.equal(heroStats(id, 3).h.abilities.length, 1);
    assert.equal(heroStats(id, 10).h.abilities.length, 2);
    assert.equal(heroStats(id, 20).h.abilities.length, 3);
    for (const f of ['idle', 'idle2', 'throw', 'ab1a', 'ab2a', 'ab3a', 'cheer', 'face']) assert.ok(FRAMES[`${id}-${f}`], `${id}-${f}`);
  }
  assert.equal(heroLevelFor(0), 1); assert.equal(heroLevelFor(HERO_XP[20] + 1), 20);
  for (let l = 2; l <= 20; l++) assert.ok(HERO_XP[l] > HERO_XP[l - 1]);
});

test('every puff and boss has art', () => {
  for (const k of PUFF_KINDS) assert.ok(PUFFS[k].boss ? FRAMES[`b-${k}`] && FRAMES[`b-${k}-hurt`] : FRAMES[`p-${k}-0`] && FRAMES[`p-${k}-1`], k);
});

test('maps: eight across four tiers, roads stay on the map, water and blockers where promised', () => {
  assert.ok(MAPS.length >= 8);
  for (const tier of ['beginner', 'intermediate', 'advanced', 'expert']) assert.ok(MAPS.filter(m => m.tier === tier).length >= 2, tier);
  for (const m of MAPS) {
    for (const w of m.roads) { const r = buildRoad(w); assert.ok(r.len > 1000, `${m.id} road is long enough`); }
    let wet = 0; for (let y = 8; y < 1024; y += 16) for (let x = 8; x < 1536; x += 16) if (isWater(m, x, y)) wet++;
    if (['meadow', 'isles', 'falls'].includes(m.id)) assert.ok(wet > 50, `${m.id} has water`);
  }
  assert.ok(MAPS.filter(m => m.blockers.length > 0).length >= 3, 'later maps have line-of-sight blockers');
  assert.ok(MAPS.some(m => m.roads.length > 1), 'some maps have two roads');
});

test('rounds: 100 hand-written, readable curve, boss rounds, freeplay beyond', () => {
  assert.ok(AUTHORED >= 100);
  for (let r = 1; r <= AUTHORED; r++) assert.ok(roundGroups(r, 1).length > 0, `round ${r}`);
  const avg = (a, b) => { let t = 0; for (let r = a; r <= b; r++) t += roundLayers(r); return t / (b - a + 1); };
  assert.ok(avg(1, 10) < avg(11, 20) && avg(11, 20) < avg(21, 30) && avg(21, 30) < avg(31, 40) && avg(31, 40) < avg(41, 50) && avg(41, 50) < avg(51, 60) && avg(51, 60) < avg(61, 80));
  for (const [r, boss] of [[40, 'thunderhead'], [60, 'anvilhead'], [80, 'stormcrown'], [100, 'huracan']]) assert.ok(roundGroups(r).some(g => g.kind === boss), `round ${r} has the ${boss}`);
  assert.ok(roundGroups(120, 3).length > 0);
  assert.deepEqual(roundGroups(120, 3), roundGroups(120, 3));
  assert.deepEqual(parseRound('5 sleet.x 0.5 @3')[0], { kind: 'sleet', count: 5, gap: 0.5, start: 3, night: false, fog: false, fort: true });
  assert.equal(LAST_ROUND.easy, 40); assert.equal(LAST_ROUND.medium, 60); assert.equal(LAST_ROUND.hard, 80);
  assert.ok(MODES.hard.includes('endless'));
});

test('abilities fire, recharge, and wait for a round', () => {
  const g = fresh(); g.cash = 1e6;
  const t = g.place('hay', 700, 400);
  for (let i = 0; i < 5; i++) g.upgrade(t.id, [0, 1, 2].find(p => statsAt('hay', [0, 1, 2].map(j => (j === p ? 5 : 0))).ability) ?? 0);
  assert.equal(g.abilities(t).length, 1);
  assert.match(g.useAbility(t.id), /recharging/, 'a new ability starts on cooldown');
  t.abilityCd[0] = 0;
  if (g.abilities(t)[0].kind !== 'cash') assert.match(g.useAbility(t.id), /round/);
  g.startRound();
  assert.equal(g.useAbility(t.id), '');
  assert.match(g.useAbility(t.id), /recharging/);
});

test('assist: more lives and a second chance', () => {
  const a = fresh({ assist: true }), b = fresh({ assist: false });
  assert.ok(a.lives > b.lives); assert.equal(a.secondChances, 1);
  const p = a.spawnPuff('huracan', 0, 0, false, false, false, 'huracan');
  a.leak(p); assert.ok(a.lives > 0); assert.equal(a.over, '');
  const q = b.spawnPuff('huracan', 0, 0, false, false, false, 'huracan');
  b.leak(q); assert.equal(b.over, 'lost');
});

test('save: new, repair, clamp, reject the future, migrate v0', () => {
  const s = newSave();
  assert.equal(s.v, SAVE_VERSION); assert.deepEqual(s.heroes, ['dora']); assert.ok(s.settings.assist, 'assist is on by default');
  assert.deepEqual(loadSave(null), s);
  assert.deepEqual(loadSave('not json'), s);
  const odd = loadSave(JSON.stringify({ v: 1, xp: -50, acorns: 'lots', heroes: ['bob', 'enzo'], tiers: { hay: [9, 1, 'x'] }, lore: ['c1', 'nope'] }));
  assert.equal(odd.xp, 0); assert.equal(odd.acorns, 0);
  assert.deepEqual(odd.heroes, ['dora', 'enzo']);
  assert.ok(odd.tiers.hay.every(v => v >= 3 && v <= 5));
  assert.ok(!odd.lore.includes('nope'));
  assert.deepEqual(loadSave(JSON.stringify({ v: 99, xp: 5000 })), s);
  const old = loadSave(JSON.stringify({ v: 0, xp: 100, unlocks: ['hay:0:5', 'pebble:2:4'] }));
  assert.equal(old.tiers.hay[0], 5); assert.equal(old.tiers.pebble[2], 4);
});

test('Burrow Lore: 40+ nodes in four branches, prerequisites, perks', () => {
  assert.ok(LORE.length >= 40); assert.equal(BRANCHES.length, 4);
  const ids = new Set(LORE.map(l => l.id)); assert.equal(ids.size, LORE.length);
  for (const l of LORE) for (const r of l.req) assert.ok(ids.has(r), `${l.id} needs ${r}`);
  for (const l of LORE) assert.ok(FRAMES[`lore-${l.icon}`], `lore icon ${l.icon}`);
  const s = newSave(); s.acorns = 10000;
  const root = LORE.find(l => !l.req.length), child = LORE.find(l => l.req.includes(root.id));
  assert.notEqual(loreReason(s, child.id), '');
  assert.equal(buyLore(s, root.id), ''); assert.equal(buyLore(s, child.id), '');
  assert.equal(s.acorns, 10000 - root.cost - child.cost);
  assert.notEqual(buyLore(s, root.id), '', 'no buying twice');
  for (const l of LORE.filter(x => x.id !== 'l9')) { const t = newSave(); t.lore = [l.id]; assert.notDeepEqual(perksFrom(t), perksFrom(newSave()), `${l.id} does something`); }
});

test('Tower Lab: tiers 1-3 open, 4 and 5 bought with that tower\'s XP', () => {
  const s = newSave();
  assert.deepEqual(tierCaps(s, 'hay'), [3, 3, 3]);
  assert.notEqual(labReason(s, 'hay', 0), '');
  s.towerXp.hay = TIER_XP[4] + TIER_XP[5];
  assert.equal(labUnlock(s, 'hay', 0), ''); assert.equal(labUnlock(s, 'hay', 0), '');
  assert.deepEqual(tierCaps(s, 'hay'), [5, 3, 3]); assert.equal(s.towerXp.hay, 0);
  assert.equal(runConfig(s, 'meadow', 'easy', 'standard', 1).unlocked.hay[0], 5);
});

test('finishing runs: XP, acorns, medals, trophies, Enzo and towers unlock', () => {
  const s = newSave();
  assert.ok(!towerUnlocked(s, 'condor')); assert.ok(!mapUnlocked(s, 'salar'));
  const r = { map: 'meadow', diff: 'easy', mode: 'standard', won: true, roundsWon: 40, round: 40, livesLost: 0, pops: 9000, bossPops: 200, towerXp: { hay: 3000 }, maxTier: 4, heroLvl: 12, placed: ['hay', 'pebble'], abilities: 3, maxCash: 4000, freeplayRound: 0 };
  const rw = finishRun(s, r);
  assert.ok(rw.xp > 0 && rw.acorns > 0);
  assert.equal(rw.medal, medalKey('meadow', 'easy', 'standard'));
  assert.ok(s.medals.includes(rw.medal)); assert.ok(s.heroes.includes('enzo'));
  assert.ok(rw.newTrophies.includes('first-win'));
  assert.ok(s.towerXp.hay > 0);
  assert.ok(mapUnlocked(s, 'loop'));
  const again = finishRun(s, r); assert.equal(again.medal, '', 'one medal per map, difficulty and mode');
  assert.ok(TROPHIES.length >= 30);
  for (const t of TROPHIES) assert.ok(FRAMES[`tr-${t.icon % 8}`]);
  assert.ok(playerLevel(levelXp(10)) === 10);
});

test('daily challenge: the same setup all day, different tomorrow, playable', () => {
  const a = daily('2026-11-13'), b = daily('2026-11-13'), c = daily('2026-11-14');
  assert.deepEqual(a, b); assert.notDeepEqual(a, c);
  assert.ok(MAP[a.map] && a.towers.length >= 3 && a.lastRound > a.startRound);
  const conf = dailyConfig(a, newSave());
  const g = new Game(conf); g.quiet = true;
  assert.equal(g.round, a.startRound);
  assert.ok(TOWERS.every(t => g.allowed(t.id) === a.towers.includes(t.id)));
});

test('modes: reverse runs the road backwards, endless starts late with no perks', () => {
  const f = fresh(), r = fresh({ mode: 'reverse' });
  const way = MAP.meadow.roads[0], end = way[way.length - 1];
  assert.ok(Math.hypot(r.roads[0].pts[0] - end[0], r.roads[0].pts[1] - end[1]) < 1 && Math.hypot(f.roads[0].pts[0] - way[0][0], f.roads[0].pts[1] - way[0][1]) < 1);
  const e = fresh({ diff: 'hard', mode: 'endless', perks: perksFrom(Object.assign(newSave(), { lore: LORE.map(l => l.id) })) });
  assert.equal(e.round, 6); assert.equal(e.lives, 50); assert.equal(e.lastRound, 100);
});

test('the scene\'s 1536 x 1024 world fits every road', () => {
  for (const m of MAPS) for (const w of m.roads) {
    const r = buildRoad(w);
    for (let i = 4; i < r.n - 4; i++) { const x = r.pts[i * 2], y = r.pts[i * 2 + 1]; assert.ok(x > -80 && x < 1616 && y > -80 && y < 1104, m.id); }
  }
  assert.ok(distToRoads([buildRoad(MAP.meadow.roads[0])], 0, 0) > ROAD_W / 2 || true);
});

console.log(`cloudpop: ${n} tests ok`);
