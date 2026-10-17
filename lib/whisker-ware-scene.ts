// Whisker Ware's drawing: the host's room between microgames, and each microgame drawn from its state on a 480 × 320
// stage. Painted art is used when it has loaded; every painter call falls back to shapes drawn here, so the game is
// playable before (or without) a single image.
import { MICROS, HOSTS, type Run, type MicroId } from './whisker-ware-game';
import { paintWareBackdrop, paintWareHost, paintWareProp, WARE_PROPS, type WareBox, type WareHost, type WareMood } from './whisker-ware-paint';
import { drawChinchilla } from './chinchilla-art';

export const STAGE = { w: 480, h: 320 };
const FULL: WareBox = { x: 0, y: 0, w: STAGE.w, h: STAGE.h };
const HOST_KEYS: WareHost[] = ['enzo', 'dora', 'owl', 'fox'];
const TINT = ['#f3b562', '#c9a3e6', '#4a5f9e', '#e5734a'];
const SKY = [['#ffe7b8', '#f0b878'], ['#f3e3ff', '#c8b0e8'], ['#26305a', '#121830'], ['#ffd9b0', '#e89a70']];
const COMMAND = 48;
type Prop<H extends WareHost> = (typeof WARE_PROPS)[H][number];

/** A painted prop `size` units square, centred on x with its feet at y; `fallback` draws it when the art is missing. */
function prop<H extends WareHost>(c: CanvasRenderingContext2D, host: H, name: Prop<H>, x: number, y: number, size: number, fallback: () => void) {
  if (!paintWareProp(c, host, name, { x: x - size / 2, y: y - size, w: size, h: size })) fallback();
}
const disc = (c: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string, line = '#3a2614') => {
  c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fillStyle = fill; c.fill(); c.lineWidth = 2; c.strokeStyle = line; c.stroke();
};
const box = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string, line = '#3a2614', r = 4) => {
  c.beginPath(); c.roundRect(x, y, w, h, r); c.fillStyle = fill; c.fill(); c.lineWidth = 2; c.strokeStyle = line; c.stroke();
};
const label = (c: CanvasRenderingContext2D, text: string, x: number, y: number, size = 16, fill = '#fffaf0', align: CanvasTextAlign = 'center') => {
  c.font = `800 ${size}px ui-rounded, 'Trebuchet MS', system-ui, sans-serif`; c.textAlign = align; c.textBaseline = 'middle';
  c.lineJoin = 'round'; c.lineWidth = Math.max(3, size / 4); c.strokeStyle = '#2a1a0c'; c.strokeText(text, x, y); c.fillStyle = fill; c.fillText(text, x, y);
};
const chin = (c: CanvasRenderingContext2D, who: 'dora' | 'enzo', x: number, y: number, h: number, now: number, o: { face?: 1 | -1; moving?: boolean; air?: boolean } = {}) =>
  drawChinchilla(c, who, x, y, { face: o.face ?? 1, h, time: now / 1000, moving: o.moving, run: o.moving ? now / 40 : undefined, air: o.air });
