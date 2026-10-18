import assert from 'node:assert/strict';
import * as G from '../.checks/hay-bale-game.js';
import * as M from '../.checks/hay-bale-motion.js';

let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`ok   ${name}`); } catch (e) { failed++; console.log(`FAIL ${name}\n${e.stack}`); }
}
let nextUid = 1;
const u = (id, level = 1, extra = {}) => { const d = G.UNITS[id]; return { uid: nextUid++, id, a: d?.a ?? 0, h: d?.h ?? 1, level, xp: 0, status: null, tmpA: 0, ...extra }; };
const tok = (id, a, h) => u(id, 1, { a, h });
const near = (a, b) => Math.abs(a - b) < 1e-9;
const still = (pose) => near(pose.dx, 0) && near(pose.dy, 0) && near(pose.sx, 1) && near(pose.sy, 1) && near(pose.rot, 0) && near(pose.alpha, 1);
const at = (events, k, uid) => events.findIndex((e) => e.k === k && (uid === undefined || e.uid === uid));

// A mouse faints, its ability summons a mouselet, then the line closes up: faint, ability, summon, line.
const mouse = u('mouse'), wren = u('wren'), bully = tok('fawn', 9, 50);
const fought = G.fight([mouse, wren], [bully], 1, null);
const brawl = { ...fought, left: [mouse, wren], rival: { name: 'Bully', line: [bully] } };
const ev = brawl.events;
const faintAt = at(ev, 'faint', mouse.uid), lineAt = ev.findIndex((e, i) => i > faintAt && e.k === 'line' && e.side === 0);

test('the fight used for these checks has a gap between a faint and the line closing up', () => {
  assert.ok(faintAt >= 0 && lineAt > faintAt + 1, `faint ${faintAt}, line ${lineAt}`);
  assert.ok(ev.slice(faintAt + 1, lineAt).some((e) => e.k === 'ability' || e.k === 'summon'));
});

test('a fainted critter stays gone through the events before the line closes up', () => {
  for (let n = faintAt + 2; n <= lineAt; n++) {
    const lines = M.replayLines(brawl, n), shown = lines[0].find((x) => x.uid === mouse.uid);
    if (!shown) continue;
    for (const p of [0, 0.5, 1]) assert.equal(M.fightPose(ev[n - 1], shown, 0, p, false).alpha, 0, `event ${n - 1} at ${p}`);
  }
});

test('a faint tumbles away and fades; calm only fades', () => {
  const shown = M.replayLines(brawl, faintAt + 1)[0].find((x) => x.uid === mouse.uid);
  assert.ok(shown.dead);
  const mid = M.fightPose(ev[faintAt], shown, 0, 0.5, false), end = M.fightPose(ev[faintAt], shown, 0, 1, false);
  assert.ok(mid.rot !== 0 && mid.dx < 0, 'tumbles backwards, away from the rival');
  assert.equal(end.alpha, 0);
  const calm = M.fightPose(ev[faintAt], shown, 0, 0.5, true);
  assert.deepEqual([calm.dx, calm.dy, calm.rot], [0, 0, 0]); assert.ok(near(calm.alpha, 0.5));
});

test('an attack winds up, lunges at the rival and comes home; calm keeps it within 3 px', () => {
  const e = { k: 'attack', uid: wren.uid }, me = { uid: wren.uid };
  assert.ok(M.fightPose(e, me, 0, 0.15, false).dx < 0, 'leans back first');
  const top = Math.max(...[0.4, 0.5, 0.6, 0.7].map((p) => M.fightPose(e, me, 0, p, false).dx));
  assert.ok(top >= 12, `lunges forward (${top})`);
  assert.ok(M.fightPose(e, me, 1, 0.55, false).dx < 0, 'the rival lunges left');
  assert.ok(still(M.fightPose(e, me, 0, 1, false)) && still(M.fightPose(e, me, 0, 0, false)), 'starts and ends at home');
  for (let p = 0; p <= 1; p += 0.05) {
    const c = M.fightPose(e, me, 0, p, true);
    assert.ok(Math.abs(c.dx) <= 3 && c.dy === 0 && c.sx === 1 && c.sy === 1 && c.rot === 0);
  }
});

