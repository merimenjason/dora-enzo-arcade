// Neon Lane engine tests: the six Geylang signboards (lattice tubes, no dead ends, one drainpipe, mirrored starts),
// the circuits (every tube in one, each a mirrored chain with sparks, neighbours in different colours), determinism,
// running (buffered turns, instant reverse, a late turn still taken, stopping at a wall), sparks and circuits going
// dark, how cicaks see (only on lit tubes, close by or straight down a tube), the fuse and the dropped tail, the moth,
// being caught in one and two players, lights out and the next night, the run won, extra lives, how many cicaks come
// out each night, and the save. Run after compiling the engine into .checks/ (npm test does).
import assert from 'node:assert/strict';
import { NeonGame, Bot, NIGHTS, DT, OPP, HERO_SPEED, PTS, CATCH_PTS, LIFE_EVERY, LIVES, ASSIST_LIVES, CICAKS_OUT, TAIL_LIFE, TAIL_GRAB, GULP_TIME, LATE_TURN, freshSave, parseSave, record, canStart } from '../.checks/neon-game.js';
import { buildBoard, fullRows, W, H, N, TUBE, FUSE, DEN, MOTIF, cx, cy, step, mirrorCell, CIRCUIT_COLOURS } from '../.checks/neon-levels.js';

let n = 0, bad = 0; const ok = (name, fn) => { try { fn(); n++; console.log(`  ok ${name}`); } catch (e) { bad++; console.log(`  FAIL ${name}\n    ${e.message.split('\n').join('\n    ')}`); } };
const at = (x, y) => y * W + x;
const walkable = (b, c) => b.kind[c] === TUBE || b.kind[c] === FUSE;
const nbrs = (b, c) => [1, 2, 3, 4].map((d) => step(c, d)).filter((m) => m >= 0 && walkable(b, m));
/** a board with the cicaks all kept home, ready to play */
const quiet = (o = {}) => {
  const g = new NeonGame({ seed: 7, ...o });
  for (const c of g.cicaks) { c.mode = 'away'; }
  g.phase = 'play'; g.phaseT = 0;
  return g;
};
const run = (g, d, secs, d2 = 0) => { const ev = []; for (let k = 0; k < Math.round(secs / DT); k++) { g.step(d, d2); ev.push(...g.events); } return ev; };
/** put a cicak out on the tubes at a cell */
const cicak = (g, i, cell, mode = 'out') => { const c = g.cicaks[i]; Object.assign(c, { mode, cell, dir: 0, t: 0, think: 0, target: -1, lastSeen: -1, sees: false }); return c; };
const place = (h, cell) => Object.assign(h, { cell, dir: 0, t: 0, wish: 0 });

console.log('neon lane');

ok('six real Geylang eateries, in order up the lorongs, each with its own wall and sign', () => {
  assert.deepEqual(NIGHTS.map((x) => x.id), ['kopi', 'frog', 'turtle', 'satay', 'durian', 'crab']);
  assert.equal(new Set(NIGHTS.map((x) => x.wall)).size, 6);
  for (const x of NIGHTS) { assert.equal(x.motif, x.id); assert.ok(x.blurb.length > 60); assert.equal(x.left.length, H); }
  assert.match(NIGHTS[1].place, /235 Geylang Road/); assert.match(NIGHTS[2].place, /Lorong Bachok/);
  assert.match(NIGHTS[3].place, /27A/); assert.match(NIGHTS[4].place, /608 Geylang Road/); assert.match(NIGHTS[5].place, /Lorong 35/);
});

for (const night of NIGHTS) ok(`${night.id}: tubes on the lattice, no dead ends, all joined, one drainpipe, mirrored starts, four fuses`, () => {
  const b = buildBoard(night);
  const rows = fullRows(night.left);
  assert.equal(rows.length, H); for (const r of rows) assert.equal(r.length, W);
  for (const c of b.tubes) {
    assert.ok(!(cx(c) % 2 && cy(c) % 2), `tube off the lattice at ${cx(c)},${cy(c)}`);
    assert.ok(nbrs(b, c).length >= 2, `dead end at ${cx(c)},${cy(c)}`);
    assert.ok(walkable(b, mirrorCell(c)), 'the sign is symmetric');
  }
  const seen = new Set([b.tubes[0]]), q = [b.tubes[0]];
  while (q.length) for (const m of nbrs(b, q.pop())) if (!seen.has(m)) { seen.add(m); q.push(m); }
  assert.equal(seen.size, b.tubes.length, 'every tube is reachable');
  assert.equal(b.kind[b.den], DEN); assert.equal(cx(b.den), (W - 1) / 2);
  assert.equal([1, 2, 3, 4].filter((d) => { const m = step(b.den, d); return m >= 0 && walkable(b, m); }).length, 1, 'one way out of the drainpipe');
  assert.ok(walkable(b, b.door));
  assert.equal(b.starts[1], mirrorCell(b.starts[0]));
  assert.equal(b.fuses.length, 4);
  const m = b.motif; assert.ok(m.w >= 7 && m.h >= 5, 'room for the sign picture');
  for (let y = m.y; y < m.y + m.h; y++) for (let x = m.x; x < m.x + m.w; x++) assert.equal(b.kind[at(x, y)], MOTIF);
  assert.ok(b.tubes.length > 200 && b.tubes.length < 260);
});

