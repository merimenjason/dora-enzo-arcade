// Kumori Pass: the toon kit and the cars. A gradient-map cel ramp, an ink outline shader that pushes a hull out along
// smoothed normals (it works on instanced props and fades in fog), and painted-glass windows. Each car is lofted from a
// side profile and a plan: stations along the car carry a cross-section ring with colour bands (the Biscuit's sky-blue
// lower half and stripe), the sills arch up over the wheels, and the glasshouse is lofted on top with pillars, roof and
// glass. Each car is a handful of draw calls: one vertex-coloured body, its ink, glass, lamps, tail lamps and glows,
// and four spoked wheels that spin and steer.
import * as T from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { CarShape } from './pass-game';

// ---------------------------------------------------------------- toon kit
export const ramp = (() => {
  const d = new Uint8Array([84, 84, 84, 255, 168, 168, 168, 255, 255, 255, 255, 255]);
  const t = new T.DataTexture(d, 3, 1, T.RGBAFormat); t.minFilter = T.NearestFilter; t.magFilter = T.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true; return t;
})();
export const toon = (color: number, o: T.MeshToonMaterialParameters = {}) => new T.MeshToonMaterial({ color, gradientMap: ramp, ...o });

/** Ink: the back faces of a hull pushed out along its normals by `width` metres. Instancing and fog work. */
export function inkMaterial(width: number, color = 0x0d0a14) {
  const m = new T.ShaderMaterial({
    side: T.BackSide, fog: true,
    uniforms: T.UniformsUtils.merge([T.UniformsLib.fog, { width: { value: width }, color: { value: new T.Color(color) }, opacity: { value: 1 } }]),
    vertexShader: `uniform float width;
#include <common>
#include <fog_pars_vertex>
void main() {
  vec4 mvPosition = vec4(position + normal * width, 1.0);
#ifdef USE_INSTANCING
  mvPosition = instanceMatrix * mvPosition;
#endif
  mvPosition = modelViewMatrix * mvPosition;
  gl_Position = projectionMatrix * mvPosition;
#include <fog_vertex>
}`,
    fragmentShader: `uniform vec3 color; uniform float opacity;
#include <common>
#include <fog_pars_fragment>
void main() {
  gl_FragColor = vec4(color, opacity);
#include <colorspace_fragment>
#include <fog_fragment>
}`,
  });
  m.userData.keep = true;
  return m;
}
export const INK_CAR = inkMaterial(0.03), INK_PROP = inkMaterial(0.07), INK_TREE = inkMaterial(0.14);

/** A hull for the ink: positions only, welded, with smoothed normals so the outline has no cracks at hard edges. */
export function hull(g: T.BufferGeometry) {
  const h = new T.BufferGeometry(); h.setAttribute('position', g.attributes.position.clone());
  if (g.index) h.setIndex(g.index.clone());
  const m = mergeVertices(h, 1e-3); m.computeVertexNormals(); return m;
}

/** Window glass: dark sky colour, lighter where it faces up, with two painted reflection streaks. */
export function glassMaterial(tint = 0x2c4170) {
  return new T.ShaderMaterial({
    transparent: true, fog: true,
    uniforms: T.UniformsUtils.merge([T.UniformsLib.fog, { tint: { value: new T.Color(tint) }, sheen: { value: new T.Color(0xb8cdf2) }, opacity: { value: 0.84 } }]),
    vertexShader: `varying vec3 vP; varying vec3 vN;
#include <common>
#include <fog_pars_vertex>
void main() {
  vP = position; vN = normalize(normalMatrix * normal);
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
#include <fog_vertex>
}`,
    fragmentShader: `uniform vec3 tint; uniform vec3 sheen; uniform float opacity; varying vec3 vP; varying vec3 vN;
#include <common>
#include <fog_pars_fragment>
void main() {
  float s = fract((vP.x * 0.9 + vP.y * 1.5 + vP.z * 0.3) * 1.15);
  float streak = step(0.1, s) * step(s, 0.19) + step(0.27, s) * step(s, 0.31) * 0.7;
  float up = clamp(vN.y * 0.6 + 0.45, 0.0, 1.0);
  gl_FragColor = vec4(mix(tint * 0.45, tint, up) + sheen * streak * 0.5, opacity);
#include <colorspace_fragment>
#include <fog_fragment>
}`,
  });
}

let glowTex: T.CanvasTexture | null = null;
/** A soft round glow (headlamp halos, tail-lamp bloom, lamp heads). */
export function softGlow() {
  if (glowTex || typeof document === 'undefined') return glowTex;
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.75)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  glowTex = new T.CanvasTexture(c); glowTex.colorSpace = T.SRGBColorSpace; glowTex.userData.keep = true; return glowTex;
}