test('a hit knocks the target back from the rival and settles; calm stays still', () => {
  const e = { k: 'hit', uid: 9, dmg: 3, h: 1 }, me = { uid: 9 };
  assert.ok(M.fightPose(e, me, 0, 0.3, false).dx < 0 && M.fightPose(e, me, 1, 0.3, false).dx > 0);
  assert.ok(still(M.fightPose(e, me, 0, 1, false)));
  assert.ok(still(M.fightPose(e, me, 0, 0.3, true)));
});

test('a summon pops in from nothing; abilities and buffs hop and settle', () => {
  const s = ev.find((e) => e.k === 'summon'), me = { uid: s.unit.uid };
  assert.ok(M.fightPose(s, me, 0, 0, false).sx < 0.2 && still(M.fightPose(s, me, 0, 1, false)));
  assert.ok(Math.max(...[0.5, 0.6, 0.7, 0.8].map((p) => M.fightPose(s, me, 0, p, false).sx)) > 1, 'overshoots a little');
  assert.ok(still(M.fightPose(s, me, 0, 0, true)), 'calm shows it at once');
  for (const k of ['ability', 'buff']) {
    const e = { k, uid: 4, a: 1, h: 1 };
    assert.ok(M.fightPose(e, { uid: 4 }, 0, 0.5, false).dy < 0, k);
    assert.ok(still(M.fightPose(e, { uid: 4 }, 0, 1, false)) && still(M.fightPose(e, { uid: 4 }, 0, 0.5, true)), k);
  }
});

test('nobody else moves: no idle bounce, whatever the event or the moment', () => {
  for (const e of ev) for (const p of [0, 0.3, 0.7, 1]) assert.ok(still(M.fightPose(e, { uid: 424242 }, 0, p, false)), e.k);
  assert.ok(still(M.fightPose(undefined, { uid: 1 }, 0, 0.5, false)));
});

test('the line slides forward when it closes up and when a summon pushes in; calm snaps', () => {
  const before = M.replayLines(brawl, lineAt)[0], after = M.replayLines(brawl, lineAt + 1)[0];
  const moved = after.find((x) => before.findIndex((y) => y.uid === x.uid) !== after.indexOf(x));
  assert.ok(moved, 'someone changes place');
  const from = before.findIndex((y) => y.uid === moved.uid), to = after.indexOf(moved);
  assert.equal(M.linePlaces(brawl, lineAt + 1, 0, false).get(moved.uid), from);
  assert.equal(M.linePlaces(brawl, lineAt + 1, 1, false).get(moved.uid), to);
  const mid = M.linePlaces(brawl, lineAt + 1, 0.5, false).get(moved.uid);
  assert.ok(Math.min(from, to) < mid && mid < Math.max(from, to));
  assert.equal(M.linePlaces(brawl, lineAt + 1, 0, true).get(moved.uid), to);
  for (const [uid, i] of M.linePlaces(brawl, 1, 0.5, false)) assert.equal(i, Math.round(i), `${uid} rests on a whole slot when nobody moves`);
});

test('winners hop once at the end, then stand still', () => {
  assert.ok(M.endHop(0.2, false) < 0);
  assert.equal(M.endHop(0, false), 0); assert.equal(M.endHop(3, false), 0); assert.equal(M.endHop(30, false), 0);
  assert.equal(M.endHop(0.2, true), 0);
});

test('shop effects: each lives for its own time, and a landing squashes only its own slot', () => {
  const fx = [{ k: 'land', at: 1000, i: 2 }, { k: 'roll', at: 1000, i: 0 }, { k: 'spend', at: 1000, i: 0, n: 3 }];
  assert.equal(M.liveFx(fx, 1000 + 1e5).length, 0, 'all gone in the end');
  assert.equal(M.liveFx(fx, 900).length, 0, 'none from the future');
  assert.equal(M.liveFx(fx, 1050).length, 3);
  const squash = M.slotPose(fx, 1060, 2);
  assert.ok(squash.sx > 1 && squash.sy < 1, 'lands with a squash');
  assert.ok(still(M.slotPose(fx, 1060, 1)) && still(M.slotPose(fx, 1e6, 2)));
  assert.ok(M.rollIn(fx, 1000, 0) < 0.2 && M.rollIn(fx, 1000 + 1e4, 0) === 1, 'new offers grow into place');
  assert.ok(M.rollIn(fx, 1100, 3) < M.rollIn(fx, 1100, 0), 'one after another, left to right');
  assert.equal(M.rollIn([], 5, 0), 1);
});

if (failed) { console.log(`${failed} failed`); process.exit(1); }
console.log('PASS Hay Bale Brawl motion');
