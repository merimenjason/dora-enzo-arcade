// Jade Street, the eighteenth pass: Kallang and chapter 11, "Kallang Roar". The district (the National Stadium under the
// Sports Hub's dome, the Indoor Stadium, Kallang Wave Mall, the Old Kallang Airport and its apron, the Kallang Basin and
// the Riverside) opens after chapter 10, by road from Kampong Glam or by MRT to Stadium; it has its own safe house, three
// properties and match-night fans for townsfolk. The chapter's new step is `crowd`: get through streams of fans crossing
// your way, waiting at the edge for a gap (a fan walking into you shoves you back), sometimes ending at a turnstile with
// your ticket. Start the Kallang Wave at the fan zone, or look up at the sky from the old apron. Not an ending: a hook.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { World, DT, NO_INPUT } from '../.checks/jade-game.js';
import { MISSIONS, MISSION, SIDE, PEOPLE, CHAPTERS, FINALE, KALLANG_OPENS, jobCounts } from '../.checks/jade-story.js';
import { newSave, openDistricts, chapterOf, SAFE_HOUSES, TROPHIES } from '../.checks/jade-save.js';
import { city, T, DISTRICTS, districtAt } from '../.checks/jade-city.js';
import { travelPlan } from '../.checks/jade-mrt.js';
import { cantHail } from '../.checks/jade-taxi.js';
import { KALLANG_TEXT, ROAR_TEXT } from '../.checks/jade-cable.js';
import { crowdOf, fanAt, laneClear, crowdNear, crowdAct, crossTime, BAND, SHOVE_S } from '../.checks/jade-crowd.js';
import { kallangNear, kallangAct } from '../.checks/jade-kallangfest.js';
import { BIZ } from '../.checks/jade-biz.js';
import { KALLANG_NAMES } from '../.checks/jade-kallang.js';
import { PAR } from '../.checks/jade-medals.js';
import { FRAMES, ATLASES } from '../.checks/jade-art.js';
import { tierOf, ZONE_OF } from '../.checks/jade-load.js';
import { playMission, missionSave } from './jade-bot.mjs';

let n = 0;
const test = (name, f) => { try { f(); n++; } catch (e) { console.error('FAILED:', name); throw e; } };
const c = city();
const TEN = ['m76', 'm77', 'm78', 'm79', 'm80', 'm81', 'm82', 'm83', 'm84', 'm85'], TALES = ['k27', 'k28', 'k29'];
const inKallang = (x, y) => districtAt(Math.floor(x / T), Math.floor(y / T)) === 'kallang';
/** a world just after chapter 10, standing at a Kallang place */
function kallang(seed = 3, o = {}) {
  const s = newSave(seed); s.started = true; s.story.intro = true; s.settings.assist = o.assist ?? true;
  s.done = MISSIONS.slice(0, MISSIONS.findIndex(m => m.id === KALLANG_OPENS) + 1).map(m => m.id); s.story.ch = 11;
  const w = new World(s, seed); w.quiet = true; w.talk = null;
  const pl = c.places[o.at ?? 'stn-stadium']; w.p.b.x = pl.x; w.p.b.y = pl.y + 40; w.step(NO_INPUT, DT);
  return w;
}
const settle = (w, s = 2) => { for (let i = 0; i < s / DT; i++) w.step(NO_INPUT, DT); };
function at(id, i, o = {}) {
  const s = missionSave(id, { assist: o.assist ?? false, diff: o.diff ?? 'normal' });
  const w = new World(s, o.seed ?? 9); w.quiet = true;
  w.startMission(MISSION[id]); w.talk = null;
  const run = w.run; run.snap = run.snapshot(i); run.enter(i); w.talk = null;
  return { w, run, st: run.cur };
}
const put = (w, x, y) => { w.p.b.x = x; w.p.b.y = y; w.p.b.speed = 0; w.p.act = null; };

