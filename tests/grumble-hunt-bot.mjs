import assert from 'node:assert/strict';
import { HuntGame, BEAST_IDS, DT } from '../.checks/grumble-hunt-game.js';
import { huntPolicy } from './grumble-hunt-policy.mjs';
const times = [], totals = Object.fromEntries(BEAST_IDS.map((id) => [id, 0]));
const seeds = Number(process.env.HUNT_SEEDS || 12);
for (const hero of ['dora', 'enzo']) for (let seed = 1; seed <= seeds; seed++) {
  const g = new HuntGame(seed); g.chooseHero(hero);
  for (const id of BEAST_IDS) {
    g.returnVillage();
    while (g.upgrade(hero)) { /* Spend only legitimately collected beast materials. */ }
    assert(g.startHunt(id));
    let steps = 0;
    while (g.mode === 'hunt' && steps++ < 600 / DT) { g.step(DT, huntPolicy(g)); g.events.length = 0; }
    assert.equal(g.mode, 'nap', `${hero} seed ${seed}: ${id} ended ${g.mode}, Grump=${g.beast.grump}, Fluff=${g.hero.fluff}, position=${g.hero.x},${g.hero.z}`);
    times.push(steps * DT); totals[id]++;
    for (let i = 0; i < 220; i++) g.step(DT);
  }
  assert(g.profile.won, 'the policy must finish the campaign');
}
times.sort((a, b) => a - b);
console.log(`Grumble Hunt bot: ${seeds * 2} full campaigns, ${times.length} / ${times.length} beasts calmed.`);
console.log(`By beast: ${JSON.stringify(totals)}. Median hunt ${times[Math.floor(times.length / 2)].toFixed(1)}s; slowest ${times.at(-1).toFixed(1)}s.`);
