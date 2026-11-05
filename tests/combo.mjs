// Combo Ball engine checks: kick-off and determinism, passes and what each one adds to the chain, first-time passes
// pressed early, the chain being wiped, what a goal is worth (with and without traits), conceding, the clock, the
// transfer shop and the save. Run after `npm test` has compiled the engine into .checks/ (or `npm run test:combo`).
import assert from 'node:assert/strict';
import { Run, PITCH, CX, CY, GOAL, MATCH_SECS, TARGETS, SLOTS, TRAITS, DT, passSpeed, rollDist, parseSave, newSave, serialise, bank } from '../.checks/combo-game.js';

const idle = { ax: 0, ay: 0, pass: false, shoot: false };
const ticks = (r, n, inp = idle) => { const evs = []; for (let k = 0; k < n; k++) { r.tick(inp); evs.push(...r.events); } return evs; };
/** a match with the Grumbles parked out of the way (and the keepers too, unless asked), Dora on the ball at (x, y) */
function arena(x = CX, y = CY, keepers = false) {
  const r = new Run(7);
  ticks(r, 60);
  for (const p of r.players) if (p.team === 1 && (!p.keeper || !keepers)) Object.assign(p, { x: 40 + p.i * 6, y: PITCH.y1 - 6, stun: 1e9 });
  if (!keepers) Object.assign(r.players[3], { y: PITCH.y1 - 20, stun: 1e9 });
  const d = r.players[0];
  Object.assign(d, { x, y, vx: 0, vy: 0, hold: 0 });
  Object.assign(r.ball, { owner: 0, x: x + 5, y });
  r.poss = 0; r.ctl = 0; r.pass = null; r.chain = { chips: 0, mult: 1, passes: 0, lastFrom: -1, lastTo: -1, lofted: false, touches: [], nutmegged: [] };
  return r;
}
/** taps pass (or holds it for a lofted ball) pointing at (ax, ay), then waits for the ball to arrive */
function pass(r, ax, ay, holdTicks = 1, wait = 90) {
  ticks(r, holdTicks, { ...idle, ax, ay, pass: true });
  return ticks(r, wait);
}

{
  // kick-off, and the same seed playing the same way
  const a = new Run(42), b = new Run(42);
  assert.equal(a.phase, 'play'); assert.equal(a.ball.owner, 0); assert.equal(a.target, TARGETS[0]); assert.equal(a.clock, MATCH_SECS);
  const inp = (k) => ({ ax: Math.sin(k / 30), ay: Math.cos(k / 50), pass: k % 45 < 3, shoot: k % 200 > 190 });
  for (let k = 0; k < 1800; k++) { a.tick(inp(k)); b.tick(inp(k)); }
  assert.deepEqual([a.ball.x, a.ball.y, a.points, a.chain.passes, a.clock], [b.ball.x, b.ball.y, b.points, b.chain.passes, b.clock]);
  assert.ok(a.clock < MATCH_SECS - 10, 'the clock runs');
  // ground passes are struck hard enough to reach and keep a bit of pace
  for (const d of [30, 80, 160]) { const v = passSpeed(d); assert.ok(v >= 160 && rollDist(v) >= d, `a pass of ${d} reaches`); }
  console.log('PASS kick-off, the clock and determinism');
}

{
  // a one-touch pass to Enzo: 10 chips and +1 mult; Enzo is now the player
  const r = arena(150, CY);
  Object.assign(r.players[1], { x: 210, y: CY, vx: 0, vy: 0 });
  Object.assign(r.players[2], { x: 120, y: CY + 60 });
  const evs = pass(r, 1, 0);
  assert.equal(r.ball.owner, 1, 'Enzo has it');
  assert.equal(r.ctl, 1);
  const g = evs.find((e) => e.k === 'gain');
  assert.ok(g, 'a gain'); assert.equal(r.chain.passes, 1); assert.equal(r.chain.chips, 10); assert.equal(r.chain.mult, 2);
  assert.ok(g.gains.some((x) => x.text === 'One-touch'));
  // straight back to Dora: no chips, no mult
  r.players[1].hold = 1;
  Object.assign(r.players[0], { x: r.players[1].x - 60, y: r.players[1].y, vx: 0, vy: 0 });
  Object.assign(r.players[2], { x: r.players[1].x - 20, y: CY + 70, vx: 0, vy: 0 });
  pass(r, -1, 0);
  assert.equal(r.ball.owner, 0); assert.equal(r.chain.passes, 2); assert.equal(r.chain.chips, 10); assert.equal(r.chain.mult, 2);
  // a long switch to Pip, held on the ball first (so not one-touch): 10 + 10 long + 10 switch
  Object.assign(r.players[0], { x: 150, y: CY - 40, vx: 0, vy: 0 }); Object.assign(r.ball, { x: 155, y: CY - 40 }); r.players[0].hold = 1;
  Object.assign(r.players[1], { x: 120, y: CY - 70, vx: 0, vy: 0 });
  Object.assign(r.players[2], { x: 260, y: CY + 45, vx: 0, vy: 0 });
  pass(r, 0.9, 0.6, 1, 120);
  assert.equal(r.ball.owner, 2, 'Pip has it');
  assert.equal(r.chain.chips, 40); assert.equal(r.chain.mult, 2);
  console.log('PASS passes add chips and mult (one-touch, long, switch; nothing straight back)');
}

