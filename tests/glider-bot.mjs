// Paperwing Post bots. A pilot flies every flight the way a player would: it heads for the nearest letter while it
// has the height to glide there, and when it hasn't it turns for the nearest chimney (or sunny square) it can reach
// above the pot and circles in the warm air until it has. It pulls up over any roof in its way, dives onto a window
// it's high above, and posts when the window is closest. With every letter posted it climbs again and glides home to
// the attic window. The careful pilot also detours for pages near its way. Four pilots fly (hurried and careful, in
// the Dart and the Broadwing): every flight must be finished (every letter posted) by at least three of them, each
// must finish at least five of the six, they must get home at least three times between them, and a pilot who never
// steers must not post everything. (The bots are poor at pages and at getting home; a player does much better.)
import assert from 'node:assert/strict';
import { Flight, LEVELS, DT, POST_REACH, groundAt, roofTop, reach, idleInput } from '../.checks/glider-game.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/** steering towards a point: a bank proportional to the heading error */
const steerTo = (f, x, z) => clamp(-wrap(Math.atan2(x - f.x, z - f.z) - f.yaw) * 2.2, -1, 1);
/** the highest thing over the next stretch straight ahead */
function ahead(f, span) {
  let m = -99;
  for (let d = 4; d <= span; d += 3) { const x = f.x + Math.sin(f.yaw) * d, z = f.z + Math.cos(f.yaw) * d; m = Math.max(m, groundAt(x, z), roofTop(f.c.town, x, z)); }
  return m;
}
/** the warm air worth turning for: chimneys (and sunny squares) in reach, with the glider above the pot */
function thermals(f) {
  const out = [];
  for (const h of f.c.town) if (h.chimney && f.y > h.chimney.eave + 1) out.push({ x: h.chimney.x, z: h.chimney.z, top: h.chimney.top + 60, up: h.chimney.up });
  for (const s of f.lv.sunny) out.push({ x: s.x, z: s.z, top: groundAt(s.x, s.z) + 90, up: s.up });
  return out;
}

function pilot(careful) {
  const m = { mode: 'go', th: null, circleT: 0, lastD: Infinity, page: -1, pageT: 0, skip: new Set() };
  return (f) => {
    const inp = idleInput();
    const ti = f.delivered.indexOf(false), home = ti < 0, t = home ? f.c.home : f.c.targets[ti];
    const dx = t.x - f.x, dz = t.z - f.z, dist = Math.hypot(dx, dz);
    // fly in over the rooftops: aim a little above the ridge of the window's house
    const aimY = home ? t.y : Math.max(t.y + 2, roofTop(f.c.town, t.x - t.nx * 2, t.z - t.nz * 2) + 2);
    // the height it takes to glide there (about 7:1 to be safe, plus room to get over roofs on the way)
    const need = aimY + dist / 9 + (home ? 6 : 3);
    if (m.mode === 'go' && f.y < need && dist > 25) {
      const ths = thermals(f).filter((h) => f.y < h.top - 10).map((h) => ({ ...h, d: Math.hypot(h.x - f.x, h.z - f.z) })).filter((h) => h.d < (f.y - groundAt(h.x, h.z)) * 6 + 10);
      ths.sort((a, b) => a.d - Math.min(30, a.up * 8) - (b.d - Math.min(30, b.up * 8)));
      if (ths.length) { m.mode = 'climb'; m.th = ths[0]; m.circleT = 0; }
    }
    if (m.mode === 'climb') {
      const th = m.th, d = Math.hypot(th.x - f.x, th.z - f.z);
      // slow (a tight circle) while climbing
      inp.pitch = clamp((f.speed - 9.5) * 0.15, -0.3, 0.5);
      if (f.y > need + 8 || f.y > th.top - 6 || m.circleT > 40) m.mode = 'go';
      else if (d > 9 && m.circleT === 0) inp.steer = steerTo(f, th.x, th.z);
      else {
        // circle the column: chase a point a little way round a 7 m circle (turning the way a right bank turns)
        // (with the circle moved upwind, since the wind carries the glider round it downwind)
        m.circleT += DT; const cx = th.x - f.lv.wind[0] * 2, cz = th.z - f.lv.wind[1] * 2, a = Math.atan2(f.x - cx, f.z - cz) - 0.8;
        inp.steer = steerTo(f, cx + Math.sin(a) * 8, cz + Math.cos(a) * 8);
      }
    }
    if (m.mode === 'go') {
      let gx = t.x + (home ? 0 : t.nx * 2), gz = t.z + (home ? 0 : t.nz * 2);
      // a page near the way is worth a small detour
      if (careful) {
        if (m.page >= 0 && (m.pageT += DT) > 10) { m.skip.add(m.page); m.page = -1; }
        if (m.page < 0 || f.got[m.page]) { m.page = -1; m.pageT = 0; let bd = 45; f.c.pages.forEach((p, i) => { if (f.got[i] || m.skip.has(i)) return; const d = Math.hypot(p.x - f.x, p.z - f.z), fwd = (p.x - f.x) * dx + (p.z - f.z) * dz; if (d < bd && fwd > 0 && p.y < f.y - 1 && f.y - p.y < 12 && f.y > need + 4 && p.y > roofTop(f.c.town, p.x, p.z) + 4) { bd = d; m.page = i; } }); }
        if (m.page >= 0 && dist > 30) { const p = f.c.pages[m.page]; gx = p.x; gz = p.z; }
      }
      inp.steer = steerTo(f, gx, gz);
      // speed: about 12 m/s; dive onto a window it's well above
      const ty = m.page >= 0 && dist > 30 ? f.c.pages[m.page].y : aimY;
      // a steady glide path down to the aim point, never faster than about 15 m/s
      const path = Math.atan2(ty - f.y, Math.max(8, dist - 4));
      inp.pitch = path < -0.08 ? clamp((path + 0.06) / 0.65, -1, 0) : clamp((f.speed - 12) * 0.12, -0.4, 0.5);
      if (f.speed > 15) inp.pitch = Math.max(inp.pitch, 0.3);
      // too high right over it: spiral down round it, nose down, a little faster
      if (!home && dist < 30 && f.y - aimY > 4) {
        const a = Math.atan2(f.x - t.x, f.z - t.z) - 0.8; inp.steer = steerTo(f, t.x + Math.sin(a) * 14, t.z + Math.cos(a) * 14);
        inp.pitch = f.speed > 18 ? 0.2 : -0.6;
      }
    }
    // roofs in the way: pull up if there's the speed for it, otherwise turn away
    const wall = ahead(f, 20);
    if (inp.pitch < 0 && ahead(f, 24) > f.y - 4) inp.pitch = 0;
    if (wall > f.y - 1.5) { if (f.speed > 9 && wall < f.y + 4) inp.pitch = 0.8; else inp.steer = 1; }
    // post when the window is as close as it's going to get
    if (!home) {
      const d3 = reach(t, f.x, f.y, f.z);
      if (d3 < POST_REACH && (d3 < 3.5 || d3 > m.lastD)) { inp.post = true; m.lastD = Infinity; } else m.lastD = d3 < POST_REACH ? d3 : Infinity;
    }
    return inp;
  };
}

