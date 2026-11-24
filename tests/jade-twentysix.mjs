// Jade Street, the twenty-sixth pass: Toa Payoh grows north into Bishan and Ang Mo Kio, and chapter 17, "Red-Haired
// Man’s Bridge". The new block (Bishan-Ang Mo Kio Park with the Kallang River's wide bend, its stepping stones, footbridges
// and otters; Bishan's void-deck wedding and Junction 8; Ang Mo Kio's void-deck chess, market, Town Garden and the Kebun
// Baru bird-singing corner) opens after chapter 16, by the MRT north from Toa Payoh; it has its own safe house and a side
// gig. The chapter's new step is `stones`: hopping the stepping stones while the river surges. Not an ending: a hook.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { World, DT, NO_INPUT } from '../.checks/jade-game.js';
import { MISSIONS, MISSION, SIDE, PEOPLE, CHAPTERS, FINALE, BISHAN_OPENS } from '../.checks/jade-story.js';
import { newSave, openDistricts, SAFE_HOUSES, TROPHIES, offered } from '../.checks/jade-save.js';
import { city, T, DISTRICTS, districtAt } from '../.checks/jade-city.js';
import { travelPlan, walkDist } from '../.checks/jade-mrt.js';
import { dropOffs, cantHail } from '../.checks/jade-taxi.js';
import { BISHAN_TEXT, HORSBURGH_TEXT } from '../.checks/jade-cable.js';
import { stonesOf, surgeAt, clockOf, isLow, stonesAct, stonesNear, STONES } from '../.checks/jade-stones.js';
import { bishanNear, bishanAct, CHESS_S, SLIDE_S } from '../.checks/jade-bishanfest.js';
import { BISHAN_NAMES } from '../.checks/jade-bishan.js';
import { BIZ } from '../.checks/jade-biz.js';
import { GIG20_DEFS } from '../.checks/jade-gigs20.js';
import { gigMission } from '../.checks/jade-gigs.js';
import { cantCall } from '../.checks/jade-fleet.js';
import { PAR } from '../.checks/jade-medals.js';
import { FRAMES, ATLASES } from '../.checks/jade-art.js';
import { dests, openDests } from '../.checks/jade-folk.js';
import { tierOf, ZONE_OF } from '../.checks/jade-load.js';
import { playMission, missionSave } from './jade-bot.mjs';

let n = 0;
const test = (name, f) => { try { f(); n++; } catch (e) { console.error('FAILED:', name); throw e; } };
const c = city();
const SEVENTEEN = ['m136', 'm137', 'm138', 'm139', 'm140', 'm141', 'm142', 'm143', 'm144', 'm145'], TALES = ['k59', 'k60', 'k61'];
const inBishan = (x, y) => districtAt(Math.floor(x / T), Math.floor(y / T)) === 'bishan';
/** a world just after chapter 16, standing at a Bishan place */
function bishan(seed = 3, o = {}) {
  const s = newSave(seed); s.started = true; s.story.intro = true; s.settings.assist = o.assist ?? true;
  s.done = MISSIONS.slice(0, MISSIONS.findIndex(m => m.id === BISHAN_OPENS) + 1).map(m => m.id); s.story.ch = 17;
  const w = new World(s, seed); w.quiet = true; w.talk = null;
  const pl = c.places[o.at ?? 'safe-bishan']; w.p.b.x = pl.x; w.p.b.y = pl.y + 40; w.step(NO_INPUT, DT);
  return w;
}
const settle = (w, s = 2) => { for (let i = 0; i < s / DT; i++) { w.step(NO_INPUT, DT); if (w.talk) w.talk = null; } };
function at(id, i, o = {}) {
  const s = newSave(o.seed ?? 9); s.started = true; s.story.intro = true; s.settings.assist = o.assist ?? false; s.settings.diff = o.diff ?? 'normal';
  const side = MISSION[id].side;
  s.done = side ? MISSIONS.slice(0, MISSIONS.findIndex(m => m.id === side) + 1).map(m => m.id) : [...MISSIONS.slice(0, MISSIONS.findIndex(m => m.id === 'm136')).map(m => m.id), ...SEVENTEEN.slice(0, SEVENTEEN.indexOf(id))];
  s.story.ch = 17;
  const w = new World(s, o.seed ?? 9); w.quiet = true;
  w.startMission(MISSION[id]); w.talk = null;
  const run = w.run; run.snap = run.snapshot(i); run.enter(i); w.talk = null;
  return { w, run, st: run.cur };
}
const put = (w, x, y) => { w.p.b.x = x; w.p.b.y = y; w.p.b.speed = 0; w.p.act = null; };
const stonesAt = (id, o) => at(id, MISSION[id].steps.findIndex(s => s.t === 'stones'), o);
/** step until the hero's act (a hop and its landing) is over */
const land = w => { for (let k = 0; k < 3 / DT && w.p.act; k++) { w.step(NO_INPUT, DT); if (w.talk) w.talk = null; } };
/** step until the river is in phase `ph` */
const until = (w, run, st, ph) => { for (let k = 0; k < 20 / DT; k++) { if (surgeAt(run, st, stonesOf(run).t).ph === ph) return; w.step(NO_INPUT, DT); if (w.talk) w.talk = null; } assert.fail(`never ${ph}`); };

