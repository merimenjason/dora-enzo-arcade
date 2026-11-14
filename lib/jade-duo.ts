// Jade Street: both chinchillas, always together. You control one hero; the other is your partner, who follows on the
// flow fields (keeping a step behind and to the side, running to catch up, hopping what blocks them, climbing the
// ladders after you), hops onto your ride as the passenger, hides when you hide and cheers when things go well. A
// partner who is ever stuck or left far behind pops back beside you (or into your passenger seat). Tab switches who
// you control; the camera eases across. Missions can post the partner somewhere (to hold a lever, wait at a relay
// point, guard a flank); the F key asks for a tag-team move (lib/jade-tag.ts). With a second player the partner is
// theirs to drive, and a leash keeps the two of you on one screen. Pure engine, no DOM.
import { T, W, S, F_ROOF } from './jade-city.js';
import { drive, overlapping, FOOT } from './jade-move.js';
import { downhill, los, nearestFree } from './jade-nav.js';
import { dist, angDiff } from './jade-rng.js';
import type { World, Player, Input, Ride } from './jade-game.js';

export type MateMode = 'follow' | 'stay' | 'post' | 'hold' | 'distract' | 'pounce' | 'guard';
export type MateAI = { mode: MateMode; at: [number, number] | null; t: number; stuck: number; best: number; offT: number; tgt: number; holding: boolean; dur: number; story: boolean };
export const newAI = (): MateAI => ({ mode: 'follow', at: null, t: 0, stuck: 0, best: 1e9, offT: 0, tgt: 0, holding: false, dur: 0, story: false });
/** the camera sees about this far either side; a partner further than this for a moment is brought back */
export const OFFSCREEN = 1150;
/** the second player's leash: how far apart the two heroes may be, across and up/down */
export const LEASH = { x: 1050, y: 600 };

