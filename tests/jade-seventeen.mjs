// Jade Street, the seventeenth pass: Pulau Ubin and chapter 10, "Kampong Spirit". The island is reached only by Pak
// Ubin's bumboat from the Changi Point jetty (Route me plans the crossing; no MRT, no taxis), has its own safe house,
// three properties and wildlife townsfolk, and the Tusker Boys (wild boars, harmless) root about its tracks: shoo one off
// its dig for what it dug up, or step off its line when it charges and catch it dizzy. The chapter's new step is `track`:
// follow a boar trail print by print, reading each set (E) for the way it heads, with a false branch of old prints.
import assert from 'node:assert/strict';
import { World, DT, NO_INPUT } from '../.checks/jade-game.js';
import { MISSIONS, MISSION, SIDE, PEOPLE, CHAPTERS, FINALE, UBIN_OPENS, jobCounts } from '../.checks/jade-story.js';
import { newSave, openDistricts, chapterOf, SAFE_HOUSES, TROPHIES } from '../.checks/jade-save.js';
import { city, T, W, DISTRICTS, districtAt, passable } from '../.checks/jade-city.js';
import { travelPlan } from '../.checks/jade-mrt.js';
import { linksOf, UBIN_TEXT, KAMPONG_TEXT } from '../.checks/jade-cable.js';
import { trackNear, trackAct, trackTarget, visible, heading } from '../.checks/jade-track.js';
import { ubinNear, ubinAct, BOARS, PAW_S, PAW_ASSIST } from '../.checks/jade-ubinfest.js';
import { BIZ } from '../.checks/jade-biz.js';
import { UBIN_NAMES } from '../.checks/jade-ubin.js';
import { PAR } from '../.checks/jade-medals.js';
import { FRAMES, ATLASES } from '../.checks/jade-art.js';
import { tierOf, ZONE_OF } from '../.checks/jade-load.js';
import { playMission, missionSave } from './jade-bot.mjs';

