import assert from 'node:assert/strict';
import {
  Run, CARDS, CARD_IDS, POOL, STARTER_DECK, TRINKETS, TRINKET_IDS, STATUS, FOES, FOE_IDS, ACTS, HEROES, HERO_IDS, ALTITUDES, EVENT_IDS,
  ENERGY, HAND, MAX_HAND, ROWS, LANES, STOPS, REMOVE_PRICE, REMOVE_STEP, costOf, describe, valsOf, canUpgrade, GLOSSARY, glossFor,
} from '../.checks/summit-shuffle-game.js';
import { climb, fightTurn } from './summit-shuffle-bot.mjs';

const card = (id, up = false) => ({ id, up, uid: 9000 + Math.floor(Math.random() * 1e9) });
const foe = (kind, o = {}) => { const d = FOES[kind]; return { uid: 0, kind, name: d.name, hp: 40, maxHp: 40, fluff: 0, st: {}, move: Object.keys(d.moves)[0], last: [], turns: 0, mem: {}, alive: true, fled: false, stolen: 0, ...o }; };
/**
 * A fight to try one rule in: Enzo (no opening extras) against the given foes, holding exactly `hand`, with a draw
 * pile of plain Nips. `trinkets` are packed before the fight starts, so the ones that act at its start have acted.
 */
function duel({ hand = [], foes = [foe('snake')], hero = 'enzo', trinkets = [], level = 0, energy = ENERGY, seed = 5 } = {}) {
  const r = Run.start({ seed, hero, level });
  for (const t of trinkets) r.gainTrinket(t);
  assert.equal(r.go(r.paths()[0]), '');
  const f = r.fight;
  f.foes = foes.map((x, i) => ({ ...x, uid: i }));
  f.hand = hand.map((c) => (typeof c === 'string' ? card(c) : c));
  f.draw = Array.from({ length: 12 }, () => card('nip')); f.discard = []; f.gone = [];
  f.energy = energy; f.played = 0; f.attacked = false;
  r.events.length = 0;
  return r;
}
const hpOf = (r, i = 0) => r.fight.foes[i].hp;

// ---------- The data holds together ----------
{
  assert.equal(POOL.length, 48, 'forty-eight cards can be found');
  const by = (rarity) => POOL.filter((id) => CARDS[id].rarity === rarity).length;
  assert.deepEqual([by('common'), by('uncommon'), by('rare')], [18, 20, 10]);
  assert.equal(STARTER_DECK.length, 10);
  assert.equal(TRINKET_IDS.length, 30);
  assert.equal(TRINKET_IDS.filter((t) => TRINKETS[t].tier === 'boss').length, 6);
  for (const id of CARD_IDS) {
    const d = CARDS[id];
    for (const up of [false, true]) {
      const text = describe({ id, up }), raw = typeof d.text === 'string' ? d.text : d.text[up ? 1 : 0];
      assert.ok(!/[{}]/.test(text), `${id}: every number in the text is filled in (${text})`);
      for (const [token, key] of [['{d}', 'd'], ['{b}', 'b'], ['{n}', 'n']]) assert.equal(raw.includes(token), !!d[key], `${id}: ${token} is in the text exactly when the card has that number`);
      if (d.exhaust) assert.match(text, /Exhaust/, `${id} says that it exhausts`);
    }
    // An upgrade always changes something a player can see.
    if (canUpgrade({ id, up: false })) assert.ok(describe({ id, up: false }) !== describe({ id, up: true }) || d.cost[0] !== d.cost[1], `${id}+ differs from ${id}`);
    assert.ok(d.cost[1] <= d.cost[0], `${id} never costs more upgraded`);
  }
  for (const id of FOE_IDS) {
    const d = FOES[id];
    // Every move a predator can pick exists, whatever it rolls and however long the fight runs.
    for (const low of [false, true]) for (let roll = 0; roll < 100; roll += 7) {
      const mem = d.start?.doze ? { asleep: 1 } : {}, last = [];
      for (let turn = 0; turn < 14; turn++) {
        if (turn === 3) { mem.asleep = 0; mem.stirred = 1; mem.awake = 0; }
        const m = d.next({ turn, last, roll: (roll + turn * 37) % 100, low, mem, allies: 0 });
        assert.ok(d.moves[m], `${id} picked a move it has (${m})`);
        last.push(m); if (mem.stirred) mem.awake++;
      }
    }
    for (const m of Object.values(d.moves)) { if (m.add) assert.ok(CARDS[m.add[0]]); if (m.summon) assert.ok(FOES[m.summon[0]]); }
  }
  for (const a of ACTS) for (const e of [...a.easy, ...a.hard, ...a.alphas, a.boss]) { assert.ok(e.length >= 1 && e.length <= 4); for (const id of e) assert.ok(FOES[id], `${id} exists`); }
  assert.equal(STOPS, 21);
  for (const id of Object.keys(STATUS)) assert.ok(STATUS[id].text(2).length > 5 && STATUS[id].icon);
}

// ---------- A seed replays a climb exactly ----------
{
  const a = climb({ seed: 4242, hero: 'dora', level: 0 }), b = climb({ seed: 4242, hero: 'dora', level: 0 }), c = climb({ seed: 4243, hero: 'dora', level: 0 });
  assert.equal(JSON.stringify(a.run.stats), JSON.stringify(b.run.stats));
  assert.deepEqual(a.run.deck.map((x) => x.id + x.up), b.run.deck.map((x) => x.id + x.up));
  assert.notEqual(JSON.stringify(a.run.maps), JSON.stringify(c.run.maps), 'another seed is another mountain');
}

