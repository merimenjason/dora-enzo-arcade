import assert from 'node:assert/strict';
import {
  Game, Battle, HEROES, heroById, heroSpec, specPower, skillText, stageDef, stageMult, goldFor, gearTier, rng, ROLES, ENEMIES, FACTIONS, CHAPTERS, BOSSES, STAGES,
  RARITY_MULT, LEVEL_GROWTH, STAR_STEP, MAX_STARS, STAR_COST, DUP_SHARDS, GEAR, GEAR_STEP, MAX_TIER, MERGE, FACTION_BONUS, LEVEL_COST, LEVEL_COST_GROWTH, BASE_CAP,
  ENERGY, START_ENERGY, ENERGY_HIT, STUN, STAGGER, EXPOSED, BOSS_STUN, SHIELD_TIME, RALLY_TIME, MARCH, LIMIT, PAR, MELEE_REACH, ENEMY_MELEE, ENEMY_RANGED, SUMMON_AT,
  SLOTS, START_SCROLLS, START_GOLD, FIRST_CLEAR, ODDS, PITY, CHEST_STARS, CHEST_SCROLLS, CAMP_HOURS, CAMP_RATE, TOWER_SCROLLS, TOWER_EVERY, SAVE_VERSION, STEP,
} from '../.checks/saga-game.js';
import { play, fight, timed } from './saga-bot.mjs';

const near = (a, b, msg, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${msg} (${a} vs ${b})`);
const HOUR = 3_600_000, abc = (a, b) => a.localeCompare(b);
const owned = (level = 1, stars = 1, gear = [0, 0, 0, 0]) => ({ level, stars, shards: 0, gear: [...gear] });
const spec = (id, level = 1, over = {}) => ({ ...heroSpec(heroById(id), owned(level)), ...over });
/** A battle against a hand-made stage, so one rule can be looked at alone. */
const battle = (squad, waves, { mult = 1, seed = 5, summons = false, boss = false } = {}) =>
  new Battle(squad, { index: 0, chapter: 0, number: 1, boss, tower: 0, name: 'test', waves, mult, summons }, seed);
const run = (b, seconds, input = {}) => { const all = []; for (let i = 0; i < Math.round(seconds / STEP); i++) all.push(...b.update(STEP, input)); return all; };
const until = (b, test, input = {}, limit = 200) => { const all = []; for (let i = 0; i < limit / STEP && !test(b); i++) all.push(...b.update(STEP, input)); assert.ok(test(b), 'the battle reached the moment the test waits for'); return all; };
const hero = (b, slot) => b.heroes.find((u) => u.slot === slot);
/** A saga with the first `n` stages already cleared and a named squad at one level. */
const saga = (n, squad = ['enzo', 'dora', 'pip', 'bramble', 'flint'], level = 1) => {
  const g = new Game(42);
  for (let i = 0; i < n; i++) g.stars[i] = 1;
  for (const id of squad) g.heroes[id] = owned(level);
  g.squad = [...squad, null, null, null, null].slice(0, SLOTS);
  return g;
};
const win = (g, n) => { assert.ok(g.start(n), `stage ${n + 1} starts`); const b = fight(g); assert.equal(b.phase, 'won', `stage ${n + 1} is won`); const loot = g.loot; g.leave(); return { b, loot }; };

// The roster
{
  assert.equal(HEROES.length, 18);
  assert.equal(new Set(HEROES.map((x) => x.id)).size, 18, 'every hero has its own id');
  for (const f of FACTIONS) {
    const mine = HEROES.filter((x) => x.faction === f);
    assert.equal(mine.length, 6, `${f} has six heroes`);
    assert.deepEqual([...new Set(mine.map((x) => x.role))].sort(abc), Object.keys(ROLES).sort(abc), `${f} can field every role`);
  }
  assert.deepEqual(HEROES.filter((x) => x.from === 'start').map((x) => x.id), ['dora', 'enzo']);
  assert.deepEqual(HEROES.filter((x) => x.from === 'story').map((x) => x.chapter), [0, 1, 2, 3, 4, 5], 'one story hero for each of the first six chapters');
  assert.equal(HEROES.filter((x) => x.from === 'summon').length, 10);
  for (const r of [1, 2, 3]) assert.ok(HEROES.some((x) => x.from === 'summon' && x.rarity === r), `a rarity ${r} hero can be summoned`);
  for (const x of HEROES) assert.ok(skillText(x.skill).length > 20 && !/undefined|NaN/.test(skillText(x.skill)), `${x.name}'s skill is described`);
  assert.equal(CHAPTERS.length, 8); assert.equal(BOSSES.length, 8); assert.equal(STAGES, 80);
}

