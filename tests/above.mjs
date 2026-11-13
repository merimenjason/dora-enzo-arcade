// Above & Below engine tests: the save, the key maps (solo and two players on one keyboard, a button held by two keys),
// a seed replaying exactly, every painted frame the game can ask for, then each room's rules: the meadow (Dora's stamp,
// the sluice filling the basin, the leaf ride, Enzo's digging and the assist dig, the sapling to climb only once grown,
// the flagstone cracking from a stamp or a landing, the woodlouse, the bolt-holes and the hawk that carries Dora back),
// the orchard (the root bridge only up while Enzo holds it, the ditch scramble, the twin ropes needing both at once,
// the solo hand-off grace and the tired let-go), the stream bank (the lever only running while held, the stamp that
// reveals the clay seam for a few seconds, digging it, the bushes), Old Grubber (swipe and duck, the wave and jump,
// the heaving meadow, the nose stamp, the dizzy boop, three boops to sleep), and the hints (calls, key prompts after
// idling, the ghost demo only with assist, the light auto-help). Run after compiling the engine into .checks/
// (npm run test:above does).
import assert from 'node:assert/strict';
import { AboveGame, NO_PAD, DT, SAVE_KEY, ROOMS, Keys, keyMap, freshSave, parseSave } from '../.checks/above-game.js';
import { Y, X, Y2, X2, Y3, X3, Y4 } from '../.checks/above-rooms.js';
import { FRAMES } from '../.checks/above-art.js';

let n = 0;
const test = (name, fn) => { try { fn(); n++; } catch (e) { console.error(`FAIL ${name}`); throw e; } };
const P = (o = {}) => ({ ...NO_PAD, ...o });
const run = (g, frames, p1 = {}, p2 = {}) => { for (let i = 0; i < frames; i++) g.step(P(p1), P(p2)); };
const sec = (s) => Math.round(s / DT);
/** a game in play in room `room`, solo unless two, with the given hero active */
function room(i, { two = false, assist = true, active = 'dora', seed = 3 } = {}) {
  const g = new AboveGame({ seed, assist }); g.start(two, i);
  if (active !== 'dora') g.swap();
  run(g, 2); g.events.length = 0; return g;
}
const put = (h, x, y) => { h.x = x; h.y = y; h.vx = 0; h.vy = 0; h.ground = true; h.state = 'free'; };
const press = (g, b, frames = 1, held = {}) => { g.step(P({ ...held, [b]: true, [`${b}P`]: true }), P()); run(g, frames - 1, { ...held, [b]: true }); };

