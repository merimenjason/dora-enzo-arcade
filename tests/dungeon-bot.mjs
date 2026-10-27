// Dust Bunny Dungeon bots: a careful player with a short look-ahead should clear the Root Cellar on most seeds and win
// a fair share of whole runs; a player who wanders at random should almost never get far. Runs replay exactly.
import assert from 'node:assert/strict';
import { DungeonGame, replay, W, H, DX, DY, DIRS, TOOLS, TOOL_INFO, PERKS, walkable, SPIKE, STAIRS, FLOORS } from '../.checks/dungeon-game.js';

const rng = (seed) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const VW = Number(process.env.VW ?? 20), VCAP = Number(process.env.VCAP ?? 99), MIX = !!process.env.MIX, UP = Number(process.env.UP ?? 0.3);
const PERK_ORDER = ['heart', 'wind', 'push', 'long', 'tidy', 'acorns', 'pockets', 'sharp', 'bristle', 'dash', 'nose'];

/** Every action the player could try this turn. */
export function actions(g) {
  const out = ['U', 'R', 'D', 'L', 'W'];
  TOOLS.forEach((t, k) => { if (g.tools[t] > 0) { if (TOOL_INFO[t].aim) for (const d of DIRS) out.push(`T${k + 1}${d}`); else out.push(`T${k + 1}`); } });
  if (g.dashes > 0) for (const d of DIRS) out.push(`X${d}`);
  return out;
}

/** Steps to the nearest goal from every tile: the stairs once seen (or the boss), else items nearby, else the unexplored edge. */
export function goalMap(g) {
  const goals = [];
  const boss = g.enemies.find((e) => e.max >= 8 && e.awake);
  if (boss) goals.push(boss.y * W + boss.x);
  else if (g.stairs >= 0 && g.seen[g.stairs]) goals.push(g.stairs);
  for (const [i, it] of g.items) if (g.seen[i] && (it === 'key' || it === 'heart' || g.tools[it] < g.toolMax())) goals.push(i);
  for (let i = 0; i < W * H; i++) if (g.seen[i] && ((g.tiles[i] === 8 && g.keys) || g.tiles[i] === 10)) goals.push(i);
  if (!goals.length || !(g.stairs >= 0 && g.seen[g.stairs]) && !boss) {
    for (let i = 0; i < W * H; i++) {
      if (g.seen[i] || !(walkable(g.tiles[i]) || g.crates[i])) continue;
      const x = i % W, y = Math.floor(i / W);
      for (let d = 0; d < 4; d++) { const j = (y + DY[d]) * W + x + DX[d]; if (g.seen[j] && walkable(g.tiles[j])) { goals.push(j); break; } }
    }
  }
  const dist = new Float64Array(W * H).fill(1e6), q = [];
  for (const i of goals) { dist[i] = 0; q.push(i); }
  for (let h = 0; h < q.length; h++) {
    const i = q[h], x = i % W, y = Math.floor(i / W);
    for (let d = 0; d < 4; d++) {
      const nx = x + DX[d], ny = y + DY[d], j = ny * W + nx;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const t = g.tiles[j], step = g.crates[j] ? 3 : 1;
      if (!(walkable(t) || g.crates[j] || t === 8 && g.keys || t === 10) || t === SPIKE) continue;
      if (dist[i] + step < dist[j]) { dist[j] = dist[i] + step; q.push(j); }
    }
  }
  // nothing reachable (say, prickles up around the way on): go and flip a switch
  if (dist[g.pi] >= 1e6) {
    const q2 = [], d2 = new Float64Array(W * H).fill(1e6);
    for (let i = 0; i < W * H; i++) if (g.tiles[i] === 5 && g.seen[i] && i !== g.pi) { d2[i] = 0; q2.push(i); }
    for (let k = 0; k < q2.length; k++) {
      const i = q2[k], x = i % W, y = Math.floor(i / W);
      for (let d = 0; d < 4; d++) { const j = (y + DY[d]) * W + x + DX[d]; if ((walkable(g.tiles[j]) || g.crates[j]) && d2[i] + 1 < d2[j]) { d2[j] = d2[i] + 1; q2.push(j); } }
    }
    return d2;
  }
  return dist;
}

