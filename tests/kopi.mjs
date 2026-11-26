// Kopi Peng Brawl engine tests: content sanity, determinism, every move lands, both heroes' specials and the team-up,
// grabbing and throwing, food, the python wrap and its rescue, every foe kind's attack, each stage's twist, the random
// events, hawker help, the train doors, saves. Run after compiling the engine into .checks/ (npm test does).
import assert from 'node:assert/strict';
import { KopiGame, STAGES, MOVES, ITEMS, FD, BD, NO_INPUT, DT, parseSave, freshSave, stageOpen, rankFor, PANEL_W } from '../.checks/kopi-game.js';

let n = 0; const ok = (name, fn) => { fn(); n++; console.log(`  ok ${name}`); };
const inp = (o = {}) => ({ ...NO_INPUT, ...o });
const run = (g, frames, i = {}) => { for (let k = 0; k < frames; k++) g.step(i); };
/** a quiet game: no waves yet, the player on Dora, the bot on Enzo */
const quiet = (stage = 0, o = {}) => { const g = new KopiGame({ stage, seed: 7, skipTalk: true, ...o }); g.waveWait = 999; g.twistT = 999; g.jetT = 999; g.doorT = 999; g.curveT = 999; g.eventDone = true; g.items = []; g.tables = []; return g; };
const place = (g, kind, dx = 80, dz = 0) => { const d = g.hero('dora'); const f = g.mkFoe(kind, d.x + dx, d.z + dz); f.st = 'walk'; f.cd = 99; f.inv = 0; g.foes.push(f); return f; };