// ─────────────────────────────────────────── save, keys, determinism, art
test('the save uses above-and-below-v1, round-trips, and rejects junk', () => {
  assert.equal(SAVE_KEY, 'above-and-below-v1');
  const s = freshSave(); assert.equal(s.assist, true, 'assist is on by default'); assert.equal(s.ck, 0);
  s.ck = 2; s.best = 140.2; s.sound = false;
  assert.deepEqual(parseSave(JSON.stringify(s)), s);
  assert.equal(parseSave('nope'), null); assert.equal(parseSave(JSON.stringify({ v: 2, ck: 1 })), null); assert.equal(parseSave(null), null);
  assert.equal(parseSave(JSON.stringify({ v: 1, ck: 99 })).ck, ROOMS.length - 1, 'a checkpoint past the last room is clamped');
});
test('solo keys drive one pad; two players split the keyboard', () => {
  assert.deepEqual(keyMap('ArrowLeft', false), ['p1', 'l']); assert.deepEqual(keyMap('KeyQ', false), ['p1', 'swap']); assert.deepEqual(keyMap('Enter', false), ['p1', 'act']);
  assert.deepEqual(keyMap('KeyA', true), ['p1', 'l']); assert.deepEqual(keyMap('ArrowLeft', true), ['p2', 'l']);
  assert.deepEqual(keyMap('Slash', true), ['p2', 'jump']); assert.deepEqual(keyMap('Period', true), ['p2', 'act']);
  assert.equal(keyMap('ShiftLeft', true), null, 'no swap in 2P');
  const k = new Keys(); k.down('KeyE'); k.down('Enter');
  let [a] = k.take(); assert.ok(a.act && a.actP);
  [a] = k.take(); assert.ok(a.act && !a.actP, 'a press is fresh for one step only');
  k.up('KeyE'); [a] = k.take(); assert.ok(a.act, 'Enter still holds act'); k.up('Enter'); [a] = k.take(); assert.ok(!a.act);
});
test('a seed replays exactly', () => {
  const play = () => { const g = new AboveGame({ seed: 9 }); g.start(false, 3); for (let i = 0; i < sec(20); i++) g.step(P({ r: i % 200 < 100, l: i % 200 >= 100, jumpP: i % 90 === 0 }), P()); return JSON.stringify(g.snapshot()); };
  assert.equal(play(), play());
});
test('every frame the heroes, beats, hints and rooms ask for is painted', () => {
  const g = new AboveGame();
  const states = [['win'], ['hurt'], ['carried'], ['clamber'], ['climb'], ['ride'], ['free']];
  for (const id of ['dora', 'enzo']) {
    const h = g.heroes[id];
    for (const [st] of states) { h.state = st; for (const t of [0, 0.2, 0.4, 0.7, 1.1]) { h.t = t; h.walkT = t; assert.ok(FRAMES[g.heroFrame(h)], `${id} ${st} ${g.heroFrame(h)}`); } }
    h.state = 'free';
    for (const pose of [{ ground: false, vy: -1 }, { ground: false, vy: 1 }, { ground: true, landT: 0.1 }, { ground: true, landT: 0, ducking: true }, { ducking: false, moving: true }, { moving: false, cue: 'call' }, { cue: 'point' }, { cue: null, idleT: 8 }, { idleT: 20 }])
      { Object.assign(h, pose); for (const t of [0, 0.3, 0.6, 1, 3, 6]) { h.t = t; h.walkT = t; h.idleT = pose.idleT ?? h.idleT; assert.ok(FRAMES[g.heroFrame(h)], `${id} ${JSON.stringify(pose)} ${g.heroFrame(h)}`); } }
    Object.assign(h, { ground: true, landT: 0, ducking: false, moving: false, cue: null, idleT: 0 });
    for (const b of ['hold', 'pull', 'lever']) { h.state = 'brace'; h.brace = { name: b, t: 0, grace: 1 }; for (const t of [0, 0.3]) { h.t = t; assert.ok(FRAMES[g.heroFrame(h)], `${id} brace ${b}`); } }
    for (const a of ['pull', 'stamp', 'dig', 'heave', 'water', 'tired', 'dust']) { h.state = 'act'; h.act = { name: a, t: 0, dur: 1, fired: false }; for (const t of [0, 0.5, 0.9]) { h.act.t = t; assert.ok(FRAMES[g.heroFrame(h)], `${id} act ${a}`); } }
    h.state = 'free'; h.act = null; h.brace = null;
  }
  for (const R of ROOMS) for (const b of R.beats) { assert.ok(FRAMES[b.icon], `${R.id} ${b.id} icon`); if (b.ghost) assert.ok(FRAMES[b.ghost], `${R.id} ${b.id} ghost`); }
  for (const f of ['sluice0', 'sluice1', 'leaf', 'root', 'cup', 'flag', 'broken', 'boulder', 'door0', 'door1', 'worm', 'sap1', 'sap2', 'sap3', 'bug_idle', 'bug_hiss', 'bug_squint', 'bug_ball',
    'hawk1', 'hawk2', 'hawk4', 'rootlog', 'pulley', 'ropepost', 'gate', 'portc', 'bush', 'mound', 'burst', 'chin', 'turf', 'd_face', 'e_face', 'g_face', 'g_nose', 'g_roar',
    'g_idle', 'g_wind', 'g_swipe', 'g_dig', 'g_up', 'g_dizzy', 'g_bonk', 'g_yawn', 'g_sleep', 'd_hide', 'd_dodge', 'e_dodge']) assert.ok(FRAMES[f], f);
});

