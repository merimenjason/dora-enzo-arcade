// Dora and Enzo in 3D with fur, shared by the 3D games that want them close to life. Ported from the playpen prototype
// (docs/playpen-reference.md). The body is eight ellipsoids blended into one surface; the fur is that surface drawn in
// shells, each pushed out along the normal and cut away by a noise texture. The coat (Enzo's dark back fading to a
// pale belly, his wavy bands and pale muzzle) is worked out in the fragment shader from the place on the body.
// Feet at y = 0, nose towards +z, about 0.2 long. Fur does not receive shadows.
import * as T from 'three';

export type Chin3dId = 'dora' | 'enzo';
export interface Chin3dOptions { /** Fur shells on the body; the tail gets a few fewer. 28 is the prototype's; 14 is fine at a distance. */ layers?: number; /** Direction to the sun, world space. */ sun?: T.Vector3 }

const PI = Math.PI;
let seed = 7;
const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

const FUR_VS = /* glsl */ `
  uniform float layer, len; uniform vec3 comb; attribute float aLen;
  varying vec3 vP, vN, vW; varying vec2 vUv;
  void main() {
    float L = len * aLen * layer; vec3 p = position + normal * L + comb * L * layer;
    vP = position; vUv = uv; vN = normalize(mat3(modelMatrix) * normal);
    vec4 w = modelMatrix * vec4(p, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w;
  }`;
const FUR_FS = /* glsl */ `
  uniform sampler2D noise; uniform float layer, bandAmt, tipAmt, muzzleAmt; uniform vec2 uvScale;
  uniform vec3 back, side, belly, tip, sunDir;
  varying vec3 vP, vN, vW; varying vec2 vUv;
  void main() {
    vec4 n = texture2D(noise, vUv * uvScale);
    if (layer > 0.0 && n.r < 0.1 + layer * 0.88) discard;
    float h = clamp((vP.y - 0.015) / 0.15, 0.0, 1.0);
    vec3 c = mix(belly, side, smoothstep(0.1, 0.42, h)); c = mix(c, back, smoothstep(0.5, 0.95, h));
    float w = sin(vP.z * 430.0 + sin(vP.y * 90.0 + vP.x * 50.0) * 2.6 + sin(vP.z * 60.0) * 1.5);
    c *= 1.0 - bandAmt * smoothstep(-0.2, 0.9, w) * smoothstep(0.2, 0.55, h) * (0.6 + 0.8 * n.g);
    c = mix(c, belly, muzzleAmt * (1.0 - smoothstep(0.02, 0.055, distance(vP, vec3(0.0, 0.08, 0.125)))));
    c = mix(c, tip, tipAmt * smoothstep(0.3, 0.9, vUv.x));
    c *= 0.84 + 0.3 * n.g;
    vec3 N = normalize(vN), V = normalize(cameraPosition - vW);
    vec3 light = mix(vec3(0.48, 0.35, 0.29), vec3(1.0, 0.96, 0.93), N.y * 0.5 + 0.5) * 0.5
      + vec3(1.0, 0.945, 0.86) * 0.55 * max(dot(N, sunDir), 0.0) + vec3(0.87, 0.9, 1.0) * 0.12 * max(dot(N, normalize(vec3(-2.0, 2.0, 1.0))), 0.0);
    float ao = mix(0.45, 1.0, pow(layer, 0.7));
    vec3 col = c * light * ao + c * 0.14 * pow(1.0 - abs(dot(N, V)), 2.5);
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }`;

interface Coat { back: number; side: number; belly: number; band: number; muzzle: number; ear: number; skin: number; nose: number; eye: number; whisk: number; tail: number; tip: number; curl: number; phase: number }
const COATS: Record<Chin3dId, Coat> = {
  enzo: { back: 0x4b4e56, side: 0x7b7e86, belly: 0xd6d7db, band: 0.26, muzzle: 0.75, ear: 0x62575c, skin: 0x9a9399, nose: 0x8f7d82, eye: 0x070708, whisk: 0xd8d8dc, tail: 0x5d6068, tip: 0x2c2e33, curl: -1, phase: 0 },
  dora: { back: 0xf2eee7, side: 0xf4f0ea, belly: 0xfbf9f5, band: 0.05, muzzle: 0, ear: 0xecbfb0, skin: 0xf3c9c2, nose: 0xe9a7ab, eye: 0x3a0b14, whisk: 0xffffff, tail: 0xefe6d6, tip: 0xf6f0e3, curl: 1, phase: 1.7 },
};

// body shape: [cx, cy, cz, rx, ry, rz]
const BODY = [[0, 0.085, -0.02, 0.085, 0.082, 0.105], [0.045, 0.06, -0.045, 0.055, 0.058, 0.07], [-0.045, 0.06, -0.045, 0.055, 0.058, 0.07],
  [0, 0.07, 0.05, 0.06, 0.06, 0.05], [0, 0.106, 0.078, 0.058, 0.05, 0.052], [0.03, 0.088, 0.094, 0.034, 0.03, 0.03], [-0.03, 0.088, 0.094, 0.034, 0.03, 0.03], [0, 0.09, 0.112, 0.03, 0.025, 0.022]];
