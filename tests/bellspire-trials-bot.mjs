// The Sunken Bellspire: bots for the Echo Trials and New Game+.
//  * the Guardian Rush: a human-paced player (the boss bot's eyes, 12-15 ticks late, and its fumbles) fights all eight
//    guardians back to back from a finished save, with only the trial's pantry and one heal between each. Casual
//    (the helping hand on) must finish it in at least 75% of seeds; the gold time sits just under the best casual run
//    and above the pro bot's typical one, so gold is hard but possible.
//  * the area runs: the route bot's planner plays each run for real (enemies, doors, wind); gold is a little slower
//    than its best line, which a person rarely matches exactly.
//  * New Game+: each guardian, tougher and with its new attack, against a party with the abilities of that point in
//    the story but the levels, gear and spells of a finished game. Casual must win within three tries in at least
//    85% of seeds.
// Run after compiling the engine into .checks/. `--quick` runs fewer seeds; `--only=rush|runs|ngp` one part.
import assert from 'node:assert/strict';
import { BellspireGame, SCRIPTS, ABILITY_ORDER, ALL_BOSSES, ROOMS, INFO, TRIALS, RUSH, trialById, medalFor } from '../.checks/bellspire-game.js';
import { presetSave, bossBot, decide, routeBot } from './bellspire-bot.mjs';

const QUICK = process.argv.includes('--quick');
const ONLY = process.argv.find((a) => a.startsWith('--only='))?.slice(7);
const VERBOSE = process.argv.includes('--verbose');
const NO = { left: false, right: false, up: false, down: false, jump: false, attack: false, dash: false, cast: false, tag: false };

/** A finished save (every guardian calm, every ability, every shrine lit), standing at `shrine`. */
export function finishedSave(shrine = 'landing') {
  const s = presetSave('tune');
  s.abilities = [...ABILITY_ORDER];
  if (!s.spells.includes('chime')) s.spells.push('chime');
  for (const id of ALL_BOSSES) s.flags.push(`boss:${id}`, `script:boss:${id}`);
  s.flags.push('keeper', 'belfry:visited', 'ending', 'belfry:ending', 'epilogue', 'epilogue2', ...Object.keys(SCRIPTS).map((k) => `script:${k}`));
  for (const r of ROOMS) if (INFO.get(r.id).things.some((t) => t.ch === 'S')) s.flags.push(`shrine:${r.id}`);
  s.shrine = shrine;
  return s;
}

/** A human-paced player through the Guardian Rush. */
export function rushBot(seed, { assist = true, delay = 13, noise = 0.08 } = {}) {
  const g = new BellspireGame(finishedSave(), { assist, strict: !assist }, seed);
  for (let i = 0; i < 5; i++) g.step({ ...NO });
  const why = g.startTrial('rush');
  if (why) return { won: false, why };
  let rs = seed * 9301 + 49297;
  const rnd = () => { rs = (rs * 1103515245 + 12345) & 0x7fffffff; return rs / 0x7fffffff; };
  const seen = [];
  let tick = 0, prev = NO, jumpHold = 0, ate = 0, lastDecision = NO, react = 0, result = null, reached = 0, low = 1;
  while (g.trial && tick < 60 * 60 * 30) {
    tick++;
    if (g.dialog) { g.step({ ...NO, jump: tick % 2 === 0 }); for (const e of g.drainEvents()) if (e.k === 'trial') result = e; continue; }
    const b = g.boss;
    seen.push(b ? {
      id: b.id, st: b.st, tell: b.tellT > 0, harm: b.harm.map((r) => ({ ...r })), hurt: b.hurt.map((r) => ({ ...r })), body: { ...b.body }, x: b.x, y: b.y, calm: b.calm,
      shots: g.shots.filter((s) => !s.friendly).map((s) => ({ x: s.x, y: s.y, vx: s.vx, vy: s.vy, g: s.g, kind: s.kind })),
      waves: g.waves.map((w) => ({ x: w.x, dir: w.dir, speed: w.speed, h: w.h })), rings: g.rings.filter((r) => !r.friendly).map((r) => ({ ...r })),
      markers: g.markers.map((m) => ({ ...m })), heads: b.heads.map((h) => ({ st: h.st, x: h.x })),
    } : null);
    if (seen.length > delay + 2) seen.shift();
    const v = seen[Math.max(0, seen.length - 1 - delay)];
    let inp = lastDecision;
    if (--react <= 0) { react = 3 + Math.floor(rnd() * 4); inp = v ? decide(g, v, rnd, noise) : { ...NO }; lastDecision = inp; }
    if (inp.jump && !prev.jump) jumpHold = 16;
    const out = { ...inp };
    if (jumpHold > 0) { out.jump = true; jumpHold--; } else if (prev.jump && inp.jump) out.jump = false;
    if (out.attack && prev.attack) out.attack = false;
    if (out.tag && prev.tag) out.tag = false;
    if (g.leadSave.hp < g.stats(g.lead).maxHp * 0.3 && g.save.food.cake > 0 && tick - ate > 300) { g.eat('cake'); ate = tick; }
    const other = g.lead === 'dora' ? 'enzo' : 'dora';
    if (g.save.heroes[other].down && g.save.food.tea > 0 && tick - ate > 300) { g.eat('tea'); ate = tick; }
    g.step(out);
    if (g.trial) { reached = Math.max(reached, g.trial.i); const f = (g.save.heroes.dora.hp + g.save.heroes.enzo.hp) / (g.stats('dora').maxHp + g.stats('enzo').maxHp); if (f < low) low = f; }
    for (const e of g.drainEvents()) if (e.k === 'trial') result = e;
    prev = out;
  }
  return { won: !!result?.won, secs: result?.secs ?? null, medal: result?.medal ?? null, reached, low, best: g.save.medals.rush ?? null };
}

