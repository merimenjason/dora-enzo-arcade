// Wind-Up Rally's engine: the shuttle's flight (quadratic drag, terminal velocity, the cork-first flip), the net and
// let-cords, the lines and service faults, shot selection by timing and height, the shot solver, the wind-up spring
// (running, hopping and smashing drain it, winding fills it, a run-down toy is sluggish), rally-point scoring with the
// serve going to the rally winner, games and matches (best of three for the champion), the toys' determinism per
// seed, medals and unlocks, and saves (corrupt ones included).
// Needs the engine compiled to .checks/ (npm run test:rally does that).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as G from '../.checks/rally-game.js';

let n = 0;
const ok = (name) => { n++; console.log('PASS', name); };
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b} (±${tol})`);
const fresh = (over = {}) => G.newMatch({ mode: 'ladder', seed: 7, who: 'dora', foe: 'robot', ...over });
/** Puts a shuttle in flight as if `side` had just hit it. */
const launchFrom = (m, side, x, y, vx, vy, shot = 'drive') => {
  m.phase = 'rally'; m.phaseT = 0;
  Object.assign(m.shuttle, { x, y, vx, vy, held: -1, last: side, netted: false, cord: false, down: false, shot, hits: 3, age: 0 });
};
const runUntil = (m, pred, max = 120 * 20, inputs = []) => { for (let k = 0; k < max && !pred(m); k++) G.step(m, inputs); return m; };
const freeze = (m) => { for (const p of m.players) { p.human = true; } }; // nobody moves unless told

// ---- the rules stay deterministic and clock-free
{
  const src = readFileSync(new URL('../lib/rally-game.ts', import.meta.url), 'utf8').replace(/\/\/.*$/gm, '');
  assert.ok(!/Math\.random|Date\.now|performance\.now|new Date/.test(src), 'no Math.random or wall clock in the engine');
  assert.equal(G.SAVE_KEY, 'windup-rally-v1');
  assert.equal(G.TOYS.length, 7);
  assert.equal(G.TOYS.at(-1).id, 'bear', 'the music-box bear is the champion');
  assert.equal(G.toyById('bear').best, 2, 'the final is best of three games');
  assert.ok(G.TOYS.slice(0, -1).every((t) => t.best === 1), 'every other match is one game');
  assert.equal(new Set(G.TOYS.map((t) => t.name)).size, 7);
  ok('the engine has no Math.random or clock; seven toys, the bear last and best of three');
}

// ---- shuttle physics
{
  const b = { x: 0, y: 50, vx: 0, vy: 0 };
  for (let k = 0; k < 120 * 6; k++) G.flyStep(b);
  near(-b.vy, G.TERMINAL, 0.02, 'a dropped shuttle settles at terminal velocity');
  near(G.TERMINAL, Math.sqrt(G.GRAV / G.DRAG), 1e-9, 'terminal velocity is sqrt(g/k)');
  // strong quadratic drag: a fast shuttle sheds most of its pace in a fraction of a second
  const f = { x: 0, y: 1, vx: 20, vy: 0 };
  let t = 0; while (f.vx > 10) { G.flyStep(f); t += G.DT; }
  assert.ok(t < 0.25, `a 20 u/s shuttle halves its speed within a quarter of a second (${t.toFixed(3)} s)`);
  // and so it drops far more steeply than it rose: a clear's way down is steeper than its way up
  const c = { x: -3.5, y: 1.4, vx: 13 * Math.cos(0.85), vy: 13 * Math.sin(0.85) };
  const up = Math.atan2(c.vy, c.vx);
  let last = { ...c };
  while (c.y > 0) { last = { ...c }; G.flyStep(c); }
  const down = Math.atan2(-last.vy, last.vx);
  assert.ok(down > up + 0.3, `the fall (${(down * 57.3).toFixed(0)}°) is steeper than the climb (${(up * 57.3).toFixed(0)}°)`);
  ok('drag, terminal velocity and the steep drop');
}

// ---- the cork-first flip
{
  const m = fresh(); freeze(m);
  launchFrom(m, 0, -2, 1.2, 8, 2);
  m.shuttle.ang = Math.PI; // pointing back the way it came, as if just hit
  for (let k = 0; k < 18; k++) G.step(m);
  const want = Math.atan2(m.shuttle.vy, m.shuttle.vx);
  let d = Math.abs(want - m.shuttle.ang); d = Math.min(d, 2 * Math.PI - d);
  assert.ok(d < 10 * Math.PI / 180, `cork-first within 0.15 s (off by ${(d * 57.3).toFixed(1)}°)`);
  ok('the shuttle flips cork-first after a hit');
}

// ---- the net and let-cords
{
  let m = fresh(); freeze(m);
  launchFrom(m, 0, -1.5, 0.5, 6, 0.4);
  runUntil(m, (q) => q.phase !== 'rally');
  const ev = m.events.splice(0);
  assert.ok(ev.some((e) => e.e === 'net'), 'a low drive hits the net');
  assert.ok(ev.some((e) => e.e === 'point' && e.side === 1 && e.why === 'net'), 'the point goes to the other side');
  assert.ok(m.shuttle.x < 0, 'it drops on the hitter’s side');

  // a clip on the tape: find a launch that crosses in the top band
  let cords = 0, overs = 0;
  for (let vy = 0.0; vy < 3 && cords < 40; vy += 0.01) {
    m = G.newMatch({ mode: 'ladder', seed: 100 + cords, who: 'dora', foe: 'robot' }); freeze(m);
    launchFrom(m, 0, -1.0, 0.9, 5, vy);
    runUntil(m, (q) => q.phase !== 'rally');
    const ev2 = m.events.splice(0), c = ev2.find((e) => e.e === 'cord');
    if (c) { cords++; if (c.over) overs++; const pt = ev2.find((e) => e.e === 'point'); assert.equal(pt.side, c.over && Math.abs(m.shuttle.x) <= G.HALF ? 0 : 1, 'a cord that trickles over wins; one that falls back loses'); }
  }
  assert.ok(cords >= 10, `let-cords happen (${cords})`);
  assert.ok(overs > 0 && overs < cords, `some trickle over and some fall back (${overs}/${cords})`);
  ok('net shots and let-cords');
}

// ---- the lines
{
  const land = (x, shot = 'drive', hits = 3) => {
    const m = fresh(); freeze(m);
    launchFrom(m, 0, x - 0.001, 0.01, 0.1, -1, shot); m.shuttle.hits = hits;
    runUntil(m, (q) => q.phase !== 'rally');
    return m.events.find((e) => e.e === 'point');
  };
  assert.equal(land(G.HALF - 0.05).side, 0, 'on the back line is in');
  assert.equal(land(G.HALF + 0.2).why, 'out', 'past the back line is out');
  assert.equal(land(G.HALF + 0.2).side, 1, 'an out goes to the other side');
  assert.equal(land(0.5).side, 0, 'just over the net is in');
  assert.equal(land(-1.2).why, 'down', 'landing on your own side loses the point');
  assert.equal(land(G.SHORT - 0.2, 'serve', 1).why, 'fault', 'a serve short of the short service line is a fault');
  assert.equal(land(G.SHORT + 0.2, 'serve', 1).side, 0, 'a serve past it is good');
  ok('in, out, short serves and your own side');
}

// ---- shot selection by timing and height
{
  const S = G.shotFor;
  assert.equal(S(1.3, -0.01, true, false, 0), 'smash', 'overhead, early, mid-hop: smash');
  assert.equal(S(1.3, 0.0, true, false, 1), 'smash');
  assert.equal(S(1.3, -0.01, false, false, 0), 'clear', 'overhead without a hop: no smash');
  assert.equal(S(1.3, 0.05, true, false, 0), 'clear', 'overhead and late: a deep clear');
  assert.equal(S(1.3, 0.05, false, false, -1), 'drop', 'overhead, held short: a drop');
  assert.equal(S(0.7, 0, false, false, 0), 'drive', 'mid height: a flat drive');
  assert.equal(S(0.7, 0.05, true, true, 1), 'drive');
  assert.equal(S(0.2, 0.01, false, true, 0), 'tumble', 'low at the net, sweet: a tumbling net shot');
  assert.equal(S(0.2, 0.06, false, true, 0), 'net', 'low at the net: a net drop');
  assert.equal(S(0.2, 0.06, false, true, 1), 'lift', 'low at the net, held long: a lift');
  assert.equal(S(0.2, 0.0, false, false, 0), 'lift', 'low at the back: a lift');
  assert.equal(S(0.2, 0.0, false, false, -1), 'net', 'low at the back, held short: a drop to the net');
  ok('the shot depends on height, timing, the hop and the aim');
}

// ---- the solver lands shots where they are aimed and clears the net
{
  for (const [x, y, ang, target] of [[-3.0, 1.3, 0.8, 4.0], [-2.0, 1.2, 0.07, 3.0], [-0.9, 0.3, 1.08, 0.7], [-3.0, 0.4, 0.96, 3.7]]) {
    const v = G.solveSpeed(0, x, y, ang, target, 40);
    const f = G.flight(x, y, Math.cos(ang) * v, Math.sin(ang) * v);
    assert.ok(!f.net, 'clears the net'); near(f.x, target, 0.05, `lands at ${target}`);
  }
  const l = G.launch(0, -1.6, 0.2, 0.05, 3.0, 20);
  assert.ok(!G.flight(-1.6, 0.2, Math.cos(l.ang) * l.speed, Math.sin(l.ang) * l.speed).net, 'a drive from low tips up to clear the net');
  const a = G.solveAngle(0, -1.5, 1.9, 21, 2.0, -1.0, 0.14);
  const f = G.flight(-1.5, 1.9, Math.cos(a) * 21, Math.sin(a) * 21);
  assert.ok(a < 0 && !f.net, 'a smash goes steeply down and over'); near(f.x, 2.0, 0.08, 'and lands where aimed');
  // a weak key can't reach the back
  const v = G.solveSpeed(0, -4, 1.2, 0.8, 4.2, 6);
  assert.equal(v, 6, 'out of reach: the full (weak) swing');
  ok('the solver');
}

// ---- real swings in a match: timing and height choose the shot
{
  const play = (h, early, hop, aim = 0) => {
    const m = fresh(); freeze(m);
    const p = m.players[0];
    p.x = -2.5;
    // a shuttle that will be at (p.x + 0.4, p.y + h) about 0.35 s from now, falling gently toward the player
    const fall = { x: p.x + 0.4, y: h + (hop ? G.HOP_TOP : 0), vx: -1.0, vy: -2.0 };
    // run it backwards roughly: just place it and let the swing meet it
    launchFrom(m, 1, fall.x, fall.y, fall.vx, fall.vy, 'clear');
    if (hop) { p.y = G.HOP_TOP; p.vy = 0.0; }
    const press = { move: aim === 1 ? -1 : aim === -1 ? 1 : 0, hop: false, swing: true, wind: false };
    const hold = { ...press, swing: false };
    // early: the shuttle is already there when the swing strikes (no waiting); late: press well before
    G.step(m, [early ? press : press]);
    for (let k = 0; k < 40; k++) G.step(m, [hold]);
    return m.events.find((e) => e.e === 'hit');
  };
  const sm = play(1.3, true, true);
  assert.ok(sm, 'the swing connects'); assert.equal(sm.shot, 'smash', 'overhead mid-hop: a smash');
  assert.equal(play(1.25, true, false).shot, 'clear', 'overhead on the ground: a clear');
  assert.equal(play(0.7, true, false).shot, 'drive', 'chest height: a drive');
  ok('swinging in a match picks the shot from the contact');
}

// ---- the spring
{
  const m = fresh(); freeze(m);
  m.phase = 'rally'; m.shuttle.held = -1; m.shuttle.down = true;
  const p = m.players[0];
  const s0 = p.spring, x0 = p.x;
  for (let k = 0; k < 60; k++) G.step(m, [{ move: -1, hop: false, swing: false, wind: false }]);
  const ran = Math.abs(p.x - x0);
  near(s0 - p.spring, ran * G.SPRING.run, 1e-6, 'running drains the spring by distance');
  const s1 = p.spring;
  G.step(m, [{ move: 0, hop: true, swing: false, wind: false }]);
  near(s1 - p.spring, G.SPRING.hop, 0.003, 'a hop costs spring');
  for (let k = 0; k < 120; k++) G.step(m);
  p.spring = 0.3;
  for (let k = 0; k < 120; k++) G.step(m, [{ move: 0, hop: false, swing: false, wind: true }]);
  near(p.spring, 0.3 + G.SPRING.wind, 0.02, 'winding fills the spring at its rate');
  assert.ok(p.winding, 'standing still and holding wind winds');
  const xw = p.x;
  for (let k = 0; k < 30; k++) G.step(m, [{ move: 1, hop: false, swing: false, wind: true }]);
  assert.ok(Math.abs(p.x - xw) < 0.01, 'a toy winding its key stands still');
  assert.equal(G.speedFactor(1), 1); assert.equal(G.speedFactor(G.SPRING.sluggish), 1);
  assert.ok(G.speedFactor(0) < 0.5 && G.speedFactor(0.15) < 0.8, 'a run-down toy is sluggish');
  assert.ok(G.power(0) < G.power(0.5), 'and hits softer');
  assert.ok(G.SPRING.shots.smash > 2.5 * G.SPRING.shots.clear, 'a smash costs the most spring');
  // running out
  p.spring = 0.005;
  for (let k = 0; k < 60; k++) G.step(m, [{ move: 1, hop: false, swing: false, wind: false }]);
  assert.ok(p.ranOut && p.spring === 0, 'the key can run out');
  assert.ok(m.events.some((e) => e.e === 'runout'), 'and says so');
  ok('the spring drains, winds and slows a run-down toy');
}

// ---- scoring, serving, games and matches
{
  const m = fresh(); freeze(m);
  assert.equal(m.server, 0, 'the player serves first');
  G.award(m, 1, 'winner'); assert.equal(m.server, 1, 'the rally winner serves');
  m.phaseT = 9; G.step(m); assert.equal(m.phase, 'serve');
  assert.equal(m.shuttle.held, G.serverIndex(m)); assert.equal(m.players[m.shuttle.held].side, 1, 'the server holds the shuttle');
  for (let k = 0; k < 9; k++) G.award(m, 0, 'winner');
  assert.deepEqual(m.score, [9, 1]);
  G.award(m, 0, 'winner'); assert.deepEqual(m.score, [10, 1]); assert.equal(m.phase, 'point');
  G.award(m, 0, 'winner'); assert.equal(m.phase, 'over', 'first to 11 wins the one-game match'); assert.equal(m.winner, 0);
  assert.deepEqual(m.gameLog, [[11, 1]]);
  const d = fresh({ foe: 'bear' }); freeze(d);
  for (let k = 0; k < 10; k++) { G.award(d, 0, 'winner'); G.award(d, 1, 'winner'); }
  G.award(d, 0, 'winner'); assert.equal(d.phase, 'point', '11-10 is not enough: win by two');
  G.award(d, 1, 'winner'); G.award(d, 1, 'winner'); G.award(d, 1, 'winner'); assert.equal(d.games[1], 1, '11-13 takes the game');
  assert.equal(d.phase, 'game');
  d.phaseT = 9; G.step(d); assert.deepEqual(d.score, [0, 0], 'a new game starts from love'); assert.equal(d.server, 1, 'the game winner serves');
  for (let k = 0; k < 14; k++) { G.award(d, 0, 'winner'); G.award(d, 1, 'winner'); }
  assert.equal(d.phase, 'point', '14-14 plays on');
  G.award(d, 0, 'winner');
  assert.equal(d.games[0] + d.games[1], 2, 'the cap at 15 ends a long game'); assert.deepEqual(d.gameLog[1], [15, 14]);
  assert.equal(d.phase, 'game');
  d.phaseT = 9; G.step(d);
  for (let k = 0; k < 11; k++) G.award(d, 0, 'winner');
  assert.equal(d.phase, 'over'); assert.equal(d.winner, 0, 'two games to one wins the final');
  ok('rally-point scoring to 11, win by two, cap 15, the serve and best of three');
}

// ---- the serve
{
  const m = fresh(); freeze(m);
  const p = m.players[0], x0 = p.x;
  for (let k = 0; k < 30; k++) G.step(m, [{ move: -1, hop: true, swing: false, wind: false }]);
  assert.equal(p.x, x0, 'the server stands still'); assert.equal(m.phase, 'serve');
  G.step(m, [{ move: 0, hop: false, swing: true, wind: false }]);
  runUntil(m, (q) => q.phase === 'rally', 60);
  assert.equal(m.shuttle.shot, 'serve'); assert.ok(m.shuttle.vx > 0, 'the serve goes over');
  const f = G.flight(m.shuttle.x, m.shuttle.y, m.shuttle.vx, m.shuttle.vy);
  assert.ok(f.x > G.SHORT && f.x < G.HALF, `a low serve lands in the service area (${f.x.toFixed(2)})`);
  const h = fresh(); freeze(h);
  G.step(h, [{ move: -1, hop: false, swing: true, wind: false }]);
  runUntil(h, (q) => q.phase === 'rally', 60);
  assert.ok(G.flight(h.shuttle.x, h.shuttle.y, h.shuttle.vx, h.shuttle.vy).apex > 3, 'held back, it is a high serve');
  const idle = fresh(); freeze(idle);
  runUntil(idle, (q) => q.phase === 'rally', 120 * 10);
  assert.equal(idle.phase, 'rally', 'a player who never serves gets an automatic serve');
  ok('serving: low and high serves, and the serve clock');
}

// ---- the toys play deterministically per seed, and differently across seeds
{
  const runIt = (seed, foe) => { const m = G.newMatch({ mode: 'ladder', seed, who: 'enzo', foe }); G.playMatch(m, (q, i) => G.aiInput(q, i)); return JSON.stringify([m.gameLog, m.rallies, m.t.toFixed(4)]); };
  assert.equal(runIt(5, 'duck'), runIt(5, 'duck'), 'same seed, same match');
  assert.notEqual(runIt(5, 'duck'), runIt(6, 'duck'), 'another seed, another match');
  const m = G.newMatch({ mode: 'versus', seed: 1, who: 'dora' });
  assert.ok(m.players.every((p) => p.human) && m.players[1].who === 'enzo', 'versus: two players, Dora and Enzo');
  const d = G.newMatch({ mode: 'doubles', seed: 1, who: 'enzo', pair: 'frog-top' });
  assert.equal(d.players.length, 4); assert.deepEqual(d.players.map((p) => p.who), ['enzo', 'dora', 'frog', 'top']);
  assert.ok(d.players[0].human && !d.players[1].human, 'doubles: the computer plays your partner');
  G.playMatch(d, (q, i) => G.aiInput(q, i));
  assert.equal(d.phase, 'over', 'a doubles match plays out');
  ok('the toys are deterministic per seed; versus and doubles set up');
}

// ---- the AI moves under the same physics: it never moves faster than its legs
{
  const m = G.newMatch({ mode: 'ladder', seed: 3, who: 'dora', foe: 'bear' });
  let fastest = 0;
  for (let k = 0; k < 120 * 60; k++) { const x = m.players[1].x, ph = m.phase; G.step(m, [G.aiInput(m, 0)]); m.events.length = 0; if (ph === 'rally' && m.phase === 'rally') fastest = Math.max(fastest, Math.abs(m.players[1].x - x) / G.DT); }
  assert.ok(fastest <= G.RUN * G.toyById('bear').style.speed + 1e-6, `the bear runs no faster than its top speed (${fastest.toFixed(2)})`);
  ok('the computer runs no faster than its legs allow');
}

// ---- medals, unlocks and the save
{
  const s = G.blankSave();
  assert.equal(G.unlockedRung(s), 0); assert.ok(G.toyOpen(s, 'robot') && !G.toyOpen(s, 'frog'), 'the ladder opens one rung at a time');
  assert.ok(!G.doublesOpen(s) && G.courtOpen(s, 'shop') && !G.courtOpen(s, 'biscuit'));
  const win = (foe, a, b, ranOut = false) => {
    const m = G.newMatch({ mode: 'ladder', seed: 1, who: 'dora', foe }); freeze(m);
    m.players[0].ranOut = ranOut;
    for (let g = 0; g < m.best; g++) { for (let k = 0; k < b; k++) G.award(m, 1, 'winner'); for (let k = 0; k < a; k++) G.award(m, 0, 'winner'); if (m.phase === 'game') { m.phaseT = 9; G.step(m); } }
    return G.recordMatch(s, m);
  };
  let r = win('robot', 11, 3);
  assert.deepEqual(r.medals, { win: true, key: true, margin: true }, 'a big win with the key never run out earns all three medals');
  r = win('frog', 11, 9, true);
  assert.deepEqual(s.ladder.frog, { win: true, key: false, margin: false }, 'a close win with the key run out: just the win');
  assert.equal(r.court, 'biscuit', 'two wins open the biscuit-tin court');
  r = win('frog', 11, 2);
  assert.deepEqual(r.medals, { win: false, key: true, margin: true }, 'a replay adds the missing medals'); assert.equal(G.medalCount(s), 6);
  win('duck', 11, 5); r = win('top', 11, 5);
  assert.ok(r.doubles && G.doublesOpen(s), 'four wins open doubles');
  win('knight', 11, 5); win('penguin', 11, 5);
  r = win('bear', 11, 5);
  assert.ok(r.ending && s.ending && r.court === 'train', 'beating the bear wins the cup, the ending and the toy-train court');
  assert.equal(G.ladderWins(s), 7);
  s.court = 'musicbox'; s.who = 'enzo'; s.tutorial = true; s.settings.music = false;
  const back = G.readSave(JSON.stringify(s));
  assert.deepEqual(back, s, 'the save round-trips');
  ok('medals, unlocks and the cup');
}
{
  const blank = G.blankSave();
  for (const raw of [null, '', '{', 'null', '42', '[]', '{"v":2}', JSON.stringify({ v: 1, ladder: 'x', who: 'fox', court: 'moon', settings: 7, played: -3, wins: 'lots' })]) {
    assert.deepEqual(G.readSave(raw), blank, `a corrupt save starts fresh: ${raw}`);
  }
  const odd = G.readSave(JSON.stringify({ v: 1, ladder: { robot: { win: true, key: 'yes' }, dragon: { win: true }, frog: { win: false, key: true } }, court: 'train', doubles: { 'frog-top': true, nope: true }, settings: { sound: false, music: 'x' } }));
  assert.deepEqual(odd.ladder, { robot: { win: true, key: false, margin: false } }, 'bad medals are dropped');
  assert.equal(odd.court, 'shop', 'a court that is not open falls back to the toyshop court');
  assert.deepEqual(odd.doubles, { 'frog-top': true });
  assert.deepEqual(odd.settings, { sound: false, music: true });
  ok('corrupt and odd saves never crash and never misread');
}

console.log(`\n${n} rally checks passed`);
