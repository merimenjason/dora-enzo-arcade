// Jade Street, the tenth pass: the Chinatown empire. Twenty-six properties (placed on clear pavement, reachable,
// painted at four levels), buying and upgrading, nightly takings and the ledger, raids (the alert, the clock, each kind
// of raid job built for every property and played through by the bot, a missed raid's lost takings or damage, repairs,
// the jaga, the partner's round of the tills and the partner seeing off a raid), the empire jobs, the ranks and their
// trophies, the v10 → v11 save migration, and the pacing: a careful player owns everything in three to five hours.
import assert from 'node:assert/strict';
import { World, DT, NO_INPUT } from '../.checks/jade-game.js';
import { city, T, W, S, districtAt } from '../.checks/jade-city.js';
import { field } from '../.checks/jade-nav.js';
import { MISSIONS, SIDE, PEOPLE, jobCounts } from '../.checks/jade-story.js';
import { newSave, loadSave, SAVE_KEY, OLD_KEYS, SAVE_VERSION, TROPHIES, checkTrophies } from '../.checks/jade-save.js';
import { BIZ, BIZ_OF, STALL_IDS, bizPos, bizRate, buyBiz, upgradeBiz, accrue, closeNight, owned, RANKS, rankOf, empireValue, EMPIRE_COST, paidFor, bizSprite } from '../.checks/jade-biz.js';
import { PROPS, RAID_GANG } from '../.checks/jade-props.js';
import { EMP, startRaidAlert, raidJob, missRaid, repairCost, jagaCost, sendRound, sendDefend, jobsAt, startEmpireJob, empireJob, ledger, RAID_KINDS, trapPlan, chaseLoop, gangOf, repairBiz, hireJaga } from '../.checks/jade-empire.js';
import { EMPIRE_JOBS, EMPIRE_JOB_IDS } from '../.checks/jade-empjobs.js';
import { FRAMES } from '../.checks/jade-art.js';
import { playMission } from './jade-bot.mjs';

let n = 0;
const test = (name, fn) => { try { fn(); n++; } catch (e) { console.error('FAILED:', name); throw e; } };
const c = city();
const ALL = ['market', 'temple', 'canal', 'docks', 'arcade', 'heartland', 'bay', 'india', 'glam', 'resort', 'orchard', 'katong', 'changi', 'tiong', 'quay', 'jurong', 'pulau', 'kallang', 'mandai', 'islands', 'bukit', 'kranji'];
/** a save that has finished the story, with reputation everywhere and coins to spend */
function rich(seed = 5, o = {}) {
  const s = newSave(seed); s.started = true; s.story.intro = true; s.done = [...MISSIONS.map(m => m.id), ...SIDE.map(m => m.id)];
  for (const d of ALL) s.rep[d] = o.rep ?? 60; s.cash = o.cash ?? 200000; s.settings.assist = o.assist ?? true; s.settings.diff = o.diff ?? 'easy';
  return s;
}
const world = (s, seed = 9) => { const w = new World(s, seed); w.quiet = true; return w; };
const idle = (w, sec) => { for (let i = 0; i < sec * 60; i++) w.step(NO_INPUT, DT); };

