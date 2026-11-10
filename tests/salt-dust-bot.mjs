// Salt & Dust bots, playing like people rather than perfect players.
// - The fight bot plays the Dust Runner fight the way a first-time player does: it often walks somewhere that isn't
//   the best tile, shoots whoever looks closest rather than the weakest, forgets to Mend about half the time, sometimes
//   ends a turn with AP left, and never plans ahead. With help on (the default) it must win at least 85% of fights from
//   the normal start; the quiet start (Wayra's tracks, or hiding from the carts) must be easier still. With help off it
//   only reports.
// - The journey bot plays the whole chapter making random choices (any reply on offer, any route, rest or not), with
//   the same clumsy fighting, and retries a lost fight as a player would. It must reach the ending in every seed
//   without running out of options, and it reports how often players talk their way through.
// `--quick` runs fewer seeds. Run after compiling the engine into .checks/ (npm test does).
import assert from 'node:assert/strict';
import { SaltGame, freshSave, dist, NPCS } from '../.checks/salt-dust-game.js';

const QUICK = process.argv.includes('--quick');
const SEEDS = QUICK ? 120 : 400;
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const tile = (k) => { const [x, y] = k.split(',').map(Number); return { x, y }; };

/** one hero turn, played clumsily */
function heroTurn(g, r) {
  for (let step = 0; step < 12; step++) {
    const u = g.current(); if (!u || u.side !== 'hero' || g.combat.over) return;
    const foes = g.combat.units.filter((f) => f.side === 'foe' && !f.down);
    // a hurt friend: Enzo remembers to Mend about half the time
    if (u.id === 'enzo' && g.combat.mends > 0 && u.ap >= 3 && r() < 0.5) {
      const hurt = g.combat.units.filter((h) => h.side === 'hero' && g.canMend(h) && h.hp <= h.max / 2)[0];
      if (hurt) { g.mend(hurt.id); continue; }
    }
    if (u.hp <= 4 && g.canDrink() && r() < 0.3) { g.drink(); continue; }
    // shoot or jab whoever is closest that can be hit (not the best target)
    const can = foes.filter((f) => g.hitChance(u, f) > 0).sort((a, b) => dist(u, a) - dist(u, b));
    if (can.length && u.ap >= g.attackCost(u)) { g.attack(can[r() < 0.25 && can[1] ? 1 : 0].id); continue; }
    if (r() < 0.12) break; // ends the turn early, AP left over
    // walk: usually toward the nearest Runner, often not to the best tile
    const reach = [...g.reach(u).entries()];
    if (!reach.length || u.ap < 1) break;
    const near = foes.sort((a, b) => dist(u, a) - dist(u, b))[0];
    if (!near) break;
    let pick;
    if (r() < 0.3) pick = reach[Math.floor(r() * reach.length)];
    else {
      // keep AP for an attack if one would be in reach after walking; humans roughly do
      const keep = u.ap - g.attackCost(u);
      const ok = reach.filter(([, p]) => p.length <= Math.max(1, keep));
      const pool = ok.length ? ok : reach;
      pool.sort((a, b) => dist(tile(a[0]), near) - dist(tile(b[0]), near));
      pick = pool[Math.min(pool.length - 1, Math.floor(r() * 3))];
    }
    const t = tile(pick[0]);
    if (!g.move(t.x, t.y)) break;
  }
  if (!g.combat.over && g.heroTurn()) g.endTurn();
}
function playFight(g, r) {
  for (let i = 0; i < 400 && !g.combat.over; i++) {
    const u = g.current();
    if (u.side === 'foe') g.foeTurn(); else heroTurn(g, r);
    g.events.length = 0;
  }
  return g.combat.over;
}
function newFight(seed, flags, help = true) {
  const g = new SaltGame({ ...freshSave(seed * 7919 + 1) });
  g.help = help; Object.assign(g.f, flags); g.arriveYard(); g.startCombat();
  return g;
}

