// Jade Street, the twenty-second pass: Bukit Timah and the Botanic Gardens, chapter 14, "Bukit Timah". The district (the
// nature reserve and its summit trail up Bukit Timah Hill, 163 metres, Hindhede quarry, the old Dairy Farm, the Rail
// Corridor with its truss bridge and the old Bukit Timah railway station, and over the road the Singapore Botanic Gardens:
// the herbarium, the bandstand, Swan Lake and the National Orchid Garden) opens after chapter 13, by the MRT to Beauty
// World or Botanic Gardens; it has its own safe house, three properties, a side gig and an optional fleet perk. The
// chapter's new step is `summit`: a climb, marker to marker, on a Breath meter (walk to save it, rest under a shelter to
// get it back; run it out and you are winded). Big Kow's Bukit Bunch macaques snatch snacks. Not an ending: a hook.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { World, DT, NO_INPUT } from '../.checks/jade-game.js';
import { MISSIONS, MISSION, SIDE, PEOPLE, CHAPTERS, FINALE, BUKIT_OPENS, jobCounts } from '../.checks/jade-story.js';
import { newSave, openDistricts, chapterOf, SAFE_HOUSES, TROPHIES } from '../.checks/jade-save.js';
import { city, T, DISTRICTS, districtAt } from '../.checks/jade-city.js';
import { travelPlan } from '../.checks/jade-mrt.js';
import { cantHail, dropOffs } from '../.checks/jade-taxi.js';
import { HERBARIUM_TEXT, LIGHTHOUSE_TEXT } from '../.checks/jade-cable.js';
import { SUMMIT, summitOf, costOf, underShelter } from '../.checks/jade-summit.js';
import { bukitNear, bukitAct } from '../.checks/jade-bukitfest.js';
import { BUKIT_NAMES } from '../.checks/jade-bukit.js';
import { BIZ } from '../.checks/jade-biz.js';
import { GIG20_DEFS } from '../.checks/jade-gigs20.js';
import { gigMission } from '../.checks/jade-gigs.js';
import { FLEET, cantCall } from '../.checks/jade-fleet.js';
import { PAR } from '../.checks/jade-medals.js';
import { FRAMES, ATLASES } from '../.checks/jade-art.js';
import { tierOf, ZONE_OF } from '../.checks/jade-load.js';
import { FOOT, solidAt } from '../.checks/jade-move.js';
import { playMission } from './jade-bot.mjs';

let n = 0;
const test = (name, f) => { try { f(); n++; } catch (e) { console.error('FAILED:', name); throw e; } };
const c = city();
const FOURTEEN = ['m106', 'm107', 'm108', 'm109', 'm110', 'm111', 'm112', 'm113', 'm114', 'm115'], TALES = ['k42', 'k43', 'k44'];
const inBukit = (x, y) => districtAt(Math.floor(x / T), Math.floor(y / T)) === 'bukit';
/** a world just after chapter 13, standing at a Bukit Timah place */
function bukitW(seed = 3, o = {}) {
  const s = newSave(seed); s.started = true; s.story.intro = true; s.settings.assist = o.assist ?? true;
  s.done = MISSIONS.slice(0, MISSIONS.findIndex(m => m.id === BUKIT_OPENS) + 1).map(m => m.id); s.story.ch = 14;
  const w = new World(s, seed); w.quiet = true; w.talk = null;
  const pl = c.places[o.at ?? 'safe-bukit']; w.p.b.x = pl.x; w.p.b.y = pl.y + 40; w.step(NO_INPUT, DT);
  return w;
}
const settle = (w, s = 2) => { for (let i = 0; i < s / DT; i++) { w.step(NO_INPUT, DT); if (w.talk) w.talk = null; } };
function at(id, i, o = {}) {
  const s = newSave(o.seed ?? 9); s.started = true; s.story.intro = true; s.settings.assist = o.assist ?? false; s.settings.diff = o.diff ?? 'normal';
  s.done = [...MISSIONS.slice(0, MISSIONS.findIndex(m => m.id === 'm106')).map(m => m.id), ...FOURTEEN.slice(0, FOURTEEN.indexOf(id))]; s.story.ch = 14;
  const w = new World(s, o.seed ?? 9); w.quiet = true;
  w.startMission(MISSION[id]); w.talk = null;
  const run = w.run; run.snap = run.snapshot(i); run.enter(i); w.talk = null;
  return { w, run, st: run.cur };
}
const put = (w, x, y) => { w.p.b.x = x; w.p.b.y = y; w.p.b.speed = 0; w.p.act = null; };

