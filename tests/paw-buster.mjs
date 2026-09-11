import assert from 'node:assert/strict';
import { PawBusterGame, buildStage, parseProgress, saveProgress, unlocked, weaponsFor, maxHp, freshProgress, STAGES, MAVERICKS, TILE, ROWS, PHYS, CHARGE, NO_INPUT, HERO } from '../.checks/paw-buster-game.js';

const DT = 1 / 120;
const hold = (g, input, seconds) => { for (let i = 0; i < Math.round(seconds / DT); i++) g.step(DT, { ...NO_INPUT, ...input }); };
const tap = (g, key, extra = {}) => { g.step(DT, { ...NO_INPUT, ...extra, [key]: true }); g.step(DT, { ...NO_INPUT, ...extra }); };
const play = (stage = 'snowcap', progress) => { const g = new PawBusterGame(stage, progress); hold(g, {}, 1.3); assert.equal(g.state, 'play'); return g; };
/** Empty the level around the hero: flat ground three tiles tall, no enemies, no items. */
const flat = (g) => {
  for (let c = 0; c < g.map.cols; c++) for (let r = 0; r < ROWS; r++) g.tiles[c * ROWS + r] = r >= ROWS - 3 ? 1 : 0;
  g.enemies = []; g.items = [];
  Object.assign(g.player, { x: 10 * TILE, y: (ROWS - 3) * TILE - HERO.h, vx: 0, vy: 0, ground: true });
  return g;
};
let cases = 0;
const test = (name, fn) => { fn(); cases++; };

test('every stage builds with a start, checkpoints, an arena and passable geometry', () => {
  for (const s of STAGES) {
    const m = buildStage(s.id);
    assert.equal(m.tiles.length, m.cols * ROWS);
    assert.ok(m.checkpoints.length >= 2, `${s.id} checkpoints`);
    assert.ok(m.arena > 40 && m.cols === m.arena + 32, `${s.id} arena is one screen at the end`);
    const top = (c) => { for (let r = 0; r < ROWS; r++) if (m.tiles[c * ROWS + r]) return ROWS - r; return 0; };
    let pit = 0;
    for (let c = 0; c < m.arena; c++) {
      if (top(c) === 0) { pit++; continue; }
      assert.ok(pit <= 3 || pit === 5 || [...Array(pit)].some((_, i) => m.tiles.slice((c - pit + i) * ROWS, (c - pit + i + 1) * ROWS).some((t) => t)), `${s.id} pit before column ${c} is ${pit} wide with no ledge`);
      pit = 0;
    }
    assert.ok(m.items.filter((i) => i.kind === 'tank').length === (s.id === 'citadel' ? 0 : 1), `${s.id} heart tanks`);
  }
});

test('running, jumping and variable jump height', () => {
  const g = flat(play());
  const x0 = g.player.x;
  hold(g, { right: true }, 1);
  assert.ok(Math.abs(g.player.x - x0 - PHYS.run) < 3, `ran ${g.player.x - x0}`);
  const floor = g.player.y;
  let apex = floor;
  g.step(DT, { ...NO_INPUT, jump: true });
  for (let i = 0; i < 120; i++) { g.step(DT, { ...NO_INPUT, jump: true }); apex = Math.min(apex, g.player.y); }
  assert.ok(floor - apex > 80 && floor - apex < 95, `full jump rose ${floor - apex}px`);
  assert.ok(g.player.ground);
  apex = floor;
  tap(g, 'jump');
  for (let i = 0; i < 120; i++) { g.step(DT, NO_INPUT); apex = Math.min(apex, g.player.y); }
  assert.ok(floor - apex < 30, `a tapped jump is short (${floor - apex}px)`);
});

