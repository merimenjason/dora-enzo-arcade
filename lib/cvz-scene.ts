// Canvas 2D drawing for Chinchillas vs Zombies: a sunny striped lawn in front of Dora and Enzo's burrow, hay carts
// at the end of each lane, chinchilla defenders facing right (the shared Dora and Enzo drawing), cartoon zombies
// shambling in from the street, pellets, seed pouches to click, and effects.
import { Game, DEFENDERS, ZOMBIES, ROWS, COLS, type DefenderId, type ZombieId, type Defender, type Zombie, type Seed, type Effect } from './cvz-game';
import { COATS, coatLike, drawChinchilla, type Coat } from './chinchilla-art';

export const TW = 86, TH = 100, OX = 132, OY = 64, VIEW_W = OX + COLS * TW + 64, VIEW_H = OY + ROWS * TH + 14;
export const toTile = (px: number, py: number) => ({ col: Math.floor((px - OX) / TW), row: Math.floor((py - OY) / TH) });
export const seedPx = (s: Seed) => ({ x: OX + s.x * TW, y: OY + s.y * TH });
const X = (x: number) => OX + x * TW, Y = (y: number) => OY + y * TH;

const blackEyes = { eye: '#16121a', pupil: '#000000', earGlow: false, eyeR: 1.75 };
const KIT: Coat = coatLike('dora', { ...blackEyes, fur: '#eeeaf0', back: '#dad3df', face: '#f6f3f8', shade: '#ccc4d2', texture: '#d8d0dc', tail: '#ebe6ee', tailInner: '#cfc6d6' });
const KIT2: Coat = coatLike('enzo', { fur: '#8d8b93', back: '#66646c', face: '#a3a1aa', shade: '#75737b', texture: '#6a6870', tail: '#8a8892', tailOuter: '#67656e' });
const BEIGE: Coat = coatLike('dora', { fur: '#ecd6b3', back: '#d8bc90', face: '#f4e4cb', shade: '#caa97e', texture: '#cfb48b', tail: '#e9d2ad', tailInner: '#d0b58c' });
const PEBBLE: Coat = coatLike('enzo', { fur: '#a9a7b0', back: '#8a8891', face: '#c4c2ca', shade: '#96949d', texture: '#8f8d96', tail: '#b0aeb7', tailOuter: '#8c8a94', tailInner: '#d2d0d8', bands: false });

const ellipse = (c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill?: string, rot = 0) => {
  c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2);
  if (fill) { c.fillStyle = fill; c.fill(); }
};
const hash = (n: number) => { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); };

// ---------- The yard ----------