test('forty-four properties in every district: on clear pavement, reachable on foot, apart, and painted at four levels', () => {
  assert.equal(BIZ.length, 56); assert.equal(PROPS.length, 45);
  const ids = new Set(BIZ.map(b => b.id)); assert.equal(ids.size, BIZ.length, 'ids are unique');
  for (const d of ALL) assert.ok(BIZ.some(b => b.d === d), `a property in ${d}`);
  const sm = c.places['safe-market']; const f = field(c, 'foot', Math.floor(sm.x / T), Math.floor(sm.y / T), new Set(ALL));
  // Pulau Ubin is over the strait (the bumboat): its properties are walked to from its jetty
  const uj = c.places['jetty-ubin'], fu = field(c, 'foot', Math.floor(uj.x / T), Math.floor(uj.y / T), new Set(ALL));
  // (and the Southern Islands' from St John's jetty, where the island ferry lands)
  const ij = c.places['isl-jetty'], fi = field(c, 'foot', Math.floor(ij.x / T), Math.floor(ij.y / T), new Set(ALL));
  for (const b of PROPS) {
    assert.equal(districtAt(b.at[0], b.at[1]), b.d, `${b.id} stands in ${b.d}`);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) assert.equal(c.solid[(b.at[1] + dy) * W + b.at[0] + dx], S.OPEN, `${b.id} on open ground`);
    assert.ok(f.dist[b.at[1] * W + b.at[0]] >= 0 || fu.dist[b.at[1] * W + b.at[0]] >= 0 || fi.dist[b.at[1] * W + b.at[0]] >= 0, `${b.id}: you can walk to it`);
    assert.ok(PEOPLE[b.keeper], `${b.id} has a keeper`);
    for (const o of BIZ) if (o !== b) assert.ok(Math.hypot(o.at[0] - b.at[0], o.at[1] - b.at[1]) >= 3, `${b.id} and ${o.id} apart`);
    for (const p of Object.values(c.places)) assert.ok(Math.hypot(p.x / T - b.at[0] - 0.5, p.y / T - b.at[1] - 0.5) >= 2.5, `${b.id} clear of a place`);
  }
  for (const b of BIZ) { assert.ok(b.up[0] < b.up[1] && b.income[1] < b.income[2] && b.income[2] < b.income[3], b.id); for (let l = 0; l <= 3; l++) assert.ok(FRAMES[bizSprite(b.id, l)], `${b.id} level ${l} painted`); }
});

test('buying, upgrading and takings: three levels, a till that fills through the night, the ledger', () => {
  const s = rich(); const w = world(s); const cash = s.cash;
  assert.equal(w.buyBiz('kopitiam'), null); assert.equal(s.biz.kopitiam.lvl, 1); assert.equal(s.cash, cash - BIZ_OF.kopitiam.price);
  assert.equal(w.upgradeBiz('kopitiam'), null); assert.equal(w.upgradeBiz('kopitiam'), null); assert.equal(s.biz.kopitiam.lvl, 3); assert.match(w.upgradeBiz('kopitiam'), /Fully/);
  assert.equal(s.cash, cash - paidFor('kopitiam', 3));
  const r = bizRate(s, 'kopitiam', [...w.open]).rate; assert.ok(r > BIZ_OF.kopitiam.income[3] * 0.8, 'level 3 takings');
  const rn = bizRate(s, 'kopitiam', [...w.open], { daily: w.event, festival: w.festival }).rate; accrue(w, 360); assert.ok(Math.abs(s.biz.kopitiam.bank - rn / 2) < 2, 'half a night, half the takings');
  closeNight(s); assert.equal(s.biz.kopitiam.hist.length, 1);
  const L = ledger(w); assert.equal(L.mine, 1); assert.equal(L.all, 56); assert.ok(L.till > 0 && L.tonight > 0);
  assert.ok(w.collectBiz('kopitiam') >= Math.floor(rn / 2) - 1);
  // reputation gates the sale; fog gates the district
  const s2 = rich(6, { rep: 0 }); const w2 = world(s2); assert.match(w2.buyBiz('taxi') ?? '', /reputation/);
  const s3 = newSave(3); s3.cash = 99999; const w3 = world(s3); assert.match(w3.buyBiz('beachbar') ?? '', /fog/);
});

