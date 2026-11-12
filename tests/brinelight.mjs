// Brinelight engine tests: the save, the hand-authored levels (every row, legend character, event and secret), a seed
// replaying exactly, the dash (double-tap window, no slide, dash attacks), the dash special for both heroes (lands on
// a line, has a landing recovery, can't be chained, doesn't break bosses), the grey/cream rule and its wrong-hero
// prompt, the hermit's shell popping into a throwable, tag chains, the Festival double-team, the special's one-time
// teaching prompt, the secret door, bosses needing both heroes, and that every action has painted frames. Run after
// compiling the engine into .checks/ (npm test does).
import assert from 'node:assert/strict';
import {
  BrineGame, NO_INPUT, DT, SAVE_KEY, freshSave, parseSave, stageOpen, medalFor, AREAS, STAGES, SCENES, HC, MOVES, LANE_Z, timeOfDay,
} from '../.checks/brinelight-game.js';
import { secretIds } from '../.checks/brinelight-levels.js';
import { FRAMES, IMAGES } from '../.checks/brinelight-art.js';
import { FestGame, FEST_DT, FEST_NONE, festAfter } from '../.checks/brinelight-fest.js';

let n = 0;
const test = (name, fn) => { try { fn(); n++; } catch (e) { console.error(`FAIL ${name}`); throw e; } };
const I = (o = {}) => ({ ...NO_INPUT, ...o });
const run = (g, frames, inp = {}) => { for (let i = 0; i < frames; i++) g.step(I(inp)); };
const seq = (g, steps) => { for (const s of steps) g.step(I(s)); };
/** a quiet arena: no tutorial, no events, no foes, the hero standing at x */
function arena(stage = '1-2', who = 'dora', x = 200, assist = true) {
  const g = new BrineGame({ stage, seed: 3, assist, skipTalk: true });
  g.tut.stage = 9; g.evI = 99; g.foes = [];
  if (who === 'enzo') g.doTag(true);
  run(g, 50);
  const p = g.hero(); p.x = x; p.z = 80; p.face = 1;
  g.tagCD = 0; g.events.length = 0;
  return g;
}
const line = (g, kind = 'crab', n = 4, x0 = 360, gap = 80) => {
  const out = [];
  for (let i = 0; i < n; i++) { const f = g.spawnFoe(kind, 1, { lane: 2 }); f.x = x0 + i * gap; f.z = 80; f.st = 'idle'; f.cd = 9; out.push(f); }
  return out;
};
/** a boss fight straight away: the arena locked, the boss past its entrance */
function bossArena(kind, who = 'dora', seed = 2) {
  const stage = { clamps: '1-3', brute: '1-3', longshanks: '3-2', tanglejaw: '3-3' }[kind] ?? '2-3';
  const g = new BrineGame({ stage, seed, skipTalk: true });
  g.tut.stage = 9; g.evI = 99; g.foes = []; g.lock = g.cam;
  g.spawnBoss(kind);
  let k = 0; while (g.boss.st === 'intro' && k++ < 1200) g.step(I());
  if (g.active !== who) g.doTag(true);
  run(g, 40); g.events.length = 0;
  return g;
}
const tap = (dir, hold = 4, gap = 5) => [...Array(hold).fill({ mx: dir }), ...Array(gap).fill({ mx: 0 })];

// ─────────────────────────────────────────── save
test('the save uses brinelight-v1, round-trips, and rejects junk', () => {
  assert.equal(SAVE_KEY, 'brinelight-v1');
  const s = freshSave(); assert.equal(s.assist, true, 'assist is on by default');
  s.cleared['1-1'] = { score: 900, time: 80, medal: 2 }; s.found.push('q2:c0');
  assert.deepEqual(parseSave(JSON.stringify(s)), s);
  assert.equal(parseSave('nope'), null); assert.equal(parseSave(JSON.stringify({ v: 2 })), null); assert.equal(parseSave(null), null);
});
test('stages open in order and medals follow pace and damage', () => {
  const s = freshSave();
  assert.ok(stageOpen(s, '1-1')); assert.ok(!stageOpen(s, '1-2'));
  s.cleared['1-1'] = { score: 1, time: 1, medal: 1 }; assert.ok(stageOpen(s, '1-2')); assert.ok(!stageOpen(s, '2-1'));
  assert.equal(medalFor({ score: 9000, time: 100, dmg: 10 }), 3);
  assert.equal(medalFor({ score: 100, time: 300, dmg: 400 }), 1);
});

