// The Sunken Bellspire: the expansions' people and endings. Killa and Suma meet the heroes in a first scene with Dora
// and Enzo replying, then their lines move on with the story (Killa from Lantern Bloom to the root lift; Suma from the
// Salt Gate pedestal to the pass), each in their own voice with their own portrait. Each expansion's ending is a short
// scene with its people, and its epilogue plays once that area is 100% found, at the ending or the moment the last
// thing is found afterwards.
// Run after compiling the engine: see `npm run test:bellspire`.
import assert from 'node:assert/strict';
import { BellspireGame, ABILITY_ORDER, ALL_BOSSES, SALT_GUARDIANS, ORCHARD_GUARDIANS, GLACIER_GUARDIANS, COMPLETION, INFO, NAMES,
  NO_INPUT, ROOMS, COLS, ROWS, freshSave, isOrchardRoom, roomById } from '../.checks/bellspire-game.js';

let passed = 0;
const ok = (c, m) => { assert.ok(c, m); passed++; };
const eq = (a, b, m) => { assert.deepEqual(a, b, m); passed++; };

const before = (a) => ABILITY_ORDER.slice(0, ABILITY_ORDER.indexOf(a));
const base = ALL_BOSSES.filter((b) => ![...SALT_GUARDIANS, ...ORCHARD_GUARDIANS, ...GLACIER_GUARDIANS].includes(b));
function save(abilities, bosses, flags = [], shrine = 'landing') {
  const s = freshSave();
  s.abilities = [...abilities];
  s.flags.push('script:intro', 'script:firstDark', 'script:belfryCall', 'script:trials', 'script:foundryCall', 'keeper', 'epilogue', 'epilogue2', 'epilogue3',
    'unlock:salt', 'unlock:orchard', 'unlock:glacier', ...[...base, ...bosses].map((b) => `boss:${b}`), ...flags);
  s.shrine = shrine;
  return s;
}
const game = (s) => new BellspireGame(s, { assist: true, strict: false, wisp: true }, 5);
const text = (lines) => lines.map((l) => l.text).join(' ');
const press = { ...NO_INPUT, jump: true };
/** Talk through the dialog that is up; returns every event on the way. */
function talkThrough(g) {
  const ev = [];
  for (let i = 0; i < 40 && g.dialog; i++) { g.step(press); g.step(NO_INPUT); ev.push(...g.drainEvents()); }
  return ev;
}
/** Walk up to a character and press Up. */
function talkTo(g, room, ch) {
  const t = INFO.get(room).things.find((th) => th.ch === ch);
  const r = roomById(room);
  g.teleport(room, t.c - r.gx * COLS, t.r - r.gy * ROWS);
  g.dialog = null;
  for (let i = 0; i < 20 && !g.body.ground; i++) g.step(NO_INPUT);
  g.dialog = null;
  g.drainEvents();
  g.interact();
  return g.dialog ? g.dialog.lines : [];
}

// ─── speakers ─────────────────────────────────────────────────────────────
eq([NAMES.killa, NAMES.suma], ['Killa', 'Suma'], 'Killa and Suma speak as themselves, not as signs');

