import assert from 'node:assert/strict';
import {
  Run, Rand, evaluate, scorePlay, HANDS, CHARMS, TREATS, BOSSES, BLIND, ANTES, ANTE_BASE, CHARM_SLOTS, ITEM_SLOTS, HAND_SIZE, PLAYS, DISCARDS, START_NUTS,
  INTEREST_CAP, REROLL, COST, SAVE_VERSION, anteBase, cardChips, charmById, freshProfile, loadProfile, record,
} from '../.checks/acorn-hand-game.js';

let nextId = 1000;
const C = (rank, suit = 0, gloss = '') => ({ id: nextId++, rank, suit, gloss });
const hand = (...cs) => evaluate(cs).hand;

// Reading hands
{
  assert.equal(hand(C(14), C(2, 1)), 'high');
  assert.deepEqual(evaluate([C(3), C(14, 1), C(9, 2)]).scoring, [1], 'a high card scores only the top card');
  assert.equal(hand(C(9), C(9, 1)), 'pair');
  assert.equal(hand(C(9), C(9, 1), C(4), C(4, 2), C(13)), 'two');
  assert.deepEqual(evaluate([C(9), C(9, 1), C(4), C(4, 2), C(13)]).scoring, [0, 1, 2, 3], 'the kicker does not score');
  assert.equal(hand(C(7), C(7, 1), C(7, 2)), 'three');
  assert.equal(hand(C(5), C(6, 1), C(7, 2), C(8, 3), C(9)), 'straight');
  assert.equal(hand(C(14), C(2, 1), C(3, 2), C(4, 3), C(5)), 'straight', 'an ace can be low');
  assert.equal(hand(C(10), C(11, 1), C(12, 2), C(13, 3), C(14)), 'straight', 'or high');
  assert.equal(hand(C(12), C(13, 1), C(14, 2), C(2, 3), C(3)), 'high', 'but a straight does not wrap round');
  assert.equal(hand(C(2, 1), C(6, 1), C(9, 1), C(11, 1), C(13, 1)), 'flush');
  assert.equal(hand(C(3), C(3, 1), C(3, 2), C(8), C(8, 3)), 'full');
  assert.equal(hand(C(6), C(6, 1), C(6, 2), C(6, 3), C(2)), 'four');
  assert.deepEqual(evaluate([C(6), C(6, 1), C(6, 2), C(6, 3), C(2)]).scoring, [0, 1, 2, 3]);
  assert.equal(hand(C(5, 2), C(6, 2), C(7, 2), C(8, 2), C(9, 2)), 'sflush');
  assert.equal(hand(C(8), C(8, 1), C(8, 2), C(8, 3), C(8)), 'five');
  assert.equal(hand(C(8, 1), C(8, 1), C(8, 1), C(8, 1), C(8, 1)), 'ffive');
  assert.equal(hand(C(2, 1), C(6, 1), C(9, 1), C(11, 1)), 'high', 'four of a suit is not a flush');
  assert.equal(evaluate([C(2, 1), C(6, 1), C(9, 1), C(11, 1), C(4)], { fourFlush: true, fourStraight: true, splash: false }).hand, 'flush', 'unless Zephyr says so');
  assert.equal(evaluate([C(5), C(6, 1), C(7, 2), C(8, 3), C(13)], { fourFlush: true, fourStraight: true, splash: false }).hand, 'straight');
  assert.deepEqual(evaluate([C(9), C(9, 1), C(2), C(4)], { fourFlush: false, fourStraight: false, splash: true }).scoring, [0, 1, 2, 3], 'Luna scores every card');
  assert.equal(cardChips(2), 2); assert.equal(cardChips(10), 10); assert.equal(cardChips(12), 10); assert.equal(cardChips(14), 11);
}

