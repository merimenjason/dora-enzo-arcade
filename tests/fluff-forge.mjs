import assert from 'node:assert/strict';
import {
  FluffForgeGame, STARTERS, PARTS, HEROES, TILE, ROWS, MIN_COLS, MAX_COLS, NO_INPUT, CODE_PREFIX,
  design, blankCourse, paint, resize, problems, encodeCourse, decodeCourse, raisinCount, toRows, index,
} from '../.checks/fluff-forge-game.js';

const DT = 1 / 120;
const hold = (g, input, seconds) => { for (let i = 0; i < Math.round(seconds / DT); i++) g.step(DT, { ...NO_INPUT, ...input }); };
const G = ROWS - 3;
/** A flat test course 40 wide with the start at column 2 and the goal far away; `draw` adds parts. */
const flat = (draw = () => {}, cols = 40) => design('Test', 'meadow', 300, cols, (p) => { p.ground(0, cols - 1); p.put(2, G, '@'); p.put(cols - 2, G, 'G'); draw(p); });
const settle = (g) => { hold(g, {}, 0.3); assert.ok(g.hero.ground, 'hero lands on the ground'); return g; };
const apex = (g, input, seconds = 0.8) => { const y0 = g.hero.y; let top = y0; for (let i = 0; i < seconds / DT; i++) { g.step(DT, { ...NO_INPUT, ...input }); top = Math.min(top, g.hero.y); } return y0 - top; };
let cases = 0;
const test = (name, fn) => { try { fn(); cases++; } catch (e) { console.error(`FAIL ${name}`); throw e; } };

test('every part has a unique character, id and a hint', () => {
  assert.equal(new Set(PARTS.map((p) => p.ch)).size, PARTS.length);
  assert.equal(new Set(PARTS.map((p) => p.id)).size, PARTS.length);
  for (const p of PARTS) assert.ok(p.name && p.hint && p.ch.length === 1 && !/\d/.test(p.ch), p.id);
});

test('starter courses are complete, share cleanly and have things to collect', () => {
  assert.equal(STARTERS.length, 4);
  for (const s of STARTERS) {
    assert.deepEqual(problems(s), [], s.id);
    assert.equal(s.tiles.length, s.cols * ROWS);
    assert.ok(raisinCount(s) >= 20, `${s.id} has ${raisinCount(s)} raisins`);
    const back = decodeCourse(encodeCourse(s));
    assert.deepEqual(back, { title: s.title, theme: s.theme, cols: s.cols, time: s.time, tiles: s.tiles });
    assert.equal(toRows(s).length, ROWS);
  }
});

test('course codes survive round trips, whitespace and unicode titles, and reject anything broken', () => {
  const c = { ...flat((p) => p.row(5, 9, 'B?CF')), title: 'Dora’s ñandú run 🐭' };
  const code = encodeCourse(c);
  assert.ok(code.startsWith(CODE_PREFIX));
  assert.ok(code.length < 250, `a mostly-empty course makes a short code (${code.length})`);
  assert.deepEqual(decodeCourse(`  ${code.slice(0, 20)}\n${code.slice(20)} `), c);
  assert.equal(decodeCourse(''), null);
  assert.equal(decodeCourse('FLUFF-notbase64!!'), null);
  assert.equal(decodeCourse(code.slice(4)), null, 'needs the prefix');
  assert.equal(decodeCourse(code.slice(0, -6)), null, 'truncated');
  assert.equal(decodeCourse(encodeCourse({ ...c, tiles: c.tiles.replace('@', '.') })), null, 'no start');
  assert.equal(decodeCourse(encodeCourse({ ...c, tiles: c.tiles.replace('G', '.') })), null, 'no goal');
  assert.equal(decodeCourse(encodeCourse({ ...c, tiles: c.tiles.replace('B', 'Z') })), null, 'unknown part');
  assert.equal(decodeCourse(encodeCourse({ ...c, cols: 39 })), null, 'size mismatch');
  const odd = decodeCourse(encodeCourse({ ...c, theme: 'lava', time: 7, title: '   ' }));
  assert.equal(odd.theme, 'meadow'); assert.equal(odd.time, 300); assert.equal(odd.title, 'Shared course');
});

test('painting places parts, keeps one start and one goal, and ignores cells outside the course', () => {
  let c = blankCourse(30);
  assert.deepEqual(problems(c), []);
  assert.equal(paint(c, -1, 3, '#'), c);
  assert.equal(paint(c, 5, ROWS, '#'), c);
  assert.equal(paint(c, 5, 3, 'Z'), c, 'unknown part');
  c = paint(c, 5, 3, 'B');
  assert.equal(c.tiles[index(5, 3)], 'B');
  assert.equal(paint(c, 5, 3, 'B'), c, 'same part is a no-op');
  c = paint(c, 10, 5, '@');
  assert.equal(c.tiles.split('@').length - 1, 1);
  assert.equal(c.tiles[index(10, 5)], '@');
  c = paint(c, 20, 5, 'G');
  assert.equal(c.tiles.split('G').length - 1, 1);
  assert.deepEqual(problems(paint(c, 10, 5, '.')), ['Place a start.']);
  assert.deepEqual(problems(paint(c, 20, 5, '.')), ['Place a goal flag.']);
});

