// Jade Street, the twenty-third pass: second helpings, no new district or chapter. Each district that had a single side
// gig gets another (Little India two), set by its own givers round its own landmarks and played differently from the
// first; two new round acts (`photo`: a mural walk; `plant`: mangrove seedlings, with its own painted pose); eight more
// Hawker Tales (k45 to k52) for the districts with fewest; three trophies. These tests check the boards and routes are
// where a player can walk or steer, the timers leave a first-timer room on Normal and are fair on Hard, the new acts play
// as the HUD says, the art is painted and streams with its district, and the counts. By id, never by position.
import assert from 'node:assert/strict';
import { World, DT, NO_INPUT } from '../.checks/jade-game.js';
import { MISSIONS, MISSION, SIDE, PEOPLE, jobCounts } from '../.checks/jade-story.js';
import { newSave, TROPHIES, checkTrophies } from '../.checks/jade-save.js';
import { city, T, W, DISTRICTS, districtAt, passable } from '../.checks/jade-city.js';
import { field } from '../.checks/jade-nav.js';
import { GIG_DEFS, gigBoards, gigMission, startGig } from '../.checks/jade-gigs.js';
import { GIG20_DEFS } from '../.checks/jade-gigs20.js';
import { GIG23_DEFS } from '../.checks/jade-gigs23.js';
import { DROP_R, ACT_DUR, VERB } from '../.checks/jade-rounds.js';
import { FOOT, VEHICLES } from '../.checks/jade-move.js';
import { DIFF } from '../.checks/jade-diff.js';
import { FRAMES, ATLASES } from '../.checks/jade-art.js';
import { tierOf, ZONE_OF } from '../.checks/jade-load.js';
import { phoneStep } from '../.checks/jade-phone.js';
import { playMission, gigCases, contractSave } from './jade-bot.mjs';

let n = 0;
const test = (name, f) => { try { f(); n++; } catch (e) { console.error('FAILED:', name); throw e; } };
const c = city();
const LATER = DISTRICTS.slice(5);
const TALES = ['k45', 'k46', 'k47', 'k48', 'k49', 'k50', 'k51', 'k52'];
const TALE_D = { k45: 'arcade', k46: 'temple', k47: 'india', k48: 'glam', k49: 'changi', k50: 'jurong', k51: 'mandai', k52: 'islands' };
const all = new Set(DISTRICTS);
const NEW = new Set(GIG23_DEFS.map(g => g.id));
function done(seed = 3, o = {}) {
  const s = contractSave(seed, 1); s.settings.assist = o.assist ?? false; s.settings.diff = o.diff ?? 'normal';
  const w = new World(s, seed); w.quiet = true; w.talk = null; w.step(NO_INPUT, DT);
  return w;
}
const tileOf = ([x, y]) => [Math.floor(x / T), Math.floor(y / T)];
const settle = (w, s = 1) => { for (let i = 0; i < s / DT; i++) w.step(NO_INPUT, DT); };
const spotTile = sp => typeof sp === 'string' ? tileOf([c.places[sp].x, c.places[sp].y]) : sp;
const stepSpots = st => st.t === 'rounds' ? st.drops : st.t === 'collect' ? st.items : st.t === 'race' ? st.marks : st.t === 'torch' ? [...st.route, ...st.beasts.map(b => b.at)] : st.t === 'pickup' || st.t === 'goto' || st.t === 'bag' ? (st.at === 'here' ? [] : [st.at]) : st.t === 'deliver' ? [st.to] : st.t === 'paddle' ? [st.to] : st.t === 'chase' || st.t === 'tail' ? [st.from, ...st.route] : st.t === 'ride' && st.near ? [st.near] : [];
const stepCls = st => (st.t === 'race' && st.ride && st.ride !== 'foot') ? VEHICLES[st.ride].cls : st.t === 'paddle' ? VEHICLES.dragon.cls : st.t === 'ride' ? null : 'foot';

