// Paperwing Post rules: the town (houses clear of the river, the hills and the market square, every window outside a
// wall), gliding (sinking, diving for speed, climbing for height, stalling, banking to turn), warm air over the chimneys
// and the sunny squares, the wind, posting (in reach, perfect, out of reach, once per press), pages, knocks and
// crumpling, landing softly, splashing, gliding home through the attic window, the result and its stars, and saves
// (buying gliders with pages, unlocking, the ending, corrupt saves).
import assert from 'node:assert/strict';
import {
  BODY, DT, Flight, GLIDERS, HALF, LEVELS, POST_REACH, SAVE_KEY, buy, course, groundAt, idleInput, inRiver, level, newSave, parseSave, record, roofTop, serialise, totalStars, town, unlocked,
} from '../.checks/glider-game.js';

let pass = 0;
const ok = (m) => { pass++; console.log('PASS', m); };
const run = (f, secs, inp = idleInput()) => { for (let i = 0; i < secs * 60 && !f.over; i++) f.tick(typeof inp === 'function' ? inp(f) : inp); };
/** a flight put high over open ground (the south-west fields), heading east, with nothing around */
const aloft = (id = 'morning', g = 'dart', y = 80) => { const f = new Flight(level(id), g); f.x = -200; f.z = 230; f.y = groundAt(f.x, f.z) + y; f.yaw = Math.PI / 2; f.t = 10; return f; };
const evs = (f, secs, inp) => { const out = []; for (let i = 0; i < secs * 60 && !f.over; i++) { f.tick(typeof inp === 'function' ? inp(f) : inp ?? idleInput()); out.push(...f.events); } return out; };

// ---- the town: houses on the ground and clear of the river, the market square and each other; homes on their hills
{
  const hs = town();
  assert.ok(hs.length > 120, `a proper town (${hs.length} houses)`);
  for (const h of hs) {
    assert.ok(!inRiver(h.x, h.z), `house ${h.id} is not in the river`);
    if (h.kind === 'house') assert.ok(Math.abs(h.x) > 25 || Math.abs(h.z) > 25, `house ${h.id} leaves the market square open`);
  }
  for (let i = 0; i < hs.length; i++) for (let j = i + 1; j < hs.length; j++) {
    const a = hs[i], b = hs[j];
    assert.ok(Math.abs(a.x - b.x) >= (a.w + b.w) / 2 || Math.abs(a.z - b.z) >= (a.d + b.d) / 2, `houses ${a.id} and ${b.id} don't overlap`);
  }
  const kinds = (k) => hs.filter((h) => h.kind === k).length;
  assert.equal(kinds('home'), 1); assert.equal(kinds('granny'), 1); assert.equal(kinds('tower'), 1); assert.equal(kinds('bakery'), 1);
  const home = hs.find((h) => h.kind === 'home'), granny = hs.find((h) => h.kind === 'granny');
  assert.ok(home.base > 15 && granny.base > 15, 'home and Granny Juniper both live up a hill');
  assert.equal(JSON.stringify(town()), JSON.stringify(hs), 'the town is the same every time');
  ok('the town is laid out cleanly, the same every time, with home and Granny on their hills');
}

// ---- every flight: windows just outside their walls and not inside another house, pages in the open air, the start
{
  for (const lv of LEVELS) {
    const c = course(lv);
    assert.equal(c.targets.length, lv.letters.length + (lv.tower ? 1 : 0), `${lv.id}: a window per letter`);
    for (const t of [...c.targets, c.home]) {
      const h = c.town.find((x) => x.id === t.house);
      assert.ok(h, `${lv.id}: ${t.name}'s window belongs to a house`);
      assert.ok(t.y > h.base && t.y < h.base + h.h, `${lv.id}: ${t.name}'s window is up the wall`);
      assert.ok(Math.abs(t.x - h.x) >= h.w / 2 || Math.abs(t.z - h.z) >= h.d / 2, `${lv.id}: ${t.name}'s window is outside the wall`);
      assert.ok(roofTop(c.town, t.x + t.nx * 6, t.z + t.nz * 6) < t.y, `${lv.id}: you can fly right up to ${t.name}'s window`);
    }
    assert.equal(c.pages.length, lv.pages, `${lv.id}: its pages`);
    assert.ok(lv.pageGoal <= lv.pages, `${lv.id}: the page goal can be met`);
    for (const p of c.pages) assert.ok(p.y > Math.max(groundAt(p.x, p.z), roofTop(c.town, p.x, p.z)) + 4, `${lv.id}: pages float above the roofs`);
    assert.equal(c.targets.at(-1).name === 'Granny Juniper', lv.id === 'birthday', `${lv.id}: Granny Juniper's letter is the last one of the birthday`);
    const f = new Flight(lv);
    assert.ok(f.altitude > 4, `${lv.id}: you launch from the attic window, above what's below`);
  }
  assert.ok(course(level('tower')).targets.some((t) => t.name === 'the Clockmaker' && t.y > 30), 'the Clockmaker lives high up the tower');
  ok('every window is outside its wall and reachable, every page above the roofs, and every flight launches from home');
}

