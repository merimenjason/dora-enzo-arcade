// Ropeclimb engine checks: exact replays, leaping and its charge, the rope's constraints and its pull, gripping posts,
// hay and beams, catches, drags, hauling and tired claws, falls, every hazard (straw, bales, gusts, lanterns, owls and
// the bell), acorns, the dust-bath checkpoints, Hard Knot, swapping in 1 player, reaching the top, and saving.
import assert from 'node:assert/strict';
import {
  RopeclimbGame, idleInput, idlePad, BODY, JUMP, G, ROPE, GRIP, LAND, STRAW, OWL, ROLL_TICKS, HZ, TOP_Y, FLOOR_H, ACORN_COUNT, TUB_COUNT,
  SECTIONS, SECTION_IDS, sectionAt, readSave, freshSave, climbSave, resume, recordFinish, hardOpen, medalFor, clockText, SAVE_KEY,
} from '../.checks/ropeclimb-game.js';

let checks = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); checks++; };
const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); checks++; };
const near = (a, b, eps, msg) => ok(Math.abs(a - b) <= eps, `${msg} (${a} vs ${b})`);
/** Steps with an input built per tick. */
const run = (g, n, f) => { for (let i = 0; i < n; i++) { const inp = idleInput(); f?.(inp, i); g.step(inp); } };
const kinds = (g) => g.events.map((e) => e.k);
/** A fresh 1-player game with the climbers placed by hand. */
function lab(d, e, o = {}) { const g = new RopeclimbGame({ seed: 7, players: 1, ...o }); g.place(d, e); g.events.length = 0; return g; }
/** Charges for `ticks` then lets go, steering with `aim`; returns the highest feet reached. */
function leap(g, who, ticks, aim = 0, grip = false, after = 120) {
  run(g, ticks, (i) => { i[who].jump = true; });
  let peak = g.c(who).y;
  run(g, after, (i, k) => { i[who].x = aim; i[who].grip = grip && k > 4; peak = Math.max(peak, g.c(who).y); });
  return peak;
}

// ---- the tower
{
  const g = new RopeclimbGame({ seed: 1 });
  eq(g.world.acorns.length, ACORN_COUNT, 'thirty acorn charms are hidden in the tower');
  eq(g.world.tubs.length, TUB_COUNT, 'a dust-bath tub on every floor');
  eq(SECTION_IDS.length, 6, 'six sections');
  ok(SECTION_IDS.every((id, i) => SECTIONS[id].y0 === i * FLOOR_H * 2), 'each section is two floors');
  eq(sectionAt(0), 'cellar'); eq(sectionAt(TOP_Y - 1), 'rooftop', 'the top is the rooftop');
  ok(g.world.tubs.every((t, i) => t.y === i * FLOOR_H), 'the tubs sit on the floors');
  ok(g.world.owls.length >= 2 && g.world.lanterns.length >= 4 && g.world.gusts.length >= 6 && g.world.bales.length >= 3 && g.world.bell, 'every kind of hazard is in the tower');
  ok(g.world.solids.some((s) => s.kind === 'net'), 'hay nets cover the hatches');
  ok(!new RopeclimbGame({ seed: 1, hard: true }).world.solids.some((s) => s.kind === 'net'), 'but not on Hard Knot');
  for (const a of g.world.acorns) ok(a.x > 0 && a.x < 480 && a.y > 0 && a.y < TOP_Y, `acorn ${a.id} is inside the tower`);
}

// ---- replays
{
  const drive = (inp, i) => {
    const p = inp[i % 700 < 350 ? 'dora' : 'enzo'];
    p.x = Math.sign(Math.sin(i * 0.021)); p.jump = i % 90 < 40; p.grip = i % 200 < 150; p.up = i % 300 > 260;
    inp.swap = i % 350 === 0 && i > 0;
  };
  const play = (seed, players) => { const g = new RopeclimbGame({ seed, players }); run(g, 4000, drive); return g; };
  const a = play(42, 1), b = play(42, 1);
  eq(a.hash(), b.hash(), 'the same seed and inputs give the same climb after 4,000 ticks');
  ok(a.stats.jumps > 10, `the replayed climb really played (${a.stats.jumps} leaps)`);
  eq(play(42, 2).hash(), play(42, 2).hash(), 'two-player climbs replay exactly too');
  const c = a.clone(); run(c, 500, drive); run(a, 500, drive);
  eq(c.hash(), a.hash(), 'a copy plays on exactly like the original');
  run(c, 1, (i) => { i.dora.jump = true; }); ok(c.hash() !== a.hash() || c.stats.jumps === a.stats.jumps, 'and independently of it');
}

