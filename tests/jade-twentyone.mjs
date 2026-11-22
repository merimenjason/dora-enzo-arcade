// Jade Street, the twenty-first pass: the Southern Islands and chapter 13, "Raffles Lighthouse". The district (St
// John's Island with its marine lab and jetty, Lazarus and its lagoon, Kusu's temple, tortoise pond and hilltop keramat,
// the Sisters' Islands marine park and Raffles Lighthouse on Pulau Satumu) opens after chapter 12, by the island ferry
// from Marina South Pier; it has its own safe house, three properties, a side gig and an optional fleet perk. The
// chapter's new step is `tide`: a crossing of the reef flats, marker to marker, while the tide is out; when it turns you
// get onto a coral head or the sand, or it washes you back a marker. Feed the tortoises, float in the lagoon, look out
// from the lighthouse, peer into the rock pools. Not an ending: a hook.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { World, DT, NO_INPUT } from '../.checks/jade-game.js';
import { MISSIONS, MISSION, SIDE, PEOPLE, CHAPTERS, FINALE, ISLANDS_OPENS, jobCounts } from '../.checks/jade-story.js';
import { newSave, openDistricts, chapterOf, SAFE_HOUSES, TROPHIES } from '../.checks/jade-save.js';
import { city, T, W, G, DISTRICTS, districtAt } from '../.checks/jade-city.js';
import { travelPlan } from '../.checks/jade-mrt.js';
import { cantHail } from '../.checks/jade-taxi.js';
import { ISLANDS_TEXT, LIGHTHOUSE_TEXT, FARES } from '../.checks/jade-cable.js';
import { tideOf, phaseOf, cycleOf, TIDE, onRock } from '../.checks/jade-tide.js';
import { islandsNear, islandsAct, FLOAT_S } from '../.checks/jade-islandsfest.js';
import { ISLAND_NAMES } from '../.checks/jade-islands.js';
import { BIZ } from '../.checks/jade-biz.js';
import { GIG20_DEFS } from '../.checks/jade-gigs20.js';
import { gigMission } from '../.checks/jade-gigs.js';
import { FLEET, cantCall } from '../.checks/jade-fleet.js';
import { PAR } from '../.checks/jade-medals.js';
import { FRAMES, ATLASES } from '../.checks/jade-art.js';
import { tierOf, ZONE_OF } from '../.checks/jade-load.js';
import { playMission } from './jade-bot.mjs';

let n = 0;
const test = (name, f) => { try { f(); n++; } catch (e) { console.error('FAILED:', name); throw e; } };
const c = city();
const THIRTEEN = ['m96', 'm97', 'm98', 'm99', 'm100', 'm101', 'm102', 'm103', 'm104', 'm105'], TALES = ['k39', 'k40', 'k41'];
const inIslands = (x, y) => districtAt(Math.floor(x / T), Math.floor(y / T)) === 'islands';
/** a world just after chapter 12, standing at a Southern Islands place */
function islands(seed = 3, o = {}) {
  const s = newSave(seed); s.started = true; s.story.intro = true; s.settings.assist = o.assist ?? true;
  s.done = MISSIONS.slice(0, MISSIONS.findIndex(m => m.id === ISLANDS_OPENS) + 1).map(m => m.id); s.story.ch = 13;
  const w = new World(s, seed); w.quiet = true; w.talk = null;
  const pl = c.places[o.at ?? 'safe-islands']; w.p.b.x = pl.x; w.p.b.y = pl.y + 40; w.step(NO_INPUT, DT);
  return w;
}
const settle = (w, s = 2) => { for (let i = 0; i < s / DT; i++) { w.step(NO_INPUT, DT); if (w.talk) w.talk = null; } };
function at(id, i, o = {}) {
  const s = newSave(o.seed ?? 9); s.started = true; s.story.intro = true; s.settings.assist = o.assist ?? false; s.settings.diff = o.diff ?? 'normal';
  s.done = [...MISSIONS.slice(0, MISSIONS.findIndex(m => m.id === 'm96')).map(m => m.id), ...THIRTEEN.slice(0, THIRTEEN.indexOf(id))]; s.story.ch = 13;
  const w = new World(s, o.seed ?? 9); w.quiet = true;
  w.startMission(MISSION[id]); w.talk = null;
  const run = w.run; run.snap = run.snapshot(i); run.enter(i); w.talk = null;
  return { w, run, st: run.cur };
}
const put = (w, x, y) => { w.p.b.x = x; w.p.b.y = y; w.p.b.speed = 0; w.p.act = null; };

