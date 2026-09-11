import assert from 'node:assert/strict';
import {
  freshRetreat,
  advanceRetreat,
  startActivity,
  upgradeRoom,
  choosePerk,
  parseRetreat,
  restoreRetreat,
  hostStop,
  visitPeriod,
  supplyRate,
  guestFor,
  guestPool,
  rating,
  season,
  isNight,
  trailClosed,
  activitySeconds,
  festivalReward,
  VISCACHA,
  SUPPLY_CAP,
  OFFLINE_CAP,
  total,
  visitRewards,
  supplyParts,
  awaySummary,
  WISH_TIPS,
  ITEM_TIPS,
  WISH_HEARTS,
  GUESTS,
  POSTCARDS,
  offerTreat,
  checkGoals,
  lodgeTitle,
  GOALS,
  pourTea,
  catchReward,
  TEA_COOLDOWN,
  CATCH_COOLDOWN,
  CATCH_CAP,
  guestIdentity,
  chooseSkill,
  hostLevel,
  skillPoints,
  dailyList,
  startDay,
  claimDaily,
  DAILY,
  QUESTS,
  TRAILS,
  pantryCap,
  recipeCost,
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
  s.album[0] = 1;
  assert.equal(freshRetreat().rooms[0], 1);
  assert.equal(freshRetreat().album[0], 0);
});
test('deterministic chunking', () => {
  const a = Object.assign(freshRetreat(), { rooms: [1, 1, 1, 0], enzo: 'craft' });
  const b = structuredClone(a);
  advanceRetreat(a, 600);
  for (let i = 0; i < 600; i++) advanceRetreat(b, 1);
  assert.deepEqual(a, b);
});
test('idle guests consume supplies and earn hearts, tips and reputation', () => {
  const s = freshRetreat();
  advanceRetreat(s, 6);
  assert.equal(s.coins, 31);
  assert.equal(s.hearts, 3);
  assert.equal(s.supplies, 29);
  assert.equal(s.served, 1);
  assert.equal(s.visits, 1);
  assert.equal(s.reputation, 1);
  assert.equal(s.last.outcome, 'happy');
  assert.ok(s.album[s.last.guest] > 0);
});
test('supplies arrive faster, with spring and larder bonuses', () => {
  const s = freshRetreat();
  assert.equal(supplyRate(s), 4, 'gather 3 + spring 1');
  s.elapsed = 400;
  assert.equal(season(s.elapsed), 'summer');
  assert.equal(supplyRate(s), 3);
  s.enzo = 'craft';
  assert.equal(supplyRate(s), 1);
  s.perks[1] = 1;
  assert.equal(supplyRate(s), 2);
  const g = freshRetreat();
  g.supplies = 0;
  g.rooms = [1, 0, 0, 0];
  g.elapsed = 400;
  advanceRetreat(g, 60);
  assert.equal(g.supplies, 90 - 10, '30 deliveries of 3, minus 10 visits');
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
  assert.ok(b.hearts / b.served > a.hearts / a.served);
  assert.ok(b.supplies < a.supplies);
  const c = freshRetreat();
  c.enzo = 'craft';
  advanceRetreat(c, 60);
  assert.ok(c.coins > a.coins);
});
test('Enzo’s recipes alternate between open workshops and respect the pantry', () => {
  const s = freshRetreat();
  s.enzo = 'craft';
  s.supplies = 100;
  advanceRetreat(s, 6);
  assert.deepEqual(s.pantry, { oatcake: 0, soap: 0 }, 'no workshop open yet');
  s.rooms = [1, 1, 1, 1];
  s.elapsed = 11;
  s.supplies = 100;
  s.dora = 'comfort';
  advanceRetreat(s, 1);
  assert.deepEqual(s.pantry, { oatcake: 1, soap: 0 });
  assert.equal(s.supplies, 100 + 2 - 2, 'delivery of 2, recipe of 2');
  advanceRetreat(s, 6);
  assert.deepEqual(s.pantry, { oatcake: 1, soap: 1 });
  // Ticks 24 and 42 are recipe ticks with no Comfort visit, so no guest eats from the pantry.
  s.rooms[1] = 3;
  s.perks[1] = 0;
  s.elapsed = 23;
  const cakes = s.pantry.oatcake;
  advanceRetreat(s, 1);
  assert.equal(s.pantry.oatcake, cakes + 2, 'bakery oven bakes two');
  s.elapsed = 41;
  s.pantry.soap = 9;
  const before = s.supplies;
  advanceRetreat(s, 1);
  assert.equal(s.pantry.soap, 9, 'pantry cap');
  assert.equal(s.supplies, before + 2, 'no supplies spent on a full shelf');
});
test('guest wishes move reputation', () => {
  const setup = () => {
    const s = freshRetreat();
    s.rooms = [1, 1, 0, 0];
    s.supplies = 100;
    s.reputation = 10;
    let v = 0;
    while (guestFor(s, v, 6).guest !== 1 || v % 5 === 4) v++;
    s.visits = v;
    s.elapsed = 5;
    return s;
  };
  const plain = setup();
  advanceRetreat(plain, 1);
  assert.equal(plain.last.guest, 1);
  assert.equal(plain.last.outcome, 'plain', 'no oat cake for the pastry fan');
  assert.equal(plain.reputation, 9);
  const happy = setup();
  happy.pantry.oatcake = 1;
  advanceRetreat(happy, 1);
  assert.equal(happy.last.outcome, 'happy');
  assert.equal(happy.pantry.oatcake, 0);
  assert.equal(happy.reputation, 11);
  assert.equal(happy.last.tips - plain.last.tips, 14, 'wish bonus and item bonus');
  assert.equal(happy.last.hearts - plain.last.hearts, 2);
  // Summer crafting: 3 supplies arrive, a recipe takes 2, and four rooms need 4.
  const away = Object.assign(freshRetreat(), {
    rooms: [1, 1, 1, 1],
    enzo: 'craft',
    supplies: 0,
    reputation: 10,
    elapsed: 396,
  });
  advanceRetreat(away, 6);
  assert.equal(away.last.outcome, 'away');
  assert.equal(away.reputation, 7);
  assert.equal(away.served, 0);
});
test('rating unlocks guest types; stargazers only come at night', () => {
  const s = freshRetreat();
  for (const [rep, stars] of [[0, 1], [19, 1], [20, 2], [79, 4], [100, 5]]) {
    s.reputation = rep;
    assert.equal(rating(s), stars);
  }
  s.rooms = [3, 3, 3, 3];
  s.reputation = 0;
  assert.deepEqual(guestPool(s, 10), [0, 1]);
  s.reputation = 20;
  assert.deepEqual(guestPool(s, 10), [0, 1, 3]);
  assert.ok(isNight(90));
  assert.deepEqual(guestPool(s, 90), [0, 1, 2, 3]);
  s.reputation = 60;
  assert.deepEqual(guestPool(s, 90), [0, 1, 2, 3, 4, 5]);
  assert.ok(!guestPool(s, 90).includes(VISCACHA));
});
test('regulars return every fifth visit and send postcards', () => {
  const s = freshRetreat();
  s.rooms = [1, 1, 1, 1];
  s.supplies = 100;
  s.pantry.soap = 1;
  s.friends[0] = 2;
  s.visits = 4;
  s.elapsed = 5;
  assert.deepEqual(guestFor(s, 4, 6), { guest: 3, coat: 4, regular: 0 });
  advanceRetreat(s, 1);
  assert.equal(s.last.regular, 0);
  assert.equal(s.last.outcome, 'happy');
  assert.equal(s.friends[0], 3);
  assert.equal(s.last.postcard, 0);
  assert.equal(s.last.tips, 4 * 2 + 4 + 10 + 20);
  const early = freshRetreat();
  assert.equal(guestFor(early, 4, 6).regular, -1, 'no regular until their room opens');
});
test('level-3 specialties', () => {
  const s = freshRetreat();
  s.coins = 10000;
  assert.equal(choosePerk(s, 0, 1), false);
  upgradeRoom(s, 0);
  upgradeRoom(s, 0);
  for (const bad of [2, -1, 0.5]) assert.equal(choosePerk(s, 0, bad), false);
  assert.equal(choosePerk(s, 4, 0), false);
  assert.ok(choosePerk(s, 0, 1));
  assert.equal(choosePerk(s, 0, 0), false, 'a specialty is permanent');
  const a = freshRetreat();
  a.rooms = [3, 0, 0, 0];
  const b = structuredClone(a);
  b.perks[0] = 1;
  advanceRetreat(a, 6);
  advanceRetreat(b, 6);
  assert.equal(b.coins - a.coins, 3, 'tea stall');
  const c = freshRetreat();
  c.rooms = [3, 3, 3, 3];
  c.perks[3] = 0;
  c.supplies = 50;
  assert.equal(activitySeconds(c, 'festival'), 45);
  assert.ok(startActivity(c, 'expedition'));
  assert.equal(c.activity.remaining, 34, 'healing springs');
  assert.equal(choosePerk(c, 1, 0), false, 'not while away');
});
test('expedition pauses all work and rewards exactly once', () => {
  const s = freshRetreat();
  assert.ok(startActivity(s, 'expedition'));
  assert.equal(s.activity.trail, 'juniper');
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
  assert.equal(s.coins, 66);
  assert.equal(s.expeditions, 1);
});
test('trail destinations, closures and finds', () => {
  const s = freshRetreat();
  s.supplies = 100;
  assert.equal(trailClosed(s, 'summit'), 'Needs a 2-star lodge');
  assert.equal(startActivity(s, 'expedition', 'summit'), false);
  assert.equal(startActivity(s, 'expedition', 'moon'), false);
  assert.ok(startActivity(s, 'expedition', 'lake'));
  assert.equal(s.supplies, 95);
  assert.equal(s.activity.remaining, 25);
  advanceRetreat(s, 25);
  assert.equal(s.supplies, 113);
  assert.equal(s.coins, 37);
  assert.deepEqual(s.pantry, { oatcake: 1, soap: 1 });
  s.reputation = 20;
  assert.equal(trailClosed(s, 'summit'), null);
  assert.ok(startActivity(s, 'expedition', 'summit'));
  advanceRetreat(s, 90);
  assert.equal(s.decor, 1);
  assert.equal(s.album[VISCACHA], 1 << 2);
  assert.equal(s.supplies, 143);
  assert.equal(s.coins, 127);
  assert.equal(s.hearts, 10);
  s.elapsed = 1080;
  assert.equal(season(s.elapsed), 'winter');
  assert.equal(trailClosed(s, 'summit'), 'Snowed in until spring');
  const plain = freshRetreat(),
    decorated = freshRetreat();
  decorated.decor = 3;
  advanceRetreat(plain, 6);
  advanceRetreat(decorated, 6);
  assert.equal(decorated.coins - plain.coins, 3, 'each decoration adds a tip per visit');
});
test('festival costs, pause, summer bonus and exact rewards', () => {
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
  assert.equal(s.reputation, 5);
  assert.equal(s.festivals, 1);
  assert.equal(s.elapsed, 0);
  s.elapsed = 400;
  const summer = festivalReward(s);
  assert.equal(summer.name, 'Midsummer lanterns');
  assert.equal(summer.tips, 165);
  assert.equal(summer.hearts, 36);
});
test('seasons and days follow the simulation clock', () => {
  assert.deepEqual(
    [0, 360, 720, 1080, 1440].map(season),
    ['spring', 'summer', 'autumn', 'winter', 'spring'],
  );
  assert.deepEqual([0, 79, 80, 119, 120].map(isNight), [false, false, true, true, false]);
  const cold = freshRetreat(),
    mild = freshRetreat();
  cold.elapsed = 1080;
  mild.elapsed = 720 - 6;
  advanceRetreat(cold, 6);
  advanceRetreat(mild, 6);
  assert.equal(cold.last.hearts - mild.last.hearts, 1, 'winter: +1 heart per room');
});
test('offline activity completion includes remainder production', () => {
  const s = freshRetreat(1000);
  startActivity(s, 'expedition');
  const result = restoreRetreat(JSON.stringify(s), 52000);
  const expected = structuredClone(s);
  advanceRetreat(expected, 51);
  expected.savedAt = 52000;
  assert.deepEqual(result.state, expected);
  assert.equal(result.state.coins, 66);
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
test('version-1 journals upgrade to version 2', () => {
  const v1 = {
    version: 1,
    savedAt: 5,
    coins: 10,
    hearts: 2,
    supplies: 120,
    rooms: [2, 1, 0, 0],
    dora: 'comfort',
    enzo: 'craft',
    elapsed: 40,
    served: 9,
    activity: { kind: 'expedition', remaining: 30 },
    festivals: 1,
    expeditions: 2,
  };
  const s = parseRetreat(JSON.stringify(v1));
  assert.equal(s.version, 4);
  assert.deepEqual(s.activity, { kind: 'expedition', remaining: 30, trail: 'juniper' });
  assert.deepEqual(s.perks, [-1, -1, -1, -1]);
  assert.deepEqual(s.pantry, { oatcake: 0, soap: 0 });
  assert.equal(s.coins, 10);
  assert.equal(s.served, 9);
  assert.equal(s.last, null);
  assert.deepEqual(parseRetreat(JSON.stringify(s)), s);
  const festival = parseRetreat(JSON.stringify({ ...v1, activity: { kind: 'festival', remaining: 60 } }));
  assert.equal(festival.activity.trail, null);
  assert.equal(parseRetreat(JSON.stringify({ ...v1, supplies: 121 })), null);
  assert.equal(parseRetreat(JSON.stringify({ ...v1, activity: undefined })), null);
});
test('strict malformed save rejection', () => {
  for (const raw of ['{', 'null', '[]', '{}', 'x'.repeat(10001)])
    assert.equal(parseRetreat(raw), null);
  for (const [key, values] of Object.entries({
    version: [0, 5, '4'],
    xp: [null, { dora: -1, enzo: 0 }],
    skills: [
      { dora: [0, -1, -1, -1], enzo: [-1, -1, -1, -1] },
      { dora: [-1, -1, -1], enzo: [-1, -1, -1, -1] },
    ],
    daily: [
      null,
      { day: 0, progress: [0, 0], claimed: false },
      { day: 0, progress: [0, 0, 0], claimed: 'no' },
    ],
    quests: [[4, 0, 0]],
    questProgress: [[-1, 0, 0]],
    festivalSeasons: [16],
    treat: [null, { visit: 0, rooms: 16 }, { visit: -1, rooms: 0 }],
    goals: [1 << GOALS.length, -1],
    event: [{}, { kind: 'toString', remaining: 1 }, { kind: 'storm', remaining: 41 }, { kind: 'storm', remaining: 0 }],
    rescues: [-1],
    perfectPours: [1.5],
    teaReadyAt: ['0'],
    catchReadyAt: [null],
    savedAt: [-1, 1.5, '100', null, 9e15],
    coins: [-1, 1.1, '20', null, 1e10],
    hearts: [-1],
    supplies: [SUPPLY_CAP + 1],
    rooms: [
      [0, 0, 0, 0],
      [1, 0, 1, 0],
      [1, 4, 0, 0],
      [1, 0, 0],
    ],
    perks: [[0, -1, -1, -1], [-1, -1, -1], [-1, -1, -1, 2], null],
    dora: ['anything'],
    enzo: ['anything'],
    visits: [-1, undefined],
    reputation: [101, -1],
    pantry: [null, { oatcake: 16, soap: 0 }, { oatcake: 0 }],
    album: [[0, 0, 0], [0, 0, 0, 0, 0, 0, 32], null],
    friends: [[11, 0, 0], [0, 0]],
    decor: [7],
    last: [
      {},
      { guest: 99, coat: 0, regular: -1, outcome: 'happy', tips: 0, hearts: 0, postcard: -1 },
      { guest: 0, coat: 0, regular: -2, outcome: 'happy', tips: 0, hearts: 0, postcard: -1 },
      { guest: 0, coat: 0, regular: -1, outcome: 'meh', tips: 0, hearts: 0, postcard: -1 },
      { guest: 0, coat: 0, regular: -1, outcome: 'away', tips: 0, hearts: 0, postcard: 3 },
    ],
    activity: [
      {},
      { kind: 'festival', remaining: 61, trail: null },
      { kind: 'festival', remaining: 10, trail: 'lake' },
      { kind: 'expedition', remaining: 0, trail: 'juniper' },
      { kind: 'expedition', remaining: 26, trail: 'lake' },
      { kind: 'expedition', remaining: 10, trail: 'moon' },
      { kind: 'other', remaining: 1, trail: null },
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
  const good = freshRetreat();
  good.last = { guest: 3, coat: 4, regular: 0, outcome: 'happy', tips: 5, hearts: 2, postcard: 1 };
  good.activity = { kind: 'expedition', remaining: 90, trail: 'summit' };
  assert.deepEqual(parseRetreat(JSON.stringify(good)), good);
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
test('all rooms reachable and finished in a normal 5–10 minute visit', () => {
  const s = freshRetreat();
  const unlock = [];
  for (let sec = 1; sec <= 600; sec++) {
    advanceRetreat(s, 1);
    for (let i = 1; i < 4; i++)
      if (!s.rooms[i] && upgradeRoom(s, i)) unlock.push(sec);
  }
  assert.deepEqual(unlock, [30, 162, 264]);
  const greedy = freshRetreat();
  let finished = 0;
  for (let sec = 1; sec <= 600 && !finished; sec++) {
    advanceRetreat(greedy, 1);
    for (let i = 0; i < 4; i++) upgradeRoom(greedy, i);
    if (greedy.rooms.every((r) => r === 3)) finished = sec;
  }
  assert.ok(finished >= 300 && finished <= 600, `every room at level 3 after ${finished}s`);
});
test('resource bounds and hostile time input', () => {
  const s = freshRetreat();
  for (const n of [NaN, Infinity, -1, 0]) advanceRetreat(s, n);
  assert.deepEqual(s, freshRetreat());
  s.rooms = [3, 3, 3, 3];
  s.enzo = 'craft';
  s.elapsed = 1e9;
  s.coins = 1e9;
  s.hearts = 1e9;
  advanceRetreat(s, OFFLINE_CAP);
  assert.ok(s.supplies >= 0 && s.supplies <= SUPPLY_CAP);
  assert.equal(s.coins, 1e9);
  assert.equal(s.hearts, 1e9);
  assert.ok(s.reputation <= 100);
  assert.ok(parseRetreat(JSON.stringify(s)));
});
test('hosts tour only open rooms on the simulation clock', () => {
  const s = freshRetreat();
  for (const host of ['dora', 'enzo'])
    assert.deepEqual(hostStop(s, host), { room: 0, from: 0, walking: false });
  s.rooms = [1, 1, 0, 0];
  assert.equal(hostStop(s, 'enzo').room, 1);
  s.elapsed = 8;
  assert.deepEqual(hostStop(s, 'dora'), { room: 1, from: 0, walking: true });
  s.elapsed = 10;
  assert.equal(hostStop(s, 'dora').walking, false);
  s.rooms = [3, 3, 3, 3];
  const seen = new Set();
  for (let t = 0; t < 32; t += 8) {
    s.elapsed = t;
    const stop = hostStop(s, 'dora');
    assert.ok(s.rooms[stop.room] > 0);
    seen.add(stop.room);
  }
  assert.equal(seen.size, 4);
  const away = freshRetreat();
  away.rooms = [1, 1, 1, 1];
  away.supplies = 120;
  advanceRetreat(away, 7);
  assert.ok(startActivity(away, 'expedition'));
  const before = hostStop(away, 'enzo');
  advanceRetreat(away, 30);
  assert.deepEqual(hostStop(away, 'enzo'), before);
});
test('guest visit period follows Dora’s duty', () => {
  const s = freshRetreat();
  assert.equal(visitPeriod(s), 6);
  s.dora = 'comfort';
  assert.equal(visitPeriod(s), 10);
});
test('reward breakdowns match what a visit pays', () => {
  const s = Object.assign(freshRetreat(), {
    rooms: [3, 2, 3, 1],
    perks: [1, -1, 1, -1],
    decor: 2,
    reputation: 45,
    dora: 'comfort',
    enzo: 'craft',
    supplies: 150,
    elapsed: 714,
  });
  const r = visitRewards(s, 720);
  assert.deepEqual(
    r.tips.map((p) => p.label.split(' (')[0]),
    ['Room levels', '3-star rating', 'Decorations', 'Tea stall', 'Autumn harvest'],
  );
  assert.deepEqual(r.hearts.map((p) => p.label.split(' (')[0]), ['Extra comfort', 'Feather beds']);
  advanceRetreat(s, 6);
  const happy = s.last.outcome === 'happy';
  const extra = happy
    ? WISH_TIPS +
      (GUESTS[s.last.guest].item ? ITEM_TIPS : 0) +
      (s.last.postcard >= 0 ? POSTCARDS[s.last.postcard].tips : 0)
    : 0;
  assert.equal(s.last.tips, total(r.tips) + extra);
  assert.equal(s.last.hearts, total(r.hearts) + (happy ? WISH_HEARTS : 0));
  const fresh = freshRetreat();
  assert.deepEqual(supplyParts(fresh), [
    { label: 'Enzo gathering', value: 3 },
    { label: 'Spring blossoms', value: 1 },
  ]);
});
test('welcome-back summary counts what changed', () => {
  const before = freshRetreat();
  before.friends = [2, 5, 9];
  before.album = [1, 0, 0, 0, 0, 0, 0];
  const after = structuredClone(before);
  Object.assign(after, {
    visits: 40,
    coins: before.coins + 300,
    hearts: 90,
    reputation: 12,
    supplies: 5,
    friends: [3, 6, 10],
    album: [3, 0, 4, 0, 0, 0, 0],
    expeditions: 1,
    festivals: 1,
  });
  after.pantry.soap = 2;
  assert.deepEqual(awaySummary(before, after), {
    visits: 40,
    tips: 300,
    hearts: 90,
    reputation: 12,
    supplies: -13,
    oatcakes: 0,
    soap: 2,
    postcards: 3,
    coats: 2,
    outings: 2,
  });
  const real = structuredClone(before);
  advanceRetreat(real, 600);
  const summary = awaySummary(before, real);
  assert.equal(summary.visits, real.visits);
  assert.equal(summary.tips, real.coins - before.coins);
});
test('version-2 journals upgrade to version 3', () => {
  const v2 = freshRetreat();
  v2.version = 2;
  for (const k of ['treat', 'goals', 'event', 'rescues', 'perfectPours', 'teaReadyAt', 'catchReadyAt'])
    delete v2[k];
  v2.coins = 77;
  const s = parseRetreat(JSON.stringify(v2));
  assert.equal(s.version, 4);
  assert.equal(s.coins, 77);
  assert.deepEqual(s.treat, { visit: 0, rooms: 0 });
  assert.equal(s.event, null);
  assert.equal(s.goals, 0);
  assert.deepEqual(parseRetreat(JSON.stringify(s)), s);
});
test('treats: once per room per visit, from the pantry, befriending regulars', () => {
  const s = freshRetreat();
  s.rooms = [1, 1, 1, 1];
  s.supplies = 100;
  s.pantry = { oatcake: 2, soap: 1 };
  assert.equal(offerTreat(s, 0, 'oatcake'), false, 'no guest yet');
  // Visit 4 is Pip, who stays in the bath and uses the soap.
  s.visits = 4;
  s.elapsed = 5;
  advanceRetreat(s, 1);
  assert.equal(s.last.regular, 0);
  const hearts = s.hearts,
    coins = s.coins,
    friends = s.friends[0];
  assert.ok(offerTreat(s, 3, 'oatcake'));
  assert.equal(s.hearts, hearts + 3);
  assert.equal(s.coins, coins + 2);
  assert.equal(s.friends[0], friends + 1, 'a treat for a regular counts as friendship');
  assert.equal(offerTreat(s, 3, 'oatcake'), false, 'once per room per visit');
  assert.ok(offerTreat(s, 0, 'oatcake'));
  assert.equal(offerTreat(s, 1, 'oatcake'), false, 'pantry empty');
  assert.equal(offerTreat(s, 1, 'toString'), false);
  assert.equal(offerTreat(s, 9, 'soap'), false);
  advanceRetreat(s, 6);
  s.pantry.oatcake = 1;
  assert.ok(offerTreat(s, 3, 'oatcake'), 'a new visit brings a new guest');
});
test('lodge goals pay once and name the lodge', () => {
  const s = freshRetreat();
  assert.equal(lodgeTitle(s), 'Mountain hut');
  s.rooms = [1, 1, 1, 1];
  s.reputation = 45;
  const coins = s.coins;
  assert.deepEqual(checkGoals(s), [0, 1]);
  assert.equal(s.coins, coins + GOALS[0].tips + GOALS[1].tips);
  assert.deepEqual(checkGoals(s), [], 'each goal pays once');
  assert.equal(lodgeTitle(s), 'Cozy inn');
  s.reputation = 0;
  checkGoals(s);
  assert.equal(s.goals & 2, 2, 'a met goal stays met');
  s.goals = (1 << GOALS.length) - 1;
  assert.equal(lodgeTitle(s), 'Legend of the Andes');
  const up = freshRetreat();
  up.coins = 10000;
  for (let i = 1; i < 4; i++) upgradeRoom(up, i);
  assert.equal(up.goals & 1, 1, 'upgrades check goals');
});
test('surprise events: storms, musicians and a lost hiker to rescue', () => {
  const s = freshRetreat();
  s.rooms = [1, 1, 1, 1];
  s.supplies = 200;
  advanceRetreat(s, 269);
  assert.equal(s.event, null);
  advanceRetreat(s, 1);
  assert.deepEqual(s.event, { kind: 'storm', remaining: 40 });
  const storm = visitRewards(s);
  assert.ok(storm.tips.some((p) => p.label.startsWith('Storm shelter')));
  assert.ok(storm.hearts.some((p) => p.label === 'Storm shelter'));
  advanceRetreat(s, 40);
  assert.equal(s.event, null);
  advanceRetreat(s, 450 - s.elapsed);
  assert.equal(s.event.kind, 'musician');
  assert.equal(visitRewards(s).hearts.find((p) => p.label === 'Travelling musician').value, 8);
  advanceRetreat(s, 630 - s.elapsed);
  assert.equal(s.event.kind, 'lost');
  assert.equal(trailClosed(s, 'rescue'), null);
  const rep = s.reputation;
  assert.ok(startActivity(s, 'expedition', 'rescue'));
  assert.equal(s.event, null, 'the hosts set off at once');
  advanceRetreat(s, 20);
  assert.equal(s.rescues, 1);
  assert.equal(s.reputation, Math.min(100, rep + 8));
  assert.ok(s.goals & (1 << 7), 'Mountain hero');
  assert.equal(trailClosed(s, 'rescue'), 'No one is lost right now');
  assert.equal(startActivity(s, 'expedition', 'rescue'), false);
});
test('mini-games pay once per cooldown', () => {
  const s = freshRetreat();
  assert.equal(pourTea(s, 0.95), 'perfect');
  assert.equal(s.coins, 25 + 25 + GOALS[8].tips, 'perfect pour plus the Perfect pour goal');
  assert.equal(s.perfectPours, 1);
  assert.equal(pourTea(s, 1), null, 'kettle still warming');
  s.elapsed = TEA_COOLDOWN;
  assert.equal(pourTea(s, 0.7), 'good');
  s.elapsed = 2 * TEA_COOLDOWN;
  assert.equal(pourTea(s, 0.1), 'spill');
  s.elapsed = 3 * TEA_COOLDOWN;
  assert.equal(pourTea(s, NaN), null);
  const c = freshRetreat();
  assert.equal(catchReward(c, 40), CATCH_CAP);
  assert.equal(catchReward(c, 3), null);
  c.elapsed = CATCH_COOLDOWN;
  assert.equal(catchReward(c, -2), 0);
  c.elapsed = 2 * CATCH_COOLDOWN;
  assert.ok(startActivity(c, 'expedition'));
  assert.equal(catchReward(c, 5), null, 'not while the hosts are away');
});
test('every guest gets a stable identity', () => {
  assert.deepEqual(guestIdentity(42, 3), guestIdentity(42, 3));
  const who = guestIdentity(42, 3);
  assert.ok(who.name && who.home && who.bio);
  assert.equal(guestIdentity(7, 3, 0).name, 'Pip');
  const names = new Set(Array.from({ length: 40 }, (_, i) => guestIdentity(i, 0).name));
  assert.ok(names.size > 10);
});
test('version-3 journals upgrade to version 4', () => {
  const v3 = freshRetreat();
  v3.version = 3;
  for (const k of ['xp', 'skills', 'daily', 'quests', 'questProgress', 'festivalSeasons']) delete v3[k];
  v3.goals = 5;
  const s = parseRetreat(JSON.stringify(v3));
  assert.equal(s.version, 4);
  assert.equal(s.goals, 5);
  assert.deepEqual(s.xp, { dora: 0, enzo: 0 });
  assert.deepEqual(s.quests, [0, 0, 0]);
  assert.deepEqual(parseRetreat(JSON.stringify(s)), s);
});
test('host skills: levels from work, one permanent choice per tier', () => {
  assert.deepEqual([0, 29, 30, 90, 180, 300, 5000].map(hostLevel), [1, 1, 2, 3, 4, 5, 5]);
  const s = freshRetreat();
  assert.equal(chooseSkill(s, 'dora', 0, 1), false, 'still level 1');
  advanceRetreat(s, 60);
  assert.equal(s.xp.enzo, 10, 'Enzo learns every 6 seconds of work');
  assert.equal(s.xp.dora, 20, 'Dora learns from every guest, more from granted wishes');
  s.xp.dora = 30;
  assert.equal(skillPoints(s, 'dora'), 1);
  assert.equal(chooseSkill(s, 'dora', 1, 0), false, 'tier 2 needs level 3');
  for (const bad of [2, -1]) assert.equal(chooseSkill(s, 'dora', 0, bad), false);
  assert.equal(chooseSkill(s, 'cat', 0, 0), false);
  assert.ok(chooseSkill(s, 'dora', 0, 1));
  assert.equal(chooseSkill(s, 'dora', 0, 0), false, 'a skill is permanent');
  assert.equal(skillPoints(s, 'dora'), 0);
  assert.ok(visitRewards(s).tips.some((p) => p.label === 'Tip jar'));
  const e = freshRetreat();
  e.xp.enzo = 300;
  const rate = supplyRate(e);
  assert.ok(chooseSkill(e, 'enzo', 0, 0));
  assert.equal(supplyRate(e), rate + 1, 'Strong back');
  assert.equal(recipeCost(e), 2);
  assert.ok(chooseSkill(e, 'enzo', 2, 1));
  assert.equal(pantryCap(e), 15, 'Big pantry');
  assert.ok(chooseSkill(e, 'enzo', 1, 0));
  assert.equal(activitySeconds(e, 'expedition', 'juniper'), 40, 'Trail sense');
  assert.equal(activitySeconds(e, 'festival'), 60, 'festivals are not trails');
  assert.ok(chooseSkill(e, 'enzo', 3, 1));
  assert.equal(pourTea(e, 1), 'perfect');
  assert.equal(e.teaReadyAt, e.elapsed + TEA_COOLDOWN / 2, 'Tinkerer');
  assert.deepEqual(parseRetreat(JSON.stringify(e)), e);
  const q = freshRetreat();
  q.xp.enzo = 30;
  chooseSkill(q, 'enzo', 0, 1);
  assert.equal(recipeCost(q), 1, 'Quick hands');
});
test('daily wish list: three requests a day, claimed once', () => {
  assert.deepEqual(dailyList(20340), dailyList(20340));
  assert.equal(new Set(dailyList(20340)).size, 3);
  const week = new Set(Array.from({ length: 7 }, (_, i) => dailyList(20340 + i).join()));
  assert.ok(week.size > 1, 'the list changes from day to day');
  const s = freshRetreat();
  assert.ok(startDay(s, 20340));
  assert.equal(startDay(s, 20340), false);
  assert.equal(startDay(s, -1), false);
  assert.equal(claimDaily(s), false, 'not finished');
  s.daily.progress = dailyList(20340).map((d) => DAILY[d].n);
  const coins = s.coins;
  assert.ok(claimDaily(s));
  assert.equal(s.coins, coins + 100);
  assert.equal(claimDaily(s), false, 'claimed once');
  assert.ok(startDay(s, 20341));
  assert.deepEqual(s.daily, { day: 20341, progress: [0, 0, 0], claimed: false });
  let day = 0;
  while (!dailyList(day).some((d) => DAILY[d].deed === 'visit')) day++;
  const t = freshRetreat();
  startDay(t, day);
  advanceRetreat(t, 60);
  const k = dailyList(day).findIndex((d) => DAILY[d].deed === 'visit');
  assert.equal(t.daily.progress[k], 10, 'each welcomed guest counts');
});
test('regulars’ stories unlock with friendship and pay once per step', () => {
  const s = freshRetreat();
  s.rooms = [1, 1, 1, 1];
  s.supplies = 200;
  assert.ok(startActivity(s, 'expedition', 'lake'));
  advanceRetreat(s, 25);
  assert.equal(s.quests[0], 0, 'Pip’s story waits for friendship 3');
  s.friends[0] = 3;
  const coins = s.coins;
  assert.ok(startActivity(s, 'expedition', 'lake'));
  advanceRetreat(s, 25);
  assert.equal(s.quests[0], 1);
  assert.equal(s.coins, coins + TRAILS.lake.tips + QUESTS[0][0].tips);
  s.friends[2] = 3;
  s.elapsed = 80;
  advanceRetreat(s, 30);
  assert.equal(s.quests[2], 1, 'five guests welcomed after dark');
  assert.equal(s.questProgress[2], 0);
});
test('each season hosts its own festival', () => {
  assert.deepEqual(
    [0, 360, 720, 1080].map((elapsed) => festivalReward(Object.assign(freshRetreat(), { elapsed })).name),
    ['Blossom fair', 'Midsummer lanterns', 'Harvest feast', 'Snow-lantern night'],
  );
  const fest = (elapsed) => {
    const s = Object.assign(freshRetreat(), { elapsed, hearts: 12, supplies: 20 });
    assert.ok(startActivity(s, 'festival'));
    advanceRetreat(s, 60);
    return s;
  };
  assert.deepEqual(fest(0).pantry, { oatcake: 2, soap: 2 }, 'Blossom fair');
  const autumn = fest(720);
  assert.equal(autumn.supplies, 40, 'Harvest feast');
  assert.equal(autumn.festivalSeasons, 4);
  assert.equal(fest(1080).reputation, 10, 'Snow-lantern night');
  const all = Object.assign(freshRetreat(), { festivalSeasons: 15 });
  checkGoals(all);
  assert.ok(all.goals & (1 << 9), 'Festival calendar');
  const host = Object.assign(freshRetreat(), { xp: { dora: 180, enzo: 0 } });
  assert.ok(chooseSkill(host, 'dora', 2, 1));
  assert.equal(festivalReward(host).tips, 160, 'Festival host');
});
console.log(`${count} Mountain Retreat deterministic tests passed.`);
