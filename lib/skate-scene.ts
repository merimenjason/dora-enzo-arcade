// Pawpark Skate scene: a toon-shaded park built straight from the engine's pieces (boxes, kickers, quarter-pipes,
// rails and the street between the rooftops), dressed for its place (the town square, the hill above the sea, the
// old town's roofs after dark), the skater on a board posed for every trick, golden acorns, sparks and dust, and a
// chase camera that follows the line through the air and back into a quarter-pipe.
import * as T from 'three';
import { OutlineEffect } from 'three/examples/jsm/effects/OutlineEffect.js';
import { animateHuntChinchilla, createHuntChinchilla, poseArms, type HuntChinchilla } from './hunt-chinchilla';
import { FLIPS, groundAt, type CharId, type Park, type ParkId, type Piece, type Qp, type Session, type SkateEvent } from './skate-game';

const ramp = new T.DataTexture(new Uint8Array([110, 190, 255]), 3, 1, T.RedFormat);
ramp.minFilter = ramp.magFilter = T.NearestFilter; ramp.generateMipmaps = false; ramp.needsUpdate = true;
const toon = (color: number, o: T.MeshToonMaterialParameters = {}) => new T.MeshToonMaterial({ color, gradientMap: ramp, ...o });
// the outline pass reads its settings off the material, so that is where "no ink line" goes
const noLine = <O extends T.Object3D>(o: O) => {
  const m = (o as unknown as { material?: T.Material | T.Material[] }).material;
  for (const x of Array.isArray(m) ? m : m ? [m] : []) x.userData.outlineParameters = { visible: false };
  return o;
};
const V = (x: number, y: number, z: number) => new T.Vector3(x, y, z);
const rand = (() => { let s = 7; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; })();

type Look = {
  sky: [number, number, number]; fog: number; fogD: number; hemi: [number, number, number]; sun: [number, number]; sunPos: [number, number, number];
  ground: [string, string]; concrete: number; ledge: number; wood: number; night: boolean;
};
const LOOKS: Record<ParkId, Look> = {
  plaza: { sky: [0x4aa8f0, 0x9fd8ff, 0xfff1d8], fog: 0xe8f2ff, fogD: 0.006, hemi: [0xffffff, 0xd8c8b0, 1.2], sun: [0xfff2dc, 2.1], sunPos: [30, 50, -20], ground: ['#e9cfa6', '#dcbb8f'], concrete: 0xe8dccb, ledge: 0xc9c2b8, wood: 0xb07a4a, night: false },
  hill: { sky: [0x6aa6e0, 0xffc79a, 0xffe6c0], fog: 0xffe1c4, fogD: 0.0055, hemi: [0xfff0e0, 0x9ac08a, 1.15], sun: [0xffd6a8, 2.2], sunPos: [-40, 30, 40], ground: ['#d9d4cc', '#cbc5bb'], concrete: 0xe6e0d6, ledge: 0xbfb8ae, wood: 0xb5835a, night: false },
  roofs: { sky: [0x1d1640, 0x4a347a, 0xc0709a], fog: 0x3a2c5c, fogD: 0.012, hemi: [0x9a8ad8, 0x3a2a40, 1.25], sun: [0xc8c8ff, 1.0], sunPos: [-20, 40, -30], ground: ['#8a4a3e', '#7a4036'], concrete: 0xb0a4b8, ledge: 0x8a8098, wood: 0x8a5a3a, night: true },
};

function skyDome(cols: [number, number, number]) {
  const geo = new T.SphereGeometry(400, 32, 16), pos = geo.getAttribute('position'), col: number[] = [];
  const top = new T.Color(cols[0]), mid = new T.Color(cols[1]), hor = new T.Color(cols[2]), c = new T.Color();
  for (let i = 0; i < pos.count; i++) { const y = pos.getY(i) / 400; if (y > 0.2) c.copy(mid).lerp(top, Math.min(1, (y - 0.2) / 0.6)); else c.copy(hor).lerp(mid, Math.max(0, (y + 0.05) / 0.25)); col.push(c.r, c.g, c.b); }
  geo.setAttribute('color', new T.Float32BufferAttribute(col, 3));
  const m = new T.Mesh(geo, new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide, fog: false, depthWrite: false }));
  m.renderOrder = -1; return noLine(m);
}
let glowT: T.Texture | null = null;
function glowTex() {
  if (glowT) return glowT;
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); glowT = new T.CanvasTexture(c); return glowT;
}
const glow = (color: number, size: number, opacity = 1) => { const s = new T.Sprite(new T.SpriteMaterial({ map: glowTex(), color, transparent: true, opacity, blending: T.AdditiveBlending, depthWrite: false })); s.scale.setScalar(size); return noLine(s); };

/** paving, concrete or roof tiles: a tile pattern 8 m across */
function groundTex(id: ParkId, a: string, b: string) {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d')!;
  g.fillStyle = a; g.fillRect(0, 0, 256, 256);
  if (id === 'plaza') {
    // warm stone flags in rows, each a slightly different shade
    for (let y = 0; y < 8; y++) for (let x = 0; x < 4; x++) {
      const o = (y % 2) * 32; g.fillStyle = rand() < 0.5 ? a : b; g.globalAlpha = 0.6 + rand() * 0.4;
      g.fillRect(x * 64 + o + 2, y * 32 + 2, 60, 28); g.fillRect(x * 64 + o - 256 + 2, y * 32 + 2, 60, 28);
    }
    g.globalAlpha = 1;
  } else if (id === 'hill') {
    // poured concrete slabs with expansion joints and a few cracks
    g.fillStyle = b; for (let i = 0; i < 400; i++) g.fillRect(rand() * 256, rand() * 256, 2, 2);
    g.strokeStyle = 'rgba(90,80,70,0.35)'; g.lineWidth = 2; for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, 256); g.moveTo(0, i * 64); g.lineTo(256, i * 64); g.stroke(); }
  } else {
    // flat roofs: tarred boards with seams
    for (let y = 0; y < 16; y++) { g.fillStyle = y % 2 ? a : b; g.fillRect(0, y * 16, 256, 15); }
    g.fillStyle = 'rgba(0,0,0,0.18)'; for (let y = 0; y < 16; y++) for (let x = 0; x < 4; x++) g.fillRect(((x * 64 + (y % 2) * 32) % 256), y * 16, 2, 15);
  }
  const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; return t;
}