// ─────────────────────────────────────────── levels
test('areas 1 to 3 are built with three stages each; 4 to 6 are listed and locked', () => {
  assert.equal(AREAS.length, 6);
  for (const a of AREAS.slice(0, 3)) { assert.ok(a.ready); assert.equal(a.stages.length, 3); for (const s of a.stages) assert.ok(STAGES[s], s); }
  for (const a of AREAS.slice(3)) { assert.ok(!a.ready); assert.equal(a.stages.length, 0); assert.ok(a.boss); }
  const scenes = AREAS[2].stages.flatMap((s) => STAGES[s].scenes);
  assert.equal(scenes.length, 10, 'area 3 has ten scenes'); assert.ok(scenes.some((id) => SCENES[id].secret), 'and a hidden one');
  const goal = (id) => SCENES[id].events.some((e) => ['chase', 'defend', 'ride', 'tide'].includes(e.kind));
  assert.ok(scenes.every((id) => SCENES[id].belt || goal(id) || SCENES[id].events.some((e) => e.kind === 'boss')), 'the belt runs through the ropewalk and shipyard fights');
});
test('every district has a chase, a stall to defend, a ride and a tide, and never more than two plain fights in a row', () => {
  for (const a of AREAS.slice(0, 3)) {
    const ids = a.stages.flatMap((s) => STAGES[s].scenes);
    const kinds = ids.flatMap((id) => SCENES[id].events.map((e) => e.kind));
    for (const k of ['chase', 'defend', 'ride', 'tide']) assert.ok(kinds.includes(k), `area ${a.id} has a ${k}`);
    let run = 0;
    for (const id of ids) {
      const plain = SCENES[id].events.every((e) => ['wave', 'talk', 'cart', 'roll', 'tutorial'].includes(e.kind));
      run = plain ? run + 1 : 0;
      assert.ok(run <= 2, `area ${a.id}: three plain fights in a row at ${id}`);
    }
    for (const id of ids) if (SCENES[id].ride) assert.ok(SCENES[id].events.some((e) => e.kind === 'ride'), `${id} rides`);
  }
  assert.equal(timeOfDay('1-1'), 'dusk'); assert.equal(timeOfDay('2-2'), 'night'); assert.equal(timeOfDay('3-3'), 'fireworks');
});
test('every scene is well formed: equal rows, known characters, events in range, secrets that exist', () => {
  const lane = new Set('.bcskfinagmq'), decor = new Set('.bpocfrSLAXWRDTMNZBOKPCHYGVQFJU@&$%');
  const scenes = new Set();
  for (const st of Object.values(STAGES)) for (const id of st.scenes) { scenes.add(id); if (SCENES[id].secret) scenes.add(SCENES[id].secret); }
  for (const id of scenes) {
    const sc = SCENES[id]; assert.ok(sc, id);
    const w = sc.lanes[0].length;
    assert.equal(sc.lanes.length, 5, id);
    sc.lanes.forEach((r, i) => { assert.equal(r.length, w, `${id} lane ${i}`); for (const c of r) assert.ok(lane.has(c), `${id} lane ${i}: '${c}'`); });
    assert.equal(sc.back.length, w, `${id} back`); assert.equal(sc.front.length, w, `${id} front`);
    for (const c of sc.back + sc.front) assert.ok(decor.has(c), `${id} decor '${c}'`);
    for (let i = 1; i < 5; i++) assert.ok(!sc.lanes[i].includes('a'), `${id}: the way in is in the back lane`);
    assert.equal(sc.lanes[0].includes('a'), !!sc.secret, `${id}: a door iff a secret`);
    for (const e of sc.events) assert.ok(e.col >= 0 && e.col < w, `${id} event at ${e.col}`);
    const charms = sc.lanes.join('').split('').filter((c) => c === 'k' || c === 'g' || c === 'q').length;
    for (const l of sc.belt?.lanes ?? []) assert.ok(l >= 0 && l < 5, `${id} belt lane`);
    assert.equal(charms, sc.charms, `${id} charm count`);
    assert.equal(sc.lanes.join('').includes('m'), !!sc.shanty, `${id} shanty`);
    assert.ok(sc.strings.length > 0 && sc.strings.every((s) => s.need >= 1 && s.need <= 6), `${id} lantern strings`);
  }
  assert.ok(secretIds().length >= 12, 'charms and shanties to find');
});
test('each area has a mid-boss, a boss, a hidden scene, and a lined-up wave that teaches the special', () => {
  for (const [a, mid, boss] of [[1, 'brute', 'clamps'], [2, 'knuckles', 'admiral']]) {
    const ids = AREAS[a - 1].stages.flatMap((s) => STAGES[s].scenes);
    const evs = ids.flatMap((id) => SCENES[id].events);
    assert.ok(evs.some((e) => e.kind === 'boss' && e.who === mid), `area ${a} mid-boss`);
    assert.ok(evs.some((e) => e.kind === 'boss' && e.who === boss), `area ${a} boss`);
    assert.ok(ids.some((id) => SCENES[id].secret), `area ${a} secret`);
    assert.ok(evs.some((e) => e.kind === 'wave' && e.teach === 'special' && e.groups.some((g) => /@\d/.test(g))), `area ${a} teaches the special`);
  }
  const ids = AREAS[2].stages.flatMap((s) => STAGES[s].scenes), evs = ids.flatMap((id) => SCENES[id].events);
  assert.ok(evs.some((e) => e.kind === 'boss' && e.who === 'longshanks') && evs.some((e) => e.kind === 'boss' && e.who === 'tanglejaw'), 'area 3 mid-boss and boss');
  assert.ok(evs.some((e) => e.kind === 'wave' && e.groups.some((g) => /@\d/.test(g))), 'area 3 lines foes up for the special');
  for (const k of ['eel', 'cormorant', 'octo']) assert.ok(evs.some((e) => e.kind === 'wave' && e.groups.some((g) => g.includes(k))), `area 3 brings in ${k}s`);
});
test('a seed replays exactly', () => {
  const play = () => {
    const g = new BrineGame({ stage: '1-1', seed: 42, skipTalk: true });
    for (let i = 0; i < 3600; i++) g.step(I({ mx: i % 200 < 150 ? 1 : 0, mz: i % 90 < 20 ? -1 : i % 90 > 70 ? 1 : 0, atkP: i % 9 === 0, jmpP: i % 97 === 0, tagP: i % 400 === 0 }));
    return JSON.stringify(g.snapshot());
  };
  assert.equal(play(), play());
});

// ─────────────────────────────────────────── dash
test('a double tap dashes: fast, short, and no slide afterwards', () => {
  for (const who of ['dora', 'enzo']) {
    const g = arena('1-2', who); const p = g.hero(), x0 = p.x;
    seq(g, [...tap(1), { mx: 1 }]);
    assert.equal(p.st, 'dash', `${who} dashes`);
    run(g, 40, { mx: 0 });
    const d = p.x - x0 - 4 * HC[who].spd * DT;
    assert.ok(d > HC[who].dash * HC[who].dashT * 0.7 && d < HC[who].dash * HC[who].dashT * 1.3 + 40, `${who} dash distance ${d.toFixed(0)}`);
    const x1 = p.x; run(g, 10); assert.equal(p.x, x1, `${who} stops dead: no slide`);
    assert.equal(g.stats.dashes, 1);
  }
});
test('a slow second tap, or one long press, is just walking', () => {
  const g = arena(); const p = g.hero();
  seq(g, [...tap(1, 4, 20), ...Array(6).fill({ mx: 1 })]); assert.notEqual(p.st, 'dash', 'gap too long');
  const g2 = arena(); seq(g2, [...tap(1, 30, 4), ...Array(6).fill({ mx: 1 })]); assert.notEqual(g2.hero().st, 'dash', 'first press too long');
  const g3 = arena(); seq(g3, [...tap(1, 4, 4), ...Array(4).fill({ mx: -1 })]); assert.notEqual(g3.hero().st, 'dash', 'opposite direction');
});
test('the double-tap window is about 250 ms with assist on and tighter with it off', () => {
  const at = (assist, gap) => { const g = arena('1-2', 'dora', 200, assist); seq(g, [...tap(1, 4, gap), { mx: 1 }]); return g.hero().st === 'dash'; };
  assert.ok(at(true, 14), 'assist on: 233 ms gap dashes');
  assert.ok(!at(true, 17), 'assist on: 283 ms gap does not');
  assert.ok(!at(false, 14), 'assist off: 233 ms gap does not');
  assert.ok(at(false, 10), 'assist off: 167 ms gap dashes');
});
test('Dash + Attack is a dash attack: Dora a flying knee, Enzo a shoulder barge, both knock down', () => {
  for (const [who, mk] of [['dora', 'knee'], ['enzo', 'barge']]) {
    const g = arena('1-2', who); const [f] = line(g, 'crab', 1, 330);
    seq(g, [...tap(1), { mx: 1 }, { mx: 1, atkP: true }]);
    run(g, 30);
    assert.equal(g.stats.dashAtks, 1, `${who} dash attack`);
    assert.ok(MOVES[mk].down);
    assert.ok(f.st === 'down' || f.st === 'up' || f.hp < f.max, `${who}'s ${mk} hit the crab (${f.st})`);
  }
});

