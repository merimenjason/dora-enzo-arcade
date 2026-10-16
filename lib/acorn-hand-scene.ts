import { paintAcorn } from './acorn-hand-paint';
import { ACORN_CROPS } from './acorn-hand-crops';
// Acorn Hand's pictures, drawn in Canvas 2D: card faces and backs, the four suit pips, chinchilla face cards, charm
// portraits and the rivals who set the boss rules. Drawing only; the page decides what goes where.
import { drawChinchilla, coatLike, type Coat } from './chinchilla-art';
import { predator, critter, tintOf, shade, type PredKind, type CritterKind } from './predator-art';
import { fitDraw } from './art-fit';
import { type Card, type Charm, type Rival, type Voucher, type PackType, type PackKind, CHARMS, TREATS, type Item, VOUCHERS, VOUCHER_COST, rankName } from './acorn-hand-cards';

type C2D = CanvasRenderingContext2D;
export const SUIT_INK = ['#7a4a1e', '#2f7a33', '#b42840', '#4d5d72'];
const PAPER = '#fbf3e1', PAPER_EDGE = '#d9c49a', BACK = '#3a2540';

const rounded = (c: C2D, x: number, y: number, w: number, h: number, r: number) => {
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
};

/** One suit pip, centred on (x, y), `s` pixels across. */
export function drawSuit(c: C2D, suit: number, x: number, y: number, s: number) {
  if (paintAcorn(c, 'suits', suit, x - s / 2, y - s / 2, s, s)) return;
  c.save(); c.translate(x, y); c.scale(s / 24, s / 24); c.lineJoin = 'round'; c.lineCap = 'round';
  if (suit === 0) {
    // Acorn: a glossy nut under a cross-hatched cap and a little stalk.
    const nut = c.createLinearGradient(-7, 0, 7, 0); nut.addColorStop(0, '#b97a3c'); nut.addColorStop(0.55, '#d89a55'); nut.addColorStop(1, '#8a5424');
    c.beginPath(); c.moveTo(-7.5, -1); c.bezierCurveTo(-8, 7, -3, 11, 0, 12); c.bezierCurveTo(3, 11, 8, 7, 7.5, -1); c.closePath(); c.fillStyle = nut; c.fill(); c.strokeStyle = '#5a3416'; c.lineWidth = 1.2; c.stroke();
    c.beginPath(); c.ellipse(0, -2.5, 9.5, 5, 0, Math.PI, 0); c.lineTo(9.5, -1); c.quadraticCurveTo(0, 1.6, -9.5, -1); c.closePath(); c.fillStyle = '#6b4320'; c.fill(); c.stroke();
    c.strokeStyle = 'rgba(255,220,170,.35)'; c.lineWidth = 0.8; for (let i = -8; i <= 8; i += 3) { c.beginPath(); c.moveTo(i, -6.5); c.lineTo(i + 3, -0.5); c.stroke(); }
    c.strokeStyle = '#5a3416'; c.lineWidth = 1.8; c.beginPath(); c.moveTo(0, -7); c.quadraticCurveTo(1, -10.5, 3.5, -11); c.stroke();
    c.fillStyle = 'rgba(255,255,255,.45)'; c.beginPath(); c.ellipse(-3.2, 4, 1.4, 3, -0.3, 0, Math.PI * 2); c.fill();
  } else if (suit === 1) {
    // Clover: three heart leaves and a curling stem.
    c.strokeStyle = '#2c5e24'; c.lineWidth = 1.8; c.beginPath(); c.moveTo(0, 2); c.quadraticCurveTo(1, 8, 5, 11); c.stroke();
    for (const a of [-Math.PI / 2, Math.PI / 6, (5 * Math.PI) / 6]) {
      c.save(); c.rotate(a + Math.PI / 2);
      c.beginPath(); c.moveTo(0, 0); c.bezierCurveTo(-7, -4, -7, -11, -3, -11); c.bezierCurveTo(-1, -11, 0, -9, 0, -8); c.bezierCurveTo(0, -9, 1, -11, 3, -11); c.bezierCurveTo(7, -11, 7, -4, 0, 0);
      const g = c.createLinearGradient(0, -11, 0, 0); g.addColorStop(0, '#6cc35a'); g.addColorStop(1, '#2f8a33'); c.fillStyle = g; c.fill(); c.strokeStyle = '#225a1f'; c.lineWidth = 1; c.stroke();
      c.strokeStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.moveTo(0, -1.5); c.lineTo(0, -7); c.stroke(); c.restore();
    }
  } else if (suit === 2) {
    // Berry: a cluster of three with a shine each, under two leaves.
    c.fillStyle = '#3f8a3a'; c.strokeStyle = '#255a22'; c.lineWidth = 1;
    for (const d of [-1, 1]) { c.beginPath(); c.ellipse(d * 4, -8, 5, 2.2, d * -0.5, 0, Math.PI * 2); c.fill(); c.stroke(); }
    for (const [bx, by] of [[-4.5, -1], [4.5, -1], [0, 6]]) {
      const g = c.createRadialGradient(bx - 2, by - 2, 0.5, bx, by, 6.5); g.addColorStop(0, '#f2647c'); g.addColorStop(1, '#a01c34');
      c.beginPath(); c.arc(bx, by, 6, 0, Math.PI * 2); c.fillStyle = g; c.fill(); c.strokeStyle = '#6e0f22'; c.stroke();
      c.fillStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.arc(bx - 2.2, by - 2.2, 1.4, 0, Math.PI * 2); c.fill();
    }
  } else {
    // Pebble: a smooth river stone with a band and a gleam.
    const g = c.createLinearGradient(-10, -8, 10, 9); g.addColorStop(0, '#9aa8ba'); g.addColorStop(1, '#4d5d72');
    c.beginPath(); c.moveTo(-10, 1); c.bezierCurveTo(-11, -8, 6, -11, 10, -3); c.bezierCurveTo(13, 4, 4, 11, -3, 10); c.bezierCurveTo(-8, 9, -10, 6, -10, 1); c.closePath();
    c.fillStyle = g; c.fill(); c.strokeStyle = '#323e4e'; c.lineWidth = 1.2; c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(-8, 3); c.quadraticCurveTo(0, -2, 10, 1); c.stroke();
    c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.ellipse(-4, -4, 3, 1.4, -0.4, 0, Math.PI * 2); c.fill();
  }
  c.restore();
}

