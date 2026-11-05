// Paperwing Post scene: the town in toon 3D with painted plaster, roof tiles, cobbles and grass (crooked houses with
// lit windows, the clock tower, the river and its bridges, trees and Granny Juniper's cottage), smoke curling up from
// every chimney to show the warm air, the paper glider with Dora flying and Enzo behind her with the satchel, a glowing
// ring and a bobbing envelope at every window still waiting for a letter, loose pages spinning in the air, letters
// sailing into windows, and a chase camera. The rules are in lib/glider-game.ts.
import * as T from 'three';
import { OutlineEffect } from 'three/examples/jsm/effects/OutlineEffect.js';
import { animateHuntChinchilla, createHuntChinchilla, poseArms, type HuntChinchilla } from './hunt-chinchilla';
import { HALF, RIVER_HALF, groundAt, riverZ, roofTop, type Flight, type FlightEvent, type House, type Level, type Sky } from './glider-game';

const ramp = new T.DataTexture(new Uint8Array([120, 200, 255]), 3, 1, T.RedFormat);
ramp.minFilter = ramp.magFilter = T.NearestFilter; ramp.generateMipmaps = false; ramp.needsUpdate = true;
const toon = (color: number, o: T.MeshToonMaterialParameters = {}) => new T.MeshToonMaterial({ color, gradientMap: ramp, ...o });
const noLine = <O extends T.Object3D>(o: O) => {
  const m = (o as unknown as { material?: T.Material | T.Material[] }).material;
  for (const x of Array.isArray(m) ? m : m ? [m] : []) x.userData.outlineParameters = { visible: false };
  return o;
};
const rng = (seed: number) => { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
const V3 = (x: number, y: number, z: number) => new T.Vector3(x, y, z);

// ---------------------------------------------------------------- painted textures (public/art/glider)
const loader = typeof document === 'undefined' ? null : new T.TextureLoader();
const texCache = new Map<string, T.Texture>();
function tex(name: string, rx = 1, ry = 1) {
  const key = `${name}:${rx}:${ry}`, hit = texCache.get(key); if (hit) return hit;
  const t = loader!.load(`/art/glider/${name}.webp`); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rx, ry); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4;
  texCache.set(key, t); return t;
}
let softT: T.Texture | null = null;
function softTex() {
  if (softT) return softT;
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return (softT = new T.CanvasTexture(c));
}

type Look = { sky: [number, number, number]; fog: number; hemi: [number, number, number]; sun: [number, number]; sunPos: [number, number, number]; lit: number };
const LOOKS: Record<Sky, Look> = {
  morning: { sky: [0x7ab4ec, 0xbfe0f6, 0xfff0dc], fog: 0xeef2f6, hemi: [0xffffff, 0xd0c8b0, 1.25], sun: [0xfff0dc, 2.0], sunPos: [-80, 60, -60], lit: 0.2 },
  noon: { sky: [0x5aa4e8, 0xa8d4f6, 0xf4f6ea], fog: 0xe8f0f6, hemi: [0xffffff, 0xd0cca8, 1.3], sun: [0xffffff, 2.2], sunPos: [30, 120, 20], lit: 0 },
  afternoon: { sky: [0x6aa6e0, 0xb4d6ee, 0xfff0d0], fog: 0xf0ece0, hemi: [0xffffff, 0xd0c4a0, 1.2], sun: [0xfff0d0, 2.1], sunPos: [90, 70, 40], lit: 0.1 },
  golden: { sky: [0x6a8ad0, 0xf0c8a0, 0xffd8a0], fog: 0xf6dcc0, hemi: [0xfff0e0, 0xb8a080, 1.15], sun: [0xffc890, 2.0], sunPos: [140, 35, 60], lit: 0.5 },
  sunset: { sky: [0x46468e, 0xc88ab0, 0xffb880], fog: 0xe8b8a8, hemi: [0xffe4e0, 0x8a7a90, 1.05], sun: [0xffa878, 1.8], sunPos: [160, 22, 120], lit: 1 },
};

function skyDome(cols: [number, number, number]) {
  const geo = new T.SphereGeometry(1500, 32, 16), pos = geo.getAttribute('position'), col: number[] = [];
  const top = new T.Color(cols[0]), mid = new T.Color(cols[1]), hor = new T.Color(cols[2]), c = new T.Color();
  for (let i = 0; i < pos.count; i++) { const y = pos.getY(i) / 1500; if (y > 0.15) c.copy(mid).lerp(top, Math.min(1, (y - 0.15) / 0.5)); else c.copy(hor).lerp(mid, Math.max(0, (y + 0.05) / 0.2)); col.push(c.r, c.g, c.b); }
  geo.setAttribute('color', new T.Float32BufferAttribute(col, 3));
  const m = new T.Mesh(geo, new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide, fog: false, depthWrite: false }));
  m.renderOrder = -2; return noLine(m);
}

