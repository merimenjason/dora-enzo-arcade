import * as T from 'three';
import { OutlineEffect } from 'three/examples/jsm/effects/OutlineEffect.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createHuntChinchilla, animateHuntChinchilla, poseArms, type HuntChinchilla } from './hunt-chinchilla';
import { KINDS, INTRO, topSpeed, type Kind, type RollEvent, type RollGame } from './roll-game';

const TOO_BIG = 0xff7a5c, GOLD = 0xffd23f;

const V = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);
const UP = V(0, 1, 0);
const noOutline = <M extends T.Material>(m: M): M => { m.userData.outlineParameters = { visible: false }; return m; };
/** Deterministic scatter for decorations, so a level always looks the same. */
function scatter(seed: number) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

type Slot = { mesh: T.InstancedMesh; index: number };
type Stuck = { local: T.Matrix4; at: number };

export type RollScene = ReturnType<typeof createRollScene>;

/** Drawing only. The page owns the clock and the game; this owns every GPU resource. */
export function createRollScene(canvas: HTMLCanvasElement, ready: () => void) {
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  const phone = matchMedia('(pointer:coarse)').matches || innerWidth < 700;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, phone ? 1.25 : 1.6));
  renderer.toneMapping = T.NoToneMapping; renderer.outputColorSpace = T.SRGBColorSpace; renderer.info.autoReset = false;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = phone ? T.BasicShadowMap : T.PCFSoftShadowMap;
  const outline = new OutlineEffect(renderer, { defaultThickness: 0.0042, defaultColor: [0.13, 0.09, 0.07] });
  const scene = new T.Scene(), camera = new T.PerspectiveCamera(55, 1, 0.01, 400);
  const textures = new Set<T.Texture>(), materials = new Set<T.Material>(), geometries = new Set<T.BufferGeometry>();
  const loader = new T.TextureLoader();
  let closed = false, time = 0, firstFrame = false, current: RollGame | null = null;

  const ramp = new T.DataTexture(new Uint8Array([96, 178, 255]), 3, 1, T.RedFormat);
  ramp.minFilter = ramp.magFilter = T.NearestFilter; ramp.generateMipmaps = false; ramp.needsUpdate = true; textures.add(ramp);
  const toon = (color: number, map: T.Texture | null = null, extra: T.MeshToonMaterialParameters = {}) => { const m = new T.MeshToonMaterial({ color, gradientMap: ramp, map, ...extra }); materials.add(m); return m; };
  const geo = <G extends T.BufferGeometry>(g: G) => { geometries.add(g); return g; };
  function paint(url: string, repeat: number) {
    const t = loader.load(url, undefined, undefined, () => {}); t.colorSpace = T.SRGBColorSpace; t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(repeat, repeat);
    t.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy()); textures.add(t); return t;
  }

  // ---------- light, sky, ground ----------
  const hemi = new T.HemisphereLight(0xeaf6ff, 0x7c9d55, 1.45); scene.add(hemi);
  const sun = new T.DirectionalLight(0xfff1da, 1.75); sun.castShadow = true; sun.shadow.mapSize.setScalar(phone ? 1024 : 2048);
  sun.shadow.bias = -0.0004; scene.add(sun, sun.target);
  scene.background = new T.Color(0xb7d9ee); scene.fog = new T.Fog(0xcfe3d6, 10, 40);
  loader.load('/art/hunt/sky-meadow.webp', (t) => { if (closed) { t.dispose(); return; } t.mapping = T.EquirectangularReflectionMapping; t.colorSpace = T.SRGBColorSpace; textures.add(t); scene.background = t; }, undefined, () => {});
  const grassMap = paint('/art/hunt/tex-meadow-grass.webp', 1);
  const grassMat = noOutline(toon(0xa8d47a, grassMap));
  const ground = new T.Mesh(geo(new T.PlaneGeometry(1, 1)), grassMat); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  const woodMat = toon(0xd9a35a, paint('/art/putt/tex-wood.webp', 1));
  const fence = new T.Group(); scene.add(fence);

  // ---------- things: one instanced mesh per kind, all sharing one vertex-coloured material ----------
  const thingMat = toon(0xffffff, null, { vertexColors: true });
  /** Bake a primitive's colour into its vertices and strip it to position + normal + colour, so all the parts merge. */
  function part(g: T.BufferGeometry, color: number, m?: T.Matrix4) {
    const n = g.index ? g.toNonIndexed() : g; if (n !== g) g.dispose();
    if (m) n.applyMatrix4(m);
    for (const name of Object.keys(n.attributes)) if (name !== 'position' && name !== 'normal') n.deleteAttribute(name);
    const c = new T.Color(color), count = n.getAttribute('position').count, col = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    n.setAttribute('color', new T.BufferAttribute(col, 3)); return n;
  }
  const at = (x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) =>
    new T.Matrix4().compose(V(x, y, z), new T.Quaternion().setFromEuler(new T.Euler(rx, ry, rz)), V(sx, sy, sz));
  /** A kind's shape at its own size: footprint radius `r`, height `h`, standing on y = 0. */
  function shapeOf(k: Kind): T.BufferGeometry {
    const { r, h } = k, c = k.color, a = k.accent ?? k.color, parts: T.BufferGeometry[] = [];
    // tiny things are a few pixels across, so they get far fewer segments
    const fine = r < 0.035 ? 0.5 : r < 0.1 ? 0.75 : 1, n = (x: number) => Math.max(5, Math.round(x * fine));
    const Sphere = (w: number, hh: number, ...rest: number[]) => new T.SphereGeometry(1, n(w), Math.max(4, n(hh)), ...rest);
    switch (k.shape) {
      case 'ball': parts.push(part(Sphere(16, 12), c, at(0, h / 2, 0, r, h / 2, r)));
        if (k.accent) parts.push(part(new T.ConeGeometry(0.25, 1, 6), a, at(0, h, 0, r, r * 0.6, r))); break;
      case 'egg': parts.push(part(Sphere(14, 10), c, at(0, h / 2, 0, r, h / 2, r * 0.75)));
        if (k.accent) parts.push(part(Sphere(12, 6, 0, Math.PI * 2, 0, Math.PI / 2), a, at(0, h * 0.62, 0, r * 1.05, h * 0.3, r * 0.8))); break;
      case 'box': parts.push(part(new T.BoxGeometry(1, 1, 1), c, at(0, h / 2, 0, r * 1.4, h, r * 1.4)));
        if (k.accent) parts.push(part(new T.BoxGeometry(1, 1, 1), a, at(0, h * 0.5, 0, r * 1.42, h * 0.22, r * 1.42))); break;
      case 'disc': parts.push(part(new T.CylinderGeometry(1, 1, 1, 18), c, at(0, h / 2, 0, r, h, r)));
        if (k.accent) parts.push(part(new T.CylinderGeometry(1, 1, 1, 18), a, at(0, h / 2, 0, r * 1.03, h * 0.35, r * 1.03))); break;
      case 'cone': parts.push(part(new T.ConeGeometry(1, 1, 10), c, at(0, h / 2, 0, r, h, r)));
        if (k.accent) parts.push(part(new T.ConeGeometry(0.5, 1, 6), a, at(0, h * 1.05, 0, r, h * 0.3, r, Math.PI))); break;
      case 'stick': parts.push(part(new T.CapsuleGeometry(1, 2, 4, 10), c, at(0, h / 2, 0, h / 2, r / 2, h / 2, 0, 0, Math.PI / 2)));
        if (k.accent) parts.push(part(new T.CylinderGeometry(1, 1, 1, 10), a, at(r * 0.55, h / 2, 0, h * 0.52, r * 0.2, h * 0.52, 0, 0, Math.PI / 2))); break;
      case 'leaf': for (let i = 0; i < 3; i++) { const ang = (i * Math.PI * 2) / 3; parts.push(part(Sphere(10, 6), c, at(Math.cos(ang) * r * 0.45, h / 2, Math.sin(ang) * r * 0.45, r * 0.5, h / 2, r * 0.42, 0, -ang))); } break;
      case 'puff': parts.push(part(new T.CylinderGeometry(1, 1, 1, 6), a, at(0, h * 0.35, 0, r * 0.12, h * 0.7, r * 0.12)));
        parts.push(part(Sphere(14, 10), c, at(0, h * 0.72, 0, r, Math.min(r, h * 0.3), r))); break;
      case 'cup': parts.push(part(new T.CylinderGeometry(1, 0.78, 1, 18), c, at(0, h / 2, 0, r, h, r)));
        parts.push(part(new T.CylinderGeometry(1, 1, 1, 18), a, at(0, h * 0.9, 0, r * 0.86, h * 0.12, r * 0.86))); break;
      case 'pole': parts.push(part(new T.CylinderGeometry(1, 1, 1, 6), 0xf4f0e6, at(0, h / 2, 0, r * 0.08, h, r * 0.08)));
        parts.push(part(new T.BoxGeometry(1, 1, 1), c, at(r * 0.45, h * 0.84, 0, r * 0.9, h * 0.22, r * 0.05)));
        parts.push(part(new T.CylinderGeometry(1, 1, 1, 12), a, at(0, h * 0.01, 0, r * 0.6, h * 0.02, r * 0.6))); break;
      case 'house': parts.push(part(new T.BoxGeometry(1, 1, 1), c, at(0, h * 0.32, 0, r * 1.3, h * 0.64, r * 1.3)));
        parts.push(part(new T.ConeGeometry(1, 1, 4), a, at(0, h * 0.82, 0, r * 1.05, h * 0.36, r * 1.05, 0, Math.PI / 4))); break;
      case 'tree': parts.push(part(new T.CylinderGeometry(0.7, 1, 1, 8), a, at(0, h * 0.25, 0, r * 0.18, h * 0.5, r * 0.18)));
        parts.push(part(Sphere(14, 10), c, at(0, h * 0.62, 0, r, h * 0.38, r))); break;
      case 'critter': parts.push(part(Sphere(14, 10), c, at(0, h * 0.42, 0, r, h * 0.42, r * 0.8)));
        parts.push(part(Sphere(12, 8), a, at(r * 0.85, h * 0.5, 0, r * 0.38, h * 0.3, r * 0.34)));
        parts.push(part(Sphere(8, 6), 0x2b2320, at(r * 1.2, h * 0.52, 0, r * 0.07, r * 0.07, r * 0.07))); break;
    }
    const merged = mergeGeometries(parts); for (const p of parts) p.dispose(); return geo(merged!);
  }
  const shapes = new Map<string, T.BufferGeometry>();
  const shapeFor = (id: string) => { let g = shapes.get(id); if (!g) { g = shapeOf(KINDS[id]); shapes.set(id, g); } return g; };

  let meshes: T.InstancedMesh[] = [], slots: Slot[] = [], stuck = new Map<number, Stuck>(), hops = new Map<number, number>();
  /** Critters and golden things are redrawn every frame; the rest only move when they stick, fall off or hop. */
  let movers: number[] = [];
  const m4 = new T.Matrix4(), q = new T.Quaternion(), q2 = new T.Quaternion(), p3 = V(), s3 = V();
  function freeMatrix(game: RollGame, id: number, lift = 0, spin = 0) {
    const t = game.things[id], k = KINDS[t.kind], s = t.r / k.r;
    return m4.compose(p3.set(t.x, lift, t.z), q.setFromAxisAngle(UP, t.yaw + spin), s3.set(s, s, s));
  }

  // ---------- rings on the ground: coral round anything too big to roll up yet, gold round golden things ----------
  const RINGS = 256;
  const ringMat = noOutline(new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })); materials.add(ringMat);
  const rings = new T.InstancedMesh(geo(new T.RingGeometry(0.84, 1, 40).rotateX(-Math.PI / 2)), ringMat, RINGS);
  rings.frustumCulled = false; rings.renderOrder = 1; scene.add(rings);
  const tint = new T.Color();
  for (let i = 0; i < RINGS; i++) rings.setColorAt(i, tint.set(TOO_BIG));

  // ---------- sparkles: little bursts when things stick ----------
  const SPARKS = 160;
  const sparkMat = noOutline(new T.MeshBasicMaterial({ color: 0xffffff })); materials.add(sparkMat);
  const sparkMesh = new T.InstancedMesh(geo(new T.IcosahedronGeometry(1, 0)), sparkMat, SPARKS); sparkMesh.frustumCulled = false; scene.add(sparkMesh);
  type Spark = { p: T.Vector3; v: T.Vector3; life: number; max: number; size: number; fall: number };
  const sparks: Spark[] = []; let nextSpark = 0;
  for (let i = 0; i < SPARKS; i++) { sparks.push({ p: V(), v: V(), life: 0, max: 1, size: 0, fall: 0 }); sparkMesh.setColorAt(i, tint.set(0xffffff)); sparkMesh.setMatrixAt(i, m4.makeScale(0, 0, 0)); }
  function burst(at: T.Vector3, color: number, n: number, size: number, speed: number) {
    for (let i = 0; i < n; i++) {
      const sp = sparks[nextSpark], a = Math.random() * Math.PI * 2, up = 0.5 + Math.random() * 0.8;
      sp.p.copy(at); sp.v.set(Math.cos(a) * speed, up * speed * 1.4, Math.sin(a) * speed).multiplyScalar(0.6 + Math.random() * 0.6);
      sp.max = sp.life = 0.45 + Math.random() * 0.3; sp.size = size * (0.6 + Math.random() * 0.6); sp.fall = speed * 4;
      sparkMesh.setColorAt(nextSpark, tint.set(color)); nextSpark = (nextSpark + 1) % SPARKS;
    }
    if (sparkMesh.instanceColor) sparkMesh.instanceColor.needsUpdate = true;
  }
  function build(game: RollGame) {
    for (const m of meshes) { scene.remove(m); m.dispose(); }
    meshes = []; slots = []; stuck = new Map(); hops = new Map();
    movers = game.things.filter((t) => KINDS[t.kind].walk || KINDS[t.kind].tags?.includes('golden')).map((t) => t.id);
    for (const sp of sparks) sp.life = 0;
    const byKind = new Map<string, number[]>();
    for (const t of game.things) { const l = byKind.get(t.kind); if (l) l.push(t.id); else byKind.set(t.kind, [t.id]); }
    for (const [kind, ids] of byKind) {
      const mesh = new T.InstancedMesh(shapeFor(kind), thingMat, ids.length); mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
      ids.forEach((id, i) => { slots[id] = { mesh, index: i }; mesh.setMatrixAt(i, freeMatrix(game, id)); });
      mesh.instanceMatrix.setUsage(T.DynamicDrawUsage); meshes.push(mesh); scene.add(mesh);
    }
    // the ground and fence fit the level
    const half = game.spec.half, size = half * 2 + 400;
    ground.scale.set(size, size, 1); const tile = Math.max(0.25, half * 0.05); grassMap.repeat.set(size / tile, size / tile);
    for (const c of [...fence.children]) { fence.remove(c); (c as T.Mesh).geometry?.dispose(); }
    const fh = half * 0.045, posts = Math.round((half * 8) / (fh * 1.6)), postGeo = new T.BoxGeometry(fh * 0.16, fh, fh * 0.16);
    const postMesh = new T.InstancedMesh(postGeo, woodMat, posts); postMesh.castShadow = true;
    for (let i = 0; i < posts; i++) {
      const f = (i / posts) * 4, side = Math.floor(f), u = (f - side) * 2 - 1, x = [u, 1, -u, -1][side] * half, z = [-1, u, 1, -u][side] * half;
      postMesh.setMatrixAt(i, m4.makeTranslation(x, fh / 2, z));
    }
    fence.add(postMesh);
    for (const [y, th] of [[fh * 0.45, fh * 0.12], [fh * 0.82, fh * 0.12]] as const) for (const [x, z, w, d] of [[0, -half, half * 2, fh * 0.06], [0, half, half * 2, fh * 0.06], [-half, 0, fh * 0.06, half * 2], [half, 0, fh * 0.06, half * 2]] as const) {
      const rail = new T.Mesh(new T.BoxGeometry(w, th, d), woodMat); rail.position.set(x, y, z); rail.castShadow = true; fence.add(rail);
    }
    // the ball starts at its own size, and the camera starts high for the fly-in
    vis = game.ball.r; ballGroup.quaternion.identity(); cam.snap = true;
  }

  // ---------- the fluffball ----------
  const ballGroup = new T.Group(); scene.add(ballGroup);
  const fluffGeo = (() => {
    const g = new T.IcosahedronGeometry(1, 4), pos = g.getAttribute('position'), v = V();
    for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).normalize(); const n = Math.sin(v.x * 11) * Math.sin(v.y * 9 + 1) * Math.sin(v.z * 10 + 2); v.multiplyScalar(1 + Math.max(0, n) * 0.08); pos.setXYZ(i, v.x, v.y, v.z); }
    g.computeVertexNormals(); return geo(g);
  })();
  const core = new T.Mesh(fluffGeo, toon(0xf3e6cc, paint('/art/putt/tex-dust.webp', 2))); core.castShadow = true; ballGroup.add(core);
  let vis = 0.05, pop = 0;

  // ---------- Dora pushes, Enzo runs on top ----------
  const dora = createHuntChinchilla(true), enzo = createHuntChinchilla(false);
  for (const c of [dora, enzo]) { c.root.traverse((o) => { if ((o as T.Mesh).isMesh) (o as T.Mesh).castShadow = true; }); scene.add(c.root); }
  /** The rig is about 1.3 units tall at scale 1: Dora starts a little taller than the ball and grows more slowly than it. */
  const heroScale = (r: number, start: number) => start * 1.05 * Math.pow(Math.max(1, r / start), 0.5);

  // ---------- camera ----------
  const cam = { pos: V(0, 3, 4), look: V(), snap: true };
  const fwd = V(), dir = V(), look = V(), want = V();

  /** Things that happened this step: stick them to the ball where they touched, or drop them back on the ground. */
  function feed(game: RollGame, events: RollEvent[]) {
    if (current !== game) return;
    for (const e of events) {
      if (e.kind === 'stick') {
        const t = game.things[e.id], k = KINDS[t.kind], s = t.r / k.r;
        // where it touched, in the ball's own turning frame; it stands out from the ball like a pin in a cushion
        const inv = ballGroup.quaternion.clone().invert(), d = V(...e.dir).applyQuaternion(inv).normalize();
        q2.setFromUnitVectors(UP, d).multiply(q.setFromAxisAngle(UP, t.yaw));
        const local = new T.Matrix4().compose(d.clone().multiplyScalar(e.at * 0.86 - Math.min(k.h, t.r * 2) * s * 0.25), q2, V(s, s, s));
        stuck.set(e.id, { local, at: e.at }); pop = Math.min(0.12, pop + 0.03 + (t.r / Math.max(e.at, 1e-4)) * 0.1);
        hops.delete(e.id);
        const b = game.ball, share = t.r / Math.max(e.at, 1e-4);
        burst(V(b.x + e.dir[0] * e.at, e.at + e.dir[1] * e.at, b.z + e.dir[2] * e.at), k.color, Math.min(8, 2 + Math.round(share * 12)), e.at * 0.07, e.at * 2.2);
      } else if (e.kind === 'golden') {
        const b = game.ball; burst(V(b.x, b.r * 2.1, b.z), GOLD, 18, b.r * 0.12, b.r * 3.5);
      } else if (e.kind === 'ready') {
        // everything that just became rollable near the ball gives a little hop
        const b = game.ball, kinds = new Set(e.kinds), reach = Math.max(0.8, b.r * 16);
        for (const t of game.near(b.x, b.z, reach)) if (!t.stuck && kinds.has(t.kind) && game.canRoll(t) && Math.hypot(t.x - b.x, t.z - b.z) < reach) hops.set(t.id, 0.6);
      } else if (e.kind === 'knock') for (const id of e.ids) { stuck.delete(id); hops.set(id, 0.6); }
    }
  }

  function draw(game: RollGame, dt: number) {
    if (closed) return;
    if (current !== game) { current = game; build(game); }
    time += dt;
    const b = game.ball, r = b.r, speed = Math.hypot(b.vx, b.vz);
    vis += (r - vis) * (1 - Math.exp(-dt * 10)); pop *= Math.exp(-dt * 9);

    // roll: turn about the axis across the way it's going, by the distance over the radius
    if (speed > 1e-5) { dir.set(b.vz, 0, -b.vx).normalize(); ballGroup.quaternion.premultiply(q.setFromAxisAngle(dir, (speed * dt) / Math.max(vis, 1e-4))); }
    ballGroup.position.set(b.x, vis, b.z); ballGroup.updateMatrixWorld(true);
    core.scale.setScalar(vis * 0.97 * (1 + pop));

    // the stuck things ride the ball; the deeply buried ones hide
    for (const [id, s] of stuck) {
      const slot = slots[id];
      if (s.at < vis * 0.55) m4.makeScale(0, 0, 0); else m4.multiplyMatrices(ballGroup.matrixWorld, s.local);
      slot.mesh.setMatrixAt(slot.index, m4);
    }
    for (const [id, left] of hops) {
      const l = left - dt, slot = slots[id], t = game.things[id];
      if (t.stuck) { hops.delete(id); continue; }
      if (l <= 0) { hops.delete(id); slot.mesh.setMatrixAt(slot.index, freeMatrix(game, id)); continue; }
      hops.set(id, l); slot.mesh.setMatrixAt(slot.index, freeMatrix(game, id, Math.abs(Math.sin((l / 0.3) * Math.PI)) * t.r * 2.2));
    }
    // critters waddle as they go; golden things turn and bob
    for (const id of movers) {
      const t = game.things[id]; if (t.stuck || hops.has(id)) continue;
      const slot = slots[id], golden = !KINDS[t.kind].walk;
      if (golden) slot.mesh.setMatrixAt(slot.index, freeMatrix(game, id, t.r * 0.4 * (1 + Math.sin(time * 3 + id)), time * 1.6));
      else slot.mesh.setMatrixAt(slot.index, freeMatrix(game, id, Math.abs(Math.sin(time * 16 + id)) * t.r * 0.25));
    }
    for (const m of meshes) m.instanceMatrix.needsUpdate = true;

    // rings round everything near the ball that it can't roll up yet, and round golden things
    let ringCount = 0;
    const reach = Math.max(0.6, r * 12), lift = Math.max(0.0015, vis * 0.02), pulse = 1 + Math.sin(time * 5) * 0.05;
    for (const t of game.near(b.x, b.z, reach)) {
      if (ringCount >= RINGS) break;
      if (t.stuck || Math.hypot(t.x - b.x, t.z - b.z) - t.r > reach) continue;
      const golden = KINDS[t.kind].tags?.includes('golden');
      if (!golden && game.canRoll(t)) continue;
      const size = t.r * (golden ? 1.7 : 1.22) * (golden ? 1 : pulse) + vis * 0.03;
      rings.setMatrixAt(ringCount, m4.compose(p3.set(t.x, lift, t.z), q.identity(), s3.set(size, 1, size)));
      rings.setColorAt(ringCount, tint.set(golden ? GOLD : TOO_BIG)); ringCount++;
    }
    rings.count = ringCount; rings.instanceMatrix.needsUpdate = true; if (rings.instanceColor) rings.instanceColor.needsUpdate = true;

    for (let i = 0; i < SPARKS; i++) {
      const sp = sparks[i];
      if (sp.life <= 0) { sparkMesh.setMatrixAt(i, m4.makeScale(0, 0, 0)); continue; }
      sp.life -= dt; sp.v.y -= sp.fall * dt; sp.p.addScaledVector(sp.v, dt);
      const k = Math.max(0, sp.life / sp.max) * sp.size; sparkMesh.setMatrixAt(i, m4.compose(sp.p, q.identity(), s3.set(k, k, k)));
    }
    sparkMesh.instanceMatrix.needsUpdate = true;

    // the heroes
    const hs = heroScale(vis, game.spec.start);
    if (speed > topSpeed(r) * 0.08) fwd.set(b.vx, 0, b.vz).normalize(); else fwd.set(Math.cos(game.heading), 0, Math.sin(game.heading));
    const face = -Math.atan2(fwd.z, fwd.x), run = Math.min(1, speed / Math.max(1e-4, topSpeed(r)));
    dora.root.scale.setScalar(hs); dora.root.position.set(b.x - fwd.x * (vis + hs * 0.6), 0, b.z - fwd.z * (vis + hs * 0.6)); dora.root.rotation.y = face;
    animateHuntChinchilla(dora, time * (0.6 + run * 0.6), run * 2, true); dora.body.rotation.z = -0.25 * run;
    poseArms(dora, V(0.62, 0.62, -0.2), V(0.62, 0.62, 0.2));
    enzo.root.scale.setScalar(hs * 0.7); enzo.root.position.set(b.x, vis * 2 * (1 + pop) - hs * 0.04, b.z); enzo.root.rotation.y = face;
    animateHuntChinchilla(enzo, time * 1.2, run > 0.05 ? 2 : 0, true);
    if (game.mode === 'done' && game.reached) poseArms(enzo, V(0.3, 1.05, -0.3), V(0.3, 1.05, 0.3)); else poseArms(enzo, V(0.25, 0.75, -0.42), V(0.25, 0.75, 0.42));

    // camera behind the heading, pulling back as the ball grows; the intro swoops down from above
    const hx = Math.cos(game.heading), hz = Math.sin(game.heading), tall = camera.aspect < 1 ? 1.45 : 1, back = (vis * 4 + hs * 1.2) * tall, up = (vis * 4.8 + hs * 2.8) * tall;
    look.set(b.x + hx * vis * 2.2, vis * 0.6, b.z + hz * vis * 2.2);
    want.set(b.x - hx * back, up, b.z - hz * back);
    if (game.mode === 'intro') { const f = Math.max(0, game.timer / INTRO); want.lerp(V(b.x - hx * back * 4, up * 9, b.z - hz * back * 4), f * f); }
    if (game.mode === 'done') { const a = game.heading + Math.PI + time * 0.25; want.set(b.x + Math.cos(a) * back * 1.3, up * 1.6, b.z + Math.sin(a) * back * 1.3); }
    const k = cam.snap ? 1 : 1 - Math.exp(-dt * 5); cam.pos.lerp(want, k); cam.look.lerp(look, k); cam.snap = false;
    camera.position.copy(cam.pos); camera.lookAt(cam.look);
    const scale = Math.max(vis, 0.04);
    camera.near = Math.max(0.004, scale * 0.08); camera.far = Math.max(60, game.spec.half * 6); camera.updateProjectionMatrix();
    const fog = scene.fog as T.Fog; fog.near = Math.max(4, scale * 40); fog.far = Math.max(14, scale * 140, game.spec.half * 2.4);

    // the sun's shadow box follows the ball and grows with it
    const box = Math.max(1.5, scale * 22, hs * 6), sc = sun.shadow.camera;
    sun.position.set(b.x + box * 0.6, box * 1.4, b.z + box * 0.4); sun.target.position.set(b.x, 0, b.z);
    if (sc.right !== box) { sc.left = -box; sc.right = box; sc.top = box; sc.bottom = -box; sc.near = 0.01; sc.far = box * 4; sc.updateProjectionMatrix(); }
    sun.shadow.normalBias = box * 0.004;

    renderer.info.reset();
    outline.render(scene, camera);
    if (!firstFrame) { firstFrame = true; ready(); }
  }

  function resize() { if (closed) return; const w = Math.max(1, canvas.clientWidth), h = Math.max(1, canvas.clientHeight); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  const observer = new ResizeObserver(resize); observer.observe(canvas); resize();
  function metrics() { return { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, textures: renderer.info.memory.textures, geometries: renderer.info.memory.geometries }; }
  function dispose() {
    closed = true; observer.disconnect();
    for (const m of meshes) m.dispose();
    for (const c of fence.children) (c as T.Mesh).geometry?.dispose();
    for (const g of geometries) g.dispose(); for (const m of materials) m.dispose(); for (const t of textures) t.dispose();
    for (const c of [dora, enzo]) c.root.traverse((o) => { const m = o as T.Mesh; if (m.isMesh) { m.geometry.dispose(); (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => x.dispose()); } });
    renderer.dispose(); renderer.forceContextLoss();
  }
  return { draw, feed, metrics, dispose };
}
