import assert from 'node:assert/strict';
import { PuttGame, ALL_HOLES, COURSES, COURSE_IDS, getHole, tileAt, heightAt, gateShut, playable, readProfile, freshProfile, lanternOpen, scoreLabel, coursePar, DT, PICKUP, MAX_STROKES, CUP_R } from '../.checks/putt-game.js';
import { simulate } from './putt-solver.mjs';
let checks = 0;
function check(name, fn) { fn(); checks++; console.log(`PASS putt: ${name}`); }
const rad = (deg) => (deg * Math.PI) / 180;
/** Rolls until the ball rests, drops or the hole is over. */
const settle = (g) => { let n = 0; while (!['aim', 'sunk', 'card', 'done'].includes(g.mode) && n++ < 60 * 60) g.step(); };
/** Plays a line of [angle°, power, wait] shots through the real game, the way the page does. */
function play(id, line, players = ['dora']) {
  const g = new PuttGame({ hole: id, players }); g.skipIntro(); g.clock = 0;
  for (const [a, p, w = 0] of line) { for (let t = 0; t < w - 1e-9; t += DT) g.step(); g.setAim(rad(a), p); assert(g.putt(), `${id}: putt refused`); settle(g); if (g.mode === 'sunk') break; }
  return g;
}

check('both courses have nine holes, and every hole has a tee, a cup, an acorn and a way from tee to cup', () => {
  for (const c of COURSE_IDS) assert.equal(COURSES[c].holes.length, 9, c);
  assert.equal(new Set(ALL_HOLES.map((h) => h.id)).size, 18);
  for (const s of ALL_HOLES) {
    const h = getHole(s.id);
    assert(h.tee && h.cup && h.acorn, `${s.id}: tee, cup and acorn`);
    const t = tileAt(h, h.tee.x, h.tee.z), c = tileAt(h, h.cup.x, h.cup.z);
    assert(Number.isFinite(h.flow[t.r][t.c]), `${s.id}: the cup can be reached from the tee`);
    assert.equal(h.flow[c.r][c.c], 0);
    assert(s.par >= 2 && s.par <= 4, `${s.id}: par ${s.par}`);
    if (s.levels) assert.equal(s.levels.length <= s.map.length, true);
    for (let r = 0; r < h.d; r++) for (let col = 0; col < h.w; col++) if (playable(h.tiles[r][col])) assert(Number.isFinite(heightAt(h, col + 0.5, r + 0.5)));
  }
  assert.equal(coursePar('clover'), COURSES.clover.holes.reduce((s, h) => s + h.par, 0));
});

check('every hole has a recorded line that holes out in par or better, played through the real game', () => {
  for (const s of ALL_HOLES) {
    assert(s.proof.length, `${s.id}: has a proof`);
    const g = play(s.id, s.proof);
    assert.equal(g.mode, 'sunk', `${s.id}: proof drops`); assert(g.scores[0][0] <= s.par, `${s.id}: ${g.scores[0][0]} is over par ${s.par}`);
  }
});

check('every golden acorn can be picked up on the way to holing out', () => {
  for (const s of ALL_HOLES) {
    assert(s.acornProof.length, `${s.id}: has an acorn line`);
    const g = play(s.id, s.acornProof);
    assert.equal(g.mode, 'sunk', `${s.id}: acorn line drops`); assert(g.acorns.includes(s.id), `${s.id}: acorn picked up`);
    assert(g.profile.acorns.includes(s.id)); assert(g.scores[0][0] < PICKUP);
  }
});

check('the solver and the game agree, and the same putts replay exactly', () => {
  for (const s of ALL_HOLES) {
    let state = { x: getHole(s.id).tee.x, z: getHole(s.id).tee.z, clock: 0, strokes: 0, acorn: false }, r;
    for (const shot of s.proof) { r = simulate(s.id, state, shot); if (r.sunk) break; state = r; }
    assert(r.sunk, `${s.id}: solver replay drops`);
    const trace = (g) => { const out = []; g.setAim(rad(37), 0.9); g.putt(); for (let i = 0; i < 400; i++) { g.step(); out.push(g.ball.x, g.ball.z); } return out; };
    const a = new PuttGame({ hole: s.id, players: ['dora'] }), b = new PuttGame({ hole: s.id, players: ['dora'] });
    a.skipIntro(); b.skipIntro(); assert.deepEqual(trace(a), trace(b));
  }
});

