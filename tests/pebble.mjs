// Pebble Pop engine checks: the map, the walls, the physics (no tunnelling, bale angles, every block type), upgrades,
// the shop and rest stops, a whole run, exact replays, and saving.
import assert from 'node:assert/strict';
import {
  W, H, PADDLE_Y, R, HZ, DT, COLS, GRID_X, GRID_Y, CELL_W, CELL_H, BLOCK_W, BLOCK_H, MAX_ANGLE, SPEED, LIVES, STEPS, BOSS_STEPS, CHARS, SPIN,
  BLOCKS, UPGRADES, UP_IDS, PRICE, HEAL_PRICE, ACORN_PILE, MOSS_REGROW, CHAIN_DELAY, HELP_AFTER, DUST_SLOW, BOSSES, REWARD,
  PebbleGame, makeMap, makeWall, slab, landing, placeOf, wallRows, Rng, hash, readProfile, freshProfile, record, discover, SAVE_KEY,
} from '../.checks/pebble-game.js';

let checks = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); checks++; };
const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); checks++; };
const near = (a, b, eps, msg) => ok(Math.abs(a - b) <= eps, `${msg} (${a} vs ${b})`);

/** A game standing at the first wall, with that wall's blocks swapped for the ones given. */
function lab(blocks = [['crate', 10, 0]], { char = 'dora', ups = {}, seed = 5 } = {}) {
  const g = new PebbleGame(seed, char);
  for (const [id, n] of Object.entries(ups)) for (let i = 0; i < n; i++) g.take(id);
  g.go(g.choices()[0].id);
  const w = g.wall; w.blocks = blocks.map((b, id) => mk(id, ...b)); w.shield = g.has('shield'); w.paddle.w = CHARS[char].width + 14 * g.has('wide');
  g.events.length = 0;
  return g;
}
function mk(id, type, col, row, hp) {
  const x = GRID_X + col * CELL_W, y = GRID_Y + row * CELL_H, max = hp ?? BLOCKS[type].hp;
  return { id, type, col, row, x, y, ox: x, w: BLOCK_W, h: BLOCK_H, hp: max, max, alive: true, amp: 0, phase: 0, boss: false, hitAt: -9, regrowAt: 0 };
}
/** Puts the first pebble at (x, y) moving at `angle` (radians from straight up) and the game's current speed. */
function aim(g, x, y, angle) {
  const b = g.wall.balls[0], s = g.speed(); b.held = false; b.heldFor = 0; b.x = x; b.y = y; b.vx = Math.sin(angle) * s; b.vy = -Math.cos(angle) * s; return b;
}
const steps = (g, n, input) => { for (let i = 0; i < n && g.phase === 'wall'; i++) { if (input) Object.assign(g.input, input(i)); g.update(); } };
const kinds = (g) => g.events.map((e) => e.k);

// ---- the map
{
  const m = makeMap(1);
  ok(m.length === 1 + 3 * (STEPS - 1 - (BOSS_STEPS.length)) + BOSS_STEPS.length, `the map has ${m.length} nodes`);
  for (let step = 1; step <= STEPS; step++) {
    const row = m.filter((n) => n.step === step);
    ok(row.length === (step === 1 || BOSS_STEPS.includes(step) ? 1 : 3), `step ${step} has ${row.length} nodes`);
    if (BOSS_STEPS.includes(step)) ok(row[0].kind === 'boss', `step ${step} is a boss`);
    if ([4, 9, 14].includes(step)) eq(row.map((n) => n.kind).sort(), ['elite', 'rest', 'shop'], `before boss ${step + 1}: a rest, a shop and an elite`);
    if ([6, 11].includes(step)) ok(row[1].kind === 'shop', `after a boss, a shop in the middle at step ${step}`);
  }
  ok(m.filter((n) => n.step === 1)[0].kind === 'wall' && m.filter((n) => n.step === 2).every((n) => n.kind === 'wall'), 'the first two steps are plain walls');
  ok(m.every((n) => n.step === STEPS ? n.next.length === 0 : n.next.length >= 1 && n.next.every((i) => m[i].step === n.step + 1)), 'every node leads to the next step');
  ok(m.every((n) => n.step === 1 || m.some((p) => p.next.includes(n.id))), 'every node can be reached');
  ok(m.every((n) => n.next.every((i) => m[i].lane === 1 || n.lane === 1 || Math.abs(m[i].lane - n.lane) <= 1)), 'paths only step one lane sideways');
  eq(makeMap(1), makeMap(1), 'a seed always makes the same map');
  ok(JSON.stringify(makeMap(1)) !== JSON.stringify(makeMap(2)), 'different seeds make different maps');
  for (let s = 1; s <= 60; s++) for (let step = 2; step <= STEPS; step++) {
    if ([4, 6, 9, 11, 14].includes(step) || BOSS_STEPS.includes(step)) continue;
    const row = makeMap(s).filter((n) => n.step === step);
    ok(row.filter((n) => n.kind === 'shop').length <= 1 && row.filter((n) => n.kind === 'rest').length <= 1, `seed ${s} step ${step}: no two shops or rests side by side`);
  }
  ok(placeOf(1) === 'meadow' && placeOf(4) === 'meadow' && placeOf(5) === 'creek' && placeOf(9) === 'frosty' && placeOf(13) === 'barn' && placeOf(15) === 'barn', 'the four places');
}