// ─── Killa ────────────────────────────────────────────────────────────────
{
  const stages = [
    ['first meeting', before('bloom'), [...SALT_GUARDIANS], []],
    ['before Lantern Bloom', before('bloom'), [...SALT_GUARDIANS], ['script:killa']],
    ['after Lantern Bloom', before('shear'), [...SALT_GUARDIANS], ['script:killa']],
    ['after Graft Shear', before('sunmirror'), [...SALT_GUARDIANS], ['script:killa']],
    ['after the Bracken Stag', before('sunmirror'), [...SALT_GUARDIANS, 'bracken-stag'], ['script:killa']],
    ['after the Rootback', before('sunmirror'), [...SALT_GUARDIANS, 'bracken-stag', 'rootback'], ['script:killa']],
    ['after the Mother of Grafts', before('sunmirror'), [...SALT_GUARDIANS, ...ORCHARD_GUARDIANS], ['script:killa']],
    ['on the Glacier Stair', before('sunmirror'), [...SALT_GUARDIANS, ...ORCHARD_GUARDIANS], ['script:killa', 'glacier:visited']],
    ['after the Sun Gate', ABILITY_ORDER, [...SALT_GUARDIANS, ...ORCHARD_GUARDIANS, ...GLACIER_GUARDIANS], ['script:killa', 'glacier:visited']],
  ];
  const seen = new Set();
  for (const [name, abil, bosses, flags] of stages) {
    const g = game(save(abil, bosses, ['salt:visited', 'orchard:visited', ...flags], 'orchard-wicket'));
    const lines = talkTo(g, 'orchard-wicket', 'q');
    ok(lines.length > 0, `Killa ${name}: she talks`);
    ok(lines.every((l) => l.who !== 'sign'), `Killa ${name}: no sign lines`);
    ok(lines.some((l) => l.who === 'killa'), `Killa ${name}: in her own voice`);
    ok(!seen.has(text(lines)), `Killa ${name}: a new line: ${text(lines)}`);
    seen.add(text(lines));
    if (name === 'first meeting') {
      ok(lines.some((l) => l.who === 'dora') && lines.some((l) => l.who === 'enzo'), 'Killa first meeting: Dora and Enzo both reply');
      talkThrough(g);
      ok(g.flag('script:killa'), 'and the first meeting is only once');
      ok(!text(talkTo(g, 'orchard-wicket', 'q')).includes(lines[0].text), 'talking again: the next line, not the meeting');
    }
    if (name === 'before Lantern Bloom') ok(/Lantern Bloom/.test(text(lines)), 'before Lantern Bloom: she points at the pedestal');
    if (name === 'after Lantern Bloom') ok(/Shear/.test(text(lines)), 'after Lantern Bloom: she points at the Graft Shear');
    if (name === 'after the Mother of Grafts') ok(/root lift/.test(text(lines)) && /east/.test(text(lines)), 'after the Mother of Grafts: she points at the root lift');
  }
}

// ─── Suma ─────────────────────────────────────────────────────────────────
{
  const stages = [
    ['first meeting', before('ballast'), [], []],
    ['before Shoulder Shift', before('ballast'), [], ['script:suma']],
    ['before Lift Catch', before('catch'), [], ['script:suma']],
    ['before the Weighmaster', before('bloom'), [], ['script:suma']],
    ['after the Weighmaster', before('bloom'), ['weighmaster'], ['script:suma']],
    ['after the Panback', before('bloom'), ['weighmaster', 'panback'], ['script:suma']],
    ['after the Tollkeeper', before('bloom'), [...SALT_GUARDIANS], ['script:suma']],
    ['in the orchard', before('sunmirror'), [...SALT_GUARDIANS], ['script:suma', 'orchard:visited']],
    ['after the Mother of Grafts', before('sunmirror'), [...SALT_GUARDIANS, ...ORCHARD_GUARDIANS], ['script:suma', 'orchard:visited']],
    ['after the Sun Gate', ABILITY_ORDER, [...SALT_GUARDIANS, ...ORCHARD_GUARDIANS, ...GLACIER_GUARDIANS], ['script:suma', 'orchard:visited', 'glacier:visited']],
  ];
  const seen = new Set();
  for (const [name, abil, bosses, flags] of stages) {
    const g = game(save(abil, bosses, ['salt:visited', ...flags], 'salt-gate'));
    const lines = talkTo(g, 'salt-gate', ';');
    ok(lines.length > 0 && lines.every((l) => l.who !== 'sign') && lines.some((l) => l.who === 'suma'), `Suma ${name}: in her own voice`);
    ok(!seen.has(text(lines)), `Suma ${name}: a new line: ${text(lines)}`);
    seen.add(text(lines));
    if (name === 'first meeting') {
      ok(lines.some((l) => l.who === 'dora') && lines.some((l) => l.who === 'enzo'), 'Suma first meeting: Dora and Enzo both reply');
      talkThrough(g);
      ok(g.flag('script:suma'), 'and it is only once');
    }
    if (name === 'after the Tollkeeper') ok(/wicket/.test(text(lines)), 'after the Tollkeeper: she points at the orchard wicket');
  }
}