// Scoring
const base = (over = {}) => ({ held: [], charms: [], states: [], levels: Object.fromEntries(HANDS.map((h) => [h.id, 1])), rules: { fourFlush: false, fourStraight: false, splash: false },
  playsLeft: 2, discardsLeft: 2, nuts: 0, deckLeft: 30, firstPlay: false, lastPlay: false, boss: null, fame: null, sageLevels: 0, ...over });
const score = (played, over) => scorePlay(base({ played, ...over }));
{
  const s = score([C(13), C(13, 1)]);
  assert.equal(s.hand, 'pair'); assert.equal(s.chips, 10 + 10 + 10); assert.equal(s.mult, 2); assert.equal(s.total, 60, 'a pair of kings: (10 + 10 + 10) × 2');
  assert.equal(s.steps[0].who, 'hand'); assert.equal(s.steps.at(-1).chips, 30, 'the steps end on the totals');
  const lv = score([C(13), C(13, 1)], { levels: { ...base().levels, pair: 3 } });
  assert.equal(lv.chips, 10 + 2 * 15 + 20); assert.equal(lv.mult, 2 + 2 * 1);
  assert.equal(score([C(9, 0, 'honey')]).chips, 5 + 9 + 30, 'honey adds chips');
  assert.equal(score([C(9, 0, 'ember')]).mult, 1 + 4, 'ember adds mult');
  assert.equal(score([C(9, 0, 'crystal')]).mult, 1.5, 'crystal multiplies');
  const own = (...ids) => ({ charms: ids.map((id) => ({ id, state: charmById(id).start ?? 0 })), states: ids.map((id) => charmById(id).start ?? 0) });
  assert.equal(score([C(13), C(13, 1)], own('dora')).mult, 6);
  assert.equal(score([C(13), C(13, 1)], own('enzo')).chips, 70);
  assert.equal(score([C(13, 0), C(13, 1)], own('bramble')).mult, 2 + 3, 'suit charms count only their suit');
  assert.equal(score([C(13), C(13, 1)], own('willow', 'pebble')).mult, 2 + 8, 'hand charms ask what the hand contains');
  assert.equal(score([C(13), C(13, 1), C(13, 2)], own('willow', 'pebble')).mult, 3 + 8 + 12);
  assert.equal(score([C(2, 1), C(6, 1), C(9, 1), C(11, 1), C(13, 1)], own('ember')).mult, 8, 'Ember doubles a flush');
  assert.equal(score([C(13), C(13, 1)], own('dora', 'ember')).mult, 6, 'and leaves other hands alone');
  // Order matters: +mult then ×mult beats the other way round.
  const late = score([C(2, 1), C(6, 1), C(9, 1), C(11, 1), C(13, 1)], own('dora', 'ember')).mult, early = score([C(2, 1), C(6, 1), C(9, 1), C(11, 1), C(13, 1)], own('ember', 'dora')).mult;
  assert.equal(late, (4 + 4) * 2); assert.equal(early, 4 * 2 + 4);
  assert.equal(score([C(13), C(13, 1)], { ...own('onyx'), held: [C(13, 2), C(13, 3), C(4)] }).mult, 2 * 1.5 * 1.5, 'Onyx counts kings held');
  assert.equal(score([C(13), C(13, 1)], own('aurora')).chips, 10 + 10 + 10 + 10, 'Aurora scores the first card twice');
  assert.equal(score([C(13), C(13, 1)], own('bloom')).chips, 10 + 40, 'Bloom scores every face card twice');
  assert.equal(score([C(13), C(13, 1)], own('echo', 'dora')).mult, 2 + 4 + 4, 'Echo copies the charm to its right');
  assert.equal(score([C(13), C(13, 1)], own('dora', 'echo')).mult, 6, 'and does nothing with nothing to copy');
  assert.equal(score([C(13), C(13, 1)], own('dora', 'stag')).mult, (2 + 4) * 1.5, 'Stag grows with the charms owned');
  assert.equal(score([C(13), C(13, 1)], { ...own('sable'), lastPlay: true }).mult, 4);
  assert.equal(score([C(2, 3), C(5, 2), C(9, 1), C(11)], own('prism')).mult, 3, 'Prism wants all four suits');
  assert.equal(score([C(3), C(3, 1)], own('wren', 'fennel')).mult, 2 + 4 + 1 + 4 + 2);
  assert.equal(score([C(13), C(13, 1)], { ...own('mags'), nuts: 10 }).mult, 2 + 3);
  assert.equal(score([C(13), C(13, 1)], { ...own('burrowby'), discardsLeft: 2 }).chips, 30 + 50);
  // Boss rules inside a score
  assert.equal(score([C(13, 1), C(13, 2)], { boss: 'suit1' }).chips, 10 + 10, 'a sleeping suit scores nothing');
  const fame = score([C(13), C(13, 1)], { boss: 'fame', fame: 'pair' });
  assert.equal(fame.chips, 5 + 20); assert.equal(fame.mult, 1, 'the Lizard halves the most-played hand');
}