test('dash and dash jump cover twice the ground', () => {
  const g = flat(play());
  let x0 = g.player.x;
  hold(g, { right: true, dash: true }, PHYS.dashTime);
  assert.ok(g.player.x - x0 > 120, `dash covered ${g.player.x - x0}`);
  hold(g, {}, 0.3);
  x0 = g.player.x;
  g.step(DT, { ...NO_INPUT, right: true, dash: true });
  g.step(DT, { ...NO_INPUT, right: true, dash: true, jump: true });
  let t = 0;
  while (!g.player.ground || t < 0.1) { g.step(DT, { ...NO_INPUT, right: true, dash: true, jump: true }); t += DT; }
  assert.ok(g.player.x - x0 > 5 * TILE + HERO.w, `dash jump cleared ${(g.player.x - x0) / TILE} tiles`);
});

test('wall slide caps the fall and wall jumps climb a sheer face', () => {
  const g = flat(play());
  for (let r = 0; r < ROWS; r++) g.tiles[14 * ROWS + r] = 1;
  Object.assign(g.player, { x: 14 * TILE - HERO.w - 0.5, y: 100, vy: 0, ground: false });
  hold(g, { right: true }, 0.8);
  assert.equal(g.player.slide, 1);
  assert.ok(g.player.vy <= PHYS.slide);
  // Climb a nine-tile wall by jumping whenever the wall is touched.
  flat(g);
  for (let c = 14; c < 20; c++) for (let r = ROWS - 12; r < ROWS; r++) g.tiles[c * ROWS + r] = 1;
  Object.assign(g.player, { x: 12 * TILE, y: (ROWS - 3) * TILE - HERO.h });
  let jump = false;
  for (let i = 0; i < 120 * 8 && g.player.x < 15 * TILE; i++) { jump = !jump && (g.player.ground || g.player.slide !== 0 || g.player.vy > -40); g.step(DT, { ...NO_INPUT, right: true, jump }); }
  assert.ok(g.player.x >= 14 * TILE && g.player.y < (ROWS - 12) * TILE, 'reached the top of a nine-tile wall');
});

test('Dora charges her buster through two levels', () => {
  const g = flat(play());
  tap(g, 'fire');
  assert.deepEqual(g.shots.map((s) => [s.kind, s.dmg]), [['lemon', 1]]);
  g.shots = [];
  hold(g, { fire: true }, CHARGE.mid + 0.05);
  assert.equal(g.chargeLevel, 1);
  g.shots = [];
  g.step(DT, NO_INPUT);
  assert.deepEqual(g.shots.map((s) => [s.kind, s.dmg]), [['mid', 2]]);
  hold(g, { fire: true }, CHARGE.full + 0.05);
  assert.ok(g.events.includes('charge2'));
  g.shots = [];
  g.step(DT, NO_INPUT);
  assert.deepEqual(g.shots.map((s) => [s.kind, s.dmg, s.pierce]), [['full', 4, true]]);
  // Tapping fire ten times a second fires every time.
  hold(g, {}, 1);
  g.events = [];
  for (let i = 0; i < 240; i++) g.step(DT, { ...NO_INPUT, fire: i % 12 < 6 });
  const fired = g.events.filter((e) => e === 'shot').length;
  assert.ok(fired >= 18, `20 taps fired ${fired} shots`);
});

test('tagging Enzo in swaps weapons, adds a tag strike and his saber cuts enemy shots', () => {
  const g = flat(play());
  tap(g, 'swap');
  assert.equal(g.hero, 'enzo');
  assert.ok(g.player.tagT > 1.9);
  g.enemies = [{ id: 99, kind: 'turret', x: g.player.x + 30, y: g.player.y, w: 26, h: 28, vx: 0, vy: 0, hp: 9, face: -1, t: 0, flash: 0, slash: -1, x0: 0, y0: 0, mode: 0, alive: true, ground: true }];
  tap(g, 'fire');
  assert.ok(g.enemies[0].hp < 9 - 3, 'the slash deals tag-strike damage');
  g.enemies = [];
  hold(g, {}, 0.4);
  g.shots.push({ x: g.player.x + 40, y: g.player.y + 10, vx: -100, vy: 0, r: 6, dmg: 2, kind: 'pellet', hero: false, life: 3, pierce: false, hits: [], grav: 0, weapon: null });
  tap(g, 'fire');
  hold(g, {}, 0.1);
  assert.equal(g.shots.length, 0);
  assert.ok(g.events.includes('deflect'));
  assert.equal(g.hp.enzo, g.max);
  hold(g, {}, 0.9);
  tap(g, 'swap');
  assert.equal(g.hero, 'dora');
});

