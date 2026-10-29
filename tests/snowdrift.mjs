// Snowdrift's engine: exact replay from the inputs, smooth unbroken hills (gaps only at the snow bridges), the
// start, smooth landings, flurries, flips and tumbles, cave roofs, gusts, the dusk, cocoa and snowflakes, falls into
// a gap and the respawn, what each lodge upgrade does, the medals, the endless hills, and saves (round trip and
// corrupt). Needs the engine compiled to .checks/ (npm run test:snowdrift does that).
import assert from 'node:assert/strict';
import {
  SnowGame, VALLEYS, VALLEY_IDS, buildDay, Endless, validateCourse, playRun, noUpgrades, upgradeValue, UPGRADES, UPGRADE_IDS,
  readSave, freshSave, recordRun, recordDaily, buy, dayOpen, endlessOpen, medalCount, dailySeed, fmtTime,
  TPS, DT, G, AIR_G, FLURRY_CHAIN, FALL_TIME, SAVE_KEY, MIN_SPEED, SMOOTH_BOOST, FLIP_BOOST, TUMBLE_TIME,
} from '../.checks/snowdrift-game.js';
import { human } from './snowdrift-bot-policy.mjs';

let n = 0;
const ok = (name) => { n++; console.log('PASS', name); };
const day = (id, lv) => new SnowGame({ kind: 'day', valley: id }, lv);
/** A sled in the air at (x, y) with velocity (vx, vy), level with its flight. */
const launch = (g, x, y, vx, vy) => { g.step(true); g.events.length = 0; Object.assign(g, { x, y, vx, vy, air: true, airT: 0.5, spin: 0, omega: 0, ang: Math.atan2(vy, vx), chain: 0, held: false }); };
/** Finds a long downslope: x where the slope is steeper than m, with ground for a while either side. */
const findSlope = (c, lo, hi, from = 60) => { for (let x = from; x < c.lodge - 60; x += 0.5) { const q = c.ground(x); if (q && q.m < lo && q.m > hi && !c.zoneAt(x, 'gap') && c.ceiling(x) === null && !c.zoneAt(x, 'wind') && !c.isIce(x)) return { x, q: { ...q } }; } return null; };
/** Steps until the sled lands (or a limit), returning that tick's events. */
const untilLand = (g, hold = () => false) => { for (let i = 0; i < 600 && g.air; i++) { g.events.length = 0; g.step(hold(i)); if (!g.air) return g.events.slice(); } return []; };

// ---- the hills
for (const id of VALLEY_IDS) {
  const c = buildDay(id), bad = validateCourse(c);
  assert.deepEqual(bad, [], `${id}: ${bad.join('; ')}`);
  assert.ok(c.lodge >= VALLEYS[id].length - 20 && c.lodge < VALLEYS[id].length + 260, `${id}: the lodge is about the valley's length away (${c.lodge})`);
  assert.ok(c.end > c.lodge + 100, `${id}: room to stop past the lodge`);
  // every stretch without ground is one of the designed bridge gaps
  for (let x = c.xs[0]; x < c.end; x += 0.5) if (c.ground(x) === null) assert.ok(c.zoneAt(x, 'gap'), `${id}: ground everywhere but the gaps (x=${x})`);
  // the slope is continuous too: no kinks between neighbouring samples
  let pm = c.ground(0).m;
  for (let x = 0.1; x < c.end; x += 0.1) { const q = c.ground(x); if (!q) { pm = NaN; continue; } if (Number.isFinite(pm)) assert.ok(Math.abs(q.m - pm) < 0.08, `${id}: smooth slope at x=${x.toFixed(1)}`); pm = q.m; }
  const cocoa = c.pickups.filter((p) => p.kind === 'cocoa').length, flakes = c.pickups.length - cocoa;
  assert.ok(cocoa >= 3 && cocoa <= 5, `${id}: 3 to 5 cocoa mugs (${cocoa})`);
  assert.ok(flakes >= 20, `${id}: plenty of snowflakes (${flakes})`);
  assert.equal(new Set(c.pickups.map((p) => p.id)).size, c.pickups.length, 'pickup ids are unique');
  for (const p of c.pickups) { const q = c.ground(p.x); if (q) assert.ok(p.y > q.y + 0.5, `${id}: pickups float above the snow`); const r = c.ceiling(p.x); if (r !== null) assert.ok(p.y < r, `${id}: pickups under the cave roof`); }
}
assert.ok(buildDay('caves').zones.some((z) => z.kind === 'cave'), 'the Ice Caves have caves');
assert.ok(buildDay('lake').ice.some(Boolean), 'the Frozen Lake has ice');
assert.ok(buildDay('ridge').zones.some((z) => z.kind === 'wind'), 'Windy Ridge has gusts');
assert.ok(buildDay('bridges').zones.filter((z) => z.kind === 'gap').length >= 2, 'Snow Bridges has gaps');
assert.ok(!buildDay('meadow').zones.length, 'Pine Meadow is plain rolling hills');
const summitKinds = new Set(buildDay('summit').zones.map((z) => z.kind));
assert.ok(summitKinds.size >= 3, `the Summit Run has a bit of everything (${[...summitKinds]})`);
assert.deepEqual(buildDay('aurora').xs, buildDay('aurora').xs, 'a day is the same every time');
ok('every valley is smooth and unbroken except the designed bridge gaps, with cocoa and snowflakes along it');

