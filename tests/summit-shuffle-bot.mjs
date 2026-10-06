// Climbs Summit Shuffle through the real engine. In a fight the bot tries the orders it could play its hand in on
// copies of the run, lets the predators answer, and keeps the turn that leaves it best off; between fights it follows
// simple rules for the trail, rewards, burrows and stalls. Run on its own it reports how often each chinchilla reaches
// the summit at each altitude, where climbs end, and how each card does.
import assert from 'node:assert/strict';
import { Run, CARDS, TRINKETS, HERO_IDS, HEROES, ALTITUDES, ACTS, STOPS, costOf, canUpgrade } from '../.checks/summit-shuffle-game.js';

/** How much the bot wants each card, before looking at its deck: set from how much one copy helped it in `TRIAL=1` runs. */
const WANT = {
  lightfeet: 7, alarmbark: 9, thezoomies: 9, stampede: 9, squeak: 8.8, cosynest: 8.8, endless: 8.8, raisin: 8.8, wintercoat: 8.5, dustbath: 8.2,
  feast: 8.2, pricklycurl: 7.8, tangle: 7.8, snowden: 7.5, avalanche: 7.5, dustcloud: 7.2, burrpatch: 7.2, scamper: 7.2, furslip: 7.2, encore: 7.2,
  flurry: 6.8, dustdevil: 6.8, followup: 6.8, groom: 6.8, burrfling: 6.5, deepburrow: 6.5, stickycoat: 6.5, haytoss: 6.5, popcorn: 6.5, ambush: 6.2,
  bowlover: 6.2, windup: 6.2, doublekick: 5.8, brighteyed: 5.8, shakeoff: 5.8, drumfeet: 5.5, zoomaround: 5.5, quicknip: 5.5, cheekstash: 5.2, fullpelt: 5.2,
  pounce: 5.2, bramblecoat: 4.8, gnaw: 4.5, tailwhip: 4.5, sorespot: 4.5, burrstorm: 5, puffup: 3.2, bellyflop: 3.2,
};
const BOSS_PICK = ['twigs', 'suncrown', 'springwater', 'summittea', 'emptypouch', 'claws'];
const count = (run, pred) => run.deck.filter((c) => pred(CARDS[c.id], c)).length;

function wantCard(run, id, want = WANT) {
  let v = want[id] ?? 0;
  const d = CARDS[id], has = (x) => run.deck.some((c) => c.id === x), copies = run.deck.filter((c) => c.id === id).length;
  if (d.type === 'power' && copies) v -= 3;
  if (copies >= 2) v -= 2;
  const burrs = count(run, (x) => x.art === 'burr'), blocks = count(run, (x) => !!x.b), attacks = count(run, (x) => x.type === 'attack');
  if (d.art === 'burr') v += Math.min(2, burrs * 0.7);
  if (id === 'bellyflop' || id === 'puffup' || id === 'deepburrow') v += blocks >= 6 ? 1.5 : -1;
  if ((id === 'fullpelt' || id === 'drumfeet' || id === 'stampede' || id === 'doublekick') && (has('thezoomies') || has('endless'))) v += 1.5;
  if (id === 'tangle' || id === 'sorespot') v += burrs >= 2 ? 1.5 : -2;
  if (d.b && blocks < 5) v += 1;
  if (d.type === 'attack' && attacks < 6) v += 0.5;
  if ((d.type === 'attack' && !d.target) || id === 'burrstorm') v += run.act >= 1 ? 0.5 : 0;
  return v;
}

