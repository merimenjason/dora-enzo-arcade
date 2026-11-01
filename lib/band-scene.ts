// Woodland Band: the drawing (Canvas 2D), in a mid-century cartoon style: flat geometric shapes in mustard, teal,
// coral, cream and ink, colour fills printed a little off their dry-brush ink lines, starbursts and boomerangs, and
// squash-and-stretch on the beat. The clearing behind, the stage grid (beat columns by musician rows, notes placed by
// pitch, the playhead, the audience's rhythm rings and hint glows), each musician at the head of their row playing on
// their own beats, Dora (ukulele) and Enzo (glockenspiel) leading the band at either side, and the woodland audience,
// who sway, clap and dance as the song nears what they asked for. Dora and Enzo are drawn here, not with the shared
// drawChinchilla. Also the painted stand-ins for the title and the festival, and portraits for the cast picker.
import { MUSICIANS, ORDER, pitchName, onBeat, type MusicianId, type Row, type Song } from './band-game';

export const INK = '#2b2320', CREAM = '#f6ead2', MUSTARD = '#e4a62a', TEAL = '#2a8a86', CORAL = '#e8674a';
const PALE = '#efdfbf', TEAL_L = '#7cc2b6', MUSTARD_L = '#f4cf6e', CORAL_L = '#f3a68e', PINK = '#f2a3a6', PINK_D = '#e07f88';
const DORA = '#f8efdf', DORA_D = '#e6d5b8', ENZO = '#9aabb8', ENZO_D = '#7c8e9c', ENZO_L = '#cfd9e0', RUBY = '#b01c3a';
/** Each clearing's ground and sky: [sky, far, near, floor]. */
const LANDS: [string, string, string, string][] = [
  ['#1f5b4c', '#2b7360', '#174739', '#c88c3a'],
  ['#1b5466', '#2a6f80', '#123f4d', '#c79446'],
  ['#5a2f33', '#73403e', '#3f1f24', '#b8823c'],
  ['#2a4a60', '#3c6278', '#1b3446', '#b0773a'],
  ['#141d36', '#22305a', '#0d1428', '#8c5f34'],
];
export const MUSICIAN_COLOUR: Record<MusicianId, string> = { hedgehog: MUSTARD, woodpecker: TEAL, frog: '#4fa07c', mole: '#8a6f86', owl: '#d68f2a', enzo: ENZO, dora: CORAL, birds: CORAL_L };

type R4 = { x: number; y: number; w: number; h: number };
export type Inset = { top: number; bottom: number; left: number; right: number };
export type Lay = {
  W: number; H: number; wide: boolean; grid: R4; lw: number; cw: number; rh: number; head: number;
  rows: MusicianId[]; add: boolean; dora: [number, number]; enzo: [number, number]; ps: number; aud: R4 | null;
};
export type Cell = { m: MusicianId; step: number };
export type Look = {
  t: number; song: Song; land: number; playing: boolean; step: number; phase: number; beat: number;
  hits: Partial<Record<MusicianId, number>>; humming: boolean; humAt: number; close: number; won: number;
  guide: Row[] | null; ghost: { m: MusicianId; step: number; p: number } | null; sel: Cell | null; drag: { m: MusicianId; step: number; p: number } | null;
  canAdd: boolean; fest: boolean; addLabel: string; locked?: boolean;
};