test('Bishan and Ang Mo Kio: their own district, opened by chapter 16’s hook, real places, a safe house, the MRT north from Toa Payoh', () => {
  assert.ok(DISTRICTS.includes('bishan')); assert.equal(ZONE_OF.bishan, 'bishan');
  const s = newSave(); s.done = MISSIONS.slice(0, MISSIONS.findIndex(m => m.id === BISHAN_OPENS)).map(m => m.id);
  assert.ok(!openDistricts(s).includes('bishan'), 'fogged before'); s.done.push(BISHAN_OPENS); assert.ok(openDistricts(s).includes('bishan'), 'open after');
  const names = Object.values(c.places).filter(p => p.d === 'bishan').map(p => p.name).join(' | ') + ' | ' + Object.values(BISHAN_NAMES).join(' | ');
  for (const real of ['Bishan-Ang Mo Kio Park', 'the Kallang River', 'Ang Mo Kio', 'AMK Hub', 'Junction 8', 'Ang Mo Kio Town Garden', 'Kebun Baru', 'Bishan station', 'Ang Mo Kio station', 'void deck'])
    assert.match(names, new RegExp(real), real);
  const safe = SAFE_HOUSES.find(h => h.d === 'bishan'); assert.ok(safe && c.places[safe.id] && inBishan(c.places[safe.id].x, c.places[safe.id].y), 'a safe house');
  for (const id of ['stn-bishan', 'stn-angmokio']) assert.ok(c.places[id] && inBishan(c.places[id].x, c.places[id].y), id);
  const props = BIZ.filter(b => b.d === 'bishan'); assert.equal(props.length, 3, 'three properties');
  for (const b of props) assert.ok(PEOPLE[b.keeper], `${b.id} kept by a Bishan giver`);
  // Route me from Toa Payoh takes the train; no land joins it yet (the geography pass moves it north of Toa Payoh)
  const w = bishan(), tp = c.places['stn-toapayoh'], to = c.places['bs-survey'];
  const plan = travelPlan(w, to.x, to.y, tp.x, tp.y), vias = []; for (let p = plan; p; p = p.then) vias.push(p.via);
  assert.ok(vias.includes('mrt'), `by the MRT (${vias})`);
  assert.equal(walkDist(tp.x, tp.y, to.x, to.y), Infinity, 'no walk yet');
  assert.match(BISHAN_TEXT, /Bishan/); assert.match(BISHAN_TEXT, /Toa Payoh/);
  // no roads in yet: no taxis there, none dropping off there, no cab called there
  assert.match(cantHail(w) ?? '', /No taxis in Bishan/);
  const town = bishan(3, { at: 'safe-market' }); put(town, c.places['safe-market'].x, c.places['safe-market'].y + 40); town.step(NO_INPUT, DT);
  assert.ok(!dropOffs(town).some(d => c.places[d.id]?.d === 'bishan'), 'no taxi drops off in Bishan');
  w.s.biz.taxi.lvl = 1; assert.match(cantCall(w, 'taxi') ?? '', /No roads/);
  // townsfolk walk to Bishan's doors and benches only once it is open
  const early = bishan(4); early.open.delete('bishan'); const all = dests(c), st = c.places['stn-bishan'];
  assert.ok(all.some(d => districtAt(d.tx, d.ty) === 'bishan'), 'Bishan has places to walk to');
  assert.ok(openDests(bishan(4), st.x, st.y).some(i => districtAt(all[i].tx, all[i].ty) === 'bishan'), 'picked once it opens');
  assert.ok(!openDests(early, st.x, st.y).some(i => districtAt(all[i].tx, all[i].ty) === 'bishan'), 'none picked before it opens');
});

