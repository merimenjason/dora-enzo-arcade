// Above & Below: each room's own drawing (behind the soil, between soil and heroes, and in front), in the order the
// painted room needs it. Drawing only; the rules are in lib/above-rooms.ts and lib/above-rooms2.ts.
import { WW, CELL } from './above-world';
import { Y, X, Y2, X2, bridgeTop, holding, Y3, X3, BUSHES3, Y4, levering, grubberFrame } from './above-rooms';
import type { AboveGame } from './above-game';
import type { AboveScene } from './above-scene';

type C = CanvasRenderingContext2D;

function worm(P: AboveScene, g: C, x: number, y: number, ph: number, t: number) {   // painted glow-worm, code glow
  const b = Math.sin(t * 2 + ph) * 2;
  P.glow(g, x, y + 8 + b, 26, 'rgba(210,255,120,.35)'); P.spr(g, 'worm', x, y + 18 + b, ph > 1.6 ? -1 : 1);
}
function crackLines(g: C, x: number, y: number, n: number) {
  g.strokeStyle = 'rgba(40,30,25,.85)'; g.lineWidth = 2; g.beginPath();
  g.moveTo(x - 20, y); g.lineTo(x - 6, y + 3); g.lineTo(x + 2, y - 2); g.lineTo(x + 16, y + 2);
  if (n > 1) { g.moveTo(x - 6, y + 3); g.lineTo(x - 12, y + 8); g.moveTo(x + 2, y - 2); g.lineTo(x + 8, y - 8); }
  g.stroke();
}
function waterfall(P: AboveScene, g: C, x: number, y0: number, y1: number, t: number, k: number) {
  const w = 24, yb = y0 + (y1 - y0) * k;
  g.globalAlpha = Math.min(1, k * 2);
  g.fillStyle = 'rgba(120,215,250,.85)'; g.beginPath(); g.ellipse(x - 14, y0 + 2, 22, 6, 0, 0, 7); g.fill();
  const gr = g.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
  gr.addColorStop(0, 'rgba(110,205,245,.55)'); gr.addColorStop(0.5, 'rgba(225,250,255,.9)'); gr.addColorStop(1, 'rgba(110,205,245,.55)');
  g.fillStyle = gr; g.fillRect(x - w / 2, y0, w, yb - y0);
  g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 2;
  for (let i = 0; i < 4; i++) { const yy = y0 + ((t * 420 + i * 70) % Math.max(1, yb - y0)); g.beginPath(); g.moveTo(x - 6 + i * 4, yy); g.lineTo(x - 6 + i * 4, yy + 22); g.stroke(); }
  if (k >= 1) P.glow(g, x, y1, 40, 'rgba(255,255,255,.35)');
  g.globalAlpha = 1;
}
function faceBubble(P: AboveScene, g: C, face: string, x: number, y: number) {   // the hero's face over the danger
  g.fillStyle = '#fff8ea'; g.strokeStyle = '#e8573c'; g.lineWidth = 4; g.beginPath(); g.arc(x, y, 30, 0, 7); g.fill(); g.stroke();
  g.save(); g.beginPath(); g.arc(x, y, 27, 0, 7); g.clip(); P.spr(g, face, x, y + 30, 1, { s: 0.92 }); g.restore();
  g.fillStyle = '#e8573c'; g.beginPath(); g.moveTo(x - 9, y + 28); g.lineTo(x, y + 42); g.lineTo(x + 9, y + 28); g.fill();
}

