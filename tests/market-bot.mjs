// Night Market's bots play whole moon months and free markets. A bot that reads the tells buys and sells sensibly
// and reaches the lantern boat comfortably; a greedy bot that always asks the top of the dial and a giveaway bot
// that always sells cheap both do noticeably worse. The boat's price, the weekly lantern goals and the free market's
// goals in lib/market-game.ts were set from these runs. `--quick` plays fewer seeds (for npm test).
import assert from 'node:assert/strict';
import * as G from '../.checks/market-game.js';
import { play } from './market-bot-policy.mjs';

const quick = process.argv.includes('--quick');
const SEEDS = quick ? 8 : 40;
const runs = {};
for (const policy of ['reader', 'greedy', 'giveaway']) {
  runs[policy] = [];
  for (let i = 1; i <= SEEDS; i++) runs[policy].push(play(G, i * 7919, policy));
}
const sorted = (a) => [...a].sort((x, y) => x - y);
const median = (a) => sorted(a)[Math.floor(a.length / 2)];
const stat = (policy, f) => runs[policy].map(f);
const report = (policy) => {
  const purse = stat(policy, (s) => s.purse), lan = stat(policy, (s) => G.totalLanterns(s));
  const weeks = [0, 1, 2, 3].map((w) => median(stat(policy, (s) => s.weeks[w]?.profit ?? 0)));
  console.log(`${policy.padEnd(8)} purse median ${median(purse)} (min ${sorted(purse)[0]}, max ${sorted(purse).at(-1)}), boats ${runs[policy].filter((s) => s.boat).length}/${SEEDS}, lanterns median ${median(lan)}/12, weekly profit medians ${weeks.join(' / ')}, rep median ${median(stat(policy, (s) => s.rep))}`);
};
for (const p of Object.keys(runs)) report(p);

const reader = stat('reader', (s) => s.purse), greedy = stat('greedy', (s) => s.purse), give = stat('giveaway', (s) => s.purse);
assert.ok(runs.reader.every((s) => s.boat), 'the tell-reading bot buys the lantern boat every time');
assert.ok(sorted(reader)[0] >= G.BOAT * 1.1, `and comfortably (lowest purse ${sorted(reader)[0]} against the boat's ${G.BOAT})`);
assert.ok(runs.greedy.every((s) => !s.boat) && median(greedy) < median(reader) * 0.3, 'always asking the most drives everyone away');
assert.ok(runs.giveaway.filter((s) => s.boat).length <= SEEDS * 0.1 && median(give) < median(reader) * 0.6, 'giving wares away never saves enough');
const lan = (p) => median(stat(p, (s) => G.totalLanterns(s)));
assert.ok(lan('reader') >= 8 && lan('reader') < 12, `the reader earns most lanterns but not all (${lan('reader')})`);
assert.ok(lan('greedy') <= 2 && lan('giveaway') <= lan('reader') - 4, 'the naive bots earn far fewer lanterns');
for (let w = 0; w < 4; w++) {
  const [a, b] = G.WEEK_GOALS[w];
  const rp = stat('reader', (s) => s.weeks[w].profit);
  assert.ok(rp.filter((x) => x >= a).length >= SEEDS * 0.85, `week ${w + 1}: the first lantern is in reach of a sensible stall`);
  assert.ok(rp.filter((x) => x >= b).length <= SEEDS * 0.75, `week ${w + 1}: the second lantern takes sharper haggling than the bot's`);
  assert.ok(median(stat('giveaway', (s) => s.weeks[w].profit)) < a, `week ${w + 1}: giving wares away misses the first lantern`);
}
// the free market
const free = (p) => Array.from({ length: SEEDS }, (_, i) => play(G, i * 31 + 1, p, 'free'));
const fr = free('reader').map((s) => s.weeks[0].profit), fg = free('giveaway').map((s) => s.weeks[0].profit);
console.log(`free market: reader profit median ${median(fr)}, giveaway ${median(fg)}; goals ${G.FREE_GOALS.join(' / ')}`);
assert.ok(median(fr) >= G.FREE_GOALS[0] && median(fg) < G.FREE_GOALS[0], 'the free market goals sit between the bots');
console.log('market bots: all checks passed');
