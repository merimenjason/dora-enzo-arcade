// Storybook Dora and Enzo for Grumble Hunt: smooth toon shapes with a lumpy fluff silhouette
// instead of the shared model's line fur, so they sit in the same world as the beasts.
import * as T from 'three';

export type Arm = { shoulder: T.Vector3; rest: T.Vector3; limb: T.Mesh; paw: T.Group };
// arms[0] is the left (-z) arm, arms[1] the right (+z); +x is forward
export type HuntChinchilla = { root: T.Group; body: T.Group; head: T.Group; ears: T.Group[]; feet: T.Group[]; arms: Arm[]; tail: T.Group; blink: T.Object3D[] };

const ramp = new T.DataTexture(new Uint8Array([96, 178, 255]), 3, 1, T.RedFormat);
ramp.minFilter = ramp.magFilter = T.NearestFilter; ramp.generateMipmaps = false; ramp.needsUpdate = true;
const toon = (color: number, vc = false) => new T.MeshToonMaterial({ color, gradientMap: ramp, vertexColors: vc });
const flat = (color: number) => { const m = new T.MeshBasicMaterial({ color }); m.userData.outlineParameters = { visible: false }; return m; };

// A sphere pushed out into soft tufts, coloured from back (top) to belly (bottom).
function fluffBall(r: [number, number, number], lump: number, seed: number, top: T.Color, belly: T.Color, bellyFrom = -0.1) {
  const geo = new T.IcosahedronGeometry(1, 5), pos = geo.getAttribute('position'), col: number[] = [], nrm: number[] = [], v = new T.Vector3(), n2 = new T.Vector3(), c = new T.Color();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    const n = Math.sin(v.x * 9 + seed) * Math.sin(v.y * 8 - seed * 0.7) * Math.sin(v.z * 9 + seed * 1.3);
    const k = 1 + lump * Math.max(0, n) * 1.6 - lump * 0.3;
    pos.setXYZ(i, v.x * r[0] * k, v.y * r[1] * k, v.z * r[2] * k);
    // shade as the smooth ellipsoid so the toon bands stay clean; only the outline is tufted
    n2.set(v.x / r[0], v.y / r[1], v.z / r[2]).normalize(); nrm.push(n2.x, n2.y, n2.z);
    const t = T.MathUtils.smoothstep(-v.y + v.x * 0.35, bellyFrom, bellyFrom + 0.45);
    c.copy(top).lerp(belly, t); col.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new T.Float32BufferAttribute(col, 3)); geo.setAttribute('normal', new T.Float32BufferAttribute(nrm, 3));
  return geo;
}