test('a second board in every district past Chinatown that had one; Little India two; earlier gigs unchanged, first', () => {
  assert.deepEqual(GIG_DEFS.slice(13, 13 + GIG20_DEFS.length).map(g => g.id), GIG20_DEFS.map(g => g.id));
  assert.deepEqual(GIG_DEFS.slice(13 + GIG20_DEFS.length).map(g => g.id), GIG23_DEFS.map(g => g.id), 'appended after the twentieth pass’s');
  assert.equal(new Set(GIG_DEFS.map(g => g.id)).size, GIG_DEFS.length, 'gig ids are unique');
  const before = d => GIG_DEFS.filter(g => g.d === d && !NEW.has(g.id)).length;
  // (Bukit Timah came in the twenty-second pass, built alongside this one, Kranji in the twenty-fourth, Punggol in the
  // twenty-fifth and Bishan in the twenty-sixth, each with its own first gig: not one of these)
  for (const d of ['temple', ...LATER].filter(d => d !== 'bukit' && d !== 'kranji' && d !== 'punggol' && d !== 'bishan')) {
    const now = GIG_DEFS.filter(g => g.d === d).length;
    if (d === 'india') assert.equal(now, before(d) + 2, 'Little India, the thinnest, gets two');
    else if (before(d) === 1) assert.equal(now, 2, `${d} had one gig and now has two`);
  }
  for (const g of GIG23_DEFS) {
    assert.ok(PEOPLE[g.giver], `${g.id}: ${g.giver} is a person`);
    assert.equal(c.places[g.giver]?.d ?? g.d, g.d, `${g.id}: ${g.giver} stands in ${g.d}`);
    const first = GIG_DEFS.find(o => o.d === g.d && !NEW.has(o.id));
    assert.notEqual(first?.kind, g.kind, `${g.id} plays differently from ${g.d}’s first gig`);
  }
});

test('each new board stands on open ground in its own district, a few steps from every other board', () => {
  const w = done(); const b = gigBoards(w);
  assert.equal(b.length, GIG_DEFS.length);
  for (const g of GIG23_DEFS) {
    const at = b.find(x => x.id === g.id); assert.ok(at, g.id);
    const [tx, ty] = tileOf([at.x, at.y]);
    assert.equal(districtAt(tx, ty), g.d, `${g.id} board is in ${g.d}`);
    assert.ok(passable(c, 'foot', tx, ty), `${g.id} board is on walkable ground`);
    for (const o of b) if (o.id !== g.id) assert.ok(Math.hypot(o.x - at.x, o.y - at.y) > 2.5 * T, `${g.id} and ${o.id} boards are apart`);
  }
});

test('every new gig builds; every stop is where its step is played, in the gig’s own district', () => {
  const w = done();
  for (const g of GIG23_DEFS) {
    const r = gigMission(w, g.id); assert.ok(r, g.id);
    assert.equal(r.d, g.d); assert.ok(r.reward >= 50 && r.reward <= 90, `${g.id} pays like a gig (${r.reward})`);
    for (const st of r.m.steps) for (const sp of stepSpots(st)) {
      const [tx, ty] = spotTile(sp), cls = stepCls(st);
      if (cls) assert.ok(passable(c, cls, tx, ty), `${g.id} ${st.t}: ${tx},${ty} is ${cls}-passable`);
      assert.equal(districtAt(tx, ty), g.d, `${g.id} ${st.t}: ${tx},${ty} is in ${g.d}`);
    }
  }
});

/** the shortest walk round a set of stops: nearest first from `from` (tiles), or in order */
function walk(from, stops, cls = 'foot', ordered = false) {
  let cur = from, left = stops.slice(), tot = 0;
  while (left.length) {
    const f = field(c, cls, cur[0], cur[1], all);
    let k = -1, bd = Infinity;
    left.forEach(([x, y], i) => { if (ordered && i > 0) return; const d = f.dist[y * W + x]; if (d >= 0 && d < bd) { bd = d; k = i; } });
    assert.ok(k >= 0, `stop ${left[0]} is reachable from ${cur} (${cls})`);
    tot += bd / 10; cur = left[k]; left.splice(k, 1);
  }
  return tot;
}
const speedOf = st => st.t === 'race' && st.ride && st.ride !== 'foot' ? VEHICLES[st.ride].speed : FOOT.run;
export function timerCheck(name, st, home) {
  const ordered = st.t === 'race' || st.t === 'torch';
  const stops = st.t === 'rounds' ? st.drops : st.t === 'collect' ? st.items : st.t === 'race' ? st.marks : st.route;
  const cls = st.t === 'race' ? stepCls(st) : 'foot';
  // the torch trail is crept, not run: at the creep speed
  const sp = st.t === 'torch' ? FOOT.sneak ?? FOOT.walk * 0.5 : speedOf(st);
  const run = walk(home, stops, cls, ordered) * T / sp, acts = st.t === 'rounds' ? stops.length * ACT_DUR[st.act] : 0;
  const normal = st.time * DIFF.normal.timer, hard = st.time * DIFF.hard.timer;
  if (process.env.PROBE) { const lo = Math.max((run * 1.3 + acts + 6) / DIFF.normal.timer, (run * 1.05 + acts + 2) / DIFF.hard.timer), hi = (run * 3 + acts + 30) / DIFF.normal.timer; console.log(name, st.t, 'run', run.toFixed(1), 'time', st.time, 'ok', lo.toFixed(0), '..', hi.toFixed(0)); return; }
  assert.ok(normal >= run * 1.3 + acts + 6, `${name}: Normal ${normal.toFixed(0)}s against a ${run.toFixed(0)}s run`);
  assert.ok(hard >= run * 1.05 + acts + 2, `${name}: Hard ${hard.toFixed(0)}s against a ${run.toFixed(0)}s run`);
  assert.ok(normal <= run * 3 + acts + 30, `${name}: not a stroll either (${normal.toFixed(0)}s against ${run.toFixed(0)}s)`);
}
test('the new gigs’ timers leave a first-timer room on Normal, and are tight but fair on Hard', () => {
  const w = done();
  for (const g of GIG23_DEFS) {
    const r = gigMission(w, g.id), b = gigBoards(w).find(x => x.id === g.id);
    let home = tileOf([b.x, b.y]);
    for (const st of r.m.steps) {
      if (st.t === 'ride' && st.near) home = spotTile(st.near);
      if (['rounds', 'collect', 'race', 'torch'].includes(st.t) && st.time) timerCheck(g.id, st, home);
    }
  }
});

