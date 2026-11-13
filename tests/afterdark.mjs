// The Arcade After Dark engine tests: the save and resuming from it, the worlds' layout (22 pearls, every painted frame
// the game asks for), a seed replaying exactly, direct movement, jumping, swimming and currents, the partner following,
// each beat of the chapter in order (the castle wall refusing you without the ping and the quick hop to the sea, the
// conch's ping, the tunnel, the hidden door, the crest's sweep, the braziers, the hub's Static and the cloud cabinet
// waking, the shrine's gust, the storm banks and the pinwheel bridge, the Deep's anchor with its guards, the giant's
// three hearts and the healing), assist (the smart ability, the swap it makes, the auto-glide, the wide catch on the
// chandeliers), assist off (hearts, the checkpoints after the chandelier pit and through the clouds), the castle chest
// reachable on the way through (the ping shakes its cobweb loose), and the wordless hints.
// Run after compiling the engine into .checks/ (npm run test:afterdark does).
import assert from 'node:assert/strict';
import {
  newGame, step, NO_INPUT, SAVE_KEY, freshSave, parseSave, resume, progressOf, pearlsTotal, warp, lead, partner, W0, goal, hintFor, nearThing,
  heroFrame, heroSuffix, platsOf, catchMargin,
} from '../.checks/afterdark-game.js';
import { FR } from '../.checks/afterdark-worlds.js';
import { FRAMES, ATLASES, IMAGES } from '../.checks/afterdark-art.js';
import { existsSync } from 'node:fs';

let n = 0;
const test = (name, fn) => { try { fn(); n++; } catch (e) { console.error(`FAIL ${name}`); throw e; } };
const I = (o = {}) => ({ ...NO_INPUT, ...o });
const run = (g, frames, inp = {}) => { for (let i = 0; i < frames; i++) step(g, I(inp)); };
const until = (g, pred, inp = {}, max = 1200) => { for (let i = 0; i < max; i++) { if (pred(g)) return i; step(g, I(typeof inp === 'function' ? inp(g) : inp)); } assert.fail('timed out'); };
/** in a world, settled, with nothing going on */
const at = (wid, x, y, opts = {}) => { const g = newGame({ seed: 5, ...opts }); warp(g, wid, x, y); run(g, 30); g.events.length = 0; return g; };
const settle = (g) => until(g, (q) => !q.cut && !q.trans, {}, 900);

// ─────────────────────────────── save
test('the save uses after-dark-v1, assist on by default, round-trips and rejects junk', () => {
  assert.equal(SAVE_KEY, 'after-dark-v1');
  const s = freshSave(); assert.equal(s.assist, true);
  s.best = { time: 190, pearls: 21 };
  assert.deepEqual(parseSave(JSON.stringify(s)), s);
  assert.equal(parseSave('nope'), null); assert.equal(parseSave(JSON.stringify({ v: 2, assist: true })), null); assert.equal(parseSave(null), null);
});
test('progress is saved in the hub and resumes with the abilities, the worlds\' locks and the pearls', () => {
  const g = newGame({ preset: 'anchor' });
  assert.equal(g.world, 'hub');
  g.W.sea.pearls[0].got = true; g.W.castle.chest.open = true; g.stats.pearls = 2;
  const p = progressOf(g); assert.ok(p);
  assert.deepEqual(p.pearls.sort(), ['castle:chest', 'sea:0']);
  const r = resume(JSON.parse(JSON.stringify(p)));
  assert.deepEqual(r.abil, { ping: true, sweep: true, gust: true });
  assert.equal(r.stats.pearls, 2); assert.ok(r.W.sea.pearls[0].got); assert.ok(r.W.castle.chest.open);
  assert.ok(r.W.castle.wall.open && r.W.sea.pillar.open && r.W.room.pedestal.taken && r.W.cloud.shrine.taken, 'the worlds remember what was opened');
  assert.ok(r.W.hub.cabs.find((c) => c.id === 'cloud').live, 'the cloud cabinet is awake');
  assert.equal(goal(r), 'sea', 'next: the Deep');
  warp(r, 'castle'); assert.equal(progressOf(r), null, 'nothing is saved mid-world');
});

