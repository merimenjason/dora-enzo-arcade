// Hay Bale Brawl's drawing: the shop and the fight replay on a 480 × 320 stage, in Canvas 2D. Every subject is painted
// from lib/hay-bale-paint.ts once its image has loaded; until then, or if it fails, the code drawings below stand in:
// critters from a shared round body with their own colours and features, chinchillas from the arcade's drawChinchilla.
import { UNITS, SNACKS, TOKENS, UNIT_COST, isUnitId, type Run, type Slot, type Unit, type UnitId, type TokenId, type SnackId, type Outcome, type FightEvent } from './hay-bale-game';
import { drawChinchilla, coatLike, type Coat } from './chinchilla-art';
import { BRAWL_FIGHT_STAGE_Y, paintBrawlBackdrop, paintBrawlExtra, paintBrawlFx, paintBrawlSnack, paintBrawlTitle, paintBrawlUnit, type BrawlFx } from './hay-bale-paint';
import { arc, backOut, endHop, fightPose, fxAge, linePlaces, liveFx, replayLines, rollIn, slotPose, smooth, type Pose, type ShopFx } from './hay-bale-motion';

export { replayLines } from './hay-bale-motion';

export const STAGE = { w: 480, h: 320 };
export type Box = { x: number; y: number; w: number; h: number };
export type Held = { from: 'line' | 'unit' | 'snack'; i: number };
/** What the shop's pointer is doing, and the short effects still playing (see lib/hay-bale-motion.ts). */
export type ShopUi = { held: Held | null; dragging: boolean; x: number; y: number; card: Held | null; fx: ShopFx[] };

/** Where everything is in the shop, front slot first. The page tests pointer positions against these boxes. */
export const LAYOUT = {
  line: [0, 1, 2, 3, 4].map((i): Box => ({ x: 334 - i * 64, y: 40, w: 58, h: 84 })),
  sell: { x: 398, y: 46, w: 72, h: 72 } as Box,
  units: [0, 1, 2, 3, 4, 5, 6].map((i): Box => ({ x: 8 + i * 50, y: 178, w: 48, h: 84 })),
  snacks: [0, 1].map((i): Box => ({ x: 368 + i * 54, y: 178, w: 50, h: 84 })),
};
// Fighters' feet stand on the painted straw line of bg-fight; their stat badges sit just below it, on the bale's face.
const FIGHT_W = 40, FIGHT_H = 88, FIGHT_ART = FIGHT_H - 18, FIGHT_Y = Math.round(BRAWL_FIGHT_STAGE_Y + 1 - FIGHT_ART);
const fightBox = (side: 0 | 1, i: number): Box => ({ x: side === 0 ? 176 - i * 44 : 262 + i * 44, y: FIGHT_Y, w: FIGHT_W, h: FIGHT_H });
export const inBox = (b: Box, x: number, y: number) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;

const INK = '#3a2614', CREAM = '#fff4dc', HAY = '#e8c065', HAY_DARK = '#b98a2e', SKY = '#bfe3f2';
const WHOLE: Box = { x: 0, y: 0, w: STAGE.w, h: STAGE.h };

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

