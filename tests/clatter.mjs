// Clatterbox engine checks: the physics (stacks stand still, nothing gains energy, dominoes topple, hinges and ropes
// hold, a run replays exactly), what every part does (ramps roll marbles, springs bounce, seesaws fling, fans and
// bellows push light things, cars drive, balloons rise and pop, scissors snip, candles burn, trapdoors open, pulleys
// lift, bells ring, hedgehogs wake, sparrows eat, lanterns light, trains toot), goals and the bonus button, where
// parts may go, every puzzle's own solution solving it while no puzzle solves itself, stars, unlocking, and saving,
// corrupt saves included.
import assert from 'node:assert/strict';
import { World, Body, box, circle, overlap, DT, GRAVITY } from '../.checks/clatter-physics.js';
import {
  PUZZLES, PUZZLE_IDS, ROOMS, FREE, PARTS, GOAL_PARTS, SAVE_KEY, SETTLES, SANDBOX_MAX, Run, simulate, buildWorld, placeProblem, placeBox, settle, snap, turn,
  freshSave, readSave, readPlace, starBits, starCount, totalStars, done, roomOpen, puzzleOpen, roomCount, freeOpen, freeParts, freePuzzle, nextPuzzle, recordRun, trayLeft,
} from '../.checks/clatter-game.js';

let checks = 0;
const soft = process.env.SOFT === '1', fails = [];
const ok = (cond, msg) => { if (soft && !cond) { fails.push(msg); return; } assert.ok(cond, msg); checks++; };
const eq = (a, b, msg) => { if (soft) { try { assert.deepEqual(a, b, msg); } catch { fails.push(msg + ' ' + JSON.stringify(a)?.slice(0, 160)); return; } } assert.deepEqual(a, b, msg); checks++; };
const P = (p, x, y, r = 0, f = 0) => ({ p, x, y, r, f });
/** A bare puzzle: a 12 × 7 box with these fixed parts, a build area over all of it, and no button. */
const bare = (items, extra = {}) => ({ id: 't', room: 0, n: 0, name: 't', line: '', after: '', W: 12, H: 7, items, tray: {}, zones: [[0, 0, 12, 7]], token: null, par: 1, sol: [], ...extra });
const shelf = (x, y, w, r = 0, h = 0.26) => ({ p: 'shelf', x, y, w, h, r });
const run = (puz, places = [], secs = 6) => { const r = new Run(puz, places); const n = Math.round(secs / DT); for (let i = 0; i < n; i++) r.step(); return r; };
const partAt = (r, p, k = 0) => r.B.parts.filter((q) => q.p === p)[k];
const allEv = (puz, places, secs = 8) => { const r = new Run(puz, places), out = []; const n = Math.round(secs / DT); for (let i = 0; i < n; i++) { r.step(); out.push(...r.take()); } return { r, ev: out }; };