for (const night of NIGHTS) ok(`${night.id}: circuits are mirrored chains with sparks, neighbours in different colours`, () => {
  const b = buildBoard(night), g = new NeonGame({ seed: 1, night: NIGHTS.indexOf(night) });
  const count = new Map();
  for (const k of b.circuits) for (const c of k.cells) count.set(c, (count.get(c) ?? 0) + 1);
  for (const c of b.tubes) { assert.equal(count.get(c), 1, `tube ${cx(c)},${cy(c)} in one circuit`); assert.equal(b.circuits[b.circuit[c]].cells.includes(c), true); }
  assert.ok(b.circuits.length >= 8 && b.circuits.length <= 20, `${b.circuits.length} circuits`);
  for (const k of b.circuits) {
    assert.ok(g.left[k.id] > 0, `circuit ${k.id} has sparks`);
    assert.equal(b.circuits[k.mirror].mirror, k.id); assert.equal(b.circuits[k.mirror].colour, k.colour);
    // contiguous: its cells join up, passing through other circuits' junctions only
    const set = new Set(k.cells), start = k.cells[0], got = new Set([start]), q = [start];
    while (q.length) { const c = q.pop(); for (const m of nbrs(b, c)) if (!got.has(m) && (set.has(m) || nbrs(b, m).length >= 3)) { got.add(m); q.push(m); } }
    for (const c of k.cells) assert.ok(got.has(c), `circuit ${k.id} is in one piece`);
  }
  for (const c of b.tubes) if (cx(c) !== (W - 1) / 2) assert.equal(b.circuit[mirrorCell(c)], b.circuits[b.circuit[c]].mirror, 'mirrored');
  let clash = 0;
  for (const c of b.tubes) for (const m of nbrs(b, c)) { const p = b.circuits[b.circuit[c]], q2 = b.circuits[b.circuit[m]]; if (p.id !== q2.id && p.mirror !== q2.id && p.colour === q2.colour) clash++; }
  assert.ok(clash <= 4, `${clash} same-colour touches`);
  assert.ok(b.circuits.every((k) => k.colour >= 0 && k.colour < CIRCUIT_COLOURS.length));
});

ok('a seed replays exactly', () => {
  const play = () => { const g = new NeonGame({ seed: 42, night: 2 }); const b = new Bot(g, 0, { seed: 3 }); for (let k = 0; k < 60 * 40 && !g.over; k++) g.step(b.decide()); return [g.score, g.sparksLeft, g.lives, g.cicaks.map((c) => c.cell + c.mode).join()]; };
  assert.deepEqual(play(), play());
});

ok('a chinchilla runs on until a wall, at 6.5 tubes a second, and stops there', () => {
  const g = quiet(); const h = g.heroes[0];
  place(h, at(0, 0)); run(g, 2, 1);
  assert.ok(Math.abs(cx(h.cell) + h.t - HERO_SPEED) < 0.2, `ran ${cx(h.cell) + h.t}`);
  run(g, 0, 4); assert.equal(h.cell, at(28, 0)); assert.equal(h.dir, 0, 'stopped at the corner wall');
});

ok('a turn pressed early waits for the junction; reversing is instant; a turn pressed just late still counts', () => {
  const g = quiet(); const h = g.heroes[0];
  place(h, at(0, 0)); run(g, 2, 0.05);
  g.step(3); // down is shut until column 6
  run(g, 0, 1.5);
  assert.equal(cx(h.cell), 6, 'turned down at the first junction that allows it'); assert.ok(cy(h.cell) >= 1);
  place(h, at(10, 0)); run(g, 2, 0.2); const before = g.pos(h).x;
  g.step(4); assert.equal(h.dir, 4); assert.ok(Math.abs(g.pos(h).x - before) < 0.2, 'turned on the spot');
  // just past the column-6 junction heading right, press down: snapped back onto the junction and turned
  place(h, at(6, 0)); h.dir = 2; h.t = LATE_TURN * 0.6; h.wish = 2; g.step(3);
  assert.equal(h.dir, 3); assert.equal(cx(h.cell), 6);
});