// ---------------------------------------------------------------- the pieces
function boxMesh(x0: number, z0: number, x1: number, z1: number, y0: number, y1: number, m: T.Material) {
  const o = new T.Mesh(new T.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), m); o.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  o.castShadow = true; o.receiveShadow = true; return o;
}
/** a wedge: the ramp's top as a sloped quad over its rectangle, with closed sides */
function wedge(x0: number, z0: number, x1: number, z1: number, axis: 'x' | 'z', h0: number, h1: number) {
  const hAt = (x: number, z: number) => { const k = axis === 'x' ? (x - x0) / (x1 - x0) : (z - z0) / (z1 - z0); return h0 + (h1 - h0) * k; };
  const c = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]], pos: number[] = [];
  const quad = (a: number[], b: number[], cc: number[], d: number[]) => pos.push(...a, ...b, ...cc, ...a, ...cc, ...d);
  const top = c.map(([x, z]) => [x, hAt(x, z), z]), bot = c.map(([x, z]) => [x, 0, z]);
  quad(top[0], top[3], top[2], top[1]);
  for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; quad(bot[i], top[i], top[j], bot[j]); }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
  return g;
}
/** a quarter-pipe: the curved transition, its side walls and back, all in one mesh */
function qpGeo(q: Qp) {
  const r = q.r, h = Math.min(q.h, r * 0.97), L = Math.sqrt(r * r - (r - h) * (r - h)), N = 18, pos: number[] = [];
  // profile points in (u, y): u from 0 (flat) to L (lip)
  const prof: [number, number][] = []; for (let i = 0; i <= N; i++) { const u = (L * i) / N; prof.push([u, r - Math.sqrt(r * r - u * u)]); }
  const P = (u: number, y: number, c: number) => q.axis === 'x' ? [q.at + q.dir * u, y, c] : [c, y, q.at + q.dir * u];
  const quad = (a: number[], b: number[], cc: number[], d: number[]) => pos.push(...a, ...b, ...cc, ...a, ...cc, ...d);
  for (let i = 0; i < N; i++) {
    const [u0, y0] = prof[i], [u1, y1] = prof[i + 1];
    quad(P(u0, y0, q.c0), P(u1, y1, q.c0), P(u1, y1, q.c1), P(u0, y0, q.c1));
    // side walls
    quad(P(u0, 0, q.c0), P(u1, 0, q.c0), P(u1, y1, q.c0), P(u0, y0, q.c0));
    quad(P(u0, 0, q.c1), P(u0, y0, q.c1), P(u1, y1, q.c1), P(u1, 0, q.c1));
  }
  quad(P(L, 0, q.c0), P(L, 0, q.c1), P(L, h, q.c1), P(L, h, q.c0));
  // the profile is mirrored for some orientations: turn every triangle round so the faces point out
  if ((q.axis === 'x') === (q.dir === 1)) for (let i = 0; i < pos.length; i += 9) for (let k = 0; k < 3; k++) { const t = pos[i + 3 + k]; pos[i + 3 + k] = pos[i + 6 + k]; pos[i + 6 + k] = t; }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); return g;
}
function tube(a: T.Vector3, b: T.Vector3, r: number, m: T.Material) {
  const d = b.clone().sub(a), o = new T.Mesh(new T.CylinderGeometry(r, r, d.length(), 10), m);
  o.position.copy(a).addScaledVector(d, 0.5); o.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize()); o.castShadow = true; return o;
}

function flowerBush(color: number, s = 1) {
  const g = new T.Group(), leaf = toon(0x4f9a4a);
  for (let i = 0; i < 5; i++) { const b = new T.Mesh(new T.IcosahedronGeometry(0.28 * s, 1), leaf); b.position.set((rand() - 0.5) * 0.7 * s, 0.2 * s, (rand() - 0.5) * 0.7 * s); g.add(b); }
  const fm = toon(color); for (let i = 0; i < 7; i++) { const f = noLine(new T.Mesh(new T.SphereGeometry(0.07 * s, 8, 6), fm)); f.position.set((rand() - 0.5) * 0.8 * s, 0.38 * s + rand() * 0.12, (rand() - 0.5) * 0.8 * s); g.add(f); }
  return g;
}
function tree(s: number, leafC: number) {
  const g = new T.Group(); g.add(boxMesh(-0.15 * s, -0.15 * s, 0.15 * s, 0.15 * s, 0, 2.2 * s, toon(0x7a5236)));
  const lm = toon(leafC); for (let i = 0; i < 6; i++) { const b = new T.Mesh(new T.IcosahedronGeometry((0.9 + rand() * 0.5) * s, 1), lm); b.position.set((rand() - 0.5) * 1.6 * s, (2.6 + rand() * 1.1) * s, (rand() - 0.5) * 1.6 * s); b.castShadow = true; g.add(b); }
  return g;
}
/** a little town house with a pitched roof and lit (or sunny) windows */
function house(w: number, d: number, h: number, wall: number, roof: number, night: boolean) {
  const g = new T.Group(); g.add(boxMesh(-w / 2, -d / 2, w / 2, d / 2, 0, h, toon(wall)));
  // a gable roof: a triangle across the depth, run along the width, with a little overhang
  const tri = new T.Shape([new T.Vector2(-d / 2 - 0.3, 0), new T.Vector2(d / 2 + 0.3, 0), new T.Vector2(0, d * 0.42)]);
  const rg = new T.ExtrudeGeometry(tri, { depth: w + 0.4, bevelEnabled: false }); rg.translate(0, 0, -(w + 0.4) / 2); rg.rotateY(Math.PI / 2);
  const r = new T.Mesh(rg, toon(roof)); r.position.y = h; r.castShadow = true; g.add(r);
  const win = night ? new T.MeshBasicMaterial({ color: 0xffc66a, fog: false }) : toon(0x5a7a9a);
  for (let fy = 1; fy * 2.4 < h; fy++) for (let fx = -w / 2 + 1; fx < w / 2 - 0.4; fx += 1.6) for (const side of [-1, 1]) {
    if (night && rand() < 0.35) continue;
    const m = noLine(new T.Mesh(new T.PlaneGeometry(0.6, 0.9), win)); m.position.set(fx + 0.3, fy * 2.4 - 0.8, side * (d / 2 + 0.01)); if (side < 0) m.rotation.y = Math.PI; g.add(m);
  }
  return g;
}

function lanternString(a: T.Vector3, b: T.Vector3, n: number, cols: number[]) {
  const g = new T.Group(), sag = 0.8, pts: T.Vector3[] = [];
  for (let i = 0; i <= 24; i++) { const k = i / 24, p = a.clone().lerp(b, k); p.y -= Math.sin(k * Math.PI) * sag; pts.push(p); }
  g.add(noLine(new T.Line(new T.BufferGeometry().setFromPoints(pts), new T.LineBasicMaterial({ color: 0x3a2a2a }))));
  for (let i = 1; i < n; i++) {
    const k = i / n, p = a.clone().lerp(b, k); p.y -= Math.sin(k * Math.PI) * sag + 0.15; const col = cols[i % cols.length];
    const l = noLine(new T.Mesh(new T.SphereGeometry(0.16, 10, 8), new T.MeshBasicMaterial({ color: col }))); l.position.copy(p); l.scale.y = 1.3; g.add(l);
    const gl = glow(col, 0.9, 0.45); gl.position.copy(p); g.add(gl);
  }
  return g;
}
function bunting(a: T.Vector3, b: T.Vector3, n: number) {
  const g = new T.Group(), cols = [0xf05a5a, 0xffd04a, 0x5ac0f0, 0x7ad07a, 0xf09ad0];
  const line: T.Vector3[] = []; for (let i = 0; i <= 20; i++) { const k = i / 20, p = a.clone().lerp(b, k); p.y -= Math.sin(k * Math.PI) * 0.6; line.push(p); }
  g.add(noLine(new T.Line(new T.BufferGeometry().setFromPoints(line), new T.LineBasicMaterial({ color: 0x6a5a50 }))));
  const tri = new T.BufferGeometry(); tri.setAttribute('position', new T.Float32BufferAttribute([-0.2, 0, 0, 0.2, 0, 0, 0, -0.42, 0], 3)); tri.computeVertexNormals();
  const dir = b.clone().sub(a); const ang = Math.atan2(dir.x, dir.z) - Math.PI / 2;
  for (let i = 1; i < n; i++) { const k = i / n, p = a.clone().lerp(b, k); p.y -= Math.sin(k * Math.PI) * 0.6; const f = noLine(new T.Mesh(tri, new T.MeshBasicMaterial({ color: cols[i % cols.length], side: T.DoubleSide }))); f.position.copy(p); f.rotation.y = ang; g.add(f); }
  return g;
}

