// Fluffball Smash! scene: a toon-shaded court in one of six venues, the players with their rackets, the ball with its
// shadow, trail and landing marker, and the effects that make the special moves loud: fire, ice, ink-blue phantom
// balls, violet lightning, storm swirls, a hexagon shield, impact rings, sparks and a camera that swoops round the
// hitter while the cut-in plays. Engine metres map to three.js as X = x, Y = z (up), Z = -y, so the player's end
// (y < 0) is towards the camera.
import * as T from 'three';
import { OutlineEffect } from 'three/examples/jsm/effects/OutlineEffect.js';
import { COURT, type CharId, type SpecialId, type VenueId } from './smash-game';
import { buildPlayer, posePlayer, toon, type Rig } from './smash-models';

export type PlayerView = { id: CharId; side: number; x: number; y: number; vx: number; vy: number; swing: number; kind: string; charging: boolean; jump: number; stun: number; frost: number };
export type FrameView = {
  dt: number;
  players: PlayerView[];
  ball: { x: number; y: number; z: number; visible: boolean; special: SpecialId | null; decoys: number[]; age: number; flight: number; by: number };
  /** where the ball will bounce on your side, for the landing marker */
  land: { x: number; y: number } | null;
  fortress: number;
  /** a special's cut-in: swoop the camera round this player */
  cine: { x: number; y: number; side: number; t: number } | null;
  /** end of a match: orbit the winners */
  celebrate: number;
  shake: number; reduced: boolean;
};

const X = (x: number) => x, Z = (y: number) => -y;
const FIRE: Partial<Record<SpecialId, [number, number]>> = { meteor: [0xfff0a0, 0xff7a1a], twin: [0xff6a5a, 0x5aa8ff], phoenix: [0xffd06a, 0xff3a10] };
const TRAIL: Record<SpecialId | 'none', number> = { none: 0xf6ffb0, meteor: 0xffb03a, twin: 0xff7aa0, phantom: 0x6ab0ff, drop: 0x7ae07a, mirror: 0xb07aff, squall: 0xe8f4ff, fortress: 0x7affb0, phoenix: 0xff6a2a, zero: 0xa8e4ff };

class Sparks {
  geo = new T.BufferGeometry(); pts: T.Points; n: number; next = 0;
  pos: Float32Array; vel: Float32Array; life: Float32Array; max: Float32Array; col: Float32Array; base: Float32Array; size: Float32Array;
  constructor(n: number, additive: boolean) {
    this.n = n;
    this.pos = new Float32Array(n * 3); this.vel = new Float32Array(n * 3); this.life = new Float32Array(n); this.max = new Float32Array(n).fill(1);
    this.col = new Float32Array(n * 3); this.base = new Float32Array(n * 3); this.size = new Float32Array(n);
    this.geo.setAttribute('position', new T.BufferAttribute(this.pos, 3).setUsage(T.DynamicDrawUsage));
    this.geo.setAttribute('color', new T.BufferAttribute(this.col, 3).setUsage(T.DynamicDrawUsage));
    this.geo.setAttribute('size', new T.BufferAttribute(this.size, 1).setUsage(T.DynamicDrawUsage));
    const mat = new T.ShaderMaterial({
      transparent: true, depthWrite: false, blending: additive ? T.AdditiveBlending : T.NormalBlending, vertexColors: true,
      uniforms: { scale: { value: 500 } },
      vertexShader: `attribute float size; varying vec3 vC; uniform float scale;
        void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = min(size * scale / max(0.5, -mv.z), 120.0); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying vec3 vC; void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; float f = 1.0 - smoothstep(0.15, 0.5, d); gl_FragColor = vec4(vC * f, f); }`,
    });
    this.pts = new T.Points(this.geo, mat); this.pts.frustumCulled = false;
  }
  spawn(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, size: number, color: number) {
    const i = this.next, c = new T.Color(color); this.next = (this.next + 1) % this.n;
    this.pos.set([x, y, z], i * 3); this.vel.set([vx, vy, vz], i * 3); this.life[i] = life; this.max[i] = life; this.size[i] = size;
    this.base.set([c.r, c.g, c.b], i * 3);
  }
  step(dt: number, g: number) {
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) { this.col[i * 3] = this.col[i * 3 + 1] = this.col[i * 3 + 2] = 0; this.size[i] = 0; continue; }
      this.life[i] -= dt; const k = Math.max(0, this.life[i] / this.max[i]);
      this.vel[i * 3 + 1] += g * dt;
      for (let j = 0; j < 3; j++) { this.pos[i * 3 + j] += this.vel[i * 3 + j] * dt; this.col[i * 3 + j] = this.base[i * 3 + j] * k; }
    }
    for (const a of ['position', 'color', 'size']) (this.geo.attributes[a] as T.BufferAttribute).needsUpdate = true;
  }
  clear() { this.life.fill(0); }
}