export function drawRoomBack(P: AboveScene, g: C, G: AboveGame, t: number) {
  const o = G.o, id = G.room.id;
  if (id === 'meadow') {
    const E = G.heroes.enzo;
    for (const [x, y, ph] of [[150, 500, 0], [330, 497, 2], [700, 505, 1], [1300, 492, 3], [1500, 495, 1.5]]) worm(P, g, x, y, ph, t);
    P.spr(g, o.door!.open > 0.3 ? 'door1' : 'door0', o.door!.x, o.door!.y);
    const r = o.root!;
    P.spr(g, 'root', r.x, Y.ledge + 6, 1, { sx: 1 + r.wet * 0.05 });
    if (r.wet) P.glow(g, r.x, Y.ledge - 50, 70 * r.wet, 'rgba(160,255,140,.28)');
    if (!(E.state === 'act' && E.act!.name === 'water')) P.spr(g, 'cup', o.cup!.x, o.cup!.y);
    if (o.sluice!.open && !r.wet && Math.random() < 0.07) P.add({ k: 'drop', x: o.cup!.x + 2, y: 500, vy: 60, life: 0.55, s: 2 });
    const s = o.sapling!;
    if (s.stage) P.spr(g, 'sap' + s.stage, s.x, s.y, 1, { sx: 1 + Math.sin(t * 1.3) * 0.015 });
    P.spr(g, o.sluice!.open ? 'sluice1' : 'sluice0', o.sluice!.x, o.sluice!.y);
    if (o.sluice!.open) waterfall(P, g, 478, 368, G.world.water.level, t, Math.min(1, o.sluice!.t * 2.5));
    const f = o.flag!;
    if (!f.broken) {
      const sh = f.t < 0.2 ? Math.sin(f.t * 80) * 2 : 0, rot = f.wob ? Math.sin(f.wob * 40) * 0.05 : 0;
      P.spr(g, 'flag', f.x + sh, f.y + 4, 1, { rot }); if (f.cracks) crackLines(g, f.x, f.y - 6, f.cracks);
    } else P.spr(g, 'broken', f.x, f.y + 6);
  } else if (id === 'orchard') {
    for (const [x, y, ph] of [[180, 506, 0], [650, 504, 2], [1240, 505, 1]]) worm(P, g, x, y, ph, t);
    // the gates (willow above, root portcullis below) creak up with the ropes
    const up = o.gatesUp ? Math.min(1, o.gateT! * 2) : o.rope! * 0.35, jig = !o.gatesUp && o.rope! > 0.05 ? Math.sin(t * 40) * 1.2 : 0;
    g.save(); g.beginPath(); g.rect(0, 0, WW, Y2.meadow + 6); g.clip(); P.spr(g, 'gate', X2.gate + jig, Y2.meadow + 4 - up * 130); g.restore();
    g.save(); g.beginPath(); g.rect(0, Y2.tunTop, WW, Y2.tun - Y2.tunTop + 6); g.clip(); P.spr(g, 'portc', X2.gate + jig, Y2.tun + 4 - up * 150); g.restore();
    P.spr(g, 'pulley', X2.post + 10, Y2.meadow + 6);
    P.spr(g, 'ropepost', X2.post + 6, Y2.tun + 6);
  } else if (id === 'stream') {
    for (const [x, y, ph] of [[240, 500, 0], [760, 498, 2], [1340, 500, 1]]) worm(P, g, x, y, ph, t);
    // hard clay: painted wall cells stay where the clay still is; dug cells show the painted tunnel from further along
    const bg = P.img.bg3;
    if (bg) {
      g.drawImage(bg, 1110, Y3.tunTop - 2, X3.clay1 - X3.clay0 + 4, Y3.tun - Y3.tunTop + 6, X3.clay0 - 2, Y3.tunTop - 2, X3.clay1 - X3.clay0 + 4, Y3.tun - Y3.tunTop + 6);
      for (let y = Y3.tunTop; y < Y3.tun; y += CELL) for (let x = X3.clay0; x < X3.clay1; x += CELL) if (G.world.cellAt(x, y)) g.drawImage(bg, x, y, CELL, CELL, x, y, CELL, CELL);
    }
    P.spr(g, 'sluice' + (levering(G) ? 1 : 0), o.sluice!.x, o.sluice!.y, -1);
    if (o.fall! > 0) waterfall(P, g, 474, 366, G.world.water.level, t, o.fall!);
  } else if (id === 'den') {
    for (const [x, y, ph] of [[230, 520, 0], [400, 500, 2], [1150, 495, 1], [1330, 525, 3]]) worm(P, g, x, y, ph, t);
    for (const c of o.clods!) if (!c.done) {   // a ring on the den floor marks where each clod will land
      const k = Math.max(0, Math.min(1, c.t / 0.9)); g.strokeStyle = `rgba(255,220,150,${0.35 + 0.4 * k})`; g.lineWidth = 3;
      g.beginPath(); g.ellipse(c.x, Y4.den - 2, 40 - 18 * k, 8 - 3 * k, 0, 0, 7); g.stroke();
    }
  }
}

