// Jade Street, the twenty-fourth pass: Kranji and Woodlands and chapter 15, "Whimbrel Season". The district (Sungei
// Buloh's mangroves, mudflats, boardwalk and bird hide, Kranji Dam and Reservoir, the frog farm, Hay Dairies' goats and
// Bollywood Veggies, the Kranji War Memorial, Woodlands Checkpoint, the Causeway and its famous jam, the Woodlands
// Waterfront jetty) opens after chapter 14, on land beside Changi and by two new MRT stations; it has its own safe
// house, three properties, a side gig and a bike-hire fleet perk. The chapter's new step is `mud`: a crossing of the
// mudflats past the basking crocodiles, who doze, stir and watch to a rhythm the HUD reads out. The memorial is a quiet
// place: no job, tale, gig, guard or townsfolk ever goes inside its hedge, you walk there, and the only thing to do is
// stand a moment. Not an ending: a hook.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { World, DT, NO_INPUT } from '../.checks/jade-game.js';
import { MISSIONS, MISSION, SIDE, PEOPLE, CHAPTERS, FINALE, KRANJI_OPENS } from '../.checks/jade-story.js';
import { newSave, openDistricts, SAFE_HOUSES, TROPHIES } from '../.checks/jade-save.js';
import { city, T, W, G, DISTRICTS, districtAt } from '../.checks/jade-city.js';
import { travelPlan } from '../.checks/jade-mrt.js';
import { dropOffs } from '../.checks/jade-taxi.js';
import { pedTile } from '../.checks/jade-folk.js';
import { KRANJI_TEXT, WHIMBREL_TEXT } from '../.checks/jade-cable.js';
import { mudOf, crocPhase, rhythmOf, MUD } from '../.checks/jade-mud.js';
import { kranjiNear, kranjiAct, inQuiet, BOW_S } from '../.checks/jade-kranjifest.js';
import { KRANJI_NAMES, MEMORIAL } from '../.checks/jade-kranji.js';
import { BIZ } from '../.checks/jade-biz.js';
import { GIG20_DEFS } from '../.checks/jade-gigs20.js';
import { gigMission } from '../.checks/jade-gigs.js';
import { FLEET, cantCall } from '../.checks/jade-fleet.js';
import { PAR } from '../.checks/jade-medals.js';
import { FRAMES, ATLASES } from '../.checks/jade-art.js';
import { tierOf, ZONE_OF } from '../.checks/jade-load.js';
import { playMission, missionSave } from './jade-bot.mjs';
import { offered } from '../.checks/jade-save.js';

let n = 0;
const test = (name, f) => { try { f(); n++; } catch (e) { console.error('FAILED:', name); throw e; } };
const c = city();
const FIFTEEN = ['m116', 'm117', 'm118', 'm119', 'm120', 'm121', 'm122', 'm123', 'm124', 'm125'], TALES = ['k53', 'k54', 'k55'];
const inKranji = (x, y) => districtAt(Math.floor(x / T), Math.floor(y / T)) === 'kranji';
const Q = c.kranji.quiet;
const quietTile = (tx, ty) => tx >= Q[0] && ty >= Q[1] && tx <= Q[2] && ty <= Q[3];
const quietAt = (x, y) => quietTile(Math.floor(x / T), Math.floor(y / T));
/** a world just after chapter 14, standing at a Kranji place */
function kranji(seed = 3, o = {}) {
  const s = newSave(seed); s.started = true; s.story.intro = true; s.settings.assist = o.assist ?? true;
  s.done = MISSIONS.slice(0, MISSIONS.findIndex(m => m.id === KRANJI_OPENS) + 1).map(m => m.id); s.story.ch = 15;
  const w = new World(s, seed); w.quiet = true; w.talk = null;
  const pl = c.places[o.at ?? 'safe-kranji']; w.p.b.x = pl.x; w.p.b.y = pl.y + 40; w.step(NO_INPUT, DT);
  return w;
}
const settle = (w, s = 2) => { for (let i = 0; i < s / DT; i++) { w.step(NO_INPUT, DT); if (w.talk) w.talk = null; } };
function at(id, i, o = {}) {
  const s = newSave(o.seed ?? 9); s.started = true; s.story.intro = true; s.settings.assist = o.assist ?? false; s.settings.diff = o.diff ?? 'normal';
  s.done = [...MISSIONS.slice(0, MISSIONS.findIndex(m => m.id === 'm116')).map(m => m.id), ...FIFTEEN.slice(0, FIFTEEN.indexOf(id))]; s.story.ch = 15;
  const w = new World(s, o.seed ?? 9); w.quiet = true;
  w.startMission(MISSION[id]); w.talk = null;
  const run = w.run; run.snap = run.snapshot(i); run.enter(i); w.talk = null;
  return { w, run, st: run.cur };
}
const put = (w, x, y) => { w.p.b.x = x; w.p.b.y = y; w.p.b.speed = 0; w.p.act = null; };
/** every spot a step names (tiles, place ids, people), deep */
function spotsOf(v, out = []) {
  if (Array.isArray(v)) { if (v.length === 2 && typeof v[0] === 'number' && typeof v[1] === 'number') out.push([(v[0] + 0.5) * T, (v[1] + 0.5) * T]); else for (const x of v) spotsOf(x, out); }
  else if (typeof v === 'string') { const p = c.places[v]; if (p) out.push([p.x, p.y]); }
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) if (k !== 'lines' && k !== 'label') spotsOf(x, out);
  return out;
}

