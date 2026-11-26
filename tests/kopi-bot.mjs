// Kopi Peng Brawl bots, playing like people. The player-side bot sees the game 200–300 ms late (a snapshot from that
// long ago), presses a button a few times a second at most and fumbles some presses; the partner hero is the game's own
// helper bot, as in solo play. Two of them:
// - masher: walks at the nearest foe and mashes Attack, jumps now and then. Never grabs, never uses food on purpose.
// - casual: mashes too, but picks up food when hurt, steps out of a foe's wind-up some of the time, uses the special
//   when the meter is full and throws stunned foes.
// Each runs every stage over seeds with assist on (the default). A clear within the time cap counts; retries (both
// heroes down, the scene restarts) are counted. Thresholds, assist on: the casual bot clears every stage at least 80% of
// the time, and stage 1 with at most one retry on average; the masher clears stage 1 at least 70% of the time.
// `--quick` runs fewer seeds. Run after compiling the engine into .checks/ (npm test does).
import assert from 'node:assert/strict';
import { KopiGame, STAGES, NO_INPUT, ITEMS } from '../.checks/kopi-game.js';

const QUICK = process.argv.includes('--quick');
const SEEDS = QUICK ? 4 : 10;
const CAP = 15 * 60 * 60;
function rngOf(seed) { let a = seed >>> 0 || 1; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const PERSONAS = {
  masher: { rate: 6, miss: 0.12, dodge: 0, food: 0, special: 0, grab: 0, jump: 0.08 },
  casual: { rate: 5, miss: 0.1, dodge: 0.4, food: 0.7, special: 0.6, grab: 0.4, jump: 0.05 },
};

function play(stage, seed, persona) {
  const P = PERSONAS[persona], r = rngOf(seed * 977 + persona.length);
  const g = new KopiGame({ stage, seed, assist: true, skipTalk: true });
  const delay = Math.round((0.2 + r() * 0.1) * 60);
  const seen = []; let frame = 0, nextPress = 0;
  while (g.mode !== 'clear' && frame < CAP) {
    frame++;
    if (g.mode === 'down') { g.retry(); seen.length = 0; continue; }
    const me = g.hero('dora');
    seen.push({
      me: { x: me.x, z: me.z, hp: me.hp, maxHp: me.maxHp, meter: me.meter, st: me.st, carry: !!me.carry },
      foes: g.liveFoes().map((f) => ({ x: f.x, z: f.z, h: f.h, st: f.st })),
      food: g.items.filter((i) => !i.gone && !i.held && ITEMS[i.kind].cls === 'food').map((i) => ({ x: i.x, z: i.z })),
      boss: g.boss && !g.boss.dead ? { x: g.boss.x, z: g.boss.z, h: g.boss.h ?? 0, st: g.boss.st } : null,
      go: g.go > 0, lockX: g.lockX, camX: g.camX,
    });
    if (seen.length > delay) seen.shift();
    const v = seen[0];
    const inp = { ...NO_INPUT };
    const targets = v.boss ? [...v.foes, v.boss] : v.foes;
    let goal = null, press = frame >= nextPress && r() > P.miss;
    if (v.me.hp < v.me.maxHp * 0.45 && v.food.length && r() < P.food) goal = v.food.reduce((a, b) => (Math.abs(a.x - v.me.x) < Math.abs(b.x - v.me.x) ? a : b));
    const near = targets.length ? targets.reduce((a, b) => (Math.hypot(a.x - v.me.x, a.z - v.me.z) < Math.hypot(b.x - v.me.x, b.z - v.me.z) ? a : b)) : null;
    if (!goal && near) {
      if (near.st === 'wind' && Math.abs(near.x - v.me.x) < 140 && r() < P.dodge) goal = { x: v.me.x, z: near.z + (near.z > 110 ? -90 : 90) };
      else goal = { x: near.x - Math.sign(near.x - v.me.x || 1) * 70, z: near.z };
    }
    if (!goal) goal = { x: v.camX + 1200, z: v.me.z };
    const dx = goal.x - v.me.x, dz = goal.z - v.me.z;
    inp.mx = Math.abs(dx) > 14 ? Math.sign(dx) : 0; inp.mz = Math.abs(dz) > 8 ? Math.sign(dz) : 0;
    if (near && Math.abs(near.x - v.me.x) < 120 && Math.abs(near.z - v.me.z) < 26) {
      inp.mx = Math.sign(near.x - v.me.x) * (Math.abs(near.x - v.me.x) > 60 ? 1 : 0.01);
      if (press) {
        nextPress = frame + Math.round(60 / P.rate);
        if (v.me.meter >= 100 && r() < P.special * 0.3) { inp.atk = true; inp.jmp = true; }
        else if (v.me.carry) inp.atk = true;
        else if (near.st === 'stun' && r() < P.grab) inp.grab = true;
        else if (r() < P.jump) inp.jmp = true;
        else inp.atk = true;
      }
    } else if (near && near.h > 80 && Math.abs(near.x - v.me.x) < 100 && press) { inp.jmp = true; nextPress = frame + 20; }
    inp.atkH = inp.atk; inp.jmpH = inp.jmp;
    g.step({ dora: inp });
  }
  return { clear: g.mode === 'clear', retries: g.stats.retries, time: g.stats.time };
}

const want = { masher: { 0: 0.7 }, casual: Object.fromEntries(STAGES.map((_, i) => [i, 0.8])) };
let fail = 0;
for (const persona of Object.keys(PERSONAS)) {
  for (let si = 0; si < STAGES.length; si++) {
    let clears = 0, retries = 0, time = 0;
    for (let s = 1; s <= SEEDS; s++) { const o = play(si, s, persona); clears += o.clear; retries += o.retries; time += o.time; }
    const rate = clears / SEEDS, line = `${persona.padEnd(7)} stage ${si + 1}: ${clears}/${SEEDS} clears, ${(retries / SEEDS).toFixed(1)} retries, ${(time / SEEDS / 60).toFixed(1)} min`;
    const need = want[persona][si];
    const bad = (need !== undefined && rate < need) || (persona === 'casual' && si === 0 && retries / SEEDS > 1);
    console.log(`${bad ? 'FAIL' : '  ok'} ${line}`); if (bad) fail++;
  }
}
assert.equal(fail, 0, `${fail} bot thresholds missed`);