// ─────────────────────────────────────────── the special
for (const who of ['dora', 'enzo']) {
  test(`${who}'s special: dash, jump, attack in the air goes through a line of crabs`, () => {
    const g = arena('1-2', who); const crabs = line(g);
    seq(g, [...tap(1), { mx: 1 }, { mx: 1 }, { mx: 1, jmpP: true }, ...Array(8).fill({ mx: 1 }), { mx: 1, atkP: true }]);
    assert.equal(g.hero().st, 'special', 'started');
    assert.equal(g.stats.specials, 1);
    let sawLand = false;
    for (let i = 0; i < 90; i++) { g.step(I()); if (g.hero().st === 'specland') sawLand = true; }
    assert.ok(sawLand, 'a short recovery on landing');
    assert.ok(g.stats.specialHits >= 3, `hit ${g.stats.specialHits} of 4`);
    assert.equal(g.stats.specialLanded, 1);
    assert.ok(crabs.filter((f) => f.st === 'down' || f.st === 'up' || f.st === 'ko' || f.dead).length >= 3);
  });
}
test('the special needs the dash: a plain jump-attack is the normal air attack', () => {
  const g = arena(); line(g);
  seq(g, [{ jmpP: true }, ...Array(8).fill({}), { atkP: true }]);
  assert.equal(g.hero().st, 'airatk'); assert.equal(g.stats.specials, 0);
});
test('the special is not spammable: recovery, then a cooldown', () => {
  const g = arena('1-2', 'enzo');
  const go = () => seq(g, [...tap(1), { mx: 1 }, { mx: 1 }, { mx: 1, jmpP: true }, ...Array(8).fill({ mx: 1 }), { mx: 1, atkP: true }]);
  go(); let t = 0; while (g.hero().st !== 'specland' && t++ < 120) g.step(I());
  // pressing everything during the landing does nothing
  for (let i = 0; i < 14; i++) g.step(I({ mx: 1, atkP: true, jmpP: i % 2 === 0 }));   // through the landing's hit pause
  assert.ok(['specland', 'idle', 'walk'].includes(g.hero().st), g.hero().st);
  assert.equal(g.stats.specials, 1);
  assert.ok(g.hero().specCD > 0, 'cooldown after landing');
});
test('the special does not break bosses: one lands for well under a tenth of a boss', () => {
  for (const who of ['dora', 'enzo']) {
    const g = bossArena('clamps', who);
    const p = g.hero(); p.x = g.boss.x - 380; p.z = g.boss.z; p.face = 1; g.boss.st = 'bare'; g.boss.t = 0;
    const hp0 = g.boss.hp;
    seq(g, [...tap(1), { mx: 1 }, { mx: 1 }, { mx: 1, jmpP: true }, ...Array(8).fill({ mx: 1 }), { mx: 1, atkP: true }, ...Array(60).fill({})]);
    assert.equal(g.stats.specials, 1, `${who} special at the boss`);
    assert.ok(hp0 - g.boss.hp < g.boss.max * 0.1, `${who}: ${(hp0 - g.boss.hp).toFixed(1)} of ${g.boss.max}`);
  }
});
test('the special is taught once, in the player’s own keys, when a line of crabs first appears', () => {
  const g = arena(); line(g, 'crab', 3, 420);
  g.step(I());
  assert.equal(g.prompt?.act, 'special'); assert.equal(g.prompt?.dir, 1);
  seq(g, [...tap(1), { mx: 1 }, { mx: 1 }, { mx: 1, jmpP: true }, ...Array(8).fill({ mx: 1 }), { mx: 1, atkP: true }, ...Array(60).fill({})]);
  line(g, 'crab', 3, g.hero().x + 140);
  g.step(I());
  assert.notEqual(g.prompt?.act, 'special', 'not after the player has done it');
});

