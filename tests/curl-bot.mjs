// Sweep & Slide bots. An expert bot (Dora and Enzo's own shot-caller, the player's release error and a sharp sweep)
// plays the whole ladder; the eight woodland teams must form a rising curve: the expert beats the hedgehogs nearly
// always and the stoat champions only sometimes. A naive bot that throws the same draw to the button every time,
// never sweeping, must lose most of its matches. Every Practice Pond drill has a three-star throw for the
// teammate's broom. `--quick` plays fewer matches (for `npm test`).
import assert from 'node:assert/strict';
import { Match, PLAYER_NOISE, judgeSweep } from '../.checks/curl-game.js';
import { TEAMS, CALLER, plan, drillSolution } from '../.checks/curl-ai.js';
import { drawTo, TEE, DRILLS, drillStones, drillStars, newStone, launch, settle } from '../.checks/curl-game.js';

const quick = process.argv.includes('--quick');
const N = quick ? 4 : Number(process.env.CURL_N ?? 16);
const only = process.env.CURL_TEAM;

function playMatch(team, who, seed) {
  const m = new Match({ ends: team.ends, seed, hammer: team.hammer ?? 0, noise: [PLAYER_NOISE, team.noise] });
  let guard = 0;
  while (!m.over && guard++ < 400) {
    const me = m.turn, ps = seed * 977 + m.end * 16 + m.thrown;
    let p;
    if (me === 1) p = plan(m, 1, team.brain, team.noise, ps);
    else if (who === 'expert') p = plan(m, 0, CALLER, PLAYER_NOISE, ps);
    else p = { shot: drawTo(TEE, 0, 1), sweep: null };
    m.play(p.shot, (s) => judgeSweep(s, p.sweep));
    if (m.thrown === 8) m.nextEnd();
  }
  return { won: m.winner === 0, score: [...m.score], ends: m.end };
}

for (const d of DRILLS) {
  const st = drillStones(d), s = newStone(0, 0, 'dora', 0, 0); launch(s, drillSolution(d)); st.push(s); settle(st, s);
  assert.equal(drillStars(d, st, s), 3, `drill ${d.id} has a three-star throw`);
}
const rates = [], naive = [];
const t0 = Date.now();
for (const [i, team] of TEAMS.entries()) {
  if (only && team.id !== only) continue;
  let w = 0, nw = 0, pts = [0, 0];
  for (let k = 0; k < N; k++) { const r = playMatch(team, 'expert', 1000 * i + k + 1); if (r.won) w++; pts[0] += r.score[0]; pts[1] += r.score[1]; }
  const nN = Math.max(2, Math.round(N / 2));
  for (let k = 0; k < nN; k++) if (playMatch(team, 'naive', 5000 + 1000 * i + k).won) nw++;
  rates.push(w / N); naive.push(nw / nN);
  console.log(`${String(i + 1).padStart(2)} ${team.name.padEnd(26)} expert ${w}/${N} (avg ${(pts[0] / N).toFixed(1)}-${(pts[1] / N).toFixed(1)})  naive ${nw}/${nN}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
if (!only) {
  assert.ok(rates[0] >= 0.75, 'the expert beats the hedgehogs nearly always');
  assert.ok(rates[7] < rates[0], 'the champions are harder than the hedgehogs');
  if (!quick) {
    assert.ok(rates[7] >= 0.1 && rates[7] <= 0.7, `the expert beats the champions only sometimes (${rates[7]})`);
    const firstHalf = (rates[0] + rates[1] + rates[2] + rates[3]) / 4, secondHalf = (rates[4] + rates[5] + rates[6] + rates[7]) / 4;
    assert.ok(firstHalf > secondHalf, 'the ladder gets harder');
    // each team is at least as hard as the one before, give or take a few matches of luck
    const tol = 0.04 + 1 / N;
    for (let i = 1; i < rates.length; i++) assert.ok(rates[i] <= rates[i - 1] + tol, `${TEAMS[i].name} (${rates[i].toFixed(2)}) is no easier than ${TEAMS[i - 1].name} (${rates[i - 1].toFixed(2)})`);
    assert.ok(naive.reduce((a, b) => a + b, 0) / naive.length < 0.35, 'the naive bot loses most matches');
  }
}
console.log(`curl-bot: ladder ${rates.map((r) => r.toFixed(2)).join(' ')} · naive ${naive.map((r) => r.toFixed(2)).join(' ')}`);
