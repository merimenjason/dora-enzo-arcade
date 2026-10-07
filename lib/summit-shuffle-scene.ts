// Canvas 2D drawing for Summit Shuffle: the fight (a chinchilla on the left, the predators on the right, their
// intents, health and statuses), the little picture on every card, and the portraits. Chinchillas are the shared
// drawChinchilla and predators the shared predator art, so everyone looks as they do in the rest of the arcade.
//
// The engine resolves a card or a whole predator turn at once and hands back a list of events. The Stage keeps its own
// picture of everyone's health and Fluff and plays those events one after another, so what is drawn lags the engine
// until the queue is empty. It draws to whatever size the canvas is, in CSS pixels, so a phone gets full-size text.
import { CARDS, FOES, STATUS, TIMED, type Run, type Ev, type Art, type CardType, type Look, type HeroId, type StatusId, type Statuses, type Intent } from './summit-shuffle-game';
import { COATS, coatLike, drawChinchilla } from './chinchilla-art';
import { predator, critter, type PredKind, type CritterKind } from './predator-art';
import { fitDraw } from './art-fit';

type C2D = CanvasRenderingContext2D;
const INK = '#2c2430';
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const hash = (n: number) => { const s = Math.sin(n * 127.1 + 11.7) * 43758.5453; return s - Math.floor(s); };
const ell = (c: C2D, x: number, y: number, rx: number, ry: number, rot = 0) => { c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2); };
const poly = (c: C2D, pts: number[]) => { c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.closePath(); };
const ink = (c: C2D, fill: string | CanvasGradient, line = INK, w = 1.3) => { c.lineJoin = 'round'; c.strokeStyle = line; c.lineWidth = w; c.stroke(); c.fillStyle = fill; c.fill(); };
const pill = (c: C2D, x: number, y: number, w: number, h: number, r = h / 2) => { c.beginPath(); c.roundRect(x, y, w, h, r); };

// ---------- Creatures ----------
/** A predator with its feet at (x, y), `px` tall, facing left towards the chinchilla. */
function drawFoe(c: C2D, look: Look, x: number, y: number, px: number, t: number, face: 1 | -1 = -1) {
  if (look.shape === 'chin') {
    // The vizcacha is a cousin: a chinchilla's shape in a sandy coat, with a bandit's mask.
    const coat = coatLike('enzo', { fur: look.body, back: look.dark, face: look.light, shade: look.dark, belly: look.light, tail: look.body, tailOuter: look.dark, tailInner: look.light, ear: look.body, bands: false, paleLegs: false });
    drawChinchilla(c, coat, x, y, { face, h: px, time: t, decorate: (k, bob) => { k.fillStyle = '#2a2230'; k.beginPath(); k.roundRect(4.6, -15.4 + bob, 8.2, 3, 1.4); k.fill(); k.fillStyle = '#fff'; k.beginPath(); k.arc(9.6, -13.9 + bob, 0.9, 0, 7); k.fill(); } });
    return;
  }
  c.save(); c.translate(x, y); c.scale((face * px) / 24, px / 24); c.lineJoin = 'round';
  const tint = { body: look.body, dark: look.dark, light: look.light, eye: look.eye };
  if (look.shape === 'beetle' || look.shape === 'armadillo' || look.shape === 'lizard') critter(c, look.shape as CritterKind, tint, t);
  else predator(c, look.shape as PredKind, tint, t);
  c.restore();
}
/** How wide a creature is for its height, roughly, to lay a line of them out. */
const WIDE: Record<Look['shape'], number> = { fox: 1.5, snake: 1.1, owl: 1.0, weasel: 1.5, hawk: 1.3, cougar: 1.5, skunk: 1.3, beetle: 1.2, armadillo: 1.5, lizard: 1.6, chin: 1.0 };
/** How much of its frame's height each shape's art actually fills, to put its intent just above its head. */
const TALL: Record<Look['shape'], number> = { fox: 1.04, snake: 0.86, owl: 1.04, weasel: 0.78, hawk: 1, cougar: 1, skunk: 1.15, beetle: 0.82, armadillo: 0.78, lizard: 0.5, chin: 1 };

export function drawHeroIcon(c: C2D, hero: HeroId, w: number, h: number) {
  c.clearRect(0, 0, w, h);
  // The tail curls well out behind, so the animal is measured and fitted, not placed by eye.
  fitDraw(c, `chin-${hero}`, w * 0.05, h * 0.08, w * 0.9, h * 0.86, (q) => drawChinchilla(q, COATS[hero], 0, 0, { face: 1, h: 40, time: 0.4 }));
}
export function drawFoeIcon(c: C2D, kind: string, w: number, h: number) {
  c.clearRect(0, 0, w, h);
  const look = FOES[kind].look, px = Math.min(h * 0.9, (w * 0.92) / WIDE[look.shape]);
  drawFoe(c, look, w * (look.shape === 'owl' || look.shape === 'chin' ? 0.5 : 0.46), h * (look.fly ? 1 : 0.94), px, 0.6, 1);
}

