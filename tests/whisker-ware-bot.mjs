// Whisker Ware's bot: the test solvers played through human-ish timing, over many seeded runs, with difficulty gates.
// Timing and hold games are anticipated: the bot reads the solver 5 ticks ahead (the game stepped on with the current
// input held) and then acts 0–10 ticks late, so it lands within ± 5 ticks of the solver's moment. Every other game is a
// reaction: it acts on what it saw 15 ± 5 ticks ago. One game in 25 is fumbled outright (left idle).
import assert from 'node:assert/strict';
import { Run, Rand, MICROS, IDLE, HOSTS, SPEEDS, calm } from '../.checks/whisker-ware-game.js';
import { SOLVERS } from './whisker-ware-solvers.mjs';

// WARE_BOT_DETAIL=1 breaks the loss table down by level and speed tier.
const SEEDS = 300, REMIX_CAP = 150, LEAD = 5;

const policy = id => SOLVERS[id];

/** The solver's frame for the state LEAD real ticks from now, if the frame `held` were kept up until then. */
function ahead(run, held) {
  const micro = MICROS[run.game], s = structuredClone(run.state);
  const input = calm({ ...held, pressed: false, released: false, swipe: 0, rub: false, steer: (held.right ? 1 : 0) - (held.left ? 1 : 0) });
  for (let k = 0; k < Math.round(LEAD * SPEEDS[run.tier]) && micro.outcome(s) === null; k++) micro.tick(s, input);
  return policy(run.game)(s, run.t + LEAD);
}
const started = Date.now();

/** Plays a run to its end with the bot. Returns per-game outcomes. */
function play(run, rand) {
  const games = [];
  let played = 0, buffer = [], lag = 0, fumble = false, anticipate = false, held = IDLE;
  for (let n = 0; n < 2_000_000 && run.phase !== 'over' && run.phase !== 'clear'; n++) {
    if (run.mode === 'remix' && run.cleared >= REMIX_CAP) break;
    if (run.phase === 'micro' && run.played !== played) {
      played = run.played; buffer = [];
      const kind = MICROS[run.game].input;
      anticipate = kind === 'timing' || kind === 'hold';
      lag = anticipate ? rand.int(11) : 10 + rand.int(11);
      held = IDLE;
      fumble = rand.next() < 0.04;
      games.push({ id: process.env.WARE_BOT_DETAIL ? `${run.game}@${run.level}t${run.tier}` : run.game });
    }
    let f = IDLE;
    if (run.phase === 'micro') {
      buffer.push(anticipate ? ahead(run, held) : policy(run.game)(run.state, run.t));
      if (!fumble && run.t >= lag) f = buffer[run.t - lag];
      held = f;
    }
    run.step(f);
    for (const e of run.drain()) if (e === 'win' || e === 'lose') games[games.length - 1].win = e === 'win';
  }
  return games;
}

const rand = new Rand(20261018);
const clears = [0, 0, 0, 0], losses = {}, plays = {};
const count = games => { for (const g of games) { plays[g.id] = (plays[g.id] ?? 0) + 1; if (!g.win) losses[g.id] = (losses[g.id] ?? 0) + 1; } };
for (let h = 0; h < 4; h++) for (let seed = 1; seed <= SEEDS; seed++) {
  const run = new Run('host', seed * 7919 + h, { host: h });
  count(play(run, rand));
  if (run.phase === 'clear') clears[h]++;
}
const scores = [];
for (let seed = 1; seed <= SEEDS; seed++) {
  const run = new Run('remix', seed * 104729);
  count(play(run, rand));
  scores.push(run.cleared);
}
scores.sort((a, b) => a - b);
const median = scores[Math.floor(SEEDS / 2)], rate = clears.map(c => c / SEEDS);

for (let h = 0; h < 4; h++) console.log(`${HOSTS[h].stage.padEnd(20)} cleared ${(rate[h] * 100).toFixed(1)}%`);
console.log(`Remix median ${median} (quartiles ${scores[Math.floor(SEEDS / 4)]}–${scores[Math.floor(SEEDS * 3 / 4)]}, cap ${REMIX_CAP})`);
const table = Object.keys(plays).map(id => [id, (losses[id] ?? 0) / plays[id], plays[id]]).sort((a, b) => b[1] - a[1]);
console.log('loss rate by game: ' + table.map(([id, r]) => `${id} ${(r * 100).toFixed(0)}%`).join(', '));

assert.ok(rate[0] >= 0.85, `Enzo's stage clears ${rate[0]}`);
assert.ok(rate[3] >= 0.50, `the Fox's stage clears ${rate[3]}`);
for (let h = 1; h < 4; h++) assert.ok(rate[h] <= rate[h - 1] + 0.02, `stage ${h} is no easier than ${h - 1}`);
assert.ok(median >= 20 && median <= 45, `Remix median ${median}`);
console.log(`PASS Whisker Ware bot (${((Date.now() - started) / 1000).toFixed(1)} s)`);
