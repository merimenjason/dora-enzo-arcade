// Fluffball Smash! engine checks: the scoring (15-30-40, the deciding point at deuce, games to N by two or N+1), the
// serve box, faults, double faults and lets, the lines and the wider doubles court, the net and the net cord, the ball
// (the toss, the bounce on each surface, each special's trick off the bounce), the charge, spirit and the special moves
// (cost, the cut-in freeze, Twin Comet for Dora and Enzo together, heavy balls held, countered or blowing you away), whole
// matches from a seed played exactly the same again, and saves including corrupt ones.
import assert from 'node:assert/strict';
import { DT, COURT, CHARS, SPECIALS, SPECIAL_COST, COUNTER_COST, BOT, OPPS, STORY, Match, stepBall, idleInput, newSave, parseSave, serialise, oppUnlocked, recordMatch, SAVE_KEY } from '../.checks/smash-game.js';

let n = 0;
const ok = (m) => { n++; console.log('ok', m); };
const make = (o = {}) => new Match({ home: ['dora'], away: ['bramble'], venue: 'meadow', games: 3, ai: opp('bramble').ai, seed: 7, ...o });
const opp = (id) => OPPS.find((o) => o.id === id);
const ball = (o) => ({ x: 0, y: 0, z: 1, vx: 0, vy: 0, vz: 0, spin: 0, by: 0, slot: 0, bounces: 0, lastBounceSide: -1, serve: false, net: false, special: null, age: 0, flight: 1, curveA: 0, curveN: 2, decoys: [], kick: 0, ...o });
/** drop the ball onto the court at (x, y) as if `by` hit it, and return the events */
const land = (m, x, y, o = {}) => { m.events.length = 0; m.phase = 'rally'; m.ball = ball({ x, y, z: 0, by: 0, ...o }); m.bounce(); return [...m.events]; };
const pointEv = (evs) => evs.find((e) => e.k === 'point');

// ---- scoring
{
  const m = make();
  m.pointTo(0, 'winner'); assert.deepEqual(m.scoreText(), ['15', '0']);
  m.pointTo(0, 'winner'); m.pointTo(1, 'winner'); assert.deepEqual(m.scoreText(), ['30', '15']);
  m.pointTo(1, 'winner'); m.pointTo(0, 'winner'); m.pointTo(1, 'winner');
  assert.deepEqual(m.scoreText(), ['Deuce', 'Deuce']); assert.ok(m.decidingPoint, '40-40 is a deciding point');
  m.pointTo(1, 'winner'); assert.deepEqual(m.games, [0, 1], 'no advantage: the point at deuce takes the game'); assert.deepEqual(m.points, [0, 0]);
  const m2 = make(); for (let i = 0; i < 4; i++) m2.pointTo(0, 'winner'); assert.deepEqual(m2.games, [1, 0], 'four straight points take a game');
  const m3 = make(); for (let i = 0; i < 3; i++) m3.pointTo(0, 'winner'); m3.pointTo(1, 'winner'); assert.deepEqual(m3.scoreText(), ['40', '15']); assert.ok(!m3.decidingPoint);
  // games: first to 3 and two clear, or the game after 3-all
  const g = make(); const game = (w) => { for (let i = 0; i < 4; i++) g.pointTo(w, 'winner'); };
  game(0); game(0); game(1); game(1); game(0); assert.deepEqual(g.games, [3, 2]); assert.equal(g.winner, -1, '3-2 is not two clear');
  game(1); assert.equal(g.winner, -1); game(0); assert.deepEqual(g.games, [4, 3]); assert.equal(g.winner, 0, 'the game after 3-all wins it');
  const g2 = make({ games: 2 }); for (let i = 0; i < 8; i++) g2.pointTo(1, 'winner'); assert.equal(g2.winner, 1, '2-0 wins a first-to-2');
  // the serve changes hands after every game
  const s = make(); const first = s.server; for (let i = 0; i < 4; i++) s.pointTo(0, 'winner'); assert.equal(s.server, 1 - first);
  ok('scoring: 15-30-40, deuce is a deciding point, games to N by two or the game after N-all, the serve changes every game');
}

