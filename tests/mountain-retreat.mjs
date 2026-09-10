import assert from 'node:assert/strict';
import {
  freshRetreat,
  advanceRetreat,
  startActivity,
  upgradeRoom,
  parseRetreat,
  restoreRetreat,
  OFFLINE_CAP,
} from '../.checks/mountain-retreat-game.js';
let count = 0;
const test = (name, fn) => {
  fn();
  count++;
  console.log(`PASS ${name}`);
};
test('fresh save roundtrip and isolated state', () => {
  const s = freshRetreat();
  assert.deepEqual(parseRetreat(JSON.stringify(s)), s);
  s.rooms[0] = 2;
  assert.equal(freshRetreat().rooms[0], 1);
});
test('deterministic chunking', () => {
  const a = freshRetreat(),
    b = freshRetreat();
  advanceRetreat(a, 600);
  for (let i = 0; i < 600; i++) advanceRetreat(b, 1);
  assert.deepEqual(a, b);
});
test('idle guests consume supplies and earn hearts/tips', () => {
  const s = freshRetreat();
  advanceRetreat(s, 6);
  assert.equal(s.coins, 27);
  assert.equal(s.hearts, 1);
  assert.equal(s.supplies, 21);
  assert.equal(s.served, 1);
});
test('allocations trade throughput for rewards', () => {
  const a = freshRetreat(),
    b = freshRetreat();
  b.dora = 'comfort';
  b.enzo = 'craft';
  advanceRetreat(a, 60);
  advanceRetreat(b, 60);
  assert.equal(a.served, 10);
  assert.equal(b.served, 6);
  assert.equal(b.hearts, 18);
  assert.ok(b.supplies < a.supplies);
  const c = freshRetreat();
  c.enzo = 'craft';
  advanceRetreat(c, 60);
  assert.equal(c.coins, 55);
});
test('expedition pauses all work and rewards exactly once', () => {
  const s = freshRetreat();
  assert.ok(startActivity(s, 'expedition'));
  assert.equal(startActivity(s, 'festival'), false);
  assert.equal(upgradeRoom(s, 0), false);
  advanceRetreat(s, 44);
  assert.equal(s.elapsed, 0);
  assert.equal(s.coins, 25);
  assert.equal(s.supplies, 6);
  advanceRetreat(s, 1);
  assert.equal(s.coins, 60);
  assert.equal(s.supplies, 54);
  assert.equal(s.expeditions, 1);
  advanceRetreat(s, 6);
  assert.equal(s.coins, 62);
  assert.equal(s.expeditions, 1);
});
test('festival costs, pause and exact rewards', () => {
  const s = freshRetreat();
  assert.equal(startActivity(s, 'festival'), false);
  s.hearts = 12;
  s.supplies = 20;
  assert.ok(startActivity(s, 'festival'));
  advanceRetreat(s, 59);
  assert.equal(s.coins, 25);
  assert.equal(s.supplies, 0);
  assert.equal(s.hearts, 0);
  advanceRetreat(s, 1);
  assert.equal(s.coins, 135);
  assert.equal(s.hearts, 24);
  assert.equal(s.festivals, 1);
  assert.equal(s.elapsed, 0);
});
test('offline activity completion includes remainder production', () => {
  const s = freshRetreat(1000);
  startActivity(s, 'expedition');
  const result = restoreRetreat(JSON.stringify(s), 52000);
  const expected = structuredClone(s);
  advanceRetreat(expected, 51);
  expected.savedAt = 52000;
  assert.deepEqual(result.state, expected);
  assert.equal(result.state.coins, 62);
  assert.equal(restoreRetreat(JSON.stringify(result.state), 52000).earned, 0);
});
test('eight hour cap, future timestamps and no double payout', () => {
  const raw = JSON.stringify(freshRetreat(1000));
  const a = restoreRetreat(raw, 1000 + OFFLINE_CAP * 1000),
    b = restoreRetreat(raw, 1000 + OFFLINE_CAP * 5000);
  assert.equal(a.earned, b.earned);
  assert.equal(b.seconds, OFFLINE_CAP);
  assert.equal(restoreRetreat(raw, 0).earned, 0);
  assert.equal(
    restoreRetreat(JSON.stringify(a.state), a.state.savedAt).earned,
    0,
  );
});
test('strict malformed save rejection', () => {
  for (const raw of ['{', 'null', '[]', '{}', 'x'.repeat(10001)])
    assert.equal(parseRetreat(raw), null);
  for (const [key, values] of Object.entries({
    version: [0, 2, '1'],
    savedAt: [-1, 1.5, '100', null, 9e15],
    coins: [-1, 1.1, '20', null, 1e10],
    hearts: [-1],
    supplies: [121],
    rooms: [
      [0, 0, 0, 0],
      [1, 0, 1, 0],
      [1, 4, 0, 0],
      [1, 0, 0],
    ],
    dora: ['anything'],
    enzo: ['anything'],
    activity: [
      {},
      { kind: 'festival', remaining: 61 },
      { kind: 'expedition', remaining: 0 },
      { kind: 'other', remaining: 1 },
    ],
  })) {
    for (const value of values) {
      const s = freshRetreat();
      s[key] = value;
      assert.equal(
        parseRetreat(JSON.stringify(s)),
        null,
        `${key}: ${JSON.stringify(value)}`,
      );
    }
  }
  assert.ok(restoreRetreat('{', 1000).invalid);
});
test('upgrade order, affordability, caps and invalid indices', () => {
  const s = freshRetreat();
  for (const i of [-1, 4, NaN, 1.5]) assert.equal(upgradeRoom(s, i), false);
  assert.equal(upgradeRoom(s, 0), false);
  s.coins = 10000;
  assert.equal(upgradeRoom(s, 2), false);
  for (let i = 0; i < 4; i++) {
    while (s.rooms[i] < 3) assert.ok(upgradeRoom(s, i));
    assert.equal(upgradeRoom(s, i), false);
  }
  assert.equal(
    s.rooms.reduce((a, b) => a + b),
    12,
  );
});
test('all rooms reachable in a normal 5–10 minute visit', () => {
  const s = freshRetreat();
  const unlock = [];
  for (let sec = 1; sec <= 600; sec++) {
    advanceRetreat(s, 1);
    for (let i = 1; i < 4; i++)
      if (!s.rooms[i] && upgradeRoom(s, i)) unlock.push(sec);
  }
  assert.deepEqual(unlock, [90, 270, 492]);
});
test('resource bounds and hostile time input', () => {
  const s = freshRetreat();
  for (const n of [NaN, Infinity, -1, 0]) advanceRetreat(s, n);
  assert.deepEqual(s, freshRetreat());
  s.rooms = [3, 3, 3, 3];
  s.elapsed = 1e9;
  s.coins = 1e9;
  s.hearts = 1e9;
  advanceRetreat(s, OFFLINE_CAP);
  assert.ok(s.supplies >= 0 && s.supplies <= 120);
  assert.equal(s.coins, 1e9);
  assert.equal(s.hearts, 1e9);
  assert.ok(parseRetreat(JSON.stringify(s)));
});
console.log(`${count} Mountain Retreat deterministic tests passed.`);