// ─────────────────────────────── worlds and art
test('22 pearls: 9 in the sea, 4 in the castle plus its chest, 7 in the clouds, 1 in the Deep', () => {
  const g = newGame();
  assert.equal(pearlsTotal(g), 22);
  assert.deepEqual(['sea', 'castle', 'cloud', 'deep'].map((k) => g.W[k].pearls.length), [9, 4, 7, 1]);
});
test('every frame the game draws is painted (heroes in every outfit, props, the giant, the UI)', () => {
  assert.deepEqual(Object.values(FRAMES).filter((f) => !ATLASES.includes(f[0])), [], 'every frame sits in a shipped atlas');
  for (const a of ATLASES) assert.ok(existsSync(`public/art/after-dark/atlas-${a}.webp`), a);
  for (const n in IMAGES) assert.ok(existsSync(`public/art/after-dark/${n}.webp`), n);
  for (const n of ['keycap', 'stick-base', 'stick-knob', 'btn-jump', 'btn-act', 'btn-swap', 'btn-gust', 'ico-ping', 'ico-sweep', 'ico-gust', 'ico-pearl', 'ico-clock', 'face-dora', 'face-enzo', 'g-core']) assert.ok(FRAMES[n], n);
  const g = newGame();
  for (const wid of ['hub', 'castle', 'sea', 'cloud']) {
    warp(g, wid); const w = W0(g), h = lead(g);
    const states = [{}, { hurtT: 1 }, { abilT: 1 }, { gustT: 0.5 }, { gustT: 0.2 }, { reachT: 1 }, { winT: 1 }, { diveT: 1 }, { rollT: 1 }, { braceT: 1 }, { aweT: 1 }, { rideT: 1 }, { glide: true, ground: false }, { ground: false, vy: -5 }, { ground: false, vy: 5 }, { vx: 100 }, { vx: 100, vy: -400 }, { inCurrent: true }];
    for (const name of ['dora', 'enzo']) for (const st of states) {
      const hh = { ...h, name, ground: true, vx: 0, vy: 0, hurtT: 0, abilT: 0, gustT: 0, reachT: 0, winT: 0, diveT: 0, rollT: 0, braceT: 0, aweT: 0, rideT: 0, glide: false, inCurrent: false, landT: 0, ...st };
      if (wid === 'cloud' && st.rideT) hh.ground = false;
      const f = `${name}-${w.outfit}-${heroSuffix(g, hh, w)}`;
      assert.ok(FR(f), `${f} has a painting or a painted stand-in`);
    }
  }
});

// ─────────────────────────────── determinism and movement
test('a seed replays a run exactly', () => {
  const play = () => {
    const g = newGame({ seed: 77 }); let r = 9;
    const rand = () => (r = (r * 48271) % 2147483647) / 2147483647;
    for (let i = 0; i < 2400; i++) step(g, I({ mx: rand() < 0.5 ? 1 : rand() < 0.5 ? -1 : 0, jumpP: rand() < 0.03, jumpH: rand() < 0.5, eP: rand() < 0.01, swapP: rand() < 0.005 }));
    return JSON.stringify({ h: g.heroes, w: g.world, s: g.stats, rs: g.rs });
  };
  assert.equal(play(), play());
});
test('direct movement: press and the hero walks, let go and they stop at once; jump and land', () => {
  const g = at('hub', 300, 640);
  const x0 = lead(g).x; run(g, 30, { mx: 1 });
  assert.ok(Math.abs(lead(g).x - x0 - 130) < 6, 'walks at the hub speed (260 a second)');
  step(g, I()); const x1 = lead(g).x; step(g, I()); assert.equal(lead(g).x, x1, 'stops dead');
  step(g, I({ jumpP: true, jumpH: true })); run(g, 10, { jumpH: true });
  assert.ok(lead(g).y < 560 && !lead(g).ground, 'jumps');
  until(g, (q) => lead(q).ground); assert.equal(lead(g).y, 640);
  step(g, I({ jumpP: true })); run(g, 8); const short = 640 - lead(g).y; until(g, (q) => lead(q).ground);
  step(g, I({ jumpP: true, jumpH: true })); run(g, 8, { jumpH: true }); assert.ok(640 - lead(g).y > short, 'letting go early is a shorter hop');
});
test('the partner follows the leader\'s own trail, and Shift swaps who leads', () => {
  const g = at('hub', 300, 640);
  run(g, 90, { mx: 1 }); run(g, 30);
  const L = lead(g), P = partner(g);
  assert.ok(L.x - P.x > 40 && L.x - P.x < 120, `the partner keeps a step behind (${Math.round(L.x - P.x)})`);
  assert.equal(g.lead, 'dora'); step(g, I({ swapP: true })); assert.equal(g.lead, 'enzo'); assert.equal(g.stats.swaps, 1);
});
test('swimming: move in eight directions, Jump swims up, let go and you hang there; currents carry you', () => {
  const g = at('sea', 800, 350);
  const y0 = lead(g).y; run(g, 20, { my: 1 }); assert.ok(lead(g).y > y0 + 60);
  const y1 = lead(g).y; run(g, 20, { jumpH: true }); assert.ok(lead(g).y < y1 - 60, 'Jump swims up');
  run(g, 30); const x2 = lead(g).x; run(g, 30); assert.ok(Math.abs(lead(g).x - x2) < 2, 'stops');
  warp(g, 'sea', 500, 210); run(g, 30); assert.ok(lead(g).x > 580, 'the current carries you right');
});

