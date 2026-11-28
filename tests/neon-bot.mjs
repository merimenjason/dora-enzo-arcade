// Neon Lane bots: human-delay bots play every night. With gentle cicaks on (the default), a careful bot and a naive
// first-timer (slower to react, hesitates more, ignores the dark tubes, fuses and moths) both clear every night in
// almost every seed; with gentle cicaks off the careful bot still clears most nights but the first-timer struggles;
// a bot that stands still is always caught. Run after compiling the engine into .checks/ (npm test does).
import assert from 'node:assert/strict';
import { NeonGame, Bot, NIGHTS } from '../.checks/neon-game.js';

const SEEDS = 12;
/** clears out of SEEDS for one night, and the average time of a clear */
function night(n, { naive = false, assist = true, idle = false } = {}) {
  let clears = 0, time = 0;
  for (let s = 1; s <= SEEDS; s++) {
    const g = new NeonGame({ seed: s * 131 + n, night: n, assist });
    const bot = new Bot(g, 0, { naive, seed: s });
    for (let k = 0; k < 60 * 400 && !g.over && g.phase !== 'cleared'; k++) g.step(idle ? 0 : bot.decide());
    if (g.phase === 'cleared') { clears++; time += g.nightT; }
  }
  return { clears, avg: clears ? time / clears : 0 };
}

let bad = 0;
const row = (label, r, min, max = SEEDS) => {
  const pass = r.clears >= min && r.clears <= max;
  if (!pass) bad++;
  console.log(`  ${pass ? 'ok' : 'FAIL'} ${label}: ${r.clears}/${SEEDS}${r.clears ? `, ${r.avg.toFixed(0)} s a clear` : ''} (want ${min}${max < SEEDS ? `-${max}` : '+'})`);
};
console.log('neon lane bots');
let hardNaive = 0, gentleNaive = 0;
for (let n = 0; n < NIGHTS.length; n++) {
  const id = NIGHTS[n].id;
  row(`${id} careful, gentle`, night(n), SEEDS - 1);
  const gn = night(n, { naive: true }); gentleNaive += gn.clears;
  row(`${id} first-timer, gentle`, gn, SEEDS - 2);
  const ch = night(n, { assist: false });
  row(`${id} careful, not gentle`, ch, Math.floor(SEEDS * 0.7));
  const hn = night(n, { naive: true, assist: false }); hardNaive += hn.clears;
  if (n === 0) row(`${id} standing still`, night(n, { idle: true }), 0, 0);
}
const fewer = hardNaive < gentleNaive * 0.85;
if (!fewer) bad++;
console.log(`  ${fewer ? 'ok' : 'FAIL'} the first-timer clears fewer nights without gentle cicaks: ${hardNaive} vs ${gentleNaive}`);
console.log(`neon lane bots: ${bad ? `${bad} failed` : 'all passed'}`);
assert.ok(true);
if (bad) process.exit(1);
