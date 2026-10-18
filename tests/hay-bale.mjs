import assert from 'node:assert/strict';
import * as G from '../.checks/hay-bale-game.js';

const { UNITS, UNIT_IDS, SNACKS, SNACK_IDS } = G;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`ok   ${name}`); } catch (e) { failed++; console.log(`FAIL ${name}\n${e.stack}`); }
}

// ---- the roster ----

const ROSTER = [
  ['wren', 1, 2, 1, 'sell'], ['mouse', 1, 2, 1, 'faint'], ['ladybird', 1, 1, 2, 'startBattle'],
  ['toad', 1, 2, 2, 'faint'], ['bee', 1, 1, 1, 'startBattle'], ['dormouse', 1, 1, 3, 'endTurn'],
  ['hedgehog', 2, 3, 2, 'faint'], ['squirrel', 2, 2, 3, 'startTurn'], ['robin', 2, 2, 3, 'friendSummoned'],
  ['mole', 2, 1, 4, 'hurt'], ['frog', 2, 3, 3, 'friendAheadFaints'], ['pip', 2, 2, 2, 'buy'],
  ['badger', 3, 4, 3, 'beforeAttack'], ['otter', 3, 3, 4, 'endTurn'], ['magpie', 3, 3, 3, 'startTurn'],
  ['rabbit', 3, 3, 4, 'friendAte'], ['porcupine', 3, 2, 5, 'hurt'], ['beaver', 3, 3, 3, 'faint'],
  ['stoat', 4, 5, 3, 'knockOut'], ['tortoise', 4, 2, 6, 'startBattle'], ['crow', 4, 4, 4, 'friendFaints'],
  ['skunk', 4, 3, 5, 'startBattle'], ['raccoon', 4, 4, 4, 'startBattle'], ['hare', 4, 4, 3, 'startBattle'],
  ['boar', 5, 6, 6, 'beforeAttack'], ['bear', 5, 5, 8, 'startBattle'], ['stag', 5, 6, 5, 'faint'],
  ['duchess', 5, 3, 6, 'endTurn'], ['hawk', 5, 5, 5, 'startBattle'], ['goose', 5, 5, 7, 'hurt'],
];

test('roster: 30 units, six per tier', () => {
  assert.equal(UNIT_IDS.length, 30);
  for (const t of [1, 2, 3, 4, 5]) assert.equal(UNIT_IDS.filter((id) => UNITS[id].tier === t).length, 6, `tier ${t}`);
});

test('roster: stats and triggers match the spec', () => {
  assert.deepEqual(UNIT_IDS, ROSTER.map((r) => r[0]));
  for (const [id, tier, a, h, on] of ROSTER) {
    const u = UNITS[id];
    assert.deepEqual([u.id, u.tier, u.a, u.h, u.on], [id, tier, a, h, on], id);
  }
});

test('roster: 8 snacks with their tiers', () => {
  assert.deepEqual(SNACK_IDS.map((id) => [id, SNACKS[id].tier]),
    [['apple', 1], ['raisin', 1], ['honey', 2], ['hay', 2], ['mint', 3], ['chilli', 3], ['seed', 4], ['cake', 5]]);
});

test('roster: every unit has three ability lines', () => {
  for (const id of UNIT_IDS) {
    assert.equal(UNITS[id].text.length, 3, id);
    for (const line of UNITS[id].text) assert.ok(line.length > 8, `${id}: ${line}`);
    assert.equal(typeof UNITS[id].run, 'function', id);
  }
});

if (failed) { console.log(`${failed} failed`); process.exit(1); }
console.log('PASS Hay Bale Brawl engine');