test('chapter seventeen: ten jobs round Toa Payoh, Bishan and AMK, a mix of steps, at most a third chases, ending on a hook', () => {
  const ten = MISSIONS.filter(m => m.ch === 17);
  assert.deepEqual(ten.map(m => m.id), SEVENTEEN); assert.equal(CHAPTERS[16], 'Red-Haired Man’s Bridge'); assert.equal(FINALE[16], 'm145');
  const chases = ten.filter(m => m.steps.some(s => s.t === 'chase' || s.t === 'tail' || s.t === 'race')).length;
  assert.ok(chases <= Math.ceil(SEVENTEEN.length / 3), `${chases} chases`);
  const kinds = new Set(ten.flatMap(m => m.steps.map(s => s.t)));
  for (const k of ['stones', 'case', 'rounds', 'race', 'tail', 'chase', 'defend', 'train']) assert.ok(kinds.has(k), k);
  assert.ok([...ten, ...TALES.map(id => MISSION[id])].filter(m => m.steps.some(s => s.t === 'stones')).length >= 3, 'the stones are the chapter’s own step');
  for (const m of ten) {
    assert.ok(m.steps.some(s => s.cp), `${m.id} checkpoint`); assert.ok(PAR[m.id] > 0, `${m.id} par`);
    for (const st of m.steps) if (st.t === 'talk') for (const [who] of st.lines) assert.ok(who === 'hero' || who === 'mate' || PEOPLE[who], `${m.id} ${who}`);
    // opponents that fit the place: Ah Wei's Koel Boys
    for (const st of m.steps) if (st.t === 'case' || st.t === 'swap' || st.t === 'chase' || st.t === 'tail') if (st.skin) assert.equal(st.skin, 'koel', `${m.id} koels`);
  }
  // m136 starts in Toa Payoh and rides the MRT north
  assert.ok(MISSION.m136.steps.some(s => s.t === 'train'), 'the train north');
  // it carries chapter 16's hook on: Sutera, her junk, the chart, Pak Camar
  const all = JSON.stringify(ten) + BISHAN_TEXT + HORSBURGH_TEXT;
  for (const w of ['Sutera', 'Pak Camar', 'chart']) assert.ok(all.includes(w), w);
  const last = MISSION.m145.steps.at(-1); assert.equal(last.t, 'talk', 'the chapter ends on a talk');
  const words = [...last.lines.map(l => l[1]), HORSBURGH_TEXT].join(' ');
  assert.doesNotMatch(words, /\b(finale|the end|happily ever|farewell forever)\b/i);
  assert.doesNotMatch(words, /Sutera (is|was) (beaten|caught|finished)/i, 'Sutera is not beaten');
  assert.match(HORSBURGH_TEXT, /Horsburgh/, 'a hook out east');
  assert.doesNotMatch(readFileSync(new URL('../app/jade-street/story.tsx', import.meta.url), 'utf8'), /bg-end-17|chapter 17 ending/i);
  assert.doesNotMatch(JSON.stringify([...ten, ...TALES.map(id => MISSION[id])]), /grumble/i);
});

test('three Hawker Tales round Bishan and Toa Payoh, each opening in chapter seventeen', () => {
  for (const id of TALES) {
    const m = MISSION[id]; assert.ok(m && SIDE.includes(m), id);
    assert.ok(PAR[id] > 0); assert.ok(SEVENTEEN.includes(m.side), `${id} opens in chapter seventeen`);
    assert.ok(m.reward >= 250 && m.reward <= 400); assert.ok(m.steps.some(st => st.cp), `${id} has a checkpoint`);
    const here = offered(missionSave(id)).filter(o => o.at === m.at).map(o => o.id);
    assert.deepEqual(here, [id], `${id}: nothing else on offer at ${m.at} when it opens (${here})`);
  }
});

