// Lucky Pips · the two players the bot suite uses: a sensible greedy one and a random one.
// The greedy player looks one move ahead in battle (every die into every tool, every pair or three of dice into a
// two- or three-dice tool), scores the result and plays the best move until nothing helps, then ends the turn.
import {
  moves, place, endTurn, reroll, choices, go, takeReward, takeCharm, stallBuy, stallUpgrade, stallRemove, stallPie,
  leave, picnic, pickTool, tentChoose, hitOf, toolRoom, rnd,
} from '../.checks/pips-game.js';
import { TOOL, needOf, slotsOf, TENT } from '../.checks/pips-tools.js';

/** A copy deep enough to play a battle move on without touching the original. */
export function simClone(run) {
  return { ...run, tools: run.tools.map(t => ({ ...t })), stats: { ...run.stats }, used: run.used.slice(), charms: run.charms,
    battle: run.battle && JSON.parse(JSON.stringify(run.battle)) };
}
/** How good a battle position is for the pair. */
export function score(run) {
  const b = run.battle;
  if (run.screen === 'lost') return -1e6;
  if (!b || b.done === 'won') return 1e5 + run.hp * 12;
  let s = run.hp * 12;
  let incoming = 0;
  for (const f of b.foes) {
    if (f.hp <= 0) { s += 20; continue; }
    const ticks = Math.min(f.hp, f.burn * 1.6 + (f.poison * (f.poison + 1)) / 2);
    s -= (f.hp - ticks * 0.9) * 6 + f.block * 2;
    if (!f.stun) incoming += hitOf(f) * (f.intent.hits ?? 1);
    else s += 6;
  }
  s -= Math.max(0, incoming - b.block) * 13;
  s += Math.min(b.block, incoming) * 0.5 + b.thorns * 2;
  s -= (b.poison * 1.5 + b.burn * 1.2 + b.frost * 3) * 12;
  for (const d of b.dice) s += d.curse ? -2 : 1 + d.v * 0.6;
  b.slots.forEach((sl, i) => {
    const t = run.tools[i]; if (!t) return;
    if (sl.locked) s -= 6;
    const n = needOf(TOOL[t.id], t.up);
    if (n.k === 'count') s += ((n.n - sl.count) / n.n) * 40;
  });
  return s;
}
/** Every move: [dieId, tool] or a set of dice for a multi-dice tool. */
function candidates(run) {
  const out = [], b = run.battle, single = moves(run);
  for (const [d, ti] of single) {
    const t = run.tools[ti], n = needOf(TOOL[t.id], t.up), k = slotsOf(n);
    if (k === 1) { out.push([[d, ti]]); continue; }
  }
  run.tools.forEach((t, ti) => {
    const n = needOf(TOOL[t.id], t.up), k = slotsOf(n);
    if (k === 1) return;
    const ds = b.dice.filter(d => !d.curse);
    const pend = b.slots[ti].pend.length;
    const left = k - pend;
    const combos = [];
    const rec = (start, acc) => { if (acc.length === left) { combos.push(acc.slice()); return; } for (let i = start; i < ds.length; i++) { acc.push(ds[i]); rec(i + 1, acc); acc.pop(); } };
    if (ds.length <= 9) rec(0, []);
    for (const c of combos) {
      const sim = simClone(run); let ok = true;
      for (const d of c) { if (!moves(sim).some(([x, y]) => x === d.id && y === ti)) { ok = false; break; } place(sim, d.id, ti); }
      if (ok) out.push(c.map(d => [d.id, ti]));
    }
  });
  return out;
}
export function playTurnGreedy(run, rng) {
  for (let guard = 0; guard < 40 && run.screen === 'battle' && !run.battle.done; guard++) {
    const base = score(run);
    let best = null, bestS = 0.5;
    for (const c of candidates(run)) {
      const sim = simClone(run);
      let made = false;
      for (const [d, ti] of c) made = place(sim, d, ti).some(e => e.t === 'dice') || made;
      let s = score(sim) - base;
      // a move that makes dice (split, flip, nudge, twin, re-roll) is worth what the best next move does with them
      if (made && sim.screen === 'battle' && !sim.battle.done) {
        const mid = score(sim);
        let follow = 0;
        for (const c2 of candidates(sim)) {
          const s2 = simClone(sim);
          for (const [d, ti] of c2) place(s2, d, ti);
          follow = Math.max(follow, score(s2) - mid);
        }
        s += follow * 0.9;
      }
      s += rng() * 0.01;
      if (s > bestS) { bestS = s; best = c; }
    }
    if (!best) {
      // a die nothing wants: re-roll it if we can
      const b = run.battle;
      if (b.rerolls > 0) {
        const fit = new Set(moves(run).map(m => m[0]));
        const idle = b.dice.filter(d => !d.curse && !fit.has(d.id)).sort((a, c) => a.v - c.v)[0];
        if (idle) { reroll(run, idle.id); continue; }
      }
      break;
    }
    for (const [d, ti] of best) place(run, d, ti);
  }
  if (run.screen === 'battle' && !run.battle.done) endTurn(run);
}
export function playTurnRandom(run, rng) {
  for (let guard = 0; guard < 30 && run.screen === 'battle' && !run.battle.done; guard++) {
    const m = moves(run);
    if (!m.length || rng() < 0.25) break;
    const [d, ti] = m[Math.floor(rng() * m.length)];
    place(run, d, ti);
  }
  if (run.screen === 'battle' && !run.battle.done) endTurn(run);
}

