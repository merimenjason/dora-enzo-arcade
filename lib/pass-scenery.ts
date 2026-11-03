// Kumori Pass: scenery builders for the scene. Layered, toon-shaded rock cuttings with mossy ledges; distant ridges in
// three hazy layers with a lit rim; the town's lights down in the valley; a moonlit lake that glints; cedars in two
// shapes; and the props (shrine gates, vending machines, lamp heads) merged so the whole set costs a few draw calls.
import * as T from 'three';
import type { Track } from './pass-tracks';
import { Soup, at, hull, INK_PROP, softGlow, toon } from './pass-models';

function hash(i: number) { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
function noise1(x: number, k: number) { const i = Math.floor(x), f = x - i, s = f * f * (3 - 2 * f); return hash(i + k * 101) * (1 - s) + hash(i + 1 + k * 101) * s; }

type Place = (i: number, d: number, up: number) => number[];

/** A rock cutting: big stepped ledges climbing away from the road, broken into slabs of three rock tones with dark
 * crevices under each step, moss on the ledges and grass on top. */
export function rockCut(t: Track, place: Place, edge: (i: number) => number, side: 1 | -1, keep: (i: number) => boolean, ground: (i: number, d: number) => number) {
  const s = new Soup(), h = new Soup();
  const ROCK = [0x8a8294, 0x6f697e, 0x9c93a2, 0x7c7488], CREVICE = 0x2a2633, MOSS = 0x3d5e41, GRASS = 0x2f4b37;
  // the profile: (out from the edge, up from the road); the steps drift along the road and each sample is roughened
  const prof = (i: number) => {
    const n = (k: number) => noise1(i * 0.11, k) - 0.5, r = (k: number) => (hash(i * 13.7 + k) - 0.5) * 0.12;
    const pts: [number, number][] = [[0, -0.3]];
    let o = 0.1 + n(1) * 0.15, y = 1.7 + n(2) * 0.9; pts.push([o, y]);
    for (let step = 0; step < 3; step++) {
      // a dark crevice under the overhang, then the ledge, then the next face
      o -= 0.12; pts.push([o, y + 0.18]);
      o += 0.75 + n(3 + step) * 0.5 + r(step); y += 0.25 + n(9 + step) * 0.15; pts.push([o, y]);
      o += 0.25 + Math.abs(n(13 + step)) * 0.35 + r(step + 5); y += 1.6 + n(17 + step) * 1.1; pts.push([o, y]);
    }
    o += 3; pts.push([o, y + 0.6]);
    o += 5; pts.push([o, Math.max(y - 1.5, ground(i, o))]);
    return pts;
  };
  // segment colours: 0 base face, then per step: crevice, ledge (moss), face; then the grassy top and back
  const segCol = (k: number, i: number) => {
    const last = 1 + 3 * 3; if (k >= last) return GRASS;
    if (k === 0) return ROCK[Math.floor(hash(Math.floor(i / 5) * 3.3) * 4)];
    const m = (k - 1) % 3; if (m === 0) return CREVICE; if (m === 1) return MOSS;
    return ROCK[Math.floor(hash(Math.floor(i / (4 + k)) * 7.1 + k) * 4)];
  };
  let prev: { i: number; p: number[][] } | null = null;
  for (let i = 0; i < t.n; i += 3) {
    if (!keep(i)) { prev = null; continue; }
    const pr = prof(i), p = pr.map(([o, y]) => place(i, edge(i) + side * o, y));
    if (prev) {
      for (let k = 0; k < p.length - 1; k++) {
        const a = prev.p[k], b = prev.p[k + 1], c = p[k + 1], d = p[k];
        // the inside of the rock is further out and lower
        const mo = (pr[k][0] + pr[k + 1][0]) / 2 + 1.5, my = (pr[k][1] + pr[k + 1][1]) / 2 - 1.5, inside = place(i, edge(i) + side * mo, my);
        const shade = 0.88 + hash(Math.floor(i / 6) * 5 + k) * 0.24, col = new T.Color(segCol(k, i)).multiplyScalar(shade).getHex();
        s.quad(a, b, c, d, col, inside); if (k < p.length - 2) h.quad(a, b, c, d, 0, inside);
      }
    }
    prev = { i, p };
  }
  if (s.empty) return null;
  const mesh = new T.Mesh(s.geometry(), toon(0xffffff, { vertexColors: true, emissive: 0x100e16 })); mesh.receiveShadow = true;
  const ink = new T.Mesh(hull(h.geometry()), INK_PROP); ink.layers.set(1);
  return { mesh, ink };
}

/** Three rings of ridges round the pass, hazier further out, with a pale rim along the crest. */
export function ridges(cx: number, cy: number, cz: number) {
  const layers: { mesh: T.Mesh; mat: T.MeshBasicMaterial; night: T.Color; dawn: T.Color }[] = [];
  const spec = [[1500, 300, 0x1a2244, 0x6a4a6e], [1150, 210, 0x141b38, 0x4d3a5e], [850, 140, 0x10162e, 0x3a2e4e]] as const;
  spec.forEach(([R, amp, night, dawn], L) => {
    const N = 220, pos: number[] = [], col: number[] = [], idx: number[] = [];
    for (let k = 0; k <= N; k++) {
      const a = (k / N) * Math.PI * 2, u = k / N * 40;
      const ridge = Math.abs(noise1(u, L + 1) - 0.5) * 2, peak = Math.pow(noise1(u * 0.31, L + 7), 2.2);
      const y = cy - 60 + amp * (0.35 + 0.4 * (1 - ridge) + 0.9 * peak) - L * 30;
      const x = cx + Math.cos(a) * R, z = cz - Math.sin(a) * R;
      for (const [yy, c] of [[cy - 400, 0.55], [y - 6, 1], [y, 1.9]] as const) { pos.push(x, yy, z); col.push(c, c, c); }
      if (k) { const b = (k - 1) * 3, c = k * 3; for (let r = 0; r < 2; r++) idx.push(b + r, c + r, b + r + 1, b + r + 1, c + r, c + r + 1); }
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new T.Float32BufferAttribute(col, 3)); g.setIndex(idx);
    const mat = new T.MeshBasicMaterial({ color: night, vertexColors: true, fog: false, side: T.DoubleSide });
    const mesh = new T.Mesh(g, mat); mesh.renderOrder = -2 + L;
    layers.push({ mesh, mat, night: new T.Color(night), dawn: new T.Color(dawn) });
  });
  return layers;
}

/** The town's lights, scattered down in the valley in a few clusters along a shore line. */
export function townLights(x: number, y: number, z: number, dirX: number, dirZ: number) {
  const n = 700, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), c = new T.Color();
  const px = -dirZ, pz = dirX; // along the valley
  for (let i = 0; i < n; i++) {
    const along = (hash(i * 3.1) - 0.5) * 900, clump = Math.floor(hash(i * 5.7) * 5), depth = Math.pow(hash(i * 1.3), 1.8) * 160 + clump * 18;
    pos[i * 3] = x + px * along + dirX * depth; pos[i * 3 + 1] = y + hash(i * 9.1) * 8; pos[i * 3 + 2] = z + pz * along + dirZ * depth;
    c.setHex(hash(i * 2.2) < 0.7 ? 0xffd27a : hash(i) < 0.5 ? 0xfff2d6 : 0xff9a5a); col.set([c.r, c.g, c.b], i * 3);
  }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('color', new T.BufferAttribute(col, 3));
  return new T.Points(g, new T.PointsMaterial({ size: 2.4, sizeAttenuation: false, vertexColors: true, fog: false, transparent: true, opacity: 0.95, depthWrite: false }));
}

