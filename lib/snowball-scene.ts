// Snowball Siege: the drawing, in Three.js. Each slope has its own light, sky painting and dressing (golden hour on
// Sunny Slope, a cold blue morning and cracked ice on the pond, bright wind and rocks on the ridge, a dense wood, a
// pink lagoon that mirrors the sunset with flamingos wading, and the Summit at starry dusk with glowing lanterns). The
// snow forts are cubes meshed in chunks along the valley (only a touched chunk is rebuilt); every cube reads as a cube,
// with its own shade of snow, a dark edge round each face drawn by the material, and baked corner shading. The ground is
// cubes too, more faintly, with drifts of loose blocks in front. The characters and props are voxel models built from
// Codex front and side paintings (lib/voxel-model.ts). Juice: puff trails, a white flash and a powder burst on every hit,
// chunky debris that tumbles and bounces, dizzy stars, a little camera shake, and the flag toppling in a shower of
// confetti. Also the picking the page needs and model thumbnails for the menus. Rules in lib/snowball-game.ts.
import * as T from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { meshModel, meshVoxels, parseModel, type MeshArrays, type VoxelModel, type VoxelModelJson } from './voxel-model';
import { D, H, W, DUCK_H, type Char, type Ev, type Match, type Side, type SlopeId, type Species } from './snowball-game';

const ART = '/art/snowball/';
const MODEL_NAMES = ['dora', 'enzo', 'vizcacha', 'pudu', 'guanaco', 'fox', 'flamingo', 'bear', 'pine', 'rock', 'snowman', 'lantern', 'flag-red', 'flag-blue'] as const;
const CHUNK = 8;
/** how tall each character stands in the world, in cubes */
const TALL: Record<Species, number> = { dora: 5.2, enzo: 5.2, vizcacha: 5.4, pudu: 4.5, guanaco: 6.2, fox: 5.2, flamingo: 6.2, bear: 5.7 };

type RGB = [number, number, number];
/** a slope's look: its sky painting, light, fog, ground and snow tints */
type Look = { sky: string; skyTint?: RGB; bg: RGB; fog: RGB; fogNear: number; sun: RGB; sunI: number; sunAt: RGB; top: RGB; bottom: RGB; hemiI: number; ground: RGB; snow: RGB; exposure: number; night?: boolean };
const LOOKS: Record<SlopeId, Look> = {
  // golden hour: a low warm sun from the right gives peach highlights; the cool lilac fill colours the shadows
  sunny: { sky: 'sky', skyTint: [1, 0.86, 0.74], bg: [1, 0.8, 0.7], fog: [1, 0.84, 0.76], fogNear: 60, sun: [1, 0.74, 0.48], sunI: 3.3, sunAt: [30, 15, 30], top: [0.74, 0.72, 1], bottom: [0.6, 0.55, 0.8], hemiI: 1.1, ground: [1, 0.93, 0.87], snow: [1, 0.97, 0.94], exposure: 1.05 },
  pond: { sky: 'sky-pond', bg: [0.8, 0.9, 1], fog: [0.82, 0.9, 1], fogNear: 55, sun: [0.95, 0.97, 1], sunI: 2.4, sunAt: [-20, 30, 24], top: [0.75, 0.86, 1], bottom: [0.55, 0.65, 0.85], hemiI: 1.15, ground: [0.9, 0.95, 1], snow: [0.94, 0.98, 1], exposure: 1.0 },
  ridge: { sky: 'sky-ridge', bg: [0.6, 0.78, 1], fog: [0.82, 0.88, 0.98], fogNear: 60, sun: [1, 0.97, 0.9], sunI: 3.0, sunAt: [10, 40, 26], top: [0.8, 0.88, 1], bottom: [0.6, 0.6, 0.66], hemiI: 0.95, ground: [0.96, 0.96, 0.98], snow: [1, 1, 1], exposure: 1.0 },
  pines: { sky: 'sky-pines', bg: [0.85, 0.88, 0.75], fog: [0.84, 0.88, 0.8], fogNear: 45, sun: [1, 0.85, 0.6], sunI: 2.6, sunAt: [-30, 24, 16], top: [0.82, 0.92, 0.82], bottom: [0.5, 0.6, 0.5], hemiI: 1.0, ground: [0.95, 0.97, 0.92], snow: [0.97, 1, 0.97], exposure: 1.0 },
  lagoon: { sky: 'sky-lagoon', bg: [1, 0.75, 0.75], fog: [1, 0.82, 0.84], fogNear: 55, sun: [1, 0.68, 0.58], sunI: 2.6, sunAt: [-30, 16, 10], top: [0.96, 0.76, 0.88], bottom: [0.72, 0.56, 0.7], hemiI: 1.05, ground: [1, 0.9, 0.9], snow: [1, 0.95, 0.97], exposure: 1.05 },
  summit: { sky: 'sky-summit', bg: [0.2, 0.2, 0.42], fog: [0.3, 0.3, 0.55], fogNear: 50, sun: [0.65, 0.72, 1], sunI: 1.5, sunAt: [-24, 32, 20], top: [0.45, 0.5, 0.9], bottom: [0.28, 0.25, 0.45], hemiI: 1.2, ground: [0.78, 0.82, 1], snow: [0.84, 0.88, 1], exposure: 1.1, night: true },
  versus: { sky: 'sky', bg: [0.93, 0.8, 0.82], fog: [0.92, 0.84, 0.9], fogNear: 60, sun: [1, 0.8, 0.58], sunI: 2.8, sunAt: [30, 26, 22], top: [0.78, 0.8, 1], bottom: [0.62, 0.6, 0.78], hemiI: 1.0, ground: [1, 0.93, 0.92], snow: [1, 0.98, 1], exposure: 1.05 },
};
const lin = (c: RGB) => new T.Color().setRGB(c[0], c[1], c[2], T.SRGBColorSpace);

function geometry(a: MeshArrays) {
  const g = new T.BufferGeometry();
  const col = new Float32Array(a.colors.length);
  for (let i = 0; i < col.length; i++) col[i] = Math.pow(a.colors[i], 2.2);
  g.setAttribute('position', new T.BufferAttribute(a.positions, 3));
  g.setAttribute('normal', new T.BufferAttribute(a.normals, 3));
  g.setAttribute('color', new T.BufferAttribute(col, 3));
  g.setAttribute('uv', new T.BufferAttribute(a.uvs, 2));
  g.setIndex(new T.BufferAttribute(a.indices, 1));
  g.computeBoundingSphere();
  return g;
}
/** a little seeded noise per cube, so the snow isn't one flat white */
const noise = (x: number, y: number, z: number) => { const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453; return s - Math.floor(s); };

