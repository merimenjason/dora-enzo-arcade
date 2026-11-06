// Combo Ball bots. The pro searches each turn with the game's own previews: every pass, long ball and shot its carrier
// could make (after a dribble or not), and what each receiver could do next, up to three passes deep, playing each
// through the engine and undoing it. It cashes the chain in when the shot is worth more than the chain is likely to
// grow to (or reaches the target), and otherwise keeps the chain going with the ball somewhere safe; then it moves
// everyone else up into open cells away from the tackle zones. Defending, it stands in the way of their pass or shot,
// or tackles a dribbler. It buys traits that combine. The blind player plays the same football but takes the first
// trait it's offered; the casual player does whatever Hint says until it has nothing more to say, then ends the turn; the random player
// moves and kicks at random. Run after `npm test` has compiled the engines into .checks/ (or `npm run bot:combo`).
import assert from 'node:assert/strict';
import { Run, MATCHES, SLOTS, chainValue } from '../.checks/combo-game.js';
import { cheb, line } from '../.checks/tactics-football.js';

const quick = process.argv.includes('--quick');
const RUNS = quick ? 20 : 60;

function rngOf(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
const K = (c) => c.c * 32 + c.r;

/** how good a position is for us when the ball actions are done and no shot has gone in */
function judge(r, m) {
  const car = m.carrier;
  if (!car) return m.s.ball.flight ? -5 : -500;
  if (car.team === 1) return -500;
  const s = m.s, v = chainValue(s.chain, (id) => r.has(id), (id) => s.units[id].who, s.data.bonus ?? 0);
  const left = s.maxTurns - s.turn;
  const pot = (10 + v.chips) * v.mult * (left > 3 ? 0.55 : left > 1 ? 0.3 : 0.05);
  const z = m.zones();
  let val = pot + car.c * 2;
  if (z.has(K(car)) && (car.moved || !m.reach(car.id).some((q) => !z.has(K(q))))) val -= pot + 60;
  return val;
}

/** every ball action the carrier could make now */
function actions(r, m, id, depth) {
  const u = m.unit(id), out = [];
  if (!m.canAct(u)) return out;
  const [lo, hi] = m.mouth(1), need = r.target - r.points;
  for (let row = lo; row <= hi; row++) {
    const p = m.shotPreview(id, row);
    if (p.result === 'goal' || p.result === 'deflected') out.push({ score: p.value + (p.value >= need ? 10000 : 0), run: () => r.shoot(id, row), test: () => m.shoot(id, row) });
  }
  for (const q of m.units) {
    if (q.team !== 0 || q.id === id || q.keeper) continue;
    const p = m.passPreview(id, q.id);
    if (p.ok) out.push({ to: q.id, run: () => r.pass(id, q.id), test: () => m.pass(id, q.id) });
    if (cheb(u, q) >= 3 && cheb(u, q) <= 7 && depth === 0) {
      const lp = m.loftPreview(id, q.c, q.r);
      if (lp.ok && lp.catcher >= 0) out.push({ to: lp.catcher, run: () => r.loft(id, q.c, q.r), test: () => m.loft(id, q.c, q.r) });
    }
  }
  return out;
}

/** the best sequence of ball actions from here: tries each, follows the receiver, undoes everything */
function search(r, m, id, depth) {
  let best = { score: judge(r, m), seq: [] };
  for (const a of actions(r, m, id, depth)) {
    if (!a.test()) continue;
    let sc, seq = [a];
    if (a.score !== undefined) sc = a.score;
    else {
      sc = judge(r, m) - 1;
      if (depth < 2 && m.carrier?.id === a.to) {
        const d = search(r, m, a.to, depth + 1);
        if (d.score > sc) { sc = d.score; seq = [a, ...d.seq]; }
      }
    }
    m.undo();
    if (sc > best.score) best = { score: sc, seq };
  }
  return best;
}

function attack(r, m) {
  const car = m.carrier;
  let best = search(r, m, car.id, 0), from = null;
  if (!car.keeper) {
    const cells = m.reach(car.id).sort((a, b) => b.c - a.c).slice(0, 8);
    for (const c of cells) {
      if (!m.move(car.id, c.c, c.r)) continue;
      const s = search(r, m, car.id, 0);
      m.undo();
      if (s.score > best.score + 2) { best = s; from = c; }
    }
  }
  if (from) r.move(car.id, from.c, from.r);
  for (const a of best.seq) if (r.phase === 'play') a.run();
  if (r.phase !== 'play' || m.s.kickoff !== null) return;
  const c2 = m.carrier;
  if (c2 && c2.team === 0 && !c2.moved && !c2.keeper) {
    const z = m.zones();
    const safe = m.reach(c2.id).filter((c) => !z.has(K(c))).sort((a, b) => b.c - a.c || Math.abs(a.r - 4) - Math.abs(b.r - 4))[0];
    if (z.has(K(c2)) && safe) r.move(c2.id, safe.c, safe.r);
    else if (safe && safe.c > c2.c) r.move(c2.id, safe.c, safe.r);
  }
  support(r, m);
}

/** everyone else: up the pitch into open cells, out of the tackle zones, on different rows */
function support(r, m) {
  const z = m.zones(), car = m.carrier, taken = new Set();
  for (const u of m.units.filter((v) => v.team === 0 && !v.keeper && !v.moved && v.id !== car?.id)) {
    let best = null, bs = -1e9;
    for (const c of [{ c: u.c, r: u.r }, ...m.reach(u.id)]) {
      if (taken.has(c.r)) continue;
      const near = Math.min(...m.units.filter((g) => g.team === 1 && !g.keeper).map((g) => cheb(g, c)));
      let v = -Math.abs(c.c - (car && car.team === 0 ? Math.min(12, car.c + 3) : 9)) + Math.min(near, 3) * 1.5 - (z.has(K(c)) ? 4 : 0);
      if (car && car.team === 0) v -= line(car, c).some((x) => m.at(x.c, x.r)?.team === 1) ? 2 : 0;
      if (v > bs) { bs = v; best = c; }
    }
    if (best && (best.c !== u.c || best.r !== u.r)) r.move(u.id, best.c, best.r);
    if (best) taken.add(best.r);
  }
}

function defend(r, m) {
  const car = m.carrier, bi = m.s.bi;
  if (!car || !bi) return;
  const ours = () => m.units.filter((u) => u.team === 0 && !u.moved);
  if (bi.k === 'dribble' || bi.k === 'hold') {
    for (const u of ours().filter((v) => !v.keeper)) {
      if (m.canTackle(u.id)) { r.tackle(u.id); break; }
      const c = m.reach(u.id).find((c) => cheb(c, car) === 1 && !(m.o.level.front && c.c < car.c));
      if (c && r.move(u.id, c.c, c.r)) { if (m.canTackle(u.id)) { r.tackle(u.id); break; } r.undo(); }
    }
  } else {
    for (let n = 0; n < 4 && m.danger() > 0; n++) {
      let best = null, bd = m.danger();
      for (const u of ours()) for (const c of m.reach(u.id)) {
        if (!m.move(u.id, c.c, c.r)) continue;
        const d = m.danger(); m.undo();
        if (d < bd) { bd = d; best = [u.id, c]; }
      }
      if (!best) break;
      r.move(best[0], best[1].c, best[1].r);
    }
  }
}

/** a casual player: press Hint and do what it says, again and again until it has nothing more (four at most) */
function hints(r, m) {
  for (let n = 0; n < 4 && r.phase === 'play'; n++) {
    const h = r.hint();
    if (!h) return;
    const ok = h.k === 'shoot' ? r.shoot(h.id, h.row) : h.k === 'pass' ? r.pass(h.id, h.to) : h.k === 'move' ? r.move(h.id, h.c, h.r) : r.tackle(h.id);
    if (!ok || h.k === 'shoot' || h.k === 'tackle') return;
  }
}

function randomTurn(r, m, rnd) {
  for (const u of m.units.filter((v) => v.team === 0)) {
    const cs = m.reach(u.id);
    if (cs.length && rnd() < 0.7) { const c = cs[Math.floor(rnd() * cs.length)]; r.move(u.id, c.c, c.r); }
    if (m.carrier?.id === u.id && m.canAct(u) && rnd() < 0.5) {
      if (rnd() < 0.3) r.shoot(u.id, 3 + Math.floor(rnd() * 3));
      else { const q = m.units.filter((v) => v.team === 0 && v !== u && !v.keeper)[Math.floor(rnd() * 2)]; r.pass(u.id, q.id); }
    }
  }
}

/** how much a trait is worth to the pro, given what it already has */
function value(r, id) {
  const has = (k) => r.has(k);
  let v = { crossfield: 10, routeone: 9, backpass: 9, metronome: 7, hotstreak: 5, piggy: 5, lateshow: 4, volley: 4, backheel: 3, longrange: 2, nutmeg: 1, ricochet: 1, coolhead: 1, tiki: 0 }[id] ?? 0;
  if (id === 'backheel' && (has('tiki') || has('backpass'))) v += 4;
  if (id === 'backpass' && has('backheel')) v += 3;
  if (id === 'longrange' && has('routeone')) v += 3;
  if (id === 'routeone' && has('longrange')) v += 3;
  return v;
}

function pickFor(kind, r, rnd) {
  if (!r.offer.length) return r.pick();
  let id;
  if (kind === 'blind' || kind === 'casual') id = r.offer[0];
  else if (kind === 'random') id = r.offer[Math.floor(rnd() * r.offer.length)];
  else id = r.offer.slice().sort((a, b) => value(r, b) - value(r, a))[0];
  if (r.traits.length < SLOTS) return r.pick(id);
  const worst = r.traits.slice().sort((a, b) => value(r, a) - value(r, b))[0];
  if (kind === 'pro' && value(r, worst) >= value(r, id)) return r.pick();
  return r.pick(id, kind === 'pro' ? worst : r.traits[0]);
}

/** one turn for a bot: its moves and ball actions, then End turn */
export function turn(kind, r, rnd) {
  const m = r.game;
  if (kind === 'random') randomTurn(r, m, rnd);
  else if (kind === 'casual') hints(r, m);
  else if (m.carrier?.team === 0) attack(r, m);
  else if (m.carrier?.team === 1) defend(r, m);
  else support(r, m);
  if (r.phase === 'play') r.endTurn();
}

export function play(kind, seed) {
  const r = new Run(seed), rnd = rngOf(seed * 7 + 3);
  let n = 0;
  while (r.phase !== 'won' && r.phase !== 'lost' && n++ < 3000) {
    if (r.phase === 'sheet') { r.ready(); continue; }
    if (r.phase === 'shop') { pickFor(kind, r, rnd); continue; }
    turn(kind, r, rnd);
  }
  return r;
}

import { pathToFileURL } from 'node:url';
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();

function main() {
  const out = {};
  for (const kind of ['pro', 'blind', 'casual', 'random']) {
    let won = 0, wins = 0, goals = 0, best = 0, firstTwo = 0;
    const per = Array(MATCHES).fill(0);
    for (let k = 0; k < RUNS; k++) {
      const r = play(kind, 1000 + k * 17);
      if (r.phase === 'won') won++;
      wins += r.stats.won; goals += r.stats.goals; best = Math.max(best, r.stats.best);
      if (r.stats.won >= 2) firstTwo++;
      for (let i = 0; i < r.stats.won; i++) per[i]++;
    }
    out[kind] = { won, wins: wins / RUNS, firstTwo };
    console.log(`${kind.padEnd(6)} ${won}/${RUNS} runs won · ${(wins / RUNS).toFixed(1)} matches cleared · first two cleared ${firstTwo}/${RUNS} · ${(goals / RUNS).toFixed(1)} goals a run · best goal ${best}`);
    console.log('       cleared match: ' + per.map((p, i) => `${i + 1}:${p}`).join(' '));
  }
  assert.ok(out.casual.firstTwo > RUNS / 2, 'following the hints should clear the first two matches most of the time');
  assert.ok(out.pro.wins >= 5, 'good play with traits that combine should clear five matches on average');
  assert.ok(out.pro.wins > out.blind.wins + 0.5, 'buying traits well should beat taking the first one');
  assert.equal(out.random.won, 0, 'random play should never win the run');
  const rate = out.pro.won / RUNS;
  assert.ok(rate >= 0.1 && rate <= 0.35, `the pro should win a run now and then (${(rate * 100).toFixed(0)}%)`);
  console.log(`Combo Ball bots: the pro clears ${out.pro.wins.toFixed(1)} of ${MATCHES} matches and wins ${(rate * 100).toFixed(0)}% of runs.`);
}