/** A lake: deep blue, a glinting column of moonlight towards the moon, and dashes of ripple. */
export function lake(level: number, cx: number, cz: number, moonDir: T.Vector2) {
  const mat = new T.ShaderMaterial({
    fog: true, transparent: false,
    uniforms: T.UniformsUtils.merge([T.UniformsLib.fog, { time: { value: 0 }, moon: { value: moonDir.clone().normalize() }, deep: { value: new T.Color(0x121d44) }, near: { value: new T.Color(0x2e4686) }, glint: { value: new T.Color(0xfff2d0) }, bright: { value: 1 } }]),
    vertexShader: `varying vec3 vW;
#include <common>
#include <fog_pars_vertex>
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz;
  vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
#include <fog_vertex>
}`,
    fragmentShader: `uniform float time; uniform vec2 moon; uniform vec3 deep; uniform vec3 near; uniform vec3 glint; uniform float bright; varying vec3 vW;
#include <common>
#include <fog_pars_fragment>
void main() {
  vec2 d = vW.xz - cameraPosition.xz; float dist = length(d); vec2 dir = d / max(dist, 0.001);
  float a = dot(dir, moon);
  float column = smoothstep(0.9, 0.995, a);
  float dash = step(0.62, fract(vW.x * 0.07 + sin(vW.z * 0.21 + time * 0.6) * 0.6 + time * 0.05)) * step(0.5, fract(vW.z * 0.19 + time * 0.3));
  float sparkle = step(0.93, fract(sin(dot(floor(vW.xz * 0.35) + floor(time * 4.0), vec2(12.9898, 78.233))) * 43758.5453));
  vec3 c = mix(near, deep, smoothstep(30.0, 600.0, dist));
  c += glint * column * (0.25 + dash * 0.9 + sparkle * 0.8) * bright;
  // painted ripples: short pale strokes across the whole lake, thinning with distance
  float rip = step(0.86, fract(vW.z * 0.42 + sin(vW.x * 0.05 + time * 0.4) * 0.8)) * step(0.55, fract(vW.x * 0.09 + floor(vW.z * 0.42) * 0.37 + time * 0.08));
  c += vec3(0.55, 0.68, 1.0) * rip * 0.22 * bright * (1.0 - smoothstep(60.0, 700.0, dist));
  c += glint * dash * 0.05 * bright;
  gl_FragColor = vec4(c, 1.0);
#include <colorspace_fragment>
#include <fog_fragment>
}`,
  });
  const m = new T.Mesh(new T.PlaneGeometry(5000, 5000).rotateX(-Math.PI / 2), mat); m.position.set(cx, level, cz); m.renderOrder = -1;
  return { mesh: m, mat };
}

