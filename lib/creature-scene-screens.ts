// Every Creature: each screen's pictures (drawing only). Behind the heroes (props, the seesaw, ramps, vines), the
// animals, in front of them, the sky (Storm Falls' storm and rainbow) and the glints that point at what to try next.
// Ported from the draw functions of the prototype's s1–s4.js.
import { G, LV, clamp, lerp, floorAt, type Hero } from './creature-game.js';
import type { CreatureScene } from './creature-scene.js';
import { S1, GY2, type S1State } from './creature-s1.js';
import { S2, S2G, type S2State } from './creature-s2.js';
import { S3, S3G, S3W, type S3State } from './creature-s3.js';
import { S4, S4G, type S4State } from './creature-s4.js';

type Draw = (sc: CreatureScene, t: number) => void;
export interface ScreenDraw { back: Draw; animals: Draw; front: Draw; glints: Draw; sky?: Draw }
const R = Math.random;
const FONT = 'Fredoka, "Avenir Next", "Trebuchet MS", system-ui, sans-serif';

// ---------------------------------------------------------------- shared effect drawers
function glitter(sc: CreatureScene, t: number) {
  if (!LV.water) return; const W = LV.water, cx = sc.cx;
  cx.save(); cx.fillStyle = '#fffbe6';
  for (let i = 0; i < 26; i++) { const x = W.x1 + ((i * 337) % (W.x2 - W.x1)), y = W.y + 20 + ((i * 53) % 200), k = Math.sin(t * 2.4 + i * 1.7); if (k > .6) { cx.globalAlpha = (k - .6) * 2; cx.fillRect(x, y, 10, 2); } }
  cx.restore();
}
/** the warning ring under a threat's target: it shrinks as the strike nears and turns red once locked */
function tellRing(sc: CreatureScene, x: number, y: number, k: number, lock: boolean, rx = 110, ry = 16) {
  const cx = sc.cx;
  cx.save(); cx.strokeStyle = lock ? '#ff7a5a' : '#fff2b0'; cx.lineWidth = 4 + k * 3; cx.globalAlpha = .5 + .5 * Math.sin(G.t * 20 * (lock ? 1.6 : 1));
  cx.beginPath(); cx.ellipse(x, y, rx - k * rx * .45, ry - k * ry * .4, 0, 0, Math.PI * 2); cx.stroke(); cx.restore();
}
function drawRamp(sc: CreatureScene, k: number, x0: number, y0: number, pts: [number, number][], img = 'log') {
  const cx = sc.cx, [a0, a1] = pts, ang = Math.atan2(a1[1] - a0[1], a1[0] - a0[0]);
  cx.save(); const px = lerp(x0, (a0[0] + a1[0]) / 2, k), py = lerp(y0, (a0[1] + a1[1]) / 2, k);
  cx.translate(px, py); cx.rotate(ang * k); const im = sc.I[img]; if (im) { const len = Math.hypot(a1[0] - a0[0], a1[1] - a0[1]) + 40, hh = len * im.height / im.width; cx.drawImage(im, -len / 2, -hh / 2 + 6, len, hh); } cx.restore();
}
function drawVine(sc: CreatureScene, x: number, top: number, bot: number, k: number) {
  const cx = sc.cx, im = sc.I.vine; if (!im) return; const full = bot - top, len = full * clamp(k * 1.05, 0, 1), w = 42;
  cx.save(); cx.translate(x, top); cx.rotate(Math.sin(G.t * 1.3) * .006); cx.drawImage(im, 0, 0, im.width, im.height * len / full, -w / 2, 0, w, len); cx.restore();
}
function stretchVine(sc: CreatureScene, x1: number, y1: number, x2: number, y2: number) {
  const cx = sc.cx, im = sc.I.vine; if (!im) return; const len = Math.hypot(x2 - x1, y2 - y1), a = Math.atan2(y2 - y1, x2 - x1) - Math.PI / 2;
  cx.save(); cx.translate(x1, y1); cx.rotate(a); cx.drawImage(im, -14, 0, 28, len); cx.restore();
}
function winGlow(sc: CreatureScene, x: number, y: number) { const cx = sc.cx; cx.save(); cx.globalCompositeOperation = 'lighter'; const gr = cx.createRadialGradient(x, y, 10, x, y, 260); gr.addColorStop(0, 'rgba(255,220,120,.7)'); gr.addColorStop(1, 'rgba(255,220,120,0)'); cx.fillStyle = gr; cx.fillRect(x - 300, y - 270, 600, 560); cx.restore(); }
/** progress dots over an animal you are befriending */
function dots(sc: CreatureScene, x: number, y: number, n: number, of: number) { const cx = sc.cx; for (let i = 0; i < of; i++) { cx.save(); cx.fillStyle = i < n ? '#ffe08a' : 'rgba(255,255,255,.35)'; cx.beginPath(); cx.arc(x - (of - 1) * 9 + i * 18, y, 6, 0, 7); cx.fill(); cx.restore(); } }
function digRing(sc: CreatureScene, dig: number) {
  const cx = sc.cx;
  for (const h of G.heroes) if (h.digging) { cx.save(); cx.strokeStyle = '#ffe08a'; cx.lineWidth = 6; cx.globalAlpha = .85; cx.beginPath(); cx.arc(h.x, h.y - 90, 18, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * dig / 4.3); cx.stroke(); cx.restore(); }
}