let n = 0;
const test = (name, f) => { try { f(); n++; } catch (e) { console.error('FAILED:', name); throw e; } };
const c = city();
const TEN = ['m66', 'm67', 'm68', 'm69', 'm70', 'm71', 'm72', 'm73', 'm74', 'm75'], TALES = ['k24', 'k25', 'k26'];
const onUbin = (x, y) => districtAt(Math.floor(x / T), Math.floor(y / T)) === 'pulau';
/** a world just after chapter 9, standing on Ubin by the jetty */
function island(seed = 3, o = {}) {
  const s = newSave(seed); s.started = true; s.story.intro = true; s.settings.assist = o.assist ?? true;
  s.done = MISSIONS.slice(0, MISSIONS.findIndex(m => m.id === UBIN_OPENS) + 1).map(m => m.id); s.story.ch = 10;
  const w = new World(s, seed); w.quiet = true; w.talk = null;
  const pl = c.places['jetty-ubin']; w.p.b.x = pl.x; w.p.b.y = pl.y + 40; w.step(NO_INPUT, DT);
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

test('Pulau Ubin: its own district, opened by chapter 9’s finale, with real places, a safe house and no MRT', () => {
  assert.ok(DISTRICTS.includes('pulau')); assert.equal(ZONE_OF.pulau, 'ubin');
  const s = newSave(); s.done = MISSIONS.slice(0, MISSIONS.findIndex(m => m.id === UBIN_OPENS)).map(m => m.id);
  assert.ok(!openDistricts(s).includes('pulau'), 'fogged before');
  s.done.push(UBIN_OPENS); assert.ok(openDistricts(s).includes('pulau'), 'open after');
  const names = Object.values(c.places).filter(p => p.d === 'pulau').map(p => p.name).join(' | ');
  for (const real of ['Chek Jawa', 'Jejawi', 'Ketam', 'House No. 1', 'Pekan', 'Wei Tuo Fa Gong']) assert.match(names, new RegExp(real), real);
  for (const road of ['Jalan Ubin', 'Jalan Endut Senin', 'Jalan Mamam', 'Jalan Sam Kongsi']) assert.ok(Object.values(UBIN_NAMES).includes(road), road);
  const safe = SAFE_HOUSES.find(h => h.d === 'pulau'); assert.ok(safe && c.places[safe.id], 'a safe house');
  assert.ok(!(c.isle?.stations ?? []).some(st => onUbin(st.x, st.y)), 'no MRT on the island');
  const props = BIZ.filter(b => b.d === 'pulau'); assert.equal(props.length, 3, 'three properties');
  for (const b of props) assert.ok(PEOPLE[b.keeper], `${b.id} kept by an islander`);
  // no cars on the island: the parked rides are bikes, a tandem and a boat
  for (const p of c.parking.filter(p => p.d === 'pulau')) assert.ok(['bike', 'tandem', 'boat'].includes(p.kind), p.kind);
  assert.ok(c.parking.filter(p => p.d === 'pulau' && p.kind === 'bike').length >= 3, 'bikes for hire');
});

test('the bumboat crosses from Changi Point to the Ubin jetty, and Route me plans the crossing', () => {
  const w = island(); const L = linksOf(w).find(l => l.id === 'bumboat');
  assert.ok(L, 'the bumboat link'); assert.deepEqual(L.stops.map(s => s.id), ['ferry-cv', 'jetty-ubin']);
  assert.equal(districtAt(Math.floor(L.stops[0].x / T), Math.floor(L.stops[0].y / T)), 'changi');
  assert.ok(onUbin(L.stops[1].x, L.stops[1].y));
  // from Chinatown's market to the wayang stage: the trip has a bumboat leg
  const m = c.places['safe-market'], to = c.places['wayang'];
  const plan = travelPlan(w, to.x, to.y, m.x, m.y); assert.ok(plan, 'a plan');
  assert.ok(plan.via === 'bumboat' || plan.then?.via === 'bumboat', `by bumboat (${plan.via} then ${plan.then?.via})`);
  // and from Changi Point itself, straight onto the bumboat
  const cp = L.stops[0], near = travelPlan(w, to.x, to.y, cp.x, cp.y + 3 * T); assert.equal(near?.via, 'bumboat');
  assert.match(UBIN_TEXT, /bumboat/); assert.match(UBIN_TEXT, /Changi Point/);
});

test('chapter ten: ten jobs on the island, a mix of steps, at most a third chases, ending on a hook', () => {
  const ten = MISSIONS.filter(m => m.ch === 10);
  assert.deepEqual(ten.map(m => m.id), TEN); assert.equal(CHAPTERS[9], 'Kampong Spirit'); assert.equal(FINALE[9], 'm75');
  const chases = ten.filter(m => m.steps.some(s => s.t === 'chase' || s.t === 'tail' || s.t === 'race')).length;
  assert.ok(chases <= Math.ceil(TEN.length / 3), `${chases} chases`);
  const kinds = new Set(ten.flatMap(m => m.steps.map(s => s.t)));
  for (const k of ['track', 'ride', 'deliver', 'stealth', 'defend', 'collect', 'mini']) assert.ok(kinds.has(k), k);
  assert.ok(ten.some(m => m.steps.some(s => s.t === 'ride')) && ten.some(m => m.steps.some(s => s.stink || s.fragile)), 'rides with care');
  for (const m of ten) {
    assert.ok(m.steps.some(s => s.cp), `${m.id} checkpoint`); assert.ok(PAR[m.id] > 0, `${m.id} par`);
    for (const st of m.steps) if (st.t === 'talk') for (const [who] of st.lines) assert.ok(who === 'hero' || who === 'mate' || PEOPLE[who], `${m.id} ${who}`);
  }
  const last = MISSION.m75.steps.at(-1); assert.equal(last.t, 'talk', 'the chapter ends on a talk');
  // a hook, not an ending
  const words = [...last.lines.map(l => l[1]), KAMPONG_TEXT].join(' ');
  assert.match(words, /junk/); assert.doesNotMatch(words, /\b(finale|the end|happily ever|farewell forever)\b/i);
  const s = newSave(); s.done = MISSIONS.filter(m => m.ch <= 9).map(m => m.id); assert.equal(chapterOf(s), 10);
  const jc = jobCounts(newSave()); assert.equal(jc.storyAll, MISSIONS.length); assert.equal(jc.talesAll, SIDE.length);
});

test('three Hawker Tales on the island, each at its own place so its giver waits there', () => {
  assert.deepEqual(SIDE.slice(-3).map(m => m.id), TALES);
  for (const id of TALES) {
    const m = MISSION[id]; assert.ok(onUbin(c.places[m.at].x, c.places[m.at].y), `${id} on Ubin`);
    assert.ok(!MISSIONS.filter(x => x.ch === 10).some(x => x.at === m.at), `${id} not at a chapter-ten job's place`);
    assert.ok(PAR[id] > 0); assert.ok(TEN.includes(m.side), `${id} opens in chapter ten`);
  }
});

test('the track step: one set of prints shows at a time, reading it shows the next and says which way', () => {
  const i = MISSION.m67.steps.findIndex(s => s.t === 'track'), { w, run, st } = at('m67', i, { assist: true });
  assert.equal(st.t, 'track'); assert.equal(run.items.length, st.route.length + (st.old?.length ?? 0));
  assert.ok(visible(run, 0)); assert.ok(!visible(run, 1), 'only the first shows');
  assert.deepEqual(trackTarget(run), [run.items[0].x, run.items[0].y], 'Assist points at it');
  // stand on the first set and read it
  w.p.b.x = run.items[0].x; w.p.b.y = run.items[0].y + 20; w.step(NO_INPUT, DT);
  const near = trackNear(run, w.p.x, w.p.y); assert.ok(near && near.id === 'read:0', 'E reads it');
  assert.ok(trackAct(run, near.id)); assert.equal(w.p.act?.n, 'read', 'its own animation');
  settle(w, 1.4); assert.ok(run.items[0].got); assert.ok(visible(run, 1), 'the next set shows');
  assert.match(run.progress, /Prints 1\//);
  // the old prints of the false branch (shown once the trail passes them) read as a dead end and never count
  const old = run.items.findIndex(it => it.marks); assert.ok(old > 0 && visible(run, old));
  w.p.b.x = run.items[old].x; w.p.b.y = run.items[old].y; w.p.act = null; w.step(NO_INPUT, DT);
  assert.ok(trackAct(run, `read:${old}`)); settle(w, 1.4); assert.match(run.progress, /Prints 1\//, 'old prints do not count');
  // read the rest in order: the step finishes on the last
  for (let k = 1; k < st.route.length; k++) { w.p.b.x = run.items[k].x; w.p.b.y = run.items[k].y; w.p.act = null; w.step(NO_INPUT, DT); trackAct(run, `read:${k}`); settle(w, 1.4); }
  assert.notEqual(run.cur, st, 'the trail is done'); assert.ok(w.s.stats.trails >= 1);
  assert.equal(heading(0, 0, 10, -10), 'north-east'); assert.equal(heading(0, 0, -5, 0), 'west');
});

test('off Assist the prints show only close by and no arrow leads: the words do', () => {
  const i = MISSION.m67.steps.findIndex(s => s.t === 'track'), { w, run } = at('m67', i, { assist: false });
  w.p.b.x = run.items[0].x + 20 * T; w.p.b.y = run.items[0].y; w.step(NO_INPUT, DT);
  assert.ok(!visible(run, 0), 'too far to see'); assert.equal(trackTarget(run), null, 'no arrow');
  w.p.b.x = run.items[0].x + 2 * T; w.step(NO_INPUT, DT); assert.ok(visible(run, 0), 'seen up close');
});

test('the Tusker Boys: three root at their digs; shoo one for its find; a charge down a track is dodged or bowls you over', () => {
  const w = island(); settle(w, 1);
  assert.equal(w.ubin.boars.length, BOARS); assert.ok(w.ubin.boars.every(b => b.st === 'root'));
  for (const b of w.ubin.boars) assert.ok(passable(c, 'foot', Math.floor(b.x / T), Math.floor(b.y / T)), 'on open ground');
  // shoo
  const b = w.ubin.boars[0]; w.p.b.x = b.x + 40; w.p.b.y = b.y; w.step(NO_INPUT, DT);
  const cash = w.s.cash; let shoo = null; ubinNear(w, (nn) => { if (nn.id.startsWith('shoo:') && !shoo) shoo = nn; });
  assert.ok(shoo, 'E shoos'); ubinAct(w, shoo.id); assert.equal(w.p.act?.n, 'shoo'); settle(w, 0.8);
  assert.ok(w.s.cash > cash && w.s.stats.digs === 1, 'a find and coins'); assert.ok(['flee', 'gone'].includes(b.st));
  // a charge: stand down a track from a rooting boar and wait (Assist gives longer to react)
  assert.ok(PAW_ASSIST > PAW_S && PAW_S >= 1, 'a human has time to react');
  const w2 = island(5); settle(w2, 0.5); const U = w2.c.ubin, [a0, a1] = U.tracks[0];
  const bo = w2.ubin.boars[0]; bo.x = a0[0]; bo.y = a0[1]; w2.ubin.cd = 0;
  const L = Math.hypot(a1[0] - a0[0], a1[1] - a0[1]); w2.p.b.x = a0[0] + (a1[0] - a0[0]) / L * 200; w2.p.b.y = a0[1] + (a1[1] - a0[1]) / L * 200; w2.p.b.speed = 0;
  let seen = new Set(), tumble = false;
  for (let k = 0; k < 6 / DT; k++) { w2.step(NO_INPUT, DT); seen.add(bo.st); if (w2.p.act?.n === 'tumble') tumble = true; }
  assert.ok(seen.has('paw') && seen.has('charge') && seen.has('dizzy'), [...seen].join());
  assert.ok(tumble, 'standing still on the line gets you bowled over (no harm: a tumble)');
});

test('a dizzy boar can be caught; durians and the tower have their own animations and count', () => {
  const w = island(); settle(w, 1); const b = w.ubin.boars[1]; b.st = 'dizzy'; b.t = 0;
  w.p.b.x = b.x + 30; w.p.b.y = b.y; w.step(NO_INPUT, DT);
  let grab = null; ubinNear(w, nn => { if (nn.id.startsWith('grab:')) grab = nn; }); assert.ok(grab);
  ubinAct(w, grab.id); settle(w, 0.8); assert.equal(w.s.stats.boars, 1);
  const [dx, dy] = w.c.ubin.durians[0]; w.p.b.x = dx; w.p.b.y = dy + 30; w.p.act = null; w.step(NO_INPUT, DT);
  const acts = new Set(); ubinAct(w, 'durian'); for (let k = 0; k < 5 / DT; k++) { if (w.p.act) acts.add(w.p.act.n); w.step(NO_INPUT, DT); }
  assert.deepEqual([...acts], ['tree-shake', 'catch', 'eat-durian']); assert.equal(w.s.stats.durians, 1);
  w.p.act = null; ubinAct(w, 'spy'); assert.equal(w.p.act?.n, 'spy'); settle(w, 3.2); assert.equal(w.s.stats.spies, 1);
  for (const t of ['kampong', 'tusker', 'durian', 'ranger']) assert.ok(TROPHIES.some(x => x.id === t), t);
});

test('the paintings: the island’s art is in its own zone, the heroes’ new actions stream, nothing new is core', () => {
  for (const f of ['boar-root-0', 'boar-charge-0', 'boar-dizzy', 'boar-taunt', 'hoof-prints', 'sampan', 'ubin-shops', 'ubin-tower', 'safe-ubin',
    'dora-read-0', 'enzo-read-1', 'dora-shake-0', 'dora-catch-0', 'enzo-spy-0', 'dora-eat-durian-0', 'enzo-hail-0', 'npc-ayu-idle-0', 'npc-lan-idle-0', 'npc-belangkas-idle-0',
    'taring-run-0', 'face-taring', 'headdress', 'tin-chest', 'horseshoe-crab', 'i-durian'])
    assert.ok(FRAMES[f], f);
  for (const a of ['atlas-ubin', 'atlas-boars', 'atlas-cast-ubin']) assert.equal(tierOf(a), 'ubin', a);
  for (const a of ATLASES) if (/17|ubin|boar/.test(a)) assert.notEqual(tierOf(a), 'core', a);
});

test('every new job clears for a human-paced player (Assist on, as by default) and off Assist on normal', () => {
  for (const id of [...TEN, ...TALES]) {
    const r = playMission(id, 'casual', 5); assert.ok(r.won, `${id} casual: ${JSON.stringify(r.why)}`);
  }
  for (const id of ['m67', 'm75']) assert.ok(playMission(id, 'normal', 3, { assist: false }).won, `${id} normal off Assist`);
});

console.log(`jade (seventeenth pass): ${n} tests ok`);