test('Bukit Timah: its own district, opened by chapter 13’s finale, real places, a safe house, two MRT stations, taxis', () => {
  assert.ok(DISTRICTS.includes('bukit')); assert.equal(ZONE_OF.bukit, 'bukit'); assert.equal(DISTRICTS.at(-1), 'bukit', 'appended after the others');
  assert.equal(BUKIT_OPENS, 'm105');
  const s = newSave(); s.done = MISSIONS.slice(0, MISSIONS.findIndex(m => m.id === BUKIT_OPENS)).map(m => m.id);
  assert.ok(!openDistricts(s).includes('bukit'), 'fogged before'); s.done.push(BUKIT_OPENS); assert.ok(openDistricts(s).includes('bukit'), 'open after');
  const names = Object.values(c.places).filter(p => p.d === 'bukit').map(p => p.name).join(' | ') + ' | ' + Object.values(BUKIT_NAMES).join(' | ');
  for (const real of ['Bukit Timah Hill', 'Botanic Gardens', 'Swan Lake', 'Orchid Garden', 'bandstand', 'herbarium', 'Rail Corridor', 'truss bridge', 'Bukit Timah railway station', 'Dairy Farm', 'Hindhede quarry', 'Beauty World'])
    assert.match(names, new RegExp(real), real);
  const safe = SAFE_HOUSES.find(h => h.d === 'bukit'); assert.ok(safe && c.places[safe.id] && inBukit(c.places[safe.id].x, c.places[safe.id].y), 'a safe house');
  const props = BIZ.filter(b => b.d === 'bukit'); assert.equal(props.length, 3, 'three properties');
  for (const b of props) assert.ok(PEOPLE[b.keeper], `${b.id} kept by a Bukit Timah giver`);
  // the MRT: Beauty World (the reserve) and Botanic Gardens (the Gardens), and Route me from Chinatown's market takes it
  for (const id of ['stn-beauty', 'stn-botanic']) { const p = c.places[id]; assert.ok(p && p.kind === 'station' && inBukit(p.x, p.y), id); }
  const w = bukitW(), m = c.places['safe-market'];
  for (const to of ['bt-summit', 'orchid']) {
    const t = c.places[to], plan = travelPlan(w, t.x, t.y, m.x, m.y), vias = []; for (let p = plan; p; p = p.then) vias.push(p.via);
    assert.ok(vias.includes('mrt'), `to ${to} by the MRT (${vias})`);
  }
  // taxis run here (roads: Bukit Timah Road, Cluny Road), and drop off at its places
  assert.equal(cantHail(w), null, 'a taxi can be hailed');
  w.p.b.x = m.x; w.p.b.y = m.y + 40; w.step(NO_INPUT, DT);
  assert.ok(dropOffs(w).length > 0); const all = Object.entries(c.places).filter(([, p]) => p.d === 'bukit' && ['safe', 'station', 'spot'].includes(p.kind));
  assert.ok(all.length >= 2, 'Bukit Timah drop-offs exist');
});

