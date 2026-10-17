import assert from 'node:assert/strict';
import {
  Pad, Clock, calm, simulate, IDLE, MICROS, HOST_GAMES, HOST_BOSS, MICRO_IDS, SPEEDS, Rand,
  HOSTS, STAGE_PACE, stageQueue, Run, freshProfile, loadProfile, record, unlocked,
} from '../.checks/whisker-ware-game.js';
import { SOLVERS, READY_HOSTS } from './whisker-ware-solvers.mjs';

let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`ok   ${name}`); } catch (e) { failed++; console.log(`FAIL ${name}\n${e.stack}`); }
}

test('press, release and edges', () => {
  const p = new Pad();
  assert.equal(p.read({ ...IDLE, down: true }).pressed, true);
  assert.equal(p.read({ ...IDLE, down: true }).pressed, false);
  assert.equal(p.read(IDLE).released, true);
});
test('pointer swipe needs 40 units; arrow press swipes', () => {
  const p = new Pad();
  p.read({ ...IDLE, x: 200, y: 160, down: true }); assert.equal(p.read({ ...IDLE, x: 239, y: 160 }).swipe, 0);
  p.read({ ...IDLE, x: 200, y: 160, down: true }); assert.equal(p.read({ ...IDLE, x: 241, y: 160 }).swipe, 1);
  assert.equal(p.read({ ...IDLE, left: true }).swipe, -1); assert.equal(p.read({ ...IDLE, left: true }).swipe, 0);
});
test('rubs: pointer reversals after 12 units, alternating arrows', () => {
  const p = new Pad(); let n = 0;
  for (const x of [100, 115, 100, 115]) n += p.read({ ...IDLE, x, y: 100, down: true }).rub ? 1 : 0;
  assert.equal(n, 2); // reversals at 115→100 and 100→115, each after 15 units of travel
  const w = new Pad(); let s = 0;
  for (const x of [100, 105, 100, 105]) s += w.read({ ...IDLE, x, y: 100, down: true }).rub ? 1 : 0;
  assert.equal(s, 0); // 5-unit wiggles are not rubs
  const k = new Pad(); let m = 0;
  for (const f of [{ left: true }, {}, { right: true }, {}, { right: true }, {}, { left: true }]) m += k.read({ ...IDLE, ...f }).rub ? 1 : 0;
  assert.equal(m, 2); // right after left, left after right; right twice is one stroke
});
test('steer follows the held arrows', () => {
  const p = new Pad();
  assert.equal(p.read({ ...IDLE, left: true }).steer, -1);
  assert.equal(p.read({ ...IDLE, right: true }).steer, 1);
  assert.equal(p.read({ ...IDLE, left: true, right: true }).steer, 0);
});
test('clock accumulates fractional speed', () => {
  const c = new Clock(1.15); let n = 0; for (let i = 0; i < 100; i++) n += c.steps(); assert.equal(n, 115);
  for (const sp of SPEEDS) { const k = new Clock(sp); let t = 0; for (let i = 0; i < 100; i++) t += k.steps(); assert.equal(t, Math.round(sp * 100)); }
});
test('edges fire on the first sim step only', () => {
  const i = new Pad().read({ ...IDLE, down: true, pick: 2 });
  const q = calm(i); assert.equal(q.pressed, false); assert.equal(q.pick, 0); assert.equal(q.down, true);
});
test('the table lists 24 ids in host order', () => {
  assert.equal(MICRO_IDS.length, 24);
  assert.equal(HOST_GAMES.length, 4);
  assert.deepEqual(HOST_BOSS, ['raisin', 'shelf', 'moon', 'ring']);
  assert.deepEqual(HOST_GAMES.flat().concat(HOST_BOSS).sort(), [...MICRO_IDS].sort());
});
test('simulate rejects an unknown id', () => {
  assert.throws(() => simulate('nope', 1, 1, 0, () => IDLE), /nope/);
});
test('every ready host is complete and solvable, idle loses, replays match', () => {
  for (const h of READY_HOSTS) for (const id of [...HOST_GAMES[h], HOST_BOSS[h]]) {
    const m = MICROS[id]; assert.ok(m, `${id} is registered`); assert.ok(SOLVERS[id], `${id} has a solver`);
    assert.equal(m.ticks, m.boss ? 900 : 300); assert.equal(m.host, h);
    for (const level of [1, 2, 3]) for (const tier of [0, 5]) for (let seed = 1; seed <= 100; seed++) {
      const a = simulate(id, seed, level, tier, SOLVERS[id]);
      assert.equal(a.result, 'win', `${id} L${level} tier ${tier} seed ${seed}: the solver wins`);
      assert.deepEqual(simulate(id, seed, level, tier, SOLVERS[id]), a, `${id} replays exactly`);
      assert.equal(simulate(id, seed, level, tier, () => IDLE).result, 'lose', `${id} L${level} tier ${tier} seed ${seed}: idle loses`);
    }
  }
});

test('all 24 microgames are registered and solved', () => {
  assert.equal(Object.keys(MICROS).length, 24);
  for (const id of MICRO_IDS) { assert.ok(MICROS[id], `${id} is registered`); assert.ok(SOLVERS[id], `${id} has a solver`); }
});