// Levels, stars, gear and the faction bonus
{
  const dora = heroById('dora'), base = ROLES.striker;
  const one = heroSpec(dora, owned());
  assert.equal(one.hp, Math.round(base.hp * RARITY_MULT[2])); assert.equal(one.atk, Math.round(base.atk * RARITY_MULT[2]));
  assert.equal(heroSpec(dora, owned(11)).atk, Math.round(base.atk * RARITY_MULT[2] * LEVEL_GROWTH ** 10));
  assert.equal(heroSpec(dora, owned(1, 3)).hp, Math.round(base.hp * RARITY_MULT[2] * (1 + 2 * STAR_STEP)));
  const geared = heroSpec(dora, owned(1, 1, [2, 3, 4, 5]));
  assert.equal(geared.atk, Math.round(base.atk * RARITY_MULT[2] * (1 + 2 * GEAR_STEP[0])));
  assert.equal(geared.hp, Math.round(base.hp * RARITY_MULT[2] * (1 + 3 * GEAR_STEP[1])));
  near(geared.charge, 1 + 4 * GEAR_STEP[2], 'a charm speeds the skill'); near(geared.interval, base.interval / (1 + 5 * GEAR_STEP[3]), 'boots speed the attack');
  assert.ok(specPower(geared) > specPower(one));
  assert.ok(heroSpec(heroById('onyx'), owned()).atk > heroSpec(heroById('thistle'), owned()).atk, 'a legendary striker outhits a rare one');

  const g = saga(0, ['dora', 'pip', 'mossy', 'clover', 'willow']);
  assert.equal(g.factionBonus, FACTION_BONUS[5], 'five of one faction');
  assert.equal(g.spec('dora').hp, Math.round(base.hp * RARITY_MULT[2] * (1 + FACTION_BONUS[5])));
  g.place('enzo', 0); assert.equal(g.factionBonus, FACTION_BONUS[4]);
  g.heroes.flint = owned(); g.place('flint', 1); assert.equal(g.factionBonus, FACTION_BONUS[3]);
  g.heroes.bramble = owned(); g.place('bramble', 2); assert.equal(g.factionBonus, 0, 'two of a faction earns nothing');
}

// Stages
{
  assert.deepEqual(stageDef(17), stageDef(17), 'a stage is always the same stage');
  for (let n = 0; n < STAGES + 12; n++) {
    const d = stageDef(n);
    assert.equal(d.waves.length, 3);
    assert.equal(d.waves[2][0], d.boss ? 'boss' : 'captain', 'the last wave has a leader');
    assert.ok(d.waves.flat().length <= 14 && d.waves.every((w) => w.length >= 2 && w.length <= 5));
    near(d.mult, stageMult(n), 'the multiplier follows the stage');
  }
  assert.equal(stageDef(9).boss, true); assert.equal(stageDef(8).boss, false);
  assert.equal(stageDef(0).name, 'Clover Meadow 1'); assert.equal(stageDef(79).name, 'Hollow Keep 10');
  assert.equal(stageDef(80).tower, 1); assert.equal(stageDef(84).boss, true, 'every fifth tower floor is a boss'); assert.equal(stageDef(84).name, 'Tower floor 5');
  assert.ok(!stageDef(5).waves.flat().includes('sneak') && !stageDef(15).waves.flat().includes('brute') && !stageDef(25).waves.flat().includes('hexer'), 'new enemies wait for their chapter');
  assert.ok([10, 11, 12, 13, 14, 15].some((n) => stageDef(n).waves.flat().includes('sneak')), 'sneaks arrive in chapter two');
  assert.ok(stageDef(19).summons && !stageDef(9).summons && !stageDef(18).summons, 'every second chapter boss calls for help');
  assert.ok(goldFor(40) > goldFor(10)); assert.equal(gearTier(0, false), 1); assert.equal(gearTier(7, true), MAX_TIER); assert.equal(gearTier(4, false), 3);
}

// A battle: marching, basic attacks, and the same seed twice
{
  const squad = () => [spec('enzo', 6), spec('dora', 6), spec('pip', 6), null, null];
  const b = battle(squad(), [['grunt', 'grunt'], ['grunt'], ['captain']]);
  assert.equal(b.phase, 'march'); assert.equal(b.heroes.length, 3);
  assert.deepEqual(b.heroes.map((u) => u.row), [0, 0, 1], 'the first two slots are the front row');
  assert.equal(hero(b, 0).energy, START_ENERGY);
  const first = run(b, MARCH + 0.05);
  assert.ok(first.some((e) => e.type === 'wave' && e.wave === 0)); assert.equal(b.phase, 'fight'); assert.equal(b.foes.length, 2);
  assert.ok(b.foes.every((u) => u.d > ENEMY_MELEE), 'enemies start at a distance and walk in');
  assert.equal(b.ready(0), false, 'a skill is not ready until it is charged');
  const log = until(b, (x) => x.phase === 'won' || x.phase === 'lost', { auto: true });
  assert.equal(b.phase, 'won'); assert.equal(b.wave, 2);
  assert.ok(log.some((e) => e.type === 'skill') && log.some((e) => e.type === 'heal') && log.some((e) => e.type === 'die' && !e.hero));
  assert.ok(b.stars >= 1 && b.stars <= 3);

  const again = battle(squad(), [['grunt', 'grunt'], ['grunt'], ['captain']]);
  until(again, (x) => x.phase === 'won' || x.phase === 'lost', { auto: true });
  assert.equal(again.time, b.time, 'the same seed fights the same fight'); assert.deepEqual(again.heroes.map((u) => u.hp), b.heroes.map((u) => u.hp));
  const other = battle(squad(), [['grunt', 'grunt'], ['grunt'], ['captain']], { seed: 6 });
  until(other, (x) => x.phase === 'won' || x.phase === 'lost', { auto: true });
  assert.notDeepEqual(other.heroes.map((u) => u.hp), b.heroes.map((u) => u.hp), 'another seed rolls different hits');

  // One long frame is cut into the same fixed steps.
  const slow = battle(squad(), [['grunt', 'grunt'], ['grunt'], ['captain']]), quick = battle(squad(), [['grunt', 'grunt'], ['grunt'], ['captain']]);
  for (let i = 0; i < 300; i++) slow.update(STEP * 4, { auto: true });
  for (let i = 0; i < 1200; i++) quick.update(STEP, { auto: true });
  near(slow.time, quick.time, 'four steps a frame is the same battle', 0.05);
}