// ---- gliding: it always sinks; diving trades height for speed; pulling up trades speed for height, until it stalls
{
  const f = aloft(), y0 = f.y; run(f, 5);
  assert.ok(f.y < y0 - 1, 'a glider sinks'); assert.ok(f.speed > 9 && f.speed < 16, `it settles at a gliding speed (${f.speed.toFixed(1)})`);
  const dive = aloft(); run(dive, 3, { ...idleInput(), pitch: -1 });
  const glide = aloft(); run(glide, 3);
  assert.ok(dive.speed > glide.speed + 3 && dive.y < glide.y - 4, 'a dive is faster and lower');
  const zoom = aloft(); zoom.speed = 24; const z0 = zoom.y; run(zoom, 1.5, { ...idleInput(), pitch: 1 });
  assert.ok(zoom.y > z0 + 3 && zoom.speed < 24, 'pulling up with speed climbs, and slows you down');
  const stall = aloft(); let n = 0; while (!stall.events.some((x) => x.k === 'stall') && n++ < 600) stall.tick({ ...idleInput(), pitch: 1 });
  assert.ok(n < 600, 'hold it up too long and it stalls');
  run(stall, 0.8, { ...idleInput(), pitch: 1 }); assert.ok(stall.pitch < 0, 'and the nose drops even with the stick held back');
  ok('a glider sinks, diving is fast, pulling up climbs while it has speed, and too slow it stalls');
}

// ---- banking turns: right turns right, a harder bank turns faster, the Swoop turns tighter than the Dart
{
  const turned = (g, s, secs = 2) => { const f = aloft('morning', g); const y0 = f.yaw; run(f, secs, { ...idleInput(), steer: s }); return y0 - f.yaw; };
  assert.ok(turned('dart', 1) > 0.5, 'steering right turns (yaw goes down)'); assert.ok(turned('dart', -1) < -0.5, 'and left turns the other way');
  assert.ok(turned('dart', 1) > turned('dart', 0.4) + 0.2, 'a harder bank turns faster');
  assert.ok(turned('stunt', 1) > turned('dart', 1) * 1.3, 'the Swoop turns tighter');
  const level = aloft(), banked = aloft(); run(level, 3); run(banked, 3, { ...idleInput(), steer: 1 });
  assert.ok(banked.y < level.y, 'a banked glider sinks a little faster');
  ok('banking turns the glider, harder is faster, the Swoop is the nimblest, and turns cost height');
}

// ---- the gliders: the Broadwing floats, the Dart is quick, the Swoop takes the most knocks
{
  const sink = (g) => { const f = aloft('morning', g), y0 = f.y; run(f, 6); return y0 - f.y; };
  assert.ok(sink('wing') < sink('dart') * 0.8, 'the Broadwing sinks slower than the Dart');
  const fast = (g) => { const f = aloft('morning', g); run(f, 4, { ...idleInput(), pitch: -1 }); return f.speed; };
  assert.ok(fast('dart') > fast('wing'), 'the Dart dives faster than the Broadwing');
  assert.ok(GLIDERS.find((g) => g.id === 'stunt').sturdy > GLIDERS.find((g) => g.id === 'wing').sturdy, 'the Swoop is sturdier');
  assert.deepEqual(GLIDERS.map((g) => g.cost), [0, 25, 50], 'the Dart is free; the others cost pages');
  ok('each glider flies differently: the Broadwing floats, the Dart is quick, the Swoop is tough');
}