// ---------------------------------------------------------------- The Lake
const L1 = S1.LV, s1 = () => G.S as S1State;
const lake: ScreenDraw = {
  back(sc, t) {
    const L = L1, S = s1(), cx = sc.cx;
    cx.save(); cx.globalAlpha = .35; cx.strokeStyle = '#ffffff'; cx.lineWidth = 3;
    for (let i = 0; i < 9; i++) { const x = L.fall.x1 + i * (L.fall.x2 - L.fall.x1) / 8, ph = (t * 520 + i * 97) % 300; cx.beginPath(); cx.moveTo(x, L.fall.top + ph); cx.lineTo(x, L.fall.top + ph + 60); cx.stroke(); cx.beginPath(); cx.moveTo(x, L.fall.top + ph + 300); cx.lineTo(x, Math.min(L.fall.bot, L.fall.top + ph + 360)); cx.stroke(); }
    cx.restore();
    if (R() < .5) sc.fx((L.fall.x1 + L.fall.x2) / 2 + (R() - .5) * 90, L.fall.bot - 5, 1, { a: -Math.PI / 2, spread: 2, s: 60, g: -20, k: 'mist', life: 1.6, r: 22 });
    glitter(sc, t);
    const p = S.pike;
    if (p.st === 'lurk' || p.st === 'tell') {
      cx.save(); cx.beginPath(); cx.rect(0, L.water.y + 3, L.W, L.H); cx.clip();
      sc.spr('pike-swim', p.x, L.water.y + 95, { f: p.dir, a: .45, s: 0.8 }); cx.restore();
      cx.save(); cx.strokeStyle = 'rgba(255,255,255,.6)'; cx.lineWidth = 2; cx.beginPath(); cx.ellipse(p.x, L.water.y + 2, 30 + Math.sin(t * 6) * 4, 5, 0, 0, Math.PI * 2); cx.stroke(); cx.restore();
    }
    if (p.st === 'tell') tellRing(sc, p.rx, L.water.y + 4, clamp(p.t / (G.assist ? 2 : 1.3), 0, 1), p.lock);
    for (const pd of L.pads) { const bob = Math.sin(t * 1.6 + pd.x) * 2 + (pd.dip || 0) * 14; sc.spr(pd.img, pd.x, L.water.y + 12 + bob, { w: pd.w * 1.25 }); }
    if (S.ramp < 1e-9) sc.spr('log', L.log.x + 30, L.log.y + 8, { h: 44 });
    else drawRamp(sc, S.ramp, L.log.x + 30, L.log.y - 14, L.ramps[0].pts);
    if (S.vine <= 0) sc.spr('coil', L.coil.x, L.coil.y + 6, { h: 56 });
    else drawVine(sc, 1590, 165, GY2 + 10, S.vine);
    sc.spr('stone', L.stone.x, L.stone.y + 6, { h: 140 });
    if (G.clear) winGlow(sc, L.stone.x, L.stone.y - 70);
    sc.spr('nest', L.nest.x, L.nest.y + 6, { h: 34 });
    const pa = S.parent;
    if (pa.st !== 'away') {
      if (pa.st === 'perch') sc.spr('parent-perch', pa.x, pa.y + 4, { h: 64, f: -1 });
      else sc.spr(pa.twig ? 'parent-carry' : (t * 8 | 0) % 2 ? 'parent-fly1' : 'parent-fly2', pa.x, pa.y + 30, { h: 78, f: pa.st === 'out' ? -1 : 1 });
    }
    if (!pa.twig) sc.spr('twig', L.twig.x, L.twig.y + 4, { h: 22 });
    const hr = S.heron; sc.spr(({ idle: 'heron-idle', peer: 'heron-peer', snap: 'heron-snap', bow: 'heron-bow' } as Record<string, string>)[hr.st], L.heron.x, L.heron.y + 8, { f: -1 });
  },
  animals(sc, t) {
    const A = s1().A, L = L1, cx = sc.cx;
    const fr = A.frog, fh = Math.sin(Math.PI * fr.hop) * 30;
    const fimg = fr.hop > .05 ? 'a-frog-hop' : (fr.puzzT > 0 ? 'a-frog-sit' : (t % 3 < .4 ? 'a-frog-croak' : 'a-frog-sit'));
    sc.spr(fimg, fr.x, fr.y - fh + (G.friends.frog && Math.abs(fr.x - L.pads[0].x) < 5 ? 2 : 0), { f: -1, s: 0.95 });
    if (fr.puzzT > 0) { cx.save(); cx.globalAlpha = fr.puzzT; cx.fillStyle = '#fff'; cx.font = '700 30px ' + FONT; cx.textAlign = 'center'; cx.fillText('?', fr.x, fr.y - 70); cx.restore(); }
    if (!G.friends.frog && fr.seq.length) dots(sc, fr.x, fr.y - 78, fr.seq.length, 3);
    const to = A.tort;
    if (to.st === 'back') { const rock = Math.sin(t * 5) * .12 + to.pop * .5 * (to.flips % 2 ? 1 : -1); sc.spr(to.flips ? 'a-tort-side' : 'a-tort-back', to.x, to.y + 4, { rot: rock }); }
    else sc.spr(Math.abs(to.x - 60) > 1 ? 'a-tort-walk' : 'a-tort-up', to.x, to.y + 4, { f: -1 });
    const be = A.beetle, bs = 0.62;
    if (be.cy > 0) sc.spr('a-beetle-run' + (1 + ((t * 10 | 0) % 2)), be.x, be.y - be.cy, { rot: -Math.PI / 2, s: bs });
    else sc.spr(be.st === 'run' || be.st === 'demo' ? 'a-beetle-run' + (1 + ((t * 12 | 0) % 2)) : (be.st === 'happy' || be.st === 'tired') ? 'a-beetle-happy' : 'a-beetle-idle', be.x, be.y + 2, { f: be.face, s: bs });
    if (be.st === 'tired' && !G.friends.beetle) { cx.save(); cx.fillStyle = 'rgba(200,235,255,.9)'; cx.beginPath(); cx.ellipse(be.x + 20, be.y - 44 - (t * 20 % 10), 4, 6, 0, 0, 7); cx.fill(); cx.restore(); }
    const ch = A.chick, cimg = ({ ground: 'a-chick-perch', flap: 'a-chick-flap', tumble: 'a-chick-tumble', boost: 'a-chick-flap', nest: 'a-chick-happy' } as Record<string, string>)[ch.st];
    sc.spr(cimg, ch.x, ch.y - ch.hgt + (ch.st === 'flap' ? Math.sin(t * 20) * 3 : 0), { f: ch.st === 'nest' ? 1 : ch.face });
    if (ch.st === 'flap' && R() < .2) sc.fx(ch.x, ch.y - ch.hgt - 20, 1, { s: 120, g: 90, k: 'feather', life: 1.4, r: 9, c: 'chick' });
  },
  front(sc) {
    const p = s1().pike, L = L1;
    if (p.st === 'lunge' || p.st === 'bonk' || p.st === 'dive') {
      const k = p.st === 'dive' ? 1 - p.t / .45 : Math.min(1, p.t / .15);
      sc.spr(p.st === 'bonk' ? 'pike-bonk' : p.st === 'dive' ? 'pike-dive' : 'pike-lunge', p.rx, L.water.y + 60 - k * 70, { f: p.dir, s: 0.8 });
    }
  },
  glints(sc, t) {
    const s = S1.stage(), S = s1(), A = S.A, L = L1;
    if (!G.friends.frog) sc.drawGlint(A.frog.x + 26, A.frog.y - 60, 1, 0);
    if (!G.friends.tort) sc.drawGlint(A.tort.x, A.tort.y - 70, 1, 1);
    if (S.ramp >= 1 && !G.friends.beetle) sc.drawGlint(A.beetle.x, A.beetle.y - 50, .9, 2);
    if (S.ramp >= 1 && !G.friends.bird) sc.drawGlint(A.chick.x, A.chick.y - A.chick.hgt - 50, .9, 3);
    if (s === 'lake' && G.heroes.some((h) => h.x > 1300 && h.y < GY2 + 8)) sc.drawGlint(L.log.x + 30, L.log.y - 40, 1.2, .5);
    if (s === 'lake' && G.heroes.some((h) => h.ride && h.ride.form === 'tort' && h.x > 1100)) sc.drawGlint(1320, 630, 1.2, 1.5);
    if (s === 'cliff' && G.heroes.some((h) => h.y <= 169)) sc.drawGlint(L.coil.x, L.coil.y - 50, 1.2, .2);
    if (s === 'cliff' && !S.perched) sc.drawGlint(L.nest.x - 20, L.nest.y - 30, 1, 2.5);
    if (s === 'top' && !G.clear) sc.drawGlint(1590, GY2 - 120 - ((t * 120) % 300), 1, 0);
  },
};