/** A face card's chinchilla: the jack is grey, the queen white, the king a brown elder in a little crown. */
const FACE_COATS: Record<number, Coat | 'dora' | 'enzo'> = {
  11: 'enzo', 12: 'dora',
  13: coatLike('enzo', { fur: '#9a7552', back: '#6e5236', face: '#b69171', shade: '#7d5e42', tail: '#9a7552', tailOuter: '#7d5e42', tailInner: '#c4a283', texture: '#7d5e42', bands: false }),
};
function faceArt(c: C2D, rank: number, suit: number, x: number, y: number, w: number, h: number) {
  if (paintAcorn(c, 'court', rank - 11, x, y, w, h)) return;
  const coat = FACE_COATS[rank], ink = SUIT_INK[suit];
  fitDraw(c, `ah-face-${rank}-${suit}`, x, y, w, h, (q) => drawChinchilla(q, coat as Coat, 0, 0, {
    face: 1, h: 24, time: 0.4, bib: { color: ink, trim: '#fff3d6', label: rankName(rank) },
    decorate: rank === 13 ? (d, bob) => {
      d.save(); d.translate(5.5, -21.5 + bob); d.fillStyle = '#f2c64a'; d.strokeStyle = '#8a6216'; d.lineWidth = 0.5;
      d.beginPath(); d.moveTo(-3, 0); d.lineTo(-3, -2.4); d.lineTo(-1.5, -1); d.lineTo(0, -3); d.lineTo(1.5, -1); d.lineTo(3, -2.4); d.lineTo(3, 0); d.closePath(); d.fill(); d.stroke(); d.restore();
    } : undefined,
  }));
}

const L_ = 0.34, M_ = 0.5, R_ = 0.66, T_ = 0.22, B_ = 0.78;
const PIPS: Record<number, [number, number][]> = {
  2: [[M_, T_], [M_, B_]],
  3: [[M_, T_], [M_, 0.5], [M_, B_]],
  4: [[L_, T_], [R_, T_], [L_, B_], [R_, B_]],
  5: [[L_, T_], [R_, T_], [M_, 0.5], [L_, B_], [R_, B_]],
  6: [[L_, T_], [R_, T_], [L_, 0.5], [R_, 0.5], [L_, B_], [R_, B_]],
  7: [[L_, T_], [R_, T_], [M_, 0.36], [L_, 0.5], [R_, 0.5], [L_, B_], [R_, B_]],
  8: [[L_, T_], [R_, T_], [M_, 0.36], [L_, 0.5], [R_, 0.5], [M_, 0.64], [L_, B_], [R_, B_]],
  9: [[L_, 0.2], [R_, 0.2], [L_, 0.4], [R_, 0.4], [M_, 0.5], [L_, 0.6], [R_, 0.6], [L_, 0.8], [R_, 0.8]],
  10: [[L_, 0.2], [R_, 0.2], [M_, 0.3], [L_, 0.4], [R_, 0.4], [L_, 0.6], [R_, 0.6], [M_, 0.7], [L_, 0.8], [R_, 0.8]],
};

