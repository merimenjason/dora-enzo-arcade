// Jade Street: the jobs that need both heroes, and what gadgets do to the people in a job. New steps: `post` (send
// the partner somewhere: to wait, to hold, to guard), `switch` (take over the other hero), `hold` (the partner holds
// a lever while you go through the gate it opens), `boost` (lift the partner onto a roof), `bag` (knock a loot bag
// out of a crow's claws). Older steps learn new tricks: a chase can end with a double pounce, a passenger's grab
// or a net; a tail and a rooftop race hand over to the partner; escorts come at you from both flanks; the container
// yard's office shutter needs holding open; a window lookout can be painted over or distracted; Glint's float only
// swings under the flags while the partner hauls the bunting rope. Every one of them can be done without gadgets.
import { T, W } from './jade-city.js';
import { dist, angDiff, clamp } from './jade-rng.js';
import { nearestFree, los } from './jade-nav.js';
import type { Run, Actor } from './jade-mission.js';
import type { Step, Spot } from './jade-story.js';
import type { Player } from './jade-game.js';
import { nameOf, boostXY, distract, pounce, type TagOpt } from './jade-tag.js';
import { switchHero } from './jade-duo.js';
import type { GadgetId } from './jade-gear.js';

type St<K extends Step['t']> = Extract<Step, { t: K }>;
const xy = (run: Run, s: Spot) => run.spot(s);
/** the partner gets an order from the job */
export function postMate(run: Run, mode: 'post' | 'hold' | 'guard' | 'stay', at: [number, number]) {
  // Settings, partner Off: they wait rather than guard on their own
  if (mode === 'guard' && run.w.s.settings.partner === 'off' && !run.w.two) mode = 'stay';
  const m = run.w.mate; if (m.seat) leaveSeatQuiet(run, m);
  m.ai = { ...m.ai, mode, at, story: true, holding: false, t: 0, stuck: 0, best: 1e9, offT: 0 };
}
function leaveSeatQuiet(run: Run, m: Player) { const r = m.seat!; m.seat = null; const [x, y] = nearestFree(run.w.c, 'walk', r.b.x, r.b.y, run.w.open, 3); m.b.x = x; m.b.y = y; }
export function releaseMate(run: Run) { const m = run.w.mate; if (m.ai.story) m.ai = { ...m.ai, mode: 'follow', story: false, holding: false }; }
export const holding = (run: Run) => { const m = run.w.mate; return m.ai.mode === 'hold' && m.ai.holding; };

