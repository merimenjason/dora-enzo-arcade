import * as T from 'three';
import { OutlineEffect } from 'three/examples/jsm/effects/OutlineEffect.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createHuntChinchilla, animateHuntChinchilla, poseArms, type HuntChinchilla } from './hunt-chinchilla';
import {
  BALL_R, CUP_R, BUMPER_R, INTRO, TURN_INTRO, STEP_H, HEROES, gradient, tileHeight, playable, moverAt, windmillAngle, dist,
  type CourseId, type Hole, type HeroId, type PuttEvent, type PuttGame, type Tile, type Vec, type Edge,
} from './putt-game';

/** What the page tells the scene each frame, beyond the game itself. */
export type PuttView = { overview: boolean; dragging: boolean };
type Theme = { sky: string; fog: number; bg: number; hemi: [number, number, number]; sun: [number, number]; felt: number; rim: number; grass: number; night: boolean; tree: string; treeFallback: string };
const THEMES: Record<CourseId, Theme> = {
  clover: { sky: '/art/hunt/sky-meadow.webp', fog: 0xcfe3d6, bg: 0xb7d9ee, hemi: [0xeaf6ff, 0x7c9d55, 1.45], sun: [0xfff1da, 1.75], felt: 0x67b84e, rim: 0xd9a35a, grass: 0x9ccb6b, night: false, tree: '/art/hunt/leaf-cluster.webp', treeFallback: '/art/hunt/leaf-cluster.webp' },
  lantern: { sky: '/art/putt/sky-lantern.webp', fog: 0x7d6a9a, bg: 0x6c5b93, hemi: [0xd3c3ff, 0x40513f, 1.05], sun: [0xffd6b0, 1.25], felt: 0x58a35a, rim: 0xc98f4c, grass: 0x7aa36a, night: true, tree: '/art/hunt/leaf-cluster.webp', treeFallback: '/art/hunt/leaf-cluster.webp' },
};
const GROUND = -0.45, RAIL_H = 0.2, RAIL_T = 0.24, POST = 0.3, HERO_SCALE = 0.42;
const V = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);
const lerp = T.MathUtils.lerp, smooth = (t: number) => t * t * (3 - 2 * t);
const noOutline = <M extends T.Material>(m: M): M => { m.userData.outlineParameters = { visible: false }; return m; };
/** Deterministic scatter for decorations, so a hole always looks the same. */
function scatter(seed: string) { let s = 0; for (const ch of seed) s = (s * 31 + ch.charCodeAt(0)) >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

type HeroRig = { id: HeroId; model: HuntChinchilla; putter: T.Group; pos: T.Vector3; face: number; hop: { from: T.Vector3; to: T.Vector3; t: number; len: number } | null; cheer: number; swing: number; at: Vec | null };
type Particle = { mesh: T.Mesh; vel: T.Vector3; life: number; max: number; spin: number };

export type PuttScene = ReturnType<typeof createPuttScene>;

/** Drawing only. The page owns the clock and the game; this owns every GPU resource. */
export function createPuttScene(canvas: HTMLCanvasElement, ready: () => void, failed: (message: string) => void) {
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  const phone = matchMedia('(pointer:coarse)').matches || innerWidth < 700;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, phone ? 1.25 : 1.6));
  renderer.toneMapping = T.NoToneMapping; renderer.outputColorSpace = T.SRGBColorSpace; renderer.info.autoReset = false;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = phone ? T.BasicShadowMap : T.PCFSoftShadowMap;
  const outline = new OutlineEffect(renderer, { defaultThickness: 0.0042, defaultColor: [0.13, 0.09, 0.07] });
  const scene = new T.Scene(), camera = new T.PerspectiveCamera(52, 1, 0.08, 160);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const textures = new Set<T.Texture>(), materials = new Set<T.Material>(), geometries = new Set<T.BufferGeometry>();
  const loader = new T.TextureLoader();
  let closed = false, theme: CourseId | null = null, holeId = '', time = 0, frame = 0, firstFrame = false;

  const ramp = new T.DataTexture(new Uint8Array([96, 178, 255]), 3, 1, T.RedFormat);
  ramp.minFilter = ramp.magFilter = T.NearestFilter; ramp.generateMipmaps = false; ramp.needsUpdate = true; textures.add(ramp);
  const toon = (color: number, map: T.Texture | null = null, outlined = true) => { const m = new T.MeshToonMaterial({ color, gradientMap: ramp, map }); if (!outlined) noOutline(m); materials.add(m); return m; };
  const basic = (color: number, extra: T.MeshBasicMaterialParameters = {}) => { const m = noOutline(new T.MeshBasicMaterial({ color, ...extra })); materials.add(m); return m; };
  const geo = <G extends T.BufferGeometry>(g: G) => { geometries.add(g); return g; };
  // Lit from above, with a soft warm rim, the same as Grumble Hunt's critters.
  const fluffy = <M extends T.MeshToonMaterial>(m: M, rim = 0.3) => {
    m.onBeforeCompile = (shader) => {
      shader.vertexShader = 'varying float vUp;\n' + shader.vertexShader.replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nvUp = normalize(mat3(modelMatrix) * objectNormal).y;');
      shader.fragmentShader = 'varying float vUp;\n' + shader.fragmentShader
        .replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.rgb *= 0.8 + 0.28 * smoothstep(-0.7, 0.8, vUp);')
        .replace('#include <opaque_fragment>', `#include <opaque_fragment>\ngl_FragColor.rgb += vec3(1.0, 0.95, 0.86) * pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 2.5) * ${rim.toFixed(2)};`);
    };
    m.customProgramCacheKey = () => `fluffy${rim}`; return m;
  };
  /** A painted texture. Until it loads (or if it never does) it shows `start`, a plain white square by default, so the
   *  material's own colour shows; a missing file tries `fallback` next. */
  function paint(url: string, repeat: number, fallback?: string, start?: HTMLCanvasElement) {
    const t: T.Texture = new T.Texture(); t.image = start ?? blank(); t.needsUpdate = true; t.colorSpace = T.SRGBColorSpace; t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(repeat, repeat);
    t.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy()); textures.add(t);
    // WebGL 2 gives a texture fixed-size storage on first upload, so the placeholder's storage is freed before the painting goes in
    const load = (u: string, next?: string) => loader.load(u, (img) => { if (closed) { img.dispose(); return; } t.dispose(); t.image = img.image; t.needsUpdate = true; img.dispose(); }, undefined, () => { if (!closed && next) load(next); });
    load(url, fallback);
    return t;
  }
  function blank(clear = false) { const c = document.createElement('canvas'); c.width = c.height = 2; const x = c.getContext('2d')!; if (!clear) { x.fillStyle = '#fff'; x.fillRect(0, 0, 2, 2); } return c; }
  // A soft speckle for the felt before (or instead of) its painting.
  function noise(base: [number, number, number], spread: number, size = 128) {
    const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d')!, img = x.createImageData(size, size), rand = scatter(`noise${base}`);
    for (let i = 0; i < size * size; i++) { const n = (rand() - 0.5) * spread; img.data[i * 4] = base[0] + n; img.data[i * 4 + 1] = base[1] + n; img.data[i * 4 + 2] = base[2] + n * 0.6; img.data[i * 4 + 3] = 255; }
    x.putImageData(img, 0, 0); return c;
  }

  // ---------- lights, sky, ground (shared by every hole of a course) ----------
  const hemi = new T.HemisphereLight(0xffffff, 0x777777, 1.4); scene.add(hemi);
  const sun = new T.DirectionalLight(0xffffff, 1.6); sun.castShadow = true; sun.shadow.mapSize.setScalar(phone ? 1024 : 2048); sun.shadow.normalBias = 0.04; sun.shadow.bias = -0.0004;
  scene.add(sun, sun.target);
  let skyTexture: T.Texture | null = null;
  const feltMap = paint('/art/putt/tex-felt.webp', 1, undefined, noise([232, 238, 226], 26)), dustMap = paint('/art/putt/tex-dust.webp', 1), waterMap = paint('/art/putt/tex-water.webp', 1);
  const woodMap = paint('/art/putt/tex-wood.webp', 1, '/art/hunt/tex-bark.webp'), grassMap = paint('/art/hunt/tex-meadow-grass.webp', 40);
  const feltMat = toon(0xffffff, feltMap), dustMat = toon(0xf4e3c2, dustMap), bedMat = toon(0x2f6f6c, null, false), woodMat = toon(0xe0b77a, woodMap), postMat = toon(0xc79457, woodMap);
  const waterMat = noOutline(new T.MeshToonMaterial({ color: 0xbfeee8, gradientMap: ramp, map: waterMap, transparent: true, opacity: 0.88 })); materials.add(waterMat);
  const grassMat = toon(0xffffff, grassMap, false);
  const hayMat = toon(0xe8c56a, paint('/art/putt/tex-wood.webp', 1, '/art/hunt/tex-bark.webp'));
  const ground = new T.Mesh(geo(new T.PlaneGeometry(160, 160)), grassMat); ground.rotation.x = -Math.PI / 2; ground.position.y = GROUND; ground.receiveShadow = true; scene.add(ground);
  feltMap.repeat.set(1, 1);

  function setTheme(id: CourseId) {
    if (theme === id) return; theme = id; const th = THEMES[id];
    hemi.color.setHex(th.hemi[0]); hemi.groundColor.setHex(th.hemi[1]); hemi.intensity = th.hemi[2];
    sun.color.setHex(th.sun[0]); sun.intensity = th.sun[1];
    scene.background = new T.Color(th.bg); scene.fog = new T.Fog(th.fog, 30, 95);
    feltMat.color.setHex(th.felt); feltMat.needsUpdate = true; grassMat.color.setHex(th.grass);
    if (skyTexture) { textures.delete(skyTexture); skyTexture.dispose(); skyTexture = null; }
    const want = id;
    loader.load(th.sky, (t) => {
      if (closed || theme !== want) { t.dispose(); return; }
      t.mapping = T.EquirectangularReflectionMapping; t.colorSpace = T.SRGBColorSpace; textures.add(t); skyTexture = t; scene.background = t;
    }, undefined, () => {});
    for (const l of lanternLights) l.visible = th.night;
  }
  // Two warm lights that follow the lanterns on the dusk course.
  const lanternLights = [new T.PointLight(0xffc27a, 3.5, 9, 1.6), new T.PointLight(0xffc27a, 3.5, 9, 1.6)];
  for (const l of lanternLights) { l.visible = false; scene.add(l); }

  // ---------- shared props ----------
  const ballGeo = geo(new T.SphereGeometry(BALL_R, 24, 16));
  const ball = new T.Mesh(ballGeo, toon(0xfffdf6)); ball.castShadow = true; scene.add(ball);
  // a band in the putter's colour, so the roll shows and each friend knows their ball
  const bandMats: Record<HeroId, T.MeshToonMaterial> = { dora: toon(new T.Color(HEROES.dora.ball).getHex(), null, false), enzo: toon(new T.Color(HEROES.enzo.ball).getHex(), null, false) };
  const band = new T.Mesh(geo(new T.TorusGeometry(BALL_R * 0.985, 0.03, 8, 28)), bandMats.dora); ball.add(band);
  let ballY = 0, ballFall = 0; const spin = new T.Quaternion(), lastBall = V();

  const guideGeo = geo(new T.CircleGeometry(0.045, 10)); guideGeo.rotateX(-Math.PI / 2);
  const guideOn = basic(0xffffff, { transparent: true, opacity: 0.95, depthWrite: false }), guideDim = basic(0xffffff, { transparent: true, opacity: 0.4, depthWrite: false });
  // two instanced sets of dots, bright before the first bounce and dim after it, so the whole line is two draw calls
  const DOTS = 60, dotSets = [guideOn, guideDim].map((mat) => { const m = new T.InstancedMesh(guideGeo, mat, DOTS); m.count = 0; m.renderOrder = 2; m.frustumCulled = false; scene.add(m); return m; });
  const dotAt = new T.Object3D();
  const ringGeo = geo(new T.RingGeometry(0.2, 0.26, 28)); ringGeo.rotateX(-Math.PI / 2);
  const aimRing = new T.Mesh(ringGeo, basic(0xffffff, { transparent: true, opacity: 0.85, depthWrite: false })); aimRing.visible = false; scene.add(aimRing);

  // chinchillas with putters
  const heroes: Record<HeroId, HeroRig> = { dora: makeHero('dora'), enzo: makeHero('enzo') };
  function makeHero(id: HeroId): HeroRig {
    const model = createHuntChinchilla(id === 'dora', (m) => fluffy(m, 0.3)); model.root.scale.setScalar(HERO_SCALE); scene.add(model.root);
    model.root.traverse((o) => { if ((o as T.Mesh).isMesh) { (o as T.Mesh).castShadow = true; } });
    const putter = new T.Group(); model.body.add(putter); putter.position.set(0.5, 0.52, 0);
    const shaft = new T.Mesh(geo(new T.CylinderGeometry(0.035, 0.035, 0.56, 8)), toon(0x8a5a32));
    shaft.position.set(0.18, -0.21, 0); shaft.rotation.z = Math.atan2(0.36, 0.42); putter.add(shaft);
    const head = new T.Mesh(geo(new T.BoxGeometry(0.34, 0.12, 0.1)), toon(0xd9b04a)); head.position.set(0.38, -0.42, 0); putter.add(head);
    const grip = new T.Mesh(geo(new T.CylinderGeometry(0.05, 0.05, 0.16, 8)), toon(id === 'dora' ? 0xe0708a : 0x5f7db0)); grip.position.set(0.03, -0.035, 0); grip.rotation.z = Math.atan2(0.36, 0.42); putter.add(grip);
    return { id, model, putter, pos: V(), face: 0, hop: null, cheer: 0, swing: -1, at: null };
  }

  // particles: confetti, splash drops, dust puffs and sparkles share one pool
  const partGeo = geo(new T.PlaneGeometry(0.09, 0.06));
  const partMats = { confetti: [0x7cc76b, 0xf6a9b8, 0xfff1a8, 0x9fd0f2].map((c) => basic(c, { side: T.DoubleSide })), drop: [basic(0x9fe3ef, { side: T.DoubleSide })], dust: [basic(0xf3e2bf, { side: T.DoubleSide, transparent: true, opacity: 0.8 })], spark: [basic(0xffe58a, { side: T.DoubleSide })] };
  const particles: Particle[] = Array.from({ length: 90 }, () => { const mesh = new T.Mesh(partGeo, partMats.confetti[0]); mesh.visible = false; scene.add(mesh); return { mesh, vel: V(), life: 0, max: 1, spin: 0 }; });
  let nextParticle = 0;
  function burst(kind: keyof typeof partMats, at: T.Vector3, n: number, speed: number, up: number, life = 1.2) {
    if (reduced.matches) n = Math.ceil(n / 3);
    for (let i = 0; i < n; i++) {
      const p = particles[nextParticle++ % particles.length], a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random() * 0.6);
      p.mesh.material = partMats[kind][i % partMats[kind].length]; p.mesh.position.copy(at); p.mesh.visible = true;
      p.vel.set(Math.cos(a) * s, up * (0.6 + Math.random() * 0.6), Math.sin(a) * s); p.life = p.max = life * (0.7 + Math.random() * 0.5); p.spin = (Math.random() - 0.5) * 12;
    }
  }
  const ripple = new T.Mesh(geo(new T.RingGeometry(0.2, 0.28, 32)), basic(0xffffff, { transparent: true, opacity: 0, depthWrite: false })); ripple.geometry.rotateX(-Math.PI / 2); scene.add(ripple); let rippleT = -1;

  // ---------- the hole itself, rebuilt for each hole ----------
  let holeRoot = new T.Group(); scene.add(holeRoot);
  let holeGeos: T.BufferGeometry[] = [];
  let sails: { group: T.Group; spec: Hole['windmills'][number] }[] = [], movers: { group: T.Group; legs: T.Object3D[]; spec: Hole['movers'][number]; zzz: T.Sprite | null }[] = [];
  let bumperRigs: { cap: T.Object3D; t: number; at: Vec }[] = [], acornRig: T.Group | null = null, flag: T.Group | null = null, flagLift = 0;
  let water: T.Mesh | null = null, lanternBits: T.Mesh[] = [], fireflies: T.Points | null = null;
  const hg = <G extends T.BufferGeometry>(g: G) => { holeGeos.push(g); return g; };

  function moundAt(h: Hole, x: number, z: number) { let s = 0; for (const m of h.spec.mounds ?? []) s += m.h * Math.exp(-((x - m.x) ** 2 + (z - m.z) ** 2) / (m.r * m.r)); return s; }
  function surface(h: Hole, t: Tile, x: number, z: number) { return tileHeight(t, x, z) + moundAt(h, x, z); }
  /** The tile's top as triangles (only the open half of a corner tile), subdivided when mounds curve it. */
  function tileTriangles(h: Hole, t: Tile, lift: number, out: { pos: number[]; nrm: number[]; uv: number[] }) {
    const n = (h.spec.mounds?.length ? 5 : 1), c = t.c, r = t.r;
    const tris: [number, number][][] = [];
    const NW: [number, number] = [c, r], NE: [number, number] = [c + 1, r], SW: [number, number] = [c, r + 1], SE: [number, number] = [c + 1, r + 1];
    // every triangle is listed anticlockwise seen from above, so its face points up
    if (t.corner === 'nw') tris.push([NE, SW, SE]); else if (t.corner === 'se') tris.push([NW, SW, NE]);
    else if (t.corner === 'ne') tris.push([NW, SW, SE]); else if (t.corner === 'sw') tris.push([NW, SE, NE]);
    else tris.push([NW, SW, NE], [NE, SW, SE]);
    for (const [a, b, d] of tris) {
      // barycentric grid of n×n little triangles
      const P = (i: number, j: number): [number, number] => { const u = i / n, v = j / n; return [a[0] + (b[0] - a[0]) * u + (d[0] - a[0]) * v, a[1] + (b[1] - a[1]) * u + (d[1] - a[1]) * v]; };
      const vert = ([x, z]: [number, number]) => {
        const y = surface(h, t, x, z) + lift, [gx, gz] = gradient(h, Math.min(c + 0.999, Math.max(c + 0.001, x)), Math.min(r + 0.999, Math.max(r + 0.001, z)));
        const nv = V(-gx, 1, -gz).normalize(); out.pos.push(x, y, z); out.nrm.push(nv.x, nv.y, nv.z); out.uv.push(x * 0.5, z * 0.5);
      };
      for (let i = 0; i < n; i++) for (let j = 0; j < n - i; j++) {
        vert(P(i, j)); vert(P(i + 1, j)); vert(P(i, j + 1));
        if (j < n - i - 1) { vert(P(i + 1, j)); vert(P(i + 1, j + 1)); vert(P(i, j + 1)); }
      }
    }
  }
  function meshFrom(data: { pos: number[]; nrm: number[]; uv: number[] }, mat: T.Material, shadow = true) {
    const g = hg(new T.BufferGeometry());
    g.setAttribute('position', new T.Float32BufferAttribute(data.pos, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(data.nrm, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(data.uv, 2));
    const m = new T.Mesh(g, mat); m.receiveShadow = shadow; holeRoot.add(m); return m;
  }
  /** A box stretched between two points along the ground, with its own bottom and top heights at each end (ramps tilt it). */
  function slab(ax: number, az: number, bx: number, bz: number, half: number, bottomA: number, bottomB: number, topA: number, topB: number) {
    const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz) || 1, nx = -dz / len * half, nz = dx / len * half;
    const c = [
      [ax - nx, bottomA, az - nz], [bx - nx, bottomB, bz - nz], [bx + nx, bottomB, bz + nz], [ax + nx, bottomA, az + nz],
      [ax - nx, topA, az - nz], [bx - nx, topB, bz - nz], [bx + nx, topB, bz + nz], [ax + nx, topA, az + nz],
    ];
    const faces = [[0, 1, 5, 4], [2, 3, 7, 6], [4, 5, 6, 7], [3, 0, 4, 7], [1, 2, 6, 5]];
    const pos: number[] = [], uv: number[] = [];
    for (const f of faces) {
      const q = f.map((i) => c[i]), w = Math.hypot(q[1][0] - q[0][0], q[1][2] - q[0][2]) || half * 2, hgt = Math.max(0.05, q[3][1] - q[0][1]);
      const uvs = [[0, 0], [w * 0.6, 0], [w * 0.6, hgt * 0.6], [0, hgt * 0.6]];
      for (const k of [0, 1, 2, 0, 2, 3]) { pos.push(...q[k]); uv.push(...uvs[k]); }
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    // a wound-in-reverse face would look inside out: make every face point away from the box's middle
    const mid = V((ax + bx) / 2, (bottomA + topA + bottomB + topB) / 4, (az + bz) / 2), p = g.getAttribute('position') as T.BufferAttribute, nAttr = g.getAttribute('normal') as T.BufferAttribute;
    for (let i = 0; i < p.count; i += 3) {
      const a = V().fromBufferAttribute(p, i), b = V().fromBufferAttribute(p, i + 1), d = V().fromBufferAttribute(p, i + 2);
      const n = b.clone().sub(a).cross(d.clone().sub(a)).normalize(), centreTri = a.clone().add(b).add(d).divideScalar(3);
      if (n.dot(centreTri.sub(mid)) < 0) { p.setXYZ(i + 1, d.x, d.y, d.z); p.setXYZ(i + 2, b.x, b.y, b.z); const uvA = g.getAttribute('uv') as T.BufferAttribute; const u1 = [uvA.getX(i + 1), uvA.getY(i + 1)]; uvA.setXY(i + 1, uvA.getX(i + 2), uvA.getY(i + 2)); uvA.setXY(i + 2, u1[0], u1[1]); n.negate(); }
      for (let k = 0; k < 3; k++) nAttr.setXYZ(i + k, n.x, n.y, n.z);
    }
    return g;
  }

  function clearHole() {
    holeRoot.traverse((o) => { const s = o as T.Sprite; if (s.isSprite && s.material) { s.material.dispose(); } });
    scene.remove(holeRoot); for (const g of holeGeos) g.dispose(); holeGeos = []; holeRoot = new T.Group(); scene.add(holeRoot);
    sails = []; movers = []; bumperRigs = []; acornRig = null; flag = null; water = null; lanternBits = []; fireflies = null;
  }

  const mushroomCap = toon(0xd8473a), mushroomStem = toon(0xf6ead2), spotMat = toon(0xffffff, null, false), darkMat = basic(0x221a12), rimMat = toon(0xf2efe2, null, false);
  const thatchMat = toon(0xd9b25a), wallMat = toon(0xf1dcb5), sailMat = toon(0xfaf3e6), sailFrame = toon(0x8a5a32), dirtMat = toon(0x9b6b43), goldMat = toon(0xf2c440), capMat = toon(0x8a5a32);
  // a soft round glow for the fireflies (points are square without one)
  const glowDot = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d')!, g = x.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.8)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 32, 32);
    const t = new T.CanvasTexture(c); textures.add(t); return t;
  })();
  const lanternMat = basic(0xffb75e), stringMat = basic(0x3b2a20), chevronMat = basic(0xe9f6c8, { transparent: true, opacity: 0.75, depthWrite: false });
  const boarMat = fluffy(toon(0x9a6a45)), boarBelly = fluffy(toon(0xd6a77a)), snoutMat = toon(0xe7a3a0), tuskMat = toon(0xfff3dc), bristleMat = toon(0x4a3326);
  const zzzMap = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d')!; x.font = 'bold 46px Georgia, serif'; x.fillStyle = '#ffffff'; x.strokeStyle = '#3b2a20'; x.lineWidth = 6; x.textAlign = 'center'; x.textBaseline = 'middle'; x.strokeText('z', 32, 34); x.fillText('z', 32, 34); const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; textures.add(t); return t; })();
  const cardCache = new Map<string, T.Texture>();
  const card = (url: string, fallback: string) => { let t = cardCache.get(url); if (!t) { t = paint(url, 1, fallback, blank(true)); t.wrapS = t.wrapT = T.ClampToEdgeWrapping; cardCache.set(url, t); } return t; };

  function buildHole(game: PuttGame) {
    const h = game.hole, th = THEMES[game.course ?? courseFor(h.id)];
    clearHole(); holeId = h.id;
    // felt, dust and pond beds
    const felt = { pos: [] as number[], nrm: [] as number[], uv: [] as number[] }, dust = { pos: [] as number[], nrm: [] as number[], uv: [] as number[] }, bed = { pos: [] as number[], nrm: [] as number[], uv: [] as number[] }, pond = { pos: [] as number[], nrm: [] as number[], uv: [] as number[] };
    for (const row of h.tiles) for (const t of row) {
      if (t.kind === 'felt') tileTriangles(h, t, 0, felt);
      else if (t.kind === 'sand') tileTriangles(h, t, -0.012, dust);
      else if (t.kind === 'water') { tileTriangles(h, t, -0.2, bed); tileTriangles(h, t, -0.07, pond); }
    }
    meshFrom(felt, feltMat); if (dust.pos.length) meshFrom(dust, dustMat);
    // pale chevrons painted up each ramp, pointing uphill
    const chev = { pos: [] as number[], nrm: [] as number[], uv: [] as number[] };
    for (const row of h.tiles) for (const t of row) if (t.ramp) {
      const up = { e: [1, 0], w: [-1, 0], n: [0, -1], s: [0, 1] }[t.ramp], side = [-up[1], up[0]], cx = t.c + 0.5, cz = t.r + 0.5;
      for (const k of [-0.18, 0.18]) {
        const tip = [cx + up[0] * (k + 0.12), cz + up[1] * (k + 0.12)];
        for (const sgn of [-1, 1]) {
          const end = [cx + up[0] * (k - 0.1) + side[0] * 0.28 * sgn, cz + up[1] * (k - 0.1) + side[1] * 0.28 * sgn];
          const dx = end[0] - tip[0], dz = end[1] - tip[1], l = Math.hypot(dx, dz), nx = (-dz / l) * 0.045, nz = (dx / l) * 0.045;
          const quad = [[tip[0] - nx, tip[1] - nz], [end[0] - nx, end[1] - nz], [end[0] + nx, end[1] + nz], [tip[0] + nx, tip[1] + nz]];
          // keep the winding anticlockwise from above, whichever way the stroke runs
          const area = (quad[1][0] - quad[0][0]) * (quad[2][1] - quad[0][1]) - (quad[2][0] - quad[0][0]) * (quad[1][1] - quad[0][1]);
          const order = area < 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
          for (const i of order) { const [x, z] = quad[i]; chev.pos.push(x, surface(h, t, x, z) + 0.006, z); chev.nrm.push(0, 1, 0); chev.uv.push(0, 0); }
        }
      }
    }
    if (chev.pos.length) meshFrom(chev, chevronMat, false);
    if (bed.pos.length) { meshFrom(bed, bedMat); water = meshFrom(pond, waterMat, false); }
    // rails on walls (merged runs), cliff faces under ledges, and fence posts where runs end
    const runs = railRuns(h), slabs: T.BufferGeometry[] = [], posts = new Map<string, { x: number; z: number; top: number; low: number }>();
    for (const r of runs) {
      if (r.drop) { slabs.push(slab(r.ax, r.az, r.bx, r.bz, 0.03, r.lowA, r.lowB, r.topA, r.topB)); continue; }
      slabs.push(slab(r.ax, r.az, r.bx, r.bz, RAIL_T / 2, r.lowA < 0 ? GROUND : r.lowA, r.lowB < 0 ? GROUND : r.lowB, r.topA + RAIL_H, r.topB + RAIL_H));
      for (const [x, z, top, low] of [[r.ax, r.az, r.topA, r.lowA], [r.bx, r.bz, r.topB, r.lowB]]) {
        const k = `${x},${z}`, old = posts.get(k), lo = low < 0 ? GROUND : low;
        posts.set(k, { x, z, top: Math.max(top, old?.top ?? -9), low: Math.min(lo, old?.low ?? 9) });
      }
    }
    for (const p of posts.values()) slabs.push(slab(p.x - POST / 2, p.z, p.x + POST / 2, p.z, POST / 2, p.low, p.low, p.top + RAIL_H + 0.06, p.top + RAIL_H + 0.06));
    // the solid half of each corner tile is a wooden block level with the rails
    for (const row of h.tiles) for (const t of row) if (t.corner) {
      const top = t.level * STEP_H + RAIL_H, c = t.c, r = t.r;
      const tri: [number, number][] = t.corner === 'nw' ? [[c, r], [c + 1, r], [c, r + 1]] : t.corner === 'ne' ? [[c, r], [c + 1, r], [c + 1, r + 1]] : t.corner === 'sw' ? [[c, r], [c, r + 1], [c + 1, r + 1]] : [[c + 1, r], [c + 1, r + 1], [c, r + 1]];
      const shape = new T.Shape(tri.map(([x, z]) => new T.Vector2(x, -z)));
      const g = new T.ExtrudeGeometry(shape, { depth: top - GROUND, bevelEnabled: false }); g.rotateX(-Math.PI / 2); g.translate(0, GROUND, 0);
      g.deleteAttribute('uv'); const uvs: number[] = []; const p = g.getAttribute('position'); for (let i = 0; i < p.count; i++) uvs.push((p.getX(i) + p.getZ(i)) * 0.6, p.getY(i) * 0.6); g.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
      slabs.push(g.toNonIndexed());
    }
    if (slabs.length) { const g = hg(mergeGeometries(slabs.map((s) => (s.index ? s.toNonIndexed() : s)))!); for (const s of slabs) s.dispose(); const m = new T.Mesh(g, woodMat); m.castShadow = m.receiveShadow = true; holeRoot.add(m); }
    // hay bales on '#' tiles that are not part of a windmill
    const millTiles = new Set<string>();
    for (const m of h.windmills) { const [c, r] = m.at; for (const k of m.axis === 'ns' ? [[c - 1, r], [c + 1, r]] : [[c, r - 1], [c, r + 1]]) millTiles.add(k.join()); }
    const baleGeo = hg(new T.BoxGeometry(0.96, 0.7, 0.96));
    for (const row of h.tiles) for (const t of row) if (t.kind === 'block' && !millTiles.has(`${t.c},${t.r}`)) {
      const lvl = neighbourLevel(h, t), b = new T.Mesh(baleGeo, hayMat); b.position.set(t.c + 0.5, lvl + 0.35 - 0.05, t.r + 0.5); b.castShadow = b.receiveShadow = true; holeRoot.add(b);
      const foot = new T.Mesh(baleGeo, woodMat); foot.scale.set(1, Math.max(0.01, (lvl - GROUND) / 0.7), 1); foot.position.set(t.c + 0.5, (lvl + GROUND) / 2 - 0.05, t.r + 0.5); holeRoot.add(foot);
    }
    // windmills
    for (const m of h.windmills) holeRoot.add(windmill(h, m));
    // mushroom bumpers
    const stemGeo = hg(new T.CylinderGeometry(0.15, 0.19, 0.3, 14)), capGeo = hg(new T.SphereGeometry(BUMPER_R + 0.06, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2)), spotGeo = hg(new T.SphereGeometry(0.05, 8, 6));
    for (const b of h.bumpers) {
      const t = tileAtVec(h, b), y = t ? surface(h, t, b.x, b.z) : 0, g = new T.Group(); g.position.set(b.x, y, b.z);
      const stem = new T.Mesh(stemGeo, mushroomStem); stem.position.y = 0.15; g.add(stem);
      const cap = new T.Group(); cap.position.y = 0.28; g.add(cap);
      const dome = new T.Mesh(capGeo, mushroomCap); dome.scale.y = 0.72; cap.add(dome);
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + 0.3, s = new T.Mesh(spotGeo, spotMat); s.position.set(Math.cos(a) * 0.22, 0.14 + (i % 2) * 0.05, Math.sin(a) * 0.22); s.scale.set(1, 0.5, 1); cap.add(s); }
      const top = new T.Mesh(spotGeo, spotMat); top.position.y = 0.26; top.scale.set(1.3, 0.5, 1.3); cap.add(top);
      g.traverse((o) => { if ((o as T.Mesh).isMesh) (o as T.Mesh).castShadow = true; });
      holeRoot.add(g); bumperRigs.push({ cap, t: 0, at: b });
    }
    // cup and flag
    const cupT = tileAtVec(h, h.cup)!, cupY = surface(h, cupT, h.cup.x, h.cup.z);
    const hole = new T.Mesh(hg(new T.CircleGeometry(CUP_R, 28)), darkMat); hole.rotation.x = -Math.PI / 2; hole.position.set(h.cup.x, cupY + 0.006, h.cup.z); holeRoot.add(hole);
    const rim = new T.Mesh(hg(new T.RingGeometry(CUP_R, CUP_R + 0.035, 28)), rimMat); rim.rotation.x = -Math.PI / 2; rim.position.set(h.cup.x, cupY + 0.007, h.cup.z); holeRoot.add(rim);
    flag = new T.Group(); flag.position.set(h.cup.x, cupY, h.cup.z); holeRoot.add(flag);
    const pole = new T.Mesh(hg(new T.CylinderGeometry(0.025, 0.025, 1.5, 8)), toon(0xfaf6ee)); pole.position.y = 0.75; flag.add(pole);
    const cloth = new T.Mesh(hg(flagGeometry()), toon(th.night ? 0xffb75e : 0xe9584a)); cloth.position.set(0, 1.3, 0); flag.add(cloth);
    const num = new T.Sprite(new T.SpriteMaterial({ map: numberTexture(game.holeIndex + 1, game.practice ? holeNumber(h.id) : game.holeIndex + 1), transparent: true, depthWrite: false })); noOutline(num.material); num.scale.setScalar(0.32); num.position.set(0.24, 1.3, 0.04); flag.add(num);
    flag.traverse((o) => { if ((o as T.Mesh).isMesh) (o as T.Mesh).castShadow = true; });
    // burrows: a ring of dug earth around a dark hole, at both ends
    const moundGeo = hg(new T.TorusGeometry(0.33, 0.1, 8, 20)), holeGeo = hg(new T.CircleGeometry(0.3, 20));
    for (const tn of h.tunnels) for (const [p, out] of [[tn.from, false], [tn.to, true]] as [Vec, boolean][]) {
      const t = tileAtVec(h, p)!, y = surface(h, t, p.x, p.z), g = new T.Group(); g.position.set(p.x, y, p.z);
      const ring = new T.Mesh(moundGeo, dirtMat); ring.rotation.x = -Math.PI / 2; ring.scale.z = out ? 0.6 : 0.9; g.add(ring);
      const dark = new T.Mesh(holeGeo, darkMat); dark.rotation.x = -Math.PI / 2; dark.position.y = 0.008; g.add(dark);
      if (out) { const arrow = new T.Mesh(hg(new T.ConeGeometry(0.09, 0.2, 3)), toon(0xfff1c4, null, false)); arrow.rotation.set(Math.PI / 2, 0, -Math.atan2(tn.dir.x, -tn.dir.z)); arrow.position.set(tn.dir.x * 0.5, 0.03, tn.dir.z * 0.5); arrow.rotation.order = 'YXZ'; arrow.rotation.set(-Math.PI / 2, Math.atan2(-tn.dir.x, -tn.dir.z), 0); g.add(arrow); }
      holeRoot.add(g);
    }
    // the golden acorn
    if (h.acorn) {
      acornRig = new T.Group(); const t = tileAtVec(h, h.acorn)!; acornRig.position.set(h.acorn.x, surface(h, t, h.acorn.x, h.acorn.z) + 0.24, h.acorn.z);
      const nut = new T.Mesh(hg(new T.SphereGeometry(0.11, 16, 12)), goldMat); nut.scale.set(1, 1.25, 1); nut.position.y = -0.03; acornRig.add(nut);
      const cap = new T.Mesh(hg(new T.SphereGeometry(0.12, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2)), capMat); cap.position.y = 0.05; cap.scale.y = 0.7; acornRig.add(cap);
      const stem = new T.Mesh(hg(new T.CylinderGeometry(0.015, 0.02, 0.08, 6)), capMat); stem.position.y = 0.15; acornRig.add(stem);
      holeRoot.add(acornRig);
    }
    // sleepwalkers and rolling bales
    for (const spec of h.movers) movers.push(spec.kind === 'boar' ? bristleback(spec) : bale(spec));
    decorate(h, th);
    // fit the sun's shadow to this hole
    const cx = h.w / 2, cz = h.d / 2, span = Math.max(h.w, h.d) / 2 + 3;
    sun.position.set(cx + 8, 16, cz + 10); sun.target.position.set(cx, 0, cz);
    Object.assign(sun.shadow.camera, { left: -span, right: span, top: span, bottom: -span, near: 1, far: 50 }); sun.shadow.camera.updateProjectionMatrix();
    cam.snap = true;
  }
  function courseFor(id: string): CourseId { return id.startsWith('lantern') ? 'lantern' : 'clover'; }
  function holeNumber(id: string) { return Number(id.split('-')[1]) || 1; }
  function tileAtVec(h: Hole, p: Vec) { return h.tiles[Math.floor(p.z)]?.[Math.floor(p.x)] ?? null; }
  function neighbourLevel(h: Hole, t: Tile) { let lvl = 0; for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = h.tiles[t.r + dr]?.[t.c + dc]; if (playable(n)) lvl = Math.max(lvl, n.level * STEP_H); } return lvl; }
  /** Edges joined into runs for drawing: same line, same kind, touching, and the same height where they meet. */
  function railRuns(h: Hole): Edge[] {
    const list = h.edges.filter((e) => !e.diagonal).map((e) => ({ ...e })), out: Edge[] = [];
    const norm = (e: Edge) => { if (e.ax > e.bx || e.az > e.bz) { [e.ax, e.bx] = [e.bx, e.ax]; [e.az, e.bz] = [e.bz, e.az]; [e.topA, e.topB] = [e.topB, e.topA]; [e.lowA, e.lowB] = [e.lowB, e.lowA]; } return e; };
    const groups = new Map<string, Edge[]>();
    for (const e of list.map(norm)) { const k = `${e.az === e.bz ? 'z' + e.az : 'x' + e.ax}|${e.drop}|${e.lowA < 0}`; (groups.get(k) ?? groups.set(k, []).get(k)!).push(e); }
    for (const g of groups.values()) {
      g.sort((p, q) => p.ax - q.ax || p.az - q.az);
      let cur = g[0];
      for (const e of g.slice(1)) {
        if (Math.abs(e.ax - cur.bx) < 1e-9 && Math.abs(e.az - cur.bz) < 1e-9 && Math.abs(e.topA - cur.topB) < 1e-9 && Math.abs(e.lowA - cur.lowB) < 1e-9 && Math.abs(e.topA - e.topB) < 1e-9 && Math.abs(cur.topA - cur.topB) < 1e-9 && Math.abs(e.lowA - e.lowB) < 1e-9) { cur = { ...cur, bx: e.bx, bz: e.bz, topB: e.topB, lowB: e.lowB }; }
        else { out.push(cur); cur = e; }
      }
      out.push(cur);
    }
    for (const e of h.edges) if (e.diagonal) out.push({ ...e, topA: e.topA, topB: e.topB });
    return out;
  }
  function flagGeometry() {
    const g = new T.BufferGeometry(), p: number[] = [];
    for (let i = 0; i < 6; i++) { const x0 = (i / 6) * 0.5, x1 = ((i + 1) / 6) * 0.5, h0 = 0.17 * (1 - i / 6), h1 = 0.17 * (1 - (i + 1) / 6); p.push(x0, -h0, 0, x1, -h1, 0, x1, h1, 0, x0, -h0, 0, x1, h1, 0, x0, h0, 0); }
    g.setAttribute('position', new T.Float32BufferAttribute(p, 3)); g.computeVertexNormals(); return g;
  }
  const numberTextures = new Map<number, T.Texture>();
  function numberTexture(_i: number, n: number) {
    let t = numberTextures.get(n); if (t) return t;
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d')!;
    x.font = 'bold 40px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineWidth = 6; x.strokeStyle = '#5b2b22'; x.fillStyle = '#fff8e8'; x.strokeText(String(n), 32, 34); x.fillText(String(n), 32, 34);
    t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; textures.add(t); numberTextures.set(n, t); return t;
  }
  function windmill(h: Hole, m: Hole['windmills'][number]) {
    const g = new T.Group(), [c, r] = m.at, t = h.tiles[r][c], y = t.level * STEP_H;
    g.position.set(c + 0.5, y, r + 0.5); if (m.axis === 'ew') g.rotation.y = Math.PI / 2;
    // the house spans three tiles across the lane; the middle one is the door
    const side = hg(new T.BoxGeometry(1, 1.5, 0.9));
    for (const s of [-1, 1]) { const w = new T.Mesh(side, wallMat); w.position.set(s * 1, 0.75, 0); w.castShadow = w.receiveShadow = true; g.add(w); }
    const lintel = new T.Mesh(hg(new T.BoxGeometry(1, 0.95, 0.9)), wallMat); lintel.position.set(0, 1.025, 0); lintel.castShadow = true; g.add(lintel);
    // the footing stops just under the felt, so it never shows through the doorway
    const footH = Math.max(0.01, y - GROUND - 0.03), footG = hg(new T.BoxGeometry(3, footH, 0.9)); const foot = new T.Mesh(footG, woodMat); foot.position.set(0, GROUND - y + footH / 2, 0); g.add(foot);
    const roofShape = new T.Shape([new T.Vector2(-1.75, 0), new T.Vector2(1.75, 0), new T.Vector2(0, 1.25)]);
    const roof = new T.Mesh(hg(new T.ExtrudeGeometry(roofShape, { depth: 1.2, bevelEnabled: false })), thatchMat); roof.position.set(0, 1.5, -0.6); roof.castShadow = true; g.add(roof);
    // sails turn in the plane facing the tee; `front` is which way that is
    const sailRoot = new T.Group(); sailRoot.position.set(0, 1.52, 0.5 * m.front); g.add(sailRoot);
    const hub = new T.Mesh(hg(new T.CylinderGeometry(0.13, 0.13, 0.16, 12)), sailFrame); hub.rotation.x = Math.PI / 2; sailRoot.add(hub);
    const armG = hg(new T.BoxGeometry(0.07, 1.38, 0.05)), boardG = hg(new T.BoxGeometry(0.42, 1.05, 0.03));
    for (let k = 0; k < 4; k++) {
      const arm = new T.Group(); arm.rotation.z = (k * Math.PI) / 2; sailRoot.add(arm);
      const a = new T.Mesh(armG, sailFrame); a.position.y = -0.69; arm.add(a);
      const b = new T.Mesh(boardG, sailMat); b.position.set(0.12, -0.8, 0.02 * m.front); b.castShadow = true; arm.add(b);
    }
    sails.push({ group: sailRoot, spec: m });
    return g;
  }
  function bristleback(spec: Hole['movers'][number]) {
    const g = new T.Group(), s = spec.r / 0.42; g.scale.setScalar(s);
    const body = new T.Mesh(hg(new T.SphereGeometry(0.42, 20, 14)), boarMat); body.scale.set(1.25, 0.82, 0.9); body.position.y = 0.4; g.add(body);
    const belly = new T.Mesh(hg(new T.SphereGeometry(0.3, 16, 10)), boarBelly); belly.position.set(0.05, 0.3, 0); belly.scale.set(1.2, 0.7, 0.95); g.add(belly);
    const head = new T.Group(); head.position.set(0.5, 0.47, 0); g.add(head);
    head.add(new T.Mesh(hg(new T.SphereGeometry(0.26, 18, 12)), boarMat));
    const snout = new T.Mesh(hg(new T.CylinderGeometry(0.11, 0.13, 0.14, 14)), snoutMat); snout.rotation.z = Math.PI / 2; snout.position.set(0.25, -0.05, 0); head.add(snout);
    for (const z of [-1, 1]) {
      const tusk = new T.Mesh(hg(new T.ConeGeometry(0.03, 0.12, 6)), tuskMat); tusk.position.set(0.24, -0.1, z * 0.1); tusk.rotation.z = -0.4; head.add(tusk);
      const lid = new T.Mesh(hg(new T.BoxGeometry(0.03, 0.02, 0.09)), bristleMat); lid.position.set(0.21, 0.07, z * 0.12); lid.rotation.y = z * 0.4; head.add(lid);
      const ear = new T.Mesh(hg(new T.ConeGeometry(0.08, 0.16, 8)), boarMat); ear.position.set(-0.04, 0.22, z * 0.15); ear.rotation.x = z * 0.5; head.add(ear);
    }
    for (let i = 0; i < 6; i++) { const b = new T.Mesh(hg(new T.ConeGeometry(0.05, 0.16, 6)), bristleMat); b.position.set(0.3 - i * 0.12, 0.78 - Math.abs(i - 2) * 0.02, 0); g.add(b); }
    const legs: T.Object3D[] = [];
    for (const [x, z] of [[0.28, 0.2], [0.28, -0.2], [-0.28, 0.2], [-0.28, -0.2]]) { const l = new T.Mesh(hg(new T.CylinderGeometry(0.07, 0.06, 0.24, 8)), boarMat); l.position.set(x, 0.12, z); g.add(l); legs.push(l); }
    g.traverse((o) => { if ((o as T.Mesh).isMesh) (o as T.Mesh).castShadow = true; });
    const zzz = new T.Sprite(noOutline(new T.SpriteMaterial({ map: zzzMap, transparent: true, depthWrite: false }))); zzz.scale.setScalar(0.3); zzz.position.set(0.5, 1.1, 0); g.add(zzz);
    holeRoot.add(g);
    return { group: g, legs, spec, zzz };
  }
  function bale(spec: Hole['movers'][number]) {
    const g = new T.Group(), roll = new T.Mesh(hg(new T.CylinderGeometry(spec.r, spec.r, 0.9, 20)), hayMat); roll.rotation.x = Math.PI / 2; roll.position.y = spec.r; roll.castShadow = true; g.add(roll);
    holeRoot.add(g); return { group: g, legs: [roll], spec, zzz: null };
  }
  function decorate(h: Hole, th: Theme) {
    const rand = scatter(h.id), near = (x: number, z: number, pad: number) => {
      for (let dz = -pad; dz <= pad; dz += 0.5) for (let dx = -pad; dx <= pad; dx += 0.5) { const t = h.tiles[Math.floor(z + dz)]?.[Math.floor(x + dx)]; if (t && t.kind !== 'void') return true; }
      return false;
    };
    const tree = card(th.tree, th.treeFallback), flowers = card('/art/hunt/grass-tuft.webp', '/art/hunt/grass-tuft.webp'), shrooms = card('/art/hunt/card-mushrooms.webp', '/art/hunt/grass-tuft.webp');
    const sprite = (map: T.Texture, x: number, z: number, size: number) => { const m = noOutline(new T.SpriteMaterial({ map, transparent: true, alphaTest: 0.35, fog: true })); const s = new T.Sprite(m); s.center.set(0.5, 0.02); s.scale.setScalar(size); s.position.set(x, GROUND, z); holeRoot.add(s); return s; };
    const cx = h.w / 2, cz = h.d / 2, R = Math.max(h.w, h.d) / 2;
    let placed = 0;
    for (let i = 0; i < 60 && placed < 16; i++) { const a = rand() * Math.PI * 2, d = R + 2.5 + rand() * 7, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d; if (near(x, z, 2)) continue; sprite(tree, x, z, 3.2 + rand() * 1.6); placed++; }
    placed = 0;
    for (let i = 0; i < 80 && placed < 22; i++) { const x = -2 + rand() * (h.w + 4), z = -2 + rand() * (h.d + 4); if (near(x, z, 0.7)) continue; sprite(rand() < 0.75 ? flowers : shrooms, x, z, 0.8 + rand() * 0.5); placed++; }
    if (th.night) {
      // lantern strings on posts around the course, and a drift of fireflies
      const poleG = hg(new T.CylinderGeometry(0.05, 0.06, 2.4, 6)), lampG = hg(new T.SphereGeometry(0.13, 12, 8)), corners = [[-1.2, -1.2], [h.w + 1.2, -1.2], [h.w + 1.2, h.d + 1.2], [-1.2, h.d + 1.2]];
      corners.forEach(([x, z], i) => {
        const p = new T.Mesh(poleG, postMat); p.position.set(x, GROUND + 1.2, z); holeRoot.add(p);
        const [nx, nz] = corners[(i + 1) % 4], pts: T.Vector3[] = [];
        for (let k = 0; k <= 10; k++) { const f = k / 10, sag = Math.sin(f * Math.PI) * 0.45; pts.push(V(lerp(x, nx, f), GROUND + 2.3 - sag, lerp(z, nz, f))); }
        holeRoot.add(new T.Line(hg(new T.BufferGeometry().setFromPoints(pts)), stringMat));
        for (let k = 1; k < 10; k += 2) { const l = new T.Mesh(lampG, lanternMat); l.position.copy(pts[k]).add(V(0, -0.15, 0)); l.scale.y = 1.25; holeRoot.add(l); lanternBits.push(l); }
      });
      lanternLights[0].position.set(h.w * 0.25, 2.2, h.d * 0.3); lanternLights[1].position.set(h.w * 0.75, 2.2, h.d * 0.75);
      const n = phone ? 30 : 60, pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { pos[i * 3] = -3 + rand() * (h.w + 6); pos[i * 3 + 1] = 0.3 + rand() * 2; pos[i * 3 + 2] = -3 + rand() * (h.d + 6); }
      const fg = hg(new T.BufferGeometry()); fg.setAttribute('position', new T.BufferAttribute(pos, 3));
      fireflies = new T.Points(fg, noOutline(new T.PointsMaterial({ color: 0xfff0a0, map: glowDot, size: 0.12, transparent: true, opacity: 0.9, depthWrite: false })));
      materials.add(fireflies.material as T.Material); holeRoot.add(fireflies);
    }
  }

  // ---------- camera ----------
  const cam = { pos: V(0, 8, 12), look: V(), yaw: -Math.PI / 2, snap: true, orbit: 0 };
  function overviewPose(h: Hole, pos: T.Vector3, look: T.Vector3) {
    // far enough back that a circle round the whole hole fits the narrower side of the view, looking from the tee's side
    const cx = h.w / 2, cz = h.d / 2, radius = Math.hypot(h.w, h.d) / 2 + 0.6;
    const half = T.MathUtils.degToRad(camera.fov / 2), fit = Math.min(half, Math.atan(Math.tan(half) * camera.aspect));
    const far = radius / Math.sin(fit) * 0.92;
    const tee = h.tee, toTee = V(tee.x - cx, 0, tee.z - cz); if (toTee.lengthSq() < 0.01) toTee.set(0, 0, 1); toTee.normalize();
    const dir = V(toTee.x * 0.5, 1, toTee.z * 0.5).normalize();
    look.set(cx, 0.3, cz); pos.copy(look).addScaledVector(dir, far);
  }
  function aimPose(game: PuttGame, yaw: number, pos: T.Vector3, look: T.Vector3) {
    // over the putter's right shoulder: the chinchilla stands on the left of the line, so the camera leans right
    const b = game.ball, y = ballY, dx = Math.cos(yaw), dz = Math.sin(yaw), rx = -dz, rz = dx;
    // a tall phone screen sees less across, so the camera stands further back and higher
    const back = camera.aspect < 1 ? 1.4 : 1;
    pos.set(b.x - dx * 3.7 * back + rx * 0.45, y + 2.6 * back, b.z - dz * 3.7 * back + rz * 0.45); look.set(b.x + dx * 2.6 + rx * 0.2, y, b.z + dz * 2.6 + rz * 0.2);
  }

  // ---------- events from the engine ----------
  const pending: PuttEvent[] = [];
  function feed(events: PuttEvent[]) { pending.push(...events); }

  function surfaceY(h: Hole, x: number, z: number) { const t = tileAtVec(h, { x, z }); return t && playable(t) ? surface(h, t, x, z) : GROUND; }
  /** Where the putting chinchilla stands: beside the ball on the left of the aim, or behind it when a rail is in the way. */
  function stance(game: PuttGame, angle: number): { x: number; z: number; face: number } {
    const b = game.ball, d = { x: Math.cos(angle), z: Math.sin(angle) };
    for (const [px, pz] of [[d.z, -d.x], [-d.z, d.x], [-d.x, -d.z]]) {
      const at = { x: b.x + px * 0.42 - d.x * 0.15, z: b.z + pz * 0.42 - d.z * 0.15 };
      if (game.clearLine({ x: b.x + px * 0.05, z: b.z + pz * 0.05 }, at)) return { ...at, face: Math.atan2(pz, -px) };
    }
    return { x: b.x + d.z * 0.42, z: b.z - d.x * 0.42, face: Math.atan2(-d.x, -d.z) };
  }

  let friendCache: { id: string; at: Vec } = { id: '', at: { x: 0, z: 0 } };
  let lastMode = '', introFrom = V(), introLook = V(), stanceCache: { key: string; s: ReturnType<typeof stance> } | null = null;
  function draw(game: PuttGame, dt: number, view: PuttView) {
    if (closed) return;
    time += dt; frame++;
    const h = game.hole; setTheme(game.course ?? courseFor(h.id));
    if (h.id !== holeId) buildHole(game);
    const hero = heroes[game.hero], friend = heroes[game.hero === 'dora' ? 'enzo' : 'dora'];
    band.material = bandMats[game.hero];
    // events
    for (const e of pending.splice(0)) {
      const at = V(e.x ?? game.ball.x, ballY, e.z ?? game.ball.z);
      if (e.kind === 'putt') { hero.swing = 0; }
      else if (e.kind === 'cup') { burst('confetti', V(h.cup.x, ballY + 0.1, h.cup.z), 40, 2.2, 4.2, 1.8); hero.cheer = 2.2; friend.cheer = 2.2; }
      else if (e.kind === 'pickup') { friend.cheer = 0.8; }
      else if (e.kind === 'splash') { burst('drop', at, 18, 1.4, 3.2, 0.9); ripple.position.set(at.x, surfaceY(h, at.x, at.z) - 0.05, at.z); rippleT = 0; }
      else if (e.kind === 'sand') burst('dust', at, 8, 0.8, 1.2, 0.7);
      else if (e.kind === 'bumper') { const r = bumperRigs.find((b) => b.at.x === e.x && b.at.z === e.z); if (r) r.t = 0.35; burst('spark', at, 6, 1.4, 1.5, 0.4); }
      else if (e.kind === 'acorn') { if (acornRig) burst('spark', acornRig.position.clone(), 20, 1.6, 2.5, 1); }
      else if (e.kind === 'tunnel-in' || e.kind === 'tunnel-out') burst('dust', V(e.x ?? 0, surfaceY(h, e.x ?? 0, e.z ?? 0) + 0.1, e.z ?? 0), 10, 1, 1.5, 0.6);
      else if (e.kind === 'hole' || e.kind === 'turn') { cam.snap = e.kind === 'hole'; for (const r of Object.values(heroes)) { r.at = null; r.hop = null; } }
    }
    // ball: height follows the felt, but drops off a ledge with gravity instead of snapping down
    const want = game.mode === 'tunnel' ? surfaceY(h, game.ball.x, game.ball.z) - 0.5 : surfaceY(h, game.ball.x, game.ball.z) + BALL_R;
    if (game.mode === 'sunk' && dist(game.ball, h.cup) < 0.01) { ballY = Math.max(want - 0.4, ballY - dt * 1.6); ballFall = 0; }
    else if (want < ballY - 0.02 && game.mode === 'roll') { ballFall += 9.8 * dt; ballY = Math.max(want, ballY - ballFall * dt); }
    else { ballY = want; ballFall = 0; }
    if (cam.snap || frame < 3) ballY = want;
    ball.position.set(game.ball.x, ballY, game.ball.z); ball.visible = game.mode !== 'tunnel' && game.mode !== 'splash' && game.mode !== 'card' && game.mode !== 'done';
    const moved = V(game.ball.x - lastBall.x, 0, game.ball.z - lastBall.z), mlen = moved.length();
    if (mlen > 1e-5 && mlen < 1) { spin.setFromAxisAngle(V(moved.z, 0, -moved.x).normalize(), mlen / BALL_R); ball.quaternion.premultiply(spin); }
    lastBall.set(game.ball.x, 0, game.ball.z);

    // the putting chinchilla stands at the ball while aiming, hopping over after each roll
    const aiming = game.mode === 'aim' || game.mode === 'intro';
    const key = `${game.ball.x.toFixed(3)},${game.ball.z.toFixed(3)},${game.aim.angle.toFixed(2)}`;
    if (aiming && (!stanceCache || stanceCache.key !== key)) stanceCache = { key, s: stance(game, game.aim.angle) };
    if (aiming && stanceCache) {
      const s = stanceCache.s, target = V(s.x, surfaceY(h, s.x, s.z), s.z);
      if (!hero.at || game.mode === 'intro' || cam.snap) { hero.pos.copy(target); hero.hop = null; }
      else if (hero.hop) hero.hop.to.copy(target);
      else if (hero.pos.distanceTo(target) > 0.9) hero.hop = { from: hero.pos.clone(), to: target, t: 0, len: Math.max(0.35, hero.pos.distanceTo(target) / 3.2) };
      else hero.pos.lerp(target, 1 - Math.exp(-dt * 14));
      hero.at = { x: s.x, z: s.z };
      hero.face = hero.hop ? Math.atan2(-(hero.hop.to.z - hero.hop.from.z), hero.hop.to.x - hero.hop.from.x) : lerpAngle(hero.face, s.face, 1 - Math.exp(-dt * 12));
    }
    if (hero.hop) {
      hero.hop.t += dt; const f = Math.min(1, hero.hop.t / hero.hop.len);
      hero.pos.lerpVectors(hero.hop.from, hero.hop.to, f); hero.pos.y += Math.abs(Math.sin(f * Math.PI * Math.max(1, Math.round(hero.hop.len * 3)))) * 0.25;
      if (f >= 1) hero.hop = null;
    }
    if (game.mode === 'roll' && !hero.hop) hero.face = lerpAngle(hero.face, Math.atan2(-(game.ball.z - hero.pos.z), game.ball.x - hero.pos.x), dt * 4);
    // the friend minds the flag by the cup, and lifts it when a ball rolls close
    if (friendCache.id !== h.id) friendCache = { id: h.id, at: friendSpot(h) };
    const fa = friendCache.at; friend.pos.set(fa.x, surfaceY(h, fa.x, fa.z), fa.z); friend.face = Math.atan2(-(h.cup.z - fa.z), h.cup.x - fa.x);
    const close = (game.mode === 'roll' && dist(game.ball, h.cup) < 3) || game.mode === 'sunk';
    flagLift = lerp(flagLift, close ? 1 : 0, 1 - Math.exp(-dt * 6));
    if (flag) { flag.position.y = surfaceY(h, h.cup.x, h.cup.z) + flagLift * 0.55; flag.rotation.z = flagLift * 0.35; flag.children[1].rotation.y = Math.sin(time * 3) * 0.25; }
    for (const r of [hero, friend]) {
      const cheering = r.cheer > 0; r.cheer = Math.max(0, r.cheer - dt);
      r.model.root.position.copy(r.pos); if (cheering) r.model.root.position.y += Math.abs(Math.sin(r.cheer * 9)) * 0.22;
      r.model.root.rotation.y = r.face; r.model.root.visible = game.mode !== 'card' && game.mode !== 'done';
      animateHuntChinchilla(r.model, reduced.matches ? 0 : time + (r === friend ? 1.7 : 0), r.hop ? 1 : 0, true);
    }
    // putter swing: back with the power while aiming, through on the putt, then rest
    const backswing = game.mode === 'aim' ? -Math.min(0.9, game.aim.power * 0.9) * (view.dragging ? 1 : 0.35) : 0;
    if (hero.swing >= 0) { hero.swing += dt; if (hero.swing > 0.9) hero.swing = -1; }
    const through = hero.swing >= 0 ? (hero.swing < 0.12 ? lerp(backswing, 0.75, hero.swing / 0.12) : lerp(0.75, 0, Math.min(1, (hero.swing - 0.12) / 0.7))) : backswing;
    hero.putter.visible = true; hero.putter.rotation.x = through; hero.putter.updateMatrix();
    poseArms(hero.model, V(0, 0.02, 0.05).applyMatrix4(hero.putter.matrix), V(0, -0.1, -0.05).applyMatrix4(hero.putter.matrix));
    friend.putter.visible = false;
    if (friend.cheer > 0) poseArms(friend.model, V(0.35, 1.05, 0.25), V(0.35, 1.05, -0.25)); else poseArms(friend.model, V(0.42, 0.55, 0.2), V(0.42, 0.55, -0.2));

    // moving parts
    for (const s of sails) s.group.rotation.z = -windmillAngle(s.spec, game.clock);
    for (const m of movers) {
      const p = moverAt(m.spec, game.clock), y = surfaceY(h, p.x, p.z); m.group.position.set(p.x, y, p.z);
      const sp = Math.hypot(p.vx, p.vz); if (sp > 0.05) m.group.rotation.y = Math.atan2(-p.vz, p.vx);
      if (m.spec.kind === 'boar') { m.legs.forEach((l, i) => (l.rotation.z = Math.sin(time * 6 + i * Math.PI) * 0.35 * Math.min(1, sp * 2))); if (m.zzz) { const k = (time * 0.6) % 1; m.zzz.position.set(0.4 + k * 0.2, 1 + k * 0.5, 0); (m.zzz.material as T.SpriteMaterial).opacity = 1 - k; } }
      else m.legs[0].rotation.y = -game.clock * 2;
    }
    for (const b of bumperRigs) { b.t = Math.max(0, b.t - dt); const k = b.t > 0 ? Math.sin((b.t / 0.35) * Math.PI) * 0.25 : 0; b.cap.scale.set(1 + k, 1 - k, 1 + k); }
    if (acornRig) {
      const got = game.acorns.includes(h.id), before = game.profile.acorns.includes(h.id);
      acornRig.visible = !got; acornRig.rotation.y = time * 1.6; acornRig.position.y = surfaceY(h, h.acorn!.x, h.acorn!.z) + 0.24 + Math.sin(time * 2.4) * 0.04;
      acornRig.scale.setScalar(before ? 0.85 : 1);
    }
    if (water) { waterMap.offset.set(Math.sin(time * 0.3) * 0.05, time * 0.02); }
    // a lantern right in front of the lens would hide the hole, so the near ones step out of the way
    for (const [i, l] of lanternBits.entries()) { l.scale.set(1, 1.25 + Math.sin(time * 2 + i) * 0.04, 1); l.visible = l.position.distanceToSquared(camera.position) > 16; }
    if (fireflies) { fireflies.rotation.y = Math.sin(time * 0.05) * 0.05; (fireflies.material as T.PointsMaterial).opacity = 0.6 + Math.sin(time * 3) * 0.3; }
    // particles and ripple
    for (const p of particles) {
      if (!p.mesh.visible) continue; p.life -= dt; if (p.life <= 0) { p.mesh.visible = false; continue; }
      p.vel.y -= 6 * dt; p.mesh.position.addScaledVector(p.vel, dt); p.mesh.rotation.x += p.spin * dt; p.mesh.rotation.y += p.spin * 0.7 * dt;
      p.mesh.scale.setScalar(Math.min(1, p.life / (p.max * 0.4)));
    }
    if (rippleT >= 0) { rippleT += dt; const k = rippleT / 0.9; ripple.scale.setScalar(1 + k * 3); (ripple.material as T.MeshBasicMaterial).opacity = Math.max(0, 0.8 * (1 - k)); if (k >= 1) rippleT = -1; }

    // aim guide: dots along where the putt would go on flat felt
    const showGuide = game.mode === 'aim' && game.aim.power >= 0.02;
    const used = [0, 0];
    if (showGuide) {
      const pts = game.guide(); let carry = 0.18, bounced = false;
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i], len = dist(a, b), set = bounced ? 1 : 0;
        for (let s = carry; s < len && used[set] < DOTS; s += 0.2) {
          const f = s / len, x = lerp(a.x, b.x, f), z = lerp(a.z, b.z, f);
          dotAt.position.set(x, surfaceY(h, x, z) + 0.02, z); dotAt.scale.setScalar(bounced ? 0.8 : 1); dotAt.updateMatrix();
          dotSets[set].setMatrixAt(used[set]++, dotAt.matrix);
        }
        carry = Math.max(0, 0.2 - ((len - carry) % 0.2)); if (i < pts.length - 1) bounced = true;
      }
      aimRing.visible = true; aimRing.position.set(game.ball.x, ballY - BALL_R + 0.015, game.ball.z);
      const pw = game.aim.power; (aimRing.material as T.MeshBasicMaterial).color.setHSL(lerp(0.3, 0.02, pw), 0.85, 0.6);
    } else aimRing.visible = false;
    dotSets.forEach((m, i) => { m.count = used[i]; m.instanceMatrix.needsUpdate = true; });

    // camera
    if (!view.dragging && game.mode === 'aim') cam.yaw = lerpAngle(cam.yaw, game.aim.angle, 1 - Math.exp(-dt * 8));
    if (game.mode === 'intro' || cam.snap) cam.yaw = game.aim.angle;
    const pos = V(), look = V();
    if (view.overview || game.mode === 'card' || game.mode === 'done') overviewPose(h, pos, look);
    else if (game.mode === 'intro') {
      const total = game.turn === 0 ? INTRO : TURN_INTRO, f = smooth(Math.min(1, Math.max(0, 1 - game.timer / total)));
      if (lastMode !== 'intro' || cam.snap) { if (game.turn === 0) overviewPose(h, introFrom, introLook); else { introFrom.copy(cam.pos); introLook.copy(cam.look); } }
      const ap = V(), al = V(); aimPose(game, cam.yaw, ap, al); pos.lerpVectors(introFrom, ap, f); look.lerpVectors(introLook, al, f);
    } else if (game.mode === 'sunk') {
      // a slow circle round the cup, looking down from above so a windmill or hay block beside the cup never gets in the way
      cam.orbit += dt * 0.35; look.set(h.cup.x, surfaceY(h, h.cup.x, h.cup.z), h.cup.z);
      const tall = h.windmills.some((m) => dist(m.centre, h.cup) < 3.2), r = tall ? 1.4 : 2.2, up = tall ? 4.2 : 2.6, a = cam.yaw + Math.PI + cam.orbit;
      pos.set(h.cup.x + Math.cos(a) * r, look.y + up, h.cup.z + Math.sin(a) * r);
    }
    else if (game.mode === 'aim') aimPose(game, cam.yaw, pos, look);
    else {
      // rolling: follow the ball from where the camera already is, keeping a comfortable distance
      cam.orbit = 0; look.set(game.ball.x, ballY, game.ball.z);
      const off = V().subVectors(cam.pos, look); off.y = 0; let d = off.length(); if (d < 1e-3) { off.set(-Math.cos(cam.yaw), 0, -Math.sin(cam.yaw)); d = 1; }
      off.multiplyScalar(Math.min(4.6, Math.max(3.2, d)) / d); pos.copy(look).add(off); pos.y = look.y + 2.9;
    }
    if (game.mode !== 'sunk') cam.orbit = 0;
    const k = cam.snap ? 1 : 1 - Math.exp(-dt * (game.mode === 'intro' ? 12 : 4));
    cam.pos.lerp(pos, k); cam.look.lerp(look, k); cam.snap = false; lastMode = game.mode;
    camera.position.copy(cam.pos); camera.lookAt(cam.look);

    renderer.info.reset();
    outline.render(scene, camera);
    if (!firstFrame) { firstFrame = true; ready(); }
  }
  function friendSpot(h: Hole): Vec {
    // the free felt next to the cup furthest from the way in
    let best = { x: h.cup.x + 0.62, z: h.cup.z }, score = -Infinity;
    for (const a of [0, 1, 2, 3, 4, 5, 6, 7].map((i) => (i * Math.PI) / 4)) {
      const p = { x: h.cup.x + Math.cos(a) * 0.62, z: h.cup.z + Math.sin(a) * 0.62 }, t = tileAtVec(h, p);
      if (!t || t.kind !== 'felt' || t.corner) continue;
      const s = dist(p, h.tee) + (h.walls.some((w) => segDist(w, p) < 0.25) ? -5 : 0);
      if (s > score) { score = s; best = p; }
    }
    return best;
  }
  function segDist(w: { ax: number; az: number; bx: number; bz: number }, p: Vec) { const dx = w.bx - w.ax, dz = w.bz - w.az, l = dx * dx + dz * dz, t = l ? Math.max(0, Math.min(1, ((p.x - w.ax) * dx + (p.z - w.az) * dz) / l)) : 0; return Math.hypot(p.x - w.ax - dx * t, p.z - w.az - dz * t); }
  function lerpAngle(a: number, b: number, k: number) { const d = Math.atan2(Math.sin(b - a), Math.cos(b - a)); return a + d * k; }

  /** The point on the felt under a pointer, at the ball's height. */
  function groundPoint(clientX: number, clientY: number): Vec | null {
    const r = canvas.getBoundingClientRect(), ndc = new T.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    const ray = new T.Raycaster(); ray.setFromCamera(ndc, camera);
    const hit = ray.ray.intersectPlane(new T.Plane(V(0, 1, 0), -(ballY - BALL_R)), V());
    return hit ? { x: hit.x, z: hit.z } : null;
  }
  /** Where a point on the ball's level shows on screen, in client pixels (the browser suite drags from the ball with it). */
  function screenPoint(x: number, z: number) {
    const r = canvas.getBoundingClientRect(), p = V(x, ballY - BALL_R, z).project(camera);
    return { x: r.left + ((p.x + 1) / 2) * r.width, y: r.top + ((1 - p.y) / 2) * r.height };
  }
  function resize() { if (closed) return; const w = Math.max(1, canvas.clientWidth), h = Math.max(1, canvas.clientHeight); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  const observer = new ResizeObserver(resize); observer.observe(canvas); resize();
  function metrics() { return { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, textures: renderer.info.memory.textures, geometries: renderer.info.memory.geometries }; }
  function dispose() {
    closed = true; observer.disconnect(); clearHole();
    for (const g of geometries) g.dispose(); for (const m of materials) m.dispose(); for (const t of textures) t.dispose(); skyTexture?.dispose();
    for (const r of Object.values(heroes)) r.model.root.traverse((o) => { const m = o as T.Mesh; if (m.isMesh) { m.geometry.dispose(); (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => x.dispose()); } });
    renderer.dispose(); renderer.forceContextLoss();
  }
  void failed;
  return { draw, feed, groundPoint, screenPoint, metrics, dispose, get yaw() { return cam.yaw; } };
}