test('Kallang: its own district, opened by chapter 10’s finale, with real places, a safe house, the MRT and taxis', () => {
  assert.ok(DISTRICTS.includes('kallang')); assert.equal(ZONE_OF.kallang, 'kallang');
  const s = newSave(); s.done = MISSIONS.slice(0, MISSIONS.findIndex(m => m.id === KALLANG_OPENS)).map(m => m.id);
  assert.equal(KALLANG_OPENS, 'm75'); assert.ok(!openDistricts(s).includes('kallang'), 'fogged before');
  s.done.push(KALLANG_OPENS); assert.ok(openDistricts(s).includes('kallang'), 'open after');
  const names = Object.values(c.places).filter(p => p.d === 'kallang').map(p => p.name).join(' | ');
  for (const real of ['National Stadium', 'Sports Hub', 'Indoor Stadium', 'Kallang Wave Mall', 'Kallang Airport', 'Kallang Basin', 'Kallang Riverside'])
    assert.match(names + ' | ' + Object.values(KALLANG_NAMES).join(' | '), new RegExp(real), real);
  const safe = SAFE_HOUSES.find(h => h.d === 'kallang'); assert.ok(safe && c.places[safe.id], 'a safe house');
  const stn = (c.isle?.stations ?? []).find(st => st.id === 'stn-stadium'); assert.ok(stn && inKallang(stn.x, stn.y), 'Stadium station');
  const props = BIZ.filter(b => b.d === 'kallang'); assert.equal(props.length, 3, 'three properties');
  for (const b of props) assert.ok(PEOPLE[b.keeper], `${b.id} kept by a Kallang giver`);
  for (const k of ['dragon', 'boat']) assert.ok(c.parking.some(p => p.d === 'kallang' && p.kind === k), `a ${k} on the basin`);
  const w = kallang(); assert.equal(cantHail(w), null, 'a taxi comes to Kallang');
  // from Chinatown's market to the stadium: the trip has an MRT leg to Stadium
  const m = c.places['safe-market'], to = c.places['stadium'], plan = travelPlan(w, to.x, to.y, m.x, m.y);
  assert.ok(plan && (plan.via === 'mrt' || plan.then?.via === 'mrt'), `by MRT (${plan?.via})`);
  assert.match(KALLANG_TEXT, /Stadium/);
});

test('chapter eleven: ten jobs in Kallang, a mix of steps, at most a third chases, ending on a hook (not an ending)', () => {
  const ten = MISSIONS.filter(m => m.ch === 11);
  assert.deepEqual(ten.map(m => m.id), TEN); assert.equal(CHAPTERS[10], 'Kallang Roar'); assert.equal(FINALE[10], 'm85');
  const chases = ten.filter(m => m.steps.some(s => s.t === 'chase' || s.t === 'tail' || s.t === 'race')).length;
  assert.ok(chases <= Math.ceil(TEN.length / 3), `${chases} chases`);
  const kinds = new Set(ten.flatMap(m => m.steps.map(s => s.t)));
  for (const k of ['crowd', 'race', 'case', 'tail', 'defend', 'swap', 'paddle', 'blend', 'chase', 'ride']) assert.ok(kinds.has(k), k);
  assert.ok(ten.filter(m => m.steps.some(s => s.t === 'crowd')).length >= 3, 'the crowd is the chapter’s own step');
  for (const m of ten) {
    assert.ok(m.steps.some(s => s.cp), `${m.id} checkpoint`); assert.ok(PAR[m.id] > 0, `${m.id} par`);
    const g = c.places[m.at]; assert.ok(g && inKallang(g.x, g.y), `${m.id} given in Kallang`);
    for (const st of m.steps) if (st.t === 'talk') for (const [who] of st.lines) assert.ok(who === 'hero' || who === 'mate' || PEOPLE[who], `${m.id} ${who}`);
  }
  const last = MISSION.m85.steps.at(-1); assert.equal(last.t, 'talk', 'the chapter ends on a talk');
  const words = [...last.lines.map(l => l[1]), ROAR_TEXT].join(' ');
  assert.match(words, /seaplane/); assert.match(words, /south/i);
  assert.doesNotMatch(words, /\b(finale|the end|happily ever|farewell forever)\b/i);
  // no end panel for this chapter: the story goes on
  assert.doesNotMatch(readFileSync(new URL('../app/jade-street/story.tsx', import.meta.url), 'utf8'), /bg-end-11|chapter 11 ending/i);
  const s = newSave(); s.done = MISSIONS.filter(m => m.ch <= 10).map(m => m.id); assert.equal(chapterOf(s), 11);
  s.done = MISSIONS.map(m => m.id); assert.equal(chapterOf(s), 12);
  const jc = jobCounts(newSave()); assert.equal(jc.storyAll, 85); assert.equal(jc.talesAll, 29);
  // no Hari Raya bazaar and no durians in this chapter
  const text = JSON.stringify([...ten, ...TALES.map(id => MISSION[id])]); assert.doesNotMatch(text, /durian|bazaar|Hari Raya/i);
});