check('a fast ball rattles over the rim; a gentle one drops', () => {
  const h = getHole('clover-1'), g = new PuttGame({ hole: 'clover-1', players: ['dora'] });
  g.restAt(h.cup.x, h.cup.z + 1.6, 0, 0); g.setAim(rad(-90), 1); g.putt(); settle(g);
  assert(g.events.some((e) => e.kind === 'lip'), 'lipped out'); assert.notEqual(g.mode, 'sunk');
  g.restAt(h.cup.x, h.cup.z + 0.8, 0, 1); g.setAim(rad(-90), 0.05); g.putt(); settle(g);
  assert.equal(g.mode, 'sunk'); assert.equal(g.scores[0][0], 2); assert.equal(g.label, 'Par!');
});

check('after six putts the ball is picked up and scores seven', () => {
  const g = new PuttGame({ hole: 'clover-1', players: ['dora'] }); g.skipIntro();
  for (let i = 0; i < MAX_STROKES; i++) { g.setAim(rad(90), 0.03); assert(g.putt()); settle(g); }
  assert.equal(g.mode, 'sunk'); assert.equal(g.scores[0][0], PICKUP); assert.equal(g.label, 'Picked up');
  assert(g.events.some((e) => e.kind === 'pickup')); assert.equal(g.profile.holeBest['clover-1'], undefined, 'a pick-up is no best');
});

check('a ball in the pond costs a stroke and goes back where it was putted from', () => {
  const s = ALL_HOLES.find((h) => h.map.some((row) => row.includes('w'))); assert(s, 'a hole with water');
  const h = getHole(s.id); let spot = null, dir = null;
  for (let r = 0; r < h.d && !spot; r++) for (let c = 0; c < h.w && !spot; c++) {
    if (h.tiles[r][c].kind !== 'felt') continue;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (h.tiles[r + dr]?.[c + dc]?.kind === 'water') { spot = { x: c + 0.5, z: r + 0.5 }; dir = Math.atan2(dr, dc); break; }
  }
  const g = new PuttGame({ hole: s.id, players: ['dora'] }); g.restAt(spot.x, spot.z, 0, 0); g.setAim(dir, 0.3); g.putt(); settle(g);
  assert(g.events.some((e) => e.kind === 'splash')); assert.equal(g.strokes, 2); assert.equal(g.mode, 'aim');
  assert.deepEqual([g.ball.x, g.ball.z], [spot.x, spot.z]);
});

check('a windmill sail across the door turns the ball back', () => {
  const h = getHole('clover-4'), m = h.windmills[0]; let clock = 0; while (!gateShut(m, clock + 0.15)) clock += DT;
  const g = new PuttGame({ hole: 'clover-4', players: ['dora'] }), gx = (m.gate.ax + m.gate.bx) / 2, gz = (m.gate.az + m.gate.bz) / 2;
  g.restAt(gx, gz + m.front * 0.45, clock, 0); g.setAim(Math.atan2(-m.front, 0), 0.08); g.putt(); settle(g);
  assert(g.events.some((e) => e.kind === 'gate'), 'bounced off the sail'); assert((g.ball.z - gz) * m.front > 0, 'still on the near side');
});

check('random putts on every hole never leave the course or break the numbers', () => {
  let seed = 40; const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (const s of ALL_HOLES) {
    const g = new PuttGame({ hole: s.id, players: ['enzo'] }); g.skipIntro();
    for (let i = 0; i < 6 && g.mode === 'aim'; i++) {
      g.setAim(rand() * Math.PI * 2, 0.05 + rand() * 0.95); g.putt();
      let n = 0; while (!['aim', 'sunk'].includes(g.mode) && n++ < 60 * 60) { g.step(); assert(Number.isFinite(g.ball.x) && Number.isFinite(g.ball.z), `${s.id}: NaN`); }
      if (g.mode === 'aim') assert(playable(tileAt(g.hole, g.ball.x, g.ball.z)) && tileAt(g.hole, g.ball.x, g.ball.z).kind !== 'water', `${s.id}: rests on the course at ${g.ball.x},${g.ball.z}`);
    }
  }
});

