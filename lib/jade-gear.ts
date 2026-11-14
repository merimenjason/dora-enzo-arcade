// Jade Street: the cartoon gadgets. Six festival toys, never weapons: a slingshot of sticky-rice balls, a paint
// squirter, a box of party poppers, a net launcher, a bubble blower and a confetti cannon. Each hero carries two
// (switch with 1 and 2 or the wheel); aim with the mouse, or let Assist pick the nearest fair target. Every gadget has
// a clip and a satchel of spare ammo (reload with X, or it reloads itself when empty); ammo comes from the red supply
// crates around the quarter and from Tock's toy stall, which also sells gadgets and two upgrades for each.
// What they do: magpies get dizzy and drop what they hold, carts wobble and slow (a net tangles one), flocks scatter,
// lookouts can be blinded with paint or turned by a popper. Hitting a warden or a townsfolk raises heat, and a stall
// that gets splattered leaves its owner cross. Pure engine: projectiles step with the world; reactions of job actors
// are in lib/jade-team.ts.
import { T, W, S, F_ROOF, districtAt } from './jade-city.js';
import { nearestFree } from './jade-nav.js';
import { dist, angDiff, clamp } from './jade-rng.js';
import { addHeat } from './jade-heat.js';
import type { World, Player } from './jade-game.js';
import type { Hero, Save } from './jade-save.js';
import type { Actor } from './jade-mission.js';
import { GOOD, type Good } from './jade-trade.js';

export type GadgetId = 'sling' | 'paint' | 'popper' | 'net' | 'bubble' | 'confetti';
export const GADGET_IDS: GadgetId[] = ['sling', 'paint', 'popper', 'net', 'bubble', 'confetti'];
export type GadgetDef = { name: string; ammoName: string; blurb: string; kind: 'shot' | 'lob' | 'burst'; speed: number; range: number; clip: number; reload: number; cd: number; price: number; pack: number; packPrice: number; up: [number, number] };
export const GADGETS: Record<GadgetId, GadgetDef> = {
  sling: { name: 'Slingshot', ammoName: 'rice balls', blurb: 'Sticky-rice balls: a magpie gets dizzy and drops what it holds; a cart wobbles.', kind: 'shot', speed: 780, range: 560, clip: 6, reload: 0.9, cd: 0.3, price: 120, pack: 12, packPrice: 20, up: [150, 320] },
  paint: { name: 'Paint squirter', ammoName: 'paint blobs', blurb: 'Pink and teal splats: a painted lookout sees nothing, and a dizzy magpie lets go.', kind: 'shot', speed: 560, range: 440, clip: 5, reload: 1.1, cd: 0.4, price: 160, pack: 10, packPrice: 25, up: [180, 360] },
  popper: { name: 'Popper box', ammoName: 'party poppers', blurb: 'Lob a party popper: its burst of sparks stuns everything close by for a moment.', kind: 'lob', speed: 520, range: 400, clip: 3, reload: 1.2, cd: 0.6, price: 200, pack: 6, packPrice: 30, up: [200, 420] },
  net: { name: 'Net launcher', ammoName: 'nets', blurb: 'A rope net that opens wide: catches a magpie or tangles a getaway cart.', kind: 'shot', speed: 620, range: 470, clip: 2, reload: 1.6, cd: 0.8, price: 260, pack: 4, packPrice: 40, up: [240, 480] },
  bubble: { name: 'Bubble blower', ammoName: 'bubble soap', blurb: 'A spray of bubbles slows whatever it hits; wardens slip on the soapy puddles.', kind: 'shot', speed: 430, range: 300, clip: 8, reload: 1.0, cd: 0.2, price: 180, pack: 16, packPrice: 25, up: [180, 380] },
  confetti: { name: 'Confetti cannon', ammoName: 'confetti tubes', blurb: 'A festival burst that scatters a whole flock of magpies at once.', kind: 'burst', speed: 520, range: 320, clip: 2, reload: 1.4, cd: 0.7, price: 220, pack: 4, packPrice: 30, up: [200, 420] },
};
/** who gives which gadget in the story (free), and the stall's stock: everything, once Tock's stall opens after job 2 */
export const GEAR_GIFT: Record<string, GadgetId[]> = { m3: ['sling', 'paint'], m8: ['popper'], m11: ['bubble'], m16: ['net'], m21: ['confetti'] };
export const STALL_OPENS = 'm2';
export type GearState = { own: GadgetId[]; ammo: Record<GadgetId, number>; clip: Record<GadgetId, number>; lvl: Record<GadgetId, number>; carry: Record<Hero, GadgetId[]>; slot: Record<Hero, number> };
const zero = (): Record<GadgetId, number> => ({ sling: 0, paint: 0, popper: 0, net: 0, bubble: 0, confetti: 0 });
export const newGear = (): GearState => ({ own: [], ammo: zero(), clip: zero(), lvl: zero(), carry: { dora: [], enzo: [] }, slot: { dora: 0, enzo: 0 } });
export const clipOf = (s: Save, g: GadgetId) => Math.round(GADGETS[g].clip * (1 + 0.5 * s.gear.lvl[g]));
export const ammoCap = (s: Save, g: GadgetId) => clipOf(s, g) * 6;
export const powerOf = (s: Save, g: GadgetId) => 1 + 0.25 * s.gear.lvl[g];
/** a gadget joins the kit: loaded, a pack in the satchel, carried by whoever has a free hand (Dora first) */
export function giveGadget(s: Save, g: GadgetId) {
  const G = s.gear; if (G.own.includes(g)) return false;
  G.own.push(g); G.clip[g] = clipOf(s, g); G.ammo[g] = Math.max(G.ammo[g], GADGETS[g].pack);
  const pref: Hero[] = g === 'sling' || g === 'net' || g === 'bubble' ? ['dora', 'enzo'] : ['enzo', 'dora'];
  for (const h of pref) if (G.carry[h].length < 2) { G.carry[h].push(g); return true; }
  return true;
}
export function carried(s: Save, h: Hero): GadgetId | null { const c = s.gear.carry[h]; return c[Math.min(c.length - 1, s.gear.slot[h])] ?? null; }

