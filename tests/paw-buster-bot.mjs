// A bot that checks Paw Buster X can be played through, using the real engine.
//
// Routes: for every sector it searches the places a hero can stand, trying runs, jumps, dash jumps,
// wall climbs, air dashes and waterfall floats from each one. It checks the boss door or teleporter
// can be reached without any upgrades, and, with every weapon and part, that every item can be reached.
// Bosses: it fights each one in the boss gallery with a simple keep-your-distance, charge-and-release
// policy (health topped up, so the fight always finishes) and checks each can be beaten with the buster.
// It prints the fastest route it found and each fight's length, which the medal targets are based on.
import assert from 'node:assert/strict';
import { PawBusterGame, STAGES, MAVERICKS, partsOf, freshProgress, weaponsFor, CHARGE, TARGETS, NO_INPUT, T } from '../.checks/paw-buster-game.js';

const DT = 1 / 120;
const bare = freshProgress();
// Every weapon and the two parts that are out in the open, so the three hidden capsules are still there to find.
const everything = { ...freshProgress(), cleared: [...MAVERICKS], parts: ['boots', 'saber'] };
const input = (o) => ({ ...NO_INPUT, ...o });

/** Move sets tried from every standing spot, for each direction. Each returns the buttons at time t, or null when done. */
function macros(d, boots, float) {
  const side = d > 0 ? { right: true } : { left: true };
  const list = [
    { name: 'step', fn: (t) => (t < 0.2 ? input(side) : null) },
    { name: 'walk', fn: (t) => (t < 0.6 ? input(side) : null) },
    { name: 'jump', fn: (t) => (t < 0.75 ? input({ ...side, jump: true }) : null) },
    { name: 'hop', fn: (t) => (t < 0.5 ? input({ ...side, jump: t < 0.1 }) : null) },
    { name: 'drift', fn: (t) => (t < 0.8 ? input({ jump: true, ...(t > 0.22 ? side : {}) }) : null) },
    { name: 'dash jump', fn: (t) => (t < 0.9 ? input({ ...side, dash: true, jump: t > 2 * DT }) : null) },
    { name: 'climb', fn: (t, p, last) => (t < 2.6 ? input({ ...side, jump: !last.jump && (p.ground || p.slide !== 0 || p.vy > -40) }) : null) },
  ];
  if (boots) {
    list.push({ name: 'air dash', fn: (t) => (t < 0.8 ? input({ ...side, jump: true, dash: t > 0.25 && t < 0.55 }) : null) });
    list.push({ name: 'dash jump + air dash', fn: (t) => (t < 1 ? input({ ...side, jump: t > 2 * DT, dash: t < 0.3 || (t > 0.45 && t < 0.75) }) : null) });
  }
  if (float) for (const up of [0.8, 1.6, 2.4]) list.push({ name: `float ${up}`, fn: (t) => (t < up + 0.6 ? input({ jump: true, ...(t > up ? side : {}) }) : null) });
  return list;
}

/** Search one sector. Returns the fastest time to its goal (or null) and which items could be picked up. */
function explore(stage, part, progress) {
  const fresh = () => {
    const g = new PawBusterGame(stage, progress);
    if (part) g.enterPart(part);
    g.enemies = [];
    g.state = 'play';
    // The bot never fires, so a wall one of its weapons would open counts as already open.
    const weapons = weaponsFor(progress);
    for (let i = 0; i < g.tiles.length; i++) {
      const t = g.tiles[i];
      if ((t === T.crystal && weapons.includes('quartz')) || (t === T.door && weapons.includes('volt'))) g.tiles[i] = T.air;
    }
    return g;
  };
  let g = fresh();
  const snap = { tiles: g.tiles.slice(), items: g.items, progress: structuredClone(g.progress), checkpoint: g.checkpoint, max: g.max, body: structuredClone(g.player) };
  const boots = progress.parts.includes('boots'), bubble = progress.cleared.includes('lake');
  const float = bubble && g.map.falls.length > 0;
  const waits = g.map.platforms.length ? [0, 0.7, 1.4, 2.1] : [0];
  const got = new Set();
  let goal = null;
  const start = { x: g.player.x, y: g.player.y, clock: 0, t: 0 };
  const seen = new Set([key(start)]), open = [start];
  function key(n) { return `${Math.floor((n.x + 10) / 15)}:${Math.round(n.y / 6)}`; }
  function reset(n, weapon) {
    g.tiles.set(snap.tiles);
    g.tilesRev++;
    g.items = structuredClone(snap.items);
    g.progress = structuredClone(snap.progress);
    Object.assign(g, { max: snap.max, checkpoint: snap.checkpoint, shots: [], effects: [], enemies: [], boss: null, fight: false, state: 'play', freeze: 0, wind: 0, clock: n.clock });
    g.events.length = 0;
    g.hp = { dora: 999, enzo: 999 };
    Object.assign(g.player, structuredClone(snap.body), { x: n.x, y: n.y, invT: 1e9, ground: true, safe: { x: n.x, y: n.y } });
    g.weapon = Math.max(0, g.weapons.indexOf(weapon));
    g.step(DT, NO_INPUT);
  }
  let trials = 0;
  while (open.length) {
    // Expand the earliest spot first, so the first time a goal is reached is close to the fastest.
    let best = 0;
    for (let i = 1; i < open.length; i++) if (open[i].t < open[best].t) best = i;
    const n = open.splice(best, 1)[0];
    if (goal !== null && n.t > goal && progress === bare) break;
    for (const d of [1, -1]) for (const m of macros(d, boots, float)) for (const wait of waits) {
      reset(n, m.name.startsWith('float') ? 'bubble' : 'buster');
      trials++;
      const items = g.items;
      let t = 0, last = NO_INPUT, landed = false, fell = false, reached = false;
      for (; t < wait; t += DT) g.step(DT, NO_INPUT);
      for (let s = 0; ; s += DT) {
        const b = m.fn(s, g.player, last) ?? NO_INPUT;
        g.step(DT, b);
        last = b;
        t += DT;
        if (g.events.includes('fall')) { fell = true; break; }
        if (g.fight || g.part !== part) { reached = true; break; }
        if (!m.fn(s + DT, g.player, last) && g.player.ground && g.player.vy === 0) { landed = true; break; }
        if (s > 5) break;
      }
      snap.items.forEach((it, i) => { if (!g.items.includes(items[i])) got.add(i); });
      if (reached) {
        if (goal === null || n.t + t < goal) goal = n.t + t;
        g = fresh();
        continue;
      }
      if (fell || !landed) continue;
      const next = { x: g.player.x, y: g.player.y, clock: g.clock, t: n.t + t };
      const k = key(next);
      if (!seen.has(k)) { seen.add(k); open.push(next); }
    }
  }
  let far = 0;
  for (const k of seen) far = Math.max(far, Number(k.split(':')[0]) / 2);
  return { goal, got, items: snap.items, spots: seen.size, trials, far: Math.round(far), end: Math.round((g.map.arena > 0 ? g.map.arena : g.map.exit) / 1) };
}

