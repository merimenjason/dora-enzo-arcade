// Jade Street: street events in free roam. Every minute or so, when no job is running and the lanterns are dark,
// something happens near you: a magpie snatches a mango from a stall (dash into it, or ride it down, to get it back),
// a lost duckling needs walking home to its mother, a broken-down van needs a push-start, or a busker draws a crowd
// (tip them and they hum you a market tip). Each pays a few coins and a little reputation. Seeded like the rest.
import { T, districtAt, DISTRICT_NAME, type District } from './jade-city.js';
import { drive, type Body } from './jade-move.js';
import { downhill, nearestFree } from './jade-nav.js';
import { dist, angDiff } from './jade-rng.js';
import { addRep } from './jade-save.js';
import { GOODS, GOOD } from './jade-trade.js';
import { pedTile, dests } from './jade-folk.js';
import { text, CONTACT_OF } from './jade-phone.js';
import type { World, Near, Ride } from './jade-game.js';

export type EventKind = 'magpie' | 'duckling' | 'van' | 'busker';
export const EVENT_KINDS: EventKind[] = ['magpie', 'duckling', 'van', 'busker'];
export type StreetEvent = {
  kind: EventKind; d: District; x: number; y: number; t: number; phase: 'on' | 'follow' | 'done' | 'gone';
  b?: Body; goal?: [number, number]; home?: [number, number]; ride?: Ride; push?: number; tipped?: boolean; caught?: boolean;
};
export const EVENT_NAME: Record<EventKind, string> = { magpie: 'Stop, thief!', duckling: 'Lost duckling', van: 'Broken-down van', busker: 'Busker' };
const LIFE: Record<EventKind, number> = { magpie: 40, duckling: 160, van: 120, busker: 80 };

