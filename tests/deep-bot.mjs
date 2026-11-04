// Deepglow bots. A careful diver plans each dive like a player with a map: it heads for the nearest specimen it can
// reach (new species first) within its hull's depth rating, switches the lamp off to creep up on shy ones, pings the
// sonar, goes for air at an air bell or the surface when the tank says so, and comes up when the tray is full. Between
// dives it banks the tray and buys upgrades, the pressure hull first. The game must be finishable (the whale reached
// and the whole journal filled) in a fair number of dives, never in very few, and no dive may stall, whichever way the
// research is spent. `--quick` runs the hull-first campaign only.
import assert from 'node:assert/strict';
import { makeWorld, Dive, DT, CELL, SPECIES, spec, newSave, bank, buy, upgradeCost, stats, journalCount, unpackMap, pathTo, UPGRADES } from '../.checks/deep-game.js';

const quick = process.argv.includes('--quick');
const world = makeWorld();
const MAX_DIVE = 60 * 60 * 12;
// two ways to spend: the hull first, or comfort first (air, tray, speed) with the hull when it can be afforded
const ORDERS = { 'hull-first': ['hull', 'tank', 'tray', 'motor', 'sonar', 'lamp'], 'comfort-first': ['tank', 'tray', 'motor', 'hull', 'sonar', 'lamp'] };

/** One diver's input for this tick, replanning the route every half second. */
function diver(d, mem) {
  const W = world.w, st = d.st, sp = Math.max(3, st.motor * 4.2);
  if (!mem.path || d.t >= mem.next) {
    mem.next = d.t + 0.5;
    const toAir = d.wayToAir();
    const airNeed = toAir ? (toAir.length * CELL) / sp * 1.35 + 12 : 30;
    const full = d.tray.length >= st.tray;
    let goal = null, why = 'hunt';
    if (!mem.whaleDone && st.rating >= 1100 && d.tray.length >= Math.min(st.tray, 3)) { why = 'whale'; goal = (cx, cy) => Math.hypot(cx * CELL - world.whale.x, cy * CELL - world.whale.y) < world.whale.r * 0.6; }
    if (d.air < airNeed) { why = 'air'; mem.path = toAir; mem.why = why; mem.target = null; return steer(d, mem); }
    if (full && why !== 'whale') { why = 'home'; goal = (cx, cy) => cy <= 1; }
    if (!goal) {
      // the nearest specimen in reach: new species, or any species the journal has fewer than three of
      const want = new Map(), spare = new Map();
      for (const c of d.creatures) {
        if (c.caught || c.kind === 'grimlure' || c.kind === 'veil') continue;
        const have = (mem.journal[c.kind] ?? 0) + d.tray.filter((k) => k === c.kind).length;
        if (c.y > st.rating - 15) continue;
        (have >= 3 ? spare : want).set(Math.floor(c.y / CELL) * W + Math.floor(c.x / CELL), c);
      }
      // with three of everything in reach, any specimen is still research
      if (!want.size) for (const [k, c] of spare) want.set(k, c);
      if (!want.size) { why = 'home'; goal = (cx, cy) => cy <= 1; }
      else goal = (cx, cy) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (want.has((cy + dy) * W + cx + dx)) return true; return false; };
      mem.want = want;
    }
    mem.why = why; mem.path = pathTo(world, d.x, d.y, goal, 1e6);
    if (why === 'hunt' && mem.path && mem.path.length) {
      const end = mem.path[mem.path.length - 1]; let best = null, bd = 1e9;
      for (const c of mem.want.values()) { const dd = Math.hypot(c.x - end.x, c.y - end.y); if (dd < bd) { bd = dd; best = c; } }
      mem.target = best;
    } else mem.target = null;
    // stuck with nowhere to go: head up
    if (!mem.path) { mem.why = 'home'; mem.path = pathTo(world, d.x, d.y, (cx, cy) => cy <= 1, 1e6); }
  }
  return steer(d, mem);
}
function steer(d, mem) {
  const inp = { x: 0, y: 0, ping: false, lamp: false };
  if (d.pingCd <= 0 && (d.t | 0) % 3 === 0) inp.ping = true;
  let tx, ty;
  const tg = mem.target && !mem.target.caught ? mem.target : null;
  const path = mem.path ?? [];
  // drop the waypoints already passed
  while (path.length > 1 && Math.hypot(path[0].x - d.x, path[0].y - d.y) < 2.5) path.shift();
  if (tg && Math.hypot(tg.x - d.x, tg.y - d.y) < 9 && d.sees(d.x, d.y, tg.x, tg.y)) { tx = tg.x; ty = tg.y; }
  else if (path.length) { const p = path[Math.min(path.length - 1, 3)]; tx = p.x; ty = p.y; }
  else { tx = d.x; ty = d.y - 5; }
  const dx = tx - d.x, dy = ty - d.y, L = Math.hypot(dx, dy) || 1;
  // ease in on a specimen so it can be scooped up gently
  const near = tg && Math.hypot(tg.x - d.x, tg.y - d.y) < 8;
  const want = near ? Math.min(2.4, Math.hypot(tg.x - d.x, tg.y - d.y)) : 9;
  let ax = (dx / L) * want, ay = (dy / L) * want;
  // keep clear of stinging veils, and of a Grimlure on the hunt: go dark (no pings, lamp off) and give it room
  let hunted = false;
  for (const c of d.creatures) {
    if (c.kind !== 'veil' && c.kind !== 'grimlure') continue;
    const ex = d.x - c.x, ey = d.y - c.y, e = Math.hypot(ex, ey) || 1;
    if (c.kind === 'veil' && e < 5) { ax += (ex / e) * (5 - e) * 2.2; ay += (ey / e) * (5 - e) * 2.2; }
    if (c.kind === 'grimlure' && c.state !== 'home' && e < d.st.sonar * 1.6) { hunted = true; if (c.state === 'hunt' && e < 10) { ax += (ex / e) * 6; ay += (ey / e) * 6; } }
  }
  if (hunted) { inp.ping = false; if (d.lamp) inp.lamp = (d.t * 60 | 0) % 2 === 0; }
  const vx = ax - d.vx, vy = ay - d.vy, vl = Math.hypot(vx, vy) || 1;
  inp.x = vx / Math.max(1, vl); inp.y = vy / Math.max(1, vl);
  // the lamp off near a shy one
  const shy = tg && spec(tg.kind).shy && Math.hypot(tg.x - d.x, tg.y - d.y) < 18;
  if (!hunted && d.lamp === !!shy) inp.lamp = (d.t * 60 | 0) % 2 === 0;
  return inp;
}

