// Cloudsteel bot run: players of different skill, with help on and off. `--quick` plays fewer fights.
// The human-paced player has to get across every time with help on, and nearly always without. The players swap
// between Dora and Enzo as a person would (Enzo against a group or an archer, Dora for the finisher, in with a strike
// on a full meter); the "Dora only" rows never press E. `--story` also fights each of the story's six duels, without
// upgrades, and plays the whole story through on several seeds.
import assert from 'node:assert/strict';
import { Fight } from '../.checks/cloudsteel-game.js';
import { makeBot, play } from './cloudsteel-bots.mjs';

const N = process.argv.includes('--quick') ? 20 : 80;
if (process.argv.includes('--story')) { await story(); process.exit(0); }
function tally(label, opts, assist) {
  let wins = 0, falls = 0, secs = 0, dmg = 0, defl = 0, swaps = 0, enzo = 0, warded = 0; const ranks = { gold: 0, silver: 0, bronze: 0 };
  for (let s = 1; s <= N; s++) { const g = play(Fight, makeBot({ seed: s * 7, ...opts }), { seed: s, assist }); if (g.phase === 'won') wins++; const r = g.result(); falls += r.falls; secs += r.seconds; dmg += r.damage; defl += r.deflects; ranks[r.rank]++; swaps += g.stats.swaps; enzo += g.stats.enzoTicks / Math.max(1, g.stats.ticks); warded += g.stats.warded; }
  const row = { wins, falls: falls / N, secs: secs / N, dmg: dmg / N, defl: defl / N, ranks, swaps: swaps / N, enzo: enzo / N };
  console.log(`${label.padEnd(40)} wins ${String(wins).padStart(3)}/${N}  falls ${row.falls.toFixed(2)}  ${Math.round(row.secs)}s  damage ${Math.round(row.dmg)}  deflects ${row.defl.toFixed(1)}  swaps ${row.swaps.toFixed(1)} (Enzo ${Math.round(row.enzo * 100)}%, ${(warded / N).toFixed(1)} arrows warded)  gold ${ranks.gold} silver ${ranks.silver} bronze ${ranks.bronze}`);
  return row;
}
const person = tally('person, help on (reacts in 0.27s)', { reaction: 16, jitter: 5 }, true);
const slow = tally('slow person, help on (0.4s, loose)', { reaction: 24, jitter: 9 }, true);
const off = tally('person, help off', { reaction: 16, jitter: 5 }, false);
const sharp = tally('sharp player, help off', { reaction: 10, jitter: 2 }, false);
const masher = tally('never guards, help on', { jitter: 200 }, true);
tally('guards only, never cuts', { guardOnly: true, useTag: false }, true);
const solo = tally('person, Dora only, help on', { reaction: 16, jitter: 5, swaps: false }, true);
const soloOff = tally('person, Dora only, help off', { reaction: 16, jitter: 5, swaps: false }, false);
assert.equal(person.wins, N, 'a person always gets across with help on');
assert.ok(person.falls <= 0.3, 'and rarely falls');
assert.ok(slow.wins >= N * 0.9, 'a slow player nearly always gets across');
assert.ok(off.wins >= N * 0.9, 'a person nearly always gets across with help off');
assert.ok(sharp.ranks.gold >= N * 0.5, 'a sharp player usually earns gold with help off');
assert.ok(masher.ranks.gold <= N * 0.25, 'mashing rarely earns gold');
assert.ok(person.swaps >= 4 && person.enzo > 0.15, 'the person plays the tag team');
assert.equal(solo.wins, N, 'Dora alone still always gets across with help on'); assert.ok(soloOff.wins >= N * 0.9, 'and nearly always without');
console.log('\nCloudsteel bots: ok');

async function story() {
  const { DUELS } = await import('../.checks/cloudsteel-story.js'), { playStory } = await import('./cloudsteel-story-bots.mjs');
  const M = 30;
  for (const d of DUELS) {
    const row = (label, opts, assist) => {
      let wins = 0, falls = 0, secs = 0;
      for (let s = 1; s <= M; s++) {
        const g = new Fight(s, assist, { rounds: [{ title: d.title, foes: d.foes }] }), bot = makeBot({ seed: s * 11, ...opts }); let k = 0;
        while (k++ < 60 * 600) { g.tick(bot(g)); if (g.phase === 'won') break; if (g.phase === 'lost') { if (g.stats.falls >= 3) break; g.retryRound(); } }
        if (g.phase === 'won') wins++; falls += g.stats.falls; secs += g.stats.ticks / 60;
      }
      console.log(`${(d.id + ': ' + label).padEnd(40)} wins ${String(wins).padStart(2)}/${M}  falls ${(falls / M).toFixed(2)}  ${Math.round(secs / M)}s`);
      return { wins, falls: falls / M };
    };
    const person = row('person, help on', { reaction: 16, jitter: 5 }, true), slow = row('slow person, help on', { reaction: 24, jitter: 9 }, true);
    row('person, help off', { reaction: 16, jitter: 5 }, false); row('person, Dora only, help on', { reaction: 16, jitter: 5, swaps: false }, true);
    assert.equal(person.wins, M, `${d.id}: a person always wins with help on`);
    assert.ok(slow.wins >= M * 0.85, `${d.id}: a slow player nearly always wins`);
  }
  for (const [seed, full] of [[1, false], [2, true], [5, true], [9, false]]) {
    const r = playStory({ seed, full });
    console.log(`story seed ${seed} ${full ? 'everything' : 'main path '}: ${r.w.wonDuels.size} duels, ${r.w.quipus} quipus, ${r.w.stats.falls} falls, ${((r.w.stats.ticks + r.w.stats.fightTicks) / 3600).toFixed(1)} bot minutes`);
    assert.ok(r.w.done);
  }
  const slowRun = playStory({ seed: 3, full: true, reaction: 24, jitter: 9 }); assert.ok(slowRun.w.done, 'a slow player finishes everything');
  console.log('\nCloudsteel story bots: ok');
}
