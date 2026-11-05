// Cloudberry Balloon scene: each hop's valley as a side-on toon diorama (patchwork fields, the lake, the woods, the
// villages, gardens and meadows, mountains and clouds behind), the patchwork balloon with Dora and Enzo in the basket,
// wind wisps that show which way each height is blowing, thermals, birds, the thunderhead, parcels on their parachutes,
// and a camera that pulls back the higher you fly so the ground stays in view.
import * as T from 'three';
import { OutlineEffect } from 'three/examples/jsm/effects/OutlineEffect.js';
import { animateHuntChinchilla, createHuntChinchilla, poseArms, type HuntChinchilla } from './hunt-chinchilla';
import { ENVELOPE, STEP, groundAt, surfaceAt, type Flight, type FlightEvent, type Level, type LevelId, type Terrain } from './balloon-game';

const ramp = new T.DataTexture(new Uint8Array([120, 200, 255]), 3, 1, T.RedFormat);
ramp.minFilter = ramp.magFilter = T.NearestFilter; ramp.generateMipmaps = false; ramp.needsUpdate = true;
const toon = (color: number, o: T.MeshToonMaterialParameters = {}) => new T.MeshToonMaterial({ color, gradientMap: ramp, ...o });
// the outline pass reads its settings off the material, so that is where "no ink line" goes
const noLine = <O extends T.Object3D>(o: O) => {
  const m = (o as unknown as { material?: T.Material | T.Material[] }).material;
  for (const x of Array.isArray(m) ? m : m ? [m] : []) x.userData.outlineParameters = { visible: false };
  return o;
};
const rng = (seed: number) => { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };

type Look = { sky: [number, number, number]; fog: number; hemi: [number, number, number]; sun: [number, number]; fields: number[]; far: number; snow: boolean; dusk: boolean };
const LOOKS: Record<LevelId, Look> = {
  farm: { sky: [0x6fb2ec, 0xb8dcf6, 0xfff0d8], fog: 0xe6eef6, hemi: [0xffffff, 0xc8d0a0, 1.2], sun: [0xfff0d8, 2.0], fields: [0x8cc46a, 0xa6d27a, 0x78b45c, 0xd8cf78, 0xb9a0d0], far: 0x9bb0d0, snow: true, dusk: false },
  mill: { sky: [0x5aa4e8, 0xaad6f8, 0xf6f4e8], fog: 0xe4eef8, hemi: [0xffffff, 0xc8d0a0, 1.2], sun: [0xffffff, 2.1], fields: [0x9ccc6c, 0xd8cc70, 0x86bc60, 0xe8dc90, 0x7cae58], far: 0x98aed0, snow: true, dusk: false },
  lake: { sky: [0x5c9ee4, 0xa8d0f2, 0xfff2e0], fog: 0xe0ecf6, hemi: [0xffffff, 0xb8d0b0, 1.2], sun: [0xfff4e0, 2.0], fields: [0x88c46e, 0x9cd07e, 0x74b462, 0xc8d888, 0xc4a8d8], far: 0x96acd2, snow: true, dusk: false },
  forest: { sky: [0x68a8e0, 0xb4d8ee, 0xfaf0d0], fog: 0xdce8e0, hemi: [0xffffff, 0xa8c098, 1.15], sun: [0xfff0c8, 2.0], fields: [0x6eae5a, 0x84bc66, 0x5c9c4e, 0xa6c870, 0x98b45c], far: 0x8ea6c4, snow: true, dusk: false },
  cliffs: { sky: [0x5a98da, 0xa6cdf0, 0xf2f0ea], fog: 0xdfe6f0, hemi: [0xffffff, 0xb8b8a8, 1.2], sun: [0xffffff, 2.0], fields: [0x9cc078, 0xb0c888, 0x88b06a, 0xc8c890, 0xb4a0c8], far: 0x90a2c8, snow: true, dusk: false },
  gorge: { sky: [0x6a9ad8, 0xb8cce8, 0xf8e4cc], fog: 0xe6dcd8, hemi: [0xfff4e8, 0xb0a490, 1.15], sun: [0xffe4c4, 2.0], fields: [0x9cb878, 0xb4c084, 0x88a86a, 0xc4b07c, 0xa89ab8], far: 0x9ca0c4, snow: true, dusk: false },
  storm: { sky: [0x4a5878, 0x8090a8, 0xc8c4c0], fog: 0xa8b0b8, hemi: [0xd8dce8, 0x707868, 1.0], sun: [0xd8e0f0, 1.3], fields: [0x6e9a5c, 0x7ea666, 0x5e8a50, 0x96a468, 0x8a8aa4], far: 0x6a7490, snow: true, dusk: false },
  meadow: { sky: [0x4a4a98, 0xb486b8, 0xffc49a], fog: 0xe8c0b4, hemi: [0xffe8e0, 0x8a7a90, 1.1], sun: [0xffc898, 1.8], fields: [0x8aae6a, 0x9cb874, 0x78a05e, 0xc0b0d0, 0xd8a8c0], far: 0x8a7ab0, snow: true, dusk: true },
};

let softT: T.Texture | null = null, cloudT: T.Texture | null = null;
const paintedClouds: T.Texture[] = [];
function softTex() {
  if (softT) return softT;
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return (softT = new T.CanvasTexture(c));
}
/** a soft painted cloud: overlapping puffs, lit from above */
function cloudTex() {
  if (cloudT) return cloudT;
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d')!, r = rng(5);
  for (let i = 0; i < 22; i++) {
    const x = 40 + r() * 176, y = 70 + (r() - 0.5) * 30 - Math.sin(((x - 40) / 176) * Math.PI) * 26, s = 18 + r() * 26;
    const gr = g.createRadialGradient(x, y - s * 0.3, 0, x, y, s); gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.7, 'rgba(240,240,250,0.8)'); gr.addColorStop(1, 'rgba(225,228,245,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, s, 0, Math.PI * 2); g.fill();
  }
  return (cloudT = new T.CanvasTexture(c));
}
/** one of three painted clouds (public/art/balloon/cloud-<n>.webp), the drawn one until it loads */
function cloudPick(k: number) {
  if (!paintedClouds.length) for (let n = 1; n <= 3; n++) {
    const t = new T.Texture(cloudTex().image); t.colorSpace = T.SRGBColorSpace; t.needsUpdate = true; paintedClouds.push(t);
    const im = new Image(); im.onload = () => { t.image = im; t.needsUpdate = true; }; im.src = `/art/balloon/cloud-${n}.webp`;
  }
  return paintedClouds[k % 3];
}
const glow = (color: number, size: number, opacity = 1) => { const s = new T.Sprite(new T.SpriteMaterial({ map: softTex(), color, transparent: true, opacity, blending: T.AdditiveBlending, depthWrite: false })); s.scale.setScalar(size); return noLine(s); };

