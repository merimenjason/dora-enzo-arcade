// Pillow Fort engine checks. The physics first: a 20-piece stack stays still for 30 simulated seconds, energy never
// grows while things fall and settle, a flat landing stays flat, a blanket drapes over two pillars and makes a den,
// and the same inputs replay to the same world bit for bit (copies too). Then the rules: aiming and turning, the
// drop gap, pieces rolling off the rug, the den under a stool, bedtime and stars, the hazards on their schedule,
// the twenty-four nights, unlocking, and the save, corrupt saves included.
import assert from 'node:assert/strict';
import { World, box, circle, DT } from '../.checks/fort-physics.js';
import {
  FortGame, NIGHTS, ROOMS, PIECES, SAVE_KEY, RUG, HEADROOM, CHECK_TICKS, pieceExtent, readSave, freshSave, record, nightOpen, roomNights, roomOpen,
  starCount, nextNight, nightNo, rng,
} from '../.checks/fort-game.js';

let checks = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); checks++; };
const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); checks++; };
const steps = (g, n) => { for (let i = 0; i < n; i++) g.step(); };
const floor = (w) => w.add([box(60, 2)], { isStatic: true, friction: 0.9 }, 0, -1);

// ---- a 20-piece stack of every flat kind stays still for 30 s
{
  const w = new World(); floor(w);
  const kinds = ['cushion', 'book', 'bolster', 'box', 'atlas', 'floor', 'pillow'], bodies = [];
  let y = 0;
  for (let i = 0; i < 20; i++) {
    const k = kinds[i % kinds.length], d = PIECES[k], h = pieceExtent(k, 0).h;
    bodies.push(w.add(d.shapes(), { density: d.density, friction: d.friction, restitution: d.restitution, angDamp: d.angDamp ?? 0.4 }, (i % 2 ? 0.08 : -0.08), y + h + 0.002));
    y += 2 * h + 0.002;
  }
  for (let i = 0; i < 300; i++) w.step();
  const start = bodies.map((b) => [b.x, b.y, b.a]);
  let fastest = 0;
  for (let i = 0; i < 30 * 60; i++) { w.step(); fastest = Math.max(fastest, w.motion()); }
  const drift = Math.max(...bodies.map((b, i) => Math.hypot(b.x - start[i][0], b.y - start[i][1]) + Math.abs(b.a - start[i][2])));
  ok(bodies[19].maxY > y - 0.3, `the stack is still standing (${bodies[19].maxY.toFixed(2)} of ${y.toFixed(2)})`);
  ok(drift < 0.01, `nothing creeps over 30 s (${drift.toExponential(2)})`);
  ok(fastest < 0.02, `nothing jitters (${fastest.toExponential(2)})`);
}

// ---- energy never grows: pieces dropped onto each other lose energy as they fall, land and settle
{
  const w = new World(); floor(w);
  const d = (k) => PIECES[k];
  for (const [k, x, y, a] of [['cushion', 0, 1, 0], ['book', 0.2, 2.2, 0.3], ['box', -0.4, 3.4, 0.1], ['pillow', 0.5, 4.6, 0.7], ['bolster', 0, 5.8, -0.2], ['teacup', 0.3, 7, 0], ['duck', -0.2, 8, 0]]) {
    const p = d(k); w.add(p.shapes(), { density: p.density, friction: p.friction, restitution: p.restitution, angDamp: p.angDamp ?? 0.4 }, x, y, a);
  }
  let prev = w.energy(), worst = 0; const e0 = prev;
  for (let i = 0; i < 600; i++) { w.step(); const e = w.energy(); worst = Math.max(worst, e - prev); prev = e; }
  ok(worst < 0.01 * Math.abs(e0) + 1e-3, `no step adds energy (worst ${worst.toExponential(2)} of ${e0.toFixed(2)})`);
  ok(prev < e0, 'the pile ends with less energy than it started');
  ok(w.motion() < 0.05, 'and it settles');
}