function yard(c: CanvasRenderingContext2D, g: Game, time: number) {
  const sky = c.createLinearGradient(0, 0, 0, OY);
  sky.addColorStop(0, '#8fd3ff'); sky.addColorStop(1, '#c9ecff');
  c.fillStyle = sky; c.fillRect(0, 0, VIEW_W, OY);
  // Clouds drifting.
  for (let i = 0; i < 4; i++) { const x = ((i * 260 + time * 8) % (VIEW_W + 160)) - 80, y = 16 + (i % 2) * 18; ellipse(c, x, y, 34, 11, 'rgba(255, 255, 255, 0.9)'); ellipse(c, x + 22, y - 6, 20, 10, 'rgba(255, 255, 255, 0.9)'); }
  // Hedge along the top, the street on the right.
  c.fillStyle = '#4f8f3a'; c.fillRect(0, OY - 14, VIEW_W, 16);
  for (let x = 0; x < VIEW_W; x += 22) ellipse(c, x + 11, OY - 14, 14, 9, '#5da347');
  c.fillStyle = '#8a8f98'; c.fillRect(X(COLS), OY - 2, VIEW_W - X(COLS), ROWS * TH + 16);
  c.fillStyle = '#9ba1ab'; for (let y = OY; y < OY + ROWS * TH; y += 40) c.fillRect(X(COLS) + 26, y + 10, 6, 20);
  // The lawn: striped, with rows not in play left as bare earth.
  for (let r = 0; r < ROWS; r++) for (let col = 0; col < COLS; col++) {
    const play = g.lane(r);
    c.fillStyle = play ? ((r + col) % 2 ? '#7cc860' : '#6fbd54') : ((r + col) % 2 ? '#a88a5e' : '#9c8055');
    c.fillRect(X(col), Y(r), TW, TH);
    if (play) for (let i = 0; i < 3; i++) { const gx = X(col) + 10 + hash(r * 9 + col * 3 + i) * (TW - 20), gy = Y(r) + 14 + hash(col * 7 + r + i * 5) * (TH - 24); c.strokeStyle = 'rgba(40, 110, 40, 0.35)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(gx, gy); c.lineTo(gx - 2, gy - 6); c.moveTo(gx, gy); c.lineTo(gx + 2, gy - 5); c.stroke(); }
  }
  // Dora and Enzo's burrow: a grassy mound with a round door and a porch.
  c.fillStyle = '#6a4a30'; c.fillRect(0, OY - 2, OX - 40, ROWS * TH + 16);
  c.fillStyle = '#5a8f40'; c.beginPath(); c.moveTo(0, OY - 2); c.quadraticCurveTo(OX - 30, OY + 40, OX - 40, OY + ROWS * TH + 14); c.lineTo(0, OY + ROWS * TH + 14); c.closePath(); c.fill();
  c.fillStyle = '#7ab85a'; c.beginPath(); c.moveTo(0, OY + 10); c.quadraticCurveTo(OX - 60, OY + 60, OX - 54, OY + ROWS * TH); c.lineTo(0, OY + ROWS * TH); c.closePath(); c.fill();
  const dy = OY + ROWS * TH * 0.5;
  ellipse(c, 38, dy, 30, 42, '#3a2616'); ellipse(c, 38, dy, 24, 36, '#20140c');
  c.fillStyle = '#e8b04a'; ellipse(c, 56, dy + 4, 3, 3, '#e8b04a');
  const scared = g.carts.some((k) => k === 'rolling');
  drawChinchilla(c, COATS.dora, 20, dy + 58, { face: 1, h: 30, time, dizzy: scared });
  drawChinchilla(c, COATS.enzo, 52, dy - 40, { face: 1, h: 32, time: time + 2, dizzy: scared });
}

function cart(c: CanvasRenderingContext2D, x: number, y: number, t: number, rolling: boolean) {
  const spin = rolling ? t * 12 : 0;
  ellipse(c, x + 2, y + 18, 26, 6, 'rgba(0, 0, 0, 0.2)');
  c.fillStyle = '#9c6a3a'; c.strokeStyle = '#5a3a1c'; c.lineWidth = 1.5;
  c.beginPath(); c.moveTo(x - 24, y - 8); c.lineTo(x + 24, y - 8); c.lineTo(x + 18, y + 10); c.lineTo(x - 18, y + 10); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = '#f2cf6a'; c.beginPath(); c.moveTo(x - 22, y - 8); c.quadraticCurveTo(x, y - 30, x + 22, y - 8); c.fill();
  c.strokeStyle = '#c9982f'; c.lineWidth = 1; for (let i = -14; i <= 14; i += 7) { c.beginPath(); c.moveTo(x + i, y - 9); c.lineTo(x + i + 3, y - 20); c.stroke(); }
  for (const wx of [x - 14, x + 14]) {
    ellipse(c, wx, y + 12, 7, 7, '#4a3a2c');
    c.strokeStyle = '#c8b090'; c.lineWidth = 1.2; c.beginPath(); for (let i = 0; i < 3; i++) { const a = spin + (i * Math.PI) / 3; c.moveTo(wx - Math.cos(a) * 6, y + 12 - Math.sin(a) * 6); c.lineTo(wx + Math.cos(a) * 6, y + 12 + Math.sin(a) * 6); } c.stroke();
  }
  c.strokeStyle = '#5a3a1c'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(x - 24, y - 6); c.lineTo(x - 34, y - 20); c.stroke();
}

// ---------- Defenders ----------

/** A defender with its feet at (x, base), facing right. */
export function defender(c: CanvasRenderingContext2D, kind: DefenderId, x: number, base: number, o: { time: number; flash?: number; bite?: number; armed?: number; hp?: number; maxHp?: number; ghost?: boolean }) {
  const t = o.time, flash = o.flash ?? 0, wobble = o.bite ? Math.sin(t * 40) * 1.5 : 0;
  c.save(); c.translate(wobble, 0);
  if (!o.ghost) ellipse(c, x, base, 26, 6, 'rgba(0, 0, 0, 0.18)');
  if (kind === 'gatherer') {
    // A sunflower behind a kit with a basket of seeds.
    c.strokeStyle = '#4f9a3a'; c.lineWidth = 3; c.beginPath(); c.moveTo(x - 14, base); c.quadraticCurveTo(x - 18, base - 30, x - 14, base - 52); c.stroke();
    const sway = Math.sin(t * 2) * 2;
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2 + t * 0.3; ellipse(c, x - 14 + sway + Math.cos(a) * 11, base - 56 + Math.sin(a) * 11, 6, 3, '#ffd23a', a); }
    ellipse(c, x - 14 + sway, base - 56, 8, 8, '#6b3a1c');
    drawChinchilla(c, KIT, x + 4, base, { face: 1, h: 34, time: t });
    c.fillStyle = '#b8864a'; c.strokeStyle = '#6b4a24'; c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(x + 14, base - 16); c.lineTo(x + 30, base - 16); c.lineTo(x + 27, base - 4); c.lineTo(x + 17, base - 4); c.closePath(); c.fill(); c.stroke();
    for (let i = 0; i < 3; i++) seedShape(c, x + 18 + i * 4, base - 18, 0.6);
    if (flash > 0) { c.globalAlpha = flash / 0.4; ellipse(c, x + 22, base - 30, 14, 14, 'rgba(255, 230, 120, 0.6)'); c.globalAlpha = 1; }
  } else if (kind === 'flicker') {
    drawChinchilla(c, BEIGE, x - 2, base, { face: 1, h: 40, time: t, decorate: slingshot(flash) });
  } else if (kind === 'twins') {
    drawChinchilla(c, KIT2, x - 12, base - 6, { face: 1, h: 30, time: t + 1, decorate: slingshot(flash) });
    drawChinchilla(c, BEIGE, x + 6, base, { face: 1, h: 32, time: t, decorate: slingshot(flash) });
  } else if (kind === 'frost') {
    c.globalAlpha = 0.5;
    for (let i = 0; i < 4; i++) { const a = t * 2 + i * 1.6; ellipse(c, x + Math.cos(a) * 18, base - 20 + Math.sin(a) * 6, 3, 3, '#dff4ff'); }
    c.globalAlpha = 1;
    drawChinchilla(c, COATS.dora, x - 2, base, { face: 1, h: 42, time: t, decorate: fan(flash) });
  } else if (kind === 'pebble') {
    // Grandpa Pebble sitting firm, looking the worse for wear as he's chewed.
    const frac = (o.hp ?? 1) / (o.maxHp ?? 1);
    drawChinchilla(c, PEBBLE, x, base, { face: 1, h: 58, time: t, blink: frac < 0.34, decorate: grandpa(frac) });
  } else if (kind === 'trap') {
    const ready = (o.armed ?? 0) <= 0;
    ellipse(c, x, base - 6, 26, 9, '#8a6a44'); ellipse(c, x, base - 8, 22, 7, '#e8d8b0');
    if (ready) { const tw = 0.5 + 0.5 * Math.sin(t * 6); c.fillStyle = `rgba(255, 255, 255, ${0.5 + tw * 0.5})`; for (let i = 0; i < 3; i++) { const sx = x - 12 + i * 12, sy = base - 16 - (i % 2) * 5; c.beginPath(); c.moveTo(sx, sy - 4); c.lineTo(sx + 1.4, sy); c.lineTo(sx, sy + 4); c.lineTo(sx - 1.4, sy); c.fill(); } }
    else { c.fillStyle = 'rgba(80, 60, 40, 0.8)'; c.font = 'bold 11px Arial'; c.textAlign = 'center'; c.fillText(`${Math.ceil(o.armed ?? 0)}`, x, base - 20); }
  } else {
    // Enzo holds a boulder over his head, about to drop it.
    drawChinchilla(c, COATS.enzo, x - 4, base, { face: 1, h: 42, time: t });
    const lift = 8 + Math.sin(t * 20) * 2;
    ellipse(c, x + 6, base - 52 - lift, 18, 16, '#8f8778'); ellipse(c, x + 1, base - 58 - lift, 6, 4, '#b8b0a0');
    c.strokeStyle = '#5e5a58'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(x - 2, base - 50 - lift); c.lineTo(x + 8, base - 44 - lift); c.stroke();
  }
  c.restore();
}