// ---------------------------------------------------------------- the physics
{
  // a stack of three boxes on the floor stands still
  const w = new World(); w.add([box(20, 1)], { isStatic: true }, 0, -0.5);
  const bs = [0.25, 0.75, 1.25].map((y) => w.add([box(0.72, 0.5)], { density: 1, friction: 0.6 }, 0, y));
  for (let i = 0; i < 600; i++) w.step();
  ok(bs.every((b, i) => Math.abs(b.x) < 0.02 && Math.abs(b.y - (0.25 + i * 0.5)) < 0.03 && Math.abs(b.a) < 0.02), 'a stack of boxes stands still for ten seconds');
  ok(w.motion() < 0.01, 'and is at rest');
}
{
  // a ball dropped never bounces higher than it fell from, and settles
  const w = new World(); w.add([box(20, 1)], { isStatic: true }, 0, -0.5);
  const b = w.add([circle(0.22)], { density: 4, restitution: 0.3, friction: 0.35 }, 0, 4);
  const e0 = w.energy(); let top = 0, fell = false, worst = 0;
  for (let i = 0; i < 600; i++) { w.step(); if (b.vy < -1) fell = true; if (fell && b.vy > 0) top = Math.max(top, b.y); worst = Math.max(worst, w.energy() - e0); }
  ok(top < 4 * 0.5, `a dropped marble bounces lower than it fell (${top.toFixed(2)})`);
  ok(worst <= 0.02 * Math.abs(e0) + 1e-6, 'and the world never gains energy');
  ok(Math.abs(b.y - 0.22) < 0.02, 'and comes to rest on the floor');
  ok(Math.abs(GRAVITY - 26) < 1e-9 && Math.abs(DT - 1 / 60) < 1e-12, 'gravity and the step are fixed');
}
{
  // a domino pushed at the top topples into the next, which topples too
  const puz = bare([{ p: 'domino', x: 4, y: 0.6 }, { p: 'domino', x: 4.9, y: 0.6 }, { p: 'domino', x: 5.8, y: 0.6 }, shelf(1.5, 1.5, 3), { p: 'marble', x: 1.5, y: 1.85, v: [4, 0] }]);
  const r = run(puz, [], 4);
  ok(r.B.parts.filter((q) => q.p === 'domino').every((q) => Math.abs(q.body.a) > 1.0), 'a marble knocks the first domino and the row topples');
  const s = run(bare([{ p: 'domino', x: 4, y: 0.6 }, { p: 'domino', x: 4.9, y: 0.6 }]), [], 4);
  ok(s.B.parts.every((q) => Math.abs(q.body.a) < 0.01), 'standing dominoes left alone stay standing');
}
{
  // a hinge holds its pin in place; a rope never stretches past its length
  const w = new World(), g = w.add([], { isStatic: true });
  const arm = w.add([box(0.14, 1.6)], { density: 1 }, 0, 4.2); const j = w.hinge(g, arm, 0, 5);
  arm.vx = 3;
  let worst = 0;
  for (let i = 0; i < 400; i++) { w.step(); const [ax, ay, bx, by] = w.ends(j); worst = Math.max(worst, Math.hypot(ax - bx, ay - by)); }
  ok(worst < 0.03, `a hinged arm stays on its pin (${worst.toFixed(3)})`);
  const w2 = new World(), g2 = w2.add([], { isStatic: true });
  const bob = w2.add([box(0.72, 0.5)], { density: 1 }, 1, 3); const rp = w2.rope(g2, 0, 5, bob, 1, 3.25);
  let longest = 0;
  for (let i = 0; i < 400; i++) { w2.step(); const [ax, ay, bx, by] = w2.ends(rp); longest = Math.max(longest, Math.hypot(ax - bx, ay - by)); }
  ok(longest < rp.len + 0.03, `a rope holds its length (${longest.toFixed(3)} of ${rp.len.toFixed(3)})`);
  ok(bob.y > 2.4, 'and holds its weight up');
}
{
  // the same placements replay the same way, step for step
  for (const id of ['1-5', '3-6', '5-6']) {
    const puz = PUZZLES[id], a = new Run(puz, puz.sol), b = new Run(puz, puz.sol);
    let same = true;
    for (let i = 0; i < 600; i++) { a.step(); b.step(); if (a.B.world.bodies.some((x, k) => x.x !== b.B.world.bodies[k].x || x.y !== b.B.world.bodies[k].y || x.a !== b.B.world.bodies[k].a)) { same = false; break; } }
    ok(same, `${id} replays exactly`);
    eq(simulate(puz, puz.sol), simulate(puz, puz.sol), `${id}: two simulations agree`);
    eq(a.trails, b.trails, `${id}: and leave the same trail`);
  }
}

