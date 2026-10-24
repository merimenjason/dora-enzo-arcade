import assert from 'node:assert/strict';
import { HuntGame, BEAST_IDS, ORDERS, DT } from '../.checks/grumble-hunt-game.js';
import { nextNodes, SLOTS, armourCost } from '../.checks/grumble-hunt-content.js';
import { huntPolicy } from './grumble-hunt-policy.mjs';
const times = [], totals = Object.fromEntries(BEAST_IDS.map((id) => [id, 0])), byOrder = Object.fromEntries(ORDERS.map((o) => [o, 0]));
let grumpy = 0, crafted = 0, upgrades = 0, armour = 0;
const seeds = Number(process.env.HUNT_SEEDS || 12);
for (const hero of ['dora', 'enzo']) for (let seed = 1; seed <= seeds; seed++) {
  const g = new HuntGame(seed); g.chooseHero(hero);
  // Each seed keeps one buddy order for the whole campaign, so every order has to be able to finish it.
  while (g.order !== ORDERS[seed % ORDERS.length]) g.commandBuddy(1);
  for (const id of BEAST_IDS) {
    g.returnVillage();
    for (;;) { const choices = nextNodes(g.node().id).filter((n) => g.canForge(n.id)).sort((a, b) => Object.values(a.cost).reduce((s, n) => s + n, 0) - Object.values(b.cost).reduce((s, n) => s + n, 0)); if (!choices.length) break; assert(g.forge(choices[0].id)); upgrades++; }
    const pieces = BEAST_IDS.flatMap((beast) => SLOTS.map((slot) => `${beast}-${slot}`)).filter((piece) => g.canMakeArmour(piece)).sort((a, b) => Object.values(armourCost(a)).reduce((s, n) => s + n, 0) - Object.values(armourCost(b)).reduce((s, n) => s + n, 0));
    for (const piece of pieces) { const slot = piece.split('-')[1]; if (!g.profile.armour.worn[slot] && g.makeArmour(piece)) { assert(g.wear(piece)); armour++; } }
    while (g.craft('fluffberry')) crafted++; // Berries come only from gathering spots.
    assert(g.startHunt(id));
    let steps = 0;
    while (g.mode === 'hunt' && steps++ < 600 / DT) { g.step(DT, huntPolicy(g)); g.events.length = 0; }
    assert.equal(g.mode, 'nap', `${hero} seed ${seed}: ${id} ended ${g.mode}, Grump=${g.beast.grump}, Fluff=${g.hero.fluff}, position=${g.hero.x},${g.hero.z}`);
    times.push(steps * DT); totals[id]++; byOrder[g.order]++; if (g.beast.grumpy) grumpy++;
    for (let i = 0; i < 220; i++) g.step(DT);
  }
  assert(g.profile.won, 'the policy must finish the campaign');
}
times.sort((a, b) => a - b);
console.log(`Grumble Hunt bot: ${seeds * 2} full campaigns, ${times.length} / ${times.length} beasts calmed.`);
assert.equal(grumpy, times.length, 'every calmed beast went Extra Grumpy on the way');
console.log(`By beast: ${JSON.stringify(totals)}. By buddy order: ${JSON.stringify(byOrder)}. Extra Grumpy: ${grumpy}. Fluffberries crafted: ${crafted}. Tree upgrades: ${upgrades}; armour pieces: ${armour}; maximum attempts per hunt: 1 (limit 6). Median hunt ${times[Math.floor(times.length / 2)].toFixed(1)}s; slowest ${times.at(-1).toFixed(1)}s.`);