export type Shot = { id: number; g: GadgetId; by: Hero; x: number; y: number; sx: number; sy: number; vx: number; vy: number; t: number; life: number; power: number; tx: number; ty: number; roof: boolean };
export type Splat = { x: number; y: number; sprite: string; t: number; life: number; rot: number; puddle?: boolean };
export type Crate = { x: number; y: number; back: number };
/** something a shot can hit: job actors, cargo snatchers, the street-event magpie, wardens, townsfolk */
export type Target = { kind: 'actor' | 'snatcher' | 'event' | 'warden' | 'ped'; x: number; y: number; r: number; fair: boolean; ref: unknown };

export function targets(w: World): Target[] {
  const out: Target[] = [];
  if (w.run) for (const a of w.run.actors) if (!a.gone && aimable(a)) out.push({ kind: 'actor', x: a.b.x, y: a.b.y, r: a.kind === 'cart' || a.kind === 'boat' || a.kind === 'boss' ? 26 : 18, fair: a.kind !== 'pip', ref: a });
  for (const m of w.snatchers) if (!m.out) out.push({ kind: 'snatcher', x: m.x, y: m.y, r: 22, fair: true, ref: m });
  const e = w.street; if (e && e.kind === 'magpie' && e.phase === 'on' && e.b) out.push({ kind: 'event', x: e.b.x, y: e.b.y, r: 18, fair: true, ref: e });
  for (const wd of w.wardens) if (!wd.leave) out.push({ kind: 'warden', x: wd.b.x, y: wd.b.y, r: 18, fair: false, ref: wd });
  for (const pd of w.peds) if (pd.sit <= 0) out.push({ kind: 'ped', x: pd.x, y: pd.y, r: 14, fair: false, ref: pd });
  return out;
}
const aimable = (a: Actor) => !['lion', 'rival-runner', 'rival-scooter', 'rival-boat', 'fare'].includes(a.kind);

