// Cloudpop bots: whole runs played through the engine by players who think at human speed. Each bot looks at the
// valley only every 200-300 ms of game time (it never reacts faster than a person), and its placements are imperfect:
// it picks a spot from a range of decent ones and then misses by up to a couple of tower widths.
//   casual   - a new player's save (level 1: Pebble Slinger, Busker, Llama, Hay-Bale Cannon, Dora), Assist on, buys
//              what it can afford in a loose order, upgrades whichever tower takes its fancy, reads the next-round
//              preview for night clouds, and sometimes forgets its abilities.
//   strategy - a seasoned save (every tower, Lab tiers open, a few lore perks): better spots, a splash-heavy build,
//              sight before night rounds, focuses its best tower and saves abilities for bosses.
// Checks: casual wins Easy on both beginner maps at least 90% of seeds; strategy wins Medium; reports Hard and an
// expert map. `--quick` runs fewer seeds (npm test). Exports `play` for tests/cloudpop.mjs.
import assert from 'node:assert/strict';
import { Game, DT } from '../.checks/cloudpop-game.js';
import { TOWER, TOWERS } from '../.checks/cloudpop-towerdata.js';
import { HEROES } from '../.checks/cloudpop-heroes.js';
import { MAP, WORLD_W, WORLD_H } from '../.checks/cloudpop-maps.js';
import { PUFFS } from '../.checks/cloudpop-puffs.js';
import { preview } from '../.checks/cloudpop-rounds.js';
import { statsAt } from '../.checks/cloudpop-info.js';
import { rng } from '../.checks/cloudpop-rng.js';
import { newSave, runConfig, LORE, levelXp } from '../.checks/cloudpop-meta.js';

const QUICK = process.argv.includes('--quick');

/** a save for a profile */
export function profileSave(kind) {
  const s = newSave();
  if (kind === 'strategy') {
    s.xp = levelXp(20); s.heroes = ['dora', 'enzo'];
    for (const t of TOWERS) s.tiers[t.id] = [5, 5, 5];
    s.lore = LORE.filter(n => n.row <= 1).map(n => n.id);
  }
  return s;
}

/** how much road a tower at (x, y) covers within range R (sampled every 16 px) */
function coverage(g, x, y, R) {
  let n = 0;
  for (const r of g.roads) for (let i = 0; i < r.n; i += 4) { const dx = r.pts[i * 2] - x, dy = r.pts[i * 2 + 1] - y; if (dx * dx + dy * dy < R * R) n++; }
  return n;
}
function rangeOf(def, g) {
  if (def === 'hero') return 170;
  const s = TOWER[def].base(); return s.atks.length ? Math.max(...s.atks.map(a => a.range)) : s.aura || 160;
}
/** candidate spots for a tower: every 32 px, scored by road coverage */
function spots(g, def, cache) {
  const key = def === 'hero' ? 'hero' : TOWER[def].place + ':' + rangeOf(def, g);
  if (cache[key]) return cache[key];
  const R = rangeOf(def, g), out = [];
  for (let y = 40; y < WORLD_H - 30; y += 32) for (let x = 40; x < WORLD_W - 30; x += 32) {
    if (g.placeReason(def, x, y) === 'On the road' || g.placeReason(def, x, y) === 'Off the map') continue;
    const c = coverage(g, x, y, R); if (c > 0) out.push([x, y, c]);
  }
  out.sort((a, b) => b[2] - a[2]);
  return (cache[key] = out);
}

const CASUAL_POOL = ['pebble', 'pebble', 'hay', 'busker', 'llama', 'hay', 'pebble', 'busker'];
const STRAT_POOL = ['hay', 'ember', 'busker', 'pebble', 'ember', 'quinoa', 'ice', 'hay', 'condor', 'lantern', 'windmill', 'boat', 'llama'];
// paths a sensible player tends to favour (main, then second); the casual player sometimes ignores these
const FAV = { pebble: [0, 1], busker: [1, 0], ember: [0, 2], ice: [1, 0], llama: [1, 0], hay: [0, 1], condor: [0, 1], boat: [1, 2], windmill: [1, 0], lantern: [0, 1], quinoa: [0, 1] };

