// The arcade's predators in Canvas 2D, side-on, shared by the 2D games so a fox looks the same everywhere.
// Each is drawn in a 24-unit frame with the feet at (0, 0) facing right; callers scale it to their own pixels and
// may pass their own tint to make a relative (a viper from the snake, a condor from the hawk).
export type PredKind = 'fox' | 'snake' | 'owl' | 'weasel' | 'badger' | 'hawk' | 'cougar' | 'mole' | 'skunk' | 'bear';
type C2D = CanvasRenderingContext2D;
const INK = '#2c2430';
const ell = (c: C2D, x: number, y: number, rx: number, ry: number, rot = 0) => { c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2); };
const poly = (c: C2D, pts: number[]) => { c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.closePath(); };
const ink = (c: C2D, fill: string | CanvasGradient, line = INK, w = 1.3) => { c.lineJoin = 'round'; c.strokeStyle = line; c.lineWidth = w; c.stroke(); c.fillStyle = fill; c.fill(); };

export type Tint = { body: string; dark: string; light: string; eye: string };
export const TINT: Record<PredKind, Tint> = {
  fox: { body: '#e58436', dark: '#3a2a2a', light: '#fff4e4', eye: '#1a1418' },
  snake: { body: '#5fae55', dark: '#3c7d3a', light: '#cdeaa0', eye: '#ffe066' },
  owl: { body: '#8a6a4c', dark: '#6b4f3a', light: '#e9d9bd', eye: '#ffd23e' },
  weasel: { body: '#a8794e', dark: '#4a3324', light: '#f6ead6', eye: '#16121a' },
  badger: { body: '#8b8a94', dark: '#2a272e', light: '#f4f1ea', eye: '#f4f1ea' },
  hawk: { body: '#7c5a3e', dark: '#4a3526', light: '#ead9bf', eye: '#ffcf3e' },
  cougar: { body: '#c9995a', dark: '#8a6234', light: '#f5ead8', eye: '#c8e060' },
  mole: { body: '#6b5a66', dark: '#4a3d48', light: '#e8c9c0', eye: '#16121a' },
  skunk: { body: '#2e2a33', dark: '#1c1920', light: '#f4f1ea', eye: '#f4f1ea' },
  bear: { body: '#7a5236', dark: '#4a2f1e', light: '#d9b892', eye: '#1a1418' },
};
const ALPHA: Partial<Tint> = { eye: '#ff4a3a' };
export const shade = (hex: string, k: number) => { const n = parseInt(hex.slice(1), 16), f = (v: number) => Math.max(0, Math.min(255, Math.round(v * k))); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; };
export const tintOf = (kind: PredKind, alpha: boolean): Tint => (alpha ? { ...TINT[kind], body: shade(TINT[kind].body, 0.72), dark: shade(TINT[kind].dark, 0.7), ...ALPHA } : TINT[kind]);