// ---- outside battle ----
const BASE = { sling: 5, shield: 4, splitter: 3, clover: 3, honey: 5, mallet: 5, rattle: 4, top: 3, path: 4, pebble: 4, nettle: 4, ember: 5, tea: 4, bell: 3,
  seeds: 3, hammer: 5, wall: 5, hay: 4, wish: 3, vane: 3, mill: 2, kettle: 5, lanterns: 4, toffee: 4, mirror: 4, quill: 6, scales: 6, jam: 3, sunflower: 5,
  drum: 4, seven: 5, sparkler: 6, bees: 5, kindling: 4, horseshoe: 4, bramble: 5, duster: 4, cannon: 5, barrel: 3, piggy: 4, woodpile: 4,
  firework: 6, caramel: 4, anvil: 5, kite: 4, carousel: 5, cider: 5, gambit: 6 };
export function makeTaste(rng) { const t = {}; for (const k of Object.keys(BASE)) t[k] = BASE[k] + rng() * 3; return t; }
const rate = (taste, t) => (taste[t.id ?? t] ?? 3) + (t.up ? 1.5 : 0);
function worst(run, taste) { let w = 0; run.tools.forEach((t, i) => { if (rate(taste, t) < rate(taste, run.tools[w])) w = i; }); return w; }
function bestUp(run, taste) { let b = -1; run.tools.forEach((t, i) => { if (!t.up && (b < 0 || rate(taste, t) > rate(taste, run.tools[b]))) b = i; }); return b; }

