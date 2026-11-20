// Jade Street drawing for the duo and the gadgets: both heroes (the one you play and the partner), the passenger on
// the back seat, the tag-team and firing poses, shots in flight (a lobbed popper arcs), splats and soapy puddles,
// supply crates, splattered awnings, netted carts, painted wardens, the job props the two of you work with (levers,
// the canal lock, the yard shutter, the bunting pulley, boost crates, the window lookout, the loot-bag crow), Tock's
// stall, the aim line and the ring under the hero you control. All painted sprites; code adds only light and shadow.
import { slingLift } from './jade-southdraw.js';
import { T } from './jade-city.js';
import { VEHICLES, OWN_COPY, type VehicleKind } from './jade-move.js';
import { OUTFITS } from './jade-save.js';
import { GADGETS, carried, stallPos, stallOpen, type GadgetId } from './jade-gear.js';
import { BOOSTS, boostXY } from './jade-tag.js';
import { holding } from './jade-team.js';
import { spr, heroFrame, type Scene } from './jade-scene.js';
import type { World, Player, Ride } from './jade-game.js';
import type { Actor } from './jade-mission.js';

type X = CanvasRenderingContext2D;
type List = [number, () => void][];
type Vis = (px: number, py: number, m?: number) => boolean;
const faceOf = (h: number): 'side' | 'down' | 'up' => Math.abs(Math.cos(h)) > Math.abs(Math.sin(h)) * 0.9 ? 'side' : Math.sin(h) > 0 ? 'down' : 'up';

/** the frame for a hero's pose, including the duo's own moves and the firing poses */
export function duoFrame(p: Player, t: number): { f: string; flip: boolean } {
  const h = p.who, cyc = (n: number, fps: number) => Math.floor(t * fps) % n;
  if (p.fireT > 0 && p.fireG && !p.ride) {
    const fc = faceOf(p.aimH);
    return { f: `${h}-fire-${p.fireG}-${fc === 'side' ? 'side' : 'down'}`, flip: fc === 'side' ? Math.cos(p.aimH) < 0 : fc === 'up' };
  }
  const anim = p.reloadT > 0 && p.b.speed < 8 && !p.act ? 'reload' : p.anim;
  const flip = p.face === 'side' && p.flip;
  switch (anim) {
    case 'boost-give': return { f: `${h}-boost-give`, flip: false };
    case 'boost-rise': return { f: `${h}-boost-rise`, flip: false };
    case 'hold': return { f: `${h}-hold-${cyc(2, 2)}`, flip: false };
    case 'haul': return { f: `${h}-haul-${cyc(2, 3)}`, flip };
    case 'distract': return { f: `${h}-distract-${cyc(2, 3)}`, flip: false };
    case 'pounce': return { f: p.face === 'side' ? `${h}-pounce-side` : `${h}-pounce-down`, flip };
    case 'snatch': return { f: `${h}-snatch`, flip };
    case 'reload': return { f: `${h}-reload`, flip: false };
    case 'fire': return { f: `${h}-fire-sling-down`, flip: false };
    // the job steps (lib/jade-jobs.ts): casing, the clue notebook, searching, nets, the crate swap, the safe, the disguise
    case 'photo': return { f: t > (p.act?.dur ?? 0.75) * 0.6 ? `${h}-photo-flash` : `${h}-photo`, flip };
    case 'notes': return { f: `${h}-notes`, flip: false };
    case 'search': return { f: `${h}-search-${t > 0.75 ? 1 : 0}`, flip: false };
    case 'set-trap': return { f: `${h}-set-trap`, flip: false };
    case 'spring': return { f: `${h}-spring`, flip };
    case 'crate-swap': return { f: `${h}-swap-${t > (p.act?.dur ?? 1.5) * 0.65 ? 1 : 0}`, flip };
    case 'safe': return { f: `${h}-safe`, flip };
    case 'triumph': return { f: `${h}-triumph`, flip: false };
    case 'whistle': return { f: `${h}-whistle`, flip: false };
    case 'paper': return { f: `${h}-dis-paper`, flip: false };
    case 'disguise-on': return { f: `${h}-dis-on`, flip: false };
    // the partner on their own (lib/jade-pal.ts) and the branches (lib/jade-jobs.ts): a whispered warning, a wind-up
    // before their own shot, scooping up loot, beckoning you to the getaway, curling up, tidying the stand, the kopi
    // bribe, the wok-lid commotion
    case 'psst-side': return { f: `${h}-psst-side`, flip };
    case 'psst-down': return { f: `${h}-psst-down`, flip };
    case 'ready': return { f: `${h}-ready`, flip };
    case 'scoop': return { f: `${h}-scoop`, flip };
    case 'beckon': return { f: `${h}-beckon`, flip };
    case 'cower': return { f: `${h}-cower`, flip: false };
    case 'peek': return { f: `${h}-peek`, flip };
    case 'brace': return { f: `${h}-brace`, flip: false };
    case 'bribe': return { f: `${h}-bribe`, flip };
    case 'hold-bag': return { f: `${h}-hold-bag`, flip: false };
    case 'gong': return { f: `${h}-gong-${cyc(2, 4)}`, flip: false };
  }
  // in the spy disguise: its own walk (a stroll in the trench coat), and standing still in it
  if (p.disguise && !p.ride) {
    const moving = anim === 'walk' || anim === 'run' || anim === 'sneak' || anim === 'dash' || anim === 'hop';
    const fc = p.face, k = moving ? cyc(2, anim === 'walk' || anim === 'sneak' ? 4 : 7) : 0;
    return { f: `${h}-dis-${fc}-${k}`, flip };
  }
  // the Singapore carries have their own poses (a kopi tray, a durian crate held at arm's length, a festival lantern)
  const held = p.carry ? SG_CARRY[p.carry] : undefined;
  if (held && anim.startsWith('carry')) return { f: `${h}-${held}-${p.face === 'side' ? 'side' : 'down'}`, flip };
  if (SG_ACTS.has(anim)) return { f: `${h}-${anim}`, flip };
  return { f: heroFrame(h, anim, p.face, t), flip };
}

