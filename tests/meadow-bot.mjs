// Meadowmend's bots set the acorn targets. Each valley is a fixed deal, so every bot's score is exact. In every valley
// a player who never looks at the edges (naive, three seeds) must stay below the first acorn; a casual player who
// takes the best turn at a few cells must reach about the first acorn; the greedy bot must earn at least one; and the
// best of the smart bot's three styles must reach the third, which asks for more than a casual player gets. Perfects
// must be earned (not every other tile) and the stack must last well past its start for a good player.
// Prints a table of scores. `--quick` skips the smart bot and the casual seeds (npm test runs it that way).
// Needs the engine compiled to .checks/ (npm run bot:meadow does that).
import assert from 'node:assert/strict';
import { MeadowGame, VALLEYS, VALLEY_IDS } from '../.checks/meadow-game.js';
import { naive, casual, greedy, smartWith, SMART_STYLES, playOut } from './meadow-bot-policy.mjs';

const quick = process.argv.includes('--quick');
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };
const rows = [];
for (const id of VALLEY_IDS) {
  const V = VALLEYS[id], [a1, a2, a3] = V.acorns, deal = () => new MeadowGame({ kind: 'valley', valley: id });
  const nv = Math.max(...[1, 2, 3].map((s) => playOut(deal(), naive(s)).score));
  const gr = playOut(deal(), greedy);
  const row = { valley: V.name, acorns: V.acorns.join(' / '), naive: nv, greedy: `${gr.score} (${gr.acorns()}🌰) · ${gr.stats.placed} tiles · ${gr.stats.perfects} Perfects · ${gr.stats.wishesDone} wishes` };
  assert.ok(nv < a1, `${V.name}: a player who ignores the edges stays below the first acorn (${nv} vs ${a1})`);
  assert.ok(gr.score >= a1, `${V.name}: the greedy bot earns an acorn (${gr.score} vs ${a1})`);
  assert.ok(gr.stats.placed > V.tiles, `${V.name}: a good player's stack lasts past its start (${gr.stats.placed} placed from ${V.tiles})`);
  assert.ok(gr.stats.perfects < gr.stats.placed / 2, `${V.name}: Perfects are earned, not every other tile (${gr.stats.perfects} of ${gr.stats.placed})`);
  if (!quick) {
    const cs = med([1, 2, 3, 4, 5].map((s) => playOut(deal(), casual(s)).score));
    const sm = SMART_STYLES.map((st) => playOut(deal(), smartWith(st)));
    const best = sm.reduce((a, b) => (b.score > a.score ? b : a));
    Object.assign(row, { casual: cs, smart: `${best.score} (${best.acorns()}🌰) · ${best.stats.placed} tiles · ${best.stats.perfects} Perfects · ${best.stats.wishesDone} wishes · ${best.stats.ponds} ponds` });
    assert.ok(best.score >= a3, `${V.name}: the smart bot reaches three acorns (${best.score} vs ${a3})`);
    assert.ok(cs >= a1 * 0.9 && cs < a2, `${V.name}: a casual player is about the first acorn (${cs} vs ${a1}, ${a2})`);
    assert.ok(best.stats.placed < V.tiles * 4, `${V.name}: even a good run ends (${best.stats.placed} tiles)`);
  }
  rows.push(row);
}
console.table(rows);

// the Endless Meadow lasts a good while for a good player and ends for a careless one
for (const seed of [1, 2]) {
  const g = playOut(new MeadowGame({ kind: 'endless', seed, daily: false }), greedy), r = playOut(new MeadowGame({ kind: 'endless', seed, daily: false }), naive(seed));
  console.log(`Endless Meadow seed ${seed}: greedy ${g.score} over ${g.stats.placed} tiles; naive ${r.score} over ${r.stats.placed}`);
  assert.ok(g.stats.placed > 40 && g.score > r.score * 4);
}
console.log('PASS meadow bots');