// ─────────────────────────────────────────── the two-hero rule
test('Dora’s kicks tink off a hermit’s shell, and two in a row light Enzo’s portrait', () => {
  const g = arena(); const [h] = line(g, 'hermit', 1, 290);
  const hp = h.hp; let tinks = 0, prompt = null;
  for (let i = 0; i < 200 && !prompt; i++) { g.step(I({ atkP: i % 14 === 0 })); tinks += g.events.filter((e) => e.k === 'tink').length; g.events.length = 0; if (g.prompt?.act === 'tag') prompt = g.prompt; }
  assert.ok(tinks >= 2, 'tinks'); assert.ok(h.hp > hp * 0.5, 'hardly any damage');
  assert.equal(prompt?.who, 'partner'); assert.equal(prompt?.tint, 'grey');
});
test('Enzo grabs by walking in: a hermit’s shell pops into something to throw or kick', () => {
  const g = arena('1-2', 'enzo'); const [h] = line(g, 'hermit', 1, 330);
  for (let i = 0; i < 60 && !g.hero().hold; i++) g.step(I({ mx: 1 }));
  run(g, 20);
  assert.equal(h.shell, false, 'popped');
  const shell = g.items.find((it) => it.kind === 'shell'); assert.ok(shell, 'a loose shell');
  assert.equal(g.hero().hold, h);
  run(g, 1, { atkP: true }); run(g, 40);
  assert.equal(g.hero().hold, null, 'thrown');
  // the loose shell can be picked up and thrown too
  const p = g.hero(); p.x = shell.x - 110; p.z = shell.z; p.face = 1; shell.h = 0; shell.vx = 0; shell.vh = 0; shell.slide = 0;
  for (let i = 0; i < 60 && !shell.held; i++) g.step(I({ mx: 1 }));
  assert.ok(shell.held, 'picked up'); run(g, 1, { atkP: true }); run(g, 30); assert.ok(!shell.held);
});
test('a mashing Enzo punches a dazed crab and never picks it up; stopping and walking in grabs it', () => {
  const g = arena('1-2', 'enzo'); const [c] = line(g, 'crab', 1, 270);
  let grabbed = false, punches = 0;
  for (let i = 0; i < 240; i++) {
    c.daze = Math.max(c.daze, 1); c.hp = 50;
    g.step(I({ atkP: i % 9 === 0, mx: i % 40 < 10 ? 1 : 0 }));
    if (g.hero().hold) grabbed = true;
    if (g.hero().st === 'atk' && g.hero().t === 0) punches++;
  }
  assert.ok(!grabbed, 'mashing never grabs'); assert.ok(g.stats.hits >= 10, `punches land (${g.stats.hits})`);
  run(g, 40);
  const p = g.hero(); p.x = c.x - 110; p.z = c.z; p.face = 1; c.daze = 2;
  for (let i = 0; i < 60 && !p.hold; i++) { c.daze = 2; g.step(I({ mx: 1 })); }
  assert.equal(p.hold, c, 'walking in grabs'); run(g, 1, { atkP: true }); run(g, 30); assert.equal(p.hold, null, 'one press throws');
  void punches;
});
test('bosses teach: the first telegraph is held longer, and each phase opens with a one-time hint', () => {
  const g = new BrineGame({ stage: '2-2', seed: 3, skipTalk: true });
  g.tut.stage = 9; g.evI = 99; g.foes = []; g.lock = g.cam; g.spawnBoss('knuckles');
  let hint = null;
  for (let k = 0; k < 1200 && !hint; k++) { g.step(I()); hint = g.bossHint; }
  assert.ok(hint, 'phase 1 hint'); assert.equal(hint.who, 'dora'); assert.equal(hint.act, 'atk'); assert.equal(hint.phase, 1);
  // time each 'tell' (Kid Knuckles' wind-up) while the heroes stand still and soak it
  const tells = []; let t0 = -1;
  for (let k = 0; k < 60 * 40 && tells.length < 3; k++) {
    g.hero().hp = 100; g.partner().hp = 100; g.hero().inv = 1;
    g.step(I());
    if (g.boss.st === 'tell' && t0 < 0) t0 = g.t; if (g.boss.st !== 'tell' && t0 >= 0) { tells.push(g.t - t0); t0 = -1; }
  }
  assert.ok(tells.length >= 2, `saw tells (${tells.length})`);
  assert.ok(tells[0] > tells[1] * 1.35, `first tell longer (${tells.map((t) => t.toFixed(2))})`);
  // phase 2 brings a new hint once
  g.boss.hp = g.boss.max * 0.5; let h2 = null;
  for (let k = 0; k < 200 && !h2; k++) { g.step(I()); if (g.bossHint && g.bossHint.phase === 2) h2 = g.bossHint; }
  assert.ok(h2, 'phase 2 hint'); assert.equal(h2.who, 'enzo');
  for (let k = 0; k < 400; k++) g.step(I());
  assert.equal(g.bossHint, null, 'it fades and does not return');
});
test('in the Fish Market with assist on, kicking an urchin again and again stings more each time, then eases off', () => {
  const sting = (stage, assist, kicks, ko = false) => {
    const g = arena(stage, 'dora', 200, assist); const [u] = line(g, 'urchin', 1, 265);
    if (ko) g.koOnce = true;
    const out = [];
    for (let k = 0; k < kicks; k++) {
      const p = g.hero(); p.inv = 0; p.hp = 100; p.x = 200; p.z = 80; p.face = 1; p.st = 'idle'; p.h = 0; u.x = 265; u.z = 80; u.cd = 9; u.st = 'idle';
      const before = p.hp; run(g, 1, { atkP: true }); run(g, 20);
      out.push(+(before - g.hero().hp).toFixed(2));
    }
    return out;
  };
  const a2 = sting('2-1', true, 5);
  assert.ok(a2[0] > 0, `the spines hurt (${a2})`);
  assert.ok(a2[4] > a2[0] * 3, `the fifth kick in a row stings far more than the first (${a2})`);
  const a1 = sting('1-2', true, 5);
  assert.ok(a1[4] <= a1[0] + 0.01, `not in area 1 (${a1})`);
  const off = sting('2-1', false, 5);
  assert.ok(off[4] <= off[0] + 0.01, `not with assist off (${off})`);
  const eased = sting('2-1', true, 5, true);
  assert.ok(eased[4] <= eased[0] + 0.01, `eased after a knockout (${eased})`);
});
test('gulls in the air are Dora’s: Enzo’s paws miss up there, her jump kick lands', () => {
  const g = arena('1-2', 'enzo'); const [gl] = line(g, 'gull', 1, 280); gl.h = 120; gl.st = 'hover';
  const hp = gl.hp; run(g, 1, { atkP: true }); run(g, 20); assert.ok(gl.hp >= hp - 0.01, 'Enzo can’t reach');
  g.doTag(true); run(g, 30); const p = g.hero(); p.x = gl.x - 70; p.z = gl.z; p.face = 1; gl.h = 120; gl.st = 'hover';
  seq(g, [{ jmpP: true }, ...Array(10).fill({}), { atkP: true }, ...Array(20).fill({})]);
  assert.ok(gl.hp < hp, 'Dora’s jump kick hits');
});
test('tagging in mid-combo chains, and chains fill the Festival meter', () => {
  const g = arena(); line(g, 'crab', 2, 280, 30);
  run(g, 1, { atkP: true }); run(g, 8); run(g, 1, { atkP: true }); run(g, 6);
  const f0 = g.fest; run(g, 1, { tagP: true }); run(g, 30);
  assert.equal(g.stats.tagChains, 1); assert.ok(g.fest > f0);
});
test('a full Festival meter turns Attack + Jump into the double-team', () => {
  const g = arena(); line(g, 'crab', 3, 300, 40);
  g.fest = 100; run(g, 1, { atkP: true, jmpP: true });
  assert.equal(g.stats.dbls, 1); assert.equal(g.fest, 0);
  run(g, 200);
  assert.ok(g.foes.every((f) => f.hp < f.max || f.dead));
});
test('the hidden door opens only once a scene’s fights are done', () => {
  const g = new BrineGame({ stage: '1-2', seed: 1, skipTalk: true });
  assert.ok(SCENES.s1.secret);
  assert.equal(g.secretDoor(), null, 'shut while there are fights ahead');
  g.evI = g.scene.events.length; g.wave = null; g.boss = null;
  const x = g.secretDoor(); assert.ok(x !== null, 'open after');
  const p = g.hero(); p.z = LANE_Z[0];
  for (let i = 0; i < 900 && !g.inSecret; i++) g.step(I({ mx: Math.sign(x - p.x), mz: -1 }));
  assert.equal(g.inSecret, true); assert.equal(g.scene.id, SCENES.s1.secret);
});
test('bosses need both heroes: Clamps in his barrel shrugs off Dora alone', () => {
  const g = bossArena('clamps', 'dora', 5);
  const b = g.boss, hp0 = b.hp;
  for (let i = 0; i < 600; i++) { const p = g.hero(); p.x = b.x - 120; p.z = b.z; p.face = 1; p.hp = 100; g.step(I({ atkP: i % 10 === 0 })); }
  assert.equal(g.active, 'dora');
  assert.ok(hp0 - b.hp < b.max * 0.15, `Dora alone: ${(hp0 - b.hp).toFixed(1)} of ${b.max}`);
  assert.ok(g.stats.tinks > 0, 'and she hears the tink');
});

