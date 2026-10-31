// Powder Paws engine checks: straight down is fastest and carving across bleeds speed; a snowplough brakes and a tuck
// goes faster; ice slides and powder drags; moguls bounce; ramps launch, tricks score, a crooked or grabbing landing
// wipes out and the skier gets back up; trees, rocks, fences and the deep woods knock you down; banks and gate poles
// only slow you; the storm follows you, catches a skier who stops and is blown back by a clean trick; every slice of
// many mountains has a way through (a path search over the obstacles); slalom gates count and a missed one costs five
// seconds; cabins give postcards; saves survive junk; and a seed with the same inputs replays exactly.
import assert from 'node:assert/strict';
import {
  PowderGame, NO_INPUT, HALF, CH, SLALOM, CABIN_M, PX_PER_M, makeChunk, lineX, readSave, freshSave, recordRun, unlocked, GEAR, daySeed, runSeed,
} from '../.checks/powder-game.js';

const go = (g, inp, n) => { for (let i = 0; i < n && !g.over; i++) g.step(inp); return g; };
/** A game on an empty slope: no obstacles or storm, so the physics can be measured. */
function empty(mode = 'slalom') {
  const g = new PowderGame(mode, 1, 0);
  g.storm.on = false; g.npcs = [];
  const clear = (c) => { c.obs = []; c.areas = []; c.ramps = []; c.gates = []; c.npcs = []; return c; };
  for (const c of g.chunks.values()) clear(c);
  const orig = g.chunk.bind(g);
  g.chunk = (i) => { const had = g.chunks.has(i); const c = orig(i); if (!had) { clear(c); g.npcs = []; } return c; };
  return g;
}
const at = (a) => ({ ...NO_INPUT, target: a });