// ---------- Card pictures ----------
const CARD_BG: Record<CardType, [string, string, string]> = {
  attack: ['#ffb38a', '#e8603c', '#7a2416'], skill: ['#9fe0d8', '#3c9bb0', '#16465a'], power: ['#d9b8ff', '#8a5cd8', '#3a1f6e'],
  status: ['#c9c4d2', '#7f7890', '#3a3546'], curse: ['#7d6a8f', '#3d2f52', '#170f24'],
};
/** The picture in a card's window, drawn in a 100 by 60 frame. */
export function drawCardArt(c: C2D, art: Art, type: CardType, w: number, h: number) {
  const [hi, mid, lo] = CARD_BG[type];
  c.save(); c.clearRect(0, 0, w, h); c.scale(w / 100, h / 60); c.lineJoin = 'round'; c.lineCap = 'round';
  const bg = c.createRadialGradient(50, 24, 3, 50, 30, 72); bg.addColorStop(0, hi); bg.addColorStop(0.55, mid); bg.addColorStop(1, lo);
  c.fillStyle = bg; c.fillRect(0, 0, 100, 60);
  // Rays fanning out from behind the picture, a soft pool of light, and a few motes.
  c.fillStyle = 'rgba(255,255,255,0.09)'; for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2 + art.length * 0.37; poly(c, [50, 30, 50 + Math.cos(a) * 90, 30 + Math.sin(a) * 90, 50 + Math.cos(a + 0.2) * 90, 30 + Math.sin(a + 0.2) * 90]); c.fill(); }
  const pool = c.createRadialGradient(50, 28, 2, 50, 28, 34); pool.addColorStop(0, 'rgba(255,255,255,0.4)'); pool.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = pool; c.fillRect(0, 0, 100, 60);
  c.fillStyle = 'rgba(20,10,30,0.2)'; ell(c, 50, 54, 30, 4); c.fill();
  c.fillStyle = 'rgba(255,255,255,0.3)'; for (let i = 0; i < 11; i++) { const r = 0.6 + hash(i * 2.3 + art.length) * 1; ell(c, hash(i + art.length * 7) * 100, hash(i * 3 + 1) * 60, r, r); c.fill(); }
  // Everything in the picture stands a little off the background.
  c.shadowColor = 'rgba(30,12,36,0.4)'; c.shadowBlur = w * 0.02; c.shadowOffsetY = h * 0.022;
  const white = '#fffaf0', line = (pts: number[], color: string, lw: number) => { c.strokeStyle = color; c.lineWidth = lw; c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.stroke(); };
  const speed = (x: number, y: number) => { for (let i = 0; i < 3; i++) line([x - 16 - i * 3, y - 8 + i * 8, x - 4, y - 8 + i * 8], 'rgba(255,255,255,0.7)', 2); };
  if (art === 'bite') {
    c.beginPath(); c.moveTo(22, 14); c.quadraticCurveTo(50, 2, 78, 14); c.lineTo(78, 20); c.lineTo(22, 20); c.closePath(); ink(c, '#b23a3a', INK, 1.6);
    c.beginPath(); c.moveTo(22, 46); c.quadraticCurveTo(50, 58, 78, 46); c.lineTo(78, 40); c.lineTo(22, 40); c.closePath(); ink(c, '#b23a3a', INK, 1.6);
    for (let i = 0; i < 5; i++) { poly(c, [26 + i * 10.5, 20, 31 + i * 10.5, 31, 36 + i * 10.5, 20]); ink(c, white, INK, 1.2); poly(c, [31 + i * 9.5, 40, 35.5 + i * 9.5, 30, 40 + i * 9.5, 40]); ink(c, white, INK, 1.2); }
  } else if (art === 'kick') {
    speed(44, 30);
    ell(c, 56, 32, 17, 8.5, -0.25); ink(c, '#f4c6bd', INK, 1.6);
    for (const [dx, dy] of [[74, 20], [78, 27], [77, 35]]) { ell(c, dx, dy, 4, 3); ink(c, '#f4c6bd', INK, 1.4); }
  } else if (art === 'paw') {
    ell(c, 50, 38, 12, 9.5); ink(c, white, INK, 1.6);
    for (const [dx, dy, r] of [[32, 26, 5], [43, 16, 5.6], [57, 16, 5.6], [68, 26, 5]]) { ell(c, dx, dy, r, r * 1.2); ink(c, white, INK, 1.5); }
  } else if (art === 'tail') {
    c.beginPath(); c.moveTo(18, 48); c.bezierCurveTo(30, 10, 60, 2, 82, 16); c.bezierCurveTo(64, 14, 46, 26, 34, 52); c.closePath(); ink(c, white, INK, 1.7);
    line([30, 40, 44, 22, 62, 14], '#d9cfc0', 1.4); line([60, 30, 72, 34, 84, 30], 'rgba(255,255,255,0.8)', 2); line([62, 40, 74, 44, 86, 40], 'rgba(255,255,255,0.6)', 2);
  } else if (art === 'fluff') {
    for (const [dx, dy, r] of [[34, 36, 12], [50, 26, 15], [66, 36, 12], [42, 40, 11], [58, 41, 11]]) { ell(c, dx, dy, r, r); c.strokeStyle = INK; c.lineWidth = 3.2; c.stroke(); }
    for (const [dx, dy, r] of [[34, 36, 12], [50, 26, 15], [66, 36, 12], [42, 40, 11], [58, 41, 11]]) { ell(c, dx, dy, r, r); c.fillStyle = white; c.fill(); }
    line([40, 30, 46, 24], '#d9cfc0', 1.6); line([56, 34, 63, 30], '#d9cfc0', 1.6);
  } else if (art === 'dust') {
    for (const [dx, dy, r] of [[30, 40, 10], [46, 30, 13], [64, 34, 12], [76, 44, 8], [52, 44, 10]]) { ell(c, dx, dy, r, r * 0.9); ink(c, '#e9dcc0', '#8a7250', 1.4); }
    c.fillStyle = '#fff5dc'; for (let i = 0; i < 8; i++) { ell(c, 20 + hash(i + 3) * 64, 8 + hash(i * 5) * 16, 1.4, 1.4); c.fill(); }
  } else if (art === 'burr') {
    const pts: number[] = []; for (let i = 0; i < 28; i++) { const a = (i / 28) * Math.PI * 2, r = i % 2 ? 11 : 21; pts.push(50 + Math.cos(a) * r, 30 + Math.sin(a) * r); }
    poly(c, pts); ink(c, '#a9783f', INK, 1.5); ell(c, 50, 30, 8, 8); c.fillStyle = '#7a5226'; c.fill(); ell(c, 46, 26, 2.5, 2.5); c.fillStyle = '#d9b070'; c.fill();
  } else if (art === 'hay') {
    c.beginPath(); c.roundRect(26, 16, 48, 32, 5); ink(c, '#ecc558', INK, 1.7);
    for (let i = 0; i < 7; i++) line([31 + i * 6.4, 19, 29 + i * 6.4 + hash(i) * 4, 45], '#c59a2e', 1.1);
    c.fillStyle = '#b5552f'; c.fillRect(26, 28, 48, 5); c.strokeStyle = INK; c.lineWidth = 1.2; c.strokeRect(26, 28, 48, 5);
  } else if (art === 'jump') {
    c.setLineDash([4, 5]); c.strokeStyle = 'rgba(255,255,255,0.85)'; c.lineWidth = 2.2; c.beginPath(); c.moveTo(16, 50); c.quadraticCurveTo(44, -8, 70, 30); c.stroke(); c.setLineDash([]);
    ell(c, 74, 34, 9, 7.5); ink(c, white, INK, 1.6); ell(c, 80, 26, 3.2, 4.4, -0.3); ink(c, '#f7cfbd', INK, 1.2); c.fillStyle = INK; ell(c, 79, 33, 1.1, 1.1); c.fill();
    line([12, 54, 28, 54], 'rgba(255,255,255,0.6)', 2);
  } else if (art === 'bark') {
    poly(c, [22, 22, 40, 26, 40, 36, 22, 40]); ink(c, white, INK, 1.6);
    for (let i = 0; i < 3; i++) { c.strokeStyle = `rgba(255,255,255,${0.95 - i * 0.22})`; c.lineWidth = 3; c.beginPath(); c.arc(40, 31, 12 + i * 10, -0.75, 0.75); c.stroke(); }
  } else if (art === 'raisin') {
    ell(c, 50, 32, 15, 12, 0.3); ink(c, '#5d2f6e', INK, 1.7);
    line([40, 30, 47, 34, 54, 29, 60, 34], '#3a1a48', 1.5); line([42, 38, 50, 40, 58, 38], '#3a1a48', 1.3);
    ell(c, 44, 25, 3.2, 1.8, -0.5); c.fillStyle = 'rgba(255,255,255,0.55)'; c.fill(); line([56, 21, 60, 13], '#6a4a2a', 2);
  } else if (art === 'roll') {
    speed(40, 30);
    ell(c, 56, 30, 17, 17); ink(c, '#b7a892', INK, 1.7);
    c.strokeStyle = INK; c.lineWidth = 1.5; c.beginPath(); for (let a = 0; a < 9; a += 0.2) { const r = 1.5 + a * 1.6; c.lineTo(56 + Math.cos(a) * r, 30 + Math.sin(a) * r); } c.stroke();
  } else if (art === 'nest') {
    ell(c, 50, 40, 27, 11); ink(c, '#a8793f', INK, 1.6);
    for (let i = 0; i < 12; i++) line([26 + i * 4.2, 36 + hash(i) * 8, 30 + i * 4.2, 44 + hash(i + 9) * 4], '#7a5226', 1.1);
    for (const dx of [40, 50, 60]) { ell(c, dx, 31, 6.5, 6.5); ink(c, white, INK, 1.4); }
  } else if (art === 'coat') {
    poly(c, [36, 12, 64, 12, 78, 24, 70, 32, 66, 28, 66, 50, 34, 50, 34, 28, 30, 32, 22, 24]); ink(c, '#f0e6d6', INK, 1.7);
    line([50, 13, 50, 50], '#c9bba6', 1.3); for (const y of [22, 31, 40]) { ell(c, 53.5, y, 1.4, 1.4); c.fillStyle = INK; c.fill(); }
    for (let i = 0; i < 7; i++) { ell(c, 37 + i * 4.4, 12, 3.2, 3.2); c.fillStyle = '#fffaf0'; c.fill(); }
  } else if (art === 'zoom') {
    speed(34, 30);
    poly(c, [56, 6, 38, 33, 50, 33, 44, 54, 68, 24, 55, 24, 64, 6]); ink(c, '#ffe066', INK, 1.7);
  } else if (art === 'rock') {
    for (const [dx, dy, k] of [[34, 34, 1], [60, 24, 1.3], [70, 44, 0.8]]) { poly(c, [dx - 12 * k, dy + 4 * k, dx - 7 * k, dy - 9 * k, dx + 5 * k, dy - 11 * k, dx + 12 * k, dy - 1 * k, dx + 7 * k, dy + 9 * k, dx - 6 * k, dy + 10 * k]); ink(c, '#aeb4c2', INK, 1.5); line([dx - 6 * k, dy - 3 * k, dx + 2 * k, dy - 6 * k], '#e6eaf2', 1.4); }
    line([30, 8, 26, 18], 'rgba(255,255,255,0.7)', 2); line([58, 4, 54, 10], 'rgba(255,255,255,0.7)', 2);
  } else if (art === 'snow') {
    c.beginPath(); c.moveTo(20, 50); c.quadraticCurveTo(50, 0, 80, 50); c.closePath(); ink(c, '#f4fbff', INK, 1.7);
    c.beginPath(); c.moveTo(42, 50); c.quadraticCurveTo(50, 30, 58, 50); c.closePath(); c.fillStyle = '#2a3550'; c.fill();
    line([32, 36, 46, 30], '#cfe3f2', 1.3); line([54, 24, 66, 34], '#cfe3f2', 1.3);
    c.fillStyle = '#fff'; for (let i = 0; i < 7; i++) { ell(c, 12 + hash(i + 2) * 76, 6 + hash(i * 7) * 22, 1.5, 1.5); c.fill(); }
  } else if (art === 'heart') {
    c.beginPath(); c.moveTo(50, 50); c.bezierCurveTo(18, 30, 30, 6, 50, 20); c.bezierCurveTo(70, 6, 82, 30, 50, 50); c.closePath(); ink(c, '#ff7f96', INK, 1.7);
    ell(c, 40, 22, 4, 2.4, -0.6); c.fillStyle = 'rgba(255,255,255,0.7)'; c.fill();
  } else if (art === 'drum') {
    for (const dx of [36, 64]) { ell(c, dx, 40, 11, 5.5); ink(c, '#f4c6bd', INK, 1.5); for (const k of [-6, 0, 6]) { ell(c, dx + k, 33.5, 2.4, 2.2); ink(c, '#f4c6bd', INK, 1.2); } }
    for (const [dx, dy] of [[36, 20], [64, 14], [50, 24]]) { line([dx - 5, dy, dx + 5, dy], 'rgba(255,255,255,0.85)', 2.2); line([dx, dy - 5, dx, dy + 5], 'rgba(255,255,255,0.85)', 2.2); }
    line([18, 50, 82, 50], 'rgba(255,255,255,0.6)', 2);
  } else if (art === 'eye') {
    c.beginPath(); c.moveTo(18, 30); c.quadraticCurveTo(50, 2, 82, 30); c.quadraticCurveTo(50, 58, 18, 30); c.closePath(); ink(c, white, INK, 1.7);
    ell(c, 50, 30, 12, 12); ink(c, '#b32a45', INK, 1.4); ell(c, 50, 30, 5.5, 5.5); c.fillStyle = '#2a0810'; c.fill(); ell(c, 46, 26, 2.6, 2.6); c.fillStyle = '#fff'; c.fill();
  } else if (art === 'mud') {
    c.beginPath(); c.moveTo(22, 40); c.bezierCurveTo(12, 22, 34, 22, 36, 14); c.bezierCurveTo(46, 4, 54, 20, 62, 14); c.bezierCurveTo(78, 12, 74, 28, 82, 34); c.bezierCurveTo(88, 50, 62, 44, 54, 52); c.bezierCurveTo(40, 56, 30, 50, 22, 40); c.closePath(); ink(c, '#7a5a3c', INK, 1.7);
    ell(c, 42, 26, 6, 3); c.fillStyle = '#9a7650'; c.fill(); ell(c, 62, 36, 4, 2.2); c.fill();
  } else if (art === 'thorn') {
    line([14, 44, 40, 34, 62, 30, 86, 18], '#5a3d24', 4.5); line([14, 44, 40, 34, 62, 30, 86, 18], '#8a6238', 2.4);
    for (const [dx, dy, up] of [[28, 39, 1], [42, 33, -1], [56, 31, 1], [70, 26, -1]]) { poly(c, [dx - 4, dy, dx + 1, dy - 13 * up, dx + 5, dy - 1]); ink(c, '#d9c7a2', INK, 1.2); }
  } else if (art === 'daze') {
    c.strokeStyle = white; c.lineWidth = 2.6; c.beginPath(); for (let a = 0; a < 13; a += 0.2) { const r = 2 + a * 1.5; c.lineTo(50 + Math.cos(a) * r, 30 + Math.sin(a) * r * 0.9); } c.stroke();
    for (const [dx, dy] of [[22, 16], [80, 20], [76, 46]]) { c.fillStyle = '#ffe066'; poly(c, [dx, dy - 5, dx + 1.6, dy - 1.6, dx + 5, dy, dx + 1.6, dy + 1.6, dx, dy + 5, dx - 1.6, dy + 1.6, dx - 5, dy, dx - 1.6, dy - 1.6]); c.fill(); }
  } else if (art === 'fright') {
    for (const dx of [38, 62]) { ell(c, dx, 28, 9, 11); ink(c, white, INK, 1.6); ell(c, dx, 30, 3, 3.6); c.fillStyle = INK; c.fill(); }
    line([30, 10, 44, 14], white, 2.4); line([70, 10, 56, 14], white, 2.4);
    c.beginPath(); c.moveTo(40, 48); c.lineTo(45, 44); c.lineTo(50, 48); c.lineTo(55, 44); c.lineTo(60, 48); c.strokeStyle = white; c.lineWidth = 2.4; c.stroke();
  } else if (art === 'burrow') {
    c.beginPath(); c.moveTo(8, 54); c.quadraticCurveTo(50, -6, 92, 54); c.closePath(); ink(c, '#8a6a44', INK, 1.7);
    c.beginPath(); c.moveTo(36, 54); c.quadraticCurveTo(50, 22, 64, 54); c.closePath(); c.fillStyle = '#231728'; c.fill();
    for (const dx of [46, 54]) { ell(c, dx, 44, 1.6, 2); c.fillStyle = '#ffe9b0'; c.fill(); }
    line([20, 46, 26, 38], '#6fae4a', 2); line([78, 46, 73, 38], '#6fae4a', 2);
  } else {
    for (const [dx, dy, rot] of [[38, 36, -0.5], [58, 34, 0.4], [48, 22, 0]]) { c.save(); c.translate(dx, dy); c.rotate(rot); c.beginPath(); c.moveTo(0, -11); c.quadraticCurveTo(9, 0, 0, 11); c.quadraticCurveTo(-9, 0, 0, -11); c.closePath(); ink(c, '#e9d9b0', INK, 1.5); line([0, -8, 0, 8], '#8a7250', 1.1); c.restore(); }
  }
  c.shadowColor = 'transparent';
  const edge = c.createRadialGradient(50, 30, 26, 50, 30, 64); edge.addColorStop(0, 'rgba(20,10,30,0)'); edge.addColorStop(1, 'rgba(20,10,30,0.38)');
  c.fillStyle = edge; c.fillRect(0, 0, 100, 60);
  const shine = c.createLinearGradient(0, 0, 60, 60); shine.addColorStop(0, 'rgba(255,255,255,0.3)'); shine.addColorStop(0.35, 'rgba(255,255,255,0.05)'); shine.addColorStop(0.36, 'rgba(255,255,255,0)');
  c.fillStyle = shine; c.fillRect(0, 0, 100, 60);
  c.restore();
}