// ---------- The trail ----------
for (let seed = 1; seed <= 60; seed++) {
  const r = Run.start({ seed, hero: 'enzo' });
  assert.equal(r.maps.length, 3);
  for (const map of r.maps) {
    const boss = map[map.length - 1], nodes = map.slice(0, -1);
    assert.equal(boss.type, 'boss'); assert.equal(boss.row, ROWS);
    map.forEach((n, i) => assert.equal(n.id, i));
    for (const n of nodes) {
      assert.ok(n.row >= 0 && n.row < ROWS && n.lane >= 0 && n.lane < LANES);
      assert.ok(n.next.length >= 1, 'no stop is a dead end');
      for (const m of n.next) { assert.equal(map[m].row, n.row + 1, 'trails only go up one row'); if (map[m].type !== 'boss') assert.ok(Math.abs(map[m].lane - n.lane) <= 1); }
      if (n.row === 0) assert.equal(n.type, 'fight'); else assert.ok(nodes.some((p) => p.next.includes(n.id)), 'every stop can be reached');
      if (n.row === ROWS - 1) { assert.equal(n.type, 'rest', 'a burrow before every guardian'); assert.deepEqual(n.next, [boss.id]); }
      if (n.row < 2) assert.ok(n.type === 'fight' || n.type === 'event', 'nothing fierce on the first two rows');
    }
    // No two trails cross between the same pair of rows.
    for (const a of nodes) for (const b of nodes) if (a.row === b.row && a.lane < b.lane && a.row < ROWS - 1) for (const x of a.next) for (const y of b.next) assert.ok(map[x].lane <= map[y].lane, 'trails do not cross');
    for (const t of ['alpha', 'stall', 'event']) assert.ok(nodes.some((n) => n.type === t), `every stretch has ${t}`);
    assert.ok(nodes.length >= 12 && nodes.length <= ROWS * LANES);
  }
  assert.ok(r.paths().every((id) => r.map[id].row === 0) && r.paths().length >= 2);
  assert.match(r.go(r.map.length - 1), /does not go there/);
}

// ---------- Setting out ----------
{
  const e = Run.start({ seed: 3, hero: 'enzo' }), d = Run.start({ seed: 3, hero: 'dora' });
  assert.equal(e.hp, HEROES.enzo.hp); assert.equal(e.deck.length, 10); assert.deepEqual(e.trinkets, ['scarf']); assert.deepEqual(d.trinkets, ['bell']);
  e.go(e.paths()[0]); d.go(d.paths()[0]);
  assert.equal(e.phase, 'fight'); assert.equal(e.fight.hand.length, HAND); assert.equal(e.fight.energy, ENERGY); assert.equal(e.fight.draw.length, 5);
  assert.equal(d.fight.hand.length, HAND + 2, 'the Ruby Bell draws two more to open with'); assert.equal(d.fight.energy, ENERGY + 1);
  d.endTurn();
  if (d.phase === 'fight') { assert.equal(d.fight.hand.length, HAND, 'only on the first turn'); assert.equal(d.fight.energy, ENERGY); }
  assert.equal(e.deck.length, 10, 'a fight plays with copies: the deck itself is untouched');
}

// ---------- Hitting, Fluff and the statuses ----------
{
  let r = duel({ hand: ['nip', 'fluffup', 'dustkick'] });
  assert.match(r.cannot(5), /no such card/);
  assert.equal(r.play(0), ''); assert.equal(hpOf(r), 34); assert.equal(r.fight.energy, 2);
  assert.equal(r.play(0), ''); assert.equal(r.fight.fluff, 5);
  assert.match(r.play(0), /Not enough energy/, 'Dust Kick costs 2');
  assert.equal(r.fight.discard.length, 2);
  // The snake bites for 7: 5 is soaked up, 2 gets through, and the Fluff is gone next turn.
  r.fight.foes[0].move = 'bite';
  const hp = r.hp;
  r.endTurn();
  assert.equal(r.hp, hp - 2); assert.equal(r.fight.fluff, 0); assert.equal(r.fight.turn, 2); assert.equal(r.fight.hand.length, HAND); assert.equal(r.fight.energy, ENERGY);

  r = duel({ hand: ['dustkick', 'nip'] });
  r.play(0); assert.equal(hpOf(r), 32); assert.equal(r.fight.foes[0].st.exposed, 2);
  assert.match(r.textOf(r.fight.hand[0], 0), /Deal 9 damage/, 'a card aimed at an Exposed foe shows what it will really do');
  assert.match(r.textOf(r.fight.hand[0]), /Deal 6 damage/);
  r.play(0); assert.equal(hpOf(r), 23, 'Exposed: half as much again');
  r.fight.foes[0].move = 'lash'; r.endTurn();
  assert.equal(r.fight.foes[0].st.exposed, 1, 'it counts down at the end of the foe’s turn'); assert.equal(r.fight.foes[0].fluff, 5);
  r.fight.hand = [card('nip')]; r.play(0);
  assert.equal(hpOf(r), 23 - 4, 'the foe’s Fluff soaks up 5 of the 9');

  r = duel({ hand: ['nip', 'nip', 'fluffup'] });
  r.fight.st = { zoomies: 3, winded: 1, fur: 2, matted: 1 };
  assert.match(r.textOf(r.fight.hand[0]), /Deal 6 damage/, '(6 + 3) x 0.75, rounded down');
  r.play(0); assert.equal(hpOf(r), 34);
  r.play(1); assert.equal(r.fight.fluff, 5, '(5 + 2) x 0.75, rounded down');

  // Burrs bite at the start of the foe's turn, past its Fluff, then one falls off.
  r = duel({ hand: ['burrpatch'], foes: [foe('armadillo', { fluff: 20, move: 'curl' })] });
  r.play(0); assert.equal(r.fight.foes[0].st.burrs, 6);
  r.endTurn(); assert.equal(hpOf(r), 34); assert.equal(r.fight.foes[0].st.burrs, 5);
  r.fight.foes[0].hp = 3; r.endTurn();
  assert.equal(r.phase, 'reward', 'burrs can finish a fight');

  // What a predator leaves on you is felt for as many turns as it says.
  r = duel({ foes: [foe('snake', { move: 'hiss' })] });
  r.endTurn(); assert.equal(r.fight.st.exposed, 2);
  r.fight.foes[0].move = 'bite'; const before = r.hp; r.endTurn();
  assert.equal(before - r.hp, 10, '7 and half as much again'); assert.equal(r.fight.st.exposed, 1);
  r.fight.foes[0].move = 'bite'; const then = r.hp; r.endTurn();
  assert.equal(then - r.hp, 10); assert.equal(r.fight.st.exposed, undefined);
  r.fight.foes[0].move = 'bite'; const last = r.hp; r.endTurn();
  assert.equal(last - r.hp, 7);

  // Intents tell the truth.
  r = duel({ foes: [foe('skunk', { move: 'scratch', st: { zoomies: 2, winded: 1 } })] });
  let it = r.intentOf(0);
  assert.equal(it.kind, 'attack'); assert.equal(it.dmg, 5); assert.equal(it.hits, 2); assert.equal(r.incoming, 10);
  r.fight.fluff = 4; const hp2 = r.hp; r.endTurn(); assert.equal(hp2 - r.hp, 6);
  r.fight.foes[0].move = 'spray'; it = r.intentOf(0);
  assert.equal(it.kind, 'hex'); assert.match(it.text, /Winded for 2 turns/); assert.match(it.text, /gains 2 Zoomies/);
}

