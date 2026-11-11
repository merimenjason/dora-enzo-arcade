// Cloudsteel engine tests: guarding, the deflect window, jade attacks, the dodge's safe frames, parries, posture
// breaks and finishers, the tag team (swapping, the tag strike both ways, Enzo's sweep, ward and hop, the partner),
// the vizcacha archer and her arrows, rounds, falls and retries, ranks, the save, determinism, and that a player who
// plays like a person gets across with help on.
import assert from 'node:assert/strict';
import { Fight, ROUNDS, FOES, ATTACKS, TAG_FULL, ARROW, SWEEP, WARD, HOP, SWAP, idleInput, newSave, parseSave, serialise, better } from '../.checks/cloudsteel-game.js';
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
  assert.equal(ROUNDS.length, 3); assert.deepEqual(ROUNDS.map((r) => r.foes.length), [1, 3, 1]); assert.equal(ROUNDS[1].foes[2].kind, 'archer');
  assert.equal(ROUNDS[2].foes[0].kind, 'bear');
  for (const k of ['fox', 'bear']) assert.ok(ATTACKS[k].length >= 2 && FOES[k].hp > 0);
  assert.ok(ATTACKS.bear.some((a) => a.jade) && !ATTACKS.fox.some((a) => a.jade));
  const g = new Fight(1); assert.equal(g.phase, 'intro'); assert.equal(g.foes.length, 1); toFight(g); assert.equal(g.phase, 'fight');
  ok('three rounds: a fox, two foxes and an archer, the bear; only the bear has a jade attack');
}
{ // doing nothing loses
  const g = new Fight(2); run(g, 60 * 120, inp(), (x) => x.phase === 'lost');
  assert.equal(g.phase, 'lost'); assert.equal(g.hp, 0); assert.equal(g.enzo.hp, 0); assert.equal(g.hero, 'enzo');
  ok('a player who never moves is beaten: Dora falls, Enzo takes over, then he falls too');
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
{ // swapping: E at any time, a rest between swaps, and on a full meter the swap is a strike
  const g = new Fight(10); toFight(g); const f = g.foes[0]; f.cd = 9999; near(g, f, 2.2);
  let evs = run(g, 2, (x, i) => inp({ tag: i === 0 }));
  assert.ok(has(evs, 'swap') && !has(evs, 'tag')); assert.equal(g.hero, 'enzo'); assert.equal(g.enzo.state, 'idle'); assert.equal(g.state, 'tagout'); assert.equal(g.stats.swaps, 1);
  run(g, 3, (x, i) => inp({ tag: i === 1 })); assert.equal(g.hero, 'enzo', 'no swap straight back: there is a rest');
  run(g, SWAP.rest, inp()); assert.equal(g.state, 'wait');
  evs = run(g, 2, (x, i) => inp({ tag: i === 0 })); assert.equal(g.hero, 'dora'); assert.equal(g.enzo.state, 'tagout');
  ok('E swaps Dora and Enzo at any time, with a short rest; the one going out steps back and waits');
  // Enzo in on a full meter: the old leap and lantern burst, then he is the one fighting
  run(g, SWAP.rest + 30, inp()); near(g, f, 2.2); g.tag = TAG_FULL; const hp = f.hp;
  evs = run(g, 200, (x, i) => inp({ tag: i === 0 }), (x, s) => has(s, 'tagHit') && x.enzo.state === 'idle');
  assert.ok(has(evs, 'tag') && has(evs, 'tagHit')); assert.equal(g.tag, 0); assert.equal(hp - f.hp, 20); assert.ok(f.posture >= 50); assert.equal(g.hero, 'enzo'); assert.equal(g.stats.tags, 1);
  // Dora in on a full meter: a dash and a heavy cut at the foe Enzo was facing
  run(g, SWAP.rest, inp()); f.cd = 9999; f.state = 'stalk'; f.x = g.enzo.x; f.z = g.enzo.z - 2; g.x = g.enzo.x + 1.5; g.z = g.enzo.z + 1.5; g.tag = TAG_FULL; const hp2 = f.hp;
  evs = run(g, 60, (x, i) => inp({ tag: i === 0 }), (x) => x.state === 'idle');
  assert.ok(has(evs, 'tag') && has(evs, 'tagHit')); assert.equal(g.hero, 'dora'); assert.ok(hp2 - f.hp >= 16, `dash ${hp2 - f.hp}`); assert.equal(g.stats.tags, 2);
  ok('a swap on a full meter is a tag strike: Enzo leaps in with the lantern, Dora dashes in with a heavy cut');
}
{ // Enzo's sweep: slow, wide, light on health and heavy on posture
  const rounds = [{ title: 'Three', foes: [0, 1, 2].map((i) => ({ kind: 'fox', name: `K${i}`, look: 'kin' })) }];
  const g = new Fight(20, true, { rounds }); toFight(g); run(g, 2, (x, i) => inp({ tag: i === 0 })); run(g, SWAP.rest, inp());
  const e = g.enzo; e.face = Math.PI; g.foes.forEach((f, i) => { f.cd = 9999; f.state = 'stalk'; const a = Math.PI + (i - 1) * 0.9; f.x = e.x + Math.sin(a) * 2.2; f.z = e.z + Math.cos(a) * 2.2; });
  g.target = g.foes[1].id;
  const hp = g.foes.map((f) => f.hp), evs = run(g, SWEEP.len + 2, (x, i) => inp({ attack: i === 0 }));
  const sh = evs.find((x) => x.t === 'sweepHit'); assert.ok(has(evs, 'sweep') && sh, 'swept'); assert.equal(sh.n, 3);
  g.foes.forEach((f, i) => { assert.equal(hp[i] - f.hp, SWEEP.dmg); assert.ok(f.posture >= SWEEP.post); });
  assert.ok(SWEEP.dmg < 6 && SWEEP.post > 9 && SWEEP.len > 30, 'less damage, more posture, slower than a cut');
  ok('Enzo\'s sweep catches every foe in a wide arc: a little damage each, a lot of posture');
}
{ // Enzo's hop clears a blow; his ward only softens a blade
  const hopped = () => { const g = new Fight(21); toFight(g); run(g, 2, (x, i) => inp({ tag: i === 0 })); const f = g.foes[0]; f.x = g.enzo.x; f.z = g.enzo.z - 1.8; f.cd = 0;
    return run(g, 60 * 10, (x) => inp({ dodge: f.state === 'windup' && f.t === f.atk.windup - 4 }), (x, s) => has(s, 'evade') || has(s, 'hurt')); };
  const evs = hopped(); assert.ok(has(evs, 'hop') && has(evs, 'evade') && !has(evs, 'hurt'));
  const g = new Fight(22); toFight(g); run(g, 2, (x, i) => inp({ tag: i === 0 })); const f = g.foes[0]; f.x = g.enzo.x; f.z = g.enzo.z - 1.8; f.cd = 0;
  const w = run(g, 60 * 10, (x) => inp({ guard: f.state === 'windup' && f.t >= f.atk.windup - 12 }), (x, s) => has(s, 'hurt'));
  const hurt = w.find((x) => x.t === 'hurt'); assert.ok(has(w, 'ward') && hurt); assert.equal(hurt.who, 'enzo');
  assert.ok(Math.abs(hurt.dmg - f.atk.dmg * 0.75 * 0.5) < 1e-6, `ward halves a blade: ${hurt.dmg}`); assert.equal(g.stats.deflects, 0);
  ok('Enzo hops clear of a blow; his ward does not deflect a blade, it only halves the damage');
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
  run(g, 60 * 240, (x) => bot(x), (x) => x.round === 1 && x.phase === 'fight'); assert.equal(g.foes.length, 3);
  let both = 0; run(g, 60 * 40, inp({ guard: true }), (x) => { if (x.foes.filter((f) => f.state === 'windup' || f.state === 'strike').length > 1) both++; return x.phase !== 'fight'; });
  assert.equal(both, 0);
  const a = g.target; g.tick(inp({ swap: true })); assert.notEqual(g.target, a);
  ok('with a group only one swings (or draws) at a time, and the lock can be switched');
}
{ // the vizcacha archer: a draw, a red line that follows the hero and then locks, one arrow down it
  const archer = (seed, extra = []) => new Fight(seed, true, { rounds: [{ title: 'Bow', foes: [{ kind: 'archer', name: 'Chaska', look: 'archer' }, ...extra] }] });
  const g = archer(30); toFight(g); const a = g.foes[0];
  let lockAt = null, aimed = null;
  const evs = run(g, 60 * 12, (x) => { if (a.state === 'windup' && a.t === a.atk.windup - ARROW.lock) { lockAt = { x: x.x, z: x.z }; aimed = { x: a.aimX, z: a.aimZ }; } return inp(); }, (x, s) => has(s, 'hurt'));
  assert.ok(has(evs, 'windup') && has(evs, 'loose') && has(evs, 'hurt')); assert.ok(lockAt && Math.hypot(aimed.x - lockAt.x, aimed.z - lockAt.z) < 0.1, 'the line locks on where Dora stood');
  assert.ok(Math.hypot(a.x - g.x, a.z - g.z) > 4, 'the archer stands back'); assert.equal(evs.find((x) => x.t === 'hurt').who, 'dora');
  ok('the archer stands back, draws with a red line that locks on, and looses an arrow down it');
  // stepping off the line once it locks: the arrow goes by
  const h = archer(31); toFight(h); const b = h.foes[0];
  const e2 = run(h, 60 * 12, (x) => { if (b.state === 'windup' && b.t >= b.atk.windup - ARROW.lock) { const dx = b.x - x.x, dz = b.z - x.z, l = Math.hypot(dx, dz); return inp({ x: dz / l, z: -dx / l }); } return inp(); }, (x, s) => has(s, 'loose') && x.arrows.length === 0);
  assert.ok(has(e2, 'loose') && !has(e2, 'hurt'));
  // a guard pressed as the arrow arrives deflects it, and shakes the archer
  const d = archer(32); toFight(d); const c = d.foes[0];
  const e3 = run(d, 60 * 12, (x) => inp({ guard: x.arrows.some((r) => Math.hypot(r.x - x.x, r.z - x.z) < 1.6) }), (x, s) => has(s, 'deflect') || has(s, 'hurt') || has(s, 'block'));
  assert.ok(has(e3, 'deflect') && !has(e3, 'hurt')); assert.ok(c.posture >= 30); assert.equal(d.stats.deflects, 1);
  // a roll as it arrives: no harm
  const r = archer(33); toFight(r);
  const e4 = run(r, 60 * 12, (x) => inp({ dodge: x.arrows.some((q) => Math.hypot(q.x - x.x, q.z - x.z) < 1.6) }), (x, s) => has(s, 'loose') && x.arrows.length === 0 && x.state !== 'dodge');
  assert.ok(has(e4, 'dodge') && !has(e4, 'hurt'));
  ok('Dora steps off the red line, deflects the arrow with a guard in time, or rolls through it');
  // Enzo's ward stops it and fills the meter; the arrow is aimed at whoever is fighting, never the one waiting
  const w = archer(34); toFight(w); run(w, 2, (x, i) => inp({ tag: i === 0 })); const tag = w.tag; let at = null;
  const e5 = run(w, 60 * 12, (x) => { const f = x.foes[0]; if (f.state === 'windup' && f.t === f.atk.windup - ARROW.lock) at = Math.hypot(f.aimX - x.enzo.x, f.aimZ - x.enzo.z); return inp({ guard: x.arrows.some((q) => Math.hypot(q.x - x.enzo.x, q.z - x.enzo.z) < 3) }); }, (x, s) => has(s, 'warded') || has(s, 'hurt'));
  assert.ok(has(e5, 'ward') && has(e5, 'warded') && !has(e5, 'hurt')); assert.ok(w.tag > tag); assert.equal(w.stats.warded, 1); assert.ok(at !== null && at < 0.1, 'aimed at Enzo');
  assert.ok(WARD.r > 1 && HOP.to > HOP.from);
  ok('Enzo\'s ward stops an arrow short of him and fills the meter; the archer aims at the hero in front');
}
{ // a hero who falls hands over to the other
  const g = new Fight(35); toFight(g); g.hp = 1; const f = g.foes[0]; near(g, f); f.cd = 0;
  const evs = run(g, 60 * 10, inp(), (x) => x.hero === 'enzo');
  assert.ok(evs.some((e) => e.t === 'down' && e.who === 'dora')); assert.equal(g.hero, 'enzo'); assert.equal(g.phase, 'fight');
  run(g, 10, (x, i) => inp({ tag: i % 2 === 0 })); assert.equal(g.hero, 'enzo', 'no swapping to a fallen hero');
  ok('when the hero in front falls the other takes over, and the fight goes on');
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
  const s = newSave(); assert.equal(s.settings.assist, true); assert.equal(s.settings.quest, true);
  // a save from before the quest arrow keeps it on
  assert.equal(parseSave('{"v":2,"settings":{"assist":false,"sound":true,"music":true,"fx":true}}').settings.quest, true);
  assert.equal(parseSave('{"v":2,"settings":{"quest":false}}').settings.quest, false);
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
