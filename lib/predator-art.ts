// The arcade's predators in Canvas 2D, side-on, shared by the 2D games so a fox looks the same everywhere.
// Each is drawn in a 24-unit frame with the feet at (0, 0) facing right; callers scale it to their own pixels and
// may pass their own tint to make a relative (a viper from the snake, a condor from the hawk).
// They are painted, not flat: every coat runs from a lit back to a shaded belly, far-side limbs sit in shadow, and
// the outline is a dark shade of the animal's own colour, so a tint changes the whole animal and not just its fill.
export type PredKind = 'fox' | 'snake' | 'owl' | 'weasel' | 'badger' | 'hawk' | 'cougar' | 'mole' | 'skunk' | 'bear';
type C2D = CanvasRenderingContext2D;
type Paint = string | CanvasGradient;
const INK = '#2c2430', PUPIL = '#16121a';
const ell = (c: C2D, x: number, y: number, rx: number, ry: number, rot = 0) => { c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2); };
const poly = (c: C2D, pts: number[]) => { c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.closePath(); };
/** A closed, rounded outline pulled towards a ring of guide points; a point given twice makes a corner. */
const blob = (c: C2D, pts: number[]) => {
  const n = pts.length; c.beginPath(); c.moveTo((pts[n - 2] + pts[0]) / 2, (pts[n - 1] + pts[1]) / 2);
  for (let i = 0; i < n; i += 2) { const j = (i + 2) % n; c.quadraticCurveTo(pts[i], pts[i + 1], (pts[i] + pts[j]) / 2, (pts[i + 1] + pts[j + 1]) / 2); }
  c.closePath();
};
const ink = (c: C2D, fill: Paint, line = INK, w = 1.1) => { c.lineJoin = 'round'; c.strokeStyle = line; c.lineWidth = w; c.stroke(); c.fillStyle = fill; c.fill(); };
/** Paints inside the path that was just drawn, so markings never spill over an animal's outline. */
const within = (c: C2D, paint: () => void) => { c.save(); c.clip(); paint(); c.restore(); };
const stroke = (c: C2D, colour: Paint, w: number, path: () => void) => { c.strokeStyle = colour; c.lineWidth = w; c.lineCap = 'round'; c.beginPath(); path(); c.stroke(); c.lineCap = 'butt'; };

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
// Colours arrive as #rrggbb from the tables and as rgb() once they have been through shade or mix.
const rgb = (s: string): number[] => { if (s[0] === '#') { const n = parseInt(s.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; } return (s.match(/[\d.]+/g) ?? ['0', '0', '0']).slice(0, 3).map(Number); };
const mixed = new Map<string, string>();
/** `a` moved `k` of the way towards `b`. */
const mix = (a: string, b: string, k: number) => {
  const key = `${a}|${b}|${k}`; let v = mixed.get(key);
  if (!v) { const p = rgb(a), q = rgb(b); v = `rgb(${p.map((n, i) => Math.round(n + (q[i] - n) * k)).join(',')})`; if (mixed.size < 4000) mixed.set(key, v); }
  return v;
};
const lum = (s: string) => { const [r, g, b] = rgb(s); return r * 0.3 + g * 0.59 + b * 0.11; };
const GLOW = '#fff6dc', GLOOM = '#241438';
export const shade = (col: string, k: number) => `rgb(${rgb(col).map((v) => Math.max(0, Math.min(255, Math.round(v * k)))).join(',')})`;
export const tintOf = (kind: PredKind, alpha: boolean): Tint => (alpha ? { ...TINT[kind], body: shade(TINT[kind].body, 0.72), dark: shade(TINT[kind].dark, 0.7), ...ALPHA } : TINT[kind]);

/** The brushes every animal is painted with, made from its tint. */
function brushes(c: C2D, p: Tint) {
  const line = mix(p.body, INK, 0.76), far = mix(p.body, GLOOM, 0.42), darkEye = lum(p.eye) < 70;
  /** A coat lit from above between two heights. */
  const fur = (y0: number, y1: number, base = p.body): CanvasGradient => { const g = c.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, mix(base, GLOW, 0.34)); g.addColorStop(0.5, base); g.addColorStop(1, mix(base, GLOOM, 0.36)); return g; };
  /** An eye with a catch-light, and a lowered brow for the ones that mean it. */
  const eye = (x: number, y: number, r: number, brow = true) => {
    if (darkEye) { c.fillStyle = PUPIL; ell(c, x, y, r, r * 1.08); c.fill(); }
    else { ell(c, x, y, r * 1.14, r); ink(c, p.eye, PUPIL, 0.5); c.fillStyle = PUPIL; ell(c, x + r * 0.2, y, r * 0.42, r * 0.84); c.fill(); }
    c.fillStyle = 'rgba(255,255,255,0.95)'; ell(c, x - r * 0.3, y - r * 0.38, r * 0.3, r * 0.3); c.fill();
    if (brow) stroke(c, line, 0.8, () => { c.moveTo(x - r * 1.5, y - r * 1.8); c.lineTo(x + r * 1.6, y - r * 0.9); });
  };
  /** A leg standing on the ground at `x`, with a paw, an optional darker sock and optional claws. */
  const leg = (x: number, top: number, w: number, fill: Paint, sock?: string, claw?: string) => {
    const side = () => { c.beginPath(); c.moveTo(x - w * 0.78, top); c.quadraticCurveTo(x - w * 0.3, top * 0.55, x - w * 0.42, -1); c.lineTo(x + w * 0.46, -1); c.quadraticCurveTo(x + w * 0.36, top * 0.5, x + w * 0.8, top); };
    side(); c.fillStyle = fill; c.fill();
    if (sock) within(c, () => { const g = c.createLinearGradient(0, top * 0.72, 0, top * 0.5); g.addColorStop(0, mix(sock, p.body, 1)); g.addColorStop(1, sock); c.fillStyle = sock; c.fillRect(x - w, top * 0.5, w * 2, -top); c.fillStyle = g; c.globalAlpha = 0.5; c.fillRect(x - w, top * 0.72, w * 2, -top * 0.22); c.globalAlpha = 1; });
    side(); c.strokeStyle = line; c.lineWidth = 0.8; c.lineJoin = 'round'; c.stroke();
    ell(c, x + w * 0.2, -0.95, w * 0.72, 1.05); ink(c, sock ?? fill, line, 0.8);
    if (claw) stroke(c, claw, 0.5, () => { for (const k of [0.26, 0.56, 0.86]) { c.moveTo(x + w * k, -0.7); c.lineTo(x + w * k + 0.5, 0.25); } });
    else stroke(c, line, 0.35, () => { for (const k of [0.3, 0.64]) { c.moveTo(x + w * k, -1.25); c.lineTo(x + w * k + 0.1, -0.35); } });
  };
  const whiskers = (x: number, y: number, len: number) => stroke(c, mix(p.light, INK, 0.25), 0.3, () => { for (const a of [-0.22, 0.02, 0.26]) { c.moveTo(x, y); c.lineTo(x + len, y + a * len); } });
  return { line, far, fur, eye, leg, whiskers };
}