// ---------- Cards ----------
{
  let r = duel({ hand: ['followup', 'squeak', 'followup'] });
  r.play(0); assert.equal(r.fight.energy, 2, 'no refund against a foe that is not Exposed'); assert.equal(r.fight.hand.length, 2);
  r.play(0); assert.equal(r.fight.energy, 2, 'Squeak is free'); assert.equal(r.fight.hand.length, 2, 'and draws a card');
  r.play(0); assert.equal(r.fight.energy, 2, 'Follow Up pays for itself'); assert.equal(r.fight.hand.length, 2);
  assert.equal(hpOf(r), 40 - 6 - 9);

  r = duel({ hand: ['quicknip', 'quicknip', 'flurry'] });
  r.play(0); r.play(0); r.play(0);
  assert.equal(hpOf(r), 40 - 4 - 4 - 9, 'Flurry hits once for each card played, itself included');

  r = duel({ hand: ['scamper', 'fluffup'] });
  r.play(1); r.play(0); assert.equal(r.fight.fluff, 5 + 3 + 3);

  r = duel({ hand: ['fluffup', 'puffup', 'bellyflop'] });
  r.play(0); r.play(0); assert.equal(r.fight.fluff, 10);
  r.play(0); assert.equal(hpOf(r), 30); assert.equal(r.fight.fluff, 10, 'Belly Flop keeps the Fluff it hits with');

  r = duel({ hand: ['zoomaround'], foes: [foe('weasel'), foe('weasel')] });
  assert.equal(r.play(0), ''); assert.equal(r.fight.energy, 0); assert.equal(hpOf(r, 0), 40 - 18); assert.equal(hpOf(r, 1), 40 - 18);

  r = duel({ hand: ['zoomaround'], energy: 0 }); assert.match(r.play(0), /Not enough energy/, 'an X card needs at least 1 energy');

  r = duel({ hand: ['ambush', 'ambush'] });
  r.play(0); assert.equal(hpOf(r), 24, 'twice as the first card'); r.play(0); assert.equal(hpOf(r), 16);

  r = duel({ hand: ['gnaw'], foes: [foe('armadillo', { fluff: 30, st: { bristle: 2 } })] });
  const hp = r.hp; r.play(0); assert.equal(hpOf(r), 26); assert.equal(r.fight.foes[0].fluff, 0); assert.equal(r.hp, hp - 2, 'its plates still bristle');

  r = duel({ hand: ['burrfling', 'tangle', 'sorespot'], energy: 5 });
  r.play(0); assert.equal(r.fight.foes[0].st.burrs, 4);
  r.play(0); assert.equal(r.fight.foes[0].st.burrs, 14, '4 and 3 more, doubled'); assert.equal(r.fight.gone.length, 1, 'Tangle is exhausted');
  r.play(0); assert.equal(hpOf(r), 40 - 5 - 8 - 14);

  r = duel({ hand: ['windup', 'doublekick'] });
  r.play(0); r.play(0); assert.equal(hpOf(r), 40 - 14); assert.equal(r.fight.st.zoomies, 2);
  r.endTurn(); assert.equal(r.fight.st.zoomies, undefined, 'Wind Up wears off');

  r = duel({ hand: ['fullpelt', 'drumfeet'], energy: 3 });
  r.fight.st.zoomies = 2;
  r.play(0); assert.equal(hpOf(r), 40 - 22, '16 and Zoomies three times'); r.play(0); assert.equal(hpOf(r), 40 - 22 - 15);

  r = duel({ hand: ['dustbath', 'popcorn', 'cheekstash'] });
  r.fight.st = { exposed: 2, winded: 1, matted: 2, zoomies: 1 };
  r.play(0); assert.deepEqual(r.fight.st, { zoomies: 1 }); assert.equal(r.fight.fluff, 7, 'the Matted is shaken off first');
  r.play(0); assert.equal(r.fight.hand.length, 3); assert.equal(r.fight.energy, 2, 'Popcorn is free');
  r.play(0); r.fight.foes[0].move = 'hiss'; r.endTurn(); assert.equal(r.fight.energy, ENERGY + 1, 'Cheek Stash pays out next turn');
  r.endTurn(); if (r.phase === 'fight') assert.equal(r.fight.energy, ENERGY);

  r = duel({ hand: ['feast'], foes: [foe('weasel', { hp: 10 }), foe('weasel')] });
  const max = r.maxHp; r.play(0, 0); assert.equal(r.maxHp, max + 3); assert.equal(r.fight.gone.length, 1);

  r = duel({ hand: ['furslip'], foes: [foe('skunk', { move: 'scratch' })] });
  r.play(0); const h3 = r.hp; r.endTurn(); assert.equal(h3 - r.hp, 5, 'the first scratch slips off, the second lands');

  r = duel({ hand: ['encore', 'nip', 'nip'], foes: [foe('weasel', { hp: 5 }), foe('weasel')] });
  r.play(0); r.play(0, 0);
  assert.equal(r.fight.foes[0].alive, false); assert.equal(hpOf(r, 1), 34, 'an encore whose foe is out turns on the next one'); assert.equal(r.fight.st.encore, undefined);
  r.play(0, 1); assert.equal(hpOf(r, 1), 28, 'only the next attack is doubled');

  r = duel({ hand: ['deepburrow', 'fluffup'], foes: [foe('snake', { move: 'hiss' })] });
  r.play(0); r.play(0); assert.equal(r.fight.hand.length, 0); assert.equal(r.fight.discard.length, 1, 'a power does not come back');
  r.endTurn(); assert.equal(r.fight.fluff, 5, 'Deep Burrow keeps Fluff');

  r = duel({ hand: ['raisin'], energy: 0 });
  r.play(0); assert.equal(r.fight.energy, 1); assert.equal(r.fight.hand.length, 2);

  r = duel({ hand: ['stickycoat', 'cosynest', 'lightfeet'], foes: [foe('weasel', { move: 'workup' }), foe('weasel', { move: 'workup' })], energy: 4 });
  r.play(0); r.play(0); r.play(0); assert.equal(r.fight.fluff, 1, 'Light Feet counts itself');
  r.endTurn(); assert.equal(r.fight.foes[0].st.burrs, 2); assert.equal(r.fight.foes[1].st.burrs, 2);

  r = duel({ hand: ['stampede', 'tailwhip', 'avalanche'], foes: [foe('weasel', { hp: 100 }), foe('weasel', { hp: 100 }), foe('weasel', { hp: 100 })], energy: 6 });
  r.play(0); assert.equal(r.fight.foes.reduce((s, x) => s + x.hp, 0), 300 - 24);
  r.play(0); r.play(0); assert.equal(r.fight.foes.reduce((s, x) => s + x.hp, 0), 300 - 24 - 24 - 84);

  // Cards nobody wants.
  r = duel({ hand: ['daze', 'thorn', 'mud', 'fright'], foes: [foe('snake', { move: 'hiss' })] });
  assert.match(r.play(0), /cannot be played/); assert.match(r.play(3), /cannot be played/);
  assert.equal(r.play(2), ''); assert.equal(r.fight.gone[0].id, 'mud');
  const h4 = r.hp; r.endTurn();
  assert.equal(h4 - r.hp, 2, 'a Thorn in hand stings'); assert.ok(r.fight.gone.some((c) => c.id === 'daze'), 'a Daze fades'); assert.ok(r.fight.discard.some((c) => c.id === 'thorn') && r.fight.discard.some((c) => c.id === 'fright'));

  // A hand never holds more than ten.
  r = duel({ hand: Array(9).fill('quicknip').concat(['popcorn']) });
  r.play(9); assert.equal(r.fight.hand.length, MAX_HAND, 'nine left and two to draw, but only room for one');
  // The discard pile is shuffled back in when the draw pile runs out.
  r = duel({ hand: ['popcorn'] }); r.fight.draw = [card('nip')]; r.fight.discard = [card('fluffup'), card('fluffup')];
  r.play(0); assert.equal(r.fight.hand.length, 2); assert.equal(r.fight.draw.length, 1); assert.ok(r.events.some((e) => e.t === 'shuffle'));

  // plays() lists exactly what cannot() allows.
  r = duel({ hand: ['nip', 'dustkick', 'fluffup', 'daze'], foes: [foe('weasel'), foe('weasel', { alive: false, hp: 0 }), foe('weasel')], energy: 1 });
  assert.deepEqual(r.plays(), [{ i: 0, t: 0 }, { i: 0, t: 2 }, { i: 2, t: -1 }]);
  assert.match(r.cannot(0), /Choose a foe/); assert.match(r.cannot(0, 1), /out of the fight/);
}