const slingshot = (flash: number) => (d: CanvasRenderingContext2D, bob: number) => {
  d.strokeStyle = '#6b4424'; d.lineWidth = 1.4; d.beginPath();
  d.moveTo(12, -4 + bob); d.lineTo(14, -9 + bob); d.lineTo(12.5, -12 + bob); d.moveTo(14, -9 + bob); d.lineTo(16, -12 + bob); d.stroke();
  if (flash > 0.05) { d.fillStyle = '#8fbf4a'; d.beginPath(); d.arc(18, -11 + bob, 1.6, 0, Math.PI * 2); d.fill(); }
};
const fan = (flash: number) => (d: CanvasRenderingContext2D, bob: number) => {
  const open = flash > 0 ? 1 : 0.6;
  d.save(); d.translate(13, -9 + bob); d.rotate(flash > 0 ? -0.6 : 0.2);
  d.fillStyle = '#bfe6ff'; d.strokeStyle = '#4a7aa4'; d.lineWidth = 0.6;
  d.beginPath(); d.moveTo(0, 0); d.arc(0, 0, 7, -Math.PI / 2 - open, -Math.PI / 2 + open); d.closePath(); d.fill(); d.stroke();
  d.restore();
};
const grandpa = (frac: number) => (d: CanvasRenderingContext2D, bob: number) => {
  d.fillStyle = '#ffffff'; ellipse(d, 9, -16 + bob, 2.6, 1, '#ffffff');
  d.strokeStyle = '#3a3040'; d.lineWidth = 0.6; d.beginPath(); d.arc(10, -13.5 + bob, 1.8, 0, Math.PI * 2); d.stroke();
  if (frac < 0.67) { d.fillStyle = '#f4e8d0'; d.fillRect(-4, -14 + bob, 6, 2); d.fillRect(-2, -16 + bob, 2, 6); }
  if (frac < 0.34) { d.strokeStyle = '#a4506e'; d.lineWidth = 0.8; d.beginPath(); d.moveTo(4, -6 + bob); d.lineTo(8, -4 + bob); d.stroke(); }
};

