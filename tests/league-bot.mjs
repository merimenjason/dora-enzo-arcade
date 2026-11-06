// Snow Day League bots, all through the engine. Four checks, each with the brief's targets:
// - watchable matches (rival vs rival with their own coaches' drafts): median length 60–100 s of sim time, lead
//   changes happen, under 10% decided (a flag down) in the first 20 s, under 10% ending with neither fort touched;
// - the draft matters: with equal squads (the same seven cards on both sides, same village pool), a counter-aware
//   drafter and the Hint-follower each beat a random drafter at least 75% of the time;
// - coaching matters: a manager who trains, rests sensibly and follows the Hint finishes above a do-nothing manager;
// - casual and pro seasons: the casual bot (Hint draft and shouts, simple week jobs) reaches the semis in season 1 at
//   least 60% of the time and wins the cup at least 25%; the pro wins the season-1 cup at least 65%; season 2 is
//   tougher for the casual bot; a random manager rarely wins anything;
// - a human-paced manager (Hint draft half the time, a shout every 12 s) usually wins week one and reaches the semis.
// Run after compiling the engine into .checks/: `npx tsc lib/league-game.ts --target es2022 --module es2022
// --moduleResolution bundler --outDir .checks --skipLibCheck && node tests/league-bot.mjs [--quick]`.
import assert from 'node:assert/strict';
import * as L from '../.checks/league-game.js';

const quick = process.argv.includes('--quick');
const N = quick ? 40 : 120, SEASONS = quick ? 36 : 60;
const t0 = Date.now();

// ---- watchable matches
{
  const ids = L.TEAMS.slice(1).map((t) => t.id);
  const lens = []; let early = 0, zero = 0, changes = 0, flags = 0, comeback = 0;
  const s = L.newSave(11);
  for (let k = 0; k < N; k++) {
    const a = ids[k % 7], b = ids[(k + 1 + Math.floor(k / 7)) % 7] === a ? ids[(k + 2) % 7] : ids[(k + 1 + Math.floor(k / 7)) % 7];
    const m = L.simFixture(s, { week: k, home: a, away: b, kind: 'league', done: false });
    lens.push(m.t / L.TICK);
    if (m.how === 'flag') flags++;
    if (m.how === 'flag' && m.t < 20 * L.TICK) early++;
    if (m.fortShare(0) === 1 && m.fortShare(1) === 1) zero++;
    if (m.leadChanges > 0) changes++;
    if (m.comebacks > 0) comeback++;
  }
  lens.sort((x, y) => x - y);
  const med = lens[Math.floor(lens.length / 2)];
  console.log(`matches: median ${med.toFixed(0)} s, ${flags}/${N} end with a flag down, lead changes in ${changes}/${N}, comebacks in ${comeback}/${N}, ${early} decided in 20 s, ${zero} untouched`);
  assert.ok(med >= 60 && med <= 100, 'median match 60–100 s');
  assert.ok(changes / N >= 0.3, 'lead changes happen');
  assert.ok(early / N < 0.1, 'under 10% decided in the first 20 s');
  assert.ok(zero / N < 0.1, 'under 10% end with neither fort touched');
}

// ---- the draft matters (equal squads)
const duel = (styleA, seed) => {
  const r = L.rng(seed);
  const squad = L.rivalSquad(r, 'flamingos', 5).map((p, i) => ({ ...p, species: L.SPECIES[i], role: L.ROLES[(i + seed) % 5] }));
  const copy = squad.map((p) => ({ ...p, id: p.id + 'b' }));
  const pool = L.loanPool(r, 5);
  const side = seed % 2;   // half the time the smart drafter is on each side
  const squads = side === 0 ? [squad, copy] : [copy, squad];
  const d = L.newDraft(squads[0], squads[1], pool, seed % 3 === 0 ? 0 : 1);
  const styles = side === 0 ? [styleA, 'random'] : ['random', styleA];
  L.autoDraft(d, styles, r);
  const l0 = L.lineupOf(d, 0), l1 = L.lineupOf(d, 1);
  const tac = (us, them, st) => st === 'random' ? 'balanced' : L.suggestTactic(us, them).tactic;
  const m = new L.Match({ seed, lineups: [l0, l1], tactics: [tac(l0, l1, styles[0]), tac(l1, l0, styles[1])], coachAI: [true, true] });
  m.run();
  return m.winner === side ? 1 : m.winner === -1 ? 0.5 : 0;
};
const share = {};
for (const style of ['counter', 'hint']) {
  let w = 0; for (let k = 0; k < N; k++) w += duel(style, 9000 + k * 13);
  share[style] = w / N;
  console.log(`draft: ${style} beats random ${(share[style] * 100).toFixed(0)}% of ${N}`);
}
assert.ok(share.counter >= 0.75, 'a counter-aware drafter beats a random one at least 75%');
assert.ok(share.hint >= 0.75, 'the Hint-follower beats a random drafter at least 75%');