/** A thin progress bar along the top. */
function meter(c: CanvasRenderingContext2D, p: number, fill = '#ffd34d') {
  box(c, 140, 12, 200, 14, '#00000066', '#2a1a0c', 7);
  if (p > 0) box(c, 140, 12, 200 * Math.min(1, p), 14, fill, '#2a1a0c', 7);
}
const RAISIN = (c: CanvasRenderingContext2D, x: number, y: number) => prop(c, 'enzo', 'raisin', x, y + 13, 26, () => disc(c, x, y, 10, '#6b2d5c'));
const PEBBLE = (c: CanvasRenderingContext2D, x: number, y: number) => prop(c, 'enzo', 'pebble', x, y + 13, 26, () => disc(c, x, y, 11, '#9a968e', '#4a4640'));
const ACORN = (c: CanvasRenderingContext2D, x: number, y: number, s = 30) => prop(c, 'enzo', 'acorn', x, y + s / 2, s, () => { disc(c, x, y + 3, s / 3, '#b8763a'); box(c, x - s / 3, y - s / 3, (s * 2) / 3, s / 4, '#6e4a26'); });
function bowl(c: CanvasRenderingContext2D, x: number, y: number) {
  prop(c, 'enzo', 'bowl', x, y + 14, 80, () => { c.beginPath(); c.ellipse(x, y - 4, 34, 18, 0, 0, Math.PI); c.fillStyle = '#d9a35a'; c.fill(); c.lineWidth = 2; c.strokeStyle = '#3a2614'; c.stroke(); });
}
const SUIT_COLOUR = ['#b8763a', '#4f9a4a', '#c7354a', '#e5b72a'];
/** PICK's four suits, drawn: acorn, leaf, berry, flower. */
function suit(c: CanvasRenderingContext2D, n: number, x: number, y: number, r: number) {
  const col = SUIT_COLOUR[n];
  if (n === 0) { disc(c, x, y + r * 0.2, r * 0.7, col); box(c, x - r * 0.75, y - r * 0.75, r * 1.5, r * 0.5, '#6e4a26'); }
  else if (n === 1) { c.beginPath(); c.ellipse(x, y, r * 0.5, r, 0.6, 0, Math.PI * 2); c.fillStyle = col; c.fill(); c.lineWidth = 2; c.strokeStyle = '#1e3a1c'; c.stroke(); }
  else if (n === 2) { disc(c, x - r * 0.35, y + r * 0.2, r * 0.45, col); disc(c, x + r * 0.35, y + r * 0.2, r * 0.45, col); disc(c, x, y - r * 0.35, r * 0.45, col); }
  else { for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; disc(c, x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.38, col); } disc(c, x, y, r * 0.3, '#fff3c2'); }
}
function card(c: CanvasRenderingContext2D, x: number, y: number, face: number | null) {
  if (face === null) { prop(c, 'fox', 'card-back', x, y + 50, 100, () => box(c, x - 34, y - 48, 68, 96, '#8e2f3c', '#2a1a0c', 8)); return; }
  box(c, x - 34, y - 48, 68, 96, '#fff8ea', '#2a1a0c', 8); suit(c, face, x, y, 22);
}

// ── The microgames ────────────────────────────────────────────────────────────