/** the shooter's spot: a passenger shoots from the seat */
const origin = (p: Player): [number, number] => [p.x, p.y - (p.seat || p.ride ? 6 : 26)];
/** Assist (and the second player, who has no mouse) aims for you: the nearest fair target near the line you chose */
export function assistAim(w: World, p: Player, g: GadgetId, ax: number, ay: number, cone: number): [number, number] | null {
  const [ox, oy] = origin(p); const want = isFinite(ax) ? Math.atan2(ay - oy, ax - ox) : null; const range = GADGETS[g].range * 1.05;
  let best: Target | null = null, bs = 1e9;
  for (const t of targets(w)) {
    if (!t.fair) continue;
    const d = dist(t.x, t.y, ox, oy); if (d > range) continue;
    const off = want === null ? 0 : Math.abs(angDiff(want, Math.atan2(t.y - oy, t.x - ox)));
    if (off > cone) continue;
    const sc = d + off * 400; if (sc < bs) { bs = sc; best = t; }
  }
  if (!best) return null;
  // lead a moving target a little
  const ref = best.ref as { b?: { h: number; speed: number }; h?: number };
  const lead = dist(best.x, best.y, ox, oy) / GADGETS[g].speed;
  const h = ref.b ? ref.b.h : ref.h ?? 0, sp = ref.b ? ref.b.speed : best.kind === 'snatcher' ? 240 : 0;
  return [best.x + Math.cos(h) * sp * lead * 0.8, best.y + Math.sin(h) * sp * lead * 0.8];
}

/** who would fire now: on foot the active hero; on a ride only the passenger can (the driver's paws are on the bars) */
export function shooterFor(w: World, p: Player): Player | null {
  if (p.ride) { const m = w.mateOf(p); return m.seat === p.ride ? m : null; }
  if (p.seat) return p;
  return p;
}
export function fire(w: World, p: Player, ax: number, ay: number): string | null {
  const s = w.s, who = p.who, g = carried(s, who);
  if (!g) return s.gear.own.length ? 'Nothing in that hand: switch gadgets with 1 and 2' : 'No gadgets yet: Tock’s toy stall in the Night Market has some';
  if (p.hide || p.act || p.stunT > 0) return 'busy';
  if (p.fireCd > 0 || p.reloadT > 0) return 'busy';
  const G = s.gear, def = GADGETS[g];
  if (G.clip[g] <= 0) { if (G.ammo[g] > 0) { startReload(w, p); return 'reloading'; } return `Out of ${def.ammoName}! Supply crates and Tock’s stall have more.`; }
  const [ox, oy] = origin(p);
  let tx = ax, ty = ay;
  const auto = w.assist || !isFinite(ax);
  if (auto) { const a = assistAim(w, p, g, ax, ay, isFinite(ax) ? 0.42 : Math.PI); if (a) { tx = a[0]; ty = a[1]; } }
  if (!isFinite(tx)) { const h = p.ride ? p.ride.b.h : p.seat ? p.seat.b.h : p.b.h; tx = ox + Math.cos(h) * 200; ty = oy + Math.sin(h) * 200; }
  const ang = Math.atan2(ty - oy, tx - ox), d = Math.min(def.range, Math.max(60, dist(tx, ty, ox, oy)));
  G.clip[g]--; p.fireCd = def.cd; p.fireT = 0.3; p.fireG = g; p.aimH = ang; s.stats.shots = (s.stats.shots ?? 0) + 1;
  const pw = powerOf(s, g), roof = p.roof;
  const spread = g === 'bubble' ? [-0.14, 0, 0.14] : [0];
  for (const k of spread) {
    const a = ang + k, life = def.kind === 'lob' ? d / def.speed : def.range / def.speed * (g === 'confetti' ? 0.7 : 1);
    w.shots.push({ id: w.nextId++, g, by: who, x: ox + Math.cos(a) * 18, y: oy + Math.sin(a) * 18, sx: ox, sy: oy, vx: Math.cos(a) * def.speed, vy: Math.sin(a) * def.speed, t: 0, life, power: pw, tx: ox + Math.cos(a) * d, ty: oy + Math.sin(a) * d, roof });
  }
  w.fx.push({ t: 'fire', kind: g, x: ox, y: oy, name: who });
  if (G.clip[g] <= 0 && G.ammo[g] > 0) startReload(w, p);
  return null;
}
export function startReload(w: World, p: Player) {
  const g = carried(w.s, p.who); if (!g || p.reloadT > 0) return false;
  const G = w.s.gear; if (G.clip[g] >= clipOf(w.s, g) || G.ammo[g] <= 0) return false;
  p.reloadT = GADGETS[g].reload * (1 - 0.2 * G.lvl[g]); p.reloadG = g; w.fx.push({ t: 'reload', kind: g, x: p.x, y: p.y });
  return true;
}
export function switchSlot(w: World, p: Player, slot?: number) {
  const G = w.s.gear, c = G.carry[p.who]; if (c.length < 2) return;
  G.slot[p.who] = slot === undefined ? 1 - G.slot[p.who] : clamp(slot, 0, 1); p.reloadT = 0;
  w.fx.push({ t: 'gear-switch', kind: c[G.slot[p.who]] });
}

