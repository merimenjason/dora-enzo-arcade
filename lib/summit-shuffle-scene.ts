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
const TALL: Record<Look['shape'], number> = { fox: 1, snake: 0.75, owl: 0.98, weasel: 0.68, hawk: 1, cougar: 0.88, skunk: 1.05, beetle: 0.7, armadillo: 0.74, lizard: 0.5, chin: 1 };

export function drawHeroIcon(c: C2D, hero: HeroId, w: number, h: number) {
  c.clearRect(0, 0, w, h);
  // The tail curls well out behind, so the body sits right of centre and small enough for the whole animal to fit.
  drawChinchilla(c, COATS[hero], w * 0.6, h * 0.94, { face: 1, h: h * 0.6, time: 0.4 });
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
  const bg = c.createRadialGradient(50, 22, 4, 50, 30, 70); bg.addColorStop(0, hi); bg.addColorStop(0.6, mid); bg.addColorStop(1, lo);
  c.fillStyle = bg; c.fillRect(0, 0, 100, 60);
  c.fillStyle = 'rgba(255,255,255,0.14)'; for (let i = 0; i < 9; i++) { ell(c, hash(i + art.length * 7) * 100, hash(i * 3 + 1) * 60, 1.2, 1.2); c.fill(); }
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
  c.restore();
}

// ---------- The fight ----------
type Actor = { hp: number; maxHp: number; fluff: number; alive: boolean; fade: number; flash: number; shake: number; lunge: number; fled: boolean };
type Anim = { dur: number; t: number; begun: boolean; foe: boolean; start?: () => void; tick?: (k: number) => void };
type Float = { who: number; text: string; color: string; life: number; lane: number };
type Spot = { x: number; y: number; px: number; top: number; fly: boolean };
const THEMES = [
  { sky: ['#8fd0f0', '#f6e9c4'], far: '#8fae8a', near: '#6f9a5a', ground: ['#b9c96a', '#7fa24a'], edge: '#5b7a38', snow: false },
  { sky: ['#f7b77a', '#f9e2b8'], far: '#b08a78', near: '#8d6652', ground: ['#c7a57e', '#96724f'], edge: '#6e5238', snow: false },
  { sky: ['#5f79b8', '#dfe9f6'], far: '#a9bbd6', near: '#8497b8', ground: ['#f4f8fd', '#c9d7ea'], edge: '#9db0cb', snow: true },
];
const INTENT_ICON: Record<Intent['kind'], string> = { attack: '⚔️', block: '🛡️', buff: '💪', hex: '🌀', sleep: '💤', flee: '💨', call: '📣', idle: '…' };

export class Stage {
  hero: Actor; foes: Actor[] = [];
  speed = 1;
  /** Called with a cue name as each event starts to play. */
  sfx: (name: string) => void = () => {};
  private queue: Anim[] = []; private floats: Float[] = []; private banner = { text: '', life: 0 };
  private inFoes = false; private backdrop: HTMLCanvasElement | null = null; private backdropKey = '';

  constructor(run: Run) { this.hero = this.fresh(run.hp, run.maxHp, 0, true); this.sync(run); }
  private fresh(hp: number, maxHp: number, fluff: number, alive: boolean): Actor { return { hp, maxHp, fluff, alive, fade: alive ? 1 : 0, flash: 0, shake: 0, lunge: 0, fled: false }; }
  /** Makes the picture match the engine exactly, dropping anything still to play. */
  sync(run: Run) {
    const f = run.fight;
    this.queue = []; this.inFoes = false;
    Object.assign(this.hero, { hp: run.hp, maxHp: run.maxHp, fluff: f?.fluff ?? 0, flash: 0, shake: 0, lunge: 0 });
    this.foes = (f?.foes ?? []).map((x) => ({ ...this.fresh(x.hp, x.maxHp, x.fluff, x.alive), fled: x.fled }));
  }
  get busy() { return this.queue.length > 0; }
  /** True while the predators' turn is still playing, when the hand should wait. */
  get waiting() { return this.queue.some((a) => a.foe); }
  flush(run: Run) { this.sync(run); this.floats = []; this.banner.life = 0; }