// ---------------------------------------------------------------- the parts
{
  // a marble rolls down a ramp and off its low end
  const r = run(bare([{ p: 'marble', x: 1.2, y: 5.6 }]), [P('ramp', 2, 4.8, -2)], 2);
  ok(r.B.parts[0].body.x > 3, 'a marble rolls down a ramp');
}
{
  // a spring throws what lands on it
  const { r, ev } = allEv(bare([{ p: 'marble', x: 3, y: 4 }]), [P('spring', 3, 0.15)], 1.2);
  ok(ev.some((e) => e.k === 'boing'), 'a spring goes boing');
  let top = 0; for (let i = 0; i < 30; i++) { r.step(); top = Math.max(top, r.B.parts[0].body.y); }
  ok(r.B.parts[0].body.vy > 0 || top > 1.5, 'and throws the marble back up');
  const tilted = run(bare([{ p: 'marble', x: 3, y: 3 }]), [P('spring', 3, 0.15, -3)], 1.5);
  ok(tilted.B.parts[0].body.x > 4.5, 'a turned spring aims the bounce');
}
{
  // a seesaw: drop a marble on its high end and an acorn on the low end flies up
  const puz = bare([{ p: 'marble', x: 2.0, y: 4.5 }, { p: 'acorn', x: 4.3, y: 1.0 }]);
  const r = new Run(puz, [P('seesaw', 3.1, 0.6)]); let top = 0;
  for (let i = 0; i < 120; i++) { r.step(); top = Math.max(top, r.B.parts[1].body.y); }
  ok(top > 2.2, `a marble on the seesaw flings the acorn (${top.toFixed(2)})`);
}
{
  // a fan blows an acorn along but hardly moves a marble
  const puz = bare([{ p: 'acorn', x: 2.5, y: 0.26 }, { p: 'marble', x: 2.5, y: 2.6 }, shelf(4, 2.25, 6)]);
  const r = run(puz, [P('fan', 1.2, 0.45)], 2);
  ok(r.B.parts[0].body.x > 4, 'a fan blows an acorn along');
  ok(Math.abs(r.B.parts[1].body.x - 2.5) < 0.6, 'but a marble out of its stream stays');
  const flipped = run(bare([{ p: 'acorn', x: 6, y: 0.26 }]), [P('fan', 7.3, 0.45, 0, 1)], 2);
  ok(flipped.B.parts[0].body.x < 5, 'a flipped fan blows the other way');
}
{
  // bellows puff when something drops on them
  const { r, ev } = allEv(bare([{ p: 'marble', x: 2, y: 3 }, { p: 'acorn', x: 3.2, y: 0.26 }]), [P('bellows', 2, 0.28)], 2.5);
  ok(ev.some((e) => e.k === 'puff'), 'a marble dropped on the bellows makes it puff');
  ok(r.B.parts[1].body.x > 4, 'and the puff pushes the acorn');
  const quiet = allEv(bare([{ p: 'acorn', x: 3.2, y: 0.26 }]), [P('bellows', 2, 0.28)], 2);
  ok(!quiet.ev.some((e) => e.k === 'puff'), 'bellows left alone never puff');
}
{
  // a wind-up car waits until bumped, then drives the way it faces
  const still = run(bare([]), [P('car', 3, 0.35)], 2);
  ok(Math.abs(partAt(still, 'car').body.x - 3) < 0.05, 'a car waits');
  const { r, ev } = allEv(bare([{ p: 'marble', x: 2.9, y: 2.5 }]), [P('car', 3, 0.35)], 3);
  ok(ev.some((e) => e.k === 'vroom') && partAt(r, 'car').body.x > 5, 'bumped, it drives right');
  const left = run(bare([{ p: 'marble', x: 6.1, y: 2.5 }]), [P('car', 6, 0.35, 0, 1)], 3);
  ok(partAt(left, 'car').body.x < 4.5, 'flipped, it drives left');
}
{
  // a balloon rises to the lid, pops on a pin, and lets its acorn fall
  const up = run(bare([{ p: 'balloon', x: 4, y: 1.5 }]), [], 3);
  ok(partAt(up, 'balloon').body.y > 5.5, 'a balloon rises');
  const { r, ev } = allEv(bare([{ p: 'balloon', x: 4, y: 1.5 }, { p: 'acorn', x: 4, y: 0.27 }, { p: 'string', x: 4, y: 1.08, from: 0, to: 1, at: [0, 0.2] }]), [P('pin', 4, 5.5, 12)], 4);
  ok(ev.some((e) => e.k === 'pop') && partAt(r, 'balloon').gone, 'it pops on a pin');
  ok(partAt(r, 'acorn').body.y < 1, 'and lets its acorn drop');
}
{
  // scissors knocked swinging snip a string; left alone they don't
  const items = [{ p: 'block', x: 6.4, y: 1.5 }, { p: 'string', x: 6.4, y: 7, to: 0 }, shelf(3, 2.4, 6), { p: 'marble', x: 1, y: 2.75, v: [5, 0] }];
  const { r, ev } = allEv(bare(items), [P('scissors', 5.2, 4.4)], 4);
  ok(ev.some((e) => e.k === 'snip') && r.B.strings[0].j.off, 'a marble knocks the scissors and they snip the string');
  ok(partAt(r, 'block').body.y < 0.3, 'and what hung on it drops');
  const calm = allEv(bare(items.slice(0, 3)), [P('scissors', 5.2, 4.4)], 3);
  ok(!calm.r.B.strings[0].j.off, 'scissors left alone snip nothing');
}
{
  // a candle burns through a string after a moment, and pops a balloon
  const { r, ev } = allEv(bare([{ p: 'block', x: 6, y: 3 }, { p: 'string', x: 4, y: 7, to: 0 }]), [P('candle', 5.05, 4.4)], 3);
  ok(ev.some((e) => e.k === 'burn') && r.B.strings[0].j.off, 'a candle burns a string through');
  const pop = allEv(bare([{ p: 'balloon', x: 4.3, y: 1.3 }]), [P('candle', 4, 0.4)], 1);
  ok(pop.ev.some((e) => e.k === 'pop'), 'and pops a balloon by its flame');
}
{
  // a trapdoor held by a string swings open when the string goes
  const items = [{ p: 'trapdoor', x: 7, y: 3, f: 1 }, { p: 'acorn', x: 6.2, y: 3.4 }, { p: 'string', x: 6, y: 6.5, to: 0, at: [-0.95, 0] }];
  const held = run(bare(items), [], 2);
  ok(partAt(held, 'acorn').body.y > 3, 'a trapdoor on its string holds an acorn');
  const r = run(bare(items), [P('candle', 5.75, 4.6)], 4);
  ok(partAt(r, 'acorn').body.y < 1, 'burn the string and it swings open');
}
{
  // a pulley: something heavy in the bucket sends it down and the weight up
  const items = [{ p: 'pulley', x: 6, y: 6.4, d1: 3.2, d2: 4.6 }, shelf(6.7, 1.4, 1.2, 0, 0.2)];
  const r0 = run(bare(items), [], 2), q0 = partAt(r0, 'pulley');
  const y0 = q0.body.y;
  const r = run(bare([...items, { p: 'marble', x: 5.3, y: 5.4 }]), [], 3), q = partAt(r, 'pulley');
  ok(q.body.y < y0 - 1, `a marble in the bucket brings it down (${y0.toFixed(2)} → ${q.body.y.toFixed(2)})`);
  ok(q.extra[0].y > 2.5, 'and the weight up');
}
{
  // the goals: bells ring, hedgehogs wake, sparrows eat acorns (and only acorns), lanterns light, trains toot
  const bell = allEv(bare([{ p: 'bell', x: 6, y: 1.0 }, { p: 'marble', x: 3, y: 0.22, v: [5, 0] }]), [], 3);
  ok(bell.r.won && bell.ev.some((e) => e.k === 'ring'), 'a marble rings the bell');
  const hog = run(bare([{ p: 'hedgehog', x: 6, y: 0 }, { p: 'marble', x: 3, y: 0.22, v: [4, 0] }]), [], 3);
  ok(hog.won && partAt(hog, 'hedgehog').hitAt > 0, 'a marble wakes the hedgehog');
  const bowlM = run(bare([{ p: 'bowl', x: 6, y: 0 }, { p: 'marble', x: 6, y: 2 }]), [], 3);
  ok(!bowlM.won, 'a marble in the bowl is not breakfast');
  const bowlA = run(bare([{ p: 'bowl', x: 6, y: 0 }, { p: 'acorn', x: 6, y: 2 }]), [], 3);
  ok(bowlA.won, 'an acorn in the bowl is');
  const lamp = run(bare([{ p: 'lantern', x: 6, y: 0 }, { p: 'block', x: 6.6, y: 3 }]), [], 3);
  ok(lamp.won, 'a matchbox on its switch lights the lantern');
  const train = run(bare([{ p: 'train', x: 7, y: 0, f: 1 }]), [P('car', 3, 0.35)], 1);
  ok(!train.won, 'the train waits for its cord');
  const train2 = run(bare([{ p: 'train', x: 9, y: 0, f: 1 }, { p: 'marble', x: 2.9, y: 2.5 }]), [P('car', 3, 0.35)], 5);
  ok(train2.won, 'a wind-up car pulls the night train’s cord');
  // all goals, not just one
  const two = run(bare([{ p: 'bell', x: 6, y: 1.0 }, { p: 'hedgehog', x: 1, y: 0 }, { p: 'marble', x: 3, y: 0.22, v: [5, 0] }]), [], 3);
  ok(two.goalHit[0] && !two.won, 'a puzzle with two goals is not won with one');
}
{
  // the bonus button: touched by anything moving, and not by what starts on it
  const puz = bare([{ p: 'marble', x: 2, y: 0.22, v: [4, 0] }], { token: [6, 0.4] });
  const r = run(puz, [], 3); ok(r.token, 'a marble rolling over the button takes it');
  const r2 = run(bare([{ p: 'marble', x: 2, y: 0.22 }], { token: [6, 0.4] }), [], 3); ok(!r2.token, 'the button waits otherwise');
  eq(placeProblem(puz, [], P('domino', 6, 0.6)), 'bump', 'nothing may be placed over the button');
}