// ---- walls
for (let s = 1; s <= 25; s++) {
  const m = makeMap(s);
  for (const n of m) {
    if (n.kind === 'shop' || n.kind === 'rest') continue;
    const w = makeWall(s, n, {}, 'dora'), again = makeWall(s, n, {}, 'dora');
    ok(JSON.stringify(w.blocks) === JSON.stringify(again.blocks), 'a wall is built the same way every time');
    const need = w.blocks.filter((b) => BLOCKS[b.type].needed);
    if (n.kind === 'boss') {
      ok(w.boss && w.boss.hp === BOSSES[n.step].hp, `step ${n.step}: ${w.boss?.name} with ${w.boss?.hp} hp`);
      const fx = w.blocks.filter((b) => b.boss);
      ok(fx.length === BOSSES[n.step].rows.length * 5, 'the boss carries five blocks a row');
      ok(fx.every((b) => b.x - w.boss.amp >= 25 && b.x + b.w + w.boss.amp <= W - 25), 'the boss rows sway without squeezing a pebble against the sides');
      ok(w.boss.x - w.boss.amp >= 0 && w.boss.x + w.boss.w + w.boss.amp <= W, 'the boss stays on the field');
    } else {
      ok(need.length >= 10, `seed ${s} step ${n.step}: ${need.length} blocks to clear`);
      ok(w.blocks.every((b) => b.row <= wallRows(n.step, n.kind === 'elite')), 'rows within the wall size');
    }
    ok(w.blocks.every((b) => b.x - b.amp >= 0 && b.x + b.w + b.amp <= W && b.y + b.h < PADDLE_Y - 150), 'blocks sit well inside the field');
    // no two blocks overlap, even where sliding crates sway
    const span = (b) => [b.x - b.amp, b.x + b.w + b.amp];
    let clash = false;
    for (let i = 0; i < w.blocks.length; i++) for (let j = i + 1; j < w.blocks.length; j++) {
      const a = w.blocks[i], b = w.blocks[j]; if (a.row !== b.row) continue;
      const [a0, a1] = span(a), [b0, b1] = span(b); if (a0 < b1 && b0 < a1) clash = true;
    }
    ok(!clash, `seed ${s} step ${n.step}: blocks never overlap`);
    if (n.step < 5) ok(!w.blocks.some((b) => b.type === 'slide'), 'no sliding crates in the Meadow');
    if (placeOf(n.step) !== 'frosty' && placeOf(n.step) !== 'barn' && n.kind !== 'boss') ok(!w.blocks.some((b) => b.type === 'ice'), 'ice only from Frosty Ridge');
  }
}
{
  const m = makeMap(3), walls = m.filter((n) => n.kind === 'wall');
  ok(wallRows(1, false) === 4 && wallRows(15, false) === 10 && wallRows(14, true) === 12, 'walls grow from 4 rows to 12');
  ok(walls.some((n) => makeWall(3, n, {}, 'dora').blocks.length !== makeWall(3, walls[0], {}, 'dora').blocks.length), 'walls differ from each other');
  ok(makeWall(3, walls[0], { wide: 2 }, 'enzo').paddle.w === CHARS.enzo.width + 28 && makeWall(3, walls[0], {}, 'dora').paddle.w === CHARS.dora.width, 'bale widths for each chinchilla and Wide Bale');
}

// ---- geometry helpers
{
  const s = slab(0, 0, 10, 0, 5, -1, 8, 1); ok(s && near(s[0], 0.5, 1e-9, 'slab entry') === undefined && s[1] === 'x', 'a ray enters a box through its side');
  ok(slab(0, 0, 10, 0, 5, 2, 8, 4) === null, 'a ray that passes by misses');
  ok(slab(0, 0, 1, 0, 5, -1, 8, 1) === null, 'a box beyond the ray’s reach is missed');
  const t = slab(0, 0, 0, 10, -1, 4, 1, 6); ok(t && t[1] === 'y', 'a falling ray enters through the top');
  near(landing({ x: 100, y: 300, vx: 0, vy: 100, r: 5 }).x, 100, 1e-9, 'a straight drop lands below');
  near(landing({ x: 300, y: PADDLE_Y - 5 - 100, vx: 100, vy: 100, r: 5 }).x, 400 - 2 * (400 - (W - 5)), 1e-9, 'landing folds off the side wall');
  ok(landing({ x: 100, y: 200, vx: 0, vy: -100, r: 5 }).t > (200 + PADDLE_Y) / 100 - 0.2, 'a rising pebble is followed up to the top and back');
  const r1 = new Rng(9), r2 = new Rng(9); eq([r1.next(), r1.next(), r1.int(7)], [r2.next(), r2.next(), r2.int(7)], 'the generator replays');
  ok(hash(1, 2) !== hash(2, 1), 'the hash cares about order');
}

