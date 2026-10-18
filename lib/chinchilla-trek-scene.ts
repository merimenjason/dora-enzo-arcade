// Chinchilla Trek's drawing: the chapter's path scrolling by while the hero walks, the day's thing waiting on the path,
// the foes (all code-drawn from one round body), and the fight played back event by event. Canvas 2D, no state of its
// own: the page passes the trek, the replay and the time. Nothing moves while nothing is happening.
import { drawChinchilla } from './chinchilla-art';
import { arc, backOut, smooth, REST, type Pose } from './hay-bale-motion';
import { FOES, SCENES, SKILLS, EVOS, type ChapterNo, type FoeId, type FightEvent, type FightOut, type Hero, type Trek } from './chinchilla-trek-game';

export const STAGE = { w: 480, h: 320 };
const GROUND = 258, HERO_X = 150, FOE_X = 336;
type Box = { x: number; y: number; w: number; h: number };

// ── The path ───────────────────────────────────────────────────────────────

type Look = { sky: [string, string]; far: string; near: string; ground: string; path: string; prop: 'clover' | 'bush' | 'reed' | 'pine' | 'mushroom' };
const LOOKS: Record<ChapterNo, Look> = {
  1: { sky: ['#a9dcff', '#eaf7ff'], far: '#a7d987', near: '#82c35e', ground: '#8ccf68', path: '#ecd7a0', prop: 'clover' },
  2: { sky: ['#bcdcc0', '#eef5e0'], far: '#5f8f4f', near: '#4b7b3d', ground: '#6c9c4c', path: '#cfb47c', prop: 'bush' },
  3: { sky: ['#a8d6ef', '#e6f5fb'], far: '#8cc3a0', near: '#6fae7c', ground: '#8cc070', path: '#e2ce96', prop: 'reed' },
  4: { sky: ['#cfe5fb', '#f6fbff'], far: '#c9d8ea', near: '#e9f0f8', ground: '#f3f7fc', path: '#d4dce8', prop: 'pine' },
  5: { sky: ['#232552', '#4d4a8c'], far: '#34366a', near: '#3f4a74', ground: '#4b5a7c', path: '#7b7ba3', prop: 'mushroom' },
};
const wrap = (x: number, span: number) => ((x % span) + span) % span;

function hills(c: CanvasRenderingContext2D, off: number, y: number, amp: number, wave: number, fill: string) {
  c.fillStyle = fill; c.beginPath(); c.moveTo(0, STAGE.h);
  for (let x = 0; x <= STAGE.w; x += 8) c.lineTo(x, y - amp * (0.6 + 0.4 * Math.sin((x + off) / wave) * Math.cos((x + off) / (wave * 2.3))));
  c.lineTo(STAGE.w, STAGE.h); c.closePath(); c.fill();
}