function skyDome(cols: [number, number, number]) {
  const geo = new T.SphereGeometry(1500, 32, 16), pos = geo.getAttribute('position'), col: number[] = [];
  const top = new T.Color(cols[0]), mid = new T.Color(cols[1]), hor = new T.Color(cols[2]), c = new T.Color();
  for (let i = 0; i < pos.count; i++) { const y = pos.getY(i) / 1500; if (y > 0.15) c.copy(mid).lerp(top, Math.min(1, (y - 0.15) / 0.5)); else c.copy(hor).lerp(mid, Math.max(0, (y + 0.05) / 0.2)); col.push(c.r, c.g, c.b); }
  geo.setAttribute('color', new T.Float32BufferAttribute(col, 3));
  const m = new T.Mesh(geo, new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide, fog: false, depthWrite: false }));
  m.renderOrder = -2; return noLine(m);
}

/** simple particles: points that fly, fall and fade */
class Motes {
  pts: T.Points; pos: Float32Array; col: Float32Array; v: Float32Array; life: Float32Array; n: number; i = 0;
  constructor(n: number, size: number, private grav: number) {
    this.n = n; this.pos = new Float32Array(n * 3); this.col = new Float32Array(n * 3); this.v = new Float32Array(n * 3); this.life = new Float32Array(n);
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(this.pos, 3)); g.setAttribute('color', new T.BufferAttribute(this.col, 3));
    this.pts = noLine(new T.Points(g, new T.PointsMaterial({ size, map: softTex(), vertexColors: true, transparent: true, depthWrite: false })));
    this.pts.frustumCulled = false; for (let k = 0; k < n; k++) this.pos[k * 3 + 1] = -9999;
  }
  burst(x: number, y: number, z: number, count: number, speed: number, color: number, up = 0) {
    const c = new T.Color(color);
    for (let k = 0; k < count; k++) {
      const j = this.i = (this.i + 1) % this.n, a = Math.random() * Math.PI * 2, e = Math.random() * 2 - 1, s = speed * (0.4 + Math.random() * 0.6);
      this.pos.set([x, y, z], j * 3); this.v.set([Math.cos(a) * s * Math.sqrt(1 - e * e), e * s + up, Math.sin(a) * s * Math.sqrt(1 - e * e)], j * 3);
      this.col.set([c.r, c.g, c.b], j * 3); this.life[j] = 0.8 + Math.random() * 0.8;
    }
  }
  step(dt: number) {
    for (let k = 0; k < this.n; k++) {
      if (this.life[k] <= 0) continue;
      this.life[k] -= dt; if (this.life[k] <= 0) { this.pos[k * 3 + 1] = -9999; continue; }
      this.v[k * 3 + 1] -= this.grav * dt; for (let a = 0; a < 3; a++) this.pos[k * 3 + a] += this.v[k * 3 + a] * dt;
      const f = Math.min(1, this.life[k] * 2); for (let a = 0; a < 3; a++) this.col[k * 3 + a] *= 0.995 + 0.005 * f;
    }
    this.pts.geometry.attributes.position.needsUpdate = true; this.pts.geometry.attributes.color.needsUpdate = true;
  }
}