// ---- warm air: circling over a chimney climbs; the bakery's is warmest; sunny squares lift too; it fades up high
{
  const f = new Flight(level('morning')), hs = f.c.town, ch = hs.find((h) => h.kind === 'house' && h.chimney).chimney, bake = hs.find((h) => h.kind === 'bakery').chimney;
  assert.ok(f.lift(ch.x, ch.top + 10, ch.z) > 1.5, 'warm air rises over a chimney');
  assert.ok(f.lift(ch.x + 30, ch.top + 10, ch.z + 30) < 0.1, 'but not off to one side');
  assert.ok(f.lift(ch.x, ch.top + 75, ch.z) === 0, 'and it runs out high up');
  assert.ok(f.lift(bake.x, bake.top + 10, bake.z) > f.lift(ch.x, ch.top + 10, ch.z), 'the bakery chimney is the warmest');
  // circle the chimney: a gentle right bank round it climbs
  const g = new Flight(level('morning'), 'wing'); g.t = 10; g.x = ch.x + 6; g.z = ch.z; g.y = ch.top + 8; g.yaw = Math.PI; g.speed = 9.5;
  const y0 = g.y; run(g, 12, (q) => { const a = Math.atan2(q.x - ch.x, q.z - ch.z) - 0.8; const tx = ch.x + Math.sin(a) * 6, tz = ch.z + Math.cos(a) * 6; let d = Math.atan2(tx - q.x, tz - q.z) - q.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); return { ...idleInput(), steer: Math.max(-1, Math.min(1, -d * 2.2)), pitch: Math.max(-0.3, Math.min(0.5, (q.speed - 9.5) * 0.15)) }; });
  assert.ok(!g.over && g.y > y0 + 5, `circling in a chimney's warm air climbs (${(g.y - y0).toFixed(1)} m)`);
  const m = new Flight(level('market'));
  assert.ok(m.lift(0, groundAt(0, 0) + 40, 0) > 1.2, 'the sunny market square lifts');
  assert.equal(new Flight(level('morning')).lift(0, groundAt(0, 0) + 40, 0), 0, 'but only on market days');
  const e = evs(Object.assign(new Flight(level('morning')), { t: 10, x: ch.x, z: ch.z, y: ch.top + 8 }), 0.2);
  assert.ok(e.some((x) => x.k === 'lift'), 'flying into warm air tells you');
  ok('chimneys and sunny squares lift, the bakery most, circling in it climbs, and it fades high up');
}

// ---- wind: it carries you along
{
  const calm = aloft('morning'), windy = aloft('river'); calm.yaw = windy.yaw = 0; run(calm, 6); run(windy, 6);
  assert.ok(windy.x - calm.x > level('river').wind[0] * 5, 'the river wind carries you east');
  ok('the wind carries the glider');
}

// ---- posting: in reach posts the nearest letter, close and level is perfect, out of reach misses, one per press
{
  const at = (dx, dy, id = 'morning') => { const f = new Flight(level(id)); const t = f.c.targets[0]; f.t = 10; f.x = t.x + t.nx * dx; f.z = t.z + t.nz * dx; f.y = t.y + dy; f.yaw = Math.atan2(-t.nx, -t.nz); f.speed = 0.0001; return f; };
  const post = (f) => { f.tick({ ...idleInput(), post: true }); return f.events; };
  let f = at(3, 0), e = post(f);
  assert.ok(e.some((x) => x.k === 'post' && x.hit === 'perfect' && x.i === 0), 'close and level is a perfect post'); assert.ok(f.delivered[0] && f.perfect[0]);
  f = at(11, 8); e = post(f); assert.ok(e.some((x) => x.k === 'post' && x.hit === 'good'), 'from well above and further out is still a post');
  f = at(POST_REACH + 4, 0); e = post(f); assert.ok(e.some((x) => x.k === 'nopost') && !f.delivered[0], 'too far is a miss');
  f = at(4, -9, 'tower'); e = post(f); assert.ok(e.some((x) => x.k === 'nopost'), 'too far below is a miss');
  f = at(4, 0); post(f); f.tick({ ...idleInput(), post: true }); assert.ok(!f.events.some((x) => x.k === 'post' || x.k === 'nopost'), 'holding the button posts once');
  f.tick(idleInput()); f.tick({ ...idleInput(), post: true }); assert.ok(f.events.some((x) => x.k === 'nopost'), 'and a letter is only posted once');
  ok('posting needs the window in reach, close and level is perfect, and one press posts one letter');
}