export function drawRoomMid(P: AboveScene, g: C, G: AboveGame, t: number) {
  const o = G.o, id = G.room.id;
  if (id === 'meadow') {
    for (const c of o.caps!) {
      if (!c.gone) { const lift = c.lift ? -10 : 0; P.spr(g, 'boulder', c.x, c.y + lift + Math.sin(t * 30) * (c.lift ? 1 : 0)); }
      else P.spr(g, 'boulder', c.px, c.py + 22, 1, { rot: c.px * 0.03 });
    }
    P.spr(g, 'leaf', o.leaf!.x, o.leaf!.y + 8, 1, { rot: Math.sin(o.leaf!.bob * 1.7) * 0.03 });
    const b = o.bug!;
    if (b.state !== 'gone') {
      if (b.state === 'ball') P.spr(g, 'bug_ball', b.x, b.y, 1, { rot: b.x * 0.05, mid: true, s: 0.8 });
      else P.spr(g, b.state === 'hiss' ? 'bug_hiss' : (b.state === 'squint' || b.state === 'flinch') ? 'bug_squint' : 'bug_idle', b.x, b.y, 1, { sy: 1 + Math.sin(t * 3) * 0.02 });
    }
  } else if (id === 'orchard') {
    // the strut: a stout root Enzo shoves up under the bridge
    const E = G.heroes.enzo, top = bridgeTop(G), paw = holding(G) ? E.y - 112 : Y2.tunTop + 2, len = Math.max(10, paw - (top + 22));
    P.spr(g, 'root', X2.mid + 2, paw, 1, { sy: len / 150, sx: 0.55, a: 0.95 });
    P.spr(g, 'rootlog', X2.mid, top + 30, 1, { rot: (1 - o.lift!) * 0.04 });
  } else if (id === 'stream') {
    P.spr(g, 'leaf', o.leaf!.x, o.leaf!.y + 8, 1, { rot: Math.sin(o.leaf!.bob * 1.7) * 0.03 });
    g.fillStyle = 'rgba(226,190,140,.8)';
    for (const p of o.dust!) { g.globalAlpha = Math.max(0, 1 - p.t / 1.6); g.beginPath(); g.arc(p.x, p.y, 2.2, 0, 7); g.fill(); }
    g.globalAlpha = 1;
  } else if (id === 'den') drawGrubber(P, g, G, t);
}

function drawGrubber(P: AboveScene, g: C, G: AboveGame, t: number) {
  const o = G.o, b = o.gb!, f = grubberFrame(b), sf = b.dir < 0 ? 1 : -1;
  // underground body (hidden while he is up top)
  const up = ['rings', 'erupt', 'nose'].includes(b.st);
  if (!up) {
    let y = Y4.den + 6, a = 1;
    if (b.st === 'dive') { y -= Math.max(0, b.t - 0.4) * 300; a = 1 - Math.max(0, b.t - 0.45) * 3; }
    if (b.st === 'retreat' || b.st === 'fall') y = Math.min(Y4.den + 6, Y4.denTop + 260 * Math.min(1, b.t * 2.2));
    g.save(); g.beginPath(); g.rect(0, Y4.denTop - 10, WW, Y4.den - Y4.denTop + 40); g.clip();
    P.spr(g, f, b.x, y, sf, { a: Math.max(0, a), sy: b.st === 'sleep' ? 1 + Math.sin(t * 1.5) * 0.02 : 1 });
    g.restore();
    if (b.st === 'dizzy') for (let i = 0; i < 3; i++) { const a2 = t * 4 + i * 2.1; P.star(g, b.x + Math.cos(a2) * 50, Y4.den - 250 + Math.sin(a2) * 12, 8, '#ffe36e'); }
    if (b.st === 'sleep') { g.globalAlpha = 0.8; P.txt(g, 'z', b.x + 80 + Math.sin(t * 2) * 6, Y4.den - 200 - (t * 30 % 60), 28, '#fff4dc', 'center', '#5b3a20'); g.globalAlpha = 1; }
  }
  // the dirt wave
  if (o.wave) P.spr(g, 'burst', o.wave.x, Y4.den + 6, o.wave.dir, { s: 0.42 });
  for (const c of o.clods!) if (!c.done && c.t > 0.9) P.spr(g, 'chin', c.x, c.y, 1, { s: 0.6, rot: c.t * 4 });
  // up top: the heaving meadow
  if (b.st === 'rings') {
    const k = b.t / b.tell;
    for (let i = 0; i < 3; i++) {
      const r = (t * 1.4 + i / 3) % 1; g.strokeStyle = `rgba(90,50,20,${(1 - r) * (0.4 + 0.5 * k)})`; g.lineWidth = 4;
      g.beginPath(); g.ellipse(b.nx, Y4.meadow + 2, 30 + r * 110, 6 + r * 16, 0, 0, 7); g.stroke();
    }
    P.spr(g, 'mound', b.nx + Math.sin(t * 50) * 2 * k, Y4.meadow + 10 + (1 - k) * 50, 1, { sy: 0.3 + 0.7 * k });
    faceBubble(P, g, 'd_face', b.nx, Y4.meadow - 150 - Math.sin(t * 6) * 4);
  }
  if (b.st === 'erupt' || b.st === 'nose' || b.st === 'retreat') {
    g.save(); g.beginPath(); g.rect(0, 0, WW, Y4.meadow + 8); g.clip();
    if (b.st === 'erupt') { const k = Math.sin(Math.min(1, b.t / 0.9) * Math.PI); P.spr(g, 'g_roar', b.nx, Y4.meadow + 250 - k * 250, -1); }
    if (b.st === 'nose') P.spr(g, 'g_nose', b.nx, Y4.meadow + 22 - Math.min(1, b.t * 4) * 18 + Math.sin(t * 9) * 2, 1);
    if (b.st === 'retreat') P.spr(g, 'g_nose', b.nx, Y4.meadow + 4 + b.t * 60, 1);
    g.restore();
    if (b.st === 'erupt' && b.t < 0.5) P.spr(g, 'burst', b.nx, Y4.meadow + 30, 1, { a: 1 - b.t * 2 });
    P.spr(g, 'turf', b.nx, Y4.meadow + 10);
  }
  if (b.st === 'wind' || b.st === 'windlow') faceBubble(P, g, 'e_face', b.x, Y4.den - 300 - Math.sin(t * 6) * 4);
}

