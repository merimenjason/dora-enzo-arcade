// The four village folk from public/art/hunt/ref-villagers.webp, built from soft toon primitives.
// Each villager bakes its primitives into a few merged, vertex-coloured meshes (body, head, face details,
// eyes and one or two moving limbs), so a whole character costs about a dozen draw calls with its outline
// and shadow, while still carrying hundreds of spikes, moss tufts, flowers and speckles.
import * as T from 'three';

export type VillagerId = 'mossback' | 'bramble' | 'pip' | 'wren';
/** What the scene lends each villager: its shared toon ramp and the sets it disposes. */
export type VillagerKit = { ramp: T.Texture; materials: Set<T.Material>; geometries: Set<T.BufferGeometry> };
export type VillagerRig = { root: T.Group; animate: (time: number, near: boolean, reduced: boolean) => void };

type Vec = [number, number, number];
type Paint = T.ColorRepresentation | ((v: T.Vector3) => T.Color);
type Parts = T.BufferGeometry[];
const V = (x: number, y: number, z: number) => new T.Vector3(x, y, z);
const UP = V(0, 1, 0), FWD = V(0, 0, 1), M4 = new T.Matrix4(), Q = new T.Quaternion(), E = new T.Euler(), P = new T.Vector3(), S = new T.Vector3(), W = new T.Vector3(), tint = new T.Color();
const smooth = T.MathUtils.smoothstep;

// Shared primitives: only ever baked into merged geometry, never drawn themselves.
const SPH = new T.SphereGeometry(1, 18, 12), DOT = new T.SphereGeometry(1, 8, 6), BIT = new T.SphereGeometry(1, 6, 4), LEAF = new T.SphereGeometry(1, 8, 6), CYL = new T.CylinderGeometry(1, 1, 1, 12), CONE = new T.ConeGeometry(1, 1, 10);
const HI = new T.IcosahedronGeometry(1, 7), FINE = new T.IcosahedronGeometry(1, 12);
// A soft spike: a rounded cone, fat at the base and blunt at the tip, so Bramble's coat looks plush, not sharp.
const SPIKE = new T.LatheGeometry([[0, -0.15], [1, 0], [0.8, 0.45], [0.42, 0.82], [0.12, 0.98], [0, 1.02]].map(([x, y]) => new T.Vector2(x, y)), 6);

/** Paints a primitive (a flat colour, or a function of its own unscaled vertex) and places it into a part list. */
function bake(list: Parts, src: T.BufferGeometry, paint: Paint, at: Vec | T.Vector3 = [0, 0, 0], s: number | Vec = 1, r: Vec | T.Quaternion = [0, 0, 0]) {
  const g = src.index ? src.toNonIndexed() : src.clone(), pos = g.getAttribute('position'), col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) { if (typeof paint === 'function') tint.copy(paint(W.fromBufferAttribute(pos, i))); else tint.set(paint); col.set([tint.r, tint.g, tint.b], i * 3); }
  g.setAttribute('color', new T.BufferAttribute(col, 3));
  const q = r instanceof T.Quaternion ? r : Q.setFromEuler(E.set(r[0], r[1], r[2], 'XYZ'));
  g.applyMatrix4(M4.compose(Array.isArray(at) ? P.set(...at) : P.copy(at), q, typeof s === 'number' ? S.setScalar(s) : S.set(...s)));
  list.push(g); return g;
}
/** Concatenates baked parts into one geometry (positions, normals and colours). */
function merge(list: Parts) {
  const out = new T.BufferGeometry();
  for (const k of ['position', 'normal', 'color']) {
    const arr = new Float32Array(list.reduce((a, g) => a + g.getAttribute(k).array.length, 0)); let o = 0;
    for (const g of list) { arr.set(g.getAttribute(k).array as Float32Array, o); o += g.getAttribute(k).array.length; g.dispose(); }
    out.setAttribute(k, new T.BufferAttribute(arr, 3));
  }
  out.computeBoundingSphere(); return out;
}
/** A unit sphere pushed out into soft lumps; the normals stay the smooth sphere's so the toon bands stay clean. */
function lumpy(lump: number, seed: number, detail = 2) {
  const g = new T.IcosahedronGeometry(1, detail), pos = g.getAttribute('position'), v = new T.Vector3(), nrm: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize(); nrm.push(v.x, v.y, v.z);
    const n = Math.sin(v.x * 9 + seed) * Math.sin(v.y * 8 - seed * 0.7) * Math.sin(v.z * 9 + seed * 1.3);
    v.multiplyScalar(1 + lump * Math.max(0, n) * 1.6 - lump * 0.3); pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.setAttribute('normal', new T.Float32BufferAttribute(nrm, 3)); return g;
}
/** Back-to-belly colouring: `top` over the back, fading to `belly` low down and towards the front (+z). */
const grad = (top: number, belly: number, from = -0.1, fwd = 0.45) => { const a = new T.Color(top), b = new T.Color(belly); return (v: T.Vector3) => tint.copy(a).lerp(b, smooth(-v.y + v.z * fwd, from, from + 0.45)); };
const mix = (a: number, b: number, t: number) => tint.set(a).lerp(new T.Color(b), t);
/** The point on an ellipsoid (centre c, radii r) in the direction yaw (0 = +z, + towards +x) and pitch, and its normal. */
function surf(c: Vec, r: Vec, yaw: number, pitch: number, out = 0) {
  const d = V(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)), p = d.multiplyScalar(1 / Math.hypot(d.x / r[0], d.y / r[1], d.z / r[2]));
  const n = V(p.x / r[0] ** 2, p.y / r[1] ** 2, p.z / r[2] ** 2).normalize();
  return { p: p.add(V(...c)).addScaledVector(n, out), n };
}
/** Turns a flat part's +z to face along n, spun about it. */
const facing = (n: T.Vector3, spin = 0) => new T.Quaternion().setFromUnitVectors(FWD, n.clone().normalize()).multiply(new T.Quaternion().setFromAxisAngle(FWD, spin));
const along = (d: T.Vector3) => new T.Quaternion().setFromUnitVectors(UP, d.clone().normalize());
/** A capsule from a to b. */
function limb(list: Parts, a: T.Vector3, b: T.Vector3, r: number, paint: Paint) { const d = b.clone().sub(a); bake(list, new T.CapsuleGeometry(r, d.length(), 4, 10), paint, a.clone().addScaledVector(d, 0.5), 1, along(d)); }
/** A rod (cylinder) from a to b. */
function rod(list: Parts, a: T.Vector3, b: T.Vector3, r: number, paint: Paint) { const d = b.clone().sub(a); bake(list, CYL, paint, a.clone().addScaledVector(d, 0.5), [r, d.length(), r], along(d)); }
/** A small seeded random generator, so every villager is built the same way each time. */
const rng = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
/** n evenly spread directions on the unit sphere. */
const fib = (n: number) => Array.from({ length: n }, (_, i) => { const y = 1 - (2 * (i + 0.5)) / n, r = Math.sqrt(1 - y * y), a = i * 2.39996; return V(Math.cos(a) * r, y, Math.sin(a) * r); });
/** A strap lying on an ellipsoid: a ribbon, `w` wide (in direction space), round the cut by the plane through c with normal n. */
function sash(list: Parts, c: Vec, r: Vec, n: T.Vector3, w: number, color: number, out = 0.012) {
  const u = n.clone().cross(Math.abs(n.y) < 0.9 ? UP : FWD).normalize(), v = n.clone().cross(u), pos: number[] = [], nrm: number[] = [], idx: number[] = [], N = 64;
  for (let i = 0; i <= N; i++) for (const s of [-1, 1]) {
    const a = (i / N) * Math.PI * 2, d = u.clone().multiplyScalar(Math.cos(a)).addScaledVector(v, Math.sin(a)).addScaledVector(n, s * w).normalize();
    const p = d.multiplyScalar(1 / Math.hypot(d.x / r[0], d.y / r[1], d.z / r[2])), m = V(p.x / r[0] ** 2, p.y / r[1] ** 2, p.z / r[2] ** 2).normalize();
    p.add(V(...c)).addScaledVector(m, out); pos.push(p.x, p.y, p.z); nrm.push(m.x, m.y, m.z);
    if (i < N && s > 0) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
  }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(nrm, 3)); g.setIndex(idx);
  bake(list, g, color);
}