test('ranks: Street Stall, Kopi Boss, Shophouse Tycoon and Island Taipan by what you put in, with a card and a trophy each', () => {
  assert.deepEqual(RANKS.map(r => r.name), ['Nobody yet', 'Street Stall', 'Kopi Boss', 'Shophouse Tycoon', 'Island Taipan']);
  const s = rich(); const w = world(s);
  assert.equal(rankOf(s), 0); w.buyBiz('kopi'); w.step(NO_INPUT, DT); assert.equal(rankOf(s), 1); assert.equal(s.empire.rank, 1);
  for (const id of ['jade', 'claw', 'fan', 'tea']) { w.buyBiz(id); w.upgradeBiz(id); }
  assert.ok(empireValue(s) >= RANKS[2].need); const fx = []; w.step(NO_INPUT, DT); fx.push(...w.drain()); assert.equal(s.empire.rank, 2); assert.ok(fx.some(f => f.t === 'rank-up' && f.k === 2), 'a rank-up card');
  checkTrophies(s); assert.ok(s.trophies.includes('kopi-boss'));
  for (const b of BIZ) { s.biz[b.id].lvl = 3; } assert.equal(empireValue(s), EMPIRE_COST); assert.equal(rankOf(s), 4);
  checkTrophies(s); for (const t of ['taipan', 'full-house', 'tycoon-sh', 'magnate', 'stake']) assert.ok(s.trophies.includes(t), t);
  // Taipan needs a property in every district, whatever the value
  const s2 = rich(); for (const b of BIZ) if (b.d !== 'resort') s2.biz[b.id].lvl = 3; assert.ok(empireValue(s2) >= RANKS[4].need); assert.equal(rankOf(s2), 3);
  // the Taipan's perk: 10% more everywhere
  const s3 = rich(); s3.biz.kopi.lvl = 2; const before = bizRate(s3, 'kopi', ALL).rate; s3.empire.rank = 4; assert.ok(bizRate(s3, 'kopi', ALL).rate > before * 1.08);
  assert.ok(TROPHIES.length >= 42); assert.ok(STALL_IDS.length === 11); // 42 trophies in the tenth pass; the eleventh adds three
});

test('raids: the raid hours, an alert with a text, a pin and a clock; get there in time and the job starts', () => {
  const s = rich(); const w = world(s); w.buyBiz('noodle'); s.biz.noodle.bank = 300;
  let raids = 0; for (let night = 1; night <= 60; night++) { s.night = night; w.emp.raid = null; s.clock = 239; w.clock(2); if (w.emp.raid) raids++; s.clock = 479; w.emp.raid = null; w.clock(2); if (w.emp.raid) raids++; }
  assert.ok(raids > 15 && raids < 60, `raids now and then (${raids} in 60 nights)`);
  w.emp.raid = null; s.clock = 100; w.clock(2); assert.equal(w.emp.raid, null, 'only at the raid hours');
  w.emp.off = true; let quiet = true; for (let night = 1; night <= 30; night++) { s.night = night; w.emp.raid = null; s.clock = 239; w.clock(2); if (w.emp.raid) quiet = false; } assert.ok(quiet, 'switched off for the browser tests'); w.emp.off = false; w.emp.raid = null;
  // a raid needs coins in the till
  s.biz.noodle.bank = 5; let none = true; for (let night = 1; night <= 30; night++) { s.night = night; s.clock = 239; w.clock(2); if (w.emp.raid) none = false; } assert.ok(none);
  s.biz.noodle.bank = 300; startRaidAlert(w, 'noodle'); const fx = w.drain();
  assert.ok(fx.some(f => f.t === 'raid-alert'), 'the alert'); assert.ok(s.msgs.some(m => /raiding/.test(m.text)), 'a text from the keeper');
  assert.deepEqual(w.objective(), bizPos(BIZ_OF.noodle), 'the route line leads there');
  const [bx, by] = bizPos(BIZ_OF.noodle); w.placePlayer(bx, by + 2 * T); w.step(NO_INPUT, DT);
  assert.ok(w.run && w.run.m.id === 'raid-noodle', 'arriving starts the raid job'); assert.equal(w.emp.raid, null);
});

