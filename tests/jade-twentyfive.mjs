// Jade Street, the twenty-fifth pass: Punggol and Coney Island and chapter 16, "King Tide". The district (Punggol Point,
// its Promenade and jetty looking across the water at Pulau Ubin, the old tide-gauge house; Coney Island's casuarinas,
// wild beach, Brahman cattle and its two bridges; Punggol town and the Waterway; the Lorong Halus wetland and the old sea
// wall; the red park connectors) opens after chapter 15, over the water south of Ubin, by the MRT to Punggol station; it
// has its own safe house, three properties, a side gig and a kayak-hire fleet perk. The chapter's new step is `herd`:
// walking one of Coney's free-roaming cattle home along a trail, by where you stand (she walks away from you). Not an
// ending: a hook.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { World, DT, NO_INPUT } from '../.checks/jade-game.js';
import { MISSIONS, MISSION, SIDE, PEOPLE, CHAPTERS, FINALE, PUNGGOL_OPENS } from '../.checks/jade-story.js';
import { newSave, openDistricts, SAFE_HOUSES, TROPHIES, offered } from '../.checks/jade-save.js';
import { city, T, W, DISTRICTS, districtAt } from '../.checks/jade-city.js';
import { travelPlan, walkDist } from '../.checks/jade-mrt.js';
import { dropOffs, cantHail } from '../.checks/jade-taxi.js';
import { PUNGGOL_TEXT, KINGTIDE_TEXT } from '../.checks/jade-cable.js';
import { herdOf, bandOf, herdSpot, HERD } from '../.checks/jade-herd.js';
import { punggolNear, punggolAct, FISH_S } from '../.checks/jade-punggolfest.js';
import { PUNGGOL_NAMES } from '../.checks/jade-punggol.js';
import { BIZ } from '../.checks/jade-biz.js';
import { GIG20_DEFS } from '../.checks/jade-gigs20.js';
import { gigMission } from '../.checks/jade-gigs.js';
import { FLEET, cantCall } from '../.checks/jade-fleet.js';
import { PAR } from '../.checks/jade-medals.js';
import { FRAMES, ATLASES } from '../.checks/jade-art.js';
import { tierOf, ZONE_OF } from '../.checks/jade-load.js';
import { playMission, missionSave } from './jade-bot.mjs';

let n = 0;
const test = (name, f) => { try { f(); n++; } catch (e) { console.error('FAILED:', name); throw e; } };
const c = city();
const SIXTEEN = ['m126', 'm127', 'm128', 'm129', 'm130', 'm131', 'm132', 'm133', 'm134', 'm135'], TALES = ['k56', 'k57', 'k58'];
const inPunggol = (x, y) => districtAt(Math.floor(x / T), Math.floor(y / T)) === 'punggol';
/** a world just after chapter 15, standing at a Punggol place */
function punggol(seed = 3, o = {}) {
  const s = newSave(seed); s.started = true; s.story.intro = true; s.settings.assist = o.assist ?? true;
  s.done = MISSIONS.slice(0, MISSIONS.findIndex(m => m.id === PUNGGOL_OPENS) + 1).map(m => m.id); s.story.ch = 16;
  const w = new World(s, seed); w.quiet = true; w.talk = null;
  const pl = c.places[o.at ?? 'safe-punggol']; w.p.b.x = pl.x; w.p.b.y = pl.y + 40; w.step(NO_INPUT, DT);
  return w;
}
const settle = (w, s = 2) => { for (let i = 0; i < s / DT; i++) { w.step(NO_INPUT, DT); if (w.talk) w.talk = null; } };
function at(id, i, o = {}) {
  const s = newSave(o.seed ?? 9); s.started = true; s.story.intro = true; s.settings.assist = o.assist ?? false; s.settings.diff = o.diff ?? 'normal';
  const side = MISSION[id].side;
  s.done = side ? MISSIONS.slice(0, MISSIONS.findIndex(m => m.id === side) + 1).map(m => m.id) : [...MISSIONS.slice(0, MISSIONS.findIndex(m => m.id === 'm126')).map(m => m.id), ...SIXTEEN.slice(0, SIXTEEN.indexOf(id))];
  s.story.ch = 16;
  const w = new World(s, o.seed ?? 9); w.quiet = true;
  w.startMission(MISSION[id]); w.talk = null;
  const run = w.run; run.snap = run.snapshot(i); run.enter(i); w.talk = null;
  return { w, run, st: run.cur };
}
const put = (w, x, y) => { w.p.b.x = x; w.p.b.y = y; w.p.b.speed = 0; w.p.act = null; };
const herdAt = (id, o) => at(id, MISSION[id].steps.findIndex(s => s.t === 'herd'), o);