// ---------------------------------------------------------------- Fox Hollow
const L2 = S2.LV, s2 = () => G.S as S2State;
const hollow: ScreenDraw = {
  back(sc, t) {
    const S = s2(), L = L2, P = L.piv, cx = sc.cx;
    if (!S.tunnel) sc.spr('mound', L.dig.x, S2G + 8, { h: 34 * (1 - Math.min(.6, S.dig / 6)) + 4 });
    else { sc.spr('hole', L.dig.x, S2G + 10, { h: 44 }); sc.spr('hole', L.exitHole.x, floorAt(L.exitHole.x) + 10, { h: 40 }); }
    sc.spr('pivot', P.x, P.y + 32, { h: 44 });
    const pl = sc.I.plank; if (pl) { cx.save(); cx.translate(P.x, P.y); cx.rotate(S.saw); const w = P.half * 2 + 20, h = w * pl.height / pl.width; cx.drawImage(pl, -w / 2, -h * .55, w, h); cx.restore(); }
    sc.spr(S.door >= 1 ? 'door1' : 'door0', 1672, S2G + 4, { h: 150 });
    if (S.door > 0 && S.door < 1) sc.fx(1672, 700, 1, { s: 120, g: 300, k: 'leaf', r: 6 });
    sc.spr('root', L.root.x, L.root.y + 6, { h: 60, rot: S.door > 0 ? -.4 * Math.min(1, S.door * 3) : Math.sin(t * 2) * .03 });
  },
  animals(sc, t) {
    const S = s2(), L = L2, k = S.kit;
    if (G.friends.fox) sc.spr('kit-happy', k.x, S2G + 4, { h: 52 });
    else if (k.st === 'peek') { const up = Math.min(1, (G.assist ? 2.4 : 1.6) - k.t) * 4; sc.spr('kit-peek', k.x, S2G - 26 + 30 * (1 - clamp(up, 0, 1)), { h: 60 }); }
    for (const [i, x] of L.bushes.entries()) { const shake = !G.friends.fox && k.st === 'peek' && k.bush === i ? Math.sin(t * 30) * .03 : 0; sc.spr('bush', x, S2G + 10, { h: 92, rot: shake }); }
    if (!G.friends.fox && k.tags) dots(sc, L.bushes[1], 650, k.tags, 3);
    const hk = S.hawk, img = ({ perch: 'hawk-perch', tell: 'hawk-perch', dive: 'hawk-dive', dazed: 'hawk-dazed', up: 'hawk-up' } as Record<string, string>)[hk.st];
    sc.spr(img, hk.x, hk.y + (hk.st === 'perch' || hk.st === 'tell' ? 6 : 50), { h: hk.st === 'dazed' ? 80 : 110, f: hk.st === 'dive' ? (hk.rx > L.tree.x ? -1 : 1) : 1, rot: hk.st === 'tell' ? Math.sin(t * 10) * .05 : 0 });
    if (hk.st === 'dazed') for (let i = 0; i < 3; i++) { const a = t * 5 + i * 2.1; sc.drawGlint(hk.x + Math.cos(a) * 34, hk.y - 30 + Math.sin(a) * 10, .5, i); }
    if (hk.st === 'tell') tellRing(sc, hk.rx, (hk.ry || S2G) + 4, clamp(hk.t / (G.assist ? 1.8 : 1.3), 0, 1), hk.lock, 90, 16);
  },
  front(sc) { digRing(sc, s2().dig); },
  glints(sc) {
    const S = s2(), L = L2, s = S2.stage();
    if (s === 'meet' && S.kit.st === 'peek') sc.drawGlint(S.kit.x, S2G - 120, 1);
    if (s === 'dig') { sc.drawGlint(L.dig.x, S2G - 60, 1.1, 1); if (S.digHint > 3 || G.stats.hits > 1) sc.drawGlint(820, S2G - 90, .9, 2); }
    if (s === 'seesaw') { sc.drawGlint(1600, 740, 1, .5); sc.drawGlint(1395, 640, 1, 2); }
    if (s === 'door' || (s === 'seesaw' && G.heroes.some((h) => h.y < 440))) sc.drawGlint(L.root.x, 380, 1.1, 1);
    if (s === 'exit') sc.drawGlint(1880, 720, 1.2, 0);
  },
};