test('a missed raid costs that night’s takings, or leaves the place damaged until repaired; never lost for good', () => {
  const s = rich(); const w = world(s); w.buyBiz('tea'); s.biz.tea.bank = 400; s.biz.tea.tonight = 150;
  startRaidAlert(w, 'tea'); idle(w, (w.assist ? EMP.windowAssist : EMP.window) + 2);
  assert.equal(w.emp.raid, null); assert.equal(s.biz.tea.missed, 1); assert.equal(s.stats.raidsMissed, 1); assert.equal(s.biz.tea.lvl, 1, 'still yours');
  assert.ok(s.biz.tea.bank < 400 && s.biz.tea.bank >= 250, `lost that night’s takings (${s.biz.tea.bank})`);
  // at level 2 and up, some misses damage the place: no takings until repaired
  let dmg = 0; s.biz.tea.lvl = 2; for (let k = 0; k < 30; k++) { s.biz.tea.dmg = 0; s.biz.tea.bank = 400; missRaid(w, 'tea'); if (s.biz.tea.dmg) dmg++; }
  assert.ok(dmg > 4 && dmg < 26, `damaged ${dmg} times in 30`);
  s.biz.tea.dmg = 1; assert.equal(bizRate(s, 'tea', ALL).rate, 0, 'a damaged place takes nothing');
  s.biz.tea.bank = 300; idle(w, 20); assert.equal(Math.floor(s.biz.tea.bank), 300, 'a smashed shop keeps the coins already in its till');
  const cash = s.cash; assert.equal(repairBiz(w, 'tea'), null); assert.equal(s.cash, cash - repairCost('tea')); assert.equal(s.biz.tea.dmg, 0); assert.equal(w.p.act?.n, 'repair');
  assert.ok(bizRate(s, 'tea', ALL).rate > 0); assert.equal(s.stats.repairs, 1);
});

test('the jaga: from Shophouse Tycoon; halves a missed raid, never lets it be damaged, and sees off raiders in a stand', () => {
  const s = rich(); const w = world(s); w.buyBiz('satay');
  assert.match(hireJaga(w, 'satay') ?? '', /Tycoon/);
  s.empire.rank = 3; const cash = s.cash; assert.equal(hireJaga(w, 'satay'), null); assert.equal(s.cash, cash - jagaCost('satay')); assert.ok(s.biz.satay.jaga);
  s.biz.satay.lvl = 3; for (let k = 0; k < 20; k++) { s.biz.satay.bank = 400; s.biz.satay.tonight = 200; missRaid(w, 'satay'); assert.equal(s.biz.satay.dmg, 0); assert.ok(s.biz.satay.bank >= 300, 'only half the night'); }
  // in a stand at the shop he patrols, notices the gang and shoos them
  w.startMission(raidJob(w, 'satay', 'defend', 'mac'), { key: 'raid:satay', reward: 40, d: 'market' });
  let shooed = 0, states = new Set();
  for (let i = 0; i < 60 * 40 && w.run; i++) { const f0 = w.fx.length; w.step(NO_INPUT, DT); if (w.emp.jaga) states.add(w.emp.jaga.mind.st); shooed += w.fx.slice(f0).filter(f => f.t === 'shoo').length; }
  assert.ok(states.has('patrol') && states.has('sus') && states.has('alert'), `his states: ${[...states]}`); assert.ok(shooed >= 2, `he saw off ${shooed}`);
});

test('every raid job, for every property and every kind its gang brings, is built on open, reachable ground', () => {
  const s = rich(); const w = world(s); const open = w.open;
  for (const b of BIZ) for (const kind of RAID_KINDS[gangOf(b.id)]) {
    const m = raidJob(w, b.id, kind, gangOf(b.id)); const st = m.steps[0];
    const spots = st.t === 'trap' ? [...st.spots, st.bait, st.wait, ...st.path] : st.t === 'chase' ? [st.from, ...st.route] : [st.at];
    for (const sp of spots) { const [tx, ty] = sp; assert.ok(open.has(districtAt(tx, ty)), `${b.id} ${kind}: ${sp} in an open district`); assert.notEqual(c.solid[ty * W + tx], S.BUILDING, `${b.id} ${kind}: ${sp} not in a building`); }
    if (kind === 'trap') assert.ok(trapPlan(w, ...bizPos(b)), `${b.id} has a way in for a trap`);
  }
});