/** one hero on foot (or on their own ride, with any passenger), at their spot */
export function drawHero(sc: Scene, x: X, w: World, p: Player, active: boolean) {
  const h = p.who, of = OUTFITS.findIndex(o => o.id === w.s.outfit[h]);
  const variant = of > 0 ? `${h}:${of}` : '';
  if (p.seat) return; // drawn with the ride
  if (p.ride) { sc.ride(x, w, p.ride, active); driver(sc, x, w, p, p.ride, variant); passenger(sc, x, w, p.ride); return; }
  const hop = p.anim === 'umbrella' ? Math.abs(Math.sin(p.animT * 7)) * 2 : p.anim === 'hop' ? Math.sin(Math.min(1, 1 - p.hopT / 0.42) * Math.PI) * 26 : p.anim === 'climb' ? Math.sin(p.act ? p.act.t * 12 : 0) * 6 + 10 : p.anim === 'boost-rise' && p.act ? Math.sin(Math.min(1, p.act.t / p.act.dur) * Math.PI * 0.5) * 40 : p.anim === 'sling' && p.act ? slingLift(p.act.t) : 0;
  x.fillStyle = 'rgba(0,0,0,.35)'; sc.shadow(x, p.b.x, p.b.y + 2, Math.max(3, 16 - hop * 0.2), Math.max(1.5, 7 - hop * 0.08));
  // the hero you control stands on a soft ring of light (gold for Dora, blue for Enzo) so you always know who you are
  if (active && (w.two || dist2(w.p, w.mate) < 400 * 400)) ring(x, p.b.x, p.b.y + 2, p.who === 'dora' ? '255,210,120' : '140,200,255', w.two ? 0.5 : 0.32);
  if (p.anim === 'dash' || p.anim === 'pounce') sc.puff(p.b.x - Math.cos(p.b.h) * 14, p.b.y + 4, '#d8d0e8');
  const { f, flip } = duoFrame(p, p.act ? p.act.t : p.animT);
  const [qx, qy] = sc.juice.squash(p.anim, 1 - p.hopT / 0.42), fy = p.b.y + 4 - hop;
  if (qx !== 1 || qy !== 1) { x.save(); x.translate(p.b.x, fy); x.scale(qx, qy); x.translate(-p.b.x, -fy); }
  spr(x, f, p.b.x, fy, { flip, variant, alpha: p.hide ? 0.55 : 1 }) || spr(x, `${h}-idle-down`, p.b.x, p.b.y + 4, { variant });
  if (qx !== 1 || qy !== 1) x.restore();
  if (p.carry && !p.anim.startsWith('carry')) spr(x, itemOf(p.carry), p.b.x, p.b.y - 54 - hop, { w: 28 });
  if (p.anim === 'umbrella' && p.face !== 'down') spr(x, 'umb-red', p.b.x, p.b.y - 46, { w: 46, anchor: 'center' });
  // a held gadget in the hand shows as its icon at the hip while walking (the firing poses paint it in the paws)
  if (p.fireT <= 0 && !p.hide && !p.act && p.b.speed < 8 && active) { const g = carried(w.s, p.who); if (g) spr(x, `g-${g}`, p.b.x + (p.flip ? -14 : 14), p.b.y - 10, { w: 18, anchor: 'center', alpha: 0.95 }); }
}
const dist2 = (a: Player, b: Player) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
let itemOf: (s: string) => string = s => s;
const SG_CARRY: Record<string, string> = { 'kopi-tray': 'tray', durian: 'durian', lantern: 'lantern' };
const SG_ACTS = new Set(['chope', 'chope-done', 'serve', 'sell-junk', 'shake-wet', 'sit-chess', 'feed', 'gum', 'pay-fine', 'ticket', 'toss', 'pick-litter', 'bin-litter', 'shiok']);
export function setItemSprite(f: (s: string) => string) { itemOf = f; }
function ring(x: X, px: number, py: number, rgb: string, a: number) {
  x.save(); x.globalCompositeOperation = 'lighter';
  const g = x.createRadialGradient(px, py, 4, px, py, 26); g.addColorStop(0, `rgba(${rgb},0)`); g.addColorStop(0.7, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = g; x.beginPath(); x.ellipse(px, py, 26, 11, 0, 0, Math.PI * 2); x.fill(); x.restore();
}
/** where each hero sits on the fifteenth pass's rides: along the ride (a share of its length, + forward) and across it
 * (world units, + to the rider's right): the tandem's two saddles, the motorbike and its sidecar on the right, the
 * luge's one seat, the dragon boat's paddler amidships and its drummer at the bow */
const SEAT: Partial<Record<VehicleKind, { drv: [number, number]; pas?: [number, number] }>> = {
  tandem: { drv: [0.25, 0], pas: [-0.3, 0] }, icecream: { drv: [-0.05, -12], pas: [-0.22, 16] }, luge: { drv: [-0.25, 0] }, dragon: { drv: [-0.21, 0], pas: [0.33, 0] },
};
const at = (r: Ride, [fwd, side]: [number, number]): [number, number] => {
  const h = r.b.h, len = VEHICLES[r.kind].len;
  return [r.b.x + Math.cos(h) * len * fwd + Math.cos(h + Math.PI / 2) * side, r.b.y + Math.sin(h) * len * fwd + Math.sin(h + Math.PI / 2) * side];
};
/** the riding frames of a kind (the driver's, or the partner riding their own copy of a one-seat ride) */
function rideFrame(h: string, k: VehicleKind, sc: Scene, r: Ride, half = 0): string {
  const pedal = Math.floor(sc.t * (2 + r.b.speed / 45) + half) % 2;
  switch (k) {
    // the hired bike and the tandem's front saddle: their own pedalling pairs, faster the quicker you ride
    case 'bike': return `${h}-ride-bike-${pedal}`;
    case 'tandem': return `${h}-ride-tandem-${pedal}`;
    // the motorbike: ears flapping in the wind; the luge: leaning one way then the other down the slope
    case 'icecream': return `${h}-ride-moto-${Math.floor(sc.t * (2 + r.b.speed / 90)) % 2}`;
    case 'luge': return `${h}-ride-luge-${Math.floor(sc.t * 1.6 + half) % 2}`;
    // the dragon boat's paddle, left then right, quicker with speed
    case 'dragon': return `${h}-ride-paddle-${Math.floor(sc.t * (1.2 + r.b.speed / 140)) % 2}`;
  }
  return '';
}
/** what the last frame drew on the ride (the browser tests check both heroes are really drawn) */
export const RIDE_DRAWN: { driver: string; partner: string; t: number } = { driver: '', partner: '', t: 0 };
function driver(sc: Scene, x: X, w: World, p: Player, r: Ride, variant: string) {
  const h = p.who, k = r.kind; const fwd = k === 'trishaw' ? -0.3 : k === 'boat' ? -0.32 : 0.02;
  let [rx, ry] = SEAT[k] ? at(r, SEAT[k]!.drv) : [r.b.x + Math.cos(r.b.h) * VEHICLES[k].len * fwd, r.b.y + Math.sin(r.b.h) * VEHICLES[k].len * fwd];
  let f = '';
  if (p.anim === 'ride-bump') { f = `${h}-ride-bump`; if (k === 'luge' || k === 'dragon') [rx, ry] = [r.b.x, r.b.y]; }
  else if (k === 'scooter') f = w.banner?.text === 'Job done!' ? `${h}-ride-cheer` : `${h}-ride-scooter-${Math.sin(sc.t * 3) > 0 ? 0 : 1}`;
  else if (k === 'trishaw') f = `${h}-ride-pedal-${Math.floor(sc.t * (2 + r.b.speed / 50)) % 2}`;
  else if (k === 'boat') f = `${h}-ride-pole-${Math.floor(sc.t * 1.5) % 2}`;
  else f = rideFrame(h, k, sc, r);
  RIDE_DRAWN.driver = f && spr(x, f, rx, ry, { anchor: 'center', rot: r.b.h + Math.PI / 2, variant }) ? f : ''; RIDE_DRAWN.partner = ''; RIDE_DRAWN.t = sc.t;
  if (p.carry) spr(x, itemOf(p.carry), r.b.x, r.b.y, { w: 26, anchor: 'center', rot: r.b.h + Math.PI / 2 });
}
/** a one-seat ride (the hired bike, the luge cart): the partner rides their own copy a length behind the driver's and a
 * lane to the side, at the same pace and half a stroke out of step, so the two pairs of legs don't move as one */
function companion(sc: Scene, x: X, r: Ride, who: string, variant: string): string {
  const v = VEHICLES[r.kind], len = v.len, h = r.b.h, side = h + Math.PI / 2;
  const bx = r.b.x - Math.cos(h) * len * 0.95 + Math.cos(side) * 24, by = r.b.y - Math.sin(h) * len * 0.95 + Math.sin(side) * 24;
  x.fillStyle = 'rgba(0,0,0,.32)'; sc.shadow(x, bx + 5, by + 7, len * 0.45, v.r * 0.9);
  spr(x, 'v-' + r.kind, bx, by, { anchor: 'center', rot: h + Math.PI / 2 });
  const f = rideFrame(who, r.kind, sc, r, 0.5), [fx, fy] = SEAT[r.kind]?.drv ?? [0.02, 0];
  return spr(x, f, bx + Math.cos(h) * len * fx + Math.cos(side) * fy, by + Math.sin(h) * len * fx + Math.sin(side) * fy, { anchor: 'center', rot: h + Math.PI / 2, variant }) ? f : '';
}
/** the partner's seat pose on a two-seat ride of the fifteenth pass: the tandem's back saddle, the sidecar, the drum */
function seatFrame(who: string, k: VehicleKind, sc: Scene, r: Ride): string {
  if (k === 'tandem') return `${who}-tandem-back-${Math.floor(sc.t * (2 + r.b.speed / 45) + 0.5) % 2}`;
  if (k === 'icecream') return `${who}-sidecar-${Math.floor(sc.t * 0.7) % 2}`;
  if (k === 'dragon') return `${who}-drum-${Math.floor(sc.t * (1.8 + r.b.speed / 120)) % 2}`;
  return '';
}
/** the partner on the back seat (scooters, boats and the new two-seaters show them; a tuk-tuk, a van and a trishaw's
 * cab hide them; a one-seat ride gives them their own copy) */
export function passenger(sc: Scene, x: X, w: World, r: Ride) {
  const m = w.mate.seat === r ? w.mate : w.p.seat === r ? w.p : null; if (!m) return;
  const of = OUTFITS.findIndex(o => o.id === w.s.outfit[m.who]); const variant = of > 0 ? `${m.who}:${of}` : '';
  if (OWN_COPY.has(r.kind)) { RIDE_DRAWN.partner = companion(sc, x, r, m.who, variant); return; }
  const own = SEAT[r.kind]?.pas;
  // pillion on a scooter, on the bench of a trishaw, in the bow of a boat; a tuk-tuk or van carries them inside the cab
  if (!own && r.kind !== 'scooter' && r.kind !== 'boat' && r.kind !== 'trishaw') return;
  const back = r.kind === 'boat' ? 0.12 : r.kind === 'trishaw' ? 0.2 : -0.26;
  const [px, py] = own ? at(r, own) : [r.b.x + Math.cos(r.b.h) * VEHICLES[r.kind].len * back, r.b.y + Math.sin(r.b.h) * VEHICLES[r.kind].len * back];
  // which side the passenger leans to: toward what they aim at or grab
  const side = Math.sin(m.aimH - r.b.h) < 0;
  let f = own ? seatFrame(m.who, r.kind, sc, r) : `${m.who}-pass-${Math.floor(sc.t * 1.2) % 2}`, flip = false;
  switch (m.anim) {
    case 'pass-aim': f = `${m.who}-pass-aim`; flip = side; break;
    case 'pass-grab': f = `${m.who}-pass-grab`; flip = side; break;
    case 'pass-hold': if (!own) f = `${m.who}-pass-sit`; break;
    case 'pass-cheer': f = `${m.who}-pass-cheer`; break;
    case 'pass-duck': f = `${m.who}-pass-duck`; break;
    case 'pass-wave': f = `${m.who}-pass-wave`; break;
  }
  if (spr(x, f, px, py, { anchor: 'center', rot: r.b.h + Math.PI / 2, variant, flip })) RIDE_DRAWN.partner = f;
}

// ── gadgets in the world
export function gearGround(sc: Scene, x: X, w: World, vis: Vis) {
  for (const s of w.splats) if (vis(s.x, s.y)) {
    const a = Math.min(1, (s.life - s.t) / 1.2), k = s.sprite === 'sp-pop' || s.sprite === 'sp-confetti' ? 0.6 + s.t * 1.2 : 1;
    spr(x, s.sprite, s.x, s.y, { anchor: 'center', w: (s.puddle ? 70 : s.sprite.startsWith('sp-p') || s.sprite === 'sp-confetti' ? 90 : 46) * k, rot: s.puddle ? 0 : s.rot, alpha: a });
  }
  if (w.s.gear.own.length) for (const c of w.crates) if (vis(c.x, c.y)) {
    const full = c.back <= w.time;
    if (full) sc.glow(x, c.x, c.y - 8, 34, 'rgba(255,90,70,.28)');
  }
}
export function gearSorted(sc: Scene, x: X, w: World, list: List, vis: Vis) {
  if (w.s.gear.own.length) for (const c of w.crates) if (vis(c.x, c.y)) list.push([c.y, () => { x.fillStyle = 'rgba(0,0,0,.3)'; sc.shadow(x, c.x, c.y + 4, 22, 8); spr(x, c.back <= w.time ? 'crate-shut' : 'crate-open', c.x, c.y + 8, { w: 52 }); }]);
  if (stallOpen(w.s)) { const [sx, sy] = stallPos(w); if (vis(sx, sy, 240)) list.push([sy + 20, () => { x.fillStyle = 'rgba(0,0,0,.3)'; sc.shadow(x, sx, sy + 14, 80, 18); spr(x, 'gadget-stall', sx, sy + 24, { w: 170 }); sc.glow(x, sx, sy - 70, 70, 'rgba(255,200,120,.22)'); }]); }
  for (const [i, t] of w.stallSplat) { const pr = sc.c.props[i]; if (pr && vis(pr.x, pr.y)) list.push([pr.y + 21, () => spr(x, 'awning-splat', pr.x, pr.y - 50, { w: 80, anchor: 'center', alpha: Math.min(1, t / 3) })]); }
  // boost crates against the roof walls, in the open districts
  BOOSTS.forEach((b, i) => { const [bx, by] = boostXY(i, false); if (vis(bx, by) && w.open.has(b.g[0] < 46 ? 'market' : 'arcade')) list.push([by - 20, () => spr(x, 'boost-spot', bx + 10, by + 22, { w: 58 })]); });
  // the job's own props
  const run = w.run, st = run?.cur;
  if (run && st) {
    if (st.t === 'hold') {
      const [lx, ly] = run.spot(st.lever), held = holding(run);
      list.push([ly, () => spr(x, held ? 'lever-down' : 'lever-up', lx, ly + 12, { w: 40 })]);
      for (const [gx, gy] of st.gate) { const px = gx * T + T / 2, py = gy * T + T / 2; list.push([py - 30, () => spr(x, held ? 'sluice-open' : 'sluice-shut', px, py + 20, { w: T * 1.05 })]); }
    }
    if (st.t === 'stealth' && st.shutter && run.phase === 0) {
      const [lx, ly] = run.spot(st.shutter), [gx, gy] = run.spot(st.goal), held = holding(run);
      list.push([ly, () => spr(x, held ? 'lever-down' : 'lever-up', lx, ly + 12, { w: 40 })]);
      list.push([gy - 34, () => spr(x, held ? 'shutter-open' : 'shutter-shut', gx, gy - 14, { w: 84 })]);
    }
    if (st.t === 'float' && st.rope) { const [rx, ry] = run.spot(st.rope); list.push([ry, () => { spr(x, 'pulley', rx, ry + 14, { w: 52 }); if (holding(run)) sc.glow(x, rx, ry - 20, 40, 'rgba(255,220,140,.3)'); }]); }
    for (const a of run.actors) if (a.kind === 'window' && vis(a.b.x, a.b.y)) list.push([a.b.y + 30, () => windowLookout(sc, x, w, a)]);
  }
}
function windowLookout(sc: Scene, x: X, w: World, a: Actor) {
  const blind = (a.extra2 ?? 0) > 0;
  spr(x, blind ? 'window-paint' : 'window-lookout', a.b.x, a.b.y + 10, { w: 74 });
  if (!blind && !((a.stare ?? 0) > 0)) sc.beam(x, a.b.x, a.b.y + 30, a.b.h, 360, 0.62);
  if ((a.stare ?? 0) > 0) sc.stars(x, a.b.x, a.b.y - 40);
}
/** overhead: shots in flight (a popper arcs), the loot-bag crow, nets over carts */
export function gearOver(sc: Scene, x: X, w: World, vis: Vis) {
  for (const s of w.shots) if (vis(s.x, s.y)) {
    const def = GADGETS[s.g];
    let lift = 0, rot = Math.atan2(s.vy, s.vx) + Math.PI / 2;
    if (def.kind === 'lob') { const k = Math.min(1, s.t / s.life); lift = Math.sin(k * Math.PI) * 70; rot = s.t * 12; }
    x.fillStyle = 'rgba(0,0,0,.25)'; sc.shadow(x, s.x, s.y + 6, 7, 3);
    // a light trail behind the shot (code light only)
    x.save(); x.globalCompositeOperation = 'lighter'; x.strokeStyle = TRAIL[s.g]; x.lineWidth = 4; x.lineCap = 'round';
    x.beginPath(); x.moveTo(s.x - s.vx * 0.03, s.y - s.vy * 0.03 - lift); x.lineTo(s.x, s.y - lift); x.stroke(); x.restore();
    spr(x, s.g === 'net' && s.t > 0.12 ? 'net-open' : `shot-${s.g}`, s.x, s.y - lift, { anchor: 'center', w: s.g === 'net' ? (s.t > 0.12 ? 58 : 30) : s.g === 'bubble' ? 26 : 22, rot });
  }
  const run = w.run; if (!run) return;
  for (const a of run.actors) {
    if (a.kind === 'bagbird' && !a.gone) {
      const low = (a.extra ?? 0) > 0;
      sc.flyer(x, a.b.x, a.b.y, a.b.h + (a.stun > 0 ? sc.t * 12 : 0), a.t * 9, a.skin === 'myna' ? 'myna' : a.skin === 'bat' ? 'bat' : 'crow');
      spr(x, run.cur?.t === 'bag' && run.cur.loot === 'firebox' ? 'firebox' : 'loot-bag', a.b.x, a.b.y + 26, { w: 34, anchor: 'center' });
      if (low) sc.glow(x, a.b.x, a.b.y, 60, 'rgba(255,240,120,.35)');
    }
    if (a.kind === 'cart' && (a.netT ?? 0) > 0) spr(x, 'cart-netted', a.b.x, a.b.y, { anchor: 'center', rot: a.b.h + Math.PI / 2, w: 92, alpha: Math.min(1, (a.netT ?? 0) * 2) });
    if ((a.kind === 'lookout') && (a.extra2 ?? 0) > 0) spr(x, 'sp-pink', a.b.x, a.b.y - 40, { anchor: 'center', w: 36 });
  }
}
const TRAIL: Record<GadgetId, string> = { sling: 'rgba(255,255,240,.4)', paint: 'rgba(255,120,200,.5)', popper: 'rgba(255,200,80,.6)', net: 'rgba(220,200,150,.35)', bubble: 'rgba(150,230,255,.5)', confetti: 'rgba(255,220,120,.5)' };

/** a warden hit by a gadget shows it (painted, slipping, dazed); returns the frame to draw instead, if any */
export function wardenHitFrame(wd: World['wardens'][number]): string | null {
  if (!wd.hitT || wd.hitT <= 0) return null;
  return wd.hitKind === 'paint' ? 'warden-paint' : wd.hitKind === 'slip' ? 'warden-slip' : wd.hitKind === 'net' ? 'warden-dazed' : 'warden-dazed';
}

/** the aim line from the hero who would fire to the mouse (code light only), and the assist target ring */
export function aimLine(sc: Scene, x: X, w: World, aim: { x: number; y: number; on: boolean } | null, sh: Player | null) {
  if (!aim || !aim.on || !sh) return;
  const g = carried(w.s, sh.who); if (!g) return;
  const def = GADGETS[g], ox = sh.x, oy = sh.y - 24;
  const a = Math.atan2(aim.y - oy, aim.x - ox), d = Math.min(def.range, Math.hypot(aim.x - ox, aim.y - oy));
  x.save(); x.globalCompositeOperation = 'lighter'; x.setLineDash([6, 10]); x.lineDashOffset = -sc.t * 30;
  x.strokeStyle = 'rgba(255,240,200,.35)'; x.lineWidth = 3;
  x.beginPath(); x.moveTo(ox, oy);
  if (def.kind === 'lob') x.quadraticCurveTo(ox + Math.cos(a) * d / 2, oy + Math.sin(a) * d / 2 - 90, ox + Math.cos(a) * d, oy + Math.sin(a) * d); else x.lineTo(ox + Math.cos(a) * d, oy + Math.sin(a) * d);
  x.stroke(); x.setLineDash([]);
  x.strokeStyle = 'rgba(255,240,200,.5)'; x.beginPath(); x.arc(ox + Math.cos(a) * d, oy + Math.sin(a) * d, def.kind === 'shot' ? 10 : 24, 0, Math.PI * 2); x.stroke();
  x.restore();
}