// ─────────────────────────────────────────── the meadow
test('Dora stamps anywhere; walking is direct, with no slide', () => {
  const g = room(0); const D = g.heroes.dora; put(D, 300, Y.meadow);
  press(g, 'act'); assert.equal(D.state, 'act'); run(g, sec(0.5)); assert.equal(g.stats.stamps, 1); assert.equal(D.state, 'free');
  run(g, sec(0.5), { r: true }); assert.ok(D.x > 380, 'walked'); const x = D.x; run(g, 1); assert.ok(Math.abs(D.x - x) < 0.01, 'stops dead on release');
});
test('the sluice: Dora pulls it, the basin fills, the leaf floats, and Enzo rides it over to the ledge', () => {
  const g = room(0); const D = g.heroes.dora, E = g.heroes.enzo; put(D, 480, Y.meadow);
  press(g, 'act'); run(g, sec(1.1));
  assert.equal(g.o.sluice.open, true); assert.equal(g.cur().id, 'ride');
  run(g, sec(8)); assert.ok(g.water.level < Y.ledge + 10, `the basin fills (${g.water.level})`);
  g.swap(); put(E, g.o.leaf.x, g.o.leaf.y - 6); run(g, 2); assert.equal(E.state, 'ride');
  run(g, sec(6), { r: true }); assert.ok(g.beat >= 2, 'rode off onto the ledge (and, with assist, pushed on through the plug)');
  assert.ok(E.x > X.pitR, 'off the leaf and out of the basin');
});
test('Enzo digs the soft plug, and with assist pushing into soft soil digs it too', () => {
  for (const assist of [true, false]) {
    const g = room(0, { active: 'enzo', assist }); const E = g.heroes.enzo; g.beat = 2; put(E, 640, Y.ledge); run(g, sec(1));   // loose crumbs settle first
    const before = g.world.count(660, 768, 490, Y.ledge);
    run(g, sec(1), { r: true });
    const pushed = g.world.count(660, 768, 490, Y.ledge);
    if (assist) assert.ok(pushed < before, 'assist: walking into soil digs'); else assert.equal(pushed, before, 'no assist: walking into soil does nothing');
    put(E, E.x, Y.ledge); E.face = 1; press(g, 'act'); run(g, sec(0.4));
    assert.ok(g.world.count(660, 768, 490, Y.ledge) < pushed, 'act digs'); assert.ok(g.stats.digs >= 1);
  }
});
test('watering the root grows the sapling, and Dora can climb it only once it is grown', () => {
  const g = room(0); const D = g.heroes.dora, E = g.heroes.enzo; g.o.sluice.open = true; g.beat = 3;
  put(D, 812, Y.meadow); run(g, sec(0.5), { u: true }); assert.equal(D.state, 'free', 'no sapling yet');
  g.swap(); put(E, 798, Y.ledge); press(g, 'act'); assert.equal(E.state, 'act'); run(g, sec(1.2));
  assert.equal(g.o.root.wet > 0, true); assert.equal(g.cur().id, 'climb');
  run(g, sec(1.6)); assert.equal(g.o.sapling.stage, 3);
  g.swap(); put(D, 812, Y.meadow); run(g, sec(2.5), { u: true });
  assert.ok(D.y <= Y.bank + 2 && D.x > X.cliff, 'climbed onto the bank'); assert.equal(g.cur().id, 'stamp');
});
test('the flagstone cracks on a stamp or a landing; the second crack lets the sun in and the woodlouse rolls away', () => {
  const g = room(0); const D = g.heroes.dora; g.beat = 5; put(D, 1062, Y.bank);
  press(g, 'act'); run(g, sec(0.5)); assert.equal(g.o.flag.cracks, 1); assert.equal(g.o.bug.state, 'flinch');
  press(g, 'jump'); run(g, sec(1)); assert.equal(g.o.flag.broken, true, 'a landing cracks it too'); assert.equal(g.cur().id, 'pass');
  run(g, sec(1)); assert.equal(g.o.bug.state, 'ball'); run(g, sec(3)); assert.equal(g.o.bug.state, 'gone');
});
test('the woodlouse in the dark bumps Enzo back while it blocks the way', () => {
  const g = room(0, { active: 'enzo' }); const E = g.heroes.enzo; put(E, 1120, Y.cham);
  run(g, sec(0.6), { r: true }); assert.ok(g.stats.bumps.enzo >= 1);
});
test('the hawk carries Dora in the open back down the bank; a bolt-hole hides her', () => {
  const g = room(0); const D = g.heroes.dora; g.beat = 8; put(D, 1300, Y.meadow);
  for (let i = 0; i < sec(12) && g.stats.hawkCatches === 0; i++) { D.x = 1300; g.step(P(), P()); }
  assert.equal(g.stats.hawkCatches, 1); run(g, sec(2.5)); assert.ok(D.x <= 1120 + 1 && D.x >= 1040, `set down at the start of the stretch (${D.x})`);
  const h = room(0); const D2 = h.heroes.dora; h.beat = 8; popBoth(h);
  const E2 = h.heroes.enzo; put(E2, 1000, Y.cham);
  put(D2, 1441, Y.meadow); run(h, sec(1), { d: true }); assert.ok(D2.y > Y.meadow + 40, 'dropped into the bolt-hole'); assert.equal(h.cur().id, 'door');
  h.beat = 8; for (let i = 0; i < sec(15); i++) { E2.x = 1000; h.step(P(), P()); }
  assert.ok(h.o.hawk.pass >= 1, 'the hawk flew over'); assert.equal(h.stats.hawkCatches, 0, 'hidden below the meadow'); assert.ok(D2.hidden);
});
function popBoth(g) { const E = g.heroes.enzo; for (const x of [1327, 1441]) { g.swap(); put(E, x, Y.hawk); press(g, 'act'); run(g, sec(1.1)); g.swap(); } }
test('Enzo heaves both boulders out of the bolt-holes, and both heroes at the round door leave the meadow', () => {
  const g = room(0); g.beat = 7; popBoth(g);
  assert.deepEqual(g.o.caps.map((c) => c.gone), [true, true]);
  const D = g.heroes.dora, E = g.heroes.enzo; g.beat = 9; put(D, 1470, Y.hawk); put(E, 1480, Y.hawk); run(g, sec(1));
  assert.equal(g.idx, 1, 'on to the orchard'); assert.equal(g.room.id, 'orchard'); assert.deepEqual(g.stats.rooms.map((r) => r[0]), ['meadow']);
});

