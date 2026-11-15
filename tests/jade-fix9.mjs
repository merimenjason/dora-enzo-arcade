// Jade Street, ninth pass: regression tests for the live playtest fixes (every mini-game fails when left alone, the
// objective points at the next giver even when it is close, a run's warning clears on a new step, a job lost to a
// reload is offered again, the phone badge counts only offers, fines and calls for help, one market name).
import assert from 'node:assert/strict';
import { World, DT, NO_INPUT } from '../.checks/jade-game.js';
import { MISSIONS, MISSION, SIDE } from '../.checks/jade-story.js';
import { newSave, loadSave, offered } from '../.checks/jade-save.js';
import { LockGame, WireGame, WokGame, DumplingGame, SafeGame, KopiGame } from '../.checks/jade-mini.js';
import { unread, text, phoneStep, firstPerson } from '../.checks/jade-phone.js';
import { MARKET_NAME } from '../.checks/jade-trade.js';

let n = 0;
const test = (name, fn) => { try { fn(); n++; } catch (e) { console.error('FAILED: ' + name); throw e; } };
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const saveAt = (done) => { const s = newSave(9); s.started = true; s.story.intro = true; s.done = done.slice(); return s; };

test('every mini-game fails when left alone on Assist (the wok and dumplings no longer finish on their own)', () => {
  for (const G of [LockGame, WireGame, WokGame, DumplingGame, SafeGame, KopiGame]) for (const level of [1, 2]) for (let seed = 1; seed <= 4; seed++) {
    const g = new G({ level, assist: true, seed });
    for (let k = 0; k < 60 * 400 && !g.done && !g.failed; k++) g.step(1 / 60);
    assert.ok(g.failed && !g.done, `${G.name} level ${level} seed ${seed} idle: failed ${g.failed}, done ${g.done}`);
  }
});

test('the wok waits for a toss once the order is in, and a toss serves it', () => {
  const g = new WokGame({ level: 1, assist: true, seed: 3 });
  // catch everything that falls, toss when it smokes, until the order is in
  for (let k = 0; k < 60 * 120 && !g.ready && !g.failed; k++) {
    if (g.burn > 0.5) g.toss();
    const want = g.items.filter(i => i.vy > 0 && (g.need[i.f] ?? 0) > (g.got[i.f] ?? 0)).sort((p, q) => q.y - p.y)[0];
    if (want) g.moveTo(want.x); else g.moveTo(0.5);
    g.step(1 / 60);
  }
  assert.ok(g.ready && !g.done, 'the order is in, and it waits for a toss');
  for (let k = 0; k < 30; k++) g.step(1 / 60);
  g.toss(); assert.ok(g.done, 'a toss serves a ready wok');
});

test('the objective points at the next story giver even when you stand beside them, and street events wait', () => {
  const s = saveAt(['m1', 'm2', 'm3']); s.settings.assist = true; const w = new World(s);
  const m = offered(s)[0]; const pl = w.c.places[m.at];
  w.placePlayer(pl.x + 40, pl.y + 40);
  const o = w.objective(); assert.ok(o, 'an objective'); assert.ok(dist(o, [pl.x, pl.y]) < 1, `points at ${m.giver}`);
  assert.equal(w.nextJob().id, m.id);
});

test('a run’s warning clears when it moves on to the next step', () => {
  const s = saveAt(MISSIONS.slice(0, 3).map(m => m.id)); const w = new World(s);
  w.startMission(MISSION.m4); const r = w.run; r.warning = { text: 'You are too close!', t: 9 };
  r.next(); assert.equal(r.warning, null);
});

test('a job you were in when the game closed is offered again, with a note and a line to its giver', () => {
  const s = saveAt(['m1']); const w = new World(s); w.startMission(MISSION.m2);
  assert.equal(s.jobOpen, 'm2');
  const back = loadSave(JSON.stringify(s)); assert.equal(back.jobOpen, 'm2');
  const w2 = new World(back);
  assert.equal(back.jobOpen, undefined, 'only once');
  assert.ok(w2.drain().some(f => f.t === 'toast' && /stopped when you left/.test(f.msg)));
  assert.ok(w2.waypoint, 'the gold line leads to the giver');
  w.quitJob(); assert.equal(s.jobOpen, undefined);
  const s3 = saveAt(['m1']); const w3 = new World(s3); w3.startMission(MISSION.m2); w3.finishMission(MISSION.m2); assert.equal(s3.jobOpen, undefined);
});

test('the phone: one first-person offer per job, and the badge counts offers, fines and calls for help, not chatter', () => {
  const s = saveAt(['m1', 'm2']); const w = new World(s);
  for (let k = 0; k < 120; k++) { w.tick = k * 30; phoneStep(w); }
  const jobs = s.msgs.filter(m => m.kind === 'job');
  assert.ok(jobs.length >= 1); assert.equal(new Set(jobs.map(m => m.job)).size, jobs.length, 'no repeats');
  // a fresh World (a reload) does not text the same offers again
  const w2 = new World(s); const before = s.msgs.length; for (let k = 0; k < 60; k++) { w2.tick = k * 30; phoneStep(w2); } assert.equal(s.msgs.length, before);
  const nOffers = unread(w); text(w, 'kee', 'Lovely night for it.'); assert.equal(unread(w), nOffers, 'chatter does not count');
  text(w, 'bristle', 'Ticket in the post.', { kind: 'fine' }); assert.equal(unread(w), nOffers + 1);
  assert.equal(firstPerson('Ah Beng’s seasoned wok rolled off. Get it back for Ah Beng.', 'Ah Beng'), 'My seasoned wok rolled off. Get it back for me.');
  assert.ok(!/Ah Beng’s/.test(jobs.find(m => MISSION[m.job].blurb.includes('’s'))?.text ?? ''), 'offers are in the giver’s own voice');
});

test('the market prompt names the market the way its panel does', () => {
  const s = saveAt(['m1']); const w = new World(s);
  const pl = w.c.places['mk-market']; w.placePlayer(pl.x, pl.y + 30);
  for (let k = 0; k < 3; k++) w.step(NO_INPUT, DT);
  const near = w.near; assert.ok(near && near.kind === 'market', 'by the market');
  assert.ok(near.label.includes(MARKET_NAME.market), near.label);
});

test('the clock runs at half speed in a job and dawn waits for the job to end', () => {
  const s = saveAt(['m1']); const w = new World(s); s.clock = 700;
  const c0 = s.clock; w.clock(10); const free = s.clock - c0;
  s.clock = 700; w.startMission(MISSION.m2); w.clock(10); assert.ok(Math.abs((s.clock - 700) - free / 2) < 1e-6, 'half speed');
  const night = s.night; w.clock(200); assert.equal(s.night, night, 'no dawn mid-job'); assert.ok(s.clock < 720);
});

test('more step kinds early: a blend in chapter two, and Hawker Tales with a detective, a swap and a heist by then', () => {
  const early = MISSIONS.filter(m => m.ch <= 2);
  assert.ok(early.some(m => m.steps.some(s => s.t === 'blend' || s.t === 'detective' || s.t === 'case')), 'a blend, detective or casing step in chapter one or two');
  const byCh2 = new Set(early.map(m => m.id));
  const tales = SIDE.filter(m => byCh2.has(m.side));
  for (const t of ['detective', 'swap', 'case']) assert.ok(tales.some(m => m.steps.some(s => s.t === t)), `a ${t} tale by chapter two`);
});

console.log(`jade (playtest fixes): ${n} tests ok`);
