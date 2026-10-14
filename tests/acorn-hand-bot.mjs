// A card player for Acorn Hand. It only does what a player can: weigh every play the hand allows, discard towards
// something better, buy charms and items, and use them. It does peek at face-down cards, which a player cannot.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { Run, CHARMS, BOSSES, CHARM_SLOTS, MAX_PLAY, charmById, scorePlay } from '../.checks/acorn-hand-game.js';

/** Every set of one to five card ids from the hand. */
function* subsets(ids, max = MAX_PLAY) {
  const n = ids.length;
  for (let mask = 1; mask < 1 << n; mask++) {
    let bits = 0; for (let m = mask; m; m &= m - 1) bits++;
    if (bits <= max) yield ids.filter((_, i) => mask & (1 << i));
  }
}

/** The best legal play by score. */
export function bestPlay(run) {
  let best = null;
  for (const ids of subsets(run.round.hand)) {
    const s = run.preview(ids);
    if (s && (!best || s.total > best.s.total || (s.total === best.s.total && ids.length < best.ids.length))) best = { ids, s };
  }
  return best;
}

/** Cards to throw away: keep whatever builds towards a flush, a straight or a set, and the play that scores best. */
export function chooseDiscard(run, best) {
  const hand = run.round.hand.map((id) => run.card(id)), rules = run.rules, keep = new Set(best ? best.ids : []);
  const bySuit = [0, 1, 2, 3].map((s) => hand.filter((c) => c.suit === s));
  const flushAt = rules.fourFlush ? 3 : 4, suit = bySuit.reduce((a, b) => (b.length > a.length ? b : a));
  if (suit.length >= flushAt - 1 && suit.length >= 3) for (const c of suit) keep.add(c.id);
  else {
    // Keep pairs and better, and high cards.
    const counts = new Map(); for (const c of hand) counts.set(c.rank, (counts.get(c.rank) ?? 0) + 1);
    for (const c of hand) if (counts.get(c.rank) >= 2) keep.add(c.id);
  }
  const out = hand.filter((c) => !keep.has(c.id)).sort((a, b) => a.rank - b.rank).slice(0, MAX_PLAY).map((c) => c.id);
  return out.length ? out : hand.slice().sort((a, b) => a.rank - b.rank).slice(0, Math.min(3, hand.length)).map((c) => c.id);
}

/** Use the treats that need cards on the cards in hand. */
function spendTreats(run) {
  for (let slot = run.items.length - 1; slot >= 0; slot--) {
    const it = run.items[slot];
    if (it.kind === 'almanac') { run.useItem(slot); continue; }
    const hand = run.round ? run.round.hand.map((id) => run.card(id)) : [];
    const high = [...hand].sort((a, b) => b.rank - a.rank), low = [...hand].sort((a, b) => a.rank - b.rank);
    const suits = [0, 1, 2, 3].map((s) => run.deck.filter((c) => c.suit === s).length), main = suits.indexOf(Math.max(...suits));
    let ids = [];
    switch (it.id) {
      case 'honey': case 'spice': ids = high.filter((c) => !c.gloss).slice(0, 2).map((c) => c.id); break;
      case 'dew': case 'leaf': case 'mirror': ids = high.filter((c) => !c.gloss).slice(0, 1).map((c) => c.id); break;
      case 'compost': case 'sprout': ids = low.slice(0, 2).map((c) => c.id); break;
      case 'dye0': case 'dye1': case 'dye2': case 'dye3': if (Number(it.id[3]) !== main) { run.items.splice(slot, 1); continue; } ids = hand.filter((c) => c.suit !== main).slice(0, 3).map((c) => c.id); break;
      case 'tea': case 'wish': break;
    }
    if (!run.itemWhyNot(slot, ids)) run.useItem(slot, ids);
  }
}

/** One round, start to finish. */
export function playRound(run) {
  spendTreats(run);
  while (run.phase === 'round') {
    const r = run.round, need = r.target - r.score, best = bestPlay(run);
    if (!best) { run.play(r.hand.slice(0, 5)); continue; }
    const enough = best.s.total >= need, hopeless = best.s.total * r.plays < need;
    if (!enough && r.discards > 0 && (hopeless || best.s.total * r.plays < need * 1.3)) run.discard(chooseDiscard(run, best));
    else { remember(run, best.ids); run.play(best.ids); }
  }
}

/** The bot's memory of what it has played, to judge charms by. */
const history = new WeakMap();
const remember = (run, ids) => { const h = history.get(run) ?? []; h.push({ played: ids.map((id) => ({ ...run.card(id) })), held: run.round.hand.filter((id) => !ids.includes(id)).map((id) => ({ ...run.card(id) })) }); if (h.length > 16) h.shift(); history.set(run, h); };
const BONUS = { play: 1.3, discard: 1.08, handSize: 1.12, tight: 0.9 };
/** How well a set of charms would have scored the bot's recent plays, with a little extra for rule-changers and nuts. */
export function value(run, owned) {
  const h = history.get(run) ?? [];
  const rules = { fourFlush: owned.some((c) => charmById(c.id).rule === 'fourFlush'), fourStraight: owned.some((c) => charmById(c.id).rule === 'fourFlush'), splash: owned.some((c) => charmById(c.id).rule === 'splash') };
  let sum = 0;
  for (const p of h) sum += scorePlay({ played: p.played, held: p.held, charms: owned, states: owned.map((c) => c.state), levels: run.levels, rules, playsLeft: 1, discardsLeft: 1, nuts: run.nuts, deckLeft: 30, firstPlay: false, lastPlay: false, boss: null, fame: null, sageLevels: 0 }).total;
  let v = h.length ? sum / h.length : 1;
  for (const c of owned) { const d = charmById(c.id); v *= BONUS[d.rule] ?? 1; if (d.sage) v *= 1.06; if (d.tags.includes('econ')) v *= run.ante <= 3 ? 1.1 : 1.02; if (d.start !== undefined) v *= 1.1; }
  return v;
}
const fresh = (id) => ({ id, state: charmById(id).start ?? 0 });

