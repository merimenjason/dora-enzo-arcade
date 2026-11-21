// Jade Street, the fourteenth pass: Tiong Bahru, Clarke Quay and Jurong south over the water (their landmarks, markets,
// safe houses, givers, MRT stations, empire properties, the Singapore River and Jurong Lake), chapter nine (Lights by
// the Lake, Towkay Hoot) and three Hawker Tales, the west side's small pleasures, an older save carried over without
// a version bump, the load tiers of the new paintings, and the art fixes (the repainted Katong Park and Changi Airport
// stations, the calmer Katong and Kampong Glam ground, the switch box's own key).
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { World, DT, NO_INPUT } from '../.checks/jade-game.js';
import { T, W, H, G, S, F_BRIDGE, SOUTH_X0, SOUTH_X1, SOUTH_Y0, SOUTH_Y1, TIONG_X0, QUAY_X0, DISTRICTS, DISTRICT_NAME, ROADS, districtAt, streetAt, city } from '../.checks/jade-city.js';
import { mvT, unmvT, unmvP } from '../.checks/jade-layout.js';
/** an old-frame tile's index in the live map (the city's literal tiles below are in the old frame, see lib/jade-layout.ts) */
const oi = (x, y) => { const [tx, ty] = mvT(x, y); return ty * W + tx; };
import { MISSIONS, MISSION, SIDE, PEOPLE, CHAPTERS, FINALE, JURONG_OPENS, jobCounts } from '../.checks/jade-story.js';
import { newSave, loadSave, SAVE_VERSION, SAVE_KEY, openDistricts, chapterOf, checkTrophies, TROPHIES, SAFE_HOUSES } from '../.checks/jade-save.js';
import { stationById, travelPlan } from '../.checks/jade-mrt.js';
import { castOf, CHAT } from '../.checks/jade-cast.js';
import { BIZ } from '../.checks/jade-biz.js';
import { RAID_GANG } from '../.checks/jade-props.js';
import { SOUTH_NAMES, RIVER_Y } from '../.checks/jade-south.js';
import { isMidAutumn } from '../.checks/jade-calendar.js';
import { lakeLights, CHWEE, SLING, STARS } from '../.checks/jade-southfest.js';
import { GIVERS, VOICE } from '../.checks/jade-proc.js';
import { MARKET_NAME, LEAN } from '../.checks/jade-trade.js';
import { ZONE_OF, tierOf, EAGER, ART_FILES } from '../.checks/jade-load.js';
import { FRAMES, ATLASES, TEXTURES, PLAIN } from '../.checks/jade-art.js';
import { SOUTH_FOLK } from '../.checks/jade-folk.js';
import { field } from '../.checks/jade-nav.js';
import { playMission } from './jade-bot.mjs';

let n = 0;
const test = (name, f) => { try { f(); n++; } catch (e) { console.error('FAILED:', name); throw e; } };
const c = city();
const allDone = MISSIONS.map(m => m.id);
const SOUTH = ['tiong', 'quay', 'jurong'];
const NINE = ['m56', 'm57', 'm58', 'm59', 'm60', 'm61', 'm62', 'm63', 'm64', 'm65'], TALES = ['k17', 'k18', 'k19'];
const src = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
function world(o = {}) {
  const s = newSave(o.seed ?? 5); s.started = true; s.story.intro = true; s.story.ch = 10; s.done = o.done ?? [...allDone, ...SIDE.map(m => m.id)]; s.cash = o.cash ?? 300;
  s.settings.diff = o.diff ?? 'normal'; s.settings.assist = o.assist ?? false;
  const w = new World(s, o.seed ?? 5); w.quiet = true; w.talk = null; w.step(NO_INPUT, DT); return w;
}
const solidAt = (x, y) => c.solid[y * W + x];
const run = (w, t) => { for (let i = 0; i < t / DT; i++) w.step(NO_INPUT, DT); };
const near = (w, kind, id) => w.near && w.near.kind === kind && (id === undefined || w.near.id === id);
function act(w, x, y, id) { w.placePlayer(x, y); w.p.act = null; w.step(NO_INPUT, DT); assert.ok(near(w, 'south', id), `prompt for ${id}: ${JSON.stringify(w.near)}`); w.interact(); }