test('resizing clamps the width, grows with ground and keeps a goal inside', () => {
  const c = blankCourse(60);
  assert.equal(resize(c, 5).cols, MIN_COLS);
  assert.equal(resize(c, 9999).cols, MAX_COLS);
  const big = resize(c, 80);
  assert.equal(big.tiles.length, 80 * ROWS);
  assert.equal(big.tiles[index(79, ROWS - 1)], '#');
  assert.equal(big.tiles.split('G').length - 1, 1, 'growing adds no second goal');
  const small = resize(c, 30);
  assert.deepEqual(problems(small), [], 'shrinking past the goal moves it inside');
  assert.equal(small.tiles[index(26, G)], 'G');
});

test('walking, running and the two heroes: Enzo runs faster, Dora jumps higher', () => {
  const speed = (hero, run) => { const g = settle(new FluffForgeGame(flat(), hero)); hold(g, { right: true, run }, 1.2); return g.hero.vx; };
  assert.equal(speed('dora', false), HEROES.dora.walk);
  assert.equal(speed('dora', true), HEROES.dora.run);
  assert.equal(speed('enzo', true), HEROES.enzo.run);
  assert.ok(HEROES.enzo.run > HEROES.dora.run);
  const dora = apex(settle(new FluffForgeGame(flat(), 'dora')), { jump: true });
  const enzo = apex(settle(new FluffForgeGame(flat(), 'enzo')), { jump: true });
  assert.ok(dora > enzo, `Dora ${dora.toFixed(1)} px vs Enzo ${enzo.toFixed(1)} px`);
  assert.ok(dora > 3.3 * TILE && dora < 4 * TILE, `Dora clears three blocks but not four (${dora.toFixed(1)} px)`);
});

test('holding jump goes higher than a tap, and jumps are buffered and forgiven at ledges', () => {
  const g1 = settle(new FluffForgeGame(flat()));
  const high = apex(g1, { jump: true });
  const g2 = settle(new FluffForgeGame(flat()));
  g2.step(DT, { ...NO_INPUT, jump: true });
  const low = apex(g2, {});
  assert.ok(high > low * 1.6, `hold ${high.toFixed(1)} vs tap ${low.toFixed(1)}`);
  // Coyote time: a jump pressed just after running off a ledge still counts.
  const g3 = settle(new FluffForgeGame(flat((p) => p.pit(4, 12))));
  let steps = 0;
  while (g3.hero.ground && steps++ < 600) g3.step(DT, { ...NO_INPUT, right: true });
  hold(g3, { right: true }, 0.04);
  const y = g3.hero.y;
  g3.step(DT, { ...NO_INPUT, right: true, jump: true });
  hold(g3, { right: true, jump: true }, 0.1);
  assert.ok(g3.hero.y < y - 8, 'coyote jump');
});

test('bumping blocks: raisin blocks pay once, bricks only break when powered up', () => {
  const g = settle(new FluffForgeGame(flat((p) => p.row(2, 9, '?'))));
  hold(g, { jump: true }, 0.5);
  assert.equal(g.raisins, 1);
  assert.equal(g.tile(2, 9), 'U');
  assert.ok(g.events.includes('raisin'));
  hold(g, {}, 0.5); hold(g, { jump: true }, 0.5);
  assert.equal(g.raisins, 1, 'a spent block gives nothing');
  const b = settle(new FluffForgeGame(flat((p) => p.put(2, 9, 'B'))));
  hold(b, { jump: true }, 0.5);
  assert.equal(b.tile(2, 9), 'B', 'a small hero only bumps bricks');
  b.hero.power = 'clover'; b.hero.h = 24; b.hero.y -= 10;
  hold(b, {}, 0.5); hold(b, { jump: true }, 0.5);
  assert.equal(b.tile(2, 9), '.', 'a powered-up hero breaks them');
  assert.ok(b.events.includes('break'));
});