// ---------------------------------------------------------------- a triangle soup with colours and normals
const C = new T.Color(), N3 = new T.Vector3(), A3 = new T.Vector3(), B3 = new T.Vector3();
export class Soup {
  p: number[] = []; n: number[] = []; c: number[] = [];
  /** a triangle, wound to face away from `inside` */
  tri(a: number[], b: number[], c: number[], col: number, inside: number[] | null, smooth?: number[][]) {
    A3.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]); B3.set(c[0] - a[0], c[1] - a[1], c[2] - a[2]); N3.crossVectors(A3, B3);
    if (inside) { const ox = (a[0] + b[0] + c[0]) / 3 - inside[0], oy = (a[1] + b[1] + c[1]) / 3 - inside[1], oz = (a[2] + b[2] + c[2]) / 3 - inside[2]; if (N3.x * ox + N3.y * oy + N3.z * oz < 0) { const t = b; b = c; c = t; N3.negate(); if (smooth) { const s = smooth[1]; smooth[1] = smooth[2]; smooth[2] = s; } } }
    N3.normalize(); C.setHex(col);
    const v = [a, b, c];
    for (let k = 0; k < 3; k++) { this.p.push(v[k][0], v[k][1], v[k][2]); if (smooth) this.n.push(smooth[k][0], smooth[k][1], smooth[k][2]); else this.n.push(N3.x, N3.y, N3.z); this.c.push(C.r, C.g, C.b); }
  }
  quad(a: number[], b: number[], c: number[], d: number[], col: number, inside: number[] | null, sm?: number[][]) {
    this.tri(a, b, c, col, inside, sm && [sm[0], sm[1], sm[2]]); this.tri(a, c, d, col, inside, sm && [sm[0], sm[2], sm[3]]);
  }
  /** a three.js primitive, moved by m, in one colour */
  add(g: T.BufferGeometry, m: T.Matrix4 | null, col: number) {
    const ng = g.index ? g.toNonIndexed() : g; if (m) ng.applyMatrix4(m);
    const p = ng.attributes.position, n = ng.attributes.normal; C.setHex(col);
    for (let i = 0; i < p.count; i++) { this.p.push(p.getX(i), p.getY(i), p.getZ(i)); this.n.push(n.getX(i), n.getY(i), n.getZ(i)); this.c.push(C.r, C.g, C.b); }
    g.dispose(); if (ng !== g) ng.dispose();
    return this;
  }
  geometry() {
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(this.p, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(this.n, 3)); g.setAttribute('color', new T.Float32BufferAttribute(this.c, 3));
    g.computeBoundingSphere(); return g;
  }
  get empty() { return this.p.length === 0; }
}
const M = new T.Matrix4(), QQ = new T.Quaternion(), EE = new T.Euler(), PP = new T.Vector3(), SS = new T.Vector3();
export const at = (x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => M.compose(PP.set(x, y, z), QQ.setFromEuler(EE.set(rx, ry, rz)), SS.set(sx, sy, sz));

// ---------------------------------------------------------------- wheels
type RimStyle = 'steel' | 'spoke5' | 'mesh' | 'dish';
const wheelCache = new Map<string, { geo: T.BufferGeometry; ink: T.BufferGeometry }>();
function wheelGeo(style: RimStyle, rim: number, r: number, w: number) {
  const key = `${style}|${rim}|${r}|${w}`;
  const hit = wheelCache.get(key); if (hit) return hit;
  const s = new Soup(), TYRE = 0x1c1b22, WALL = 0x2c2b33, DARK = 0x15141a, face = w / 2;
  s.add(new T.CylinderGeometry(r, r, w * 0.84, 22, 1, true), at(0, 0, 0, Math.PI / 2), TYRE);
  // rounded shoulders, then the sidewall rings
  for (const z of [-1, 1]) { s.add(new T.CylinderGeometry(r * 0.96, r, w * 0.08, 22, 1, true), at(0, 0, z * w * 0.46, z * Math.PI / 2), TYRE); s.add(new T.RingGeometry(r * 0.66, r * 0.96, 22), at(0, 0, z * face, 0, z > 0 ? 0 : Math.PI), WALL); }
  const rr = r * 0.66, f = face + 0.004;
  s.add(new T.CircleGeometry(rr, 20), at(0, 0, f - 0.05), DARK);
  if (style === 'steel') {
    s.add(new T.CircleGeometry(rr, 20), at(0, 0, f), rim);
    for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2 + 0.4; s.add(new T.CircleGeometry(rr * 0.17, 10), at(Math.cos(a) * rr * 0.6, Math.sin(a) * rr * 0.6, f + 0.003), DARK); }
    s.add(new T.CylinderGeometry(rr * 0.32, rr * 0.36, 0.05, 14), at(0, 0, f + 0.02, Math.PI / 2), 0xd8dbe2);
  } else if (style === 'dish') {
    s.add(new T.CylinderGeometry(rr * 0.96, rr, 0.03, 20), at(0, 0, f + 0.01, Math.PI / 2), rim);
    s.add(new T.TorusGeometry(rr * 0.93, 0.022, 4, 22), at(0, 0, f + 0.03), 0xeceff4);
    for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2; s.add(new T.CylinderGeometry(0.018, 0.018, 0.02, 6), at(Math.cos(a) * rr * 0.32, Math.sin(a) * rr * 0.32, f + 0.035, Math.PI / 2), DARK); }
  } else {
    const n = style === 'mesh' ? 12 : 5, wide = style === 'mesh' ? 0.025 : 0.07;
    s.add(new T.TorusGeometry(rr * 0.95, 0.03, 4, 22), at(0, 0, f + 0.012), rim);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      s.add(new T.BoxGeometry(wide, rr * 0.9, 0.025), at(Math.cos(a + Math.PI / 2) * rr * 0.47, Math.sin(a + Math.PI / 2) * rr * 0.47, f + 0.015, 0, 0, a + (style === 'mesh' ? 0.35 : 0)), rim);
      if (style === 'mesh') s.add(new T.BoxGeometry(wide, rr * 0.9, 0.025), at(Math.cos(a + Math.PI / 2) * rr * 0.47, Math.sin(a + Math.PI / 2) * rr * 0.47, f + 0.01, 0, 0, a - 0.35), rim);
    }
    s.add(new T.CylinderGeometry(rr * 0.22, rr * 0.26, 0.06, 12), at(0, 0, f + 0.025, Math.PI / 2), rim);
  }
  const geo = s.geometry(); geo.userData.keep = true;
  const ink = hull(new T.CylinderGeometry(r, r, w, 22).rotateX(Math.PI / 2)); ink.userData.keep = true;
  const out = { geo, ink }; wheelCache.set(key, out); return out;
}

