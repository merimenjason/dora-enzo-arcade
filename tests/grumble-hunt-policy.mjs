/** Browser and Node bots share this input policy. It uses no teleports, stat changes or direct bonks. */
export function huntPolicy(g) {
  const b = g.beast, h = g.hero;
  const out = { x: 0, z: 0, sprint: true, bonk: false, charge: false, roll: false, lock: false, previous: false, next: false, use: false };
  if (!b || g.mode !== 'hunt') return out;
  if (g.ride.riding) { out.charge = true; out.bonk = Math.floor(g.time * 16) % 2 === 0; return out; }
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
  if (b.state === 'windup' || ['charge', 'swoop', 'pounce', 'hop', 'tongue', 'shake', 'sweep', 'roar'].includes(b.state)) {
    if (['shake', 'sweep', 'cloud', 'roar'].includes(b.attack)) {
      if (d < (b.attack === 'roar' ? 7.6 : 6.3)) { dx = h.x - b.x; dz = h.z - b.z; }
    } else {
      // Escape sideways, choosing the side already closer to the hero.
      const px = -b.dir.z, pz = b.dir.x, side = (h.x - b.start.x) * px + (h.z - b.start.z) * pz >= 0 ? 1 : -1;
      const signed = Math.abs((h.x - b.start.x) * px + (h.z - b.start.z) * pz);
      if (signed < 4) { dx = px * side; dz = pz * side; }
    }
    out.roll = b.state === 'windup' && b.t > 0.64 && h.rollCd <= 0;
  }
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