// ---- serving and the bale
{
  const g = lab();
  ok(g.wall.balls.length === 1 && g.wall.balls[0].held, 'a wall starts with a pebble held on the bale');
  steps(g, 30, () => ({ target: 100 }));
  near(g.wall.balls[0].x, g.wall.paddle.x, 1e-9, 'the held pebble rides on the bale');
  near(g.wall.paddle.x, Math.max(100, CHARS.dora.width / 2), 1e-9, 'the bale follows the pointer');
  ok(g.launch() && !g.wall.balls[0].held && g.wall.balls[0].vy < 0, 'launching sends it up');
  ok(!g.launch(), 'nothing to launch once it is away');
  const g2 = lab(); steps(g2, 120, () => ({ axis: 1, target: null }));
  ok(g2.wall.paddle.x === W - CHARS.dora.width / 2, 'the keys move the bale to the wall and no further');
  // the angle off the bale follows where the pebble lands on it
  for (const off of [-0.9, -0.5, 0, 0.4, 0.8]) {
    const g3 = lab(), P = g3.wall.paddle; P.x = 180;
    const b = aim(g3, 180 + off * P.w / 2, PADDLE_Y - 40, Math.PI); g3.update(); steps(g3, 30);
    near(Math.atan2(b.vx, -b.vy), off * MAX_ANGLE, 0.03, `landing ${off} along the bale sends it off at ${Math.round(off * 62)}°`);
  }
  // missing the bale loses the pebble
  const g4 = lab(); g4.wall.paddle.x = 60; aim(g4, 300, 400, Math.PI); steps(g4, 200);
  ok(g4.lives === LIVES.start - 1 && kinds(g4).includes('lost') && g4.wall.balls[0].held, 'a missed pebble costs one, and a new one is served');
  g4.lives = 1; aim(g4, 300, 400, Math.PI); g4.wall.paddle.x = 60; steps(g4, 200);
  ok(g4.phase === 'lost', 'the last pebble lost ends the run');
}

// ---- speed
{
  const g = lab(); const s0 = g.speed();
  near(s0, SPEED.base * CHARS.dora.speed, 1e-9, 'Dora’s pebble starts gentle');
  g.wall.serveClock = 30; near(g.speed(), s0 * (1 + 30 * SPEED.ramp), 1e-9, 'the pebble speeds up the longer a serve lasts');
  g.wall.serveClock = 999; near(g.speed(), s0 * (1 + SPEED.rampMax), 1e-9, 'but only up to a cap');
  const e = lab([], { char: 'enzo', ups: { breeze: 2 } }); near(e.speed(), SPEED.base * 0.84, 1e-9, 'Lazy Breeze slows the pebble 8% a stack');
  g.wall.step = 15; g.wall.serveClock = 0; near(g.speed(), s0 * (1 + 14 * SPEED.perStep), 1e-9, 'later steps are a little quicker');
}

// ---- never tunnelling: across many fast random rallies, a pebble's centre is never inside a solid block
{
  let worst = 0, outside = 0;
  for (let s = 1; s <= 6; s++) {
    const g = new PebbleGame(s, 'enzo'); g.go(g.choices()[0].id); const w = g.wall; w.serveClock = 1e4; g.launch();
    for (let i = 0; i < HZ * 40 && g.phase === 'wall'; i++) {
      const b0 = w.balls[0]; g.input.target = b0 ? landing(b0).x + Math.sin(i / 50) * 20 : 180; g.update();
      for (const b of w.balls) for (const k of w.blocks) if (k.alive && !BLOCKS[k.type].soft && k.type !== 'moss') {
        const dx = Math.max(k.x - b.x, 0, b.x - (k.x + k.w)), dy = Math.max(k.y - b.y, 0, b.y - (k.y + k.h));
        if (dx === 0 && dy === 0) worst++;
      }
      if (!w.balls.every((b) => b.x >= b.r - 1e-6 && b.x <= W - b.r + 1e-6 && b.y >= b.r - 1e-6)) outside++;
    }
  }
  ok(outside === 0, 'pebbles always stay inside the field');
  ok(worst === 0, `no pebble centre ever ends a step inside a block (${worst})`);
  // a single thin block in the way of a very fast pebble is still hit
  const g = lab([['crate', 5, 3], ['crate', 0, 0]]); g.wall.serveClock = 1e4; g.wall.step = 15; const b = aim(g, GRID_X + 5 * CELL_W + 15, 160, 0);
  b.vx = 0; steps(g, 60);
  ok(!g.wall.blocks[0].alive || g.phase === 'reward', 'a fast pebble pops the block in its way');
}

