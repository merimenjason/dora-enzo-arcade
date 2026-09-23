// Dora and Enzo in Canvas 2D, side-on, shared by the 2D games so they look the same everywhere.
// Drawn in a 24-unit-tall frame with the feet at (0, 0) facing right; callers pass a height in their own pixels.
export type ChinId = 'dora' | 'enzo';

const ellipse = (c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, rot = 0) => { c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2); };
const dot = (c: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string) => { c.fillStyle = fill; ellipse(c, x, y, r, r); c.fill(); };
const line = (c: CanvasRenderingContext2D, pts: number[], stroke: string, width: number) => {
  c.strokeStyle = stroke; c.lineWidth = width; c.beginPath(); c.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
  c.stroke();
};

export type Coat = {
  fur: string; back: string; face: string; shade: string; belly: string; line: string; texture: string;
  ear: string; earIn: string; earLine: string; vein: string; foot: string; toe: string;
  eye: string; pupil: string; nose: string; whisker: string; whiskerAlt: string; blush: string;
  tail: string; tailOuter: string; tailInner: string; tailLine: string; streaks: boolean;
  /** Enzo's wavy darker bands and mottling, pale front legs, see-through ears and eye size. */
  bands: boolean; paleLegs: boolean; earGlow: boolean; eyeR: number;
};
// Drawn from public/art/dora.jpeg, enzo.jpeg and the-original-duo.jpg; tails and whiskers follow the painted pair in
// ChinChin · Snack Heist (github.com/merimenjason/dora-enzo-chatgpt-arcade).
// Dora: white, peach-pink ears you can almost see through, ruby eyes, pink toes and a smooth white plume of a tail.
// Enzo: standard grey with a darker wavy back, a paler face, a white chest and a bushy streaked grey plume.
export const COATS: Record<ChinId, Coat> = {
  dora: {
    fur: '#fbf8f3', back: '#f0eae0', face: '#fefcf9', shade: '#e2d8cb', belly: '#ffffff', line: '#6e5d57', texture: '#e5dccf',
    ear: '#f7cfbd', earIn: '#efab98', earLine: '#b88375', vein: '#e0907f', foot: '#f4c6bd', toe: '#c98a82',
    eye: '#8e1f33', pupil: '#3b0913', nose: '#eb9ea2', whisker: '#ffffff', whiskerAlt: '#ddd3c6', blush: 'rgba(240, 150, 150, 0.3)',
    tail: '#f8f4ec', tailOuter: '#ffffff', tailInner: '#e4dacb', tailLine: '#8f7f76', streaks: false,
    bands: false, paleLegs: false, earGlow: true, eyeR: 1.6,
  },
  enzo: {
    fur: '#75737d', back: '#4c4a54', face: '#8f8d98', shade: '#5c5a64', belly: '#e8e4e6', line: '#232128', texture: '#4f4d57',
    ear: '#77727e', earIn: '#a8929a', earLine: '#35323b', vein: '#8b7580', foot: '#bca8aa', toe: '#7e6d71',
    eye: '#0e0c12', pupil: '#000000', nose: '#a48f96', whisker: '#f4f2f6', whiskerAlt: '#26242b', blush: 'rgba(200, 140, 150, 0.18)',
    tail: '#7a7882', tailOuter: '#56545d', tailInner: '#a4a2ac', tailLine: '#26242b', streaks: true,
    bands: true, paleLegs: true, earGlow: false, eyeR: 1.8,
  },
};

/** A new coat based on Dora's or Enzo's, for teammates, rivals and neighbours. */
export const coatLike = (base: ChinId, over: Partial<Coat>): Coat => ({ ...COATS[base], ...over });

/**
 * `face` 1 looks right. `run` drives the stride; `moving`, `air`, `blink` and `dizzy` pick the pose.
 * `bib` dresses them in a team vest with a number; `decorate` draws extras (a hat, a power-up) in the
 * 24-unit frame, given the body's bob.
 */
export type ChinOpts = {
  face: 1 | -1; h: number; time: number; run?: number; moving?: boolean; air?: boolean; blink?: boolean; dizzy?: boolean;
  bib?: { color: string; trim: string; label?: string };
  decorate?: (c: CanvasRenderingContext2D, bob: number) => void;
};