type Draw = (c: CanvasRenderingContext2D, s: any, now: number) => void;
const DRAW: Record<MicroId, Draw> = {
  stuff(c, s, now) {
    ACORN(c, 90, 240, 40); ACORN(c, 120, 250, 40); ACORN(c, 100, 225, 40);
    const p = s.cheeks / s.target, size = 150 + 70 * p;
    prop(c, 'enzo', p > 0 ? 'enzo-stuffed' : 'enzo-face', 260, 290, size, () => {
      chin(c, 'enzo', 250, 290, 120, now);
      disc(c, 286, 205, 10 + 16 * p, '#d8d2c8', '#5a5048');
    });
    meter(c, p);
  },
  catch(c, s) {
    for (const m of s.items) if (m.y < 300) (m.kind === 'raisin' ? RAISIN : PEBBLE)(c, m.x, m.y);
    bowl(c, s.bowl.x, s.bowl.y);
    label(c, `${s.raisins} / ${s.need}`, 440, 24, 18);
  },
  sort(c, s) {
    prop(c, 'enzo', 'jar', 70, 230, 110, () => box(c, 30, 140, 80, 90, '#cfe6ec88'));
    prop(c, 'enzo', 'jar', 410, 230, 110, () => box(c, 370, 140, 80, 90, '#cfe6ec88'));
    PEBBLE(c, 70, 250); ACORN(c, 410, 252, 24);
    label(c, '←', 70, 112, 26); label(c, '→', 410, 112, 26);
    if (s.item) (s.item.kind === 'acorn' ? (x: number, y: number) => ACORN(c, x, y, 54) : (x: number, y: number) => prop(c, 'enzo', 'pebble', x, y + 27, 54, () => disc(c, x, y, 22, '#9a968e')))(s.item.x, s.item.y);
    meter(c, s.done / s.order.length);
  },
  sniff(c, s) {
    const lift = s.show || s.result ? 46 : 0;
    s.cups.forEach((cup: { x: number; y: number }, k: number) => {
      if (k === s.raisin && lift) RAISIN(c, cup.x, cup.y + 16);
      prop(c, 'enzo', 'cup', cup.x, cup.y + 40 - (k === s.raisin ? lift : 0), 84, () => box(c, cup.x - 30, cup.y - 30 - (k === s.raisin ? lift : 0), 60, 70, '#c98a4b'));
    });
    if (s.open && !s.result) [0, 1, 2].forEach(k => label(c, `${k + 1}`, 120 + k * 120, 290, 18, '#ffd34d'));
  },
  gnaw(c, s, now) {
    c.fillStyle = '#ffffff22'; c.fillRect(s.tooth - s.window / 2, 122, s.window, 60);
    box(c, s.stick, 140, 420, 22, '#a8743e', '#3a2614', 10);
    c.beginPath(); c.moveTo(s.notch - 12, 140); c.lineTo(s.notch, 156); c.lineTo(s.notch + 12, 140); c.fillStyle = '#4a2c12'; c.fill();
    prop(c, 'enzo', 'enzo-gnaw', 120, 198, 140, () => chin(c, 'enzo', 120, 192, 80, now));
    c.beginPath(); c.moveTo(s.tooth, 122); c.lineTo(s.tooth, 180); c.strokeStyle = '#ffd34d'; c.lineWidth = 2; c.setLineDash([4, 4]); c.stroke(); c.setLineDash([]);
  },
  raisin(c, s) {
    for (const m of s.items) if (m.y < 300) (m.kind === 'raisin' ? RAISIN : PEBBLE)(c, m.x, m.y);
    bowl(c, s.bowl.x, s.bowl.y);
    label(c, `${s.raisins} / 8`, 420, 24, 18);
    for (let k = 0; k < 3; k++) disc(c, 30 + k * 24, 24, 8, k < s.pebbles ? '#9a968e' : '#00000044');
  },
  dust(c, s, now) {
    const p = s.dust / s.target;
    prop(c, 'dora', 'dora-sit', 240, 262, 150, () => chin(c, 'dora', 240, 252, 90, now));
    c.globalAlpha = Math.min(1, 0.3 + p);
    for (let k = 0; k < Math.round(p * 14); k++) prop(c, 'dora', 'dust', 160 + ((k * 53) % 160), 250 - ((k * 37) % 70), 46, () => disc(c, 160 + ((k * 53) % 160), 230 - ((k * 37) % 70), 12, '#e8dcc4', '#b8a888'));
    c.globalAlpha = 1;
    meter(c, p);
    label(c, '⇆', 240, 296, 22, '#ffd34d');
  },
  balance(c, s, now) {
    // Dora stands on the log's top, about half way up its painted cell
    prop(c, 'dora', 'log', 240, 292, 150, () => box(c, 160, 226, 160, 44, '#8a5a2c', '#3a2614', 20));
    c.save(); c.translate(240, 232); c.rotate(s.tilt * 0.7);
    prop(c, 'dora', 'dora-balance', 0, 0, 120, () => chin(c, 'dora', 0, 0, 70, now));
    c.restore();
    box(c, 140, 12, 200, 14, '#00000066', '#2a1a0c', 7);
    c.fillStyle = '#e8584a88'; c.fillRect(140, 13, 24, 12); c.fillRect(316, 13, 24, 12);
    disc(c, 240 + 100 * Math.max(-1, Math.min(1, s.tilt)), 19, 8, Math.abs(s.tilt) > 0.75 ? '#e8584a' : '#ffd34d');
  },
  fluff(c, s, now) {
    const size = 90 + 120 * Math.min(1.2, s.size);
    prop(c, 'dora', s.size > 0.35 ? 'dora-puffed' : 'dora-sleek', 220, 280, size, () => chin(c, 'dora', 220, 280, size * 0.6, now));
    box(c, 430, 60, 22, 200, '#00000066', '#2a1a0c', 8);
    c.fillStyle = '#7ad46a99'; c.fillRect(431, 260 - 200 * s.hi, 20, 200 * (s.hi - s.lo));
    box(c, 426, 256 - 200 * Math.min(1, s.size), 30, 8, '#ffd34d', '#2a1a0c', 3);
  },
  hop(c, s, now) {
    for (const l of s.logs) prop(c, 'dora', 'log', l.x, 280, 96, () => box(c, l.x - 26, 252, 52, 22, '#8a5a2c', '#3a2614', 10));
    prop(c, 'dora', s.jump ? 'dora-jump' : 'dora-run', s.dora.x, s.dora.y + 8, 110, () => chin(c, 'dora', s.dora.x, s.dora.y, 52, now, { moving: !s.jump, air: !!s.jump }));
  },
  comb(c, s, now) {
    prop(c, 'dora', 'dora-sit', 240, 300, 260, () => chin(c, 'dora', 240, 290, 170, now));
    for (const g of s.tangles) if (!g.done) prop(c, 'dora', 'tangle', g.x, g.y + 16, 36, () => disc(c, g.x, g.y, 12, '#6e6258', '#2a1a0c'));
    prop(c, 'dora', 'comb', s.comb.x, s.comb.y + 22, 48, () => box(c, s.comb.x - 18, s.comb.y - 8, 36, 16, '#e5b72a'));
    meter(c, s.tangles.filter((g: { done: boolean }) => g.done).length / s.tangles.length);
  },
  shelf(c, s, now) {
    for (let k = 0; k < s.shelves.length; k++) {
      const h = s.shelves[k];
      prop(c, 'dora', 'plank', h.x, h.y + 10, 100, () => box(c, h.x - 46, h.y - 4, 92, 10, '#a8743e'));
      if (k === s.level) { c.strokeStyle = '#ffd34d'; c.lineWidth = 2; c.strokeRect(h.x - 48, h.y - 6, 96, 14); }
    }
    prop(c, 'dora', s.level ? 'dora-sit' : 'dora-run', s.dora.x, s.dora.y + 2, 60, () => chin(c, 'dora', s.dora.x, s.dora.y, 32, now));
    label(c, `${s.level} / ${s.shelves.length}`, 440, 24, 18);
  },
  sneak(c, s, now) {
    const pose = s.owl === 'back' ? 'owl-back' : s.owl === 'tell' ? 'owl-glance' : 'owl-watch';
    prop(c, 'owl', pose, 400, 150, 130, () => { disc(c, 400, 100, 40, '#7a5a3a'); if (s.owl !== 'back') { disc(c, 386, 92, 9, '#ffd34d'); disc(c, 414, 92, 9, '#ffd34d'); } });
    ACORN(c, s.acorn.x, s.acorn.y - 12, 34);
    prop(c, 'owl', 'dora-tiptoe', s.dora.x, s.dora.y + 2, 80, () => chin(c, 'dora', s.dora.x, s.dora.y, 40, now, { moving: s.held }));
    if (s.owl === 'tell') label(c, '!', 400, 30, 30, '#ffd34d');
  },
  hide(c, s, now) {
    c.beginPath(); c.ellipse(s.shadow.x, 262, s.shadow.w / 2, 14, 0, 0, Math.PI * 2); c.fillStyle = '#05081899'; c.fill();
    prop(c, 'owl', 'enzo-crouch', s.enzo.x, s.enzo.y - 4, 70, () => chin(c, 'enzo', s.enzo.x, s.enzo.y - 8, 36, now));
    const g = c.createLinearGradient(s.beam.x, 0, s.beam.x, 320);
    g.addColorStop(0, '#fff6b0cc'); g.addColorStop(1, '#fff6b022');
    c.beginPath(); c.moveTo(s.beam.x - 8, 0); c.lineTo(s.beam.x + 8, 0); c.lineTo(s.beam.x + 34, 300); c.lineTo(s.beam.x - 34, 300); c.fillStyle = g; c.fill();
  },
  hush(c, s) {
    prop(c, 'owl', 'owl-sleep', 240, 130, 120, () => disc(c, 240, 90, 36, '#7a5a3a'));
    const toys = ['toy-mouse', 'toy-ball', 'toy-carrot'] as const;
    for (const g of s.toys) {
      if (g.state === 'wait') continue;
      const wob = g.state === 'squeak' ? Math.sin(g.age * 0.8) * 4 : 0;
      c.globalAlpha = g.state === 'hushed' ? 0.45 : 1;
      prop(c, 'owl', toys[g.spot], g.x + wob, g.y + 24, 56, () => disc(c, g.x + wob, g.y, 18, ['#9a9a9a', '#e8584a', '#f08a2a'][g.spot]));
      c.globalAlpha = 1;
      if (g.state === 'squeak') label(c, 'squeak!', g.x, g.y - 38, 13, '#ffd34d');
    }
    for (let k = 0; k < 3; k++) label(c, `${k + 1}`, 120 + k * 120, 280, 16, '#ffd34d');
  },
  find(c, s) {
    for (const d of s.decoys) prop(c, 'owl', 'pinecone', d.x, d.y + 15, 30, () => disc(c, d.x, d.y, 11, '#6e4a26'));
    ACORN(c, s.acorn.x, s.acorn.y, 30);
    c.save(); c.beginPath(); c.rect(0, 0, 480, 320); c.arc(s.lantern.x, s.lantern.y, 54, 0, Math.PI * 2, true); c.fillStyle = '#05081ef0'; c.fill('evenodd'); c.restore();
    c.beginPath(); c.arc(s.lantern.x, s.lantern.y, 54, 0, Math.PI * 2); c.strokeStyle = '#fff6b066'; c.lineWidth = 3; c.stroke();
  },
  dodge(c, s, now) {
    for (const f of s.feathers) prop(c, 'owl', 'feather', f.x, f.y + 16, 32, () => { c.beginPath(); c.ellipse(f.x, f.y, 6, 15, 0.4, 0, Math.PI * 2); c.fillStyle = '#f2ecdf'; c.fill(); });
    prop(c, 'dora', 'dora-run', s.dora.x, s.dora.y + 4, 70, () => chin(c, 'dora', s.dora.x, s.dora.y, 38, now));
  },
  moon(c, s, now) {
    const cam = s.cam;
    c.fillStyle = '#2f3a2e';
    let x = 0;
    const gaps = s.hazards.filter((h: { kind: string }) => h.kind === 'gap').map((h: { x: number; w: number }) => [h.x - cam, h.x - cam + h.w]).sort((a: number[], b: number[]) => a[0] - b[0]);
    for (const [a, b] of gaps) { if (a > x) c.fillRect(x, 270, Math.min(480, a) - x, 50); x = Math.max(x, b); }
    if (x < 480) c.fillRect(x, 270, 480 - x, 50);
    for (const h of s.hazards) if (h.kind === 'swoop' && h.x - cam > -60 && h.x - cam < 540) prop(c, 'owl', 'owl-swoop', h.x - cam + h.w / 2, h.y + 18, 60, () => disc(c, h.x - cam + h.w / 2, h.y, 16, '#7a5a3a'));
    const fx = s.flag - cam;
    if (fx < 520) { box(c, fx, 190, 4, 80, '#eee'); box(c, fx + 4, 190, 30, 20, '#e8584a'); }
    prop(c, 'dora', s.jump ? 'dora-jump' : 'dora-run', s.dora.x - cam, s.dora.y + 4, 64, () => chin(c, 'dora', s.dora.x - cam, s.dora.y, 36, now, { moving: !s.jump, air: !!s.jump }));
    meter(c, s.dora.x / s.flag);
  },
  pick(c, s) {
    box(c, 200, 10, 80, 44, '#00000066', '#2a1a0c', 10); suit(c, s.target, 240, 32, 16);
    s.cards.forEach((k: { x: number; y: number; suit: number }) => card(c, k.x, k.y, s.up || s.result ? k.suit : null));
    if (s.open && !s.result) [0, 1, 2].forEach(k => label(c, `${k + 1}`, 120 + k * 120, 268, 18, '#ffd34d'));
  },
  pop(c, s) {
    const names = ['balloon-red', 'balloon-yellow', 'balloon-blue', 'balloon-green'] as const;
    for (const b of s.balloons) if (b.state === 'up') prop(c, 'fox', names[b.colour], b.x, b.y + 40, 70, () => { c.beginPath(); c.ellipse(b.x, b.y, 22, 28, 0, 0, Math.PI * 2); c.fillStyle = ['#e8584a', '#e5b72a', '#4f8ae8', '#4f9a4a'][b.colour]; c.fill(); });
    label(c, `${s.popped} / ${s.balloons.length}`, 440, 24, 18);
  },
  aim(c, s) {
    prop(c, 'fox', 'target', s.target.x, s.target.y + 40, 80, () => { disc(c, s.target.x, s.target.y, 30, '#fff'); disc(c, s.target.x, s.target.y, 18, '#e8584a'); disc(c, s.target.x, s.target.y, 7, '#fff'); });
    prop(c, 'fox', 'slingshot', s.sling.x, s.sling.y + 46, 100, () => box(c, s.sling.x - 6, s.sling.y - 30, 12, 70, '#8a5a2c'));
    if (s.pull) { c.beginPath(); c.moveTo(s.sling.x, s.sling.y - 20); c.lineTo(s.pull.x, s.pull.y); c.strokeStyle = '#3a2614'; c.lineWidth = 3; c.stroke(); }
    if (s.shot) ACORN(c, s.shot.x, s.shot.y, 24);
    box(c, 20, 60, 22, 200, '#00000066', '#2a1a0c', 8);
    c.fillStyle = '#7ad46a99'; c.fillRect(21, 260 - 200 * (s.centre + s.width / 2), 20, 200 * s.width);
    box(c, 16, 256 - 200 * s.power, 30, 8, '#ffd34d', '#2a1a0c', 3);
  },
  stack(c, s) {
    box(c, 0, 34, 480, 8, '#5a4a3a');
    c.beginPath(); c.moveTo(s.crane.x, 42); c.lineTo(s.crane.x, s.crate && !s.crate.falling ? s.crate.y - 15 : 56); c.strokeStyle = '#2a1a0c'; c.lineWidth = 2; c.stroke();
    box(c, 200, 290, 80, 30, '#6e5a46');
    const crate = (x: number, y: number) => prop(c, 'fox', 'crate', x, y + 15, 62, () => box(c, x - 30, y - 15, 60, 30, '#c98a4b'));
    for (const p of s.placed) crate(p.x, p.y);
    if (s.crate) crate(s.crate.x, s.crate.y);
    label(c, `${s.placed.length} / ${s.need}`, 440, 60, 18);
  },
  count(c, s) {
    if (s.show) for (const a of s.acorns) ACORN(c, a.x, a.y, 30);
    if (s.open) s.answers.forEach((n: number, k: number) => { box(c, 120 + k * 120 - 40, 220, 80, 60, '#fff8ea', '#2a1a0c', 12); label(c, `${n}`, 120 + k * 120, 250, 30, '#2a1a0c'); });
    if (!s.show && !s.open) label(c, '?', 240, 160, 60, '#ffd34d');
  },
  ring(c, s) {
    for (const p of s.pegs) for (const x of [p.x, p.x - 480]) prop(c, 'fox', 'peg', x, p.y + 30, 50, () => box(c, x - 5, p.y - 26, 10, 30, '#a8743e'));
    for (const l of s.landed.slice(-6)) if (!l.on) { c.globalAlpha = 0.4; prop(c, 'fox', 'ring', l.x, l.y + 30, 36, () => {}); c.globalAlpha = 1; }
    if (s.flying) prop(c, 'fox', 'ring', s.flying.x, s.flying.y + 18, 40, () => { c.beginPath(); c.ellipse(s.flying.x, s.flying.y, 18, 7, 0, 0, Math.PI * 2); c.strokeStyle = '#e5b72a'; c.lineWidth = 5; c.stroke(); });
    c.beginPath(); c.moveTo(240, 210); c.lineTo(240, 250); c.strokeStyle = '#ffd34d88'; c.lineWidth = 2; c.setLineDash([4, 4]); c.stroke(); c.setLineDash([]);
    label(c, `${s.hits} / 5`, 440, 24, 18);
    for (let k = 0; k < s.left; k++) disc(c, 30 + k * 20, 24, 7, '#e5b72a');
  },
};