test('the bot sees off a raid of every kind (defend, trap, chase and the crows’ grab), arriving in time', () => {
  for (const [id, kind] of [['noodle', 'defend'], ['fan', 'trap'], ['taxi', 'chase'], ['claw', 'grab'], ['prata', 'defend'], ['kayak', 'chase'], ['rooftop', 'trap']]) {
    const s = rich(11); s.biz[id].lvl = 1; s.biz[id].bank = 200; s.safe = `safe-${BIZ_OF[id].d}`; if (!['market', 'temple', 'canal', 'docks', 'arcade', 'heartland', 'bay', 'india', 'glam', 'resort'].includes(BIZ_OF[id].d)) s.safe = 'safe-market';
    const r = playMission('raid-' + id, 'casual', 2, { save: s, setup: w => { startRaidAlert(w, id); w.emp.raid.kind = kind; w.emp.raid.t = 600; }, done: w => s.stats.raidsWon > 0, lost: w => s.stats.raidsMissed > 0, maxT: 600 });
    assert.ok(r.won, `${id} ${kind}: ${JSON.stringify(r)}`);
    assert.equal(s.biz[id].defended, 1);
  }
});

test('the partner: a round of the tills (from Kopi Boss) and seeing off a raid alone', () => {
  const s = rich(); const w = world(s); for (const id of ['noodle', 'cake', 'kopi']) { w.buyBiz(id); s.biz[id].bank = 100; }
  assert.match(sendRound(w) ?? '', /Kopi Boss/); s.empire.rank = 2;
  const cash = s.cash; assert.equal(sendRound(w), null); assert.ok(w.emp.round);
  idle(w, 120); assert.equal(w.emp.round, null, 'back from the round'); assert.ok(s.cash >= cash + 300 && s.cash < cash + 340, 'every till handed over');
  for (const id of ['noodle', 'cake', 'kopi']) assert.ok(s.biz[id].bank < 50, 'emptied (a little has come in since)');
  assert.equal(s.stats.rounds, 1);
  // a raid: send the partner; more often than not they win it
  let won = 0;
  for (let k = 0; k < 12; k++) { s.night = 10 + k; s.clock = 10; s.biz.noodle.bank = 200; s.biz.noodle.lvl = 2; startRaidAlert(w, 'noodle'); assert.equal(sendDefend(w), null); idle(w, 90); if (w.emp.round) idle(w, 120); assert.equal(w.emp.raid, null); }
  won = s.stats.raidsWon; assert.ok(won >= 6 && won < 12, `the partner won ${won} of 12`);
  assert.equal(s.biz.noodle.dmg, 0, 'never damaged when the partner went');
  // a job starting ends the round at once, with the coins so far
  s.biz.cake.bank = 80; sendRound(w); w.startMission(empireJob(w, 'supplier', 'cake'), { key: 'emp:supplier:cake', reward: 120, d: 'market' }); w.talk = null; w.step(NO_INPUT, DT); assert.equal(w.emp.round, null);
});

