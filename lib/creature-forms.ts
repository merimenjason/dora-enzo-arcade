// Every Creature: heroes, form changes, carriers and riders, hero physics, climbing, the partner's follow AI and the
// partner call (C). Pure, no DOM. Ported from the prototype's forms.js with the same numbers.
import {
  G, LV, SCR, F, CARRY, FORMS, NOINP, rnd, clamp, lerp, sm, H, O, other, ev, snd, voice, backY, canRide, unlocked, floorAt, allRects,
  surface, wallBlock, inWaterX, fx, splash, feathers, poof, ring,
  type Form, type Name, type Hero, type Input, type FormParams, type WallHit,
} from './creature-core.js';

export function mkHero(name: Name, x: number, y: number): Hero {
  return {
    name, x, y, vx: 0, vy: 0, face: 1, form: 'chin', ground: true, t: rnd() * 3, anim: 0, flaps: 0, flapT: 0, climb: null, ride: null, rider: null, carry: null, carryT: 0,
    hurt: 0, shell: false, swim: false, dive: false, landT: 0, friendT: 0, nudgeT: 0, digT: 0, respawn: 0, lastSafe: { x, y }, slipT: 0, knock: 0, poofT: 0, surf: 'bank', inp: null,
    offAt: -9, boardT: 0, denyT: 0, arriveT: 0, zoneT: 0, danger: false,
  };
}
/** a form change needs feet on something: never in mid-air, and screens can forbid spots (the cliff's thin perch branch) */
export function formBlocked(h: Hero) {
  if (h.respawn > 0) return true;
  if (!h.ground && !h.swim && !h.ride && !h.climb) return true;
  return !!(SCR.noForm && SCR.noForm(h));
}
export function setForm(h: Hero, f: Form, force?: boolean) {
  if (f === h.form) return;
  if (!unlocked(f)) { snd('deny'); return; }
  if (!force && formBlocked(h)) { snd('deny'); h.denyT = .45; G.stats.denied++; ev('formDenied', h.name, f); fx(h.x, h.y - 30, 5, { s: 120, g: 300, k: 'leaf', life: .6, r: 6 }); return; }
  // break any pairing the new form can't keep
  if (h.ride) { const c = h.ride; if (c.form === 'bird' ? f !== 'beetle' : !(CARRY[c.form] || []).includes(f)) dismount(h, 200); }
  if (h.rider && !(CARRY[f] || []).includes(h.rider.form)) dismount(h.rider, 300);
  if (h.carry && f !== 'bird') dropCarry(h);
  if (h.climb && !(f === 'beetle' || (f === 'chin' && h.climb === 'vine'))) h.climb = null;
  const oldH = F[h.form].h;
  h.form = f; h.shell = false; h.poofT = .35; h.flaps = 0; h.dive = false;
  poof(h.x, h.y - Math.max(oldH, F[f].h) / 2, Math.max(oldH, F[f].h) / 110);
  snd('poof'); voice(f, .14); G.stats.formChanges++; ev('form', h.name, f);
  if (h.swim && !F[f].swim) h.swim = false;
}
export function cycleForm(h: Hero, d: number) {
  const list = FORMS.filter(unlocked); if (list.length < 2) { snd('deny'); return; }
  const i = list.indexOf(h.form); setForm(h, list[(i + d + list.length) % list.length]);
}
export function swap() {
  if (G.two) return; G.act = 1 - G.act; G.stats.swaps++; snd('swap');
  const h = H(); ring(h.x, h.y - F[h.form].h / 2, 50); ev('swap', h.name);
}