// ---- carving
{
  const down = go(empty(), at(0), 180), across = go(empty(), at(1.2), 180);
  assert.ok(down.sk.s > 200, `straight down builds speed (${down.sk.s.toFixed(0)})`);
  assert.ok(across.sk.s < down.sk.s * 0.5, 'carving across the slope is much slower');
  const g = go(empty(), at(0), 150), s0 = g.sk.s; go(g, at(-1.4), 40);
  assert.ok(g.sk.s < s0 * 0.75, 'a hard turn bleeds speed');
  const brake = go(go(empty(), at(0), 150), { ...at(0), down: true }, 60);
  assert.ok(brake.sk.s < 40 && brake.sk.brake, 'the snowplough brakes');
  const tuck = go(empty(), { ...at(0), up: true }, 600), plain = go(empty(), at(0), 600);
  assert.ok(tuck.sk.s > plain.sk.s + 25 && tuck.sk.tuck, 'a tuck is faster');
  assert.ok(plain.sk.s < 300, 'speed tops out');
  const k = go(empty(), { ...NO_INPUT, turn: 1 }, 20).sk;
  assert.ok(k.a > 0.3 && k.x >= 0, 'right turns the skis to the right');
  assert.ok(go(empty(), { ...NO_INPUT, turn: -1 }, 200).sk.a >= -Math.PI / 2 - 1e-9, 'the skis never point uphill');
}
// ---- surfaces
{
  const on = (kind) => { const g = empty(); g.chunk(0).areas.push({ k: kind, x: 0, y: 300, rx: 400, ry: 300 }); return g; };
  const ice = go(on('ice'), at(0), 100), powder = go(on('powder'), at(0), 100), snow = go(empty(), at(0), 100);
  assert.ok(ice.sk.s > snow.sk.s && powder.sk.s < snow.sk.s * 0.7, 'ice is fast, powder is slow');
  const a = go(on('ice'), at(0), 60); go(a, at(1.2), 30); const b = go(empty(), at(0), 60); go(b, at(1.2), 30);
  assert.ok(Math.abs(a.sk.a - a.sk.th) > Math.abs(b.sk.a - b.sk.th) * 2, 'on ice the skier slides past where the skis point');
  const m = on('moguls'); let hops = 0;
  for (let i = 0; i < 200; i++) { m.step(at(0)); hops += m.drain().filter((e) => e.t === 'mogul').length; }
  assert.ok(hops >= 3 && !m.crashes, 'moguls bounce the skier without a fall');
}
// ---- jumps and tricks
function jump(g, plan) {
  g.chunk(0).ramps.push({ k: 'big', x: 0, y: 260, w: 46 });
  let t = 0, evs = [];
  for (let i = 0; i < 900 && !g.over; i++) {
    const k = g.sk; if (k.state === 'air') t += 1 / 60;
    g.step(k.state === 'air' ? plan(t) : at(0)); evs.push(...g.drain());
    if (evs.some((e) => e.t === 'land' || e.t === 'wipeout')) break;
  }
  return evs;
}
{
  let ev = jump(empty(), () => NO_INPUT);
  assert.ok(ev.some((e) => e.t === 'jump' && e.big) && ev.some((e) => e.t === 'land' && e.clean && !e.trick), 'a ramp launches; a plain landing is clean');
  // a full twirl: 360 / 560 seconds of holding right
  ev = jump(empty(), (t) => ({ ...NO_INPUT, turn: t < 360 / 560 ? 1 : 0 }));
  const l = ev.find((e) => e.t === 'land');
  assert.ok(l?.clean && l.trick?.name.includes('Twirl 360') && l.trick.pts > 0, `a 360 lands and scores (${JSON.stringify(l?.trick)})`);
  ev = jump(empty(), (t) => ({ ...NO_INPUT, turn: t < 0.32 ? 1 : 0 }));
  assert.ok(ev.some((e) => e.t === 'wipeout'), 'landing sideways wipes out');
  ev = jump(empty(), () => ({ ...NO_INPUT, down: true }));
  assert.ok(ev.some((e) => e.t === 'wipeout'), 'landing while still grabbing wipes out');
  ev = jump(empty(), (t) => ({ ...NO_INPUT, down: t < 0.7 }));
  assert.ok(ev.find((e) => e.t === 'land')?.trick?.name.includes('Grab'), 'letting go of a grab in time scores it');
  ev = jump(empty(), (t) => ({ ...NO_INPUT, up: t < 360 / 430 }));
  assert.ok(ev.find((e) => e.t === 'land')?.trick?.name.includes('Snowball Flip'), 'a full flip scores');
  const g = empty(); jump(g, () => ({ ...NO_INPUT, down: true }));
  go(g, at(0), 120);
  assert.equal(g.sk.state, 'ride', 'after a tumble the skier gets back up');
  assert.equal(g.crashes, 1);
}
// ---- obstacles
{
  const hit = (o) => { const g = empty(); g.chunk(0).obs.push(o); go(g, at(0), 150); return g; };
  assert.equal(hit({ k: 'pine', x: 0, y: 200, r: 7, h: 40 }).crashes, 1, 'a tree knocks you down');
  assert.equal(hit({ k: 'fence', x: 0, y: 200, r: 14, h: 10, w: 28, d: 5 }).crashes, 1, 'so does a fence');
  const bank = hit({ k: 'bank', x: 0, y: 200, r: 14, h: 10 });
  assert.equal(bank.crashes, 0, 'a snowbank only slows you');
  const g = empty(); g.chunk(0).ramps.push({ k: 'big', x: 0, y: 100, w: 46 }); g.chunk(0).obs.push({ k: 'rock', x: 0, y: 220, r: 7, h: 8 });
  go(g, at(0), 120); assert.equal(g.crashes, 0, 'you can jump over a rock');
  const out = empty(); go(out, at(1.4), 400); assert.ok(out.crashes >= 1, 'skiing off into the deep woods ends in a tumble');
}
// ---- the storm
{
  const g = new PowderGame('free', 5); go(g, { ...NO_INPUT, down: true }, 60 * 12);
  assert.equal(g.over?.reason, 'storm', 'the storm catches a skier who stands still');
  const t = empty('free'); t.storm.on = true; t.storm.y = -400; t.chunk(0).ramps.push({ k: 'big', x: 0, y: 260, w: 46 });
  let before = 0, after = 0;
  for (let i = 0; i < 400; i++) { const k = t.sk; const air = k.state === 'air'; before = t.storm.y; t.step(air ? { ...NO_INPUT, turn: k.spin < 330 ? 1 : 0 } : at(0)); after = t.storm.y; if (t.drain().some((e) => e.t === 'land' && e.clean && e.trick)) break; }
  assert.ok(after < before, 'a clean trick blows the storm back');
}
// ---- the mountain always has a way through
function passable(spec, from, to) {
  const cell = 6, x0 = -HALF - 4, cols = Math.ceil((2 * HALF + 8) / cell);
  let reach = new Uint8Array(cols).fill(1);
  const chunks = new Map();
  const get = (i) => { if (!chunks.has(i)) chunks.set(i, makeChunk(spec, i)); return chunks.get(i); };
  for (let y = from * CH; y < to * CH; y += cell) {
    const blocked = new Uint8Array(cols), i = Math.floor(y / CH);
    for (const j of [i - 1, i, i + 1]) if (j >= 0) for (const o of get(j).obs) {
      if (o.k === 'sign' || o.k === 'bank' || o.k === 'pole') continue;
      if (Math.abs(o.y - y) > 40) continue;
      for (let c = 0; c < cols; c++) {
        const x = x0 + c * cell + cell / 2;
        const hitx = o.w ? Math.abs(x - o.x) < o.w / 2 + 4 && Math.abs(y - o.y) < o.d / 2 + 4 : (x - o.x) ** 2 + (y - o.y) ** 2 < (o.r + 4) ** 2;
        if (hitx) blocked[c] = 1;
      }
    }
    const next = new Uint8Array(cols);
    for (let c = 0; c < cols; c++) if (!blocked[c] && (reach[c] || reach[c - 1] || reach[c + 1])) next[c] = 1;
    if (!next.some((v) => v)) return y;
    reach = next;
  }
  return -1;
}
{
  let slices = 0;
  for (let s = 1; s <= 12; s++) {
    const spec = { mode: 'free', seed: s * 977, course: 0 };
    const bad = passable(spec, 0, 70); assert.equal(bad, -1, `seed ${spec.seed}: blocked at y=${bad}`); slices += 70;
  }
  SLALOM.forEach((c, i) => assert.equal(passable({ mode: 'slalom', seed: c.seed, course: i }, 0, c.len), -1, `${c.name} is passable`));
  assert.equal(passable({ mode: 'air', seed: 777, course: 0 }, 0, 9), -1, 'the Big Air park is passable');
  console.log(`  ${slices} freeride chunks searched, all passable`);
  for (let y = 0; y < 30000; y += 7) assert.ok(Math.abs(lineX(9, y + 7) - lineX(9, y)) <= 7.01, 'the clear line is never steeper than 45 degrees');
}
// ---- generation is deterministic and varied
{
  const a = JSON.stringify(makeChunk({ mode: 'free', seed: 42, course: 0 }, 17)), b = JSON.stringify(makeChunk({ mode: 'free', seed: 42, course: 0 }, 17));
  assert.equal(a, b, 'a chunk is a pure function of the seed');
  assert.notEqual(a, JSON.stringify(makeChunk({ mode: 'free', seed: 43, course: 0 }, 17)), 'seeds differ');
  const zones = new Set(); for (let i = 3; i < 80; i++) zones.add(makeChunk({ mode: 'free', seed: 8, course: 0 }, i).zone);
  assert.ok(zones.size >= 6, `the mountain varies (${[...zones]})`);
  CABIN_M.forEach((m, k) => {
    const i = Math.round((m * PX_PER_M) / CH), c = makeChunk({ mode: 'free', seed: 3, course: 0 }, i);
    assert.equal(c.cabin, k, `cabin ${k} stands in chunk ${i}`);
  });
}
// ---- slalom and postcards
{
  const g = new PowderGame('slalom', 0, 0); go(g, at(0), 60 * 60);
  assert.equal(g.over?.reason, 'finish', 'the slalom ends at the finish line');
  assert.equal(g.gatesOk + g.missed, g.gateTotal(), 'every gate is counted');
  assert.ok(g.missed > 0 && Math.abs(g.over.time - (g.time + g.missed * 5)) < 0.02, 'a missed gate costs five seconds');
  const c = empty('free'); c.chunk(0).obs.push({ k: 'cabin', x: 0, y: 300, r: 30, h: 50, w: 56, d: 34, i: 4 });
  const ev = []; for (let i = 0; i < 200; i++) { c.step(at(0)); ev.push(...c.drain()); }
  assert.ok(ev.some((e) => e.t === 'postcard' && e.k === 4) && c.cards.includes(4), 'skiing onto a cabin porch collects its postcard');
}
// ---- replay
{
  const inputs = (i) => ({ turn: [0, 1, -1][Math.floor(i / 37) % 3], target: null, up: i % 90 < 30, down: i % 200 > 190 });
  const play = () => { const g = new PowderGame('free', 1234); for (let i = 0; i < 3000 && !g.over; i++) g.step(inputs(i)); return JSON.stringify([g.sk, g.storm, g.tricks, g.crashes, g.over, g.npcs.map((n) => [n.x, n.y])]); };
  assert.equal(play(), play(), 'the same seed and inputs replay exactly');
  assert.notEqual(daySeed('20261101'), daySeed('20261102'));
  assert.notEqual(runSeed(1), runSeed(2));
}
// ---- the save
{
  assert.deepEqual(readSave(null), freshSave());
  for (const junk of ['{', 'null', '[]', '{"v":2}', '{"v":1,"cards":"x","best":7,"gear":{"dora":{"scarf":"lava"}},"slalom":[null,{"time":-4,"medal":9}]}']) {
    const s = readSave(junk); assert.equal(s.v, 1); assert.ok(Array.isArray(s.cards)); assert.equal(s.gear.dora.scarf, 'scarf-red');
    assert.ok(s.slalom.every((x) => x.time >= 0 && x.medal <= 3));
  }
  const s = freshSave(), g = new PowderGame('free', 2); g.cards = [0, 1]; g.tricks = 500; g.sk.y = 10040; g.quit();
  const r = recordRun(s, g);
  assert.ok(r.best && s.best.free === 1000 && s.cards.length === 2, 'a run records distance and postcards');
  assert.ok(r.unlocks.includes('scarf-mint') && r.unlocks.includes('scarf-sun'), 'unlocks come with them');
  assert.equal(readSave(JSON.stringify(s)).best.free, 1000, 'the save round-trips');
  assert.ok(GEAR.filter((x) => x.how === 'From the start').every((x) => unlocked(freshSave(), x.id)));
}
console.log('powder ok');
