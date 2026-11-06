// Combo Ball engine checks: the league and the run, what each pass adds to the chain (chips, first-time mult, long
// balls, lofted balls, switches, back to sender) and every trait's twist, a goal worth (10 + chips) × mult on the real
// pitch, the chain wiped when they win the ball, pressure, Nutmeg, Ricochet and Piggy Bank, undo putting the chain back,
// the target (reached early, raised by a conceded goal, missed at full time), the Hint, the transfer shop and its five
// slots, a seed replaying, and the save. Run after `npm test` has compiled the engines into .checks/ (or
// `npm run test:combo`).
import assert from 'node:assert/strict';
import { Run, TEAMS, TRAITS, TARGETS, MATCHES, SLOTS, TURNS, CREEP, PRESSURE, LEAGUES, OUR_SIDE, team, chainValue, SAVE_KEY, newSave, parseSave, serialise, bank } from '../.checks/combo-game.js';
import { ROWS } from '../.checks/tactics-football.js';

/** a pass record as the engine makes them */
const P = (from, to, o = {}) => ({ from, to, team: 0, lofted: false, len: 2, back: false, banked: false, bent: false, turn: 0, oneTouch: false, a: { c: 5, r: 4 }, b: { c: 7, r: 4 }, ...o });
const who = (id) => OUR_SIDE[id] ?? 'keeper';
const cv = (chain, traits = [], bonus = 0) => chainValue(chain, (id) => traits.includes(id), who, bonus);
/** a match of the run set out by hand: ours at the given cells, theirs along the bottom row unless placed */
function board(r, ours, theirs = [], holder = 0) {
  const m = r.game, O = m.units.filter((u) => u.team === 0 && !u.keeper), T = m.units.filter((u) => u.team === 1 && !u.keeper);
  [...O, ...T].forEach((u, k) => Object.assign(u, { c: 1 + k, r: ROWS - 1 }));
  ours.forEach(([c, rr], k) => Object.assign(O[k], { c, r: rr }));
  theirs.forEach(([c, rr], k) => Object.assign(T[k], { c, r: rr }));
  m.s.chain = []; m.s.data = {};
  m.give(m.unit(holder)); m.startTurn(); m.events = [];
  return m;
}
const fresh = (seed = 5, traits = []) => { const r = new Run(seed); r.traits = traits.slice(); r.startMatch(); r.ready(); return r; };

{
  // the league and the run: nine matches in three leagues, animal teams easiest first and the Grumbles in the final
  assert.equal(TEAMS.length, MATCHES); assert.equal(LEAGUES.length, 3); assert.equal(TARGETS.length, MATCHES);
  assert.deepEqual(TEAMS.map((t) => t.id), ['rabbit', 'frog', 'mole', 'otter', 'hog', 'magpie', 'fox', 'badger', 'grumble']);
  for (const [i, t] of TEAMS.entries()) { assert.ok(t.name && t.kit && t.style && t.keeper && t.level); assert.equal(team(i), t); }
  for (let i = 1; i < MATCHES; i++) assert.ok(TARGETS[i] > TARGETS[i - 1], 'the targets climb');
  assert.equal(TRAITS.length, 14); assert.equal(SLOTS, 5);
  const r = new Run(3);
  assert.equal(r.phase, 'sheet'); assert.equal(r.foe.id, 'rabbit'); assert.equal(r.target, TARGETS[0]);
  assert.equal(r.game.units.filter((u) => u.team === 0 && !u.keeper).length, 3, 'three-a-side');
  assert.deepEqual(r.game.units.filter((u) => u.team === 0).map((u) => u.who), ['dora', 'enzo', 'pip', 'keeper']);
  assert.ok(r.game.units.filter((u) => u.team === 1).every((u) => u.who.startsWith('rabbit')), 'the rabbits play the first match');
  assert.equal(r.move(0, 8, 4), false, 'nothing moves until kick-off');
  r.ready(); assert.equal(r.phase, 'play'); assert.equal(r.game.s.maxTurns, TURNS);
  // the same seed plays the same way
  const a = new Run(11), b = new Run(11); a.ready(); b.ready();
  for (let k = 0; k < 6; k++) { a.endTurn(); b.endTurn(); }
  assert.equal(JSON.stringify(a.game.s), JSON.stringify(b.game.s));
}