/** the partner's own step: AI in one-player games, nothing here in two-player (they drive themselves) */
export function mateStep(w: World, dt: number) {
  const m = w.mate, p = w.p, ai = m.ai;
  m.animT += dt; m.dashCd = Math.max(0, m.dashCd - dt); m.bumpT = Math.max(0, m.bumpT - dt); m.stunT = Math.max(0, m.stunT - dt); m.grabT = Math.max(0, m.grabT - dt);
  if (m.seat) return seatStep(w, m, dt);
  if (m.act) { m.act.t += dt; m.anim = m.act.n; if (m.act.t >= m.act.dur) { const f = m.act.then; m.act = null; f?.(); } return; }
  if (m.ride) { // left on a ride of their own after a switch: hop off to follow, or sit tight when told to wait
    if (ai.mode === 'follow') getOff(w, m); else { m.anim = 'ride'; m.b.x = m.ride.b.x; m.b.y = m.ride.b.y; m.ride.b.speed *= 0.9; }
    return;
  }
  if (m.hide && !(p.hide && ai.mode === 'follow')) { m.hide = false; m.act = { n: 'climb-off', t: 0, dur: 0.25 }; return; }
  if (m.hide) { m.anim = 'hide'; return; }
  if (m.hopT > 0) m.hopT -= dt;
  const d = dist(m.x, m.y, p.x, p.y);
  // waiting partners come back to you once you are close again (unless a job posted them)
  if (ai.mode === 'stay' && !ai.story && d < 220) ai.mode = 'follow';
  let goal: [number, number] | null = null, speed = FOOT.run, sneak = p.sneak && !p.ride;
  switch (ai.mode) {
    case 'follow': {
      if (lost(w, m, d, dt)) return;
      if (p.hide) { if (d < 30) { m.act = { n: 'enter-door', t: 0, dur: 0.3, then: () => { m.hide = true; m.b.x = p.b.x + 16; m.b.y = p.b.y + 4; w.fx.push({ t: 'hide', x: m.b.x, y: m.b.y }); } }; return; } goal = [p.b.x + 16, p.b.y + 4]; break; }
      if (p.ride) { // hop on as the passenger when the ride is close and slow enough
        const r = p.ride;
        if (d < 110 && r.b.speed < 140 && !p.act) { board(w, m, r); return; }
        goal = [r.b.x, r.b.y]; speed = FOOT.run * 1.12; sneak = false; break;
      }
      if (p.roof !== m.roof) { goal = ladderGoal(w, m, p.roof); if (!goal) { catchUp(w, m); return; } if (dist(m.x, m.y, goal[0], goal[1]) < 40) { climb(w, m, p.roof); return; } break; }
      const h = p.b.speed > 20 ? p.b.h : Math.atan2(m.y - p.y, m.x - p.x) + Math.PI;
      goal = [p.b.x - Math.cos(h) * 54 + Math.cos(h + Math.PI / 2) * 22, p.b.y - Math.sin(h) * 54 + Math.sin(h + Math.PI / 2) * 22];
      if (d < 70) { idle(w, m, p.x, p.y, sneak); return; }
      speed = d > 200 ? FOOT.run * 1.1 : d > 110 ? FOOT.run : sneak ? FOOT.walk : FOOT.run * 0.8;
      break;
    }
    case 'stay': case 'post': case 'hold': case 'guard': {
      goal = ai.at; if (!goal) { ai.mode = 'follow'; return; }
      if (ai.mode === 'guard') { const g = w.run?.guardGoal(m); if (g) { goal = g; speed = FOOT.run * 1.05; } }
      const near = dist(m.x, m.y, goal[0], goal[1]);
      const wantRoof = ai.mode === 'post' && w.run?.postRoof(goal) === true;
      if (wantRoof !== m.roof) { const lg = ladderGoal(w, m, wantRoof); if (!lg) { m.roof = wantRoof; m.b.x = goal[0]; m.b.y = goal[1]; return; } if (dist(m.x, m.y, lg[0], lg[1]) < 40) { climb(w, m, wantRoof); return; } goal = lg; break; }
      if (near < (ai.mode === 'hold' ? 20 : 26)) {
        if (ai.mode === 'hold') { if (!ai.holding) w.fx.push({ t: 'hold', x: m.x, y: m.y }); ai.holding = true; m.anim = w.run?.holdAnim() ?? 'hold'; m.b.speed = 0; m.face = 'down'; return; }
        idle(w, m, p.x, p.y, false); return;
      }
      if (ai.mode === 'hold' && ai.holding) { ai.holding = false; w.fx.push({ t: 'let-go', x: m.x, y: m.y }); }
      if (ai.mode !== 'guard' && near > OFFSCREEN * 1.6 && dist(goal[0], goal[1], p.x, p.y) > OFFSCREEN) { m.b.x = goal[0]; m.b.y = goal[1]; return; }
      break;
    }
    case 'distract': {
      ai.t += dt; goal = ai.at;
      if (!goal || ai.t > ai.dur) { ai.mode = 'follow'; ai.t = 0; return; }
      if (dist(m.x, m.y, goal[0], goal[1]) < 30) { m.anim = 'distract'; m.b.speed = 0; m.face = 'down'; ai.holding = true; return; }
      ai.holding = false; speed = FOOT.run * 1.1; break;
    }
    case 'pounce': {
      ai.t += dt; const a = w.pounceTarget(ai.tgt);
      if (!a || ai.t > 0.55) { ai.mode = 'follow'; ai.t = 0; return; }
      const dx = a[0] - m.b.x, dy = a[1] - m.b.y, l = Math.hypot(dx, dy) || 1;
      drive(w.ctx(m.roof, false), m.b, dx / l, dy / l, FOOT.dash, 4000, 40, dt, true);
      m.dashT = 0.1; m.anim = 'pounce'; faceFrom(m, Math.atan2(dy, dx));
      return;
    }
  }
  if (!goal) return;
  moveTo(w, m, goal, speed, sneak, dt);
}