test('the map grows west over land: Jurong, Tiong Bahru and Clarke Quay, with their own ground, river and lake', () => {
  assert.deepEqual(DISTRICTS.slice(13, 16), SOUTH); assert.equal(DISTRICTS.length, 18);
  assert.equal(districtAt(...mvT(210, 110)), 'jurong'); assert.equal(districtAt(...mvT(260, 110)), 'tiong'); assert.equal(districtAt(...mvT(310, 110)), 'quay');
  assert.equal(districtAt(...mvT(80, 110)), 'resort', 'Sentosa is still Sentosa'); assert.equal(districtAt(...mvT(332, 94)), 'resort', 'the sea off Changi keeps its district (the bumboat race)'); assert.equal(districtAt(...mvT(340, 110)), 'pulau', 'Pulau Ubin (the seventeenth pass) south of it');
  assert.equal(DISTRICT_NAME.tiong, 'Tiong Bahru'); assert.equal(DISTRICT_NAME.quay, 'Clarke Quay'); assert.equal(DISTRICT_NAME.jurong, 'Jurong');
  assert.equal(DISTRICT_NAME.arcade, 'Club Street', 'only one district is called Clarke Quay');
  assert.equal(new Set(Object.values(DISTRICT_NAME)).size, DISTRICTS.length);
  assert.equal(c.ground[oi(236, 112)], G.JURONG); assert.equal(c.ground[oi(256, 113)], G.TIONG); assert.equal(c.ground[oi(294, 101)], G.QUAY); assert.equal(c.ground[oi(215, 111)], G.GARDEN);
  // the Singapore River runs through Clarke Quay to the sea, crossed by Coleman Bridge (a road) and two footbridges
  for (let x = 292; x <= 329; x++) { const i = oi(x, RIVER_Y + 1); assert.ok(c.solid[i] === S.WATER || (c.flags[i] & F_BRIDGE), `river at ${x}`); }
  assert.ok(c.flags[oi(309, RIVER_Y + 1)] & F_BRIDGE); assert.ok(c.flags[oi(299, RIVER_Y + 1)] & F_BRIDGE); assert.ok(c.flags[oi(320, RIVER_Y + 1)] & F_BRIDGE);
  assert.equal(streetAt(...mvT(309, 105)), 'Clemenceau Avenue');
  // Jurong Lake, and the red bridge over the stream that feeds it
  assert.equal(solidAt(...mvT(205, 117)), S.WATER); assert.equal(solidAt(...mvT(209, 117)), S.WATER); assert.equal(solidAt(...mvT(208, 109)), S.WATER); assert.ok(c.flags[oi(209, 111)] & F_BRIDGE); assert.equal(solidAt(...mvT(209, 111)), S.OPEN);
  // no bridges from Kampong Glam over the strait any more (the districts are west of Chinatown, joined over land): the
  // strait is open sea; real street names
  for (const x of [225, 245]) for (let y = 82; y < SOUTH_Y0; y++) assert.equal(c.solid[oi(x + 1, y)], S.WATER, `strait ${x},${y}`);
  assert.equal(streetAt(...mvT(225, 110)), 'Jurong Town Hall Road'); assert.equal(streetAt(...mvT(260, 104)), 'Tiong Bahru Road'); assert.equal(streetAt(...mvT(300, 115)), 'Eu Tong Sen Street'); assert.equal(streetAt(...mvT(260, 115)), 'Seng Poh Road');
  // nothing older moved: Chinatown, the island, the east and the coast keep their places
  assert.equal(districtAt(...mvT(300, 20)), 'orchard'); assert.equal(c.places['stn-changi'].name, 'Changi Airport station'); assert.equal(districtAt(...mvT(60, 100)), 'resort');
  // every new place stands on open ground, in its own district, and can be walked to from Kampong Glam
  const f = field(c, 'foot', Math.floor(c.places['stn-tiong'].x / T), Math.floor(c.places['stn-tiong'].y / T), new Set(DISTRICTS)); const reach = i => f.dist[i] >= 0 && f.dist[i] < 1e8;
  for (const [id, pl] of Object.entries(c.places)) { if (!SOUTH.includes(pl.d)) continue; const tx = Math.floor(pl.x / T), ty = Math.floor(pl.y / T); assert.equal(solidAt(tx, ty), S.OPEN, `${id} on open ground`); assert.ok(reach(ty * W + tx), `${id} reachable on foot`); }
  const kg = c.places['safe-glam']; assert.ok(reach(Math.floor(kg.y / T) * W + Math.floor(kg.x / T)), 'Kampong Glam is a walk away, through Chinatown');
});