test('a clover grows the hero; a hit shrinks them with a moment of safety; a second hit ends the try', () => {
  const g = settle(new FluffForgeGame(flat((p) => { p.put(2, 9, 'C'); p.put(14, G, 'b'); })));
  hold(g, { jump: true }, 0.4);
  assert.equal(g.items.length, 1);
  hold(g, {}, 0.6);
  // The clover slides right, so chase it down.
  for (let i = 0; i < 400 && g.hero.power === 'small'; i++) g.step(DT, { ...NO_INPUT, right: g.items[0] ? g.items[0].x > g.hero.x : false, left: g.items[0] ? g.items[0].x < g.hero.x : false });
  assert.equal(g.hero.power, 'clover');
  assert.equal(g.hero.h, 24);
  g.hero.x = 13 * TILE; g.enemies[0].x = 13.3 * TILE; g.enemies[0].awake = true;
  hold(g, {}, 0.05);
  assert.equal(g.hero.power, 'small');
  assert.equal(g.state, 'play');
  assert.ok(g.hero.hurt > 1);
  hold(g, {}, 0.5);
  assert.equal(g.state, 'play', 'safe while flashing');
  g.hero.hurt = 0;
  g.enemies[0].x = g.hero.x;
  hold(g, {}, 0.05);
  assert.equal(g.state, 'dying');
  assert.equal(g.deaths, 1);
  hold(g, {}, 1.6);
  assert.equal(g.state, 'play', 'back at the start');
  assert.equal(g.hero.power, 'small');
  assert.equal(g.tile(2, 9), 'C', 'the course is laid out fresh');
  assert.ok(Math.abs(g.hero.x - 2 * TILE - 2) < 1);
});

test('stomping: beetles, frogs and bats squash; prickles hurt from above', () => {
  for (const [ch, stompable] of [['b', true], ['f', true], ['v', true], ['x', false]]) {
    const g = settle(new FluffForgeGame(flat((p) => p.put(8, ch === 'v' ? 9 : G, ch))));
    const e = g.enemies[0];
    e.awake = true; e.t = 0; e.y = e.home;
    g.hero.x = e.x + 1; g.hero.y = e.y - g.hero.h - 6; g.hero.vy = 200; g.hero.ground = false;
    e.t = 0;
    for (let i = 0; i < 12 && !e.dead && g.state === 'play'; i++) g.step(DT, NO_INPUT);
    if (stompable) {
      assert.ok(e.dead > 0, `${ch} squashed`);
      assert.ok(g.hero.vy < 0, `${ch} bounces the hero`);
      assert.equal(g.state, 'play');
    } else {
      assert.equal(e.dead, 0, 'prickle survives');
      assert.equal(g.state, 'dying', 'prickle hurts a small hero');
    }
  }
});

test('bumping a block knocks out the enemy standing on it', () => {
  const g = settle(new FluffForgeGame(flat((p) => { p.put(2, 9, 'H'); p.put(2, 8, 'x'); })));
  g.enemies[0].awake = true;
  hold(g, {}, 0.1);
  g.enemies[0].x = 2 * TILE + 1;
  hold(g, { jump: true }, 0.3);
  assert.ok(g.enemies.length === 0 || g.enemies[0].flip, 'the prickle is flipped away');
});

test('beetles turn at walls; prickles also turn at ledges', () => {
  const g = new FluffForgeGame(flat((p) => { p.put(10, G, 'b'); p.pillar(6, 1); p.put(24, G, 'x'); p.pit(20, 21); }, 40));
  g.enemies.forEach((e) => (e.awake = true));
  g.hero.x = 36 * TILE;
  hold(g, {}, 4);
  const [beetle, prickle] = g.enemies;
  assert.equal(beetle.dir, 1, 'beetle bounced off the pillar');
  assert.ok(prickle.x > 21 * TILE, 'prickle never walks into the pit');
});

test('cloud ledges: jump up through, stand on top, drop through with down', () => {
  const g = settle(new FluffForgeGame(flat((p) => p.row(1, 10, '====='))));
  hold(g, { jump: true }, 0.5);
  hold(g, {}, 0.5);
  assert.ok(g.hero.ground);
  assert.equal(g.hero.y + g.hero.h, 10 * TILE, 'standing on the ledge');
  hold(g, { down: true }, 0.05);
  hold(g, {}, 0.5);
  assert.equal(g.hero.y + g.hero.h, (ROWS - 2) * TILE, 'dropped back to the ground');
});

test('springs launch higher than any jump, and higher still with jump held', () => {
  const launch = (jump) => { const g = settle(new FluffForgeGame(flat((p) => p.put(4, G, 'S')))); g.hero.x = 4 * TILE + 2; g.hero.y = 100; g.hero.vy = 0; g.hero.ground = false; let top = 999; for (let i = 0; i < 240; i++) { g.step(DT, { ...NO_INPUT, jump }); top = Math.min(top, g.hero.y); } return (ROWS - 3) * TILE - top; };
  const plain = launch(false), boosted = launch(true);
  assert.ok(plain > 4 * TILE, `spring ${plain.toFixed(0)} px`);
  assert.ok(boosted > plain * 1.5, `held ${boosted.toFixed(0)} vs ${plain.toFixed(0)}`);
});