// ---- leaping
{
  const g = lab({ x: 240, y: 0 }, { x: 240, y: 0 });
  const hop = leap(g.clone(), 'dora', 1);
  near(hop, JUMP.min * JUMP.min / 2 / G, 6, 'a tap is a hop');
  const full = leap(g.clone(), 'dora', 60);
  ok(full > 110 && full <= JUMP.max * JUMP.max / 2 / G + 1, `a full charge springs about eight times their height (${full.toFixed(0)})`);
  const half = leap(g.clone(), 'dora', Math.round(JUMP.full * HZ / 2));
  ok(half > hop + 20 && half < full - 20, 'height grows with the charge');
  const h = g.clone(); run(h, 30, (i) => { i.dora.jump = true; i.dora.x = 1; });
  near(h.dora.x, 240, 0.01, 'charging stops you walking'); ok(h.dora.charging && h.dora.charge > 0.5, 'and the charge builds');
  run(h, 1); ok(h.dora.mode === 'air' && h.dora.vx === 0, 'letting go with no aim leaps straight up');
  const r = g.clone(); run(r, 40, (i) => { i.dora.jump = true; }); run(r, 1, (i) => { i.dora.x = 1; });
  ok(r.dora.vx > 0 && Math.abs(Math.atan2(r.dora.vx, r.dora.vy + G / HZ) - JUMP.tilt) < 0.05, 'full aim tilts the leap');
  ok(kinds(r).includes('jump'), 'a leap is an event');
  const w = g.clone(); run(w, 30, (i) => { i.dora.x = 1; }); ok(w.dora.x > 240 + 30, 'walking moves you');
  const n = g.clone(); run(n, 5, (i) => { i.dora.x = NaN; i.dora.jump = 'yes'; }); ok(Number.isFinite(n.dora.x), 'broken input is ignored');
}

// ---- the rope
{
  // a climber flying away from an anchored partner stops at the rope's length (plus a little stretch)
  const g = lab({ x: 60, y: 0 }, { x: 70, y: 0 });
  let most = 0;
  run(g, 200, (i, k) => { i.dora.grip = false; i.dora.jump = k < 45; i.dora.x = k >= 45 ? 1 : 0; most = Math.max(most, g.span); });
  ok(most <= ROPE.len * (1 + ROPE.stretch) + 1, `the rope stops a leap at its length (${most.toFixed(1)})`);
  // every link stays near its share of the length
  const lens = []; for (let i = 0; i < g.rx.length - 1; i++) lens.push(Math.hypot(g.rx[i + 1] - g.rx[i], g.ry[i + 1] - g.ry[i]));
  ok(lens.every((l) => l <= ROPE.len / ROPE.links * 1.35), `no link stretches far (${lens.map((l) => l.toFixed(1)).join(', ')})`);
  ok(g.rx[0] === g.dora.x && g.rx[g.rx.length - 1] === g.enzo.x, 'the rope is tied to both climbers');
  // a pendulum: hanging out sideways from an anchored partner, a climber swings under and up the far side
  const p = lab({ x: 240 + 125, y: 300, mode: 'air' }, { x: 240, y: 300, mode: 'grip' });
  p.enzo.grip = { k: 'post', id: 0, side: -1 };
  let left = 999, low = 999; run(p, 90, () => { left = Math.min(left, p.dora.x); low = Math.min(low, p.dora.y); });
  ok(left < 240 - 60, `the swing carries past the anchor (${left.toFixed(0)})`);
  near(low, 300 - ROPE.len, 14, 'at the bottom of the arc it hangs a rope-length down');
  ok(p.enzo.x === 240 && p.enzo.y === 300, 'the anchored partner does not move');
  // the rope never cuts through a floor: it bends round the hatch edge, so a partner under the floor swings in below the hatch
  const w = lab({ x: 250, y: 750 }, { x: 180, y: 690, mode: 'air' });
  run(w, 90);
  ok(w.bend && Math.abs(w.bend.x - 331) < 2, `a climber under the floor hangs from the hatch edge (${w.bend && w.bend.x.toFixed(0)})`);
  ok(w.enzo.x > 300 && w.enzo.mode === 'stand', `swinging in under the hatch onto the beam there (${w.enzo.x.toFixed(0)})`);
  // steering pumps the swing
  const q1 = lab({ x: 240 + 60, y: 200, mode: 'air' }, { x: 240, y: 300, mode: 'grip' }), q2 = q1.clone();
  let a1 = 0, a2 = 0;
  run(q1, 300, () => { a1 = Math.max(a1, Math.abs(q1.dora.x - 240)); });
  run(q2, 300, (i) => { i.dora.x = Math.sign(q2.dora.vx) || 1; a2 = Math.max(a2, Math.abs(q2.dora.x - 240)); });
  ok(a2 > a1 + 10, `steering with the swing makes it bigger (${a1.toFixed(0)} → ${a2.toFixed(0)})`);
}