// ---------------------------------------------------------------- the car specs
export type CarLook = { shape: CarShape; body: number; trim: number; biscuit?: boolean; ghost?: boolean };
type Lamps = 'round' | 'twin' | 'square' | 'slim' | 'popup';
type Model = {
  L: number; W: number; R: number; tyreW: number; wb: [number, number]; ride: number; smooth: boolean;
  /** body top line, front (+x) to back */ top: [number, number][];
  /** glasshouse: windscreen base, roof front, roof back, rear base; null for an open car */ cab: [number, number][] | null;
  cabW: [number, number]; side: [number, number, number]; // side windows from x0 to x1, a B-pillar at x2
  bands: [number, number][]; roof: number; bumper: number; flare: number | null; nose: number; tail: number;
  lamps: Lamps; lampCol: number; tailCol: [number, number]; rim: RimStyle; rimCol: number; glass: number; fur: number; extras?: (s: Soup, h: Soup, m: Model, x: Extras) => void;
};
type Extras = { lens: Soup; body: number; trim: number };
const DARK = 0x1a1a22, SILL = 0x2b2a31;

function model(look: CarLook): Model {
  const b = look.body, tr = look.trim;
  switch (look.shape) {
    case 'hatch': return { // the Biscuit: a small boxy late-80s hatchback, cream over sky blue
      L: 3.72, W: 1.6, R: 0.29, tyreW: 0.2, wb: [1.17, -1.16], ride: 0.27, smooth: false, nose: 0.12, tail: 0.1,
      top: [[1.86, 0.6], [1.84, 0.78], [1.66, 0.84], [0.66, 0.92], [-1.2, 0.97], [-1.86, 0.98]],
      cab: [[0.66, 0.93], [0.02, 1.43], [-1.52, 1.47], [-1.84, 1.0]], cabW: [0.94, 0.8], side: [0.5, -1.5, -0.5],
      bands: [[0.58, 0x6aa9da], [0.605, b], [0.65, 0x6aa9da], [9, b]], roof: b, bumper: 0x2a2b31, flare: null,
      lamps: 'round', lampCol: 0xfff3cc, tailCol: [0x8f101b, 0xff4a48], rim: 'steel', rimCol: 0xd9dce3, glass: 0x2c4170, fur: 0xf6eedc };
    case 'wedge': return { // Kestrel: a low red wedge with pop-ups and a lip spoiler
      L: 4.12, W: 1.7, R: 0.3, tyreW: 0.23, wb: [1.28, -1.25], ride: 0.25, smooth: false, nose: 0.18, tail: 0.12,
      top: [[2.06, 0.5], [1.96, 0.6], [1.3, 0.7], [0.6, 0.82], [-1.6, 0.92], [-2.06, 0.9]],
      cab: [[0.62, 0.83], [-0.08, 1.22], [-0.95, 1.24], [-1.6, 0.93]], cabW: [0.9, 0.74], side: [0.45, -1.45, -0.55],
      bands: [[0.42, tr], [0.47, b], [0.5, tr], [9, b]], roof: b, bumper: tr, flare: tr,
      lamps: 'popup', lampCol: 0xfff3cc, tailCol: [0x8f101b, 0xff4a48], rim: 'spoke5', rimCol: 0xc9ccd4, glass: 0x24365c, fur: 0xb5652f,
      extras: (s, h, m) => { lipSpoiler(s, h, m, 0.16, tr); } };
    case 'roadster': return { // Lagoon: a rounded open two-seater, teal with cream seats
      L: 3.95, W: 1.66, R: 0.29, tyreW: 0.21, wb: [1.15, -1.15], ride: 0.25, smooth: true, nose: 0.38, tail: 0.3,
      top: [[1.98, 0.48], [1.88, 0.6], [1.2, 0.7], [0.4, 0.78], [-1.6, 0.84], [-1.98, 0.8]],
      cab: null, cabW: [0.92, 0.8], side: [0, 0, 0],
      bands: [[0.5, b], [0.53, tr], [9, b]], roof: b, bumper: b, flare: null,
      lamps: 'popup', lampCol: 0xfff3cc, tailCol: [0x8f101b, 0xff4a48], rim: 'mesh', rimCol: 0xe9dfc6, glass: 0x2c4a6e, fur: 0x7a5236,
      extras: (s, h, m, x) => {
        // the cockpit tub, two seats with headrests, a windscreen in a frame and a hoop
        s.add(new T.BoxGeometry(1.25, 0.06, 1.3), at(-0.5, 0.83, 0), DARK);
        for (const z of [-0.36, 0.36]) { s.add(new T.BoxGeometry(0.16, 0.42, 0.46), at(-0.75, 1.02, z, 0, 0, 0.12), tr); s.add(new T.BoxGeometry(0.12, 0.18, 0.28), at(-0.82, 1.3, z, 0, 0, 0.1), tr); }
        const ws = new T.PlaneGeometry(1.36, 0.42); ws.rotateY(Math.PI / 2); ws.rotateZ(0.6); glassPanes.push([ws, at(0.25, 0.97, 0).clone()]);
        for (const z of [-0.69, 0.69]) s.add(new T.BoxGeometry(0.04, 0.44, 0.04), at(0.25, 0.97, z, 0, 0, 0.6), DARK);
        s.add(new T.BoxGeometry(0.04, 0.04, 1.4), at(0.13, 1.15, 0), DARK);
        h.add(new T.BoxGeometry(0.04, 0.44, 1.4), at(0.25, 0.97, 0, 0, 0, 0.6), 0);
        void m; void x;
      } };
    case 'saloon': return { // Coalscuttle: a square three-box saloon, black with a white roof and a roof light pod
      L: 4.35, W: 1.72, R: 0.3, tyreW: 0.22, wb: [1.32, -1.32], ride: 0.28, smooth: false, nose: 0.08, tail: 0.08,
      top: [[2.17, 0.62], [2.14, 0.84], [0.96, 0.9], [-1.42, 0.94], [-2.15, 0.93]],
      cab: [[0.96, 0.91], [0.42, 1.41], [-0.95, 1.43], [-1.42, 0.95]], cabW: [0.92, 0.82], side: [0.85, -1.3, -0.25],
      bands: [[0.6, b], [0.63, tr], [9, b]], roof: tr, bumper: 0x9a9da6, flare: null,
      lamps: 'square', lampCol: 0xfff3cc, tailCol: [0x8f101b, 0xff4a48], rim: 'dish', rimCol: tr, glass: 0x24365c, fur: 0x8a8a90,
      extras: (s, h, m, x) => {
        s.add(new T.BoxGeometry(0.34, 0.1, 1.2), at(0.12, 1.49, 0), DARK);
        for (const z of [-0.45, -0.15, 0.15, 0.45]) { x.lens.add(new T.CircleGeometry(0.085, 14), at(0.3, 1.49, z, 0, Math.PI / 2), 0xfff3cc); s.add(new T.CylinderGeometry(0.1, 0.1, 0.08, 12), at(0.25, 1.49, z, 0, 0, Math.PI / 2), 0xd8dbe2); }
        void h; void m;
      } };
    case 'kei': return { // Mochi: a tiny rounded kei coupe, pastel pink with a cream roof and big round eyes
      L: 3.2, W: 1.45, R: 0.26, tyreW: 0.18, wb: [1.0, -1.0], ride: 0.25, smooth: true, nose: 0.36, tail: 0.3,
      top: [[1.6, 0.54], [1.55, 0.76], [1.15, 0.9], [-1.5, 0.98], [-1.6, 0.95]],
      cab: [[1.15, 0.91], [0.6, 1.5], [-1.22, 1.53], [-1.56, 1.0]], cabW: [0.95, 0.8], side: [0.95, -1.2, -0.15],
      bands: [[0.42, tr], [9, b]], roof: tr, bumper: tr, flare: null,
      lamps: 'round', lampCol: 0xfff3cc, tailCol: [0x8f101b, 0xff4a48], rim: 'steel', rimCol: tr, glass: 0x34507a, fur: 0xc9a27a };
    case 'coupe': return { // Ironhorn: a long 70s coupe, silver with bronze, chrome bumpers and twin round lamps
      L: 4.6, W: 1.74, R: 0.31, tyreW: 0.23, wb: [1.45, -1.32], ride: 0.27, smooth: false, nose: 0.1, tail: 0.1,
      top: [[2.3, 0.62], [2.26, 0.8], [0.42, 0.87], [-1.7, 0.91], [-2.3, 0.88]],
      cab: [[0.42, 0.88], [-0.22, 1.29], [-1.0, 1.31], [-1.72, 0.92]], cabW: [0.9, 0.76], side: [0.25, -1.45, -0.7],
      bands: [[0.5, b], [0.56, tr], [9, b]], roof: tr, bumper: 0xe3e7ee, flare: null,
      lamps: 'twin', lampCol: 0xfff3cc, tailCol: [0x8f101b, 0xff4a48], rim: 'dish', rimCol: tr, glass: 0x24365c, fur: 0xe8e2d4 };
    case 'fastback': default: {
      const dark = (((b >> 16) & 255) + ((b >> 8) & 255) + (b & 255)) / 3 < 110;
      if (dark) return { // Nightjar: a sharp matte-black fastback with violet slit lamps and rear louvres
        L: 4.3, W: 1.74, R: 0.3, tyreW: 0.23, wb: [1.32, -1.3], ride: 0.24, smooth: false, nose: 0.2, tail: 0.1,
        top: [[2.15, 0.48], [2.02, 0.6], [0.75, 0.82], [-1.95, 0.92], [-2.15, 0.88]],
        cab: [[0.75, 0.83], [0.0, 1.22], [-0.5, 1.24], [-2.02, 0.93]], cabW: [0.9, 0.72], side: [0.6, -1.3, -0.25],
        bands: [[0.4, tr], [0.43, b], [9, b]], roof: b, bumper: b, flare: b,
        lamps: 'slim', lampCol: 0xd9c4ff, tailCol: [0x5a1a8c, 0xc06bff], rim: 'spoke5', rimCol: 0x55505f, glass: 0x1c2240, fur: 0x3b2f45,
        extras: (s, h, m) => {
          // louvres over the long rear glass and a ducktail
          for (let k = 0; k < 6; k++) { const xx = -0.75 - k * 0.2, yy = 1.22 - ((-0.5 - xx) / 1.52) * 0.29 + 0.025; s.add(new T.BoxGeometry(0.05, 0.025, 1.1), at(xx, yy, 0, 0, 0, 0.19), b); }
          lipSpoiler(s, h, m, 0.1, b);
        } };
      return { // Daybreak: a smooth white fastback with gold pinstripes, pop-ups and a tall rear wing
        L: 4.3, W: 1.74, R: 0.3, tyreW: 0.23, wb: [1.32, -1.3], ride: 0.25, smooth: true, nose: 0.3, tail: 0.2,
        top: [[2.16, 0.5], [2.04, 0.6], [0.8, 0.8], [-1.9, 0.9], [-2.15, 0.86]],
        cab: [[0.8, 0.81], [0.05, 1.2], [-0.6, 1.22], [-1.98, 0.91]], cabW: [0.9, 0.74], side: [0.65, -1.25, -0.2],
        bands: [[0.4, 0x2b2b30], [0.56, b], [0.58, tr], [0.6, b], [0.615, tr], [9, b]], roof: b, bumper: b, flare: null,
        lamps: 'popup', lampCol: 0xfff3cc, tailCol: [0x8f101b, 0xff4a48], rim: 'mesh', rimCol: tr, glass: 0x24365c, fur: 0xcfd3dc,
        extras: (s, h) => {
          s.add(new T.BoxGeometry(0.34, 0.04, 1.62), at(-1.98, 1.2, 0, 0, 0, 0.06), tr); h.add(new T.BoxGeometry(0.34, 0.04, 1.62), at(-1.98, 1.2, 0, 0, 0, 0.06), 0);
          for (const z of [-0.68, 0.68]) s.add(new T.BoxGeometry(0.12, 0.3, 0.04), at(-1.98, 1.04, z, 0, 0, -0.2), tr);
        } };
    }
  }
}
const glassPanes: [T.BufferGeometry, T.Matrix4][] = [];
function lipSpoiler(s: Soup, h: Soup, m: Model, lift: number, col: number) {
  const x = -m.L / 2 + 0.2, y = topAt(m, x) + lift;
  s.add(new T.BoxGeometry(0.36, 0.045, m.W - 0.16), at(x, y, 0, 0, 0, 0.08), col); h.add(new T.BoxGeometry(0.36, 0.045, m.W - 0.16), at(x, y, 0, 0, 0, 0.08), 0);
  for (const z of [-m.W / 2 + 0.22, m.W / 2 - 0.22]) s.add(new T.BoxGeometry(0.1, lift, 0.05), at(x, y - lift / 2, z), col);
}
function lerpLine(pts: [number, number][], x: number) {
  if (x >= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (x >= pts[i][0]) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; return y1 + ((y0 - y1) * (x - x1)) / (x0 - x1 || 1); }
  return pts[pts.length - 1][1];
}
const topAt = (m: Model, x: number) => lerpLine(m.top, x);
function halfW(m: Model, x: number) {
  const L2 = m.L / 2, r = x >= 0 ? m.nose : m.tail, e = Math.abs(x) - (L2 - r);
  return e > 0 ? m.W / 2 - r + Math.sqrt(Math.max(0, r * r - e * e)) : m.W / 2;
}
function bottomAt(m: Model, x: number) {
  let b = m.ride; const ra = m.R + 0.07;
  for (const wx of m.wb) { const d = x - wx; if (Math.abs(d) < ra) b = Math.max(b, m.R + Math.sqrt(ra * ra - d * d) * 0.92); }
  return Math.min(b, topAt(m, x) - 0.1);
}