// ---------- Scenery ----------
const FONT = "ui-rounded, 'Arial Rounded MT Bold', 'Nunito', ui-sans-serif, system-ui, sans-serif";
const easeOut = (k: number) => 1 - (1 - k) ** 3;
const grad = (c: C2D, y0: number, y1: number, stops: string[]) => { const g = c.createLinearGradient(0, y0, 0, y1); stops.forEach((s, i) => g.addColorStop(stops.length > 1 ? i / (stops.length - 1) : 0, s)); return g; };
/** A soft round glow: the sun, a halo, a pool of light. */
function glow(c: C2D, x: number, y: number, r: number, color: string, alpha = 1) {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color); g.addColorStop(1, 'rgba(255,255,255,0)');
  c.save(); c.globalAlpha = alpha; c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); c.restore();
}
/** A line of jagged peaks standing on `base`, lit from the left: each has a shaded side and, if asked, a snow cap. */
function peaks(c: C2D, w: number, base: number, amp: number, seed: number, n: number, fill: string[], shade: string, snow = '') {
  const tops: [number, number][] = [], dips: [number, number][] = [[-w * 0.05, base - amp * 0.1]];
  for (let i = 0; i < n; i++) {
    tops.push([((i + 0.5 + (hash(seed + i * 3.3) - 0.5) * 0.55) / n) * w, base - amp * (0.5 + hash(seed + i * 7.1) * 0.5)]);
    dips.push([((i + 1 + (hash(seed + i * 5.7) - 0.5) * 0.3) / n) * w, base - amp * (0.08 + hash(seed + i * 2.3) * 0.2)]);
  }
  dips[n] = [w * 1.05, base - amp * 0.1];
  c.beginPath(); c.moveTo(-w * 0.05, base + 2);
  tops.forEach(([x, y], i) => {
    const [lx, ly] = dips[i], [rx, ry] = dips[i + 1];
    c.lineTo(lx, ly); c.lineTo(lx + (x - lx) * 0.55, ly + (y - ly) * 0.62 + amp * 0.03); c.lineTo(x, y); c.lineTo(x + (rx - x) * 0.4, y + (ry - y) * 0.5 - amp * 0.03); c.lineTo(rx, ry);
  });
  c.lineTo(w * 1.05, base + 2); c.closePath();
  c.fillStyle = grad(c, base - amp, base, fill); c.fill();
  tops.forEach(([x, y], i) => {
    const [rx, ry] = dips[i + 1], mx = x + (rx - x) * 0.4, my = y + (ry - y) * 0.5 - amp * 0.03;
    c.fillStyle = shade; poly(c, [x, y, mx, my, rx, ry, rx, base + 2, x + (rx - x) * 0.18, base + 2, x - (rx - x) * 0.06, y + (base - y) * 0.45]); c.fill();
    if (!snow) return;
    const [lx, ly] = dips[i], k = (base - y) * 0.3, ax = x + (lx - x) * 0.34, ay = y + (ly - y) * 0.34 * 0.9, bx = x + (rx - x) * 0.3, by = y + (ry - y) * 0.36;
    c.fillStyle = snow; poly(c, [x, y, bx, by, x + (bx - x) * 0.5, by + k * 0.12, x + (bx - x) * 0.1, by - k * 0.08, x - (x - ax) * 0.3, ay + k * 0.2, x - (x - ax) * 0.7, ay - k * 0.02, ax, ay]); c.fill();
    c.fillStyle = 'rgba(120,150,210,0.28)'; poly(c, [x, y, bx, by, x + (bx - x) * 0.5, by + k * 0.12, x + (bx - x) * 0.1, by - k * 0.08, x - (rx - x) * 0.03, y + k * 0.5]); c.fill();
  });
}
/** Rolling ground: two sines laid over each other, filled down to `floor`. */
function hills(c: C2D, w: number, base: number, amp: number, seed: number, floor: number, fill: string[]) {
  const at = (x: number) => base - amp * (0.5 + 0.32 * Math.sin((x / w) * 5.2 + seed) + 0.18 * Math.sin((x / w) * 12.4 + seed * 2.3));
  c.beginPath(); c.moveTo(0, floor); for (let x = 0; x <= w + 8; x += 8) c.lineTo(x, at(x)); c.lineTo(w, floor); c.closePath();
  c.fillStyle = grad(c, base - amp, floor, fill); c.fill();
  return at;
}
function pine(c: C2D, x: number, y: number, s: number, dark: string, light: string, snow = false) {
  c.fillStyle = '#5a4030'; c.fillRect(x - s * 0.06, y - s * 0.2, s * 0.12, s * 0.2);
  for (let i = 0; i < 3; i++) {
    const by = y - s * (0.14 + i * 0.26), hw = s * (0.34 - i * 0.08), top = by - s * 0.42;
    c.fillStyle = dark; poly(c, [x - hw, by, x, top, x + hw, by]); c.fill();
    c.fillStyle = light; poly(c, [x - hw, by, x, top, x - hw * 0.1, by]); c.fill();
    if (snow) { c.fillStyle = 'rgba(255,255,255,0.92)'; poly(c, [x - hw * 0.55, by - s * 0.2, x, top, x + hw * 0.55, by - s * 0.2, x + hw * 0.2, by - s * 0.14, x, by - s * 0.2, x - hw * 0.25, by - s * 0.13]); c.fill(); }
  }
}
function cloud(c: C2D, x: number, y: number, s: number, light: string, dark: string, alpha: number) {
  c.save(); c.globalAlpha = alpha;
  c.fillStyle = dark; for (const [dx, dy, r] of [[-1.5, 0.12, 0.8], [-0.5, -0.2, 1.05], [0.6, -0.05, 0.95], [1.5, 0.15, 0.7]]) { ell(c, x + dx * s, y + dy * s + s * 0.16, r * s, r * s * 0.7); c.fill(); }
  c.fillStyle = light; for (const [dx, dy, r] of [[-1.5, 0.12, 0.8], [-0.5, -0.2, 1.05], [0.6, -0.05, 0.95], [1.5, 0.15, 0.7]]) { ell(c, x + dx * s, y + dy * s, r * s, r * s * 0.66); c.fill(); }
  c.restore();
}
const THEMES = [
  { cloud: ['#ffffff', '#cfe4f4'], mote: 'rgba(255,250,200,0.9)', shadow: 'rgba(30,60,30,0.3)' },
  { cloud: ['#ffe9c8', '#f2b48c'], mote: 'rgba(255,225,170,0.75)', shadow: 'rgba(70,35,25,0.32)' },
  { cloud: ['#f4f8ff', '#b9cbe8'], mote: 'rgba(255,255,255,0.95)', shadow: 'rgba(50,70,120,0.3)' },
];
/** Everything in a stretch's backdrop that never moves, painted once for a canvas `w` by `h` with the ground at `ground`. */
function paintScenery(c: C2D, w: number, h: number, ground: number, act: number) {
  const u = h / 100, deep = h - ground;
  if (act === 0) {
    c.fillStyle = grad(c, 0, ground, ['#4faee8', '#8fd2f5', '#d5f0f6', '#fff3cf']); c.fillRect(0, 0, w, ground + 2);
    glow(c, w * 0.8, h * 0.17, u * 34, 'rgba(255,246,200,0.9)', 0.75); glow(c, w * 0.8, h * 0.17, u * 12, '#fffdf0'); c.fillStyle = '#fffbe2'; ell(c, w * 0.8, h * 0.17, u * 6.2, u * 6.2); c.fill();
    peaks(c, w, ground - u * 5, u * 50, 3, Math.max(4, Math.round(w / 240)), ['#7f97cf', '#b7c9e8'], 'rgba(60,70,130,0.2)', '#ffffff');
    c.fillStyle = grad(c, ground - u * 26, ground, ['rgba(255,255,255,0)', 'rgba(232,244,240,0.75)']); c.fillRect(0, ground - u * 26, w, u * 26);
    const far = hills(c, w, ground - u * 3, u * 20, 1.7, ground + 2, ['#6fae6a', '#a7d489']);
    for (let i = 0, n = Math.round(w / 34); i < n; i++) { const x = hash(i * 4.1 + 2) * w; if (hash(i * 9.7) < 0.7) pine(c, x, far(x) + u * 1.5, u * (5 + hash(i * 2.3) * 4), '#3f7f55', '#5c9c66'); }
    const near = hills(c, w, ground + u * 2, u * 11, 4.2, ground + 2, ['#4f9550', '#86c26a']);
    for (let i = 0, n = Math.round(w / 70); i < n; i++) { const x = hash(i * 6.3 + 9) * w; pine(c, x, near(x) + u * 2, u * (9 + hash(i * 3.9) * 6), '#2f6b46', '#4c8c56'); }
    c.fillStyle = grad(c, ground, h, ['#bfe072', '#8fc257', '#5c9a40']); c.fillRect(0, ground, w, deep);
    c.fillStyle = 'rgba(60,110,50,0.35)'; c.fillRect(0, ground, w, 2);
    c.fillStyle = 'rgba(226,205,140,0.42)'; ell(c, w * 0.52, ground + deep * 0.34, w * 0.62, deep * 0.2); c.fill();
    c.fillStyle = 'rgba(240,224,170,0.4)'; ell(c, w * 0.5, ground + deep * 0.33, w * 0.5, deep * 0.11); c.fill();
    for (let i = 0, n = Math.round(w / 9); i < n; i++) {
      const x = hash(i * 5.3 + 1) * w, d = hash(i * 2.9 + 3), y = ground + 5 + d * (deep - 8), k = 0.55 + d * 0.9, kind = hash(i * 7.7);
      if (kind < 0.7) { c.strokeStyle = d > 0.6 ? '#3f8038' : '#5a9a44'; c.lineWidth = 1.3 * k; c.lineCap = 'round'; c.beginPath(); for (const dx of [-3.4, -1, 1.6, 3.6]) { c.moveTo(x + dx * 0.4 * k, y); c.quadraticCurveTo(x + dx * 0.6 * k, y - 5 * k, x + dx * k, y - (6 + hash(i + dx) * 4) * k); } c.stroke(); }
      else if (kind < 0.9) { const col = ['#ffffff', '#ffe36b', '#ff9fc0', '#c9a8ff'][i % 4]; c.strokeStyle = '#4a8a3c'; c.lineWidth = 1.1 * k; c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - 6 * k); c.stroke(); c.fillStyle = col; for (let p = 0; p < 5; p++) { ell(c, x + Math.cos(p * 1.257) * 2.1 * k, y - 6 * k + Math.sin(p * 1.257) * 2.1 * k, 1.5 * k, 1.5 * k); c.fill(); } c.fillStyle = '#f7b23a'; ell(c, x, y - 6 * k, 1.2 * k, 1.2 * k); c.fill(); }
      else { c.fillStyle = 'rgba(40,70,40,0.25)'; ell(c, x + 1, y + 1.5 * k, 6 * k, 2 * k); c.fill(); c.fillStyle = '#b9bcae'; ell(c, x, y - 1.5 * k, 5 * k, 3.2 * k); c.fill(); c.fillStyle = '#e2e4d8'; ell(c, x - 1.2 * k, y - 2.6 * k, 2.6 * k, 1.4 * k); c.fill(); }
    }
  } else if (act === 1) {
    c.fillStyle = grad(c, 0, ground, ['#d8607a', '#f08a62', '#f9bd74', '#ffe6a8']); c.fillRect(0, 0, w, ground + 2);
    glow(c, w * 0.7, ground - u * 16, u * 60, 'rgba(255,236,170,0.9)', 0.8); c.fillStyle = '#fff4c6'; ell(c, w * 0.7, ground - u * 16, u * 10, u * 10); c.fill();
    peaks(c, w, ground - u * 4, u * 44, 21, Math.max(3, Math.round(w / 300)), ['#a65f86', '#e2a08a'], 'rgba(90,40,80,0.22)');
    c.fillStyle = grad(c, ground - u * 22, ground, ['rgba(255,220,170,0)', 'rgba(255,214,160,0.7)']); c.fillRect(0, ground - u * 22, w, u * 22);
    // Flat-topped cliffs with their layers of rock showing.
    for (let i = 0, n = Math.max(3, Math.round(w / 260)); i < n; i++) {
      const x0 = ((i + hash(i * 3.3 + 5) * 0.5) / n) * w - w * 0.04, bw = w * (0.13 + hash(i * 8.1) * 0.12), top = ground - u * (14 + hash(i * 5.9 + 2) * 20), lean = bw * 0.14;
      c.save(); poly(c, [x0 - lean, ground + 2, x0, top + u * 2, x0 + bw * 0.12, top, x0 + bw * 0.86, top + u * 1.2, x0 + bw, top + u * 4, x0 + bw + lean, ground + 2]); c.fillStyle = grad(c, top, ground, ['#b56a58', '#8a4a4c']); c.fill(); c.clip();
      for (let y = top + u * 4; y < ground; y += u * 4.2) { c.fillStyle = hash(y + i) > 0.5 ? 'rgba(255,205,150,0.2)' : 'rgba(70,30,40,0.14)'; c.fillRect(x0 - lean, y, bw + lean * 2, u * 1.5); }
      c.fillStyle = 'rgba(60,24,44,0.26)'; c.fillRect(x0 + bw * 0.6, top, bw, ground - top);
      c.fillStyle = 'rgba(255,224,170,0.5)'; c.fillRect(x0 - lean, top, bw + lean * 2, u * 1.3);
      c.restore();
    }
    c.fillStyle = grad(c, ground, h, ['#e6c08e', '#c1936a', '#8a5f45']); c.fillRect(0, ground, w, deep);
    c.fillStyle = 'rgba(110,60,40,0.4)'; c.fillRect(0, ground, w, 2);
    c.fillStyle = 'rgba(255,232,190,0.35)'; ell(c, w * 0.5, ground + deep * 0.34, w * 0.6, deep * 0.17); c.fill();
    for (let i = 0, n = Math.round(w / 12); i < n; i++) {
      const x = hash(i * 5.3 + 11) * w, d = hash(i * 2.9 + 13), y = ground + 5 + d * (deep - 8), k = 0.55 + d * 0.9, kind = hash(i * 7.7 + 4);
      if (kind < 0.45) { c.strokeStyle = 'rgba(100,60,40,0.4)'; c.lineWidth = 1; c.beginPath(); c.moveTo(x - 9 * k, y); c.lineTo(x - 2 * k, y - 1.5 * k); c.lineTo(x + 3 * k, y + 1.2 * k); c.lineTo(x + 10 * k, y - 0.6 * k); c.stroke(); }
      else if (kind < 0.8) { c.fillStyle = 'rgba(70,35,25,0.28)'; ell(c, x + 1.5, y + 1.5 * k, 7 * k, 2.2 * k); c.fill(); c.fillStyle = i % 2 ? '#9b6a52' : '#b58a6a'; poly(c, [x - 6 * k, y, x - 3.5 * k, y - 5 * k, x + 2.5 * k, y - 6 * k, x + 6.5 * k, y - 1.5 * k, x + 5 * k, y]); c.fill(); c.fillStyle = 'rgba(255,228,180,0.5)'; poly(c, [x - 3.5 * k, y - 5 * k, x + 2.5 * k, y - 6 * k, x + 0.5 * k, y - 3.4 * k]); c.fill(); }
      else { c.strokeStyle = '#8a7a4a'; c.lineWidth = 1.2 * k; c.lineCap = 'round'; c.beginPath(); for (const a of [-1.1, -0.5, 0, 0.6, 1.2]) { c.moveTo(x, y); c.lineTo(x + Math.sin(a) * 8 * k, y - Math.cos(a) * 8 * k); } c.stroke(); }
    }
  } else {
    c.fillStyle = grad(c, 0, ground, ['#1d2f6b', '#41639f', '#9cc0e6', '#eaf4fc']); c.fillRect(0, 0, w, ground + 2);
    c.fillStyle = 'rgba(255,255,255,0.9)'; for (let i = 0; i < 40; i++) { const r = 0.5 + hash(i * 3.1) * 0.9; ell(c, hash(i * 7.9 + 1) * w, hash(i * 5.3 + 2) * ground * 0.42, r, r); c.fill(); }
    // The southern lights, low over the far peaks.
    for (let b = 0; b < 3; b++) { c.beginPath(); c.moveTo(0, h * (0.2 + b * 0.05)); for (let x = 0; x <= w; x += 16) c.lineTo(x, h * (0.16 + b * 0.055) + Math.sin(x / (60 + b * 22) + b * 2) * u * 4); for (let x = w; x >= 0; x -= 16) c.lineTo(x, h * (0.3 + b * 0.05) + Math.sin(x / (80 + b * 15) + b) * u * 5); c.closePath(); c.fillStyle = grad(c, h * 0.14, h * 0.38, ['rgba(120,255,210,0)', b === 1 ? 'rgba(170,150,255,0.2)' : 'rgba(120,255,210,0.22)', 'rgba(120,255,210,0)']); c.fill(); }
    glow(c, w * 0.18, h * 0.2, u * 26, 'rgba(230,240,255,0.9)', 0.6); c.fillStyle = '#f6faff'; ell(c, w * 0.18, h * 0.2, u * 5, u * 5); c.fill(); c.fillStyle = 'rgba(190,205,235,0.6)'; ell(c, w * 0.18 + u * 1.4, h * 0.2 - u, u * 1.2, u * 1.2); c.fill();
    peaks(c, w, ground - u * 4, u * 58, 41, Math.max(4, Math.round(w / 230)), ['#dfe9f8', '#f6faff'], 'rgba(90,115,180,0.3)', '#ffffff');
    c.fillStyle = grad(c, ground - u * 24, ground, ['rgba(255,255,255,0)', 'rgba(236,244,252,0.8)']); c.fillRect(0, ground - u * 24, w, u * 24);
    peaks(c, w, ground + u, u * 26, 57, Math.max(5, Math.round(w / 190)), ['#7f93c2', '#c3d2ea'], 'rgba(50,70,130,0.28)', '#ffffff');
    const near = hills(c, w, ground + u * 2, u * 7, 2.9, ground + 2, ['#f4f9ff', '#d3e0f2']);
    for (let i = 0, n = Math.round(w / 60); i < n; i++) { const x = hash(i * 6.3 + 19) * w; pine(c, x, near(x) + u * 2, u * (8 + hash(i * 3.9 + 2) * 7), '#2f5560', '#44707a', true); }
    c.fillStyle = grad(c, ground, h, ['#ffffff', '#e2ecf8', '#b3c6e2']); c.fillRect(0, ground, w, deep);
    c.fillStyle = 'rgba(190,208,235,0.5)'; ell(c, w * 0.5, ground + deep * 0.36, w * 0.6, deep * 0.16); c.fill();
    for (let i = 0, n = Math.round(w / 14); i < n; i++) {
      const x = hash(i * 5.3 + 31) * w, d = hash(i * 2.9 + 33), y = ground + 5 + d * (deep - 8), k = 0.55 + d * 0.9, kind = hash(i * 7.7 + 14);
      if (kind < 0.5) { c.fillStyle = 'rgba(150,175,215,0.4)'; ell(c, x, y, 14 * k, 2.6 * k); c.fill(); c.fillStyle = 'rgba(255,255,255,0.9)'; ell(c, x - 2 * k, y - 1.5 * k, 11 * k, 2.2 * k); c.fill(); }
      else if (kind < 0.75) { c.fillStyle = 'rgba(50,70,120,0.25)'; ell(c, x + 1.5, y + 1.5 * k, 7 * k, 2.2 * k); c.fill(); c.fillStyle = '#7d8aa6'; poly(c, [x - 6 * k, y, x - 3 * k, y - 5 * k, x + 3 * k, y - 5.5 * k, x + 6 * k, y]); c.fill(); c.fillStyle = '#ffffff'; poly(c, [x - 4 * k, y - 3.6 * k, x - 3 * k, y - 5 * k, x + 3 * k, y - 5.5 * k, x + 4.4 * k, y - 3.2 * k, x + 1 * k, y - 2.6 * k]); c.fill(); }
      else { c.fillStyle = '#ffffff'; const s = 1.6 * k; poly(c, [x, y - s * 2, x + s * 0.5, y - s * 0.5, x + s * 2, y, x + s * 0.5, y + s * 0.5, x, y + s * 2, x - s * 0.5, y + s * 0.5, x - s * 2, y, x - s * 0.5, y - s * 0.5]); c.fill(); }
    }
  }
  // Darker corners pull the eye to the middle, where the fight is.
  const v = c.createRadialGradient(w / 2, h * 0.55, Math.min(w, h) * 0.35, w / 2, h * 0.55, Math.max(w, h) * 0.75);
  v.addColorStop(0, 'rgba(20,12,40,0)'); v.addColorStop(1, 'rgba(20,12,40,0.3)');
  c.fillStyle = v; c.fillRect(0, 0, w, h);
}