test('each district has a market, a safe house, a station, a giver, folk, a keeper and its own prices; real names', () => {
  for (const d of SOUTH) {
    assert.equal(c.places['mk-' + d].kind, 'market'); assert.equal(c.places['mk-' + d].d, d);
    assert.equal(c.places['safe-' + d].d, d); assert.ok(SAFE_HOUSES.some(h => h.id === 'safe-' + d && h.d === d));
    assert.equal(c.places['stn-' + d].kind, 'station'); assert.equal(c.places['stn-' + d].d, d);
    assert.ok(MARKET_NAME[d] && LEAN[d], d); assert.equal(ZONE_OF[d], 'south'); assert.ok(SOUTH_FOLK[d].length >= 6);
    assert.ok(RAID_GANG[d]); assert.equal(BIZ.filter(b => b.d === d).length, 2, `two properties in ${d}`);
    assert.ok(c.parking.some(p => p.d === d), `rides parked in ${d}`); assert.ok(c.hides.some(h => districtAt(Math.floor(h.x / T), Math.floor(h.y / T)) === d), `a hiding spot in ${d}`);
  }
  assert.equal(c.places['stn-tiong'].name, 'Tiong Bahru station'); assert.equal(c.places['stn-quay'].name, 'Clarke Quay station'); assert.equal(c.places['stn-jurong'].name, 'Jurong East station');
  for (const k of ['market', 'quay', 'police', 'science', 'snow', 'garden', 'lake']) assert.ok(SOUTH_NAMES[k]);
  assert.equal(SOUTH_NAMES.market, 'Tiong Bahru Market'); assert.equal(SOUTH_NAMES.science, 'Science Centre Singapore');
  for (const b of BIZ.filter(b => SOUTH.includes(b.d))) { const [x, y] = b.at; assert.equal(solidAt(x, y), S.OPEN, `${b.id} on open ground`); assert.equal(districtAt(x, y), b.d); }
  assert.equal(BIZ.filter(b => SOUTH.includes(b.d)).length, 6);
});

test('the MRT runs on: Jurong East, Tiong Bahru and Clarke Quay head the line, and a far pin plans a ride there', () => {
  const st = c.isle.stations; assert.deepEqual(st.slice(0, 4).map(s => s.id), ['stn-jurong', 'stn-tiong', 'stn-quay', 'stn-changi']);
  for (let i = 1; i < st.length; i++) assert.ok(st[i].s > st[i - 1].s, 'stations in line order');
  const w = world(); assert.equal(stationById(w, 'stn-quay').name, 'Clarke Quay station'); const kt = c.places['safe-katong']; w.placePlayer(kt.x, kt.y + T);
  const g = c.places.garden; const plan = travelPlan(w, g.x, g.y);
  assert.ok(plan && plan.via === 'mrt', 'Katong to the Chinese Garden goes by MRT'); assert.equal(plan.to.id, 'stn-jurong');
  // the objective's plaque names the right stations: a job at the bird corner from Katong is Katong Park → Tiong Bahru
  const b = c.places.birdcorner; const p2 = travelPlan(w, b.x, b.y); assert.equal(p2.to.id, 'stn-tiong'); assert.notEqual(p2.from.id, 'stn-tiong');
  const m = c.places['central-quay']; const p3 = travelPlan(w, m.x, m.y); assert.equal(p3.to.id, 'stn-quay');
  // from Chinatown the three are next door, west over Outram Road: a walk
  const ct = c.places['safe-market']; w.placePlayer(ct.x, ct.y + T);
  for (const t of [g, b, m]) assert.equal(travelPlan(w, t.x, t.y), null, `${t.name} is a walk from Chinatown`);
  // standing in a new district, a pin in the same district is a walk (no station named at all)
  w.placePlayer(c.places['stn-quay'].x, c.places['stn-quay'].y + T); assert.equal(travelPlan(w, m.x, m.y), null);
});

