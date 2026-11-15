// Jade Street: the fine city. Raccoon ticket wardens stroll the pavements with their little notebooks, and road cameras
// watch the lights, the silver zones and the bumboat and tuk-tuk ranks. Jaywalking (on the road away from a zebra, or
// on a zebra against the lights), littering (a gadget's splat counts), chewing gum, feeding the pigeons, speeding and
// running a red light each have a fine; a durian on the bumboat or in a tuk-tuk too. A warden who sees you walks up
// with a ticket: pay it (E) and the heat rises a touch; run off and it becomes a chase (a lantern). Camera tickets
// arrive by text and are paid on the spot. Repeat offences cost more. Careful players rarely see a ticket: the first
// offence of each kind on Easy is a warning, and on Easy a warden lets you off with a warning during a job. Some
// wardens ride little scooters along the roads (more of them on the island): they see further, pull riders over for
// speeding, red lights and riding along the five-foot way, and chase a rider who drives off with a ticket.
import { T, W, G, OW, districtAt } from './jade-city.js';
import { drive, type Body } from './jade-move.js';
import { los, downhill, nearestFree } from './jade-nav.js';
import { dist, clamp } from './jade-rng.js';
import { pedTile } from './jade-folk.js';
import { addHeat } from './jade-heat.js';
import { LIGHTS, lightOf } from './jade-traffic.js';
import { ROADS } from './jade-city.js';
import { text } from './jade-phone.js';
import type { World } from './jade-game.js';

export type Offence = 'jaywalk' | 'litter' | 'gum' | 'durian' | 'pigeons' | 'speeding' | 'red' | 'pavement';
export const OFFENCES: Offence[] = ['jaywalk', 'litter', 'gum', 'durian', 'pigeons', 'speeding', 'red', 'pavement'];
export const FINE: Record<Offence, { name: string; amt: number; quip: string }> = {
  jaywalk: { name: 'Jaywalking', amt: 20, quip: 'Use the zebra crossing, can or not?' },
  litter: { name: 'Littering', amt: 30, quip: 'This city is clean, you know. Clean!' },
  gum: { name: 'Chewing gum', amt: 40, quip: 'Gum! In this city! Spit it in the bin, please.' },
  durian: { name: 'Durian on public transport', amt: 50, quip: 'No durians on the train, the taxi or the bumboat. Everybody can smell it.' },
  pigeons: { name: 'Feeding the pigeons', amt: 25, quip: 'Don’t feed the pigeons lah, they get fat and noisy.' },
  speeding: { name: 'Speeding', amt: 35, quip: 'Slow down! Silver zone, the uncles and aunties are crossing.' },
  red: { name: 'Running a red light', amt: 40, quip: 'Red means stop. Even for heroes.' },
  pavement: { name: 'Riding on the five-foot way', amt: 30, quip: 'The five-foot way is for walking. Wheels on the road, please.' },
};
/** what a repeat offence costs: half again per earlier ticket of that kind, at most three times the base */
export const fineAmount = (kind: Offence, before: number) => Math.round(FINE[kind].amt * Math.min(3, 1 + 0.5 * before));
/** how far a ticket warden notices things, by difficulty */
const SIGHT = { easy: 300, normal: 360, hard: 400 } as const;
/** `ride`: a scooter warden, who keeps to the roads */
export type Patrol = { id: number; b: Body; goal: [number, number] | null; pace: number; write: number; spot: number; ride?: boolean };
export type Ticket = { kind: Offence; amt: number; t: number; pid: number; x: number; y: number };

