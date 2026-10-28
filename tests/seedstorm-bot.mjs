// A deterministic dodging bot that plays whole Seedstorm runs through the real engine. Every tick it copies the bullets
// near the pilot, plays them forward (bullets move deterministically), and tries each of the nine moves with focus on
// and off, picking the one that stays clear longest; ties go to flying under the boss or the critters, or toward
// seeds. When nothing is safe it tries two-part moves, and it Blooms when it can't escape or has just been hit.
// It proves Breezy and Gusty can be cleared, and a pilot who never moves loses early on Gusty. A slower, sloppier
// human-like pilot (see `human`) shows the normal settings are fair: Breezy is gentle and Gusty's first stage is kind.
// `node tests/seedstorm-bot.mjs` plays the full table; `--quick` plays the short check that `npm test` runs.
import assert from 'node:assert/strict';
import { SeedstormGame, Rng, moveBullet, bulletGone, W, H, HITBOX, BOUNDS, FOCUS_SLOW, STAGE_COUNT, HZ, PILOTS, UP_IDS, idleInput } from '../.checks/seedstorm-game.js';

const HORIZON = 22, NEAR = 160;
/** Extra clearance the bot keeps from every bullet; experiments can raise it to stand in for a less precise pilot. */
export const config = { margin: 1.6, sight: NEAR, max: 900 };
const D = Math.SQRT1_2;
const MOVES = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [D, D], [D, -D], [-D, D], [-D, -D]];
const scratch = Array.from({ length: 900 }, () => ({}));
const px = new Float32Array(900 * (HORIZON + 1)), py = new Float32Array(900 * (HORIZON + 1)), pr = new Float32Array(900);

