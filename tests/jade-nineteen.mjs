// Jade Street, the nineteenth pass: Mandai and chapter 12, "Night Safari". The district (the Night Safari with its
// tram, trails and the Creatures of the Night show, the Singapore Zoo's entrance, River Wonders, Bird Paradise, the
// boardwalk and the Upper Seletar Reservoir's edge) opens after chapter 11, by road from Orchard or by MRT to Mandai Lake
// Road; it has its own safe house, three properties and night visitors for townsfolk. The chapter's new step is `torch`:
// a lights-off night trail, marker to marker by torch, creeping (Shift) past the animals sleeping by the path; run in
// their hearing and one wakes and bolts, and you go back a marker. Ride the tram, feed the lories, watch the show. Not
// an ending: a hook.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { World, DT, NO_INPUT } from '../.checks/jade-game.js';
import { MISSIONS, MISSION, SIDE, PEOPLE, CHAPTERS, FINALE, MANDAI_OPENS, jobCounts } from '../.checks/jade-story.js';
import { newSave, openDistricts, chapterOf, SAFE_HOUSES, TROPHIES } from '../.checks/jade-save.js';
import { city, T, DISTRICTS, districtAt } from '../.checks/jade-city.js';
import { travelPlan } from '../.checks/jade-mrt.js';
import { cantHail } from '../.checks/jade-taxi.js';
import { MANDAI_TEXT, SELETAR_TEXT } from '../.checks/jade-cable.js';
import { torchOf, earOf, TORCH, BEAST_NAME } from '../.checks/jade-torch.js';
import { mandaiNear, mandaiAct, TRAM_S } from '../.checks/jade-mandaifest.js';
import { BIZ } from '../.checks/jade-biz.js';
import { MANDAI_NAMES } from '../.checks/jade-mandai.js';
import { PAR } from '../.checks/jade-medals.js';
import { FRAMES, ATLASES } from '../.checks/jade-art.js';
import { tierOf, ZONE_OF } from '../.checks/jade-load.js';
import { playMission } from './jade-bot.mjs';

let n = 0;
const test = (name, f) => { try { f(); n++; } catch (e) { console.error('FAILED:', name); throw e; } };
const c = city();
const TWELVE = ['m86', 'm87', 'm88', 'm89', 'm90', 'm91', 'm92', 'm93', 'm94', 'm95'], TALES = ['k30', 'k31', 'k32'];
const inMandai = (x, y) => districtAt(Math.floor(x / T), Math.floor(y / T)) === 'mandai';
/** a world just after chapter 11, standing at a Mandai place */
function mandai(seed = 3, o = {}) {
  const s = newSave(seed); s.started = true; s.story.intro = true; s.settings.assist = o.assist ?? true;
  s.done = MISSIONS.slice(0, MISSIONS.findIndex(m => m.id === MANDAI_OPENS) + 1).map(m => m.id); s.story.ch = 12;
  const w = new World(s, seed); w.quiet = true; w.talk = null;
  const pl = c.places[o.at ?? 'stn-mandai']; w.p.b.x = pl.x; w.p.b.y = pl.y + 40; w.step(NO_INPUT, DT);
  return w;
}
const settle = (w, s = 2) => { for (let i = 0; i < s / DT; i++) w.step(NO_INPUT, DT); };
function at(id, i, o = {}) {
  const s = newSave(o.seed ?? 9); s.started = true; s.story.intro = true; s.settings.assist = o.assist ?? false; s.settings.diff = o.diff ?? 'normal';
  s.done = [...MISSIONS.slice(0, MISSIONS.findIndex(m => m.id === 'm86')).map(m => m.id), ...TWELVE.slice(0, TWELVE.indexOf(id))]; s.story.ch = 12;
  const w = new World(s, o.seed ?? 9); w.quiet = true;
  w.startMission(MISSION[id]); w.talk = null;
  const run = w.run; run.snap = run.snapshot(i); run.enter(i); w.talk = null;
  return { w, run, st: run.cur };
}
const put = (w, x, y) => { w.p.b.x = x; w.p.b.y = y; w.p.b.speed = 0; w.p.act = null; };
const step = (w, inp, sec) => { for (let k = 0; k < sec / DT && !w.failed; k++) { w.step(inp, DT); if (w.talk) w.talk = null; } };
/** walk the hero from where they stand towards (x, y), running or creeping, for at most `sec` seconds */
function walk(w, x, y, sneak, sec = 8) {
  for (let k = 0; k < sec / DT && !w.failed; k++) {
    const dx = x - w.p.x, dy = y - w.p.y, l = Math.hypot(dx, dy); if (l < 20) return true;
    w.step({ ...NO_INPUT, mx: dx / l, my: dy / l, sneak }, DT); if (w.talk) w.talk = null;
  }
  return false;
}

