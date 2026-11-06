// Snow Day League engine checks: a seed replays a match exactly (shouts included), the counter wheel's mechanics
// (builders' walls stop throws, scouts lob over them, diggers bury, counter-hit and beat scouts, throwers out-range
// diggers), the kick-off formation and the result screen's stats (blocks knocked out, saves, the fort trace), shouts
// (once a half, they change what the team does), the flag falling and time-up, draft legality (five picks each, no
// banned or doubled card), the week's jobs, the season's shape (round robin, semis, final), the rollover between
// seasons, the photo wall and players' looks, and the save. Run after compiling the engine into .checks/ (`npx tsc lib/league-game.ts --target es2022
// --module es2022 --moduleResolution bundler --outDir .checks --skipLibCheck`).
import assert from 'node:assert/strict';
import * as G from '../.checks/league-game.js';

let pass = 0;
const ok = (msg) => { pass++; console.log('PASS', msg); };
const P = (role, i, side, o = {}) => ({ id: `${side}-${i}`, name: `P${side}${i}`, species: 'vizcacha', role, aim: 6, speed: 6, grit: 6, personality: 'steady', age: 4, morale: 65, games: 0, kos: 0, mvps: 0, ...o });
const team = (roles, side) => roles.map((r, i) => P(r, i, side));
const mono = (role, side) => team([role, role, role, 'medic', role], side);
const play = (opts, each) => { const m = new G.Match(opts); while (!m.over) { m.step(); each?.(m); } return m; };

// ---- determinism
{
  const lineups = [team(['thrower', 'digger', 'builder', 'scout', 'medic'], 0), team(['scout', 'scout', 'digger', 'builder', 'medic'], 1)];
  const a = play({ seed: 42, lineups, weather: 'wind', wind: -1 }), b = play({ seed: 42, lineups, weather: 'wind', wind: -1 });
  assert.equal(a.t, b.t); assert.equal(a.winner, b.winner);
  assert.deepEqual(a.forts[0].blocks, b.forts[0].blocks); assert.deepEqual(a.log, b.log);
  // a live shout is recorded, and replaying with the recorded shouts gives the same match
  const c = new G.Match({ seed: 9, lineups }); while (c.t < 300) c.step(); assert.ok(c.shout(0, 'attack')); while (!c.over) c.step();
  const d = play({ seed: 9, lineups, shouts: [...c.applied] });
  assert.equal(d.t, c.t); assert.deepEqual(d.forts, c.forts); assert.equal(d.winner, c.winner);
  ok('a seed (and its recorded shouts) replays a match exactly');
}

// ---- the counter wheel
{
  const duel = (a, b, n = 16) => { let w = 0; for (let s = 1; s <= n; s++) { const left = s % 2 === 0; const L = [mono(a, 0), mono(b, 1)]; if (!left) L.reverse(); const m = play({ seed: s * 7, lineups: L, coachAI: [false, false] }); if (m.winner === (left ? 0 : 1)) w++; } return w / n; };
  let blocked = 0, wallhits = 0;
  play({ seed: 3, lineups: [mono('builder', 0), mono('thrower', 1)], coachAI: [false, false] }, (m) => { for (const e of m.events) if (e.k === 'wallhit' && e.side === 0) wallhits++; });
  const m1 = play({ seed: 3, lineups: [mono('builder', 0), mono('thrower', 1)], coachAI: [false, false] });
  blocked = m1.units.filter((u) => u.side === 0).reduce((a, u) => a + u.stats.blocked, 0);
  assert.ok(wallhits > 50 && blocked > 50, `walls stop throws (${wallhits} wall hits)`);
  assert.ok(duel('builder', 'thrower') >= 0.75, 'builders beat throwers');
  ok('builders’ walls stop throwers’ snowballs');

  let lobs = 0, lobWall = 0;
  play({ seed: 4, lineups: [mono('scout', 0), mono('builder', 1)], coachAI: [false, false] }, (m) => { for (const e of m.events) { if (e.k === 'throw' && e.side === 0 && e.lob) lobs++; if (e.k === 'wallhit' && e.side === 1) lobWall++; } });
  assert.ok(lobs > 100, 'scouts lob'); assert.ok(lobWall < lobs / 10, 'and the lobs mostly sail over the walls');
  assert.ok(duel('scout', 'builder') >= 0.75, 'scouts beat builders');
  ok('scouts lob over builders’ walls');

  let buries = 0, counter = 0, plain = 0;
  play({ seed: 5, lineups: [mono('digger', 0), mono('scout', 1)], coachAI: [false, false] }, (m) => { for (const e of m.events) { if (e.k === 'bury' && e.side === 1) buries++; if (e.k === 'hit' && e.side === 1 && m.units[e.by].role === 'digger') e.counter ? counter++ : plain++; } });
  assert.ok(buries >= 3, `diggers bury scouts (${buries})`);
  assert.ok(counter > 0 && counter >= plain, 'diggers’ hits on scouts are counter hits');
  assert.ok(duel('digger', 'scout', 40) >= 0.65, 'diggers beat scouts');
  ok('diggers bury scouts, hit them for counter damage and beat them');

  assert.ok(duel('thrower', 'digger') >= 0.75, 'throwers beat diggers');
  ok('throwers out-range diggers');
  assert.equal(G.counterOf('thrower'), 'builder'); assert.equal(G.counterOf('builder'), 'scout'); assert.equal(G.counterOf('scout'), 'digger'); assert.equal(G.counterOf('digger'), 'thrower'); assert.equal(G.counterOf('medic'), null);
  ok('the counter wheel closes and medics are neutral');
}