// ─── the fight ───
const rate = (flags, help) => {
  let won = 0, rounds = 0, hpLeft = 0;
  for (let s = 1; s <= SEEDS; s++) {
    const g = newFight(s, flags, help), r = rng(s * 31 + 7);
    if (playFight(g, r) === 'won') { won++; hpLeft += g.unit('dora').hp + g.unit('enzo').hp; }
    rounds += g.combat.round;
  }
  return { win: won / SEEDS, rounds: rounds / SEEDS, hp: won ? hpLeft / won : 0 };
};
const normal = rate({}, true), quiet = rate({ tracks: true }, true), strict = rate({}, false);
console.log(`fight, help on: casual player wins ${(normal.win * 100).toFixed(0)}% (avg ${normal.rounds.toFixed(1)} rounds, ${normal.hp.toFixed(1)} health left)`);
console.log(`fight, quiet start: wins ${(quiet.win * 100).toFixed(0)}% (avg ${quiet.rounds.toFixed(1)} rounds)`);
console.log(`fight, help off: wins ${(strict.win * 100).toFixed(0)}% (avg ${strict.rounds.toFixed(1)} rounds)`);
assert.ok(normal.win >= 0.85, `a casual player should win at least 85% of fights with help on (got ${(normal.win * 100).toFixed(0)}%)`);
assert.ok(quiet.win >= normal.win - 0.02, 'the quiet start is no harder');
assert.ok(normal.win < 1 || strict.win < 1, 'the fight is not a formality for everyone');

// ─── the whole chapter, choices at random ───
let ended = 0, talked = 0, fought = 0, losses = 0, steps = 0, checksPassed = 0;
const how = {};
for (let s = 1; s <= SEEDS; s++) {
  const g = new SaltGame(freshSave(s)), r = rng(s * 977);
  let guard = 0;
  while (g.mode !== 'end' && guard++ < 3000) {
    if (g.mode === 'explore') {
      // wander to someone: in town, anyone; after a few talks (or at random), the road; in the yard, Tika then the pump
      if (g.place === 'town') {
        const people = NPCS.filter((n) => n.place === 'town').map((n) => n.id);
        if (g.f.quest && r() < 0.3) g.clickSpot('road'); else g.clickNpc(people[Math.floor(r() * people.length)]);
      } else if (!g.f.peace) g.clickNpc('tika'); else g.clickSpot('pump');
      for (let i = 0; i < 600 && g.mode === 'explore'; i++) g.tick(1 / 30);
    } else if (g.mode === 'talk') {
      const all = g.options(), o = all.filter((q) => !q.blocked);
      assert.ok(o.length, `stuck in ${g.talk.id} with nothing to say`);
      // any reply on offer, at random
      assert.ok(g.choose(all.indexOf(o[Math.floor(r() * o.length)])));
    } else if (g.mode === 'travel') {
      if (g.journey) { g.tick(0.1); continue; }
      if (g.canRest() && r() < 0.3) { g.rest(); continue; }
      const legs = g.legs();
      if (g.at === 'tunupa' && r() < 0.1) { g.backToTown(); continue; }
      g.go(Math.floor(r() * legs.length));
    } else if (g.mode === 'combat') {
      const res = playFight(g, r);
      if (res === 'lost') losses++;
      g.syncFromCombat(); g.finishCombat();
    } else if (g.mode === 'finding') g.tick(0.5);
    steps++;
  }
  assert.equal(g.mode, 'end', `seed ${s}: the chapter ended (stuck in ${g.mode} ${g.talk?.id ?? ''} at ${g.place}/${g.at})`);
  ended++; checksPassed += g.passed.length;
  how[g.f.peace] = (how[g.f.peace] ?? 0) + 1;
  if (g.f.peace === 'fought') fought++; else talked++;
}
console.log(`journey: ${ended}/${SEEDS} random players reached the ending; ${talked} without a fight, ${fought} by fighting (${losses} lost a fight first and tried again); ${(checksPassed / SEEDS).toFixed(1)} checks passed on average`);
console.log('  how the yard opened:', Object.entries(how).map(([k, v]) => `${k} ${v}`).join(', '));
assert.equal(ended, SEEDS);