/** A cedar: a trunk and drooping tiers, painted in vertex colours. tall: a slim old cedar; else a young bushy one. */
export function cedar(tall: boolean) {
  const s = new Soup();
  s.add(new T.CylinderGeometry(0.22, 0.38, tall ? 4 : 2.6, 5, 1, true).translate(0, tall ? 2 : 1.3, 0), null, 0x4a3324);
  const greens = [0x1d4632, 0x22513a, 0x285c40, 0x2e6646, 0x33704c];
  const tiers = tall ? [[2.3, 3.4, 3.2], [2.0, 3.2, 5.0], [1.65, 3.0, 6.7], [1.3, 2.7, 8.3], [0.85, 2.4, 9.8]] : [[2.4, 3.2, 2.4], [1.9, 2.9, 3.9], [1.3, 2.6, 5.3]];
  tiers.forEach(([r, hh, y], k) => s.add(new T.ConeGeometry(r, hh, 7).translate(0, y, 0), null, greens[k + (tall ? 0 : 1)]));
  return s.geometry();
}

/** Shrine gates (and the lantern arch over the finish), merged into one mesh and one ink. */
export class Props {
  body = new Soup(); ink = new Soup(); lens = new Soup(); faces = new Soup(); faceUV: number[] = []; pools = new Soup();
  glowP: number[] = []; glowC: number[] = []; glowS: number[] = [];
  gate(p: T.Vector3, rot: number, finish = false) {
    const red = finish ? 0x2b2f3a : 0xc8352a, span = finish ? 9.6 : 3.4, hgt = finish ? 5.4 : 3.6;
    const parts: [T.BufferGeometry, number, number, number, number][] = [
      [new T.CylinderGeometry(0.16, 0.2, hgt, 10), -span / 2, hgt / 2, 0, red], [new T.CylinderGeometry(0.16, 0.2, hgt, 10), span / 2, hgt / 2, 0, red],
      [new T.BoxGeometry(span + 1.4, 0.26, 0.34), 0, hgt + 0.1, 0, red], [new T.BoxGeometry(span + 1.6, 0.1, 0.4), 0, hgt + 0.27, 0, 0x1d1b22],
      [new T.BoxGeometry(span + 0.4, 0.16, 0.22), 0, hgt - 0.6, 0, red]];
    const m = new T.Matrix4(), r = new T.Matrix4().makeRotationY(rot);
    for (const [g, x, y, z, col] of parts) {
      m.makeTranslation(p.x, p.y, p.z).multiply(r).multiply(new T.Matrix4().makeTranslation(x, y, z));
      this.ink.add(g.clone(), m, 0); this.body.add(g, m, col);
    }
    if (finish) for (let k = -3; k <= 3; k++) {
      m.makeTranslation(p.x, p.y, p.z).multiply(r).multiply(new T.Matrix4().makeTranslation(k * 1.3, hgt - 1.0, 0));
      this.lens.add(new T.SphereGeometry(0.28, 10, 8).scale(1, 1.3, 1), m, 0xffb35a);
      const e = new T.Vector3().setFromMatrixPosition(m); this.glow(e.x, e.y, e.z, 0xffa04a, 3.2);
    }
  }
  /** a vending machine facing the road: a cabinet, a lit face from the atlas, a glow and a pool on the ground */
  vending(p: T.Vector3, rot: number, k: number) {
    const m = new T.Matrix4().makeTranslation(p.x, p.y, p.z).multiply(new T.Matrix4().makeRotationY(rot));
    const cab = new T.BoxGeometry(1.0, 1.9, 0.75).translate(0, 0.95, 0);
    this.ink.add(cab.clone(), m, 0); this.body.add(cab, m, k ? 0xd8452f : 0x2f6fd0);
    const face = new T.PlaneGeometry(0.78, 1.15).translate(0, 1.2, 0.381).applyMatrix4(m).toNonIndexed(), uv = face.attributes.uv;
    for (let i = 0; i < uv.count; i++) this.faceUV.push(uv.getX(i) * 0.5 + k * 0.5, uv.getY(i));
    this.faces.add(face, null, 0xffffff);
    const front = new T.Vector3(0, 1.3, 0.9).applyMatrix4(m); this.glow(front.x, front.y, front.z, k ? 0xffc8a0 : 0xa8e2ff, 5);
    this.pools.add(new T.CircleGeometry(3.2, 20).rotateX(-Math.PI / 2).translate(0, 0.06, 1.8), m, k ? 0xff9a6a : 0x7fd8ff);
  }
  glow(x: number, y: number, z: number, col: number, size: number) { const c = new T.Color(col); this.glowP.push(x, y, z); this.glowC.push(c.r, c.g, c.b); this.glowS.push(size); }
  build(world: T.Object3D, vendTex: T.Texture | null) {
    const out: T.Object3D[] = [];
    if (!this.body.empty) { world.add(new T.Mesh(this.body.geometry(), toon(0xffffff, { vertexColors: true }))); const o = new T.Mesh(hull(this.ink.geometry()), INK_PROP); o.layers.set(1); world.add(o); out.push(o); }
    if (!this.lens.empty) world.add(new T.Mesh(this.lens.geometry(), new T.MeshBasicMaterial({ vertexColors: true })));
    if (!this.faces.empty && vendTex) { const g = this.faces.geometry(); g.setAttribute('uv', new T.Float32BufferAttribute(this.faceUV, 2)); world.add(new T.Mesh(g, new T.MeshBasicMaterial({ map: vendTex }))); }
    if (!this.pools.empty) world.add(new T.Mesh(this.pools.geometry(), new T.MeshBasicMaterial({ vertexColors: true, map: softGlow(), transparent: true, opacity: 0.3, depthWrite: false, blending: T.AdditiveBlending })));
    if (this.glowP.length) world.add(glowPoints(this.glowP, this.glowC, this.glowS));
    return out;
  }
}

/** Soft glows as one points draw: each point has its own colour and size in metres. */
export function glowPoints(p: number[], c: number[], s: number[]) {
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(p, 3)); g.setAttribute('color', new T.Float32BufferAttribute(c, 3)); g.setAttribute('size', new T.Float32BufferAttribute(s, 1));
  const mat = new T.ShaderMaterial({
    transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: true,
    uniforms: T.UniformsUtils.merge([T.UniformsLib.fog, { scale: { value: 500 }, map: { value: softGlow() } }]),
    vertexShader: `attribute float size; attribute vec3 color; varying vec3 vC; uniform float scale;
#include <common>
#include <fog_pars_vertex>
void main() { vC = color; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_PointSize = min(size * scale / max(1.0, -mvPosition.z), 256.0); gl_Position = projectionMatrix * mvPosition;
#include <fog_vertex>
}`,
    fragmentShader: `uniform sampler2D map; varying vec3 vC;
#include <common>
#include <fog_pars_fragment>
void main() { float a = texture2D(map, gl_PointCoord).a; gl_FragColor = vec4(vC * a, a);
#include <fog_fragment>
}`,
  });
  const pts = new T.Points(g, mat); pts.frustumCulled = false; pts.userData.glow = true; return pts;
}
