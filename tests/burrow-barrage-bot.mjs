// Plays Burrow Barrage through the real engine with the engine's own computer player on both sides: it tries every
// angle and power through the same flight a real shot takes and keeps the best. Run on its own it reports how often
// each ride wins on each map, how often going first wins, and whether the ladder can be climbed.
import assert from 'node:assert/strict';
import { Match, MAPS, LADDER, RIDE_IDS, RIDES, AI_LEVELS, ladderMatch, stars } from '../.checks/burrow-barrage-game.js';

/** Plays a match to the end with a computer of the given level on each team. */
export function play(setup, levels = [2, 2]) {
  const m = setup instanceof Match ? setup : Match.start(setup);
  for (let guard = 0; m.state === 'aim' && guard < 400; guard++) { m.aiTurn(levels[m.active.team]); m.events.length = 0; }
  assert.equal(m.state, 'over', 'a match always ends');
  return m;
}
/** Wins for a team of two `a` rides against two `b` rides, over every map, both orders of play and `seeds` seeds each. */
export function duel(a, b, seeds = 1, level = 2) {
  let wins = 0, games = 0, turns = 0;
  for (let map = 0; map < MAPS.length; map++) for (let first = 0; first < 2; first++) for (let s = 1; s <= seeds; s++) {
    const m = play({ map, seed: s * 131 + map * 17 + first, rides: [[a, a], [b, b]], first }, [level, level]);
    games++; turns += m.turn; if (m.winner === 0) wins++;
  }
  return { wins, games, turns };
}
/** Climbs one rung of the ladder with a Deadeye computer playing Dora and Enzo. */
export const climb = (i, rides, seed) => play(ladderMatch(i, rides, seed), [2, LADDER[i].level]);

if (import.meta.url === `file://${process.argv[1]}`) {
  const seeds = Number(process.env.SEEDS || 2);
  console.log(`Ride against ride (rows win; ${MAPS.length * 2 * seeds} matches a cell, Deadeye both sides):`);
  const score = Object.fromEntries(RIDE_IDS.map((r) => [r, 0]));
  let total = 0, turns = 0, n = 0;
  for (const a of RIDE_IDS) {
    const row = RIDE_IDS.map((b) => { const d = duel(a, b, seeds); if (a !== b) { score[a] += d.wins; score[b] += d.games - d.wins; } total = d.games; turns += d.turns; n += d.games; return `${String(Math.round((100 * d.wins) / d.games)).padStart(3)}%`; });
    console.log(`  ${RIDES[a].name.padEnd(14)} ${row.join(' ')}`);
  }
  for (const r of RIDE_IDS) {
    const share = Math.round((100 * score[r]) / (total * (RIDE_IDS.length - 1) * 2));
    console.log(`  ${RIDES[r].name}: ${share}% of its matches against the other rides`);
    assert.ok(share >= 30 && share <= 70, `${RIDES[r].name} should win between 30% and 70% of its matches against the other rides (won ${share}%)`);
  }
  console.log(`  average length ${Math.round(turns / n)} turns`);

  let firstWins = 0, games = 0, fell = 0, outs = 0;
  for (let map = 0; map < MAPS.length; map++) {
    let w = 0, g = 0;
    for (let s = 1; s <= 12; s++) for (let first = 0; first < 2; first++) {
      const m = Match.start({ map, seed: s * 7 + map, rides: [['catapult', 'cannon'], ['catapult', 'cannon']], first });
      for (let guard = 0; m.state === 'aim' && guard < 400; guard++) { m.aiTurn(1); for (const e of m.events) if (e.type === 'out') { outs++; if (e.why === 'fell') fell++; } m.events.length = 0; }
      g++; games++; if (m.winner === first) { w++; firstWins++; }
    }
    console.log(`  ${MAPS[map].name}: the side going first won ${w} of ${g} mirror matches`);
  }
  console.log(`  going first won ${Math.round((100 * firstWins) / games)}% overall; ${fell} of ${outs} knock-outs were falls`);

  console.log('The ladder, Deadeye playing Dora and Enzo on a Hay Catapult and a Seed Spitter:');
  for (let i = 0; i < LADDER.length; i++) {
    let won = 0, best = 0;
    for (let s = 1; s <= 10; s++) { const m = climb(i, ['catapult', 'spitter'], s * 37); if (m.winner === 0) won++; best = Math.max(best, stars(m)); }
    console.log(`  ${i + 1}. ${LADDER[i].rivals.join(' and ')} (${AI_LEVELS[LADDER[i].level].name}): won ${won} of 10, best ${best} stars`);
  }
}