// ---------------------------------------------------------------- where parts may go
{
  const puz = bare([{ p: 'bell', x: 6, y: 3.6 }, shelf(3, 2, 3)], { zones: [[1, 0, 9, 6]] });
  eq(placeProblem(puz, [], P('ramp', 5, 5)), null, 'a ramp in the build area fits');
  eq(placeProblem(puz, [], P('ramp', 9.5, 5)), 'zone', 'outside it does not');
  eq(placeProblem(puz, [], P('ramp', 3, 2)), 'bump', 'nor on top of a shelf');
  eq(placeProblem(puz, [], P('domino', 6.2, 2.9)), 'bump', 'nor against a goal');
  eq(placeProblem(puz, [P('ramp', 5, 5)], P('ramp', 5, 5)), 'bump', 'nor on another placed part');
  eq(placeProblem(puz, [P('ramp', 5, 5)], P('ramp', 5, 5), 0), null, 'unless it is the part being moved');
  const s = settle(puz, [], P('domino', 3, 4)); ok(s && Math.abs(s.y - (2.13 + 0.6)) < 0.03, 'a dropped domino settles onto the shelf');
  const f = settle(puz, [], P('domino', 7.5, 4)); ok(f && Math.abs(f.y - 0.6) < 0.03, 'or the floor');
  eq(snap(1.13), 1.25, 'positions snap to a quarter');
  const [x0, , x1] = placeBox(P('ramp', 5, 5)); ok(Math.abs(x1 - x0 - 2.4) < 0.01, 'a flat ramp is 2.4 long');
  const [dx, dy] = turn(1, 0, 6); ok(Math.abs(dx) < 1e-9 && Math.abs(dy - 1) < 1e-9, 'six turns is a right angle');
  ok(SETTLES.includes('domino') && !SETTLES.includes('ramp'), 'standing parts settle; ramps hang where they are put');
  eq(trayLeft(PUZZLES['1-3'], [P('domino', 5, 2)]), { domino: 0, ramp: 1 }, 'the tray counts down as parts are placed');
}