function campaign(seed, policy) {
  const ORDER = ORDERS[policy];
  const s = newSave(); let dives = 0, minutes = 0, whaleAt = 0, journalAt = 0, stalls = 0, rescues = 0;
  const log = [];
  while (dives < 40 && !(s.whale && journalCount(s) === SPECIES.length && SPECIES.every((x) => (s.journal[x.id] ?? 0) >= 1))) {
    const d = new Dive({ world, levels: s.levels, seed: seed * 1000 + dives, known: Object.keys(s.journal), mapped: unpackMap(s.map) });
    const mem = { journal: { ...s.journal }, next: 0, path: null, whaleDone: s.whale };
    let n = 0, lastX = d.x, lastY = d.y, still = 0;
    while (!d.over && n < MAX_DIVE) {
      d.tick(diver(d, mem)); n++;
      if (process.env.DBG) for (const e of d.events) if (['bite', 'sting', 'bump', 'creak'].includes(e.k) && (e.k !== 'bump' || e.mag > 0)) { mem.hurt = mem.hurt ?? {}; mem.hurt[e.k] = (mem.hurt[e.k] ?? 0) + 1; }
      if (n % 600 === 0) { if (Math.hypot(d.x - lastX, d.y - lastY) < 2) still++; else still = 0; lastX = d.x; lastY = d.y; if (still >= 3) { stalls++; break; } }
    }
    if (process.env.DBG && d.why === 'hull') { console.log('hull loss', JSON.stringify(mem.hurt), 'at', d.x.toFixed(0), d.y.toFixed(0), 'why', mem.why); }
    if (!d.over) d.end('air');
    if (d.why === 'air' || d.why === 'hull') rescues++;
    const { earned } = bank(s, d); dives++; minutes += n * DT / 60;
    for (let k = 0; k < 8; k++) for (const id of ORDER) { const c = upgradeCost(s, id), hc = upgradeCost(s, 'hull'); if (c !== null && s.points >= c && (policy === 'comfort-first' || id === 'hull' || s.levels.hull >= Math.min(3, s.levels[id] + 1) || hc === null || s.points - c >= hc)) buy(s, id); }
    log.push(`${d.why[0]}${Math.round(d.deepest)}m+${earned}`);
    if (s.whale && !whaleAt) whaleAt = dives;
    if (journalCount(s) === SPECIES.length && !journalAt) journalAt = dives;
  }
  return { s, dives, minutes, whaleAt, journalAt, stalls, rescues, log };
}

const policies = quick ? ['hull-first'] : ['hull-first', 'comfort-first'];
for (const policy of policies) {
  const r = campaign(1, policy);
  console.log(`${policy}: whale on dive ${r.whaleAt || '-'}, journal full on dive ${r.journalAt || '-'}, ${r.dives} dives, ${r.minutes.toFixed(0)} min, ${r.rescues} rescues, ${r.stalls} stalls, levels ${JSON.stringify(r.s.levels)}`);
  console.log('   ' + r.log.join(' '));
  assert.ok(r.whaleAt > 0 && r.journalAt > 0, 'the bot finishes the game');
  assert.ok(r.whaleAt >= 6 && r.whaleAt <= 24, `the whale on dive ${r.whaleAt}: not too quick, not a grind`);
  assert.ok(r.minutes >= 25 && r.minutes <= 150, `${r.minutes.toFixed(0)} minutes of diving`);
  assert.ok(r.stalls <= 1, 'dives do not stall');
}
console.log('deep-bot: all good');
void stats; void UPGRADES;