/** The materials and mesh makers one villager is built with. */
function studio(kit: VillagerKit) {
  const toon = new T.MeshToonMaterial({ color: 0xffffff, gradientMap: kit.ramp, vertexColors: true }), flat = new T.MeshBasicMaterial({ vertexColors: true });
  flat.userData.outlineParameters = { visible: false };
  const lines = new T.LineBasicMaterial({ color: 0x4a3a30 }); kit.materials.add(toon); kit.materials.add(flat); kit.materials.add(lines);
  const mesh = (parent: T.Object3D, list: Parts, plain = false, shadow = !plain) => { const g = merge(list); kit.geometries.add(g); const m = new T.Mesh(g, plain ? flat : toon); m.castShadow = shadow; parent.add(m); return m; };
  const whiskers = (parent: T.Object3D, pts: T.Vector3[]) => { const g = new T.BufferGeometry().setFromPoints(pts); kit.geometries.add(g); parent.add(new T.LineSegments(g, lines)); };
  return { mesh, whiskers };
}
type Studio = ReturnType<typeof studio>;
const group = (parent: T.Object3D, x: number, y: number, z: number) => { const g = new T.Group(); g.position.set(x, y, z); parent.add(g); return g; };

/** Big glossy eyes set into a head ellipsoid, each with two white shines, as one mesh that blinks by squashing. */
function eyes(st: Studio, head: T.Group, c: Vec, r: Vec, yaw: number, pitch: number, size: number, iris = 0x23170f) {
  const list: Parts = [], y = surf(c, r, yaw, pitch).p.y, g = group(head, 0, y, 0);
  for (const s of [-1, 1]) {
    const { p, n } = surf(c, r, s * yaw, pitch, -size * 0.14); p.y -= y;
    const right = UP.clone().cross(n).normalize(), up = n.clone().cross(right), q = facing(n);
    bake(list, SPH, iris, p, [size * 0.78, size, size * 0.5], q);
    bake(list, DOT, 0xffffff, p.clone().addScaledVector(n, size * 0.4).addScaledVector(up, size * 0.4).addScaledVector(right, size * 0.26), [size * 0.3, size * 0.32, size * 0.12], q);
    bake(list, DOT, 0xffffff, p.clone().addScaledVector(n, size * 0.42).addScaledVector(up, -size * 0.38).addScaledVector(right, -size * 0.22), [size * 0.14, size * 0.14, size * 0.08], q);
  }
  st.mesh(g, list, true); return g;
}
/** Pink cheeks and a little smile, baked into a head's flat detail list. */
function cheeks(list: Parts, c: Vec, r: Vec, yaw: number, pitch: number, size: number, color = 0xf2a2a0) {
  for (const s of [-1, 1]) { const { p, n } = surf(c, r, s * yaw, pitch, 0.004); bake(list, DOT, color, p, [size, size * 0.62, size * 0.15], facing(n)); }
}
function smile(list: Parts, c: Vec, r: Vec, pitch: number, size: number, color = 0x3a2420) {
  const { p, n } = surf(c, r, 0, pitch, 0.006); bake(list, new T.TorusGeometry(1, 0.2, 5, 14, Math.PI), color, p, [size, size * 0.8, size], facing(n, Math.PI));
}
/** Three-point leaf: a flattened, pointed ellipsoid. */
function leaf(list: Parts, at: T.Vector3, size: number, dir: T.Vector3, color: number) { bake(list, LEAF, (v) => mix(color, 0x9cc65a, smooth(v.y, 0.2, 1) * 0.5), at, [size * 0.45, size, size * 0.14], along(dir)); }
/** A little white flower with a yellow heart, lying on a surface with normal n. */
function flower(list: Parts, at: T.Vector3, n: T.Vector3, size: number) {
  const q = facing(n), right = UP.clone().cross(n).normalize(); if (right.lengthSq() < 0.01) right.set(1, 0, 0);
  const up = n.clone().cross(right);
  for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; bake(list, BIT, 0xfffbf0, at.clone().addScaledVector(right, Math.cos(a) * size).addScaledVector(up, Math.sin(a) * size), [size * 0.75, size * 0.75, size * 0.3], q); }
  bake(list, DOT, 0xf2c23c, at.clone().addScaledVector(n, size * 0.2), size * 0.55);
}