// ---------------------------------------------------------------- the puzzles
{
  eq(PUZZLE_IDS.length, 30, 'thirty puzzles');
  eq(ROOMS.length, 5, 'in five rooms');
  ok(ROOMS.every((r) => r.puzzles.length === 6), 'six to a room');
  const sols = JSON.parse((await import('node:fs')).readFileSync(new URL('./clatter-solutions.json', import.meta.url), 'utf8'));
  const seen = new Set(['marble', 'acorn', 'domino', 'ramp']);
  for (const id of PUZZLE_IDS) {
    const puz = PUZZLES[id];
    ok(puz.items.some((it) => GOAL_PARTS.includes(it.p)), `${id} has a goal`);
    ok(puz.par >= 1 && puz.par <= Object.values(puz.tray).reduce((a, b) => a + b, 0), `${id}: par fits in the tray`);
    const empty = simulate(puz, []);
    ok(!empty.win && !empty.token, `${id}: the starting layout alone does not solve it`);
    eq(puz.sol.length, puz.par, `${id}: its solution uses par parts`);
    puz.sol.forEach((pl, i) => eq(placeProblem(puz, puz.sol.slice(0, i), pl), null, `${id}: solution part ${i + 1} is a legal placement`));
    const left = trayLeft(puz, puz.sol); ok(Object.values(left).every((n) => n >= 0), `${id}: from its tray`);
    const s = simulate(puz, puz.sol);
    ok(s.win, `${id}: its solution solves it`);
    ok(s.token, `${id}: and takes the button`);
    eq(sols[id]?.sol, puz.sol, `${id}: matches the recorded bot solution`);
    if (puz.tip) for (const k of Object.keys(puz.tray)) seen.add(k);
    for (const k of Object.keys(puz.tray)) ok(seen.has(k) || puz.room === 4, `${id}: ${k} was taught before it is used`);
    for (const k of Object.keys(puz.tray)) seen.add(k);
  }
  ok(PUZZLES['5-6'].W > 16 && PUZZLES['5-6'].items.filter((it) => GOAL_PARTS.includes(it.p)).length >= 3, 'the finale is one big board with three acts');
  ok(PUZZLE_IDS.filter((id) => PUZZLES[id].room === 4).every((id) => PUZZLES[id].W >= 16), 'the Big Show’s boards are bigger');
  ok(FREE.zones.length === 1 && FREE.token === null, 'the free build is one big empty box');
}