const GLOSS_LOOK: Record<string, { edge: string; glow: string; label: string }> = {
  honey: { edge: '#e0a020', glow: 'rgba(240,180,40,.28)', label: 'Honey' },
  ember: { edge: '#e2562e', glow: 'rgba(230,90,40,.24)', label: 'Ember' },
  crystal: { edge: '#58b8e0', glow: 'rgba(120,200,240,.3)', label: 'Crystal' },
  gold: { edge: '#d4a838', glow: 'rgba(250,215,90,.35)', label: 'Gold' },
};

/** A card, filling a `w` × `h` canvas. A face-down card shows its back. `asleep` greys it for a boss rule. */
export function drawCard(c: C2D, card: Card | null, w: number, h: number, o: { down?: boolean; asleep?: boolean } = {}) {
  c.clearRect(0, 0, w, h);
  const r = w * 0.09, pad = 1;
  if (!card || o.down) {
    c.save(); rounded(c, pad, pad, w - pad * 2, h - pad * 2, r); c.clip();
    const painted = paintAcorn(c, 'card-back', 0, 0, 0, w, h); c.restore();
    if (painted) return;
    rounded(c, pad, pad, w - pad * 2, h - pad * 2, r); c.fillStyle = BACK; c.fill(); c.strokeStyle = '#1e1224'; c.lineWidth = 1.5; c.stroke();
    rounded(c, w * 0.08, w * 0.08, w * 0.84, h - w * 0.16, r * 0.7); c.strokeStyle = '#c9a25a'; c.lineWidth = 1.2; c.stroke();
    c.save(); rounded(c, w * 0.08, w * 0.08, w * 0.84, h - w * 0.16, r * 0.7); c.clip(); c.globalAlpha = 0.35;
    for (let yy = 0; yy < h + 20; yy += w * 0.3) for (let xx = (yy / (w * 0.3)) % 2 ? w * 0.15 : 0; xx < w + 20; xx += w * 0.3) drawSuit(c, 0, xx, yy, w * 0.16);
    c.restore();
    return;
  }
  const look = card.gloss ? GLOSS_LOOK[card.gloss] : null, ink = SUIT_INK[card.suit];
  rounded(c, pad, pad, w - pad * 2, h - pad * 2, r);
  const paper = c.createLinearGradient(0, 0, 0, h); paper.addColorStop(0, '#fffaf0'); paper.addColorStop(1, PAPER);
  c.fillStyle = paper; c.fill();
  if (look) { c.fillStyle = look.glow; c.fill(); }
  c.strokeStyle = look ? look.edge : PAPER_EDGE; c.lineWidth = look ? 3 : 1.5; c.stroke();
  // Face cards reserve a header/footer for rank and pip; portraits stay in the middle.
  const court = card.rank >= 11 && card.rank <= 13;
  // Number cards keep rank over pip; court cards put them side by side.
  const fs = Math.round(w * 0.24), name = rankName(card.rank);
  const corner = () => {
    c.fillStyle = ink; c.font = `700 ${fs}px Georgia, serif`; c.textAlign = 'center'; c.textBaseline = 'top';
    c.fillText(name, w * 0.15, h * 0.04);
    drawSuit(c, card.suit, w * (court ? 0.37 : 0.15), h * 0.04 + fs * (court ? 0.55 : 1.35), w * 0.17);
  };
  corner(); c.save(); c.translate(w, h); c.rotate(Math.PI); corner(); c.restore();
  if (court) {
    const panel = c.createLinearGradient(0, h * 0.2, 0, h * 0.8); panel.addColorStop(0, 'rgba(0,0,0,0)'); panel.addColorStop(1, `${SUIT_INK[card.suit]}22`);
    c.save(); rounded(c, w * 0.08, h * 0.25, w * 0.84, h * 0.5, r * 0.6); c.fillStyle = panel; c.fill(); c.restore();
    faceArt(c, card.rank, card.suit, w * 0.06, h * 0.25, w * 0.88, h * 0.5);
  } else if (card.rank === 14) {
    c.beginPath(); c.arc(w / 2, h / 2, w * 0.27, 0, Math.PI * 2); c.strokeStyle = ink; c.globalAlpha = 0.35; c.lineWidth = 2; c.stroke(); c.globalAlpha = 1;
    drawSuit(c, card.suit, w / 2, h / 2, w * 0.42);
  } else {
    // Number cards: pips where a printed deck puts them.
    const size = w * (card.rank <= 3 ? 0.24 : card.rank <= 6 ? 0.2 : 0.17);
    for (const [px, py] of PIPS[card.rank]) drawSuit(c, card.suit, w * px, h * py, size);
  }
  if (look) {
    c.fillStyle = look.edge; c.font = `700 ${Math.round(w * 0.11)}px system-ui, sans-serif`; c.textAlign = court ? 'left' : 'center'; c.textBaseline = 'bottom';
    // The court card's lower-right index has its own lane; gloss stays at lower left.
    c.fillText(look.label.toUpperCase(), court ? w * 0.06 : w / 2, h - h * 0.025, w * (court ? 0.43 : 0.8));
  }
  if (o.asleep) { rounded(c, pad, pad, w - pad * 2, h - pad * 2, r); c.fillStyle = 'rgba(40,30,50,.55)'; c.fill(); c.fillStyle = '#fff'; c.font = `${Math.round(w * 0.3)}px serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('z', w / 2, h / 2); }
}

const RARITY_FRAME = ['', '#9a7a52', '#9fb0c8', '#e6b84a'];
/** A charm: a chinchilla friend in a coloured bib, framed by rarity. */
export function drawCharm(c: C2D, charm: Charm, w: number, h: number) {
  c.clearRect(0, 0, w, h);
  const r = w * 0.1, frame = RARITY_FRAME[charm.rarity];
  rounded(c, 1, 1, w - 2, h - 2, r);
  const bg = c.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#4a3550'); bg.addColorStop(1, '#2a1d30'); c.fillStyle = bg; c.fill();
  c.strokeStyle = frame; c.lineWidth = charm.rarity === 3 ? 3.5 : 2.5; c.stroke();
  const glow = c.createRadialGradient(w / 2, h * 0.55, 2, w / 2, h * 0.55, w * 0.6); glow.addColorStop(0, 'rgba(255,220,150,.28)'); glow.addColorStop(1, 'rgba(255,220,150,0)');
  c.fillStyle = glow; c.fillRect(0, 0, w, h);
  const index = CHARMS.findIndex((v) => v.id === charm.id);
  if (paintAcorn(c, `charms-${Math.floor(index / 6)}`, index % 6, w * 0.04, h * 0.05, w * 0.92, h * 0.8)) return;
  // A faint emblem for the charm's family: its suit, ×mult, +mult, chips or nuts.
  const suitTag = charm.tags.find((t) => /^s[0-3]$/.test(t));
  c.save(); c.globalAlpha = 0.22;
  if (suitTag) drawSuit(c, Number(suitTag[1]), w / 2, h * 0.36, w * 0.62);
  else {
    const glyph = charm.text.includes('×') ? '×' : charm.tags.includes('econ') ? '¤' : charm.text.includes('mult') ? '+' : charm.text.includes('chips') ? '◆' : '★';
    c.fillStyle = charm.text.includes('×') || charm.text.includes('mult') ? '#ff8a7a' : charm.text.includes('chips') ? '#8ac8ff' : '#ffd977';
    c.font = `900 ${Math.round(w * 0.62)}px Georgia, serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(glyph, w / 2, h * 0.38);
  }
  c.restore();
  const L = charm.look, fur = L.fur;
  const coat = coatLike(L.base, { fur, back: shade(fur, 0.86), face: shade(fur, 1.08), shade: shade(fur, 0.8), tail: fur, tailOuter: shade(fur, 0.84), tailInner: shade(fur, 1.12), texture: shade(fur, 0.82) });
  fitDraw(c, `ah-charm-${charm.id}`, w * 0.1, h * 0.1, w * 0.8, h * 0.68, (q) => drawChinchilla(q, coat, 0, 0, { face: 1, h: 24, time: 0.4, bib: { color: L.bib, trim: '#fff3d6', label: charm.name[0] } }));
}

