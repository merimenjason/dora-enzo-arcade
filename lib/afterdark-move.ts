// The Arcade After Dark: movement (direct: press and the hero acts, release and they stop), the partner, hurts and falls,
// and the three abilities. Ported from the prototype's logic.js.
import { HB, SB, PING_R, GUST_R, TUNNEL, fsize, FRraw, type Ability, type Plat, type Solid, type World } from './afterdark-worlds.js';
import { type Game, type Hero, type Input, W0, lead, partner, sfx, ev, spark, rnd, rr, clamp, lerp, placeHeroes, entryOf, heroMid } from './afterdark-core.js';
import { sweepHit, gustHit, ringHit, abilityNeeds } from './afterdark-things.js';

// solid boxes (block every side) for the current state of a world
export function solidsOf(g: Game, w: World): Solid[] {
  const s: Solid[] = [];
  if (w.blocks) for (const b of w.blocks) {
    const [bw, bh] = fsize('block');
    const top = b.stack ? w.floor - bh * 2 + 8 : w.floor - bh + 4;
    s.push({ x0: b.x - bw / 2 + 6, x1: b.x + bw / 2 - 6, y0: top, y1: w.floor + 40 });
  }
  if (w.id === 'castle') {
    s.push({ x0: w.wall!.x + 30, x1: w.W + 400, y0: -400, y1: 1200, id: 'wall' });
    if (webActive(w)) s.push({ x0: w.web!.x - 30, x1: w.web!.x + 30, y0: w.web!.y0, y1: w.web!.y1, id: 'web' });
  }
  if (w.id === 'sea') {
    const [pw, ph] = fsize('pillar'), p = w.pillar!;
    const x0 = p.x - pw * 0.36, x1 = p.x + pw * 0.36, top = p.bottom - ph * 0.95;
    if (!p.open) s.push({ x0, x1, y0: top, y1: 900, id: 'pillar' });
    else {
      const ty = p.bottom - ph * (1 - TUNNEL.cy), tr = ph * TUNNEL.r;
      s.push({ x0, x1, y0: top, y1: ty - tr, id: 'pillar' });
      s.push({ x0, x1, y0: ty + tr, y1: 900, id: 'pillar' });
    }
    const m = w.mound!; if (!m.open) s.push({ x0: m.x - 110, x1: m.x + 110, y0: m.y - 80, y1: 900, id: 'mound' });
  }
  if (w.banks) for (const b of w.banks) if (b.alive) s.push({ x0: b.x0, x1: b.x1, y0: b.y0, y1: b.y1, id: 'bank' });
  for (const st of w.statics) if (st.alive && st.solid) s.push({ x0: st.x0 + 14, x1: st.x1, y0: st.y0 + 20, y1: st.y1, id: 'static', st });
  void g;
  return s;
}
export const webActive = (w: World) => !!w.web && !w.web.burnt && !!FRraw('web-big');
// one-way platforms (land on them from above, jump up through them); moving ones carry the hero
export function platsOf(w: World): Plat[] {
  const p = w.plats.slice();
  for (const m of w.swings) p.push({ x0: m.x - m.half, x1: m.x + m.half, y: m.y, mv: m });
  for (const m of w.movers) p.push({ x0: m.x - m.half, x1: m.x + m.half, y: m.y, mv: m });
  if (w.bridge && w.bridge.out > 0.98) p.push({ x0: w.bridge.x0, x1: w.bridge.x1, y: w.bridge.y });
  return p;
}
/** is there anything to land on under (x, y)? */
export function groundBelow(w: World, x: number, y: number) {
  if (w.floor < 5000) return true;
  for (const p of platsOf(w)) if (x > p.x0 - 20 && x < p.x1 + 20 && p.y >= y - 4 && p.y - y < 420) return true;
  return false;
}
/** how far a moving platform reaches out to catch a near miss: wide with assist, a little without (the chandeliers) */
export const catchMargin = (g: Game) => (g.assist ? 34 : 16);