ok('eating every spark on a circuit turns it dark, warning when three are left', () => {
  const g = quiet(); const b = g.board; const h = g.heroes[0];
  const k = b.circuit[at(1, 0)];
  const cells = b.circuits[k].cells.filter((c) => g.spark[c]);
  let dark = 0, low = 0, score0 = g.score;
  for (const c of cells) { place(h, c); g.arrive(h); for (const e of g.events) { if (e.k === 'dark' && e.circuit === k) dark++; if (e.k === 'low' && e.circuit === k) low++; } g.events = []; }
  assert.equal(dark, 1); assert.equal(low, 1);
  assert.equal(g.left[k], 0); assert.equal(g.lit(cells[0]), false); assert.equal(g.lit(b.circuits.find((x) => x.id !== k && g.left[x.id] > 0).cells[0]), true);
  assert.equal(g.score - score0, cells.length * PTS.spark);
  assert.ok(b.circuits[k].cells.every((c) => !g.spark[c]));
});

ok('a cicak sees you only on a lit tube: close by, or straight down a tube', () => {
  const g = quiet(); const b = g.board; const h = g.heroes[0];
  const c = cicak(g, 0, at(0, 0)); // Chik, sight 6
  place(h, at(4, 0)); assert.equal(g.spots(c, h), true, 'four tubes away');
  place(h, at(9, 0)); assert.equal(g.spots(c, h), true, 'nine tubes straight along the top');
  place(h, at(12, 0)); assert.equal(g.spots(c, h), false, 'too far even in a straight line');
  place(h, at(6, 3)); assert.equal(g.spots(c, h), false, 'round a bend and too far');
  // darken the circuit under the chinchilla: now invisible even right next to the cicak
  place(h, at(2, 0)); g.left[b.circuit[at(2, 0)]] = 0;
  assert.equal(g.spots(c, h), false, 'on a dark tube');
  // and the cicak that lost it goes to where it last saw you
  g.left[b.circuit[at(2, 0)]] = 5; g.retarget(c); assert.equal(c.target, at(2, 0)); assert.equal(c.sees, true);
  g.left[b.circuit[at(2, 0)]] = 0; g.retarget(c); assert.equal(c.sees, false); assert.equal(c.target, at(2, 0), 'heads for the last sighting');
});

ok('cicaks crawl dark tubes at 60%, panic at 55%, run home as a stub at 160%; Lulu is quicker', () => {
  const g = quiet(); const b = g.board;
  const c = cicak(g, 0, at(0, 0)); const lit = g.cicakSpeed(c);
  g.left[b.circuit[at(0, 0)]] = 0; assert.ok(Math.abs(g.cicakSpeed(c) / lit - 0.6) < 1e-9);
  c.mode = 'scared'; assert.ok(Math.abs(g.cicakSpeed(c) / lit - 0.55) < 1e-9);
  c.mode = 'stub'; assert.ok(Math.abs(g.cicakSpeed(c) / lit - 1.6) < 1e-9);
  const l = cicak(g, 3, at(1, 6)); assert.equal(l.kind, 'lulu'); assert.ok(g.cicakSpeed(l) > lit);
  const hard = quiet({ assist: false }); assert.ok(hard.cicakSpeed(cicak(hard, 0, at(1, 6))) > lit, 'gentle cicaks are slower');
});