test('the opening order: Tiong Bahru and Clarke Quay with the Christmas Star, Jurong half way through chapter nine', () => {
  const s = newSave(); s.done = allDone.filter(id => MISSION[id].ch <= 7); assert.ok(!openDistricts(s).includes('tiong'));
  s.done = allDone.filter(id => MISSION[id].ch <= 8); const o = openDistricts(s); assert.ok(o.includes('tiong') && o.includes('quay') && !o.includes('jurong'));
  assert.equal(JURONG_OPENS, 'm61'); s.done.push('m56', 'm57', 'm58', 'm59', 'm60', 'm61'); assert.ok(openDistricts(s).includes('jurong'));
  // no job before Jurong opens leaves Tiong Bahru and Clarke Quay (m56 starts with Mr Kamal)
  for (const id of ['m57', 'm58', 'm59', 'm60', 'm61']) { const m = MISSION[id]; assert.ok(['tiong', 'quay'].includes(c.places[m.at].d), id);
    for (const st of m.steps) for (const sp of [...(st.route ?? []), ...(st.marks ?? []), ...(st.items ?? []), ...(st.crates ?? [])].filter(Array.isArray)) assert.ok((unmvT(sp[0], sp[1]) ?? [0])[0] >= TIONG_X0 - 4, `${id} ${st.t} ${sp} stays out of Jurong`); }
  // finishing m55 sends the text and the banner
  const w = world({ done: allDone.filter(id => MISSION[id].ch <= 8 && id !== 'm55') }); w.s.story.coast = true; w.finishMission(MISSION.m55);
  assert.ok(w.open.has('tiong') && w.open.has('quay')); assert.equal(w.banner.text, 'West of Chinatown!'); assert.ok(w.s.msgs.some(m => /Tiong Bahru/.test(m.text) && /Clarke Quay/.test(m.text)));
  w.s.done.push('m56', 'm57', 'm58', 'm59', 'm60'); w.finishMission(MISSION.m61); assert.ok(w.open.has('jurong')); assert.ok(w.s.msgs.some(m => /Jurong East/.test(m.text)));
});

