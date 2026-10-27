// Burrow Command bots: computer against computer on every map with every pairing of sides. No match should stall, each
// side should win a fair share against each other side, Hard should beat Easy, a pilot should win every campaign mission,
// and a match should replay exactly from its seed.
import assert from 'node:assert/strict';
import { World, MAPS, SIDE_IDS, TICK_HZ } from '../.checks/command-game.js';
import { attachBrains, skirmish } from '../.checks/command-ai.js';
import { MISSIONS, startMission, Pilot } from '../.checks/command-campaign.js';

const LIMIT = 25 * 60 * TICK_HZ;
const play = (map, seed, sides, ai) => {
  const w = attachBrains(new World(skirmish({ map, seed, sides, ai, limit: LIMIT })));
  while (!w.result) w.step();
  return w;
};

// ---- every pairing, both ways round, on every map
const pairs = {}, rows = [];
let games = 0, stalls = 0, minutes = 0;
for (const map of MAPS) for (let s = 1; s <= 2; s++) for (const a of SIDE_IDS) for (const b of SIDE_IDS) {
  if (a === b) continue;
  const w = play(map, s * 31 + map.id.length, [a, b], ['normal', 'normal']);
  games++; minutes += w.tick / (60 * TICK_HZ);
  if (w.result.reason === 'time') stalls++;
  const key = [a, b].sort().join(' v ');
  pairs[key] ??= { [a]: 0, [b]: 0, games: 0 };
  pairs[key].games++;
  pairs[key][[a, b][w.result.winner]]++;
}
for (const [key, r] of Object.entries(pairs)) {
  const [a, b] = key.split(' v ');
  const share = r[a] / r.games;
  rows.push({ pairing: key, [a]: r[a], [b]: r[b], [`${a} share`]: `${Math.round(share * 100)}%` });
  assert.ok(share >= 0.35 && share <= 0.65, `${key}: each side wins a fair share (${a} ${r[a]}, ${b} ${r[b]})`);
}
console.table(rows.map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => !k.includes('share')))));
assert.ok(stalls <= Math.floor(games * 0.05), `matches end on their own (${stalls} of ${games} ran out of time)`);
assert.ok(minutes / games > 4 && minutes / games < 15, `a match lasts a sensible while (${(minutes / games).toFixed(1)} minutes on average)`);

// ---- difficulty
let hard = 0, hn = 0, normal = 0, nn = 0;
for (const map of MAPS) for (const a of SIDE_IDS) for (const b of SIDE_IDS) {
  const seed = 100 + hn;
  if ((MAPS.indexOf(map) + a.length + b.length) % 2 === 0) { hn++; if (play(map, seed, [a, b], ['hard', 'easy']).result.winner === 0) hard++; }
  else { nn++; if (play(map, seed, [a, b], ['normal', 'easy']).result.winner === 0) normal++; }
}
assert.ok(hard >= Math.ceil(hn * 0.85), `Hard beats Easy most of the time (${hard} of ${hn})`);
assert.ok(normal >= Math.ceil(nn * 0.7), `Normal beats Easy most of the time (${normal} of ${nn})`);

// ---- the campaign: a pilot wins every mission
const camp = [];
for (const m of MISSIONS) {
  const { w, script } = startMission(m, 1);
  w.brains[0] = new Pilot(m, script.st);
  while (!w.result && w.tick < LIMIT) w.step();
  assert.ok(script.outcome?.win, `mission ${m.n}, ${m.title}, can be won (${script.outcome ? script.outcome.why : 'ran out of time'})`);
  camp.push({ mission: `${m.n} ${m.title}`, minutes: (w.tick / (60 * TICK_HZ)).toFixed(1), stars: script.outcome.stars.filter(Boolean).length });
}
console.table(camp);

// ---- replays
const one = play(MAPS[2], 9, ['hive', 'guild'], ['hard', 'normal']), two = play(MAPS[2], 9, ['hive', 'guild'], ['hard', 'normal']);
assert.equal(one.fingerprint(), two.fingerprint(), 'a seeded match replays exactly');
assert.equal(one.tick, two.tick, 'to the very tick');

console.log(`Burrow Command bot: ${games} matches with no more than ${stalls} stalls, every pairing between 35% and 65%, Hard beat Easy ${hard} of ${hn}, all ${MISSIONS.length} missions won by the pilot.`);