// ─────────────────────────────────────────── the orchard roots
test('the root bridge rises only while Enzo holds it; alone in the ditch Dora scrambles back out', () => {
  const g = room(1); const D = g.heroes.dora, E = g.heroes.enzo;
  put(D, 550, Y2.ditch); run(g, sec(1.6)); assert.ok(D.state === 'clamber' || D.x < X2.d0, 'scrambled out');
  g.swap(); put(E, X2.mid, Y2.tun); press(g, 'act', sec(1), {}); run(g, sec(0.7), { act: true });
  assert.equal(E.state, 'brace'); assert.ok(g.o.lift > 0.95, `lift ${g.o.lift}`);
  run(g, sec(1)); assert.equal(E.state, 'free', 'letting go ends the brace'); run(g, sec(1)); assert.ok(g.o.lift < 0.1, 'and the bridge sinks');
});
test('the solo hand-off: swap away while holding and Enzo keeps bracing for the grace (longer with assist), then lets go tired', () => {
  for (const [assist, grace] of [[true, 3.6], [false, 2.4]]) {
    const g = room(1, { active: 'enzo', assist }); const E = g.heroes.enzo, D = g.heroes.dora; put(E, X2.mid, Y2.tun);
    press(g, 'act'); run(g, sec(1.5), { act: true }); assert.equal(E.state, 'brace');
    g.step(P({ act: true, swapP: true, swap: true }), P()); assert.equal(g.active, 'dora');
    run(g, sec(grace - 0.3), { act: true }); assert.equal(E.state, 'brace', `still bracing (assist ${assist})`);
    assert.ok(D.actLatch, 'the held act key does not make Dora act'); assert.equal(D.state, 'free');
    run(g, sec(0.5), { act: true }); assert.equal(E.state, 'act', 'let go'); assert.equal(E.act.name, 'tired');
  }
});
test('Dora crosses on the held bridge; the twin ropes need both heroes at once', () => {
  const g = room(1, { active: 'enzo' }); const D = g.heroes.dora, E = g.heroes.enzo; put(E, X2.mid, Y2.tun);
  press(g, 'act'); run(g, sec(1.2), { act: true });
  g.step(P({ act: true, swapP: true, swap: true }), P()); put(D, 470, Y2.meadow);
  run(g, sec(1.4), { r: true, act: true }); assert.equal(g.cur().id, 'ropes', 'crossed');
  put(D, X2.post - 40, Y2.meadow); press(g, 'act'); run(g, sec(2), { act: true }); assert.ok(g.o.rope <= 0.26 && !g.o.gatesUp, 'one rope only creaks the gates');
  const tw = room(1, { two: true }); const D2 = tw.heroes.dora, E2 = tw.heroes.enzo; tw.beat = 1;
  put(D2, X2.post - 40, Y2.meadow); put(E2, X2.post - 40, Y2.tun);
  tw.step(P({ act: true, actP: true }), P({ act: true, actP: true })); run(tw, sec(1.5), { act: true }, { act: true });
  assert.equal(tw.o.gatesUp, true); assert.equal(tw.cur().id, 'exit');
  put(D2, 1480, Y2.meadow); put(E2, 1480, Y2.tun); run(tw, sec(1)); assert.equal(tw.room.id, 'stream');
});
test('a held act key from the hand-off never starts a hold-dig for Enzo', () => {
  const g = room(1); const D = g.heroes.dora, E = g.heroes.enzo; put(D, X2.post - 40, Y2.meadow); put(E, X2.post - 40, Y2.tun);
  press(g, 'act'); run(g, sec(1), { act: true });
  g.step(P({ act: true, swapP: true, swap: true }), P()); run(g, sec(1), { act: true });
  assert.notEqual(E.state, 'act'); assert.equal(g.stats.digs, 0);
  run(g, 1); press(g, 'act'); run(g, sec(1), { act: true }); assert.equal(g.o.gatesUp, true, 'a fresh press grabs the rope');
});