test('the Southern Islands: their own district, opened by chapter 12’s finale, real places, a safe house, a ferry, no taxis', () => {
  assert.ok(DISTRICTS.includes('islands')); assert.equal(ZONE_OF.islands, 'islands');
  assert.equal(ISLANDS_OPENS, 'm95');
  const s = newSave(); s.done = MISSIONS.slice(0, MISSIONS.findIndex(m => m.id === ISLANDS_OPENS)).map(m => m.id);
  assert.ok(!openDistricts(s).includes('islands'), 'fogged before'); s.done.push(ISLANDS_OPENS); assert.ok(openDistricts(s).includes('islands'), 'open after');
  const names = Object.values(c.places).filter(p => p.d === 'islands').map(p => p.name).join(' | ') + ' | ' + Object.values(ISLAND_NAMES).join(' | ');
  for (const real of ['Raffles Lighthouse', 'Pulau Satumu', 'St John’s', 'Lazarus', 'lagoon', 'Kusu', 'tortoise', 'keramat', 'Sisters’ Islands', 'Marina South Pier'])
    assert.match(names, new RegExp(real), real);
  const safe = SAFE_HOUSES.find(h => h.d === 'islands'); assert.ok(safe && c.places[safe.id] && inIslands(c.places[safe.id].x, c.places[safe.id].y), 'a safe house');
  const props = BIZ.filter(b => b.d === 'islands'); assert.equal(props.length, 3, 'three properties');
  for (const b of props) assert.ok(PEOPLE[b.keeper], `${b.id} kept by an islands giver`);
  // the island ferry: Marina South Pier (on the mainland) to St John's jetty, three coins
  assert.ok(c.islands?.ferry, 'the island ferry'); assert.equal(FARES.launch, 3);
  const pier = c.places['pier-msp'], jetty = c.places['isl-jetty'];
  assert.ok(!inIslands(pier.x, pier.y) && inIslands(jetty.x, jetty.y), 'pier on the mainland, jetty on St John’s');
  assert.match(ISLANDS_TEXT, /Marina South Pier/);
  // Route me from Chinatown's market to the lighthouse: the trip takes the island ferry
  const w = islands(), m = c.places['safe-market'], to = c.places['lighthouse'];
  const plan = travelPlan(w, to.x, to.y, m.x, m.y), vias = []; for (let p = plan; p; p = p.then) vias.push(p.via);
  assert.ok(vias.includes('launch'), `by the island ferry (${vias})`);
  // no taxis out here, and none come over the sea
  assert.match(cantHail(w) ?? '', /No taxis on the Southern Islands/);
});