// ---------------------------------------------------------------- Otter River
const L3 = S3.LV, s3 = () => G.S as S3State;
const river: ScreenDraw = {
  back(sc, t) {
    const S = s3(), L = L3, cx = sc.cx;
    glitter(sc, t);
    cx.save(); cx.strokeStyle = 'rgba(255,255,255,.35)'; cx.lineWidth = 2; // the current's streaks
    for (let i = 0; i < 14; i++) { const x = L.current.x2 - ((t * 230 + i * 137) % (L.current.x2 - L.current.x1)), y = S3W + 12 + (i * 37) % 120; if (x > 1000 && x < 1160 && y < 950) continue; cx.beginPath(); cx.moveTo(x, y); cx.lineTo(x + 40, y); cx.stroke(); }
    cx.restore();
    if (S.ramp < 1e-9) sc.spr('log', L.log.x + 20, L.log.y + 8, { h: 44 });
    else drawRamp(sc, S.ramp, L.log.x + 20, L.log.y - 14, L.ramps[0].pts);
  },
  animals(sc, t) {
    const p = s3().pup, cx = sc.cx, img = ({ float: 'pup-float', toss: 'pup-toss', fly: 'pup-float', back: 'pup-float', clap: (t * 3 | 0) % 2 ? 'pup-clap' : 'pup-float' } as Record<string, string>)[p.st];
    sc.spr(img, p.px, S3W + 14 + Math.sin(t * 2) * 3, { h: 44, f: -1 });
    const pb = S3.pebblePos();
    if (pb) { sc.spr('pebble', pb.x, pb.y, { h: 16 }); if (p.st === 'fly') { cx.save(); cx.fillStyle = 'rgba(40,30,10,.35)'; cx.beginPath(); cx.ellipse(p.tx, S3G + 2, 14 + p.fl * 22, 5, 0, 0, 7); cx.fill(); cx.restore(); } }
    else if (p.st !== 'clap') sc.spr('pebble', p.px, S3W - 8, { h: 14 });
    if (!G.friends.otter && p.catches) dots(sc, p.px, S3W - 70, p.catches, 3);
  },
  front() { /* nothing in front */ },
  glints(sc) {
    const S = s3(), s = S3.stage();
    if (s === 'meet') { if (S.pup.st === 'fly') sc.drawGlint(S.pup.tx, S3G - 30, 1); else sc.drawGlint(S.pup.px, S3W - 60, .9, 1); }
    if (s === 'dive') sc.drawGlint(1080, S3W + 110, 1.1, 1);
    if (s === 'bank') sc.drawGlint(L3.log.x, 600, 1.1, 2);
    if (s === 'exit') sc.drawGlint(1880, 600, 1.2);
  },
};

