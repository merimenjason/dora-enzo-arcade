import assert from 'node:assert/strict';
import { BellspireGame, COMPLETION, NO_INPUT, ROOMS, TILE, roomRect, rawChar, parseSave, freshSave } from '../.checks/bellspire-game.js';

const game = () => {
  const save = freshSave();
  save.flags.push('script:intro', 'script:firstDark');
  return new BellspireGame(save);
};
const wait = (g, ticks) => { for (let i = 0; i < ticks; i++) g.step(NO_INPUT); };
const tap = (g, key) => { g.step({ ...NO_INPUT, [key]: true }); g.step(NO_INPUT); };
// walking, a player hops a strip of salt-crystal spikes ahead on the floor (a jump held for a moment)
const hop = (g, keys) => {
  const dir = keys.right ? 1 : keys.left ? -1 : 0;
  if (!dir || !g.body.ground) return false;
  const c = Math.floor((g.body.x + dir * 22) / TILE), r = Math.floor((g.body.y - 1) / TILE);
  return rawChar(c, r) === '^';
};
const advance = (g, test, keys = {}, limit = 900) => {
  let held = 0;
  for (let i = 0; i < limit && !test(); i++) {
    if (held === 0 && hop(g, keys)) held = 14;
    g.step({ ...NO_INPUT, ...keys, jump: held > 0 });
    if (held > 0) held--;
  }
  assert.ok(test(), `timed out in ${g.room.id} at ${g.body.x}, ${g.body.y}: ${JSON.stringify(g.saltPrompt())}`);
};
const stand = (g, room, c, r = 14) => { g.teleport(room, c, r); wait(g, 12); };
const walk = (g, target) => {
  const right = g.body.x < target;
  advance(g, () => (right ? g.body.x >= target : g.body.x <= target), { [right ? 'right' : 'left']: true });
  wait(g, 25);
};

assert.equal(COMPLETION.salt.cells, 24);
assert.equal(ROOMS.filter((r) => r.salt).length, 12);
assert.equal(new Set(ROOMS.filter((r) => r.salt).map((r) => r.area)).size, 2);
const g = game();
stand(g, 'fgate', 26);
tap(g, 'up');
assert.equal(g.room.id, 'fgate', 'no entrance before the Hollow Bell');
g.setFlag('boss:hollow');
tap(g, 'up');
assert.equal(g.room.id, 'salt-gate');
walk(g, 20 * TILE + 8);
assert.ok(g.has('ballast'), 'the first pedestal grants Shoulder Shift');
advance(g, () => g.room.id === 'salt-school', { right: true });
walk(g, roomRect(g.room).x + 10 * TILE + 8);
assert.ok(g.has('catch'), 'the second pedestal grants Lift Catch');
for (const [id, offset, strict] of [
  ['salt-school', -30, false], ['salt-school', 24, false], ['salt-ridge', -26, false],
  ['salt-ropes', 24, true], ['salt-deep-haul', -32, false],
]) {
  const g = game();
  g.settings.strict = strict;
  g.settings.assist = !strict;
  g.giveAbility('ballast', false);
  g.giveAbility('catch', false);
  const { saltLift: plan } = ROOMS.find((r) => r.id === id);
  stand(g, id, Math.floor((plan.station + offset) / TILE));
  g.enemies = [];
  const origin = roomRect(g.room);
  assert.equal(g.saltPrompt().key, 'up', 'station has a generous approach range');
  tap(g, 'up');
  advance(g, () => g.saltLift.phase === 'catch');
  tap(g, 'up');
  assert.equal(g.saltLift.phase, 'catch', 'Dora cannot engage the catch');
  tap(g, 'tag');
  if (g.saltPrompt().key !== 'up') walk(g, origin.x + plan.station + 19 * plan.direction);
  assert.match(g.saltPrompt().text, /Lock the lift/);
  tap(g, 'up');
  const center = g.saltLift.center + origin.x;
  walk(g, center);
  advance(g, () => g.saltPrompt().key === 'up');
  tap(g, 'up');
  advance(g, () => g.saltLift.phase === 'arrived');
  assert.equal(g.body.y, origin.y + plan.high, 'the hero rides without jumping');
  assert.ok(Math.abs(g.follower.y - g.body.y) < 4, 'the follower rides on the same deck');
  walk(g, origin.x + g.saltLift.upperEdge + 32 * plan.direction);
  assert.ok(g.flag(`salt:crossed:${id}`), 'walking onto the upper landing records the crossing');
  walk(g, center);
  advance(g, () => g.saltPrompt().key === 'up');
  tap(g, 'up');
  advance(g, () => g.saltLift.phase === 'boarding');
  assert.equal(g.body.y, origin.y + plan.low, 'the same lift is usable in reverse');
  assert.ok(parseSave(JSON.stringify(g.snapshot()))?.flags.includes(`salt:crossed:${id}`));
}