// ---- exact replay
{
  const a = day('bridges'), pol = human(), inputs = [];
  a.step(true); inputs.push(true);
  for (let i = 0; i < TPS * 200 && !a.done; i++) { const h = pol(a); inputs.push(h); a.step(h); a.events.length = 0; }
  const b = day('bridges');
  for (const h of inputs) { b.step(h); b.events.length = 0; }
  assert.equal(a.phase, 'finish');
  for (const k of ['x', 'y', 's', 'vx', 'vy', 'ang', 'duskX', 'flakes', 'cocoa', 'smooths', 'flips', 'tumbles', 'finishT', 'spare']) assert.equal(b[k], a[k], `replay matches on ${k}`);
  assert.deepEqual([...b.got], [...a.got]);
  ok(`the same inputs replay a whole day exactly (${fmtTime(a.finishT)}, ${a.flakes} snowflakes)`);
}

// ---- waiting at the top
{
  const g = day('meadow');
  for (let i = 0; i < 120; i++) g.step(false);
  assert.equal(g.phase, 'ready'); assert.equal(g.t, 0); assert.equal(g.duskX, -VALLEYS.meadow.head * VALLEYS.meadow.dusk);
  g.step(true);
  assert.equal(g.phase, 'ride'); assert.deepEqual(g.events.map((e) => e.k), ['go']);
  ok('nothing moves, the dusk included, until the first press');
}

// ---- holding: heavy down a slope, a little slower up one
{
  const c = buildDay('meadow'), down = findSlope(c, -0.2, -1.2);
  assert.ok(down, 'a downslope in the meadow');
  const run = (hold) => { const g = day('meadow'); g.step(true); Object.assign(g, { x: down.x, y: down.q.y, s: 12, air: false }); for (let i = 0; i < 12; i++) g.step(hold); return g.s; };
  const held = run(true), free = run(false);
  assert.ok(held > free + 1.5, `holding pulls harder down a slope (${held.toFixed(1)} vs ${free.toFixed(1)})`);
  let up = null; for (let x = 60; x < 1400; x += 0.5) { const q = c.ground(x); if (q && q.m > 0.3) { up = { x, q: { ...q } }; break; } }
  const climb = (hold) => { const g = day('meadow'); g.step(true); Object.assign(g, { x: up.x, y: up.q.y, s: 18, air: false }); for (let i = 0; i < 10; i++) g.step(hold); return g.s; };
  const ch = climb(true), cf = climb(false);
  assert.ok(ch < cf && cf - ch < (held - free), `holding slows a climb a little (${ch.toFixed(1)} vs ${cf.toFixed(1)})`);
  ok('holding pulls hard down a slope and slows a climb only a little');
}