export function moveLand(g: Game, h: Hero, w: World, I: Input, dt: number) {
  // ride whatever we stand on
  if (h.on && h.on.mv) { h.x += h.on.mv.dx; h.y += h.on.mv.dy; }
  if (h.hurtT > 0) h.vx *= Math.exp(-5 * dt);
  else h.vx = I.mx * w.speed;
  if (I.mx && h.hurtT <= 0) h.face = Math.sign(I.mx);
  let push = 0;
  for (const z of w.winds ?? []) if (h.x > z.x0 && h.x < z.x1 && h.y > z.y0 && h.y < z.y1) { push += z.vx; if (I.mx && Math.sign(I.mx) !== Math.sign(z.vx)) h.braceT = 0.15; }
  if (I.jumpP) h.buf = 0.13;
  h.buf -= dt; h.coyote -= dt;
  if (h.buf > 0 && (h.ground || h.coyote > 0) && h.hurtT <= 0) {
    h.vy = -w.jumpV; h.ground = false; h.coyote = 0; h.buf = 0; h.on = null;
    sfx(g, 'jump');
  }
  if (!I.jumpH && h.vy < -w.jumpV * 0.45 && h.hurtT <= 0 && h.rideT <= 0) h.vy = -w.jumpV * 0.45;
  h.vy = Math.min(h.vy + w.grav * dt, 1500);
  // updrafts lift you while you are in the column
  h.rideT = Math.max(0, h.rideT - dt);
  for (const v of w.vents ?? []) if (Math.abs(h.x - v.x) < 60 && h.y <= v.y + 6 && h.y > v.top - 40) {
    h.vy = Math.max(h.vy - 4200 * dt, h.y > v.top ? -560 : -60); h.ground = false; h.on = null; h.rideT = 0.25;
  }
  // gliding: hold jump while falling (with assist on, it opens by itself over open sky)
  h.glide = false;
  if (w.id === 'cloud' && !h.ground && h.vy > 0 && h.hurtT <= 0 && h.rideT <= 0 && (I.jumpH || (g.assist && !groundBelow(w, h.x, h.y)))) { h.vy = Math.min(h.vy, 150); h.glide = true; }
  const S = solidsOf(g, w);
  h.x += (h.vx + push) * dt;
  h.blockedT = Math.max(0, h.blockedT - dt);
  for (const s of S) {
    if (h.y > s.y0 + 6 && h.y - HB.h < s.y1 && h.x + HB.w > s.x0 && h.x - HB.w < s.x1) {
      h.x = h.x < (s.x0 + s.x1) / 2 ? s.x0 - HB.w : s.x1 + HB.w;
      if (s.id === 'static') hurt(g, h, s.x0 + 10);
      h.blockedT = 0.2;
    }
  }
  const wasGround = h.ground, oldY = h.y;
  h.ground = false; h.on = null;
  let ny = h.y + h.vy * dt;
  for (const s of S) {
    if (h.x + HB.w - 6 > s.x0 && h.x - HB.w + 6 < s.x1) {
      if (h.vy >= 0 && h.y <= s.y0 + 0.5 && ny >= s.y0) { ny = s.y0; h.vy = 0; h.ground = true; h.on = s; }
      else if (h.vy < 0 && h.y - HB.h >= s.y1 && ny - HB.h < s.y1) { ny = s.y1 + HB.h; h.vy = 0; }
    }
  }
  if (h.vy >= 0) for (const p of platsOf(w)) {
    const mg = p.mv ? catchMargin(g) : 0;   // moving platforms catch a near miss
    if (h.x + HB.w * 0.6 + mg > p.x0 && h.x - HB.w * 0.6 - mg < p.x1 && oldY <= p.y + 3 + (p.mv ? Math.abs(p.mv.dy) : 0) && ny >= p.y) { ny = p.y; h.vy = 0; h.ground = true; h.on = p; if (mg) h.x = clamp(h.x, p.x0 + 10, p.x1 - 10); }
  }
  if (ny >= w.floor) { ny = w.floor; h.vy = 0; h.ground = true; }
  h.y = ny;
  if (h.ground && !wasGround) { h.landT = 0.12; spark(g, w.id, h.x, h.y, 5, 'rgba(255,230,190,.6)', 90, 0.35, 4); }
  if (!h.ground && wasGround && h.vy >= 0) h.coyote = 0.1;
  h.x = clamp(h.x, 34, w.W - 34);
  // remember the last safe footing (not moving, not over the pit) to come back to after a fall
  if (h.ground && h.hurtT <= 0 && !(h.on && h.on.mv) && !(w.pit && h.x > w.pit.x0 - 30 && h.x < w.pit.x1 + 30)) {
    g.safe = { x: h.x, y: h.y };
    if (!g.ckpt || g.ckpt.w !== w.id || h.x > g.ckpt.x) for (const cx of CHECKPOINTS[w.id] ?? []) if (h.x >= cx && (!g.ckpt || g.ckpt.w !== w.id || cx > g.ckpt.x)) g.ckpt = { w: w.id, x: h.x, y: h.y };
  }
  if (w.voidY && h.y > w.voidY) fallVoid(g, h, w);
}
/** with assist off, losing every heart starts you again from the last of these you passed, not the cabinet's door */
const CHECKPOINTS: Partial<Record<string, number[]>> = { castle: [1990, 3150], cloud: [1220, 2300, 3560, 4380, 5420] };