// ─────────────────────────────────────────── the stream bank
test('the lever runs the sluice only while Dora holds it', () => {
  const g = room(2); const D = g.heroes.dora; put(D, X3.lever, Y3.meadow);
  press(g, 'act'); run(g, sec(4), { act: true }); assert.ok(g.water.level < Y3.tun + 10, `fills while held (${g.water.level})`);
  run(g, sec(4)); assert.ok(g.water.level > Y3.tun + 60, 'drains when let go');
});
test('a stamp over the clay reveals a seam for a few seconds (longer with assist) that Enzo can dig', () => {
  for (const [assist, secs] of [[true, 7], [false, 4.5]]) {
    const g = room(2, { assist }); const D = g.heroes.dora, E = g.heroes.enzo; g.beat = 1; put(D, 920, Y3.meadow);
    g.o.hawk.on = true; g.o.hawk.next = 999;   // no hawk for this one
    assert.equal(g.world.cellAt(920, 560), 3, 'hidden clay');
    press(g, 'act'); run(g, sec(0.4)); assert.equal(g.world.cellAt(920, 560), 2, 'revealed'); assert.equal(g.stats.reveals, 1);
    run(g, sec(secs - 0.5)); assert.equal(g.world.cellAt(920, 560), 2, 'still soft');
    run(g, sec(0.8)); assert.equal(g.world.cellAt(920, 560), 3, 'set again');
    press(g, 'act'); run(g, sec(0.4)); g.swap(); put(E, 870, Y3.tun); E.face = 1; press(g, 'act'); run(g, sec(0.4));
    assert.ok(g.stats.digs >= 1 && g.world.cellAt(910, 560) === 0, 'dug');
  }
});
test('ducking in a bush hides Dora from the hawk over the bank', () => {
  const g = room(2); const D = g.heroes.dora; g.beat = 1; put(D, 975, Y3.meadow);
  run(g, sec(20), { d: true }); assert.equal(g.stats.hawkCatches, 0); assert.ok(D.inBush);
  const h = room(2); h.beat = 1; const D2 = h.heroes.dora;
  for (let i = 0; i < sec(14) && !h.stats.hawkCatches; i++) { D2.x = 1300; h.step(P(), P()); }
  assert.equal(h.stats.hawkCatches, 1, 'in the open she is caught');
});

