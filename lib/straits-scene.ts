// Little Red Dot: The Straits, drawing only. Three.js: the sea, the bumboat with Dora and Enzo aboard, the islands,
// the mainland with its skyline, the kelong, otter rafts, Captain Bishan's war raft, the cat hunter, peanuts, clams
// and floating crates. The page owns the HUD; `project` gives it screen positions for its markers.
import * as T from 'three';
import { type Game, type Foe, type Ev, type HeroId, ISLANDS, HOME, KELONG, DOCKS, SHORE_Z, forward } from './straits-game';
import { makeChinchilla3d } from './chinchilla-3d';

const PI = Math.PI;
let seed = 23;
const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
function tex(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, rx = 1, ry = 1): T.CanvasTexture {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d')!, w, h);
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = 8; return t;
}
const std = (color: number, o: T.MeshStandardMaterialParameters = {}) => new T.MeshStandardMaterial({ color, roughness: 0.8, ...o });
const far = (color: number) => new T.MeshLambertMaterial({ color });
function mesh(geo: T.BufferGeometry, mat: T.Material, x = 0, y = 0, z = 0, shadow = true): T.Mesh { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = shadow; return m; }
const box = (w: number, h: number, d: number, mat: T.Material, x = 0, y = 0, z = 0, sh = true) => mesh(new T.BoxGeometry(w, h, d), mat, x, y, z, sh);
const cyl = (r1: number, r2: number, h: number, mat: T.Material, x = 0, y = 0, z = 0, seg = 14) => mesh(new T.CylinderGeometry(r1, r2, h, seg), mat, x, y, z);
function ball(r: number, mat: T.Material, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1): T.Mesh { const m = mesh(new T.SphereGeometry(r, 18, 12), mat, x, y, z); m.scale.set(sx, sy, sz); return m; }
export const wave = (x: number, z: number, t: number) => Math.sin(x * 0.55 + t * 1.1) * 0.035 + Math.sin(z * 0.8 - t * 1.4 + x * 0.2) * 0.03 + Math.sin((x + z) * 0.13 + t * 0.5) * 0.09;

const wood = std(0x7a4a2a, { roughness: 0.7 }), woodL = std(0xc99a62, { roughness: 0.75 }), black = std(0x1b1b1d, { roughness: 0.6 });
function hullShape(k: number): T.Shape {
  const s = new T.Shape(); [[-0.38, -1.1], [0.38, -1.1], [0.46, -0.3], [0.4, 0.6], [0, 1.45], [-0.4, 0.6], [-0.46, -0.3]].forEach(([x, y], i) => (i ? s.lineTo(x * k, y * k) : s.moveTo(x * k, y * k))); s.closePath(); return s;
}
function hullPart(k: number, depth: number, mat: T.Material, y: number): T.Mesh { const m = mesh(new T.ExtrudeGeometry(hullShape(k), { depth, bevelEnabled: false }), mat, 0, y, 0); m.rotation.x = -PI / 2; return m; }
const flagTex = (col: string) => tex(64, 64, g => { g.fillStyle = col; g.fillRect(0, 0, 64, 64); g.fillStyle = '#fff8e8'; g.beginPath(); g.arc(32, 38, 12, 0, PI * 2); g.fill(); for (const [x, y] of [[16, 20], [28, 14], [40, 14], [50, 22]]) { g.beginPath(); g.arc(x, y, 5, 0, PI * 2); g.fill(); } });

