/** Browser and Node bots share this input policy. It uses no teleports, stat changes or direct bonks. */
export function huntPolicy(g) {
  const b = g.beast, h = g.hero;
  const out = { x: 0, z: 0, sprint: true, bonk: false, charge: false, roll: false, lock: false, previous: false, next: false, use: false };
  if (!b || g.mode !== 'hunt') return out;
  const d = Math.hypot(h.x - b.x, h.z - b.z), melee = g.heroId === 'dora';
  const desired = melee ? 2.7 : 7;
  let tx = b.x, tz = b.z;
  if (b.id === 'hornclack') { tx -= Math.cos(b.face) * desired; tz += Math.sin(b.face) * desired; }
  else { const a = Math.atan2(h.z - b.z, h.x - b.x); tx += Math.cos(a) * desired; tz += Math.sin(a) * desired; }
  let dx = tx - h.x, dz = tz - h.z;
  if (b.state === 'windup' || ['charge', 'swoop', 'pounce', 'hop', 'tongue', 'shake', 'sweep'].includes(b.state)) {
    if (['shake', 'sweep', 'cloud'].includes(b.attack)) {
      if (d < 6.3) { dx = h.x - b.x; dz = h.z - b.z; }
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
  const want = h.fluff < 65 && g.items[0] ? 0 : g.items[1] && d < 5 && b.state !== 'dizzy' ? 1 : -1;
  if (want >= 0) { if (g.item !== want) out.next = Math.floor(g.time * 10) % 2 === 0; else out.use = Math.floor(g.time * 10) % 2 === 0; }
  return out;
}