/** play one run; returns the summary */
export function play(map, diff, seed, kind = 'casual', mode = 'standard', opts = {}) {
  const s = profileSave(kind);
  const cfg = runConfig(s, map, diff, mode, seed);
  const g = new Game(cfg); g.quiet = true; g.auto = true;
  const r = rng(seed * 7919 + (kind === 'strategy' ? 13 : 1));
  const cache = {}, fav = {};
  const casual = kind === 'casual';
  const pool = (casual ? CASUAL_POOL : STRAT_POOL).filter(d => g.allowed(d));
  let next = 0, ticks = 0, wait = 0, built = 0, forgetAbilities = casual && r() < 0.5;
  const maxRound = opts.maxRound ?? g.lastRound;

  const sees = () => g.towers.some(t => t.s.sight || t.s.auraSight);
  const nightSoon = () => [g.round, g.round + 1].some(n => preview(n, cfg.seed).some(q => q.night || PUFFS[q.kind].night)) || g.puffs.some(p => p.night);
  const tryPlace = def => {
    const list = spots(g, def, cache); if (!list.length) return false;
    const top = Math.max(3, Math.floor(list.length * (casual ? 0.35 : 0.08)));
    for (let k = 0; k < 8; k++) {
      const [x, y] = list[Math.floor(r() * top)];
      const miss = casual ? 50 : 18, px = x + (r() - 0.5) * miss, py = y + (r() - 0.5) * miss;
      const res = g.place(def, px, py);
      if (typeof res !== 'string') { fav[res.id] = casual && r() < 0.35 ? [Math.floor(r() * 3), Math.floor(r() * 3)] : (FAV[def] ?? [0, 1]); return true; }
    }
    return false;
  };
  const upgradeOptions = () => {
    const out = [];
    for (const t of g.towers) {
      if (t.def === 'hero') continue;
      const [a, b] = fav[t.id] ?? [0, 1];
      for (const p of a === b ? [a] : [a, b]) { const why = g.upgradeReason(t, p); if (why && why !== 'Not enough coins') continue; out.push({ t, p, cost: g.upgradePrice(t, p), main: p === a }); }
    }
    return out;
  };
  let saving = false;
  const buyUpgrade = () => {
    if (casual) {
      const opt = upgradeOptions().filter(o => o.cost <= g.cash);
      if (!opt.length) return false;
      const o = opt[Math.floor(r() * opt.length)];
      return !g.upgrade(o.t.id, o.p);
    }
    // strategy: pick the best next upgrade (main paths first, deepest first, busiest tower first) and save up for it
    const opt = upgradeOptions().filter(o => o.cost <= g.cash + (g.round > 30 ? 2500 : 0));
    if (!opt.length) { saving = false; return false; }
    opt.sort((x, y) => (y.main - x.main) || (y.t.tiers[y.p] - x.t.tiers[x.p]) || (y.t.pops - x.t.pops));
    const o = opt[0];
    if (o.cost > g.cash) { saving = true; return false; }
    saving = false;
    return !g.upgrade(o.t.id, o.p);
  };
  const giveSight = () => {
    for (const t of g.towers) {
      if (t.def === 'hero') continue;
      for (let p = 0; p < 3; p++) {
        if (g.upgradeReason(t, p)) continue;
        const tiers = [...t.tiers]; tiers[p]++;
        if (statsAt(t.def, tiers).sight && g.upgradePrice(t, p) <= g.cash) { g.upgrade(t.id, p); fav[t.id] = [p, (fav[t.id] ?? [0, 1])[0]]; return true; }
      }
    }
    return false;
  };

  const decide = () => {
    // night clouds coming and nobody can see them: find a sight upgrade
    if (nightSoon() && !sees() && giveSight()) return;
    if (cfg.hero && !g.hero() && g.cash >= g.heroPrice() && built >= (casual ? 1 : 1)) { if (tryPlace('hero')) return; }
    const want = casual ? Math.min(14, 2 + Math.floor(g.round / 3.5)) : Math.min(24, 3 + Math.floor(g.round / 3.5));
    const def = pool[next % pool.length];
    const towers = g.towers.filter(t => t.def !== 'hero').length;
    if ((casual ? (towers < want || r() < 0.15) : (towers < want && (!saving || towers < want / 2))) && g.cash >= g.price(def)) { if (tryPlace(def)) { next++; built++; return; } next++; }
    if (towers >= 2 || g.cash > 900) { buyUpgrade(); if (!casual) buyUpgrade(); }
    // abilities: casual fires them when it remembers, strategy keeps them for heavy moments
    for (const t of g.towers) g.abilities(t).forEach((ab, i) => {
      if ((t.abilityCd[i] ?? 0) > 0 || !g.active) return;
      const boss = g.puffs.some(p => PUFFS[p.kind].boss), crowd = g.puffs.length > 40;
      if (casual ? (!forgetAbilities && r() < 0.3 && g.puffs.length > 10) : (boss || crowd || ab.kind === 'cash')) g.useAbility(t.id, i);
    });
  };

  g.startRound();
  let guard = 0;
  while (!(g.over === 'lost') && !(g.over === 'won') && g.round <= maxRound + 1 && guard++ < 3_000_000) {
    if (--wait <= 0) { decide(); wait = 6 + Math.floor(r() * 3); }
    if (!g.active && !g.over) g.startRound();
    g.step(DT); ticks++;
    if (opts.maxRound && g.round > opts.maxRound) break;
  }
  return { map, diff, mode, kind, seed, won: g.over === 'won', round: g.round - (g.over === 'won' ? 1 : 0), lives: g.lives, towers: g.towers.length, livesLost: g.stats.livesLost, secs: Math.round(ticks * DT), cash: Math.round(g.cash) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const seeds = n => Array.from({ length: n }, (_, i) => 101 + i * 37);
  const t0 = Date.now();
  const report = (label, runs) => {
    const w = runs.filter(x => x.won).length;
    const lost = runs.filter(x => !x.won).map(x => x.round);
    console.log(`${label}: ${w}/${runs.length} won${lost.length ? `, lost at rounds ${lost.join(', ')}` : ''}; avg lives left ${Math.round(runs.reduce((a, x) => a + x.lives, 0) / runs.length)}`);
    return w / runs.length;
  };
  const N = QUICK ? 4 : 12;
  const casual = [];
  for (const map of ['meadow', 'loop']) {
    const runs = seeds(N).map(sd => play(map, 'easy', sd, 'casual'));
    casual.push(...runs); report(`casual · Easy · ${map}`, runs);
  }
  const casualRate = casual.filter(x => x.won).length / casual.length;
  const med = seeds(QUICK ? 3 : 10).map(sd => play(['meadow', 'salar', 'canyon'][sd % 3], 'medium', sd, 'strategy'));
  const medRate = report('strategy · Medium', med);
  if (!QUICK) {
    report('strategy · Hard · meadow', seeds(4).map(sd => play('meadow', 'hard', sd, 'strategy')));
    report('strategy · Hard · forest', seeds(3).map(sd => play('forest', 'hard', sd, 'strategy')));
    report('casual · Medium · meadow', seeds(6).map(sd => play('meadow', 'medium', sd, 'casual')));
    report('strategy · Easy · summit', seeds(3).map(sd => play('summit', 'easy', sd, 'strategy')));
  }
  console.log(`(${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  assert.ok(casualRate >= 0.9, `casual should win Easy on the beginner maps at least 90% of the time (got ${Math.round(casualRate * 100)}%)`);
  assert.ok(medRate >= (QUICK ? 0.66 : 0.8), `strategy should win Medium (got ${Math.round(medRate * 100)}%)`);
  console.log('cloudpop bots ok');
}