export function drawRoomFront(P: AboveScene, g: C, G: AboveGame, t: number) {
  if (G.room.id === 'meadow') drawDarkRoom(P, g, G, t);
  else if (G.room.id === 'stream') for (const b of BUSHES3) P.spr(g, 'bush', b, Y3.meadow + 8, 1, { sx: 1 + Math.sin(t * 2 + b) * 0.01 });
}

// the woodlouse's dark chamber, the first-crack ray and the sunbeam
function drawDarkRoom(P: AboveScene, g: C, G: AboveGame, t: number) {
  const o = G.o, E = G.heroes.enzo, beam = o.beam!;
  if (!P.darkCan) { P.darkCan = document.createElement('canvas'); P.darkCan.width = 320; P.darkCan.height = 280; }
  const dark = P.darkCan, x0 = X.chamL - 20, y0 = 430, w = dark.width, h = dark.height;
  const c = dark.getContext('2d')!; c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-over'; c.clearRect(0, 0, w, h);
  c.shadowColor = `rgba(12,6,22,${0.86 * (1 - beam * 0.92)})`; c.shadowBlur = 44; c.shadowOffsetX = 2000;
  c.fillStyle = '#000'; c.beginPath(); c.roundRect(X.chamL - x0 + 22 - 2000, 445 - y0 + 22, X.chamR - X.chamL - 36, Y.cham - 445 - 40, 40); c.fill();
  c.shadowColor = 'transparent'; c.shadowOffsetX = 0;
  c.globalCompositeOperation = 'destination-out';
  const hole = (x: number, y: number, r: number, a: number) => { const gr = c.createRadialGradient(x - x0, y - y0, 0, x - x0, y - y0, r); gr.addColorStop(0, `rgba(0,0,0,${a})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gr; c.fillRect(0, 0, w, h); };
  hole(E.x, E.y - 45, 95, 0.85); hole(X.chamL - 10, 600, 70, 0.7); hole(X.chamR + 10, 560, 60, 0.6);
  g.drawImage(dark, x0, y0);
  const b = o.bug!, f = o.flag!;
  if (b.state === 'block' || b.state === 'hiss') { const p = 0.6 + Math.sin(t * 4) * 0.3; P.glow(g, b.x - 28, b.y - 52, 14, `rgba(255,190,60,${p})`); }
  if (!f.broken && (f.cracks === 1 || f.wob > 0)) {
    g.save(); g.globalCompositeOperation = 'lighter'; const a = (f.cracks ? 0.3 : 0.12) + Math.sin(t * 6) * 0.08;
    g.fillStyle = `rgba(255,236,170,${a})`; g.beginPath(); g.moveTo(1058, Y.bank + 8); g.lineTo(1066, Y.bank + 8); g.lineTo(1095, Y.cham); g.lineTo(1075, Y.cham); g.closePath(); g.fill();
    P.glow(g, 1085, Y.cham - 4, 40, `rgba(255,220,140,${a})`); g.restore();
  }
  if (beam > 0) {
    g.save(); g.globalCompositeOperation = 'lighter';
    const flick = 0.85 + Math.sin(t * 1.7) * 0.08, gr = g.createLinearGradient(0, Y.bank, 0, Y.cham);
    gr.addColorStop(0, `rgba(255,236,170,${0.55 * beam * flick})`); gr.addColorStop(1, `rgba(255,214,120,${0.12 * beam})`);
    g.fillStyle = gr; g.beginPath(); g.moveTo(1040, Y.bank + 6); g.lineTo(1085, Y.bank + 6); g.lineTo(1180, Y.cham); g.lineTo(990, Y.cham); g.closePath(); g.fill();
    P.glow(g, 1085, Y.cham - 6, 120 * beam, `rgba(255,220,140,${0.3 * beam})`);
    g.restore();
    if (Math.random() < 0.3 * beam) P.spawn('mote', 1030 + Math.random() * 90, 300 + Math.random() * 300, 1);
  }
}