ok('a fuse panics the cicaks; catches score 250, 500; each drops a tail (grabbed only on doubling back) and runs home to regrow it', () => {
  const g = quiet(); const b = g.board; const h = g.heroes[0];
  const fuse = b.fuses[0]; place(h, fuse);
  const a = cicak(g, 0, step(fuse, 1)), c2 = cicak(g, 1, at(20, 0));
  g.arrive(h);
  assert.ok(g.events.some((e) => e.k === 'fuse')); assert.ok(g.fuseT >= 7);
  assert.equal(a.mode, 'scared'); assert.equal(c2.mode, 'scared'); assert.equal(g.fuseLeft[fuse], 0);
  a.cell = fuse; a.t = 0; g.events = []; g.touches();
  const caught = g.events.find((e) => e.k === 'catch');
  assert.ok(caught); assert.equal(caught.pts, CATCH_PTS[0]); assert.equal(a.mode, 'stub'); assert.equal(a.tail, false);
  assert.equal(g.tails.length, 1);
  place(h, c2.cell); g.events = []; g.touches();
  assert.equal(g.events.find((e) => e.k === 'catch').pts, CATCH_PTS[1]);
  // the tail is a bonus while it wriggles, but while it still thrashes, running straight on through it misses it
  const tl = g.tails[0]; place(h, tl.cell); let s0 = g.score; g.arrive(h); assert.equal(g.score - s0, 0); assert.ok(tl.t > 0);
  tl.t = TAIL_LIFE - TAIL_GRAB; s0 = g.score; g.arrive(h); assert.equal(g.score - s0, PTS.tail); assert.equal(g.st.tails, 1);
  // the stub goes home, sits in the drainpipe, and comes out again with a tail
  place(h, at(0, 14)); h.wish = 0;
  let home = false, out = false;
  for (let k = 0; k < 60 * 20; k++) { g.step(0); if (a.mode === 'home') home = true; if (home && a.mode !== 'home') { out = true; break; } }
  assert.ok(home && out); assert.equal(a.tail, true);
  assert.ok(TAIL_LIFE > 0);
});

ok('the fuse wears off and the cicaks hunt again', () => {
  const g = quiet(); const h = g.heroes[0]; place(h, g.board.fuses[0]);
  cicak(g, 0, at(28, 14)); g.arrive(h);
  const ev = run(g, 0, g.fuseT + 0.1);
  assert.ok(ev.some((e) => e.k === 'calm')); assert.equal(g.cicaks[0].mode, 'out'); assert.equal(g.chain, 0);
});

ok('caught in one-player: a life gone, everyone back to the start, the cicaks back in the drainpipe', () => {
  const g = quiet({ assist: false }); const h = g.heroes[0];
  assert.equal(g.lives, LIVES);
  place(h, at(4, 0)); cicak(g, 0, at(4, 0));
  g.touches(); assert.equal(g.lives, LIVES - 1); assert.equal(g.phase, 'dying'); assert.equal(h.state, 'zap');
  run(g, 0, 2.2); assert.equal(g.phase, 'ready'); assert.equal(h.cell, g.board.starts[0]);
  assert.ok(g.cicaks.filter((c) => c.mode !== 'away').every((c) => c.mode === 'home'));
});

ok('out of lives: the run is over', () => {
  const g = quiet({ assist: false }); const h = g.heroes[0]; g.lives = 1;
  place(h, at(4, 0)); cicak(g, 0, at(4, 0)); g.touches();
  const ev = run(g, 0, 2.5); assert.ok(ev.some((e) => e.k === 'lose')); assert.equal(g.over, 'lose');
});

ok('two players: the caught one comes back at its start, safe for a moment, while the other runs on', () => {
  const g = quiet({ twoP: true }); const [a, b2] = g.heroes;
  assert.equal(a.id, 'dora'); assert.equal(b2.id, 'enzo'); assert.equal(b2.cell, g.board.starts[1]);
  place(a, at(4, 0)); place(b2, at(20, 14)); cicak(g, 0, at(4, 0));
  g.touches(); assert.equal(a.state, 'zap'); assert.equal(g.phase, 'play');
  run(g, 0, 0.5, 2); assert.equal(b2.state, 'run'); assert.ok(b2.cell !== at(20, 14), 'the other one keeps running');
  g.cicaks[0].mode = 'away';
  const ev = run(g, 0, 3.2); assert.ok(ev.some((e) => e.k === 'respawn' && e.hero === 0));
  assert.equal(a.state, 'run'); assert.equal(a.cell, g.board.starts[0]); assert.ok(a.safe > 0);
  // a safe chinchilla walks through a cicak
  cicak(g, 0, a.cell); const lives = g.lives; g.touches(); assert.equal(g.lives, lives);
});

