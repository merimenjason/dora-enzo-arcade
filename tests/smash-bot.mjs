// Fluffball Smash! bots. A competent player (BOT: human-like reactions and aim, charging and using specials) plays every
// rival in the story from many seeds. The ladder gets harder: Bramble is a warm-up, the middle rivals win some and lose
// some, and Isolde and the final pair win most matches, but none is out of reach. Matches finish, rallies stay in a sane
// length band, and specials and counters both happen. A do-nothing player loses to everyone. `--quick` runs fewer seeds.
import assert from 'node:assert/strict';
import { Match, BOT, OPPS, STORY, idleInput, DT } from '../.checks/smash-game.js';

const quick = process.argv.includes('--quick');
const SEEDS = quick ? 12 : 32;
const MAX = 120 * 1800;
// wins out of 100 for the competent bot, by rival (measured at 32 seeds: bramble 100, twins 75, gale 94, tortoises 63,
// ember 50, isolde 37, final 34)
const BAND = { bramble: [85, 100], twins: [40, 100], gale: [55, 100], tortoises: [30, 95], ember: [20, 80], isolde: [10, 70], final: [8, 65] };

const play = (o, seed, autopilot) => {
  const st = STORY.find((s) => s.opp === o.id);
  const m = new Match({ home: st.team, away: o.chars, venue: o.venue, games: o.games, ai: o.ai, seed, autopilot });
  let ticks = 0, pts = 0, hits = 0, specials = 0, counters = 0;
  while (!m.over && ticks < MAX) { m.tick(idleInput()); ticks++; for (const e of m.events) { if (e.k === 'point') pts++; else if (e.k === 'hit') hits++; else if (e.k === 'special') specials++; else if (e.k === 'counter') counters++; } }
  return { m, ticks, pts, hits, specials, counters };
};

const rate = {};
let allSpecials = 0, allCounters = 0;
for (const o of OPPS) {
  let wins = 0, secs = 0, pts = 0, hits = 0;
  for (let s = 1; s <= SEEDS; s++) {
    const r = play(o, s * 97, BOT);
    assert.ok(r.m.over, `${o.id} seed ${s}: the match finishes`);
    if (r.m.winner === 0) wins++;
    secs += r.ticks * DT; pts += r.pts; hits += r.hits; allSpecials += r.specials; allCounters += r.counters;
  }
  const pct = Math.round((wins / SEEDS) * 100), [lo, hi] = BAND[o.id], hpp = hits / pts;
  rate[o.id] = pct;
  console.log(`${o.id.padEnd(10)} bot wins ${wins}/${SEEDS} (${pct}%)  ${(secs / SEEDS / 60).toFixed(1)} min/match  ${hpp.toFixed(1)} hits/point`);
  assert.ok(pct >= lo && pct <= hi, `${o.id}: ${pct}% is outside ${lo}–${hi}%`);
  assert.ok(hpp > 2.5 && hpp < 16, `${o.id}: rallies of ${hpp.toFixed(1)} hits a point`);
  assert.ok(secs / SEEDS < 9 * 60, `${o.id}: matches of ${(secs / SEEDS / 60).toFixed(1)} min`);
}
assert.ok(rate.bramble >= rate.ember && rate.ember >= rate.final, 'the ladder gets harder from Bramble to the final');
assert.ok(rate.isolde <= rate.bramble && rate.final <= rate.gale);
assert.ok(allSpecials > OPPS.length * SEEDS * 2 && allCounters > 0, `specials (${allSpecials}) and counters (${allCounters}) both happen`);
// a player who never swings loses every point on the rival's serve, and the game waits for them to serve
for (const o of [OPPS[0], OPPS[OPPS.length - 1]]) {
  const st = STORY.find((s) => s.opp === o.id);
  for (let seed = 1; seed <= 4; seed++) {
    const m = new Match({ home: st.team, away: o.chars, venue: o.venue, games: o.games, ai: o.ai, seed });
    let t = 0, won = [0, 0]; while (!m.over && t < 120 * 120) { m.tick(idleInput()); t++; for (const e of m.events) if (e.k === 'point') won[e.winner]++; }
    if (st.team.length === 1) assert.equal(won[0], 0, `standing still wins nothing against ${o.name}`);
    assert.ok(m.phase === 'serve' && m.server === 0 && !m.over, 'it waits for you to serve');
    if (m.games[1] + m.points[1] > 0) assert.ok(won[1] >= 4 || m.games[1] >= 1);
  }
}
console.log('smash-bot: all good');
