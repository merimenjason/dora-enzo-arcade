// Sweep & Slide bots. Three bots play the whole ladder as Dora and Enzo, each following the teammate's call:
// - the expert sets the called shot exactly (as the keys can) and sweeps with a perfect eye;
// - the human-like bot plays as a person with a mouse: it pulls back to the called line and weight with the
//   pointing error measured from the real input mapping (below), and judges the sweep by eye, a little wrong and a
//   reaction time late;
// - the naive bot throws the same draw to the button every time and never sweeps.
// Both the expert's and the human's curves must fall from the hedgehogs to the stoat champions (each team at least
// as hard as the one before, give or take a few matches of luck), the human must win about 70 % against the
// hedgehogs and 30-40 % against the champions, the expert must stay ahead of the human, and the naive bot must lose
// most matches. Every Practice Pond drill has a three-star throw for the teammate's broom. `--quick` plays fewer
// matches (for `npm test`). CURL_N sets the matches per team, CURL_TEAM one team, CURL_WHO the bots
// (e.g. `human,expert`).
import assert from 'node:assert/strict';
import { Match, PLAYER_NOISE, judgeSweep, slideLeft, speed, rng, drawTo, TEE, DRILLS, drillStones, drillStars, newStone, launch, settle } from '../.checks/curl-game.js';
import { TEAMS, CALLER, plan, drillSolution, firstHammer } from '../.checks/curl-ai.js';

const quick = process.argv.includes('--quick');
const N = quick ? 4 : Number(process.env.CURL_N ?? 100);
const only = process.env.CURL_TEAM;
const who = (process.env.CURL_WHO ?? 'expert,human,naive').split(',');

// ---- the human's pointing error, from the page's input mapping at 1280×800 (measured in the browser):
// a full pull-back is PULL px (36 % of the shorter side of the ice, 130 … 300 px) and sets weight 1; the line is half
// the drag's angle; the ice shows the house at ICE px per metre, the aim mark sits on the tee line 18.4 m out, and
// the weight bar is BAR px wide. A hand on a mouse lets go within about 1.5 px of where it meant to (σ, along and
// across the drag), the pointer moves in whole pixels, and the eye lines the aim mark up on the teammate's broom
// within about 4 px (4 cm at the tee) and the weight pointer on the teammate's mark within about 4 px of the bar.
// For a draw (a 133 px pull) that is σ 0.0062 rad on the line (11 cm at the tee) and σ 0.016 on the weight (25 cm
// of slide), on top of the release error every throw of Dora and Enzo's gets.
const PULL = 266, ICE = 95.6, BAR = 268, TEE_X = 18.4;
const HAND = 1.5, EYE_LINE = 4, EYE_BAR = 4;
/** The spread of a person's line (rad) and weight for a pull of this weight. */
function humanSpread(weight) {
  const L = Math.max(30, PULL * weight);
  const hand = HAND / (2 * L), eye = EYE_LINE / ICE / TEE_X, step = 1 / (2 * L) / Math.sqrt(12);
  return { a: Math.hypot(hand, eye, step), w: Math.hypot(HAND / PULL, EYE_BAR / BAR) };
}
// the sweep by eye: each throw the eye misjudges where the stone will stop (σ 0.7 m), and the broom starts and
// stops a reaction time late (0.25 s, which is 0.45 s of ice at the page's 1.8× speed: 54 steps)
const JUDGE = 0.7, LAG = 54;
function humanSweeper(plan, r) {
  const bias = r.gauss() * JUDGE, seen = [];
  return (s) => {
    seen.push(!!plan && !s.touched && Math.hypot(s.x, s.y) + slideLeft(speed(s)) + bias < plan.target - plan.slack);
    return seen.length > LAG ? seen[seen.length - 1 - LAG] && !s.touched : false;
  };
}