// ── entering and stepping the new steps
export function teamEnter(run: Run, st: Step): boolean {
  const w = run.w;
  switch (st.t) {
    case 'post': { const at = xy(run, st.at); postMate(run, st.mode ?? 'post', at); if (!st.wait) run.next(); return true; }
    case 'switch': { run.want = w.mate.who; if (w.two) { switchLead(run); run.next(); } return true; }
    case 'hold': { const k = (w.assist ? 1.4 : 1) * w.diff.timer; if (st.time) run.timer = st.time * k; return true; }
    case 'boost': return true;
    case 'bag': {
      const [x, y] = st.at === 'here' ? [run.here[0], run.here[1]] : xy(run, st.at);
      const a = run.actor('bagbird', x + 120, y, 'fly', [], 150); a.skin = st.skin; a.extra = 0; a.look = 3; a.face = 0; run.actors.push(a); run.base = x; run.count = y;
      run.progress = 'Bag 0/1'; w.fx.push({ t: 'caw' });
      // the sixteenth pass: with Coach Kerbau's job done, his dragon boat moored nearby is another way at the crow
      if (w.s.done.includes('k21') && w.rides.some(r => r.kind === 'dragon' && dist(r.b.x, r.b.y, x, y) < 1100)) w.say('Coach Kerbau’s dragon boat is moored on the lake: paddle out with the drum going and the crow can’t resist it.', 'good');
      if (st.time) run.timer = st.time * (w.assist ? 1.4 : 1) * w.diff.timer;
      return true;
    }
  }
  return false;
}
export function teamStep(run: Run, st: Step, dt: number): boolean {
  const w = run.w, p = w.p, m = w.mate;
  switch (st.t) {
    case 'post': if (dist(m.x, m.y, m.ai.at![0], m.ai.at![1]) < 50) run.next(); return true;
    case 'switch': if (p.who === run.want) run.next(); return true;
    case 'hold': {
      const [tx, ty] = xy(run, st.through), held = holding(run);
      const [lx, ly] = xy(run, st.lever);
      run.label = held ? st.label.split(':')[1]?.trim() || st.label : m.ai.mode === 'hold' ? `${nameOf(m.who)} is on the way to the lever…` : `Send ${nameOf(m.who)} to the lever (F near it)`;
      if (!held && m.ai.mode !== 'hold' && dist(p.x, p.y, lx, ly) > 900 && w.assist) postMate(run, 'hold', [lx, ly]);
      if (held && dist(p.x, p.y, tx, ty) < (st.r ?? 90)) { w.fx.push({ t: 'through', x: tx, y: ty }); releaseMate(run); run.next(); }
      return true;
    }
    case 'boost': if (m.roof) { run.next(); } else run.label = st.label; return true;
    case 'bag': bagStep(run, st, dt); return true;
  }
  return false;
}
/** tiles a job closes: the canal lock while nobody holds it */
export function teamGates(run: Run, gates: Set<number>) {
  const st = run.cur; if (!st || st.t !== 'hold' || holding(run)) return;
  for (const [x, y] of st.gate) gates.add(y * W + x);
}
/** the second player takes over in a switch step by becoming the lead */
function switchLead(run: Run) { const w = run.w; const a = w.p; w.p = w.mate; w.mate = a; w.s.hero = w.p.who; w.fx.push({ t: 'switch', name: w.p.who }); }

// ── the crow with the loot bag: it circles, swoops low now and then; knock the bag loose
function bagStep(run: Run, st: St<'bag'>, dt: number) {
  const w = run.w, a = run.actors.find(x => x.kind === 'bagbird'); if (!a) return;
  const p = w.p, pb = p.ride ? p.ride.b : p.b;
  // the sixteenth pass: a crewed dragon boat's drum draws the crow down twice as often (Jurong Lake, chapter 9)
  const drum = p.ride?.kind === 'dragon' && w.mate.seat === p.ride;
  a.t += dt; a.look -= dt * (drum ? 2 : 1);
  const cx = run.base, cy = run.count;
  if (a.stun > 0) { a.stun -= dt; a.b.x += Math.cos(a.b.h) * 60 * dt; return; }
  // circle over the spot; every few seconds swoop down low toward you for a moment
  if ((a.extra ?? 0) > 0) { a.extra = (a.extra ?? 0) - dt; if ((a.extra ?? 0) <= 0) a.look = w.assist ? 4.2 : 5.2; }
  else if (a.look <= 0) { a.extra = w.assist ? 2.2 : 1.6; w.fx.push({ t: 'swoop', x: a.b.x, y: a.b.y }); const who = st.skin ?? 'crow'; run.warn(drum ? `The drum brings the ${who} down! Surge into it (Space)!` : `The ${who} swoops low! Pounce or dash (Space) into it now!`); }
  const low = (a.extra ?? 0) > 0;
  const ang = a.t * 0.9, R = 150;
  const gx = low ? pb.x : cx + Math.cos(ang) * R, gy = low ? pb.y - 10 : cy + Math.sin(ang) * R * 0.7;
  const dx = gx - a.b.x, dy = gy - a.b.y, l = Math.hypot(dx, dy) || 1, sp = low ? 170 : 150;
  a.b.h = Math.atan2(dy, dx); a.b.x += dx / l * Math.min(l, sp * dt); a.b.y += dy / l * Math.min(l, sp * dt);
  // a low crow can be caught: a dash, a hop, a ride at speed, or the partner's pounce
  const d = dist(a.b.x, a.b.y, pb.x, pb.y);
  const hitting = p.ride ? pb.speed > 90 : (p.dashT > 0 || p.hopT > 0);
  const mateHit = w.mate.ai.mode === 'pounce' && dist(a.b.x, a.b.y, w.mate.b.x, w.mate.b.y) < 40;
  if (low && ((d < 40 + (w.assist ? 16 : 0) && hitting) || mateHit)) dropBag(run, a);
  if (run.timer !== null && run.timer < 10 && !run.warning) run.warn('The crow is about to fly off with the bag!');
  run.label = low ? 'It’s low: run into it and dash (Space), hop or pounce!' : st.label;
}
export function dropBag(run: Run, a: Actor) {
  const w = run.w; if (a.gone) return;
  a.gone = true; const [x, y] = nearestFree(w.c, 'foot', a.b.x, a.b.y + 20, w.open, 3);
  const st = run.cur as St<'bag'>;
  run.loot = { x, y, sprite: st.loot ?? 'loot-bag' };
  w.fx.push({ t: 'hit', x: a.b.x, y: a.b.y, kind: 'feather' }); w.fx.push({ t: 'loot', x, y, kind: (st.loot ?? '').startsWith('h-') ? 'heirloom' : 'loot' });
  run.progress = 'Bag 1/1'; run.next();
}