// A run: rounds, plays and discards
const setHand = (run, cards) => { run.deck.push(...cards); run.round.hand = cards.map((c) => c.id); return cards.map((c) => c.id); };
{
  const run = new Run(7);
  assert.equal(run.deck.length, 52); assert.equal(run.nuts, START_NUTS); assert.equal(run.phase, 'pick');
  assert.equal(run.targetOf(0), ANTE_BASE[0]); assert.equal(run.targetOf(1), Math.round(ANTE_BASE[0] * 1.5));
  assert.ok(run.start()); assert.equal(run.phase, 'round'); assert.equal(run.round.hand.length, HAND_SIZE); assert.equal(run.round.draw.length, 52 - HAND_SIZE);
  assert.equal(run.round.plays, PLAYS); assert.equal(run.round.discards, DISCARDS);
  assert.equal(run.whyNot([]), 'Choose the cards to play.'); assert.match(run.whyNot(run.round.hand.slice(0, 6)), /at most 5/);
  const before = run.round.hand.slice(0, 3);
  assert.ok(run.discard(before)); assert.equal(run.round.discards, DISCARDS - 1); assert.equal(run.round.hand.length, HAND_SIZE);
  assert.ok(before.every((id) => !run.round.hand.includes(id)), 'discarded cards leave the hand');
  const ids = setHand(run, [C(14), C(14, 1), C(14, 2), C(14, 3), C(2)]);
  const preview = run.preview(ids.slice(0, 4)); assert.equal(preview.hand, 'four');
  assert.equal(run.round.score, 0, 'a preview changes nothing');
  const s = run.play(ids.slice(0, 4));
  assert.equal(s.total, preview.total); assert.equal(run.played.four, 1);
  assert.equal(run.phase, 'cashout', 'four aces beat the first round');
  assert.equal(run.cash.blind, BLIND[0].reward); assert.equal(run.cash.plays, PLAYS - 1);
  assert.equal(run.cash.interest, Math.min(INTEREST_CAP, Math.floor(run.nuts / 5)));
  const nuts = run.nuts, pay = run.cash.total; assert.ok(run.collect()); assert.equal(run.nuts, nuts + pay, 'collecting pays the round out');
  assert.equal(run.phase, 'shop'); assert.equal(run.blind, 1);
}
{
  // Running out of plays ends the run.
  const run = new Run(3); run.start(); run.round.target = 10 ** 9;
  while (run.phase === 'round') run.play([run.round.hand[0]]);
  assert.equal(run.phase, 'over'); assert.equal(run.round.plays, 0);
  assert.equal(run.play([run.round.hand[0]]), null, 'and nothing more can be played');
}