function safeNeighbours(c, danger) {
  let n = danger.has(c.pi) ? 0 : 1;
  for (let d = 0; d < 4; d++) {
    const x = c.px + DX[d], y = c.py + DY[d], j = y * W + x;
    if (walkable(c.tile(x, y)) && !c.crates[j] && !danger.has(j)) n++;
  }
  return n;
}

export function value(c, dist, visits, hasty = false) {
  if (c.state === 'lost') return -1e9;
  if (c.state === 'won') return 1e9;
  let v = c.floor * 1e5 + (c.state === 'perk' ? 5e4 : 0);
  v += c.hp * 600 + c.max * 200;
  for (const e of c.enemies) v -= e.hp * (e.max >= 8 ? 250 : 150) + (e.under ? 30 : 0);
  v += c.tools.duster * 45 + c.tools.sling * 45 + c.tools.soap * 40 + c.tools.lantern * 25 + c.tools.acorn * (c.hp <= 2 ? 300 : 150) + c.dashes * 60;
  const danger = c.danger(), safe = hasty ? 5 : safeNeighbours(c, danger);
  const fear = c.hp <= 2 ? 1 : c.hp <= 3 ? 0.6 : 0.3;
  if (danger.has(c.pi) && !hasty) v -= 120 * fear;
  if (safe === 0) v -= 700 * fear; else if (safe === 1) v -= 120 * fear;
  if (c.state === 'play') v -= Math.min(dist[c.pi], 400) * 15;
  if (visits) v -= Math.min(visits.get(c.pi) ?? 0, VCAP) * VW;
  // go and tidy anything awake nearby while there are hearts to spare
  return v;
}

/** One ply over every action, with a second ply (the best reply) when enemies are close. */
export function choose(g, { depth = 2, visits = null, hasty = false } = {}) {
  if (g.state === 'perk') { const k = g.perkChoices.map((p) => PERK_ORDER.indexOf(p)); return 'P' + k.indexOf(Math.min(...k)); }
  const dist = goalMap(g);
  const near = g.enemies.some((e) => e.awake && Math.abs(e.x - g.px) + Math.abs(e.y - g.py) <= 5);
  const scored = [];
  for (const a of actions(g)) {
    const c = g.clone(); if (!c.act(a)) continue;
    // a little nudge so waiting is never preferred to walking toward the goal for free
    scored.push({ a, c, v: value(c, c.floor === g.floor ? dist : goalMap(c), visits, hasty) - (a === 'W' ? 30 : 0) - (a[0] === 'T' || a[0] === 'X' ? 15 : 0) });
  }
  if (!scored.length) return 'W';
  scored.sort((x, y) => y.v - x.v);
  if (depth > 1) {
    for (const s of scored.slice(0, 5)) {
      if (s.c.state !== 'play' || s.c.floor !== g.floor) continue;
      let best = -Infinity;
      for (const a of ['U', 'R', 'D', 'L', 'W', ...actions(s.c).filter((x) => x[0] === 'T' && s.c.hp <= 2)]) {
        const c2 = s.c.clone(); if (!c2.act(a)) continue;
        best = Math.max(best, value(c2, dist, visits));
      }
      s.v = MIX ? s.v * 0.4 + best * 0.6 : s.v + Math.min(0, best - s.v) * 0.7 + Math.max(0, best - s.v) * UP;
    }
    scored.sort((x, y) => y.v - x.v);
  }
  if (process.env.DEBUGBOT) console.log(scored.map((s) => `${s.a}:${Math.round(s.v)}`).join(' '), 'dist', dist[g.pi]);
  return scored[0].a;
}

