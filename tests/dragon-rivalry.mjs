// Dragon Playground rivalry: a race against the otters only feels like a race if the otters are on screen. Plays every
// race with the casual bot from tests/dragon-bot.mjs and measures how much of the race at least one otter is in view
// (from 400 px behind the dragon's head to 930 px ahead, the camera's window) and how often the lead changes hands.
// Run after compiling the engine into .checks/.
import assert from 'node:assert/strict';
import { DragonGame, RACES } from '../.checks/dragon-game.js';
import { play } from './dragon-bot.mjs';

const SEEDS = process.argv.includes('--quick') ? 4 : 8;
export function rivalry(race, seed, persona = 'casual') {
  const step = DragonGame.prototype.step; let frames = 0, seen = 0, swaps = 0, lastP = 0;
  DragonGame.prototype.step = function (a, b) {
    const r = step.call(this, a, b);
    if (this.mode === 'race' && this.dragon.finished === null && this.dragon.st !== 'splash') {
      frames++; const x = this.dragon.x;
      if (this.otters.some((o) => { const ox = this.otterX(o); return ox > x - 400 && ox < x + 930; })) seen++;
      const p = this.standing(); if (lastP && (p === 1) !== (lastP === 1)) swaps++; lastP = p;
    }
    return r;
  };
  try { const o = play(race, seed, persona); return { ...o, view: seen / Math.max(1, frames), swaps }; } finally { DragonGame.prototype.step = step; }
}
if (import.meta.url === `file://${process.argv[1]}`) {
  for (let race = 0; race < RACES.length; race++) {
    let view = 0, swaps = 0, wins = 0;
    for (let s = 1; s <= SEEDS; s++) { const o = rivalry(race, s); view += o.view; swaps += o.swaps; if (o.won) wins++; }
    view /= SEEDS; swaps /= SEEDS;
    console.log(`race ${race + 1}: otters in view ${(view * 100).toFixed(0)}% of the race, lead changes ${swaps.toFixed(1)}, casual wins ${wins}/${SEEDS}`);
    if (process.argv.includes('--assert')) {
      assert.ok(view >= 0.6, `race ${race + 1}: an otter is in view at least 60% of the race`);
      assert.ok(swaps >= 2, `race ${race + 1}: the lead changes hands at least twice`);
    }
  }
  console.log('dragon rivalry measured');
}