test('the photo walk: nothing carried; E at a mural plays the camera pose and leaves the mural standing', () => {
  const w = done(4);
  const b = w.gigs().find(x => x.id === 'photo-walk'); w.placePlayer(b.x, b.y + 20);
  startGig(w, 'photo-walk'); settle(w, 0.2);
  const run = w.run; assert.equal(run.cur.t, 'rounds'); assert.equal(run.cur.act, 'photo');
  assert.equal(w.p.carry, null, 'the camera stays in a pocket'); assert.equal(run.progress, 'Photographed 0/5');
  assert.match(run.label, /Photograph each mural/);
  const it = run.items[0]; w.placePlayer(it.x, it.y + DROP_R * 0.6); w.step(NO_INPUT, DT);
  const nr = run.nearAction(w.p.x, w.p.y); assert.ok(nr && nr.id.startsWith('drop:')); assert.equal(nr.label, 'Photograph the mural');
  w.step(NO_INPUT, DT); assert.match(run.label, /^E: photograph the mural/);
  run.jobAct(nr.id); assert.equal(w.p.act?.n, 'photo', 'the camera pose plays');
  settle(w, 1.2); assert.ok(it.got); assert.equal(run.progress, 'Photographed 1/5');
  for (const x of run.items) if (!x.got) { w.placePlayer(x.x, x.y + 30); w.step(NO_INPUT, DT); run.jobAct(run.nearAction(w.p.x, w.p.y).id); settle(w, 1.2); }
  settle(w, 1); assert.equal(w.s.best['gig:photo-walk'], 1);
  for (const m of ['g23-mural-a', 'g23-mural-b', 'g23-mural-c']) { const fr = FRAMES[m]; assert.ok(fr, m); assert.equal(tierOf(ATLASES[fr[0]]), ZONE_OF.glam, `${m} streams with Kampong Glam`); }
});

test('the mangrove planting: carry the seedlings, E plays the planting pose (four painted frames) at each patch of mud', () => {
  const w = done(5);
  const b = w.gigs().find(x => x.id === 'mangroves'); w.placePlayer(b.x, b.y + 20);
  startGig(w, 'mangroves'); settle(w, 0.2);
  const run = w.run; assert.equal(run.cur.act, 'plant'); assert.equal(w.p.carry, 'g23-seedling');
  const it = run.items[0]; w.placePlayer(it.x, it.y + 30); w.step(NO_INPUT, DT);
  const nr = run.nearAction(w.p.x, w.p.y); assert.equal(nr.label, 'Plant the mangrove seedling');
  run.jobAct(nr.id); assert.equal(w.p.act?.n, 'plant'); assert.ok(w.p.act.dur >= ACT_DUR.plant - 1e-9);
  settle(w, 2); assert.ok(it.got);
  assert.equal(VERB.plant, 'Plant'); assert.equal(VERB.photo, 'Photograph');
  for (const h of ['dora', 'enzo']) for (let i = 0; i < 4; i++) {
    const fr = FRAMES[`${h}-plant-${i}`]; assert.ok(fr, `${h}-plant-${i}`);
    assert.equal(tierOf(ATLASES[fr[0]]), 'job', `${h}-plant-${i} is job art (every hero frame is core or job)`);
  }
});