export function stepGreedy(run, rng, taste) {
  switch (run.screen) {
    case 'battle': return playTurnGreedy(run, rng);
    case 'map': {
      const c = choices(run), frac = run.hp / run.max;
      const want = { battle: 3, elite: frac > 0.75 ? 4 : frac > 0.5 ? 1 : -3, tent: 2.5, stall: run.acorns >= 60 ? 3.5 : 1, picnic: frac < 0.55 ? 6 : frac < 0.8 ? 2 : 0.5, boss: 9 };
      let best = c[0], bs = -99;
      for (const id of c) {
        const n = run.map[id];
        // look one step past it too
        const ahead = Math.max(0, ...n.next.map(j => want[run.map[j].kind] ?? 0));
        const s = (want[n.kind] ?? 0) + ahead * 0.4 + rng() * 0.8;
        if (s > bs) { bs = s; best = id; }
      }
      return go(run, best);
    }
    case 'reward': {
      const o = run.offer;
      let bi = -1, bs = -1;
      o.tools.forEach((id, i) => { const s = rate(taste, id); if (s > bs) { bs = s; bi = i; } });
      if (bi < 0) return takeReward(run, -1);
      if (run.tools.length < toolRoom(run)) return takeReward(run, bi);
      const w = worst(run, taste);
      if (bs > rate(taste, run.tools[w]) + 0.5) return takeReward(run, bi, w);
      return takeReward(run, -1);
    }
    case 'charm': {
      const pref = ['die', 'acorn', 'scarf', 'locket', 'basket', 'belt', 'spark', 'paws'];
      const o = run.offer; let bi = 0;
      o.charms.forEach((id, i) => { if (pref.indexOf(id) < pref.indexOf(o.charms[bi])) bi = i; });
      return takeCharm(run, bi);
    }
    case 'stall': {
      const o = run.offer;
      if (run.hp < run.max * 0.5) stallPie(run);
      const items = o.tools.map((it, i) => [it, i]).filter(([it]) => !it.sold && run.acorns >= it.price).sort((a, b) => rate(taste, b[0].id) - rate(taste, a[0].id));
      for (const [it, i] of items) {
        if (run.tools.length < toolRoom(run)) { stallBuy(run, i); continue; }
        const w = worst(run, taste);
        if (rate(taste, it.id) > rate(taste, run.tools[w]) + 1) stallBuy(run, i, w);
      }
      const u = bestUp(run, taste); if (u >= 0) stallUpgrade(run, u);
      if (run.tools.length >= 5) { const w = worst(run, taste); if (rate(taste, run.tools[w]) < 4) stallRemove(run, w); }
      return leave(run);
    }
    case 'picnic': {
      const u = bestUp(run, taste);
      return picnic(run, run.hp < run.max * 0.72 || u < 0 ? undefined : u);
    }
    case 'pick': return pickTool(run, run.offer.purpose === 'remove' ? worst(run, taste) : bestUp(run, taste)) || leave(run);
    case 'tent': {
      const id = run.tent, frac = run.hp / run.max;
      const pickC = { fortune: frac > 0.6 ? 'pay' : 'leave', lost: 'tool', ferris: frac < 0.7 ? 'ride' : 'fix', pie: frac < 0.6 ? 'eat' : 'judge', mirror: 'remove', coconut: frac > 0.4 ? 'throw' : 'leave', smith: 'upgrade', ambush: 'fight' }[id];
      return tentChoose(run, pickC ?? TENT[id].choices[0].id);
    }
  }
}
export function stepRandom(run, rng) {
  const r = a => a[Math.floor(rng() * a.length)];
  switch (run.screen) {
    case 'battle': return playTurnRandom(run, rng);
    case 'map': return go(run, r(choices(run)));
    case 'reward': { const i = Math.floor(rng() * (run.offer.tools.length + 1)) - 1; return takeReward(run, i, Math.floor(rng() * run.tools.length)) || takeReward(run, -1); }
    case 'charm': return takeCharm(run, Math.floor(rng() * run.offer.charms.length));
    case 'stall': if (rng() < 0.5) stallBuy(run, Math.floor(rng() * 3), Math.floor(rng() * run.tools.length)); return leave(run);
    case 'picnic': return picnic(run, rng() < 0.5 ? undefined : Math.floor(rng() * run.tools.length)) || picnic(run);
    case 'pick': return pickTool(run, Math.floor(rng() * run.tools.length)) || leave(run);
    case 'tent': return tentChoose(run, r(TENT[run.tent].choices).id);
  }
}
/** Play a whole run with one of the players; returns the finished run. */
export function playRun(run, kind, rng, maxSteps = 6000) {
  const taste = makeTaste(rng);
  let steps = 0;
  while (run.screen !== 'won' && run.screen !== 'lost' && steps++ < maxSteps) {
    if (kind === 'greedy') stepGreedy(run, rng, taste); else stepRandom(run, rng);
  }
  return { run, steps };
}
export function mulberry(seed) { const o = { r: seed | 0 }; return () => rnd(o); }