// ---- smooth landings and the flurry
{
  const c = buildDay('meadow'), d = findSlope(c, -0.22, -1.2);
  const ang = Math.atan(d.q.m), v = 24;
  const g = day('meadow');
  launch(g, d.x - 0.4 * Math.cos(ang), d.q.y + 0.25, v * Math.cos(ang), v * Math.sin(ang));
  const ev = untilLand(g), land = ev.find((e) => e.k === 'land');
  assert.ok(land && land.smooth, 'meeting a downslope along it is a Smooth landing');
  assert.ok(g.s > v + SMOOTH_BOOST - 1.2, `with a boost (${g.s.toFixed(1)})`);
  // the same flight onto a climb is not
  let up = null; for (let x = 60; x < 1400; x += 0.5) { const q = c.ground(x); if (q && q.m > 0.25 && !c.zoneAt(x, 'gap')) { up = { x, q: { ...q } }; break; } }
  const h = day('meadow');
  launch(h, up.x - 0.5, up.q.y + 0.3, v * Math.cos(ang), v * Math.sin(ang));
  const lu = untilLand(h).find((e) => e.k === 'land');
  assert.ok(lu && !lu.smooth, 'landing on a climb is not smooth');
  assert.ok(h.s < v - 1.5, `and costs speed (${h.s.toFixed(1)})`);
  // three in a row start a flurry, which lasts as long as the scarf says
  const f = day('meadow');
  f.step(true);
  for (let i = 0; i < FLURRY_CHAIN; i++) {
    Object.assign(f, { x: d.x - 0.4 * Math.cos(ang), y: d.q.y + 0.25, vx: v * Math.cos(ang), vy: v * Math.sin(ang), air: true, airT: 0.6, spin: 0, omega: 0, ang });
    const e = untilLand(f);
    assert.ok(e.some((x) => x.k === 'land' && x.smooth), `smooth landing ${i + 1}`);
    if (i < FLURRY_CHAIN - 1) assert.equal(f.flurryT, 0);
  }
  assert.equal(f.chain, FLURRY_CHAIN);
  assert.ok(Math.abs(f.flurryT - upgradeValue('scarf', noUpgrades())) < DT * 3, 'a Snow Flurry starts');
  let t = 0; while (f.flurry && t < TPS * 20) { f.step(false); t++; if (f.done) break; }
  assert.ok(!f.done, 'still riding');
  assert.ok(Math.abs(t * DT - 4) < 0.6, `the flurry lasts about 4 seconds with no scarf (${(t * DT).toFixed(2)})`);
  ok('smooth landings boost, landing on a climb costs speed, and three smooth landings start a Snow Flurry');
}

// ---- flips and tumbles
{
  const c = buildDay('aurora'), d = findSlope(c, -0.3, -1.2, 100);
  const ang = Math.atan(d.q.m);
  // high above the slope: hold until a full turn, then let go and land upright
  const g = day('aurora');
  launch(g, d.x - 30, d.q.y + 26, 20, 4);
  g.airT = 0.5;
  let holding = true;
  const ev = untilLand(g, () => { if (g.spin > Math.PI * 2 - 0.5) holding = false; return holding; });
  const land = ev.find((e) => e.k === 'land');
  assert.ok(land, `landed upright after a flip (${ev.map((e) => e.k)})`);
  assert.equal(land.flips, 1, 'one full flip');
  assert.equal(g.flips, 1);
  assert.ok(g.s > MIN_SPEED + FLIP_BOOST - 1, 'with a big boost');
  // half a flip and let go: upside down on landing is a tumble
  const t = day('aurora');
  launch(t, d.x - 30, d.q.y + 26, 20, 4);
  t.airT = 0.5;
  let h2 = true;
  const ev2 = untilLand(t, () => { if (t.spin > Math.PI) h2 = false; return h2; });
  assert.ok(ev2.some((e) => e.k === 'tumble'), 'landing upside down is a tumble');
  assert.ok(t.tumbling && Math.abs(t.tumbleT - TUMBLE_TIME) < 0.05, 'a comic roll for a moment');
  assert.ok(t.s < 14, `a heavy loss of speed (${t.s.toFixed(1)})`);
  assert.equal(t.phase, 'ride', 'never a game over');
  // the button does nothing while tumbling, then works again
  const s0 = t.s; t.step(true); assert.ok(!t.air && t.s <= s0 + 1);
  for (let i = 0; i < TPS * 2; i++) t.step(false);
  assert.ok(!t.tumbling, 'back on the sled');
  // a short hop never spins, even holding
  const hop = day('meadow');
  launch(hop, d.x, c.height(d.x) + 0.6, 20, 2); hop.airT = 0;
  hop.course = buildDay('meadow');
  let spun = 0; for (let i = 0; i < 6; i++) { hop.step(true); spun = Math.max(spun, Math.abs(hop.spin)); }
  assert.equal(spun, 0, 'no spin in the first moment of a flight');
  void ang;
  ok('a full flip landed upright is a big boost; landing badly is a tumble that costs speed but never ends the day');
}