/** Build a park: the ground (with the street cut out), every piece, the rails, and the place around it. */
function buildPark(pk: Park, look: Look): { g: T.Group; water: T.Mesh | null; lights: T.Object3D[] } {
  const g = new T.Group(), id = pk.id, W = pk.w, D = pk.d, lights: T.Object3D[] = [];
  const conc = toon(look.concrete), ledgeM = toon(look.ledge), wood = toon(look.wood), metal = toon(0x8a96a8), coping = toon(0xb8c2d0);
  // the ground: split round any holes that cross the whole park
  const gt = groundTex(id, look.ground[0], look.ground[1]);
  const holes = pk.pieces.filter((p) => p.k === 'hole');
  const spans: [number, number][] = []; let z = -D / 2 - 30;
  for (const h of holes.sort((a, b) => a.z0 - b.z0)) { spans.push([z, h.z0]); z = h.z1; }
  spans.push([z, D / 2 + 30]);
  for (const [a, b] of spans) {
    const pw = W + 60, pd = b - a, t = gt.clone(); t.needsUpdate = true; t.repeat.set(pw / 8, pd / 8);
    const m = new T.Mesh(new T.PlaneGeometry(pw, pd), toon(0xffffff, { map: t })); m.rotation.x = -Math.PI / 2; m.position.set(0, 0, (a + b) / 2); m.receiveShadow = true; g.add(noLine(m));
  }
  // the park's edge: a low kerb all the way round (outside the skateable area), and beyond it the place
  const kerb = toon(id === 'roofs' ? 0x6a4a5a : 0xbfb4a4);
  for (const s of [-1, 1]) {
    g.add(boxMesh(-W / 2 - 0.6, s * D / 2, W / 2 + 0.6, s * D / 2 + s * 0.6, 0, 0.5, kerb));
    g.add(boxMesh(s * W / 2, -D / 2, s * W / 2 + s * 0.6, D / 2, 0, 0.5, kerb));
  }
  for (const p of pk.pieces) g.add(pieceMesh(p, look, { conc, ledgeM, wood, metal, coping }));
  for (const r of pk.rails) {
    if (r.kind === 'coping') { g.add(tube(V(r.a.x, r.a.y, r.a.z), V(r.b.x, r.b.y, r.b.z), 0.06, coping)); continue; }
    if (r.kind !== 'rail') continue;
    const a = V(r.a.x, r.a.y, r.a.z), b = V(r.b.x, r.b.y, r.b.z), len = a.distanceTo(b);
    g.add(tube(a, b, 0.05, id === 'roofs' && r.name === 'Plank Bridge' ? wood : metal));
    if (r.name === 'Plank Bridge') {
      // a plank laid across the street, with the rail its edge
      const pl = boxMesh(-0.25, -len / 2, 0.25, len / 2, -0.08, 0, wood); pl.position.add(a.clone().lerp(b, 0.5)); g.add(pl); continue;
    }
    const posts = Math.max(2, Math.round(len / 3));
    for (let i = 0; i <= posts; i++) { const p = a.clone().lerp(b, i / posts); g.add(tube(V(p.x, 0, p.z), p, 0.035, metal)); }
  }
  // the street below the rooftops: lit windows, lanterns and the cobbles far down
  if (holes.length) for (const h of holes) {
    const st = new T.Mesh(new T.PlaneGeometry(W + 60, h.z1 - h.z0), toon(0x2a2030)); st.rotation.x = -Math.PI / 2; st.position.set(0, -9, (h.z0 + h.z1) / 2); g.add(noLine(st));
    for (const s of [h.z0, h.z1]) { const wall = new T.Mesh(new T.PlaneGeometry(W + 60, 9), toon(0x6a3a3e, { side: T.DoubleSide })); wall.position.set(0, -4.5, s); g.add(noLine(wall)); }
    for (let x = -W / 2; x < W / 2; x += 6) { const l = glow(0xffb060, 2.4, 0.9); l.position.set(x + 3, -6, (h.z0 + h.z1) / 2); g.add(l); }
  }
  // dressing
  const decor = new T.Group(); g.add(decor);
  if (id === 'plaza') {
    const walls = [0xf2b8a0, 0xf6d68a, 0xa8d0c0, 0xf0a8b8, 0xe8e0c8, 0xb8c8f0];
    for (let i = 0; i < 9; i++) for (const [sx, sz, ry] of [[-1, 0, 0], [1, 0, 0], [0, -1, 1], [0, 1, 1]] as const) {
      const w = 6 + rand() * 2, h = 6 + rand() * 5, hz = house(w, 6, h, walls[(i + sx + sz * 2 + 6) % walls.length], 0xc8644a, false);
      const along = -D / 2 + 4 + i * (D / 8.6); if (ry) { hz.position.set(along, 0, sz * (D / 2 + 7)); } else { hz.position.set(sx * (W / 2 + 7), 0, along); hz.rotation.y = Math.PI / 2; }
      decor.add(hz);
    }
    for (const [x, zz] of [[-29, -29], [29, -29.5], [-29, 29], [-6, 29], [8, 29], [29, 22], [-29, -12], [14, -29]]) { const t = tree(1, 0x6ab85a); t.position.set(x, 0, zz); decor.add(t); }
    for (const [x, zz] of [[-21.5, -21.5], [21.5, -21.5]]) { const b = flowerBush(0xff7aa0, 1.6); b.position.set(x, 0.8, zz); decor.add(b); }
    decor.add(bunting(V(-30, 6, -10), V(-2, 5.5, -30), 14), bunting(V(30, 6, 18), V(4, 5.5, 30), 14), bunting(V(-30, 6.5, 20), V(30, 6.5, 22), 22));
    // the café's awnings over its wall
    for (let x = 16.5; x < 24; x += 2.5) { const a = noLine(new T.Mesh(new T.BoxGeometry(2.3, 0.08, 1.4), toon(x % 5 < 2.5 ? 0xf05a5a : 0xfff4e8))); a.position.set(x + 1, 4.2, 33.2); a.rotation.x = 0.35; decor.add(a); }
  } else if (id === 'hill') {
    // grass beyond the park, the sea to the east, a lighthouse on the headland, clover hedges
    const grass = new T.Mesh(new T.RingGeometry(55, 160, 48, 1, 0.9, Math.PI * 2 - 1.8), toon(0x8ac46a)); grass.rotation.x = -Math.PI / 2; grass.position.y = 0.02; decor.add(noLine(grass));
    for (let i = 0; i < 40; i++) { const a = rand() * Math.PI * 2, r = 46 + rand() * 30; const t = tree(0.8 + rand() * 0.6, rand() < 0.5 ? 0x7ac05a : 0x5aa84a); t.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); if (Math.cos(a) > 0.2 && Math.abs(Math.sin(a)) < 0.7) continue; decor.add(t); }
    const lh = new T.Group(); lh.position.set(40, 0, -66);
    lh.add(new T.Mesh(new T.CylinderGeometry(1.4, 2.0, 14, 16), toon(0xffffff)));
    for (let i = 0; i < 3; i++) { const s = new T.Mesh(new T.CylinderGeometry(1.45 + i * 0.01, 1.6, 1.4, 16), toon(0xe24a4a)); s.position.y = -4 + i * 4.2; lh.add(s); }
    lh.children.forEach((c) => (c.position.y += 7)); const lamp = glow(0xfff0b0, 6, 0.8); lamp.position.y = 15; lh.add(lamp);
    decor.add(lh);
    for (let i = 0; i < 26; i++) { const b = flowerBush([0xffffff, 0xff9ac0, 0xffd04a][i % 3], 1.2); const a = rand() * Math.PI * 2; b.position.set(Math.cos(a) * (40 + rand() * 8), 0, Math.sin(a) * (40 + rand() * 8)); decor.add(b); }
    const hedge = toon(0x3f8a3a); for (const b of pk.pieces) if (b.k === 'box' && b.look === 'hedge') for (let x = b.x0 + 0.4; x < b.x1; x += 0.8) { const m = new T.Mesh(new T.IcosahedronGeometry(0.6, 1), hedge); m.position.set(x, b.h - 0.1, (b.z0 + b.z1) / 2); decor.add(m); }
  } else {
    // the old town around the roofs, lanterns strung across, water towers, the moon and the stars
    const walls = [0xb06a5a, 0xd0a070, 0x8a7aa8, 0xa86a7a, 0xc89a6a];
    for (let i = 0; i < 40; i++) { const a = rand() * Math.PI * 2, r = 52 + rand() * 40, h = house(6 + rand() * 4, 6, 4 + rand() * 9, walls[i % walls.length], 0x5a3040, true); h.position.set(Math.cos(a) * r, -6 + rand() * 3, Math.sin(a) * r); h.rotation.y = rand() * Math.PI; decor.add(h); }
    decor.add(lanternString(V(-34, 5, -24), V(34, 5.5, -22), 16, [0xffb060, 0xff7a6a, 0xffe08a]));
    decor.add(lanternString(V(-34, 5.5, 26), V(34, 5, 24), 16, [0xffe08a, 0xffb060, 0x9ad0ff]));
    decor.add(lanternString(V(-30, 5, -10), V(-30, 5, 30), 10, [0xffb060, 0xff7a6a]));
    for (const [x, zz] of [[-31, 32], [31, -32]]) {
      const wt = new T.Group(); wt.position.set(x, 0, zz);
      for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) wt.add(tube(V(lx, 0, lz), V(lx * 0.8, 5, lz * 0.8), 0.08, wood));
      const tank = new T.Mesh(new T.CylinderGeometry(1.8, 1.8, 2.6, 16), wood); tank.position.y = 6.3; wt.add(tank);
      const cap = new T.Mesh(new T.ConeGeometry(2.0, 1.2, 16), toon(0x5a3a3a)); cap.position.y = 8.2; wt.add(cap); decor.add(wt);
    }
    const moon = noLine(new T.Mesh(new T.CircleGeometry(14, 32), new T.MeshBasicMaterial({ color: 0xfff4d0, fog: false }))); moon.position.set(-120, 140, -260); moon.lookAt(0, 0, 0); decor.add(moon);
    const mg = glow(0xfff0c0, 80, 0.35); mg.material.fog = false; mg.position.copy(moon.position); decor.add(mg);
    const sp: number[] = []; for (let i = 0; i < 500; i++) { const a = rand() * Math.PI * 2, e = 0.15 + rand() * 1.3; sp.push(Math.cos(a) * Math.cos(e) * 380, Math.sin(e) * 380, Math.sin(a) * Math.cos(e) * 380); }
    const sg = new T.BufferGeometry(); sg.setAttribute('position', new T.Float32BufferAttribute(sp, 3));
    decor.add(noLine(new T.Points(sg, new T.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false }))));
    for (const p of pk.pieces) if (p.k === 'box' && p.look === 'chimney') { const sm = glow(0xd0c0e0, 3, 0.25); sm.position.set((p.x0 + p.x1) / 2, p.h + 1.2, (p.z0 + p.z1) / 2); lights.push(sm); decor.add(sm); }
  }
  let water: T.Mesh | null = null;
  if (id === 'plaza') {
    const f = pk.pieces.find((p) => p.k === 'box' && p.look === 'fountain') as Extract<Piece, { k: 'box' }>;
    water = noLine(new T.Mesh(new T.CircleGeometry(1.7, 24), new T.MeshBasicMaterial({ color: 0x7ad0f0, transparent: true, opacity: 0.85 })));
    water.rotation.x = -Math.PI / 2; water.position.set(0, f.h + 0.01, 0); g.add(water);
    const spout = new T.Mesh(new T.CylinderGeometry(0.25, 0.4, 1.2, 12), conc); spout.position.set(0, f.h + 0.6, 0); g.add(spout);
    const bowl = new T.Mesh(new T.CylinderGeometry(0.8, 0.5, 0.25, 16), conc); bowl.position.set(0, f.h + 1.25, 0); g.add(bowl);
    const jet = glow(0xc8f0ff, 1.6, 0.8); jet.position.set(0, f.h + 1.6, 0); g.add(jet); lights.push(jet);
  }
  if (id === 'hill') {
    water = noLine(new T.Mesh(new T.PlaneGeometry(400, 260), new T.MeshBasicMaterial({ color: 0x4aa0d8 }))); water.rotation.x = -Math.PI / 2; water.position.set(266, -3, 0); g.add(water);
  }
  return { g, water, lights };
}