function seedShape(c: CanvasRenderingContext2D, x: number, y: number, k = 1) {
  c.save(); c.translate(x, y); c.scale(k, k); c.rotate(-0.4);
  c.fillStyle = '#2a2420'; c.beginPath(); c.ellipse(0, 0, 4, 8, 0, 0, Math.PI * 2); c.fill();
  c.strokeStyle = '#f4f0e6'; c.lineWidth = 1.2; for (const sx of [-1.6, 1.6]) { c.beginPath(); c.moveTo(sx, -6); c.lineTo(sx, 6); c.stroke(); }
  c.restore();
}

// ---------- Zombies ----------

/** A zombie with its feet at (x, base), facing left. */
export function zombie(c: CanvasRenderingContext2D, kind: ZombieId, x: number, base: number, o: { step: number; eating?: boolean; armor?: number; maxArmor?: number; chilled?: boolean; hit?: number; jump?: number; hp?: number; maxHp?: number }) {
  const big = kind === 'brute' ? 1.45 : 1, step = o.step, sway = Math.sin(step) * 3, eat = o.eating ? Math.sin(step * 3 + performanceTime()) * 3 : 0;
  const skin = o.chilled ? '#9fd4e0' : '#9cc47a', skinDark = o.chilled ? '#6aa0b0' : '#6f9a50';
  const lift = o.jump && o.jump > 0 ? Math.sin((1 - o.jump / 0.7) * Math.PI) * 40 : 0;
  c.save(); c.translate(x, base - lift); c.scale(big, big);
  ellipse(c, 0, lift / big, 22, 6, 'rgba(0, 0, 0, 0.2)');
  if (o.hit && o.hit > 0) c.filter = 'brightness(1.5)';

  // Legs, shuffling.
  c.strokeStyle = '#4a3a2c'; c.lineWidth = 7; c.lineCap = 'round';
  c.beginPath(); c.moveTo(-2, -30); c.lineTo(-6 + sway, -2); c.moveTo(6, -30); c.lineTo(8 - sway, -2); c.stroke();
  ellipse(c, -9 + sway, -1, 7, 3.5, '#3a2c20'); ellipse(c, 5 - sway, -1, 7, 3.5, '#3a2c20');
  // Torn jacket, shirt and tie.
  c.fillStyle = '#7a5a3a'; c.strokeStyle = '#3a2a1a'; c.lineWidth = 1.5;
  c.beginPath(); c.moveTo(-12, -62); c.lineTo(14, -62); c.lineTo(16, -28); c.lineTo(10, -24); c.lineTo(4, -29); c.lineTo(-2, -24); c.lineTo(-14, -28); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = '#e8e0d0'; c.beginPath(); c.moveTo(-4, -62); c.lineTo(6, -62); c.lineTo(3, -34); c.lineTo(-2, -34); c.closePath(); c.fill();
  c.fillStyle = '#b8302a'; c.beginPath(); c.moveTo(0, -60); c.lineTo(3, -52); c.lineTo(1, -40); c.lineTo(-2, -52); c.closePath(); c.fill();
  // Arms stretched out in front (to the left), bobbing while eating.
  c.strokeStyle = '#7a5a3a'; c.lineWidth = 7;
  c.beginPath(); c.moveTo(-8, -56); c.lineTo(-30, -52 + eat); c.moveTo(4, -54); c.lineTo(-24, -46 - eat); c.stroke();
  ellipse(c, -33, -52 + eat, 5, 4, skin); ellipse(c, -27, -46 - eat, 5, 4, skin);
  // Head.
  const hy = -76 + (o.eating ? eat * 0.6 : 0);
  ellipse(c, -2, hy, 15, 16, skin); c.strokeStyle = skinDark; c.lineWidth = 1.5; c.stroke();
  ellipse(c, -9, hy - 3, 5.5, 6, '#ffffff'); ellipse(c, 2, hy - 2, 4, 4.5, '#ffffff');
  ellipse(c, -10, hy - 2, 2, 2.2, '#1a1a1a'); ellipse(c, 1, hy - 1, 1.6, 1.8, '#1a1a1a');
  c.strokeStyle = '#3a2a2a'; c.lineWidth = 2; c.beginPath(); c.moveTo(-12, hy + 8); c.quadraticCurveTo(-4, hy + (o.eating ? 13 : 10), 4, hy + 8); c.stroke();
  c.fillStyle = '#f4f0e0'; c.fillRect(-7, hy + 8, 3, 3);
  c.strokeStyle = skinDark; c.lineWidth = 1; c.beginPath(); c.moveTo(6, hy - 12); c.lineTo(10, hy - 6); c.stroke();
  // What's on its head, while it lasts.
  const worn = (o.armor ?? 0) > 0, dented = worn && (o.armor ?? 0) < (o.maxArmor ?? 1) * 0.5;
  if (kind === 'cone' && worn) {
    c.fillStyle = '#ff8a2a'; c.strokeStyle = '#b8561a'; c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(-14, hy - 10); c.lineTo(10, hy - 10); c.lineTo(dented ? -4 : -2, hy - 40); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#ffffff'; c.fillRect(-9, hy - 22, 13, 3);
  } else if (kind === 'bucket' && worn) {
    c.fillStyle = '#a8adb6'; c.strokeStyle = '#5e626a'; c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(-16, hy - 6); c.lineTo(12, hy - 6); c.lineTo(9, hy - 28); c.lineTo(-13, hy - 28); c.closePath(); c.fill(); c.stroke();
    if (dented) { c.strokeStyle = '#6e737c'; c.beginPath(); c.moveTo(-6, hy - 22); c.lineTo(-2, hy - 16); c.lineTo(2, hy - 22); c.stroke(); }
  } else if (kind === 'flag') {
    c.strokeStyle = '#6b4424'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(12, -58); c.lineTo(12, -112); c.stroke();
    const wave = Math.sin(step * 2) * 3;
    c.fillStyle = '#c0392b'; c.beginPath(); c.moveTo(12, -112); c.quadraticCurveTo(26, -108 + wave, 38, -110); c.lineTo(38, -90); c.quadraticCurveTo(26, -88 + wave, 12, -92); c.fill();
    ellipse(c, 25, -100, 4, 4, '#f4e8d0'); ellipse(c, 22, -95, 1.4, 1.4, '#c0392b'); ellipse(c, 28, -95, 1.4, 1.4, '#c0392b');
  } else if (kind === 'brute') {
    c.fillStyle = '#6b4424'; c.strokeStyle = '#3a2410'; c.lineWidth = 1.5;
    c.save(); c.translate(-30, -52 + eat); c.rotate(-0.6 + (o.eating ? Math.sin(step * 4) * 0.6 : 0));
    c.beginPath(); c.roundRect(-5, -44, 10, 48, 4); c.fill(); c.stroke(); c.restore();
  }
  if (kind === 'pogo') {
    // The pogo stick, held out in front, with a spring at the bottom.
    c.strokeStyle = '#3a3a44'; c.lineWidth = 3.5; c.beginPath(); c.moveTo(-20, -2); c.lineTo(-20, -62); c.moveTo(-30, -50); c.lineTo(-10, -50); c.stroke();
    c.strokeStyle = '#c0392b'; c.lineWidth = 2; c.beginPath(); for (let i = 0; i < 4; i++) { c.moveTo(-24, -4 - i * 4); c.lineTo(-16, -6 - i * 4); } c.stroke();
    ellipse(c, -20, 0, 6, 2.5, '#2a2a30');
  }
  c.filter = 'none';
  c.restore();
  if ((o.hp ?? 1) < (o.maxHp ?? 1) || (o.armor ?? 0) < (o.maxArmor ?? 0)) {
    const w = 34 * big, total = (o.hp ?? 0) + (o.armor ?? 0), max = (o.maxHp ?? 1) + (o.maxArmor ?? 0), by = base - lift - 104 * big;
    c.fillStyle = 'rgba(20, 16, 28, 0.7)'; c.fillRect(x - w / 2 - 1, by - 1, w + 2, 6);
    c.fillStyle = '#e04a3a'; c.fillRect(x - w / 2, by, w * Math.max(0, total / max), 4);
  }
}
/** Zombie chewing animates off the wall clock so paused frames still look alive. */
const performanceTime = () => (typeof performance === 'undefined' ? 0 : performance.now() / 90);