{
  // a lofted pass sails over a Grumble standing in the lane, and adds 5 chips
  const r = arena(95, CY);
  Object.assign(r.players[1], { x: 225, y: CY });
  Object.assign(r.players[4], { x: 165, y: CY, stun: 0 });
  r.players[0].hold = 1;
  const evs = pass(r, 1, 0, 16, 120);
  assert.ok(!evs.some((e) => e.k === 'wipe'), 'not cut out');
  assert.equal(r.ball.owner, 1);
  assert.ok(r.chain.chips >= 15, 'lofted adds chips');
  // the same pass along the ground, firm and slow enough for him: usually cut out
  let cut = 0;
  for (let s = 1; s <= 10; s++) {
    const q = arena(120, CY); q.rs = s * 99;
    Object.assign(q.players[1], { x: 210, y: CY }); Object.assign(q.players[4], { x: 165, y: CY, stun: 0 });
    q.chain.passes = 2; q.chain.chips = 30;
    const e2 = pass(q, 1, 0, 1, 90);
    if (e2.some((e) => e.k === 'wipe')) cut++;
  }
  assert.ok(cut >= 3, `a Grumble in the lane often gets a touch (${cut}/10)`);
  console.log(`PASS lofted passes clear a Grumble in the lane; along the ground ${cut}/10 are cut out and wipe the chain`);
}

{
  // first time: pressing pass while the ball's on its way plays it on the moment it arrives
  const r = arena(150, CY);
  Object.assign(r.players[1], { x: 220, y: CY });
  Object.assign(r.players[2], { x: 260, y: CY + 50 });
  ticks(r, 1, { ...idle, ax: 1, ay: 0, pass: true });
  ticks(r, 8);
  ticks(r, 1, { ...idle, ax: 1, ay: 0.6, pass: true });
  const evs = ticks(r, 120);
  assert.equal(r.chain.passes, 2, 'two passes');
  assert.equal(r.chain.mult, 3, 'both one-touch');
  assert.equal(r.ball.owner, 2);
  assert.equal(evs.filter((e) => e.k === 'kick').length, 1, 'Enzo played it on first time');
  console.log('PASS pass pressed early goes first time when the ball arrives');
}

{
  // what a goal is worth: (10 + chips) × mult, plus a first-time finish, and the traits
  const shoot = (traits = [], set = {}) => {
    const r = arena(320, CY - 4);
    r.traits = traits; Object.assign(r, set);
    r.chain.chips = 50; r.chain.mult = 3; r.chain.passes = 4; r.players[0].hold = 1;
    if (set.oneTouch) r.players[0].hold = 0.1;
    if (set.lofted) r.chain.lofted = true;
    const evs = ticks(r, 1, { ...idle, shoot: true }).concat(ticks(r, 60));
    return { r, goal: evs.find((e) => e.k === 'goal') };
  };
  let { r, goal } = shoot();
  assert.ok(goal, 'scores into an empty net');
  assert.equal(goal.pts, 180); assert.equal(r.points, 180); assert.equal(r.goals, 1);
  ({ goal } = shoot([], { oneTouch: true })); assert.equal(goal.pts, 240, 'first-time finish +1 mult');
  ({ goal } = shoot(['volley'], { oneTouch: true, lofted: true })); assert.equal(goal.pts, 480, 'volley doubles');
  ({ goal } = shoot(['lateshow'], { clock: 15 })); assert.equal(goal.pts, 360, 'late show doubles');
  ({ goal } = shoot(['hotstreak'], { goals: 2 })); assert.equal(goal.pts, 300, 'hot streak +2 mult');
  // from outside the box with Long Range: +3 mult
  const q = arena(250, CY); q.traits = ['longrange']; q.chain.chips = 50; q.chain.mult = 3; q.chain.passes = 4; q.players[0].hold = 1;
  const e3 = ticks(q, 1, { ...idle, shoot: true }).concat(ticks(q, 80)).find((e) => e.k === 'goal');
  assert.ok(e3, 'the long shot goes in'); assert.equal(e3.pts, 360);
  // a lone hoof with no chain is worth 10, and the Grumbles kick off next
  const h = arena(320, CY); h.players[0].hold = 0.1;
  const e4 = ticks(h, 1, { ...idle, shoot: true }).concat(ticks(h, 60)).find((e) => e.k === 'goal');
  assert.equal(e4.pts, 10);
  ticks(h, 120);
  assert.equal(h.ball.owner, 4, 'the Grumbles kick off');
  console.log('PASS goals score (10 + chips) × mult, and the traits that change it');
}