test('Mandai: its own district, opened by chapter 11’s finale, with real places, a safe house, the MRT and taxis', () => {
  assert.ok(DISTRICTS.includes('mandai')); assert.equal(ZONE_OF.mandai, 'mandai');
  const s = newSave(); s.done = MISSIONS.slice(0, MISSIONS.findIndex(m => m.id === MANDAI_OPENS)).map(m => m.id);
  assert.equal(MANDAI_OPENS, 'm85'); assert.ok(!openDistricts(s).includes('mandai'), 'fogged before');
  s.done.push(MANDAI_OPENS); assert.ok(openDistricts(s).includes('mandai'), 'open after');
  const names = Object.values(c.places).filter(p => p.d === 'mandai').map(p => p.name).join(' | ') + ' | ' + Object.values(MANDAI_NAMES).join(' | ');
  for (const real of ['Night Safari', 'Singapore Zoo', 'River Wonders', 'Bird Paradise', 'boardwalk', 'Upper Seletar Reservoir', 'Creatures of the Night', 'Mandai Lake Road'])
    assert.match(names, new RegExp(real), real);
  const safe = SAFE_HOUSES.find(h => h.d === 'mandai'); assert.ok(safe && c.places[safe.id] && inMandai(c.places[safe.id].x, c.places[safe.id].y), 'a safe house');
  const stn = (c.isle?.stations ?? []).find(st => st.id === 'stn-mandai'); assert.ok(stn && inMandai(stn.x, stn.y), 'Mandai Lake Road station');
  assert.equal(c.isle.stations.find(st => !['stn-beauty', 'stn-botanic', 'stn-kranji', 'stn-woodlands', 'stn-punggol'].includes(st.id)).id, 'stn-mandai', 'first on the line'); // (after the twenty-fifth pass's Punggol, the twenty-fourth's Kranji and Woodlands and the twenty-second's two Bukit Timah stations)
  const props = BIZ.filter(b => b.d === 'mandai'); assert.equal(props.length, 3, 'three properties');
  for (const b of props) assert.ok(PEOPLE[b.keeper], `${b.id} kept by a Mandai giver`);
  for (const k of ['boat', 'bike', 'scooter']) assert.ok(c.parking.some(p => p.d === 'mandai' && p.kind === k), `a ${k} in Mandai`);
  const w = mandai(); assert.equal(cantHail(w), null, 'a taxi comes to Mandai');
  // from Chinatown's market to the Night Safari: the trip has an MRT leg to Mandai Lake Road
  const m = c.places['safe-market'], to = c.places['safari'], plan = travelPlan(w, to.x, to.y, m.x, m.y);
  assert.ok(plan && (plan.via === 'mrt' || plan.then?.via === 'mrt'), `by MRT (${plan?.via})`);
  assert.match(MANDAI_TEXT, /Mandai Lake Road/);
  // it sits in the map's north-west corner, against Orchard's west edge (the parkland it took was filler)
  assert.ok(stn.y < 40 * T && stn.x < 40 * T, 'north-west');
});