test('chapter nine: ten jobs across the three districts, a mix of steps, at most two chases, a finale at the pagoda', () => {
  const nine = MISSIONS.filter(m => m.ch === 9);
  assert.deepEqual(nine.map(m => m.id), NINE); assert.equal(CHAPTERS[8], 'Lights by the Lake'); assert.equal(FINALE[8], 'm65'); assert.equal(CHAPTERS.length, 11);
  for (const m of nine) {
    if (m.id !== 'm56') assert.ok(SOUTH.includes(c.places[m.at].d), `${m.id} is given in a new district`);
    assert.ok(m.steps.some(s => s.cp), `${m.id} checkpoint`);
    for (const st of m.steps) if (st.t === 'talk') for (const [who, , mood] of st.lines) { assert.ok(who === 'hero' || who === 'mate' || PEOPLE[who], `${m.id} ${who}`);
      if (who !== 'hero' && who !== 'mate' && mood && mood !== 'calm') assert.ok(FRAMES[`${PEOPLE[who].face}-${mood}`], `${m.id}: a painted ${mood} face for ${who}`); }
  }
  const TRIVIAL = new Set(['talk', 'goto', 'ride', 'pickup', 'post', 'switch']);
  const kinds = new Set(nine.flatMap(m => m.steps.map(s => s.t).filter(t => !TRIVIAL.has(t))));
  for (const k of ['train', 'deliver', 'mini', 'detective', 'race', 'defend', 'collect', 'blend', 'swap', 'case', 'heist', 'trap', 'tail', 'escort', 'stealth', 'chase', 'bag']) assert.ok(kinds.has(k), k);
  assert.ok(nine.filter(m => m.steps.some(s => s.t === 'chase')).length <= 2, 'at most two chases');
  for (const d of SOUTH) assert.ok(nine.filter(m => c.places[m.at].d === d).length >= (d === 'tiong' ? 1 : 2), `jobs given in ${d}`);
  assert.ok(MISSION.m56.steps.some(s => s.t === 'train' && s.to === 'stn-tiong') && MISSION.m56.steps.some(s => s.t === 'deliver' && c.places[s.to].d === 'tiong'), 'the first job is played in Tiong Bahru');
  assert.ok(MISSION.m65.steps.some(s => s.t === 'chase' && s.skin === 'hoot' && s.finish === 'pounce') && MISSION.m65.steps.some(s => s.t === 'stealth' && s.goal === 'pagoda'), 'the pagoda finale');
  assert.ok(MISSION.m58.steps.some(s => s.t === 'mini' && s.kind === 'wires' && /light/i.test(s.label)), 'the canopy job opens the switch box');
  for (const m of [...nine, ...SIDE.filter(m => TALES.includes(m.id))]) for (const st of m.steps) {
    const boat = st.ride === 'boat';
    for (const s of [...(st.route ?? []), ...(st.marks ?? []), ...(st.items ?? []), ...(st.crates ?? []), ...(st.path ?? []), ...(st.spots ?? []).map(x => Array.isArray(x) ? x : x.at), ...(st.witnesses ?? []).map(x => x.at), st.goal, st.exit, st.rack, st.bait, st.wait, st.front, st.back, st.safe, st.at, st.from].filter(Array.isArray)) assert.equal(solidAt(s[0], s[1]), boat ? S.WATER : S.OPEN, `${m.id} ${st.t} ${s}`);
    for (const g of [...(st.guards ?? []), ...(st.t === 'stealth' ? st.lookouts : [])]) for (const s of g) assert.equal(solidAt(s[0], s[1]), S.OPEN, `${m.id} guard ${s}`);
    for (const k of ['item', 'loot', 'decoy']) if (st[k] && st[k] !== 'loot') assert.ok(FRAMES[st[k]] || ['parcel', 'recipe', 'decoy'].includes(st[k]), `${m.id}: a painting for ${st[k]}`);
  }
  assert.deepEqual(SIDE.filter(m => TALES.includes(m.id)).map(m => m.id), TALES); // (the sixteenth pass's ride jobs follow them)
  assert.deepEqual(SIDE.slice(-13, -10).map(m => m.id), TALES); // (and the seventeenth pass's three on Ubin and the eighteenth's three in Kallang after those)
  for (const id of TALES) assert.ok(SOUTH.includes(c.places[MISSION[id].at].d), `${id} in a new district`);
  const s = newSave(); s.done = allDone.filter(id => MISSION[id].ch <= 8); assert.equal(chapterOf(s), 9); s.done = allDone; assert.equal(chapterOf(s), 12);
  const jc = jobCounts(newSave()); assert.equal(jc.storyAll, 85); assert.equal(jc.talesAll, 29);
});

test('the solver finishes every chapter-nine job and the new Hawker Tales; the casual bot finishes the finale', () => {
  for (const id of [...NINE, ...TALES]) { const r = playMission(id, 'perfect', 1); assert.ok(r.won, `${id}: ${JSON.stringify(r).slice(0, 200)}`); }
  const r = playMission('m65', 'casual', 2); assert.ok(r.won, JSON.stringify(r).slice(0, 200));
});