// ---- cave roofs and gusts
{
  const c = buildDay('caves'), z = c.zones.find((q) => q.kind === 'cave');
  let x = z.x0 + 30; while (c.ceiling(x) === null) x += 1;
  const roof = c.ceiling(x), q = c.ground(x);
  assert.ok(roof - q.y >= 3.2 && roof - q.y < 12, 'a low roof over the hills');
  const g = day('caves');
  launch(g, x, roof - 2.6, 20, 8);
  let bonk = false; for (let i = 0; i < 12 && !bonk; i++) { g.step(false); bonk = g.events.some((e) => e.k === 'bonk'); }
  assert.ok(bonk, 'flying up into the roof is a bonk');
  assert.ok(g.vy < 0 && g.vx < 20, 'which knocks them down and slows them');
  // holding keeps them on the snow over a crest that would throw a light sled into the roof
  const r = buildDay('ridge'), w = r.zones.find((q) => q.kind === 'wind');
  const fly = (wind) => { const h = day('ridge'); const at = wind ? (w.x0 + w.x1) / 2 : 300; launch(h, at, r.height(at) + 8, 20, 0); let t = 0; while (h.air && t < 400) { h.step(false); t++; } return t; };
  const calm = fly(false), gust = fly(true);
  assert.ok(gust > calm, `a gust lengthens a flight (${gust} vs ${calm} ticks)`);
  ok('cave roofs bonk a high flight, and gusts carry a flight further');
}

// ---- the dusk, cocoa and snowflakes
{
  const g = day('meadow'); g.step(true);
  const x0 = g.duskX;
  for (let i = 0; i < TPS; i++) g.step(false);
  assert.ok(Math.abs(g.duskX - x0 - VALLEYS.meadow.dusk) < 0.01, 'the dusk creeps on at the valley pace');
  // a sled stopped short is caught
  const s = day('lake'); s.step(true);
  let caught = false; for (let i = 0; i < TPS * 60 && !s.done; i++) { s.step(false); s.x = Math.min(s.x, 40); if (s.events.some((e) => e.k === 'caught')) caught = true; s.events.length = 0; }
  assert.ok(caught && s.phase === 'caught', 'the dusk catches a sled that falls behind');
  // cocoa pushes the dusk back by the thermos's seconds
  for (const lv of [0, 3]) {
    const c = day('meadow', { ...noUpgrades(), thermos: lv }); c.step(true);
    const mug = c.course.pickups.find((p) => p.kind === 'cocoa');
    Object.assign(c, { x: mug.x, y: mug.y - 1.1, air: true, vx: 0.01, vy: 0, airT: 0.5, ang: 0 });
    const before = c.duskX; c.events.length = 0; c.step(false);
    const ev = c.events.find((e) => e.k === 'cocoa');
    assert.ok(ev, 'cocoa picked up');
    assert.equal(c.cocoa, 1);
    const want = UPGRADES.thermos.values[lv] * VALLEYS.meadow.dusk;
    assert.ok(Math.abs(before + VALLEYS.meadow.dusk * DT - c.duskX - want) < 0.01, `the dusk pushed back ${UPGRADES.thermos.values[lv]}s`);
    c.events.length = 0; c.step(false);
    assert.equal(c.cocoa, 1, 'a mug is picked up once');
  }
  const r = playRun(day('meadow'), human());
  assert.ok(r.flakes > 10 && r.flakes <= r.course.pickups.length - r.cocoaTotal, `snowflakes are collected (${r.flakes})`);
  ok('the dusk creeps on and catches a slow sled; cocoa pushes it back (further with a bigger thermos); snowflakes collect');
}

