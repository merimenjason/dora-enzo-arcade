// Kumori Pass: drawing only. A night mountain pass in toon-shaded Three.js: cel-ramp materials and ink outlines, a
// heightfield mountainside cut around the road, guardrails, layered rock cuttings on the uphill side, instanced cedars
// and lamp posts with pools of light, glowing vending machines, red shrine gates, tunnels, an airbrushed sky with stars,
// a moon, ridges in three hazy layers and a town's lights in the valley, a moonlit lake, fog, and headlights that light
// the road. The cars are built in pass-models.ts. A chase camera that looks into the next corner, a rear-view mirror in
// duels, and tyre smoke, skid marks and sparks from fixed pools: nothing is allocated per frame.
import * as T from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Track } from './pass-tracks';
import type { WeatherId } from './pass-game';
import { buildCar, hull, INK_PROP, INK_TREE, toon, type CarLook, type CarRig } from './pass-models';
import { cedar, lake, Props, rockCut, ridges, townLights } from './pass-scenery';
export type { CarLook } from './pass-models';

// engine (x, y, height z) → three (x, z, -y)
const V = new T.Vector3(), V2 = new T.Vector3(), V3 = new T.Vector3(), Q = new T.Quaternion(), M4 = new T.Matrix4(), S3 = new T.Vector3(), E = new T.Euler();

export type CarView = { x: number; y: number; z: number; h: number; u: number; v: number; delta: number; ax: number; ay: number; wheelRot: number;
  spin: number; brake: boolean; boost: number; lights: number; pitch: number; visible: boolean; i: number };
export const carView = (): CarView => ({ x: 0, y: 0, z: 0, h: 0, u: 0, v: 0, delta: 0, ax: 0, ay: 0, wheelRot: 0, spin: 0, brake: false, boost: 0, lights: 1, pitch: 0, visible: true, i: 0 });
export type FrameView = { cars: CarView[]; ghost: CarView | null; cam: number; dt: number; dawn: number; slowmo: number; shake: number; focus: number };
export type MirrorRect = { x: number; y: number; w: number; h: number };

// legacy ink for the rails and tunnel portals, which are drawn as offset strips
const INK = new T.MeshBasicMaterial({ color: 0x0d0a14, side: T.BackSide });

function hash(i: number) { let x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
function vnoise(x: number, y: number) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const h = (a: number, b: number) => hash(a * 57 + b * 131);
  const s = (t: number) => t * t * (3 - 2 * t);
  const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
  return a + (b - a) * s(xf) + (c - a) * s(yf) + (a - b - c + d) * s(xf) * s(yf);
}

const MOOD = { fog: new T.Color(0xf2b591), hemi: new T.Color(0xffd6b0), moon: new T.Color(0xffc48a), ridge: new T.Color(0x7a5a78) };
// ---------------------------------------------------------------- particles
class Pool {
  geo = new T.BufferGeometry(); pts: T.Points; n: number; next = 0;
  pos: Float32Array; vel: Float32Array; life: Float32Array; max: Float32Array; size: Float32Array; alpha: Float32Array; grow: number;
  constructor(n: number, mat: T.ShaderMaterial, grow: number) {
    this.n = n; this.grow = grow;
    this.pos = new Float32Array(n * 3); this.vel = new Float32Array(n * 3); this.life = new Float32Array(n); this.max = new Float32Array(n).fill(1); this.size = new Float32Array(n); this.alpha = new Float32Array(n);
    this.geo.setAttribute('position', new T.BufferAttribute(this.pos, 3).setUsage(T.DynamicDrawUsage));
    this.geo.setAttribute('size', new T.BufferAttribute(this.size, 1).setUsage(T.DynamicDrawUsage));
    this.geo.setAttribute('alpha', new T.BufferAttribute(this.alpha, 1).setUsage(T.DynamicDrawUsage));
    this.pts = new T.Points(this.geo, mat); this.pts.frustumCulled = false;
  }
  spawn(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, size: number) {
    const i = this.next; this.next = (this.next + 1) % this.n;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z; this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.life[i] = life; this.max[i] = life; this.size[i] = size; this.alpha[i] = 1;
  }
  step(dt: number, gravity: number, drag: number) {
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) { this.alpha[i] = 0; continue; }
      this.life[i] -= dt;
      const k = Math.max(0, this.life[i] / this.max[i]);
      this.vel[i * 3 + 1] += gravity * dt;
      const d = Math.max(0, 1 - drag * dt);
      this.vel[i * 3] *= d; this.vel[i * 3 + 2] *= d;
      this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.size[i] += this.grow * dt; this.alpha[i] = k;
    }
    (this.geo.attributes.position as T.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.size as T.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.alpha as T.BufferAttribute).needsUpdate = true;
  }
  clear() { this.life.fill(0); this.alpha.fill(0); }
}
const pointsMat = (kind: 'smoke' | 'spark') => new T.ShaderMaterial({
  transparent: true, depthWrite: false, blending: kind === 'spark' ? T.AdditiveBlending : T.NormalBlending,
  uniforms: { scale: { value: 400 }, tint: { value: new T.Color(kind === 'spark' ? 0xffc24a : 0xdfe3ee) }, shade: { value: new T.Color(kind === 'spark' ? 0xff6a1a : 0x9aa1b8) } },
  vertexShader: `attribute float size; attribute float alpha; varying float vA; uniform float scale;
    void main(){ vA = alpha; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = min(size * scale / max(0.5, -mv.z), scale * 0.45); gl_Position = projectionMatrix * mv; }`,
  fragmentShader: kind === 'spark'
    ? `varying float vA; uniform vec3 tint; uniform vec3 shade; void main(){ vec2 p = gl_PointCoord - 0.5; float d = length(p); if (d > 0.5) discard; gl_FragColor = vec4(mix(tint, shade, step(0.22, d)), vA); }`
    : `varying float vA; uniform vec3 tint; uniform vec3 shade; void main(){ vec2 p = gl_PointCoord - 0.5; float d = length(p); if (d > 0.5) discard;
       float f = 1.0 - smoothstep(0.0, 0.5, d); vec3 c = mix(shade, tint, smoothstep(0.1, 0.45, f)); gl_FragColor = vec4(c, vA * vA * 0.3 * f * f); }`,
});