// ---------------------------------------------------------------- venues
type VenueLook = { sky: [number, number, number]; fog: number; fogD: number; hemi: [number, number, number]; sun: [number, number]; sunPos: [number, number, number]; court: number; court2: number; out: number; ground: number; night: boolean };
const LOOKS: Record<VenueId, VenueLook> = {
  meadow: { sky: [0x6fb8f0, 0xbfe4ff, 0xfff4d8], fog: 0xcfe8f0, fogD: 0.006, hemi: [0xdff0ff, 0x6a8a4a, 1.1], sun: [0xfff2d8, 2.2], sunPos: [-30, 50, 20], court: 0x5aa84a, court2: 0x4f9a40, out: 0x4a9440, ground: 0x6cae4e, night: false },
  river: { sky: [0x7ab0e8, 0xcfe2f4, 0xffe2c0], fog: 0xe8dccc, fogD: 0.006, hemi: [0xfff0e0, 0x8a5a3a, 1.05], sun: [0xffe8c8, 2.1], sunPos: [40, 40, 10], court: 0xc8643a, court2: 0xc8643a, out: 0xb85a34, ground: 0x7aa85a, night: false },
  seaside: { sky: [0x4a7ab8, 0xa8c8e8, 0xe8eef4], fog: 0xb8c8d8, fogD: 0.008, hemi: [0xe0ecff, 0x4a5a6a, 1.15], sun: [0xf4f8ff, 1.8], sunPos: [20, 45, -30], court: 0x3a74b8, court2: 0x3a74b8, out: 0x3a8a5a, ground: 0x9a9a92, night: false },
  temple: { sky: [0x3a2a6a, 0xd06a6a, 0xffb070], fog: 0xb06a6a, fogD: 0.009, hemi: [0xffc8a0, 0x4a3050, 1.0], sun: [0xffa860, 1.6], sunPos: [-50, 18, -40], court: 0xb85a34, court2: 0xb85a34, out: 0xa04e30, ground: 0x5a6a3a, night: false },
  night: { sky: [0x07081a, 0x141a3a, 0x3a1a3a], fog: 0x1a1430, fogD: 0.01, hemi: [0x8a90c0, 0x2a1a2a, 0.9], sun: [0xfff4e8, 1.9], sunPos: [0, 40, 10], court: 0x2a3a8a, court2: 0x2a3a8a, out: 0x8a2a3a, ground: 0x1a1a24, night: true },
  sky: { sky: [0x5a8ad8, 0xf0c8e0, 0xffe0b0], fog: 0xf0e0f0, fogD: 0.004, hemi: [0xfff4f8, 0x9a8ab0, 1.2], sun: [0xfff0e0, 2.0], sunPos: [-20, 22, -60], court: 0x6a8ad0, court2: 0x6a8ad0, out: 0xe8e4f0, ground: 0xf4f0f8, night: false },
};

function courtTexture(look: VenueLook, doubles: boolean, grass: boolean) {
  // the court with a margin, 18 m × 36 m at 32 px a metre
  const W = 18, L = 36, k = 32, c = document.createElement('canvas'); c.width = W * k; c.height = L * k;
  const g = c.getContext('2d')!, hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;
  g.fillStyle = hex(look.out); g.fillRect(0, 0, c.width, c.height);
  const cx = (x: number) => (x + W / 2) * k, cy = (y: number) => (L / 2 - y) * k;
  const hw = doubles ? COURT.double : COURT.single;
  g.fillStyle = hex(look.court); g.fillRect(cx(-hw - 0.4), cy(COURT.half + 0.6), (hw * 2 + 0.8) * k, (COURT.half * 2 + 1.2) * k);
  if (grass) { g.fillStyle = hex(look.court2); for (let i = -6; i < 6; i += 2) g.fillRect(cx(-W / 2), cy((i + 1) * 2.4), W * k, 2.4 * k); }
  g.strokeStyle = '#ffffff'; g.lineWidth = 0.07 * k;
  const line = (x0: number, y0: number, x1: number, y1: number) => { g.beginPath(); g.moveTo(cx(x0), cy(y0)); g.lineTo(cx(x1), cy(y1)); g.stroke(); };
  for (const s of [-1, 1]) {
    line(-COURT.double, s * COURT.half, COURT.double, s * COURT.half);
    line(-COURT.single, s * COURT.service, COURT.single, s * COURT.service);
    line(0, 0, 0, s * COURT.service);
    line(0, s * COURT.half, 0, s * (COURT.half - 0.25));
  }
  for (const x of [-COURT.double, -COURT.single, COURT.single, COURT.double]) line(x, -COURT.half, x, COURT.half);
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; return t;
}

function netMesh() {
  const g = new T.Group(), w = COURT.double * 2 + 1.0;
  const c = document.createElement('canvas'); c.width = 128; c.height = 32; const x = c.getContext('2d')!;
  x.strokeStyle = 'rgba(20,20,26,0.9)'; x.lineWidth = 1.5;
  for (let i = 0; i <= 128; i += 6) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 32); x.stroke(); }
  for (let j = 0; j <= 32; j += 6) { x.beginPath(); x.moveTo(0, j); x.lineTo(128, j); x.stroke(); }
  const tex = new T.CanvasTexture(c); tex.wrapS = T.RepeatWrapping; tex.repeat.set(w / 3, 1);
  const net = new T.Mesh(new T.PlaneGeometry(w, COURT.net - 0.06), new T.MeshBasicMaterial({ map: tex, transparent: true, side: T.DoubleSide, depthWrite: false }));
  net.position.y = (COURT.net - 0.06) / 2; net.userData.outlineParameters = { visible: false }; g.add(net);
  const tape = new T.Mesh(new T.BoxGeometry(w, 0.07, 0.03), toon(0xffffff)); tape.position.y = COURT.net - 0.035; g.add(tape);
  for (const s of [-1, 1]) { const p = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, 1.07, 10), toon(0x2a3a2a)); p.position.set(s * w / 2, 0.535, 0); g.add(p); }
  return g;
}

