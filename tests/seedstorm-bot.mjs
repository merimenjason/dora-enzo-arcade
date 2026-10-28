// A deterministic dodging bot that plays whole Seedstorm runs through the real engine. Every tick it copies the bullets
// near the pilot, plays them forward (bullets move deterministically), and tries each of the nine moves with focus on
// and off, picking the one that stays clear longest; ties go to flying under the boss or the critters, or toward
// seeds. When nothing is safe it tries two-part moves, and it Blooms when it can't escape or has just been hit.
// It proves Breezy and Gusty can be cleared, and a pilot who never moves loses early on Gusty.
// `node tests/seedstorm-bot.mjs` plays the full table; `--quick` plays the short check that `npm test` runs.
import assert from 'node:assert/strict';
import { SeedstormGame, moveBullet, bulletGone, W, H, HITBOX, BOUNDS, FOCUS_SLOW, STAGE_COUNT, HZ, PILOTS, UP_IDS, idleInput } from '../.checks/seedstorm-game.js';

const HORIZON = 22, NEAR = 160;
/** Extra clearance the bot keeps from every bullet; experiments can raise it to stand in for a less precise pilot. */
export const config = { margin: 1.6 };
const D = Math.SQRT1_2;
const MOVES = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [D, D], [D, -D], [-D, D], [-D, -D]];
const scratch = Array.from({ length: 900 }, () => ({}));
const px = new Float32Array(900 * (HORIZON + 1)), py = new Float32Array(900 * (HORIZON + 1)), pr = new Float32Array(900);

/** Copies what can reach the pilot soon and plays it forward; returns how many things it tracks. */
function lookAhead(g) {
  const p = g.player; let n = 0;
  for (const b of g.bullets) {
    if (!b.on || Math.abs(b.x - p.x) > NEAR || Math.abs(b.y - p.y) > NEAR) continue;
    const s = Object.assign(scratch[n], b); pr[n] = b.r + HITBOX + config.margin;
    for (let t = 1; t <= HORIZON; t++) { if (!bulletGone(s)) moveBullet(s, p.x, p.y); px[t * 900 + n] = s.x; py[t * 900 + n] = s.y; }
    n++;
  }
  // critter bodies and the boss, carried along at their current speed
  const bodies = g.critters.filter((c) => c.on).map((c) => [c.x, c.y, c.vx, c.vy, c.r * 0.55]);
  if (g.boss && (g.boss.state === 'fight' || g.boss.state === 'break')) bodies.push([g.boss.x, g.boss.y, g.boss.vx, g.boss.vy, g.boss.def.r * 0.5]);
  for (const [x, y, vx, vy, r] of bodies) {
    if (Math.abs(x - p.x) > NEAR || Math.abs(y - p.y) > NEAR || n >= 900) continue;
    pr[n] = r + HITBOX + config.margin + 3;
    for (let t = 1; t <= HORIZON; t++) { px[t * 900 + n] = x + vx * t; py[t * 900 + n] = y + vy * t; }
    n++;
  }
  return n;
}

/** Where the bot would like to be: under the boss or the lowest critter, otherwise near seeds, otherwise the middle. */
function wish(g) {
  const p = g.player, b = g.boss;
  if (b && b.state === 'fight') return [b.x, 520];
  let best = null, by = -1;
  for (const c of g.critters) if (c.on && c.y > 0 && c.y < 420 && c.y > by) { by = c.y; best = c; }
  if (best) return [best.x, 530];
  let sx = 0, sn = 0;
  for (const e of g.seeds) if (e.on && !e.pulled && e.y > 200) { sx += e.x; sn++; }
  if (sn) return [sx / sn, 560];
  return [W / 2, 550];
}