test('Punggol and Coney Island: their own district, opened by chapter 15’s finale, real places, a safe house, the MRT, over the water', () => {
  assert.ok(DISTRICTS.includes('punggol')); assert.equal(ZONE_OF.punggol, 'punggol');
  const s = newSave(); s.done = MISSIONS.slice(0, MISSIONS.findIndex(m => m.id === PUNGGOL_OPENS)).map(m => m.id);
  assert.ok(!openDistricts(s).includes('punggol'), 'fogged before'); s.done.push(PUNGGOL_OPENS); assert.ok(openDistricts(s).includes('punggol'), 'open after');
  const names = Object.values(c.places).filter(p => p.d === 'punggol').map(p => p.name).join(' | ') + ' | ' + Object.values(PUNGGOL_NAMES).join(' | ');
  for (const real of ['Punggol Point', 'Punggol Promenade', 'Punggol Point Jetty', 'Coney Island', 'Punggol Waterway', 'Lorong Halus', 'the red bridge', 'the old sea wall', 'the park connector', 'Punggol station'])
    assert.match(names, new RegExp(real), real);
  const safe = SAFE_HOUSES.find(h => h.d === 'punggol'); assert.ok(safe && c.places[safe.id] && inPunggol(c.places[safe.id].x, c.places[safe.id].y), 'a safe house');
  const props = BIZ.filter(b => b.d === 'punggol'); assert.equal(props.length, 3, 'three properties');
  for (const b of props) assert.ok(PEOPLE[b.keeper], `${b.id} kept by a Punggol giver`);
  // Punggol station, and Route me from Chinatown takes the train; no land joins it, so no walk on or off
  const st = c.places['stn-punggol']; assert.ok(st && inPunggol(st.x, st.y), 'Punggol station');
  const w = punggol(), m = c.places['safe-market'], to = c.places['pg-gauge'];
  const plan = travelPlan(w, to.x, to.y, m.x, m.y), vias = []; for (let p = plan; p; p = p.then) vias.push(p.via);
  assert.ok(vias.includes('mrt'), `by the MRT (${vias})`);
  assert.equal(walkDist(m.x, m.y, to.x, to.y), Infinity, 'no walk over the water');
  assert.match(PUNGGOL_TEXT, /Punggol/); assert.match(PUNGGOL_TEXT, /MRT/);
  // no roads: no taxis there, none dropping off there, no cab called there
  assert.match(cantHail(w) ?? '', /No taxis in Punggol/);
  const town = punggol(3, { at: 'safe-market' }); put(town, m.x, m.y + 40); town.step(NO_INPUT, DT);
  assert.ok(!dropOffs(town).some(d => c.places[d.id]?.d === 'punggol'), 'no taxi drops off in Punggol');
  w.s.biz.taxi.lvl = 1; assert.match(cantCall(w, 'taxi') ?? '', /No roads/);
});

