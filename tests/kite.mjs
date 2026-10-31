// Kite Day engine tests: the tethered kite's physics, the wind window, stalls, the six kite shapes, tricks, rings,
// deliveries, duels and tangles, the festival routine, medals, unlocks and saves. Run against the compiled engine.
import assert from 'node:assert/strict';
import * as K from '../.checks/kite-game.js';
import { careful, run } from './kite-bot.mjs';

let n = 0;
const test = (name, fn) => { fn(); n++; };
const design = (shape = 'diamond') => ({ shape, paint: K.DEFAULT_PAINT[shape] });
const fly = (place, opts = {}) => new K.Flight({ place, challenge: opts.challenge ?? null, design: design(opts.shape), flyer: 'dora', seed: opts.seed });
const steps = (f, secs, inp = K.NO_INPUT) => { for (let i = 0; i < secs * K.FPS && !f.done; i++) f.step(typeof inp === 'function' ? inp(f, i) : inp); return f; };
const finite = (k) => [k.x, k.y, k.vx, k.vy, k.psi, k.L, k.tension].every(Number.isFinite);
const calm = (place) => ({ ...K.PLACES[place], wind: { ...K.PLACES[place].wind, speed: 0, gust: 0, lull: 0, rough: 0 }, thermals: [], ridges: [] });

// ---------------------------------------------------------------- physics invariants
test('the line never stretches: the kite stays within its line of the paws, and the line within its limits', () => {
  for (const place of K.PLACE_IDS) for (const shape of K.SHAPE_IDS) {
    const f = fly(place, { shape, seed: 5 }); const r = K.rng(place.length * 13 + shape.length);
    let inp = K.NO_INPUT;
    for (let i = 0; i < 40 * K.FPS; i++) {
      if (i % 20 === 0) inp = { pull: r() < 0.35, ease: r() < 0.4, steer: r() < 0.4 ? (r() < 0.5 ? -1 : 1) : 0, aim: r() < 0.3 ? [f.me.hx + r() * 20, f.me.hy + r() * 20] : null, walk: r() < 0.2 ? (r() < 0.5 ? -1 : 1) : 0 };
      f.step(inp);
      const k = f.me;
      assert.ok(finite(k), `${place}/${shape}: the kite's numbers stay finite`);
      assert.ok(k.L >= K.LMIN - 1e-6 && k.L <= k.lmax + 1e-6, `${place}/${shape}: line length in range (${k.L})`);
      if (k.state === 'fly') assert.ok(Math.hypot(k.x - k.hx, k.y - k.hy) <= k.L + 1e-3, `${place}/${shape}: within the line`);
      assert.ok(k.hx >= f.P.walk[0] - 1e-6 && k.hx <= f.P.walk[1] + 1e-6, `${place}: the flier stays on their patch`);
    }
  }
});

test('hands off, a diamond in a fair breeze keeps flying, high above the grass', () => {
  for (const place of ['meadow', 'beach', 'cliffs']) {
    const f = steps(fly(place, { seed: 3 }), 40);
    assert.equal(f.me.state, 'fly', `${place}: still up`);
    assert.ok(f.me.y - K.surfaceAt(f.P, f.me.x) > 3, `${place}: high above the ground`);
    assert.ok(!f.events.some((e) => e.k === 'land'), `${place}: never came down`);
  }
});

test('pulling climbs and draws the line in; easing lets it out', () => {
  const a = fly('meadow', { seed: 2 }); steps(a, 4);
  const L0 = a.me.L; steps(a, 2, { ...K.NO_INPUT, pull: true });
  assert.ok(a.me.L < L0 - 3, 'pulling reels in');
  const L1 = a.me.L; steps(a, 3, { ...K.NO_INPUT, ease: true });
  assert.ok(a.me.L > L1 + 4, 'easing lets out line');
  const L2 = a.me.L; steps(a, 2);
  assert.ok(Math.abs(a.me.L - L2) < 1.5, 'with neither, the reel holds');
});