/**
 * A Lambert material that draws a dark edge round every cube face (from the face's 0–1 uvs), or, for the ground, round
 * every cell of a world grid with a faint shade per cell, so the voxels always read as cubes.
 */
function cubeMat(o: { edge: number; width: number; world?: boolean; colour?: T.Color; vertexColors?: boolean }) {
  const m = new T.MeshLambertMaterial({ color: o.colour ?? 0xffffff, vertexColors: !!o.vertexColors });
  m.defines = { USE_UV: '' };
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uEdge = { value: o.edge }; sh.uniforms.uWidth = { value: o.width };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vSbWorld;')
      .replace('#include <project_vertex>', '#include <project_vertex>\n vec4 sbW = vec4(transformed, 1.0);\n#ifdef USE_INSTANCING\n sbW = instanceMatrix * sbW;\n#endif\n vSbWorld = (modelMatrix * sbW).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vSbWorld;\nuniform float uEdge;\nuniform float uWidth;')
      .replace('#include <color_fragment>', `#include <color_fragment>
  ${o.world ? `vec2 sbQ = fract(vSbWorld.xz); vec2 sbC = floor(vSbWorld.xz);
  diffuseColor.rgb *= 0.955 + 0.06 * fract(sin(dot(sbC, vec2(12.9898, 78.233))) * 43758.5453);` : 'vec2 sbQ = vUv;'}
  float sbE = min(min(sbQ.x, 1.0 - sbQ.x), min(sbQ.y, 1.0 - sbQ.y));
  diffuseColor.rgb *= 1.0 - uEdge * (1.0 - smoothstep(0.0, uWidth, sbE));
  diffuseColor.rgb *= 1.0 + 0.06 * smoothstep(uWidth, uWidth * 2.5, sbE);`);
  };
  m.customProgramCacheKey = () => `sb-cube-${o.world ? 'w' : 'u'}-${o.edge}-${o.width}`;
  return m;
}

