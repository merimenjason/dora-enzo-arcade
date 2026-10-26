import assert from 'node:assert/strict';
import { HuntGame, BEAST_IDS, BEASTS, ORDERS, DT, QUESTS, CHARM_IDS, MIGHTY_AT } from '../.checks/grumble-hunt-game.js';
import { STORY, POST_GAME_WEAPONS, nextNodes, SLOTS, armourCost } from '../.checks/grumble-hunt-content.js';
import { huntPolicy } from './grumble-hunt-policy.mjs';
const times = [], totals = Object.fromEntries(BEAST_IDS.map((id) => [id, 0])), byOrder = Object.fromEntries(ORDERS.map((o) => [o, 0]));
let rides = 0, plops = 0, grumpy = 0, crafted = 0, upgrades = 0, armour = 0;
const seeds = Number(process.env.HUNT_SEEDS || 12);
for (const hero of ['dora', 'enzo']) for (let seed = 1; seed <= seeds; seed++) {
  const g = new HuntGame(seed); g.chooseHero(hero); for (const id of BEAST_IDS) g.profile.beastBook[id].met = true;
  // Each seed keeps one buddy order for the whole campaign, so every order has to be able to finish it.
  while (g.order !== ORDERS[seed % ORDERS.length]) g.commandBuddy(1);
  for (const id of BEAST_IDS) {
    g.story.chapter = Math.min(6, BEAST_IDS.indexOf(id) + 1); // The post-game beasts come after the ending.
    g.returnVillage();
    if (g.chapter >= 4) assert(g.equip('yoyo')); // Exercise the easy Hop-on path with earned unlocks.
    for (;;) { const choices = nextNodes(g.node().id).filter((n) => g.canForge(n.id)).sort((a, b) => Object.values(a.cost).reduce((s, n) => s + n, 0) - Object.values(b.cost).reduce((s, n) => s + n, 0)); if (!choices.length) break; assert(g.forge(choices[0].id)); upgrades++; }
    const pieces = BEAST_IDS.flatMap((beast) => SLOTS.map((slot) => `${beast}-${slot}`)).filter((piece) => g.canMakeArmour(piece)).sort((a, b) => Object.values(armourCost(a)).reduce((s, n) => s + n, 0) - Object.values(armourCost(b)).reduce((s, n) => s + n, 0));
    for (const piece of pieces) { const slot = piece.split('-')[1]; if (!g.profile.armour.worn[slot] && g.makeArmour(piece)) { assert(g.wear(piece)); armour++; } }
    while (g.craft('fluffberry')) crafted++; // Berries come only from gathering spots.
    assert(g.startHunt(id));
    let steps = 0;
    while (g.mode === 'hunt' && steps++ < 600 / DT) { g.step(DT, huntPolicy(g)); for (const e of g.events) { if (e.kind === 'hop-on') rides++; if (e.kind === 'plop') plops++; } g.events.length = 0; }
    assert.equal(g.mode, 'nap', `${hero} seed ${seed}: ${id} ended ${g.mode}, Grump=${g.beast.grump}, Fluff=${g.hero.fluff}, position=${g.hero.x},${g.hero.z}`);
    times.push(steps * DT); totals[id]++; byOrder[g.order]++; if (g.beast.grumpy) grumpy++;
    for (let i = 0; i < 220; i++) g.step(DT);
  }
  assert(g.profile.won, 'the policy must finish the campaign');
}
times.sort((a, b) => a - b);
assert(rides > 0 && plops > 0, 'the policy must use Hop-on and finish plops');
console.log(`Hop-on: ${rides} rides; ${plops} plops.`);
console.log(`Grumble Hunt bot: ${seeds * 2} full campaigns, ${times.length} / ${times.length} beasts calmed.`);
assert.equal(grumpy, times.length, 'every calmed beast went Extra Grumpy on the way');
console.log(`By beast: ${JSON.stringify(totals)}. By buddy order: ${JSON.stringify(byOrder)}. Extra Grumpy: ${grumpy}. Fluffberries crafted: ${crafted}. Tree upgrades: ${upgrades}; armour pieces: ${armour}; maximum attempts per hunt: 1 (limit 6). Median hunt ${times[Math.floor(times.length / 2)].toFixed(1)}s; slowest ${times.at(-1).toFixed(1)}s.`);