test('damage, invulnerability, a forced tag when one hero falls, and defeat when both do', () => {
  const g = flat(play());
  g.hurt(5, g.player.x + 100);
  assert.equal(g.hp.dora, g.max - 5);
  g.hurt(5, g.player.x + 100);
  assert.equal(g.hp.dora, g.max - 5, 'invulnerable after a hit');
  hold(g, {}, 1.1);
  g.hurt(99, 0);
  assert.equal(g.hero, 'enzo', 'Enzo tags in when Dora is down');
  assert.equal(g.hp.dora, 0);
  tap(g, 'swap');
  assert.equal(g.hero, 'enzo', 'cannot tag a fallen partner');
  hold(g, {}, 1.6);
  g.hurt(99, 0);
  assert.equal(g.state, 'lost');
  g.retry();
  assert.equal(g.state, 'ready');
  assert.deepEqual([g.hp.dora, g.hp.enzo], [g.max, g.max]);
});

test('pits cost health and return the hero to safe ground; spikes hurt and bounce', () => {
  const g = flat(play());
  hold(g, {}, 0.2);
  const safe = { ...g.player.safe };
  for (let c = 11; c < 30; c++) for (let r = 0; r < ROWS; r++) g.tiles[c * ROWS + r] = 0;
  g.events = [];
  for (let i = 0; i < 120 * 3 && !g.events.includes('fall'); i++) g.step(DT, { ...NO_INPUT, right: true });
  hold(g, {}, 0.3);
  assert.ok(g.events.includes('fall'));
  assert.equal(g.hp.dora, g.max - 6);
  assert.ok(g.player.x <= 11 * TILE && g.player.ground, `back on safe ground (was ${safe.x})`);
  flat(g);
  hold(g, {}, 1.3);
  g.tiles[11 * ROWS + ROWS - 3] = 2;
  hold(g, { right: true }, 0.5);
  assert.equal(g.hp.dora, g.max - 12);
});

test('enemies take damage, die and drop pickups on a schedule', () => {
  const g = flat(play());
  const e = (id) => ({ id, kind: 'beetle', x: g.player.x + 60, y: g.player.y + 10, w: 24, h: 20, vx: 0, vy: 0, hp: 3, face: -1, t: 0, flash: 0, slash: -1, x0: 0, y0: 0, mode: 0, alive: true, ground: true });
  for (let k = 1; k <= 3; k++) {
    g.enemies = [e(k)];
    for (let i = 0; i < 3; i++) { tap(g, 'fire'); hold(g, {}, 0.2); }
    assert.equal(g.enemies.length, 0, `beetle ${k} down`);
  }
  assert.equal(g.kills, 3);
  assert.equal(g.items.filter((i) => i.kind === 'hp').length, 1);
});

test('reaching the arena seals the gate and starts the boss intro', () => {
  const g = play();
  const m = g.map;
  Object.assign(g.player, { x: (m.arena - 2) * TILE, y: (ROWS - 3) * TILE - HERO.h, vy: 0 });
  g.enemies = [];
  for (let i = 0; i < 120 && !g.fight; i++) g.step(DT, { ...NO_INPUT, right: true });
  assert.equal(g.fight, true);
  assert.equal(g.state, 'boss');
  assert.equal(g.tile(m.arena, 2), 1, 'gate sealed');
  assert.ok(g.events.includes('warning'));
  assert.equal(g.checkpoint, m.checkpoints.length - 1, 'the boss door is the last checkpoint');
  hold(g, {}, 2.3);
  assert.equal(g.state, 'play');
  assert.ok(Math.abs(g.camX - m.arena * TILE) < 1, 'camera locked to the arena');
});