// ---- the kick-off formation, and the stats the result screen shows
{
  const lineups = [team(['medic', 'thrower', 'scout', 'builder', 'digger'], 0), team(['thrower', 'medic', 'builder', 'digger', 'scout'], 1)];
  const m = new G.Match({ seed: 4, lineups });
  for (const side of [0, 1]) {
    const us = m.units.filter((u) => u.side === side), depth = (u) => (side === 0 ? u.x : G.FW - u.x);
    const b = us.find((u) => u.role === 'builder'), med = us.find((u) => u.role === 'medic');
    assert.ok(depth(b) > depth(med), 'the builder starts in front of the medic');
    assert.equal(new Set(us.map((u) => Math.round(u.y))).size, 5, 'everyone has their own lane');
    assert.ok(Math.abs(b.y - G.FH / 2) < 1, 'the front-liner starts in the middle');
  }
  const revived = [0, 0];
  while (!m.over) { m.step(); for (const e of m.events) if (e.k === 'repair') revived[e.side]++; }
  for (const side of [0, 1]) {
    const knocked = m.units.filter((u) => u.side !== side).reduce((a, u) => a + u.stats.blocks, 0);
    assert.equal(knocked, 16 - m.blocksLeft(side) + revived[side], 'blocks knocked out add up');
  }
  assert.ok(m.units.every((u) => u.role === 'builder' || u.stats.blocked === 0), 'only a wall’s builder is credited with saves');
  assert.ok(m.trace.length >= Math.floor(m.t / G.TICK) && m.trace.every(([a, b]) => a >= 0 && a <= 100 && b >= 0 && b <= 100), 'a fort trace every second');
  ok('a readable kick-off formation, and honest match stats');
}

// ---- shouts
{
  const lineups = [team(['thrower', 'digger', 'builder', 'scout', 'medic'], 0), team(['thrower', 'digger', 'builder', 'scout', 'medic'], 1)];
  const m = new G.Match({ seed: 11, lineups, coachAI: [false, false] });
  while (m.t < 200) m.step();
  assert.ok(m.shout(0, 'hold')); assert.equal(m.canShout(0), false); assert.equal(m.shout(0, 'attack'), false, 'one shout at a time');
  while (m.t < G.HALF_TICKS - 5) m.step();
  assert.equal(m.shout(0, 'attack'), false, 'once per half');
  while (m.t < G.HALF_TICKS + 2) m.step();
  assert.ok(m.shout(0, 'attack'), 'a fresh shout in the second half');
  // all attack pushes the team forward; hold the walls keeps them home
  const meanX = (shout) => { const k = new G.Match({ seed: 12, lineups, coachAI: [false, false] }); while (k.t < 150) k.step(); if (shout) k.shout(0, shout); let s = 0, n = 0; while (k.t < 150 + G.SHOUT_TICKS) { k.step(); for (const u of k.units) if (u.side === 0 && u.ko === 0) { s += u.x; n++; } } return s / n; };
  const atk = meanX('attack'), hold = meanX('hold');
  assert.ok(atk > hold + 10, `attack (${atk.toFixed(0)}) plays further up than hold (${hold.toFixed(0)})`);
  ok('shouts: once a half, one at a time, and they change where the team plays');
}

