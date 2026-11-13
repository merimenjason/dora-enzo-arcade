// Highburrow bots: whole games played through the engine by three players who take Enzo's advice.
// casual follows every tip; greedy expands as fast as it can and skips the Warmth buildings; careless ignores Warmth.
// Checks that a casual player in Assist wins nearly every game at about turn 44, that nobody gets stuck (a village
// freezing and hungry for 8 turns in a row), that Warmth matters (careless wins fewer), and that the advisor never
// suggests a command the engine refuses. `--quick` runs fewer seeds; `--normal` also reports the game without Assist.
// Run after compiling the engine into .checks/ (npm test does). Exports `play` for tests/highburrow.mjs.
import assert from 'node:assert/strict';
import { Game, pop } from '../.checks/highburrow-game.js';
import { advise } from '../.checks/highburrow-advisor.js';

export function play(seed, opts, assist = true, maxTurn = 60) {
  const g = new Game(seed, assist);
  let stuck = '', fails = 0, lowTurns = 0;
  while (!g.s.over && g.s.turn <= maxTurn) {
    const skip = new Set();
    for (let i = 0; i < 80; i++) {
      const a = advise(g, { ...opts, skip });
      if (a.cmd.k === 'end') break;
      const r = g.apply(a.cmd);
      if (!r.ok) fails++;
      skip.add(a.key);
      if (g.s.over) break;
    }
    if (g.s.over) break;
    g.apply({ k: 'end' });
    // "stuck" = a village that has been freezing and hungry for 8 turns in a row with no way out
    const bad = g.s.villages.some(v => v.warmth <= 0 && v.hungry > 0);
    lowTurns = bad ? lowTurns + 1 : 0;
    if (lowTurns >= 8) stuck = `freezing+hungry for 8 turns at turn ${g.s.turn}`;
  }
  const s = g.s;
  return { won: s.over === 'won', turn: s.over === 'won' ? s.wonTurn : s.turn, pop: pop(s), villages: s.villages.length, stuck, aid: s.stats.aid, frosts: s.stats.frosts, cold: s.stats.coldTurns, hungry: s.stats.hungryTurns, skills: s.skills.length, fails };
}

const BOTS = { casual: {}, greedy: { greedy: true }, careless: { ignoreWarmth: true } };
function report(n, assist) {
  const out = {};
  for (const [name, o] of Object.entries(BOTS)) {
    const rs = Array.from({ length: n }, (_, i) => play(1000 + i, o, assist));
    const wins = rs.filter(r => r.won);
    const avg = (f, xs = rs) => xs.length ? xs.reduce((a, r) => a + f(r), 0) / xs.length : NaN;
    out[name] = { n, wins: wins.length, turn: avg(r => r.turn, wins), stuck: rs.filter(r => r.stuck).length, fails: avg(r => r.fails) };
    console.log(`${(assist ? 'assist ' : 'normal ') + name.padEnd(8)} win ${wins.length}/${n}  turns-to-win ${avg(r => r.turn, wins).toFixed(1)} (min ${Math.min(...wins.map(r => r.turn), 99)} max ${Math.max(...wins.map(r => r.turn), 0)})  pop ${avg(r => r.pop).toFixed(1)}  villages ${avg(r => r.villages).toFixed(1)}  aid ${avg(r => r.aid).toFixed(1)}  coldTurns ${avg(r => r.cold).toFixed(1)}  hungryTurns ${avg(r => r.hungry).toFixed(1)}  skills ${avg(r => r.skills).toFixed(1)}  stuck ${rs.filter(r => r.stuck).length}  badCmds ${avg(r => r.fails).toFixed(1)}`);
  }
  return out;
}

if (process.argv[1]?.endsWith('highburrow-bot.mjs')) {
  const QUICK = process.argv.includes('--quick');
  const N = QUICK ? 10 : 50;
  const r = report(N, true);
  const { casual, greedy, careless } = r;
  assert.ok(casual.wins >= Math.ceil(N * 0.95), `a casual player in Assist should win nearly every game (got ${casual.wins}/${N})`);
  assert.ok(casual.turn >= 38 && casual.turn <= 50, `the casual win should come at about turn 44 (got ${casual.turn.toFixed(1)})`);
  for (const [name, x] of Object.entries(r)) assert.equal(x.stuck, 0, `${name}: nobody gets stuck freezing and hungry`);
  assert.equal(casual.fails, 0, 'Enzo never suggests a command the engine refuses');
  assert.ok(greedy.wins >= Math.floor(N * 0.8), `rushing villages still wins most games (got ${greedy.wins}/${N})`);
  assert.ok(careless.wins < casual.wins, 'ignoring Warmth costs games');
  if (process.argv.includes('--normal')) report(N, false);
  console.log(`highburrow bots: ok (${N} seeds each)`);
}
