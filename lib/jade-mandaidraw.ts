// Jade Street (nineteenth pass): drawing Mandai's moving parts. The Night Safari tram running round its forest loop
// (waiting at the stop while you ride it), a few lorikeets hopping round Bird Paradise's perch, the amber lanterns and
// glowing trail studs, Madam Sutera's black seaplane moored off the reservoir jetty from the end of chapter eleven until
// it takes off at the end of chapter twelve; and on a torch trail, the dark: only a circle round you is lit, with the
// studs, the next marker and the resting animals' eyes shining through it, the animals themselves (resting, alert as
// they stir, bolting when woken) and a faint ring showing how far each can hear. Every object is a Codex painting; code
// lays them out and adds light. Rules: lib/jade-torch.ts and lib/jade-mandaifest.ts.
import { spr } from './jade-scene.js';
import { torchOf, earOf, TORCH } from './jade-torch.js';
import { TRAM_S } from './jade-mandaifest.js';
import type { World } from './jade-game.js';
import type { Scene } from './jade-scene.js';
import type { Step } from './jade-story.js';

type X = CanvasRenderingContext2D;
type List = [number, () => void][];
type Vis = (px: number, py: number, m?: number) => boolean;

/** the tram's speed round its loop (world units a second) */
const TRAM_V = 70;
/** a point `d` world units round a closed loop, and the heading there */
function along(loop: [number, number][], d: number): [number, number, number] {
  let len = 0; for (let i = 0; i < loop.length; i++) { const [ax, ay] = loop[i], [bx, by] = loop[(i + 1) % loop.length]; len += Math.hypot(bx - ax, by - ay); }
  let s = ((d % len) + len) % len;
  for (let i = 0; i < loop.length; i++) {
    const [ax, ay] = loop[i], [bx, by] = loop[(i + 1) % loop.length], l = Math.hypot(bx - ax, by - ay);
    if (s <= l) { const q = s / (l || 1); return [ax + (bx - ax) * q, ay + (by - ay) * q, Math.atan2(by - ay, bx - ax)]; }
    s -= l;
  }
  return [loop[0][0], loop[0][1], 0];
}
const torchOn = (w: World) => !!w.run && w.run.cur?.t === 'torch' && !!torchOf(w.run);

export function mandaiSorted(sc: Scene, x: X, w: World, list: List, vis: Vis) {
  const M = w.c.mandai; if (!M || !w.open.has('mandai')) return;
  // the tram: round the loop, or waiting at the stop while you ride it
  const riding = w.time - w.mandai.tramT < TRAM_S + 0.2;
  const [tx, ty, th] = riding ? [M.stops[0][0], M.stops[0][1] + 6, 0] : along(M.tram, sc.t * TRAM_V);
  if (vis(tx, ty, 120)) list.push([ty - (riding ? 8 : 0), () => {
    x.fillStyle = 'rgba(0,0,0,.26)'; sc.shadow(x, tx, ty + 4, 40, 12);
    spr(x, 'mnd-tram', tx, ty + 8, { w: 64 * 1.6, flip: Math.cos(th) < 0 });
    if (!torchOn(w)) sc.glow(x, tx + Math.cos(th) * 40, ty - 10, 26, 'rgba(255,230,150,.35)');
  }]);
  // lorikeets round the perch (they land and hop; one flutters up now and then)
  for (let k = 0; k < 3; k++) {
    const lx = M.perch[0] - 36 + k * 30, hop = Math.max(0, Math.sin(sc.t * 3 + k * 2.1)) * 6, ly = M.perch[1] - 60 - (k % 2) * 16 - hop;
    if (vis(lx, ly)) list.push([M.perch[1] + 2, () => spr(x, 'i-lory', lx, ly, { anchor: 'center', w: 24, flip: k % 2 === 1 })]);
  }
  // the black seaplane, moored off the jetty from the end of chapter eleven until it takes off at the end of chapter twelve
  if (w.s.done.includes('m85') && !w.s.done.includes('m95')) {
    const [sx, sy] = M.plane;
    if (vis(sx, sy, 140)) list.push([sy, () => {
      x.fillStyle = 'rgba(0,0,0,.22)'; sc.shadow(x, sx + 8, sy + 16, 80, 26);
      spr(x, 'mnd-seaplane', sx, sy + Math.sin(sc.t * 1.3) * 2, { anchor: 'center', w: 170, rot: 0.2 });
    }]);
  }
  // a torch trail's animals: resting, alert as they stir, bolting off into the dark when woken
  const run = w.run, c = run && torchOn(w) ? torchOf(run) : null;
  if (c) for (const b of c.beasts) {
    const gone = b.bolt > 1.2; if (gone || !vis(b.x, b.y, 80)) continue;
    const dx = b.bolt >= 0 ? (b.x < w.p.x ? -1 : 1) * b.bolt * 260 : 0, bx = b.x + dx, by = b.y;
    const f = b.bolt >= 0 ? `bst-${b.kind}-bolt` : b.alarm > 0.35 ? `bst-${b.kind}-alert` : `bst-${b.kind}-rest`;
    list.push([by, () => { x.fillStyle = 'rgba(0,0,0,.25)'; sc.shadow(x, bx, by + 2, 16, 6); spr(x, f, bx, by + 4, { w: 34 * 1.4, flip: dx < 0, alpha: b.bolt >= 0 ? Math.max(0, 1 - b.bolt / 1.2) : 1 }); }]);
  }
}