test('the wind window: the kite pulls hardest in the middle of the window and hardly at all at its edge', () => {
  const P = K.PLACES.beach;
  const tensionAt = (elev) => {
    const k = new K.Kite(design('diamond'), 'dora'); K.setHand(k, P, P.start); k.L = 15;
    k.x = k.hx + Math.cos(elev) * 15; k.y = k.hy + Math.sin(elev) * 15; k.vx = k.vy = 0; k.psi = elev + Math.PI / 2; k.tail = [];
    let T = 0; for (let i = 0; i < 4; i++) { K.stepKite(k, P, 1, 0, K.NO_INPUT, 0, []); T = Math.max(T, k.tension); }
    return T;
  };
  const middle = tensionAt(0.35), edge = tensionAt(1.5);
  assert.ok(middle > edge * 2.5, `middle ${middle.toFixed(2)} vs edge ${edge.toFixed(2)}`);
});

test('no wind, no flight: the kite stalls, tumbles down, is reeled in and waits for a breeze', () => {
  const f = fly('meadow', { seed: 1 }); f.P = calm('meadow');
  steps(f, 20);
  const kinds = f.events.map((e) => e.k);
  assert.ok(kinds.includes('tumble') || kinds.includes('land'), 'it stalls or drops');
  assert.ok(kinds.includes('land'), 'it comes down');
  assert.ok(!kinds.includes('launch'), 'it is not relaunched into still air');
  assert.notEqual(f.me.state, 'fly');
});

test('a slack line in still air stalls the kite into a tumble', () => {
  const f = fly('hilltop', { seed: 4 }); steps(f, 6);
  const k = f.me; k.L = k.lmax; k.vx = 0; k.vy = 0;
  f.P = calm('hilltop');
  const before = f.events.length; steps(f, 4);
  assert.ok(f.events.slice(before).some((e) => e.k === 'tumble'), 'tumbles');
});

test('a kite that lands in a tree or the pond is reeled back in and relaunched', () => {
  const f = fly('meadow', { seed: 6 }); steps(f, 3);
  const pond = K.PLACES.meadow.water[0], k = f.me;
  const x = pond[0] + 3; K.setHand(k, f.P, x - 12); k.x = x; k.y = K.surfaceAt(f.P, x) + 0.05; k.vx = 0; k.vy = -2; k.L = Math.hypot(k.x - k.hx, k.y - k.hy) + 1; f.step(K.NO_INPUT);
  assert.equal(k.state, 'down'); assert.equal(k.down, 'water');
  steps(f, 15, { ...K.NO_INPUT, pull: true });
  assert.ok(f.events.some((e) => e.k === 'launch'), 'relaunched');
  assert.equal(k.state, 'fly');
});

// ---------------------------------------------------------------- the six kites
test('the six kites really differ: the swallow turns fastest, the box and sled slowest; the box is the heaviest', () => {
  const spin = (shape) => { const f = steps(fly('beach', { shape, seed: 8 }), 4); let tot = 0, p = f.me.psi; for (let i = 0; i < 2 * K.FPS; i++) { f.step({ ...K.NO_INPUT, steer: 1 }); let d = f.me.psi - p; d = Math.atan2(Math.sin(d), Math.cos(d)); tot += Math.abs(d); p = f.me.psi; } return tot; };
  const s = Object.fromEntries(K.SHAPE_IDS.map((sh) => [sh, spin(sh)]));
  assert.ok(s.bird > s.diamond && s.diamond > s.box && s.diamond > s.sled, JSON.stringify(s));
  assert.ok(K.SHAPES.box.mass > Math.max(...K.SHAPE_IDS.filter((x) => x !== 'box').map((x) => K.SHAPES[x].mass)));
  assert.ok(K.SHAPES.sled.mass < Math.min(...K.SHAPE_IDS.filter((x) => x !== 'sled').map((x) => K.SHAPES[x].mass)));
  assert.ok(K.SHAPES.dragon.tail > K.SHAPES.diamond.tail * 1.5, 'the dragon has the long tail');
});

test('the box shrugs off gusty air: its nose wanders less than the swallow\'s in the same sea wind', () => {
  const wander = (shape) => { const f = steps(fly('beach', { shape, seed: 9 }), 3); let sum = 0, p = f.me.psi; for (let i = 0; i < 15 * K.FPS; i++) { f.step(K.NO_INPUT); let d = f.me.psi - p; d = Math.atan2(Math.sin(d), Math.cos(d)); sum += Math.abs(d); p = f.me.psi; } return sum; };
  assert.ok(wander('box') < wander('bird'));
});