{
  // Metronome doubles chips on the 5th pass; Tiki-Taka: one-touch +2, other passes no chips
  const r = arena(150, CY); r.traits = ['metronome'];
  r.chain.passes = 4; r.chain.chips = 40;
  Object.assign(r.players[1], { x: 210, y: CY }); r.players[0].hold = 1;
  pass(r, 1, 0);
  assert.equal(r.chain.passes, 5); assert.equal(r.chain.chips, 100, '(40 + 10) × 2');
  const t = arena(150, CY); t.traits = ['tiki'];
  Object.assign(t.players[1], { x: 210, y: CY }); t.players[0].hold = 1;
  pass(t, 1, 0);
  assert.equal(t.chain.chips, 0); assert.equal(t.chain.mult, 1, 'held on the ball: nothing');
  t.players[1].hold = 0; Object.assign(t.players[2], { x: 270, y: CY + 20 });
  pass(t, 1, 0.3);
  assert.equal(t.chain.chips, 10); assert.equal(t.chain.mult, 3, 'one-touch: 10 chips and +2');
  console.log('PASS Metronome and Tiki-Taka');
}

{
  // a Grumble's tackle: he winds up, lunges and takes the ball, wiping the chain
  const r = arena(150, CY);
  r.chain.passes = 3; r.chain.chips = 30; r.chain.mult = 2;
  Object.assign(r.players[4], { x: 168, y: CY, stun: 0, cd: 0 });
  const evs = ticks(r, 60);
  assert.ok(evs.some((e) => e.k === 'wind'), 'winds up');
  assert.ok(evs.some((e) => e.k === 'steal'), 'steals');
  assert.ok(evs.some((e) => e.k === 'wipe' && e.chips === 30), 'the chain is wiped');
  assert.equal(r.chain.passes, 0); assert.equal(r.poss, 1);
  // and our slide takes it back
  const t = arena(150, CY), g = t.players[4], p = t.players[0];
  Object.assign(g, { x: 200, y: CY, stun: 0.5, cd: 1 }); Object.assign(t.ball, { owner: 4, x: 196, y: CY }); t.poss = 1;
  Object.assign(p, { x: g.x - 12, y: g.y, stun: 0, slide: 0 });
  const e2 = ticks(t, 1, { ...idle, ax: 1, ay: 0, shoot: true }).concat(ticks(t, 20));
  assert.ok(e2.some((e) => e.k === 'tackle'), 'the slide wins it');
  console.log('PASS Grumble tackles wipe the chain; a slide wins the ball back');
}

{
  // conceding pushes the target up; full time below the target loses; reaching it opens the shop
  const r = new Run(3);
  r.goal(1);
  assert.equal(r.target, TARGETS[0] + Math.round(TARGETS[0] * 0.15));
  ticks(r, 200);
  assert.equal(r.ball.owner, 0, 'we kick off after conceding');
  r.clock = 0.01; ticks(r, 2);
  assert.equal(r.phase, 'lost');
  const w = new Run(3);
  w.points = w.target; w.goal(0);
  ticks(w, 200);
  assert.equal(w.phase, 'shop'); assert.equal(w.offer.length, 3);
  assert.ok(!w.pick('nope'));
  assert.ok(w.pick(w.offer[0]));
  assert.equal(w.match, 1); assert.equal(w.traits.length, 1); assert.equal(w.target, TARGETS[1]); assert.equal(w.phase, 'play');
  // five slots: a sixth needs one dropped
  w.traits = TRAITS.slice(0, SLOTS).map((t) => t.id);
  w.phase = 'shop'; w.makeOffer();
  assert.ok(!w.pick(w.offer[0]), 'full');
  assert.ok(w.pick(w.offer[0], w.traits[0]));
  assert.equal(w.traits.length, SLOTS);
  // the last match won is the title
  const f = new Run(5); f.match = 8; f.startMatch(); f.points = f.target; f.goal(0); ticks(f, 200);
  assert.equal(f.phase, 'won');
  console.log('PASS conceding, full time, the transfer shop and the title');
}

{
  // the save
  const s = newSave();
  assert.deepEqual(parseSave(serialise(s)), s);
  assert.deepEqual(parseSave('nonsense'), newSave());
  assert.deepEqual(parseSave(JSON.stringify({ v: 1, best: { goal: -5, matches: 'x' } })).best, { matches: 0, goal: 0, chain: 0 });
  const r = new Run(1); r.stats.won = 3; r.stats.best = 420; r.stats.longest = 9; r.stats.goals = 7; r.phase = 'lost';
  bank(s, r);
  assert.deepEqual(s.best, { matches: 3, goal: 420, chain: 9 }); assert.equal(s.stats.runs, 1); assert.equal(s.stats.wins, 0);
  console.log('PASS the save');
}
void DT; void GOAL;