// The shop, items and skips
{
  const run = new Run(11); run.start(); run.round.target = 1; run.play([run.round.hand[0]]); run.collect();
  run.nuts = 100;
  const offered = run.shop.charms.filter(Boolean); assert.equal(offered.length, 2, 'two charms on offer'); assert.equal(new Set(offered).size, 2);
  const price = run.priceOf(offered[0]); assert.ok(run.buyCharm(0)); assert.equal(run.nuts, 100 - price); assert.equal(run.charms.length, 1);
  assert.equal(run.buyCharm(0), false, 'a bought slot is empty');
  const shown = run.shop.charms.filter(Boolean);
  assert.equal(run.rerollCost, REROLL); assert.ok(run.reroll()); assert.equal(run.rerollCost, REROLL + 1, 'rerolls cost one more each time');
  assert.ok(run.shop.charms.every((id) => !shown.includes(id)), 'a reroll shows new charms');
  assert.ok(run.shop.charms.every((id) => id === null || !run.charms.some((c) => c.id === id)), 'the shop does not offer what you own');
  const nuts = run.nuts; assert.ok(run.sell(0)); assert.equal(run.nuts, nuts + Math.floor(price / 2)); assert.equal(run.charms.length, 0);
  assert.ok(run.buyItem(0)); assert.equal(run.items.length, 1); assert.ok(run.buyItem(1)); assert.equal(run.items.length, ITEM_SLOTS);
  run.shop.items[0] = { kind: 'treat', id: 'tea' }; assert.equal(run.buyItem(0), false, 'item slots are full');
  for (let i = 0; i < CHARM_SLOTS; i++) run.charms.push({ id: CHARMS[i].id, state: 0 });
  run.shop.charms[0] = CHARMS[10].id; assert.equal(run.buyCharm(0), false, 'charm slots are full');
  assert.ok(run.shift(0, 1)); assert.equal(run.charms[1].id, CHARMS[0].id, 'charms can be reordered');
  assert.ok(run.leave()); assert.equal(run.phase, 'pick');
  run.items = [];
  assert.ok(run.skip()); assert.equal(run.items.length, 1, 'skipping the big round gives a free item'); assert.equal(run.blind, 2);
  assert.equal(run.skip(), null, 'the boss cannot be skipped');
}
{
  // Every treat does what it says.
  const run = new Run(5); run.start();
  const treat = (id, cards) => { run.items = [{ kind: 'treat', id }]; const ids = setHand(run, cards); assert.equal(run.itemWhyNot(0, ids), null, id); assert.ok(run.useItem(0, ids), id); return cards; };
  assert.equal(treat('honey', [C(4)])[0].gloss, 'honey'); assert.equal(treat('spice', [C(4)])[0].gloss, 'ember');
  assert.equal(treat('dew', [C(4)])[0].gloss, 'crystal'); assert.equal(treat('leaf', [C(4)])[0].gloss, 'gold');
  for (const s of [0, 1, 2, 3]) assert.equal(treat(`dye${s}`, [C(4, (s + 1) % 4)])[0].suit, s);
  assert.equal(treat('sprout', [C(4)])[0].rank, 5); assert.equal(treat('sprout', [C(14)])[0].rank, 14);
  const deck = run.deck.length, m = treat('mirror', [C(9, 2)]);
  assert.equal(run.deck.length, deck + 2, 'the card set into the hand, and its copy'); assert.ok(run.hand.some((c) => c.id !== m[0].id && c.rank === 9 && c.suit === 2), 'the copy joins the hand');
  const gone = treat('compost', [C(3), C(3, 1)]); assert.ok(gone.every((c) => !run.deck.includes(c)), 'compost removes cards for good');
  assert.equal(run.round.hand.length, HAND_SIZE, 'and the hand refills');
  run.nuts = 30; run.items = [{ kind: 'treat', id: 'tea' }]; assert.ok(run.useItem(0)); assert.equal(run.nuts, 50, 'tea adds at most 20');
  run.items = [{ kind: 'treat', id: 'wish' }]; assert.ok(run.useItem(0)); assert.equal(run.charms.length, 1);
  run.items = [{ kind: 'almanac', id: 'flush' }]; assert.ok(run.useItem(0)); assert.equal(run.levels.flush, 2);
  run.items = [{ kind: 'treat', id: 'honey' }]; assert.match(run.itemWhyNot(0, []), /Select/);
  assert.equal(TREATS.length, 13);
}

