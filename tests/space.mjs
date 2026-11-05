// Into Space engine checks: a pass goes to a spot and control jumps to the runner, the arrival rated perfect, early or
// late by when the runner reaches the spot against when the ball lands, a perfect one slowing time and giving a
// first-time window (faster passes, sharper shots), an early one costing a settling touch, lofted passes over
// everyone's heads until they drop, the four pitches (the beach stops the ball dead, a heatwave bounces it), passes
// capped in length, golden goal and who goes through when it stays level, the changing room's three picks and the
// next round rolled in advance (never the same pitch twice running, the final on summer grass), the perks, a seed
// replaying exactly, and the save.
import assert from 'node:assert/strict';
import { Run, noInput, PITCH, CX, CY, ARRIVE, SLOW_FOR, SETTLE, MAX_PASS, MATCH, GOLDEN, ROUNDS, PITCHES, PERKS, newSave, parseSave, serialise, bank } from '../.checks/space-game.js';

let n = 0;
const ok = (m) => { n++; console.log('ok', m); };
const DORA = 1, ENZO = 2, PIP = 3, BRAM = 4;
/** a match in play with only Dora and the runner able to move: everyone else frozen out of the way */
const field = (seed = 3, runner = ENZO, rx = CX + 20, ry = CY + 40) => {
  const r = new Run(seed);
  r.state = 'play'; r.stateT = 0;
  for (const p of r.players) if (p.i !== DORA && p.i !== runner) Object.assign(p, { x: p.side ? PITCH.x1 - 6 : PITCH.x0 + 6, y: PITCH.y0 + 4 + p.i * 2, stun: 1e9 });
  Object.assign(r.players[DORA], { x: CX - 40, y: CY, vx: 0, vy: 0, dx: 1, dy: 0 });
  Object.assign(r.players[runner], { x: rx, y: ry, vx: 0, vy: 0 });
  Object.assign(r.ball, { owner: DORA, z: 0, vx: 0, vy: 0, vz: 0 });
  r.ctrl = DORA; r.tick(noInput());
  return r;
};
const press = (r, inp) => { r.tick({ ...noInput(), ...inp }); return r.events; };
/** passes to the spot, then the runner runs at it, starting `wait` seconds after the kick at speed fraction `pace` */
const runOnto = (r, spot, { loft = false, wait = 'timed', pace = 1, maxT = 4 } = {}) => {
  press(r, { passNow: true, spot, loft });
  const evs = [];
  for (let t = 0; t < maxT * 60 && r.ball.owner < 0; t++) {
    const me = r.players[r.ctrl], ps = r.pass, d = Math.hypot(spot.x - me.x, spot.y - me.y);
    let want = 0;
    if (ps && r.flight) {
      const left = ps.land - r.gt;
      if (wait === 'timed') want = d < ARRIVE - 2 ? 0.3 : Math.min(1, (d - ARRIVE + 2) / Math.max(0.03, left) / r.speedOf(me));
      else want = r.gt - (ps.land - r.flight.T) >= wait ? pace : 0;
    } else want = d > 2 ? pace : 0;
    r.tick({ ...noInput(), mx: ((spot.x - me.x) / (d || 1)) * want, my: ((spot.y - me.y) / (d || 1)) * want });
    evs.push(...r.events);
  }
  return evs;
};