test('chapter thirteen: ten jobs round the islands, a mix of steps, at most a third chases, ending on a hook', () => {
  const ten = MISSIONS.filter(m => m.ch === 13);
  assert.deepEqual(ten.map(m => m.id), THIRTEEN); assert.equal(CHAPTERS[12], 'Raffles Lighthouse'); assert.equal(FINALE[12], 'm105');
  const chases = ten.filter(m => m.steps.some(s => s.t === 'chase' || s.t === 'tail' || s.t === 'race')).length;
  assert.ok(chases <= Math.ceil(THIRTEEN.length / 3), `${chases} chases`);
  const kinds = new Set(ten.flatMap(m => m.steps.map(s => s.t)));
  for (const k of ['tide', 'cable', 'case', 'collect', 'blend', 'swap', 'chase', 'defend']) assert.ok(kinds.has(k), k);
  assert.ok(ten.filter(m => m.steps.some(s => s.t === 'tide')).length >= 3, 'the tide crossing is the chapter’s own step');
  for (const m of ten) {
    assert.ok(m.steps.some(s => s.cp), `${m.id} checkpoint`); assert.ok(PAR[m.id] > 0, `${m.id} par`);
    if (m.id !== 'm96') { const g = c.places[m.at]; assert.ok(g && inIslands(g.x, g.y), `${m.id} given on the islands`); }
    for (const st of m.steps) if (st.t === 'talk') for (const [who] of st.lines) assert.ok(who === 'hero' || who === 'mate' || PEOPLE[who], `${m.id} ${who}`);
    // opponents that fit the place: Kapitan Umang's hermit-crab deck crew
    for (const st of m.steps) if (st.t === 'case' || st.t === 'swap') assert.equal(st.skin, 'crab', `${m.id} crabs keep watch`);
  }
  // m96 picks up from chapter 12's hook (the ferry from Marina South Pier)
  assert.ok(MISSION.m96.steps.some(s => s.t === 'cable' && s.to === 'isl-jetty'), 'the ferry out');
  const last = MISSION.m105.steps.at(-1); assert.equal(last.t, 'talk', 'the chapter ends on a talk');
  const words = [...last.lines.map(l => l[1]), LIGHTHOUSE_TEXT].join(' ');
  assert.doesNotMatch(words, /\b(finale|the end|happily ever|farewell forever)\b/i);
  assert.doesNotMatch(words, /Sutera (is|was) (beaten|caught|finished)/i, 'Sutera is not beaten');
  assert.doesNotMatch(readFileSync(new URL('../app/jade-street/story.tsx', import.meta.url), 'utf8'), /bg-end-13|chapter 13 ending/i);
  const s = newSave(); s.done = MISSIONS.filter(m => m.ch <= 12).map(m => m.id); assert.equal(chapterOf(s), 13);
  s.done = MISSIONS.map(m => m.id); assert.equal(chapterOf(s), 15);
  const jc = jobCounts(newSave()); assert.equal(jc.storyAll, 115); assert.equal(jc.talesAll, 44);
  assert.doesNotMatch(JSON.stringify([...ten, ...TALES.map(id => MISSION[id])]), /grumble/i);
});

test('three Hawker Tales on the islands, each opening in chapter thirteen', () => {
  assert.deepEqual(SIDE.slice(-6, -3).map(m => m.id), TALES); // (the twenty-second pass’s three after these)
  for (const id of TALES) {
    const m = MISSION[id]; assert.ok(inIslands(c.places[m.at].x, c.places[m.at].y), `${id} on the islands`);
    assert.ok(PAR[id] > 0); assert.ok(THIRTEEN.includes(m.side), `${id} opens in chapter thirteen`);
    assert.ok(m.reward >= 250 && m.reward <= 350); assert.ok(m.steps.some(st => st.cp), `${id} has a checkpoint`);
  }
});