function otter(): T.Group {
  const g = new T.Group(), br = std(0x5a4533, { roughness: 0.9 }), cr = std(0xcdb898, { roughness: 0.9 }), dk = std(0x1c1614, { roughness: 0.3 });
  g.add(ball(1, br, 0, 0.13, 0, 0.11, 0.11, 0.3), ball(0.09, br, 0, 0.2, 0.3, 1.05, 0.9, 1), ball(1, cr, 0, 0.165, 0.34, 0.07, 0.05, 0.075), ball(1, cr, 0, 0.085, 0.12, 0.085, 0.06, 0.2), ball(0.018, dk, 0, 0.195, 0.41));
  for (const s of [-1, 1]) g.add(ball(0.012, dk, s * 0.045, 0.24, 0.355), ball(0.02, br, s * 0.075, 0.265, 0.27), ball(1, br, s * 0.085, 0.045, 0.16, 0.035, 0.05, 0.05), ball(1, br, s * 0.085, 0.045, -0.16, 0.04, 0.05, 0.06));
  const tl = mesh(new T.ConeGeometry(0.055, 0.45, 10), br, 0, 0.1, -0.48); tl.rotation.x = -PI / 2; g.add(tl); return g;
}
function raftModel(boss: boolean): T.Group {
  const g = new T.Group();
  for (let i = -2; i <= 2; i++) { const l = cyl(0.09, 0.09, 1.5, std(0x6f5234, { roughness: 1 }), i * 0.17, 0.04, 0, 10); l.rotation.x = PI / 2; g.add(l); }
  g.add(cyl(0.015, 0.015, 0.9, woodL, 0, 0.5, -0.3, 8), box(0.4, 0.28, 0.01, std(0xffffff, { map: flagTex(boss ? '#b3261e' : '#2f7fc0'), side: T.DoubleSide }), 0.2, 0.8, -0.3));
  const spots: [number, number, number][] = boss ? [[-0.2, 0.25, 0.95], [0.22, -0.1, 0.8], [0, -0.45, 0.8]] : [[-0.18, 0.25, 0.9], [0.2, -0.1, 0.8]];
  for (const [x, z, s] of spots) { const o = otter(); o.position.set(x, 0.1, z); o.scale.setScalar(s); g.add(o); }
  if (boss) g.scale.setScalar(1.7);
  return g;
}
function hunterModel(): T.Group {
  const g = new T.Group(), fur = std(0xc8782c), pale = std(0xf3e6d0);
  const hull = hullPart(0.62, 0.2, std(0xf2f0ea, { roughness: 0.4 }), -0.05), stripe = hullPart(0.64, 0.05, std(0xe07b2c), 0.15); hull.rotation.z = PI; stripe.rotation.z = PI; g.add(hull, stripe);
  g.add(ball(1, fur, 0, 0.42, -0.1, 0.2, 0.22, 0.26), ball(0.14, fur, 0, 0.62, 0.2), ball(1, pale, 0, 0.58, 0.32, 0.06, 0.05, 0.05));
  for (const s of [-1, 1]) g.add(mesh(new T.ConeGeometry(0.05, 0.1, 4), fur, s * 0.08, 0.77, 0.18), ball(0.02, black, s * 0.055, 0.65, 0.32));
  return g;
}

export class StraitsScene {
  private renderer: T.WebGLRenderer; private scene = new T.Scene(); private camera = new T.PerspectiveCamera(55, 16 / 9, 0.05, 420);
  private boat = new T.Group(); private chins: T.Group[] = []; private camYaw = 0;
  private sea: T.Mesh; private seaTex: T.CanvasTexture; private seaX: Float32Array; private seaZ: Float32Array;
  private foes = new Map<number, T.Group>(); private shots: T.Mesh[] = []; private crates: T.Mesh[] = []; private rings: { m: T.Mesh; t: number }[] = [];
  private chief: T.Group; private beacon: T.Mesh; private v = new T.Vector3();