test('Lights by the Lake plays its ending once; the trophies', () => {
  const w = world({ done: allDone.filter(id => id !== 'm65') }); w.s.story.lake = false; w.fx.length = 0; w.finishMission(MISSION.m65);
  assert.ok(w.fx.some(f => f.t === 'finale' && f.kind === 'lake')); w.s.story.lake = true; w.fx.length = 0; w.finishMission(MISSION.m65); assert.ok(!w.fx.some(f => f.t === 'finale'));
  for (const id of ['lake', 'chwee', 'sling', 'stargazer', 'moonwalk']) assert.ok(TROPHIES.some(t => t.id === id), id);
  const s = newSave(); s.done = [...allDone]; s.stats.chwee = 1; s.stats.songs = 1; s.stats.slings = 3; s.stats.stars = 4; s.stats.koi = 1; s.stats.lwalks = 1;
  const got = checkTrophies(s).map(t => t.id ?? t); for (const id of ['lake', 'chwee', 'sling', 'stargazer', 'moonwalk']) assert.ok(got.includes(id) || s.trophies.includes(id), id);
});

test('the new people: painted faces and bodies, a place, a word, a contract voice', () => {
  for (const g of ['seng', 'melati', 'suria', 'musang']) {
    assert.ok(PEOPLE[g] && c.places[g], g); assert.ok(SOUTH.includes(c.places[g].d));
    for (const m of ['', '-happy', '-worried', '-cross']) assert.ok(FRAMES[`face-${g}${m}`], `face-${g}${m}`);
    for (const p of ['idle-0', 'idle-1', 'wave-0', 'wave-1', 'talk-0', 'talk-1']) assert.ok(FRAMES[`npc-${g}-${p}`], `npc-${g}-${p}`);
    assert.ok(CHAT[g]); assert.ok(GIVERS.includes(g) && VOICE[g].hi.length && VOICE[g].ok.length && VOICE[g].oops.length);
  }
  const w = world(); const cast = castOf(w); for (const g of ['seng', 'melati', 'suria', 'musang']) assert.ok(cast.some(x => x.id === g), `${g} stands in the street`);
  for (const f of ['hoot-stand', 'hoot-run-0', 'hoot-run-1', 'hoot-dizzy']) assert.ok(FRAMES[f], f);
});

test('the west side’s small pleasures: each with its prompt, its price, its pose and its count', () => {
  const w = world({ cash: 100 }); const So = c.south;
  act(w, So.kueh[0], So.kueh[1] + 60, 'chwee'); assert.equal(w.p.act.n, 'chwee'); assert.equal(w.s.cash, 100 - CHWEE); run(w, 2.2); assert.equal(w.s.stats.chwee, 1);
  act(w, So.birds[0] + 32, So.birds[1] + 70, 'birds'); assert.equal(w.p.act.n, 'birdsong'); run(w, 2.8); assert.equal(w.s.stats.songs, 1);
  act(w, So.sling[0], So.sling[1] + 80, 'sling'); assert.equal(w.p.act.n, 'sling'); assert.equal(w.s.cash, 100 - CHWEE - SLING); assert.ok(w.fx.some(f => f.t === 'sling')); run(w, 3.4); assert.equal(w.s.stats.slings, 1);
  for (let k = 0; k < 3; k++) { act(w, So.koi[0][0], So.koi[0][1], 'koi'); assert.equal(w.p.act.n, 'koi'); run(w, 2.4); } assert.equal(w.s.stats.koi, 3); assert.equal(w.s.cash, 100 - CHWEE - SLING + 10, 'the third feed pays a thank-you');
  for (let k = 0; k < STARS.length; k++) { act(w, So.scope[0], So.scope[1] + 50, 'stars'); assert.equal(w.p.act.n, 'stars'); run(w, 2.8); } assert.equal(w.s.stats.stars, 4);
  assert.ok(lakeLights(w), 'without a date the lanterns are lit');
  const x0 = So.walk[0][0]; act(w, x0, So.walk[0][1], 'walk'); assert.equal(w.p.act.n, 'lantern-walk'); run(w, 2); assert.ok(w.p.b.x < x0 - 200, 'the walk carries you along the shore'); run(w, 2.4); assert.equal(w.s.stats.lwalks, 1);
  assert.ok(Math.abs(w.p.b.x - So.walk[1][0]) < 40); assert.equal(solidAt(Math.floor(w.p.b.x / T), Math.floor(w.p.b.y / T)), S.OPEN);
  w.step(NO_INPUT, DT); assert.ok(!near(w, 'south', 'walk'), 'one lantern walk a night');
  // no cash, no ride
  const p = world({ cash: 1 }); act(p, So.sling[0], So.sling[1] + 80, 'sling'); assert.equal(p.p.act, null); assert.equal(p.s.stats.slings, 0);
  // the frames for both heroes
  for (const h of ['dora', 'enzo']) for (const a of ['chwee', 'birdsong', 'sling', 'koi', 'stars', 'lwalk']) for (const k of [0, 1]) assert.ok(FRAMES[`${h}-${a}-${k}`], `${h}-${a}-${k}`);
  // the calendar
  assert.ok(isMidAutumn('2026-09-25') && isMidAutumn('2026-09-12') && !isMidAutumn('2026-11-18') && isMidAutumn('2027-09-20'));
  const d = world({ done: [...allDone] }); d.today = '2026-11-18'; assert.ok(!lakeLights(d), 'out of season and the story done: dark'); d.s.done = allDone.filter(id => MISSION[id].ch <= 8); assert.ok(lakeLights(d), 'lit all through chapter nine');
});