test('the tide step: cross while it is out; when it is in, the open reef washes you back a marker, a coral head is safe', () => {
  const i = MISSION.m97.steps.findIndex(s => s.t === 'tide'), { w, run, st } = at('m97', i, { assist: false });
  const c0 = tideOf(run); assert.ok(c0); assert.equal(run.meter?.name, 'Tide'); assert.ok(run.timer > 0); assert.match(run.progress, /Markers 0\/3/);
  const [o, tu, inn] = cycleOf(run, st); assert.deepEqual([o, tu, inn], [TIDE.out, TIDE.turn, TIDE.in]);
  assert.equal(phaseOf(run, st, 0).ph, 'out'); assert.equal(phaseOf(run, st, o + 0.5).ph, 'turning'); assert.equal(phaseOf(run, st, o + tu + 0.5).ph, 'in');
  // every marker of every crossing stands on a coral head (safe), so you can always wait the water out at the last one
  for (const id of [...THIRTEEN, ...TALES]) MISSION[id].steps.forEach((s, j) => {
    if (s.t !== 'tide') return;
    const r = at(id, j).run; for (const q of s.route) { const [x, y] = r.spot(q); assert.ok(onRock(r, x, y) || !inIslands(x, y) || w.c.ground[Math.floor(y / T) * W + Math.floor(x / T)] !== G.REEF, `${id} marker safe`); }
  });
  // the first marker
  const [m0x, m0y] = run.spot(st.route[0]); put(w, m0x, m0y); settle(w, 0.2); assert.equal(c0.k, 1);
  assert.match(run.label, /^Tide out \(\d+ s\)/);
  // stand on open reef, away from every coral head, until the tide comes in: the HUD warns, then you are washed back
  let best = null;
  for (let ty = 0; ty < c.ground.length / W; ty++) for (let tx = 0; tx < W; tx++) if (c.ground[ty * W + tx] === G.REEF) {
    const x = (tx + 0.5) * T, y = (ty + 0.5) * T; if (onRock(run, x, y) || c.islands.rocks.some(([rx, ry]) => Math.hypot(rx - x, ry - y) < TIDE.rock + 40)) continue;
    const d = Math.hypot(x - m0x, y - m0y); if (!best || d < best[2]) best = [x, y, d];
  }
  assert.ok(best, 'open reef'); put(w, best[0], best[1]);
  let warned = false; const t0 = run.timer;
  for (let k = 0; k < (o + tu + inn) / DT && c0.washes === 0; k++) { w.step(NO_INPUT, DT); if (w.talk) w.talk = null; if (/Tide turning!/.test(run.label)) warned = true; }
  assert.ok(warned, 'the HUD warned first'); assert.equal(c0.washes, 1, 'washed off'); assert.equal(w.p.act?.n, 'tide-washed'); assert.equal(run.hits, 1);
  assert.ok(run.timer <= t0 - TIDE.lose, 'it costs time');
  settle(w, 1.2); assert.ok(Math.hypot(w.p.x - m0x, w.p.y - m0y) < 40, 'back at the last marker');
  // on the coral head the water never takes you, however long it is in
  const ph = () => phaseOf(run, st, c0.t).ph; for (const want of ['out', 'in']) while (ph() !== want) { w.step(NO_INPUT, DT); if (w.talk) w.talk = null; }
  settle(w, inn - 0.5); assert.equal(c0.washes, 1, 'safe on the coral head'); assert.match(run.label, /stay on the coral head/);
  // then hop on, marker to marker, and it is crossed
  for (const q of st.route.slice(1)) { const [x, y] = run.spot(q); put(w, x, y); settle(w, 0.2); }
  assert.notEqual(run.cur, st, 'crossed'); assert.equal(w.s.stats.tides, 1);
});

