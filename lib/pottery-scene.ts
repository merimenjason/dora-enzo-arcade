// Kiln & Clay's drawing, all Canvas 2D. The workshop painting behind the wheel, the wheel and its splash pan, the
// spinning clay (a stack of shaded strips with throwing rings, grit that sweeps round as it spins, a wet sheen, the
// rim seen from a little above, and the faint line of the inside wall), the ghost of the customer's outline, the
// fingertip and the slip it flings, a wobble and a red glow when a wall is close to giving way, the slump of a
// collapse; glazes (raw and chalky before the kiln, glossy after), bands, speckles, drips, handles, lips, lids and
// spouts; the kiln with its dial; the counter where a neighbour collects their pot; and Dora and Enzo's painted
// moods either side of the wheel. Every painting has a drawn stand-in until (or unless) it loads.
import { drawChinchilla } from './chinchilla-art';
import {
  GLAZES, CUSTOMERS, shapeR, shapeMaxR, glazeAt, SPEEDS, type Wheel, type Profile, type Shape, type Glaze, type GlazeId, type HandleId, type Firing, type Finish,
  type CustomerId, type PartId, type WheelEv, type Mode,
} from './pottery-game';

export type Mood = 'focus' | 'cheer' | 'oops';
export type View = 'throw' | 'glaze' | 'fire' | 'deliver' | 'idle';
export type PieceArt = { parts: { id: PartId; prof: Profile }[]; handle: HandleId | null; glaze: Glaze | null; fired: boolean; finish?: Finish; cracked?: boolean; lip?: boolean };
export type DrawOpts = {
  dt: number; view: View;
  wheel?: Wheel | null; piece?: PieceArt | null; target?: Shape | null; ghost?: boolean;
  /** Pieces in the kiln (one or two). */
  kiln?: PieceArt[]; firing?: Firing | null;
  mood?: Mood; customer?: CustomerId | null;
  /** Where the mouse is hovering, in pot units, and what a press there would do. */
  hover?: { x: number; y: number; mode: Mode | null } | null;
  /** A band being painted, as fractions of the pot's height. */
  band?: { u0: number; u1: number; g: GlazeId } | null;
  speed?: number; paused?: boolean;
};
type Spark = { x: number; y: number; vx: number; vy: number; life: number; max: number; r: number; col: string; kind: 'slip' | 'drop' | 'chunk' | 'spark' | 'star' };

const CLAY_WET = [150, 86, 54], CLAY_DRY = [196, 132, 92], CLAY_FIRED = [214, 140, 96];
const hexRgb = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a: number[], b: number[], t: number) => a.map((v, i) => v + (b[i] - v) * t);
const rgb = (c: number[], k = 1, a = 1) => `rgba(${Math.round(Math.min(255, Math.max(0, c[0] * k)))},${Math.round(Math.min(255, Math.max(0, c[1] * k)))},${Math.round(Math.min(255, Math.max(0, c[2] * k)))},${a})`;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
/** A fixed scatter of grit on the clay, so it looks the same every time. */
const GRIT = Array.from({ length: 90 }, (_, i) => { const h = Math.sin(i * 91.7 + 3.1) * 43758.5453, f = h - Math.floor(h), g = Math.sin(i * 12.9 + 7.7) * 15731.31; return { u: (i + 0.5) / 90, th: f * Math.PI * 2, r: 0.5 + (g - Math.floor(g)) * 1.2, light: i % 3 === 0 }; });
const SPECK = Array.from({ length: 160 }, (_, i) => { const h = Math.sin(i * 47.3 + 1.7) * 24634.6345, f = h - Math.floor(h); return { u: ((i * 0.618) % 1), th: f * Math.PI * 2, r: 0.6 + ((i * 7) % 5) * 0.25 }; });
const E = 0.2; // how round the rims look: the camera sits a little above the wheel

/** A profile's outer and inner radius at a fraction of its height. */
function sampleProf(p: Profile, u: number) {
  const k = clamp(u, 0, 1) * (p.r.length - 1), i = Math.min(p.r.length - 2, Math.floor(k)), f = k - i;
  return { R: p.r[i] + (p.r[i + 1] - p.r[i]) * f, Ri: p.ri[i] + (p.ri[i + 1] - p.ri[i]) * f };
}