test('an older save carries over as it is: no version bump, the new counts at zero, the ending unseen, the districts by the story', () => {
  assert.equal(SAVE_VERSION, 13); assert.equal(SAVE_KEY, 'jade-street-v13');
  const old = JSON.parse(JSON.stringify(newSave(7))); old.started = true; old.done = allDone.filter(id => MISSION[id].ch <= 8); old.cash = 4321; old.safe = 'safe-changi';
  for (const k of ['chwee', 'songs', 'slings', 'koi', 'stars', 'lwalks']) delete old.stats[k]; delete old.story.lake; for (const d of SOUTH) delete old.rep[d];
  for (const b of BIZ.filter(b => SOUTH.includes(b.d))) delete old.biz[b.id]; old.story.coast = true; old.story.ch = 9; old.medals = { m55: { m: 3, t: 100, plays: 1 } }; old.stats.planes = 6;
  const s = loadSave(JSON.stringify(old));
  assert.equal(s.v, 13); assert.equal(s.cash, 4321); assert.equal(s.safe, 'safe-changi'); assert.equal(s.medals.m55.m, 3); assert.equal(s.stats.planes, 6); assert.equal(s.story.coast, true);
  for (const k of ['chwee', 'songs', 'slings', 'koi', 'stars', 'lwalks']) assert.equal(s.stats[k], 0, k);
  assert.equal(s.story.lake, false); for (const d of SOUTH) assert.equal(s.rep[d], 0);
  for (const b of BIZ.filter(b => SOUTH.includes(b.d))) assert.equal(s.biz[b.id].lvl, 0);
  assert.equal(chapterOf(s), 9); assert.ok(openDistricts(s).includes('tiong') && openDistricts(s).includes('quay') && !openDistricts(s).includes('jurong'));
  const w = new World(s, 7); w.quiet = true; w.step(NO_INPUT, DT); assert.ok(w.open.has('quay'));
  // and a save from this pass round-trips
  s.story.lake = true; s.stats.slings = 2; s.safe = 'safe-quay'; const r = loadSave(JSON.stringify(s)); assert.equal(r.story.lake, true); assert.equal(r.stats.slings, 2); assert.equal(r.safe, 'safe-quay');
});