// ---- gripping
{
  // a post: leap at it with claws out
  const g = new RopeclimbGame({ seed: 1, players: 1 });
  g.place({ x: 230, y: 230 }, { x: 200, y: 230 });
  leap(g, 'dora', 18, 1, true, 60);
  ok(g.dora.mode === 'grip' && g.dora.grip.k === 'post', 'claws catch a post');
  ok(kinds(g).includes('grip'), 'with a grip event');
  const y = g.dora.y; run(g, 40, (i) => { i.dora.grip = true; }); eq(g.dora.y, y, 'a gripping climber stays put');
  run(g, 40, (i) => { i.dora.grip = true; i.dora.up = true; }); ok(g.dora.y > y + 20, 'up climbs the post');
  run(g, 2, (i) => { i.dora.grip = false; }); eq(g.dora.mode, 'air', 'and letting go drops you');
  // claws off: you fly right past it
  const n = new RopeclimbGame({ seed: 1, players: 1 }); n.place({ x: 230, y: 230 }, { x: 200, y: 230 });
  run(n, 18, (i) => { i.dora.jump = true; }); let gripped = false; run(n, 60, (i) => { i.dora.x = 1; gripped ||= n.dora.mode === 'grip'; }); ok(!gripped, 'without claws out you don’t grip');
  // a beam from underneath, at the top of a leap; rising fast you sail up through it instead
  const b = lab({ x: 240, y: 0 }, { x: 230, y: 0 });
  leap(b, 'dora', 12, 0, true, 80);
  ok(b.dora.mode === 'grip' && b.dora.grip.k === 'beam', 'a slow rise catches the beam above from underneath');
  const f = lab({ x: 240, y: 0 }, { x: 230, y: 0 });
  leap(f, 'dora', 45, 0, true, 120);
  ok(f.dora.mode === 'stand' && f.dora.y === 80, 'a big leap sails up through a beam and lands on top');
  // the inactive climber in 1 player holds on by itself
  const h = new RopeclimbGame({ seed: 1, players: 1 }); h.place({ x: 230, y: 230 }, { x: 200, y: 230 }); run(h, 2);
  ok(h.anchored(h.enzo) && !h.anchored(h.dora), 'in 1 player the climber you aren’t steering braces');
}

