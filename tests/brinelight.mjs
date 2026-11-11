// Brinelight engine tests: the save, the hand-authored levels (every row, legend character, event and secret), a seed
// replaying exactly, the dash (double-tap window, no slide, dash attacks), the dash special for both heroes (lands on
// a line, has a landing recovery, can't be chained, doesn't break bosses), the grey/cream rule and its wrong-hero
// prompt, the hermit's shell popping into a throwable, tag chains, the Festival double-team, the special's one-time
// teaching prompt, the secret door, bosses needing both heroes, and that every action has painted frames. Run after
// compiling the engine into .checks/ (npm test does).
import assert from 'node:assert/strict';
import {
  BrineGame, NO_INPUT, DT, SAVE_KEY, freshSave, parseSave, stageOpen, medalFor, AREAS, STAGES, SCENES, HC, MOVES, LANE_Z,
} from '../.checks/brinelight-game.js';
import { secretIds } from '../.checks/brinelight-levels.js';
import { FRAMES } from '../.checks/brinelight-art.js';

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
  const g = new BrineGame({ stage: kind === 'clamps' || kind === 'brute' ? '1-3' : '2-3', seed, skipTalk: true });
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
test('areas 1 and 2 are built with three stages each; 3 to 6 are listed and locked', () => {
  assert.equal(AREAS.length, 6);
  for (const a of AREAS.slice(0, 2)) { assert.ok(a.ready); assert.equal(a.stages.length, 3); for (const s of a.stages) assert.ok(STAGES[s], s); }
  for (const a of AREAS.slice(2)) { assert.ok(!a.ready); assert.equal(a.stages.length, 0); assert.ok(a.boss); }
});
test('every scene is well formed: equal rows, known characters, events in range, secrets that exist', () => {
  const lane = new Set('.bcskfinagm'), decor = new Set('.bpocfrSLAXWRDTMNZB@&$');
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
    const charms = sc.lanes.join('').split('').filter((c) => c === 'k' || c === 'g').length;
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
  };
  for (const [k, list] of Object.entries(need)) for (const a of list) assert.ok(FRAMES[`${k}-${a}`], `${k}-${a}`);
  for (const p of ['barrel', 'crate', 'crate-cracked', 'fishcrate', 'ice', 'net-hang', 'net-down', 'cart', 'hatch', 'hatch-open', 'charm', 'scroll', 'snack', 'bun', 'lantern-lit', 'string-dark', 'string-lit', 'npc-mabel', 'npc-twins', 'npc-barnaby', 'face-mabel', 'face-twins', 'face-barnaby'])
    assert.ok(FRAMES[p], p);
});

console.log(`Brinelight: ${n} engine tests passed.`);