test('chapter fourteen: ten jobs round the hill and the Gardens, a mix of steps, at most a third chases, ending on a hook', () => {
  const ten = MISSIONS.filter(m => m.ch === 14);
  assert.deepEqual(ten.map(m => m.id), FOURTEEN); assert.equal(CHAPTERS[13], 'Bukit Timah'); assert.equal(FINALE[13], 'm115');
  const chases = ten.filter(m => m.steps.some(s => s.t === 'chase' || s.t === 'tail' || s.t === 'race')).length;
  assert.ok(chases <= Math.ceil(FOURTEEN.length / 3), `${chases} chases`);
  const kinds = new Set(ten.flatMap(m => m.steps.map(s => s.t)));
  for (const k of ['summit', 'cable', 'train', 'defend', 'chase', 'collect', 'tail', 'trap', 'race']) assert.ok(kinds.has(k), k);
  assert.ok(ten.filter(m => m.steps.some(s => s.t === 'summit')).length >= 2, 'the summit climb is the chapter’s own step');
  for (const m of ten) {
    assert.ok(m.steps.some(s => s.cp), `${m.id} checkpoint`); assert.ok(PAR[m.id] > 0, `${m.id} par`);
    if (m.id !== 'm106') { const g = c.places[m.at]; assert.ok(g && inBukit(g.x, g.y), `${m.id} given in Bukit Timah`); }
    for (const st of m.steps) if (st.t === 'talk') for (const [who] of st.lines) assert.ok(who === 'hero' || who === 'mate' || PEOPLE[who], `${m.id} ${who}`);
    // opponents that fit the place: Big Kow's Bukit Bunch macaques
    for (const st of m.steps) if (st.t === 'defend') assert.equal(st.gang, 'mac', `${m.id} macaques raid`);
    for (const st of m.steps) if (st.t === 'chase' && st.who === 'runner') assert.equal(st.skin, 'mac', `${m.id} a macaque runs`);
  }
  // m106 picks up chapter 13's hook (Pak Camar and the keeper's log on the lighthouse rock), then back by the ferry and
  // the MRT to Beauty World
  assert.match(LIGHTHOUSE_TEXT, /keeper’s log/); assert.equal(MISSION.m106.title, 'The Keeper’s Log');
  assert.ok(MISSION.m106.steps.some(s => s.t === 'cable' && s.to === 'pier-msp'), 'the ferry back');
  assert.ok(MISSION.m106.steps.some(s => s.t === 'train' && s.to === 'stn-beauty'), 'the MRT to Beauty World');
  const last = MISSION.m115.steps.at(-1); assert.equal(last.t, 'talk', 'the chapter ends on a talk');
  const words = [...last.lines.map(l => l[1]), HERBARIUM_TEXT].join(' ');
  assert.doesNotMatch(words, /\b(finale|the end|happily ever|farewell forever)\b/i);
  assert.doesNotMatch(words, /Sutera (is|was) (beaten|caught|finished)/i, 'Sutera is not beaten');
  assert.doesNotMatch(readFileSync(new URL('../app/jade-street/story.tsx', import.meta.url), 'utf8'), /bg-end-14|chapter 14 ending/i);
  const s = newSave(); s.done = MISSIONS.filter(m => m.ch <= 13).map(m => m.id); assert.equal(chapterOf(s), 14);
  s.done = MISSIONS.map(m => m.id); assert.equal(chapterOf(s), 15);
  const jc = jobCounts(newSave()); assert.equal(jc.storyAll, 115); assert.equal(jc.talesAll, 44);
  assert.doesNotMatch(JSON.stringify([...ten, ...TALES.map(id => MISSION[id])]), /grumble/i);
});

test('three Hawker Tales in Bukit Timah, each opening in chapter fourteen', () => {
  assert.deepEqual(SIDE.slice(-3).map(m => m.id), TALES);
  for (const id of TALES) {
    const m = MISSION[id]; assert.ok(inBukit(c.places[m.at].x, c.places[m.at].y), `${id} in Bukit Timah`);
    assert.ok(PAR[id] > 0); assert.ok(FOURTEEN.includes(m.side), `${id} opens in chapter fourteen`);
    assert.ok(m.reward >= 250 && m.reward <= 350); assert.ok(m.steps.some(st => st.cp), `${id} has a checkpoint`);
  }
});

