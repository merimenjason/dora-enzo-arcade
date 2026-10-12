// Whisker Saga's painted art, asked for by name. Original code drawings remain as loading fallbacks.
// docs/saga-art.md records the production assets, crop layout and exact imagegen prompts.
import { coatLike, drawChinchilla, COATS, type Coat } from './chinchilla-art';
import { HEROES, heroById, type EnemyKind, type Faction, type Role } from './saga-game';

export const PAINTED = true;
import { loadSagaPainting, sagaFigure, sagaPortrait, sagaLandscape } from './saga-paint';
export { sagaPaintVersion, sagaPaintReady, sagaPaintStats, sagaDecoration, sagaDecorationStats } from './saga-paint';
export const loadSagaArt = loadSagaPainting;
const ENEMY_ORDER: EnemyKind[] = ['grunt', 'slinger', 'sneak', 'brute', 'hexer', 'captain'];

// ── Heroes ──────────────────────────────────────────────────────────────────

export const FACTION_COLOR: Record<Faction, string> = { meadow: '#6fae4a', burrow: '#c9773a', summit: '#5b8fd6' };
export const RARITY_COLOR = ['', '#6aa7e0', '#b684e8', '#f0b53a'];
const dark = { eye: '#15121a', pupil: '#000000' };
const tone = (base: 'dora' | 'enzo', fur: string, back: string, face: string, shade: string, over: Partial<Coat> = {}): Coat =>
  coatLike(base, { fur, back, face, shade, texture: shade, tail: fur, tailOuter: back, tailInner: face, ear: base === 'enzo' ? fur : COATS.dora.ear, bands: false, paleLegs: false, ...over });

const HERO_COATS: Record<string, Coat> = {
  dora: COATS.dora, enzo: COATS.enzo,
  pip: tone('dora', '#ecd6b2', '#d6bc92', '#f6e9d0', '#c7ab7e', dark),
  mossy: tone('enzo', '#8c6c50', '#6b4f39', '#a8896d', '#775a43', { belly: '#e9dccb' }),
  clover: tone('dora', '#dcab7a', '#c08d5c', '#eecba3', '#b28052', dark),
  willow: tone('dora', '#f1e3c2', '#dccb9f', '#faf1dc', '#cdb98a', dark),
  aurora: tone('dora', '#fbe6e8', '#f2ccd1', '#fff5f6', '#e6bcc3'),
  bramble: tone('enzo', '#62504a', '#433530', '#7c6860', '#4f3f39', { belly: '#d9cdc4' }),
  cinder: tone('enzo', '#3d383f', '#27242a', '#58525c', '#302c33', { belly: '#8a8088', eye: '#f08a3c', pupil: '#5a2408' }),
  nutmeg: tone('enzo', '#b28c68', '#8f6c4c', '#caa887', '#9c7857', { belly: '#f0e4d4' }),
  ember: tone('enzo', '#b86841', '#904b2c', '#d28a63', '#9e5635', { belly: '#f3dfcf' }),
  onyx: tone('enzo', '#2d2a32', '#19181d', '#46434d', '#222027', { belly: '#5d5966', eye: '#f2b23a', pupil: '#6a4208', whisker: '#c9c6d2' }),
  flint: tone('enzo', '#8191a5', '#5e6d81', '#a3b1c2', '#6d7c90', { belly: '#e8eef4' }),
  frost: tone('dora', '#eef5fb', '#d6e4f0', '#f8fcff', '#c4d6e6', { eye: '#2f5d8f', pupil: '#0f2a47' }),
  pebble: tone('enzo', '#a9a7b0', '#8a8891', '#c4c2ca', '#96949d', { belly: '#f1f0f3' }),
  thistle: tone('enzo', '#a097ae', '#7c7190', '#b6aec2', '#8a809d', { belly: '#ece8f1', earIn: '#c4a9bd' }),
  gale: tone('enzo', '#7188ba', '#506697', '#95aad4', '#5e75a7', { belly: '#e6ecf7' }),
  zephyr: tone('dora', '#dedbec', '#bfbad6', '#f0eef8', '#aca6c8', { eye: '#5a3fa0', pupil: '#24124f' }),
};