// Skill presses survive display frames shorter than the fixed combat tick.
{
  for (const hz of [120, 144, 240]) {
    const b = battle([spec('enzo', 1, { atk: 1, hp: 99999 }), spec('dora', 1, { atk: 1, hp: 99999 })], [['brute']]);
    until(b, x => x.phase === 'fight');
    for (const h of b.heroes) { h.energy = ENERGY; h.cd = 100; }
    for (const f of b.foes) { f.cd = 100; f.hp = f.max = 99999; }
    const events = [...b.update(1 / hz, { cast: [1] })];
    assert.equal(hero(b, 1).energy, ENERGY, `${hz} Hz press waits for its combat tick`);
    events.push(...b.update(1 / hz, { cast: [0, 1, 99] }));
    for (let i = 0; i < 12; i++) events.push(...b.update(1 / hz));
    assert.equal(events.filter(e => e.type === 'skill' && e.kind === 'strike').length, 1, `${hz} Hz strike fires exactly once`);
    assert.equal(events.filter(e => e.type === 'skill' && e.kind === 'ward').length, 1, `${hz} Hz shield fires exactly once`);
    assert.equal(hero(b, 0).energy, 0); assert.equal(hero(b, 1).energy, 0);
    assert.ok(hero(b, 0).shield > 0, 'the second press reaches the same tick too');
    hero(b, 1).energy = ENERGY;
    b.update(NaN, { cast: [1] }); b.update(-1, { cast: [1] });
    assert.equal(b.update(STEP).filter(e => e.type === 'skill').length, 0, 'invalid deltas do not enqueue a press');
    assert.equal(hero(b, 1).energy, ENERGY, 'invalid time does not poison the battle clock');
  }
}

// Skills: charging, casting, and what each kind does
{
  // Energy comes from landing hits; casting spends it.
  const b = battle([spec('enzo', 1, { atk: 1, hp: 99999 }), spec('dora', 1, { atk: 1, hp: 99999 }), null, null, null], [['brute'], ['grunt'], ['grunt']]);
  until(b, (x) => hero(x, 1).energy > START_ENERGY);
  near(hero(b, 1).energy, START_ENERGY + ENERGY_HIT, 'one hit, one helping of energy', 6);
  until(b, (x) => x.ready(1));
  assert.equal(hero(b, 1).energy, ENERGY);
  const foe = b.foes[0], before = foe.hp;
  const ev = b.update(STEP, { cast: [1] });
  assert.ok(ev.some((e) => e.type === 'skill' && e.kind === 'strike' && e.name === 'Dandelion Dash'));
  assert.ok(foe.hp < before); near(foe.stun, STUN.strike, 'a strike stuns', 0.05); assert.ok(hero(b, 1).energy < ENERGY_HIT * 2, 'the energy is spent');
  assert.equal(b.cast(1), false, 'and cannot be spent twice');
  const hp = hero(b, 0).hp; run(b, STUN.strike - 0.2); assert.equal(hero(b, 0).hp, hp, 'a stunned enemy does not attack');

  // Ward shields everyone, and the shield takes the damage first, then runs out.
  until(b, (x) => x.ready(0));
  b.update(STEP, { cast: [0] });
  assert.ok(b.alive.every((u) => u.shield > 0), 'Burrow Wall covers the whole squad');
  assert.equal(hero(b, 0).shield, Math.round(hero(b, 0).max * heroById('enzo').skill.power));
  run(b, SHIELD_TIME + 0.1); assert.ok(b.alive.every((u) => u.shield === 0), 'the shield fades');

  // Volley hits everything; freeze hits and stuns everything; snipe picks the toughest.
  const many = battle([spec('enzo', 1, { hp: 99999 }), null, spec('bramble', 30), spec('flint', 30), spec('clover', 30)], [['brute', 'grunt', 'grunt', 'slinger'], ['grunt'], ['grunt']], { mult: 40 });
  until(many, (x) => x.ready(2) && x.ready(3) && x.ready(4));
  let hpNow = many.foes.map((u) => u.hp);
  many.update(STEP, { cast: [2] });
  assert.ok(many.foes.every((u, i) => u.hp < hpNow[i]), 'Thorn Rain hits every enemy'); assert.ok(many.foes.every((u) => u.stun <= 0));
  many.update(STEP, { cast: [3] });
  assert.ok(many.foes.every((u) => u.stun > STUN.freeze - 0.1), 'Cold Snap stuns every enemy');
  const tough = [...many.foes].sort((x, y) => y.hp - x.hp)[0]; hpNow = many.foes.map((u) => u.hp);
  const shot = many.update(STEP, { cast: [4] }).filter((e) => e.type === 'hit' && e.skill);
  assert.equal(shot.length, 1); assert.equal(shot[0].to, tough.uid, 'Lucky Shot goes for the toughest enemy');

  // Healing: a healer's own attack tops up the most hurt hero, Clover Tea heals all, Snow Blanket mends one and shields them.
  const h = battle([spec('enzo', 1, { hp: 99999, atk: 1 }), null, spec('pip', 1, { atk: 100 }), spec('frost', 1, { atk: 100 }), null], [['brute'], ['grunt'], ['grunt']]);
  until(h, (x) => x.ready(2) && x.ready(3));
  for (const u of h.heroes) u.hp = Math.round(u.max / 2);
  hero(h, 0).hp = 100;
  const healed = h.update(STEP, { cast: [2] }).filter((e) => e.type === 'heal');
  assert.equal(healed.length, 3, 'Clover Tea reaches all three'); assert.ok(healed.every((e) => e.amount <= Math.round(100 * heroById('pip').skill.power)));
  hero(h, 0).hp = 100;
  const mend = h.update(STEP, { cast: [3] });
  assert.equal(mend.find((e) => e.type === 'heal').to, hero(h, 0).uid, 'Snow Blanket finds the most hurt hero'); assert.ok(hero(h, 0).shield > 0);
  hero(h, 2).hp = hero(h, 2).max; hero(h, 3).hp = hero(h, 3).max; hero(h, 0).hp = hero(h, 0).max;
  assert.ok(!run(h, 2).some((e) => e.type === 'heal'), 'nobody is healed past full health');

  // Rally quickens the whole squad for a while.
  const r = battle([spec('enzo', 1, { hp: 99999 }), null, spec('ember', 1), null, null], [['brute'], ['grunt'], ['grunt']], { mult: 50 });
  until(r, (x) => x.ready(2)); r.update(STEP, { cast: [2] });
  assert.ok(r.alive.every((u) => u.haste === heroById('ember').skill.power)); run(r, RALLY_TIME + 0.1); assert.ok(r.alive.every((u) => u.haste === 0));
}