// ---------- Predators ----------
{
  // The young fox crouches, then pounces.
  let r = duel({ foes: [foe('youngfox', { move: 'crouch' })] });
  r.endTurn(); assert.equal(r.fight.foes[0].move, 'pounce'); assert.equal(r.fight.foes[0].fluff, 8);
  // The vizcacha steals, gives it back when knocked out, and keeps it if it gets away.
  r = duel({ hand: ['nip'], foes: [foe('vizcacha', { move: 'swipe' })] });
  const seeds = r.seeds; r.endTurn();
  assert.equal(r.seeds, seeds - 12); assert.equal(r.fight.foes[0].stolen, 12);
  r.fight.foes[0].hp = 1; r.fight.hand = [card('nip')]; r.play(0);
  assert.equal(r.phase, 'reward'); assert.ok(r.seeds >= seeds + 10, 'the seeds come back, with the fight’s own');
  r = duel({ foes: [foe('vizcacha', { move: 'swipe' })] });
  r.fight.fluff = 50; const s2 = r.seeds; r.endTurn(); assert.equal(r.seeds, s2, 'a blocked swipe steals nothing');
  r.fight.foes[0].move = 'swipe'; r.endTurn(); r.fight.foes[0].move = 'flee'; r.endTurn();
  assert.equal(r.phase, 'reward'); assert.equal(r.reward.seeds, 0); assert.equal(r.seeds, s2 - 12); assert.match(r.reward.note, /got away/);
  // The dozing owl sleeps until it is hurt, and is groggy for a turn when woken.
  r = duel({ hand: ['nip'], foes: [foe('dozingowl', { st: { doze: 3 }, mem: { asleep: 1 }, move: 'sleep', fluff: 3 })] });
  assert.equal(r.intentOf(0).kind, 'sleep');
  r.play(0); assert.equal(r.fight.foes[0].st.doze, undefined); assert.equal(r.fight.foes[0].move, 'stir');
  const hp = r.hp; r.endTurn(); assert.equal(r.hp, hp); assert.equal(r.fight.foes[0].move, 'talon');
  r = duel({ foes: [foe('dozingowl', { st: { doze: 3 }, mem: { asleep: 1 }, move: 'sleep' })] });
  r.endTurn(); r.endTurn(); assert.equal(r.fight.foes[0].move, 'sleep'); r.endTurn();
  assert.equal(r.fight.foes[0].move, 'talon', 'left alone, it wakes ready to strike');
  // The old fox calls two kits when it is half beaten, once.
  r = duel({ foes: [foe('oldfox', { hp: 60, maxHp: 130, move: 'snap' })] });
  r.fight.fluff = 99; r.endTurn(); assert.equal(r.fight.foes[0].move, 'call');
  r.fight.fluff = 99; r.endTurn(); assert.equal(r.fight.foes.length, 3); assert.equal(r.fight.foes[1].kind, 'kit'); assert.ok(r.fight.foes[1].move);
  assert.notEqual(r.fight.foes[0].move, 'call');
  // The cougar shakes everything off and turns furious at half health.
  r = duel({ foes: [foe('cougar', { hp: 100, maxHp: 270, move: 'swipe', st: { exposed: 3, winded: 3, burrs: 4 } })] });
  r.fight.fluff = 99; r.endTurn(); assert.equal(r.fight.foes[0].move, 'fury');
  r.fight.fluff = 99; r.endTurn();
  assert.deepEqual(r.fight.foes[0].st, { zoomies: 2 }); assert.equal(r.fight.foes[0].move, 'frenzy');
  // Beetles curl up the first time they are hurt; grisons turn furious when their packmate goes.
  r = duel({ hand: ['nip', 'nip'], foes: [foe('beetle', { st: { curl: 3 } })] });
  r.play(0); assert.equal(r.fight.foes[0].fluff, 3); r.play(0); assert.equal(hpOf(r), 40 - 6 - 3);
  r = duel({ hand: ['nip'], foes: [foe('grison', { hp: 2, st: { bond: 3 } }), foe('grison', { st: { bond: 3 } })] });
  r.play(0, 0); assert.equal(r.fight.foes[1].st.zoomies, 3);
  // Scavengers get hungrier; a Bristle answers every hit.
  r = duel({ hand: ['pricklycurl'], foes: [foe('scavenger', { st: { rage: 1 }, move: 'peck' })] });
  r.play(0); r.endTurn(); assert.equal(r.fight.foes[0].st.zoomies, 1); assert.equal(hpOf(r), 38);
  // A status card is added where the move says.
  r = duel({ foes: [foe('hornedowl', { move: 'screech' })] });
  const n = r.fight.draw.length; r.endTurn(); assert.equal(r.fight.draw.length + r.fight.hand.length, n + 2); assert.ok(r.found.cards.includes('daze'));
}