const toBoss = (stage, progress) => {
  const g = play(stage, progress);
  Object.assign(g.player, { x: (g.map.arena + 2) * TILE, y: (ROWS - 3) * TILE - HERO.h, vy: 0 });
  g.enemies = [];
  hold(g, {}, 2.4);
  assert.equal(g.state, 'play');
  return g;
};
test('each maverick is weak to one weapon, which does triple damage and flinches it', () => {
  const all = { cleared: [...MAVERICKS], tanks: [], best: {} };
  const weak = STAGES.filter((s) => s.weakness);
  assert.equal(weak.length, 6);
  assert.deepEqual(new Set(weak.map((s) => s.weakness)), new Set(weak.map((s) => s.weapon)), 'every maverick weapon counters another maverick');
  for (const s of weak) {
    const g = toBoss(s.id, all);
    const b = g.boss;
    g.weapon = g.weapons.indexOf(s.weakness);
    b.hidden = false;
    g.shots.push({ x: b.x + b.w / 2, y: b.y + b.h / 2, vx: 0, vy: 0, r: 8, dmg: 2, kind: s.weakness, hero: true, life: 1, pierce: false, hits: [], grav: 0, weapon: s.weakness });
    g.step(DT, NO_INPUT);
    assert.equal(b.max - b.hp, 6, `${s.bossName} weak to ${s.weakness}`);
    assert.ok(b.flinch > 0);
  }
});

test('beating a boss clears the stage, grants its weapon and records the best time', () => {
  const g = toBoss('snowcap');
  g.boss.hp = 1;
  g.boss.hidden = false;
  g.shots.push({ x: g.boss.x + 10, y: g.boss.y + 10, vx: 0, vy: 0, r: 8, dmg: 1, kind: 'lemon', hero: true, life: 1, pierce: false, hits: [], grav: 0, weapon: 'buster' });
  g.step(DT, NO_INPUT);
  assert.equal(g.state, 'clearing');
  hold(g, {}, 2.6);
  assert.equal(g.state, 'clear');
  assert.deepEqual(g.progress.cleared, ['snowcap']);
  assert.ok(g.progress.best.snowcap > 0);
  assert.deepEqual(weaponsFor(g.progress), ['buster', 'frost']);
  assert.ok(g.banner.text.includes('FROST SHARD'));
});

test('special weapons spend energy and behave differently', () => {
  const g = flat(play('snowcap', { cleared: ['snowcap', 'cloud', 'caldera'], tanks: [], best: {} }));
  tap(g, 'next');
  assert.equal(g.weaponId, 'frost');
  tap(g, 'fire');
  assert.deepEqual(g.shots.map((s) => [s.kind, s.pierce]), [['frost', true]]);
  assert.equal(g.energy.frost, 26);
  hold(g, {}, 0.4); tap(g, 'next'); g.shots = []; tap(g, 'fire');
  assert.equal(g.shots.length, 3, 'three gale feathers');
  hold(g, {}, 0.4); tap(g, 'next'); g.shots = []; tap(g, 'fire');
  hold(g, {}, 0.6);
  const ember = g.shots.find((s) => s.kind === 'ember');
  assert.ok(ember && ember.vy === 0 && Math.abs(ember.vx) === 260, 'ember lands and rolls');
  tap(g, 'prev');
  assert.equal(g.weaponId, 'gale');
  g.energy.gale = 1; g.shots = []; hold(g, {}, 0.4); tap(g, 'fire');
  assert.equal(g.shots.length, 0, 'no energy, no shot');
});