test('spikes hurt from any side', () => {
  const g = settle(new FluffForgeGame(flat((p) => p.put(4, G, '^'))));
  hold(g, { right: true }, 0.6);
  assert.equal(g.state, 'dying');
});

test('ice is slippery: slower to stop than ground', () => {
  const stop = (ch) => { const g = settle(new FluffForgeGame(flat((p) => p.ground(0, 39, ch)))); hold(g, { right: true, run: true }, 1.2); const x = g.hero.x; hold(g, {}, 1.5); return g.hero.x - x; };
  assert.ok(stop('I') > stop('#') * 3, 'slides much further on ice');
});

test('drifting clouds carry the hero', () => {
  const g = settle(new FluffForgeGame(flat((p) => { p.pit(5, 15); p.put(10, 11, 'M'); })));
  const l = g.lifts[0];
  g.hero.x = l.x + 10; g.hero.y = l.y - g.hero.h - 2; g.hero.vy = 0;
  hold(g, {}, 0.2);
  assert.ok(g.hero.ground && g.hero.ride === 0);
  const offset = g.hero.x - l.x;
  hold(g, {}, 1);
  assert.ok(Math.abs(g.hero.x - l.x - offset) < 0.5, 'moves with the cloud');
  assert.equal(g.state, 'play');
});

test('the condor feather gives one air jump per jump and a slow fall', () => {
  const g = settle(new FluffForgeGame(flat()));
  g.hero.power = 'feather'; g.hero.h = 24; g.hero.y -= 10;
  hold(g, {}, 0.3);
  hold(g, { jump: true }, 0.2);
  hold(g, {}, 0.05);
  assert.ok(!g.hero.ground);
  const before = g.hero.y;
  g.step(DT, { ...NO_INPUT, jump: true });
  hold(g, { jump: true }, 0.25);
  assert.ok(g.hero.y < before - 20, 'second jump in the air');
  hold(g, {}, 0.1); g.step(DT, { ...NO_INPUT, jump: true }); hold(g, {}, 0.1);
  assert.ok(g.hero.vy > 0, 'only one air jump');
  hold(g, { jump: true }, 0.3);
  assert.ok(g.hero.vy <= 70, 'holding jump floats');
});

test('checkpoints move the restart point and keep raisins collected before them', () => {
  const g = settle(new FluffForgeGame(flat((p) => { p.row(4, G, 'oo'); p.put(8, G, 'P'); p.put(12, G, '^'); })));
  hold(g, { right: true }, 3);
  assert.equal(g.raisins, 2);
  assert.ok(g.flags[0].taken);
  assert.equal(g.state, 'dying');
  hold(g, {}, 1.6);
  assert.equal(g.state, 'play');
  assert.ok(Math.abs(g.hero.x - 8 * TILE - 2) < 1, 'restart at the flag');
  assert.equal(g.raisins, 2);
  assert.equal(g.tile(4, G), '.', 'raisins behind the flag stay collected');
});

test('falling in a pit or running out of time ends the try', () => {
  const g = settle(new FluffForgeGame(flat((p) => p.pit(4, 8))));
  hold(g, { right: true }, 1.5);
  assert.equal(g.deaths, 1);
  const t = settle(new FluffForgeGame({ ...flat(), time: 100 }));
  hold(t, {}, 100);
  assert.equal(t.cause, 'Time up');
});

test('reaching the goal clears the course with a result; tag swaps hero', () => {
  const g = settle(new FluffForgeGame(flat((p) => p.row(5, G, 'ooo'), MIN_COLS)));
  g.step(DT, { ...NO_INPUT, swap: true }); g.step(DT, { ...NO_INPUT, swap: true });
  assert.equal(g.heroId, 'enzo', 'held tag swaps once per press');
  g.step(DT, NO_INPUT); g.step(DT, { ...NO_INPUT, swap: true });
  assert.equal(g.heroId, 'dora', 'a second press swaps back');
  hold(g, { right: true, run: true }, 4);
  assert.equal(g.state, 'clear');
  assert.equal(g.result.raisins, 3);
  assert.equal(g.result.deaths, 0);
  assert.ok(g.result.time > 1 && g.result.time < 3);
});

test('clones step independently of the original', () => {
  const g = settle(new FluffForgeGame(STARTERS[0]));
  const c = g.clone();
  hold(c, { right: true, run: true }, 1);
  assert.ok(c.hero.x > g.hero.x + 50);
  assert.equal(g.tiles.join(''), new FluffForgeGame(STARTERS[0]).tiles.join(''));
});

console.log(`${cases} Fluff Forge engine tests passed.`);