/** The lower body: a ring at each station, colour bands up the sides, the sills arched over the wheels. */
function lowerBody(m: Model, s: Soup, h: Soup) {
  const L2 = m.L / 2, xs: number[] = [];
  for (let x = L2; x > -L2; x -= 0.07) xs.push(x);
  xs.push(-L2);
  const ring = (x: number) => {
    const t = topAt(m, x), b = bottomAt(m, x), w = halfW(m, x);
    const pts: [number, number][] = [[w * 0.86, b], [w, b + 0.05]], cols: number[] = [SILL];
    let prev = b + 0.05;
    for (const [y, col] of m.bands) { const yy = Math.max(prev + 0.002, Math.min(y, t - 0.07)); pts.push(y < 9 ? [w, yy] : [w * 0.985, yy]); cols.push(col); prev = yy; }
    pts.push([w * 0.9, t]); cols.push(m.bands[m.bands.length - 1][1]);
    // mirror to the other side: top across, then down the left
    const n = pts.length, full: [number, number][] = pts.slice(), fc = cols.slice();
    fc.push(m.bands[m.bands.length - 1][1]); // across the top
    for (let k = n - 1; k >= 0; k--) { full.push([-pts[k][0], pts[k][1]]); if (k > 0) fc.push(cols[k - 1]); }
    fc.push(DARK); // underside back to the start
    return { pts: full, cols: fc, yc: (t + b) / 2 };
  };
  const rings = xs.map((x) => ({ x, ...ring(x) }));
  const P = (x: number, q: [number, number]) => [x, q[1], q[0]];
  for (let i = 0; i < rings.length - 1; i++) {
    const A = rings[i], B = rings[i + 1], mid = [(A.x + B.x) / 2, (A.yc + B.yc) / 2, 0], n = A.pts.length;
    for (let k = 0; k < n; k++) {
      const k2 = (k + 1) % n, col = A.cols[k];
      const a = P(A.x, A.pts[k]), b = P(A.x, A.pts[k2]), c = P(B.x, B.pts[k2]), d = P(B.x, B.pts[k]);
      const sm = m.smooth ? [a, b, c, d].map((v, j) => { const yc = j < 2 ? A.yc : B.yc; const l = Math.hypot(v[2], (v[1] - yc) * 1.6) || 1; return [0, ((v[1] - yc) * 1.6) / l, v[2] / l]; }) : undefined;
      s.quad(a, b, c, d, col, mid, sm); h.quad(a, b, c, d, 0, mid);
    }
  }
  // the nose and tail faces
  for (const R of [rings[0], rings[rings.length - 1]]) {
    const n = R.pts.length, cen = [R.x, R.yc, 0], inside = [R.x - Math.sign(R.x), R.yc, 0];
    for (let k = 0; k < n; k++) { const a = P(R.x, R.pts[k]), b = P(R.x, R.pts[(k + 1) % n]); const col = R.cols[k] === DARK ? m.bumper : R.cols[k]; s.tri(cen, a, b, col, inside); h.tri(cen, a, b, 0, inside); }
  }
}