// Wind-ups: a slam hits everyone unless it is interrupted, and an interrupted enemy reels
{
  const squad = () => [spec('enzo', 1, { hp: 50000, atk: 1 }), spec('dora', 1, { hp: 50000, atk: 1 }), spec('pip', 1, { hp: 50000, atk: 1 }), null, null];
  const b = battle(squad(), [['captain'], ['grunt'], ['grunt']]);
  const ev = until(b, (x) => !!x.winding);
  assert.ok(ev.some((e) => e.type === 'windup' && e.kind === 'slam'));
  const cap = b.winding, hp = b.heroes.map((u) => u.hp);
  const landed = until(b, (x) => !x.winding);
  assert.ok(landed.some((e) => e.type === 'slam'));
  assert.equal(landed.filter((e) => e.type === 'hit' && e.skill && e.from === cap.uid).length, 3, 'the slam lands on all three heroes');
  assert.ok(b.heroes.every((u, i) => u.hp < hp[i]));
  near(cap.specialT, ENEMIES.captain.special.every, 'and the next one is a full wait away', 0.05);

  // The same slam, stopped by a stun.
  const c = battle(squad(), [['captain'], ['grunt'], ['grunt']]);
  until(c, (x) => !!x.winding);
  hero(c, 1).energy = ENERGY;
  const foe = c.winding, stopped = c.update(STEP, { cast: [1] });
  assert.ok(stopped.some((e) => e.type === 'interrupt' && e.from === foe.uid));
  assert.equal(c.winding, null); near(foe.stun, STAGGER, 'the enemy reels for longer than a plain stun', 0.05); near(foe.exposed, EXPOSED, 'and is left open', 0.05);
  assert.ok(STAGGER > STUN.strike);
  assert.ok(!run(c, ENEMIES.captain.special.wind + 0.5).some((e) => e.type === 'slam'), 'the slam never lands');
  // An exposed enemy takes half as much again.
  const open = battle([spec('dora', 1, { atk: 1000, hp: 1e12 }), null, null, null, null], [['brute'], ['grunt'], ['grunt']], { mult: 1000 });
  until(open, (x) => x.foes[0]?.d <= MELEE_REACH && hero(x, 0).cd <= 0 && x.phase === 'fight');
  const plain = []; for (let i = 0; i < 40; i++) plain.push(...run(open, 1).filter((e) => e.type === 'hit' && e.from === hero(open, 0).uid).map((e) => e.amount));
  open.foes[0].exposed = 9999;
  const sore = []; for (let i = 0; i < 40; i++) sore.push(...run(open, 1).filter((e) => e.type === 'hit' && e.from === hero(open, 0).uid).map((e) => e.amount));
  const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  near(avg(sore) / avg(plain), 1.5, 'exposed means half as much damage again', 0.08);

  // A boss shrugs off half of a plain stun, and a hexer's wind-up heals its side.
  const boss = battle(squad(), [['boss'], ['grunt'], ['grunt']], { boss: true });
  until(boss, (x) => x.foes[0]?.d <= ENEMY_MELEE && !x.winding); hero(boss, 1).energy = ENERGY; boss.update(STEP, { cast: [1] });
  near(boss.foes[0].stun, STUN.strike * BOSS_STUN, 'a boss is stunned for half the time', 0.05);
  const hex = battle(squad(), [['grunt', 'hexer'], ['grunt'], ['grunt']]);
  until(hex, (x) => x.winding?.key === 'hexer'); for (const u of hex.foes) u.hp = Math.round(u.max / 2);
  const heals = until(hex, (x) => !x.winding).filter((e) => e.type === 'heal');
  assert.equal(heals.length, 2, 'the hexer heals both enemies'); assert.ok(heals.every((e) => e.amount <= Math.round(ENEMIES.hexer.hp * ENEMIES.hexer.special.power)));

  // A boss in a summoning chapter calls a helper each time its health drops past a mark.
  const caller = battle([spec('enzo', 1, { hp: 999999, atk: 400 }), null, null, null, null], [['boss'], ['grunt'], ['grunt']], { boss: true, summons: true });
  const calls = until(caller, (x) => x.wave === 1).filter((e) => e.type === 'call');
  assert.equal(calls.length, SUMMON_AT.length);
}