test('Kranji and Woodlands: their own district, opened by chapter 14’s finale, real places, a safe house, MRT, on land', () => {
  assert.ok(DISTRICTS.includes('kranji')); assert.equal(ZONE_OF.kranji, 'kranji');
  const s = newSave(); s.done = MISSIONS.slice(0, MISSIONS.findIndex(m => m.id === KRANJI_OPENS)).map(m => m.id);
  assert.ok(!openDistricts(s).includes('kranji'), 'fogged before'); s.done.push(KRANJI_OPENS); assert.ok(openDistricts(s).includes('kranji'), 'open after');
  const names = Object.values(c.places).filter(p => p.d === 'kranji').map(p => p.name).join(' | ') + ' | ' + Object.values(KRANJI_NAMES).join(' | ');
  for (const real of ['Sungei Buloh', 'Kranji Dam', 'Kranji Reservoir', 'Kranji War Memorial', 'Hay Dairies', 'Bollywood Veggies', 'Woodlands Checkpoint', 'Causeway', 'Woodlands Waterfront', 'Strait of Johor'])
    assert.match(names, new RegExp(real), real);
  const safe = SAFE_HOUSES.find(h => h.d === 'kranji'); assert.ok(safe && c.places[safe.id] && inKranji(c.places[safe.id].x, c.places[safe.id].y), 'a safe house');
  const props = BIZ.filter(b => b.d === 'kranji'); assert.equal(props.length, 3, 'three properties');
  for (const b of props) assert.ok(PEOPLE[b.keeper], `${b.id} kept by a Kranji giver`);
  // two MRT stations, and Route me from Chinatown takes the train
  for (const st of ['stn-kranji', 'stn-woodlands']) assert.ok(c.places[st] && inKranji(c.places[st].x, c.places[st].y), st);
  const w = kranji(), m = c.places['safe-market'], to = c.places['kr-visitor'];
  const plan = travelPlan(w, to.x, to.y, m.x, m.y), vias = []; for (let p = plan; p; p = p.then) vias.push(p.via);
  assert.ok(vias.includes('mrt') || vias.includes('train'), `by the MRT (${vias})`);
  assert.match(KRANJI_TEXT, /Sungei Buloh/);
  // no traffic AI on the Causeway: its lanes are closed tiles (the jam is drawn only)
  for (const q of c.kranji.queue) for (let y = q.y0; y < q.y1; y += T) assert.notEqual(c.solid[Math.floor(y / T) * W + Math.floor(q.x / T)], 0, 'jam lanes closed');
});

