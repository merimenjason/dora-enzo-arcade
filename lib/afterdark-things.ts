// The Arcade After Dark: what lives in each world (hazards, platforms, pickups, locks) and how the three abilities touch
// them. Ported from the prototype's entities.js.
import { SB, HB, PING_R, TUNNEL, fsize, type Armour, type Jelly, type World } from './afterdark-worlds.js';
import { type Game, type Ring, W0, lead, sfx, ev, spark, rnd, rr, clamp, lerp, heroMid } from './afterdark-core.js';
import { hurt, fallVoid, webActive, swapHeroes } from './afterdark-move.js';
import { takePortal, portalOpen } from './afterdark-flow.js';
import { updBoss, bossRing, bossSweep, bossGust, bossNeed } from './afterdark-boss.js';

function overlapsLead(g: Game, x0: number, y0: number, x1: number, y1: number) {
  const h = lead(g), w = W0(g);
  const b = w.kind === 'swim' ? [h.x - SB.w, h.y - SB.h, h.x + SB.w, h.y + SB.h] : [h.x - HB.w, h.y - HB.h, h.x + HB.w, h.y];
  return b[2] > x0 && b[0] < x1 && b[3] > y0 && b[1] < y1;
}
export const free = (g: Game) => !g.cut && !g.trans && g.mode === 'play';
function gainPearl(g: Game, w: World, x: number, y: number) { g.stats.pearls++; sfx(g, 'pearl'); spark(g, w.id, x, y, 20, '#ffffff', 200, 0.8, 4); ev(g, 'pearl ' + w.id); }

export function updWorld(g: Game, dt: number) {
  const w = W0(g), h = lead(g), t = g.time;
  // the Static: dissolving pieces shed pixels that turn gold and rise; blown pieces fly off; live pieces sting on touch
  let near = 1e9;
  for (const st of w.statics) {
    if (!st.alive) {
      if (st.dis >= 1) continue;
      if (st.delay > 0) { st.delay -= dt; continue; }
      st.dis = Math.min(1, st.dis + dt / (st.blown ? 0.7 : 0.9));
      if (st.blown) { st.x0 += st.blown * 900 * dt; st.x1 += st.blown * 900 * dt; st.y0 -= 80 * dt; st.y1 -= 80 * dt; continue; }
      const n = Math.ceil((st.x1 - st.x0) * (st.y1 - st.y0) / 9000);
      for (let i = 0; i < n; i++) g.parts.push({ w: w.id, x: rr(g, st.x0, st.x1), y: rr(g, st.y0, st.y1), vx: rr(g, -60, 60), vy: rr(g, -140, -40), life: rr(g, 0.6, 1.3), max: 1.3, col: rnd(g) < 0.5 ? '#c9b8ff' : '#efe6ff', size: rr(g, 3, 7), kind: 'pix' });
      continue;
    }
    near = Math.min(near, Math.abs(h.x - clamp(h.x, st.x0, st.x1)));
    if (!st.solid && free(g) && overlapsLead(g, st.x0 + 18, st.y0 + 18, st.x1 - 18, st.y1)) {
      if (w.pit && st.x0 >= w.pit.x0 - 1 && st.x1 <= w.pit.x1 + 1) { if (h.invT <= 0) { g.stats.hurts++; sfx(g, 'hurt'); spark(g, w.id, h.x, h.y - 60, 16, '#c9b8ff', 260, 0.6, 4, 'pix'); fallVoid(g, h, w); } }
      else hurt(g, h, (st.x0 + st.x1) / 2);
    }
  }
  if (near < 260 && g.mode === 'play' && rnd(g) < dt * 4) sfx(g, 'crackle', 0.02 + 0.04 * (1 - near / 260));
  // pearls
  for (const p of w.pearls) {
    p.t += dt;
    if (p.revealed && !p.got && free(g) && Math.hypot(h.x - p.x, heroMid(g, h) - p.y) < 75) { p.got = true; gainPearl(g, w, p.x, p.y); }
  }
  for (const m of w.movers) { const ox = m.x, oy = m.y; m.x = m.cx + Math.sin(t * m.w + m.ph) * m.ax; m.y = m.cy + Math.sin(t * m.w + m.ph) * m.ay; m.dx = ox ? m.x - ox : 0; m.dy = oy ? m.y - oy : 0; }
  for (const m of w.swings) { const ox = m.x, oy = m.y, a = Math.sin(t * m.w + m.ph) * m.A; m.ang = a; m.x = m.px + Math.sin(a) * m.len; m.y = m.py + Math.cos(a) * m.len; m.dx = ox ? m.x - ox : 0; m.dy = oy ? m.y - oy : 0; }
  if (w.id === 'castle') updCastle(g, w, dt);
  else if (w.id === 'room') updRoom(g, w, dt);
  else if (w.id === 'sea') updSea(g, w, dt);
  else if (w.id === 'deep') updDeep(g, w, dt);
  else if (w.id === 'cloud') updCloud(g, w, dt);
  else if (w.id === 'hub') updHub(g, w, dt);
  if (w.kind === 'swim') for (const cu of w.currents) {   // currents: bands of drifting streaks
    if (rnd(g) < 0.5) { const life = (cu.x1 - cu.x0) / Math.abs(cu.vx * 1.6); g.parts.push({ w: w.id, x: cu.vx > 0 ? cu.x0 + rr(g, 0, 200) : cu.x1 - rr(g, 0, 200), y: rr(g, cu.y0, cu.y1), vx: cu.vx * 1.6, vy: rr(g, -8, 8), life, max: life, col: '#fff', size: rr(g, 8, 18), kind: 'streak' }); }
  }
  // the far-end way-out screens pull you in on touch (the entrance ones wait for E)
  if (free(g)) for (const p of w.portals) {
    if (p.id !== 'out' || !portalOpen(g, w, p)) continue;
    const hy = w.kind === 'swim' ? h.y : h.y - 80, py = w.kind === 'swim' ? p.y : (w.floor < 5000 ? w.floor - 80 : p.y);
    if (Math.abs(h.x - p.x) < 50 && Math.abs(hy - py) < 100) { takePortal(g, p); return; }
  }
}