/** every sprite a step shows: what is carried or chased, the townsfolk at the stops, a rival's or a quarry's body, the sights */
function spritesOf(st) {
  const out = [st.item, st.loot].filter(Boolean);
  if (st.t === 'rounds') { for (const who of st.who ?? []) out.push(`folk-${who}-down`); for (const s of st.sights ?? []) out.push(s); }
  if ((st.t === 'race' || st.t === 'tail' || st.t === 'chase') && st.skin) out.push(`${st.skin}-run-0`);
  if (st.t === 'bag' && st.skin) out.push(`${st.skin}-fly-0`);
  return out;
}
const okTier = (f, d) => { const t = tierOf(ATLASES[FRAMES[f][0]]); return t === 'core' || t === 'job' || t === ZONE_OF[d]; };
test('everything the new gigs and tales show is painted, in core or job art or its own district’s zone', () => {
  const w = done();
  for (const g of GIG23_DEFS) for (const st of gigMission(w, g.id).m.steps) for (const f of spritesOf(st)) {
    assert.ok(FRAMES[f], `${g.id}: ${f} is painted`); assert.ok(okTier(f, g.d), `${g.id}: ${f} (${tierOf(ATLASES[FRAMES[f][0]])}) loads in ${g.d}`);
  }
  for (const id of TALES) for (const st of MISSION[id].steps) for (const f of spritesOf(st)) {
    assert.ok(FRAMES[f], `${id}: ${f} is painted`); assert.ok(okTier(f, TALE_D[id]), `${id}: ${f} (${tierOf(ATLASES[FRAMES[f][0]])}) loads in ${TALE_D[id]}`);
  }
  const want = { 'g23-satay': 'quay', 'g23-seedling': 'pulau', 'g23-cup': 'kallang', 'g23-flotsam': 'islands', 'g23-tiffin': 'islands' };
  for (const [f, d] of Object.entries(want)) assert.equal(tierOf(ATLASES[FRAMES[f][0]]), ZONE_OF[d], `${f} streams with ${d}`);
});

test('eight more Hawker Tales, k45 to k52, for the districts with fewest; each opens after its giver’s last story job', () => {
  assert.deepEqual(SIDE.slice(SIDE.findIndex(m => m.id === 'k45')).slice(0, 8).map(m => m.id), TALES);
  for (const id of TALES) {
    const m = MISSION[id]; assert.equal(c.places[m.at].d, TALE_D[id], `${id} is in ${TALE_D[id]}`);
    assert.equal(m.ch, 0);
    // after the giver's last story job; or, where later story jobs are offered at the same spot (Master Ren's and Madame
    // Glint's at Gizmo's, m24 and m25), after the last of those, so the tale never stands on a story job's spot
    const mine = MISSIONS.filter(x => x.giver === m.giver).map(x => x.id), here = MISSIONS.filter(x => x.at === m.at).map(x => x.id);
    const want = [mine[mine.length - 1], here[here.length - 1]].filter(Boolean).sort((a, b) => MISSIONS.findIndex(x => x.id === a) - MISSIONS.findIndex(x => x.id === b)).pop();
    assert.equal(m.side, want, `${id} opens after ${m.giver}’s last story job (and any later one at its spot)`);
    assert.ok(m.reward >= 250 && m.reward <= 350);
    assert.ok(m.steps.some(st => st.cp), `${id} has a checkpoint`);
    assert.doesNotMatch(m.blurb + m.steps.map(s => (s.label ?? '') + JSON.stringify(s.lines ?? '')).join(' '), /finale|the end\b|ending|farewell|goodbye/i, `${id} is a tale, not an ending`);
    for (const st of m.steps) for (const sp of stepSpots(st)) {
      const [tx, ty] = spotTile(typeof sp === 'string' ? sp : MISSION[id] && sp), cls = stepCls(st);
      if (cls && st.t !== 'tail' && st.t !== 'chase') assert.ok(passable(c, cls, tx, ty), `${id} ${st.t}: ${tx},${ty} is ${cls}-passable`);
      assert.equal(districtAt(tx, ty), TALE_D[id], `${id} ${st.t}: ${tx},${ty} is in ${TALE_D[id]}`);
    }
  }
  const tales = d => SIDE.filter(m => c.places[m.at]?.d === d).length;
  for (const d of ['arcade', 'mandai', 'islands']) assert.ok(tales(d) >= 1, `${d} has a tale`);
  assert.equal(jobCounts(newSave()).talesAll, SIDE.length);
});