test('three Hawker Tales in Kallang, each at its own place so its giver waits there', () => {
  assert.deepEqual(SIDE.slice(-3).map(m => m.id), TALES);
  for (const id of TALES) {
    const m = MISSION[id]; assert.ok(inKallang(c.places[m.at].x, c.places[m.at].y), `${id} in Kallang`);
    assert.ok(!MISSIONS.filter(x => x.ch === 11).some(x => x.at === m.at), `${id} not at a chapter-eleven job's place`);
    assert.ok(PAR[id] > 0); assert.ok(TEN.includes(m.side), `${id} opens in chapter eleven`);
  }
});

test('the crowd step: lanes of fans cross the way; Assist says when to go; walking into a fan shoves you back', () => {
  const i = MISSION.m76.steps.findIndex(s => s.t === 'crowd'), { w, run, st } = at('m76', i, { assist: true });
  const cr = crowdOf(run); assert.equal(cr.lanes.length, st.lanes); assert.match(run.progress, /Crowds 0\/3/);
  assert.equal(w.p.carry, st.item, 'carrying the scarves through');
  // the fans move on the step's own clock: the same place at the same time on every play
  const again = at('m76', i, { assist: true }); assert.deepEqual(fanAt(cr, 1, 0, 3.2), fanAt(crowdOf(again.run), 1, 0, 3.2));
  // at the edge of the first lane, Assist says "Go!" in a gap and "Wait" while fans pass, and both come round
  const L = cr.lanes[0], ex = cr.ox + cr.ux * (L.at - BAND - 24), ey = cr.oy + cr.uy * (L.at - BAND - 24);
  const said = new Set();
  for (let k = 0; k < 14 / DT; k++) { put(w, ex, ey); w.step(NO_INPUT, DT); said.add(run.label.split(':')[0]); }
  assert.ok(said.has('Go! A gap in the crowd'), [...said].join(' / ')); assert.ok(said.has('Wait at the edge'), [...said].join(' / '));
  assert.ok(crossTime() < 1.2, 'a lane is crossed in about a second at a walk');
  // stand in a fan's way: shoved back out of the lane, with its own animation and a few seconds lost
  const t0 = run.timer, [fx, fy] = fanAt(cr, 0, 0); put(w, fx, fy); w.step(NO_INPUT, DT);
  assert.equal(w.p.act?.n, 'shoved'); assert.equal(cr.shoves, 1); assert.ok(run.timer <= t0 - SHOVE_S + 0.1, 'it costs time');
  const a = (w.p.x - cr.ox) * cr.ux + (w.p.y - cr.oy) * cr.uy; assert.ok(a < L.at - BAND, 'back at the near edge');
  // past every lane at the far end: through, and the scarves are handed over
  settle(w, 1.2); const [tx, ty] = run.spot(st.to); put(w, tx, ty); w.step(NO_INPUT, DT); settle(w, 0.2);
  assert.notEqual(run.cur, st, 'through the crowd'); assert.equal(w.s.stats.crowds, 1);
});

test('off Assist there is no "Go!": the fans are faster on Hard, and a gap is always coming in every lane', () => {
  const i = MISSION.m80.steps.findIndex(s => s.t === 'crowd');
  const off = at('m80', i, { assist: false }), hard = at('m80', i, { assist: false, diff: 'hard' });
  const co = crowdOf(off.run), ch = crowdOf(hard.run); assert.ok(ch.lanes[0].v > co.lanes[0].v, 'Hard is quicker');
  const L = co.lanes[0], ex = co.ox + co.ux * (L.at - BAND - 24), ey = co.oy + co.uy * (L.at - BAND - 24);
  put(off.w, ex, ey); off.w.step(NO_INPUT, DT); assert.doesNotMatch(off.run.label, /^Go!/); assert.match(off.run.label, /gap/);
  // in every lane of every crowd job, a walker who waits finds a gap within the lane's loop
  for (const id of [...TEN, ...TALES]) MISSION[id].steps.forEach((s, j) => {
    if (s.t !== 'crowd') return;
    for (const diff of ['normal', 'hard']) {
      const { run } = at(id, j, { assist: false, diff }), cr = crowdOf(run);
      cr.lanes.forEach((Ln, k) => {
        let ok = false; const t0 = cr.t;
        for (let q = 0; q < Ln.loop / Ln.v && !ok; q += 0.1) { cr.t = t0 + q; ok = laneClear(cr, k, 0, crossTime() + 0.5); }
        cr.t = t0; assert.ok(ok, `${id} lane ${k} (${diff}) has a gap`);
      });
    }
  });
});