test('the stones step: hop stone to stone, calm, rising and surge on a clock the HUD shows, across to the far bank', () => {
  const { w, run, st } = stonesAt('m137'), [x0, y0] = run.spot(st.stones[0]);
  assert.ok(stonesOf(run)); assert.equal(run.meter?.name, 'River'); assert.match(run.progress, /Stones 0\/4/);
  assert.ok(st.low.length >= 2 && st.low.every(i => isLow(st, i)) && !isLow(st, 0) && !isLow(st, st.stones.length - 1), 'low stones, dry banks');
  // off the bank, no hop: the HUD sends you to the first stone
  put(w, x0 + 600, y0 + 600); settle(w, 0.1); assert.equal(stonesNear(run, w.p.x, w.p.y), null); assert.match(run.label, /Get to the bank/);
  // on the bank in a calm: E hops (the hop and the landing are the hero's own poses)
  put(w, x0, y0); settle(w, 0.05);
  const near = stonesNear(run, w.p.x, w.p.y); assert.equal(near?.id, 'stone:hop');
  let k = 0;
  while (run.cur === st && k++ < 40) {
    const c = stonesOf(run), next = c.k + 1;
    // wait for a calm before a low stone, or for its surge to pass
    if (isLow(st, next)) { if (surgeAt(run, st, c.t).ph !== 'calm') until(w, run, st, 'calm'); }
    stonesAct(run, 'stone:hop'); assert.equal(w.p.act?.n, 'stone-hop'); land(w);
  }
  assert.notEqual(run.cur, st, 'across'); assert.equal(w.s.stats.crossings, 1); assert.equal(w.s.stats.sweeps, 0, 'dry feet');
});

test('caught on a low stone by a surge: swept back to the last high stone, time lost, never the job', () => {
  const { w, run, st } = stonesAt('m137'), [x0, y0] = run.spot(st.stones[0]);
  assert.ok(isLow(st, 1), 'northward, the first stone is low');
  put(w, x0, y0); settle(w, 0.05); until(w, run, st, 'calm');
  const t0 = run.timer;
  stonesAct(run, 'stone:hop'); land(w); assert.equal(stonesOf(run).k, 1);
  let warned = false;
  for (let k = 0; k < 15 / DT && w.s.stats.sweeps === 0; k++) { w.step(NO_INPUT, DT); if (w.talk) w.talk = null; if (/RISING: hop on/.test(run.label)) warned = true; }
  assert.ok(warned, 'the HUD warned first'); assert.equal(w.s.stats.sweeps, 1); assert.equal(w.p.act?.n, 'stone-swept'); assert.equal(run.hits, 1);
  assert.ok(run.timer <= t0 - STONES.lose + 0.5, 'it costs time');
  land(w); assert.equal(stonesOf(run).k, 0, 'back on the bank'); assert.equal(run.cur, st, 'still the same job');
});

test('Assist slows the river and warns longer, Hard quickens it; the partner waits on the bank; the hero has their own poses', () => {
  const as = stonesAt('m137', { assist: true }), no = stonesAt('m137'), hd = stonesAt('m137', { diff: 'hard' }), fast = stonesAt('m144');
  const [ap, aw] = clockOf(as.run, as.st), [np, nw] = clockOf(no.run, no.st), [hp, hw] = clockOf(hd.run, hd.st), [fp] = clockOf(fast.run, fast.st);
  assert.ok(ap > np && np > hp, 'period: Assist > Normal > Hard'); assert.ok(aw > nw && nw > hw, 'warning: Assist > Normal > Hard');
  assert.ok(fp < np, 'the chapter’s last crossing runs faster');
  const { w, run, st } = no, m0 = [w.mate.x, w.mate.y], [x0, y0] = run.spot(st.stones[0]);
  put(w, x0, y0); settle(w, 0.05); stonesAct(run, 'stone:hop'); land(w); settle(w, 1);
  assert.ok(Math.hypot(w.mate.x - m0[0], w.mate.y - m0[1]) < 4, 'the partner waits');
  for (const h of ['dora', 'enzo']) for (const f of ['stonehop', 'teeter', 'swept', 'blitz-0', 'blitz-1', 'cartonslide']) assert.ok(FRAMES[`${h}-${f}`], `${h}-${f}`);
});