test('the summit step: walking costs breath, running more, standing still gives it back, faster under a shelter', () => {
  const i = MISSION.m107.steps.findIndex(s => s.t === 'summit'), { w, run, st } = at('m107', i);
  const c0 = summitOf(run); assert.ok(c0); assert.equal(run.meter?.name, 'Breath'); assert.ok(run.timer > 0); assert.match(run.progress, /Markers 0\/10/);
  // every marker stands on the trail (walkable), and both shelters are beside it
  for (const id of [...FOURTEEN, ...TALES]) MISSION[id].steps.forEach((s, j) => {
    if (s.t !== 'summit') return;
    const r = at(id, j).run; for (const q of s.route) { const [x, y] = r.spot(q); assert.ok(inBukit(x, y), `${id} marker in Bukit Timah`); assert.ok(!solidAt(w.c, x, y), `${id} marker walkable`); }
  });
  assert.equal(c.bukit.shelters.length, 2); for (const [x, y] of c.bukit.shelters) assert.ok(underShelter(run, x, y));
  // start at the first marker; run along the trail for two seconds
  const [x0, y0] = run.spot(st.route[0]), [x1, y1] = run.spot(st.route[1]); put(w, x0, y0); settle(w, 0.1); assert.equal(c0.k, 1);
  const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy);
  let b = c0.breath, top = 0;
  for (let k = 0; k < 1.0 / DT; k++) { w.step({ ...NO_INPUT, mx: dx / l, my: dy / l }, DT); top = Math.max(top, w.p.b.speed); }
  const ran = b - c0.breath; assert.ok(ran > 0, 'running costs breath'); assert.ok(top <= SUMMIT.top + 1, `a hill run (${top})`); assert.equal(w.p.anim, 'hike');
  put(w, x0, y0); b = c0.breath;
  for (let k = 0; k < 1.0 / DT; k++) w.step({ ...NO_INPUT, mx: dx / l, my: dy / l, sneak: true }, DT);
  const walked = b - c0.breath; assert.ok(walked > 0 && walked < ran * 0.6, `walking is cheaper (${walked} vs ${ran})`);
  // stand still in the open: a little back; under a shelter: a lot back
  c0.breath = 0.3; put(w, x0, y0); settle(w, 1); const still = c0.breath - 0.3; assert.ok(still > 0.05 && still < 0.2, `standing still (${still})`);
  c0.breath = 0.3; const [sx, sy] = c.bukit.shelters[0]; put(w, sx, sy); settle(w, 0.5);
  assert.ok(c0.breath - 0.3 > still, 'faster under a shelter'); assert.match(run.label, /Resting under the shelter/); assert.equal(w.p.anim, 'rest');
});

test('run the breath out and you are winded: a pause, a little time lost, never a failed job; then the markers to the top', () => {
  const i = MISSION.m113.steps.findIndex(s => s.t === 'summit'), { w, run, st } = at('m113', i);
  const c0 = summitOf(run), [x0, y0] = run.spot(st.route[0]); put(w, x0, y0); settle(w, 0.1);
  c0.breath = 0.01; const t0 = run.timer;
  const [x1, y1] = run.spot(st.route[1]), l = Math.hypot(x1 - x0, y1 - y0);
  for (let k = 0; k < 0.5 / DT && !w.p.act; k++) w.step({ ...NO_INPUT, mx: (x1 - x0) / l, my: (y1 - y0) / l }, DT);
  assert.equal(w.p.act?.n, 'winded'); assert.equal(c0.winds, 1); assert.equal(run.hits, 1); assert.ok(run.timer <= t0 - SUMMIT.lose + 0.1, 'it costs time');
  settle(w, SUMMIT.winded + 0.2); assert.ok(!w.p.act, 'back on your feet'); assert.ok(Math.abs(c0.breath - SUMMIT.after) < 0.1, 'with half a breath');
  assert.ok(!w.failed && w.run === run, 'the job goes on');
  for (const q of st.route.slice(1)) { const [x, y] = run.spot(q); put(w, x, y); settle(w, 0.1); }
  assert.equal(w.p.act?.n, 'summit-top'); settle(w, 1.4); assert.notEqual(run.cur, st, 'at the top'); assert.equal(w.s.stats.summits, 1);
});