test('chapter fifteen: ten jobs round Kranji, a mix of steps, at most a third chases, ending on a hook', () => {
  const ten = MISSIONS.filter(m => m.ch === 15);
  assert.deepEqual(ten.map(m => m.id), FIFTEEN); assert.equal(CHAPTERS[14], 'Whimbrel Season'); assert.equal(FINALE[14], 'm125');
  const chases = ten.filter(m => m.steps.some(s => s.t === 'chase' || s.t === 'tail' || s.t === 'race')).length;
  assert.ok(chases <= Math.ceil(FIFTEEN.length / 3), `${chases} chases`);
  const kinds = new Set(ten.flatMap(m => m.steps.map(s => s.t)));
  for (const k of ['mud', 'train', 'case', 'collect', 'tail', 'chase', 'swap', 'defend']) assert.ok(kinds.has(k), k);
  assert.ok(ten.filter(m => m.steps.some(s => s.t === 'mud')).length >= 3, 'the mud crossing is the chapter’s own step');
  for (const m of ten) {
    assert.ok(m.steps.some(s => s.cp), `${m.id} checkpoint`); assert.ok(PAR[m.id] > 0, `${m.id} par`);
    if (m.id !== 'm116') { const g = c.places[m.at]; assert.ok(g && inKranji(g.x, g.y), `${m.id} given in Kranji`); }
    for (const st of m.steps) if (st.t === 'talk') for (const [who] of st.lines) assert.ok(who === 'hero' || who === 'mate' || PEOPLE[who], `${m.id} ${who}`);
    // opponents that fit the place: Bos Belacak's Mudskipper Boys
    for (const st of m.steps) if (st.t === 'case' || st.t === 'swap') assert.equal(st.skin, 'skipper', `${m.id} mudskippers keep watch`);
  }
  // m116 takes the train out to Kranji from chapter 14's hook
  assert.ok(MISSION.m116.steps.some(s => s.t === 'train' && s.to === 'stn-kranji'), 'the train out');
  const last = MISSION.m125.steps.at(-1); assert.equal(last.t, 'talk', 'the chapter ends on a talk');
  const words = [...last.lines.map(l => l[1]), WHIMBREL_TEXT].join(' ');
  assert.doesNotMatch(words, /\b(finale|the end|happily ever|farewell forever)\b/i);
  assert.doesNotMatch(words, /Sutera (is|was) (beaten|caught|finished)/i, 'Sutera is not beaten');
  assert.match(words, /tide/i, 'a hook');
  assert.doesNotMatch(readFileSync(new URL('../app/jade-street/story.tsx', import.meta.url), 'utf8'), /bg-end-15|chapter 15 ending/i);
  assert.doesNotMatch(JSON.stringify([...ten, ...TALES.map(id => MISSION[id])]), /grumble/i);
});

test('three Hawker Tales in Kranji, each opening in chapter fifteen', () => {
  for (const id of TALES) {
    const m = MISSION[id]; assert.ok(m && SIDE.includes(m), id); assert.ok(inKranji(c.places[m.at].x, c.places[m.at].y), `${id} in Kranji`);
    assert.ok(PAR[id] > 0); assert.ok(FIFTEEN.includes(m.side), `${id} opens in chapter fifteen`);
    assert.ok(m.reward >= 250 && m.reward <= 400); assert.ok(m.steps.some(st => st.cp), `${id} has a checkpoint`);
    // the tale's prompt is never hidden by a story job offered at the same giver when it opens
    const here = offered(missionSave(id)).filter(o => o.at === m.at).map(o => o.id);
    assert.deepEqual(here, [id], `${id}: nothing else on offer at ${m.at} when it opens (${here})`);
  }
});