/** Dora or Enzo, feet at (x, base), `h` pixels tall. Drawn side-on in a 24-unit-tall frame facing right. */
export function drawChinchilla(c: CanvasRenderingContext2D, id: ChinId | Coat, x: number, base: number, o: ChinOpts) {
  const k = typeof id === 'string' ? COATS[id] : id, s = o.h / 24, t = o.time;
  c.save();
  c.translate(x, base);
  c.scale(o.face * s * 0.95, s);
  const moving = !!o.moving && !o.air;
  // Chinchillas bound: hind feet push while the front paws reach, and the back arches with it.
  const stride = moving && o.run !== undefined ? Math.sin(o.run * 0.45) : 0;
  const breathe = !moving && !o.air ? Math.sin(t * 3) * 0.3 : 0;
  const bob = o.air ? -0.8 : -Math.abs(stride) * 1.4 + breathe;
  const lean = o.air ? -0.1 : stride * 0.05;
  // One outline around several shapes: stroke them all thick, then fill them all over the top.
  const blob = (parts: (() => void)[], fill: string | CanvasGradient, outline: string, width = 1.7) => {
    c.lineWidth = width; c.strokeStyle = outline; c.lineJoin = 'round';
    for (const p of parts) { p(); c.stroke(); }
    c.fillStyle = fill;
    for (const p of parts) { p(); c.fill(); }
  };
  const oval = (ex: number, ey: number, rx: number, ry: number, rot = 0) => () => ellipse(c, ex, ey, rx, ry, rot);

  if (!o.air) { c.fillStyle = 'rgba(20, 12, 30, 0.2)'; ellipse(c, 0, -0.2, 12, 1.6); c.fill(); }

  tail(c, k, t, bob, moving, !!o.air);

  // Far ear and far feet sit behind the body.
  const sweep = o.air ? -0.4 : moving ? -0.2 : 0;
  const ear = (dx: number, dy: number, rx: number, ry: number, rot: number) => oval(dx + sweep * 2.5, dy + bob, rx, ry, rot + sweep);
  blob([ear(2.6, -22.2, 4, 5, -0.4)], k.earIn, k.earLine, 1.3);
  const air = !!o.air;
  const hindX = air ? -7 : -3 - stride * 3.2, frontX = air ? 11 : 7.5 + stride * 2.6;
  blob([oval(hindX - 2, -1.4, 3.8, 1.4, air ? 0.5 : 0)], k.toe, k.line, 1.1);
  blob([oval(frontX - 2.5, air ? -6.5 : -1.3, 2, 1.1)], k.toe, k.line, 1);

  // Far-side whiskers poke out from behind the muzzle, so draw them before the head covers their roots.
  const whisk = Math.sin(t * 5) * 0.4;
  whiskers(c, k, 12.8, -10.9 + bob, [[-0.3, 9], [0, 9.5], [0.3, 8.5]], whisk, moving, 0.5);

  // Body, haunch, chest, head, muzzle and cheek fluff share one outline.
  c.save(); c.translate(0, -6); c.rotate(lean); c.translate(0, 6);
  const coat = c.createLinearGradient(0, -19 + bob, 0, 0);
  coat.addColorStop(0, k.back); coat.addColorStop(0.45, k.fur); coat.addColorStop(1, k.shade);
  const cheeks = () => {
    c.beginPath(); c.moveTo(3, -12 + bob);
    for (const [px, py] of [[3.6, -7.2], [5, -8.6], [6.2, -6.6], [7.6, -8.2], [9, -6.8], [10, -8.4]]) c.lineTo(px, py + bob);
    c.lineTo(11, -11 + bob); c.closePath();
  };
  blob([oval(-1.5, -8.5 + bob, 10, 7.8), oval(-6.5, -6.2 + bob, 6.4, 6), oval(4.5, -7.8 + bob, 5.6, 6), cheeks, oval(6.8, -12.6 + bob, 6.6, 6.3), oval(11.2, -10.6 + bob, 3.3, 3)], coat, k.line);
  // Lighter face and a white chest and belly.
  c.fillStyle = k.face; ellipse(c, 8, -12 + bob, 5.4, 5); c.fill();
  c.fillStyle = k.belly; ellipse(c, 8.4, -6.6 + bob, 3, 3.6); c.fill(); ellipse(c, 2.5, -2.8 + bob, 6, 2.4); c.fill();
  // Coat texture: Enzo's wavy darker bands, a few soft strokes on Dora.
  c.strokeStyle = k.texture; c.lineWidth = k.bands ? 0.7 : 0.5; c.beginPath();
  const bands = k.bands ? [[-9, -13], [-5.5, -15], [-2, -15.6], [1.5, -15], [-7, -8], [-3.5, -10]] : [[-7, -11], [-3, -14], [-8, -6]];
  for (const [bx, by] of bands) { c.moveTo(bx, by + bob); c.quadraticCurveTo(bx + 1.6, by + 2 + bob, bx + 0.4, by + 4 + bob); c.quadraticCurveTo(bx - 0.8, by + 5.5 + bob, bx + 0.6, by + 7 + bob); }
  c.stroke();
  if (k.bands) { c.fillStyle = 'rgba(160, 158, 170, 0.35)'; for (const [mx, my] of [[-6, -11], [-1, -12], [-4, -6], [2, -9]]) { ellipse(c, mx, my + bob, 1.4, 0.8); c.fill(); } }
  if (o.bib) {
    // A team vest over the middle of the body, with the number on the side.
    c.save();
    ellipse(c, -1.5, -8.5 + bob, 10, 7.8); c.clip();
    c.fillStyle = o.bib.color; c.fillRect(-6.5, -18 + bob, 11, 18);
    c.fillStyle = o.bib.trim; c.fillRect(-6.5, -18 + bob, 1.2, 18); c.fillRect(3.3, -18 + bob, 1.2, 18);
    if (o.bib.label) { c.fillStyle = o.bib.trim; c.font = 'bold 7px Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.translate(-1, -8 + bob); c.scale(o.face, 1); c.fillText(o.bib.label, 0, 0.5); }
    c.restore();
  }
  c.restore();

  // Near hind foot with long toes, and a front leg and paw.
  blob([oval(hindX, -1.4, 4.2, 1.5, air ? 0.5 : 0)], k.foot, k.line, 1.2);
  c.strokeStyle = k.toe; c.lineWidth = 0.4; c.beginPath();
  for (let i = 0; i < 3; i++) { const tx = hindX + 2 + i * 0.9; c.moveTo(tx, -2.4); c.lineTo(tx + 0.6, -0.5); }
  c.stroke();
  const pawY = air ? -6 : -1.2;
  blob([oval(frontX - 0.6, pawY - 2.4 + bob * 0.5, 1.5, 2.6, air ? -1 : 0), oval(frontX, pawY, 2.1, 1.2)], k.paleLegs ? k.belly : k.fur, k.line, 1.1);
  c.fillStyle = k.foot; ellipse(c, frontX + 0.6, pawY, 1.4, 0.9); c.fill();
  c.strokeStyle = k.toe; c.lineWidth = 0.35; c.beginPath();
  for (let i = 0; i < 3; i++) { c.moveTo(frontX + 0.6 + i * 0.6, pawY - 0.6); c.lineTo(frontX + 1 + i * 0.6, pawY + 0.8); }
  c.stroke();

  // Near ear: big and round, with a pink inside and fine veins.
  blob([ear(6.2, -22.6, 4.6, 5.6, 0.12)], k.ear, k.earLine, 1.4);
  c.fillStyle = k.earIn; ellipse(c, 6.5 + sweep * 2.5, -22.3 + bob, 3, 4.1, 0.12 + sweep); c.fill();
  c.strokeStyle = k.vein; c.lineWidth = 0.35; c.beginPath();
  const ex = 6.3 + sweep * 2.5;
  c.moveTo(ex, -18.5 + bob); c.quadraticCurveTo(ex + 1, -22 + bob, ex + sweep * 3 + 0.2, -25.5 + bob);
  c.moveTo(ex + 0.4, -21 + bob); c.lineTo(ex + 2 + sweep, -23 + bob);
  c.stroke();
  if (k.earGlow) { c.fillStyle = 'rgba(255,255,255,0.35)'; ellipse(c, ex - 2.3, -23.5 + bob, 0.9, 2.6, 0.2 + sweep); c.fill(); }

  // Face.
  const eyeX = 8.7, eyeY = -14.4 + bob;
  if (o.dizzy) {
    line(c, [eyeX - 1.4, eyeY - 1.4, eyeX + 1.4, eyeY + 1.4], '#16121a', 0.7);
    line(c, [eyeX + 1.4, eyeY - 1.4, eyeX - 1.4, eyeY + 1.4], '#16121a', 0.7);
  } else if (o.blink) {
    c.strokeStyle = k.line; c.lineWidth = 0.7; c.beginPath(); c.arc(eyeX, eyeY - 0.6, 1.6, 0.3, Math.PI - 0.3); c.stroke();
  } else {
    c.fillStyle = k.eye; ellipse(c, eyeX, eyeY, k.eyeR, k.eyeR * 1.09); c.fill();
    c.fillStyle = k.pupil; ellipse(c, eyeX + 0.2, eyeY + 0.1, 1, 1.2); c.fill();
    dot(c, eyeX + 0.6, eyeY - 0.8, k.eyeR * 0.33, '#ffffff');
    dot(c, eyeX - 0.5, eyeY + 0.8, 0.25, 'rgba(255,255,255,0.8)');
  }
  c.fillStyle = k.blush; ellipse(c, 9.6, -11.2 + bob, 1.8, 1.1); c.fill();
  const twitch = moving || o.air ? 0 : Math.max(0, Math.sin(t * 7)) * 0.3;
  c.fillStyle = k.nose; ellipse(c, 13.7, -11.4 + bob - twitch, 1, 0.75, 0.3); c.fill();
  c.strokeStyle = k.line; c.lineWidth = 0.35; c.beginPath();
  c.moveTo(13.6, -10.6 + bob); c.lineTo(13.4, -9.8 + bob); c.quadraticCurveTo(12.8, -9.2 + bob, 12.2, -9.6 + bob); c.stroke();
  // Long fine whiskers fanning from the whisker pad and drooping down and back past the chin.
  whiskers(c, k, 12, -10.3 + bob, [[-0.18, 11], [0.05, 11.5], [0.28, 10.5], [0.5, 9.5], [0.75, 8], [1, 6.5]], whisk, moving, 1);

  o.decorate?.(c, bob);
  c.restore();
}

/**
 * A fan of whiskers from one root, each `[angle, length]` (angle 0 points straight ahead, positive droops down).
 * They curve down under their own weight, sway, and flare wider when running. A faint dark underline keeps the
 * white ones readable against a pale sky.
 */
function whiskers(c: CanvasRenderingContext2D, k: Coat, x: number, y: number, fan: [number, number][], sway: number, moving: boolean, alpha: number) {
  const spread = moving ? 1.25 : 1;
  c.save();
  c.globalAlpha = alpha; c.lineCap = 'round';
  for (const pass of [0, 1]) {
    for (const [i, [a0, len]] of fan.entries()) {
      const a = a0 * spread + sway * 0.04 * (i + 1), jx = -(i % 3) * 0.5 - i * 0.12, jy = i * 0.28;
      const dx = Math.cos(a), dy = Math.sin(a);
      const ex = x + jx + dx * len, ey = y + jy + dy * len + len * 0.2 + sway * 0.3;
      c.strokeStyle = pass ? (i % 3 === 1 ? k.whiskerAlt : k.whisker) : 'rgba(40, 30, 45, 0.22)';
      c.lineWidth = pass ? 0.28 : 0.55;
      c.beginPath(); c.moveTo(x + jx, y + jy); c.quadraticCurveTo(x + jx + dx * len * 0.6, y + jy + dy * len * 0.6 - len * 0.04, ex, ey); c.stroke();
    }
  }
  c.restore();
}

/**
 * The tail: a big plume that sweeps back from the rump, rises about as high as the ears and curls forward over the
 * back, laid out as circles along a cubic curve, with a smooth edge and fur combed toward the tip. Dora's is smooth and
 * white with a cream inner curve; Enzo's is grey, darker along the outside and paler inside, with fine streaks.
 */
function tail(c: CanvasRenderingContext2D, k: Coat, t: number, bob: number, moving: boolean, air: boolean) {
  const wag = Math.sin(t * (moving ? 9 : 2.2)) * (moving ? 1.2 : 0.7);
  // Rest pose, streaming back when running, lifted in the air.
  const ctrl = moving ? [[-10, -4.5], [-22, -5], [-29, -20], [-20, -25]]
    : air ? [[-10, -4.5], [-21, -6], [-26, -28], [-14, -26]]
    : [[-10, -4.5], [-21, -4], [-23, -27], [-11.5, -22]];
  ctrl[2][0] += wag * 0.8; ctrl[3][0] += wag; ctrl[3][1] += wag * 0.4;
  const n = 22, pts: [number, number, number, number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n, a = (1 - u) ** 3, b = 3 * u * (1 - u) ** 2, d = 3 * u * u * (1 - u), e = u ** 3;
    const px = a * ctrl[0][0] + b * ctrl[1][0] + d * ctrl[2][0] + e * ctrl[3][0];
    const py = a * ctrl[0][1] + b * ctrl[1][1] + d * ctrl[2][1] + e * ctrl[3][1] + bob;
    // Tangent, for the normal; (nx, ny) points into the curl, toward the body.
    const tx = 3 * (1 - u) ** 2 * (ctrl[1][0] - ctrl[0][0]) + 6 * u * (1 - u) * (ctrl[2][0] - ctrl[1][0]) + 3 * u * u * (ctrl[3][0] - ctrl[2][0]);
    const ty = 3 * (1 - u) ** 2 * (ctrl[1][1] - ctrl[0][1]) + 6 * u * (1 - u) * (ctrl[2][1] - ctrl[1][1]) + 3 * u * u * (ctrl[3][1] - ctrl[2][1]);
    const len = Math.hypot(tx, ty) || 1;
    const r = (k.streaks ? 2.3 : 2.2) + (k.streaks ? 2.7 : 2.4) * Math.sin(Math.PI * (0.08 + 0.8 * u));
    pts.push([px, py, r, -ty / len, tx / len]);
  }
  // A soft halo of loose fur, then the outline and the fill.
  c.fillStyle = k.streaks ? 'rgba(120, 118, 130, 0.3)' : 'rgba(255, 255, 255, 0.45)';
  for (const [px, py, r] of pts) { ellipse(c, px, py, r + 1.1, r + 1.1); c.fill(); }
  // A lighter outline than the body's, so the plume reads as soft.
  c.lineWidth = 1.1; c.strokeStyle = k.tailLine;
  for (const [px, py, r] of pts) { ellipse(c, px, py, r, r); c.stroke(); }
  c.fillStyle = k.tail;
  for (const [px, py, r] of pts) { ellipse(c, px, py, r, r); c.fill(); }
  // Shading: the outer edge (lit on Dora, darker on Enzo) and the inner curve, blended in softly.
  c.save();
  c.globalAlpha = 0.55; c.fillStyle = k.tailOuter;
  for (const [px, py, r, nx, ny] of pts.slice(1)) { ellipse(c, px - nx * r * 0.4, py - ny * r * 0.4, r * 0.55, r * 0.55); c.fill(); }
  c.globalAlpha = 0.45; c.fillStyle = k.tailInner;
  for (const [px, py, r, nx, ny] of pts.slice(2)) { ellipse(c, px + nx * r * 0.45, py + ny * r * 0.45, r * 0.5, r * 0.5); c.fill(); }
  // Long fur combed toward the tip.
  c.lineCap = 'round'; c.lineWidth = k.streaks ? 0.4 : 0.3; c.globalAlpha = k.streaks ? 0.75 : 0.6;
  for (const [i, [px, py, r, nx, ny]] of pts.entries()) {
    if (i < 2 || i > n - 3 || i % 3 === 2) continue;
    const tx = ny, ty = -nx, off = ((i * 7) % 5 - 2) / 2.5;
    c.strokeStyle = k.streaks ? (i % 2 ? k.tailOuter : k.tailInner) : k.tailInner;
    const sx = px + nx * r * off * 0.6, sy = py + ny * r * off * 0.6;
    c.beginPath(); c.moveTo(sx, sy); c.quadraticCurveTo(sx + tx * 1.5, sy + ty * 1.5, sx + tx * 3 + nx * off * 0.5, sy + ty * 3 + ny * off * 0.5); c.stroke();
  }
  c.restore();
}