// ---------------------------------------------------------------- stars, unlocking and saving
{
  eq(starBits(true, 1, 1, true), 7, 'solved, at par, with the button: three stars');
  eq(starBits(true, 3, 2, false), 1, 'over par without the button: one');
  eq(starBits(false, 1, 1, true), 0, 'unsolved: none');
  eq(starCount(5), 2, 'stars counted from bits');
  const s = freshSave();
  ok(roomOpen(s, 0) && !roomOpen(s, 1), 'the first room is open, the second shut');
  ok(puzzleOpen(s, '1-1') && !puzzleOpen(s, '1-2'), 'the first puzzle is open');
  ok(!freeOpen(s), 'the free build waits');
  eq(nextPuzzle(s), '1-1', 'start at the beginning');
  const r1 = recordRun(s, '1-1', 7, 1, PUZZLES['1-1'].sol);
  ok(r1.first && r1.newStars === 3 && !r1.finale, 'a first solve with three stars');
  ok(puzzleOpen(s, '1-2') && !puzzleOpen(s, '1-4'), 'opens the next puzzle');
  recordRun(s, '1-2', 1, 3, []); ok(puzzleOpen(s, '1-4'), 'two done opens the one after the next too');
  const r2 = recordRun(s, '1-1', 1, 2, []);
  ok(!r2.first && r2.newStars === 0 && s.puzzles['1-1'].stars === 7 && s.puzzles['1-1'].best === 1, 'a worse rerun keeps the best');
  for (const id of ROOMS[0].puzzles) recordRun(s, id, 3, 1, []);
  ok(roomOpen(s, 1) && freeOpen(s) && roomCount(s, 0) === 6, 'finishing the kitchen opens the toy box and the free build');
  ok(freeParts(s).includes('spring') && !freeParts(s).includes('candle'), 'the free build offers the parts met so far');
  ok(Object.values(freePuzzle(s).tray).every((n) => n >= 1), 'with some of each');
  for (const id of PUZZLE_IDS.slice(0, -1)) recordRun(s, id, 1, 2, []);
  const fin = recordRun(s, '5-6', 7, 3, PUZZLES['5-6'].sol);
  ok(fin.finale && s.ended, 'the finale ends the game');
  ok(totalStars(s) >= 30 && done(s, '5-6'), 'stars add up');
  // round trip
  const back = readSave(JSON.stringify(s));
  eq(back, s, 'a save reads back the same');
  eq(SAVE_KEY, 'clatterbox-v1', 'saved under clatterbox-v1');
  // corrupt saves
  eq(readSave(null), freshSave(), 'no save: a fresh one');
  eq(readSave('{not json'), freshSave(), 'broken JSON: a fresh one');
  eq(readSave('[]'), freshSave(), 'the wrong shape: a fresh one');
  eq(readSave(JSON.stringify({ v: 2, puzzles: { '1-1': { done: true } } })), freshSave(), 'a different version: a fresh one');
  const odd = readSave(JSON.stringify({ v: 1, puzzles: { '1-1': { done: 'yes', stars: 99, best: -4, lay: [{ p: 'rocket', x: 1, y: 1 }, { p: 'ramp', x: 'a' }, { p: 'ramp', x: 2, y: 3, r: 2, f: 0 }] }, '9-9': { done: true }, 'nope': 5 }, ended: 'yes', free: new Array(40).fill({ p: 'marble', x: 1, y: 1, r: 0, f: 0 }), settings: { sound: 0, music: false } }));
  ok(!odd.puzzles['9-9'] && !odd.puzzles.nope, 'unknown puzzles are dropped');
  ok(odd.puzzles['1-1'] === undefined || (odd.puzzles['1-1'].stars <= 7 && odd.puzzles['1-1'].lay.every((p) => PARTS[p.p] && Number.isFinite(p.x))), 'odd records are cleaned');
  ok(odd.free.length <= SANDBOX_MAX, 'the free build holds at most its limit');
  ok(odd.ended === false && odd.settings.music === false && typeof odd.settings.sound === 'boolean', 'odd flags are read safely');
  eq(readPlace({ p: 'ramp', x: 1, y: 2, r: 3, f: 1 }), { p: 'ramp', x: 1, y: 2, r: 3, f: 1 }, 'a placement reads back');
  eq(readPlace({ p: 'shelf', x: 1, y: 2, r: 0, f: 0 }), null, 'a fixed-only part is refused');
}
{
  // overlap is symmetric and zero apart
  const w = new World(), a = w.add([box(1, 1)], {}, 0, 0), b = w.add([circle(0.5)], {}, 0.8, 0), c = w.add([circle(0.5)], {}, 3, 0);
  ok(overlap(a, b) > 0 && Math.abs(overlap(a, b) - overlap(b, a)) < 1e-6 && overlap(a, c) === 0, 'overlap is symmetric, and zero apart');
  ok(a instanceof Body, 'bodies are bodies');
  void buildWorld;
}

if (fails.length) { console.log(fails.join('\n')); process.exit(1); }
console.log(`clatter: ${checks} checks passed`);