/** Scores a plan: `a` for `split` ticks, then `b`. Lower is better; a collision costs far more than anything else. */
function cost(g, n, a, b, focus, split, tx, ty) {
  const p = g.player, v = PILOTS[g.pilot].speed * (focus ? FOCUS_SLOW : 1);
  let x = p.x, y = p.y, c = 0;
  for (let t = 1; t <= HORIZON; t++) {
    const m = t <= split ? a : b;
    x = Math.max(BOUNDS.x0, Math.min(BOUNDS.x1, x + m[0] * v)); y = Math.max(BOUNDS.y0, Math.min(BOUNDS.y1, y + m[1] * v));
    const o = t * 900;
    for (let i = 0; i < n; i++) {
      const dx = px[o + i] - x, dy = py[o + i] - y, r = pr[i], d2 = dx * dx + dy * dy;
      if (d2 < r * r) return 1e6 * (HORIZON + 1 - t);
      const near = r + 9; if (d2 < near * near) c += (near - Math.sqrt(d2)) * (t < 8 ? 3 : 1);
    }
  }
  c += Math.abs(x - tx) * 0.5 + Math.abs(y - ty) * 0.25;
  if (x < 40) c += (40 - x) * 1.5; if (x > W - 40) c += (x - (W - 40)) * 1.5; if (y > H - 30) c += (y - (H - 30)) * 2;
  return c;
}

/** Picks this tick's input. */
export function think(g, inp) {
  const p = g.player, n = lookAhead(g), [tx, ty] = wish(g), boss = g.boss && g.boss.state === 'fight';
  let best = Infinity, move = MOVES[0], focus = false;
  for (const f of [false, true]) for (const m of MOVES) {
    const c = cost(g, n, m, m, f, HORIZON, tx, ty) - (f && boss ? 6 : 0);
    if (c < best) { best = c; move = m; focus = f; }
  }
  if (best >= 1e6) {
    for (const f of [false, true]) for (const a of MOVES) for (const b of MOVES) {
      const c = cost(g, n, a, b, f, 6, tx, ty);
      if (c < best) { best = c; move = a; focus = f; }
    }
  }
  inp.dx = move[0]; inp.dy = move[1]; inp.focus = focus; inp.tx = null; inp.ty = null;
  // Bloom: just hit (the last-gasp window), or a hit is certain within a few ticks
  inp.bloom = g.blooms > 0 && (p.gasp > 0 || (p.invuln === 0 && best >= 1e6 * (HORIZON - 3)));
  return inp;
}

/** Shop policy: power first, a heart when low, wings, then pouches and magnets. */
export function shop(g) {
  for (let guard = 0; guard < 20; guard++) {
    const order = [g.hearts <= 2 ? 'heart' : null, 'power', g.ups.power >= 3 ? 'wings' : null, 'heart', 'wings', 'pouch', 'magnet'].filter(Boolean);
    const id = order.find((u) => g.canBuy(u) === 'ok' && !(u === 'heart' && g.hearts >= 4 && g.ups.power < 4));
    if (!id || !g.buy(id)) break;
  }
  g.leaveShop();
}

/** Plays a whole run; `idle` stands still and never Blooms. Returns the game and a row per stage. */
export function play(seed, diff, pilot, { idle = false, stages = STAGE_COUNT } = {}) {
  const g = new SeedstormGame({ seed, pilot, diff }), inp = idleInput(), rows = [];
  let row = { stage: 1, lost: 0, ticks: 0, score: 0, peak: 0, hearts: g.hearts };
  for (let i = 0; i < HZ * 60 * 40; i++) {
    if (g.phase === 'chat') { g.skipChat(); continue; }
    if (g.phase === 'shop') {
      rows.push({ ...row, score: g.score, lost: row.lost, purse: g.purse });
      if (rows.length >= stages) break;
      if (!idle) shop(g); else g.leaveShop();
      row = { stage: g.stage, lost: 0, ticks: 0, score: 0, peak: 0, hearts: g.hearts };
      continue;
    }
    if (g.phase !== 'play') break;
    if (!idle) think(g, inp);
    const h = g.hearts; g.step(inp); g.events.length = 0;
    if (g.hearts < h) row.lost += h - g.hearts;
    row.ticks++; row.peak = Math.max(row.peak, g.bulletCount);
  }
  if (g.phase === 'won' || g.phase === 'over') rows.push({ ...row, score: g.score, purse: g.purse });
  return { g, rows };
}