// ─────────────────────────────────────────── art
test('every action has painted frames, landing and the specials included', () => {
  const need = {
    dora: ['idle', 'idle2', 'walk1', 'walk2', 'walk3', 'walk4', 'dash', 'knee', 'k1w', 'k1', 'k2w', 'k2', 'k4w', 'k4', 'k4f', 'jump', 'fall', 'land', 'dive', 'rise', 'hurt', 'hurt2', 'down', 'getup', 'tag', 'tagleap', 'pick', 'win', 'win2', 'sp0', 'sp1', 'sp2', 'sp3', 'face'],
    enzo: ['idle', 'idle2', 'walk1', 'walk2', 'walk3', 'walk4', 'dash', 'barge', 'p1w', 'p1', 'p2', 'p3w', 'p3', 'jump', 'land', 'hammer', 'reach', 'hold', 'throww', 'throw', 'heave', 'hurt', 'hurt2', 'down', 'getup', 'tag', 'win', 'win2', 'sp0', 'sp1', 'sp2', 'sp3', 'face'],
    crab: ['idle', 'walk', 'walk2', 'wind', 'wind2', 'atk', 'hurt', 'down', 'getup', 'tumble', 'daze'],
    gull: ['idle', 'flap', 'flap2', 'wind', 'dive', 'hurt', 'down', 'crash', 'carry'],
    hermit: ['idle', 'walk', 'walk2', 'wind', 'atk', 'roll', 'hurt', 'down', 'soft', 'shell'],
    puffer: ['idle', 'walk1', 'walk2', 'wind', 'atk', 'puffed', 'hurt', 'down'],
    shrimp: ['idle', 'run1', 'run2', 'whistle1', 'whistle2', 'hurt', 'down'],
    lobster: ['idle', 'walk1', 'walk2', 'block', 'wind', 'atk', 'hurt', 'down'],
    jelly: ['idle', 'pulse', 'drift', 'charge', 'zap', 'hurt', 'down'],
    urchin: ['idle', 'roll1', 'roll2', 'wind', 'hurt', 'down'],
    brute: ['idle', 'walk', 'wind', 'atk', 'hurt', 'block', 'bidle', 'bwalk', 'bwind', 'batk', 'bhurt', 'down'],
    clamps: ['idle', 'rock1', 'rock2', 'roll', 'dizzy', 'bare', 'bwind', 'bswipe', 'juggle', 'bdizzy', 'down'],
    knuckles: ['idle', 'step1', 'step2', 'tell', 'punch', 'flurry', 'guard', 'hop', 'hurt', 'dizzy', 'down'],
    admiral: ['stand', 'shriek', 'dive', 'swoop', 'tumble', 'grounded', 'pinned', 'hurt', 'wingw', 'hover', 'down'],
    eel: ['peek', 'duck', 'lunge', 'reach', 'tired', 'hurt', 'held', 'thrown', 'down', 'walk1', 'walk2', 'hole'],
    cormorant: ['fly1', 'fly2', 'aim', 'dive', 'stuck', 'hurt', 'down', 'waddle'],
    octo: ['perch', 'puff', 'squirt', 'fall', 'walk1', 'walk2', 'slap', 'hurt', 'down', 'ink', 'post', 'idle'],
    longshanks: ['idle', 'walk1', 'walk2', 'raise', 'stomp', 'crouch', 'sweep', 'toppled', 'thurt', 'tdizzy', 'climb', 'down'],
    tanglejaw: ['peek', 'tell', 'lunge', 'strike', 'stuck', 'hurt', 'whip', 'roar', 'sink', 'down', 'hole', 'plug'],
  };
  for (const [k, list] of Object.entries(need)) for (const a of list) assert.ok(FRAMES[`${k}-${a}`], `${k}-${a}`);
  for (const p of ['barrel', 'crate', 'crate-cracked', 'fishcrate', 'ice', 'net-hang', 'net-down', 'cart', 'hatch', 'hatch-open', 'charm', 'scroll', 'snack', 'bun', 'lantern-lit', 'string-dark', 'string-lit', 'npc-mabel', 'npc-twins', 'npc-barnaby', 'face-mabel', 'face-twins', 'face-barnaby',
    'npc-hal', 'npc-hal-talk', 'npc-hal-cheer', 'face-hal', 'tarbarrel', 'bobbin', 'scaffold', 'ropecoil', 'planks', 'pulley', 'anchor', 'sawhorse', 'paints', 'figurehead', 'winch', 'lamppost'])
    assert.ok(FRAMES[p], p);
});