type Mats = { conc: T.Material; ledgeM: T.Material; wood: T.Material; metal: T.Material; coping: T.Material };
function pieceMesh(p: Piece, look: Look, m: Mats): T.Object3D {
  if (p.k === 'hole') return new T.Group();
  if (p.k === 'qp') { const o = new T.Mesh(qpGeo(p), m.conc); o.castShadow = true; o.receiveShadow = true; return o; }
  if (p.k === 'ramp') {
    const mat = p.look === 'steps' ? toon(0xd8c8b0, { side: T.DoubleSide }) : p.look === 'kicker' ? toon(look.wood, { side: T.DoubleSide }) : toon(look.concrete, { side: T.DoubleSide });
    const o = new T.Mesh(wedge(p.x0, p.z0, p.x1, p.z1, p.axis, p.h0, p.h1), mat); o.castShadow = true; o.receiveShadow = true;
    if (p.look === 'steps') {
      // the steps drawn as dark lines across the bank
      const g = new T.Group(); g.add(o); const n = 6, lm = new T.LineBasicMaterial({ color: 0x8a7a68 });
      for (let i = 1; i < n; i++) { const k = i / n, zz = p.z0 + (p.z1 - p.z0) * k, y = p.h0 + (p.h1 - p.h0) * k + 0.01; g.add(noLine(new T.Line(new T.BufferGeometry().setFromPoints([V(p.x0, y, zz), V(p.x1, y, zz)]), lm))); }
      return g;
    }
    return o;
  }
  const lk = p.look ?? 'box';
  if (lk === 'bench') {
    const g = new T.Group(); g.add(boxMesh(p.x0, p.z0, p.x1, p.z1, p.h - 0.08, p.h, m.wood));
    for (const x of [p.x0 + 0.2, p.x1 - 0.2]) g.add(boxMesh(x - 0.06, p.z0 + 0.05, x + 0.06, p.z1 - 0.05, 0, p.h - 0.08, m.metal));
    return g;
  }
  if (lk === 'planter') {
    const g = new T.Group(); g.add(boxMesh(p.x0, p.z0, p.x1, p.z1, 0, p.h, toon(0xc0a080)));
    const b = flowerBush(0xffb0d0, 1.6); b.position.set((p.x0 + p.x1) / 2, p.h, (p.z0 + p.z1) / 2); g.add(b); return g;
  }
  if (lk === 'fountain') {
    const g = new T.Group(); const r = (p.x1 - p.x0) / 2;
    const rim = new T.Mesh(new T.CylinderGeometry(r, r + 0.1, p.h, 28), toon(0xd8ccbc)); rim.position.set((p.x0 + p.x1) / 2, p.h / 2, (p.z0 + p.z1) / 2); rim.castShadow = rim.receiveShadow = true; g.add(rim); return g;
  }
  if (lk === 'hedge') { return new T.Group(); }
  if (lk === 'chimney') { const g = new T.Group(); g.add(boxMesh(p.x0, p.z0, p.x1, p.z1, 0, p.h, toon(0xa85a4a))); g.add(boxMesh(p.x0 - 0.1, p.z0 - 0.1, p.x1 + 0.1, p.z1 + 0.1, p.h - 0.2, p.h, toon(0x6a4040))); return g; }
  const mat = lk === 'ledge' ? m.ledgeM : lk === 'deck' || lk === 'terrace' ? toon(lk === 'terrace' ? 0xe0cfb4 : look.concrete) : lk === 'funbox' ? m.conc : m.conc;
  const g = new T.Group(); g.add(boxMesh(p.x0, p.z0, p.x1, p.z1, 0, p.h, mat));
  if (p.grind) {
    // a bright steel edge along the grindable top
    const e = toon(0xd0d8e2); const t = 0.05;
    g.add(boxMesh(p.x0, p.z0, p.x1, p.z0 + t, p.h - t, p.h + 0.005, e), boxMesh(p.x0, p.z1 - t, p.x1, p.z1, p.h - t, p.h + 0.005, e));
    g.add(boxMesh(p.x0, p.z0, p.x0 + t, p.z1, p.h - t, p.h + 0.005, e), boxMesh(p.x1 - t, p.z0, p.x1, p.z1, p.h - t, p.h + 0.005, e));
  }
  return g;
}