// ---------------------------------------------------------------- Storm Falls
const L4 = S4.LV, s4 = () => G.S as S4State;
const falls: ScreenDraw = {
  back(sc, t) {
    const S = s4(), L = L4, cx = sc.cx;
    cx.save(); cx.globalAlpha = .3; cx.strokeStyle = '#fff'; cx.lineWidth = 3; // the waterfall's shimmer and spray
    for (let i = 0; i < 10; i++) { const x = L.fall.x1 + i * (L.fall.x2 - L.fall.x1) / 9, ph = (t * 600 + i * 83) % 260; cx.beginPath(); cx.moveTo(x, 300 + ph); cx.lineTo(x, 360 + ph); cx.stroke(); cx.beginPath(); cx.moveTo(x, 560 + ph); cx.lineTo(x, 620 + ph); cx.stroke(); }
    cx.restore();
    if (R() < .6) sc.fx(lerp(L.fall.x1, L.fall.x2, R()), 700 + R() * 300, 1, { a: -Math.PI / 2, spread: 2, s: 50, g: -20, k: 'mist', life: 1.8, r: 26 });
    glitter(sc, t);
    // the vine: from the heron's feet to the stake and down to the crevice
    const hx = L.heron.x - 30, hy = S4G - 10;
    if (!S.knots[0]) { stretchVine(sc, hx, hy, L.stake.x, S4G - 6); sc.spr('mound', L.stake.x, S4G + 8, { h: 30 }); sc.spr('knot', L.stake.x, S4G - 2, { h: 44 }); }
    if (!S.knots[1]) { stretchVine(sc, hx, hy, L.crev.x, L.crev.y); sc.spr('knot', L.crev.x, L.crev.y + 10, { h: 40 }); }
  },
  animals(sc, t) {
    const S = s4(), L = L4, ph = S4.phase(), w = S.watch, k = S.sky, cx = sc.cx;
    let img = 'sheron-idle';
    if (ph === 3) img = S.calmT > 1.2 ? ((S.calmT % 4) < 2 ? 'sheron-bow' : 'sheron-calm') : 'sheron-shake';
    else if (k.st === 'tell') img = 'sheron-raise'; else if (k.st === 'reel') img = 'sheron-shake';
    else if (w.st === 'snap') img = 'sheron-lunge';
    sc.spr(img, L.heron.x, S4G + 8, {});
    if (!S.knots[2]) { sc.spr('knot', L.neck.x, L.neck.y + 26, { h: 46 }); if (ph < 3 && R() < .06) sc.fx(L.heron.x + (R() - .5) * 140, 300 + R() * 300, 1, { s: 140, g: 0, k: 'spark', life: .3, r: 6 }); }
    if (w.st === 'peer' && w.tgt) { cx.save(); cx.strokeStyle = '#ff9a6a'; cx.lineWidth = 4; cx.globalAlpha = .5 + .5 * Math.sin(t * 22); cx.beginPath(); cx.arc(w.tgt.x, w.tgt.y - 35, 46, 0, 7); cx.stroke(); cx.restore(); }
  },
  front(sc, t) {
    const S = s4(), k = S.sky, cx = sc.cx;
    digRing(sc, S.dig);
    if (k.st === 'tell') { tellRing(sc, k.rx, k.ry + 4, clamp(1 - k.t / (G.assist ? 2 : 1.4), 0, 1), k.lock, 95, 18); cx.save(); cx.globalAlpha = .25 + .2 * Math.sin(t * 15); cx.fillStyle = '#dff1ff'; cx.fillRect(k.rx - 3, 0, 6, k.ry); cx.restore(); }
    if (S.bolt) sc.drawBolt(S.bolt.x, S.bolt.y, S.bolt.seed, 1 - S.bolt.t / .35);
  },
  /** the storm over everything: dark sky, rain, flashes; it clears into a rainbow at the end */
  sky(sc, t) {
    const S = s4(), cx = sc.cx;
    if (S.storm > 0) {
      cx.save(); cx.globalAlpha = S.storm * .28; cx.fillStyle = '#1a2440'; cx.fillRect(0, 0, 1920, 1080); cx.restore();
      cx.save(); cx.strokeStyle = 'rgba(200,220,255,.45)'; cx.lineWidth = 2; cx.globalAlpha = S.storm;
      for (let i = 0; i < 70; i++) { const x = (i * 211 + t * 300) % 2000 - 40, y = (i * 97 + t * 1300) % 1120 - 40; cx.beginPath(); cx.moveTo(x, y); cx.lineTo(x - 10, y + 34); cx.stroke(); }
      cx.restore();
    }
    if (S.flash > 0) { cx.save(); cx.globalAlpha = Math.min(1, S.flash * 1.2); cx.fillStyle = '#e8f3ff'; cx.fillRect(0, 0, 1920, 1080); cx.restore(); }
    if (S4.phase() === 3) {
      const k = clamp(S.calmT / 3, 0, 1);
      cx.save(); cx.globalCompositeOperation = 'lighter'; cx.globalAlpha = .22 * k; const g = cx.createLinearGradient(0, 0, 0, 1080); g.addColorStop(0, '#ffcf80'); g.addColorStop(1, '#ff9a70'); cx.fillStyle = g; cx.fillRect(0, 0, 1920, 1080); cx.restore();
      cx.save(); cx.globalAlpha = .45 * k; cx.lineWidth = 22; ['#ff6b6b', '#ffb14a', '#ffe66b', '#7be08a', '#6bc0ff', '#9b7bff'].forEach((c, i) => { cx.strokeStyle = c; cx.beginPath(); cx.arc(1100, 1100, 820 - i * 22, Math.PI * 1.08, Math.PI * 1.92); cx.stroke(); }); cx.restore();
    }
  },
  glints(sc) {
    const L = L4, ph = S4.phase();
    if (ph === 0) sc.drawGlint(L.stake.x, S4G - 70, 1.1);
    if (ph === 1) sc.drawGlint(L.crev.x, L.crev.y - 40, 1.1, 1);
    if (ph === 2) { sc.drawGlint(L.neck.x + 20, L.neck.y - 10, 1.2, 2); if (!G.heroes.some((h: Hero) => h.carry)) sc.drawGlint(1440, 560, .8, 1); }
  },
};

export const SCREEN_DRAW: Record<string, ScreenDraw> = { s1: lake, s2: hollow, s3: river, s4: falls };