function sdf(x: number, y: number, z: number): number {
  let d = 1e9; const k = 0.03;
  for (const e of BODY) {
    const qx = (x - e[0]) / e[3], qy = (y - e[1]) / e[4], qz = (z - e[2]) / e[5];
    const di = (Math.sqrt(qx * qx + qy * qy + qz * qz) - 1) * Math.min(e[3], e[4], e[5]), h = Math.max(k - Math.abs(d - di), 0) / k;
    d = Math.min(d, di) - h * h * k * 0.25;
  }
  return d;
}
/** Where a ray from inside the body leaves it. */
function surf(o: number[], dx: number, dy: number, dz: number): T.Vector3 {
  const l = Math.hypot(dx, dy, dz); dx /= l; dy /= l; dz /= l; let lo = 0, hi = 0.3;
  for (let i = 0; i < 22; i++) { const m = (lo + hi) / 2; if (sdf(o[0] + dx * m, o[1] + dy * m, o[2] + dz * m) < 0) lo = m; else hi = m; }
  return new T.Vector3(o[0] + dx * lo, o[1] + dy * lo, o[2] + dz * lo);
}
const HEAD = [0, 0.105, 0.08];

interface Shared { noise: T.Texture; body: T.BufferGeometry; eyes: T.Vector3[]; nose: T.Vector3 }
let shared: Shared | null = null;
function build(): Shared {
  const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d')!, im = g.createImageData(512, 512);
  for (let i = 0; i < im.data.length; i += 4) { im.data[i] = rnd() * 255; im.data[i + 1] = rnd() * 255; im.data[i + 2] = 0; im.data[i + 3] = 255; }
  g.putImageData(im, 0, 0); const noise = new T.CanvasTexture(c); noise.wrapS = noise.wrapT = T.RepeatWrapping; noise.magFilter = T.NearestFilter;
  const snout = new T.Vector3(0, 0.088, 0.136), eyes = [-1, 1].map(sx => surf(HEAD, sx * 0.8, 0.22, 0.56)), nose = surf(HEAD, 0, -0.22, 1);
  const body = new T.SphereGeometry(1, 96, 64), P = body.attributes.position, N = body.attributes.normal, aLen = new Float32Array(P.count), C = [0, 0.085, 0.02], e = 0.0015;
  for (let i = 0; i < P.count; i++) {
    const p = surf(C, P.getX(i), -P.getZ(i), P.getY(i));
    const n = new T.Vector3(sdf(p.x + e, p.y, p.z) - sdf(p.x - e, p.y, p.z), sdf(p.x, p.y + e, p.z) - sdf(p.x, p.y - e, p.z), sdf(p.x, p.y, p.z + e) - sdf(p.x, p.y, p.z - e)).normalize();
    if (p.y < 0.003) p.y = 0.003;
    P.setXYZ(i, p.x, p.y, p.z); N.setXYZ(i, n.x, n.y, n.z);
    aLen[i] = (0.22 + 0.78 * T.MathUtils.smoothstep(p.distanceTo(snout), 0.035, 0.12)) * (0.25 + 0.75 * T.MathUtils.smoothstep(Math.min(p.distanceTo(eyes[0]), p.distanceTo(eyes[1])), 0.008, 0.028));
  }
  body.setAttribute('aLen', new T.BufferAttribute(aLen, 1)); body.computeBoundingSphere();
  return { noise, body, eyes, nose };
}
function tailGeo(curl: number): T.BufferGeometry {
  const pts = [[0, 0, 0.03], [0, -0.004, -0.03], [curl * 0.03, 0, -0.075], [curl * 0.075, 0.012, -0.085], [curl * 0.11, 0.03, -0.06], [curl * 0.12, 0.05, -0.025]].map(p => new T.Vector3(p[0], p[1], p[2]));
  const curve = new T.CatmullRomCurve3(pts), seg = 44, rad = 10, geo = new T.TubeGeometry(curve, seg, 0.015, rad, false), P = geo.attributes.position, aLen = new Float32Array(P.count);
  for (let i = 0; i <= seg; i++) {
    const t = i / seg, c = curve.getPointAt(t), k = (1 - 0.5 * t) * (t > 0.9 ? Math.max(0.05, (1 - t) / 0.1) : 1);
    for (let j = 0; j <= rad; j++) { const v = i * (rad + 1) + j; P.setXYZ(v, c.x + (P.getX(v) - c.x) * k, c.y + (P.getY(v) - c.y) * k, c.z + (P.getZ(v) - c.z) * k); aLen[v] = (0.75 + 0.35 * Math.sin(t * PI)) * (t > 0.9 ? 0.5 + 5 * (1 - t) : 1); }
  }
  geo.setAttribute('aLen', new T.BufferAttribute(aLen, 1)); return geo;
}