// ─────────────────────────────── the chapter, beat by beat
test('without the ping the castle wall only knocks: the castle refuses, and a quick hop portal opens to the sea', () => {
  const g = at('castle', 3880, 640);
  assert.equal(goal(g), 'castle');
  assert.equal(nearThing(g).kind, 'wall'); step(g, I({ eP: true }));
  assert.ok(g.flags.castleBlocked); assert.equal(goal(g), 'sea');
  run(g, 5); const q = g.W.castle.portals[1]; assert.ok(q.open && q.hop === 'sea');
  warp(g, 'hub', 480); run(g, 5); step(g, I({ eP: true })); assert.equal(g.trans, null, 'the castle cabinet wobbles and refuses');
});
test('the conch gives Enzo the ping; the ping opens the pillar\'s tunnel and lights crystals', () => {
  const g = at('sea', 1200, 520);
  until(g, (q) => q.cut, { mx: 1 }, 300);
  assert.equal(g.cut.kind, 'ping'); assert.ok(g.W.sea.conch.used, 'swimming down to the conch is enough'); assert.equal(g.lead, 'enzo', 'Enzo steps up for his gift');
  settle(g); assert.ok(g.abil.ping);
  warp(g, 'sea', 1600, 400); g.lead = 'enzo'; run(g, 2); step(g, I({ jP: true })); run(g, 60);
  assert.ok(g.W.sea.pillar.open && g.flags.tunnel);
  warp(g, 'sea', 2350, 450); step(g, I({ jP: true })); run(g, 60); assert.ok(g.W.sea.crystals[0].lit > 0);
});
test('the ping reveals the castle\'s hidden door; through it the crest gives Dora the sweep', () => {
  const g = at('castle', 3700, 640); g.abil.ping = true; g.lead = 'enzo';
  step(g, I({ jP: true })); run(g, 60); assert.ok(g.W.castle.wall.open && g.flags.door);
  until(g, (q) => q.lead === 'enzo' && lead(q).x > 3815, { mx: 1 }, 300);
  step(g, I({ eP: true })); settle(g); assert.equal(g.world, 'room');
  until(g, (q) => q.cut, { mx: 1 }, 600); assert.equal(g.cut.kind, 'sweep'); settle(g);
  assert.ok(g.abil.sweep); assert.equal(g.lead, 'dora');
});
test('the room: sweep both braziers alight and the Static off the way out, and the portcullis lifts', () => {
  const g = at('room', 300, 615); Object.assign(g.abil, { ping: true, sweep: true }); g.W.room.pedestal.taken = true;
  lead(g).face = 1; step(g, I({ jP: true })); run(g, 40); assert.ok(g.W.room.braziers.every((b) => b.lit));
  warp(g, 'room', 700); lead(g).face = 1; step(g, I({ jP: true })); run(g, 40);
  warp(g, 'room', 900); for (let i = 0; i < 4 && !g.flags.roomClear; i++) { lead(g).face = 1; step(g, I({ jP: true })); run(g, 40); }
  assert.ok(g.flags.roomClear);
});
test('sweeping the hub\'s Static wakes the cloud cabinet', () => {
  const g = newGame(); Object.assign(g.abil, { ping: true, sweep: true });
  assert.equal(goal(g), 'hubsweep');
  warp(g, 'hub', 800); for (let i = 0; i < 6 && !g.flags.hubSwept; i++) { lead(g).face = 1; step(g, I({ jP: true })); run(g, 40, { mx: 1 }); }
  assert.ok(g.flags.hubSwept); settle(g);
  assert.ok(g.W.hub.cabs.find((c) => c.id === 'cloud').live); assert.equal(goal(g), 'cloud');
});
test('the cloud fortress: the updraft lifts you, the shrine gives the gust, the gust blows storm banks away and spins the pinwheel into a bridge', () => {
  const g = newGame({ preset: 'cloud' }); warp(g, 'cloud', 2080, 560); run(g, 2);
  run(g, 40); assert.ok(lead(g).y < 420, 'the updraft lifts');
  warp(g, 'cloud', 2250, 300); until(g, (q) => q.cut, { mx: 1 }, 300); assert.equal(g.cut.kind, 'gust'); settle(g);
  assert.ok(g.abil.gust); assert.ok(!g.W.cloud.banks[0].alive, 'the gift\'s own gust blows the first bank off');
  warp(g, 'cloud', 2950, 380); lead(g).face = 1; step(g, I({ kP: true })); run(g, 90);
  assert.ok(g.W.cloud.wheel.spun && g.W.cloud.bridge.out === 1);
  assert.ok(platsOf(g.W.cloud).some((p) => p.x0 === 3200 && p.x1 === 3560), 'the bridge is walkable');
});
test('the Deep: the ping finds the anchor\'s heart, the gust strips its guards, the sweep dissolves it and the exit opens', () => {
  const g = newGame({ preset: 'anchor' }); warp(g, 'deep', 500, 380); run(g, 5);
  g.lead = 'enzo'; lead(g).face = 1; step(g, I({ jP: true })); run(g, 50); assert.ok(g.W.deep.anchor.found);
  for (let i = 0; i < 12 && !g.W.deep.anchor.bare; i++) { warp(g, 'deep', 500, 380); lead(g).face = 1; step(g, I({ kP: true })); run(g, 30); }
  assert.ok(g.W.deep.anchor.bare);
  for (let i = 0; i < 10 && !g.flags.anchor; i++) { const st = g.W.deep.statics.find((q) => q.alive); warp(g, 'deep', st ? st.x0 - 90 : 700, 380); g.lead = 'dora'; lead(g).face = 1; step(g, I({ jP: true })); run(g, 50); }
  assert.ok(g.flags.anchor); settle(g); assert.ok(g.W.deep.portals[1].open); assert.equal(goal(g), 'boss');
});
test('the giant: ping, gust, sweep, three times; then the arcade heals and the chapter ends', () => {
  const g = newGame({ preset: 'boss', assist: true }); run(g, 2);
  until(g, (q) => q.boss && q.boss.phase === 'shroud', {}, 600);
  for (let hp = 3; hp > 0; hp--) {
    until(g, (q) => q.boss.phase === 'shroud' && !q.cut, {}, 900);
    for (const h of Object.values(g.heroes)) { h.x = 520; h.face = 1; h.invT = 99; h.abilT = 0; h.gustT = 0; }
    step(g, I({ jP: true })); until(g, (q) => q.boss.phase === 'core', {}, 120);
    for (const h of Object.values(g.heroes)) { h.abilT = 0; h.gustT = 0; } step(g, I({ kP: true })); until(g, (q) => q.boss.phase === 'scatter', {}, 60);
    for (const h of Object.values(g.heroes)) { h.x = 830; h.abilT = 0; h.gustT = 0; } step(g, I({ jP: true })); run(g, 2);
    assert.equal(g.boss.hp, hp - 1, `heart ${4 - hp} down`);
  }
  until(g, (q) => q.mode === 'end', {}, 1200);
  assert.ok(g.flags.boss && g.flags.healed); assert.ok(g.W.hub.cabs.every((c) => c.live), 'every cabinet lights up');
});