// ---- flag and time
{
  const m = new G.Match({ seed: 2, lineups: [mono('thrower', 0), mono('thrower', 1)] });
  m.forts[1].blocks = m.forts[1].blocks.map((_, i) => (i === 0 ? 1 : 0));
  let flagged = false; while (!m.over) { m.step(); if (m.events.some((e) => e.k === 'flag')) flagged = true; }
  assert.equal(m.how, 'flag'); assert.equal(m.winner, 0); assert.ok(flagged); assert.ok(m.t < G.MATCH_TICKS);
  ok('knocking out the last block drops the flag and wins');
  const lineups = [mono('medic', 0), mono('medic', 1)];
  const t = new G.Match({ seed: 3, lineups, coachAI: [false, false] }); while (!t.over) t.step();
  assert.equal(t.t, G.MATCH_TICKS); assert.equal(t.how, 'time');
  if (t.winner !== -1) assert.ok(t.fortShare(t.winner) >= t.fortShare(1 - t.winner)); else assert.equal(Math.round(t.fortHp(0)), Math.round(t.fortHp(1)));
  ok('at time-up the taller fort wins');
}

// ---- the draft
{
  for (let seed = 1; seed <= 20; seed++) {
    const s = G.newSave(seed), f = G.ourFixture(s); const d = G.makeDraft(s, f);
    G.autoDraft(d, ['random', 'random'], G.rng(seed));
    assert.ok(G.draftDone(d));
    const all = [...d.picks[0], ...d.picks[1]], bans = [...d.bans[0], ...d.bans[1]];
    assert.equal(d.picks[0].length, G.LINEUP); assert.equal(d.picks[1].length, G.LINEUP);
    assert.equal(new Set(all).size, all.length, 'no card picked twice');
    assert.ok(all.every((id) => !bans.includes(id)), 'no banned card picked');
    for (const side of [0, 1]) for (const id of d.picks[side]) { const own = d.squads[side].some((p) => p.id === id) || d.pool.some((p) => p.id === id); assert.ok(own, 'picks come from your own squad or the loans'); }
    for (const id of d.bans[0]) assert.ok(!d.squads[0].some((p) => p.id === id), 'bans strike the other side (or the loans)');
  }
  const s = G.newSave(5), d = G.makeDraft(s, G.ourFixture(s));
  const turn = G.draftTurn(d); assert.equal(turn.kind, 'ban');
  const mine = d.squads[turn.side][0].id; assert.equal(G.legal(d, mine), false, 'you can’t ban your own card'); assert.equal(G.act(d, mine), false);
  const hint = G.advise(d, turn.side, 'hint'); assert.ok(hint && hint.why.length > 10 && G.legal(d, hint.id), 'the Hint is legal and explains itself');
  ok('drafts are legal: five each, no doubles, no banned picks, kind Hints');
}

// ---- the week
{
  const s = G.newSave(8); const p = s.squad[0], aim = p.aim;
  assert.ok(G.train(s, p.id, 'aim')); assert.equal(p.aim, aim + 1); assert.equal(s.acted, 'train');
  assert.equal(G.rest(s), false, 'one job a week');
  const t = G.newSave(8); const before = t.squad.map((q) => q.morale); assert.ok(G.rest(t)); assert.ok(t.squad.every((q, i) => q.morale >= before[i]));
  const u = G.newSave(8); assert.ok(G.scout(u)); assert.equal(u.scouted, G.opponentOf(u));
  const f = G.ourFixture(u), opp = G.opponentOf(u); const withScout = G.ourMatchOpts(u, f, u.squad.slice(0, 5), u.rivals[opp].slice(0, 5), 'balanced');
  assert.ok(withScout.momentum[0] > 0, 'scouting gives a head start');
  const v = G.newSave(8); v.money = 999; const fa = v.free[0], n = v.squad.length;
  assert.ok(G.sign(v, fa.id)); assert.equal(v.squad.length, n + 1); assert.equal(v.money, 999 - G.price(fa));
  const w = G.newSave(8); w.money = 0; assert.equal(G.sign(w, w.free[0].id), false, 'no coins, no signing');
  ok('the week’s jobs: train, rest, scout and sign');
}

