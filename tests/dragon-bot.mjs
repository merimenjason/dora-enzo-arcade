// Dragon Playground bots, driving like people. The driver bot sees the race 200–300 ms late (it acts on where the dragon
// was that long ago), and it fumbles: some jumps go early or late, and it does not always remember to slide or roar.
// The rider is the game's own helper bot, as in solo play. Personas:
// - casual: holds right, jumps what is in the way, presses Down on slides some of the time, roars when the meter is full.
// - runner: holds right and jumps what is in the way. No slides, no roars.
// - idle: presses nothing.
// Thresholds, assist on (the default): casual wins race 1 at least 80% of the time and every race at least half the time;
// the runner wins race 1 at least half the time; idle never wins. `--quick` runs fewer seeds. Run after compiling the
// engine into .checks/ (npm test does).
import assert from 'node:assert/strict';
import { DragonGame, RACES, NO_DRIVE, STEP } from '../.checks/dragon-game.js';

const QUICK = process.argv.includes('--quick');
const SEEDS = QUICK ? 5 : 12;
const CAP = 4 * 60 * 60;
function rngOf(seed) { let a = seed >>> 0 || 1; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const PERSONAS = {
  casual: { slide: 0.75, roar: 0.8, early: 0.1, late: 0.08 },
  runner: { slide: 0, roar: 0, early: 0.12, late: 0.1 },
};

/** the next thing to jump: walls the dragon can't step, longkang gaps and see-saws, as [x, height, kind] */
function obstacles(c) {
  const out = [];
  for (const w of c.walls) if (w.h > STEP) out.push([w.x, w.h, 'wall']);
  for (const g of c.gaps) {
    // stepping stones and monkey bars make some gaps jumpable or grabbable; the bot jumps at the bank either way
    out.push([g.x0, 0, 'gap']);
    for (const t of c.tops) if (t.kind === 'stone' && t.x0 > g.x0 && t.x1 < g.x1) out.push([t.x1, 0, 'stone']);
  }
  return out.sort((a, b) => a[0] - b[0]);
}

export function play(race, seed, persona) {
  const g = new DragonGame({ race, seed, assist: true, power: null });
  if (persona === 'idle') { let f = 0; while (g.mode !== 'done' && f < CAP) { g.step(NO_DRIVE, null); f++; } return { won: g.place === 1, place: g.place, time: g.stats.time, g }; }
  const P = PERSONAS[persona], r = rngOf(seed * 977 + persona.length * 13 + race);
  const delay = Math.round((0.2 + r() * 0.1) * 60);
  const obs = obstacles(g.course), seen = [];
  let frame = 0, holdJ = 0, slideOn = new Map(), jumpPlan = new Map();
  while (g.mode !== 'done' && frame < CAP) {
    frame++;
    const d = g.dragon;
    // after a splash the dragon is back at a checkpoint: look again
    if (d.st === 'splash') { seen.length = 0; jumpPlan.clear(); holdJ = 0; }
    seen.push({ x: d.x, y: d.y, ground: d.ground, vy: d.vy, meter: d.meter, st: d.st });
    if (seen.length > delay) seen.shift();
    const v = seen[0];
    const inp = { mx: 1, down: false, jmp: false, jmpH: holdJ > 0, roar: false };
    if (holdJ > 0) holdJ--;
    // where the bot means to take off for the next obstacle, wobbled by a fumble now and then
    const next = obs.find(([ox, h]) => ox > v.x - 20 && !(h > 0 && v.y >= h - STEP));
    if (next && v.ground) {
      const [ox, h, kind] = next;
      const key = ox + ':' + kind;
      if (!jumpPlan.has(key)) {
        const u = r(); const lead = h > 120 ? 150 : kind === 'gap' ? 110 : 120;
        jumpPlan.set(key, lead + (u < P.early ? 120 : u < P.early + P.late ? -60 : (r() - 0.5) * 40));
      }
      const dist = ox - v.x;
      // the bot reacts to the old picture, so it judges distance from where the dragon was, plus how far it has gone since
      if (dist < jumpPlan.get(key) + delay / 60 * 360 && dist > -30) { inp.jmp = true; holdJ = h > 120 || kind === 'gap' ? 16 : 6; jumpPlan.set(key, -1e9); }
    }
    // slides: press Down on the chute (decided once per slide)
    const sl = g.course.slides.find((s) => v.x > s.x0 - 10 && v.x < s.x1);
    if (sl) { if (!slideOn.has(sl.x0)) slideOn.set(sl.x0, r() < P.slide); if (slideOn.get(sl.x0)) inp.down = true; }
    if (v.meter >= 5 && r() < P.roar / 30) inp.roar = true;
    g.step(inp, null);
  }
  return { won: g.place === 1, place: g.place, time: g.stats.time, g };
}

function run() {
  const rows = [];
  for (let race = 0; race < RACES.length; race++) {
    for (const persona of ['casual', 'runner', 'idle']) {
      let wins = 0, places = [], times = [], falls = 0;
      for (let s = 1; s <= SEEDS; s++) { const o = play(race, s, persona); if (o.won) wins++; places.push(o.place); times.push(o.time); falls += o.g.stats.falls; }
      rows.push({ race, persona, wins, rate: wins / SEEDS, avgPlace: places.reduce((a, b) => a + b, 0) / SEEDS, avgTime: Math.round(times.reduce((a, b) => a + b, 0) / SEEDS), falls: falls / SEEDS });
    }
  }
  for (const r of rows) console.log(`race ${r.race + 1} ${r.persona.padEnd(7)} wins ${r.wins}/${SEEDS}  place ${r.avgPlace.toFixed(1)}  time ${r.avgTime}s  falls ${r.falls.toFixed(1)}`);
  const get = (race, p) => rows.find((r) => r.race === race && r.persona === p);
  assert.ok(get(0, 'casual').rate >= 0.8, 'casual wins race 1 at least 80% of the time');
  assert.ok(get(0, 'runner').rate >= 0.5, 'runner wins race 1 at least half the time');
  for (let race = 0; race < RACES.length; race++) {
    assert.equal(get(race, 'idle').wins, 0, `idle never wins race ${race + 1}`);
    if (!process.argv.includes('--first')) assert.ok(get(race, 'casual').rate >= 0.5, `casual wins race ${race + 1} at least half the time`);
  }
  console.log('dragon bots ok');
}
if (import.meta.url === `file://${process.argv[1]}`) run();