// ---------------------------------------------------------------- carriers
export function mount(r: Hero, c: Hero) {
  r.ride = c; c.rider = r; r.ground = true; r.vy = 0; r.swim = false; r.longJump = false; r.landT = .14; r.boardT = .22; r.bx = r.x; r.by = r.y; r.climb = null;
  snd('hop'); ring(c.x, c.y - backY(c), 40); ev('mount', r.name, r.form, c.form);
}
export function dismount(h: Hero, jumpV: number) {
  const c = h.ride; if (!c) return;
  c.rider = null; if (c.carry === h) c.carry = null; c.dropAt = G.t; h.ride = null; h.ground = false; h.offAt = G.t;
  if (jumpV) { h.vy = -jumpV; if (h.form === 'frog') { h.longJump = true; snd('frog'); } else snd('jump'); if (SCR.onJump) SCR.onJump(h); } else h.vy = 0;
}
export function dropCarry(b: Hero) { const c = b.carry; if (!c) return; c.ride = null; b.carry = null; b.dropAt = G.t; c.ground = false; c.vy = 0; c.landT = .14; c.offAt = G.t; }
export function grab(bd: Hero, bt: Hero) { bd.carry = bt; bt.ride = bd; bd.carryT = 0; bd.flaps = 0; bt.swim = false; bt.climb = null; bt.boardT = .18; bt.bx = bt.x; bt.by = bt.y; snd('chirp'); ring(bt.x, bt.y - 30, 40); ev('grab', bd.name, bt.name); }
/** keep riders on carriers */
export function attach(c: Hero) {
  const r = c.rider || c.carry; if (!r) return;
  let x, y;
  if (c.rider) { x = c.x - c.face * (c.form === 'tort' ? 22 : c.form === 'fox' ? 4 : 2); y = c.y - backY(c) + 4; r.face = c.face; r.ground = true; r.surf = 'back'; r.dive = c.dive; }
  else { x = c.x + c.face * 4; y = c.y + 48; r.face = c.face; r.ground = false; }
  if (r.boardT > 0) { const k = 1 - r.boardT / .22; r.x = lerp(r.bx!, x, sm(k)); r.y = lerp(r.by!, y, sm(k)) - Math.sin(Math.PI * clamp(k, 0, 1)) * 40; }
  else { r.x = x; r.y = y; }
}

// ---------------------------------------------------------------- respawn
export function startRespawn(h: Hero, why: string) {
  if (h.respawn > 0) return;
  if (h.rider) dismount(h.rider, 0);
  if (h.carry) dropCarry(h);
  if (h.ride) { const c = h.ride; c.rider = null; if (c.carry === h) c.carry = null; h.ride = null; }
  h.climb = null; h.respawn = .8; h.vx = 0; h.vy = 0; h.dive = false; G.stats.splashes++; ev('respawn', h.name, why);
  if (why === 'water' && LV.water) { splash(h.x, LV.water.y, 1.4); snd('splash'); }
}
/** the last safe spot was recorded in another form: a narrower one can slip off a ledge's edge, so step inward until
 *  this form has footing (without this a chinchilla could respawn, fall and respawn forever at the Storm Falls rock) */
function footing(h: Hero) {
  const ok = (x: number) => { const s = surface(h, x, h.y, h.y + 2, 2); return !!s && Math.abs(s.y - h.y) < 3 && !['pad', 'padsink', 'back'].includes(s.kind); };
  if (ok(h.x)) return;
  for (let d = 4; d <= 48; d += 4) for (const x of [h.x + d, h.x - d]) if (ok(x)) { h.x = x; h.lastSafe.x = x; return; }
}
export function heroJump(h: Hero, v: number) { h.vy = -v; h.ground = false; h.surf = ''; if (SCR.onJump) SCR.onJump(h); }