/** walk or run to a point: straight when the way is clear, on the flow field otherwise; hop what blocks you */
function moveTo(w: World, m: Player, goal: [number, number], speed: number, sneak: boolean, dt: number) {
  let [gx, gy] = goal; const d = dist(m.x, m.y, gx, gy);
  if (!m.roof && (d > T * 1.3 || !los(w.c, m.x, m.y, gx, gy))) { const f = w.fieldTo('walk', gx, gy); const n = downhill(w.c, f, m.b.x, m.b.y, w.open); if (n) { gx = n[0]; gy = n[1]; } }
  const dx = gx - m.b.x, dy = gy - m.b.y, l = Math.hypot(dx, dy) || 1;
  // on the roofs a gap ahead is hopped
  if (m.roof && m.hopT <= 0) { const ax = m.b.x + dx / l * 40, ay = m.b.y + dy / l * 40; if (!(w.c.flags[Math.floor(ay / T) * W + Math.floor(ax / T)] & F_ROOF)) m.hopT = FOOT.hopT; }
  // a crate, bench or hedge on the street: hop it
  if (!m.roof && m.hopT <= 0) { const ax = m.b.x + dx / l * 30, ay = m.b.y + dy / l * 30; if (w.c.solid[Math.floor(ay / T) * W + Math.floor(ax / T)] === S.LOW) m.hopT = FOOT.hopT; }
  const ox = m.b.x, oy = m.b.y;
  drive(w.ctx(m.roof, m.hopT > 0), m.b, dx / l, dy / l, m.hopT > 0 ? Math.max(speed, 230) : Math.min(speed, 40 + d * 3), 2400, 30, dt, true);
  if (m.roof && m.hopT <= 0 && !(w.c.flags[Math.floor(m.b.y / T) * W + Math.floor(m.b.x / T)] & F_ROOF)) { m.b.x = ox; m.b.y = oy; }
  if (!m.roof && m.hopT <= 0 && overlapping(w.ctx(false, false), m.b)) { const [x, y] = nearestFree(w.c, 'walk', m.b.x, m.b.y, w.open, 2); m.b.x = x; m.b.y = y; }
  if (m.b.speed > 8) faceFrom(m, m.b.h);
  m.sneak = sneak;
  m.anim = m.hopT > 0 ? 'hop' : m.b.speed < 8 ? 'idle' : sneak ? 'sneak' : m.b.speed > FOOT.walk + 10 ? 'run' : 'walk';
}
function idle(w: World, m: Player, lx: number, ly: number, sneak: boolean) {
  m.b.speed = 0; m.sneak = sneak;
  if (m.fireT > 0) { m.anim = 'fire'; return; }
  m.anim = m.reloadT > 0 ? 'reload' : 'idle';
  if (dist(lx, ly, m.x, m.y) > 4) faceFrom(m, Math.atan2(ly - m.y, lx - m.x));
}
export function faceFrom(p: Player, h: number) {
  const cx = Math.cos(h), sy = Math.sin(h);
  if (Math.abs(cx) > Math.abs(sy) * 0.9) { p.face = 'side'; p.flip = cx < 0; } else { p.face = sy > 0 ? 'down' : 'up'; }
}

/** never stuck, never lost: a partner who can't get closer for a few seconds, or who is far off screen, catches up */
function lost(w: World, m: Player, d: number, dt: number): boolean {
  const ai = m.ai;
  if (d < ai.best - 6) { ai.best = d; ai.stuck = 0; } else ai.stuck += dt;
  if (d < 90) { ai.best = d; ai.stuck = 0; }
  ai.offT = d > OFFSCREEN ? ai.offT + dt : 0;
  if (ai.stuck > 1.6 && d > 130 && m.hopT <= 0) { m.hopT = FOOT.hopT; }
  if (ai.offT > 0.8 || (ai.stuck > 3.2 && d > 130)) { catchUp(w, m); return true; }
  return false;
}
/** pop back beside the active hero: into the passenger seat on a ride, onto the roof, or a step behind */
export function catchUp(w: World, m: Player) {
  const p = w.p; m.ai.stuck = 0; m.ai.offT = 0; m.ai.best = 1e9; m.hide = false; m.act = null;
  if (m.ride) { m.ride.parked = true; m.ride.b.speed = 0; m.ride = null; }
  if (p.ride) { seat(w, m, p.ride); w.fx.push({ t: 'mate-catchup', x: p.x, y: p.y }); return; }
  m.roof = p.roof;
  const h = p.b.h;
  if (p.roof) { m.b.x = p.b.x; m.b.y = p.b.y; m.lastRoof = [p.b.x, p.b.y]; }
  else { const [x, y] = nearestFree(w.c, 'walk', p.b.x - Math.cos(h) * 50, p.b.y - Math.sin(h) * 50, w.open, 3); m.b.x = x; m.b.y = y; }
  m.b.speed = 0; m.b.h = h; m.anim = 'hop'; m.hopT = 0.2;
  w.fx.push({ t: 'mate-catchup', x: m.b.x, y: m.b.y });
}

