// Hay Bale Brawl's drawing: the shop and the fight replay on a 480 × 320 stage, in Canvas 2D. Every critter is drawn
// in code from a shared round body with its own colours and features; the chinchillas use the arcade's drawChinchilla.
import { UNITS, SNACKS, TOKENS, isUnitId, type Run, type Slot, type Unit, type UnitId, type TokenId, type SnackId, type Outcome, type FightEvent } from './hay-bale-game';
import { drawChinchilla, coatLike, type Coat } from './chinchilla-art';

export const STAGE = { w: 480, h: 320 };
export type Box = { x: number; y: number; w: number; h: number };
export type Held = { from: 'line' | 'unit' | 'snack'; i: number };
export type ShopUi = { held: Held | null; dragging: boolean; x: number; y: number; card: Held | null };

/** Where everything is in the shop, front slot first. The page tests pointer positions against these boxes. */
export const LAYOUT = {
  line: [0, 1, 2, 3, 4].map((i): Box => ({ x: 334 - i * 64, y: 40, w: 58, h: 84 })),
  sell: { x: 398, y: 46, w: 72, h: 72 } as Box,
  units: [0, 1, 2, 3, 4, 5, 6].map((i): Box => ({ x: 8 + i * 50, y: 178, w: 48, h: 84 })),
  snacks: [0, 1].map((i): Box => ({ x: 368 + i * 54, y: 178, w: 50, h: 84 })),
};
const FIGHT_Y = 118, FIGHT_W = 40, FIGHT_H = 88;
const fightBox = (side: 0 | 1, i: number): Box => ({ x: side === 0 ? 176 - i * 44 : 262 + i * 44, y: FIGHT_Y, w: FIGHT_W, h: FIGHT_H });
export const inBox = (b: Box, x: number, y: number) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;

const INK = '#3a2614', CREAM = '#fff4dc', HAY = '#e8c065', HAY_DARK = '#b98a2e', SKY = '#bfe3f2';

// ── Critters ───────────────────────────────────────────────────────────────

type Look = { body: string; belly: string; kind: 'mammal' | 'bird' | 'bug' | 'frog' | 'shell'; ear?: 'round' | 'long' | 'point' | 'none'; extra?: string };
const LOOKS: Record<Exclude<UnitId, 'pip' | 'duchess'> | TokenId, Look> = {
  wren: { body: '#9a6b43', belly: '#e8cfa6', kind: 'bird' }, mouse: { body: '#a88c74', belly: '#efe0cc', kind: 'mammal', ear: 'round' },
  ladybird: { body: '#d8382f', belly: '#2a2a2a', kind: 'bug', extra: 'spots' }, toad: { body: '#8a8a4a', belly: '#d9cf98', kind: 'frog', extra: 'warts' },
  bee: { body: '#f2c230', belly: '#2b2412', kind: 'bug', extra: 'stripes' }, dormouse: { body: '#d49a52', belly: '#f5e3c2', kind: 'mammal', ear: 'round', extra: 'sleepy' },
  hedgehog: { body: '#7a5a3c', belly: '#e6cfa8', kind: 'mammal', ear: 'none', extra: 'spines' }, squirrel: { body: '#c2612b', belly: '#f2d7b2', kind: 'mammal', ear: 'point', extra: 'tail' },
  robin: { body: '#7d5a3c', belly: '#e8622f', kind: 'bird' }, mole: { body: '#3d3540', belly: '#5d5460', kind: 'mammal', ear: 'none', extra: 'snout' },
  frog: { body: '#4fa04a', belly: '#c9e6a0', kind: 'frog' }, badger: { body: '#6c6a70', belly: '#2a282c', kind: 'mammal', ear: 'round', extra: 'stripe' },
  otter: { body: '#7a5236', belly: '#d9b98f', kind: 'mammal', ear: 'round' }, magpie: { body: '#26262e', belly: '#f4f4f4', kind: 'bird', extra: 'blue' },
  rabbit: { body: '#b9a58e', belly: '#f2ece2', kind: 'mammal', ear: 'long' }, porcupine: { body: '#5a4a3c', belly: '#c7b49a', kind: 'mammal', ear: 'none', extra: 'quills' },
  beaver: { body: '#7a4e2c', belly: '#c79a6c', kind: 'mammal', ear: 'round', extra: 'teeth' }, stoat: { body: '#b7773e', belly: '#f6efe2', kind: 'mammal', ear: 'round', extra: 'black-tip' },
  tortoise: { body: '#8a9a52', belly: '#c9b37a', kind: 'shell' }, crow: { body: '#1f1d26', belly: '#3a3846', kind: 'bird' },
  skunk: { body: '#26242c', belly: '#f4f4f4', kind: 'mammal', ear: 'round', extra: 'stripe' }, raccoon: { body: '#8a8790', belly: '#d9d6dc', kind: 'mammal', ear: 'point', extra: 'mask' },
  hare: { body: '#a67c52', belly: '#efe0cc', kind: 'mammal', ear: 'long' }, boar: { body: '#5a4434', belly: '#8a7058', kind: 'mammal', ear: 'point', extra: 'tusks' },
  bear: { body: '#6e4a2e', belly: '#a77e58', kind: 'mammal', ear: 'round' }, stag: { body: '#a0683a', belly: '#e9d2ae', kind: 'mammal', ear: 'point', extra: 'antlers' },
  hawk: { body: '#8a5a32', belly: '#efe0c4', kind: 'bird', extra: 'hook' }, goose: { body: '#f2f0ea', belly: '#ffffff', kind: 'bird', extra: 'orange' },
  mouselet: { body: '#c4a88e', belly: '#f5ead9', kind: 'mammal', ear: 'round' }, log: { body: '#8a5a32', belly: '#c79a62', kind: 'shell', extra: 'log' },
  fawn: { body: '#c08250', belly: '#f2dcc0', kind: 'mammal', ear: 'point', extra: 'dots' },
};
const PIP: Coat = coatLike('enzo', { fur: '#a9a7b0', back: '#8d8b95', face: '#bbb9c3', bands: false });
const DUCHESS: Coat = coatLike('dora', { fur: '#f2d27a', back: '#e2b85a', face: '#f7e09a', shade: '#cfa648', texture: '#e0bc60', tail: '#f0cf78', tailOuter: '#fbe39c', tailInner: '#d6ad52' });