test('HUSH: tapping a quiet spot wakes the Owl, so mashing loses', () => {
  for (let seed = 1; seed <= 50; seed++) {
    const mash = simulate('hush', seed, 1, 0, (_s, t) => ({ ...IDLE, pick: (t % 3) + 1 }));
    assert.equal(mash.result, 'lose', `seed ${seed}`);
    assert.ok(mash.ticks < 20, `seed ${seed} loses at once, not at the fuse (${mash.ticks})`);
  }
});
test('FIND: the lantern digs where it is let go; a dig away from the acorn loses', () => {
  for (let seed = 1; seed <= 50; seed++) {
    // a finger held on the acorn: the lantern glides there, and lifting the finger digs
    const hold = simulate('find', seed, 1, 0, (s, t) => ({ ...IDLE, x: s.acorn.x, y: s.acorn.y, down: t < 120 }));
    assert.equal(hold.result, 'win', `seed ${seed}: hold and lift wins`);
    // a quick tap on the acorn digs before the lantern has got there
    const tap = simulate('find', seed, 1, 0, (s, t) => (t === 0 ? { ...IDLE, x: s.acorn.x, y: s.acorn.y, down: true } : { ...IDLE, x: s.acorn.x, y: s.acorn.y }));
    assert.equal(tap.result, 'lose', `seed ${seed}: a dig in the wrong place loses`);
    assert.ok(tap.ticks < 10, `seed ${seed}: at once (${tap.ticks})`);
  }
});

// ── The run ───────────────────────────────────────────────────────────────────

/** Steps a run to its end. `decide(run)` says whether the current microgame is played to win (its solver) or left idle. */
function play(run, decide = () => true, log = []) {
  let seen = null;
  for (let n = 0; n < 200000 && run.phase !== 'over' && run.phase !== 'clear'; n++) {
    if (run.phase === 'micro' && seen !== run.played) { seen = run.played; log.push({ id: run.game, tier: run.tier, level: run.level, lives: run.lives, win: decide(run) }); }
    const f = run.phase === 'micro' && log[log.length - 1].win ? SOLVERS[run.game](run.state, run.t) : IDLE;
    run.step(f);
    log.events = (log.events ?? []).concat(run.drain());
  }
  return log;
}
/** Real ticks spent in each break, in order. */
function breaks(run, decide = () => true) {
  const out = []; let n = 0;
  for (let k = 0; k < 200000 && run.phase !== 'over' && run.phase !== 'clear'; k++) {
    if (run.phase === 'break') n++; else if (n) { out.push(n); n = 0; }
    run.step(run.phase === 'micro' && decide(run) ? SOLVERS[run.game](run.state, run.t) : IDLE);
  }
  return out;
}