/** The thing each role carries, in the chinchilla's 24-unit frame (facing right, feet at 0, y up is negative). */
const carry = (role: Role, tint: string, swing: number, glow: number) => (k: CanvasRenderingContext2D, bob: number) => {
  k.save();
  // A faction neckerchief.
  k.fillStyle = tint; k.strokeStyle = '#2a2230'; k.lineWidth = 0.5;
  k.beginPath(); k.moveTo(4.4, -9.6 + bob); k.lineTo(9.6, -9.2 + bob); k.lineTo(7.4, -5.6 + bob); k.closePath(); k.fill(); k.stroke();
  k.translate(11.4, -6 + bob); k.rotate(-swing * 0.9);
  k.lineCap = 'round'; k.lineJoin = 'round';
  if (role === 'guard') {
    k.fillStyle = tint; k.strokeStyle = '#2a2230'; k.lineWidth = 0.8;
    k.beginPath(); k.moveTo(-3.6, -5.2); k.lineTo(3.8, -5.2); k.lineTo(3.8, 0.6); k.quadraticCurveTo(0.1, 5.6, -3.6, 0.6); k.closePath(); k.fill(); k.stroke();
    k.fillStyle = '#f6e7b0'; k.beginPath(); k.arc(0.1, -1.6, 1.3, 0, Math.PI * 2); k.fill(); k.stroke();
  } else if (role === 'striker') {
    k.strokeStyle = '#2a2230'; k.lineWidth = 2.5; k.beginPath(); k.moveTo(-0.6, 0.6); k.lineTo(7.2, -9.2); k.stroke();
    k.strokeStyle = '#e8eef2'; k.lineWidth = 1.5; k.beginPath(); k.moveTo(0.6, -0.9); k.lineTo(7.2, -9.2); k.stroke();
    k.strokeStyle = tint; k.lineWidth = 1.7; k.beginPath(); k.moveTo(-1.6, -1.6); k.lineTo(1.8, 1.2); k.stroke();
  } else if (role === 'archer') {
    k.strokeStyle = '#2a2230'; k.lineWidth = 2.1; k.beginPath(); k.arc(-1, -2, 6, -1.15, 1.15); k.stroke();
    k.strokeStyle = '#a8763e'; k.lineWidth = 1.1; k.beginPath(); k.arc(-1, -2, 6, -1.15, 1.15); k.stroke();
    k.strokeStyle = '#f4f0e6'; k.lineWidth = 0.4; k.beginPath(); k.moveTo(1.45, -7.5); k.lineTo(1.45 - swing * 3, -2); k.lineTo(1.45, 3.5); k.stroke();
    k.strokeStyle = tint; k.lineWidth = 0.9; k.beginPath(); k.moveTo(-3 - swing * 3, -2); k.lineTo(6, -2); k.stroke();
  } else {
    const top = role === 'mage' ? -13.5 : -10.5;
    k.strokeStyle = '#2a2230'; k.lineWidth = 2; k.beginPath(); k.moveTo(1, 6); k.lineTo(1, top); k.stroke();
    k.strokeStyle = '#a8763e'; k.lineWidth = 1; k.beginPath(); k.moveTo(1, 6); k.lineTo(1, top); k.stroke();
    if (role === 'mage') {
      k.globalAlpha = 0.35 + glow * 0.4; k.fillStyle = tint; k.beginPath(); k.arc(1, top - 1.6, 3.6 + glow * 1.2, 0, Math.PI * 2); k.fill();
      k.globalAlpha = 1; k.fillStyle = '#fdfbf3'; k.strokeStyle = '#2a2230'; k.lineWidth = 0.6; k.beginPath(); k.arc(1, top - 1.6, 2, 0, Math.PI * 2); k.fill(); k.stroke();
    } else {
      // A healer's sprig: three round leaves.
      k.fillStyle = '#7cc15a'; k.strokeStyle = '#2a2230'; k.lineWidth = 0.6;
      for (const [dx, dy] of [[-1.9, -1.2], [1.9, -1.2], [0, -3.4]]) { k.beginPath(); k.arc(1 + dx, top + dy, 1.9, 0, Math.PI * 2); k.fill(); k.stroke(); }
      k.fillStyle = '#fff'; k.beginPath(); k.arc(1, top - 1.9, 0.7 + glow * 0.5, 0, Math.PI * 2); k.fill();
    }
  }
  k.restore();
};