// ---- block types
{
  // crate: one hit, points and combo
  let g = lab([['crate', 5, 3], ['crate', 0, 0]]); aim(g, GRID_X + 5 * CELL_W + 15, 160, 0); steps(g, 60);
  ok(!g.wall.blocks[0].alive && g.score > 0 && g.wall.combo >= 1, 'a crate pops in one hit and scores');
  // ice: cracks, then pops
  g = lab([['ice', 5, 3], ['crate', 0, 0]]); aim(g, GRID_X + 5 * CELL_W + 15, 160, 0); steps(g, 60);
  ok(g.wall.blocks[0].alive && g.wall.blocks[0].hp === 1 && kinds(g).includes('crack'), 'ice cracks on the first hit');
  aim(g, GRID_X + 5 * CELL_W + 15, 160, 0); steps(g, 60);
  ok(!g.wall.blocks[0].alive, 'and pops on the second');
  // dust: soft, slows, poofs
  g = lab([['dust', 5, 3], ['crate', 0, 0]]); const b = aim(g, GRID_X + 5 * CELL_W + 15, 160, 0); steps(g, 50);
  ok(!g.wall.blocks[0].alive && b.vy < 0 && b.y < GRID_Y + 3 * CELL_H, 'the pebble rolls straight through a dust cloud and poofs it');
  ok(kinds(g).includes('dust') && b.slow < 1 && b.slow >= DUST_SLOW, 'and slows down for a moment');
  // moss: not needed, grows back
  g = lab([['moss', 5, 3], ['crate', 0, 0]]); aim(g, GRID_X + 5 * CELL_W + 15, 160, 0); steps(g, 60);
  ok(!g.wall.blocks[0].alive && g.wall.blocks[0].regrowAt > 0, 'moss pops');
  g.wall.balls[0].held = true; g.wall.lastNeeded = g.wall.clock; steps(g, Math.round(MOSS_REGROW * HZ));
  ok(g.wall.blocks[0].alive && kinds(g).includes('regrow'), `moss grows back after ${MOSS_REGROW} s`);
  g = lab([['moss', 5, 3], ['moss', 6, 3]]); g.update();
  ok(g.phase === 'reward', 'a wall with only moss left is cleared');
  // acorn piles drop acorns, caught on the bale
  g = lab([['acorn', 5, 3], ['crate', 0, 0]]); aim(g, GRID_X + 5 * CELL_W + 15, 160, 0); g.wall.paddle.x = GRID_X + 5 * CELL_W + 15; steps(g, 30);
  ok(g.wall.drops.length === ACORN_PILE && kinds(g).includes('drop'), `an acorn pile drops ${ACORN_PILE} acorns`);
  g.wall.balls[0].held = true; g.wall.balls[0].heldFor = 0; const a0 = g.acorns; steps(g, 4 * HZ, () => ({ target: GRID_X + 5 * CELL_W + 15 }));
  ok(g.acorns === a0 + ACORN_PILE && kinds(g).includes('acorn'), 'acorns that land on the bale are kept');
  g = lab([['acorn', 5, 3], ['crate', 0, 0]]); aim(g, GRID_X + 5 * CELL_W + 15, 160, 0); steps(g, 30); g.wall.balls[0].held = true; g.wall.paddle.x = 330; const a1 = g.acorns; steps(g, 4 * HZ, () => ({ target: 340 }));
  ok(g.acorns === a1 && g.wall.drops.length === 0, 'acorns that miss the bale roll away');
  // chain: pops all eight neighbours a moment later, and chains on into other chain blocks
  g = lab([['chain', 5, 3], ['crate', 4, 2], ['crate', 6, 4], ['chain', 5, 4], ['crate', 5, 5], ['crate', 8, 3], ['crate', 0, 0]]);
  aim(g, GRID_X + 5 * CELL_W + 15, 400, 0); g.wall.blocks[4].alive = false; // keep the way up clear
  let popAt = -1; for (let i = 0; i < 120 && popAt < 0; i++) { g.update(); if (!g.wall.blocks[0].alive) popAt = g.wall.clock; }
  ok(g.wall.blocks[1].alive, 'neighbours wait a moment'); steps(g, Math.ceil(CHAIN_DELAY * HZ) + 2);
  ok(!g.wall.blocks[1].alive && !g.wall.blocks[3].alive && kinds(g).includes('chain'), 'then a chain block pops its neighbours');
  steps(g, Math.ceil(CHAIN_DELAY * HZ) + 2);
  ok(!g.wall.blocks[2].alive, 'and the chain carries on through the next chain block');
  ok(g.wall.blocks[5].alive, 'blocks further away are left alone');
  // sliding crates move, and the pebble is pushed out of one that slides into it
  g = lab([['slide', 4, 3], ['crate', 0, 0]]); g.wall.blocks[0].amp = CELL_W; const x0 = g.wall.blocks[0].x; steps(g, 60);
  ok(g.wall.blocks[0].x !== x0, 'sliding crates sway');
}

// ---- combo
{
  const g = lab(Array.from({ length: 12 }, (_, i) => ['crate', 5, 11 - i]).concat([['crate', 0, 0]]));
  const a0 = g.acorns; aim(g, GRID_X + 5 * CELL_W + 15, 400, 0); g.take('burr'); g.take('burr'); g.take('burr'); g.wall.balls[0].pierce = 99; steps(g, 120);
  ok(g.wall.bestCombo >= 10 && kinds(g).includes('combo') && g.acorns >= a0 + 2, 'ten hits in a row earn acorns');
  g.wall.paddle.x = g.wall.balls[0].x; steps(g, 3 * HZ, () => ({ target: g.wall.balls[0]?.x ?? 180 }));
  ok(g.events.some((e) => e.k === 'paddle') && g.wall.combo < g.wall.bestCombo, 'touching the bale resets the combo');
}