// Who gets hit, and how the two lines meet
{
  // Melee enemies hit the front row; a sneak goes for the back; with the front down, the back row is next.
  const b = battle([spec('enzo', 1, { hp: 99999, atk: 1 }), null, spec('pip', 1, { hp: 99999, atk: 1 }), spec('flint', 1, { hp: 99999, atk: 1 }), null], [['grunt', 'sneak'], ['grunt'], ['grunt']]);
  const hits = run(b, 12).filter((e) => e.type === 'hit');
  const byKey = (key) => hits.filter((e) => b.enemies.find((u) => u.uid === e.from)?.key === key).map((e) => b.heroes.find((u) => u.uid === e.to).key);
  assert.ok(byKey('grunt').length > 2 && byKey('grunt').every((k) => k === 'enzo'), 'the scuttler hits the hero in front');
  assert.ok(byKey('sneak').length > 2 && byKey('sneak').every((k) => k !== 'enzo'), 'the sneak goes round to the back row');
  const lone = battle([null, null, spec('pip', 1, { hp: 99999, atk: 1 }), null, null], [['grunt'], ['grunt'], ['grunt']]);
  assert.ok(run(lone, 10).some((e) => e.type === 'hit' && e.to === hero(lone, 2).uid), 'with nobody in front, the back row is hit');

  // An all-melee squad still reaches enemies that stand off and shoot.
  const melee = battle([spec('enzo', 20), spec('dora', 20), null, null, null], [['slinger', 'slinger'], ['grunt'], ['grunt']]);
  until(melee, (x) => x.wave === 1, {}, 60);
  assert.ok(ENEMY_RANGED > MELEE_REACH, 'they do start out of reach');

  // Falling, and running out of time.
  const weak = battle([spec('dora', 1, { hp: 50 }), null, null, null, null], [['brute', 'brute'], ['grunt'], ['grunt']], { mult: 5 });
  const lost = until(weak, (x) => x.phase === 'lost');
  assert.deepEqual(lost.at(-1), { type: 'lost', reason: 'fallen' }); assert.equal(weak.stars, 0); assert.equal(weak.fallen, 1);
  const stall = battle([spec('enzo', 1, { hp: 9999999, atk: 1 }), null, null, null, null], [['brute'], ['grunt'], ['grunt']], { mult: 100 });
  const late = until(stall, (x) => x.phase === 'lost');
  assert.deepEqual(late.at(-1), { type: 'lost', reason: 'time' }); near(stall.time, LIMIT, 'the limit', 0.05);
  assert.ok(stall.update(1).length === 0, 'a finished battle stays finished');

  // Stars: cleared, nobody fell, under par.
  const clean = battle([spec('enzo', 40), spec('dora', 40), null, null, null], [['grunt'], ['grunt'], ['captain']]);
  until(clean, (x) => x.phase === 'won', { auto: true }); assert.equal(clean.stars, 3); assert.ok(clean.time < PAR);
  clean.fallen = 1; assert.equal(clean.stars, 2); clean.time = PAR + 1; assert.equal(clean.stars, 1);
}