const t0 = Date.now();
const rows = [];
for (const s of STAGES) {
  let route = 0;
  const missing = [];
  for (let part = 0; part < partsOf(s.id); part++) {
    const run = explore(s.id, part, bare);
    assert.ok(run.goal !== null, `${s.name} sector ${part + 1}: the bot found no way to the ${part === partsOf(s.id) - 1 ? 'boss door' : 'teleporter'} without upgrades — it got as far as column ${run.far} of ${run.end}, from ${run.spots} standing spots`);
    route += run.goal;
    const all = explore(s.id, part, everything);
    all.items.forEach((it, i) => { if (!all.got.has(i)) missing.push(`${it.kind} at column ${Math.floor(it.x / 30)} of sector ${part + 1}`); });
  }
  assert.deepEqual(missing, [], `${s.name}: items the bot couldn't reach`);
  rows.push({ id: s.id, route });
}

// Boss fights, one at a time in the gallery, with the buster only.
function fight(stage) {
  const g = new PawBusterGame(stage, { ...freshProgress(), cleared: [...MAVERICKS, 'citadel'] }, { gallery: true });
  let last = NO_INPUT, charge = 0;
  for (let i = 0; i < 120 * 240 && g.state !== 'clear'; i++) {
    g.hp.dora = g.hp.enzo = g.max;
    const p = g.player, b = g.boss;
    const o = {};
    if (b && g.state === 'play') {
      // Close in, and always turn to face the boss: shots fly the way the hero faces.
      const px = p.x + p.w / 2, bx = b.x + b.w / 2, dx = bx - px, toward = dx > 0 ? 'right' : 'left';
      const facing = (dx > 0) === (p.face > 0);
      if (!facing || Math.abs(dx) > 260) o[toward] = true;
      // Jump over anything coming in low, and over the boss when it gets close.
      const threat = g.shots.some((s) => !s.hero && Math.abs(s.x - px) < 110 && Math.abs(s.y - (p.y + p.h / 2)) < 50) || Math.abs(dx) < 80;
      o.jump = threat && !last.jump && p.ground ? true : last.jump && p.vy < 0;
      // Hold the charge until the boss is level with the shot, so a flier is hit on its way down.
      charge += DT;
      const aligned = facing && Math.abs(b.y + b.h / 2 - (p.y + 12)) < 70;
      o.fire = !(charge >= CHARGE.full + 0.05 && aligned);
      if (!o.fire) charge = -DT;
    }
    const inp = input(o);
    g.step(DT, inp);
    last = inp;
  }
  return { won: g.state === 'clear', time: g.time, damage: g.damage };
}
for (const r of rows) {
  const f = fight(r.id);
  assert.ok(f.won, `${r.id}: the bot could not beat the boss`);
  Object.assign(r, { boss: f.time, bossDamage: f.damage });
}

const fmt = (s) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;
console.log('Paw Buster X bot: every sector reachable without upgrades, every item reachable with them, every boss beaten with the buster.');
for (const r of rows) console.log(`  ${r.id.padEnd(8)} route ${fmt(r.route)} · boss ${fmt(r.boss)} (${r.bossDamage} damage untouched-health) · gold target ${fmt(TARGETS[r.id][0])}`);
for (const r of rows) assert.ok(TARGETS[r.id][0] > r.route + r.boss * 0.5, `${r.id}: the gold target should allow the route plus a quick boss fight`);
console.log(`  (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