/** A predator in a 24-unit frame, feet at (0, 0), facing right. */
export function predator(c: C2D, kind: PredKind, p: Tint, t: number) {
  const eye = (x: number, y: number, r: number) => { c.fillStyle = p.eye; ell(c, x, y, r, r); c.fill(); if (p.eye !== '#1a1418' && p.eye !== '#16121a') { c.fillStyle = '#16121a'; ell(c, x + r * 0.2, y, r * 0.42, r * 0.8); c.fill(); } };
  const legs = (xs: number[], h: number, w = 2.4) => { for (const x of xs) { c.beginPath(); c.rect(x - w / 2, -h, w, h); ink(c, p.dark, INK, 0.9); } };
  if (kind === 'fox') {
    const wag = Math.sin(t * 4) * 0.15;
    ell(c, -12, -9, 7, 3.4, -0.5 + wag); ink(c, p.body);
    ell(c, -16.5, -11.5 + wag * 6, 2.6, 2.2, -0.5); ink(c, p.light, INK, 1);
    legs([-5, 5], 4.5);
    ell(c, 0, -8.5, 9.5, 5.6); ink(c, p.body);
    c.fillStyle = p.light; ell(c, 3, -5.6, 5, 2.2); c.fill();
    poly(c, [5, -18, 6.5, -24, 9.5, -18.5]); ink(c, p.body); poly(c, [9, -18.5, 12, -24, 13.5, -17.5]); ink(c, p.body);
    poly(c, [4, -15, 12, -19, 19, -11.5, 12, -9, 5, -10]); ink(c, p.body);
    c.fillStyle = p.light; poly(c, [8, -12.5, 18, -11.6, 12, -9.4]); c.fill();
    c.fillStyle = '#1a1418'; ell(c, 18.6, -11.7, 1.1, 0.9); c.fill();
    eye(11.5, -14.6, 1.3);
    c.strokeStyle = INK; c.lineWidth = 0.8; c.beginPath(); c.moveTo(9.4, -17); c.lineTo(13, -15.8); c.stroke();
  } else if (kind === 'snake') {
    const sway = Math.sin(t * 2.5) * 1.2;
    ell(c, 0, -3, 10, 3.4); ink(c, p.dark); ell(c, -0.5, -6.6, 7.6, 3); ink(c, p.body);
    c.beginPath(); c.moveTo(-3, -8); c.quadraticCurveTo(-3, -17, 5 + sway, -17); c.lineTo(6 + sway, -12.5); c.quadraticCurveTo(2, -12.5, 2, -7); c.closePath(); ink(c, p.body);
    c.fillStyle = p.light; ell(c, 0.4, -10, 1.3, 3); c.fill();
    ell(c, 7.5 + sway, -15, 4.4, 3); ink(c, p.body);
    c.strokeStyle = '#d8374a'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(11.6 + sway, -14.6); c.lineTo(15 + sway, -14.6); c.lineTo(16.4 + sway, -16); c.moveTo(15 + sway, -14.6); c.lineTo(16.4 + sway, -13.4); c.stroke();
    eye(8.6 + sway, -16, 1.2);
    c.fillStyle = p.light; for (const [dx, dy] of [[-5, -3], [0, -2.4], [5, -3], [-2, -6.6], [3, -6.6]]) { ell(c, dx, dy, 1.2, 0.6); c.fill(); }
  } else if (kind === 'owl') {
    const flap = Math.sin(t * 6) * 0.5;
    ell(c, -9, -13, 9, 3.6, 0.5 + flap); ink(c, p.dark); ell(c, 9, -13, 9, 3.6, -0.5 - flap); ink(c, p.dark);
    ell(c, 0, -11, 7.2, 9); ink(c, p.body);
    c.fillStyle = p.light; ell(c, 0.6, -8, 4.6, 5.4); c.fill();
    c.strokeStyle = p.body; c.lineWidth = 0.6; for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(0.6, -8.5 + i * 2.2, 2.4, 0.3, Math.PI - 0.3); c.stroke(); }
    poly(c, [-6, -18, -6.5, -23, -2.5, -19.5]); ink(c, p.dark); poly(c, [6, -18, 6.5, -23, 2.5, -19.5]); ink(c, p.dark);
    for (const ex of [-2.6, 3.2]) { ell(c, ex, -15, 2.5, 2.5); ink(c, p.eye, INK, 0.9); c.fillStyle = '#16121a'; ell(c, ex + 0.4, -15, 1.1, 1.1); c.fill(); }
    poly(c, [-0.6, -13.2, 1.8, -13.2, 0.6, -10.8]); ink(c, '#e8963a', INK, 0.7);
  } else if (kind === 'weasel') {
    const wag = Math.sin(t * 5) * 0.2;
    ell(c, -13, -5.5, 5.5, 1.9, -0.25 + wag); ink(c, p.body); ell(c, -17.6, -6.9 + wag * 4, 2.2, 1.5, -0.25); ink(c, p.dark, INK, 0.9);
    legs([-6.5, -3.5, 4, 7], 3.2, 2);
    ell(c, 0, -5.6, 10.5, 3.7); ink(c, p.body);
    c.fillStyle = p.light; ell(c, 1.5, -4, 8, 1.7); c.fill();
    ell(c, 9.2, -9, 4.2, 3.5, -0.6); ink(c, p.body);
    ell(c, 10.4, -14.6, 1.5, 1.5); ink(c, p.body, INK, 0.9);
    ell(c, 12.4, -11.6, 3.9, 3.1, -0.1); ink(c, p.body);
    c.fillStyle = p.light; ell(c, 13.6, -10.2, 2.6, 1.5); c.fill();
    c.fillStyle = '#16121a'; ell(c, 16, -11.4, 0.9, 0.8); c.fill();
    eye(13, -12.6, 1);
  } else if (kind === 'badger') {
    ell(c, -12, -6, 3.2, 2.2); ink(c, p.body);
    legs([-7, -3, 4, 8], 3.6, 3);
    ell(c, -1, -7.6, 11.5, 7); ink(c, p.body);
    c.fillStyle = shade(p.body, 0.8); ell(c, -2, -3.6, 9, 2.6); c.fill();
    ell(c, 6.6, -13.2, 1.9, 1.9); ink(c, p.dark, p.light, 1);
    ell(c, 10.5, -7.6, 6.2, 5.2); ink(c, p.light);
    c.fillStyle = p.dark; poly(c, [16.4, -8.2, 6, -13, 5, -10, 15.4, -6.4]); c.fill(); poly(c, [16, -5.4, 8, -4.2, 7, -2.6, 15, -4.2]); c.fill();
    ell(c, 16.4, -7, 1.3, 1.1); c.fill();
    c.fillStyle = p.eye; ell(c, 10.8, -9.9, 0.9, 0.9); c.fill();
  } else if (kind === 'hawk') {
    const flap = Math.sin(t * 5) * 3;
    poly(c, [-3, -11, -12, -19 - flap, -1, -15]); ink(c, p.dark);
    poly(c, [-7, -10, -16, -8, -15.5, -12.5]); ink(c, p.body);
    c.strokeStyle = p.light; c.lineWidth = 0.9; c.beginPath(); c.moveTo(-12, -9.2); c.lineTo(-11.6, -11.6); c.stroke();
    ell(c, 0, -10, 8.4, 4.6, -0.15); ink(c, p.body);
    c.fillStyle = p.light; ell(c, 2.4, -8.4, 5, 2.2, -0.15); c.fill();
    ell(c, 8, -13.4, 3.7, 3.5); ink(c, p.light);
    poly(c, [11, -14.4, 15, -13, 13.6, -11.4, 11.2, -11.8]); ink(c, '#f2b93b', INK, 0.8);
    eye(8.8, -14, 1.2);
    c.strokeStyle = INK; c.lineWidth = 0.8; c.beginPath(); c.moveTo(6.6, -15.8); c.lineTo(10.6, -15); c.stroke();
    poly(c, [2, -12.5, -6, -24 - flap * 1.4, 6, -15.5]); ink(c, p.dark);
    c.strokeStyle = '#f2b93b'; c.lineWidth = 1; c.beginPath(); c.moveTo(0, -5.8); c.lineTo(1, -3.4); c.moveTo(3, -5.8); c.lineTo(4.2, -3.4); c.stroke();
  } else if (kind === 'mole') {
    ell(c, 0, -1.5, 12, 3.6); ink(c, '#8d6a4c', '#4a3526', 1);
    ell(c, 0, -7, 8.5, 6.2); ink(c, p.body);
    c.fillStyle = p.light; ell(c, 2, -4.4, 5, 2); c.fill();
    ell(c, 7.4, -8, 4.6, 3.8); ink(c, p.body);
    poly(c, [10.6, -9.6, 15.2, -7.8, 10.8, -6.4]); ink(c, p.light, INK, 0.9);
    c.fillStyle = '#ff8fa8'; ell(c, 15, -7.8, 1.3, 1.1); c.fill();
    eye(8.4, -9.6, 0.8);
    for (const fx of [-6, 6]) { poly(c, [fx - 2.6, -3, fx - 3.4, 0.6, fx - 1.2, -1.2, fx, 0.9, fx + 1.2, -1.2, fx + 3.4, 0.6, fx + 2.6, -3]); ink(c, p.light, INK, 0.8); }
  } else if (kind === 'skunk') {
    const wag = Math.sin(t * 3) * 0.12;
    c.save(); c.translate(-8, -8); c.rotate(wag);
    c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(-12, -4, -8, -17); c.quadraticCurveTo(-2, -22, 2, -15); c.quadraticCurveTo(-4, -10, 3, -2); c.closePath(); ink(c, p.body);
    c.strokeStyle = p.light; c.lineWidth = 2.4; c.lineCap = 'round'; c.beginPath(); c.moveTo(-1, -3); c.quadraticCurveTo(-7, -8, -3, -16); c.stroke(); c.restore();
    legs([-5, 5], 3.6, 2.6);
    ell(c, 0, -7, 9.5, 5.4); ink(c, p.body);
    c.strokeStyle = p.light; c.lineWidth = 2.2; c.lineCap = 'round'; c.beginPath(); c.moveTo(-8, -10); c.quadraticCurveTo(0, -13.4, 8, -11); c.stroke();
    ell(c, 10.4, -9.4, 4.6, 4); ink(c, p.body);
    c.strokeStyle = p.light; c.lineWidth = 1.4; c.beginPath(); c.moveTo(8.4, -12.6); c.lineTo(13.6, -9.6); c.stroke(); c.lineCap = 'butt';
    ell(c, 8.6, -13.6, 1.5, 1.6); ink(c, p.body, INK, 0.9);
    c.fillStyle = '#16121a'; ell(c, 14.8, -9, 1, 0.9); c.fill();
    eye(11.4, -10.4, 1);
  } else if (kind === 'bear') {
    legs([-8.5, -4.5, 4, 8.5], 5.2, 4);
    ell(c, -13, -11, 2.2, 2.2); ink(c, p.body, INK, 1);
    ell(c, -1, -10.5, 13, 7.6); ink(c, p.body);
    c.fillStyle = shade(p.body, 0.82); ell(c, -2, -5.6, 10, 2.8); c.fill();
    for (const ex of [7.6, 13.6]) { ell(c, ex, -20.4, 2.4, 2.4); ink(c, p.body, INK, 1); c.fillStyle = p.dark; ell(c, ex, -20.2, 1.1, 1.1); c.fill(); }
    ell(c, 10.6, -14.6, 6.4, 5.8); ink(c, p.body);
    ell(c, 14.6, -12.8, 3.4, 2.7); ink(c, p.light, INK, 0.8);
    c.fillStyle = '#2a1c18'; ell(c, 16.6, -13.6, 1.4, 1.1); c.fill();
    eye(11.2, -16, 1.2);
    c.strokeStyle = INK; c.lineWidth = 0.9; c.beginPath(); c.moveTo(8.8, -18.2); c.lineTo(13.2, -17.2); c.stroke();
  } else {
    const sway = Math.sin(t * 2) * 1.5;
    c.strokeStyle = INK; c.lineWidth = 4.2; c.lineCap = 'round'; c.beginPath(); c.moveTo(-11, -9); c.quadraticCurveTo(-21, -7, -20, -14 + sway); c.stroke();
    c.strokeStyle = p.body; c.lineWidth = 2.6; c.stroke(); c.lineCap = 'butt';
    legs([-7.5, -4, 4.5, 8], 5.4, 3.2);
    ell(c, 0, -9.2, 12, 6.2); ink(c, p.body);
    c.fillStyle = p.light; ell(c, 1.5, -5.6, 8, 2.4); c.fill();
    for (const ex of [8.2, 13.2]) { ell(c, ex, -18.6, 2, 2.1); ink(c, p.body, INK, 1); }
    ell(c, 11, -13.4, 5.8, 5.4); ink(c, p.body);
    ell(c, 14.4, -11.8, 3.1, 2.5); ink(c, p.light, INK, 0.8);
    c.fillStyle = '#5a3a3a'; poly(c, [15.8, -13, 17.4, -13, 16.6, -11.8]); c.fill();
    eye(11.4, -14.6, 1.4);
    c.strokeStyle = INK; c.lineWidth = 0.9; c.beginPath(); c.moveTo(8.8, -17); c.lineTo(13.4, -15.8); c.stroke();
    c.lineWidth = 0.4; c.beginPath(); for (const a of [-0.2, 0.15]) { c.moveTo(15.6, -11.4); c.lineTo(20.5, -11.4 + a * 9); } c.stroke();
  }
}