const runFlight = (lv, glider, ctrl, secs = 360) => {
  const f = new Flight(lv, glider); let prev = idleInput();
  for (let i = 0; i < secs * 60 && !f.over; i++) { let inp = ctrl(f); if (inp.post && prev.post) inp = { ...inp, post: false }; f.tick(inp); prev = inp; }
  return f;
};

let homes = 0; const fails = [], perFlight = {}, perPilot = {};
for (const careful of [false, true]) for (const g of ['dart', 'wing']) {
  const rows = [];
  for (const lv of LEVELS) {
    const f = runFlight(lv, g, pilot(careful)), r = f.result();
    rows.push(`${lv.id} ${r.posted}/${f.delivered.length} pages ${r.pages}/${lv.pageGoal} ${f.why ?? 'flying'} ${Math.round(f.t)}s bumps ${r.bumps} ★${r.stars}`);
    const who = `${careful ? 'careful' : 'hurried'} ${g}`;
    if (r.all) { perFlight[lv.id] = (perFlight[lv.id] ?? 0) + 1; perPilot[who] = (perPilot[who] ?? 0) + 1; } else fails.push(`${who} ${lv.id}`);
    if (r.home) homes++;
  }
  console.log(`${careful ? 'careful' : 'hurried'} ${g}:\n  ${rows.join('\n  ')}`);
}
{
  // a pilot who never steers posts nothing
  for (const lv of LEVELS) { const f = runFlight(lv, 'dart', () => ({ ...idleInput(), post: Math.random() < 0.5 }), 120); assert.ok(!f.result().all, `${lv.id}: nobody posts everything without steering`); }
}
for (const lv of LEVELS) assert.ok((perFlight[lv.id] ?? 0) >= 3, `${lv.id}: finished by at least three pilots (${perFlight[lv.id] ?? 0})`);
for (const [who, n] of Object.entries(perPilot)) assert.ok(n >= 5, `${who} finishes at least five flights (${n})`);
assert.equal(Object.keys(perPilot).length, 4, 'every pilot finishes something');
assert.ok(homes >= 3, `the pilots get home at least three times (${homes})`);
console.log(`glider bots: all good (unfinished: ${fails.join(', ') || 'none'}; home ${homes}/${LEVELS.length * 4})`);
