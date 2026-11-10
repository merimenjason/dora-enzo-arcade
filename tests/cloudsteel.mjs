// Cloudsteel engine tests: guarding, the deflect window, jade attacks, the dodge's safe frames, parries, posture
// breaks and finishers, Enzo's tag, rounds, falls and retries, ranks, the save, determinism, and that a player who
// plays like a person gets across with help on.
import assert from 'node:assert/strict';
import { Fight, ROUNDS, FOES, ATTACKS, TAG_FULL, idleInput, newSave, parseSave, serialise, better } from '../.checks/cloudsteel-game.js';
import { makeBot, play } from './cloudsteel-bots.mjs';

let n = 0; const ok = (name) => console.log(`ok ${++n} - ${name}`);
const inp = (o = {}) => ({ ...idleInput(), ...o });
/** ticks until `stop(g, events)` is true; returns every event seen */
function run(g, max, input, stop) { const seen = []; for (let i = 0; i < max; i++) { g.tick(typeof input === 'function' ? input(g, i) : input); seen.push(...g.events.map((e) => ({ ...e }))); if (stop && stop(g, seen)) break; } return seen; }
const toFight = (g) => run(g, 400, inp(), (x) => x.phase === 'fight' && x.foes.every((f) => f.state !== 'enter'));
const has = (evs, t) => evs.some((e) => e.t === t);
/** stands a foe next to Dora, facing her, ready to act */
function near(g, f, d = 1.8) { f.x = g.x; f.z = g.z - d; f.face = 0; g.face = Math.PI; }