/** simple particles: points that drift, rise or fall, and fade */
class Motes {
  pts: T.Points; pos: Float32Array; col: Float32Array; v: Float32Array; life: Float32Array; n: number; i = 0;
  constructor(n: number, size: number, private grav: number, opacity = 1) {
    this.n = n; this.pos = new Float32Array(n * 3); this.col = new Float32Array(n * 3); this.v = new Float32Array(n * 3); this.life = new Float32Array(n);
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(this.pos, 3)); g.setAttribute('color', new T.BufferAttribute(this.col, 3));
    this.pts = noLine(new T.Points(g, new T.PointsMaterial({ size, map: softTex(), vertexColors: true, transparent: true, opacity, depthWrite: false })));
    this.pts.frustumCulled = false; for (let k = 0; k < n; k++) this.pos[k * 3 + 1] = -9999;
  }
  burst(x: number, y: number, z: number, count: number, speed: number, color: number, up = 0, life = 0.8) {
    const c = new T.Color(color);
    for (let k = 0; k < count; k++) {
      const j = this.i = (this.i + 1) % this.n, a = Math.random() * Math.PI * 2, e = Math.random() * 2 - 1, s = speed * (0.4 + Math.random() * 0.6);
      this.pos.set([x, y, z], j * 3); this.v.set([Math.cos(a) * s * Math.sqrt(1 - e * e), e * s + up, Math.sin(a) * s * Math.sqrt(1 - e * e)], j * 3);
      this.col.set([c.r, c.g, c.b], j * 3); this.life[j] = life + Math.random() * life;
    }
  }
  step(dt: number, wind: [number, number] = [0, 0]) {
    for (let k = 0; k < this.n; k++) {
      if (this.life[k] <= 0) continue;
      this.life[k] -= dt; if (this.life[k] <= 0) { this.pos[k * 3 + 1] = -9999; continue; }
      this.v[k * 3 + 1] -= this.grav * dt;
      this.pos[k * 3] += (this.v[k * 3] + wind[0]) * dt; this.pos[k * 3 + 1] += this.v[k * 3 + 1] * dt; this.pos[k * 3 + 2] += (this.v[k * 3 + 2] + wind[1]) * dt;
      const f = Math.min(1, this.life[k] * 0.8); for (let a = 0; a < 3; a++) this.col[k * 3 + a] *= 0.997 + 0.003 * f;
    }
    this.pts.geometry.attributes.position.needsUpdate = true; this.pts.geometry.attributes.color.needsUpdate = true;
  }
}

// ---------------------------------------------------------------- the town
/** a pitched roof: a prism whose ridge runs along x, 1 wide, 1 deep and 1 high (scaled per house) */
function roofGeo() {
  const g = new T.BufferGeometry();
  const p = [-0.5, 0, -0.5, 0.5, 0, -0.5, 0.5, 1, 0, -0.5, 1, 0, -0.5, 0, 0.5, 0.5, 0, 0.5, 0.5, 1, 0, -0.5, 1, 0];
  // two slopes (each a quad) and two gable ends
  const pos: number[] = [], uv: number[] = [];
  const quad = (a: number, b: number, c: number, d: number) => { for (const i of [a, b, c, a, c, d]) pos.push(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]); uv.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1); };
  quad(1, 0, 3, 2); quad(4, 5, 6, 7);
  for (const tri of [[0, 4, 3], [5, 1, 2]]) { for (const i of tri) pos.push(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]); uv.push(0, 0, 1, 0, 0.5, 1); }
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.computeVertexNormals();
  return g;
}
function pyramidGeo() { const g = new T.ConeGeometry(Math.SQRT1_2, 1, 4, 1); g.rotateY(Math.PI / 4); g.translate(0, 0.5, 0); return g; }