/** A slower, less precise pilot (continues allowed): replans every 8 ticks, keeps 10 units clear, never Blooms. */
export function clumsy(seed, diff) {
  const g = new SeedstormGame({ seed, pilot: seed % 2 ? 'dora' : 'enzo', diff }), inp = idleInput(), lost = [0, 0, 0, 0, 0], keep = config.margin;
  config.margin = 10;
  for (let i = 0; i < HZ * 60 * 40; i++) {
    if (g.phase === 'chat') { g.skipChat(); continue; }
    if (g.phase === 'shop') { shop(g); continue; }
    if (g.phase === 'over' && g.continueRun()) continue;
    if (g.phase !== 'play') break;
    if (i % 8 === 0) think(g, inp);
    inp.bloom = false;
    const h = g.hearts; g.step(inp); g.events.length = 0; if (g.hearts < h) lost[g.stage - 1] += h - g.hearts;
  }
  config.margin = keep;
  return { g, lost };
}

const fmt = (n, w) => String(n).padStart(w);
function table(diff, seeds) {
  const out = [];
  console.log(`\n${diff.toUpperCase()}`);
  console.log(' seed pilot stage  lost  time   score  peak  purse  end');
  for (const seed of seeds) {
    const pilot = seed % 2 ? 'dora' : 'enzo', t0 = Date.now(), { g, rows } = play(seed, diff, pilot);
    for (const r of rows) console.log(`${fmt(seed, 5)} ${pilot.padEnd(5)} ${fmt(r.stage, 5)} ${fmt(r.lost, 5)} ${fmt((r.ticks / HZ).toFixed(0) + 's', 5)} ${fmt(r.score, 7)} ${fmt(r.peak, 5)} ${fmt(r.purse ?? '', 6)}  ${r === rows[rows.length - 1] ? g.phase : ''}`);
    console.log(`      → ${g.phase === 'won' ? 'cleared all five' : `out on stage ${g.stage}`}, ${g.hearts} hearts left, ups ${UP_IDS.filter((u) => u !== 'heart').map((u) => `${u} ${g.ups[u]}`).join(', ')}, ${g.grazes} grazes (${((Date.now() - t0) / 1000).toFixed(1)} s to simulate)`);
    out.push(g);
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const quick = process.argv.includes('--quick');
  if (quick) {
    // npm test: one seed clears Gusty, and a pilot who never moves loses before stage 3
    const { g } = play(1, 'gusty', 'dora');
    assert.equal(g.phase, 'won', `the bot clears Gusty with seed 1 (out on stage ${g.stage})`);
    const idle = play(1, 'gusty', 'dora', { idle: true }).g;
    assert.ok(idle.phase === 'over' && idle.stage <= 2, `standing still loses on Gusty before stage 3 (${idle.phase} on stage ${idle.stage})`);
    console.log(`Passed: the bot clears Gusty (score ${g.score}, ${g.grazes} grazes), and standing still loses on stage ${idle.stage}.`);
  } else {
    const seeds = [1, 2, 3, 4, 5];
    for (const diff of ['breezy', 'gusty']) {
      const runs = table(diff, seeds), won = runs.filter((g) => g.phase === 'won').length;
      console.log(`${diff}: cleared ${won} of ${seeds.length}`);
      assert.ok(won >= 4, `the bot clears ${diff} for at least 4 of 5 seeds (${won})`);
    }
    // not asserted: a clumsier pilot who reacts every 8 ticks, keeps 10 units clear and never Blooms, to show the patterns bite
    for (const diff of ['breezy', 'gusty', 'stormy']) for (const seed of [1, 2]) {
      const { g, lost } = clumsy(seed, diff);
      console.log(`Clumsy bot, ${diff} seed ${seed}: ${g.phase === 'won' ? 'cleared' : `out on stage ${g.stage}`}, hearts lost per stage ${lost.join(' ')}, continues ${g.continues}`);
    }
    for (const seed of [1, 2, 3, 4, 5]) {
      const idle = play(seed, 'gusty', seed % 2 ? 'dora' : 'enzo', { idle: true }).g;
      console.log(`Standing still, seed ${seed}: ${idle.phase} on stage ${idle.stage} after ${(idle.tick / HZ).toFixed(0)} s`);
      assert.ok(idle.phase === 'over' && idle.stage <= 2, `standing still loses on Gusty before the end of stage 2 (seed ${seed})`);
    }
    console.log('Passed: the bot clears Breezy and Gusty, and standing still loses early.');
  }
}