// ─────────────────────────────── assist and the fixes from the prototype
test('assist: J picks the ability the moment needs and swaps to the hero who has it; off, the wrong hero only reaches', () => {
  const g = at('sea', 1500, 350); Object.assign(g.abil, { ping: true, sweep: true }); g.lead = 'dora';
  step(g, I({ jP: true })); assert.equal(g.lead, 'enzo', 'swapped to Enzo for the pillar'); assert.equal(g.stats.pings, 1);
  const h = at('sea', 1500, 350, { assist: false }); Object.assign(h.abil, { ping: true, sweep: true }); h.lead = 'dora';
  step(h, I({ jP: true })); assert.equal(h.lead, 'dora'); assert.equal(h.stats.pings, 0); assert.equal(h.stats.sweeps, 1, 'Dora sweeps instead');
});
test('assist glides you over open sky by itself; off, you hold Jump', () => {
  const g = newGame({ preset: 'cloud' }); warp(g, 'cloud', 560, 560); run(g, 2); run(g, 30, { mx: 1 });
  assert.ok(lead(g).glide || lead(g).ground);
  const h = newGame({ preset: 'cloud', assist: false }); warp(h, 'cloud', 600, 400); h.W.cloud.plats = []; run(h, 20);
  assert.ok(!lead(h).glide); run(h, 4, { jumpH: true }); assert.ok(lead(h).glide);
});
test('the chandeliers catch a near miss: wide with assist, a little even without (the prototype caught nothing with assist off)', () => {
  assert.equal(catchMargin(newGame()), 34); assert.equal(catchMargin(newGame({ assist: false })), 16);
});
test('assist off: hurts cost hearts, and losing all three after the chandelier pit starts you past it, not at the door', () => {
  const g = at('castle', 3200, 640, { assist: false });
  run(g, 5, { mx: 1 }); assert.ok(g.ckpt && g.ckpt.x > 3150, 'the checkpoint past the pit');
  const knock = (q) => { const L = lead(q), a = q.W.castle.armours[1]; L.invT = 0; L.hurtT = 0; a.x = L.x; a.daze = 0; run(q, 2); };
  let low = 3; for (let i = 0; i < 20 && !(low === 1 && g.hearts === 3); i++) { knock(g); low = Math.min(low, g.hearts); }
  assert.equal(low, 1); assert.equal(g.hearts, 3, 'hearts refill'); assert.ok(lead(g).x > 3150, `back past the pit (${Math.round(lead(g).x)})`);
  const a = at('castle', 3200, 640); for (let i = 0; i < 6; i++) knock(a); assert.ok(a.stats.hurts > 0);
  assert.equal(a.hearts, 3, 'with assist on hurts cost nothing');
});
test('the castle chest is reachable on the way through: Enzo\'s ping shakes its cobweb loose', () => {
  const g = at('castle', 3300, 640); g.abil.ping = true; g.lead = 'enzo'; lead(g).face = 1;
  step(g, I({ jP: true })); run(g, 60); assert.ok(g.W.castle.web.burnt);
  warp(g, 'castle', 3640, 440); run(g, 3); assert.ok(g.W.castle.chest.open); assert.equal(g.stats.pearls, 1);
});
test('hints wait for the player to idle, then point the way in the player\'s own keys', () => {
  const g = newGame(); run(g, 60); assert.equal(g.hint, null, 'not while just started');
  run(g, 240); assert.ok(g.hint); assert.equal(g.hint.key, 'R', 'walk to the castle cabinet');
  warp(g, 'hub', 478); assert.equal(hintFor(g).key, 'E');
  const f = heroFrame(g, lead(g), W0(g)); assert.ok(FR(f), f);
});
console.log(`afterdark: ${n} tests ok`);