// ---- upgrades
{
  ok(UP_IDS.length === 13 && UP_IDS.every((id) => UPGRADES[id].max >= 1 && PRICE[UPGRADES[id].rarity] > 0), 'thirteen upgrades with stacks and prices');
  const g = new PebbleGame(1, 'dora');
  for (let i = 0; i < 5; i++) g.take('wide');
  ok(g.has('wide') === UPGRADES.wide.max && !g.take('wide'), 'stacks stop at the most allowed');
  g.take('snack'); ok(g.maxLives === 4 && g.lives === 4, 'Hay Snack adds a pebble');
  // Split Pebble
  let s = lab([['crate', 0, 0]], { ups: { split: 1 } }); s.launch(); ok(s.wall.balls.length === 3, 'Split Pebble serves three');
  s = lab([['crate', 0, 0]], { ups: { split: 3 } }); s.launch(); ok(s.wall.balls.length === 5, 'three stacks serve five');
  ok(new Set(s.wall.balls.map((b) => Math.round(Math.atan2(b.vx, -b.vy) * 100))).size === 5, 'each split pebble takes its own angle');
  // Burr Ball: pierces popped blocks
  s = lab([['crate', 5, 5], ['crate', 5, 4], ['crate', 5, 3], ['crate', 0, 0]], { ups: { burr: 1 } });
  aim(s, GRID_X + 5 * CELL_W + 15, 170, 0); s.wall.balls[0].pierce = 2; steps(s, 40);
  ok(!s.wall.blocks[0].alive && !s.wall.blocks[1].alive && s.wall.blocks[2].alive === false, 'Burr Ball rolls through two popped blocks and pops the third');
  ok(s.wall.balls[0].vy > 0 || s.wall.balls[0].pierce === 0, 'then bounces as usual');
  // Snowball grows and hits harder
  s = lab([['crate', 0, 0]], { ups: { snowball: 2 } }); const b = s.wall.balls[0]; b.snow = 2.5; ok(s.damageOf(b) === 2, 'a grown Snowball hits for 2'); b.snow = 5; ok(s.damageOf(b) === 3, 'fully grown for 3');
  s = lab([['ice', 5, 3], ['crate', 0, 0]], { ups: { snowball: 1 } }); aim(s, GRID_X + 5 * CELL_W + 15, 160, 0); s.wall.balls[0].snow = 2.5; steps(s, 60);
  ok(!s.wall.blocks[0].alive, 'a big snowball pops ice in one hit');
  s = lab([['crate', 5, 3], ['crate', 0, 0]], { ups: { snowball: 1 } }); aim(s, GRID_X + 5 * CELL_W + 15, 160, 0); steps(s, 60); ok(s.wall.balls[0].snow === 0.5 && s.wall.balls[0].r === R + 0.5, 'each hit grows the snowball');
  // Sticky Paws
  s = lab([['crate', 0, 0]], { ups: { sticky: 1 } }); s.wall.paddle.x = 180; aim(s, 190, PADDLE_Y - 30, Math.PI); steps(s, 20);
  ok(s.wall.balls[0].held && kinds(s).includes('catch'), 'Sticky Paws catches the pebble');
  steps(s, 30, () => ({ target: 120 })); near(s.wall.balls[0].x - s.wall.paddle.x, 10, 1, 'and it rides where it landed');
  ok(s.launch() && !s.wall.balls[0].held && s.wall.balls[0].vx > 0, 'launching aims off the catch point');
  s = lab([['crate', 0, 0]], { ups: { sticky: 1 } }); s.wall.paddle.x = 180; aim(s, 180, PADDLE_Y - 30, Math.PI); steps(s, 2.2 * HZ);
  ok(s.wall.balls.length === 1 && (!s.wall.balls[0].held || s.wall.balls[0].heldFor < 0.5), 'a caught pebble lets go by itself after 2 s');
  // Dust Up Shield
  s = lab([['crate', 0, 0]], { ups: { shield: 2 } }); s.wall.paddle.x = 30; aim(s, 300, 450, Math.PI); steps(s, 60);
  ok(s.lives === LIVES.start && s.wall.shield === 1 && kinds(s).includes('shield'), 'the shield bounces a missed pebble once');
  // Spark
  s = lab([['crate', 5, 3], ['crate', 1, 0], ['crate', 9, 0]], { ups: { spark: 2 } }); aim(s, GRID_X + 5 * CELL_W + 15, 160, 0); steps(s, 60);
  ok(s.events.filter((e) => e.k === 'spark').length === 2 && !s.wall.blocks[1].alive && !s.wall.blocks[2].alive, 'two sparks fly to the two nearest blocks');
  // Pinecone Pop
  s = lab([['crate', 5, 3], ['crate', 4, 3], ['crate', 6, 3], ['crate', 0, 0]], { ups: { pinecone: 1 } }); s.wall.hits = 7; aim(s, GRID_X + 5 * CELL_W + 15, 160, 0); steps(s, 30);
  ok(kinds(s).includes('burst') && !s.wall.blocks[1].alive && !s.wall.blocks[2].alive, 'the 8th hit bursts the blocks beside it');
  // Comet Tail
  s = lab([['crate', 0, 0]], { ups: { comet: 1 } }); s.wall.combo = 4; ok(s.damageOf(null) === 1, 'no comet below a combo of 5'); s.wall.combo = 5; ok(s.damageOf(null) === 2, 'Comet Tail adds 1 from a combo of 5');
  // Acorn Magnet
  s = lab([['crate', 0, 0]], { ups: { magnet: 1 } }); s.wall.drops.push({ x: 40, y: 300, vx: 0, n: 1 }); s.wall.paddle.x = 300; const a0 = s.acorns; steps(s, 2 * HZ, () => ({ target: 300 }));
  ok(s.acorns === a0 + 1, 'the magnet pulls a far acorn onto the bale');
  // Enzo's spin
  s = lab([['crate', 0, 0]], { char: 'enzo' }); s.wall.paddle.x = 180; aim(s, 180, PADDLE_Y - 120, Math.PI);
  steps(s, 60, () => ({ charge: true, target: 200 }));
  const sb = s.wall.balls[0]; ok(sb.spin !== 0 && sb.vy < 0, 'a charged touch sends Enzo’s pebble off spinning');
  const vx0 = sb.vx; steps(s, 20, () => ({ charge: false })); ok(Math.sign(sb.vx - vx0) === Math.sign(sb.spin), 'and it curves the way it spins');
  ok(s.damageOf(sb) === 2, 'a spinning pebble hits harder');
  const d = lab([['crate', 0, 0]], { char: 'dora' }); steps(d, 30, () => ({ charge: true })); ok(d.wall.charge === 0, 'Dora has no spin to charge');
  const e2 = lab([['crate', 0, 0]], { char: 'enzo' }); steps(e2, Math.round(SPIN.charge * HZ) + 5, () => ({ charge: true })); ok(e2.wall.charge === 1, `a full charge takes ${SPIN.charge} s`);
  steps(e2, 1, () => ({ charge: false })); ok(e2.wall.charge === 0, 'letting go early loses the charge');
  // synergies
  const y = new PebbleGame(1, 'enzo'); y.take('snowball'); y.take('split'); y.take('sticky');
  ok(y.synergy('flurry') && y.synergy('spincatch') && !y.synergy('thorn'), 'synergies switch on with their pairs');
  ok(!(() => { const z = new PebbleGame(1, 'dora'); z.take('sticky'); return z.synergy('spincatch'); })(), 'Spin Catch is Enzo’s alone');
  s = lab([['crate', 0, 0]], { ups: { snowball: 1, split: 1 } }); s.launch(); ok(s.wall.balls.slice(1).every((x) => x.snow > 0), 'Snow Flurry: split pebbles start grown');
  s = lab([['crate', 5, 3], ['stout', 1, 0]], { ups: { spark: 1, burr: 1 } }); aim(s, GRID_X + 5 * CELL_W + 15, 160, 0); steps(s, 60);
  ok(!s.wall.blocks[1].alive || s.phase === 'reward', 'Thorn Sparks pop a stout crate in one spark');
}