test('empire jobs: offered by the right properties once a night, each completable by the bot, with a takings boost', () => {
  assert.equal(EMPIRE_JOBS.length, 6); assert.deepEqual(EMPIRE_JOB_IDS, ['supplier', 'inspector', 'pricewar', 'taxi', 'tour', 'karaoke']);
  const s = rich(); const w = world(s); w.buyBiz('kopitiam'); s.empire.rank = 2;
  assert.deepEqual(jobsAt(w, 'kopitiam').map(j => j.id), ['supplier', 'inspector', 'pricewar']);
  for (const [job, id] of [['supplier', 'chicken'], ['inspector', 'prata'], ['pricewar', 'textile'], ['taxi', 'taxi'], ['tour', 'bumboat'], ['tour', 'kayak'], ['karaoke', 'karaoke']]) {
    const s2 = rich(13); s2.biz[id].lvl = 1; s2.empire.rank = 2; s2.safe = `safe-${BIZ_OF[id].d}`;
    const r = playMission('emp-' + job, 'casual', 3, { save: s2, setup: w => { w.placePlayer(...bizPos(BIZ_OF[id])); assert.equal(startEmpireJob(w, job, id), null); }, done: w => (s2.empire.jobs[job] ?? 0) > 0, maxT: 700 });
    assert.ok(r.won, `${job} at ${id}: ${JSON.stringify(r)}`);
    assert.ok(s2.biz[id].boost > 0 && s2.biz[id].boostK > 1, 'a takings boost'); assert.equal(s2.empire.last[job], s2.night);
    const w2 = world(s2); assert.ok(!jobsAt(w2, id).some(j => j.id === job), 'once a night');
    if (job === 'inspector') assert.equal(s2.stats.gradeA, 1);
  }
  // the boost wears off night by night
  const s3 = rich(); s3.biz.kopi.lvl = 1; s3.biz.kopi.boost = 1; s3.biz.kopi.boostK = 1.3; const hi = bizRate(s3, 'kopi', ALL).rate; closeNight(s3); assert.equal(s3.biz.kopi.boost, 0); assert.ok(bizRate(s3, 'kopi', ALL).rate < hi);
  // jobCounts counts the kinds of empire job done
  const n0 = jobCounts(s); assert.equal(n0.empireAll, 6); assert.equal(n0.empire, 0); s.empire.jobs.taxi = 2; assert.equal(jobCounts(s).empire, 1);
});

test('save v11: a v10 save keeps every job, medal, stall, safe house and till; the empire starts fresh, its rank marked seen', () => {
  assert.ok(SAVE_KEY === 'jade-street-v11' || OLD_KEYS.includes('jade-street-v11')); assert.ok(OLD_KEYS.includes('jade-street-v10'));
  const v10 = { v: 10, seed: 77, cash: 4321, night: 12, done: ['m1', 'm2', 'm3', 'k1'], medals: { m1: { m: 3, t: 50, plays: 2 } }, rep: { market: 44, temple: 20 },
    biz: { noodle: { lvl: 3, bank: 120.5, tonight: 10, hist: [100, 90], raids: 2, defended: 1 }, kopi: { lvl: 1, bank: 3, tonight: 0, hist: [], raids: 0, defended: 0 } },
    best: { 'house:safe-temple': 1 }, stats: { mynahs: 4, cable: 2 }, trophies: ['first-job', 'stake'], settings: { partner: 'tag', assist: false } };
  const s = loadSave(JSON.stringify(v10));
  assert.equal(s.v, SAVE_VERSION); assert.equal(s.cash, 4321); assert.deepEqual(s.done, v10.done); assert.equal(s.medals.m1.m, 3); assert.equal(s.rep.market, 44);
  assert.equal(s.biz.noodle.lvl, 3); assert.equal(s.biz.noodle.bank, 120.5); assert.deepEqual(s.biz.noodle.hist, [100, 90]); assert.equal(s.biz.kopi.lvl, 1);
  assert.equal(s.biz.noodle.dmg, 0); assert.equal(s.biz.noodle.jaga, false); assert.equal(s.biz.kopitiam.lvl, 0, 'new properties start for sale');
  assert.ok(s.best['house:safe-temple'] === 1, 'the safe house you bought'); assert.equal(s.stats.mynahs, 4); assert.equal(s.stats.raidsWon, 0);
  assert.equal(s.settings.partner, 'tag'); assert.deepEqual(s.trophies, ['first-job', 'stake']);
  assert.equal(s.empire.rank, rankOf(s), 'the rank you already hold is seen (no card)');
  // a v11 save round-trips, damage, jaga and boosts included
  s.biz.noodle.dmg = 1; s.biz.noodle.jaga = true; s.biz.kopi.boost = 2; s.biz.kopi.boostK = 1.25; s.empire.jobs.taxi = 3; s.empire.last.taxi = 12;
  const back = loadSave(JSON.stringify(s)); assert.deepEqual(back.biz.noodle, s.biz.noodle); assert.deepEqual(back.biz.kopi, s.biz.kopi); assert.deepEqual(back.empire, s.empire);
  // and older saves still come forward through every step
  const v3 = loadSave(JSON.stringify({ v: 3, seed: 2, cash: 50, done: ['m1'], rep: { market: 5 } })); assert.equal(v3.v, SAVE_VERSION); assert.deepEqual(v3.done, ['m1']); assert.equal(v3.empire.rank, 0);
});