// ---------- Effects ----------

function effect(c: CanvasRenderingContext2D, e: Effect) {
  const p = e.t / e.max, x = X(e.x), y = Y(e.y), r = e.r * TW;
  if (e.kind === 'boom') {
    c.globalAlpha = 1 - p;
    ellipse(c, x, y, r * (0.4 + p * 0.7), r * 0.6 * (0.4 + p * 0.7), 'rgba(200, 170, 130, 0.6)');
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; ellipse(c, x + Math.cos(a) * r * p, y + Math.sin(a) * r * p * 0.6, 8 * (1 - p) + 2, 6 * (1 - p) + 2, '#8f8778'); }
    c.globalAlpha = 1;
  } else if (e.kind === 'dust') {
    c.globalAlpha = 0.8 * (1 - p);
    for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; ellipse(c, x + Math.cos(a) * r * p, y - 20 + Math.sin(a) * r * p * 0.5, 16 * (1 - p * 0.3), 11, '#efe3cf'); }
    c.globalAlpha = 1;
  } else if (e.kind === 'splat') {
    c.globalAlpha = 1 - p;
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + e.x; ellipse(c, x + Math.cos(a) * 16 * p, y + 10 + Math.sin(a) * 8 * p, 6, 4, '#8fbf4a'); }
    c.globalAlpha = 1;
  } else if (e.kind === 'hit' || e.kind === 'chill') {
    c.strokeStyle = e.kind === 'chill' ? `rgba(190, 235, 255, ${1 - p})` : `rgba(255, 246, 192, ${1 - p})`; c.lineWidth = 2;
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; c.beginPath(); c.moveTo(x + Math.cos(a) * 3, y + Math.sin(a) * 3); c.lineTo(x + Math.cos(a) * 9, y + Math.sin(a) * 9); c.stroke(); }
  } else if (e.kind === 'smash') {
    c.strokeStyle = `rgba(90, 60, 30, ${1 - p})`; c.lineWidth = 3; c.beginPath(); c.ellipse(x, y + 10, r * p, r * p * 0.3, 0, 0, Math.PI * 2); c.stroke();
  } else {
    c.font = 'bold 15px Arial'; c.textAlign = 'center';
    c.lineWidth = 3; c.strokeStyle = `rgba(80, 50, 0, ${1 - p})`; c.strokeText(`+${e.value}`, x, y - 20 - p * 26);
    c.fillStyle = `rgba(255, 220, 90, ${1 - p})`; c.fillText(`+${e.value}`, x, y - 20 - p * 26);
  }
}