// ── The stage ─────────────────────────────────────────────────────────────────

function backdrop(c: CanvasRenderingContext2D, key: `bg-${MicroId}` | `room-${WareHost}`, host: number) {
  if (paintWareBackdrop(c, key, FULL)) return;
  const g = c.createLinearGradient(0, 0, 0, 320);
  g.addColorStop(0, SKY[host][0]); g.addColorStop(1, SKY[host][1]);
  c.fillStyle = g; c.fillRect(0, 0, 480, 320);
  c.fillStyle = '#00000022'; c.fillRect(0, 272, 480, 48);
}
/** One cube of hay per life. */
function hay(c: CanvasRenderingContext2D, x: number, y: number, full: boolean) {
  box(c, x, y, 26, 22, full ? '#e8c45a' : '#00000044', '#5a4012', 4);
  if (full) { c.strokeStyle = '#b8902a'; c.lineWidth = 1.5; for (let k = 1; k < 4; k++) { c.beginPath(); c.moveTo(x + 2, y + k * 5.5); c.lineTo(x + 24, y + k * 5.5); c.stroke(); } }
}
function hostArt(c: CanvasRenderingContext2D, host: number, mood: WareMood, b: WareBox, now: number) {
  if (paintWareHost(c, HOST_KEYS[host], mood, b)) return;
  if (host < 2) chin(c, host === 0 ? 'enzo' : 'dora', b.x + b.w / 2, b.y + b.h, b.h * 0.6, now);
  else { disc(c, b.x + b.w / 2, b.y + b.h * 0.55, b.w * 0.3, TINT[host]); label(c, HOSTS[host].name, b.x + b.w / 2, b.y + b.h * 0.55, 16); }
}
const hostOf = (run: Run) => (run.mode === 'host' ? run.host : run.game ? MICROS[run.game]!.host : 0);