// ---- after a wall: the reward, the shop and the rest stop
{
  const g = new PebbleGame(11, 'dora'); g.go(g.choices()[0].id); g.popAll(); const a0 = g.acorns; g.update();
  ok(g.phase === 'reward' && g.offer.length === 3 && new Set(g.offer).size === 3, 'clearing a wall offers three different upgrades');
  ok(g.acorns === a0 + REWARD.wall[0] + REWARD.wall[1] && g.walls === 1, 'and pays acorns for it');
  ok(g.events.some((e) => e.k === 'clear'), 'with a clear event');
  const id = g.offer[1]; ok(g.pick(1) && g.has(id) === 1 && g.phase === 'map', 'picking one takes it and goes back to the map');
  const g2 = new PebbleGame(11, 'dora'); g2.go(g2.choices()[0].id); g2.popAll(); g2.update(); const a1 = g2.acorns; ok(g2.skip() && g2.acorns === a1 + 5, 'skipping pays 5 acorns');
  // shop
  const m = g2.map, shopNode = m.find((n) => n.kind === 'shop');
  const s = new PebbleGame(11, 'dora'); s.at = m.find((n) => n.next.includes(shopNode.id)).id; s.acorns = 100; s.lives = 2;
  ok(s.go(shopNode.id) && s.phase === 'shop' && s.shop.length === 4, 'a shop sells three upgrades and a heal');
  ok(s.shop.filter((x) => x.kind === 'up').every((x) => x.price === PRICE[UPGRADES[x.id].rarity]), 'priced by rarity');
  const heal = s.shop.findIndex((x) => x.kind === 'heal'); ok(s.buy(heal) && s.lives === 3 && s.acorns === 100 - HEAL_PRICE, 'a heal gives back a pebble');
  ok(!s.buy(heal), 'each item sells once');
  const s2 = new PebbleGame(11, 'dora'); s2.at = m.find((n) => n.next.includes(shopNode.id)).id; s2.go(shopNode.id); ok(!s2.buy(s2.shop.findIndex((x) => x.kind === 'heal')), 'no heal with every pebble in hand (and no acorns)');
  ok(!s2.buy(0), 'nothing without acorns');
  s.acorns = 50; const before = s.shop.map((x) => x.kind === 'up' && x.id).join(); ok(s.reroll() && s.acorns === 42 && s.rerollPrice === 14, 'a reroll costs 8, then 6 more each time');
  ok(s.shop.length === 4 && s.shop[3].kind === 'heal' && s.shop[3].sold, 'a reroll keeps the heal as it was');
  void before;
  ok(s.leave() && s.phase === 'map', 'leaving the shop goes back to the map');
  // rest
  const restNode = m.find((n) => n.kind === 'rest'), r = new PebbleGame(11, 'dora'), before2 = m.find((n) => n.next.includes(restNode.id)).id;
  r.at = before2; r.lives = 1; r.go(restNode.id); ok(r.phase === 'rest', 'a rest stop');
  ok(r.rest('nap') && r.lives === r.maxLives, 'a nap fills every pebble');
  const r2 = new PebbleGame(11, 'dora'); r2.at = before2; r2.go(restNode.id); const ac = r2.acorns; r2.rest('nap'); ok(r2.acorns === ac + 10, 'a nap with every pebble finds 10 acorns');
  const r3 = new PebbleGame(11, 'dora'); r3.at = before2; r3.go(restNode.id); r3.rest('snack'); ok(r3.maxLives === 4 && r3.lives === 4, 'a snack adds a pebble');
  const r4 = new PebbleGame(11, 'dora'); r4.at = before2; r4.maxLives = LIVES.cap; r4.go(restNode.id); ok(!r4.rest('snack') && r4.phase === 'rest', 'no snack past the cap');
  ok(!r4.go(0) && !r4.pick(0) && !r4.buy(0), 'actions only work in their own phase');
}