function skyDome(cols: [number, number, number]) {
  const geo = new T.SphereGeometry(400, 32, 16), pos = geo.getAttribute('position'), col: number[] = [];
  const top = new T.Color(cols[0]), mid = new T.Color(cols[1]), hor = new T.Color(cols[2]), c = new T.Color();
  for (let i = 0; i < pos.count; i++) { const y = pos.getY(i) / 400; if (y > 0.25) c.copy(mid).lerp(top, Math.min(1, (y - 0.25) / 0.6)); else c.copy(hor).lerp(mid, Math.max(0, (y + 0.05) / 0.3)); col.push(c.r, c.g, c.b); }
  geo.setAttribute('color', new T.Float32BufferAttribute(col, 3));
  const m = new T.Mesh(geo, new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide, fog: false, depthWrite: false }));
  m.userData.outlineParameters = { visible: false }; m.renderOrder = -1; return m;
}

const glowTex = (() => {
  let t: T.Texture | null = null;
  return () => {
    if (t) return t;
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d')!;
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); t = new T.CanvasTexture(c); return t;
  };
})();
const glow = (color: number, size: number, opacity = 1) => { const s = new T.Sprite(new T.SpriteMaterial({ map: glowTex(), color, transparent: true, opacity, depthWrite: false, blending: T.AdditiveBlending, fog: false })); s.scale.setScalar(size); return s; };

/** Instanced simple shapes for scenery: trees, crowd, clouds. */
function scatter(geo: T.BufferGeometry, mat: T.Material, n: number, place: (i: number, m: T.Matrix4, c: T.Color) => void) {
  const im = new T.InstancedMesh(geo, mat, n), m = new T.Matrix4(), c = new T.Color();
  for (let i = 0; i < n; i++) { c.set(0xffffff); place(i, m, c); im.setMatrixAt(i, m); im.setColorAt(i, c); }
  im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; return im;
}
const comp = (x: number, y: number, z: number, s: number, sy = s, ry = 0) => new T.Matrix4().compose(new T.Vector3(x, y, z), new T.Quaternion().setFromEuler(new T.Euler(0, ry, 0)), new T.Vector3(s, sy, s));