// ---------- The whole scene ----------

export type Ghost = { kind: DefenderId | 'shovel'; row: number; col: number; ok: boolean } | null;

export function drawLawn(c: CanvasRenderingContext2D, g: Game, time: number, ghost: Ghost) {
  yard(c, g, time);
  for (let r = 0; r < ROWS; r++) if (g.lane(r) && g.carts[r] !== 'used') cart(c, X(g.cartX[r]) - 4, Y(r) + TH * 0.62, time, g.carts[r] === 'rolling');
  if (ghost) {
    c.fillStyle = ghost.ok ? 'rgba(255, 255, 255, 0.3)' : 'rgba(230, 50, 60, 0.3)';
    c.fillRect(X(ghost.col), Y(ghost.row), TW, TH);
  }
  // Row by row: defenders, then zombies, so the lower rows overlap the upper ones.
  for (let r = 0; r < ROWS; r++) {
    for (const d of g.defenders) if (d.row === r) drawDefender(c, d, time);
    if (ghost && ghost.row === r && ghost.kind !== 'shovel' && ghost.ok) { c.globalAlpha = 0.55; defender(c, ghost.kind, X(ghost.col) + TW / 2, Y(r) + TH - 14, { time, ghost: true }); c.globalAlpha = 1; }
    for (const z of [...g.zombies].filter((q) => q.row === r).sort((a, b) => b.x - a.x)) drawZombie(c, z);
    for (const p of g.pellets) if (p.row === r) { const px = X(p.x), py = Y(r) + TH - 50; ellipse(c, px, py + 22, 6, 2, 'rgba(0, 0, 0, 0.15)'); ellipse(c, px, py, 6, 6, p.slow ? '#bfe6ff' : '#8fbf4a'); ellipse(c, px - 2, py - 2, 2, 2, 'rgba(255, 255, 255, 0.6)'); }
  }
  for (const e of g.effects) effect(c, e);
  // Seed pouches to click, glowing and bobbing.
  for (const s of g.drops) {
    const { x, y } = seedPx(s), bob = Math.sin(time * 3 + s.id) * 3, fade = s.life < 3 ? 0.4 + 0.6 * Math.abs(Math.sin(time * 8)) : 1;
    c.globalAlpha = fade;
    const glow = c.createRadialGradient(x, y + bob, 2, x, y + bob, 26);
    glow.addColorStop(0, 'rgba(255, 230, 120, 0.9)'); glow.addColorStop(1, 'rgba(255, 230, 120, 0)');
    c.fillStyle = glow; c.fillRect(x - 26, y + bob - 26, 52, 52);
    ellipse(c, x, y + bob, 15, 15, '#ffd23a'); c.strokeStyle = '#c98a1a'; c.lineWidth = 1.5; c.stroke();
    seedShape(c, x - 4, y + bob, 0.9); seedShape(c, x + 5, y + bob + 1, 0.8);
    c.globalAlpha = 1;
  }
  if (ghost?.kind === 'shovel') {
    const x = X(ghost.col) + TW / 2, y = Y(ghost.row) + TH / 2;
    c.strokeStyle = ghost.ok ? '#ffffff' : '#ff6070'; c.lineWidth = 3; c.strokeRect(X(ghost.col) + 3, Y(ghost.row) + 3, TW - 6, TH - 6);
    c.strokeStyle = '#7a5230'; c.lineWidth = 4; c.beginPath(); c.moveTo(x - 16, y - 20); c.lineTo(x + 6, y + 4); c.stroke();
    c.fillStyle = '#b8bcc6'; c.beginPath(); c.moveTo(x + 2, y); c.lineTo(x + 18, y + 6); c.lineTo(x + 12, y + 18); c.closePath(); c.fill();
  }
  if (g.messageTime > 0 && g.state === 'playing') {
    c.font = '900 34px ui-sans-serif, system-ui, sans-serif'; c.textAlign = 'center';
    c.lineWidth = 6; c.strokeStyle = 'rgba(60, 20, 10, 0.8)'; c.strokeText(g.message, VIEW_W / 2, OY + ROWS * TH * 0.45);
    c.fillStyle = '#ffdc5a'; c.fillText(g.message, VIEW_W / 2, OY + ROWS * TH * 0.45);
  }
}