// ---- pages: fly through one to catch it, once
{
  const f = new Flight(level('morning')), p = f.c.pages[0]; f.t = 10; f.x = p.x - 4; f.y = p.y; f.z = p.z; f.yaw = Math.PI / 2;
  const e = evs(f, 1); assert.equal(e.filter((x) => x.k === 'page').length, 1, 'a page is caught once'); assert.ok(f.got[0] && f.pages === 1);
  ok('pages are caught by flying through them');
}

// ---- knocks: a wall bounces you off; enough of them crumple the glider; roofs too
{
  const f = new Flight(level('morning')), h = f.c.town.find((x) => x.kind === 'house' && x.h > 7);
  f.t = 10; f.x = h.x - h.w / 2 - 5; f.z = h.z; f.y = h.base + 3; f.yaw = Math.PI / 2; f.speed = 12;
  const e = evs(f, 1.2); assert.ok(e.some((x) => x.k === 'bump'), 'flying into a wall is a knock');
  assert.ok(f.x < h.x - h.w / 2, 'and bounces you back out'); assert.ok(f.speed < 12, 'and slows you');
  const g = new Flight(level('morning')); let n = 0;
  while (!g.over && n++ < 20) { g.t = 10 + n * 2; g.x = h.x - h.w / 2 - 2; g.z = h.z; g.y = h.base + 3; g.yaw = Math.PI / 2; g.speed = 12; run(g, 1.3); }
  assert.equal(g.why, 'crumpled', 'enough knocks crumple it'); assert.equal(g.bumps, g.gl.sturdy, 'after as many as it is sturdy');
  ok('walls knock the glider back, slow it, and enough knocks crumple it');
}

// ---- endings: landing softly, landing hard, the river, home through the attic window
{
  const land = (speed, pitch, x = -200, z = 230) => { const f = new Flight(level('morning')); f.t = 10; f.x = x; f.z = z; f.y = groundAt(x, z) + 0.45; f.speed = speed; f.pitch = pitch; f.vy = -1; for (let i = 0; i < 30 && !f.over; i++) { f.pitch = pitch; f.tick(idleInput()); } return f; };
  let f = land(9, -0.05); assert.equal(f.why, 'landed'); assert.ok(f.soft, 'slow and level is a soft landing');
  f = land(25, -0.6); assert.equal(f.why, 'landed'); assert.ok(!f.soft, 'fast and steep is not');
  const rx = 40, rz = 92 + 24 * Math.sin(rx / 70); f = land(9, -0.05, rx, rz); assert.equal(f.why, 'splash', 'the river is a splash');
  const g = new Flight(level('morning')), hm = g.c.home; g.delivered = g.delivered.map(() => true);
  g.x = hm.x + hm.nx * 2; g.z = hm.z + hm.nz * 2; g.y = hm.y; g.t = 3; g.tick(idleInput()); assert.ok(!g.over, 'not home straight after launching');
  g.x = hm.x + hm.nx * 2; g.z = hm.z + hm.nz * 2; g.y = hm.y; g.t = 7; g.tick(idleInput()); assert.equal(g.why, 'home', 'home through the attic window');
  ok('soft and hard landings, the river, and gliding home through the attic window');
}