// ---- a piece landing flat stays flat; a ball rolls; a rope hangs
{
  const w = new World(); floor(w);
  const b = w.add([box(0.6, 1.6, 0.25)], { density: 0.5, friction: 0.9 }, 0, 3);
  for (let i = 0; i < 120; i++) w.step();
  ok(Math.abs(b.a) < 0.01 && Math.abs(b.y - 0.8) < 0.02, `an upright cushion dropped straight lands upright (${b.a.toExponential(1)})`);
  const ball = w.add([circle(0.3)], { density: 1, friction: 0.8 }, 3, 0.31); ball.vx = 2;
  for (let i = 0; i < 30; i++) w.step();
  ok(ball.w < -1, 'a ball rolls along the floor');
  const s = w.add([box(0.2, 0.2)], { isStatic: true }, -6, 3), links = [s];
  for (let i = 1; i <= 8; i++) { const l = w.add([circle(0.05)], { density: 1, group: 9, linDamp: 2 }, -6 + i * 0.2, 3); w.link(links[i - 1], l, 0.2); links.push(l); }
  for (let i = 0; i < 600; i++) w.step();
  const end = links[8];
  ok(Math.abs(end.x + 6) < 0.15 && end.y < 1.6 && end.y > 1.2, `a rope tied at one end hangs straight down (${end.x.toFixed(2)}, ${end.y.toFixed(2)})`);
}

// ---- determinism: replays and copies match bit for bit
{
  const play = () => {
    const g = new FortGame('t5');
    const plan = [[-1.5, 0], [1.5, 0], [-1.5, 1], [1.5, 0], [0, 1], [0.4, 0], [-0.3, 2], [0, 0], [0.2, 0]];
    for (const [x, r] of plan) { if (!g.held) break; for (let k = 0; k < r; k++) g.rotate(1); g.aim(x); while (!g.canDrop()) g.step(); g.drop(); steps(g, 50); }
    g.bedtime(); steps(g, CHECK_TICKS + 5);
    return g;
  };
  const a = play(), b = play();
  eq(a.state(), b.state(), 'the same inputs give the same world');
  eq(a.result, b.result, 'and the same result');
  const r = FortGame.replay('t5', a.log, a.tick);
  eq(r.state(), a.state(), 'the logged inputs replay to the same world');
  const g = new FortGame('b2'); g.aim(1); g.drop(); steps(g, 40);
  g.drop(); const n0 = g.events.length, c = g.clone(); steps(g, 300); steps(c, 300);
  eq(c.state(), g.state(), 'a copy steps exactly like the original');
  ok(c.events.length > 0, 'events happen in the copy');
  eq(c.events.map((e) => e.kind), g.events.slice(n0).map((e) => e.kind), 'and they are the same events');
  ok(typeof DT === 'number' && Math.abs(DT - 1 / 60) < 1e-12, 'the world steps at 1/60 s');
  const r1 = rng(5), r2 = rng(5); eq([r1(), r1()], [r2(), r2()], 'the seeded generator repeats');
}

// ---- aiming, turning, dropping
{
  const g = new FortGame('l2');
  eq(g.held.kind, 'book', 'the first piece is in hand');
  g.aim(99); ok(g.held.x <= RUG + 0.4 && g.held.x > RUG - 1, 'aiming stops at the edge of the rug');
  g.aim(0); g.rotate(1); ok(Math.abs(g.held.rot - Math.PI / 2) < 1e-9, 'a book turns a quarter');
  g.rotate(-1); eq(g.held.rot, 0, 'and back');
  g.rotate(1); g.rotate(1); g.rotate(1); g.rotate(1); ok(g.held.rot < 1e-9, 'four quarter turns come round');
  ok(g.drop(), 'a drop works'); ok(!g.drop(), 'but not twice at once'); eq(g.used, 1, 'one piece used');
  steps(g, 24); ok(g.canDrop(), 'the next drop is ready after a moment');
  const b = new FortGame('l4'); while (b.held.kind !== 'blanket') { b.aim(0); while (!b.canDrop()) b.step(); b.drop(); }
  b.rotate(1); eq(b.held.rot, 0, 'a blanket cannot be turned');
  const p = new FortGame('l4'); while (p.held.kind !== 'pillow') { p.aim(0); while (!p.canDrop()) p.step(); p.drop(); }
  p.rotate(1); ok(Math.abs(p.held.rot - Math.PI / 4) < 1e-9, 'a little pillow turns an eighth');
}