test('chapter sixteen: ten jobs round Punggol and Coney, a mix of steps, at most a third chases, ending on a hook', () => {
  const ten = MISSIONS.filter(m => m.ch === 16);
  assert.deepEqual(ten.map(m => m.id), SIXTEEN); assert.equal(CHAPTERS[15], 'King Tide'); assert.equal(FINALE[15], 'm135');
  const chases = ten.filter(m => m.steps.some(s => s.t === 'chase' || s.t === 'tail' || s.t === 'race')).length;
  assert.ok(chases <= Math.ceil(SIXTEEN.length / 3), `${chases} chases`);
  const kinds = new Set(ten.flatMap(m => m.steps.map(s => s.t)));
  for (const k of ['herd', 'case', 'collect', 'race', 'tail', 'chase', 'swap', 'defend']) assert.ok(kinds.has(k), k);
  assert.ok([...ten, ...TALES.map(id => MISSION[id])].filter(m => m.steps.some(s => s.t === 'herd')).length >= 3, 'herding is the chapter’s own step');
  for (const m of ten) {
    assert.ok(m.steps.some(s => s.cp), `${m.id} checkpoint`); assert.ok(PAR[m.id] > 0, `${m.id} par`);
    const g = c.places[m.at]; assert.ok(g && inPunggol(g.x, g.y), `${m.id} given in Punggol`);
    for (const st of m.steps) if (st.t === 'talk') for (const [who] of st.lines) assert.ok(who === 'hero' || who === 'mate' || PEOPLE[who], `${m.id} ${who}`);
    // opponents that fit the place: Abang Pucong's Pucong Boys, grey herons
    for (const st of m.steps) if (st.t === 'case' || st.t === 'swap' || st.t === 'chase') assert.equal(st.skin, 'pucong', `${m.id} herons keep watch`);
  }
  // it carries chapter 15's hook on: the 1937 chart, Pak Camar's light, Sutera, her crows and owls, the island
  const all = JSON.stringify(ten);
  for (const w of ['1937', 'Pak Camar', 'Sutera', 'Pip', 'island no other chart has']) assert.ok(all.includes(w) || PUNGGOL_TEXT.includes(w) || KINGTIDE_TEXT.includes(w), w);
  const last = MISSION.m135.steps.at(-1); assert.equal(last.t, 'talk', 'the chapter ends on a talk');
  const words = [...last.lines.map(l => l[1]), KINGTIDE_TEXT].join(' ');
  assert.doesNotMatch(words, /\b(finale|the end|happily ever|farewell forever)\b/i);
  assert.doesNotMatch(words, /Sutera (is|was) (beaten|caught|finished)/i, 'Sutera is not beaten');
  assert.match(KINGTIDE_TEXT, /Three nights/, 'a hook');
  assert.doesNotMatch(readFileSync(new URL('../app/jade-street/story.tsx', import.meta.url), 'utf8'), /bg-end-16|chapter 16 ending/i);
  assert.doesNotMatch(JSON.stringify([...ten, ...TALES.map(id => MISSION[id])]), /grumble/i);
});

test('three Hawker Tales in Punggol, each opening in chapter sixteen', () => {
  for (const id of TALES) {
    const m = MISSION[id]; assert.ok(m && SIDE.includes(m), id); assert.ok(inPunggol(c.places[m.at].x, c.places[m.at].y), `${id} in Punggol`);
    assert.ok(PAR[id] > 0); assert.ok(SIXTEEN.includes(m.side), `${id} opens in chapter sixteen`);
    assert.ok(m.reward >= 250 && m.reward <= 400); assert.ok(m.steps.some(st => st.cp), `${id} has a checkpoint`);
    const here = offered(missionSave(id)).filter(o => o.at === m.at).map(o => o.id);
    assert.deepEqual(here, [id], `${id}: nothing else on offer at ${m.at} when it opens (${here})`);
  }
});

test('the herd step: behind her she walks on, gate by gate; in front she backs off, never past a gate; the HUD says which', () => {
  const { w, run, st } = herdAt('m127'), cow = herdOf(run);
  assert.ok(cow); assert.equal(run.meter?.name, 'Calm'); assert.match(run.progress, /Gates 0\/6/);
  // too far: she grazes
  put(w, cow.x + 600, cow.y + 600); settle(w, 0.3); assert.equal(cow.mode, 'graze'); assert.match(run.label, /grazing/);
  // behind her, in the band: she walks on
  let gates = 0, k = 0;
  while (run.cur === st && k++ < 60 / DT) { const h = herdSpot(run); put(w, h[0], h[1]); w.step(NO_INPUT, DT); if (w.talk) w.talk = null; if (cow.mode === 'walk') assert.match(run.label, /walking on/); if (cow.gate > gates) gates = cow.gate; if (gates >= 2) break; }
  assert.ok(gates >= 2, 'through two gates');
  for (let j = 0; j < 2 / DT; j++) { const h = herdSpot(run); put(w, h[0], h[1]); w.step(NO_INPUT, DT); if (w.talk) w.talk = null; }
  // in front of her: she backs off down the trail, never past the gate she last went through
  const [, far] = bandOf(run, st), held = cow.gate;
  const sAt = cow.s;
  for (let j = 0; j < 4 / DT; j++) { put(w, cow.x + cow.hx * far * 0.7, cow.y + cow.hy * far * 0.7); w.step(NO_INPUT, DT); if (w.talk) w.talk = null; }
  assert.equal(cow.mode, 'back'); assert.match(run.label, /in front of her/); assert.ok(cow.s < sAt, 'she backed off'); assert.equal(cow.gate, held, 'the gate holds');
  // walk her the rest of the way home
  k = 0; while (run.cur === st && k++ < 90 / DT) { const h = herdSpot(run); if (!h) break; put(w, h[0], h[1]); w.step(NO_INPUT, DT); if (w.talk) w.talk = null; }
  assert.notEqual(run.cur, st, 'home'); assert.equal(w.s.stats.herds, 1);
});