// ── what F does in a job (before the everyday tag-team moves)
export function teamTag(run: Run): TagOpt | null {
  const w = run.w, st = run.cur, p = w.p, m = w.mate, n = nameOf(m.who);
  if (!st) return null;
  if (st.t === 'hold' && !holding(run) && m.ai.mode !== 'hold') {
    const [lx, ly] = xy(run, st.lever);
    if (dist(p.x, p.y, lx, ly) < 600) return { kind: 'hold', label: `${n}, hold the lever!`, go: () => { postMate(run, 'hold', [lx, ly]); w.fx.push({ t: 'tag-hold', x: lx, y: ly }); } };
  }
  if (st.t === 'boost' && !m.roof && !p.roof) {
    const [gx, gy] = boostXY(st.at, false);
    if (dist(p.x, p.y, gx, gy) < 110 && dist(m.x, m.y, gx, gy) < 260) return { kind: 'boost-mate', label: `Boost ${n} up onto the roof`, go: () => boostMate(run, st.at) };
  }
  if (st.t === 'stealth' && st.shutter && run.phase === 0 && !holding(run) && m.ai.mode !== 'hold') {
    const [lx, ly] = xy(run, st.shutter);
    return { kind: 'hold', label: `${n} sneaks round to hold the shutter`, go: () => { postMate(run, 'hold', [lx, ly]); w.fx.push({ t: 'tag-hold', x: lx, y: ly }); } };
  }
  if ((st.t === 'stealth' || st.t === 'collect') && !holding(run) && !p.ride) {
    const a = run.actors.filter(a => (a.kind === 'lookout' || a.kind === 'window') && !a.gone && (a.extra2 ?? 0) <= 0).sort((a, b) => dist(a.b.x, a.b.y, p.x, p.y) - dist(b.b.x, b.b.y, p.x, p.y))[0];
    if (a && dist(a.b.x, a.b.y, p.x, p.y) < 520) return { kind: 'distract', label: `${n} distracts the ${a.kind === 'window' ? 'window lookout' : 'lookout'}`, go: () => { distract(w, a.b.x, a.b.y + (a.kind === 'window' ? 60 : 0), 6); a.stare = 6.5; a.stareAt = m.who; } };
  }
  if (st.t === 'chase' && st.finish === 'pounce' && !p.ride) {
    const a = run.actors[0]; if (a && dist(a.b.x, a.b.y, m.x, m.y) < 360) return { kind: 'pounce', label: 'Pounce together!', go: () => pounce(w, a.id) };
  }
  if (st.t === 'float' && st.rope && run.float && !run.float.done && !holding(run) && m.ai.mode !== 'hold') {
    const [rx, ry] = xy(run, st.rope);
    if (dist(p.x, p.y, rx, ry) < 700) return { kind: 'hold', label: `${n}, haul the bunting rope!`, go: () => { postMate(run, 'hold', [rx, ry]); w.fx.push({ t: 'tag-hold', x: rx, y: ry }); } };
  }
  return null;
}
/** you give your partner the leg-up this time (a boost step in a job) */
function boostMate(run: Run, i: number) {
  const w = run.w, p = w.p, m = w.mate; const [gx, gy] = boostXY(i, false), [rx, ry] = boostXY(i, true);
  p.b.x = gx; p.b.y = gy + 6; m.b.x = gx + 4; m.b.y = gy - 4; p.b.speed = 0;
  p.act = { n: 'boost-give', t: 0, dur: 0.9 };
  m.act = { n: 'boost-rise', t: 0, dur: 0.6, then: () => { m.roof = true; m.b.x = rx; m.b.y = ry; m.lastRoof = [rx, ry]; m.ai = { ...m.ai, mode: 'stay', at: [rx, ry], story: true }; } };
  w.fx.push({ t: 'boost', x: gx, y: gy, kind: 'mate' });
}