/** one step: cooldowns and reloads, shots in flight, their hits, splats fading, puddles tripping wardens, crates */
export function gearStep(w: World, dt: number) {
  for (const p of [w.p, w.mate]) {
    p.fireCd = Math.max(0, p.fireCd - dt); p.fireT = Math.max(0, p.fireT - dt);
    if (p.reloadT > 0) { p.reloadT -= dt; if (p.reloadT <= 0) { p.reloadT = 0; const g = p.reloadG as GadgetId; const G = w.s.gear; const k = Math.min(G.ammo[g], clipOf(w.s, g) - G.clip[g]); G.ammo[g] -= k; G.clip[g] += k; w.fx.push({ t: 'reloaded', kind: g }); } }
  }
  const tg = w.shots.length ? targets(w) : [];
  for (const sh of w.shots) {
    sh.t += dt;
    const def = GADGETS[sh.g];
    // a popper is lobbed: it flies over everything and bursts where you aimed
    if (def.kind === 'lob') { const k = Math.min(1, sh.t / sh.life); sh.x = sh.sx + (sh.tx - sh.sx) * k; sh.y = sh.sy + (sh.ty - sh.sy) * k; if (k >= 1) { burst(w, sh, tg, 110); sh.t = 1e9; } continue; }
    sh.x += sh.vx * dt; sh.y += sh.vy * dt;
    if (sh.t >= sh.life) { if (def.kind === 'burst') burst(w, sh, tg, 150); else land(w, sh); sh.t = 1e9; continue; }
    const tx = Math.floor(sh.x / T), ty = Math.floor(sh.y / T), sol = w.c.solid[ty * W + tx];
    if (!sh.roof && (sol === S.BUILDING || sol === S.TALL) || sh.roof && !(w.c.flags[ty * W + tx] & F_ROOF) && sol === S.BUILDING && sh.t > 0.6) {
      if (def.kind === 'burst') burst(w, sh, tg, 150); else { stallHit(w, sh.x, sh.y, sh.g); land(w, sh); }
      sh.t = 1e9; continue;
    }
    for (const t of tg) {
      if (dist(t.x, t.y, sh.x, sh.y) > t.r + (sh.g === 'net' ? 18 : 8)) continue;
      if (def.kind === 'burst') { burst(w, sh, tg, 150); sh.t = 1e9; break; }
      if (hit(w, t, sh.g, sh.power, sh.x, sh.y)) { land(w, sh, true); sh.t = 1e9; break; }
    }
  }
  w.shots = w.shots.filter(s => s.t < 1e8);
  for (const sp of w.splats) sp.t += dt;
  w.splats = w.splats.filter(s => s.t < s.life);
  if (w.splats.length > 60) w.splats.splice(0, w.splats.length - 60);
  // soapy puddles: a warden who rides through one slips; a cart wobbles
  for (const pd of w.splats) if (pd.puddle) {
    for (const wd of w.wardens) if (wd.stun <= 0 && dist(wd.b.x, wd.b.y, pd.x, pd.y) < 46) { wd.stun = 1.4; wd.hitKind = 'slip'; wd.hitT = 1.4; w.fx.push({ t: 'slip', x: wd.b.x, y: wd.b.y }); }
    if (w.run) for (const a of w.run.actors) if (a.kind === 'cart' && a.stun <= 0 && dist(a.b.x, a.b.y, pd.x, pd.y) < 50) { a.stun = 0.5; w.fx.push({ t: 'wobble', x: a.b.x, y: a.b.y }); }
  }
  for (const [k, t] of w.stallSplat) { const n = t - dt; if (n <= 0) w.stallSplat.delete(k); else w.stallSplat.set(k, n); }
  crateStep(w);
}
function land(w: World, sh: Shot, onTarget = false) {
  const sprite = sh.g === 'sling' ? 'sp-rice' : sh.g === 'paint' ? (sh.id % 2 ? 'sp-pink' : 'sp-teal') : sh.g === 'net' ? (onTarget ? '' : 'sp-net') : sh.g === 'bubble' ? 'sp-puddle' : '';
  if (sprite) w.splats.push({ x: sh.x, y: sh.y, sprite, t: 0, life: sh.g === 'bubble' ? 6 : sh.g === 'net' ? 2.5 : 9, rot: (sh.id % 7) * 0.9, puddle: sh.g === 'bubble' });
  w.fx.push({ t: 'shot-land', kind: sh.g, x: sh.x, y: sh.y });
}
/** a popper or confetti bursts: everything within reach reacts */
function burst(w: World, sh: Shot, tg: Target[], r: number) {
  const R = r * (0.85 + 0.15 * sh.power);
  w.splats.push({ x: sh.x, y: sh.y, sprite: sh.g === 'popper' ? 'sp-pop' : 'sp-confetti', t: 0, life: sh.g === 'popper' ? 0.7 : 1.4, rot: 0 });
  w.fx.push({ t: 'burst', kind: sh.g, x: sh.x, y: sh.y });
  for (const t of tg) if (dist(t.x, t.y, sh.x, sh.y) < R + t.r) hit(w, t, sh.g, sh.power, sh.x, sh.y);
  if (w.run) w.run.onBurst(sh.g, sh.x, sh.y, R);
}