// ─── the expansions' endings and epilogues ─────────────────────────────────
const AREA = {
  salt: { rooms: ROOMS.filter((r) => r.salt), last: 'tollkeeper', bosses: [], abil: before('bloom'), shrine: 'salt-toll-road', people: 'suma', flags: ['salt:visited'] },
  orchard: { rooms: ROOMS.filter(isOrchardRoom), last: 'graft-mother', bosses: [...SALT_GUARDIANS], abil: before('sunmirror'), shrine: 'orchard-wicket', people: 'killa', flags: ['salt:visited', 'orchard:visited'] },
  glacier: { rooms: ROOMS.filter((r) => r.glacier), last: 'sun-gate', bosses: [...SALT_GUARDIANS, ...ORCHARD_GUARDIANS], abil: ABILITY_ORDER, shrine: 'glacier-camp', people: 'phuyu', flags: ['salt:visited', 'orchard:visited', 'glacier:visited'] },
};
const GUARDS = { salt: SALT_GUARDIANS, orchard: ORCHARD_GUARDIANS, glacier: GLACIER_GUARDIANS };
function findAll(g, area) {
  for (const r of AREA[area].rooms) {
    for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) if (!g.save.seen.includes(`${r.gx + x},${r.gy + y}`)) g.save.seen.push(`${r.gx + x},${r.gy + y}`);
    for (const t of INFO.get(r.id).things) if (t.ch === 'C') g.setFlag(`chest:${r.id}:${t.i}`);
    for (const n of r.murals ?? []) g.setFlag(`mural:${n}`);
  }
}
for (const area of ['salt', 'orchard', 'glacier']) {
  const a = AREA[area];
  const others = GUARDS[area].filter((b) => b !== a.last);
  // the ending scene: calm the last guardian (through the engine's own calm), then talk it through
  for (const full of [false, true]) {
    const g = game(save(a.abil, [...a.bosses, ...others], a.flags, a.shrine));
    if (full) findAll(g, area);
    g.fightBoss(a.last);
    g.boss.hp = 0;
    g.bossDone();
    const lines = g.dialog.lines;
    ok(lines.length >= 3 && lines.some((l) => l.who === a.people), `${area}: the ending is a scene with ${a.people} (${lines.length} lines)`);
    ok(lines.some((l) => l.who === 'dora') && lines.some((l) => l.who === 'enzo'), `${area}: Dora and Enzo both speak in it`);
    const end = talkThrough(g).filter((e) => e.k === 'ending');
    eq(end.length, 1, `${area}${full ? ' (100%)' : ''}: one ending`);
    eq([!!end[0][area], end[0].full], [true, full], `${area}${full ? ' (100%)' : ''}: ${full ? 'with' : 'without'} the epilogue`);
    eq(g.flag(`${area}:epilogue`), full, `${area}: the epilogue flag only at 100%`);
    eq(g.completion()[area].pct, full ? 100 : g.completion()[area].pct, `${area}: completion has a percentage`);
    ok(full ? g.completion()[area].pct === 100 : g.completion()[area].pct < 100, `${area}: ${g.completion()[area].pct}%`);
  }
  // the epilogue later: everything found after the ending plays it once
  {
    const g = game(save(a.abil, [...a.bosses, ...GUARDS[area]], [...a.flags, `${area}:ending`], a.shrine));
    for (let i = 0; i < 30; i++) g.step(NO_INPUT);
    ok(!g.dialog, `${area}: nothing while something is still to find`);
    findAll(g, area);
    let ev = [];
    for (let i = 0; i < 30 && !g.dialog; i++) { g.step(NO_INPUT); ev.push(...g.drainEvents()); }
    ok(g.dialog && g.dialog.lines.some((l) => l.who === 'dora' || l.who === 'enzo'), `${area}: finding the last thing: a word from the heroes`);
    ev = talkThrough(g);
    const end = ev.filter((e) => e.k === 'ending');
    eq(end.length === 1 && end[0][area] && end[0].full, true, `${area}: then the epilogue`);
    ok(g.flag(`${area}:epilogue`), `${area}: kept`);
    const again = game(g.snapshot());
    let more = [];
    for (let i = 0; i < 60; i++) { again.step(NO_INPUT); more.push(...again.drainEvents()); }
    eq(more.filter((e) => e.k === 'ending').length, 0, `${area}: once`);
  }
}
eq(COMPLETION.salt.murals ?? 0, 0, 'the Salt Road has no murals to count');

console.log(`bellspire story: ${passed} checks passed`);