// ---- a whole run: every step cleared in turn reaches the finale and wins
{
  const g = new PebbleGame(42, 'enzo'); let bosses = 0;
  while (g.phase !== 'won') {
    if (g.phase === 'map') g.go(g.choices()[g.choices().length - 1].id);
    else if (g.phase === 'wall') { if (g.wall.boss) bosses++; g.popAll(); g.update(); }
    else if (g.phase === 'reward') g.pick(0);
    else if (g.phase === 'shop') g.leave();
    else if (g.phase === 'rest') g.rest('nap');
  }
  ok(g.step === STEPS && bosses === 3 && g.walls >= 10, `a run of ${g.walls} walls and three bosses ends in a win`);
  ok(g.choices().length === 0, 'nothing to choose after the finale');
}

// ---- bosses
{
  const m = makeMap(8), node = m.find((n) => n.step === 5), g = new PebbleGame(8, 'dora'); g.at = m.find((n) => n.next.includes(node.id)).id; g.go(node.id);
  const w = g.wall, B = w.boss; ok(B.name === 'Captain Caw' && B.who === 'crow', 'the first boss is Captain Caw');
  steps(g, HZ * 2); ok(B.x !== W / 2 - B.w / 2, 'the boss sways side to side');
  const fx = w.blocks.filter((k) => k.boss); near(fx[0].x - fx[0].ox, B.x + B.w / 2 - W / 2, 1e-6, 'its rows move with it');
  for (const k of fx.filter((k) => k.row === 3)) k.alive = false; g.events.length = 0; w.lastNeeded = w.clock;
  steps(g, Math.ceil(B.rebuild * HZ)); ok(fx.filter((k) => k.row === 3).every((k) => k.alive) && kinds(g).includes('rebuild'), `it fills its lowest gap back in every ${B.rebuild} s`);
  const hp = B.hp; const b = aim(g, B.x + B.w / 2, B.y + B.h + 40, 0); for (const k of fx) k.alive = false; b.y = B.y + B.h + 20; steps(g, 10);
  ok(B.hp < hp && kinds(g).includes('boss'), 'a pebble that reaches the boss calms it a little');
  const lives = g.lives; B.hp = 1; g.lives = 2; aim(g, B.x + B.w / 2, B.y + B.h + 20, 0); steps(g, 10);
  ok(g.phase === 'reward' && g.lives === 3 && fx.every((k) => !k.alive), 'calming the boss clears the wall, poofs its rows and gives a pebble back');
  void lives;
}

// ---- help when stuck
{
  const g = lab([['crate', 10, 0], ['moss', 9, 1], ['moss', 10, 1], ['crate', 0, 6]]); aim(g, 100, 300, 0.3);
  g.wall.lastNeeded = -HELP_AFTER - 1; ok(g.stuck, `after ${HELP_AFTER} s without a needed hit the pebble is stuck`);
  steps(g, 2 * HZ, () => ({ target: g.wall.balls[0] ? landing(g.wall.balls[0]).x : 180 })); ok(kinds(g).includes('whisper'), 'and it starts getting help');
  ok(g.wall.blocks.filter((k) => k.type === 'moss').every((k) => !k.alive || k.regrowAt === 0), 'moss lets a stuck pebble through');
}