// ── the zebra crossings, as a tile mask: a few tiles either side of each painted crossing are fair game
let ZEBRA: Uint8Array | null = null;
function zebras(w: World): Uint8Array {
  if (ZEBRA) return ZEBRA;
  const z = new Uint8Array(W * 92);
  for (const d of w.c.decals) {
    if (d.sprite !== 'd-zebra') continue;
    const cx = d.x / T, cy = d.y / T, vert = Math.abs(Math.sin(d.rot ?? 0)) > 0.5;
    for (let ty = Math.floor(cy) - 3; ty <= Math.floor(cy) + 3; ty++) for (let tx = Math.floor(cx) - 3; tx <= Math.floor(cx) + 3; tx++) {
      const ax = Math.abs(tx + 0.5 - cx), ay = Math.abs(ty + 0.5 - cy);
      if (vert ? ax <= 1.1 && ay <= 2.6 : ay <= 1.1 && ax <= 2.6) if (tx >= 0 && ty >= 0 && tx < W && ty < 92) z[ty * W + tx] = 1;
    }
  }
  // the crossing boxes themselves (the middle of the junction) are part of the crossing
  for (const L of LIGHTS) { const bx = ROADS[L.v].at, by = ROADS[L.h].at; for (let y = by; y < by + 4; y++) for (let x = bx; x < bx + 4; x++) z[y * W + x] = 1; }
  ZEBRA = z; return z;
}
const roadAxis = (tx: number, ty: number): 'h' | 'v' | null => { for (const r of ROADS) { if (r.axis === 'h' && ty >= r.at && ty < r.at + 4 && tx >= r.from && tx <= r.to) return 'h'; if (r.axis === 'v' && tx >= r.at && tx < r.at + 4 && ty >= r.from && ty <= r.to) return 'v'; } return null; };

/** the patrol that can see (x,y), if any (ticket wardens, or a chasing warden) */
export function witness(w: World, x: number, y: number): Patrol | null {
  if (w.p.roof || w.p.hide) return null;
  const r = SIGHT[w.s.settings.diff] * (w.p.shade && !w.p.ride ? 0.6 : 1);
  for (const pt of w.patrols) if (dist(pt.b.x, pt.b.y, x, y) < r * (pt.ride ? 1.25 : 1) && los(w.c, pt.b.x, pt.b.y, x, y)) return pt;
  return null;
}

/** an offence happened at (x,y): a camera tickets at once; otherwise a warden has to see it */
export function offence(w: World, kind: Offence, x: number, y: number, camera = false) {
  if (w.ticket || w.talk || w.failed || w.s.cash < 0) return;
  const cd = w.fineCd.get(kind) ?? 0; if (w.time < cd) return;
  const pt = camera ? null : witness(w, x, y);
  if (!camera && !pt) return;
  w.fineCd.set(kind, w.time + (kind === 'jaywalk' ? 8 : 5));
  const before = w.s.fines.by[kind] ?? 0, easy = w.s.settings.diff === 'easy';
  // a careful player's first slip of each kind on Easy, and anything during a job on Easy, is a warning
  if (easy && (w.run || !w.warned.has(kind))) {
    w.warned.add(kind);
    w.fx.push({ t: 'fine-warn', kind, x, y }); w.say(`Warning: ${FINE[kind].name.toLowerCase()}! ${FINE[kind].quip}`, 'bad');
    if (pt) pt.write = 1.2;
    return;
  }
  const amt = fineAmount(kind, before);
  if (camera) { pay(w, kind, amt, false); text(w, 'bristle', `Ticket in the post: ${FINE[kind].name.toLowerCase()}, ${amt} coins. Paid from your purse. ${FINE[kind].quip}`); return; }
  w.ticket = { kind, amt, t: 0, pid: pt!.id, x, y }; pt!.write = 1.4;
  w.fx.push({ t: 'ticket', kind, k: amt, x: pt!.b.x, y: pt!.b.y });
}
/** settle a ticket: cash out (as much as you have), the record, and a touch of heat */
export function pay(w: World, kind: Offence, amt: number, heat = true) {
  const s = w.s, paid = Math.min(amt, s.cash);
  s.cash -= paid; s.fines.paid += paid; s.fines.n++; s.fines.by[kind] = (s.fines.by[kind] ?? 0) + 1;
  s.fines.list.push({ kind, amt: paid, night: s.night }); if (s.fines.list.length > 12) s.fines.list.splice(0, s.fines.list.length - 12);
  // a ticket in the post (a camera) costs coins, not heat: no warden saw you
  if (heat) addHeat(w, 0.15, 'fine');
  w.fx.push({ t: 'fine-paid', kind, k: paid });
  w.banner = { text: 'Fined!', sub: `${FINE[kind].name}: ${paid} coins`, t: 2.4 };
}
/** the player pays the ticket in hand (E): on foot a quick sheepish pose, from a ride just a handful of coins */
export function payTicket(w: World) {
  const tk = w.ticket; if (!tk) return;
  w.ticket = null; pay(w, tk.kind, tk.amt);
  const pt = w.patrols.find(p => p.id === tk.pid); if (pt) pt.write = 0.9;
  if (!w.p.ride && !w.p.act) { w.p.act = { n: 'pay-fine', t: 0, dur: 0.6 }; w.p.face = 'down'; }
}