export function shop(run) {
  for (let pass = 0; pass < 6; pass++) {
    run.shop.charms.forEach((id, i) => {
      if (!id || run.nuts < run.priceOf(id)) return;
      const now = value(run, run.charms);
      if (run.charms.length < CHARM_SLOTS) { if (value(run, [...run.charms, fresh(id)]) > now * 1.02 || run.charms.length < 2) run.buyCharm(i); return; }
      // Full: swap out whichever charm the new one beats by most.
      let swap = -1, top = now * 1.08;
      run.charms.forEach((_, k) => { const v = value(run, run.charms.map((c, j) => (j === k ? fresh(id) : c))); if (v > top) { top = v; swap = k; } });
      if (swap >= 0 && run.nuts + run.sellPrice(run.charms[swap].id) >= run.priceOf(id)) { run.sell(swap); run.buyCharm(i); }
    });
    run.shop.items.forEach((it, i) => {
      if (!it) return;
      const want = it.kind === 'almanac' ? it.id === run.fame || run.ante < 3 : ['tea', 'wish', 'honey', 'spice', 'dew'].includes(it.id);
      if (want && run.nuts >= 3 + (run.ante > 2 ? 5 : 0)) run.buyItem(i);
    });
    for (let slot = run.items.length - 1; slot >= 0; slot--) if (run.items[slot].kind === 'almanac' || ['tea', 'wish'].includes(run.items[slot].id)) run.useItem(slot);
    if (run.nuts >= run.rerollCost + 10) run.reroll(); else break;
  }
  // ×mult charms at the end, where they multiply the most.
  for (let k = 0; k < run.charms.length; k++) for (let i = 0; i < run.charms.length - 1; i++) if (charmById(run.charms[i].id).text.startsWith('×') && !charmById(run.charms[i + 1].id).text.startsWith('×')) run.shift(i, 1);
  run.leave();
}

/** Play a whole run to the eighth boss, or until it is lost. */
export function play(seed) {
  const run = new Run(seed), out = { run, lostAt: null, bosses: [], bossBeaten: [], charms: new Set(), maxHand: 0 };
  for (let guard = 0; guard < 200; guard++) {
    if (run.phase === 'pick') { run.start(); if (run.boss) out.bosses.push(run.boss.rule); }
    else if (run.phase === 'round') playRound(run);
    else if (run.phase === 'cashout') { if (run.blind === 2) out.bossBeaten.push(run.boss.rule); run.collect(); }
    else if (run.phase === 'shop') { shop(run); for (const c of run.charms) out.charms.add(c.id); }
    else break;
  }
  if (run.phase === 'over') out.lostAt = run.ante;
  return out;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const N = Number(process.env.SEEDS ?? 200), seeds = Array.from({ length: N }, (_, i) => i + 1);
  let wins = 0; const lost = {}, met = new Set(), beaten = new Set(), bought = new Set(), inWins = new Set();
  for (const seed of seeds) {
    const r = play(seed);
    if (r.run.phase === 'victory') { wins++; for (const id of r.charms) inWins.add(id); } else lost[r.lostAt] = (lost[r.lostAt] ?? 0) + 1;
    r.bosses.forEach((b) => met.add(b)); r.bossBeaten.forEach((b) => beaten.add(b)); r.charms.forEach((c) => bought.add(c));
  }
  const rate = wins / N;
  console.log(`Acorn Hand bot: ${wins}/${N} runs won (${Math.round(rate * 100)}%); lost by ante ${Object.entries(lost).map(([a, n]) => `${a}:${n}`).join(' ')}`);
  console.log(`bosses met ${met.size}/${BOSSES.length}, beaten ${beaten.size}; charms bought ${bought.size}/${CHARMS.length}, in a winning run ${inWins.size}`);
  const never = CHARMS.filter((c) => !inWins.has(c.id)).map((c) => c.id);
  if (never.length) console.log('never in a win:', never.join(' '));
  assert.ok(rate >= 0.2 && rate <= 0.45, `the bot wins between 20% and 45% of runs (${Math.round(rate * 100)}%)`);
  assert.ok((lost[1] ?? 0) / N < 0.05, `fewer than 5% of runs end in ante 1 (${lost[1] ?? 0})`);
  assert.equal(met.size, BOSSES.length, 'every boss turns up'); assert.equal(beaten.size, BOSSES.length, 'every boss is beaten at least once');
  assert.equal(bought.size, CHARMS.length, 'every charm is bought somewhere');
  assert.ok(inWins.size >= CHARMS.length - 3, `nearly every charm is part of some winning run (${inWins.size}/${CHARMS.length})`);
  console.log('Acorn Hand bot: PASS');
}