export function moveSwim(g: Game, h: Hero, w: World, I: Input, dt: number) {
  const mx = I.mx; let my = I.my;
  if (I.jumpH && my === 0) my = -1;
  if (h.hurtT > 0) { h.vx *= Math.exp(-4 * dt); h.vy *= Math.exp(-4 * dt); }
  else if (mx || my) { h.vx = mx * w.speed; h.vy = my * w.speed * 0.9; }
  else { h.vx *= Math.exp(-16 * dt); h.vy = lerp(h.vy, 20, 1 - Math.exp(-12 * dt)); }   // stop, then only a gentle sink
  if (mx && h.hurtT <= 0) h.face = Math.sign(mx);
  // currents carry you along; you can still swim across or against them
  let cx = 0, cy = 0; h.inCurrent = false;
  for (const c of w.currents) if (h.x > c.x0 && h.x < c.x1 && h.y > c.y0 && h.y < c.y1) { cx += c.vx; cy += c.vy; h.inCurrent = true; }
  const p = w.pillar;
  if (g.assist && p && p.open && (mx || h.vx)) {   // assist: ease the swimmer into the tunnel mouth
    const [pw, ph] = fsize('pillar');
    if (Math.abs(h.x - p.x) < pw * 1.4) { const ty = p.bottom - ph * (1 - TUNNEL.cy); h.y = lerp(h.y, ty, 1 - Math.exp(-6 * dt)); }
  }
  const S = solidsOf(g, w);
  h.x += (h.vx + cx) * dt;
  for (const s of S) {
    if (h.y + SB.h > s.y0 && h.y - SB.h < s.y1 && h.x + SB.w > s.x0 && h.x - SB.w < s.x1) {
      h.x = h.x < (s.x0 + s.x1) / 2 ? s.x0 - SB.w : s.x1 + SB.w;
      if (s.id === 'static') hurt(g, h, (s.x0 + s.x1) / 2);
    }
  }
  h.y += (h.vy + cy) * dt;
  for (const s of S) {
    if (h.y + SB.h > s.y0 && h.y - SB.h < s.y1 && h.x + SB.w > s.x0 && h.x - SB.w < s.x1) {
      h.y = h.y < (s.y0 + s.y1) / 2 ? s.y0 - SB.h : s.y1 + SB.h; h.vy = 0;
      if (s.id === 'static') hurt(g, h, (s.x0 + s.x1) / 2);
    }
  }
  h.x = clamp(h.x, 40, w.W - 40); h.y = clamp(h.y, w.top, w.bottom);
  if ((Math.abs(h.vx) + Math.abs(h.vy) > 100 || h.inCurrent) && rnd(g) < dt * 7) g.parts.push({ w: w.id, x: h.x - h.face * 30, y: h.y - 30, vx: rr(g, -20, 20), vy: -40, life: 1.4, max: 1.4, col: '#fff', size: rr(g, 3, 7), kind: 'bubble' });
}