test('Assist eases the tide, Hard sharpens it; the open reef is waded; the hero has their own tide poses', () => {
  const i = MISSION.m100.steps.findIndex(s => s.t === 'tide');
  const as = at('m100', i, { assist: true }), no = at('m100', i), hd = at('m100', i, { diff: 'hard' });
  const [ao, , ai] = cycleOf(as.run, as.st), [no_, , ni] = cycleOf(no.run, no.st), [ho, , hi] = cycleOf(hd.run, hd.st);
  assert.ok(ao > no_ && no_ > ho, 'low tide: Assist > Normal > Hard'); assert.ok(ai < ni && ni < hi, 'high tide: Assist < Normal < Hard');
  assert.ok(as.run.timer > no.run.timer, 'Assist gives more time');
  // the spring tide of m105 is shorter than a normal one
  const j = MISSION.m105.steps.findIndex(s => s.t === 'tide'), sp = at('m105', j);
  assert.ok(cycleOf(sp.run, sp.st)[0] < TIDE.out, 'a spring low tide is short');
  // wading: slower than a walk and no dash on the open reef in a crossing
  const { w, run } = no, [x, y] = run.spot(no.st.route[0]);
  let reef = null; for (let r = 1; r < 6 && !reef; r++) for (const [dx, dy] of [[r, 0], [-r, 0], [0, r], [0, -r]]) {
    const tx = Math.floor(x / T) + dx, ty = Math.floor(y / T) + dy; if (c.ground[ty * W + tx] === G.REEF && !reef) reef = [(tx + 0.5) * T, (ty + 0.5) * T];
  }
  assert.ok(reef); put(w, reef[0], reef[1]); let top = 0;
  for (let k = 0; k < 0.8 / DT; k++) { w.step({ ...NO_INPUT, mx: 0, my: 1, dash: true }, DT); top = Math.max(top, w.p.b.speed); }
  assert.ok(top <= TIDE.wade + 1, `waded (${top})`); assert.equal(w.p.anim, 'wade');
  for (const h of ['dora', 'enzo']) for (const f of ['wade-0', 'wade-1', 'tide-brace', 'washed', 'peer', 'tortoise', 'float', 'lookout']) assert.ok(FRAMES[`${h}-${f}`], `${h}-${f}`);
});

test('the rock pools on a crossing: E at each, in order, before the markers', () => {
  const i = MISSION.k40.steps.findIndex(s => s.t === 'tide'), s = newSave(9); s.started = true; s.story.intro = true; s.settings.assist = false;
  s.done = [...MISSIONS.slice(0, MISSIONS.findIndex(m => m.id === 'm98')).map(m => m.id)];
  const w = new World(s, 9); w.quiet = true; w.startMission(MISSION.k40); w.talk = null;
  const run = w.run; run.snap = run.snapshot(i); run.enter(i); w.talk = null; const st = run.cur, c0 = tideOf(run);
  assert.match(run.progress, /Pools 0\/4/);
  const [px, py] = run.spot(st.pools[0]); put(w, px, py); w.step(NO_INPUT, DT);
  const near = w.near; assert.ok(near && /Peer into the rock pool \(1 of 4\)/.test(near.label), near?.label);
  w.step({ ...NO_INPUT, act: true }, DT); assert.equal(w.p.act?.n, 'tide-peer'); settle(w, 1.2); assert.equal(c0.pools, 1); assert.match(run.progress, /Pools 1\/4/);
});

test('the hermit crabs keep watch with their own frames', () => {
  for (const f of ['crab-walk-down-0', 'crab-walk-down-1', 'crab-walk-up-0', 'crab-walk-up-1', 'crab-run-0', 'crab-run-1', 'crab-sing', 'crab-peer', 'crab-munch', 'crab-taunt']) assert.ok(FRAMES[f], f);
  const i = MISSION.m102.steps.findIndex(s => s.t === 'swap'), { run } = at('m102', i, { assist: true });
  assert.ok(run.actors.filter(a => a.kind === 'guard').every(a => a.skin === 'crab'), 'crabs on the deck');
});

test('the tortoises, the lagoon, the lookout and the pools: their own animations, counted, and four trophies', () => {
  const w = islands(3, { at: 'pond' }), near = {}; islandsNear(w, nn => { near[nn.id] = nn; });
  for (const id of ['tortoise', 'float', 'lookout', 'pool:0']) assert.ok(near[id], id);
  put(w, near.tortoise.x, near.tortoise.y); islandsAct(w, 'tortoise'); assert.equal(w.p.act?.n, 'tortoise'); settle(w, 2.6); assert.equal(w.s.stats.tortoises, 1);
  put(w, near.float.x, near.float.y); islandsAct(w, 'float'); assert.equal(w.p.act?.n, 'float'); settle(w, FLOAT_S + 0.4); assert.equal(w.s.stats.floats, 1);
  put(w, near.lookout.x, near.lookout.y); islandsAct(w, 'lookout'); assert.equal(w.p.act?.n, 'lookout'); settle(w, 2.8); assert.equal(w.s.stats.lookouts, 1);
  put(w, near['pool:0'].x, near['pool:0'].y); islandsAct(w, 'pool:0'); assert.equal(w.p.act?.n, 'peer'); settle(w, 2); assert.equal(w.s.stats.peeks, 1);
  assert.ok(w.s.rep.islands >= 4, 'a little islands reputation');
  for (const t of ['lighthouse', 'tidereader', 'slowfood', 'islandtime']) assert.ok(TROPHIES.some(x => x.id === t), t);
  assert.equal(TROPHIES.length, 78);
});