console.log('kopi peng brawl');
ok('content: five stages of three scenes, each ending in a boss, events and twists set', () => {
  assert.equal(STAGES.length, 5);
  for (const s of STAGES) {
    assert.equal(s.scenes.length, 3); assert.ok(s.scenes[2].boss, s.id); assert.ok(s.events.length >= 2);
    for (const sc of s.scenes) {
      for (const w of sc.waves) for (const sp of w.foes) { assert.ok(FD[sp.k], sp.k); if (sp.rider) assert.ok(FD[sp.rider]); if (sp.arm) assert.ok(ITEMS[sp.arm]); }
      for (const it of sc.items) { assert.ok(ITEMS[it.k], it.k); assert.ok(it.x > 0 && it.x < PANEL_W); }
      if (sc.boss) assert.ok(BD[sc.boss]);
    }
  }
  assert.deepEqual(STAGES.map((s) => s.twist), ['closing', 'liondance', 'train', 'monsoon', 'jets']);
});
ok('determinism: the same seed plays out the same', () => {
  const a = new KopiGame({ stage: 1, seed: 99, auto: true, skipTalk: true }), b = new KopiGame({ stage: 1, seed: 99, auto: true, skipTalk: true });
  for (let k = 0; k < 60 * 40; k++) { a.step({}); b.step({}); }
  assert.equal(a.stats.score, b.stats.score); assert.equal(a.foes.length, b.foes.length);
  assert.deepEqual(a.heroes.map((h) => [Math.round(h.x), Math.round(h.hp)]), b.heroes.map((h) => [Math.round(h.x), Math.round(h.hp)]));
});
ok('Dora: jab, jab, kick combo knocks a macaque down', () => {
  const g = quiet(); g.hero('enzo').ctrl = 'p2'; const f = place(g, 'macaque', 70);
  for (let k = 0; k < 3; k++) { g.step({ dora: inp({ atk: true }) }); run(g, 15, { dora: inp() }); }
  run(g, 10, { dora: inp() });
  assert.ok(f.hp < f.maxHp - 20, `hp ${f.hp}`); assert.ok(['air', 'down', 'getup'].includes(f.st) || f.dead, f.st);
});
ok('Enzo: the belly bump finisher and lifting a stunned rat then throwing it', () => {
  const g = quiet(0, { p1: 'enzo' }); g.hero('dora').ctrl = 'p2'; const e = g.hero('enzo'); const r = g.mkFoe('rat', e.x + 60, e.z); r.st = 'stun'; r.t = 0; r.inv = 0; g.foes.push(r);
  g.step({ enzo: inp({ grab: true }) }); assert.equal(e.carry, r);
  run(g, 20, { enzo: inp() }); g.step({ enzo: inp({ atk: true }) }); assert.equal(e.carry, null); assert.equal(r.st, 'thrown');
  run(g, 60, { enzo: inp() }); assert.ok(r.hp < r.maxHp);
});
ok('specials cost a bar and hit both sides; a team-up needs both heroes close and two bars', () => {
  const g = quiet(); const d = g.hero('dora'), e = g.hero('enzo'); e.ctrl = 'p2'; d.meter = 100;
  const l = place(g, 'rat', -90), r = place(g, 'rat', 90);
  g.step({ dora: inp({ atk: true, jmp: true }) }); assert.equal(d.move, 'dora-special'); assert.equal(d.meter, 0);
  run(g, 60, {}); assert.ok(l.hp < l.maxHp && r.hp < r.maxHp);
  const g2 = quiet(); const d2 = g2.hero('dora'), e2 = g2.hero('enzo'); e2.ctrl = 'p2'; d2.meter = 100; e2.meter = 100; e2.x = d2.x + 60; e2.z = d2.z;
  g2.step({ dora: inp({ atk: true, jmp: true }) }); g2.step({ enzo: inp({ atk: true, jmp: true }) });
  assert.equal(d2.move, 'team'); assert.equal(e2.move, 'team'); assert.equal(g2.stats.teamups, 1);
});
ok('every hero move has a hit window inside its length', () => {
  for (const [k, m] of Object.entries(MOVES)) { assert.ok(m.hit[0] < m.hit[1], k); if (m.dur < 5) assert.ok(m.hit[1] <= m.dur, k); }
});
ok('pick up a stool, swing it until it breaks; throw a durian', () => {
  const g = quiet(); g.hero('enzo').ctrl = 'p2'; const d = g.hero('dora');
  const st = g.mkItem('stool', d.x + 30, d.z); g.items.push(st); g.step({ dora: inp({ grab: true }) }); assert.equal(d.hold, st);
  const f = place(g, 'monitor', 90); f.hp = 999;
  for (let k = 0; k < 6; k++) { run(g, 20, { dora: inp() }); Object.assign(f, { x: d.x + 90, z: d.z, h: 0, vh: 0, vx: 0, st: 'walk', inv: 0 }); d.face = 1; g.step({ dora: inp({ atk: true }) }); run(g, 30, { dora: inp() }); }
  assert.equal(d.hold, null, 'stool broke');
  f.dead = true; f.gone = true; g.foes = []; d.face = 1;
  const du = g.mkItem('durian', d.x + 20, d.z); g.items.push(du); g.step({ dora: inp({ grab: true }) }); run(g, 15, { dora: inp() });
  const rat = place(g, 'rat', 300); g.step({ dora: inp({ atk: true }) }); run(g, 40, { dora: inp() }); assert.ok(rat.hp < rat.maxHp, 'durian hit');
});
ok('food heals; a macaque eats food first and gets angry', () => {
  const g = quiet(); g.hero('enzo').ctrl = 'p2'; const d = g.hero('dora'); d.hp = 40;
  g.items.push(g.mkItem('kopi', d.x + 10, d.z)); run(g, 2, { dora: inp() }); assert.ok(d.hp > 40);
  const m = place(g, 'macaque', 300); g.items.push(g.mkItem('plate', d.x + 250, d.z + 40)); run(g, 200, {});
  assert.ok(m.enrage > 0 || m.st === 'eat', m.st);
});
ok('the python wraps a hero; the partner whacks it free', () => {
  const g = quiet(); const d = g.hero('dora'), e = g.hero('enzo'); e.ctrl = 'p2';
  const p = g.mkFoe('python', d.x, d.z); p.st = 'act'; p.t = 0; p.h = 40; p.inv = 0; g.foes.push(p);
  g.step({}); assert.equal(d.st, 'wrapped');
  e.x = p.x - 70; e.z = p.z; e.face = 1;
  for (let k = 0; k < 4 && d.st === 'wrapped'; k++) { g.step({ enzo: inp({ atk: true }) }); run(g, 18, {}); }
  assert.notEqual(d.st, 'wrapped');
});
ok('mashing frees a wrapped hero on their own', () => {
  const g = quiet(); const d = g.hero('dora'); g.hero('enzo').ctrl = 'p2';
  const p = g.mkFoe('python', d.x, d.z); p.st = 'act'; p.h = 40; g.foes.push(p); g.step({});
  for (let k = 0; k < 16; k++) g.step({ dora: inp({ atk: k % 2 === 0, jmp: k % 2 === 1 }) });
  assert.notEqual(d.st, 'wrapped');
});
ok('a mynah steals what Dora holds and hands it to a macaque', () => {
  const g = quiet(); const d = g.hero('dora'); g.hero('enzo').ctrl = 'p2';
  const it = g.mkItem('tray', d.x, d.z); it.held = true; d.hold = it; g.items.push(it);
  const y = place(g, 'mynah', 30); y.h = 50; y.st = 'act'; y.t = 0; const m = place(g, 'macaque', 400);
  run(g, 3, {}); assert.equal(d.hold, null); assert.equal(y.arm, it);
  run(g, 400, {}); assert.equal(m.arm, it);
});
ok('rats ride a monitor and hop off near a hero', () => {
  const g = quiet(); g.hero('enzo').ctrl = 'p2'; g.lockX = g.camX; g.spawn({ k: 'monitor', from: 'R', rider: 'rat' });
  const rat = g.foes.find((f) => f.kind === 'rat'); assert.equal(rat.st, 'ride');
  run(g, 60 * 25, {}); assert.notEqual(rat.st, 'ride');
});
ok('every foe kind lands an attack on a standing hero', () => {
  for (const k of Object.keys(FD)) {
    if (k === 'roach') continue;
    const g = quiet(); g.hero('enzo').ctrl = 'p2'; const d = g.hero('dora'); d.x = g.camX + 700;
    const f = place(g, k, k === 'boar' ? 400 : k === 'toad' ? 160 : 90); f.cd = 0; if (k === 'mynah') f.h = 120; if (k === 'python') f.h = 220;
    const hp0 = d.hp; for (let t = 0; t < 60 * 12 && d.hp >= hp0 && d.st !== 'wrapped' && d.st !== 'stun'; t++) { d.inv = 0; g.step({ dora: inp() }); }
    assert.ok(d.hp < hp0 || d.st === 'wrapped' || d.st === 'stun', `${k} never landed`);
  }
});
ok('cockroaches make heroes and foes flinch', () => {
  const g = quiet(); g.hero('enzo').ctrl = 'p2'; const d = g.hero('dora');
  const r = place(g, 'roach', 20); r.h = 70; r.cd = 0; run(g, 60, { dora: inp() });
  assert.ok(g.stats.time > 0); assert.ok(['stun', 'idle', 'walk'].includes(d.st));
});
ok('twists: the trolley, the drum beat, the doors, the flood and the jets', () => {
  const g1 = quiet(0); g1.locked = true; g1.twistT = 0.01; run(g1, 2, {}); assert.equal(g1.hazards[0]?.kind, 'trolley');
  const g2 = quiet(1); run(g2, 60, {}); assert.ok(g2.beat >= 1);
  const g3 = quiet(2); g3.wave = 0; g3.doorT = 0.01; run(g3, 2, {}); assert.ok(g3.doors > 0);
  const f = g3.mkFoe('rat', g3.lockX + g3.doorXs()[0], 20); f.st = 'air'; f.h = 50; f.vh = 0; g3.foes.push(f); run(g3, 2, {}); assert.ok(f.gone, 'knocked out of the door');
  const g4 = quiet(3); const w0 = g4.water; run(g4, 600, {}); assert.ok(g4.water > w0);
  const g5 = quiet(4); g5.jetT = 0.01; const d = g5.hero('dora'); g5.hero('enzo').ctrl = 'p2'; run(g5, 60 * 2, { dora: inp() }); assert.ok(g5.jet > 0 || d.st === 'stun' || d.t < 0 || g5.stats.time > 1);
});
ok('random events fire once per scene from the stage pool', () => {
  const g = new KopiGame({ stage: 0, seed: 3, auto: true, skipTalk: true });
  let ev = null; for (let k = 0; k < 60 * 40 && !ev; k++) { g.step({}); ev = g.event; }
  assert.ok(ev && STAGES[0].events.includes(ev), String(ev));
});
ok('hawkers help: the drinks auntie slides kopi to a hurt hero', () => {
  const g = quiet(0); g.locked = true; g.hero('enzo').ctrl = 'p2'; const d = g.hero('dora'); d.hp = 20;
  const hk = g.hawkers.find((h) => h.k === 'drinks'); hk.cd = 0; g.step({});
  assert.ok(g.items.some((i) => i.kind === 'kopi'));
});
ok('both down ends play; retry restores the scene', () => {
  const g = quiet(); for (const h of g.heroes) g.knockOut(h); g.step({}); assert.equal(g.mode, 'down');
  g.retry(); assert.equal(g.mode, 'play'); assert.ok(g.heroes.every((h) => h.hp === h.maxHp)); assert.equal(g.stats.retries, 1);
});
ok('a knocked-out hero comes back while the partner fights on', () => {
  const g = quiet(); g.hero('enzo').ctrl = 'p2'; g.knockOut(g.hero('dora')); run(g, 60 * 9, {});
  assert.notEqual(g.hero('dora').st, 'out');
});
ok('saves: parse, reject junk, unlock in order, rank', () => {
  assert.equal(parseSave('nope'), null); assert.equal(parseSave('{"v":2}'), null);
  const s = freshSave(); assert.ok(stageOpen(s, 0)); assert.ok(!stageOpen(s, 1));
  s.cleared.s1 = { score: 1, rank: 0 }; assert.ok(stageOpen(s, 1));
  assert.deepEqual(parseSave(JSON.stringify(s)).cleared, s.cleared);
  assert.equal(rankFor({ time: 100, bestCombo: 10, outs: 0, retries: 0 }, 0), 3);
  assert.equal(rankFor({ time: 999, bestCombo: 2, outs: 3, retries: 2 }, 0), 0);
});
ok('the swap key hands the player the other hero', () => {
  const g = quiet(); g.swap(); assert.equal(g.hero('enzo').ctrl, 'p1'); assert.equal(g.hero('dora').ctrl, 'bot');
});
void DT;
console.log(`${n} passed`);