test('the Kranji War Memorial is quiet: nothing of a job, tale, gig, guard or townsfolk goes inside its hedge', () => {
  assert.ok(Q, 'the precinct'); assert.equal(Q[2] - Q[0], MEMORIAL.x1 - MEMORIAL.x0);
  const jobs = [...FIFTEEN, ...TALES].map(id => MISSION[id]);
  for (const g of GIG20_DEFS.filter(g => g.d === 'kranji')) { const r = gigMission(kranji(3, { at: 'kr-causeway' }), g.id); assert.ok(r); jobs.push(r.m); }
  for (const m of jobs) {
    const pl = c.places[m.at]; if (pl) assert.ok(!quietAt(pl.x, pl.y), `${m.id} given outside`);
    for (const st of m.steps) for (const [x, y] of spotsOf(st)) assert.ok(!quietAt(x, y), `${m.id} ${st.t} spot inside the memorial`);
  }
  // every job anywhere, too
  for (const m of [...MISSIONS, ...SIDE]) for (const st of m.steps) for (const [x, y] of spotsOf(st)) assert.ok(!quietAt(x, y), `${m.id} ${st.t}`);
  // no townsfolk inside, no taxi drops off there, the bike hire won't come in, and you walk
  for (let ty = Q[1]; ty <= Q[3]; ty++) for (let tx = Q[0]; tx <= Q[2]; tx++) assert.ok(!pedTile(c, tx, ty), `no ped at ${tx},${ty}`);
  const w = kranji(3, { at: 'kr-memgate' });
  assert.ok(!dropOffs(w).some(d => d.id === 'kr-memorial'), 'no taxi to the memorial');
  w.s.biz.bikehire.lvl = 1; const [rx, ry] = c.kranji.respect; put(w, rx, ry); w.step(NO_INPUT, DT);
  assert.ok(inQuiet(w, rx, ry)); assert.match(cantCall(w, 'bikehire') ?? '', /memorial/);
  let top = 0; put(w, rx, ry + 3 * T);
  for (let k = 0; k < 1 / DT; k++) { w.step({ ...NO_INPUT, mx: 0, my: -1, dash: true }, DT); top = Math.max(top, w.p.b.speed); if (w.talk) w.talk = null; }
  assert.ok(top < 200, `you walk in the memorial (${top})`);
  // the memorial's one action: stand a moment (its own pose); no stat, no reputation, no trophy
  const rep = w.s.rep.kranji ?? 0, counts = st => JSON.stringify({ ...st, playTime: 0, walked: 0, driven: 0 }), stats = counts(w.s.stats); put(w, rx, ry);
  const near = {}; kranjiNear(w, nn => { near[nn.id] = nn; }); assert.ok(near.respect);
  kranjiAct(w, 'respect'); assert.equal(w.p.act?.n, 'bow'); settle(w, BOW_S + 0.4);
  assert.equal(w.s.rep.kranji ?? 0, rep); assert.equal(counts(w.s.stats), stats, 'no stat counts the bow');
  assert.ok(!TROPHIES.some(t => /memorial|\bbow\b|respect/i.test(t.id + t.desc)), 'no trophy for the memorial');
  // m121's quiet visit ends at the gate, in quiet words
  const m121 = MISSION.m121, talk = m121.steps.at(-1); assert.equal(talk.t, 'talk');
  assert.doesNotMatch(talk.lines.map(l => l[1]).join(' '), /!{2}|haha|lol|snap|chase|crow/i);
});

test('the mud step: cross while they doze; stop when one stirs; move while it watches and it lunges, back a marker', () => {
  const i = MISSION.m117.steps.findIndex(s => s.t === 'mud'), { w, run, st } = at('m117', i, { assist: false });
  const c0 = mudOf(run); assert.ok(c0); assert.equal(run.meter?.name, 'Croc'); assert.ok(run.timer > 0); assert.match(run.progress, /Markers 0\/3/);
  const [d, s, a] = rhythmOf(run, st); assert.deepEqual([d, s, a], [MUD.doze, MUD.stir, MUD.watch]);
  assert.equal(crocPhase(run, st, 0).ph, 'doze'); assert.equal(crocPhase(run, st, d + 0.5).ph, 'stir'); assert.equal(crocPhase(run, st, d + s + 0.5).ph, 'watch');
  // the first marker
  const [m0x, m0y] = run.spot(st.route[0]); put(w, m0x, m0y); settle(w, 0.2); assert.equal(c0.k, 1);
  assert.match(run.label, /^Crocs dozing \(\d+ s\)/);
  // walk about near a crocodile until it watches: the HUD warns first, then it lunges
  const [cx, cy] = run.spot(st.crocs[0]); put(w, cx + 120, cy);
  let warned = false; const t0 = run.timer;
  for (let k = 0; k < (d + s + a) / DT && c0.snaps === 0; k++) {
    w.step({ ...NO_INPUT, mx: k % 120 < 60 ? 1 : -1, my: 0 }, DT); if (w.talk) w.talk = null;
    if (/Croc stirring!/.test(run.label)) warned = true;
  }
  assert.ok(warned, 'the HUD warned first'); assert.equal(c0.snaps, 1, 'it lunged'); assert.equal(w.p.act?.n, 'mud-scramble'); assert.equal(run.hits, 1);
  assert.ok(run.timer <= t0 - MUD.lose, 'it costs time');
  settle(w, 1.2); assert.ok(Math.hypot(w.p.x - m0x, w.p.y - m0y) < 40, 'back at the last marker');
  // standing still while it watches is always safe
  const ph = () => crocPhase(run, st, c0.t).ph; while (ph() === 'watch') { w.step(NO_INPUT, DT); if (w.talk) w.talk = null; } while (ph() !== 'watch') { w.step(NO_INPUT, DT); if (w.talk) w.talk = null; }
  put(w, cx + 100, cy); settle(w, a - 0.3); assert.equal(c0.snaps, 1, 'still is safe'); assert.match(run.label, /FREEZE|out of its sight/);
  for (const q of st.route.slice(1)) { const [x, y] = run.spot(q); put(w, x, y); settle(w, 0.2); }
  assert.notEqual(run.cur, st, 'crossed'); assert.equal(w.s.stats.mudflats, 1);
});

