import assert from 'node:assert/strict';
import { Pad, Clock, calm, simulate, IDLE, MICROS, HOST_GAMES, HOST_BOSS, MICRO_IDS, SPEEDS } from '../.checks/whisker-ware-game.js';
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

if (failed) { console.log(`${failed} failed`); process.exit(1); }
console.log('PASS Whisker Ware: input deriver, clock, microgame contract');