// Charms that act outside a score
{
  const run = new Run(9); run.start(); run.charms = [{ id: 'cinder', state: 0 }, { id: 'bracken', state: 0 }, { id: 'sorrel', state: 0 }, { id: 'sage', state: 0 }];
  const nuts = run.nuts;
  run.discard(setHand(run, [C(11), C(12), C(3)])); assert.equal(run.charms[1].state, 9, 'Bracken grows by 3 a discarded card'); assert.equal(run.nuts, nuts + 2, 'Sorrel pays for faces');
  run.round.target = 10 ** 9;
  const ids = setHand(run, [C(5), C(5, 1)]);
  run.play(ids); assert.equal(run.charms[0].state, 1, 'Cinder grows each play'); assert.equal(run.levels.pair, 2, 'Sage levels the first hand of a round');
  run.play([run.round.hand[0]]); assert.equal(run.levels.high, 1, 'but only the first');
  const won = new Run(9); won.start(); won.charms = [{ id: 'cashew', state: 0 }, { id: 'comet', state: 1 }]; won.round.target = 1; won.play([won.round.hand[0]]);
  assert.equal(won.cash.charms, 4, 'Cashew pays when a round is won');
  assert.equal(won.charms[1].state, 1, 'Comet grows only on bosses');
  assert.equal(new Run(1).handSize, HAND_SIZE);
  const rules = new Run(1); rules.charms = [{ id: 'lantern', state: 0 }, { id: 'thrift', state: 0 }, { id: 'tumble', state: 0 }];
  assert.equal(rules.handSize, HAND_SIZE + 1); assert.equal(rules.maxDiscards, DISCARDS + 1); assert.equal(rules.maxPlays, PLAYS + 1);
  rules.charms = [{ id: 'regent', state: 0 }]; assert.equal(rules.handSize, HAND_SIZE - 1);
  assert.equal(CHARMS.length, 44); assert.equal(new Set(CHARMS.map((c) => c.id)).size, 44);
  for (const c of CHARMS) assert.ok(c.text.endsWith('.') && COST[c.rarity] > 0, c.id);
}

// Bosses
{
  const boss = (rule, seed = 2) => { const run = new Run(seed); run.bosses = [rule]; run.blind = 2; run.start(); return run; };
  assert.equal(boss('small').round.hand.length, HAND_SIZE - 1);
  assert.equal(boss('plays').round.plays, 3);
  assert.equal(boss('nodiscard').round.discards, 0);
  assert.equal(boss('shell').round.target, Math.round(ANTE_BASE[0] * 2 * 1.5));
  const fog = boss('fog'); assert.deepEqual(fog.round.facedown, fog.round.hand, 'the Skunk deals the first hand face down');
  const veil = boss('veil'); assert.ok(veil.round.facedown.every((id) => veil.card(id).rank >= 11 && veil.card(id).rank <= 13));
  const fogged = boss('fog'); fogged.round.facedown = [fogged.round.hand[3]]; const hid = fogged.round.hand[3]; fogged.sort('rank');
  assert.equal(fogged.round.hand.at(-1), hid, 'sorting puts a face-down card last, whatever it is');
  const five = boss('five'); assert.match(five.whyNot(five.round.hand.slice(0, 2)), /exactly five/); assert.equal(five.whyNot(five.round.hand.slice(0, 5)), null);
  const trickle = boss('trickle'); trickle.round.target = 10 ** 9; trickle.discard(trickle.round.hand.slice(0, 5)); assert.equal(trickle.round.hand.length, 6, 'the Beetle lets three cards back');
  // The rivals are chosen so the same rule never comes twice in a row, and all of them come round before any repeats.
  const run = new Run(4); run.bossFor(26);
  assert.equal(new Set(run.bosses.slice(0, BOSSES.length)).size, BOSSES.length);
  assert.ok(run.bosses.every((b, i) => i === 0 || b !== run.bosses[i - 1]));
}