// A new saga, and the first battles
{
  const g = new Game(42);
  assert.deepEqual(Object.keys(g.heroes), ['dora', 'enzo']); assert.deepEqual(g.squad, ['enzo', 'dora', null, null, null]);
  assert.equal(g.gold, START_GOLD); assert.equal(g.scrolls, START_SCROLLS); assert.equal(g.cleared, 0); assert.equal(g.cap, BASE_CAP);
  assert.ok(g.unlocked(0) && !g.unlocked(1) && !g.unlocked(STAGES), 'only the first stage is open');
  assert.equal(g.canAuto(0), false, 'auto waits until a stage has been beaten once');
  assert.equal(g.start(1), false);

  // The first summons always bring someone new until the squad is full.
  for (let i = 0; i < START_SCROLLS; i++) { const s = g.summon(); assert.equal(s.fresh, true); assert.equal(heroById(s.id).from, 'summon'); }
  assert.equal(g.summon(), null, 'no scroll, no summons'); assert.equal(g.owned.length, 5); assert.ok(g.squad.every(Boolean), 'new heroes step into empty slots');

  const gold = g.gold;
  const { b, loot } = win(g, 0);
  assert.equal(loot.first, true); assert.equal(loot.gold, goldFor(0) * FIRST_CLEAR); assert.equal(g.gold, gold + loot.gold);
  assert.equal(loot.scrolls, 1, 'odd-numbered stages pay a scroll the first time'); assert.ok(loot.gear, 'a first clear always drops gear');
  assert.equal(g.bag[loot.gear.slot][loot.gear.tier], 1); assert.equal(g.stars[0], b.stars); assert.equal(g.cleared, 1); assert.equal(g.cap, BASE_CAP + 1);
  assert.ok(g.unlocked(1) && g.canAuto(0)); assert.equal(g.battle, null);

  const again = win(g, 0).loot;
  assert.equal(again.first, false); assert.equal(again.gold, goldFor(0)); assert.equal(again.scrolls, 0);
  assert.equal(win(g, 1).loot.scrolls, 0, 'even-numbered stages pay no scroll');

  // A retreat or a loss changes nothing but the count of battles fought.
  const before = JSON.stringify({ ...g.save(), battles: 0 });
  g.start(2); g.update(1); g.leave();
  assert.equal(JSON.stringify({ ...g.save(), battles: 0 }), before);
  assert.equal(g.place('dora', 0), true); g.start(2); assert.equal(g.place('dora', 1), false, 'the squad is fixed once a battle is under way'); g.leave();
}

// Story heroes, the level cap, gold and stars
{
  const g = saga(9, ['enzo', 'dora', 'clover', 'nutmeg', 'thistle'], 12);
  assert.equal(g.chapters, 0); assert.equal(g.heroes.pip, undefined);
  const { loot } = win(g, 9);
  assert.equal(loot.joined, 'pip', 'Pip joins when the first chapter falls'); assert.ok(g.heroes.pip); assert.equal(g.chapters, 1);
  assert.equal(win(g, 9).loot.joined, null, 'and only once');

  const fresh = saga(0);
  assert.equal(fresh.levelCost('dora'), LEVEL_COST);
  fresh.gold = 1e9;
  assert.equal(fresh.levelSquad(), 5 * (BASE_CAP - 1), 'gold raises everyone to the cap and no further');
  assert.equal(fresh.heroes.dora.level, BASE_CAP); assert.equal(fresh.canLevel('dora'), false);
  assert.equal(fresh.levelCost('dora'), Math.round(LEVEL_COST * LEVEL_COST_GROWTH ** (BASE_CAP - 1)));
  const poor = saga(0); poor.gold = LEVEL_COST * 2 + 5;
  assert.equal(poor.levelSquad(), 2, 'it spends what there is, lowest level first'); assert.ok(poor.gold < LEVEL_COST);
  assert.equal(poor.levelUp('dora'), false);

  const s = saga(0);
  assert.equal(s.canStar('dora'), false);
  s.heroes.dora.shards = STAR_COST[1] + STAR_COST[2];
  assert.ok(s.starUp('dora') && s.starUp('dora')); assert.equal(s.heroes.dora.stars, 3); assert.equal(s.heroes.dora.shards, 0); assert.equal(s.starUp('dora'), false);
  s.heroes.dora.stars = MAX_STARS; s.heroes.dora.shards = 9999; assert.equal(s.starUp('dora'), false, 'five stars is the most');
}

// Summons: odds, the guarantee, repeats, and the same save summoning the same heroes
{
  near(ODDS[1] + ODDS[2] + ODDS[3], 1, 'the odds add up');
  const g = new Game(7); g.scrolls = 3000;
  const got = { 1: 0, 2: 0, 3: 0 }; let dry = 0, longest = 0, repeats = 0;
  for (let i = 0; i < 3000; i++) {
    const s = g.summon(), r = heroById(s.id).rarity; got[r]++;
    if (r === 3) dry = 0; else longest = Math.max(longest, ++dry);
    if (!s.fresh) { repeats++; assert.equal(s.shards, DUP_SHARDS); }
    assert.ok(heroById(s.id).from !== 'story', 'story heroes cannot be summoned before they join');
  }
  assert.ok(longest <= PITY - 1, `a legendary within every ${PITY} summons (longest wait ${longest})`);
  assert.ok(got[1] > got[2] && got[2] > got[3], 'rare heroes are the common ones');
  assert.ok(got[3] / 3000 > ODDS[3], 'the guarantee lifts the legendary rate above the bare odds');
  assert.equal(g.owned.length, 12, 'all ten summoned heroes, with Dora and Enzo'); assert.equal(repeats, 2990);
  assert.ok(g.heroes.dora.shards > 0, 'Dora and Enzo can turn up again and earn shards');

  const a = new Game(99), b = new Game(99), c = new Game(100);
  a.scrolls = b.scrolls = c.scrolls = 20;
  const pull = (x) => Array.from({ length: 20 }, () => x.summon().id);
  const first = pull(a);
  assert.deepEqual(pull(b), first, 'the same save summons the same heroes'); assert.notDeepEqual(pull(c), first);
  const j = saga(10); j.heroes.pip = owned(); j.scrolls = 400; const seen = new Set(); for (let i = 0; i < 400; i++) seen.add(j.summon().id);
  assert.ok(seen.has('pip') && !seen.has('mossy'), 'a story hero who has joined can come up again; one who has not cannot');
}