export function createHuntChinchilla(white: boolean): HuntChinchilla {
  // Dora: cream white with pink ears and ruby eyes. Enzo: standard grey, darker saddle, pale belly.
  const back = new T.Color(white ? 0xf4eee4 : 0x6f6e78), belly = new T.Color(white ? 0xfffaf2 : 0xe4e0dc);
  const coat = toon(0xffffff, true), plain = toon(white ? 0xf4eee4 : 0x7a7983);
  const earSkin = toon(white ? 0xf2b3a6 : 0xb79a9c), pad = toon(white ? 0xf0b5aa : 0xa98f92), nose = toon(white ? 0xe08e8e : 0x4c3c44);
  const root = new T.Group(), body = new T.Group(), head = new T.Group(), tail = new T.Group();
  root.add(body); const ears: T.Group[] = [], feet: T.Group[] = [], arms: Arm[] = [], blink: T.Object3D[] = [];
  const add = (p: T.Object3D, g: T.BufferGeometry, m: T.Material, x: number, y: number, z: number) => { const o = new T.Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; p.add(o); return o; };

  // pear-shaped body, sitting up a little
  add(body, fluffBall([0.56, 0.52, 0.5], 0.05, 1, back, belly), coat, -0.06, 0.52, 0);
  // big chibi head (+x is forward)
  head.position.set(0.34, 1.0, 0); body.add(head);
  add(head, fluffBall([0.46, 0.42, 0.46], 0.045, 4, back, belly, 0.05), coat, 0, 0, 0);
  // cheek fluff: two tufted puffs either side of the muzzle
  for (const s of [-1, 1]) add(head, fluffBall([0.17, 0.15, 0.17], 0.09, 7 + s, belly, belly), coat, 0.3, -0.13, s * 0.2);
  add(head, new T.SphereGeometry(0.075, 16, 12), nose, 0.47, -0.06, 0).scale.set(0.8, 0.7, 1);
  // mouth: a tiny dark "w" smile under the nose
  const mouth = new T.Mesh(new T.TorusGeometry(0.035, 0.01, 6, 12, Math.PI), flat(0x3a2a2e));
  for (const s of [-1, 1]) { const m = mouth.clone(); m.position.set(0.46, -0.14, s * 0.034); m.rotation.set(0, Math.PI / 2, Math.PI); head.add(m); }

  // eyes: big glossy ovals with two highlights, set wide so they read from a three-quarter camera
  const iris = toon(white ? 0x6e0f26 : 0x1a1418), shine = flat(0xffffff);
  for (const s of [-1, 1]) {
    const eye = new T.Group(); eye.position.set(0.31, 0.06, s * 0.27); eye.rotation.y = s * -0.62; head.add(eye);
    add(eye, new T.SphereGeometry(0.12, 20, 16), iris, 0, 0, 0).scale.set(0.55, 1, 0.82);
    add(eye, new T.SphereGeometry(0.034, 10, 8), shine, 0.055, 0.045, -s * 0.02);
    add(eye, new T.SphereGeometry(0.016, 8, 6), shine, 0.06, -0.035, s * 0.02);
    blink.push(eye);
    // whiskers
    const wm = new T.LineBasicMaterial({ color: white ? 0xc8beb0 : 0x2e2a30 });
    for (let j = 0; j < 3; j++) {
      const a = new T.Vector3(0.44, -0.1, s * 0.12), b = new T.Vector3(0.62, -0.02 - j * 0.07, s * (0.42 + j * 0.05)), m = a.clone().lerp(b, 0.5); m.y += 0.03;
      head.add(new T.Line(new T.BufferGeometry().setFromPoints(new T.QuadraticBezierCurve3(a, m, b).getPoints(8)), wm));
    }
    // ears: huge round dishes, the chinchilla's signature
    const ear = new T.Group(); ear.position.set(-0.1, 0.26, s * 0.27); ear.rotation.set(s * 0.42, s * 0.4, 0.1); head.add(ear);
    const dish = new T.SphereGeometry(1, 24, 16);
    add(ear, dish, plain, 0, 0.27, 0).scale.set(0.3, 0.3, 0.075);
    add(ear, dish, earSkin, 0.03, 0.28, s * 0.04).scale.set(0.24, 0.24, 0.045);
    ears.push(ear);
    // hind feet: long and flat, so they can stand up on them while the front paws hold a weapon
    const f = new T.Group(); f.position.set(-0.22, 0.05, s * 0.3); body.add(f);
    add(f, new T.SphereGeometry(1, 14, 10), plain, 0, 0.04, 0).scale.set(0.19, 0.085, 0.12);
    add(f, new T.SphereGeometry(1, 12, 8), pad, 0.15, 0.0, 0).scale.set(0.08, 0.035, 0.08);
    feet.push(f);
    // front arms: a short furry limb from the shoulder to a round paw with a pink palm; poseArms
    // aims each one at a grip point every frame, so the paws stay on whatever they hold
    const limb = add(body, new T.CylinderGeometry(0.068, 0.075, 1, 12), plain, 0, 0, 0);
    const paw = new T.Group(); body.add(paw);
    add(paw, new T.SphereGeometry(0.088, 16, 12), plain, 0, 0, 0);
    add(paw, new T.SphereGeometry(0.05, 12, 8), pad, 0.04, -0.03, 0).scale.set(1, 0.6, 1.2);
    arms.push({ shoulder: V(0.3, 0.64, s * 0.2), rest: V(0.46, 0.42, s * 0.2), limb, paw });
  }
  // bushy tail curling up the back: one continuous plume, fullest past the middle, tufted along
  // its edge and tapering to a soft tip; Enzo's darkens to a sooty tip
  body.add(tail); tail.position.set(-0.48, 0.3, 0);
  const curve = new T.CatmullRomCurve3([V(0, 0, 0), V(-0.3, 0.1, 0), V(-0.46, 0.42, 0), V(-0.36, 0.72, 0), V(-0.12, 0.8, 0)]);
  const tip = new T.Color(white ? 0xf8f2ea : 0x3a3940), TS = 64, RS = 20;
  const tube = new T.TubeGeometry(curve, TS, 1, RS, false), tp = tube.getAttribute('position'), tn = tube.getAttribute('normal');
  const tcol: number[] = [], c = new T.Color(), dir = new T.Vector3();
  for (let i = 0; i <= TS; i++) {
    const t = i / TS, centre = curve.getPointAt(t);
    const r = (0.075 + 0.105 * Math.sin(Math.min(t * 1.15, 1) * Math.PI * 0.9)) * (1 - T.MathUtils.smoothstep(t, 0.82, 1) * 0.92);
    for (let j = 0; j <= RS; j++) {
      const k = i * (RS + 1) + j; dir.fromBufferAttribute(tn, k);
      const a = (j / RS) * Math.PI * 2, tuft = 1 + 0.045 * Math.sin(a * 3 + t * 9) * Math.sin(t * Math.PI);
      tp.setXYZ(k, centre.x + dir.x * r * tuft, centre.y + dir.y * r * tuft, centre.z + dir.z * r * tuft * 0.9);
      c.copy(back).lerp(tip, T.MathUtils.smoothstep(t, 0.45, 1)); tcol.push(c.r, c.g, c.b);
    }
  }
  tube.setAttribute('color', new T.Float32BufferAttribute(tcol, 3));
  // a softer, thinner ink line so the plume against the same-coloured back does not read as stripes
  const tailCoat = coat.clone(); tailCoat.userData.outlineParameters = { thickness: 0.0025, color: white ? [0.62, 0.56, 0.5] : [0.2, 0.19, 0.22] };
  add(tail, tube, tailCoat, 0, 0, 0);
  root.userData.white = white;
  const result = { root, body, head, ears, feet, arms, tail, blink }; poseArms(result); return result;
}
const V = (x: number, y: number, z: number) => new T.Vector3(x, y, z);