// ---- the serve box, faults, double faults and lets
{
  const m = make(); m.server = 0; m.points = [0, 0]; // the deuce court: side 0 serves into x < 0 on side 1
  assert.equal(m.court, 1);
  assert.ok(!pointEv(land(m, -2, COURT.service - 1, { serve: true })) && m.phase === 'rally', 'a serve in the box plays on');
  const mm = make(); mm.server = 0; let ev = land(mm, 2, COURT.service - 1, { serve: true });
  assert.ok(ev.some((e) => e.k === 'fault' && !e.double), 'the wrong box is a fault'); assert.ok(mm.secondServe);
  ev = land(mm, -2, COURT.service + 1, { serve: true }); const p = pointEv(ev);
  assert.ok(ev.some((e) => e.k === 'fault' && e.double) && p && p.winner === 1 && p.why === 'double', 'two faults lose the point');
  const ml = make(); ml.server = 0; ev = land(ml, -2, COURT.service - 1, { serve: true, net: true });
  assert.ok(ev.some((e) => e.k === 'let') && !ml.secondServe && !pointEv(ev), 'a serve that clips the net and lands in is a let');
  ok('the serve: into the diagonal box, a fault, a double fault, a let off the net');
}

// ---- in and out, singles and doubles, a second bounce
{
  let m = make(); assert.ok(!pointEv(land(m, COURT.single + 0.03, 9)), 'a ball on the line is in');
  m = make(); let p = pointEv(land(m, COURT.single + 0.3, 9)); assert.ok(p && p.winner === 1 && p.why === 'out', 'wide is out');
  m = make(); p = pointEv(land(m, 0, COURT.half + 0.3)); assert.ok(p && p.why === 'out', 'long is out');
  m = make(); p = pointEv(land(m, 0, -3)); assert.ok(p && p.winner === 1 && p.why === 'net', 'landing on your own side is a net ball');
  const d = make({ home: ['dora', 'enzo'], away: ['sable', 'sorrel'] }); assert.ok(d.doubles && !pointEv(land(d, COURT.single + 0.6, 9)), 'the tramlines are in for doubles');
  m = make(); land(m, 1, 8); m.events.length = 0; m.ball.z = 0; m.bounce(); p = pointEv(m.events); assert.ok(p && p.winner === 0 && p.why === 'winner', 'two bounces is a winner');
  ok('lines are in, wide, long and own-side balls are out, the doubles court is wider, two bounces win the point');
}

// ---- the ball: net, net cord, bounce, the specials' tricks
{
  let b = ball({ y: -2, z: 0.5, vy: 12, vz: 0 }); let net = false;
  for (let i = 0; i < 60 && !net; i++) net = stepBall(b, 'hard', 0, 0).netHit;
  assert.ok(net && b.y < 0 && b.net, 'a low ball stops in the net on the hitter\'s side');
  b = ball({ y: -1, z: COURT.net - 0.02, vy: 12, vz: 0 }); net = false;
  for (let i = 0; i < 30 && !net; i++) net = stepBall(b, 'hard', 0, 0).netHit;
  for (let i = 0; i < 30; i++) stepBall(b, 'hard', 0, 0);
  assert.ok(net && b.y > 0, 'a ball that clips the tape pops over');
  const bounceOn = (surf, o = {}) => { const q = ball({ y: 5, z: 0.01, vy: 15, vz: -8, ...o }); stepBall(q, surf, 0, 0); return q; };
  const grass = bounceOn('grass'), clay = bounceOn('clay');
  assert.ok(clay.vz > grass.vz && clay.vy < grass.vy, 'clay bounces higher and slower than grass');
  const top = bounceOn('hard', { spin: 0.9 }), slice = bounceOn('hard', { spin: -0.7 });
  assert.ok(top.vz > slice.vz && top.vy > slice.vy, 'topspin kicks up, slice stays low');
  assert.ok(bounceOn('hard', { special: 'drop', vy: 9 }).vy < 0, 'Hundred-Step Drop hops back towards the net');
  assert.ok(bounceOn('hard', { special: 'zero' }).vz < bounceOn('hard').vz * 0.4, 'Absolute Zero skids flat');
  assert.ok(bounceOn('hard', { special: 'phoenix' }).vy > bounceOn('hard').vy * 1.1, 'Phoenix Blaze speeds up off the bounce');
  assert.ok(Math.abs(bounceOn('hard', { special: 'meteor', kick: 6.5 }).vx) > 5, 'Moonleap Meteor kicks sideways');
  // the weave: Squall Serve bends in flight but still lands where it was aimed
  const m = make({ away: ['gale'], ai: opp('gale').ai }); m.ball.x = 0; m.ball.y = -11; m.ball.z = 2.4;
  m.launch(m.you, -2, 9, 22, 0.2, 0.3, false); const plain = { ...m.ball };
  m.ball = ball({ ...plain }); m.ball.curveA = 3; m.ball.curveN = 2;
  let maxOff = 0, bx = 0; for (let i = 0; i < 400; i++) { if (stepBall(m.ball, 'hard', 0, 0).bounced) { bx = m.ball.x; break; } maxOff = Math.max(maxOff, Math.abs(m.ball.x - (plain.x + plain.vx * m.ball.age))); }
  assert.ok(maxOff > 1.5 && Math.abs(bx - -2) < 0.5, `the weave bends ${maxOff.toFixed(1)} m and still lands on target (${bx.toFixed(2)})`);
  ok('the ball: the net stops low balls, the tape pops them over, surfaces and spin bounce differently, each special has its trick');
}