const lin = (hex: number) => new T.Color(hex); // three converts a hex colour to linear itself
interface FurLook { len: number; comb?: T.Vector3; uv: T.Vector2; back: number; side: number; belly: number; tip?: number; band?: number; tipAmt?: number; muzzle?: number }
function furMesh(geo: T.BufferGeometry, o: FurLook, layers: number, noise: T.Texture, sun: T.Vector3): T.Group {
  const common = { noise: { value: noise }, len: { value: o.len }, comb: { value: o.comb ?? new T.Vector3() }, uvScale: { value: o.uv }, sunDir: { value: sun },
    back: { value: lin(o.back) }, side: { value: lin(o.side) }, belly: { value: lin(o.belly) }, tip: { value: lin(o.tip ?? o.back) },
    bandAmt: { value: o.band ?? 0 }, tipAmt: { value: o.tipAmt ?? 0 }, muzzleAmt: { value: o.muzzle ?? 0 } };
  const g = new T.Group();
  for (let i = 0; i <= layers; i++) {
    const m = new T.Mesh(geo, new T.ShaderMaterial({ uniforms: { ...common, layer: { value: i / layers } }, vertexShader: FUR_VS, fragmentShader: FUR_FS }));
    m.castShadow = i === 0; g.add(m);
  }
  return g;
}
const std = (color: number, o: T.MeshStandardMaterialParameters = {}) => new T.MeshStandardMaterial({ color, roughness: 0.8, ...o });
function ball(r: number, mat: T.Material, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1): T.Mesh {
  const m = new T.Mesh(new T.SphereGeometry(r, 16, 12), mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; return m;
}

/** A furred Dora or Enzo. The group has a `body` child to scale for breathing and a `tail` child to swing; `userData.phase` offsets the two. */
export function makeChinchilla3d(id: Chin3dId, opts: Chin3dOptions = {}): T.Group {
  shared ??= build();
  const c = COATS[id], layers = opts.layers ?? 28, sun = (opts.sun ?? new T.Vector3(1.4, 4.2, 2.5)).clone().normalize();
  const g = new T.Group(), k = new T.Group(); g.rotation.order = 'YXZ'; k.scale.setScalar(0.84); g.add(k);
  const body = new T.Group(); body.name = 'body';
  body.add(furMesh(shared.body, { len: 0.017, comb: new T.Vector3(0, -0.25, -0.55), uv: new T.Vector2(2, 1), back: c.back, side: c.side, belly: c.belly, band: c.band, muzzle: c.muzzle }, layers, shared.noise, sun));
  k.add(body);
  const skin = std(c.skin, { roughness: 0.75 }), earMat = std(c.ear, { roughness: 0.7, side: T.DoubleSide }), whisk = std(c.whisk, { roughness: 0.4 });
  for (const sx of [-1, 1]) {
    // ears: thin shallow cups, hollow side forward
    const eg = new T.SphereGeometry(0.05, 20, 8, 0, PI * 2, 0, 0.72); eg.translate(0, -0.05 * Math.cos(0.72), 0); eg.rotateX(-PI / 2); eg.scale(0.95, 1.22, 1);
    const base = surf(HEAD, sx * 0.62, 0.78, -0.25), ear = new T.Mesh(eg, earMat); ear.position.set(base.x + sx * 0.006, base.y + 0.026, base.z); ear.rotation.set(-0.12, sx * 0.55, -sx * 0.22); ear.castShadow = true; k.add(ear);
    const eye = shared.eyes[sx < 0 ? 0 : 1]; k.add(ball(0.0082, std(c.eye, { roughness: 0.08 }), eye.x - sx * 0.002, eye.y, eye.z - 0.001));
    const root = surf(HEAD, sx * 0.45, -0.3, 0.9);
    for (let i = 0; i < 8; i++) {
      const L = 0.06 + rnd() * 0.06, wg = new T.CylinderGeometry(0.00035, 0.0002, L, 4); wg.translate(0, L / 2, 0);
      const p = new T.Group(); p.position.set(root.x + (rnd() - 0.5) * 0.008, root.y + (rnd() - 0.5) * 0.01, root.z + (rnd() - 0.5) * 0.006);
      p.rotation.set(0.25 + (rnd() - 0.5) * 0.9, 0, -sx * (PI / 2 - 0.25 + (rnd() - 0.5) * 0.5)); p.add(new T.Mesh(wg, whisk)); k.add(p);
    }
    k.add(ball(1, skin, sx * 0.026, 0.005, 0.086, 0.008, 0.005, 0.011), ball(1, skin, sx * 0.062, 0.005, 0.03, 0.009, 0.005, 0.018));
  }
  k.add(ball(1, std(c.nose, { roughness: 0.5 }), shared.nose.x, shared.nose.y + 0.002, shared.nose.z + 0.001, 0.0075, 0.0055, 0.005));
  const tail = new T.Group(); tail.name = 'tail'; tail.position.set(0, 0.04, -0.11);
  tail.add(furMesh(tailGeo(c.curl), { len: 0.03, uv: new T.Vector2(1, 1), back: c.tail, side: c.tail, belly: c.tail, tip: c.tip, tipAmt: 1 }, Math.max(6, layers - 4), shared.noise, sun));
  k.add(tail); g.userData.phase = c.phase; return g;
}