// ---------------------------------------------------------------- the scene
export class PassScene {
  renderer: T.WebGLRenderer; scene = new T.Scene(); camera = new T.PerspectiveCamera(62, 1, 0.2, 2600);
  world = new T.Group(); show = new T.Group();
  hemi = new T.HemisphereLight(0x6c7cc0, 0x1a1626, 1.15); moon = new T.DirectionalLight(0xa9b8ff, 1.3);
  sky: T.Mesh; stars: T.Points; skyMat: T.ShaderMaterial; glow: T.Sprite; moonSprite: T.Sprite;
  cars: CarRig[] = []; ghost: CarRig | null = null; looks: CarLook[] = [];
  smoke: Pool; sparks: Pool; skid: { geo: T.BufferGeometry; pos: Float32Array; next: number; last: number[][]; mesh: T.Mesh };
  track: Track | null = null; lite = false; dark = false; fogBase = 0.006;
  heights: { x0: number; y0: number; step: number; nx: number; ny: number; h: Float32Array } | null = null;
  camPos = new T.Vector3(); camLook = new T.Vector3(); camInit = false; fov = 62; t = 0; showcase = false; showAngle = 0;
  private outlines: T.Object3D[] = [];
  private ridgeLayers: ReturnType<typeof ridges> = []; private town: T.Points | null = null; private lakeMat: T.ShaderMaterial | null = null; private sun: T.Sprite;
  private glows: T.ShaderMaterial[] = [];
  // the rear-view mirror: a small render target shown on a rounded quad, flipped like a mirror
  private mirror = { cam: new T.PerspectiveCamera(46, 3, 0.6, 320), rt: null as T.WebGLRenderTarget | null, rect: null as MirrorRect | null,
    scene: new T.Scene(), ortho: new T.OrthographicCamera(0, 1, 0, -1, -1, 1), quad: null as T.Mesh | null };
  private camYaw = 0;
  constructor(public canvas: HTMLCanvasElement) {
    this.renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(typeof devicePixelRatio === 'number' ? devicePixelRatio : 1, 1.5));
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = T.PCFShadowMap;
    this.renderer.info.autoReset = false; // reset once a frame, so the count covers the mirror too
    this.camera.layers.enable(1); // layer 1: ink outlines and particles, which the mirror leaves out
    this.scene.fog = new T.FogExp2(0x1b2348, 0.006);
    this.scene.add(this.hemi, this.moon, this.moon.target, this.world, this.show);
    this.moon.castShadow = true; this.moon.shadow.mapSize.set(1024, 1024);
    Object.assign(this.moon.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 120 }); this.moon.shadow.bias = -0.0008;
    // sky: an airbrushed gradient dome, stars, the moon and the town glow
    this.skyMat = new T.ShaderMaterial({ side: T.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new T.Color(0x070a1c) }, mid: { value: new T.Color(0x1d2a5e) }, low: { value: new T.Color(0x5a3e6e) }, dawn: { value: 0 } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `varying vec3 vP; uniform vec3 top; uniform vec3 mid; uniform vec3 low; uniform float dawn;
        void main(){ float h = vP.y; vec3 c = h > 0.18 ? mix(mid, top, smoothstep(0.18, 0.75, h)) : mix(low, mid, smoothstep(-0.05, 0.18, h));
          vec3 d = h > 0.12 ? mix(vec3(1.0,0.72,0.5), vec3(0.36,0.52,0.84), smoothstep(0.12, 0.7, h)) : mix(vec3(1.0,0.85,0.55), vec3(1.0,0.66,0.48), smoothstep(-0.05, 0.12, h));
          c = mix(c, d, dawn); c += (fract(sin(dot(vP.xz * 400.0, vec2(12.9898,78.233))) * 43758.5453) - 0.5) * 0.012; gl_FragColor = vec4(c, 1.0); }` });
    this.sky = new T.Mesh(new T.SphereGeometry(2000, 32, 16), this.skyMat); this.scene.add(this.sky);
    const sp = new Float32Array(1400 * 3);
    for (let i = 0; i < 1400; i++) { const a = hash(i) * Math.PI * 2, e = 0.12 + Math.pow(hash(i + 999), 0.7) * 1.35; sp[i * 3] = Math.cos(a) * Math.cos(e) * 1800; sp[i * 3 + 1] = Math.sin(e) * 1800; sp[i * 3 + 2] = Math.sin(a) * Math.cos(e) * 1800; }
    const sg = new T.BufferGeometry(); sg.setAttribute('position', new T.BufferAttribute(sp, 3));
    this.stars = new T.Points(sg, new T.PointsMaterial({ color: 0xfff6e0, size: 2.2, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.9 })); this.scene.add(this.stars);
    this.moonSprite = new T.Sprite(new T.SpriteMaterial({ map: this.glowTexture('#fff8e2', '#c9d4ff', 0.34), fog: false, depthWrite: false, transparent: true }));
    this.moonSprite.scale.set(160, 160, 1); this.scene.add(this.moonSprite);
    this.glow = new T.Sprite(new T.SpriteMaterial({ map: this.glowTexture('#ffc27a', '#ff7a3a', 0.05), fog: false, depthWrite: false, transparent: true, blending: T.AdditiveBlending, opacity: 0.9 }));
    this.glow.scale.set(1400, 340, 1); this.scene.add(this.glow);
    this.sun = new T.Sprite(new T.SpriteMaterial({ map: this.glowTexture('#fff6dc', '#ffae6a', 0.16), fog: false, depthWrite: false, transparent: true, blending: T.AdditiveBlending }));
    this.sun.scale.set(420, 420, 1); this.sun.visible = false; this.scene.add(this.sun);
    // fx pools
    this.smoke = new Pool(260, pointsMat('smoke'), 2.8); this.sparks = new Pool(160, pointsMat('spark'), -0.3);
    this.scene.add(this.smoke.pts, this.sparks.pts); this.smoke.pts.layers.set(1); this.sparks.pts.layers.set(1);
    const SK = 900;
    const skPos = new Float32Array(SK * 6 * 3); const skGeo = new T.BufferGeometry(); skGeo.setAttribute('position', new T.BufferAttribute(skPos, 3).setUsage(T.DynamicDrawUsage));
    const skMesh = new T.Mesh(skGeo, new T.MeshBasicMaterial({ color: 0x08070c, transparent: true, opacity: 0.55, depthWrite: false, side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
    skMesh.frustumCulled = false; this.scene.add(skMesh);
    this.skid = { geo: skGeo, pos: skPos, next: 0, last: [], mesh: skMesh };
    this.resize();
  }

  glowTexture(inner: string, outer: string, core: number) {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d')!;
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, inner); gr.addColorStop(core, inner); gr.addColorStop(Math.min(1, core + 0.18), outer + 'aa'); gr.addColorStop(1, outer + '00');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128); const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
  }

  setLite(lite: boolean) {
    this.lite = lite;
    this.renderer.setPixelRatio(lite ? 1 : Math.min(devicePixelRatio || 1, 1.5));
    this.renderer.shadowMap.enabled = !lite; this.moon.castShadow = !lite;
    if (lite) this.camera.layers.disable(1); else this.camera.layers.enable(1); // outlines and particles
    for (const o of this.outlines) o.visible = !lite;
    for (const c of this.cars) for (const o of c.ink) o.visible = !lite;
    this.smoke.pts.visible = !lite; this.sparks.pts.visible = !lite;
    this.scene.traverse((o) => { if ((o as T.Mesh).material) ((o as T.Mesh).material as T.Material).needsUpdate = true; });
    this.resize();
  }

  // ---- the world for a pass
  setTrack(t: Track) {
    if (this.track === t) return;
    this.track = t; this.dark = t.def.dark;
    this.disposeGroup(this.world); this.world.clear(); this.outlines = [];
    this.smoke.clear(); this.sparks.clear(); this.skid.pos.fill(0); this.skid.geo.attributes.position.needsUpdate = true; this.skid.next = 0;
    const fog = t.def.fog;
    this.fogBase = 0.0035 + fog * 0.05;
    (this.scene.fog as T.FogExp2).density = this.fogBase;
    // terrain: a plane fitted through the road, with noise, blended down to the road near it
    let sx = 0, sy = 0, sz = 0, sxx = 0, syy = 0, sxy = 0, sxz = 0, syz = 0, n = 0;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < t.n; i += 2) { const x = t.x[i], y = t.y[i], z = t.z[i]; sx += x; sy += y; sz += z; sxx += x * x; syy += y * y; sxy += x * y; sxz += x * z; syz += y * z; n++;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    const mx = sx / n, my = sy / n, mz = sz / n;
    const cxx = sxx / n - mx * mx, cyy = syy / n - my * my, cxy = sxy / n - mx * my, cxz = sxz / n - mx * mz, cyz = syz / n - my * mz;
    const det = cxx * cyy - cxy * cxy || 1;
    const ga = (cxz * cyy - cyz * cxy) / det, gb = (cyz * cxx - cxz * cxy) / det;
    const plane = (x: number, y: number) => mz + ga * (x - mx) + gb * (y - my);
    const M = 140, step = 6;
    const x0 = minX - M, y0 = minY - M, nx = Math.ceil((maxX - minX + 2 * M) / step) + 1, ny = Math.ceil((maxY - minY + 2 * M) / step) + 1;
    // spatial hash of road samples
    const CELL = 12, buckets = new Map<number, number[]>();
    const key = (cx: number, cy: number) => cx * 73856093 ^ cy * 19349663;
    for (let i = 0; i < t.n; i += 2) { const k = key(Math.floor(t.x[i] / CELL), Math.floor(t.y[i] / CELL)); let b = buckets.get(k); if (!b) buckets.set(k, (b = [])); b.push(i); }
    const nearest = (x: number, y: number) => {
      const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL); let best = -1, bd = Infinity;
      for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) { const bk = buckets.get(key(cx + a, cy + b)); if (!bk) continue; for (const i of bk) { const d = (x - t.x[i]) ** 2 + (y - t.y[i]) ** 2; if (d < bd) { bd = d; best = i; } } }
      return [best, Math.sqrt(bd)] as const;
    };
    // Lakeside Esses: a basin falls away on the downhill side of the road, down to the lake
    let lakeLevel = -Infinity; if (t.id === 'lake') { lakeLevel = Infinity; for (let i = 0; i < t.n; i++) lakeLevel = Math.min(lakeLevel, t.z[i]); lakeLevel -= 5; }
    const lkg = Math.hypot(ga, gb), lkx = lkg > 1e-3 ? -ga / lkg : 0.83, lky = lkg > 1e-3 ? -gb / lkg : -0.55;
    const H = new Float32Array(nx * ny);
    const pos = new Float32Array(nx * ny * 3), col = new Float32Array(nx * ny * 3);
    const grass = new T.Color(t.def.dawn ? 0x4f6e3c : 0x2c4a36), dirt = new T.Color(0x5b4a3c), rock = new T.Color(0x4a4a58), c = new T.Color();
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const x = x0 + i * step, y = y0 + j * step;
      const [ri, d] = nearest(x, y);
      const base = plane(x, y) + (vnoise(x / 60, y / 60) - 0.5) * 26 + (vnoise(x / 17, y / 17) - 0.5) * 5;
      let h = base;
      if (ri >= 0) {
        const roadH = t.z[ri], half = Math.max(t.wl[ri], t.wr[ri]) + 0.6;
        // flat and a little below the road out past the rails, so no slope pokes up through the road or its edges
        const f = Math.min(1, Math.max(0, (d - half - 3) / 22)); const s = f * f * (3 - 2 * f);
        h = roadH - 0.4 + (base - roadH + 0.4) * s;
        if (d < half + 3) h = roadH - 0.4;
        if (lakeLevel > -Infinity) {
          const fl = Math.min(1, Math.max(0, (d - half - 5) / 14)), down = Math.min(1, Math.max(0, ((x - t.x[ri]) * lkx + (y - t.y[ri]) * lky) / Math.max(1, d) * 3)), k = fl * fl * (3 - 2 * fl) * down;
          h += (lakeLevel - 7 - h) * k;
        }
      }
      H[j * nx + i] = h;
      pos.set([x, h, -y], (j * nx + i) * 3);
    }
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const k = j * nx + i, hx = H[j * nx + Math.min(nx - 1, i + 1)] - H[j * nx + Math.max(0, i - 1)], hy = H[Math.min(ny - 1, j + 1) * nx + i] - H[Math.max(0, j - 1) * nx + i];
      const slope = Math.hypot(hx, hy) / (2 * step);
      c.copy(grass).lerp(dirt, Math.min(1, slope * 1.4)).lerp(rock, Math.min(1, Math.max(0, slope - 0.7) * 1.5));
      c.multiplyScalar(0.85 + vnoise(i / 3, j / 3) * 0.3);
      col.set([c.r, c.g, c.b], k * 3);
    }
    const idx: number[] = [];
    for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) { const a = j * nx + i, b = a + 1, cc = a + nx, d = cc + 1; idx.push(a, b, cc, b, d, cc); } // wound to face up
    const tg = new T.BufferGeometry(); tg.setAttribute('position', new T.BufferAttribute(pos, 3)); tg.setAttribute('color', new T.BufferAttribute(col, 3)); tg.setIndex(idx); tg.computeVertexNormals();
    const terrain = new T.Mesh(tg, this.groundMat = toon(0xffffff, { vertexColors: true })); terrain.receiveShadow = true; this.world.add(terrain);
    this.heights = { x0, y0, step, nx, ny, h: H };
    // which side of the road is the mountain (uphill): it gets a ditch and rock cut; the other side a guardrail
    const uphillLeft = new Int8Array(t.n);
    for (let i = 0; i < t.n; i++) { const lx = -Math.sin(t.h[i]), ly = Math.cos(t.h[i]); uphillLeft[i] = plane(t.x[i] + lx * 10, t.y[i] + ly * 10) > plane(t.x[i] - lx * 10, t.y[i] - ly * 10) ? 1 : 0; }
    // the road surface: asphalt with painted edges and a dashed centre line
    const road = this.ribbon(t, (i) => -t.wr[i] - 0.15, (i) => t.wl[i] + 0.15, () => 0.02, true);
    const rt = this.roadTexture(); road.material = this.roadMat = toon(0xffffff, { map: rt }); road.receiveShadow = true; this.world.add(road);
    // gutters: a darker concrete channel with slats on the inside of marked hairpins
    const gut = this.ribbon(t, (i) => (t.gutter[i] === -1 ? -t.wr[i] - 0.1 : 99), (i) => (t.gutter[i] === -1 ? -t.wr[i] + 0.95 : 99), () => 0.035, false, (i) => t.gutter[i] === -1);
    const gut2 = this.ribbon(t, (i) => (t.gutter[i] === 1 ? t.wl[i] - 0.95 : 99), (i) => (t.gutter[i] === 1 ? t.wl[i] + 0.1 : 99), () => 0.035, false, (i) => t.gutter[i] === 1);
    const gm = toon(0x7d7f88, { map: this.slatTexture() }); gut.material = gm; gut2.material = gm; this.world.add(gut, gut2);
    this.edges(t);
    // rails on both sides (outside the tunnels), and a rock cut behind the ditch on the uphill side
    const railMat = toon(0xe9ecf2, { side: T.DoubleSide }), postMat = toon(0x8d93a3), ditchMat = toon(0x1c2420); // rails face the road on both sides
    for (const side of [1, -1] as const) {
      const isRail = (i: number) => !t.tunnel[i];
      const isCut = (i: number) => !t.tunnel[i] && (side === 1 ? !!uphillLeft[i] : !uphillLeft[i]);
      const w = (i: number) => (side === 1 ? t.wl[i] + 0.25 : -t.wr[i] - 0.25);
      for (const [y0r, y1r] of [[0.55, 0.78], [0.3, 0.46]] as const) {
        const rail = this.wall(t, w, y0r, y1r, isRail); rail.material = railMat; this.world.add(rail);
        const o = this.wall(t, (i) => w(i) + side * 0.03, y0r - 0.03, y1r + 0.03, isRail); o.material = INK; o.layers.set(1); this.world.add(o); this.outlines.push(o);
      }
      const cut = rockCut(t, (i, d, up) => { const p = this.at(t, i, d, up); return [p.x, p.y, p.z]; }, (i) => w(i) + side * 1.2, side, isCut,
        (i, o) => { const d = w(i) + side * (1.2 + o); return this.groundAt(t.x[i] - Math.sin(t.h[i]) * d, t.y[i] + Math.cos(t.h[i]) * d) - t.z[i]; });
      if (cut) { this.world.add(cut.mesh, cut.ink); this.outlines.push(cut.ink); }
      const ditch = this.ribbon(t, (i) => (side === 1 ? w(i) : w(i) - 1.2), (i) => (side === 1 ? w(i) + 1.2 : w(i)), () => -0.18, false, isCut); ditch.material = ditchMat; this.world.add(ditch);
      // rail posts
      const posts: T.Matrix4[] = [];
      for (let i = 0; i < t.n; i += 3) if (isRail(i)) { const p = this.at(t, i, w(i) + side * 0.12, 0); M4.compose(p, Q.setFromEuler(E.set(0, t.h[i], 0)), S3.set(1, 1, 1)); posts.push(M4.clone()); }
      const pg = new T.BoxGeometry(0.12, 0.85, 0.12).translate(0, 0.42, 0);
      this.instanced(pg, postMat, posts, true);
      // a reflector on every other rail post, toward the road
      const refl: T.Matrix4[] = [];
      for (let i = 0; i < t.n; i += 6) if (isRail(i)) { const p = this.at(t, i, w(i) - side * 0.04, 0.66); M4.compose(p, Q.setFromEuler(E.set(0, t.h[i], 0)), S3.set(1, 1, 1)); refl.push(M4.clone()); }
      this.instanced(new T.BoxGeometry(0.16, 0.1, 0.03), side === 1 ? this.edgeMats.amber : this.edgeMats.white, refl, false);
    }
    // tunnels: an arch of dark concrete over the road
    for (let i = 0; i < t.n; i++) if (t.tunnel[i] && !t.tunnel[i - 1]) {
      let j = i; while (j < t.n && t.tunnel[j]) j++;
      this.tunnel(t, Math.max(0, i - 2), Math.min(t.n - 1, j + 2));
    }
    // cedars on the slopes, in two shapes and many sizes, each tinted a little differently
    // in chunks along the road, so the ones out of view are culled
    const CH = 6, chunks = Array.from({ length: CH }, () => ({ tall: [] as T.Matrix4[], tallC: [] as T.Color[], young: [] as T.Matrix4[], youngC: [] as T.Color[] }));
    const rnd = (k: number) => hash(k * 3.17 + t.len);
    for (let k = 0, count = 0; count < 650 && k < 6000; k++) {
      const i = Math.floor(rnd(k) * t.n), side = rnd(k + 0.5) < 0.5 ? -1 : 1, d = 6 + Math.pow(rnd(k + 0.25), 1.6) * 58;
      const lx = -Math.sin(t.h[i]), ly = Math.cos(t.h[i]);
      const x = t.x[i] + lx * side * d, y = t.y[i] + ly * side * d;
      const [ri, dd] = nearest(x, y); if (ri >= 0 && dd < Math.max(t.wl[ri], t.wr[ri]) + 3) continue;
      if (t.tunnel[i] || this.groundAt(x, y) < lakeLevel + 0.8) continue;
      if (lakeLevel > -Infinity && (x - t.x[i]) * lkx + (y - t.y[i]) * lky > 0 && rnd(k + 0.85) < 0.85) continue; // keep the lake shore open
      const tall = rnd(k + 0.6) < 0.62, s = (tall ? 0.7 : 0.6) + Math.pow(rnd(k + 0.75), 1.4) * (tall ? 1.1 : 0.8);
      M4.compose(V.set(x, this.groundAt(x, y) - 0.3, -y), Q.setFromEuler(E.set(0, rnd(k + 0.1) * 6.28, 0)), S3.set(s, s * (0.85 + rnd(k + 0.3) * 0.55), s));
      const ch = chunks[Math.min(CH - 1, Math.floor((i / t.n) * CH))]; count++;
      (tall ? ch.tall : ch.young).push(M4.clone());
      (tall ? ch.tallC : ch.youngC).push(new T.Color().setHSL(0.36 + (rnd(k + 0.9) - 0.5) * 0.08, 0.5, 0.42 + rnd(k + 0.45) * 0.16).multiplyScalar(2.2));
    }
    const gT = cedar(true), gY = cedar(false), hT = hull(gT), hY = hull(gY), treeMat = this.treeMat = toon(0xffffff, { vertexColors: true });
    for (const ch of chunks) { this.trees(gT, hT, treeMat, ch.tall, ch.tallC); this.trees(gY, hY, treeMat, ch.young, ch.youngC); }
    const props = new Props();
    // lamp posts with pools of light (none on the unlit road)
    if (!t.def.dark) {
      const lamps: T.Matrix4[] = [], heads: T.Matrix4[] = [], pools: T.Matrix4[] = [];
      for (let i = 60; i < t.n - 30; i += 85) {
        if (t.tunnel[i]) continue;
        const side = uphillLeft[i] ? 1 : -1, w = side === 1 ? t.wl[i] + 1.6 : -t.wr[i] - 1.6;
        const p = this.at(t, i, w, 0);
        M4.compose(p, Q.setFromEuler(E.set(0, t.h[i] + (side === 1 ? 0 : Math.PI), 0)), S3.set(1, 1, 1)); lamps.push(M4.clone());
        const hp = this.at(t, i, w - side * 1.3, 6.1); M4.compose(hp, Q.identity(), S3.set(1, 1, 1)); heads.push(M4.clone());
        const pp = this.at(t, i, w - side * 2.6, 0.05); M4.compose(pp, Q.setFromEuler(E.set(-Math.PI / 2, 0, 0)), S3.set(1, 1, 1)); pools.push(M4.clone());
      }
      const pole = mergeGeometries([new T.CylinderGeometry(0.09, 0.12, 6.3, 8).translate(0, 3.15, 0).toNonIndexed(), new T.BoxGeometry(0.1, 0.1, 1.4).translate(0, 6.2, -0.65).toNonIndexed()]);
      this.instanced(pole!, toon(0x3a3f4c), lamps, true);
      this.instanced(new T.BoxGeometry(0.6, 0.18, 0.36), new T.MeshBasicMaterial({ color: 0xffe2a0 }), heads, false);
      for (const m of heads) { V.setFromMatrixPosition(m); props.glow(V.x, V.y - 0.2, V.z, 0xffcf80, 4.5); }
      this.instanced(new T.CircleGeometry(6.5, 24), new T.MeshBasicMaterial({ color: 0xffb760, transparent: true, opacity: 0.2, depthWrite: false, blending: T.AdditiveBlending, map: this.glowTexture('#ffffff', '#ffffff', 0.2) }), pools, false);
    }
    // vending machines at the passing places, and shrine gates
    let vends = 0;
    for (let i = 1; i < t.n; i++) if (t.wide[i] && !t.wide[i - 1] && vends < 4) {
      const k = Math.min(t.n - 1, i + 22), side = uphillLeft[k] ? 1 : -1, w = side === 1 ? t.wl[k] + 1.9 : -t.wr[k] - 1.9;
      for (let m = 0; m < 2; m++) props.vending(this.at(t, k + m * 2, w, 0), t.h[k] + (side === 1 ? -Math.PI / 2 : Math.PI / 2), m);
      vends++;
    }
    for (const frac of [0.33, 0.71]) {
      const i = Math.floor(t.n * frac); if (t.tunnel[i]) continue;
      const side = uphillLeft[i] ? 1 : -1, w = side === 1 ? t.wl[i] + 7 : -t.wr[i] - 7;
      props.gate(this.at(t, i, w, 0), t.h[i] + Math.PI / 2);
    }
    // start and finish: painted lines and a lantern arch at the finish
    this.line(t, 14 + 9 + 2); this.line(t, Math.round(t.len - 35));
    props.gate(this.at(t, Math.round(t.len - 35), 0, 0), t.h[Math.round(t.len - 35)] + Math.PI / 2, true);
    this.outlines.push(...props.build(this.world, this.vendAtlas()));
    this.glows = []; this.world.traverse((o) => { if (o.userData.glow) this.glows.push((o as T.Points).material as T.ShaderMaterial); });
    // distant ridges in three hazy layers
    this.ridgeLayers = ridges(mx, mz, -my); for (const l of this.ridgeLayers) this.world.add(l.mesh);
    // the town sits downhill: its glow on the horizon and its lights in the valley
    const gl = Math.hypot(ga, gb) || 1, ddx = -ga / gl, ddz = gb / gl;
    this.glow.position.set(mx + ddx * 1500, mz - 120, -my + ddz * 1500);
    this.town = t.def.dark ? null : townLights(mx + ddx * 950, mz - 170, -my + ddz * 950, ddx, ddz); if (this.town) this.world.add(this.town);
    this.moonSprite.position.set(mx + 900, mz + 700, -(my + 600));
    this.sun.position.set(mx - 1100, mz + 90, -(my - 700));
    // the lake below Lakeside Esses, glinting towards the moon
    this.lakeMat = null;
    if (t.id === 'lake') { const lk = lake(lakeLevel, mx, -my, new T.Vector2(900, -600)); this.world.add(lk.mesh); this.lakeMat = lk.mat; }
    this.sky.position.set(mx, mz, -my); this.stars.position.copy(this.sky.position);
    this.applyMood(0);
    this.camInit = false;
    this.setWeather(this.weather);
  }

  // ---- weather: rain or snow falling in a box that follows the camera (on the particle layer, so Lite leaves it out),
  // a darker wet road or a pale snowy one, and thicker fog
  private weather: WeatherId = 'clear'; private flake: T.CanvasTexture | null = null;
  private roadMat: T.MeshToonMaterial | null = null; private groundMat: T.MeshToonMaterial | null = null; private treeMat: T.MeshToonMaterial | null = null;
  private fall: { obj: T.Points | T.LineSegments; pos: Float32Array; drops: Float32Array; n: number; snow: boolean; placed: boolean } | null = null;
  setWeather(w: WeatherId) {
    this.weather = w;
    const snow = w === 'snow', rain = w === 'rain';
    if (this.roadMat) { this.roadMat.color.set(rain ? 0x8a93ab : snow ? 0xd9dde6 : 0xffffff); this.roadMat.emissive.set(snow ? 0x3a4052 : 0x000000); }
    if (this.groundMat) this.groundMat.emissive.set(snow ? 0x8a93ab : 0x000000);
    if (this.treeMat) this.treeMat.emissive.set(snow ? 0x485068 : 0x000000);
    (this.scene.fog as T.FogExp2).density = this.fogBase * (rain ? 1.5 : snow ? 1.9 : 1);
    if (this.fall) { this.scene.remove(this.fall.obj); this.fall.obj.geometry.dispose(); (this.fall.obj.material as T.Material).dispose(); this.fall = null; }
    if (w === 'clear') return;
    // drops live in a 50 × 20 × 50 m box around the camera; rain is drawn as short streaks, snow as soft flakes
    const n = snow ? 2200 : 1800, drops = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { drops[i * 3] = (Math.random() - 0.5) * 50; drops[i * 3 + 1] = Math.random() * 20 - 4; drops[i * 3 + 2] = (Math.random() - 0.5) * 50; }
    const pos = new Float32Array(n * (snow ? 3 : 6)), geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(pos, 3).setUsage(T.DynamicDrawUsage));
    const obj = snow ? new T.Points(geo, new T.PointsMaterial({ color: 0xf2f5ff, size: 0.3, map: this.flake ??= this.glowTexture('#ffffff', '#ffffff', 0.3), transparent: true, opacity: 0.9, depthWrite: false }))
      : new T.LineSegments(geo, new T.LineBasicMaterial({ color: 0xaebbe0, transparent: true, opacity: 0.38, depthWrite: false }));
    obj.frustumCulled = false; obj.layers.set(1); this.scene.add(obj);
    this.fall = { obj, pos, drops, n, snow, placed: false };
  }
  private stepWeather(dt: number, vx: number, vy: number) {
    const f = this.fall; if (!f) return;
    const cx = this.camera.position.x, cy = this.camera.position.y, cz = this.camera.position.z, d = f.drops, p = f.pos;
    const fallV = f.snow ? 1.6 : 19, wrap = (v: number, c: number) => v - Math.floor((v - c + 25) / 50) * 50;
    // drops stay put in the world (so the car drives through them) and wrap round to stay in the box; height follows the camera
    if (!f.placed) { for (let i = 0; i < f.n; i++) { d[i * 3] += cx; d[i * 3 + 2] += cz; } f.placed = true; }
    for (let i = 0; i < f.n; i++) {
      let y = d[i * 3 + 1] - fallV * dt;
      if (y < -4) y += 20;
      d[i * 3 + 1] = y;
      if (f.snow) { d[i * 3] += Math.sin(this.t * 0.9 + i) * 0.6 * dt; d[i * 3 + 2] += Math.cos(this.t * 0.7 + i * 1.3) * 0.6 * dt; }
      const x = (d[i * 3] = wrap(d[i * 3], cx)), z = (d[i * 3 + 2] = wrap(d[i * 3 + 2], cz)), wy = cy + y;
      if (f.snow) { p[i * 3] = x; p[i * 3 + 1] = wy; p[i * 3 + 2] = z; }
      else {
        // a streak along the fall, leaning back against the car's motion
        p[i * 6] = x; p[i * 6 + 1] = wy; p[i * 6 + 2] = z;
        p[i * 6 + 3] = x + vx * 0.03; p[i * 6 + 4] = wy + 0.7; p[i * 6 + 5] = z - vy * 0.03;
      }
    }
    (f.obj.geometry.attributes.position as T.BufferAttribute).needsUpdate = true;
  }

  // ---- road edges: unlit paint and reflectors (they glow in the headlights and fade into the fog with distance),
  // a pale shoulder strip, and delineator posts, the same on both sides of the road
  private edgeMats = {
    line: new T.MeshBasicMaterial({ color: 0xf4efe0, side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }),
    centre: new T.MeshBasicMaterial({ color: 0xe8c45a, side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }),
    white: new T.MeshBasicMaterial({ color: 0xffffff }), amber: new T.MeshBasicMaterial({ color: 0xffa23a }),
  };
  private edges(t: Track) {
    const M = this.edgeMats;
    for (const side of [1, -1] as const) {
      const edge = (i: number) => (side === 1 ? t.wl[i] : -t.wr[i]);
      const plain = (i: number) => t.gutter[i] !== side; // a drain gutter replaces the paint and shoulder on its side
      // the shoulder: a pale concrete strip from just inside the edge line out to the rail
      const sh = this.ribbon(t, (i) => (side === 1 ? edge(i) - 0.3 : edge(i) - 0.25), (i) => (side === 1 ? edge(i) + 0.25 : edge(i) + 0.3), () => 0.025, false, plain);
      sh.material = toon(0x9a958a, { emissive: 0x1c1a17, side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }); sh.receiveShadow = true; this.world.add(sh);
      // a solid white edge line
      const ln = this.ribbon(t, (i) => Math.min(edge(i) - side * 0.5, edge(i) - side * 0.32), (i) => Math.max(edge(i) - side * 0.5, edge(i) - side * 0.32), () => 0.03, false, plain);
      ln.material = M.line; this.world.add(ln);
      // delineator posts every 8 m outside the tunnels (white with an amber reflector on the left, white on the right),
      // and reflective studs on the edge line all the way, tunnels too
      const posts: T.Matrix4[] = [], tops: T.Matrix4[] = [], studs: T.Matrix4[] = [];
      for (let i = side === 1 ? 4 : 0; i < t.n; i += 8) {
        if (!t.tunnel[i]) { M4.compose(this.at(t, i, edge(i) + side * 0.55, 0), Q.setFromEuler(E.set(0, t.h[i], 0)), S3.set(1, 1, 1)); posts.push(M4.clone());
          M4.compose(this.at(t, i, edge(i) + side * 0.55 - side * 0.06, 0.92), Q.setFromEuler(E.set(0, t.h[i], 0)), S3.set(1, 1, 1)); tops.push(M4.clone()); }
        if (plain(i)) { M4.compose(this.at(t, i, edge(i) - side * 0.41, 0.05), Q.setFromEuler(E.set(0, t.h[i], 0)), S3.set(1, 1, 1)); studs.push(M4.clone()); }
      }
      this.instanced(new T.BoxGeometry(0.1, 1.05, 0.1).translate(0, 0.52, 0), toon(0xf2f2ee, { emissive: 0x202020 }), posts, true);
      this.instanced(new T.BoxGeometry(0.06, 0.16, 0.12), side === 1 ? M.amber : M.white, tops, false);
      this.instanced(new T.BoxGeometry(0.22, 0.05, 0.12), side === 1 ? M.amber : M.white, studs, false);
    }
    // the dashed centre line: 2 m of paint, 4 m gap
    const c = this.ribbon(t, () => -0.07, () => 0.07, () => 0.03, false, (i) => i % 6 < 4 && !t.wide[i]);
    c.material = M.centre; this.world.add(c);
  }

  /** Night → dawn (0..1): sky, fog, light colours. */
  applyMood(dawn: number) {
    const t = this.track; const dark = this.dark;
    this.skyMat.uniforms.dawn.value = dawn;
    (this.scene.fog as T.FogExp2).color.set(t && t.def.fog > 0.5 ? 0x5d6688 : dark ? 0x07080f : 0x1b2348).lerp(MOOD.fog, dawn * 0.8);
    this.hemi.intensity = (dark ? 0.62 : 1.55) + dawn * 1.4;
    this.hemi.color.set(0x7484c8).lerp(MOOD.hemi, dawn);
    this.moon.intensity = (dark ? 0.4 : 1.6) + dawn * 1.1;
    this.moon.color.set(0xa9b8ff).lerp(MOOD.moon, dawn);
    (this.stars.material as T.PointsMaterial).opacity = Math.max(0, 0.9 - dawn * 1.2) * (t && t.def.fog > 0.5 ? 0.3 : 1);
    (this.moonSprite.material as T.SpriteMaterial).opacity = Math.max(0, 1 - dawn * 1.3);
    for (const l of this.ridgeLayers) l.mat.color.copy(l.night).lerp(l.dawn, dawn);
    if (this.town) (this.town.material as T.PointsMaterial).opacity = 0.95 * (1 - dawn * 0.8) * (t && t.def.fog > 0.5 ? 0.35 : 1);
    if (this.lakeMat) this.lakeMat.uniforms.bright.value = 1 - dawn * 0.5;
    this.sun.visible = dawn > 0.12; (this.sun.material as T.SpriteMaterial).opacity = Math.min(1, (dawn - 0.12) * 2.5);
    (this.glow.material as T.SpriteMaterial).opacity = (dark ? 0.45 : 0.9) * (1 - dawn);
  }

  private at(t: Track, i: number, d: number, up: number) {
    const x = t.x[i] - Math.sin(t.h[i]) * d, y = t.y[i] + Math.cos(t.h[i]) * d;
    return new T.Vector3(x, t.z[i] + up, -y);
  }
  groundAt(x: number, y: number) {
    const H = this.heights; if (!H) return 0;
    const fx = (x - H.x0) / H.step, fy = (y - H.y0) / H.step;
    const i = Math.max(0, Math.min(H.nx - 2, Math.floor(fx))), j = Math.max(0, Math.min(H.ny - 2, Math.floor(fy)));
    const u = Math.min(1, Math.max(0, fx - i)), v = Math.min(1, Math.max(0, fy - j));
    const a = H.h[j * H.nx + i], b = H.h[j * H.nx + i + 1], c = H.h[(j + 1) * H.nx + i], d = H.h[(j + 1) * H.nx + i + 1];
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  /** A flat strip along the road between two offsets (left positive). */
  private ribbon(t: Track, a: (i: number) => number, b: (i: number) => number, lift: (i: number) => number, uv: boolean, keep?: (i: number) => boolean) {
    const pos: number[] = [], uvs: number[] = [], idx: number[] = [];
    let prev = -1;
    for (let i = 0; i < t.n; i += 2) {
      const on = !keep || keep(i);
      if (!on) { prev = -1; continue; }
      const pa = this.at(t, i, a(i), lift(i)), pb = this.at(t, i, b(i), lift(i));
      const k = pos.length / 3; pos.push(pa.x, pa.y, pa.z, pb.x, pb.y, pb.z);
      uvs.push(0, i / 8, 1, i / 8);
      if (prev >= 0) idx.push(prev, k, prev + 1, prev + 1, k, k + 1); // wound to face up
      prev = k;
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2)); g.setIndex(idx); g.computeVertexNormals();
    void uv;
    return new T.Mesh(g);
  }
  /** A vertical strip along the road at an offset. */
  private wall(t: Track, d: (i: number) => number, y0: number, y1: number, keep: (i: number) => boolean) {
    const pos: number[] = [], idx: number[] = []; let prev = -1;
    for (let i = 0; i < t.n; i += 2) {
      if (!keep(i)) { prev = -1; continue; }
      const p0 = this.at(t, i, d(i), y0), p1 = this.at(t, i, d(i), y1);
      const k = pos.length / 3; pos.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z);
      if (prev >= 0) idx.push(prev, k, prev + 1, prev + 1, k, k + 1);
      prev = k;
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    const m = new T.Mesh(g); m.material = new T.MeshBasicMaterial(); (m as T.Mesh).castShadow = false;
    return m;
  }
  private tunnel(t: Track, a: number, b: number) {
    const pos: number[] = [], idx: number[] = []; const SEG = 10; let prev = -1;
    for (let i = a; i <= b; i += 2) {
      const half = Math.max(t.wl[i], t.wr[i]) + 0.8, k = pos.length / 3;
      for (let s = 0; s <= SEG; s++) { const ang = (s / SEG) * Math.PI; const p = this.at(t, i, Math.cos(ang) * half, Math.sin(ang) * 5.6 - 0.2); pos.push(p.x, p.y, p.z); }
      if (prev >= 0) for (let s = 0; s < SEG; s++) idx.push(prev + s, k + s, prev + s + 1, prev + s + 1, k + s, k + s + 1);
      prev = k;
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    const m = new T.Mesh(g, toon(0x3b3a42, { side: T.DoubleSide })); m.receiveShadow = true; this.world.add(m);
    // the portals
    for (const i of [a, b]) {
      const p = this.at(t, i, 0, 0);
      const portal = new T.Mesh(new T.RingGeometry(Math.max(t.wl[i], t.wr[i]) + 0.8, Math.max(t.wl[i], t.wr[i]) + 2.4, 18, 1, 0, Math.PI), toon(0x6c6a72, { side: T.DoubleSide }));
      portal.position.copy(p); portal.position.y -= 0.2; portal.rotation.y = t.h[i] + Math.PI / 2; this.world.add(portal);
      const o = new T.Mesh(portal.geometry, INK); o.scale.setScalar(1.02); o.layers.set(1); portal.add(o); this.outlines.push(o);
    }
  }
  /** One chunk of cedars and their ink, bounded so the chunk is culled when out of view. */
  private trees(geo: T.BufferGeometry, ink: T.BufferGeometry, mat: T.Material, ms: T.Matrix4[], cols: T.Color[]) {
    if (!ms.length) return;
    const im = new T.InstancedMesh(geo, mat, ms.length), io = new T.InstancedMesh(ink, INK_TREE, ms.length);
    ms.forEach((m, i) => { im.setMatrixAt(i, m); io.setMatrixAt(i, m); im.setColorAt(i, cols[i]); });
    im.receiveShadow = true; im.computeBoundingSphere(); io.computeBoundingSphere(); io.layers.set(1); io.visible = !this.lite;
    this.world.add(im, io); this.outlines.push(io);
  }
  private instanced(geo: T.BufferGeometry, mat: T.Material, ms: T.Matrix4[], outline: boolean, oscale = 1, ink: T.Material = INK_PROP, colors?: T.Color[]) {
    if (!ms.length) return;
    const im = new T.InstancedMesh(geo, mat, ms.length); ms.forEach((m, i) => im.setMatrixAt(i, m)); im.castShadow = false; im.receiveShadow = true; this.world.add(im);
    if (colors) colors.forEach((c, i) => im.setColorAt(i, c));
    if (outline) {
      const og = hull(geo); if (oscale !== 1) og.scale(oscale, oscale, oscale);
      const io = new T.InstancedMesh(og, ink, ms.length); ms.forEach((m, i) => io.setMatrixAt(i, m)); io.layers.set(1); this.world.add(io); this.outlines.push(io); io.visible = !this.lite;
    }
  }
  private vendTex: T.CanvasTexture | null = null;
  /** both vending machine faces side by side, rows of bottles and a dark slot */
  private vendAtlas() {
    if (this.vendTex) return this.vendTex;
    const c = document.createElement('canvas'); c.width = 256; c.height = 192; const g = c.getContext('2d')!;
    for (let k = 0; k < 2; k++) {
      const o = k * 128; g.fillStyle = '#e9f8ff'; g.fillRect(o, 0, 128, 192);
      const cols = ['#e2483d', '#2c8de0', '#f2b631', '#3fbf74', '#9a5ad8', '#f07ab0'];
      for (let r = 0; r < 3; r++) for (let q = 0; q < 4; q++) { g.fillStyle = cols[(r * 4 + q + k) % cols.length]; g.fillRect(o + 10 + q * 28, 14 + r * 40, 18, 30); g.fillStyle = '#fff'; g.fillRect(o + 12 + q * 28, 18 + r * 40, 4, 22); g.fillStyle = '#d33'; g.fillRect(o + 12 + q * 28, 46 + r * 40, 14, 4); }
      g.fillStyle = '#1b1b24'; g.fillRect(o + 14, 140, 100, 34); g.fillStyle = '#ffde59'; g.fillRect(o + 84, 148, 22, 6);
    }
    this.vendTex = new T.CanvasTexture(c); this.vendTex.colorSpace = T.SRGBColorSpace; this.vendTex.userData.keep = true; return this.vendTex;
  }
  private line(t: Track, s: number) {
    const i = Math.max(0, Math.min(t.n - 1, Math.round(s)));
    const m = new T.Mesh(new T.PlaneGeometry(1.0, t.wl[i] + t.wr[i]), new T.MeshBasicMaterial({ map: this.checkerTexture() }));
    m.position.copy(this.at(t, i, (t.wl[i] - t.wr[i]) / 2, 0.04)); m.rotation.set(-Math.PI / 2, 0, t.h[i]); this.world.add(m);
  }
  private checker: T.CanvasTexture | null = null;
  private checkerTexture() {
    if (this.checker) return this.checker;
    const c = document.createElement('canvas'); c.width = 32; c.height = 256; const g = c.getContext('2d')!;
    for (let y = 0; y < 16; y++) for (let x = 0; x < 2; x++) { g.fillStyle = (x + y) % 2 ? '#f3efe4' : '#1b1b22'; g.fillRect(x * 16, y * 16, 16, 16); }
    this.checker = new T.CanvasTexture(c); this.checker.magFilter = T.NearestFilter; return this.checker;
  }
  private roadTexture() {
    const c = document.createElement('canvas'); c.width = 256; c.height = 256; const g = c.getContext('2d')!;
    g.fillStyle = '#4a4c58'; g.fillRect(0, 0, 256, 256);
    for (let k = 0; k < 900; k++) { const v = 60 + hash(k) * 40; g.fillStyle = `rgb(${v},${v + 2},${v + 12})`; g.fillRect(hash(k + 1) * 256, hash(k + 2) * 256, 2, 2); }
    const t = new T.CanvasTexture(c); t.wrapS = T.ClampToEdgeWrapping; t.wrapT = T.RepeatWrapping; t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; return t;
  }
  private slatTexture() {
    const c = document.createElement('canvas'); c.width = 64; c.height = 64; const g = c.getContext('2d')!;
    g.fillStyle = '#8b8d96'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#26272e'; for (let y = 0; y < 64; y += 10) g.fillRect(8, y, 48, 5);
    const t = new T.CanvasTexture(c); t.wrapT = T.RepeatWrapping; t.repeat.set(1, 3); return t;
  }

  // ---- cars
  setCars(looks: CarLook[], ghost: CarLook | null) {
    const same = looks.length === this.looks.length && looks.every((l, i) => l.shape === this.looks[i].shape && l.body === this.looks[i].body) && !!ghost === !!this.ghost;
    if (same) return;
    for (const c of this.cars) { this.scene.remove(c.root); this.disposeGroup(c.root); }
    if (this.ghost) { this.scene.remove(this.ghost.root); this.disposeGroup(this.ghost.root); }
    this.looks = looks.slice();
    this.cars = looks.map((l, i) => {
      const r = buildCar(l, i < 2); this.scene.add(r.root); for (const o of r.ink) o.visible = !this.lite;
      // a rival can fade when it tailgates between the camera and the player, so its materials start transparent
      if (i > 0) for (const m of r.fade) m.transparent = true;
      return r;
    });
    this.ghost = ghost ? buildCar({ ...ghost, ghost: true }, false) : null;
    if (this.ghost) this.scene.add(this.ghost.root);
    this.skid.last = looks.map(() => [NaN, NaN, NaN, NaN]);
  }

  private pose(rig: CarRig, c: CarView, dt: number) {
    rig.root.visible = c.visible;
    rig.root.position.set(c.x, c.z, -c.y);
    rig.root.rotation.set(0, c.h, 0);
    rig.root.rotateZ(c.pitch);
    // body roll and pitch: a damped spring towards the lean the car's real accelerations ask for (squat on the
    // throttle, dive under braking, roll out of the corner)
    const k = Math.min(dt, 0.033);
    const rollT = Math.max(-0.085, Math.min(0.085, c.ay * 0.0085)), pitchT = Math.max(-0.05, Math.min(0.05, c.ax * 0.0055));
    rig.rollV += ((rollT - rig.roll) * 150 - rig.rollV * 13) * k; rig.roll += rig.rollV * k;
    rig.pitchV += ((pitchT - rig.pitch) * 170 - rig.pitchV * 15) * k; rig.pitch += rig.pitchV * k;
    rig.body.rotation.x = rig.roll; rig.body.rotation.z = rig.pitch;
    for (const s of rig.steer) s.rotation.y = c.delta;
    for (const s of rig.spinners) s.rotation.z = -c.wheelRot;
    for (const p of rig.pops) p.rotation.z += ((c.lights > 0.5 ? 0 : -0.46) - p.rotation.z) * Math.min(1, dt * 6);
    // tail lamps: dim with the lights on, bright under braking
    rig.tail.color.copy(rig.tailCol[0]).lerp(rig.tailCol[1], c.brake ? 1 : c.lights > 0.5 ? 0.3 : 0);
    if (rig.tailGlow) rig.tailGlow.opacity += ((c.brake ? 0.95 : c.lights > 0.5 ? 0.32 : 0.08) - rig.tailGlow.opacity) * Math.min(1, dt * 14);
    if (rig.spot) rig.spot.intensity = c.lights > 0.5 ? 90 : 0;
    if (rig.beam) (rig.beam.material as T.MeshBasicMaterial).opacity = c.lights > 0.5 ? 0.035 + (this.track ? this.track.def.fog * 0.07 : 0) : 0;
    if (rig.headPool) rig.headPool.visible = c.lights > 0.5;
  }
  /** Fade a car that sits between the camera and the player, instead of lifting the camera over it. */
  private fadeCar(rig: CarRig, block: number, dt: number) {
    rig.faded += (block - rig.faded) * Math.min(1, dt * 8);
    const op = 1 - rig.faded * 0.72;
    for (const m of rig.fade) { m.opacity = m.userData.op0 === undefined ? (m.userData.op0 = m.opacity, op * m.opacity) : op * (m.userData.op0 as number); m.depthWrite = rig.faded < 0.05; }
    for (const o of rig.ink) o.visible = !this.lite && rig.faded < 0.4;
  }

  /** Emit smoke, skid marks and sparks for a car this frame. */
  private wheelFx(k: number, c: CarView, rig: CarRig, dt: number) {
    if (this.lite || !c.visible) return;
    const ch = Math.cos(c.h), sh = Math.sin(c.h);
    const rearX = -1.25, half = 0.72;
    const sp = Math.hypot(c.u, c.v);
    const marks = this.skid.last[k];
    for (let w = 0; w < 2; w++) {
      const side = w ? 1 : -1;
      const wx = c.x + ch * rearX - sh * side * half, wy = c.y + sh * rearX + ch * side * half;
      if (c.spin > 0.35 && sp > 3) {
        if (hash(this.t * 97 + k * 13 + w) < c.spin * dt * 40) this.smoke.spawn(wx, c.z + 0.3, -wy, (hash(this.t + w) - 0.5) * 2 - ch * sp * 0.15, 0.6 + hash(this.t * 3) * 0.8, (hash(this.t * 7 + w) - 0.5) * 2 + sh * sp * 0.15, 1.1 + c.spin * 0.8, 0.9 + c.spin * 0.6);
        const lx = marks[w * 2], ly = marks[w * 2 + 1];
        if (!Number.isNaN(lx)) {
          const dx = wx - lx, dy = wy - ly, d = Math.hypot(dx, dy);
          if (d > 0.35 && d < 4) { this.skidQuad(lx, ly, wx, wy, c.z + 0.13); marks[w * 2] = wx; marks[w * 2 + 1] = wy; }
          else if (d >= 4) { marks[w * 2] = wx; marks[w * 2 + 1] = wy; }
        } else { marks[w * 2] = wx; marks[w * 2 + 1] = wy; }
      } else { marks[w * 2] = NaN; marks[w * 2 + 1] = NaN; }
    }
    void rig;
  }
  private skidQuad(ax: number, ay: number, bx: number, by: number, z: number) {
    const dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy) || 1, nx = (-dy / d) * 0.11, ny = (dx / d) * 0.11;
    const p = this.skid.pos, o = this.skid.next * 18;
    const pts = [ax + nx, ay + ny, ax - nx, ay - ny, bx + nx, by + ny, ax - nx, ay - ny, bx - nx, by - ny, bx + nx, by + ny];
    for (let q = 0; q < 6; q++) { p[o + q * 3] = pts[q * 2]; p[o + q * 3 + 1] = z; p[o + q * 3 + 2] = -pts[q * 2 + 1]; }
    this.skid.next = (this.skid.next + 1) % (p.length / 18);
    (this.skid.geo.attributes.position as T.BufferAttribute).needsUpdate = true;
  }
  /** Guardrail sparks at a world point (engine coords). */
  spark(x: number, y: number, z: number, mag: number) {
    if (this.lite) return;
    const n = Math.min(26, 4 + Math.round(mag * 2));
    for (let i = 0; i < n; i++) { const a = hash(this.t * 31 + i) * Math.PI * 2, s = 3 + hash(this.t * 17 + i) * 6 + mag * 0.4; this.sparks.spawn(x, z + 0.6, -y, Math.cos(a) * s, 2 + hash(i + this.t) * 4, Math.sin(a) * s, 0.3 + hash(i * 3 + this.t) * 0.4, 0.22); }
  }
  puff(x: number, y: number, z: number, n: number) {
    if (this.lite) return;
    for (let i = 0; i < n; i++) this.smoke.spawn(x + (hash(this.t + i) - 0.5) * 2, z + 0.4, -y + (hash(this.t * 2 + i) - 0.5) * 2, (hash(i + this.t * 5) - 0.5) * 3, 1 + hash(i) * 1.5, (hash(i * 7 + this.t) - 0.5) * 3, 1.6, 1.4);
  }

  // ---- frame
  headTex: T.Texture | null = null;
  render(f: FrameView) {
    const dt = Math.min(0.05, f.dt); this.t += dt;
    this.renderer.info.reset();
    if (this.showcase) { this.renderShowcase(dt); return; }
    const t = this.track; if (!t) return;
    this.applyMood(f.dawn);
    if (this.lakeMat) this.lakeMat.uniforms.time.value = this.t;
    for (let i = 0; i < f.cars.length; i++) { const c = f.cars[i], rig = this.cars[i]; if (!rig) continue; this.pose(rig, c, dt); this.wheelFx(i, c, rig, dt); }
    if (this.ghost && f.ghost) this.pose(this.ghost, f.ghost, dt); else if (this.ghost) this.ghost.root.visible = false;
    this.smoke.step(dt * f.slowmo, 0.8, 1.6); this.sparks.step(dt * f.slowmo, -14, 0.5);
    // the chase camera swings out into a drift
    const c = f.cars[f.focus] ?? f.cars[0];
    const sp = Math.hypot(c.u, c.v);
    const vx = Math.cos(c.h) * c.u - Math.sin(c.h) * c.v, vy = Math.sin(c.h) * c.u + Math.cos(c.h) * c.v;
    let dx = Math.cos(c.h), dy = Math.sin(c.h);
    if (sp > 4) { const k = 0.55; dx = dx * (1 - k) + (vx / sp) * k; dy = dy * (1 - k) + (vy / sp) * k; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l; }
    // and looks a little into the next corner, so it is in view before the turn-in
    const ahead = Math.min(t.n - 1, Math.max(0, Math.round(c.i + 12 + sp * 0.9)));
    let dh = t.h[ahead] - Math.atan2(dy, dx); dh -= Math.round(dh / (Math.PI * 2)) * Math.PI * 2;
    this.camYaw += (Math.max(-0.28, Math.min(0.28, dh * 0.3)) - this.camYaw) * Math.min(1, dt * 2.5);
    const wideK = this.camera.aspect > 1.9 ? 0.82 : 1;
    const [dist, hgt, look] = f.cam === 1 ? [10.5 * wideK, 4.4, 6] : f.cam === 2 ? [-0.4, 1.25, 30] : [4.9 * wideK, 1.95, 4.5];
    // a rival tailgating between the camera and the player fades out; the mirror shows it instead
    for (let i = 0; i < f.cars.length; i++) {
      const o = f.cars[i], rig = this.cars[i]; if (o === c || !rig) continue;
      const ox = o.x - c.x, oy = o.y - c.y, along = -(ox * dx + oy * dy), side = Math.abs(ox * dy - oy * dx);
      this.fadeCar(rig, f.cam !== 2 && along > -0.5 && along < dist + 2.6 && side < 2.6 ? 1 : 0, dt);
    }
    V.set(c.x - dx * dist, c.z + hgt, -(c.y - dy * dist));
    const ground = Math.max(this.groundAt(V.x, -V.z), c.z) + 1.0;
    if (V.y < ground) V.y = ground;
    const cy = Math.cos(this.camYaw), sy = Math.sin(this.camYaw), lx = dx * cy - dy * sy, ly = dx * sy + dy * cy;
    V2.set(c.x + lx * look, c.z + (f.cam === 2 ? 0.9 : 1.15), -(c.y + ly * look));
    if (!this.camInit) { this.camPos.copy(V); this.camLook.copy(V2); this.camInit = true; }
    const k = f.cam === 2 ? 1 : 1 - Math.exp(-dt * 7);
    this.camPos.lerp(V, k); this.camLook.lerp(V2, f.cam === 2 ? 1 : 1 - Math.exp(-dt * 10));
    this.camera.position.copy(this.camPos);
    // a light, quick shake on guardrail hits
    if (f.shake > 0) { const a = Math.min(0.6, f.shake) * 0.3; this.camera.position.x += Math.sin(this.t * 53) * a * 0.6; this.camera.position.y += Math.sin(this.t * 41 + 1.3) * a * 0.5; this.camera.position.z += Math.sin(this.t * 47 + 2.1) * a * 0.4; }
    this.camera.lookAt(this.camLook);
    // the field of view widens a little with speed and boost
    const fovT = 60 - Math.min(10, Math.max(0, (this.camera.aspect - 1.6) * 14)) + Math.min(1, Math.max(0, (sp - 16) / 22)) * 10 + c.boost * 6;
    this.fov += (fovT - this.fov) * Math.min(1, dt * 3);
    if (Math.abs(this.camera.fov - this.fov) > 0.01) { this.camera.fov = this.fov; this.camera.updateProjectionMatrix(); }
    // the moon's shadow box follows the car
    this.moon.position.set(c.x + 30, c.z + 60, -c.y + 20); this.moon.target.position.set(c.x, c.z, -c.y);
    this.stepWeather(dt, vx, vy);
    this.renderer.render(this.scene, this.camera);
    if (f.cars.length > 1 && this.mirror.rect && this.mirror.quad) this.renderMirror(c, this.cars[f.focus] ?? this.cars[0]);
  }

  // ---- the rear-view mirror (duels)
  /** Where the mirror sits on the canvas, in CSS pixels, or null to hide it. */
  setMirror(rect: MirrorRect | null) {
    const M = this.mirror; M.rect = rect;
    if (!rect) return;
    const pr = Math.min(this.renderer.getPixelRatio(), 1.5), w = Math.max(16, Math.round(rect.w * pr)), h = Math.max(8, Math.round(rect.h * pr));
    if (!M.rt || M.rt.width !== w || M.rt.height !== h) { M.rt?.dispose(); M.rt = new T.WebGLRenderTarget(w, h, { depthBuffer: true }); M.rt.texture.colorSpace = T.SRGBColorSpace; }
    if (!M.quad) {
      const mat = new T.ShaderMaterial({ transparent: true, depthTest: false, depthWrite: false,
        uniforms: { map: { value: null }, size: { value: new T.Vector2(1, 1) } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: `uniform sampler2D map; uniform vec2 size; varying vec2 vUv;
          void main(){ vec2 p = (vUv - 0.5) * size; vec2 q = abs(p) - (size * 0.5 - 12.0); float d = length(max(q, 0.0)) - 12.0; if (d > 0.0) discard;
            vec4 c = texture2D(map, vec2(1.0 - vUv.x, vUv.y)); gl_FragColor = vec4(c.rgb, 1.0); }` });
      M.quad = new T.Mesh(new T.PlaneGeometry(1, 1), mat); M.scene.add(M.quad);
      M.cam.layers.set(0);
    }
    const mat = M.quad.material as T.ShaderMaterial; mat.uniforms.map.value = M.rt.texture; mat.uniforms.size.value.set(rect.w, rect.h);
    M.quad.scale.set(rect.w, rect.h, 1); M.quad.position.set(rect.x + rect.w / 2, -(rect.y + rect.h / 2), 0);
    M.cam.aspect = rect.w / rect.h; M.cam.updateProjectionMatrix();
  }
  private renderMirror(c: CarView, own: CarRig) {
    const M = this.mirror, r = this.renderer, ch = Math.cos(c.h), sh = Math.sin(c.h);
    // from the player's roof, looking back down the road
    M.cam.position.set(c.x - ch * 0.4, c.z + 1.75, -(c.y - sh * 0.4));
    V3.set(c.x - ch * 30, c.z + 0.6, -(c.y - sh * 30)); M.cam.lookAt(V3);
    own.root.visible = false; r.shadowMap.autoUpdate = false;
    r.setRenderTarget(M.rt); r.render(this.scene, M.cam); r.setRenderTarget(null);
    own.root.visible = true; r.shadowMap.autoUpdate = true;
    const w = this.canvas.clientWidth || 1, h = this.canvas.clientHeight || 1;
    if (M.ortho.right !== w || M.ortho.bottom !== -h) { M.ortho.right = w; M.ortho.bottom = -h; M.ortho.updateProjectionMatrix(); }
    r.autoClear = false; r.render(M.scene, M.ortho); r.autoClear = true;
  }

  // ---- the garage turntable
  setShowcase(on: boolean, looks: CarLook[] = []) {
    this.showcase = on;
    if (this.fall) this.fall.obj.visible = !on;
    if (!on) this.camera.clearViewOffset();
    this.world.visible = !on; this.sky.visible = !on; this.stars.visible = !on; this.glow.visible = !on; this.moonSprite.visible = !on; this.sun.visible = false;
    this.disposeGroup(this.show); this.show.clear();
    if (!on) { (this.scene.fog as T.FogExp2).density = this.fogBase; this.scene.background = null; for (const c of this.cars) c.root.visible = true; return; }
    for (const c of this.cars) c.root.visible = false;
    if (this.ghost) this.ghost.root.visible = false;
    (this.scene.fog as T.FogExp2).density = 0.0;
    this.scene.background = new T.Color(0x171428);
    const floor = new T.Mesh(new T.CircleGeometry(30, 48), toon(0x2a2438)); floor.rotation.x = -Math.PI / 2; this.show.add(floor);
    const disc = new T.Mesh(new T.CylinderGeometry(3.6, 3.7, 0.18, 48), toon(0x5b5170)); disc.position.y = 0.09; this.show.add(disc);
    const ring = new T.Mesh(new T.TorusGeometry(3.65, 0.05, 6, 64), new T.MeshBasicMaterial({ color: 0xffc66a })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.19; this.show.add(ring);
    const wall = new T.Mesh(new T.CylinderGeometry(18, 18, 14, 40, 1, true), new T.MeshBasicMaterial({ color: 0x241d36, side: T.BackSide })); wall.position.y = 7; this.show.add(wall);
    for (let k = 0; k < 9; k++) { const a = (k / 9) * Math.PI * 2; const s = new T.Mesh(new T.PlaneGeometry(2.6, 0.5), new T.MeshBasicMaterial({ color: k % 2 ? 0xffd9a0 : 0xfff2d8 })); s.position.set(Math.cos(a) * 17.6, 9, Math.sin(a) * 17.6); s.lookAt(0, 9, 0); this.show.add(s); }
    const n = looks.length;
    looks.forEach((l, i) => {
      const rig = buildCar(l, false); rig.root.position.set((i - (n - 1) / 2) * 5.2, 0.18, 0); rig.root.userData.spin = true; for (const o of rig.ink) o.visible = !this.lite; for (const p of rig.pops) p.rotation.z = 0;
      this.show.add(rig.root);
    });
    this.hemi.intensity = 1.6; this.hemi.color.set(0xffe3c4); this.moon.intensity = 1.8; this.moon.color.set(0xfff0de);
    this.moon.position.set(6, 12, 8); this.moon.target.position.set(0, 0, 0);
    this.showAngle = 0;
  }
  private renderShowcase(dt: number) {
    this.showAngle += dt * 0.5;
    let k = 0; const ch = this.show.children; for (let j = 0; j < ch.length; j++) { const o = ch[j]; if (o.userData.spin) { o.rotation.y = this.showAngle + k * 0.9; k++; } }
    const n = Math.max(1, k);
    const narrow = this.camera.aspect < 1.1, r = (narrow ? 11 : 9.5) + n * (narrow ? 4.2 : 3.4);
    this.camera.position.set(Math.sin(0.5) * r, 2.8 + n * 0.5, Math.cos(0.5) * r);
    this.camera.lookAt(0, 0.6, 0);
    // the car sits in the free part of the garage page: left of the parts on wide screens, above them on upright ones
    const w = this.canvas.clientWidth || 1, h = this.canvas.clientHeight || 1, ox = narrow || n > 1 ? 0 : w * 0.25, oy = n > 1 ? 0 : narrow ? h * 0.24 : -h * 0.04;
    const v = this.camera.view;
    if (!v || !v.enabled || v.offsetX !== ox || v.offsetY !== oy || v.fullWidth !== w || v.fullHeight !== h) this.camera.setViewOffset(w, h, ox, oy, w, h);
    if (this.camera.fov !== 42) { this.camera.fov = 42; this.camera.updateProjectionMatrix(); }
    this.renderer.render(this.scene, this.camera);
  }

  resize() {
    const w = this.canvas.clientWidth || 1, h = this.canvas.clientHeight || 1;
    this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    for (const m of [this.smoke.pts.material, this.sparks.pts.material] as T.ShaderMaterial[]) m.uniforms.scale.value = h * 0.5 * this.renderer.getPixelRatio();
    for (const m of this.glows) m.uniforms.scale.value = h * 0.5 * this.renderer.getPixelRatio();
    if (this.mirror.rect) this.setMirror(this.mirror.rect);
  }
  disposeGroup(o: T.Object3D) {
    const gs = new Set<T.BufferGeometry>(), ms = new Set<T.Material>();
    o.traverse((m) => { const mm = m as T.Mesh; if (mm.geometry && !mm.geometry.userData.keep) gs.add(mm.geometry); if (mm.material) for (const x of Array.isArray(mm.material) ? mm.material : [mm.material]) if (x !== INK && !x.userData.keep) ms.add(x); });
    gs.forEach((g) => g.dispose()); ms.forEach((m) => m.dispose());
  }
  dispose() { this.disposeGroup(this.scene); this.mirror.rt?.dispose(); this.renderer.dispose(); }
}