// ---- determinism: the same seed and inputs give the same run
{
  const run = () => {
    const g = new PebbleGame(77, 'enzo'); g.go(g.choices()[0].id); g.launch();
    for (let i = 0; i < HZ * 30 && g.phase === 'wall'; i++) {
      const b = g.wall.balls[0]; g.input.target = b ? landing(b).x + ((i % 97) - 48) * 0.3 : 180; g.input.charge = i % 400 < 150;
      if (b?.held) g.launch(); g.update();
    }
    return JSON.stringify({ w: g.wall?.blocks.map((k) => k.alive), b: g.wall?.balls, s: g.score, a: g.acorns, l: g.lives, p: g.phase });
  };
  ok(run() === run(), 'a seeded run with the same inputs replays exactly');
}

// ---- saving
{
  ok(SAVE_KEY === 'pebble-pop-v1', 'the save key is versioned');
  eq(readProfile(null), freshProfile(), 'no save, a fresh profile');
  for (const bad of ['', 'nope', '[]', 'null', '42', '{"bestFloor":"x"}']) { const p = readProfile(bad); ok(p.bestFloor === 0 && p.run === null, `a broken save (${bad}) reads fresh`); }
  const p = readProfile(JSON.stringify({ bestFloor: 99, bestScore: -5, runs: 3.7, wins: { dora: 2, enzo: 'x' }, discovered: ['split', 'nope', 'burr'], char: 'enzo', settings: { sound: false }, run: { v: 2 } }));
  ok(p.bestFloor === STEPS && p.bestScore === 0 && p.runs === 3 && p.wins.dora === 2 && p.wins.enzo === 0, 'numbers are clamped');
  eq(p.discovered, ['split', 'burr'], 'only real upgrades are remembered, in order');
  ok(p.char === 'enzo' && p.settings.sound === false && p.settings.shake === true && p.run === null, 'settings, the chinchilla, and a bad run dropped');
  // a run saved on the map picks up exactly where it left off
  const g = new PebbleGame(31, 'dora'); g.go(g.choices()[0].id); g.popAll(); g.update(); g.pick(0); g.acorns = 33;
  const snap = g.snapshot(); ok(snap && snap.at === g.at && snap.ups && snap.acorns === 33, 'a snapshot on the map');
  const back = readProfile(JSON.stringify({ ...freshProfile(), run: snap })).run; eq(back, snap, 'a saved run survives the round trip');
  const h = new PebbleGame(31, 'dora', back);
  eq(h.choices().map((n) => n.id), g.choices().map((n) => n.id), 'the resumed run stands at the same place on the map');
  const go = (x) => { x.go(x.choices()[0].id); x.popAll(); x.update(); return x.offer.join(); };
  ok(go(h) === go(g), 'and offers the same upgrades next');
  ok(readProfile(JSON.stringify({ run: { ...snap, at: 999 } })).run === null, 'a run pointing off the map is dropped');
  ok(readProfile(JSON.stringify({ run: { ...snap, ups: { wide: 9, bogus: 1 } } })).run.ups.wide === UPGRADES.wide.max, 'saved stacks are clamped');
  const w = new PebbleGame(1, 'dora'); w.go(w.choices()[0].id); ok(w.snapshot() === null, 'no snapshot in the middle of a wall');
  // finishing a run
  const prof = freshProfile(); const lost = new PebbleGame(5, 'enzo'); lost.go(lost.choices()[0].id); lost.take('spark'); lost.phase = 'lost'; lost.score = 1234;
  const news = record(prof, lost); ok(prof.runs === 1 && prof.bestFloor === 1 && prof.bestScore === 1234 && prof.discovered.includes('spark') && news.length === 0, 'a lost run is recorded');
  const won = new PebbleGame(5, 'dora'); won.phase = 'won'; won.score = 9999;
  const n2 = record(prof, won); ok(prof.wins.dora === 1 && prof.bestFloor === STEPS && n2.includes('FIRST WIN WITH DORA') && n2.includes('FURTHEST YET') && n2.includes('BEST SCORE'), 'a win is recorded with its news');
  const d = freshProfile(); const z = new PebbleGame(1, 'dora'); z.take('comet'); discover(d, z); eq(d.discovered, ['comet'], 'upgrades are discovered as they are taken');
}

// ---- little constants worth pinning
ok(W === 360 && H === 540 && PADDLE_Y === 500 && DT === 1 / 120 && COLS === 11, 'the field');
ok(LIVES.start === 3 && LIVES.cap === 6 && CHARS.dora.width > CHARS.enzo.width && CHARS.enzo.spin && !CHARS.dora.spin, 'lives and chinchillas');
ok(Object.values(BLOCKS).filter((b) => !b.needed).length === 1 && BLOCKS.dust.soft, 'moss is the only block you need not clear; dust is soft');

console.log(`Pebble Pop: ${checks} engine checks passed.`);