// ---------------------------------------------------------------- the valley
const ROWS = [14, 6, -2, -12, -28, -60];
function buildTerrain(lv: Level, ter: Terrain, look: Look) {
  const g = new T.Group(), n = ter.h.length, r = rng(lv.seed * 13 + 1), minH = Math.min(...ter.h) - 60;
  const pos: number[] = [], col: number[] = [], c = new T.Color(), fieldCols = look.fields.map((x) => new T.Color(x));
  const back = (x: number, z: number) => (z < -10 ? ((Math.sin(x * 0.013 + lv.seed) + 1) * 0.5) * (-z - 10) * 0.6 : 0);
  // the top: patchwork fields, each quad one flat colour (fields a few dozen metres wide, a new row of them further back)
  const fieldAt = (x: number, row: number) => { const w = 34 + ((row * 7) % 3) * 9, k = Math.floor((x + row * 17) / w), h = ((k * 73856093) ^ (row * 19349663)) >>> 0; return (h % 97) / 97; };
  for (let row = 0; row < ROWS.length - 1; row++) {
    const z0 = ROWS[row], z1 = ROWS[row + 1];
    for (let i = 0; i < n - 1; i++) {
      const x0 = i * STEP, x1 = x0 + STEP, r0 = fieldAt(x0 + 1, row);
      // mostly meadow greens, now and then a ripe field or heather
      c.copy(fieldCols[r0 < 0.34 ? 0 : r0 < 0.6 ? 1 : r0 < 0.8 ? 2 : r0 < 0.92 ? 3 : 4]);
      if (ter.lake(x0) && z0 > -20) c.set(0x8aa070);
      c.multiplyScalar(1 - row * 0.035);
      const v = [[x0, ter.h[i] + back(x0, z0), z0], [x1, ter.h[i + 1] + back(x1, z0), z0], [x0, ter.h[i] + back(x0, z1), z1], [x1, ter.h[i + 1] + back(x1, z1), z1]];
      for (const k of [0, 1, 2, 1, 3, 2]) { pos.push(...v[k]); col.push(c.r, c.g, c.b); }
    }
  }
  // the front: earth cut away like a diorama, with a band of turf on top
  // (below the turf, bands of rock 14 m deep in level strata, darker the deeper they are, so a cliff reads as a cliff)
  const turf = new T.Color(0x6a9a4c), strata = [0x9a6e48, 0x86603e, 0xa88058, 0x7a5a40].map((x) => new T.Color(x)), BAND = 14;
  for (let i = 0; i < n - 1; i++) {
    const x0 = i * STEP, x1 = x0 + STEP, z = ROWS[0], a0 = ter.h[i], a1 = ter.h[i + 1];
    const quad = (y0a: number, y0b: number, y1a: number, y1b: number, ca: T.Color, cb: T.Color) => {
      const v = [[x0, y0a, z, ca], [x1, y0b, z, ca], [x0, y1a, z, cb], [x1, y1b, z, cb]] as const;
      for (const k of [0, 2, 1, 1, 2, 3]) { pos.push(v[k][0], v[k][1], v[k][2]); col.push(v[k][3].r, v[k][3].g, v[k][3].b); }
    };
    quad(a0, a1, a0 - 3, a1 - 3, turf, turf);
    const top = Math.max(a0, a1) - 3;
    for (let b = Math.floor(top / BAND) * BAND; b + BAND > minH; b -= BAND) {
      const lo = Math.max(b, minH), ta = Math.max(Math.min(a0 - 3, b + BAND), lo), tb = Math.max(Math.min(a1 - 3, b + BAND), lo);
      if (ta <= lo && tb <= lo) continue;
      const k = ((Math.round(b / BAND) % 4) + 4) % 4, ca = strata[k].clone().multiplyScalar(1 - Math.min(0.45, (top - b) / 160));
      quad(ta, tb, lo, lo, ca, ca.clone().multiplyScalar(0.94));
    }
  }
  const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new T.Float32BufferAttribute(col, 3)); geo.computeVertexNormals();
  const land = new T.Mesh(geo, toon(0xffffff, { vertexColors: true })); land.receiveShadow = true; g.add(noLine(land));

  // the lake
  for (const f of lv.features) if (f.k === 'lake') {
    const w = new T.Mesh(new T.BoxGeometry(f.x1 - f.x0, 0.5, 44), toon(0x5aa6d8, { emissive: 0x16486a, transparent: true, opacity: 0.92 }));
    w.position.set((f.x0 + f.x1) / 2, ter.water - 0.25, -8); g.add(noLine(w));
    // a lighthouse on the far shore and a few reeds
    const lh = new T.Group(); lh.position.set(f.x1 + 30, groundAt(ter, f.x1 + 30), -24);
    const tower = new T.Mesh(new T.CylinderGeometry(1.6, 2.4, 16, 12), toon(0xfaf4ea)); tower.position.y = 8; lh.add(tower);
    for (let k = 0; k < 3; k++) { const band = new T.Mesh(new T.CylinderGeometry(2.0 - k * 0.2, 2.1 - k * 0.2, 1.6, 12), toon(0xd04848)); band.position.y = 3 + k * 4.6; lh.add(band); }
    const top = new T.Mesh(new T.ConeGeometry(2.2, 2.6, 12), toon(0xd04848)); top.position.y = 18.6; lh.add(top, glow(0xfff0a0, 6, 0.8)); lh.children[lh.children.length - 1].position.y = 17;
    g.add(lh);
  }
  // trees: the woods, and scattered ones everywhere else
  const trunk = toon(0x7a5a3a), leafA = toon(0x4f8a46), leafB = toon(0x3e7a44), pine = toon(0x2f6a48), berryLeaf = toon(0x5a9a4c);
  const tree = (x: number, z: number, s: number, kind: number) => {
    const t = new T.Group(), y = groundAt(ter, x) + back(x, z); t.position.set(x, y, z);
    if (kind === 0) { const c1 = new T.Mesh(new T.ConeGeometry(2.6 * s, 9 * s, 7), pine); c1.position.y = 6 * s; t.add(c1); const c2 = new T.Mesh(new T.ConeGeometry(2 * s, 6 * s, 7), pine); c2.position.y = 9.5 * s; t.add(c2); }
    else { const tr = new T.Mesh(new T.CylinderGeometry(0.4 * s, 0.6 * s, 5 * s, 6), trunk); tr.position.y = 2.5 * s; t.add(tr); const top = new T.Mesh(new T.IcosahedronGeometry(3.6 * s, 1), r() < 0.5 ? leafA : leafB); top.position.y = 7 * s; top.scale.y = 1.15; t.add(top); }
    t.traverse((o) => (o.castShadow = true)); g.add(t);
  };
  for (const f of lv.features) if (f.k === 'forest') for (let x = f.x0 + 4; x < f.x1 - 4; x += 5 + r() * 4) {
    if (ter.canopy(x) < 6) continue;
    for (const z of [6 + r() * 3, -2 + r() * 4, -10 + r() * 4, -20 - r() * 8]) tree(x + (r() - 0.5) * 3, z, 1 + r() * 0.3, r() < 0.55 ? 0 : 1);
  }
  const clear = (x: number) => ter.canopy(x) === 0 && !ter.lake(x) && !lv.pads.some((p) => Math.abs(x - p.x) < p.w / 2 + 14) && !lv.drops.some((d) => Math.abs(x - d.x) < 14) && !lv.bushes.some((b) => Math.abs(x - b) < 10);
  for (let x = 20; x < lv.w; x += 18 + r() * 30) if (clear(x)) tree(x, r() < 0.5 ? -14 - r() * 20 : 4 + r() * 6, 0.7 + r() * 0.4, r() < 0.3 ? 0 : 1);
  // sheep, here and there in the fields
  const wool = toon(0xf8f6f0), face = toon(0x3a3438);
  for (let x = 40; x < lv.w; x += 60 + r() * 90) if (clear(x)) {
    const s = new T.Group(), z = -4 - r() * 12; s.position.set(x, groundAt(ter, x) + back(x, z) + 0.7, z);
    const b = new T.Mesh(new T.SphereGeometry(1, 10, 8), wool); b.scale.set(1.3, 0.85, 0.9); s.add(b);
    const h = new T.Mesh(new T.SphereGeometry(0.42, 8, 6), face); h.position.set(r() < 0.5 ? 1.25 : -1.25, 0.25, 0); s.add(h); g.add(s);
  }

  // the cottages of a village, start or finish, set back behind its pad
  const wall = toon(0xf4ead8), roofs = [toon(0xb04a3a), toon(0x8a5a9a), toon(0x5a6a9a)], door = toon(0x6a4a3a), win = toon(0xffe6a0, { emissive: look.dusk ? 0xffb050 : 0x000000 });
  const cottage = (x: number, z: number, s: number) => {
    const c = new T.Group(); c.position.set(x, groundAt(ter, x) + back(x, z), z);
    const body = new T.Mesh(new T.BoxGeometry(6 * s, 4 * s, 5 * s), wall); body.position.y = 2 * s; c.add(body);
    const shape = new T.Shape(); shape.moveTo(-3.6 * s, 0); shape.lineTo(0, 3 * s); shape.lineTo(3.6 * s, 0); shape.lineTo(-3.6 * s, 0);
    const roof = new T.Mesh(new T.ExtrudeGeometry(shape, { depth: 5.6 * s, bevelEnabled: false }), roofs[Math.floor(r() * 3)]); roof.position.set(0, 4 * s, -2.8 * s); c.add(roof);
    const d = new T.Mesh(new T.BoxGeometry(1.2 * s, 2 * s, 0.2), door); d.position.set(0, 1 * s, 2.55 * s); c.add(d);
    for (const wx of [-1.9, 1.9]) { const w = new T.Mesh(new T.BoxGeometry(1 * s, 1 * s, 0.2), win); w.position.set(wx * s, 2.4 * s, 2.55 * s); c.add(w); }
    const ch = new T.Mesh(new T.BoxGeometry(0.8 * s, 2 * s, 0.8 * s), wall); ch.position.set(1.8 * s, 6 * s, 0); c.add(ch);
    c.traverse((o) => (o.castShadow = true)); g.add(c);
  };
  const lanterns: T.Object3D[] = [];
  for (const p of lv.pads) {
    // the landing field: mown lighter green, with a picnic-blanket cross on the finish
    const ring = new T.Mesh(new T.CylinderGeometry(p.w / 2, p.w / 2, 0.3, 36), toon(p.kind === 'finish' ? 0xb8e08a : 0xa8d47e)); ring.scale.z = 0.4;
    ring.position.set(p.x, groundAt(ter, p.x) + 0.05, 2); g.add(noLine(ring));
    if (p.kind === 'finish') {
      const cloth = toon(0xf4f0e8), red = toon(0xd04a4a);
      for (const [w, d] of [[14, 3], [3, 8]]) { const b = new T.Mesh(new T.BoxGeometry(w, 0.2, d), cloth); b.position.set(p.x, groundAt(ter, p.x) + 0.25, 2); g.add(noLine(b)); }
      const dot = new T.Mesh(new T.CylinderGeometry(1.6, 1.6, 0.25, 16), red); dot.position.set(p.x, groundAt(ter, p.x) + 0.3, 2); g.add(noLine(dot));
      // bunting between two poles, and a windsock
      const y0 = groundAt(ter, p.x), pole = toon(0xf0e6d0), flags = [0xd04a4a, 0xf2c84a, 0x8a5a9a, 0x5aa0d0, 0xf4f0e8];
      for (const dx of [-p.w / 2 - 2, p.w / 2 + 2]) { const pl = new T.Mesh(new T.CylinderGeometry(0.2, 0.25, 9, 6), pole); pl.position.set(p.x + dx, y0 + 4.5, -6); g.add(pl); }
      for (let k = 0; k < 14; k++) {
        const t = k / 13, fx = p.x - p.w / 2 - 2 + t * (p.w + 4), fy = y0 + 8.6 - Math.sin(t * Math.PI) * 2.2;
        const fl = new T.Mesh(new T.ConeGeometry(0.6, 1.4, 3), toon(flags[k % flags.length])); fl.rotation.z = Math.PI; fl.position.set(fx, fy - 0.6, -6); g.add(noLine(fl));
      }
      if (look.dusk) for (let k = 0; k < 8; k++) { const l = glow(0xffc070, 3.4, 0.9); l.position.set(p.x - p.w / 2 + (k / 7) * p.w, y0 + 5 + (k % 2), -10 - (k % 3) * 4); g.add(l); lanterns.push(l); }
    }
    const n2 = p.kind === 'start' ? 2 : 3;
    for (let k = 0; k < n2; k++) cottage(p.x - p.w / 2 + (k + 0.5) * (p.w / n2) + (r() - 0.5) * 4, -16 - r() * 6, 0.9 + r() * 0.25);
    if (p.kind === 'village') {
      // the fuel store: barrels by the field
      const barrel = toon(0x8a6a4a);
      for (let k = 0; k < 3; k++) { const b = new T.Mesh(new T.CylinderGeometry(0.7, 0.7, 1.6, 10), barrel); b.position.set(p.x + p.w / 2 + 2 + k * 1.6, groundAt(ter, p.x) + 0.8, -2); g.add(b); }
    }
  }
  // the windmill on its green
  if (lv.id === 'mill') {
    const v = lv.pads[1], m = new T.Group(); m.position.set(v.x + v.w / 2 + 16, groundAt(ter, v.x + v.w / 2 + 16), -14);
    const tower = new T.Mesh(new T.CylinderGeometry(2.4, 3.6, 14, 8), toon(0xf2e8d8)); tower.position.y = 7; m.add(tower);
    const cap = new T.Mesh(new T.ConeGeometry(3, 3, 8), toon(0xb04a3a)); cap.position.y = 15.5; m.add(cap);
    const sails = new T.Group(); sails.position.set(0, 13, 3.4);
    for (let k = 0; k < 4; k++) { const s = new T.Mesh(new T.BoxGeometry(1.6, 9, 0.2), toon(0xf8f2e6)); s.position.y = 4.5; const arm = new T.Group(); arm.rotation.z = (k * Math.PI) / 2; arm.add(s); sails.add(arm); }
    m.add(sails); m.userData.sails = sails; g.add(m); lanterns.push(sails);
  }
  // the gardens waiting for parcels: a ring of flowers round a little lawn
  const gardens: T.Group[] = [];
  const petals = [0xf05a7a, 0xf2c84a, 0xb07ad8, 0xf8f4f0, 0xff8a4a].map((x) => toon(x));
  for (const d of lv.drops) {
    const gd = new T.Group(), y = groundAt(ter, d.x); gd.position.set(d.x, y, 2);
    const lawn = new T.Mesh(new T.CylinderGeometry(6, 6, 0.3, 24), toon(0xc0e894)); lawn.scale.z = 0.5; gd.add(noLine(lawn));
    for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2, f = new T.Mesh(new T.SphereGeometry(0.55, 6, 5), petals[k % petals.length]); f.position.set(Math.cos(a) * 6.4, 0.5, Math.sin(a) * 3.2); gd.add(noLine(f)); }
    const pin = new T.Mesh(new T.CylinderGeometry(0.15, 0.15, 3.4, 6), toon(0xf4f0e8)); pin.position.y = 1.7; gd.add(pin);
    const flag = new T.Mesh(new T.BoxGeometry(1.8, 1.1, 0.12), toon(0x5ab06a)); flag.position.set(0.95, 2.9, 0); flag.scale.y = 0.001; gd.add(flag);
    gd.userData.flag = flag; gardens.push(gd); g.add(gd);
    cottage(d.x + (r() < 0.5 ? -12 : 12), -14, 0.85);
  }
  // cloudberry bushes: a green mound full of amber berries
  const bushes: T.Group[] = [], amber = toon(0xffa83a, { emissive: 0x6a3000 });
  for (const bx of lv.bushes) {
    const b = new T.Group(), y = groundAt(ter, bx); b.position.set(bx, y, 0);
    for (let k = 0; k < 5; k++) { const m = new T.Mesh(new T.IcosahedronGeometry(1.5 + r() * 0.6, 0), berryLeaf); m.position.set((r() - 0.5) * 3.4, 0.9 + r() * 0.6, (r() - 0.5) * 2); b.add(m); }
    const berries = new T.Group();
    for (let k = 0; k < 14; k++) { const m = new T.Mesh(new T.SphereGeometry(0.34, 8, 6), amber); const a = r() * Math.PI * 2; m.position.set(Math.cos(a) * (1 + r() * 1.2), 1.4 + r() * 1.2, Math.sin(a) * 1.2 + 0.4); berries.add(noLine(m)); }
    berries.add(glow(0xffc070, 7, 0.55)); berries.children[berries.children.length - 1].position.y = 2;
    b.add(berries); b.userData.berries = berries; bushes.push(b); g.add(b);
  }
  // the mountains far behind, and the hills between
  const far = new T.Group(), rf = rng(lv.seed + 3);
  for (let k = -2; k < lv.w / 120 + 3; k++) {
    const x = k * 120 + rf() * 60, h = 160 + rf() * 180 + (lv.id === 'meadow' || lv.id === 'gorge' || lv.id === 'storm' ? 120 : 0);
    const m = new T.Mesh(new T.ConeGeometry(110 + rf() * 60, h, 5), new T.MeshBasicMaterial({ color: look.far, fog: true }));
    m.position.set(x, h / 2 + Math.min(...ter.h) - 30, -480 - rf() * 140); m.rotation.y = rf() * Math.PI; far.add(noLine(m));
    if (look.snow) { const s = new T.Mesh(new T.ConeGeometry((110 + 30) * 0.33, h * 0.3, 5), new T.MeshBasicMaterial({ color: 0xf6f6fa, fog: true })); s.position.set(x, m.position.y + h * 0.36, m.position.z + 2); s.rotation.y = m.rotation.y; far.add(noLine(s)); }
  }
  for (let k = -2; k < lv.w / 70 + 3; k++) {
    const x = k * 70 + rf() * 40, h = 40 + rf() * 60, m = new T.Mesh(new T.SphereGeometry(60 + rf() * 30, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), toon(new T.Color(look.fields[2]).lerp(new T.Color(look.far), 0.45).getHex()));
    m.scale.y = h / 70; m.position.set(x, Math.min(...ter.h) - 10, -200 - rf() * 60); far.add(noLine(m));
  }
  g.add(far);
  return { g, bushes, gardens, lanterns };
}