// ---------------------------------------------------------------- hero physics
const TIMERS = ['landT', 'friendT', 'nudgeT', 'flapT', 'poofT', 'slipT', 'boardT', 'denyT', 'digT'] as const;
export function updHero(h: Hero, inp: Input, dt: number) {
  h.t += dt; h.anim += dt;
  for (const k of TIMERS) if (h[k] > 0) h[k] -= dt;
  if (h.arriveT > 0) { h.arriveT -= dt; if (h.arriveT <= 0) finishArrive(h); return; }
  if ((h.under ?? 0) > 0) return;
  if (h.respawn > 0) {
    h.respawn -= dt;
    if (h.respawn <= 0) { h.respawn = 0; h.x = h.lastSafe.x; h.y = h.lastSafe.y; h.vx = h.vy = 0; h.ground = true; h.swim = false; h.surf = 'bank'; h.hurt = 0; h.knock = 0; footing(h); poof(h.x, h.y - 50, 1); snd('poof'); }
    return;
  }
  const P = F[h.form];
  if (h.hurt > 0) { h.hurt -= dt; if (h.hurt > .2) inp = NOINP; }
  if (h.ride) return; // positioned by carrier
  h.inp = inp;
  if (h.climb) { updClimb(h, inp, dt); return; }
  // ---------- horizontal intent
  let tv = inp.mx * (h.swim ? P.swimSpd! : (h.ground ? P.spd : (P.air || P.spd)));
  if (h.form === 'tort') { h.shell = !!inp.actH && h.hurt <= 0; if (h.shell) tv = 0; }
  if (h.form === 'frog' && !h.ground && !h.swim && h.longJump) tv = inp.mx ? inp.mx * 360 : h.vx * .98;
  if (h.form === 'fox' && h.digging) tv = 0;
  if (h.knock) { tv = h.knock; h.knock *= .9; if (Math.abs(h.knock) < 20) h.knock = 0; }
  h.vx = tv; if (inp.mx) h.face = inp.mx;
  if (SCR.block) SCR.block(h);
  // ---------- actions
  const up = inp.upP && !(h.form === 'chin' && nearVine(h)) && !(h.form === 'beetle' && touchingWall(h));
  if (h.form === 'chin' || h.form === 'frog' || h.form === 'beetle' || h.form === 'fox' || (h.form === 'otter' && !h.swim)) {
    if (inp.actP && SCR.actNear(h)) { /* consumed by an interaction */ }
    else if ((inp.actP || up) && (h.ground || h.swim) && !h.digging) {
      if (h.swim) heroJump(h, P.wjump || 300);
      else { heroJump(h, P.jump!); if (h.form === 'frog' || h.form === 'fox') h.longJump = h.form === 'frog'; }
      if (h.form === 'frog') { snd('frog'); if (h.surf === 'pad') splash(h.x, LV.water!.y, .4); } else if (h.form === 'beetle') { snd('hop'); voice('beetle'); } else if (h.form === 'fox') { snd('jump'); if (rnd() < .4) voice('fox'); } else snd('jump');
      h.swim = false;
    }
  } else if (h.form === 'bird') {
    if (inp.actP && SCR.actNear(h)) { /* consumed */ }
    else if (inp.actP || up) {
      if (h.flaps < P.maxFlaps! && h.hurt <= 0) { h.vy = -(h.carry ? P.cflap! : P.flap!); h.ground = false; h.flaps++; h.flapT = .26; snd('flap'); feathers(h.x, h.y - 40, 2, h.name); h.surf = ''; }
      else feathers(h.x, h.y - 40, 1, h.name);
    }
    if (h.carry && inp.my > 0 && h.carryT > .3) dropCarry(h);
  } else if (h.form === 'tort') { if (inp.actP && SCR.actNear(h)) { /* consumed */ } else if (inp.actP) voice('tort'); }
  else if (h.form === 'otter' && h.swim && inp.upP && !h.dive) { heroJump(h, P.wjump!); h.swim = false; splash(h.x, LV.water!.y, .5); voice('otter'); }
  // climb start
  if (h.form === 'chin' && nearVine(h) && (inp.my < 0 || (inp.my > 0 && h.y <= nearVine(h)!.top + 2))) { const v = nearVine(h)!; h.climb = 'vine'; h.vineR = v; h.x = v.x; h.vy = 0; h.ground = false; return; }
  if (h.form === 'beetle' && (h.ground || h.vy > -100)) { const w = touchingWall(h); if (w && (inp.my < 0 || inp.mx === w.dir)) { startWallClimb(h, w); return; } }
  // ---------- swimming
  if (h.swim) { updSwim(h, inp, dt, P); return; }
  // ---------- gravity
  if (h.form === 'bird' && !h.ground) { if ((inp.actH || inp.my < 0) && h.vy > P.glide!) h.vy = P.glide!; }
  h.vy = Math.min(h.vy + P.g * dt, 1200);
  if (h.form === 'bird' && h.carry && h.vy > 160) h.vy = 160; // a carried friend floats down gently
  if (SCR.birdCap) SCR.birdCap(h);
  let nx = clamp(h.x + h.vx * dt, 20, LV.W - 20);
  const wb = wallBlock(h, nx); if (wb) { nx = wb.x; h.wallHit = wb.side; if (wb.r.thorn && Math.sign(h.vx) === wb.side && SCR.thorn) SCR.thorn(h, wb); } else h.wallHit = 0;
  h.x = nx;
  const ext = h.carry ? 48 : 0;
  let ny = h.y + h.vy * dt;
  if (h.vy < 0) for (const r of allRects()) if (!r.noBottom && h.x + 16 > r.x1 && h.x - 16 < r.x2 && h.y - P.h >= r.y2 - 2 && ny - P.h < r.y2) { ny = r.y2 + P.h; h.vy = 0; }
  const wasGround = h.ground;
  const s = h.vy >= 0 ? surface(h, h.x, h.y + ext, ny + ext + (wasGround ? 22 : 0), wasGround ? 22 : 2) : null;
  if (s) {
    if (s.kind === 'back') { mount(h, s.ref as Hero); return; }
    if (h.carry && h.carryT > .25 && SCR.carryLand && SCR.carryLand(h, s)) return;
    ny = s.y - ext; if (!wasGround && h.vy > 300) { h.landT = .14; if (h.form === 'frog') snd('hop'); }
    const fallV = h.vy;
    h.vy = 0; h.ground = true; h.surf = s.kind; h.flaps = 0; h.longJump = false;
    if (s.kind === 'pad') (s.ref as { dip?: number }).dip = .3;
    if (s.kind === 'padsink') { (s.ref as { dip?: number }).dip = 1; h.y = ny; startRespawn(h, 'water'); return; }
    if (SCR.landed) SCR.landed(h, s, fallV);
  } else h.ground = false;
  h.y = ny;
  // water
  const W = LV.water;
  if (W && inWaterX(h.x) && h.y + ext > W.y + (P.swim ? P.sink! : 10) && floorAt(h.x) > W.y + (P.swim ? P.sink! : 10) && !(h.ground && h.surf !== 'bank')) {
    if (P.swim) { if (h.vy > 200) { splash(h.x, W.y, .8); snd('splash'); } else snd('plip'); h.swim = true; h.vy = 0; h.y = W.y + P.sink!; h.longJump = false; h.flaps = 0; }
    else startRespawn(h, 'water');
  }
  if (h.y > LV.H + 70) startRespawn(h, 'fall');
  if (h.ground && !h.respawn && h.hurt <= 0 && !['pad', 'ramp', 'back', 'padsink'].includes(h.surf) && !(LV.unsafe || []).includes(h.surf) && !(inWaterX(h.x) && h.y > W!.y - 4)) { h.lastSafe.x = h.x; h.lastSafe.y = h.y; }
}
function updSwim(h: Hero, inp: Input, dt: number, P: FormParams) {
  const W = LV.water!, cur = LV.current;
  // the otter dives while Space or Down is held; it can't surface under a log jam
  if (h.form === 'otter') {
    let want = !!(inp.actH || inp.my > 0);
    if (!want && h.dive) { for (const r of allRects()) if (h.x + 30 > r.x1 && h.x - 30 < r.x2 && W.y + P.sink! - P.h < r.y2 && W.y + P.sink! > r.y1) want = true; }
    if (want && !h.dive) { snd('dive'); splash(h.x, W.y, .6); ev('dive', h.name, h.rider ? h.rider.form : null); if (h.rider && h.rider.form !== 'frog') { const r = h.rider; dismount(r, 0); startRespawn(r, 'water'); ev('washOff', r.name, r.form); } }
    h.dive = want;
  }
  h.x += h.vx * dt;
  if (cur && h.x > cur.x1 && h.x < cur.x2) h.x += cur.v * dt * (h.dive ? .6 : 1);
  const wb = wallBlock(h, h.x); if (wb) h.x = wb.x;
  h.x = clamp(h.x, 20, LV.W - 20);
  if (!inWaterX(h.x) || floorAt(h.x) <= W.y + P.sink!) { h.swim = false; h.dive = false; h.ground = true; h.y = Math.min(floorAt(h.x), h.y); h.surf = 'bank'; return; }
  const ty = h.dive ? W.y + (W.dive || 140) : W.y + P.sink! + Math.sin(h.t * 3) * 2;
  h.y = Math.abs(ty - h.y) < 4 ? ty : h.y + Math.sign(ty - h.y) * Math.min(Math.abs(ty - h.y), dt * 420);
  if (h.dive && rnd() < .25) fx(h.x + h.face * 30, h.y - 30, 1, { a: -Math.PI / 2, spread: .6, s: 60, g: -120, k: 'bubble', life: .9, r: 4 });
  if (!h.dive && h.vx && rnd() < .2) fx(h.x - h.face * 30, W.y, 1, { a: -Math.PI / 2, spread: 1, s: 110, g: 600, r: 3.5 });
  if (SCR.swimTick) SCR.swimTick(h, dt);
}
export function touchingWall(h: Hero): WallHit | null {
  const hw = F[h.form].w / 2;
  for (const w of LV.walls || []) if (h.y > w.top && h.y <= w.bot + 1 && Math.abs(h.x + hw - w.x) < 8) return { dir: 1, x: w.x - hw, top: w.top, bot: w.bot, slick: w.slick, kind: w.kind, exitX: w.exitX };
  return null;
}
function startWallClimb(h: Hero, w: WallHit) { h.climb = 'wall'; h.wall = w; h.x = w.x; h.vy = 0; h.ground = false; h.face = w.dir; h.climbAnim = 0; h.grip = 0; h.y -= 2; voice('beetle'); }
export function nearVine(h: Hero) { for (const v of LV.vines || []) if (v.on() && Math.abs(h.x - v.x) < 34 && h.y >= v.top - 2 && h.y <= v.bot + 2) return v; return null; }
function updClimb(h: Hero, inp: Input, dt: number) {
  const P = F[h.form];
  if (h.climb === 'vine') {
    const v = h.vineR!;
    h.vy = inp.my * 190; h.y += h.vy * dt; if (inp.my) h.climbAnim = (h.climbAnim || 0) + dt * 6;
    if (h.y <= v.top) { h.climb = null; h.y = v.exitY; h.x = v.exitX; h.ground = true; h.surf = 'cliff'; h.face = 1; h.landT = .14; return; }
    if (h.y >= v.bot) { h.climb = null; h.y = v.bot; h.ground = true; h.surf = 'bank'; return; }
    if (inp.actP || (inp.mx && !inp.my)) { h.climb = null; h.face = inp.mx || -1; h.vx = h.face * 150; h.vy = inp.actP ? -400 : 0; h.ground = false; h.x += h.face * 6; }
    return;
  }
  const w = h.wall!; let want = inp.my < 0 || inp.mx === w.dir ? -1 : inp.my > 0 ? 1 : 0;
  const slick = w.slick != null && h.y > w.slick + 4;
  if (slick) h.grip = (h.grip || 0) + dt;
  if (slick && h.grip! > .5) { want = 1; h.slipT = (h.slipT > 0 ? h.slipT : 0) + dt * 2; if (rnd() < .3) fx(h.x + 10, h.y - 30, 1, { a: Math.PI / 2, spread: .4, s: 60, g: 500, r: 3 }); }
  h.vy = want * (slick && want > 0 ? 150 : P.climb!); h.y += h.vy * dt; if (want) { h.climbAnim = (h.climbAnim || 0) + dt * 7; if (h.climbAnim % 2 < dt * 7) voice('beetle'); }
  if (slick && h.grip! > .5) { if (h.slipSnd == null || G.t - h.slipSnd > 1) { snd('slip'); h.slipSnd = G.t; G.stats.slips++; ev('slip', h.name); } }
  if (h.y <= w.top) { h.climb = null; h.y = w.top; h.x = (w.exitX ?? w.x + P.w + 4); h.ground = true; h.surf = 'cliff'; h.landT = .14; return; }
  if (h.y >= w.bot) { h.climb = null; h.y = w.bot; h.ground = false; if (slick) h.hurt = .45; return; }
  if (inp.actP || inp.mx === -w.dir) { h.climb = null; h.vx = -w.dir * 160; h.vy = -260; h.x -= w.dir * 6; h.ground = false; }
}