/** An unfired glaze: chalky and paler than it fires, but with enough of its colour to tell them apart. */
const rawRgb = (g: GlazeId) => { const a = hexRgb(GLAZES[g].raw), b = hexRgb(GLAZES[g].hex); return a.map((v, i) => Math.round(v * 0.5 + b[i] * 0.5)); };
/** Draws a pot (one profile) standing on a base line: cx, by in px, s px per unit. */
export function drawPot(c: CanvasRenderingContext2D, p: Profile, cx: number, by: number, s: number, o: {
  spin?: number; wet?: number; glaze?: Glaze | null; fired?: boolean; finish?: Finish; cracked?: boolean; strain?: number; inner?: boolean; solid?: boolean; glow?: number; flat?: boolean; band?: { u0: number; u1: number; g: GlazeId } | null;
} = {}) {
  const H = p.h * s, spin = o.spin ?? 0, wet = o.wet ?? 0, gl = o.glaze ?? null, fired = !!o.fired;
  if (H < 1) return;
  const clay = fired ? CLAY_FIRED : mix(CLAY_DRY, CLAY_WET, clamp(wet, 0, 1));
  const colAt = (u: number): number[] => {
    if (o.band && u >= o.band.u0 && u <= o.band.u1) return (fired ? hexRgb(GLAZES[o.band.g].hex) : rawRgb(o.band.g));
    const g = gl ? glazeAt(gl, u) : null;
    return g ? (fired ? hexRgb(GLAZES[g].hex) : rawRgb(g)) : clay;
  };
  const step = Math.max(1.5, Math.min(3, H / 90));
  // the body, in thin strips, each shaded like a cylinder and brighter where the wall faces up
  for (let y = 0; y < H; y += step) {
    const u = (y + step / 2) / H, { R } = sampleProf(p, u);
    if (R * s < 0.5) continue;
    const up = sampleProf(p, Math.min(1, u + 0.02)).R, dn = sampleProf(p, Math.max(0, u - 0.02)).R;
    const slope = (dn - up) / Math.max(1e-6, 0.04 * p.h);
    const lift = clamp(slope * 0.18, -0.25, 0.3);
    const col = colAt(u), x0 = cx - R * s, x1 = cx + R * s;
    const g = c.createLinearGradient(x0, 0, x1, 0);
    g.addColorStop(0, rgb(col, 0.5 + lift * 0.5));
    g.addColorStop(0.22, rgb(col, 0.92 + lift));
    g.addColorStop(0.42, rgb(col, 1.06 + lift));
    g.addColorStop(0.72, rgb(col, 0.82 + lift * 0.7));
    g.addColorStop(1, rgb(col, 0.48 + lift * 0.4));
    c.fillStyle = g;
    c.fillRect(x0, by - y - step - 0.6, x1 - x0, step + 1.2);
  }
  // the foot: the front half of its circle, below the base line
  const foot = sampleProf(p, 0).R * s;
  if (foot > 1) {
    const g = c.createLinearGradient(cx - foot, 0, cx + foot, 0), col = colAt(0.01);
    g.addColorStop(0, rgb(col, 0.45)); g.addColorStop(0.4, rgb(col, 0.85)); g.addColorStop(1, rgb(col, 0.4));
    c.fillStyle = g; c.beginPath(); c.ellipse(cx, by, foot, foot * E, 0, 0, Math.PI); c.fill();
  }
  // throwing rings: fine grooves round the pot, curving with the ellipse of each ring
  if (!o.flat) {
    c.lineWidth = Math.max(0.6, s * 0.035);
    for (let k = 1; k < 14; k++) {
      const u = k / 14 + Math.sin(k * 3.3) * 0.012, { R } = sampleProf(p, u), y = by - u * H;
      if (R * s < 3) continue;
      c.strokeStyle = gl && glazeAt(gl, u) ? (fired ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)') : `rgba(60,24,8,${0.1 + wet * 0.08})`;
      c.beginPath(); c.ellipse(cx, y, R * s * 0.995, R * s * E, 0, 0.12, Math.PI - 0.12); c.stroke();
    }
  }
  // grit and slip sweeping round: what shows the wheel turning
  if (!o.flat) for (const g of GRIT) {
    const th = g.th + spin, cs = Math.cos(th); if (cs < 0.15) continue;
    const { R } = sampleProf(p, g.u), x = cx + Math.sin(th) * R * s, y = by - g.u * H + cs * R * s * E;
    const glazed = gl && glazeAt(gl, g.u);
    if (glazed && fired) continue;
    c.fillStyle = g.light ? `rgba(255,236,210,${(glazed ? 0.2 : 0.3) * cs})` : `rgba(70,30,10,${(glazed ? 0.12 : 0.28) * cs})`;
    c.beginPath(); c.ellipse(x, y, Math.max(0.4, g.r * s * 0.07 * cs + 0.5), Math.max(0.4, g.r * s * 0.03 + 0.3), 0, 0, Math.PI * 2); c.fill();
  }
  // speckles in the glaze
  if (gl?.speckle) for (const k of SPECK) {
    const th = k.th + spin, cs = Math.cos(th); if (cs < 0.05) continue;
    const { R } = sampleProf(p, k.u), x = cx + Math.sin(th) * R * s, y = by - k.u * H + cs * R * s * E;
    c.fillStyle = `rgba(74,44,22,${0.65 * cs})`;
    c.beginPath(); c.ellipse(x, y, Math.max(0.5, k.r * s * 0.05 * cs + 0.5), Math.max(0.5, k.r * s * 0.045), 0, 0, Math.PI * 2); c.fill();
  }
  // drips running down from the rim
  if (gl?.drip) {
    const col = (fired ? hexRgb(GLAZES[gl.drip].hex) : rawRgb(gl.drip));
    for (let i = 0; i < 9; i++) {
      const th = (i / 9) * Math.PI * 2 + spin + i * 0.4, cs = Math.cos(th); if (cs < 0.1) continue;
      const len = 0.16 + ((i * 37) % 7) * 0.035, w0 = (0.22 + (i % 3) * 0.08) * s * cs;
      c.fillStyle = rgb(col, 0.85 + 0.2 * cs);
      c.beginPath();
      for (let k = 0; k <= 10; k++) { const u = 1 - (len * k) / 10, { R } = sampleProf(p, u), x = cx + Math.sin(th) * R * s, y = by - u * H + cs * R * s * E; const w = w0 * (1 - k / 14); if (k === 0) c.moveTo(x - w, y); else c.lineTo(x - w, y); }
      for (let k = 10; k >= 0; k--) { const u = 1 - (len * k) / 10, { R } = sampleProf(p, u), x = cx + Math.sin(th) * R * s, y = by - u * H + cs * R * s * E; const w = w0 * (1 - k / 14); c.lineTo(x + w, y); }
      c.closePath(); c.fill();
      const { R } = sampleProf(p, 1 - len), x = cx + Math.sin(th) * R * s, y = by - (1 - len) * H + cs * R * s * E;
      c.beginPath(); c.arc(x, y + w0 * 0.3, w0 * 0.9, 0, Math.PI * 2); c.fill();
    }
  }
  // a wet sheen, or a glossy shine after the kiln
  const shine = fired ? (o.finish === 'shine' ? 0.42 : o.finish === 'good' ? 0.24 : 0.06) : wet > 0.4 ? (wet - 0.4) * 0.45 : 0;
  if (shine > 0.02 && !o.flat) {
    for (let y = 0; y < H; y += step) {
      const u = (y + step / 2) / H, { R } = sampleProf(p, u); if (R * s < 2) continue;
      const g = gl && glazeAt(gl, u);
      if (fired && !g) continue;
      c.fillStyle = `rgba(255,250,240,${shine * (fired ? 1 : 0.8)})`;
      c.fillRect(cx - R * s * 0.48, by - y - step - 0.4, R * s * 0.13, step + 0.8);
      c.fillStyle = `rgba(255,250,240,${shine * 0.35})`;
      c.fillRect(cx + R * s * 0.55, by - y - step - 0.4, R * s * 0.06, step + 0.8);
    }
  }
  // close to giving way: the thin walls glow red
  if ((o.strain ?? 0) > 0.55) {
    const a = clamp(((o.strain ?? 0) - 0.55) * 1.6, 0, 0.6);
    for (let y = 0; y < H; y += step) {
      const u = (y + step / 2) / H, { R, Ri } = sampleProf(p, u); if (Ri <= 0) continue;
      const t = R - Ri; if (t > 0.42) continue;
      c.fillStyle = `rgba(230,60,40,${a * clamp((0.42 - t) / 0.2, 0, 1)})`;
      c.fillRect(cx - R * s, by - y - step - 0.5, R * s * 2, step + 1);
    }
  }
  // the rim, seen from a little above: the lip and the dark inside
  const top = sampleProf(p, 1), rt = top.R * s, it = top.Ri * s, ty = by - H;
  if (rt > 0.5) {
    const col = colAt(0.995);
    c.fillStyle = rgb(col, 1.08); c.beginPath(); c.ellipse(cx, ty, rt, rt * E, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = rgb(col, 0.6); c.lineWidth = Math.max(0.6, s * 0.04); c.stroke();
    if (it > 0.5 && !o.solid) {
      const g = c.createLinearGradient(0, ty - it * E, 0, ty + it * E);
      const inside = gl?.base ? (fired ? hexRgb(GLAZES[gl.base].hex) : rawRgb(gl.base)) : clay;
      g.addColorStop(0, rgb(inside, 0.75)); g.addColorStop(0.45, rgb(inside, 0.42)); g.addColorStop(1, rgb(inside, 0.22));
      c.fillStyle = g; c.beginPath(); c.ellipse(cx, ty, it, it * E, 0, 0, Math.PI * 2); c.fill();
      // the far inside wall catches the light
      c.fillStyle = rgb(inside, 0.95, 0.5); c.beginPath(); c.ellipse(cx, ty, it * 0.96, it * E * 0.96, 0, Math.PI * 1.08, Math.PI * 1.92); c.ellipse(cx, ty - it * E * 0.25, it * 0.9, it * E * 0.7, 0, Math.PI * 1.92, Math.PI * 1.08, true); c.fill();
    }
  }
  // the inside wall, faintly, so you can see how thick the walls are
  if (o.inner) {
    c.save(); c.setLineDash([Math.max(2, s * 0.18), Math.max(2, s * 0.18)]); c.lineWidth = Math.max(1, s * 0.05); c.strokeStyle = 'rgba(255,240,220,0.5)';
    for (const side of [-1, 1]) {
      c.beginPath(); let on = false;
      for (let k = 0; k <= 60; k++) { const u = k / 60, { Ri } = sampleProf(p, u); if (Ri <= 0.05) { on = false; continue; } const x = cx + side * Ri * s, y = by - u * H; if (!on) c.moveTo(x, y); else c.lineTo(x, y); on = true; }
      c.stroke();
    }
    if (p.floor < p.h - 0.2) { const { Ri } = sampleProf(p, p.floor / p.h + 0.01); if (Ri > 0.1) { c.beginPath(); c.moveTo(cx - Ri * s, by - p.floor * s); c.lineTo(cx + Ri * s, by - p.floor * s); c.stroke(); } }
    c.restore();
  }
  // hot from the kiln: an orange glow over everything
  if ((o.glow ?? 0) > 0) {
    c.save(); c.globalCompositeOperation = 'lighter';
    c.fillStyle = `rgba(255,120,30,${o.glow})`;
    for (let y = 0; y < H; y += step) { const u = (y + step / 2) / H, { R } = sampleProf(p, u); c.fillRect(cx - R * s, by - y - step, R * s * 2, step + 0.6); }
    c.restore();
  }
  if (o.cracked) {
    c.strokeStyle = 'rgba(50,24,10,0.75)'; c.lineWidth = Math.max(1, s * 0.05);
    for (const [u0, xo] of [[1, -0.2], [0.98, 0.35]] as const) {
      const { R } = sampleProf(p, u0); let x = cx + xo * R * s, y = by - u0 * H + R * s * E * 0.9;
      c.beginPath(); c.moveTo(x, y);
      for (let k = 0; k < 4; k++) { x += (k % 2 ? 1 : -1) * s * 0.18; y += s * 0.35; c.lineTo(x, y); }
      c.stroke();
    }
  }
}

/** Draws a handle on the right of a pot. */
export function drawHandle(c: CanvasRenderingContext2D, p: Profile, h: HandleId, cx: number, by: number, s: number, col: number[], back = false) {
  const H = p.h * s, a = sampleProf(p, 0.78), b = sampleProf(p, 0.28);
  const ax = cx + a.R * s * 0.96, ay = by - 0.78 * H, bx = cx + b.R * s * 0.96, byy = by - 0.28 * H;
  const reach = (h === 'big' ? 2.6 : h === 'ear' ? 1.4 : 1.9) * s, w = (h === 'big' ? 0.62 : 0.5) * s;
  c.save(); c.lineCap = 'round';
  const path = () => {
    c.beginPath(); c.moveTo(ax - s * 0.1, ay);
    if (h === 'ear') c.bezierCurveTo(ax + reach * 1.3, ay - s * 0.4, bx + reach * 0.9, (ay + byy) / 2, bx - s * 0.1, byy - (byy - ay) * 0.3);
    else if (h === 'twig') { c.bezierCurveTo(ax + reach, ay - s * 0.6, ax + reach * 1.2, ay + (byy - ay) * 0.4, ax + reach * 0.6, ay + (byy - ay) * 0.55); c.bezierCurveTo(ax + reach * 0.2, ay + (byy - ay) * 0.7, bx + reach * 0.9, byy, bx - s * 0.1, byy); }
    else c.bezierCurveTo(ax + reach * 1.25, ay - s * 0.2, bx + reach * 1.25, byy + s * 0.2, bx - s * 0.1, byy);
  };
  c.strokeStyle = rgb(col, back ? 0.4 : 0.5); c.lineWidth = w + Math.max(2, s * 0.08); path(); c.stroke();
  c.strokeStyle = rgb(col, back ? 0.7 : 0.95); c.lineWidth = w; path(); c.stroke();
  c.strokeStyle = 'rgba(255,250,235,0.35)'; c.lineWidth = w * 0.25; c.translate(-w * 0.15, -w * 0.1); path(); c.stroke();
  c.restore();
}

/** Draws a whole piece: the body, its lid sitting on top, its spout, handle and lip. */
export function drawPiece(c: CanvasRenderingContext2D, pc: PieceArt, cx: number, by: number, s: number, o: { spin?: number; glow?: number; band?: { u0: number; u1: number; g: GlazeId } | null } = {}) {
  const body = pc.parts.find((q) => q.id === 'body'); if (!body) return;
  const p = body.prof, gl = pc.glaze, fired = pc.fired;
  const colOf = (u: number) => { const g = gl ? glazeAt(gl, u) : null; return g ? (fired ? hexRgb(GLAZES[g].hex) : rawRgb(g)) : fired ? CLAY_FIRED : CLAY_DRY; };
  const spout = pc.parts.find((q) => q.id === 'spout');
  if (spout) {
    // the spout leans out from the left of the body, low down
    const sp = spout.prof, at = sampleProf(p, 0.35), x0 = cx - at.R * s * 0.85, y0 = by - 0.35 * p.h * s;
    const ang = -Math.PI * 0.72, len = sp.h * s * 0.95, col = colOf(0.5);
    c.save(); c.translate(x0, y0); c.rotate(ang + Math.PI / 2);
    for (let k = 0; k <= 24; k++) {
      const u = k / 24, { R } = sampleProf(sp, u), y = -u * len;
      const g = c.createLinearGradient(-R * s, 0, R * s, 0); g.addColorStop(0, rgb(col, 0.55)); g.addColorStop(0.4, rgb(col, 1.05)); g.addColorStop(1, rgb(col, 0.5));
      c.fillStyle = g; c.fillRect(-R * s, y - len / 24 - 0.5, R * s * 2, len / 24 + 1);
    }
    const tip = sampleProf(sp, 1); c.fillStyle = rgb(col, 0.35); c.beginPath(); c.ellipse(0, -len, tip.R * s * 0.7, tip.R * s * 0.3, 0, 0, Math.PI * 2); c.fill();
    c.restore();
  }
  if (pc.handle) drawHandle(c, p, pc.handle, cx, by, s, colOf(0.55));
  drawPot(c, p, cx, by, s, { spin: o.spin, glaze: gl, fired, finish: pc.finish, cracked: pc.cracked, glow: o.glow, band: o.band });
  if (pc.lip) {
    // a pinched pouring lip on the left of the rim
    const top = sampleProf(p, 1), x = cx - top.R * s, y = by - p.h * s, col = colOf(0.99);
    c.fillStyle = rgb(col, 1); c.strokeStyle = rgb(col, 0.55); c.lineWidth = Math.max(1, s * 0.05);
    c.beginPath(); c.moveTo(x + s * 0.5, y - s * 0.1); c.quadraticCurveTo(x - s * 0.6, y - s * 0.5, x - s * 0.9, y - s * 0.75); c.quadraticCurveTo(x - s * 0.2, y + s * 0.2, x + s * 0.6, y + s * 0.35); c.closePath(); c.fill(); c.stroke();
  }
  const lid = pc.parts.find((q) => q.id === 'lid');
  if (lid) {
    // the lid sits on the rim: scaled so its flange just covers the opening
    const top = sampleProf(p, 1), fit = Math.max(0.4, (top.R * 1.02) / Math.max(0.5, sampleProf(lid.prof, 0).R));
    const lp: Profile = { h: lid.prof.h * Math.min(1, fit) * 0.8, r: lid.prof.r.map((r) => r * fit), ri: lid.prof.ri.map(() => 0), floor: 0 };
    drawPot(c, lp, cx, by - p.h * s + top.R * s * E * 0.2, s, { spin: o.spin, glaze: gl ? { ...gl, bands: [], drip: null, base: glazeAt(gl, 0.97) ?? gl.base } : null, fired, finish: pc.finish, solid: true, glow: o.glow });
  }
}

/** The order's outline as a little silhouette, for the order cards. */
export function paintOutline(cv: HTMLCanvasElement, shape: Shape, fill: 'wet' | 'dry' = 'dry') {
  const c = cv.getContext('2d'); if (!c) return;
  const W = cv.width, H = cv.height; c.clearRect(0, 0, W, H);
  const s = Math.min((H * 0.84) / (shape.h + shapeMaxR(shape) * E * 2), (W * 0.9) / (shapeMaxR(shape) * 2)), by = H * 0.92 - shapeR(shape, 0) * s * E, cx = W / 2;
  const n = 33, prof: Profile = { h: shape.h, r: [], ri: [], floor: 0.7 };
  for (let k = 0; k < n; k++) { const y = (k / (n - 1)) * shape.h * 0.9999, R = shapeR(shape, y); prof.r.push(R); prof.ri.push(shape.hollow && y > 0.7 ? Math.max(0, R - 0.45) : 0); }
  drawPot(c, prof, cx, by, s, { wet: fill === 'wet' ? 0.7 : 0.3, flat: true, solid: !shape.hollow });
}

// ---------------------------------------------------------------- the scene
export class PotteryScene {
  private c: CanvasRenderingContext2D;
  private art = new Map<string, HTMLImageElement>();
  W = 0; H = 0; private dpr = 1;
  inset = { top: 0, bottom: 0, left: 0, right: 0 };
  private time = 0; private spin = 0; private sparks: Spark[] = [];
  /** Pixels per clay unit, eased so the view doesn't jump; held still while a finger is down. */
  scale = 30; private scaleGoal = 30; hold = false;
  cx = 0; by = 0;
  private boxes: { dora: [number, number, number, number]; enzo: [number, number, number, number] } = { dora: [0, 0, 0, 0], enzo: [0, 0, 0, 0] };
  private moodT = 0; private slipT = 0; private lastMood: Mood = 'focus'; private shake = 0; private slumpFrom: Profile | null = null;
  constructor(private cv: HTMLCanvasElement) {
    const c = cv.getContext('2d'); if (!c) throw new Error('no canvas');
    this.c = c;
    for (const n of ['workshop', 'kiln', 'dora-focus', 'enzo-focus', 'dora-cheer', 'enzo-cheer', 'dora-oops', 'enzo-oops']) this.load(n);
    this.resize();
  }
  private load(name: string) { if (this.art.has(name)) return; const img = new Image(); img.decoding = 'async'; img.src = `/art/pottery/${name}.webp`; this.art.set(name, img); }
  private img(name: string) { this.load(name); const i = this.art.get(name)!; return i.complete && i.naturalWidth > 0 ? i : null; }
  /** Loads a neighbour's portrait ahead of time. */
  want(name: string) { this.load(name); }
  resize() {
    const r = this.cv.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1);
    this.dpr = d; this.W = Math.max(1, r.width); this.H = Math.max(1, r.height);
    const w = Math.round(this.W * d), h = Math.round(this.H * d);
    if (this.cv.width !== w || this.cv.height !== h) { this.cv.width = w; this.cv.height = h; }
  }
  /** Screen (css px in the canvas) to clay units: x from the wheel's middle, y up from the wheel head. */
  toPot(sx: number, sy: number): [number, number] { return [(sx - this.cx) / this.scale, (this.by - sy) / this.scale]; }
  toScreen(x: number, y: number): [number, number] { return [this.cx + x * this.scale, this.by - y * this.scale]; }
  get tall() { return this.H > this.W * 1.05; }
  /** For the browser tests: where things are on screen. */
  metrics() { return { scale: this.scale, cx: this.cx, by: this.by, W: this.W, H: this.H, dora: this.boxes.dora, enzo: this.boxes.enzo, inset: this.inset }; }
  feed(evs: WheelEv[], w: Wheel | null) {
    for (const e of evs) {
      if (e.k === 'water') for (let i = 0; i < 26; i++) { const a = -Math.PI / 2 + (i - 13) * 0.06; this.sparks.push({ x: this.cx + (i - 13) * 2, y: this.by - (w ? w.top : 4) * this.scale - 60 - (i % 5) * 8, vx: Math.cos(a) * 20, vy: 140 + (i % 4) * 30, life: 0, max: 0.8, r: 2.5 + (i % 3), col: 'rgba(150,200,240,0.85)', kind: 'drop' }); }
      if (e.k === 'flump') { this.shake = 0.5; this.slumpFrom = w?.slumped ?? null; for (let i = 0; i < 22; i++) { const a = Math.PI * (0.1 + (i / 22) * 0.8); this.sparks.push({ x: this.cx + Math.cos(a) * 30 * (i % 2 ? 1 : -1), y: this.by - 20, vx: Math.cos(a) * (i % 2 ? 1 : -1) * (90 + (i % 5) * 30), vy: -Math.sin(a) * (120 + (i % 4) * 40), life: 0, max: 1.1, r: 3 + (i % 4) * 1.5, col: 'rgba(140,80,48,0.95)', kind: 'chunk' }); } }
      if (e.k === 'centred' || e.k === 'opened') for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; this.sparks.push({ x: this.cx, y: this.by - (w ? w.top : 3) * this.scale * 0.6, vx: Math.cos(a) * 90, vy: Math.sin(a) * 90, life: 0, max: 0.7, r: 3, col: 'rgba(255,230,140,0.95)', kind: 'star' }); }
    }
  }
  /** A burst of stars and sparkles (a shining firing, a delivery). */
  celebrate(x?: number, y?: number) {
    const cx = x ?? this.cx, cy = y ?? this.H * 0.4;
    for (let i = 0; i < 40; i++) { const a = (i / 40) * Math.PI * 2; this.sparks.push({ x: cx, y: cy, vx: Math.cos(a) * (120 + (i % 5) * 40), vy: Math.sin(a) * (120 + (i % 5) * 40) - 60, life: 0, max: 1.4, r: 3 + (i % 3), col: ['#ffe07a', '#ffb0c0', '#a0e0ff', '#c8f0a0'][i % 4], kind: 'star' }); }
  }

  // ---- layout: Dora and Enzo either side, the wheel between them, the pot scaled to fit
  private layout(view: View, need: { h: number; r: number }) {
    const W = this.W, H = this.H, tall = this.tall, top = this.inset.top + 8, bottom = H - this.inset.bottom;
    const area = Math.max(80, bottom - top);
    const chH = tall ? Math.min(area * 0.42, W * 0.44) : Math.min(area * 0.5, W * 0.25);
    const dx = tall ? W * 0.2 : Math.max(chH * 0.5 + 8, W * 0.16), cw = chH;
    this.boxes = { dora: [dx - cw / 2, bottom - chH, cw, chH], enzo: [W - dx - cw / 2, bottom - chH, cw, chH] };
    this.cx = W / 2;
    // upright phones: the wheel sits up on its bench behind the pair, so the pot stands clear above their heads
    const pan = tall ? chH * 0.88 : Math.max(36, area * 0.12);
    this.by = bottom - pan;
    const availH = this.by - top - 16, half = tall ? W * 0.45 : Math.min(W * 0.5 - dx - cw * 0.45, W * 0.3);
    const goal = clamp(Math.min(availH / (need.h + need.r * E * 2 + 0.8), half / (need.r + 0.9)), 6, view === 'throw' ? 64 : 80);
    this.scaleGoal = goal;
  }
  private ease(dt: number, snap = false) {
    if (this.hold && !snap) return;
    if (snap || Math.abs(this.scale - this.scaleGoal) < 0.05) { this.scale = this.scaleGoal; return; }
    // shrink quickly (keep it in view), grow gently
    const k = this.scaleGoal < this.scale ? 4 : 1.6;
    this.scale += (this.scaleGoal - this.scale) * Math.min(1, dt * k);
  }
  /** Sets the view up straight away (no easing), e.g. when a new throw starts. */
  snap(need: { h: number; r: number }, view: View = 'throw') { this.resize(); this.layout(view, need); this.ease(0, true); }

  draw(o: DrawOpts) {
    const c = this.c, d = this.dpr, dt = o.paused ? 0 : o.dt;
    this.time += dt;
    const sp = SPEEDS[o.speed ?? 2] ?? 0.72;
    this.spin += dt * (o.view === 'throw' || o.view === 'glaze' ? 4 + sp * 9 : 0);
    c.setTransform(d, 0, 0, d, 0, 0);
    if (this.shake > 0) { this.shake = Math.max(0, this.shake - dt); const k = this.shake * 10; c.translate(Math.sin(this.time * 60) * k, Math.cos(this.time * 47) * k * 0.6); }
    if (o.view === 'fire') { this.drawKiln(o); this.particles(dt); return; }
    this.backdrop(o.view === 'deliver' ? 0.35 : 0.12);
    const w = o.wheel ?? null, body = o.piece?.parts.find((q) => q.id === 'body')?.prof ?? null;
    const t = o.target ?? null;
    const need = { h: Math.max(t?.h ?? 0, w ? w.top : body?.h ?? 4, 3), r: Math.max(t ? shapeMaxR(t) : 0, w ? w.maxR : body ? Math.max(...body.r) : 3, 3.5) };
    this.layout(o.view, need); this.ease(dt);
    const s = this.scale, cx = this.cx, by = this.by;
    // mood: a cheer or an oops lasts a moment, then back to watching
    const mood = o.mood ?? 'focus';
    if (mood !== this.lastMood) { this.lastMood = mood; this.moodT = 0; } else this.moodT += dt;
    if (o.view === 'deliver') { this.drawDeliver(o); this.particles(dt); return; }
    this.drawWheel(cx, by, s, sp, o.view === 'throw' ? (w?.spinning ?? true) : true);
    this.chinchilla('dora', mood); this.chinchilla('enzo', mood);
    // the pot
    if (w) {
      if (w.slump >= 0 && (this.slumpFrom || w.slumped)) {
        const from = this.slumpFrom ?? w.slumped!, k = clamp(w.slump / 0.7, 0, 1), sag = k * k;
        const p: Profile = { h: from.h * (1 - 0.72 * sag), r: from.r.map((r, i) => r * (1 + sag * 0.6 * (1 - i / from.r.length)) + Math.sin(i * 0.7 + this.time * 8) * 0.08 * sag), ri: from.ri.map((r) => r * (1 - sag)), floor: 0 };
        drawPot(c, p, cx, by, s, { spin: this.spin, wet: 1 });
      } else {
        this.slumpFrom = null;
        const p = w.profile(64), wob = w.strain > 0.6 ? Math.sin(this.time * 19) * (w.strain - 0.6) * s * 0.35 : 0;
        const off = (1 - w.centred) * s * 0.55 * Math.sin(this.spin);
        drawPot(c, p, cx + wob + off, by, s, { spin: this.spin, wet: w.wet, strain: w.strain, inner: w.opened });
      }
      if (t && o.ghost) this.ghost(t, cx, by, s);
      this.finger(w, o.hover ?? null, s, dt);
    } else if (o.piece) {
      drawPiece(c, o.piece, cx, by, s, { spin: o.view === 'glaze' ? this.spin : 0, band: o.band });
    }
    this.particles(dt);
  }
  private backdrop(dim: number) {
    const c = this.c, W = this.W, H = this.H, img = this.img('workshop');
    if (img) {
      const k = Math.max(W / img.naturalWidth, H / img.naturalHeight), w = img.naturalWidth * k, h = img.naturalHeight * k;
      c.drawImage(img, (W - w) / 2, (H - h) * 0.4, w, h);
    } else paintWorkshop(c, W, H);
    // a soft pool of light where the wheel stands
    const g = c.createRadialGradient(W / 2, this.by - H * 0.15, 10, W / 2, this.by - H * 0.15, Math.max(W, H) * 0.6);
    g.addColorStop(0, 'rgba(255,240,210,0.1)'); g.addColorStop(1, `rgba(40,22,10,${dim + 0.18})`);
    c.fillStyle = g; c.fillRect(0, 0, W, H);
  }
  private drawWheel(cx: number, by: number, s: number, sp: number, spinning: boolean) {
    const c = this.c, tall = this.tall;
    const panR = Math.min(tall ? this.W * 0.46 : this.W * 0.26, Math.max(7.5 * s, 120)), headR = Math.min(panR * 0.72, Math.max(5.6 * s, 70));
    // the splash pan: a wide wooden tub round the wheel
    const panY = by + headR * E * 0.6;
    c.fillStyle = '#5a3a22'; c.beginPath(); c.ellipse(cx, panY + panR * 0.16, panR, panR * E, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#7a5232'; c.fillRect(cx - panR, panY, panR * 2, panR * 0.16);
    c.beginPath(); c.ellipse(cx, panY + panR * 0.16, panR, panR * E, 0, 0, Math.PI); c.fill();
    const rim = c.createLinearGradient(cx - panR, 0, cx + panR, 0); rim.addColorStop(0, '#6a4428'); rim.addColorStop(0.4, '#a8784a'); rim.addColorStop(1, '#5a3a20');
    c.fillStyle = rim; c.beginPath(); c.ellipse(cx, panY, panR, panR * E, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#4a2c18'; c.beginPath(); c.ellipse(cx, panY + 2, panR * 0.92, panR * E * 0.88, 0, 0, Math.PI * 2); c.fill();
    // slip in the bottom of the pan
    c.fillStyle = 'rgba(150,90,56,0.6)'; c.beginPath(); c.ellipse(cx, panY + 4, panR * 0.8, panR * E * 0.7, 0, 0, Math.PI * 2); c.fill();
    // the wheel head
    const hg = c.createLinearGradient(cx - headR, 0, cx + headR, 0); hg.addColorStop(0, '#6a6460'); hg.addColorStop(0.45, '#b8b0a8'); hg.addColorStop(1, '#5a5450');
    c.fillStyle = '#4a4440'; c.beginPath(); c.ellipse(cx, by + headR * 0.05, headR, headR * E, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = hg; c.beginPath(); c.ellipse(cx, by, headR, headR * E, 0, 0, Math.PI * 2); c.fill();
    // marks on the head turn with it
    c.strokeStyle = 'rgba(60,50,44,0.5)'; c.lineWidth = 1.5;
    for (let k = 0; k < 6; k++) { const a = this.spin * (spinning ? 1 : 0) + (k * Math.PI) / 3; c.beginPath(); c.moveTo(cx + Math.cos(a) * headR * 0.35, by + Math.sin(a) * headR * E * 0.35); c.lineTo(cx + Math.cos(a) * headR * 0.92, by + Math.sin(a) * headR * E * 0.92); c.stroke(); }
    c.strokeStyle = 'rgba(255,255,255,0.25)'; c.beginPath(); c.ellipse(cx, by, headR * 0.6, headR * E * 0.6, 0, 0, Math.PI * 2); c.stroke();
    void sp;
  }
  private chinchilla(who: 'dora' | 'enzo', mood: Mood) {
    const c = this.c, [x, y, w, h] = this.boxes[who];
    const img = this.img(`${who}-${mood}`) ?? this.img(`${who}-focus`);
    const hop = mood === 'cheer' ? Math.abs(Math.sin(this.moodT * 7)) * h * 0.03 * Math.max(0, 1 - this.moodT / 2) : 0;
    const breathe = 1 + Math.sin(this.time * 2.2 + (who === 'dora' ? 0 : 1.3)) * 0.008;
    if (img) {
      c.save(); c.translate(x + w / 2, y + h); c.scale(breathe, breathe);
      c.drawImage(img, -w / 2, -h - hop, w, h);
      c.restore();
    } else {
      drawChinchilla(c, who, x + w / 2, y + h * 0.98 - hop, { face: who === 'dora' ? 1 : -1, h: h * (who === 'dora' ? 0.62 : 0.72), time: this.time });
    }
  }
  private ghost(t: Shape, cx: number, by: number, s: number) {
    const c = this.c;
    c.save(); c.lineWidth = Math.max(1.5, s * 0.06); c.setLineDash([Math.max(4, s * 0.3), Math.max(3, s * 0.22)]);
    for (const [col, wid] of [['rgba(40,20,8,0.45)', 2.4], ['rgba(255,248,228,0.9)', 1]] as const) {
      c.strokeStyle = col; c.lineWidth = Math.max(1.4, s * 0.05) * wid;
      for (const side of [-1, 1]) { c.beginPath(); for (let k = 0; k <= 50; k++) { const y = (k / 50) * t.h * 0.9999, x = cx + side * shapeR(t, y) * s, yy = by - y * s; if (k === 0) c.moveTo(x, yy); else c.lineTo(x, yy); } c.stroke(); }
      const rt = shapeR(t, t.h) * s; c.beginPath(); c.ellipse(cx, by - t.h * s, rt, rt * E, 0, 0, Math.PI * 2); c.stroke();
    }
    c.restore();
  }
  /** The fingertip on the clay (or where the mouse would press), with slip flung off it. */
  private finger(w: Wheel, hover: { x: number; y: number; mode: Mode | null } | null, s: number, dt: number) {
    const c = this.c, f = w.finger;
    const at = f ? { x: f.x, y: f.y, mode: f.mode } : hover;
    if (!at || !at.mode || w.slump >= 0) return;
    const [x, y] = this.toScreen(at.x, at.y), r = Math.max(9, s * 0.42);
    const pressing = !!f;
    c.save();
    c.fillStyle = pressing ? 'rgba(255,236,214,0.55)' : 'rgba(255,255,255,0.25)';
    c.strokeStyle = at.mode === 'centre' ? '#ffd66a' : at.mode === 'inside' ? '#8fd0ff' : '#ffb07a';
    c.lineWidth = pressing ? 3 : 2;
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); c.stroke();
    // a little arrow: which way the clay will go
    c.fillStyle = c.strokeStyle; c.translate(x, y);
    const side = at.x < 0 ? -1 : 1;
    if (at.mode === 'outside') { c.scale(-side, 1); }
    else if (at.mode === 'inside') { c.scale(side, 1); }
    if (at.mode !== 'centre') { c.beginPath(); c.moveTo(r * 0.25, -r * 0.35); c.lineTo(r * 0.85, 0); c.lineTo(r * 0.25, r * 0.35); c.closePath(); c.fill(); }
    else { c.lineWidth = 2.5; c.beginPath(); c.arc(0, 0, r * 0.55, 0.3, Math.PI * 1.6); c.stroke(); }
    c.restore();
    if (pressing && w.spinning && dt > 0 && this.sparks.length < 160) {
      // slip flicks off sideways at the fingertip
      this.slipT += dt;
      for (; this.slipT > 0.035; this.slipT -= 0.035) { const dir = at.x < 0 ? -1 : 1; this.sparks.push({ x, y, vx: dir * (60 + ((this.time * 977) % 80)), vy: -40 - ((this.time * 613) % 60), life: 0, max: 0.6, r: 1.5 + ((this.time * 31) % 2), col: `rgba(${w.wet > 0.5 ? '120,70,44' : '160,104,70'},0.8)`, kind: 'slip' }); }
    }
  }
  private particles(dt: number) {
    const c = this.c;
    this.sparks = this.sparks.filter((p) => (p.life += dt) < p.max);
    for (const p of this.sparks) {
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.kind === 'star' ? 120 : p.kind === 'spark' ? -60 : 520) * dt;
      const a = 1 - p.life / p.max;
      c.globalAlpha = Math.max(0, a);
      c.fillStyle = p.col;
      if (p.kind === 'star') { c.save(); c.translate(p.x, p.y); c.rotate(p.life * 4); c.beginPath(); for (let k = 0; k < 10; k++) { const rr = k % 2 ? p.r * 0.45 : p.r * 1.4, an = (k / 10) * Math.PI * 2; c.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); } c.closePath(); c.fill(); c.restore(); }
      else { c.beginPath(); c.ellipse(p.x, p.y, p.r, p.kind === 'drop' ? p.r * 1.4 : p.r, 0, 0, Math.PI * 2); c.fill(); }
    }
    c.globalAlpha = 1;
  }

  // ---- the kiln
  private drawKiln(o: DrawOpts) {
    const c = this.c, W = this.W, H = this.H, f = o.firing, img = this.img('kiln');
    const T = f ? f.T : 0.1;
    if (img) {
      const k = Math.max(W / img.naturalWidth, H / img.naturalHeight), w = img.naturalWidth * k, h = img.naturalHeight * k;
      c.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
    } else paintKiln(c, W, H);
    // the heat: the whole room glows with it
    const g = c.createRadialGradient(W / 2, H * 0.5, 10, W / 2, H * 0.5, Math.max(W, H) * 0.7);
    g.addColorStop(0, `rgba(255,${Math.round(200 - T * 120)},60,${0.15 + T * 0.35})`); g.addColorStop(1, `rgba(30,10,0,${0.45 - T * 0.15})`);
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    // the pots inside the door
    const pieces = o.kiln ?? [];
    const top = this.inset.top + 8, bottom = H - this.inset.bottom, area = bottom - top;
    const dial = Math.min(area * 0.42, W * (this.tall ? 0.42 : 0.24));
    const potH = Math.max(...pieces.map((p) => p.parts[0].prof.h), 3), potR = Math.max(...pieces.map((p) => Math.max(...p.parts[0].prof.r)), 2);
    const space = this.tall ? area - dial - 30 : area * 0.62;
    const s = clamp(Math.min(space / (potH + 2), (W * (this.tall ? 0.4 : 0.22)) / (potR * pieces.length + 1)), 6, 46);
    const baseY = this.tall ? top + space * 0.95 : top + area * 0.72;
    pieces.forEach((p, i) => {
      const x = W / 2 + (i - (pieces.length - 1) / 2) * (potR * 2.4 * s);
      c.fillStyle = 'rgba(40,14,0,0.35)'; c.beginPath(); c.ellipse(x, baseY + 4, potR * s * 1.2, potR * s * 0.25, 0, 0, Math.PI * 2); c.fill();
      drawPiece(c, { ...p, fired: false }, x, baseY, s, { glow: 0.12 + T * 0.45 });
    });
    // flames licking at the bottom
    for (let i = 0; i < 9; i++) {
      const x = W / 2 + (i - 4) * Math.min(W, 600) * 0.06, hh = (20 + 30 * T) * (0.7 + 0.3 * Math.sin(this.time * 9 + i * 1.7));
      const fg = c.createLinearGradient(0, baseY + 40, 0, baseY + 40 - hh); fg.addColorStop(0, 'rgba(255,140,30,0.8)'); fg.addColorStop(1, 'rgba(255,230,120,0)');
      c.fillStyle = fg; c.beginPath(); c.moveTo(x - 12, baseY + 40); c.quadraticCurveTo(x, baseY + 40 - hh * 1.4, x + 12, baseY + 40); c.fill();
    }
    if (f && f.heat && Math.floor(this.time * 30) % 2 === 0) this.sparks.push({ x: W / 2 + Math.sin(this.time * 13) * 60, y: baseY + 30, vx: Math.sin(this.time * 7) * 30, vy: -80, life: 0, max: 0.9, r: 2, col: 'rgba(255,200,80,0.9)', kind: 'spark' });
    // the dial
    const dx = this.tall ? W / 2 : W - dial * 0.62 - 14, dy = this.tall ? bottom - dial * 0.2 - 10 : top + dial * 0.7 + 8;
    this.dial(dx, dy, dial * 0.55, f);
    // Dora and Enzo keep watch either side, in the glow
    const chH = this.tall ? Math.min(area * 0.24, W * 0.3) : Math.min(area * 0.42, W * 0.2), mood = o.mood ?? 'focus';
    const lx = this.tall ? W * 0.15 : chH * 0.55 + 10, rx = W - lx;
    this.pal('dora', mood, lx, bottom, chH, 1); this.pal('enzo', mood, rx, bottom, chH, -1);
    this.boxes = { dora: [lx - chH / 2, bottom - chH, chH, chH], enzo: [rx - chH / 2, bottom - chH, chH, chH] };
  }
  /** One of the pair, painted in a mood (or drawn when the painting is missing). */
  private pal(who: 'dora' | 'enzo', mood: Mood, x: number, bottom: number, h: number, face: 1 | -1) {
    const img = this.img(`${who}-${mood}`) ?? this.img(`${who}-focus`);
    if (img) this.c.drawImage(img, x - h / 2, bottom - h, h, h);
    else drawChinchilla(this.c, who, x, bottom, { face, h: h * (who === 'dora' ? 0.6 : 0.7), time: this.time });
  }
  private dial(x: number, y: number, r: number, f: Firing | null | undefined) {
    const c = this.c, a0 = Math.PI * 0.95, a1 = Math.PI * 2.05, ang = (t: number) => a0 + (a1 - a0) * t;
    c.save();
    c.fillStyle = 'rgba(40,24,14,0.86)'; c.strokeStyle = '#e8c890'; c.lineWidth = 4;
    c.beginPath(); c.arc(x, y, r * 1.12, Math.PI * 0.88, Math.PI * 2.12); c.closePath(); c.fill(); c.stroke();
    // cold to hot
    for (let k = 0; k < 40; k++) { const t = k / 40; c.strokeStyle = `hsl(${220 - t * 220},70%,${50 + t * 6}%)`; c.lineWidth = r * 0.16; c.beginPath(); c.arc(x, y, r * 0.86, ang(t), ang(t + 1 / 40) + 0.01); c.stroke(); }
    if (f) {
      // the sweet band
      c.strokeStyle = 'rgba(255,240,150,0.95)'; c.lineWidth = r * 0.3; c.beginPath(); c.arc(x, y, r * 0.86, ang(f.lo), ang(f.hi)); c.stroke();
      c.strokeStyle = 'rgba(90,170,60,0.9)'; c.lineWidth = r * 0.18; c.beginPath(); c.arc(x, y, r * 0.86, ang(f.lo), ang(f.hi)); c.stroke();
      // the needle
      const a = ang(f.T), inside = f.T >= f.lo && f.T <= f.hi;
      c.strokeStyle = inside ? '#fff6c8' : f.T > f.hi ? '#ff7a5a' : '#a8d8ff'; c.lineWidth = Math.max(3, r * 0.06); c.lineCap = 'round';
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * r * 0.95, y + Math.sin(a) * r * 0.95); c.stroke();
      c.fillStyle = '#e8c890'; c.beginPath(); c.arc(x, y, r * 0.1, 0, Math.PI * 2); c.fill();
      // time left: a ring round the hub
      const left = 1 - f.t / 13;
      c.strokeStyle = 'rgba(255,230,180,0.85)'; c.lineWidth = r * 0.05; c.beginPath(); c.arc(x, y, r * 0.24, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, left)); c.stroke();
    }
    c.restore();
  }

  // ---- the counter: the neighbour collects their pot
  private drawDeliver(o: DrawOpts) {
    const c = this.c, W = this.W, H = this.H, tall = this.tall;
    const top = this.inset.top + 6, bottom = H - this.inset.bottom, area = bottom - top;
    // the counter
    const cy = tall ? top + area * 0.62 : top + area * 0.78;
    c.fillStyle = '#8a5a34'; c.fillRect(0, cy, W, H - cy);
    c.fillStyle = '#a8744a'; c.fillRect(0, cy - 10, W, 14);
    c.fillStyle = 'rgba(255,240,210,0.25)'; c.fillRect(0, cy - 10, W, 3);
    // the neighbour
    const who = o.customer, img = who ? this.img(`cust-${who}`) : null;
    const ph = tall ? Math.min(area * 0.42, W * 0.7) : Math.min(area * 0.78, W * 0.36), px = tall ? W * 0.5 : W * 0.3;
    if (who) {
      const bob = Math.sin(this.time * 3) * ph * 0.008;
      if (img) c.drawImage(img, px - ph / 2, cy - ph + 6 + bob, ph, ph);
      else drawNeighbour(c, who, px, cy + 6 + bob, ph);
    }
    // the pot on the counter
    if (o.piece) {
      const body = o.piece.parts[0].prof, s = clamp(Math.min((tall ? area * 0.3 : area * 0.5) / (body.h + 2), (tall ? W * 0.28 : W * 0.16) / (Math.max(...body.r) + 1)), 5, 40);
      const x = tall ? W * 0.5 : W * 0.58, y = tall ? bottom - 16 - Math.max(...body.r) * s * E : cy + 4;
      c.fillStyle = 'rgba(40,20,8,0.3)'; c.beginPath(); c.ellipse(x, y + 3, Math.max(...body.r) * s * 1.15, Math.max(...body.r) * s * 0.22, 0, 0, Math.PI * 2); c.fill();
      drawPiece(c, o.piece, x, y, s);
    }
    // Dora and Enzo hand it over, cheering, at the side
    const chH = tall ? Math.min(area * 0.26, W * 0.34) : Math.min(area * 0.46, W * 0.17);
    const dx = tall ? W * 0.16 : W * 0.77, ex = tall ? W - dx : W * 0.91;
    this.pal('enzo', 'cheer', ex, bottom, chH, -1); this.pal('dora', 'cheer', dx, bottom, chH * (tall ? 1 : 0.94), tall ? 1 : -1);
    this.boxes = { dora: [dx - chH / 2, bottom - chH, chH, chH], enzo: [ex - chH / 2, bottom - chH, chH, chH] };
  }
}