export function eventsStep(w: World, dt: number) {
  const e = w.street;
  if (!e) {
    if (w.run || w.heat >= 1 || w.p.roof || !w.s.done.length) return;
    w.streetT -= dt;
    if (w.streetT <= 0) { w.streetT = 45 + w.R() * 40; spawn(w, EVENT_KINDS[Math.floor(w.R() * EVENT_KINDS.length)]); }
    return;
  }
  e.t += dt;
  if (e.phase === 'done' || e.phase === 'gone') { if (e.t > 3) end(w); return; }
  if (w.run || e.t > LIFE[e.kind] * (w.assist ? 1.3 : 1) || dist(e.x, e.y, w.p.x, w.p.y) > 2200) {
    if (e.kind === 'magpie') w.say('The magpie got away with the mango.', 'bad');
    e.phase = 'gone'; e.t = 0; if (e.kind === 'busker') w.crowd = null; return;
  }
  const p = w.p, pb = p.ride ? p.ride.b : p.b;
  switch (e.kind) {
    case 'magpie': {
      const b = e.b!;
      if (!e.goal || dist(b.x, b.y, e.goal[0], e.goal[1]) < 40) e.goal = farSpot(w, b.x, b.y);
      const close = dist(b.x, b.y, pb.x, pb.y);
      const sp = (close < 260 ? 200 : 150) * (w.assist ? 0.86 : 1) * (close > 900 ? 0.6 : 1);
      const f = w.fieldTo('walk', e.goal[0], e.goal[1]); const n = downhill(w.c, f, b.x, b.y, w.open) ?? e.goal;
      const dx = n[0] - b.x, dy = n[1] - b.y, l = Math.hypot(dx, dy) || 1;
      drive(w.ctx(), b, dx / l, dy / l, sp, 900, 10, dt, true);
      e.x = b.x; e.y = b.y;
      const hitting = p.ride ? pb.speed > 90 : (p.dashT > 0 || p.hopT > 0);
      if (close < b.r + pb.r + (w.assist ? 18 : 8) && hitting) {
        e.phase = 'done'; e.t = 0; reward(w, e, 40, 2); w.fx.push({ t: 'hit', x: b.x, y: b.y });
        text(w, CONTACT_OF[e.d], 'You got my mango back from that cheeky magpie! Here, a little something for your trouble.');
      }
      break;
    }
    case 'duckling': {
      const b = e.b!;
      if (e.phase === 'follow') {
        const back = p.ride ? null : [p.b.x - Math.cos(p.b.h) * 44, p.b.y - Math.sin(p.b.h) * 44] as [number, number];
        if (back && dist(b.x, b.y, back[0], back[1]) > 20) {
          const f = w.fieldTo('walk', back[0], back[1]); const n = dist(b.x, b.y, back[0], back[1]) > T * 1.5 ? downhill(w.c, f, b.x, b.y, w.open) ?? back : back;
          const dx = n[0] - b.x, dy = n[1] - b.y, l = Math.hypot(dx, dy) || 1;
          drive(w.ctx(), b, dx / l, dy / l, Math.min(250, 60 + dist(b.x, b.y, back[0], back[1]) * 1.2), 1400, 10, dt, true);
        } else b.speed = 0;
        e.x = b.x; e.y = b.y;
        if (dist(b.x, b.y, e.home![0], e.home![1]) < 80) { e.phase = 'done'; e.t = 0; reward(w, e, 50, 2); w.fx.push({ t: 'quack', x: b.x, y: b.y }); text(w, CONTACT_OF[e.d], 'Mama Duck says thank you for bringing her little one home!'); }
      }
      break;
    }
    case 'van': {
      const r = e.ride!; e.x = r.b.x; e.y = r.b.y;
      if (r.parked === false) { e.phase = 'gone'; e.t = 0; r.broken = false; break; }
      // the broken van stands like a wall; pushing is leaning into it on foot
      const pdx = p.b.x - r.b.x, pdy = p.b.y - r.b.y, pd = Math.hypot(pdx, pdy) || 1, min = r.b.r + 16;
      if (!p.ride && pd < min) { p.b.x = r.b.x + pdx / pd * min; p.b.y = r.b.y + pdy / pd * min; }
      const pushing = !p.ride && !p.act && pd < min + 16 && w.inputMag > 0.5 && Math.abs(angDiff(w.inputAng, Math.atan2(-pdy, -pdx))) < 1.1;
      w.pushing = pushing;
      if (pushing) { e.push = (e.push ?? 0) + dt / (w.assist ? 2.6 : 3.4); if (Math.floor(e.t * 3) !== Math.floor((e.t - dt) * 3)) w.fx.push({ t: 'push', x: r.b.x, y: r.b.y }); }
      else e.push = Math.max(0, (e.push ?? 0) - dt * 0.15);
      if ((e.push ?? 0) >= 1) { r.broken = false; e.phase = 'done'; e.t = 0; w.pushing = false; reward(w, e, 45, 2); w.fx.push({ t: 'start-engine', kind: 'van' }); w.fx.push({ t: 'smoke', x: r.b.x, y: r.b.y }); text(w, CONTACT_OF[e.d], 'The delivery van is running again thanks to you. The driver says you can borrow it any time.'); }
      break;
    }
    case 'busker': break;
  }
}
function end(w: World) { if (w.street?.kind === 'busker') w.crowd = null; w.street = null; w.pushing = false; }
function reward(w: World, e: StreetEvent, coins: number, rep: number) {
  w.s.cash += coins; addRep(w.s, e.d, rep); w.s.helped++;
  w.banner = { text: 'Good deed!', sub: `${EVENT_NAME[e.kind]} · +${coins} coins`, t: 2.6 };
  w.fx.push({ t: 'good-deed', k: coins });
}
function farSpot(w: World, x: number, y: number): [number, number] {
  for (let k = 0; k < 40; k++) {
    const a = w.R() * Math.PI * 2, d = (10 + w.R() * 10) * T;
    const tx = Math.floor((x + Math.cos(a) * d) / T), ty = Math.floor((y + Math.sin(a) * d) / T);
    if (pedTile(w.c, tx, ty) && w.open.has(districtAt(tx, ty))) return [tx * T + T / 2, ty * T + T / 2];
  }
  return [x, y];
}