// ---- falling into a gap
{
  const g = day('bridges'), z = g.course.zones.find((q) => q.kind === 'gap');
  g.step(true);
  Object.assign(g, { x: (z.x0 + z.x1) / 2, y: z.bottom + 6, vx: 1, vy: -20, air: true, airT: 1, ang: 0 });
  const dusk0 = g.duskX;
  let fell = false; for (let i = 0; i < 30 && !fell; i++) { g.step(false); fell = g.events.some((e) => e.k === 'fall'); g.events.length = 0; }
  assert.ok(fell && g.phase === 'fall', 'dropping into the gorge is a soft fall');
  let ticks = 0; while (g.phase === 'fall') { g.step(true); ticks++; }
  assert.ok(Math.abs(ticks * DT - FALL_TIME) < 0.05, `a short wait (${(ticks * DT).toFixed(2)}s)`);
  assert.equal(g.phase, 'ride');
  assert.equal(g.x, z.respawn, 'back at the top of the run before the gap');
  assert.ok(!g.air && g.x < z.x0 - 30, 'on the snow, up the slope');
  assert.ok(g.duskX > dusk0 + VALLEYS.bridges.dusk * (FALL_TIME - 0.1), 'and the dusk kept coming');
  // from the respawn, the run down is enough to fly the gap holding then letting go
  const pol = human(0); let crossed = false;
  for (let i = 0; i < TPS * 8 && !g.done; i++) { g.step(pol(g)); if (g.x > z.x1 + 5 && !g.air) { crossed = true; break; } if (g.phase === 'fall') break; }
  assert.ok(crossed, 'the run from the respawn clears the gap');
  for (const gz of buildDay('bridges').zones.filter((q) => q.kind === 'gap')) assert.ok(gz.x1 - gz.x0 > 10 && gz.x1 - gz.x0 < 26, 'gaps are a fair width');
  ok('a fall into a gap is soft: a short wait, then back at the top of the slope while the dusk comes on');
}

// ---- the lodge shop's upgrades
{
  assert.deepEqual(UPGRADE_IDS, ['wax', 'scarf', 'thermos', 'runners']);
  const c = buildDay('lake');
  let flat = null; for (let x = 100; x < 1700; x += 1) { const q = c.ground(x); if (q && Math.abs(q.m) < 0.03 && !c.isIce(x) && !c.zoneAt(x, 'gap')) { flat = x; break; } }
  const coast = (wax) => { const g = day('lake', { ...noUpgrades(), wax }); g.step(true); Object.assign(g, { x: flat, y: c.height(flat), s: 20, air: false }); for (let i = 0; i < 30; i++) g.step(false); return g.s; };
  assert.ok(coast(3) > coast(0), 'sled wax: less friction');
  let ice = null; for (let x = 100; x < 1700; x += 1) if (c.isIce(x) && c.isIce(x + 30)) { ice = x; break; }
  const slide = (x) => { const g = day('lake'); g.step(true); Object.assign(g, { x, y: c.height(x), s: 20, air: false }); for (let i = 0; i < 30; i++) g.step(false); return g.s; };
  assert.ok(slide(ice) > slide(flat), 'ice keeps its speed better than snow');
  const air = (runners) => { const g = day('meadow', { ...noUpgrades(), runners }); launch(g, 200, c.height(200) + 40, 10, 0); const vy = g.vy; g.step(false); return vy - g.vy; };
  assert.ok(Math.abs(air(0) - G * AIR_G * DT) < 0.02 && air(3) < air(0) * 0.92, 'lighter runners: a lighter pull in the air');
  assert.deepEqual(UPGRADES.scarf.values, [4, 5, 6, 7], 'the scarf lengthens the flurry a second a level');
  // modest: no upgrade more than a quarter better than none
  assert.ok(upgradeValue('wax', { ...noUpgrades(), wax: 3 }) >= 0.75 && upgradeValue('runners', { ...noUpgrades(), runners: 3 }) >= 0.88);
  // buying
  const s = freshSave(); s.flakes = 100;
  assert.ok(buy(s, 'wax') && s.levels.wax === 1 && s.flakes === 70);
  assert.ok(buy(s, 'wax') && s.levels.wax === 2 && s.flakes === 0);
  assert.ok(!buy(s, 'wax'), 'not enough snowflakes');
  s.flakes = 999; buy(s, 'wax'); assert.equal(s.levels.wax, 3); assert.ok(!buy(s, 'wax') && s.flakes === 869, 'three levels at most');
  ok('the lodge shop: wax, scarf, thermos and runners each do what they say, modestly, and cost snowflakes');
}