test('hosts and pacing tables', () => {
  assert.deepEqual(HOSTS.map(h => h.id), ['enzo', 'dora', 'owl', 'fox']);
  assert.deepEqual(STAGE_PACE.map(p => [...p.tiers, p.level]), [[0, 1, 1], [1, 2, 1], [2, 3, 2], [3, 4, 2]]);
});
test('stage queue: 8 games, all five, no repeats in a row', () => {
  for (let h = 0; h < 4; h++) for (let seed = 1; seed <= 200; seed++) {
    const q = stageQueue(new Rand(seed), h);
    assert.equal(q.length, 8);
    for (const id of HOST_GAMES[h]) assert.ok(q.includes(id), `${id} in host ${h} seed ${seed}`);
    assert.ok(q.every(id => HOST_GAMES[h].includes(id)));
    for (let k = 1; k < 8; k++) assert.notEqual(q[k], q[k - 1]);
  }
});
test('a host stage at the right pace', () => {
  const enzo = play(new Run('host', 7, { host: 0 }));
  assert.deepEqual(enzo.map(g => g.tier), [0, 0, 0, 0, 1, 1, 1, 1, 1]);
  assert.ok(enzo.every(g => g.level === 1));
  assert.equal(enzo[8].id, 'raisin');
  const fox = play(new Run('host', 7, { host: 3 }));
  assert.deepEqual(fox.map(g => g.tier), [3, 3, 3, 3, 4, 4, 4, 4, 4]);
  assert.ok(fox.every(g => g.level === 2));
});
test('a perfect stage clears', () => {
  const run = new Run('host', 3, { host: 1 }), log = play(run);
  assert.equal(run.phase, 'clear'); assert.equal(run.cleared, 9); assert.equal(run.lives, 4);
  const marks = log.events.filter(e => e === 'speedup' || e === 'boss' || e === 'clear');
  assert.deepEqual(marks, ['speedup', 'boss', 'clear']);
  assert.equal(log.events.filter(e => e === 'command').length, 9);
  assert.equal(run.wins.length, 9);
});
test('losing costs a life and moves on; losing the boss repeats it', () => {
  let bossTries = 0;
  const run = new Run('host', 5, { host: 0 });
  const log = play(run, r => {
    if (r.played === 2) return false;
    if (MICROS[r.game].boss) return ++bossTries > 2;
    return true;
  });
  assert.equal(log[1].lives, 4); assert.equal(log[2].lives, 3, 'game 3 starts with a life gone');
  assert.equal(log.filter(g => g.id === 'raisin').length, 3, 'the boss is played until it is beaten');
  assert.equal(run.phase, 'clear'); assert.equal(run.lives, 1);
});
test('four losses end the stage', () => {
  const run = new Run('host', 5, { host: 2 }), log = play(run, () => false);
  assert.equal(run.phase, 'over'); assert.equal(run.lives, 0); assert.equal(log.length, 4);
  assert.ok(log.events.includes('over'));
});
test('break lengths', () => {
  assert.deepEqual(breaks(new Run('host', 1, { host: 0 })).slice(0, 6), [90, 90, 90, 90, 135, 90]);
  assert.deepEqual(breaks(new Run('host', 1, { host: 3 })).slice(0, 9), [90, 90, 90, 90, 105, 60, 60, 60, 105]);
});
test('remix pacing', () => {
  const run = new Run('remix', 9), log = play(run, r => r.played <= 45);
  assert.deepEqual(log.slice(0, 5).map(g => g.tier), [0, 0, 0, 0, 0]);
  assert.equal(log[5].tier, 1);
  assert.equal(log[10].id, 'raisin'); assert.equal(log[10].level, 1); assert.equal(log[11].level, 2);
  assert.equal(log[21].id, 'shelf'); assert.equal(log[22].level, 3);
  assert.ok(log.every(g => g.tier <= 5 && g.level <= 3));
  assert.equal(Math.max(...log.map(g => g.tier)), 5); assert.equal(log[44].level, 3);
  for (let k = 1; k < log.length; k++) assert.notEqual(log[k].id, log[k - 1].id);
  assert.equal(run.phase, 'over'); assert.equal(run.cleared, 45);
});
test('practice', () => {
  const run = new Run('practice', 2, { game: 'sniff' }), log = play(run, r => r.played <= 7);
  assert.ok(log.every(g => g.id === 'sniff'));
  assert.equal(log[0].lives, 1); assert.equal(log[3].tier, 1); assert.equal(log[6].tier, 2); assert.equal(log[6].level, 2);
  assert.equal(run.phase, 'over'); assert.equal(run.streak, 7);
});
test('force starts a chosen microgame at once', () => {
  const run = new Run('host', 1, { host: 0 });
  run.force('hop', 3, 5);
  assert.equal(run.phase, 'micro'); assert.equal(run.game, 'hop'); assert.equal(run.level, 3); assert.equal(run.tier, 5);
});

test('profile: record unlocks and keeps bests', () => {
  let p = freshProfile();
  assert.deepEqual(unlocked(p).hosts, [true, false, false, false]); assert.equal(unlocked(p).remix, false);
  const stage = new Run('host', 3, { host: 0 }); play(stage);
  p = record(p, stage);
  assert.equal(p.hosts, 1); assert.equal(p.games.raisin.tier, 1); assert.deepEqual(unlocked(p).hosts, [true, true, false, false]);
  assert.deepEqual(record(p, stage), p, 'recording twice changes nothing');
  const remix = new Run('remix', 4); play(remix, r => r.played <= 6);
  p = record(p, remix); assert.equal(p.remixBest, 6);
  const worse = new Run('remix', 4); play(worse, () => false);
  assert.equal(record(p, worse).remixBest, 6);
  const practice = new Run('practice', 4, { game: 'stuff' }); play(practice, r => r.played <= 4);
  p = record(p, practice); assert.equal(p.games.stuff.streak, 4); assert.equal(p.games.stuff.tier, 1);
  assert.ok(unlocked(p).games.includes('stuff'));
  assert.equal(unlocked({ ...p, hosts: 4 }).remix, true);
  assert.equal(loadProfile(JSON.stringify(p)).remixBest, 6, 'a saved profile loads back');
});
test('profile: malformed saves load fresh', () => {
  const fresh = freshProfile();
  for (const raw of [null, 'nope', '{"v":2}', '{"v":1,"hosts":9,"remixBest":0,"games":{}}', '{"v":1,"hosts":-1,"remixBest":0,"games":{}}',
    '{"v":1,"hosts":1.5,"remixBest":0,"games":{}}', '{"v":1,"hosts":1,"remixBest":"3","games":{}}', '{"v":1,"hosts":1,"remixBest":3,"games":[]}',
    '{"v":1,"hosts":1,"remixBest":3,"games":{"stuff":{"tier":6,"streak":0}}}']) {
    assert.deepEqual(loadProfile(raw), fresh, `${raw} loads fresh`);
  }
  const kept = loadProfile('{"v":1,"hosts":2,"remixBest":3,"games":{"stuff":{"tier":2,"streak":1},"nope":{"tier":1,"streak":0}}}');
  assert.deepEqual(kept, { v: 1, hosts: 2, remixBest: 3, games: { stuff: { tier: 2, streak: 1 } } });
});

if (failed) { console.log(`${failed} failed`); process.exit(1); }
console.log('PASS Whisker Ware: input deriver, clock, microgame contract');
