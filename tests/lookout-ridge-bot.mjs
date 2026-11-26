// Lookout Ridge self-play: both heroes are bots, played through the engine on fixed seeds, the same seeds for both arms.
//   smart - mends an open burrow roof with the Darning Needle, pulls a thread out from under a predator, else shoots
//           the weaker predator.
//   dumb  - never darns or pulls on purpose: always shoots the weaker predator.
// Full run (`npm run bot:lookout-ridge`): 300 matches an arm, spread over worker threads. Heroes who darn must win at
// least 10 points more often than heroes who don't (measured: 54% against 35%; the prototype measured 55% against
// 30%). A single match swings on a pixel, so smaller samples are noisy: `--quick` (in `npm test`) plays 16 matches an
// arm and checks only that every match ends, that smart heroes darn and pull, and that dumb heroes never darn.
import assert from 'node:assert/strict';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { availableParallelism } from 'node:os';
import { createGame, isWin } from '../.checks/lookout-ridge-game.js';

export function play(seed, smart) {
  const g = createGame(seed);
  g.autoHero = true; g.smartHeroes = smart;
  g.newGame(seed);
  let frames = 0;
  while (g.state !== 'over' && frames < 120000) { g.fast(600); frames += 600; }
  const act = { darn: 0, pull: 0, kits: 0 };
  for (const e of g.LOG) {
    if (e[0] === 'darn') act.darn++;
    if (e[0] === 'pull' && (e[1] === 'dora' || e[1] === 'enzo')) act.pull++;
    if (e[0] === 'kit') act.kits++;
  }
  return { over: g.state === 'over', win: isWin(g.banner), banner: g.banner, ...act };
}

if (!isMainThread) {
  parentPort.postMessage(workerData.jobs.map(([seed, smart]) => ({ smart, ...play(seed, smart) })));
} else {
  const QUICK = process.argv.includes('--quick');
  const N = +(process.env.LR_N || (QUICK ? 16 : 300));
  const S0 = 50000, MARGIN = 0.10;
  const jobs = [];
  for (let i = 0; i < N; i++) for (const smart of [true, false]) jobs.push([S0 + i * 7919, smart]);
  const nw = Math.max(1, Math.min(availableParallelism() - 1, 8, jobs.length));
  const t0 = Date.now();
  const parts = await Promise.all(Array.from({ length: nw }, (_, w) => new Promise((res, rej) => {
    const wk = new Worker(new URL(import.meta.url), { workerData: { jobs: jobs.filter((_, j) => j % nw === w) } });
    wk.once('message', res); wk.once('error', rej);
  })));
  const arm = (smart) => {
    const out = { wins: 0, stuck: 0, darn: 0, pull: 0, kits: 0, banners: {} };
    for (const r of parts.flat()) if (r.smart === smart) {
      if (!r.over) { out.stuck++; continue; }
      if (r.win) out.wins++;
      out.darn += r.darn; out.pull += r.pull; out.kits += r.kits;
      out.banners[r.banner] = (out.banners[r.banner] || 0) + 1;
    }
    return out;
  };
  const smart = arm(true), dumb = arm(false);
  const pct = (n) => (100 * n / N).toFixed(0) + '%';
  console.log(`Lookout Ridge self-play, ${N} matches an arm on ${nw} threads (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  console.log(`  heroes who darn:       win ${pct(smart.wins)}, ${(smart.darn / N).toFixed(2)} darns, ${(smart.pull / N).toFixed(2)} pulls, ${(smart.kits / N).toFixed(2)} kits lost a match`, JSON.stringify(smart.banners));
  console.log(`  heroes who never darn: win ${pct(dumb.wins)}, ${(dumb.kits / N).toFixed(2)} kits lost a match`, JSON.stringify(dumb.banners));
  assert.equal(smart.stuck + dumb.stuck, 0, 'every match reaches an end');
  assert.ok(smart.darn > 0 && smart.pull > 0, 'smart heroes darn and pull');
  assert.equal(dumb.darn, 0, 'dumb heroes never darn');
  if (QUICK) console.log('PASS lookout-ridge bots (quick: every match ends; the win-rate check is `npm run bot:lookout-ridge`)');
  else {
    assert.ok(smart.wins / N >= dumb.wins / N + MARGIN, `heroes who darn win clearly more often (${pct(smart.wins)} vs ${pct(dumb.wins)}, needs ${MARGIN * 100} points)`);
    console.log(`PASS heroes who darn beat heroes who don't (${pct(smart.wins)} vs ${pct(dumb.wins)})`);
  }
}