test('the delta is the quickest kite crosswind, and the sled climbs highest in a light breeze', () => {
  const speed = (shape) => { const f = steps(fly('beach', { shape, seed: 10 }), 3); let s = 0; for (let i = 0; i < 12 * K.FPS; i++) { f.step({ ...K.NO_INPUT, aim: [f.me.hx + (Math.floor(i / 120) % 2 ? 4 : 18), f.me.hy + 10] }); s += f.me.speed; } return s; };
  assert.ok(speed('delta') > speed('box'), 'delta faster than box');
  const height = (shape) => { const f = fly('hilltop', { shape, seed: 11 }); let h = 0; for (let i = 0; i < 30 * K.FPS; i++) { f.step({ ...K.NO_INPUT, ease: f.me.L < 20 }); h += f.me.state === 'fly' ? f.me.y - f.me.hy : 0; } return h; };
  assert.ok(height('sled') > height('box'), 'sled higher than box in light air');
});

// ---------------------------------------------------------------- tricks
test('flying straight is not a trick; holding a turn high up is a loop; a loop each way is a figure-eight', () => {
  const plain = steps(fly('meadow', { seed: 3 }), 30);
  assert.equal(plain.events.filter((e) => e.k === 'trick').length, 0, 'no tricks hands-off');
  const f = run('b2', careful, 1);
  const tricks = f.events.filter((e) => e.k === 'trick' && e.who === 0);
  assert.ok(f.tricks[0].loops > 0, 'loops read');
  assert.ok(f.tricks[0].eights > 0, 'figure-eights read');
  assert.ok(f.tricks[0].score >= f.tricks[0].loops * K.TRICK_POINTS.loop, 'chains only add');
  void tricks;
});

// ---------------------------------------------------------------- rings, pops, deliveries
test('rings count in order only, and the last one finishes the challenge with the time', () => {
  const f = fly('meadow', { challenge: 'm1' }); const g = f.ch.goal.rings;
  const put = ([x, y]) => { f.me.x = x; f.me.y = y; f.me.vx = f.me.vy = 0; f.me.L = Math.hypot(x - f.me.hx, y - f.me.hy) + 1; f.step(K.NO_INPUT); };
  put([g[1].x, g[1].y]); assert.equal(f.next, 0, 'ring 2 before ring 1 does not count');
  put([g[0].x, g[0].y]); assert.equal(f.next, 1);
  put([g[1].x, g[1].y]); put([g[2].x, g[2].y]);
  assert.ok(f.done && f.won); assert.equal(f.medal, 3, 'a quick run is gold');
  assert.ok(f.events.some((e) => e.k === 'ring' && e.last));
});

test('parcels make the kite heavier, and each basket takes one', () => {
  const f = fly('orchard', { challenge: 'o1' }); const k = f.me;
  assert.equal(k.parcels, 2); assert.ok(k.mass > K.SHAPES.diamond.mass);
  const [x, y] = f.ch.goal.baskets[0]; k.x = x; k.y = y; f.step(K.NO_INPUT);
  assert.equal(k.parcels, 1); assert.ok(f.delivered[0] && !f.done);
});

test('a race is lost to the dragonfly if it gets to the last gate first', () => {
  const ch = K.CHALLENGE.o3; const f = new K.Flight({ place: ch.place, challenge: 'o3', design: design(), flyer: 'enzo' });
  assert.ok(f.dfTime > 5 && f.dfTime < ch.goal.limit);
  assert.equal(K.medalFor(ch, f.dfTime + 1, f), 0);
  assert.ok(K.medalFor(ch, f.dfTime - 0.1, f) >= 1);
  assert.equal(K.medalFor(ch, ch.marks[2] - 0.1, f), 3);
});

// ---------------------------------------------------------------- duels and tangles
test('crossed lines tangle: both kites come down and nobody scores', () => {
  const f = fly('cliffs', { challenge: 'c2' }); const me = f.me, o = f.other;
  for (let i = 0; i < 2.2 * K.FPS && !f.events.some((e) => e.k === 'tangle'); i++) {
    me.x = me.hx + 12; me.y = me.hy + 4; o.x = me.hx - 1; o.y = me.hy + 10; me.vx = me.vy = o.vx = o.vy = 0;
    if (me.state !== 'fly') break;
    f.step(K.NO_INPUT);
  }
  assert.ok(f.events.some((e) => e.k === 'tangle'), 'tangled');
  assert.notEqual(me.state, 'fly'); assert.notEqual(o.state, 'fly');
  assert.deepEqual(f.touches, [0, 0]);
});