{
  // the chain: a pass is 10 chips; long +10, lofted +5, a switch +10; first-time +1 mult; straight back is nothing
  assert.deepEqual([cv([P(0, 1)]).chips, cv([P(0, 1)]).mult], [10, 1]);
  assert.equal(cv([P(0, 1, { len: 5 })]).chips, 20);
  assert.equal(cv([P(0, 1, { lofted: true, len: 4 })]).chips, 15);
  assert.equal(cv([P(0, 1, { a: { c: 5, r: 0 }, b: { c: 6, r: 4 } })]).chips, 20, 'a switch of play');
  assert.equal(cv([P(0, 1), P(1, 2, { oneTouch: true })]).mult, 2, 'a first-time pass adds mult');
  const pong = cv([P(0, 1), P(1, 0, { oneTouch: true })]);
  assert.deepEqual([pong.chips, pong.mult, pong.passes], [10, 1, 1], 'straight back to sender counts for nothing');
  assert.match(pong.gains[1].text, /Back to sender/);
  assert.equal(cv([P(0, 1)], [], 15).chips, 25, 'bonus chips join the chain');
  // the traits
  assert.deepEqual([cv([P(0, 1, { len: 6 })], ['routeone']).chips, cv([P(0, 1, { len: 6 })], ['routeone']).mult], [10, 3], 'Route One: mult instead of chips');
  assert.equal(cv([P(0, 1, { a: { c: 5, r: 0 }, b: { c: 6, r: 5 } })], ['crossfield']).mult, 2, 'Crossfield');
  assert.equal(cv([P(0, 1, { back: true })], ['backpass']).mult, 2, 'Backpass Bandit');
  assert.equal(cv([P(0, 1), P(1, 2, { back: true, oneTouch: true })], ['backheel']).mult, 4, 'Backheel: Enzo, first time, backwards');
  assert.equal(cv([P(0, 2), P(2, 1, { back: true, oneTouch: true })], ['backheel']).mult, 2, 'only Enzo backheels');
  const tiki = cv([P(0, 1), P(1, 2, { oneTouch: true, len: 5 })], ['tiki']);
  assert.deepEqual([tiki.chips, tiki.mult], [20, 3], 'Tiki-Taka: first-time passes +2 mult, the others no chips');
  const five = [P(0, 1), P(1, 2), P(2, 0), P(0, 1), P(1, 2)];
  assert.equal(cv(five).chips, 50); assert.equal(cv(five, ['metronome']).chips, 100, 'Metronome doubles at the fifth pass');
}

{
  // a goal on the real pitch is worth (10 + chips) × mult: Dora to Enzo, Enzo first time to Pip, Pip scores
  const r = fresh(5);
  const m = board(r, [[8, 3], [10, 4], [12, 5]]);
  assert.ok(r.pass(0, 1)); assert.equal(r.chain.chips, 10);
  assert.ok(r.pass(1, 2)); assert.equal(r.chain.mult, 2, 'Enzo played it first time');
  const before = r.chain, row = [3, 4, 5].find((rr) => m.shotPreview(2, rr).result === 'goal');
  assert.ok(row !== undefined, 'Pip has a clear shot');
  assert.equal(m.shotPreview(2, row).value, (10 + before.chips) * before.mult, 'the preview shows what it’s worth');
  assert.ok(r.shoot(2, row));
  assert.equal(r.points, (10 + 20) * 2); assert.equal(r.stats.goals, 1);
  assert.equal(r.lastGoal.pts, 60); assert.match(r.lastGoal.notes[0], /30 × 2/);
  // a target reached ends the match there and then, and the shop opens with three traits
  assert.equal(r.phase, 'shop'); assert.equal(r.last, 'won'); assert.equal(r.offer.length, 3);
  assert.ok(r.offer.every((id) => TRAITS.some((t) => t.id === id)));
  assert.ok(r.pick(r.offer[0])); assert.equal(r.traits.length, 1); assert.equal(r.match, 1); assert.equal(r.phase, 'sheet');
  assert.equal(r.foe.id, 'frog'); assert.equal(r.target, TARGETS[1]);
}