// the partner walks the leader's own trail a little behind, so it never gets lost on platforms or in currents
export function followTrail(g: Game, f: Hero, L: Hero, w: World, dt: number) {
  const tr = L.trail, gap = w.kind === 'swim' ? 85 : 72;
  let pt = null;
  for (let i = tr.length - 12; i >= 0; i--) { const q = tr[i]; if (Math.hypot(q.x - L.x, q.y - L.y) >= gap) { pt = q; break; } }
  const ox = f.x, oy = f.y;
  if (pt) {
    const k = 1 - Math.exp(-12 * dt);
    f.x = lerp(f.x, pt.x, k); f.y = lerp(f.y, w.kind === 'swim' ? pt.y + 22 : pt.y, k);
  }
  const sp = Math.hypot(f.x - ox, f.y - oy) / Math.max(dt, 1e-3);
  f.vx = (f.x - ox) / Math.max(dt, 1e-3); f.vy = (f.y - oy) / Math.max(dt, 1e-3);
  if (pt && sp > 25) { f.f = pt.f; f.face = pt.face; f.ground = pt.g; }
  else { f.f = w.kind === 'swim' ? (Math.floor(f.animT * 2.5) % 2 ? 'tread2' : 'tread1') : (pt && !pt.g ? pt.f : 'idle'); if (!pt || pt.g) { f.ground = true; f.face = L.x >= f.x ? 1 : -1; } }
  if (Math.hypot(L.x - f.x, L.y - f.y) > 700) { f.x = L.x - L.face * gap; f.y = L.y; spark(g, w.id, f.x, f.y - 70, 12, '#fff2c0', 160, 0.6, 4); }
}

/** out of hearts (assist off): back to the last checkpoint passed in this world, or the cabinet's door */
function outOfHearts(g: Game) {
  g.hearts = 3; g.flash = 0.8;
  const c = g.ckpt && g.ckpt.w === g.world ? g.ckpt : entryOf(g, g.world);
  placeHeroes(g, g.world, c.x, c.y, 1);
  if (g.boss) g.boss.reset = true;
  ev(g, 'respawn');
}
export function hurt(g: Game, h: Hero, fromX: number) {
  if (h.invT > 0 || g.cut || g.trans) return;
  const w = W0(g);
  h.hurtT = 0.45; h.invT = 1.2;
  h.vx = (h.x < fromX ? -1 : 1) * 420;
  if (w.kind === 'land') { h.vy = -430; h.ground = false; h.on = null; } else h.vy = rr(g, -120, 120);
  g.shake = 0.25; sfx(g, 'hurt'); g.stats.hurts++; if (g.boss) g.stats.bossHurts++;
  spark(g, w.id, h.x, h.y - (w.kind === 'land' ? 80 : 0), 16, '#c9b8ff', 260, 0.6, 4, 'pix');
  ev(g, 'hurt ' + g.world);
  if (!g.assist) { g.hearts--; if (g.hearts <= 0) outOfHearts(g); }
}
// falling off a terrace or into the pit: a flash, and back to the last safe footing
export function fallVoid(g: Game, h: Hero, w: World) {
  g.stats.falls++; ev(g, 'fall ' + w.id); sfx(g, 'nope'); g.flash = 0.3;
  const s = g.safe || { x: w.spawn, y: w.spawnY || w.floor };
  placeHeroes(g, w.id, s.x, s.y, h.face);
  lead(g).invT = 1; spark(g, w.id, s.x, s.y - 80, 20, '#fff6d0', 220, 0.7, 5);
  if (!g.assist) { g.hearts--; if (g.hearts <= 0) outOfHearts(g); }
}