test('quartz orbit circles and blocks, volt spark homes, bubbles float up', () => {
  const g = flat(play('snowcap', { cleared: [...MAVERICKS], tanks: [], best: {} }));
  g.weapon = g.weapons.indexOf('quartz');
  tap(g, 'fire');
  const orbs = g.shots.filter((s) => s.kind === 'quartz');
  assert.equal(orbs.length, 3);
  hold(g, {}, 0.4);
  tap(g, 'fire');
  assert.equal(g.shots.filter((s) => s.kind === 'quartz').length, 3, 'one ring at a time');
  const cx = g.player.x + g.player.w / 2, cy = g.player.y + g.player.h / 2;
  for (const s of orbs) assert.ok(Math.abs(Math.hypot(s.x - cx, s.y - cy) - 34) < 1, 'crystals orbit the hero');
  const o = orbs[0];
  g.shots.push({ x: o.x, y: o.y, vx: 0, vy: 0, r: 6, dmg: 2, kind: 'pellet', hero: false, life: 3, pierce: false, hits: [], grav: 0, weapon: null });
  g.step(DT, NO_INPUT);
  assert.ok(!g.shots.some((s) => s.kind === 'pellet') && g.events.includes('deflect'));
  assert.equal(g.hp.dora, g.max);
  hold(g, {}, 3);
  assert.equal(g.shots.filter((s) => s.kind === 'quartz').length, 0, 'the ring fades after 3 seconds');

  g.weapon = g.weapons.indexOf('volt');
  g.enemies = [{ id: 7, kind: 'bat', x: g.player.x + 200, y: g.player.y - 120, w: 24, h: 18, vx: 0, vy: 0, hp: 9, face: -1, t: 0, flash: 0, slash: -1, x0: g.player.x + 200, y0: g.player.y - 120, mode: 0, alive: true, ground: false }];
  tap(g, 'fire');
  hold(g, {}, 0.2);
  assert.ok(g.shots.find((s) => s.kind === 'volt').vy < -50, 'the spark curves up toward the bat');
  hold(g, {}, 0.8);
  assert.ok(g.enemies[0].hp < 9, 'the spark found its target');

  g.enemies = []; g.shots = [];
  g.weapon = g.weapons.indexOf('bubble');
  hold(g, {}, 0.4);
  tap(g, 'fire');
  const y0 = g.shots.map((s) => s.y);
  hold(g, {}, 0.5);
  assert.equal(g.shots.length, 2);
  g.shots.forEach((s, i) => assert.ok(s.y < y0[i] - 20, 'bubbles rise'));
});

test('hoppers hop toward the heroes but not off ledges', () => {
  const g = flat(play());
  g.enemies = [{ id: 5, kind: 'hopper', x: g.player.x + 200, y: g.player.y + 12, w: 22, h: 18, vx: 0, vy: 0, hp: 3, face: -1, t: 0, flash: 0, slash: -1, x0: 0, y0: 0, mode: 0, alive: true, ground: false }];
  const x0 = g.enemies[0].x;
  let rose = false;
  for (let i = 0; i < 120 * 2.2; i++) { g.step(DT, NO_INPUT); rose ||= g.enemies[0].y < g.player.y - 20; g.hp.dora = g.max; }
  assert.ok(rose && g.enemies[0].x < x0 - 40, 'hopped toward Dora');
  // With a pit ahead it stays put.
  flat(g);
  for (let c = 13; c < 20; c++) for (let r = 0; r < ROWS; r++) g.tiles[c * ROWS + r] = 0;
  g.enemies = [{ id: 6, kind: 'hopper', x: 20 * TILE + 4, y: (ROWS - 3) * TILE - 18, w: 22, h: 18, vx: 0, vy: 0, hp: 3, face: -1, t: 0, flash: 0, slash: -1, x0: 0, y0: 0, mode: 0, alive: true, ground: true }];
  hold(g, {}, 3);
  assert.equal(g.enemies.length, 1);
  assert.ok(Math.abs(g.enemies[0].x - (20 * TILE + 4)) < 1);
});

test('a rolling Quartz Armadillo deflects shots, except Volt Spark, which knocks it out of the roll', () => {
  const g = toBoss('mines');
  const b = g.boss;
  Object.assign(b, { move: 'roll', t: 1, fired: 0 });
  const hitWith = (kind, weapon) => { b.inv = 0; g.shots.push({ x: b.x + b.w / 2, y: b.y + b.h / 2, vx: 0, vy: 0, r: 8, dmg: 2, kind, hero: true, life: 1, pierce: false, hits: [], grav: 0, weapon }); g.step(DT, NO_INPUT); };
  hitWith('lemon', 'buster');
  assert.equal(b.hp, b.max, 'the buster bounces off');
  assert.ok(g.events.includes('deflect'));
  hitWith('volt', 'volt');
  assert.equal(b.max - b.hp, 6);
  assert.notEqual(b.move, 'roll');
});