/** The painted mountain behind a stretch's trail: sky, far ranges, and one great slope climbing to the guardian. */
export function drawTrail(c: C2D, w: number, h: number, act: number) {
  const u = h / 100, sky = [['#59b4ea', '#bfe6f6', '#fdf0cc'], ['#dd6a7c', '#f5a468', '#ffe2a6'], ['#22366f', '#5f86c2', '#dcebfa']][act];
  c.clearRect(0, 0, w, h);
  c.fillStyle = grad(c, 0, h * 0.6, sky); c.fillRect(0, 0, w, h);
  if (act === 2) { c.fillStyle = 'rgba(255,255,255,0.9)'; for (let i = 0; i < 50; i++) { const r = 0.5 + hash(i * 3.1) * 1; ell(c, hash(i * 7.9 + 1) * w, hash(i * 5.3 + 2) * h * 0.3, r, r); c.fill(); } }
  glow(c, w * (act === 2 ? 0.14 : 0.86), h * 0.1, u * 22, act === 2 ? 'rgba(230,240,255,0.9)' : 'rgba(255,246,200,0.95)', 0.8);
  c.fillStyle = act === 2 ? '#f6faff' : '#fffbe2'; ell(c, w * (act === 2 ? 0.14 : 0.86), h * 0.1, u * 3.6, u * 3.6); c.fill();
  const far = [['#8ea4d6', '#c2d2ec'], ['#b06a8c', '#e6a890'], ['#b9c9e8', '#eef4fc']][act];
  peaks(c, w, h * 0.5, h * 0.34, act * 13 + 5, 5, far, 'rgba(60,60,120,0.18)', act === 1 ? '' : '#ffffff');
  c.fillStyle = grad(c, h * 0.3, h * 0.52, ['rgba(255,255,255,0)', act === 1 ? 'rgba(255,220,170,0.6)' : 'rgba(240,248,252,0.7)']); c.fillRect(0, h * 0.3, w, h * 0.22);
  // The mountain itself: a peak under the guardian, shoulders either side, and bands of ground that change with the height.
  const edge = [-0.04, 1.02, 0.02, 0.66, 0.12, 0.5, 0.2, 0.54, 0.31, 0.3, 0.4, 0.17, 0.5, 0.035, 0.6, 0.16, 0.69, 0.3, 0.8, 0.5, 0.88, 0.45, 0.98, 0.64, 1.04, 1.02].map((v, i) => (i % 2 ? v * h : v * w));
  const zones = [['#a6b49a', '#7fae62', '#8fc463', '#b2d974'], ['#c99a86', '#b77a62', '#c79670', '#dfb98a'], ['#ffffff', '#e6eefb', '#c5d5ee', '#aabfdf']][act];
  c.save(); poly(c, edge); c.fillStyle = grad(c, 0, h, zones); c.fill(); c.clip();
  // The side away from the light, and ledges that step up the slope.
  c.fillStyle = act === 2 ? 'rgba(80,105,170,0.22)' : act === 1 ? 'rgba(80,30,50,0.2)' : 'rgba(30,70,50,0.18)';
  poly(c, [w * 0.5, h * 0.035, w * 0.6, h * 0.16, w * 0.69, h * 0.3, w * 0.8, h * 0.5, w * 0.88, h * 0.45, w * 0.98, h * 0.64, w * 1.04, h * 1.02, w * 0.62, h * 1.02, w * 0.56, h * 0.6, w * 0.53, h * 0.3]); c.fill();
  for (let i = 0; i < 9; i++) {
    const y = h * (0.2 + i * 0.09), sway = (x: number) => y + Math.sin(x / (w * 0.09) + i * 1.9) * u * 1.6 + Math.sin(x / (w * 0.033) + i) * u * 0.6;
    c.beginPath(); c.moveTo(0, sway(0)); for (let x = 0; x <= w; x += 10) c.lineTo(x, sway(x)); c.lineTo(w, sway(w) + u * 5); for (let x = w; x >= 0; x -= 10) c.lineTo(x, sway(x) + u * (2.6 + Math.sin(x / (w * 0.07) + i) * 1.2)); c.closePath();
    c.fillStyle = act === 2 ? 'rgba(120,145,200,0.16)' : act === 1 ? 'rgba(90,40,40,0.14)' : 'rgba(40,90,50,0.13)'; c.fill();
    c.strokeStyle = act === 2 ? 'rgba(255,255,255,0.7)' : act === 1 ? 'rgba(255,225,180,0.35)' : 'rgba(225,245,170,0.35)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(0, sway(0)); for (let x = 0; x <= w; x += 10) c.lineTo(x, sway(x)); c.stroke();
  }
  for (let i = 0; i < 90; i++) {
    const x = hash(i * 4.7 + act * 9) * w, y = h * (0.16 + hash(i * 8.3 + act) * 0.84), k = (0.6 + (y / h) * 0.9) * u, kind = hash(i * 2.1 + act * 3);
    if (act === 0) { if (y > h * 0.26 && kind < 0.62) pine(c, x, y, k * (4 + kind * 5), '#3d7a52', '#5d9c64'); else if (kind > 0.9) { c.fillStyle = 'rgba(40,70,40,0.25)'; ell(c, x + k * 0.3, y + k * 0.5, k * 1.5, k * 0.6); c.fill(); c.fillStyle = '#b9bcae'; ell(c, x, y, k * 1.3, k * 0.8); c.fill(); c.fillStyle = '#e2e4d8'; ell(c, x - k * 0.3, y - k * 0.25, k * 0.7, k * 0.35); c.fill(); } else { c.fillStyle = ['#ffffff', '#ffe36b', '#ff9fc0'][i % 3]; ell(c, x, y, k * 0.5, k * 0.5); c.fill(); } }
    else if (act === 1) { if (kind < 0.55) { c.fillStyle = 'rgba(70,35,30,0.25)'; ell(c, x + k, y + k * 0.5, k * 2.4, k * 0.8); c.fill(); c.fillStyle = i % 2 ? '#9b6a52' : '#b98e6c'; poly(c, [x - k * 2, y, x - k, y - k * 1.8, x + k * 1.2, y - k * 2.1, x + k * 2.2, y]); c.fill(); c.fillStyle = 'rgba(255,228,180,0.5)'; poly(c, [x - k, y - k * 1.8, x + k * 1.2, y - k * 2.1, x + k * 0.2, y - k * 1.1]); c.fill(); } else if (kind > 0.82) { c.strokeStyle = '#7d7444'; c.lineWidth = 1.1; c.beginPath(); for (const a of [-1, -0.4, 0.3, 1]) { c.moveTo(x, y); c.lineTo(x + Math.sin(a) * k * 2.2, y - Math.cos(a) * k * 2.2); } c.stroke(); } }
    else { if (y > h * 0.4 && kind < 0.4) pine(c, x, y, k * (4 + kind * 6), '#2f5560', '#44707a', true); else if (kind > 0.7) { c.fillStyle = '#8894b0'; poly(c, [x - k * 2, y, x - k, y - k * 1.8, x + k * 1.2, y - k * 2, x + k * 2.2, y]); c.fill(); c.fillStyle = '#ffffff'; poly(c, [x - k * 1.4, y - k * 1.1, x - k, y - k * 1.8, x + k * 1.2, y - k * 2, x + k * 1.6, y - k * 1.1, x, y - k * 0.8]); c.fill(); } }
  }
  if (act < 2) { c.fillStyle = '#ffffff'; poly(c, [w * 0.5, h * 0.035, w * 0.555, h * 0.105, w * 0.535, h * 0.095, w * 0.52, h * 0.13, w * 0.5, h * 0.1, w * 0.478, h * 0.135, w * 0.465, h * 0.1, w * 0.445, h * 0.108]); c.globalAlpha = act === 1 ? 0.55 : 0.95; c.fill(); c.globalAlpha = 1; }
  c.restore();
  const tint = THEMES[act].cloud;
  for (const [x, y, s, a] of [[0.1, 0.33, 4.2, 0.9], [0.9, 0.24, 3.6, 0.85], [0.3, 0.16, 2.6, 0.7], [0.74, 0.62, 3, 0.5], [0.04, 0.74, 3.4, 0.45]]) cloud(c, x * w, y * h, s * u, tint[0], tint[1], a);
  const v = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.4, w / 2, h / 2, Math.max(w, h) * 0.78);
  v.addColorStop(0, 'rgba(20,12,40,0)'); v.addColorStop(1, 'rgba(20,12,40,0.28)');
  c.fillStyle = v; c.fillRect(0, 0, w, h);
}

