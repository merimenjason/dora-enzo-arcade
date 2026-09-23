// A bot that checks every Fluff Forge starter course can be cleared, with each hero, without dying.
//
// It runs a beam search over the real engine: every 0.1 s each kept run branches into a handful of
// button combinations, runs that die are dropped, runs that end up in the same place and state are
// merged, and the ones furthest along are kept. It prints the fastest clear it found for each course.
import assert from 'node:assert/strict';
import { FluffForgeGame, STARTERS, NO_INPUT, TILE } from '../.checks/fluff-forge-game.js';

const DT = 1 / 120, SEG = 12, WIDTH = Number(process.env.BEAM ?? 60);
const ACTIONS = [
  { right: true, run: true }, { right: true, run: true, jump: true }, { right: true }, { right: true, jump: true },
  {}, { jump: true }, { left: true }, { left: true, jump: true }, { left: true, run: true, jump: true },
].map((a) => ({ ...NO_INPUT, ...a }));

export function solve(course, hero, width = WIDTH) {
  let beam = [{ g: new FluffForgeGame(course, hero), best: 0 }];
  const limit = Math.ceil(course.time / (SEG * DT));
  for (let n = 0; n < limit && beam.length; n++) {
    const seen = new Map();
    for (const node of beam) {
      for (const a of ACTIONS) {
        const g = node.g.clone();
        for (let k = 0; k < SEG && g.state === 'play'; k++) g.step(DT, a);
        if (g.deaths || g.state === 'dying') continue;
        if (g.state === 'clear') return g.result;
        const h = g.hero;
        const key = [Math.round(h.x / 3), Math.round(h.y / 3), Math.round(h.vx / 25), Math.round(h.vy / 60), h.power, g.raisins > 0].join();
        const best = Math.max(node.best, h.x);
        const score = h.x * 2 + best - h.y * 0.2 + (h.power !== 'small' ? 40 : 0);
        const had = seen.get(key);
        if (!had || had.score < score) seen.set(key, { g, best, score });
      }
    }
    beam = [...seen.values()].sort((a, b) => b.score - a.score).slice(0, width);
  }
  const far = beam.length ? Math.max(...beam.map((b) => b.g.hero.x)) : 0;
  return { stuck: Math.floor(far / TILE) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const only = process.argv[2];
  for (const course of STARTERS.filter((s) => !only || s.id === only)) {
    for (const hero of ['dora', 'enzo']) {
      const started = Date.now();
      const r = solve(course, hero);
      assert.ok(r.time !== undefined, `${course.title} as ${hero}: the bot got stuck around column ${r.stuck}`);
      console.log(`${course.title} as ${hero}: cleared in ${r.time.toFixed(1)} s, ${r.raisins} raisins (searched in ${((Date.now() - started) / 1000).toFixed(1)} s)`);
    }
  }
  console.log('Every starter course can be cleared by both heroes without dying.');
}
