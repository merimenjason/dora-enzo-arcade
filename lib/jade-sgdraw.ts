// Jade Street: drawing the Singapore streets. Every object is a Codex painting (the hawker tables with and without a
// tissue packet, the aunties, Mr Ong's trike, the pigeons, gum, litter and newspaper bundles, the ticket wardens on
// foot, the otters and macaques and what they drop, the lion dance, the lantern kids, the getai singer); code adds
// only light and shade: the five-foot ways' shadow, the storm's lightning flash and the speech bubbles of Singlish.
// The rules live in lib/jade-sg.ts, lib/jade-fines.ts and lib/jade-gangs.ts.
import { mindBubble } from './jade-jobdraw.js';
import { newMind } from './jade-aware.js';
import { T, W } from './jade-city.js';
import { spr } from './jade-scene.js';
import { mobSprite } from './jade-gangs.js';
import type { World } from './jade-game.js';
import type { Scene } from './jade-scene.js';

type X = CanvasRenderingContext2D;
type List = [number, () => void][];
type Vis = (px: number, py: number, m?: number) => boolean;

/** under everything that stands: the five-foot ways' shade, litter, gum, newspapers, tissue-choped tables, drops */
export function sgGround(sc: Scene, x: X, w: World, ox: number, oy: number, cw: number, ch: number) {
  const c = w.c.sg; if (!c) return;
  const sg = w.sg;
  // the covered walkways: a soft band of shade along the shopfronts
  x.fillStyle = 'rgba(10,6,24,.32)';
  const tx0 = Math.max(0, Math.floor(ox / T)), tx1 = Math.min(W - 1, Math.floor((ox + cw) / T)), ty0 = Math.max(0, Math.floor(oy / T)), ty1 = Math.min(91, Math.floor((oy + ch) / T));
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) if (c.fivefoot[ty * W + tx]) x.fillRect(tx * T, ty * T, T, T * 0.72);
  const vis = (px: number, py: number) => px > ox - 80 && px < ox + cw + 80 && py > oy - 80 && py < oy + ch + 120;
  for (const i of sg.gum) { const [gx, gy] = c.gum[i]; if (vis(gx, gy)) { spr(x, 'gum', gx, gy + 8, { w: 26 }); sc.glow(x, gx, gy, 26, 'rgba(255,240,160,.25)'); } }
  for (const [lx, ly] of sg.litter) if (vis(lx, ly)) spr(x, 'litter', lx, ly + 10, { w: 40 });
  for (const i of sg.junk) { const [jx, jy] = c.junk[i]; if (vis(jx, jy)) spr(x, 'newspapers', jx, jy + 10, { w: 40 }); }
  const ev = w.gangs.ev;
  if (ev) for (const d of ev.drops) if (vis(d.x, d.y)) { sc.glow(x, d.x, d.y, 40, 'rgba(120,255,200,.4)'); spr(x, ev.kind === 'otters' ? 'crates' : 'handbag', d.x, d.y + 10, { w: 34 }); if (w.s.settings.cbMarks) sc.cb(x, 'loot', d.x + 24, d.y - 26, 11); }
}

