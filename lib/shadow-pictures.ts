// Shadowplay's finished pictures. When a scene comes alive its puppets glide into place, their shadows sharpen, and
// the picture is finished by hand over them: a cat's glowing eyes and whiskers, a peacock's eyed train, crest and legs,
// a dragon's head, horns, spikes and claws. Every stroke is tied to one puppet and drawn in that puppet's own
// outline units (before it is turned), so it moves with the puppet as the scene plays. `under` is painted into the
// lantern light behind the later puppets (the peacock's train, which their shadows then fall across); `over` is drawn
// on the paper on top of everything. Drawing only: no game rules here.
import type { V2 } from './shadow-game';

/** A pen tied to one puppet. Points are in its outline units; `r0` (in the `on` options) means "as it stands at that turn". */
export interface Pen {
  /** Seconds since the picture began to show. */
  t: number;
  fill(pts: V2[], color: string): void;
  line(pts: V2[], width: number, color: string): void;
  dot(x: number, y: number, r: number, color: string): void;
  oval(x: number, y: number, rx: number, ry: number, rot: number, color: string): void;
  /** The puppet's own outline, filled (a tint over its shadow). */
  self(color: string): void;
  /** A soft radial glow (for train colours and eyes). */
  glow(x: number, y: number, r: number, stops: [number, string][]): void;
  /** Limits what follows to a closed outline until `unclip`. */
  clip(pts: V2[]): void;
  unclip(): void;
}
export interface Kit {
  on(prop: number, draw: (p: Pen) => void, opts?: { r0?: number; each?: boolean }): void;
}
export interface Picture { under?: { after: number; draw: (k: Kit) => void }; over?: (k: Kit) => void }