// ---------------------------------------------------------------- the skater
type Kit = { deck: number; grip: number; wheel: number; truck: number; top: number; hat: number; hatKind: 'helmet' | 'beanie' };
const KITS: Record<CharId, Kit> = {
  dora: { deck: 0xf0605a, grip: 0x2a2a30, wheel: 0x8ae0b0, truck: 0xc0c8d0, top: 0x8ccf90, hat: 0xf0604a, hatKind: 'helmet' },
  enzo: { deck: 0x5ab0e8, grip: 0x2a2a30, wheel: 0xffd060, truck: 0xc0c8d0, top: 0x5a9ae0, hat: 0xffc23a, hatKind: 'beanie' },
};
const BOARD_Y = 0.11;
function buildBoard(k: Kit) {
  const g = new T.Group(), deckG = new T.CapsuleGeometry(0.12, 0.6, 4, 12); deckG.rotateX(Math.PI / 2); deckG.scale(1, 0.16, 1);
  const deck = new T.Mesh(deckG, toon(k.deck)); deck.position.y = BOARD_Y; deck.castShadow = true; g.add(deck);
  const top = noLine(new T.Mesh(new T.PlaneGeometry(0.22, 0.66), toon(k.grip))); top.rotation.x = -Math.PI / 2; top.position.y = BOARD_Y + 0.021; g.add(top);
  // a star on the underside
  const star = new T.Shape(); for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2, r = i % 2 ? 0.04 : 0.09; i ? star.lineTo(Math.sin(a) * r, Math.cos(a) * r) : star.moveTo(0, r); }
  const st = noLine(new T.Mesh(new T.ShapeGeometry(star), new T.MeshBasicMaterial({ color: 0xffffff, side: T.DoubleSide }))); st.rotation.x = Math.PI / 2; st.position.y = BOARD_Y - 0.021; g.add(st);
  const tm = toon(k.truck), wm = toon(k.wheel);
  for (const z of [-0.24, 0.24]) {
    const t = new T.Mesh(new T.BoxGeometry(0.2, 0.03, 0.05), tm); t.position.set(0, 0.06, z); g.add(t);
    for (const x of [-0.1, 0.1]) { const w = new T.Mesh(new T.CylinderGeometry(0.035, 0.035, 0.035, 12), wm); w.rotation.z = Math.PI / 2; w.position.set(x, 0.035, z); g.add(w); }
  }
  return g;
}
function dressSkater(r: HuntChinchilla, k: Kit) {
  // a hoodie or tee round the body and a helmet or beanie between the ears
  const band = new T.Mesh(new T.SphereGeometry(1, 24, 12, 0, Math.PI * 2, Math.PI * 0.36, Math.PI * 0.42), toon(k.top, { side: T.DoubleSide }));
  band.scale.set(0.6, 0.56, 0.54); band.position.set(-0.06, 0.52, 0); r.body.add(band);
  if (k.hatKind === 'helmet') {
    const h = new T.Mesh(new T.SphereGeometry(0.47, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.42), toon(k.hat)); h.position.set(-0.02, 0.08, 0); h.rotation.z = 0.25; r.head.add(h);
    const vents = toon(0x2a2a30); for (const z of [-0.12, 0.12]) { const v = noLine(new T.Mesh(new T.CapsuleGeometry(0.025, 0.1, 2, 6), vents)); v.position.set(-0.1, 0.5, z); v.rotation.z = Math.PI / 2 + 0.3; r.head.add(v); }
    const sticker = noLine(new T.Mesh(new T.CircleGeometry(0.06, 5), new T.MeshBasicMaterial({ color: 0xfff060 }))); sticker.position.set(0.22, 0.38, 0.12); sticker.lookAt(V(1, 1.4, 0.4)); r.head.add(sticker);
  } else {
    const h = new T.Mesh(new T.SphereGeometry(0.46, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.4), toon(k.hat)); h.position.set(-0.03, 0.12, 0); h.rotation.z = 0.2; r.head.add(h);
    const cuff = new T.Mesh(new T.TorusGeometry(0.41, 0.06, 8, 28), toon(k.hat)); cuff.rotation.set(Math.PI / 2, 0, 0.2); cuff.position.set(0.0, 0.27, 0); r.head.add(cuff);
    const pom = new T.Mesh(new T.IcosahedronGeometry(0.1, 1), toon(0xfff4e0)); pom.position.set(-0.1, 0.58, 0); r.head.add(pom);
  }
}