// Gear
{
  const g = saga(0);
  assert.equal(g.equip('dora', 0, 1), false, 'nothing in the bag');
  g.bag[0][1] = 3; g.bag[0][2] = 1; g.bag[1][3] = 1;
  assert.equal(g.equip('dora', 0, 1), true); assert.equal(g.heroes.dora.gear[0], 1); assert.equal(g.bag[0][1], 2);
  assert.equal(g.equip('dora', 0, 2), true); assert.equal(g.bag[0][1], 3, 'the old piece goes back in the bag'); assert.equal(g.bag[0][2], 0);
  assert.equal(g.merge(0, 1), true); assert.equal(g.bag[0][1], 0); assert.equal(g.bag[0][2], 1, `${MERGE} pieces forge into one of the next tier`);
  assert.equal(g.merge(0, 1), false); g.bag[2][MAX_TIER] = 5; assert.equal(g.merge(2, MAX_TIER), false, 'the top tier cannot be forged further');
  assert.equal(g.equipBest('enzo'), 3, 'weapon, armour and charm'); assert.deepEqual(g.heroes.enzo.gear, [2, 3, MAX_TIER, 0]);
  assert.equal(g.equipBest('enzo'), 0); assert.equal(GEAR.length, 4);
  assert.equal(g.equip('nobody', 0, 1), false); assert.equal(g.equip('dora', 9, 1), false); assert.equal(g.equip('dora', 0, 0), false);
}

// Arranging the squad
{
  const g = saga(0, ['enzo', 'dora', 'pip']);
  assert.deepEqual(g.squad, ['enzo', 'dora', 'pip', null, null]);
  assert.equal(g.place('pip', 0), true); assert.deepEqual(g.squad, ['pip', 'dora', 'enzo', null, null], 'two fielded heroes swap places');
  assert.equal(g.place('pip', 4), true); assert.deepEqual(g.squad, [null, 'dora', 'enzo', null, 'pip']);
  assert.equal(g.place('pip', 4), false); assert.equal(g.place('mossy', 0), false, 'a hero must be owned'); assert.equal(g.place('pip', 7), false);
  assert.equal(g.bench(4), true); assert.equal(g.bench(4), false); assert.equal(g.bench(1), true); assert.equal(g.bench(2), false, 'someone has to stay');
  for (const id of ['mossy', 'bramble', 'flint', 'onyx', 'frost']) g.heroes[id] = owned();
  g.autoSquad();
  assert.equal(g.squad.filter(Boolean).length, SLOTS); assert.equal(new Set(g.squad).size, SLOTS);
  const roles = g.squad.map((id) => heroById(id).role);
  assert.ok(roles.includes('guard') && roles.includes('healer'), 'the auto squad always brings a guard and a healer');
  assert.ok(g.squad.slice(0, 2).every((id) => !ROLES[heroById(id).role].ranged), 'with fighters in front');
  assert.ok(g.squad.includes('onyx'), 'and the strongest hero in it');
}

// Chapter chests, the tower and the camp
{
  const g = saga(0);
  assert.equal(g.chestReady(0), false); assert.equal(g.claimChest(0), 0);
  for (let i = 0; i < 10; i++) g.stars[i] = 2;
  assert.equal(g.chapterStars(0), 20); assert.equal(g.totalStars, 20);
  const scrolls = g.scrolls;
  assert.equal(g.claimChest(0), CHEST_SCROLLS[0]); assert.equal(g.claimChest(0), CHEST_SCROLLS[1]); assert.equal(g.claimChest(0), 0, 'the third chest needs thirty stars');
  assert.equal(g.scrolls, scrolls + CHEST_SCROLLS[0] + CHEST_SCROLLS[1]);
  for (let i = 0; i < 10; i++) g.stars[i] = 3;
  assert.equal(g.claimChest(0), CHEST_SCROLLS[2]); assert.equal(g.chestReady(0), false); assert.equal(CHEST_STARS.length, CHEST_SCROLLS.length);

  const t = saga(STAGES, ['enzo', 'onyx', 'pip', 'aurora', 'zephyr'], 75);
  for (const id of t.squad) { t.heroes[id].stars = 5; t.heroes[id].gear = [5, 5, 5, 5]; }
  assert.ok(t.complete && t.unlocked(STAGES) && !t.unlocked(STAGES + 1), 'the tower opens one floor at a time'); assert.equal(saga(STAGES - 1).unlocked(STAGES), false);
  assert.equal(t.canAuto(STAGES), false);
  for (let f = 1; f <= TOWER_EVERY; f++) {
    const { loot } = win(t, STAGES + f - 1);
    assert.equal(t.tower, f); assert.equal(loot.scrolls, f % TOWER_EVERY === 0 ? TOWER_SCROLLS : 0); assert.equal(loot.first, true);
  }
  assert.equal(t.cap, BASE_CAP + STAGES + TOWER_EVERY, 'tower floors keep raising the level cap');

  const c = new Game(3, 1000);
  assert.equal(c.camp(1000 + HOUR), 0, 'the camp is empty until the first stage is cleared');
  c.stars[0] = 1; c.stars[1] = 1;
  assert.equal(c.camp(1000 + HOUR), CAMP_RATE * goldFor(1)); assert.equal(c.camp(1000 + HOUR / 2), Math.floor(CAMP_RATE * goldFor(1) / 2));
  assert.equal(c.camp(1000 + 99 * HOUR), CAMP_HOURS * CAMP_RATE * goldFor(1), 'it stops filling after four hours'); assert.equal(c.camp(5), 0, 'a clock set back earns nothing');
  const gold = c.gold;
  assert.equal(c.claimCamp(1000 + 2 * HOUR), 2 * CAMP_RATE * goldFor(1)); assert.equal(c.gold, gold + 2 * CAMP_RATE * goldFor(1)); assert.equal(c.campAt, 1000 + 2 * HOUR);
  assert.equal(c.claimCamp(1000 + 2 * HOUR), 0);
}