// ─────────────────────────────────────────── Old Grubber's den
const den = (o) => { const g = room(3, o); let k = 0; while (g.o.gb.st === 'intro' && k++ < 600) g.step(P(), P()); return g; };
test('Grubber’s high swipe bumps Enzo unless he ducks; the dirt wave bumps him unless he jumps', () => {
  for (const duck of [false, true]) {
    const g = den({ two: true }); const E = g.heroes.enzo, b = g.o.gb; put(E, 900, Y4.den); b.x = 1150;
    let k = 0; while (b.st !== 'swipe' && k++ < 900) { E.x = 900; g.step(P(), P({ d: duck })); }
    run(g, sec(0.5), {}, { d: duck }); assert.equal(g.stats.bumps.enzo > 0, !duck, `duck ${duck}`);
  }
  const g = den({ two: true }); const E = g.heroes.enzo; put(E, 300, Y4.den); g.o.wave = { x: 600, dir: -1, t: 0 };
  run(g, sec(1)); assert.ok(g.stats.bumps.enzo >= 1, 'the wave knocks him');
});
test('three rounds of nose stamp and boop put Old Grubber to sleep and end the chapter', () => {
  const g = den({ two: true }); const D = g.heroes.dora, E = g.heroes.enzo, b = g.o.gb;
  for (let round = 0; round < 3; round++) {
    let k = 0; while (b.st !== 'nose' && k++ < sec(30)) { put(E, 120, Y4.den); g.step(P(), P()); if (b.st === 'rings') put(D, Math.max(140, b.nx - 300), Y4.meadow); }
    assert.equal(b.st, 'nose', `round ${round}: his nose pokes up`);
    put(D, b.nx, Y4.meadow); g.step(P({ act: true, actP: true }), P()); run(g, sec(0.4)); assert.equal(b.st, 'fall');
    run(g, sec(0.6)); assert.equal(b.st, 'dizzy');
    put(E, b.x - 170, Y4.den); g.step(P(), P({ act: true, actP: true })); run(g, sec(0.5));
    assert.equal(b.hp, 2 - round);
  }
  assert.equal(b.st, 'yawn'); run(g, sec(4.5)); assert.equal(g.mode, 'win'); assert.equal(g.stats.noseStamps, 3);
  assert.ok(g.events.some((e) => e.k === 'win'));
});
test('the tells are longer the first time and with assist', () => {
  const a = den({ assist: true }), b = den({ assist: false });
  for (const g of [a, b]) { let k = 0; while (g.o.gb.st !== 'wind' && k++ < 900) { put(g.heroes.enzo, 120, Y4.den); g.step(P(), P()); } }
  assert.equal(+a.o.gb.tell.toFixed(2), 1.9); assert.equal(+b.o.gb.tell.toFixed(2), 1.6);
});

// ─────────────────────────────────────────── hints and help
test('the other hero points and calls; the key prompt shows after 7 s idle; the ghost only with assist', () => {
  const g = room(0); run(g, sec(6.5)); assert.equal(g.showKeys, false);
  run(g, sec(1)); assert.equal(g.showKeys, true); assert.deepEqual(g.prompt(), { who: 'dora', what: 'move', dir: 1, hold: false });
  assert.ok(g.bubbles.length || g.stats.keyPrompts === 1);
  run(g, sec(6)); assert.ok(g.ghostT > 0, 'the ghost demo after a long idle'); assert.ok(g.ghost());
  const n2 = room(0, { assist: false }); run(n2, sec(30)); assert.equal(n2.ghostT, 0);
  const s = room(0, { active: 'enzo' }); run(s, sec(3)); assert.ok(s.bubbles.some((b) => b.who === 'dora' && b.calling), 'the needed hero calls');
  assert.equal(s.prompt().what, 'swap');
});
test('with assist the hero nobody steers walks to their station; without it they wait', () => {
  for (const assist of [true, false]) {
    const g = room(1, { assist }); const E = g.heroes.enzo, x = E.x; run(g, sec(3));
    assert.equal(Math.abs(E.x - X2.mid) < 20, assist, `assist ${assist}: ${x}→${E.x}`);
  }
});

console.log(`above: ${n} tests passed`);