// Antes, the win and endless
{
  const run = new Run(21);
  for (let i = 0; i < ANTES * 3; i++) {
    if (run.phase === 'shop') run.leave();
    run.start(); run.round.target = 1; run.play([run.round.hand[0]]); assert.ok(run.collect());
  }
  assert.equal(run.phase, 'victory'); assert.equal(run.ante, ANTES + 1);
  const p = record(record(freshProfile(), run, true), run, false);
  assert.equal(p.wins, 1, 'the record counts the win on the victory screen'); assert.equal(p.runs, 1); assert.equal(p.bestAnte, ANTES);
  assert.ok(run.goEndless()); assert.equal(run.phase, 'shop'); assert.ok(run.endless);
  assert.ok(anteBase(9) > anteBase(8)); assert.equal(anteBase(8), ANTE_BASE[7]);
  assert.deepEqual(loadProfile({ v: SAVE_VERSION, runs: 2, wins: 1, bestAnte: 3, bestHand: 9, seen: ['dora', 'nobody'] }).seen, ['dora']);
  assert.deepEqual(loadProfile('nonsense'), freshProfile());
}

// Seeds replay, saves round-trip, broken saves are refused
{
  const go = (seed) => { const run = new Run(seed); run.start(); run.discard(run.round.hand.slice(0, 2)); run.play(run.round.hand.slice(0, 3)); return run.save(); };
  assert.deepEqual(go(42), go(42), 'a seed replays exactly'); assert.notDeepEqual(go(42).round.hand, go(43).round.hand);
  const run = new Run(8); run.start(); run.charms = [{ id: 'cinder', state: 3 }]; run.items = [{ kind: 'almanac', id: 'pair' }]; run.discard(run.round.hand.slice(0, 1));
  const back = Run.load(JSON.parse(JSON.stringify(run.save())));
  assert.ok(back); assert.deepEqual(back.save(), run.save(), 'a run in the middle of a round comes back exactly');
  const a = run.play(run.round.hand.slice(0, 2)), b = back.play(back.round.hand.slice(0, 2)); assert.equal(a.total, b.total);
  assert.deepEqual(back.save(), run.save(), 'and goes on the same way');
  const bad = (f) => { const s = JSON.parse(JSON.stringify(run.save())); f(s); return Run.load(s); };
  assert.equal(Run.load(null), null); assert.equal(Run.load('x'), null);
  assert.equal(bad((s) => { s.v = 99; }), null);
  assert.equal(bad((s) => { s.nuts = -1; }), null);
  assert.equal(bad((s) => { s.deck[0].rank = 15; }), null);
  assert.equal(bad((s) => { s.charms.push({ id: 'nobody', state: 0 }); }), null);
  assert.equal(bad((s) => { s.items.push({ kind: 'treat', id: 'nope' }); }), null);
  assert.equal(bad((s) => { s.round.hand.push(9999); }), null);
  assert.equal(bad((s) => { s.phase = 'shop'; }), null, 'a shop phase needs a shop');
  assert.equal(bad((s) => { s.bosses = ['sleepy']; }), null);
  assert.equal(bad((s) => { s.levels.pair = 0; }), null);
  const r = new Rand(5), seq = [r.next(), r.next()], again = new Rand(5); assert.deepEqual([again.next(), again.next()], seq);
}

console.log(`PASS Acorn Hand: ${HANDS.length} hand types, ${CHARMS.length} charms, ${TREATS.length} treats, ${BOSSES.length} rivals; scoring order, rounds, the shop, items, skips, boss rules, the win and endless, seeds and saves`);