test('chapter twelve: ten jobs, mostly at night in Mandai, a mix of steps, at most a third chases, ending on a hook', () => {
  const ten = MISSIONS.filter(m => m.ch === 12);
  assert.deepEqual(ten.map(m => m.id), TWELVE); assert.equal(CHAPTERS[11], 'Night Safari'); assert.equal(FINALE[11], 'm95');
  const chases = ten.filter(m => m.steps.some(s => s.t === 'chase' || s.t === 'tail' || s.t === 'race')).length;
  assert.ok(chases <= Math.ceil(TWELVE.length / 3), `${chases} chases`);
  const kinds = new Set(ten.flatMap(m => m.steps.map(s => s.t)));
  for (const k of ['torch', 'train', 'case', 'collect', 'deliver', 'blend', 'swap', 'chase', 'defend']) assert.ok(kinds.has(k), k);
  assert.ok(ten.filter(m => m.steps.some(s => s.t === 'torch')).length >= 3, 'the torch trail is the chapter’s own step');
  assert.ok(ten.filter(m => m.mods?.includes('night')).length >= 8, 'most jobs at night');
  for (const m of ten) {
    assert.ok(m.steps.some(s => s.cp), `${m.id} checkpoint`); assert.ok(PAR[m.id] > 0, `${m.id} par`);
    if (m.id !== 'm86') { const g = c.places[m.at]; assert.ok(g && inMandai(g.x, g.y), `${m.id} given in Mandai`); }
    for (const st of m.steps) if (st.t === 'talk') for (const [who] of st.lines) assert.ok(who === 'hero' || who === 'mate' || PEOPLE[who], `${m.id} ${who}`);
    // opponents that fit the place: Tuan Hantu's barn owls on watch, Madam Sutera's crows
    for (const st of m.steps) if (st.t === 'case' || st.t === 'swap') assert.equal(st.skin, 'owl', `${m.id} owls keep watch`);
  }
  const last = MISSION.m95.steps.at(-1); assert.equal(last.t, 'talk', 'the chapter ends on a talk');
  const words = [...last.lines.map(l => l[1]), SELETAR_TEXT].join(' ');
  assert.match(words, /lighthouse/i); assert.match(words, /one-eight-two/);
  assert.doesNotMatch(words, /\b(finale|the end|happily ever|farewell forever)\b/i);
  // no end panel for this chapter: the story goes on
  assert.doesNotMatch(readFileSync(new URL('../app/jade-street/story.tsx', import.meta.url), 'utf8'), /bg-end-12|chapter 12 ending/i);
  const s = newSave(); s.done = MISSIONS.filter(m => m.ch <= 11).map(m => m.id); assert.equal(chapterOf(s), 12);
  s.done = MISSIONS.filter(m => m.ch <= 12).map(m => m.id); assert.equal(chapterOf(s), 13);
  const jc = jobCounts(newSave()); assert.equal(jc.storyAll, 145); assert.equal(jc.talesAll, 61);
  // Grumbles never appear here
  assert.doesNotMatch(JSON.stringify([...ten, ...TALES.map(id => MISSION[id])]), /grumble/i);
});

test('three Hawker Tales in Mandai, each opening in chapter twelve', () => {
  assert.deepEqual(SIDE.slice(SIDE.findIndex(m => m.id === TALES[0])).slice(0, 3).map(m => m.id), TALES); // (the twentieth pass's six and the twenty-first's three after these)
  for (const id of TALES) {
    const m = MISSION[id]; assert.ok(inMandai(c.places[m.at].x, c.places[m.at].y), `${id} in Mandai`);
    assert.ok(PAR[id] > 0); assert.ok(TWELVE.includes(m.side), `${id} opens in chapter twelve`);
  }
});