// ---- catches, drags, hauling and tired claws
{
  // Enzo braced at a ledge edge; Dora walks off and is caught on the rope
  const g = lab({ x: 455, y: 150 }, { x: 440, y: 150 });
  run(g, 60, (i) => { i.dora.x = 1; });
  ok(g.dora.mode === 'air' || g.dora.mode === 'stand', 'off the end of the ledge');
  const g2 = lab({ x: 462, y: 350 }, { x: 430, y: 350 });
  run(g2, 120, (i) => { i.dora.x = 1; i.dora.grip = false; });
  ok(kinds(g2).includes('catch'), 'falling off the end, the rope catches you');
  ok(g2.dora.y < 300 && g2.dora.y > 350 - ROPE.len * 1.2 && g2.enzo.y === 350, 'and you dangle below your braced partner');
  ok(g2.loaded(g2.enzo), 'who is holding you up');
  // hauling
  const y0 = g2.dora.y, reel = g2.reel; const s = idleInput(); s.swap = true; g2.step(s);
  run(g2, 50, (i) => { i.enzo.up = true; i.enzo.grip = true; });
  ok(g2.reel < reel && g2.dora.y > y0 + 25, `hauling reels the rope in and lifts your partner (${y0.toFixed(0)} → ${g2.dora.y.toFixed(0)})`);
  ok(kinds(g2).includes('haul'), 'with a creak');
  // tired claws: hold a dangling partner too long and you slip
  const t = lab({ x: 462, y: 350 }, { x: 430, y: 350 });
  run(t, 60, (i) => { i.dora.x = 1; i.dora.grip = false; });
  let slipped = false; run(t, HZ * (GRIP.brace + 2), () => { slipped ||= t.events.some((e) => e.k === 'slip'); });
  ok(slipped && t.dora.strain === 0 || slipped, 'holding a dangling partner too long tires your claws');
  ok(kinds(t).includes('strain'), 'with a warning first');
  // the rope pays back out when nobody is hanging
  const p = lab({ x: 100, y: 0 }, { x: 140, y: 0 }); p.reel = 0.3; run(p, 120); ok(p.reel > 0.9, 'the rope pays out again once nobody hangs on it');
  // in 2 players an unbraced partner gets dragged
  const d = lab({ x: 455, y: 350 }, { x: 400, y: 350 }, { players: 2 });
  let dragged = false; run(d, 200, (i) => { i.dora.x = 1; dragged ||= d.events.some((e) => e.k === 'drag'); });
  ok(d.enzo.x > 400 + 5 || d.enzo.mode === 'air', 'in 2 players a partner who isn’t gripping is dragged along');
  const br = lab({ x: 455, y: 350 }, { x: 400, y: 350 }, { players: 2 });
  run(br, 200, (i) => { i.dora.x = 1; i.enzo.grip = true; });
  ok(br.enzo.x === 400 && br.enzo.y === 350, 'but one gripping holds firm');
  void dragged;
}

// ---- falls
{
  const g = lab({ x: 440, y: 660, mode: 'air' }, { x: 450, y: 660, mode: 'air' });
  g.dora.safeY = g.enzo.safeY = 660; run(g, 120);
  ok(g.stats.falls === 1, `both dropping together count as one fall (${g.stats.falls})`);
  ok(kinds(g).includes('fall') && kinds(g).includes('land'), 'with fall and landing events');
  const h = lab({ x: 240, y: 300, mode: 'air' }, { x: 250, y: 300, mode: 'air' }); h.dora.vy = h.enzo.vy = -LAND.hard - 200; run(h, 60);
  ok(h.events.some((e) => e.k === 'land' && e.hard), 'a fast landing is a hard one');
  const s = lab({ x: 400, y: 150 }, { x: 420, y: 150 }); run(s, 60); eq(s.stats.falls, 0, 'standing still is not falling');
}