test('Assist eases the crocodiles, Hard sharpens them; soft mud is waded; the hero has their own mud poses', () => {
  const i = MISSION.m117.steps.findIndex(s => s.t === 'mud');
  const as = at('m117', i, { assist: true }), no = at('m117', i), hd = at('m117', i, { diff: 'hard' });
  const [ad, , aw] = rhythmOf(as.run, as.st), [nd, , nw] = rhythmOf(no.run, no.st), [hdz, , hw] = rhythmOf(hd.run, hd.st);
  assert.ok(ad > nd && nd > hdz, 'dozing: Assist > Normal > Hard'); assert.ok(aw < nw && nw < hw, 'watching: Assist < Normal < Hard');
  assert.ok(as.run.timer > no.run.timer, 'Assist gives more time');
  // the dawn crossing of m125 has shorter dozes
  const j = MISSION.m125.steps.findIndex(s => s.t === 'mud'), dn = at('m125', j);
  assert.ok(rhythmOf(dn.run, dn.st)[0] < MUD.doze, 'a dawn doze is short');
  // wading: slower than a walk and no dash on soft mud in a crossing
  const { w, run } = no; let mud = null;
  for (let ty = 0; ty < c.ground.length / W && !mud; ty++) for (let tx = 0; tx < W && !mud; tx++) if (c.ground[ty * W + tx] === G.MUDFLAT && c.ground[(ty + 1) * W + tx] === G.MUDFLAT && c.ground[(ty + 2) * W + tx] === G.MUDFLAT && c.solid[(ty + 1) * W + tx] === 0) mud = [(tx + 0.5) * T, (ty + 0.5) * T];
  assert.ok(mud); put(w, mud[0], mud[1]); let top = 0; void run;
  for (let k = 0; k < 0.8 / DT; k++) { w.step({ ...NO_INPUT, mx: 0, my: 1, dash: true }, DT); top = Math.max(top, w.p.b.speed); if (w.p.act) break; }
  assert.ok(top <= MUD.wade + 1, `waded (${top})`);
  for (const h of ['dora', 'enzo']) for (const f of ['mud-wade-0', 'mud-wade-1', 'mud-freeze', 'mud-scramble', 'goatfeed', 'bow', 'lookout']) assert.ok(FRAMES[`${h}-${f}`], `${h}-${f}`);
});

test('the whimbrel flocks on a crossing: E at each, in order, before the markers', () => {
  const i = MISSION.m123.steps.findIndex(s => s.t === 'mud'), { w, run, st } = at('m123', i, { assist: true }), c0 = mudOf(run);
  assert.match(run.progress, /Flocks 0\/3/);
  const [bx, by] = run.spot(st.birds[0]); put(w, bx, by); w.step(NO_INPUT, DT);
  const near = w.near; assert.ok(near && /Count the whimbrels \(1 of 3\)/.test(near.label), near?.label);
  w.step({ ...NO_INPUT, act: true }, DT); assert.equal(w.p.act?.n, 'lookout'); settle(w, 1.2); assert.equal(c0.birds, 1); assert.match(run.progress, /Flocks 1\/3/);
});

test('the Mudskipper Boys keep watch with their own frames', () => {
  for (const f of ['skipper-walk-down-0', 'skipper-walk-down-1', 'skipper-walk-up-0', 'skipper-walk-up-1', 'skipper-run-0', 'skipper-run-1', 'skipper-sing', 'skipper-peer', 'skipper-munch', 'skipper-taunt']) assert.ok(FRAMES[f], f);
  const i = MISSION.m118.steps.findIndex(s => s.t === 'case'), { run } = at('m118', i, { assist: true });
  assert.ok(run.actors.filter(a => a.kind === 'guard').every(a => a.skin === 'skipper'), 'mudskippers on the bank');
});