/** A critter standing in `box`, facing right (1) or left (−1). */
export function drawCritter(c: CanvasRenderingContext2D, id: UnitId | TokenId, box: Box, facing: 1 | -1, time = 0) {
  const cx = box.x + box.w / 2, base = box.y + box.h, s = Math.min(box.w / 46, box.h / 50);
  if (id === 'pip' || id === 'duchess') {
    drawChinchilla(c, id === 'pip' ? PIP : DUCHESS, cx, base - 2 * s, { face: facing, h: (id === 'pip' ? 34 : 42) * s, time });
    if (id === 'duchess') { c.fillStyle = '#ffd34d'; c.strokeStyle = INK; c.lineWidth = 1.2; c.beginPath(); const tx = cx - 2 * s * facing, ty = base - 42 * s; c.moveTo(tx - 7 * s, ty + 5 * s); c.lineTo(tx - 7 * s, ty - 3 * s); c.lineTo(tx - 3 * s, ty + 1 * s); c.lineTo(tx, ty - 5 * s); c.lineTo(tx + 3 * s, ty + 1 * s); c.lineTo(tx + 7 * s, ty - 3 * s); c.lineTo(tx + 7 * s, ty + 5 * s); c.closePath(); c.fill(); c.stroke(); }
    return;
  }
  const L = LOOKS[id];
  c.save();
  c.translate(cx, base - 2 * s); c.scale(facing * s, s);
  c.lineWidth = 1.6; c.strokeStyle = INK;
  const blob = (x: number, y: number, rx: number, ry: number, fill: string) => { c.fillStyle = fill; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill(); c.stroke(); };
  const bob = Math.sin(time * 3 + cx) * 0.6;
  if (L.extra === 'log') {
    c.fillStyle = L.body; c.beginPath(); c.roundRect(-24, -26, 48, 24, 6); c.fill(); c.stroke();
    blob(24, -14, 6, 12, L.belly); c.beginPath(); c.ellipse(24, -14, 3, 7, 0, 0, Math.PI * 2); c.stroke();
    c.restore(); return;
  }
  if (L.kind === 'shell') {
    blob(16, -12 + bob, 7, 6, L.belly);
    c.fillStyle = L.body; c.beginPath(); c.ellipse(-2, -14, 20, 15, 0, Math.PI, 0); c.closePath(); c.fill(); c.stroke();
    c.strokeStyle = '#5a6a32'; c.beginPath(); c.moveTo(-12, -14); c.lineTo(-6, -24); c.lineTo(4, -24); c.lineTo(10, -14); c.stroke();
    c.strokeStyle = INK; c.fillStyle = INK; c.beginPath(); c.arc(19, -14 + bob, 1.3, 0, Math.PI * 2); c.fill();
    c.restore(); return;
  }
  if (L.extra === 'tail') blob(-18, -26, 9, 16, L.body);
  if (L.extra === 'spines' || L.extra === 'quills') {
    c.fillStyle = L.extra === 'quills' ? '#3a2e24' : '#5a3e26';
    for (let k = 0; k < 7; k++) { const a = Math.PI * (0.95 + k * 0.13); c.beginPath(); c.moveTo(Math.cos(a) * 14 - 2, -16 + Math.sin(a) * 12); c.lineTo(Math.cos(a) * (L.extra === 'quills' ? 28 : 24) - 2, -16 + Math.sin(a) * (L.extra === 'quills' ? 26 : 22)); c.lineTo(Math.cos(a + 0.12) * 14 - 2, -16 + Math.sin(a + 0.12) * 12); c.fill(); c.stroke(); }
  }
  if (L.kind === 'bug') {
    blob(0, -16 + bob, 17, 14, L.body);
    if (L.extra === 'stripes') { c.fillStyle = L.belly; for (const x of [-7, 1]) c.fillRect(x, -29 + bob, 4, 26); c.beginPath(); c.ellipse(0, -16 + bob, 17, 14, 0, 0, Math.PI * 2); c.stroke(); c.fillStyle = '#ffffffaa'; blob(-4, -32 + bob, 8, 5, '#ffffffbb'); }
    else { c.fillStyle = L.belly; for (const [x, y] of [[-6, -20], [5, -12], [-3, -9], [6, -22]]) { c.beginPath(); c.arc(x, y + bob, 2.6, 0, Math.PI * 2); c.fill(); } c.beginPath(); c.moveTo(0, -30 + bob); c.lineTo(0, -2 + bob); c.stroke(); }
    blob(16, -16 + bob, 7, 7, '#2a2a2a');
    c.fillStyle = '#fff'; c.beginPath(); c.arc(19, -18 + bob, 1.8, 0, Math.PI * 2); c.fill();
    c.restore(); return;
  }
  if (L.kind === 'frog') {
    blob(0, -12, 20, 12, L.body); blob(0, -9, 14, 7, L.belly);
    blob(-6, -24 + bob, 6, 6, L.body); blob(8, -24 + bob, 6, 6, L.body);
    c.fillStyle = INK; for (const x of [-5, 9]) { c.beginPath(); c.arc(x, -24 + bob, 2.2, 0, Math.PI * 2); c.fill(); }
    if (L.extra === 'warts') { c.fillStyle = '#6a6a36'; for (const [x, y] of [[-10, -14], [-2, -18], [10, -12]]) { c.beginPath(); c.arc(x, y, 1.6, 0, Math.PI * 2); c.fill(); } }
    c.beginPath(); c.moveTo(6, -14); c.quadraticCurveTo(14, -10, 18, -15); c.stroke();
    c.restore(); return;
  }
  const big = id === 'bear' || id === 'boar' || id === 'stag' ? 1.15 : 1;
  c.scale(big, big);
  // body and head
  blob(-3, -15, 17, 13, L.body); blob(-1, -11, 11, 7, L.belly);
  const hx = L.kind === 'bird' ? 11 : 13, hy = -26 + bob;
  if (L.extra === 'antlers') { c.strokeStyle = '#6a4a2a'; c.lineWidth = 2.2; for (const d of [-4, 4]) { c.beginPath(); c.moveTo(hx + d, hy - 8); c.lineTo(hx + d * 2.2, hy - 22); c.moveTo(hx + d * 1.6, hy - 15); c.lineTo(hx + d * 3, hy - 17); c.stroke(); } c.strokeStyle = INK; c.lineWidth = 1.6; }
  if (L.ear === 'round') { blob(hx - 6, hy - 9, 4.5, 4.5, L.body); blob(hx + 4, hy - 10, 4.5, 4.5, L.body); }
  if (L.ear === 'long') { blob(hx - 4, hy - 16, 3.5, 10, L.body); blob(hx + 3, hy - 17, 3.5, 10, L.body); }
  if (L.ear === 'point') for (const d of [-5, 4]) { c.fillStyle = L.body; c.beginPath(); c.moveTo(hx + d - 4, hy - 5); c.lineTo(hx + d, hy - 15); c.lineTo(hx + d + 4, hy - 5); c.closePath(); c.fill(); c.stroke(); }
  blob(hx, hy, 10, 9, L.kind === 'bird' && L.extra !== 'orange' ? L.body : L.body);
  if (L.kind === 'bird') {
    blob(-6, -17, 11, 7, L.extra === 'blue' ? '#2f5f9a' : L.body);
    c.fillStyle = L.extra === 'orange' ? '#f08a2a' : L.extra === 'hook' ? '#e8c04a' : '#3a2e24';
    c.beginPath(); c.moveTo(hx + 8, hy - 2); c.lineTo(hx + 17, hy + (L.extra === 'hook' ? 3 : 0)); c.lineTo(hx + 8, hy + 3); c.closePath(); c.fill(); c.stroke();
  } else {
    blob(hx + 9, hy + 2, 3.5, 3, L.extra === 'snout' ? '#e89aa0' : L.belly);
    c.fillStyle = INK; c.beginPath(); c.arc(hx + 12, hy + 1, 1.3, 0, Math.PI * 2); c.fill();
  }
  if (L.extra === 'mask') { c.fillStyle = '#2a282c'; c.beginPath(); c.ellipse(hx + 3, hy - 1, 7, 3.2, 0, 0, Math.PI * 2); c.fill(); }
  if (L.extra === 'stripe') { c.fillStyle = id === 'skunk' ? '#f4f4f4' : '#f4f4f4'; c.beginPath(); c.ellipse(hx - 1, hy - 4, 8, 2.4, -0.2, 0, Math.PI * 2); c.fill(); if (id === 'skunk') { c.beginPath(); c.ellipse(-6, -26, 13, 2.6, 0.1, 0, Math.PI * 2); c.fill(); } }
  if (L.extra === 'dots') { c.fillStyle = '#fff6e8'; for (const [x, y] of [[-10, -20], [-3, -23], [-12, -14], [2, -19]]) { c.beginPath(); c.arc(x, y, 1.6, 0, Math.PI * 2); c.fill(); } }
  if (L.extra === 'tusks') { c.fillStyle = '#fff6e8'; c.beginPath(); c.moveTo(hx + 7, hy + 4); c.lineTo(hx + 10, hy - 2); c.lineTo(hx + 9, hy + 5); c.fill(); c.stroke(); }
  if (L.extra === 'teeth') { c.fillStyle = '#fff'; c.fillRect(hx + 8, hy + 4, 3, 3.5); c.strokeRect(hx + 8, hy + 4, 3, 3.5); }
  // eye
  c.fillStyle = INK;
  if (L.extra === 'sleepy') { c.beginPath(); c.moveTo(hx + 1, hy - 2); c.quadraticCurveTo(hx + 4, hy, hx + 7, hy - 2); c.stroke(); }
  else { c.beginPath(); c.arc(hx + 4, hy - 2, 1.8, 0, Math.PI * 2); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(hx + 4.6, hy - 2.6, 0.6, 0, Math.PI * 2); c.fill(); }
  if (L.extra === 'black-tip') blob(-21, -12, 3, 3, '#1d1b20');
  c.restore();
}