// ---- hazards
{
  // crumbling straw
  const straw = new RopeclimbGame({ seed: 1 }).world.solids.find((s) => s.kind === 'straw');
  const g = lab({ x: straw.x + 20, y: straw.y + straw.h + 4, mode: 'air' }, { x: straw.x + 40, y: straw.y + straw.h + 4, mode: 'air' });
  run(g, 10); ok(g.dora.mode === 'stand' && g.straw[straw.id] > 0, 'straw starts to give once stood on');
  run(g, STRAW.hold); ok(kinds(g).includes('crumble') && g.dora.mode === 'air', 'then crumbles under you');
  run(g, STRAW.gone + 5); ok(!g.straw[straw.id], 'and grows back later');
  // a sliding bale carries you
  const b0 = new RopeclimbGame({ seed: 1 }).world.bales[0];
  const bg = lab({ x: 0, y: 0 }, { x: 0, y: 0 }); const bx = bg.baleX(0);
  bg.place({ x: bx + b0.w / 2, y: b0.y + b0.h + 2, mode: 'air' }, { x: bx + b0.w / 2 + 4, y: b0.y + b0.h + 2, mode: 'air' });
  run(bg, 4); const x0 = bg.dora.x, bx0 = bg.baleX(0); run(bg, 30);
  ok(bg.dora.mode === 'stand' && Math.abs((bg.dora.x - x0) - (bg.baleX(0) - bx0)) < 2, 'a sliding bale carries whoever rides it');
  // gusts push you in the air
  const gu = new RopeclimbGame({ seed: 1 }).world.gusts[0];
  let t = 0; const probe = new RopeclimbGame({ seed: 1 }); while (probe.gustState(0, t) !== 'on') t++;
  const wind = lab({ x: 240, y: gu.y0 + 10, mode: 'air' }, { x: 240, y: gu.y0 + 10, mode: 'air' }); wind.tick = t - 1;
  run(wind, 10); ok(Math.sign(wind.dora.vx) === gu.dir && Math.abs(wind.dora.vx) > 50, 'a knothole gust blows you sideways');
  ok(['on', 'warn', 'off'].includes(wind.gustState(0)), 'gusts blow, warn and rest');
  // lanterns knock you
  const l = new RopeclimbGame({ seed: 1 }); const lp = l.lanternAt(0);
  l.place({ x: lp.x, y: lp.y - 8, mode: 'grip' }, { x: lp.x - 60, y: lp.y - 8, mode: 'grip' }); l.dora.grip = { k: 'post', id: 0, side: 1 }; l.tick--;
  run(l, 1, (i) => { i.dora.grip = true; }); ok(kinds(l).includes('bonk') && l.dora.mode === 'air' && l.dora.daze > 0, 'a swinging lantern knocks you loose');
  // owls: noise near one stirs her, more wakes her, and her flap blows off anyone not holding on
  const o = new RopeclimbGame({ seed: 1, players: 2 }); const owl = o.world.owls[0];
  o.place({ x: owl.x - 40, y: owl.y }, { x: owl.x - 60, y: owl.y }); o.events.length = 0;
  o.noise(owl.x, owl.y, OWL.stir + 0.05); run(o, 2, (i) => { i.enzo.grip = true; }); ok(o.owls[0].state === 'stir' && kinds(o).includes('stir'), 'noise near an owl stirs her');
  o.noise(owl.x, owl.y, 1); run(o, OWL.windup + 3, (i) => { i.enzo.grip = true; });
  ok(kinds(o).includes('hoot') && kinds(o).includes('flap'), 'more noise wakes her, and she flaps');
  ok(o.dora.mode === 'air' && kinds(o).includes('blown'), 'blowing off a climber who isn’t holding on');
  ok(o.enzo.mode === 'stand', 'but not one gripping tight');
  run(o, OWL.flap + OWL.calm + 5); eq(o.owls[0].state, 'sleep', 'then she settles back to sleep');
  const q = new RopeclimbGame({ seed: 1 }); q.noise(owl.x + OWL.r + 50, owl.y, 5); eq(q.owls[0].noise, 0, 'she can’t hear noise far away');
  // landing loud near her counts as noise
  const ln = new RopeclimbGame({ seed: 1 }); ln.place({ x: owl.x - 70, y: owl.y + 60, mode: 'air' }, { x: owl.x - 80, y: owl.y + 60, mode: 'air' });
  ln.dora.vy = -600; run(ln, 30); ok(ln.owls[0].noise > 0.1, 'a hard landing near an owl is loud');
  // the bell
  const bell = new RopeclimbGame({ seed: 1 }); const bs = bell.world.bell;
  bell.place({ x: bs.x + bs.w / 2, y: bs.y + bs.h + 30, mode: 'air' }, { x: bs.x + bs.w / 2 + 5, y: bs.y + bs.h + 30, mode: 'air' });
  bell.dora.vy = -400; run(bell, 20); ok(kinds(bell).includes('bell') && bell.owls.some((s) => s.noise > 0.5), 'landing on the bell rings it, loud enough to stir an owl');
}