// ---- charge, spirit and the special moves
{
  // a readied swing: pressed earlier hits harder
  const hitWith = (early) => { const m = make(); const p = m.you; m.phase = 'rally'; m.ball = ball({ x: p.x, y: p.y, z: 1, by: 1, bounces: 1, lastBounceSide: 0 }); p.ready = { kind: 'top', t: m.t - early, special: false }; p.lastDist = 99; m.events.length = 0; m.tryHit(p, idleInput()); return m.events.find((e) => e.k === 'hit'); };
  const quick = hitWith(0.05), full = hitWith(1);
  assert.ok(quick && full && full.power > quick.power + 0.4, `a charged swing hits harder (${quick.power.toFixed(2)} vs ${full.power.toFixed(2)})`);
  // spirit fills to 100, says so once, and never overflows
  const s = make(); s.meter[0] = 95; s.events.length = 0; s.gain(0, 30); assert.equal(s.meter[0], SPECIAL_COST); assert.equal(s.events.filter((e) => e.k === 'ready').length, 1);
  s.events.length = 0; s.gain(0, 5); assert.equal(s.events.length, 0);
  const lose = make(); lose.pointTo(1, 'winner'); assert.ok(lose.meter[0] > lose.meter[1], 'losing a point gives more spirit than winning it');
  // firing a special: costs a full meter, freezes for the cut-in, Dora alone throws the Meteor, with Enzo the Twin Comet
  const fire = (home) => { const m = make({ home }); const p = m.you; m.phase = 'rally'; m.meter[0] = SPECIAL_COST; m.ball = ball({ x: p.x, y: p.y, z: 1, by: 1, bounces: 1, lastBounceSide: 0 }); p.ready = { kind: 'top', t: m.t - 0.5, special: true }; p.lastDist = 99; m.events.length = 0; m.tryHit(p, idleInput()); return m; };
  const solo = fire(['dora']), duo = fire(['dora', 'enzo']), enzo = fire(['enzo']);
  assert.equal(solo.meter[0], 0); assert.ok(solo.freeze >= 1.2, 'the cut-in freezes play');
  assert.equal(solo.events.find((e) => e.k === 'special').id, 'meteor'); assert.equal(duo.events.find((e) => e.k === 'special').id, 'twin'); assert.equal(enzo.events.find((e) => e.k === 'special').id, 'phantom');
  assert.equal(enzo.ball.decoys.length, 2, 'Phantom Page throws two fake balls');
  const frozen = solo.t; solo.tick(idleInput()); assert.equal(solo.t, frozen, 'nothing moves during the cut-in');
  // with less than a full meter, a special press is just a swing
  const m = make(); const p = m.you; m.phase = 'rally'; m.meter[0] = 60; m.ball = ball({ x: p.x, y: p.y, z: 1, by: 1, bounces: 1, lastBounceSide: 0 }); p.ready = { kind: 'top', t: m.t - 0.5, special: true }; p.lastDist = 99; m.events.length = 0; m.tryHit(p, idleInput());
  assert.ok(!m.events.some((e) => e.k === 'special') && m.events.some((e) => e.k === 'hit'));
  // heavy specials: meet one with a weak swing and you are blown away; charge it and you hold it; counter it with half a meter
  const meet = (early, counter, meter = 0) => { const q = make(); const pl = q.you; q.phase = 'rally'; q.meter[0] = meter; q.ball = ball({ x: pl.x, y: pl.y, z: 1, by: 1, bounces: 1, lastBounceSide: 0, special: 'phoenix' }); pl.ready = early === null ? null : { kind: 'top', t: q.t - early, special: false }; pl.counter = counter; pl.lastDist = 99; q.events.length = 0; q.tryHit(pl, idleInput()); return q; };
  const weak = meet(0.1, false); assert.ok(weak.events.some((e) => e.k === 'blown') && weak.you.stun > 1, 'a weak swing at a heavy special is blown away');
  const held = meet(0.8, false); assert.ok(held.events.some((e) => e.k === 'held') && held.events.some((e) => e.k === 'hit'), 'a charged swing holds it');
  const ctr = meet(null, true, COUNTER_COST); assert.ok(ctr.events.some((e) => e.k === 'counter') && ctr.meter[0] < COUNTER_COST, 'a counter spends half a meter');
  assert.ok(Object.values(SPECIALS).filter((x) => x.heavy).length >= 4 && !SPECIALS.drop.heavy, 'some specials are heavy, the trick shots are not');
  for (const c of Object.values(CHARS)) assert.ok(SPECIALS[c.special], `${c.name} has a special`);
  ok('charge hits harder, spirit fills and caps, specials cost a meter and freeze for the cut-in, heavy balls blow you away unless held or countered');
}