type Life = { root: T.Group; body: T.Group; head: T.Group; eyes: T.Group; seed: number; wave?: T.Group; side?: number; tail?: T.Group; extra?: (t: number, lift: number, hello: number, still: number) => void };
/** Idle life shared by every villager: breathing, blinking and a slow look about. When the hero comes near they lean in
 * with a tilted head and greet with a hop and a wave, then wave again every few seconds while the hero stays. */
function life(p: Life): VillagerRig['animate'] {
  let last = 0, lift = 0, hello = 0, since = -1;
  const rest = { head: p.head.rotation.clone(), wave: p.wave?.rotation.clone(), tail: p.tail?.rotation.clone() };
  return (time, near, reduced) => {
    const dt = Math.min(0.1, Math.max(0, time - last)); last = time;
    lift = reduced ? 0 : lift + ((near ? 1 : 0) - lift) * Math.min(1, dt * 4);
    since = near ? (since < 0 || since > time ? time : since) : -1;
    hello = reduced ? 0 : hello + ((since >= 0 && (time - since) % 8 < 2.4 ? 1 : 0) - hello) * Math.min(1, dt * 5);
    const t = time + p.seed, still = reduced ? 0 : 1, br = Math.sin(t * 2.1) * 0.018 * still;
    p.root.position.y = Math.abs(Math.sin(t * 5)) * 0.05 * hello;
    p.body.scale.set(1 - br * 0.5, 1 + br, 1 - br * 0.5);
    p.head.rotation.set(rest.head.x + (Math.sin(t * 0.9) * 0.04 - lift * 0.06) * still, rest.head.y + Math.sin(t * 0.45) * 0.3 * still * (1 - lift * 0.6), rest.head.z + (Math.sin(t * 0.83) * 0.06 + lift * 0.12) * still);
    // A blink in the last moment of each period, so a still frame at time 0 always has open eyes.
    p.eyes.scale.y = !reduced && t % 4.2 > 4.06 ? 0.1 : 1;
    if (p.wave && rest.wave) p.wave.rotation.z = rest.wave.z + (p.side ?? 1) * (hello * (2.2 + Math.sin(t * 9) * 0.35) + Math.sin(t * 1.6) * 0.04 * still);
    if (p.tail && rest.tail) p.tail.rotation.y = rest.tail.y + Math.sin(t * (2 + lift * 5)) * (0.1 + lift * 0.1) * still;
    p.extra?.(t, lift, hello, still);
  };
}