// ---- medals, days and the save
{
  const s = freshSave();
  assert.ok(dayOpen(s, 0) && !dayOpen(s, 1) && !endlessOpen(s));
  const g = playRun(day('meadow'), human());
  assert.equal(g.phase, 'finish');
  const m = g.medals();
  assert.equal(m[0], true); assert.equal(m[1], g.cocoa === g.cocoaTotal); assert.equal(m[2], g.spare >= VALLEYS.meadow.spare);
  const fresh = recordRun(s, g);
  assert.ok(fresh.first && fresh.best);
  assert.equal(s.flakes, g.flakes, 'snowflakes are banked');
  assert.ok(dayOpen(s, 1) && !dayOpen(s, 2), 'the next day opens');
  assert.equal(s.days.meadow.best, g.finishT);
  // a slower run keeps the best time and every medal
  s.days.meadow.dusk = true;
  const slow = playRun(day('meadow'), () => false);
  recordRun(s, slow);
  assert.ok(s.days.meadow.dusk && s.days.meadow.best === g.finishT, 'medals and best times only get better');
  assert.equal(s.flakes, g.flakes + slow.flakes, 'a run the dusk caught still banks its snowflakes');
  for (const id of ['lake', 'caves']) s.days[id] = { done: true, cocoa: false, dusk: false, best: 6000, spare: 3 };
  assert.ok(endlessOpen(s), 'the Moonlit Hills open after day 3');
  assert.equal(medalCount(s), 1 + (s.days.meadow.cocoa ? 1 : 0) + 1 + 2);
  // round trip
  s.levels.scarf = 2; s.endless.best = 4321; recordDaily(s, '2026-10-30', 999); s.last = 2; s.settings.music = false;
  const back = readSave(JSON.stringify(s));
  assert.deepEqual(back, s, 'a save reads back the same');
  assert.equal(SAVE_KEY, 'snowdrift-v1');
  // the daily best is per date
  assert.ok(!recordDaily(back, '2026-10-30', 500));
  assert.ok(recordDaily(back, '2026-10-31', 10) && back.endless.daily.best === 10);
  // corrupt or strange saves
  for (const raw of ['', 'nope', '{', '[]', 'null', '42', '{"v":2}', JSON.stringify({ v: 1, days: [], flakes: -5, levels: 'x' }), JSON.stringify({ v: 1, days: { meadow: { done: 'yes' } }, flakes: 'lots', last: 99 })]) {
    const r = readSave(raw);
    assert.deepEqual(r.levels, noUpgrades()); assert.ok(r.flakes >= 0 && Number.isFinite(r.flakes)); assert.deepEqual(r.days, {}); assert.equal(r.last, 0);
  }
  const odd = readSave(JSON.stringify({ v: 1, days: { meadow: { done: true, best: 'fast', spare: Infinity }, nowhere: { done: true } }, flakes: 1e12, levels: { wax: 99, scarf: -3, thermos: 1.7 }, last: 1, endless: { best: -1, daily: { date: 'yesterday', best: 5 } }, ended: true }));
  assert.deepEqual(Object.keys(odd.days), ['meadow']);
  assert.equal(odd.days.meadow.best, 0); assert.equal(odd.flakes, 1e7);
  assert.deepEqual(odd.levels, { wax: 3, scarf: 0, thermos: 1, runners: 0 });
  assert.equal(odd.last, 1); assert.equal(odd.endless.best, 0); assert.equal(odd.endless.daily.date, ''); assert.equal(odd.ended, false, 'no ending without the summit');
  ok('medals, best times, day unlocks, banked snowflakes, and saves that round-trip and survive corruption');
}

// ---- the endless Moonlit Hills
{
  const a = new Endless(7), b = new Endless(7), c = new Endless(8);
  a.extend(4000); b.extend(4000); c.extend(4000);
  assert.deepEqual(a.c.xs, b.c.xs, 'a seed always builds the same hills');
  assert.notDeepEqual(a.c.xs.slice(0, 40), c.c.xs.slice(0, 40), 'another seed builds others');
  assert.deepEqual(validateCourse(a.c), []);
  assert.ok(a.c.themes.length >= 3, 'the valleys change as you go');
  assert.ok(a.c.pickups.some((p) => p.kind === 'cocoa'));
  assert.equal(new Set(a.c.pickups.map((p) => p.id)).size, a.c.pickups.length);
  const g = new SnowGame({ kind: 'endless', seed: 7, daily: false });
  playRun(g, human(), TPS * 600);
  assert.equal(g.phase, 'caught');
  assert.ok(g.distance > 1500 && g.course.end > g.x, `the hills keep coming (${g.distance})`);
  const s = freshSave(), fresh = recordRun(s, g);
  assert.ok(fresh.best && s.endless.best === g.distance);
  assert.equal(dailySeed('2026-10-30'), dailySeed('2026-10-30'));
  assert.notEqual(dailySeed('2026-10-30'), dailySeed('2026-10-31'));
  ok(`the Moonlit Hills go on, seeded per run, until the night catches you (${g.distance} units)`);
}

console.log(`\n${n} snowdrift checks passed`);
