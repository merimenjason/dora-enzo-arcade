// A squad leader for Whisker Saga. It only does what a player can: summon, field the strongest squad, spend gold,
// wear gear and fire skills. `timed` holds stuns and shields for an enemy's wind-up; `auto` fires everything the
// moment it charges, which is what the game's own auto switch does.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { Game, GEAR, MAX_TIER, CHAPTERS, STAGES, PER_CHAPTER, STEP, PAR } from '../.checks/saga-game.js';

const lowest = (b) => Math.min(...b.alive.map((u) => u.hp / u.max));
const mean = (b) => b.alive.reduce((a, u) => a + u.hp / u.max, 0) / b.alive.length;

/** Which slots a careful player would fire this frame. */
export function timed(b) {
  const cast = [], winding = b.winding, slam = winding && winding.special.kind === 'slam';
  const soon = b.foes.some((u) => u.special?.kind === 'slam' && u.d <= u.reach && u.specialT < 2.5);
  const stopper = b.heroes.some((u) => b.ready(u.slot) && ['strike', 'snipe', 'freeze'].includes(u.skill.kind));
  for (const u of b.heroes) {
    if (!b.ready(u.slot)) continue;
    const k = u.skill.kind, nearest = [...b.foes].sort((x, y) => x.d - y.d || x.uid - y.uid)[0];
    let go = false;
    if (k === 'strike') go = winding ? nearest === winding : !soon;
    else if (k === 'snipe' || k === 'freeze') go = !!winding || !soon;
    else if (k === 'ward') go = slam ? !stopper : !soon && lowest(b) < 0.85;
    else if (k === 'heal') go = mean(b) < 0.9 || lowest(b) < 0.75;
    else if (k === 'mend') go = lowest(b) < 0.7;
    else go = true;
    if (go) cast.push(u.slot);
  }
  return cast;
}

/** Fight the battle a game has started. Returns the finished battle. */
export function fight(g, policy = 'timed') {
  const b = g.battle;
  while (b.phase !== 'won' && b.phase !== 'lost') g.update(STEP, policy === 'auto' ? { auto: true } : { cast: timed(b) });
  return b;
}

/** Everything a player does between battles. */
export function prepare(g) {
  while (g.scrolls > 0) g.summon();
  for (let c = 0; c < CHAPTERS.length; c++) while (g.claimChest(c));
  for (const x of g.owned) while (g.starUp(x.id));
  g.autoSquad();
  GEAR.forEach((_, slot) => { for (let tier = 1; tier < MAX_TIER; tier++) while (g.bag[slot][tier] > 3 && g.merge(slot, tier)); });
  for (const id of g.squad) if (id) g.equipBest(id);
  g.levelSquad();
}

/** Play the campaign from a fresh save. Stops at `battles` fights or when the last boss falls. */
export function play(seed = 1, { battles = 600, policy = 'timed', onBattle } = {}) {
  const g = new Game(seed), out = { g, fights: 0, losses: 0, farms: 0, times: [], stars: 0, worst: 0, streak: 0, lossAt: {} };
  while (!g.complete && out.fights < battles) {
    prepare(g);
    const n = g.cleared;
    g.start(n);
    const b = fight(g, policy);
    out.fights++;
    onBattle?.(g, b, n);
    if (b.phase === 'won') { out.times.push(b.time); out.streak = 0; }
    else {
      out.losses++; out.lossAt[n] = (out.lossAt[n] ?? 0) + 1;
      out.worst = Math.max(out.worst, ++out.streak);
      g.leave();
      // Beaten: go back and earn gold on the hardest stage already cleared, on auto.
      if (n > 0) { prepare(g); g.start(n - 1); fight(g, 'auto'); out.fights++; out.farms++; }
    }
    g.leave();
  }
  out.stars = g.totalStars;
  return out;
}

/** Win rate over `rounds` fights of one fixed squad at one stage: how much timing is worth. */
export function duel(n, level, policy, rounds = 30, squad = ['enzo', 'dora', 'pip', 'bramble', 'flint']) {
  let wins = 0;
  for (let k = 0; k < rounds; k++) {
    const g = new Game(100 + k);
    for (let i = 0; i < n; i++) g.stars[i] = 1;
    for (const id of squad) g.heroes[id] = { level, stars: 1 + Math.floor(n / 25), shards: 0, gear: Array(4).fill(Math.min(MAX_TIER, Math.floor(n / 16))) };
    g.squad = [...squad];
    g.start(n);
    if (fight(g, policy).phase === 'won') wins++;
  }
  return wins / rounds;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const seeds = [1, 2, 3, 4, 5, 6, 7, 8];
  let slowest = 0, losses = 0;
  for (const seed of seeds) {
    const r = play(seed), g = r.g, avg = r.times.reduce((a, b) => a + b, 0) / r.times.length;
    const walls = Object.entries(r.lossAt).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([n, c]) => `${+n + 1}×${c}`).join(' ');
    console.log(`seed ${seed}: ${g.cleared}/${STAGES} stages in ${r.fights} fights, ${r.losses} lost (worst run ${r.worst}), ${r.stars} stars, ${g.owned.length} heroes, avg ${avg.toFixed(0)}s, walls ${walls || 'none'}`);
    assert.ok(g.complete, `seed ${seed} finishes the campaign within 600 fights`);
    assert.ok(r.losses / r.fights < 0.25, `seed ${seed} loses under a quarter of its fights (${r.losses}/${r.fights})`);
    assert.ok(r.worst <= 8, `seed ${seed} is never stuck on one stage for more than eight tries (${r.worst})`);
    assert.ok(g.owned.length >= 14, `seed ${seed} gathers at least 14 of the 18 heroes (${g.owned.length})`);
    assert.ok(avg > 25 && avg < PAR, `seed ${seed} wins in ${avg.toFixed(0)}s on average, between 25s and par`);
    assert.ok(r.stars < STAGES * 3, `seed ${seed} leaves some stars to come back for (${r.stars})`);
    slowest = Math.max(slowest, r.fights); losses += r.losses;
  }
  assert.ok(losses >= 5, `the campaign pushes back: ${losses} losses across ${seeds.length} careful runs`);

  // Timing has to be worth something: the same slightly under-levelled squad, skills timed against skills on auto.
  for (const [n, level] of [[29, 17], [49, 28]]) {
    const careful = duel(n, level, 'timed'), auto = duel(n, level, 'auto');
    console.log(`stage ${n + 1} at level ${level}: timed wins ${Math.round(careful * 100)}%, auto wins ${Math.round(auto * 100)}%`);
    assert.ok(careful >= auto + 0.3, `timing skills at stage ${n + 1} beats auto by 30 points (${careful} against ${auto})`);
  }

  // A level-1 squad that never spends gold must hit a wall early.
  for (const seed of seeds.slice(0, 3)) {
    const g = new Game(seed);
    for (let tries = 0; tries < 60 && !g.complete; tries++) {
      while (g.scrolls > 0) g.summon();
      g.autoSquad(); g.start(g.cleared); fight(g); g.leave();
    }
    console.log(`seed ${seed}: an unlevelled squad stops at stage ${g.cleared + 1}`);
    assert.ok(g.cleared < 2 * PER_CHAPTER, `seed ${seed}: an unlevelled squad cannot leave chapter two (reached ${g.cleared + 1})`);
    assert.ok(g.cleared >= 3, `seed ${seed}: the first three stages need no levelling (reached ${g.cleared + 1})`);
  }
  console.log(`\nWhisker Saga bot: PASS (slowest campaign ${slowest} fights)`);
}
