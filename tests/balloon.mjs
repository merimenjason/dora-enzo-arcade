// Cloudberry Balloon rules: the burner, the vent and the heat that holds the balloon level, the winds at each height and
// the calm near the ground, the pedals, thermals, the ground and its pads, cloudberries, parcels on parachutes,
// sandbags, touching down softly, too hard, in the trees and in the lake, filling up in a village, running out of fuel,
// the thunderhead and the birds, the result and its stars, and saves (unlocking, the ending, corrupt saves).
import assert from 'node:assert/strict';
import {
  DT, ENVELOPE, Flight, LEVELS, SAVE_KEY, groundAt, idleInput, level, makeTerrain, newSave, parseSave, record, serialise, surfaceAt, totalStars, unlocked,
} from '../.checks/balloon-game.js';

let pass = 0;
const ok = (m) => { pass++; console.log('PASS', m); };
const run = (f, secs, inp = idleInput()) => { for (let i = 0; i < secs * 60 && !f.over; i++) f.tick(typeof inp === 'function' ? inp(f) : inp); };
/** a flight put somewhere in the air, holding level */
const aloft = (id, x, ag) => { const f = new Flight(level(id)); f.grounded = false; f.pad = null; f.x = x; f.y = groundAt(f.ter, x) + ag; f.heat = f.neutral(); return f; };
const holdAt = (y) => (f) => ({ ...idleInput(), burn: f.heat < f.neutral() + (y - f.y) * 0.01 - f.vy * 0.02, vent: f.heat > f.neutral() + (y - f.y) * 0.01 + 0.05 });

// ---- the burner lifts off, the vent brings it down, and without either it settles
{
  const f = new Flight(level('farm'));
  run(f, 3); assert.ok(f.grounded, 'no burner, no lift-off');
  run(f, 6, { ...idleInput(), burn: true }); assert.ok(!f.grounded && f.y > groundAt(f.ter, f.x) + 1, 'the burner lifts off');
  assert.ok(f.fuel < f.lv.fuel - 5, 'the burner uses fuel');
  const g = aloft('farm', 300, 80); run(g, 6, { ...idleInput(), vent: true }); assert.ok(g.vy < -1, 'the vent sinks it');
  const h = aloft('farm', 300, 80), y0 = h.y; run(h, 2); assert.ok(Math.abs(h.y - y0) < 1.5, 'at the neutral heat it holds about level');
  assert.ok(h.neutral(500) > h.neutral(50), 'thinner air higher up needs more heat');
  ok('the burner lifts off and uses fuel, the vent sinks, the neutral heat holds level, and higher needs hotter');
}

// ---- the winds: a different way at different heights, calmer near the ground, and the pedals on top
{
  const f = aloft('mill', 300, 40);
  assert.ok(f.wind(150, 85, 0) < -1, 'the Windmill blows west down low');
  assert.ok(f.wind(150, 160, 0) > 4, 'and east up high');
  const g = groundAt(f.ter, 150);
  assert.ok(Math.abs(f.wind(150, g + 3, 0)) < Math.abs(f.wind(150, g + 36, 0)) * 0.5, 'calm near the ground');
  const a = aloft('farm', 300, 4), b = aloft('farm', 300, 4);
  run(a, 8, holdAt(a.y)); run(b, 8, (x) => ({ ...holdAt(b.y)(x), pedal: -1 }));
  assert.ok(a.x > 300 && b.x < 300, 'near the ground the pedals beat the breeze');
  const c = aloft('farm', 300, 120), d = aloft('farm', 300, 120);
  run(c, 10, holdAt(c.y)); run(d, 10, (x) => ({ ...holdAt(d.y)(x), pedal: -1 }));
  assert.ok(d.x > 300 && d.x < c.x, 'up high the pedals only slow it in a real wind');
  ok('each height has its wind, the air is calm near the ground, and the pedals help but cannot fight a real wind');
}

// ---- thermals lift, the gorge's downdraft sinks
{
  const f = new Flight(level('forest'));
  const th = f.lv.thermals[0];
  assert.ok(f.lift(th.x, groundAt(f.ter, th.x) + 30) > 1, 'a thermal lifts over its clearing');
  assert.equal(f.lift(th.x + th.w * 2, 100), 0, 'and nowhere else');
  const g = new Flight(level('gorge')), dd = g.lv.thermals.find((t) => t.up < 0);
  assert.ok(g.lift(dd.x, groundAt(g.ter, dd.x) + 30) < -1, 'the gorge pulls down');
  ok('thermals lift over the clearings and the gorge pulls down');
}

// ---- the ground: every pad flat, every map running on past the finish
{
  for (const lv of LEVELS) {
    const t = makeTerrain(lv);
    for (const p of lv.pads) { const a = groundAt(t, p.x - p.w / 2), b = groundAt(t, p.x + p.w / 2); assert.ok(Math.abs(a - b) < 0.01, `${lv.name}: ${p.name} is flat`); assert.equal(t.canopy(p.x), 0, `${lv.name}: no trees on ${p.name}`); assert.ok(!t.lake(p.x), `${lv.name}: ${p.name} is dry`); }
    assert.ok(lv.w >= lv.pads[lv.pads.length - 1].x + 150, `${lv.name}: room past the finish`);
    assert.equal(lv.pads[0].kind, 'start'); assert.equal(lv.pads[lv.pads.length - 1].kind, 'finish');
  }
  ok('every pad is flat, dry and clear of trees, and every map runs on past its finish');
}