function buildVenue(id: VenueId, look: VenueLook, crowd: T.InstancedMesh[]) {
  const g = new T.Group(), r = (() => { let a = 7; return () => ((a = (a * 16807) % 2147483647) / 2147483647); })();
  const ground = new T.Mesh(new T.PlaneGeometry(400, 400), toon(look.ground)); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02; ground.receiveShadow = true;
  if (id !== 'sky') g.add(ground);
  // stands on both long sides with a bobbing crowd, except in the meadow and above the clouds
  if (id !== 'meadow' && id !== 'sky') {
    for (const s of [-1, 1]) {
      const st = new T.Mesh(new T.BoxGeometry(5, 3, 34), toon(look.night ? 0x2a2a3a : 0x8a8478)); st.position.set(s * 12.5, 1.5, 0); st.rotation.z = s * -0.35; g.add(st);
      const cm = scatter(new T.CapsuleGeometry(0.28, 0.35, 4, 8), toon(0xffffff), 70, (i, m, c) => {
        const row = i % 4, col = Math.floor(i / 4); m.copy(comp(s * (11 + row * 1.05), 1.0 + row * 0.75, -15.5 + col * 1.85 + (row % 2) * 0.6, 1));
        c.setHSL(r(), 0.55, 0.55);
      });
      cm.userData.side = s; crowd.push(cm); g.add(cm);
    }
  }
  if (id === 'meadow' || id === 'river' || id === 'temple') {
    const trunk = toon(0x6a4a2a), leaf = toon(id === 'temple' ? 0x3a6a3a : 0x4a9a3a);
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2 + r() * 0.2, d = 32 + r() * 18, x = Math.cos(a) * d, z = Math.sin(a) * d * 1.3;
      const tr = new T.Group(); tr.position.set(x, 0, z);
      const h = 4 + r() * 3; add(tr, new T.CylinderGeometry(0.3, 0.45, h, 8), trunk, 0, h / 2, 0);
      if (id === 'meadow') add(tr, new T.SphereGeometry(2.6 + r(), 10, 8), leaf, 0, h + 1.5, 0);
      else add(tr, new T.ConeGeometry(2.2 + r(), 5 + r() * 2, 9), leaf, 0, h + 2, 0);
      g.add(tr);
    }
    // hills
    for (let i = 0; i < 8; i++) { const h = new T.Mesh(new T.SphereGeometry(40 + r() * 30, 16, 10), toon(id === 'meadow' ? 0x7ab85a : 0x5a7a4a)); const a = (i / 8) * Math.PI * 2; h.position.set(Math.cos(a) * 160, -18, Math.sin(a) * 160); h.scale.y = 0.6; g.add(h); }
  }
  if (id === 'meadow') {
    const fl = scatter(new T.SphereGeometry(0.12, 6, 4), toon(0xffffff), 160, (i, m, c) => { const x = (r() - 0.5) * 60, z = (r() - 0.5) * 70; if (Math.abs(x) < 9 && Math.abs(z) < 16) { m.copy(comp(0, -5, 0, 0.01)); return; } m.copy(comp(x, 0.1, z, 1)); c.set([0xffe04a, 0xff8ab0, 0xffffff, 0xb08aff][i % 4]); });
    g.add(fl);
    const fence = toon(0xf4f0e6);
    for (const s of [-1, 1]) { const f = new T.Mesh(new T.BoxGeometry(0.1, 1.0, 36), fence); f.position.set(s * 9.5, 0.5, 0); g.add(f); }
  }
  if (id === 'river') {
    const w = new T.Mesh(new T.PlaneGeometry(30, 300), toon(0x4a90c8, { transparent: true, opacity: 0.9 })); w.rotation.x = -Math.PI / 2; w.position.set(-30, 0.02, 0); g.add(w);
    g.userData.water = w;
  }
  if (id === 'seaside') {
    const sea = new T.Mesh(new T.PlaneGeometry(600, 300), toon(0x2a6aa8)); sea.rotation.x = -Math.PI / 2; sea.position.set(0, 0.05, -170); g.add(sea); g.userData.water = sea;
    const lh = new T.Group(); lh.position.set(-34, 0, -60); g.add(lh);
    add(lh, new T.CylinderGeometry(1.4, 2, 14, 12), toon(0xf4f0e6), 0, 7, 0);
    for (let i = 0; i < 3; i++) add(lh, new T.CylinderGeometry(1.75 - i * 0.25, 1.85 - i * 0.25, 1.4, 12), toon(0xd8262f), 0, 2.5 + i * 4, 0);
    add(lh, new T.CylinderGeometry(1.1, 1.1, 1.6, 10), toon(0xfff4a0), 0, 14.8, 0);
    const wall = new T.Mesh(new T.BoxGeometry(60, 1.2, 1.5), toon(0x9a9a92)); wall.position.set(0, 0.6, -19); g.add(wall);
  }
  if (id === 'temple' || id === 'night') {
    // paper lanterns on strings
    const lm = toon(id === 'night' ? 0xff4a3a : 0xffb060, { emissive: id === 'night' ? 0x8a1a10 : 0x8a4a10 });
    for (const s of [-1, 1]) for (let i = 0; i < 9; i++) {
      const l = new T.Mesh(new T.SphereGeometry(0.35, 12, 8), lm); l.scale.y = 1.25; l.position.set(s * 9.8, 4.2 + Math.sin(i) * 0.2, -16 + i * 4); g.add(l);
      const gl = glow(id === 'night' ? 0xff5a3a : 0xffa050, 2.2, 0.6); gl.position.copy(l.position); g.add(gl);
    }
  }
  if (id === 'temple') {
    const roof = toon(0x3a2a3a), wall = toon(0xd8c8a8), red = toon(0xb8302a);
    for (const [x, z, s] of [[0, -42, 1.6], [-26, -36, 1], [26, -36, 1]] as const) {
      const p = new T.Group(); p.position.set(x, 0, z); p.scale.setScalar(s); g.add(p);
      add(p, new T.BoxGeometry(10, 5, 6), wall, 0, 2.5, 0);
      for (const c of [-4, -1.3, 1.3, 4]) add(p, new T.CylinderGeometry(0.3, 0.3, 5, 8), red, c, 2.5, 3.1);
      add(p, new T.ConeGeometry(8.5, 3.5, 4), roof, 0, 6.6, 0).rotation.y = Math.PI / 4;
    }
    for (let i = 0; i < 40; i++) { const b = new T.Mesh(new T.CylinderGeometry(0.12, 0.12, 8 + r() * 4, 6), toon(0x6a9a4a)); b.position.set((r() < 0.5 ? -1 : 1) * (15 + r() * 6), 4, (r() - 0.5) * 50); g.add(b); }
  }
  if (id === 'night') {
    for (const [x, z] of [[-13, -20], [13, -20], [-13, 20], [13, 20]] as const) {
      const p = new T.Mesh(new T.CylinderGeometry(0.25, 0.35, 18, 8), toon(0x3a3a4a)); p.position.set(x, 9, z); g.add(p);
      const lamp = new T.Mesh(new T.BoxGeometry(2.4, 1.2, 0.6), toon(0xffffff, { emissive: 0xfff4d8 })); lamp.position.set(x * 0.95, 18, z * 0.95); g.add(lamp);
      const gl = glow(0xfff0d0, 14, 0.8); gl.position.copy(lamp.position); g.add(gl);
    }
    const st = new T.Points(new T.BufferGeometry().setAttribute('position', new T.Float32BufferAttribute(Array.from({ length: 900 }, (_, i) => { const a = r() * Math.PI * 2, e = 0.15 + r() * 1.3; return i % 3 === 0 ? Math.cos(a) * Math.cos(e) * 380 : i % 3 === 1 ? Math.sin(e) * 380 : Math.sin(a) * Math.cos(e) * 380; }), 3)), new T.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false }));
    g.add(st);
  }
  if (id === 'sky') {
    // a floating court: a stone deck over a sea of clouds
    const deck = new T.Mesh(new T.CylinderGeometry(24, 18, 4, 32), toon(0xe8e0f0)); deck.position.y = -2.02; deck.scale.z = 1.6; g.add(deck);
    const cm = scatter(new T.SphereGeometry(1, 12, 8), toon(0xffffff, { emissive: 0x6a4a6a }), 140, (i, m) => {
      const a = r() * Math.PI * 2, d = 40 + r() * 160; m.copy(comp(Math.cos(a) * d, -8 - r() * 10, Math.sin(a) * d, 6 + r() * 12, 2 + r() * 3, r() * 3));
    });
    g.add(cm);
    for (const s of [-1, 1]) for (let i = 0; i < 5; i++) { const col = new T.Mesh(new T.CylinderGeometry(0.4, 0.5, 5, 10), toon(0xf4f0f8)); col.position.set(s * 14, 2.5, -24 + i * 12); g.add(col); }
  }
  return g;
}
function add(p: T.Object3D, geo: T.BufferGeometry, m: T.Material, x: number, y: number, z: number) { const o = new T.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; p.add(o); return o; }