// ─────────────────────────────────────────── area 3: the Ropewalk and Shipyard
const inHoleJs = (f) => f.kind === 'eel' && !f.loose;
const untilT = (g, cond, max = 600, inp = {}) => { for (let k = 0; k < max; k++) { if (cond()) return true; g.step(I(inp)); } return cond(); };
test('the belt: a barrel rumbles and marks its lane first, then rolls down it; stepping out of the lane or jumping dodges it', () => {
  const g = arena('3-1', 'dora', 400); g.sendRoll(2, 'barrel', false);
  assert.ok(g.events.some((e) => e.k === 'sfx' && e.id === 'rumble'), 'the rumble');
  run(g, 60); assert.equal(g.hero().hp, 100, 'the tell does not hurt'); assert.ok(g.rolls[0].t < g.rolls[0].tell, 'still rumbling after a second');
  run(g, 150); assert.ok(g.hero().hp < 100, 'standing in the marked lane gets you bowled over');
  const g2 = arena('3-1', 'dora', 400); g2.sendRoll(2, 'barrel', false);
  run(g2, 40); run(g2, 22, { mz: 1 }); run(g2, 150); assert.equal(g2.hero().hp, 100, 'one lane over, it rolls past');
  const g3 = arena('3-1', 'dora', 400); g3.sendRoll(2, 'barrel', false);
  untilT(g3, () => g3.rolls[0].t >= g3.rolls[0].tell && g3.rolls[0].x - g3.hero().x < 130);
  g3.step(I({ jmpP: true })); run(g3, 60); assert.equal(g3.hero().hp, 100, 'a jump clears it');
});
test('Enzo punches a rolling barrel to a stop and it is his to carry; Dora’s kick just bounces off', () => {
  const near = (g) => () => g.rolls.length && g.rolls[0].t >= g.rolls[0].tell && g.rolls[0].x - g.hero().x < 175;
  const g = arena('3-1', 'enzo', 400); g.sendRoll(2, 'barrel', false);
  untilT(g, near(g)); g.step(I({ atkP: true })); run(g, 20);
  assert.equal(g.rolls.length, 0, 'stopped'); assert.ok(g.items.some((i) => i.kind === 'barrel'), 'a barrel on the boards'); assert.equal(g.hero().hp, 100);
  assert.ok(g.learned.stop >= 1);
  const d = arena('3-1', 'dora', 400); d.sendRoll(2, 'barrel', false);
  untilT(d, near(d)); d.step(I({ atkP: true })); run(d, 30);
  assert.ok(d.hero().hp < 100, 'Dora gets bowled'); assert.ok(d.events.some((e) => e.k === 'tink' && e.want === 'enzo') || d.stats.tinks > 0, 'and the barrel glints grey');
});
test('eels: Dora’s kicks only make a peeking eel duck; a missed lunge leaves it stretched out for anyone; Enzo hauls it out', () => {
  const g = arena('3-1', 'dora', 400);
  const f = g.spawnFoe('eel', 1, { lane: 2 }); f.x = f.tx = 470; f.z = f.tz = 80; f.st = 'idle'; f.t = 0; f.cd = 9;
  g.step(I({ atkP: true })); run(g, 12);
  assert.equal(f.st, 'duck', 'it ducks'); assert.equal(f.hp, f.max, 'unhurt'); assert.ok(g.stats.tinks >= 1, 'and the tink says it is Enzo’s');
  // it comes back up and lunges at a hero in its lane; she jumps it
  untilT(g, () => f.st === 'idle'); f.cd = 0; g.hero().x = 340;
  untilT(g, () => f.st === 'wind'); untilT(g, () => f.st === 'atk' || f.t > (g.assist ? 1.15 : 0.8), 120);
  g.step(I({ jmpP: true })); untilT(g, () => f.st === 'rec', 60);
  assert.equal(f.st, 'rec', 'stretched out on the boards'); assert.equal(g.hero().hp, 100, 'the jump cleared the lunge');
  untilT(g, () => g.hero().h <= 0 && g.hero().st !== 'land', 60);
  g.hero().x = f.x - 70; g.hero().face = 1; const hp0 = f.hp;
  g.step(I({ atkP: true })); run(g, 12);
  assert.ok(f.hp < hp0, 'now her kicks land'); assert.ok(inHoleJs(f), 'and it is still in its hole');
  // Enzo's paws pull a peeking eel straight out
  const e = arena('3-1', 'enzo', 400);
  const f2 = e.spawnFoe('eel', 1, { lane: 2 }); f2.x = f2.tx = 470; f2.z = f2.tz = 80; f2.st = 'idle'; f2.t = 0; f2.cd = 9;
  e.step(I({ atkP: true })); run(e, 12);
  assert.ok(f2.loose, 'popped out onto the boards'); assert.ok(f2.hp < f2.max);
});
test('cormorants: a ring follows you and locks, the dive sticks it in the planks, and Dora’s rising kick knocks it out of the sky', () => {
  const g = arena('3-2', 'dora', 400);
  const f = g.spawnFoe('cormorant', 1); f.x = 560; f.h = 185; f.st = 'hover'; f.t = 0; f.cd = 0;
  untilT(g, () => f.st === 'wind'); assert.ok(Math.abs(f.tx - g.hero().x) < 20, 'the ring is under you');
  untilT(g, () => f.st === 'dive'); const lock = f.tx;
  g.hero().x += 0; run(g, 0);
  untilT(g, () => f.st === 'crash', 120); assert.equal(f.st, 'crash', 'beak stuck in the planks'); assert.equal(f.tx, lock);
  assert.ok(f.daze > 0, 'and it can be grabbed');
  const h = arena('3-2', 'dora', 400);
  const c = h.spawnFoe('cormorant', 1); c.x = 560; c.h = 185; c.st = 'hover'; c.t = 0; c.cd = 0;
  untilT(h, () => c.st === 'wind'); run(h, 16);
  h.hero().face = Math.sign(c.x - h.hero().x) || 1;
  h.step(I({ jmpP: true })); h.step(I()); h.step(I({ atkP: true })); run(h, 14);
  assert.ok(c.st === 'crash' || c.st === 'down' || c.st === 'ko', `knocked out of the sky (${c.st})`);
  const e = arena('3-2', 'enzo', 400);
  const c2 = e.spawnFoe('cormorant', 1); c2.x = 470; c2.h = 185; c2.st = 'hover'; c2.cd = 9;
  e.step(I({ atkP: true })); run(e, 12); assert.equal(c2.hp, c2.max, 'Enzo’s paws miss up there');
});
test('inkers: a squirt splats ink over the screen; knocking the inker off its post clears it, and only Dora (or Enzo’s slam) reaches it', () => {
  const g = arena('3-2', 'dora', 300);
  const f = g.spawnFoe('octo', 1); f.x = f.tx = 400; f.z = f.tz = 20;
  untilT(g, () => f.st === 'perch'); f.cd = 0;
  untilT(g, () => g.ink.length > 0, 300); assert.ok(g.ink.length > 0, 'ink');
  g.hero().x = 340; g.hero().z = 20; g.hero().face = 1;
  g.step(I({ atkP: true })); run(g, 10);
  assert.ok(f.loose, 'knocked off its post'); assert.equal(g.ink.length, 0, 'and the ink clears');
  const e = arena('3-2', 'enzo', 300);
  const o = e.spawnFoe('octo', 1); o.x = o.tx = 400; o.z = o.tz = 20; untilT(e, () => o.st === 'perch'); o.cd = 99;
  e.hero().x = 330; e.hero().z = 20; e.hero().face = 1;
  e.step(I({ atkP: true })); run(e, 16);
  assert.ok(!o.loose, 'his first paw can’t reach it'); assert.equal(o.hp, o.max);
  for (let i = 0; i < 5 && !o.loose; i++) { e.step(I({ atkP: true })); run(e, 9); }
  assert.ok(o.loose, 'the slam at the end of his combo shakes it off');
});
test('Longshanks: up on his stilts kicks barely tickle; his stomp sticks a leg, Enzo heaves him over, and then Dora’s kicks land hard', () => {
  const g = bossArena('longshanks', 'dora'); const b = g.boss, p = g.hero();
  assert.equal(g.bossHint?.who ?? 'enzo', 'enzo');
  p.x = b.x - 90; p.z = b.z; p.face = 1; let hp0 = b.hp;
  for (let i = 0; i < 4; i++) { g.step(I({ atkP: true })); run(g, 12); }
  assert.ok(hp0 - b.hp < 1.5, `ground kicks barely hurt him (${(hp0 - b.hp).toFixed(2)})`);
  untilT(g, () => { g.hero().hp = 100; g.hero().inv = 1; return b.st === 'stomp'; }, 1200);
  assert.equal(b.st, 'stomp', 'the leg is stuck');
  g.doTag(true); run(g, 30);
  const e = g.hero(); e.x = b.tx - 60; e.z = b.tz; e.face = 1;
  g.step(I({ atkP: true })); run(g, 40);
  assert.equal(b.st, 'toppled', 'Enzo heaves him over');
  g.doTag(true); run(g, 25);
  const d = g.hero(); d.x = b.x - 80; d.z = b.z; d.face = 1; hp0 = b.hp;
  for (let i = 0; i < 3; i++) { g.step(I({ atkP: true })); run(g, 10); }
  assert.ok(hp0 - b.hp > 5, `Dora’s kicks land (${(hp0 - b.hp).toFixed(1)})`);
  // a barrel thrown into his stilts bowls him over too
  const h = bossArena('longshanks', 'enzo'); const hb = h.boss, he = h.hero();
  const it = h.addItem('barrel', he.x, he.z, 0, 0, 0); it.held = true; he.hold = it; he.st = 'hold'; he.t = 0; he.z = hb.z; he.x = hb.x - 260; he.face = 1;
  h.step(I({ atkP: true })); untilT(h, () => hb.st === 'toppled', 90);
  assert.equal(hb.st, 'toppled', 'bowled over');
});
test('Old Tanglejaw: until two holes are plugged he slips back; Enzo carries barrels onto them, then the last hole’s lunge leaves him stuck for Dora', () => {
  const g = bossArena('tanglejaw', 'dora'); const b = g.boss;
  assert.equal(g.holes.length, 3);
  untilT(g, () => { g.hero().hp = 100; g.hero().inv = 1; return b.st === 'stretched'; }, 1200);
  let d = g.hero(); d.x = b.x - b.dir * 70; d.z = b.z; d.face = b.dir; let hp0 = b.hp;
  g.step(I({ atkP: true })); run(g, 10);
  assert.ok(hp0 - b.hp < 1, 'with the holes open, her kicks barely hurt');
  // Enzo carries two barrels onto the two holes he isn't in
  g.doTag(true); run(g, 30);
  for (let n = 0; n < 2; n++) {
    const e = g.hero(), free = g.holes.map((h, i) => i).filter((i) => !g.holes[i].plug && !(i === b.hole && b.st !== 'under' && b.st !== 'bubble'));
    const hi = free.find((i) => i !== b.hole) ?? free[0], h = g.holes[hi];
    const it = g.addItem('barrel', e.x, e.z, 0, 0, 0); it.held = true; e.hold = it; e.st = 'hold'; e.t = 0;
    e.x = h.x - 90; e.z = h.z; e.face = 1;
    run(g, 30, { mx: 1 });
    assert.ok(h.plug, `hole ${hi} plugged`);
  }
  assert.equal(g.plugs(), 2);
  g.doTag(true); run(g, 30);
  untilT(g, () => { g.hero().hp = 100; g.hero().inv = 1; return b.st === 'stretched'; }, 1200);
  assert.equal(b.st, 'stretched', 'he had to come out of the last hole');
  d = g.hero(); d.x = b.x - b.dir * 70; d.z = b.z; d.face = b.dir; hp0 = b.hp;
  for (let i = 0; i < 3; i++) { g.step(I({ atkP: true })); run(g, 10); }
  assert.ok(hp0 - b.hp > 5, `stuck out, he takes Dora’s kicks (${(hp0 - b.hp).toFixed(1)})`);
  // a new phase: his roar blows the barrels back out, and they land ready to use again
  b.hp = b.max * 0.6; run(g, 30);
  assert.equal(g.plugs(), 0, 'the plugs pop'); assert.ok(g.items.filter((i) => i.kind === 'barrel').length >= 2, 'barrels to carry again');
  assert.equal(g.bossHint?.phase, 2);
});
test('a sealed tar barrel breaks open on a lantern charm', () => {
  const g = arena('3-1', 'enzo', 300);
  g.props.push({ id: 999, kind: 'barrel', x: 380, z: 80, hp: 2, content: 'charm', sid: 'r2:c0', alive: true, vx: 0, hitList: [], fall: 0, down: false, flash: 0 });
  run(g, 30, { mx: 1 }); assert.ok(g.hero().hold, 'Enzo picks it up');
  g.step(I({ atkP: true })); run(g, 90);
  assert.ok(g.items.some((i) => i.kind === 'charm' && i.sid === 'r2:c0'), 'a charm');
});
test('area 3 bosses open each phase with whose job it is', () => {
  const l = bossArena('longshanks'); assert.deepEqual([l.bossHint?.who, l.bossHint?.act], ['enzo', 'atk']);
  const t = bossArena('tanglejaw'); assert.deepEqual([t.bossHint?.who, t.bossHint?.act], ['enzo', 'carry']);
});