function updCastle(g: Game, w: World, dt: number) {
  const h = lead(g), wl = w.wall!; wl.t += dt; wl.knock = Math.max(0, wl.knock - dt); wl.bubble = Math.max(0, wl.bubble - dt);
  if (!wl.open && h.x > wl.x - 260 && !g.trans) { wl.nearT += dt; if (wl.nearT > 1.2) wl.bubble = Math.max(wl.bubble, 0.3); }
  else wl.nearT = 0;
  if (!wl.open && wl.bubble > 0 && !g.abil.ping && !g.flags.castleBlocked) { g.flags.castleBlocked = true; ev(g, 'blocked'); }
  const q = w.portals[1];
  if (g.abil.ping && q.open) q.open = false;
  if (g.flags.castleBlocked && !g.abil.ping && !q.open) { q.open = true; q.t = 0; q.hop = 'sea'; spark(g, 'castle', q.x, q.y, 24, '#fff6d0', 220, 0.8, 5); sfx(g, 'reveal'); }
  if (q.open) q.t! += dt;
  for (const a of w.armours!) {   // the suit of armour marches its beat; a ping, sweep or gust leaves it rattled and harmless
    a.daze = Math.max(0, a.daze - dt); a.turn = Math.max(0, a.turn - dt);
    if (a.daze <= 0 && a.turn <= 0) {
      a.x += a.dir * a.speed * dt; a.walkT += dt;
      if (a.x > a.x1 || a.x < a.x0) { a.x = clamp(a.x, a.x0, a.x1); a.dir *= -1; a.turn = 0.5; sfx(g, 'clank'); }
    }
    if (a.daze <= 0 && free(g) && overlapsLead(g, a.x - 42, w.floor - a.h + 20, a.x + 42, w.floor)) hurt(g, h, a.x);
  }
  if (w.pit && !w.statics.some((s) => s.alive && s.x0 >= w.pit!.x0 - 1 && s.x1 <= w.pit!.x1 + 1)) { w.pit = null; ev(g, 'pit swept'); }
  const c = w.chest!;
  if (!c.open && free(g) && Math.abs(h.x - c.x) < 70 && Math.abs(h.y - c.y) < 30 && !webActive(w)) { c.open = true; gainPearl(g, w, c.x, c.y - 60); }
  if (w.web!.burnt) w.web!.t += dt;
}
function updRoom(g: Game, w: World, dt: number) {
  const h = lead(g), pd = w.pedestal!;
  if (!pd.taken && free(g) && Math.abs(h.x - pd.x) < 70) { g.cut = { kind: 'sweep', t: 0, dur: 2.7 }; if (g.lead !== 'dora') swapHeroes(g); }
  for (const b of w.braziers!) if (b.lit) b.t += dt;
  if (!g.flags.roomClear && pd.taken && !w.statics.some((s) => s.alive && s.kind === 'wall') && w.braziers!.every((b) => b.lit)) {
    g.flags.roomClear = true; g.roomClearT = g.time; sfx(g, 'reveal'); ev(g, 'room clear'); g.stats.tCrest = g.playT;
  }
}