// ---- the result: points and stars
{
  const f = new Flight(level('morning')); f.over = true; f.why = 'landed'; f.soft = true;
  let r = f.result(); assert.equal(r.stars, 0); assert.equal(r.points, 100, 'a soft landing alone is worth a little');
  f.delivered = f.delivered.map(() => true); f.perfect[0] = true; r = f.result();
  assert.equal(r.stars, 1, 'every letter posted is a star'); assert.equal(r.points, f.delivered.length * 200 + 100 + 100);
  f.pages = f.lv.pageGoal; r = f.result(); assert.equal(r.stars, 2, 'and the pages another');
  f.why = 'home'; r = f.result(); assert.equal(r.stars, 3, 'and home the third'); assert.ok(r.home && r.landing === 400);
  const g = new Flight(level('morning')); g.over = true; g.why = 'home'; g.pages = 99; assert.equal(g.result().stars, 0, 'no stars without the letters');
  ok('points for letters, perfects, pages and landing; a star each for the letters, the pages and home');
}

// ---- saves: pages bank as paper, gliders are folded with it, flights unlock in order, the ending, corrupt saves
{
  assert.equal(SAVE_KEY, 'paperwing-post-v1');
  const s = newSave(); assert.ok(unlocked(s, 'morning') && !unlocked(s, 'market'), 'only the first flight is open');
  const f = new Flight(level('morning')); f.over = true; f.why = 'landed'; f.delivered = f.delivered.map(() => true); f.pages = 7;
  let r = record(s, f); assert.ok(r.best && unlocked(s, 'market'), 'posting every letter opens the next flight');
  assert.equal(s.paper, 7, 'caught pages go to the workshop'); assert.equal(s.stats.flights, 1); assert.equal(s.stats.pages, 7);
  assert.ok(!buy(s, 'wing'), "can't fold the Broadwing with 7 pages"); s.paper = 30;
  assert.ok(buy(s, 'wing') && s.paper === 5 && s.glider === 'wing' && s.owned.includes('wing'), 'folding it spends the pages and picks it');
  assert.ok(!buy(s, 'wing'), 'only once');
  const worse = new Flight(level('morning')); worse.over = true; worse.why = 'crumpled'; r = record(s, worse);
  assert.ok(!r.best && s.best.morning.stars === 2, 'a worse flight keeps the best'); assert.equal(s.stats.crumples, 1);
  for (const l of LEVELS.slice(1, 5)) s.best[l.id] = { points: 1, stars: 1 };
  const b = new Flight(level('birthday')); b.over = true; b.why = 'landed'; b.delivered = b.delivered.map(() => true);
  r = record(s, b); assert.ok(r.ending && s.ending, "Granny Juniper's letter is the ending"); assert.ok(!record(s, b).ending, 'only the first time');
  assert.equal(totalStars(s), 2 + 4 + 1);
  const back = parseSave(serialise(s)); assert.deepEqual(back, s, 'a save round-trips');
  for (const bad of [null, '', '{', '[]', '{"v":2}', 'null']) assert.deepEqual(parseSave(bad), newSave(), `a corrupt save (${bad}) starts fresh`);
  const odd = parseSave(JSON.stringify({ v: 1, paper: -5, owned: ['stunt', 'jet'], glider: 'jet', best: { morning: { points: 'x', stars: 9 } }, settings: { invert: 'yes', tips: false } }));
  assert.equal(odd.paper, 0); assert.deepEqual(odd.owned, ['dart', 'stunt']); assert.equal(odd.glider, 'dart'); assert.deepEqual(odd.best.morning, { points: 0, stars: 3 });
  assert.equal(odd.settings.invert, false); assert.equal(odd.settings.tips, false);
  ok('pages bank for gliders, flights open in order, the best is kept, the ending plays once, and odd saves are cleaned');
}

// ---- determinism: the same inputs fly the same flight
{
  const a = new Flight(level('washing')), b = new Flight(level('washing')), inp = (f) => ({ ...idleInput(), steer: Math.sin(f.t), pitch: Math.cos(f.t * 0.7) * 0.5, post: Math.floor(f.t) % 3 === 0 });
  run(a, 30, inp); run(b, 30, inp); assert.equal(a.x, b.x); assert.equal(a.y, b.y); assert.equal(a.t, b.t);
  assert.ok(Math.abs(DT - 1 / 60) < 1e-12); assert.ok(HALF > 200);
  ok('flights are deterministic');
}

console.log(`glider: ${pass} groups passed`);