/** Plays a whole run (or until `stopFloor`), with a turn cap per floor so a stuck bot gives up. */
export function play(seed, char, { depth = 2, hasty = false, random = false, stopFloor = FLOORS + 1, cap = 700 } = {}) {
  const g = new DungeonGame(seed, char), r = rng(seed * 31 + 7);
  let floor = 1, turns = 0;
  const visits = new Map();
  while ((g.state === 'play' || g.state === 'perk') && g.floor < stopFloor) {
    let a;
    if (random) { const all = g.state === 'perk' ? ['P0', 'P1', 'P2'] : actions(g); a = all[Math.floor(r() * all.length)]; }
    else a = choose(g, { depth, visits, hasty });
    if (!g.act(a)) { if (random) continue; g.act('W'); }
    if (g.floor !== floor) { floor = g.floor; turns = 0; visits.clear(); }
    visits.set(g.pi, (visits.get(g.pi) ?? 0) + 1);
    if (++turns > cap) break;
  }
  return g;
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const N = Number(process.env.SEEDS ?? 16);
  const rows = [];
  let area1 = 0, wins = 0, total = 0;
  for (let s = 1; s <= N; s++) {
    const char = s % 2 ? 'dora' : 'enzo';
    const g = play(1000 + s, char);
    total++; if (g.floor >= 5 || g.state === 'won') area1++; if (g.state === 'won') wins++;
    rows.push({ seed: 1000 + s, char, floor: g.floor, state: g.state, hp: `${g.hp}/${g.max}`, hurt: g.stats.hurt, tools: g.stats.toolsUsed, turns: g.turn, tidied: g.stats.tidied, perks: g.perks.join(' ') });
    if (s <= 2) {
      const again = replay({ seed: g.seed, char: g.char, mode: 'run', day: '', log: g.log });
      assert.ok(again, 'a bot run replays');
      assert.equal(again.floor, g.floor); assert.equal(again.hp, g.hp); assert.equal(again.turn, g.turn); assert.equal(again.stats.tidied, g.stats.tidied);
    }
  }
  if (process.env.TABLE) console.table(rows);
  let hastyWins = 0, hastyFloors = 0;
  const HN = Math.min(N, 12);
  for (let s = 1; s <= HN; s++) { const g = play(1000 + s, s % 2 ? 'dora' : 'enzo', { depth: 1, hasty: true }); if (g.state === 'won') hastyWins++; hastyFloors += g.floor; }
  let randFar = 0, randWins = 0;
  const RN = 20;
  for (let s = 1; s <= RN; s++) { const g = play(5000 + s, s % 2 ? 'dora' : 'enzo', { random: true, cap: 400 }); if (g.floor >= 3) randFar++; if (g.state === 'won') randWins++; }
  console.log(`careful bot: ${area1}/${total} cleared the Root Cellar, ${wins}/${total} won · hasty bot (no look-ahead): ${hastyWins}/${HN} won, floor ${(hastyFloors / HN).toFixed(1)} on average · random walker: ${randFar}/${RN} reached floor 3, ${randWins} won`);
  assert.ok(area1 >= total * 0.8, `the careful bot clears the Root Cellar on most seeds (${area1}/${total})`);
  assert.ok(wins >= total * 0.6, `the careful bot wins a good share of whole runs (${wins}/${total})`);
  assert.ok(hastyWins < wins && hastyWins <= HN * 0.5, `without look-ahead the bot wins far less (${hastyWins}/${HN})`);
  assert.ok(hastyFloors / HN >= 3, 'but even a hasty player gets a few floors down');
  assert.equal(randWins, 0, 'a random walker never wins');
  assert.ok(randFar <= RN * 0.2, `a random walker rarely gets past floor 2 (${randFar}/${RN})`);
  console.log(`Dust Bunny Dungeon bot: a careful player clears the Root Cellar on ${area1} of ${total} seeds and wins ${wins}; without look-ahead ${hastyWins} of ${HN}; a random walker wins none.`);
}