function buildTown(hs: House[], look: Look) {
  const g = new T.Group(), r = rng(31), box = new T.BoxGeometry(1, 1, 1), roof = roofGeo(), pyr = pyramidGeo();
  const walls = new Map<number, T.Material>(), tiles = new Map<number, T.Material>();
  const wallM = (c: number) => walls.get(c) ?? (walls.set(c, toon(c, { map: tex('tex-wall', 2, 1) })), walls.get(c)!);
  const tileM = (c: number) => tiles.get(c) ?? (tiles.set(c, toon(c, { map: tex('tex-roof', 3, 2), side: T.DoubleSide })), tiles.get(c)!);
  const chimM = toon(0xa86a5a), potM = toon(0x6a4a42), doorM = toon(0x6a4a3a), trimM = toon(0xf6f0e6);
  // windows: one instanced set of panes for the whole town, warm-lit at sunset
  const panes: T.Matrix4[] = [], lit = new T.Color(0xffd890).lerp(new T.Color(0x4a6a9a), 1 - look.lit), m4 = new T.Matrix4(), q = new T.Quaternion();
  const pane = (x: number, y: number, z: number, nx: number, nz: number, w = 1.1, h = 1.4) => { q.setFromAxisAngle(V3(0, 1, 0), Math.atan2(nx, nz)); m4.compose(V3(x + nx * 0.06, y, z + nz * 0.06), q, V3(w, h, 1)); panes.push(m4.clone()); };
  for (const h of hs) {
    const hg = new T.Group(); hg.position.set(h.x, h.base, h.z);
    const wall = new T.Mesh(box, wallM(h.wall)); wall.scale.set(h.w, h.h, h.d); wall.position.y = h.h / 2; wall.castShadow = wall.receiveShadow = true; hg.add(wall);
    if (h.kind === 'tower') {
      const rf = new T.Mesh(pyr, tileM(h.tile)); rf.scale.set(h.w + 1, h.roof, h.d + 1); rf.position.y = h.h; hg.add(rf);
      // a clock face on every side, and a gallery of arches near the top
      for (let s = 0; s < 4; s++) {
        const a = (s * Math.PI) / 2, nx = Math.sin(a), nz = Math.cos(a);
        const face = new T.Mesh(new T.CircleGeometry(2.6, 24), toon(0xfff8e8)); face.position.set(nx * (h.w / 2 + 0.05), h.h - 5, nz * (h.d / 2 + 0.05)); face.rotation.y = a; hg.add(face);
        const ring = new T.Mesh(new T.TorusGeometry(2.6, 0.22, 6, 24), toon(0xc8a050)); ring.position.copy(face.position); ring.rotation.y = a; hg.add(ring);
        for (const [len, ang] of [[1.8, 0.3], [1.3, 2.2]]) { const hand = new T.Mesh(new T.BoxGeometry(0.18, len, 0.08), toon(0x2a2a3a)); hand.geometry.translate(0, len / 2, 0); hand.position.copy(face.position).addScaledVector(V3(nx, 0, nz), 0.08); hand.rotation.set(0, a, ang); hg.add(noLine(hand)); }
        for (let k = -1; k <= 1; k++) pane(h.x + nx * (h.w / 2) + (nz ? k * 2.4 : 0), h.base + h.h * 0.82, h.z + nz * (h.d / 2) + (nx ? k * 2.4 : 0), nx, nz, 1.2, 2.4);
      }
    } else {
      const rf = new T.Mesh(roof, tileM(h.tile)); rf.scale.set(h.w + 1.2, h.roof, h.d + 1.2); rf.position.y = h.h; rf.castShadow = true; hg.add(rf);
      const eave = new T.Mesh(box, trimM); eave.scale.set(h.w + 0.4, 0.35, h.d + 0.4); eave.position.y = h.h; hg.add(noLine(eave));
      // windows in rows on the long walls and the gable ends, and a door facing the nearest street
      for (const s of [-1, 1]) {
        const nCols = Math.max(1, Math.floor(h.w / 4)); for (let row = 0; row < Math.max(1, Math.floor(h.h / 3.4)); row++) for (let c = 0; c < nCols; c++) pane(h.x + (c - (nCols - 1) / 2) * (h.w / nCols), h.base + 2.2 + row * 3.2, h.z + s * (h.d / 2), 0, s);
        const nR = Math.max(1, Math.floor(h.d / 4.5)); for (let row = 0; row < Math.max(1, Math.floor(h.h / 3.4)); row++) for (let c = 0; c < nR; c++) pane(h.x + s * (h.w / 2), h.base + 2.2 + row * 3.2, h.z + (c - (nR - 1) / 2) * (h.d / nR), s, 0);
      }
      const door = new T.Mesh(box, doorM); door.scale.set(1.4, 2.4, 0.2); door.position.set(r() < 0.5 ? -h.w * 0.25 : h.w * 0.25, 1.2, h.d / 2 + 0.05); hg.add(noLine(door));
    }
    if (h.chimney) {
      const ch = new T.Mesh(box, chimM); const top = h.chimney.top - h.base; ch.scale.set(1.2, top - h.h - 1, 1.2); ch.position.set(h.chimney.x - h.x, h.h + (top - h.h - 1) / 2 + 0.3, h.chimney.z - h.z); hg.add(ch);
      const pot = new T.Mesh(new T.CylinderGeometry(0.35, 0.4, 0.8, 8), potM); pot.position.set(ch.position.x, top - 0.4, ch.position.z); hg.add(pot);
    }
    if (h.kind === 'home' || h.kind === 'granny') {
      // a round attic window with a painted frame, flowers in a box under it
      const nx = h.kind === 'home' ? 0 : 0, nz = h.kind === 'home' ? 1 : -1;
      const frame = new T.Mesh(new T.TorusGeometry(1.5, 0.28, 8, 24), toon(h.kind === 'home' ? 0x4a7ab8 : 0x9a6ab0)); frame.position.set(nx, h.h * 0.82, nz * (h.d / 2 + 0.1)); hg.add(frame);
      const glass = new T.Mesh(new T.CircleGeometry(1.4, 24), toon(0xffe0a0, { emissive: 0x8a6a30 })); glass.position.copy(frame.position).add(V3(0, 0, nz * -0.02)); glass.rotation.y = nz < 0 ? Math.PI : 0; hg.add(noLine(glass));
      const bx = new T.Mesh(box, toon(0x8a5a3a)); bx.scale.set(3, 0.6, 0.7); bx.position.set(0, h.h * 0.82 - 2.1, nz * (h.d / 2 + 0.4)); hg.add(bx);
      for (let k = 0; k < 5; k++) { const fl = new T.Mesh(new T.SphereGeometry(0.28, 6, 5), toon([0xff7a9a, 0xffd04a, 0xc87ae0][k % 3])); fl.position.set(-1.2 + k * 0.6, h.h * 0.82 - 1.7, nz * (h.d / 2 + 0.4)); hg.add(noLine(fl)); }
    }
    g.add(hg);
  }
  // glass in a cream frame with a cross bar
  const frameMesh = new T.InstancedMesh(new T.PlaneGeometry(1.3, 1.25), toon(0xf6ecd8), panes.length);
  const glassGeo = new T.PlaneGeometry(1, 1); glassGeo.translate(0, 0, 0.03);
  const paneMesh = new T.InstancedMesh(glassGeo, new T.MeshBasicMaterial({ color: lit }), panes.length);
  const barGeo = new T.PlaneGeometry(0.12, 1); barGeo.translate(0, 0, 0.05);
  const barMesh = new T.InstancedMesh(barGeo, toon(0xf6ecd8), panes.length);
  panes.forEach((p, i) => { frameMesh.setMatrixAt(i, p); paneMesh.setMatrixAt(i, p); barMesh.setMatrixAt(i, p); });
  g.add(noLine(frameMesh), noLine(paneMesh), noLine(barMesh));
  return g;
}