// ---------------------------------------------------------------- drawn stand-ins for the paintings
function paintWorkshop(c: CanvasRenderingContext2D, W: number, H: number) {
  const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#f2e2c4'); g.addColorStop(0.75, '#e6cfa6'); g.addColorStop(0.76, '#9a6a40'); g.addColorStop(1, '#7a5030');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  // the round window over the hills
  const r = Math.min(W, H) * 0.16, wx = W / 2, wy = H * 0.2;
  c.fillStyle = '#8a5a34'; c.beginPath(); c.arc(wx, wy, r + 10, 0, Math.PI * 2); c.fill();
  const sky = c.createLinearGradient(0, wy - r, 0, wy + r); sky.addColorStop(0, '#8ccaf0'); sky.addColorStop(1, '#d8f0ff');
  c.fillStyle = sky; c.beginPath(); c.arc(wx, wy, r, 0, Math.PI * 2); c.fill();
  c.save(); c.beginPath(); c.arc(wx, wy, r, 0, Math.PI * 2); c.clip();
  c.fillStyle = '#7ab85a'; c.beginPath(); c.ellipse(wx - r * 0.4, wy + r * 0.9, r * 1.1, r * 0.6, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#5a9a46'; c.beginPath(); c.ellipse(wx + r * 0.6, wy + r, r, r * 0.55, 0, 0, Math.PI * 2); c.fill();
  c.restore();
  c.strokeStyle = '#8a5a34'; c.lineWidth = 6; c.beginPath(); c.moveTo(wx - r, wy); c.lineTo(wx + r, wy); c.moveTo(wx, wy - r); c.lineTo(wx, wy + r); c.stroke();
  // shelves of pots at the sides
  for (const side of [0, 1]) for (let k = 0; k < 3; k++) {
    const sx = side ? W - W * 0.17 : W * 0.02, sy = H * (0.25 + k * 0.17), sw = W * 0.15;
    c.fillStyle = '#8a5a34'; c.fillRect(sx, sy, sw, 8);
    for (let j = 0; j < 3; j++) { const px = sx + sw * (0.18 + j * 0.32), ph = 18 + ((k + j) % 3) * 9; c.fillStyle = ['#c86a3a', '#6fa0c8', '#e0a040', '#8aa060'][(k + j + side) % 4]; c.beginPath(); c.ellipse(px, sy - ph / 2, 9 + ((j + k) % 2) * 4, ph / 2, 0, 0, Math.PI * 2); c.fill(); }
  }
}
function paintKiln(c: CanvasRenderingContext2D, W: number, H: number) {
  c.fillStyle = '#3a2418'; c.fillRect(0, 0, W, H);
  const kw = Math.min(W * 0.7, H * 0.95), kx = W / 2 - kw / 2, ky = H * 0.12, kh = H * 0.8;
  c.fillStyle = '#8a4a30'; c.beginPath(); c.moveTo(kx, ky + kh); c.lineTo(kx, ky + kw * 0.4); c.quadraticCurveTo(W / 2, ky - kw * 0.2, kx + kw, ky + kw * 0.4); c.lineTo(kx + kw, ky + kh); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(60,24,12,0.5)'; c.lineWidth = 2;
  for (let y = ky + 20; y < ky + kh; y += 22) { c.beginPath(); c.moveTo(kx, y); c.lineTo(kx + kw, y); c.stroke(); }
  const dw = kw * 0.56, dh = kh * 0.6, dx = W / 2 - dw / 2, dy = ky + kh * 0.3;
  const g = c.createRadialGradient(W / 2, dy + dh * 0.6, 10, W / 2, dy + dh * 0.6, dw); g.addColorStop(0, '#fff0a0'); g.addColorStop(0.5, '#ff9a30'); g.addColorStop(1, '#a03a10');
  c.fillStyle = g; c.beginPath(); c.moveTo(dx, dy + dh); c.lineTo(dx, dy + dw * 0.4); c.arc(W / 2, dy + dw * 0.4, dw / 2, Math.PI, 0); c.lineTo(dx + dw, dy + dh); c.closePath(); c.fill();
}
/** A simple round face for a neighbour whose portrait hasn't loaded. */
function drawNeighbour(c: CanvasRenderingContext2D, who: CustomerId, x: number, base: number, h: number) {
  const k = CUSTOMERS[who], r = h * 0.3;
  c.fillStyle = k.fur; c.beginPath(); c.ellipse(x, base - r * 0.9, r * 1.3, r * 1.1, 0, Math.PI, 0); c.fill();
  c.beginPath(); c.arc(x, base - r * 2, r, 0, Math.PI * 2); c.fill();
  c.fillStyle = k.trim; c.beginPath(); c.ellipse(x, base - r * 1.75, r * 0.55, r * 0.4, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#2a1a10'; for (const sx of [-1, 1]) { c.beginPath(); c.arc(x + sx * r * 0.38, base - r * 2.15, r * 0.1, 0, Math.PI * 2); c.fill(); }
  c.strokeStyle = '#2a1a10'; c.lineWidth = 2; c.beginPath(); c.arc(x, base - r * 1.85, r * 0.25, 0.2, Math.PI - 0.2); c.stroke();
}
/** The title stand-in: the workshop with Dora and Enzo at the wheel. */
export function paintTitle(cv: HTMLCanvasElement, t = 0.4) {
  const c = cv.getContext('2d'); if (!c) return; const W = cv.width, H = cv.height;
  paintWorkshop(c, W, H);
  const prof: Profile = { h: 6, r: [], ri: [], floor: 0.7 };
  for (let k = 0; k < 33; k++) { const u = k / 32; const R = 2.6 + Math.sin(u * Math.PI * 1.1) * 1.6; prof.r.push(R); prof.ri.push(u * 6 > 0.7 ? R - 0.4 : 0); }
  drawPot(c, prof, W / 2, H * 0.72, H * 0.05, { wet: 0.6 });
  drawChinchilla(c, 'dora', W * 0.32, H * 0.86, { face: 1, h: H * 0.2, time: t });
  drawChinchilla(c, 'enzo', W * 0.68, H * 0.86, { face: -1, h: H * 0.24, time: t });
}
/** The ending stand-in: the picnic on the hill. */
export function paintEnding(cv: HTMLCanvasElement, t = 0.4) {
  const c = cv.getContext('2d'); if (!c) return; const W = cv.width, H = cv.height;
  const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#8ccaf0'); g.addColorStop(0.5, '#d8f0ff'); g.addColorStop(0.51, '#8ac060'); g.addColorStop(1, '#5a9a40');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.fillStyle = '#e8e0d8'; c.beginPath(); c.ellipse(W / 2, H * 0.78, W * 0.36, H * 0.12, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#d04a3a'; for (let i = 0; i < 8; i++) for (let j = 0; j < 3; j++) if ((i + j) % 2) c.fillRect(W * 0.2 + i * W * 0.075, H * 0.7 + j * H * 0.05, W * 0.075, H * 0.05);
  const pot: Profile = { h: 5, r: [], ri: [], floor: 0.7 };
  for (let k = 0; k < 33; k++) { const u = k / 32, R = 2.4 + Math.sin(u * Math.PI) * 1.6; pot.r.push(R); pot.ri.push(R - 0.4); }
  drawPiece(c, { parts: [{ id: 'body', prof: pot }], handle: 'loop', glaze: { base: 'cream', bands: [{ u0: 0.88, u1: 1, g: 'sky' }], speckle: false, drip: null }, fired: true, finish: 'shine' }, W / 2, H * 0.74, H * 0.03);
  drawChinchilla(c, 'dora', W * 0.36, H * 0.82, { face: 1, h: H * 0.16, time: t });
  drawChinchilla(c, 'enzo', W * 0.64, H * 0.82, { face: -1, h: H * 0.19, time: t });
}