function jellyPos(j: Jelly, t: number) {
  if (j.kind === 'bob') { j.y = j.y0! + Math.sin(t * 1.1 + j.ph) * j.a!; }
  else if (j.kind === 'patrol') { const q = (Math.sin(t * j.sp! + j.ph) + 1) / 2; const nx = lerp(j.x0!, j.x1!, q); j.face = nx >= j.x ? 1 : -1; j.x = nx; j.y = j.y + Math.sin(t * 3 + j.ph) * 0.4; }
  else { const a = t * j.sp! + j.ph; j.x = j.cx! + Math.cos(a) * j.r!; j.y = j.cy! + Math.sin(a) * j.r! * 0.8; }
}
function updSea(g: Game, w: World, dt: number) {
  const h = lead(g);
  for (const j of w.jellies) {
    j.stun = Math.max(0, j.stun - dt);
    if (j.stun <= 0) jellyPos(j, (j.tt += dt));
    if (j.stun <= 0 && free(g) && Math.hypot(h.x - j.x, h.y - j.y) < 60) hurt(g, h, j.x);
  }
  for (const c of w.crystals) if (c.lit > 0) c.lit += dt;
  w.pillar!.t += dt;
  const m = w.mound!; m.bubble = Math.max(0, m.bubble - dt); if (m.open) m.t += dt;
  if (!m.open && Math.abs(h.x - m.x) < 260 && h.y > 380) m.bubble = Math.max(m.bubble, 0.3);
  if (!m.open && rnd(g) < dt * 5) g.parts.push({ w: 'sea', x: m.x + rr(g, -60, 60), y: m.y - 70, vx: rr(g, -15, 15), vy: rr(g, -60, -30), life: 1.6, max: 1.6, col: rnd(g) < 0.6 ? '#b9a4ff' : '#efe6ff', size: rr(g, 2, 5), kind: 'mote' });
  const cn = w.conch!;
  if (!cn.used && free(g) && Math.abs(h.x - cn.x) < 120 && h.y > 360) { g.cut = { kind: 'ping', t: 0, dur: 3 }; cn.used = true; if (g.lead !== 'enzo') swapHeroes(g); }
}
function updDeep(g: Game, w: World, dt: number) {
  const h = lead(g), a = w.anchor!; a.t += dt; a.armT = Math.max(0, a.armT - dt);
  for (const st of w.statics) st.guarded = !(a.found && a.bare);
  for (const q of w.guards!) {
    q.t += dt;
    if (q.alive) { const ang = a.t * 0.9 + q.ph; q.x = a.x - 60 + Math.cos(ang) * 230; q.y = a.y + Math.sin(ang) * 190; if (free(g) && Math.hypot(h.x - q.x, h.y - q.y) < 62) hurt(g, h, q.x); }
    else { q.x += q.vx * dt; q.y += q.vy * dt; }
  }
  a.bare = w.guards!.every((q) => !q.alive);
  if (!a.gone && a.found && a.bare && !w.statics.some((s) => s.alive)) {
    a.gone = true; g.flags.anchor = true; g.stats.tAnchor = g.playT; ev(g, 'ANCHOR');
    g.cut = { kind: 'flee', t: 0, dur: 2.6 };
  }
  const o = w.portals[1]; if (o.open) o.t! += dt;
}
function updCloud(g: Game, w: World, dt: number) {
  const b = w.bridge!, wh = w.wheel!;
  if (wh.spun) { wh.t += dt; b.out = Math.min(1, b.out + dt / 1.2); }
  for (const k of w.banks!) if (!k.alive) k.t += dt;
  const s = w.shrine!, h = lead(g);
  if (!s.taken && free(g) && Math.abs(h.x - s.x) < 80 && Math.abs(h.y - s.y) < 40) { g.cut = { kind: 'gust', t: 0, dur: 3 }; }
  for (const z of w.winds!) if (rnd(g) < dt * 18) g.parts.push({ w: 'cloud', x: z.x1 + rr(g, 0, 200) - (z.x1 - z.x0) * rnd(g), y: rr(g, 100, 700), vx: z.vx * 4, vy: rr(g, -10, 10), life: 1.2, max: 1.2, col: 'rgba(255,255,255,.8)', size: rr(g, 10, 26), kind: 'streak' });
  for (const v of w.vents!) if (rnd(g) < dt * 14) g.parts.push({ w: 'cloud', x: v.x + rr(g, -45, 45), y: v.y - 10, vx: rr(g, -8, 8), vy: rr(g, -420, -300), life: 1.0, max: 1.0, col: 'rgba(255,255,255,.75)', size: rr(g, 10, 22), kind: 'lift' });
}
function updHub(g: Game, w: World, dt: number) {
  for (const c of w.cabs!) { c.wob = Math.max(0, c.wob - dt); c.bubble = Math.max(0, c.bubble - dt); }
  const walls = w.statics.filter((s) => s.alive && s.kind === 'wall');
  if (walls.length && rnd(g) < dt * 6) {   // the Static creeps: violet motes drift out over the carpet
    const e = Math.min(...walls.map((s) => s.x0));
    g.parts.push({ w: 'hub', x: e + rr(g, -10, 30), y: rr(g, 560, 660), vx: rr(g, -70, -25), vy: rr(g, -12, 4), life: rr(g, 1.2, 2.4), max: 2.4, col: rnd(g) < 0.6 ? '#b9a4ff' : '#efe6ff', size: rr(g, 2, 5), kind: 'mote' });
  }
  if (g.boss) updBoss(g, dt);
  else if (g.flags.anchor && !g.flags.boss && !g.cut && !g.trans && g.mode === 'play') { g.cut = { kind: 'gather', t: 0, dur: 4 }; ev(g, 'GATHER'); }
}

