// Sweep & Slide engine checks: the ice is deterministic; a stone slows at a steady rate and curls toward its spin,
// harder as it slows; sweeping carries it further and straighter; bumps lose a little energy, pass momentum (a
// takeout stops dead on a full hit, a thin hit splits the stones) and pass spin; stones leave play over the back
// line, against the side boards and short of the hog line; the line-finders hit their marks; the end's score with
// counting stones, measured ties and empty ends; the hammer; a whole match; snapshots; the drills; and the save.
import assert from 'node:assert/strict';
import * as C from '../.checks/curl-game.js';

let checks = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); checks++; };
const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); checks++; };
const near = (a, b, tol, msg) => { assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`); checks++; };
const lone = (shot, sweep = () => false) => { const s = C.newStone(0, 0, 'dora', 0, 0); C.launch(s, shot); const st = [s]; C.settle(st, s, sweep); return s; };
const at = (id, team, x, y) => C.newStone(id, team, team ? 'opp' : 'dora', x, y);
const roll = (stones, mover, vx, vy = 0, w = 0) => { mover.vx = vx; mover.vy = vy; mover.w = w; mover.moving = true; const ev = []; for (let k = 0; k < 120 * 40 && C.moving(stones); k++) C.step(stones, null, ev); return ev; };

// ---- the weight scale
{
  for (const w of [0, 0.2, 0.5, 0.7, 0.85, 1]) near(C.speedToWeight(C.weightToSpeed(w)), w, 1e-9, `weight ${w} round-trips`);
  ok(C.weightToSpeed(0.3) < C.weightToSpeed(0.6) && C.weightToSpeed(0.6) < C.weightToSpeed(0.9), 'heavier weight is faster');
  eq([0.05, 0.3, 0.5, 0.75, 0.9, 1].map(C.weightName), ['Short', 'Guard', 'Draw', 'Tap', 'Hit', 'Peel'], 'the weight bar names');
}

// ---- determinism: the same throw lands in exactly the same place, every time
{
  const shot = { angle: 0.01, weight: 0.52, curl: 1 };
  const a = lone(shot), b = lone(shot);
  eq([a.x, a.y], [b.x, b.y], 'a lone throw is deterministic');
  const run = () => { const m = new C.Match({ ends: 2, seed: 77, noise: [C.PLAYER_NOISE, { v: 0.03, a: 0.01 }] }); for (let k = 0; k < 16; k++) { if (m.thrown === 8) m.nextEnd(); m.play({ angle: ((k * 37) % 9 - 4) * 0.008, weight: 0.45 + (k % 5) * 0.08, curl: k % 2 ? 1 : -1 }); } return JSON.stringify([m.score, m.results, m.rand.state()]); };
  eq(run(), run(), 'a whole match with noise replays exactly from its seed');
}

// ---- friction and curl
{
  const s = C.newStone(0, 0, 'dora', 0, 0); C.launch(s, { angle: 0, weight: 0.5, curl: 1 }); const st = [s];
  const v0 = C.speed(s); C.step(st, null); near(v0 - C.speed(s), C.FRICTION * C.DT, 1e-6, 'friction slows the stone at a steady rate');
  const left = lone({ angle: 0, weight: 0.5, curl: 1 }), right = lone({ angle: 0, weight: 0.5, curl: -1 });
  ok(left.y > 0.6 && right.y < -0.6, `an anticlockwise stone curls left, a clockwise one right (${left.y.toFixed(2)}, ${right.y.toFixed(2)})`);
  near(left.y, -right.y, 1e-9, 'the curl is mirror-symmetric');
  near(left.x, C.TEE, 0.4, 'draw weight reaches the house');
  // the curl grows as the stone slows: most of the bend comes in the last third of the trip
  const t = C.newStone(0, 0, 'dora', 0, 0); C.launch(t, { angle: 0, weight: 0.5, curl: 1 }); const tt = [t]; let yAt = 0;
  while (t.moving) { C.step(tt, null); if (!yAt && t.x > C.TEE * 0.66) yAt = t.y; }
  ok(yAt < t.y * 0.4, `the bend comes late (${yAt.toFixed(2)} of ${t.y.toFixed(2)} by two-thirds of the way)`);
  const st2 = C.newStone(0, 0, 'dora', 0, 0); C.launch(st2, { angle: 0, weight: 0.5, curl: 1 }); st2.w = 0; C.settle([st2], st2);
  near(st2.y, 0, 1e-9, 'a stone with no spin runs straight');
}

// ---- sweeping: further and straighter
{
  const shot = C.drawTo(C.TEE, 0, 1);
  const plain = lone(shot), swept = lone(shot, (s) => s.x > 10);
  ok(swept.x > plain.x + 0.6, `sweeping the last stretch carries it on (${plain.x.toFixed(2)} → ${swept.x.toFixed(2)})`);
  const a = C.newStone(0, 0, 'dora', 0, 0), b = C.newStone(1, 0, 'dora', 0, 0);
  C.launch(a, { angle: 0, weight: 0.85, curl: 1 }); C.launch(b, { angle: 0, weight: 0.85, curl: 1 });
  for (let k = 0; k < 360; k++) { C.step([a], null); C.step([b], b.id); }
  ok(Math.abs(b.y) < Math.abs(a.y) * 0.75 && b.x > a.x, 'a swept stone runs straighter and further over the same time');
  ok(C.judgeSweep(Object.assign(C.newStone(0, 0, 'dora', 8, 0), { vx: 1.5, moving: true }), { target: C.TEE, slack: 0.1 }), 'the sweep judge sweeps a light stone');
  ok(!C.judgeSweep(Object.assign(C.newStone(0, 0, 'dora', 8, 0), { vx: 2.4, moving: true }), { target: C.TEE, slack: 0.1 }), 'and leaves a heavy one');
}

// ---- collisions
{
  // a full, straight hit: the shooter nearly stops, the target takes nearly all the speed; energy is lost, momentum kept
  const a = at(1, 0, 10, 0), b = at(2, 1, 11, 0), st = [a, b];
  a.vx = 2; a.moving = true; const e0 = C.energy(st), p0 = a.vx + b.vx; let hit = false;
  for (let k = 0; k < 120 && !hit; k++) { const ev = C.step(st, null); hit = ev.some((e) => e.kind === 'hit'); }
  ok(hit, 'the stones meet');
  ok(C.energy(st) < e0 * 0.97, `a bump loses energy (${(C.energy(st) / e0).toFixed(3)})`);
  { const x = at(20, 0, 5, 0), y = at(21, 1, 5.35, 0.05); x.vx = 2; x.vy = 0.1; x.moving = true; const pa = [x.vx + y.vx, x.vy + y.vy], ka = C.energy([x, y]); C.collide([x, y]); near(x.vx + y.vx, pa[0], 1e-9, 'a bump keeps momentum along the sheet'); near(x.vy + y.vy, pa[1], 1e-9, 'and across it'); ok(C.energy([x, y]) < ka, 'and loses energy'); }
  ok(Math.abs(a.vx) < 0.2 && b.vx > 1.6, `a full hit stops the shooter (${a.vx.toFixed(2)}, ${b.vx.toFixed(2)})`);
  ok(b.touched && a.touched, 'both are marked as touched');
  // a thin hit splits them at a wide angle and passes spin to the target
  const c = at(3, 0, 10, 0.3), d = at(4, 1, 11, 0), s2 = [c, d];
  roll(s2, c, 2, 0, 1.2);
  ok(c.y > d.y + 0.6, 'a thin hit splits the stones apart');
  const e = at(5, 0, 10, 0.25), f = at(6, 1, 11, 0); e.vx = 2; e.w = 1.2; e.moving = true; const s3 = [e, f];
  for (let k = 0; k < 120 && !f.moving; k++) C.step(s3, null);
  ok(Math.abs(f.w) > 0.01, `spin passes to the struck stone (${f.w.toFixed(3)})`);
  // a double: one shooter knocks two stones
  const g = at(7, 0, 9, 0), h = at(8, 1, 10, 0.03), i = at(9, 1, 10.6, -0.12), s4 = [g, h, i];
  roll(s4, g, 3.2);
  ok(h.x > 10.5 && (i.out || i.x > 11), 'a chain of bumps moves both stones');
  // stones never overlap after a pile-up
  const pile = [at(10, 0, 9, 0), at(11, 1, 10, 0.05), at(12, 1, 10.36, -0.02), at(13, 0, 10.72, 0.04)];
  roll(pile, pile[0], 3);
  for (let p = 0; p < pile.length; p++) for (let q = p + 1; q < pile.length; q++) if (!pile[p].out && !pile[q].out) ok(C.dist(pile[p], pile[q].x, pile[q].y) >= 2 * C.STONE_R - 1e-3, 'no overlaps after a pile-up');
}

// ---- out of play
{
  const peel = lone({ angle: 0, weight: 1, curl: 1 });
  ok(peel.out, 'a peel goes over the back line');
  const wide = C.newStone(0, 0, 'dora', 0, 0); C.launch(wide, { angle: 0.12, weight: 0.5, curl: 1 }); const ev = C.settle([wide], wide);
  ok(wide.out && ev.some((e) => e.kind === 'out' && e.why === 'side'), 'a stone touching the side boards is out');
  const short = C.newStone(0, 0, 'dora', 0, 0); C.launch(short, { angle: 0, weight: 0.05, curl: 1 }); const ev2 = C.settle([short], short);
  ok(short.out && ev2.some((e) => e.kind === 'out' && e.why === 'hog'), 'a stone short of the hog line is taken off');
  const guard = lone({ angle: 0, weight: 0.3, curl: 1 });
  ok(!guard.out && C.inGuardZone(guard), 'guard weight stops in the guard zone');
}

// ---- the line-finders
{
  for (const [x, y, c] of [[C.TEE, 0, 1], [C.TEE - 0.8, 0.6, -1], [C.TEE + 1, -0.9, 1], [C.HOG + 3, 0.3, -1]]) {
    const s = lone(C.drawTo(x, y, c));
    ok(C.dist(s, x, y) < 0.03, `drawTo lands on (${x}, ${y}) within 3 cm (${C.dist(s, x, y).toFixed(3)})`);
  }
  const target = at(1, 1, C.TEE + 0.3, -0.4), shooter = C.newStone(0, 0, 'dora', 0, 0), st = [shooter, target];
  C.launch(shooter, C.lineThrough(target.x, target.y, 0.88, 1)); C.settle(st, shooter);
  ok(target.out, 'lineThrough at hit weight takes the stone out');
  const g = C.ghost({ angle: 0, weight: 0.5, curl: 1 }, 4);
  ok(g.length > 5 && Math.hypot(g.at(-1).x, g.at(-1).y) <= 4.2, 'the ghost covers only the first few metres');
  near(C.broomOf({ angle: 0.05, weight: 0.5, curl: 1 }).y, Math.tan(0.05) * C.TEE, 1e-9, 'the broom sits on the line at the tee');
}

// ---- scoring an end
{
  const S = (list) => list.map(([team, x, y], i) => at(i, team, x, y));
  eq(C.scoreEnd(S([[0, C.TEE, 0.1], [0, C.TEE, 0.5], [1, C.TEE, 0.8], [0, C.TEE, 1.2]])).points, 2, 'counts stones nearer than the other team’s best');
  eq(C.scoreEnd(S([[0, C.TEE, 0.1], [0, C.TEE, 0.5], [1, C.TEE, 0.8]])).team, 0, 'the nearest stone’s team scores');
  eq(C.scoreEnd(S([[1, C.TEE, 0.2], [1, C.TEE, -0.4], [1, C.TEE + 1, 0]])).points, 3, 'every stone counts when the other team has none in the house');
  const blank = C.scoreEnd(S([[0, C.HOG + 2, 0], [1, C.TEE - 2.5, 0]]));
  ok(blank.blank && blank.points === 0 && blank.team === null, 'an empty house is a blank end');
  const tie = C.scoreEnd(S([[0, C.TEE + 0.5, 0], [1, C.TEE, 0.5], [0, C.TEE, 1.4]]));
  ok(tie.tie && tie.points === 0 && tie.team === null, 'a measured tie for shot scores nothing');
  eq(C.scoreEnd(S([[0, C.TEE, C.HOUSE_R + C.STONE_R - 0.01]])).points, 1, 'a stone biting the outer ring counts');
  eq(C.scoreEnd(S([[0, C.TEE, C.HOUSE_R + C.STONE_R + 0.01]])).blank, true, 'one just outside does not');
  const out = S([[0, C.TEE, 0]]); out[0].out = true; eq(C.scoreEnd(out).blank, true, 'stones out of play do not count');
}

// ---- the hammer and the match
{
  const m = new C.Match({ ends: 4, seed: 1, hammer: 0, noise: [{ v: 0, a: 0 }, { v: 0, a: 0 }] });
  eq([m.turn, m.thrower()], [1, 'opp'], 'the team without the hammer throws first');
  const order = []; for (let k = 0; k < 8; k++) { order.push(m.thrower()); m.play({ angle: 0, weight: 0.05, curl: 1 }); }
  eq(order, ['opp', 'dora', 'opp', 'dora', 'opp', 'enzo', 'opp', 'enzo'], 'Dora throws two, then Enzo two; the hammer team throws last');
  ok(m.results[0].blank && m.hammer === 0, 'a blank end keeps the hammer');
  m.nextEnd();
  // end 2: team 0 scores 1 by drawing the button with their last stone; the hammer passes to team 1
  for (let k = 0; k < 7; k++) m.play({ angle: 0, weight: 0.05, curl: 1 });
  m.play(C.drawTo(C.TEE, 0, 1));
  eq([m.results[1].scorer, m.results[1].points, m.hammer, m.score], [0, 1, 1, [1, 0]], 'scoring gives the hammer to the other team');
  m.nextEnd(); eq([m.turn, m.stones.length], [0, 0], 'the next end starts on a clear sheet with the other team first');
  for (let e = 2; e < 4; e++) { for (let k = 0; k < 8; k++) m.play({ angle: 0, weight: 0.05, curl: 1 }); m.nextEnd(); }
  ok(m.over && m.winner === 0 && m.end === 4, 'four ends and the leader wins');
  const t = new C.Match({ ends: 1, seed: 1, hammer: 0, noise: [{ v: 0, a: 0 }, { v: 0, a: 0 }] });
  for (let k = 0; k < 8; k++) t.play({ angle: 0, weight: 0.05, curl: 1 });
  ok(!t.over && t.extra, 'a tie after the last end goes to an extra end');
  t.nextEnd(); for (let k = 0; k < 7; k++) t.play({ angle: 0, weight: 0.05, curl: 1 }); t.play(C.drawTo(C.TEE, 0.2, -1));
  ok(t.over && t.winner === 0, 'the extra end decides it');
}

// ---- snapshot and restore mid-end
{
  const nz = [C.PLAYER_NOISE, { v: 0.02, a: 0.006 }];
  const m = new C.Match({ ends: 4, seed: 9, noise: nz });
  for (let k = 0; k < 3; k++) m.play(C.drawTo(C.TEE - 0.5 + k * 0.4, 0.3 * k, 1));
  const snap = JSON.parse(JSON.stringify(m.snapshot())), r = C.Match.restore(snap, nz);
  eq([r.end, r.thrown, r.turn, r.stones.length, r.rand.state()], [m.end, m.thrown, m.turn, m.stones.filter((s) => !s.out).length, m.rand.state()], 'a restored match carries on where it left off');
  m.play(C.drawTo(C.TEE, 0, 1)); r.play(C.drawTo(C.TEE, 0, 1));
  eq(m.stones.filter((s) => !s.out).map((s) => [s.x, s.y]), r.stones.map((s) => [s.x, s.y]), 'and plays on identically');
}

// ---- the drills
{
  eq(C.DRILLS.map((d) => d.id), ['draw', 'guard', 'come', 'hitroll', 'double'], 'five drills on the Practice Pond');
  const play = (id, shot) => { const d = C.DRILLS.find((x) => x.id === id), st = C.drillStones(d), s = C.newStone(0, 0, 'dora', 0, 0); st.push(s); C.launch(s, shot); C.settle(st, s); return C.drillStars(d, st, s); };
  eq(play('draw', C.drawTo(C.TEE, 0, 1)), 3, 'a button draw earns three stars');
  eq(play('draw', C.drawTo(C.TEE + 1.2, 0.5, 1)), 1, 'the back of the house earns one');
  eq(play('draw', { angle: 0, weight: 1, curl: 1 }), 0, 'through the house earns none');
  const g = C.DRILLS[1].setup[0];
  eq(play('guard', C.drawTo(C.HOG + 3.2, g.y * (C.HOG + 3.2) / g.x, -1)), 3, 'a guard on the line earns three stars');
  const h = C.DRILLS[3].setup[0];
  ok(play('hitroll', C.lineThrough(h.x, h.y, 0.86, 1)) >= 1, 'a hit removes their stone');
  for (const d of C.DRILLS) ok(d.name && d.teach && d.call && d.stars.length === 3, `drill ${d.id} has its words`);
}

// ---- the save
{
  eq(C.SAVE_KEY, 'sweep-slide-v1', 'the save key');
  eq(C.readSave(null), C.freshSave(), 'no save is a fresh save');
  for (const bad of ['{', '[]', '"x"', 'null', '{"v":2,"beaten":3}', '{"v":1,"beaten":"lots","wins":[1],"drills":{"draw":9,"x":"y"},"tips":"no","settings":7,"match":{"team":"x"}}'])
    { const s = C.readSave(bad); ok(s.beaten === 0 && s.match === null && !Object.keys(s.drills).length && Array.isArray(s.tips), `a corrupt save is ignored: ${bad}`); }
  const m = new C.Match({ ends: 4, seed: 3, noise: [C.PLAYER_NOISE, C.PLAYER_NOISE] }); m.play(C.drawTo(C.TEE, 0, 1));
  const good = { ...C.freshSave(), beaten: 3, wins: { hedgehog: 2 }, best: { hedgehog: 4 }, drills: { draw: 3 }, ended: true, tips: ['aim'], settings: { sound: false, music: true }, match: { team: 'badger', seed: 3, snap: m.snapshot() } };
  const back = C.readSave(JSON.stringify(good), ['hedgehog', 'badger']);
  eq([back.beaten, back.wins, back.drills, back.ended, back.settings, back.match?.team, back.match?.snap.thrown], [3, { hedgehog: 2 }, { draw: 3 }, true, { sound: false, music: true }, 'badger', 1], 'a good save reads back');
  const broken = JSON.parse(JSON.stringify(good)); broken.match.snap.stones[0].x = 'far';
  eq(C.readSave(JSON.stringify(broken)).match, null, 'a broken match in the save is dropped, the rest kept');
  eq(C.readSave(JSON.stringify(good), ['owl']).match, null, 'a match against an unknown team is dropped');
}

console.log(`curl: ${checks} checks passed`);