test('touching the rival\'s streamer scores, three touches win; the rival scores on yours', () => {
  const f = fly('cliffs', { challenge: 'c2' }); const me = f.me, o = f.other;
  steps(f, 1);
  for (let t = 0; t < 3; t++) {
    const n = 5; me.x = o.tail[n * 2] + o.vx * K.DT; me.y = o.tail[n * 2 + 1] + o.vy * K.DT; me.vx = o.vx; me.vy = o.vy; me.L = Math.hypot(me.x - me.hx, me.y - me.hy) + 1; f.touchCool = 0; f.step(K.NO_INPUT);
  }
  assert.equal(f.touches[0], 3); assert.ok(f.done && f.won); assert.equal(f.medal, 3, 'a clean sweep is gold');
  const idle = run('c2', () => () => K.NO_INPUT, 1);
  assert.ok(!idle.won, 'doing nothing loses the duel');
});

// ---------------------------------------------------------------- the finale
test('the finale: being at a gate on its beat scores, perfect beats score more, and Dora flies with Enzo', () => {
  const f = fly('cliffs', { challenge: 'c4' }); const c = f.ch.goal.cues[0];
  assert.equal(f.other.who, 'enzo', 'the partner is the other chinchilla');
  steps(f, c.t - 0.2);
  f.me.x = c.x; f.me.y = c.y; f.me.vx = f.me.vy = 0; f.step(K.NO_INPUT);
  const e = f.events.find((e) => e.k === 'cue');
  assert.ok(e && e.good && e.perfect && e.points >= 150);
  const late = fly('cliffs', { challenge: 'c4' }); steps(late, c.t + 1.6);
  assert.ok(late.events.some((e) => e.k === 'cue' && !e.good), 'a missed beat is missed');
});

// ---------------------------------------------------------------- determinism
test('a seed and the same inputs replay a flight exactly', () => {
  const script = (f, i) => ({ pull: i % 200 < 50, ease: i % 200 > 120, steer: i % 300 > 250 ? 1 : 0, aim: null, walk: i % 500 > 450 ? 1 : 0 });
  const a = steps(fly('orchard', { challenge: 'o2' }), 30, script), b = steps(fly('orchard', { challenge: 'o2' }), 30, script);
  assert.deepEqual([a.me.x, a.me.y, a.me.psi, a.me.L, a.next], [b.me.x, b.me.y, b.me.psi, b.me.L, b.next]);
  assert.deepEqual(a.events, b.events);
  const c = steps(fly('orchard', { challenge: 'o2', seed: 99 }), 30, script);
  assert.notEqual(c.me.x, a.me.x, 'another seed blows another wind');
});

test('the wind moves: gusts and lulls come and go, thermals lift, and trees shelter the air behind them', () => {
  const P = K.PLACES.orchard; let gusts = 0, lulls = 0;
  for (let t = 0; t < 120; t += 0.5) { const g = K.gustAt(P, 3, 20, t); if (g.gust > P.wind.gust * 0.55) gusts++; if (g.lull > 0.25) lulls++; }
  assert.ok(gusts > 3 && lulls > 3, `gusts ${gusts}, lulls ${lulls}`);
  const H = K.PLACES.hilltop, th = H.thermals[0];
  let lift = 0; for (let t = 0; t < 60; t += 0.5) lift = Math.max(lift, K.windAt(H, 1, th.x, K.groundAt(H, th.x) + 8, t).w);
  assert.ok(lift > 0.5, 'thermals rise');
  const tree = P.trees.find((t) => t.x > P.start), behind = K.windAt(P, 1, tree.x + tree.r + 2, K.groundAt(P, tree.x) + tree.h * 0.7, 10);
  assert.ok(behind.shelter > 0.3, 'the air behind a tree is sheltered');
});