// ---------- Trinkets ----------
{
  let r = duel({ trinkets: ['haycube', 'pumice', 'collar', 'lantern', 'dusthouse'], seed: 9 });
  // Start-of-fight trinkets acted when the fight began, before duel() swapped the foes in.
  const real = Run.start({ seed: 9, hero: 'enzo' }); for (const t of ['haycube', 'pumice', 'collar', 'lantern', 'dusthouse']) real.gainTrinket(t);
  real.go(real.paths()[0]);
  assert.equal(real.fight.fluff, 8); assert.equal(real.fight.st.zoomies, 1); assert.equal(real.fight.st.bristle, 3); assert.equal(real.fight.energy, ENERGY + 1);
  assert.ok(real.fight.foes.every((x) => x.st.exposed === 1));
  void r;

  r = duel({ hand: ['nip', 'nip'], trinkets: ['chewstick'] });
  assert.match(r.textOf(r.fight.hand[0]), /Deal 14 damage/); r.play(0); assert.equal(hpOf(r), 26); r.play(0); assert.equal(hpOf(r), 20, 'only the first attack');

  r = duel({ hand: ['burrfling', 'dustkick', 'nip'], trinkets: ['burrcomb', 'lavaledge'], energy: 4 });
  r.play(0); assert.equal(r.fight.foes[0].st.burrs, 5); r.play(0); r.play(0); assert.equal(hpOf(r), 40 - 5 - 8 - 10, 'three quarters more');

  r = duel({ trinkets: ['slab', 'hammock'], foes: [foe('skunk', { move: 'scratch' })] });
  const hp = r.hp; r.endTurn(); assert.equal(hp - r.hp, 3, '6 Fluff from the hammock soaks the first scratch and one of the second; the slab takes 1 off the 4 left');

  r = duel({ trinkets: ['moss', 'wheel'], foes: [foe('snake', { move: 'hiss' })] });
  r.endTurn(); assert.equal(r.fight.fluff, 12); assert.equal(r.fight.energy, ENERGY);
  r.fight.foes[0].move = 'hiss'; r.endTurn(); assert.equal(r.fight.turn, 3); assert.equal(r.fight.energy, ENERGY + 1);

  r = duel({ hand: ['nip'], trinkets: ['alarmcall'], foes: [foe('weasel', { hp: 3 }), foe('weasel')] });
  r.play(0, 0); assert.equal(r.fight.energy, ENERGY); assert.equal(r.fight.hand.length, 1);

  r = duel({ hand: ['popcorn'], trinkets: ['goggles', 'hayrack'] });
  r.fight.draw = [card('nip'), card('daze')]; r.fight.discard = [card('fluffup')];
  r.play(0); assert.equal(r.fight.hand.length, 3, 'a Daze drawn draws another, even through a shuffle'); assert.equal(r.fight.fluff, 5);

  r = Run.start({ seed: 2, hero: 'enzo' });
  const max = r.maxHp; r.gainTrinket('wolfberry'); assert.equal(r.maxHp, max + 10); assert.equal(r.hp, max + 10);
  r.hp = 10; r.gainTrinket('summittea'); assert.equal(r.hp, r.maxHp); assert.equal(r.maxHp, max + 22);
  r.gainTrinket('chewtoy'); assert.equal(r.deck.filter((c) => c.up).length, 2);
  r.gainTrinket('chewtoy'); assert.equal(r.trinkets.filter((t) => t === 'chewtoy').length, 1, 'no trinket twice');

  r = duel({ trinkets: ['springwater', 'suncrown', 'emptypouch', 'twigs', 'claws'], hand: ['nip'] });
  const real2 = Run.start({ seed: 5, hero: 'enzo' }); for (const t of ['springwater', 'suncrown', 'emptypouch', 'twigs', 'claws']) real2.gainTrinket(t);
  real2.go(real2.paths()[0]);
  assert.equal(real2.fight.energy, ENERGY + 3); assert.equal(real2.fight.hand.length, HAND + 1); assert.equal(real2.fight.st.zoomies, 2);
  assert.ok(real2.fight.foes.every((x) => x.st.zoomies === 1)); assert.equal([...real2.fight.draw, ...real2.fight.hand].filter((c) => c.id === 'thorn').length, 2);
  assert.equal(real2.canNap, false);
  r.fight.foes[0].hp = 1; r.play(0); assert.equal(r.reward.seeds, 0, 'a hole in the pouch');

  // The scarf and the raisin stash mend after a fight.
  r = duel({ hand: ['nip'], trinkets: ['raisinstash'] }); r.hp = 20; r.fight.foes[0].hp = 1; r.play(0); assert.equal(r.hp, 35);
  r = duel({ hand: ['nip'], trinkets: ['clover', 'pebble'] }); r.fight.foes[0].hp = 1; r.play(0);
  assert.equal(r.reward.cards.length, 4); assert.ok(r.reward.seeds >= 22);
}