/** A critter standing in `box`, facing right (1) or left (−1). The painting is still; only the fallback breathes. */
export function drawCritter(c: CanvasRenderingContext2D, id: UnitId | TokenId, box: Box, facing: 1 | -1, time = 0) {
  if (paintBrawlUnit(c, id, box, facing)) return;
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

const CHARM = 17;
/** Where a status charm sits: in the box's top-right corner beside the level plate, or just above the corner when the
 * box is too narrow for both (the fight), so it never covers the plate, its pips or the badges. */
function charmAt(box: Box, level?: number) {
  const plate = level ? 16 + (level === 1 ? 2 : level === 2 ? 3 : 0) * 6 : 0, room = box.w - plate - 2 >= CHARM;
  return { x: box.x + box.w - CHARM / 2 + (room ? 0 : 2), y: room ? box.y + CHARM / 2 - 1 : box.y - 6 };
}
/** Attack and health badges at the foot of a box, with the level and experience pips above. `pop` (0 to 1) swells the badges. */
function drawStats(c: CanvasRenderingContext2D, u: { a: number; h: number; level?: number; xp?: number; status?: string | null; tmpA?: number }, box: Box, pop = 0) {
  const y = box.y + box.h - 9, r = Math.max(8, Math.min(10, box.w / 6)) * (1 + 0.3 * pop);
  const badge = (x: number, fill: string, n: number) => {
    c.fillStyle = fill; c.strokeStyle = INK; c.lineWidth = 1.4; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); c.stroke();
    c.fillStyle = '#fff'; c.font = `800 ${r + 2}px ui-rounded, system-ui, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(n), x, y + 0.5);
  };
  badge(box.x + r, '#d98a1e', u.a + (u.tmpA ?? 0)); badge(box.x + box.w - r, '#d23a3a', u.h);
  if (u.level) {
    const pips = u.level < 3 ? (u.level === 1 ? 2 : 3) : 0;
    c.fillStyle = '#fff4dcd9'; c.beginPath(); c.roundRect(box.x, box.y, 16 + pips * 6, 11, 4); c.fill();
    c.fillStyle = INK; c.font = `800 9px ui-rounded, system-ui, sans-serif`; c.textAlign = 'left'; c.textBaseline = 'top';
    c.fillText(`L${u.level}`, box.x + 2, box.y + 2);
    const need = u.level === 1 ? 2 : u.level === 2 ? 5 : 5, from = u.level === 1 ? 0 : 2;
    if (u.level < 3) for (let k = 0; k < need - from; k++) { c.fillStyle = k < (u.xp ?? 0) - from ? '#5a9a3a' : '#0002'; c.fillRect(box.x + 16 + k * 6, box.y + 4, 4, 4); }
  }
  // the status charm in the top-right corner, clear of the level plate and the badges
  const charm = charmAt(box, u.level);
  if (u.status && !paintBrawlFx(c, u.status as BrawlFx, charm.x, charm.y, CHARM)) {
    const col = u.status === 'shell' ? '#7a9a52' : u.status === 'mint' ? '#4fc28a' : '#e2452a';
    c.fillStyle = col; c.strokeStyle = INK; c.lineWidth = 1; c.beginPath(); c.arc(box.x + box.w - 7, box.y + 7, 5, 0, Math.PI * 2); c.fill(); c.stroke();
  }
}

const SNACK_COLOURS: Record<SnackId, [string, string]> = {
  apple: ['#d8382f', '#6a9a3a'], raisin: ['#5a2a3a', '#3a1a26'], honey: ['#f0b030', '#c07a10'], hay: [HAY, HAY_DARK],
  mint: ['#5ac28a', '#2a8a5a'], chilli: ['#e2452a', '#4a8a2a'], seed: ['#3a3430', '#e8d8b0'], cake: ['#c9905a', '#fff4dc'],
};
/** A snack in the upper part of `box`, leaving its foot clear for the price. */
export function drawSnack(c: CanvasRenderingContext2D, id: SnackId, box: Box) {
  if (paintBrawlSnack(c, id, { x: box.x + 5, y: box.y + 10, w: box.w - 10, h: box.h - 34 })) return;
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
/** Text on a soft cream plate, so it reads over a painting. */
function plate(c: CanvasRenderingContext2D, s: string, x: number, y: number, size = 12, color = INK, align: CanvasTextAlign = 'left', weight = 800) {
  c.font = `${weight} ${size}px ui-rounded, 'Trebuchet MS', system-ui, sans-serif`;
  const w = c.measureText(s).width + size, left = align === 'center' ? x - w / 2 : align === 'right' ? x - w + size / 2 : x - size / 2;
  c.fillStyle = '#fff4dcd9'; c.beginPath(); c.roundRect(left, y - size * 0.75, w, size * 1.5, size * 0.6); c.fill();
  text(c, s, x, y, size, color, align, weight);
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

// ── Effects ────────────────────────────────────────────────────────────────
// Each effect paints its cell of fx.png when the sheet is ready and draws its code version otherwise. A cell is one
// still picture: it only grows, drifts and fades with its event's progress, exactly as the drawing it replaces.

/** Draws with `pose` applied about the feet of `box`. */
function posed(c: CanvasRenderingContext2D, box: Box, pose: Pose, draw: () => void) {
  if (pose.alpha <= 0) return;
  const x = box.x + box.w / 2, y = box.y + box.h;
  c.save(); c.globalAlpha *= pose.alpha;
  c.translate(x + pose.dx, y + pose.dy); c.rotate(pose.rot); c.scale(pose.sx, pose.sy); c.translate(-x, -y);
  draw(); c.restore();
}
/** Draws scaled by `s` about (x, y). */
function scaled(c: CanvasRenderingContext2D, x: number, y: number, s: number, draw: () => void) {
  if (s <= 0) return;
  c.save(); c.translate(x, y); c.scale(s, s); c.translate(-x, -y); draw(); c.restore();
}
/** A small acorn, the shop's money, about `s` px across its body. */
function acorn(c: CanvasRenderingContext2D, x: number, y: number, s: number) {
  if (paintBrawlFx(c, 'acorn', x, y, s * 1.9)) return;
  c.save(); c.strokeStyle = INK; c.lineWidth = 1;
  c.fillStyle = '#c07a34'; c.beginPath(); c.ellipse(x, y + s * 0.2, s * 0.6, s * 0.7, 0, 0, Math.PI * 2); c.fill(); c.stroke();
  c.fillStyle = '#6a3e18'; c.beginPath(); c.ellipse(x, y - s * 0.3, s * 0.78, s * 0.36, 0, 0, Math.PI * 2); c.fill(); c.stroke();
  c.beginPath(); c.moveTo(x, y - s * 0.62); c.lineTo(x + s * 0.22, y - s * 0.95); c.stroke();
  c.restore();
}
/** A price tag hanging off a shop slot's top-right corner: an acorn and the price, in red when the purse is short. */
function priceTag(c: CanvasRenderingContext2D, b: Box, cost: number, afford: boolean) {
  const w = 27, h = 15, x = b.x + b.w - w + 4, y = b.y - 4;
  c.fillStyle = afford ? CREAM : '#f2d6cc'; c.strokeStyle = afford ? INK : '#b02a2a'; c.lineWidth = 1.3;
  c.beginPath(); c.roundRect(x, y, w, h, 6); c.fill(); c.stroke();
  acorn(c, x + 8, y + h / 2 + 0.5, 9);
  text(c, `${cost}`, x + 19.5, y + h / 2 + 0.5, 11, afford ? INK : '#b02a2a', 'center', 900);
}
/** A cartoon impact burst. */
function burst(c: CanvasRenderingContext2D, x: number, y: number, r: number, alpha: number) {
  if (paintBrawlFx(c, 'bonk', x, y, r * 2.4, { alpha })) return;
  c.save(); c.globalAlpha *= alpha; c.fillStyle = '#ffe066'; c.strokeStyle = '#c0281e'; c.lineWidth = 1.6; c.beginPath();
  for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2, d = k % 2 ? r * 0.45 : r; c.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d); }
  c.closePath(); c.fill(); c.stroke(); c.restore();
}
/** A four-pointed twinkle, gold (abilities, level-ups) or green (buffs); `fill` colours the drawing. */
function twinkle(c: CanvasRenderingContext2D, kind: 'gold' | 'green', x: number, y: number, r: number, fill: string) {
  if (r <= 0 || paintBrawlFx(c, kind, x, y, r * 2.3)) return;
  c.fillStyle = fill; c.beginPath();
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2, d = k % 2 ? r * 0.3 : r; c.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d); }
  c.closePath(); c.fill(); c.strokeStyle = '#7a4a10b0'; c.lineWidth = 0.9; c.stroke();
}
/** A painted dust puff or poof cloud that grows and fades as `p` goes from 0 to 1; `size` is its full width. */
function cloud(c: CanvasRenderingContext2D, kind: 'dust' | 'poof', x: number, y: number, p: number, size: number, flip = false) {
  return paintBrawlFx(c, kind, x, y, size * (0.6 + 0.5 * smooth(p)), { alpha: 1 - p, flip });
}
/** Painted hay, crumbs or frost thrown from a point: it drifts by (dx, dy) at the end, falls a little, and fades. */
function fling(c: CanvasRenderingContext2D, kind: 'hay' | 'crumbs' | 'frost', x: number, y: number, p: number, size: number, dx = 0, dy = 0) {
  return paintBrawlFx(c, kind, x + dx * p, y + dy * p + 10 * p * p, size * (0.8 + 0.35 * p), { alpha: 1 - p * p, flip: dx < 0 });
}
/** Soft puffs spreading from a point as `p` goes from 0 to 1. */
function puffs(c: CanvasRenderingContext2D, x: number, y: number, p: number, spread = 22, n = 6) {
  c.fillStyle = `rgba(255,255,255,${0.8 * (1 - p)})`;
  for (let k = 0; k < n; k++) { c.beginPath(); c.arc(x + Math.cos(k) * p * spread, y + Math.sin(k * 2) * p * spread * 0.8, 6 * (1 - p) + 2, 0, Math.PI * 2); c.fill(); }
}
/** Bits (hay, crumbs, frost) thrown from a point, rightwards (1), leftwards (−1) or all round (0), falling as they fly. */
function bits(c: CanvasRenderingContext2D, x: number, y: number, p: number, seed: number, colours: string[], dir: -1 | 0 | 1 = 0) {
  c.save(); c.globalAlpha *= 1 - p; c.strokeStyle = '#3a261490'; c.lineWidth = 0.8;
  for (let k = 0; k < 8; k++) {
    const h = Math.sin(seed * 12.9898 + k * 78.233) * 43758.5453, r = h - Math.floor(h);
    const a = dir === 0 ? (k / 8) * Math.PI * 2 + r : (r - 0.5) * 1.8 - 0.5, sp = 16 + 24 * r;
    const vx = Math.cos(a) * sp * (dir < 0 ? -1 : 1), vy = Math.sin(a) * sp, px = x + vx * p, py = y + vy * p + 26 * p * p;
    c.fillStyle = colours[k % colours.length]; c.beginPath(); c.ellipse(px, py, 3.2, 2.2, a + k, 0, Math.PI * 2); c.fill(); c.stroke();
  }
  c.restore();
}
const CONFETTI = [HAY, '#d8382f', '#5a9a3a', CREAM, '#4a8ad8'];
/** Confetti falling over a win, for its first couple of seconds. */
function confetti(c: CanvasRenderingContext2D, t: number) {
  if (t <= 0 || t > 2.4) return;
  c.save(); c.globalAlpha = Math.min(1, (2.4 - t) / 0.5);
  for (let k = 0; k < 30; k++) {
    const h = Math.sin(k * 91.7) * 43758.5453, r = h - Math.floor(h);
    const x = ((k * 53 + 17) % 470) + 5 + Math.sin(t * 3 + k) * 8, y = -12 - 50 * r + t * (110 + 70 * r);
    c.save(); c.translate(x, y); c.rotate(t * (3 + 3 * r) + k); c.fillStyle = CONFETTI[k % CONFETTI.length]; c.fillRect(-3.5, -1.8, 7, 3.6); c.restore();
  }
  c.restore();
}

const nameOf = (id: UnitId | TokenId) => (isUnitId(id) ? UNITS[id].name : TOKENS[id].name);

type CardItem = { unit?: Unit; snack?: SnackId; buy?: number; sell?: number };
/** The card for a unit or snack: name, stats, what it does at its level, and what it costs or sells for. */
export function drawCard(c: CanvasRenderingContext2D, item: CardItem, near: Box, acorns: number) {
  const w = 210, h = 86, x = Math.max(4, Math.min(476 - w, near.x + near.w / 2 - w / 2)), y = near.y > 150 ? near.y - h - 6 : near.y + near.h + 6;
  panel(c, { x, y, w, h }, CREAM, INK);
  if (item.unit) {
    const u = item.unit, def = isUnitId(u.id) ? UNITS[u.id] : null;
    text(c, `${nameOf(u.id)}${def ? `  · tier ${def.tier}` : ''}`, x + 8, y + 12, 12);
    text(c, `${u.a + u.tmpA}/${u.h}  L${u.level}${u.status ? `  · ${u.status}` : ''}`, x + w - 8, y + 12, 11, '#7a5a3a', 'right');
    wrap(c, def ? def.text[u.level - 1] : 'Summoned. No ability.', x + 8, y + 30, w - 16, 11);
  } else if (item.snack) {
    text(c, SNACKS[item.snack].name, x + 8, y + 12, 12);
    wrap(c, SNACKS[item.snack].text, x + 8, y + 30, w - 16, 11);
  }
  const foot = y + h - 11;
  c.fillStyle = '#3a261418'; c.fillRect(x + 6, foot - 9, w - 12, 1);
  if (item.buy !== undefined) {
    const ok = acorns >= item.buy;
    acorn(c, x + 14, foot, 10);
    text(c, ok ? `Costs ${item.buy} acorns` : `Costs ${item.buy} acorns · you have ${acorns}`, x + 24, foot, 11, ok ? '#2a5a1a' : '#b02a2a');
  } else if (item.sell !== undefined) {
    acorn(c, x + 14, foot, 10);
    text(c, `Sells for ${item.sell} acorn${item.sell === 1 ? '' : 's'}`, x + 24, foot, 11, '#2a5a1a');
  }
}

/** The coach on a little bale of their own, left of the line. */
function drawCoach(c: CanvasRenderingContext2D, run: Run, now: number) {
  if (!run.coach) return;
  if (!paintBrawlExtra(c, 'bale', { x: 8, y: 112, w: 60, h: 46 })) bale(c, 12, 124, 52, 30);
  if (!paintBrawlExtra(c, run.coach, { x: 10, y: 74, w: 56, h: 52 })) drawChinchilla(c, run.coach, 38, 126, { face: 1, h: 32, time: now / 1000 });
}
function slotItem(run: Run, h: Held): CardItem | null {
  if (h.from === 'line') { const u = run.line[h.i]; return u ? { unit: u, sell: u.level } : null; }
  const s: Slot | null | undefined = (h.from === 'unit' ? run.units : run.snacks)[h.i];
  if (!s) return null;
  return s.kind === 'unit' ? { unit: s.unit, buy: UNIT_COST } : { snack: s.snack, buy: s.cost };
}
const heldBox = (h: Held) => (h.from === 'line' ? LAYOUT.line : h.from === 'unit' ? LAYOUT.units : LAYOUT.snacks)[h.i];

export function drawShop(c: CanvasRenderingContext2D, run: Run, ui: ShopUi, now: number) {
  const t = now / 1000, fx = (ui.fx = liveFx(ui.fx, now));
  if (!paintBrawlBackdrop(c, 'bg-shop', WHOLE)) backdrop(c);
  // the bar along the top; the purse swells when it changes and the change floats down from it
  const change = fx.find((x) => x.k === 'spend' || x.k === 'earn'), swell = change ? arc(fxAge(change, now)) : 0;
  c.fillStyle = '#3a2614cc'; c.fillRect(0, 0, 480, 24);
  acorn(c, 14, 12, 13);
  text(c, `Acorns ${run.acorns}`, 24, 12, 12 + 3 * swell, '#ffd98a');
  text(c, `Hearts ${run.hearts}`, 110, 12, 12, '#ff9a9a');
  text(c, `Bales ${run.bales}/10`, 192, 12, 12, '#ffe7a8');
  text(c, `Turn ${run.turn} · tier ${run.tier}`, 470, 12, 12, CREAM, 'right');
  if (change) {
    const a = fxAge(change, now);
    c.save(); c.globalAlpha = 1 - a * a;
    plate(c, `${change.k === 'spend' ? '−' : '+'}${change.n}`, 52, 36 + a * 10, 12, change.k === 'spend' ? '#b02a2a' : '#2a7a2a', 'center');
    c.restore();
  }
  bale(c, 70, 120, 330, 26);
  drawCoach(c, run, now);
  const lifted = ui.dragging && ui.held ? ui.held : null;
  LAYOUT.line.forEach((b, i) => {
    const u = run.line[i], sel = ui.held?.from === 'line' && ui.held.i === i;
    if (!u || (lifted?.from === 'line' && lifted.i === i)) { c.setLineDash([4, 4]); panel(c, b, sel ? '#ffffff60' : '#ffffff2a', '#3a261460'); c.setLineDash([]); }
    else {
      if (sel) panel(c, b, '#ffffff70', INK);
      const art = { x: b.x + 4, y: b.y + 4, w: b.w - 8, h: b.h - 26 }, ate = fx.find((x) => x.k === 'eat' && x.i === i);
      posed(c, art, slotPose(fx, now, i), () => drawCritter(c, u.id, art, 1, t));
      drawStats(c, u, b, ate ? arc(fxAge(ate, now) * 1.5) : 0);
    }
    if (i === 0) plate(c, 'front', b.x + b.w / 2, b.y - 8, 9, INK, 'center');
  });
  const selling = ui.held?.from === 'line' ? run.line[ui.held.i] : null, sb = LAYOUT.sell, sx = sb.x + sb.w / 2, sy = sb.y + sb.h / 2;
  panel(c, sb, selling ? '#f3b2a2' : '#ead6c0', '#7a3a2a80');
  if (selling) { text(c, 'Sell', sx, sy - 10, 13, '#7a3a2a', 'center'); acorn(c, sx - 9, sy + 11, 12); text(c, `+${selling.level}`, sx + 7, sy + 11, 13, '#2a5a1a', 'center', 900); }
  else text(c, 'Sell', sx, sy, 13, '#7a3a2a', 'center');
  // the shop: every offer wears its price; a roll grows the new offers in, left to right
  c.fillStyle = '#5a3a1e'; c.beginPath(); c.roundRect(4, 158, 472, 112, 10); c.fill();
  text(c, 'Shop · prices in acorns', 12, 168, 10, '#f6e0b0', 'left', 700);
  const shelf = (b: Box, s: Slot | null | undefined, sel: boolean, order: number, draw: () => void) => {
    scaled(c, b.x + b.w / 2, b.y + b.h / 2, s && !s.frozen ? rollIn(fx, now, order) : 1, () => {
      panel(c, b, s?.frozen ? '#bfe3ff' : sel ? '#fff6dc' : '#f4e2bf', s?.frozen ? '#3a7ab0' : '#00000040');
      draw();
    });
  };
  LAYOUT.units.forEach((b, i) => {
    const s = run.units[i]; if (i >= run.units.length) return;
    shelf(b, s, ui.held?.from === 'unit' && ui.held.i === i, i, () => {
      if (s?.kind !== 'unit' || (lifted?.from === 'unit' && lifted.i === i)) return;
      // offers are always level 1 (the card says so); the corner is the price tag's
      drawCritter(c, s.unit.id, { x: b.x + 3, y: b.y + 4, w: b.w - 6, h: b.h - 26 }, 1, t); drawStats(c, { ...s.unit, level: undefined }, b);
      priceTag(c, b, UNIT_COST, run.acorns >= UNIT_COST);
    });
  });
  LAYOUT.snacks.forEach((b, i) => {
    const s = run.snacks[i]; if (i >= run.snacks.length) return;
    shelf(b, s, ui.held?.from === 'snack' && ui.held.i === i, run.units.length + i, () => {
      if (s?.kind !== 'snack' || (lifted?.from === 'snack' && lifted.i === i)) return;
      drawSnack(c, s.snack, b); priceTag(c, b, s.cost, run.acorns >= s.cost);
    });
  });
  // what just happened: dust where a critter landed, sparkles on a merge, crumbs where one ate, a poof at Sell, frost
  for (const x of fx) {
    const a = fxAge(x, now), b = x.k === 'freeze' ? (x.i < 0 ? LAYOUT.snacks[-x.i - 1] : LAYOUT.units[x.i]) : LAYOUT.line[x.i];
    if (!b) continue;
    const cx = b.x + b.w / 2, feet = b.y + b.h - 24, mid = b.y + (b.h - 22) / 2;
    if (x.k === 'land') {
      if (!cloud(c, 'dust', cx - 16 - 6 * a, feet - 4, a, 26, true)) puffs(c, cx - 16, feet, a, 10, 3);
      if (!cloud(c, 'dust', cx + 16 + 6 * a, feet - 4, a, 26)) puffs(c, cx + 16, feet, a, 10, 3);
    }
    if (x.k === 'level') {
      for (let k = 0; k < 8; k++) { const ang = (k / 8) * Math.PI * 2 + a, d = 10 + 30 * smooth(a); twinkle(c, 'gold', cx + Math.cos(ang) * d, mid + Math.sin(ang) * d * 0.8, 8 * (1 - a), k % 2 ? '#ffe066' : '#fff4dc'); }
      if (x.n) { c.save(); c.globalAlpha = 1 - a * a; plate(c, 'Level up!', cx, b.y + 14 - a * 12, 11, '#2a7a2a', 'center'); c.restore(); }
    }
    if (x.k === 'eat' && !fling(c, 'crumbs', cx, mid + 8, a, 28)) bits(c, cx, mid + 6, a, x.at, ['#c9905a', HAY, '#d8382f']);
    if (x.k === 'freeze' && !fling(c, 'frost', cx, b.y + b.h / 2, a, 34)) bits(c, cx, b.y + b.h / 2, a, x.at, ['#bfe3ff', '#ffffff', '#7ab8e8']);
  }
  const sold = fx.find((x) => x.k === 'sell');
  if (sold) {
    const a = fxAge(sold, now), k = smooth(a);
    if (!cloud(c, 'poof', sx, sy, a, 50)) puffs(c, sx, sy, a, 26);
    acorn(c, sx + (14 - sx) * k, sy + (12 - sy) * k - 18 * arc(a), 14 * (1 - 0.4 * k));
  }
  plate(c, ui.held && !ui.dragging ? 'Now tap where it goes, or tap it again to put it back.' : 'Drag to buy, merge, move or sell. Or tap one, then tap where it goes.', 240, 290, 11, INK, 'center', 700);
  // what is being dragged, then the card
  if (lifted) {
    const it = slotItem(run, lifted), b = { x: ui.x - 26, y: ui.y - 36, w: 52, h: 72 };
    if (it?.unit) drawCritter(c, it.unit.id, { x: b.x, y: b.y, w: b.w, h: b.h - 18 }, 1, t);
    if (it?.snack) drawSnack(c, it.snack, b);
  }
  const shown = ui.card ?? (ui.held && !ui.dragging ? ui.held : null);
  if (shown && !lifted) { const it = slotItem(run, shown); if (it) drawCard(c, it, heldBox(shown), run.acorns); }
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
/**
 * The replay. Only the critter an event is about moves: a wind-up and lunge, a knock-back with a burst of hay, a tumble
 * off the bale, a hop for an ability, a pop for a summon; then the line slides up. `calm` (reduced motion) keeps a
 * small lunge and the fades and drops the rest. The timing never changes.
 */
export function drawFight(c: CanvasRenderingContext2D, r: Replay, now: number, calm = false) {
  const t = calm ? 0 : now / 1000, o = r.outcome, lines = replayLines(o, r.i), cur: FightEvent | undefined = o.events[r.i - 1], p = Math.min(1, r.t / STEP);
  const places = linePlaces(o, r.i, p, calm), ended = r.i >= o.events.length, rise = calm ? 0 : p;
  const winners = !ended ? -1 : o.result === 'win' ? 0 : o.result === 'loss' ? 1 : -1, hop = ended ? endHop(r.t, calm) : 0;
  if (!paintBrawlBackdrop(c, 'bg-fight', WHOLE)) { backdrop(c); bale(c, 6, Math.round(BRAWL_FIGHT_STAGE_Y) - 3, 468, 26); }
  plate(c, 'Your crew', 12, 40, 13);
  plate(c, o.rival.name, 468, 40, 13, INK, 'right');
  for (const side of [0, 1] as const) lines[side].forEach((u, i) => {
    const b = fightBox(side, places.get(u.uid) ?? i), pose = fightPose(cur, u, side, p, calm), facing = side === 0 ? 1 : -1;
    if (side === winners && !u.dead) pose.dy += hop;
    const art = { x: b.x - 2, y: b.y, w: b.w + 4, h: FIGHT_ART }, box = { ...b, x: b.x + pose.dx };
    const ev = cur && 'uid' in cur && cur.uid === u.uid ? cur : null;
    posed(c, art, pose, () => drawCritter(c, u.id, art, facing, t));
    if (pose.alpha > 0) { c.save(); c.globalAlpha = pose.alpha; drawStats(c, u, box, ev?.k === 'buff' && !calm ? arc(p) : 0); c.restore(); }
    if (!ev) return;
    const cx = box.x + box.w / 2, mid = box.y + FIGHT_ART * 0.55;
    if (ev.k === 'attack' && !calm && p > 0.3 && p < 0.8) {
      // speed lines behind the lunge
      c.save(); c.globalAlpha = arc((p - 0.3) / 0.5) * 0.7; c.strokeStyle = CREAM; c.lineWidth = 2.5; c.lineCap = 'round';
      for (let k = 0; k < 3; k++) { const x0 = cx - facing * (20 + k * 4), y0 = mid - 12 + k * 10; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x0 - facing * 12, y0); c.stroke(); }
      c.restore();
    }
    if (ev.k === 'hit') {
      const front = side === 0 ? box.x + box.w : box.x;
      if (!calm) {
        const away = side === 0 ? -1 : 1;
        if (!fling(c, 'hay', front + away * 6, mid, p, 26, away * 22, -4)) bits(c, front, mid, p, u.uid + r.i, [HAY, HAY_DARK, CREAM], away);
        burst(c, front, mid - 8, 7 + 9 * backOut(p * 2.5), 1 - p * p);
      }
      plate(c, `-${ev.dmg}`, cx, box.y - 4 - rise * 14, calm ? 15 : 15 + 6 * (1 - smooth(p * 3)), '#c0281e', 'center');
    }
    if (ev.k === 'buff') {
      if (!calm) for (let k = 0; k < 3; k++) twinkle(c, 'green', cx - 12 + k * 12, mid + 10 - p * (26 + k * 6), 7 * (1 - p), '#7ad86a');
      plate(c, 'up!', cx, box.y - 4 - rise * 10, 12, '#2a7a2a', 'center');
    }
    if (ev.k === 'status' && !calm) {
      const col = ev.status === 'shell' ? '#7a9a52' : ev.status === 'mint' ? '#4fc28a' : ev.status === 'chilli' ? '#e2452a' : '#9aa88a';
      const at = charmAt(box, u.level);
      if (ev.status) { c.save(); c.globalAlpha = 1 - p; c.strokeStyle = col; c.lineWidth = 3; c.beginPath(); c.arc(at.x, at.y, 5 + 16 * p, 0, Math.PI * 2); c.stroke(); c.restore(); }
      // a honey shell used up: the charm swells and fades away
      else if (!paintBrawlFx(c, 'shell', at.x, at.y, CHARM + 16 * smooth(p), { alpha: 1 - p })) bits(c, at.x, at.y, p, u.uid, ['#7a9a52', '#c8d8a0'], 0);
    }
    if (ev.k === 'ability') {
      const name = isUnitId(u.id) ? UNITS[u.id].name : '';
      if (!calm) for (let k = 0; k < 5; k++) { const ang = (k / 5) * Math.PI * 2 + p * 4; twinkle(c, 'gold', cx + Math.cos(ang) * 26, mid + Math.sin(ang) * 20, 7 * arc(p), '#ffe066'); }
      scaled(c, cx, box.y - 15, calm ? 1 : backOut(p * 3), () => {
        panel(c, { x: box.x - 14, y: box.y - 24, w: box.w + 28, h: 18 }, '#fff6dc', INK); text(c, `${name}!`, cx, box.y - 15, 10, INK, 'center');
      });
    }
    if (ev.k === 'faint' && !calm && !cloud(c, 'poof', b.x + b.w / 2, b.y + b.h / 2, p, 52)) puffs(c, b.x + b.w / 2, b.y + b.h / 2, p);
  });
  if (cur?.k === 'summon' && !calm) {
    const b = fightBox(cur.side, places.get(cur.unit.uid) ?? 0);
    if (!cloud(c, 'poof', b.x + b.w / 2, b.y + FIGHT_ART * 0.6, p, 58)) puffs(c, b.x + b.w / 2, b.y + FIGHT_ART * 0.6, p, 26, 8);
  }
  if (ended) {
    if (o.result === 'win' && !calm) confetti(c, r.t);
    const word = o.result === 'win' ? 'WIN!' : o.result === 'loss' ? 'LOSS' : 'DRAW';
    scaled(c, 240, 261, calm ? 1 : backOut(r.t / 0.35), () => {
      panel(c, { x: 150, y: 230, w: 180, h: 62 }, CREAM, INK);
      text(c, word, 240, 253, 26, o.result === 'win' ? '#2a7a2a' : o.result === 'loss' ? '#b02a2a' : '#7a5a3a', 'center');
      text(c, o.result === 'win' ? 'A bale for your crew.' : o.result === 'loss' ? 'You lose a heart.' : 'Nobody wins this one.', 240, 278, 11, INK, 'center', 700);
    });
  }
}

/** The title picture: Dora and Enzo on a bale with a few of the crew, under the name in the picture's empty top band. */
export function drawTitle(c: CanvasRenderingContext2D) {
  if (!paintBrawlBackdrop(c, 'bg-shop', WHOLE)) backdrop(c);
  if (!paintBrawlTitle(c, WHOLE)) {
    bale(c, 60, 236, 360, 34);
    drawCritter(c, 'hedgehog', { x: 70, y: 180, w: 60, h: 56 }, 1);
    drawCritter(c, 'badger', { x: 350, y: 176, w: 64, h: 60 }, -1);
    drawChinchilla(c, 'dora', 190, 238, { face: 1, h: 70, time: 0.4 });
    drawChinchilla(c, 'enzo', 290, 238, { face: -1, h: 70, time: 0.9 });
  }
  c.fillStyle = '#fff4dcd0'; c.beginPath(); c.roundRect(76, 14, 328, 66, 14); c.fill();
  text(c, 'HAY BALE BRAWL', 240, 40, 34, '#5a3a14', 'center');
  text(c, 'Buy a crew. Line them up. Watch them brawl.', 240, 68, 13, '#5a3a14', 'center', 700);
}