// ───────────── what each ability touches
export function ringHit(g: Game, w: World, r: Ring, near: (x: number, y: number) => boolean) {
  const once = (o: object, fn: () => void) => { if (!r.hit.has(o)) { r.hit.add(o); fn(); } };
  for (const p of w.pearls) if (!p.revealed && near(p.x, p.y)) { p.revealed = true; p.t = 0; spark(g, w.id, p.x, p.y, 12, '#bff8ff', 160, 0.7, 4); }
  if (w.id === 'sea') {
    const p = w.pillar!, [, ph] = fsize('pillar'), ty = p.bottom - ph * (1 - TUNNEL.cy);
    if (!p.open && near(p.x, ty)) { p.open = true; p.t = 0; g.flags.tunnel = true; sfx(g, 'reveal'); spark(g, 'sea', p.x, ty, 30, '#7ff5ee', 300, 1, 5); g.shake = 0.2; ev(g, 'TUNNEL'); }
    for (const c of w.crystals) if (!c.lit && near(c.x, c.y - 40)) { c.lit = 0.001; sfx(g, 'chime'); spark(g, 'sea', c.x, c.y - 50, 14, '#9ffff4', 180, 0.8, 4); }
    for (const j of w.jellies) if (near(j.x, j.y)) once(j, () => { j.stun = 3.5; spark(g, 'sea', j.x, j.y, 8, '#9ffff4', 140, 0.5, 3); });
  }
  if (w.id === 'castle') {
    const wl = w.wall!, dy = w.floor - 180;
    if (!wl.open && near(Math.max(wl.x, r.x), dy)) { wl.open = true; wl.t = 0; g.flags.door = true; g.stats.tDoor = g.playT; sfx(g, 'reveal'); spark(g, 'castle', wl.x + 150, dy, 40, '#7ff5ee', 320, 1.1, 5); g.shake = 0.25; ev(g, 'DOOR'); }
    for (const a of w.armours!) if (near(a.x, w.floor - 100)) once(a, () => daze(g, a));
    // the ping's rings shake the cobweb off the chest's ledge (the sweep burns it): the castle is never visited again
    // with the sweep once it is earned, so without this the chest's pearl was out of reach on the way through
    const wb = w.web!;
    if (webActive(w) && near(wb.x, (wb.y0 + wb.y1) / 2)) { wb.burnt = true; wb.t = 0; sfx(g, 'reveal'); spark(g, 'castle', wb.x, 360, 30, '#bff8ff', 240, 0.9, 5); ev(g, 'web'); }
  }
  if (w.id === 'deep') {
    const a = w.anchor!;
    if (!a.found && near(a.x, a.y)) { a.found = true; sfx(g, 'reveal'); g.shake = 0.25; spark(g, 'deep', a.x, a.y, 30, '#7ff5ee', 300, 1, 5); ev(g, 'anchor found'); }
  }
  if (w.id === 'hub' && g.boss) bossRing(g, r, near);
}
function daze(g: Game, a: Armour) { a.daze = 3.2; sfx(g, 'clank'); spark(g, 'castle', a.x, 640 - a.h, 12, '#fff6c0', 180, 0.6, 4); }
export type Box = { x0: number; x1: number; y0: number; y1: number };
export function sweepHit(g: Game, w: World, B: Box, n: number) {
  const inB = (x: number, y: number) => x > B.x0 && x < B.x1 && y > B.y0 && y < B.y1;
  if (w.id === 'castle') {
    const wb = w.web!;
    if (webActive(w) && inB(wb.x, (wb.y0 + wb.y1) / 2)) { wb.burnt = true; sfx(g, 'reveal'); spark(g, 'castle', wb.x, 360, 30, '#ffd77a', 240, 0.9, 5); ev(g, 'web'); }
    for (const a of w.armours!) if (inB(a.x, w.floor - 100)) daze(g, a);
  }
  if (w.id === 'room') for (const b of w.braziers!) if (!b.lit && inB(b.x, w.floor - 100)) { b.lit = true; b.t = 0; sfx(g, 'reveal'); spark(g, 'room', b.x, w.floor - 150, 26, '#ffd77a', 260, 0.9, 5); ev(g, 'brazier'); }
  if (w.id === 'sea') for (const j of w.jellies) if (inB(j.x, j.y)) { j.stun = 3; }
  if (w.id === 'deep') { const a = w.anchor!; if (!(a.found && a.bare) && inB(a.x - 120, a.y)) { a.armT = 0.5; sfx(g, 'nope'); spark(g, 'deep', a.x - 140, a.y, 14, '#c9b8ff', 200, 0.5, 4, 'pix'); } }
  if (w.id === 'hub') {
    const walls = w.statics.filter((s) => s.alive && s.kind === 'wall');
    if (n && !walls.length && !g.flags.hubSwept) { g.flags.hubSwept = true; g.stats.tHub = g.playT; ev(g, 'HUB SWEPT'); g.cut = { kind: 'wake', t: 0, dur: 3.2 }; }
    if (g.boss) bossSweep(g, B);
  }
}
export function gustHit(g: Game, w: World, B: Box, face: number) {
  const inB = (x0: number, y0: number, x1: number, y1: number) => x1 > B.x0 && x0 < B.x1 && y1 > B.y0 && y0 < B.y1;
  if (w.banks) for (const b of w.banks) if (b.alive && inB(b.x0, b.y0, b.x1, b.y1)) { b.alive = false; b.t = 0; b.dir = face; sfx(g, 'whoosh'); g.shake = 0.15; ev(g, 'bank'); }
  if (w.id === 'cloud') { const wh = w.wheel!; if (!wh.spun && inB(wh.x - 60, wh.y - 200, wh.x + 60, wh.y)) { wh.spun = true; sfx(g, 'reveal'); ev(g, 'wheel'); } }
  if (w.id === 'sea') {
    const m = w.mound!;
    if (!m.open && inB(m.x - 110, m.y - 120, m.x + 110, m.y)) { m.open = true; m.t = 0; sfx(g, 'reveal'); g.shake = 0.25; for (let i = 0; i < 40; i++) g.parts.push({ w: 'sea', x: m.x + rr(g, -90, 90), y: m.y - rr(g, 0, 80), vx: face * rr(g, 100, 400), vy: rr(g, -200, -40), life: 1.4, max: 1.4, col: rnd(g) < 0.5 ? '#f3d9a0' : '#e8c27a', size: rr(g, 3, 7), kind: 'spark' }); ev(g, 'MOUND'); }
    for (const j of w.jellies) if (inB(j.x - 40, j.y - 40, j.x + 40, j.y + 40)) j.stun = 3;
  }
  if (w.id === 'castle') for (const a of w.armours!) if (inB(a.x - 40, w.floor - a.h, a.x + 40, w.floor)) { daze(g, a); a.x = clamp(a.x + face * 60, a.x0, a.x1); }
  if (w.id === 'deep') {
    const a = w.anchor!;
    if (a.found) for (const q of w.guards!) if (q.alive && inB(q.x - 50, q.y - 50, q.x + 50, q.y + 50)) { q.alive = false; q.vx = face * 700; q.vy = rr(g, -200, 200); sfx(g, 'whoosh'); spark(g, 'deep', q.x, q.y, 16, '#c9b8ff', 260, 0.6, 4, 'pix'); }
  }
  if (w.id === 'hub' && g.boss) bossGust(g, B);
}
/** how far the lead is from something each ability would help with (used by assist, the Act button and the hints) */
export function abilityNeeds(g: Game) {
  const w = W0(g), h = lead(g), m = heroMid(g, h);
  const N = { ping: 1e9, sweep: 1e9, gust: 1e9 };
  const d = (x: number, y?: number) => Math.hypot(x - h.x, (y === undefined ? m : y) - m);
  const put = (k: keyof typeof N, v: number) => { N[k] = Math.min(N[k], v); };
  for (const st of w.statics) if (st.alive && !st.guarded) {
    const dx = Math.abs(h.x - clamp(h.x, st.x0, st.x1));
    if (dx < 330) put('sweep', Math.max(0, dx - 200));
    if (!st.solid && dx < 500 && w.id !== 'castle' && Math.abs((st.y0 + st.y1) / 2 - m) < 220) put('gust', Math.max(0, dx - 400));
  }
  if (w.id === 'sea') {
    if (!w.pillar!.open && Math.abs(h.x - w.pillar!.x) < PING_R - 40) put('ping', Math.max(0, Math.abs(h.x - w.pillar!.x) - 380));
    for (const c of w.crystals) if (!c.lit && d(c.x, c.y) < 420) put('ping', Math.max(0, d(c.x, c.y) - 330));
    const mo = w.mound!;
    if (!mo.open && d(mo.x, mo.y - 60) < 520) put('gust', Math.max(0, d(mo.x, mo.y - 60) - 380));
  }
  if (w.id === 'castle') {
    if (!w.wall!.open && h.x > w.wall!.x - PING_R + 120) put('ping', 0);
    if (webActive(w) && Math.abs(h.x - w.web!.x) < 280 && Math.abs(h.y - w.web!.y1) < 60) put('sweep', Math.max(0, Math.abs(h.x - w.web!.x) - 200));
    if (webActive(w) && Math.abs(h.x - w.web!.x) < 420 && Math.abs(h.y - w.web!.y1) < 60) put('ping', Math.max(0, Math.abs(h.x - w.web!.x) - 300));
    for (const a of w.armours!) if (a.daze <= 0 && Math.abs(h.x - a.x) < 330) put('ping', 40);
  }
  if (w.id === 'room') for (const b of w.braziers!) if (!b.lit && Math.abs(h.x - b.x) < 260) put('sweep', (b.x - h.x) * h.face > -20 && Math.abs(h.x - b.x) < 220 ? 0 : 100);
  if (w.id === 'deep') {
    const a = w.anchor!;
    if (!a.found) put('ping', Math.max(0, d(a.x, a.y) - 470));
    else if (!a.bare) { for (const q of w.guards!) if (q.alive) put('gust', Math.max(0, Math.abs(q.x - h.x) - 380) + Math.max(0, Math.abs(q.y - m) - 150)); }
  }
  if (w.id === 'cloud') {
    for (const b of w.banks!) if (b.alive && Math.abs(h.x - b.x0) < 520 && h.y > b.y0 && h.y - 160 < b.y1) put('gust', Math.max(0, Math.abs(h.x - b.x0) - 400));
    const wh = w.wheel!;
    if (!wh.spun && Math.abs(h.x - wh.x) < 520 && Math.abs(h.y - wh.y) < 120) put('gust', Math.max(0, Math.abs(h.x - wh.x) - 380));
  }
  if (w.id === 'hub' && g.boss) { const k = bossNeed(g); if (k) put(k, 0); }
  return N;
}