// ---- whole matches: they finish, from a seed they replay exactly, every point has a reason
{
  const play = (seed, o = {}) => {
    const m = make({ seed, autopilot: BOT, ...o }); const log = []; let ticks = 0;
    while (!m.over && ticks < 120 * 1800) { m.tick(idleInput()); ticks++; for (const e of m.events) if (e.k === 'point' || e.k === 'hit' || e.k === 'special') log.push(`${ticks}:${e.k}:${e.winner ?? e.side}:${e.why ?? e.kind ?? e.id}`); }
    return { m, log, ticks };
  };
  const a = play(11), b = play(11), c = play(12);
  assert.ok(a.m.over && a.m.winner >= 0, 'a match finishes'); assert.deepEqual(a.log, b.log, 'the same seed plays the same match'); assert.notDeepEqual(a.log, c.log);
  const whys = new Set(a.log.filter((l) => l.includes(':point:')).map((l) => l.split(':')[3])); for (const w of whys) assert.ok(['ace', 'winner', 'out', 'net', 'double', 'blown'].includes(w));
  const d = play(5, { home: ['dora', 'enzo'], away: ['marlow', 'fern'], ai: opp('tortoises').ai, venue: 'temple' });
  assert.ok(d.m.over && d.m.players.length === 4, 'a doubles match finishes');
  const g = Math.max(...a.m.games); assert.ok(g >= 3, 'the winner has at least three games');
  ok(`matches finish (${(a.ticks * DT / 60).toFixed(1)} min singles, ${(d.ticks * DT / 60).toFixed(1)} min doubles) and a seed replays exactly`);
}

// ---- the story and saves
{
  assert.equal(STORY.length, 7); assert.equal(new Set(STORY.map((s) => s.opp)).size, 7, 'every story match is a different rival');
  assert.equal(OPPS.length, 7); for (const o of OPPS) assert.ok(o.chars.length >= 1 && o.chars.length <= 2 && o.games >= 2);
  assert.ok(STORY.filter((s) => OPPS.find((o) => o.id === s.opp).chars.length === 2).length >= 3, 'singles and doubles both feature');
  const s = newSave(); assert.equal(s.story, 0); assert.ok(oppUnlocked(s, 'bramble') && !oppUnlocked(s, 'twins'));
  const m = make({ autopilot: BOT, seed: 3 }); m.winner = 0; recordMatch(s, m, 0);
  assert.equal(s.story, 1); assert.deepEqual(s.beaten, ['bramble']); assert.ok(!oppUnlocked(s, 'twins'), 'Exhibition only has rivals you have beaten');
  const lost = newSave(); const ml = make(); ml.winner = 1; recordMatch(lost, ml, 0); assert.equal(lost.story, 0); assert.equal(lost.stats.losses, 1);
  const again = parseSave(serialise(s)); assert.deepEqual(again, s, 'a save round-trips');
  for (const bad of [null, '', '{', '[]', '7', '{"v":2,"story":5}', '{"v":1,"story":"x","beaten":"all","settings":5,"stats":null}']) assert.deepEqual(parseSave(bad), newSave(), `corrupt save ${bad}`);
  const odd = parseSave(JSON.stringify({ v: 1, story: 99, beaten: ['bramble', 'dragon'], settings: { footwork: 'fly', difficulty: 9, sound: false }, stats: { wins: -4, longest: 12.7 } }));
  assert.equal(odd.story, STORY.length); assert.deepEqual(odd.beaten, ['bramble']); assert.equal(odd.settings.footwork, 'assist'); assert.equal(odd.settings.difficulty, 2); assert.equal(odd.settings.sound, false);
  assert.equal(odd.stats.wins, 0); assert.equal(odd.stats.longest, 12);
  assert.equal(SAVE_KEY, 'fluffball-smash-v1');
  ok('the story is seven different rivals, a win moves the story on and opens that rival in Exhibition, saves round-trip and corrupt ones fall back');
}
console.log(`smash: ${n} checks passed`);