function drawDefender(c: CanvasRenderingContext2D, d: Defender, time: number) {
  defender(c, d.kind, X(d.col) + TW / 2, Y(d.row) + TH - 14, { time: time + d.id, flash: d.flash, bite: d.bite, armed: d.armed, hp: d.hp, maxHp: d.maxHp });
  if (d.hp < d.maxHp && DEFENDERS[d.kind].kind !== 'bomb') {
    const w = 40, x = X(d.col) + TW / 2 - w / 2, y = Y(d.row) + 6;
    c.fillStyle = 'rgba(20, 16, 28, 0.6)'; c.fillRect(x - 1, y - 1, w + 2, 5);
    c.fillStyle = '#6fd06f'; c.fillRect(x, y, w * Math.max(0, d.hp / d.maxHp), 3);
  }
}
function drawZombie(c: CanvasRenderingContext2D, z: Zombie) {
  zombie(c, z.kind, X(z.x), Y(z.row) + TH - 10, { step: z.step, eating: z.eating !== null, armor: z.armor, maxArmor: z.maxArmor, chilled: z.slowT > 0, hit: z.hit, jump: z.jump, hp: z.hp, maxHp: z.maxHp });
}

// ---------- Icons ----------

export function drawDefenderIcon(c: CanvasRenderingContext2D, kind: DefenderId, w: number, h: number, time = 0) {
  c.clearRect(0, 0, w, h);
  const k = Math.min(w / 70, h / 80);
  c.save(); c.translate(w / 2, h - 6); c.scale(k, k);
  defender(c, kind, 0, 0, { time, armed: 0, ghost: true });
  c.restore();
}
export function drawShovelIcon(c: CanvasRenderingContext2D, w: number, h: number) {
  c.clearRect(0, 0, w, h);
  const x = w / 2, y = h / 2;
  c.strokeStyle = '#7a5230'; c.lineWidth = 4; c.lineCap = 'round'; c.beginPath(); c.moveTo(x - 12, y - 14); c.lineTo(x + 3, y + 2); c.stroke();
  c.strokeStyle = '#5a3a1c'; c.lineWidth = 3; c.beginPath(); c.moveTo(x - 16, y - 12); c.lineTo(x - 9, y - 18); c.stroke();
  c.fillStyle = '#b8bcc6'; c.strokeStyle = '#6e737c'; c.lineWidth = 1;
  c.beginPath(); c.moveTo(x, y - 1); c.lineTo(x + 12, y + 4); c.lineTo(x + 9, y + 15); c.lineTo(x - 2, y + 10); c.closePath(); c.fill(); c.stroke();
}
export function drawZombieIcon(c: CanvasRenderingContext2D, kind: ZombieId, w: number, h: number) {
  c.clearRect(0, 0, w, h);
  const k = Math.min(w / 70, h / 120) * (kind === 'brute' ? 0.7 : 1);
  c.save(); c.translate(w / 2 + 6, h - 4); c.scale(k, k);
  zombie(c, kind, 0, 0, { step: 1, armor: ZOMBIES[kind].armor, maxArmor: ZOMBIES[kind].armor });
  c.restore();
}