/** Smaller creatures that are not predators in every game: same frame, feet at (0, 0), facing right. */
export type CritterKind = 'beetle' | 'armadillo' | 'lizard';
export function critter(c: C2D, kind: CritterKind, p: Tint, t: number) {
  const legs = (xs: number[], h: number, lean: number) => { c.strokeStyle = INK; c.lineWidth = 1.5; c.lineCap = 'round'; c.beginPath(); for (const x of xs) { c.moveTo(x, -h); c.lineTo(x + lean, 0); } c.stroke(); c.lineCap = 'butt'; };
  if (kind === 'beetle') {
    const tick = Math.sin(t * 7) * 0.6;
    legs([-6, -1, 4], 5, -1.5 + tick); legs([-4, 1, 6], 5, 1.5 - tick);
    ell(c, -1, -8.5, 9.5, 7.5); ink(c, p.body);
    c.strokeStyle = p.dark; c.lineWidth = 1; c.beginPath(); c.moveTo(-1, -16); c.lineTo(-1, -1.2); c.stroke();
    c.fillStyle = p.light; for (const [dx, dy] of [[-5, -11], [-5.5, -6], [3, -11], [3.5, -6]]) { ell(c, dx, dy, 1.5, 1.2); c.fill(); }
    ell(c, 8.4, -7, 4, 3.8); ink(c, p.dark);
    c.strokeStyle = INK; c.lineWidth = 0.9; c.beginPath(); c.moveTo(10.5, -9.5); c.quadraticCurveTo(13, -14, 15.5, -13 + tick); c.moveTo(11.5, -8.5); c.quadraticCurveTo(15, -11, 17, -9 - tick); c.stroke();
    c.fillStyle = p.light; ell(c, 9.6, -7.6, 1, 1); c.fill();
  } else if (kind === 'armadillo') {
    poly(c, [-10, -6, -18, -3.5, -10, -3]); ink(c, p.body);
    c.beginPath(); for (const x of [-6, -2, 4, 8]) c.rect(x - 1.3, -4, 2.6, 4); ink(c, p.dark, INK, 0.9);
    c.beginPath(); c.moveTo(-11, -3.5); c.quadraticCurveTo(-10, -17, 0, -17); c.quadraticCurveTo(10, -17, 11, -3.5); c.closePath(); ink(c, p.body);
    c.strokeStyle = p.dark; c.lineWidth = 0.9; c.beginPath(); for (const x of [-6, -2.5, 1, 4.5, 8]) { c.moveTo(x, -4); c.quadraticCurveTo(x - 1.5, -11, x - 0.5, -16.2 + Math.abs(x) * 0.25); } c.stroke();
    poly(c, [9, -11, 18.5, -5.5, 10, -4]); ink(c, p.light);
    poly(c, [9.5, -11, 9, -16, 12, -11.5]); ink(c, p.body, INK, 0.9);
    c.fillStyle = p.eye; ell(c, 12.6, -8.2, 0.9, 0.9); c.fill();
    c.fillStyle = '#16121a'; ell(c, 18.2, -5.6, 0.8, 0.7); c.fill();
  } else {
    const sway = Math.sin(t * 3) * 1.6;
    c.strokeStyle = INK; c.lineWidth = 4.4; c.lineCap = 'round'; c.beginPath(); c.moveTo(-7, -4.5); c.quadraticCurveTo(-15, -4, -19, -8 + sway); c.stroke();
    c.strokeStyle = p.body; c.lineWidth = 2.8; c.stroke(); c.lineCap = 'butt';
    legs([-5, 5], 4, -3); legs([-3, 7], 4, 3);
    ell(c, 0, -5.4, 9.6, 3.6); ink(c, p.body);
    c.fillStyle = p.light; ell(c, 1, -4, 7, 1.5); c.fill();
    c.fillStyle = p.dark; for (const x of [-6, -3, 0, 3, 6]) { poly(c, [x - 1.1, -8.6, x, -10.8, x + 1.1, -8.6]); c.fill(); }
    ell(c, 10.4, -7.4, 4.4, 3.1, -0.2); ink(c, p.body);
    c.fillStyle = p.eye; ell(c, 11.6, -8.6, 1.1, 1.1); c.fill(); c.fillStyle = '#16121a'; ell(c, 11.8, -8.6, 0.4, 0.9); c.fill();
    c.strokeStyle = '#d8374a'; c.lineWidth = 0.7; c.beginPath(); c.moveTo(14.4, -6.6); c.lineTo(17.4, -6.2 + sway * 0.3); c.stroke();
  }
}