// ── rides: the passenger seat
export function board(w: World, m: Player, r: Ride) {
  m.act = { n: 'climb-on', t: 0, dur: 0.28, then: () => { seat(w, m, r); } };
  m.face = 'side'; m.flip = r.b.x < m.b.x;
}
export function seat(w: World, m: Player, r: Ride) {
  m.seat = r; m.hide = false; m.roof = false; m.b.x = r.b.x; m.b.y = r.b.y; m.b.speed = 0; m.act = null; m.anim = 'pass';
  w.fx.push({ t: 'board', kind: r.kind, name: m.who });
}
function seatStep(w: World, m: Player, dt: number) {
  const r = m.seat!; m.b.x = r.b.x; m.b.y = r.b.y; m.b.h = r.b.h;
  // the driver got off (or swapped rides): the passenger hops off too
  const driver = w.p.ride === r ? w.p : w.mate.ride === r ? w.mate : null;
  if (!driver && !w.two) { leaveSeat(w, m); return; }
  if (m.act) { m.act.t += dt; if (m.act.t >= m.act.dur) { const f = m.act.then; m.act = null; f?.(); } }
  m.anim = m.fireT > 0 ? 'pass-aim' : m.grabT > 0 ? 'pass-grab' : m.reloadT > 0 ? 'pass-duck' : m.cheerT > 0 ? 'pass-cheer' : r.b.speed > 260 ? 'pass-hold' : 'pass';
  m.cheerT = Math.max(0, m.cheerT - dt);
}
export function leaveSeat(w: World, m: Player) {
  const r = m.seat; if (!r) return; m.seat = null;
  const side = r.b.h - Math.PI / 2;
  const [x, y] = nearestFree(w.c, 'walk', r.b.x + Math.cos(side) * (r.b.r + 18), r.b.y + Math.sin(side) * (r.b.r + 18), w.open, 3);
  m.b.x = x; m.b.y = y; m.b.speed = 0; m.b.h = r.b.h; m.act = { n: 'climb-off', t: 0, dur: 0.3 };
}
function getOff(w: World, m: Player) {
  const r = m.ride!; r.parked = true; r.b.speed = 0; m.ride = null;
  const side = r.b.h + Math.PI / 2;
  const [x, y] = nearestFree(w.c, 'walk', r.b.x + Math.cos(side) * (r.b.r + 18), r.b.y + Math.sin(side) * (r.b.r + 18), w.open, 3);
  m.b.x = x; m.b.y = y; m.act = { n: 'climb-off', t: 0, dur: 0.3 };
}

// ── ladders between the street and the roofs
function ladderGoal(w: World, m: Player, up: boolean): [number, number] | null {
  let best: [number, number] | null = null, bd = 1e9;
  for (const l of w.c.ladders) { const [x, y] = up ? [l.x * T + T / 2, l.y * T + T / 2] : [l.rx * T + T / 2, l.ry * T + T / 2]; const d = dist(x, y, m.x, m.y); if (d < bd) { bd = d; best = [x, y]; } }
  return bd < 1400 ? best : null;
}
function climb(w: World, m: Player, up: boolean) {
  const l = w.c.ladders.reduce((a, b) => { const da = up ? dist(a.x * T, a.y * T, m.x, m.y) : dist(a.rx * T, a.ry * T, m.x, m.y), db = up ? dist(b.x * T, b.y * T, m.x, m.y) : dist(b.rx * T, b.ry * T, m.x, m.y); return da <= db ? a : b; });
  m.act = { n: 'climb', t: 0, dur: 0.45, then: () => { m.roof = up; if (up) { m.b.x = l.rx * T + T / 2; m.b.y = l.ry * T + T / 2; m.lastRoof = [m.b.x, m.b.y]; } else { m.b.x = l.x * T + T / 2; m.b.y = l.y * T + T / 2; } } };
}