// ───────────── abilities: J uses the lead's own (or, with assist, whatever the moment needs), K is the gust
function smartAbility(g: Game): Ability | null {
  const need = abilityNeeds(g);
  let best: Ability | null = null, bd = 1e9;
  for (const k of ['ping', 'sweep', 'gust'] as const) if (g.abil[k] && need[k] < bd) { bd = need[k]; best = k; }
  if (best) return best;
  const own = lead(g).name === 'enzo' ? 'ping' : 'sweep';
  return g.abil[own] ? own : g.abil.gust ? 'gust' : g.abil.ping ? 'ping' : g.abil.sweep ? 'sweep' : null;
}
export function useAbility(g: Game, req?: Ability | null, smart = false) {
  const L = lead(g);
  const ab = req || (smart || g.assist ? smartAbility(g) : (L.name === 'enzo' ? 'ping' : 'sweep'));
  if (!ab || !g.abil[ab]) { L.reachT = 0.3; sfx(g, 'nope'); return; }
  const who = ab === 'ping' ? 'enzo' : ab === 'sweep' ? 'dora' : L.name;
  if (who !== L.name) {
    if (!g.assist && !smart) { L.reachT = 0.3; sfx(g, 'nope'); return; }
    swapHeroes(g);
  }
  const h = lead(g);
  if (h.abilT > 0 || h.gustT > 0) return;
  if (ab === 'ping') doPing(g); else if (ab === 'sweep') doSweep(g); else doGust(g);
}
export function doPing(g: Game) {
  const h = lead(g), w = W0(g);
  h.abilT = 0.55; g.stats.pings++; sfx(g, 'ping'); ev(g, 'ping');
  for (let k = 0; k < 3; k++) g.rings.push({ w: w.id, x: h.x + h.face * 10, y: heroMid(g, h) - 10, r: 0, d: k * 0.17, max: PING_R, hit: new Set() });
  for (let i = 0; i < 6; i++) g.parts.push({ w: w.id, x: h.x + rr(g, -40, 40), y: heroMid(g, h) + rr(g, -50, 20), vx: rr(g, -30, 30), vy: -50, life: 1.2, max: 1.2, col: '#fff', size: rr(g, 3, 6), kind: 'bubble' });
}
export function doSweep(g: Game) {
  const h = lead(g), w = W0(g);
  h.abilT = 0.5; g.stats.sweeps++; sfx(g, 'sweep'); ev(g, 'sweep');
  const cy = heroMid(g, h);
  g.arcs.push({ w: w.id, x: h.x + h.face * 30, y: cy, face: h.face, t: 0 });
  spark(g, w.id, h.x + h.face * 110, cy, 22, '#ffd77a', 260, 0.7, 5);
  const B = { x0: h.face > 0 ? h.x - 30 : h.x - 260, x1: h.face > 0 ? h.x + 260 : h.x + 30, y0: cy - 320, y1: cy + 170 };
  let n = 0;
  for (const st of w.statics) {
    if (!st.alive || st.guarded) continue;
    if (st.x1 > B.x0 && st.x0 < B.x1 && st.y1 > B.y0 && st.y0 < B.y1) { st.alive = false; st.dis = 0; st.delay = Math.abs((st.x0 + st.x1) / 2 - h.x) / 900; n++; }
  }
  if (n) { sfx(g, 'dissolve'); g.shake = 0.18; ev(g, 'clear ' + n); }
  sweepHit(g, w, B, n);
}
export function doGust(g: Game) {
  const h = lead(g), w = W0(g);
  h.gustT = 0.6; g.stats.gusts++; sfx(g, 'gust'); ev(g, 'gust');
  const cy = heroMid(g, h);
  g.gusts.push({ w: w.id, x: h.x + h.face * 40, y: cy, face: h.face, t: 0 });
  const B = { x0: h.face > 0 ? h.x - 20 : h.x - GUST_R, x1: h.face > 0 ? h.x + GUST_R : h.x + 20, y0: cy - 200, y1: cy + 170 };
  for (const st of w.statics) {   // loose Static (not the walls) is blown away
    if (!st.alive || st.solid || st.guarded) continue;
    if (st.x1 > B.x0 && st.x0 < B.x1 && st.y1 > B.y0 && st.y0 < B.y1 && w.id !== 'castle') { st.alive = false; st.blown = h.face; st.dis = 0; st.delay = 0; }
  }
  gustHit(g, w, B, h.face);
}
export function updRings(g: Game, dt: number) {
  const w = W0(g);
  for (const r of g.rings) {
    if (r.d > 0) { r.d -= dt; continue; }
    r.r += 780 * dt;
    if (r.w !== w.id) continue;
    ringHit(g, w, r, (x, y) => Math.hypot(x - r.x, y - r.y) <= r.r);
  }
  g.rings = g.rings.filter((r) => r.r < r.max);
  for (const q of g.gusts) q.t += dt;
  g.gusts = g.gusts.filter((q) => q.t < 0.7);
}

export function swapHeroes(g: Game) {
  const a = lead(g), b = partner(g);
  g.lead = b.name; g.stats.swaps++; sfx(g, 'swap'); b.invT = Math.max(b.invT, 0.6);
  const w = W0(g);
  if (w.kind === 'land') { b.vy = 0; b.ground = a.ground; b.on = a.on; if (!a.ground || w.voidY || Math.abs(b.y - a.y) > 4) { b.x = a.x; b.y = a.y; b.vy = a.vy; b.face = a.face; } }
  spark(g, g.world, b.x, heroMid(g, b), 14, '#fff2c0', 180, 0.5, 4);
  b.trail = []; a.trail = [];
}