/** what a hit does; returns true when the shot is used up */
export function hit(w: World, t: Target, g: GadgetId, pw: number, x: number, y: number): boolean {
  switch (t.kind) {
    case 'actor': return w.run ? w.run.onGadget(t.ref as Actor, g, pw, x, y) : false;
    case 'snatcher': {
      const m = t.ref as World['snatchers'][number]; if (m.out) return false;
      m.out = true; m.dizzy = 1.2;
      if (m.took > 0 && m.good) { w.s.cargo[m.good as Good] += m.took; w.say(`The magpie dropped your ${GOOD[m.good as Good].name.toLowerCase()}!`, 'good'); m.took = 0; }
      else w.say(g === 'confetti' ? 'Confetti! The magpie flaps off in a fluster.' : 'Bonk! The dizzy magpie flaps away empty-clawed.', 'good');
      w.fx.push({ t: 'dizzy', x: m.x, y: m.y, kind: g }); return true;
    }
    case 'event': { const e = t.ref as NonNullable<World['street']>; if (g === 'bubble') { if (e.b) e.b.speed *= 0.3; e.slowT = 2; return true; } catchEventMagpie(w, e); return true; }
    case 'warden': {
      const wd = t.ref as World['wardens'][number];
      const stun = { sling: 0.8, paint: 1.5, popper: 1.2, net: 2.5, bubble: 1.4, confetti: 0.5 }[g] * pw;
      wd.stun = Math.max(wd.stun, stun); wd.hitKind = g === 'paint' ? 'paint' : g === 'bubble' ? 'slip' : g === 'net' ? 'net' : 'dazed'; wd.hitT = stun;
      addHeat(w, g === 'confetti' ? 0.15 : 0.3, 'gadget');
      w.fx.push({ t: 'warden-hit', kind: g, x: wd.b.x, y: wd.b.y }); w.fx.push({ t: 'whistle', x: wd.b.x, y: wd.b.y });
      if (!w.s.learned.includes('warden-hit')) { w.s.learned.push('warden-hit'); w.say('Hitting a warden brings more heat! Aim for the magpies.', 'bad'); }
      return true;
    }
    case 'ped': {
      const pd = t.ref as World['peds'][number]; pd.scare = 1;
      if (g === 'confetti') { w.fx.push({ t: 'cheer', x: pd.x, y: pd.y }); return false; }
      pd.splat = g === 'paint' ? 'sp-pink' : g === 'sling' ? 'sp-rice' : ''; pd.splatT = 4;
      addHeat(w, 0.15, 'gadget'); w.fx.push({ t: 'ped-hit', kind: g, x: pd.x, y: pd.y });
      return true;
    }
  }
  return false;
}
/** a shot that splats into a stall awning: the stallholder is cross (a little heat, once in a while) */
export function stallHit(w: World, x: number, y: number, g: GadgetId) {
  if (g === 'popper' || g === 'confetti') return;
  let best = -1, bd = 90;
  w.c.props.forEach((p, i) => { if (!p.sprite.startsWith('stall')) return; const d = dist(p.x, p.y, x, y); if (d < bd) { bd = d; best = i; } });
  if (best < 0) return;
  const was = w.stallSplat.has(best);
  w.stallSplat.set(best, 30);
  w.fx.push({ t: 'stall-splat', x, y, kind: g });
  if (!was) { addHeat(w, 0.12, 'gadget'); w.say('Oi! My awning! The stallholder shakes a fist.', 'bad'); }
}
/** the street magpie caught by a shot or a pounce: the same reward as a dash */
export function catchEventMagpie(w: World, e: NonNullable<World['street']>) { e.caught = true; }