// ---- cloudberries
{
  const lv = level('farm'), f = aloft('farm', lv.bushes[1] - 30, 3); const bx = lv.bushes[1];
  f.y = groundAt(f.ter, bx) + 3;
  run(f, 20, (x) => ({ ...holdAt(groundAt(x.ter, bx) + 3)(x), pedal: Math.sign(bx + 10 - x.x) }));
  assert.ok(f.picked[1] && f.berries === 3, 'skimming a bush picks its cloudberries');
  const g = aloft('farm', bx - 30, 30); run(g, 20, (x) => ({ ...holdAt(groundAt(x.ter, bx) + 30)(x), pedal: 1 }));
  assert.ok(!g.picked[1], 'flying high over it picks nothing');
  ok('skimming a bush picks three cloudberries; flying over high picks none');
}

// ---- parcels
{
  const lv = level('mill'), d = lv.drops[0];
  // find where to let go: step along until the predicted landing is on the garden
  const f = aloft('mill', d.x - 60, 12);
  let dropped = false;
  run(f, 60, (x) => { const inp = { ...holdAt(groundAt(x.ter, x.x) + 12)(x), pedal: 1 }; if (!dropped && Math.abs(x.predictDrop() - d.x) < 1) { dropped = true; inp.drop = true; } return inp; });
  assert.ok(dropped && f.parcels === lv.parcels - 1, 'a parcel goes over the side');
  assert.ok(f.delivered[0] === 'perfect', 'and lands where the guide said, on the garden');
  const g = aloft('mill', 100, 12); let ev = null;
  g.tick({ ...idleInput(), drop: true }); run(g, 30, (x) => { for (const e of x.events) if (e.k === 'parcel') ev = e; return holdAt(groundAt(x.ter, x.x) + 12)(x); });
  assert.equal(ev?.hit, 'miss', 'nowhere near a garden is a miss');
  const h = new Flight(lv); h.tick({ ...idleInput(), drop: true }); assert.equal(h.parcels, lv.parcels, 'no parcels from the ground');
  ok('a parcel on its parachute lands where the guide predicts: on the garden it counts, elsewhere it misses');
}

// ---- sandbags
{
  const f = aloft('farm', 300, 80), n = f.neutral();
  f.tick({ ...idleInput(), sand: true }); f.tick({ ...idleInput(), sand: true });
  assert.equal(f.sandbags, f.lv.sandbags - 1, 'one bag per press');
  assert.ok(f.neutral() < n, 'lighter: it needs less heat');
  ok('a sandbag over the side makes the balloon lighter');
}

// ---- touching down: softly on the meadow, too hard, in the trees, in the lake
{
  const lv = level('farm'), fin = lv.pads[1];
  const f = aloft('farm', fin.x, 10); run(f, 30, { ...idleInput(), vent: false });
  assert.equal(f.why, 'landed', 'settling gently onto the meadow lands');
  const r = f.result(); assert.ok(r.landed && r.points > 300 && r.soft > 0, 'and scores');
  const g = aloft('farm', 300, 0.1); g.vy = -8; g.tick(idleInput());
  assert.equal(g.why, 'crash', 'coming down too fast is a crash');
  const h = aloft('farm', 300, 0.5); h.vy = -0.5; run(h, 5);
  assert.ok(h.grounded && !h.over && h.pad === null, 'a soft touch in a field just stops');
  run(h, 5, { ...idleInput(), burn: true }); assert.ok(!h.grounded, 'and it can take off again');
  const fl = level('forest'), fx = (fl.features[0].x0 + fl.features[0].x1) / 2, t = new Flight(fl);
  t.grounded = false; t.x = fx; t.y = surfaceAt(t.ter, fx) + 0.01; t.vy = -1; t.heat = t.neutral() - 0.05; t.tick(idleInput());
  assert.ok(!t.grounded && t.bumps === 1 && t.vy > 0, 'the treetops bounce it off, with a bump');
  const lk = level('lake'), lx = (lk.features[0].x0 + lk.features[0].x1) / 2, w = new Flight(lk);
  w.grounded = false; w.x = lx; w.y = surfaceAt(w.ter, lx) + 0.01; w.vy = -1; w.tick(idleInput());
  assert.equal(w.why, 'splash', 'landing in the lake ends the hop');
  ok('down softly on the meadow lands it; too hard crashes; a field just stops it; the trees bounce it; the lake is a splash');
}

