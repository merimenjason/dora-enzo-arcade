import assert from 'node:assert/strict';
import { PawBusterGame, buildStage, partsOf, parseProgress, saveProgress, exportCode, importCode, unlocked, weaponsFor, maxHp, freshProgress, changesFor, inputMask, unmask, encodeRun, decodeRun, rankFor, medalFor, weaponDemo, demoInput, STAGES, MAVERICKS, SUB_STAGES, RUSH, TILE, ROWS, PHYS, CHARGE, CRUSH_PERIOD, NO_INPUT, HERO, T, TARGETS, REVIVE, HARD_HP, GUARDIAN_HP } from '../.checks/paw-buster-game.js';

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

test('every stage builds with a start, checkpoints, an arena or teleporter and passable geometry', () => {
  for (const s of STAGES) {
    const parts = partsOf(s.id);
    let tanks = 0, subs = 0;
    for (let part = 0; part < parts; part++) {
      const m = buildStage(s.id, part), last = part === parts - 1;
      assert.equal(m.tiles.length, m.cols * ROWS);
      assert.ok(m.checkpoints.length >= 2, `${s.id} sector ${part + 1} checkpoints`);
      if (last) assert.ok(m.arena > 40 && m.cols === m.arena + 32 && m.exit < 0, `${s.id} arena is one screen at the end`);
      else assert.ok(m.exit > 40 && m.cols === m.exit + 7 && m.arena < 0, `${s.id} sector ${part + 1} ends in a teleporter`);
      const top = (c) => { for (let r = 0; r < ROWS; r++) if (m.tiles[c * ROWS + r]) return ROWS - r; return 0; };
      let pit = 0;
      for (let c = 0; c < (last ? m.arena : m.exit); c++) {
        if (top(c) === 0) { pit++; continue; }
        const from = c - pit;
        const ledge = [...Array(pit)].some((_, i) => m.tiles.slice((from + i) * ROWS, (from + i + 1) * ROWS).some((t) => t));
        const platform = m.platforms.some((p) => p.x < c * TILE && p.x + p.w > from * TILE);
        assert.ok(pit <= 3 || pit === 5 || ledge || platform, `${s.id} pit before column ${c} is ${pit} wide with no ledge or platform`);
        pit = 0;
      }
      tanks += m.items.filter((i) => i.kind === 'tank').length;
      subs += m.items.filter((i) => i.kind === 'sub').length;
    }
    assert.equal(tanks, s.id === 'citadel' ? 0 : 1, `${s.id} heart tanks`);
    assert.equal(subs, SUB_STAGES.includes(s.id) ? 1 : 0, `${s.id} sub-tanks`);
  }
  assert.equal(partsOf('citadel'), 3);
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

const toBoss = (stage, progress, setup = () => {}) => {
  const g = play(stage, progress);
  setup(g);
  if (partsOf(stage) > 1) { g.enterPart(partsOf(stage) - 1); hold(g, {}, 1.3); }
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

const all = () => ({ ...freshProgress(), cleared: [...MAVERICKS] });
const pellet = (b, dmg = 2) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2, vx: 0, vy: 0, r: 6, dmg, kind: 'pellet', hero: false, life: 3, pierce: false, hits: [], grav: 0, weapon: null });
const foe = (kind, x, y, hp) => ({ id: 900 + Math.round(x), kind, x, y, w: 24, h: 20, vx: 0, vy: 0, hp, face: -1, t: 0, flash: 0, slash: -1, x0: x, y0: y, mode: 0, alive: true, ground: true });

test('sub-tanks are found once, fill from spare health and heal on demand', () => {
  const g = play('cloud');
  const sub = g.items.find((i) => i.kind === 'sub');
  Object.assign(g.player, { x: sub.x - 10, y: sub.y - 15 });
  g.step(DT, NO_INPUT);
  assert.deepEqual([g.progress.subs, g.progress.subFill], [['cloud'], [0]]);
  assert.ok(g.events.includes('sub'));
  flat(g);
  g.items.push({ kind: 'hp', x: g.player.x + 10, y: g.player.y + 15, vy: 0, gone: false });
  g.step(DT, NO_INPUT);
  assert.deepEqual(g.progress.subFill, [6], 'spare health goes into the sub-tank');
  g.hurt(10, 0);
  assert.equal(g.useSub(0), true);
  assert.equal(g.hp.dora, g.max - 4);
  assert.deepEqual(g.progress.subFill, [0]);
  assert.equal(g.useSub(0), false, 'an empty tank does nothing');
  assert.equal(new PawBusterGame('cloud', g.progress).items.filter((i) => i.kind === 'sub').length, 0);
});

test('Dash Boots give one air dash per jump; the Saber Crest turns a dashing slash into a dash slash', () => {
  const noBoots = flat(play());
  noBoots.step(DT, { ...NO_INPUT, jump: true });
  hold(noBoots, { jump: true }, 0.15);
  noBoots.step(DT, { ...NO_INPUT, jump: true, dash: true });
  assert.equal(noBoots.player.adT, 0, 'no air dash without the boots');
  const g = flat(play('snowcap', { ...freshProgress(), parts: ['boots', 'saber'] }));
  g.step(DT, { ...NO_INPUT, jump: true });
  hold(g, { jump: true }, 0.15);
  const x0 = g.player.x, y0 = g.player.y;
  hold(g, { jump: true, dash: true, right: true }, 0.2);
  assert.ok(g.player.adT > 0 && Math.abs(g.player.y - y0) < 1 && g.player.x - x0 > 0.2 * PHYS.dash * 0.9, 'a flat, fast air dash');
  hold(g, { jump: true, right: true }, 0.05);
  g.step(DT, { ...NO_INPUT, jump: true, dash: true });
  assert.equal(g.player.adT, 0, 'one air dash per jump');
  hold(g, {}, 1);
  tap(g, 'swap');
  hold(g, {}, 2.1);
  assert.equal(g.hero, 'enzo');
  g.enemies = [foe('turret', g.player.x + 40, g.player.y, 20)];
  g.step(DT, { ...NO_INPUT, right: true, dash: true });
  g.step(DT, { ...NO_INPUT, right: true, dash: true, fire: true });
  hold(g, { right: true, dash: true }, 0.05);
  assert.ok(g.player.dashSlash, 'a dash slash');
  assert.equal(g.enemies[0].hp, 15);
});

test('charged special weapons cost double and change shape', () => {
  const g = flat(play('snowcap', all()));
  const charge = (w) => {
    g.weapon = g.weapons.indexOf(w); g.shots = []; hold(g, {}, 0.5);
    hold(g, { fire: true }, CHARGE.full + 0.05);
    const before = g.energy[w];
    g.shots = [];
    g.step(DT, NO_INPUT);
    return { kinds: g.shots.map((s) => s.kind).join(), spent: before - g.energy[w] };
  };
  assert.deepEqual(charge('frost'), { kinds: 'icewall', spent: 4 });
  const wall = g.shots[0];
  g.shots.push(pellet({ x: wall.x - 6, y: wall.y - 6, w: 12, h: 12 }));
  g.step(DT, NO_INPUT);
  assert.ok(!g.shots.some((s) => s.kind === 'pellet'), 'the ice wall blocks shots');
  assert.deepEqual(charge('gale'), { kinds: 'tornado', spent: 4 });
  assert.deepEqual(charge('ember'), { kinds: 'pillar,pillar,pillar,pillar', spent: 4 });
  assert.deepEqual(charge('quartz'), { kinds: 'quartz,quartz,quartz,quartz,quartz,quartz', spent: 4 });
  assert.deepEqual(charge('volt'), { kinds: 'volt,volt,volt', spent: 4 });
  assert.deepEqual(charge('bubble'), { kinds: 'bubble', spent: 4 });
  assert.equal(g.shots[0].r, 22);
  g.energy.frost = 3;
  assert.deepEqual(charge('frost'), { kinds: '', spent: 0 }, 'not enough energy for a charged shot');
});

test('beating one maverick changes another stage', () => {
  const pits = (g) => { let n = 0; for (let c = 0; c < g.map.arena; c++) if (!g.tiles[c * ROWS + ROWS - 1]) n++; return n; };
  assert.ok(pits(new PawBusterGame('lake')) > 10);
  const frozen = new PawBusterGame('lake', { ...freshProgress(), cleared: ['snowcap'] });
  assert.equal(pits(frozen), 0, 'the Frost Fox freezes the lake');
  assert.ok(frozen.tiles.includes(5));
  assert.ok(new PawBusterGame('caldera').tiles.includes(2));
  assert.ok(!new PawBusterGame('caldera', { ...freshProgress(), cleared: ['lake'] }).tiles.includes(2), 'the Tide Toad cools the spikes');
  const bats = (g) => g.enemies.filter((e) => e.kind === 'bat').length;
  assert.ok(bats(new PawBusterGame('salt')) > 0);
  assert.equal(bats(new PawBusterGame('salt', { ...freshProgress(), cleared: ['cloud'] })), 0, 'no bats once the Storm Owl is gone');
  assert.equal(changesFor({ ...freshProgress(), cleared: [...MAVERICKS] }, 'lake').length, 1);
});

test('big hits pause the action briefly without eating presses', () => {
  const g = flat(play());
  g.enemies = [foe('beetle', g.player.x + 40, g.player.y + 10, 1)];
  tap(g, 'fire');
  for (let i = 0; i < 30 && g.freeze <= 0; i++) g.step(DT, NO_INPUT);
  assert.ok(g.freeze > 0 && g.kills === 1, 'a kill starts a hit-stop');
  const x = g.player.x;
  g.step(DT, { ...NO_INPUT, right: true, jump: true });
  g.step(DT, NO_INPUT);
  assert.equal(g.player.x, x, 'nothing moves during the hit-stop');
  for (let i = 0; i < 12 && g.freeze > 0; i++) g.step(DT, NO_INPUT);
  g.step(DT, NO_INPUT);
  assert.ok(g.player.vy < 0, 'the jump pressed during the hit-stop still happens');
});

test('the citadel runs through three sectors, then every maverick and the Kingpin', () => {
  const g = play('citadel', all());
  assert.ok(g.status.startsWith('Cougar Citadel · Sector 1 · Dora in play'));
  g.enemies = [];
  Object.assign(g.player, { x: (g.map.exit + 2) * TILE + 5, y: (ROWS - 3) * TILE - HERO.h, vy: 0 });
  g.hp.dora = 5;
  g.step(DT, NO_INPUT);
  assert.equal(g.part, 1);
  assert.equal(g.hp.dora, 5, 'health carries into the next sector');
  assert.equal(g.banner.text, 'SECTOR 2');
  g.enterPart(2);
  hold(g, {}, 1.3);
  Object.assign(g.player, { x: (g.map.arena + 2) * TILE, y: (ROWS - 3) * TILE - HERO.h, vy: 0 });
  g.enemies = [];
  const kinds = [];
  for (let i = 0; i < RUSH.length; i++) {
    for (let t = 0; t < 120 * 5 && (!g.boss || g.state !== 'play'); t++) { g.hp.dora = g.hp.enzo = g.max; g.step(DT, NO_INPUT); }
    const b = g.boss;
    kinds.push(b.kind);
    assert.equal(b.max, b.kind === 'cougar' ? 44 : 16);
    Object.assign(b, { hp: 1, hidden: false, inv: 0, move: 'idle', t: 0 });
    g.shots.push({ x: b.x + b.w / 2, y: b.y + b.h / 2, vx: 0, vy: 0, r: 8, dmg: 1, kind: 'lemon', hero: true, life: 1, pierce: false, hits: [], grav: 0, weapon: 'buster' });
    g.step(DT, NO_INPUT);
    assert.equal(g.state, 'clearing', `${b.kind} down`);
    hold(g, {}, i < RUSH.length - 1 ? 1.3 : 2.6);
  }
  assert.deepEqual(kinds, RUSH);
  assert.equal(g.state, 'clear');
  assert.ok(g.victory);
});

test('the Kingpin turns to the mavericks’ moves below half health', () => {
  const g = toBoss('citadel', all(), (x) => { x.rush = RUSH.length - 1; });
  const b = g.boss;
  assert.equal(b.kind, 'cougar');
  b.hp = b.max / 2 + 1;
  g.shots.push({ x: b.x + b.w / 2, y: b.y + b.h / 2, vx: 0, vy: 0, r: 8, dmg: 1, kind: 'lemon', hero: true, life: 1, pierce: false, hits: [], grav: 0, weapon: 'buster' });
  g.step(DT, NO_INPUT);
  assert.ok(b.phase2);
  assert.equal(g.banner.text, 'KINGPIN ENRAGED');
  const moves = new Set();
  for (let i = 0; i < 120 * 20 && g.state === 'play'; i++) { g.hp.dora = g.hp.enzo = g.max; g.step(DT, NO_INPUT); moves.add(b.move); }
  assert.ok(['storm', 'bolt', 'crystals'].every((m) => moves.has(m)), `phase 2 used ${[...moves].join(', ')}`);
});

test('conveyors and platforms carry the heroes, and crushers hurt', () => {
  const g = play('citadel', all());
  g.enterPart(1);
  hold(g, {}, 1.3);
  g.enemies = [];
  const belt = [...Array(g.map.cols).keys()].find((c) => g.tiles[c * ROWS + ROWS - 3] === 3);
  const crushers = g.crushers;
  g.crushers = [];
  Object.assign(g.player, { x: belt * TILE + 2, y: (ROWS - 3) * TILE - HERO.h, vx: 0, vy: 0, ground: true });
  const x0 = g.player.x;
  hold(g, {}, 0.5);
  assert.ok(g.player.x - x0 > 30, 'the belt carries Dora');
  const pl = g.platforms[0];
  Object.assign(g.player, { x: pl.x + pl.w / 2 - 10, y: pl.y - HERO.h - 2, vy: 0, ground: false });
  hold(g, {}, 0.3);
  assert.equal(g.player.ride, 0);
  const off = g.player.x - pl.x;
  hold(g, {}, 0.6);
  assert.ok(Math.abs(g.player.x - pl.x - off) < 1.5 && Math.abs(g.player.y + HERO.h - pl.y) < 1, 'Dora rides the platform');
  g.crushers = crushers;
  const c = crushers.find((k) => g.tiles[Math.floor(k.x / TILE) * ROWS + Math.floor(k.spec.bottom / TILE)] === 1);
  Object.assign(g.player, { x: c.x + 20, y: c.spec.bottom - HERO.h, vx: 0, vy: 0, ride: -1, invT: 0 });
  const hp = g.hp.dora;
  for (let i = 0; i < 120 * CRUSH_PERIOD && g.hp.dora === hp; i++) { g.player.x = c.x + 20; g.step(DT, NO_INPUT); }
  assert.ok(g.hp.dora < hp, 'the crusher hurts');
});

test('co-op puts both heroes on screen with their own controls', () => {
  const g = new PawBusterGame('snowcap', freshProgress(), { coop: true });
  hold(g, {}, 1.3);
  assert.equal(g.state, 'play');
  flat(g);
  const d = g.bodies.dora, e = g.bodies.enzo;
  assert.notEqual(d, e);
  Object.assign(e, { x: d.x + 60, y: d.y, vx: 0, vy: 0, ground: true });
  const d0 = d.x, e0 = e.x;
  for (let i = 0; i < 60; i++) g.step(DT, { ...NO_INPUT, right: true }, { ...NO_INPUT, left: true });
  assert.ok(d.x > d0 + 40 && e.x < e0 - 40, 'each player moves their own hero');
  g.step(DT, { ...NO_INPUT, fire: true }, { ...NO_INPUT, fire: true });
  assert.ok(g.shots.some((s) => s.kind === 'lemon') && e.slashT > 0, 'Dora fires and Enzo slashes');
  g.step(DT, { ...NO_INPUT, swap: true });
  assert.ok(g.bodies.dora !== g.bodies.enzo && g.player.tagT === 0, 'no tagging in co-op');
  hold(g, {}, 1.2);
  g.hp.enzo = 1;
  g.shots.push(pellet(e));
  g.step(DT, NO_INPUT);
  assert.ok(e.down && g.state === 'play', 'Enzo is down, Dora plays on');
  assert.deepEqual(g.living, ['dora']);
  d.x = g.map.checkpoints[g.checkpoint + 1].x;
  g.step(DT, NO_INPUT);
  assert.ok(!e.down && g.hp.enzo === Math.ceil(g.max / 2), 'a checkpoint brings Enzo back');
  hold(g, {}, 1.6);
  g.hp.dora = g.hp.enzo = 1;
  g.shots.push(pellet(d), pellet(e));
  g.step(DT, NO_INPUT);
  assert.equal(g.state, 'lost');
});

test('easy mode halves damage and pits cost nothing', () => {
  const g = new PawBusterGame('snowcap', freshProgress(), { easy: true });
  hold(g, {}, 1.3);
  flat(g);
  g.hurt(5, 0);
  assert.equal(g.hp.dora, g.max - 3);
  hold(g, {}, 1.2);
  for (let c = 11; c < 30; c++) for (let r = 0; r < ROWS; r++) g.tiles[c * ROWS + r] = 0;
  g.events = [];
  for (let i = 0; i < 120 * 3 && !g.events.includes('fall'); i++) g.step(DT, { ...NO_INPUT, right: true });
  assert.ok(g.events.includes('fall'));
  assert.equal(g.hp.dora, g.max - 3);
});

test('a recorded run replays exactly from its encoded inputs', () => {
  const masks = [], g = new PawBusterGame('cloud');
  for (let i = 0; i < 120 * 10; i++) { const input = { ...NO_INPUT, right: true, jump: i % 50 < 30, fire: i % 20 === 0, dash: i % 90 < 40 }; masks.push(inputMask(input)); g.step(DT, input); }
  const code = encodeRun(masks);
  assert.deepEqual(decodeRun(code), masks);
  assert.ok(code.length < masks.length, `compact (${code.length} characters for ${masks.length} steps)`);
  const r = new PawBusterGame('cloud');
  for (const m of decodeRun(code)) r.step(DT, unmask(m));
  assert.deepEqual([r.player.x, r.player.y, r.hp, r.kills], [g.player.x, g.player.y, g.hp, g.kills]);
  assert.deepEqual(decodeRun('zz.1'), []);
  assert.deepEqual(decodeRun(''), []);
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
  const p = { ...freshProgress(), cleared: ['snowcap', 'cloud'], tanks: ['cloud'], best: { snowcap: 91.2 }, subs: ['cloud'], subFill: [5], parts: ['boots', 'arm'], found: ['snowcap'], ranks: { snowcap: 'A' }, medals: { snowcap: 2 }, badges: ['snowcap:buster', 'citadel:nosub'], bossBest: { cloud: 40.5 }, deaths: 3, playTime: 612.5 };
  assert.deepEqual(parseProgress(saveProgress(p)), p);
  assert.deepEqual(parseProgress('{"version":3,"cleared":[],"tanks":[],"best":{},"ranks":{"snowcap":"Z","cloud":"S"},"medals":{"cloud":4,"lake":3},"badges":["snowcap:nosub","moon:buster","lake:hard"],"deaths":-2}'), { ...freshProgress(), ranks: { cloud: 'S' }, medals: { lake: 3 }, badges: ['lake:hard'] }, 'bad version 3 fields are dropped');
  assert.deepEqual(importCode(exportCode(p)), p, 'save codes round-trip');
  assert.equal(importCode('hello'), null);
  assert.equal(importCode('PBX3-!!!'), null);
  assert.deepEqual(parseProgress('{"version":1,"cleared":["snowcap"],"tanks":["snowcap"],"best":{"snowcap":80}}'), { ...freshProgress(), cleared: ['snowcap'], tanks: ['snowcap'], best: { snowcap: 80 } }, 'version 1 saves upgrade');
  assert.deepEqual(parseProgress('{"version":2,"cleared":[],"tanks":[],"best":{},"subs":["snowcap","lake"],"subFill":[99],"parts":["jetpack","saber"],"found":["moon"]}'), { ...freshProgress(), subs: ['lake'], subFill: [16], parts: ['saber'] });
  assert.deepEqual(parseProgress('{"version":1,"cleared":["moon",3],"tanks":["citadel"],"best":{"cloud":-1}}'), freshProgress());
  assert.deepEqual(parseProgress('not json'), freshProgress());
  assert.deepEqual(parseProgress(null), freshProgress());
  assert.equal(unlocked(p, 'citadel'), false);
  assert.equal(unlocked({ ...p, cleared: ['snowcap', 'cloud', 'caldera'] }, 'citadel'), false, 'three mavericks are no longer enough');
  assert.equal(unlocked({ ...p, cleared: [...MAVERICKS] }, 'citadel'), true);
  assert.equal(unlocked({ ...p, cleared: ['snowcap', 'cloud', 'caldera', 'citadel'] }, 'citadel'), true, 'a citadel already beaten stays open');
  assert.deepEqual(parseProgress(saveProgress({ ...freshProgress(), cleared: ['mines', 'lake'], tanks: ['salt'], best: { lake: 70 } })), { ...freshProgress(), cleared: ['mines', 'lake'], tanks: ['salt'], best: { lake: 70 } });
});

test('runs are deterministic', () => {
  const run = () => { const g = play('cloud'); for (let i = 0; i < 120 * 12; i++) g.step(DT, { ...NO_INPUT, right: true, jump: i % 50 < 30, fire: i % 20 === 0, dash: i % 90 < 40 }); return JSON.stringify([g.player.x, g.player.y, g.hp, g.kills, g.enemies.length]); };
  assert.equal(run(), run());
});

const killBoss = (g) => {
  const b = g.boss;
  Object.assign(b, { hp: 1, hidden: false, inv: 0 });
  g.shots.push({ x: b.x + b.w / 2, y: b.y + b.h / 2, vx: 0, vy: 0, r: 8, dmg: 1, kind: 'lemon', hero: true, life: 1, pierce: false, hits: [], grav: 0, weapon: 'buster' });
  g.step(DT, NO_INPUT);
  hold(g, {}, 2.6);
};

test('the new armour capsules sit behind walls that a later weapon opens', () => {
  for (const [part, stage, door] of [['arm', 'snowcap', T.door], ['armor', 'caldera', T.crystal], ['helmet', 'cloud', null]]) {
    const m = buildStage(stage), it = m.items.find((i) => i.kind === part);
    assert.ok(it, `${part} is in ${stage}`);
    const c = Math.floor(it.x / TILE);
    const walled = [...Array(5).keys()].some((k) => m.tiles.slice((c - k) * ROWS, (c - k + 1) * ROWS).includes(door));
    if (door) assert.ok(walled, `${part} is behind its wall`);
  }
  const falls = buildStage('cloud').falls;
  assert.equal(falls.length, 1, 'Cloud Forest has a waterfall');
  for (const s of ['mines', 'salt', 'lake']) assert.ok(buildStage(s).tiles.includes(T.hidden), `${s} hides a stash behind a hidden wall`);
});

test('Quartz Orbit shatters crystal walls and Volt Spark opens power doors', () => {
  const g = flat(play('snowcap', all()));
  const r = ROWS - 4, wall = (t) => { flat(g); g.shots = []; for (const y of [r, r - 1]) g.tiles[14 * ROWS + y] = t; hold(g, {}, 0.4); };
  const fire = (w) => { g.weapon = g.weapons.indexOf(w); tap(g, 'fire'); hold(g, {}, 0.8); };
  wall(T.crystal);
  fire('volt');
  assert.equal(g.tiles[14 * ROWS + r], T.crystal, 'a spark does nothing to crystal');
  g.weapon = g.weapons.indexOf('quartz');
  tap(g, 'fire');
  hold(g, { right: true }, 1);
  assert.deepEqual([g.tiles[14 * ROWS + r], g.tiles[14 * ROWS + r - 1]], [T.air, T.air], 'the orbit shatters the whole wall');
  assert.ok(g.events.includes('break'));
  wall(T.door);
  fire('buster');
  assert.equal(g.tiles[14 * ROWS + r], T.door, 'the buster does nothing to a door');
  fire('volt');
  assert.equal(g.tiles[14 * ROWS + r], T.air, 'a spark opens the door');
});

test('hidden walls let heroes through, and Bubble Burst floats up waterfalls', () => {
  const g = flat(play('cloud', all()));
  for (let r = 0; r < ROWS - 3; r++) g.tiles[14 * ROWS + r] = T.hidden;
  hold(g, { right: true }, 1);
  assert.ok(g.player.x > 15 * TILE, 'walked through a hidden wall');
  flat(g);
  Object.assign(g.player, { x: g.map.falls[0].x + 10 });
  const y0 = g.player.y;
  hold(g, { jump: true }, 1.2);
  assert.ok(Math.abs(g.player.y - y0) < 1, 'an ordinary jump with the buster');
  g.weapon = g.weapons.indexOf('bubble');
  hold(g, {}, 0.3);
  hold(g, { jump: true }, 1.5);
  assert.ok(g.player.y < y0 - 250, `Bubble Burst floated ${Math.round(y0 - g.player.y)}px up the falls`);
});

test('the Arm Cannon adds a third buster level and Body Armour softens hits', () => {
  const g = flat(play('snowcap', { ...freshProgress(), parts: ['arm', 'armor'] }));
  hold(g, { fire: true }, CHARGE.giga + 0.05);
  assert.ok(g.events.includes('charge3'));
  g.shots = [];
  g.step(DT, NO_INPUT);
  assert.deepEqual(g.shots.map((s) => [s.kind, s.dmg, s.pierce]), [['giga', 6, true]]);
  const plain = flat(play());
  hold(plain, { fire: true }, CHARGE.giga + 0.05);
  plain.shots = [];
  plain.step(DT, NO_INPUT);
  assert.equal(plain.shots[0].kind, 'full', 'no third level without the Arm Cannon');
  g.hurt(8, g.player.x + 100);
  assert.deepEqual([g.hp.dora, g.player.hurtT, g.damage], [g.max - 6, 0, 6], 'a quarter less damage and no knockback');
});

test('shields block shots from the front; ceiling turrets and bombers drop shots from above', () => {
  const g = flat(play());
  const front = { ...foe('shield', g.player.x + 70, g.player.y + 2, 4), h: 28 };
  g.enemies = [front];
  tap(g, 'fire');
  hold(g, {}, 0.2);
  assert.equal(front.hp, 4, 'blocked from the front');
  assert.ok(g.events.includes('deflect'));
  // Charge out of its reach (a hit would cost the charge), then put one back in front and let go.
  g.enemies = [];
  hold(g, { fire: true }, CHARGE.full + 0.05);
  const charged = { ...foe('shield', g.player.x + 70, g.player.y + 2, 4), h: 28 };
  g.enemies = [charged];
  g.step(DT, NO_INPUT);
  hold(g, {}, 0.3);
  assert.ok(!charged.alive, 'a charged shot breaks through');
  flat(g);
  const back = { ...foe('shield', g.player.x - 70, g.player.y + 2, 4), h: 28, face: -1 };
  g.enemies = [back];
  g.step(DT, { ...NO_INPUT, left: true });
  hold(g, {}, 0.3);
  tap(g, 'fire');
  hold(g, {}, 0.2);
  assert.ok(back.hp < 4, 'hit from behind');
  flat(g);
  g.shots = [];
  g.enemies = [{ ...foe('ceiling', g.player.x - 2, g.player.y - 120, 4), h: 24, t: 1.7 }];
  g.step(DT, NO_INPUT);
  assert.ok(g.shots.some((s) => !s.hero && s.kind === 'pellet' && s.vy > 0), 'the ceiling turret fires down');
  flat(g);
  g.shots = [];
  g.enemies = [{ ...foe('bomber', g.player.x, g.player.y - 150, 3), h: 18, face: 1 }];
  let waves = false;
  for (let i = 0; i < 120 * 1.5; i++) { g.hp.dora = g.max; g.step(DT, NO_INPUT); waves ||= g.shots.some((s) => s.kind === 'wave'); }
  assert.ok(waves, 'the bomb bursts into shock waves');
});

test('each stage has a guardian mid-boss that blocks the way until it falls', () => {
  for (const s of STAGES) {
    const n = [...Array(partsOf(s.id)).keys()].flatMap((p) => buildStage(s.id, p).spawns).filter((e) => e.kind === 'guardian').length;
    assert.equal(n, 1, `${s.id} has one guardian`);
  }
  const g = flat(play());
  const gd = { ...foe('guardian', g.player.x + 120, g.player.y - 14, GUARDIAN_HP), w: 46, h: 44 };
  g.enemies = [gd];
  const items = g.items.length;
  for (let i = 0; i < 120 * 3; i++) { g.hp.dora = g.max; g.step(DT, { ...NO_INPUT, right: true }); assert.ok(g.player.x + g.player.w / 2 < gd.x + gd.w / 2, 'no way past'); }
  gd.hp = 1;
  hold(g, {}, 0.1);
  tap(g, 'fire');
  hold(g, {}, 0.3);
  assert.ok(!gd.alive && g.events.includes('guardian-down'));
  assert.equal(g.items.length, items + 2, 'it drops health and energy');
  assert.equal(new PawBusterGame('snowcap', freshProgress(), { hard: true }).guardianMax, Math.ceil(GUARDIAN_HP * HARD_HP));
});

test('a clear earns a rank, a medal and badges, and keeps the best of each', () => {
  assert.equal(rankFor('snowcap', TARGETS.snowcap[0], 0, 10, 10), 'S');
  assert.equal(rankFor('snowcap', TARGETS.snowcap[2] + 1, 30, 0, 10), 'C');
  assert.deepEqual([1, 2, 3].map((i) => medalFor('snowcap', TARGETS.snowcap[3 - i])), [1, 2, 3]);
  assert.equal(medalFor('snowcap', TARGETS.snowcap[2] + 1), 0);
  const g = toBoss('snowcap');
  assert.ok(g.enemyTotal >= 8, `the stage counts its ${g.enemyTotal} enemies`);
  g.time = 60;
  g.kills = g.enemyTotal;
  killBoss(g);
  assert.equal(g.state, 'clear');
  assert.deepEqual([g.rank, g.medal, g.progress.ranks.snowcap, g.progress.medals.snowcap], ['S', 3, 'S', 3]);
  assert.deepEqual(g.earned, ['untouched', 'buster']);
  assert.ok(g.events.includes('badge'));
  const h = toBoss('snowcap', g.progress);
  h.usedSpecial = true;
  h.hurt(4, 0);
  h.time = 500;
  killBoss(h);
  assert.equal(h.rank, 'C');
  assert.deepEqual([h.progress.ranks.snowcap, h.progress.medals.snowcap, h.earned], ['S', 3, []], 'a worse run keeps the better records');
  assert.deepEqual(h.progress.badges, ['snowcap:untouched', 'snowcap:buster']);
});

test('hard mode toughens enemies and bosses, and the boss gallery refights one boss', () => {
  const hard = new PawBusterGame('snowcap', freshProgress(), { hard: true });
  assert.equal(hard.enemies[0].hp, Math.ceil(3 * HARD_HP));
  assert.equal(new PawBusterGame('snowcap', freshProgress(), { hard: true, easy: true }).hard, false, 'easy mode wins');
  hold(hard, {}, 1.3);
  Object.assign(hard.player, { x: (hard.map.arena + 2) * TILE, y: (ROWS - 3) * TILE - HERO.h, vy: 0 });
  hard.enemies = [];
  hold(hard, {}, 2.4);
  assert.equal(hard.boss.max, Math.ceil(32 * HARD_HP));
  Object.assign(hard.boss, { move: 'shards', t: 0.95, fired: 1 });
  hard.shots = [];
  hard.step(DT, NO_INPUT);
  assert.equal(hard.shots.filter((s) => s.kind === 'pellet').length, 3, 'an extra volley after each move');
  killBoss(hard);
  assert.ok(hard.progress.badges.includes('snowcap:hard'));

  const gal = new PawBusterGame('cloud', { ...freshProgress(), cleared: ['cloud'] }, { gallery: true });
  hold(gal, {}, 0.1);
  assert.deepEqual([gal.state, gal.boss.kind], ['boss', 'owl']);
  assert.ok(gal.status.includes('Boss gallery'));
  hold(gal, {}, 2.3);
  gal.time = 40;
  killBoss(gal);
  assert.equal(gal.state, 'clear');
  assert.deepEqual([gal.progress.bossBest.cloud, gal.progress.best.cloud, gal.rank, gal.victory], [40, undefined, null, false]);
  const kingpin = new PawBusterGame('citadel', all(), { gallery: true });
  hold(kingpin, {}, 0.1);
  assert.deepEqual([kingpin.boss.kind, kingpin.boss.max], ['cougar', 44], 'the citadel gallery is the Kingpin alone');
});

test('a co-op hero revives a fallen partner by standing beside them', () => {
  const g = new PawBusterGame('snowcap', freshProgress(), { coop: true });
  hold(g, {}, 1.3);
  flat(g);
  const d = g.bodies.dora, e = g.bodies.enzo;
  Object.assign(e, { x: d.x + 200, y: d.y, vx: 0, vy: 0, ground: true });
  hold(g, {}, 1.2);
  g.hp.enzo = 1;
  g.shots.push(pellet(e));
  g.step(DT, NO_INPUT);
  assert.ok(e.down);
  d.x = e.x - 20;
  hold(g, {}, REVIVE - 0.2);
  assert.ok(e.down && e.reviveT > 1, 'not yet');
  hold(g, {}, 0.4);
  assert.ok(!e.down && g.hp.enzo === Math.ceil(g.max / 2) && g.events.includes('revive'), 'Enzo is back');
});

test('stats, the weapon showcase and deaths', () => {
  const g = flat(play());
  const t0 = g.progress.playTime;
  hold(g, {}, 1);
  assert.ok(Math.abs(g.progress.playTime - t0 - 1) < 0.02, 'play time counts up');
  g.hurt(99, 0); hold(g, {}, 1.6); g.hurt(99, 0);
  assert.deepEqual([g.state, g.progress.deaths], ['lost', 1]);
  const demo = weaponDemo('volt');
  assert.deepEqual([demo.weaponId, demo.state], ['volt', 'play']);
  for (let i = 0; i < 120 * 3.4; i++) { demo.step(DT, demoInput(i * DT)); demo.energy.volt = 28; }
  assert.ok(demo.events.includes('special-volt') && demo.events.includes('charged-volt'), 'the demo taps and charges');
  assert.ok(demo.enemies.every((e) => e.alive), 'the dummies never fall');
});

console.log(`Paw Buster X: ${cases} cases passed (stages, movement, dash jump, wall climb, charge shot, tag team, saber deflect, damage and defeat, pits and spikes, drops, boss door, weaknesses, clear, weapons, quartz orbit, volt homing, bubbles, hoppers, armadillo roll, sub-tanks, armour parts, charged specials, stage changes, hit-stop, citadel sectors and boss rush, Kingpin phase 2, conveyors, platforms and crushers, co-op, easy mode, ghost replays, heart tanks, boss patterns, saves and save codes, determinism, capsules, breakable walls, hidden walls and waterfalls, Arm Cannon and Body Armour, new enemies, guardians, ranks and badges, hard mode and the boss gallery, co-op revives, stats and the weapon showcase).`);