// ---------------------------------------------------------------- the balloon
const BERRY = 0xc23a5a, CREAM = 0xf6ecd8, HEATHER = 0x8a5aa8;
function buildBalloon() {
  const g = new T.Group();
  // the envelope: a teardrop turned on a lathe, in patchwork gores
  const prof: T.Vector2[] = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24, y = 4.6 + t * (ENVELOPE - 4.6);
    const r = t < 0.12 ? 1.4 + t * 8 : 7.6 * Math.sin(Math.min(1, (t - 0.02) / 0.98) * Math.PI * 0.92) * (t > 0.85 ? 1 - (t - 0.85) * 2.2 : 1) + 0.2;
    prof.push(new T.Vector2(Math.max(0.01, r), y));
  }
  prof.push(new T.Vector2(0.01, ENVELOPE + 0.05));
  const lathe = new T.LatheGeometry(prof, 24).toNonIndexed(), pos = lathe.getAttribute('position'), col: number[] = [];
  const palette = [BERRY, CREAM, HEATHER, CREAM, BERRY, HEATHER].map((x) => new T.Color(x)), c = new T.Color();
  for (let i = 0; i < pos.count; i += 3) {
    let cx = 0, cz = 0, cy = 0; for (let k = 0; k < 3; k++) { cx += pos.getX(i + k); cy += pos.getY(i + k); cz += pos.getZ(i + k); }
    const gore = Math.floor(((Math.atan2(cz, cx) + Math.PI) / (Math.PI * 2)) * 24) % 24, band = Math.floor((cy / 3 - 1.5) / 3);
    c.copy(palette[(gore + band * 3 + 60) % palette.length]); if (cy / 3 > ENVELOPE - 3) c.set(BERRY);
    for (let k = 0; k < 3; k++) col.push(c.r, c.g, c.b);
  }
  lathe.setAttribute('color', new T.Float32BufferAttribute(col, 3)); lathe.computeVertexNormals();
  const env = new T.Mesh(lathe, toon(0xffffff, { vertexColors: true, side: T.DoubleSide })); env.castShadow = true; g.add(env);
  // the basket, its rim, ropes, burner and flame
  const wicker = toon(0xb8844a), rim = toon(0x8a5a30);
  // (the basket and crew are drawn a little big for the envelope, storybook-style, so you can see who's flying)
  const basket = new T.Mesh(new T.BoxGeometry(4.4, 2.2, 3.2), wicker); basket.position.y = 1.1; basket.castShadow = true; g.add(basket);
  for (const y of [2.2, 0.05]) { const r = new T.Mesh(new T.BoxGeometry(4.64, 0.3, 3.44), rim); r.position.y = y; g.add(r); }
  const rope = new T.LineBasicMaterial({ color: 0x5a4030 }), pts: T.Vector3[] = [];
  for (const [x, z] of [[-2.1, -1.5], [2.1, -1.5], [-2.1, 1.5], [2.1, 1.5]]) pts.push(new T.Vector3(x, 2.2, z), new T.Vector3(x * 0.75, 5, z * 0.9));
  g.add(noLine(new T.LineSegments(new T.BufferGeometry().setFromPoints(pts), rope)));
  const burner = new T.Mesh(new T.CylinderGeometry(0.4, 0.5, 0.6, 10), toon(0x6a6a72)); burner.position.y = 4.2; g.add(burner);
  const flame = new T.Mesh(new T.ConeGeometry(0.5, 2.6, 10), new T.MeshBasicMaterial({ color: 0xffb040, transparent: true, opacity: 0.9 })); flame.position.y = 5.8; g.add(noLine(flame));
  const flameGlow = glow(0xffa040, 9, 0.9); flameGlow.position.y = 5.6; g.add(flameGlow);
  // the vent at the crown, puffing when it's open
  const crown = new T.Mesh(new T.CylinderGeometry(1.2, 1.2, 0.3, 12), toon(BERRY)); crown.position.y = ENVELOPE + 0.1; g.add(crown);
  // sandbags hanging round the basket
  const sacks: T.Mesh[] = [], sack = toon(0xc8b088);
  for (let k = 0; k < 4; k++) { const s = new T.Mesh(new T.SphereGeometry(0.5, 8, 6), sack); s.scale.y = 1.3; s.position.set(k < 2 ? -2.55 : 2.55, 0.8, k % 2 ? 0.7 : -0.7); g.add(s); sacks.push(s); }
  return { g, flame, flameGlow, crown, sacks };
}
function dressDora(r: HuntChinchilla) {
  // aviator goggles pushed up and a berry-red scarf
  const scarf = new T.Mesh(new T.TorusGeometry(0.44, 0.13, 8, 18), toon(0xc23a4a)); scarf.rotation.x = Math.PI / 2; scarf.position.y = 0.95; r.body.add(scarf);
  const tail = new T.Mesh(new T.BoxGeometry(0.2, 0.55, 0.08), toon(0xc23a4a)); tail.position.set(-0.4, 0.72, 0.3); tail.rotation.z = 0.5; r.body.add(tail);
  const strap = new T.Mesh(new T.TorusGeometry(0.5, 0.05, 6, 20), toon(0x5a3a2a)); strap.rotation.x = Math.PI / 2; strap.position.y = 0.42; r.head.add(strap);
  for (const x of [-0.18, 0.18]) { const lens = new T.Mesh(new T.TorusGeometry(0.13, 0.05, 6, 12), toon(0xb08a4a)); lens.position.set(x, 0.5, 0.36); lens.rotation.x = -0.6; r.head.add(lens); }
}
function dressEnzo(r: HuntChinchilla) {
  // a cream jumper and a little flat cap
  const jumper = new T.Mesh(new T.CylinderGeometry(0.48, 0.56, 0.6, 14), toon(0xf0e4cc)); jumper.position.y = 0.62; r.body.add(jumper);
  const cap = new T.Mesh(new T.CylinderGeometry(0.42, 0.44, 0.16, 14), toon(0x6a6a5a)); cap.position.set(0, 0.48, 0.02); r.head.add(cap);
  const peak = new T.Mesh(new T.BoxGeometry(0.5, 0.05, 0.3), toon(0x5a5a4a)); peak.position.set(0, 0.42, 0.38); r.head.add(peak);
}