/** supply crates: a few around each district's market, safe house and garage; walk or ride into one for ammo */
export function makeCrates(w: World): Crate[] {
  const out: Crate[] = [];
  for (const pl of Object.values(w.c.places)) {
    if (pl.kind !== 'market' && pl.kind !== 'safe' && pl.kind !== 'garage') continue;
    const [x, y] = nearestFree(w.c, 'walk', pl.x + 2.2 * T, pl.y + 1.4 * T, new Set([pl.d]), 5);
    out.push({ x, y, back: 0 });
  }
  return out;
}
function crateStep(w: World) {
  if (!w.s.gear.own.length) return;
  for (const c of w.crates) {
    if (c.back > w.time || !w.open.has(districtAt(Math.floor(c.x / T), Math.floor(c.y / T)))) continue;
    const near = [w.p, w.mate].some(p => !p.roof && dist(p.x, p.y, c.x, c.y) < (p.ride || p.seat ? 60 : 40));
    if (!near) continue;
    c.back = w.time + 150;
    const got: string[] = [];
    for (const g of w.s.gear.own) { const before = w.s.gear.ammo[g]; w.s.gear.ammo[g] = Math.min(ammoCap(w.s, g), before + GADGETS[g].pack); if (w.s.gear.ammo[g] > before) got.push(GADGETS[g].ammoName); }
    w.fx.push({ t: 'crate', x: c.x, y: c.y });
    w.say(got.length ? `Supply crate: ${got.slice(0, 3).join(', ')}${got.length > 3 ? ' and more' : ''}` : 'Supply crate: your satchel is already full.', 'good');
  }
}

// ── Tock's toy stall: buy a gadget, ammo packs and upgrades; choose what each hero carries
export function buyGadget(s: Save, g: GadgetId): string | null {
  if (s.gear.own.includes(g)) return 'You have one already';
  if (s.cash < GADGETS[g].price) return 'Not enough coins';
  s.cash -= GADGETS[g].price; giveGadget(s, g); return null;
}
export function buyAmmo(s: Save, g: GadgetId): string | null {
  if (!s.gear.own.includes(g)) return 'Buy the gadget first';
  if (s.gear.ammo[g] >= ammoCap(s, g)) return 'Your satchel is full';
  if (s.cash < GADGETS[g].packPrice) return 'Not enough coins';
  s.cash -= GADGETS[g].packPrice; s.gear.ammo[g] = Math.min(ammoCap(s, g), s.gear.ammo[g] + GADGETS[g].pack); return null;
}
export function upgradeGadget(s: Save, g: GadgetId): string | null {
  const l = s.gear.lvl[g]; if (!s.gear.own.includes(g)) return 'Buy the gadget first';
  if (l >= 2) return 'Fully tuned';
  const c = GADGETS[g].up[l]; if (s.cash < c) return 'Not enough coins';
  s.cash -= c; s.gear.lvl[g] = l + 1; s.gear.clip[g] = clipOf(s, g); return null;
}
/** hand a gadget to a hero (each carries two; giving a third swaps out the one in their other hand) */
export function carry(s: Save, h: Hero, g: GadgetId): string | null {
  if (!s.gear.own.includes(g)) return 'Buy the gadget first';
  const other: Hero = h === 'dora' ? 'enzo' : 'dora';
  const C = s.gear.carry; if (C[h].includes(g)) return null;
  C[other] = C[other].filter(x => x !== g);
  if (C[h].length >= 2) C[h][s.gear.slot[h]] = g; else C[h].push(g);
  return null;
}
void clamp;