// ---------- Rewards, burrows, stalls and meetings ----------
{
  let r = duel({ hand: ['nip'] });
  r.fight.foes[0].hp = 1; const seeds = r.seeds; r.play(0);
  assert.equal(r.phase, 'reward'); assert.ok(r.fight, 'the finished fight stays until the stop is left'); assert.equal(r.reward.cards.length, 3);
  assert.equal(new Set(r.reward.cards.map((c) => c.id)).size, 3, 'three different cards'); assert.equal(r.seeds, seeds + r.reward.seeds);
  assert.equal(r.takeCard(1), ''); assert.equal(r.deck.length, 11); assert.match(r.takeCard(0), /no card/);
  assert.equal(r.leave(), ''); assert.equal(r.phase, 'map'); assert.equal(r.fight, null); assert.deepEqual(r.walked, [r.at]);
  assert.ok(r.paths().every((id) => r.map[id].row === 1));

  // An alpha drops a trinket; a guardian offers three of its own and mends you.
  r = Run.start({ seed: 8, hero: 'dora' });
  r.at = r.map.findIndex((n) => r.map[n.next[0]]?.type === 'alpha' || n.next.some((m) => r.map[m].type === 'alpha'));
  const alpha = r.map[r.at].next.find((m) => r.map[m].type === 'alpha');
  assert.equal(r.go(alpha), ''); assert.equal(r.fight.kind, 'alpha');
  r.fight.foes.forEach((x) => { x.hp = 1; x.fluff = 0; x.st = {}; }); r.fight.hand = [card('avalanche')]; r.fight.energy = 3; r.play(0);
  assert.equal(r.phase, 'reward'); assert.ok(r.reward.trinket && r.has(r.reward.trinket)); assert.ok(r.reward.seeds >= 25);
  r.skipCards(); r.leave();
  r.at = r.map.find((n) => n.row === ROWS - 1).id; r.hp = 30;
  assert.equal(r.go(r.map.length - 1), ''); assert.equal(r.fight.kind, 'boss'); assert.equal(r.fight.foes[0].kind, 'oldfox');
  r.fight.foes.forEach((x) => { x.hp = 1; }); r.fight.hand = [card('avalanche')]; r.fight.energy = 3; r.play(0);
  assert.equal(r.reward.relics.length, 3); assert.ok(r.reward.cards.every((c) => CARDS[c.id].rarity === 'rare'));
  assert.match(r.leave(), /trinket first/);
  assert.equal(r.takeRelic(0), ''); assert.equal(r.leave(), '');
  assert.equal(r.act, 1); assert.equal(r.at, -1); assert.equal(r.hp, r.maxHp, 'beating a guardian mends everything'); assert.deepEqual(r.walked, []);
  // The last guardian ends the climb.
  r.act = 2; r.at = r.map.find((n) => n.row === ROWS - 1).id;
  r.go(r.map.length - 1); assert.equal(r.fight.foes[0].kind, 'cougar');
  r.fight.foes.forEach((x) => { x.hp = 1; }); r.fight.hand = [card('nip')]; r.play(0);
  assert.equal(r.phase, 'won');
  // And running out of health ends it the other way.
  r = duel({ foes: [foe('puma', { move: 'maul' })] }); r.hp = 5; r.endTurn();
  assert.equal(r.phase, 'lost'); assert.equal(r.hp, 0); assert.match(r.endTurn(), /no fight/);

  // Burrows.
  r = Run.start({ seed: 11, hero: 'enzo' }); r.at = r.map.find((n) => n.row === ROWS - 2).id; r.hp = 20;
  r.go(r.paths()[0]); assert.equal(r.phase, 'rest'); assert.equal(r.napHeal, 24);
  assert.match(r.leave(), /Nap or groom/);
  const again = Run.load(r.save());
  assert.equal(r.nap(), ''); assert.equal(r.hp, 44); assert.equal(r.phase, 'map');
  const nip = again.deck.find((c) => c.id === 'nip');
  assert.equal(again.groom(nip.uid), ''); assert.equal(nip.up, true); assert.match(again.groom(nip.uid), /no burrow/);
  assert.equal(costOf({ id: 'bellyflop', up: true }), 0); assert.equal(valsOf(nip).d, 9);

  // Stalls.
  r = Run.start({ seed: 12, hero: 'enzo' });
  const stallAt = r.map.find((n) => n.type === 'stall'); r.at = r.map.find((n) => n.next.includes(stallAt.id)).id;
  r.seeds = 1000; r.go(stallAt.id);
  assert.equal(r.phase, 'stall'); assert.equal(r.stall.cards.length, 5); assert.equal(r.stall.trinkets.length, 2);
  const price = r.stall.cards[0].price; assert.equal(r.buyCard(0), ''); assert.equal(r.seeds, 1000 - price); assert.equal(r.deck.length, 11); assert.match(r.buyCard(0), /not for sale/);
  assert.equal(r.buyTrinket(0), ''); assert.equal(r.trinkets.length, 2);
  assert.equal(r.removePrice, REMOVE_PRICE);
  assert.equal(r.buyRemoval(r.deck[0].uid), ''); assert.equal(r.deck.length, 10); assert.equal(r.removePrice, REMOVE_PRICE + REMOVE_STEP); assert.match(r.buyRemoval(r.deck[0].uid), /already/);
  r.seeds = 0; assert.match(r.buyCard(1), /Not enough seeds/);
  assert.equal(r.leave(), ''); assert.equal(r.phase, 'map');
  const cheap = Run.start({ seed: 12, hero: 'enzo' }); cheap.gainTrinket('loyalty'); assert.equal(cheap.removePrice, Math.round(REMOVE_PRICE * 0.7));

  // Every meeting, every option: each can be taken (when it is open) and says what happened.
  assert.equal(EVENT_IDS.length, 8);
  for (const id of EVENT_IDS) for (let i = 0; i < 3; i++) {
    const e = Run.start({ seed: 30 + i, hero: 'dora' });
    e.phase = 'event'; e.event = { id, done: '' }; e.hp = 40; e.seeds = 200;
    const v = e.eventView(), o = v.options[i];
    if (!o) continue;
    assert.ok(v.name && v.text && o.label && o.detail);
    assert.match(e.leave(), /Choose what to do/);
    if (!o.ok) { assert.match(e.choose(i), /cannot/); continue; }
    if (o.pick) assert.match(e.choose(i), /Choose a card/);
    const before = JSON.stringify([e.hp, e.maxHp, e.seeds, e.deck, e.trinkets]);
    assert.equal(e.choose(i, o.pick ? e.pickable(o.pick)[0].uid : -1), '', `${id} option ${i}`);
    assert.ok(e.eventView().done.length > 10);
    if (!/Nothing happens/.test(o.detail)) assert.notEqual(JSON.stringify([e.hp, e.maxHp, e.seeds, e.deck, e.trinkets]), before, `${id} option ${i} does something`);
    assert.ok(e.hp > 0 && e.hp <= e.maxHp);
    assert.match(e.choose(i), /nothing to choose/);
    assert.equal(e.leave(), ''); assert.equal(e.phase, 'map');
  }
  const h = Run.start({ seed: 1, hero: 'dora' }); h.phase = 'event'; h.event = { id: 'hollow', done: '' };
  const gone = h.deck[3]; h.choose(0, gone.uid); assert.equal(h.deck.length, 9); assert.ok(!h.deck.includes(gone));
  const el = Run.start({ seed: 1, hero: 'dora' }); el.phase = 'event'; el.event = { id: 'elder', done: '' };
  el.choose(1, el.deck[9].uid); assert.equal(el.deck.filter((c) => c.id === 'dustkick').length, 2);
}