{
  // the chain is wiped when they win the ball: a pass cut out, and the bonus goes with it
  const r = fresh(6);
  const m = board(r, [[6, 4], [8, 4], [8, 1]], [[1, 0]]);
  assert.ok(r.pass(0, 1)); assert.equal(r.chain.passes, 1);
  m.s.data.bonus = 5;
  // Enzo to Pip goes through a defender planted on the line
  Object.assign(m.unit(m.units.find((u) => u.team === 1 && !u.keeper).id), { c: 8, r: 2 });
  assert.equal(m.passPreview(1, 2).ok, false);
  assert.ok(r.pass(1, 2));
  assert.equal(m.poss, 1); assert.equal(r.chain.passes, 0); assert.equal(m.s.data.bonus, 0, 'a wiped chain loses its bonus');
}

{
  // pressure: every PRESSURE passes in a chain, they press with one more and lunge a cell further (half as fast with
  // Cool Head), planned at the start of the next turn
  const r = fresh(7), base = r.foe.level;
  const four = [P(0, 1), P(1, 2), P(2, 0), P(0, 1)];
  board(r, [[4, 2], [6, 4], [4, 6]], [[13, 0]]);
  assert.equal(r.pressure, 0);
  r.game.s.chain = four.slice();
  assert.equal(r.chain.passes, PRESSURE); assert.equal(r.pressure, 1);
  r.game.startTurn();
  assert.equal(r.game.o.level.press, base.press + 1); assert.equal(r.game.o.level.zone, base.zone + 1);
  assert.equal(base.press, TEAMS[0].level.press, 'the team itself is left as it was');
  const c = fresh(7, ['coolhead']);
  c.game.s.chain = four.slice();
  assert.equal(c.pressure, 0, 'Cool Head: twice as many passes before they press harder');
}

{
  // Nutmeg: the carrier dribbles through a cell between two of them for +5 chips, and undo takes it back
  const r = fresh(8, ['nutmeg']);
  const m = board(r, [[6, 4], [3, 1], [3, 7]], [[7, 3], [7, 5]]);
  // the ones beside the gap stay put this turn (their plan is made; we only check our dribble)
  assert.ok(r.move(0, 8, 4) || r.move(0, 7, 4));
  assert.equal(m.s.data.bonus, 5); assert.equal(r.chain.chips, 5);
  assert.ok(r.undo()); assert.equal(m.s.data.bonus ?? 0, 0, 'undo puts the chain back as it was');
}

{
  // Ricochet: their keeper's save bounces to us and the chain lives on with +10 chips; Piggy Bank carries half a
  // goal's chips into the next goal
  const r = fresh(9, ['ricochet']);
  const m = board(r, [[7, 4], [9, 3], [9, 5]]);
  assert.ok(r.pass(0, 1));
  const row = [3, 4, 5].find((rr) => m.shotPreview(1, rr).result === 'saved');
  assert.ok(row !== undefined, 'a shot the keeper has covered');
  assert.ok(r.shoot(1, row));
  assert.equal(m.carrier.team, 0, 'the save bounced back to us'); assert.equal(m.s.data.bonus, 10); assert.equal(r.chain.passes, 1);
  const p = fresh(10, ['piggy']);
  const g = board(p, [[10, 3], [12, 4], [6, 6]]);
  assert.ok(p.pass(0, 1));
  const prow = [3, 4, 5].find((rr) => g.shotPreview(1, rr).result === 'goal');
  assert.ok(p.shoot(1, prow)); assert.equal(g.s.data.carry, 5, 'half of the chain’s 10 chips');
  // the next goal includes them
  const ctx = { by: 1, team: 0, c: 12, r: 4, row: 4, dist: 3, header: false, deflected: false, turn: 1, chain: [], lastTouch: 0 };
  assert.equal(p.worth(0, ctx).value, 10 + 5);
}