/** Old Mossback: an upright old tortoise with a mossy, flowering shell, brass glasses, scarf and walking stick. */
function mossback(st: Studio): VillagerRig {
  const root = new T.Group(), body = group(root, 0, 0, 0), torso: Parts = [], dots: Parts = [], R = rng(7);
  const OLIVE = 0x88a24c, CREAM = 0xeedfac;
  for (const s of [-1, 1]) {
    bake(torso, SPH, OLIVE, [s * 0.27, 0.1, 0.08], [0.17, 0.12, 0.21]);
    for (let j = -1; j <= 1; j++) bake(torso, DOT, 0xf1e6c4, [s * 0.27 + j * 0.075, 0.07, 0.27], [0.04, 0.035, 0.035]);
    bake(torso, CYL, OLIVE, [s * 0.27, 0.24, 0.04], [0.13, 0.26, 0.13]);
  }
  // Domed shell: scutes found as the nearest of a few points, inked along the seams and paler at each centre.
  const seeds = fib(16), shellC: Vec = [0, 0.76, -0.16], shellR: Vec = [0.6, 0.6, 0.5];
  bake(torso, FINE, (v) => {
    const d = seeds.map((s, i) => [v.distanceTo(s), i]).sort((a, b) => a[0] - b[0]);
    if (v.y < -0.42) return mix(0xb88d55, 0x9c7445, smooth(v.y, -0.55, -0.42));
    if (d[1][0] - d[0][0] < 0.08) return tint.set(0x3e2a1c);
    return mix(d[0][1] % 2 ? 0x7a5634 : 0x86623c, 0xb48d58, 1 - smooth(d[0][0], 0.02, 0.32));
  }, shellC, shellR);
  bake(torso, CONE, OLIVE, [0, 0.3, -0.6], [0.07, 0.18, 0.06], [-Math.PI / 2 - 0.5, 0, 0]);
  // Cream plastron front with olive sides, and the satchel strap crossing it.
  bake(torso, HI, (v) => mix(OLIVE, CREAM, smooth(v.z, 0.3, 0.55)), [0, 0.6, 0.08], [0.43, 0.47, 0.36]);
  sash(torso, [0, 0.6, 0.08], [0.43, 0.47, 0.36], V(0.7, -0.7, 0.05).normalize(), 0.07, 0x7a4a2a);
  bake(torso, new T.BoxGeometry(0.2, 0.17, 0.09), 0x9a6034, [-0.36, 0.33, 0.24], 1, [0, -0.6, 0.1]);
  bake(torso, new T.BoxGeometry(0.21, 0.08, 0.1), 0x7a4826, [-0.355, 0.39, 0.25], 1, [0.15, -0.6, 0.1]);
  bake(torso, DOT, 0xd8ac4c, [-0.31, 0.37, 0.31], 0.022);
  // Moss on the shell, sprigs of leaves and little white flowers.
  for (let i = 0; i < 11; i++) {
    const yaw = Math.PI + (i - 5) * 0.42 + (R() - 0.5) * 0.3, pitch = 0.5 + R() * 0.75, { p } = surf(shellC, shellR, yaw, pitch, -0.03);
    bake(torso, lumpy(0.14, i), grad(0x9fc653, 0x5e8b36, -0.6, 0), p, [0.15 + R() * 0.06, 0.1 + R() * 0.04, 0.15 + R() * 0.06]);
  }
  for (let i = 0; i < 9; i++) {
    const { p, n } = surf(shellC, shellR, Math.PI + (R() - 0.5) * 3.2, 0.7 + R() * 0.6, 0.06);
    leaf(torso, p.clone().addScaledVector(n, 0.05), 0.07, n.clone().add(V((R() - 0.5) * 1.2, 0.3, (R() - 0.5) * 1.2)), R() > 0.5 ? 0x5e9a3a : 0x77ad44);
  }
  for (let i = 0; i < 7; i++) { const { p, n } = surf(shellC, shellR, Math.PI + (i - 3) * 0.55 + R() * 0.2, 0.75 + R() * 0.55, 0.1); flower(dots, p, n, 0.028); }
  // Neck, scarf with its knot and leaf clasp.
  bake(torso, CYL, OLIVE, [0, 1.0, 0.14], [0.13, 0.3, 0.13], [0.35, 0, 0]);
  bake(torso, new T.TorusGeometry(1, 0.4, 10, 24), grad(0x467a72, 0x335e58), [0, 0.98, 0.13], [0.19, 0.17, 0.19], [Math.PI / 2 + 0.3, 0, 0]);
  bake(torso, SPH, 0x3e7069, [0.03, 0.9, 0.33], [0.07, 0.06, 0.05]);
  for (const s of [-1, 1]) bake(torso, SPH, 0x3a6a63, [0.05 + s * 0.05, 0.78, 0.35], [0.055, 0.12, 0.03], [0.2, 0, s * 0.25]);
  leaf(torso, V(-0.02, 0.9, 0.39), 0.06, V(-0.6, -1, 0.3), 0x6aa040);
  // The stick arm and its gnarled walking stick.
  const hand = V(0.58, 0.68, 0.3);
  limb(torso, V(0.36, 0.86, 0.06), hand, 0.085, OLIVE); bake(torso, SPH, OLIVE, hand, 0.095);
  rod(torso, V(0.6, 0, 0.3), V(0.62, 1.42, 0.28), 0.035, 0x8a5a30);
  for (const y of [0.32, 0.98, 1.2]) bake(torso, DOT, 0x7a4c28, [0.6 + y * 0.014, y, 0.29], 0.048);
  bake(torso, SPH, 0x9a6838, [0.625, 1.45, 0.28], [0.075, 0.09, 0.075]);
  bake(torso, CYL, 0xd8ac4c, [0.62, 1.36, 0.28], [0.045, 0.04, 0.045]);
  leaf(torso, V(0.68, 1.42, 0.29), 0.07, V(1, 0.6, 0.2), 0x6aa040); leaf(torso, V(0.66, 1.36, 0.33), 0.06, V(0.8, -0.2, 0.8), 0x5e9a3a);
  st.mesh(body, torso); st.mesh(body, dots, true);
  // The free arm, which waves.
  const wave = group(body, -0.36, 0.86, 0.06), arm: Parts = [];
  limb(arm, V(0, 0, 0), V(-0.07, -0.3, 0.1), 0.085, OLIVE); bake(arm, SPH, OLIVE, [-0.075, -0.33, 0.11], 0.095);
  for (let j = -1; j <= 1; j++) bake(arm, DOT, 0xf1e6c4, [-0.075 + j * 0.04, -0.41, 0.15], 0.025);
  st.mesh(wave, arm); wave.rotation.z = -0.1;
  // Head: olive crown with darker spots, a pale jaw, round brass glasses and bushy white brows.
  const head = group(body, 0, 1.22, 0.22), skull: Parts = [], face: Parts = [], hc: Vec = [0, 0, 0], hr: Vec = [0.3, 0.26, 0.28];
  const skin = grad(0x8eaa50, 0xeadb98, -0.35, 0.55);
  bake(skull, HI, skin, hc, hr);
  for (const [yaw, pitch, k] of [[0.25, 0.85, 1], [-0.45, 0.75, 0.8], [0.9, 0.55, 0.7], [-1.0, 0.45, 0.9], [2.4, 0.6, 1]]) { const { p, n } = surf(hc, hr, yaw, pitch, 0.003); bake(face, DOT, 0x718e3e, p, [0.05 * k, 0.04 * k, 0.006], facing(n)); }
  const snC: Vec = [0, -0.08, 0.16], snR: Vec = [0.21, 0.13, 0.15];
  bake(skull, SPH, grad(0x96b058, 0xefe2a6, -0.4, 0.2), snC, snR);
  const ey = 0.4, ep = 0.12;
  for (const s of [-1, 1]) {
    const { p, n } = surf(hc, hr, s * ey, ep, 0.025), ring = new T.TorusGeometry(1, 0.13, 6, 22);
    bake(skull, ring, 0xd4a64a, p, 0.094, facing(n));
    const side = surf(hc, hr, s * 0.95, ep + 0.04, 0.008).p; rod(skull, p.clone().add(V(s * 0.085, 0, -0.02)), side, 0.009, 0xc0923e);
    bake(skull, lumpy(0.2, s + 3), 0xf6f1e2, surf(hc, hr, s * 0.42, 0.52, 0.01).p, [0.075, 0.035, 0.045], [0, 0, -s * 0.25]);
  }
  rod(skull, surf(hc, hr, -0.2, ep + 0.03, 0.03).p, surf(hc, hr, 0.2, ep + 0.03, 0.03).p, 0.011, 0xd4a64a);
  cheeks(face, hc, hr, 0.66, -0.12, 0.055); smile(face, snC, snR, -0.3, 0.06);
  st.mesh(head, skull); st.mesh(head, face, true);
  const eyeGroup = eyes(st, head, hc, hr, ey, ep, 0.074);
  root.userData.id = 'mossback';
  return { root, animate: life({ root, body, head, eyes: eyeGroup, seed: 0.6, wave, side: -1 }) };
}