test('the new paintings stream in by zone: none of the district art is in the eager set', () => {
  for (const a of ['atlas-south', 'atlas-south2', 'atlas-cast-south', 'atlas-faces-south']) { assert.ok(ATLASES.includes(a), a); assert.equal(tierOf(a), 'south'); assert.ok(!EAGER.includes(a)); }
  for (const t of ['tiong', 'quay', 'jurong', 'garden']) { assert.ok(TEXTURES.includes(t), t); assert.equal(tierOf('tex-' + t), 'south'); assert.ok(!EAGER.includes('tex-' + t)); }
  const atlasOf = n => ATLASES[FRAMES[n][0]];
  for (const n of ['tiong-market', 'tiong-flats-a', 'tiong-stn', 'quay-godown-a', 'quay-police', 'quay-stn', 'jurong-science', 'jurong-pagoda', 'jurong-stn', 'jurong-obs', 'safe-tiong', 'safe-quay', 'safe-jurong']) assert.equal(atlasOf(n), 'atlas-south', n);
  for (const n of ['kueh-cart', 'bird-pole', 'sling-tower', 'sling-capsule', 'q-canopy', 'rabbit-lantern', 'moon-lantern', 'lotus-lantern', 'koi-fish', 'telescope', 'hoot-run-0', 'folk-tabby-down', 'folk-frog-down', 'folk-squirrel-down']) assert.equal(atlasOf(n), 'atlas-south2', n);
  for (const g of ['seng', 'melati', 'suria', 'musang']) { assert.equal(atlasOf(`npc-${g}-idle-0`), 'atlas-cast-south'); assert.equal(atlasOf(`face-${g}-happy`), 'atlas-faces-south'); }
  for (const p of ['bg-chapter-9', 'bg-end-7', 'bg-stall-tiong', 'bg-stall-quay', 'bg-stall-jurong']) { assert.ok(PLAIN[p], p); assert.ok(existsSync(new URL(`../public/art/jade-street/${p}.webp`, import.meta.url)), p); }
  // every building and prop the builder places is painted
  for (const b of c.buildings) if (SOUTH.includes(districtAt(b.x, b.y))) assert.ok(FRAMES[b.sprite], `building ${b.sprite}`);
  for (const p of c.props) if ((([x, y]) => y / T >= SOUTH_Y0 && x / T >= SOUTH_X0 - 4 && x / T <= SOUTH_X1 + 1)(unmvP(p.x, p.y) ?? [0, 0])) assert.ok(FRAMES[p.sprite], `prop ${p.sprite}`);
  for (const d of SOUTH) for (const sp of SOUTH_FOLK[d]) assert.ok(FRAMES[`folk-${sp}-down`], `folk-${sp}`);
  for (const i of ['mi-artdeco', 'mi-godown', 'mi-pagoda', 'mi-dome', 'i-rabbit']) assert.ok(FRAMES[i], i);
  // the eager set stays about 8 MB
  const bytes = EAGER.reduce((a, f) => a + readFileSync(new URL(`../public/art/jade-street/${f}.webp`, import.meta.url)).length, 0);
  assert.ok(bytes < 9.2e6, `eager set ${(bytes / 1e6).toFixed(2)} MB`);
  assert.ok(ART_FILES.length >= 49);
});

test('the art fixes: the two stations repainted, calmer ground, the switch box’s own key', () => {
  const atlasOf = n => ATLASES[FRAMES[n][0]];
  assert.equal(atlasOf('katong-stn'), 'atlas-far'); assert.equal(atlasOf('changi-stn'), 'atlas-far');
  const art = src('scripts/jade-art.py');
  assert.match(art, /rect\('stn14', \['katong-stn', 'changi-stn'/); assert.match(art, /'katong-mall', None, 'katong-pavilion'/); assert.match(art, /'changi-shops', None\]/);
  assert.match(art, /\('ground6', \['katong', 'glam', 'tiong', 'quay', 'jurong', 'garden'\]\)/);
  assert.ok(FRAMES['mg-switch-key'], 'the switch key is painted'); assert.equal(atlasOf('mg-switch-key'), 'atlas-mg');
  assert.notDeepEqual(FRAMES['mg-switch-key'], FRAMES['mg-key']);
  assert.match(src('app/jade-street/minis.tsx'), /lights \? 'mg-switch-key' : 'mg-key'/);
});

console.log(`jade (fourteenth pass): ${n} tests ok`);