// ---- a pass goes to a spot, and we take over the runner
{
  const r = field();
  const evs = press(r, { passNow: true, spot: { x: CX + 30, y: CY + 30 } });
  assert.ok(evs.some((e) => e.k === 'kick'), 'the pass is kicked');
  assert.equal(r.ball.owner, -1); assert.ok(r.flight && r.pass);
  assert.equal(r.pass.receiver, ENZO, 'the runner is the teammate who can get there'); assert.equal(r.ctrl, ENZO, 'control jumps to him');
  assert.ok(evs.some((e) => e.k === 'switch' && e.who === 'enzo'));
  assert.ok(Math.abs(r.pass.x - (CX + 30)) < 0.01 && Math.abs(r.pass.y - (CY + 30)) < 0.01, 'the ball goes to the spot, not to his feet');
  const f = r.plan(0, CY, 400, CY, false, false);
  assert.ok(f.d <= MAX_PASS + 0.01, 'a pass is never longer than MAX_PASS');
  const fast = r.plan(CX, CY, CX + 100, CY, false, true), slow = r.plan(CX, CY, CX + 100, CY, false, false);
  assert.ok(fast.T < slow.T, 'a first-time pass travels faster');
  const lob = r.plan(CX, CY, CX + 100, CY, true, false);
  assert.ok(lob.h > 20 && lob.loft, 'a lofted pass goes up');
  ok('passing: the ball goes to the spot, control jumps to the runner, passes are capped, first-time ones are quicker');
}

// ---- arriving: perfect, early, late
{
  const r = field();
  const evs = runOnto(r, { x: CX + 34, y: CY + 30 });
  const rate = evs.find((e) => e.k === 'rate');
  assert.equal(rate?.r, 'perfect', 'a run timed to arrive as the ball lands is perfect');
  assert.equal(r.ball.owner, ENZO); assert.equal(r.streak, 1);
  assert.ok(r.slow > 0 && r.slow <= SLOW_FOR, 'time slows down'); assert.ok(r.first && r.first.i === ENZO, 'and he can play it first time');
  // first time, a shot flies faster than one hit cold
  Object.assign(r.players[ENZO], { x: PITCH.x1 - 70, y: CY }); r.ball.x = PITCH.x1 - 65; r.ball.y = CY;
  press(r, { shoot: true }); const ftSpeed = Math.hypot(r.ball.vx, r.ball.vy);
  const q = field(); Object.assign(q.players[DORA], { x: PITCH.x1 - 70, y: CY }); q.ball.x = PITCH.x1 - 65;
  press(q, { shoot: true }); for (let i = 0; i < 20; i++) press(q, { shoot: true }); press(q, {});
  assert.ok(ftSpeed > Math.hypot(q.ball.vx, q.ball.vy), 'a first-time shot is harder than a charged one');
  ok('perfect arrival: slow motion, a first-time window, and a first-time shot that flies harder');
}
{
  const r = field(3, ENZO, CX + 48, CY + 30);
  const evs = runOnto(r, { x: CX + 60, y: CY + 30 }, { wait: 0, pace: 1 });
  assert.equal(evs.find((e) => e.k === 'rate')?.r, 'early', 'sprinting straight there is early');
  assert.equal(r.streak, 0); assert.equal(r.slow, 0);
  assert.ok(r.players[ENZO].settle > SETTLE - 0.05, 'he has to settle it');
  press(r, { passNow: true, spot: { x: CX + 90, y: CY } });
  assert.equal(r.ball.owner, ENZO, 'and can’t pass while he does');
  ok('early arrival: a settling touch with no pass or shot, and no slow motion');
}
{
  const r = field(3, ENZO, CX - 20, CY + 30);
  const evs = runOnto(r, { x: CX + 30, y: CY + 30 }, { wait: 0.5, pace: 1, maxT: 6 });
  const rate = evs.find((e) => e.k === 'rate');
  assert.equal(rate?.r, 'late', 'setting off too late is late');
  assert.equal(r.streak, 0);
  ok('late arrival: the ball runs on and the streak resets');
}
{
  // three perfect in a row build the streak, and the stats keep the best
  const r = field();
  for (let k = 0; k < 3; k++) {
    const me = r.players[r.ctrl], other = r.ctrl === ENZO ? DORA : ENZO;
    Object.assign(r.players[other], { x: me.x + 40, y: k % 2 ? CY - 20 : CY + 30, vx: 0, vy: 0, stun: 0 });
    r.slow = 0; r.first = null;
    for (let i = 0; i < 40; i++) press(r, {});
    const evs = runOnto(r, { x: r.players[other].x + 20, y: r.players[other].y });
    assert.equal(evs.find((e) => e.k === 'rate')?.r, 'perfect', `perfect ${k + 1}`);
  }
  assert.equal(r.streak, 3); assert.equal(r.stats.best, 3); assert.equal(r.stats.perfects, 3);
  ok('flow: perfect arrivals in a row build a streak');
}