/** How good the fight looks after the predators have answered this turn. */
function judge(run, hpWeight) {
  const r = run.clone();
  r.endTurn();
  if (r.phase === 'lost') return -1e6;
  if (r.phase !== 'fight') return 1e5 + r.hp * 12 + r.maxHp * 4;
  const f = r.fight, long = f.kind === 'boss' ? 2.2 : f.kind === 'alpha' ? 1.6 : 1;
  const w = hpWeight + 2.2 * (1 - r.hp / r.maxHp);
  let s = r.hp * w + r.maxHp * 2;
  for (const x of f.foes) {
    if (!x.alive) continue;
    const b = x.st.burrs ?? 0;
    s -= x.hp + 9 + (x.st.zoomies ?? 0) * 3.5 * long - Math.min(x.hp, (b * (b + 1)) / 2) * 0.8 - (x.st.exposed ?? 0) * 2.5 - (x.st.winded ?? 0) * 2.5;
  }
  const st = f.st;
  s += long * ((st.zoomies ?? 0) * 5 + (st.fur ?? 0) * 4.5 + (st.bristle ?? 0) * 2.2 + (st.nest ?? 0) * 3.5 + (st.sticky ?? 0) * 5 + (st.frenzy ?? 0) * 9 + (st.den ?? 0) * 6 + (st.light ?? 0) * 5 + (st.bright ?? 0) * 8);
  s += (st.slip ?? 0) * 6 + (st.den ? f.fluff * 0.6 : 0);
  return s;
}
const ORDER = { power: 0, skill: 1, attack: 2, status: 3, curse: 3 };
/** The best order found to play this hand in, as [card uid, target] pairs. */
function plan(run, budget, hpWeight) {
  let best = { score: judge(run, hpWeight), seq: [] };
  const seen = new Set(), f = run.fight;
  const moves = run.plays().sort((a, b) => {
    const ca = f.hand[a.i], cb = f.hand[b.i];
    return (ORDER[CARDS[ca.id].type] - ORDER[CARDS[cb.id].type]) || (costOf(ca) - costOf(cb));
  });
  for (const p of moves) {
    if (budget.n <= 0) break;
    const c = f.hand[p.i], key = `${c.id}${c.up}${p.t}`;
    if (seen.has(key)) continue;
    seen.add(key); budget.n--;
    const r = run.clone();
    r.play(p.i, p.t);
    let got;
    if (r.phase === 'lost') got = { score: -1e6, seq: [] };
    else if (r.phase !== 'fight') got = { score: 1e5 + r.hp * 12 + r.maxHp * 4, seq: [] };
    else got = plan(r, budget, hpWeight);
    if (got.score > best.score) best = { score: got.score, seq: [[c.uid, p.t], ...got.seq] };
  }
  return best;
}
/** Plays one whole turn of a fight. */
export function fightTurn(run, o = {}) {
  const seq = plan(run, { n: o.budget ?? 90 }, o.hpWeight ?? 1.5).seq;
  for (const [uid, t] of seq) {
    if (run.phase !== 'fight') return;
    const i = run.fight.hand.findIndex((c) => c.uid === uid);
    if (i < 0 || run.play(i, run.fight.foes[t]?.alive ? t : run.fight.foes.findIndex((x) => x.alive))) break;
  }
  if (run.phase === 'fight') run.endTurn();
}

const UPGRADE_FIRST = ['thezoomies', 'endless', 'dustkick', 'avalanche', 'stickycoat', 'wintercoat', 'cosynest', 'raisin', 'brighteyed', 'shakeoff', 'ambush', 'pounce', 'tailwhip', 'doublekick', 'burrstorm'];
function bestUpgrade(run) {
  const list = run.upgradable();
  if (!list.length) return null;
  for (const id of UPGRADE_FIRST) { const c = list.find((x) => x.id === id); if (c) return c; }
  return list.find((c) => c.id !== 'nip' && c.id !== 'fluffup') ?? list[0];
}
const worstCard = (run) => run.deck.find((c) => c.id === 'fright') ?? run.deck.find((c) => c.id === 'nip' && !c.up) ?? run.deck.find((c) => c.id === 'fluffup' && !c.up) ?? run.deck.find((c) => c.id === 'nip') ?? run.deck[0];

