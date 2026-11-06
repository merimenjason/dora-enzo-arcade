// Snowball Siege bots, playing our side through the engine against each slope's rivals, with human reaction times
// (12–15 ticks) and aim error. The pro digs its walls sensibly, aims at the flag tower and picks off anyone standing;
// the casual player aims worse and digs the front wall carelessly; the turtle plays like the pro but never touches its
// walls, only the floor snow; the random player throws anywhere. The casual player should win the first two slopes
// almost always and Windy Ridge about half the time; the pro at least 60% of every slope (40% of the Summit); the
// turtle never digs a wall and loses clearly to the pro head to head (the core trade matters); the random player never
// wins past the first slope. Run after `npm test` has compiled the engines into .checks/ (or `npm run bot:snowball`).
import assert from 'node:assert/strict';
import { Match, SLOPES, MATCH_TICKS, TICK } from '../.checks/snowball-game.js';

const quick = process.argv.includes('--quick');
const N = quick ? 12 : 30;
const play = (slope, seed, bot, rival) => { const m = new Match(slope, seed, { humans: [false, false], bot, rival }); while (!m.over && m.t < MATCH_TICKS + 1) m.step(); return m; };

const table = {};
for (const bot of ['casual', 'pro', 'turtle', 'random']) {
  table[bot] = SLOPES.map((sl) => {
    let wins = 0, secs = 0, dug = 0;
    for (let k = 0; k < N; k++) { const m = play(sl.id, 1000 + k * 37, bot); if (m.winner === 0) wins++; secs += m.t / TICK; dug += m.stats.dug[0]; }
    return { wins, secs: secs / N, dug };
  });
  console.log(bot.padEnd(7), table[bot].map((r, i) => `${SLOPES[i].id}:${r.wins}/${N} ${r.secs.toFixed(0)}s`).join('  '));
}
const share = (bot, i) => table[bot][i].wins / N;

// head to head, both sides of the valley
let proWins = 0, games = 0;
for (const sl of SLOPES) for (let k = 0; k < Math.ceil(N / 3); k++) {
  const a = play(sl.id, 500 + k * 11, 'pro', 'turtle'); if (a.winner === 0) proWins++;
  const b = play(sl.id, 900 + k * 11, 'turtle', 'pro'); if (b.winner === 1) proWins++;
  games += 2;
}
console.log(`pro vs turtle: the pro wins ${proWins}/${games}`);

const avg = SLOPES.map((_, i) => table.pro[i].secs).reduce((a, b) => a + b) / SLOPES.length;
console.log(`a pro's match lasts ${avg.toFixed(0)} s on average`);

assert.ok(share('casual', 0) >= 0.8 && share('casual', 1) >= 0.8, 'casual wins the first two slopes almost always');
assert.ok(share('casual', 2) >= 0.25 && share('casual', 2) <= 0.85, 'casual wins Windy Ridge about half the time');
for (let i = 0; i < SLOPES.length; i++) assert.ok(share('pro', i) >= (i === 5 ? 0.4 : 0.6), `pro wins ${SLOPES[i].id} often enough`);
assert.ok(table.turtle.every((r) => r.dug === 0), 'the turtle never digs a wall');
assert.ok(proWins / games >= 0.7, 'the turtle loses clearly to the pro');
for (let i = 1; i < SLOPES.length; i++) assert.equal(table.random[i].wins, 0, `random never wins ${SLOPES[i].id}`);
assert.ok(avg >= 25 && avg <= 110, 'matches last about a minute or two');
console.log('PASS Snowball Siege bot thresholds');