/** where a guarding partner heads in an escort: the swoop nearest the lion, or the lion's other flank */
export function guardGoal(run: Run, m: Player): [number, number] | null {
  const lion = run.actors.find(a => a.kind === 'lion'); if (!lion) return null;
  const sw = run.actors.filter(a => a.kind === 'swoop' && !a.gone && a.stun <= 0 && dist(a.b.x, a.b.y, lion.b.x, lion.b.y) < 420).sort((a, b) => dist(a.b.x, a.b.y, m.x, m.y) - dist(b.b.x, b.b.y, m.x, m.y));
  const p = run.w.p;
  // leave the one nearest you to you; take the other
  const mine = sw.find(s => dist(s.b.x, s.b.y, m.x, m.y) <= dist(s.b.x, s.b.y, p.x, p.y)) ?? (sw.length > 1 ? sw[1] : null);
  if (mine) return [mine.b.x, mine.b.y];
  const a = Math.atan2(lion.b.y - p.y, lion.b.x - p.x);
  return [lion.b.x + Math.cos(a) * 70, lion.b.y + Math.sin(a) * 70];
}
/** the partner shoos a swoop they reach in an escort */
export function guardHits(run: Run) {
  const m = run.w.mate; if (m.ai.mode !== 'guard' || m.seat) return;
  for (const s of run.actors) if (s.kind === 'swoop' && !s.gone && s.stun <= 0 && dist(s.b.x, s.b.y, m.x, m.y) < 46) { s.stun = 1.2; s.b.h += Math.PI; m.act = { n: 'shoo', t: 0, dur: 0.4 }; run.w.fx.push({ t: 'shoo', x: s.b.x, y: s.b.y }); }
}