const storyTimes = []; let maxAttempts = 0, storyUpgrades = 0, storyArmour = 0;
const post = Object.fromEntries(POST_GAME_WEAPONS.map((type) => [type, { calmed: 0, rides: 0, times: [] }]));
const quests = Object.fromEntries(QUESTS.map((q) => [q.id, { calmed: 0, done: 0, times: [] }])); let charmsMade = 0, mightyPieces = 0; const worn = [];
for (const hero of ['dora', 'enzo']) for (let seed = 1; seed <= seeds; seed++) {
  const g = new HuntGame(seed); g.chooseHero(hero);
  while (g.order !== ORDERS[seed % ORDERS.length]) g.commandBuddy(1);
  for (const chapter of STORY) {
    let cleared = false;
    for (let attempt = 1; attempt <= 6 && !cleared; attempt++) {
      g.returnVillage();
      for (;;) {
        const choices = nextNodes(g.node().id).filter((n) => g.canForge(n.id)).sort((a, b) => Object.values(a.cost).reduce((n, v) => n + v, 0) - Object.values(b.cost).reduce((n, v) => n + v, 0));
        if (!choices.length) break; assert(g.forge(choices[0].id)); storyUpgrades++;
      }
      const pieces = BEAST_IDS.flatMap((id) => SLOTS.map((slot) => `${id}-${slot}`)).filter((piece) => g.canMakeArmour(piece)).sort((a, b) => Object.values(armourCost(a)).reduce((n, v) => n + v, 0) - Object.values(armourCost(b)).reduce((n, v) => n + v, 0));
      for (const piece of pieces) if (!g.profile.armour.worn[piece.split('-')[1]] && g.makeArmour(piece)) { g.wear(piece); storyArmour++; }
      while (g.craft('fluffberry')) { /* earned berries only */ }
      assert(g.startChapter()); let steps = 0;
      while (g.mode === 'hunt' && steps++ < 600 / DT) { g.step(DT, huntPolicy(g)); g.events.length = 0; }
      if (g.mode === 'nap') { cleared = true; maxAttempts = Math.max(maxAttempts, attempt); storyTimes.push(steps * DT); }
    }
    assert(cleared, `${hero} seed ${seed}, chapter ${chapter.id} must clear within six attempts`);
    assert.equal(g.chapter, chapter.id + 1);
  }
  assert(g.profile.extraGrumpyUnlocked);
  // After the story: each post-game tool, carried by both friends, calms every beast in its Extra Grumpy form.
  // The goals are tested in tests/grumble-hunt.mjs; here they are simply met.
  g.profile.bountiesClaimed = 5; g.profile.totalPlops = 10; for (const id of BEAST_IDS) { g.profile.variantNaps[id] = 1; g.profile.beastBook[id].partsBroken = [BEASTS[id].part]; }
  for (const type of POST_GAME_WEAPONS) {
    g.returnVillage(); assert(g.equip(type, 'dora')); assert(g.equip(type, 'enzo'));
    for (const id of BEAST_IDS) {
      g.returnVillage(); assert(g.startHunt(id, true)); let steps = 0;
      while (g.mode === 'hunt' && steps++ < 600 / DT) { g.step(DT, huntPolicy(g)); for (const e of g.events) if (e.kind === 'hop-on') post[type].rides++; g.events.length = 0; }
      assert.equal(g.mode, 'nap', `${hero} seed ${seed}: ${type} vs Extra Grumpy ${id} ended ${g.mode}, Grump=${Math.round(g.beast.grump)}`);
      post[type].times.push(steps * DT); post[type].calmed++;
    }
  }
  // Then every quest on Old Mossback's board, with the story's own tools and any charm the stars and materials buy.
  g.returnVillage(); assert(g.equip('hammer', 'dora')); assert(g.equip('bow', 'enzo'));
  for (const q of QUESTS) {
    g.returnVillage(); for (const id of CHARM_IDS) while (g.makeCharm(id)) charmsMade++;
    assert(g.startQuest(q.id), `${hero} seed ${seed}: ${q.id} opens (${g.questsDone} quests done, ${MIGHTY_AT} open the Mighty ones)`); let steps = 0;
    while (!['calm', 'victory', 'camp'].includes(g.mode) && steps++ < 900 / DT) { g.step(DT, huntPolicy(g)); g.events.length = 0; }
    assert.equal(g.mode, 'calm', `${hero} seed ${seed}: quest ${q.id} ended ${g.mode}, ${g.beast?.id} Grump=${Math.round(g.beast?.grump)}`);
    quests[q.id].calmed++; quests[q.id].times.push(steps * DT); if (g.questResult.success) quests[q.id].done++;
  }
  // Then the Mighty armour, if the stars and rare materials left after the charms stretch that far.
  g.returnVillage(); for (const slot of ['helm', 'vest', 'boots']) if (g.makeArmour(`mighty-${slot}`)) mightyPieces++;
  worn.push(g.profile.charms.worn ? `${g.profile.charms.worn} ${g.profile.charms.levels[g.profile.charms.worn]}` : "none");
}
storyTimes.sort((a, b) => a - b);
console.log(`Story bot: ${seeds * 2} campaigns, ${storyTimes.length}/${seeds * 2 * STORY.length} chapters cleared; maximum attempts ${maxAttempts}/6; ${storyUpgrades} upgrades, ${storyArmour} armour pieces; median ${storyTimes[Math.floor(storyTimes.length / 2)].toFixed(1)}s, slowest ${storyTimes.at(-1).toFixed(1)}s.`);
for (const [type, r] of Object.entries(post)) { r.times.sort((a, b) => a - b); console.log(`Post-game ${type}: ${r.calmed}/${seeds * 2 * BEAST_IDS.length} Extra Grumpy beasts calmed; ${r.rides} Hop-ons; median ${r.times[Math.floor(r.times.length / 2)].toFixed(1)}s, slowest ${r.times.at(-1).toFixed(1)}s.`); }
for (const [id, r] of Object.entries(quests)) { r.times.sort((a, b) => a - b); console.log(`Quest ${id}: ${r.calmed}/${seeds * 2} calmed, ${r.done} met the quest; median ${r.times[Math.floor(r.times.length / 2)].toFixed(1)}s, slowest ${r.times.at(-1).toFixed(1)}s.`); }
console.log(`Charms made along the way: ${charmsMade}; worn at the end: ${worn.join(', ')}.`);
console.log(`Mighty armour pieces made after the quests: ${mightyPieces}/${seeds * 2 * 3}.`);