// ---- pieces off the rug are lost; the hover gap; height
{
  const g = new FortGame('l1');
  g.aim(RUG); g.drop(); steps(g, 60); g.pieces[0].bodies[0].vx = 9; steps(g, 200);
  ok(g.lostCount === 1 && g.pieces[0].lost, 'a cushion that slides off the rug is lost');
  ok(g.events.some((e) => e.kind === 'lost'), 'with a lost event');
  ok(!g.world.bodies.includes(g.pieces[0].bodies[0]), 'and it is cleared away');
  const h = new FortGame('l1'); h.aim(0); h.drop(); steps(h, 120);
  ok(Math.abs(h.top() - 0.62) < 0.02, `one cushion is 0.62 high (${h.top().toFixed(3)})`);
  ok(h.hoverY('cushion', 0) >= h.top() + 1.2, 'the next piece hangs clear above the fort');
}

// ---- the den: under a stool, and under a blanket on two pillars
{
  const g = new FortGame('l5'); eq(g.held.kind, 'stool', 'night 5 starts with the stool');
  g.aim(0); g.drop(); steps(g, 200);
  const d = g.den();
  ok(d.area > 0.6 && d.area < 1.4, `there is a den under the stool (${d.area.toFixed(2)})`);
  ok(d.cols.every((c) => c.h >= HEADROOM && Math.abs(c.x) < 0.8), 'only between its legs, with headroom');
  const r = new FortGame('l4');
  for (const x of [-1.6, 1.6, -1.6, 1.6, -1.6, 1.6, 0]) { r.aim(x); while (!r.canDrop()) r.step(); r.drop(); steps(r, 100); }
  ok(r.pieces[6].kind === 'blanket' && r.den().area > 2, `a blanket across two pillars makes a den (${r.den().area.toFixed(2)})`);
  r.bedtime(); steps(r, CHECK_TICKS + 2);
  eq(r.result.goals, [true, true, true], 'and three stars on night 4');
}

// ---- bedtime, stars and the automatic bedtime
{
  const g = new FortGame('l1');
  g.aim(0); g.drop(); steps(g, 60); ok(g.bedtime(), 'bedtime starts the check'); ok(!g.bedtime(), 'only once');
  eq(g.held, null, 'the piece in hand goes back to the basket');
  steps(g, CHECK_TICKS - 1); eq(g.result, null, 'the fort has to stand five seconds');
  g.step(); ok(g.result && g.result.stars === 0, 'one cushion is not tall enough');
  ok(g.events.some((e) => e.kind === 'done'), 'with a done event');
  const t = new FortGame('l1');
  for (let i = 0; i < 4; i++) { t.aim(0); while (!t.canDrop()) t.step(); t.drop(); steps(t, 60); }
  t.bedtime(); steps(t, CHECK_TICKS);
  eq(t.result.goals, [true, false, true], `four cushions pass the line in par but miss the high line (${t.result.height.toFixed(2)})`);
  eq(t.result.stars, 2, 'two stars');
  const a = new FortGame('l1'); while (a.held) { a.aim(0); while (!a.canDrop()) a.step(); a.drop(); }
  steps(a, 160); eq(a.phase, 'check', 'with the basket empty, bedtime comes by itself once the fort is still');
  const s = new FortGame(null); ok(s.sandbox && s.held.kind === 'cushion', 'the sandbox starts with a cushion');
  s.pick('duck'); eq(s.held.kind, 'duck', 'and any piece can be picked'); s.drop(); eq(s.held.kind, 'duck', 'the same piece comes again');
  ok(!s.bedtime(), 'the sandbox has no bedtime');
}

// ---- hazards come on their schedule
{
  const drops = (g, n) => { for (let i = 0; i < n && g.held; i++) { g.aim(0); while (!g.canDrop()) g.step(); g.drop(); steps(g, 30); } };
  const c = new FortGame('b2'); drops(c, 4); steps(c, 200);
  ok(c.events.some((e) => e.kind === 'cat') && c.events.some((e) => e.kind === 'pounce'), 'the cat comes after four pieces and pounces');
  const t = new FortGame('t1'); drops(t, 3); steps(t, 100);
  ok(t.events.some((e) => e.kind === 'thunder'), 'thunder rumbles after three pieces');
  const e = new FortGame('t2'); drops(e, 4); steps(e, 160);
  ok(e.events.some((x) => x.kind === 'yawn') && e.events.some((x) => x.kind === 'flop') && e.enzo?.body, 'sleepy Enzo yawns and flops on the fort');
  steps(e, 300); ok(e.events.some((x) => x.kind === 'wake') && !e.enzo?.body, 'and gets up again');
  const w = new FortGame('a1'); drops(w, 1); const b = w.pieces[0].bodies[0], x0 = b.x;
  w.world.bodies.find((o) => o === b).fx = 0; steps(w, 1); ok(b.x >= x0, 'the draught pushes away from the window');
}