export function finesStep(w: World, dt: number) {
  const p = w.p, px = p.x, py = p.y;
  // keep about three ticket wardens strolling within a street or two of you (none on the rooftops, none in the fog)
  const want = w.s.done.length ? 3 : 0;
  if (w.patrols.length < want && w.tick % 45 === 0) {
    const a = w.R() * Math.PI * 2, d = 700 + w.R() * 400;
    const [sx, sy] = nearestFree(w.c, 'walk', px + Math.cos(a) * d, py + Math.sin(a) * d, w.open, 5);
    const tx = Math.floor(sx / T), ty = Math.floor(sy / T);
    if (dist(sx, sy, px, py) > 520 && pedTile(w.c, tx, ty) && w.open.has(districtAt(tx, ty))) w.patrols.push({ id: w.nextId++, b: { x: sx, y: sy, h: 0, speed: 0, r: 13, len: 0, cls: 'walk' }, goal: null, pace: 0, write: 0, spot: 0 });
  }
  // a scooter warden on the roads nearby (one in Chinatown, two on the island's longer roads)
  const isle = Math.floor(px / T) >= OW, rides = w.patrols.filter(pt => pt.ride).length;
  if (w.s.done.length >= 3 && !w.run && rides < (isle ? 2 : 1) && w.tick % 45 === 20) {
    const a = w.R() * Math.PI * 2, d = 800 + w.R() * 400;
    const [sx, sy] = nearestFree(w.c, 'small', px + Math.cos(a) * d, py + Math.sin(a) * d, w.open, 6);
    const tx = Math.floor(sx / T), ty = Math.floor(sy / T);
    if (dist(sx, sy, px, py) > 600 && w.c.ground[ty * W + tx] === G.ROAD && w.open.has(districtAt(tx, ty))) w.patrols.push({ id: w.nextId++, b: { x: sx, y: sy, h: 0, speed: 0, r: 15, len: 46, cls: 'small' }, goal: null, pace: 0, write: 0, spot: 0, ride: true });
  }
  w.patrols = w.patrols.filter(pt => dist(pt.b.x, pt.b.y, px, py) < 1700 || w.ticket?.pid === pt.id);
  for (const pt of w.patrols) {
    pt.pace += dt; pt.write = Math.max(0, pt.write - dt); pt.spot = Math.max(0, pt.spot - dt);
    const tk = w.ticket && w.ticket.pid === pt.id ? w.ticket : null;
    let goal = pt.goal;
    if (tk) goal = [px, py];
    else if (pt.ride && (!goal || dist(pt.b.x, pt.b.y, goal[0], goal[1]) < 60)) {
      for (let k = 0; k < 16; k++) { const a = w.R() * Math.PI * 2, d = (8 + w.R() * 12) * T; const tx = Math.floor((pt.b.x + Math.cos(a) * d) / T), ty = Math.floor((pt.b.y + Math.sin(a) * d) / T); if (tx > 0 && ty > 0 && tx < W && ty < 92 && w.c.ground[ty * W + tx] === G.ROAD && w.open.has(districtAt(tx, ty))) { goal = [tx * T + T / 2, ty * T + T / 2]; break; } }
      pt.goal = goal;
    }
    else if (!goal || dist(pt.b.x, pt.b.y, goal[0], goal[1]) < 40) {
      for (let k = 0; k < 12; k++) { const a = w.R() * Math.PI * 2, d = (4 + w.R() * 8) * T; const tx = Math.floor((pt.b.x + Math.cos(a) * d) / T), ty = Math.floor((pt.b.y + Math.sin(a) * d) / T); if (pedTile(w.c, tx, ty) && w.open.has(districtAt(tx, ty))) { goal = [tx * T + T / 2, ty * T + T / 2]; break; } }
      pt.goal = goal;
    }
    if (pt.write > 0 || !goal) { pt.b.speed *= 0.8; continue; }
    if (tk && dist(pt.b.x, pt.b.y, px, py) < 46) { pt.b.speed *= 0.7; continue; }
    const f = w.fieldTo(pt.ride ? 'small' : 'walk', goal[0], goal[1]); const n = downhill(w.c, f, pt.b.x, pt.b.y, w.open) ?? goal;
    const dx = n[0] - pt.b.x, dy = n[1] - pt.b.y, l = Math.hypot(dx, dy) || 1;
    if (pt.ride) drive(w.ctx(), pt.b, dx / l, dy / l, tk ? (p.ride ? 300 : 200) : 150, 700, 10, dt, false);
    else drive(w.ctx(), pt.b, dx / l, dy / l, tk ? 150 : 62, 600, 8, dt, true);
  }
  // a ticket in hand: pay it, or get away and it's a chase
  const tk = w.ticket;
  if (tk) {
    tk.t += dt;
    const pt = w.patrols.find(q => q.id === tk.pid);
    const limit = w.assist ? 12 : 8;
    if (!pt || (dist(pt.b.x, pt.b.y, px, py) > 560 && tk.t > 1.5) || tk.t > limit) {
      w.ticket = null; w.s.fines.fled++;
      addHeat(w, 1.05, 'fine-fled'); w.fx.push({ t: 'fine-fled' });
      w.say('You ran from a ticket! The wardens are after you now.', 'bad');
    }
  }
  // what you're doing that a warden might see
  if (w.talk || w.ui || p.roof || p.hide || p.seat) { w.lastTile = -1; return; }
  const tx = Math.floor(px / T), ty = Math.floor(py / T), i = ty * W + tx;
  if (!p.ride && !p.air) {
    if (w.c.ground[i] === G.ROAD && i !== w.lastTile) {
      const z = zebras(w);
      if (!z[i]) offence(w, 'jaywalk', px, py);
      else {
        // on a zebra against the lights: the cars on this road have a green
        const ax = roadAxis(tx, ty);
        if (ax) for (let li = 0; li < LIGHTS.length; li++) { const L = LIGHTS[li], bx = ROADS[L.v].at, by = ROADS[L.h].at; if (Math.abs(tx - bx - 2) < 6 && Math.abs(ty - by - 2) < 6 && !(tx >= bx && tx < bx + 4 && ty >= by && ty < by + 4)) { if (lightOf(w, li, ax) === 'green') offence(w, 'jaywalk', px, py); break; } }
      }
    }
  }
  w.lastTile = i;
  if (p.ride && p.ride.kind !== 'boat') {
    const sp = p.ride.b.speed;
    const silver = w.c.sg?.silver.some(([x0, y0, x1, y1]) => tx >= x0 && tx <= x1 && ty >= y0 && ty <= y1);
    if (silver && sp > 230) offence(w, 'speeding', px, py, true);
    else if (sp > 345) offence(w, 'speeding', px, py);
    // wheels along the five-foot way, in sight of a warden (free roam: a job's rush takes the shortcut unfined)
    if (w.c.sg?.fivefoot[i] && sp > 40 && !w.run) offence(w, 'pavement', px, py);
  }
  w.lastTileRide = p.ride ? 1 : 0;
}
/** where the ticket warden is (for the HUD arrow and the scene) */
export const ticketPatrol = (w: World) => w.ticket ? w.patrols.find(p => p.id === w.ticket!.pid) ?? null : null;
export const clampFine = (n: number) => clamp(Math.round(n), 0, 999);