function prop(c: CanvasRenderingContext2D, kind: Look['prop'], x: number, y: number, s: number) {
  c.save(); c.translate(x, y); c.scale(s, s);
  if (kind === 'clover') {
    c.fillStyle = '#4f9a3a';
    for (const [dx, dy] of [[-4, -10], [4, -10], [0, -16]]) { c.beginPath(); c.arc(dx, dy, 5, 0, Math.PI * 2); c.fill(); }
    c.fillRect(-1, -8, 2, 8); c.fillStyle = '#ffffff'; c.beginPath(); c.arc(14, -6, 3, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ffd34d'; c.beginPath(); c.arc(14, -6, 1.3, 0, Math.PI * 2); c.fill();
  } else if (kind === 'bush') {
    c.fillStyle = '#356b2c'; c.beginPath(); c.arc(-8, -10, 11, 0, Math.PI * 2); c.arc(8, -12, 12, 0, Math.PI * 2); c.arc(0, -18, 10, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#c0395a'; for (const [dx, dy] of [[-8, -14], [6, -8], [3, -20], [12, -16]]) { c.beginPath(); c.arc(dx, dy, 2.4, 0, Math.PI * 2); c.fill(); }
  } else if (kind === 'reed') {
    c.strokeStyle = '#5b8a3c'; c.lineWidth = 2;
    for (const dx of [-6, 0, 6]) { c.beginPath(); c.moveTo(dx, 0); c.quadraticCurveTo(dx + 2, -16, dx + 1, -30); c.stroke(); }
    c.fillStyle = '#7a4b2a'; for (const dx of [-5, 1, 7]) { c.beginPath(); c.ellipse(dx, -30, 2.2, 6, 0, 0, Math.PI * 2); c.fill(); }
  } else if (kind === 'pine') {
    c.fillStyle = '#4c7a5a';
    for (const [w, y0] of [[22, -12], [17, -24], [11, -35]]) { c.beginPath(); c.moveTo(-w, y0); c.lineTo(0, y0 - 18); c.lineTo(w, y0); c.closePath(); c.fill(); }
    c.fillStyle = '#ffffff';
    for (const [w, y0] of [[12, -26], [8, -37], [5, -47]]) { c.beginPath(); c.moveTo(-w, y0 + 2); c.lineTo(0, y0 - 6); c.lineTo(w, y0 + 2); c.closePath(); c.fill(); }
    c.fillStyle = '#6a4a32'; c.fillRect(-3, -12, 6, 12);
  } else {
    c.fillStyle = '#e8e2d0'; c.fillRect(-3, -12, 6, 12);
    c.fillStyle = '#8a7ad8'; c.beginPath(); c.ellipse(0, -13, 13, 8, 0, Math.PI, 0); c.fill();
    c.fillStyle = '#d8f0ff'; for (const dx of [-6, 0, 6]) { c.beginPath(); c.arc(dx, -16, 1.6, 0, Math.PI * 2); c.fill(); }
  }
  c.restore();
}

/** The chapter's sky, hills, ground and path, scrolled `dist` pixels along. */
export function drawPath(c: CanvasRenderingContext2D, chapter: ChapterNo, dist: number, now: number, calm: boolean) {
  const L = LOOKS[chapter], g = c.createLinearGradient(0, 0, 0, GROUND);
  g.addColorStop(0, L.sky[0]); g.addColorStop(1, L.sky[1]);
  c.fillStyle = g; c.fillRect(0, 0, STAGE.w, STAGE.h);
  if (chapter === 5) {
    c.fillStyle = '#fff6d8'; c.beginPath(); c.arc(388, 62, 24, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ffffff'; for (let i = 0; i < 24; i++) { const x = wrap(i * 97 - dist * 0.05, STAGE.w), y = 14 + ((i * 53) % 120); c.fillRect(x, y, 1.6, 1.6); }
  } else {
    c.fillStyle = chapter === 4 ? '#ffffffcc' : '#ffffffb0';
    for (let i = 0; i < 4; i++) { const x = wrap(i * 150 - dist * 0.06, STAGE.w + 120) - 60, y = 36 + (i % 2) * 26; c.beginPath(); c.ellipse(x, y, 34, 11, 0, 0, Math.PI * 2); c.ellipse(x + 20, y - 6, 22, 10, 0, 0, Math.PI * 2); c.fill(); }
  }
  if (chapter === 4) {
    c.fillStyle = L.far; c.beginPath(); c.moveTo(0, 200);
    for (let i = -1; i < 7; i++) { const x = i * 100 - wrap(dist * 0.15, 100); c.lineTo(x + 50, 92 + (i % 2) * 22); c.lineTo(x + 100, 200); }
    c.lineTo(STAGE.w, 200); c.lineTo(0, 200); c.fill();
  } else hills(c, dist * 0.15, 196, 46, 70, L.far);
  hills(c, dist * 0.4, 226, 30, 48, L.near);
  c.fillStyle = L.ground; c.fillRect(0, 222, STAGE.w, STAGE.h - 222);
  if (chapter === 3) { c.fillStyle = '#7cc2e6'; c.fillRect(0, 228, STAGE.w, 12); c.fillStyle = '#ffffff88'; for (let i = 0; i < 8; i++) c.fillRect(wrap(i * 70 - dist * 0.7, STAGE.w), 232, 18, 2); }
  // the path, with its edge stones scrolling at walking speed
  c.fillStyle = L.path; c.beginPath(); c.moveTo(0, 246); c.bezierCurveTo(160, 240, 320, 252, STAGE.w, 244); c.lineTo(STAGE.w, 284); c.bezierCurveTo(320, 290, 160, 280, 0, 288); c.closePath(); c.fill();
  c.fillStyle = '#00000014'; for (let i = 0; i < 12; i++) { const x = wrap(i * 46 - dist, STAGE.w + 40) - 20; c.beginPath(); c.ellipse(x, 290 + (i % 3) * 6, 5, 2.4, 0, 0, Math.PI * 2); c.fill(); }
  for (let i = 0; i < 6; i++) { const x = wrap(i * 96 + 30 - dist, STAGE.w + 80) - 40; prop(c, L.prop, x, 236 - (i % 2) * 4, 0.9 + (i % 3) * 0.12); }
  for (let i = 0; i < 4; i++) { const x = wrap(i * 140 + 80 - dist * 1.3, STAGE.w + 120) - 60; prop(c, L.prop, x, 318, 1.3); }
  if (chapter === 5 && !calm) {
    c.fillStyle = '#fff59a';
    for (let i = 0; i < 7; i++) { const t = now / 1000 + i * 1.7; c.globalAlpha = 0.4 + 0.4 * Math.sin(t * 2); c.beginPath(); c.arc(wrap(i * 71 + Math.sin(t) * 10 - dist * 0.5, STAGE.w), 150 + Math.sin(t * 0.7 + i) * 30, 2, 0, Math.PI * 2); c.fill(); }
    c.globalAlpha = 1;
  }
}

/** The walker's step and the scenery's distance: a whole day is 480 px of path. */
const DAY_PX = 480;

/** The thing waiting on the path today: a sign, a chest, the wheel, the Pedlar's cart, the Owl or the Fox. */
function landmark(c: CanvasRenderingContext2D, t: Trek, x: number) {
  const e = t.today;
  if (!e || e.k === 'fight' || t.phase === 'walk') return;
  c.save(); c.translate(x, GROUND);
  if (e.k === 'story') {
    c.fillStyle = '#8a5a34'; c.fillRect(-3, -54, 6, 54);
    c.fillStyle = '#c99a5a'; c.strokeStyle = '#6a4224'; c.lineWidth = 2; c.beginPath(); c.roundRect(-26, -64, 52, 22, 4); c.fill(); c.stroke();
    c.fillStyle = '#5a3418'; c.font = 'bold 14px ui-rounded, system-ui, sans-serif'; c.textAlign = 'center'; c.fillText('?', 0, -48);
  } else if (e.k === 'wheel') {
    const turn = e.prize === undefined ? 0 : -(e.prize + 0.5) * (Math.PI / 4);
    c.fillStyle = '#7a4b2a'; c.fillRect(-3, -40, 6, 40);
    for (let i = 0; i < 8; i++) { c.fillStyle = i === 7 ? '#c96a5a' : i >= 3 ? ['#ffd34d', '#8fd6a0', '#a8c8ff', '#f4a6c8'][i - 3] : '#f0e2b0'; c.beginPath(); c.moveTo(0, -58); c.arc(0, -58, 28, turn + (i * Math.PI) / 4 - Math.PI / 2, turn + ((i + 1) * Math.PI) / 4 - Math.PI / 2); c.closePath(); c.fill(); }
    c.strokeStyle = '#6a4224'; c.lineWidth = 2; c.beginPath(); c.arc(0, -58, 28, 0, Math.PI * 2); c.stroke();
    c.fillStyle = '#6a4224'; c.beginPath(); c.moveTo(-6, -92); c.lineTo(6, -92); c.lineTo(0, -82); c.fill();
  } else if (e.k === 'pedlar') {
    c.fillStyle = '#b5763c'; c.beginPath(); c.roundRect(-40, -46, 80, 34, 5); c.fill();
    c.fillStyle = '#e45b5b'; c.beginPath(); c.moveTo(-46, -46); c.lineTo(46, -46); c.lineTo(36, -70); c.lineTo(-36, -70); c.closePath(); c.fill();
    c.fillStyle = '#fff'; for (let i = -2; i <= 2; i++) c.fillRect(i * 16 - 4, -70, 8, 24);
    c.fillStyle = '#5a3a1e'; for (const dx of [-26, 26]) { c.beginPath(); c.arc(dx, -10, 10, 0, Math.PI * 2); c.fill(); }
  } else if (e.k === 'crossroads' || e.k === 'visit') {
    const who = e.k === 'visit' ? [e.who] : ['owl', 'fox'];
    who.forEach((w, i) => drawGuide(c, w as 'owl' | 'fox', (i - (who.length - 1) / 2) * 100, 0));
    if (e.k === 'crossroads') { c.fillStyle = '#8a5a34'; c.fillRect(-3, -70, 6, 70); c.fillStyle = '#c99a5a'; c.fillRect(-30, -70, 28, 10); c.fillRect(2, -58, 28, 10); }
  } else if (e.k === 'cache' || e.k === 'find') {
    c.fillStyle = '#9a6234'; c.beginPath(); c.roundRect(-20, -26, 40, 26, 4); c.fill();
    c.fillStyle = '#ffd34d'; c.fillRect(-20, -18, 40, 4); c.fillRect(-3, -22, 6, 10);
  } else if (e.k === 'rest') {
    c.fillStyle = '#a0c8e8'; c.beginPath(); c.ellipse(0, -6, 30, 8, 0, 0, Math.PI * 2); c.fill();
  }
  c.restore();
}

/** The Owl and the Fox, the trek's two visitors: friendly, from the same round body as the foes. */
function drawGuide(c: CanvasRenderingContext2D, who: 'owl' | 'fox', x: number, y: number) {
  critter(c, who === 'owl' ? GUIDES.owl : GUIDES.fox, x, y, 30, -1);
}

// ── Critters ───────────────────────────────────────────────────────────────

type Ear = 'round' | 'point' | 'long' | 'tuft' | 'none';
type Tail = 'thin' | 'fluffy' | 'stinger' | 'fan' | 'none';
type Extra = 'antenna' | 'shell' | 'bandana' | 'stripes' | 'spikes' | 'crown' | 'beak' | 'wings' | 'mask' | 'leaves' | 'snout' | 'claws' | 'fins' | 'horns' | 'glow' | 'hat' | 'blaze' | 'whiskers';
type Critter = { body: string; belly: string; ear: Ear; tail: Tail; extras: Extra[]; eye?: string };
const C = (body: string, belly: string, ear: Ear, tail: Tail, ...extras: Extra[]): Critter => ({ body, belly, ear, tail, extras });
const GUIDES = { owl: C('#a07850', '#f0dcb8', 'tuft', 'none', 'beak', 'wings'), fox: C('#e8823c', '#fff2e0', 'point', 'fluffy', 'whiskers') };
const LOOK: Record<FoeId, Critter> = {
  beetle: C('#3f6b3a', '#8fbf5a', 'none', 'none', 'antenna', 'shell'), mice: C('#a89a8c', '#f2d6d0', 'round', 'thin', 'bandana', 'whiskers'),
  toad: C('#7a9a3c', '#e2e0a0', 'none', 'none', 'blaze'), wasp: C('#f2c230', '#fff0a0', 'none', 'stinger', 'stripes', 'wings', 'antenna'),
  hedgepig: C('#9a7a5a', '#f0dcc0', 'round', 'none', 'spikes', 'snout'), kingmole: C('#5f4f63', '#e8b8c8', 'none', 'none', 'snout', 'claws', 'crown'),
  magpie: C('#2c2c3a', '#f4f4f8', 'none', 'fan', 'beak', 'wings'), stoat: C('#b67c4a', '#fff0d8', 'round', 'thin', 'whiskers'),
  sprite: C('#6aa84f', '#d8f0b8', 'point', 'none', 'leaves'), piglet: C('#c9a27a', '#f0d8c0', 'point', 'thin', 'stripes', 'snout'),
  raccoon: C('#8a8a92', '#e8e8ea', 'round', 'fluffy', 'mask', 'whiskers'), badger: C('#7a7a80', '#f0f0f0', 'round', 'none', 'blaze', 'crown'),
  crab: C('#e0603c', '#ffc0a0', 'none', 'none', 'claws', 'antenna'), heron: C('#8aa0b8', '#eef4fa', 'none', 'fan', 'beak', 'wings'),
  pike: C('#7a9a7a', '#e8f0d0', 'none', 'fan', 'fins'), vole: C('#8a6040', '#e8cca8', 'round', 'thin', 'whiskers'),
  turtle: C('#5a9a5a', '#e0e8a0', 'none', 'none', 'shell', 'snout'), otter: C('#7a5030', '#e8c8a0', 'round', 'fluffy', 'whiskers', 'hat'),
  snowhare: C('#f4f6fa', '#ffffff', 'long', 'fluffy', 'whiskers'), ptarmigan: C('#e8ecf0', '#ffffff', 'none', 'fan', 'beak', 'wings'),
  goatkid: C('#efe6d4', '#fff8ea', 'point', 'thin', 'horns'), imp: C('#9ad0f0', '#e0f4ff', 'point', 'thin', 'glow'),
  pika: C('#e6e0d8', '#ffffff', 'round', 'fluffy', 'whiskers'), foxqueen: C('#f4f6fb', '#ffffff', 'point', 'fluffy', 'whiskers', 'crown'),
  bat: C('#6a5a8a', '#b8a8d8', 'point', 'none', 'wings'), moth: C('#c8b8e0', '#f0e8ff', 'none', 'none', 'antenna', 'wings'),
  wisp: C('#a8f0f0', '#e8ffff', 'none', 'none', 'glow'), owlet: C('#9a7450', '#f0dcb8', 'tuft', 'none', 'beak', 'wings'),
  shadowcat: C('#4a4064', '#8a80a8', 'point', 'thin', 'whiskers'), hornedowl: C('#7a5a3a', '#e8d0a8', 'tuft', 'none', 'beak', 'wings', 'crown'),
};

/** A round critter with feet at (x, y), `r` the body's radius, looking left (-1) or right (1). */
function critter(c: CanvasRenderingContext2D, k: Critter, x: number, y: number, r: number, facing: -1 | 1) {
  const has = (e: Extra) => k.extras.includes(e), line = '#00000055';
  c.save(); c.translate(x, y - r); c.scale(facing, 1);
  c.lineWidth = Math.max(1.2, r / 18); c.strokeStyle = line;
  // tail, behind
  if (k.tail === 'thin') { c.strokeStyle = k.body; c.lineWidth = r / 8; c.beginPath(); c.moveTo(-r * 0.8, r * 0.5); c.quadraticCurveTo(-r * 1.6, r * 0.4, -r * 1.5, -r * 0.2); c.stroke(); c.lineWidth = Math.max(1.2, r / 18); c.strokeStyle = line; }
  if (k.tail === 'fluffy') { c.fillStyle = k.body; c.beginPath(); c.ellipse(-r * 1.05, r * 0.1, r * 0.45, r * 0.7, -0.5, 0, Math.PI * 2); c.fill(); c.stroke(); }
  if (k.tail === 'fan') { c.fillStyle = k.body; c.beginPath(); c.moveTo(-r * 0.7, r * 0.3); c.lineTo(-r * 1.5, -r * 0.1); c.lineTo(-r * 1.4, r * 0.6); c.closePath(); c.fill(); c.stroke(); }
  if (k.tail === 'stinger') { c.fillStyle = '#3a3020'; c.beginPath(); c.moveTo(-r * 0.85, r * 0.15); c.lineTo(-r * 1.35, r * 0.35); c.lineTo(-r * 0.85, r * 0.5); c.closePath(); c.fill(); }
  if (has('wings')) { c.fillStyle = has('stripes') || has('antenna') ? '#ffffffb0' : k.body; c.beginPath(); c.ellipse(-r * 0.3, -r * 0.55, r * 0.55, r * 0.32, -0.7, 0, Math.PI * 2); c.fill(); c.stroke(); }
  if (has('glow')) { const g = c.createRadialGradient(0, 0, r * 0.4, 0, 0, r * 1.6); g.addColorStop(0, k.body + 'aa'); g.addColorStop(1, k.body + '00'); c.fillStyle = g; c.beginPath(); c.arc(0, 0, r * 1.6, 0, Math.PI * 2); c.fill(); }
  // ears
  c.fillStyle = k.body;
  if (k.ear === 'round') for (const ex of [-0.45, 0.35]) { c.beginPath(); c.arc(r * ex, -r * 0.85, r * 0.3, 0, Math.PI * 2); c.fill(); c.stroke(); }
  if (k.ear === 'point' || k.ear === 'tuft') for (const ex of [-0.45, 0.35]) { c.beginPath(); c.moveTo(r * (ex - 0.22), -r * 0.7); c.lineTo(r * ex, -r * (k.ear === 'tuft' ? 1.25 : 1.35)); c.lineTo(r * (ex + 0.22), -r * 0.7); c.closePath(); c.fill(); c.stroke(); }
  if (k.ear === 'long') for (const ex of [-0.3, 0.2]) { c.beginPath(); c.ellipse(r * ex, -r * 1.25, r * 0.16, r * 0.55, ex * 0.4, 0, Math.PI * 2); c.fill(); c.stroke(); }
  if (has('horns')) { c.fillStyle = '#c8b090'; for (const ex of [-0.3, 0.3]) { c.beginPath(); c.moveTo(r * (ex - 0.1), -r * 0.8); c.quadraticCurveTo(r * (ex + 0.1), -r * 1.4, r * (ex + 0.25), -r * 1.2); c.lineTo(r * (ex + 0.1), -r * 0.78); c.fill(); } }
  if (has('spikes')) { c.fillStyle = '#6a4a32'; for (let i = 0; i < 7; i++) { const a = Math.PI * (0.65 + i * 0.13); c.beginPath(); c.moveTo(Math.cos(a) * r * 0.8, Math.sin(a) * -r * 0.8 * -1); c.lineTo(Math.cos(a) * r * 1.3, -Math.abs(Math.sin(a)) * r * 1.2); c.lineTo(Math.cos(a + 0.12) * r * 0.85, -Math.abs(Math.sin(a + 0.12)) * r * 0.85); c.fill(); } }
  // body and belly
  c.fillStyle = k.body; c.beginPath(); c.ellipse(0, 0, r, r * 0.92, 0, 0, Math.PI * 2); c.fill(); c.stroke();
  c.fillStyle = k.belly; c.beginPath(); c.ellipse(r * 0.18, r * 0.25, r * 0.6, r * 0.55, 0, 0, Math.PI * 2); c.fill();
  if (has('stripes')) { c.fillStyle = '#3a3020'; for (const sx of [-0.35, 0.05]) { c.beginPath(); c.ellipse(r * sx, 0, r * 0.1, r * 0.85, 0, 0, Math.PI * 2); c.fill(); } }
  if (has('shell')) { c.fillStyle = has('antenna') ? '#2f5a2a' : '#4a7a3a'; c.beginPath(); c.ellipse(-r * 0.25, -r * 0.15, r * 0.82, r * 0.72, 0, Math.PI * 0.9, Math.PI * 2.05); c.fill(); c.stroke(); }
  if (has('blaze')) { c.fillStyle = k.belly; c.beginPath(); c.ellipse(r * 0.45, -r * 0.45, r * 0.18, r * 0.4, 0.4, 0, Math.PI * 2); c.fill(); }
  if (has('leaves')) { c.fillStyle = '#3f8a3a'; for (const a of [-0.6, 0, 0.6]) { c.beginPath(); c.ellipse(Math.sin(a) * r * 0.5, -r * 0.95, r * 0.14, r * 0.32, a, 0, Math.PI * 2); c.fill(); } }
  // face: big friendly eyes, blush
  const eyeX = r * 0.5, eyeY = -r * 0.2;
  if (has('mask')) { c.fillStyle = '#3a3a42'; c.beginPath(); c.ellipse(eyeX, eyeY, r * 0.42, r * 0.2, 0, 0, Math.PI * 2); c.fill(); }
  for (const dx of [-0.16, 0.16]) {
    c.fillStyle = '#ffffff'; c.beginPath(); c.arc(eyeX + r * dx, eyeY, r * 0.15, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#2a2030'; c.beginPath(); c.arc(eyeX + r * dx + r * 0.03, eyeY + r * 0.02, r * 0.09, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ffffff'; c.beginPath(); c.arc(eyeX + r * dx + r * 0.06, eyeY - r * 0.03, r * 0.035, 0, Math.PI * 2); c.fill();
  }
  c.fillStyle = '#ff8aa066'; c.beginPath(); c.arc(eyeX + r * 0.3, eyeY + r * 0.28, r * 0.11, 0, Math.PI * 2); c.fill();
  if (has('beak')) { c.fillStyle = '#f0a030'; c.beginPath(); c.moveTo(r * 0.82, -r * 0.05); c.lineTo(r * (k.tail === 'fan' && k.body === '#8aa0b8' ? 1.5 : 1.15), r * 0.05); c.lineTo(r * 0.82, r * 0.16); c.closePath(); c.fill(); }
  else if (has('snout')) { c.fillStyle = k.belly; c.beginPath(); c.ellipse(r * 0.9, r * 0.08, r * 0.2, r * 0.15, 0, 0, Math.PI * 2); c.fill(); c.stroke(); c.fillStyle = '#5a3a3a'; c.beginPath(); c.arc(r * 0.98, r * 0.06, r * 0.035, 0, Math.PI * 2); c.fill(); }
  else { c.fillStyle = '#5a3a3a'; c.beginPath(); c.arc(r * 0.86, r * 0.05, r * 0.05, 0, Math.PI * 2); c.fill(); }
  if (has('whiskers')) { c.strokeStyle = '#00000044'; c.lineWidth = 1; for (const dy of [-0.02, 0.1]) { c.beginPath(); c.moveTo(r * 0.85, r * dy); c.lineTo(r * 1.3, r * (dy * 2 - 0.02)); c.stroke(); } c.strokeStyle = line; }
  if (has('antenna')) { c.strokeStyle = '#2a2a2a'; c.lineWidth = 1.5; for (const ex of [0.3, 0.55]) { c.beginPath(); c.moveTo(r * ex, -r * 0.75); c.quadraticCurveTo(r * (ex + 0.2), -r * 1.3, r * (ex + 0.4), -r * 1.25); c.stroke(); } }
  if (has('fins')) { c.fillStyle = k.body; c.beginPath(); c.moveTo(-r * 0.2, -r * 0.85); c.lineTo(r * 0.1, -r * 1.25); c.lineTo(r * 0.3, -r * 0.8); c.fill(); }
  if (has('claws')) { c.fillStyle = k.body; for (const [cx, cy] of [[0.95, 0.45], [0.6, 0.75]]) { c.beginPath(); c.arc(r * cx, r * cy, r * 0.22, 0.6, Math.PI * 2 - 0.2); c.lineTo(r * cx, r * cy); c.fill(); c.stroke(); } }
  if (has('bandana')) { c.fillStyle = '#e45b5b'; c.beginPath(); c.ellipse(r * 0.1, -r * 0.62, r * 0.7, r * 0.16, 0.05, 0, Math.PI * 2); c.fill(); }
  if (has('crown')) { c.fillStyle = '#ffd34d'; c.strokeStyle = '#a87618'; c.beginPath(); c.moveTo(-r * 0.32, -r * 0.82); c.lineTo(-r * 0.32, -r * 1.18); c.lineTo(-r * 0.14, -r * 1.0); c.lineTo(r * 0.04, -r * 1.24); c.lineTo(r * 0.2, -r * 1.0); c.lineTo(r * 0.38, -r * 1.18); c.lineTo(r * 0.38, -r * 0.82); c.closePath(); c.fill(); c.stroke(); }
  if (has('hat')) { c.fillStyle = '#2a3a6a'; c.beginPath(); c.moveTo(-r * 0.5, -r * 0.78); c.lineTo(r * 0.5, -r * 0.78); c.lineTo(0, -r * 1.25); c.closePath(); c.fill(); c.fillStyle = '#ffd34d'; c.beginPath(); c.arc(0, -r * 0.95, r * 0.07, 0, Math.PI * 2); c.fill(); }
  // feet
  c.fillStyle = k.body; c.strokeStyle = line; for (const fx of [-0.4, 0.4]) { c.beginPath(); c.ellipse(r * fx, r * 0.88, r * 0.22, r * 0.12, 0, 0, Math.PI * 2); c.fill(); c.stroke(); }
  c.restore();
}

/** A foe in `box` (feet on its bottom edge), facing left (-1) or right (1), moved by `pose`. Elites and bosses are bigger. */
export function drawFoe(c: CanvasRenderingContext2D, id: FoeId, box: Box, facing: -1 | 1, pose: Pose = REST) {
  if (pose.alpha <= 0) return;
  const rank = FOES[id].rank, r = Math.min(box.w, box.h) * (rank === 'boss' ? 0.34 : rank === 'elite' ? 0.3 : 0.26);
  const x = box.x + box.w / 2, y = box.y + box.h;
  c.save(); c.globalAlpha *= pose.alpha;
  c.translate(x + pose.dx, y + pose.dy); c.rotate(pose.rot); c.scale(pose.sx, pose.sy);
  c.fillStyle = '#00000022'; c.beginPath(); c.ellipse(0, 0, r * 0.9, r * 0.18, 0, 0, Math.PI * 2); c.fill();
  critter(c, LOOK[id], 0, 0, r, facing);
  c.restore();
}

// ── Walking ────────────────────────────────────────────────────────────────

const otherOf = (h: Hero): Hero => (h === 'dora' ? 'enzo' : 'dora');
/** Whether today's story names the other chinchilla, who then waits at the path's edge. */
const cameo = (t: Trek) => t.today?.k === 'story' && t.phase === 'event' && JSON.stringify(SCENES.find((s) => s.id === (t.today as { scene: string }).scene) ?? '').includes('{other}');

/** The walk: the path scrolls while `step` goes from 0 to 1, then the day's landmark waits ahead. */
export function drawWalk(c: CanvasRenderingContext2D, t: Trek, step: number, now: number, calm: boolean) {
  const walking = step < 1, dist = (t.day - 1 + Math.min(1, step)) * DAY_PX;
  drawPath(c, t.chapter, dist, now, calm);
  if (!walking) landmark(c, t, 356);
  if (!walking && cameo(t)) drawChinchilla(c, otherOf(t.hero), 300, GROUND - 4, { face: -1, h: 46, time: 0 });
  shadow(c, HERO_X, GROUND, 26);
  drawChinchilla(c, t.hero, HERO_X, GROUND, { face: 1, h: 62, time: calm || !walking ? 0 : now / 1000, moving: walking && !calm, run: walking && !calm ? (now / 1000) * 16 : undefined });
}
const shadow = (c: CanvasRenderingContext2D, x: number, y: number, w: number) => { c.fillStyle = '#00000022'; c.beginPath(); c.ellipse(x, y, w, w * 0.2, 0, 0, Math.PI * 2); c.fill(); };

/** The title: both chinchillas on the meadow path. */
export function drawTitle(c: CanvasRenderingContext2D) {
  drawPath(c, 1, 120, 0, true);
  shadow(c, 190, GROUND, 26); shadow(c, 286, GROUND, 26);
  drawChinchilla(c, 'dora', 190, GROUND, { face: 1, h: 66, time: 0.4 });
  drawChinchilla(c, 'enzo', 286, GROUND, { face: -1, h: 66, time: 1.1 });
}

// ── Fights ─────────────────────────────────────────────────────────────────

/** A fight played back: event `i` is playing, `t` seconds in. `hp0` and `max` are the hero's HP before it and max HP. */
export type Replay = { foe: FoeId; out: FightOut; i: number; t: number; speed: 1 | 2; hp0: number; max: number };
/** Seconds an event takes at ×1: round markers and callouts are quicker than blows. */
export const eventTime = (e: FightEvent | undefined) => (!e ? 0 : e.k === 'round' ? 0.12 : e.k === 'skill' || e.k === 'shield' ? 0.22 : e.k === 'end' ? 0.5 : 0.3);
const WALK_IN = 0.5;

/** Moves the replay on by `dt` seconds; true once it has played to the end. */
export function stepReplay(r: Replay, dt: number): boolean {
  const n = r.out.events.length;
  r.t += dt * r.speed;
  for (;;) {
    if (r.i >= n) { r.t = 0; return true; }
    const d = (r.i === 0 ? WALK_IN : 0) + eventTime(r.out.events[r.i]);
    if (r.t < d) return false;
    r.t -= d; r.i++;
  }
}

/** Where the fight stands after the first `n` events. */
export function replayState(r: Replay, n: number) {
  let hp = r.hp0, foeHp = r.out.foeHp, shield = 0, round = 0, burn = false, heroCold = 0, foeCold = 0;
  for (const e of r.out.events.slice(0, n)) {
    if (e.k === 'round') round = e.n;
    else if (e.k === 'hit') { if (e.side === 0) hp = e.hp; else { foeHp = e.hp; if (e.src === 'burn') burn = true; } }
    else if (e.k === 'heal') { if (e.side === 0) hp = e.hp; else foeHp = e.hp; }
    else if (e.k === 'wind') hp = e.hp;
    else if (e.k === 'shield') shield = e.n;
    else if (e.k === 'freeze') { if (e.side === 0) heroCold = round + 2; else foeCold = round + 1; }
  }
  return { hp, foeHp, shield, round, burn, heroCold: heroCold > round, foeCold: foeCold > round };
}

function bar(c: CanvasRenderingContext2D, x: number, y: number, w: number, v: number, max: number, fill: string) {
  c.fillStyle = '#00000055'; c.beginPath(); c.roundRect(x - w / 2 - 2, y - 2, w + 4, 10, 5); c.fill();
  c.fillStyle = fill; c.beginPath(); c.roundRect(x - w / 2, y, Math.max(0, Math.min(w, (w * v) / max)), 6, 3); c.fill();
  c.fillStyle = '#fff'; c.font = 'bold 11px ui-rounded, system-ui, sans-serif'; c.textAlign = 'center'; c.fillText(`${v}`, x, y - 4);
}
function words(c: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, fill: string, alpha = 1) {
  c.save(); c.globalAlpha *= Math.max(0, alpha); c.font = `900 ${size}px ui-rounded, 'Trebuchet MS', system-ui, sans-serif`; c.textAlign = 'center';
  c.lineWidth = Math.max(3, size / 5); c.strokeStyle = '#2a1a10'; c.lineJoin = 'round'; c.strokeText(text, x, y); c.fillStyle = fill; c.fillText(text, x, y); c.restore();
}
function bolt(c: CanvasRenderingContext2D, x: number, y: number, p: number) {
  c.save(); c.globalAlpha = 1 - p; c.strokeStyle = '#fff36a'; c.lineWidth = 4; c.lineJoin = 'round';
  c.beginPath(); c.moveTo(x - 6, y - 90); c.lineTo(x + 6, y - 60); c.lineTo(x - 4, y - 56); c.lineTo(x + 8, y - 24); c.stroke();
  c.strokeStyle = '#ffffff'; c.lineWidth = 1.5; c.stroke(); c.restore();
}
function flake(c: CanvasRenderingContext2D, x: number, y: number) {
  c.save(); c.strokeStyle = '#8fd0ff'; c.lineWidth = 2.5; c.translate(x, y);
  for (let i = 0; i < 3; i++) { c.rotate(Math.PI / 3); c.beginPath(); c.moveTo(-9, 0); c.lineTo(9, 0); c.stroke(); }
  c.restore();
}
function flame(c: CanvasRenderingContext2D, x: number, y: number) {
  c.fillStyle = '#ff8a3a'; c.beginPath(); c.moveTo(x, y - 14); c.quadraticCurveTo(x + 8, y - 4, x, y); c.quadraticCurveTo(x - 8, y - 4, x, y - 14); c.fill();
  c.fillStyle = '#ffd34d'; c.beginPath(); c.arc(x, y - 4, 3, 0, Math.PI * 2); c.fill();
}
const skillName = (id: string) => (id in SKILLS ? SKILLS[id as keyof typeof SKILLS].name : EVOS[id as keyof typeof EVOS].name);

/** The fight: the foe walks in, blows land with numbers, callouts name the skills, and the loser tumbles off. */
export function drawFight(c: CanvasRenderingContext2D, r: Replay, t: Trek, now: number, calm: boolean) {
  const ev = r.out.events, e = ev[r.i], intro = r.i === 0 ? Math.min(1, r.t / WALK_IN) : 1;
  const p = r.i === 0 ? Math.max(0, (r.t - WALK_IN) / eventTime(e)) : r.t / Math.max(0.01, eventTime(e));
  const s = replayState(r, r.i + (e && p >= 0.5 ? 1 : 0)), done = r.i >= ev.length, result = r.out.result;
  drawPath(c, t.chapter, (t.day - 1) * DAY_PX + DAY_PX, now, calm);
  const lunge = calm ? 4 : 22;
  const hero = { ...REST }, foe = { ...REST };
  if (e?.k === 'attack') (e.side === 0 ? hero : foe).dx = (e.side === 0 ? 1 : -1) * lunge * arc(p);
  if (e?.k === 'hit' && !calm) { const k = arc(Math.min(1, p * 1.6)) * (1 - p); const who = e.side === 0 ? hero : foe; who.dx += (e.side === 0 ? -1 : 1) * 8 * k; who.sx = 1 + 0.1 * k; who.sy = 1 - 0.1 * k; }
  if (e?.k === 'dodge' && !calm) (e.side === 0 ? hero : foe).dy = -18 * arc(p);
  // the end: the foe tumbles off (it's fine, just dizzy), or the hero sits down dizzy
  const endP = done ? 1 : e?.k === 'end' ? p : 0;
  if (result === 'win' && endP > 0) { const q = smooth(endP); Object.assign(foe, calm ? { alpha: 1 - q } : { dx: 120 * q, dy: -30 * arc(q) + 20 * q * q, rot: 1.6 * q, alpha: 1 - q }); }
  if (result === 'stall' && endP > 0) Object.assign(foe, { dx: 160 * smooth(endP), alpha: 1 - endP });
  const foeX = FOE_X + (calm ? 0 : (1 - backOut(intro)) * 200);
  shadow(c, HERO_X + hero.dx, GROUND, 26);
  drawChinchilla(c, t.hero, HERO_X + hero.dx, GROUND + hero.dy, { face: 1, h: 62, time: 0, dizzy: result === 'loss' && endP > 0, air: hero.dy < -2 });
  if (s.shield > 0) { c.save(); c.globalAlpha = 0.35; c.fillStyle = '#9fe0ff'; c.strokeStyle = '#ffffff'; c.lineWidth = 2; c.beginPath(); c.ellipse(HERO_X + hero.dx, GROUND - 32, 44, 40, 0, 0, Math.PI * 2); c.fill(); c.globalAlpha = 0.8; c.stroke(); c.restore(); }
  if (s.heroCold) flake(c, HERO_X + 26, GROUND - 70);
  drawFoe(c, r.foe, { x: foeX - 60, y: GROUND - 120, w: 120, h: 120 }, -1, foe);
  if (s.foeCold && endP === 0) flake(c, foeX - 24, GROUND - 92);
  if (s.burn && endP === 0) flame(c, foeX + 30, GROUND - 70);
  // bars
  bar(c, HERO_X, 92, 84, s.hp, r.max, s.hp < r.max * 0.3 ? '#ff6a5a' : '#6ad06a');
  if (s.shield > 0) { c.fillStyle = '#9fe0ff'; c.font = 'bold 11px ui-rounded, system-ui, sans-serif'; c.textAlign = 'center'; c.fillText(`🛡 ${s.shield}`, HERO_X, 116); }
  bar(c, FOE_X, 92, 84, s.foeHp, r.out.foeHp, '#ffb347');
  words(c, FOES[r.foe].name, FOE_X, 64, 14, '#fff6e4');
  // what just happened
  if (e && p > 0) {
    const x = e.k !== 'round' && 'side' in e && e.side === 0 ? HERO_X : FOE_X, rise = calm ? 0 : 24 * p;
    if (e.k === 'hit') {
      if (e.src === 'zap') bolt(c, x, GROUND - 40, p);
      const col = e.side === 0 ? '#ff9a8a' : e.crit ? '#ffd34d' : e.src === 'burn' ? '#ffb070' : e.src === 'zap' ? '#fff36a' : '#ffffff';
      words(c, `-${e.dmg}`, x + 20, GROUND - 110 - rise, e.crit ? 30 : 22, col, 1.4 - p);
      if (e.crit) words(c, 'Crit!', x + 20, GROUND - 140 - rise, 16, '#ffd34d', 1.4 - p);
    } else if (e.k === 'heal') words(c, `+${e.n}`, x - 20, GROUND - 110 - rise, 20, '#8af08a', 1.4 - p);
    else if (e.k === 'dodge') words(c, 'Dodge!', x, GROUND - 120 - rise, 18, '#bfe6ff', 1.4 - p);
    else if (e.k === 'wind') words(c, 'Second Wind!', HERO_X, GROUND - 140 - rise, 20, '#8af08a', 1.6 - p);
    else if (e.k === 'freeze') words(c, 'Frozen!', x, GROUND - 130 - rise, 18, '#8fd0ff', 1.4 - p);
  }
  // skill callouts stay up while the blow they start plays
  const lastSkill = [e, ev[r.i - 1]].find((x) => x?.k === 'skill') as Extract<FightEvent, { k: 'skill' }> | undefined;
  if (lastSkill) words(c, `${skillName(lastSkill.id)}!`, STAGE.w / 2, 40, 20, '#ffd34d', e === lastSkill ? 1 : 1 - p);
  if (done || e?.k === 'end') {
    const a = done ? 1 : p;
    words(c, result === 'win' ? 'Victory!' : result === 'loss' ? 'Too tired…' : 'It wandered off', STAGE.w / 2, 168, 32, result === 'win' ? '#ffd34d' : '#fff6e4', a);
  }
}

/** One gear piece: a little hat, scarf, charm or boot in its rarity's colour. */
export const RARITY_COLOUR = ['#d8d0c0', '#8fd6a0', '#7ab8ff', '#c49aff', '#ffcf4a'] as const;
export function drawPiece(c: CanvasRenderingContext2D, slot: 'hat' | 'scarf' | 'charm' | 'boots', r: number, x: number, y: number, s: number) {
  const col = RARITY_COLOUR[r];
  c.save(); c.translate(x, y); c.scale(s, s); c.fillStyle = col; c.strokeStyle = '#3a2614'; c.lineWidth = 2;
  if (slot === 'hat') { c.beginPath(); c.ellipse(0, 6, 18, 5, 0, 0, Math.PI * 2); c.fill(); c.stroke(); c.beginPath(); c.moveTo(-11, 5); c.quadraticCurveTo(0, -22, 11, 5); c.fill(); c.stroke(); }
  else if (slot === 'scarf') { c.beginPath(); c.roundRect(-16, -6, 32, 10, 5); c.fill(); c.stroke(); c.beginPath(); c.roundRect(4, 0, 8, 18, 3); c.fill(); c.stroke(); }
  else if (slot === 'charm') { c.beginPath(); c.moveTo(0, -14); c.lineTo(12, 0); c.lineTo(0, 14); c.lineTo(-12, 0); c.closePath(); c.fill(); c.stroke(); c.fillStyle = '#ffffff99'; c.beginPath(); c.arc(-3, -3, 3, 0, Math.PI * 2); c.fill(); }
  else { c.beginPath(); c.moveTo(-8, -14); c.lineTo(4, -14); c.lineTo(4, 4); c.lineTo(14, 6); c.lineTo(14, 12); c.lineTo(-8, 12); c.closePath(); c.fill(); c.stroke(); }
  c.restore();
}
