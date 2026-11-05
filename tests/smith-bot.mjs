// Pixel Smith bots. The smith patches Dora up to three quarters of her fur, then sketches a sword in the best paint
// left (gold, then ember, frost, moss and stone), and fights at arm's length: it goes for Moss Grumbles first, keeps
// the tip of the weapon on the nearest Grumble, swings when it's in reach and rolls away from ice, dashes and the
// Smudge's rub. The twig fighter uses the same fighting but spends nearly everything on fur and fights with a stub.
// The clumsy fighter draws like the smith but reacts a fifth of a second late and misses half its rolls, a stand-in
// for a person. The random player paints and moves at random. Runs should be winnable with a good weapon, much harder with a stub,
// and out of reach at random. Run after `npm test` has compiled the engine into .checks/ (or `npm run bot:smith`).
import assert from 'node:assert/strict';
import { Run, PAINTS, GRID, GRIP, CELL, local, tip } from '../.checks/smith-game.js';

const quick = process.argv.includes('--quick');
const RUNS = quick ? 12 : 40;
const LIMIT = 60 * 60 * 20;

function rngOf(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

const easel = {
  smith(r) {
    r.clearWeapon();
    const most = () => PAINTS.slice().sort((a, b) => r.paint[b] - r.paint[a])[0];
    // fur first when she's low, but keep enough paint for a proper weapon
    const total = () => PAINTS.reduce((a, c) => a + r.paint[c], 0);
    while (r.dora.fur < r.furMax * 0.75 && total() > 22 && r.patch(most()));
    r.sketch('sword', ['gold', 'red', 'blue', 'green', 'grey']);
  },
  twig(r) {
    r.clearWeapon();
    r.paintCell(GRIP - GRID + 1, 'gold'); r.paintCell(GRIP - 2 * GRID + 2, 'gold');
    const most = () => PAINTS.slice().sort((a, b) => r.paint[b] - r.paint[a])[0];
    while (r.patch(most()));
  },
  clumsy(r) { easel.smith(r); },
  random(r, rnd) {
    for (let k = 0; k < 60; k++) r.paintCell(Math.floor(rnd() * GRID * GRID), PAINTS[Math.floor(rnd() * 5)]);
    if (rnd() < 0.5) r.patch(PAINTS[Math.floor(rnd() * 5)]);
  },
};
const PICKS = ['polish', 'thick', 'light', 'pots', 'thumb', 'coals', 'snap', 'paws', 'patch', 'twirl'];

function sweet(r) {
  let sum = 0, w = 0;
  r.cells.forEach((c, i) => { if (c) { const k = tip(i); sum += local(i).a * k; w += k; } });
  return w ? (sum / w) * CELL + 5 : 8;
}
function fightInput(r) {
  const d = r.dora, reach = r.stat.reach;
  const live = r.foes.filter((f) => f.mode !== 'spawn');
  if (!live.length) return { mx: 0, my: 0, ax: d.x, ay: d.y - 20, swing: false, roll: false };
  const near = (f) => Math.hypot(f.x - d.x, f.y - d.y);
  const moss = live.find((f) => f.k === 'moss' && near(f) < 140);
  const t = moss ?? live.slice().sort((a, b) => near(a) - near(b))[0];
  // stand so the bulk of the weapon (weighted towards the tip, which hits hardest) lands on the Grumble
  const dist = near(t), want = sweet(r) + t.r - 2;
  let mx = 0, my = 0;
  const ux = (t.x - d.x) / (dist || 1), uy = (t.y - d.y) / (dist || 1);
  if (dist > want + 4) { mx = ux; my = uy; } else if (dist < want - 6) { mx = -ux; my = -uy; }
  // shy away from anyone else crowding in
  for (const f of live) if (f !== t && near(f) < 24) { mx -= (f.x - d.x) / near(f); my -= (f.y - d.y) / near(f); }
  let roll = false;
  for (const s of r.shots) {
    const sd = Math.hypot(s.x - d.x, s.y - d.y);
    if (sd < 34 && (s.vx * (d.x - s.x) + s.vy * (d.y - s.y)) > 0) { roll = true; mx = -s.vy; my = s.vx; }
  }
  for (const f of live) {
    if ((f.mode === 'dash' && near(f) < 50) || (f.k === 'smudge' && f.mode === 'wind' && near(f) < 70)) { roll = true; mx = d.x - f.x; my = d.y - f.y; }
  }
  return { mx, my, ax: t.x, ay: t.y - t.r * 0.6, swing: dist < reach + t.r + 2, roll };
}
function randomInput(r, rnd, st) {
  if (rnd() < 0.03) { st.mx = rnd() * 2 - 1; st.my = rnd() * 2 - 1; st.ax = rnd() * 384; st.ay = rnd() * 216; }
  return { mx: st.mx, my: st.my, ax: st.ax, ay: st.ay, swing: rnd() < 0.3, roll: rnd() < 0.01 };
}

function play(kind, seed) {
  const r = new Run(seed), rnd = rngOf(seed * 7 + 1), st = { mx: 0, my: 0, ax: 0, ay: 0 };
  let ticks = 0;
  while (!r.over && ticks < LIMIT) {
    if (r.phase === 'easel') { easel[kind](r, rnd); r.fight(); }
    else if (r.phase === 'pick') r.pick(kind === 'random' ? r.offer[0] : PICKS.find((p) => r.offer.includes(p)) ?? r.offer[0]);
    else {
      let inp = kind === 'random' ? randomInput(r, rnd, st) : fightInput(r);
      // the clumsy fighter sees everything a fifth of a second late and only rolls half the time it should
      if (kind === 'clumsy') { st.lag = st.lag || []; st.lag.push(inp); inp = st.lag.length > 12 ? st.lag.shift() : { mx: 0, my: 0, ax: r.dora.x, ay: r.dora.y, swing: false, roll: false }; if (inp.roll && rnd() < 0.5) inp = { ...inp, roll: false }; }
      r.tick(inp); ticks++;
    }
  }
  return { won: r.phase === 'won', rooms: r.stats.rooms, kills: r.stats.kills, mins: r.stats.time / 60, fur: r.dora.fur };
}

const out = {};
for (const kind of ['smith', 'clumsy', 'twig', 'random']) {
  const res = []; for (let i = 0; i < RUNS; i++) res.push(play(kind, 1000 + i * 37));
  const wins = res.filter((x) => x.won).length, rooms = res.reduce((a, x) => a + x.rooms, 0) / RUNS;
  const mins = res.filter((x) => x.won).reduce((a, x) => a + x.mins, 0) / Math.max(1, wins);
  out[kind] = { wins, rooms };
  console.log(`${kind.padEnd(7)} ${wins}/${RUNS} wins, ${rooms.toFixed(1)} rooms on average${wins ? `, ${mins.toFixed(1)} min a win` : ''}`);
}
if (quick) {
  assert.ok(out.smith.rooms >= 6, 'the smith should get through six rooms on average');
  assert.ok(out.clumsy.rooms >= 4, 'a slower player with a good weapon should still get a fair way');
  assert.ok(out.twig.rooms < out.smith.rooms - 1, 'a stub should do clearly worse than a sword');
  assert.ok(out.random.wins === 0 && out.random.rooms < out.smith.rooms - 3, 'random play should get nowhere much');
} else {
  assert.ok(out.smith.wins / RUNS >= 0.3, 'the smith should win at least 30% of runs');
}
console.log('Pixel Smith bots passed');