/** A predator in a 24-unit frame, feet at (0, 0), facing right. */
export function predator(c: C2D, kind: PredKind, p: Tint, t: number) {
  const { line, far, fur, eye, leg, whiskers } = brushes(c, p), nose = '#1a1418';
  if (kind === 'fox') {
    const wag = Math.sin(t * 4) * 0.12;
    c.save(); c.translate(-8.5, -10.5); c.rotate(wag);
    blob(c, [1.5, -1.5, -4, -9.5, -11, -11.5, -13, -5.5, -8.5, 1, -2, 2.6]); ink(c, fur(-11, 2), line);
    within(c, () => { c.fillStyle = p.light; blob(c, [-8, -12.5, -15, -12, -15, 0, -10.2, -1.5, -11.4, -4.2, -9.2, -5.6, -10.6, -8.6]); c.fill(); });
    c.restore();
    leg(-4.6, -6, 2.3, far, mix(p.dark, GLOOM, 0.3)); leg(8, -6, 2.2, far, mix(p.dark, GLOOM, 0.3));
    blob(c, [10.5, -10.5, 5, -15.6, -4, -15.2, -10.8, -12.6, -11.2, -6, -4, -3.8, 5, -4.2, 10.4, -6.4]); ink(c, fur(-15, -4), line);
    within(c, () => { c.fillStyle = p.light; blob(c, [12, -12, 11.5, -4.5, 2.5, -3, 5, -7.6]); c.fill(); });
    ell(c, -6.6, -8.6, 4.2, 4.7); c.fillStyle = fur(-13, -4); c.fill(); stroke(c, line, 0.6, () => c.arc(-6.6, -8.6, 4.3, -2.5, 0.3));
    leg(-7.6, -6.4, 2.5, fur(-15, -4), p.dark); leg(5.4, -7, 2.4, fur(-15, -4), p.dark);
    blob(c, [10.6, -18.6, 12.2, -22, 13.2, -24.6, 14, -22, 14.4, -18.2]); ink(c, mix(p.dark, p.body, 0.3), line, 0.9);
    blob(c, [5.2, -17.6, 9.5, -21, 14.2, -18.2, 19.4, -14.4, 21.6, -12.2, 18.4, -9.8, 11.5, -8.2, 6.2, -10, 4.2, -13.6]); ink(c, fur(-20, -9), line);
    within(c, () => { c.fillStyle = p.light; blob(c, [8.4, -12.6, 13.6, -13.6, 21, -13.2, 20, -9, 11, -7.4, 4.5, -9.4]); c.fill(); });
    blob(c, [5.4, -17.4, 5.6, -21.6, 7.4, -25.4, 9.6, -22.4, 11.2, -18.4]); ink(c, fur(-25, -18), line, 0.9);
    c.fillStyle = p.dark; blob(c, [6.9, -18.6, 7.2, -21, 7.8, -23.2, 8.8, -21, 9.6, -19]); c.fill();
    stroke(c, line, 0.55, () => { c.moveTo(19.8, -11.5); c.quadraticCurveTo(17.2, -10, 14.2, -10.8); });
    c.fillStyle = nose; ell(c, 20.1, -12.4, 1.15, 0.95); c.fill(); c.fillStyle = 'rgba(255,255,255,0.6)'; ell(c, 19.8, -12.8, 0.35, 0.25); c.fill();
    eye(12.6, -15.3, 1.35);
  } else if (kind === 'snake') {
    const sway = Math.sin(t * 2.5) * 1.2, flick = Math.sin(t * 9) > 0.2 ? 1 : 0.35;
    blob(c, [-9.5, -4.5, -14, -4.2, -17.5, -1.6, -17.5, -1.6, -13, -0.8, -9, -1.2]); ink(c, fur(-5, 0), line, 0.9);
    ell(c, 0, -3.3, 11, 3.5); ink(c, fur(-7, 0.4, mix(p.body, p.dark, 0.45)), line);
    within(c, () => { c.fillStyle = p.light; c.globalAlpha = 0.55; ell(c, 0, -0.4, 9, 1.5); c.fill(); c.globalAlpha = 1; c.fillStyle = p.dark; for (const x of [-7, -2.4, 2.4, 7]) { poly(c, [x, -6.4, x + 1.5, -4.4, x, -2.6, x - 1.5, -4.4]); c.fill(); } });
    ell(c, -0.6, -7.4, 8.2, 3.3); ink(c, fur(-10.6, -4, p.body), line);
    within(c, () => { c.fillStyle = p.dark; for (const x of [-5.4, -1, 3.6]) { poly(c, [x, -10, x + 1.5, -8.2, x, -6.4, x - 1.5, -8.2]); c.fill(); } c.fillStyle = p.light; for (const x of [-5.4, -1, 3.6]) { ell(c, x, -8.2, 0.5, 0.5); c.fill(); } });
    const neck = () => { c.moveTo(-2.4, -8.4); c.bezierCurveTo(-6.4, -13.5, -3, -19.4, 2.4 + sway * 0.6, -18.8); c.quadraticCurveTo(5.4 + sway, -18.6, 7.4 + sway, -17); };
    stroke(c, line, 6.2, neck); stroke(c, fur(-20, -8), 5, neck);
    c.save(); c.translate(1.3, 0.5); stroke(c, p.light, 1.9, neck); stroke(c, mix(p.light, p.dark, 0.35), 0.3, () => { for (const [x, y] of [[-3.6, -11], [-3.9, -13.4], [-3, -15.8], [-1, -17.6]]) { c.moveTo(x - 0.9, y); c.lineTo(x + 0.9, y + 0.2); } }); c.restore();
    c.save(); c.translate(sway, 0);
    stroke(c, '#e0384c', 0.6, () => { c.moveTo(15, -16); c.lineTo(15 + 3 * flick, -15.8); c.lineTo(15 + 4.4 * flick, -17); c.moveTo(15 + 3 * flick, -15.8); c.lineTo(15 + 4.4 * flick, -14.7); });
    blob(c, [4.6, -18.6, 9.6, -20.6, 14.8, -18, 16.4, -15.8, 13.4, -13.8, 7, -13.8, 4.4, -15.8]); ink(c, fur(-20.4, -13.8), line);
    within(c, () => { c.fillStyle = p.light; ell(c, 11, -13.6, 5.4, 1.5); c.fill(); });
    stroke(c, line, 0.45, () => { c.moveTo(15.8, -15.6); c.quadraticCurveTo(12, -15, 9.4, -15.6); });
    c.fillStyle = PUPIL; ell(c, 14.6, -17.2, 0.35, 0.3); c.fill();
    eye(10.6, -17.4, 1.25);
    c.restore();
  } else if (kind === 'owl') {
    const flap = Math.sin(t * 6) * 2.2, deep = mix(p.dark, GLOOM, 0.25);
    for (const s of [-1, 1]) {
      c.save(); c.scale(s, 1);
      blob(c, [4, -17, 12, -20.5 - flap, 18.6, -19.5 - flap * 1.5, 19.6, -14 - flap, 16.5, -9.6 - flap * 0.5, 14.5, -11.4, 12.6, -7.6, 10.4, -10, 8.4, -6.4, 6.2, -9, 4, -7]); ink(c, fur(-21, -7, p.dark), line);
      within(c, () => { stroke(c, deep, 0.5, () => { for (const [x, y] of [[8.4, -6.4], [12.6, -7.6], [16.5, -9.6]]) { c.moveTo(x, y - flap * 0.3); c.lineTo(x - 2.8, y - 9 - flap * 0.6); } }); stroke(c, mix(p.light, p.dark, 0.3), 0.7, () => { c.moveTo(5, -15.4); c.quadraticCurveTo(11, -18 - flap, 18, -16.6 - flap * 1.3); }); });
      c.restore();
    }
    for (const x of [-2.6, 2.6]) { stroke(c, '#e8963a', 1, () => { c.moveTo(x, -2.6); c.lineTo(x, -1); }); stroke(c, INK, 0.45, () => { for (const d of [-1.3, 0, 1.3]) { c.moveTo(x, -1); c.quadraticCurveTo(x + d, -0.6, x + d * 1.1, 0.4); } }); }
    blob(c, [0, -1.6, -6.4, -3.4, -8, -11, -5, -15, 5, -15, 8, -11, 6.4, -3.4]); ink(c, fur(-16, -2), line);
    within(c, () => { c.fillStyle = fur(-14, -1, p.light); ell(c, 0, -7, 5, 6); c.fill(); stroke(c, p.dark, 0.6, () => { for (let r = 0; r < 4; r++) for (let i = -1; i <= 1; i++) { const x = i * 2.6 + (r % 2 ? 1.3 : 0), y = -10.6 + r * 2.2; if (Math.abs(x) > 3.6) continue; c.moveTo(x - 0.8, y); c.lineTo(x, y + 0.9); c.lineTo(x + 0.8, y); } }); });
    for (const s of [-1, 1]) { blob(c, [s * 6.4, -18.6, s * 7.2, -22, s * 7.6, -25, s * 5.2, -23, s * 2.4, -21]); ink(c, fur(-25, -19, p.dark), line, 0.9); }
    blob(c, [0, -22.4, -5.6, -22, -8, -17.6, -6.4, -12.8, 0, -11.4, 6.4, -12.8, 8, -17.6, 5.6, -22]); ink(c, fur(-22.4, -11.4), line);
    for (const x of [-3.3, 3.3]) { ell(c, x, -16.6, 3.5, 3.7); c.fillStyle = fur(-21, -12, p.light); c.fill(); stroke(c, mix(p.light, p.dark, 0.5), 0.4, () => c.arc(x, -16.6, 3.5, 0, 6.3)); }
    for (const x of [-3.1, 3.1]) { ell(c, x, -16.8, 2.3, 2.3); ink(c, p.eye, PUPIL, 0.6); c.fillStyle = PUPIL; ell(c, x, -16.8, 1.15, 1.15); c.fill(); c.fillStyle = 'rgba(255,255,255,0.95)'; ell(c, x - 0.7, -17.6, 0.55, 0.55); c.fill(); }
    stroke(c, line, 0.9, () => { c.moveTo(-6.2, -20.2); c.lineTo(-1, -18.6); c.moveTo(6.2, -20.2); c.lineTo(1, -18.6); });
    blob(c, [-1.2, -15.6, 1.2, -15.6, 1.2, -15.6, 0, -12.2, 0, -12.2, -1.2, -15.6]); ink(c, '#e8963a', INK, 0.6);
  } else if (kind === 'weasel') {
    const wag = Math.sin(t * 5) * 0.2;
    c.save(); c.translate(-10, -5.6); c.rotate(wag - 0.12);
    blob(c, [1.5, -1.6, -5, -2.8, -9.5, -2.2, -10, 0.4, -5, 1.5, 1.5, 1.4]); ink(c, fur(-2.6, 1.4), line, 0.9);
    within(c, () => { c.fillStyle = p.dark; c.fillRect(-12, -4, 5.4, 8); });
    c.restore();
    leg(-5.4, -3.6, 1.9, far); leg(6.8, -3.6, 1.9, far);
    blob(c, [-11.4, -6.4, -6, -10.4, 1, -9.2, 5.6, -9.2, 8, -15.4, 13.4, -14.6, 13, -8.4, 9.4, -3.2, 0, -2.6, -8.6, -2.8]); ink(c, fur(-14.5, -2.8), line);
    within(c, () => { c.fillStyle = p.light; blob(c, [14, -12.4, 13, -5.4, 8, -1.6, -7, -1.6, -6.6, -3.6, 5.6, -4.4, 9.6, -9.4]); c.fill(); });
    leg(-8, -4.4, 2.1, fur(-14.5, -2.8)); leg(4.6, -4.4, 2.1, fur(-14.5, -2.8));
    ell(c, 9.5, -16.9, 1.7, 1.7); ink(c, fur(-18.6, -15.2), line, 0.8); c.fillStyle = p.dark; ell(c, 9.7, -16.8, 0.8, 0.85); c.fill();
    blob(c, [7.2, -13, 8.6, -17.6, 13.2, -17.6, 17.2, -14.8, 18.4, -12.6, 15.4, -10.4, 9.6, -10]); ink(c, fur(-17.6, -10.2), line);
    within(c, () => { c.fillStyle = p.light; ell(c, 15, -10.8, 3.6, 1.6); c.fill(); });
    whiskers(16, -11.9, 3.6);
    c.fillStyle = nose; ell(c, 17.6, -13.1, 0.95, 0.8); c.fill();
    eye(13.2, -14.5, 1.05);
  } else if (kind === 'badger') {
    ell(c, -12.2, -6.6, 3.8, 2.5, -0.3); ink(c, fur(-9, -4), line);
    leg(-5.4, -4.4, 2.8, mix(p.dark, GLOOM, 0.3)); leg(7.2, -4.4, 2.8, mix(p.dark, GLOOM, 0.3));
    blob(c, [9.4, -9, 4, -15.8, -5, -16, -13, -12, -13, -4.4, -4, -2.6, 5, -2.8, 9.4, -5]); ink(c, fur(-15.6, -3), line);
    within(c, () => { c.fillStyle = p.dark; ell(c, -1, -2.6, 11, 3); c.fill(); stroke(c, mix(p.body, p.light, 0.55), 0.5, () => { for (const [x, y] of [[-9, -11], [-5, -13], [-1, -13.4], [3, -12.6], [-7, -8.6], [-2, -10], [2, -9.6]]) { c.moveTo(x, y); c.lineTo(x - 1.6, y + 1.4); } }); });
    leg(-8.2, -4.8, 3.2, p.dark, undefined, p.light); leg(4.4, -4.8, 3.2, p.dark, undefined, p.light);
    ell(c, 6.9, -14.6, 2, 2); ink(c, p.dark, line, 0.9); stroke(c, p.light, 0.6, () => c.arc(6.9, -14.6, 1.6, -2.8, -0.2));
    blob(c, [4.8, -11, 6.6, -15.6, 12, -15, 17.8, -10.6, 19.6, -7.4, 16.6, -4.8, 10, -4, 5.2, -6.4]); ink(c, fur(-15.4, -4.2, p.light), line);
    within(c, () => { c.fillStyle = p.dark; blob(c, [4, -13.4, 10, -14, 18.4, -10, 19.4, -8.2, 12, -9, 5, -9.6]); c.fill(); blob(c, [4, -6.6, 11, -6, 17, -5.6, 16, -3.4, 8, -3, 4, -4]); c.fill(); });
    c.fillStyle = nose; ell(c, 18.9, -7.7, 1.35, 1.1); c.fill();
    eye(11.8, -11, 1, false);
  } else if (kind === 'hawk') {
    const flap = Math.sin(t * 5) * 3, gold = '#f2b93b', deep = mix(p.dark, GLOOM, 0.4);
    poly(c, [-2, -12, -9, -23 - flap, -11, -20.6 - flap, -12.6, -18.2 - flap * 0.9, -13.6, -15.6 - flap * 0.7, -6, -10.6]); ink(c, far, line, 0.9);
    poly(c, [-5.6, -11.6, -15.6, -14.4, -17.2, -11.8, -17.6, -9, -16.4, -6.2, -6.4, -7.4]); ink(c, fur(-14.4, -6.4), line, 0.9);
    within(c, () => { c.fillStyle = p.light; c.globalAlpha = 0.85; poly(c, [-13.4, -15, -14.6, -15, -15.4, -5, -14.2, -5]); c.fill(); c.globalAlpha = 1; stroke(c, deep, 0.45, () => { for (const y of [-12.4, -10.4, -8.4]) { c.moveTo(-6.4, -9.6); c.lineTo(-17.6, y); } }); });
    for (const x of [-0.8, 2.4]) { stroke(c, INK, 1.5, () => { c.moveTo(x, -5.6); c.lineTo(x + 0.9, -3.2); }); stroke(c, gold, 0.95, () => { c.moveTo(x, -5.6); c.lineTo(x + 0.9, -3.2); }); stroke(c, INK, 0.5, () => { for (const d of [-1.2, 0.2, 1.5]) { c.moveTo(x + 0.9, -3.2); c.quadraticCurveTo(x + 0.9 + d, -2.4, x + 0.7 + d, -1.2); } }); }
    blob(c, [-3.4, -7.4, 3.6, -7.6, 3.4, -4.4, 1, -3.6, 0.4, -4.6, -1.2, -3.6, -2.6, -4.6]); ink(c, fur(-12, -3.6), line, 0.8);
    blob(c, [-8.4, -9.6, -3, -14.8, 5, -15, 9.6, -11.4, 7.4, -6.2, 0, -5, -6.4, -6.4]); ink(c, fur(-14.8, -5.2), line);
    within(c, () => { c.fillStyle = fur(-13, -4, p.light); blob(c, [10.4, -13, 9.6, -5, 2, -3.4, 1, -6.4, 4.4, -9.4]); c.fill(); stroke(c, p.dark, 0.5, () => { for (const [x, y] of [[6.2, -9.4], [4.6, -7.4], [7.2, -7.2], [5.6, -5.6], [3, -5.6]]) { c.moveTo(x - 0.6, y - 0.4); c.lineTo(x, y + 0.4); c.lineTo(x + 0.6, y - 0.4); } }); });
    blob(c, [5.4, -13.4, 6.4, -18, 10.4, -18.6, 13, -16, 12.4, -11.6, 8.6, -10.4]); ink(c, fur(-18.4, -10.6, p.light), line);
    c.beginPath(); c.moveTo(11.8, -16.4); c.quadraticCurveTo(15.6, -16.2, 16.6, -13.6); c.quadraticCurveTo(16.8, -11.6, 15.4, -10.6); c.quadraticCurveTo(15.2, -12.4, 13.2, -12.6); c.lineTo(11.8, -12.8); c.closePath(); ink(c, gold, INK, 0.7);
    within(c, () => { c.fillStyle = '#4a3a2e'; c.fillRect(14.6, -14, 3, 4); });
    eye(9.6, -15.2, 1.3);
    poly(c, [4.6, -13.4, 2.6, -25.6 - flap * 1.4, -0.2, -25 - flap * 1.4, -2.6, -23.2 - flap * 1.3, -4.6, -20.8 - flap * 1.2, -6, -18 - flap, -3.4, -13, 1, -11.2]); ink(c, fur(-25 - flap, -11, p.dark), line);
    within(c, () => {
      stroke(c, deep, 0.5, () => { for (const [x, y] of [[1.2, -25.2], [-1.4, -24], [-3.6, -22], [-5.3, -19.4]]) { c.moveTo(x, y + 1.2 - flap * 1.3); c.lineTo(x * 0.3 + 1.4, -16.4 - flap * 0.3); } });
      c.fillStyle = mix(p.dark, p.body, 0.7); blob(c, [5, -12.6, 3.6, -17.6 - flap * 0.4, 0.6, -17 - flap * 0.4, -1.6, -17.8 - flap * 0.4, -4.4, -16.4 - flap * 0.3, -4, -12, 1, -10.4]); c.fill(); stroke(c, deep, 0.4, () => { for (const x of [-2.8, -0.4, 2]) c.arc(x, -15.4 - flap * 0.3, 1.2, 0.3, 2.8); });
    });
  } else if (kind === 'mole') {
    const soil = '#8d6a4c', loam = '#4a3526';
    ell(c, 0, -2.2, 13, 3.6); ink(c, mix(soil, loam, 0.45), loam, 0.9);
    blob(c, [-9, -1, -8.6, -11.6, -1, -15.6, 6.4, -13, 9.4, -6, 8.4, -1]); ink(c, fur(-15, -2), line);
    within(c, () => { c.fillStyle = p.light; c.globalAlpha = 0.5; ell(c, 1.5, -3.6, 6, 3); c.fill(); c.globalAlpha = 1; });
    blob(c, [3.6, -12.4, 9, -12.4, 14, -9.6, 17.4, -7.8, 14, -5.6, 8, -4, 3.6, -5.6]); ink(c, fur(-12.4, -4.2), line);
    within(c, () => { c.fillStyle = p.light; blob(c, [11, -11, 18, -9.6, 18, -5, 11, -4.6, 12.4, -7.8]); c.fill(); });
    whiskers(13.6, -6.6, 3.4);
    ell(c, 16.6, -7.8, 1.4, 1.2); ink(c, '#ff8fa8', line, 0.5);
    eye(8.8, -9.8, 0.8, false);
    blob(c, [-14.5, 1, -13, -3.4, -6, -1.6, 0, -3.4, 6, -1.8, 12.6, -3.6, 14.5, 1]); ink(c, fur(-3.6, 1, soil), loam, 0.9);
    c.fillStyle = loam; for (const [x, y] of [[-10.4, -0.6], [-3, -0.4], [3.6, -0.8], [10, -0.4]]) { ell(c, x, y, 0.7, 0.45); c.fill(); }
    for (const fx of [-5.6, 6.6]) { poly(c, [fx - 2.6, -3.6, fx - 3.4, 0.4, fx - 1.2, -1.6, fx, 0.7, fx + 1.2, -1.6, fx + 3.4, 0.4, fx + 2.6, -3.6]); ink(c, fur(-3.6, 0.6, p.light), line, 0.8); }
  } else if (kind === 'skunk') {
    const wag = Math.sin(t * 3) * 0.12;
    c.save(); c.translate(-7.6, -8.4); c.rotate(wag);
    blob(c, [1.5, 1, -7, 0, -12, -8.6, -9, -17.4, -1.4, -19.6, 4, -14.4, -0.4, -10, 2.4, -4]); ink(c, fur(-19, 1), mix(line, p.light, 0.12));
    within(c, () => { stroke(c, p.light, 3.6, () => { c.moveTo(-1.6, -1); c.quadraticCurveTo(-8.6, -8, -3.4, -15.6); }); stroke(c, p.body, 0.5, () => { for (const [x, y, a] of [[-4.6, -4.6, 0.6], [-6.4, -8, 0.1], [-5.6, -11.6, -0.5], [-3.6, -14.6, -0.9]]) { c.moveTo(x - 1.6 * Math.cos(a), y - 1.6 * Math.sin(a)); c.lineTo(x + 1.6 * Math.cos(a), y + 1.6 * Math.sin(a)); } }); });
    c.restore();
    leg(-4, -4.2, 2.5, far); leg(6.2, -4.2, 2.5, far);
    blob(c, [9.4, -9, 4, -14, -4, -13.8, -10.6, -10.4, -10.6, -4.4, -3, -2.8, 5, -3, 9.4, -5.2]); ink(c, fur(-13.8, -3), mix(line, p.light, 0.12));
    within(c, () => stroke(c, p.light, 2.6, () => { c.moveTo(-10.6, -10.4); c.quadraticCurveTo(0, -15.2, 8.6, -11.6); }));
    leg(-6.6, -5, 2.7, fur(-13.8, -3)); leg(4, -5, 2.7, fur(-13.8, -3));
    ell(c, 8.3, -14.6, 1.7, 1.8); ink(c, fur(-16.4, -12.8), mix(line, p.light, 0.12), 0.8); c.fillStyle = mix(p.light, '#e89aa6', 0.5); ell(c, 8.5, -14.5, 0.75, 0.85); c.fill();
    blob(c, [5.6, -11.6, 7.8, -15.4, 12.6, -14.6, 16.8, -10.6, 17.8, -8.6, 14.8, -6.4, 9, -6.2, 5.8, -8.2]); ink(c, fur(-15.2, -6.4), mix(line, p.light, 0.12));
    within(c, () => stroke(c, p.light, 1.5, () => { c.moveTo(8.2, -15); c.lineTo(16.4, -9.6); }));
    c.fillStyle = mix('#e89aa6', INK, 0.35); ell(c, 17.3, -8.9, 1, 0.9); c.fill();
    eye(12, -10.2, 1.05, false);
  } else if (kind === 'bear') {
    leg(-5.4, -7, 3.9, far, undefined, p.light); leg(8.4, -7, 3.9, far, undefined, p.light);
    ell(c, -13.4, -12, 2.1, 2.1); ink(c, fur(-14, -10), line, 0.9);
    blob(c, [11.4, -11, 7, -20.6, -2, -18.4, -11, -18, -15.6, -11.5, -13.6, -4.2, -3, -3.6, 5, -4, 11.4, -6.4]); ink(c, fur(-19.6, -4), line);
    within(c, () => { c.fillStyle = mix(p.body, GLOOM, 0.3); ell(c, -2, -4, 11, 2.6); c.fill(); stroke(c, mix(p.body, GLOW, 0.3), 0.5, () => { for (const [x, y] of [[-9, -14], [-4, -15.4], [1, -15.6], [5, -16.4], [-7, -11], [-1, -12], [4, -12.4]]) { c.moveTo(x, y); c.lineTo(x - 1.6, y + 1.5); } }); });
    stroke(c, line, 0.6, () => c.arc(4.6, -9.6, 5, -2.2, 0.2));
    leg(-9.6, -7.6, 4.4, fur(-19.6, -4), undefined, p.light); leg(4.4, -8, 4.4, fur(-19.6, -4), undefined, p.light);
    ell(c, 14.8, -21.6, 2.2, 2.2); ink(c, far, line, 0.9);
    blob(c, [5.2, -15, 6.8, -22, 12.5, -23, 17.4, -20.2, 20, -15, 19, -10.6, 13, -9, 6.8, -10.2]); ink(c, fur(-22.6, -9.4), line);
    ell(c, 16.4, -13, 3.9, 3.1); ink(c, fur(-16, -10, p.light), line, 0.6);
    stroke(c, line, 0.5, () => { c.moveTo(18.8, -13.2); c.lineTo(18.6, -12); c.quadraticCurveTo(17, -10.8, 15.4, -11.6); });
    c.fillStyle = '#2a1c18'; ell(c, 18.9, -14.3, 1.5, 1.2); c.fill(); c.fillStyle = 'rgba(255,255,255,0.5)'; ell(c, 18.5, -14.8, 0.45, 0.3); c.fill();
    ell(c, 8.2, -21.4, 2.7, 2.7); ink(c, fur(-24, -19), line, 0.9); c.fillStyle = p.dark; ell(c, 8.4, -21.2, 1.3, 1.35); c.fill();
    eye(12.4, -17, 1.2);
  } else {
    const sway = Math.sin(t * 2) * 1.5;
    const tail = () => { c.moveTo(-10.5, -11.4); c.quadraticCurveTo(-17.6, -11, -18, -5.4); c.quadraticCurveTo(-18.2, -1.8, -21, -3.6 + sway); };
    const tip = () => { c.moveTo(-18.1, -3.9); c.quadraticCurveTo(-18.6, -2, -21, -3.6 + sway); };
    stroke(c, line, 3.9, tail); stroke(c, fur(-12, -2), 2.7, tail); stroke(c, p.dark, 2.7, tip);
    leg(-5, -6.6, 2.9, far); leg(8.8, -7, 2.9, far);
    blob(c, [9.6, -9, 8.4, -18.4, 0, -15.6, -8, -17.2, -14, -12.6, -12.8, -5.4, -4, -4.2, 4, -4.8, 9.6, -6]); ink(c, fur(-17.4, -4.6), line);
    within(c, () => { c.fillStyle = p.light; c.globalAlpha = 0.9; blob(c, [12, -9, 11, -4, 0, -2.6, -11, -3.4, -8, -5.2, 2, -5.6, 8.6, -7.6]); c.fill(); c.globalAlpha = 1; });
    stroke(c, line, 0.6, () => c.arc(4.6, -10.4, 4.6, -2.4, 0.2));
    ell(c, -8.2, -9.6, 4.9, 5.5); c.fillStyle = fur(-15, -4); c.fill(); stroke(c, line, 0.6, () => c.arc(-8.2, -9.6, 5, -2.6, 0.2));
    leg(-9.2, -6.6, 3.2, fur(-17.4, -4.6)); leg(4.8, -8, 3.2, fur(-17.4, -4.6));
    blob(c, [12.8, -19.6, 14.2, -22.4, 15.4, -23.6, 16.6, -21.6, 16.6, -19]); ink(c, far, line, 0.9);
    blob(c, [7, -17.8, 10, -21.4, 14.8, -20.6, 19.4, -16.8, 21.6, -14.2, 19.6, -11, 14, -9.8, 8, -11.2]); ink(c, fur(-21, -10), line);
    within(c, () => { c.fillStyle = fur(-16, -9.6, p.light); blob(c, [15.4, -15.4, 22, -16, 22, -10, 13, -8.6, 12.6, -12.2]); c.fill(); c.fillStyle = PUPIL; for (const [x, y] of [[17.2, -12.9], [18, -12.1], [17.2, -11.6]]) { ell(c, x, y, 0.2, 0.2); c.fill(); } });
    whiskers(18.2, -12.4, 4.4);
    blob(c, [7.8, -19, 8.2, -22.4, 9.6, -24.2, 11.6, -22.4, 12.6, -19.6]); ink(c, fur(-24, -19), line, 0.9); c.fillStyle = mix(p.light, '#d98a8a', 0.45); blob(c, [9, -19.8, 9.2, -21.6, 9.9, -22.8, 10.8, -21.6, 11.3, -20]); c.fill();
    c.fillStyle = mix('#d9808a', INK, 0.35); poly(c, [19.5, -15.5, 21.4, -15.1, 20.5, -13.8]); c.fill();
    stroke(c, line, 0.5, () => { c.moveTo(20.5, -13.8); c.lineTo(20.3, -12.9); c.quadraticCurveTo(18.6, -11.6, 16.6, -12.2); });
    stroke(c, p.dark, 0.7, () => { c.moveTo(15.6, -15.8); c.quadraticCurveTo(16.4, -14.6, 16, -13.2); });
    eye(14.4, -16.9, 1.1);
  }
}