// ---------------------------------------------------------------- the house style: offset fills and dry ink
const rnd = (i: number) => { const x = Math.sin(i * 91.17 + 3.3) * 43758.5453; return x - Math.floor(x); };
function ink(c: CanvasRenderingContext2D, lw: number, colour = INK) {
  c.lineJoin = 'round'; c.lineCap = 'round';
  c.strokeStyle = colour; c.lineWidth = lw; c.globalAlpha = 0.92; c.stroke();
  // the dry brush: a broken thinner pass, a hair off
  c.save(); c.translate(lw * 0.35, -lw * 0.2); c.setLineDash([lw * 3.2, lw * 1.1, lw * 0.8, lw * 1.4]); c.lineWidth = lw * 0.5; c.globalAlpha = 0.45; c.stroke(); c.restore();
  c.globalAlpha = 1;
}
/** A flat fill printed slightly off its outline, then the ink. */
function blob(c: CanvasRenderingContext2D, path: () => void, fill: string, lw: number, off = lw * 0.9, outline = true) {
  c.save(); c.translate(off, off * 0.6); c.beginPath(); path(); c.fillStyle = fill; c.fill(); c.restore();
  if (outline && lw > 0) { c.beginPath(); path(); ink(c, lw); }
}
const ell = (c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, rot = 0) => c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2);
function starburst(c: CanvasRenderingContext2D, x: number, y: number, r0: number, r1: number, n: number, rot = 0) {
  c.beginPath();
  for (let i = 0; i <= n * 2; i++) { const a = rot + (i / (n * 2)) * Math.PI * 2, r = i % 2 ? r0 : r1; c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
  c.closePath();
}
function boomerang(c: CanvasRenderingContext2D, x: number, y: number, s: number, rot: number) {
  c.save(); c.translate(x, y); c.rotate(rot); c.beginPath();
  c.moveTo(-s, 0); c.quadraticCurveTo(-s * 0.2, -s * 0.9, s, -s * 0.15); c.quadraticCurveTo(0, -s * 0.35, -s, 0); c.closePath();
  c.restore();
}
function rr(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) { c.roundRect(x, y, w, h, Math.max(0, Math.min(r, w / 2, h / 2))); }
const env = (t: number, at: number | undefined, k = 9) => (at === undefined || t < at ? 0 : Math.exp(-(t - at) * k));

// ---------------------------------------------------------------- Dora and Enzo
export type ChinPose = { t: number; hit: number; bob: number; face: 1 | -1; sing: number; cheer: number; blink: boolean };
/**
 * A mid-century chinchilla standing at (x, y) (between the feet), `s` tall: a plump round body, a big round head with a
 * broad, slightly flat crown, round pink ears on the sides of the crown, a short blunt muzzle, short whiskers and a
 * big bushy tail. Dora holds a ukulele, Enzo a glockenspiel.
 */
export function drawChin(c: CanvasRenderingContext2D, who: 'dora' | 'enzo', x: number, y: number, s: number, P: ChinPose) {
  const dora = who === 'dora', fur = dora ? DORA : ENZO, furD = dora ? DORA_D : ENZO_D, belly = dora ? '#fffaf0' : ENZO_L;
  const lw = Math.max(1.4, s * 0.016), f = P.face;
  const sq = P.hit * 0.09 + P.cheer * 0.05 * Math.max(0, Math.sin(P.t * 9));
  const hop = P.cheer * Math.abs(Math.sin(P.t * 4.5)) * s * 0.08;
  c.save(); c.translate(x, y - hop); c.scale(1 + sq * 0.7, 1 - sq); c.translate(0, -P.bob * s * 0.02);
  // shadow
  c.save(); c.scale(1, 0.25); c.beginPath(); ell(c, 0, 0, s * 0.34, s * 0.16); c.fillStyle = '#0003'; c.fill(); c.restore();
  // the tail: a bushy cloud behind, away from the face
  const tx = -f * s * 0.3;
  blob(c, () => { for (const [dx, dy, r] of [[0, -0.2, 0.15], [0.07, -0.33, 0.13], [-0.02, -0.44, 0.11], [-0.06, -0.12, 0.12]]) { const cx = tx - f * dx * s, cy = dy * s; c.moveTo(cx + r * s, cy); ell(c, cx, cy, r * s, r * s * 1.05); } }, furD, lw);
  // feet
  blob(c, () => { ell(c, -s * 0.13, -s * 0.03, s * 0.09, s * 0.05); c.moveTo(s * 0.22, -s * 0.03); ell(c, s * 0.13, -s * 0.03, s * 0.09, s * 0.05); }, furD, lw);
  // body
  blob(c, () => ell(c, 0, -s * 0.29, s * 0.3, s * 0.28), fur, lw * 1.1);
  c.beginPath(); ell(c, f * s * 0.04, -s * 0.24, s * 0.18, s * 0.19); c.fillStyle = belly; c.fill();
  // head
  const hy = -s * 0.69, hw = s * 0.29, hh = s * 0.24, tilt = Math.sin(P.t * Math.PI * 2 * 0.5) * 0.04 * P.bob + P.hit * 0.05 * f;
  c.save(); c.translate(f * s * 0.02, hy); c.rotate(tilt);
  // ears: big round and pink, on the sides of the crown
  for (const e of [-1, 1]) {
    const ex = e * hw * 0.92, ey = -hh * 0.55, er = s * 0.115;
    blob(c, () => ell(c, ex, ey, er, er * 1.02, e * 0.25), fur, lw);
    c.beginPath(); ell(c, ex + e * er * 0.08, ey + er * 0.05, er * 0.62, er * 0.66, e * 0.25); c.fillStyle = PINK; c.fill();
  }
  const head = () => {
    // a big round head with a broad, slightly flat crown
    c.moveTo(-hw, hh * 0.1);
    c.bezierCurveTo(-hw, -hh * 0.75, -hw * 0.62, -hh * 0.98, 0, -hh * 0.98);
    c.bezierCurveTo(hw * 0.62, -hh * 0.98, hw, -hh * 0.75, hw, hh * 0.1);
    c.bezierCurveTo(hw, hh * 0.85, hw * 0.55, hh * 1.05, 0, hh * 1.05);
    c.bezierCurveTo(-hw * 0.55, hh * 1.05, -hw, hh * 0.85, -hw, hh * 0.1);
  };
  blob(c, head, fur, lw * 1.1);
  // face, turned a touch toward where they look
  const fx = f * hw * 0.12;
  for (const e of [-1, 1]) {
    const ex = fx + e * hw * 0.38, ey = -hh * 0.12, er = s * 0.042;
    if (P.blink) { c.beginPath(); c.moveTo(ex - er, ey); c.quadraticCurveTo(ex, ey + er * 0.8, ex + er, ey); ink(c, lw * 1.1); }
    else {
      c.beginPath(); ell(c, ex, ey, er, er * 1.12); c.fillStyle = dora ? RUBY : '#141414'; c.fill();
      c.beginPath(); ell(c, ex - er * 0.3, ey - er * 0.4, er * 0.32, er * 0.32); c.fillStyle = '#fff'; c.fill();
    }
    c.beginPath(); ell(c, fx + e * hw * 0.62, hh * 0.32, s * 0.04, s * 0.026); c.fillStyle = '#f08f7a88'; c.fill();
  }
  // the short blunt muzzle, nose and whiskers
  const my = hh * 0.36;
  blob(c, () => ell(c, fx, my, s * 0.075, s * 0.05), dora ? '#fffaf2' : '#dfe6ea', lw * 0.8, lw * 0.5);
  c.beginPath(); ell(c, fx, my - s * 0.03, s * 0.022, s * 0.016); c.fillStyle = PINK_D; c.fill();
  if (P.sing > 0.05) { c.beginPath(); ell(c, fx, my + s * 0.028, s * 0.02, s * 0.012 + P.sing * s * 0.02); c.fillStyle = '#7a2a30'; c.fill(); }
  else { c.beginPath(); c.moveTo(fx - s * 0.025, my + s * 0.012); c.quadraticCurveTo(fx - s * 0.012, my + s * 0.03, fx, my + s * 0.012); c.quadraticCurveTo(fx + s * 0.012, my + s * 0.03, fx + s * 0.025, my + s * 0.012); ink(c, lw * 0.7); }
  for (const e of [-1, 1]) for (const k of [-1, 0, 1]) { c.beginPath(); c.moveTo(fx + e * s * 0.07, my + k * s * 0.012); c.lineTo(fx + e * s * 0.15, my + k * s * 0.03 - s * 0.005); ink(c, lw * 0.5); }
  c.restore();
  // the instrument and arms
  if (dora) {
    const strum = P.hit;
    c.save(); c.translate(f * s * 0.05, -s * 0.3); c.rotate(f * -0.55);
    blob(c, () => { c.rect(s * 0.05, -s * 0.025, s * 0.36, s * 0.05); }, MUSTARD, lw * 0.9);
    blob(c, () => { rr(c, s * 0.36, -s * 0.04, s * 0.08, s * 0.08, s * 0.02); }, '#a8641e', lw * 0.8);
    blob(c, () => { ell(c, -s * 0.05, 0, s * 0.12, s * 0.1); c.moveTo(s * 0.13, 0); ell(c, s * 0.07, 0, s * 0.08, s * 0.075); }, CORAL, lw);
    c.beginPath(); ell(c, s * 0.03, 0, s * 0.03, s * 0.03); c.fillStyle = INK; c.fill();
    c.restore();
    // the strumming paw
    const ax = f * (s * 0.02 - strum * s * 0.04), ay = -s * 0.28 + strum * s * 0.07;
    blob(c, () => ell(c, ax, ay, s * 0.06, s * 0.05), fur, lw);
    blob(c, () => ell(c, f * s * 0.24, -s * 0.44, s * 0.055, s * 0.045), fur, lw);
  } else {
    // the glockenspiel in front, mallets coming down on the beat
    const gy = -s * 0.2, gw = s * 0.5;
    c.save(); c.translate(f * s * 0.12, gy);
    blob(c, () => { c.moveTo(-gw / 2, -s * 0.03); c.lineTo(gw / 2, -s * 0.07); c.lineTo(gw / 2, s * 0.06); c.lineTo(-gw / 2, s * 0.08); c.closePath(); }, '#7a4a26', lw);
    const cols = [CORAL, MUSTARD, CREAM, TEAL_L, CORAL_L, MUSTARD_L];
    for (let i = 0; i < 6; i++) { const bx = -gw / 2 + gw * (i + 0.5) / 6; blob(c, () => rr(c, bx - gw / 15, -s * 0.07 + i * s * 0.006, gw / 7.5, s * 0.12 - i * s * 0.014, s * 0.008), cols[i], lw * 0.6, lw * 0.4); }
    c.restore();
    for (const e of [-1, 1]) {
      const down = e === (Math.floor(P.t * 2) % 2 ? 1 : -1) ? P.hit : 0;
      const px = f * s * 0.12 + e * s * 0.14, py = -s * 0.36 + down * s * 0.07;
      c.beginPath(); c.moveTo(px, py); c.lineTo(px + e * s * 0.06, py + s * 0.12 - down * s * 0.02); ink(c, lw * 1.1, '#5a3a20');
      c.beginPath(); ell(c, px + e * s * 0.065, py + s * 0.13 - down * s * 0.02, s * 0.022, s * 0.022); c.fillStyle = CORAL; c.fill(); ink(c, lw * 0.6);
      blob(c, () => ell(c, px, py, s * 0.055, s * 0.045), fur, lw);
    }
    if (P.hit > 0.3) { c.save(); c.globalAlpha = P.hit; starburst(c, f * s * 0.3, -s * 0.46, s * 0.025, s * 0.08, 8, P.t); c.fillStyle = MUSTARD_L; c.fill(); c.restore(); }
  }
  c.restore();
}

// ---------------------------------------------------------------- the musicians (drawn at their row heads, facing right)
// Dora and Enzo on stage are painted cut-outs (public/art/band/<who>-<pose>.webp, the body 600px from feet to crown,
// feet 12px above the bottom, the body centred; Dora faces right, Enzo left). drawChin stands in while they load.
const cuts: Record<string, HTMLImageElement> = {};
function cutout(who: 'dora' | 'enzo', pose: 'play' | 'cheer'): HTMLImageElement | null {
  if (typeof Image === 'undefined') return null;
  let got: HTMLImageElement | null = null;
  for (const p of ['play', 'cheer'] as const) {
    const k = `${who}-${p}`; let im = cuts[k];
    if (!im) { im = cuts[k] = new Image(); im.decoding = 'async'; im.src = `/art/band/${k}.webp`; }
    if (p === pose && im.complete && im.naturalWidth) got = im;
  }
  return got;
}
/** Dora or Enzo at (x, y) (between the feet), `s` tall: painted when the cut-outs are in, squashing on their own beats
 * and hopping when the audience cheers; otherwise drawn. */
export function drawLead(c: CanvasRenderingContext2D, who: 'dora' | 'enzo', x: number, y: number, s: number, P: ChinPose & { playing: boolean }, maxW = Infinity) {
  const im = cutout(who, P.playing && P.cheer < 0.5 ? 'play' : 'cheer');
  if (!im) { drawChin(c, who, x, y, s, P); return; }
  let k = (s * 0.93) / 600;
  if (im.naturalWidth * k > maxW) k = maxW / im.naturalWidth;
  const w = im.naturalWidth * k, h = im.naturalHeight * k;
  const sq = P.hit * 0.09 + P.cheer * 0.05 * Math.max(0, Math.sin(P.t * 9));
  const hop = P.cheer * Math.abs(Math.sin(P.t * 4.5)) * s * 0.08;
  c.save(); c.translate(x, y);
  c.save(); c.scale(1, 0.25); c.beginPath(); ell(c, 0, 0, s * 0.34, s * 0.16); c.fillStyle = '#0003'; c.fill(); c.restore();
  c.translate(0, -hop - P.bob * s * 0.02); c.scale(1 + sq * 0.7, 1 - sq); c.rotate((P.playing ? Math.sin(P.t * Math.PI) * 0.025 * P.bob : 0) + P.hit * 0.03 * P.face);
  c.drawImage(im, -w / 2, -h + 12 * k, w, h);
  c.restore();
}

/** A musician at (x, y) (their feet), `s` tall, squashing on `hit` (0..1) and bobbing to the beat. */
export function drawMusician(c: CanvasRenderingContext2D, m: MusicianId, x: number, y: number, s: number, hit: number, t: number, bob: number) {
  if (m === 'dora' || m === 'enzo') { drawLead(c, m, x, y, s * 1.05, { t, hit, bob, face: m === 'dora' ? 1 : -1, sing: 0, cheer: 0, blink: false, playing: true }, s * 0.95); return; }
  const lw = Math.max(1.2, s * 0.022), sq = hit * 0.14;
  c.save(); c.translate(x, y); c.scale(1 + sq * 0.7, 1 - sq); c.translate(0, -bob * s * 0.03);
  c.save(); c.scale(1, 0.22); c.beginPath(); ell(c, 0, 0, s * 0.36, s * 0.16); c.fillStyle = '#0003'; c.fill(); c.restore();
  const eye = (ex: number, ey: number, r: number, white = true) => {
    if (white) { c.beginPath(); ell(c, ex, ey, r, r); c.fillStyle = '#fff'; c.fill(); ink(c, lw * 0.6); }
    c.beginPath(); ell(c, ex + r * 0.15, ey, r * (white ? 0.5 : 1), r * (white ? 0.55 : 1)); c.fillStyle = INK; c.fill();
  };
  switch (m) {
    case 'hedgehog': {
      // spiky dome, cream face, a coral drum with sticks
      blob(c, () => { c.moveTo(-s * 0.32, -s * 0.12); for (let i = 0; i <= 10; i++) { const a = Math.PI + (i / 10) * Math.PI * 0.95, r = i % 2 ? s * 0.34 : s * 0.42; c.lineTo(Math.cos(a) * r - s * 0.04, -s * 0.18 + Math.sin(a) * r); } c.lineTo(s * 0.2, -s * 0.12); c.closePath(); }, '#7d5634', lw);
      blob(c, () => { c.moveTo(s * 0.05, -s * 0.5); c.quadraticCurveTo(s * 0.42, -s * 0.38, s * 0.36, -s * 0.24); c.quadraticCurveTo(s * 0.2, -s * 0.12, s * 0.02, -s * 0.18); c.closePath(); }, CREAM, lw);
      eye(s * 0.2, -s * 0.36, s * 0.035, false);
      c.beginPath(); ell(c, s * 0.37, -s * 0.26, s * 0.03, s * 0.025); c.fillStyle = INK; c.fill();
      blob(c, () => rr(c, -s * 0.12, -s * 0.2, s * 0.4, s * 0.2, s * 0.03), CORAL, lw);
      c.beginPath(); c.moveTo(-s * 0.12, -s * 0.1); c.lineTo(s * 0.28, -s * 0.1); ink(c, lw * 0.6);
      blob(c, () => ell(c, s * 0.08, -s * 0.2, s * 0.2, s * 0.045), CREAM, lw * 0.8);
      const k = hit * 0.6;
      c.beginPath(); c.moveTo(s * 0.12, -s * 0.36); c.lineTo(s * 0.02 + k * s * 0.05, -s * 0.22 - (1 - k) * s * 0.06); ink(c, lw * 1.2, '#7a4a26');
      break;
    }
    case 'woodpecker': {
      blob(c, () => rr(c, s * 0.12, -s * 0.22, s * 0.26, s * 0.16, s * 0.02), MUSTARD, lw);
      c.beginPath(); c.moveTo(s * 0.16, -s * 0.14); c.lineTo(s * 0.34, -s * 0.14); ink(c, lw * 0.5);
      c.save(); c.translate(-s * 0.06, -s * 0.36); c.rotate(hit * 0.4);
      blob(c, () => { c.moveTo(-s * 0.08, -s * 0.12); c.quadraticCurveTo(s * 0.06, -s * 0.3, s * 0.2, -s * 0.16); c.lineTo(s * 0.04, -s * 0.06); c.closePath(); }, CORAL, lw);
      blob(c, () => ell(c, 0, 0, s * 0.17, s * 0.24), TEAL, lw);
      blob(c, () => ell(c, s * 0.04, s * 0.06, s * 0.09, s * 0.14), CREAM, lw * 0.6, 0);
      blob(c, () => { c.moveTo(s * 0.12, -s * 0.1); c.lineTo(s * 0.36, -s * 0.05); c.lineTo(s * 0.12, -s * 0.0); c.closePath(); }, MUSTARD, lw);
      eye(s * 0.06, -s * 0.1, s * 0.04);
      c.restore();
      c.beginPath(); c.moveTo(-s * 0.06, -s * 0.12); c.lineTo(-s * 0.08, 0); c.moveTo(s * 0.0, -s * 0.12); c.lineTo(s * 0.02, 0); ink(c, lw);
      break;
    }
    case 'frog': {
      // the double bass, taller than he is
      c.save(); c.translate(s * 0.14, -s * 0.36); c.rotate(0.12);
      blob(c, () => { ell(c, 0, s * 0.1, s * 0.14, s * 0.2); c.moveTo(s * 0.11, -s * 0.12); ell(c, 0, -s * 0.12, s * 0.11, s * 0.13); }, '#b8692a', lw);
      c.beginPath(); c.moveTo(0, -s * 0.5); c.lineTo(0, s * 0.25); ink(c, lw * 1.4, INK);
      c.beginPath(); c.moveTo(-s * 0.03, -s * 0.05); c.lineTo(-s * 0.03, s * 0.25); c.moveTo(s * 0.03, -s * 0.05); c.lineTo(s * 0.03, s * 0.25); ink(c, lw * 0.4, CREAM);
      c.restore();
      blob(c, () => ell(c, -s * 0.08, -s * 0.24, s * 0.24, s * 0.22), '#4fa07c', lw);
      blob(c, () => ell(c, -s * 0.06, -s * 0.18, s * 0.15, s * 0.13), '#cfe3b0', lw * 0.5, 0);
      for (const e of [-1, 1]) { blob(c, () => ell(c, -s * 0.08 + e * s * 0.12, -s * 0.46, s * 0.075, s * 0.075), '#4fa07c', lw); eye(-s * 0.06 + e * s * 0.12, -s * 0.47, s * 0.045); }
      c.beginPath(); c.moveTo(-s * 0.2, -s * 0.33); c.quadraticCurveTo(-s * 0.06, -s * (0.26 - hit * 0.04), s * 0.06, -s * 0.33); ink(c, lw);
      if (hit > 0.2) { c.beginPath(); ell(c, -s * 0.2, -s * 0.28, s * 0.06 * hit, s * 0.05 * hit); c.fillStyle = '#cfe3b0'; c.fill(); ink(c, lw * 0.6); }
      blob(c, () => ell(c, s * 0.12, -s * 0.2 + hit * s * 0.03, s * 0.055, s * 0.04), '#4fa07c', lw);
      break;
    }
    case 'mole': {
      blob(c, () => ell(c, -s * 0.06, -s * 0.24, s * 0.25, s * 0.24), '#6e5a6c', lw);
      blob(c, () => ell(c, 0, -s * 0.4, s * 0.15, s * 0.11), '#8a7487', lw * 0.6, 0);
      c.beginPath(); c.moveTo(-s * 0.05, -s * 0.44); c.lineTo(s * 0.0, -s * 0.44); c.moveTo(s * 0.07, -s * 0.44); c.lineTo(s * 0.12, -s * 0.44); ink(c, lw);
      // the tuba: a mustard coil with a bell that flares on the beat
      c.save(); c.translate(s * 0.08, -s * 0.24);
      blob(c, () => ell(c, 0, 0, s * 0.15, s * 0.15), MUSTARD, lw);
      c.beginPath(); ell(c, 0, 0, s * 0.08, s * 0.08); ink(c, lw * 0.8);
      const fl = 1 + hit * 0.25;
      blob(c, () => { c.moveTo(s * 0.06, -s * 0.12); c.lineTo(s * 0.22, -s * 0.3 * fl); c.lineTo(s * 0.34, -s * 0.2 * fl); c.lineTo(s * 0.12, -s * 0.06); c.closePath(); }, MUSTARD_L, lw);
      c.restore();
      blob(c, () => ell(c, s * 0.02, -s * 0.36, s * 0.05 + hit * s * 0.02, s * 0.04 + hit * s * 0.015), PINK, lw * 0.7);
      if (hit > 0.3) { c.save(); c.globalAlpha = hit; starburst(c, s * 0.42, -s * 0.52, s * 0.03, s * 0.1, 7, t * 2); c.fillStyle = MUSTARD_L; c.fill(); c.restore(); }
      break;
    }
    case 'owl': {
      blob(c, () => { c.moveTo(-s * 0.24, -s * 0.05); c.quadraticCurveTo(-s * 0.3, -s * 0.62, 0, -s * 0.64); c.quadraticCurveTo(s * 0.3, -s * 0.62, s * 0.24, -s * 0.05); c.closePath(); }, '#c98426', lw);
      blob(c, () => ell(c, 0, -s * 0.2, s * 0.15, s * 0.15), MUSTARD_L, lw * 0.5, 0);
      for (const e of [-1, 1]) { blob(c, () => ell(c, e * s * 0.1, -s * 0.46, s * 0.1, s * 0.1), CREAM, lw * 0.8); if (hit > 0.4) { c.beginPath(); c.moveTo(e * s * 0.1 - s * 0.05, -s * 0.46); c.quadraticCurveTo(e * s * 0.1, -s * 0.5, e * s * 0.1 + s * 0.05, -s * 0.46); ink(c, lw); } else eye(e * s * 0.1 + s * 0.01, -s * 0.46, s * 0.06); }
      blob(c, () => { c.moveTo(-s * 0.03, -s * 0.38); c.lineTo(s * 0.03, -s * 0.38); c.lineTo(0, -s * 0.32); c.closePath(); }, CORAL, lw * 0.6);
      // the flute, held out to the right
      c.save(); c.translate(s * 0.02, -s * 0.3); c.rotate(-0.12 - hit * 0.08);
      blob(c, () => rr(c, -s * 0.02, -s * 0.02, s * 0.42, s * 0.04, s * 0.02), CREAM, lw * 0.8);
      for (let i = 0; i < 4; i++) { c.beginPath(); ell(c, s * (0.14 + i * 0.06), 0, s * 0.008, s * 0.008); c.fillStyle = INK; c.fill(); }
      c.restore();
      blob(c, () => ell(c, s * 0.16, -s * 0.24, s * 0.06, s * 0.04), '#c98426', lw);
      break;
    }
    case 'birds': {
      c.beginPath(); c.moveTo(-s * 0.4, -s * 0.06); c.quadraticCurveTo(0, -s * 0.12, s * 0.42, -s * 0.04); ink(c, lw * 2, '#6a4422');
      const cols = [CORAL, TEAL, MUSTARD];
      cols.forEach((col, i) => {
        const bx = -s * 0.26 + i * s * 0.26, h = hit * (i === 1 ? 1 : 0.7), by = -s * 0.2 - h * s * 0.06;
        blob(c, () => ell(c, bx, by, s * 0.11, s * 0.12 * (1 + h * 0.1)), col, lw);
        eye(bx + s * 0.03, by - s * 0.05, s * 0.025, false);
        if (h > 0.2) { blob(c, () => { c.moveTo(bx + s * 0.08, by - s * 0.02); c.lineTo(bx + s * 0.18, by - s * 0.05 - h * s * 0.03); c.lineTo(bx + s * 0.18, by + s * 0.02 + h * s * 0.03); c.closePath(); }, MUSTARD_L, lw * 0.6); }
        else blob(c, () => { c.moveTo(bx + s * 0.08, by - s * 0.02); c.lineTo(bx + s * 0.16, by); c.lineTo(bx + s * 0.08, by + s * 0.02); c.closePath(); }, MUSTARD_L, lw * 0.6);
      });
      break;
    }
  }
  c.restore();
}

// ---------------------------------------------------------------- the audience
const FOLK = ['rabbit', 'squirrel', 'badger', 'mouse', 'rabbit', 'squirrel', 'mouse', 'badger', 'squirrel', 'rabbit'] as const;
function drawFolk(c: CanvasRenderingContext2D, kind: (typeof FOLK)[number], x: number, y: number, s: number, i: number, t: number, L: Look) {
  const lw = Math.max(1, s * 0.03), close = L.close, beatT = L.playing ? L.phase : 0;
  const sway = close > 0.35 && L.playing ? Math.sin((L.beat + beatT) * Math.PI) * 0.12 * Math.min(1, (close - 0.35) * 3) : Math.sin(t * 0.8 + i) * 0.02;
  const jump = (L.won >= 0 || L.fest) && L.playing ? Math.abs(Math.sin((L.beat + beatT) * Math.PI)) * s * 0.25 : 0;
  const clap = close > 0.7 && L.playing ? Math.max(0, Math.cos((L.beat + beatT) * Math.PI * 2)) : 0;
  const fur = kind === 'rabbit' ? CREAM : kind === 'squirrel' ? CORAL : kind === 'badger' ? '#4a4248' : '#b9a48a';
  c.save(); c.translate(x, y - jump); c.rotate(sway);
  if (kind === 'squirrel') blob(c, () => { c.moveTo(-s * 0.2, -s * 0.2); c.bezierCurveTo(-s * 0.7, -s * 0.5, -s * 0.5, -s * 1.1, -s * 0.15, -s * 0.9); c.bezierCurveTo(-s * 0.35, -s * 0.7, -s * 0.3, -s * 0.4, -s * 0.05, -s * 0.3); c.closePath(); }, '#c4553c', lw);
  blob(c, () => ell(c, 0, -s * 0.25, s * 0.26, s * 0.28), fur, lw);
  if (kind === 'rabbit') for (const e of [-1, 1]) blob(c, () => ell(c, e * s * 0.1, -s * 0.85, s * 0.06, s * 0.2, e * 0.15), fur, lw);
  if (kind === 'mouse') for (const e of [-1, 1]) blob(c, () => ell(c, e * s * 0.18, -s * 0.72, s * 0.11, s * 0.11), PINK, lw);
  if (kind === 'squirrel') for (const e of [-1, 1]) blob(c, () => { c.moveTo(e * s * 0.08, -s * 0.66); c.lineTo(e * s * 0.16, -s * 0.84); c.lineTo(e * s * 0.2, -s * 0.62); c.closePath(); }, fur, lw);
  blob(c, () => ell(c, 0, -s * 0.58, s * 0.2, s * 0.18), fur, lw);
  if (kind === 'badger') { c.beginPath(); ell(c, 0, -s * 0.62, s * 0.05, s * 0.15); c.fillStyle = CREAM; c.fill(); }
  const eyesClosed = L.won >= 0 || L.humming;
  for (const e of [-1, 1]) {
    if (eyesClosed) { c.beginPath(); c.moveTo(e * s * 0.08 - s * 0.03, -s * 0.6); c.quadraticCurveTo(e * s * 0.08, -s * 0.64, e * s * 0.08 + s * 0.03, -s * 0.6); ink(c, lw); }
    else { c.beginPath(); ell(c, e * s * 0.08, -s * 0.6, s * 0.025, s * 0.03); c.fillStyle = kind === 'badger' ? CREAM : INK; c.fill(); }
  }
  if (L.humming || L.won >= 0) { c.beginPath(); ell(c, 0, -s * 0.5, s * 0.03, s * 0.035); c.fillStyle = '#7a2a30'; c.fill(); }
  // paws: resting, or clapping on the beat
  const py = -s * 0.3 - (clap > 0 || L.won >= 0 ? s * 0.2 : 0), gap = s * 0.06 + (1 - clap) * s * 0.1;
  for (const e of [-1, 1]) blob(c, () => ell(c, e * gap, py, s * 0.06, s * 0.05), fur, lw);
  c.restore();
}

// ---------------------------------------------------------------- the scene
export class BandScene {
  c: CanvasRenderingContext2D; dpr = 1; W = 0; H = 0;
  inset: Inset = { top: 0, bottom: 0, left: 0, right: 0 };
  lay: Lay | null = null;
  private notes: { x: number; y: number; t: number; col: string; i: number }[] = [];
  constructor(public cv: HTMLCanvasElement) { const c = cv.getContext('2d'); if (!c) throw new Error('no canvas'); this.c = c; }
  resize() {
    const r = this.cv.getBoundingClientRect(); this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.W = Math.max(1, r.width); this.H = Math.max(1, r.height);
    const w = Math.round(this.W * this.dpr), h = Math.round(this.H * this.dpr);
    if (this.cv.width !== w || this.cv.height !== h) { this.cv.width = w; this.cv.height = h; }
  }
  /** Fits the stage between the insets: Dora and Enzo either side (or above, on a tall screen), the grid between, the audience below. */
  layout(rows: MusicianId[], steps: number, add: boolean) {
    const I = this.inset, W = this.W, H = this.H;
    const A = { x: I.left, y: I.top, w: Math.max(50, W - I.left - I.right), h: Math.max(50, H - I.top - I.bottom) };
    const wide = A.w / A.h > 1.2, n = Math.max(1, rows.length + (add ? 0.6 : 0));
    let ps: number, grid: R4, aud: R4 | null = null, dora: [number, number], enzo: [number, number];
    if (wide) {
      ps = Math.max(100, Math.min(A.h * 0.5, A.w * 0.17, 340));
      const pw = ps * 0.78;
      const ah = A.h > 430 ? Math.min(110, A.h * 0.14) : 0;
      const gx = A.x + pw, gw = A.w - pw * 2, gy = A.y + 6, gh = A.h - ah - 12;
      grid = { x: gx, y: gy, w: gw, h: gh };
      if (ah) aud = { x: gx, y: A.y + A.h - ah, w: gw, h: ah };
      const foot = Math.min(A.y + A.h - 4, A.y + A.h * 0.5 + ps * 0.62);
      dora = [A.x + pw * 0.5, foot]; enzo = [A.x + A.w - pw * 0.5, foot];
    } else {
      ps = Math.max(90, Math.min(A.h * 0.2, A.w * 0.4, 210));
      const top = ps + 8, ah = A.h > 560 ? Math.min(70, A.h * 0.08) : 0;
      grid = { x: A.x + 6, y: A.y + top, w: A.w - 12, h: A.h - top - ah - 6 };
      if (ah) aud = { x: A.x, y: A.y + A.h - ah, w: A.w, h: ah };
      dora = [A.x + A.w * 0.24, A.y + ps + 2]; enzo = [A.x + A.w * 0.76, A.y + ps + 2];
    }
    // rows as tall as fits (not too tall), the label column, then cells; the grid sits centred in its room
    const head = Math.min(28, Math.max(14, grid.h * 0.05));
    let rh = Math.min(Math.max(96, Math.min(130, H * 0.11)), (grid.h - head) / n);
    let lw = Math.max(52, Math.min(200, rh * 2.1, grid.w * 0.2));
    let cw = (grid.w - lw) / steps;
    if (cw > rh * 2.2) cw = rh * 2.2;
    if (cw < 18) { cw = 18; }
    rh = Math.max(24, rh);
    lw = Math.min(lw, grid.w - cw * steps);
    const gw = lw + cw * steps, gh = head + rh * n;
    grid = { x: grid.x + (grid.w - gw) / 2, y: grid.y + Math.max(0, (grid.h - gh) / 2), w: gw, h: gh };
    if (aud && wide) aud = { ...aud, x: grid.x - 20, w: grid.w + 40 };
    this.lay = { W, H, wide, grid, lw, cw, rh, head, rows, add, dora, enzo, ps, aud };
    return this.lay;
  }
  /** The cell under a point (canvas pixels), or null. */
  cellAt(x: number, y: number): Cell | null {
    const L = this.lay; if (!L) return null;
    const g = L.grid, i = Math.floor((x - g.x - L.lw) / L.cw), r = Math.floor((y - g.y - L.head) / L.rh);
    if (x < g.x + L.lw || i < 0 || i >= Math.round((g.w - L.lw) / L.cw) || r < 0 || r >= L.rows.length) return null;
    return { m: L.rows[r], step: i };
  }
  /** A row's label under a point: the musician, and whether it was their ✕. */
  labelAt(x: number, y: number): { m: MusicianId; remove: boolean } | 'add' | null {
    const L = this.lay; if (!L) return null;
    const g = L.grid, r = Math.floor((y - g.y - L.head) / L.rh);
    if (x < g.x || x > g.x + g.w || r < 0) return null;
    if (r === L.rows.length && L.add && y < g.y + L.head + (L.rows.length + 0.6) * L.rh) return 'add';
    if (r >= L.rows.length || x > g.x + L.lw) return null;
    const ry = g.y + L.head + r * L.rh, xr = this.xBox(L, ry);
    return { m: L.rows[r], remove: Math.hypot(x - xr[0], y - xr[1]) < Math.max(16, xr[2] * 1.6) };
  }
  private xBox(L: Lay, ry: number): [number, number, number] { const k = Math.max(8, Math.min(13, L.rh * 0.17)); return [L.grid.x + L.lw - k - 4, L.lw >= 150 ? ry + k + 4 : ry + L.rh - k - 4, k]; }
  /** Where a row's ✕ is, in canvas pixels. */
  xSpot(m: MusicianId): [number, number] | null { const L = this.lay; if (!L) return null; const r = L.rows.indexOf(m); if (r < 0) return null; const [x, y] = this.xBox(L, L.grid.y + L.head + r * L.rh); return [x, y]; }
  /** Where a cell is, in canvas pixels. */
  cellRect(m: MusicianId, step: number): R4 | null {
    const L = this.lay; if (!L) return null; const r = L.rows.indexOf(m); if (r < 0) return null;
    return { x: L.grid.x + L.lw + step * L.cw, y: L.grid.y + L.head + r * L.rh, w: L.cw, h: L.rh };
  }
  /** The vertical spot for a pitch inside a cell. */
  private py(m: MusicianId, p: number, y: number, h: number) { const span = MUSICIANS[m].span; return y + h * 0.82 - (h * 0.64 * p) / Math.max(1, span - 1); }

  draw(L0: Look) {
    const c = this.c, L = this.lay; if (!L) return;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.backdrop(L0.land, L0.t, L0.fest);
    const ps = L.ps;
    // Dora and Enzo, leading
    const t = L0.t, dh = env(t, L0.hits.dora, 7), eh = env(t, L0.hits.enzo, 7), bob = L0.playing ? Math.abs(Math.sin((L0.beat + L0.phase) * Math.PI)) : 0;
    const cheer = L0.won >= 0 ? Math.min(1, (t - L0.won) * 2) : L0.fest ? 1 : 0;
    const blink = (k: number) => (t * 0.31 + k) % 1 < 0.035;
    const maxW = L.wide ? ps * 0.82 : L.W * 0.44;
    drawLead(c, 'dora', L.dora[0], L.dora[1], ps, { t, hit: dh, bob, face: 1, sing: L0.won >= 0 ? 0.6 : dh * 0.5, cheer, blink: blink(0.1), playing: L0.playing }, maxW);
    drawLead(c, 'enzo', L.enzo[0], L.enzo[1], ps * 1.04, { t, hit: eh, bob, face: -1, sing: L0.won >= 0 ? 0.6 : 0, cheer, blink: blink(0.6), playing: L0.playing }, maxW);
    this.grid(L0);
    if (L.aud) this.audience(L0, L.aud);
    // floating notes from the musicians
    c.font = `700 ${Math.round(Math.max(12, L.rh * 0.3))}px 'Righteous', sans-serif`;
    this.notes = this.notes.filter((n) => t - n.t < 1.2);
    for (const n of this.notes) { const a = 1 - (t - n.t) / 1.2; c.globalAlpha = a; c.fillStyle = n.col; c.fillText(n.i % 2 ? '♪' : '♫', n.x + Math.sin((t - n.t) * 5 + n.i) * 6, n.y - (t - n.t) * 40); }
    c.globalAlpha = 1;
  }
  /** A note glyph rising from a musician (the page calls this as each note sounds). */
  puff(m: MusicianId, t: number) {
    const L = this.lay; if (!L || this.notes.length > 40) return;
    const r = L.rows.indexOf(m); if (r < 0) return;
    this.notes.push({ x: L.grid.x + L.lw * 0.62, y: L.grid.y + L.head + r * L.rh + L.rh * 0.3, t, col: m === 'dora' || m === 'enzo' ? MUSTARD_L : CREAM, i: this.notes.length + r });
  }

  private backdrop(land: number, t: number, fest: boolean) {
    const c = this.c, W = this.W, H = this.H, [sky, far, near, floor] = LANDS[land] ?? LANDS[0];
    c.fillStyle = sky; c.fillRect(0, 0, W, H);
    // the big starburst behind the stage, slowly turning
    c.save(); c.globalAlpha = 0.16; starburst(c, W / 2, H * 0.3, Math.min(W, H) * 0.25, Math.max(W, H) * 0.75, 18, t * 0.02); c.fillStyle = MUSTARD; c.fill(); c.restore();
    // grain
    c.fillStyle = '#ffffff10';
    for (let i = 0; i < 140; i++) c.fillRect(rnd(i) * W, rnd(i + 500) * H, 2, 2);
    // boomerangs and little stars in the sky
    for (let i = 0; i < 9; i++) { c.save(); c.globalAlpha = 0.2; boomerang(c, rnd(i + 20) * W, rnd(i + 40) * H * 0.55, 14 + rnd(i + 60) * 18, rnd(i + 80) * 6); c.fillStyle = i % 2 ? CREAM : CORAL_L; c.fill(); c.restore(); }
    if (land === 4 || fest) {
      // the moon, lanterns and fireflies
      const mr = Math.min(W, H) * 0.09;
      blob(this.c, () => ell(c, W * 0.82, H * 0.14, mr, mr), CREAM, 2.4);
      c.beginPath(); c.moveTo(0, H * 0.06); c.quadraticCurveTo(W / 2, H * 0.2, W, H * 0.05); ink(c, 1.5, '#e8d9b0');
      for (let i = 1; i < 10; i++) { const x = (W * i) / 10, y = H * 0.06 + Math.sin((i / 10) * Math.PI) * H * 0.12 - 2; c.save(); c.globalAlpha = 0.8 + Math.sin(t * 2 + i) * 0.2; blob(this.c, () => rr(c, x - 9, y, 18, 22, 7), i % 3 === 0 ? CORAL : i % 3 === 1 ? MUSTARD : TEAL_L, 1.5, 1.5); c.restore(); }
      for (let i = 0; i < 18; i++) { const x = (rnd(i + 200) * W + t * 12 * (rnd(i) - 0.5)) % W, y = H * 0.2 + rnd(i + 300) * H * 0.5 + Math.sin(t * 1.3 + i) * 10; c.globalAlpha = 0.5 + 0.5 * Math.sin(t * 3 + i * 2); starburst(c, x, y, 1.5, 5, 4, i); c.fillStyle = MUSTARD_L; c.fill(); }
      c.globalAlpha = 1;
    }
    // far hills and trees in flat bands
    c.fillStyle = far; c.beginPath(); c.moveTo(0, H * 0.62);
    for (let i = 0; i <= 8; i++) c.quadraticCurveTo(W * (i - 0.5) / 8, H * (0.52 + rnd(i + 7) * 0.06), W * i / 8, H * 0.6); c.lineTo(W, H); c.lineTo(0, H); c.fill();
    const tree = (x: number, y: number, s: number, k: number) => {
      c.fillStyle = '#5a3a22'; c.fillRect(x - s * 0.05, y - s * 0.5, s * 0.1, s * 0.5);
      if (k % 2) blob(this.c, () => { c.moveTo(x, y - s * 1.5); c.lineTo(x + s * 0.4, y - s * 0.4); c.lineTo(x - s * 0.4, y - s * 0.4); c.closePath(); }, k % 3 ? TEAL : '#3f9a76', 2, 4);
      else blob(this.c, () => ell(c, x, y - s * 0.85, s * 0.42, s * 0.5), k % 4 ? MUSTARD : TEAL_L, 2, 4);
    };
    for (let i = 0; i < 7; i++) { const side = i % 2 ? 1 : 0, x = side ? W - rnd(i + 3) * W * 0.18 : rnd(i + 3) * W * 0.18, s = Math.min(W, H) * (0.18 + rnd(i + 9) * 0.12); tree(x, H * (0.62 + rnd(i) * 0.06), s, i); }
    // what makes each clearing itself
    if (land === 0) for (let i = 0; i < 10; i++) { const x = rnd(i + 31) * W, y = H * (0.66 + rnd(i + 32) * 0.1); c.beginPath(); for (let k = -2; k <= 2; k++) { c.moveTo(x, y); c.quadraticCurveTo(x + k * 10, y - 26, x + k * 22, y - 30 + Math.abs(k) * 8); } ink(c, 2.2, '#5fb38a'); }
    if (land === 1) { c.fillStyle = '#3d8ea3'; c.beginPath(); c.moveTo(0, H * 0.7); for (let i = 0; i <= 12; i++) c.quadraticCurveTo(W * (i - 0.5) / 12, H * (0.7 + (i % 2 ? 0.02 : -0.02)), W * i / 12, H * 0.7); c.lineTo(W, H * 0.78); c.lineTo(0, H * 0.78); c.fill(); for (let i = 0; i < 8; i++) { c.beginPath(); c.moveTo(rnd(i + 70) * W, H * 0.73); c.lineTo(rnd(i + 70) * W + 30, H * 0.73); ink(c, 2, '#bfe3e0'); } }
    if (land === 2) for (let i = 0; i < 9; i++) { const x = W * (0.05 + i * 0.112), y = H * 0.76 + Math.sin(i) * 6, s = 16 + rnd(i + 90) * 12; c.fillStyle = CREAM; c.fillRect(x - s * 0.2, y - s * 0.6, s * 0.4, s * 0.6); blob(this.c, () => { c.moveTo(x - s * 0.8, y - s * 0.55); c.quadraticCurveTo(x, y - s * 1.6, x + s * 0.8, y - s * 0.55); c.closePath(); }, CORAL, 2, 2); for (let k = 0; k < 3; k++) { c.beginPath(); ell(c, x - s * 0.4 + k * s * 0.4, y - s * 0.9 + (k % 2) * s * 0.15, s * 0.1, s * 0.08); c.fillStyle = CREAM; c.fill(); } }
    if (land === 3) { c.strokeStyle = '#6a4422'; for (const [x0, y0, x1, y1] of [[0, H * 0.18, W * 0.3, H * 0.28], [W, H * 0.22, W * 0.68, H * 0.3]]) { c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo((x0 + x1) / 2, y0 - 20, x1, y1); ink(c, 14, '#6a4422'); for (let k = 0; k < 4; k++) { const lx = x0 + (x1 - x0) * (k + 0.5) / 4, ly = y0 + (y1 - y0) * (k + 0.5) / 4; blob(this.c, () => ell(c, lx, ly - 14, 18, 11, 0.4), k % 2 ? TEAL : '#3f9a76', 1.6, 2); } } }
    // the stage floor
    c.fillStyle = near; c.fillRect(0, H * 0.8, W, H * 0.2);
    c.fillStyle = floor; c.beginPath(); c.moveTo(-10, H * 0.84); c.lineTo(W + 10, H * 0.84); c.lineTo(W + 10, H); c.lineTo(-10, H); c.fill();
    for (let i = 0; i < 10; i++) { c.beginPath(); c.moveTo(0, H * 0.84 + i * H * 0.02); c.lineTo(W, H * 0.84 + i * H * 0.02); ink(c, 1, '#00000022'); }
  }

  private grid(L0: Look) {
    const c = this.c, L = this.lay!, g = L.grid, S = L0.song, steps = S.steps, t = L0.t;
    const lwid = Math.max(1.6, L.rh * 0.035);
    // the board: a cream card printed a little off its coral shadow
    c.fillStyle = CORAL; c.beginPath(); rr(c, g.x + 7, g.y + 7, g.w, g.h, 14); c.fill();
    c.fillStyle = CREAM; c.beginPath(); rr(c, g.x, g.y, g.w, g.h, 14); c.fill();
    // beat marks in the head strip
    const x0 = g.x + L.lw;
    for (let i = 0; i < steps; i++) {
      const x = x0 + i * L.cw + L.cw / 2, big = onBeat(steps, i), y = g.y + L.head * 0.55;
      if (big) { c.beginPath(); c.moveTo(x - L.head * 0.3, y - L.head * 0.25); c.lineTo(x + L.head * 0.3, y - L.head * 0.25); c.lineTo(x, y + L.head * 0.25); c.closePath(); c.fillStyle = MUSTARD; c.fill(); }
      else { c.beginPath(); ell(c, x, y, 2.2, 2.2); c.fillStyle = '#c9b48c'; c.fill(); }
    }
    // the playhead column
    if (L0.playing && L0.step >= 0) {
      const x = x0 + L0.step * L.cw, a = 0.35 + 0.35 * (1 - L0.phase);
      c.fillStyle = `rgba(232,103,74,${a.toFixed(3)})`; c.beginPath(); rr(c, x + 1, g.y + 2, L.cw - 2, g.h - 4, 6); c.fill();
      if (onBeat(steps, L0.step)) { starburst(c, x + L.cw / 2, g.y + L.head * 0.5, L.head * 0.2, L.head * 0.55 * (1.2 - L0.phase * 0.4), 8, t); c.fillStyle = CORAL; c.fill(); }
    }
    L.rows.forEach((m, r) => {
      const y = g.y + L.head + r * L.rh, row = S.rows.find((x) => x.m === m), col = MUSICIAN_COLOUR[m];
      if (!row) return;
      // the lane
      c.fillStyle = r % 2 ? PALE : '#f3e4c6'; c.fillRect(x0, y, L.cw * steps, L.rh);
      for (let i = 0; i < steps; i++) if (onBeat(steps, i)) { c.fillStyle = '#00000010'; c.fillRect(x0 + i * L.cw, y, L.cw, L.rh); }
      for (let i = 1; i < steps; i++) { c.beginPath(); c.moveTo(x0 + i * L.cw, y + 4); c.lineTo(x0 + i * L.cw, y + L.rh - 4); c.strokeStyle = onBeat(steps, i) ? '#b89a6a' : '#dccaa6'; c.lineWidth = onBeat(steps, i) ? 1.6 : 1; c.stroke(); }
      c.beginPath(); c.moveTo(g.x + 6, y); c.lineTo(g.x + g.w - 6, y); c.strokeStyle = '#cdb48a'; c.lineWidth = 1; c.stroke();
      // the label: tinted, with the musician playing their beats
      c.save(); c.beginPath(); rr(c, g.x + 4, y + 3, L.lw - 8, L.rh - 6, 10); c.fillStyle = col + '40'; c.fill(); c.restore();
      const hit = env(t, L0.hits[m], 8), bob = L0.playing ? Math.abs(Math.sin((L0.beat + L0.phase) * Math.PI)) : 0;
      const ms = Math.min(L.rh * 1.08, L.lw * 0.75);
      const named = L.lw >= 150, mx = named ? g.x + ms * 0.5 + 4 : g.x + L.lw * 0.42;
      c.save(); c.beginPath(); c.rect(g.x, y - L.rh * 0.25, L.lw, L.rh * 1.25); c.clip();
      drawMusician(c, m, mx, y + L.rh - 4, ms * 0.95, hit, t, bob);
      c.restore();
      if (named) {
        c.fillStyle = INK; c.textAlign = 'left'; c.textBaseline = 'middle';
        const fs = Math.round(Math.max(11, Math.min(20, L.rh * 0.26)));
        c.font = `${fs}px 'Righteous', sans-serif`; c.fillText(MUSICIANS[m].name, g.x + ms + 6, y + L.rh * 0.42, L.lw - ms - 30);
        c.font = `600 ${Math.round(fs * 0.78)}px 'Josefin Sans', sans-serif`; c.fillStyle = '#6a5440'; c.fillText(MUSICIANS[m].plays, g.x + ms + 6, y + L.rh * 0.68, L.lw - ms - 12);
      }
      if (!L0.locked) { const [bx, by, k] = this.xBox(L, y); c.beginPath(); ell(c, bx, by, k, k); c.fillStyle = CREAM; c.fill(); ink(c, 1.3); c.beginPath(); c.moveTo(bx - k * 0.4, by - k * 0.4); c.lineTo(bx + k * 0.4, by + k * 0.4); c.moveTo(bx + k * 0.4, by - k * 0.4); c.lineTo(bx - k * 0.4, by + k * 0.4); ink(c, 1.6, CORAL); }
      // the audience's rhythm rings (where the hummed notes go, not how high)
      const gd = L0.guide?.find((x) => x.m === m);
      if (gd) for (let i = 0; i < steps; i++) if (gd.n[i] >= 0) {
        c.save(); c.setLineDash([3, 3]); c.beginPath(); ell(c, x0 + i * L.cw + L.cw / 2, y + L.rh / 2, Math.min(L.cw, L.rh) * 0.36, L.rh * 0.38); c.strokeStyle = TEAL; c.lineWidth = 2; c.globalAlpha = 0.55 + 0.25 * Math.sin(t * 3 + i); c.stroke(); c.restore();
      }
      // the notes
      for (let i = 0; i < steps; i++) {
        const p = row.n[i]; if (p < 0) continue;
        const now = L0.playing && L0.step === i ? 1 - L0.phase : 0;
        this.note(m, p, x0 + i * L.cw, y, L.cw, L.rh, col, now, S.key, lwid);
      }
      // the hint glow
      if (L0.ghost && L0.ghost.m === m) {
        const gx = x0 + L0.ghost.step * L.cw, a = 0.5 + 0.5 * Math.sin(t * 6);
        c.save(); c.globalAlpha = 0.4 + a * 0.5; c.beginPath(); rr(c, gx + 2, y + 2, L.cw - 4, L.rh - 4, 8); c.strokeStyle = MUSTARD; c.lineWidth = 4; c.stroke();
        if (L0.ghost.p >= 0) { c.beginPath(); ell(c, gx + L.cw / 2, this.py(m, L0.ghost.p, y, L.rh), Math.min(L.cw, L.rh) * 0.28, Math.min(L.cw, L.rh) * 0.18); c.fillStyle = MUSTARD_L; c.fill(); }
        c.restore();
      }
      // the chosen cell, and the pitch being dragged
      const sel = L0.drag?.m === m ? L0.drag : L0.sel?.m === m ? L0.sel : null;
      if (sel) {
        const sx = x0 + sel.step * L.cw; c.beginPath(); rr(c, sx + 1.5, y + 1.5, L.cw - 3, L.rh - 3, 7); c.strokeStyle = INK; c.lineWidth = 2.5; c.stroke();
        if (L0.drag && L0.drag.p >= 0) {
          const label = pitchName(S.key, m, L0.drag.p), fs = Math.round(Math.max(14, Math.min(26, L.rh * 0.36)));
          c.font = `${fs}px 'Righteous', sans-serif`; const tw = c.measureText(label).width + 20;
          const bx = Math.min(g.x + g.w - tw - 4, Math.max(g.x + 4, sx + L.cw / 2 - tw / 2)), by = y - fs * 1.7;
          blob(c, () => rr(c, bx, by, tw, fs * 1.5, fs * 0.75), MUSTARD, 1.8, 2);
          c.fillStyle = INK; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(label, bx + tw / 2, by + fs * 0.78);
        }
      }
    });
    // the open seat for another musician
    if (L.add) {
      const y = g.y + L.head + L.rows.length * L.rh;
      const ah = L.rh * 0.6;
      c.save(); c.setLineDash([7, 6]); c.beginPath(); rr(c, g.x + 6, y + 4, g.w - 12, ah - 8, 10); c.strokeStyle = TEAL; c.lineWidth = 2; c.stroke(); c.restore();
      c.fillStyle = TEAL; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.font = `${Math.round(Math.max(13, Math.min(22, L.rh * 0.26)))}px 'Righteous', sans-serif`;
      c.fillText(L0.addLabel, g.x + g.w / 2, y + ah / 2);
    }
    c.beginPath(); rr(c, g.x, g.y, g.w, g.h, 14); ink(c, Math.max(2, lwid * 1.3));
  }
  /** One note in its cell: a drum dot, a block, a pill for a tune note, three stacked dots for a chord. */
  private note(m: MusicianId, p: number, x: number, y: number, w: number, h: number, col: string, now: number, key: number, lw: number) {
    const c = this.c, M = MUSICIANS[m], cx = x + w / 2, cy = this.py(m, p, y, h), k = 1 + now * 0.3, u = Math.min(w, h), v = Math.min(h * 0.4, Math.max(u, h * 0.3));
    c.save(); c.translate(cx, cy); c.scale(k, k);
    // narrow cells (sixteen steps on a phone) get notes that are taller than they are wide, so they stay easy to see
    const rx = (f: number) => Math.min(w * 0.44, v * f);
    if (M.kind === 'drum') {
      if (p === 0) blob(c, () => ell(c, 0, 0, rx(0.34), v * 0.3), CORAL, lw);
      else if (p === 1) blob(c, () => ell(c, 0, 0, rx(0.28), v * 0.24), MUSTARD, lw);
      else { c.save(); c.scale(rx(0.26) / (v * 0.26), 1); starburst(c, 0, 0, v * 0.1, v * 0.26, 6, 0.3); c.restore(); c.fillStyle = TEAL; c.fill(); ink(c, lw * 0.8); }
    } else if (M.kind === 'block') blob(c, () => rr(c, -rx(0.3), -v * 0.14, rx(0.3) * 2, v * 0.28, v * 0.05), col, lw);
    else if (M.kind === 'chord') { const r = Math.min(w * 0.17, u * 0.15); for (let i = 0; i < 3; i++) blob(c, () => ell(c, (i - 1) * r * 0.95, -i * r * 0.55 + r * 0.5, r, r), [col, CREAM, MUSTARD_L][i], lw * 0.8); }
    else { const hh = Math.max(u * 0.26, Math.min(h * 0.11, 12)); blob(c, () => rr(c, -Math.min(w * 0.42, u * 0.42), -hh / 2, Math.min(w * 0.84, u * 0.84), hh, hh / 2), col, lw); }
    // a name in the note when there is room
    if (u >= 34 && M.kind !== 'drum') {
      c.fillStyle = M.kind === 'chord' ? INK : CREAM; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.font = `${Math.round(u * 0.2)}px 'Righteous', sans-serif`;
      c.fillText(pitchName(key, m, p), 0, M.kind === 'chord' ? u * 0.32 : 1);
    }
    if (now > 0.5) { c.globalAlpha = now - 0.5; starburst(c, 0, 0, u * 0.2, u * 0.48, 8, 0); c.fillStyle = MUSTARD_L; c.fill(); }
    c.restore();
  }
  private audience(L0: Look, A: R4) {
    const c = this.c, n = Math.max(4, Math.min(12, Math.floor(A.w / (A.h * 0.75))));
    for (let i = 0; i < n; i++) {
      const x = A.x + (A.w * (i + 0.5)) / n, s = A.h * (0.85 + rnd(i + 3) * 0.15);
      drawFolk(c, FOLK[i % FOLK.length], x, A.y + A.h + s * 0.08, s, i, L0.t, L0);
    }
    if (L0.humming) { c.font = `700 ${Math.round(A.h * 0.3)}px 'Righteous', sans-serif`; c.fillStyle = CREAM; for (let i = 0; i < 4; i++) { const k = (L0.t * 0.6 + i / 4) % 1; c.globalAlpha = 1 - k; c.fillText(i % 2 ? '♪' : '♫', A.x + A.w * (0.2 + i * 0.2), A.y + A.h * 0.2 - k * A.h * 0.6); } c.globalAlpha = 1; }
  }
}

/** A portrait of one musician for the cast picker. */
export function portrait(cv: HTMLCanvasElement, m: MusicianId) {
  const c = cv.getContext('2d'); if (!c) return;
  const d = Math.min(2, window.devicePixelRatio || 1), w = 120, h = 110; cv.width = w * d; cv.height = h * d; c.setTransform(d, 0, 0, d, 0, 0);
  c.clearRect(0, 0, w, h);
  c.save(); c.globalAlpha = 0.5; starburst(c, w / 2, h * 0.55, 26, 52, 10, 0.2); c.fillStyle = MUSICIAN_COLOUR[m]; c.fill(); c.restore();
  drawMusician(c, m, w / 2 - (m === 'dora' || m === 'enzo' ? 0 : 6), h - 8, 92, 0, 0, 0);
}
/** The code-drawn stand-in for a painting (title or festival), shown until the painting loads. */
export function paintStandIn(cv: HTMLCanvasElement, which: 'title' | 'ending') {
  const c = cv.getContext('2d'); if (!c) return;
  const w = cv.width, h = cv.height, s = h / 256;
  c.setTransform(s, 0, 0, s, 0, 0);
  const W = w / s, H = 256;
  c.fillStyle = which === 'ending' ? '#141d36' : '#1f5b4c'; c.fillRect(0, 0, W, H);
  c.save(); c.globalAlpha = 0.3; starburst(c, W / 2, H * 0.5, 50, 230, 16, 0); c.fillStyle = MUSTARD; c.fill(); c.restore();
  if (which === 'ending') { blob(c, () => ell(c, W * 0.8, H * 0.2, 26, 26), CREAM, 2); }
  c.fillStyle = '#b8823c'; c.fillRect(0, H * 0.8, W, H * 0.2);
  const order: MusicianId[] = ['hedgehog', 'frog', 'owl', 'mole', 'woodpecker', 'birds'];
  order.forEach((m, i) => drawMusician(c, m, W * (0.08 + i * 0.168), H * 0.86 - (i % 2) * 6, 58, 0, i, 0));
  drawChin(c, 'dora', W * 0.4, H * 0.92, 120, { t: 0, hit: 0.2, bob: 0, face: 1, sing: 0.4, cheer: 0, blink: false });
  drawChin(c, 'enzo', W * 0.6, H * 0.92, 126, { t: 0, hit: 0.2, bob: 0, face: -1, sing: 0.4, cheer: 0, blink: false });
}
export { ORDER };