export function spawn(w: World, kind: EventKind): StreetEvent | null {
  const px = w.p.x, py = w.p.y;
  const near = (x: number, y: number, lo: number, hi: number) => { const d = dist(x, y, px, py); return d > lo && d < hi && w.open.has(districtAt(Math.floor(x / T), Math.floor(y / T))); };
  let e: StreetEvent | null = null;
  if (kind === 'magpie') {
    const stalls = w.c.props.filter(p => p.sprite.startsWith('stall') && near(p.x, p.y, 200, 900));
    if (!stalls.length) return null;
    const st = stalls[Math.floor(w.R() * stalls.length)];
    const [x, y] = nearestFree(w.c, 'walk', st.x, st.y + T, w.open, 3);
    const d = districtAt(Math.floor(x / T), Math.floor(y / T));
    e = { kind, d, x, y, t: 0, phase: 'on', b: { x, y, h: 0, speed: 0, r: 12, len: 0, cls: 'walk' } };
    text(w, CONTACT_OF[d], `Help! A magpie just snatched a mango from a stall near you in ${DISTRICT_NAME[d].replace(/^the /, 'the ')}. Dash into it to make it drop it!`);
  } else if (kind === 'duckling') {
    const all = dests(w.c).filter(d => near(d.x, d.y, 160, 520) && d.kind !== 'seat');
    const homes = dests(w.c).filter(d => near(d.x, d.y, 12 * T, 22 * T) && d.kind !== 'seat');
    if (!all.length || !homes.length) return null;
    const a = all[Math.floor(w.R() * all.length)], h = homes[Math.floor(w.R() * homes.length)];
    const d = districtAt(a.tx, a.ty);
    e = { kind, d, x: a.x, y: a.y, t: 0, phase: 'on', b: { x: a.x, y: a.y, h: Math.PI / 2, speed: 0, r: 8, len: 0, cls: 'walk' }, home: [h.x, h.y] };
    text(w, CONTACT_OF[d], 'A little duckling is lost and peeping near you. Walk it home to its mother? It will follow you on foot.');
  } else if (kind === 'van') {
    const vans = w.rides.filter(r => r.kind === 'van' && r.parked && !r.mission && !r.locked && near(r.b.x, r.b.y, 220, 1000));
    if (!vans.length) return null;
    const r = vans[Math.floor(w.R() * vans.length)]; r.broken = true;
    const d = districtAt(Math.floor(r.b.x / T), Math.floor(r.b.y / T));
    e = { kind, d, x: r.b.x, y: r.b.y, t: 0, phase: 'on', ride: r, push: 0 };
    text(w, CONTACT_OF[d], 'A delivery van has broken down near you. Give it a push-start? Lean into it on foot.');
  } else {
    const spots = dests(w.c).filter(d => near(d.x, d.y, 200, 800) && d.kind !== 'seat');
    if (!spots.length) return null;
    const s = spots[Math.floor(w.R() * spots.length)];
    const d = districtAt(s.tx, s.ty);
    e = { kind, d, x: s.x, y: s.y, t: 0, phase: 'on' }; w.crowd = { x: s.x, y: s.y };
    for (const pd of w.peds) if (dist(pd.x, pd.y, s.x, s.y) < 520) { pd.dest = -1; pd.watch = true; pd.sit = 0; pd.wait = 0; }
  }
  w.street = e; w.fx.push({ t: 'event', kind }); return e;
}

/** what you can do at the event right now */
export function eventNear(w: World): Near | null {
  const e = w.street; if (!e || e.phase !== 'on' || w.p.ride) return null;
  if (e.kind === 'duckling') return { kind: 'event', label: 'Help the lost duckling home', x: e.x, y: e.y };
  if (e.kind === 'busker' && !e.tipped) return { kind: 'event', label: 'Tip the busker (5 coins)', x: e.x, y: e.y };
  return null;
}
export function eventAct(w: World) {
  const e = w.street; if (!e) return;
  const p = w.p;
  if (e.kind === 'duckling') { p.act = { n: 'kneel', t: 0, dur: 0.8, then: () => { e.phase = 'follow'; w.fx.push({ t: 'quack', x: e.x, y: e.y }); w.say('The duckling waddles after you. Lead it to its mother (follow the line).', 'good'); } }; p.face = 'down'; }
  else if (e.kind === 'busker') {
    if (w.s.cash < 5) { w.say('You need 5 coins to tip.', 'bad'); return; }
    w.s.cash -= 5; e.tipped = true; addRep(w.s, e.d, 1); w.s.helped++;
    p.act = { n: 'clap', t: 0, dur: 1.2 }; p.face = 'down';
    const g = GOODS[Math.floor(w.R() * GOODS.length)], m = [...w.open][Math.floor(w.R() * w.open.size)];
    w.s.tips.push({ night: w.s.night, market: m, good: g, mult: 1.25, from: 'the busker', text: '' });
    w.fx.push({ t: 'busk' });
    w.banner = { text: 'Thank you!', sub: `The busker hums a tip: ${GOOD[g].name.toLowerCase()} pay well at ${DISTRICT_NAME[m].replace(/^the /, 'the ')} tonight`, t: 3.4 };
  }
}
/** where the route line should point for the event in progress */
export function eventTarget(w: World): [number, number] | null {
  const e = w.street; if (!e || e.phase === 'done' || e.phase === 'gone') return null;
  if (e.kind === 'duckling' && e.phase === 'follow') return e.home!;
  return [e.x, e.y];
}