test('the Koel Boys keep watch with their own frames', () => {
  for (const f of ['koel-walk-down-0', 'koel-walk-down-1', 'koel-walk-up-0', 'koel-walk-up-1', 'koel-run-0', 'koel-run-1', 'koel-sing', 'koel-peer', 'koel-munch', 'koel-taunt', 'koel-dizzy']) assert.ok(FRAMES[f], f);
  const i = MISSION.m138.steps.findIndex(s => s.t === 'case'), { run } = at('m138', i, { assist: true });
  assert.ok(run.actors.filter(a => a.kind === 'guard').every(a => a.skin === 'koel'), 'koels at the rain tree');
});

test('blitz chess at the void deck and a carton slide down the bank: their own animations, counted, and trophies', () => {
  const w = bishan(3, { at: 'bs-chess' }), near = {}; bishanNear(w, nn => { near[nn.id] = nn; });
  for (const id of ['chess', 'slide']) assert.ok(near[id], id);
  put(w, near.chess.x, near.chess.y); bishanAct(w, 'chess'); assert.equal(w.p.act?.n, 'blitz'); settle(w, CHESS_S + 0.4); assert.equal(w.s.stats.blitz, 1);
  put(w, near.slide.x, near.slide.y); bishanAct(w, 'slide'); assert.equal(w.p.act?.n, 'bankslide');
  const y0 = w.p.y; settle(w, SLIDE_S / 2); assert.notEqual(w.p.y, y0, 'carried down the bank'); settle(w, SLIDE_S);
  assert.equal(w.s.stats.bankslides, 1); assert.ok(w.s.rep.bishan >= 2, 'a little Bishan reputation');
  for (const t of ['redhaired', 'dryfeet', 'voiddeck', 'cartonslide', 'newtown']) assert.ok(TROPHIES.some(x => x.id === t), t);
});

test('a kopi round for the AMK uncles, only in Bishan and Ang Mo Kio', () => {
  const g = GIG20_DEFS.find(x => x.d === 'bishan'); assert.ok(g, 'a Bishan gig');
  const w = bishan(3, { at: 'bs-amk' }), r = gigMission(w, g.id); assert.ok(r && r.reward >= 50 && r.reward <= 90);
  assert.ok(r.m.steps.some(s => s.t === 'rounds'), 'a round');
});

test('the paintings: Bishan’s art streams with its zone, the heroes’ new actions too, nothing new is core', () => {
  for (const f of ['bs-otter-0', 'bs-otter-1', 'bs-otter-sit', 'bs-otter-roll', 'bs-pup-0', 'bs-kingfisher', 'bs-stonehi', 'bs-stonelo', 'bs-oldbridge',
    'npc-merbok-idle-0', 'npc-puyuh-talk-1', 'npc-kura-wave-0', 'npc-kijang-idle-1', 'npc-koel-talk-0', 'face-koel-cross', 'face-kura',
    'biz-hokkienmee-0', 'biz-birdkopi-3', 'biz-parkhire-2', 'mi-footbridge', 'mi-otter', 'mi-birds'])
    assert.ok(FRAMES[f], f);
  for (const a of ['atlas-bishan', 'atlas-cast-bishan']) assert.equal(tierOf(a), 'bishan', a);
  assert.equal(tierOf('atlas-act26'), 'job'); assert.equal(tierOf('atlas-ui26'), 'job');
  for (const a of ATLASES) if (/26|bishan/.test(a)) assert.notEqual(tierOf(a), 'core', a);
  for (const id of [...SEVENTEEN, ...TALES]) for (const st of MISSION[id].steps) for (const it of [st.item, st.loot, st.decoy]) if (it) assert.ok(FRAMES[it], `${id}: ${it} is painted`);
});

test('every new job clears for a human-paced player (Assist on, as by default) and off Assist on normal and hard', () => {
  for (const id of [...SEVENTEEN, ...TALES]) { const r = playMission(id, 'casual', 5); assert.ok(r.won, `${id} casual: ${JSON.stringify(r.why)}`); }
  for (const id of ['m137', 'm140', 'm144', 'm145', 'k59', 'k61']) assert.ok(playMission(id, 'normal', 3, { assist: false }).won, `${id} normal off Assist`);
  for (const id of ['m137', 'm144', 'k59']) assert.ok(playMission(id, 'normal', 3, { assist: false, diff: 'hard' }).won, `${id} on Hard`);
});

console.log(`jade (twenty-sixth pass): ${n} tests ok`);