// ---------- Saving ----------
{
  const r = Run.start({ seed: 77, hero: 'dora', level: 2 });
  const back = Run.load(r.save());
  assert.deepEqual(JSON.parse(back.save()), JSON.parse(r.save()));
  // Saved in a fight, a climb walks back into the same fight from its start.
  r.go(r.paths()[1]);
  const opening = r.fight.hand.map((c) => c.id), foes = r.fight.foes.map((x) => [x.kind, x.hp, x.move]);
  fightTurn(r); fightTurn(r);
  const again = Run.load(r.save());
  assert.equal(again.phase, 'fight'); assert.equal(again.at, r.at); assert.equal(again.stats.stops, 1);
  assert.deepEqual(again.fight.hand.map((c) => c.id), opening); assert.deepEqual(again.fight.foes.map((x) => [x.kind, x.hp, x.move]), foes);
  assert.equal(again.hp, again.maxHp, 'none of the lost health is kept, and none of the turns');
  // The two then play out the same way.
  const a = climb(Run.load(r.save())), b = climb(again);
  assert.equal(a.run.phase, b.run.phase); assert.deepEqual(a.run.stats, b.run.stats);
  assert.equal(Run.load('nonsense'), null); assert.equal(Run.load('{"v":0}'), null); assert.equal(Run.load(JSON.stringify({ ...JSON.parse(r.save()), deck: [{ id: 'nope', up: false, uid: 1 }] })), null);
  // A clone can be played on without touching the run it came from.
  const live = Run.start({ seed: 5, hero: 'enzo' }); live.go(live.paths()[0]);
  const snap = live.save(), state = JSON.stringify([live.hp, live.seeds, live.deck, live.trinkets, live.fight]);
  const copy = live.clone(); for (let i = 0; i < 30 && copy.phase === 'fight'; i++) fightTurn(copy);
  assert.equal(JSON.stringify([live.hp, live.seeds, live.deck, live.trinkets, live.fight]), state); assert.equal(live.save(), snap);
}