ok('a moth lands at 30% eaten; a chinchilla eats it for 300 x the night, a cicak gulps it and sits still', () => {
  const g = quiet({ night: 1 }); const h = g.heroes[0];
  const sparks = g.board.tubes.filter((c) => g.spark[c]);
  for (const c of sparks.slice(0, Math.ceil(sparks.length * 0.3))) { g.spark[c] = 0; g.left[g.board.circuit[c]]--; g.sparksLeft--; }
  const ev = run(g, 0, 0.05); assert.ok(ev.some((e) => e.k === 'moth')); assert.ok(g.moth && g.lit(g.moth.cell));
  const s0 = g.score; place(h, g.moth.cell); g.arrive(h); assert.equal(g.score - s0, PTS.moth * 2); assert.equal(g.moth, null);
  g.spawnMoth(); const c = cicak(g, 0, g.moth.cell); c.target = g.moth.cell; place(h, at(0, 14));
  run(g, 0, 0.05); assert.equal(c.mode, 'gulp'); assert.equal(g.moth, null);
  run(g, 0, GULP_TIME + 0.1); assert.equal(c.mode, 'out');
});

ok('lights out: a night bonus, then the next night when the page says so; the sixth wins the run', () => {
  const g = quiet(); const h = g.heroes[0];
  for (const c of g.board.tubes) if (g.spark[c]) { g.spark[c] = 0; g.left[g.board.circuit[c]]--; g.sparksLeft--; }
  const s0 = g.score; const ev = run(g, 0, 0.05);
  assert.ok(ev.some((e) => e.k === 'clear')); assert.equal(g.score - s0, PTS.night);
  run(g, 0, 3); assert.equal(g.phase, 'cleared'); assert.equal(g.stats().reached, 1);
  g.advance(); assert.equal(g.night, 1); assert.equal(g.phase, 'ready'); assert.ok(g.sparksLeft > 200);
  const last = quiet({ night: 5 });
  for (const c of last.board.tubes) if (last.spark[c]) { last.spark[c] = 0; last.left[last.board.circuit[c]]--; last.sparksLeft--; }
  run(last, 0, 3); last.advance(); assert.equal(last.over, 'win'); assert.equal(last.stats().won, true);
  void h;
});

ok('an extra life every 8000 points', () => {
  const g = quiet(); const l = g.lives; g.add(LIFE_EVERY - 10); assert.equal(g.lives, l); g.add(20); assert.equal(g.lives, l + 1);
  g.add(LIFE_EVERY); assert.equal(g.lives, l + 2);
});

ok('two cicaks on night 1, three on nights 2 and 3, four after; gentle cicaks keep it to three', () => {
  const outOn = (night, assist) => new NeonGame({ seed: 1, night, assist }).cicaks.filter((c) => c.mode !== 'away').map((c) => c.kind).sort().join();
  assert.deepEqual(CICAKS_OUT, [2, 3, 3, 4, 4, 4]);
  assert.equal(outOn(0, true), 'chik,lulu'); assert.equal(outOn(1, true), 'chak,chik,lulu');
  assert.equal(outOn(3, false), 'chak,chik,lulu,tokek'); assert.equal(outOn(3, true), 'chak,chik,tokek');
  assert.equal(new NeonGame({ seed: 1, assist: true }).lives, ASSIST_LIVES);
});

ok('cicaks leave the drainpipe one at a time and never turn back without cause', () => {
  const g = new NeonGame({ seed: 5, night: 3, assist: false });
  const rel = []; for (let k = 0; k < 60 * 20; k++) { g.step(0); for (const e of g.events) if (e.k === 'release') rel.push([e.cicak, g.t]); }
  assert.equal(rel.length, 4);
  for (let i = 1; i < rel.length; i++) assert.ok(rel[i][1] - rel[i - 1][1] > 3);
  assert.equal(OPP[1], 3);
});

ok('the save keeps the best score and the furthest night; old or broken saves are ignored', () => {
  const s = freshSave(); assert.equal(s.assist, true); assert.equal(canStart(s, 0), true); assert.equal(canStart(s, 1), false);
  const r = record(s, { score: 5000, reached: 2, won: false }); assert.equal(r.best, 5000); assert.equal(r.reached, 2); assert.equal(canStart(r, 2), true);
  assert.equal(record(r, { score: 100, reached: 0, won: false }).best, 5000);
  assert.equal(record(r, { score: 1, reached: 3, won: true }).reached, 5);
  assert.deepEqual(parseSave(JSON.stringify(r)), r);
  assert.equal(parseSave('{"v":2}'), null); assert.equal(parseSave('nope'), null); assert.equal(parseSave(null), null);
  assert.equal(parseSave(JSON.stringify({ v: 1, reached: 99 })).reached, 5);
  assert.ok(N === W * H);
});

console.log(`neon lane: ${n} passed${bad ? `, ${bad} failed` : ''}`);
if (bad) process.exit(1);