// ---- the nights
{
  eq(NIGHTS.length, 24, 'twenty-four nights'); eq(ROOMS.length, 4, 'in four rooms');
  for (const r of ROOMS) eq(roomNights(r.id).length, 6, `six in ${r.name}`);
  eq(new Set(NIGHTS.map((n) => n.id)).size, 24, 'ids are unique');
  for (const n of NIGHTS) {
    ok(n.queue.length >= 7 && n.queue.every((k) => PIECES[k]), `${n.id}: a basket of real pieces`);
    ok(n.par >= 2 && n.par <= n.queue.length, `${n.id}: par fits the basket`);
    ok((n.den !== undefined) !== (n.high !== undefined), `${n.id}: the second star is a den or a high line`);
    if (n.high !== undefined) ok(n.high > n.line, `${n.id}: the high line is above the line`);
    if (n.den !== undefined) ok(n.queue.includes('blanket') || n.queue.includes('stool'), `${n.id}: a den night has something to make a roof`);
  }
  eq(nightNo('l1'), 1, 'night numbers'); eq(nightNo('t6'), 24, 'to twenty-four');
  ok(NIGHTS.some((n) => n.wind) && NIGHTS.some((n) => n.cat) && NIGHTS.some((n) => n.thunder) && NIGHTS.some((n) => n.enzo), 'every hazard appears');
  ok(NIGHTS.slice(0, 6).every((n) => !n.wind && !n.cat && !n.thunder && !n.enzo), 'the living room is calm');
}

// ---- saving and unlocking
{
  eq(SAVE_KEY, 'pillow-fort-v1', 'the save key');
  const s = freshSave();
  ok(nightOpen(s, 'l1') && !nightOpen(s, 'l2'), 'only the first night is open');
  ok(roomOpen(s, 'living') && !roomOpen(s, 'attic'), 'and only the living room');
  const r1 = record(s, 'l1', { stars: 2, used: 5, height: 3.1, den: 0, goals: [true, true, false], stood: true });
  ok(r1.first && r1.better, 'a first pass'); ok(nightOpen(s, 'l2'), 'opens the next night');
  ok(!record(s, 'l1', { stars: 1, used: 4, height: 2.2, den: 0, goals: [true, false, true], stood: true }).better, 'fewer stars do not replace a best');
  ok(record(s, 'l1', { stars: 2, used: 4, height: 2.9, den: 0, goals: [true, true, true], stood: true }).better, 'the same stars with fewer pieces do');
  ok(!record(s, 'l2', { stars: 0, used: 9, height: 1, den: 0, goals: [false, false, false], stood: false }).first, 'a failed night records nothing');
  eq(starCount(s), 2, 'stars add up'); eq(nextNight(s), 'l2', 'the next night to play');
  const back = readSave(JSON.stringify(s)); eq(back, s, 'a save reads back the same');
  for (const bad of [null, '', '{', 'null', '[]', '42', '"x"', '{"best":5}', '{"best":{"zz":{"stars":3}}}', '{"best":{"l1":{"stars":7,"used":2}}}', '{"best":{"l1":{"stars":"3"}}}', '{"tips":"x","settings":{"sound":"no"}}']) {
    const r = readSave(bad); ok(r.v === 1 && Object.keys(r.best).length === 0 && r.settings.sound === true, `a corrupt save is ignored: ${String(bad).slice(0, 24)}`);
  }
  const mixed = readSave('{"best":{"l1":{"stars":3,"used":-4,"height":"x","den":2}},"tips":["a",5],"ended":true,"settings":{"music":false}}');
  eq(mixed.best.l1, { stars: 3, used: 0, height: 0, den: 2 }, 'bad numbers in a best are made safe');
  eq(mixed.tips, ['a'], 'tips keep only strings'); ok(mixed.ended && !mixed.settings.music && mixed.settings.sound, 'and the flags read');
}

console.log(`fort engine: ${checks} checks ok`);