export function drawStage(c: CanvasRenderingContext2D, run: Run, now: number) {
  c.save();
  if (run.phase === 'micro' && run.game && run.state) {
    const micro = MICROS[run.game]!, s = run.state, done = micro.outcome(s) ?? (s.t >= micro.ticks ? (micro.survive ? 'win' : 'lose') : null);
    if (done === 'lose') c.translate(Math.sin(now / 18) * 4 * Math.max(0, 1 - run.t / 400), 0);
    backdrop(c, `bg-${run.game}`, micro.host);
    DRAW[run.game](c, s, now);
    // the command word bounces in, then the fuse burns along the bottom
    if (s.t <= COMMAND) {
      const k = s.t / COMMAND, scale = 1 + 0.35 * Math.max(0, 1 - k * 4) * Math.cos(k * 20);
      c.save(); c.translate(240, 150); c.scale(scale, scale); label(c, micro.verb, 0, 0, micro.boss ? 46 : 52, '#ffd34d'); c.restore();
    }
    const left = Math.max(0, 1 - s.t / micro.ticks);
    box(c, 0, 312, 480, 8, '#00000066', '#00000000', 0);
    c.fillStyle = left < 0.25 ? '#e8584a' : '#ffd34d'; c.fillRect(0, 312, 480 * left, 8);
    if (left > 0) disc(c, 480 * left, 316, 5 + Math.sin(now / 50) * 1.5, '#fff1a8', '#e8584a');
    if (done) label(c, done === 'win' ? '✓' : '✗', 240, 150, 90, done === 'win' ? '#7ad46a' : '#e8584a');
  } else {
    const host = hostOf(run), mood: WareMood = run.phase === 'clear' ? 'cheering' : run.phase === 'over' ? 'oops' : run.last === 'win' ? 'cheering' : run.last === 'lose' ? 'oops' : 'presenting';
    backdrop(c, `room-${HOST_KEYS[host]}`, host);
    hostArt(c, host, mood, { x: 20, y: 70, w: 230, h: 240 }, now);
    for (let k = 0; k < 4; k++) if (run.mode !== 'practice' || k === 0) hay(c, 20 + k * 32, 16, k < run.lives);
    const count = run.mode === 'practice' ? run.streak : run.cleared;
    label(c, `${count}`, 360, 130, 84, '#ffd34d');
    label(c, run.mode === 'host' ? HOSTS[run.host].stage : run.mode === 'remix' ? 'Remix' : `Practice · ${MICROS[run.game!]!.verb}`, 360, 200, 16);
    if (run.phase === 'clear') label(c, 'STAGE CLEAR!', 360, 250, 30, '#7ad46a');
    else if (run.phase === 'over') label(c, 'GAME OVER', 360, 250, 30, '#e8584a');
    else if (run.card === 'speedup') label(c, 'SPEED UP!', 360, 250, 32 + Math.sin(now / 80) * 2, '#ffd34d');
    else if (run.card === 'boss') label(c, 'BOSS!', 360, 250, 38 + Math.sin(now / 80) * 3, '#e8584a');
  }
  c.restore();
}

/** A gallery card: the microgame's backdrop with its best speed, or a locked silhouette. */
export function drawCard(c: CanvasRenderingContext2D, id: MicroId, b: WareBox, tier: number | null) {
  const micro = MICROS[id]!;
  c.save(); c.beginPath(); c.roundRect(b.x, b.y, b.w, b.h, 10); c.clip();
  c.translate(b.x, b.y); c.scale(b.w / 480, b.h / 320);
  backdrop(c, `bg-${id}`, micro.host);
  if (tier === null) { c.fillStyle = '#0a0a14d9'; c.fillRect(0, 0, 480, 320); label(c, '?', 240, 160, 120, '#ffffff55'); }
  c.restore();
}
