// Tidepool's bots set the shell targets and prove the journal can be finished. The caretaker (sensible policies:
// sketch, bring creatures in, plant, place rocks, drop shells, shade with the plank, fetch seawater, shoo gulls, trim
// in autumn) must finish all 24 pages on every seed and reach the spring tide, and every page's three-shell target is
// set just above the slowest caretaker; the idle bot, which does nothing at all, must fail every page that needs care.
// Long cared-for pools in each season must stay stable: no extinction cascade over many tides.
// `--quick` plays fewer seeds and shorter pools (npm test runs it that way).
// Needs the engine compiled to .checks/ (npm run bot:tide does that).
import assert from 'node:assert/strict';
import { TideGame, PAGES, SPECIES, SEASONS } from '../.checks/tide-game.js';
import { caretaker, idleThrough, playOut } from './tide-bot-policy.mjs';

const quick = process.argv.includes('--quick');
const seeds = quick ? [1, 2, 3] : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
const worst = {}, rows = [];
for (const seed of seeds) {
  const g = playOut(new TideGame({ kind: 'story' }, seed), caretaker, 90);
  assert.ok(g.ended, `seed ${seed}: the caretaker reaches the spring tide`);
  for (const p of PAGES) {
    assert.ok(g.done[p.id], `seed ${seed}: the caretaker finishes “${p.title}”`);
    worst[p.id] = Math.max(worst[p.id] ?? 0, g.done[p.id].tide);
    if (p.id !== 24) assert.equal(g.done[p.id].shells, 3, `seed ${seed}: three shells for “${p.title}” (done in tide ${g.done[p.id].tide}, target ${p.shells[0]})`);
  }
  assert.ok(g.releasedKinds >= 7, `seed ${seed}: a full pool goes out on the spring tide (${g.releasedKinds} kinds)`);
  rows.push({ seed, tides: g.tideNo, shells: g.shellCount(), released: g.releasedKinds, deaths: g.stats.deaths, births: g.stats.births });
}
console.table(rows);
// the targets sit just above the slowest caretaker, so a careful player can earn every shell but must be on it
if (!quick) for (const p of PAGES) if (p.id !== 24) assert.ok(p.shells[0] <= Math.max(2, worst[p.id] + 2), `“${p.title}”: the three-shell target (${p.shells[0]}) is set from the bot (${worst[p.id]})`);
console.log('slowest caretaker tide per page:', JSON.stringify(worst));

// the idle bot never touches the pool: it must fail every page that needs care
for (const seed of seeds.slice(0, quick ? 2 : 6)) {
  const g = idleThrough(new TideGame({ kind: 'story' }, seed), quick ? 6 : 10);
  const passed = PAGES.filter((p) => g.done[p.id]);
  for (const p of passed) assert.ok(!p.care, `seed ${seed}: the idle bot should not finish “${p.title}”`);
  assert.ok(passed.length <= 6, `seed ${seed}: the idle bot finishes few pages (${passed.length})`);
  console.log(`idle seed ${seed}: ${passed.map((p) => p.title).join(', ') || 'nothing'}`);
}

// long cared-for pools stay stable in every season
for (const season of [0, 1, 2, 3]) {
  const tides = quick ? 15 : 45;
  const g = new TideGame({ kind: 'free', season }, 50 + season);
  let low = 99, lows = [];
  playOut(g, caretaker, tides, (q) => {
    if (q.tideNo > 3) { low = Math.min(low, q.kinds().length); }
    lows.push(q.kinds().length);
    for (const sp of SPECIES) assert.ok(q.count(sp) <= 12);
  });
  assert.ok(low >= 6, `${SEASONS[season].name}: a cared-for pool keeps at least 6 kinds for ${tides} tides (lowest ${low})`);
  assert.ok(g.kinds().length >= 7, `${SEASONS[season].name}: and ends with a full pool (${g.kinds().length} kinds)`);
  console.log(`free pool, ${SEASONS[season].name}, ${tides} tides: kinds ${lows.join(' ')}`);
}
console.log('PASS Tidepool bots');