test('the hide and the goats: their own animations, counted, and trophies', () => {
  const w = kranji(3, { at: 'kr-hide' }), near = {}; kranjiNear(w, nn => { near[nn.id] = nn; });
  for (const id of ['hide', 'goats', 'respect']) assert.ok(near[id], id);
  put(w, near.hide.x, near.hide.y); kranjiAct(w, 'hide'); assert.equal(w.p.act?.n, 'lookout'); settle(w, 2.8); assert.equal(w.s.stats.hides, 1);
  put(w, near.goats.x, near.goats.y); kranjiAct(w, 'goats'); assert.equal(w.p.act?.n, 'goatfeed'); settle(w, 2.4); assert.equal(w.s.stats.goatfeeds, 1);
  assert.ok(w.s.rep.kranji >= 2, 'a little Kranji reputation');
  for (const t of ['whimbrels', 'mudlark', 'shorebird', 'goatherd', 'causeway']) assert.ok(TROPHIES.some(x => x.id === t), t);
});

test('a kopi round down the Causeway jam, and the bike hire’s perk, only in Kranji', () => {
  const g = GIG20_DEFS.find(x => x.d === 'kranji'); assert.ok(g, 'a Kranji gig');
  const w = kranji(3, { at: 'kr-causeway' }), r = gigMission(w, g.id); assert.ok(r && r.reward >= 50 && r.reward <= 90);
  assert.ok(r.m.steps.some(s => s.t === 'rounds' && s.item === 'kr-kopi'), 'a kopi round');
  for (const st of r.m.steps) for (const [x, y] of spotsOf(st)) assert.ok(inKranji(x, y) && c.solid[Math.floor(y / T) * W + Math.floor(x / T)] === 0, 'drops on open Causeway footpath');
  const f = FLEET.find(x => x.id === 'bikehire'); assert.ok(f && f.kind === 'bike');
  assert.ok(BIZ.some(b => b.id === 'bikehire' && b.d === 'kranji'));
  const off = kranji(3, { at: 'kr-visitor' }); off.s.biz.bikehire.lvl = 1; assert.equal(cantCall(off, 'bikehire') ?? null, null, 'callable in Kranji');
  const pl = c.places['safe-market']; put(off, pl.x, pl.y + 40); off.step(NO_INPUT, DT);
  assert.match(cantCall(off, 'bikehire') ?? '', /Kranji and Woodlands/);
});

test('the paintings: Kranji’s art streams with its zone, the heroes’ new actions too, nothing new is core', () => {
  for (const f of ['kr-visitor', 'kr-hide', 'kr-checkpoint', 'kr-memorial', 'kr-frogfarm', 'kr-barn', 'kr-greenhouse', 'kr-stn', 'kr-croc-doze', 'kr-croc-peek',
    'kr-croc-watch', 'kr-croc-snap', 'kr-skipper-0', 'kr-lizard-1', 'kr-whimbrel-0', 'kr-goat-1', 'kr-frog-0', 'kr-owl', 'kr-car-sutera', 'kr-lorry',
    'npc-kedidi-idle-0', 'npc-biawak-talk-1', 'npc-katak-wave-0', 'npc-kambing-idle-1', 'face-belacak-cross', 'face-kedidi-happy',
    'biz-farmstall-3', 'biz-kiosk-0', 'biz-bikehire-2', 'mi-buloh', 'mi-memorial', 'mi-causeway', 'pin-skipper', 'i-croc', 'i-whimbrel'])
    assert.ok(FRAMES[f], f);
  for (const a of ['atlas-kranji', 'atlas-cast-kranji']) assert.equal(tierOf(a), 'kranji', a);
  assert.equal(tierOf('atlas-act24'), 'job'); assert.equal(tierOf('atlas-ui24'), 'job');
  for (const a of ATLASES) if (/24|kranji/.test(a)) assert.notEqual(tierOf(a), 'core', a);
  for (const id of [...FIFTEEN, ...TALES]) for (const st of MISSION[id].steps) for (const it of [st.item, st.loot]) if (it) assert.ok(FRAMES[it], `${id}: ${it} is painted`);
});

test('every new job clears for a human-paced player (Assist on, as by default) and off Assist on normal', () => {
  for (const id of [...FIFTEEN, ...TALES]) { const r = playMission(id, 'casual', 5); assert.ok(r.won, `${id} casual: ${JSON.stringify(r.why)}`); }
  for (const id of ['m117', 'm119', 'm123', 'm125', 'k53']) assert.ok(playMission(id, 'normal', 3, { assist: false }).won, `${id} normal off Assist`);
});

console.log(`jade (twenty-fourth pass): ${n} tests ok`);