{
  // the shot traits, through what a goal is worth
  const r = fresh(12);
  const m = r.game, ctx = (o = {}) => ({ by: 0, team: 0, c: 10, r: 4, row: 4, dist: 5, header: false, deflected: false, turn: 2, chain: [P(0, 1)], lastTouch: 0, ...o });
  assert.equal(r.worth(0, ctx()).value, 20);
  r.traits = ['volley']; assert.equal(r.worth(0, ctx({ header: true })).value, 40, 'Volley ×2');
  r.traits = ['longrange']; assert.equal(r.worth(0, ctx({ dist: 7 })).value, 80, 'Long Range +3 mult');
  r.traits = ['hotstreak']; m.s.goals[0] = 2; assert.equal(r.worth(0, ctx()).value, 60, 'Hot Streak +1 mult a goal');
  r.traits = ['lateshow']; m.s.goals[0] = 0; m.s.turn = m.s.maxTurns - 2; assert.equal(r.worth(0, ctx()).value, 40, 'Late Show ×2');
  assert.equal(r.worth(1, ctx()).value, 1, 'their goals are just goals');
}

{
  // conceding raises the target; full time short of it ends the run
  const r = fresh(13);
  const t0 = r.target;
  r.game.events = [{ k: 'goal', team: 1, value: 1, notes: [] }];
  r.game.s.score[1] = 1;
  r['after'](true);
  assert.equal(r.target, t0 + Math.round(TARGETS[0] * CREEP));
  r.game.s.over = true; r.game.events = []; r['after'](true);
  assert.equal(r.phase, 'lost'); assert.equal(r.last, 'lost');
}

{
  // the Hint: never straight back to whoever just passed, and a shot once the chain is worth cashing in
  const r = fresh(14);
  const m = board(r, [[6, 4], [8, 4], [8, 1]]);
  assert.ok(r.pass(0, 1));
  const h = r.hint();
  assert.ok(h && !(h.k === 'pass' && h.to === 0), 'no ping-pong');
  const s = fresh(15);
  const g = board(s, [[10, 3], [12, 4], [11, 6]]);
  assert.ok(s.pass(0, 1)); assert.ok(s.pass(1, 2));
  const h2 = s.hint();
  if ([3, 4, 5].some((rr) => g.shotPreview(2, rr).result === 'goal')) assert.equal(h2.k, 'shoot');
}

{
  // the shop: five slots; a sixth trait needs one dropped, and the next match follows
  const r = new Run(16);
  r.ready(); r.traits = TRAITS.slice(0, SLOTS).map((t) => t.id);
  r.game.s.score[0] = r.target; r.endMatch();
  assert.equal(r.phase, 'shop');
  const want = r.offer[0];
  assert.equal(r.pick(want), false, 'full: drop one first');
  assert.ok(r.pick(want, r.traits[0])); assert.equal(r.traits.length, SLOTS); assert.ok(r.traits.includes(want));
  // or take nothing
  const q = new Run(17); q.ready(); q.game.s.score[0] = q.target; q.endMatch(); assert.ok(q.pick()); assert.equal(q.traits.length, 0);
  // winning the final wins the run
  const w = new Run(18); w.match = MATCHES - 1; w.startMatch(); w.ready(); w.game.s.score[0] = w.target; w.endMatch();
  assert.equal(w.phase, 'won'); assert.equal(w.foe.id, 'grumble');
}

{
  // the save: version 2, old real-time saves ignored, broken ones start fresh, a run banked
  assert.equal(SAVE_KEY, 'combo-ball-v2');
  const s = newSave(); assert.equal(s.v, 2);
  assert.deepEqual(parseSave(null), s); assert.deepEqual(parseSave('{"v":1,"intro":true}'), s); assert.deepEqual(parseSave('nonsense'), s);
  s.intro = true; s.settings.music = false;
  const r = new Run(19); r.stats.won = 3; r.stats.best = 240; r.stats.longest = 6; r.stats.goals = 4;
  bank(s, r);
  const back = parseSave(serialise(s));
  assert.equal(back.intro, true); assert.equal(back.settings.music, false);
  assert.deepEqual(back.best, { matches: 3, goal: 240, chain: 6 }); assert.equal(back.stats.runs, 1); assert.equal(back.stats.goals, 4);
}

console.log('Combo Ball: the league, the chain and every trait, goals worth (10 + chips) × mult, wipes, pressure, the target, the hint, the shop and the save all check out');