// ---- villages fill the tank; out of fuel away from one is stranded
{
  const lv = level('mill'), v = lv.pads.find((p) => p.kind === 'village');
  const f = aloft('mill', v.x, 0.5); f.fuel = 10; f.vy = -0.5; run(f, 3);
  assert.ok(f.grounded && f.fuel === lv.fuel, 'touching down in a village fills the tank');
  const g = aloft('mill', 300, 0.5); g.fuel = 0; g.vy = -0.5; run(g, 5);
  assert.equal(g.why, 'stranded', 'out of fuel in a field is stranded');
  ok('a village fills the tank; out of fuel anywhere else is the end of the hop');
}

// ---- the thunderhead and the birds
{
  const lv = level('storm'), st = lv.storm, f = new Flight(lv);
  f.grounded = false; f.x = (st.x0 + st.x1) / 2; f.y = st.y0 + 20; f.heat = f.neutral(); f.berries = 6;
  let flash = null; run(f, st.every + 0.1, (x) => { for (const e of x.events) if (e.k === 'flash') flash = e; return holdAt(st.y0 + 20)(x); });
  assert.ok(flash?.hit && f.berries === 4, 'caught in the thunderhead when it flashes: two berries lost');
  const g = new Flight(lv); g.grounded = false; g.x = (st.x0 + st.x1) / 2; g.y = st.y0 - ENVELOPE - 10; g.heat = g.neutral();
  flash = null; run(g, st.every + 0.1, (x) => { for (const e of x.events) if (e.k === 'flash') flash = e; return holdAt(st.y0 - ENVELOPE - 10)(x); });
  assert.ok(flash && !flash.hit && g.bumps === 0, 'underneath it, safe');
  const cl = level('cliffs'), b = new Flight(cl); b.grounded = false; b.berries = 3;
  const bird = b.birds(0)[0]; b.x = bird.x; b.y = bird.y - 10; b.heat = b.neutral(); b.t = 0; b.tick(idleInput());
  assert.ok(b.bumps === 1 && b.berries === 2, 'a flock knocks a berry out');
  ok('the thunderhead knocks two berries out when it flashes and you are inside it; a flock knocks one');
}

// ---- results and stars
{
  const lv = level('mill'), f = new Flight(lv);
  f.why = 'landed'; f.over = true; f.touchV = 0.4; f.berries = lv.berryGoal; f.delivered = lv.drops.map(() => 'perfect'); f.t = 100;
  let r = f.result(); assert.equal(r.stars, 3); assert.ok(r.points > 1000);
  f.berries = 0; f.delivered = lv.drops.map(() => null); r = f.result(); assert.equal(r.stars, 1, 'landing alone is one star');
  f.why = 'splash'; r = f.result(); assert.equal(r.stars, 0); assert.equal(r.points, 0);
  ok('a hop lands for one star, all the parcels for another, the berry goal for the third; a splash scores nothing');
}

// ---- saves
{
  const s = newSave(); assert.ok(unlocked(s, 'farm') && !unlocked(s, 'mill'));
  const lv = level('farm'), f = new Flight(lv); f.why = 'landed'; f.over = true; f.touchV = 0.5; f.berries = 9; f.t = 120;
  let r = record(s, f); assert.ok(r.best && s.best.farm.stars >= 2 && unlocked(s, 'mill'), 'landing the farm opens the windmill');
  assert.equal(totalStars(s), s.best.farm.stars);
  const m = new Flight(level('meadow')); m.why = 'landed'; m.over = true; r = record(s, m); assert.ok(r.ending && s.ending, 'landing the high meadow brings the ending');
  r = record(s, m); assert.ok(!r.ending, 'only once');
  const back = parseSave(serialise(s)); assert.deepEqual(back, s, 'a save survives the round trip');
  for (const bad of [null, '', '{', '[]', '{"v":2}', '{"v":1,"best":{"farm":{"points":"x","stars":9}},"settings":{"sound":"no"},"stats":{"flights":-4}}']) {
    const p = parseSave(bad); assert.equal(p.v, 1);
    if (p.best.farm) assert.ok(p.best.farm.points === 0 && p.best.farm.stars === 3, 'clamped');
    assert.equal(p.settings.sound, true); assert.equal(p.stats.flights, 0);
  }
  assert.equal(SAVE_KEY, 'cloudberry-balloon-v1');
  ok('landing a hop opens the next, the high meadow brings the ending once, and saves round-trip and survive corruption');
}

// ---- the same inputs fly the same flight
{
  const a = new Flight(level('lake')), b = new Flight(level('lake'));
  const inp = (f) => ({ ...idleInput(), burn: Math.floor(f.t / 4) % 3 !== 0, vent: Math.floor(f.t / 7) % 5 === 0, pedal: Math.sign(Math.sin(f.t)) });
  run(a, 90, inp); run(b, 90, inp); assert.equal(a.x, b.x); assert.equal(a.y, b.y);
  const c = a.clone(); run(c, 5, inp); assert.notEqual(c.t, a.t, 'a copy flies on by itself');
  assert.ok(DT > 0);
  ok('the same inputs fly the same flight, and a copy flies on without touching the original');
}

console.log(`balloon: all good (${pass} checks)`);