// ---- acorns
{
  const g = new RopeclimbGame({ seed: 1 }); const a = g.world.acorns[0];
  g.place({ x: a.x, y: a.y - 6, mode: 'air' }, { x: a.x, y: a.y - 6, mode: 'air' }); run(g, 1);
  ok(g.found.has(a.id) && kinds(g).includes('acorn') && g.foundNow === 1, 'touching an acorn charm collects it');
  run(g, 5); eq(g.events.filter((e) => e.k === 'acorn').length, 1, 'only once');
  ok(new RopeclimbGame({ seed: 1, found: [a.id, 99, -1, 2.5] }).found.size === 1, 'found acorns carry over, ignoring nonsense');
}

// ---- dust baths, checkpoints and Hard Knot
{
  const t1 = new RopeclimbGame({ seed: 1 }).world.tubs[1];
  const g = lab({ x: t1.x - 20, y: t1.y + 2, mode: 'air' }, { x: t1.x + 20, y: t1.y + 2, mode: 'air' });
  run(g, 5); eq(g.phase, 'roll', 'both climbers by a tub roll in the dust');
  ok(kinds(g).includes('tub'), 'with a tub event');
  const tick = g.stats.ticks; run(g, ROLL_TICKS - 5, (i) => { i.dora.jump = true; i.dora.x = 1; });
  eq(g.stats.ticks, tick, 'the climb clock stops while rolling');
  ok(!g.dora.charging && g.dora.mode === 'roll', 'presses during the roll are ignored');
  run(g, 8);
  eq(g.phase, 'climb', 'then climb on'); eq(g.tub, 1, 'and that tub is the checkpoint'); ok(kinds(g).includes('checkpoint'), 'with a checkpoint event');
  g.place({ x: t1.x - 20, y: t1.y }, { x: t1.x + 20, y: t1.y }); run(g, 5); eq(g.phase, 'climb', 'a tub already used doesn’t roll again');
  const h = lab({ x: t1.x - 20, y: t1.y + 2, mode: 'air' }, { x: t1.x + 20, y: t1.y + 2, mode: 'air' }, { hard: true });
  run(h, 5); eq(h.phase, 'climb', 'on Hard Knot the tubs are dry'); eq(h.tub, 0, 'and nothing is saved');
  eq(h.ropeLen, ROPE.hard, 'Hard Knot has the short rope'); ok(ROPE.hard < ROPE.len, 'shorter than the normal one');
  const s = new RopeclimbGame({ seed: 1, tub: 5 }); ok(s.dora.y === 5 * FLOOR_H && s.tub === 5, 'a climb can start at a tub');
  eq(new RopeclimbGame({ seed: 1, tub: 99 }).tub, TUB_COUNT - 1, 'a broken tub number is clamped');
}

// ---- swapping and two players
{
  const g = lab({ x: 100, y: 0 }, { x: 140, y: 0 });
  eq(g.active, 'dora', 'Dora starts as the one you steer');
  run(g, 1, (i) => { i.swap = true; }); eq(g.active, 'enzo', 'swap hands control to Enzo'); ok(kinds(g).includes('swap'), 'with a swap event');
  run(g, 20, (i) => { i.dora.x = 1; i.enzo.x = -1; }); ok(g.dora.x === 100 && g.enzo.x < 140, 'in 1 player only the active climber moves');
  const t = lab({ x: 100, y: 0 }, { x: 140, y: 0 }, { players: 2 });
  run(t, 1, (i) => { i.swap = true; }); eq(t.active, 'dora', 'there is no swapping in 2 players');
  run(t, 20, (i) => { i.dora.x = -1; i.enzo.x = 1; }); ok(t.dora.x < 100 && t.enzo.x > 140, 'and each pad steers its own climber');
}