export type HeroPose = { face?: 1 | -1; moving?: boolean; run?: number; swing?: number; glow?: number; dizzy?: boolean; silhouette?: boolean; motion?: boolean };

/** A hero with their feet on (x, base), `size` pixels tall. */
export function drawHero(c: CanvasRenderingContext2D, id: string, x: number, base: number, size: number, t: number, pose: HeroPose = {}) {
  const hero = heroById(id), i = HEROES.indexOf(hero), face = pose.face ?? 1;
  if (pose.silhouette) {
    c.save(); c.fillStyle = 'rgba(40,34,52,.55)';
    c.beginPath(); c.ellipse(x, base - size * 0.36, size * 0.34, size * 0.34, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(x + face * size * 0.2, base - size * 0.6, size * 0.2, size * 0.19, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(x + face * size * 0.14, base - size * 0.82, size * 0.09, size * 0.13, 0, 0, Math.PI * 2); c.fill();
    c.restore();
    return;
  }
  const bob = pose.motion ? (pose.moving ? Math.abs(Math.sin(pose.run ?? t * 8)) * size * .035 : Math.sin(t * 2) * size * .008) : 0;
  if (PAINTED && sagaFigure(c, id==='dora'?'hero-dora':'heroes-'+Math.floor(i/6), id==='dora'?0:i%6, x, base, size, face, pose.motion ? (pose.swing ?? 0)*.08 : 0, bob)) return;
  drawChinchilla(c, HERO_COATS[id], x, base, {
    face, h: size, time: t, moving: pose.moving, run: pose.run, dizzy: pose.dizzy,
    decorate: carry(hero.role, FACTION_COLOR[hero.faction], pose.swing ?? 0, pose.glow ?? 0),
  });
}

// ── Enemies ─────────────────────────────────────────────────────────────────

/** Body, dark, light and accent for each chapter's enemies. */
export const CHAPTER_TINT = [
  ['#7fa650', '#557a33', '#b5d28a', '#f0d264'], ['#8a6b4a', '#5e452c', '#b89a78', '#d65a4a'], ['#5f8f84', '#3d665c', '#93bdb2', '#d9c25a'], ['#b08355', '#7d5932', '#d6b08a', '#f2ede2'],
  ['#7b6a8f', '#544566', '#a898ba', '#e58f4a'], ['#8fb4d1', '#5f86a6', '#c5dcec', '#ffffff'], ['#b5553c', '#7f3324', '#de8a6c', '#ffcf5a'], ['#4d4a63', '#2e2c40', '#7d7a99', '#b48cff'],
];
const INK = '#241d2b';
export type EnemyPose = { wind?: number; hurt?: number; step?: number; motion?: boolean };

/** An enemy facing left with its feet on (x, base). `size` is the height of a scuttler; bigger kinds scale from it. */
export function drawEnemy(c: CanvasRenderingContext2D, kind: EnemyKind, chapter: number, x: number, base: number, size: number, t: number, pose: EnemyPose = {}) {
  c.save();c.fillStyle='rgba(33,22,28,.22)';c.beginPath();c.ellipse(x,base,size*(kind==='boss'?1:.45),size*.075,0,0,Math.PI*2);c.fill();c.restore();
  const wind=pose.wind??0;
  if(PAINTED && sagaFigure(c,kind==='boss'?(chapter<4?'bosses-0':'boss-'+chapter):'enemies',kind==='boss'?(chapter<4?chapter:0):ENEMY_ORDER.indexOf(kind),x,base,size*(kind==='boss'?2.2:kind==='captain'||kind==='brute'?1.5:1),1,pose.motion?-wind*.07:0,pose.motion?Math.abs(Math.sin(pose.step??0))*size*.025:0))return;
  const [body, shade, light, accent] = CHAPTER_TINT[chapter % CHAPTER_TINT.length];
  const s = size, step = Math.sin((pose.step ?? t * 5) * 1.6), bob = Math.abs(step) * 0.03;
  const el = (ex: number, ey: number, rx: number, ry: number, fill: string, rot = 0) => { c.beginPath(); c.ellipse(ex * s, ey * s, rx * s, ry * s, rot, 0, Math.PI * 2); c.fillStyle = fill; c.fill(); c.stroke(); };
  const eye = (ex: number, ey: number, r: number, angry = false) => {
    c.beginPath(); c.arc(ex * s, ey * s, r * s, 0, Math.PI * 2); c.fillStyle = '#fff'; c.fill(); c.stroke();
    c.beginPath(); c.arc((ex - r * 0.3) * s, ey * s, r * 0.5 * s, 0, Math.PI * 2); c.fillStyle = INK; c.fill();
    if (angry) { c.beginPath(); c.moveTo((ex - r * 1.4) * s, (ey - r * 0.4) * s); c.lineTo((ex + r * 1.2) * s, (ey - r * 1.5) * s); c.stroke(); }
  };
  const legs = (xs: number[], y: number, len: number) => { c.beginPath(); xs.forEach((lx, i) => { const k = (i % 2 ? step : -step) * 0.06; c.moveTo(lx * s, y * s); c.lineTo((lx - 0.06 + k) * s, (y + len) * s); }); c.stroke(); };
  c.save();
  c.translate(x, base); c.strokeStyle = INK; c.lineWidth = Math.max(1.4, s * 0.045); c.lineJoin = 'round'; c.lineCap = 'round';
  c.fillStyle = 'rgba(0,0,0,.2)'; c.beginPath(); c.ellipse(0, 0, s * (kind === 'boss' ? 1 : kind === 'brute' || kind === 'captain' ? 0.62 : 0.42), s * 0.08, 0, 0, Math.PI * 2); c.fill();
  // Winding up: lean back and swell.
  c.translate(wind * s * 0.08, 0); c.rotate(wind * 0.12); c.scale(1 + wind * 0.08, 1 + wind * 0.08);
  c.translate(0, -bob * s);
  if (kind === 'grunt' || kind === 'captain') {
    const k = kind === 'captain' ? 1.5 : 1;
    c.scale(k, k);
    legs([-0.24, -0.04, 0.18], -0.16, 0.16);
    el(0.04, -0.4, 0.4, 0.3, shade);
    c.beginPath(); c.ellipse(0.04 * s, -0.4 * s, 0.4 * s, 0.3 * s, 0, Math.PI * 1.05, Math.PI * 1.95); c.strokeStyle = light; c.stroke(); c.strokeStyle = INK;
    c.beginPath(); c.moveTo(0.04 * s, -0.7 * s); c.lineTo(0.04 * s, -0.12 * s); c.stroke();
    el(-0.38, -0.34, 0.2, 0.19, body);
    eye(-0.44, -0.4, 0.07, true);
    c.beginPath(); c.moveTo(-0.5 * s, -0.5 * s); c.quadraticCurveTo(-0.66 * s, -0.74 * s, -0.78 * s, -0.66 * s); c.moveTo(-0.4 * s, -0.52 * s); c.quadraticCurveTo(-0.48 * s, -0.8 * s, -0.62 * s, -0.82 * s); c.stroke();
    if (kind === 'captain') {
      // Stag horns and a crest in the chapter's accent colour.
      c.lineWidth *= 1.6; c.beginPath(); c.moveTo(-0.54 * s, -0.3 * s); c.quadraticCurveTo(-0.86 * s, -0.36 * s, -0.84 * s, -0.56 * s); c.moveTo(-0.54 * s, -0.24 * s); c.quadraticCurveTo(-0.9 * s, -0.16 * s, -0.92 * s, -0.36 * s); c.stroke(); c.lineWidth /= 1.6;
      c.fillStyle = accent; c.beginPath(); c.moveTo(-0.1 * s, -0.68 * s); c.lineTo(0.02 * s, -0.94 * s); c.lineTo(0.12 * s, -0.7 * s); c.lineTo(0.24 * s, -0.9 * s); c.lineTo(0.3 * s, -0.62 * s); c.closePath(); c.fill(); c.stroke();
    }
  } else if (kind === 'slinger') {
    const puff = 1 + Math.sin(t * 4) * 0.04;
    el(0.02, -0.28, 0.4 * puff, 0.28, body);
    el(-0.06, -0.2, 0.26, 0.16, light);
    el(-0.26, -0.56, 0.12, 0.12, body); el(0.04, -0.6, 0.12, 0.12, body);
    eye(-0.27, -0.57, 0.075); eye(0.03, -0.61, 0.075);
    c.beginPath(); c.moveTo(-0.38 * s, -0.3 * s); c.quadraticCurveTo(-0.16 * s, -0.2 * s, 0.1 * s, -0.32 * s); c.stroke();
    el(0.3, -0.06, 0.16, 0.06, shade); el(-0.2, -0.05, 0.12, 0.05, shade);
  } else if (kind === 'sneak') {
    c.beginPath(); c.moveTo(0.42 * s, -0.24 * s); c.quadraticCurveTo(0.8 * s, -0.3 * s, 0.74 * s, -0.62 * s); c.lineWidth *= 2.4; c.strokeStyle = INK; c.stroke(); c.lineWidth /= 2.4; c.strokeStyle = shade; c.lineWidth *= 1.2; c.stroke(); c.lineWidth /= 1.2; c.strokeStyle = INK;
    legs([-0.3, -0.12, 0.2, 0.36], -0.12, 0.12);
    el(0.04, -0.26, 0.46, 0.16, body, -0.08);
    el(-0.06, -0.2, 0.3, 0.07, light, -0.08);
    el(-0.46, -0.4, 0.17, 0.14, body, 0.2);
    el(-0.36, -0.55, 0.06, 0.07, shade);
    c.fillStyle = INK; c.beginPath(); c.ellipse(-0.5 * s, -0.43 * s, 0.13 * s, 0.05 * s, 0.2, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(-0.52 * s, -0.43 * s, 0.03 * s, 0, Math.PI * 2); c.fillStyle = accent; c.fill();
    c.beginPath(); c.arc(-0.63 * s, -0.36 * s, 0.03 * s, 0, Math.PI * 2); c.fillStyle = INK; c.fill();
  } else if (kind === 'brute') {
    c.scale(1.45, 1.45);
    legs([-0.26, 0.2], -0.14, 0.14);
    el(0.04, -0.46, 0.44, 0.38, shade);
    el(-0.02, -0.34, 0.3, 0.22, body);
    el(-0.36, -0.52, 0.24, 0.2, body);
    c.fillStyle = light; c.beginPath(); c.moveTo(-0.6 * s, -0.5 * s); c.quadraticCurveTo(-0.4 * s, -0.66 * s, -0.16 * s, -0.66 * s); c.lineTo(-0.16 * s, -0.56 * s); c.quadraticCurveTo(-0.4 * s, -0.56 * s, -0.58 * s, -0.44 * s); c.closePath(); c.fill(); c.stroke();
    eye(-0.4, -0.5, 0.055, true);
    c.beginPath(); c.arc(-0.6 * s, -0.46 * s, 0.04 * s, 0, Math.PI * 2); c.fillStyle = INK; c.fill();
    c.fillStyle = accent; for (const cx of [-0.44, -0.36, -0.28]) { c.beginPath(); c.moveTo(cx * s, -0.16 * s); c.lineTo((cx - 0.05) * s, -0.04 * s); c.lineTo((cx + 0.04) * s, -0.14 * s); c.closePath(); c.fill(); c.stroke(); }
  } else if (kind === 'hexer') {
    c.fillStyle = light; c.beginPath(); c.roundRect(-0.15 * s, -0.5 * s, 0.3 * s, 0.5 * s, 0.1 * s); c.fill(); c.stroke();
    c.fillStyle = body; c.beginPath(); c.moveTo(-0.44 * s, -0.44 * s); c.quadraticCurveTo(-0.4 * s, -0.98 * s, 0, -0.98 * s); c.quadraticCurveTo(0.4 * s, -0.98 * s, 0.44 * s, -0.44 * s); c.quadraticCurveTo(0, -0.56 * s, -0.44 * s, -0.44 * s); c.fill(); c.stroke();
    c.fillStyle = light; for (const [dx, dy, r] of [[-0.2, -0.7, 0.07], [0.1, -0.82, 0.06], [0.24, -0.62, 0.05]]) { c.beginPath(); c.arc(dx * s, dy * s, r * s, 0, Math.PI * 2); c.fill(); }
    eye(-0.07, -0.32, 0.05); eye(0.07, -0.32, 0.05);
    c.beginPath(); c.moveTo(-0.3 * s, 0); c.lineTo(-0.34 * s, -0.7 * s); c.stroke();
    c.globalAlpha = 0.4 + wind * 0.5; c.fillStyle = accent; c.beginPath(); c.arc(-0.34 * s, -0.76 * s, (0.11 + wind * 0.08) * s, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1;
    c.fillStyle = '#fff'; c.beginPath(); c.arc(-0.34 * s, -0.76 * s, 0.05 * s, 0, Math.PI * 2); c.fill(); c.stroke();
  } else {
    // A chapter boss: one big beast, told apart by its colours and what grows out of its head and back.
    c.scale(2.1, 2.1);
    legs([-0.3, -0.06, 0.24], -0.14, 0.14);
    if (chapter % 4 === 3) { c.fillStyle = light; c.globalAlpha = 0.8; c.beginPath(); c.ellipse(0.2 * s, -0.84 * s, 0.34 * s, 0.14 * s, -0.5 + Math.sin(t * 9) * 0.12, 0, Math.PI * 2); c.fill(); c.stroke(); c.globalAlpha = 1; }
    c.fillStyle = accent; for (let i = 0; i < 5; i++) { const a = Math.PI * (1.2 + i * 0.15), bx = 0.06 + Math.cos(a) * 0.46, by = -0.48 + Math.sin(a) * 0.4; c.beginPath(); c.moveTo((bx - 0.06) * s, by * s); c.lineTo((bx + Math.cos(a) * 0.16) * s, (by + Math.sin(a) * 0.16) * s); c.lineTo((bx + 0.07) * s, (by + 0.02) * s); c.closePath(); c.fill(); c.stroke(); }
    el(0.06, -0.48, 0.46, 0.4, shade);
    el(0, -0.36, 0.32, 0.24, body);
    el(-0.38, -0.5, 0.26, 0.24, body);
    eye(-0.46, -0.56, 0.07, true); eye(-0.28, -0.6, 0.06, true);
    c.fillStyle = '#fbf6e8';
    if (chapter % 2 === 0) { c.beginPath(); c.moveTo(-0.5 * s, -0.36 * s); c.quadraticCurveTo(-0.74 * s, -0.34 * s, -0.72 * s, -0.56 * s); c.quadraticCurveTo(-0.62 * s, -0.42 * s, -0.46 * s, -0.44 * s); c.closePath(); c.fill(); c.stroke(); }
    else for (const tx of [-0.56, -0.48, -0.4]) { c.beginPath(); c.moveTo(tx * s, -0.36 * s); c.lineTo((tx + 0.03) * s, -0.27 * s); c.lineTo((tx + 0.06) * s, -0.36 * s); c.closePath(); c.fill(); c.stroke(); }
    c.fillStyle = accent; c.beginPath(); c.moveTo(-0.52 * s, -0.72 * s); c.lineTo(-0.56 * s, -0.92 * s); c.lineTo(-0.44 * s, -0.8 * s); c.lineTo(-0.38 * s, -0.96 * s); c.lineTo(-0.3 * s, -0.8 * s); c.lineTo(-0.2 * s, -0.9 * s); c.lineTo(-0.22 * s, -0.7 * s); c.closePath(); c.fill(); c.stroke();
  }
  c.restore();
}
/** How tall each kind stands, in scuttler heights: where its health bar goes. */
export const ENEMY_HEIGHT: Record<EnemyKind, number> = { grunt: 0.8, slinger: 0.8, sneak: 0.7, brute: 1.3, hexer: 1.05, captain: 1.45, boss: 2.1 };

// ── Backdrops ───────────────────────────────────────────────────────────────

type Land = { sky: [string, string]; far: string; near: string; ground: [string, string]; path: string; deco: 'flowers' | 'trees' | 'reeds' | 'rocks' | 'stumps' | 'ice' | 'embers' | 'pillars'; decoColor: string };
const LANDS: Land[] = [
  { sky: ['#8fd0f2', '#e6f6d8'], far: '#9ccf84', near: '#74b560', ground: ['#86c268', '#5f9f4a'], path: '#e3cf9a', deco: 'flowers', decoColor: '#f7e36a' },
  { sky: ['#7fb7c9', '#dcecc4'], far: '#5f9368', near: '#40734c', ground: ['#5c8f4d', '#3f6c39'], path: '#b99a6c', deco: 'trees', decoColor: '#2f5a3a' },
  { sky: ['#8aa9a2', '#d2e2c8'], far: '#6c9486', near: '#4d7669', ground: ['#5f8c6c', '#41684f'], path: '#8fa27a', deco: 'reeds', decoColor: '#3b5e3c' },
  { sky: ['#f1c98c', '#fbe9c4'], far: '#c99a66', near: '#a97a4b', ground: ['#c8a06c', '#a27c4c'], path: '#ecd6a6', deco: 'rocks', decoColor: '#8a6a48' },
  { sky: ['#8f7fb4', '#e2c7c9'], far: '#6f5d8a', near: '#54446d', ground: ['#6d6a58', '#4e4b40'], path: '#a39a82', deco: 'stumps', decoColor: '#4a3a34' },
  { sky: ['#a9cdea', '#f2f8fc'], far: '#bfd7ea', near: '#9dbfdb', ground: ['#eaf3f9', '#c9dcea'], path: '#ffffff', deco: 'ice', decoColor: '#8cc4ea' },
  { sky: ['#3d2530', '#b5553c'], far: '#5a2d2c', near: '#40201f', ground: ['#4a2e2c', '#2f1c1c'], path: '#6b4a40', deco: 'embers', decoColor: '#ffb04a' },
  { sky: ['#1f1d33', '#55507a'], far: '#34304f', near: '#27243c', ground: ['#3c3955', '#28263b'], path: '#5a5676', deco: 'pillars', decoColor: '#6f6a94' },
];
const hash = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

/** The land the squad walks through. `scroll` is how far they have walked, in pixels; `horizon` is where the ground starts. */
export function drawBackdrop(c: CanvasRenderingContext2D, chapter: number, w: number, h: number, scroll: number, t: number, horizon: number) {
  if(PAINTED && sagaLandscape(c,chapter,w,h,scroll))return;
  const land = LANDS[chapter % LANDS.length];
  const sky = c.createLinearGradient(0, 0, 0, horizon); sky.addColorStop(0, land.sky[0]); sky.addColorStop(1, land.sky[1]);
  c.fillStyle = sky; c.fillRect(0, 0, w, horizon + 2);
  const hills = (color: string, amp: number, len: number, speed: number, lift: number) => {
    c.fillStyle = color; c.beginPath(); c.moveTo(0, horizon + 2);
    for (let x = 0; x <= w + 8; x += 8) { const u = (x + scroll * speed) / len; c.lineTo(x, horizon - lift - (Math.sin(u) * 0.6 + Math.sin(u * 2.3 + 1.7) * 0.4 + 1) * amp); }
    c.lineTo(w, horizon + 2); c.closePath(); c.fill();
  };
  hills(land.far, h * 0.07, w * 0.21, 0.12, h * 0.02); hills(land.near, h * 0.045, w * 0.13, 0.3, 0);
  const ground = c.createLinearGradient(0, horizon, 0, h); ground.addColorStop(0, land.ground[0]); ground.addColorStop(1, land.ground[1]);
  c.fillStyle = ground; c.fillRect(0, horizon, w, h - horizon);
  // The path, with stones that slide by to show the walking.
  const top = horizon + (h - horizon) * 0.2, bottom = h - (h - horizon) * 0.06;
  c.fillStyle = land.path; c.globalAlpha = 0.55; c.beginPath(); c.roundRect(-20, top, w + 40, bottom - top, 18); c.fill(); c.globalAlpha = 1;
  const gap = 46;
  c.fillStyle = 'rgba(0,0,0,.08)';
  for (let i = Math.floor(scroll / gap) - 1; i < (scroll + w) / gap + 1; i++) { const x = i * gap - scroll + hash(i) * 20, y = top + 8 + hash(i + 50) * (bottom - top - 16); c.beginPath(); c.ellipse(x, y, 5 + hash(i + 9) * 5, 2.4, 0, 0, Math.PI * 2); c.fill(); }
  // Things standing along the far edge of the path.
  const space = 92, u = Math.max(0.7, h / 360);
  for (let i = Math.floor(scroll * 0.8 / space) - 1; i < (scroll * 0.8 + w) / space + 1; i++) {
    if (hash(i + 7) < 0.25) continue;
    const x = i * space - scroll * 0.8 + hash(i) * 40, y = horizon + 4 + hash(i + 3) * (top - horizon - 6), k = (0.7 + hash(i + 5) * 0.6) * u;
    c.save(); c.translate(x, y); c.scale(k, k); c.fillStyle = land.decoColor; c.strokeStyle = 'rgba(30,24,40,.45)'; c.lineWidth = 1.2;
    if (land.deco === 'flowers') { c.strokeStyle = '#4f8a3c'; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -12); c.stroke(); c.fillStyle = hash(i + 2) < 0.5 ? land.decoColor : '#ffffff'; for (let p = 0; p < 5; p++) { c.beginPath(); c.arc(Math.cos(p * 1.256) * 3.4, -13 + Math.sin(p * 1.256) * 3.4, 2.4, 0, Math.PI * 2); c.fill(); } c.fillStyle = '#e98f3a'; c.beginPath(); c.arc(0, -13, 1.8, 0, Math.PI * 2); c.fill(); }
    else if (land.deco === 'trees') { c.fillStyle = '#5a4030'; c.fillRect(-3, -16, 6, 16); c.fillStyle = land.decoColor; for (const [dx, dy, r] of [[0, -30, 15], [-10, -22, 11], [10, -22, 11]]) { c.beginPath(); c.arc(dx, dy, r, 0, Math.PI * 2); c.fill(); } }
    else if (land.deco === 'reeds') { c.strokeStyle = land.decoColor; c.lineWidth = 2; for (const dx of [-5, 0, 5]) { const sway = Math.sin(t * 1.4 + i + dx) * 2; c.beginPath(); c.moveTo(dx, 0); c.quadraticCurveTo(dx, -14, dx + sway, -26); c.stroke(); c.fillStyle = '#6b4a34'; c.beginPath(); c.ellipse(dx + sway, -27, 2, 5, 0, 0, Math.PI * 2); c.fill(); } }
    else if (land.deco === 'rocks') { c.beginPath(); c.moveTo(-14, 0); c.lineTo(-8, -14); c.lineTo(3, -18); c.lineTo(13, -7); c.lineTo(15, 0); c.closePath(); c.fill(); c.stroke(); }
    else if (land.deco === 'stumps') { c.fillRect(-7, -12, 14, 12); c.fillStyle = '#8a7462'; c.beginPath(); c.ellipse(0, -12, 7, 3, 0, 0, Math.PI * 2); c.fill(); c.stroke(); }
    else if (land.deco === 'ice') { c.globalAlpha = 0.85; c.beginPath(); c.moveTo(-8, 0); c.lineTo(-3, -24); c.lineTo(2, -8); c.lineTo(7, -17); c.lineTo(10, 0); c.closePath(); c.fill(); c.stroke(); }
    else if (land.deco === 'embers') { c.fillStyle = '#2a1616'; c.beginPath(); c.moveTo(-12, 0); c.lineTo(-5, -15); c.lineTo(6, -12); c.lineTo(12, 0); c.closePath(); c.fill(); c.fillStyle = land.decoColor; c.globalAlpha = 0.5 + Math.sin(t * 3 + i) * 0.3; c.beginPath(); c.arc(0, -5, 3.4, 0, Math.PI * 2); c.fill(); }
    else { c.fillRect(-5, -36, 10, 36); c.strokeRect(-5, -36, 10, 36); c.fillRect(-8, -40, 16, 5); c.fillStyle = '#b48cff'; c.globalAlpha = 0.5 + Math.sin(t * 2 + i) * 0.25; c.beginPath(); c.arc(0, -22, 2.4, 0, Math.PI * 2); c.fill(); }
    c.restore();
  }
}

export function drawHeroPortrait(c:CanvasRenderingContext2D,id:string,size:number){return PAINTED && sagaPortrait(c,HEROES.indexOf(heroById(id)),size);}
