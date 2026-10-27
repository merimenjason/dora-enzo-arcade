// Pebble Pop bots: a seeded paddle player that predicts where the pebble will land and angles it at the lowest blocks,
// playing whole runs through the engine. A careful bot should win a good share of runs with either chinchilla, a
// sloppy one (late to react, a little off, on the keys) should get less far, and every run should replay exactly.
import assert from 'node:assert/strict';
import { PebbleGame, PADDLE_Y, MAX_ANGLE, BLOCKS, STEPS, HZ, landing, UPGRADES } from '../.checks/pebble-game.js';

const rng = (seed) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const gauss = (r) => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const SKILLS = {
  careful: { delay: 8, error: 5, lapse: 0.025, keys: false, smart: true, spin: 0.3 },
  sloppy: { delay: 18, error: 19, lapse: 0.03, keys: true, smart: false, spin: 0 },
};
const LIKES = ['split', 'wide', 'burr', 'spark', 'shield', 'snowball', 'pinecone', 'comet', 'snack', 'breeze', 'magnet', 'clover', 'sticky'];
/** Lapses are the misses even a careful player makes: the bot reads the landing a whole bale off. */
/** The most steps a wall may take before the bot calls it stuck (ten minutes of play). */
const WALL_LIMIT = HZ * 600;