const INK = '#1c0d08', LIGHT = '#fff1c8';
/** Points round an ellipse from a0 to a1 degrees (y down). */
function arc(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n: number): V2[] {
  const o: V2[] = [];
  for (let i = 0; i <= n; i++) { const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180; o.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]); }
  return o;
}
/** A cubic curve, start included. */
function bez(p0: V2, p1: V2, p2: V2, p3: V2, n = 12): V2[] {
  const o: V2[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    o.push([u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]]);
  }
  return o;
}
/** A tapering ribbon along a line (a horn, a claw, a leg). */
function taper(line: V2[], w0: number, w1: number): V2[] {
  const L: V2[] = [], R: V2[] = [], n = line.length;
  for (let i = 0; i < n; i++) {
    const a = line[Math.max(0, i - 1)], b = line[Math.min(n - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, w = (w0 + ((w1 - w0) * i) / Math.max(1, n - 1)) / 2;
    L.push([line[i][0] - (dy / l) * w, line[i][1] + (dx / l) * w]); R.push([line[i][0] + (dy / l) * w, line[i][1] - (dx / l) * w]);
  }
  return [...L, ...R.reverse()];
}

/** A cat's face on the upturned bellflower (drawn as it stands upside down, ears up): glowing eyes, a nose and whiskers. */
function catFace(p: Pen, o: { fierce?: boolean } = {}) {
  // the head's own crisp outline first, so the lace doesn't crowd the face
  p.self(INK);
  const blink = !o.fierce && p.t % 4.2 > 3.95;
  for (const s of [-1, 1]) {
    // whiskers, out past the cheeks
    for (const [y0, y1] of [[0.14, 0.04], [0.21, 0.22], [0.28, 0.4]]) p.line([[s * 0.36, y0], [s * 0.62, (y0 + y1) / 2 - 0.01], [s * 0.9, y1]], 0.022, INK);
    // the ears' pink insides
    p.fill([[s * 0.6, -0.57], [s * 0.42, -0.47], [s * 0.52, -0.43]], '#f2a5a0');
    // the eyes: almonds of light with slit pupils (or shut, now and then)
    if (blink) p.line([[s * 0.32, -0.06], [s * 0.21, -0.03], [s * 0.1, -0.06]], 0.03, LIGHT);
    else {
      p.oval(s * 0.21, -0.07, 0.12, o.fierce ? 0.06 : 0.085, s * (o.fierce ? 0.42 : 0.22), o.fierce ? '#ffcf3a' : '#ffe48a');
      p.oval(s * 0.21, -0.07, 0.024, o.fierce ? 0.055 : 0.07, 0, INK);
      p.dot(s * 0.24, -0.1, 0.014, '#fffbe8');
    }
    if (o.fierce) p.fill([[s * 0.36, -0.2], [s * 0.06, -0.13], [s * 0.08, -0.17], [s * 0.34, -0.25]], INK);
  }
  // nose and mouth
  p.fill([[-0.065, 0.14], [0.065, 0.14], [0, 0.21]], '#f4b3a6');
  p.line([[0, 0.21], [0, 0.26]], 0.02, LIGHT);
  p.line([[-0.1, 0.27], [-0.05, 0.3], [0, 0.26], [0.05, 0.3], [0.1, 0.27]], 0.02, LIGHT);
  if (o.fierce) {
    // two little horns between the ears, and a sharp tooth
    for (const s of [-1, 1]) p.fill(taper(bez([s * 0.24, -0.42], [s * 0.26, -0.62], [s * 0.36, -0.74], [s * 0.5, -0.82], 8), 0.14, 0.01), INK);
    p.fill([[0.05, 0.27], [0.11, 0.27], [0.08, 0.35]], LIGHT);
  }
}

/** The peacock's train: a great gold fan of eyed feathers behind the body, fringed with blue. */
function peacockTrain(p: Pen) {
  const H: V2 = [0, 0.95], R = 2.1, N = 15, a0 = 158, a1 = 382;
  const edge: V2[] = [];
  for (let i = 0; i <= N * 6; i++) {
    const a = a0 + ((a1 - a0) * i) / (N * 6), f = (i % 6) / 6, r = R * (0.955 + 0.045 * Math.sin(f * Math.PI));
    edge.push([H[0] + r * Math.cos((a * Math.PI) / 180), H[1] + r * Math.sin((a * Math.PI) / 180)]);
  }
  // the train runs down behind the body (whose shadow falls over it)
  const inner: V2[] = [[0.3, H[1] + 0.5], [-0.3, H[1] + 0.5]];
  const train = [...edge, ...inner];
  p.fill(train, '#3b2a0c');
  p.clip(train);
  p.glow(H[0], H[1], R, [[0, '#4a3a10'], [0.3, '#8a6a1a'], [0.62, '#d2a536'], [0.86, '#f0cf5c'], [0.93, '#3f87c2'], [1, '#2a5f9a']]);
  // the quills
  for (let i = 0; i < N; i++) {
    const a = ((a0 + ((a1 - a0) * (i + 0.5)) / N) * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
    p.line([[H[0] + c * 0.4, H[1] + s * 0.3], [H[0] + c * (R - 0.32), H[1] + s * (R - 0.32)]], 0.022, 'rgba(70,46,8,0.75)');
  }
  // two rows of eyes: gold, teal and deep blue
  const eye = (r: number, a: number, k: number) => {
    const c = Math.cos(a), s = Math.sin(a), x = H[0] + c * r, y = H[1] + s * r;
    p.oval(x, y, 0.19 * k, 0.15 * k, a, '#f7d25e');
    p.oval(x, y, 0.14 * k, 0.11 * k, a, '#1e9a92');
    p.oval(x - c * 0.015, y - s * 0.015, 0.085 * k, 0.07 * k, a, '#1a2a74');
    p.dot(x - c * 0.04, y - s * 0.04, 0.02 * k, '#bfe6ff');
  };
  for (let i = 0; i < N; i++) eye(R - 0.33, ((a0 + ((a1 - a0) * (i + 0.5)) / N) * Math.PI) / 180, 1);
  for (let i = 0; i < N - 4; i++) eye(R - 0.95, ((a0 + 14 + ((a1 - a0 - 28) * (i + 0.5)) / (N - 4)) * Math.PI) / 180, 0.8);
  p.unclip();
  p.line([...edge], 0.03, 'rgba(40,24,6,0.8)');
}

/** The peacock's head on the feather's tip: an eye, a beak and a crest of three plumes; and a blue neck. */
function peacockHead(p: Pen) {
  p.self('rgba(40,90,200,0.6)');
  p.dot(-0.05, -0.92, 0.16, INK);
  p.fill([[0.06, -1.0], [0.3, -0.93], [0.06, -0.86]], INK);
  for (const [x, y] of [[-0.26, -1.42], [-0.06, -1.48], [0.14, -1.42]] as V2[]) {
    p.line([[-0.05, -1.04], [x * 0.6 - 0.02, (y - 1.04) / 2 - 0.02], [x, y]], 0.022, INK);
    p.dot(x, y, 0.055, INK); p.dot(x, y, 0.028, '#3f8fe0');
  }
  p.oval(0.0, -0.95, 0.075, 0.03, 0.15, LIGHT);
  p.dot(0.0, -0.95, 0.032, INK);
  p.dot(0.008, -0.958, 0.01, '#fffbe8');
}
/** Legs and toes under the pear, standing on the grass; and the body's blue. */
function peacockLegs(p: Pen) {
  p.self('rgba(30,70,170,0.5)');
  for (const s of [-1, 1]) {
    p.line([[s * 0.16, 0.7], [s * 0.2, 1.05], [s * 0.17, 1.38]], 0.05, INK);
    for (const d of [-0.12, 0, 0.12]) p.line([[s * 0.17, 1.37], [s * 0.17 + d + s * 0.06, 1.46]], 0.03, INK);
  }
}

/** The dragon's head over the scissors (the blades are its open jaws): skull, horns, frill, eye, teeth and nostril. */
function dragonHead(p: Pen) {
  // the skull over the handles, the snout's upper and lower jaws along the blades
  p.fill([[-1.08, -0.18], [-0.98, -0.58], [-0.62, -0.8], [-0.18, -0.74], [0.2, -0.5], [0.95, -0.66], [1.6, -0.8], [1.72, -0.66], [1.0, -0.38], [0.28, -0.12], [0.2, 0.06], [0.95, 0.3], [1.62, 0.56], [1.6, 0.68], [0.9, 0.5], [0.2, 0.45], [-0.32, 0.72], [-0.82, 0.62], [-1.08, 0.3]], INK);
  // teeth along both jaws
  for (const t of [0.25, 0.45, 0.65, 0.85]) {
    const x = 0.3 + t * 1.3, y = -0.12 - t * 0.52, y2 = 0.08 + t * 0.48;
    p.fill([[x - 0.06, y + 0.02], [x + 0.06, y - 0.02], [x + 0.01, y + 0.13]], LIGHT);
    p.fill([[x - 0.06, y2 + 0.03], [x + 0.06, y2 + 0.06], [x - 0.01, y2 - 0.1]], LIGHT);
  }
  // horns sweeping back, and the frill of spikes behind the jaw
  p.fill(taper(bez([-0.55, -0.74], [-0.9, -1.0], [-1.25, -1.05], [-1.6, -1.32], 10), 0.22, 0.01), INK);
  p.fill(taper(bez([-0.25, -0.72], [-0.45, -1.05], [-0.75, -1.2], [-1.05, -1.5], 10), 0.18, 0.01), INK);
  for (const [y, l] of [[-0.25, 0.32], [0.05, 0.38], [0.35, 0.3]] as [number, number][]) p.fill([[-1.0, y - 0.11], [-1.0 - l, y + 0.04], [-1.0, y + 0.12]], INK);
  // the eye: a fierce gold almond with a slit, under a heavy brow
  const blink = p.t % 5 > 4.82;
  if (blink) p.line([[-0.72, -0.4], [-0.5, -0.36], [-0.3, -0.42]], 0.04, '#ffcf3a');
  else {
    p.oval(-0.5, -0.38, 0.17, 0.095, -0.18, '#ffcf3a');
    p.oval(-0.5, -0.38, 0.03, 0.085, 0, INK);
    p.dot(-0.46, -0.42, 0.018, '#fffbe8');
  }
  p.fill([[-0.78, -0.55], [-0.2, -0.58], [-0.25, -0.5], [-0.74, -0.47]], INK);
  // a nostril and the line of the cheek
  p.oval(1.35, -0.6, 0.06, 0.03, -0.4, '#ff8a3a');
  p.line([[-0.6, 0.12], [-0.25, 0.2], [0.1, 0.12]], 0.03, 'rgba(255,220,150,0.7)');
}
/** Spikes along the dragon's back (the pie crust's waves) and two clawed legs beneath. */
function dragonBody(p: Pen) {
  for (const [x, y, h] of [[-1.78, -0.32, 0.2], [-1.4, -0.55, 0.28], [-0.74, -0.32, 0.2], [-0.37, -0.55, 0.28], [0.29, -0.32, 0.2], [0.66, -0.55, 0.28], [1.32, -0.32, 0.2], [1.69, -0.55, 0.28]] as [number, number, number][]) p.fill([[x - 0.1, y + 0.06], [x - 0.08 - h * 0.35, y - h], [x + 0.1, y - 0.02]], INK);
  for (const x of [-1.25, 1.15]) {
    p.fill(taper(bez([x, 0.25], [x + 0.05, 0.45], [x + 0.18, 0.55], [x + 0.12, 0.72], 8), 0.2, 0.12), INK);
    for (const d of [-0.1, 0.02, 0.14]) p.fill(taper([[x + 0.12 + d * 0.6, 0.72], [x + 0.14 + d, 0.82], [x + 0.2 + d * 1.2, 0.86]], 0.07, 0.01), INK);
  }
  // pale belly scales
  for (let i = 0; i < 9; i++) { const x = -1.9 + i * 0.47; p.line(arc(x, 0.18, 0.13, 0.08, 20, 160, 6), 0.025, 'rgba(255,224,160,0.75)'); }
}
/** A spade tip on the curl of the dragon's tail. */
function dragonTail(p: Pen) {
  p.fill([[0.3, -0.12], [0.66, -0.12], [0.7, 0.04], [0.48, 0.34], [0.26, 0.04]], INK);
  p.fill([[0.42, 0.0], [0.54, 0.0], [0.48, 0.16]], 'rgba(255,200,90,0.85)');
}
/** The wing's ribs, fanning from the shoulder to each point. */
function dragonWing(p: Pen) {
  for (const [x, y] of [[-1.21, 0.19], [-0.94, -0.53], [0, -0.95], [0.94, -0.53], [1.21, 0.19]] as V2[]) p.line([[0, 0.38], [x * 0.45, 0.38 + (y - 0.38) * 0.45], [x * 0.86, 0.38 + (y - 0.38) * 0.86]], 0.04, 'rgba(255,226,160,0.9)');
  p.dot(0, 0.38, 0.07, 'rgba(255,226,160,0.9)');
}
/** A hot gold heart in the ruby fire. */
function fireCore(p: Pen) {
  p.glow(0, 0.15, 0.36, [[0, 'rgba(255,250,210,0.95)'], [0.35, 'rgba(255,210,80,0.85)'], [1, 'rgba(255,140,40,0)']]);
}

const cat = (bell: number): Picture => ({ over: (k) => k.on(bell, (p) => catFace(p), { r0: 12 }) });
export const PICTURES: Record<string, Picture> = {
  's1-3': cat(1),
  's1-4': cat(1),
  's1-5': cat(3),
  's1-6': cat(4),
  's3-6': cat(6),
  's4-5': {
    under: { after: 0, draw: (k) => k.on(0, peacockTrain) },
    over: (k) => { k.on(1, peacockLegs); k.on(2, peacockHead); },
  },
  's5-5': { over: (k) => { k.on(1, (p) => catFace(p, { fierce: true }), { r0: 12 }); k.on(2, dragonWing); k.on(3, fireCore); } },
  's5-6': { over: (k) => { k.on(0, dragonBody); k.on(2, dragonTail); k.on(3, dragonWing); k.on(1, dragonHead); k.on(4, fireCore); } },
};
