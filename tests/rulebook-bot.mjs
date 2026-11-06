// Rulebook FC bots. The pro searches each turn with the game's own previews: every ball action its carrier could make
// (after a dribble or not), and what the player who receives a pass could do next, playing each through the engine and
// undoing it, keeping a goal if there is one, else the safest move up the pitch; then it moves everyone else forward
// into open cells away from the tackle zones. Defending, it reads their intent and stands in the way of a pass or shot,
// or tackles a dribbler. It picks laws by what they do with the book it has (Red Pen on the worst of their laws). The
// blind player plays the same football but takes the first card it's offered; the random player moves and kicks at
// random. The pro should go deep and win a season now and then, the blind player clearly less often, and the random
// player never. Run after `npm test` has compiled the engines into .checks/ (or `npm run bot:rulebook`).
import assert from 'node:assert/strict';
import { Run, MATCHES } from '../.checks/rulebook-game.js';
import { cheb, line } from '../.checks/tactics-football.js';

const quick = process.argv.includes('--quick');
const RUNS = quick ? 20 : 60;

function rngOf(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
const K = (c) => c.c * 32 + c.r;

/** how good a position is for us with the ball, once the ball action's done */
function judge(m) {
  const car = m.carrier;
  if (!car) return m.s.ball.flight ? -5 : -50;
  if (car.team === 1) return -60;
  const z = m.zones();
  let v = car.c * 3;
  const sticky = car.safe && m.h.sticky?.(0);
  const caught = z.has(K(car)) && (!sticky || m.resolved().some((r) => r.zone.some((c) => c.c === car.c && c.r === car.r) && cheb(r.end, car) <= 1));
  if (caught) v -= car.moved || !m.reach(car.id).some((r) => !z.has(K(r))) ? 40 : 6;
  return v;
}

/** every ball action the carrier could make now */
function actions(r, m, id, depth) {
  const u = m.unit(id), out = [];
  if (!m.canAct(u)) return out;
  const [lo, hi] = m.mouth(1);
  for (let row = lo - 1; row <= hi + 1; row++) {
    const p = m.shotPreview(id, row);
    if (p.result === 'goal' || p.result === 'deflected' || p.value > 0) out.push({ score: 1000 * Math.max(1, p.value), run: () => r.shoot(id, row), test: () => m.shoot(id, row) });
  }
  const banks = r.has('pinball') ? [null, 'top', 'bottom'] : [null];
  for (const q of m.units) {
    if (q.team !== 0 || q.id === id || q.keeper) continue;
    for (const b of banks) {
      const p = m.passPreview(id, q.id, b);
      if (!p.ok) continue;
      out.push({ to: q.id, run: () => r.pass(id, q.id, b), test: () => m.pass(id, q.id, b) });
    }
    // a lofted ball to a team-mate's cell (a header if he can shoot next)
    if (cheb(u, q) >= 3 && cheb(u, q) <= 7 && depth === 0) {
      const p = m.loftPreview(id, q.c, q.r);
      if (p.ok && p.catcher >= 0) out.push({ to: p.catcher, run: () => r.loft(id, q.c, q.r), test: () => m.loft(id, q.c, q.r) });
    }
  }
  return out;
}

/** the best sequence of ball actions from here: tries each, looks one pass deeper, undoes everything */
function search(r, m, id, depth) {
  let best = { score: judge(m), seq: [] };
  for (const a of actions(r, m, id, depth)) {
    if (!a.test()) continue;
    let sc, seq = [a];
    if (a.score) sc = a.score;
    else {
      sc = judge(m) - 1;
      if (depth < 1 && a.to !== undefined && m.carrier?.id === a.to) {
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
  // where the carrier should be when he acts: here, or after a dribble
  let best = search(r, m, car.id, 0), from = null;
  if (best.score < 1000 && !car.keeper) {
    const cells = m.reach(car.id).sort((a, b) => b.c - a.c).slice(0, 10);
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
  // the new carrier steps out of the zones (or up the pitch) if he can
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
  const z = m.zones();
  const car = m.carrier;
  const taken = new Set();
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
  /** how bad their intent still is: open shooting rows count most, then an unblocked pass */
  const danger = () => {
    if (bi.k === 'shot') return m.openRows(car).length * 10;
    if (bi.k === 'pass') {
      const q = m.unit(bi.to);
      if (line(car, q).some((c) => m.at(c.c, c.r)?.team === 0)) return 0;
      if (bi.then !== undefined && line(q, m.unit(bi.then)).some((c) => m.at(c.c, c.r)?.team === 0)) return 0;
      return 1 + (bi.shoot !== undefined ? m.openRows(q).length * 10 : 0);
    }
    if (bi.k === 'loft') return m.units.some((u) => u.team === 0 && !u.keeper && cheb(u, m.unit(bi.to)) <= 1) ? 0 : 1;
    return m.s.tackle >= 0 ? 0 : 1;
  };
  if (bi.k === 'dribble' || bi.k === 'hold') {
    for (const u of ours().filter((v) => !v.keeper)) {
      if (m.canTackle(u.id)) { r.tackle(u.id); break; }
      const c = m.reach(u.id).find((c) => cheb(c, car) === 1 && !(m.o.level.front && c.c < car.c));
      if (c && r.move(u.id, c.c, c.r)) { if (m.canTackle(u.id)) { r.tackle(u.id); break; } r.undo(); }
    }
  } else {
    // greedy: the move (keeper first) that cuts the danger most, until it's gone or nothing helps
    for (let n = 0; n < 5 && danger() > 0; n++) {
      let best = null, bd = danger();
      for (const u of ours()) for (const c of m.reach(u.id)) {
        if (!m.move(u.id, c.c, c.r)) continue;
        const d = danger(); m.undo();
        if (d < bd) { bd = d; best = [u.id, c]; }
      }
      if (!best) break;
      r.move(best[0], best[1].c, best[1].r);
    }
  }
  // the rest mark their most advanced players, goal-side
  const theirs = m.units.filter((u) => u.team === 1 && !u.keeper).sort((a, b) => a.c - b.c);
  let k = 0;
  for (const u of ours().filter((v) => !v.keeper)) {
    const t = theirs[k++ % theirs.length], want = { c: Math.max(0, t.c - 1), r: t.r };
    const c = m.reach(u.id).sort((a, b) => cheb(a, want) - cheb(b, want))[0];
    if (c && cheb(c, want) < cheb(u, want) && r.move(u.id, c.c, c.r) && danger() > 0) r.undo();
  }
}

function randomTurn(r, m, rnd) {
  for (const u of m.units.filter((v) => v.team === 0)) {
    const cs = m.reach(u.id);
    if (cs.length && rnd() < 0.7) { const c = cs[Math.floor(rnd() * cs.length)]; r.move(u.id, c.c, c.r); }
    if (m.carrier?.id === u.id && m.canAct(u) && rnd() < 0.5) {
      if (rnd() < 0.3) r.shoot(u.id, 2 + Math.floor(rnd() * 5));
      else { const q = m.units.filter((v) => v.team === 0 && v !== u && !v.keeper)[Math.floor(rnd() * 3)]; r.pass(u.id, q.id); }
    }
  }
}

/** how much a law is worth to the pro, given the book it already has */
function value(r, id) {
  const has = (k) => r.has(k);
  let v = { bender: 10, sticky: 9, thunder: 7, woodwork: 7, headers: 6, wide: 5, late: 4, secondwind: 4, smalldoor: 4, parry: 3, deflect: 3, hattrick: 3, kickoff: 2, pinball: 2, distance: 2 }[id] ?? 0;
  if (id === 'wide' && has('tiny')) v += 3;
  if (id === 'woodwork' && (has('tiny') || has('giant'))) v += 4;
  if (id === 'smalldoor' && has('bignet')) v += 3;
  if (id === 'pinball' && has('closing')) v += 3;
  if (id === 'headers' && has('bouncy')) v += 3;
  if (id === 'deflect' && has('five')) v += 3;
  if (id === 'bender' && has('noback')) v += 3;
  if (id === 'thunder' && has('giant')) v += 3;
  if (id === 'secondwind' && has('mud')) v += 3;
  return v;
}
const NASTY = { bignet: 10, noback: 9, mud: 8, closing: 6, giant: 6, tiny: 6, five: 5, sore: 5, ice: 3, heavy: 3, fog: 2, wind: 2, bouncy: 2, short: 1 };

function pickFor(kind, r, rnd) {
  if (r.phase === 'redpen') {
    const t = r.book.theirs.slice();
    if (kind === 'pro') t.sort((a, b) => (NASTY[b] ?? 0) - (NASTY[a] ?? 0));
    else if (kind === 'random') return r.strike(t[Math.floor(rnd() * t.length)]);
    return r.strike(t[0]);
  }
  if (!r.offer.length) return r.pick();
  if (kind === 'blind') return r.pick(r.offer[0]);
  if (kind === 'random') return r.pick(r.offer[Math.floor(rnd() * r.offer.length)]);
  const worst = Math.max(0, ...r.book.theirs.map((t) => NASTY[t] ?? 0));
  const score = (id) => id === 'redpen' ? worst : value(r, id);
  return r.pick(r.offer.slice().sort((a, b) => score(b) - score(a))[0]);
}

/** one turn for a bot: its moves and ball actions, then End turn */
export function turn(kind, r, rnd) {
  const m = r.game;
  if (kind === 'random') randomTurn(r, m, rnd);
  else if (m.carrier?.team === 0) attack(r, m);
  else if (m.carrier?.team === 1) defend(r, m);
  else support(r, m);
  if (r.phase === 'play') r.endTurn();
}

export function play(kind, seed) {
  const r = new Run(seed), rnd = rngOf(seed * 7 + 3);
  let n = 0;
  while (r.phase !== 'won' && r.phase !== 'lost' && n++ < 2000) {
    if (r.phase === 'law') { r.ready(); continue; }
    if (r.phase === 'pick' || r.phase === 'redpen') { pickFor(kind, r, rnd); continue; }
    turn(kind, r, rnd);
  }
  return r;
}

import { pathToFileURL } from 'node:url';
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();

function main() {
  const out = {};
  for (const kind of ['pro', 'blind', 'random']) {
    let won = 0, played = 0, gf = 0, ga = 0, wins = 0;
    const per = Array.from({ length: MATCHES }, () => [0, 0, 0]);
    for (let k = 0; k < RUNS; k++) {
      const r = play(kind, 1000 + k * 17);
      if (r.phase === 'won') won++;
      played += r.stats.played; gf += r.stats.goals; ga += r.stats.conceded; wins += r.stats.won;
      r.results.forEach((x, i) => per[i][x === 'won' ? 0 : x === 'drawn' ? 1 : 2]++);
    }
    out[kind] = { won, played: played / RUNS, wins: wins / RUNS };
    console.log(`${kind.padEnd(6)} ${won}/${RUNS} seasons · ${(played / RUNS).toFixed(1)} matches · ${(wins / RUNS).toFixed(1)} wins · ${(gf / Math.max(1, played)).toFixed(2)} goals for and ${(ga / Math.max(1, played)).toFixed(2)} against a match`);
    console.log('       by match (won/drawn/lost): ' + per.map((p, i) => `${i + 1}:${p.join('/')}`).join(' '));
  }
  assert.ok(out.pro.played >= 6, 'good play with good laws should go deep into the season');
  assert.ok(out.pro.wins > out.blind.wins + 0.5 && out.pro.won > out.blind.won, 'picking laws well should beat taking the first card');
  assert.equal(out.random.won, 0, 'random play should never win the season');
  const rate = out.pro.won / RUNS;
  assert.ok(rate >= 0.1 && rate <= 0.35, `the pro should win a season now and then (${(rate * 100).toFixed(0)}%)`);
  console.log(`Rulebook FC bots: the pro plays ${out.pro.played.toFixed(1)} of ${MATCHES} matches and wins ${(rate * 100).toFixed(0)}% of seasons.`);
}