const VOUCHER_TINT = ['#c8743a', '#5f8f6a', '#b8892f', '#8a6a3c', '#a4524f', '#5c7fa8', '#7a5ea0', '#c09a4a', '#4f8f8f', '#6f9a3c'];
/** A voucher: a ticket stub with a paw stamp and its price, tinted by which voucher it is. */
export function drawVoucher(c: C2D, v: Voucher, w: number, h: number) {
  c.clearRect(0, 0, w, h);
  const index = VOUCHERS.findIndex((vch) => vch.id === v.id);
  // Squirrel Hoard was repainted on its own sheet; the rest stay on the shared one.
  if (v.id === 'hoard' ? paintAcorn(c, 'voucher-hoard', 0, 0, 0, w, h) : paintAcorn(c, 'vouchers', index, 0, 0, w, h)) {
    c.fillStyle = '#3b2819'; c.font = `700 ${Math.round(w * 0.1)}px Georgia, serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    // The outer edge narrows at the notch: centre the price on solid paper, inward of that cutout.
    c.fillText(String(VOUCHER_COST), w * (v.id === 'hoard' ? 0.81 : 0.79), h * 0.5, w * 0.12); return;
  }
  const tint = VOUCHER_TINT[Math.max(0, VOUCHERS.findIndex((x) => x.id === v.id)) % VOUCHER_TINT.length];
  const x = w * 0.06, y = h * 0.16, tw = w * 0.88, th = h * 0.68, notch = th * 0.14, mid = y + th / 2;
  // The ticket, with a half-round bite out of each end.
  c.beginPath(); c.moveTo(x, y); c.lineTo(x + tw, y);
  c.lineTo(x + tw, mid - notch); c.arc(x + tw, mid, notch, -Math.PI / 2, Math.PI / 2, true); c.lineTo(x + tw, y + th);
  c.lineTo(x, y + th); c.lineTo(x, mid + notch); c.arc(x, mid, notch, Math.PI / 2, -Math.PI / 2, true); c.closePath();
  const g = c.createLinearGradient(0, y, 0, y + th); g.addColorStop(0, shade(tint, 1.15)); g.addColorStop(1, shade(tint, 0.8)); c.fillStyle = g; c.fill();
  c.strokeStyle = '#fff3d6'; c.lineWidth = 2; c.stroke();
  // Perforation between the ticket and its stub.
  c.save(); c.setLineDash([3, 4]); c.strokeStyle = 'rgba(255,243,214,.7)'; c.beginPath(); c.moveTo(x + tw * 0.72, y + 4); c.lineTo(x + tw * 0.72, y + th - 4); c.stroke(); c.restore();
  // A paw stamp: a pad and four toes.
  const px = x + tw * 0.36, py = y + th * 0.6, s = th * 0.17;
  c.fillStyle = 'rgba(255,243,214,.9)';
  c.beginPath(); c.ellipse(px, py, s * 1.1, s * 0.85, 0, 0, Math.PI * 2); c.fill();
  for (const [dx, dy] of [[-1.25, -1.15], [-0.45, -1.7], [0.45, -1.7], [1.25, -1.15]]) { c.beginPath(); c.arc(px + dx * s, py + dy * s, s * 0.42, 0, Math.PI * 2); c.fill(); }
  c.fillStyle = '#fff3d6'; c.font = `700 ${Math.round(th * 0.24)}px Georgia, serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(VOUCHER_COST), x + tw * 0.83, mid);
}