test('too close, her calm drains and she bolts back to the last gate (its own pose, time lost, never the job)', () => {
  const { w, run, st } = herdAt('m132'), cow = herdOf(run);
  assert.ok(run.timer > 0, 'dusk is timed');
  const t0 = run.timer; let warned = false;
  for (let k = 0; k < 10 / DT && cow.bolts === 0; k++) { put(w, cow.x - cow.hx * 30, cow.y - cow.hy * 30); w.step(NO_INPUT, DT); if (w.talk) w.talk = null; if (/Too close/.test(run.label)) warned = true; }
  assert.ok(warned, 'the HUD warned first'); assert.equal(cow.bolts, 1); assert.equal(cow.mode, 'bolt'); assert.equal(w.p.act?.n, 'herd-bolt'); assert.equal(run.hits, 1);
  assert.ok(run.timer <= t0 - HERD.lose, 'it costs time'); assert.match(run.label, /bolted back/);
  put(w, cow.x + 800, cow.y + 800); settle(w, 3); assert.notEqual(cow.mode, 'bolt', 'she settles'); assert.equal(run.cur, st, 'still the same job');
});

test('Assist widens the band and slows the drain, Hard narrows it; a calf is jumpier; the partner keeps back; the hero has their own poses', () => {
  const as = herdAt('m127', { assist: true }), no = herdAt('m127'), hd = herdAt('m127', { diff: 'hard' }), cf = herdAt('k57');
  const [an, af, ad] = bandOf(as.run, as.st), [nn, nf, nd] = bandOf(no.run, no.st), [hn, hf, hd2] = bandOf(hd.run, hd.st), [cn, , cd] = bandOf(cf.run, cf.st);
  assert.ok(an < nn && nn < hn, 'inner ring: Assist < Normal < Hard'); assert.ok(af > nf && nf > hf, 'outer ring: Assist > Normal > Hard');
  assert.ok(ad < nd && nd < hd2, 'drain: Assist < Normal < Hard'); assert.ok(cn > nn && cd > nd, 'a calf minds you more');
  // the partner stays where they stand while you herd
  const { w, run } = no, m0 = [w.mate.x, w.mate.y];
  for (let k = 0; k < 2 / DT; k++) { const h = herdSpot(run); put(w, h[0], h[1]); w.step(NO_INPUT, DT); if (w.talk) w.talk = null; }
  assert.ok(Math.hypot(w.mate.x - m0[0], w.mate.y - m0[1]) < 4, 'the partner keeps back'); assert.equal(w.p.anim, 'herd-still');
  for (const h of ['dora', 'enzo']) for (const f of ['herd-0', 'herd-1', 'herd-still', 'herd-bolt', 'fish-0', 'fish-1', 'lookout']) assert.ok(FRAMES[`${h}-${f}`], `${h}-${f}`);
});

test('the Pucong Boys keep watch with their own frames', () => {
  for (const f of ['pucong-walk-down-0', 'pucong-walk-down-1', 'pucong-walk-up-0', 'pucong-walk-up-1', 'pucong-run-0', 'pucong-run-1', 'pucong-sing', 'pucong-peer', 'pucong-munch', 'pucong-taunt', 'pucong-dizzy']) assert.ok(FRAMES[f], f);
  const i = MISSION.m128.steps.findIndex(s => s.t === 'case'), { run } = at('m128', i, { assist: true });
  assert.ok(run.actors.filter(a => a.kind === 'guard').every(a => a.skin === 'pucong'), 'herons at the camp');
});

