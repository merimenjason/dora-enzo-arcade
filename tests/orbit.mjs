// Moonhop's engine: the pull of the moons, walking (and the arrow-key latch), charging and leaping, landing on each
// kind of moon (moss, ice, jelly, beans), the puff, spinning and moving moons, rabbit holes, fireflies and the home
// lantern, the lantern string that reels them back, the dotted preview, determinism, the save (and corrupt saves),
// the stages' data, and the Moon Garden's grown fields.
import assert from 'node:assert/strict';
import { Hop, play, walkTo, replay, DT, G0, SOFT, FALL_OUT, CHARGE_T, VMIN, VMAX, PUFF, MAX_FLY, LOST_T, HOLE_W, wrap } from '../.checks/orbit-game.js';
import { STAGES, STAGE, SKIES, SAVE_KEY, FINALE, readSave, freshSave, stageOpen, skyOpen, skyDone, starlightOpen, gardenOpen, record, nextStage, totalStars, gardenField } from '../.checks/orbit-levels.js';

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('ok -', name); };
const up = -Math.PI / 2;
const stage = (moons, extra = {}) => ({ id: 't', name: 't', sky: 1, index: 0, moons, flies: [], start: { moon: 0, at: up }, home: -1, par: 9, parTime: 60, preview: 1, ...extra });
const run = (h, inp, n) => { for (let i = 0; i < n; i++) h.tick(inp); return h; };
const close = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg}: ${a} vs ${b}`);

test('the pull points at the moon, softly capped at the surface and gone far away', () => {
  const h = new Hop(stage([{ x: 0, y: 0, r: 50 }]));
  const [ax, ay] = h.pull(80, 0);
  assert.ok(ax < 0 && Math.abs(ay) < 1e-9, 'towards the centre');
  const [sx] = h.pull(50, 0);
  close(-sx, G0, 1e-6, 'surface gravity of a radius-50 moon is G0');
  const [fx, fy] = h.pull(50 * FALL_OUT + 1, 0);
  assert.equal(fx, 0); assert.equal(fy, 0);
  const big = new Hop(stage([{ x: 0, y: 0, r: 80 }])), small = new Hop(stage([{ x: 0, y: 0, r: 30 }]));
  assert.ok(-big.pull(200, 0)[0] > -small.pull(200, 0)[0] * 3, 'bigger moons pull harder');
  const bean = new Hop(stage([{ x: 0, y: 0, r: 40, kind: 'bean' }]));
  assert.ok(bean.pull(80, 0)[0] > 0, 'a black bean pushes away');
  void SOFT;
});

test('walking: right goes clockwise on top, and the arrow latch keeps going the same way under the moon', () => {
  const h = new Hop(stage([{ x: 0, y: 0, r: 50 }]));
  run(h, { right: true }, 30);
  assert.ok(h.at > up, 'right walks right (clockwise) from the top');
  assert.ok(h.x > 0);
  // start at the bottom: right still walks towards screen-right
  const b = new Hop(stage([{ x: 0, y: 0, r: 50 }], { start: { moon: 0, at: Math.PI / 2 } }));
  run(b, { right: true }, 20);
  assert.ok(b.x > 0, 'under the moon, right walks screen-right');
  // keep holding through the side: it keeps going round rather than turning back
  const c = new Hop(stage([{ x: 0, y: 0, r: 50 }]));
  run(c, { right: true }, 400);
  const a1 = c.at; run(c, { right: true }, 30);
  assert.notEqual(a1, c.at, 'still walking');
  assert.ok(c.ws > 0, 'still clockwise after passing the side');
});

test('holding charges the ring; letting go leaps straight off the surface at the matching speed', () => {
  const h = new Hop(stage([{ x: 0, y: 0, r: 50 }]));
  run(h, { jump: true }, Math.round(CHARGE_T / DT) + 10);
  assert.equal(h.charge, 1);
  h.tick({});
  assert.equal(h.mode, 'fly'); assert.equal(h.leaps, 1);
  assert.ok(Math.abs(h.vx) < 1e-6 && h.vy < 0, 'straight up from the top');
  close(Math.hypot(h.vx, h.vy) - h.pull(h.x, h.y)[1] * 0 , VMAX, 12, 'full power');
  const lo = new Hop(stage([{ x: 0, y: 0, r: 50 }]));
  lo.tick({ jump: true }); lo.tick({});
  assert.equal(lo.mode, 'fly');
  assert.ok(Math.hypot(lo.vx, lo.vy) < VMIN + 20, 'a tap is a little hop');
});

test('a little hop lands back on the same moon', () => {
  const h = new Hop(stage([{ x: 0, y: 0, r: 50 }, { x: 900, y: 0, r: 40 }]));
  const evs = [];
  assert.ok(play(h, { at: up, charge: 0.1 }));
  assert.equal(h.mode, 'stand'); assert.equal(h.moon, 0);
  void evs;
});

test('the pointer walks them to the spot and only charges once they are there', () => {
  const h = new Hop(stage([{ x: 0, y: 0, r: 50 }]));
  h.tick({ jump: true, point: [400, 0] });
  assert.equal(h.charge, 0, 'not there yet');
  run(h, { jump: true, point: [400, 0] }, 200);
  close(h.at, 0, 0.06, 'walked round to the right side');
  assert.ok(h.charge > 0, 'and charging');
});

test('holding through a landing does not charge until the button is let go and pressed again', () => {
  const h = new Hop(stage([{ x: 0, y: 0, r: 50 }]));
  h.tick({ jump: true }); h.tick({});
  let n = 0; while (h.mode === 'fly' && n++ < 2000) h.tick({ jump: n > 5 });
  assert.equal(h.mode, 'stand');
  run(h, { jump: true }, 20);
  assert.equal(h.charge, 0, 'blocked');
  h.tick({}); run(h, { jump: true }, 20);
  assert.ok(h.charge > 0, 'a fresh press charges');
});

test('landing: moss stops dead, ice skids, plain moons slide a little', () => {
  const land = (kind) => {
    const h = new Hop(stage([{ x: 0, y: 0, r: 50 }, { x: 230, y: 0, r: 46, kind }]));
    // leap sideways off the right side so they arrive with sideways speed
    play(h, { at: -0.35, charge: 0.55 });
    return h;
  };
  const moss = land('moss'), ice = land('ice'), plain = land(undefined);
  for (const h of [moss, ice, plain]) assert.equal(h.moon, 1, 'reached the second moon');
  // the replay helper plays on until they stand; look at the skid just after landing
  const skid = (kind) => {
    const h = new Hop(stage([{ x: 0, y: 0, r: 50 }, { x: 230, y: 0, r: 46, kind }]));
    const ptr = [Math.cos(-0.35) * 400, Math.sin(-0.35) * 400];
    while (h.charge < 0.55) h.tick({ jump: true, point: ptr });
    h.tick({});
    let n = 0; while (h.mode === 'fly' && n++ < 3000) h.tick({});
    return Math.abs(h.ws);
  };
  assert.equal(skid('moss'), 0, 'moss: no skid at all');
  assert.ok(skid('ice') > skid(undefined), 'ice skids further than a plain moon');
});

test('jelly bounces a hard landing and keeps a soft one; beans always bounce', () => {
  const h = new Hop(stage([{ x: 0, y: 0, r: 50 }, { x: 260, y: 0, r: 46, kind: 'jelly' }, { x: 900, y: 0, r: 40 }]));
  const ptr = [400, 0];
  while (h.charge < 0.9) h.tick({ jump: true, point: ptr });
  h.tick({});
  const evs = []; let n = 0;
  while (h.mode === 'fly' && n++ < 1500) { h.tick({}); evs.push(...h.events.splice(0)); }
  assert.ok(evs.some((e) => e.k === 'bounce' && e.moon === 1), 'bounced off the jelly');
  const soft = new Hop(stage([{ x: 0, y: 0, r: 50, kind: 'jelly' }]));
  assert.ok(play(soft, { at: up, charge: 0.02 }));
  assert.equal(soft.mode, 'stand', 'a soft landing on jelly stays');
  const bean = new Hop(stage([{ x: 0, y: 0, r: 50 }, { x: 250, y: 0, r: 40, kind: 'bean' }]));
  while (bean.charge < 1) bean.tick({ jump: true, point: [400, 0] });
  bean.tick({});
  let landedOnBean = false; n = 0;
  while (bean.mode === 'fly' && n++ < 1500) { bean.tick({}); if (bean.mode === 'stand' && bean.moon === 1) landedOnBean = true; }
  assert.ok(!landedOnBean, 'nobody stands on a bean');
});

test('one puff per leap, refilled on landing', () => {
  const h = new Hop(stage([{ x: 0, y: 0, r: 50 }]));
  run(h, { jump: true }, 40); h.tick({});
  const vx0 = h.vx;
  h.tick({ jump: true, point: [h.x + 100, h.y] });
  close(h.vx - vx0, PUFF, 2, 'a puff towards the pointer');
  assert.equal(h.puffs, 0);
  h.tick({}); const vx1 = h.vx; h.tick({ jump: true, point: [h.x + 100, h.y] });
  close(h.vx, vx1, 1, 'no second puff');
  let n = 0; while (h.mode === 'fly' && n++ < 3000) h.tick({});
  assert.equal(h.mode, 'stand'); assert.equal(h.puffs, 1, 'refilled');
  // with the keyboard: the arrows aim it, and with none held it pushes along the flight
  const k = new Hop(stage([{ x: 0, y: 0, r: 50 }]));
  run(k, { jump: true }, 40); k.tick({}); const vy0 = k.vy;
  k.tick({ jump: true, left: true });
  assert.ok(k.vx < -PUFF * 0.9, 'left arrow puffs left'); void vy0;
});

test('a spinning moon carries them round; ice barely does', () => {
  const s = new Hop(stage([{ x: 0, y: 0, r: 50, spin: 1 }]));
  run(s, {}, 120);
  close(s.at, up + 1, 0.02, 'one radian in a second');
  const i = new Hop(stage([{ x: 0, y: 0, r: 50, spin: 1, kind: 'ice' }]));
  run(i, {}, 120);
  close(i.at, up + 0.2, 0.02, 'ice slips under them');
  // and the spin flings them sideways on a leap
  s.tick({ jump: true }); s.tick({});
  const tx = -Math.sin(s.lastAt), ty = Math.cos(s.lastAt);
  assert.ok(s.vx * tx + s.vy * ty > 40, 'flung along the spin');
});

test('moving moons follow their loops and carry whoever stands on them', () => {
  const st = stage([{ x: 200, y: 0, r: 30, path: { cx: 0, cy: 0, ax: 200, period: 8 } }]);
  const h = new Hop(st);
  const x0 = h.x, y0 = h.y;
  run(h, {}, 240);
  assert.ok(Math.hypot(h.x - x0, h.y - y0) > 100, 'carried along');
  close(Math.hypot(h.mx[0], h.my[0]), 200, 1e-6, 'on its circle');
  // twins round another moon
  const tw = new Hop(stage([{ x: 0, y: 0, r: 40 }, { x: 0, y: 0, r: 20, path: { around: 0, ax: 120, period: 6, phase: 1 } }]));
  close(Math.hypot(tw.mx[1] - tw.mx[0], tw.my[1] - tw.my[0]), 120, 1e-6, 'circling the other moon');
});

test('pulsing moons breathe their pull in and out', () => {
  const h = new Hop(stage([{ x: 0, y: 0, r: 50, pulse: { amp: 0.5, period: 4 } }]));
  const pulls = [];
  for (let k = 0; k < 4; k++) { run(h, {}, 120); pulls.push(-h.pull(120, 0)[0]); }
  assert.ok(Math.max(...pulls) > Math.min(...pulls) * 1.5, 'the pull changes with time');
});

test('a rabbit hole pops them out of the other moon, and not straight back', () => {
  const st = stage([{ x: 0, y: 0, r: 50 }, { x: 400, y: -200, r: 40 }, { x: 800, y: 0, r: 40 }], { holes: [{ a: 0, aAt: 0, b: 1, bAt: up }] });
  const h = new Hop(st), evs = [];
  assert.ok(walkTo(h, 0));
  assert.equal(h.moon, 1); close(h.at, up, 1e-9, 'out of the matching hole');
  run(h, {}, 60);
  assert.equal(h.moon, 1, 'standing still on the hole does not send them back');
  run(h, { right: true }, 40); run(h, { left: true }, 70);
  assert.equal(h.moon, 0, 'walking off and back on takes them through again'); void evs; void HOLE_W;
});

test('fireflies open the lantern; landing on it shut does nothing, open finishes the stage', () => {
  const st = stage([{ x: 0, y: 0, r: 50 }, { x: 260, y: 10, r: 50 }], { flies: [{ x: 1000, y: 1000 }, { x: 5000, y: 0, gold: true }], home: 1 });
  const h = new Hop(st);
  assert.equal(h.needed(), 1); assert.equal(h.total(), 1);
  const evs = [];
  for (const at of [-0.4, -0.3, -0.2, -0.5, -0.6]) { if (h.moon === 1) break; play(h, { at, charge: 0.5 }); evs.push(...h.events.splice(0)); }
  assert.equal(h.moon, 1, 'reached the lantern moon');
  assert.ok(evs.some((e) => e.k === 'locked' && e.left === 1), 'it is shut');
  assert.ok(!h.done);
  // a firefly right on the path home
  const st2 = stage([{ x: 0, y: 0, r: 50 }, { x: 260, y: 10, r: 50 }], { flies: [{ x: 0, y: -50 - 17 }], home: 1 });
  const g = new Hop(st2); g.tick({});
  assert.ok(g.got[0], 'gathered by standing under it'); assert.ok(g.open);
  const s3 = stage([{ x: 0, y: 0, r: 50 }], { flies: [{ x: 0, y: -50 - 17 }], home: 0 });
  const d = new Hop(s3); d.tick({});
  assert.ok(d.done, 'standing on the home moon when the last one is gathered finishes it');
  assert.equal(d.result().home, true); assert.equal(d.result().gold, false);
});

test('drifting into the dark rewinds them to where they leapt from (and the leap still counts)', () => {
  const h = new Hop(stage([{ x: 0, y: 0, r: 30 }, { x: 2000, y: 0, r: 30 }]));
  run(h, { jump: true, point: [400, -150] }, 300);
  const at = h.at; h.tick({});
  const evs = []; let n = 0;
  while (h.mode !== 'stand' && n++ < 4000) { h.tick({}); evs.push(...h.events.splice(0)); }
  assert.ok(evs.some((e) => e.k === 'lost') && evs.some((e) => e.k === 'back'));
  assert.equal(h.moon, 0); close(h.at, at, 1e-9, 'back where they leapt from');
  assert.equal(h.leaps, 1); assert.equal(h.lost, 1);
  // a long orbit gets reeled in too
  const o = new Hop(stage([{ x: 0, y: 0, r: 60 }]));
  o.tick({ jump: true }); o.tick({}); o.mode = 'fly'; o.vx = 290; o.vy = 0; o.x = 0; o.y = -160;
  n = 0; while (o.mode === 'fly' && n++ < 2000) o.tick({});
  assert.ok(o.mode === 'lost' || o.mode === 'stand');
  assert.ok(n * DT <= MAX_FLY + 0.1); void LOST_T;
});

test('the dotted preview follows the real flight', () => {
  const st = STAGE['1-4'], h = new Hop(st);
  run(h, { jump: true }, 60);
  const pts = h.preview(1);
  h.tick({});
  const real = [[h.x, h.y]];
  for (let k = 0; k < 120 && h.mode === 'fly'; k++) { h.tick({}); if (k % 6 === 5) real.push([h.x, h.y]); }
  for (let i = 0; i < Math.min(pts.length, real.length) - 1; i++) close(Math.hypot(pts[i][0] - real[i][0], pts[i][1] - real[i][1]), 0, 3, `point ${i}`);
});

test('the same inputs give the same game', () => {
  const route = [{ at: -0.5, charge: 0.6 }, { at: 0.3, charge: 0.8, wait: 1, puff: { t: 0.3, dir: 1.57, rel: true } }, { at: -1.2, charge: 0.4 }];
  for (const st of [STAGE['2-3'], STAGE['4-2'], STAGE['5-7']]) {
    const a = replay(st, route), b = replay(st, route);
    assert.deepEqual([a.x, a.y, a.step, a.leaps, a.got, a.moon], [b.x, b.y, b.step, b.leaps, b.got, b.moon]);
  }
});

test('forty stages in five skies of eight, each one sound', () => {
  assert.equal(STAGES.length, 40); assert.equal(SKIES.length, 5);
  assert.equal(new Set(STAGES.map((s) => s.id)).size, 40);
  for (const s of STAGES) {
    assert.ok(s.home >= 0 && s.home < s.moons.length && s.start.moon < s.moons.length, s.id);
    assert.ok(s.flies.filter((f) => f.gold).length === 1, `${s.id} has one golden firefly`);
    assert.ok(s.flies.some((f) => !f.gold), `${s.id} has fireflies to gather`);
    assert.ok(s.par >= 1 && s.par < 20 && s.parTime > 0, `${s.id} par ${s.par}`);
    const h = new Hop(s);
    for (let i = 0; i < s.flies.length; i++) { const [x, y] = h.flyAt(i); for (let j = 0; j < s.moons.length; j++) assert.ok(Math.hypot(x - h.mx[j], y - h.my[j]) > s.moons[j].r + 8, `${s.id} firefly ${i} clear of moon ${j}`); }
    for (let i = 0; i < s.moons.length; i++) for (let j = i + 1; j < s.moons.length; j++) {
      const a = s.moons[i], b = s.moons[j]; if (a.path || b.path) continue;
      assert.ok(Math.hypot(a.x - b.x, a.y - b.y) > a.r + b.r + 30, `${s.id} moons ${i} and ${j} apart`);
    }
  }
  for (const k of SKIES) assert.equal(STAGES.filter((s) => s.sky === k.n).length, 8);
});

test('the save: fresh, corrupt, and what opens when', () => {
  assert.equal(SAVE_KEY, 'moonhop-v1');
  for (const bad of [null, '', '{', '[]', '42', 'null', '{"v":2}', '{"v":1,"stages":5}', '{"v":1,"stages":{"1-1":{"s":"yes"}},"garden":{"level":"x"}}']) {
    const s = readSave(bad); assert.deepEqual(s.stages, {}); assert.equal(s.garden.level, 1); assert.equal(s.settings.sound, true);
  }
  const odd = readSave(JSON.stringify({ v: 1, stages: { '1-1': { s: [true, true, false], best: 3 }, '3-4': { s: [true, true, true], best: 2 } }, garden: { level: 1e9, best: -4 }, ended: true, seen: ['1-1', 5, 'x'.repeat(99)], settings: { sound: false } }));
  assert.ok(odd.stages['1-1'] && !odd.stages['3-4'], 'a stage beyond the way through is dropped');
  assert.equal(odd.garden.level, 9999); assert.equal(odd.garden.best, 0); assert.equal(odd.ended, false);
  assert.deepEqual(odd.seen, ['1-1']); assert.equal(odd.settings.sound, false); assert.equal(odd.settings.music, true);
  const s = freshSave();
  assert.ok(stageOpen(s, '1-1') && !stageOpen(s, '1-2') && !skyOpen(s, 2) && !starlightOpen(s) && !gardenOpen(s));
  assert.equal(nextStage(s).id, '1-1');
  const o = record(s, STAGE['1-1'], { home: true, gold: false, par: true, time: 12, leaps: 2 });
  assert.deepEqual(o.stars, [true, false, true]); assert.ok(o.first); assert.equal(o.newStars, 2);
  const o2 = record(s, STAGE['1-1'], { home: true, gold: true, par: false, time: 9, leaps: 6 });
  assert.equal(o2.newStars, 1); assert.deepEqual(s.stages['1-1'].s, [true, true, true], 'stars only go up'); assert.equal(s.stages['1-1'].best, 2);
  assert.equal(record(s, STAGE['1-2'], { home: false, gold: true, par: true, time: 1, leaps: 1 }).newStars, 0, 'not home, no stars');
  for (const st of STAGES.filter((x) => x.sky <= 3)) record(s, st, { home: true, gold: false, par: false, time: 99, leaps: 9 });
  assert.ok(skyDone(s, 1) && gardenOpen(s) && skyOpen(s, 4) && starlightOpen(s));
  const m = record(s, STAGE['1-1'], { home: true, gold: false, par: false, time: 1, leaps: 9 }, true);
  assert.ok(m.medal && m.newMedal && s.stages['1-1'].time === 1, 'a Starlight medal');
  assert.ok(totalStars(s) >= 25);
  for (const st of STAGES) record(s, st, { home: true, gold: true, par: true, time: 1, leaps: 1 });
  assert.equal(totalStars(s), 120); assert.equal(nextStage(s), null);
  const back = readSave(JSON.stringify({ ...s, ended: true }));
  assert.equal(totalStars(back), 120); assert.equal(back.ended, true); assert.ok(back.stages[FINALE]);
});

test('Moon Garden fields grow the same from the same number, and each comes with a route that works', () => {
  for (let level = 1; level <= 12; level++) {
    const a = gardenField(level), b = gardenField(level);
    assert.deepEqual(a.stage, b.stage, `field ${level} is the same every time`);
    assert.ok(a.stage.moons.length >= 3, `field ${level} was grown, not the fallback`);
    const h = new Hop(a.stage); for (const act of a.route) play(h, act);
    assert.ok(h.done && h.got.every(Boolean), `field ${level} can be finished`);
  }
  assert.notDeepEqual(gardenField(3).stage.moons, gardenField(4).stage.moons);
  assert.ok(gardenField(12).stage.moons.length > gardenField(1).stage.moons.length, 'later fields are bigger');
  void wrap;
});

console.log(`\n${passed} Moonhop engine tests passed`);