// ---------------------------------------------------------------- the scene
export class SmashScene {
  renderer: T.WebGLRenderer; scene = new T.Scene(); camera = new T.PerspectiveCamera(40, 1, 0.1, 1200);
  outline: OutlineEffect;
  world = new T.Group();
  hemi = new T.HemisphereLight(0xffffff, 0x444444, 1); sun = new T.DirectionalLight(0xffffff, 2);
  rigs: Rig[] = []; ids: CharId[] = [];
  ball: T.Mesh; ballShadow: T.Mesh; ballGlow: T.Sprite; decoys: T.Mesh[] = []; land: T.Mesh;
  trail: { line: T.Line; pos: Float32Array; col: Float32Array; pts: number[][] };
  fire = new Sparks(500, true); dust = new Sparks(300, false);
  rings: { m: T.Mesh; t: number; max: number; size: number }[] = [];
  shield: T.Mesh; frost: T.Mesh;
  crowd: T.InstancedMesh[] = [];
  t = 0; camPos = new T.Vector3(0, 6, 24); camLook = new T.Vector3(0, 0, -4); venue: VenueId | null = null;
  private water: T.Mesh | null = null;
  constructor(canvas: HTMLCanvasElement) {
    const phone = Math.min(innerWidth, innerHeight) < 600;
    this.renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, phone ? 1.25 : 1.5));
    this.renderer.toneMapping = T.NoToneMapping;
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = phone ? T.BasicShadowMap : T.PCFShadowMap;
    this.outline = new OutlineEffect(this.renderer, { defaultThickness: 0.0045, defaultColor: [0.1, 0.07, 0.08] });
    this.scene.add(this.world, this.hemi, this.sun, this.sun.target);
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera; sc.left = -16; sc.right = 16; sc.top = 22; sc.bottom = -22; sc.near = 1; sc.far = 140;
    this.scene.fog = new T.FogExp2(0xffffff, 0.006);
    // the ball: bigger than life so it reads from behind the baseline
    this.ball = new T.Mesh(new T.SphereGeometry(0.11, 16, 12), toon(0xe8f84a)); this.ball.castShadow = false;
    this.ballShadow = new T.Mesh(new T.CircleGeometry(0.14, 16), new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }));
    this.ballShadow.rotation.x = -Math.PI / 2; this.ballShadow.userData.outlineParameters = { visible: false };
    this.ballGlow = glow(0xffffff, 1.2, 0); this.ball.add(this.ballGlow);
    for (let i = 0; i < 2; i++) { const d = new T.Mesh(new T.SphereGeometry(0.11, 12, 10), new T.MeshBasicMaterial({ color: 0x8ac8ff, transparent: true, opacity: 0.6 })); d.userData.outlineParameters = { visible: false }; d.add(glow(0x6ab0ff, 1.0, 0.8)); this.decoys.push(d); this.scene.add(d); }
    this.land = new T.Mesh(new T.RingGeometry(0.28, 0.4, 24), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false }));
    this.land.rotation.x = -Math.PI / 2; this.land.userData.outlineParameters = { visible: false };
    const N = 22, pos = new Float32Array(N * 3), col = new Float32Array(N * 3), lg = new T.BufferGeometry();
    lg.setAttribute('position', new T.BufferAttribute(pos, 3)); lg.setAttribute('color', new T.BufferAttribute(col, 3));
    const line = new T.Line(lg, new T.LineBasicMaterial({ vertexColors: true, transparent: true, blending: T.AdditiveBlending, depthWrite: false }));
    line.frustumCulled = false; line.userData.outlineParameters = { visible: false };
    this.trail = { line, pos, col, pts: [] };
    // Shell Fortress: a hexagon shield across the tortoises' half
    const hc = document.createElement('canvas'); hc.width = 256; hc.height = 128; const hx = hc.getContext('2d')!;
    hx.strokeStyle = 'rgba(140,255,180,0.9)'; hx.lineWidth = 3;
    for (let row = 0; row < 6; row++) for (let c = 0; c < 10; c++) { const cx = c * 28 + (row % 2) * 14, cy = row * 24; hx.beginPath(); for (let k = 0; k <= 6; k++) { const a = (k / 6) * Math.PI * 2; hx.lineTo(cx + Math.cos(a) * 14, cy + Math.sin(a) * 14); } hx.stroke(); }
    this.shield = new T.Mesh(new T.PlaneGeometry(13, 4.5), new T.MeshBasicMaterial({ map: new T.CanvasTexture(hc), transparent: true, opacity: 0, blending: T.AdditiveBlending, side: T.DoubleSide, depthWrite: false, color: 0x8affb0 }));
    this.shield.userData.outlineParameters = { visible: false };
    // Absolute Zero: frost across a half of the court
    this.frost = new T.Mesh(new T.PlaneGeometry(13, 13), new T.MeshBasicMaterial({ color: 0xdff4ff, transparent: true, opacity: 0, depthWrite: false }));
    this.frost.rotation.x = -Math.PI / 2; this.frost.position.y = 0.015; this.frost.userData.outlineParameters = { visible: false };
    this.scene.add(this.ball, this.ballShadow, this.land, line, this.fire.pts, this.dust.pts, this.shield, this.frost);
    this.resize();
  }
  resize() {
    const c = this.renderer.domElement, w = c.clientWidth || innerWidth, h = c.clientHeight || innerHeight;
    this.renderer.setSize(w, h, false); this.camera.aspect = w / h;
    // a tall phone screen needs a wider view to keep both baselines
    this.camera.fov = w / h < 0.8 ? 62 : w / h < 1.3 ? 50 : 40;
    this.camera.updateProjectionMatrix();
  }

  /** Build the venue and the players for a match. */
  setMatch(venue: VenueId, players: { id: CharId; side: number }[], doubles: boolean) {
    for (const r of this.rigs) this.scene.remove(r.root);
    this.rigs = []; this.ids = [];
    this.world.traverse((o) => { if ((o as T.Mesh).geometry) (o as T.Mesh).geometry.dispose(); });
    this.world.clear(); this.crowd = [];
    const look = LOOKS[venue]; this.venue = venue;
    const grass = venue === 'meadow';
    this.world.add(skyDome(look.sky));
    const court = new T.Mesh(new T.PlaneGeometry(18, 36), toon(0xffffff, { map: courtTexture(look, doubles, grass) }));
    court.rotation.x = -Math.PI / 2; court.receiveShadow = true; court.userData.outlineParameters = { visible: false }; this.world.add(court);
    this.world.add(netMesh());
    const v = buildVenue(venue, look, this.crowd); this.world.add(v); this.water = v.userData.water ?? null;
    (this.scene.fog as T.FogExp2).color.set(look.fog); (this.scene.fog as T.FogExp2).density = look.fogD;
    this.hemi.color.set(look.hemi[0]); this.hemi.groundColor.set(look.hemi[1]); this.hemi.intensity = look.hemi[2];
    this.sun.color.set(look.sun[0]); this.sun.intensity = look.sun[1]; this.sun.position.set(...look.sunPos); this.sun.target.position.set(0, 0, 0);
    if (look.night) { const gl = glow(0xffffff, 12, 0.5); gl.position.set(60, 90, -200); this.world.add(gl); }
    else { const s = glow(look.sun[0], 50, 0.8); s.position.set(look.sunPos[0] * 5, look.sunPos[1] * 3, look.sunPos[2] * 5 - 80); this.world.add(s); }
    for (const p of players) {
      const r = buildPlayer(p.id); r.root.scale.setScalar(1.35);
      r.root.traverse((o) => { o.castShadow = true; });
      this.scene.add(r.root); this.rigs.push(r); this.ids.push(p.id);
    }
    this.fire.clear(); this.dust.clear(); this.trail.pts = [];
    for (const r of this.rings) { this.scene.remove(r.m); r.m.geometry.dispose(); }
    this.rings = [];
  }

  // ---------------------------------------------------------------- effects from match events
  hit(x: number, y: number, z: number, special: SpecialId | null, power: number) {
    const n = special ? 40 : 6 + Math.round(power * 10), c = special ? TRAIL[special] : 0xfff4b0;
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, e = Math.random() * 2 - 0.5, sp = (special ? 7 : 4) * (0.4 + Math.random()); this.fire.spawn(X(x), z, Z(y), Math.cos(a) * sp, e * sp, Math.sin(a) * sp, 0.25 + Math.random() * 0.3, special ? 0.35 : 0.18, c); }
    if (special) this.ring(x, y, z, 3.5, TRAIL[special], true);
  }
  bounce(x: number, y: number, special: SpecialId | null, clay: boolean) {
    this.ring(x, y, 0.02, special ? 3 : 0.8, special ? TRAIL[special] : 0xffffff, false);
    if (clay || special) for (let i = 0; i < (special ? 30 : 8); i++) { const a = Math.random() * Math.PI * 2, sp = (special ? 4 : 1.2) * Math.random(); this.dust.spawn(X(x), 0.05, Z(y), Math.cos(a) * sp, 1 + Math.random() * (special ? 3 : 1), Math.sin(a) * sp, 0.6, special ? 0.5 : 0.25, special ? TRAIL[special] : 0xd8a07a); }
  }
  burst(x: number, y: number, z: number, color: number) {
    this.ring(x, y, z, 5, color, true);
    for (let i = 0; i < 60; i++) { const a = Math.random() * Math.PI * 2, e = (Math.random() - 0.3) * 2, sp = 9 * Math.random(); this.fire.spawn(X(x), z, Z(y), Math.cos(a) * sp, e * sp, Math.sin(a) * sp, 0.5 + Math.random() * 0.4, 0.4, color); }
  }
  private ring(x: number, y: number, z: number, size: number, color: number, upright: boolean) {
    const m = new T.Mesh(new T.RingGeometry(0.7, 1, 32), new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: T.DoubleSide, depthWrite: false, blending: T.AdditiveBlending }));
    m.userData.outlineParameters = { visible: false };
    m.position.set(X(x), z + 0.03, Z(y)); if (!upright) m.rotation.x = -Math.PI / 2; else m.lookAt(this.camera.position);
    this.scene.add(m); this.rings.push({ m, t: 0, max: 0.45, size });
  }

  // ---------------------------------------------------------------- per frame
  render(f: FrameView) {
    const dt = f.dt; this.t += dt;
    // players
    for (let i = 0; i < this.rigs.length && i < f.players.length; i++) {
      const r = this.rigs[i], p = f.players[i], face = p.side === 0 ? Math.PI / 2 : -Math.PI / 2;
      const leap = p.jump > 0 ? Math.sin(Math.min(1, p.jump / 1.2) * Math.PI) * (p.jump > 0.6 ? 3.2 : 0.8) : 0;
      r.root.position.set(X(p.x), leap, Z(p.y));
      // turn a little towards where they run sideways, and wobble when knocked back
      r.root.rotation.set(0, face - (p.side === 0 ? 1 : -1) * Math.max(-0.5, Math.min(0.5, p.vx * 0.08)), p.stun > 0 ? Math.sin(this.t * 14) * 0.35 : 0);
      if (p.stun > 0) r.root.rotation.y += this.t * 9;
      posePlayer(r, this.t + i * 0.7, Math.hypot(p.vx, p.vy), p.swing / 0.32, p.kind, p.charging);
      r.root.updateMatrixWorld(true);
      if (p.charging && Math.random() < 0.5) { const w = new T.Vector3(); r.racket.getWorldPosition(w); this.fire.spawn(w.x, w.y + 0.5, w.z, (Math.random() - 0.5), 1 + Math.random(), (Math.random() - 0.5), 0.3, 0.12, p.id === 'dora' ? 0xff8a5a : 0x8ac8ff); }
      if (p.frost > 0 && Math.random() < 0.3) this.dust.spawn(X(p.x) + (Math.random() - 0.5), 0.1, Z(p.y) + (Math.random() - 0.5), 0, 0.5, 0, 0.8, 0.2, 0xe8f8ff);
    }
    // the ball, its shadow, glow, trail and fake twins
    const b = f.ball, sp = b.special;
    this.ball.visible = this.ballShadow.visible = b.visible;
    this.ball.position.set(X(b.x), b.z + 0.11, Z(b.y));
    this.ballShadow.position.set(X(b.x), 0.012, Z(b.y)); this.ballShadow.scale.setScalar(1 + b.z * 0.15);
    (this.ballShadow.material as T.MeshBasicMaterial).opacity = Math.max(0.1, 0.4 - b.z * 0.04);
    const gm = this.ballGlow.material as T.SpriteMaterial;
    gm.opacity = sp ? 0.95 : 0; gm.color.set(sp ? TRAIL[sp] : 0xffffff); this.ballGlow.scale.setScalar(sp ? 1.6 + Math.sin(this.t * 30) * 0.2 : 1);
    (this.ball.material as T.MeshToonMaterial).color.set(sp === 'zero' ? 0xdff4ff : sp && FIRE[sp] ? FIRE[sp]![0] : 0xe8f84a);
    const fire = sp ? FIRE[sp] : undefined;
    if (b.visible && fire) for (let i = 0; i < 6; i++) this.fire.spawn(this.ball.position.x + (Math.random() - 0.5) * 0.2, this.ball.position.y + (Math.random() - 0.5) * 0.2, this.ball.position.z + (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 1.5, Math.random() * 1.5, (Math.random() - 0.5) * 1.5, 0.35, 0.4, i % 2 ? fire[0] : fire[1]);
    if (b.visible && (sp === 'zero' || sp === 'squall' || sp === 'drop' || sp === 'mirror')) for (let i = 0; i < 3; i++) this.fire.spawn(this.ball.position.x, this.ball.position.y, this.ball.position.z, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, 0.4, 0.22, TRAIL[sp]);
    // decoys of the Phantom Page: they fan out, then fade before the bounce
    const fake = b.decoys.length > 0 && b.age < b.flight * 0.6;
    this.decoys.forEach((d, i) => {
      d.visible = b.visible && fake && i < b.decoys.length;
      if (!d.visible) return;
      const k = Math.min(1, b.age / b.flight);
      d.position.set(X(b.x + b.decoys[i] * k), b.z + 0.11, Z(b.y));
      (d.material as T.MeshBasicMaterial).opacity = 0.75 * (1 - Math.max(0, (b.age / b.flight - 0.45) / 0.15));
    });
    // trail
    const tr = this.trail;
    if (b.visible) tr.pts.unshift([this.ball.position.x, this.ball.position.y, this.ball.position.z]); else tr.pts = [];
    const N = tr.pos.length / 3; if (tr.pts.length > N) tr.pts.length = N;
    const tc = new T.Color(sp ? TRAIL[sp] : TRAIL.none), wid = sp ? 1 : 0.55;
    for (let i = 0; i < N; i++) {
      const p = tr.pts[Math.min(i, tr.pts.length - 1)] ?? [0, -10, 0], k = tr.pts.length ? (1 - i / N) * wid : 0;
      // the mirror volley leaves a zigzag
      const zig = sp === 'mirror' && i % 2 ? 0.25 : 0;
      tr.pos.set([p[0] + zig, p[1], p[2]], i * 3); tr.col.set([tc.r * k, tc.g * k, tc.b * k], i * 3);
    }
    tr.line.geometry.attributes.position.needsUpdate = true; tr.line.geometry.attributes.color.needsUpdate = true;
    // landing marker on your side
    this.land.visible = !!f.land; if (f.land) { this.land.position.set(X(f.land.x), 0.02, Z(f.land.y)); this.land.scale.setScalar(1 + Math.sin(this.t * 8) * 0.08); }
    // the shell fortress and the frost
    const sm = this.shield.material as T.MeshBasicMaterial;
    sm.opacity += ((f.fortress >= 0 ? 0.55 : 0) - sm.opacity) * Math.min(1, dt * 6);
    this.shield.visible = sm.opacity > 0.01;
    if (f.fortress >= 0) this.shield.position.set(0, 2.25, Z(f.fortress === 0 ? -2.5 : 2.5));
    const frosted = f.players.find((p) => p.frost > 0), fm = this.frost.material as T.MeshBasicMaterial;
    fm.opacity += ((frosted ? 0.55 : 0) - fm.opacity) * Math.min(1, dt * 4); this.frost.visible = fm.opacity > 0.01;
    if (frosted) this.frost.position.set(0, 0.015, Z(frosted.side === 0 ? -6 : 6));
    // effects
    this.fire.step(dt, 1.5); this.dust.step(dt, -6);
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i]; r.t += dt; const k = r.t / r.max;
      r.m.scale.setScalar(0.2 + k * r.size); (r.m.material as T.MeshBasicMaterial).opacity = 0.9 * (1 - k);
      if (k >= 1) { this.scene.remove(r.m); r.m.geometry.dispose(); (r.m.material as T.Material).dispose(); this.rings.splice(i, 1); }
    }
    for (const c of this.crowd) c.position.y = Math.abs(Math.sin(this.t * 6 + c.userData.side)) * 0.08;
    if (this.water) this.water.position.y = 0.04 + Math.sin(this.t) * 0.03;
    // camera
    const you = f.players[0], wantPos = new T.Vector3(), wantLook = new T.Vector3();
    if (f.cine) {
      // swoop round the hitter: from low beside them up and over the shoulder
      const c = f.cine, a = -0.9 + c.t * 1.3, sx = c.side === 0 ? 1 : -1;
      wantPos.set(X(c.x) + Math.sin(a) * 4.5, 1.3 + c.t * 1.6, Z(c.y) + sx * Math.cos(a) * 4.5);
      wantLook.set(X(c.x), 1.4, Z(c.y));
    } else if (f.celebrate > 0) {
      const a = this.t * 0.4; wantPos.set(Math.sin(a) * 9, 3.5, Z(you.y) + Math.cos(a) * 9); wantLook.set(X(you.x), 1, Z(you.y));
    } else {
      const fx = you ? X(you.x) * 0.35 : 0;
      wantPos.set(fx, 7.4, COURT.half + 12); wantLook.set(fx * 0.5 + X(b.x) * 0.1, 0, -3)
    }
    const k = f.cine ? 1 - Math.pow(0.0005, dt) : 1 - Math.pow(0.02, dt);
    this.camPos.lerp(wantPos, f.reduced ? 1 : k); this.camLook.lerp(wantLook, f.reduced ? 1 : k);
    this.camera.position.copy(this.camPos);
    if (f.shake > 0 && !f.reduced) this.camera.position.add(new T.Vector3((Math.random() - 0.5) * f.shake, (Math.random() - 0.5) * f.shake, 0));
    this.camera.lookAt(this.camLook);
    this.outline.render(this.scene, this.camera);
  }
  dispose() { this.renderer.dispose(); }
}