function playMatch(team, bot, seed) {
  const m = new Match({ ends: team.ends, seed, hammer: firstHammer(team, seed), noise: [PLAYER_NOISE, team.noise] });
  const hr = rng(seed * 7919 + 17);
  let guard = 0;
  while (!m.over && guard++ < 400) {
    const me = m.turn, ps = seed * 977 + m.end * 16 + m.thrown;
    if (me === 1) { const p = plan(m, 1, team.brain, team.noise, ps); m.play(p.shot, (s) => judgeSweep(s, p.sweep)); }
    else if (bot === 'naive') m.play(drawTo(TEE, 0, 1));
    else {
      const p = plan(m, 0, CALLER, PLAYER_NOISE, ps);
      if (bot === 'expert') m.play(p.shot, (s) => judgeSweep(s, p.sweep));
      else {
        const sp = humanSpread(p.shot.weight);
        const shot = { angle: p.shot.angle + hr.gauss() * sp.a, weight: Math.max(0, Math.min(1, p.shot.weight + hr.gauss() * sp.w)), curl: p.shot.curl };
        m.play(shot, humanSweeper(p.sweep, hr));
      }
    }
    if (m.thrown === 8) m.nextEnd();
  }
  return { won: m.winner === 0, score: [...m.score], ends: m.end };
}

for (const d of DRILLS) {
  const st = drillStones(d), s = newStone(0, 0, 'dora', 0, 0); launch(s, drillSolution(d)); st.push(s); settle(st, s);
  assert.equal(drillStars(d, st, s), 3, `drill ${d.id} has a three-star throw`);
}
const rates = { expert: [], human: [], naive: [] };
const t0 = Date.now();
for (const [i, team] of TEAMS.entries()) {
  if (only && team.id !== only) continue;
  const line = [];
  for (const bot of who) {
    const n = bot === 'naive' ? Math.max(2, Math.round(N / 2)) : N, base = bot === 'naive' ? 5000 : 0;
    let w = 0; const pts = [0, 0];
    for (let k = 0; k < n; k++) { const r = playMatch(team, bot, base + 1000 * i + k + 1); if (r.won) w++; pts[0] += r.score[0]; pts[1] += r.score[1]; }
    rates[bot].push(w / n);
    line.push(`${bot} ${w}/${n} (avg ${(pts[0] / n).toFixed(1)}-${(pts[1] / n).toFixed(1)})`);
  }
  console.log(`${String(i + 1).padStart(2)} ${team.name.padEnd(26)} ${line.join('  ')}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
const all = who.includes('expert') && who.includes('human') && who.includes('naive');
if (!only && all) {
  const { expert: ex, human: hu, naive } = rates;
  assert.ok(ex[0] >= 0.75, 'the expert beats the hedgehogs nearly always');
  assert.ok(hu[0] > hu[7] && ex[0] > ex[7], 'the champions are harder than the hedgehogs');
  if (!quick) {
    // a person who follows the calls wins most matches against the hedgehogs and a fair share against the champions
    assert.ok(hu[0] >= 0.6 && hu[0] <= 0.85, `the human-like bot beats the hedgehogs about 70 % of the time (${hu[0].toFixed(2)})`);
    assert.ok(hu[7] >= 0.25 && hu[7] <= 0.45, `the human-like bot beats the champions about a third of the time (${hu[7].toFixed(2)})`);
    // each team is at least as hard as the one before, for both, give or take a few matches of luck
    const tol = 0.04 + 1 / N;
    for (const [name, r] of [['expert', ex], ['human', hu]]) {
      for (let i = 1; i < r.length; i++) assert.ok(r[i] <= r[i - 1] + tol, `${name}: ${TEAMS[i].name} (${r[i].toFixed(2)}) is no easier than ${TEAMS[i - 1].name} (${r[i - 1].toFixed(2)})`);
      assert.ok((r[0] + r[1] + r[2] + r[3]) / 4 > (r[4] + r[5] + r[6] + r[7]) / 4, `${name}: the ladder gets harder`);
    }
    // the sharp eye and steady hand are always worth something
    for (let i = 0; i < ex.length; i++) assert.ok(ex[i] >= hu[i] - tol / 2, `the expert (${ex[i].toFixed(2)}) stays ahead of the human (${hu[i].toFixed(2)}) against ${TEAMS[i].name}`);
    assert.ok(naive.reduce((a, b) => a + b, 0) / naive.length < 0.35, 'the naive bot loses most matches');
  }
}
console.log(`curl-bot: ${who.map((b) => `${b} ${rates[b].map((r) => r.toFixed(2)).join(' ')}`).join(' · ')}`);