/** Bramble: a round hedgehog smith with a back of soft spikes, green apron, gloves and a toy mallet. */
function bramble(st: Studio): VillagerRig {
  const root = new T.Group(), body = group(root, 0, 0, 0), torso: Parts = [], R = rng(11);
  const FUR = 0xead2a2, BACK = 0x6b4428, GLOVE = 0x7a4a2a, APRON = 0x4f7d66;
  const bc: Vec = [0, 0.6, 0], br: Vec = [0.46, 0.52, 0.4];
  for (const s of [-1, 1]) bake(torso, SPH, 0x6a4428, [s * 0.2, 0.06, 0.13], [0.13, 0.075, 0.18]);
  bake(torso, HI, (v) => mix(BACK, FUR, smooth(v.z + Math.max(0, -v.y) * 0.3, -0.15, 0.3)), bc, br);
  // Soft spikes over the back, sides and shoulders, swept back and down, pale at the tips.
  const spike = (list: Parts, c: Vec, r: Vec, d: T.Vector3, len: number) => {
    const yaw = Math.atan2(d.x, d.z), pitch = Math.asin(d.y), { p, n } = surf(c, r, yaw, pitch, -0.02);
    bake(list, SPIKE, (v) => mix(0x4e2f1a, 0xd3a36a, smooth(v.y, 0.35, 1)), p, [len * 0.26, len, len * 0.26], along(n.clone().add(V(0, -0.35, -0.55)).normalize()));
  };
  for (const d of fib(260)) if (d.z < 0.42 - Math.max(0, d.y) * 0.5 && d.y > -0.55) spike(torso, bc, br, d, 0.24 + R() * 0.08);
  // Green apron: skirt and bib, a darker pocket full of tools, straps over the shoulders.
  const panel = (list: Parts, r: Vec, p0: number, pl: number, t0: number, tl: number, color: number, k = 1.04) =>
    bake(list, new T.SphereGeometry(1, 24, 12, Math.PI / 2 - p0, pl, t0, tl), (v) => mix(color, 0x2f5243, smooth(v.y, -0.6, -0.95) * 0.6), bc, [r[0] * k, r[1] * k, r[2] * k]);
  panel(torso, br, 0.95, 1.9, 1.15, 1.25, APRON); panel(torso, br, 0.5, 1.0, 0.62, 0.6, APRON);
  panel(torso, br, 0.4, 0.8, 1.75, 0.42, 0x416b57, 1.07);
  for (const [x, c, h] of [[-0.09, 0xb7b9bf, 0.14], [0.0, 0xb07a45, 0.17], [0.08, 0x9aa0a8, 0.13]] as const) {
    const { p } = surf(bc, br, x * 2.2, -0.22, 0.05); rod(torso, p, p.clone().add(V(x * 0.3, h, 0.02)), 0.018, c);
    bake(torso, DOT, c, p.clone().add(V(x * 0.3, h, 0.02)), 0.03);
  }
  for (const s of [-1, 1]) {
    const a = surf(bc, br, s * 0.42, 0.75, 0.035).p, b = surf(bc, br, s * 0.62, 1.15, 0.03).p;
    limb(torso, a, b, 0.025, APRON); bake(torso, DOT, 0xd8ac4c, a, 0.03);
  }
  bake(torso, new T.BoxGeometry(0.16, 0.18, 0.1), 0x8e5a32, [-0.45, 0.38, 0.08], 1, [0, -1.2, 0.08]);
  for (const x of [-0.02, 0.03]) rod(torso, V(-0.46, 0.44, 0.08 + x), V(-0.47, 0.56, 0.08 + x * 1.6), 0.016, 0xb7b9bf);
  // Hammer arm: tan fur into a big brown glove round a toy mallet.
  const hand = V(0.5, 0.6, 0.3);
  limb(torso, V(0.38, 0.82, 0.04), hand, 0.085, FUR); bake(torso, SPH, GLOVE, hand, [0.11, 0.1, 0.11]);
  bake(torso, new T.TorusGeometry(1, 0.3, 8, 16), 0x6a3e22, V(0.47, 0.67, 0.25), 0.075, along(V(-0.3, 0.6, -0.6)).multiply(new T.Quaternion().setFromAxisAngle(V(1, 0, 0), Math.PI / 2)));
  rod(torso, V(0.52, 0.45, 0.32), V(0.56, 1.02, 0.38), 0.03, 0xb98252);
  const head0 = V(0.56, 1.04, 0.38), axis = V(1, -0.07, 0.25).normalize();
  bake(torso, CYL, 0x8a919c, head0, [0.09, 0.26, 0.09], along(axis));
  for (const s of [-1, 1]) bake(torso, SPH, 0xa6adb6, head0.clone().addScaledVector(axis, s * 0.13), [0.088, 0.03, 0.088], along(axis));
  st.mesh(body, torso);
  const wave = group(body, -0.38, 0.82, 0.04), arm: Parts = [];
  limb(arm, V(0, 0, 0), V(-0.06, -0.26, 0.12), 0.085, FUR); bake(arm, SPH, GLOVE, [-0.065, -0.3, 0.13], [0.11, 0.1, 0.11]);
  st.mesh(wave, arm); wave.rotation.z = -0.12;
  // Head: cream face, brown crown with its own tuft of spikes, a long snout and a shiny button nose.
  const head = group(body, 0, 1.08, 0.1), skull: Parts = [], face: Parts = [], hc: Vec = [0, 0, 0], hr: Vec = [0.3, 0.27, 0.27];
  bake(skull, HI, (v) => mix(FUR, BACK, smooth(v.y * 0.9 - v.z * 0.8, 0.1, 0.45)), hc, hr);
  for (const d of fib(110)) if (d.z < 0.05 + d.y * 0.45 && d.y > -0.25) spike(skull, hc, hr, d, 0.2 + R() * 0.06);
  const snC: Vec = [0, -0.07, 0.2], snR: Vec = [0.13, 0.1, 0.15];
  bake(skull, SPH, 0xf3e3c0, snC, snR); bake(skull, SPH, 0x2b1d18, surf(snC, snR, 0, 0.15, 0.01).p, [0.05, 0.04, 0.04]);
  for (const s of [-1, 1]) {
    const { p, n } = surf(hc, hr, s * 0.9, 0.62, -0.01);
    bake(skull, SPH, 0x8a5a36, p, [0.075, 0.075, 0.03], facing(n.add(V(0, 0, 0.6))));
    bake(face, DOT, 0xe6a29a, p.addScaledVector(n.normalize(), 0.022), [0.045, 0.045, 0.01], facing(n));
  }
  bake(face, DOT, 0xffffff, surf(snC, snR, -0.25, 0.4, 0.04).p.add(V(0, 0, 0.0)), 0.012);
  cheeks(face, hc, hr, 0.64, -0.14, 0.055); smile(face, snC, snR, -0.45, 0.045);
  st.mesh(head, skull); st.mesh(head, face, true);
  const eyeGroup = eyes(st, head, hc, hr, 0.36, 0.12, 0.07);
  root.userData.id = 'bramble';
  return { root, animate: life({ root, body, head, eyes: eyeGroup, seed: 1.7, wave, side: -1 }) };
}