/** the y-sorted things: tables, the chope aunties, Mr Ong, pigeons, wardens on foot, the gangs, the festival */
export function sgSorted(sc: Scene, x: X, w: World, list: List, vis: Vis) {
  const c = w.c.sg; if (!c) return;
  const sg = w.sg, t = sc.t;
  c.tables.forEach((tb, i) => {
    if (!vis(tb.x, tb.y)) return;
    const v = sg.chope[i] ?? 0;
    list.push([tb.y, () => { spr(x, v ? 'table-chope' : 'table-empty', tb.x, tb.y + 22, { w: 92 }); if (v === 1) sc.glow(x, tb.x, tb.y, 40, 'rgba(255,215,90,.35)'); }]);
  });
  const r = sg.rush;
  if (r) for (const a of r.aunties) if (!a.done && vis(a.b.x, a.b.y)) list.push([a.b.y, () => spr(x, a.b.speed > 10 ? 'auntie-chope' : 'auntie-fan', a.b.x, a.b.y + 6, { flip: Math.cos(a.b.h) < 0 })]);
  // Uncle Goh at his chess table, Lily on the getai stage on festival nights, Mr Ong on his round
  const [gx, gy] = c.chess; if (vis(gx, gy)) list.push([gy + 1, () => spr(x, `goh-chess-${Math.floor(t * 1.2) % 2}`, gx - 46, gy + 18, {})]);
  if (sg.fest === 'getai' && w.open.has('docks')) { const [sx, sy] = c.getai; if (vis(sx, sy)) list.push([sy - 30, () => spr(x, `lily-sing-${Math.floor(t * 2) % 2}`, sx, sy - 40, {})]); }
  const o = sg.ong.b;
  if (vis(o.x, o.y)) list.push([o.y, () => { x.fillStyle = 'rgba(0,0,0,.3)'; sc.shadow(x, o.x + 4, o.y + 6, 30, 12); spr(x, o.speed > 5 ? `ong-trike-${Math.floor(t * 5) % 2}` : 'ong-trike-0', o.x, o.y + 10, { flip: Math.cos(o.h) < 0 }); }]);
  for (const pg of sg.pigeons) if (vis(pg.x, pg.y)) {
    const fly = pg.fly > 0; const k = fly ? 2.2 - pg.fly : 0;
    list.push([pg.y, () => spr(x, fly ? 'pigeon-fly' : Math.floor(pg.ph * 1.5) % 3 === 0 ? 'pigeon-1' : 'pigeon-0', pg.x + k * 60, pg.y - k * 120, { w: 26, flip: Math.sin(pg.ph * 0.3) > 0 })]);
  }
  // the ticket wardens on foot: strolling, writing, holding out a ticket
  for (const pt of w.patrols) if (vis(pt.b.x, pt.b.y)) {
    const tk = w.ticket?.pid === pt.id;
    // a scooter warden: the painted raccoon on his little navy scooter, seen from above, with a flashing lamp
    if (pt.ride) { list.push([pt.b.y, () => {
      x.fillStyle = 'rgba(0,0,0,.3)'; sc.shadow(x, pt.b.x + 4, pt.b.y + 6, 24, 12);
      spr(x, pt.write > 0 || pt.b.speed < 10 ? 'wscoot-0' : `wscoot-${Math.floor(pt.pace * 4) % 2}`, pt.b.x, pt.b.y, { anchor: 'center', rot: pt.b.h + Math.PI / 2, w: 34 });
      if (tk) sc.glow(x, pt.b.x, pt.b.y, 50, Math.floor(t * 6) % 2 ? 'rgba(255,60,60,.5)' : 'rgba(80,140,255,.5)');
      if (tk && w.s.settings.cbMarks) sc.cb(x, 'warn', pt.b.x, pt.b.y - 50, 12);
    }]); continue; }
    list.push([pt.b.y, () => {
      x.fillStyle = 'rgba(0,0,0,.3)'; sc.shadow(x, pt.b.x, pt.b.y + 2, 16, 6);
      const cx = Math.cos(pt.b.h), side = Math.abs(cx) > Math.abs(Math.sin(pt.b.h)), k = Math.floor(pt.pace * 5) % 2;
      // a noise nearby (lib/jade-aware.ts): a hand to the ear, a look left and right, the magnifier, a grumble off
      const mi = pt.mind, pose = !tk && pt.write <= 0 && mi && pt.b.speed < 8 ? (mi.pose === 'grumble' ? 'warden-grumble' : mi.st === 'sus' ? 'warden-listen' : mi.pose === 'look' ? (Math.sin(t * 2.4) > 0 ? 'warden-look-l' : 'warden-look-r') : mi.pose === 'search' ? 'warden-search' : '') : '';
      const f = pt.write > 0 ? 'warden-write' : tk && pt.b.speed < 20 ? 'warden-ticket' : pose ? pose : pt.b.speed < 8 ? 'warden-down-0' : side ? `warden-side-${k}` : `warden-down-${k}`;
      spr(x, f, pt.b.x, pt.b.y + 6, { flip: side && cx < 0, w: 60 });
      if (tk && w.s.settings.cbMarks) sc.cb(x, 'warn', pt.b.x, pt.b.y - 70, 12);
      if (tk) mindBubble(sc, x, { ...(mi ?? newMind()), st: 'alert', pose: '' }, pt.b.x, pt.b.y - 104);
      else mindBubble(sc, x, mi, pt.b.x, pt.b.y - 104);
    }]);
  }
  // the rival gangs
  const ev = w.gangs.ev;
  if (ev) for (const m of ev.mobs) if (m.st !== 'gone' && vis(m.b.x, m.b.y)) list.push([m.b.y, () => {
    const f = mobSprite(ev.kind, m); x.fillStyle = 'rgba(0,0,0,.28)'; if (m.st !== 'swim') sc.shadow(x, m.b.x, m.b.y + 2, 14, 6);
    spr(x, f.name, m.b.x, m.b.y + 6, { flip: f.flip, w: 52 });
    if (m.has && m.st === 'run') spr(x, ev.kind === 'otters' ? 'crate-float' : ev.kind === 'lizards' ? 'mooncakes' : 'bun', m.b.x, m.b.y - 44, { w: 22 });
    if (m.st === 'dizzy' || m.st === 'netted') sc.stars(x, m.b.x, m.b.y - 40);
    if (w.s.settings.cbMarks && m.has) sc.cb(x, 'gang', m.b.x + 22, m.b.y - 52, 9);
  }]);
  // the festivals
  const L = sg.lion;
  if (L.on && vis(L.x, L.y, 300)) {
    list.push([L.y, () => { x.fillStyle = 'rgba(0,0,0,.3)'; sc.shadow(x, L.x, L.y + 4, 60, 16); spr(x, `liondance-${Math.floor(t * 3) % 2}`, L.x, L.y + 12, { w: 150 }); }]);
    list.push([L.y - 1, () => spr(x, 'drummer', L.x - 120, L.y + 8, { w: 70 })]);
    list.push([L.y - 1, () => spr(x, 'drum-cart', L.x - 190, L.y + 10, { w: 90 })]);
  }
  for (const kd of sg.kids) if (vis(kd.x, kd.y)) list.push([kd.y, () => { sc.glow(x, kd.x, kd.y - 40, 50, 'rgba(255,170,80,.4)'); spr(x, 'kid-lantern', kd.x, kd.y + 6, { w: 54, flip: kd.i % 2 === 1 }); }]);
}