// ── gadgets hitting the people of a job
export function onGadget(run: Run, a: Actor, g: GadgetId, pw: number, x: number, y: number): boolean {
  const w = run.w, st = run.cur;
  void x; void y;
  switch (a.kind) {
    case 'cart': case 'boat': case 'boss': case 'runner': {
      if (g === 'net' && st?.t === 'chase') { run.chaseHit(a, 'net'); a.netT = 2.2; return true; }
      a.stun = Math.max(a.stun, (g === 'popper' ? 1.1 : g === 'bubble' ? 0.7 : g === 'confetti' ? 0.3 : 0.45) * pw); a.b.speed *= 0.55;
      w.fx.push({ t: 'wobble', x: a.b.x, y: a.b.y, kind: g });
      return true;
    }
    case 'decoy': a.gone = true; w.fx.push({ t: 'poof', x: a.b.x, y: a.b.y, kind: 'feather' }); return true;
    case 'raider': if (a.stun > 0) return false; run.raiderCaught(a); return true;
    case 'swoop': if (a.stun > 0) return false; a.stun = 1.2; a.b.h += Math.PI; w.fx.push({ t: 'shoo', x: a.b.x, y: a.b.y }); return true;
    case 'bagbird': if (g === 'bubble') { a.stun = 0.8; return true; } dropBag(run, a); return true;
    case 'pip': { const m = run.meter; if (m) m.v = Math.min(1, m.v + 0.4); run.warn('Pip felt that! He’s looking round…'); return true; }
    case 'lookout': case 'window': {
      if (g === 'paint') { a.extra2 = a.kind === 'window' ? 1e9 : 8 * pw; w.fx.push({ t: 'blind', x: a.b.x, y: a.b.y }); if (a.kind === 'window') run.warn('Splat! The window lookout can’t see a thing.'); return true; }
      if (g === 'popper' || g === 'confetti') { a.stare = 3; a.stareX = x; a.stareY = y; return true; }
      const m = run.meter; if (m) m.v = Math.min(1, m.v + 0.3); return true;
    }
  }
  return false;
}
/** a popper or confetti burst: lookouts nearby turn to stare at it; a flock of swoops scatters */
export function onBurst(run: Run, g: GadgetId, x: number, y: number, R: number) {
  for (const a of run.actors) {
    if (a.gone) continue;
    const d = dist(a.b.x, a.b.y, x, y);
    if ((a.kind === 'lookout' || a.kind === 'window') && d < R * 3) { a.stare = 3; a.stareX = x; a.stareY = y; }
    if (a.kind === 'swoop' && g === 'confetti' && d < R * 1.6 && a.stun <= 0) { a.stun = 1.4; a.b.h = Math.atan2(a.b.y - y, a.b.x - x); }
  }
}
/** the window lookout's view (and painted or distracted lookouts seeing nothing) */
/** painted over, staring at a distraction, or eating an ice cream from the motorbike (the sixteenth pass's chime) */
export function blind(a: Actor) { return (a.extra2 ?? 0) > 0 || (a.stare ?? 0) > 0 || (a.mind?.treat ?? 0) > 0; }
export function watchStep(run: Run, dt: number) {
  const w = run.w, p = w.p;
  for (const a of run.actors) {
    if (a.extra2 !== undefined && a.extra2 > 0) a.extra2 -= dt;
    if (a.stare !== undefined && a.stare > 0) { a.stare -= dt; const tx = a.stareAt ? w.mate.x : a.stareX ?? a.b.x, ty = a.stareAt ? w.mate.y : a.stareY ?? a.b.y; a.b.h = Math.atan2(ty - a.b.y, tx - a.b.x); if (a.stare <= 0) a.stareAt = undefined; }
  }
  const st = run.cur; if (!st || st.t !== 'collect' || !st.watch) return;
  const a = run.actors.find(x => x.kind === 'window'); if (!a) return;
  if (!(a.stare && a.stare > 0)) a.b.h = Math.PI / 2;
  const seeN = run.w.two ? [p, w.mate] : [p];
  let seen = false;
  if (!blind(a)) for (const h of seeN) { const d = dist(a.b.x, a.b.y, h.x, h.y); if (d < 360 && Math.abs(angDiff(a.b.h, Math.atan2(h.y - a.b.y, h.x - a.b.x))) < 0.62 && los(w.c, a.b.x, a.b.y + 40, h.x, h.y) && !h.hide) seen = true; }
  const m = run.meter2 ?? (run.meter2 = { name: 'Window lookout', v: 0 });
  m.v = clamp(m.v + (seen ? dt * (p.sneak ? 0.35 : 0.8) * w.diff.look : -dt * 0.4), 0, 1); m.bad = m.v > 0.5;
  m.name = blind(a) ? 'Window lookout (can’t see)' : 'Window lookout';
  if (m.v > 0.5 && !run.warning) run.warn('The window lookout is watching! Paint the window, or have your partner distract it.');
  if (m.v >= 1) run.fail('The lookout in the window spotted you and hid the token! Paint the window or send your partner to distract it.');
}
export { T };