/** the lanterns' warm glow, and on a torch trail the dark with the torch's circle (world space, over everything) */
export function mandaiOver(sc: Scene, x: X, w: World, vis: Vis, ox: number, oy: number, cw: number, ch: number) {
  const M = w.c.mandai; if (!M || !w.open.has('mandai')) return;
  const run = w.run, c = run && torchOn(w) ? torchOf(run) : null;
  if (!c) {
    for (const [lx, ly] of M.lanterns) if (vis(lx, ly, 60)) sc.glow(x, lx, ly - 20, 30 + Math.sin(sc.t * 2 + lx) * 3, 'rgba(255,190,90,.4)');
    return;
  }
  const p = w.p, st = run!.cur as Extract<Step, { t: 'torch' }>, L = TORCH.light;
  // the dark, with the torch's circle round you
  x.save();
  const g = x.createRadialGradient(p.x, p.y - 20, L * 0.35, p.x, p.y - 20, L * 1.25);
  g.addColorStop(0, 'rgba(4,8,22,0)'); g.addColorStop(0.55, 'rgba(4,8,22,.55)'); g.addColorStop(1, 'rgba(4,8,22,.9)');
  x.fillStyle = g; x.fillRect(ox - 20, oy - 20, cw + 40, ch + 40);
  x.restore();
  // the glowing trail studs and the lanterns, through the dark
  for (const [sx, sy] of M.studs) if (vis(sx, sy, 30)) { spr(x, 'mnd-stud', sx, sy + 6, { w: 26 }); sc.glow(x, sx, sy, 16 + Math.sin(sc.t * 3 + sx) * 2, 'rgba(120,230,255,.45)'); }
  for (const [lx, ly] of M.lanterns) if (vis(lx, ly, 60)) sc.glow(x, lx, ly - 20, 24, 'rgba(255,190,90,.35)');
  // the next marker: a pulsing ring and a lantern post
  const [mx, my] = run!.spot(st.route[Math.min(c.k, st.route.length - 1)]);
  if (vis(mx, my, 80)) {
    sc.glow(x, mx, my - 6, 44 + Math.sin(sc.t * 4) * 6, 'rgba(255,214,90,.5)');
    spr(x, 'mnd-torch', mx, my + 6, { w: 36 });
    x.save(); x.strokeStyle = 'rgba(255,214,90,.9)'; x.lineWidth = 3; x.setLineDash([8, 6]); x.lineDashOffset = -sc.t * 30; x.beginPath(); x.ellipse(mx, my, TORCH.reach, TORCH.reach * 0.55, 0, 0, Math.PI * 2); x.stroke(); x.restore();
  }
  // each resting animal: its eyes shine in the dark, and a faint ring shows how far it can hear (red as it stirs)
  const ear = earOf(run!);
  for (const b of c.beasts) {
    if (b.bolt >= 0 || !vis(b.x, b.y, ear)) continue;
    const a = 0.18 + b.alarm * 0.5;
    x.save(); x.strokeStyle = b.alarm > 0.45 ? `rgba(255,90,70,${a + 0.2})` : `rgba(170,220,255,${a})`; x.lineWidth = 2; x.setLineDash([6, 8]);
    x.beginPath(); x.arc(b.x, b.y, ear, 0, Math.PI * 2); x.stroke(); x.restore();
    const blink = Math.floor(sc.t * 0.8 + b.x) % 5 === 0 && (sc.t * 0.8 + b.x) % 1 < 0.15;
    if (!blink) for (const e of [-5, 5]) sc.glow(x, b.x + e, b.y - 16, 5, b.alarm > 0.45 ? 'rgba(255,120,80,.95)' : 'rgba(200,255,140,.9)');
    if (b.alarm > 0.45) spr(x, 'i-eyes', b.x, b.y - 40, { anchor: 'center', w: 26 });
  }
}