test('a ticket at the turnstile: E once through the crowd, with its own animation', () => {
  const i = MISSION.m80.steps.findIndex(s => s.t === 'crowd'), { w, run, st } = at('m80', i, { assist: true });
  assert.ok(st.ticket); const [tx, ty] = run.spot(st.to); put(w, tx, ty + 20); w.step(NO_INPUT, DT);
  assert.equal(run.cur, st, 'not done until the ticket is shown'); assert.match(run.label, /ticket/);
  const near = crowdNear(run, w.p.x, w.p.y); assert.ok(near && near.id === 'ticket');
  assert.ok(crowdAct(run, 'ticket')); assert.equal(w.p.act?.n, 'gate-ticket'); settle(w, 1.3);
  assert.notEqual(run.cur, st, 'in through the gate');
});

test('the Kallang Wave and the old apron’s sky: their own animations, counted, and four trophies', () => {
  const w = kallang(3, { at: 'fanzone' });
  let wave = null, sky = null; kallangNear(w, nn => { if (nn.id === 'wave') wave = nn; if (nn.id === 'sky') sky = nn; });
  assert.ok(wave && sky); put(w, wave.x, wave.y); w.step(NO_INPUT, DT);
  const acts = new Set(); kallangAct(w, 'wave'); for (let k = 0; k < 2 / DT; k++) { if (w.p.act) acts.add(w.p.act.n); w.step(NO_INPUT, DT); }
  assert.deepEqual([...acts], ['kwave']); assert.equal(w.s.stats.waves, 1);
  put(w, sky.x, sky.y); w.step(NO_INPUT, DT); kallangAct(w, 'sky'); assert.equal(w.p.act?.n, 'skyward'); settle(w, 3); assert.equal(w.s.stats.skies, 1);
  for (const t of ['roar', 'squeeze', 'mexican', 'flyingboat']) assert.ok(TROPHIES.some(x => x.id === t), t);
  // the squeeze has its own pose in a lane, walking or waiting
  for (const h of ['dora', 'enzo']) for (const f of ['squeeze-0', 'squeeze-1', 'shoved', 'ticket-up', 'wave-0', 'wave-1', 'skyward', 'point-up']) assert.ok(FRAMES[`${h}-${f}`], `${h}-${f}`);
});

test('the paintings: Kallang’s art streams with its zone, the heroes’ new actions too, nothing new is core', () => {
  for (const f of ['kal-stadium', 'kal-airport', 'kal-indoor', 'kal-mall', 'kal-boathouse', 'safe-kallang', 'kallang-stn', 'kal-seaplane', 'kal-plane',
    'kal-turnstile', 'kal-floodlight', 'kal-stage', 'kal-scarf', 'kal-charts', 'folk-fanbear-down', 'folk-fankancil-hop', 'folk-fanotter-side-1',
    'npc-biru-idle-0', 'npc-tenuk-talk-1', 'npc-kubung-wave-0', 'npc-sutera-idle-1', 'face-sutera-cross', 'biz-wavekiosk-3', 'biz-hubsatay-0', 'biz-rowcafe-2',
    'mi-stadium', 'pin-swan', 'i-crowd', 'i-seaplane'])
    assert.ok(FRAMES[f], f);
  for (const a of ['atlas-kallang', 'atlas-cast-kallang', 'atlas-act18']) assert.equal(tierOf(a), 'kallang', a);
  for (const a of ATLASES) if (/18|kallang/.test(a)) assert.notEqual(tierOf(a), 'core', a);
});

test('every new job clears for a human-paced player (Assist on, as by default) and off Assist on normal', () => {
  for (const id of [...TEN, ...TALES]) {
    const r = playMission(id, 'casual', 5); assert.ok(r.won, `${id} casual: ${JSON.stringify(r.why)}`);
  }
  for (const id of ['m76', 'm80', 'm85', 'k27']) assert.ok(playMission(id, 'normal', 3, { assist: false }).won, `${id} normal off Assist`);
});

console.log(`jade (eighteenth pass): ${n} tests ok`);