/** The glasshouse: windows, pillars, roof rails and roof; glass goes to its own soup. */
function glasshouse(m: Model, s: Soup, g: Soup, h: Soup) {
  const cab = m.cab!; const x0 = cab[0][0], x1 = cab[cab.length - 1][0];
  const xs: number[] = []; for (let x = x0; x > x1; x -= 0.06) xs.push(x); xs.push(x1);
  const [xf, xr, xb] = m.side, roofF = cab[1][0], roofB = cab[2][0];
  const ring = (x: number) => {
    const base = topAt(m, x) - 0.03, ch = Math.max(base, lerpLine(cab, x)), w = halfW(m, x), cw = w * m.cabW[0], rw = w * m.cabW[1];
    const belt = Math.min(ch, base + 0.035), win = belt + (ch - belt) * 0.84, ww = cw + (rw - cw) * 0.84;
    return { pts: [[cw, base], [cw - 0.004, belt], [ww, win], [rw, ch], [-rw, ch], [-ww, win], [-cw + 0.004, belt], [-cw, base]] as [number, number][], yc: (base + ch) / 2 };
  };
  const rings = xs.map((x) => ({ x, ...ring(x) }));
  const P = (x: number, q: [number, number]) => [x, q[1], q[0]];
  for (let i = 0; i < rings.length - 1; i++) {
    const A = rings[i], B = rings[i + 1], xm = (A.x + B.x) / 2, mid = [xm, (A.yc + B.yc) / 2, 0];
    const sideGlass = xm < xf && xm > xr && Math.abs(xm - xb) > 0.05, topGlass = xm > roofF || xm < roofB;
    // segments: 0 belt, 1 side window, 2 rail, 3 top, 4 rail, 5 side window, 6 belt
    for (let k = 0; k < 7; k++) {
      const a = P(A.x, A.pts[k]), b = P(A.x, A.pts[k + 1]), c = P(B.x, B.pts[k + 1]), d = P(B.x, B.pts[k]);
      const glass = k === 3 ? topGlass : k === 1 || k === 5 ? sideGlass : false;
      if (glass) g.quad(a, b, c, d, 0xffffff, mid); else s.quad(a, b, c, d, k === 3 || k === 2 || k === 4 ? m.roof : k === 0 || k === 6 ? m.bands[m.bands.length - 1][1] : m.roof, mid);
      h.quad(a, b, c, d, 0, mid);
    }
  }
  // the dark cabin inside, so the glass shows seats and not the road
  const xa = Math.min(roofF + 0.1, x0 - 0.15), xz = Math.max(roofB - 0.1, x1 + 0.15), base = topAt(m, (xa + xz) / 2) - 0.05;
  const hh = lerpLine(cab, (roofF + roofB) / 2) - base - 0.07, wz = halfW(m, 0) * m.cabW[1] * 1.9;
  s.add(new T.BoxGeometry(xa - xz, hh * 0.55, wz), at((xa + xz) / 2, base + hh * 0.27, 0), 0x121019);
}