/** over everything: speech bubbles and the storm's lightning */
export function sgOver(sc: Scene, x: X, w: World, vis: Vis) {
  // the partner's warning: a gold paw over what they spotted, and a "psst" bubble over them
  const pt = w.pal.point;
  if (pt && vis(pt.x, pt.y)) { const a = Math.min(1, pt.t * 2), bob = Math.sin(sc.t * 6) * 5; sc.glow(x, pt.x, pt.y - 20, 60, `rgba(255,214,90,${0.35 * a})`); spr(x, 'ui-paw', pt.x, pt.y - 64 + bob, { w: 34, alpha: a, rot: Math.PI, anchor: 'center' }); }
  if (w.pal.doing === 'warn' && !w.mate.seat && vis(w.mate.x, w.mate.y)) spr(x, 'bub-psst', w.mate.x + 22, w.mate.y - 70 + Math.sin(sc.t * 5) * 2, { w: 30 });
  for (const b of w.barks) {
    if (!vis(b.x, b.y)) continue;
    const a = Math.min(1, b.t * 6, (2.8 - b.t) * 3); if (a <= 0) continue;
    x.save(); x.globalAlpha = a; x.font = '700 15px system-ui, sans-serif';
    const tw = Math.min(260, x.measureText(b.text).width) + 18, bx = b.x - tw / 2, by = b.y - 34 - b.t * 6;
    x.fillStyle = b.hero ? 'rgba(255,248,224,.96)' : 'rgba(255,255,255,.95)'; x.strokeStyle = 'rgba(40,20,50,.8)'; x.lineWidth = 2;
    x.beginPath(); x.roundRect(bx, by, tw, 26, 12); x.moveTo(b.x - 6, by + 26); x.lineTo(b.x, by + 34); x.lineTo(b.x + 6, by + 26); x.fill(); x.stroke();
    x.fillStyle = '#2b2033'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(b.text, b.x, by + 13, 250);
    x.restore();
  }
}
/** the lightning: a quick pale flash over the whole screen (gentler with Reduce shake on) */
export function sgFlash(x: X, w: World, cw: number, ch: number) {
  const f = w.sg.flash; if (f <= 0) return;
  const calm = w.s.settings.calm;
  x.save(); x.setTransform(1, 0, 0, 1, 0, 0); x.fillStyle = `rgba(230,235,255,${(calm ? 0.12 : 0.45) * Math.min(1, f / 0.2)})`; x.fillRect(0, 0, cw, ch); x.restore();
}