/** Smaller creatures that are not predators in every game: same frame, feet at (0, 0), facing right. */
export type CritterKind = 'beetle' | 'armadillo' | 'lizard';
export function critter(c: C2D, kind: CritterKind, p: Tint, t: number) {
  const { line, far, fur, eye } = brushes(c, p);
  if (kind === 'beetle') {
    const tick = Math.sin(t * 7) * 0.6;
    const legs = (xs: number[], lean: number, col: string, w: number) => stroke(c, col, w, () => { for (const x of xs) { c.moveTo(x, -6); c.lineTo(x + lean * 1.6, -3.2); c.lineTo(x + lean, 0); } });
    legs([-5, 0, 5], 1.6 - tick, mix(p.dark, GLOOM, 0.4), 1.3);
    blob(c, [10, -11, 12.6, -15.6, 16.8, -16.6, 17.4, -15, 14.6, -12.6, 13.4, -8.6]); ink(c, p.dark, line, 0.8);
    ell(c, 9.4, -6.6, 3.9, 3.7); ink(c, fur(-10, -3, p.dark), line);
    stroke(c, line, 0.7, () => { c.moveTo(11.5, -8.6); c.quadraticCurveTo(15, -10.6, 17.2, -8.6 - tick); });
    blob(c, [-10.6, -2.6, -10.4, -13, -2, -18.4, 6.4, -15.4, 9.6, -8, 8.4, -2.6]); ink(c, fur(-17.4, -2.8), line);
    within(c, () => {
      stroke(c, p.dark, 0.8, () => { c.moveTo(-9.6, -9.6); c.quadraticCurveTo(0, -12.6, 9, -8.6); });
      c.fillStyle = p.light; for (const [x, y, r] of [[-5.6, -13, 1.5], [0.6, -14.6, 1.3], [-6, -6.6, 1.6], [0.4, -7.4, 1.5], [5.4, -6, 1.2]]) { ell(c, x, y, r, r * 0.85); c.fill(); }
      stroke(c, 'rgba(255,255,255,0.55)', 1.2, () => { c.moveTo(-7.6, -12.6); c.quadraticCurveTo(-4.6, -16.2, 0.6, -16.6); });
    });
    c.fillStyle = p.dark; for (const [x, y, a] of [[-8.4, -13.6, -0.7], [-4.4, -16.6, -0.3], [1, -17.6, 0.1], [5.6, -15.4, 0.6]]) { c.save(); c.translate(x, y); c.rotate(a); poly(c, [-0.9, 0.4, 0, -2.2, 0.9, 0.4]); ink(c, p.dark, line, 0.5); c.restore(); }
    legs([-6.4, -1.4, 3.6], -1.6 + tick, mix(p.dark, INK, 0.4), 1.5);
    c.fillStyle = p.light; ell(c, 10.6, -7.4, 1, 1); c.fill(); c.fillStyle = PUPIL; ell(c, 10.9, -7.4, 0.5, 0.5); c.fill();
  } else if (kind === 'armadillo') {
    blob(c, [-9, -7, -14, -5.4, -19, -3, -19, -3, -14, -2.6, -9, -2.6]); ink(c, fur(-7, -2.6), line, 0.9);
    stroke(c, p.dark, 0.5, () => { for (const x of [-11.5, -14, -16.4]) { c.moveTo(x, -5.6 - (x + 19) * 0.12); c.lineTo(x - 0.3, -2.8); } });
    for (const x of [-4.6, 6.6]) { c.beginPath(); c.roundRect(x - 1.3, -4.4, 2.6, 4, 0.8); ink(c, far, line, 0.8); }
    for (const x of [-7, 4]) { c.beginPath(); c.roundRect(x - 1.5, -4.4, 3, 4, 0.9); ink(c, p.dark, line, 0.8); stroke(c, p.light, 0.45, () => { for (const d of [0, 0.9, 1.8]) { c.moveTo(x - 0.4 + d, -0.7); c.lineTo(x + d, 0.2); } }); }
    blob(c, [8.4, -11.6, 9, -15.6, 9.6, -17.4, 11.4, -15, 12.6, -11.4]); ink(c, fur(-17, -11.6), line, 0.8); c.fillStyle = mix(p.light, '#d98a8a', 0.4); blob(c, [9.4, -12.4, 9.8, -14.4, 10.1, -15.6, 10.8, -14, 11.4, -12.2]); c.fill();
    blob(c, [7, -12, 11.6, -12.4, 15.6, -8.4, 19.6, -5.4, 19.6, -5.4, 15, -3.6, 8, -3.2]); ink(c, fur(-12, -3.4, p.light), line);
    c.beginPath(); c.moveTo(-11.6, -3.2); c.quadraticCurveTo(-11.4, -18.4, 0, -18.4); c.quadraticCurveTo(10.6, -18.4, 11.6, -3.2); c.closePath(); ink(c, fur(-18.4, -3.2), line);
    within(c, () => {
      stroke(c, mix(p.dark, p.body, 0.25), 0.8, () => { for (const x of [-7.4, -4, -0.6, 2.8, 6.2]) { c.moveTo(x - 0.4, -3); c.quadraticCurveTo(x - 1.8, -11, x - 0.2, -19); } });
      c.fillStyle = mix(p.body, GLOW, 0.4); for (const x of [-9.4, -5.8, -2.4, 1, 4.4, 8.4]) for (const y of [-6, -9.4, -12.8, -16]) { ell(c, x - (y + 10) * 0.08, y, 0.55, 0.75); c.fill(); }
      stroke(c, 'rgba(255,255,255,0.4)', 1.1, () => { c.moveTo(-8, -13); c.quadraticCurveTo(-5, -16.6, 0, -17); });
      c.fillStyle = mix(p.dark, GLOOM, 0.2); c.globalAlpha = 0.5; c.fillRect(-12, -4.4, 24, 2); c.globalAlpha = 1;
    });
    c.fillStyle = PUPIL; ell(c, 19, -5.5, 0.85, 0.75); c.fill();
    eye(13.6, -8.8, 0.95, false);
  } else {
    const sway = Math.sin(t * 3) * 1.6;
    blob(c, [-6.6, -8.2, -13, -7.4, -19.6, -9.6 + sway, -20.4, -8.6 + sway, -19.6, -7.4 + sway, -13, -3, -6.6, -2.6]); ink(c, fur(-9, -3), line);
    const limb = (x: number, lean: number, col: string) => { stroke(c, line, 2.3, () => { c.moveTo(x, -4.6); c.lineTo(x + lean, -0.7); }); stroke(c, col, 1.3, () => { c.moveTo(x, -4.6); c.lineTo(x + lean, -0.7); }); stroke(c, line, 0.5, () => { for (const d of [-0.9, 0.3, 1.5]) { c.moveTo(x + lean, -0.7); c.lineTo(x + lean + d + 0.6, 0.2); } }); };
    limb(-3.6, 2.6, far); limb(6.4, 2.6, far);
    c.fillStyle = p.dark; for (const x of [-6.4, -3.6, -0.8, 2, 4.8, 7.4]) { poly(c, [x - 1.2, -8.2, x - 0.2, -11.4 + Math.abs(x) * 0.12, x + 1.2, -8.4]); ink(c, p.dark, line, 0.5); }
    blob(c, [-8.6, -8, 0, -10.4, 8.6, -9.4, 9.6, -4, 0, -1.8, -8.6, -2.6]); ink(c, fur(-10, -2.2), line);
    within(c, () => { c.fillStyle = p.light; ell(c, 1, -2.4, 9, 1.8); c.fill(); c.fillStyle = p.dark; c.globalAlpha = 0.6; for (const [x, y] of [[-5.4, -6.6], [-2, -7.4], [1.6, -7.2], [5, -6.8], [-3.6, -5], [0, -5.2], [3.6, -5]]) { ell(c, x, y, 0.75, 0.55); c.fill(); } c.globalAlpha = 1; });
    limb(-5.6, -2.8, p.body); limb(5, -2.8, p.body);
    stroke(c, '#e0384c', 0.6, () => { c.moveTo(16.4, -6.8); c.lineTo(19.4, -6.4 + sway * 0.3); });
    blob(c, [6.6, -10.6, 12, -12, 17.2, -8.8, 17, -5.6, 11, -4, 6.6, -5.4]); ink(c, fur(-11.6, -4.4), line);
    within(c, () => { c.fillStyle = p.light; ell(c, 13, -4.6, 4.6, 1.3); c.fill(); });
    stroke(c, line, 0.45, () => { c.moveTo(17, -6.6); c.quadraticCurveTo(14, -6, 11.6, -6.6); });
    eye(12.4, -8.9, 1.15);
  }
}