function chooseNode(run) {
  const hp = run.hp / run.maxHp, score = (id) => {
    const t = run.map[id].type;
    return t === 'alpha' ? (hp > 0.7 ? 4 : hp > 0.5 ? 1 : -4) : t === 'rest' ? (hp < 0.6 ? 5 : 2) : t === 'stall' ? (run.seeds >= 130 ? 4 : 1) : t === 'stash' ? 5 : t === 'event' ? 3 : 2;
  };
  // Look one stop further, so a trail that leads to something good is worth taking.
  return run.paths().map((id) => [score(id) + 0.5 * Math.max(0, ...run.map[id].next.map(score)), id]).sort((a, b) => b[0] - a[0])[0][1];
}
function eventChoice(run) {
  const v = run.eventView(), hp = run.hp / run.maxHp, id = run.event.id, ok = (i) => v.options[i].ok;
  const pickOf = (i) => { const kind = v.options[i].pick; return kind === 'remove' ? worstCard(run).uid : kind === 'upgrade' ? bestUpgrade(run).uid : run.pickable('copy').slice().sort((a, b) => (WANT[b.id] ?? 0) - (WANT[a.id] ?? 0))[0].uid; };
  let i = 0;
  if (id === 'apple') i = hp < 0.6 || !ok(1) ? 0 : 1;
  else if (id === 'hollow') i = hp < 0.4 || !ok(0) ? 1 : 0;
  else if (id === 'trader') i = hp > 0.5 && ok(0) ? 0 : ok(1) ? 1 : 2;
  else if (id === 'ledge') i = hp > 0.5 ? 0 : 1;
  else if (id === 'fox') i = 1;
  else if (id === 'spring') i = hp < 0.5 ? 1 : 0;
  else if (id === 'elder') i = 0;
  else if (id === 'rockslide') i = hp > 0.6 && ok(1) ? 1 : hp > 0.6 && ok(0) ? 0 : 2;
  const uid = v.options[i].pick ? pickOf(i) : -1;
  assert.equal(run.choose(i, uid), '', `the ${id} meeting takes option ${i}`);
}
function shop(run, want) {
  const s = run.stall;
  s.trinkets.forEach((t, i) => { if (!t.sold && run.seeds >= t.price) run.buyTrinket(i); });
  if (!s.removed && run.seeds >= run.removePrice && run.deck.length > 8) run.buyRemoval(worstCard(run).uid);
  s.cards.map((c, i) => [wantCard(run, c.card.id, want) - c.price / 60, i, c]).sort((a, b) => b[0] - a[0]).forEach(([v, i, c]) => { if (!c.sold && v > 4.6 && run.seeds >= c.price) run.buyCard(i); });
}

/** Climbs until the run is won or lost. `o.want` overrides how much the bot likes each card. */
export { WANT };
export function climb(o) {
  const run = o instanceof Run ? o : Run.start(o), opt = o instanceof Run ? {} : o, want = opt.want ?? WANT;
  if (opt.extra) run.addCard(opt.extra);
  let where = '';
  for (let guard = 0; guard < 4000 && run.phase !== 'won' && run.phase !== 'lost'; guard++) {
    if (run.phase === 'map') assert.equal(run.go(chooseNode(run)), '');
    else if (run.phase === 'fight') {
      const key = `${run.act + 1}:${run.fight.kind}:${run.fight.kind === 'fight' ? run.fight.foes.map((x) => x.kind).join('+') : run.fight.foes[0].kind}`, at = run.hp, turn = run.fight.turn;
      where = `${run.act + 1}:${run.fight.foes[0].kind}`;
      fightTurn(run, opt); run.events.length = 0;
      if (opt.log) { const g = (opt.log[key] ??= { hp: 0, turns: 0, n: 0, lost: 0, start: null }); g.hp += at - Math.max(0, run.hp); if (turn === 1) g.n++; g.turns++; if (run.phase === 'lost') g.lost++; }
    }
    else if (run.phase === 'reward') {
      const w = run.reward;
      if (!w.relicPicked) { const i = BOSS_PICK.map((id) => w.relics.indexOf(id)).find((n) => n >= 0); run.takeRelic(i ?? 0); }
      if (!w.picked) {
        const ranked = w.cards.map((c, i) => [wantCard(run, c.id, want) + (c.up ? 0.7 : 0), i]).sort((a, b) => b[0] - a[0]);
        if (ranked[0][0] >= 5 + Math.max(0, run.deck.length - 20) * 0.3) run.takeCard(ranked[0][1]); else run.skipCards();
      }
      assert.equal(run.leave(), '');
    } else if (run.phase === 'rest') {
      const up = bestUpgrade(run);
      if (run.canNap && (run.hp / run.maxHp < 0.62 || !up)) run.nap(); else if (up) run.groom(up.uid); else run.skipRest();
    } else if (run.phase === 'stall') { shop(run, want); assert.equal(run.leave(), ''); }
    else if (run.phase === 'event') { eventChoice(run); assert.equal(run.leave(), ''); }
  }
  assert.ok(run.phase === 'won' || run.phase === 'lost', 'a climb always ends');
  return { run, won: run.phase === 'won', where };
}