test('Assist eases the climb, Hard steepens it, a night climb in a hurry is steeper; the hero has their own hill poses', () => {
  const i = MISSION.m107.steps.findIndex(s => s.t === 'summit');
  const as = at('m107', i, { assist: true }), no = at('m107', i), hd = at('m107', i, { diff: 'hard' });
  assert.ok(costOf(as.run, as.st) < costOf(no.run, no.st) && costOf(no.run, no.st) < costOf(hd.run, hd.st), 'Assist < Normal < Hard');
  assert.ok(as.run.timer > no.run.timer, 'Assist gives more time');
  const j = MISSION.m113.steps.findIndex(s => s.t === 'summit'), nt = at('m113', j);
  assert.ok(costOf(nt.run, nt.st) > costOf(no.run, no.st), 'the night climb is steeper going');
  // the whole climb on Normal, run flat out, costs less than two full breaths: one rest at a shelter is always enough
  let len = 0; for (let k = 1; k < no.st.route.length; k++) { const a = no.run.spot(no.st.route[k - 1]), b = no.run.spot(no.st.route[k]); len += Math.hypot(b[0] - a[0], b[1] - a[1]); }
  assert.ok(len / SUMMIT.top * SUMMIT.run * costOf(hd.run, hd.st) < 1, 'on Hard the climb run flat out fits in one breath');
  assert.ok(FOOT.walk < SUMMIT.top, 'walking is slower than the hill run');
  for (const h of ['dora', 'enzo']) for (const f of ['hike-0', 'hike-1', 'winded', 'rest', 'summit', 'snatched', 'scare', 'specimen']) assert.ok(FRAMES[`${h}-${f}`], `${h}-${f}`);
});

test('the macaques snatch snacks; shoo them, read a specimen, rest on a log, touch the summit: their own animations, four trophies', () => {
  const w = bukitW(3, { at: 'trailhead' });
  // walk past a haunt: the snack goes
  const [hx, hy] = c.bukit.haunts[0]; put(w, hx + 30, hy); w.step(NO_INPUT, DT); assert.equal(w.p.act?.n, 'snatched'); settle(w, 1.2);
  const near = {}; bukitNear(w, nn => { near[nn.id] = nn; });
  for (const id of ['shoo', 'specimen', 'rest:0', 'rest:1', 'summit']) assert.ok(near[id], id);
  bukitAct(w, 'shoo'); assert.equal(w.p.act?.n, 'scare'); settle(w, 1.5); assert.equal(w.s.stats.shoos, 1);
  put(w, near.specimen.x, near.specimen.y); bukitAct(w, 'specimen'); assert.equal(w.p.act?.n, 'specimen'); settle(w, 2.5); assert.equal(w.s.stats.specimens, 1);
  put(w, near['rest:0'].x, near['rest:0'].y); bukitAct(w, 'rest:0'); assert.equal(w.p.act?.n, 'rest'); settle(w, 3); assert.equal(w.s.stats.rests, 1);
  put(w, near.summit.x, near.summit.y); bukitAct(w, 'summit'); assert.equal(w.p.act?.n, 'summit'); settle(w, 1.8); assert.equal(w.s.stats.summits, 1);
  assert.ok(w.s.rep.bukit >= 4, 'a little Bukit Timah reputation');
  for (const t of ['secondbearing', 'hillrunner', 'nofeeding', 'naturalist']) assert.ok(TROPHIES.some(x => x.id === t), t);
  assert.equal(TROPHIES.length, 78);
  for (const f of ['mac-snatch', 'mac-run-0', 'mac-munch', 'mac-taunt', 'mac-startled']) assert.ok(FRAMES[f], f);
});