// ---------- The fight ----------
type Actor = { hp: number; maxHp: number; fluff: number; alive: boolean; fade: number; flash: number; shake: number; lunge: number; fled: boolean; /** Health as the bar last showed it, catching up. */ lag: number; /** Set when Fluff is gained, to make the shield jump. */ pop: number };
type Anim = { dur: number; t: number; begun: boolean; foe: boolean; start?: () => void; tick?: (k: number) => void };
type Float = { who: number; text: string; color: string; life: number; lane: number; big: number };
type Spot = { x: number; y: number; px: number; top: number; fly: boolean; half: number; mid: number };
type Bit = { x: number; y: number; vx: number; vy: number; g: number; life: number; max: number; size: number; color: string; kind: 'dot' | 'puff' | 'star' | 'plus' | 'slip'; rot: number; vr: number };
type Fx = { kind: 'slash' | 'ring' | 'star'; who: number; t: number; dur: number; color: string; seed: number };
type Layout = { ground: number; hero: Spot; foes: Spot[]; w: number; h: number };
const INTENT_TINT: Record<Intent['kind'], [string, string]> = {
  attack: ['#7a1c22', '#ff9c8a'], block: ['#1d4670', '#9fd4ff'], buff: ['#7a4a10', '#ffcf7a'], hex: ['#4a2470', '#dcb0ff'],
  sleep: ['#2a3350', '#b9c6e8'], flee: ['#2f4a40', '#b6ecd0'], call: ['#6a3a18', '#ffc890'], idle: ['#2a2536', '#c9c2d6'],
};
/** The little picture for what a predator will do next, in a box `s` across centred on (x, y). */
function intentIcon(c: C2D, kind: Intent['kind'], x: number, y: number, s: number) {
  c.save(); c.translate(x, y); c.scale(s / 20, s / 20); c.lineJoin = 'round'; c.lineCap = 'round';
  if (kind === 'attack') {
    for (const dir of [-1, 1]) {
      c.save(); c.rotate(dir * 0.72);
      poly(c, [-1.6, 4, -1.6, -8, 0, -10.5, 1.6, -8, 1.6, 4]); ink(c, '#eef2f8', '#2a2230', 1.1);
      c.fillStyle = 'rgba(120,140,170,0.5)'; c.fillRect(0, -8, 1.3, 12);
      c.beginPath(); c.roundRect(-4.4, 3.6, 8.8, 2.2, 1); ink(c, '#f2b63c', '#2a2230', 1.1);
      c.beginPath(); c.roundRect(-1.2, 5.6, 2.4, 4.6, 1); ink(c, '#8a5a34', '#2a2230', 1.1);
      c.restore();
    }
  } else if (kind === 'block') {
    c.beginPath(); c.moveTo(-7.5, -8); c.lineTo(7.5, -8); c.lineTo(7.5, 0); c.quadraticCurveTo(7, 7, 0, 10); c.quadraticCurveTo(-7, 7, -7.5, 0); c.closePath(); ink(c, '#4aa3e8', '#eaf6ff', 1.6);
    c.fillStyle = 'rgba(255,255,255,0.45)'; poly(c, [-5, -5.6, 0, -5.6, 0, 6.6, -4.6, 3.4]); c.fill();
  } else if (kind === 'buff') {
    for (const dy of [3.5, -3.5]) { poly(c, [-7, dy + 3.5, 0, dy - 4.5, 7, dy + 3.5, 3.6, dy + 3.5, 0, dy - 0.2, -3.6, dy + 3.5]); ink(c, dy < 0 ? '#ffd45a' : '#ff9a3c', '#3a2400', 1.1); }
  } else if (kind === 'hex') {
    c.strokeStyle = '#2a1238'; c.lineWidth = 4.6; c.beginPath(); for (let a = 0; a < 11; a += 0.25) { const r = 0.8 + a * 0.82; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.stroke();
    c.strokeStyle = '#d7a6ff'; c.lineWidth = 2.4; c.stroke();
  } else if (kind === 'sleep') {
    c.fillStyle = '#dfe6ff'; c.strokeStyle = '#1c2238'; c.lineWidth = 2.2; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = `900 13px ${FONT}`; c.strokeText('Z', -3, 2.5); c.fillText('Z', -3, 2.5); c.font = `900 9px ${FONT}`; c.strokeText('z', 5, -4.5); c.fillText('z', 5, -4.5);
  } else if (kind === 'flee') {
    c.strokeStyle = '#1a2a24'; c.lineWidth = 4.2; c.beginPath(); for (const [dy, len] of [[-5, 9], [0, 13], [5, 7]]) { c.moveTo(-8, dy); c.lineTo(-8 + len, dy); } c.stroke();
    c.strokeStyle = '#c9f5de'; c.lineWidth = 2.2; c.stroke(); poly(c, [3.5, -5.5, 10, 0, 3.5, 5.5]); ink(c, '#c9f5de', '#1a2a24', 1.1);
  } else if (kind === 'call') {
    poly(c, [-8, -2.6, -2, -2.6, 4.5, -7.5, 4.5, 7.5, -2, 2.6, -8, 2.6]); ink(c, '#ffc27a', '#3a2400', 1.2);
    c.strokeStyle = '#fff1d6'; c.lineWidth = 1.7; for (const r of [4, 7.5]) { c.beginPath(); c.arc(4.5, 0, r, -0.8, 0.8); c.stroke(); }
  } else { c.fillStyle = '#e6e0f0'; for (const dx of [-6, 0, 6]) { ell(c, dx, 0, 2, 2); c.fill(); } }
  c.restore();
}

export class Stage {
  hero: Actor; foes: Actor[] = [];
  speed = 1;
  /** Called with a cue name as each event starts to play. */
  sfx: (name: string) => void = () => {};
  private queue: Anim[] = []; private floats: Float[] = []; private banner = { text: '', life: 0 };
  private bits: Bit[] = []; private fx: Fx[] = []; private quake = 0; private lay: Layout | null = null;
  private inFoes = false; private backdrop: HTMLCanvasElement | null = null; private backdropKey = '';
  private scratch: HTMLCanvasElement | null = null;

  constructor(run: Run) { this.hero = this.fresh(run.hp, run.maxHp, 0, true); this.sync(run); }
  private fresh(hp: number, maxHp: number, fluff: number, alive: boolean): Actor { return { hp, maxHp, fluff, alive, fade: alive ? 1 : 0, flash: 0, shake: 0, lunge: 0, fled: false, lag: hp, pop: 0 }; }
  /** Makes the picture match the engine exactly, dropping anything still to play. */
  sync(run: Run) {
    const f = run.fight;
    this.queue = []; this.inFoes = false;
    Object.assign(this.hero, { hp: run.hp, maxHp: run.maxHp, fluff: f?.fluff ?? 0, flash: 0, shake: 0, lunge: 0, lag: run.hp });
    this.foes = (f?.foes ?? []).map((x) => ({ ...this.fresh(x.hp, x.maxHp, x.fluff, x.alive), fled: x.fled }));
  }
  get busy() { return this.queue.length > 0; }
  /** True while the predators' turn is still playing, when the hand should wait. */
  get waiting() { return this.queue.some((a) => a.foe); }
  flush(run: Run) { this.sync(run); this.floats = []; this.bits = []; this.fx = []; this.quake = 0; this.banner.life = 0; }

  private actor(who: number): Actor | undefined { return who === -1 ? this.hero : this.foes[who]; }
  private say(who: number, text: string, color: string, big = 0) { this.floats.push({ who, text, color, life: 1, lane: this.floats.filter((f) => f.who === who && f.life > 0.55).length, big }); }
  private spot(who: number): Spot | undefined { return who === -1 ? this.lay?.hero : this.lay?.foes[who]; }
  /** Throws `n` bits out from the middle of whoever it is. */
  private burst(who: number, n: number, kind: Bit['kind'], colors: string[], o: { speed?: number; size?: number; g?: number; up?: number; life?: number; spread?: number } = {}) {
    const p = this.spot(who);
    if (!p) return;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = (o.speed ?? 90) * (0.4 + Math.random() * 0.8), life = (o.life ?? 0.6) * (0.7 + Math.random() * 0.6), sp = o.spread ?? 0.5;
      this.bits.push({ x: p.x + (Math.random() - 0.5) * p.half * 2 * sp, y: p.mid + (Math.random() - 0.5) * p.px * sp, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (o.up ?? 0), g: o.g ?? 0, life, max: life, size: (o.size ?? 3) * (0.6 + Math.random() * 0.8), color: colors[i % colors.length], kind, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 8 });
    }
  }
  private effect(kind: Fx['kind'], who: number, color: string, dur: number) { this.fx.push({ kind, who, t: 0, dur, color, seed: Math.random() * 100 }); }
  feed(events: Ev[], run: Run) {
    for (const e of events) {
      const a = this.anim(e, run);
      if (e.t === 'foes') this.inFoes = true;
      if (a) this.queue.push({ ...a, t: 0, begun: false, foe: this.inFoes });
      if (e.t === 'turn' || e.t === 'won' || e.t === 'lost') this.inFoes = false;
    }
  }
  private anim(e: Ev, run: Run): Omit<Anim, 't' | 'begun' | 'foe'> | null {
    switch (e.t) {
      case 'turn': return { dur: 0.35, start: () => { this.banner = { text: e.n === 1 ? 'Your turn' : `Turn ${e.n}`, life: 1 }; this.sfx('turn'); if (e.n > 1 && !run.fight?.st.den) this.hero.fluff = 0; } };
      case 'foes': return { dur: 0.3, start: () => { this.banner = { text: 'Predators’ turn', life: 1 }; } };
      case 'card': { const type = CARDS[e.id].type, attack = type === 'attack'; return { dur: attack ? 0.2 : 0.14, start: () => { this.sfx(attack ? 'swing' : type === 'power' ? 'power' : 'skill'); if (type === 'power') { this.effect('ring', -1, '#ffd45a', 0.5); this.burst(-1, 10, 'star', ['#ffe07a', '#fff6cf'], { speed: 70, up: 60, size: 3.4, life: 0.7 }); } }, tick: (k) => { if (attack) this.hero.lunge = Math.sin(k * Math.PI) * 30; } }; }
      case 'hit': return { dur: 0.2, start: () => {
        const a = this.actor(e.to);
        if (!a) return;
        a.hp = e.hp; a.fluff = e.fluff;
        if (e.dmg > 0) {
          const burrs = e.from === -2, mine = e.to === -1;
          a.flash = 1; a.shake = 1; this.say(e.to, `-${e.dmg}`, burrs ? '#e0b4ff' : mine ? '#ff8f7a' : '#ffe36b', e.dmg); this.sfx(mine ? 'hurt' : 'hit');
          if (burrs) this.burst(e.to, 7, 'dot', ['#c9a36a', '#8a6238', '#e0b4ff'], { speed: 80, size: 2.6, g: 260 });
          else { this.effect('slash', e.to, mine ? '#ff6a5a' : '#ffffff', 0.28); this.effect('star', e.to, mine ? '#ffb0a0' : '#fff2a8', 0.22); this.burst(e.to, 6 + Math.min(10, e.dmg >> 1), 'star', mine ? ['#ff8f7a', '#ffd0c4'] : ['#ffe36b', '#ffffff', '#ffb46a'], { speed: 120 + Math.min(140, e.dmg * 6), size: 3, g: 320, life: 0.5 }); }
          this.quake = Math.max(this.quake, mine ? Math.min(1, 0.35 + e.dmg / 24) : e.dmg >= 14 ? Math.min(0.7, e.dmg / 40) : 0);
        } else { this.say(e.to, 'Blocked', '#9fd8ff'); this.sfx('block'); this.effect('ring', e.to, '#9fd8ff', 0.35); this.burst(e.to, 6, 'puff', ['#ffffff', '#d6ecff'], { speed: 70, size: 5, life: 0.45 }); }
      } };
      case 'fluff': return { dur: 0.1, start: () => { const a = this.actor(e.who); if (!a) return; a.fluff = e.fluff; if (e.n > 0) { a.pop = 1; this.say(e.who, `+${e.n} Fluff`, '#9fd8ff'); this.sfx('fluff'); this.burst(e.who, 9, 'puff', ['#ffffff', '#e4f2ff', '#cfe6ff'], { speed: 46, up: 40, size: 6, life: 0.7, spread: 0.9 }); } } };
      case 'st': return { dur: 0.1, start: () => { if (STATUS[e.id] && e.id !== 'rush') { const bad = STATUS[e.id].bad === (e.n > 0); this.say(e.who, `${e.n > 0 ? '+' : ''}${e.n} ${STATUS[e.id].name}`, bad ? '#e9a8ff' : '#ffe08a'); this.burst(e.who, 6, bad ? 'dot' : 'star', bad ? ['#d7a6ff', '#a86ae0'] : ['#ffe08a', '#fff6cf'], { speed: 50, up: bad ? -30 : 50, size: 2.8, life: 0.6, spread: 0.8 }); } } };
      case 'heal': return { dur: 0.15, start: () => { this.hero.hp = e.hp; this.hero.maxHp = Math.max(this.hero.maxHp, e.hp); this.say(-1, `+${e.n}`, '#9df09a', e.n); this.sfx('heal'); this.burst(-1, 8, 'plus', ['#9df09a', '#d6ffd0'], { speed: 30, up: 70, size: 4.4, life: 0.8, spread: 0.9 }); } };
      case 'move': return { dur: e.attack ? 0.32 : 0.28, start: () => { this.say(e.who, e.name, '#ffffff'); const a = this.foes[e.who]; if (a) a.fluff = 0; this.sfx(e.attack ? 'growl' : 'skill'); if (!e.attack) this.effect('ring', e.who, '#ffd7a8', 0.4); }, tick: (k) => { const a = this.foes[e.who]; if (a && e.attack) a.lunge = Math.sin(k * Math.PI) * 34; } };
      case 'out': return { dur: 0.3, start: () => { const a = this.foes[e.who]; if (a) { a.alive = false; a.fled = e.fled; a.hp = e.fled ? a.hp : 0; } this.sfx(e.fled ? 'flee' : 'out'); if (e.fled) this.burst(e.who, 8, 'slip', ['#ffffff'], { speed: 20, size: 14, life: 0.4 }); else this.burst(e.who, 14, 'puff', ['#ffffff', '#efe6d6', '#d9cdb8'], { speed: 80, up: 30, size: 9, life: 0.75, spread: 0.7 }); } };
      case 'join': return { dur: 0.25, start: () => { const x = run.fight?.foes[e.who]; if (x) { this.foes[e.who] = this.fresh(x.maxHp, x.maxHp, 0, true); this.foes[e.who].fade = 0; } this.sfx('growl'); this.burst(e.who, 10, 'puff', ['#ffffff', '#efe6d6'], { speed: 70, size: 8, life: 0.6 }); } };
      case 'add': return { dur: 0.1, start: () => this.say(-1, `+${e.n} ${CARDS[e.id].name}`, '#e9a8ff') };
      case 'seeds': return { dur: 0.1, start: () => this.say(-1, `${e.n > 0 ? '+' : ''}${e.n} seeds`, '#ffe08a') };
      case 'slip': return { dur: 0.1, start: () => { this.say(-1, 'Fur slip!', '#ffe08a'); this.burst(-1, 10, 'puff', ['#ffffff'], { speed: 90, size: 5, life: 0.5 }); } };
      case 'won': return { dur: 0.85, start: () => {
        this.banner = { text: 'Trail clear!', life: 1.4 };
        const l = this.lay;
        if (l) for (let i = 0; i < 60; i++) { const life = 1 + Math.random() * 0.7; this.bits.push({ x: Math.random() * l.w, y: -10 - Math.random() * l.h * 0.3, vx: (Math.random() - 0.5) * 60, vy: 90 + Math.random() * 120, g: 60, life, max: life, size: 4 + Math.random() * 3, color: ['#ffd45a', '#ff8fb0', '#8fe08a', '#9fd8ff', '#ffffff'][i % 5], kind: 'slip', rot: Math.random() * 6, vr: (Math.random() - 0.5) * 14 }); }
        this.burst(-1, 14, 'star', ['#ffe07a', '#fff6cf'], { speed: 110, up: 80, size: 4, life: 0.9 });
      } };
      default: return null;
    }
  }
  update(dt: number) {
    let left = dt * this.speed;
    while (left > 0 && this.queue.length) {
      const a = this.queue[0];
      if (!a.begun) { a.begun = true; a.start?.(); }
      const step = Math.min(left, a.dur - a.t);
      a.t += step; left -= step;
      a.tick?.(Math.min(1, a.t / a.dur));
      if (a.t >= a.dur - 1e-6) { a.tick?.(1); this.queue.shift(); }
    }
    for (const a of [this.hero, ...this.foes]) {
      a.flash = Math.max(0, a.flash - dt * 4); a.shake = Math.max(0, a.shake - dt * 5); a.pop = Math.max(0, a.pop - dt * 3.5);
      a.fade = clamp(a.fade + (a.alive ? dt * 5 : -dt * 3), 0, 1);
      a.lag = a.lag > a.hp ? Math.max(a.hp, a.lag - Math.max(6, (a.lag - a.hp) * 3) * dt) : a.hp;
    }
    for (const f of this.floats) f.life -= dt * 0.9;
    this.floats = this.floats.filter((f) => f.life > 0);
    for (const b of this.bits) { b.life -= dt; b.vy += b.g * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.rot += b.vr * dt; if (b.kind === 'puff' || b.kind === 'plus') { b.vx *= 1 - dt * 2.4; b.vy *= 1 - dt * 1.6; } }
    this.bits = this.bits.filter((b) => b.life > 0);
    for (const x of this.fx) x.t += dt;
    this.fx = this.fx.filter((x) => x.t < x.dur);
    this.quake = Math.max(0, this.quake - dt * 3.2);
    this.banner.life = Math.max(0, this.banner.life - dt * 0.9);
  }

  /** Where everyone stands on a canvas of this size. */
  private spots(w: number, h: number, run: Run, t: number): { ground: number; hero: Spot; foes: Spot[] } {
    const ground = Math.round(h * 0.74), narrow = w < 560, heroH = Math.min(clamp(h * 0.36, 60, 150), narrow ? w * 0.21 : 999);
    const hero: Spot = { x: w * (narrow ? 0.21 : 0.2), y: ground + 6, px: heroH, top: ground - heroH * 1.15, fly: false, half: heroH * 0.62, mid: ground - heroH * 0.5 };
    // Each predator gets room in the line in proportion to its size, so a guardian is not squeezed down to its kits.
    const list = run.fight?.foes ?? [], x0 = w * (narrow ? 0.42 : 0.4), x1 = w * 0.985, big = heroH * 1.24;
    const want = list.map((x) => { const look = FOES[x.kind].look; return Math.max(46, big * (look.h / 100) * WIDE[look.shape]); });
    const total = want.reduce((a, b) => a + b, 0) || 1, room = x1 - x0, squeeze = Math.min(1, room / total), gap = (room - total * squeeze) / Math.max(1, list.length);
    let at = x0;
    const foes = list.map((x, i) => {
      const look = FOES[x.kind].look, slot = want[i] * squeeze + gap, px = Math.min(big * (look.h / 100), (want[i] * squeeze * 0.98) / WIDE[look.shape], h * 0.62);
      const lift = look.fly ? px * 0.3 + Math.sin(t * 2.2 + i * 1.7) * 3 : 0, cx = at + slot / 2, top = ground - lift - px * TALL[look.shape];
      at += slot;
      return { x: cx, y: ground + 6 + (i % 2) * 5 - lift, px, top, fly: !!look.fly, half: Math.max(30, px * WIDE[look.shape] * 0.5), mid: (top + ground - lift) / 2 };
    });
    return { ground, hero, foes };
  }
  /** The foe drawn under a point, or -1. */
  foeAt(px: number, py: number, w: number, h: number, run: Run): number {
    const s = this.spots(w, h, run, 0);
    let best = -1, near = Infinity;
    s.foes.forEach((p, i) => {
      if (!run.fight?.foes[i]?.alive) return;
      const d = Math.abs(px - p.x);
      if (d <= p.half + 6 && py >= p.top - 44 && py <= s.ground + 56 && d < near) { near = d; best = i; }
    });
    return best;
  }
  /** Whether a point is on the chinchilla or its health bar. */
  heroAt(px: number, py: number, w: number, h: number, run: Run): boolean {
    const s = this.spots(w, h, run, 0);
    return Math.abs(px - s.hero.x) <= s.hero.half + 10 && py >= s.hero.top - 6 && py <= s.ground + 56;
  }
  /** The box around the chinchilla (-1) or a foe, intent badge and health bar included, in canvas pixels. */
  boxOf(who: number, w: number, h: number, run: Run): { x: number; y: number; w: number; h: number } | null {
    const s = this.spots(w, h, run, 0), p = who === -1 ? s.hero : s.foes[who];
    if (!p) return null;
    const top = Math.max(0, p.top - (who === -1 ? 4 : 34));
    return { x: p.x - p.half, y: top, w: p.half * 2, h: Math.min(h, s.ground + 40) - top };
  }

  private paintBackdrop(w: number, h: number, act: number, scale: number): HTMLCanvasElement {
    const key = `${w}|${h}|${act}|${scale}`;
    if (this.backdrop && this.backdropKey === key) return this.backdrop;
    const cv = this.backdrop ?? document.createElement('canvas');
    cv.width = Math.max(1, Math.round(w * scale)); cv.height = Math.max(1, Math.round(h * scale));
    const c = cv.getContext('2d')!;
    c.setTransform(scale, 0, 0, scale, 0, 0);
    paintScenery(c, w, h, Math.round(h * 0.74), act % THEMES.length);
    this.backdrop = cv; this.backdropKey = key;
    return cv;
  }

  /**
   * A predator with light on its back and shadow under its belly, and whitened for a moment when it is hit. It is
   * drawn on a canvas of its own first, so the light and the flash land on the animal and nothing behind it.
   */
  private shaded(c: C2D, scale: number, look: Look, x: number, y: number, px: number, t: number, flash: number) {
    const bw = px * WIDE[look.shape] * 1.8 + 24, bh = px * 1.6 + 24, foot = bh - 12 - px * 0.12, pw = Math.ceil(bw * scale), ph = Math.ceil(bh * scale);
    const cv = this.scratch ?? (this.scratch = document.createElement('canvas'));
    if (cv.width < pw || cv.height < ph) { cv.width = Math.max(cv.width, pw); cv.height = Math.max(cv.height, ph); }
    const k = cv.getContext('2d')!;
    k.setTransform(1, 0, 0, 1, 0, 0); k.globalCompositeOperation = 'source-over'; k.clearRect(0, 0, pw + 1, ph + 1);
    k.setTransform(scale, 0, 0, scale, 0, 0);
    drawFoe(k, look, bw / 2, foot, px, t);
    k.globalCompositeOperation = 'source-atop';
    const top = foot - px * TALL[look.shape], light = k.createLinearGradient(0, top, 0, foot);
    light.addColorStop(0, 'rgba(255,244,206,0.2)'); light.addColorStop(0.5, 'rgba(255,244,206,0.03)'); light.addColorStop(0.56, 'rgba(46,22,70,0.02)'); light.addColorStop(1, 'rgba(46,22,70,0.26)');
    k.fillStyle = light; k.fillRect(0, 0, bw, bh);
    if (flash > 0) { k.fillStyle = `rgba(255,255,255,${flash * 0.8})`; k.fillRect(0, 0, bw, bh); }
    c.drawImage(cv, 0, 0, pw, ph, x - bw / 2, y - foot, bw, bh);
  }

  private bar(c: C2D, x: number, y: number, bw: number, a: Actor, colors: [string, string], st: Statuses | undefined, compact: boolean) {
    const bh = 14, shown = Math.max(0, a.hp), x0 = x - bw / 2, part = (v: number) => bw * clamp(v / a.maxHp, 0, 1);
    pill(c, x0 - 2, y - 2, bw + 4, bh + 4, 8); c.fillStyle = 'rgba(20,12,30,0.9)'; c.fill();
    c.save(); pill(c, x0, y, bw, bh, 6); c.clip();
    c.fillStyle = '#3a2f48'; c.fillRect(x0, y, bw, bh);
    if (a.lag > shown) { c.fillStyle = '#fff1bf'; c.fillRect(x0, y, part(a.lag), bh); }
    if (shown > 0) { c.fillStyle = grad(c, y, y + bh, [colors[0], colors[1]]); c.fillRect(x0, y, part(shown), bh); }
    c.fillStyle = 'rgba(255,255,255,0.28)'; c.fillRect(x0, y + 1.5, bw, 3.5);
    c.restore();
    if (a.fluff > 0) { pill(c, x0 - 2, y - 2, bw + 4, bh + 4, 8); c.strokeStyle = '#8fd0ff'; c.lineWidth = 2; c.stroke(); }
    c.font = `800 11px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    const label = compact && bw < 62 ? String(shown) : `${shown}/${a.maxHp}`, tx = x + (a.fluff > 0 ? 6 : 0);
    c.strokeStyle = 'rgba(20,12,30,0.85)'; c.lineWidth = 2.6; c.lineJoin = 'round'; c.strokeText(label, tx, y + bh / 2 + 0.5); c.fillStyle = '#fff'; c.fillText(label, tx, y + bh / 2 + 0.5);
    if (a.fluff > 0) {
      const bx = x0 - 2, by = y + bh / 2, k = 1 + a.pop * 0.45;
      c.save(); c.translate(bx, by); c.scale(k, k);
      c.beginPath(); c.moveTo(-10, -10); c.lineTo(10, -10); c.lineTo(10, 2); c.quadraticCurveTo(9, 10, 0, 13); c.quadraticCurveTo(-9, 10, -10, 2); c.closePath();
      ink(c, grad(c, -10, 13, ['#7cc4ff', '#2f84d6']), '#eaf6ff', 1.6);
      c.fillStyle = 'rgba(255,255,255,0.35)'; poly(c, [-7, -7.5, 0, -7.5, 0, 9, -6.5, 5]); c.fill();
      c.fillStyle = '#fff'; c.font = `900 11.5px ${FONT}`; c.strokeStyle = 'rgba(16,50,96,0.8)'; c.lineWidth = 2.4; c.strokeText(String(a.fluff), 0, 0.5); c.fillText(String(a.fluff), 0, 0.5);
      c.restore();
    }
    if (!st) return;
    const ids = (Object.keys(st) as StatusId[]).filter((id) => st[id] && STATUS[id] && id !== 'rush');
    if (!ids.length) return;
    c.textBaseline = 'middle'; c.textAlign = 'left';
    const each = compact ? 27 : 31, perRow = Math.max(2, Math.floor((bw + 40) / each));
    ids.forEach((id, i) => {
      const row = Math.floor(i / perRow), inRow = Math.min(perRow, ids.length - row * perRow), sx = x - (inRow * each) / 2 + (i % perRow) * each, sy = y + bh + 13 + row * 18, n = st[id]!, bad = !!STATUS[id].bad;
      pill(c, sx, sy - 8, each - 3, 16, 8); c.fillStyle = bad ? 'rgba(70,24,84,0.86)' : 'rgba(30,26,52,0.82)'; c.fill();
      c.strokeStyle = bad ? 'rgba(233,168,255,0.7)' : 'rgba(255,233,168,0.55)'; c.lineWidth = 1; c.stroke();
      c.font = `700 10.5px ${FONT}`; c.fillStyle = '#fff'; c.fillText(STATUS[id].icon, sx + 2, sy + 0.5);
      if (id !== 'den') { c.font = `800 10.5px ${FONT}`; c.fillStyle = bad || TIMED.includes(id) ? '#ffc4ef' : '#ffe9a8'; c.fillText(String(n), sx + 15.5, sy + 1); }
    });
  }

  /** `o.target` is the foe the chosen card is aimed at, `o.hover` the one under the pointer, `o.aiming` whether a card is waiting for a foe. */
  draw(c: C2D, w: number, h: number, scale: number, run: Run, t: number, o: { target: number; hover: number; aiming: boolean }) {
    const f = run.fight, act = run.act % THEMES.length, th = THEMES[act];
    c.setTransform(scale, 0, 0, scale, 0, 0);
    const jx = this.quake ? Math.sin(t * 61) * 7 * this.quake : 0, jy = this.quake ? Math.cos(t * 53) * 5 * this.quake : 0;
    c.drawImage(this.paintBackdrop(w, h, run.act, scale), -8 + jx * 0.5, -8 + jy * 0.5, w + 16, h + 16);
    const s = this.spots(w, h, run, t), compact = w < 560;
    this.lay = { ...s, w, h };

    // The air: clouds on the move, and whatever drifts about at this height.
    for (let i = 0; i < 4; i++) { const sp = 5 + hash(i * 3.3 + act) * 7, size = h * (0.04 + hash(i * 5.1) * 0.035), span = w + size * 8; cloud(c, ((hash(i * 9.7 + act * 2) * span + t * sp) % span) - size * 4, h * (0.08 + hash(i * 2.9 + 1) * 0.26), size, th.cloud[0], th.cloud[1], act === 2 ? 0.4 : 0.85); }
    c.fillStyle = th.mote;
    if (act === 2) for (let i = 0; i < 60; i++) { const sp = 22 + hash(i) * 34, r = 0.9 + hash(i * 4.4) * 1.5; ell(c, (hash(i * 3.7) * w + Math.sin(t * 0.8 + i) * 14 + t * 9) % w, (hash(i * 9.1) * h + t * sp) % h, r, r); c.fill(); }
    else for (let i = 0; i < 22; i++) { const r = 0.8 + hash(i * 4.4) * 1.3, drift = act === 1 ? t * (14 + hash(i) * 16) : Math.sin(t * 0.5 + i) * 18; c.globalAlpha = 0.35 + 0.45 * Math.abs(Math.sin(t * 1.3 + i * 2.1)); ell(c, (((hash(i * 3.7) * w + drift) % w) + w) % w, h * (0.3 + hash(i * 9.1) * 0.6) + Math.sin(t * 0.9 + i * 1.7) * 6, r, r); c.fill(); }
    c.globalAlpha = 1;
    c.save(); c.translate(jx, jy);

    const shadow = (x: number, half: number, k: number) => { c.fillStyle = th.shadow; c.globalAlpha = k; ell(c, x, s.ground + 9, half, Math.max(3, half * 0.15)); c.fill(); c.globalAlpha = 1; };
    /** The soft dome of Fluff around whoever has some. */
    const dome = (p: Spot, a: Actor) => {
      if (a.fluff <= 0) return;
      const r = Math.max(p.half, p.px * 0.56) * (1.08 + a.pop * 0.16), g = c.createRadialGradient(p.x, p.mid, r * 0.5, p.x, p.mid, r);
      g.addColorStop(0, 'rgba(160,215,255,0)'); g.addColorStop(0.82, 'rgba(160,215,255,0.16)'); g.addColorStop(1, 'rgba(210,238,255,0.5)');
      c.fillStyle = g; ell(c, p.x, p.mid, r, r * 0.92); c.fill();
      c.strokeStyle = `rgba(255,255,255,${0.35 + 0.2 * Math.sin(t * 3)})`; c.lineWidth = 1.6; c.beginPath(); c.ellipse(p.x, p.mid, r * 0.99, r * 0.91, 0, -2.4 + Math.sin(t) * 0.3, -1.2 + Math.sin(t) * 0.3); c.stroke();
    };

    // The chinchilla.
    const hx = s.hero.x + this.hero.lunge + (this.hero.shake ? Math.sin(t * 70) * 5 * this.hero.shake : 0);
    shadow(hx - s.hero.px * 0.08, s.hero.px * 0.62, 1);
    const heroArt = () => drawChinchilla(c, COATS[run.hero], hx, s.hero.y, { face: 1, h: s.hero.px, time: t, dizzy: run.hp > 0 && run.hp * 4 <= run.maxHp, moving: this.hero.lunge > 2, run: t * 20 });
    heroArt();
    if (this.hero.flash > 0) { c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = this.hero.flash * 0.7; heroArt(); c.restore(); }
    dome(s.hero, this.hero);
    this.bar(c, s.hero.x, s.ground + 22, clamp(s.hero.px * 0.95, 64, 124), this.hero, ['#8be88f', '#2f9e52'], f?.st, compact);

    // The predators.
    s.foes.forEach((p, i) => {
      const a = this.foes[i], x = f?.foes[i];
      if (!a || !x || a.fade <= 0) return;
      const look = FOES[x.kind].look, fx = p.x - a.lunge + (a.shake ? Math.sin(t * 70 + i) * 5 * a.shake : 0) + (a.fled ? (1 - a.fade) * 110 : 0), fy = p.y + (!a.alive && !a.fled ? (1 - a.fade) * 10 : 0);
      shadow(fx, p.half * (p.fly ? 0.6 : 0.82), a.fade * (p.fly ? 0.6 : 1));
      if (a.alive && (o.target === i || o.hover === i)) {
        const aimed = o.target === i, rx = Math.max(28, p.half * 0.95);
        c.save(); c.strokeStyle = aimed ? '#ffcf5a' : 'rgba(255,255,255,0.8)'; c.lineWidth = aimed ? 3 : 2; c.setLineDash(aimed ? [9, 6] : []); c.lineDashOffset = -t * 26; ell(c, p.x, s.ground + 9, rx, Math.max(6, rx * 0.2)); c.stroke(); c.restore();
        if (aimed) { c.fillStyle = 'rgba(255,207,90,0.16)'; ell(c, p.x, s.ground + 9, rx, Math.max(6, rx * 0.2)); c.fill(); }
      }
      c.save(); c.globalAlpha = a.fade; this.shaded(c, scale, look, fx, fy, p.px, t + i * 1.3, a.flash); c.restore();
      if (!a.alive) return;
      dome(p, a);
      const bw = clamp(p.px * 0.9, compact ? 46 : 60, 132);
      this.bar(c, p.x, s.ground + 22, bw, a, ['#ff8a76', '#c7332f'], x.st, compact);
      // What it will do next, once its own turn has finished playing.
      if (!this.waiting) {
        const it = run.intentOf(i), label = it.kind === 'attack' ? `${it.dmg}${it.hits > 1 ? `×${it.hits}` : ''}` : '', bob = Math.sin(t * 3 + i) * 2, tint = INTENT_TINT[it.kind];
        c.font = `900 15px ${FONT}`; c.textAlign = 'left'; c.textBaseline = 'middle';
        const lw = label ? c.measureText(label).width + 5 : 0, tw = 30 + lw + (label ? 4 : 0), th2 = 26, iy = Math.max(th2 / 2 + 4, p.top - 20 + bob), bx = p.x - tw / 2;
        const lit = o.hover === i || o.target === i;
        if (it.kind === 'attack') glow(c, p.x, iy, 26 + Math.sin(t * 5 + i) * 3, 'rgba(255,90,70,0.55)', 0.8);
        c.beginPath(); c.roundRect(bx, iy - th2 / 2, tw, th2, 9); c.moveTo(p.x - 5, iy + th2 / 2 - 0.5); c.lineTo(p.x, iy + th2 / 2 + 6); c.lineTo(p.x + 5, iy + th2 / 2 - 0.5);
        c.fillStyle = grad(c, iy - th2 / 2, iy + th2 / 2, [tint[0], 'rgba(22,14,32,0.96)']); c.fill();
        c.beginPath(); c.roundRect(bx, iy - th2 / 2, tw, th2, 9); c.strokeStyle = tint[1]; c.lineWidth = lit ? 2.4 : 1.5; c.stroke();
        intentIcon(c, it.kind, bx + 15, iy, 20);
        if (label) { c.strokeStyle = 'rgba(40,6,10,0.9)'; c.lineWidth = 3; c.lineJoin = 'round'; c.strokeText(label, bx + 28, iy + 1); c.fillStyle = '#fff'; c.fillText(label, bx + 28, iy + 1); }
        if (o.aiming && o.target !== i) { c.fillStyle = 'rgba(255,255,255,0.85)'; poly(c, [p.x - 6, iy - 27, p.x + 6, iy - 27, p.x, iy - 18]); c.fill(); }
        if (o.target === i) { c.fillStyle = '#ffcf5a'; const by = iy - 30 + Math.sin(t * 8) * 2.5; poly(c, [p.x - 9, by, p.x + 9, by, p.x, by + 12]); c.fill(); c.strokeStyle = INK; c.lineWidth = 1.2; c.stroke(); }
      }
    });

    // Claw marks, rings and stars where something has just landed.
    for (const x of this.fx) {
      const p = this.spot(x.who);
      if (!p) continue;
      const k = x.t / x.dur, r = Math.max(22, p.px * 0.5);
      c.save(); c.translate(p.x, p.mid);
      if (x.kind === 'slash') {
        c.rotate(-0.55 + (x.seed % 1) * 0.3); c.globalAlpha = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
        const reach = easeOut(Math.min(1, k * 2.2));
        for (const dy of [-0.34, 0, 0.34]) { const x0 = -r, x1 = -r + r * 2 * reach, y = dy * r; c.beginPath(); c.moveTo(x0, y); c.quadraticCurveTo((x0 + x1) / 2, y - r * 0.2, x1, y); c.quadraticCurveTo((x0 + x1) / 2, y + r * 0.06, x0, y); c.closePath(); c.fillStyle = x.color; c.shadowColor = x.color; c.shadowBlur = 10; c.fill(); }
      } else if (x.kind === 'ring') {
        c.globalAlpha = 1 - k; c.strokeStyle = x.color; c.lineWidth = 4 * (1 - k) + 1; ell(c, 0, 0, r * (0.5 + easeOut(k) * 0.9), r * (0.5 + easeOut(k) * 0.9) * 0.9); c.stroke();
      } else {
        c.globalAlpha = 1 - k; c.rotate(x.seed); const big = r * (0.5 + easeOut(k) * 0.9), pts: number[] = [];
        for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2, rr = i % 2 ? big * 0.38 : big; pts.push(Math.cos(a) * rr, Math.sin(a) * rr); }
        poly(c, pts); c.fillStyle = x.color; c.fill();
      }
      c.restore();
    }
    for (const b of this.bits) {
      const k = b.life / b.max;
      c.globalAlpha = clamp(k * 1.6, 0, 1); c.fillStyle = b.color;
      if (b.kind === 'dot') { ell(c, b.x, b.y, b.size * (0.5 + k * 0.5), b.size * (0.5 + k * 0.5)); c.fill(); }
      else if (b.kind === 'puff') { c.globalAlpha = clamp(k * 1.2, 0, 0.9); ell(c, b.x, b.y, b.size * (1.5 - k * 0.6), b.size * (1.5 - k * 0.6)); c.fill(); }
      else {
        c.save(); c.translate(b.x, b.y); c.rotate(b.rot);
        if (b.kind === 'star') { const z = b.size * (0.6 + k * 0.6); poly(c, [0, -z * 1.6, z * 0.4, -z * 0.4, z * 1.6, 0, z * 0.4, z * 0.4, 0, z * 1.6, -z * 0.4, z * 0.4, -z * 1.6, 0, -z * 0.4, -z * 0.4]); c.fill(); }
        else if (b.kind === 'plus') { c.rotate(-b.rot); c.fillRect(-b.size * 0.3, -b.size, b.size * 0.6, b.size * 2); c.fillRect(-b.size, -b.size * 0.3, b.size * 2, b.size * 0.6); }
        else c.fillRect(-b.size, -b.size * 0.4 * Math.cos(b.rot * 1.7), b.size * 2, b.size * 0.8 * Math.cos(b.rot * 1.7));
        c.restore();
      }
    }
    c.globalAlpha = 1;

    // Numbers and words floating off whoever they happened to.
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
    for (const fl of this.floats) {
      const p = fl.who === -1 ? s.hero : s.foes[fl.who];
      if (!p) continue;
      const number = /^[-+]\d+$/.test(fl.text), age = 1 - fl.life, rise = easeOut(Math.min(1, age * 1.6)) * 40, punch = number ? 1 + Math.max(0, 1 - age * 7) * 0.7 : 1;
      const size = number ? clamp(20 + fl.big * 0.6, 20, 34) : 13;
      c.globalAlpha = clamp(fl.life * 2.2, 0, 1);
      c.font = `900 ${size * punch}px ${FONT}`;
      const x = p.x + (number ? (fl.lane % 2 ? -1 : 1) * (10 + fl.lane * 9) * Math.min(1, age * 3) : 0), y = Math.max(14, p.top + (fl.who === -1 ? 6 : 14) - rise - fl.lane * 16);
      c.strokeStyle = 'rgba(20,12,30,0.92)'; c.lineWidth = number ? 5 : 3.5; c.strokeText(fl.text, x, y); c.fillStyle = fl.color; c.fillText(fl.text, x, y);
    }
    c.globalAlpha = 1;
    c.restore();
    if (this.banner.life > 0) {
      const k = clamp(this.banner.life * 2.5, 0, 1), text = this.banner.text.toUpperCase();
      c.globalAlpha = k; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.font = `900 15px ${FONT}`; const tw = c.measureText(text).width + 44, by = 12 + (1 - k) * -8;
      c.beginPath(); c.moveTo(w / 2 - tw / 2 - 10, by); c.lineTo(w / 2 + tw / 2 + 10, by); c.lineTo(w / 2 + tw / 2, by + 15); c.lineTo(w / 2 + tw / 2 + 10, by + 30); c.lineTo(w / 2 - tw / 2 - 10, by + 30); c.lineTo(w / 2 - tw / 2, by + 15); c.closePath();
      c.fillStyle = grad(c, by, by + 30, ['#4a3a78', '#261a3e']); c.fill(); c.strokeStyle = '#ffcf5a'; c.lineWidth = 1.5; c.stroke();
      c.fillStyle = '#ffe08a'; c.fillText(text, w / 2, by + 16);
      c.globalAlpha = 1;
    }
  }
}