function buildGround(look: Look) {
  const g = new T.Group(), S = 900, N = 120;
  const geo = new T.PlaneGeometry(S, S, N, N); geo.rotateX(-Math.PI / 2);
  const pos = geo.getAttribute('position'); for (let i = 0; i < pos.count; i++) pos.setY(i, groundAt(pos.getX(i), pos.getZ(i)));
  geo.computeVertexNormals();
  const grass = new T.Mesh(geo, toon(0xffffff, { map: tex('tex-grass', 60, 60) })); grass.receiveShadow = true; g.add(noLine(grass));
  // the streets between the blocks and the market square: cobbles, draped over the ground
  const cob = toon(0xffffff, { map: tex('tex-cobble', 1, 1) }), cobGeo: T.BufferGeometry[] = [];
  const strip = (x0: number, z0: number, x1: number, z1: number, w: number) => {
    const len = Math.hypot(x1 - x0, z1 - z0), n = Math.ceil(len / 6), nx = -(z1 - z0) / len, nz = (x1 - x0) / len, p: number[] = [], uv: number[] = [], idx: number[] = [];
    for (let i = 0; i <= n; i++) { const t = i / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t; for (const s of [-1, 1]) { const px = x + nx * s * w / 2, pz = z + nz * s * w / 2; p.push(px, groundAt(px, pz) + 0.06, pz); uv.push(s < 0 ? 0 : w / 6, (t * len) / 6); } }
    for (let i = 0; i < n; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    const sg = new T.BufferGeometry(); sg.setAttribute('position', new T.Float32BufferAttribute(p, 3)); sg.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); sg.setIndex(idx); sg.computeVertexNormals(); cobGeo.push(sg);
  };
  for (let k = 0; k <= 10; k++) { const c = -200 + 40 * k - 20; strip(c, -HALF, c, HALF, 7); strip(-HALF, c, HALF, c, 7); }
  for (let k = -5; k <= 5; k++) strip(-30, k * 6, 30, k * 6, 6.4);
  for (const sg of cobGeo) { const m = new T.Mesh(sg, cob); m.receiveShadow = true; g.add(noLine(m)); }
  // the river: water in a ribbon along its line, with two stone bridges
  const rp: number[] = [], ri: number[] = [];
  for (let i = 0; i <= 120; i++) { const x = -450 + i * 7.5, z = riverZ(x); rp.push(x, -1.3, z - RIVER_HALF - 1.5, x, -1.3, z + RIVER_HALF + 1.5); if (i) { const a = (i - 1) * 2; ri.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
  const rg = new T.BufferGeometry(); rg.setAttribute('position', new T.Float32BufferAttribute(rp, 3)); rg.setIndex(ri); rg.computeVertexNormals();
  const water = new T.Mesh(rg, new T.MeshToonMaterial({ color: 0x6ab4d8, gradientMap: ramp, transparent: true, opacity: 0.92 })); g.add(noLine(water));
  for (const bx of [-60, 60]) {
    const bz = riverZ(bx), br = new T.Group(); br.position.set(bx, 0, bz);
    const deck = new T.Mesh(new T.BoxGeometry(8, 0.8, RIVER_HALF * 2 + 8), toon(0xc8b8a0, { map: tex('tex-cobble', 1, 3) })); deck.position.y = 1.2; br.add(deck);
    const arch = new T.Mesh(new T.TorusGeometry(RIVER_HALF * 0.75, 1.2, 6, 16, Math.PI), toon(0xb8a890)); arch.rotation.y = Math.PI / 2; arch.position.y = -1.5; br.add(arch);
    for (const s of [-1, 1]) { const rail = new T.Mesh(new T.BoxGeometry(0.4, 1, RIVER_HALF * 2 + 8), toon(0xb8a890)); rail.position.set(s * 3.8, 2, 0); br.add(rail); }
    g.add(br);
  }
  return g;
}

/** trees: round crowns on trunks, in the gardens round the edge, the hills and along the river */
function buildTrees(hs: House[]) {
  const r = rng(77), pts: [number, number][] = [];
  const clear = (x: number, z: number) => hs.every((h) => Math.abs(x - h.x) > h.w / 2 + 3 || Math.abs(z - h.z) > h.d / 2 + 3) && Math.abs(z - riverZ(x)) > RIVER_HALF + 3 && !(Math.abs(x) < 34 && Math.abs(z) < 34) && ((x + 220) % 40 > 6 && (x + 220) % 40 < 34 || (z + 220) % 40 > 6 && (z + 220) % 40 < 34);
  for (let k = 0; k < 900 && pts.length < 260; k++) { const x = (r() - 0.5) * 560, z = (r() - 0.5) * 560; if (clear(x, z)) pts.push([x, z]); }
  const trunk = new T.InstancedMesh(new T.CylinderGeometry(0.35, 0.5, 3, 6), toon(0x8a6a4a), pts.length);
  const crown = new T.InstancedMesh(new T.IcosahedronGeometry(2.6, 1), toon(0xffffff), pts.length);
  const m = new T.Matrix4(), c = new T.Color(), greens = [0x6aa85a, 0x84b864, 0x5a9a58, 0x9ac46a, 0xe8a0b8];
  pts.forEach(([x, z], i) => {
    const s = 0.8 + r() * 0.7, y = groundAt(x, z);
    m.compose(V3(x, y + 1.5 * s, z), new T.Quaternion(), V3(s, s, s)); trunk.setMatrixAt(i, m);
    m.compose(V3(x, y + 4.2 * s, z), new T.Quaternion().setFromEuler(new T.Euler(0, r() * 6, 0)), V3(s, s * 0.9, s)); crown.setMatrixAt(i, m);
    crown.setColorAt(i, c.set(greens[Math.floor(r() * (r() < 0.12 ? 5 : 4))]));
  });
  trunk.castShadow = crown.castShadow = true;
  const g = new T.Group(); g.add(noLine(trunk), noLine(crown)); return g;
}

// ---------------------------------------------------------------- the glider
function paperGlider() {
  const g = new T.Group(), paper = toon(0xffffff, { map: tex('tex-paper', 1, 1), side: T.DoubleSide });
  // a big folded dart, nose along +z: two wings meeting at a keel, with the creases picked out
  const geo = new T.BufferGeometry();
  const p = [0, 0, 2.6, -2.1, 0.25, -1.6, 0, 0, -1.6, 0, 0, 2.6, 0, 0, -1.6, 2.1, 0.25, -1.6, 0, 0, 2.6, 0, -0.55, -1.4, 0, 0, -1.6];
  geo.setAttribute('position', new T.Float32BufferAttribute(p, 3)); geo.setAttribute('uv', new T.Float32BufferAttribute([0.5, 1, 0, 0, 0.5, 0, 0.5, 1, 0.5, 0, 1, 0, 0.5, 1, 0.4, 0, 0.5, 0], 2)); geo.computeVertexNormals();
  const body = new T.Mesh(geo, paper); body.castShadow = true; g.add(body);
  const crease = new T.LineSegments(new T.BufferGeometry().setFromPoints([V3(0, 0.01, 2.6), V3(0, 0.01, -1.6), V3(0, 0.01, 2.6), V3(-1.05, 0.13, -1.6), V3(0, 0.01, 2.6), V3(1.05, 0.13, -1.6)]), new T.LineBasicMaterial({ color: 0xc8b8a0 }));
  g.add(noLine(crease));
  return g;
}
function dressDora(c: HuntChinchilla) {
  const scarf = new T.Mesh(new T.TorusGeometry(0.44, 0.13, 8, 18), toon(0xd23a3a)); scarf.rotation.x = Math.PI / 2; scarf.position.y = 0.95; c.body.add(scarf);
  const tail = new T.Mesh(new T.BoxGeometry(0.2, 0.6, 0.08), toon(0xd23a3a)); tail.position.set(-0.45, 0.8, 0.25); tail.rotation.z = 1.1; c.body.add(tail);
  const cap = new T.Mesh(new T.SphereGeometry(0.5, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), toon(0x7a4a2a)); cap.position.y = 0.32; cap.scale.set(1, 0.8, 1.05); c.head.add(cap);
  for (const z of [-0.18, 0.18]) { const lens = new T.Mesh(new T.TorusGeometry(0.13, 0.05, 6, 12), toon(0xc8a050)); lens.position.set(0.3, 0.55, z); lens.rotation.y = Math.PI / 2; lens.rotation.z = -0.5; c.head.add(lens); }
  return tail;
}
function dressEnzo(c: HuntChinchilla) {
  const jumper = new T.Mesh(new T.CylinderGeometry(0.5, 0.58, 0.62, 14), toon(0x2a3a6a)); jumper.position.y = 0.62; c.body.add(jumper);
  const band = new T.Mesh(new T.TorusGeometry(0.42, 0.06, 6, 18, Math.PI), toon(0x222228)); band.position.y = 0.3; band.rotation.y = Math.PI / 2; c.head.add(band);
  for (const z of [-0.42, 0.42]) { const cup = new T.Mesh(new T.CylinderGeometry(0.16, 0.16, 0.12, 10), toon(0x222228)); cup.rotation.x = Math.PI / 2; cup.position.set(0, 0.25, z); c.head.add(cup); }
  const bag = new T.Mesh(new T.BoxGeometry(0.5, 0.42, 0.22), toon(0x8a5a32)); bag.position.set(0, 0.5, 0.55); c.body.add(bag);
}

// ---------------------------------------------------------------- the scene
export class GliderScene {
  renderer: T.WebGLRenderer; scene = new T.Scene(); camera = new T.PerspectiveCamera(60, 1, 0.3, 3000); outline: OutlineEffect;
  hemi = new T.HemisphereLight(0xffffff, 0x444444, 1); sun = new T.DirectionalLight(0xffffff, 2);
  world = new T.Group(); glider = new T.Group(); dora: HuntChinchilla; enzo: HuntChinchilla; scarf: T.Object3D;
  rings: T.Group[] = []; pages: T.Mesh[] = []; flying: { m: T.Sprite; from: T.Vector3; to: T.Vector3; t: number }[] = []; home: T.Group | null = null;
  smoke = new Motes(1400, 2.4, -0.25, 0.55); sparks = new Motes(500, 0.9, 1.2); sky: T.Mesh | null = null;
  lv: Level | null = null; t = 0; cam = V3(0, 40, 0); look = V3(0, 0, 0); built = false; smokeT = 0; postT = 0;
  constructor(canvas: HTMLCanvasElement) {
    const phone = Math.min(innerWidth, innerHeight) < 600;
    this.renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, phone ? 1.25 : 1.5));
    this.renderer.toneMapping = T.NoToneMapping;
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = phone ? T.BasicShadowMap : T.PCFShadowMap;
    this.outline = new OutlineEffect(this.renderer, { defaultThickness: 0.003, defaultColor: [0.18, 0.12, 0.14] });
    this.scene.fog = new T.Fog(0xffffff, 160, 700);
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(phone ? 1024 : 2048, phone ? 1024 : 2048);
    const sc = this.sun.shadow.camera; sc.left = -70; sc.right = 70; sc.top = 70; sc.bottom = -70; sc.near = 1; sc.far = 500; this.sun.shadow.bias = -0.0008;
    this.scene.add(this.world, this.hemi, this.sun, this.sun.target, this.glider, this.smoke.pts, this.sparks.pts);
    // the glider: Dora up front at the nose, Enzo behind her with the satchel
    this.glider.add(paperGlider());
    this.dora = createHuntChinchilla(true); this.scarf = dressDora(this.dora); this.enzo = createHuntChinchilla(false); dressEnzo(this.enzo);
    for (const [c, z] of [[this.dora, 0.9], [this.enzo, -0.5]] as const) { c.root.scale.setScalar(0.62); c.root.position.set(0, 0.02, z); c.root.rotation.y = -Math.PI / 2; this.glider.add(c.root); }
    this.resize();
  }
  resize() {
    const c = this.renderer.domElement, w = c.clientWidth || innerWidth, h = c.clientHeight || innerHeight;
    this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.fov = w / h < 0.8 ? 74 : w / h < 1.3 ? 66 : 58; this.camera.updateProjectionMatrix();
  }
  /** build the town once, then dress it for a flight: the sky, the windows waiting for letters, the pages */
  setLevel(f: Flight) {
    const lv = f.lv, look = LOOKS[lv.sky]; this.lv = lv;
    if (!this.built) { this.built = true; this.world.add(buildGround(look), buildTown(f.c.town, look), buildTrees(f.c.town)); }
    if (this.sky) this.scene.remove(this.sky); this.sky = skyDome(look.sky); this.scene.add(this.sky);
    (this.scene.fog as T.Fog).color.set(look.fog);
    this.hemi.color.set(look.hemi[0]); this.hemi.groundColor.set(look.hemi[1]); this.hemi.intensity = look.hemi[2]; this.sun.color.set(look.sun[0]); this.sun.intensity = look.sun[1];
    for (const r of this.rings) this.world.remove(r); for (const p of this.pages) this.world.remove(p); for (const fl of this.flying) this.scene.remove(fl.m);
    if (this.home) this.world.remove(this.home);
    this.rings = []; this.pages = []; this.flying = [];
    const letterMat = new T.SpriteMaterial({ map: tex('letter'), transparent: true, depthWrite: false });
    const ringAt = (x: number, y: number, z: number, nx: number, nz: number, color: number) => {
      const g = new T.Group(); g.position.set(x, y, z);
      const ring = new T.Mesh(new T.TorusGeometry(2.2, 0.28, 8, 28), new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, fog: false })); ring.rotation.y = Math.atan2(nx, nz); g.add(noLine(ring));
      const glow = new T.Sprite(new T.SpriteMaterial({ map: softTex(), color, transparent: true, opacity: 0.55, depthWrite: false, blending: T.AdditiveBlending })); glow.scale.setScalar(9); g.add(noLine(glow));
      // a soft beam straight up, so you can find it from across town
      const beam = new T.Mesh(new T.CylinderGeometry(0.9, 0.9, 60, 10, 1, true), new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.16, depthWrite: false, side: T.DoubleSide, fog: false })); beam.position.y = 30; g.add(noLine(beam));
      return g;
    };
    for (const t of f.c.targets) {
      const g = ringAt(t.x, t.y, t.z, t.nx, t.nz, 0xffc84a);
      const env = new T.Sprite(letterMat); env.scale.set(2.4, 2, 1); env.position.y = 4; g.add(noLine(env)); g.userData.env = env;
      this.rings.push(g); this.world.add(g);
    }
    const hm = f.c.home; this.home = ringAt(hm.x, hm.y, hm.z, hm.nx, hm.nz, 0x7ac8ff); this.world.add(this.home);
    const pageGeo = new T.PlaneGeometry(1.3, 1.7), pageMat = toon(0xffffff, { map: tex('tex-paper'), side: T.DoubleSide });
    for (const p of f.c.pages) { const m = new T.Mesh(pageGeo, pageMat); m.position.set(p.x, p.y, p.z); this.pages.push(m); this.world.add(m); }
    this.sun.position.set(...look.sunPos); this.cam.set(f.x - Math.sin(f.yaw) * 10, f.y + 3, f.z - Math.cos(f.yaw) * 10); this.look.set(f.x, f.y, f.z);
  }

  event(e: FlightEvent, f: Flight) {
    if (e.k === 'post') {
      const t = f.c.targets[e.i], m = new T.Sprite(new T.SpriteMaterial({ map: tex('letter'), transparent: true, depthWrite: false })); m.scale.set(1.2, 1, 1); noLine(m);
      this.flying.push({ m, from: V3(f.x, f.y + 0.6, f.z), to: V3(t.x, t.y, t.z), t: 0 }); this.scene.add(m); this.postT = 0.5;
    } else if (e.k === 'page') { const p = f.c.pages[e.i]; this.sparks.burst(p.x, p.y, p.z, 24, 5, 0xfff4d0, 1); }
    else if (e.k === 'bump') this.sparks.burst(f.x, f.y, f.z, 18, 4, 0xffffff, 0);
    else if (e.k === 'end' && e.why === 'splash') this.sparks.burst(f.x, f.y, f.z, 60, 7, 0xc8e8ff, 4);
    else if (e.k === 'end' && e.why === 'home') this.sparks.burst(f.x, f.y, f.z, 60, 6, 0x9ad8ff, 2);
  }

  render(f: Flight, dt: number, reduced: boolean) {
    this.t += dt; const lv = f.lv;
    // the glider: heading, pitch and bank, with a little flutter in the paper
    this.glider.position.set(f.x, f.y, f.z);
    this.glider.rotation.set(-f.pitch + (reduced ? 0 : Math.sin(this.t * 7) * 0.01), f.yaw, f.bank, 'YXZ');
    animateHuntChinchilla(this.dora, reduced ? 0 : this.t, 0, true); animateHuntChinchilla(this.enzo, reduced ? 0 : this.t + 1.1, 0, true);
    poseArms(this.dora, V3(0.5, 0.6, -0.35), V3(0.5, 0.6, 0.35));
    this.postT = Math.max(0, this.postT - dt);
    poseArms(this.enzo, null, this.postT > 0 ? V3(0.9, 1.3, 0.4) : f.nextTargetNear() >= 0 ? V3(0.7, 1, 0.5) : null);
    this.scarf.rotation.z = 1.1 + Math.sin(this.t * 14) * 0.25;
    // windows: posted ones go dark, the rest bob their envelope; home glows brighter with every letter posted
    this.rings.forEach((g, i) => {
      g.visible = !f.delivered[i];
      const env = g.userData.env as T.Sprite; env.position.y = 4 + Math.sin(this.t * 2.4 + i) * 0.5;
      const near = i === f.nextTargetNear(); (g.children[0] as T.Mesh).scale.setScalar(near ? 1.15 + Math.sin(this.t * 10) * 0.08 : 1);
    });
    if (this.home) { const all = f.left === 0; this.home.children.forEach((c) => { const m = (c as T.Mesh).material as T.MeshBasicMaterial; m.opacity = (c instanceof T.Sprite ? 0.55 : c.position.y > 1 ? 0.16 : 0.9) * (all ? 1 : 0.3); }); }
    this.pages.forEach((p, i) => { p.visible = !f.got[i]; if (!p.visible) return; p.rotation.set(Math.sin(this.t + i) * 0.6, this.t * 1.5 + i, Math.sin(this.t * 1.3 + i) * 0.4); p.position.y = f.c.pages[i].y + Math.sin(this.t * 1.7 + i * 2) * 0.4; });
    // letters sailing into their windows
    this.flying = this.flying.filter((fl) => {
      fl.t += dt * 1.8; if (fl.t >= 1) { this.scene.remove(fl.m); this.sparks.burst(fl.to.x, fl.to.y, fl.to.z, 30, 5, 0xffd84a, 1); return false; }
      fl.m.position.lerpVectors(fl.from, fl.to, fl.t); fl.m.position.y += Math.sin(fl.t * Math.PI) * 3; return true;
    });
    // smoke from the chimneys near the camera: the warm air you can ride
    this.smokeT -= dt;
    if (this.smokeT <= 0 && !reduced) {
      this.smokeT = 0.08;
      for (const h of f.c.town) { const ch = h.chimney; if (!ch || Math.abs(ch.x - f.x) > 170 || Math.abs(ch.z - f.z) > 170) continue; this.smoke.burst(ch.x, ch.top + 0.3, ch.z, 1, 0.3, h.kind === 'bakery' ? 0xfff4e8 : 0xf0f0f4, ch.up * 0.9, 6); }
      for (const s of lv.sunny) if (Math.abs(s.x - f.x) < 200 && Math.abs(s.z - f.z) < 200) { const a = Math.random() * 6.28, d = Math.random() * s.r; this.sparks.burst(s.x + Math.cos(a) * d, groundAt(s.x, s.z) + 2 + Math.random() * 40, s.z + Math.sin(a) * d, 1, 0.2, 0xfff0b0, s.up * 1.2); }
    }
    this.smoke.step(dt, lv.wind); this.sparks.step(dt, lv.wind);
    // the camera: behind and a little above, swinging round with the turns, closer when slow
    const back = 8.5 + f.speed * 0.12, want = V3(f.x - Math.sin(f.yaw) * back, f.y + 2.6 - f.pitch * 3, f.z - Math.cos(f.yaw) * back);
    want.y = Math.max(want.y, groundAt(want.x, want.z) + 1.5, roofTop(f.c.town, want.x, want.z) + 1.5);
    if (this.cam.distanceTo(want) > 40) this.cam.copy(want), this.look.set(f.x, f.y, f.z);
    this.cam.lerp(want, 1 - Math.exp(-dt * 4)); this.look.lerp(V3(f.x + Math.sin(f.yaw) * 6, f.y + 0.8, f.z + Math.cos(f.yaw) * 6), 1 - Math.exp(-dt * 6));
    this.camera.position.copy(this.cam); this.camera.up.set(Math.sin(-f.bank * 0.25) * Math.cos(f.yaw), 1, -Math.sin(-f.bank * 0.25) * Math.sin(f.yaw)).normalize(); this.camera.lookAt(this.look);
    const look = LOOKS[lv.sky]; this.sun.position.set(f.x + look.sunPos[0], f.y + look.sunPos[1], f.z + look.sunPos[2]); this.sun.target.position.set(f.x, f.y, f.z);
    if (this.sky) this.sky.position.copy(this.camera.position);
    this.outline.render(this.scene, this.camera);
  }
  dispose() { this.renderer.dispose(); }
}