export function animateHuntChinchilla(p: HuntChinchilla, time: number, speed: number, ground: boolean) {
  const moving = Math.abs(speed) > 0.05, hop = Math.sin(time * 13);
  p.body.position.y = moving && ground ? Math.abs(hop) * 0.09 : Math.sin(time * 2) * 0.012;
  const sq = moving && ground ? 1 + (Math.abs(hop) - 0.5) * 0.08 : 1 + Math.sin(time * 2) * 0.012;
  p.body.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
  p.body.rotation.z = !ground ? -0.08 : moving ? hop * 0.04 : 0;
  p.head.rotation.z = Math.sin(time * 1.1) * 0.03;
  p.tail.rotation.z = (moving ? Math.sin(time * 9) : Math.sin(time * 1.7)) * 0.08;
  p.ears.forEach((e, i) => (e.rotation.z = 0.1 + Math.sin(time * 1.3 + i) * 0.04 + (moving ? hop * 0.06 : 0)));
  p.feet.forEach((f, i) => (f.position.y = 0.05 + (moving && ground ? Math.max(0, Math.sin(time * 13 + (i % 2) * Math.PI)) * 0.08 : 0)));
  const shut = (time % 3.7) > 3.58; // never at time 0, so a still (reduced-motion) pose has open eyes
  p.blink.forEach((e) => (e.scale.y = shut ? 0.12 : 1));
}

// Aim each arm from its shoulder at a grip point in body space (null leaves that paw at rest).
// `weight` blends a paw between rest and its grip, for letting go or taking hold mid-move.
const up = new T.Vector3(0, 1, 0), d = new T.Vector3();
export function poseArms(p: HuntChinchilla, left: T.Vector3 | null = null, right: T.Vector3 | null = null, weight: [number, number] = [1, 1]) {
  p.arms.forEach((a, i) => {
    const grip = i === 0 ? left : right, w = grip ? weight[i] : 0;
    p.arms[i].paw.position.copy(a.rest).lerp(grip ?? a.rest, w);
    d.copy(a.paw.position).sub(a.shoulder);
    a.limb.position.copy(a.shoulder).addScaledVector(d, 0.5);
    a.limb.scale.y = Math.max(0.01, d.length());
    a.limb.quaternion.setFromUnitVectors(up, d.normalize());
  });
}