test('fishing off the jetty and the view across to Ubin: their own animation, counted, and trophies', () => {
  const w = punggol(3, { at: 'pg-jetty' }), near = {}; punggolNear(w, nn => { near[nn.id] = nn; });
  for (const id of ['fish', 'view']) assert.ok(near[id], id);
  put(w, near.fish.x, near.fish.y); punggolAct(w, 'fish'); assert.equal(w.p.act?.n, 'fish'); settle(w, FISH_S + 0.4); assert.equal(w.s.stats.fishes, 1);
  put(w, near.view.x, near.view.y); punggolAct(w, 'view'); assert.equal(w.p.act?.n, 'lookout'); settle(w, 2.6);
  assert.ok(w.s.rep.punggol >= 2, 'a little Punggol reputation');
  for (const t of ['kingtide', 'cowhand', 'jettyfish', 'lrtloop']) assert.ok(TROPHIES.some(x => x.id === t), t);
});

test('a park connector loop, and the kayak hire’s perk, only in Punggol', () => {
  const g = GIG20_DEFS.find(x => x.d === 'punggol'); assert.ok(g, 'a Punggol gig');
  const w = punggol(3, { at: 'pg-bikes' }), r = gigMission(w, g.id); assert.ok(r && r.reward >= 50 && r.reward <= 90);
  assert.ok(r.m.steps.some(s => s.t === 'race' && s.ride === 'bike'), 'a bike loop');
  const f = FLEET.find(x => x.id === 'kayakhire'); assert.ok(f && f.kind === 'kayak');
  assert.ok(BIZ.some(b => b.id === 'kayakhire' && b.d === 'punggol'));
  const on = punggol(3, { at: 'pg-waterway' }); on.s.biz.kayakhire.lvl = 1; assert.doesNotMatch(cantCall(on, 'kayakhire') ?? '', /only go out round Punggol/, 'callable in Punggol');
  const pl = c.places['safe-market']; put(on, pl.x, pl.y + 40); on.step(NO_INPUT, DT);
  assert.match(cantCall(on, 'kayakhire') ?? '', /Punggol/);
});

test('the paintings: Punggol’s art streams with its zone, the heroes’ new actions too, nothing new is core', () => {
  for (const f of ['pg-hdb', 'pg-stn', 'pg-gauge', 'pg-villa', 'pg-hut', 'pg-casuarina', 'pg-redbridge', 'pg-cow-walk-0', 'pg-cow-look', 'pg-cow-graze', 'pg-cow-bolt',
    'pg-calf-1', 'pg-otter-0', 'pg-hornbill-1', 'pg-owl', 'pg-junk', 'npc-pekaka-idle-0', 'npc-bubut-talk-1', 'npc-tempua-wave-0', 'npc-berang-idle-1', 'npc-pucong-talk-0',
    'face-pucong-cross', 'face-pekaka-happy', 'biz-crabhouse-3', 'biz-coneykiosk-0', 'biz-kayakhire-2', 'mi-coney', 'mi-jetty', 'mi-halus', 'pin-pucong', 'i-cow', 'i-fish'])
    assert.ok(FRAMES[f], f);
  for (const a of ['atlas-punggol', 'atlas-cast-punggol']) assert.equal(tierOf(a), 'punggol', a);
  assert.equal(tierOf('atlas-act25'), 'job'); assert.equal(tierOf('atlas-ui25'), 'job');
  for (const a of ATLASES) if (/25|punggol/.test(a)) assert.notEqual(tierOf(a), 'core', a);
  for (const id of [...SIXTEEN, ...TALES]) for (const st of MISSION[id].steps) for (const it of [st.item, st.loot, st.decoy]) if (it) assert.ok(FRAMES[it], `${id}: ${it} is painted`);
});

test('every new job clears for a human-paced player (Assist on, as by default) and off Assist on normal and hard', () => {
  for (const id of [...SIXTEEN, ...TALES]) { const r = playMission(id, 'casual', 5); assert.ok(r.won, `${id} casual: ${JSON.stringify(r.why)}`); }
  for (const id of ['m127', 'm129', 'm131', 'm132', 'm135', 'k57', 'k58']) assert.ok(playMission(id, 'normal', 3, { assist: false }).won, `${id} normal off Assist`);
  for (const id of ['m127', 'm132', 'k57']) assert.ok(playMission(id, 'normal', 3, { assist: false, diff: 'hard' }).won, `${id} on Hard`);
});

console.log(`jade (twenty-fifth pass): ${n} tests ok`);