{ // rounds and foes
  assert.equal(ROUNDS.length, 3); assert.deepEqual(ROUNDS.map((r) => r.foes.length), [1, 2, 1]);
  assert.equal(ROUNDS[2].foes[0].kind, 'bear');
  for (const k of ['fox', 'bear']) assert.ok(ATTACKS[k].length >= 2 && FOES[k].hp > 0);
  assert.ok(ATTACKS.bear.some((a) => a.jade) && !ATTACKS.fox.some((a) => a.jade));
  const g = new Fight(1); assert.equal(g.phase, 'intro'); assert.equal(g.foes.length, 1); toFight(g); assert.equal(g.phase, 'fight');
  ok('three rounds: a fox, two foxes, the bear; only the bear has a jade attack');
}
{ // doing nothing loses
  const g = new Fight(2); run(g, 60 * 120, inp(), (x) => x.phase === 'lost');
  assert.equal(g.phase, 'lost'); assert.equal(g.hp, 0);
  ok('a player who never moves is beaten');
}
{ // a held guard blocks steel: no damage, but the guard bar fills
  const g = new Fight(3); toFight(g);
  const evs = run(g, 60 * 20, inp({ guard: true }), (x, s) => has(s, 'block'));
  assert.ok(has(evs, 'block')); assert.equal(g.hp, 100); assert.ok(g.posture > 0); assert.equal(g.stats.deflects, 0);
  ok('holding guard blocks a steel attack and fills the guard bar');
  const more = run(g, 60 * 60, inp({ guard: true }), (x, s) => has(s, 'guardBroken'));
  assert.ok(has(more, 'guardBroken')); assert.equal(g.state, 'broken');
  ok('blocking again and again breaks the guard');
}
{ // guarding just as the blow lands deflects it
  for (const assist of [true, false]) {
    const g = new Fight(4, assist); toFight(g);
    const evs = run(g, 60 * 20, (x) => { const f = x.foes[0]; return inp({ guard: f.state === 'windup' && f.t >= f.atk.windup - 3 || f.state === 'strike' }); }, (x, s) => has(s, 'deflect') || has(s, 'hurt') || has(s, 'block'));
    assert.ok(has(evs, 'deflect'), `deflect, assist ${assist}`); assert.equal(g.hp, 100); assert.equal(g.posture, 0); assert.equal(g.stats.deflects, 1);
    assert.equal(g.foes[0].state, 'deflected'); assert.ok(g.foes[0].posture >= 40);
  }
  ok('a guard pressed as the blow lands deflects: no harm, and the foe\'s posture fills');
  const a = new Fight(4, true), b = new Fight(4, false); assert.ok(a.deflectWindow > b.deflectWindow);
  // pressed too early, the same guard only blocks
  const g = new Fight(4, false); toFight(g);
  const evs = run(g, 60 * 20, (x) => inp({ guard: x.foes[0].state === 'windup' || x.foes[0].state === 'strike' }), (x, s) => has(s, 'deflect') || has(s, 'block'));
  assert.ok(has(evs, 'block') && !has(evs, 'deflect'));
  ok('the deflect moment is wider with help on, and a guard held too early only blocks');
}
{ // help slows the wind-up and softens the blow
  const dmg = (assist) => { const g = new Fight(5, assist); toFight(g); let w = 0; const evs = run(g, 60 * 30, inp(), (x, s) => { const f = x.foes[0]; if (f.state === 'windup') w = f.atk.windup; return has(s, 'hurt'); }); return { w, d: evs.find((e) => e.t === 'hurt').dmg }; };
  const on = dmg(true), off = dmg(false);
  assert.ok(on.d < off.d); assert.ok(on.w > off.w);
  ok('help makes foes wind up more slowly and hit less hard');
}
{ // the dodge has safe frames
  const g = new Fight(6); toFight(g);
  const evs = run(g, 60 * 20, (x) => { const f = x.foes[0], d = Math.hypot(f.x - x.x, f.z - x.z) || 1; return inp({ x: (f.x - x.x) / d * 0.3, z: (f.z - x.z) / d * 0.3, dodge: f.state === 'windup' && f.t === f.atk.windup - 5 }); }, (x, s) => has(s, 'evade') || has(s, 'hurt'));
  assert.ok(has(evs, 'dodge')); assert.ok(has(evs, 'evade') && !has(evs, 'hurt')); assert.equal(g.hp, 100); assert.ok(g.tag > 0);
  ok('rolling through a blow as it lands avoids it and feeds Enzo\'s meter');
}
{ // three cuts, then the foe parries
  const g = new Fight(7); toFight(g); const f = g.foes[0]; f.cd = 9999; near(g, f);
  const evs = run(g, 400, (x, i) => inp({ attack: i % 6 < 2 }), (x, s) => has(s, 'parried'));
  assert.ok(has(evs, 'parried')); assert.equal(g.stats.hits, 3); assert.equal(g.state, 'recoil'); assert.equal(evs.filter((e) => e.t === 'swing').map((e) => e.n).slice(0, 3).join(), '0,1,2');
  assert.ok(f.hp < f.maxHp && f.posture > 0); assert.equal(f.cd, 0);
  ok('a chain of three cuts lands, the fourth is turned aside and the foe answers');
}
{ // cutting into a wind-up is a trade
  const g = new Fight(8); toFight(g); const f = g.foes[0]; near(g, f); f.cd = 0;
  const evs = run(g, 60 * 20, (x, i) => inp({ attack: x.foes[0].state === 'windup' && i % 6 < 2 }), (x, s) => has(s, 'hurt'));
  assert.ok(has(evs, 'hit') && has(evs, 'hurt')); assert.ok(f.hp < f.maxHp && g.hp < 100);
  ok('cuts do not stop a foe that has begun its swing');
}
{ // posture break and the finisher
  const g = new Fight(9); toFight(g); const f = g.foes[0]; f.cd = 9999; near(g, f); f.posture = f.maxPosture - 1;
  let evs = run(g, 200, (x, i) => inp({ attack: i % 6 < 2 }), (x, s) => has(s, 'broken'));
  assert.ok(has(evs, 'broken')); assert.equal(f.state, 'broken'); const hp = f.hp;
  evs = run(g, 200, (x, i) => inp({ attack: i % 6 < 2 }), (x, s) => has(s, 'finisherHit'));
  assert.ok(has(evs, 'finisher') && has(evs, 'finisherHit')); assert.ok(hp - f.hp >= 60); assert.equal(g.stats.finishers, 1); assert.equal(f.posture, 0);
  ok('a full posture bar breaks the foe open, and a cut then is the finisher');
}
{ // Enzo's tag
  const g = new Fight(10); toFight(g); const f = g.foes[0]; f.cd = 9999; near(g, f, 2.2);
  assert.equal(run(g, 30, (x, i) => inp({ tag: i % 4 < 2 })).some((e) => e.t === 'tag'), false);
  g.tag = TAG_FULL; const hp = f.hp;
  const evs = run(g, 200, (x, i) => inp({ tag: i % 4 < 2 }), (x, s) => x.enzo.state === 'wait' && has(s, 'tagHit'));
  assert.ok(has(evs, 'tag') && has(evs, 'tagHit')); assert.equal(g.tag, 0); assert.equal(hp - f.hp, 20); assert.ok(f.posture >= 50); assert.equal(g.enzo.state, 'wait'); assert.equal(g.stats.tags, 1);
  ok('Enzo only comes on a full meter; his lantern hurts and staggers the foe, and he goes back to his post');
}
{ // jade attacks go through a guard
  let found = false;
  for (let seed = 11; seed < 16 && !found; seed++) {
    const g = new Fight(seed); const bot = makeBot({ seed });
    run(g, 60 * 240, (x) => bot(x), (x) => x.round === 2 && x.phase === 'fight'); assert.equal(g.round, 2);
    const evs = run(g, 60 * 120, (x) => { const f = x.foes[0], d = Math.hypot(f.x - x.x, f.z - x.z) || 1; return inp({ x: d > 2.4 ? (f.x - x.x) / d : 0, z: d > 2.4 ? (f.z - x.z) / d : 0, guard: f.state === 'windup' || f.state === 'strike' }); }, (x, s) => s.some((e) => e.t === 'hurt' && e.jade) || x.phase === 'lost');
    found = evs.some((e) => e.t === 'hurt' && e.jade);
  }
  assert.ok(found);
  ok('the bear\'s jade slam cannot be guarded');
}
{ // two foes take turns
  const g = new Fight(16); const bot = makeBot({ seed: 3 });
  run(g, 60 * 240, (x) => bot(x), (x) => x.round === 1 && x.phase === 'fight'); assert.equal(g.foes.length, 2);
  let both = 0; run(g, 60 * 40, inp({ guard: true }), (x) => { if (x.foes.filter((f) => f.state === 'windup' || f.state === 'strike').length > 1) both++; return x.phase !== 'fight'; });
  assert.equal(both, 0);
  const a = g.target; g.tick(inp({ swap: true })); assert.notEqual(g.target, a);
  ok('with two foes only one swings at a time, and the lock can be switched');
}
{ // a fall, a retry, the result
  const g = new Fight(17); run(g, 60 * 120, inp(), (x) => x.phase === 'lost');
  g.retryRound(); assert.equal(g.phase, 'intro'); assert.equal(g.hp, 100); assert.equal(g.stats.falls, 1); assert.equal(g.round, 0); assert.equal(g.state, 'idle');
  const bot = makeBot({ seed: 5 }); run(g, 60 * 600, (x) => bot(x), (x) => x.over);
  assert.equal(g.phase, 'won'); assert.equal(g.state, 'win'); const r = g.result();
  assert.notEqual(r.rank, 'gold'); assert.equal(r.falls, 1); assert.ok(r.seconds > 0 && r.score >= 0);
  const clean = play(Fight, makeBot({ seed: 9, reaction: 8, jitter: 1 }), { seed: 30, assist: true }); 
  assert.equal(clean.phase, 'won'); assert.equal(clean.result().falls, 0);
  ok('a fall restarts the round on full health and costs the gold seal');
}
{ // the save
  const s = newSave(); assert.equal(s.settings.assist, true);
  s.wins = 3; s.best = { rank: 'silver', seconds: 80, deflects: 5, bestCombo: 9, damage: 60, falls: 0, score: 3100 }; s.settings.fx = false;
  assert.deepEqual(parseSave(serialise(s)), s);
  for (const bad of [null, '', '{', '[]', '{"v":1}', '{"v":2,"best":{"rank":"x"},"wins":-4}']) { const p = parseSave(bad); assert.equal(p.v, 2); assert.equal(p.story, null); assert.equal(p.best, null); assert.ok(p.wins >= 0); }
  assert.ok(better({ ...s.best, score: 3200 }, s.best)); assert.ok(!better({ ...s.best, score: 3000 }, s.best)); assert.ok(better(s.best, null));
  const t = newSave(); t.story = { v: 1, area: 'forest' }; t.climbs = 2; assert.deepEqual(parseSave(serialise(t)), t);
  ok('the save round-trips (with a place on the mountain), and a broken or old save falls back to a new one');
}
{ // the puma, story duels and the upgrades
  assert.ok(ATTACKS.puma.some((a) => a.jade) && FOES.puma.hp > 0 && FOES.puma.speed > FOES.fox.speed);
  const rounds = [{ title: 'Titu', foes: [{ kind: 'puma', name: 'Titu', look: 'titu' }] }];
  const g = new Fight(5, true, { rounds }); assert.equal(g.foes[0].kind, 'puma'); assert.equal(g.foes[0].look, 'titu');
  const bot = makeBot({ seed: 3 }); run(g, 60 * 600, (x) => bot(x), (x) => x.over); assert.equal(g.phase, 'won'); assert.equal(g.rounds.length, 1);
  const two = new Fight(6, true, { rounds: [{ title: 'Mallku', foes: [{ kind: 'fox', name: 'Mallku', look: 'mallku', hp: 200 }, { kind: 'fox', name: 'Rumi', look: 'kin' }] }] });
  assert.equal(two.foes[0].maxHp, 200); assert.equal(two.foes[1].look, 'kin');
  // the same cut with the Rain-Tempered Edge does more, and the Feather Wrap breaks posture sooner
  const hitWith = (ups) => { const f = new Fight(8, true, { ups }); toFight(f); const foe = f.foes[0]; near(f, foe, 1.2); const hp = foe.hp, po = foe.posture; run(f, 40, (x, i) => inp({ attack: i === 0 })); return [hp - foe.hp, foe.posture - po]; };
  const [d0, p0] = hitWith(undefined), [d1] = hitWith({ edge: true, feather: false, claw: false, flame: false }), [, p2] = hitWith({ edge: false, feather: true, claw: false, flame: false });
  assert.ok(d0 > 0 && d1 > d0, `edge ${d1} vs ${d0}`); assert.ok(p2 > p0, `feather ${p2} vs ${p0}`);
  const claw = new Fight(1, true, { ups: { edge: false, feather: false, claw: true, flame: false } }), plain = new Fight(1, true);
  assert.ok(claw.deflectWindow > plain.deflectWindow);
  ok('Titu the puma pounces with a jade blow; story duels take their own foes; the sword upgrades cut harder, break sooner and widen the deflect');
}
{ // determinism
  const a = play(Fight, makeBot({ seed: 21 }), { seed: 77 }), b = play(Fight, makeBot({ seed: 21 }), { seed: 77 });
  assert.deepEqual(a.result(), b.result()); assert.equal(a.tick_, b.tick_); assert.equal(a.x, b.x);
  const c = play(Fight, makeBot({ seed: 21 }), { seed: 78 }); assert.notEqual(a.tick_, c.tick_);
  ok('the same seed and the same inputs replay the same fight');
}
{ // tuned for people
  const N = 30, tally = (opts, assist) => { let wins = 0, falls = 0, dmg = 0; for (let s = 1; s <= N; s++) { const g = play(Fight, makeBot({ seed: s * 7, ...opts }), { seed: s, assist }); if (g.phase === 'won') wins++; falls += g.stats.falls; dmg += g.stats.damage; } return { wins, falls: falls / N, dmg: dmg / N }; };
  const person = tally({ reaction: 16, jitter: 5 }, true), slow = tally({ reaction: 24, jitter: 9 }, true), masher = tally({ jitter: 200 }, true), wall = tally({ guardOnly: true, useTag: false }, true);
  assert.equal(person.wins, N); assert.ok(person.falls <= 0.3, `falls ${person.falls}`);
  assert.ok(slow.wins >= N - 2, `slow player wins ${slow.wins}`);
  assert.ok(masher.dmg > person.dmg * 1.3, `mashing costs more: ${masher.dmg} vs ${person.dmg}`);
  assert.equal(wall.wins, 0);
  ok(`a person gets across with help on (${person.wins}/${N}, ${person.falls.toFixed(2)} falls a fight); mashing takes more damage; guarding alone never wins`);
}
console.log(`\n${n} Cloudsteel tests passed`);