  constructor(private canvas: HTMLCanvasElement, hero: HeroId) {
    const r = this.renderer = new T.WebGLRenderer({ canvas, antialias: true });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); r.shadowMap.enabled = true; r.shadowMap.type = T.PCFSoftShadowMap;
    const sc = this.scene; sc.fog = new T.Fog(0xd9ecef, 30, 190);
    sc.background = tex(4, 256, g => { const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#2f8fd6'); gr.addColorStop(0.45, '#8fd0ee'); gr.addColorStop(0.62, '#f6e7c4'); gr.addColorStop(1, '#f6e7c4'); g.fillStyle = gr; g.fillRect(0, 0, 4, 256); });
    const SUN = new T.Vector3(6, 9, 5);
    sc.add(new T.HemisphereLight(0xfff6e8, 0x2f7f90, 1.7));
    const sun = new T.DirectionalLight(0xfff1d6, 1.9); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.01;
    Object.assign(sun.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 1, far: 30 }); sc.add(sun, sun.target); this.sun = sun; this.sunOff = SUN;

    // clouds
    const cloud = new T.MeshBasicMaterial({ color: 0xffffff, fog: false, transparent: true, opacity: 0.9 });
    for (let i = 0; i < 14; i++) { const c = new T.Group(); for (let k = 0; k < 4; k++) c.add(mesh(new T.SphereGeometry(5 + rnd() * 4, 10, 8), cloud, k * 6 - 9, rnd() * 2, rnd() * 3, false)); c.scale.y = 0.45; const a = i / 14 * PI * 2; c.position.set(Math.sin(a) * 260, 44 + rnd() * 24, Math.cos(a) * 260); sc.add(c); }

    // sea
    this.seaTex = tex(256, 256, (g, w, h) => { g.fillStyle = '#1c8fa0'; g.fillRect(0, 0, w, h); for (let i = 0; i < 90; i++) { g.strokeStyle = i % 3 ? 'rgba(255,255,255,.16)' : 'rgba(8,60,80,.25)'; g.lineWidth = 1 + rnd() * 2; const x = rnd() * w, y = rnd() * h, l = 14 + rnd() * 40; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + l / 2, y - 5, x + l, y); g.stroke(); } }, 80, 80);
    const sg = new T.PlaneGeometry(480, 480, 120, 120); sg.rotateX(-PI / 2);
    this.sea = mesh(sg, std(0xffffff, { map: this.seaTex, roughness: 0.3, metalness: 0.15 }), 0, 0, 0, false); this.sea.receiveShadow = true; sc.add(this.sea);
    const P = sg.attributes.position; this.seaX = new Float32Array(P.count); this.seaZ = new Float32Array(P.count);
    for (let i = 0; i < P.count; i++) { this.seaX[i] = P.getX(i); this.seaZ[i] = P.getZ(i); }

    this.buildBoat(hero, SUN); this.buildLand();
    // the kelong, with Captain Bishan on it until he casts off
    const k = new T.Group(); k.position.set(KELONG.x, 0, KELONG.z);
    k.add(box(4.4, 0.08, 4, woodL, 0, 0.5, 0)); for (const x of [-2, 0, 2]) for (const z of [-1.8, 1.8]) k.add(cyl(0.07, 0.07, 1.6, wood, x, -0.2, z, 8));
    k.add(box(2, 1.2, 1.8, std(0x8a6a45), -0.8, 1.14, -0.7), box(2.4, 0.08, 2.2, std(0x4f6f78, { metalness: 0.4, roughness: 0.5 }), -0.8, 1.78, -0.7), cyl(0.03, 0.03, 2.2, woodL, 1.8, 1.6, -1.6, 8), box(0.9, 0.6, 0.02, std(0xffffff, { map: flagTex('#2f7fc0'), side: T.DoubleSide }), 1.33, 2.35, -1.6));
    this.chief = otter(); this.chief.scale.setScalar(1.5); this.chief.rotation.order = 'YXZ'; this.chief.rotation.x = -0.55; this.chief.position.set(1.2, 0.72, 1.2); k.add(this.chief); sc.add(k);
    // the goal: a gold column over the Ubin jetty, seen from far off
    const u = DOCKS.find(d => d.id === 'ubin')!;
    this.beacon = mesh(new T.CylinderGeometry(0.5, 0.5, 30, 12, 1, true), new T.MeshBasicMaterial({ color: 0xf6c453, transparent: true, opacity: 0.35, depthWrite: false, fog: false, side: T.DoubleSide }), u.x, 15, u.z, false); sc.add(this.beacon);