/** a canvas picture of cracked ice, for each crack level */
function iceTexture(level: number) {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d')!;
  g.fillStyle = level >= 4 ? '#1d4f7c' : '#a9d8ff'; g.fillRect(0, 0, 64, 64);
  if (level < 4) { g.fillStyle = 'rgba(255,255,255,.45)'; g.fillRect(4, 6, 20, 3); g.fillRect(36, 40, 16, 2); }
  g.strokeStyle = level >= 4 ? '#0b2a48' : '#ffffff'; g.lineWidth = level >= 4 ? 4 : 2;
  const rays = level >= 4 ? 0 : level === 3 ? 7 : level === 2 ? 4 : 0;
  for (let i = 0; i < rays; i++) { const a = i / rays * Math.PI * 2 + 0.4; g.beginPath(); g.moveTo(32, 32); g.lineTo(32 + Math.cos(a) * 18, 32 + Math.sin(a) * 18); g.lineTo(32 + Math.cos(a + 0.3) * 32, 32 + Math.sin(a + 0.3) * 32); g.stroke(); }
  if (level >= 4) { g.fillStyle = '#082036'; g.beginPath(); g.ellipse(32, 32, 24, 22, 0, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#e8f6ff'; g.lineWidth = 3; g.stroke(); }
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.magFilter = T.NearestFilter; return t;
}

type Rig = { root: T.Group; body: T.Mesh; mat: T.MeshLambertMaterial; species: Species; stars: T.Group; marker: T.Mesh; base: number; ox: number; flash: number; lean: number; sink: number; side: Side };
type Debris = { m: T.Mesh; vx: number; vy: number; vz: number; life: number; spin: T.Vector3; size: number };
type Puff = { m: T.Mesh; vx: number; vy: number; vz: number; life: number; max: number; grow: number; drag?: number; flash?: boolean };

export class SnowballScene {
  renderer: T.WebGLRenderer; scene = new T.Scene(); camera: T.PerspectiveCamera;
  models = new Map<string, VoxelModel>(); geos = new Map<string, T.BufferGeometry>();
  skies = new Map<string, T.Texture>();
  fortMat = cubeMat({ edge: 0.42, width: 0.07, vertexColors: true });
  charMat = cubeMat({ edge: 0.1, width: 0.12, vertexColors: true });
  propMat = cubeMat({ edge: 0.16, width: 0.1, vertexColors: true });
  debrisMat = cubeMat({ edge: 0.45, width: 0.08, colour: new T.Color().setRGB(0.93, 0.95, 1, T.SRGBColorSpace) });
  driftMat = cubeMat({ edge: 0.3, width: 0.06 });
  groundMat = cubeMat({ edge: 0.16, width: 0.035, world: true, colour: new T.Color(1, 1, 1) });
  ballMat = new T.MeshLambertMaterial({ color: 0xffffff, emissive: 0x404858 });
  match: Match | null = null;
  chunks: (T.Mesh | null)[] = []; dirty = new Set<number>();
  world = new T.Group(); deco = new T.Group();
  rigs: Rig[] = []; balls = new Map<object, { m: T.Mesh; trailT: number }>();
  debris: Debris[] = []; puffs: Puff[] = [];
  flags: T.Group[] = []; flagFall = [0, 0];
  iceMeshes = new Map<number, T.Mesh>(); iceMats: T.MeshLambertMaterial[] = []; pineRigs: T.Group[] = []; sock: T.Group | null = null;
  gusts: T.InstancedMesh | null = null; gustPos: number[] = [];
  preview: T.InstancedMesh; ghost: T.Mesh; pick: T.LineSegments;
  cubeGeo = new T.BoxGeometry(1, 1, 1);
  puffMat = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false });
  flashMat = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1, depthWrite: false, blending: T.AdditiveBlending });
  shake = 0; t = 0; upright = false; loaded = false; reduced = false;
  sun: T.DirectionalLight; hemi: T.HemisphereLight; sky: T.Mesh; ground: T.Mesh;
  ray = new T.Raycaster();
  private phone: boolean;

  constructor(canvas: HTMLCanvasElement) {
    const phone = this.phone = matchMedia('(pointer:coarse)').matches || Math.min(innerWidth, innerHeight) < 560;
    this.renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, phone ? 1.5 : 2));
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.toneMapping = T.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = T.PCFShadowMap;
    this.camera = new T.PerspectiveCamera(50, 16 / 9, 0.5, 400);
    const s = this.scene;
    s.fog = new T.Fog(0xffffff, 60, 150);
    this.hemi = new T.HemisphereLight(0xffffff, 0xffffff, 1); s.add(this.hemi);
    const sun = new T.DirectionalLight(0xffffff, 2.5);
    sun.target.position.set(W / 2, 0, D / 2);
    sun.castShadow = true; sun.shadow.mapSize.set(phone ? 1024 : 2048, phone ? 1024 : 2048);
    const sc = sun.shadow.camera; sc.left = -34; sc.right = 34; sc.top = 24; sc.bottom = -24; sc.near = 1; sc.far = 140;
    sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04;
    s.add(sun, sun.target); this.sun = sun;
    s.add(this.world, this.deco);
    // the sky painting, far behind
    this.sky = new T.Mesh(new T.PlaneGeometry(440, 293), new T.MeshBasicMaterial({ color: 0xffffff, fog: false, depthWrite: false }));
    this.sky.position.set(W / 2, 60, -120); this.sky.renderOrder = -1; s.add(this.sky);
    // the ground: a wide field of faint cubes
    this.ground = new T.Mesh(new T.PlaneGeometry(260, 160), this.groundMat); this.ground.rotation.x = -Math.PI / 2; this.ground.position.set(W / 2, 0, D / 2 - 40); this.ground.receiveShadow = true; s.add(this.ground);
    // the arc preview: little cubes along the first third of a throw; a ghost cube for patching; a box round a pickable cube
    this.preview = new T.InstancedMesh(new T.BoxGeometry(0.24, 0.24, 0.24), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95 }), 40);
    this.preview.count = 0; this.preview.frustumCulled = false; s.add(this.preview);
    this.ghost = new T.Mesh(this.cubeGeo, new T.MeshBasicMaterial({ color: 0xbfe4ff, transparent: true, opacity: 0.45, depthWrite: false })); this.ghost.visible = false; s.add(this.ghost);
    this.pick = new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(1.04, 1.04, 1.04)), new T.LineBasicMaterial({ color: 0xffd23a })); this.pick.visible = false; s.add(this.pick);
  }

  async load() {
    const loader = new T.TextureLoader();
    const skies = ['sky', 'sky-pond', 'sky-ridge', 'sky-pines', 'sky-lagoon', 'sky-summit'].map((n) => loader.loadAsync(ART + n + '.webp').then((tx) => { tx.colorSpace = T.SRGBColorSpace; this.skies.set(n, tx); }).catch(() => {}));
    await Promise.all([...skies, ...MODEL_NAMES.map(async (n) => {
      try { const j = (await (await fetch(ART + n + '.json')).json()) as VoxelModelJson; this.models.set(n, parseModel(j)); } catch {}
    })]);
    this.iceMats = [0, 1, 2, 3, 4].map((l) => new T.MeshLambertMaterial({ map: iceTexture(l), transparent: true, opacity: l >= 4 ? 0.97 : 0.88 }));
    this.loaded = true;
    if (this.match) this.setMatch(this.match);
  }

  /** a model's geometry, scaled so it stands `tall` cubes high */
  geo(name: string, tall: number) {
    const k = `${name}@${tall}`; let g = this.geos.get(k);
    if (!g) { const m = this.models.get(name); if (!m) return null; g = geometry(meshModel(m, tall / m.size[1])); this.geos.set(k, g); }
    return g;
  }
  mesh(name: string, tall: number, mat: T.Material = this.propMat) { const g = this.geo(name, tall); if (!g) return null; const m = new T.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true; return m; }

  setUpright(on: boolean) { this.upright = on; }
  resize(w: number, h: number) { this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }

  // ---------------------------------------------------------------- a new match
  setMatch(m: Match) {
    this.match = m;
    for (const c of this.chunks) if (c) { this.world.remove(c); c.geometry.dispose(); }
    this.chunks = []; this.rigs = []; this.flags = []; this.flagFall = [0, 0]; this.pineRigs = []; this.sock = null; this.gusts = null;
    for (const o of this.deco.children.slice()) { this.deco.remove(o); o.traverse((x) => { if (x instanceof Reflector) x.dispose(); }); }
    for (const b of this.balls.values()) this.scene.remove(b.m); this.balls.clear();
    for (const d of this.debris) this.scene.remove(d.m); this.debris = [];
    for (const p of this.puffs) this.scene.remove(p.m); this.puffs = [];
    this.iceMeshes.clear();
    if (!this.loaded) return;
    this.light(LOOKS[m.slope.id]);
    for (let i = 0; i * CHUNK < W; i++) { this.chunks.push(null); this.dirty.add(i); }
    this.rebuild();
    for (const c of m.chars) this.rigs.push(this.rig(c));
    for (const s of [0, 1] as Side[]) {
      const f = m.forts[s].flag, g = new T.Group(), fm = this.mesh(s === 0 ? 'flag-red' : 'flag-blue', 2.6);
      if (fm) { fm.position.x = s === 0 ? 0.35 : -0.35; if (s === 1) fm.rotation.y = Math.PI; g.add(fm); }
      g.position.set(f.x + 0.5, f.top, f.z + 0.5); this.deco.add(g); this.flags.push(g);
    }
    this.dress(m);
  }

  private light(l: Look) {
    const s = this.scene;
    s.background = lin(l.bg); (s.fog as T.Fog).color = lin(l.fog); (s.fog as T.Fog).near = l.fogNear; (s.fog as T.Fog).far = l.fogNear + 110;
    this.hemi.color = lin(l.top); this.hemi.groundColor = lin(l.bottom); this.hemi.intensity = l.hemiI;
    this.sun.color = lin(l.sun); this.sun.intensity = l.sunI; this.sun.position.set(W / 2 + l.sunAt[0], l.sunAt[1], D / 2 + l.sunAt[2]);
    this.renderer.toneMappingExposure = l.exposure;
    (this.groundMat.color as T.Color).copy(lin(l.ground)); (this.debrisMat.color as T.Color).copy(lin(l.snow));
    const sky = this.sky.material as T.MeshBasicMaterial; sky.color = l.skyTint ? lin(l.skyTint) : new T.Color(0xffffff); sky.map = this.skies.get(l.sky) ?? this.skies.get('sky') ?? null; sky.needsUpdate = true;
  }

  /** each slope's dressing: what stands behind the forts, the drifts and features in front, the slope's own props */
  private dress(m: Match) {
    const sl = m.slope, id = sl.id, look = LOOKS[id];
    const put = (name: string, tall: number, x: number, z: number, ry = 0) => { const o = this.mesh(name, tall); if (o) { o.position.set(x, 0, z); o.rotation.y = ry; this.deco.add(o); } return o; };
    const r = (i: number, k: number) => noise(i, k, id.length);
    // behind: a row of pines (a whole wood in Pine Wood), rocks on the ridge and the summit
    const trees = id === 'pines' ? 46 : id === 'ridge' || id === 'summit' || id === 'lagoon' ? 5 : 12;
    for (let i = 0; i < trees; i++) {
      const x = -10 + r(i, 1) * (W + 20), z = -6 - r(i, 2) * (id === 'pines' ? 24 : 16);
      if (id === 'lagoon' && x > 10 && x < W - 10) continue;
      put('pine', 6 + r(i, 3) * (id === 'pines' ? 6 : 3), x, z, r(i, 4) * 6);
    }
    if (id === 'ridge' || id === 'summit') for (let i = 0; i < 14; i++) put('rock', 1.4 + r(i, 5) * 3, -8 + r(i, 6) * (W + 16), -2 - r(i, 7) * 16, r(i, 8) * 6);
    // in front: drifts of loose snow blocks, low near the forts and taller towards the camera, with a clear middle
    // where the slope's feature goes (ice, the lagoon, rocks, a snowman)
    const cells: { x: number; y: number; z: number; c: T.Color }[] = [];
    const rockSlope = id === 'ridge' || id === 'summit';
    for (let x = -12; x < W + 12; x++) for (let z = D + 1; z < D + 13; z++) {
      const mid = Math.abs(x + 0.5 - W / 2) < 9 - (z - D) * 0.25;
      if (mid && (id === 'pond' || id === 'lagoon')) continue;
      const far = (z - D) / 12, n = noise(x * 0.37, 1, z * 0.41);
      let h = Math.floor(n * 1.5 + far * 1.6 + (mid ? -1.4 : 0) + (Math.abs(x - W / 2) > W / 2 + 2 ? 1 : 0));
      if (h <= 0) continue; h = Math.min(h, 3);
      for (let y = 0; y < h; y++) {
        const rock = rockSlope && noise(x, y, z) < 0.22, v = 0.84 + noise(x, y + 3, z) * 0.07;
        cells.push({ x, y, z, c: rock ? new T.Color().setRGB(0.42 * v, 0.42 * v, 0.47 * v, T.SRGBColorSpace) : new T.Color().setRGB(look.snow[0] * v, look.snow[1] * v, look.snow[2] * v, T.SRGBColorSpace) });
      }
    }
    const drifts = new T.InstancedMesh(this.cubeGeo, this.driftMat, cells.length); const mx = new T.Matrix4();
    cells.forEach((c, i) => { mx.makeTranslation(c.x + 0.5, c.y + 0.5, c.z + 0.5); drifts.setMatrixAt(i, mx); drifts.setColorAt(i, c.c); });
    drifts.castShadow = drifts.receiveShadow = true; this.deco.add(drifts);
    // the near corners: a big pine each side, lanterns by the forts
    put('pine', 10, -6, D + 8, 0.4); put('pine', 11, W + 6, D + 9, 1.3);
    for (const x of [1.5, W - 1.5]) {
      put('lantern', 2.8, x, D + 0.6);
      if (look.night) { const pl = new T.PointLight(0xffb35a, 18, 14, 1.6); pl.position.set(x, 2.4, D + 0.6); this.deco.add(pl); }
    }
    // each slope's feature
    if (id === 'sunny' || id === 'versus') { put('snowman', 3.2, W / 2 - 1, D + 5, 0.3); for (let i = 0; i < 7; i++) { const b = new T.Mesh(this.cubeGeo, this.debrisMat); b.scale.setScalar(0.5); b.position.set(W / 2 + 2 + (i % 3) * 0.55, 0.25 + Math.floor(i / 3) * 0.48, D + 4.5 + (i % 2) * 0.5); b.castShadow = true; this.deco.add(b); } }
    if (id === 'pond') {
      const sheet = new T.Mesh(new T.PlaneGeometry(22, 14), new T.MeshLambertMaterial({ map: (() => { const t = iceTexture(3); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(6, 4); return t; })(), transparent: true, opacity: 0.92 }));
      sheet.rotation.x = -Math.PI / 2; sheet.position.set(W / 2, 0.02, D + 6); sheet.receiveShadow = true; this.deco.add(sheet);
      put('rock', 1.2, W / 2 + 7, D + 3, 1);
    }
    if (id === 'ridge') { put('rock', 2.6, W / 2 - 3, D + 4, 0.6); put('rock', 1.6, W / 2 + 4, D + 6, 2); put('rock', 3.4, W / 2 + 1, -4, 1.1); }
    if (id === 'summit') { for (const x of [W / 2 - 7, W / 2 + 7]) { put('lantern', 2.6, x, D + 2); const pl = new T.PointLight(0xffb35a, 14, 12, 1.6); pl.position.set(x, 2.2, D + 2); this.deco.add(pl); } }
    if (sl.pines) for (const p of m.pines) { const g = new T.Group(); const o = this.mesh('pine', 7); if (o) g.add(o); g.position.set(p.x, 0, p.z); this.deco.add(g); this.pineRigs.push(g); }
    if (sl.lagoon) {
      // a mirror of pink water between the forts and out to the front, with flamingos wading far off
      const geo = new T.PlaneGeometry(W - 30, 40);
      const water = new Reflector(geo, { color: new T.Color().setRGB(0.95, 0.62, 0.74, T.SRGBColorSpace), textureWidth: Math.round(innerWidth * 0.5), textureHeight: Math.round(innerHeight * 0.5), clipBias: 0.003 });
      water.rotation.x = -Math.PI / 2; water.position.set(W / 2, 0.03, D / 2 - 6); this.deco.add(water);
      for (const [x, z, ry] of [[W / 2 - 2, -1, 0.6], [W / 2 + 2.5, -4, -0.5], [W / 2 + 0.5, -8, 0.2]] as const) { const f = put('flamingo', 4.4, x, z, ry); if (f) f.position.y = -0.5; }
    }
    if (sl.wind) {
      const g = new T.Group(), pole = new T.Mesh(new T.BoxGeometry(0.2, 5, 0.2), new T.MeshLambertMaterial({ color: 0x6b4a2e })); pole.position.y = 2.5; g.add(pole);
      const sock = new T.Group(); sock.name = 'sock'; sock.position.y = 4.7;
      for (let i = 0; i < 4; i++) { const ring = new T.Mesh(new T.BoxGeometry(0.5, 0.62 - i * 0.08, 0.62 - i * 0.08), new T.MeshLambertMaterial({ color: i % 2 ? 0xffffff : 0xff5a2d })); ring.position.x = 0.35 + i * 0.5; sock.add(ring); }
      g.add(sock); g.position.set(W / 2, 0, D + 2); this.deco.add(g); this.sock = g;
      // blowing snow
      const n = this.phone ? 50 : 110; this.gusts = new T.InstancedMesh(new T.BoxGeometry(0.5, 0.06, 0.06), this.puffMat, n); this.gusts.frustumCulled = false; this.gustPos = [];
      for (let i = 0; i < n; i++) this.gustPos.push(Math.random() * (W + 30) - 15, 0.5 + Math.random() * 9, -10 + Math.random() * 30);
      this.deco.add(this.gusts);
    }
    if (sl.ice) for (let x = 0; x < W; x++) for (let z = 0; z < D; z++) {
      const v = m.ice[x * D + z]; if (!v) continue;
      const pl = new T.Mesh(new T.BoxGeometry(1, 0.06, 1), this.iceMats[1]); pl.position.set(x + 0.5, 0.03, z + 0.5); pl.receiveShadow = true; this.deco.add(pl); this.iceMeshes.set(x * D + z, pl);
    }
  }

  private rig(c: Char): Rig {
    const root = new T.Group(), tall = TALL[c.species], mat = cubeMat({ edge: 0.1, width: 0.12, vertexColors: true });
    mat.emissive = new T.Color(0, 0, 0);
    const body = this.mesh(c.species, tall, mat) ?? new T.Mesh(new T.BoxGeometry(1, tall, 1), mat);
    body.rotation.order = 'YXZ';   // turn first, then lean forward or sideways from where it faces
    root.add(body);
    const stars = new T.Group();
    for (let i = 0; i < 4; i++) { const st = new T.Mesh(new T.BoxGeometry(0.28, 0.28, 0.28), new T.MeshBasicMaterial({ color: i % 2 ? 0xffffff : 0xffe066 })); stars.add(st); }
    stars.position.y = tall + 0.3; stars.visible = false; root.add(stars);
    const marker = new T.Mesh(new T.ConeGeometry(0.3, 0.55, 4), new T.MeshBasicMaterial({ color: c.side === 0 ? 0xffd23a : 0x7fc8ff })); marker.rotation.x = Math.PI; marker.position.y = tall + 0.75; root.add(marker);
    this.deco.add(root);
    return { root, body, mat, species: c.species, stars, marker, base: tall, ox: 0, flash: 0, lean: 0, sink: 0, side: c.side };
  }

  /** remesh the chunks that changed */
  private rebuild() {
    const m = this.match; if (!m) return;
    const tint = LOOKS[m.slope.id].snow;
    const solid = (x: number, y: number, z: number) => y < 0 || m.at(x, y, z) > 0;
    const colour = (x: number, y: number, z: number): [number, number, number] | null => {
      const v = m.at(x, y, z); if (!v) return null;
      // every cube its own shade: a few per cent in value, a touch bluer or more lilac
      const n = (noise(x, y, z) - 0.5) * 0.1, h = (noise(z, x, y) - 0.5) * 0.05;
      if (v === 3) return [0.5 + n, 0.5 + n, 0.56 + n];
      const b = v === 1 ? [0.88, 0.87, 0.93] : [0.84, 0.87, 0.94];
      return [(b[0] + n + h) * tint[0], (b[1] + n) * tint[1], (b[2] + n - h) * tint[2]];
    };
    for (const i of this.dirty) {
      const old = this.chunks[i]; if (old) { this.world.remove(old); old.geometry.dispose(); }
      const a = meshVoxels([i * CHUNK, Math.min(W, (i + 1) * CHUNK), 0, H, 0, D], solid, colour);
      if (!a.indices.length) { this.chunks[i] = null; continue; }
      const mesh = new T.Mesh(geometry(a), this.fortMat); mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData.chunk = i;
      this.world.add(mesh); this.chunks[i] = mesh;
    }
    this.dirty.clear();
  }
  private touch(x: number) { const i = Math.floor(x / CHUNK); this.dirty.add(i); if (x % CHUNK === 0 && i > 0) this.dirty.add(i - 1); if (x % CHUNK === CHUNK - 1) this.dirty.add(i + 1); }

  // ---------------------------------------------------------------- events from a tick
  feed(evs: Ev[]) {
    const m = this.match; if (!m) return;
    for (const e of evs) {
      if (e.k === 'cube') {
        this.touch(e.x);
        // the cube itself tumbles out, with a couple of chunks broken off it
        this.chunk(e.x + 0.5, e.y + 0.5, e.z + 0.5, e.vx, e.vy, e.vz, 0.92);
        for (let i = 0; i < 2; i++) this.chunk(e.x + 0.5, e.y + 0.5, e.z + 0.5, e.vx * (0.6 + Math.random()), e.vy + Math.random() * 3, (Math.random() - 0.5) * 5, 0.35 + Math.random() * 0.2);
        this.burst(e.x + 0.5, e.y + 0.5, e.z + 0.5, 5, 1.4);
      } else if (e.k === 'hit') {
        this.flash(e.x + 0.5, e.y + 0.5, e.z + 0.5, e.hard ? 2.6 : 1.7);
        this.burst(e.x + 0.5, e.y + 0.7, e.z + 0.5, e.hard ? 22 : 12, e.hard ? 3 : 2);
        this.shake = Math.max(this.shake, e.hard ? 0.55 : 0.25);
      }
      else if (e.k === 'patch') { this.touch(e.x); this.burst(e.x + 0.5, e.y + 1, e.z + 0.5, 6, 1); }
      else if (e.k === 'land') { this.burst(e.x, 0.2, e.z, e.what === 'water' ? 12 : 9, 1.6, e.what === 'water' ? 0xffc2d4 : e.what === 'ice' ? 0xd8f0ff : 0xffffff); }
      else if (e.k === 'crack') { const pl = this.iceMeshes.get(e.x * D + e.z); if (pl) pl.material = this.iceMats[Math.min(4, e.level)]; }
      else if (e.k === 'stun') {
        const c = m.chars.find((x) => x.side === e.side && x.i === e.i), r = c && this.rigs[m.chars.indexOf(c)];
        if (c) { this.burst(c.x, e.how === 'splash' ? 0.3 : 2.6, c.z, 16, 2.2, e.how === 'splash' ? 0x9fd2ff : 0xffffff); if (e.how !== 'splash') this.flash(c.x, 2.4, c.z, 2.2); }
        if (r) r.flash = 1;
        this.shake = Math.max(this.shake, 0.35);
      }
      else if (e.k === 'pine') { const p = m.pines[e.i]; if (p) { this.burst(p.x, 4.5, p.z, 30, 2.8); const g = this.pineRigs[e.i]; if (g) g.userData.wob = 1; } }
      else if (e.k === 'flag' && e.fell) {
        this.flagFall[e.side] = 0.0001; this.shake = 0.9;
        const f = m.forts[e.side].flag;
        for (const col of [0xff4f5a, 0x4f9dff, 0xffd23a, 0xffffff]) this.burst(f.x + 0.5, f.top + 1, f.z + 0.5, 12, 4, col, true);
      }
    }
    if (this.dirty.size) this.rebuild();
  }
  /** a scoop starting: a puff where the hands go in */
  poke(x: number, y: number, z: number) { this.burst(x + 0.5, y + 1, z + 0.5, 6, 1.2); }

  private chunk(x: number, y: number, z: number, vx: number, vy: number, vz: number, size: number) {
    const d = new T.Mesh(this.cubeGeo, this.debrisMat); d.castShadow = true; d.position.set(x, y, z); d.scale.setScalar(size);
    this.scene.add(d); this.debris.push({ m: d, vx, vy, vz, life: 2.2, spin: new T.Vector3((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 10), size });
  }
  private flash(x: number, y: number, z: number, size: number) {
    const f = new T.Mesh(this.cubeGeo, this.flashMat); f.position.set(x, y, z); f.scale.setScalar(size * 0.4); this.scene.add(f);
    this.puffs.push({ m: f, vx: 0, vy: 0, vz: 0, life: 0.1, max: 0.1, grow: size, flash: true });
  }
  private mats = new Map<number, T.MeshBasicMaterial>();
  private burst(x: number, y: number, z: number, n: number, sp: number, colour = 0xffffff, confetti = false) {
    if (this.reduced) n = Math.ceil(n / 2);
    let mat = colour === 0xffffff ? this.puffMat : this.mats.get(colour);
    if (!mat) { mat = new T.MeshBasicMaterial({ color: colour, transparent: true, opacity: 0.9, depthWrite: false }); this.mats.set(colour, mat); }
    for (let i = 0; i < n; i++) {
      const p = new T.Mesh(this.cubeGeo, mat); const s = confetti ? 0.18 : 0.14 + Math.random() * 0.24; p.scale.setScalar(s); p.position.set(x, y, z);
      const a = Math.random() * Math.PI * 2, u = Math.random();
      this.scene.add(p); this.puffs.push({ m: p, vx: Math.cos(a) * sp * u, vy: (0.5 + Math.random()) * sp, vz: Math.sin(a) * sp * u, life: (confetti ? 1.2 : 0.5) + Math.random() * 0.4, max: confetti ? 1.6 : 0.9, grow: s, drag: confetti ? 2.5 : 0 });
    }
  }

  // ---------------------------------------------------------------- the frame
  frame(dt: number, ui: { preview?: { x: number; y: number; z: number }[]; hard?: boolean; pick?: { x: number; y: number; z: number; patch: boolean } | null }) {
    const m = this.match; this.t += dt;
    if (!m || !this.loaded) { this.renderer.render(this.scene, this.camera); return; }
    // camera: low and close, both forts filling the frame, the sky a band along the top; narrower screens step back so
    // both towers stay in; an upright phone looks closer at ours
    const sway = this.reduced ? 0 : Math.sin(this.t * 0.25) * 0.5;
    const sh = this.shake > 0.01 && !this.reduced ? this.shake : 0; this.shake *= Math.pow(0.015, dt);
    if (this.upright) { this.camera.fov = 52; this.camera.position.set(11 + sway, 9, D + 16); this.camera.lookAt(12, 1.5, D / 2 - 2); }
    else {
      const k = Math.max(1, 1.85 / this.camera.aspect);
      this.camera.fov = 50; this.camera.position.set(W / 2 + sway, 7.6 + 2.5 * (k - 1), D / 2 + 23 * k); this.camera.lookAt(W / 2, 1.4, D / 2 - 4);
    }
    if (sh) { this.camera.position.x += (Math.random() - 0.5) * sh; this.camera.position.y += (Math.random() - 0.5) * sh; }
    this.camera.updateProjectionMatrix();
    // characters: three-quarter towards the camera, turning to the other fort to throw
    m.chars.forEach((c, k) => {
      const r = this.rigs[k]; if (!r) return;
      const active = m.activeChar(c.side) === c, dir = c.side === 0 ? 1 : -1;
      // the one waiting ducks a couple of steps back towards the tower, so the two never stand in a line (it can't be
      // hit while it waits, so where it's drawn doesn't change the game)
      const back = !active && m.chars_(c.side).length > 1 ? 2.4 : 0;
      r.ox += (back - r.ox) * Math.min(1, dt * 6);
      r.root.position.set(c.x - dir * r.ox, 0, c.z);
      const standing = m.height(c) > DUCK_H, working = c.doing === 'dig' || c.doing === 'floor' || c.doing === 'patch';
      // ducked, they crouch down behind the wall (sinking, not squashing, so the painting keeps its shape) until only
      // the ears and eyes peek over
      const sink = standing ? 0 : working ? 0.12 : 0.2;
      r.sink += (sink - r.sink) * Math.min(1, dt * 16);
      // face the camera (the paintings read best from the front), leaning a touch towards the other fort; a throw
      // twists briefly towards the target
      const cam = this.camera.position, face = Math.atan2(cam.x - r.root.position.x, cam.z - r.root.position.z);
      const yaw = face + (c.stand > 0 ? dir * 0.5 : dir * 0.15);
      r.body.rotation.y += (yaw - r.body.rotation.y) * Math.min(1, dt * 12);
      // lean back while winding up (more for a hard snowball), snap forward on the throw, bow to scoop
      const lean = c.aiming ? -0.14 - Math.min(0.12, c.aimTicks / 500) : c.stand > 18 ? 0.3 : working ? 0.16 : 0;
      r.lean += (lean - r.lean) * Math.min(1, dt * (c.stand > 18 ? 30 : 10));
      // facing the camera, leaning means tipping sideways, towards the other fort (or away from it, winding up)
      r.body.rotation.x = 0;
      r.body.rotation.z = -dir * r.lean;
      r.body.position.y = -r.sink * r.base + (working ? Math.abs(Math.sin(this.t * 16)) * 0.12 : 0);
      r.stars.visible = c.stun > 0; r.stars.position.y = r.base * (1 - r.sink) + 0.4;
      if (c.stun > 0) { r.body.rotation.z = Math.sin(this.t * 9) * 0.18; r.stars.children.forEach((s, i) => { const a = this.t * 6 + i * Math.PI / 2; s.position.set(Math.cos(a) * 0.8, Math.sin(a * 2) * 0.1, Math.sin(a) * 0.8); s.rotation.y = a; }); }
      if (c.splash) r.body.position.y = -1.6;
      r.flash = Math.max(0, r.flash - dt * 5); r.mat.emissive.setScalar(r.flash * 0.9);
      r.marker.visible = active && m.humans[c.side] && m.chars_(c.side).length > 1;
      r.marker.position.y = r.base * (1 - r.sink) + 0.85 + Math.sin(this.t * 4) * 0.1;
    });
    // snowballs
    const live = new Set<object>();
    for (const b of m.balls) {
      live.add(b); let v = this.balls.get(b);
      if (!v) { const ms = new T.Mesh(new T.SphereGeometry(b.hard ? 0.36 : 0.27, 8, 6), this.ballMat); ms.castShadow = true; this.scene.add(ms); v = { m: ms, trailT: 0 }; this.balls.set(b, v); }
      v.m.position.set(b.x, b.y, b.z); v.m.rotation.x += dt * 8; v.m.rotation.z += dt * 6;
      v.trailT -= dt; if (v.trailT <= 0 && !this.reduced) { v.trailT = 0.03; const p = new T.Mesh(this.cubeGeo, this.puffMat); p.scale.setScalar(0.2); p.position.copy(v.m.position); this.scene.add(p); this.puffs.push({ m: p, vx: 0, vy: 0.4, vz: 0, life: 0.4, max: 0.4, grow: 0.2 }); }
    }
    for (const [b, v] of this.balls) if (!live.has(b)) { this.scene.remove(v.m); v.m.geometry.dispose(); this.balls.delete(b); }
    // debris: tumbles, bounces and settles, then shrinks away
    for (const d of this.debris.slice()) {
      d.life -= dt; d.vy -= 24 * dt; d.m.position.x += d.vx * dt; d.m.position.y += d.vy * dt; d.m.position.z += d.vz * dt;
      const floor = d.size / 2;
      if (d.m.position.y < floor) { d.m.position.y = floor; if (Math.abs(d.vy) > 1.5) { d.vy *= -0.42; d.spin.multiplyScalar(0.6); } else { d.vy = 0; d.spin.multiplyScalar(0.8); } d.vx *= 0.7; d.vz *= 0.7; }
      d.m.rotation.x += d.spin.x * dt; d.m.rotation.y += d.spin.y * dt; d.m.rotation.z += d.spin.z * dt;
      d.m.scale.setScalar(Math.max(0.01, Math.min(1, d.life / 0.5)) * d.size);
      if (d.life <= 0) { this.scene.remove(d.m); this.debris.splice(this.debris.indexOf(d), 1); }
    }
    for (const p of this.puffs.slice()) {
      p.life -= dt;
      if (p.flash) { const f = 1 - p.life / p.max; p.m.scale.setScalar(p.grow * (0.3 + f * 0.35)); p.m.rotation.set(f * 2, f * 3, 0); p.m.visible = p.life > 0; }
      else {
        p.vy -= (p.drag ? 3 : 6) * dt; if (p.drag) { p.vx *= 1 - p.drag * dt * 0.3; p.vz *= 1 - p.drag * dt * 0.3; p.m.rotation.x += dt * 8; p.m.rotation.z += dt * 5; }
        p.m.position.x += p.vx * dt; p.m.position.y += p.vy * dt; p.m.position.z += p.vz * dt;
        p.m.scale.setScalar(Math.max(0.01, p.grow * Math.min(1, (p.life / p.max) * 1.6)));
      }
      if (p.life <= 0) { this.scene.remove(p.m); this.puffs.splice(this.puffs.indexOf(p), 1); }
    }
    // flags: flap, sink with the tower top, and topple when it falls
    for (const s of [0, 1] as Side[]) {
      const g = this.flags[s], f = m.forts[s].flag; if (!g) continue;
      let top = 0; for (let x = f.x - 1; x <= f.x + 1; x++) for (let z = f.z - 1; z <= f.z + 1; z++) for (let y = f.top - 1; y >= 0; y--) if (m.at(x, y, z)) { top = Math.max(top, y + 1); break; }
      g.position.y += (top - g.position.y) * Math.min(1, dt * 8);
      const fl = g.children[0]; if (fl) { fl.rotation.y = (s === 1 ? Math.PI : 0) + Math.sin(this.t * 7 + s) * 0.3; fl.scale.x = 1 + Math.sin(this.t * 11 + s) * 0.06; }
      if (this.flagFall[s] > 0) { this.flagFall[s] = Math.min(1, this.flagFall[s] + dt * 1.4); const e = this.flagFall[s]; g.rotation.z = (s === 0 ? 1 : -1) * (e * e) * Math.PI / 2 * 0.95; }
    }
    // pines wobble when hit
    for (const g of this.pineRigs) { const w = (g.userData.wob as number) || 0; if (w > 0) { g.userData.wob = Math.max(0, w - dt * 1.5); g.rotation.z = Math.sin(this.t * 20) * 0.08 * w; } }
    // the windsock streams the wind's way and the snow blows with it
    if (this.sock) {
      const so = this.sock.getObjectByName('sock'); const w = m.wind;
      if (so) { so.rotation.y = w >= 0 ? 0 : Math.PI; so.rotation.z = -0.9 + Math.min(1, Math.abs(w) / 6) * 0.85 + Math.sin(this.t * 8) * 0.05; }
      if (this.gusts) {
        const mx = new T.Matrix4(), gp = this.gustPos, sp = (Math.abs(w) * 3 + 4) * Math.sign(w || 1);
        for (let i = 0; i < gp.length / 3; i++) {
          gp[i * 3] += sp * dt; if (gp[i * 3] > W + 15) gp[i * 3] -= W + 30; if (gp[i * 3] < -15) gp[i * 3] += W + 30;
          mx.makeTranslation(gp[i * 3], gp[i * 3 + 1] + Math.sin(this.t * 3 + i) * 0.2, gp[i * 3 + 2]); this.gusts.setMatrixAt(i, mx);
        }
        this.gusts.instanceMatrix.needsUpdate = true;
      }
    }
    // the throw preview, the pick box and the patch ghost
    const pv = ui.preview ?? [];
    this.preview.count = pv.length; const mx = new T.Matrix4();
    pv.forEach((p, i) => { mx.makeTranslation(p.x, p.y, p.z); this.preview.setMatrixAt(i, mx); });
    this.preview.instanceMatrix.needsUpdate = true;
    (this.preview.material as T.MeshBasicMaterial).color.set(ui.hard ? 0x7fd0ff : 0xffffff);
    const pk = ui.pick;
    this.pick.visible = !!pk && !pk.patch; this.ghost.visible = !!pk && pk.patch;
    if (pk) { (pk.patch ? this.ghost : this.pick).position.set(pk.x + 0.5, pk.y + 0.5, pk.z + 0.5); }
    this.renderer.render(this.scene, this.camera);
  }

  // ---------------------------------------------------------------- picking
  /** the cube under a point on the canvas (and the empty cell in front of it, for patching), or the ground cell */
  pickAt(cx: number, cy: number): { cube: { x: number; y: number; z: number } | null; front: { x: number; y: number; z: number } | null; ground: { x: number; z: number } | null } {
    const el = this.renderer.domElement, b = el.getBoundingClientRect();
    this.ray.setFromCamera(new T.Vector2(((cx - b.left) / b.width) * 2 - 1, -((cy - b.top) / b.height) * 2 + 1), this.camera);
    const hits = this.ray.intersectObjects(this.chunks.filter((c): c is T.Mesh => !!c), false);
    if (hits.length && hits[0].face) {
      const p = hits[0].point, n = hits[0].face.normal;
      const cube = { x: Math.floor(p.x - n.x * 0.01), y: Math.floor(p.y - n.y * 0.01), z: Math.floor(p.z - n.z * 0.01) };
      return { cube, front: { x: Math.floor(p.x + n.x * 0.5), y: Math.floor(p.y + n.y * 0.5), z: Math.floor(p.z + n.z * 0.5) }, ground: null };
    }
    const o = this.ray.ray.origin, d = this.ray.ray.direction;
    if (d.y < 0) { const t = -o.y / d.y, x = o.x + d.x * t, z = o.z + d.z * t; if (x >= 0 && x < W && z >= 0 && z < D) return { cube: null, front: { x: Math.floor(x), y: 0, z: Math.floor(z) }, ground: { x, z } }; }
    return { cube: null, front: null, ground: null };
  }
  /** where a world point appears, in client pixels */
  screenOf(x: number, y: number, z: number) {
    const v = new T.Vector3(x, y, z).project(this.camera), b = this.renderer.domElement.getBoundingClientRect();
    return { x: b.left + ((v.x + 1) / 2) * b.width, y: b.top + ((1 - v.y) / 2) * b.height };
  }
  /** pixels on screen per world unit, near a point (for turning a drag into a throw) */
  pxPerUnit(x: number, y: number, z: number) { const a = this.screenOf(x, y, z), b = this.screenOf(x + 1, y, z); return Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)); }

  /** a picture of a model on a clear background, for the menus and the turntable check, from one shared renderer */
  private thumbR: { r: T.WebGLRenderer; cv: HTMLCanvasElement; s: T.Scene; cam: T.PerspectiveCamera } | null = null;
  thumb(name: string, angle = -0.5, size = 160): string {
    const g = this.geo(name, 2.6); if (!g) return '';
    if (!this.thumbR) {
      const cv = document.createElement('canvas');
      let r: T.WebGLRenderer;
      try { r = new T.WebGLRenderer({ canvas: cv, alpha: true, antialias: true, preserveDrawingBuffer: true }); } catch { return ''; }
      r.outputColorSpace = T.SRGBColorSpace; r.toneMapping = T.ACESFilmicToneMapping; r.setClearColor(0x000000, 0);
      const s = new T.Scene(); s.add(new T.HemisphereLight(0xdfe4ff, 0xbcb3d0, 1.8)); const l = new T.DirectionalLight(0xffe0c0, 1.8); l.position.set(3, 5, 6); s.add(l);
      this.thumbR = { r, cv, s, cam: new T.PerspectiveCamera(28, 1, 0.1, 50) };
    }
    const { r, s, cam, cv } = this.thumbR;
    r.setSize(size, size, false);
    const mesh = new T.Mesh(g, this.charMat); mesh.rotation.y = angle; s.add(mesh);
    const box = new T.Box3().setFromObject(mesh), c = box.getCenter(new T.Vector3()), h = box.getSize(new T.Vector3());
    const dist = Math.max(h.y, h.x, h.z) * 2.3; cam.position.set(c.x, c.y + h.y * 0.1, c.z + dist); cam.lookAt(c);
    r.render(s, cam); const url = cv.toDataURL('image/png'); s.remove(mesh); return url;
  }

  dispose() {
    for (const g of this.geos.values()) g.dispose();
    for (const c of this.chunks) c?.geometry.dispose();
    if (this.thumbR) { this.thumbR.r.dispose(); this.thumbR.r.forceContextLoss(); }
    this.renderer.dispose(); this.renderer.forceContextLoss();
  }
}