check('taking turns: both friends play each hole, and the lower score putts first next time', () => {
  const g = new PuttGame({ course: 'clover', players: ['dora', 'enzo'] });
  const holeOut = (line) => { g.skipIntro(); g.clock = 0; for (const [a, p, w = 0] of line) { for (let t = 0; t < w - 1e-9; t += DT) g.step(); g.setAim(rad(a), p); g.putt(); settle(g); if (g.mode === 'sunk') break; } };
  const spec = COURSES.clover.holes[0];
  assert.equal(g.hero, 'dora'); holeOut([[90, 0.03], ...spec.proof]); while (g.mode === 'sunk') g.step();
  assert.equal(g.hero, 'enzo'); holeOut(spec.proof); while (g.mode === 'sunk') g.step();
  assert.equal(g.mode, 'card'); assert.deepEqual(g.order, [0, 1]); g.next();
  assert.deepEqual(g.order, [1, 0]); assert.equal(g.hero, 'enzo', 'Enzo scored lower, so Enzo has the honour');
});

check('a whole Clover round on the recorded lines scores par or better and lights the Lantern Nine', () => {
  const g = new PuttGame({ course: 'clover', players: ['dora'] });
  for (const spec of COURSES.clover.holes) {
    assert.equal(g.hole.id, spec.id); g.skipIntro(); g.clock = 0;
    for (const [a, p, w = 0] of spec.proof) { for (let t = 0; t < w - 1e-9; t += DT) g.step(); g.setAim(rad(a), p); g.putt(); settle(g); if (g.mode === 'sunk') break; }
    while (g.mode === 'sunk') g.step(); assert.equal(g.mode, 'card'); g.next();
  }
  assert.equal(g.mode, 'done'); assert(g.total(0) <= coursePar('clover'));
  assert(lanternOpen(g.profile)); assert.equal(g.profile.courseBest.clover, g.total(0)); assert.equal(g.profile.rounds, 1); assert(g.profileChanged);
});

check('a round saves between putts and loads back; broken saves are refused', () => {
  const g = new PuttGame({ course: 'clover', players: ['dora'] }); g.skipIntro(); g.setAim(rad(-90), 0.2); g.putt(); settle(g);
  const raw = g.save(); assert(raw); const back = PuttGame.load(raw);
  assert.equal(back.strokes, 1); assert.deepEqual([back.ball.x, back.ball.z], [g.ball.x, g.ball.z]); assert.equal(back.holeIndex, 0);
  assert.equal(new PuttGame({ hole: 'clover-1', players: ['dora'] }).save(), null, 'practice is not saved');
  const bad = (patch) => assert.equal(PuttGame.load(JSON.stringify({ ...JSON.parse(raw), ...patch })), null, JSON.stringify(patch));
  bad({ v: 2 }); bad({ course: 'moon' }); bad({ players: ['bob'] }); bad({ hole: 9 }); bad({ strokes: 6 }); bad({ order: [1] }); bad({ scores: [[99]] }); bad({ holes: ['x'] });
  for (const junk of [null, '', '{', '[]', '7']) assert.equal(PuttGame.load(junk), null);
  const offCourse = PuttGame.load(JSON.stringify({ ...JSON.parse(raw), x: -40, z: 2 })); assert.deepEqual([offCourse.ball.x, offCourse.ball.z], [offCourse.hole.tee.x, offCourse.hole.tee.z]);
});

check('the profile keeps bests, aces and acorns, opens the Lantern Nine after a Clover round, and ignores junk', () => {
  const p = readProfile(JSON.stringify({ holeBest: { 'clover-1': 2, 'clover-2': 0, nope: 1 }, aces: ['clover-3', 'x', 'clover-3'], acorns: 'no', courseBest: { clover: 30, lantern: -1 }, finished: ['clover', 'moon'], rounds: 2 }));
  assert.deepEqual(p.holeBest, { 'clover-1': 2 }); assert.deepEqual(p.aces, ['clover-3']); assert.deepEqual(p.acorns, []);
  assert.deepEqual(p.courseBest, { clover: 30 }); assert.deepEqual(p.finished, ['clover']); assert(lanternOpen(p));
  assert.deepEqual(readProfile('{{'), freshProfile()); assert(!lanternOpen(freshProfile()));
  assert.equal(scoreLabel(1, 3), 'Hole in one!'); assert.equal(scoreLabel(2, 4), 'Eagle!'); assert.equal(scoreLabel(3, 3), 'Par!'); assert.equal(scoreLabel(5, 3), 'Double bogey');
  assert(CUP_R > 0);
});
console.log(`Puttering Paws: ${checks} engine checks passed.`);