class Sparks {
  pts: T.Points; pos: Float32Array; vel: Float32Array; life: Float32Array; col: Float32Array; n: number; i = 0;
  constructor(n: number, size: number, additive: boolean) {
    this.n = n; this.pos = new Float32Array(n * 3); this.vel = new Float32Array(n * 3); this.life = new Float32Array(n); this.col = new Float32Array(n * 3);
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(this.pos, 3)); g.setAttribute('color', new T.BufferAttribute(this.col, 3));
    this.pts = noLine(new T.Points(g, new T.PointsMaterial({ size, vertexColors: true, transparent: true, depthWrite: false, blending: additive ? T.AdditiveBlending : T.NormalBlending, map: glowTex() })));
    this.pts.frustumCulled = false; for (let i = 0; i < n; i++) this.pos[i * 3 + 1] = -999;
  }
  emit(p: T.Vector3, v: T.Vector3, spread: number, color: T.Color, life: number) {
    const i = this.i; this.i = (this.i + 1) % this.n;
    this.pos.set([p.x, p.y, p.z], i * 3); this.vel.set([v.x + (rand() - 0.5) * spread, v.y + rand() * spread * 0.6, v.z + (rand() - 0.5) * spread], i * 3);
    this.col.set([color.r, color.g, color.b], i * 3); this.life[i] = life;
  }
  step(dt: number, grav: number) {
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) { this.pos[i * 3 + 1] = -999; continue; }
      this.life[i] -= dt; this.vel[i * 3 + 1] -= grav * dt;
      for (let k = 0; k < 3; k++) this.pos[i * 3 + k] += this.vel[i * 3 + k] * dt;
      if (this.life[i] < 0.3) for (let k = 0; k < 3; k++) this.col[i * 3 + k] *= 0.9;
    }
    this.pts.geometry.attributes.position.needsUpdate = true; this.pts.geometry.attributes.color.needsUpdate = true;
  }
}

export type CameraMode = 'near' | 'far';

