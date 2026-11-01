// Wind-Up Rally's bots set the ladder's difficulty and prove it is fair. A competent player (the same planner the toys
// use, with a friend's style: quick to react, a good swing, winds its key between points) must beat every toy on the
// ladder in a fair share of seeded matches, and the music-box bear must be the hardest. A button-masher that runs back
// and forth swinging at nothing must lose to every toy past the first, and a player that stands still loses to all of
// them. Rallies must have healthy lengths: neither one-hit points nor endless loops. Doubles must be winnable.
// `--quick` plays fewer seeds (npm test runs it that way). The medal and win-rate notes in docs/rally.md come from
// the full run.
// Needs the engine compiled to .checks/ (npm run bot:rally does that).
import assert from 'node:assert/strict';
import * as G from '../.checks/rally-game.js';

const quick = process.argv.includes('--quick');
const N = quick ? 12 : 60;
const seeds = Array.from({ length: N }, (_, i) => (i + 1) * 7919);

const competent = (m, i) => G.aiInput(m, i);
const idle = () => G.IDLE;
const masher = () => { let k = 0; return () => { k++; return { move: (Math.floor(k / 40) % 3) - 1, hop: k % 50 === 0, swing: k % 12 === 0, wind: false }; }; };

function ladder(policy) {
  const rows = [];
  for (const t of G.TOYS) {
    let wins = 0, key = 0, margin = 0, mins = 0, runouts = 0; const rallies = [];
    for (const seed of seeds) {
      const m = G.newMatch({ mode: 'ladder', seed, who: seed % 2 ? 'dora' : 'enzo', foe: t.id });
      G.playMatch(m, policy === masher ? masher() : policy);
      assert.equal(m.phase, 'over', `${t.id} seed ${seed}: the match finishes`);
      const md = G.medalsFor(m);
      wins += +md.win; key += +md.key; margin += +md.margin; mins += m.t / 60; runouts += +m.players[0].ranOut;
      rallies.push(...m.rallies);
    }
    rallies.sort((a, b) => a - b);
    rows.push({ toy: t.id, win: wins / N, key: key / N, margin: margin / N, median: rallies[rallies.length >> 1], one: rallies.filter((r) => r <= 1).length / rallies.length, longest: rallies.at(-1), mins: mins / N, runouts: runouts / N });
  }
  return rows;
}
const pct = (v) => `${Math.round(v * 100)}%`;
const show = (label, rows) => { console.log(label); console.table(rows.map((r) => ({ ...r, win: pct(r.win), key: pct(r.key), margin: pct(r.margin), one: pct(r.one), mins: r.mins.toFixed(1), runouts: pct(r.runouts) }))); };

// ---- the competent player climbs the whole ladder
const good = ladder(competent);
show('competent player', good);
const floor = quick ? { robot: 0.75, frog: 0.65, duck: 0.4, top: 0.4, knight: 0.35, penguin: 0.25, bear: 0.08 }
  : { robot: 0.92, frog: 0.88, duck: 0.62, top: 0.62, knight: 0.6, penguin: 0.45, bear: 0.25 };
for (const r of good) assert.ok(r.win >= floor[r.toy], `the competent player beats ${r.toy} often enough (${pct(r.win)} < ${pct(floor[r.toy])})`);
const bear = good.find((r) => r.toy === 'bear');
assert.ok(good.every((r) => r.toy === 'bear' || r.win > bear.win), 'the music-box bear is the hardest toy on the ladder');
if (!quick) assert.ok(bear.win <= 0.6, `the bear is a real final (${pct(bear.win)})`);
assert.ok(good[0].win >= good.at(-2).win, 'the first rung is easier than the last but one');
// rallies are healthy: real exchanges, no one-hit points and no endless loops
for (const r of good) {
  assert.ok(r.median >= 4 && r.median <= 16, `${r.toy}: a healthy rally length (median ${r.median} hits)`);
  assert.ok(r.one <= 0.05, `${r.toy}: hardly any one-hit points (${pct(r.one)})`);
  assert.ok(r.longest < 120, `${r.toy}: no endless rallies (longest ${r.longest})`);
}
// the medals: every medal is earnable, and the key medal asks for care against the later toys
for (const r of good) assert.ok(r.key > 0 && r.margin > 0, `${r.toy}: the key and margin medals are earnable`);
if (!quick) assert.ok(good.at(-1).key < good[0].key, 'keeping the key wound is harder against the champion');
console.log('competent win rates:', good.map((r) => `${r.toy} ${pct(r.win)}`).join(', '));

// ---- naive play does not win
const mash = ladder(masher);
show('button-masher', mash);
for (const r of mash.slice(1)) assert.ok(r.win <= 0.05, `the button-masher loses to ${r.toy} (${pct(r.win)})`);
const still = ladder(idle);
for (const r of still) assert.equal(r.win, 0, `standing still loses to ${r.toy}`);
console.log('standing still: lost every match');

// ---- doubles is winnable with the computer as your partner
{
  const rows = [];
  for (const pair of G.PAIRS) {
    let wins = 0; const rallies = [];
    for (const seed of seeds.slice(0, quick ? 4 : 16)) {
      const m = G.newMatch({ mode: 'doubles', seed, who: 'dora', pair: pair.id });
      G.playMatch(m, competent);
      assert.equal(m.phase, 'over');
      wins += +(m.winner === 0); rallies.push(...m.rallies);
    }
    rallies.sort((a, b) => a - b);
    const n = quick ? 4 : 16;
    rows.push({ pair: pair.id, win: pct(wins / n), median: rallies[rallies.length >> 1] });
    assert.ok(wins > 0, `doubles against ${pair.name} can be won`);
  }
  console.table(rows);
}
console.log('rally bots passed');