// ---- the season
{
  const s = G.newSave(21);
  const ids = G.TEAMS.map((t) => t.id);
  for (const id of ids) { const games = s.fixtures.filter((f) => f.home === id || f.away === id); assert.equal(games.length, 7); assert.equal(new Set(games.map((f) => (f.home === id ? f.away : f.home))).size, 7, 'everyone meets everyone once'); }
  for (let w = 0; w < 7; w++) assert.equal(s.fixtures.filter((f) => f.week === w).length, 4, 'four matches a week');
  const r = G.rng(3); let weeks = 0;
  while (!s.seasonOver && weeks++ < 12) { G.botWeek(s, 'pro', r); G.botMatch(s, 'pro', r); G.endWeek(s); }
  assert.ok(s.seasonOver);
  assert.equal(s.table.reduce((a, x) => a + x.p, 0), 56);
  assert.equal(s.fixtures.filter((f) => f.kind === 'semi').length, 2); assert.equal(s.fixtures.filter((f) => f.kind === 'final').length, 1);
  const top = G.sortedTable(s).slice(0, 4).map((x) => x.team), semis = s.fixtures.filter((f) => f.kind === 'semi');
  assert.deepEqual(semis.flatMap((f) => [f.home, f.away]).sort(), [...top].sort(), 'the top four play the semis');
  const fin = s.fixtures.find((f) => f.kind === 'final'); assert.ok(fin.done && fin.winner !== 'draw');
  assert.deepEqual([fin.home, fin.away].sort(), semis.map((f) => f.winner).sort(), 'the semi winners meet in the final');
  assert.equal(s.history.length, 1);
  ok('a season: a seven-week round robin, the top four into the semis, then the final');

  // rollover
  const ages = s.squad.map((p) => p.age), rivalsBefore = G.TEAMS.slice(1).map((t) => s.rivals[t.id].reduce((a, p) => a + G.rating(p), 0));
  G.newSeason(s);
  assert.equal(s.season, 2); assert.equal(s.week, 0); assert.equal(s.seasonOver, false); assert.equal(s.rivalLevel, 1);
  assert.ok(s.squad.every((p) => ages.length && p.age >= 1));
  assert.ok(s.squad.filter((p) => p.age === 1).length >= 1 || s.squad.length === G.SQUAD_MAX, 'a rookie joins when there is room');
  const rivalsAfter = G.TEAMS.slice(1).map((t) => s.rivals[t.id].reduce((a, p) => a + G.rating(p), 0));
  assert.ok(rivalsAfter.every((x, i) => x > rivalsBefore[i]), 'the rivals get stronger');
  assert.ok(s.table.every((x) => x.p === 0) && s.fixtures.length === 28);
  ok('the rollover: ageing, a rookie, stronger rivals and a fresh calendar');
}

// ---- the photo wall and every player's look
{
  const s = G.newSave(31), r = G.rng(5); let weeks = 0;
  while (!s.seasonOver && weeks++ < 12) { G.botWeek(s, 'pro', r); G.botMatch(s, 'pro', r); G.endWeek(s); }
  const wins = s.fixtures.filter((f) => f.done && f.winner === 'snowcats').length;
  assert.equal(s.photos.length, wins, 'a photo for every win');
  for (const ph of s.photos) assert.ok(G.SPECIES.includes(ph.species) && ph.look >= 0 && ph.look < 4 && ph.ours >= ph.theirs, 'a photo of a win');
  const looks = new Set(s.rivals.vicunas.map((p) => G.lookOf(p)));
  assert.ok(looks.size >= 2, 'a squad of one species has different looks');
  assert.equal(G.lookOf({ id: 'abc' }), G.lookOf({ id: 'abc' }));
  ok('the photo wall fills up with wins, and players have their own looks');
}

// ---- every name is unique across a save: squads, loans and free agents, through signings and three rollovers
{
  for (const seed of [1, 2, 3, 41, 77]) {
    const s = G.newSave(seed), r = G.rng(seed);
    for (let season = 1; season <= 3; season++) {
      let weeks = 0;
      while (!s.seasonOver && weeks++ < 12) {
        const f = G.ourFixture(s);
        const loans = f ? G.makeDraft(s, f).pool : [];
        const names = [...s.squad, ...Object.values(s.rivals).flat(), ...s.free, ...loans].map((p) => p.name);
        const dup = names.filter((n, i) => names.indexOf(n) !== i);
        assert.deepEqual(dup, [], `seed ${seed}, season ${season}, week ${s.week}: no repeated names`);
        G.botWeek(s, 'pro', r); G.botMatch(s, 'pro', r); G.endWeek(s);
      }
      G.newSeason(s);
    }
  }
  ok('every player name is unique across squads, loans and free agents, season after season');
}

// ---- the save
{
  const s = G.newSave(77); G.train(s, s.squad[1].id, 'grit'); s.trophies.push({ season: 1, kind: 'cup', text: 'x' });
  const back = G.parseSave(G.serialise(s));
  assert.deepEqual(back, s);
  assert.equal(G.SAVE_KEY, 'snow-day-league-v1');
  for (const bad of ['', 'nope', '{"v":2}', JSON.stringify({ ...s, squad: [{ id: 1 }] })]) { const t = G.parseSave(bad); assert.equal(t.v, 1); assert.equal(t.season, 1); }
  ok('the save round-trips, and a broken save starts fresh');
}

console.log(`\n${pass} Snow Day League checks passed`);