test('the torch step: dark but for your torch, marker to marker; run in an animal’s hearing and it bolts', () => {
  const i = MISSION.m87.steps.findIndex(s => s.t === 'torch'), { w, run, st } = at('m87', i, { assist: false });
  const c0 = torchOf(run); assert.ok(c0); assert.equal(c0.beasts.length, st.beasts.length); assert.match(run.progress, /Markers 0\/3/);
  assert.equal(run.meter?.name, 'Stir'); assert.ok(run.timer > 0);
  // no marker or start sits inside an animal's hearing (even on Hard), so a leg never starts already in earshot
  for (const id of [...TWELVE, ...TALES]) MISSION[id].steps.forEach((s, j) => {
    if (s.t !== 'torch') return;
    const r = at(id, j, { assist: false, diff: 'hard' }).run, ear = earOf(r), cs = torchOf(r);
    for (const q of s.route) { const [x, y] = r.spot(q); for (const b of cs.beasts) assert.ok(Math.hypot(b.x - x, b.y - y) > ear + 8, `${id} marker clear of the ${b.kind}`); }
    const prev = MISSION[id].steps[j - 1], [sx, sy] = prev?.t === 'goto' ? r.spot(prev.at) : [r.w.p.x, r.w.p.y];
    for (const b of cs.beasts) assert.ok(Math.hypot(b.x - sx, b.y - sy) > ear + 8, `${id} start clear of the ${b.kind}`);
  });
  // the HUD names the animal as you come near, and says to creep
  const b = c0.beasts[0], [m0x, m0y] = run.spot(st.route[0]);
  put(w, m0x, m0y); step(w, NO_INPUT, 0.2); assert.equal(c0.k, 1, 'the first marker reached');
  const back = [...c0.back];
  // run straight at the pangolin: the HUD warns, the Stir meter fills, it bolts, you go back to the marker, time lost
  let warned = false; const t0 = run.timer;
  for (let k = 0; k < 8 / DT && c0.bolts === 0; k++) {
    // (round and round it at a run, a little way off)
    const tx = b.x + 80 * Math.cos(k * DT * 3), ty = b.y + 80 * Math.sin(k * DT * 3), dx = tx - w.p.x, dy = ty - w.p.y, l = Math.hypot(dx, dy) || 1;
    w.step({ ...NO_INPUT, mx: dx / l, my: dy / l }, DT); if (/Shh!|stirring/.test(run.label)) warned = true;
  }
  assert.ok(warned, 'the HUD warned first'); assert.match(BEAST_NAME[b.kind], /pangolin/);
  assert.equal(c0.bolts, 1, 'it bolted'); assert.equal(w.p.act?.n, 'torch-startle'); assert.equal(run.hits, 1);
  assert.ok(run.timer <= t0 - TORCH.lose + 0.5, 'it costs time');
  settle(w, 1); assert.ok(Math.hypot(w.p.x - back[0], w.p.y - back[1]) < 40, 'back at the last marker');
  // creep (Shift) past it instead: no bolt, on to the next markers and done
  settle(w, TORCH.away + 1.5);
  for (const q of st.route.slice(1)) { const [x, y] = run.spot(q); assert.ok(walk(w, x, y, true, 20), 'crept to the marker'); step(w, NO_INPUT, 0.1); }
  assert.equal(c0.bolts, 1, 'creeping never woke it'); assert.notEqual(run.cur, st, 'the trail is walked'); assert.equal(w.s.stats.torches, 1);
});

test('Assist eases the torch trail, Hard sharpens it; the hero has their own torch poses', () => {
  const i = MISSION.m93.steps.findIndex(s => s.t === 'torch');
  const as = at('m93', i, { assist: true }).run, no = at('m93', i, { assist: false }).run, hd = at('m93', i, { assist: false, diff: 'hard' }).run;
  assert.ok(earOf(as) < earOf(no) && earOf(no) < earOf(hd), 'hearing: Assist < Normal < Hard');
  assert.ok(as.timer > no.timer, 'Assist gives more night');
  for (const h of ['dora', 'enzo']) for (const f of ['torch-0', 'torch-1', 'listen', 'hush', 'startle', 'lory', 'clap', 'tram']) assert.ok(FRAMES[`${h}-${f}`], `${h}-${f}`);
  for (const k of ['fcat', 'pango', 'porc', 'squir']) for (const p of ['rest', 'alert', 'bolt']) assert.ok(FRAMES[`bst-${k}-${p}`], `bst-${k}-${p}`);
  // the step's own animation while you walk it: creeping by torch, listening when still
  const { w } = at('m93', i, { assist: true }); step(w, NO_INPUT, 0.2); assert.equal(w.p.anim, 'torch-still');
  step(w, { ...NO_INPUT, mx: 1, sneak: true }, 0.4); assert.equal(w.p.anim, 'torch');
});