// ---------- Altitudes ----------
{
  assert.equal(ALTITUDES.length, 6);
  const at = (level) => { const r = Run.start({ seed: 21, hero: 'enzo', level }); r.go(r.paths()[0]); return r; };
  const base = at(0), one = at(1);
  assert.deepEqual(one.fight.foes.map((x) => x.maxHp), base.fight.foes.map((x) => Math.round(x.maxHp * 1.06)));
  const two = duel({ level: 2, foes: [foe('puma', { move: 'maul' }), foe('weasel', { move: 'nip' })] });
  assert.equal(two.intentOf(0).dmg, 23); assert.equal(two.intentOf(1).dmg, 5, 'small bites round down to what they were');
  const three = Run.start({ seed: 21, hero: 'enzo', level: 3 }); assert.equal(three.napHeal, 20);
  assert.equal(Run.start({ seed: 21, hero: 'enzo', level: 4 }).deck.filter((c) => c.id === 'fright').length, 1);
  assert.equal(Run.start({ seed: 21, hero: 'enzo', level: 5 }).maxHp, HEROES.enzo.hp - 5);
  assert.equal(Run.start({ seed: 21, hero: 'enzo', level: 99 }).level, 5);
}

// ---------- The bot climbs: the mountain can be beaten, and gets harder with height ----------
{
  const rate = (hero, level, n) => { let w = 0; for (let s = 1; s <= n; s++) if (climb({ seed: s * 911 + level, hero, level }).won) w++; return w / n; };
  const base = HERO_IDS.map((h) => rate(h, 0, 80)), top = HERO_IDS.map((h) => rate(h, 5, 80));
  for (const [i, h] of HERO_IDS.entries()) {
    assert.ok(base[i] >= 0.5 && base[i] <= 0.95, `${HEROES[h].name} reaches the summit from Base Camp between 50% and 95% of the time (${Math.round(base[i] * 100)}%)`);
    assert.ok(top[i] >= 0.03 && top[i] <= base[i] - 0.2, `Altitude 5 is much harder for ${HEROES[h].name} but not hopeless (${Math.round(top[i] * 100)}%)`);
  }
  assert.ok(Math.abs(base[0] - base[1]) <= 0.2, 'neither chinchilla is far ahead of the other');
}

// ---------- The words the hover notes explain ----------
{
  assert.deepEqual(glossFor('Deal 8 damage. Apply 2 Exposed.').map((g) => g.name), ['Exposed']);
  assert.deepEqual(glossFor('Gain 6 Fluff and 2 Bristle.').map((g) => g.name), ['Fluff', 'Bristle'], 'in the order the words come up');
  assert.deepEqual(glossFor('Cannot be played.', 'Thorn'), [], 'a card is not explained by its own name');
  assert.deepEqual(glossFor('puts 2 Thorns in your draw pile').map((g) => g.name), ['Thorn'], 'plurals count');
  assert.equal(new Set(GLOSSARY.map((g) => g.name)).size, GLOSSARY.length);
  // Every status a card can name in its text has an entry, so no card leaves a word unexplained.
  const named = ['zoomies', 'fur', 'bristle', 'burrs', 'exposed', 'winded', 'matted'];
  for (const id of named) assert.ok(GLOSSARY.some((g) => g.name === STATUS[id].name), `${STATUS[id].name} is in the glossary`);
  for (const id of CARD_IDS) for (const up of [false, true]) {
    const text = describe({ id, up });
    for (const st of named) if (new RegExp(`\\b${STATUS[st].name}\\b`).test(text) && CARDS[id].name !== STATUS[st].name) assert.ok(glossFor(text, CARDS[id].name).some((g) => g.name === STATUS[st].name), `${id} explains ${STATUS[st].name}`);
    if (CARDS[id].exhaust) assert.ok(/Exhaust/.test(text), `${id} says it exhausts`);
  }
}
console.log('Summit Shuffle engine checks passed.');
