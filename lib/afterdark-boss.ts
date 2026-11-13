// The Arcade After Dark: the finale. The Static gathers into a giant in the hub. Ping to find its heart, gust to scatter
// it, sweep the bare heart. Three times. Tells are wordless: a ground ring fills where a fist will land (the first one
// slowly), and a bubble over its head shows the hero (and ability) that is needed now. Ported from boss.js.
import { fsize, type Ability } from './afterdark-worlds.js';
import { type Game, type Ring, type Boss, lead, partner, sfx, ev, spark, rnd, rr, clamp } from './afterdark-core.js';
import { hurt } from './afterdark-move.js';
import { free, type Box } from './afterdark-things.js';

export function startBoss(g: Game) {
  g.boss = { x: 1010, hp: 3, phase: 'intro', pt: 0, atk: null, next: 2.2, slams: 0, waves: [], fr: 'g-roar', ft: 1.4, push: 0, reset: false };
  for (const h of [lead(g), partner(g)]) h.aweT = 1;
  ev(g, 'BOSS start');
}
function bossPhase(B: Boss, p: Boss['phase']) { B.phase = p; B.pt = 0; }
export function bossNeed(g: Game): Ability | null {
  const B = g.boss; if (!B) return null;
  return ({ shroud: 'ping', core: 'gust', scatter: 'sweep' } as Partial<Record<Boss['phase'], Ability>>)[B.phase] ?? null;
}
export function updBoss(g: Game, dt: number) {
  const B = g.boss!, h = lead(g);
  B.pt += dt; B.ft = Math.max(0, B.ft - dt);
  if (B.reset) { B.reset = false; B.atk = null; B.waves = []; bossPhase(B, 'shroud'); B.next = 2; }
  if (B.phase === 'intro') { if (B.pt > 1.6) { bossPhase(B, 'shroud'); B.next = 1.2; } return; }
  if (B.phase === 'dead') {
    if (rnd(g) < dt * 40) g.parts.push({ w: 'hub', x: B.x + rr(g, -200, 160), y: rr(g, 200, 640), vx: rr(g, -30, 30), vy: rr(g, -160, -60), life: 1.4, max: 1.4, col: rnd(g) < 0.5 ? '#ffd98a' : '#fff4d0', size: rr(g, 3, 7), kind: 'pix' });
    if (B.pt > 2.4) { g.boss = null; g.flags.boss = true; g.stats.tBoss = g.playT; ev(g, 'BOSS down'); g.cut = { kind: 'heal', t: 0, dur: 6.5 }; }
    return;
  }
  if (B.phase === 'stagger' && B.pt > 1.4) { if (B.hp <= 0) { bossPhase(B, 'dead'); sfx(g, 'dissolve'); sfx(g, 'heal'); } else { bossPhase(B, 'reform'); sfx(g, 'roar'); } }
  if (B.phase === 'reform' && B.pt > 0.9) { bossPhase(B, 'shroud'); B.next = 1.3; }
  if (B.phase === 'scatter' && B.pt > 6) { bossPhase(B, 'reform'); B.unshroud = true; }
  if (B.phase === 'shroud' && B.unshroud && B.pt > 0) { B.unshroud = false; bossPhase(B, 'core'); }
  const active = B.phase === 'shroud' || B.phase === 'core';
  // attacks: a fist slam on a filling ground ring; from the second heart on, the slam also sends a Static wave to jump
  if (active && !B.atk) {
    B.next -= dt;
    if (B.next <= 0) {
      const roar = B.hp === 1 && B.slams % 3 === 2;
      const tell = B.slams === 0 ? 2.0 : B.hp === 3 ? 1.3 : B.hp === 2 ? 1.1 : 0.95;
      B.atk = roar ? { kind: 'roar', t: 0, tell: 0.9 } : { kind: 'slam', t: 0, tell, x: clamp(h.x, 110, B.x - 240) };
      sfx(g, roar ? 'roar' : 'tell');
    }
  }
  if (B.atk) {
    const A = B.atk; A.t += dt;
    if (A.kind === 'slam' && A.t >= A.tell && !A.hit) {
      A.hit = true; B.fr = 'g-slam'; B.ft = 0.5; g.shake = 0.35; sfx(g, 'slam'); B.slams++;
      spark(g, 'hub', A.x!, 640, 30, '#c9b8ff', 320, 0.7, 5, 'pix');
      if (Math.abs(h.x - A.x!) < 120 && h.y > 520) hurt(g, h, A.x! + (h.x < A.x! ? 1 : -1));
      if (B.hp <= 2) { B.waves.push({ x: A.x! - 20, dir: -1 }); if (A.x! < B.x - 400) B.waves.push({ x: A.x! + 20, dir: 1 }); }
    }
    if (A.kind === 'roar' && A.t >= A.tell && !A.hit) { A.hit = true; B.push = 1.5; B.slams++; g.shake = 0.3; }
    if (A.t >= A.tell + 0.7) { B.atk = null; B.next = B.hp === 3 ? 1.8 : 1.4; }
  }
  if (B.push > 0) {   // the roar's wind shoves the heroes back; they brace
    B.push -= dt;
    if (free(g)) { h.x = Math.max(60, h.x - 230 * dt); h.braceT = 0.15; h.face = 1; partner(g).braceT = 0.15; }
  }
  for (const v of B.waves) {
    v.x += v.dir * 400 * dt;
    if (free(g) && Math.abs(h.x - v.x) < 34 && h.y > 585) hurt(g, h, v.x - v.dir * 10);
    if (rnd(g) < 0.5) spark(g, 'hub', v.x, 630, 1, '#c9b8ff', 60, 0.3, 3, 'pix');
  }
  B.waves = B.waves.filter((v) => v.x > -60 && v.x < B.x - 120);
  // touching the giant stings; while it is scattered you can walk right up to its heart
  if (B.phase !== 'scatter' && free(g) && h.x > B.x - 210) { hurt(g, h, B.x); h.x = Math.min(h.x, B.x - 210); }
  if (B.phase === 'scatter') h.x = Math.min(h.x, B.x + 60);
  // frames
  if (B.ft <= 0) {
    if (B.atk && B.atk.kind === 'slam' && !B.atk.hit) B.fr = 'g-raise';
    else if (B.atk && B.atk.kind === 'roar') B.fr = 'g-roar';
    else B.fr = ({ shroud: Math.floor(g.time * 1.6) % 2 ? 'g-idle2' : 'g-idle1', core: 'g-flinch', scatter: 'g-scatter', stagger: 'g-stagger', reform: 'g-reform', dead: 'g-dissolve' } as Record<string, string>)[B.phase] || 'g-idle1';
  }
}
export function bossCore(B: Boss) { const [, fh] = fsize('g-idle1'); return { x: B.x - 40, y: 640 - fh * 0.5 }; }
export function bossRing(g: Game, r: Ring, near: (x: number, y: number) => boolean) {
  const B = g.boss!;
  if (B.phase === 'shroud' && !r.hit.has(B) && near(B.x - 60, 430)) { r.hit.add(B); bossPhase(B, 'core'); B.fr = 'g-flinch'; B.ft = 0.6; sfx(g, 'reveal'); g.shake = 0.2; ev(g, 'boss pinged'); B.atk = null; B.next = 1.6; }
}
export function bossGust(g: Game, Bx: Box) {
  const B = g.boss!;
  if (B.phase === 'core' && Bx.x1 > B.x - 280 && Bx.x0 < B.x + 100) {
    bossPhase(B, 'scatter'); B.atk = null; B.waves = []; sfx(g, 'whoosh'); g.shake = 0.3; ev(g, 'boss scattered');
    const c = bossCore(B); spark(g, 'hub', c.x, c.y, 40, '#c9b8ff', 420, 0.9, 5, 'pix');
  }
}
export function bossSweep(g: Game, Bx: Box) {
  const B = g.boss!;
  if (B.phase !== 'scatter') return;
  const c = bossCore(B);
  if (c.x > Bx.x0 - 40 && c.x < Bx.x1 + 40 && c.y > Bx.y0 && c.y < Bx.y1) {
    B.hp--; g.stats.bossHits++; bossPhase(B, 'stagger'); B.fr = 'g-stagger'; B.ft = 0; sfx(g, 'dissolve'); g.shake = 0.4; g.flash = 0.25;
    spark(g, 'hub', c.x, c.y, 50, '#ffd77a', 360, 1, 6); ev(g, 'boss hit ' + B.hp);
  }
}