const PACK_TINT: Record<PackKind, [string, string]> = { charm: ['#7a4f8a', '#3e2648'], almanac: ['#4f7a5a', '#26402e'], treat: ['#b0603a', '#5a2c18'], card: ['#3f6390', '#1f3250'] };
const PACK_SUIT: Record<PackKind, number> = { charm: 2, almanac: 1, treat: 0, card: 3 };
/** A booster pack: a crimped acorn-paper packet, coloured by kind, gold-edged and banded when big. */
export function drawPack(c: C2D, t: PackType, w: number, h: number) {
  c.clearRect(0, 0, w, h);
  const index = ['charm', 'almanac', 'treat', 'card'].indexOf(t.kind) + (t.big ? 4 : 0);
  if (paintAcorn(c, 'packs', index, w * 0.03, h * 0.03, w * 0.94, h * 0.94)) return;
  const [hi, lo] = PACK_TINT[t.kind], x = w * 0.14, y = h * 0.06, pw = w * 0.72, ph = h * 0.88, teeth = 7, tooth = ph * 0.04;
  c.beginPath(); c.moveTo(x, y + tooth);
  for (let i = 0; i < teeth; i++) { c.lineTo(x + (pw * (i + 0.5)) / teeth, y); c.lineTo(x + (pw * (i + 1)) / teeth, y + tooth); }
  c.lineTo(x + pw, y + ph - tooth);
  for (let i = teeth - 1; i >= 0; i--) { c.lineTo(x + (pw * (i + 0.5)) / teeth, y + ph); c.lineTo(x + (pw * i) / teeth, y + ph - tooth); }
  c.closePath();
  const g = c.createLinearGradient(x, 0, x + pw, 0); g.addColorStop(0, lo); g.addColorStop(0.45, hi); g.addColorStop(1, lo); c.fillStyle = g; c.fill();
  c.strokeStyle = t.big ? '#e6b84a' : '#fff3d6'; c.lineWidth = t.big ? 3 : 2; c.stroke();
  // Crimped bands at the top and bottom.
  c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(x, y + tooth, pw, ph * 0.07); c.fillRect(x, y + ph - tooth - ph * 0.07, pw, ph * 0.07);
  drawSuit(c, PACK_SUIT[t.kind], x + pw / 2, y + ph * 0.44, pw * 0.5);
  if (t.big) {
    c.fillStyle = '#e6b84a'; c.fillRect(x, y + ph * 0.7, pw, ph * 0.12);
    c.fillStyle = '#3b2a14'; c.font = `900 ${Math.round(ph * 0.09)}px Georgia, serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('BIG', x + pw / 2, y + ph * 0.76);
  }
}

/** The critters' colours, as Summit Shuffle paints them. */
const CRITTERS: Record<string, { body: string; dark: string; light: string; eye: string }> = {
  beetle: { body: '#8a5a3c', dark: '#4a2f22', light: '#e2b56a', eye: '#16121a' },
  armadillo: { body: '#b79a7a', dark: '#6e5844', light: '#ecdcc4', eye: '#16121a' },
  lizard: { body: '#7fa06a', dark: '#4c6a42', light: '#dfe8b6', eye: '#ffd23e' },
};
/** A rival from the woods, fitted into a `w` × `h` box. */
export type Pose = 'calm' | 'happy' | 'sad';
/** A rival portrait. Happy and sad poses come from painted pose sheets once they exist; until then the calm one stands in. */
export function drawRival(c: C2D, rival: Rival, w: number, h: number, t = 0.4, pose: Pose = 'calm') {
  c.clearRect(0, 0, w, h);
  const rivals: Rival[] = ['fox', 'owl', 'hawk', 'snake', 'badger', 'skunk', 'weasel', 'mole', 'bear', 'cougar', 'beetle', 'lizard'];
  const index = rivals.indexOf(rival), sheet = rival === 'armadillo' ? 'rival-armadillo' : `rivals-${Math.floor(index / 6)}`, cell = rival === 'armadillo' ? 0 : index % 6;
  if (pose !== 'calm' && ACORN_CROPS[`${sheet}-${pose}`] && paintAcorn(c, `${sheet}-${pose}`, cell, 0, 0, w, h)) return;
  if (paintAcorn(c, sheet, cell, 0, 0, w, h)) return;
  if (CRITTERS[rival]) fitDraw(c, `ah-rival-${rival}`, 0, 0, w, h, (q) => critter(q, rival as CritterKind, CRITTERS[rival], t), -1);
  else fitDraw(c, `ah-rival-${rival}`, 0, 0, w, h, (q) => predator(q, rival as PredKind, tintOf(rival as PredKind, false), t), -1);
}

/** Shared art for all treat and almanac slots, shop offers and pack choices. */
export function drawItem(c: C2D, item: Item, w: number, h: number) {
  c.clearRect(0, 0, w, h);
  const index = item.kind === 'almanac' ? 13 : TREATS.findIndex((t) => t.id === item.id);
  if (paintAcorn(c, 'items', index, 0, 0, w, h)) return;
  c.fillStyle = '#d6b876'; c.font = `${Math.round(h * 0.65)}px Georgia`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(item.kind === 'almanac' ? '▤' : '✦', w / 2, h / 2);
}