test('three trophies for the new gigs, nothing like a finale', () => {
  const ids = ['second-helpings', 'look-plant-count', 'four-rivals'];
  for (const id of ids) assert.ok(TROPHIES.some(t => t.id === id), id);
  assert.equal(new Set(TROPHIES.map(t => t.id)).size, TROPHIES.length);
  for (const t of TROPHIES.filter(t => ids.includes(t.id))) assert.doesNotMatch(t.name + t.desc, /finale|the end\b|ending/i);
  const s = contractSave(1, 1);
  const names = ['Second Helpings', 'Look, Plant, Count', 'Four Rivals'];
  assert.equal(checkTrophies(s).filter(n => names.includes(n)).length, 0);
  for (const id of ['photo-walk', 'mangroves', 'night-count']) s.best['gig:' + id] = 1;
  assert.ok(checkTrophies(s).includes('Look, Plant, Count'));
  for (const id of ['lion-dash', 'tekka-sprint', 'siloso-run', 'pagoda-run']) s.best['gig:' + id] = 1;
  assert.ok(checkTrophies(s).includes('Four Rivals'));
  for (const g of GIG23_DEFS) s.best['gig:' + g.id] = 1;
  assert.ok(checkTrophies(s).includes('Second Helpings'));
});

test('the second boards’ givers text about them too, once the first boards have been played', () => {
  const w = done(8);
  for (const g of GIG20_DEFS) w.s.best['gig:' + g.id] = 1;
  w.s.msgs = []; w.tick = 30; phoneStep(w);
  const gig = w.s.msgs.filter(m => m.gig); assert.equal(gig.length, 1);
  const g = GIG23_DEFS.find(x => x.id === gig[0].gig); assert.ok(g, 'a second board’s gig'); assert.equal(gig[0].from, g.giver);
  assert.ok(w.gigs().some(b => b.id === g.id), 'its board is up (the text’s Route me goes there)');
});

test('a chase thief pinned head-on against a round front (not on the tile grid) moves on to its next waypoint', () => {
  // k45 used to run the crow straight down the alley into the karaoke front, dead centre: the slide had no side to take,
  // a looping route had no pinned escape, and the crow stood there for good
  const w = done(5); w.startMission(MISSION.k45); w.talk = null;
  const i = MISSION.k45.steps.findIndex(st => st.t === 'chase'); w.run.snap = w.run.snapshot(i); w.run.enter(i); w.talk = null;
  assert.equal(w.run?.cur?.t, 'chase');
  const run = w.run, a = run.actors[0], o = (w.obs[29 * W + 205] ?? []).find(q => Math.round(q.y) === 1894 && Math.round(q.x) === 13152);
  assert.ok(o, 'the karaoke front sits at the foot of the alley');
  a.route = [[13152, 1632], [13152, 2592], [12064, 2592], [12128, 1632]]; a.wp = 1; a.b.x = 13152; a.b.y = 1780; a.b.speed = 0; a.stun = 0;
  for (let i = 0; i < 8 / DT; i++) { w.placePlayer(a.b.x, a.b.y - 160); run.meter.v = 0; run.grace = 1; w.step(NO_INPUT, DT); if (!w.run) break; }
  assert.ok(w.run, 'the chase is still on');
  assert.ok(a.wp !== 1 || Math.hypot(a.b.x - 13152, a.b.y - 1852) > 64, `the crow got past the front (wp ${a.wp} at ${Math.round(a.b.x)},${Math.round(a.b.y)})`);
});

if (!process.env.J23_FAST) test('first-timer play: the bot clears each new gig and tale on Normal reading the HUD, and on Hard', () => {
  for (const [label, , opts] of gigCases(GIG23_DEFS)) {
    const r = playMission(label, 'normal', 61, { ...opts(contractSave(61, 1)), assist: false, diff: 'normal' });
    assert.ok(r.won, `${label} on Normal: ${JSON.stringify(r)}`);
    const h = playMission(label, 'normal', 91, { ...opts(contractSave(91, 1)), assist: false, diff: 'hard' });
    assert.ok(h.won, `${label} on Hard: ${JSON.stringify(h)}`);
  }
  for (const id of TALES) {
    const r = playMission(id, 'normal', 61, { assist: false, diff: 'normal' }); assert.ok(r.won, `${id} on Normal: ${JSON.stringify(r)}`);
    const h = playMission(id, 'normal', 91, { assist: false, diff: 'hard' }); assert.ok(h.won, `${id} on Hard: ${JSON.stringify(h)}`);
  }
});
console.log(`jade-twentythree: ${n} passed`);