// ── switching who you control
export function canSwitch(w: World): string | null {
  if (w.two) return 'Two players: each of you plays one hero';
  if (w.talk || w.ui || w.failed) return 'busy';
  if (w.p.act || w.mate.act) return 'busy';
  if (w.run?.noSwitch()) return w.run.noSwitch();
  return null;
}
export function switchHero(w: World): boolean {
  const why = canSwitch(w); if (why) { if (why !== 'busy') w.say(why, 'bad'); return false; }
  const a = w.p, b = w.mate;
  const together = dist(a.x, a.y, b.x, b.y) < 420 && a.roof === b.roof;
  // sharing a ride: the passenger takes the handlebars
  if (a.ride && b.seat === a.ride) { const r = a.ride; a.ride = null; b.seat = null; b.ride = r; a.seat = r; }
  else if (a.ride) a.ride.b.speed = 0;
  if (a.hide) { a.hide = true; }
  w.p = b; w.mate = a; w.s.hero = b.who;
  // the hero you leave keeps doing what they were told; one who was simply with you keeps following
  const posted = b.ai.story && (b.ai.mode === 'post' || b.ai.mode === 'hold' || b.ai.mode === 'guard');
  a.ai = { ...a.ai, mode: together && !posted ? 'follow' : 'stay', at: [a.x, a.y], story: posted, holding: false, t: 0, stuck: 0, best: 1e9, offT: 0 };
  if (posted && b.ai.at) { a.ai.at = b.ai.at; a.ai.mode = b.ai.mode === 'hold' ? 'hold' : 'post'; }
  b.ai = { ...b.ai, mode: 'follow', story: false, holding: false };
  b.sneak = false; b.dashT = 0;
  w.fx.push({ t: 'switch', name: b.who, x: b.x, y: b.y });
  w.run?.onSwitch();
  return true;
}

// ── two players: the second hero is driven by the second player; the leash keeps you on one screen
export function leash(w: World) {
  if (!w.two) return;
  const a = w.p, b = w.mate; if (b.seat || a.seat) return;
  const ab = a.ride ? a.ride.b : a.b, bb = b.ride ? b.ride.b : b.b;
  for (const [axis, lim] of [['x', LEASH.x], ['y', LEASH.y]] as const) {
    const d = bb[axis] - ab[axis], ex = Math.abs(d) - lim; if (ex <= 0) continue;
    const s = Math.sign(d);
    // pull back whoever is moving away; if both are, half each
    const va = (axis === 'x' ? Math.cos(ab.h) : Math.sin(ab.h)) * ab.speed * -s, vb = (axis === 'x' ? Math.cos(bb.h) : Math.sin(bb.h)) * bb.speed * s;
    const ka = va > 5 && vb > 5 ? 0.5 : va > vb ? 1 : 0;
    ab[axis] += s * ex * ka; bb[axis] -= s * ex * (1 - ka);
    if (ab === a.b && !a.ride) { if (overlapping(w.ctx(a.roof, false), ab)) ab[axis] -= s * ex * ka; }
    w.leashT = 0.6;
  }
  void angDiff;
}
/** the second player's input steers the partner; with no second player it is AI */
export function applyTwo(w: World, on: boolean) {
  if (on === w.two) return;
  w.two = on;
  const m = w.mate; m.ai = { ...m.ai, mode: 'follow', story: false };
  if (on && dist(m.x, m.y, w.p.x, w.p.y) > LEASH.x) catchUp(w, m);
  w.fx.push({ t: on ? 'p2-join' : 'p2-leave', name: m.who });
}
export type { Input };
