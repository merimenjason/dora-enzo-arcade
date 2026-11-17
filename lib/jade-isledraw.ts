// Jade Street: drawing the island. The MRT's viaduct (Codex track and pillar paintings laid along the line) and
// its trains overhead, the train you race in a job, a hailed taxi, and the station and taxi-stand markers. Every
// object is a painting; code only lays them out and adds light. The rules live in lib/jade-mrt.ts and lib/jade-taxi.ts.
import { T } from './jade-city.js';
import { spr, frameSize } from './jade-scene.js';
import { trainAt, lineAt, TRAINS } from './jade-mrt.js';
import type { World } from './jade-game.js';
import type { Scene } from './jade-scene.js';
import type { Actor } from './jade-mission.js';

type X = CanvasRenderingContext2D;
type List = [number, () => void][];
type Vis = (px: number, py: number, m?: number) => boolean;

/** the taxi on its way, waiting or driving you */
const BARE = new WeakMap<object, { x: number; y: number; d: string }[]>();
export function isleSorted(sc: Scene, x: X, w: World, list: List, vis: Vis) {
  // every open station entrance has its painted MRT lamp beside the gates, readable from across the street
  // (a station that already has its lamp in the city's props keeps that one)
  let bare = BARE.get(w.c); if (!bare) BARE.set(w.c, bare = (w.c.isle?.stations ?? []).filter(st => !w.c.props.some(p => p.sprite === 'stn-pillar' && Math.hypot(p.x - st.x, p.y - st.y) < 200)));
  for (const st of bare) if (w.open.has(st.d as never) && vis(st.x + 52, st.y, 120)) list.push([st.y + 4, () => {
    x.fillStyle = 'rgba(0,0,0,.3)'; sc.shadow(x, st.x + 56, st.y + 6, 16, 7); spr(x, 'stn-pillar', st.x + 52, st.y + 6, { w: 44 });
  }]);
  const tx = w.taxi;
  if (tx && vis(tx.b.x, tx.b.y)) list.push([tx.b.y, () => {
    x.fillStyle = 'rgba(0,0,0,.3)'; sc.shadow(x, tx.b.x + 5, tx.b.y + 7, 40, 22);
    spr(x, tx.sprite, tx.b.x, tx.b.y, { anchor: 'center', rot: tx.b.h + Math.PI / 2, w: 50 });
    // the roof light: lit while it's for hire, off with a fare aboard
    if (tx.st !== 'ride') sc.glow(x, tx.b.x, tx.b.y, 40, tx.st === 'wait' ? 'rgba(120,255,170,.45)' : 'rgba(255,240,150,.35)');
  }]);
}
/** a train's three cars, front first, laid back along the line */
function train(x: X, w: World, s: number, dir: number) {
  const isle = w.c.isle!; const car = 118;
  for (let k = 2; k >= 0; k--) {
    const [cx, cy, h] = lineAt(isle, s - dir * k * car);
    if (s - dir * k * car < isle.visFrom) continue;
    spr(x, k === 0 ? 'mrt-front' : 'mrt-mid', cx, cy, { anchor: 'center', rot: h + (dir > 0 ? Math.PI / 2 : -Math.PI / 2), w: 56 });
  }
}
/** overhead: the viaduct and the trains on it (drawn above the street, like the gantries) */
export function isleOver(sc: Scene, x: X, w: World, vis: Vis) {
  const isle = w.c.isle; if (!isle) return;
  const pts = isle.rail; const [rw] = frameSize('rail');
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; const l = Math.hypot(x1 - x0, y1 - y0), h = Math.atan2(y1 - y0, x1 - x0);
    const n = Math.ceil(l / 120);
    for (let k = 0; k < n; k++) {
      const px = x0 + (x1 - x0) * (k + 0.5) / n, py = y0 + (y1 - y0) * (k + 0.5) / n;
      if (!vis(px, py, 200)) continue;
      x.fillStyle = 'rgba(0,0,0,.25)'; x.save(); x.translate(px + 14, py + 22); x.rotate(h); x.fillRect(-l / n / 2, -26, l / n, 52); x.restore();
      spr(x, 'rail', px, py, { anchor: 'center', rot: h, w: rw ? l / n + 4 : 124 });
    }
  }
  for (let k = 0; k < TRAINS; k++) {
    const t = trainAt(isle, w.time, k); if (!t.visible || !vis(t.x, t.y, 400)) continue;
    train(x, w, t.s, t.dir);
    sc.glow(x, t.x, t.y, 70, 'rgba(160,255,220,.25)');
  }
  // above each open station, the MRT's painted pin bobs like a job pin, so a station reads from a distance
  for (const st of isle.stations) if (w.open.has(st.d) && vis(st.x, st.y, 260)) {
    const b = Math.sin(sc.t * 2.4 + st.s) * 5; sc.glow(x, st.x, st.y - 110 + b, 46, 'rgba(90,255,190,.35)');
    spr(x, 'pin-train', st.x, st.y - 92 + b, { w: 46, anchor: 'bottom' });
  }
  // the train you race in a job
  const a = w.run?.actors.find(q => q.kind === 'train');
  if (a && a.extra !== undefined && a.extra > isle.visFrom && vis(a.b.x, a.b.y, 400)) { train(x, w, a.extra, Math.sign((a.extra2 ?? 0) - a.extra) || 1); sc.glow(x, a.b.x, a.b.y, 90, 'rgba(255,220,120,.35)'); }
}
/** a job actor in an island look: a lizard or Director Kaw on foot, the lizards' shopping trolley, the otter pups */
export function isleActor(sc: Scene, x: X, a: Actor): boolean {
  const b = a.b, fl = Math.floor(a.t * 6) % 2;
  if (a.kind === 'train') return true;
  if (a.skin === 'liz' && (a.kind === 'runner' || a.kind === 'cart')) {
    x.fillStyle = 'rgba(0,0,0,.3)'; sc.shadow(x, b.x, b.y + 2, 18, 7);
    if (a.kind === 'cart') { spr(x, `liz-trolley-${fl}`, b.x, b.y, { anchor: 'center', rot: b.h + Math.PI / 2 }); if (a.stun > 0) sc.stars(x, b.x, b.y - 30); return true; }
    const cx = Math.cos(b.h), sy = Math.sin(b.h);
    const f = a.stun > 0 ? (a.netT ? 'liz-netted' : 'liz-dizzy') : b.speed < 5 ? 'liz-taunt' : Math.abs(cx) > Math.abs(sy) ? `liz-run-${fl}` : `liz-walk-${sy > 0 ? 'down' : 'up'}-${fl}`;
    spr(x, f, b.x, b.y + 4, { flip: Math.abs(cx) > Math.abs(sy) && cx < 0, w: 56 });
    if (a.stun > 0) sc.stars(x, b.x, b.y - 40); else spr(x, 'loot-bag', b.x, b.y - 46, { w: 20 });
    return true;
  }
  if ((a.skin === 'myna' || a.skin === 'bat') && a.kind === 'runner') {
    // a mynah or a bat on the run: it hops along the ground and flutters up over the railings
    const k = a.skin;
    x.fillStyle = 'rgba(0,0,0,.3)'; sc.shadow(x, b.x, b.y + 2, 14, 6);
    const cx = Math.cos(b.h), sy = Math.sin(b.h), side = Math.abs(cx) > Math.abs(sy);
    const f = a.stun > 0 ? (a.netT ? `${k}-netted` : `${k}-dizzy`) : b.speed < 5 ? `${k}-taunt` : b.speed > 170 ? `${k}-fly-${fl}` : side ? `${k}-run-${fl}` : `${k}-walk-${sy > 0 ? 'down' : 'up'}-${fl}`;
    if (f.includes('-fly-')) spr(x, f, b.x, b.y - 14, { anchor: 'center', rot: b.h + Math.PI / 2, w: k === 'bat' ? 58 : 54 });
    else spr(x, f, b.x, b.y + 4, { flip: side && cx < 0, w: k === 'bat' ? 48 : 44 });
    if (a.stun > 0) sc.stars(x, b.x, b.y - 38); else spr(x, 'loot-bag', b.x, b.y - 40, { w: 18 });
    return true;
  }
  if (a.skin === 'hoot' && a.kind === 'runner') {
    const fl = Math.floor(sc.t * 9) % 2, b = a.b, left = Math.cos(b.h) < 0;
    const f = a.stun > 0 ? 'hoot-dizzy' : b.speed < 5 ? 'hoot-stand' : `hoot-run-${fl}`;
    x.fillStyle = 'rgba(0,0,0,.3)'; sc.shadow(x, b.x, b.y + 2, 20, 8);
    spr(x, f, b.x, b.y + 6, { flip: left && b.speed >= 5 });
    return true;
  }
  if (a.skin === 'ciku' && a.kind === 'runner') {
    // Datin Ciku, the Atas Bats' boss, cape flying, clutching her tiara
    x.fillStyle = 'rgba(0,0,0,.3)'; sc.shadow(x, b.x, b.y + 2, 16, 6);
    const f = a.stun > 0 ? 'ciku-dizzy' : b.speed < 5 ? 'ciku-stand' : `ciku-run-${fl}`;
    spr(x, f, b.x, b.y + 4, { flip: Math.cos(b.h) < 0, w: 62 });
    if (a.stun > 0) sc.stars(x, b.x, b.y - 50);
    return true;
  }
  if (a.skin === 'nine' && a.kind === 'runner') {
    // Crow Number Nine, Kaw's old assistant, clutching his clipboard
    x.fillStyle = 'rgba(0,0,0,.3)'; sc.shadow(x, b.x, b.y + 2, 16, 6);
    const f = a.stun > 0 || b.speed < 5 ? 'nine-brief' : `nine-run-${fl}`;
    spr(x, f, b.x, b.y + 4, { flip: Math.cos(b.h) < 0, w: 60 });
    if (a.stun > 0) sc.stars(x, b.x, b.y - 50);
    return true;
  }
  if (a.skin === 'kaw' && a.kind === 'runner') {
    x.fillStyle = 'rgba(0,0,0,.3)'; sc.shadow(x, b.x, b.y + 2, 16, 6);
    const f = a.stun > 0 || b.speed < 5 ? 'kaw-brief' : 'kaw-flap';
    spr(x, f, b.x, b.y + 4, { flip: Math.cos(b.h) < 0, w: a.stun > 0 || b.speed < 5 ? 56 : 66 });
    if (a.stun > 0) sc.stars(x, b.x, b.y - 52);
    sc.glow(x, b.x, b.y - 20, 60, 'rgba(255,215,90,.3)');
    return true;
  }
  if (a.skin === 'otter' && a.kind === 'lion') {
    // Ma Sleek's pups on parade along the promenade
    x.fillStyle = 'rgba(0,0,0,.28)';
    for (let i = 0; i < 3; i++) { const ox = -Math.cos(b.h) * i * 30, oy = -Math.sin(b.h) * i * 30 + (i % 2) * 10; sc.shadow(x, b.x + ox, b.y + oy + 2, 14, 6); spr(x, b.speed < 5 ? 'otter-taunt' : `otter-run-${(fl + i) % 2}`, b.x + ox, b.y + oy + 4, { flip: Math.cos(b.h) < 0, w: 44 }); }
    return true;
  }
  return false;
}
/** Kaw's boat in the finale is a crow boat; the island's station entrances glow so you can find them */
export function isleGround(sc: Scene, x: X, w: World, vis: Vis) {
  const isle = w.c.isle; if (!isle) return;
  for (const st of isle.stations) if (w.open.has(st.d) && vis(st.x, st.y)) sc.glow(x, st.x, st.y, 110 + Math.sin(sc.t * 2) * 10, 'rgba(80,255,190,.3)');
  void T;
}
