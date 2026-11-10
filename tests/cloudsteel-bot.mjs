// Cloudsteel bot run: players of different skill, with help on and off. `--quick` plays fewer fights.
// The human-paced player has to get across every time with help on, and nearly always without.
import assert from 'node:assert/strict';
import { Fight } from '../.checks/cloudsteel-game.js';
import { makeBot, play } from './cloudsteel-bots.mjs';

const N = process.argv.includes('--quick') ? 20 : 80;
function tally(label, opts, assist) {
  let wins = 0, falls = 0, secs = 0, dmg = 0, defl = 0; const ranks = { gold: 0, silver: 0, bronze: 0 };
  for (let s = 1; s <= N; s++) { const g = play(Fight, makeBot({ seed: s * 7, ...opts }), { seed: s, assist }); if (g.phase === 'won') wins++; const r = g.result(); falls += r.falls; secs += r.seconds; dmg += r.damage; defl += r.deflects; ranks[r.rank]++; }
  const row = { wins, falls: falls / N, secs: secs / N, dmg: dmg / N, defl: defl / N, ranks };
  console.log(`${label.padEnd(40)} wins ${String(wins).padStart(3)}/${N}  falls ${row.falls.toFixed(2)}  ${Math.round(row.secs)}s  damage ${Math.round(row.dmg)}  deflects ${row.defl.toFixed(1)}  gold ${ranks.gold} silver ${ranks.silver} bronze ${ranks.bronze}`);
  return row;
}
const person = tally('person, help on (reacts in 0.27s)', { reaction: 16, jitter: 5 }, true);
const slow = tally('slow person, help on (0.4s, loose)', { reaction: 24, jitter: 9 }, true);
const off = tally('person, help off', { reaction: 16, jitter: 5 }, false);
const sharp = tally('sharp player, help off', { reaction: 10, jitter: 2 }, false);
const masher = tally('never guards, help on', { jitter: 200 }, true);
tally('guards only, never cuts', { guardOnly: true, useTag: false }, true);
assert.equal(person.wins, N, 'a person always gets across with help on');
assert.ok(person.falls <= 0.3, 'and rarely falls');
assert.ok(slow.wins >= N * 0.9, 'a slow player nearly always gets across');
assert.ok(off.wins >= N * 0.9, 'a person nearly always gets across with help off');
assert.ok(sharp.ranks.gold >= N * 0.5, 'a sharp player usually earns gold with help off');
assert.ok(masher.ranks.gold <= N * 0.25, 'mashing rarely earns gold');
console.log('\nCloudsteel bots: ok');