for (const room of ROOMS.filter((r) => r.salt && r.boss)) {
  const g = game();
  g.giveAbility('ballast', false);
  g.giveAbility('catch', false);
  stand(g, room.id, room.boss === 'panback' ? 46 : 9);
  advance(g, () => g.saltGuardianControl() !== null);
  const control = g.saltGuardianControl();
  walk(g, control.x);
  if (room.boss === 'panback') {
    tap(g, 'tag');
    advance(g, () => g.boss.st === 'perched');
  } else if (room.boss === 'tollkeeper') {
    advance(g, () => g.boss.st === 'rest');
  }
  const before = g.boss.hp;
  tap(g, 'up');
  if (room.boss === 'weighmaster') {
    walk(g, control.x - 44);
    advance(g, () => g.boss.st === 'stagger');
  }
  advance(g, () => g.boss.hurt.length > 0);
  const b = g.boss, target = b.hurt[0];
  const fromRight = b.id === 'panback' || b.id === 'tollkeeper' && b.low === 1;
  walk(g, fromRight ? target.x + target.w + 7 : target.x - 7);
  tap(g, fromRight ? 'left' : 'right');
  for (let i = 0; i < 5 && b.hp === before; i++) { tap(g, 'attack'); wait(g, 30); }
  assert.ok(b.hp < before, `${b.id}: the exposed part can be struck from the floor`);
}
console.log('Salt Road: 24 screens, old save gate, both pedestals, five lift runs and three guardian openings passed');

for (const room of ROOMS.filter((r) => r.salt)) {
  const { x, y } = roomRect(room);
  for (const edge of [0, room.w * 30 - 1]) {
    if (rawChar(x / TILE + edge, y / TILE + 14) !== '.') continue;
    const g = game();
    if (room.boss) g.setFlag(`boss:${room.boss}`);
    stand(g, room.id, edge === 0 ? 3 : edge - 3);
    advance(g, () => g.room.id !== room.id, { [edge === 0 ? 'left' : 'right']: true }, 90);
    assert.ok(g.room.salt, `${room.id} joins the adjacent Salt Road room`);
  }
}

for (const [id, c, destination, guardian] of [
  ['salt-weighhouse', 54, 'salt-ridge', 'weighmaster'],
  ['salt-moonpan', 5, 'salt-mulegate', null],
  ['salt-panback', 5, 'salt-deep-haul', 'panback'],
]) {
  const g = game();
  if (guardian) g.setFlag(`boss:${guardian}`);
  stand(g, id, c, 12);
  advance(g, () => g.room.id === destination, { down: true }, 150);
  advance(g, () => g.body.ground, { down: true }, 180);
  // Align with the ladder and climb back, using the same shaft and no door animation timing.
  const { x } = roomRect(g.room);
  assert.ok(Math.abs(g.body.x - (x + c * TILE + 8)) < 1);
  advance(g, () => g.room.id === id, { up: true }, 170);
}
console.log('Salt Road: all horizontal doorways and three reversible shafts passed');

{
  const g = game();
  g.giveAbility('ballast', false); g.giveAbility('catch', false);
  stand(g, 'salt-tollhouse', 12);
  advance(g, () => g.boss?.st === 'rest');
  const b = g.boss;
  walk(g, g.saltGuardianControl().x);
  tap(g, 'up');
  advance(g, () => b.hurt.length > 0);
  g.damageBoss(b.hp + 1, b.x + 45, b.y - 20);
  advance(g, () => !!g.dialog);
  // the ending scene with Suma, line by line
  const ev = [];
  for (let i = 0; i < 10 && g.dialog; i++) { tap(g, 'up'); ev.push(...g.drainEvents()); }
  assert.ok(ev.some((e) => e.k === 'ending' && e.salt));
  const save = parseSave(JSON.stringify(g.snapshot()));
  assert.ok(save?.flags.includes('boss:tollkeeper') && save.flags.includes('salt:ending'));
  const loaded = new BellspireGame(save);
  assert.equal(loaded.wispOn(), false, 'the guide rests after the Salt Road ending');
  assert.ok(loaded.completion().salt.bosses === 1 && loaded.completion().bosses === 0);
}
console.log('Salt Road: ending and save reload passed');