test('pacing: a careful player who reinvests owns everything in three to five hours of play (the coast’s six and the west side’s six included)', () => {
  // a careful player: about 45 coins a minute from jobs, gigs and trading, a night every 14 minutes on Assist, every
  // till collected each night, reputation around 50 (×1.0), one night's takings in ten lost to raids; buys whatever
  // pays back soonest as soon as they can
  const sim = (A, nightMin) => {
    let cash = 0, t = 0, since = 0; const lvl = Object.fromEntries(BIZ.map(b => [b.id, 0]));
    const cost = b => lvl[b.id] === 0 ? b.price : b.up[lvl[b.id] - 1], gain = b => b.income[lvl[b.id] + 1] - b.income[lvl[b.id]];
    while (BIZ.some(b => lvl[b.id] < 3) && t < 1200) {
      t++; cash += A; since++;
      if (since >= nightMin) { since = 0; cash += BIZ.reduce((a, b) => a + b.income[lvl[b.id]], 0) * 0.9; }
      for (;;) { const c = BIZ.filter(b => lvl[b.id] < 3).sort((a, b) => cost(a) / gain(a) - cost(b) / gain(b))[0]; if (!c || cash < cost(c)) break; cash -= cost(c); lvl[c.id]++; }
    }
    return t;
  };
  const night = 720 / 0.85 / 60;
  // (the slowest earner gets five and a half hours since the seventeenth pass's three Ubin properties; the eighteenth pass's three in Kallang bring the whole empire past 200,000)
  for (const [A, lo, hi] of [[45, 180, 300], [30, 180, 330], [60, 170, 300]]) { const m = sim(A, night); assert.ok(m >= lo && m <= hi, `${A} coins a minute: everything in ${(m / 60).toFixed(1)} h`); }
  // (the twenty-first pass's three on the Southern Islands bring it past 220,000, and Bukit Timah's and Kranji's threes
  // past 250,000; the hours above still hold)
  assert.ok(EMPIRE_COST > 120000 && EMPIRE_COST < 280000, `the whole empire costs ${EMPIRE_COST}`);
});

test('discoverability: properties for sale say their price at the door; a hint once one is affordable; the empire tab’s pins', () => {
  const s = rich(); const w = world(s); const b = BIZ_OF.prata; const [x, y] = bizPos(b); w.placePlayer(x, y + 40); w.step(NO_INPUT, DT);
  assert.equal(w.near?.kind, 'biz'); assert.match(w.near.label, /for sale: 1,350 coins/);
  const s2 = newSave(4); s2.started = true; s2.story.intro = true; s2.done = ['m1']; s2.rep.market = 30; s2.cash = 600; const w2 = world(s2); const hints = [];
  for (let i = 0; i < 400; i++) { w2.step(NO_INPUT, DT); hints.push(...w2.drain().filter(f => f.t === 'hint')); }
  assert.ok(hints.some(h => /afford a stake/.test(h.msg)), 'a hint'); assert.ok(s2.learned.includes('empire'));
});

console.log(`jade (tenth pass, the empire): ${n} tests ok`);
await import('./jade-proc.mjs');