// ---------------------------------------------------------------- partner: follow, board, call
export function zoneOf(h: { x: number; y: number }) { return SCR.zone ? SCR.zone(h.x, h.y, h as Hero) : 0; }
export function reachable(za: string | number, zb: string | number) { return za === zb || !!(SCR.linked && SCR.linked(za, zb)); }
/** a safe standing spot near hero a for partner b */
export function spotNear(a: Hero, b: Hero) {
  for (const d of [-1, 1]) for (const k of [70, 110, 150, 40]) {
    const x = clamp(a.x - a.face * d * k, 40, LV.W - 40);
    const s = surface(b, x, a.y - 60, a.y + 60, 60);
    if (s && !['pad', 'padsink', 'back'].includes(s.kind) && !(inWaterX(x) && s.y > LV.water!.y - 4) && !wallBlock({ ...b, x, y: s.y, ground: true }, x) && zoneOf({ x, y: s.y }) === zoneOf(a)) return { x, y: s.y };
  }
  return null;
}
function arrive(b: Hero, a: Hero, spot: { x: number; y: number } | null) { b.arriveT = .7; b.arrTo = spot; b.arrOn = spot ? null : a; poof(b.x, b.y - 40, .8); snd('whoosh'); }
function finishArrive(b: Hero) {
  const a = other(b);
  if (b.arrOn) { if (b.arrOn.rider || !canRide(b, b.arrOn)) { b.arrOn = null; return; } b.x = a.x; b.y = a.y - backY(a); mount(b, a); }
  else if (b.arrTo) { b.x = b.arrTo.x; b.y = b.arrTo.y; b.ground = true; b.swim = false; b.vx = b.vy = 0; b.surf = 'bank'; b.face = Math.sign(a.x - b.x) || 1; }
  b.arrOn = b.arrTo = null; b.climb = null; poof(b.x, b.y - 40, .9); snd('poof'); ev('arrive', b.name);
}
/** one button: let a carried friend off, otherwise call the partner over (with assist, in the form that pairs with yours) */
export function callPartner() {
  if (G.two) return;
  const a = H(), b = O();
  if (a.ride) { dismount(a, F[a.form].jump || 300); return; }
  const f = G.assist && SCR.pair ? SCR.pair(a.form, a) : null, change = !!(f && f !== b.form && unlocked(f));
  const cs0 = !change && SCR.callSpot && SCR.callSpot(a, b);
  if (cs0 && a.rider === b) { b.stayOff = true; dismount(b, 0); arrive(b, a, cs0); ev('call', b.name, b.form, 'spot'); return; }
  if (!change && a.rider) { const r = a.rider; r.stayOff = true; dismount(r, 300); r.vx = -a.face * 120; r.knock = -a.face * 140; ev('letOff', r.name); snd('hop'); return; }
  if (!change && a.carry) { a.carry.stayOff = true; dropCarry(a); ev('letOff', b.name); return; }
  if (b.respawn || b.arriveT > 0) return;
  G.stats.calls++; snd('call'); ring(a.x, a.y - F[a.form].h - 20, 46, 'white', .7);
  if (!reachable(zoneOf(a), zoneOf(b))) { snd('deny'); b.denyT = .6; ev('callFar', b.name); return; }
  if (change) setForm(b, f!, true);
  if (b.ride === a || a.carry === b) return;
  const cs = SCR.callSpot && SCR.callSpot(a, b);
  if (!cs && canRide(b, a) && !a.rider && (a.swim || a.ground)) { arrive(b, a, null); ev('call', b.name, b.form, 'ride'); return; }
  if (!cs && Math.abs(a.x - b.x) < 150 && Math.abs(a.y - b.y) < 40) return;
  const s = cs || spotNear(a, b); if (s) { arrive(b, a, s); ev('call', b.name, b.form); } else { snd('deny'); b.denyT = .6; }
}
export function aiInput(b: Hero, a: Hero): Input {
  const inp = { ...NOINP };
  if (b.respawn || b.climb || b.ride || b.arriveT > 0) return inp;
  if (b.form === 'tort' && b.danger) { inp.actH = true; return inp; } // shell up when a threat locks on
  if (SCR.ai) { const o = SCR.ai(b, a); if (o) return o; }
  if (b.stayOff && Math.hypot(a.x - b.x, a.y - b.y) > 200) b.stayOff = false;
  const fresh = G.t - b.offAt > 2.5 && !b.stayOff;
  // hop aboard a carrier partner that comes alongside
  if (fresh && canRide(b, a) && !a.rider && !a.respawn && !a.dive && Math.abs(a.x - b.x) < 100 && (b.ground || b.swim) && Math.abs((a.y - backY(a)) - b.y) < 130 && a.hurt <= 0 && (a.ground || a.swim)) { mount(b, a); return inp; }
  // a beetle partner hops up and grabs a bird that hovers low over it
  if (fresh && b.form === 'beetle' && a.form === 'bird' && !a.carry && !a.ground && a.hurt <= 0 && b.ground && Math.abs(a.x - b.x) < 90 && b.y - a.y > 10 && b.y - a.y < 190 && !(G.t - (a.dropAt ?? -9) < 1.5)) { grab(a, b); return inp; }
  // follow the active hero into a linked zone it has moved on to
  const za = zoneOf(a), zb = zoneOf(b);
  if (za !== zb && reachable(za, zb) && a.ground && !a.ride && !(SCR.stay && SCR.stay(b))) { b.zoneT += 1 / 60; if (b.zoneT > 2) { b.zoneT = 0; const s = spotNear(a, b); if (s) { arrive(b, a, s); ev('follow', b.name); } } } else b.zoneT = 0;
  if (!b.ground || a.respawn) return inp;
  const same = Math.abs(a.y - b.y) < 24 && (a.ground || a.swim) && !a.ride;
  if (same && !(SCR.stay && SCR.stay(b))) {
    const gap = Math.abs(a.x - b.x), d = Math.sign(a.x - b.x);
    if (gap > 130) {
      const nx = b.x + d * 30;
      const safe = F[b.form].swim || !inWaterX(nx) || floorAt(nx) < LV.water!.y;
      if (safe && !wallBlock(b, nx) && zoneOf({ x: nx, y: b.y }) === zb) inp.mx = d;
    }
  }
  return inp;
}