    const peanut = std(0xd9b77a), clam = std(0x9aa3a8), crate = std(0xc99a62);
    for (let i = 0; i < 40; i++) { const m = ball(0.09, peanut, 0, 0, 0, 1, 0.8, 1.5); m.visible = false; m.userData.peanut = peanut; m.userData.clam = clam; sc.add(m); this.shots.push(m); }
    for (let i = 0; i < 8; i++) { const m = box(0.5, 0.4, 0.5, crate); m.visible = false; sc.add(m); this.crates.push(m); }
    for (let i = 0; i < 12; i++) { const m = mesh(new T.RingGeometry(0.7, 1, 28), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }), 0, 0.12, 0, false); m.rotation.x = -PI / 2; sc.add(m); this.rings.push({ m, t: 1 }); }
  }
  private sun!: T.DirectionalLight; private sunOff!: T.Vector3;

  private buildBoat(hero: HeroId, sun: T.Vector3) {
    const b = new T.Group();
    b.add(hullPart(0.9, 0.22, wood, -0.12), hullPart(1, 0.1, std(0xc8372d, { roughness: 0.5 }), 0.1), hullPart(1.02, 0.04, std(0xf2ece0, { roughness: 0.5 }), 0.2), hullPart(1.03, 0.035, std(0x2e7d4f, { roughness: 0.5 }), 0.24), hullPart(0.9, 0.02, woodL, 0.262));
    for (const s of [-1, 1]) {
      const eye = mesh(new T.CircleGeometry(0.075, 20), std(0xfdfbf4), s * 0.255, 0.15, -0.98, false); eye.rotation.y = s * 1.13; b.add(eye);
      const pup = mesh(new T.CircleGeometry(0.035, 16), black, s * 0.262, 0.15, -0.985, false); pup.rotation.y = s * 1.13; b.add(pup);
      for (const z of [-0.2, 0.35, 0.85]) { const ty = mesh(new T.TorusGeometry(0.075, 0.03, 8, 18), black, s * (z > 0.5 ? 0.44 : 0.49), 0.12, z); ty.rotation.y = PI / 2; b.add(ty); }
    }
    for (const sx of [-0.33, 0.33]) for (const z of [0.0, 0.6]) b.add(cyl(0.015, 0.015, 0.5, woodL, sx, 0.53, z, 8));
    b.add(box(0.8, 0.03, 0.75, std(0x2b62b8, { roughness: 0.6 }), 0, 0.79, 0.3));
    const yard = cyl(0.014, 0.014, 0.95, woodL, 0, 1.78, -0.35, 8); yard.rotation.z = PI / 2; b.add(cyl(0.022, 0.028, 1.75, woodL, 0, 1.15, -0.35, 10), yard);
    const sailT = tex(256, 256, g => { g.fillStyle = '#fbf6e9'; g.fillRect(0, 0, 256, 256); g.strokeStyle = 'rgba(160,150,130,.5)'; for (let y = 32; y < 256; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); } g.fillStyle = '#d0312d'; g.beginPath(); g.arc(128, 128, 46, 0, PI * 2); g.fill(); });
    const sg = new T.PlaneGeometry(0.9, 1.1, 10, 10), sp = sg.attributes.position; for (let i = 0; i < sp.count; i++) sp.setZ(i, -Math.cos(sp.getX(i) / 0.45 * PI / 2) * 0.16 * (1 - (sp.getY(i) + 0.55) / 1.1 * 0.4)); sg.computeVertexNormals();
    b.add(mesh(sg, std(0xffffff, { map: sailT, side: T.DoubleSide, roughness: 0.9 }), 0, 1.2, -0.37));
    const hay = tex(128, 128, g => { g.fillStyle = '#d2b55e'; g.fillRect(0, 0, 128, 128); for (let i = 0; i < 400; i++) { g.strokeStyle = ['#b8973f', '#e6cf82', '#a8873a'][i % 3]; g.beginPath(); const x = rnd() * 128, y = rnd() * 128; g.moveTo(x, y); g.lineTo(x + 10 + rnd() * 14, y + rnd() * 4 - 2); g.stroke(); } });
    b.add(box(0.42, 0.26, 0.3, std(0xffffff, { map: hay, roughness: 1 }), -0.08, 0.41, 0.28)); for (const x of [-0.2, 0.04]) b.add(box(0.02, 0.265, 0.305, std(0xb0352b), x, 0.41, 0.28));
    b.scale.setScalar(0.52);
    const lead = makeChinchilla3d(hero, { layers: 14, sun }), mate = makeChinchilla3d(hero === 'dora' ? 'enzo' : 'dora', { layers: 14, sun });
    lead.scale.setScalar(1 / 0.52); lead.position.set(0, 0.282, -0.92); lead.rotation.y = PI; mate.scale.setScalar(1 / 0.52); mate.position.set(-0.06, 0.282, 0.86); mate.rotation.y = PI - 0.2;
    b.add(lead, mate); this.chins = [lead, mate]; this.boat.add(b); this.scene.add(this.boat);
  }

  private buildLand() {
    const sc = this.scene, sand = std(0xead9a8, { roughness: 1 }), green = [std(0x3f8f4d, { roughness: 1 }), std(0x2f7a43, { roughness: 1 })], trunk = std(0x8a6f4a), frond = std(0x2f8a45);
    const palm = (x: number, z: number, h: number) => { const p = new T.Group(); p.position.set(x, 0.3, z); p.rotation.z = (rnd() - 0.5) * 0.3; p.add(cyl(0.07, 0.11, h, trunk, 0, h / 2, 0, 6)); for (let k = 0; k < 6; k++) { const fg = new T.ConeGeometry(0.2, 1.6, 4); fg.translate(0, 0.8, 0); const f = mesh(fg, frond, 0, h, 0); f.rotation.order = 'YXZ'; f.rotation.set(1.25, k * 1.05, 0); p.add(f); } return p; };
    for (const i of ISLANDS) {
      const g = new T.Group(); g.position.set(i.x, 0, i.z);
      g.add(ball(1, sand, 0, -0.25, 0, i.r, 0.9, i.r), ball(1, green[0], 0, 0, 0, i.r * 0.72, i.r * 0.28, i.r * 0.72), ball(1, green[1], i.r * 0.25, 0, -i.r * 0.2, i.r * 0.45, i.r * 0.36, i.r * 0.4));
      for (let k = 0; k < Math.round(i.r * 0.9); k++) { const a = rnd() * PI * 2, d = i.r * (0.74 + rnd() * 0.12); g.add(palm(Math.sin(a) * d, Math.cos(a) * d, 2.4 + rnd() * 1.6)); }
      sc.add(g);
      if (i.dock) { const dx = i.dock[0] - i.x, dz = i.dock[1] - i.z, l = Math.hypot(dx, dz), len = l - i.r + 3, j = box(0.9, 0.1, len, woodL, i.x + dx / l * (i.r - 1.5 + len / 2), 0.32, i.z + dz / l * (i.r - 1.5 + len / 2)); j.rotation.y = Math.atan2(dx, dz); sc.add(j); this.lamp(i.dock[0], i.dock[1]); }
    }
    // Sentosa's merlion, St John's lighthouse, Kusu's red-roofed shrine, Ubin's hut
    const S = ISLANDS[0], w = std(0xf3f1ea, { roughness: 0.6 }), ml = new T.Group(); ml.position.set(S.x + 9, 0.5, S.z + 9.5); ml.rotation.y = 0.8;
    ml.add(cyl(0.9, 1.1, 0.5, std(0xbfd9e0), 0, 0.25, 0, 16), ball(1, w, 0, 1.5, 0, 0.55, 1.1, 0.5), ball(0.6, w, 0, 2.75, 0.1, 1.1, 1, 1), ball(0.42, w, 0, 2.7, 0.5), ball(1, w, 0, 2.55, 0.85, 0.22, 0.18, 0.2));
    ml.add(mesh(new T.TubeGeometry(new T.QuadraticBezierCurve3(new T.Vector3(0, 2.5, 1.0), new T.Vector3(0, 2.6, 2.6), new T.Vector3(0, -0.6, 3.4)), 12, 0.07, 6), new T.MeshBasicMaterial({ color: 0xdff4fa, transparent: true, opacity: 0.8 }), 0, 0, 0, false)); sc.add(ml);
    const J = ISLANDS[1]; sc.add(cyl(0.5, 0.7, 5, w, J.x + 2, 4, J.z - 1, 12), cyl(0.6, 0.6, 0.5, std(0xc8372d), J.x + 2, 6.7, J.z - 1, 12));
    const K = ISLANDS[2]; sc.add(box(1.6, 1, 1.4, w, K.x, 1.6, K.z)); const roof = mesh(new T.ConeGeometry(1.5, 0.8, 4), std(0xc8372d), K.x, 2.5, K.z); roof.rotation.y = PI / 4; sc.add(roof);
    const U = ISLANDS[4]; sc.add(box(2.2, 1.4, 1.8, std(0x8a6a45), U.x - 6.5, 3.3, U.z - 6), box(2.6, 0.12, 2.2, std(0x9a3b2e), U.x - 6.5, 4.1, U.z - 6));
    // the mainland: sand, a sea wall, shophouses by the jetty, and the skyline behind
    sc.add(box(260, 1, 30, sand, 0, -0.1, SHORE_Z - 15.4), box(260, 0.6, 0.8, std(0xa9a59a), 0, 0.45, SHORE_Z - 0.6), box(0.9, 0.1, 6.5, woodL, HOME.x, 0.32, HOME.z - 2.2)); this.lamp(HOME.x, HOME.z);
    const cols = [0xe8b04a, 0x6fb7b0, 0xe07a5f, 0xf2e2b0, 0x8fb1d9, 0xd98aa6, 0x9bc48a, 0xe8c9a0];
    for (let k = 0; k < 10; k++) { const x = -22 + k * 4.6 + (k > 4 ? 3 : 0); sc.add(box(4.2, 6, 5, std(cols[k % cols.length]), x, 3.4, SHORE_Z - 6), box(4.4, 0.5, 5.4, std(0x9a4b3a), x, 6.6, SHORE_Z - 6)); for (const wx of [-1.1, 1.1]) sc.add(box(0.9, 1.6, 0.1, std(0x33434a), x + wx, 4.3, SHORE_Z - 3.45, false)); }
    const sky = new T.Group(); sky.position.set(30, 0, SHORE_Z - 60);
    for (let i = 0; i < 3; i++) sky.add(box(5, 34, 7, far(0x8fb0c4), i * 11 - 11, 17, 0, false)); sky.add(box(38, 2, 8, far(0x9fbccd), 2, 35.5, 0, false));
    for (let i = 0; i < 16; i++) { const h = 16 + rnd() * 36, ww = 5 + rnd() * 5; sky.add(box(ww, h, ww, far([0x7f9fb6, 0x94b3c6, 0x6f93ad][i % 3]), -34 - i * 8.5 + rnd() * 3, h / 2, -8 - rnd() * 14, false)); }
    sky.add(mesh(new T.TorusGeometry(15, 0.45, 8, 48), far(0xa9c4d2), 44, 18, 4, false), cyl(0.5, 0.5, 18, far(0xa9c4d2), 44, 9, 4, 8));
    for (const [x, h] of [[66, 11], [72, 15], [79, 10]]) { sky.add(cyl(0.5, 0.9, h, far(0x9a7fc0), x, h / 2, 10, 8)); const cap = mesh(new T.ConeGeometry(h * 0.34, h * 0.3, 12, 2, true), new T.MeshBasicMaterial({ color: 0xb48fd8, wireframe: true }), x, h + h * 0.1, 10, false); cap.rotation.x = PI; sky.add(cap); }
    sc.add(sky);
    const ship = new T.Group(); ship.position.set(-80, 0, 150); ship.rotation.y = 0.25;
    ship.add(box(60, 5, 9, far(0x8f3b34), 0, 1.5, 0, false), box(6, 9, 8, far(0xe8e8e2), -24, 8.5, 0, false));
    for (let i = 0; i < 9; i++) for (let k = 0; k < 3; k++) if (rnd() < 0.85) ship.add(box(4.6, 2.4, 8.4, far([0xc8553a, 0x2f7fc0, 0xe0a030, 0x3f8f6a, 0x8a8f96][Math.floor(rnd() * 5)]), -15 + i * 4.9, 5.2 + k * 2.5, 0, false));
    sc.add(ship);
  }
  private lamp(x: number, z: number) { this.scene.add(cyl(0.05, 0.05, 1.6, wood, x + 0.7, 1, z, 6), ball(0.16, new T.MeshBasicMaterial({ color: 0xffd98a }), x + 0.7, 1.9, z)); }

  resize(w: number, h: number) { if (!w || !h) return; this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.fov = w < h ? 72 : 55; this.camera.updateProjectionMatrix(); }

  /** Start the splashes and rings for this tick's events. */
  handle(evs: Ev[]) {
    for (const e of evs) {
      if (e.k === 'hit') this.ring(e.x, e.z, 0.5); else if (e.k === 'sink') this.ring(e.x, e.z, 1.6); else if (e.k === 'clam') this.ring(e.x, e.z, 0.4);
    }
  }
  private ring(x: number, z: number, size: number) { const r = this.rings.reduce((a, b) => (b.t > a.t ? b : a)); r.t = 0; r.m.position.set(x, 0.14, z); r.m.userData.size = size; }

  private foeModel(f: Foe): T.Group { const m = f.kind === 'hunter' ? hunterModel() : raftModel(f.kind === 'bishan'); this.scene.add(m); this.foes.set(f.id, m); return m; }

  render(g: Game, time: number, dt: number) {
    const t = time, P = this.sea.geometry.attributes.position, sx = this.seaX, sz = this.seaZ;
    for (let i = 0; i < P.count; i++) { const dx = sx[i] - g.x, dz = sz[i] - g.z; if (dx * dx + dz * dz < 3600) P.setY(i, wave(sx[i], sz[i], t)); }
    P.needsUpdate = true; this.seaTex.offset.set(t * 0.004, t * 0.006);
    // boat
    const b = this.boat; b.position.set(g.x, wave(g.x, g.z, t) * 0.6 - 0.02, g.z); b.rotation.order = 'YXZ'; b.rotation.y = g.h + PI;
    b.rotation.z = Math.sin(t * 0.9) * 0.03 + (g.ramT > 0 ? 0.06 : 0); b.rotation.x = Math.sin(t * 1.2 + 1) * 0.02 - Math.min(0.06, g.v * 0.008);
    for (const c of this.chins) { const s = 1 + Math.sin(t * 2.6 + c.userData.phase) * 0.018; c.getObjectByName('body')!.scale.set(s, s, 1); c.getObjectByName('tail')!.rotation.y = Math.sin(t * 1.3 + c.userData.phase) * 0.2; }
    // foes
    const live = new Set<number>(); let boss = false;
    for (const f of g.foes) { live.add(f.id); if (f.kind === 'bishan') boss = true; const m = this.foes.get(f.id) ?? this.foeModel(f); m.position.set(f.x, wave(f.x, f.z, t) * 0.8, f.z); m.rotation.y = f.h; m.rotation.z = Math.sin(t * 1.1 + f.id) * 0.05; }
    for (const [id, m] of this.foes) if (!live.has(id)) { this.scene.remove(m); this.foes.delete(id); }
    this.chief.visible = !boss && !g.bishanDown;
    // shots, crates, rings
    this.shots.forEach((m, i) => { const s = g.shots[i]; m.visible = !!s; if (s) { const life = s.mine ? s.ttl / 0.82 : s.ttl / 1.25; m.position.set(s.x, 0.45 + Math.sin(Math.max(0, Math.min(1, life)) * PI) * 0.7, s.z); m.material = s.mine ? m.userData.peanut : m.userData.clam; m.rotation.y = Math.atan2(s.vx, s.vz); } });
    this.crates.forEach((m, i) => { const c = g.crates[i]; m.visible = !!c; if (c) { m.position.set(c.x, wave(c.x, c.z, t) + 0.08, c.z); m.rotation.y = t * 0.4 + i; } });
    for (const r of this.rings) { r.t = Math.min(1, r.t + dt * 1.6); const s = (r.m.userData.size ?? 1) * (0.4 + r.t * 1.8); r.m.scale.setScalar(s); (r.m.material as T.MeshBasicMaterial).opacity = (1 - r.t) * 0.8; }
    this.beacon.visible = g.phase !== 'won';
    // camera: behind the boat, turning a little late; in the conversation it swings to face the kelong
    const cam = this.camera; let d = g.h - this.camYaw; while (d > PI) d -= PI * 2; while (d < -PI) d += PI * 2; this.camYaw += d * Math.min(1, dt * 3.5);
    if (g.phase === 'talk') { const kx = KELONG.x - g.x, kz = KELONG.z - g.z, l = Math.hypot(kx, kz) || 1; cam.position.set(g.x - kx / l * 2.6 + kz / l * 0.9, 1.25, g.z - kz / l * 2.6 - kx / l * 0.9); cam.lookAt(KELONG.x, 1.1, KELONG.z); }
    else { const [fx, fz] = forward(this.camYaw); cam.position.set(g.x - fx * 3.7, 2.35 + g.v * 0.03, g.z - fz * 3.7); cam.lookAt(g.x + fx * 6, 0.2, g.z + fz * 6); }
    this.sun.position.set(g.x + this.sunOff.x, this.sunOff.y, g.z + this.sunOff.z); this.sun.target.position.set(g.x, 0, g.z);
    this.renderer.render(this.scene, cam);
  }

  /** Screen position of a point in the world, in CSS pixels, and whether it is in front of the camera and on screen. */
  project(x: number, y: number, z: number): { x: number; y: number; on: boolean } {
    const v = this.v.set(x, y, z).project(this.camera), w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    return { x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h, on: v.z < 1 && Math.abs(v.x) < 0.96 && Math.abs(v.y) < 0.92 };
  }

  dispose() {
    this.scene.traverse(o => { const m = o as T.Mesh; if (m.geometry) m.geometry.dispose(); const mat = m.material as T.Material | T.Material[] | undefined; if (Array.isArray(mat)) mat.forEach(k => k.dispose()); else mat?.dispose(); });
    this.renderer.dispose();
  }
}