test('the owls keep watch with their own frames', () => {
  for (const f of ['owl-walk-down-0', 'owl-walk-down-1', 'owl-walk-up-0', 'owl-walk-up-1', 'owl-run-0', 'owl-run-1', 'owl-sing', 'owl-peer', 'owl-munch', 'owl-taunt']) assert.ok(FRAMES[f], f);
  const i = MISSION.m92.steps.findIndex(s => s.t === 'swap'), { run } = at('m92', i, { assist: true });
  assert.ok(run.actors.filter(a => a.kind === 'guard').every(a => a.skin === 'owl'), 'owls on the boardwalk');
});

test('the tram, the lories and the show: their own animations, counted, and four trophies', () => {
  const w = mandai(3, { at: 'tramstop' });
  const near = {}; mandaiNear(w, nn => { near[nn.id] = nn; });
  for (const id of ['tram', 'lory', 'show']) assert.ok(near[id], id);
  put(w, near.tram.x, near.tram.y); w.step(NO_INPUT, DT); mandaiAct(w, 'tram'); assert.equal(w.p.act?.n, 'tram'); settle(w, TRAM_S + 0.5); assert.equal(w.s.stats.trams, 1);
  put(w, near.lory.x, near.lory.y); w.step(NO_INPUT, DT); mandaiAct(w, 'lory'); assert.equal(w.p.act?.n, 'lory'); settle(w, 2.6); assert.equal(w.s.stats.lories, 1);
  put(w, near.show.x, near.show.y); w.step(NO_INPUT, DT); mandaiAct(w, 'show'); assert.equal(w.p.act?.n, 'clap'); settle(w, 3); assert.equal(w.s.stats.shows, 1);
  assert.ok(w.s.rep.mandai >= 3, 'a little Mandai reputation');
  for (const t of ['nightsafari', 'softly', 'loryfeeder', 'nightowl']) assert.ok(TROPHIES.some(x => x.id === t), t);
  assert.equal(TROPHIES.length, 95);
});

test('the paintings: Mandai’s art streams with its zone, the heroes’ new actions too, nothing new is core', () => {
  for (const f of ['mnd-lodge', 'mnd-zoo', 'mnd-panda', 'mnd-aviary', 'mnd-amphi', 'mandai-stn', 'safe-mandai', 'mnd-tram', 'mnd-tramstop', 'mnd-seaplane',
    'mnd-lantern', 'mnd-stud', 'mnd-trig', 'mnd-torch', 'mnd-crate', 'mnd-nectar', 'mnd-rubbing',
    'npc-kongkang-idle-0', 'npc-enggang-talk-1', 'npc-bintu-wave-0', 'npc-hantu-idle-1', 'face-hantu-cross', 'face-kongkang-happy',
    'biz-safarishop-3', 'biz-boardkopi-0', 'biz-nectarbar-2', 'mi-nightsafari', 'mi-aviary', 'pin-owl', 'i-torch', 'i-eyes', 'i-lory'])
    assert.ok(FRAMES[f], f);
  for (const a of ['atlas-mandai', 'atlas-cast-mandai', 'atlas-lory19b']) assert.equal(tierOf(a), 'mandai', a);
  for (const f of ['lory-perch', 'lory-front', 'lory-preen', 'lory-wings', 'lory-wings-front', 'lory-bob', 'perch-bare']) assert.ok(FRAMES[`mnd-${f}`], `mnd-${f}`);
  assert.equal(tierOf('atlas-act19'), 'job'); assert.equal(tierOf('atlas-ui19'), 'job');
  for (const a of ATLASES) if (/19|mandai/.test(a)) assert.notEqual(tierOf(a), 'core', a);
});

test('every new job clears for a human-paced player (Assist on, as by default) and off Assist on normal', () => {
  for (const id of [...TWELVE, ...TALES]) {
    const r = playMission(id, 'casual', 5); assert.ok(r.won, `${id} casual: ${JSON.stringify(r.why)}`);
  }
  for (const id of ['m87', 'm93', 'm95', 'k31']) assert.ok(playMission(id, 'normal', 3, { assist: false }).won, `${id} normal off Assist`);
});

console.log(`jade (nineteenth pass): ${n} tests ok`);