// ─────────────────────────────────────────── scene goals and the festival breathers
/** a stage started straight at one of its scenes, past the tutorial; runs until the scene's goal has begun */
function goalScene(stage, id, who = 'dora', assist = true) {
  const g = new BrineGame({ stage, seed: 5, assist, skipTalk: true });
  g.tut.stage = 9; g.sceneI = g.sceneIds.indexOf(id); g.enterScene(id);
  if (who === 'enzo') g.doTag(true);
  let k = 0; while (!g.goal && k++ < 600) { g.step(I({ mx: 1 })); }
  assert.ok(g.goal, `${id} goal started`);
  return g;
}
test('the chase: the camera scrolls by itself, a jump kick at the swooping thief wins the lanterns', () => {
  const g = goalScene('1-1', 'q2'), G = g.goal;
  assert.equal(G.kind, 'chase'); assert.equal(g.lock, null);
  const c0 = g.cam; g.foes = []; run(g, 60); assert.ok(g.cam > c0 + 90, 'scrolling');
  assert.ok(g.hero().x >= g.camL + 36, 'the left edge pushes you along');
  // catch it on a swoop
  g.foes = []; const p = g.hero(); Object.assign(G, { st: 'swoop', stT: 0, x: p.x + 70, z: p.z, h: 70 });
  p.face = 1; seq(g, [{ jmpP: true }, {}, {}, {}, {}, {}, {}, {}, { atkP: true }]); run(g, 12);
  assert.ok(G.won, 'caught'); assert.equal(g.stats.goals, 1);
  assert.ok(g.strings[0].flying + g.strings[0].got > 0, 'the lanterns fly home');
});
test('the chase: a thief that gets away costs its lanterns, never the game', () => {
  const g = goalScene('1-1', 'q2'), G = g.goal;
  for (let k = 0; k < 60 * 40 && !G.done; k++) { g.foes = []; g.step(I()); }
  assert.ok(G.done); assert.ok(!G.won); assert.equal(g.stats.goalsLost, 1);
  assert.equal(g.strings[0].got + g.strings[0].flying, 0, 'no lanterns');
  run(g, 60 * 5, { mx: 1, mz: 1 }); assert.notEqual(g.scene.id, 'q2', 'the stage carries on');
});
test('defend: raiders bash the stall when you are away, a broken stall loses only its lanterns, the fight ends on time', () => {
  const g = goalScene('1-2', 'sd'), G = g.goal;
  assert.equal(G.kind, 'defend'); assert.equal(G.hp, 100); assert.notEqual(g.lock, null);
  const p = g.hero(); let k = 0;
  while (G.hp === 100 && k++ < 60 * 20) { p.x = g.camL + 40; p.z = 150; g.step(I()); }
  assert.ok(G.hp < 100, 'a raider got to the stall');
  G.hp = 1; k = 0; while (G.hp > 0 && k++ < 60 * 20) { p.x = g.camL + 40; p.z = 150; p.hp = 100; g.step(I()); }
  assert.equal(G.st, 'broken'); assert.equal(g.stats.goalsLost, 1);
  G.t = 99; g.foes = []; run(g, 2);
  assert.ok(G.done); assert.equal(g.lock, null); assert.equal(g.stats.goals, 0);
});
test('defend: holding out for the time with the stall standing wins its lanterns', () => {
  const g = goalScene('2-2', 'md'), G = g.goal;
  assert.equal(G.def.what, 'cart');
  G.t = 99; g.foes = []; run(g, 2);
  assert.ok(G.done && G.won); assert.equal(g.stats.goals, 1);
});
test('ride: the view keeps moving, and a foe knocked past the edge of the deck goes overboard', () => {
  const g = goalScene('1-3', 'bg'), G = g.goal;
  assert.equal(G.kind, 'ride'); assert.equal(g.scene.ride, 'barge');
  const r0 = g.rideX; run(g, 30); assert.ok(g.rideX > r0, 'the harbour slides past');
  const f = g.spawnFoe('crab', 1); f.x = g.camR - 10; f.z = 80; f.st = 'down'; f.h = 10; f.vh = 0;
  run(g, 2);
  assert.equal(f.st, 'ko'); assert.equal(g.stats.overboard, 1);
  // boarders leap aboard from the water
  const b = g.foes.find((o) => o.script === 'board'); if (b) { run(g, 20); assert.ok(b.h > 0 || b.t > 0.6); }
});
test('the tide: it creeps in from the left, chips a hero who stays in it (never below a quarter with assist on), washes foes away', () => {
  const g = goalScene('1-3', 'bt'), G = g.goal;
  assert.equal(G.kind, 'tide');
  const p = g.hero(), f = g.spawnFoe('crab', 1); f.st = 'idle'; f.cd = 99;
  let k = 0; while (G.front < p.x + 30 && k++ < 60 * 30) { g.foes = g.foes.filter((o) => o === f); f.x = p.x - 40; f.z = 150; g.step(I()); }
  assert.ok(f.st === 'ko' || f.dead, 'washed away');
  run(g, 60 * 20); assert.ok(p.hp >= 25 && p.hp < 100, `chipped, not knocked out (${p.hp})`);
  const off = goalScene('1-3', 'bt', 'dora', false), q = off.hero();
  off.goal.front = q.x + 100; off.foes = [];
  const h0 = q.hp; run(off, 60); assert.ok(q.hp < h0 - 4, 'faster with assist off');
  // and reaching the dry end wins it
  g.cam = g.len - 430; p.x = g.len - 140; g.foes = []; run(g, 3); assert.ok(G.done && G.won);
});
test('the hours: dusk paintings for each first stage, fireworks for the boss stage, and painted frames for every goal', () => {
  for (const a of AREAS.slice(0, 3)) {
    for (const id of STAGES[a.stages[0]].scenes) { const far = SCENES[id].far; if (!SCENES[id].ride) assert.ok(IMAGES['dusk-' + far], `dusk ${far}`); }
  }
  assert.ok(IMAGES.fireworks && IMAGES['far-lift'] && IMAGES['floor-barge'] && IMAGES['floor-raft'] && IMAGES['floor-lift']);
  for (const n of ['thief-fly1', 'thief-fly2', 'thief-swoop', 'thief-hit', 'thief-flee', 'thief-taunt', 'stall-0', 'stall-3', 'fishcart-0', 'fishcart-3', 'tide-1', 'tide-2', 'tide-3', 'tide-water',
    'fest-pot', 'fcrab-peek', 'fcrab-up', 'fcrab-bonk', 'gcrab-up', 'gcrab-bonk', 'flantern-dark', 'flantern-lit', 'bottles', 'bottles-tumble', 'bottles-down', 'fball',
    'pair-reach', 'pair-hang', 'pair-cheer', 'pair-oops', 'fenzo-windup', 'fenzo-toss', 'fenzo-cheer']) assert.ok(FRAMES[n], n);
  for (const k of ['whack', 'lanterns', 'bottles']) assert.ok(IMAGES['fest-' + k], k);
});
const fstep = (F, n, inp = {}) => { for (let i = 0; i < n; i++) F.step({ ...FEST_NONE, ...inp }); };
test('the breathers take turns between stages, and doing nothing still wins a lantern', () => {
  assert.deepEqual(['1-1', '1-2', '1-3', '2-1'].map(festAfter), ['whack', 'lanterns', 'bottles', 'whack']);
  for (const kind of ['whack', 'lanterns', 'bottles']) {
    const F = new FestGame({ kind, seed: 3 }); fstep(F, Math.ceil(F.dur / FEST_DT) + 2);
    assert.ok(F.done); assert.equal(F.reward(), 1);
  }
});
test('whack-a-crab: each pot has its own button; bonking a crab scores, a gold one three', () => {
  const F = new FestGame({ kind: 'whack', seed: 4 });
  const keys = ['atkP', 'jmpP', 'tagP'];
  let got = 0;
  for (let k = 0; k < 60 * 25 && !F.done; k++) {
    const i = F.pots.findIndex((p) => p.st === 'up');
    const before = F.score;
    F.step({ ...FEST_NONE, ...(i >= 0 ? { [keys[i]]: true } : {}) });
    if (i >= 0) { assert.equal(F.pots[i].st, 'bonk'); assert.equal(F.score - before, F.pots[i].gold ? 3 : 1); got++; }
  }
  assert.ok(got >= 16, `bonked ${got}`); assert.equal(F.reward(), 3, 'a good run wins three lanterns');
  const E = new FestGame({ kind: 'whack', seed: 4 }); E.step({ ...FEST_NONE, atkP: true }); assert.equal(E.score, 0, 'an empty pot scores nothing');
});
test('hanging lanterns: they arrive on the beat; on the beat is perfect, near it good, early does nothing', () => {
  const F = new FestGame({ kind: 'lanterns', seed: 1, bpm: 120 });
  fstep(F, 2);
  const l = F.lanterns[0]; assert.ok(l, 'a lantern on its way');
  assert.ok(Math.abs(((l.arrive - 0.15) / 0.5) - Math.round((l.arrive - 0.15) / 0.5)) < 1e-6, 'on a beat');
  while (F.t < l.arrive - 0.01) fstep(F, 1);
  fstep(F, 1, { atkP: true }); assert.equal(l.st, 'hung'); assert.equal(l.grade, 2); assert.equal(F.score, 2);
  const m = F.lanterns.find((x) => x.st === 'fly');
  while (F.t < m.arrive - 0.2) fstep(F, 1);
  fstep(F, 1, { jmpP: true }); assert.equal(m.st, 'hung'); assert.equal(m.grade, 1, 'good');
  const e = F.lanterns.find((x) => x.st === 'fly');
  while (F.t < e.arrive - 0.5) fstep(F, 1);
  fstep(F, 1, { tagP: true }); assert.equal(e.st, 'fly', 'too early');
});
test('the bottle toss: the ball lands where the marker was; a stack under it topples, and a cleared shelf refills', () => {
  const F = new FestGame({ kind: 'bottles', seed: 1 });
  let k = 0;
  for (const s of F.stacks) {
    while (Math.abs(F.aim - s.x) > 0.02 && k++ < 6000) fstep(F, 1);
    fstep(F, 1, { atkP: true }); fstep(F, 40);
    assert.notEqual(s.st, 'up', `stack at ${s.x}`);
  }
  fstep(F, 30); assert.equal(F.score, 8, 'three stacks and the bonus'); assert.equal(F.rounds, 1);
  fstep(F, 60); assert.ok(F.stacks.every((s) => s.st === 'up'), 'refilled');
});

console.log(`Brinelight: ${n} engine tests passed.`);