// Saving
{
  const g = play(5, { battles: 40 }).g;
  const data = JSON.parse(JSON.stringify(g.save()));
  assert.equal(data.v, SAVE_VERSION);
  const back = Game.load(data);
  assert.ok(back); assert.deepEqual(back.save(), g.save(), 'a save comes back whole');
  assert.equal(back.battle, null);
  // The reloaded saga carries on exactly as the original would.
  g.scrolls = back.scrolls = 5;
  assert.deepEqual(Array.from({ length: 5 }, () => back.summon().id), Array.from({ length: 5 }, () => g.summon().id));
  g.start(g.cleared); back.start(back.cleared);
  assert.equal(fight(back).time, fight(g).time, 'and fights the next battle the same way');

  const bad = (change, why) => { const d = JSON.parse(JSON.stringify(data)); change(d); assert.equal(Game.load(d), null, why); };
  assert.equal(Game.load(null), null); assert.equal(Game.load('saga'), null); assert.equal(Game.load({}), null);
  bad((d) => { d.v = SAVE_VERSION + 1; }, 'another version');
  bad((d) => { d.gold = -1; }, 'negative gold'); bad((d) => { d.gold = 1.5; }, 'fractional gold'); bad((d) => { d.scrolls = '3'; }, 'scrolls as text');
  bad((d) => { d.stars.pop(); }, 'a short star list'); bad((d) => { d.stars[3] = 4; }, 'four stars');
  bad((d) => { d.stars = Array(STAGES).fill(0); d.stars[5] = 2; }, 'a cleared stage beyond an uncleared one');
  bad((d) => { delete d.heroes.dora; }, 'no Dora'); bad((d) => { d.heroes.gandalf = d.heroes.dora; }, 'an unknown hero');
  bad((d) => { d.heroes.dora.level = 0; }, 'level zero'); bad((d) => { d.heroes.dora.stars = 6; }, 'six stars'); bad((d) => { d.heroes.dora.gear = [1, 2]; }, 'two gear slots');
  bad((d) => { d.heroes.enzo.gear[0] = MAX_TIER + 1; }, 'gear above the top tier');
  bad((d) => { d.squad = [null, null, null, null, null]; }, 'an empty squad'); bad((d) => { d.squad[0] = 'dora'; d.squad[1] = 'dora'; }, 'one hero twice');
  bad((d) => { d.squad = ['dora']; }, 'a short squad'); bad((d) => { d.squad[0] = 'mossy'; delete d.heroes.mossy; }, 'a fielded hero who is not owned');
  bad((d) => { d.bag[0] = [0]; }, 'a short bag row'); bad((d) => { d.bag[1][2] = -3; }, 'negative gear'); bad((d) => { d.chests[0] = 4; }, 'four chests');
  bad((d) => { d.pity = PITY; }, 'a guarantee already overdue'); bad((d) => { d.campAt = 'now'; }, 'a camp time as text'); bad((d) => { d.seed = -1; }, 'a negative seed');
}

// The bot, briefly: it plays the same way twice and gets somewhere
{
  const a = play(2, { battles: 30 }), b = play(2, { battles: 30 });
  assert.equal(a.g.cleared, b.g.cleared); assert.equal(a.g.gold, b.g.gold); assert.deepEqual(a.g.save(), b.g.save(), 'a seed replays a whole campaign');
  assert.ok(a.g.cleared >= 15, `thirty fights clear at least fifteen stages (${a.g.cleared})`);
  assert.ok(Array.isArray(timed(a.g.battle ?? (a.g.start(0), a.g.battle))));
  assert.ok(rng(1)() !== rng(2)());
}

console.log(`PASS Whisker Saga: ${HEROES.length} heroes in three factions, levels, stars, gear and the faction bonus, ${STAGES} stages and the tower, marching and basic attacks, eight kinds of skill, wind-ups and interrupts, targeting, stars, loot, story heroes, summons and the guarantee, the forge, squad arranging, chapter chests, the camp, saving and bad saves`);
