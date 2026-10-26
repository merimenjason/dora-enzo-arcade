/** Distance from a point to a lane segment. */
export function laneGap(p, a, b) { const x = b.x - a.x, z = b.z - a.z, d = x * x + z * z, t = d ? Math.max(0, Math.min(1, ((p.x - a.x) * x + (p.z - a.z) * z) / d)) : 0; return Math.hypot(p.x - a.x - x * t, p.z - a.z - z * t); }
/** Browser and Node bots share this input policy. It uses no teleports, stat changes or direct bonks. */
export function huntPolicy(g) {
  const b = g.beast, h = g.hero;
  const out = { x: 0, z: 0, sprint: true, bonk: false, charge: false, roll: false, lock: false, previous: false, next: false, use: false, grab: false, sling: false };
  if (!b || g.mode !== 'hunt') return out;
  // The beast went down a path to the next zone: follow it.
  if (b.away) { const e = g.exitTo(b.zone), d = Math.hypot(e.x - h.x, e.z - h.z); out.x = (e.x - h.x) / d; out.z = (e.z - h.z) / d; return out; }
  if (g.ride.riding) { out.charge = true; out.bonk = Math.floor(g.time * 16) % 2 === 0; return out; }
  // Holding on with the vine: two tickles, then yank towards the nearest tree or rock within the yank, if any.
  if (g.vine) {
    if (g.vine.phase === 'cling') {
      if (g.vine.pokes < 2) { out.bonk = Math.floor(g.time * 10) % 2 === 0; return out; }
      const wall = g.obstacles.map((o) => ({ o, d: Math.hypot(o.x - b.x, o.z - b.z) })).filter((w) => w.d < 6.5).sort((a, c) => a.d - c.d)[0];
      if (wall) { out.x = (wall.o.x - b.x) / wall.d; out.z = (wall.o.z - b.z) / wall.d; }
      out.charge = Math.floor(g.time * 10) % 2 === 0; return out;
    }
    return out;
  }
  // Pebbles bring a flying Skreel down.
  if (b.id === 'skreel' && b.height > 1.5 && g.pebbles > 0 && g.locked && Math.hypot(h.x - b.x, h.z - b.z) < 13) out.sling = Math.floor(g.time * 4) % 2 === 0;
  if (g.vineCd <= 0 && g.quest?.id !== 'no-vine-puffwart' && ['rest', 'roam'].includes(b.state) && b.height < 0.5 && Math.hypot(h.x - b.x, h.z - b.z) < 8) { out.grab = true; return out; }
  if (g.ride.used < 2 && ['dizzy', 'stuck'].includes(b.state)) {
    if (g.weapon() === 'yoyo' && Math.hypot(h.x - b.x, h.z - b.z) < 4) { out.charge = g.time % 0.4 < 0.12; return out; }
    // A High Bounce that lands right beside a dizzy beast hops on.
    if (g.weapon() === 'pogo' && b.state === 'dizzy') { const d = Math.hypot(h.x - b.x, h.z - b.z); if (d < 2.4) { out.charge = g.bounce <= 0 && g.time % 0.8 < 0.45; return out; } out.x = (b.x - h.x) / d; out.z = (b.z - h.z) / d; return out; }
    for (const rock of g.obstacles.filter((o) => o.kind === 'rock')) {
      const x = h.x - rock.x, z = h.z - rock.z; if (g.rockHop(x, z) && h.rollCd <= 0) { const n = Math.hypot(x, z); out.x = x / n; out.z = z / n; out.roll = true; return out; }
    }
  }
  const d = Math.hypot(h.x - b.x, h.z - b.z), melee = !g.ranged();
  const desired = melee ? 2.7 : 7;
  let tx = b.x, tz = b.z;
  if (b.id === 'hornclack') { tx -= Math.cos(b.face) * desired; tz += Math.sin(b.face) * desired; }
  else { const a = Math.atan2(h.z - b.z, h.x - b.x); tx += Math.cos(a) * desired; tz += Math.sin(a) * desired; }
  let dx = tx - h.x, dz = tz - h.z;
  if (b.state === 'windup' || ['charge', 'swoop', 'pounce', 'hop', 'tongue', 'shake', 'sweep', 'roar', 'rain', 'fan', 'spin', 'burrow'].includes(b.state)) {
    if (b.attack === 'rain' || b.attack === 'fan' || b.attack === 'burrow') {
      // Mighty rain circles, Rumblesnout's burrow circle and fans of lanes: step to the nearby spot with the most room from every circle or lane.
      const room = (x, z) => b.attack !== 'fan' ? Math.min(...b.marks.map((m) => Math.hypot(x - m.x, z - m.z) - (b.attack === 'burrow' ? 2.4 : 2.2))) : Math.min(...g.fanLanes().map((l) => laneGap({ x, z }, l.start, l.end) - 1.1));
      if (room(h.x, h.z) < 1.2) {
        let best = null;
        for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2, x = h.x + Math.cos(a) * 2.6, z = h.z + Math.sin(a) * 2.6; if (Math.hypot(x, z) > 17 || g.obstacles.some((o) => Math.hypot(x - o.x, z - o.z) < o.r + 0.6)) continue; const r = room(x, z); if (!best || r > best.r) best = { r, x: x - h.x, z: z - h.z }; }
        if (best) { dx = best.x; dz = best.z; }
      }
    } else if (['shake', 'sweep', 'cloud', 'roar', 'spin'].includes(b.attack)) {
      if (d < (b.attack === 'roar' ? 7.6 : b.attack === 'spin' ? 7.4 : 6.3)) { dx = h.x - b.x; dz = h.z - b.z; }
    } else {
      // Escape sideways, choosing the side already closer to the hero.
      const px = -b.dir.z, pz = b.dir.x, side = (h.x - b.start.x) * px + (h.z - b.start.z) * pz >= 0 ? 1 : -1;
      const signed = Math.abs((h.x - b.start.x) * px + (h.z - b.start.z) * pz);
      if (signed < 4) { dx = px * side; dz = pz * side; }
    }
    out.roll = b.state === 'windup' && b.t > 0.64 && h.rollCd <= 0 && b.attack !== 'rain' && b.attack !== 'fan' && b.attack !== 'burrow';
  }
  // Two beasts squaring off: leave the circle round the pair before the turf bonk.
  if (b.state === 'turf' && g.visitor) { const mx = (b.x + g.visitor.x) / 2, mz = (b.z + g.visitor.z) / 2; if (Math.hypot(h.x - mx, h.z - mz) < 5.6) { dx = h.x - mx; dz = h.z - mz; } }
  // Slide around rocks instead of repeatedly pushing into one.
  for (const o of g.obstacles) {
    const n = Math.hypot(dx, dz) || 1;
    const nx = h.x + dx / n * 1.3, nz = h.z + dz / n * 1.3;
    if (Math.hypot(nx - o.x, nz - o.z) < o.r + 0.65) { const ox = h.x - o.x, oz = h.z - o.z; dx = -oz; dz = ox; }
  }
  const len = Math.hypot(dx, dz); if (len > 0.25) { out.x = dx / len; out.z = dz / len; }
  if (melee && d < 3.6 && ['rest', 'dizzy', 'roam'].includes(b.state)) out.charge = g.time % 1.7 < 0.6;
  out.bonk = (!melee || d < 3.6) && !out.charge;
  // Eat a fluffberry from the ring when Fluff is low.
  const berry = g.profile.ring.indexOf('fluffberry'), want = h.fluff < 65 && berry >= 0 && g.profile.pouch.fluffberry > 0 ? berry : -1;
  if (want >= 0) { if (g.item !== want) out.next = Math.floor(g.time * 10) % 2 === 0; else out.use = Math.floor(g.time * 10) % 2 === 0; }
  return out;
}