/** Copies what can reach the pilot soon and plays it forward; returns how many things it tracks. */
function lookAhead(g) {
  const p = g.player; let n = 0;
  // what the pilot is watching: everything within sight, or (a human) only the nearest `max` of it, ignoring what has already gone past
  let seen = g.bullets.filter((b) => b.on && Math.abs(b.x - p.x) <= config.sight && Math.abs(b.y - p.y) <= config.sight && !(config.max < 900 && b.y > p.y + 12 && b.vy > 0));
  if (seen.length > config.max) seen = seen.map((b) => [Math.hypot(b.x - p.x, b.y - p.y), b]).sort((a, b) => a[0] - b[0]).slice(0, config.max).map((e) => e[1]);
  for (const b of seen) {
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

/**
 * A human-like pilot (continues allowed). It looks and decides only every 8 or 9 ticks (about 140 ms), watches just the
 * nearest 40 bullets within 110 units, keeps about 5 units clear, holds focus when 12 or more bullets are within 70
 * units, one look in five steers up to 25 degrees off what it meant (a seeded wobble), Blooms only when it notices a bullet within
 * 10 units at one of its looks (never in the last-gasp window), and shops like the main bot.
 */
const WOBBLE = 0.45; // radians, about 25 degrees
export function human(seed, diff, { stages = STAGE_COUNT } = {}) {
  const g = new SeedstormGame({ seed, pilot: seed % 2 ? 'dora' : 'enzo', diff }), inp = idleInput(), rng = new Rng(seed * 7919 + 17);
  const lost = Array(STAGE_COUNT).fill(0), keep = { ...config }, cont = [];
  Object.assign(config, { margin: 5, sight: 110, max: 40 });
  let next = 0;
  for (let i = 0; i < HZ * 60 * 40; i++) {
    if (g.phase === 'chat') { g.skipChat(); continue; }
    if (g.phase === 'shop') { if (g.stage >= stages) break; shop(g); continue; }
    if (g.phase === 'over' && g.continueRun()) { cont.push(g.stage); continue; }
    if (g.phase !== 'play') break;
    inp.bloom = false;
    if (i >= next) {
      next = i + (rng.next() < 0.5 ? 8 : 9);
      think(g, inp); inp.bloom = false;
      if (rng.next() < 0.2) { const a = Math.atan2(inp.dy, inp.dx) + (rng.next() - 0.5) * 2 * WOBBLE; if (inp.dx || inp.dy) { inp.dx = Math.cos(a); inp.dy = Math.sin(a); } }
      const p = g.player; let crowd = 0, close = false;
      for (const b of g.bullets) { if (!b.on) continue; const d = Math.hypot(b.x - p.x, b.y - p.y); if (d < 70) crowd++; if (d < 10 + b.r) close = true; }
      if (crowd >= 12) inp.focus = true;
      if (close && g.blooms > 0 && p.gasp === 0 && p.invuln === 0) inp.bloom = true;
    }
    const h = g.hearts; g.step(inp); g.events.length = 0; if (g.hearts < h) lost[g.stage - 1] += h - g.hearts;
  }
  Object.assign(config, keep);
  return { g, lost, cont };
}
function humanTable(diff, seeds) {
  const out = [];
  console.log(`\nHuman-like pilot, ${diff.toUpperCase()}`);
  console.log(' seed pilot  hearts lost per stage   total  continues  end');
  for (const seed of seeds) {
    const r = human(seed, diff), tot = r.lost.reduce((a, b) => a + b, 0);
    console.log(`${fmt(seed, 5)} ${r.g.pilot.padEnd(5)}  ${r.lost.map((n) => fmt(n, 2)).join(' ')}          ${fmt(tot, 5)}  ${fmt(r.g.continues, 9)}  ${r.g.phase === 'won' ? 'cleared' : `out on stage ${r.g.stage}`}${r.cont.length ? ` (continued on ${r.cont.join(', ')})` : ''}`);
    out.push({ seed, ...r, tot });
  }
  return out;
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
    // a human-like pilot gets through Gusty's first stage losing at most one heart
    for (const seed of [1, 2, 3]) {
      const h = human(seed, 'gusty', { stages: 1 });
      assert.ok(h.g.phase === 'shop' && h.lost[0] <= 1, `the human-like pilot clears Gusty stage 1 losing at most 1 heart (seed ${seed}: ${h.g.phase}, lost ${h.lost[0]})`);
    }
    console.log(`Passed: the bot clears Gusty (score ${g.score}, ${g.grazes} grazes), a human-like pilot clears Gusty stage 1, and standing still loses on stage ${idle.stage}.`);
  } else {
    const seeds = [1, 2, 3, 4, 5];
    for (const diff of ['breezy', 'gusty']) {
      const runs = table(diff, seeds), won = runs.filter((g) => g.phase === 'won').length;
      console.log(`${diff}: cleared ${won} of ${seeds.length}`);
      assert.ok(won >= 4, `the bot clears ${diff} for at least 4 of 5 seeds (${won})`);
    }
    // the human-like pilot: Breezy cleared losing at most 2 hearts on every seed; Gusty stage 1 losing at most 1, and stage 4 reached on most seeds
    const hs = [1, 2, 3, 4, 5, 6, 7, 8];
    for (const r of humanTable('breezy', hs)) assert.ok(r.g.phase === 'won' && r.tot <= 2, `the human-like pilot clears Breezy losing at most 2 hearts (seed ${r.seed}: ${r.g.phase}, lost ${r.tot})`);
    const gh = humanTable('gusty', hs);
    for (const r of gh) assert.ok(r.lost[0] <= 1 && (r.g.stage > 1 || r.g.phase === 'won'), `the human-like pilot clears Gusty stage 1 losing at most 1 heart (seed ${r.seed}: lost ${r.lost[0]})`);
    const far = gh.filter((r) => r.g.phase === 'won' || r.g.stage >= 4).length;
    console.log(`gusty: the human-like pilot reached stage 4 or beyond on ${far} of ${hs.length}`);
    assert.ok(far >= 6, `the human-like pilot reaches stage 4 on Gusty for most seeds (${far} of ${hs.length})`);
    humanTable('stormy', hs); // not asserted: Stormy may beat it
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