// ---- seasons
const seasons = (kind, n, upTo = 1) => {
  const out = [];
  for (let k = 0; k < n; k++) {
    const s = L.newSave(3000 + k * 101), r = L.rng(77 + k);
    for (let season = 1; season <= upTo; season++) {
      const res = L.botSeason(s, kind, r);
      out.push({ season, ...res, pts: s.table.find((x) => x.team === 'snowcats').pts });
      if (season < upTo) L.newSeason(s);
    }
  }
  return out;
};
const rate = (rows, season, f) => { const x = rows.filter((q) => q.season === season); return x.filter(f).length / x.length; };
const casual = seasons('casual', SEASONS, 2), pro = seasons('pro', Math.ceil(SEASONS * 0.75)), random = seasons('random', Math.ceil(SEASONS / 2)), idle = seasons('idle', Math.ceil(SEASONS / 2));
const semis = (q) => q.cup !== 'none', cup = (q) => q.cup === 'cup';
const avgPts = (rows) => rows.filter((q) => q.season === 1).reduce((a, q) => a + q.pts, 0) / rows.filter((q) => q.season === 1).length;
console.log(`casual s1: semis ${(rate(casual, 1, semis) * 100).toFixed(0)}%, cup ${(rate(casual, 1, cup) * 100).toFixed(0)}%, ${avgPts(casual).toFixed(1)} pts; s2: semis ${(rate(casual, 2, semis) * 100).toFixed(0)}%, cup ${(rate(casual, 2, cup) * 100).toFixed(0)}%`);
console.log(`pro s1: semis ${(rate(pro, 1, semis) * 100).toFixed(0)}%, cup ${(rate(pro, 1, cup) * 100).toFixed(0)}%, ${avgPts(pro).toFixed(1)} pts`);
console.log(`random s1: semis ${(rate(random, 1, semis) * 100).toFixed(0)}%, cup ${(rate(random, 1, cup) * 100).toFixed(0)}%, ${avgPts(random).toFixed(1)} pts`);
console.log(`do-nothing s1: semis ${(rate(idle, 1, semis) * 100).toFixed(0)}%, cup ${(rate(idle, 1, cup) * 100).toFixed(0)}%, ${avgPts(idle).toFixed(1)} pts`);
assert.ok(rate(casual, 1, semis) >= 0.6, 'casual reaches the semis in season 1 at least 60%');
assert.ok(rate(casual, 1, cup) >= 0.25, 'casual wins the season-1 cup at least 25%');
assert.ok(rate(casual, 2, cup) <= rate(casual, 1, cup), 'season 2 is tougher');
assert.ok(rate(pro, 1, cup) >= 0.65, 'the pro wins the season-1 cup at least 65%');
assert.ok(rate(random, 1, cup) <= 0.1, 'a random manager rarely wins the cup');
assert.ok(avgPts(casual) > avgPts(idle) + 2, 'coaching matters: the casual coach beats a do-nothing manager across a season');

// ---- a human-paced manager: the casual week jobs, the Hint draft only half the time, one shout every 12 s. The
// season opens against the gentlest rivals, so week one should usually be a win and the semis within reach.
{
  const n = quick ? 30 : 80; let semi = 0, w1 = 0;
  for (let k = 0; k < n; k++) {
    const s = L.newSave(3000 + k * 101), r = L.rng(77 + k);
    for (let g = 0; !s.seasonOver && g < 20; g++) {
      L.botWeek(s, 'casual', r);
      const f = L.ourFixture(s); if (!f) { L.endWeek(s); continue; }
      const T = L.team(L.opponentOf(s, f)), d = L.makeDraft(s, f);
      L.autoDraft(d, [r() < 0.5 ? 'hint' : 'random', 'habit'], r, [undefined, T.habit]);
      const us = L.lineupOf(d, 0), them = L.lineupOf(d, 1);
      const m = new L.Match(L.ourMatchOpts(s, f, us, them, L.suggestTactic(us, them).tactic));
      while (!m.over) { if (m.t % 360 === 0) { const h = L.shoutHint(m, 0); if (h) m.shout(0, h.kind, h.target); } m.step(); }
      if (f.kind === 'league' && f.week === 0 && m.winner === 0) w1++;
      L.record(s, f, m, us.filter((p) => !p.loan)); L.endWeek(s);
    }
    if (L.cupResult(s) !== 'none') semi++;
  }
  console.log(`human-paced s1: week one won ${(w1 / n * 100).toFixed(0)}%, semis ${(semi / n * 100).toFixed(0)}%`);
  assert.ok(w1 / n >= 0.55, 'a human-paced manager usually wins week one');
  assert.ok(semi / n >= 0.65, 'a human-paced manager reaches the semis in season 1 at least 65%');
}
console.log(`PASS Snow Day League bot thresholds (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