// ---- lofted passes, and the pitches
{
  const r = field(); Object.assign(r.players[6], { x: CX - 10, y: CY, stun: 0 });
  r.players[6].stun = 0;
  // a Grumble right under a lofted pass early in its flight can't reach it
  press(r, { passNow: true, spot: { x: CX + 40, y: CY }, loft: true });
  for (let i = 0; i < 6; i++) { press(r, {}); assert.equal(r.ball.owner, -1, 'over his head'); }
  ok('lofted passes are over everyone’s heads until they come down');
}
{
  const roll = (pitch, loft) => {
    const r = field(); r.pitch = pitch;
    for (const p of r.players) p.stun = 1e9;
    press(r, { passNow: true, spot: { x: CX + 20, y: CY }, loft });
    for (let i = 0; i < 400; i++) press(r, {});
    return { x: r.ball.x - (CX + 20), z: r.ball.z };
  };
  assert.ok(roll('sand', true).x < 3, 'on the beach a lofted ball stops where it lands');
  assert.ok(roll('dry', true).x > 10, 'on grass it runs on');
  assert.ok(roll('wet', false).x > roll('dry', false).x, 'in the rain a ground pass skids further');
  assert.ok(PITCHES.hard.bounce > PITCHES.dry.bounce && PITCHES.sand.run < 1, 'a heatwave bounces, the beach slows everyone');
  ok('pitches: the beach stops the ball dead, rain skids it on, a heatwave bounces it');
}

// ---- matches: golden goal, going through, the changing room
{
  const r = field(); r.score = [1, 1]; r.clock = 0.01;
  const evs = press(r, {});
  assert.ok(r.golden && Math.abs(r.clock - GOLDEN) < 0.1 && evs.some((e) => e.k === 'whistle' && e.what === 'golden'), 'level at full time is golden goal');
  r.match.perfects = 2; r.match.intercepts = 3; assert.equal(r.through, false, 'level after golden goal: more interceptions than perfects goes out');
  r.match.perfects = 4; assert.equal(r.through, true, 'more perfects goes through');
  ok('golden goal, and the tie-break of perfect arrivals against interceptions');
}
{
  const r = new Run(9); const pitches = [r.pitch];
  assert.equal(r.round, 0); assert.equal(r.pitch, 'dry'); assert.equal(r.clock, MATCH);
  for (let k = 0; k < ROUNDS; k++) {
    r.state = 'play'; r.score = [2, 0]; r.clock = 0.01;
    for (let i = 0; i < 200 && r.phase === 'match' && r.round === k; i++) press(r, {});
    if (k === ROUNDS - 1) { assert.equal(r.phase, 'won', 'winning the final wins the cup'); break; }
    assert.equal(r.phase, 'pick'); assert.equal(r.offer.length, 3); assert.ok(r.upcoming, 'the next round is known in the changing room');
    const up = r.upcoming; const id = r.offer[0];
    assert.ok(!r.pick('nonsense')); assert.ok(r.pick(id)); assert.ok(r.perks[id]);
    assert.equal(r.round, k + 1); assert.equal(r.pitch, up.pitch); assert.equal(r.shape, up.shape);
    assert.notEqual(r.pitch, pitches[pitches.length - 1], 'never the same pitch twice running'); pitches.push(r.pitch);
    assert.ok(!r.offer.length && new Set(Object.keys(r.perks)).size === k + 1);
  }
  assert.equal(pitches[ROUNDS - 1], 'dry', 'the final is on summer grass');
  assert.equal(r.stats.rounds, ROUNDS);
  const l = new Run(4); l.state = 'play'; l.score = [0, 1]; l.clock = 0.01;
  for (let i = 0; i < 200 && l.phase === 'match'; i++) press(l, {});
  assert.equal(l.phase, 'lost', 'losing a match ends the run');
  ok('the cup: seven rounds, three picks after each win, the next round shown in advance, one defeat and you’re out');
}