/** Attack and health badges at the foot of a box, with the level and experience pips above. */
function drawStats(c: CanvasRenderingContext2D, u: { a: number; h: number; level?: number; xp?: number; status?: string | null; tmpA?: number }, box: Box) {
  const y = box.y + box.h - 9, r = Math.max(8, Math.min(10, box.w / 6));
  const badge = (x: number, fill: string, n: number) => {
    c.fillStyle = fill; c.strokeStyle = INK; c.lineWidth = 1.4; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); c.stroke();
    c.fillStyle = '#fff'; c.font = `800 ${r + 2}px ui-rounded, system-ui, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(n), x, y + 0.5);
  };
  badge(box.x + r, '#d98a1e', u.a + (u.tmpA ?? 0)); badge(box.x + box.w - r, '#d23a3a', u.h);
  if (u.level) {
    c.fillStyle = INK; c.font = `800 9px ui-rounded, system-ui, sans-serif`; c.textAlign = 'left'; c.textBaseline = 'top';
    c.fillText(`L${u.level}`, box.x + 2, box.y + 2);
    const need = u.level === 1 ? 2 : u.level === 2 ? 5 : 5, from = u.level === 1 ? 0 : 2;
    if (u.level < 3) for (let k = 0; k < need - from; k++) { c.fillStyle = k < (u.xp ?? 0) - from ? '#5a9a3a' : '#0002'; c.fillRect(box.x + 16 + k * 6, box.y + 4, 4, 4); }
  }
  if (u.status) {
    const col = u.status === 'shell' ? '#7a9a52' : u.status === 'mint' ? '#4fc28a' : '#e2452a';
    c.fillStyle = col; c.strokeStyle = INK; c.lineWidth = 1; c.beginPath(); c.arc(box.x + box.w - 7, box.y + 7, 5, 0, Math.PI * 2); c.fill(); c.stroke();
  }
}

const SNACK_COLOURS: Record<SnackId, [string, string]> = {
  apple: ['#d8382f', '#6a9a3a'], raisin: ['#5a2a3a', '#3a1a26'], honey: ['#f0b030', '#c07a10'], hay: [HAY, HAY_DARK],
  mint: ['#5ac28a', '#2a8a5a'], chilli: ['#e2452a', '#4a8a2a'], seed: ['#3a3430', '#e8d8b0'], cake: ['#c9905a', '#fff4dc'],
};
export function drawSnack(c: CanvasRenderingContext2D, id: SnackId, box: Box) {
  const [a, b] = SNACK_COLOURS[id], x = box.x + box.w / 2, y = box.y + box.h / 2 - 6, r = Math.min(box.w, box.h) * 0.28;
  c.save(); c.strokeStyle = INK; c.lineWidth = 1.6;
  c.fillStyle = a; c.beginPath();
  if (id === 'hay') c.roundRect(x - r, y - r * 0.7, r * 2, r * 1.4, 3);
  else if (id === 'chilli') c.ellipse(x, y, r * 0.5, r, 0.6, 0, Math.PI * 2);
  else if (id === 'seed') c.ellipse(x, y, r * 0.55, r, 0, 0, Math.PI * 2);
  else if (id === 'cake') { c.moveTo(x - r, y + r * 0.6); c.lineTo(x + r, y + r * 0.6); c.lineTo(x + r * 0.7, y - r * 0.6); c.lineTo(x - r * 0.7, y - r * 0.6); c.closePath(); }
  else c.arc(x, y, r * (id === 'raisin' ? 0.7 : 1), 0, Math.PI * 2);
  c.fill(); c.stroke();
  c.fillStyle = b;
  if (id === 'apple' || id === 'mint' || id === 'chilli') { c.beginPath(); c.ellipse(x + 3, y - r - 1, 4, 2, -0.5, 0, Math.PI * 2); c.fill(); c.stroke(); }
  if (id === 'hay') { c.strokeStyle = HAY_DARK; for (const d of [-r * 0.4, 0, r * 0.4]) { c.beginPath(); c.moveTo(x + d, y - r * 0.6); c.lineTo(x + d, y + r * 0.6); c.stroke(); } }
  if (id === 'cake') { c.fillRect(x - r * 0.7, y - r * 0.6, r * 1.4, 3); }
  if (id === 'seed') { c.strokeStyle = b; c.beginPath(); c.moveTo(x, y - r * 0.8); c.lineTo(x, y + r * 0.8); c.stroke(); }
  c.restore();
}

// ── The shop ───────────────────────────────────────────────────────────────

function backdrop(c: CanvasRenderingContext2D) {
  const g = c.createLinearGradient(0, 0, 0, 320); g.addColorStop(0, SKY); g.addColorStop(0.55, '#e6f0d0'); g.addColorStop(1, '#b8cf88');
  c.fillStyle = g; c.fillRect(0, 0, 480, 320);
  c.fillStyle = '#9fc070'; c.beginPath(); c.ellipse(120, 160, 220, 40, 0, Math.PI, 0); c.ellipse(390, 165, 170, 34, 0, Math.PI, 0); c.fill();
}
function bale(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  c.fillStyle = HAY; c.strokeStyle = HAY_DARK; c.lineWidth = 2;
  c.beginPath(); c.roundRect(x, y, w, h, 8); c.fill(); c.stroke();
  c.strokeStyle = '#c99a3e'; c.lineWidth = 1;
  for (let k = x + 10; k < x + w - 4; k += 9) { c.beginPath(); c.moveTo(k, y + 3); c.lineTo(k - 4, y + h - 3); c.stroke(); }
  c.strokeStyle = '#8a5a22'; c.lineWidth = 2.5; for (const f of [0.3, 0.7]) { c.beginPath(); c.moveTo(x + w * f, y); c.lineTo(x + w * f, y + h); c.stroke(); }
}
function panel(c: CanvasRenderingContext2D, b: Box, fill: string, stroke = '#00000030') {
  c.fillStyle = fill; c.strokeStyle = stroke; c.lineWidth = 1.5; c.beginPath(); c.roundRect(b.x, b.y, b.w, b.h, 8); c.fill(); c.stroke();
}
function text(c: CanvasRenderingContext2D, s: string, x: number, y: number, size = 12, color = INK, align: CanvasTextAlign = 'left', weight = 800) {
  c.fillStyle = color; c.font = `${weight} ${size}px ui-rounded, 'Trebuchet MS', system-ui, sans-serif`; c.textAlign = align; c.textBaseline = 'middle'; c.fillText(s, x, y);
}
function wrap(c: CanvasRenderingContext2D, s: string, x: number, y: number, w: number, size: number) {
  c.font = `600 ${size}px ui-rounded, 'Trebuchet MS', system-ui, sans-serif`;
  let line = '', yy = y;
  for (const word of s.split(' ')) {
    if (line && c.measureText(`${line} ${word}`).width > w) { text(c, line, x, yy, size, INK, 'left', 600); line = word; yy += size + 3; }
    else line = line ? `${line} ${word}` : word;
  }
  if (line) text(c, line, x, yy, size, INK, 'left', 600);
}
const nameOf = (id: UnitId | TokenId) => (isUnitId(id) ? UNITS[id].name : TOKENS[id].name);

/** The card for a unit or snack: name, stats and what it does at its level. */
export function drawCard(c: CanvasRenderingContext2D, item: { unit?: Unit; snack?: SnackId; cost?: number }, near: Box) {
  const w = 210, h = 70, x = Math.max(4, Math.min(476 - w, near.x + near.w / 2 - w / 2)), y = near.y > 150 ? near.y - h - 6 : near.y + near.h + 6;
  panel(c, { x, y, w, h }, CREAM, INK);
  if (item.unit) {
    const u = item.unit, def = isUnitId(u.id) ? UNITS[u.id] : null;
    text(c, `${nameOf(u.id)}${def ? `  · tier ${def.tier}` : ''}`, x + 8, y + 12, 12);
    text(c, `${u.a + u.tmpA}/${u.h}  L${u.level}${u.status ? `  · ${u.status}` : ''}`, x + w - 8, y + 12, 11, '#7a5a3a', 'right');
    wrap(c, def ? def.text[u.level - 1] : 'Summoned. No ability.', x + 8, y + 32, w - 16, 11);
  } else if (item.snack) {
    const s = SNACKS[item.snack];
    text(c, `${s.name}  · ${item.cost ?? 3} acorns`, x + 8, y + 12, 12);
    wrap(c, s.text, x + 8, y + 32, w - 16, 11);
  }
}

function drawCoach(c: CanvasRenderingContext2D, run: Run, now: number) {
  if (!run.coach) return;
  drawChinchilla(c, run.coach, 38, 132, { face: 1, h: 32, time: now / 1000 });
}
function slotItem(run: Run, h: Held): { unit?: Unit; snack?: SnackId; cost?: number } | null {
  if (h.from === 'line') return run.line[h.i] ? { unit: run.line[h.i]! } : null;
  const s: Slot | null | undefined = (h.from === 'unit' ? run.units : run.snacks)[h.i];
  if (!s) return null;
  return s.kind === 'unit' ? { unit: s.unit } : { snack: s.snack, cost: s.cost };
}
const heldBox = (h: Held) => (h.from === 'line' ? LAYOUT.line : h.from === 'unit' ? LAYOUT.units : LAYOUT.snacks)[h.i];

export function drawShop(c: CanvasRenderingContext2D, run: Run, ui: ShopUi, now: number) {
  const t = now / 1000;
  backdrop(c);
  // the bar along the top
  c.fillStyle = '#3a2614cc'; c.fillRect(0, 0, 480, 24);
  text(c, `Acorns ${run.acorns}`, 10, 12, 12, '#ffd98a');
  text(c, `Hearts ${run.hearts}`, 100, 12, 12, '#ff9a9a');
  text(c, `Bales ${run.bales}/10`, 186, 12, 12, '#ffe7a8');
  text(c, `Turn ${run.turn} · tier ${run.tier}`, 470, 12, 12, CREAM, 'right');
  bale(c, 70, 120, 330, 26);
  drawCoach(c, run, now);
  const lifted = ui.dragging && ui.held ? ui.held : null;
  LAYOUT.line.forEach((b, i) => {
    const u = run.line[i], sel = ui.held?.from === 'line' && ui.held.i === i;
    if (!u || (lifted?.from === 'line' && lifted.i === i)) { c.setLineDash([4, 4]); panel(c, b, sel ? '#ffffff60' : '#ffffff2a', '#3a261460'); c.setLineDash([]); }
    else { if (sel) panel(c, b, '#ffffff70', INK); drawCritter(c, u.id, { x: b.x + 4, y: b.y + 4, w: b.w - 8, h: b.h - 26 }, 1, t); drawStats(c, u, b); }
    if (i === 0) text(c, 'front', b.x + b.w / 2, b.y - 7, 9, '#3a261490', 'center');
  });
  panel(c, LAYOUT.sell, ui.held?.from === 'line' ? '#f3b2a2' : '#ead6c0', '#7a3a2a80');
  text(c, 'Sell', LAYOUT.sell.x + LAYOUT.sell.w / 2, LAYOUT.sell.y + LAYOUT.sell.h / 2, 13, '#7a3a2a', 'center');
  // the shop
  c.fillStyle = '#5a3a1e'; c.beginPath(); c.roundRect(4, 158, 472, 112, 10); c.fill();
  text(c, `Shop · units ${3} · snacks ${run.snackCost} · roll ${run.freeRoll ? 'free' : 1}`, 12, 168, 10, '#f6e0b0', 'left', 700);
  LAYOUT.units.forEach((b, i) => {
    const s = run.units[i]; if (i >= run.units.length) return;
    const sel = ui.held?.from === 'unit' && ui.held.i === i;
    panel(c, b, s?.frozen ? '#bfe3ff' : sel ? '#fff6dc' : '#f4e2bf', s?.frozen ? '#3a7ab0' : '#00000040');
    if (s?.kind === 'unit' && !(lifted?.from === 'unit' && lifted.i === i)) { drawCritter(c, s.unit.id, { x: b.x + 3, y: b.y + 4, w: b.w - 6, h: b.h - 26 }, 1, t); drawStats(c, s.unit, b); }
  });
  LAYOUT.snacks.forEach((b, i) => {
    const s = run.snacks[i]; if (i >= run.snacks.length) return;
    const sel = ui.held?.from === 'snack' && ui.held.i === i;
    panel(c, b, s?.frozen ? '#bfe3ff' : sel ? '#fff6dc' : '#f4e2bf', s?.frozen ? '#3a7ab0' : '#00000040');
    if (s?.kind === 'snack' && !(lifted?.from === 'snack' && lifted.i === i)) { drawSnack(c, s.snack, b); text(c, `${s.cost}`, b.x + b.w / 2, b.y + b.h - 10, 11, INK, 'center'); }
  });
  text(c, ui.held && !ui.dragging ? 'Now tap where it goes, or tap it again to put it back.' : 'Drag to buy, merge, move or sell. Or tap one, then tap where it goes.', 240, 290, 11, '#3a2614', 'center', 700);
  // what is being dragged, then the card
  if (lifted) {
    const it = slotItem(run, lifted), b = { x: ui.x - 26, y: ui.y - 36, w: 52, h: 72 };
    if (it?.unit) drawCritter(c, it.unit.id, { x: b.x, y: b.y, w: b.w, h: b.h - 18 }, 1, t);
    if (it?.snack) drawSnack(c, it.snack, b);
  }
  const shown = ui.card ?? (ui.held && !ui.dragging ? ui.held : null);
  if (shown && !lifted) { const it = slotItem(run, shown); if (it) drawCard(c, it, heldBox(shown)); }
}

// ── The fight ──────────────────────────────────────────────────────────────

export type Replay = { outcome: Outcome; i: number; t: number; speed: 1 | 2 };
export const STEP = 0.35;
/** Advances a replay by `dt` seconds; false once every event has played. */
export function stepReplay(r: Replay, dt: number) {
  r.t += dt * r.speed;
  while (r.t >= STEP && r.i < r.outcome.events.length) { r.t -= STEP; r.i++; }
  return r.i < r.outcome.events.length;
}
type Shown = Unit & { dead?: boolean };
/** The two lines as they stand after the first `n` events. */
export function replayLines(o: Outcome, n: number) {
  const lines: Shown[][] = [o.left.map((u) => ({ ...u, a: u.a + u.tmpA, tmpA: 0 })), o.rival.line.map((u) => ({ ...u, a: u.a + u.tmpA, tmpA: 0 }))];
  const find = (uid: number) => lines[0].find((u) => u.uid === uid) ?? lines[1].find((u) => u.uid === uid);
  for (const e of o.events.slice(0, n)) {
    if (e.k === 'hit') { const u = find(e.uid); if (u) u.h = e.h; }
    else if (e.k === 'buff') { const u = find(e.uid); if (u) { u.a = e.a; u.h = e.h; } }
    else if (e.k === 'status') { const u = find(e.uid); if (u) u.status = e.status; }
    else if (e.k === 'faint') { const u = find(e.uid); if (u) u.dead = true; }
    else if (e.k === 'summon') {
      const l = lines[e.side]; let living = 0, at = l.length;
      for (let i = 0; i < l.length; i++) { if (living === e.at) { at = i; break; } if (!l[i].dead) living++; }
      l.splice(at, 0, { ...e.unit });
    } else if (e.k === 'line') lines[e.side] = e.uids.map((uid) => lines[e.side].find((u) => u.uid === uid)!).filter(Boolean);
  }
  return lines;
}

export function drawFight(c: CanvasRenderingContext2D, r: Replay, now: number) {
  const t = now / 1000, o = r.outcome, lines = replayLines(o, r.i), cur: FightEvent | undefined = o.events[r.i - 1], p = Math.min(1, r.t / STEP);
  backdrop(c);
  bale(c, 6, FIGHT_Y + FIGHT_H - 6, 468, 26);
  text(c, 'Your crew', 12, 40, 13);
  text(c, o.rival.name, 468, 40, 13, INK, 'right');
  for (const side of [0, 1] as const) lines[side].forEach((u, i) => {
    const b = fightBox(side, i);
    let dx = 0;
    if (cur?.k === 'attack' && cur.uid === u.uid) dx = (side === 0 ? 1 : -1) * Math.sin(p * Math.PI) * 10;
    const box = { ...b, x: b.x + dx };
    c.save();
    if (u.dead) c.globalAlpha = 1 - p;
    drawCritter(c, u.id, { x: box.x, y: box.y, w: box.w, h: box.h - 18 }, side === 0 ? 1 : -1, t);
    drawStats(c, u, box);
    c.restore();
    if (cur && 'uid' in cur && cur.uid === u.uid) {
      if (cur.k === 'hit') { c.fillStyle = `rgba(255,60,40,${0.45 * (1 - p)})`; c.beginPath(); c.roundRect(box.x, box.y, box.w, box.h, 8); c.fill(); text(c, `-${cur.dmg}`, box.x + box.w / 2, box.y - 4 - p * 12, 15, '#c0281e', 'center'); }
      if (cur.k === 'buff') text(c, 'up!', box.x + box.w / 2, box.y - 4 - p * 10, 12, '#2a7a2a', 'center');
      if (cur.k === 'ability') { const name = isUnitId(u.id) ? UNITS[u.id].name : ''; panel(c, { x: box.x - 14, y: box.y - 24, w: box.w + 28, h: 18 }, '#fff6dc', INK); text(c, `${name}!`, box.x + box.w / 2, box.y - 15, 10, INK, 'center'); }
      if (cur.k === 'faint') { c.fillStyle = `rgba(255,255,255,${0.8 * (1 - p)})`; for (let k = 0; k < 6; k++) { c.beginPath(); c.arc(box.x + box.w / 2 + Math.cos(k) * p * 22, box.y + box.h / 2 + Math.sin(k * 2) * p * 18, 6 * (1 - p) + 2, 0, Math.PI * 2); c.fill(); } }
    }
  });
  if (r.i >= o.events.length) {
    const word = o.result === 'win' ? 'WIN!' : o.result === 'loss' ? 'LOSS' : 'DRAW';
    panel(c, { x: 150, y: 216, w: 180, h: 64 }, CREAM, INK);
    text(c, word, 240, 240, 26, o.result === 'win' ? '#2a7a2a' : o.result === 'loss' ? '#b02a2a' : '#7a5a3a', 'center');
    text(c, o.result === 'win' ? 'A bale for your crew.' : o.result === 'loss' ? 'You lose a heart.' : 'Nobody wins this one.', 240, 266, 11, INK, 'center', 700);
  }
}

/** The title picture: Dora and Enzo on a bale with a few of the crew. */
export function drawTitle(c: CanvasRenderingContext2D) {
  backdrop(c);
  bale(c, 60, 236, 360, 34);
  drawCritter(c, 'hedgehog', { x: 70, y: 180, w: 60, h: 56 }, 1);
  drawCritter(c, 'badger', { x: 350, y: 176, w: 64, h: 60 }, -1);
  drawChinchilla(c, 'dora', 190, 238, { face: 1, h: 70, time: 0.4 });
  drawChinchilla(c, 'enzo', 290, 238, { face: -1, h: 70, time: 0.9 });
  text(c, 'HAY BALE BRAWL', 240, 60, 34, '#5a3a14', 'center');
  text(c, 'Buy a crew. Line them up. Watch them brawl.', 240, 96, 13, '#5a3a14', 'center', 700);
}