// ---------------------------------------------------------------- the scene
export class BalloonScene {
  renderer: T.WebGLRenderer; scene = new T.Scene(); camera = new T.PerspectiveCamera(42, 1, 1, 4000); outline: OutlineEffect;
  hemi = new T.HemisphereLight(0xffffff, 0x444444, 1); sun = new T.DirectionalLight(0xffffff, 2);
  world = new T.Group(); balloon = new T.Group(); parts = buildBalloon(); dora: HuntChinchilla; enzo: HuntChinchilla;
  bushes: T.Group[] = []; gardens: T.Group[] = []; lanterns: T.Object3D[] = []; parcels: T.Group[] = []; birds: T.Group[] = []; clouds: T.Sprite[] = [];
  storm: T.Group | null = null; bolt: T.Line | null = null; wisps: T.LineSegments; wisp: Float32Array; wispP: Float32Array; motes = new Motes(400, 1.1, 6); rise = new Motes(300, 0.9, -0.3);
  guide: T.Group; lv: Level | null = null; ter: Terrain | null = null; t = 0; cam = new T.Vector3(0, 60, 120); look = new T.Vector3(); lean = 0; flashT = 0; bumpT = 0;
  constructor(canvas: HTMLCanvasElement) {
    const phone = Math.min(innerWidth, innerHeight) < 600;
    this.renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, phone ? 1.25 : 1.5));
    this.renderer.toneMapping = T.NoToneMapping;
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = phone ? T.BasicShadowMap : T.PCFShadowMap;
    this.outline = new OutlineEffect(this.renderer, { defaultThickness: 0.0035, defaultColor: [0.16, 0.1, 0.12] });
    this.scene.fog = new T.Fog(0xffffff, 300, 1400);
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(1024, 1024);
    const sc = this.sun.shadow.camera; sc.left = -40; sc.right = 40; sc.top = 40; sc.bottom = -40; sc.near = 1; sc.far = 400; this.sun.shadow.bias = -0.001;
    this.scene.add(this.world, this.hemi, this.sun, this.sun.target, this.balloon, this.motes.pts, this.rise.pts);
    // the crew: Dora leaning out on the left with her scarf, Enzo at the burner
    this.dora = createHuntChinchilla(true); dressDora(this.dora); this.enzo = createHuntChinchilla(false); dressEnzo(this.enzo);
    this.dora.root.scale.setScalar(1.7); this.dora.root.position.set(-1.0, 0.7, 0.5);
    this.enzo.root.scale.setScalar(1.7); this.enzo.root.position.set(1.05, 0.7, 0.3); this.enzo.root.rotation.y = -0.3;
    this.parts.g.add(this.dora.root, this.enzo.root); this.balloon.add(this.parts.g);
    // wind wisps: short streaks drifting with the wind wherever the camera looks
    const W = phone ? 110 : 180; this.wisp = new Float32Array(W * 6); this.wispP = new Float32Array(W * 3);
    const wg = new T.BufferGeometry(); wg.setAttribute('position', new T.BufferAttribute(this.wisp, 3));
    this.wisps = noLine(new T.LineSegments(wg, new T.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, fog: false })));
    this.wisps.frustumCulled = false; this.scene.add(this.wisps);
    // the guide: where a parcel let go now would come down
    this.guide = new T.Group();
    const ring = new T.Mesh(new T.TorusGeometry(2.4, 0.22, 6, 28), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 })); ring.rotation.x = Math.PI / 2; ring.scale.y = 0.5;
    const arrow = new T.Mesh(new T.ConeGeometry(0.8, 1.6, 4), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 })); arrow.rotation.x = Math.PI; arrow.position.y = 3;
    this.guide.add(noLine(ring), noLine(arrow)); this.guide.visible = false; this.scene.add(this.guide);
    this.resize();
  }
  resize() {
    const c = this.renderer.domElement, w = c.clientWidth || innerWidth, h = c.clientHeight || innerHeight;
    this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.fov = w / h < 0.8 ? 62 : w / h < 1.3 ? 50 : 42; this.camera.updateProjectionMatrix();
  }

  /** Build a hop's valley. */
  setLevel(lv: Level, ter: Terrain) {
    this.world.traverse((o) => { if ((o as T.Mesh).geometry) (o as T.Mesh).geometry.dispose(); });
    this.world.clear(); this.parcels = []; this.birds = []; this.clouds = []; this.storm = null; this.bolt = null;
    this.lv = lv; this.ter = ter; const look = LOOKS[lv.id];
    this.world.add(skyDome(look.sky));
    const b = buildTerrain(lv, ter, look); this.world.add(b.g); this.bushes = b.bushes; this.gardens = b.gardens; this.lanterns = b.lanterns;
    const fog = this.scene.fog as T.Fog; fog.color.set(look.fog);
    this.hemi.color.set(look.hemi[0]); this.hemi.groundColor.set(look.hemi[1]); this.hemi.intensity = look.hemi[2];
    this.sun.color.set(look.sun[0]); this.sun.intensity = look.sun[1];
    // clouds at many heights and depths, drifting with the wind at theirs
    const r = rng(lv.seed + 9);
    for (let k = 0; k < Math.ceil(lv.w / 45); k++) {
      const s = new T.Sprite(new T.SpriteMaterial({ map: cloudPick(k), color: lv.id === 'storm' ? 0xc8ccd8 : look.dusk ? 0xffe0e8 : 0xffffff, transparent: true, depthWrite: false, fog: true }));
      const z = -60 - r() * 260, sc = 40 + r() * 60; s.scale.set(sc * 2, sc, 1); s.position.set(r() * lv.w, Math.min(...ter.h) + 120 + r() * 520, z);
      this.clouds.push(noLine(s)); this.world.add(s);
    }
    // the flocks
    for (const _ of lv.flocks) {
      const fl = new T.Group();
      for (let k = 0; k < 5; k++) {
        const bird = new T.Group(), wing = toon(0x3a3440);
        for (const sd of [-1, 1]) { const w = new T.Mesh(new T.BoxGeometry(1.6, 0.12, 0.6), wing); w.position.x = sd * 0.8; const hinge = new T.Group(); hinge.add(w); hinge.userData.side = sd; bird.add(hinge); }
        const body = new T.Mesh(new T.SphereGeometry(0.35, 6, 5), wing); body.scale.x = 1.8; bird.add(body);
        bird.position.set(-Math.abs(k - 2) * 2.4, (k % 2) * 1.2, (k - 2) * 1.6); fl.add(bird);
      }
      this.birds.push(fl); this.world.add(fl);
    }
    // the thunderhead
    if (lv.storm) {
      const st = lv.storm, sg = new T.Group(), rs = rng(77);
      for (let k = 0; k < 26; k++) {
        const s = new T.Sprite(new T.SpriteMaterial({ map: cloudPick(k < 13 ? 1 : 0), color: k < 10 ? 0x4a5060 : 0x6a7080, transparent: true, depthWrite: false }));
        const sc = 70 + rs() * 50; s.scale.set(sc * 1.6, sc, 1); s.position.set(st.x0 + rs() * (st.x1 - st.x0), st.y0 + 30 + rs() * (st.y1 - st.y0 - 40), -20 + rs() * 30); sg.add(noLine(s));
      }
      const pts: T.Vector3[] = []; let x = (st.x0 + st.x1) / 2, y = st.y0 + 20;
      while (y > st.y0 - 120) { pts.push(new T.Vector3(x, y, 6)); x += (rs() - 0.5) * 14; y -= 10 + rs() * 12; }
      this.bolt = noLine(new T.Line(new T.BufferGeometry().setFromPoints(pts), new T.LineBasicMaterial({ color: 0xfffbe0, transparent: true, opacity: 0, fog: false })));
      sg.add(this.bolt); this.storm = sg; this.world.add(sg);
    }
    // wisps start scattered round the start
    for (let k = 0; k < this.wispP.length / 3; k++) this.wispP.set([lv.pads[0].x + (Math.random() - 0.5) * 300, lv.base + Math.random() * 300, 8 + Math.random() * 6], k * 3);
    this.balloon.visible = true;
  }

  event(e: FlightEvent, f: Flight) {
    const x = f.x, y = f.y;
    if (e.k === 'berry') this.motes.burst(x, y + 1, 1.5, 26, 7, 0xffb040, 3);
    else if (e.k === 'bump') { this.motes.burst(x, y + 8, 1.5, 18, 6, 0xffffff, 1); this.bumpT = 0.5; }
    else if (e.k === 'parcel' && e.hit !== 'miss') { const p = f.drops[f.drops.length - 1]; this.motes.burst(p?.x ?? x, (p?.y ?? y) + 1, 3, 40, 9, e.hit === 'perfect' ? 0xffd84a : 0x8ad870, 5); }
    else if (e.k === 'touch' || e.k === 'liftoff') this.motes.burst(x, y + 0.3, 2, 16, 3.5, 0xd8c8a0, 1);
    else if (e.k === 'sand') this.motes.burst(x - 1.8, y + 0.2, 1, 30, 2.5, 0xd8c0a0, -2);
    else if (e.k === 'end' && e.why === 'splash') this.motes.burst(x, y + 0.5, 2, 60, 10, 0xc8e8ff, 6);
    else if (e.k === 'flash') this.flashT = 0.35;
  }

  /** Draw the flight. `guideX`: where a parcel would come down (or null to hide the guide). */
  render(f: Flight, dt: number, reduced: boolean, guideX: number | null) {
    this.t += dt; const ter = f.ter, lv = f.lv;
    // the balloon: a gentle sway with the wind, a lean when bumped
    this.balloon.position.set(f.x, f.y, 0);
    this.lean += ((f.vx - f.wind(f.x, f.y)) * -0.03 - this.lean) * Math.min(1, dt * 2);
    this.bumpT = Math.max(0, this.bumpT - dt);
    this.balloon.rotation.z = reduced ? 0 : this.lean + Math.sin(this.t * 0.9) * 0.015 + Math.sin(this.t * 25) * this.bumpT * 0.06;
    const burn = f.burning && !f.over; this.parts.flame.visible = burn; this.parts.flame.scale.set(1, 0.8 + Math.sin(this.t * 40) * 0.2, 1);
    this.parts.flameGlow.material.opacity = burn ? 0.9 : 0.18; this.parts.flameGlow.scale.setScalar(burn ? 9 + Math.sin(this.t * 30) : 3);
    this.parts.sacks.forEach((s, i) => (s.visible = i < f.sandbags));
    // the crew: Dora watches ahead (and reaches for berries near a bush), Enzo minds the burner
    animateHuntChinchilla(this.dora, reduced ? 0 : this.t, 0, true); animateHuntChinchilla(this.enzo, reduced ? 0 : this.t + 1.3, 0, true);
    const nearBush = lv.bushes.some((b, i) => !f.picked[i] && Math.abs(b - f.x) < 12 && f.altitude < 14);
    poseArms(this.dora, nearBush ? new T.Vector3(-0.9, 0.9, 0.3) : null, f.vy > 1 ? new T.Vector3(0.3, 1.3, 0.2) : null);
    poseArms(this.enzo, null, burn ? new T.Vector3(-0.1, 1.5, -0.1) : null);
    this.dora.root.rotation.y = f.vx > 0.3 ? 0.4 : f.vx < -0.3 ? -0.4 : 0;

    // bushes picked, gardens delivered
    this.bushes.forEach((b, i) => (b.userData.berries.visible = !f.picked[i]));
    this.gardens.forEach((g, i) => { const fl = g.userData.flag as T.Mesh; const want = f.delivered[i] ? 1 : 0.001; fl.scale.y += (want - fl.scale.y) * Math.min(1, dt * 6); });
    // parcels on their parachutes
    while (this.parcels.length < f.drops.length) {
      const p = new T.Group(), box = new T.Mesh(new T.BoxGeometry(1.1, 0.9, 1.1), toon(0xc8a070)); p.add(box);
      const twine = new T.Mesh(new T.BoxGeometry(1.14, 0.12, 0.2), toon(0xc23a5a)); p.add(twine);
      const chute = new T.Mesh(new T.SphereGeometry(2, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), toon([BERRY, HEATHER, 0xf2c84a][this.parcels.length % 3], { side: T.DoubleSide })); chute.position.y = 3.2; chute.scale.y = 0.6; p.add(chute);
      const lines = new T.LineSegments(new T.BufferGeometry().setFromPoints([V3(-0.5, 0.45, 0), V3(-1.8, 3.2, 0), V3(0.5, 0.45, 0), V3(1.8, 3.2, 0)]), new T.LineBasicMaterial({ color: 0x5a4030 })); p.add(noLine(lines));
      p.userData.chute = chute; this.parcels.push(p); this.world.add(p);
    }
    f.drops.forEach((d, i) => { const p = this.parcels[i]; p.position.set(d.x, d.y, 1); const ch = p.userData.chute as T.Mesh; ch.visible = !d.done; p.rotation.z = d.done ? 0 : Math.sin(this.t * 2 + i) * 0.12; });
    // birds
    f.birds().forEach((b, i) => {
      const fl = this.birds[i]; if (!fl) return; fl.position.set(b.x, b.y, 2); fl.scale.x = b.dir;
      fl.children.forEach((bird, k) => bird.children.forEach((h) => { if (h.userData.side) h.rotation.z = h.userData.side * Math.sin(this.t * 10 + k) * 0.6; }));
    });
    // clouds drift with the wind at their height, wrapping round the map
    for (const c of this.clouds) { c.position.x += f.wind(c.position.x, c.position.y) * dt * 0.6; if (c.position.x > lv.w + 300) c.position.x -= lv.w + 600; else if (c.position.x < -300) c.position.x += lv.w + 600; }
    // the thunderhead flashes
    this.flashT = Math.max(0, this.flashT - dt);
    if (this.bolt) (this.bolt.material as T.LineBasicMaterial).opacity = reduced ? 0 : this.flashT > 0.15 ? 1 : 0;
    const look = LOOKS[lv.id]; this.hemi.intensity = look.hemi[2] + (reduced ? this.flashT * 0.6 : this.flashT * 2.4);
    // the windmill turns, lanterns flicker
    for (const l of this.lanterns) { if (l instanceof T.Sprite) l.material.opacity = 0.75 + Math.sin(this.t * 3 + l.position.x) * 0.15; else l.rotation.z -= dt * 0.8; }
    // thermals: seeds rising (or leaves falling into the gorge)
    if (!reduced) for (const th of lv.thermals) if (Math.random() < dt * 8) { const x = th.x + (Math.random() - 0.5) * th.w, y = groundAt(ter, x) + 4 + Math.random() * 30; this.rise.burst(x, y, (Math.random() - 0.5) * 20, 1, 0.5, th.up > 0 ? 0xfff8e0 : 0xc89a5a, th.up * 2.2); }
    this.motes.step(dt); this.rise.step(dt);

    // the camera: side on, pulled back the higher you are so the ground stays in shot, leading the drift
    const g = groundAt(ter, f.x), ag = Math.max(0, f.y - g);
    const dist = Math.min(260, 52 + ag * 0.75), lookY = g + Math.max(ENVELOPE * 0.6, ag * 0.62 + 8);
    const want = V3(f.x + f.vx * 3, lookY + dist * 0.06, dist);
    this.cam.lerp(want, 1 - Math.exp(-dt * 1.6)); this.look.lerp(V3(f.x + f.vx * 3, lookY, 0), 1 - Math.exp(-dt * 2));
    // and whatever the framing wants, the whole balloon stays in shot (high up the ground gives way first)
    const half = this.cam.z * Math.tan((this.camera.fov * Math.PI) / 360) * 0.86;
    this.look.y = Math.min(Math.max(this.look.y, f.y + ENVELOPE + 2 - half), f.y - 1 + half);
    const halfX = half * this.camera.aspect - 10, dx = f.x - this.look.x;
    if (Math.abs(dx) > halfX) { const k = dx - Math.sign(dx) * halfX; this.look.x += k; this.cam.x += k; }
    this.camera.position.copy(this.cam); this.camera.lookAt(this.look);
    this.sun.position.set(f.x - 60, f.y + 120, 80); this.sun.target.position.set(f.x, f.y, 0);
    this.stepWisps(f, dt, dist);
    // the guide
    this.guide.visible = guideX !== null && !f.over;
    if (guideX !== null) { this.guide.position.set(guideX, surfaceAt(ter, guideX) + 0.4, 2); this.guide.children[1].position.y = 3 + Math.sin(this.t * 5) * 0.5; }
    this.outline.render(this.scene, this.camera);
  }
  private stepWisps(f: Flight, dt: number, dist: number) {
    // keep the wisps in a box round the view; each one blows with the wind where it is
    const halfW = dist * this.camera.aspect * 0.5, halfH = dist * 0.48, cx = this.look.x, cy = this.look.y;
    for (let k = 0; k < this.wispP.length / 3; k++) {
      let x = this.wispP[k * 3], y = this.wispP[k * 3 + 1]; const z = this.wispP[k * 3 + 2];
      const w = f.wind(x, y);
      x += w * dt * 1.4;
      if (x < cx - halfW * 1.2 || x > cx + halfW * 1.2 || y < cy - halfH * 1.2 || y > cy + halfH * 1.2 || y < surfaceAt(f.ter, x) + 1) {
        x = cx + (Math.random() * 2 - 1) * halfW * 1.1; y = Math.max(surfaceAt(f.ter, x) + 3, cy + (Math.random() * 2 - 1) * halfH * 1.1);
      }
      this.wispP[k * 3] = x; this.wispP[k * 3 + 1] = y;
      const len = Math.max(0.6, Math.abs(w) * 1.6) * Math.sign(w || 1);
      this.wisp.set([x, y, z, x - len, y, z], k * 6);
    }
    this.wisps.geometry.attributes.position.needsUpdate = true;
  }
  dispose() { this.renderer.dispose(); }
}
const V3 = (x: number, y: number, z: number) => new T.Vector3(x, y, z);