test('a side gig for the herbarium, and the Rail Corridor bike hire’s perk, only in Bukit Timah', () => {
  const g = GIG20_DEFS.find(x => x.d === 'bukit'); assert.ok(g, 'a Bukit Timah gig');
  const w = bukitW(3, { at: 'herbarium' }), r = gigMission(w, g.id); assert.ok(r && r.reward >= 50 && r.reward <= 90);
  assert.ok(r.m.steps.some(s => s.t === 'deliver' && s.item === 'bkt-press'), 'the plant press over the road');
  const f = FLEET.find(x => x.id === 'railbikes'); assert.ok(f && f.kind === 'bike');
  assert.ok(BIZ.some(b => b.id === 'railbikes' && b.d === 'bukit'));
  const on = bukitW(3, { at: 'corridor' }); on.s.biz.railbikes.lvl = 1; assert.doesNotMatch(cantCall(on, 'railbikes') ?? '', /only go round/, 'callable in Bukit Timah');
  const pl = c.places['safe-market']; put(on, pl.x, pl.y + 40); on.step(NO_INPUT, DT);
  assert.match(cantCall(on, 'railbikes') ?? '', /Bukit Timah/);
});

test('the paintings: Bukit Timah’s art streams with its zone, the heroes’ new actions are job art, nothing new is core', () => {
  for (const f of ['bkt-station', 'bkt-bandstand', 'bkt-herbarium', 'bkt-safe', 'bkt-dairy', 'bkt-shelter', 'bkt-stn-beauty', 'bkt-stn-botanic', 'bkt-bridge',
    'bkt-summit', 'bkt-trig', 'bkt-swan', 'bkt-orchid-arch', 'bkt-orchid-urn', 'bkt-press', 'bkt-specimen', 'bkt-snack', 'bkt-track',
    'npc-tenggiling-idle-0', 'npc-lotong-talk-1', 'npc-merbah-wave-0', 'npc-kow22-idle-1', 'face-tenggiling-cross', 'face-lotong-happy', 'face-merbah-worried',
    'biz-beautyworld-3', 'biz-orchidshop-0', 'biz-railbikes-2', 'mi-bukit', 'mi-bandstand', 'mi-truss', 'pin-mac', 'i-breath', 'i-orchid', 'i-specimen', 'i-boot'])
    assert.ok(FRAMES[f], f);
  for (const a of ['atlas-bukit', 'atlas-cast-bukit']) assert.equal(tierOf(a), 'bukit', a);
  assert.equal(tierOf('atlas-act22'), 'job'); assert.equal(tierOf('atlas-ui22'), 'job');
  for (const a of ATLASES) if (/22|bukit/.test(a)) assert.notEqual(tierOf(a), 'core', a);
  for (const id of [...FOURTEEN, ...TALES]) for (const st of MISSION[id].steps) for (const it of [st.item, st.loot]) if (it) assert.ok(FRAMES[it], `${id}: ${it} is painted`);
});

test('every new job clears for a human-paced player (Assist on, as by default) and off Assist on normal', () => {
  for (const id of [...FOURTEEN, ...TALES]) { const r = playMission(id, 'casual', 5); assert.ok(r.won, `${id} casual: ${JSON.stringify(r.why)}`); }
  for (const id of ['m107', 'm111', 'm113', 'm115', 'k43']) assert.ok(playMission(id, 'normal', 3, { assist: false }).won, `${id} normal off Assist`);
});

console.log(`jade (twenty-second pass): ${n} tests ok`);