// ---- perks
{
  assert.equal(PERKS.length, 12); assert.equal(new Set(PERKS.map((p) => p.id)).size, 12);
  const sw = field(); sw.perks.switch = true; const a = sw.plan(CX - 90, CY, CX + 90, CY, false, false), b = field().plan(CX - 90, CY, CX + 90, CY, false, false);
  assert.ok(a.T < b.T, 'switch boots fly long passes faster');
  const sp = field(); sp.perks.sprinter = true; assert.ok(sp.staminaMax > field().staminaMax, 'sprinter doubles stamina');
  // the same slightly early run is early with a plain window and perfect with a wide one
  const rush = (wide) => {
    const r = field(3, ENZO, CX + 60 - ARRIVE - 22, CY + 30); r.perks.wide = wide;
    press(r, { passNow: true, spot: { x: CX + 60, y: CY + 30 } });
    for (let i = 0; i < 300 && r.ball.owner < 0; i++) { const e = press(r, { mx: 1 }).find((x) => x.k === 'rate'); if (e) return e.r; }
  };
  assert.equal(rush(false), 'early'); assert.equal(rush(true), 'perfect', 'a wider window forgives a slightly early run');
  const bs = field(); bs.perks.backspin = true; for (const p of bs.players) p.stun = 1e9;
  press(bs, { passNow: true, spot: { x: CX + 20, y: CY }, loft: true }); for (let i = 0; i < 300; i++) press(bs, {});
  assert.ok(Math.abs(bs.ball.x - (CX + 20)) < 2, 'backspin stops a lofted pass where it lands');
  ok('perks: switch boots, sprinter, a wider window, backspin');
}

// ---- determinism and the save
{
  const play = (seed) => { const r = new Run(seed); for (let i = 0; i < 60 * 40; i++) r.tick({ ...noInput(), mx: Math.sin(i / 50), my: Math.cos(i / 70), pass: i % 90 < 20, shoot: i % 300 > 280 }); return JSON.stringify([r.score, r.ball.x, r.ball.y, r.players.map((p) => [p.x, p.y])]); };
  assert.equal(play(77), play(77), 'a seed replays exactly'); assert.notEqual(play(77), play(78));
  ok('a seed replays a match exactly');
}
{
  assert.deepEqual(parseSave(null), newSave()); assert.deepEqual(parseSave('{broken'), newSave()); assert.deepEqual(parseSave('{"v":2}'), newSave());
  const s = newSave(); const r = new Run(5); r.stats.rounds = 3; r.stats.goals = 7; r.stats.perfects = 11; r.stats.best = 5; r.phase = 'lost';
  bank(s, r); const t = parseSave(serialise(s));
  assert.deepEqual([t.stats.runs, t.stats.cups, t.stats.goals, t.stats.perfects, t.best.round, t.best.flow], [1, 0, 7, 11, 3, 5]);
  r.phase = 'won'; r.stats.rounds = 7; bank(t, r); assert.equal(t.stats.cups, 1); assert.equal(t.best.round, 7);
  assert.equal(parseSave('{"v":1,"best":{"round":-4},"settings":{"music":false}}').best.round, 0); assert.equal(parseSave('{"v":1,"settings":{"music":false}}').settings.music, false);
  ok('the save: bad saves start fresh, runs bank their bests and cups');
}
console.log(`PASS Into Space engine (${n} checks)`);