// ---------------------------------------------------------------- medals, unlocks, saves
test('medals: lower times and higher scores are better, nothing beyond the marks', () => {
  const lo = K.CHALLENGE.m2, hi = K.CHALLENGE.m3;
  assert.equal(K.medalFor(lo, lo.marks[2]), 3); assert.equal(K.medalFor(lo, lo.marks[1]), 2); assert.equal(K.medalFor(lo, lo.marks[0]), 1);
  assert.equal(K.medalFor(hi, hi.marks[2]), 3); assert.equal(K.medalFor(hi, hi.marks[0] - 1), 0);
  for (const c of K.CHALLENGES) {
    const [b, s, g] = c.marks;
    if (c.better === 'low') assert.ok(g <= s && s <= b, c.id); else assert.ok(g >= s && s >= b, c.id);
  }
});

test('the summer opens place by place, and the finale needs the cliffs\' rings and both duels', () => {
  const pr = {};
  assert.ok(K.placeOpen(pr, 'meadow') && !K.placeOpen(pr, 'orchard'));
  assert.ok(K.challengeOpen(pr, 'm1') && !K.challengeOpen(pr, 'm2'));
  for (const id of ['m1', 'm2', 'm3']) pr[id] = { best: 1, medal: 1 };
  assert.ok(K.placeOpen(pr, 'orchard'), 'all but one done opens the next place');
  assert.ok(!K.placeOpen(pr, 'cliffs'));
  for (const c of K.CHALLENGES) if (c.place !== 'cliffs') pr[c.id] = { best: 1, medal: 1 };
  assert.ok(K.placeOpen(pr, 'cliffs'));
  pr.c1 = { best: 1, medal: 1 }; pr.c2 = { best: 1, medal: 1 };
  assert.ok(!K.challengeOpen(pr, 'c4')); pr.c3 = { best: 1, medal: 1 }; assert.ok(K.challengeOpen(pr, 'c4'));
  assert.deepEqual(K.shapesOwned(pr).sort(), ['bird', 'box', 'delta', 'diamond', 'dragon', 'sled']);
});

test('saves round-trip; results only ever improve; new kites and stencils are reported', () => {
  const s = K.freshSave();
  const f = run('m2', careful, 1); assert.ok(f.won);
  const r = K.recordResult(s, f);
  assert.equal(r.newShape, 'sled'); assert.ok(r.newStencils.includes('sun')); assert.ok(r.best);
  const worse = { ...f, value: f.value + 50, medal: 1, won: true, ch: f.ch };
  K.recordResult(s, worse); assert.equal(s.progress.m2.best, f.value); assert.equal(s.progress.m2.medal, f.medal);
  s.shape = 'sled'; s.designs.sled = { sail: 3, stencil: 'sun', ink: 1, tail: 2 }; s.flyer = 'enzo'; s.settings.music = false;
  const back = K.readSave(JSON.stringify(s));
  assert.deepEqual(back, s);
});

test('corrupt and odd saves are ignored or cleaned, never misread', () => {
  const fresh = K.freshSave();
  for (const raw of [null, '', '{', 'null', '[]', '42', '"x"', JSON.stringify({ v: 2, progress: { m1: { best: 3, medal: 3 } } })]) assert.deepEqual(K.readSave(raw), fresh, String(raw));
  const odd = K.readSave(JSON.stringify({ v: 1, progress: { m1: { best: -4, medal: 3 }, m2: { best: 12, medal: 9 }, m3: { best: 'x' }, zz: { best: 1, medal: 1 }, m4: { best: 20, medal: 2 } },
    designs: { diamond: { sail: 99, stencil: 'skull', ink: 1.5, tail: 2 }, nope: {} }, shape: 'dragon', flyer: 'ziggy', ended: true, settings: { sound: false, music: 'loud', steer: 'joystick' } }));
  assert.deepEqual(Object.keys(odd.progress), ['m4']);
  assert.deepEqual(odd.designs.diamond, { sail: K.DEFAULT_PAINT.diamond.sail, stencil: K.DEFAULT_PAINT.diamond.stencil, ink: K.DEFAULT_PAINT.diamond.ink, tail: 2 });
  assert.equal(odd.shape, 'diamond', 'a kite you have not earned is not picked');
  assert.equal(odd.flyer, 'dora'); assert.equal(odd.ended, false); assert.equal(odd.settings.sound, false); assert.equal(odd.settings.music, true); assert.equal(odd.settings.steer, 'aim');
});

console.log(`kite: ${n} tests passed`);