// ---- the top
{
  const g = new RopeclimbGame({ seed: 1, tub: TUB_COUNT - 1 });
  const ridge = g.world.solids[g.world.solids.length - 1];
  g.place({ x: ridge.x + 60, y: TOP_Y + 4, mode: 'air' }, { x: ridge.x + 90, y: TOP_Y + 4, mode: 'air' }); run(g, 10);
  eq(g.phase, 'won', 'both on the ridge by the weathervane wins'); ok(kinds(g).includes('won'), 'with a won event');
  const t = g.stats.ticks; run(g, 30); eq(g.stats.ticks, t, 'and the clock stops');
  eq(clockText(HZ * 75.5), '1:15.5', 'the clock reads minutes and seconds');
  eq(medalFor(0).id, 'gold'); eq(medalFor(5).id, 'silver'); eq(medalFor(15).id, 'bronze'); eq(medalFor(16), null, 'fewest-falls medals');
}

// ---- standing still
{
  const g = new RopeclimbGame({ seed: 3, players: 1 });
  run(g, HZ * 30); ok(g.height === 0 && g.stats.best === 0, 'nobody moves, nobody climbs');
}

// ---- saving
{
  eq(SAVE_KEY, 'ropeclimb-v1', 'the save key is versioned');
  for (const bad of [null, '', 'nope', '{', '[]', '42', 'null', '{"v":2}', JSON.stringify({ v: 1, climb: 'x', acorns: 'x', best: 5, settings: 7 })]) {
    const s = readSave(bad); ok(s.v === 1 && Array.isArray(s.acorns) && s.settings.sound === true, `a broken save (${String(bad).slice(0, 20)}) reads as fresh`);
  }
  const g = new RopeclimbGame({ seed: 9, players: 2, tub: 4, found: [3, 7], stats: { ticks: 5000, falls: 3, jumps: 40, catches: 2, best: 3100 } });
  const s = freshSave(); s.climb = climbSave(g); s.acorns = [3, 7]; s.players = 2; s.settings.music = false; s.settings.autoGrip = false;
  const back = readSave(JSON.stringify(s));
  eq(back, s, 'a save reads back exactly');
  const r = resume(back.climb, 11);
  ok(r.tub === 4 && r.players === 2 && r.stats.ticks === 5000 && r.stats.falls === 3 && r.found.has(7), 'and resumes at its tub with its clock, falls and acorns');
  eq(climbSave(new RopeclimbGame({ seed: 1, hard: true })), null, 'Hard Knot climbs aren’t saved');
  const odd = readSave(JSON.stringify({ v: 1, acorns: [1, 1, 50, -2, 'a', 4], climb: { tub: 99, stats: { ticks: -5, falls: 'x' } }, best: { normal: { ticks: 0, falls: 2 } }, fewest: { normal: 3.7 } }));
  eq(odd.acorns, [1, 4], 'acorn lists are cleaned'); eq(odd.climb.tub, TUB_COUNT - 1, 'tubs are clamped'); eq(odd.climb.stats.ticks, 0, 'clocks are clamped');
  eq(odd.best.normal, null, 'a zero best time is dropped'); eq(odd.fewest.normal, 3, 'fewest falls are whole numbers');
  // finishing
  const f = freshSave(); ok(!hardOpen(f), 'Hard Knot starts locked');
  const done = new RopeclimbGame({ seed: 1, stats: { ticks: 9000, falls: 4 }, found: [0, 1] }); done.phase = 'won';
  f.climb = climbSave(done);
  const rec = recordFinish(f, done);
  ok(rec.fastest && rec.fewest && f.finished === 1 && f.climb === null, 'a finished climb is a record and clears the save');
  ok(hardOpen(f), 'and opens Hard Knot'); eq(f.acorns, [0, 1], 'its acorns are kept');
  const slower = new RopeclimbGame({ seed: 1, stats: { ticks: 9900, falls: 2 } });
  const rec2 = recordFinish(f, slower); ok(!rec2.fastest && rec2.fewest && f.best.normal.ticks === 9000 && f.fewest.normal === 2, 'best time and fewest falls are kept separately');
  const hard = new RopeclimbGame({ seed: 1, hard: true, stats: { ticks: 12000, falls: 9 } });
  recordFinish(f, hard); ok(f.hardFinished === 1 && f.best.hard.ticks === 12000 && f.best.normal.ticks === 9000, 'Hard Knot keeps its own records');
}

void idlePad;
console.log(`ropeclimb: ${checks} checks passed`);