/** A chinchilla-ish head with round pink ears, or a rival driver's head, behind the glass. */
function head(s: Soup, x: number, y: number, z: number, r: number, fur: number, ears: 'round' | 'point') {
  const k = r / 0.16;
  s.add(new T.SphereGeometry(r, 10, 8), at(x, y, z, 0, 0, 0, 1, 0.95, 1), fur);
  for (const e of [-1, 1]) {
    if (ears === 'round') s.add(new T.SphereGeometry(0.085 * k, 8, 6), at(x - 0.02, y + 0.14 * k, z + e * 0.1 * k, 0, 0, 0, 0.45, 1, 1), 0xf0aeb9);
    else s.add(new T.ConeGeometry(0.06 * k, 0.13 * k, 6), at(x - 0.02, y + 0.16 * k, z + e * 0.08 * k), fur);
  }
}

let bunLogo: T.CanvasTexture | null = null;
function bunTexture() {
  if (bunLogo || typeof document === 'undefined') return bunLogo;
  const c = document.createElement('canvas'); c.width = 256; c.height = 256; const g = c.getContext('2d')!;
  g.translate(128, 128);
  g.fillStyle = '#1d2b4a'; g.beginPath(); g.arc(0, 0, 124, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#fbf3df'; g.beginPath(); g.arc(0, 0, 112, 0, Math.PI * 2); g.fill();
  // the bun
  const grad = g.createRadialGradient(-14, -30, 8, 0, 0, 70); grad.addColorStop(0, '#ffd98a'); grad.addColorStop(1, '#c97a2a');
  g.fillStyle = grad; g.strokeStyle = '#2a1608'; g.lineWidth = 6;
  g.beginPath(); g.ellipse(0, 6, 64, 46, 0, 0, Math.PI * 2); g.fill(); g.stroke();
  g.strokeStyle = '#7a3f12'; g.lineWidth = 5; for (const dx of [-24, 0, 24]) { g.beginPath(); g.moveTo(dx - 8, -26); g.quadraticCurveTo(dx + 4, 6, dx - 6, 36); g.stroke(); }
  g.fillStyle = '#fff6dd'; g.beginPath(); g.ellipse(-24, -14, 12, 6, -0.5, 0, Math.PI * 2); g.fill();
  // the lettering round the rim
  g.fillStyle = '#1d2b4a'; g.font = '900 26px "Dela Gothic One", "Arial Black", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const arc = (text: string, r: number, mid: number, dir: 1 | -1) => {
    const step = 0.155; let a = mid - (dir * step * (text.length - 1)) / 2;
    for (const ch of text) { g.save(); g.rotate(a); g.translate(0, -dir * r); g.fillText(ch, 0, 0); g.restore(); a += dir * step; }
  };
  arc('HILLSIDE', 92, 0, 1); arc('BUN BAKERY', 92, Math.PI, -1);
  bunLogo = new T.CanvasTexture(c); bunLogo.colorSpace = T.SRGBColorSpace; bunLogo.anisotropy = 4; bunLogo.userData.keep = true;
  return bunLogo;
}

// ---------------------------------------------------------------- the rig
export type CarRig = {
  root: T.Group; body: T.Group; wheels: T.Group[]; spinners: T.Object3D[]; steer: T.Group[]; pops: T.Group[];
  tail: T.MeshBasicMaterial; tailGlow: T.MeshBasicMaterial | null; tailCol: [T.Color, T.Color]; ink: T.Object3D[]; beam: T.Mesh | null; headPool: T.Mesh | null; spot: T.SpotLight | null;
  fade: T.Material[]; faded: number; L: number; roll: number; rollV: number; pitch: number; pitchV: number;
};