/** Pip: a sandy degu cook in a red scarf and cream apron, offering a bowl of carrots, with a long tufted tail. */
function pip(st: Studio): VillagerRig {
  const root = new T.Group(), body = group(root, 0, 0, 0), torso: Parts = [], bc: Vec = [0, 0.52, 0], br: Vec = [0.4, 0.47, 0.36];
  const SAND = 0xb87a42, CREAM = 0xf2dcae, CLOTH = 0xf5eddb, RED = 0xd6483b;
  for (const s of [-1, 1]) bake(torso, SPH, 0x6d4528, [s * 0.17, 0.05, 0.13], [0.11, 0.06, 0.17]);
  bake(torso, HI, grad(SAND, CREAM, -0.15, 0.7), bc, br);
  bake(torso, new T.SphereGeometry(1, 24, 12, Math.PI / 2 - 0.85, 1.7, 1.42, 1.1), (v) => mix(0xfbf6ea, 0xdcccaa, smooth(v.y, -0.5, -0.95)), bc, [br[0] * 1.04, br[1] * 1.04, br[2] * 1.04]);
  bake(torso, new T.SphereGeometry(1, 12, 6, Math.PI / 2 - 0.55, 0.42, 1.85, 0.32), 0xe9dcc0, bc, [br[0] * 1.07, br[1] * 1.07, br[2] * 1.07]);
  bake(torso, new T.TorusGeometry(1, 0.42, 10, 24), grad(0xde5446, 0xb83a30), [0, 0.86, 0.03], [0.25, 0.23, 0.22], [Math.PI / 2 + 0.2, 0, 0]);
  bake(torso, SPH, 0xc8443a, [0.17, 0.8, 0.24], [0.07, 0.06, 0.06]);
  for (const a of [-0.35, 0.3]) bake(torso, SPH, RED, [0.19 + a * 0.12, 0.69, 0.27], [0.05, 0.11, 0.025], [0.3, 0, a]);
  st.mesh(body, torso);
  // Both paws hold the bowl, so arms, bowl and carrots move together as one offering.
  const offer = group(body, 0, 0.8, 0.04), held: Parts = [], bowl = V(0, -0.27, 0.36);
  for (const s of [-1, 1]) {
    const sh = V(s * 0.3, 0, 0), paw = V(s * 0.2, -0.25, 0.38);
    bake(held, SPH, CLOTH, sh.clone().lerp(paw, 0.15), 0.1); limb(held, sh.clone().lerp(paw, 0.2), paw, 0.068, SAND); bake(held, SPH, 0x9b6234, paw, 0.07);
  }
  bake(held, new T.SphereGeometry(1, 20, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), (v) => mix(0xa86f3e, 0x7a4c28, smooth(v.y, -0.3, -1)), bowl, [0.21, 0.13, 0.17]);
  bake(held, new T.TorusGeometry(1, 0.12, 6, 28), 0xb98050, bowl, [0.21, 0.17, 0.2], [Math.PI / 2, 0, 0]);
  bake(held, SPH, 0x6b4426, bowl.clone().add(V(0, -0.01, 0)), [0.19, 0.03, 0.15]);
  for (const [x, z, a, b] of [[-0.09, 0.02, 0.6, 0.3], [0.0, -0.04, -0.1, -0.3], [0.08, 0.03, -0.7, 0.2], [0.02, 0.07, 0.2, 1.1]] as const) {
    const base = bowl.clone().add(V(x, 0.01, z)), dir = V(Math.sin(a), 0.9, Math.sin(b) * 0.6).normalize();
    bake(held, CONE, (v) => mix(0xf08a2c, 0xd96d1e, smooth(v.y, 0.3, -0.5)), base.clone().addScaledVector(dir, 0.02), [0.055, 0.24, 0.055], along(dir.clone().negate()));
    for (const t of [-0.5, 0.5]) leaf(held, base.clone().addScaledVector(dir, 0.15), 0.07, dir.clone().add(V(t, 0.3, t * 0.5)), 0x5e9a3a);
  }
  st.mesh(offer, held);
  // Long tail out to the side, sandy along its length into a dark tuft.
  const tail = group(body, 0.08, 0.2, -0.3), tl: Parts = [];
  const curve = new T.CatmullRomCurve3([V(0, 0, 0), V(0.15, -0.1, -0.22), V(0.4, -0.02, -0.38), V(0.6, 0.18, -0.38), V(0.7, 0.38, -0.3)]);
  const tube = new T.TubeGeometry(curve, 32, 1, 10, false), tp = tube.getAttribute('position'), tn = tube.getAttribute('normal');
  for (let i = 0; i <= 32; i++) { const c = curve.getPointAt(i / 32), r = 0.05 - (i / 32) * 0.02; for (let j = 0; j <= 10; j++) { const k = i * 11 + j; W.fromBufferAttribute(tn, k); tp.setXYZ(k, c.x + W.x * r, c.y + W.y * r, c.z + W.z * r); } }
  bake(tl, tube, (v) => mix(SAND, 0x6a4428, smooth(v.y, 0.0, 0.25)), [0, 0, 0]);
  bake(tl, lumpy(0.12, 3), 0x4a3322, V(0.72, 0.44, -0.29), [0.085, 0.13, 0.085], along(V(0.4, 1, 0.2)));
  st.mesh(tail, tl, false, false);
  // Head: round with a soft muzzle, pink nose, huge round ears and whiskers.
  const head = group(body, 0, 1.03, 0.05), skull: Parts = [], face: Parts = [], hc: Vec = [0, 0, 0], hr: Vec = [0.32, 0.29, 0.3];
  bake(skull, HI, grad(0xbd7f45, 0xf4dcae, -0.35, 0.8), hc, hr);
  const snC: Vec = [0, -0.08, 0.19], snR: Vec = [0.15, 0.11, 0.13];
  bake(skull, SPH, 0xf6e2b8, snC, snR); bake(skull, SPH, 0xe48a8a, surf(snC, snR, 0, 0.3, 0.005).p, [0.045, 0.032, 0.03]);
  for (const s of [-1, 1]) {
    const { p } = surf(hc, hr, s * 0.72, 0.68, 0.05), n = V(s * 0.45, 0.15, 1).normalize();
    bake(skull, SPH, 0xb07240, p, [0.16, 0.16, 0.04], facing(n)); bake(skull, SPH, 0xeba2a0, p.clone().addScaledVector(n, 0.02).add(V(0, -0.01, 0)), [0.115, 0.115, 0.03], facing(n));
  }
  cheeks(face, hc, hr, 0.62, -0.17, 0.06); smile(face, snC, snR, -0.4, 0.05);
  const wh: T.Vector3[] = [];
  for (const s of [-1, 1]) for (let j = 0; j < 3; j++) {
    const a = surf(snC, snR, s * 0.9, 0.05 - j * 0.15, 0).p, b = a.clone().add(V(s * 0.3, 0.06 - j * 0.07, -0.04 + j * 0.03));
    const pts = new T.QuadraticBezierCurve3(a, a.clone().lerp(b, 0.5).add(V(0, 0.03, 0)), b).getPoints(6); for (let i = 0; i < 6; i++) wh.push(pts[i], pts[i + 1]);
  }
  st.mesh(head, skull); st.mesh(head, face, true); st.whiskers(head, wh);
  const eyeGroup = eyes(st, head, hc, hr, 0.4, 0.1, 0.075);
  root.userData.id = 'pip';
  return { root, animate: life({ root, body, head, eyes: eyeGroup, seed: 2.9, tail, extra: (t, lift, hello, still) => (offer.rotation.x = -lift * 0.15 - hello * 0.2 + Math.sin(t * 1.3) * 0.02 * still) }) };
}