  private actor(who: number): Actor | undefined { return who === -1 ? this.hero : this.foes[who]; }
  private say(who: number, text: string, color: string) { this.floats.push({ who, text, color, life: 1, lane: this.floats.filter((f) => f.who === who && f.life > 0.55).length }); }
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
      case 'card': { const attack = CARDS[e.id].type === 'attack'; return { dur: attack ? 0.2 : 0.14, start: () => this.sfx(attack ? 'swing' : CARDS[e.id].type === 'power' ? 'power' : 'skill'), tick: (k) => { if (attack) this.hero.lunge = Math.sin(k * Math.PI) * 26; } }; }
      case 'hit': return { dur: 0.2, start: () => {
        const a = this.actor(e.to);
        if (!a) return;
        a.hp = e.hp; a.fluff = e.fluff;
        if (e.dmg > 0) { a.flash = 1; a.shake = 1; this.say(e.to, `-${e.dmg}`, e.from === -2 ? '#d7a6ff' : '#ff8f7a'); this.sfx(e.to === -1 ? 'hurt' : 'hit'); }
        else { this.say(e.to, 'Blocked', '#9fd8ff'); this.sfx('block'); }
      } };
      case 'fluff': return { dur: 0.1, start: () => { const a = this.actor(e.who); if (!a) return; a.fluff = e.fluff; if (e.n > 0) { this.say(e.who, `+${e.n} Fluff`, '#9fd8ff'); this.sfx('fluff'); } } };
      case 'st': return { dur: 0.1, start: () => { if (STATUS[e.id] && e.id !== 'rush') this.say(e.who, `${e.n > 0 ? '+' : ''}${e.n} ${STATUS[e.id].name}`, STATUS[e.id].bad === (e.n > 0) ? '#e9a8ff' : '#ffe08a'); } };
      case 'heal': return { dur: 0.15, start: () => { this.hero.hp = e.hp; this.hero.maxHp = Math.max(this.hero.maxHp, e.hp); this.say(-1, `+${e.n}`, '#9df09a'); this.sfx('heal'); } };
      case 'move': return { dur: e.attack ? 0.32 : 0.28, start: () => { this.say(e.who, e.name, '#ffffff'); const a = this.foes[e.who]; if (a) a.fluff = 0; this.sfx(e.attack ? 'growl' : 'skill'); }, tick: (k) => { const a = this.foes[e.who]; if (a && e.attack) a.lunge = Math.sin(k * Math.PI) * 30; } };
      case 'out': return { dur: 0.3, start: () => { const a = this.foes[e.who]; if (a) { a.alive = false; a.fled = e.fled; a.hp = e.fled ? a.hp : 0; } this.sfx(e.fled ? 'flee' : 'out'); } };
      case 'join': return { dur: 0.25, start: () => { const x = run.fight?.foes[e.who]; if (x) { this.foes[e.who] = this.fresh(x.maxHp, x.maxHp, 0, true); this.foes[e.who].fade = 0; } this.sfx('growl'); } };
      case 'add': return { dur: 0.1, start: () => this.say(-1, `+${e.n} ${CARDS[e.id].name}`, '#e9a8ff') };
      case 'seeds': return { dur: 0.1, start: () => this.say(-1, `${e.n > 0 ? '+' : ''}${e.n} seeds`, '#ffe08a') };
      case 'slip': return { dur: 0.1, start: () => this.say(-1, 'Fur slip!', '#ffe08a') };
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
      a.flash = Math.max(0, a.flash - dt * 4); a.shake = Math.max(0, a.shake - dt * 5);
      a.fade = clamp(a.fade + (a.alive ? dt * 5 : -dt * 3), 0, 1);
    }
    for (const f of this.floats) f.life -= dt * 0.9;
    this.floats = this.floats.filter((f) => f.life > 0);
    this.banner.life = Math.max(0, this.banner.life - dt * 0.9);
  }

  /** Where everyone stands on a canvas of this size. */
  private spots(w: number, h: number, run: Run, t: number): { ground: number; hero: Spot; foes: Spot[] } {
    const ground = Math.round(h * 0.74), narrow = w < 560, heroH = Math.min(clamp(h * 0.33, 60, 140), narrow ? w * 0.21 : 999);
    const hero: Spot = { x: w * (narrow ? 0.21 : 0.2), y: ground + 6, px: heroH, top: ground - heroH * 1.15, fly: false };
    // Each predator gets room in the line in proportion to its size, so a guardian is not squeezed down to its kits.
    const list = run.fight?.foes ?? [], x0 = w * (narrow ? 0.42 : 0.4), x1 = w * 0.985;
    const want = list.map((x) => { const look = FOES[x.kind].look; return Math.max(46, heroH * (look.h / 100) * 1.15 * WIDE[look.shape]); });
    const total = want.reduce((a, b) => a + b, 0) || 1, room = x1 - x0, squeeze = Math.min(1, room / total), gap = (room - total * squeeze) / Math.max(1, list.length);
    let at = x0;
    const foes = list.map((x, i) => {
      const look = FOES[x.kind].look, slot = want[i] * squeeze + gap, px = Math.min(heroH * (look.h / 100) * 1.15, (want[i] * squeeze * 0.98) / WIDE[look.shape], h * 0.6);
      const lift = look.fly ? px * 0.3 + Math.sin(t * 2.2 + i * 1.7) * 3 : 0, cx = at + slot / 2;
      at += slot;
      return { x: cx, y: ground + 6 + (i % 2) * 5 - lift, px, top: ground - lift - px * TALL[look.shape], fly: !!look.fly };
    });
    return { ground, hero, foes };
  }
  /** The foe drawn under a point, or -1. */
  foeAt(px: number, py: number, w: number, h: number, run: Run): number {
    const s = this.spots(w, h, run, 0);
    let best = -1, near = Infinity;
    s.foes.forEach((p, i) => {
      if (!run.fight?.foes[i]?.alive) return;
      const half = Math.max(30, p.px * WIDE[FOES[run.fight.foes[i].kind].look.shape] * 0.5), d = Math.abs(px - p.x);
      if (d <= half + 6 && py >= p.top - 44 && py <= s.ground + 56 && d < near) { near = d; best = i; }
    });
    return best;
  }

  private paintBackdrop(w: number, h: number, act: number, scale: number): HTMLCanvasElement {
    const key = `${w}|${h}|${act}|${scale}`;
    if (this.backdrop && this.backdropKey === key) return this.backdrop;
    const cv = this.backdrop ?? document.createElement('canvas'), th = THEMES[act % THEMES.length], ground = Math.round(h * 0.74);
    cv.width = Math.max(1, Math.round(w * scale)); cv.height = Math.max(1, Math.round(h * scale));
    const c = cv.getContext('2d')!;
    c.setTransform(scale, 0, 0, scale, 0, 0);
    const sky = c.createLinearGradient(0, 0, 0, ground); sky.addColorStop(0, th.sky[0]); sky.addColorStop(1, th.sky[1]);
    c.fillStyle = sky; c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(255,255,255,0.75)'; ell(c, w * 0.8, h * 0.16, h * 0.07, h * 0.07); c.fill();
    const range = (base: number, amp: number, seed: number, fill: string, caps: boolean) => {
      const pts: [number, number][] = [];
      for (let i = 0; i <= 14; i++) pts.push([(i / 14) * w, base - amp * (0.35 + hash(i * 3.1 + seed) * 0.65) * (i % 2 ? 1 : 0.45)]);
      c.beginPath(); c.moveTo(0, ground); for (const [x, y] of pts) c.lineTo(x, y); c.lineTo(w, ground); c.closePath(); c.fillStyle = fill; c.fill();
      if (caps) { c.fillStyle = 'rgba(255,255,255,0.9)'; for (let i = 1; i < pts.length - 1; i += 2) { const [x, y] = pts[i], k = amp * 0.16; poly(c, [x, y, x - k * 1.6, y + k * 1.5, x - k * 0.5, y + k * 1.1, x + k * 0.3, y + k * 1.7, x + k * 1.5, y + k * 1.4]); c.fill(); } }
    };
    range(ground - h * 0.1, h * 0.42, act * 7 + 1, th.far, act > 0);
    range(ground - h * 0.02, h * 0.26, act * 11 + 5, th.near, th.snow);
    const land = c.createLinearGradient(0, ground, 0, h); land.addColorStop(0, th.ground[0]); land.addColorStop(1, th.ground[1]);
    c.fillStyle = land; c.fillRect(0, ground, w, h - ground);
    c.fillStyle = th.edge; c.fillRect(0, ground, w, 2);
    for (let i = 0; i < 26; i++) {
      const x = hash(i * 5.3 + act) * w, y = ground + 6 + hash(i * 2.9 + act * 3) * (h - ground - 10), k = 0.6 + (y - ground) / (h - ground);
      if (act === 0) { c.strokeStyle = th.edge; c.lineWidth = 1.4; c.beginPath(); for (const dx of [-3, 0, 3]) { c.moveTo(x, y); c.lineTo(x + dx * k, y - 7 * k); } c.stroke(); }
      else if (act === 1) { c.fillStyle = i % 3 ? '#7d5c44' : '#a98a6c'; poly(c, [x - 6 * k, y, x - 2 * k, y - 5 * k, x + 4 * k, y - 4 * k, x + 7 * k, y]); c.fill(); }
      else { c.fillStyle = 'rgba(150,170,205,0.5)'; ell(c, x, y, 9 * k, 2.2 * k); c.fill(); }
    }
    this.backdrop = cv; this.backdropKey = key;
    return cv;
  }

  private bar(c: C2D, x: number, y: number, bw: number, a: Actor, color: string, st: Statuses | undefined, compact: boolean) {
    const bh = 13, shown = Math.max(0, a.hp);
    pill(c, x - bw / 2, y, bw, bh, 5); c.fillStyle = 'rgba(24,16,34,0.82)'; c.fill();
    if (shown > 0) { c.save(); pill(c, x - bw / 2, y, bw, bh, 5); c.clip(); c.fillStyle = color; c.fillRect(x - bw / 2, y, bw * clamp(shown / a.maxHp, 0, 1), bh); c.restore(); }
    pill(c, x - bw / 2, y, bw, bh, 5); c.strokeStyle = a.fluff > 0 ? '#8fd0ff' : 'rgba(255,255,255,0.45)'; c.lineWidth = a.fluff > 0 ? 2 : 1; c.stroke();
    c.font = '700 10px ui-sans-serif, system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#fff';
    c.fillText(compact && bw < 62 ? String(shown) : `${shown}/${a.maxHp}`, x + (a.fluff > 0 ? 6 : 0), y + bh / 2 + 0.5);
    if (a.fluff > 0) {
      const bx = x - bw / 2 - 2, by = y + bh / 2;
      c.beginPath(); c.moveTo(bx - 9, by - 9); c.lineTo(bx + 9, by - 9); c.lineTo(bx + 9, by + 2); c.quadraticCurveTo(bx + 8, by + 9, bx, by + 12); c.quadraticCurveTo(bx - 8, by + 9, bx - 9, by + 2); c.closePath();
      ink(c, '#4aa3e8', '#eaf6ff', 1.5);
      c.fillStyle = '#fff'; c.font = '800 11px ui-sans-serif, system-ui, sans-serif'; c.fillText(String(a.fluff), bx, by + 0.5);
    }
    if (!st) return;
    const ids = (Object.keys(st) as StatusId[]).filter((id) => st[id] && STATUS[id] && id !== 'rush');
    if (!ids.length) return;
    c.font = '700 11px ui-sans-serif, system-ui, sans-serif'; c.textBaseline = 'middle'; c.textAlign = 'left';
    const each = compact ? 24 : 27, perRow = Math.max(2, Math.floor((bw + 34) / each));
    ids.forEach((id, i) => {
      const row = Math.floor(i / perRow), inRow = Math.min(perRow, ids.length - row * perRow), sx = x - (inRow * each) / 2 + (i % perRow) * each, sy = y + bh + 10 + row * 15;
      c.fillStyle = '#fff'; c.fillText(STATUS[id].icon, sx, sy);
      const n = st[id]!;
      if (id !== 'den') { c.fillStyle = STATUS[id].bad ? '#ffb0e8' : TIMED.includes(id) ? '#ffb0e8' : '#ffe9a8'; c.strokeStyle = 'rgba(20,12,30,0.9)'; c.lineWidth = 2.5; c.strokeText(String(n), sx + 13, sy + 1); c.fillText(String(n), sx + 13, sy + 1); }
    });
  }

  /** `o.target` is the foe the chosen card is aimed at, `o.hover` the one under the pointer, `o.aiming` whether a card is waiting for a foe. */
  draw(c: C2D, w: number, h: number, scale: number, run: Run, t: number, o: { target: number; hover: number; aiming: boolean }) {
    const f = run.fight;
    c.setTransform(scale, 0, 0, scale, 0, 0);
    c.drawImage(this.paintBackdrop(w, h, run.act, scale), 0, 0, w, h);
    const s = this.spots(w, h, run, t), compact = w < 560;
    if (THEMES[run.act % THEMES.length].snow) { c.fillStyle = 'rgba(255,255,255,0.85)'; for (let i = 0; i < 46; i++) { const sp = 18 + hash(i) * 26; ell(c, (hash(i * 3.7) * w + Math.sin(t + i) * 10 + t * 6) % w, (hash(i * 9.1) * h + t * sp) % h, 1.4, 1.4); c.fill(); } }

    // The chinchilla.
    const hx = s.hero.x + this.hero.lunge + (this.hero.shake ? Math.sin(t * 70) * 4 * this.hero.shake : 0);
    c.save(); if (this.hero.flash > 0 && Math.floor(t * 30) % 2) c.globalAlpha = 0.55;
    drawChinchilla(c, COATS[run.hero], hx, s.hero.y, { face: 1, h: s.hero.px, time: t, dizzy: run.hp > 0 && run.hp * 4 <= run.maxHp, moving: this.hero.lunge > 2, run: t * 20 });
    c.restore();
    this.bar(c, s.hero.x, s.ground + 22, clamp(s.hero.px * 0.95, 64, 120), this.hero, '#57c26a', f?.st, compact);

    // The predators.
    s.foes.forEach((p, i) => {
      const a = this.foes[i], x = f?.foes[i];
      if (!a || !x || a.fade <= 0) return;
      const look = FOES[x.kind].look, fx = p.x - a.lunge + (a.shake ? Math.sin(t * 70 + i) * 4 * a.shake : 0) + (a.fled ? (1 - a.fade) * 90 : 0), fy = p.y + (!a.alive && !a.fled ? (1 - a.fade) * 10 : 0);
      if (p.fly) { c.fillStyle = 'rgba(20,12,30,0.18)'; ell(c, p.x, s.ground + 8, p.px * 0.4, 4); c.fill(); }
      if (a.alive && (o.target === i || o.hover === i)) { c.strokeStyle = o.target === i ? '#ffcf5a' : 'rgba(255,255,255,0.7)'; c.lineWidth = o.target === i ? 3 : 2; ell(c, p.x, s.ground + 9, Math.max(26, p.px * 0.5), 7); c.stroke(); }
      c.save(); c.globalAlpha = a.fade * (a.flash > 0 && Math.floor(t * 30) % 2 ? 0.55 : 1);
      drawFoe(c, look, fx, fy, p.px, t + i * 1.3);
      c.restore();
      if (!a.alive) return;
      const bw = clamp(p.px * 0.9, compact ? 46 : 58, 128);
      this.bar(c, p.x, s.ground + 22, bw, a, '#e0564a', x.st, compact);
      // What it will do next, once its own turn has finished playing.
      if (!this.waiting) {
        const it = run.intentOf(i), label = `${INTENT_ICON[it.kind]}${it.kind === 'attack' ? ` ${it.dmg}${it.hits > 1 ? `×${it.hits}` : ''}` : ''}`, bob = Math.sin(t * 3 + i) * 2;
        c.font = '800 13px ui-sans-serif, system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
        const tw = c.measureText(label).width + 14, iy = Math.max(14, p.top - 18 + bob);
        pill(c, p.x - tw / 2, iy - 11, tw, 22); c.fillStyle = it.kind === 'attack' ? 'rgba(96,22,22,0.88)' : 'rgba(26,18,38,0.85)'; c.fill();
        c.strokeStyle = it.kind === 'attack' ? '#ff9c8a' : 'rgba(255,255,255,0.5)'; c.lineWidth = 1.2; c.stroke();
        c.fillStyle = '#fff'; c.fillText(label, p.x, iy + 1);
        if (o.aiming && o.target !== i) { c.fillStyle = 'rgba(255,255,255,0.85)'; poly(c, [p.x - 6, iy - 24, p.x + 6, iy - 24, p.x, iy - 15]); c.fill(); }
        if (o.target === i) { c.fillStyle = '#ffcf5a'; const by = iy - 26 + Math.sin(t * 8) * 2; poly(c, [p.x - 8, by, p.x + 8, by, p.x, by + 11]); c.fill(); c.strokeStyle = INK; c.lineWidth = 1; c.stroke(); }
      }
    });

    // Numbers and words floating off whoever they happened to.
    c.textAlign = 'center'; c.textBaseline = 'middle';
    for (const fl of this.floats) {
      const p = fl.who === -1 ? s.hero : s.foes[fl.who];
      if (!p) continue;
      const big = /^[-+]\d+$/.test(fl.text), rise = (1 - fl.life) * 34;
      c.globalAlpha = clamp(fl.life * 2.2, 0, 1);
      c.font = `800 ${big ? 22 : 13}px ui-sans-serif, system-ui, sans-serif`;
      const y = Math.max(12, p.top + (fl.who === -1 ? 6 : 14) - rise - fl.lane * 15);
      c.strokeStyle = 'rgba(20,12,30,0.9)'; c.lineWidth = 3.5; c.strokeText(fl.text, p.x, y); c.fillStyle = fl.color; c.fillText(fl.text, p.x, y);
    }
    c.globalAlpha = 1;
    if (this.banner.life > 0) {
      c.globalAlpha = clamp(this.banner.life * 2.5, 0, 1);
      c.font = '800 16px ui-monospace, monospace'; const tw = c.measureText(this.banner.text).width + 28;
      pill(c, w / 2 - tw / 2, 10, tw, 28); c.fillStyle = 'rgba(26,18,38,0.82)'; c.fill();
      c.fillStyle = '#ffcf5a'; c.fillText(this.banner.text.toUpperCase(), w / 2, 25);
      c.globalAlpha = 1;
    }
  }
}