/** The share of `runs` climbs for each chinchilla that reach the summit when one more card is in the deck from the start: how much is that card worth? */
export function cardTrial(id, runs, level = 0) {
  let wins = 0, stops = 0;
  for (const hero of HERO_IDS) for (let s = 1; s <= runs; s++) { const { run, won } = climb({ seed: s * 104729 + 17, hero, level, extra: id }); wins += won ? 1 : 0; stops += run.stats.stops; }
  return { rate: wins / (runs * 2), stops: stops / (runs * 2) };
}
if (import.meta.url === `file://${process.argv[1]}` && process.env.TRIAL) {
  const runs = Number(process.env.RUNS || 150), level = Number(process.env.LEVEL || 1), base = cardTrial('', runs, level).rate;
  console.log(`Baseline ${Math.round(base * 100)}% at ${ALTITUDES[level].name}. Summits with one copy of a card in the deck from the first stop:`);
  const rows = Object.keys(WANT).map((id) => ({ id, ...cardTrial(id, runs, level) })).sort((a, b) => b.rate - a.rate);
  for (const r of rows) console.log(`  ${CARDS[r.id].name.padEnd(16)} ${CARDS[r.id].rarity.padEnd(9)} ${String(Math.round(r.rate * 100)).padStart(3)}%  ${(r.rate - base >= 0 ? '+' : '') + Math.round((r.rate - base) * 100)}  ${r.stops.toFixed(1)} stops`);
} else if (import.meta.url === `file://${process.argv[1]}`) {
  const runs = Number(process.env.RUNS || 60), levels = (process.env.LEVELS || '0,3,5').split(',').map(Number);
  const cards = {}, ends = {}, trinketWins = {}, log = {};
  for (const level of levels) {
    const row = [];
    for (const hero of HERO_IDS) {
      let wins = 0, stops = 0, turns = 0, deck = 0;
      for (let s = 1; s <= runs; s++) {
        const { run, won, where } = climb({ seed: s * 7919 + level * 131, hero, level, log: level === levels[0] ? log : null });
        wins += won ? 1 : 0; stops += run.stats.stops; turns += run.stats.turns; deck += run.deck.length;
        if (!won) ends[where] = (ends[where] ?? 0) + 1;
        if (level === levels[0]) {
          for (const id of new Set(run.deck.map((c) => c.id))) { cards[id] ??= [0, 0]; cards[id][0]++; cards[id][1] += won ? 1 : 0; }
          for (const id of run.trinkets) { trinketWins[id] ??= [0, 0]; trinketWins[id][0]++; trinketWins[id][1] += won ? 1 : 0; }
        }
      }
      row.push(`${HEROES[hero].name} ${String(Math.round((100 * wins) / runs)).padStart(3)}% (${(stops / runs).toFixed(1)} of ${STOPS} stops, ${Math.round(turns / runs)} turns, ${(deck / runs).toFixed(0)} cards)`);
    }
    console.log(`${ALTITUDES[level].name.padEnd(11)} ${row.join('   ')}`);
  }
  if (process.env.FIGHTS) for (const [k, g] of Object.entries(log).sort((a, b) => a[0].localeCompare(b[0]))) console.log(`  ${k.padEnd(52)} ${String(g.n).padStart(4)} fights  ${(g.hp / g.n).toFixed(1).padStart(5)} health  ${(g.turns / g.n).toFixed(1)} turns  ${g.lost} lost`);
  console.log('Where climbs ended (stretch:first foe):', Object.entries(ends).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(', '));
  const line = (table, names) => Object.entries(table).filter(([, v]) => v[0] >= 6).map(([id, v]) => [Math.round((100 * v[1]) / v[0]), `${names[id].name} ${Math.round((100 * v[1]) / v[0])}% of ${v[0]}`]).sort((a, b) => b[0] - a[0]).map((x) => x[1]).join(', ');
  console.log(`Summits by card in the final deck, ${ALTITUDES[levels[0]].name}: ${line(cards, CARDS)}`);
  console.log(`Summits by trinket: ${line(trinketWins, TRINKETS)}`);
  void ACTS; void canUpgrade;
}