/** Wren: a round speckled bird in a leaf scarf with a brass clasp, carrying a satchel of notes. */
function wren(st: Studio): VillagerRig {
  const root = new T.Group(), body = group(root, 0, 0, 0), legs: Parts = [], R = rng(5);
  const BROWN = 0x9b6238, CREAM = 0xf4e3c4, DARK = 0x6e4426;
  for (const s of [-1, 1]) {
    rod(legs, V(s * 0.14, 0.36, 0.02), V(s * 0.15, 0.05, 0.06), 0.022, 0x5a4030);
    for (const a of [-0.5, 0, 0.5]) limb(legs, V(s * 0.15, 0.03, 0.06), V(s * 0.15 + Math.sin(a) * 0.1, 0.02, 0.06 + Math.cos(a) * 0.12), 0.016, 0x5a4030);
    limb(legs, V(s * 0.15, 0.03, 0.06), V(s * 0.15, 0.02, -0.05), 0.014, 0x5a4030);
  }
  st.mesh(body, legs, false, false);
  // Everything above the legs tips and turns together: a round bird is all head.
  const head = group(body, 0, 0.35, 0), top = group(head, 0, -0.35, 0), plump: Parts = [], dots: Parts = [];
  const bc: Vec = [0, 0.86, 0], br: Vec = [0.55, 0.56, 0.52];
  bake(plump, FINE, (v) => {
    const u = W.copy(v).normalize();
    const face = smooth(u.z - 1.3 * Math.max(0, u.y - 0.46), 0.15, 0.32), belly = smooth(-u.y, 0.2, 0.6) * smooth(u.z, -0.7, -0.1);
    return mix(BROWN, CREAM, Math.max(face, belly));
  }, bc, br);
  for (let i = 0; i < 26; i++) { const { p, n } = surf(bc, br, (R() - 0.5) * 2.2, -0.15 - R() * 0.75, 0.003); bake(dots, BIT, 0x8a5634, p, [0.026, 0.02, 0.006], facing(n)); }
  for (let i = 0; i < 16; i++) { const { p, n } = surf(bc, br, Math.PI + (R() - 0.5) * 3.4, 0.2 + R() * 0.9, 0.003); bake(dots, BIT, 0xe8c79a, p, [0.024, 0.018, 0.006], facing(n)); }
  const bk = surf(bc, br, 0, 0.08, -0.02).p;
  bake(plump, CONE, (v) => mix(0xa47a4c, 0x3a2c22, smooth(v.y, -0.3, 0.4)), bk.clone().add(V(0, 0, 0.09)), [0.07, 0.22, 0.06], [Math.PI / 2, 0, 0]);
  // Leaf scarf: a green collar hung with leaves, fastened at the front with a brass clasp.
  bake(plump, new T.TorusGeometry(1, 0.13, 10, 36), grad(0x55865a, 0x3c6644), [0, 0.68, 0.0], [0.51, 0.48, 0.5], [Math.PI / 2 - 0.08, 0, 0]);
  sash(plump, bc, br, V(0.229, 0.584, 0.544).normalize(), 0.045, 0x7a4a2a);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + 0.2, n = V(Math.sin(a), 0, Math.cos(a)), { p } = surf(bc, br, a, -0.36 + Math.cos(a) * 0.05, 0.03);
    leaf(plump, p, 0.1, n.clone().add(V(0, -1.4, 0)), i % 2 ? 0x5e9a3a : 0x7aad48);
  }
  const clasp = surf(bc, br, 0, -0.29, 0.05);
  bake(plump, CYL, 0xd4a64a, clasp.p, [0.065, 0.03, 0.065], along(clasp.n)); bake(dots, DOT, 0xf6dc8a, clasp.p.clone().addScaledVector(clasp.n, 0.018).add(V(-0.02, 0.02, 0)), 0.016);
  // Satchel of notes on the hip.
  const bag = surf(bc, br, 1.75, -0.45, 0.04).p;
  bake(plump, new T.BoxGeometry(0.1, 0.2, 0.24), 0x8e5a32, bag, 1, [0, 0.1, -0.15]);
  bake(plump, new T.BoxGeometry(0.11, 0.09, 0.25), 0x6e4224, bag.clone().add(V(0.005, 0.07, 0)), 1, [0, 0.1, -0.15]);
  for (const [z, a] of [[-0.05, 0.15], [0.04, -0.1]] as const) bake(plump, new T.BoxGeometry(0.02, 0.14, 0.12), 0xfaf3e2, bag.clone().add(V(-0.02, 0.12, z)), 1, [a, 0.1, -0.1]);
  st.mesh(top, plump); st.mesh(top, dots, true);
  // Wings, which flap a greeting, and a cocked fan of tail feathers.
  const wings = [-1, 1].map((s) => {
    const w = group(top, s * 0.5, 0.96, 0.02), list: Parts = [];
    bake(list, SPH, (v) => mix(0x7e4c2a, 0xcf9b68, Math.cos(v.y * 9) > 0.55 && v.y < 0.2 ? 1 : 0), [s * 0.04, -0.2, -0.04], [0.09, 0.3, 0.23], [0.35, 0, s * 0.1]);
    st.mesh(w, list, false, false); return w;
  });
  const tail = group(top, 0, 0.58, -0.44), fan: Parts = [];
  for (const a of [-0.35, 0, 0.35]) bake(fan, SPH, (v) => mix(DARK, 0xb07a48, Math.cos(v.y * 10) > 0.6 ? 0.7 : 0), V(Math.sin(a) * 0.2, 0.3, -0.1), [0.095, 0.38, 0.035], [-0.4, 0, -a]);
  st.mesh(tail, fan, false, false);
  const face: Parts = []; cheeks(face, bc, br, 0.56, 0.08, 0.06); st.mesh(top, face, true);
  const eyeGroup = eyes(st, top, bc, br, 0.36, 0.3, 0.085);
  root.userData.id = 'wren';
  return { root, animate: life({ root, body, head, eyes: eyeGroup, seed: 0.3, wave: wings[0], side: -1, extra: (t, lift, hello, still) => { wings[1].rotation.z = Math.sin(t * 14) * 0.25 * hello; tail.rotation.x = (Math.sin(t * 3) * 0.06 + lift * Math.max(0, Math.sin(t * 7)) * 0.2) * still; } }) };
}

/** Builds a villager standing at the origin and facing +z (towards the village paths). */
export function createVillager(id: VillagerId, kit: VillagerKit): VillagerRig {
  const st = studio(kit);
  return id === 'mossback' ? mossback(st) : id === 'bramble' ? bramble(st) : id === 'pip' ? pip(st) : wren(st);
}