const pct = (n, d) => `${Math.round((n / d) * 100)}%`;
let checks = 0;

function runRush() {
  const seeds = QUICK ? 6 : 16;
  const def = trialById('rush');
  for (const [label, assist, need] of [['casual', true, 0.75], ['pro', false, 0]]) {
    const times = [];
    let won = 0, reached = 0;
    for (let s = 1; s <= seeds; s++) {
      const r = rushBot(s * 7919, { assist, delay: 12 + (s % 4), noise: assist ? 0.1 : 0.06 });
      if (VERBOSE) console.log('rush', label, s, r);
      if (r.won) { won++; times.push(r.secs); } else reached += r.reached;
    }
    times.sort((a, b) => a - b);
    const medals = times.map((t) => medalFor(def, t));
    const count = (m) => medals.filter((x) => x === m).length;
    console.log(`rush   ${label.padEnd(6)} ${won}/${seeds} finished (${pct(won, seeds)}); times ${times.length ? `${times[0]}-${times.at(-1)}s, median ${times[Math.floor(times.length / 2)]}s` : '-'}; gold ${count('gold')}, silver ${count('silver')}, bronze ${count('bronze')}, none ${count(null)} (medals at ${def.medals.join('/')}s)${won < seeds ? `; the others got to guardian ${(reached / (seeds - won) + 1).toFixed(1)} on average` : ''}`);
    if (need) { assert.ok(won / seeds >= need, `the casual rush bot finishes the Guardian Rush in ${need * 100}% of seeds (got ${pct(won, seeds)})`); checks++; }
    if (label === 'casual') {
      assert.ok(count('gold') <= Math.ceil(times.length / 3), 'gold is hard: most casual finishes are not gold');
      assert.ok(times.length && times.at(-1) <= def.medals[2], 'every casual finish earns at least bronze');
      checks += 2;
    }
  }
}

function runRuns() {
  const seeds = QUICK ? [1] : [1, 2, 3];
  for (const def of TRIALS.filter((t) => t.kind === 'run')) {
    const times = [];
    for (const seed of seeds) {
      const r = routeBot(seed, { trial: def.id, save: finishedSave(def.from), log: VERBOSE });
      if (VERBOSE || !r.ok) console.log(def.id, seed, r);
      assert.ok(r.ok, `the route bot finishes ${def.name} (seed ${seed})`);
      times.push(r.secs);
    }
    const best = Math.min(...times);
    console.log(`run    ${def.id.padEnd(11)} ${def.goals.length} bells: the planner's line ${times.join(', ')}s (${medalFor(def, best)}); medals at ${def.medals.join('/')}s`);
    assert.ok(best <= def.medals[0], `${def.name}: gold is possible (the planner's line ${best}s, gold ${def.medals[0]}s)`);
    assert.ok(def.medals[0] <= best * 1.35, `${def.name}: gold is hard (within 35% of the planner's line)`);
    checks += 3;
  }
}

function runNgp() {
  const seeds = QUICK ? 8 : 24;
  for (const id of RUSH) for (const [label, assist, need] of [['casual', true, 0.85], ['pro', false, 0]]) {
    let wins = 0, first = 0, ticks = 0, lows = 0;
    for (let s = 1; s <= seeds; s++) {
      const r = bossBot(id, s * 7919, { assist, delay: 12 + (s % 4), noise: assist ? 0.1 : 0.06, ngp: true });
      if (r.won) { wins++; ticks += r.ticks; if (r.tries === 1) first++; }
      lows += r.low;
    }
    console.log(`NG+    ${id.padEnd(9)} ${label.padEnd(6)} ${wins}/${seeds} won within 3 tries (${pct(wins, seeds)}), ${first} on the first try, ${wins ? Math.round(ticks / wins / 60) : '-'}s a win, lowest HP ${Math.round((lows / seeds) * 100)}% on average`);
    if (need) { assert.ok(wins / seeds >= need, `NG+ ${id}: casual wins within 3 tries in ${need * 100}% of seeds`); checks++; }
  }
}

/** Every trials bot (the boss and route bots run these too, after their own). */
export function runTrialBots() {
  if (!ONLY || ONLY === 'rush') runRush();
  if (!ONLY || ONLY === 'runs') runRuns();
  if (!ONLY || ONLY === 'ngp') runNgp();
  console.log(`bellspire trials bots: ${checks} checks passed`);
}
if (process.argv[1]?.endsWith('bellspire-trials-bot.mjs')) runTrialBots();