export class SkateScene {
  renderer: T.WebGLRenderer; scene = new T.Scene(); camera = new T.PerspectiveCamera(58, 1, 0.1, 1000);
  outline: OutlineEffect; world = new T.Group();
  hemi = new T.HemisphereLight(0xffffff, 0x444444, 1); sun = new T.DirectionalLight(0xffffff, 2);
  skater = new T.Group(); board!: T.Group; rig!: HuntChinchilla; pivot = new T.Group(); boardHold = new T.Group();
  acorns: T.Group[] = []; shadow: T.Mesh; sparks = new Sparks(260, 0.16, true); dust = new Sparks(200, 0.3, false); stars = new Sparks(160, 0.35, true);
  water: T.Mesh | null = null; lights: T.Object3D[] = []; parkId: ParkId | null = null; char: CharId | null = null;
  t = 0; camPos = V(0, 4, -8); camLook = V(0, 1, 0); up = V(0, 1, 0); private lastYaw = 0; private pushT = 0; private landT = 0; private bailSpin = V(0, 0, 0);
  private bailBoard = { p: V(0, 0, 0), v: V(0, 0, 0), r: V(0, 0, 0) };
  constructor(canvas: HTMLCanvasElement) {
    const phone = Math.min(innerWidth, innerHeight) < 600;
    this.renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, phone ? 1.25 : 1.5));
    this.renderer.toneMapping = T.NoToneMapping;
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = phone ? T.BasicShadowMap : T.PCFShadowMap;
    this.outline = new OutlineEffect(this.renderer, { defaultThickness: 0.004, defaultColor: [0.12, 0.08, 0.1] });
    this.scene.add(this.world, this.hemi, this.sun, this.sun.target, this.skater, this.sparks.pts, this.dust.pts, this.stars.pts);
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera; sc.left = -22; sc.right = 22; sc.top = 22; sc.bottom = -22; sc.near = 1; sc.far = 160; this.sun.shadow.bias = -0.0006;
    this.scene.fog = new T.FogExp2(0xffffff, 0.006);
    this.shadow = noLine(new T.Mesh(new T.CircleGeometry(0.45, 20), new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false })));
    this.shadow.rotation.x = -Math.PI / 2; this.scene.add(this.shadow);
    this.resize();
  }
  resize() {
    const c = this.renderer.domElement, w = c.clientWidth || innerWidth, h = c.clientHeight || innerHeight;
    this.renderer.setSize(w, h, false); this.camera.aspect = w / h;
    this.camera.fov = w / h < 0.8 ? 72 : w / h < 1.3 ? 64 : 58; this.camera.updateProjectionMatrix();
  }

  /** Build a park and the skater for a session. */
  setPark(pk: Park, char: CharId) {
    if (this.parkId !== pk.id) {
      this.world.traverse((o) => { if ((o as T.Mesh).geometry) (o as T.Mesh).geometry.dispose(); });
      this.world.clear(); this.acorns = [];
      const look = LOOKS[pk.id]; this.parkId = pk.id;
      this.world.add(skyDome(look.sky));
      const built = buildPark(pk, look); this.world.add(built.g); this.water = built.water; this.lights = built.lights;
      (this.scene.fog as T.FogExp2).color.set(look.fog); (this.scene.fog as T.FogExp2).density = look.fogD;
      this.hemi.color.set(look.hemi[0]); this.hemi.groundColor.set(look.hemi[1]); this.hemi.intensity = look.hemi[2];
      this.sun.color.set(look.sun[0]); this.sun.intensity = look.sun[1];
      for (const a of pk.acorns) {
        const g = new T.Group(); g.position.set(a.x, a.y, a.z);
        const gold = toon(0xffc83a, { emissive: 0x6a4a00 }), cap = toon(0x9a6a2a);
        const nut = new T.Mesh(new T.SphereGeometry(0.26, 16, 12), gold); nut.scale.y = 1.2; nut.position.y = -0.06; g.add(nut);
        const c = new T.Mesh(new T.SphereGeometry(0.28, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), cap); c.position.y = 0.08; g.add(c);
        const stalk = new T.Mesh(new T.CylinderGeometry(0.03, 0.03, 0.14, 6), cap); stalk.position.y = 0.36; g.add(stalk);
        g.add(glow(0xffe080, 1.6, 0.7)); this.acorns.push(g); this.world.add(g);
      }
    }
    if (this.char !== char) {
      this.skater.clear(); this.char = char; const k = KITS[char];
      this.rig = createHuntChinchilla(char === 'dora'); dressSkater(this.rig, k);
      this.board = buildBoard(k);
      // the rig stands across the board (side-on), its body turned a little towards the nose
      this.pivot = new T.Group(); this.pivot.add(this.rig.root); this.rig.root.scale.setScalar(0.62); this.rig.root.position.y = BOARD_Y + 0.02;
      this.boardHold = new T.Group(); this.boardHold.add(this.board);
      this.skater.add(this.pivot, this.boardHold);
    }
    const s = pk.start; this.camPos.set(s.x - Math.sin(s.yaw) * 7, 4, s.z - Math.cos(s.yaw) * 7); this.camLook.set(s.x, 1, s.z); this.up.set(0, 1, 0);
  }

  /** Effects for what just happened in the session. */
  event(e: SkateEvent, s: Session) {
    const p = V(s.p.x, s.p.y + 0.1, s.p.z);
    if (e.k === 'push') this.pushT = 0.45;
    else if (e.k === 'land') { this.landT = 0.25; const c = new T.Color(0xd8ccc0); for (let i = 0; i < 14; i++) this.dust.emit(p, V(0, 0.4, 0), 2.2, c, 0.6); }
    else if (e.k === 'ollie') { const c = new T.Color(0xd8ccc0); for (let i = 0; i < 6; i++) this.dust.emit(p, V(0, 0.2, 0), 1.2, c, 0.4); }
    else if (e.k === 'acorn') { const c = new T.Color(0xffd860), at = p.clone().add(V(0, 0.6, 0)); for (let i = 0; i < 30; i++) this.stars.emit(at, V(0, 1.5, 0), 4, c, 0.9); }
    else if (e.k === 'bail') {
      this.bailSpin.set((rand() - 0.5) * 8, (rand() - 0.5) * 6, 6 + rand() * 4);
      this.bailBoard.p.copy(this.boardHold.position); this.bailBoard.v.set(s.v.x * 0.8 + (rand() - 0.5) * 3, 3 + rand() * 2, s.v.z * 0.8 + (rand() - 0.5) * 3); this.bailBoard.r.set(rand() * 10, rand() * 10, rand() * 10);
    }
    if (e.k === 'special') { const c = new T.Color(this.char === 'dora' ? 0xffc0e0 : 0xffd060); for (let i = 0; i < 40; i++) this.stars.emit(p, V(0, 2, 0), 5, c, 1.0); }
  }

  render(s: Session, dt: number, cam: CameraMode, reduced = false) {
    this.t += dt; const t = this.t;
    this.water && this.parkId === 'plaza' && ((this.water.material as T.MeshBasicMaterial).color.setHSL(0.54, 0.75, 0.68 + Math.sin(t * 3) * 0.03));
    this.lights.forEach((l, i) => (l.scale.setScalar((l.userData.base ??= l.scale.x) * (1 + Math.sin(t * 4 + i) * 0.08))));
    this.acorns.forEach((a, i) => { a.visible = !s.acorns[i]; a.rotation.y = reduced ? 0 : t * 2; a.position.y = s.pk.acorns[i].y + (reduced ? 0 : Math.sin(t * 2.5 + i) * 0.1); });

    // where the board sits and which way is up for it
    const P = V(s.p.x, s.p.y, s.p.z), state = s.state;
    const target = state === 'air' ? V(0, 1, 0) : state === 'bail' ? V(0, 1, 0) : V(s.n.x, s.n.y, s.n.z);
    if (state === 'grind') target.set(0, 1, 0);
    this.up.lerp(target, 1 - Math.exp(-dt * (state === 'air' ? 6 : 18))).normalize();
    const fwd = V(Math.sin(s.yaw), 0, Math.cos(s.yaw)); fwd.addScaledVector(this.up, -fwd.dot(this.up)).normalize();
    const right = new T.Vector3().crossVectors(this.up, fwd).normalize();
    const basis = new T.Matrix4().makeBasis(right, this.up, fwd);
    this.skater.position.copy(P); this.skater.quaternion.setFromRotationMatrix(basis);
    // the board under the feet: flips, shove-its, slides and manual tilts
    const b = this.board; b.rotation.set(0, 0, 0); b.position.set(0, 0, 0);
    const pv = this.pivot; pv.rotation.set(0, 0, 0); pv.position.set(0, 0, 0);
    const r = this.rig; r.root.rotation.set(0, -Math.PI / 2 + 0.5, 0); r.root.position.set(0, BOARD_Y + 0.02, 0);
    let crouch = 0, armsOut = 0, grabbing = false;
    if (state === 'air') {
      crouch = 0.12; armsOut = 1;
      if (s.flip) {
        const f = FLIPS[s.flip.id], k = Math.min(1, s.flip.t / f.time), e = 1 - Math.pow(1 - k, 2), id = s.flip.id;
        b.position.y = Math.sin(k * Math.PI) * 0.35; crouch = 0.22;
        if (id === 'kickflip' || id === 'special') b.rotation.z = e * Math.PI * 2 * (id === 'special' ? 2 : 1);
        else if (id === 'heelflip') b.rotation.z = -e * Math.PI * 2;
        else if (id === 'double') b.rotation.z = e * Math.PI * 4;
        else if (id === 'shove') b.rotation.y = e * Math.PI;
        else if (id === 'impossible') b.rotation.x = e * Math.PI * 2;
        else if (id === 'hardflip') { b.rotation.z = e * Math.PI * 2; b.rotation.y = e * Math.PI; }
        if (id === 'special') b.rotation.y = e * Math.PI * 2;
      } else if (s.grab) { crouch = 0.3; grabbing = true; b.position.y = 0.12; }
    } else if (state === 'manual' && s.manual) { b.rotation.x = s.manual.nose ? 0.22 : -0.22; b.position.z = s.manual.nose ? 0.04 : -0.04; pv.rotation.x = s.manual.bal * 0.4 + (s.manual.nose ? 0.1 : -0.1); }
    else if (state === 'grind' && s.grind) {
      const id = s.grind.id; crouch = 0.15; armsOut = 0.8;
      if (id === 'board' || id === 'lip') { b.rotation.y = Math.PI / 2; r.root.rotation.y = -Math.PI / 2 + 0.2; }
      else if (id === 'nose') b.rotation.x = 0.28; else if (id === 'five') b.rotation.x = -0.28;
      pv.rotation.z = s.grind.bal * 0.55;
      if (!reduced && rand() < 0.7) { const c = new T.Color().setHSL(0.08 + rand() * 0.05, 1, 0.6); this.sparks.emit(P, V(-fwd.x * 2, 1.2, -fwd.z * 2), 2.5, c, 0.35); }
    } else if (state === 'ground') {
      crouch = this.landT > 0 ? this.landT * 1.2 : 0.04;
      if (this.pushT > 0) { r.feet[1].position.y = 0.05 + Math.sin((1 - this.pushT / 0.45) * Math.PI) * 0.1; }
    }
    this.pushT = Math.max(0, this.pushT - dt); this.landT = Math.max(0, this.landT - dt);
    if (s.fakie && state !== 'bail') pv.rotation.y = Math.PI;
    // the special: the board trails stars
    if (s.specialOn && !reduced) { const c = new T.Color(this.char === 'dora' ? 0xffb0d8 : 0xffe070); this.stars.emit(P.clone().add(V(0, 0.3, 0)), V(0, 0.2, 0), 0.6, c, 0.7); }
    // the bail: the skater tumbles and the board goes its own way
    if (state === 'bail') {
      const k = 1 - s.bailT / 1.4;
      pv.rotation.set(this.bailSpin.x * Math.min(k, 0.25), this.bailSpin.y * Math.min(k, 0.25), Math.min(1.4, this.bailSpin.z * k * 0.3));
      this.bailBoard.v.y -= 14 * dt; this.bailBoard.p.addScaledVector(this.bailBoard.v, dt);
      if (this.bailBoard.p.y < 0) { this.bailBoard.p.y = 0; this.bailBoard.v.multiplyScalar(0.4); this.bailBoard.v.y = Math.abs(this.bailBoard.v.y) * 0.3; }
      this.boardHold.position.copy(this.bailBoard.p).sub(P).applyQuaternion(this.skater.quaternion.clone().invert());
      this.boardHold.rotation.set(this.bailBoard.r.x * k, this.bailBoard.r.y * k, this.bailBoard.r.z * k);
    } else { this.boardHold.position.set(0, 0, 0); this.boardHold.rotation.set(0, 0, 0); this.bailBoard.p.copy(P); }
    // the rig: the shared idle/hop animation, then crouch, arms and grabs
    animateHuntChinchilla(r, reduced ? 0 : t, 0, state !== 'air');
    r.body.position.y -= crouch; r.body.scale.y *= 1 - crouch * 0.5;
    r.head.rotation.y = -0.55;
    r.head.rotation.z = state === 'air' ? -0.15 : 0;
    if (grabbing && s.grab) {
      // reach a paw down to the board: nose, tail or the toe edge, depending on the grab
      r.root.updateMatrixWorld(true);
      const id = s.grab.id, bz = id === 'nose' ? 0.26 : id === 'tail' ? -0.26 : 0, bx = id === 'melon' || id === 'stalefish' ? -0.11 : 0.11;
      const w = this.board.localToWorld(V(bx, BOARD_Y, bz)); r.body.worldToLocal(w);
      if (bz >= 0) poseArms(r, null, w, [0, 1]); else poseArms(r, w, null, [1, 0]);
      r.body.rotation.z = -0.2;
    } else if (armsOut > 0) {
      const lift = state === 'grind' ? 0.85 : 0.75;
      poseArms(r, V(0.15, lift, -0.62), V(0.15, lift, 0.62), [armsOut, armsOut]);
    } else poseArms(r);

    // the blob shadow on the ground under the board
    const gy = s.state === 'air' ? Math.max(0, groundUnder(s)) : s.p.y;
    // (only in the air: on the ground the sun's shadow does the job, and this one helps judge a landing)
    this.shadow.position.set(s.p.x, gy + 0.03, s.p.z); this.shadow.visible = s.state === 'air' && s.p.y - gy > 0.3;
    (this.shadow.material as T.MeshBasicMaterial).opacity = 0.22 * Math.max(0.3, 1 - (s.p.y - gy) / 6);
    this.shadow.quaternion.setFromUnitVectors(V(0, 0, 1), s.state === 'air' ? V(0, 1, 0) : V(s.n.x, s.n.y, s.n.z));

    // the chase camera: behind the line of travel, lifted, looking a little ahead; it holds still-ish in the air so
    // spins read, and never dips below the ground
    const sp = Math.hypot(s.v.x, s.v.z);
    let travel = sp > 1.2 ? Math.atan2(s.v.x, s.v.z) : s.yaw;
    if (state === 'air' && sp < 2.5) travel = this.lastYaw; // straight up out of a quarter-pipe: keep the view
    const dy = wrapA(travel - this.lastYaw); this.lastYaw = wrapA(this.lastYaw + dy * (1 - Math.exp(-dt * (state === 'air' ? 1.2 : 3.2))));
    const far = cam === 'far', back = far ? 9.5 : 6.2, high = far ? 5.2 : 3.0;
    const want = V(s.p.x - Math.sin(this.lastYaw) * back, (state === 'air' ? Math.max(s.p.y * 0.6, s.p.y - 1.5) : s.p.y) + high, s.p.z - Math.cos(this.lastYaw) * back);
    const floor = groundAtCam(s, want.x, want.z) + 0.8; if (want.y < floor) want.y = floor;
    this.camPos.lerp(want, 1 - Math.exp(-dt * 5));
    const look = V(s.p.x + Math.sin(this.lastYaw) * 2.5, s.p.y + 1.0, s.p.z + Math.cos(this.lastYaw) * 2.5);
    this.camLook.lerp(look, 1 - Math.exp(-dt * 8));
    this.camera.position.copy(this.camPos); this.camera.lookAt(this.camLook);
    // keep the sun's shadow box on the skater
    const L = LOOKS[this.parkId ?? 'plaza'].sunPos; this.sun.position.set(s.p.x + L[0], L[1], s.p.z + L[2]); this.sun.target.position.set(s.p.x, 0, s.p.z);

    this.sparks.step(dt, 9); this.dust.step(dt, 1.5); this.stars.step(dt, 2);
    this.outline.render(this.scene, this.camera);
  }
  /** A still view of the park for the menu: a slow orbit round its middle. */
  renderIdle(dt: number) {
    this.t += dt; const a = this.t * 0.06, r = 34;
    this.camera.position.set(Math.sin(a) * r, 16, Math.cos(a) * r); this.camera.lookAt(0, 0, 0);
    this.skater.visible = false; this.shadow.visible = false;
    this.sun.position.set(30, 50, -20); this.sun.target.position.set(0, 0, 0);
    this.outline.render(this.scene, this.camera);
    this.skater.visible = true; this.shadow.visible = true;
  }
  dispose() { this.renderer.dispose(); }
}
const wrapA = (a: number) => { a = (a + Math.PI) % (Math.PI * 2); return a < 0 ? a + Math.PI : a - Math.PI; };
function groundUnder(s: Session) { const g = groundAt(s.pk, s.p.x, s.p.z); return g.hole ? -9 : g.h; }
function groundAtCam(s: Session, x: number, z: number) { const g = groundAt(s.pk, x, z); return g.hole ? 0 : g.h; }