export function play(seed, char, skillName) {
  const S = SKILLS[skillName], r = rng(seed * 31 + (char === 'enzo' ? 7 : 3) + (S.smart ? 1 : 2)), g = new PebbleGame(seed, char);
  const log = { walls: [], seconds: 0, longest: 0, slowStep: 0 };
  while (g.phase !== 'won' && g.phase !== 'lost') {
    if (g.phase === 'map') {
      const opts = g.choices();
      const score = (n) => {
        if (!S.smart) return r();
        const missing = g.maxLives - g.lives;
        return { rest: missing >= 1 ? 3 + missing : 0.2, shop: g.acorns >= 45 ? 2.5 : 0.1, elite: g.lives >= 3 ? 1.6 : 0.4, wall: 1, boss: 1 }[n.kind] + r() * 0.3;
      };
      g.go(opts.reduce((a, b) => (score(b) > score(a) ? b : a)).id);
    } else if (g.phase === 'reward') {
      if (S.smart) g.pick(g.offer.reduce((bi, id, i) => (LIKES.indexOf(id) < LIKES.indexOf(g.offer[bi]) ? i : bi), 0));
      else g.pick(Math.floor(r() * g.offer.length));
    } else if (g.phase === 'shop') {
      if (g.lives < g.maxLives) { const h = g.shop.findIndex((s) => s.kind === 'heal'); g.buy(h); }
      const order = g.shop.map((s, i) => [s, i]).filter(([s]) => s.kind === 'up').sort((a, b) => LIKES.indexOf(a[0].id) - LIKES.indexOf(b[0].id));
      for (const [, i] of order) g.buy(i);
      g.leave();
    } else if (g.phase === 'rest') {
      g.rest(g.maxLives - g.lives >= 2 || g.maxLives >= 6 ? 'nap' : 'snack');
    } else if (g.phase === 'wall') {
      const w0 = g.wall, start = w0.clock; let steps = 0, err = gauss(r) * S.error, spinNow = false;
      const past = [];
      while (g.phase === 'wall' && g.wall === w0) {
        const w = g.wall, P = w.paddle;
        // what the bot "sees": the pebbles as they were a few steps ago
        past.push(w.balls.map((b) => ({ ...b }))); if (past.length > S.delay + 1) past.shift();
        const seen = past[0];
        if (w.balls.some((b) => b.held) && steps % 12 === 11) g.launch();
        let goal = P.x;
        const coming = seen.filter((b) => !b.held && b.vy > 0).map((b) => ({ b, l: landing(b) })).sort((a, b) => a.l.t - b.l.t)[0];
        const any = coming ?? seen.filter((b) => !b.held).map((b) => ({ b, l: landing(b) })).sort((a, b) => a.l.t - b.l.t)[0];
        if (any) {
          const xl = any.l.x + err;
          // aim: the lowest block still needed (or the boss), the one nearest above the landing spot
          let tx = 180, ty = 60;
          if (w.boss && w.boss.hp > 0) {
            const gap = w.blocks.filter((k) => k.boss && k.alive).length; tx = w.boss.x + w.boss.w / 2; ty = w.boss.y + w.boss.h; if (gap > 8) { tx = xl < 180 ? 20 : 340; ty = 30; }
          } else {
            let best = null, bs = -Infinity;
            for (const k of w.blocks) if (k.alive && BLOCKS[k.type].needed) { const s = k.y - Math.abs(k.x + k.w / 2 - xl) * 0.25; if (s > bs) { bs = s; best = k; } }
            if (best) { tx = best.x + best.w / 2; ty = best.y + best.h / 2; }
          }
          const o = clamp(Math.atan2(tx - xl, PADDLE_Y - ty) / MAX_ANGLE, -0.8, 0.8);
          goal = any.l.t < 1.4 || !S.smart ? xl - o * (P.w / 2) : xl;
        }
        if (S.keys) { const d = goal - P.x; g.input.target = null; g.input.axis = Math.abs(d) < 4 ? 0 : Math.sign(d); }
        else { g.input.target = goal; g.input.axis = 0; }
        g.input.charge = spinNow && !!coming && coming.l.t < 1;
        g.update(); steps++;
        // after each touch of the bale: a fresh small misjudgement, and now and then a proper lapse
        if (g.events.some((e) => e.k === 'paddle' || e.k === 'serve')) { err = r() < S.lapse ? (r() < 0.5 ? -1 : 1) * (P.w / 2 + 12) : gauss(r) * S.error; spinNow = r() < S.spin; }
        g.events.length = 0;
        if (steps === WALL_LIMIT - 1 && process.env.VERBOSE) console.log(JSON.stringify({ needed: g.needed(), lives: g.lives, last: w.lastNeeded, clock: w.clock, balls: w.balls, P: w.paddle, alive: w.blocks.filter((k) => k.alive).map((k) => [k.type, k.col, k.row, k.hp]) }));
        assert.ok(steps < WALL_LIMIT, `seed ${seed} ${char} ${skillName}: wall ${w0.step} did not finish in ten minutes`);
      }
      const secs = steps / HZ; log.seconds += secs; if (secs > log.longest) { log.longest = secs; log.slowStep = w0.step; } log.walls.push(Math.round(secs));
      void start;
    }
  }
  return { won: g.phase === 'won', floor: g.phase === 'won' ? STEPS : g.step, score: g.score, acorns: g.acorns, ups: { ...g.ups }, lives: g.lives, log };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const N = Number(process.env.SEEDS ?? 16), rows = [];
  const sum = { careful: { dora: 0, enzo: 0 }, sloppy: { dora: 0, enzo: 0 } }, floors = { careful: 0, sloppy: 0 };
  let longest = 0, minutes = 0, slowest = '';
  for (const skill of ['careful', 'sloppy']) for (const char of ['dora', 'enzo']) for (let s = 1; s <= N; s++) {
    const res = play(s * 101, char, skill);
    sum[skill][char] += res.won ? 1 : 0; floors[skill] += res.floor; if (res.log.longest > longest) { longest = res.log.longest; slowest = `${skill} ${char} seed ${s * 101} step ${res.log.slowStep}`; } minutes += res.log.seconds / 60;
    if (process.env.VERBOSE) rows.push({ skill, char, seed: s * 101, won: res.won, floor: res.floor, lives: res.lives, minutes: +(res.log.seconds / 60).toFixed(1), ups: Object.entries(res.ups).map(([k, v]) => k + v).join(' ') });
  }
  if (rows.length) console.table(rows);
  const again = play(303, 'enzo', 'careful'), again2 = play(303, 'enzo', 'careful');
  assert.deepEqual(again, again2, 'a seeded run replays exactly');
  void UPGRADES;
  const careful = sum.careful.dora + sum.careful.enzo, sloppy = sum.sloppy.dora + sum.sloppy.enzo;
  console.log(`Pebble Pop bot: careful wins Dora ${sum.careful.dora}/${N}, Enzo ${sum.careful.enzo}/${N}; sloppy wins Dora ${sum.sloppy.dora}/${N}, Enzo ${sum.sloppy.enzo}/${N}; average floor ${(floors.careful / N / 2).toFixed(1)} vs ${(floors.sloppy / N / 2).toFixed(1)}; ${(minutes / N / 4).toFixed(1)} min a run; longest wall ${longest.toFixed(0)} s (${slowest}); runs replay exactly.`);
  assert.ok(sum.careful.dora >= N * 0.5, `a careful Dora wins at least half her runs (${sum.careful.dora}/${N})`);
  assert.ok(sum.careful.enzo >= N * 0.4, `a careful Enzo wins a good share of runs (${sum.careful.enzo}/${N})`);
  assert.ok(sloppy < careful * 0.6, `a sloppy player wins clearly less (${sloppy} vs ${careful})`);
  assert.ok(floors.sloppy < floors.careful, 'a sloppy player gets less far on average');
  assert.ok(longest < 300, `no wall drags on (longest ${longest.toFixed(0)} s)`);

}