/** Build a car: x forward, y up, the right-hand side (the driver's) towards +z. */
export function buildCar(look: CarLook, withLights: boolean): CarRig {
  const m = model(look), ghost = !!look.ghost;
  const root = new T.Group(), body = new T.Group(); root.add(body);
  const s = new Soup(), g = new Soup(), h = new Soup(), lens = new Soup(), tl = new Soup(), glow = new Soup(), tglow = new Soup();
  glassPanes.length = 0;
  lowerBody(m, s, h);
  if (m.cab) glasshouse(m, s, g, h);
  const L2 = m.L / 2, W2 = m.W / 2;
  // flared arches
  if (m.flare !== null || look.biscuit) for (const wx of m.wb) for (const z of [-1, 1]) {
    const tor = new T.TorusGeometry(m.R + 0.07, 0.045, 5, 12, Math.PI); s.add(tor, at(wx, m.R, z * (halfW(m, wx) + 0.005), 0, 0, 0, 1, 0.95, 1), m.flare ?? 0x2a2b31);
  }
  // bumpers, wrapping round the corners
  for (const e of [1, -1]) {
    const x = e * (L2 + 0.02), w = halfW(m, e * (L2 - 0.05)) * 2 + 0.06;
    s.add(new T.BoxGeometry(0.14, 0.15, w), at(x - e * 0.03, m.ride + 0.1, 0), m.bumper); h.add(new T.BoxGeometry(0.14, 0.15, w), at(x - e * 0.03, m.ride + 0.1, 0), 0);
  }
  // the grille, lamps and indicators on the nose
  const noseY = (bottomAt(m, L2) + topAt(m, L2)) / 2 + 0.04, nw = halfW(m, L2 - 0.01);
  s.add(new T.BoxGeometry(0.02, 0.12, nw * 0.9), at(L2 + 0.004, noseY - 0.02, 0), DARK);
  for (const z of [-1, 1]) lens.add(new T.PlaneGeometry(0.1, 0.06), at(L2 + 0.01, m.ride + 0.21, z * (nw - 0.06), 0, Math.PI / 2), 0xffa53a);
  const pops: T.Group[] = [], popInk: T.Object3D[] = [];
  if (m.lamps === 'round') for (const z of [-1, 1]) { s.add(new T.BoxGeometry(0.03, 0.28, 0.3), at(L2 + 0.002, noseY, z * (nw - 0.2)), DARK); lens.add(new T.CircleGeometry(0.11, 16), at(L2 + 0.02, noseY, z * (nw - 0.2), 0, Math.PI / 2), m.lampCol); }
  if (m.lamps === 'twin') for (const z of [-1, 1]) for (const k of [0, 1]) lens.add(new T.CircleGeometry(0.085, 14), at(L2 + 0.02, noseY, z * (nw - 0.14 - k * 0.22), 0, Math.PI / 2), m.lampCol);
  if (m.lamps === 'square') for (const z of [-1, 1]) lens.add(new T.PlaneGeometry(0.34, 0.15), at(L2 + 0.02, noseY, z * (nw - 0.24), 0, Math.PI / 2), m.lampCol);
  if (m.lamps === 'slim') for (const z of [-1, 1]) lens.add(new T.PlaneGeometry(0.42, 0.05), at(L2 + 0.02, noseY + 0.02, z * (nw - 0.3), 0, Math.PI / 2), m.lampCol);
  if (m.lamps === 'popup' && !ghost) {
    // both pods swing up together on one hinge across the bonnet
    const hx = L2 - 0.5, hy = topAt(m, hx) - 0.13, hinge = new T.Group(); hinge.position.set(hx, hy, 0); body.add(hinge);
    const ps = new Soup(), pl = new Soup(), ph = new Soup();
    for (const z of [-1, 1]) {
      const zz = z * (W2 - 0.4);
      ps.add(new T.BoxGeometry(0.3, 0.15, 0.4), at(0.15, 0.075, zz), look.body); ph.add(new T.BoxGeometry(0.3, 0.15, 0.4), at(0.15, 0.075, zz), 0);
      pl.add(new T.PlaneGeometry(0.34, 0.11), at(0.302, 0.075, zz, 0, Math.PI / 2), m.lampCol);
    }
    hinge.add(new T.Mesh(ps.geometry(), toon(0xffffff, { vertexColors: true })), new T.Mesh(pl.geometry(), new T.MeshBasicMaterial({ vertexColors: true })));
    const o = new T.Mesh(hull(ph.geometry()), INK_CAR); o.layers.set(1); hinge.add(o); popInk.push(o);
    hinge.rotation.z = -0.46; pops.push(hinge);
  }
  // tail lamps and their bloom
  const tailY = Math.min(topAt(m, -L2) - 0.14, Math.max(m.ride + 0.32, bottomAt(m, -L2) + 0.3)), tw = halfW(m, -L2 + 0.01);
  for (const z of [-1, 1]) {
    const wide = m.lamps === 'slim' ? tw - 0.15 : 0.36;
    tl.add(new T.PlaneGeometry(wide, m.lamps === 'slim' ? 0.07 : 0.13), at(-L2 - 0.012, tailY, z * (tw - 0.08 - wide / 2), 0, -Math.PI / 2), 0xffffff);
    lens.add(new T.PlaneGeometry(0.1, 0.13), at(-L2 - 0.01, tailY, z * (tw - 0.08 - wide - 0.06), 0, -Math.PI / 2), 0xffa53a);
    tglow.add(new T.PlaneGeometry(0.95, 0.5), at(-L2 - 0.05, tailY, z * (tw - 0.08 - wide / 2), 0, -Math.PI / 2), 0xffffff);
    glow.add(new T.PlaneGeometry(0.85, 0.85), at(L2 + 0.05, noseY, z * (nw - 0.22), 0, Math.PI / 2), 0xffffff);
  }
  if (m.extras) m.extras(s, h, m, { lens, body: look.body, trim: look.trim });
  // who is inside
  if (m.cab || look.shape === 'roadster') {
    const hx = m.cab ? (m.cab[1][0] + m.cab[2][0]) / 2 + 0.12 : -0.45, room = (m.cab ? lerpLine(m.cab, hx) : topAt(m, hx) + 0.62) - topAt(m, hx);
    const r = Math.min(0.16, room * 0.3), hy = topAt(m, hx) + room * 0.4, hz = halfW(m, hx) * 0.42;
    if (look.biscuit) { head(s, hx, hy, hz, r, m.fur, 'round'); head(s, hx, hy, -hz, r, 0x8e9db4, 'round'); }
    else head(s, hx, hy, hz, r, m.fur, look.shape === 'kei' ? 'round' : 'point');
  }
  for (const [pg, pm] of glassPanes) g.add(pg, pm, 0xffffff);
  // meshes
  const fade: T.Material[] = [];
  const ghostMat = () => new T.MeshBasicMaterial({ color: 0x9fc6ff, transparent: true, opacity: 0.3, depthWrite: false });
  const bodyMat = ghost ? ghostMat() : toon(0xffffff, { vertexColors: true });
  const bm = new T.Mesh(s.geometry(), bodyMat); bm.castShadow = !ghost; body.add(bm); fade.push(bodyMat);
  const glassMat = ghost ? ghostMat() : glassMaterial(m.glass);
  if (!g.empty) { const gm = new T.Mesh(g.geometry(), glassMat); body.add(gm); fade.push(glassMat); }
  const ink: T.Object3D[] = [];
  if (!ghost) { const o = new T.Mesh(hull(h.geometry()), INK_CAR); o.layers.set(1); body.add(o); ink.push(o); }
  ink.push(...popInk);
  const tail = new T.MeshBasicMaterial({ color: m.tailCol[0] });
  let tailGlow: T.MeshBasicMaterial | null = null;
  if (!ghost) {
    body.add(new T.Mesh(lens.geometry(), new T.MeshBasicMaterial({ vertexColors: true })));
    body.add(new T.Mesh(tl.geometry(), tail));
    const tex = softGlow();
    tailGlow = new T.MeshBasicMaterial({ map: tex, color: m.tailCol[1], transparent: true, opacity: 0.25, depthWrite: false, blending: T.AdditiveBlending });
    body.add(new T.Mesh(tglow.geometry(), tailGlow));
    if (m.lamps !== 'popup') body.add(new T.Mesh(glow.geometry(), new T.MeshBasicMaterial({ map: tex, color: m.lampCol, transparent: true, opacity: 0.7, depthWrite: false, blending: T.AdditiveBlending })));
  }
  // the Biscuit's bun logo on both doors
  if (look.biscuit && !ghost) {
    const tex = bunTexture();
    if (tex) {
      const ls = new Soup(); const uvs: number[] = [];
      for (const z of [-1, 1]) { const c = new T.CircleGeometry(0.27, 28); c.translate(0, 0, 0); const nonIdx = c.toNonIndexed(); const uv = nonIdx.attributes.uv; for (let i = 0; i < uv.count; i++) uvs.push(z > 0 ? uv.getX(i) : 1 - uv.getX(i), uv.getY(i)); ls.add(nonIdx, at(-0.2, 0.76, z * (W2 + 0.006), 0, z > 0 ? 0 : Math.PI), 0xffffff); }
      const lg = ls.geometry(); lg.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
      body.add(new T.Mesh(lg, new T.MeshBasicMaterial({ map: tex, transparent: true })));
    }
  }
  // wheels: tyre and spoked rim in one mesh, front ones steer
  const wheels: T.Group[] = [], spinners: T.Object3D[] = [], steer: T.Group[] = [];
  const wg = wheelGeo(m.rim, m.rimCol, m.R, m.tyreW);
  const wheelMat = ghost ? ghostMat() : toon(0xffffff, { vertexColors: true }); fade.push(wheelMat);
  for (const [ax, front] of [[m.wb[0], true], [m.wb[1], false]] as const) for (const side of [-1, 1]) {
    const pivot = new T.Group(); pivot.position.set(ax, m.R, side * (halfW(m, ax) - m.tyreW / 2 - 0.035)); root.add(pivot);
    const spin = new T.Group(); pivot.add(spin);
    const w = new T.Mesh(wg.geo, wheelMat); w.scale.z = side; w.castShadow = !ghost; spin.add(w);
    if (!ghost) { const o = new T.Mesh(wg.ink, INK_CAR); o.layers.set(1); spin.add(o); ink.push(o); }
    wheels.push(pivot); spinners.push(spin); if (front) steer.push(pivot);
  }
  // headlight beams (faint cones, strong in fog), a spot light and a warm pool on the road
  let beam: T.Mesh | null = null, spot: T.SpotLight | null = null, headPool: T.Mesh | null = null;
  if (withLights && !ghost) {
    const bs = new Soup();
    for (const z of [-1, 1]) { const bg = new T.ConeGeometry(2.6, 22, 16, 1, true); bs.add(bg, at(L2 + 11, noseY - 0.1, z * (nw - 0.22), 0, 0, Math.PI / 2), 0xffffff); }
    beam = new T.Mesh(bs.geometry(), new T.MeshBasicMaterial({ color: m.lampCol, transparent: true, opacity: 0.06, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, fog: false }));
    root.add(beam);
    spot = new T.SpotLight(0xfff0d0, 90, 85, 0.5, 0.55, 1.1);
    spot.position.set(L2, 0.8, 0); spot.target.position.set(L2 + 20, -0.6, 0); root.add(spot); root.add(spot.target);
    const tex = softGlow();
    headPool = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: tex, color: 0xffe6b0, transparent: true, opacity: 0.4, depthWrite: false, blending: T.AdditiveBlending, fog: false }));
    headPool.rotation.x = -Math.PI / 2; headPool.scale.set(12, 6.5, 1); headPool.position.set(8, 0.07, 0); root.add(headPool);
  }
  const tc: [T.Color, T.Color] = [new T.Color(m.tailCol[0]), new T.Color(m.tailCol[1])];
  return { root, body, wheels, spinners, steer, pops, tail, tailGlow, tailCol: tc, ink, beam, headPool, spot, fade, faded: 0, L: m.L, roll: 0, rollV: 0, pitch: 0, pitchV: 0 };
}

/** Spare primitives merged, for props built in the scenery. */
export function merged(parts: T.BufferGeometry[]) { return mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)))!; }