test('a side gig round the lagoon, and the snorkel hire’s kayak perk, only on the islands', () => {
  const g = GIG20_DEFS.find(x => x.d === 'islands'); assert.ok(g, 'an islands gig');
  const w = islands(3, { at: 'lagoon' }), r = gigMission(w, g.id); assert.ok(r && r.reward >= 50 && r.reward <= 90);
  assert.ok(r.m.steps.some(s => s.t === 'race' && s.ride === 'kayak'), 'a kayak loop');
  const f = FLEET.find(x => x.id === 'snorkelhire'); assert.ok(f && f.kind === 'kayak');
  assert.ok(BIZ.some(b => b.id === 'snorkelhire' && b.d === 'islands'));
  const off = islands(3, { at: 'lagoon' }); off.s.biz.snorkelhire.lvl = 1; assert.doesNotMatch(cantCall(off, 'snorkelhire') ?? '', /only go out/, 'callable on the islands');
  const pl = c.places['safe-market']; put(off, pl.x, pl.y + 40); off.step(NO_INPUT, DT);
  assert.match(cantCall(off, 'snorkelhire') ?? '', /Southern Islands/);
});

test('the paintings: the islands’ art streams with their zone, the heroes’ new actions too, nothing new is core', () => {
  for (const f of ['isl-lab', 'isl-temple', 'isl-keramat', 'isl-safe', 'isl-cottage', 'isl-shelter', 'isl-light', 'isl-ferry', 'isl-junk', 'isl-coral',
    'isl-tortoise-rest', 'isl-tortoise-walk', 'isl-tortoise-munch', 'isl-seastar', 'isl-stingray', 'isl-logbook',
    'npc-lumba-idle-0', 'npc-ku-talk-1', 'npc-camar-wave-0', 'npc-umang-idle-1', 'face-umang-cross', 'face-lumba-happy',
    'biz-coconutbar-3', 'biz-jettycafe-0', 'biz-snorkelhire-2', 'mi-raffles', 'mi-kusu', 'mi-lagoon', 'pin-crab', 'i-tide', 'i-tortoise'])
    assert.ok(FRAMES[f], f);
  for (const a of ['atlas-islands', 'atlas-cast-islands']) assert.equal(tierOf(a), 'islands', a);
  assert.equal(tierOf('atlas-act21'), 'job'); assert.equal(tierOf('atlas-ui21'), 'job');
  for (const a of ATLASES) if (/21|islands/.test(a)) assert.notEqual(tierOf(a), 'core', a);
  // every item a new job or tale carries is painted
  for (const id of [...THIRTEEN, ...TALES]) for (const st of MISSION[id].steps) for (const it of [st.item, st.loot]) if (it) assert.ok(FRAMES[it], `${id}: ${it} is painted`);
});

test('every new job clears for a human-paced player (Assist on, as by default) and off Assist on normal', () => {
  for (const id of [...THIRTEEN, ...TALES]) { const r = playMission(id, 'casual', 5); assert.ok(r.won, `${id} casual: ${JSON.stringify(r.why)}`); }
  for (const id of ['m97', 'm100', 'm102', 'm105', 'k40']) assert.ok(playMission(id, 'normal', 3, { assist: false }).won, `${id} normal off Assist`);
});

console.log(`jade (twenty-first pass): ${n} tests ok`);