test('heart tanks raise both heroes’ maximum health once', () => {
  const g = play();
  const tank = g.items.find((i) => i.kind === 'tank');
  Object.assign(g.player, { x: tank.x - 10, y: tank.y - 15 });
  g.step(DT, NO_INPUT);
  assert.deepEqual(g.progress.tanks, ['snowcap']);
  assert.equal(g.max, HERO.hp + 2);
  assert.equal(new PawBusterGame('snowcap', g.progress).items.filter((i) => i.kind === 'tank').length, 0);
  assert.equal(maxHp({ ...freshProgress(), tanks: ['snowcap', 'cloud', 'caldera'] }), 22);
});

test('bosses run their patterns without leaving the arena, and hurt the heroes', () => {
  for (const s of STAGES) {
    const g = toBoss(s.id);
    const lo = (g.map.arena + 1) * TILE, hi = (g.map.arena + 31) * TILE;
    const moves = new Set();
    for (let i = 0; i < 120 * 25 && g.state === 'play'; i++) {
      // Keep the heroes alive so the whole pattern plays out.
      g.hp.dora = g.hp.enzo = g.max;
      g.step(DT, NO_INPUT);
      moves.add(g.boss.move);
      assert.ok(g.boss.x >= lo - 1 && g.boss.x + g.boss.w <= hi + 1, `${s.bossName} stays inside the arena`);
    }
    assert.ok(moves.size >= 4, `${s.bossName} used ${[...moves].join(', ')}`);
    assert.ok(g.events.includes('hurt'), `${s.bossName} can hurt`);
  }
});

test('progress saves round-trip and the citadel opens after three mavericks', () => {
  const p = { cleared: ['snowcap', 'cloud'], tanks: ['cloud'], best: { snowcap: 91.2 } };
  assert.deepEqual(parseProgress(saveProgress(p)), p);
  assert.deepEqual(parseProgress('{"version":1,"cleared":["moon",3],"tanks":["citadel"],"best":{"cloud":-1}}'), freshProgress());
  assert.deepEqual(parseProgress('not json'), freshProgress());
  assert.deepEqual(parseProgress(null), freshProgress());
  assert.equal(unlocked(p, 'citadel'), false);
  assert.equal(unlocked({ ...p, cleared: ['snowcap', 'cloud', 'caldera'] }, 'citadel'), false, 'three mavericks are no longer enough');
  assert.equal(unlocked({ ...p, cleared: [...MAVERICKS] }, 'citadel'), true);
  assert.equal(unlocked({ ...p, cleared: ['snowcap', 'cloud', 'caldera', 'citadel'] }, 'citadel'), true, 'a citadel already beaten stays open');
  assert.deepEqual(parseProgress(saveProgress({ cleared: ['mines', 'lake'], tanks: ['salt'], best: { lake: 70 } })), { cleared: ['mines', 'lake'], tanks: ['salt'], best: { lake: 70 } });
});

test('runs are deterministic', () => {
  const run = () => { const g = play('cloud'); for (let i = 0; i < 120 * 12; i++) g.step(DT, { ...NO_INPUT, right: true, jump: i % 50 < 30, fire: i % 20 === 0, dash: i % 90 < 40 }); return JSON.stringify([g.player.x, g.player.y, g.hp, g.kills, g.enemies.length]); };
  assert.equal(run(), run());
});

console.log(`Paw Buster X: ${cases} cases passed (stages, movement, dash jump, wall climb, charge shot, tag team, saber deflect, damage and defeat, pits and spikes, drops, boss door, weaknesses, clear, weapons, quartz orbit, volt homing, bubbles, hoppers, armadillo roll, heart tanks, boss patterns, saves, determinism).`);
